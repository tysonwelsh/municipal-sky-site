/* MOTHER LODE — the art of mischief and the mother lode (wave 4)
 *
 * Draws what pachinko-mischief.js decides, from view.fx.mis (and the board),
 * in the renderer's own layers:
 *   A.bakeMischief(albedo, fore, board)  at build: a cave-in's heap of broken
 *                          rock over its bay (the bay's card buried, one corner
 *                          showing; the miners' crossed sticks for NO ROAD)
 *   A.drawMischief(g, view, layer)
 *     'albedo'   lit by the lightmap: the racing carts' iron, the shift cage,
 *                a kept marble set in the rock
 *     'crack'    on the lit scene: the vein's fracture opening (gold inside)
 *     'emissive' light that must read: ore in the air and in the bays, gold
 *                dust, the flare's flash, the bays ringing, steam from the
 *                whistle, the cage's cap lamps, dust sifting before a cave-in,
 *                the radium hands of the watch in the dark, the kept marble's
 *                tag
 *     'over'     in front of the marbles: the cave-in's dust cloud
 *     'cabinet'  on the cabinet: the marquee's letters running with light at
 *                the lode; the pencilled line on the figures card
 * Pure over (view, board): positions are functions of time and seed.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline;
  var bayer = A.bayer, H = A.hash01;
  function M() { return root.PachinkoMischief; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  /* ══ the heap (baked) ═══════════════════════════════════════════════ */
  function heapTop(cv, x) {
    if (cv.shape === 'right') return (cv.top - 2) + (cv.foot - cv.top + 2) * (x / cv.x1) - 1.5;
    if (cv.shape === 'left') return (cv.top - 2) + (cv.foot - cv.top + 2) * ((320 - x) / (320 - cv.x0)) - 1.5;
    var half = (cv.x1 - cv.x0) / 2;
    return cv.top + (cv.foot - cv.top) * Math.min(1, Math.abs(x - cv.cx) / half) - 1.5;
  }
  var ROCK = ['#2a2034', '#3a2e46', '#4a3e58', '#5a5268', '#34303e', '#241c2c'];
  A.bakeMischief = function (g, fg, board) {
    (board.caveins || []).forEach(function (cv) {
      var sd = (cv.seed | 0) + 17, xa = Math.ceil(cv.x0) + 1, xb = Math.floor(cv.x1) - 1;
      if (cv.shape === 'right') xa = 0;
      if (cv.shape === 'left') xb = 319;
      // the bay's card and stub under it
      var card = A.bayCards && A.bayCards[cv.slot];
      if (card && fg) {
        fg.save(); fg.globalCompositeOperation = 'destination-out';
        fg.fillRect(card.x - 1, card.y - 1, card.w + 2, card.h + 2);
        if (card.stub) fg.fillRect(card.stub.x - 1, card.stub.y - 1, card.stub.w + 2, card.stub.h + 2);
        fg.restore();
      }
      // the body: broken rock, dark in the cracks
      for (var x = xa; x <= xb; x++) {
        var yt = Math.round(heapTop(cv, x));
        for (var y = yt; y < 416; y++) {
          var n = H(sd, x, y), depth = y - yt;
          var c = n < 0.18 ? P.DEEP0 : ROCK[Math.floor(n * 5.99)];
          if (depth === 0) c = n < 0.5 ? '#6a6076' : '#524862';
          px(g, x, y, c);
        }
      }
      // chunks: each a lump with a lit top-left and a dark underside, stood
      // proud of the heap like the pins (the foreground: they must read)
      var cg = fg || g;
      for (var k = 0; k < 26; k++) {
        var cx = xa + H(sd, k, 1) * (xb - xa), top = heapTop(cv, cx);
        var cy = top + 1 + H(sd, k, 2) * Math.min(20, 416 - top - 3), r = 1 + Math.floor(H(sd, k, 3) * 2.2);
        var coal = H(sd, k, 4) < 0.22, lime = !coal && H(sd, k, 4) > 0.7;
        var body = coal ? P.COAL2 : lime ? '#6c6878' : '#4e4460', lit = coal ? '#5a5a70' : lime ? '#a8a4b0' : '#7a7090', dk = P.DEEP0;
        for (var j = -r; j <= r; j++) for (var i = -r - 1; i <= r; i++) {
          if (i * i * 0.8 + j * j > r * r + 0.6) continue;
          var X = Math.round(cx + i), Y = Math.round(cy + j);
          if (Y < heapTop(cv, X) - 0.5 || X < xa || X > xb) continue;
          px(cg, X, Y, (i + j < -r) ? lit : (i + j > r - 1) ? dk : body);
        }
        if (coal && H(sd, k, 5) < 0.5) px(cg, Math.round(cx - r + 1), Math.round(cy - r + 1), P.GLINT_D);
      }
      // the pins that came down with it: a knuckle or two showing in the rubble
      (board.fixtures || []).forEach(function (f, i) {
        if (f.buried !== cv.id) return;
        var X = Math.round(clamp(f.x, xa + 1, xb - 1)), Y = Math.round(heapTop(cv, X) + 3 + H(sd, i, 9) * 4);
        var ore = f.dress === 'ore';
        px(g, X, Y, ore ? P.VEIN2 : P.COAL3); px(g, X + 1, Y, ore ? P.VEIN1 : P.COAL2); px(g, X, Y + 1, ore ? P.VEIN0 : P.COAL1); px(g, X - 1, Y - 1, ore ? P.VEIN3 : P.GLINT_D);
      });
      // a snapped prop, splintered, sticking out of it
      var sx = xa + 3 + H(sd, 3, 7) * (xb - xa - 6), sy = heapTop(cv, sx) + 5, dir = H(sd, 4, 7) < 0.5 ? -1 : 1;
      for (var s = 0; s < 8; s++) { var X2 = Math.round(sx + dir * s * 0.8), Y2 = Math.round(sy - s * 0.6); px(g, X2, Y2, s % 3 ? P.TIM3 : P.TIM2); px(g, X2, Y2 + 1, P.TIM1); }
      px(g, Math.round(sx + dir * 7), Math.round(sy - 5), P.END); px(g, Math.round(sx + dir * 8), Math.round(sy - 6), P.TIM4);
      // one corner of the bay's card, crooked in the rubble (paper: it reads)
      if (card && cv.shape === 'roof') {
        var kx = Math.round(cv.cx + (H(sd, 5, 7) < 0.5 ? -6 : 2)), ky = Math.round(heapTop(cv, kx) + 3);
        for (var q = 0; q < 4; q++) { hline(cg, kx + q, kx + q + 4, ky + q, q === 0 ? P.PAPER : P.PAPER_D); }
        px(cg, kx + 4, ky + 2, P.INK_L); px(cg, kx + 5, ky + 2, P.INK_L); px(cg, kx + 6, ky + 3, P.INK_L);
      }
      // NO ROAD: two sticks crossed and planted on it, the miners' sign that a
      // way is shut: pale new-cut timber, so it reads on the dark heap
      var mx = cv.shape === 'right' ? 7 : cv.shape === 'left' ? 312 : Math.round(cv.cx + (H(sd, 6, 7) < 0.5 ? -6 : 6));
      var my = Math.round(heapTop(cv, mx)) - 1;
      for (var d = 0; d < 8; d++) {
        px(cg, mx - 3 + d, my - 7 + d, d < 3 ? '#e8cc94' : '#c8a868'); px(cg, mx + 4 - d, my - 7 + d, d < 3 ? '#d8b87c' : '#a8884c');
        if (d < 7) { px(cg, mx - 3 + d, my - 6 + d, '#3a2818'); }
      }
      px(cg, mx, my - 4, '#f4dca8'); px(cg, mx + 1, my - 4, '#f4dca8');
      // the work light the crew hung over it: a caged bulb on its flex
      var wx = Math.round(cv.cx), wy = Math.round(cv.top) - 9;
      vline(g, wx, wy - 12, wy - 1, '#141218'); rect(g, wx - 1, wy, 3, 3, P.IRON2); px(g, wx, wy + 2, P.BONE);   // (the renderer lights it: R's caveLamp)
    });
  };

  /* ══ the vein's fracture (pre-drawn, cached per seam) ═══════════════ */
  var crackCache = null;
  function fracture(board) {
    var Mm = M(), sm = Mm && Mm.seamOf(board);
    if (!sm) return null;
    var key = sm.x1 + ',' + sm.y1 + ',' + sm.x2 + ',' + sm.y2;
    if (crackCache && crackCache.key === key) return crackCache;
    var o = Mm.crackOrigin(sm), cols = [], j = 0;
    for (var x = Math.ceil(sm.x1) + 2; x <= Math.floor(sm.x2) - 1; x++) {
      // a jagged line inside the vein: a seeded walk around its centre
      var r = H(0x1c0de, x, 1);
      j = clamp(j + (r < 0.3 ? -1 : r > 0.7 ? 1 : 0), -1, 1);
      var yc = Math.round(Mm.seamY(sm, x)) + j, dist = Math.abs(x - o.x);
      var wm = 3 + 7 * Math.max(0, 1 - dist / 190);
      cols.push({ x: x, y: yc, d: dist, wmax: wm, ws: Math.max(2, Math.round(wm * 0.5)), rag: H(0x1c0de, x, 7) });
    }
    // forks off the main crack, up and down into the rock
    var forks = [];
    for (var f = 0; f < 7; f++) {
      var fx = Math.round(sm.x1 + 12 + (sm.x2 - sm.x1 - 24) * H(0x1c0de, f, 2)), up = H(0x1c0de, f, 3) < 0.5 ? -1 : 1;
      var len = 5 + Math.floor(H(0x1c0de, f, 4) * 8), pts = [], X = fx, Y = Math.round(Mm.seamY(sm, fx)) + up * 2, lean = H(0x1c0de, f, 5) < 0.5 ? -1 : 1;
      for (var s = 0; s < len; s++) { Y += up; if (H(0x1c0de, f * 31 + s, 6) < 0.55) X += lean; pts.push([X, Y]); }
      forks.push({ x: fx, d: Math.abs(fx - o.x), pts: pts });
    }
    // the stringer from the vein down to the 13's cup (the art's own path)
    var slot = (board.fixtures || []).filter(function (q) { return q.kind === 'slot' && q.value >= 13; })[0];
    var str = [];
    if (slot) {
      var tx = (slot.x0 + slot.x1) / 2, ux = o.x, uy = o.y;
      for (var t = 0; t <= 40; t++) { var q2 = t / 40; str.push([Math.round(ux + (tx - ux) * q2 + Math.sin(q2 * 7) * 2), Math.round(uy + (388 - uy) * q2)]); }
    }
    crackCache = { key: key, cols: cols, forks: forks, origin: o, stringer: str, sm: sm };
    return crackCache;
  }
  // how open a column is at lode time u (0 = shut)
  function openAt(c, u) {
    var L = M().LODE, a = u - L.crack - c.d / 600;
    if (a < 0) return 0;
    var w = c.wmax * ease(a / 0.4);
    if (u > 3) w = w + (c.ws - w) * ease((u - 3) / 0.6);
    return w;
  }
  /* the vein's ore, baked once per fracture: a quartz matrix, dark vugs,
   * and faceted gold (a lit facet up-left, a dark one down-right, a black
   * seam round each nugget so they read as crystals, not a glowing band) */
  var VEIN = null, SETTLE = 3.6;
  function veinOf(F) {
    if (VEIN && VEIN.key === F.key) return VEIN;
    var n = F.cols.length, HH = 21, off = 10;
    var tex = A.makeCanvas(n, HH), tg = tex.getContext('2d');
    for (var ci = 0; ci < n; ci++) for (var r = 0; r < HH; r++) {
      var h = H(0x0e1a, ci, r), col = h < 0.1 ? '#141018' : h < 0.32 ? '#5e5a4e' : h < 0.72 ? P.QUARTZ_D : P.QUARTZ;
      px(tg, ci, r, col);
    }
    var R = A.rng(0x60de), nug = [];
    for (var i = 1; i < n - 1;) {
      var c = F.cols[i], half = Math.max(1, c.wmax / 2 - 1), rw = 1 + Math.floor(R() * 2.2 + (c.wmax > 7 ? 1 : 0)), rh = 1 + Math.floor(R() * 1.8);
      var dy = Math.round((R() - 0.5) * 2 * Math.max(0, half - rh * 0.5));
      for (var yy = -rh - 1; yy <= rh + 1; yy++) for (var xx = -rw - 1; xx <= rw + 1; xx++) {
        var X = i + xx, Y = off + dy + yy; if (X < 0 || X >= n || Y < 0 || Y >= HH) continue;
        var e = (xx * xx) / ((rw + 0.5) * (rw + 0.5)) + (yy * yy) / ((rh + 0.5) * (rh + 0.5));
        if (e > 1.45) continue;
        var s2 = xx / (rw + 0.5) + yy / (rh + 0.5);
        px(tg, X, Y, e > 1 ? '#2a1a08' : s2 < -0.7 ? P.GOLD5 : s2 < -0.1 ? P.GOLD4 : s2 < 0.6 ? P.VEIN2 : s2 < 1.1 ? P.VEIN1 : P.VEIN0);
      }
      nug.push({ ci: i - Math.round(rw * 0.4), dy: dy - Math.round(rh * 0.5), ph: R() * 6.28, rate: 1.1 + R() * 2.4, big: rw >= 2 });
      i += 2 + Math.floor(R() * 3) + (c.wmax < 5 ? 2 : 0);
    }
    // the settled vein (from +3.6 to the next game): lips and ore at the
    // width it stays open, painted into the ROCK (the lamps light it)
    var st = A.makeCanvas(320, 416), sg2 = st.getContext('2d');
    for (ci = 0; ci < n; ci++) {
      var C2 = F.cols[ci], w = C2.ws, up = Math.floor(w / 2), dn = w - up - 1;
      sg2.drawImage(tex, ci, off - up, 1, w, C2.x, C2.y - up, 1, w);
      px(sg2, C2.x, C2.y - up - 1, P.VOID0); px(sg2, C2.x, C2.y + dn + 1, P.VOID0);
      if (C2.rag < 0.3) px(sg2, C2.x, C2.y - up - 2, '#1a1216');
    }
    VEIN = { key: F.key, tex: tex, off: off, HH: HH, nug: nug, settled: st };
    return VEIN;
  }
  var band = null, bandG = null;
  function drawCrack(g, view, mis) {
    var cr = mis.crack; if (!cr) return;
    var F = fracture(view.board); if (!F) return;
    var u = cr.u, L = M().LODE, t = view.t || 0;
    if (u < L.crack || u >= SETTLE) return;
    var V = veinOf(F);
    // the rock either side of the fracture is pushed apart: a snapshot of the
    // lit band, laid back a column at a time, above the crack up and below it down
    var BY0 = 300, BH = 100;
    if (!band) { band = A.makeCanvas(320, BH); bandG = band.getContext('2d'); }
    bandG.clearRect(0, 0, 320, BH); bandG.drawImage(g.canvas, 0, BY0, 320, BH, 0, 0, 320, BH);
    var glow = u < 3 ? 1 : Math.max(0, 1 - (u - 3) / 0.6);
    for (var i = 0; i < F.cols.length; i++) {
      var c = F.cols[i], w = openAt(c, u);
      if (w <= 0) continue;
      var wi = Math.max(1, Math.round(w + (c.rag - 0.5) * Math.min(2, w * 0.5)));   // a ragged edge, not two rails
      var up = Math.floor(wi / 2), dn = wi - up - 1, R9 = 9;
      if (up > 0) g.drawImage(band, c.x, c.y - R9 - BY0, 1, R9, c.x, c.y - R9 - up, 1, R9);
      if (dn > 0) g.drawImage(band, c.x, c.y + 1 - BY0, 1, R9, c.x, c.y + 1 + dn, 1, R9);
      var age = u - L.crack - c.d / 600;
      if (age < 0.16) {
        // the break itself: white-hot for an instant
        for (var y = c.y - up; y <= c.y + dn; y++) px(g, c.x, y, (y + i) % 3 ? '#fff6d0' : P.GOLD5);
      } else {
        // then the ore: quartz and faceted gold, lit from the flare
        g.drawImage(V.tex, i, V.off - up, 1, wi, c.x, c.y - up, 1, wi);
        if (age < 0.4) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 * (1 - (age - 0.16) / 0.24); g.fillStyle = '#ffc860'; g.fillRect(c.x, c.y - up, 1, wi); g.restore(); }
      }
      // the broken lips, black, the warm light of the ore catching them
      px(g, c.x, c.y - up - 1, P.VOID0); px(g, c.x, c.y + dn + 1, P.VOID0);
      if (wi >= 3 && glow > 0) {
        px(g, c.x, c.y - up - 2, 'rgba(255,196,90,' + (0.55 * glow).toFixed(2) + ')');
        px(g, c.x, c.y + dn + 2, 'rgba(255,170,60,' + (0.35 * glow).toFixed(2) + ')');
      }
    }
    // the forks: hairlines that light as the front passes, then go dark
    F.forks.forEach(function (f) {
      var a = u - L.crack - f.d / 600;
      if (a < 0) return;
      var n = Math.min(f.pts.length, Math.floor(a / 0.12 * f.pts.length));
      for (var k = 0; k < n; k++) { var q = f.pts[k]; px(g, q[0], q[1], a < 0.5 ? (k < 2 ? P.GOLD4 : P.GOLD2) : (k < 2 ? P.VEIN1 : P.VOID0)); }
    });
    drawVeinGlints(g, F, V, u, t);
  }
  // the settled vein, in the rock (albedo): lit by the lamps like the rest
  function drawVeinSettled(g, view, mis) {
    var cr = mis.crack; if (!cr || cr.u < SETTLE) return;
    var F = fracture(view.board); if (!F) return;
    var V = veinOf(F);
    g.drawImage(V.settled, 0, 0);
    F.forks.forEach(function (f) { for (var k = 0; k < f.pts.length; k++) px(g, f.pts[k][0], f.pts[k][1], k < 2 ? P.VEIN0 : P.VOID0); });
  }
  // each nugget glints on its own phase: one white pixel, the big ones a
  // small cross at the peak (the '+' belongs to gold, not to coal)
  function drawVeinGlints(g, F, V, u, t) {
    var L = M().LODE, dk = A.darkAt;
    for (var i = 0; i < V.nug.length; i++) {
      var q = V.nug[i], c = F.cols[Math.max(0, Math.min(F.cols.length - 1, q.ci))];
      var w = u >= SETTLE ? c.ws : openAt(c, u); if (w < 2) continue;
      var half = w / 2; if (Math.abs(q.dy) > half) continue;
      if (u - L.crack - c.d / 600 < 0.2) continue;
      var x = c.x, y = c.y + q.dy, tw = Math.sin(t * q.rate + q.ph);
      if (dk && dk(x, y) >= 0.85) continue;
      if (tw > 0.93) {
        px(g, x, y, '#ffffff');
        if (q.big && tw > 0.985) { px(g, x - 1, y, P.GOLD5); px(g, x + 1, y, P.GOLD5); px(g, x, y - 1, P.GOLD5); px(g, x, y + 1, P.GOLD5); }
      }
    }
  }
  /* ══ the lode's ore: nuggets and gold dust (pure of seed and time) ═══ */
  var NUG = 96;
  function nuggetAt(seed, i, u, F) {
    var L = M().LODE, ts = 0.42 + 1.9 * Math.pow(H(seed, i, 1), 1.25);
    if (u < ts) return null;
    // out of the crack, weighted to the middle of it
    var side = H(seed, i, 2) < 0.5 ? -1 : 1, reach = Math.pow(H(seed, i, 3), 1.6) * (side < 0 ? 70 : 125);
    var xs = F.origin.x + side * reach, cI = clamp(Math.round(xs - F.cols[0].x), 0, F.cols.length - 1), ys = F.cols[cI].y;
    if (u - L.crack < F.cols[cI].d / 600 + 0.1 && ts < L.crack + F.cols[cI].d / 600 + 0.1) ts = L.crack + F.cols[cI].d / 600 + 0.1;
    var vx = (H(seed, i, 4) - 0.5) * 70, vy = -(25 + 55 * H(seed, i, 5)), g = 420, T = u - ts;
    var yb = ys + 8 + 16 * H(seed, i, 6);
    // to the first knock on the rock below
    var t1 = (-vy + Math.sqrt(vy * vy + 2 * g * (yb - ys))) / g;
    if (T < t1) return { x: xs + vx * T, y: ys + vy * T + g * T * T / 2, fly: true, big: H(seed, i, 8) < 0.3 };
    var x1 = xs + vx * t1, vy1 = -0.35 * (vy + g * t1), vx1 = vx * 0.55, T2 = T - t1;
    var yr = 409 + Math.floor(H(seed, i, 7) * 4);
    var t2 = (-vy1 + Math.sqrt(vy1 * vy1 + 2 * g * (yr - yb))) / g;
    if (T2 < t2) return { x: x1 + vx1 * T2, y: yb + vy1 * T2 + g * T2 * T2 / 2, fly: true, big: H(seed, i, 8) < 0.3 };
    var xr = clamp(x1 + vx1 * t2, 3, 317);
    return { x: xr, y: yr, fly: false, big: H(seed, i, 8) < 0.3 };
  }
  function drawOre(g, view, mis) {
    var cr = mis.crack; if (!cr) return;
    var F = fracture(view.board); if (!F) return;
    var u = cr.u, t = view.t || 0, L = M().LODE, seed = cr.seed | 0;
    // gold dust pouring from the open crack, a curtain that thins
    if (u > L.crack && u < 3.2) {
      for (var d = 0; d < 180; d++) {
        var tb = L.crack + 0.05 + 2.2 * H(seed + 5, d, 1);
        var age = u - tb; if (age < 0 || age > 1.3) continue;
        var ci = Math.floor(H(seed + 5, d, 2) * F.cols.length), c = F.cols[ci];
        if (openAt(c, tb) < 1) continue;
        var X = Math.round(c.x + (H(seed + 5, d, 3) - 0.5) * 2 * age * 6), Y = Math.round(c.y + 2 + (30 + 40 * H(seed + 5, d, 4)) * age + 60 * age * age);
        if (Y > 414) continue;
        if (bayer(X, Y) < 0.95 - age * 0.7) px(g, X, Y, age < 0.4 ? P.GOLD5 : age < 0.8 ? P.GOLD4 : P.GOLD2);
      }
    }
    // the nuggets: tumbling out and down, then lying in the bays for the game
    for (var i = 0; i < NUG; i++) {
      var q = nuggetAt(seed, i, u, F); if (!q) continue;
      var x = Math.round(q.x), y = Math.round(q.y);
      if (q.fly) {
        px(g, x, y, P.GOLD4); px(g, x + 1, y, P.VEIN2); px(g, x, y + 1, P.VEIN2); px(g, x + 1, y + 1, P.VEIN1);
        if (q.big) { px(g, x + 2, y, P.VEIN1); px(g, x + 1, y - 1, P.GOLD5); px(g, x + 2, y + 1, P.VEIN0); }
        if (H(seed, i, Math.floor(t * 12)) > 0.6) px(g, x - 1, y - 1, '#ffffff');
      } else {
        // lying in the bay among the coal: a lump of gold-bearing quartz
        px(g, x, y, P.VEIN2); px(g, x + 1, y, P.VEIN1); px(g, x, y + 1, P.VEIN0); px(g, x - 1, y, P.QUARTZ_D);
        if (q.big) { px(g, x, y - 1, P.VEIN3); px(g, x + 1, y - 1, P.VEIN2); px(g, x + 2, y, P.VEIN1); px(g, x - 1, y - 1, P.QUARTZ); }
        var tw = Math.sin(t * (1.3 + H(seed, i, 9)) + i * 1.7);
        if (tw > 0.95) { px(g, x, y - 1, '#ffffff'); px(g, x - 1, y - 1, P.GOLD5); px(g, x + 1, y - 2, P.GOLD5); }
      }
    }
  }

  /* ══ the bays ring, up the scale and back ═══════════════════════════ */
  function drawCascade(g, view, mis) {
    var L = mis.lode; if (!L) return;
    var u = L.u, LO = M().LODE, cards = A.bayCards || {}, caves = {};
    (view.board.caveins || []).forEach(function (cv) { caves[cv.slot] = 1; });
    var up0 = LO.cascade, t2 = up0 + 13 * 0.045 + 0.05, t3 = t2 + 12 * 0.072 + 0.08;
    for (var i = 0; i < 13; i++) {
      var id = 'slot.' + i, cd = cards[id]; if (!cd || caves[id]) continue;
      var a = u - (up0 + i * 0.045), b = u - (t2 + (12 - i) * 0.072), k = 0;
      if (a >= 0 && a < 0.14) k = 1 - a / 0.14;
      if (b >= 0 && b < 0.16) k = Math.max(k, 0.8 * (1 - b / 0.16));
      if (cd.lode && u - t3 >= 0 && u - t3 < 0.8) k = Math.max(k, Math.floor((u - t3) * 10) % 2 ? 0.4 : 1);
      if (k <= 0.05) continue;
      // the card comes up bright under the flare, its name still on it
      var paper = k > 0.6 ? '#fff6dc' : k > 0.3 ? '#f4dca0' : '#dcc088';
      rect(g, cd.x - 1, cd.y - 1, cd.w + 2, cd.h + 2, k > 0.6 ? P.GOLD4 : P.GOLD2);
      rect(g, cd.x, cd.y, cd.w, cd.h, cd.lode ? (k > 0.6 ? P.GOLD4 : P.GOLD2) : paper);
      A.textC(g, cd.name, cd.x + cd.w / 2, cd.y + 2, cd.lode ? '#ffffff' : P.INK);
    }
  }

  /* ══ the carts race the galleries ══════════════════════════════════ */
  function carts(view, mis, fn) {
    var L = mis.lode; if (!L) return;
    var Mm = M();
    Mm.CARTS.forEach(function (ct, ci) { var p = Mm.cartAt(ct, L.u, view.board); if (p) fn(p, ci, L); });
  }
  function drawCartBody(g, p) {
    var x = Math.round(p.x), y = Math.round(p.y), d = p.dir, tip = p.tip;
    var lean = tip > 0 ? Math.round(tip * 2) * d : 0;
    // wheels (a spoke that turns with x), the tub, its rim
    var sp = ((x % 3) + 3) % 3;
    rect(g, x - 4, y - 2, 2, 2, P.IRON1); rect(g, x + 2, y - 2, 2, 2, P.IRON1);
    px(g, x - 4 + (sp % 2), y - 2, P.IRON3); px(g, x + 2 + ((sp + 1) % 2), y - 2, P.IRON3);
    for (var r = 0; r < 4; r++) hline(g, x - 4 + (r === 3 ? 1 : 0) + (r < 2 ? lean : 0), x + 4 - (r === 3 ? 1 : 0) + (r < 2 ? lean : 0), y - 6 + r, r === 0 ? P.IRON4 : r === 3 ? P.IRON1 : P.IRON2);
    px(g, x - 3 + lean, y - 5, P.RUST); px(g, x + 2, y - 4, P.RUST2);
  }
  function drawCartGold(g, p, ci, L, t) {
    var x = Math.round(p.x), y = Math.round(p.y), d = p.dir, lean = p.tip > 0 ? Math.round(p.tip * 2) * d : 0;
    // the load: a heap of ore riding high
    if (p.tip < 0.6) {
      hline(g, x - 3 + lean, x + 3 + lean, y - 7, P.VEIN2); hline(g, x - 2 + lean, x + 2 + lean, y - 8, P.GOLD4); px(g, x + lean, y - 9, P.GOLD5);
      px(g, x - 2 + lean, y - 7, P.VEIN3); px(g, x + 1 + lean, y - 8, '#ffffff');
    }
    // sparks off the wheels behind it (none in the air)
    if (p.air < 1 && p.k < 1) for (var s = 0; s < 3; s++) {
      var h = H(ci * 97 + s, Math.floor(t * 30), 3);
      if (h < 0.35) continue;
      px(g, x - d * (5 + s * 2 + Math.round(h * 3)), y - 1 - Math.round(h * 3 * (s % 2)), s === 0 ? '#ffffff' : P.FLAME1);
    }
    // off the end of the road it tips, and the ore goes on without it
    if (p.tip > 0) for (var o = 0; o < 9; o++) {
      var a = p.tip * 0.35, X = Math.round(x + d * (4 + o * 1.5 + a * (40 + o * 9))), Y = Math.round(y - 8 + (o % 3) + 380 * a * a - a * 30);
      px(g, X, Y, o % 3 ? P.GOLD4 : P.VEIN2);
    }
  }

  /* ══ the shift: steam from the whistle, the cage down the shaft ══════ */
  var WHISTLE = { x: 143, y: 40 };
  function drawSteam(g, view, mis) {
    var st = mis.steam; if (!st || !st.length) return;
    var t = view.t || 0;
    st.forEach(function (q, qi) {
      // a puff every 40 ms while it sounds: out of the whistle fast, slowing
      // as it spreads, leaning off the ridge with the wind
      for (var tb = q.t0; tb < q.t0 + q.dur; tb += 0.04) {
        var age = t - tb; if (age < 0 || age > 1.9) continue;
        var n = Math.round(tb * 25), rise = 46 * (1 - Math.exp(-age * 2.2)) + 6 * age;
        var r = 2 + age * 6, cx = WHISTLE.x + age * (16 + 9 * H(n, qi, 1)) + Math.sin(age * 3 + n) * 1.2, cy = WHISTLE.y - 2 - rise;
        var dens = Math.pow(1 - age / 1.9, 1.2);
        for (var y = -Math.ceil(r); y <= Math.ceil(r); y++) for (var x = -Math.ceil(r); x <= Math.ceil(r); x++) {
          var dd = Math.sqrt(x * x + y * y) / r; if (dd > 1) continue;
          var X = Math.round(cx + x), Y = Math.round(cy + y);
          if (bayer(X, Y) < dens * (1.05 - dd * 0.7)) px(g, X, Y, dd < 0.45 && age < 0.7 ? '#ffffff' : dd < 0.75 ? '#e4e0ee' : '#b4acc8');
        }
      }
      // the jet at the mouth while it sounds
      if (t >= q.t0 && t < q.t0 + q.dur) { rect(g, WHISTLE.x - 1, WHISTLE.y - 4, 3, 4, '#ffffff'); px(g, WHISTLE.x, WHISTLE.y - 5, '#f4f0f8'); }
    });
  }
  // the hoist cage: down the main shaft with the next shift's two cap lamps,
  // a pause at the haulage way, and up again with the last shift's
  var CAGE = { x: 84, top: 60, bot: 147 };
  function cageY(u) {
    if (u < 1.5) return CAGE.top + (CAGE.bot - CAGE.top) * ease(u / 1.5);
    if (u < 2.1) return CAGE.bot;
    return CAGE.bot - (CAGE.bot - CAGE.top) * ease((u - 2.1) / 1.4);
  }
  function drawCage(g, mis, layer) {
    var c = mis.cage; if (!c) return;
    var y = Math.round(cageY(c.u)), x = CAGE.x;
    if (layer === 'albedo') {
      vline(g, x, CAGE.top - 12, y - 5, P.IRON1);                          // the rope
      hline(g, x - 3, x + 3, y - 5, P.IRON3); hline(g, x - 3, x + 3, y, P.IRON2);
      vline(g, x - 3, y - 5, y, P.IRON2); vline(g, x + 3, y - 5, y, P.IRON2);
      px(g, x, y - 6, P.IRON3);
      // two miners, shoulder to shoulder (painted flats: it's a model)
      rect(g, x - 2, y - 3, 2, 3, P.COAT_K); rect(g, x + 1, y - 3, 2, 3, P.COAT_B);
      px(g, x - 2, y - 4, P.CAP); px(g, x + 1, y - 4, P.CAP);
    } else {
      px(g, x - 1, y - 4, P.FLAME2); px(g, x + 2, y - 4, P.FLAME1);
    }
  }

  /* ══ the cave-in: dust sifting, then the fall ═══════════════════════ */
  function drawSift(g, view, mis) {
    var s = mis.sift; if (!s) return;
    var t = view.t || 0, u = t - s.t0, span = Math.max(0.5, s.t1 - s.t0);
    // a hairline opening in the rock over the bay
    var n = Math.floor(clamp(u / span, 0, 1) * 16), X = Math.round(s.cx), Y = 344;
    for (var k = 0; k < n; k++) { Y += 1; if (H(s.seed, k, 1) < 0.5) X += H(s.seed, k, 2) < 0.5 ? -1 : 1; px(g, X, Y, 'rgba(10,8,12,0.9)'); }
    // motes and grit coming down from it
    for (var i = 0; i < 44; i++) {
      var tb = s.t0 + span * H(s.seed, i, 3) * 0.9, age = t - tb; if (age < 0 || age > 1.4) continue;
      var x = Math.round(s.x0 + 3 + (s.x1 - s.x0 - 6) * H(s.seed, i, 4) + Math.sin(age * 5 + i) * 1), y = Math.round(346 + H(s.seed, i, 5) * 12 + (22 + 26 * H(s.seed, i, 6)) * age);
      if (y > 400) continue;
      var big = H(s.seed, i, 7) < 0.12;
      px(g, x, y, big ? '#6a5e56' : 'rgba(150,132,118,0.8)'); if (big) px(g, x + 1, y, '#3a322e');
    }
  }
  function drawFall(g, view, mis, layer) {
    var f = mis.fall; if (!f) return;
    var t = view.t || 0, u = t - f.t0;
    if (layer === 'emissive') {
      // the rocks coming down onto the heap
      for (var i = 0; i < 16; i++) {
        var tb = 0.03 * i * H(f.seed, i, 1), a = u - tb; if (a < 0) continue;
        var x = Math.round(f.x0 + 2 + (f.x1 - f.x0 - 4) * H(f.seed, i, 2)), y0 = 336 + 22 * H(f.seed, i, 3), y = y0 + 40 * a + 520 * a * a;
        if (y > 380 + 6 * H(f.seed, i, 4)) continue;
        var r = H(f.seed, i, 5) < 0.3 ? 2 : 1, Y = Math.round(y);
        rect(g, x, Y, r + 1, r + 1, '#5a5068'); px(g, x, Y, '#8a8098'); px(g, x + r, Y + r, P.DEEP0);
      }
    } else if (layer === 'over') {
      // the dust: a cloud out of the bay, over everything, settling
      if (u > 1.6) return;
      var k = 1 - u / 1.6, R = 5 + 26 * Math.pow(u / 1.6, 0.6), cx = f.cx, cy = 380 - 8 * u;
      for (var yy = -R; yy <= R; yy++) for (var xx = -R * 1.3; xx <= R * 1.3; xx++) {
        var d = Math.sqrt((xx / 1.3) * (xx / 1.3) + yy * yy) / R; if (d > 1) continue;
        var X = Math.round(cx + xx), Y = Math.round(cy + yy);
        if (Y > 415 || X < 0 || X > 319) continue;
        var dens = k * (1 - d) * (0.8 + 0.4 * H(f.seed, X >> 2, Y >> 2));
        if (bayer(X, Y) < dens) px(g, X, Y, d < 0.5 ? 'rgba(136,120,110,0.85)' : 'rgba(96,84,82,0.7)');
      }
    }
  }

  /* ══ the dark: the watch's radium hands, the only thing you can see ══ */
  function drawRadium(g, view, mis) {
    var d = mis.dark; if (!d || !d.out || d.regions.indexOf('barren') < 0) return;
    var w = null; (view.board.decor || []).forEach(function (q) { if (q.kind === 'specimen' && q.what === 'watch') w = q; });
    if (!w) return;
    var t = view.t || 0, a = (t / 60) * Math.PI * 2 - Math.PI / 2 + 0.7, pulse = 0.75 + 0.25 * Math.sin(t * 2.1);
    var G = 'rgba(140,255,170,' + (0.9 * pulse).toFixed(2) + ')', G2 = 'rgba(90,210,130,' + (0.55 * pulse).toFixed(2) + ')';
    // the four quarter marks, then the hands (minute, and the hour's stub)
    [[0, -3], [3, 0], [0, 3], [-3, 0]].forEach(function (q) { px(g, w.x + q[0], w.y + q[1], G2); });
    px(g, Math.round(w.x + Math.cos(a) * 1), Math.round(w.y + Math.sin(a) * 1), G);
    px(g, Math.round(w.x + Math.cos(a) * 2), Math.round(w.y + Math.sin(a) * 2), G);
    var ha = a / 12 + 2.2;
    px(g, Math.round(w.x + Math.cos(ha) * 1.4), Math.round(w.y + Math.sin(ha) * 1.4), G2);
    px(g, w.x, w.y, G);
  }

  /* ══ what the dark kept: set in the rock, tagged ════════════════════ */
  var SW = [[P.PINK, P.PINK_D], [P.GOLD3, P.GOLD1], ['#4ad0a0', '#1e7058'], ['#5a8aff', '#2a3a9a'], ['#ff7040', '#8a2a10']];
  function isDark(view, x, y) {
    var dk = view.fx && view.fx.dark, PB = root.PachinkoBoard; if (!dk || !PB) return false;
    return (dk[PB.regionAt(x, y)] || 0) >= 0.85;
  }
  var keptSeen = {}, keptTags = { key: null, at: [] };
  // where each kept marble's tag hangs: up and to the right on its thread if
  // that's clear, otherwise the first place clear of every other number in
  // the rock and of the other kept marbles and their tags (wave 8: the second
  // one's 14 once hung right over the trilobite's 4, and read as Fig. 14)
  function keptTagSpots(lost) {
    var key = (A.tagGen ? A.tagGen() : 0) + '|' + lost.map(function (q) { return q.x + ',' + q.y; }).join(';');
    if (keptTags.key === key) return keptTags.at;
    var extra = lost.map(function (q) { return { x: q.x - 5, y: q.y - 5, w: 11, h: 11 }; }), at = [];
    lost.forEach(function (q, i) {
      var tw = A.textW(String(13 + i)) + 4, x = q.x, y = q.y, t = null;
      var cands = [[5, -15], [-5 - tw, -15], [-(tw >> 1), -18], [7, -8], [-7 - tw, -8], [6, 5], [-6 - tw, 5], [-(tw >> 1), 8]];
      if (A.tagSpot) t = A.tagSpot(x, y, tw, 7, cands, extra);
      if (!t) t = { x: x + 5, y: y - 15, w: tw, h: 7 };
      extra.push({ x: t.x, y: t.y, w: t.w, h: t.h, tag: true });
      at.push(t);
    });
    keptTags = { key: key, at: at };
    return at;
  }
  A.keptTag = function (i) { return keptTags.at[i] || null; };
  function drawKept(g, view, mis, layer) {
    var t = view.t || 0, spots = keptTagSpots(mis.lost || []);
    (mis.lost || []).forEach(function (q, i) {
      if (isDark(view, q.x, q.y)) { keptSeen[q.n] = null; return; }
      if (keptSeen[q.n] == null || t < keptSeen[q.n]) keptSeen[q.n] = t;      // (draw-side memory: when the light found it)
      var x = q.x, y = q.y, u = t - keptSeen[q.n];
      // the tag hangs higher than a bay card, on a thread (so "13" is a figure, not the jackpot)
      var n = 13 + i, s2 = String(n), tw = A.textW(s2) + 4, sw = u < 1.2 ? Math.round(Math.sin(u * 11) * 2 * (1 - u / 1.2)) : 0, tx = spots[i].x + sw, ty = spots[i].y;
      if (layer === 'albedo') {
        // half sunk: the rock closed round it a little, a crack or two
        A.disc(g, x + 0.5, y + 0.5, 4.2, P.DEEP0);
        px(g, x + 4, y - 4, P.DEEP0); px(g, x + 5, y - 5, P.DEEP1); px(g, x - 5, y + 2, P.DEEP0);
        // the curator's tag, a card on a thread, in the spot's light
        // (the thread runs from the marble's near side to the card's near edge)
        var above = ty + 3 < y;
        A.line(g, x + (tx + (tw >> 1) > x ? 2 : -2), y + (above ? -3 : 3), tx + (tw >> 1), above ? ty + 6 : ty, '#8a7e68');
        rect(g, tx, ty, tw, 7, P.PAPER_D); hline(g, tx, tx + tw - 1, ty + 6, P.PAPER_DD); hline(g, tx, tx + tw - 1, ty, '#cdbd8e');
        A.text(g, s2, tx + 2, ty + 1, P.INK);
      } else {
        // the glass itself, dusty and still: its vane frozen where it stopped
        if (A.drawMarble) A.drawMarble(g, { x: x, y: y, r: 4, id: q.id, spin: (q.n || 1) * 1.3 }, t, { dim: true, still: true });
        // the spot clicks on when the light comes back (a flash of cold white)
        if (u < 0.15) for (var a = 0; a < 24; a++) { var an = a / 24 * Math.PI * 2; px(g, Math.round(x + Math.cos(an) * 8), Math.round(y + Math.sin(an) * 7), 'rgba(220,230,255,0.55)'); }
      }
    });
  }

  /* ══ the cabinet: the marquee running with light; the pencilled line ══ */
  function drawCabinet(g, view, mis) {
    var fx = view.fx || {}, t = view.t || 0, C = A.CAB;
    var wild = fx.wild || 0;
    if (wild > 0 && C && C.marquee) drawWild(g, t, wild, C.marquee);
    // the dark kept a marble: somebody pencilled it onto the figures card
    if (mis.lostN > 0 && C && C.lower) {
      var x = 12 + 84, y = C.lower.y0 + 6 + 3, str = '13 MARBLE, LOST', pen = function (i, col, row) { return A.hash01(505, i * 3 + col, row) < 0.12 ? null : (row + i) % 5 === 0 ? '#8a8a98' : '#5a5a6a'; };
      for (var i = 0; i < str.length; i++) A.text(g, str[i], x + i * 4, y + ((i * 7) % 3 === 0 ? 1 : 0), '#5a5a6a', 1, function (i2, col, row) { return pen(i, col, row); });
      // and a pencil stroke for every one it has kept since
      // (a clear gap after LOST: a stroke tight against the T read as "LOST!": wave 8)
      var n = mis.lostN - 1, tx = x + str.length * 4 + 4;
      for (var k = 0; k < Math.min(n, 9); k++) {
        if (k % 5 === 4) { for (var q = 0; q < 5; q++) px(g, tx + (k - 4) * 2 - 1 + q * 2, y + 4 - q, '#5a5a6a'); }
        else vline(g, tx + k * 2 + (k >= 5 ? 3 : 0), y + (k % 2), y + 4, '#5a5a6a');
      }
    }
  }

  // the marquee goes wild: the letters picked out of the painted face (once),
  // light running through them both ways, the sunburst behind flickering
  // between its rays, the whole face flaring on the beat
  var MQ = null;
  function marqueeMasks(g, m) {
    var x0 = m.x0 + 10, y0 = m.y0 + 8, w = m.x1 - 10 - x0 + 1, h = m.y1 - 9 - y0 + 1;
    var src = g.getImageData(x0, y0, w, h).data;
    var lt = A.makeCanvas(w, h), lg = lt.getContext('2d'), li = lg.createImageData(w, h);
    var ra = A.makeCanvas(w, h), rga = ra.getContext('2d'), rai = rga.createImageData(w, h);
    var rb = A.makeCanvas(w, h), rgb = rb.getContext('2d'), rbi = rgb.createImageData(w, h);
    var ocx = 188 - x0, ocy = h + 16;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var o = (y * w + x) * 4, r = src[o], gg = src[o + 1], b = src[o + 2];
      var letter = r > 140 && r > b + 50 && gg > 60;
      if (letter) { li.data[o] = 255; li.data[o + 1] = 246; li.data[o + 2] = 214; li.data[o + 3] = 255; continue; }
      if (r + gg + b > 330) continue;                                  // the emblems, the bezel
      var a = Math.atan2(y - ocy, x - ocx), ray = Math.floor(((a * 16 / Math.PI) % 2 + 2) % 2 * 2) % 4;
      var dst = ray === 0 ? rai : ray === 2 ? rbi : null;
      if (dst && bayer(x, y) < 0.6) { dst.data[o] = 150; dst.data[o + 1] = 70; dst.data[o + 2] = 120; dst.data[o + 3] = 255; }
    }
    lg.putImageData(li, 0, 0); rga.putImageData(rai, 0, 0); rgb.putImageData(rbi, 0, 0);
    return { x: x0, y: y0, w: w, h: h, letters: lt, raysA: ra, raysB: rb };
  }
  function drawWild(g, t, wild, m) {
    if (!MQ) { try { MQ = marqueeMasks(g, m); } catch (e) { MQ = false; } }
    if (!MQ) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // the sunburst, ray and ray about
    g.globalAlpha = 0.8 * wild;
    g.drawImage(Math.floor(t * 9) % 2 ? MQ.raysA : MQ.raysB, MQ.x, MQ.y);
    // two bands of light through the letters, crossing
    [1, -1].forEach(function (dir, j) {
      var ph = (t * 1.3 + j * 0.5) % 1, bx = dir > 0 ? MQ.w * ph : MQ.w * (1 - ph), bw = 34;
      var sx = Math.max(0, Math.round(bx - bw / 2)), sw = Math.min(MQ.w - sx, bw);
      if (sw > 0) { g.globalAlpha = 0.9 * wild; g.drawImage(MQ.letters, sx, 0, sw, MQ.h, MQ.x + sx, MQ.y, sw, MQ.h); }
    });
    // and all of it on the beat
    if (Math.floor(t * 6) % 2 === 0) { g.globalAlpha = 0.35 * wild; g.drawImage(MQ.letters, MQ.x, MQ.y); }
    g.restore();
  }

  /* ══ the flash of the flare (the gas whoomp) ════════════════════════ */
  var flashC = null;
  function drawFlash(g, view, mis) {
    var L = mis.lode; if (!L) return;
    var a = L.u - M().LODE.flare; if (a < 0 || a > 0.28) return;
    var F = fracture(view.board), o = F ? F.origin : { x: 180, y: 363 };
    if (!flashC) {
      // a posterised warm burst, brightest at the heart of the vein
      flashC = A.makeCanvas(400, 400); var fg = flashC.getContext('2d'), im = fg.createImageData(400, 400), dd = im.data;
      for (var y = 0; y < 400; y++) for (var x = 0; x < 400; x++) {
        var r = Math.hypot(x - 200, (y - 200) * 1.5) / 200; if (r >= 1) continue;
        var q = Math.floor(Math.pow(1 - r, 2.2) * 6 + bayer(x, y) * 0.999) / 6; if (q <= 0) continue;
        var o4 = (y * 400 + x) * 4; dd[o4] = 255 * q; dd[o4 + 1] = 214 * q; dd[o4 + 2] = 140 * q; dd[o4 + 3] = 255;
      }
      fg.putImageData(im, 0, 0);
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6 * Math.pow(1 - a / 0.28, 1.5);
    g.drawImage(flashC, Math.round(o.x - 200), Math.round(o.y - 200));
    g.restore();
  }
  // the fuse up the stringer, cup to vein, in the held breath
  function drawFuse(g, view, mis) {
    var L = mis.lode; if (!L) return;
    var u = L.u, LO = M().LODE; if (u < 0.04 || u > LO.crack + 0.4) return;
    var F = fracture(view.board); if (!F || !F.stringer.length) return;
    var s = F.stringer, k = clamp((u - 0.04) / (LO.crack - 0.06), 0, 1), n = Math.floor(k * s.length);
    for (var i = s.length - 1; i >= s.length - n; i--) { px(g, s[i][0], s[i][1], i === s.length - n ? '#ffffff' : P.GOLD4); if (bayer(s[i][0] + 1, s[i][1]) < 0.5) px(g, s[i][0] + 1, s[i][1], 'rgba(255,200,80,0.5)'); if (bayer(s[i][0] - 1, s[i][1]) < 0.5) px(g, s[i][0] - 1, s[i][1], 'rgba(255,200,80,0.5)'); }
    if (n > 0 && n < s.length) { var h = s[s.length - n]; px(g, h[0] - 1, h[1], P.GOLD5); px(g, h[0] + 1, h[1], P.GOLD5); px(g, h[0], h[1] - 1, P.FLAME1); }
  }

  /* ══ dispatch ═══════════════════════════════════════════════════════ */
  A.drawMischief = function (g, view, layer) {
    var mis = view.fx && view.fx.mis; if (!mis) return;
    var t = view.t || 0;
    if (layer === 'albedo') {
      drawVeinSettled(g, view, mis);
      drawCage(g, mis, 'albedo');
      carts(view, mis, function (p) { drawCartBody(g, p); });
      drawKept(g, view, mis, 'albedo');
    } else if (layer === 'crack') {
      drawCrack(g, view, mis);
    } else if (layer === 'emissive') {
      if (mis.crack && mis.crack.u >= SETTLE) { var F0 = fracture(view.board); if (F0) drawVeinGlints(g, F0, veinOf(F0), mis.crack.u, t); }
      drawFuse(g, view, mis);
      drawOre(g, view, mis);
      carts(view, mis, function (p, ci, L) { drawCartGold(g, p, ci, L, t); });
      drawCascade(g, view, mis);
      drawSteam(g, view, mis);
      drawCage(g, mis, 'emissive');
      drawSift(g, view, mis);
      drawFall(g, view, mis, 'emissive');
      drawRadium(g, view, mis);
      drawKept(g, view, mis, 'emissive');
      drawFlash(g, view, mis);
    } else if (layer === 'over') {
      drawFall(g, view, mis, 'over');
    } else if (layer === 'cabinet') {
      drawCabinet(g, view, mis);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
