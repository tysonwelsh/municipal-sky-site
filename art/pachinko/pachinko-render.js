/* MOTHER LODE — renderer
 *
 * The render contract (see pachinko-main.js's header and PLAN §12):
 *   window.PachinkoRender = { GLASS_W, GLASS_H, CAB_W, CAB_H, GLASS_X, GLASS_Y,
 *                             build(board), draw(ctx, view), … }
 * ctx is the CAB_W × CAB_H cabinet canvas at 1:1; main.js owns the camera.
 *
 * FRAME PIPELINE (per draw):
 *   0. LIGHT, first: one analytic model of the mine's light on a 2-px grid
 *      (ambient purple-black, the case light over the painted sky, every
 *      lamp's pool, the curator's pin spots, the dark's soft edge, the lode's
 *      held breath and flare). From the grid, in ONE pass over the glass:
 *        the lightmap      (posterised on the Bayer grid, painted light)
 *        the pin light     (the same, never below a floor: pins must read)
 *        the haze          (warm light hanging in the smoke round each flame)
 *      and the same grid answers every CPU question (R.lightAt, R.darkAt, a
 *      figure's one flat colour). Nothing is allocated per frame.
 *   1. the cabinet (static layer + live bulbs, the feed tube, the coin lamp)
 *   2. the glass interior, composed in a 320 × 416 scene canvas:
 *      a. ALBEDO: the baked mine + live parts + the figures' cast shadows
 *      b. × the lightmap, + the haze
 *      c. the FIGURES, each lit by one flat colour (the light at his chest):
 *         carved toys, lit whole, never dithered by a pool's edge
 *      d. the FOREGROUND (pins, markers, bay boards, pins in hand) × the pin light
 *      e. EMISSIVE: flames, lit windows, coal glints where lit, hit sparks,
 *         the watch's hand, the moth
 *      f. marbles (glass cat's-eyes with the mine upside-down inside them,
 *         a caustic in their shadow when they're in the light), the hopper
 *      g. the glass: nicotine tint (multiply), reflection streak, smears
 *   3. overlays taped to the glass (cards, sticker), dimmed by the room's
 *      light: in PLAY the house lights go down and the mine is the show
 *
 * LIGHT API (for mischief and the knockers):
 *   view.fx.lights = { regionId: 0..2 }   scale a region's lamps (0 = lamps out)
 *   view.fx.dark   = { regionId: 0..1 }   black the region out, soft-edged
 *   view.fx.flare  = 0..1                 every lamp flares (the mother lode)
 *   figures with lamp !== false add their candle's pool automatically;
 *   view.fx.extraLamps = [{x, y, r, c, k}] adds pools (e.g. a lode glow)
 *   R.lightAt(x, y) → 0..~1.5 luminance of the light at a point
 *   R.darkAt(x, y) → 0..1 how far a point is into a blacked-out section
 *
 * No Math.random, no Date: flicker and twinkle are hashes of view.t.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline;
  var disc = A.disc, bayer = A.bayer;

  var GW = 320, GH = 416, C = A.CAB;
  var R = {
    GLASS_W: GW, GLASS_H: GH, CAB_W: C.W, CAB_H: C.H, GLASS_X: C.GX, GLASS_Y: C.GY
  };

  var cabStatic = null, tint = null, sheen = null;
  var mine = null;          // { albedo, fore, lamps, glints, emissive, pins, figs, overlay, … }
  var scene = null, sg = null, mc = null, mcg = null;
  var lightC = null, lg = null, light2C = null, lg2 = null, hazeC = null, hg = null;
  var foreC = null, fcg = null, maskC = null, mkg = null, hotC = null, htg = null, overC = null, ovg = null;
  var board = null, overlayKey = null, overlayC = null, regKey = null;

  /* ══ build ═════════════════════════════════════════════════════════ */
  function build(b) {
    board = b;
    if (!cabStatic) {
      cabStatic = A.buildCabinet();
      tint = A.buildGlassTint();
      sheen = A.buildGlassSheen();
      scene = A.makeCanvas(GW, GH); sg = scene.getContext('2d');
      mc = A.makeCanvas(13, 13); mcg = mc.getContext('2d');
      lightC = A.makeCanvas(GW, GH); lg = lightC.getContext('2d');
      light2C = A.makeCanvas(GW, GH); lg2 = light2C.getContext('2d');
      hazeC = A.makeCanvas(GW, GH); hg = hazeC.getContext('2d');
      foreC = A.makeCanvas(GW, GH); fcg = foreC.getContext('2d');
      maskC = A.makeCanvas(GW, GH); mkg = maskC.getContext('2d');
      hotC = A.makeCanvas(GW, GH); htg = hotC.getContext('2d');
      overC = A.makeCanvas(GW, GH); ovg = overC.getContext('2d');
      initLight();
    }
    mine = A.paintMine(b);
    mine.pinById = {};
    for (var pi = 0; pi < mine.pins.length; pi++) mine.pinById[mine.pins[pi].id] = mine.pins[pi];
    // the cards taped to the glass only change with what's typed on them
    var ok = JSON.stringify(b.legend || []) + '|' + mine.figs.map(function (f) { return f.fig + ':' + f.label; }).join(';');
    if (ok !== overlayKey) { overlayKey = ok; overlayC = A.buildCabinetOverlay(b, mine.figs); overlayDim.key = null; }
    mine.overlay = overlayC;
    pinSpr = {};
    bakeHistory(mine.albedo.getContext('2d'), b);
    if (A.bakeMischief) { try { A.bakeMischief(mine.albedo.getContext('2d'), mine.fore.getContext('2d'), b); } catch (e) { if (root.console) console.warn('MOTHER LODE: bakeMischief', e); } }
    regionCells(b);
    galleryCells(mine.gals || []);
    return R;
  }

  /* ══ the crew's marks on the board (knockers, wave 3) ══════════════
   * Every pin the knockers have moved this visit leaves its old nail hole in
   * the rock (the board's history, from board.edits), and a tunnel mouth
   * they have shut is boarded over. Baked into the albedo at build. */
  function bakeHistory(g, b) {
    var hist = {};
    (b.edits || []).forEach(function (e) { if (e.type === 'nudge') (hist[e.id] = hist[e.id] || []).push(e); });
    // a pin carried a whole cell (the crew's 'move'): its old nail hole, and
    // a scuff of rock dust where it was worked out
    (b.edits || []).forEach(function (e) {
      if (e.type !== 'move' || !e.from) return;
      var f = b.byId && b.byId[e.id], hx = Math.round(e.from.x), hy = Math.round(e.from.y);
      if (f && Math.hypot(hx - f.x, hy - f.y) < 2.5) return;
      px(g, hx, hy, P.VOID0); px(g, hx + 1, hy, 'rgba(0,0,0,0.5)'); px(g, hx, hy + 1, 'rgba(0,0,0,0.35)'); px(g, hx - 1, hy - 1, 'rgba(255,244,224,0.22)');
      px(g, hx - 2, hy + 1, 'rgba(200,190,170,0.18)'); px(g, hx + 2, hy + 2, 'rgba(200,190,170,0.14)');
    });
    for (var id in hist) {
      var f = b.byId && b.byId[id]; if (!f || !f.home) continue;
      var h = f.home, x = h.x, y = h.y, spots = [[x, y]];
      hist[id].forEach(function (e) {
        x = Math.max(h.x - 3, Math.min(h.x + 3, x + e.dx)); y = Math.max(h.y - 3, Math.min(h.y + 3, y + e.dy));
        spots.push([x, y]);
      });
      var seen = {};
      for (var i = 0; i < spots.length - 1; i++) {
        var hx = Math.round(spots[i][0]), hy = Math.round(spots[i][1]), k = hx + ',' + hy;
        if (seen[k] || Math.hypot(hx - f.x, hy - f.y) < 2.5) continue;
        seen[k] = 1;
        px(g, hx, hy, P.VOID0); px(g, hx + 1, hy, 'rgba(0,0,0,0.5)'); px(g, hx - 1, hy - 1, 'rgba(255,244,224,0.22)');
      }
    }
    // shut adits: three boards nailed across the arch (the office door shows its own)
    (b.fixtures || []).forEach(function (t) {
      if (t.kind !== 'tunnel' || t.open !== false || t.dress === 'door') return;
      var ax = Math.round(t.a.x), ay = Math.round(t.a.y), r = Math.round(t.a.r || 6);
      [-3, 0, 3].forEach(function (dy, j) {
        A.thick(g, ax - r - 1, ay + dy + (j === 1 ? 1 : 0), ax + r, ay + dy - (j === 1 ? 0 : 1), 2, j === 1 ? P.TIM2 : P.TIM3);
        px(g, ax - r, ay + dy, P.IRON4); px(g, ax + r - 1, ay + dy - 1, P.IRON4);
      });
    });
  }
  // a pin's own sprite, lifted off the baked foreground (for a pin in hand)
  var pinSpr = {};
  R.pinSprite = function (id) {
    if (!mine || !board || !board.byId) return null;
    if (pinSpr[id] !== undefined) return pinSpr[id];
    var p = board.byId[id];
    if (!p || p.kind !== 'pin') return (pinSpr[id] = null);
    var c = A.makeCanvas(7, 7), g = c.getContext('2d');
    g.drawImage(mine.fore, Math.round(p.x) - 3, Math.round(p.y) - 3, 7, 7, 0, 0, 7, 7);
    return (pinSpr[id] = c);
  };
  // …or a spare of a dressing from elsewhere on the board
  R.pinSpriteByDress = function (dress) {
    if (!board || !board.byKind || !board.byKind.pin) return null;
    var ps = board.byKind.pin;
    for (var i = 0; i < ps.length; i++) if (ps[i].dress === dress && ps[i].region !== 'surface') return R.pinSprite(ps[i].id);
    for (i = 0; i < ps.length; i++) if (ps[i].dress === dress) return R.pinSprite(ps[i].id);
    return null;
  };

  /* ══ LIGHT ═════════════════════════════════════════════════════════
   * The grid: 2-px cells over the glass. Channels: light R, G, B (a
   * multiplier on albedo: 1 = the colour the model was painted), the dark
   * (0..1, how far into a blacked-out section) and the haze (warm light in
   * the smoke). Static per cell: the ambient's colour by depth, the case
   * light over the backdrop, the vignette at the case's edges. */
  var CELL = 2, NX = GW / CELL, NY = GH / CELL, NC = NX * NY;
  var LR = new Float32Array(NC), LG = new Float32Array(NC), LB = new Float32Array(NC);
  var LD = new Float32Array(NC), LH = new Float32Array(NC), TMP = new Float32Array(NC);
  var AMB = new Float32Array(NC * 3), CASE = new Float32Array(NC * 3), VIG = new Float32Array(NC);
  var REG = new Int8Array(NC), regIds = [], regDark = new Float32Array(32), GAL = new Float32Array(NC);
  var RR = new Float32Array(NX), RG = new Float32Array(NX), RB = new Float32Array(NX), RD = new Float32Array(NX), RH = new Float32Array(NX);
  var X0 = new Int16Array(GW), FX = new Float32Array(GW);
  var imL = null, imL2 = null, imH = null, imO = null, uL = null, uL2 = null, uH = null, uO = null;
  var BAY = new Float32Array(16);
  // the purple-black: brighter under the grass (the case light's spill),
  // darkening with depth. 0..1 of albedo
  var AMB_TOP = [0.09, 0.07, 0.15], AMB_BOT = [0.045, 0.036, 0.09];
  var FLOOR = [0.40, 0.38, 0.49];         // the least light a pin (or a label) ever gets
  var STEPS = 12;                          // light's posterisation (painted, not airbrushed)
  function initLight() {
    for (var i = 0; i < 16; i++) BAY[i] = S.BAYER[i] / 16 * 0.999;
    for (var x = 0; x < GW; x++) {
      var gx = (x + 0.5) / CELL - 0.5, x0 = Math.max(0, Math.min(NX - 2, Math.floor(gx)));
      X0[x] = x0; FX[x] = Math.max(0, Math.min(1, gx - x0));
    }
    for (var cy = 0; cy < NY; cy++) for (var cx = 0; cx < NX; cx++) {
      var c = cy * NX + cx, py = cy * CELL + 1, pxx = cx * CELL + 1;
      // ambient: none above the grass (the case light owns the sky)
      var u = Math.max(0, Math.min(1, (py - 64) / (384 - 64))), under = py >= 60 ? 1 : 0;
      for (var k = 0; k < 3; k++) AMB[c * 3 + k] = under * (AMB_TOP[k] + (AMB_BOT[k] - AMB_TOP[k]) * u);
      // the case light: a hidden tube behind the top rail lights the painted
      // backdrop evenly (museums light the painting, not the mine), and
      // spills a little way into the soil under the grass
      var ck = py < 58 ? 1 : Math.max(0, 1 - (py - 58) / 26);
      ck = ck * ck;
      CASE[c * 3] = 0.80 * ck; CASE[c * 3 + 1] = 0.76 * ck; CASE[c * 3 + 2] = 0.80 * ck;
      // the edges of the section fall away into the night
      var e = Math.min(pxx, GW - 1 - pxx), ek = py >= 64 ? Math.max(0, (14 - e) / 14) : Math.max(0, (6 - e) / 6) * 0.5;
      ek = Math.max(ek, Math.max(0, (py - 404) / 16));
      VIG[c] = 1 - 0.62 * Math.min(1, ek);
    }
    imL = lg.createImageData(GW, GH); imL2 = lg2.createImageData(GW, GH); imH = hg.createImageData(GW, GH); imO = ovg.createImageData(GW, GH);
    uL = new Uint32Array(imL.data.buffer); uL2 = new Uint32Array(imL2.data.buffer); uH = new Uint32Array(imH.data.buffer); uO = new Uint32Array(imO.data.buffer);
  }
  // which region each cell is in (for the dark), per layout
  function regionCells(b) {
    var rs = (b && b.regions) || [], key = JSON.stringify(rs);
    if (key === regKey) return;
    regKey = key;
    regIds = rs.map(function (r) { return r.id; });
    for (var cy = 0; cy < NY; cy++) for (var cx = 0; cx < NX; cx++) {
      var x = cx * CELL + 1, y = cy * CELL + 1, ri = -1;
      for (var i = 0; i < rs.length; i++) { var r = rs[i]; if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { ri = i; if (r.id !== 'headframe') break; } }
      REG[cy * NX + cx] = ri;
    }
  }

  // the galleries' insides (a lamp hung in a gallery fills it, and the rock
  // round it only takes the spill: the galleries are lit slots in the dark)
  var galKey = null;
  function galleryCells(gals) {
    var key = JSON.stringify(gals);
    if (key === galKey) return;
    galKey = key;
    GAL.fill(0);
    gals.forEach(function (G) {
      for (var cy = Math.max(0, Math.floor(G.top / CELL)); cy <= Math.min(NY - 1, Math.floor((G.y + 1) / CELL)); cy++)
        for (var cx = Math.max(0, Math.floor(G.x0 / CELL)); cx < Math.min(NX, Math.ceil(G.x1 / CELL)); cx++) GAL[cy * NX + cx] = 1;
    });
    boxBlur(GAL, TMP, 1);
  }
  // the lamps in play this frame: a pool of records, reused
  var LAMPS = [], nLamps = 0;
  function lampRec() {
    var L = LAMPS[nLamps];
    if (!L) L = LAMPS[nLamps] = { x: 0, y: 0, r: 0, ry: 1, k: 0, cr: 0, cg: 0, cb: 0, spot: false, haze: 0, dark: false };
    nLamps++;
    L.ry = 1; L.spot = false; L.haze = 0; L.dark = false; L.gal = false;
    return L;
  }
  var RGBC = {};
  function rgbOf(hex) {
    var c = RGBC[hex];
    if (!c) { var a = A.rgb(hex); c = RGBC[hex] = [a[0] / 255, a[1] / 255, a[2] / 255]; }
    return c;
  }
  function setColour(L, hex) { var c = rgbOf(hex); L.cr = c[0]; L.cg = c[1]; L.cb = c[2]; }
  function flickerOf(lamp, t) {
    var k = lamp.k == null ? 1 : lamp.k;
    if (lamp.kind === 'spot') return k;
    if (lamp.kind === 'bulb') {                     // company electric: steady, the odd brownout
      var b = A.hash01(lamp.seed, Math.floor(t * 3), 1);
      return k * (b < 0.03 ? 0.6 : 1);
    }
    var h = A.hash01(lamp.seed, Math.floor(t * 9), 2); // flame: breathes, gutters
    return k * (0.88 + h * 0.12);
  }
  var GALLERY = { haulage: 1, ventilation: 1, workings: 1 };
  var FL = {};                                   // a scratch lamp position (figureLamp's out)
  // the lode's moments, read off the part's own clock (fx.mis.lode.u)
  var LODE = { hush: 0, lift: 0, boost: 0, u: -1 };
  function lodeState(view) {
    var fx = view.fx || {}, mis = fx.mis, L = mis && mis.lode, MM = root.PachinkoMischief;
    LODE.hush = 0; LODE.lift = 0; LODE.boost = 0; LODE.u = -1;
    if (L && MM && MM.LODE) {
      var u = L.u, fl = MM.LODE.flare, a = u - fl;
      LODE.u = u;
      // the held breath: the whole mine goes down to the cup's glow
      if (u >= 0 && u < fl) LODE.hush = Math.min(1, u / 0.1);
      else if (a >= 0 && a < 0.06) LODE.hush = 1 - a / 0.06;
      // the flare: warm light floods the section, every pool doubles, and eases back
      if (a >= 0) {
        LODE.lift = a < 0.08 ? a / 0.08 : Math.max(0, 1 - (a - 0.08) / 2.2);
        LODE.boost = a < 0.4 ? 1 : Math.max(0, 1 - (a - 0.4) / 1.6);
      }
    } else if (fx.flare) LODE.lift = fx.flare * 0.7;
  }
  function gatherLamps(view) {
    var t = view.t || 0, fx = view.fx || {};
    var lights = fx.lights || {}, flare = fx.flare || 0, boost = 1 + LODE.boost;
    nLamps = 0;
    var ls = mine.lamps;
    for (var i = 0; i < ls.length; i++) {
      var M = ls[i], rk = lights[M.region] == null ? 1 : lights[M.region];
      if (rk <= 0) continue;
      var L = lampRec();
      L.x = M.x; L.y = M.y; setColour(L, M.c);
      if (M.kind === 'spot') { L.r = M.r; L.ry = M.ry || 1; L.spot = true; L.k = flickerOf(M, t) * Math.min(1.3, rk); }
      else {
        L.r = M.r * boost; L.k = flickerOf(M, t) * rk * (1 + flare * 0.35);
        if (GALLERY[M.region]) { L.ry = 0.62; L.gal = true; }
        L.haze = M.kind === 'bulb' ? 0.7 : 1;
      }
    }
    var figs = figuresFor(view), PBm = PB();
    for (i = 0; i < figs.length; i++) {
      var f = figs[i];
      if (f.lamp === false) continue;
      var fl = A.figureLamp(f, FL);
      if (PBm && lights[PBm.regionAt(fl.x, fl.y)] === 0) continue;
      var lk = f.lampK == null ? 1 : f.lampK;
      if (lk <= 0) continue;
      L = lampRec();
      L.x = fl.x; L.y = fl.y; L.r = 26 * (1 + LODE.boost * 0.5); setColour(L, P.LAMP);
      // (in the lode's held breath the crew's lamps sink to their flames too)
      var hk = 1 - 0.85 * LODE.hush;
      L.k = 0.85 * lk * hk * (0.85 + 0.15 * A.hash01(i + 5, Math.floor(t * 8), 3)); L.haze = 0.55; L.dark = true;
      if (fl.lantern) {
        L = lampRec();
        L.x = fl.lantern.x; L.y = fl.lantern.y; L.r = 46 * boost; setColour(L, P.LAMP); L.k = 1.0 * Math.max(lk, 0.5) * hk; L.haze = 1; L.dark = true;
      }
    }
    // the lode: the flare's light comes FROM the vein and floods up through
    // the mine; the company's bulbs strung along every gallery flare on with
    // it; once the ore is settled it keeps a little warm light of its own
    var MM = root.PachinkoMischief, mis = fx.mis;
    if (MM && MM.seamOf && mis && mis.crack && board) {
      var sm = MM.seamOf(board), o = sm && MM.crackOrigin(sm);
      if (o && LODE.lift > 0) {
        L = lampRec(); L.x = o.x; L.y = o.y; L.r = 150 + 70 * LODE.boost; L.ry = 0.9; setColour(L, '#ffcf6a'); L.k = 1.35 * LODE.lift; L.haze = 0.35;
      }
      if (sm && mis.crack.u > 3) for (var vx = sm.x1 + 10; vx < sm.x2; vx += 24) {
        L = lampRec(); L.x = vx; L.y = MM.seamY(sm, vx); L.r = 20; L.ry = 0.7; setColour(L, '#ffc860'); L.k = 0.6; L.dark = true;
      }
    }
    if (LODE.lift > 0.12 && mine.gals) for (var gi = 0; gi < mine.gals.length; gi++) {
      var G = mine.gals[gi];
      for (var bx = G.x0 + 10; bx < G.x1 - 4; bx += 22) { L = lampRec(); L.x = bx; L.y = G.top + 4; L.r = 18; setColour(L, '#ffe0a0'); L.k = 1.1 * LODE.lift; L.haze = 0.5; }
    }
    // a cave-in's work light, hung by the crew over the heap: the bay that's
    // shut reads as shut, for the rest of the game
    var cvs = (board && board.caveins) || [];
    for (i = 0; i < cvs.length; i++) {
      var cv = cvs[i], wl = caveLamp(cv);
      L = lampRec(); L.x = wl.x; L.y = wl.y + 2; L.r = 30; L.ry = 0.85; setColour(L, '#ffe0a0'); L.k = 1.05 * (0.92 + 0.08 * A.hash01(cvs.length + i, Math.floor(t * 3), 5)); L.haze = 0.8; L.dark = true;
    }
    // an open door in the rock is a warm lit slot (a knocker's lamp inside):
    // the thief's telegraph, and his light while he's out of it
    var pr = view.props || [];
    for (i = 0; i < pr.length; i++) {
      var q = pr[i];
      if (q.kind === 'door' && q.open === 2) { L = lampRec(); L.x = q.x; L.y = q.y - 5; L.r = 22; setColour(L, P.LAMP); L.k = 0.95; L.haze = 0.8; L.dark = true; }
    }
    for (i = 0; i < figs.length; i++) if (figs[i].hold && figs[i].lamp !== false) {
      // the thief with the marble in his hands: his lamp burns full
      var hf = A.figureLamp(figs[i], FL);
      L = lampRec(); L.x = hf.x; L.y = hf.y + 6; L.r = 26; setColour(L, P.LAMP); L.k = 0.7; L.dark = true;
    }
    var ex = fx.extraLamps || [];
    for (i = 0; i < ex.length; i++) {
      var e = ex[i]; if (!(e.k == null || e.k > 0)) continue;
      L = lampRec();
      // (the held breath hushes every light but the cup's glow and the fuse down in the deep)
      L.x = e.x; L.y = e.y; L.r = e.r || 30; L.k = (e.k == null ? 1 : e.k) * (e.y > 355 ? 1 : 1 - 0.8 * LODE.hush); setColour(L, e.c || P.LAMP);
      L.dark = true;                               // (an extra lamp in a dark section is snuffed with it)
    }
  }
  // the pool's falloff (shared by the drawn light and every CPU question):
  // a bright core round the flame, a broad body, a soft but definite edge
  function fall(d) {
    if (d >= 1) return 0;
    var a = 1 - d * d, c = d < 0.24 ? 1 - d / 0.24 : 0;
    return 0.82 * a * a + 0.6 * c * c;
  }
  // a museum pin spot: a crisp disc of cool light, the edge a hair soft
  function spotFall(d) { return d >= 1 ? 0 : d < 0.74 ? 1 : 1 - (d - 0.74) / 0.26; }
  var hushK = 0, anyDark = false;
  function computeLight(view) {
    var fx = view.fx || {}, t = view.t || 0;
    lodeState(view);
    gatherLamps(view);
    var hush = LODE.hush, ambK = 1 - 0.7 * hush, caseK = 1 - 0.65 * hush, lift = LODE.lift;
    hushK = hush;
    // ambient + case light (+ the flare's warm lift over everything)
    var wr = 0.26 * lift, wg = 0.19 * lift, wb = 0.11 * lift;
    for (var c = 0, c3 = 0; c < NC; c++, c3 += 3) {
      LR[c] = AMB[c3] * ambK + CASE[c3] * caseK + wr;
      LG[c] = AMB[c3 + 1] * ambK + CASE[c3 + 1] * caseK + wg;
      LB[c] = AMB[c3 + 2] * ambK + CASE[c3 + 2] * caseK + wb;
      LH[c] = 0;
    }
    // the dark: which cells are in a blacked-out section, then feathered
    // (two box blurs, ~10 px): a soft edge, and a union of regions has no seams
    var dark = fx.dark || {}, nd = 0;
    for (var i = 0; i < regIds.length; i++) { var v = dark[regIds[i]] || 0; regDark[i] = v > 1 ? 1 : v; if (v > 0) nd++; }
    anyDark = nd > 0;
    if (anyDark) {
      for (c = 0; c < NC; c++) { var ri = REG[c]; LD[c] = ri >= 0 ? regDark[ri] : 0; }
      boxBlur(LD, TMP, 3); boxBlur(LD, TMP, 3);
    }
    // the lamps (a lamp in a dark section is snuffed: the section's own
    // lamps come in with lights 0; an extra lamp there goes out with it)
    for (i = 0; i < nLamps; i++) {
      var L = LAMPS[i];
      var k = L.k;
      if (anyDark && L.dark) { var dk = sampleD(L.x, L.y); if (dk >= 0.85) continue; k *= 1 - dk; }
      if (k <= 0.01) continue;
      var rx = L.r, ry = L.r * L.ry, spot = L.spot;
      var c0 = Math.max(0, Math.floor((L.x - rx) / CELL)), c1 = Math.min(NX - 1, Math.ceil((L.x + rx) / CELL));
      var r0 = Math.max(0, Math.floor((L.y - ry) / CELL)), r1 = Math.min(NY - 1, Math.ceil((L.y + ry) / CELL));
      var irx = 1 / rx, iry = 1 / ry, kr = k * L.cr, kg = k * L.cg, kb = k * L.cb, gal = L.gal;
      var hz = L.haze * k, hr = rx * 0.42, ihr = 1 / Math.max(1, hr);
      for (var cy = r0; cy <= r1; cy++) {
        var dy = (cy * CELL + 1 - L.y) * iry, dy2 = dy * dy, row = cy * NX;
        var hdy = (cy * CELL + 1 - L.y) * ihr;
        for (var cx = c0; cx <= c1; cx++) {
          var dx = (cx * CELL + 1 - L.x) * irx, d2 = dx * dx + dy2;
          if (d2 >= 1) continue;
          // (fall/spotFall inlined: a double returned from a call is a heap allocation)
          var d = Math.sqrt(d2), ci = row + cx, f;
          if (spot) f = d < 0.74 ? 1 : 1 - (d - 0.74) * 3.846;
          else { var fa = 1 - d2, fc = d < 0.24 ? 1 - d * 4.1667 : 0; f = 0.82 * fa * fa + 0.6 * fc * fc; }
          if (gal) f *= 0.5 + 0.8 * GAL[ci];
          LR[ci] += kr * f; LG[ci] += kg * f; LB[ci] += kb * f;
          if (hz > 0) {
            var hdx = (cx * CELL + 1 - L.x) * ihr, h2 = hdx * hdx + hdy * hdy;
            if (h2 < 1) { var hh = 1 - h2; LH[ci] += hz * hh * hh; }
          }
        }
      }
    }
    // the dark takes the light away (the neighbours' lamps spill over its
    // soft edge a little), then the vignette
    if (anyDark) for (c = 0; c < NC; c++) {
      var dd = LD[c]; if (dd <= 0) continue;
      var keep = 1 - dd;
      LR[c] *= keep; LG[c] *= keep; LB[c] *= keep; LH[c] *= keep;
    }
    for (c = 0; c < NC; c++) { var vg = VIG[c]; LR[c] *= vg; LG[c] *= vg; LB[c] *= vg; }
    paintLightmaps();
  }
  function boxBlur(a, tmp, rad) {
    var inv = 1 / (rad * 2 + 1), x, y, s, row;
    for (y = 0; y < NY; y++) {
      row = y * NX; s = 0;
      for (x = -rad; x <= rad; x++) s += a[row + Math.max(0, Math.min(NX - 1, x))];
      for (x = 0; x < NX; x++) {
        tmp[row + x] = s * inv;
        s += a[row + Math.min(NX - 1, x + rad + 1)] - a[row + Math.max(0, x - rad)];
      }
    }
    for (x = 0; x < NX; x++) {
      s = 0;
      for (y = -rad; y <= rad; y++) s += tmp[Math.max(0, Math.min(NY - 1, y)) * NX + x];
      for (y = 0; y < NY; y++) {
        a[y * NX + x] = s * inv;
        s += tmp[Math.min(NY - 1, y + rad + 1) * NX + x] - tmp[Math.max(0, y - rad) * NX + x];
      }
    }
  }
  // one pass: the lightmap, the pin light (with its floor) and the haze
  var anyOver = false;
  function paintLightmaps() {
    anyOver = false;
    var fk = 1 - 0.5 * hushK, fr = FLOOR[0] * fk, fgc = FLOOR[1] * fk, fb = FLOOR[2] * fk;
    for (var y = 0; y < GH; y++) {
      var gy = (y + 0.5) / CELL - 0.5, y0 = gy < 0 ? 0 : Math.floor(gy);
      if (y0 > NY - 2) y0 = NY - 2;
      var fy = gy - y0; if (fy < 0) fy = 0; if (fy > 1) fy = 1;
      var a0 = y0 * NX, a1 = a0 + NX, gy1 = 1 - fy;
      for (var cx = 0; cx < NX; cx++) {
        RR[cx] = LR[a0 + cx] * gy1 + LR[a1 + cx] * fy;
        RG[cx] = LG[a0 + cx] * gy1 + LG[a1 + cx] * fy;
        RB[cx] = LB[a0 + cx] * gy1 + LB[a1 + cx] * fy;
        RH[cx] = LH[a0 + cx] * gy1 + LH[a1 + cx] * fy;
        RD[cx] = anyDark ? LD[a0 + cx] * gy1 + LD[a1 + cx] * fy : 0;
      }
      var brow = (y & 3) * 4, o = y * GW;
      for (var x = 0; x < GW; x++) {
        var i0 = X0[x], f = FX[x], f1 = 1 - f, b = BAY[brow + (x & 3)];
        var r = RR[i0] * f1 + RR[i0 + 1] * f, g = RG[i0] * f1 + RG[i0 + 1] * f, bl = RB[i0] * f1 + RB[i0 + 1] * f;
        var qr = Math.floor(r * STEPS + b) / STEPS, qg = Math.floor(g * STEPS + b) / STEPS, qb = Math.floor(bl * STEPS + b) / STEPS;
        // past 1, the lamp's core pushes the rock beyond the colour it was
        // painted (added back as albedo × the overflow): a pool has a hot heart
        if (qr > 1 || qg > 1 || qb > 1) {
          var or = qr > 1 ? Math.min(0.55, (qr - 1) * 0.8) : 0, og = qg > 1 ? Math.min(0.55, (qg - 1) * 0.8) : 0, ob = qb > 1 ? Math.min(0.55, (qb - 1) * 0.8) : 0;
          uO[o + x] = 0xff000000 | (((ob * 255) | 0) << 16) | (((og * 255) | 0) << 8) | ((or * 255) | 0);
          anyOver = true;
          if (qr > 1) qr = 1; if (qg > 1) qg = 1; if (qb > 1) qb = 1;
        } else uO[o + x] = 0xff000000;
        var ir = (qr * 255) | 0, ig = (qg * 255) | 0, ib = (qb * 255) | 0;
        uL[o + x] = 0xff000000 | (ib << 16) | (ig << 8) | ir;
        // the pins' light: never below the floor, unless the section is dark
        var keep = anyDark ? 1 - (RD[i0] * f1 + RD[i0 + 1] * f) : 1;
        var mr = fr * keep, mg = fgc * keep, mb = fb * keep;
        var pr = qr > mr ? ir : (mr * 255) | 0, pg = qg > mg ? ig : (mg * 255) | 0, pb = qb > mb ? ib : (mb * 255) | 0;
        uL2[o + x] = 0xff000000 | (pb << 16) | (pg << 8) | pr;
        // the haze: warm light hanging in the stale smoke round each flame
        var h = RH[i0] * f1 + RH[i0 + 1] * f;
        if (h > 0.02) {
          var q = Math.floor(Math.min(1, h) * 4 + b) * 0.25;
          if (q > 0) { var hv = q * 0.26; uH[o + x] = 0xff000000 | (((hv * 90) | 0) << 16) | (((hv * 170) | 0) << 8) | ((hv * 255) | 0); }
          else uH[o + x] = 0;
        } else uH[o + x] = 0;
      }
    }
    lg.putImageData(imL, 0, 0);
    lg2.putImageData(imL2, 0, 0);
    hg.putImageData(imH, 0, 0);
    if (anyOver) ovg.putImageData(imO, 0, 0);
  }
  function sampleGrid(arr, x, y) {
    var gx = x / CELL - 0.5, gy = y / CELL - 0.5;
    if (gx < 0) gx = 0; if (gy < 0) gy = 0; if (gx > NX - 1.001) gx = NX - 1.001; if (gy > NY - 1.001) gy = NY - 1.001;
    var x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, i = y0 * NX + x0;
    return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + NX] * (1 - fx) + arr[i + NX + 1] * fx) * fy;
  }
  function sampleD(x, y) { return anyDark ? sampleGrid(LD, x, y) : 0; }
  function lightAt(x, y) {
    if (x !== x || y !== y) return 0;
    return 0.3 * sampleGrid(LR, x, y) + 0.59 * sampleGrid(LG, x, y) + 0.11 * sampleGrid(LB, x, y);
  }
  R.lightAt = lightAt;
  R.darkAt = sampleD;
  A.darkAt = sampleD;
  // a figure's one flat colour of light (quantised, the strings cached)
  var TINTS = new Map();
  function tintAt(x, y) {
    var r = sampleGrid(LR, x, y), g = sampleGrid(LG, x, y), b = sampleGrid(LB, x, y);
    // a carved toy stands proud of the rock, toward the glass: it catches a
    // little more of the room than the rock behind it does
    r = r * 1.08 + 0.02; g = g * 1.08 + 0.018; b = b * 1.08 + 0.03;
    var qr = Math.min(16, Math.round(r * 16)), qg = Math.min(16, Math.round(g * 16)), qb = Math.min(16, Math.round(b * 16));
    var key = (qr * 17 + qg) * 17 + qb, s = TINTS.get(key);
    if (!s) { s = 'rgb(' + Math.min(255, qr * 16) + ',' + Math.min(255, qg * 16) + ',' + Math.min(255, qb * 16) + ')'; TINTS.set(key, s); }
    return s;
  }
  function PB() { return root.PachinkoBoard; }
  // where the crew hung the work light over a cave-in's heap (art-mischief draws its cage)
  var CL = { x: 0, y: 0 };
  function caveLamp(cv) { CL.x = Math.round(cv.cx); CL.y = Math.round(cv.top) - 8; return CL; }

  /* ══ live albedo: the moving parts ═════════════════════════════════ */
  function drawKinematics(g, view) {
    var t = view.t || 0, fs = (board && board.fixtures) || [], PBm = PB();
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      if (f.kind === 'wheel') A.drawWheel(g, f, PBm ? PBm.pose(f, t) : { angle: 0, segs: [] }, t);
      else if (f.kind === 'cart') A.drawCart(g, f, PBm ? PBm.pose(f, t) : null, t);
    }
  }

  /* ══ figures ═══════════════════════════════════════════════════════ */
  // the knockers phase fills view.figures; until then (and whenever the
  // list is absent) the still-life crew stands in, posed mid-job
  function figuresFor(view) {
    if (view.figures && view.figures.length) return view.figures;
    if (view.fx && view.fx.noStillLife) return [];
    return mine.stillLife || [];
  }
  var CH = { x: 0, y: 0 };
  function drawFigures(g, figs) {
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i], ch = A.figureChest(f, CH);
      A.drawFigureBody(g, f, tintAt(ch.x, ch.y));
    }
  }

  /* ══ emissive ══════════════════════════════════════════════════════ */
  function drawEmissive(g, view) {
    var t = view.t || 0, fx = view.fx || {}, lights = fx.lights || {}, dark = fx.dark || {};
    function lit(region) { return (lights[region] == null || lights[region] > 0) && !(dark[region] >= 1); }
    // the case light's tube, glimpsed through the louvre under the valance
    var tubeC = hushK > 0.5 ? '#6a6658' : '#f4ecd0';
    for (var tx = 2; tx < GW - 2; tx++) px(sg, tx, 11, (tx % 6 === 0) ? '#8a8672' : tubeC);
    // painted lights on the backdrop (the train's windows, the town)
    for (var i = 0; i < mine.emissive.length; i++) {
      var e = mine.emissive[i];
      if (e.blink && A.hash01(i, Math.floor(t * 0.5), 9) < 0.2) continue;
      rect(g, e.x, e.y, e.w, e.h, e.c);
    }
    // lamp flames
    for (i = 0; i < mine.lamps.length; i++) {
      var L = mine.lamps[i];
      if (!lit(L.region) || !L.flame) continue;
      if (anyDark && sampleD(L.fx, L.fy) >= 0.85) continue;
      var h = A.hash01(L.seed, Math.floor(t * 9), 4);
      if (L.kind === 'bulb') { px(g, L.fx, L.fy, P.FLAME2); px(g, L.fx, L.fy + 1, P.FLAME1); px(g, L.fx - 1, L.fy, 'rgba(255,224,160,0.55)'); px(g, L.fx + 1, L.fy, 'rgba(255,224,160,0.55)'); }
      else { px(g, L.fx, L.fy, P.FLAME2); px(g, L.fx, L.fy - 1, h < 0.5 ? P.FLAME1 : P.FLAME0); if (h > 0.8) px(g, L.fx + 1, L.fy - 1, P.FLAME0); }
    }
    // what the crew changed last shift: a chalk ring round each (drawn by a
    // hand in a hurry, not quite closed), and for a pin carried a cell, a
    // dotted chalk line from where it was
    var alts = fx.alterations || [];
    for (i = 0; i < alts.length; i++) {
      var al = alts[i], ak = Math.min(1, al.k == null ? 1 : al.k); if (ak <= 0.05) continue;
      if (anyDark && sampleD(al.x, al.y) >= 0.85) continue;
      var ax = Math.round(al.x), ay = Math.round(al.y), seed = (ax * 31 + ay) | 0, rr = al.type === 'pocket' || al.type === 'chute' ? 9 : 6;
      var chalk = CHALK[Math.min(3, Math.floor(ak * 3.99))];
      for (var ai = 0; ai < 22; ai++) {
        if (ai > 19) continue;                                     // the gap where the chalk lifted
        var an = (ai / 22) * Math.PI * 2 + seed, wob = (A.hash01(seed, ai, 3) - 0.5) * 1.2;
        px(g, Math.round(ax + Math.cos(an) * (rr + wob)), Math.round(ay + Math.sin(an) * (rr * 0.85 + wob)), chalk);
      }
      if (al.from) {
        var fx0 = al.from.x, fy0 = al.from.y, dl = Math.hypot(ax - fx0, ay - fy0);
        for (var dd = 0; dd < dl - rr; dd += 2) { var u2 = dd / dl; px(g, Math.round(fx0 + (ax - fx0) * u2), Math.round(fy0 + (ay - fy0) * u2), chalk); }
      }
    }
    // the drift's legend marker (5) lights as a marble goes in and again as it comes out
    var trs = fx.transits || [];
    for (i = 0; i < trs.length; i++) {
      var mk2 = mine.markers && mine.markers[trs[i].id]; if (!mk2) continue;
      if (anyDark && sampleD(mk2.x + mk2.w / 2, mk2.y + 3) >= 0.5) continue;
      var lit2 = trs[i].u < 0.18 || (trs[i].exitIn != null && trs[i].exitIn < 0.5);
      if (lit2) { rect(g, mk2.x - 1, mk2.y - 1, mk2.w + 2, mk2.h + 2, P.GOLD3); rect(g, mk2.x, mk2.y, mk2.w, mk2.h, '#2a1a08'); A.text(g, String(mk2.n), mk2.x + 2, mk2.y + 1, '#fff4c8'); }
    }
    // a cave-in's work light
    var cvs = (board && board.caveins) || [];
    for (i = 0; i < cvs.length; i++) { var wl = caveLamp(cvs[i]); if (!(anyDark && sampleD(wl.x, wl.y) >= 0.85)) { px(g, wl.x, wl.y + 1, P.FLAME2); px(g, wl.x, wl.y + 2, P.FLAME1); } }
    // at the lode, the bulbs strung along every gallery are lit
    if (LODE.lift > 0.12 && mine.gals) for (var gi = 0; gi < mine.gals.length; gi++) {
      var G = mine.gals[gi];
      for (var bx = G.x0 + 10; bx < G.x1 - 4; bx += 22) { px(g, bx, G.top + 3, P.FLAME2); px(g, bx, G.top + 4, LODE.lift > 0.5 ? '#ffffff' : P.FLAME1); px(g, bx, G.top + 2, P.IRON2); }
    }
    // figurines' candles
    var figs = figuresFor(view);
    for (i = 0; i < figs.length; i++) {
      if (figs[i].lamp === false) continue;
      var fl = A.figureLamp(figs[i], FL), fh = A.hash01(i, Math.floor(t * 8), 6), ff = figs[i].facing < 0 ? -1 : 1;
      // lamps out: every light in the section goes, their caps too
      if (anyDark && sampleD(fl.x, fl.y) >= 0.85) continue;
      var flx = Math.round(fl.x), fly = Math.round(fl.y);
      if (fl.back) { px(g, flx, fly, 'rgba(255,208,96,0.85)'); px(g, flx - 1, fly + 1, 'rgba(255,138,42,0.5)'); px(g, flx + 1, fly + 1, 'rgba(255,138,42,0.5)'); continue; }
      if (figs[i].lampK != null && figs[i].lampK < 0.35) { px(g, flx, fly, fh < 0.5 ? P.FLAME0 : '#b0561e'); continue; }
      px(g, flx, fly, P.FLAME2);
      px(g, flx + ff, fly - 1, fh < 0.6 ? P.FLAME1 : P.FLAME0);
      if (fh > 0.85) px(g, flx + ff * 2, fly - 1, P.FLAME0);
      if (fl.lantern) { rect(g, Math.round(fl.lantern.x - 1), Math.round(fl.lantern.y - 3), 3, 3, P.FLAME1); px(g, Math.round(fl.lantern.x), Math.round(fl.lantern.y - 2), P.FLAME2); }
    }
    // coal glints: only where there is light to catch; one pixel, never a
    // stock four-point star (those are saved for a hit spark)
    for (i = 0; i < mine.glints.length; i++) {
      var gp = mine.glints[i], L2 = lightAt(gp.x, gp.y);
      if (L2 < 0.3) continue;
      if (anyDark && sampleD(gp.x, gp.y) >= 0.85) continue;
      var tw = Math.sin(t * gp.rate + gp.ph);
      if (tw > 0.93) px(g, gp.x, gp.y, L2 > 0.62 && tw > 0.98 ? (gp.gold ? P.GOLD5 : P.GLINT) : gp.c);
      else if (tw > 0.7 && L2 > 0.55) px(g, gp.x, gp.y, gp.gold ? P.VEIN2 : P.GLINT_D);
    }
    // a pin that was just hit sparks (unless its section is blacked out)
    var hits = view.hits || [];
    for (var hi = 0; hi < hits.length; hi++) {
      var hh = hits[hi], k = 1 - ((t - hh.t) / 0.25);
      if (!(k > 0)) continue;
      var p = mine.pinById[hh.id]; if (!p) continue;
      if (dark[p.region] >= 1 || (anyDark && sampleD(p.x, p.y) >= 0.85)) continue;
      px(g, p.hx, p.hy, '#ffffff'); px(g, p.hx + 1, p.hy, P.FLAME2);
      if (k > 0.5) { px(g, p.hx - 1, p.hy - 1, P.GLINT); px(g, p.hx + 2, p.hy - 1, P.GLINT); }
    }
    // the pocket watch, still going: its minute hand, one pixel, turning
    if (mine.watch && !(anyDark && sampleD(mine.watch.x, mine.watch.y) >= 0.85)) {
      var w = mine.watch, a = (t / 60) * Math.PI * 2 - Math.PI / 2 + w.a0;
      var ex = Math.round(w.x + Math.cos(a) * 2), ey = Math.round(w.y + Math.sin(a) * 2);
      px(g, ex, ey, P.INK); px(g, w.x, w.y, P.INK);
    }
    // the wedding ring catches the light now and then
    if (mine.ring && lightAt(mine.ring.x, mine.ring.y) > 0.3 && Math.sin(t * 0.9) > 0.97) px(g, mine.ring.x - 1, mine.ring.y - 1, '#ffffff');
    // a moth at the ventilation road's lantern, never quite getting there
    var moth = fx.moth || mine.moth;
    if (moth && lit(moth.region || mine.moth.region) && !(anyDark && sampleD(moth.x, moth.y) >= 0.85)) {
      var mk = Math.floor(t * 12), ma = mk * 0.9 + Math.sin(mk * 0.37) * 1.7, mr = 4 + A.hash01(9, mk >> 2, 0) * 5;
      var mx = Math.round(moth.x + Math.cos(ma) * mr), my = Math.round(moth.y + Math.sin(ma) * mr * 0.6);
      var up = mk % 2;
      px(g, mx, my, P.MOTH_D); px(g, mx - 1, my - up, P.MOTH); px(g, mx + 1, my - up, P.MOTH);
    }
    // and a rat's tail in the crack by the door, twitching; now and then it isn't there
    if (mine.rat && lightAt(mine.rat.x, mine.rat.y) > 0.12) {
      var rk = Math.floor(t * 3), gone = A.hash01(21, Math.floor(t / 7), 0) < 0.3;
      if (!gone) {
        var tw2 = A.hash01(22, rk, 0) < 0.25 ? 1 : 0, rx = mine.rat.x, ry = mine.rat.y;
        px(g, rx, ry, P.RAT); px(g, rx - 1, ry, P.RAT); px(g, rx - 2, ry + tw2, P.RAT); px(g, rx - 3, ry + tw2, P.RAT_D || '#8a6a6a'); px(g, rx - 4, ry + 1, '#8a6a6a');
      }
    }
  }

  /* ══ the marble ════════════════════════════════════════════════════ */
  var CHALK = ['rgba(244,236,208,0.25)', 'rgba(244,236,208,0.45)', 'rgba(244,236,208,0.65)', 'rgba(244,236,208,0.85)'];
  var SWIRLS = [[P.PINK, P.PINK_D], [P.GOLD3, P.GOLD1], ['#4ad0a0', '#1e7058'], ['#5a8aff', '#2a3a9a'], ['#ff7040', '#8a2a10']];
  var discMask = {};
  function maskFor(r) {
    if (discMask[r]) return discMask[r];
    var c = A.makeCanvas(13, 13), g = c.getContext('2d');
    disc(g, 6.5, 6.5, r + 0.3, '#fff');
    return (discMask[r] = c);
  }
  // opts: dim (0..1, the kept marble's dusty glass), still (no caustic)
  function drawMarble(g, m, t, opts) {
    var r = Math.max(3, Math.min(5, Math.round(m.r || 4)));
    var cx = Math.round(m.x), cy = Math.round(m.y);
    var Lm = lightAt(cx, cy);
    // a shadow on the rock behind (the marble rides the glass, a little proud)…
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++)
      if (x * x + y * y <= r * r && bayer(cx + x + 2, cy + y + 3) < 0.55) px(g, cx + x + 2, cy + y + 3, 'rgba(4,3,8,0.55)');
    // …and in the middle of its shadow, the lamplight it focuses: a glass
    // ball's caustic, a hot point on the rock, only when it's in the light
    if (!(opts && opts.still) && Lm > 0.34) {
      var ck = Math.min(1, (Lm - 0.34) / 0.4);
      px(g, cx + 2, cy + 3, 'rgba(255,226,150,' + (0.35 + 0.55 * ck).toFixed(2) + ')');
      if (ck > 0.5) { px(g, cx + 3, cy + 3, 'rgba(255,200,110,0.45)'); px(g, cx + 2, cy + 4, 'rgba(255,200,110,0.35)'); }
    }
    // the inverted mine: sample the lit scene around it, flip, shrink
    mcg.clearRect(0, 0, 13, 13);
    mcg.globalCompositeOperation = 'source-over';
    mcg.imageSmoothingEnabled = false;
    mcg.save(); mcg.translate(13, 13); mcg.scale(-1, -1);
    var sr = r * 3;
    mcg.drawImage(scene, cx - sr, cy - sr, sr * 2, sr * 2, 6.5 - r - 0.5, 6.5 - r - 0.5, r * 2 + 1, r * 2 + 1);
    mcg.restore();
    // glass: gathers light, cools it; cut to the disc inside the rim. It
    // catches more where the lamps are (a marble in a pool is a bright thing)
    mcg.globalCompositeOperation = 'lighter';
    var gl = Lm > 0.5 ? 'rgb(96,124,142)' : 'rgb(80,108,128)';
    if (opts && opts.dim) gl = 'rgb(46,62,74)';
    mcg.fillStyle = gl; mcg.fillRect(0, 0, 13, 13);
    mcg.globalCompositeOperation = 'destination-in';
    mcg.drawImage(maskFor(r), 0, 0);
    mcg.globalCompositeOperation = 'source-over';
    // the cat's-eye vane, turned by spin: a twisted petal of colour
    var sw = SWIRLS[Math.abs(m.id | 0) % SWIRLS.length], sp = m.spin || 0, ca = Math.cos(sp), sa = Math.sin(sp);
    for (var u = -1; u <= 1.001; u += 0.125) {
      var lx = u * (r - 1.1), ly = Math.sin(u * Math.PI) * 1.2;
      var X = 6.5 + lx * ca - ly * sa, Y = 6.5 + lx * sa + ly * ca;
      px(mcg, Math.floor(X), Math.floor(Y), Math.abs(u) < 0.55 ? sw[0] : sw[1]);
    }
    // the rim: a dark edge all round (it must read against any rock), the
    // top-left edge catching the light, an inner ring shaded like a lens
    var dim = opts && opts.dim;
    for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) {
      var d = Math.sqrt(xx * xx + yy * yy);
      if (d > r + 0.35) continue;
      var lit = -(xx + yy) / (d || 1);                     // +1 toward the top-left
      if (d > r - 0.65) px(mcg, 6 + xx, 6 + yy, lit > 0.55 ? (dim ? '#8a9aa8' : '#d8ecf8') : lit > -0.2 ? '#44607a' : '#0a0e16');
      else if (d > r - 1.65) { if (lit > 0.5) px(mcg, 6 + xx, 6 + yy, dim ? '#6a8294' : '#9ec4dc'); else if (lit < -0.5) px(mcg, 6 + xx, 6 + yy, '#26384a'); }
    }
    // the specular: a bright window-shaped glint, and the lamplight
    // focused through the glass onto the far side
    var o = -Math.ceil(r / 2);
    px(mcg, 6 + o, 6 + o, '#ffffff'); px(mcg, 7 + o, 6 + o, dim ? '#c8d4dc' : '#ffffff'); px(mcg, 6 + o, 7 + o, '#eaf6ff');
    if (!dim) { px(mcg, 6 - o, 6 - o + (r > 3 ? 0 : -1), Lm > 0.3 ? P.FLAME1 : '#b89a60'); px(mcg, 5 - o, 6 - o, 'rgba(255,208,96,0.6)'); }
    g.drawImage(mc, cx - 6, cy - 6);
  }
  R.drawMarble = function (g, m, t, opts) { drawMarble(g, m, t, opts); };
  A.drawMarble = R.drawMarble;
  // a marble's trail: where the glass was a moment ago, a few dithered
  // pixels of cool light that fall away (only where it moved fast)
  function drawTrail(g, m) {
    var tr = m.trail, n = tr.length / 2;
    if (n < 2) return;
    for (var i = 0; i < n - 1; i++) {
      var x = tr[i * 2], y = tr[i * 2 + 1], x2 = tr[i * 2 + 2], y2 = tr[i * 2 + 3];
      var dx = x2 - x, dy = y2 - y;
      if (dx * dx + dy * dy < 9) continue;
      var k = (i + 1) / n;                                   // older → fainter
      var X = Math.round(x), Y = Math.round(y), rr = (m.r || 4) + 1;
      if ((X - m.x) * (X - m.x) + (Y - m.y) * (Y - m.y) < rr * rr) continue;
      if (bayer(X, Y) < 0.35 + k * 0.4) px(g, X, Y, TRAIL[Math.min(9, Math.floor(k * 9.99))]);
    }
  }
  var TRAIL = []; for (var ti = 0; ti < 10; ti++) TRAIL.push('rgba(190,220,255,' + (0.12 + (ti + 0.5) / 10 * 0.28).toFixed(2) + ')');
  // a marble in a tunnel: a light moving behind the rock along the tunnel's
  // own route (the old drift is the way to the 13: you have to be able to
  // follow it). As it goes, the drift's timber sets show one after another
  // in its light and go dark again behind it
  var SETS = {};
  function setsOf(path) {
    var key = path.map(function (p) { return p[0] + ',' + p[1]; }).join(';');
    if (SETS[key]) return SETS[key];
    var segs = [], L = 0;
    for (var i = 1; i < path.length; i++) { var d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(d); L += d; }
    var out = { L: L, sets: [] };
    for (var s0 = 10; s0 < L - 6; s0 += 15) {
      var a = s0;
      for (i = 0; i < segs.length; i++) { if (a <= segs[i]) break; a -= segs[i]; }
      i = Math.min(i, segs.length - 1);
      var q = segs[i] ? a / segs[i] : 0, x = path[i][0] + (path[i + 1][0] - path[i][0]) * q, y = path[i][1] + (path[i + 1][1] - path[i][1]) * q;
      var tx = (path[i + 1][0] - path[i][0]) / (segs[i] || 1), ty = (path[i + 1][1] - path[i][1]) / (segs[i] || 1);
      out.sets.push({ s: s0, x: x, y: y, nx: -ty, ny: tx });
    }
    return (SETS[key] = out);
  }
  function drawTunnelLight(g, m, t) {
    var tu = m.tunnel; if (!tu) return;
    var x, y;
    if (tu.x != null) { x = tu.x; y = tu.y; } else if (tu.from && tu.to) { var k0 = tu.k; x = tu.from.x + (tu.to.x - tu.from.x) * k0; y = tu.from.y + (tu.to.y - tu.from.y) * k0 + Math.sin(k0 * Math.PI) * 10; } else return;
    if (tu.path && tu.path.length > 1) {
      var S0 = setsOf(tu.path), head = (tu.k || 0) * S0.L;
      for (var i = 0; i < S0.sets.length; i++) {
        var st = S0.sets[i], d = head - st.s, b = d >= 0 ? 1 - d / 34 : 1 + d / 10;
        if (b <= 0.05) continue;
        // a timber set: two posts and a cap, square to the drift
        var cx = st.x, cy = st.y, nx = st.nx, ny = st.ny, col = b > 0.66 ? P.TIM4 : b > 0.33 ? P.TIM3 : P.TIM2;
        for (var j = -4; j <= 4; j++) px(g, Math.round(cx + nx * j), Math.round(cy + ny * j), j === -4 || j === 4 ? col : (b > 0.5 && Math.abs(j) < 3 ? 'rgba(255,200,120,' + (0.35 * b).toFixed(2) + ')' : null) || col);
        px(g, Math.round(cx + nx * -4 - ny), Math.round(cy + ny * -4 + nx), P.TIM1); px(g, Math.round(cx + nx * 4 - ny), Math.round(cy + ny * 4 + nx), P.TIM1);
      }
    }
    var X = Math.round(x), Y = Math.round(y);
    for (var jj = -3; jj <= 3; jj++) for (var ii = -3; ii <= 3; ii++) {
      var dd = (ii * ii + jj * jj) / 10;
      if (dd < 1 && bayer(X + ii, Y + jj) < (1 - dd) * 0.8) px(g, X + ii, Y + jj, dd < 0.3 ? 'rgba(236,244,255,0.8)' : 'rgba(180,210,255,0.45)');
    }
    px(g, X, Y, '#ffffff');
  }

  /* ══ the hopper: an aerial-tram bucket on the rail across the top ═══ */
  function drawHopper(g, view) {
    var hp = view.hopper || {}, t = view.t || 0;
    // the rail
    hline(g, 0, GW - 1, 1, P.BRASS3); hline(g, 0, GW - 1, 2, P.BRASS1); hline(g, 0, GW - 1, 0, P.BRASS0);
    for (var x = 20; x < GW; x += 70) { rect(g, x, 0, 2, 4, P.BRASS1); px(g, x, 0, P.BRASS3); }
    // a queued drop: a chalk tick on the rail where the bucket goes next
    if (hp.queued != null) { var qx = Math.round(hp.queued); px(g, qx, 3, '#f4ecd0'); px(g, qx - 1, 4, 'rgba(244,236,208,0.6)'); px(g, qx + 1, 4, 'rgba(244,236,208,0.6)'); }
    if (hp.ghostX != null && Math.abs(hp.ghostX - (hp.x || 0)) > 2) bucket(g, Math.round(hp.ghostX), true, false);
    if (hp.x != null) {
      var loaded = hp.loaded != null ? hp.loaded : (view.marblesLeft == null || view.marblesLeft > 0);
      // an empty bucket clicked: it rattles on the rail
      var rt = hp.rattle != null ? t - hp.rattle : 9, jig = rt < 0.25 ? (Math.floor(rt * 40) % 2 ? 1 : -1) : 0;
      // gliding, the skip swings back against the motion; the trolley's wheels turn
      var lean = hp.speed ? Math.max(-1, Math.min(1, Math.round(-hp.speed / 350))) : 0;
      bucket(g, Math.round(hp.x) + jig, false, loaded, lean);
    }
  }
  function bucket(g, x, ghost, loaded, lean) {
    if (ghost) {
      // the ghost: where the bucket would go, drawn in chalk on the glass,
      // and a dotted chalk line down through the painted sky to the ground
      var cg = 'rgba(244,236,208,0.85)';
      hline(g, x - 6, x + 6, 4, cg);
      for (var j = 5; j <= 10; j++) { var hw = 6 - Math.floor((j - 4) * 0.7); px(g, x - hw, j, cg); px(g, x + hw, j, cg); }
      hline(g, x - 1, x + 1, 11, cg); px(g, x, 12, cg);
      for (var y = 15; y < 64; y += 3) px(g, x, y, 'rgba(244,236,208,' + (0.7 - (y - 15) / 49 * 0.45).toFixed(2) + ')');
      return;
    }
    // trolley: two wheels on the rail (a spoke pixel that turns with x), a yoke
    rect(g, x - 5, 0, 3, 2, P.IRON3); rect(g, x + 3, 0, 3, 2, P.IRON3);
    var sp = ((x % 3) + 3) % 3;
    px(g, x - 5 + sp, 0, P.IRON4); px(g, x + 3 + sp, 0, P.IRON4); px(g, x - 5 + (sp + 1) % 3, 1, P.IRON1); px(g, x + 3 + (sp + 1) % 3, 1, P.IRON1);
    hline(g, x - 4, x + 4, 2, P.IRON2); vline(g, x, 2, 3, P.IRON3);
    // the bucket: a riveted tin skip, tapering to a spout (the lower half
    // swings a pixel back when the trolley runs)
    lean = lean || 0;
    for (var j2 = 0; j2 < 7; j2++) {
      var hw2 = 6 - Math.floor(j2 * 0.7), o = j2 >= 4 ? lean : 0;
      hline(g, x - hw2 + o, x + hw2 + o, 4 + j2, j2 === 0 ? '#d8d8e8' : (j2 % 3 === 2 ? P.IRON3 : P.IRON4));
      px(g, x - hw2 + o, 4 + j2, '#e8e8f4'); px(g, x + hw2 + o, 4 + j2, P.IRON1); px(g, x + hw2 - 1 + o, 4 + j2, P.IRON2);
    }
    px(g, x - 3, 6, P.IRON1); px(g, x + 3, 6, P.IRON1); px(g, x - 2 + lean, 9, P.IRON1); px(g, x + 2 + lean, 9, P.IRON1); // rivets
    rect(g, x - 1 + lean, 11, 3, 2, P.IRON2); px(g, x + 1 + lean, 12, P.IRON0); px(g, x - 1 + lean, 11, P.IRON4);  // spout
    if (loaded) {
      // the next marble, sitting in the skip: a glass cap showing over the rim
      px(g, x - 2, 3, '#9fc0d4'); px(g, x - 1, 3, '#dff0fa'); px(g, x, 3, '#9fc0d4'); px(g, x + 1, 3, '#6d8ea8');
      px(g, x - 1, 2, '#6d8ea8'); px(g, x, 2, '#b8d8ea');
    } else {
      // empty: the dark of the skip's mouth
      hline(g, x - 4, x + 4, 4, P.IRON1); hline(g, x - 3, x + 3, 5, P.IRON0);
    }
  }

  /* ══ the legend card, lit from behind ══════════════════════════════ */
  var cardGlow = {};
  function drawCardLamp(ctx, cl, t) {
    var L = C.legend; if (!L) return;
    var k = Math.max(0, Math.min(1, cl.k == null ? 1 : cl.k)), lx = Math.round(cl.x + C.GX), ly = Math.round(cl.y + C.GY);
    ctx.save();
    ctx.beginPath(); ctx.rect(L.x + 1, L.y + 1, L.w - 2, L.h - 2); ctx.clip();
    // the paper takes the light: a warm, posterised pool (screen)
    var r = cl.r || 34, lvl = Math.round(k * 10) / 10, key = r + ':' + lvl;
    var pool0 = cardGlow[key];
    if (!pool0) {
      var n = r * 2 + 1; pool0 = cardGlow[key] = A.makeCanvas(n, n);
      var pg = pool0.getContext('2d'), im = pg.createImageData(n, n), dd = im.data;
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) {
        var dist = Math.hypot(xx - r, yy - r) / r; if (dist >= 1) continue;
        var q = Math.floor(Math.pow(1 - dist, 1.3) * lvl * 5 + bayer(xx, yy) * 0.999) / 5; if (q <= 0) continue;
        var o = (yy * n + xx) * 4; dd[o] = 255 * q; dd[o + 1] = 170 * q; dd[o + 2] = 70 * q; dd[o + 3] = 255;
      }
      pg.putImageData(im, 0, 0);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(pool0, lx - r, ly - r);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // his shadow on the paper: one crisp warm-dark shape, no ink line
    if (cl.fig && A.figureSilhouette) {
      var sil = A.figureSilhouette(cl.fig, true), fx0 = Math.round(cl.fig.x + C.GX) - 36, fy0 = Math.round(cl.fig.y + C.GY) - 54;
      ctx.globalAlpha = 0.58 * k; ctx.drawImage(sil, fx0, fy0);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ══ the paper outside the glass, in the room's light ══════════════
   * The cards and the sticker are taped to the OUTSIDE of the glass: the
   * room lights them, not the mine. As the camera dives, the house lights go
   * down (warm grey, nicotine), so in PLAY the lit mine is the show and the
   * marbles the brightest moving things; the lode's flare lights the room. */
  var overlayDim = { key: null, c: null, g: null };
  function paperLight(view) {
    var k = view.cam && view.cam.k != null ? view.cam.k : 0, fl = (view.fx && view.fx.flare) || 0;
    var v = 0.78 - 0.18 * k;
    v = Math.min(1, v + 0.3 * fl * k);
    return Math.round(v * 20) / 20;
  }
  R.paperLight = paperLight;
  function dimmedOverlay(level) {
    if (level >= 0.999) return mine.overlay;
    if (overlayDim.key === level && overlayDim.c) return overlayDim.c;
    if (!overlayDim.c) { overlayDim.c = A.makeCanvas(C.W, C.H); overlayDim.g = overlayDim.c.getContext('2d'); }
    var g = overlayDim.g;
    g.globalCompositeOperation = 'copy'; g.drawImage(mine.overlay, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(' + Math.round(255 * level) + ',' + Math.round(242 * level) + ',' + Math.round(226 * level) + ')';
    g.fillRect(0, 0, C.W, C.H);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(mine.overlay, 0, 0);
    g.globalCompositeOperation = 'source-over';
    overlayDim.key = level;
    return overlayDim.c;
  }

  /* ══ draw ══════════════════════════════════════════════════════════ */
  function draw(ctx, view) {
    if (!mine) build(view.board || board);
    else if (view.board && view.board !== board) build(view.board);
    var t = view.t || 0;
    // 0. the light, first: every later decision asks it
    computeLight(view);
    ctx.drawImage(cabStatic, 0, 0);
    A.drawCabinetLive(ctx, view);

    // a. albedo
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(mine.albedo, 0, 0);
    drawKinematics(sg, view);
    // the knockers' kit: ladders, rope ladders, their doors…
    if (A.drawProps) A.drawProps(sg, view, 'back');
    var figs = figuresFor(view), i;
    // …and the figures' shadows on the rock (the toys themselves come after the light)
    for (i = 0; i < figs.length; i++) A.drawFigureShadow(sg, figs[i]);
    mischief(sg, view, 'albedo');
    // b. × light (+ the over-exposed hearts of the pools), + the haze
    if (anyOver) {
      htg.globalCompositeOperation = 'copy'; htg.drawImage(scene, 0, 0);
      htg.globalCompositeOperation = 'multiply'; htg.drawImage(overC, 0, 0);
      htg.globalCompositeOperation = 'source-over';
    }
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(lightC, 0, 0);
    sg.globalCompositeOperation = 'lighter';
    if (anyOver) sg.drawImage(hotC, 0, 0);
    sg.drawImage(hazeC, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    // the lode's fracture opens in the lit rock (under the toys and the pins:
    // a pin is never drawn anywhere but where it is)
    mischief(sg, view, 'crack');
    // c. the figures, each lit whole by the light at his chest
    drawFigures(sg, figs);
    // d. the foreground (pins, markers, bay boards, what's in their hands),
    // lit never below its floor
    fcg.globalCompositeOperation = 'copy';
    fcg.drawImage(mine.fore, 0, 0);
    // a pin the knockers have pulled is out of the rock: its nail hole shows
    var lifted = view.fx && view.fx.lifted, lid;
    if (lifted) {
      fcg.globalCompositeOperation = 'destination-out';
      for (lid in lifted) { var lp = board.byId && board.byId[lid], ls = lp && R.pinSprite(lid); if (ls) fcg.drawImage(ls, Math.round(lp.x) - 3, Math.round(lp.y) - 3); }
    }
    fcg.globalCompositeOperation = 'source-over';
    if (A.drawProps) A.drawProps(fcg, view, 'front');
    mkg.globalCompositeOperation = 'copy'; mkg.drawImage(foreC, 0, 0);
    fcg.globalCompositeOperation = 'multiply';
    fcg.drawImage(light2C, 0, 0);
    fcg.globalCompositeOperation = 'destination-in';
    fcg.drawImage(maskC, 0, 0);
    fcg.globalCompositeOperation = 'source-over';
    sg.drawImage(foreC, 0, 0);
    if (lifted) for (lid in lifted) {
      var hp = board.byId && board.byId[lid]; if (!hp) continue;
      px(sg, Math.round(hp.x), Math.round(hp.y), P.VOID0); px(sg, Math.round(hp.x) + 1, Math.round(hp.y), 'rgba(0,0,0,0.5)');
    }
    // e. emissive
    drawEmissive(sg, view);
    if (A.drawProps) A.drawProps(sg, view, 'glow');
    // the game's answers inside the glass: lit bay cards, pockets hopping
    if (A.drawGlassFx) A.drawGlassFx(sg, view, board);
    mischief(sg, view, 'emissive');
    // f. marbles (their faint trails first), hopper
    var ms = view.marbles || [];
    for (i = 0; i < ms.length; i++) if (ms[i].trail && ms[i].phase !== 'tunnel' && !ms[i].hidden) drawTrail(sg, ms[i]);
    for (i = 0; i < ms.length; i++) {
      if (ms[i].phase === 'tunnel') { if (!ms[i].hidden) drawTunnelLight(sg, ms[i], t); }
      else if (!ms[i].hidden) drawMarble(sg, ms[i], t);
    }
    // marbles carried by figurines (a theft) are drawn at their hands
    for (i = 0; i < figs.length; i++) if (figs[i].hold) drawMarble(sg, { x: figs[i].hold.x, y: figs[i].hold.y, r: 4, spin: figs[i].hold.spin != null ? figs[i].hold.spin : 0, id: figs[i].hold.id != null ? figs[i].hold.id : 7 }, t);
    mischief(sg, view, 'over');
    drawHopper(sg, view);
    // g. the glass
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(tint, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(sheen, 0, 0);

    ctx.drawImage(scene, C.GX, C.GY);
    // 3. the paper taped outside the glass, in the room's light
    var pl = paperLight(view);
    A.paperK = pl;
    ctx.drawImage(dimmedOverlay(pl), 0, 0);
    // a knocker reading the legend card from behind, by his own light: the
    // paper glows and his shadow is on it
    if (view.fx && view.fx.cardLamp) drawCardLamp(ctx, view.fx.cardLamp, t);
    // the machine's own dials (pachinko-art-counters.js): the SCRIP counter,
    // the coin door's card and lamp, your pocket, the ticket mouth
    if (A.drawMachine) A.drawMachine(ctx, view);
    mischief(ctx, view, 'cabinet');
    // the attendant pencils the crew's alterations on the legend card
    var nAlt = (view.fx && view.fx.alterations || []).length;
    if (nAlt > 0 && C.legend) { var LL = C.legend; A.text(ctx, 'ALT ' + nAlt, LL.x + LL.w - 21, LL.y + 4, '#5a5a6a', 1, function (i2, col, row) { return A.hash01(611, i2 * 3 + col, row) < 0.1 ? null : '#5a5a6a'; }); }
  }
  // mischief and the mother lode (pachinko-art-mischief.js, wave 4): a
  // failure there costs its layer for the frame, never the whole view
  function mischief(g, view, layer) {
    if (!A.drawMischief) return;
    try { A.drawMischief(g, view, layer); } catch (e) { if (!mischief.warned && root.console) { mischief.warned = true; console.warn('MOTHER LODE: drawMischief ' + layer, e); } }
  }

  R.build = build;
  R.draw = draw;
  R._debug = function () { return { light: lightC, light2: light2C, haze: hazeC, scene: scene }; };
  R.drawFigure = function (g, fig) { return A.drawFigure(g, fig); };
  R.figureLamp = function (fig) { return A.figureLamp(fig); };
  R.figureHands = function (fig) { return A.figureHands(fig); };
  R.POSES = A.POSES;
  R.CREW = A.CREW;
  R.coinRect = C.coinRect;
  R.tubeRect = function () { return { x: C.tube.x, y: C.tube.y0, w: C.tube.w, h: C.tube.y1 - C.tube.y0 }; };
  R.stillLife = function () { return mine ? mine.stillLife : []; };
  root.PachinkoRender = R;
})(typeof window !== 'undefined' ? window : globalThis);
