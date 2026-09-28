/* MOTHER LODE — the diorama: backdrop, strata, specimens, workings, fixtures.
 *
 * Everything here is in the 320 × 416 glass (board) space, y down, and
 * paints ALBEDO: the colours things would be under the museum's full
 * light. The renderer multiplies a lightmap over it, so the lamps decide
 * what you actually see.
 *
 * The section, top to bottom (board.strata; PLAN §12 art-1):
 *   0..12 hopper rail · 12..64 the painted backdrop (sky, ridges, moon;
 *   a board nailed up in the case — the three nails are pins) · 64 the
 *   grass line · soil · sandstone · roof shale (ferns, roof bolts) ·
 *   COAL A, the main haulage way · fireclay, limestone (trilobite) · shale ·
 *   COAL B, the ventilation door · sandstone, shale (lost things) ·
 *   COAL C, the old workings (room and pillar) · deep rock (the ribs, the
 *   vein, the dry sump) · the payout bays.
 * Galleries are cut where board.floors say; pins are dressed per `dress`.
 *
 * paintMine(board) → { albedo, caseLight, vignette, lamps, glints,
 *   emissive, pins, figs, stillLife, watch, ring, moth, rat }
 * drawWheel(g, fixture, pose, t), drawCart(g, fixture, pose, t): live parts.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline, dither = S.dither, ellipse = S.ellipse;
  var line = A.line, thick = A.thick, disc = A.disc, dpx = A.dpx, bayer = A.bayer;
  var GW = 320, GH = 416, SURF = 64;

  /* ── value noise ─────────────────────────────────────────────────── */
  function noise(seed) {
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = A.hash01(seed, xi, yi), b = A.hash01(seed, xi + 1, yi), c = A.hash01(seed, xi, yi + 1), d = A.hash01(seed, xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  var N1 = noise(11), N2 = noise(23), N3 = noise(37), N4 = noise(51);
  function fbm(x, y) { return N1(x, y) * 0.55 + N2(x * 2.1, y * 2.1) * 0.3 + N3(x * 4.3, y * 4.3) * 0.15; }
  A.fbm = fbm;

  /* ── the section: bands and a gentle fold ─────────────────────────── */
  // the fold is kept small: the galleries (and the physics' floors) are
  // level, so the beds only breathe a pixel or two between them
  function warp(x, y) {
    if (y < SURF + 2) return 0;
    return 1.6 * Math.sin(x * 0.021 + 0.6) + 0.9 * Math.sin(x * 0.057 + 2.0) + (N4(x * 0.05, y * 0.02) - 0.5) * 1.6;
  }
  var BANDS = [
    [64, 'soil'], [84, 'sand'], [120, 'shale'], [142, 'coalA'], [160, 'clay'], [168, 'lime'],
    [206, 'shale2'], [222, 'coalB'], [240, 'sand2'], [270, 'shale3'], [292, 'coalC'], [320, 'deep'], [384, 'floor']
  ];
  var TONES = {
    soil: [P.SOIL0, P.SOIL1, P.SOIL2, P.ROOT],
    sand: [P.SAND0, P.SAND1, P.SAND2, P.SAND3], sand2: ['#5a4a2e', '#7a683e', '#978250', '#b4a068'],
    shale: [P.SHALE0, P.SHALE1, P.SHALE2, P.SHALE3], shale2: [P.SHALE0, P.SHALE1, P.SHALE2, P.SHALE3], shale3: ['#2a2234', '#3a2e48', '#4c3c5e', '#645078'],
    coalA: [P.COAL0, P.COAL1, P.COAL2, P.COAL3], coalB: [P.COAL0, P.COAL1, P.COAL2, P.COAL3], coalC: [P.COAL0, P.COAL1, P.COAL2, P.COAL3],
    clay: [P.CLAY0, P.CLAY1, P.CLAY2, P.SAND1],
    lime: [P.LIME0, P.LIME1, P.LIME2, P.LIME3],
    deep: [P.DEEP0, P.DEEP1, P.DEEP2, P.DEEP3],
    floor: [P.VOID0, P.DEEP0, P.DEEP1, P.DEEP2]
  };
  function bandAt(yy) { var k = 0; for (var i = 0; i < BANDS.length; i++) if (yy >= BANDS[i][0]) k = i; return k; }
  A.bandAt = function (x, y) { return BANDS[bandAt(y - warp(x, y))][1]; };

  function tex(key, x, y, yy, top, bot) {
    var n = fbm(x * 0.09, y * 0.09), t = (yy - top) / Math.max(1, bot - top);
    switch (key) {
      case 'soil':
        return 0.3 + n * 0.6 + (A.hash01(3, x, y) < 0.025 ? 0.5 : 0) - t * 0.2;
      case 'sand': case 'sand2': {
        var set = Math.floor(yy / 9), dir = (set % 2) ? 1 : -1;
        var lam = Math.sin((x * 0.55 * dir + yy * 1.7 + set * 3.1)) * 0.5 + 0.5;
        var parting = ((yy | 0) % 9 === 0) ? -0.4 : 0;
        return 0.4 + n * 0.35 + lam * 0.25 + parting;
      }
      case 'shale': case 'shale2': case 'shale3': {
        var lamin = Math.sin(yy * 2.3 + N2(x * 0.03, yy * 0.2) * 5) * 0.5 + 0.5;
        return 0.3 + lamin * 0.35 + n * 0.3;
      }
      case 'coalA': case 'coalB': case 'coalC': {
        var cleat = (Math.abs(((x + (yy * 0.15 | 0) + (A.hash01(7, (yy / 5) | 0, 0) * 6 | 0)) % 7)) < 1) ? 0.5 : 0;
        var vit = Math.abs(t - 0.35) < 0.07 ? 0.4 : 0;
        return 0.22 + n * 0.3 + cleat + vit;
      }
      case 'clay': return 0.35 + n * 0.5;
      case 'lime': {
        var bed = Math.floor((yy - top) / 8), parting2 = ((yy - top) % 8 < 1) ? -0.45 : 0;
        var block = ((x + bed * 13) % 23 < 1) ? -0.35 : 0;
        return 0.45 + n * 0.35 + parting2 + block + (A.hash01(9, x >> 1, y >> 1) < 0.03 ? 0.3 : 0);
      }
      case 'deep': {
        var sw = N3(x * 0.04, yy * 0.07);
        return 0.3 + n * 0.35 + sw * 0.3 - t * 0.25;
      }
      default: return 0.15 + n * 0.25 - t * 0.2;
    }
  }

  /* ══ the painted backdrop (12..64) and the case top (0..12) ═══════ */
  var GRASS0 = '#1c2618', GRASS1 = '#2c3a22', GRASS2 = '#40522e', GRASS3 = '#5a6e3a';
  function paintBackdrop(g, board) {
    var R = A.rng(0xB4C6D);
    // the case's top valance, behind the rail: dark steel with the hidden
    // tube's light catching its lower lip
    rect(g, 0, 0, GW, 12, P.CASE1); hline(g, 0, GW - 1, 10, P.CASE3); hline(g, 0, GW - 1, 9, P.CASE2);
    for (var vx = 0; vx < GW; vx += 4) px(g, vx, 5, P.CASE2);
    // sky: a gradient much too pretty for a coal town at night
    var stops = [[12, P.SKY0], [18, P.SKY1], [24, P.SKY2], [31, P.SKY3], [38, P.SKY4], [44, P.SKY5], [49, P.SKY6]];
    for (var y = 12; y < 64; y++) {
      var a = stops[stops.length - 1], b = a;
      for (var i = 0; i < stops.length - 1; i++) if (y >= stops[i][0] && y < stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; }
      var t = b[0] === a[0] ? 0 : (y - a[0]) / (b[0] - a[0]);
      hline(g, 0, GW - 1, y, a[1]);
      for (var x = 0; x < GW; x++) if (bayer(x, y) < t + (N1(x * 0.07, y * 0.3) - 0.5) * 0.4) px(g, x, y, b[1]);
    }
    // painted stars: neat four-point sparkles, too regular, and a scatter
    var stars = [[18, 17], [52, 22], [96, 15], [131, 19], [158, 30], [214, 16], [240, 34], [304, 18], [44, 33], [118, 27], [286, 40]];
    for (i = 0; i < stars.length; i++) {
      var sx = stars[i][0], sy = stars[i][1];
      px(g, sx, sy, P.STAR);
      if (i % 3 !== 2) { px(g, sx - 1, sy, P.SKY4); px(g, sx + 1, sy, P.SKY4); px(g, sx, sy - 1, P.SKY4); px(g, sx, sy + 1, P.SKY4); }
    }
    for (i = 0; i < 60; i++) { var qx = (R() * GW) | 0, qy = 13 + ((R() * R()) * 24) | 0; px(g, qx, qy, R() < 0.3 ? P.STAR : P.SKY3); }
    // the moon: too big, too gold, perfectly round, a painted halo
    var mo = decor(board, 'moon') || { x: 262, y: 26 }, mx = mo.x, my = mo.y;
    // (too pretty: a perfect cream disc with a painted halo in two flat rings)
    ellipse(g, mx, my, 13, 13, P.SKY3); ellipse(g, mx, my, 10, 10, '#8a4a7c');
    ellipse(g, mx, my, 8, 8, '#fff6d4');
    ellipse(g, mx, my, 7, 7, P.MOONP);
    ellipse(g, mx + 1, my + 1, 6, 6, '#eedc9e');
    // its seas, painted the same on the cut-out (pachinko-art-secrets.js
    // MOON_SEAS): lopsided on purpose, so a crooked moon looks crooked
    A.MOON_SEAS.forEach(function (q) { if (q[2]) ellipse(g, mx + q[0], my + q[1], q[2], q[3], q[4]); else px(g, mx + q[0], my + q[1], q[4]); });
    // ridges: the far one blue, fog pooled in the hollows, nearer ones darker
    ridge(g, 46, P.RIDGE4, P.RIDGE3, 0.8, 1, 0.3);
    for (x = 0; x < GW; x++) for (y = 50; y < 58; y++) if (bayer(x, y) < 0.4 - (y - 50) * 0.045) px(g, x, y, P.FOG);
    ridge(g, 53, P.RIDGE3, P.RIDGE2, 1.0, 2, 1.7);
    ridge(g, 58, P.RIDGE2, P.RIDGE1, 1.1, 3, 4.2, true);
    // the brushwork: a few long horizontal strokes of the next colour
    for (i = 0; i < 26; i++) {
      var bx = (R() * GW) | 0, by = 13 + ((R() * 34) | 0), bl = 6 + ((R() * 18) | 0);
      for (var k = 0; k < bl; k++) if (bayer(bx + k, by) < 0.5) px(g, bx + k, by, R() < 0.5 ? P.SKY2 : P.SKY3);
    }
  }
  function ridge(g, base, c, cd, amp, seed, ph, trees) {
    for (var x = 0; x < GW; x++) {
      var h = base - amp * (3 * Math.sin(x * 0.021 + ph) + 1.6 * Math.sin(x * 0.057 + ph * 2) + 0.8 * Math.sin(x * 0.13 + seed));
      if (trees) h -= ((A.hash01(seed, x, 0) < 0.45) ? 1 : 0) + (x % 3 === 0 ? 1 : 0);
      h = Math.round(h);
      vline(g, x, h, 63, c);
      if (A.hash01(seed + 9, x, 1) < 0.5) px(g, x, h, cd);
    }
  }
  function ridgeY(base, amp, seed, ph, x) {
    return Math.round(base - amp * (3 * Math.sin(x * 0.021 + ph) + 1.6 * Math.sin(x * 0.057 + ph * 2) + 0.8 * Math.sin(x * 0.13 + seed)));
  }

  // the painted train on the middle ridge, the painted church, the town
  function paintTrainAndTown(g) {
    var em = [];
    var tx = 176, cars = 6;
    for (var c = 0; c < cars; c++) {
      var cx = tx + c * 7, ty = ridgeY(53, 1.0, 2, 1.7, cx + 3) - 3;
      rect(g, cx, ty, 6, 3, P.RIDGE0);
      if (c === 0) { rect(g, cx + 1, ty - 2, 2, 2, P.RIDGE0); px(g, cx - 1, ty + 2, P.RIDGE0); em.push({ x: cx - 1, y: ty + 1, c: P.FLAME2, w: 1, h: 1 }); }
      else for (var w = 0; w < 2; w++) if (!(c === 3 && w === 1)) em.push({ x: cx + 1 + w * 3, y: ty + 1, c: P.LAMP, w: 2, h: 1 });
      if (c === 0) for (var s = 0; s < 30; s++) {
        var sy = ty - 3 - Math.round(Math.sin(s * 0.3) * 1.2 + s * 0.1), sxx = cx + 2 + s;
        if (bayer(sxx, sy) < 0.7 - s * 0.02) px(g, sxx, sy, P.FOG);
      }
    }
    // the church on the far ridge, one window lit
    var chx = 34, chy = ridgeY(46, 0.8, 1, 0.3, chx) - 1;
    rect(g, chx, chy - 4, 6, 5, P.RIDGE1); vline(g, chx + 2, chy - 10, chy - 4, P.RIDGE1); rect(g, chx + 1, chy - 7, 3, 3, P.RIDGE1);
    px(g, chx + 2, chy - 11, P.RIDGE1); px(g, chx + 1, chy - 9, P.RIDGE1); px(g, chx + 3, chy - 9, P.RIDGE1);
    em.push({ x: chx + 3, y: chy - 2, c: P.SKY6, w: 1, h: 2 });
    // the company town down in the hollow: two rows of identical houses
    for (var h = 0; h < 9; h++) {
      var hx = 150 + h * 7 + (h > 4 ? 12 : 0), hy = 57 + (h % 2);
      rect(g, hx, hy, 5, 4, P.RIDGE0); hline(g, hx + 1, hx + 3, hy - 1, P.RIDGE0); px(g, hx + 2, hy - 2, P.RIDGE0);
      if (h % 3 !== 1) em.push({ x: hx + 1 + (h % 2) * 2, y: hy + 1, c: P.LAMP, w: 1, h: 1, blink: h === 5 });
    }
    return em;
  }

  /* ══ the model ground: grass lip, fence, headframe, hoist house ═══ */
  function paintGround(g, board, em) {
    // turf: a strip of model grass along the section's top
    for (var x = 0; x < GW; x++) {
      var top = 60 + Math.round(Math.sin(x * 0.09) * 0.8 + A.hash01(5, x, 0) * 1.2);
      vline(g, x, top, 64, GRASS1);
      px(g, x, top, GRASS3);
      if (A.hash01(6, x, 0) < 0.35) px(g, x, top - 1, GRASS2);
      if (A.hash01(8, x, 0) < 0.12) { px(g, x, top - 2, GRASS2); px(g, x, top - 1, GRASS3); }
      if (A.hash01(9, x, 0) < 0.5) px(g, x, 63, GRASS0);
    }
    // a cinder road from the headframe to the town
    for (x = 100; x < 250; x++) if (A.hash01(10, x, 0) < 0.6) px(g, x, 62 + (x % 3 === 0 ? 1 : 0), '#4a4040');
    // the hoist house: a tin shed with a stack, one window lit
    var hx = 132, hy = 52;
    rect(g, hx, hy, 16, 12, P.IRON1); hline(g, hx - 1, hx + 16, hy, P.IRON3);
    for (var k = 0; k < 16; k += 2) vline(g, hx + k, hy + 1, hy + 11, P.IRON0);
    rect(g, hx + 11, hy - 9, 2, 9, P.IRON2); px(g, hx + 11, hy - 10, P.IRON3);
    rect(g, hx + 3, hy + 4, 3, 3, P.NIGHT0); em.push({ x: hx + 4, y: hy + 5, c: P.LAMP, w: 1, h: 1 });
    // two company houses on the right, porches, one light on
    [[252, 50], [280, 51]].forEach(function (hh, i) {
      var x0 = hh[0], y0 = hh[1];
      rect(g, x0, y0, 18, 14 - (i ? 1 : 0), i ? '#3e3a4c' : '#4a3a36');
      for (var r = 0; r < 6; r++) hline(g, x0 - 1 + r, x0 + 18 - r, y0 - 1 - r, i ? '#2a2432' : '#302428');
      hline(g, x0 - 1, x0 + 18, y0, P.CASE0);
      rect(g, x0 + 3, y0 + 4, 3, 3, P.NIGHT0); rect(g, x0 + 12, y0 + 4, 3, 3, P.NIGHT0);
      if (i === 0) em.push({ x: x0 + 3, y: y0 + 4, c: P.LAMP, w: 3, h: 3 });
      else em.push({ x: x0 + 13, y: y0 + 5, c: '#8ab0ff', w: 1, h: 1, blink: true }); // a television, late
      rect(g, x0 + 7, y0 + 8, 3, 6 - (i ? 1 : 0), P.TIM1);
      vline(g, x0 + 14, y0 - 8, y0 - 4, P.IRON2);
    });
    // the headframe: two timber legs, the back brace, cross bracing, the
    // sheave deck; the wheel itself is live
    var hf = decor(board, 'headframe');
    if (hf) {
      var x0 = hf.posts[0], x1 = hf.posts[1], top = hf.top, gnd = hf.ground;
      // the deck and a cap beam at the top of the legs
      rect(g, x0 - 3, top - 2, x1 - x0 + 7, 3, P.TIM2); hline(g, x0 - 3, x1 + 3, top - 2, P.TIM4);
      // cross bracing between the legs
      line(g, x0 + 1, top + 2, x1 - 1, gnd - 2, P.TIM1); line(g, x1 - 1, top + 2, x0 + 1, gnd - 2, P.TIM1);
      // the shaft collar at the foot
      rect(g, x0 - 4, gnd - 2, x1 - x0 + 9, 2, P.TIM2);
    }
    // the man, for scale (see the card). He is to scale.
    px(g, 60, 61, P.INK); px(g, 60, 62, P.INK); px(g, 60, 60, P.FACE_D);
  }

  // the fence: posts are the fencepost pins (they drift), so it's painted per build
  function paintFence(g, board) {
    // shafts to the ground, two strands of wire sagging between neighbours
    var posts = pinsOf(board, 'fencepost').sort(function (a, b) { return a.x - b.x; });
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      vline(g, Math.round(p.x), Math.round(p.y) + 1, 64, P.TIM1);
      var q = posts[i + 1];
      if (q && q.x - p.x < 30) for (var s = 0; s < 2; s++) {
        for (var xx = Math.round(p.x) + 1; xx < Math.round(q.x); xx++) {
          var u = (xx - p.x) / (q.x - p.x), sag = Math.sin(u * Math.PI) * 1.4;
          if ((xx + s) % 2) px(g, xx, Math.round(p.y + (q.y - p.y) * u + 2 + s * 3 + sag), '#6a6470');
        }
      }
    }
  }

  /* ══ strata + galleries (one ImageData pass) ═══════════════════════ */
  // gallery voids from board.floors: the coal seam above each floor is
  // cut out between the floor's ends (and a working face, if any)
  function galleries(board) {
    var out = [], floors = board.floors || [], regs = board.regions || [], fs = board.fixtures || [];
    floors.forEach(function (f) {
      var reg = null;
      regs.forEach(function (r) { if (!reg && f.y > r.y && f.y <= r.y + r.h && r.h <= 40) reg = r; });
      var top = reg ? reg.y : f.y - 16;
      var x0 = f.pieces.length ? f.pieces[0].x0 : f.x0, x1 = f.x1;
      fs.forEach(function (r) { if (r.kind === 'rail' && r.dress === 'face' && r.y2 > top && r.y1 < f.y + 2) x1 = Math.min(x1, r.x1); });
      out.push({ id: f.id, floor: f, top: top, x0: Math.max(0, x0), x1: x1, region: reg && reg.id });
    });
    return out;
  }
  function floorTopAt(f, x) {
    for (var i = 0; i < f.pieces.length; i++) {
      var p = f.pieces[i];
      if (x < p.x0 || x > p.x1) continue;
      var t = p.top;
      for (var k = 0; k < t.length - 1; k++) if (x >= t[k][0] && x <= t[k + 1][0]) {
        var u = (x - t[k][0]) / Math.max(0.001, t[k + 1][0] - t[k][0]);
        return t[k][1] + (t[k + 1][1] - t[k][1]) * u;
      }
      return t[t.length - 1][1];
    }
    return null; // an opening
  }
  function sumpShape(x, y) {
    // the dry sump: a rounded pit in the deep rock, left of the vein
    var cx = 50, cy = 360, rx = 50, ry = 34;
    var dx = (x - cx) / rx, dy = (y - cy) / ry;
    return y > 326 && y < 384 && x < 102 && dx * dx + dy * dy * (y < cy ? 1 : 0.4) < 1 + (N2(x * 0.2, y * 0.2) - 0.5) * 0.25;
  }

  function paintSection(g, board, gals) {
    var img = g.getImageData(0, 0, GW, GH), d = img.data, cache = {};
    function tone(k, i) { var key = k + i; return cache[key] || (cache[key] = A.rgb(TONES[k][i])); }
    // the gallery's back wall: worked coal, pick-marked. Dark, but it takes
    // a lamp's light (the galleries are where the mine is lit)
    var BACK = [A.rgb('#1a1418'), A.rgb('#2e2428'), A.rgb('#44363a'), A.rgb('#5e4c4a')];
    var HOLE = [A.rgb(P.VOID0), A.rgb(P.VOID1), A.rgb(P.VOID2), A.rgb(P.COAL2)];
    var SUMPC = [A.rgb(P.VOID1), A.rgb(P.DEEP0), A.rgb(P.DEEP1), A.rgb(P.CLAY0)];
    var tops = gals.map(function (G) { var a = []; for (var x = 0; x < GW; x++) a[x] = floorTopAt(G.floor, x); return a; });
    for (var y = SURF; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var o = (y * GW + x) * 4, c = null;
        // inside a gallery? (the back wall of the cut: worked coal, dark)
        for (var gi = 0; gi < gals.length; gi++) {
          var G = gals[gi]; if (x < G.x0 || x >= G.x1) continue;
          var ft = tops[gi][x];
          if (y > G.top && (ft == null ? y < G.floor.y + 9 : y < ft)) {
            var n = fbm(x * 0.2, y * 0.3), pick = (A.hash01(17, x, (y / 3) | 0) < 0.08) ? 0.6 : 0;
            var q = (y - G.top < 3 ? 0 : n * 2.2 + pick) + (bayer(x, y) - 0.5) * 0.9;
            if (ft == null) { q = q * 0.6 + 0.4 - (y - G.floor.y + 4) * 0.12; c = HOLE[q < 0.5 ? 0 : q < 1.3 ? 1 : q < 2.0 ? 2 : 3]; break; }  // an opening: a hole going down
            c = BACK[q < 0.5 ? 0 : q < 1.3 ? 1 : q < 2.0 ? 2 : 3];
            break;
          }
        }
        if (!c && sumpShape(x, y)) {
          var tide = Math.abs(y - 350) < 1 ? 3 : (y > 350 && A.hash01(19, x, y) < 0.05 ? 3 : -1);
          var n2 = fbm(x * 0.15, y * 0.15), q2 = n2 * 2.4 + (bayer(x, y) - 0.5) * 0.9;
          c = SUMPC[tide >= 0 ? tide : (q2 < 0.6 ? 0 : q2 < 1.4 ? 1 : 2)];
        }
        if (!c) {
          var yy = y - warp(x, y), bi = bandAt(yy);
          var key = BANDS[bi][1], top = BANDS[bi][0], bot = bi + 1 < BANDS.length ? BANDS[bi + 1][0] : GH;
          var v = tex(key, x, y, yy, top, bot);
          if (Math.abs(yy - top) < 0.9 && bi > 0) v = -1;
          var qq = v * 3 + (bayer(x, y) - 0.5) * 0.55;
          c = tone(key, qq < 0.5 ? 0 : qq < 1.5 ? 1 : qq < 2.5 ? 2 : 3);
        }
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  // timbering: sets (posts + cap) along each gallery, lagging over the
  // roof, the roof's shadow, the track and planks on the floors
  function paintWorkings(g, board, gals) {
    gals.forEach(function (G, gi) {
      var f = G.floor;
      // roof: lagging planks and their shadow
      for (var x = G.x0; x < G.x1; x++) {
        px(g, x, G.top + 1, (x % 6 === 0) ? P.TIM0 : P.TIM1);
        if (bayer(x, G.top + 2) < 0.6) px(g, x, G.top + 2, P.VOID0);
      }
      // sets every ~28 px, skipping openings
      for (var sx = G.x0 + 12 + gi * 7; sx < G.x1 - 6; sx += 28) {
        var ft = floorTopAt(f, sx); if (ft == null) continue;
        vline(g, sx, G.top + 1, Math.round(ft) - 1, P.TIM2); vline(g, sx + 1, G.top + 1, Math.round(ft) - 1, P.TIM1);
        px(g, sx, G.top + 3, P.TIM3);
        rect(g, sx - 3, G.top + 1, 8, 2, P.TIM2); hline(g, sx - 3, sx + 4, G.top + 1, P.TIM3); // cap
        px(g, sx - 3, G.top + 3, P.TIM1); px(g, sx + 4, G.top + 3, P.TIM1);                      // wedges
      }
      // openings in the floor: a timbered collar either side, the hole black
      (f.openings || []).forEach(function (op) {
        var a = Math.round(op.x - op.w / 2), b = Math.round(op.x + op.w / 2);
        for (var yy = f.y - 2; yy < f.y + 10; yy++) { px(g, a, yy, P.TIM3); px(g, a + 1, yy, P.TIM1); px(g, b - 1, yy, P.TIM1); }
        for (yy = f.y + 10; yy < f.y + 14; yy++) if (bayer(a, yy) < 0.5) { px(g, a, yy, P.TIM1); px(g, b - 1, yy, P.TIM0); }
        if (/ladder|manway/.test(op.name || '')) for (yy = G.top + 3; yy < f.y + 12; yy += 3) hline(g, a + 3, b - 4, yy, P.TIM2);
        // collar boards over the hole's lip
        hline(g, a - 1, a + 2, f.y - 2, P.TIM4); hline(g, b - 3, b, f.y - 2, P.TIM4);
      });
      // the working face at the gallery's end: pick-marked coal
      if (G.x1 < f.x1) for (var y = G.top + 1; y < f.y; y++) {
        px(g, G.x1, y, (y % 3) ? P.COAL3 : P.GLINT_D);
        if (y % 4 === 1) px(g, G.x1 - 1, y, P.COAL2);
      }
    });
  }

  /* ══ the crew's footholds beyond the working faces ═══════════════════
   * Past the faces the knockers come out of their little doors onto sills
   * nobody painted: a lip of rock with a lit top edge, so no toy ever stands
   * on nothing (the knockers' own door list says where) */
  function paintSills(g) {
    var K = root.PachinkoKnockers && root.PachinkoKnockers.core, ds = (K && K.DOORS) || [];
    ds.forEach(function (d) {
      if (!d.sill) return;
      var x0 = d.sill[0] - 3, x1 = d.sill[1] + 3, y = d.y;
      for (var x = x0; x <= x1; x++) {
        var end = x === x0 || x === x1, rag = A.hash01(57, x, y) < 0.3 ? 1 : 0;
        px(g, x, y, end ? '#4a3e44' : (x % 5 === 0 ? '#6a5a52' : '#8a786a'));
        px(g, x, y + 1, '#3a2e34'); if (!end) px(g, x, y + 2 + rag, '#1a1216');
      }
      px(g, x0 - 1, y + 1, '#2a2026'); px(g, x1 + 1, y + 1, '#2a2026');
    });
  }

  /* ══ shafts: paired columns of prop pins are a timbered shaft ═══════ */
  function findShafts(board) {
    var props = (board.fixtures || []).filter(function (f) { return f.kind === 'pin' && f.dress === 'prop'; });
    var cols = {};
    props.forEach(function (p) { var k = Math.round(p.x); (cols[k] = cols[k] || []).push(p.y); });
    var xs = Object.keys(cols).map(Number).filter(function (x) { return cols[x].length >= 3; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < xs.length - 1; i++) {
      var a = xs[i], b = xs[i + 1];
      if (b - a < 10 || b - a > 32) continue;
      var y0 = Math.max(Math.min.apply(null, cols[a]), Math.min.apply(null, cols[b])), y1 = Math.min(Math.max.apply(null, cols[a]), Math.max.apply(null, cols[b]));
      if (y1 - y0 < 16) continue;
      out.push({ x0: a, x1: b, y0: y0 - 6, y1: y1 + 6, ys: cols[a].slice().sort(function (p, q) { return p - q; }) });
      i++;
    }
    return out;
  }
  function paintShafts(g, board, shafts) {
    var hf = decor(board, 'headframe');
    shafts.forEach(function (sh, si) {
      var a = sh.x0 + 3, b = sh.x1 - 3, main = hf && Math.abs((sh.x0 + sh.x1) / 2 - hf.x) < 12;
      if (main) sh.y0 = SURF + 1;                           // the main shaft opens at the collar
      // the shaft: a black well, lagged with boards down both walls
      for (var y = sh.y0; y < sh.y1; y++) {
        for (var x = a; x <= b; x++) {
          var q = A.hash01(33, x, y >> 2) * 0.6 + (bayer(x, y) - 0.5) * 0.4 + (x - a) / (b - a) * 0.3;
          px(g, x, y, q < 0.15 ? P.VOID2 : q < 0.55 ? P.VOID1 : P.VOID0);
        }
        px(g, a, y, (y % 7 === 0) ? P.TIM0 : P.TIM2); px(g, a + 1, y, P.TIM1);
        px(g, b, y, (y % 7 === 3) ? P.TIM0 : P.TIM1); px(g, b - 1, y, P.VOID0);
        px(g, a - 1, y, P.TIM3); px(g, b + 1, y, P.TIM2);
      }
      // a ladder down one wall
      var lx = si % 2 ? b - 4 : a + 2;
      for (y = sh.y0 + 2; y < sh.y1; y++) { px(g, lx, y, P.TIM2); px(g, lx + 3, y, P.TIM2); if (y % 4 === 0) hline(g, lx, lx + 3, y, P.TIM3); }
      // the main shaft (under the headframe) carries the hoist rope and a kibble
      if (main) {
        var rx = a + 4;
        for (y = sh.y0 - 8; y < sh.y1 - 14; y++) px(g, rx, y, '#1a1418');
        var ky = sh.y1 - 14;
        hline(g, rx - 2, rx + 2, ky, P.IRON3); rect(g, rx - 3, ky + 1, 7, 6, P.IRON2); hline(g, rx - 3, rx + 3, ky + 1, P.IRON4);
        vline(g, rx + 3, ky + 1, ky + 6, P.IRON0); px(g, rx - 1, ky + 3, P.RUST);
      }
    });
  }

  /* ══ rails ═════════════════════════════════════════════════════════ */
  function drawRail(g, r) {
    var x1 = r.x1, y1 = r.y1, x2 = r.x2, y2 = r.y2, len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len));
    function along(fn) { for (var i = 0; i <= n; i++) { var u = i / n; fn(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, i, u); } }
    switch (r.dress) {
      case 'wall': return;
      case 'track':
        // ties every 3 px, then the steel rail on top
        along(function (x, y, i) {
          var X = Math.round(x), Y = Math.round(y);
          if (i % 3 === 0) { px(g, X, Y + 1, P.TIM2); px(g, X, Y + 2, P.TIM1); px(g, X + 1, Y + 1, P.TIM1); }
          px(g, X, Y - 1, P.IRON4); px(g, X, Y, P.IRON2);
        });
        return;
      case 'floor':
        along(function (x, y, i) {
          var X = Math.round(x), Y = Math.round(y);
          px(g, X, Y - 1, (i % 11 === 0) ? P.TIM1 : P.TIM4); px(g, X, Y, P.TIM3); px(g, X, Y + 1, P.TIM1);
          if (i % 11 === 0) px(g, X, Y, P.TIM0);
        });
        return;
      case 'chute':
        // a board knocked in under a shaft mouth: a nailed plank, lit on top
        along(function (x, y, i) {
          var X = Math.round(x), Y = Math.round(y);
          px(g, X, Y - 1, i % 9 === 0 ? P.TIM3 : P.TIM4); px(g, X, Y, P.TIM3); px(g, X, Y + 1, P.TIM1);
        });
        px(g, Math.round(x1 + (x2 - x1) * 0.1), Math.round(y1 + (y2 - y1) * 0.1), P.IRON4); px(g, Math.round(x1 + (x2 - x1) * 0.9), Math.round(y1 + (y2 - y1) * 0.9), P.IRON4);
        px(g, Math.round(x1), Math.round(y1), P.END); px(g, Math.round(x2), Math.round(y2), P.END);
        return;
      case 'post': case 'brace': case 'timber':
        along(function (x, y, i) {
          var X = Math.round(x), Y = Math.round(y);
          px(g, X - 1, Y, P.TIM4); px(g, X, Y, P.TIM3); px(g, X + 1, Y, P.TIM2);
          if (i % 7 === 3) px(g, X, Y, P.TIM2);
        });
        return;
      case 'divider':
        along(function (x, y, i) {
          var X = Math.round(x), Y = Math.round(y);
          px(g, X - 1, Y, P.TIM4); px(g, X, Y, P.TIM3); px(g, X + 1, Y, P.TIM1);
          if (i % 9 === 4) px(g, X, Y, P.TIM2);
        });
        return;
      case 'pillar':
        var w = Math.max(1, Math.round(r.r || 1.5));
        if (r.y2 - r.y1 > 60) { // the card's edge rib: a steel angle
          along(function (x, y) { px(g, Math.round(x), Math.round(y), P.IRON2); px(g, Math.round(x) + 1, Math.round(y), P.IRON0); });
          return;
        }
        // a coal pillar left standing between rooms, roof to floor
        for (var yy = Math.round(y1) - 9; yy <= Math.round(y2) + 4; yy++) for (var xx = -w - 1; xx <= w + 1; xx++) {
          var q = fbm((x1 + xx) * 0.3, yy * 0.3) * 2 + (bayer(x1 + xx, yy) - 0.5);
          px(g, Math.round(x1) + xx, yy, xx === -w - 1 ? P.COAL3 : xx === w + 1 ? P.VOID0 : q > 1.2 ? P.COAL2 : P.COAL1);
        }
        return;
      case 'face':
        return; // painted with the gallery
      case 'pail':
        return; // drawn with the pocket
      case 'rubble':
        return; // a cave-in's heap: painted whole by pachinko-art-mischief.js
      default:
        along(function (x, y) { px(g, Math.round(x), Math.round(y), P.TIM3); });
    }
  }

  /* ══ pins ══════════════════════════════════════════════════════════ */
  // every pin: a 3×3 body, a bright top-left pixel, a dark bottom-right
  // one, and a little shadow down-right on the rock
  // Every pin keeps ONE readable silhouette rule: a dark rim, a lit
  // top-left, a dark bottom-right, a shadow on the rock down-right. Within
  // that rule the shape says what the pin is (a rail spike's long head, a
  // roof bolt, a tack, a prop's end grain, a coal knuckle, an ore nugget,
  // a bone's condyle, a root knot) and the paint says which rock it's in.
  // Sprite letters: o rim, s spec, l light, b body, d dark, x accent, y accent 2
  var SPR = {
    stud: ['.ooo.', 'oslbo', 'olbdo', 'obddo', '.ooo.'],
    spike: ['ooooo', 'oslbo', 'olbdo', '.obo.', '..o..'],
    spikeR: ['ooooo', 'oslbo', 'obbdo', '.obdo', '..oo.'],
    bolt: ['ooooo', 'osldo', 'olbdo', 'obddo', 'ooooo'],
    tack: ['.ooo.', 'oslbo', 'olbdo', '.odo.', '.....'],
    prop: ['.ooo.', 'olxbo', 'oxsxo', 'obxdo', '.ooo.'],
    coal: ['.oo..', 'oslo.', 'olbboo', 'obbxdo', '.oddo', '..oo.'],
    coal2: ['..ooo', '.osbo', 'olbbo', 'obxdo', '.ooo.'],
    ore: ['..oo.', '.osxo', 'olxbo', 'obbdo', '.ooo.'],
    ore2: ['.ooo.', 'osxbo', 'olbxo', '.obdo', '..oo.'],
    bone: ['.o.o.', 'oslbo', '.olo.', 'obbdo', '.o.o.'],
    root: ['o.oo.', '.olbo', 'olsbo', 'obddo', '.o.oo'],
    hook: ['.ooo.', 'osxbo', 'olxdo', '.oob.', '..ol.'],
    post: ['.ooo.', 'oslbo', 'olbdo', 'obbdo', 'obbdo']
  };
  // metal paints by host rock: [spec, light, body, dark]
  var METAL = {
    sand: ['#f0c8a0', '#b07a50', '#7a4a2e', '#3a2014'],   // rusted iron
    sand2: ['#f0c8a0', '#b07a50', '#7a4a2e', '#3a2014'],
    soil: ['#e0b890', '#9a6a44', '#6a4028', '#301a10'],
    clay: ['#f0b890', '#b0664a', '#7a3a26', '#3a1810'],   // redder rust
    shale: ['#e0ecff', '#8898c0', '#4c5a80', '#20283c'],  // blued steel
    shale2: ['#e0ecff', '#8898c0', '#4c5a80', '#20283c'],
    shale3: ['#ecdcff', '#9484b4', '#56487a', '#241c38'],
    lime: ['#ffffff', '#c0c4c8', '#8a8e96', '#44484e'],   // galvanised
    coalA: ['#dfe6ff', '#6a7494', '#2e3040', '#0c0c14'], coalB: ['#dfe6ff', '#6a7494', '#2e3040', '#0c0c14'], coalC: ['#dfe6ff', '#6a7494', '#2e3040', '#0c0c14'],
    deep: ['#e8e0f0', '#7a6e8a', '#443a52', '#1a1422'], floor: ['#fff0c0', '#d8b060', '#9a7430', '#4a3410']
  };
  var BRASS = ['#fff4c8', '#e0c070', '#a8843c', '#4e3814'];
  function pinLook(p) {
    var band = p.y < SURF - 2 ? 'sky' : A.bandAt(p.x, p.y), h = A.hash01(91, Math.round(p.x), Math.round(p.y));
    // in the painted sky every pin is one of the brass tacks holding the backdrop up
    if (band === 'sky' && (p.dress === 'rivet' || p.dress === 'bolt' || p.dress === 'spike' || !p.dress)) return { spr: SPR.tack, pal: BRASS, x1: BRASS[2], x2: BRASS[3], kind: 'tack' };
    var m = METAL[band] || METAL.deep, spr = 'stud', pal, x1 = null, x2 = null;
    switch (p.dress) {
      case 'spike':
        spr = h < 0.5 ? 'spike' : 'spikeR'; pal = m;
        break;
      case 'bolt': case 'rivet':
        spr = p.dress === 'bolt' ? 'bolt' : 'stud'; pal = m;
        break;
      case 'nail':
        spr = 'tack'; pal = p.material === 'brass' || band === 'sky' ? BRASS : m;
        break;
      case 'hook': case 'lamphook':
        spr = 'hook'; pal = m; x1 = '#0a080c';
        break;
      case 'prop':
        spr = 'prop'; pal = ['#f4dca8', '#c8a060', '#a07c48', '#5a3e20']; x1 = '#7a5830';
        break;
      case 'fencepost':
        spr = 'post'; pal = ['#e8c890', '#a8804a', '#7a5a34', '#3a2816'];
        break;
      case 'root':
        spr = 'root'; pal = ['#f4d8a8', '#b88e5a', '#6e5030', '#3a2616'];
        break;
      case 'coal':
        spr = h < 0.5 ? 'coal' : 'coal2'; pal = ['#f4f8ff', '#8a94b4', '#2a2a38', '#08080c']; x1 = '#4a5474';
        break;
      case 'ore':
        spr = h < 0.5 ? 'ore' : 'ore2'; pal = ['#fffbe8', '#e0dac4', '#a8a290', '#4a4436']; x1 = h < 0.8 ? '#e8b64a' : '#fff0a0';
        break;
      case 'bone': case 'rib':
        spr = 'bone'; pal = ['#fffaf0', '#e0d8c0', '#b8ae94', '#6a6254'];
        break;
      default:
        pal = m;
    }
    return { spr: SPR[spr], pal: pal, x1: x1 || pal[2], x2: x2 || pal[3], kind: spr };
  }
  // each look is rasterised once (a 5-6 px sprite and its shadow) and
  // stamped: a whole board of pins is a few hundred blits, not thousands of px
  var PINSPR = {};
  function pinStamp(L) {
    var key = L.kind + '|' + L.pal.join(',') + '|' + L.x1 + '|' + L.x2, e = PINSPR[key];
    if (e) return e;
    var rows = L.spr, h = rows.length, w = 0;
    for (var j = 0; j < h; j++) w = Math.max(w, rows[j].length);
    var c = A.makeCanvas(w, h), g = c.getContext('2d'), sh = A.makeCanvas(w, h), sg = sh.getContext('2d');
    var C = { o: '#0a080c', s: L.pal[0], l: L.pal[1], b: L.pal[2], d: L.pal[3], x: L.x1, y: L.x2 };
    for (j = 0; j < h; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j][i]; if (ch === '.') continue;
      px(g, i, j, C[ch]); px(sg, i, j, 'rgba(0,0,0,0.42)');
    }
    return (PINSPR[key] = { c: c, sh: sh });
  }
  function drawPin(ga, g, p) {
    var L = pinLook(p), cx = Math.round(p.x), cy = Math.round(p.y);
    var hgt = L.spr.length, oy = cy - (hgt >> 1), ox = cx - 2, st = pinStamp(L);
    // the shadow on the rock (albedo), down-right of the sprite's body
    ga.drawImage(st.sh, ox + 2, oy + 2);
    g.drawImage(st.c, ox, oy);
    // a little context painted on the rock around some of them
    if (p.dress === 'bolt') { hline(ga, ox - 1, ox + 5, oy + 5, P.IRON1); }                    // the bearing plate's lower edge
    if (p.dress === 'root') { line(ga, ox, oy, ox - 3, oy - 5, P.ROOT); px(ga, ox + 4, oy - 2, P.ROOT); }
    if (p.dress === 'ore') { px(ga, ox - 1, oy + 2, P.QUARTZ_D); px(ga, ox + 5, oy + 1, P.QUARTZ_D); }
    if (L.kind === 'spike' || L.kind === 'spikeR') { if (A.hash01(71, cx, cy) < 0.3) px(g, ox + 3, oy + 1, P.RUST); }
    return { id: p.id, x: p.x, y: p.y, region: p.region, hx: ox + 1, hy: oy + 1, hi: L.pal[0], hi2: L.pal[1], kind: L.kind };
  }

  /* ══ pockets, tunnels, bays ════════════════════════════════════════ */
  function drawPocket(g, f, board) {
    if (f.dress === 'pail' || f.dress === 'lunchpail') {
      // the dinner pail, lid off, the marble's catch; the rail below is its base
      var base = (board.byId && board.byId['pail.base']) || null;
      var x0 = base ? Math.round(base.x1) : Math.round(f.x - f.w / 2), x1 = base ? Math.round(base.x2) : Math.round(f.x + f.w / 2);
      var yb = base ? Math.round(base.y1) : Math.round(f.y + 10), yt = Math.round(f.y - 1);
      for (var y = yt; y <= yb; y++) { px(g, x0, y, P.IRON4); px(g, x1, y, P.IRON1); px(g, x0 + 1, y, P.IRON3); px(g, x1 - 1, y, P.IRON2); }
      hline(g, x0, x1, yb, P.IRON2); hline(g, x0 + 2, x1 - 2, yb - 1, P.VOID0);
      rect(g, x0 + 2, yt, x1 - x0 - 3, yb - yt - 1, P.VOID0);
      hline(g, x0 + 2, x1 - 2, yt + 4, P.IRON1);                               // the tray's ledge inside
      for (var a = 0; a <= 10; a++) px(g, Math.round(x0 + a / 10 * (x1 - x0)), Math.round(yt - 1 - Math.sin(a / 10 * Math.PI) * 6), P.IRON3); // bail
      px(g, x1 - 3, yb - 3, P.IRON1); px(g, x1 - 4, yb - 2, P.IRON1);            // the dent
      // the lid, off, leaning on the side
      ellipse(g, x1 + 5, yb - 2, 1, 3, P.IRON3); px(g, x1 + 5, yb - 5, P.IRON4);
    } else {
      rect(g, Math.round(f.x - f.w / 2), Math.round(f.y), Math.round(f.w), 6, P.TIM2);
    }
  }
  function drawTunnelMouth(g, f) {
    var a = f.a, x = Math.round(a.x), y = Math.round(a.y), r = Math.round(a.r || 6);
    if (f.dress === 'door') {
      // a door in the face, its sign painted over; the frame timbered
      rect(g, x - r + 1, y - r, r * 2 - 1, r * 2, P.VOID0);
      rect(g, x - r + 2, y - r + 1, r * 2 - 3, r * 2 - 1, f.open ? P.VOID1 : '#3a2618');
      if (!f.open) for (var k = 0; k < r * 2 - 1; k += 2) vline(g, x - r + 2 + k, y - r + 1, y + r - 1, '#4a3222');
      vline(g, x - r, y - r - 1, y + r, P.TIM3); vline(g, x + r, y - r - 1, y + r, P.TIM2); hline(g, x - r - 1, x + r + 1, y - r - 1, P.TIM3);
      rect(g, x - 4, y - r - 6, 9, 4, P.PAPER_D); hline(g, x - 3, x + 3, y - r - 5, P.CASE2); hline(g, x - 3, x + 3, y - r - 4, P.CASE2); // the sign, painted out
    } else {
      // an adit: a black arch with a timber frame
      for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) {
        var inside = yy >= 0 ? Math.abs(xx) < r : xx * xx + yy * yy < r * r;
        if (inside) px(g, x + xx, y + yy, yy < -r + 2 ? P.VOID1 : P.VOID0);
      }
      vline(g, x - r, y - 2, y + r, P.TIM3); vline(g, x + r - 1, y - 2, y + r, P.TIM2); hline(g, x - r, x + r - 1, y - 3, P.TIM3);
    }
    // the exit mouth: a smaller hole where it comes out
    var b = f.b, bx = Math.round(b.x), by = Math.round(b.y);
    disc(g, bx + 0.5, by + 0.5, 3.2, P.VOID0); px(g, bx - 2, by - 3, P.TIM2); px(g, bx + 2, by - 3, P.TIM2); hline(g, bx - 3, bx + 3, by - 4, P.TIM3);
  }
  // a bay's name, abbreviated the way a museum does when the card is small
  var ABBR = { STOKER: 'STOK.', SMITHING: 'SMITH', CANNEL: 'CANN.', OVERBURDEN: 'OVERB.', 'THE MOTHER LODE': 'LODE', NOTHING: 'NIL' };
  function bayName(s, w) {
    var n = String(s.label || '').toUpperCase(), max = Math.floor((w - 2) / 4);
    if (n.length > max) n = ABBR[n] || n.slice(0, max);
    if (n.length > max) n = n.slice(0, max);
    return n;
  }
  function drawBays(g, fg, board) {
    var slots = (board.fixtures || []).filter(function (f) { return f.kind === 'slot'; });
    // where each bay's card (and stub) went, for the game to light (integration)
    var cards = A.bayCards = {};
    slots.forEach(function (s, i) {
      var x0 = Math.round(s.x0) + 2, x1 = Math.round(s.x1) - 2, y0 = 389, y1 = GH;
      var lode = s.value >= 13 || s.dress === 'lode';
      // the bay: a bin, back planks, a coal heap of its grade
      for (var y = y0; y < y1; y++) for (var x = x0; x <= x1; x++) {
        var c = (y % 5 === 0) ? P.TIM0 : P.TIM1;
        if (lode) c = (A.hash01(81, x, y) < 0.18) ? P.VEIN2 : (A.hash01(82, x, y) < 0.3 ? P.VEIN0 : '#2a1c0c');
        px(g, x, y, c);
      }
      if (!lode) {
        // a little heap of this grade in the bottom: slate grey, bony brown, egg lumps…
        var heap = ['#3a3a44', '#46464e', '#3a302a', '#2a2830', '#1a1a20', '#2e2a30', '#34302c', '', '#26242c', '#302c34', '#28262a', '#3a3632', '#3a302a'][i] || '#2a2830';
        for (x = x0; x <= x1; x++) {
          var hh = 3 + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 4 + A.hash01(83, x, i) * 2);
          for (y = GH - hh; y < GH; y++) px(g, x, y, A.hash01(84, x, y) < 0.3 ? P.COAL3 : heap);
        }
      }
      // the placard: a small typed card at the back of the bay with the
      // grade's name; where the bay pays, a pink scrip stub pinned to it
      var name = bayName(s, s.x1 - s.x0), cx = (s.x0 + s.x1) / 2, stag = (i % 2) * 5;
      if (lode) {
        var w13 = A.textW('13') + 4;
        rect(fg, Math.round(cx - w13 / 2), 397, w13, 9, '#1a0e04'); hline(fg, Math.round(cx - w13 / 2), Math.round(cx - w13 / 2) + w13 - 1, 397, P.GOLD3);
        A.textC(fg, '13', cx, 399, P.GOLD5);
        cards[s.id] = { x: Math.round(cx - w13 / 2), y: 397, w: w13, h: 9, lode: true, name: '13' };
        return;
      }
      var cw = Math.max(A.textW(name) + 4, 13), cxl = Math.round(cx - cw / 2), pays = s.value > 0;
      // (never under the frame's shadow at either wall)
      if (cxl + cw > GW - 5) { cxl = GW - 5 - cw; cx = cxl + cw / 2; }
      if (cxl < 4) { cxl = 4; cx = cxl + cw / 2; }
      var cy0 = 389 + stag;
      rect(fg, cxl, cy0, cw, 8, P.PAPER_D); hline(fg, cxl, cxl + cw - 1, cy0, P.PAPER); px(fg, cxl + cw - 1, cy0 + 7, P.PAPER_DD);
      A.textC(fg, name, cx, cy0 + 2, P.INK_L);
      px(fg, Math.round(cx), cy0 - 1, P.IRON3);                                         // the pin holding it up
      cards[s.id] = { x: cxl, y: cy0, w: cw, h: 8, name: name, value: s.value };
      if (pays) {
        // the stub: pink paper, a notch, the amount
        var v = '+' + s.value, sw2 = A.textW(v) + 5, sx0 = Math.round(cx - sw2 / 2);
        var ty = cy0 + 9;
        rect(fg, sx0, ty, sw2, 7, P.PINK_D); rect(fg, sx0 + 1, ty + 1, sw2 - 2, 5, P.PINK);
        px(fg, sx0, ty + 3, P.VOID0); px(fg, sx0 + sw2 - 1, ty + 3, P.VOID0);           // the ticket's notches
        A.textC(fg, v, cx + 0.5, ty + 1, '#ffffff');
        cards[s.id].stub = { x: sx0, y: ty, w: sw2, h: 7 };
      }
    });
  }

  /* ══ the vein: quartz and gold along the seam line to the 13 ═══════ */
  function paintVein(g, board, glints) {
    var sm = decor(board, 'seam'); if (!sm) return;
    var R = A.rng(0x6019), n = Math.round(Math.hypot(sm.x2 - sm.x1, sm.y2 - sm.y1));
    for (var i = 0; i <= n; i++) {
      var u = i / n, x = sm.x1 + (sm.x2 - sm.x1) * u, y = sm.y1 + (sm.y2 - sm.y1) * u + Math.sin(u * 9) * 2;
      var w = Math.max(1, Math.round(1.1 * Math.sin(u * 5 + 1) + 1.4 + (N3(u * 20, 3) - 0.5) * 2));
      for (var k = -w - 1; k <= w + 1; k++) {
        var X = Math.round(x), Y = Math.round(y + k), e = Math.abs(k) >= w;
        if (Math.abs(k) === w + 1) { if (R() < 0.5) px(g, X, Y, P.DEEP0); continue; }  // the dark selvage either side
        var q = N2(X * 0.3, Y * 0.3);
        px(g, X, Y, e ? '#6a6456' : q > 0.7 ? P.QUARTZ : q < 0.4 ? '#5a5448' : '#8a8474');
        if (!e && R() < 0.2) {
          px(g, X, Y, R() < 0.5 ? P.VEIN2 : P.VEIN1);
          if (R() < 0.35) glints.push({ x: X, y: Y, ph: R() * 6.28, rate: 0.5 + R(), c: P.VEIN3, gold: true });
        }
      }
    }
    // stringers off the main vein, thinning, one running down to the 13
    var lode = (board.fixtures || []).filter(function (f) { return f.kind === 'slot' && (f.value >= 13 || f.dress === 'lode'); })[0];
    if (lode) {
      var tx = (lode.x0 + lode.x1) / 2, ux = sm.x1 + (sm.x2 - sm.x1) * 0.35, uy = sm.y1 + (sm.y2 - sm.y1) * 0.35;
      for (var s = 0; s < 40; s++) {
        var t = s / 40, sx = ux + (tx - ux) * t + Math.sin(t * 7) * 2, sy = uy + (388 - uy) * t;
        px(g, Math.round(sx), Math.round(sy), R() < 0.4 ? P.VEIN2 : P.QUARTZ_D);
      }
    }
  }
  function paintRibs(g, cx, cy) {
    // something large, lying on its side: the spine along the top, the
    // ribs bowed out like barrel staves and drawn in again, shortening
    // toward the tail; two broken. A cage you could stand in.
    var sx0 = cx - 42, sy0 = cy - 40;
    for (var v = 0; v < 13; v++) {
      var vx = sx0 + v * 7, vy = sy0 + Math.round(Math.sin(v * 0.3) * 3);
      rect(g, vx, vy, 5, 3, P.BONE_D); px(g, vx, vy, P.BONE); px(g, vx + 4, vy + 2, P.DEEP0); px(g, vx + 2, vy - 1, P.BONE_D);
      if (v < 2 || v > 11) continue;
      var len = Math.round(40 - Math.abs(v - 5) * 3.2), bulge = 7 - Math.abs(v - 5) * 0.5;
      var broken = v === 9 ? 0.5 : v === 4 ? 0.7 : 1;
      for (var k = 0; k < len * broken; k++) {
        var a = k / len, rx = vx + 2 + Math.round(Math.sin(a * Math.PI) * bulge - a * 5), ry = vy + 3 + k;
        px(g, rx, ry, P.BONE_D); px(g, rx + 1, ry, a < 0.5 ? P.BONE_D : P.DEEP3); px(g, rx - 1, ry, P.DEEP1);
        if (k % 7 === 3) px(g, rx, ry, P.BONE);
      }
    }
    // the sternum where they meet below, mostly still in the rock
    for (var x = sx0 + 6; x < sx0 + 70; x++) if (A.hash01(88, x, 0) < 0.6) px(g, x, sy0 + 42 + Math.round(Math.sin(x * 0.05) * 3), P.BONE_D);
  }



  /* ══ specimens ═════════════════════════════════════════════════════ */
  function fern(g, x, y, len, dir) {
    // a Neuropteris frond: pale impression with a dark rim, arching
    var c = P.SHALE3, r = P.SHALE0;
    for (var i = 0; i < len; i++) {
      var cx = x + Math.round(i * 0.9 * dir), cy = y - i + Math.round(i * i * 0.018);
      px(g, cx, cy, c);
      if (i > 1 && i < len - 1 && i % 2 === 0) {
        var l = 3 - Math.floor(i / len * 2.5);
        for (var k = 1; k <= l; k++) { px(g, cx - k, cy + (k >> 1), c); px(g, cx + k, cy + (k >> 1), c); }
        px(g, cx - l - 1, cy + (l >> 1), r); px(g, cx + l + 1, cy + (l >> 1), r);
      }
    }
  }
  function trilobite(g, x, y) {
    // 9 × 12, head shield, segmented thorax, three lobes
    ellipse(g, x, y, 4, 5, P.LIME3);
    hline(g, x - 4, x + 4, y - 3, P.LIME0); ellipse(g, x, y - 4, 4, 2, P.LIME3); // cephalon
    px(g, x - 2, y - 4, P.LIME0); px(g, x + 2, y - 4, P.LIME0);                   // eyes
    for (var s = -2; s <= 4; s += 2) hline(g, x - 3 + (s > 2 ? 1 : 0), x + 3 - (s > 2 ? 1 : 0), y + s, P.LIME1);
    vline(g, x - 1, y - 2, y + 4, P.LIME1); vline(g, x + 1, y - 2, y + 4, P.LIME1);
    px(g, x - 5, y - 3, P.LIME2); px(g, x + 5, y - 3, P.LIME2);                   // genal spines
    px(g, x - 6, y - 1, P.LIME2); px(g, x + 6, y - 1, P.LIME2);
  }
  function crinoid(g, x, y, n) {
    for (var i = 0; i < n; i++) { hline(g, x + i, x + i + 2, y - i * 2, P.LIME3); px(g, x + i + 1, y - i * 2 + 1, P.LIME0); }
  }
  function ribs(g, x, y) {
    // something big, lying on its side: a spine and nine ribs arcing down
    for (var v = 0; v < 13; v++) {
      var vx = x + v * 6, vy = y + Math.round(Math.sin(v * 0.35) * 2);
      rect(g, vx, vy, 4, 3, P.BONE_D); px(g, vx, vy, P.BONE); px(g, vx + 3, vy + 2, P.DEEP0);
      if (v > 1 && v < 11) {
        var rl = 13 + Math.round(Math.sin((v - 1) / 9 * Math.PI) * 9);
        for (var k = 0; k < rl; k++) {
          var a = k / rl, rx = vx + 1 + Math.round(a * 9 - a * a * 3), ry = vy + 3 + k;
          px(g, rx, ry, a < 0.85 ? P.BONE_D : P.DEEP3);
          if (k % 4 === 0) px(g, rx - 1, ry, P.BONE);
        }
      }
    }
  }
  function keys(g, x, y) {
    // a split ring with three keys and a paper tag, number worn off
    S.glowRing(g, x, y, 2, 2, 1, P.IRON3, 1);
    px(g, x, y - 3, P.IRON4);
    thick(g, x + 2, y + 2, x + 6, y + 6, 2, P.BRASS2); rect(g, x + 5, y + 6, 1, 2, P.BRASS2); px(g, x + 7, y + 6, P.BRASS2);
    line(g, x - 2, y + 2, x - 4, y + 8, P.IRON3); px(g, x - 5, y + 7, P.IRON3); px(g, x - 3, y + 8, P.IRON3);
    line(g, x, y + 3, x + 1, y + 9, P.BRASS1);
    rect(g, x - 9, y - 4, 5, 3, P.PAPER_D); px(g, x - 5, y - 3, P.IRON2); // tag
  }
  function dollArm(g, x, y) {
    // bisque pink, bent at the elbow, reaching up out of the rock
    thick(g, x, y, x + 4, y - 4, 2, '#d8a8a0'); thick(g, x + 4, y - 4, x + 5, y - 9, 2, '#e8c0b4');
    px(g, x + 4, y - 11, '#e8c0b4'); px(g, x + 6, y - 11, '#e8c0b4'); px(g, x + 5, y - 12, '#e8c0b4'); px(g, x + 7, y - 10, '#e8c0b4');
    px(g, x + 1, y, '#8a5a58'); px(g, x + 5, y - 5, '#fff0e8');
  }
  function ring(g, x, y) {
    px(g, x, y - 1, P.VEIN2); px(g, x - 1, y, P.VEIN1); px(g, x + 1, y, P.VEIN2); px(g, x, y + 1, P.VEIN0);
    px(g, x - 1, y - 1, P.VEIN3); px(g, x + 1, y + 1, P.VEIN1); px(g, x + 1, y - 1, P.VEIN2); px(g, x - 1, y + 1, P.VEIN1);
  }
  function pail(g, x, y, big) {
    // a round-shouldered dinner pail: water below, food above, a lid cup
    var w = big ? 10 : 8, h = big ? 9 : 7;
    rect(g, x - (w >> 1), y - h, w, h, P.IRON3);
    vline(g, x - (w >> 1), y - h, y - 1, P.IRON4); vline(g, x + (w >> 1) - 1, y - h, y - 1, P.IRON1);
    hline(g, x - (w >> 1), x + (w >> 1) - 1, y - h + 3, P.IRON1);
    hline(g, x - (w >> 1) + 1, x + (w >> 1) - 2, y - h - 1, P.IRON2);
    rect(g, x - 2, y - h - 3, 4, 2, P.IRON2);
    for (var a = 0; a <= 8; a++) px(g, Math.round(x - (w >> 1) + a / 8 * w), Math.round(y - h - 2 - Math.sin(a / 8 * Math.PI) * 4), P.IRON2);
    px(g, x + 1, y - 4, P.IRON1); px(g, x + 2, y - 3, P.IRON1); // a dent
  }
  function watch(g, x, y) {
    // hunter-case pocket watch, lid open, chain trailing into the coal
    disc(g, x, y, 3.6, P.BRASS2); disc(g, x, y, 2.6, P.PAPER);
    px(g, x - 1, y - 1, P.BRASS3); px(g, x - 3, y - 2, P.BRASS3);
    px(g, x, y - 4, P.BRASS3); px(g, x, y - 5, P.BRASS2);   // crown + bow
    for (var i = 0; i < 9; i++) px(g, x + 1 + i, y - 5 - (i % 2) - (i >> 2), i % 2 ? P.BRASS1 : P.BRASS2);
    // the open lid
    ellipse(g, x - 6, y, 1, 3, P.BRASS1); px(g, x - 6, y - 1, P.BRASS3);
  }
  function fish(g, x, y) {
    // the red cellophane fortune fish, curled at both ends: passionate
    var pts = [[0, 0], [1, 0], [2, -1], [3, -1], [4, -1], [5, -1], [6, 0], [7, 0], [8, -1], [8, -2]];
    for (var i = 0; i < pts.length; i++) {
      px(g, x + pts[i][0], y + pts[i][1], i % 3 === 1 ? P.FISH2 : P.FISH);
      px(g, x + pts[i][0], y + pts[i][1] + 1, P.FISH_D);
    }
    px(g, x - 1, y - 1, P.FISH); px(g, x - 1, y - 2, P.FISH2); // curled head
    px(g, x + 9, y - 3, P.FISH); px(g, x + 9, y - 1, P.FISH);   // curled tail fins
    px(g, x, y - 1, P.INK);                                     // the eye
    px(g, x + 3, y - 2, '#ffd0d0');                              // cellophane shine
  }
  function ledgers(g, x, y) {
    // the sealed room: half a brick wall (the section cuts it), inside it
    // ledgers, a strongbox and the payroll, all behind the bricks
    rect(g, x, y, 34, 18, P.VOID1);
    for (var by = 0; by < 18; by += 3) for (var bx = (by % 6 ? 0 : 3); bx < 34; bx += 6) {
      rect(g, x + bx, y + by, 5, 2, (bx + by) % 4 ? '#5a3228' : '#6e3e30');
      px(g, x + bx, y + by, '#86503c');
    }
    // the section cuts the wall away on the right: inside is dark
    rect(g, x + 10, y + 2, 22, 15, P.VOID0);
    // ledgers: three spines, one lying flat
    rect(g, x + 12, y + 8, 3, 8, '#3a2a4e'); rect(g, x + 15, y + 7, 3, 9, '#4e2226'); rect(g, x + 18, y + 9, 2, 7, '#2a3a2e');
    hline(g, x + 12, x + 14, y + 10, P.BRASS1); hline(g, x + 15, x + 17, y + 9, P.BRASS1); hline(g, x + 15, x + 17, y + 14, P.BRASS1);
    rect(g, x + 11, y + 16, 10, 1, '#3a2a1e');
    // strongbox
    rect(g, x + 22, y + 10, 9, 7, P.IRON2); hline(g, x + 22, x + 30, y + 10, P.IRON3); vline(g, x + 30, y + 10, y + 16, P.IRON1);
    rect(g, x + 25, y + 12, 3, 3, P.IRON1); px(g, x + 26, y + 13, P.BRASS2);
    // payroll envelope with its wax seal, propped on the box
    rect(g, x + 23, y + 6, 7, 4, P.PAPER_D); line(g, x + 23, y + 6, x + 26, y + 8, P.PAPER_DD); line(g, x + 29, y + 6, x + 26, y + 8, P.PAPER_DD);
    px(g, x + 26, y + 8, P.RED2);
    // the rest of the wall, the cut face shows bricks in section
    for (var yy = y; yy < y + 18; yy++) px(g, x + 32 + (yy % 3 === 0 ? 1 : 0), yy, '#6e3e30');
  }
  function ratCrack(g, x, y) {
    // a crack at the foot of the rock, black, the kind something lives in
    var pts = [[0, 0], [1, -1], [2, -1], [3, -2], [4, -2], [5, -3], [6, -3], [7, -4]];
    pts.forEach(function (p, i) { px(g, x + p[0], y + p[1], P.VOID0); if (i < 5) px(g, x + p[0], y + p[1] + 1, P.VOID0); });
    px(g, x - 1, y + 1, P.VOID1);
  }

  function initials(g, x, y) {
    // carved into a prop: R.L. + J.M. and a heart that did not come out right
    A.text(g, 'RL', x, y, P.TIM0); A.text(g, '+', x + 2, y + 6, P.TIM0); A.text(g, 'JM', x, y + 12, P.TIM0);
  }


  function payroll(g, x, y) {
    // a bundle of pay envelopes, string-tied, a red wax seal
    rect(g, x - 5, y - 3, 10, 6, P.PAPER_D); rect(g, x - 4, y - 4, 10, 6, P.PAPER);
    line(g, x - 4, y - 4, x + 1, y - 1, P.PAPER_DD); line(g, x + 5, y - 4, x + 1, y - 1, P.PAPER_DD);
    vline(g, x + 3, y - 4, y + 1, P.BONE_D); hline(g, x - 4, x + 5, y, P.BONE_D);
    px(g, x + 1, y - 1, P.RED2); px(g, x + 2, y - 1, P.RED1); px(g, x + 1, y, P.RED1);
    A.text(g, '$', x - 3, y - 3, P.PAPER_DD);
  }
  function strongbox(g, x, y) {
    rect(g, x - 6, y - 5, 12, 9, P.IRON2); hline(g, x - 6, x + 5, y - 5, P.IRON3); vline(g, x + 5, y - 5, y + 3, P.IRON1);
    hline(g, x - 6, x + 5, y - 2, P.IRON1); rect(g, x - 1, y - 1, 3, 3, P.IRON1); px(g, x, y, P.BRASS2);
    // the padlock, rusted shut
    rect(g, x - 1, y + 2, 3, 3, P.RUST); px(g, x - 1, y + 1, P.IRON3); px(g, x + 1, y + 1, P.IRON3); px(g, x, y + 3, P.RUST2);
    px(g, x - 5, y - 4, P.IRON4);
  }
  function ledgerRoom(g, x, y) {
    // the sealed alcove: half a brick wall (the section cuts it), ledgers
    // behind it, 1921 to 1923, spines that say so
    rect(g, x - 14, y - 12, 28, 16, P.VOID1);
    for (var by = 0; by < 16; by += 3) for (var bx = (by % 6 ? 0 : 3); bx < 28; bx += 6) {
      if (bx > 8 && by > 1 && by < 14) continue;
      rect(g, x - 14 + bx, y - 12 + by, 5, 2, (bx + by) % 4 ? '#5a3228' : '#6e3e30'); px(g, x - 14 + bx, y - 12 + by, '#86503c');
    }
    rect(g, x - 5, y - 10, 18, 12, P.VOID0);
    rect(g, x - 4, y - 7, 3, 9, '#3a2a4e'); rect(g, x - 1, y - 8, 3, 10, '#4e2226'); rect(g, x + 2, y - 6, 3, 8, '#2a3a2e');
    hline(g, x - 4, x - 2, y - 5, P.BRASS1); hline(g, x - 1, x + 1, y - 6, P.BRASS1); hline(g, x + 2, x + 4, y - 4, P.BRASS1);
    rect(g, x + 6, y - 2, 6, 4, '#3a2a1e'); hline(g, x + 6, x + 11, y - 2, '#5a4430'); // one lying flat
  }

  function decor(board, kind) { var d = board.decor || []; for (var i = 0; i < d.length; i++) if (d[i].kind === kind) return d[i]; return null; }
  function decorAll(board, kind) { return (board.decor || []).filter(function (d) { return d.kind === kind; }); }
  function pinsOf(board, dress) { return (board.fixtures || []).filter(function (f) { return f.kind === 'pin' && (!dress || f.dress === dress); }); }

  // specimen painters by `what`
  /* ── specimens drawn as sprites: authored at 1:1, a dark outline baked
   * round them so they separate from any rock under the curator's spot ── */
  function outlined(c, col) {
    var w = c.width, h = c.height, g = c.getContext('2d'), im = g.getImageData(0, 0, w, h), d = im.data, o = A.rgb(col || '#0a080c');
    var mark = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x; if (d[i * 4 + 3]) continue;
      if ((x > 0 && d[(i - 1) * 4 + 3]) || (x < w - 1 && d[(i + 1) * 4 + 3]) || (y > 0 && d[(i - w) * 4 + 3]) || (y < h - 1 && d[(i + w) * 4 + 3])) mark[i] = 1;
    }
    for (i = 0; i < w * h; i++) if (mark[i]) { d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 230; }
    g.putImageData(im, 0, 0);
    return c;
  }
  // rows of characters → a sprite (with a 1-px margin for the outline)
  function ascii(rows, pal) {
    var h = rows.length, w = 0;
    for (var j = 0; j < h; j++) w = Math.max(w, rows[j].length);
    var c = A.makeCanvas(w + 2, h + 2), g = c.getContext('2d');
    for (j = 0; j < h; j++) for (var i = 0; i < rows[j].length; i++) { var ch = rows[j][i]; if (pal[ch]) px(g, i + 1, j + 1, pal[ch]); }
    return outlined(c);
  }
  function stampAt(g, c, x, y) { g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); }
  // Fig. 1: a split ring and three keys, a brass skeleton key, a steel
  // house key and a little brass one, and a paper tag, number worn off
  var KEYS = ascii([
    '......AAa........',
    '......A.aaAAAAAa.',
    '..RRR.aab....bb..',
    '.R...r.......b.b.',
    '.R...rSSs........',
    '.R...rS.sSSSSSSSs',
    '..rrr.sst..t.tt..',
    '...k.aAb.........',
    '...k.A.b.........',
    '.TTTTabbb........',
    '.TuuT....ab......',
    '.TTTT.....aab....',
    '...........b.....'
  ], { R: '#d4d8e4', r: '#6a6e7e', A: '#f4e2a0', a: '#caa24a', b: '#7a5a22', S: '#eef2f8', s: '#a0a6b6', t: '#4e5262', T: '#e2d6b0', u: '#9a8a60', k: '#8a7e68' });
  // Fig. 4: a trilobite, surprised (two round white eyes)
  var TRILO = ascii([
    '....ccccc....',
    '..cCCCCCCCc..',
    '.cCWWCCCWWCc.',
    '.cCWKCeCKWCc.',
    'cCCCCCeCCCCCc',
    'dddddcecddddd',
    'd.cCCdedCCc.d',
    'd.dddcecddd.d',
    'd..cCdedCc..d',
    '...ddcecdd...',
    '...cCdedCc...',
    '...ddcecdd...',
    '....cdedc....',
    '....dcecd....',
    '.....ccc.....',
    '......d......'
  ], { C: '#e6dcc4', c: '#b4aa90', d: '#6e6452', e: '#d0c6ac', W: '#ffffff', K: '#231d1a' });
  // Fig. 11: the strongbox, a brass lock plate, riveted bands, rusted shut
  var BOX = ascii([
    '....kkkkkk.....',
    '....k....k.....',
    'IIIIIIIIIIIIIII',
    'IiiiiiiiiiiiiiD',
    'BoBBBBBBBBBBBoB',
    'iiiiiLLLLLiiiiD',
    'iiiRiLlKlLiiiiD',
    'BoBBBLlKlLBBBoB',
    'iiiiiLLLLLiRiiD',
    'iiiiiiiiiiiiiiD',
    'DDDDDDDDDDDDDDD'
  ], { I: '#9a9aae', i: '#5e5e72', D: '#2c2c36', B: '#7a7a92', o: '#c4c4d8', L: '#f0cc6a', l: '#a8843c', K: '#141016', k: '#8a8aa0', R: '#8a4a24' });
  // Fig. 2: a seed fern (Neuropteris): a pale impression in the dark shale,
  // an arching midrib, blunt leaflets alternating, smaller to the tip
  function fernSprite() {
    var W = 26, H = 21, c = A.makeCanvas(W, H), g = c.getContext('2d');
    var LEAF = '#aab4ca', TIP = '#7e8aa8', RIB = '#d4dcea';
    // a frond: a midrib arching over, leaflets (one pixel, a drooping tip)
    // alternating left and right with a gap between each: pinnate, readable
    function frond(x0, y0, len, dir, lean, reach) {
      for (var i = 0; i < len; i++) {
        var u = i / len, nx = Math.round(x0 + i * dir * 0.55), ny = Math.round(y0 - i + i * i * lean);
        px(g, nx, ny, RIB);
        if (i >= 1 && i < len - 1 && i % 2 === 1) {
          var side = ((i - 1) / 2) % 2 ? 1 : -1, L = Math.max(1, Math.round(reach * (1 - u * 0.8)));
          for (var k = 1; k <= L; k++) px(g, nx + side * k, ny + (k === L && L > 1 ? 1 : 0), k === L ? TIP : LEAF);
        }
      }
    }
    frond(10, 20, 19, 1, 0.014, 5);
    frond(16, 20, 12, -1, 0.03, 4);
    return outlined(c, '#161a28');
  }
  // Fig. 3: the company plaque: THIS SEAM OPENED BY the name, gouged away
  // (ghost letters under the scratches, never legible), COAL & LAND below
  function plaqueSprite() {
    var W = 45, H = 17, c = A.makeCanvas(W, H), g = c.getContext('2d'), x = 1, y = 1, w = 43, h = 15;
    rect(g, x, y, w, h, P.BRASS1); rect(g, x + 1, y + 1, w - 2, h - 2, P.BRASS3);
    hline(g, x + 1, x + w - 2, y + 1, P.BRASS4); vline(g, x + 1, y + 1, y + h - 2, P.BRASS4);
    hline(g, x + 1, x + w - 2, y + h - 2, P.BRASS2); vline(g, x + w - 2, y + 2, y + h - 2, P.BRASS2);
    // the name: cast in once, then gouged many times by different tools.
    // What's left under the gouges is debris of letters (a stem, a bowl's
    // shoulder, half a crossbar), seeded strokes in nine letter cells: no name
    // was ever set here, so there is none to find (WORLD.md: never legible)
    var STROKES = [[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], [[0, 0], [1, 0], [2, 0]],
      [[0, 2], [1, 2], [2, 2]], [[0, 4], [1, 4], [2, 4]], [[0, 0], [1, 1], [1, 2], [2, 3], [2, 4]], [[2, 0], [1, 1], [1, 2], [0, 3], [0, 4]],
      [[1, 0], [0, 1], [0, 2], [0, 3], [1, 4]], [[1, 0], [2, 1], [2, 2], [1, 2]]];
    for (var cell = 0; cell < 9; cell++) {
      var cx0 = x + 4 + cell * 4, cy0 = y + 3, n0 = 1 + (A.hash01(313, cell, 1) < 0.6 ? 1 : 0);
      for (var sk = 0; sk < n0; sk++) {
        var st = STROKES[Math.floor(A.hash01(313, cell, 2 + sk) * STROKES.length)];
        for (var sp = 0; sp < st.length; sp++) if (A.hash01(313, cell * 16 + sk * 5 + sp, 9) > 0.3) px(g, cx0 + st[sp][0], cy0 + st[sp][1], P.BRASS1);
      }
    }
    for (var i = 0; i < 22; i++) {
      var sx = x + 3 + ((i * 7) % 36), sy = y + 3 + (i % 3) * 2;
      A.line(g, sx, sy, sx + 2 + (i % 3), sy + 1 + (i % 2), i % 3 ? P.BRASS0 : P.BRASS4);
    }
    A.text(g, 'COAL&LAND', x + 4, y + 9, P.BRASS0);
    px(g, x + 2, y + 2, P.IRON1); px(g, x + w - 3, y + 2, P.IRON1); px(g, x + 2, y + h - 3, P.IRON1); px(g, x + w - 3, y + h - 3, P.IRON1);
    return outlined(c);
  }
  var FERN = null, PLAQUE = null;
  var SPEC = {
    keys: function (g, x, y) { stampAt(g, KEYS, x, y); },
    fern: function (g, x, y) { stampAt(g, FERN || (FERN = fernSprite()), x, y); },
    plaque: function (g, x, y) { stampAt(g, PLAQUE || (PLAQUE = plaqueSprite()), x, y); },
    trilobite: function (g, x, y) { stampAt(g, TRILO, x, y); crinoid(g, x + 11, y + 8, 4); crinoid(g, x - 22, y + 6, 3); },
    payroll: payroll, dollarm: function (g, x, y) { dollArm(g, x - 3, y + 6); }, watch: watch, ring: ring,
    ribs: function (g, x, y) { paintRibs(g, x, y); }, ledgers: ledgerRoom,
    strongbox: function (g, x, y) { stampAt(g, BOX, x, y - 1); },
    fish: fish
  };
  // the curator's spot for each (rx, ry): a disc that takes in the specimen and its tag
  var SPOT = { keys: [13, 11], fern: [16, 13], plaque: [26, 13], trilobite: [12, 13], payroll: [11, 10], dollarm: [11, 12],
    watch: [11, 10], ring: [9, 8], ribs: [24, 17], ledgers: [18, 13], strongbox: [12, 11], fish: [11, 8] };

  // where to put a numbered marker so it sits clear of the pins
  function placeTag(pins, taken, ax, ay, w, h, cands) {
    var best = null, bs = -1;
    for (var i = 0; i < cands.length; i++) {
      var x = Math.round(ax + cands[i][0]), y = Math.round(ay + cands[i][1]);
      if (x < 2 || y < 66 || x + w > GW - 2 || y + h > 384) continue;
      var s = 99;
      for (var k = 0; k < pins.length; k++) {
        var dx = Math.max(x - pins[k].x, 0, pins[k].x - (x + w)), dy = Math.max(y - pins[k].y, 0, pins[k].y - (y + h));
        s = Math.min(s, Math.hypot(dx, dy));
      }
      for (k = 0; k < taken.length; k++) { var T = taken[k]; if (x < T.x + T.w + 2 && x + w + 2 > T.x && y < T.y + T.h + 2 && y + h + 2 > T.y) s = -1; }
      s -= i * 0.15;
      if (s > bs) { bs = s; best = { x: x, y: y, w: w, h: h }; }
    }
    if (best) taken.push(best);
    return best;
  }
  // a specimen's footprint (for its tag and the markers to keep clear of)
  var SPECBOX = { keys: [19, 15], fern: [26, 20], plaque: [45, 17], trilobite: [15, 18], payroll: [12, 9], dollarm: [10, 14],
    watch: [15, 12], ring: [5, 5], ribs: [90, 48], ledgers: [30, 18], strongbox: [17, 13], fish: [13, 6] };
  // where a figure's tag may hang: just off its edges, close enough to share its spot
  function tagCands(hw, hh, w) {
    return [[hw + 2, -hh - 4], [-hw - 2 - w, -hh - 4], [hw + 2, hh - 3], [-hw - 2 - w, hh - 3], [hw + 3, -3], [-hw - 3 - w, -3],
      [-(w >> 1), -hh - 9], [-(w >> 1), hh + 2], [hw + 6, -hh - 8], [-hw - 6 - w, hh]];
  }
  var CANDS = [[8, -10], [-16, -10], [8, 5], [-16, 5], [12, -3], [-20, -3], [-4, -14], [-4, 8], [16, -12], [-24, 6]];
  // a figure tag: a card chip on a thread, in the rock's own light (the
  // curator's spot lights it with the specimen, and it stays quieter)
  function figTag(g, n, t, ax, ay) {
    line(g, ax, ay, t.x + (t.w >> 1), t.y + (ay < t.y ? 0 : t.h - 1), '#8a7e68');
    rect(g, t.x, t.y, t.w, t.h, P.PAPER_D); hline(g, t.x, t.x + t.w - 1, t.y + t.h - 1, P.PAPER_DD); hline(g, t.x, t.x + t.w - 1, t.y, '#cdbd8e');
    A.text(g, String(n), t.x + 2, t.y + 1, P.INK);
  }
  // an exhibit marker (the legend's numbers): a round black enamel roundel
  // with a brass rim and a bone numeral: a different shape from a tag
  function exhibitMarker(g, n, t, scratched) {
    var w = t.w, h = t.h, x = t.x, y = t.y;
    // the rim (a disc for one figure, a pill for two)
    hline(g, x + 2, x + w - 3, y - 1, P.BRASS2); hline(g, x + 2, x + w - 3, y + h, P.BRASS1);
    vline(g, x - 1, y + 2, y + h - 3, P.BRASS2); vline(g, x + w, y + 2, y + h - 3, P.BRASS1);
    px(g, x, y, P.BRASS3); px(g, x + 1, y, P.BRASS2); px(g, x, y + 1, P.BRASS2); px(g, x + w - 1, y, P.BRASS2); px(g, x + w - 1, y + h - 1, P.BRASS1); px(g, x, y + h - 1, P.BRASS1);
    rect(g, x + 1, y, w - 2, h, P.INK); rect(g, x, y + 1, w, h - 2, P.INK);
    A.text(g, String(n), x + 2, y + 1, P.BONE);
    if (scratched) for (var k = 0; k < w; k++) { px(g, x + k, y + 2 + (k % 3), '#8a8278'); px(g, x + k, y + 4 - (k % 2), '#6a6258'); }
  }

  /* ══ lamps ═════════════════════════════════════════════════════════ */
  function buildLamps(board, g) {
    var out = [], ls = decorAll(board, 'lamp');
    ls.forEach(function (L, i) {
      var electric = L.region === 'haulage';
      var lamp = { x: L.x, y: L.y + 3, r: electric ? 64 : 58, c: electric ? '#ffe0a0' : P.LAMP, k: electric ? 1.05 : 1.15, region: L.region, kind: electric ? 'bulb' : 'lantern', seed: 100 + i, flame: true };
      if (electric) {
        // a caged bulb hanging on its cable
        var by = L.y - 5;
        vline(g, L.x, by - 5, by, P.IRON1);
        rect(g, L.x - 1, by, 3, 4, P.IRON2); px(g, L.x - 2, by + 1, P.IRON2); px(g, L.x + 2, by + 1, P.IRON2);
        hline(g, L.x - 1, L.x + 1, by + 4, P.IRON3);
        lamp.fx = L.x; lamp.fy = by + 2; lamp.y = by + 3;
      } else {
        // a tin lantern on a spad in the roof
        vline(g, L.x, L.y - 4, L.y - 1, P.IRON2);
        rect(g, L.x - 2, L.y, 5, 6, P.IRON2); hline(g, L.x - 2, L.x + 2, L.y, P.IRON3); hline(g, L.x - 1, L.x + 1, L.y - 1, P.IRON3);
        rect(g, L.x - 1, L.y + 1, 3, 4, '#5a4a30');
        lamp.fx = L.x; lamp.fy = L.y + 3;
      }
      out.push(lamp);
    });
    // the haulage bulbs share a sagging cable along the roof
    var hb = out.filter(function (l) { return l.kind === 'bulb'; }).sort(function (a, b) { return a.x - b.x; });
    for (var i = 0; i < hb.length - 1; i++) for (var x = hb[i].x; x < hb[i + 1].x; x++) {
      var u = (x - hb[i].x) / (hb[i + 1].x - hb[i].x);
      px(g, x, Math.round(hb[i].fy - 8 + Math.sin(u * Math.PI) * 2), '#141218');
    }
    // the bays' work lights (the company wants you to see what you won)
    [[40, 388], [177, 386], [268, 388]].forEach(function (b, i) {
      out.push({ x: b[0], y: b[1] + 4, r: 34, c: '#ffe0a0', region: 'payout', kind: 'bulb', seed: 200 + i, flame: true, fx: b[0], fy: b[1] + 2 });
      rect(g, b[0] - 1, b[1], 3, 3, P.IRON2); px(g, b[0], b[1] + 2, P.BONE);
    });
    // a lantern at the vein, and the one by the ribs that nobody lights
    out.push({ x: 214, y: 336, r: 52, c: P.LAMP, region: 'vein', kind: 'lantern', seed: 210, flame: true, fx: 214, fy: 335 });
    rect(g, 212, 332, 5, 6, P.IRON2); rect(g, 213, 333, 3, 4, '#5a4a30'); vline(g, 214, 327, 331, P.IRON2);
    // the case light spilling over the grass into the soil (no flame)
    return out;
  }

  /* ══ the still life: the crew, mid-job ═════════════════════════════ */
  function stillLife(board) {
    var d = Math.PI / 180, POS = A.POSES || {};
    var pins = (board.fixtures || []).filter(function (f) { return f.kind === 'pin'; });
    function pose(name, extra) { var p = {}, b = POS[name] || {}; for (var k in b) p[k] = b[k]; for (k in extra || {}) p[k] = extra[k]; return p; }
    // stand a knocker on a floor near x: on a piece (never over a hole),
    // where the fewest pins would cross him
    function place(fig, fid, x0, span) {
      var f = (board.floors || []).filter(function (q) { return q.id === fid; })[0];
      var best = null, bs = 1e9;
      for (var x = x0 - span; x <= x0 + span; x++) {
        var y;
        if (fid === 'surface') y = SURF;
        else {
          if (!f) break;
          y = floorTopAt(f, x); var yl = floorTopAt(f, x - 6), yr = floorTopAt(f, x + 6);
          if (y == null || yl == null || yr == null) continue;
          y = Math.round(Math.min(y, (yl + yr) / 2));
        }
        fig.x = x; fig.y = y;
        var bx = A.figureBox(fig), n = 0;
        pins.forEach(function (p) { if (p.x > bx.x - 2 && p.x < bx.x + bx.w + 2 && p.y > bx.y - 2 && p.y < bx.y + bx.h) n++; });
        var sc = n * 10 + Math.abs(x - x0) * 0.2;
        if (sc < bs) { bs = sc; best = { x: x, y: y }; }
      }
      if (best) { fig.x = best.x; fig.y = best.y; }
      return fig;
    }
    return [
      // Absalom on the grass by the headframe, pointing up at the sheave as if it were his idea
      place({ facing: 1, who: 'tall', pose: pose('point', { armR: 145 * d, head: -25 * d }), tool: null }, 'surface', 54, 14),
      // Ezra at the haulage face, the pick up
      place({ facing: 1, who: 'pick', pose: pose('swingUp'), tool: 'pick' }, 'floorA', 176, 26),
      // Tobias in the ventilation road with the big lantern, by the door
      place({ facing: 1, who: 'lamp', pose: pose('lamp'), tool: 'lantern' }, 'floorB', 150, 22),
      // Old Jory in the workings, bent over his cane, looking at something on the floor
      place({ facing: -1, who: 'old', pose: pose('lean', { head: 20 * d, armR: 22 * d }), tool: 'cane' }, 'floorC', 140, 22),
      // Pip at the lip of the sump with the shovel, digging for nothing, hard
      place({ facing: -1, who: 'little', pose: pose('swingDn', { armR: 45 * d, armL: 35 * d, toolA: 20 * d }), tool: 'shovel' }, 'floorC', 84, 16),
      // Mr. Pengelly on the surface by the houses, keeping count
      place({ facing: -1, who: 'tally', pose: pose('hold', { armR: 70 * d, head: 25 * d }), tool: 'tally' }, 'surface', 238, 16)
    ];
  }

  /* ══ live parts: wheels and the cart ═══════════════════════════════ */
  A.drawWheel = function (g, f, pose, t) {
    var x = f.x, y = f.y, segs = pose.segs || [];
    if (f.dress === 'sheave') {
      // the rim, the spokes (the paddles), the hub; rope over the top
      for (var a = 0; a < 64; a++) {
        var an = a / 64 * Math.PI * 2, rx = Math.round(x + Math.cos(an) * f.r), ry = Math.round(y + Math.sin(an) * f.r);
        px(g, rx, ry, an > Math.PI * 0.9 && an < Math.PI * 1.7 ? P.IRON4 : P.IRON2);
        px(g, Math.round(x + Math.cos(an) * (f.r - 1)), Math.round(y + Math.sin(an) * (f.r - 1)), P.IRON1);
      }
      segs.forEach(function (s) { line(g, s[0][0], s[0][1], s[1][0], s[1][1], P.IRON3); });
      disc(g, x + 0.5, y + 0.5, f.hub, P.IRON3); px(g, Math.round(x) - 1, Math.round(y) - 1, P.IRON4);
      // the hoist rope: down the shaft on the left, off to the hoist house on the right
      line(g, x - f.r + 1, y, x - f.r + 1, 66, '#1a1418');
      line(g, x + 2, y - f.r - 1, 140, 54, '#1a1418');
    } else if (f.dress === 'door') {
      // the ventilation door: planks on a strap hinge, swinging in the draught
      var s = segs[0]; if (!s) return;
      var ang = Math.atan2(s[1][1] - y, s[1][0] - x), ca = Math.cos(ang), sa = Math.sin(ang);
      for (var k = 0; k <= f.r; k++) for (var w = -2; w <= 2; w++) {
        var X = Math.round(x + ca * k - sa * w), Y = Math.round(y + sa * k + ca * w);
        px(g, X, Y, w === -2 ? P.TIM4 : w === 2 ? P.TIM1 : (k % 4 === 0 ? P.TIM1 : P.TIM3));
      }
      thick(g, x, y, x + ca * 4, y + sa * 4, 1, P.IRON3);
      // the lintel it hangs from
      rect(g, Math.round(x) - 7, Math.round(y) - 2, 15, 2, P.TIM2); hline(g, Math.round(x) - 7, Math.round(x) + 7, Math.round(y) - 2, P.TIM4);
    } else {
      // the sump's pump wheel: wooden paddles on an iron hub, a rim ring
      for (a = 0; a < 80; a++) {
        an = a / 80 * Math.PI * 2;
        if (a % 3) px(g, Math.round(x + Math.cos(an) * (f.r - 2)), Math.round(y + Math.sin(an) * (f.r - 2)), P.TIM1);
      }
      segs.forEach(function (s) {
        thick(g, s[0][0], s[0][1], s[1][0], s[1][1], 2, P.TIM3);
        px(g, Math.round(s[1][0]), Math.round(s[1][1]), P.END);
      });
      disc(g, x + 0.5, y + 0.5, f.hub, P.IRON2); px(g, Math.round(x) - 1, Math.round(y) - 1, P.IRON4);
    }
  };
  A.drawCart = function (g, f, pose, t) {
    if (!pose) return;
    var p = pose.pose, pts = pose.pts, wy = Math.round(f.y) - 2;
    // wheels and chassis stay on the track
    var wl = Math.round(p.x - f.w / 2 + 4), wr = Math.round(p.x + f.w / 2 - 4);
    hline(g, wl, wr, wy - 1, P.IRON1);
    [wl, wr].forEach(function (wx) { disc(g, wx + 0.5, wy + 0.5, 2.2, P.IRON1); px(g, wx, wy, P.IRON3); px(g, wx - 1, wy - 1, P.IRON4); });
    // the tub: fill the (possibly tipped) quad
    var minx = Math.floor(Math.min(pts[0][0], pts[1][0], pts[2][0], pts[3][0])), maxx = Math.ceil(Math.max(pts[0][0], pts[1][0], pts[2][0], pts[3][0]));
    var miny = Math.floor(Math.min(pts[0][1], pts[1][1], pts[2][1], pts[3][1])), maxy = Math.ceil(Math.max(pts[0][1], pts[1][1], pts[2][1], pts[3][1]));
    function inside(x, y) {
      var s = 0;
      for (var i = 0; i < 4; i++) { var a = pts[i], b = pts[(i + 1) % 4]; var c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); s += c > 0 ? 1 : c < 0 ? -1 : 0; }
      return Math.abs(s) === 4;
    }
    for (var y = miny; y <= maxy; y++) for (var x = minx; x <= maxx; x++) if (inside(x + 0.5, y + 0.5)) {
      var ey = (y - miny) / Math.max(1, maxy - miny);
      px(g, x, y, ey < 0.2 ? P.IRON3 : ey > 0.8 ? P.IRON1 : ((x + y) % 7 === 0 ? P.RUST : P.IRON2));
    }
    // the rim, rivets, the painted number
    line(g, pts[0][0], pts[0][1], pts[3][0], pts[3][1], P.IRON4);
    if (Math.abs(p.tilt) < 0.2) {
      for (var r = 0; r < 4; r++) px(g, Math.round(pts[0][0] + 2 + r * 6), Math.round(pts[0][1] + 2), P.IRON4);
      A.text(g, '4', Math.round(p.x - 1), Math.round(pts[0][1] + 3), P.BONE_D);
      // a heap of coal riding on top (gone when she tips)
      for (x = Math.round(pts[0][0]) + 2; x < Math.round(pts[3][0]) - 1; x++) {
        var hh = Math.round(Math.sin((x - pts[0][0]) / (pts[3][0] - pts[0][0]) * Math.PI) * 3);
        for (var k = 0; k < hh; k++) px(g, x, Math.round(pts[0][1]) - 1 - k, A.hash01(33, x, k) < 0.3 ? P.COAL3 : P.COAL1);
      }
    } else if (p.dumping) {
      // coal pouring off the lip
      var lip = pts[3];
      for (k = 0; k < 8; k++) px(g, Math.round(lip[0] + 1 + (k % 2)), Math.round(lip[1] + k * 1.5), k % 3 ? P.COAL2 : P.COAL3);
    }
  };

  /* (the case light and the vignette live in the renderer's light model now) */

  /* ══ paintMine ═════════════════════════════════════════════════════
   * Most of the section can't be changed by the crew's drift: the painted
   * sky, the strata and the galleries cut in them, the ground, the vein and
   * the specimens, the bays, the timbering. Those are painted once a visit
   * (keyed by what they depend on) and stamped; a build after a TOCK only
   * repaints what drift CAN move (pins, the brace, a mouth, the pail, a heap). */
  function makeLayer() { var c = A.makeCanvas(GW, GH); return { c: c, g: c.getContext('2d') }; }
  var STATIC = { key: null }, SHAFTS = { key: null }, BAYS = { key: null }, RAILS = { key: null };
  var ALB = null, FORE = null;
  function staticKey(board) {
    var fl = (board.floors || []).map(function (f) { return [f.id, f.y, f.x0, f.x1, (f.openings || []).map(function (o) { return o.x + '/' + o.w; }).join(','), (f.pieces || []).length].join(':'); }).join(';');
    var faces = (board.fixtures || []).filter(function (f) { return (f.kind === 'rail' && f.dress === 'face') || (f.kind === 'tunnel' && f.dress === 'door'); })
      .map(function (f) { return f.kind === 'rail' ? [f.x1, f.y1, f.x2, f.y2].join(',') : [f.a.x, f.a.y, f.a.r].join(','); }).join(';');
    return fl + '|' + faces + '|' + JSON.stringify(board.decor || []) + '|' + (board.regions || []).length;
  }
  function staticLayers(board) {
    var key = staticKey(board);
    if (STATIC.key === key) return STATIC;
    // (the under layer is read back once, by paintSection; makeLayer made its context already)
    var U = makeLayer(), O = makeLayer();
    var g = U.g;
    var gals = galleries(board);
    paintBackdrop(g, board);
    var em = paintTrainAndTown(g);
    paintSection(g, board, gals);
    paintGround(g, board, em);
    paintWorkings(g, board, gals);
    paintSills(g);
    // coal glints in the seams
    var glints = [], R = A.rng(0x61147);
    for (var i = 0; i < 1400 && glints.length < 110; i++) {
      var x = (R() * GW) | 0, y = (SURF + 10 + R() * (320 - SURF)) | 0, k = A.bandAt(x, y);
      if (k === 'coalA' || k === 'coalB' || k === 'coalC') glints.push({ x: x, y: y, ph: R() * 6.28, rate: 0.5 + R() * 1.6, c: R() < 0.2 ? P.GLINT : P.GLINT_D });
    }
    // over the shafts: the vein, the rat's crack, the specimens
    var og = O.g;
    paintVein(og, board, glints);
    var specs = decorAll(board, 'specimen').slice();
    var maxFig = specs.reduce(function (m, s) { return Math.max(m, s.fig || 0); }, 0);
    specs.push({ kind: 'specimen', what: 'fish', x: 188, y: 289, fig: maxFig + 1, label: 'Fig. ' + (maxFig + 1) + ': fish, red, curled both ends', art: true });
    var out = { watch: null, ring: null, moth: null, rat: null };
    // the moth's lantern (the ventilation road's first) and the rat's crack,
    // at the foot of the wall beside the office door
    var vl = decorAll(board, 'lamp').filter(function (l) { return l.region === 'ventilation'; })[0];
    if (vl) out.moth = { x: vl.x, y: vl.y - 1, region: vl.region };
    var od = (board.fixtures || []).filter(function (f) { return f.kind === 'tunnel' && f.dress === 'door'; })[0];
    var fB = (board.floors || []).filter(function (f) { return f.id === 'floorB'; })[0];
    if (od && fB) {
      var rx = Math.round(od.a.x - (od.a.r || 7) - 6), ry = Math.round((floorTopAt(fB, rx) || fB.y) - 3);
      ratCrack(og, rx - 7, ry + 1); out.rat = { x: rx - 7, y: ry + 1 };
    }
    specs.forEach(function (s) {
      // (the red fish is painted live by pachinko-art-secrets.js when it's loaded: it can be warmed)
      var fn = SPEC[s.what]; if (fn && !(s.what === 'fish' && A.liveFish)) fn(og, s.x, s.y);
      if (s.what === 'watch') out.watch = { x: s.x, y: s.y, a0: 0.7 };
      if (s.what === 'ring') out.ring = { x: s.x, y: s.y };
    });
    STATIC = { key: key, under: U.c, over: O.c, em: em, glints: glints, specs: specs, out: out,
      gals: gals.map(function (G) { return { x0: G.x0, x1: G.x1, top: G.top, y: G.floor.y, id: G.id }; }) };
    return STATIC;
  }
  function shaftLayer(board) {
    var sh = findShafts(board), key = JSON.stringify(sh);
    if (SHAFTS.key === key) return SHAFTS.c;
    var L = makeLayer(); paintShafts(L.g, board, sh);
    SHAFTS = { key: key, c: L.c };
    return L.c;
  }
  function bayLayers(board) {
    var slots = (board.fixtures || []).filter(function (f) { return f.kind === 'slot'; });
    var key = JSON.stringify(slots.map(function (s) { return [s.id, s.x0, s.x1, s.value, s.label, s.dress]; }));
    if (BAYS.key !== key) {
      var La = makeLayer(), Lf = makeLayer();
      drawBays(La.g, Lf.g, board);
      BAYS = { key: key, a: La.c, f: Lf.c, cards: A.bayCards };
    }
    A.bayCards = {};
    for (var id in BAYS.cards) A.bayCards[id] = BAYS.cards[id];
    return BAYS;
  }
  function railLayer(board) {
    var rails = (board.fixtures || []).filter(function (f) { return f.kind === 'rail'; });
    var key = JSON.stringify(rails.map(function (r) { return [r.x1, r.y1, r.x2, r.y2, r.dress, r.r]; }));
    if (RAILS.key === key) return RAILS.c;
    var L = makeLayer();
    rails.forEach(function (f) { drawRail(L.g, f); });
    RAILS = { key: key, c: L.c };
    return L.c;
  }
  A.paintMine = function (board) {
    var st = staticLayers(board);
    if (!ALB) { ALB = makeLayer(); FORE = makeLayer(); }
    var c = ALB.c, g = ALB.g, fore = FORE.c, fg = FORE.g;
    g.clearRect(0, 0, GW, GH); fg.clearRect(0, 0, GW, GH);
    g.drawImage(st.under, 0, 0);
    paintFence(g, board);
    g.drawImage(shaftLayer(board), 0, 0);
    g.drawImage(st.over, 0, 0);
    var glints = st.glints.slice(), specs = st.specs, out = st.out;
    // tunnels, pockets, bays, rails
    var fs = board.fixtures || [];
    fs.forEach(function (f) { if (f.kind === 'tunnel') drawTunnelMouth(g, f); });
    var B = bayLayers(board);
    g.drawImage(B.a, 0, 0); fg.drawImage(B.f, 0, 0);
    g.drawImage(railLayer(board), 0, 0);
    fs.forEach(function (f) { if (f.kind === 'pocket') drawPocket(fg, f, board); });
    var lamps = buildLamps(board, g);
    // markers: exhibits (black roundels) and figures (bone tags)
    var pins = fs.filter(function (f) { return f.kind === 'pin' && !f.buried; }), taken = [], tagAt = {}, markers = {};
    var zone = decor(board, 'cardzone'); if (zone) taken.push({ x: zone.x, y: zone.y, w: zone.w, h: zone.h });
    // the specimens themselves: nothing is pinned over one
    specs.forEach(function (s) { var b = SPECBOX[s.what] || [10, 10]; taken.push({ x: s.x - (b[0] >> 1), y: s.y - (b[1] >> 1), w: b[0], h: b[1] }); });
    (board.legend || []).forEach(function (e) {
      if (e.slot) return;
      var ref = (board.byId && board.byId[e.ref]) || fs.filter(function (f) { return f.id === e.ref; })[0], ax, ay;
      if (ref) { ax = ref.kind === 'tunnel' ? ref.a.x : ref.kind === 'cart' ? ref.x1 - 8 : ref.x; ay = ref.kind === 'tunnel' ? ref.a.y : ref.y; }
      else { var rg = (board.regions || []).filter(function (r) { return r.id === e.ref; })[0]; if (!rg) return; ax = rg.x + rg.w * 0.42; ay = rg.y + rg.h / 2; }
      var w = A.textW(String(e.n)) + 4, t = placeTag(pins, taken, ax, ay, w, 7, CANDS);
      if (t) { exhibitMarker(fg, e.n, t, e.scratched); markers[e.ref] = { x: t.x, y: t.y, w: t.w, h: t.h, n: e.n }; }
    });
    specs.forEach(function (s) {
      var b = SPECBOX[s.what] || [10, 10], hw = b[0] >> 1, hh = b[1] >> 1;
      // (the red fish's tag hangs to its left: when it's warmed it stiffens
      // and swings to point right and a little up, down the back hall, and it
      // mustn't run into its own number: wave 8)
      var cands = s.what === 'fish' ? [[-hw - 2 - w, -hh - 4], [-hw - 3 - w, -3], [-hw - 2 - w, hh - 3], [-(w >> 1) - 6, -hh - 9], [-(w >> 1), hh + 2]] : tagCands(hw, hh, w);
      var w = A.textW(String(s.fig)) + 4, t = placeTag(pins, taken, s.x, s.y, w, 7, cands);
      if (t) { figTag(g, s.fig, t, s.x + Math.max(-hw, Math.min(hw, t.x + (w >> 1) - s.x)), s.y + Math.max(-hh, Math.min(hh, t.y + 3 - s.y))); tagAt[s.fig] = t; }
    });
    // (what the tags have taken, for anything tagged later: a marble the
    // dark kept gets its own card, clear of every other number in the rock)
    TAGS = { gen: TAGS.gen + 1, pins: pins.map(function (p) { return { x: p.x, y: p.y }; }), taken: taken.slice() };
    // pins last, into the foreground layer (lit with a floor: they stand
    // proud of the rock, toward the glass, and must always read)
    var pinOut = pins.map(function (p) { return drawPin(g, fg, p); });
    pinOut.forEach(function (q, i) {
      if (q.kind === 'coal' || q.kind === 'coal2') glints.push({ x: q.hx, y: q.hy, ph: i * 1.7, rate: 0.7 + (i % 5) * 0.2, c: P.GLINT_D, pin: true });
      if (q.kind === 'ore' || q.kind === 'ore2') glints.push({ x: q.hx + 1, y: q.hy + 1, ph: i * 2.3, rate: 0.5 + (i % 4) * 0.2, c: P.VEIN3, gold: true, pin: true });
    });
    // the curator's pin spots: a small cool light on each figure in the rock
    specs.forEach(function (s, i) {
      var reg = root.PachinkoBoard ? root.PachinkoBoard.regionAt(s.x, s.y) : null;
      // (widened to take in its tag, which sits at the spot's softer edge)
      var sp = SPOT[s.what] || [12, 12], rx = sp[0], ry = sp[1], tg = tagAt[s.fig];
      if (tg) { rx = Math.max(rx, Math.abs(tg.x + tg.w / 2 - s.x) + tg.w / 2 + 1); ry = Math.max(ry, Math.abs(tg.y + 3 - s.y) + 4); }
      lamps.push({ x: s.x, y: s.y, r: rx, ry: ry / rx, c: '#dfe6ff', k: s.what === 'ribs' ? 0.75 : 1.0, region: reg, kind: 'spot', seed: 300 + i, flame: false });
    });
    return {
      gals: st.gals, fore: fore, albedo: c, lamps: lamps, glints: glints,
      emissive: st.em, pins: pinOut, figs: specs, stillLife: stillLife(board), markers: markers,
      watch: out.watch, ring: out.ring, moth: out.moth, rat: out.rat
    };
  };
  // a tag for something tagged after the mine was painted (the kept marbles):
  // the best of `cands` (offsets from ax, ay) clear of every marker, figure
  // tag, specimen, the legend card and `extra` rects, and as far from the pins
  // as it can be. A.tagGen() changes whenever the mine is repainted.
  var TAGS = { gen: 0, pins: [], taken: [] };
  // (never over another number: a tag or marker costs far more than a
  // specimen's footprint when nothing is clear; clear of the pins by up to
  // 6 px, then the earliest candidate)
  A.tagSpot = function (ax, ay, w, h, cands, extra) {
    var tk = TAGS.taken.concat(extra || []), pins = TAGS.pins, best = null, bs = -1e9;
    for (var i = 0; i < cands.length; i++) {
      var x = Math.round(ax + cands[i][0]), y = Math.round(ay + cands[i][1]);
      if (x < 2 || y < 66 || x + w > GW - 2 || y + h > 384) continue;
      var s = 6;
      for (var k = 0; k < pins.length; k++) {
        var dx = Math.max(x - pins[k].x, 0, pins[k].x - (x + w)), dy = Math.max(y - pins[k].y, 0, pins[k].y - (y + h));
        s = Math.min(s, Math.hypot(dx, dy));
      }
      for (k = 0; k < tk.length; k++) { var T = tk[k]; if (x < T.x + T.w + 2 && x + w + 2 > T.x && y < T.y + T.h + 2 && y + h + 2 > T.y) s = Math.min(s, T.h === 7 || T.tag ? -100 : -10); }
      s -= i * 0.4;
      if (s > bs) { bs = s; best = { x: x, y: y, w: w, h: h }; }
    }
    return best;
  };
  A.tagGen = function () { return TAGS.gen; };
  A.tagsTaken = function () { return TAGS.taken.slice(); };          // (the lab's overlap check)
  A.GW = GW; A.GH = GH; A.SURF = SURF;
})(typeof window !== 'undefined' ? window : globalThis);
