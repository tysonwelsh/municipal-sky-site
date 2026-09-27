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
      // chunks: each a lump with a lit top-left and a dark underside
      for (var k = 0; k < 26; k++) {
        var cx = xa + H(sd, k, 1) * (xb - xa), top = heapTop(cv, cx);
        var cy = top + 1 + H(sd, k, 2) * Math.min(20, 416 - top - 3), r = 1 + Math.floor(H(sd, k, 3) * 2.2);
        var coal = H(sd, k, 4) < 0.22, lime = !coal && H(sd, k, 4) > 0.7;
        var body = coal ? P.COAL2 : lime ? '#6c6878' : '#4e4460', lit = coal ? '#5a5a70' : lime ? '#a8a4b0' : '#7a7090', dk = P.DEEP0;
        for (var j = -r; j <= r; j++) for (var i = -r - 1; i <= r; i++) {
          if (i * i * 0.8 + j * j > r * r + 0.6) continue;
          var X = Math.round(cx + i), Y = Math.round(cy + j);
          if (Y < heapTop(cv, X) - 0.5 || X < xa || X > xb) continue;
          px(g, X, Y, (i + j < -r) ? lit : (i + j > r - 1) ? dk : body);
        }
        if (coal && H(sd, k, 5) < 0.5) px(g, Math.round(cx - r + 1), Math.round(cy - r + 1), P.GLINT_D);
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
      // one corner of the bay's card, crooked in the rubble
      if (card && cv.shape === 'roof') {
        var kx = Math.round(cv.cx + (H(sd, 5, 7) < 0.5 ? -5 : 2)), ky = Math.round(heapTop(cv, kx) + 4);
        for (var q = 0; q < 4; q++) { hline(g, kx + q, kx + q + 3, ky + q, q === 0 ? P.PAPER : P.PAPER_D); }
        px(g, kx + 4, ky + 3, P.INK_L); px(g, kx + 5, ky + 3, P.INK_L);
      }
      // NO ROAD: two sticks crossed and planted on it, the miners' sign that a way is shut
      var mx = cv.shape === 'right' ? 6 : cv.shape === 'left' ? 313 : Math.round(cv.cx + (H(sd, 6, 7) < 0.5 ? -6 : 6));
      var my = Math.round(heapTop(cv, mx)) - 1;
      for (var d = 0; d < 6; d++) { px(g, mx - 2 + d, my - 5 + d, d < 2 ? P.TIM4 : P.TIM3); px(g, mx + 3 - d, my - 5 + d, d < 2 ? P.TIM4 : P.TIM2); }
      px(g, mx, my - 3, P.END);
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
      cols.push({ x: x, y: yc, d: dist, wmax: 1 + 3.2 * Math.pow(Math.max(0, 1 - dist / 150), 0.8) });
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
    if (u > 3) w = Math.max(1, w * Math.max(0, 1 - (u - 3) / 2.2), 1);
    return w;
  }
  function drawCrack(g, view, mis) {
    var cr = mis.crack; if (!cr) return;
    var F = fracture(view.board); if (!F) return;
    var u = cr.u, L = M().LODE, t = view.t || 0;
    if (u < L.crack) return;
    for (var i = 0; i < F.cols.length; i++) {
      var c = F.cols[i], w = openAt(c, u);
      if (w <= 0) continue;
      var up = Math.floor(w / 2), dn = Math.ceil(w / 2) - 1;       // the gap: rows y-up … y+dn
      var hot = u < 3 ? 1 : Math.max(0.35, 1 - (u - 3) / 3);
      // the lips: the rock's broken edge, dark, and lit from inside
      px(g, c.x, c.y - up - 1, 'rgba(6,5,8,0.85)'); px(g, c.x, c.y + dn + 1, 'rgba(6,5,8,0.85)');
      if (w >= 2) { px(g, c.x, c.y - up - 2, 'rgba(255,196,90,' + (0.35 * hot).toFixed(2) + ')'); px(g, c.x, c.y + dn + 2, 'rgba(255,170,60,' + (0.25 * hot).toFixed(2) + ')'); }
      // the inside: gold, hottest at the middle, running with light
      for (var y = c.y - up; y <= c.y + dn; y++) {
        var mid = Math.abs(y - c.y) < 1, run = Math.sin(c.x * 0.35 - u * 11 + (y - c.y)) * 0.5 + 0.5;
        var col = mid ? (run > 0.6 ? P.GOLD5 : P.VEIN3) : (run > 0.5 ? P.GOLD4 : P.GOLD3);
        if (hot < 0.6) col = mid ? P.GOLD4 : P.GOLD2;
        if (H(77, c.x * 7 + y, Math.floor(t * 14)) > 0.965) col = '#ffffff';
        px(g, c.x, y, col);
      }
    }
    // the forks: hairlines that light as the front passes
    F.forks.forEach(function (f) {
      var a = u - L.crack - f.d / 600;
      if (a < 0) return;
      var n = Math.min(f.pts.length, Math.floor(a / 0.12 * f.pts.length)), hot2 = u < 3 ? 1 : Math.max(0.3, 1 - (u - 3) / 3);
      for (var k = 0; k < n; k++) { var q = f.pts[k]; px(g, q[0], q[1], k < 2 ? P.GOLD3 : 'rgba(242,169,58,' + (0.9 * hot2 * (1 - k / f.pts.length)).toFixed(2) + ')'); }
    });
  }

  /* ══ the lode's ore: nuggets and gold dust (pure of seed and time) ═══ */
  var NUG = 46;
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
    if (T < t1) return { x: xs + vx * T, y: ys + vy * T + g * T * T / 2, fly: true };
    var x1 = xs + vx * t1, vy1 = -0.35 * (vy + g * t1), vx1 = vx * 0.55, T2 = T - t1;
    var yr = 409 + Math.floor(H(seed, i, 7) * 4);
    var t2 = (-vy1 + Math.sqrt(vy1 * vy1 + 2 * g * (yr - yb))) / g;
    if (T2 < t2) return { x: x1 + vx1 * T2, y: yb + vy1 * T2 + g * T2 * T2 / 2, fly: true };
    var xr = clamp(x1 + vx1 * t2, 3, 317);
    return { x: xr, y: yr, fly: false, big: H(seed, i, 8) < 0.3 };
  }
  function drawOre(g, view, mis) {
    var cr = mis.crack; if (!cr) return;
    var F = fracture(view.board); if (!F) return;
    var u = cr.u, t = view.t || 0, L = M().LODE, seed = cr.seed | 0;
    // gold dust pouring from the open crack, a curtain that thins
    if (u > L.crack && u < 3.2) {
      for (var d = 0; d < 110; d++) {
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
        if (H(seed, i, Math.floor(t * 12)) > 0.6) px(g, x - 1, y - 1, '#ffffff');
      } else {
        px(g, x, y, P.VEIN2); px(g, x + 1, y, P.VEIN1); if (q.big) { px(g, x, y - 1, P.VEIN3); px(g, x + 1, y - 1, P.VEIN2); }
        var tw = Math.sin(t * (1.3 + H(seed, i, 9)) + i * 1.7);
        if (tw > 0.965) { px(g, x, y - 1, '#ffffff'); px(g, x - 1, y, P.GOLD5); px(g, x + 1, y - 1, P.GOLD5); }
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
      rect(g, cd.x - 1, cd.y - 1, cd.w + 2, 1, P.GOLD4); rect(g, cd.x - 1, cd.y + cd.h, cd.w + 2, 1, P.GOLD3);
      rect(g, cd.x - 1, cd.y, 1, cd.h, P.GOLD3); rect(g, cd.x + cd.w, cd.y, 1, cd.h, P.GOLD3);
      for (var yy = cd.y; yy < cd.y + cd.h; yy++) for (var xx = cd.x; xx < cd.x + cd.w; xx++) if (bayer(xx, yy) < k * 0.55) px(g, xx, yy, 'rgba(255,236,170,0.8)');
      if (k > 0.5) A.textC(g, cd.name, cd.x + cd.w / 2, cd.y + 2, cd.lode ? '#ffffff' : P.INK);
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
      // a puff every 50 ms while it sounds, each rising and drifting off the ridge
      for (var tb = q.t0; tb < q.t0 + q.dur; tb += 0.05) {
        var age = t - tb; if (age < 0 || age > 1.6) continue;
        var n = Math.round(tb * 20), r = 1 + age * 3.2, cx = WHISTLE.x + age * (12 + 6 * H(n, qi, 1)) + Math.sin(age * 3 + n) * 1.2, cy = WHISTLE.y - 2 - age * (26 + 8 * H(n, qi, 2));
        var dens = (1 - age / 1.6) * 0.8;
        for (var y = -Math.ceil(r); y <= Math.ceil(r); y++) for (var x = -Math.ceil(r); x <= Math.ceil(r); x++) {
          var dd = Math.sqrt(x * x + y * y) / r; if (dd > 1) continue;
          var X = Math.round(cx + x), Y = Math.round(cy + y);
          if (bayer(X, Y) < dens * (1 - dd * 0.6)) px(g, X, Y, dd < 0.5 && age < 0.5 ? '#f4f0f8' : '#c8c0d8');
        }
      }
      // the jet at the mouth while it sounds
      if (t >= q.t0 && t < q.t0 + q.dur) { px(g, WHISTLE.x, WHISTLE.y - 1, '#ffffff'); px(g, WHISTLE.x + 1, WHISTLE.y - 2, '#ffffff'); px(g, WHISTLE.x, WHISTLE.y - 3, '#f4f0f8'); }
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
  function drawKept(g, view, mis, layer) {
    (mis.lost || []).forEach(function (q, i) {
      if (isDark(view, q.x, q.y)) return;
      var x = q.x, y = q.y, sw = SW[Math.abs(q.id | 0) % SW.length];
      if (layer === 'albedo') {
        // half sunk: the rock closed round it a little, a crack or two
        A.disc(g, x + 0.5, y + 0.5, 3.6, P.DEEP0);
        A.disc(g, x + 0.5, y + 0.5, 2.6, '#6d8ea8'); A.disc(g, x, y, 1.6, '#9fc0d4');
        px(g, x - 1, y + 1, sw[1]); px(g, x, y, sw[0]); px(g, x + 1, y - 1, sw[1]);
        px(g, x - 2, y - 2, '#f4fbff'); px(g, x + 2, y + 2, '#26384a');
        px(g, x + 3, y - 3, P.DEEP0); px(g, x + 4, y - 4, P.DEEP1); px(g, x - 4, y + 2, P.DEEP0);
      } else {
        // the curator's tag: bone, the next figure number, on a thread
        var n = 13 + i, s = String(n), tw = A.textW(s) + 4, tx = x + 5, ty = y - 11;
        px(g, x + 3, y - 3, P.BONE_D); px(g, x + 4, y - 4, P.BONE_D);
        rect(g, tx, ty, tw, 7, P.BONE); hline(g, tx, tx + tw - 1, ty + 6, P.BONE_D);
        A.text(g, s, tx + 2, ty + 1, P.INK);
        // and the glint a glass marble can't help giving
        if (Math.sin((view.t || 0) * 0.8 + i * 2) > 0.94) px(g, x - 1, y - 2, '#ffffff');
      }
    });
  }

  /* ══ the cabinet: the marquee running with light; the pencilled line ══ */
  function drawCabinet(g, view, mis) {
    var fx = view.fx || {}, t = view.t || 0, C = A.CAB;
    var wild = fx.wild || 0;
    if (wild > 0 && C && C.marquee) {
      var m = C.marquee, fx0 = m.x0 + 10, fx1 = m.x1 - 10, fy0 = m.y0 + 8, fy1 = m.y1 - 9;
      // a band of light running across the letters, both ways, as fast as it can
      g.save();
      g.globalCompositeOperation = 'lighter';
      [1, -1].forEach(function (dir, j) {
        var ph = ((t * 1.6 + j * 0.5) % 1), bx = dir > 0 ? fx0 + (fx1 - fx0) * ph : fx1 - (fx1 - fx0) * ph;
        g.globalAlpha = 0.34 * wild;
        g.drawImage(g.canvas, Math.round(bx - 14), fy0, 28, fy1 - fy0 + 1, Math.round(bx - 14), fy0, 28, fy1 - fy0 + 1);
      });
      // the whole face flares on the beat
      if (Math.floor(t * 8) % 2 === 0) { g.globalAlpha = 0.18 * wild; g.drawImage(g.canvas, fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1, fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1); }
      g.restore();
    }
    // the dark kept a marble: somebody pencilled it onto the figures card
    if (mis.lostN > 0 && C && C.lower) {
      var x = 12 + 84, y = C.lower.y0 + 6 + 3, str = '13 MARBLE, LOST', pen = function (i, col, row) { return A.hash01(505, i * 3 + col, row) < 0.12 ? null : (row + i) % 5 === 0 ? '#8a8a98' : '#5a5a6a'; };
      for (var i = 0; i < str.length; i++) A.text(g, str[i], x + i * 4, y + ((i * 7) % 3 === 0 ? 1 : 0), '#5a5a6a', 1, function (i2, col, row) { return pen(i, col, row); });
      // and a pencil stroke for every one it has kept since
      var n = mis.lostN - 1, tx = x + str.length * 4 + 2;
      for (var k = 0; k < Math.min(n, 9); k++) {
        if (k % 5 === 4) { for (var q = 0; q < 5; q++) px(g, tx + (k - 4) * 2 - 1 + q * 2, y + 4 - q, '#5a5a6a'); }
        else vline(g, tx + k * 2 + (k >= 5 ? 3 : 0), y + (k % 2), y + 4, '#5a5a6a');
      }
    }
  }

  /* ══ the flash of the flare (the gas whoomp) ════════════════════════ */
  function drawFlash(g, view, mis) {
    var L = mis.lode; if (!L) return;
    var a = L.u - M().LODE.flare; if (a < 0 || a > 0.32) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,214,140,' + (0.42 * (1 - a / 0.32)).toFixed(3) + ')';
    g.fillRect(0, 0, 320, 416);
    g.restore();
  }
  // the fuse up the stringer, cup to vein, in the held breath
  function drawFuse(g, view, mis) {
    var L = mis.lode; if (!L) return;
    var u = L.u, LO = M().LODE; if (u < 0.04 || u > LO.crack + 0.4) return;
    var F = fracture(view.board); if (!F || !F.stringer.length) return;
    var s = F.stringer, k = clamp((u - 0.04) / (LO.crack - 0.06), 0, 1), n = Math.floor(k * s.length);
    for (var i = s.length - 1; i >= s.length - n; i--) px(g, s[i][0], s[i][1], i === s.length - n ? '#ffffff' : P.GOLD3);
    if (n > 0 && n < s.length) { var h = s[s.length - n]; px(g, h[0] - 1, h[1], P.GOLD5); px(g, h[0] + 1, h[1], P.GOLD5); px(g, h[0], h[1] - 1, P.FLAME1); }
  }

  /* ══ dispatch ═══════════════════════════════════════════════════════ */
  A.drawMischief = function (g, view, layer) {
    var mis = view.fx && view.fx.mis; if (!mis) return;
    var t = view.t || 0;
    if (layer === 'albedo') {
      drawCage(g, mis, 'albedo');
      carts(view, mis, function (p) { drawCartBody(g, p); });
      drawKept(g, view, mis, 'albedo');
    } else if (layer === 'crack') {
      drawCrack(g, view, mis);
    } else if (layer === 'emissive') {
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
