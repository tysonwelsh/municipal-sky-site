/* MOTHER LODE — the cabinet: room, case, marquee, plates, cards, glass.
 *
 * Cabinet space: CAB_W × CAB_H = 376 × 560, the glass interior at
 * (GLASS_X, GLASS_Y) = (28, 72). Top to bottom:
 *   0..20    the mule's shadow board (the exhibit is temporarily removed)
 *   20..66   the marquee: MOTHER LODE, bulbs all round (some dead)
 *   66..72   the frame's top rail (brass lip)
 *   72..488  the glass
 *   488..494 the frame's bottom rail
 *   494..560 the lower panel: the figures card, the brass plates, the
 *            burn on the lip, crayon on the kick plate
 * Left pillar: the marble feed tube (marbles left, live). Right pillar:
 * the coin door. The legend card is taped to the glass over the left wall
 * (board region 'legend'), overlapping the left pillar.
 *
 * The case is bottle-green enamel over steel, chipped to primer, with
 * brass that nobody has polished since the Eisenhower administration.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline, dither = S.dither, ellipse = S.ellipse;
  var line = A.line, thick = A.thick, disc = A.disc, dpx = A.dpx, bayer = A.bayer;

  var CAB_W = 376, CAB_H = 560, GX = 28, GY = 72, GW = 320, GH = 416;
  var C = A.CAB = {
    W: CAB_W, H: CAB_H, GX: GX, GY: GY, GW: GW, GH: GH,
    body: { x0: 4, x1: 371 },                 // the case's outer edges
    marquee: { x0: 2, x1: 373, y0: 20, y1: 66 },
    mule: { x0: 124, x1: 252, y0: 0, y1: 21 },
    lower: { y0: 494, y1: 560 },
    tube: { x: 9, y0: 78, y1: 214, w: 11 },   // the feed tube on the left pillar
    coin: { x: 350, y: 300, w: 20, h: 44 },    // the coin door on the right pillar
    legend: { x: 5, y: GY + 247, w: 87, h: 86 }  // taped over the glass's left wall (board decor 'cardzone')
  };

  /* ══ the room ══════════════════════════════════════════════════════ */
  function drawRoom(g) {
    rect(g, 0, 0, CAB_W, CAB_H, P.NIGHT1);
    for (var x = 3; x < CAB_W; x += 22) vline(g, x, 0, CAB_H, P.NIGHT2);     // wall panelling
    dither(g, 0, 0, CAB_W, 16, P.NIGHT0, 0.6);
    // the marquee's light spilling onto the wall above it
    for (var y = 0; y < 22; y++) for (x = 0; x < CAB_W; x++) {
      var d = Math.abs(x - 188) / 188;
      if (bayer(x, y) < (0.55 - d * 0.4) * (y / 22)) px(g, x, y, P.PUR1);
    }
  }

  /* ══ enamel: the case body ═════════════════════════════════════════ */
  // a flat enamel fill with chips (to grey primer, sometimes to rust) and
  // a vertical light falloff
  function enamel(g, R, x0, y0, w, h, opts) {
    opts = opts || {};
    rect(g, x0, y0, w, h, P.CASE2);
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
      var n = A.fbm(x * 0.08, y * 0.08);
      if (n > 0.62 && bayer(x, y) < (n - 0.62) * 3) px(g, x, y, P.CASE3);
      if (n < 0.34 && bayer(x, y) < (0.34 - n) * 3) px(g, x, y, P.CASE1);
    }
    var chips = opts.chips == null ? Math.round(w * h / 900) : opts.chips;
    for (var i = 0; i < chips; i++) {
      var cx = x0 + 2 + R() * (w - 4), cy = y0 + 2 + R() * (h - 4), cw = 1 + R() * 3, ch = 1 + R() * 2;
      ellipse(g, Math.round(cx), Math.round(cy), Math.round(cw), Math.round(ch), P.CHIP);
      if (R() < 0.35) px(g, Math.round(cx), Math.round(cy), P.RUST);
      px(g, Math.round(cx - cw), Math.round(cy - ch), P.CASE4);
    }
  }
  function rivet(g, x, y) { px(g, x, y, P.CASE4); px(g, x + 1, y + 1, P.CASE0); }
  function screw(g, x, y) { px(g, x, y, P.BRASS2); px(g, x + 1, y, P.BRASS0); px(g, x, y + 1, P.BRASS1); }

  function drawBody(g, R) {
    var b = C.body;
    // the wall shadow behind the case
    rect(g, b.x0 - 2, C.marquee.y1, b.x1 - b.x0 + 5, CAB_H - C.marquee.y1, P.NIGHT0);
    // pillars and rails
    enamel(g, R, b.x0, C.marquee.y1, GX - b.x0, CAB_H - C.marquee.y1);
    enamel(g, R, GX + GW, C.marquee.y1, b.x1 - GX - GW + 1, CAB_H - C.marquee.y1);
    enamel(g, R, GX, C.marquee.y1, GW, GY - C.marquee.y1, { chips: 3 });
    enamel(g, R, GX, GY + GH, GW, CAB_H - GY - GH);
    // outer edges: a lit left edge, a shadowed right, a pinstripe inset
    vline(g, b.x0, C.marquee.y1, CAB_H - 1, P.CASE5); vline(g, b.x0 + 1, C.marquee.y1, CAB_H - 1, P.CASE4);
    vline(g, b.x1, C.marquee.y1, CAB_H - 1, P.CASE0); vline(g, b.x1 - 1, C.marquee.y1, CAB_H - 1, P.CASE1);
    vline(g, b.x0 + 4, C.marquee.y1 + 3, C.lower.y0 - 2, P.CASE1); vline(g, b.x1 - 4, C.marquee.y1 + 3, C.lower.y0 - 2, P.CASE1);
    // the glass frame: a brass lip round the glass, then the dark rebate
    var fx0 = GX - 3, fy0 = GY - 3, fx1 = GX + GW + 2, fy1 = GY + GH + 2;
    rect(g, fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1, P.BRASS1);
    hline(g, fx0, fx1, fy0, P.BRASS3); vline(g, fx0, fy0, fy1, P.BRASS2);
    hline(g, fx0, fx1, fy1, P.BRASS0); vline(g, fx1, fy0, fy1, P.BRASS0);
    for (var x = fx0; x <= fx1; x++) { if (A.hash01(41, x, 0) < 0.14) px(g, x, fy0, P.VERD); if (A.hash01(42, x, 0) < 0.1) px(g, x, fy1, P.VERD); }
    for (var y = fy0; y <= fy1; y++) if (A.hash01(43, y, 0) < 0.1) px(g, fx0, y, P.VERD);
    rect(g, GX - 1, GY - 1, GW + 2, GH + 2, P.NIGHT0);
    // corner screws on the frame
    screw(g, fx0 + 1, fy0 + 1); screw(g, fx1 - 2, fy0 + 1); screw(g, fx0 + 1, fy1 - 2); screw(g, fx1 - 2, fy1 - 2);
    // rivets down the pillars
    for (y = C.marquee.y1 + 8; y < C.lower.y0 - 4; y += 18) { rivet(g, b.x0 + 2, y); rivet(g, b.x1 - 3, y); }
    // the lower panel's lip: a steel ledge people rest things on
    var ly = C.lower.y0;
    hline(g, b.x0, b.x1, ly, P.CASE5); hline(g, b.x0, b.x1, ly + 1, P.CASE4); hline(g, b.x0, b.x1, ly + 2, P.CASE1);
    // the burn: somebody's cigarette, left on the lip too long, years ago
    var bx = 286;
    ellipse(g, bx, ly + 1, 4, 1, '#2a1a10'); hline(g, bx - 2, bx + 2, ly + 1, '#140c08'); px(g, bx + 5, ly + 1, '#4a3420');
    px(g, bx - 5, ly, '#3a2a1a'); px(g, bx + 1, ly + 2, '#4a2a18'); dither(g, bx - 6, ly - 1, 13, 1, '#3a2c1c', 0.3);
    // the kick plate: scuffed, and a child's crayon on it (a fish, loops)
    var ky = CAB_H - 12;
    hline(g, b.x0, b.x1, ky - 1, P.CASE0);
    for (x = b.x0 + 2; x < b.x1 - 1; x++) if (A.hash01(44, x, 0) < 0.3) px(g, x, ky + (x % 5), P.CASE1);
    crayon(g, 238, ky + 3);
  }
  // a crayon drawing at kid height: the fortune fish, a sun, loops. waxy,
  // broken strokes (every third pixel skipped)
  function crayon(g, x, y) {
    var pink = '#c0507a', blue = '#5a7ac0';
    var fishPts = [[0, 2], [1, 1], [2, 1], [3, 0], [4, 0], [5, 0], [6, 1], [7, 1], [8, 2], [7, 3], [6, 4], [5, 4], [4, 4], [3, 4], [2, 3], [1, 3], [9, 1], [10, 0], [9, 3], [10, 4]];
    fishPts.forEach(function (p, i) { if (i % 5 !== 3) px(g, x + p[0], y + p[1], pink); });
    px(g, x + 2, y + 2, pink);
    for (var i = 0; i < 26; i++) { var a = i * 0.5; if (i % 4) px(g, Math.round(x + 18 + i * 0.8 + Math.cos(a) * 2), Math.round(y + 2 + Math.sin(a) * 2), blue); }
    // a sun with too many rays, in the corner, the way you draw it at six
    ellipse(g, x + 48, y + 2, 1, 1, '#d8a040');
    for (var r = 0; r < 8; r++) { var aa = r / 8 * 6.283; px(g, Math.round(x + 48 + Math.cos(aa) * 3), Math.round(y + 2 + Math.sin(aa) * 3), '#d8a040'); }
  }

  /* ══ the marquee ═══════════════════════════════════════════════════ */
  // slab-serif show lettering, built as masks and then painted: a deep red
  // extrusion, a black outline, gold banded top to bottom, lit edges.
  var LW = 20, LH = 26;
  function glyphMask(ch) {
    var c = A.makeCanvas(LW, LH), g = c.getContext('2d');
    g.fillStyle = '#fff';
    function r(x, y, w, h) { g.fillRect(x, y, w, h); }
    function el(cx, cy, rx, ry, cut) {
      for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
        var o = (x + 0.5) * (x + 0.5) / (rx * rx) + (y + 0.5) * (y + 0.5) / (ry * ry);
        if (o <= 1) { if (cut) g.clearRect(cx + x, cy + y, 1, 1); else g.fillRect(cx + x, cy + y, 1, 1); }
      }
    }
    function serifs(x, w, top, bot) { if (top) r(x - 2, 0, w + 4, 3); if (bot) r(x - 2, LH - 3, w + 4, 3); }
    switch (ch) {
      case 'M':
        r(2, 0, 4, LH); r(14, 0, 4, LH); serifs(2, 4, 1, 1); serifs(14, 4, 1, 1);
        g.clearRect(0, 0, 2, 3); g.clearRect(18, 0, 2, 3);
        for (var i = 0; i < 15; i++) { r(4 + (i * 0.4 | 0), i + 1, 3, 1); r(13 - (i * 0.4 | 0), i + 1, 3, 1); }
        break;
      case 'O':
        el(10, 13, 10, 13); el(10, 13, 4, 8, true); break;
      case 'T':
        r(0, 0, 20, 5); r(7, 0, 6, LH); r(4, LH - 3, 12, 3); r(0, 5, 2, 3); r(18, 5, 2, 3); break;
      case 'H':
        r(2, 0, 5, LH); r(13, 0, 5, LH); r(2, 11, 16, 4); serifs(2, 5, 1, 1); serifs(13, 5, 1, 1); break;
      case 'E':
        r(2, 0, 5, LH); r(0, 0, 19, 4); r(2, 11, 12, 4); r(0, LH - 4, 20, 4); r(16, 4, 3, 3); r(17, LH - 7, 3, 3); r(12, 9, 2, 8); break;
      case 'R':
        r(2, 0, 5, LH); serifs(2, 5, 1, 1); r(2, 0, 10, 4); r(2, 11, 10, 4);
        el(11, 7, 7, 7); el(11, 7, 3, 3, true); g.clearRect(2, 4, 6, 7); r(2, 4, 5, 7);
        for (i = 0; i < 12; i++) r(9 + (i * 0.6 | 0), 14 + i, 5, 1);
        r(13, LH - 3, 7, 3); break;
      case 'L':
        r(2, 0, 5, LH); r(0, 0, 9, 3); r(0, LH - 4, 20, 4); r(17, LH - 8, 3, 4); break;
      case 'D':
        r(2, 0, 5, LH); r(0, 0, 10, 4); r(0, LH - 4, 10, 4);
        el(9, 13, 10, 13); el(9, 13, 4, 8, true); g.clearRect(0, 4, 2, LH - 8); g.clearRect(0, 0, 0, 0);
        r(2, 0, 5, LH); g.clearRect(0, 4, 2, LH - 8);
        break;
    }
    var d = g.getImageData(0, 0, LW, LH).data, m = [];
    for (var y = 0; y < LH; y++) { m[y] = []; for (var x = 0; x < LW; x++) m[y][x] = d[(y * LW + x) * 4 + 3] > 128; }
    return m;
  }
  function drawTitle(g, word, cx, y0) {
    var gap = 3, space = 10, w = 0;
    for (var i = 0; i < word.length; i++) w += word[i] === ' ' ? space : LW + gap;
    w -= gap;
    var W = w + 8, H = LH + 8, ox = 2, oy = 2;
    var M = []; for (var yy = 0; yy < H; yy++) { M[yy] = []; for (var xx = 0; xx < W; xx++) M[yy][xx] = false; }
    var x = 0;
    for (i = 0; i < word.length; i++) {
      if (word[i] === ' ') { x += space; continue; }
      var m = glyphMask(word[i]);
      for (yy = 0; yy < LH; yy++) for (xx = 0; xx < LW; xx++) if (m[yy][xx]) M[yy + oy][xx + x + ox] = true;
      x += LW + gap;
    }
    var X0 = Math.round(cx - W / 2), Y0 = y0 - oy;
    function at(xx, yy) { return yy >= 0 && yy < H && xx >= 0 && xx < W && M[yy][xx]; }
    // extrusion: down-right, dark red deepening
    for (var d = 4; d >= 1; d--) for (yy = 0; yy < H; yy++) for (xx = 0; xx < W; xx++)
      if (M[yy][xx]) px(g, X0 + xx + d, Y0 + yy + d, d > 2 ? P.RED0 : P.RED1);
    // outline
    for (yy = -1; yy <= H; yy++) for (xx = -1; xx <= W; xx++) {
      if (at(xx, yy)) continue;
      if (at(xx - 1, yy) || at(xx + 1, yy) || at(xx, yy - 1) || at(xx, yy + 1)) px(g, X0 + xx, Y0 + yy, '#12060a');
    }
    // fill: gold bands, lit at the top, burnt at the bottom
    var bands = [[0, P.GOLD5], [0.12, P.GOLD4], [0.36, P.GOLD3], [0.62, P.GOLD2], [0.86, P.GOLD1]];
    for (yy = 0; yy < H; yy++) for (xx = 0; xx < W; xx++) {
      if (!M[yy][xx]) continue;
      var t = (yy - oy) / LH, c = bands[0][1];
      for (var k = 0; k < bands.length; k++) if (t >= bands[k][0]) c = bands[k][1];
      var nk = 0; for (k = 0; k < bands.length; k++) if (t >= bands[k][0]) nk = k;
      if (nk + 1 < bands.length && bayer(X0 + xx, Y0 + yy) < (t - bands[nk][0]) / (bands[nk + 1][0] - bands[nk][0]) - 0.35) c = bands[nk + 1][1];
      if (!at(xx - 1, yy - 1) || !at(xx, yy - 1)) c = t < 0.5 ? P.GOLD5 : P.GOLD4;     // lit edge
      else if (!at(xx + 1, yy + 1) || !at(xx + 1, yy)) c = P.GOLD1;                     // shadow edge
      px(g, X0 + xx, Y0 + yy, c);
    }
    // a glint on the O's shoulder and the E's arm
    return { x: X0, y: Y0, w: W, h: H };
  }

  // bulb positions round the marquee (live draws them); top then bottom
  var BULBS = [];
  (function () {
    var m = C.marquee;
    for (var x = m.x0 + 6; x <= m.x1 - 6; x += 9) BULBS.push({ x: x, y: m.y0 + 3 });
    for (x = m.x1 - 6; x >= m.x0 + 6; x -= 9) BULBS.push({ x: x, y: m.y1 - 4 });
    for (var i = 0; i < BULBS.length; i++) {
      var h = A.hash01(77, i, 0);
      BULBS[i].dead = (h < 0.1) || i === 7 || i === 30;   // blown; nobody has a ladder
      BULBS[i].bad = !BULBS[i].dead && h > 0.955;           // loose in its socket
      BULBS[i].i = i;
    }
  })();
  C.BULBS = BULBS;

  function drawMarquee(g, R) {
    var m = C.marquee, x0 = m.x0, x1 = m.x1, y0 = m.y0, y1 = m.y1;
    // the box: green enamel, brass rim
    enamel(g, R, x0, y0, x1 - x0 + 1, y1 - y0, { chips: 5 });
    hline(g, x0, x1, y0, P.BRASS3); hline(g, x0, x1, y1 - 1, P.BRASS0);
    vline(g, x0, y0, y1 - 1, P.BRASS2); vline(g, x1, y0, y1 - 1, P.BRASS0);
    // the backlit face: purple-black, a sunburst of rays out of the lode
    var fx0 = x0 + 10, fx1 = x1 - 10, fy0 = y0 + 8, fy1 = y1 - 9;
    rect(g, fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1, P.MQ_BG0);
    var ocx = 188, ocy = fy1 + 16;
    for (var y = fy0; y <= fy1; y++) for (var x = fx0; x <= fx1; x++) {
      var a = Math.atan2(y - ocy, x - ocx), ray = ((a * 16 / Math.PI) % 2 + 2) % 2;
      var dist = Math.hypot(x - ocx, (y - ocy) * 2.2);
      if (ray < 1) px(g, x, y, bayer(x, y) < 0.8 - dist / 260 ? P.MQ_RAY : P.MQ_BG1);
      else if (bayer(x, y) < 0.35 - dist / 400) px(g, x, y, P.MQ_BG1);
    }
    // a glow along the bottom (the lamp inside the box), and grime at the top
    for (y = fy1 - 5; y <= fy1; y++) for (x = fx0; x <= fx1; x++) if (bayer(x, y) < (y - fy1 + 6) / 10) px(g, x, y, P.MQ_RAY2);
    dither(g, fx0, fy0, fx1 - fx0 + 1, 2, P.NIGHT0, 0.5);
    // the inner bezel
    hline(g, fx0 - 1, fx1 + 1, fy0 - 1, P.CASE0); hline(g, fx0 - 1, fx1 + 1, fy1 + 1, P.CASE4);
    vline(g, fx0 - 1, fy0 - 1, fy1 + 1, P.CASE0); vline(g, fx1 + 1, fy0 - 1, fy1 + 1, P.CASE4);
    // the title
    var tb = drawTitle(g, 'MOTHER LODE', 190, fy0 + 3);
    // emblems at the ends: a miner's lamp on the left, crossed pick and hammer on the right
    emblemLamp(g, fx0 + 14, fy0 + 7);
    emblemPicks(g, fx1 - 20, fy0 + 7);
    // a crack in the face, taped over at one end
    var cx = fx1 - 44, cy = fy0;
    for (var i = 0; i < 9; i++) px(g, cx + i + (i % 3 === 0 ? 1 : 0), cy + i + ((i * 7) % 3 === 0 ? 1 : 0), '#b8a8c8');
    rect(g, cx + 5, cy + 3, 5, 3, P.TAPE); px(g, cx + 5, cy + 3, P.PAPER); dither(g, cx + 5, cy + 3, 5, 3, P.PAPER_DD, 0.25);
    // bulb sockets (the bulbs are live)
    for (i = 0; i < BULBS.length; i++) { var bb = BULBS[i]; rect(g, bb.x - 2, bb.y - 2, 5, 5, P.CASE0); px(g, bb.x - 2, bb.y - 2, P.BRASS1); }
    return tb;
  }
  function emblemLamp(g, x, y) {
    // a carbide cap lamp: reflector disc, the burner, a flame
    disc(g, x + 5, y + 6, 5, P.BRASS1); disc(g, x + 5, y + 6, 4, P.BRASS2); disc(g, x + 5, y + 6, 2.5, P.BRASS4);
    rect(g, x + 3, y + 11, 5, 6, P.BRASS1); hline(g, x + 3, x + 7, y + 11, P.BRASS3); hline(g, x + 3, x + 7, y + 14, P.BRASS0);
    px(g, x + 5, y + 5, P.FLAME2); px(g, x + 5, y + 4, P.FLAME1); px(g, x + 4, y + 6, P.FLAME0);
  }
  function emblemPicks(g, x, y) {
    thick(g, x, y + 16, x + 12, y + 2, 2, P.TIM4); thick(g, x + 12, y + 16, x, y + 2, 2, P.TIM4);
    // pick head (left handle) and a single jack's hammer (right)
    line(g, x + 8, y, x + 16, y + 5, P.IRON4); line(g, x + 8, y + 1, x + 15, y + 5, P.IRON3); line(g, x + 8, y, x + 6, y + 1, P.IRON3);
    rect(g, x - 2, y, 5, 4, P.IRON3); hline(g, x - 2, x + 2, y, P.IRON4);
  }

  /* ══ the pit mule's empty place ════════════════════════════════════ */
  // A shadow board (the kind a tool wall has, so each tool goes back on
  // its own hook) with the mule painted on it in outline, the bracket's
  // four bolt holes, and a brass notice hung on one screw.
  // the mule's silhouette, built from shapes: body, neck, a long head,
  // long ears, four legs, the tail. Shadow boards paint the missing thing solid.
  function muleMask() {
    var W = 46, H = 22, c = A.makeCanvas(W, H), g = c.getContext('2d');
    ellipse(g, 17, 10, 12, 5, '#fff');                     // barrel
    thick(g, 27, 9, 33, 4, 4, '#fff');                     // neck
    thick(g, 33, 4, 40, 7, 3, '#fff'); px(g, 41, 8, '#fff'); // the long head, nose down
    thick(g, 32, 3, 29, -4, 1, '#fff'); thick(g, 34, 3, 35, -4, 1, '#fff'); // ears, too long, as they are
    [[9, 14], [12, 14], [23, 14], [26, 14]].forEach(function (l, i) { thick(g, l[0], l[1], l[0] + (i % 2 ? 0 : -1), 20, 2, '#fff'); });
    line(g, 5, 8, 2, 15, '#fff'); px(g, 2, 16, '#fff');   // tail
    var d = g.getImageData(0, 0, W, H).data, m = [];
    for (var y = 0; y < H; y++) { m[y] = []; for (var x = 0; x < W; x++) m[y][x] = d[(y * W + x) * 4 + 3] > 100; }
    return { m: m, w: W, h: H };
  }
  function drawMuleBoard(g, R) {
    var m = C.mule;
    // the board: masonite painted institutional grey-green, gone dim
    rect(g, m.x0, m.y0 + 1, m.x1 - m.x0 + 1, m.y1 - m.y0, P.CASE1);
    dither(g, m.x0, m.y0 + 1, m.x1 - m.x0 + 1, m.y1 - m.y0, P.CASE2, 0.4);
    hline(g, m.x0, m.x1, m.y0 + 1, P.CASE4); vline(g, m.x1, m.y0 + 1, m.y1, P.CASE0);
    // pegboard holes
    for (var y = m.y0 + 4; y < m.y1 - 2; y += 4) for (var x = m.x0 + 3; x < m.x1 - 2; x += 4) px(g, x, y, P.CASE0);
    // the mule, painted solid as a shadow (so you know what goes here),
    // outlined in white, standing on the bracket it was bolted to
    var MM = muleMask(), mx = m.x0 + 8, my = m.y0 - 1;
    for (var j = 0; j < MM.h; j++) for (var i = 0; i < MM.w; i++) {
      if (!MM.m[j][i]) {
        var edge = (MM.m[j][i - 1] || MM.m[j][i + 1] || (MM.m[j - 1] && MM.m[j - 1][i]) || (MM.m[j + 1] && MM.m[j + 1][i]));
        if (edge && my + j > m.y0) px(g, mx + i, my + j, P.BONE_D);
        continue;
      }
      if (my + j <= m.y0) continue;
      px(g, mx + i, my + j, A.hash01(5, i, j) < 0.06 ? '#3a1a1a' : '#5a2426');
    }
    // the shelf bracket: a steel angle under the board, four bolt holes
    // where the hooves were (the paint is brighter under them)
    var sy = m.y1 - 1;
    hline(g, m.x0 + 2, m.x0 + 60, sy, P.IRON3); hline(g, m.x0 + 2, m.x0 + 60, sy + 1, P.IRON1);
    [16, 19, 30, 33].forEach(function (dx) { px(g, mx + dx - 1, sy, P.NIGHT0); });
    // the notice, on one screw, hanging a little crooked
    var nx = m.x0 + 68, ny = m.y0 + 3, nw = 52, nh = 17;
    for (j = 0; j < nh; j++) {
      var off = j > nh / 2 ? 1 : 0;                           // hung on one screw: it has slipped a pixel
      hline(g, nx + off, nx + nw - 1 + off, ny + j, j === 0 ? P.BRASS3 : j === nh - 1 ? P.BRASS0 : P.BRASS2);
      px(g, nx + off, ny + j, P.BRASS3); px(g, nx + nw - 1 + off, ny + j, P.BRASS0);
    }
    A.textC(g, 'EXHIBIT', nx + nw / 2 + 0, ny + 2, P.BRASS0);
    A.textC(g, 'TEMPORARILY', nx + nw / 2 + 1, ny + 7, P.BRASS0);
    A.textC(g, 'REMOVED', nx + nw / 2 + 1, ny + 12, P.BRASS0);
    screw(g, nx + 1, ny + 1);
    px(g, nx + nw - 2, ny + 1, P.BRASS0);   // the empty screw hole on the other corner
  }

  /* ══ the right pillar: the coin door ═══════════════════════════════ */
  function drawCoinDoor(g) {
    var c = C.coin;
    rect(g, c.x - 1, c.y - 1, c.w + 2, c.h + 2, P.CASE0);
    rect(g, c.x, c.y, c.w, c.h, P.BRASS1);
    hline(g, c.x, c.x + c.w - 1, c.y, P.BRASS3); vline(g, c.x, c.y, c.y + c.h - 1, P.BRASS2);
    dither(g, c.x + 1, c.y + 1, c.w - 2, c.h - 2, P.BRASS0, 0.2);
    // the slit, vertical
    rect(g, c.x + 9, c.y + 5, 2, 12, P.NIGHT0); vline(g, c.x + 11, c.y + 5, c.y + 16, P.BRASS3); hline(g, c.x + 9, c.x + 11, c.y + 17, P.BRASS3);
    // 1 TOKEN in stacked letters (the plate is narrow)
    A.textC(g, '1', c.x + c.w / 2, c.y + 20, P.BRASS0);
    A.textC(g, 'TKN', c.x + c.w / 2, c.y + 26, P.BRASS0);
    // the coin return: a little lever
    rect(g, c.x + 6, c.y + 34, 8, 6, P.NIGHT0); rect(g, c.x + 7, c.y + 35, 6, 2, P.BRASS2);
    screw(g, c.x + 1, c.y + 1); screw(g, c.x + c.w - 3, c.y + c.h - 3);
  }
  C.coinRect = function () { return { x: C.coin.x, y: C.coin.y, w: C.coin.w, h: C.coin.h }; };

  /* ══ the left pillar: the feed tube ════════════════════════════════ */
  function drawTube(g) {
    var t = C.tube;
    rect(g, t.x, t.y0, t.w, t.y1 - t.y0, P.NIGHT0);
    vline(g, t.x, t.y0, t.y1, P.IRON2); vline(g, t.x + t.w - 1, t.y0, t.y1, P.IRON1);
    vline(g, t.x + 1, t.y0, t.y1, '#2e3a44');
    // brass clips
    for (var y = t.y0 + 10; y < t.y1; y += 30) { hline(g, t.x - 1, t.x + t.w, y, P.BRASS2); hline(g, t.x - 1, t.x + t.w, y + 1, P.BRASS0); }
    // the elbow at the top that turns into the case
    rect(g, t.x, t.y0 - 6, GX - t.x + 1, 7, P.IRON1); hline(g, t.x, GX, t.y0 - 6, P.IRON3);
    A.text(g, '13', t.x + 1, t.y1 + 3, P.BRASS2);
  }

  /* ══ plates and cards (dry company-museum voice) ═══════════════════ */
  function plate(g, x, y, w, lines, opts) {
    opts = opts || {};
    var h = lines.length * 6 + 5;
    rect(g, x - 1, y - 1, w + 2, h + 2, P.CASE0);
    rect(g, x, y, w, h, P.BRASS2);
    hline(g, x, x + w - 1, y, P.BRASS4); vline(g, x, y, y + h - 1, P.BRASS3);
    hline(g, x, x + w - 1, y + h - 1, P.BRASS0); vline(g, x + w - 1, y, y + h - 1, P.BRASS1);
    // tarnish in the letters' hollows and at the edges
    dither(g, x + 1, y + h - 3, w - 2, 2, P.BRASS1, 0.5);
    for (var i = 0; i < 18; i++) px(g, x + 1 + ((i * 37) % (w - 2)), y + 1 + ((i * 13) % (h - 2)), P.VERD);
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i], cc = P.BRASS0;
      if (opts.center) A.textC(g, ln, x + w / 2, y + 3 + i * 6, cc); else A.text(g, ln, x + 3, y + 3 + i * 6, cc);
    }
    px(g, x + 1, y + 1, P.BRASS0); px(g, x + w - 2, y + 1, P.BRASS0); px(g, x + 1, y + h - 2, P.BRASS0); px(g, x + w - 2, y + h - 2, P.BRASS0);
    return h;
  }
  function drawPlates(g) {
    var y = C.lower.y0 + 7;
    var h1 = plate(g, 196, y, 172, [
      'MOTHER LODE',
      'A WORKING MODEL OF A BITUMINOUS',
      'MINE, SHOWN IN SECTION. 1 IN=40 FT'
    ]);
    plate(g, 196, y + h1 + 4, 172, [
      'THE FIGURES ARE CARVED LINDEN,',
      'HAND PAINTED. NOT MECHANICAL.'
    ]);
  }

  // typewriter ink: a worn ribbon (some letters light), the odd key that
  // strikes high
  function typeInk(seed) {
    return function (i, col, row) {
      var h = A.hash01(seed, i, 0);
      if (h < 0.1) return A.hash01(seed, i, col * 5 + row) < 0.8 ? P.INK_L : null;
      return h > 0.92 ? P.INK_L : P.INK;
    };
  }
  function typed(g, str, x, y, seed) {
    var hi = A.hash01(seed, 99, 0) < 0.12 ? -1 : 0;
    A.text(g, str, x, y + hi, P.INK, 1, typeInk(seed));
  }
  // an index card: nicotine-cream, darker at the edges, taped at the top
  function card(g, x, y, w, h, R) {
    rect(g, x + 1, y + 1, w, h, 'rgba(0,0,0,0.45)');
    rect(g, x, y, w, h, P.PAPER);
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) {
      var e = Math.min(xx - x, x + w - 1 - xx, yy - y, y + h - 1 - yy);
      var n = A.fbm(xx * 0.12, yy * 0.12);
      if (e < 3 && bayer(xx, yy) < 0.5 - e * 0.15) px(g, xx, yy, P.PAPER_D);
      else if (n > 0.66 && bayer(xx, yy) < (n - 0.66) * 2.2) px(g, xx, yy, P.PAPER_D);
    }
    // a water ring from a coffee cup, faint
    // the dog-eared corner
    px(g, x + w - 1, y + h - 1, P.CASE1); px(g, x + w - 2, y + h - 1, P.PAPER_DD); px(g, x + w - 1, y + h - 2, P.PAPER_DD);
  }
  function tape(g, x, y, w, h) {
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++)
      px(g, xx, yy, bayer(xx, yy) < 0.5 ? P.TAPE : '#b8a060');
    hline(g, x, x + w - 1, y, '#e0cc90');
  }

  /* the legend card: taped to the glass over the left wall. Board legend
   * entries (1..n, one scratched), the bays in one line, and the scale
   * bar with its man. */
  function shortLegend(e) {
    var s = String(e.text).toUpperCase().replace(/[—–]/g, '-').replace(/\s+/g, ' ');
    var MAP = {
      'HEADFRAME AND SHEAVE WHEEL': 'HEADFRAME & SHEAVE', 'ORE CART (4 TON)': 'ORE CART, 4 TON',
      'THE OLD DRIFT (ABANDONED 1923)': 'OLD DRIFT (1923)', "MINER'S LUNCH PAIL": "MINER'S DINNER PAIL"
    };
    return MAP[s] || s;
  }
  function drawLegendCard(g, board, R) {
    var L = C.legend, x = L.x, y = L.y, w = L.w, h = L.h;
    card(g, x, y, w, h, R);
    tape(g, x + 8, y - 2, 12, 5); tape(g, x + w - 22, y - 3, 13, 5);
    typed(g, 'KEY TO EXHIBITS', x + 4, y + 4, 3);
    hline(g, x + 4, x + 62, y + 10, P.INK_L);
    var items = (board && board.legend || []).filter(function (e) { return !e.slot; });
    var slots = (board && board.legend || []).filter(function (e) { return e.slot; });
    var ly = y + 13, maxc = Math.floor((w - 16) / 4);
    for (var i = 0; i < items.length && ly < y + h - 18; i++) {
      var e = items[i], n = String(e.n), txt = shortLegend(e);
      typed(g, (n.length < 2 ? ' ' : '') + n, x + 3, ly, 10 + i);
      var t = txt.length > maxc ? txt.slice(0, maxc) : txt;
      typed(g, t, x + 13, ly, 30 + i);
      if (e.scratched) {
        // struck out twice: the typist's X's, then someone else's pen
        A.text(g, 'XXXXXXXXXXXXXXXXXX'.slice(0, t.length), x + 13, ly, P.INK_L);
        for (var k = 0; k < t.length * 4; k++) px(g, x + 12 + k, ly + 2 + ((k >> 2) % 2 ? 0 : 1) - (k % 7 === 0 ? 1 : 0), '#1a2044');
        for (k = 0; k < t.length * 4; k += 1) if (k % 3) px(g, x + 12 + k, ly + 1 + ((k * 3) % 4), '#1a2044');
      }
      ly += 6;
    }
    // the scale bar and the figure of a man for scale
    var sy = y + h - 5;
    hline(g, x + 4, x + 44, sy, P.INK); vline(g, x + 4, sy - 2, sy, P.INK); vline(g, x + 24, sy - 1, sy, P.INK); vline(g, x + 44, sy - 2, sy, P.INK);
    for (k = x + 5; k < x + 24; k++) if (k % 2) px(g, k, sy - 1, P.INK);
    typed(g, '1 IN=40 FT', x + 4, sy - 8, 90);
    // the man: to scale, i.e. a speck at the end of the bar
    px(g, x + 49, sy - 2, P.INK); px(g, x + 49, sy - 1, P.INK); px(g, x + 49, sy, P.INK);
    // a pencilled note to him, by a later hand
    A.text(g, '<MAN', x + 52, sy - 4, '#6a6a7a');
  }

  /* the figures card: the specimens in the rock, on the lower panel */
  function shortFig(d) {
    var s = String(d.label || d.what || '').replace(/^fig\.?\s*\d+\s*:\s*/i, '').toUpperCase().replace(/[—–]/g, '-');
    var MAP = {
      'KEYS (RING OF 3), HOUSE UNKNOWN': 'KEYS, HOUSE UNKNOWN', 'COMPANY PLAQUE, NAME REMOVED': 'PLAQUE, NAME GONE',
      'SEED FERN, CARBONIFEROUS': 'SEED FERN', 'TRILOBITE, SURPRISED': 'TRILOBITE, SURPRISED',
      'POCKET WATCH, STILL GOING': 'WATCH, STILL GOING', 'RIBS, SOMETHING LARGE': 'RIBS, SOMETHING BIG',
      'LEDGERS, 1921 TO 1923': 'LEDGERS, 1921-23', 'STRONGBOX (LOCKED)': 'STRONGBOX, LOCKED',
      'FISH, RED, CURLED BOTH ENDS': 'FISH, CURLS BOTH ENDS', 'PAYROLL, SEALED': 'PAYROLL, SEALED'
    };
    return MAP[s] || s;
  }
  function drawFiguresCard(g, figs, R) {
    var x = 12, y = C.lower.y0 + 6, w = 176, h = 56;
    card(g, x, y, w, h, R);
    tape(g, x + 76, y - 2, 16, 5);
    typed(g, 'FIGURES IN THE ROCK', x + 4, y + 3, 5);
    hline(g, x + 4, x + 78, y + 9, P.INK_L);
    var col = 0, row = 0, perCol = Math.ceil(figs.length / 2);
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i], cx = x + 3 + col * 87, cy = y + 12 + row * 7;
      var t = shortFig(f); if (t.length > 19) t = t.slice(0, 19);
      typed(g, (f.fig < 10 ? ' ' : '') + f.fig, cx, cy, 200 + i);
      typed(g, t, cx + 11, cy, 240 + i);
      if (++row >= perCol) { row = 0; col++; }
    }
  }

  /* ══ glass decals ══════════════════════════════════════════════════ */
  // PLEASE DO NOT TAP GLASS: a printed sticker at the bottom right of the
  // glass, over the frame, and every fingerprint in the building on it.
  C.sticker = { x: GX + GW - 36, y: GY + GH - 14, w: 60, h: 17 };
  function drawSticker(g) {
    var s = C.sticker;
    rect(g, s.x + 1, s.y + 1, s.w, s.h, 'rgba(0,0,0,0.4)');
    rect(g, s.x, s.y, s.w, s.h, P.BONE);
    rect(g, s.x + 1, s.y + 1, s.w - 2, s.h - 2, P.RED2);
    rect(g, s.x + 2, s.y + 2, s.w - 4, s.h - 4, P.BONE);
    A.textC(g, 'PLEASE DO NOT', s.x + s.w / 2, s.y + 3, P.RED1);
    A.textC(g, 'TAP GLASS', s.x + s.w / 2, s.y + 9, P.RED1);
    // a corner peeling
    px(g, s.x + s.w - 1, s.y, P.CASE1); px(g, s.x + s.w - 2, s.y, P.BONE_D); px(g, s.x + s.w - 1, s.y + 1, P.BONE_D);
  }
  // a fingerprint: concentric whorl arcs, drawn to a sheen layer
  function fingerprint(g, cx, cy, rx, ry, rot, c) {
    for (var k = 1; k <= 4; k++) {
      for (var a = 0; a < 6.283; a += 0.35 / k) {
        if (Math.sin(a * 3 + k) > 0.3 || ((a * 10) | 0) % 2) continue;
        var ex = Math.cos(a) * rx * k / 4, ey = Math.sin(a) * ry * k / 4;
        var x = cx + ex * Math.cos(rot) - ey * Math.sin(rot), y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
        px(g, Math.round(x), Math.round(y), c);
      }
    }
  }

  /* ══ the glass: tint (multiply) and sheen (over) ═══════════════════ */
  // tint: nicotine, heaviest at the top where the smoke went
  function buildTint() {
    var c = A.makeCanvas(GW, GH), g = c.getContext('2d');
    for (var y = 0; y < GH; y++) {
      var t = 1 - y / GH;
      var r = 255, gg = Math.round(250 - 14 * t * t), b = Math.round(236 - 44 * t * t);
      g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')'; g.fillRect(0, y, GW, 1);
    }
    // the corners go brown
    for (y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
      var e = Math.min(x, GW - 1 - x, y, GH - 1 - y), n = A.fbm(x * 0.06 + 3, y * 0.06);
      var d = Math.max(0, (12 - e) / 12) * 0.8 + (n > 0.72 ? (n - 0.72) * 0.6 : 0);
      if (bayer(x, y) < d) px(g, x, y, e < 4 ? '#b89868' : '#e0c898');
    }
    return c;
  }
  // sheen: the reflection streak, smears, the fingerprints
  function buildSheen() {
    var c = A.makeCanvas(GW, GH), g = c.getContext('2d');
    // two diagonal streaks: the lights over the door, reflected
    for (var y = 0; y < GH; y++) {
      var fade = Math.max(0, 1 - y / 300), x0 = Math.round(300 - y * 0.62);
      for (var x = x0; x < x0 + 10; x++) {
        var u = (x - x0) / 10, d = Math.sin(u * Math.PI) * 0.22 * fade;
        if (bayer(x, y) < d) px(g, x, y, 'rgba(236,230,214,0.13)');
      }
      if (fade > 0.2) px(g, x0 + 14, y, 'rgba(236,230,214,' + (0.1 * fade).toFixed(3) + ')');
    }
    // a wiped arc where someone cleaned it once, with a sleeve
    for (var a = 0; a < 3.1; a += 0.01) {
      var rx = 70 + (a * 7 % 5), ex = 140 + Math.cos(a) * rx, ey = 214 - Math.sin(a) * 26;
      if (bayer(Math.round(ex), Math.round(ey)) < 0.25) px(g, Math.round(ex), Math.round(ey), 'rgba(232,224,200,0.12)');
    }
    // fingerprints: most of them right by the sticker
    var fp = [[296, 388, 4, 5, 0.3], [279, 395, 3, 5, -0.2], [308, 377, 4, 4, 0.8], [262, 399, 3, 4, 0.1], [288, 371, 3, 4, -0.5], [214, 170, 3, 5, 0.6]];
    fp.forEach(function (f, i) { fingerprint(g, f[0], f[1], f[2], f[3], f[4], i < 5 ? 'rgba(236,228,206,0.16)' : 'rgba(236,228,206,0.09)'); });
    // a small child's whole hand, low down, fingers spread
    for (var k = 0; k < 5; k++) fingerprint(g, 118 + k * 4, 356 - (k === 0 ? -6 : k === 4 ? 2 : 0), 1.5, 3, 0.1 * k - 0.2, 'rgba(236,228,206,0.08)');
    return c;
  }

  /* ══ static assembly ═══════════════════════════════════════════════ */
  // the cabinet without anything board-dependent
  A.buildCabinet = function () {
    var c = A.makeCanvas(CAB_W, CAB_H), g = c.getContext('2d');
    var R = A.rng(0xCA817E7);
    drawRoom(g);
    drawBody(g, R);
    drawMuleBoard(g, R);
    drawMarquee(g, R);
    drawCoinDoor(g);
    drawTube(g);
    drawPlates(g);
    return c;
  };
  // the board-dependent overlays: cards, sticker (drawn over the glass)
  A.buildCabinetOverlay = function (board, figs) {
    var c = A.makeCanvas(CAB_W, CAB_H), g = c.getContext('2d');
    var R = A.rng(0x1E6E7D);
    drawLegendCard(g, board, R);
    drawFiguresCard(g, figs, R);
    drawSticker(g);
    return c;
  };
  A.buildGlassTint = buildTint;
  A.buildGlassSheen = buildSheen;

  /* ══ live cabinet ══════════════════════════════════════════════════ */
  function flick(t, rate, seed) { return A.hash01(seed, Math.floor(t * rate), 7); }
  A.drawCabinetLive = function (g, view) {
    var t = view.t || 0, mode = view.mode, attract = mode === 'attract' || mode === 'work';
    // marquee bulbs: attract chases, play breathes, payout blinks all at once
    var n = BULBS.length;
    for (var i = 0; i < n; i++) {
      var b = BULBS[i], on;
      if (b.dead) on = 0;
      else if (mode === 'payout') on = Math.floor(t * 6) % 2 ? 1 : 0.35;
      else if (attract) { var ph = ((i - t * 9) % 6 + 6) % 6; on = ph < 2 ? 1 : 0.35; }
      else on = 0.75 + 0.25 * Math.sin(t * 1.3 + i * 0.4);
      if (b.bad && flick(t, 11, i) < 0.35) on = 0;
      bulb(g, b.x, b.y, on);
    }
    // marbles in the feed tube
    var tb = C.tube, left = view.marblesLeft == null ? 13 : view.marblesLeft;
    for (i = 0; i < Math.min(13, left); i++) {
      var my = tb.y1 - 6 - i * 10;
      tubeMarble(g, tb.x + 5, my, i);
    }
    // the coin door's little lamp: lit when a token will start a game
    var c = C.coin, lit = attract && Math.floor(t * 2) % 2 === 0;
    px(g, c.x + c.w - 5, c.y + 3, lit ? P.PINK : P.PINK_DK);
    if (lit) { px(g, c.x + c.w - 6, c.y + 3, P.PINK_D); px(g, c.x + c.w - 4, c.y + 3, P.PINK_D); }
  };
  function bulb(g, x, y, on) {
    if (on <= 0) { rect(g, x - 1, y - 1, 3, 3, P.BULB_DEAD); px(g, x - 1, y - 1, '#4a4438'); return; }
    if (on < 0.5) { rect(g, x - 1, y - 1, 3, 3, P.BULB_D); px(g, x - 1, y - 1, '#a8906a'); return; }
    rect(g, x - 1, y - 1, 3, 3, P.GOLD3); px(g, x, y, P.BULB); px(g, x - 1, y - 1, '#fffbe8');
    if (on > 0.9) { px(g, x - 2, y, P.GOLD2); px(g, x + 2, y, P.GOLD2); px(g, x, y - 2, P.GOLD2); px(g, x, y + 2, P.GOLD2); }
  }
  // a small marble in the tube (the full cat's-eye lives in render)
  function tubeMarble(g, x, y, i) {
    disc(g, x, y, 4, '#6d8ea8'); disc(g, x, y, 3, '#9fc0d4');
    var sw = [P.PINK, P.GOLD3, '#5ad0a0'][i % 3];
    px(g, x - 1, y + 1, sw); px(g, x, y, sw); px(g, x + 1, y - 1, sw);
    px(g, x - 2, y - 2, '#f4fbff'); px(g, x + 2, y + 2, '#3c5468');
  }
})(typeof window !== 'undefined' ? window : globalThis);
