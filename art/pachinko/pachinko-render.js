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
    return R;
  }

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
      out.push({ x: fl.x, y: fl.y, r: 24, c: P.LAMP, k: 0.8 * (0.85 + 0.15 * A.hash01(i + 5, Math.floor(t * 8), 3)), kind: 'candle' });
      if (fl.lantern) out.push({ x: fl.lantern.x, y: fl.lantern.y, r: 44, c: P.LAMP, k: 0.95, kind: 'lantern' });
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
      var fl = A.figureLamp(figs[i]), fh = A.hash01(i, Math.floor(t * 8), 6);
      px(g, Math.round(fl.x), Math.round(fl.y), P.FLAME2);
      px(g, Math.round(fl.x), Math.round(fl.y - 1), fh < 0.6 ? P.FLAME1 : P.FLAME0);
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
    // the canary blinks
    if (mine.canary && A.hash01(3, Math.floor(t * 4), 1) < 0.08) px(g, mine.canary.x, mine.canary.y, P.CANARY);
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
    if (hp.ghostX != null && Math.abs(hp.ghostX - (hp.x || 0)) > 2) bucket(g, Math.round(hp.ghostX), true, false);
    if (hp.x != null) bucket(g, Math.round(hp.x), false, view.marblesLeft == null || view.marblesLeft > 0);
  }
  function bucket(g, x, ghost, loaded) {
    if (ghost) {
      // the ghost: where the bucket would go, in chalk; a dotted drop line
      var cg = 'rgba(232,223,200,0.55)';
      for (var k = -6; k <= 6; k += 2) { px(g, x + k, 4, cg); }
      for (var j = 5; j < 11; j += 2) { px(g, x - 6 + Math.floor((j - 4) * 0.6), j, cg); px(g, x + 6 - Math.floor((j - 4) * 0.6), j, cg); }
      px(g, x, 12, cg);
      for (var y = 16; y < 60; y += 4) px(g, x, y, 'rgba(232,223,200,0.28)');
      return;
    }
    // trolley: two wheels on the rail, a yoke
    rect(g, x - 5, 0, 3, 2, P.IRON3); rect(g, x + 3, 0, 3, 2, P.IRON3); px(g, x - 4, 0, P.IRON4); px(g, x + 4, 0, P.IRON4);
    hline(g, x - 4, x + 4, 2, P.IRON2); vline(g, x, 2, 3, P.IRON3);
    // the bucket: a riveted tin skip, tapering to a spout
    for (var j2 = 0; j2 < 7; j2++) {
      var hw = 6 - Math.floor(j2 * 0.7);
      hline(g, x - hw, x + hw, 4 + j2, j2 === 0 ? '#d8d8e8' : (j2 % 3 === 2 ? P.IRON3 : P.IRON4));
      px(g, x - hw, 4 + j2, '#e8e8f4'); px(g, x + hw, 4 + j2, P.IRON1); px(g, x + hw - 1, 4 + j2, P.IRON2);
    }
    px(g, x - 3, 6, P.IRON1); px(g, x + 3, 6, P.IRON1); px(g, x - 2, 9, P.IRON1); px(g, x + 2, 9, P.IRON1); // rivets
    rect(g, x - 1, 11, 3, 2, P.IRON2); px(g, x + 1, 12, P.IRON0); px(g, x - 1, 11, P.IRON4);           // spout
    if (loaded) { px(g, x - 2, 3, '#9fc0d4'); px(g, x - 1, 3, '#dff0fa'); px(g, x, 3, '#9fc0d4'); px(g, x + 1, 3, '#6d8ea8'); }
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
    var figs = figuresFor(view);
    for (var i = 0; i < figs.length; i++) A.drawFigure(sg, figs[i]);
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
    fcg.globalCompositeOperation = 'source-over';
    sg.drawImage(foreC, 0, 0);
    // c. emissive
    drawEmissive(sg, view);
    // d. marbles, hopper
    var ms = view.marbles || [];
    for (i = 0; i < ms.length; i++) {
      if (ms[i].phase === 'tunnel') drawTunnelLight(sg, ms[i], t);
      else if (!ms[i].hidden) drawMarble(sg, ms[i], t);
    }
    // marbles carried by figurines (a theft) are drawn at their hands
    for (i = 0; i < figs.length; i++) if (figs[i].hold) drawMarble(sg, { x: figs[i].hold.x, y: figs[i].hold.y, r: 4, spin: t * 2, id: 7 }, t);
    drawHopper(sg, view);
    // e. the glass
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(tint, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(sheen, 0, 0);

    ctx.drawImage(scene, C.GX, C.GY);
    ctx.drawImage(mine.overlay, 0, 0);
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
