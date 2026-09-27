/* MOTHER LODE — renderer
 *
 * The render contract (see pachinko-main.js's header and PLAN §12):
 *   window.PachinkoRender = { GLASS_W, GLASS_H, CAB_W, CAB_H, GLASS_X, GLASS_Y,
 *                             build(board), draw(ctx, view), … }
 * ctx is the CAB_W × CAB_H cabinet canvas at 1:1; main.js owns the camera.
 *
 * FRAME PIPELINE (per draw):
 *   1. the cabinet (static layer + live bulbs, the feed tube, the coin lamp)
 *   2. the glass interior, composed in a 320 × 416 scene canvas:
 *      a. ALBEDO: the baked mine (backdrop, strata, specimens, workings, pins)
 *         + live albedo (wheels, the door, the cart, figurines)
 *      b. LIGHT: a lightmap (ambient purple-black + dithered lamp pools,
 *         the case light over the backdrop), multiplied over (a)
 *      c. EMISSIVE: flames, lit windows, coal glints where lit, pin rims,
 *         hit sparks, the watch's hand
 *      d. marbles (glass cat's-eyes with the mine upside-down inside them),
 *         the hopper and its ghost
 *      e. the glass: nicotine tint (multiply), reflection streak, smears,
 *         fingerprints
 *   3. overlays taped to the glass: the legend card, the figures card, the sticker
 *
 * LIGHT API (for mischief and the knockers):
 *   view.fx.lights = { regionId: 0..1 }   scale a region's lamps (0 = lamps out)
 *   view.fx.dark   = { regionId: 0..1 }   black the region out (1 = fully dark)
 *   view.fx.flare  = 0..1                 every lamp flares (the mother lode)
 *   figures with lamp !== false add their candle's pool automatically;
 *   view.fx.extraLamps = [{x, y, r, c, k}] adds pools (e.g. a lode glow)
 *   R.lightAt(x, y) → 0..~1.5 luminance for CPU decisions (glints, pins)
 *
 * No Math.random, no Date: flicker and twinkle are hashes of view.t.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline, dither = S.dither;
  var disc = A.disc, bayer = A.bayer;

  var GW = 320, GH = 416, C = A.CAB;
  var R = {
    GLASS_W: GW, GLASS_H: GH, CAB_W: C.W, CAB_H: C.H, GLASS_X: C.GX, GLASS_Y: C.GY
  };

  var cabStatic = null, tint = null, sheen = null;
  var mine = null;          // { albedo, lamps, glints, emissive, pins, figs, overlay }
  var scene = null, sg = null, light = null, lg = null, mc = null, mcg = null, mask = null;
  var light2 = null, lg2 = null, foreC = null, fcg = null;
  var board = null;

  /* ══ build ═════════════════════════════════════════════════════════ */
  function build(b) {
    board = b;
    if (!cabStatic) {
      cabStatic = A.buildCabinet();
      tint = A.buildGlassTint();
      sheen = A.buildGlassSheen();
      scene = A.makeCanvas(GW, GH); sg = scene.getContext('2d');
      light = A.makeCanvas(GW, GH); lg = light.getContext('2d');
      mc = A.makeCanvas(13, 13); mcg = mc.getContext('2d');
      light2 = A.makeCanvas(GW, GH); lg2 = light2.getContext('2d');
      foreC = A.makeCanvas(GW, GH); fcg = foreC.getContext('2d');
    }
    mine = A.paintMine(b);
    mine.overlay = A.buildCabinetOverlay(b, mine.figs);
    pinSpr = {};
    bakeHistory(mine.albedo.getContext('2d'), b);
    if (A.bakeMischief) { try { A.bakeMischief(mine.albedo.getContext('2d'), mine.fore.getContext('2d'), b); } catch (e) { if (root.console) console.warn('MOTHER LODE: bakeMischief', e); } }
    return R;
  }

  /* ══ the crew's marks on the board (knockers, wave 3) ══════════════
   * Every pin the knockers have moved this visit leaves its old nail hole in
   * the rock (the board's history, from board.edits), and a tunnel mouth
   * they have shut is boarded over. Baked into the albedo at build. */
  function bakeHistory(g, b) {
    var hist = {};
    (b.edits || []).forEach(function (e) { if (e.type === 'nudge') (hist[e.id] = hist[e.id] || []).push(e); });
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

  /* ══ light ═════════════════════════════════════════════════════════ */
  var AMBIENT = [46, 36, 72];        // the purple-black of a mine with the lamps out
  var FLOOR = 'rgb(188,178,206)';     // the least light a pin (or a label) ever gets          // the purple-black of a mine with the lamps out
  var poolCache = {};
  // a dithered lamp pool: radial falloff, posterised into steps on the
  // Bayer grid so light looks painted, not airbrushed
  function pool(r, hex, lvl) {
    var key = r + hex + lvl;
    if (poolCache[key]) return poolCache[key];
    var n = r * 2 + 1, c = A.makeCanvas(n, n), g = c.getContext('2d');
    var rgb = A.rgb(hex), im = g.createImageData(n, n), d = im.data;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var dx = x - r, dy = y - r, dist = Math.sqrt(dx * dx + dy * dy) / r;
      if (dist >= 1) continue;
      var f = Math.pow(1 - dist, 1.5) * lvl;
      var steps = 7, q = Math.floor(f * steps + bayer(x, y) * 0.999) / steps;
      if (q <= 0) continue;
      var o = (y * n + x) * 4;
      d[o] = rgb[0] * q; d[o + 1] = rgb[1] * q; d[o + 2] = rgb[2] * q; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return (poolCache[key] = c);
  }
  function flickerOf(lamp, t) {
    var k = lamp.k == null ? 1 : lamp.k;
    if (lamp.kind === 'spot') return k;
    if (lamp.kind === 'bulb') {                     // company electric: steady, the odd brownout
      var b = A.hash01(lamp.seed, Math.floor(t * 3), 1);
      return k * (b < 0.03 ? 0.6 : 1);
    }
    var h = A.hash01(lamp.seed, Math.floor(t * 9), 2); // flame: breathes, gutters
    return k * (0.86 + h * 0.14);
  }
  // the lamps in play this frame (baked lamps + figurines + extras)
  function lampsFor(view) {
    var t = view.t || 0, fx = view.fx || {}, out = [];
    var lights = fx.lights || {}, flare = fx.flare || 0;
    for (var i = 0; i < mine.lamps.length; i++) {
      var L = mine.lamps[i], k = lights[L.region] == null ? 1 : lights[L.region];
      if (k <= 0) continue;
      out.push({ x: L.x, y: L.y, r: L.r, c: L.c, k: flickerOf(L, t) * k * (1 + flare * 0.5), region: L.region, kind: L.kind });
    }
    var figs = figuresFor(view);
    for (i = 0; i < figs.length; i++) {
      if (figs[i].lamp === false) continue;
      var fl = A.figureLamp(figs[i]);
      var rk = lights[board && PB() ? PB().regionAt(fl.x, fl.y) : ''] ;
      if (rk === 0) continue;
      var lk = figs[i].lampK == null ? 1 : figs[i].lampK;
      if (lk <= 0) continue;
      out.push({ x: fl.x, y: fl.y, r: 24, c: P.LAMP, k: 0.8 * lk * (0.85 + 0.15 * A.hash01(i + 5, Math.floor(t * 8), 3)), kind: 'candle' });
      if (fl.lantern) out.push({ x: fl.lantern.x, y: fl.lantern.y, r: 44, c: P.LAMP, k: 0.95 * Math.max(lk, 0.5), kind: 'lantern' });
    }
    (fx.extraLamps || []).forEach(function (e) { out.push({ x: e.x, y: e.y, r: e.r || 30, c: e.c || P.LAMP, k: e.k == null ? 1 : e.k }); });
    return out;
  }
  function PB() { return root.PachinkoBoard; }
  var frameLamps = [];
  function paintLight(view) {
    var fx = view.fx || {};
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = 'rgb(' + AMBIENT.join(',') + ')';
    lg.fillRect(0, 0, GW, GH);
    // the case light: a hidden tube behind the top rail lights the painted
    // backdrop evenly (museums light the painting, not the mine)
    lg.drawImage(mine.caseLight, 0, 0);
    lg.globalCompositeOperation = 'lighter';
    frameLamps = lampsFor(view);
    for (var i = 0; i < frameLamps.length; i++) {
      var L = frameLamps[i], lvl = Math.round(Math.min(1.4, L.k) * 10) / 10;
      var sp = pool(L.r, L.c, lvl);
      lg.drawImage(sp, Math.round(L.x - L.r), Math.round(L.y - L.r));
    }
    lg.globalCompositeOperation = 'source-over';
    // the foreground's light: the same, never below the floor
    lg2.globalCompositeOperation = 'source-over';
    lg2.drawImage(light, 0, 0);
    lg2.globalCompositeOperation = 'lighten';
    lg2.fillStyle = FLOOR; lg2.fillRect(0, 0, GW, GH);
    lg2.globalCompositeOperation = 'source-over';
    // blackouts: the region goes to the bottom of the dark (pins too)
    var dark = fx.dark || {};
    for (var id in dark) {
      var reg = regionRect(id); if (!reg || !dark[id]) continue;
      [lg, lg2].forEach(function (c) {
        c.globalAlpha = Math.min(1, dark[id]);
        c.fillStyle = '#050407'; c.fillRect(reg.x, reg.y, reg.w, reg.h);
        c.globalAlpha = 1;
      });
    }
    // the edges of the section fall away into the night
    lg.globalCompositeOperation = 'multiply';
    lg.drawImage(mine.vignette, 0, 0);
    lg.globalCompositeOperation = 'source-over';
  }
  function regionRect(id) {
    var rs = board && board.regions || [];
    for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i];
    return null;
  }
  function lightAt(x, y) {
    var v = 0.3;
    if (y < A.SURF) v += 0.75;
    for (var i = 0; i < frameLamps.length; i++) {
      var L = frameLamps[i], d = Math.hypot(x - L.x, y - L.y) / L.r;
      if (d < 1) v += Math.pow(1 - d, 1.5) * L.k;
    }
    return v;
  }
  R.lightAt = lightAt;

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

  /* ══ emissive ══════════════════════════════════════════════════════ */
  function drawEmissive(g, view) {
    var t = view.t || 0, fx = view.fx || {}, lights = fx.lights || {}, dark = fx.dark || {};
    function lit(region) { return (lights[region] == null || lights[region] > 0) && !(dark[region] >= 1); }
    // the case light's tube, glimpsed through the louvre under the valance
    for (var tx = 2; tx < GW - 2; tx++) px(sg, tx, 11, (tx % 6 === 0) ? '#8a8672' : '#f4ecd0');
    // painted lights on the backdrop (the train's windows, the town)
    for (var i = 0; i < mine.emissive.length; i++) {
      var e = mine.emissive[i];
      if (e.blink && A.hash01(i, Math.floor(t * 0.5), 9) < 0.2) continue;
      rect(g, e.x, e.y, e.w, e.h, e.c);
    }
    // lamp flames
    for (i = 0; i < mine.lamps.length; i++) {
      var L = mine.lamps[i];
      if (!lit(L.region)) continue;
      if (L.flame) {
        var h = A.hash01(L.seed, Math.floor(t * 9), 4);
        if (L.kind === 'bulb') { px(g, L.fx, L.fy, P.FLAME2); px(g, L.fx, L.fy + 1, P.FLAME1); }
        else { px(g, L.fx, L.fy, P.FLAME2); px(g, L.fx, L.fy - 1, h < 0.5 ? P.FLAME1 : P.FLAME0); if (h > 0.8) px(g, L.fx + 1, L.fy - 1, P.FLAME0); }
      }
    }
    // figurines' candles
    var figs = figuresFor(view);
    for (i = 0; i < figs.length; i++) {
      if (figs[i].lamp === false) continue;
      var fl = A.figureLamp(figs[i]), fh = A.hash01(i, Math.floor(t * 8), 6), ff = figs[i].facing < 0 ? -1 : 1;
      if (fl.back) { px(g, Math.round(fl.x), Math.round(fl.y), 'rgba(255,208,96,0.85)'); px(g, Math.round(fl.x) - 1, Math.round(fl.y) + 1, 'rgba(255,138,42,0.5)'); px(g, Math.round(fl.x) + 1, Math.round(fl.y) + 1, 'rgba(255,138,42,0.5)'); continue; }
      if (figs[i].lampK != null && figs[i].lampK < 0.35) { px(g, Math.round(fl.x), Math.round(fl.y), fh < 0.5 ? P.FLAME0 : '#b0561e'); continue; }
      px(g, Math.round(fl.x), Math.round(fl.y), P.FLAME2);
      px(g, Math.round(fl.x + ff), Math.round(fl.y - 1), fh < 0.6 ? P.FLAME1 : P.FLAME0);
      if (fh > 0.85) px(g, Math.round(fl.x + ff * 2), Math.round(fl.y - 1), P.FLAME0);
      if (fl.lantern) { rect(g, Math.round(fl.lantern.x - 1), Math.round(fl.lantern.y - 3), 3, 3, P.FLAME1); px(g, Math.round(fl.lantern.x), Math.round(fl.lantern.y - 2), P.FLAME2); }
    }
    // coal glints: only where there is light to catch
    for (i = 0; i < mine.glints.length; i++) {
      var gp = mine.glints[i], L2 = lightAt(gp.x, gp.y);
      if (L2 < 0.35) continue;
      var tw = Math.sin(t * gp.rate + gp.ph);
      if (tw > 0.93) { px(g, gp.x, gp.y, P.GLINT); if (tw > 0.985 && L2 > 0.6) { px(g, gp.x - 1, gp.y, gp.c); px(g, gp.x + 1, gp.y, gp.c); px(g, gp.x, gp.y - 1, gp.c); px(g, gp.x, gp.y + 1, gp.c); } }
      else if (tw > 0.6 && L2 > 0.55) px(g, gp.x, gp.y, gp.c);
    }
    // pins: the silhouette rule survives the dark (a lit top-left pixel),
    // unless the region is blacked out; a pin that was just hit sparks
    var hot = {};
    (view.hits || []).forEach(function (hh) { hot[hh.id] = Math.max(hot[hh.id] || 0, 1 - ((t - hh.t) / 0.25)); });
    for (i = 0; i < mine.pins.length; i++) {
      var p = mine.pins[i];
      if (dark[p.region] >= 1) continue;
      var k = hot[p.id];
      if (k > 0) {
        px(g, p.hx, p.hy, '#ffffff'); px(g, p.hx + 1, p.hy, P.FLAME2);
        if (k > 0.5) { px(g, p.hx - 1, p.hy - 1, P.GLINT); px(g, p.hx + 2, p.hy - 1, P.GLINT); }
      }
    }
    // the pocket watch, still going: its minute hand, one pixel, turning
    if (mine.watch) {
      var w = mine.watch, a = (t / 60) * Math.PI * 2 - Math.PI / 2 + w.a0;
      var ex = Math.round(w.x + Math.cos(a) * 2), ey = Math.round(w.y + Math.sin(a) * 2);
      px(g, ex, ey, P.INK); px(g, w.x, w.y, P.INK);
    }
    // the wedding ring catches the light now and then
    if (mine.ring && lightAt(mine.ring.x, mine.ring.y) > 0.3 && Math.sin(t * 0.9) > 0.97) px(g, mine.ring.x - 1, mine.ring.y - 1, '#ffffff');
    // a moth at the ventilation road's lantern, never quite getting there
    var moth = fx.moth || mine.moth;
    if (moth && lit(moth.region || mine.moth.region)) {
      var mk = Math.floor(t * 12), ma = mk * 0.9 + Math.sin(mk * 0.37) * 1.7, mr = 4 + A.hash01(9, mk >> 2, 0) * 5;
      var mx = Math.round(moth.x + Math.cos(ma) * mr), my = Math.round(moth.y + Math.sin(ma) * mr * 0.6);
      var up = mk % 2;
      px(g, mx, my, P.MOTH_D); px(g, mx - 1, my - up, P.MOTH); px(g, mx + 1, my - up, P.MOTH);
    }
    // and a rat's tail in the crack by the door, twitching; now and then it isn't there
    if (mine.rat) {
      var rk = Math.floor(t * 3), gone = A.hash01(21, Math.floor(t / 7), 0) < 0.3;
      if (!gone) {
        var tw = A.hash01(22, rk, 0) < 0.25 ? 1 : 0, rx = mine.rat.x, ry = mine.rat.y;
        px(g, rx, ry, P.RAT); px(g, rx - 1, ry, P.RAT); px(g, rx - 2, ry + tw, P.RAT); px(g, rx - 3, ry + tw, P.RAT_D || '#8a6a6a'); px(g, rx - 4, ry + 1, '#8a6a6a');
      }
    }
  }

  /* ══ the marble ════════════════════════════════════════════════════ */
  var SWIRLS = [[P.PINK, P.PINK_D], [P.GOLD3, P.GOLD1], ['#4ad0a0', '#1e7058'], ['#5a8aff', '#2a3a9a'], ['#ff7040', '#8a2a10']];
  var discMask = {};
  function maskFor(r) {
    if (discMask[r]) return discMask[r];
    var c = A.makeCanvas(13, 13), g = c.getContext('2d');
    disc(g, 6.5, 6.5, r + 0.3, '#fff');
    return (discMask[r] = c);
  }
  function drawMarble(g, m, t) {
    var r = Math.max(3, Math.min(5, Math.round(m.r || 4)));
    var cx = Math.round(m.x), cy = Math.round(m.y);
    // a shadow on the rock behind (the marble rides the glass, a little proud)
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++)
      if (x * x + y * y <= r * r && bayer(cx + x + 2, cy + y + 3) < 0.55) px(g, cx + x + 2, cy + y + 3, 'rgba(4,3,8,0.55)');
    // the inverted mine: sample the lit scene around it, flip, shrink
    mcg.clearRect(0, 0, 13, 13);
    mcg.globalCompositeOperation = 'source-over';
    mcg.imageSmoothingEnabled = false;
    mcg.save(); mcg.translate(13, 13); mcg.scale(-1, -1);
    var sr = r * 3;
    mcg.drawImage(scene, cx - sr, cy - sr, sr * 2, sr * 2, 6.5 - r - 0.5, 6.5 - r - 0.5, r * 2 + 1, r * 2 + 1);
    mcg.restore();
    // glass: gathers light, cools it; cut to the disc inside the rim
    mcg.globalCompositeOperation = 'lighter';
    mcg.fillStyle = 'rgb(80,108,128)'; mcg.fillRect(0, 0, 13, 13);
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
    for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) {
      var d = Math.sqrt(xx * xx + yy * yy);
      if (d > r + 0.35) continue;
      var lit = -(xx + yy) / (d || 1);                     // +1 toward the top-left
      if (d > r - 0.65) px(mcg, 6 + xx, 6 + yy, lit > 0.55 ? '#d8ecf8' : lit > -0.2 ? '#44607a' : '#0a0e16');
      else if (d > r - 1.65) { if (lit > 0.5) px(mcg, 6 + xx, 6 + yy, '#9ec4dc'); else if (lit < -0.5) px(mcg, 6 + xx, 6 + yy, '#26384a'); }
    }
    // the specular: a bright window-shaped glint, and the lamplight
    // focused through the glass onto the far side
    var o = -Math.ceil(r / 2);
    px(mcg, 6 + o, 6 + o, '#ffffff'); px(mcg, 7 + o, 6 + o, '#ffffff'); px(mcg, 6 + o, 7 + o, '#eaf6ff');
    px(mcg, 6 - o, 6 - o + (r > 3 ? 0 : -1), P.FLAME1); px(mcg, 5 - o, 6 - o, 'rgba(255,208,96,0.6)');
    g.drawImage(mc, cx - 6, cy - 6);
  }
  // a marble's trail: where the glass was a moment ago, a few dithered
  // pixels of cool light that fall away (only where it moved fast)
  function drawTrail(g, m) {
    var tr = m.trail, n = tr.length / 2;
    if (n < 2) return;
    for (var i = 0; i < n - 1; i++) {
      var x = tr[i * 2], y = tr[i * 2 + 1], x2 = tr[i * 2 + 2], y2 = tr[i * 2 + 3];
      var d = Math.hypot(x2 - x, y2 - y);
      if (d < 3) continue;
      var k = (i + 1) / n;                                   // older → fainter
      var X = Math.round(x), Y = Math.round(y);
      if (Math.hypot(X - m.x, Y - m.y) < (m.r || 4) + 1) continue;
      if (bayer(X, Y) < 0.35 + k * 0.4) px(g, X, Y, 'rgba(190,220,255,' + (0.12 + k * 0.28).toFixed(2) + ')');
    }
  }
  // a marble in a tunnel: a light moving behind the rock
  function drawTunnelLight(g, m, t) {
    var tu = m.tunnel; if (!tu || !tu.from || !tu.to) return;
    var k = tu.k, x = tu.from.x + (tu.to.x - tu.from.x) * k, y = tu.from.y + (tu.to.y - tu.from.y) * k + Math.sin(k * Math.PI) * 10;
    for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) {
      var d = (i * i + j * j) / 6;
      if (d < 1 && bayer(Math.round(x) + i, Math.round(y) + j) < (1 - d) * 0.6) px(g, Math.round(x) + i, Math.round(y) + j, 'rgba(180,210,255,0.35)');
    }
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
      var hw = 6 - Math.floor(j2 * 0.7), o = j2 >= 4 ? lean : 0;
      hline(g, x - hw + o, x + hw + o, 4 + j2, j2 === 0 ? '#d8d8e8' : (j2 % 3 === 2 ? P.IRON3 : P.IRON4));
      px(g, x - hw + o, 4 + j2, '#e8e8f4'); px(g, x + hw + o, 4 + j2, P.IRON1); px(g, x + hw - 1 + o, 4 + j2, P.IRON2);
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
    // his shadow on the paper, soft-edged by the paper's thickness
    if (cl.fig && A.figureSilhouette) {
      // his shadow on the paper: one crisp warm-dark shape, no ink line
      var sil = A.figureSilhouette(cl.fig, true), fx0 = Math.round(cl.fig.x + C.GX) - 36, fy0 = Math.round(cl.fig.y + C.GY) - 54;
      ctx.globalAlpha = 0.58 * k; ctx.drawImage(sil, fx0, fy0);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ══ draw ══════════════════════════════════════════════════════════ */
  function draw(ctx, view) {
    if (!mine) build(view.board || board);
    else if (view.board && view.board !== board) build(view.board);
    var t = view.t || 0;
    ctx.drawImage(cabStatic, 0, 0);
    A.drawCabinetLive(ctx, view);

    // a. albedo
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(mine.albedo, 0, 0);
    drawKinematics(sg, view);
    // the knockers' kit: ladders, rope ladders, their doors (behind them)…
    if (A.drawProps) A.drawProps(sg, view, 'back');
    var figs = figuresFor(view);
    for (var i = 0; i < figs.length; i++) A.drawFigure(sg, figs[i]);
    // …and what is in their hands (in front)
    if (A.drawProps) A.drawProps(sg, view, 'front');
    mischief(sg, view, 'albedo');
    // b. light
    paintLight(view);
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(light, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    // the foreground (pins, markers, bay boards) lit with a floor
    fcg.globalCompositeOperation = 'copy';
    fcg.drawImage(mine.fore, 0, 0);
    fcg.globalCompositeOperation = 'multiply';
    fcg.drawImage(light2, 0, 0);
    fcg.globalCompositeOperation = 'destination-in';
    fcg.drawImage(mine.fore, 0, 0);
    // a pin the knockers have pulled is out of the rock: its nail hole shows
    var lifted = view.fx && view.fx.lifted, lid;
    if (lifted) {
      fcg.globalCompositeOperation = 'destination-out';
      for (lid in lifted) { var lp = board.byId && board.byId[lid], ls = lp && R.pinSprite(lid); if (ls) fcg.drawImage(ls, Math.round(lp.x) - 3, Math.round(lp.y) - 3); }
    }
    fcg.globalCompositeOperation = 'source-over';
    sg.drawImage(foreC, 0, 0);
    if (lifted) for (lid in lifted) {
      var hp = board.byId && board.byId[lid]; if (!hp) continue;
      px(sg, Math.round(hp.x), Math.round(hp.y), P.VOID0); px(sg, Math.round(hp.x) + 1, Math.round(hp.y), 'rgba(0,0,0,0.5)');
    }
    mischief(sg, view, 'crack');
    // c. emissive
    drawEmissive(sg, view);
    if (A.drawProps) A.drawProps(sg, view, 'glow');
    // the game's answers inside the glass: lit bay cards, pockets hopping
    if (A.drawGlassFx) A.drawGlassFx(sg, view, board);
    mischief(sg, view, 'emissive');
    // d. marbles (their faint trails first), hopper
    var ms = view.marbles || [];
    for (i = 0; i < ms.length; i++) if (ms[i].trail && ms[i].phase !== 'tunnel' && !ms[i].hidden) drawTrail(sg, ms[i]);
    for (i = 0; i < ms.length; i++) {
      if (ms[i].phase === 'tunnel') drawTunnelLight(sg, ms[i], t);
      else if (!ms[i].hidden) drawMarble(sg, ms[i], t);
    }
    // marbles carried by figurines (a theft) are drawn at their hands
    for (i = 0; i < figs.length; i++) if (figs[i].hold) drawMarble(sg, { x: figs[i].hold.x, y: figs[i].hold.y, r: 4, spin: figs[i].hold.spin != null ? figs[i].hold.spin : 0, id: figs[i].hold.id != null ? figs[i].hold.id : 7 }, t);
    mischief(sg, view, 'over');
    drawHopper(sg, view);
    // e. the glass
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(tint, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(sheen, 0, 0);

    ctx.drawImage(scene, C.GX, C.GY);
    ctx.drawImage(mine.overlay, 0, 0);
    // a knocker reading the legend card from behind, by his own light: the
    // paper glows and his shadow is on it
    if (view.fx && view.fx.cardLamp) drawCardLamp(ctx, view.fx.cardLamp, t);
    // the machine's own dials (pachinko-art-counters.js): the SCRIP counter,
    // the coin door's card and lamp, your pocket, the ticket mouth
    if (A.drawMachine) A.drawMachine(ctx, view);
    mischief(ctx, view, 'cabinet');
  }
  // mischief and the mother lode (pachinko-art-mischief.js, wave 4): a
  // failure there costs its layer for the frame, never the whole view
  function mischief(g, view, layer) {
    if (!A.drawMischief) return;
    try { A.drawMischief(g, view, layer); } catch (e) { if (!mischief.warned && root.console) { mischief.warned = true; console.warn('MOTHER LODE: drawMischief ' + layer, e); } }
  }

  R.build = build;
  R.draw = draw;
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
