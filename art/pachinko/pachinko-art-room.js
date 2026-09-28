/* MOTHER LODE — the room around the machine (wave 6a)
 *
 * The possum's arcade at 2 a.m., drawn around the cabinet in the cabinet's
 * own pixels: purple-black panelling, a drop ceiling, a cosmic-confetti
 * carpet worn thin where people stand, HOLLER ROLLER dark on the left with
 * its possum's glass eyes catching the light, SCRIP CREEK on the right with
 * the raccoon's paws against the glass, and between them the back hall: a
 * tube that buzzes and gives out, and far down it one machine still lit,
 * humming. (The machine at the end of the hall is its own cabinet, still
 * to be built. This room only points at it: a glow, a shape, never what
 * is on it.)
 *
 * HOW IT SITS ON THE PAGE. main owns one screen canvas that fills the
 * stage and paints the cabinet at an integer scale with its own dark room
 * around it. This file adds two canvases laid exactly over main's
 * (pointer-events: none, so every click still lands on main's canvas):
 *   static  the pre-rendered room + the few slow state changes (the tube,
 *           the far glow's hum, the dim in PLAY), repainted only when the
 *           camera or one of those states changes;
 *   live    the small moving things (haze, the moth, the cigarette, the
 *           clock, the possum's eyes, a glint), on the crew's own 8 fps shutter (the smoke at 4).
 * Both are transparent over the cabinet: they clear main's own case
 * cut-out (the rects in CUT, which mirror buildRoom() in pachinko-main.js),
 * so nothing of the machine is ever covered. The camera is read from the
 * public handle each frame (window.__pachinko.view.cam, which main fills
 * before every render; this loop starts after main's, so it runs after
 * main's frame in the same animation frame), and the lode's jolt is
 * mirrored from view.fx.lode. Room px = cabinet px: the room is drawn at
 * the camera's scale, so its pixels are the machine's pixels.
 *
 * Under ?harness=1 there is no loop: harness.render() is wrapped so every
 * harness shot includes the room at the harness's own clock (view.t).
 *
 * Deterministic: every pattern is a seeded hash; time is view.t in the
 * harness, else the page clock (the room is ambience, not the game).
 * No binary assets; the house pixel toolkit and the night palette.
 *
 * window.PachinkoRoom = { stats, paint(), rebuild(), CUT, geometry }.
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  var S = root.ArcadeSprites, AP = root.ArcadePalette;
  if (!S || !AP) return;
  var BAYER = S.BAYER, FONT = S.FONT;

  /* ══ the room's geometry (room px = cabinet px; the case at 0..376 × 0..560) ══ */
  var CAB_W = 376, CAB_H = 560, CAB_CX = 188, CAB_CY = 280;
  // main's case cut-out (pachinko-main.js buildRoom's cut()): x, y, w, h
  var CUT = [[2, 20, 373, 540], [124, 0, 129, 21]];
  var HOR = 300;            // the horizon: eye level, the glass's middle
  var VPX = CAB_CX;         // the room's vanishing point (straight ahead)
  var WALL_Y = 520;         // where the back wall meets the carpet
  var CEIL_Y = -40;         // where it meets the drop ceiling
  var ZW = 700;             // eye to back wall, in wall-plane px
  var FOOT = 528;           // the back row stands a little off the wall
  var ML_FOOT = CAB_H;      // MOTHER LODE stands out in the aisle
  var HALL = { l: 350, r: 478, t: 160, b: WALL_Y, hx: 430, hy: HOR, rf: 0.1 };
  var TUBE = { r: 0.8, u0: 372, u1: 464 };           // the buzzing tube, on the hall ceiling
  var HRF = { x: -241, y: FOOT - 372 };             // HOLLER ROLLER's 216-wide frame
  var SCF = { x: 484, y: FOOT - 366 };              // SCRIP CREEK's 216-wide frame
  var OOO = { x0: 740, x1: 872, y0: 196 };          // the dead upright, far right
  var WIN = { x0: -506, x1: -362, y0: 176, y1: 372 }; // the front window, far left
  var EXIT = { x: 402, y: 136, w: 25, h: 11 };
  var CLOCK = { cx: -150, cy: 92, r: 11 };
  var CARD = { x: -96, y: 104, w: 71, h: 17 };
  var ASH = { x: 402, foot: 548 };
  var OUTLET = { x: -19, y: 494 };

  /* ══ palette (albedo = the colour under full light; the night comes from the lighting) ══ */
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  var C = {
    WALL: rgb('#5a4658'), WALL2: rgb('#524052'), GROOVE: rgb('#241a26'), GRAIN: rgb('#4a3a4c'),
    SKIRT: rgb('#3e2e32'), SKIRT_T: rgb('#6c5458'), SKIRT_B: rgb('#16101a'),
    CEIL: rgb('#4e4856'), CEIL_G: rgb('#3a3442'), CEIL_ST: rgb('#54483c'), CEIL_H: rgb('#030206'), TROF: rgb('#6a6a76'), TROF_G: rgb('#4a4a56'),
    CARP: rgb('#28213a'), CARP_L: rgb('#322a46'), CARP_D: rgb('#1c1729'), WORN: rgb('#3a3448'), STAIN: rgb('#221a26'),
    BURN: rgb('#0a0608'), BURN_R: rgb('#4a3020'), GUM: rgb('#3a2e3a'),
    MOT: [rgb('#b8478a'), rgb('#3a9a94'), rgb('#b0a44a'), rgb('#7a58b8'), rgb('#4262b0'), rgb('#a49cb0')],
    HF_A: rgb('#4c4c58'), HF_B: rgb('#3a3a46'), HW: rgb('#58605a'), HW_L: rgb('#464c48'), HC: rgb('#4c4854'),
    FAR: rgb('#2a2830')
  };
  var P = {
    N0: AP.NIGHT0, N1: AP.NIGHT1, N2: AP.NIGHT2, PUR1: AP.PUR1, PUR2: AP.PUR2, FOG: AP.FOG, MOON: AP.MOON,
    BONE: AP.BONE, BONE_D: AP.BONE_D, PINK: AP.PINK, PINK_D: AP.PINK_D, PINK_DK: AP.PINK_DK,
    // HOLLER ROLLER's wood, lane, cork, possum (skeeball-render.js PAL)
    WOOD1: '#1d140d', WOOD2: '#34261a', WOOD3: '#4e3a26', WOOD4: '#684f31', WOOD5: '#83683f', WOOD6: '#9c8253',
    LANE1: '#c9a96b', LANE2: '#b28f55', LANE3: '#93743f', CORK1: '#96754e', CORK2: '#6e5335', GAP: '#0c0906',
    BRASS1: '#8c6f35', BRASS2: '#c2a04e', STEEL1: '#4c4c58', STEEL2: '#8b8b9a', RED1: '#5f222c',
    LIT: '#c2a06a', LIT_D: '#8f7340', FUR1: '#928da0', FUR2: '#625d70', FUR3: '#3b3745',
    // SCRIP CREEK's enamel, tokens, raccoon (coinpusher-render.js PAL)
    ENAM1: '#1b2030', ENAM2: '#28304a', ENAM3: '#38466b', SHELF: '#565664', SHELF_D: '#3e3e4a',
    TOK: '#b3924a', TOK_L: '#d4b25e', TOK_D: '#7e6533', RC1: '#8d8896', RC2: '#5e5a68', RC3: '#3a3742', MASK: '#16121c',
    // the room's own
    PAPER: '#d9cca3', PAPER_D: '#b8a77a', INK: '#2a221c', CHROME: '#a8a8b8', CHROME_D: '#5a5a6a',
    EXIT_R: '#ff4a3a', EXIT_D: '#8a1a16', TUBE: '#eef6ff', TUBE_E: '#a8c0d8', TUBE_OFF: '#3c404c', FILAMENT: '#c8742a',
    FARL: '#e6fff2', FARM: '#a8e0cc', FARD: '#4a7a6c', GOLD: '#ffd76a', AMBER: '#ffae3a',
    YEL: '#b89a2a', YEL_D: '#6a5616', CUP: '#d8d0c0', CUP_R: '#a83040', SCRIP: '#ff79b8', SCRIP_D: '#b04a80'
  };

  /* ══ small maths ══ */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function h32(a, b, c) {
    var h = Math.imul((a | 0) ^ 0x3c6ef372, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x9e3779b1) ^ Math.imul((c | 0) + 0x61c88647, 0x85ebca77);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h >>> 0;
  }
  function h01(a, b, c) { return h32(a, b, c) / 4294967296; }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h01(xi, yi, s), b = h01(xi + 1, yi, s), c = h01(xi, yi + 1, s), d = h01(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function bay(x, y) { return BAYER[((y & 3) << 2) | (x & 3)] / 16; }
  // a dithered pixel only once the density is real (Bayer cell 0 would pass any a > 0)
  function dth(x, y, a) { return bay(x, y) + 0.031 < a; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function ctx2d(c) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function hline(g, x0, x1, y, c) { rect(g, x0, y, x1 - x0 + 1, 1, c); }
  function vline(g, x, y0, y1, c) { rect(g, x, y0, 1, y1 - y0 + 1, c); }
  function ellipse(g, cx, cy, rx, ry, c) { S.ellipse(g, cx, cy, rx, ry, c); }
  function dither(g, x, y, w, h, c, d) {
    g.fillStyle = c;
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (bay(x + i, y + j) < d) g.fillRect(x + i, y + j, 1, 1);
  }
  function line(g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = c;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 4000; n++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function text(g, str, x, y, c, scale) { S.text(g, str, x, y, c, scale || 1); }
  function textW(str, scale) { return S.textW(str, scale || 1); }

  /* ══ perspective ══ */
  // the floor: screen y ↔ depth. f = ZW / z (1 at the back wall, bigger nearer)
  function floorF(y) { return (y - HOR) / (WALL_Y - HOR); }
  function floorY(f) { return HOR + (WALL_Y - HOR) * f; }
  function worldX(x, f) { return VPX + (x - VPX) / f; }
  function screenX(X, f) { return VPX + (X - VPX) * f; }
  // the hall: a corridor whose own vanishing point sits in its doorway
  function hallR(x, y) {
    var H = HALL, rF = y > H.hy ? (y - H.hy) / (H.b - H.hy) : -1, rC = y < H.hy ? (H.hy - y) / (H.hy - H.t) : -1;
    var rL = x < H.hx ? (H.hx - x) / (H.hx - H.l) : -1, rR = x > H.hx ? (x - H.hx) / (H.r - H.hx) : -1;
    var r = rF, s = 0;
    if (rC > r) { r = rC; s = 1; }
    if (rL > r) { r = rL; s = 2; }
    if (rR > r) { r = rR; s = 3; }
    if (r < H.rf) { r = H.rf; s = 4; }
    return { r: r, s: s };  // s: 0 floor, 1 ceiling, 2 left wall, 3 right wall, 4 far wall
  }
  function inHall(x, y) { return x >= HALL.l && x < HALL.r && y >= HALL.t && y < HALL.b; }
  function inCut(x, y) {
    for (var i = 0; i < CUT.length; i++) { var c = CUT[i]; if (x >= c[0] && x < c[0] + c[2] && y >= c[1] && y < c[1] + c[3]) return true; }
    return false;
  }

  /* ══ HOLLER ROLLER's shape (skeeball-render.js GEO, the 'grand' layout) ══ */
  var HRG = (function () {
    var maxRx = 52, ratio = 0.95, ringCy = 158, bedBottom = ringCy + Math.round(maxRx * ratio) + 14;
    var pit = { y0: bedBottom + 2, y1: bedBottom + 16 };
    return {
      marquee: { x0: 44, x1: 172, y0: 24, y1: 62 }, score: { y0: 62, y1: 84 }, ringCy: ringCy, maxRx: maxRx, ratio: ratio,
      pit: pit, ramp: { y0: pit.y1, y1: pit.y1 + 12 }, lane: { y0: pit.y1 + 12, y1: 332, xt0: 42, xt1: 174, xb0: 12, xb1: 204 },
      rail: { y0: 332, y1: 352 }, front: { y0: 352, y1: 372 }, possum: { cx: 108, top: 6 }, bot: 372, top: 18
    };
  })();
  function hrLaneHalf(y) { var ln = HRG.lane, t = (y - ln.y0) / (ln.y1 - ln.y0); return 66 + 30 * t; }
  function hrHalf(y) {
    var jy = HRG.pit.y0;
    if (y > HRG.lane.y1) return hrLaneHalf(HRG.lane.y1) + 7;
    if (y > jy) return hrLaneHalf(y) + 7;
    var jw = hrLaneHalf(jy) + 7;
    return jw - 6 * (jy - y) / (jy - HRG.top);
  }
  function hrL(y) { return Math.round(108 - hrHalf(y)); }
  function hrR(y) { return Math.round(108 + hrHalf(y)); }

  /* ══ the neighbours and the wall things (albedo, back plane) ══ */
  function drawHollerRoller(g, R, em) {
    g.save(); g.translate(HRF.x, HRF.y); em.save(); em.translate(HRF.x, HRF.y);
    var y, x;
    // body: one wood shell, the lane flaring toward us
    for (y = HRG.top; y < HRG.bot; y++) hline(g, hrL(y), hrR(y), y, P.WOOD3);
    for (var s = 0; s < 120; s++) {
      var ys = HRG.top + R() * (HRG.bot - HRG.top), len = 3 + R() * 14, t = R(), c = R() < 0.6 ? P.WOOD2 : P.WOOD4;
      for (var d = 0; d < len && ys + d < HRG.bot; d++) { var y2 = Math.round(ys + d); px(g, Math.round(hrL(y2) + t * (hrR(y2) - hrL(y2))), y2, c); }
    }
    for (y = HRG.top; y < HRG.bot; y++) { px(g, hrL(y), y, P.WOOD5); px(g, hrR(y), y, P.WOOD1); }
    // marquee board, unlit: the backlight's off, the parchment reads as dull tan
    var m = HRG.marquee;
    rect(g, m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, P.WOOD4);
    rect(g, m.x0 + 1, m.y0 + 1, m.x1 - m.x0 - 2, 2, P.WOOD5);
    rect(g, m.x0 + 1, m.y1 - 3, m.x1 - m.x0 - 2, 2, P.WOOD2);
    hline(g, m.x0 + 2, m.x1 - 3, m.y0 + 4, P.RED1); hline(g, m.x0 + 2, m.x1 - 3, m.y1 - 5, P.RED1);
    rect(g, m.x0 + 6, m.y0 + 7, m.x1 - m.x0 - 12, m.y1 - m.y0 - 14, P.LIT_D);
    dither(g, m.x0 + 6, m.y0 + 7, m.x1 - m.x0 - 12, 3, P.WOOD4, 0.5);
    S.textC(g, 'HOLLER ROLLER', 108, m.y0 + 13, P.WOOD1, 2);
    // the pink tube under it: dark glass, one stretch still lit
    for (x = m.x0 + 4; x <= m.x1 - 5; x++) { px(g, x, m.y1 - 1, x % 9 === 4 ? P.PUR2 : P.PINK_DK); px(g, x, m.y1, P.PINK_DK); }
    for (x = 131; x <= 136; x++) { px(em, x, m.y1 - 1, x === 133 ? P.MOON : P.PINK); px(em, x, m.y1, P.PINK_D); }
    for (x = 128; x <= 139; x++) if (bay(x + HRF.x, m.y1 + 1 + HRF.y) < 0.35) px(em, x, m.y1 + 1, P.PINK_DK);
    // score drums, dark
    rect(g, 76, HRG.score.y0 + 1, 64, 20, P.WOOD1);
    for (var i = 0; i < 4; i++) { rect(g, 80 + i * 14, HRG.score.y0 + 3, 12, 15, P.PAPER_D); text(g, '0', 84 + i * 14, HRG.score.y0 + 8, P.WOOD2); }
    // the ring bed
    var bx0 = hrL(HRG.score.y1) + 5, bx1 = hrR(HRG.score.y1) - 5;
    rect(g, bx0, HRG.score.y1, bx1 - bx0 + 1, HRG.pit.y0 - HRG.score.y1, P.WOOD2);
    dither(g, bx0, HRG.score.y1, bx1 - bx0 + 1, 6, P.WOOD1, 0.6);
    var FR = [1, 0.825, 0.775, 0.60, 0.55, 0.375, 0.325, 0.15, 0.10];
    for (i = 0; i < FR.length; i++) {
      var rx = Math.round(HRG.maxRx * FR[i]), ry = Math.max(1, Math.round(HRG.maxRx * HRG.ratio * FR[i]));
      ellipse(g, 108, HRG.ringCy, rx, ry, i % 2 === 0 ? P.GAP : P.CORK1);
    }
    [66, 150].forEach(function (hx) { ellipse(g, hx, 100, 11, 8, P.CORK2); ellipse(g, hx, 100, 9, 6, P.GAP); });
    text(g, '100', 58, 112, P.PINK_DK); text(g, '100', 142, 112, P.PINK_DK);
    // pit, hop, lane
    for (y = HRG.pit.y0; y < HRG.pit.y1; y++) hline(g, hrL(y) + 4, hrR(y) - 4, y, P.GAP);
    for (y = HRG.ramp.y0; y < HRG.ramp.y1; y++) hline(g, hrL(y) + 5, hrR(y) - 5, y, y < HRG.ramp.y0 + 3 ? P.WOOD2 : P.LANE3);
    var ln = HRG.lane;
    for (y = ln.y0; y < ln.y1; y++) {
      var t2 = (y - ln.y0) / (ln.y1 - ln.y0), l0 = Math.round(ln.xt0 + (ln.xb0 - ln.xt0) * t2), l1 = Math.round(ln.xt1 + (ln.xb1 - ln.xt1) * t2);
      hline(g, l0, l1, y, P.LANE2);
      // boards: four seams converging on the backstop
      for (var b = 1; b < 5; b++) px(g, Math.round(l0 + (l1 - l0) * b / 5), y, P.LANE3);
      px(g, Math.round(l0 + (l1 - l0) * 0.5) + (y % 7 === 0 ? 1 : 0), y, P.LANE1);
      px(g, l0 - 1, y, P.WOOD5); px(g, l0 - 2, y, P.WOOD4); px(g, l1 + 1, y, P.WOOD2); px(g, l1 + 2, y, P.WOOD1);
    }
    // ball-return rail and the front panel
    rect(g, hrL(HRG.rail.y0) + 3, HRG.rail.y0, hrR(HRG.rail.y0) - hrL(HRG.rail.y0) - 5, 20, P.WOOD3);
    rect(g, hrL(HRG.rail.y0) + 9, HRG.rail.y0 + 4, hrR(HRG.rail.y0) - hrL(HRG.rail.y0) - 17, 13, P.WOOD1);
    for (i = 0; i < 6; i++) ellipse(g, hrL(HRG.rail.y0) + 20 + i * 17, HRG.rail.y0 + 11, 5, 4, i < 2 ? P.STEEL1 : P.WOOD2);
    rect(g, hrL(HRG.front.y0) + 3, HRG.front.y0, hrR(HRG.front.y0) - hrL(HRG.front.y0) - 5, 20, P.WOOD3);
    rect(g, 22, HRG.front.y0 + 3, 26, 15, P.BRASS1); text(g, '5', 30, HRG.front.y0 + 8, P.WOOD1); px(g, 34, HRG.front.y0 + 8, P.WOOD1);
    rect(g, 164, HRG.front.y0 + 9, 32, 8, P.WOOD1);
    text(g, 'TICKETS', 162, HRG.front.y0 + 2, P.WOOD5);
    // a pink strip of tickets hanging out of its mouth, never torn off
    rect(g, 170, HRG.front.y0 + 13, 5, 9, P.SCRIP_D); px(g, 172, HRG.front.y0 + 17, P.PINK_DK);
    drawPossum(g);
    g.restore(); em.restore();
  }
  function drawPossum(g) {
    var cx = HRG.possum.cx, top = HRG.possum.top;
    ellipse(g, cx - 12, top + 5, 7, 7, P.FUR3); ellipse(g, cx + 12, top + 5, 7, 7, P.FUR3);
    ellipse(g, cx - 12, top + 6, 4, 4, P.PINK_D); ellipse(g, cx + 12, top + 6, 4, 4, P.PINK_D);
    rect(g, cx - 17, top + 1, 3, 3, P.N1);
    ellipse(g, cx, top + 15, 13, 11, P.FUR1);
    dither(g, cx - 13, top + 7, 8, 9, P.FUR2, 0.45); dither(g, cx + 6, top + 8, 8, 8, P.FUR2, 0.4);
    ellipse(g, cx, top + 13, 8, 6, P.BONE); ellipse(g, cx, top + 21, 6, 6, P.BONE);
    ellipse(g, cx, top + 28, 3, 4, P.BONE); ellipse(g, cx, top + 33, 2, 2, P.BONE);
    rect(g, cx - 7, top + 14, 4, 5, P.N0); rect(g, cx + 4, top + 15, 3, 4, P.N0);
    hline(g, cx - 11, cx + 11, top + 8, P.FUR2);
    rect(g, cx + 7, top + 9, 6, 4, P.STEEL2); hline(g, cx + 7, cx + 12, top + 9, P.STEEL1);
    rect(g, cx - 2, top + 34, 4, 3, P.PINK);
    px(g, cx - 6, top + 28, P.BONE_D); px(g, cx + 5, top + 28, P.BONE_D);
  }
  // the possum's eyes: where MOTHER LODE's light lands on its glass beads (room px)
  var EYESHINE = [[HRF.x + 103, HRF.y + 21], [HRF.x + 113, HRF.y + 22]];

  function drawScripCreek(g, R, em) {
    g.save(); g.translate(SCF.x, SCF.y); em.save(); em.translate(SCF.x, SCF.y);
    var x0 = 16, x1 = 200, y0 = 10, y1 = 366, i, x, y;
    // its left flank, turned toward us a little (it stands right of the eye)
    for (y = y0 + 2; y < y1; y++) {
      var w = 13;
      for (x = x0 - w; x < x0; x++) {
        var k = (x0 - x) / w, yt = y0 + 2 + Math.round(k * 7), yb = y1 - Math.round(k * 5);
        if (y >= yt && y < yb) px(g, x, y, x === x0 - w ? P.ENAM2 : P.ENAM1);
      }
    }
    rect(g, x0, y0, x1 - x0, y1 - y0, P.ENAM2);
    vline(g, x0, y0, y1 - 1, P.ENAM3); vline(g, x0 + 1, y0 + 2, y1 - 3, P.ENAM3);
    vline(g, x1 - 1, y0, y1 - 1, P.ENAM1); hline(g, x0, x1 - 1, y0, P.ENAM3);
    hline(g, x0 + 2, x1 - 3, y0 + 2, P.BRASS1);
    for (i = 0; i < 26; i++) { var cy = y0 + 8 + Math.floor(R() * (y1 - y0 - 20)), cxx = R() < 0.5 ? x0 + Math.floor(R() * 4) : x1 - 1 - Math.floor(R() * 4); px(g, cxx, cy, R() < 0.4 ? P.STEEL1 : P.ENAM1); }
    // marquee: the neon is off; the tubes are dark pink glass
    rect(g, 24, 16, 168, 32, P.N1);
    hline(g, 24, 191, 16, P.BRASS1); hline(g, 24, 191, 47, P.BRASS1); vline(g, 24, 16, 47, P.BRASS1); vline(g, 191, 16, 47, P.BRASS1);
    var name = 'SCRIP CREEK', tx = Math.round(108 - textW(name, 2) / 2);
    text(g, name, tx, 20, P.PINK_DK, 2);
    S.textC(g, 'PUSH YER LUCK', 109, 37, P.BONE_D, 1);
    // the company plaque
    rect(g, 60, 52, 96, 14, P.BRASS1); hline(g, 60, 155, 52, P.BRASS2);
    S.textC(g, 'PROPERTY OF', 108, 54, P.ENAM1, 1);
    // the glass and the raccoon's parlour
    rect(g, 26, 68, 164, 216, P.N1);
    hline(g, 25, 190, 67, P.BRASS1); hline(g, 25, 190, 284, P.BRASS1); vline(g, 25, 67, 284, P.BRASS1); vline(g, 190, 67, 284, P.BRASS1);
    hline(g, 62, 154, 114, P.BRASS1);
    var cx = 108;
    [[127, 77], [133, 85], [134, 94], [130, 102]].forEach(function (q, k) { ellipse(g, q[0], q[1], 6, 5, k % 2 ? P.MASK : P.RC1); });
    ellipse(g, 94, 68, 6, 6, P.RC2); ellipse(g, 122, 68, 6, 6, P.RC2); ellipse(g, 94, 69, 3, 3, P.MASK); ellipse(g, 122, 69, 3, 3, P.MASK);
    ellipse(g, cx, 86, 18, 14, P.RC1); dither(g, cx - 14, 74, 28, 6, P.RC2, 0.4);
    ellipse(g, 97, 84, 7, 5, P.MASK); ellipse(g, 119, 84, 7, 5, P.MASK); rect(g, 97, 82, 22, 5, P.MASK);
    hline(g, 92, 101, 78, P.BONE_D); hline(g, 115, 124, 78, P.BONE_D);
    ellipse(g, cx, 94, 6, 5, P.BONE); rect(g, cx - 2, 90, 4, 3, P.MASK);
    // the paws, pressed flat on the glass, grease halos round them
    for (i = 0; i < 2; i++) {
      var pxx = i ? 114 : 94;
      rect(g, pxx, 106, 9, 5, P.RC2);
      vline(g, pxx + 2, 102, 106, P.RC2); vline(g, pxx + 4, 101, 106, P.RC2); vline(g, pxx + 6, 102, 106, P.RC2);
      vline(g, pxx + 3, 103, 106, P.RC3); vline(g, pxx + 5, 103, 106, P.RC3);
      // the pads flattened white against the glass catch the light
      px(em, pxx + 2, 101, P.BONE_D); px(em, pxx + 4, 100, P.BONE); px(em, pxx + 6, 101, P.BONE_D);
      for (var gy = 97; gy < 114; gy++) for (var gx = pxx - 3; gx < pxx + 12; gx++) {
        var dd = ((gx - pxx - 4) * (gx - pxx - 4)) / 64 + ((gy - 105) * (gy - 105)) / 49;
        if (dd > 0.7 && dd < 1.25 && bay(gx + SCF.x, gy + SCF.y) < 0.18) px(em, gx, gy, '#2a2436');
      }
    }
    // the glass gives back one pale streak of the room, and a shorter one
    for (y = 84; y < 262; y++) for (x = 27; x < 189; x++) {
      var sd = Math.abs((x - 70) - (262 - y) * 0.36), sd2 = Math.abs((x - 84) - (262 - y) * 0.36);
      if (sd < 0.6 && y > 96) px(em, x, y, '#1c1a28');
      else if (sd2 < 0.5 && y > 150 && y < 236) px(em, x, y, '#181624');
    }
    // the field of tokens, falling away from the glass
    for (y = 152; y < 256; y++) {
      var tt = (y - 152) / 104, l = Math.round(46 + (32 - 46) * tt), r2 = 216 - l;
      hline(g, l, r2, y, y % 11 === 0 ? P.SHELF_D : P.SHELF);
    }
    rect(g, 40, 116, 136, 36, P.SHELF_D);
    for (i = 0; i < 90; i++) {
      var ty = 156 + Math.floor(R() * 98), ttt = (ty - 152) / 104, lx = 46 + (32 - 46) * ttt, cx2 = Math.round(lx + 4 + R() * (216 - 2 * lx - 8));
      ellipse(g, cx2, ty, 3, 1, R() < 0.3 ? P.TOK_D : P.TOK);
    }
    rect(g, 26, 256, 164, 28, P.N0);
    // the hud, the door, the dish
    rect(g, 26, 290, 164, 26, P.N1); vline(g, 108, 292, 313, P.ENAM2);
    text(g, 'TOKENS', 32, 294, P.ENAM3); text(g, 'TRAY', 114, 294, P.ENAM3);
    rect(g, 40, 324, 30, 28, P.STEEL1); rect(g, 52, 330, 5, 11, P.N0); text(g, 'ONE', 49, 344, P.STEEL2);
    rect(g, 118, 326, 60, 26, P.BRASS1); ellipse(g, 148, 339, 27, 8, P.N0);
    rect(g, 16, 356, 184, 10, P.ENAM1);
    g.restore(); em.restore();
  }
  // a glint or two in its token field (room px)
  var SC_GLINTS = [[SCF.x + 70, SCF.y + 178], [SCF.x + 131, SCF.y + 214], [SCF.x + 96, SCF.y + 241]];

  // the dead upright at the far right: somebody's sign taped over the tube
  function drawOutOfOrder(g, R) {
    var o = OOO, y, x;
    var W = o.x1 - o.x0, top = o.y0;
    // flank toward us
    for (y = top + 8; y < FOOT; y++) for (x = o.x0 - 12; x < o.x0; x++) {
      var k = (o.x0 - x) / 12;
      if (y > top + 8 + k * 6 && y < FOOT - k * 4) px(g, x, y, '#1c1a24');
    }
    rect(g, o.x0, top, W, FOOT - top, '#2c2a36');
    // the marquee, dark, angled
    rect(g, o.x0 + 4, top + 6, W - 8, 30, '#161420');
    dither(g, o.x0 + 6, top + 10, W - 12, 20, '#3a2a48', 0.3);
    // the bezel and the dead tube
    rect(g, o.x0 + 8, top + 44, W - 16, 110, '#121018');
    rect(g, o.x0 + 18, top + 54, W - 36, 88, '#0c1418');
    dither(g, o.x0 + 20, top + 56, 30, 20, '#1e3038', 0.35);
    // the sign, typed and taped, a little crooked
    var sx = o.x0 + 34, sy = top + 82;
    rect(g, sx, sy, 56, 22, P.PAPER); rect(g, sx, sy + 20, 56, 2, P.PAPER_D);
    rect(g, sx - 2, sy - 2, 8, 4, '#b8a870'); rect(g, sx + 50, sy - 2, 8, 4, '#b8a870');
    text(g, 'OUT OF', sx + 5, sy + 4, P.INK); text(g, 'ORDER', sx + 9, sy + 12, P.INK);
    line(g, sx + 4, sy + 10, sx + 28, sy + 10, '#8a2a2a');
    // control panel sticking out, the coin door
    rect(g, o.x0 - 4, top + 166, W + 8, 18, '#34303e'); hline(g, o.x0 - 4, o.x1 + 3, top + 166, '#4a4456');
    ellipse(g, o.x0 + 34, top + 172, 3, 2, '#5a1a22'); ellipse(g, o.x0 + 60, top + 174, 2, 2, '#5a1a22'); ellipse(g, o.x0 + 70, top + 174, 2, 2, '#1a3a5a');
    rect(g, o.x0 + 44, top + 214, 44, 30, '#1c1a24'); rect(g, o.x0 + 52, top + 222, 4, 10, '#6a2020'); rect(g, o.x0 + 74, top + 222, 4, 10, '#6a2020');
    rect(g, o.x0, FOOT - 8, W, 8, '#16141c');
  }

  // the wall things: the clock, the lost-articles card, the EXIT box, the outlet, the window
  function drawWallThings(g, em, R) {
    // the missing ceiling tile: a joist's lit edge across the dark inside it,
    // and a wire hanging out of it with a bare socket on the end
    hline(g, 204, 258, -104, '#6a6278'); hline(g, 204, 258, -103, '#3a3444'); hline(em, 214, 236, -104, '#4a4456');
    var wp = [[226, -73], [226, -69], [227, -65], [229, -62], [229, -58], [228, -55]];
    for (var wi = 0; wi < wp.length - 1; wi++) line(g, wp[wi][0], wp[wi][1], wp[wi + 1][0], wp[wi + 1][1], '#7a7488');
    rect(g, 227, -55, 3, 3, '#8a8494'); px(em, 227, -55, '#8a8494'); px(em, 226, -66, '#5a5464');
    // the clock: a company clock, the name on its face scratched off
    var c = CLOCK;
    ellipse(g, c.cx, c.cy, c.r + 1, c.r + 1, '#2a2430');
    ellipse(g, c.cx, c.cy, c.r, c.r, P.PAPER_D);
    ellipse(g, c.cx, c.cy, c.r - 1, c.r - 1, P.PAPER);
    for (var h = 0; h < 12; h++) {
      var a = h / 12 * Math.PI * 2, rr = c.r - 2;
      px(g, Math.round(c.cx + Math.sin(a) * rr), Math.round(c.cy - Math.cos(a) * rr), h % 3 ? P.PAPER_D : P.INK);
    }
    for (var s = 0; s < 7; s++) px(g, c.cx - 3 + s, c.cy + 4 + (s % 2), s % 3 ? '#6a5a48' : P.INK);
    // the card nobody reads
    var k = CARD;
    rect(g, k.x + 1, k.y + 1, k.w, k.h, '#141018');
    rect(g, k.x, k.y, k.w, k.h, P.PAPER); dither(g, k.x, k.y, k.w, k.h, P.PAPER_D, 0.3);
    rect(g, k.x + 2, k.y - 1, 5, 3, '#8a8494'); rect(g, k.x + k.w - 7, k.y - 1, 5, 3, '#8a8494');
    text(g, 'NOT RESPONSIBLE', k.x + 6, k.y + 3, P.INK);
    text(g, 'FOR LOST ARTICLES', k.x + 2, k.y + 10, P.INK);
    // EXIT, over the back hall
    var e = EXIT;
    rect(g, e.x, e.y, e.w, e.h, '#2a2228'); rect(g, e.x + 1, e.y + 1, e.w - 2, e.h - 2, '#181216');
    vline(g, e.x + 6, e.y - 6, e.y - 1, '#3a3440'); vline(g, e.x + e.w - 7, e.y - 6, e.y - 1, '#3a3440');
    text(em, 'EXIT', e.x + 5, e.y + 3, P.EXIT_R);
    // the outlet: HOLLER ROLLER is plugged in
    var o = OUTLET;
    rect(g, o.x, o.y, 6, 10, '#b8b0a0'); px(g, o.x + 2, o.y + 2, '#2a2228'); px(g, o.x + 3, o.y + 2, '#2a2228');
    rect(g, o.x + 1, o.y + 5, 4, 3, '#1c1a1e'); px(g, o.x + 5, o.y + 6, '#1c1a1e');
    // its cord runs down the skirting and away under HOLLER ROLLER
    line(g, o.x + 3, o.y + 8, o.x + 1, WALL_Y - 3, '#1c1a1e'); line(g, o.x + 1, WALL_Y - 3, o.x - 12, WALL_Y - 2, '#1c1a1e');
    // the front window, far left: the real moon in the fog (smaller and
    // dimmer than the one painted in the case), the ridge, the gravel lot,
    // the car you came in, a blind half down, and the OPEN sign's back
    var w = WIN, x, y, mx = Math.round((w.x0 + w.x1) / 2);
    rect(g, w.x0 - 5, w.y0 - 5, w.x1 - w.x0 + 10, w.y1 - w.y0 + 10, '#2a2228');
    rect(g, w.x0 - 4, w.y0 - 4, w.x1 - w.x0 + 8, w.y1 - w.y0 + 8, '#4a3e40');
    rect(g, w.x0 - 6, w.y1 + 1, w.x1 - w.x0 + 12, 5, '#5a4a4c'); hline(g, w.x0 - 6, w.x1 + 5, w.y1 + 1, '#7a6668');
    var ridgeY = function (xx) { return w.y0 + 92 + Math.round(Math.sin(xx * 0.043) * 7 + Math.sin(xx * 0.12 + 1) * 3 + Math.sin(xx * 0.31) * 1); };
    for (y = w.y0; y < w.y1; y++) for (x = w.x0; x < w.x1; x++) {
      var ry = ridgeY(x), lot = w.y0 + 150, col;
      if (y < ry) {                                  // sky, fogged
        var sk = (y - w.y0) / (ry - w.y0), fog = vnoise(x * 0.025, y * 0.08, 71);
        col = sk > 0.62 && dth(x, y, (sk - 0.62) * 2.2 + fog * 0.3) ? '#1c1c36' : dth(x + 2, y, fog * 0.35) ? '#121228' : '#0a0a1a';
        if (h01(x, y, 77) < 0.004 && sk < 0.5) col = '#5a5a78';     // a star or two through it
      } else if (y < lot) {                          // the ridge, and fog lying in the hollow below it
        var hol = (y - ry) / (lot - ry), fg = vnoise(x * 0.04, y * 0.1, 72);
        col = dth(x, y, hol * 0.7 * fg + (hol > 0.7 ? (hol - 0.7) : 0)) ? '#1a1a30' : '#07070f';
      } else {                                       // the gravel lot
        col = dth(x, y, 0.25) || h01(x, y, 5) < 0.08 ? '#141226' : '#0c0a18';
      }
      px(em, x, y, col);
    }
    // the moon: a smudge in the fog, not the painted one
    for (y = -7; y <= 7; y++) for (x = -7; x <= 7; x++) {
      var dm2 = Math.sqrt(x * x + y * y), X2 = w.x1 - 30 + x, Y2 = w.y0 + 40 + y;
      if (dm2 < 3.6) px(em, X2, Y2, dm2 < 2.2 ? '#bcb8a8' : '#8a8680');
      else if (dm2 < 7 && dth(X2, Y2, (7 - dm2) / 7 * 0.6)) px(em, X2, Y2, '#2e2e44');
    }
    // the car, parked crooked
    var cx = w.x0 + 62, cy = w.y0 + 164;
    rect(em, cx - 22, cy - 8, 44, 8, '#04040a'); rect(em, cx - 13, cy - 15, 25, 8, '#04040a'); px(em, cx - 14, cy - 9, '#04040a');
    rect(em, cx - 11, cy - 14, 9, 5, '#10101e'); rect(em, cx + 1, cy - 14, 9, 5, '#10101e');
    ellipse(em, cx - 13, cy, 3, 2, '#020206'); ellipse(em, cx + 13, cy, 3, 2, '#020206');
    hline(em, cx - 22, cx + 21, cy + 2, '#0a0a16');
    hline(em, cx - 12, cx + 10, cy - 16, '#1c1c32'); hline(em, cx - 21, cx - 14, cy - 9, '#161628');   // the fog's light on its roof
    // mullion, the blind half down (one slat bent), the glass giving back a streak of the room
    vline(em, mx, w.y0, w.y1 - 1, '#1e181c'); vline(em, mx + 1, w.y0, w.y1 - 1, '#120e12');
    for (y = w.y0; y < w.y0 + 36; y += 3) {
      for (x = w.x0; x < w.x1; x++) {
        var bent = y === w.y0 + 30 && x > w.x0 + 20 && x < w.x0 + 58 ? Math.round((x - w.x0 - 20) * 0.12) : 0;
        px(em, x, y + bent, '#3a3238'); if (y + bent + 1 < w.y0 + 38) px(em, x, y + bent + 1, '#241e26');
      }
    }
    line(em, w.x0 + 20, w.y0, w.x0 + 20, w.y0 + 42, '#2a2622'); px(em, w.x0 + 20, w.y0 + 43, '#3a342e');
    for (y = w.y0 + 36; y < w.y1; y++) { var sx2 = w.x0 + 96 + Math.round((y - w.y0) * -0.3); px(em, sx2, y, '#1c1a2c'); px(em, sx2 + 1, y, '#16142a'); }
    var nx = w.x0 + 18, ny = w.y0 + 46;
    // the sign hangs on two chains; from in here you see its back: the tubes
    // the wrong way round, the glow on the glass round them, the transformer
    line(em, nx + 2, w.y0 + 36, nx + 2, ny - 1, '#2a2622'); line(em, nx + 34, w.y0 + 36, nx + 34, ny - 1, '#2a2622');
    for (y = ny - 5; y < ny + 17; y++) for (x = nx - 4; x < nx + 42; x++) {
      var ex2 = Math.max(nx + 2 - x, 0, x - (nx + 36)), ey2 = Math.max(ny + 1 - y, 0, y - (ny + 11)), de = Math.sqrt(ex2 * ex2 + ey2 * ey2);
      if (dth(x, y, 0.55 * Math.exp(-de / 2.2))) px(em, x, y, '#3a1430');
    }
    mirroredNeon(em, 'OPEN', nx + 4, ny + 1);
    rect(em, nx + 12, ny + 14, 10, 5, '#0e0c10'); hline(em, nx + 12, nx + 21, ny + 14, '#1e1a20');   // its transformer
    line(em, nx + 17, ny + 19, nx + 17, w.y1 - 1, '#0e0c10');
  }
  // OPEN, seen from inside: every letter the wrong way round
  function mirroredNeon(g, str, x, y) {
    var w = textW(str, 2), tmp = mk(w + 2, 12), tg = ctx2d(tmp);
    text(tg, str, 1, 1, P.PINK, 2);
    g.save(); g.translate(x + w + 2, y); g.scale(-1, 1); g.drawImage(tmp, 0, 0); g.restore();
  }

  /* ══ things on the carpet (lit by the floor where they stand) ══ */
  function propList() {
    var L = [];
    function add(x, y, w, h, foot, fn) { var c = mk(w, h), g = ctx2d(c); fn(g, w, h); L.push({ c: c, x: x, y: y, fx: x + w / 2, fy: foot }); }
    // MOTHER LODE's power cord: out from under its left foot, across the
    // carpet to the wall, and the plug lying just short of the outlet
    add(-30, 520, 34, 40, 556, function (g) {
      var pts = [[33, 37], [27, 36], [21, 35], [16, 32], [14, 28], [16, 23], [19, 19], [18, 15], [14, 13]];
      for (var i = 0; i < pts.length - 1; i++) {
        line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#2a2632');
        line(g, pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, '#5a5464');
      }
      // the plug on its side, prongs to the wall, a hand's width short
      rect(g, 9, 11, 6, 4, '#3a3640'); hline(g, 9, 14, 11, '#6a6474'); px(g, 15, 13, '#2a2632');
      hline(g, 5, 8, 12, '#c8c8d4'); hline(g, 5, 8, 14, '#c8c8d4'); px(g, 5, 12, '#f0f0f8');
    });
    // a dropped token, heads up
    add(-40, 548, 7, 4, 551, function (g) { ellipse(g, 3, 1, 3, 1, P.TOK_L); hline(g, 1, 5, 2, P.TOK); px(g, 3, 1, P.TOK_D); hline(g, 1, 5, 3, '#0e0a10'); });
    // a pink scrip stub, torn at the perforation
    add(-86, 541, 9, 4, 544, function (g) { rect(g, 0, 0, 8, 3, P.SCRIP); px(g, 3, 1, P.SCRIP_D); px(g, 4, 1, P.SCRIP_D); px(g, 8, 0, P.SCRIP); px(g, 8, 2, P.SCRIP); hline(g, 0, 7, 3, '#0e0a10'); });
    // a squashed paper cup and its straw, in the hall's light
    add(452, 569, 13, 7, 575, function (g) {
      rect(g, 3, 1, 8, 5, P.CUP); rect(g, 10, 2, 2, 3, P.CUP); hline(g, 3, 10, 3, P.CUP_R); px(g, 2, 2, P.CUP); px(g, 2, 3, P.CUP);
      rect(g, 4, 1, 3, 1, '#b8b0a0'); line(g, 0, 0, 3, 2, P.PINK_D); hline(g, 2, 11, 6, '#0e0a10');
    });
    // the ashtray stand by the hall: chrome pole, sand bowl, a cigarette left burning
    add(ASH.x - 8, ASH.foot - 66, 17, 67, ASH.foot, function (g) {
      ellipse(g, 8, 64, 7, 2, P.CHROME_D); hline(g, 2, 14, 64, P.CHROME);
      vline(g, 8, 8, 63, P.CHROME); vline(g, 9, 8, 63, P.CHROME_D);
      ellipse(g, 8, 6, 7, 3, P.CHROME_D); hline(g, 1, 15, 5, P.CHROME); hline(g, 2, 14, 4, '#8a8070'); hline(g, 3, 13, 3, '#9a9080');
      px(g, 5, 3, '#e8e0d0'); px(g, 11, 2, '#e8e0d0'); px(g, 12, 2, '#e8e0d0');   // butts in the sand
      hline(g, 13, 16, 3, '#e8e0d0'); px(g, 16, 3, '#6a5a48');                    // the one still going
    });
    // the mop bucket, far right, the janitor gone home
    add(846, 604, 30, 38, 640, function (g) {
      rect(g, 3, 14, 24, 18, P.YEL); rect(g, 3, 14, 24, 2, '#d8c050'); vline(g, 3, 14, 31, P.YEL_D); vline(g, 26, 14, 31, P.YEL_D);
      rect(g, 2, 32, 26, 3, P.YEL_D); ellipse(g, 6, 35, 2, 2, '#141018'); ellipse(g, 24, 35, 2, 2, '#141018');
      rect(g, 14, 8, 12, 6, P.YEL_D); rect(g, 15, 9, 10, 4, P.YEL);
      line(g, 9, 0, 13, 20, '#8a6a3a'); line(g, 10, 0, 14, 20, '#6a4a2a');
      for (var i = 0; i < 6; i++) line(g, 12 + i, 18, 10 + i * 2, 24, '#a8a090');
      hline(g, 4, 18, 13, '#3a4a5a');
    });
    return L;
  }

  /* ══ the carpet: cosmic confetti, faded, stained, burned ══ */
  function bitmap(rows) {
    var h = rows.length, w = rows[0].length, px2 = new Uint8Array(w * h), count = new Uint8Array(h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (rows[j][i] === '#') { px2[j * w + i] = 1; count[j]++; }
    return { w: w, h: h, px: px2, count: count };
  }
  var MOTIFS = [
    bitmap(['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...']),                 // sparkle
    bitmap(['....###....', '...#####...', '###########', '...#####...', '....###....']),                     // ringed planet
    bitmap(['#...#...#..', '.#.#.#.#.#.', '..#...#...#']),                                                   // zigzag
    bitmap(['...#...', '..#.#..', '.#...#.', '#######']),                                                    // triangle
    bitmap(['.###.', '#...#', '#.#.#', '#..#.', '.##..']),                                                   // swirl
    bitmap(['..##', '.##.', '####', '.##.', '##..']),                                                        // bolt
    bitmap(['.##', '#..', '#..', '.##']),                                                                   // crescent
    bitmap(['#.#', '...', '.#.'])                                                                           // dots
  ];
  // worn thin where people have stood for years (world X, Z; radii)
  var WORN = [[236, 520, 150, 46], [-120, 620, 90, 38], [590, 624, 84, 36], [400, 640, 50, 30]];
  function wornAt(X, Z) {
    var w = 0;
    for (var i = 0; i < WORN.length; i++) {
      var q = WORN[i], dx = (X - q[0]) / q[2], dz = (Z - q[1]) / q[3], d = dx * dx + dz * dz;
      if (d < 1) w = Math.max(w, (1 - d) * (1 - d));
    }
    return w;
  }

  /* ══ light ══ */
  var AMB = [0.14, 0.12, 0.22], AMB_H = [0.075, 0.07, 0.12];
  var LC = {
    MQ: [0.78, 0.56, 0.36], BODY: [0.42, 0.34, 0.66], POOL: [0.78, 0.56, 0.52],
    TUBE: [0.62, 0.76, 0.95], FAR: [0.52, 0.86, 0.72], EXIT: [0.9, 0.14, 0.1], OPEN: [0.9, 0.22, 0.55], HRP: [0.8, 0.2, 0.5]
  };
  function add3(o, c, k) { o[0] += c[0] * k; o[1] += c[1] * k; o[2] += c[2] * k; }
  // the room's ambient falls away from the machine: the corners of a dark
  // room are darker, and the eye goes where the light is
  function vign(x, y) { var dx = x - CAB_CX, dy = (y - 330) * 1.3, d = Math.sqrt(dx * dx + dy * dy); return 1 - 0.55 * sstep(300, 980, d); }
  function ambient(o, x, y, a) { var v = vign(x, y); o[0] = a[0] * v; o[1] = a[1] * v; o[2] = a[2] * v; }
  // MOTHER LODE's halo on the back plane (the wall, the neighbours)
  function halo(o, x, y, k) {
    var dxm = Math.max(2 - x, 0, x - 373), dym = Math.max(20 - y, 0, y - 66), dm = Math.sqrt(dxm * dxm + dym * dym * 1.3);
    var dxb = Math.max(2 - x, 0, x - 374), dyb = Math.max(66 - y, 0, y - CAB_H), db = Math.sqrt(dxb * dxb + dyb * dyb);
    add3(o, LC.MQ, k * 0.95 * Math.exp(-dm / 52) * Math.max(0, 1 - dm / 460));
    add3(o, LC.BODY, k * 0.42 * Math.exp(-db / 110) * Math.max(0, 1 - db / 560));
  }
  function pointL(o, c, k, x, y, cx, cy, r) { var d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r); add3(o, c, k / (1 + d2 * 4) * Math.max(0, 1 - d2 / 9)); }
  // the room's small lights
  function smallLights(o, x, y) {
    pointL(o, LC.EXIT, 0.55, x, y, EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2, 22);
    pointL(o, LC.HRP, 0.35, x, y, HRF.x + 133, HRF.y + 62, 14);
    if (x < WIN.x1 + 120 && x > WIN.x0 - 140) pointL(o, LC.OPEN, 0.55, x, y, WIN.x0 + 48, WIN.y0 + 54, 64);
  }
  // the far machine's hum-light and the tube, in the hall's own terms
  function hallCoords(x, y, r) { return { u: HALL.hx + (x - HALL.hx) / r, v: HALL.hy + (y - HALL.hy) / r, d: ZW * (1 / r - 1) }; }
  var FAR_D = ZW * (1 / HALL.rf - 1);
  function farLight(o, u, v, d, k) {
    var du = u - HALL.hx, dv = v - 440, dd = d - FAR_D, dist = Math.sqrt(du * du + dv * dv + dd * dd);
    add3(o, LC.FAR, k * (0.9 / (1 + (dist / 260) * (dist / 260)) + 0.22 / (1 + (dist / 1400) * (dist / 1400))));
  }
  // the waxed linoleum gives the machine back: a long cold streak toward you
  // (added over the floor, not multiplied into it: it's a reflection)
  function farSheen(u, d, k) {
    var du = Math.abs(u - HALL.hx), back = Math.max(0, FAR_D - d);
    return k * Math.exp(-du / 30) * (0.1 + 0.9 * Math.exp(-back / 1500)) * (0.6 + 0.4 * Math.exp(-du / 10));
  }
  function tubeLight(o, u, v, d, k) {
    var tu = clamp(u, TUBE.u0, TUBE.u1), td = ZW * (1 / TUBE.r - 1);
    var du = u - tu, dv = v - HALL.t, dd = d - td, dist = Math.sqrt(du * du + dv * dv + dd * dd);
    var I = k * 1.1 / (1 + (dist / 200) * (dist / 200)) * Math.max(0, 1 - dist / 1400);
    add3(o, LC.TUBE, I); TUBE_ADD += I;
  }
  // the tube's light out of the doorway onto the carpet (only through the opening)
  function tubeOnFloor(o, X, Z, k) {
    var d = Z - ZW, td = ZW * (1 / TUBE.r - 1), uc = (TUBE.u0 + TUBE.u1) / 2;
    if (d > 0) return;
    var s = td / (td - d), xi = uc + (X - uc) * s;
    var edge = sstep(HALL.l - 6, HALL.l + 18, xi) * (1 - sstep(HALL.r - 18, HALL.r + 6, xi));
    if (edge <= 0) return;
    var dist = Math.sqrt((X - uc) * (X - uc) + 360 * 360 + (td - d) * (td - d));
    var I = k * edge * 2.2 / (1 + (dist / 260) * (dist / 260));
    add3(o, LC.TUBE, I); TUBE_ADD += I;
  }
  var TUBE_ADD = 0;   // how much tube light the last lightAt() added (for the tube-off patch's extent)
  // the floor: MOTHER LODE's pool in front of it, the dark behind its flanks
  function floorLight(o, x, y, X, Z) {
    var fML = floorF(ML_FOOT), zML = ZW / fML;
    var mlX0 = worldX(2, fML), mlX1 = worldX(374, fML);
    var dX = Math.max(mlX0 - X, 0, X - mlX1);
    if (y >= ML_FOOT) {
      var dz = zML - Z;
      var I = 0.95 * Math.exp(-dz / 150) * Math.exp(-dX / 95);
      I += 0.25 * Math.exp(-dz / 60) * Math.exp(-dX / 30);
      add3(o, LC.POOL, I);
    } else {
      add3(o, LC.BODY, 0.5 * Math.exp(-Math.max(0, Math.max(2 - x, x - 374)) / 46));
    }
    halo(o, x, WALL_Y - 40, 0.35);
  }
  // how much of each pixel is in shadow (contact shadows, the flanks)
  function floorShade(x, y) {
    var k = 1;
    if (y >= ML_FOOT && y < ML_FOOT + 3 && x >= 0 && x <= 376) k *= y === ML_FOOT ? 0.2 : 0.55;
    if (y < ML_FOOT && y >= WALL_Y && (x > -9 && x < 2 || x > 374 && x < 385)) k *= 0.45 + 0.55 * sstep(0, 9, x < 2 ? 2 - x : x - 374);
    if (y >= FOOT && y < FOOT + 4) {
      if (x >= HRF.x + 2 && x <= HRF.x + 214) k *= y === FOOT ? 0.2 : 0.6;
      if (x >= SCF.x + 2 && x <= SCF.x + 200) k *= y === FOOT ? 0.2 : 0.6;
      if (x >= OOO.x0 - 12 && x <= OOO.x1) k *= y === FOOT ? 0.2 : 0.6;
    }
    return k;
  }

  /* ══ the build: bake the room for this screen ══ */
  var room = null;   // {rb:{x0,y0,w,h}, base, tubeOff, glow:[…], farSprite, far rect, stats}
  function* buildGen(devW, devH) {
    var t0 = now();
    var sA = Math.max(1, Math.floor(Math.min(devW / CAB_W, devH / CAB_H)));
    var vw = devW / sA, vh = devH / sA;
    var rb = { x0: Math.floor(CAB_CX - vw / 2) - 3, y0: Math.floor(CAB_CY - vh / 2) - 3 };
    rb.w = Math.ceil(vw) + 7; rb.h = Math.ceil(vh) + 7; rb.x1 = rb.x0 + rb.w; rb.y1 = rb.y0 + rb.h;
    var W = rb.w, H = rb.h, N = W * H;
    var R = (function (seed) { var a = seed >>> 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(1913);

    // 1. the background albedo, pixel by pixel: wall, ceiling, hall, carpet
    var alb = new Uint8ClampedArray(N * 4), kind = new Uint8Array(N), rr = new Float32Array(N);
    var FLOOR = 1, WALL = 2, CEIL = 3, HALLK = 4;
    var x, y, i, o, c;
    // the panelling: planks of 12–22 px, the grooves where they meet
    var plank = new Int32Array(W), groove = new Uint8Array(W);
    for (var pk = 0, px0 = -2000; px0 < rb.x1; pk++) {
      var pw = 12 + Math.floor(h01(pk, 0, 17) * 11);
      for (x = px0; x < px0 + pw; x++) if (x >= rb.x0 && x < rb.x1) { plank[x - rb.x0] = pk; groove[x - rb.x0] = x === px0 ? 1 : 0; }
      px0 += pw;
    }
    for (y = rb.y0; y < rb.y1; y++) {
     if ((y - rb.y0) % 40 === 39) yield 0;
     for (x = rb.x0; x < rb.x1; x++) {
      i = (y - rb.y0) * W + (x - rb.x0); o = i * 4; c = null;
      if (y >= WALL_Y && !(inHall(x, y))) {
        kind[i] = FLOOR;
        var hh = h01(x, y, 3);
        c = hh < 0.16 ? C.CARP_L : hh > 0.9 ? C.CARP_D : C.CARP;
        var f = floorF(y + 0.5), X = worldX(x + 0.5, f), Z = ZW / f;
        var stn = vnoise(X / 21, Z / 13, 11) * 0.7 + vnoise(X / 7, Z / 5, 12) * 0.3;
        if (stn > 0.7 && dth(x, y, (stn - 0.7) * 6)) c = C.STAIN;
        var wv = wornAt(X, Z);
        if (wv > 0 && dth(x, y, wv * 1.4)) c = C.WORN;
      } else if (inHall(x, y)) {
        kind[i] = HALLK;
        var hr = hallR(x + 0.5, y + 0.5), hc = hallCoords(x + 0.5, y + 0.5, hr.r);
        rr[i] = hr.r; kind[i] = 10 + hr.s;
        if (hr.s === 0) {         // the hall floor: linoleum squares, waxed
          var tile = (Math.floor(hc.u / 32) + Math.floor(hc.d / 40)) & 1;
          c = hr.r < 0.28 ? C.HF_B : tile ? C.HF_A : C.HF_B;
        } else if (hr.s === 1) {  // its ceiling, dead tubes crossing it
          c = C.HC;
          [0.56, 0.4, 0.3, 0.23, 0.18, 0.145, 0.12].forEach(function (tr) { if (hr.r <= tr && hr.r > tr - Math.max(0.004, 0.022 * tr) && hc.u > 376 && hc.u < 460) c = C.TROF; });
        } else if (hr.s === 2 || hr.s === 3) {  // painted block walls
          var course = Math.floor(hc.v / 20), jointD = Math.floor((hc.d + (course & 1) * 40) / 80);
          c = C.HW;
          if (hr.r > 0.3 && (Math.abs(hc.v - course * 20) < 1.2 / hr.r * 0.6)) c = C.HW_L;
          // a door on the right-hand wall, halfway down
          if (hr.s === 3 && hc.d > 820 && hc.d < 1120 && hc.v > 250) c = hc.d < 835 || hc.d > 1105 || hc.v < 262 ? C.HW_L : rgb('#3c3430');
        } else c = C.FAR;
      } else if (y < CEIL_Y) {
        kind[i] = CEIL;
        var fz = (HOR - y) / (HOR - CEIL_Y), cX = worldX(x + 0.5, fz), cZ = ZW / fz;
        var fzL = (HOR - y - 1) / (HOR - CEIL_Y), ix = Math.floor(cX / 64), iz = Math.floor(cZ / 64);
        var ixL = Math.floor(worldX(x - 0.5, fz) / 64), izD = Math.floor(ZW / fzL / 64);
        var th = h01(ix, iz, 21);
        c = C.CEIL;
        if (th < 0.1 && vnoise(cX / 14, cZ / 14, 5) > 0.55 && bay(x, y) < 0.6) c = C.CEIL_ST;  // water-stained
        if (ix === 3 && iz === 9) c = C.CEIL_H;                                        // a tile missing
        if ((ix === -2 || ix === 7) && (iz === 8 || iz === 9)) c = ((Math.floor(cX / 8) + Math.floor(cZ / 16)) & 1) ? C.TROF : C.TROF_G; // dead troffers
        if (ix !== ixL || iz !== izD) c = C.CEIL_G;
      } else {
        kind[i] = WALL;
        var board = plank[x - rb.x0];
        c = (board & 1) ? C.WALL : C.WALL2;
        if (vnoise(x * 0.9, y * 0.035, board) > 0.74) c = C.GRAIN;
        if (groove[x - rb.x0]) c = C.GROOVE;
        if (y < CEIL_Y + 3) c = C.GROOVE;
        if (y >= WALL_Y - 9) c = y === WALL_Y - 9 ? C.SKIRT_T : y >= WALL_Y - 1 ? C.SKIRT_B : C.SKIRT;
      }
      alb[o] = c[0]; alb[o + 1] = c[1]; alb[o + 2] = c[2]; alb[o + 3] = 255;
     }
    }
    yield 0;
    // the hall's doorway: a plain jamb and a header
    for (y = HALL.t - 4; y < WALL_Y; y++) for (x = HALL.l - 4; x < HALL.r + 4; x++) {
      if (inHall(x, y) || x < rb.x0 || x >= rb.x1 || y < rb.y0 || y >= rb.y1) continue;
      i = (y - rb.y0) * W + (x - rb.x0); o = i * 4;
      c = (x === HALL.r || y === HALL.t - 1) ? rgb('#241c24') : rgb('#6a5a60');
      if (y >= WALL_Y - 9) continue;
      alb[o] = c[0]; alb[o + 1] = c[1]; alb[o + 2] = c[2];
    }
    // the carpet's confetti, in perspective
    var fB = floorF(rb.y1), zMin = ZW / fB;
    function putF(x2, y2, col) {
      if (x2 < rb.x0 || x2 >= rb.x1 || y2 < WALL_Y || y2 >= rb.y1) return;
      var j = (y2 - rb.y0) * W + (x2 - rb.x0); if (kind[j] !== FLOOR) return;
      var q = j * 4; alb[q] = col[0]; alb[q + 1] = col[1]; alb[q + 2] = col[2];
    }
    var CELL = 30;
    for (var cz = Math.floor(zMin / CELL); cz * CELL <= ZW + CELL; cz++) {
      for (var sub = 0; sub < 2; sub++) {
        var Zc = (cz + 0.25 + h01(cz, sub, 41) * 0.5) * CELL;
        if (Zc > ZW - 2 || Zc < zMin - CELL) continue;
        var fc = ZW / Zc, yc = floorY(fc);
        var Xa = worldX(rb.x0 - 20, fc), Xb = worldX(rb.x1 + 20, fc);
        for (var cx = Math.floor(Xa / CELL); cx * CELL <= Xb; cx++) {
          var hsh = h01(cx, cz, 97 + sub);
          if (hsh > 0.86) continue;
          var Xc = (cx + h01(cx, cz, 13 + sub)) * CELL, sxc = screenX(Xc, fc);
          var mi = h32(cx, cz, 7 + sub) % MOTIFS.length, bm = MOTIFS[mi];
          var col = C.MOT[h32(cx, cz, 31 + sub) % C.MOT.length];
          var wv2 = wornAt(Xc, Zc);
          col = [col[0] + (C.WORN[0] - col[0]) * (0.35 + wv2 * 0.5), col[1] + (C.WORN[1] - col[1]) * (0.35 + wv2 * 0.5), col[2] + (C.WORN[2] - col[2]) * (0.35 + wv2 * 0.5)];
          var hs = fc, vs = fc * fc * (WALL_Y - HOR) / ZW;
          var w2 = Math.max(1, Math.round(bm.w * hs)), h2 = Math.max(1, Math.round(bm.h * vs));
          var bx = Math.round(sxc - w2 / 2), by = Math.round(yc - h2 / 2);
          for (var jj = 0; jj < h2; jj++) {
            var r0 = Math.floor(jj * bm.h / h2), r1 = Math.max(r0, Math.floor((jj + 1) * bm.h / h2) - 1), best = r0, bn = -1, mid = (r0 + r1) / 2;
            for (var rw = r0; rw <= r1; rw++) { var n2 = bm.count[rw]; if (n2 > bn || (n2 === bn && Math.abs(rw - mid) < Math.abs(best - mid))) { best = rw; bn = n2; } }
            for (var ii = 0; ii < w2; ii++) { var sc = Math.min(bm.w - 1, Math.floor((ii + 0.5) * bm.w / w2)); if (bm.px[best * bm.w + sc]) putF(bx + ii, by + jj, col); }
          }
          // loose confetti between the figures
          for (var dd2 = 0; dd2 < 3; dd2++) {
            var Xd = (cx + h01(cx, cz, 50 + dd2)) * CELL, Zd = (cz + h01(cx, cz, 60 + dd2)) * CELL;
            if (Zd > ZW) continue;
            var fd = ZW / Zd; putF(Math.round(screenX(Xd, fd)), Math.round(floorY(fd)), C.MOT[h32(cx, cz, 70 + dd2) % C.MOT.length]);
          }
        }
      }
    }
    // cigarette burns and gum
    for (var bi = 0; bi < 160; bi++) {
      var Zb = zMin + h01(bi, 1, 88) * (ZW - zMin), fb = ZW / Zb, yb = Math.round(floorY(fb));
      var xb = Math.round(rb.x0 + h01(bi, 2, 88) * rb.w);
      if (h01(bi, 3, 88) < 0.45) {
        putF(xb, yb, C.BURN); if (fb > 1.3) { putF(xb + 1, yb, C.BURN); putF(xb - 1, yb, C.BURN_R); putF(xb + 2, yb, C.BURN_R); }
      } else { putF(xb, yb, C.GUM); putF(xb + 1, yb, C.GUM); if (fb > 1.5) putF(xb, yb + 1, C.GUM); }
    }
    // a strip of duct tape over a tear in front of HOLLER ROLLER
    for (x = -150; x < -104; x++) { var yt2 = 548 + Math.round((x + 150) * 0.04); putF(x, yt2, rgb('#8a8a94')); putF(x, yt2 + 1, rgb('#6a6a74')); }

    // 2. the objects: neighbours and wall things (albedo) + what glows on them
    var objC = mk(W, H), og = ctx2d(objC), emC = mk(W, H), eg = ctx2d(emC);
    og.translate(-rb.x0, -rb.y0); eg.translate(-rb.x0, -rb.y0);
    drawWallThings(og, eg, R);
    drawHollerRoller(og, R, eg);
    drawScripCreek(og, R, eg);
    drawOutOfOrder(og, R);
    var obj = og.getImageData(0, 0, W, H).data;

    // 3. light it
    var Lx = [0, 0, 0], SHEEN = 0, SHC = rgb('#5a9a88');
    function lightAt(x2, y2, j, state) {
      var k = kind[j]; SHEEN = 0; TUBE_ADD = 0;
      ambient(Lx, x2, y2, AMB);
      if (obj[j * 4 + 3]) {
        halo(Lx, x2, y2, 1); smallLights(Lx, x2, y2);
        // the doorway side of SCRIP CREEK's flank catches the tube
        if (state.tube && x2 > SCF.x && x2 < SCF.x + 20 && y2 > 170) { var It = 0.35 * (1 - (x2 - SCF.x) / 20) * Math.exp(-Math.abs(y2 - 250) / 160); add3(Lx, LC.TUBE, It); TUBE_ADD += It; }
        return Lx;
      }
      if (k === FLOOR) {
        var f2 = floorF(y2 + 0.5), X2 = worldX(x2 + 0.5, f2), Z2 = ZW / f2;
        floorLight(Lx, x2, y2, X2, Z2);
        if (state.tube) tubeOnFloor(Lx, X2, Z2, 1);
        farOnFloor(Lx, X2, Z2, state.glow);
        smallLights(Lx, x2, y2 - 30);
        var sh = floorShade(x2, y2); Lx[0] *= sh; Lx[1] *= sh; Lx[2] *= sh;
        return Lx;
      }
      if (k >= 10) {
        var r3 = rr[j], hc2 = hallCoords(x2 + 0.5, y2 + 0.5, r3);
        Lx[0] = AMB_H[0]; Lx[1] = AMB_H[1]; Lx[2] = AMB_H[2];
        var mouth = sstep(0.72, 1, r3);
        if (mouth > 0) halo(Lx, x2, y2, mouth * 0.7);
        farLight(Lx, hc2.u, hc2.v, hc2.d, state.glow);
        if (state.tube) tubeLight(Lx, hc2.u, hc2.v, hc2.d, 1.5);
        SHEEN = k === 10 ? farSheen(hc2.u, hc2.d, state.glow) : 0;
        return Lx;
      }
      halo(Lx, x2, y2, 1); smallLights(Lx, x2, y2);
      return Lx;
    }
    function farOnFloor(o2, X2, Z2, k) {
      // a thin cold line of the far machine's light out of the doorway
      var d = Z2 - ZW; if (d > 0) return;
      var s = FAR_D / (FAR_D - d), xi = HALL.hx + (X2 - HALL.hx) * s;
      if (xi < HALL.l || xi > HALL.r) return;
      add3(o2, LC.FAR, k * 0.2 * Math.exp(-Math.abs(X2 - HALL.hx) / 26) * Math.exp(d / 120));
    }
    function compose(x0, y0, w, h, state) { var img = new ImageData(w, h); composeRows(img, x0, y0, w, y0, y0 + h, state); return img; }
    var TB = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    function composeRows(img, x0, y0, w, ya, yb, state, track) {
      var d = img.data;
      for (var yy = ya; yy < yb; yy++) for (var xx = x0; xx < x0 + w; xx++) {
        var j = (yy - rb.y0) * W + (xx - rb.x0), q = j * 4, p = ((yy - y0) * w + (xx - x0)) * 4;
        var L = lightAt(xx, yy, j, state);
        if (track && TUBE_ADD > 0.003) { if (xx < TB.x0) TB.x0 = xx; if (xx > TB.x1) TB.x1 = xx; if (yy < TB.y0) TB.y0 = yy; if (yy > TB.y1) TB.y1 = yy; }
        var I = Math.max(L[0], L[1], L[2]) || 1e-6;
        // quantise the light on the Bayer grid: the house's dithered falloff
        var lv = I * 14, fl = Math.floor(lv), Iq = (fl + (lv - fl > bay(xx, yy) ? 1 : 0)) / 14;
        var kq = Iq / I, src = obj[q + 3] ? obj : alb;
        d[p] = src[q] * L[0] * kq; d[p + 1] = src[q + 1] * L[1] * kq; d[p + 2] = src[q + 2] * L[2] * kq; d[p + 3] = 255;
        if (SHEEN > 0.03 && dth(xx + 2, yy + 1, SHEEN * 1.1)) { d[p] += SHC[0] * SHEEN; d[p + 1] += SHC[1] * SHEEN; d[p + 2] += SHC[2] * SHEEN; }
      }
    }
    var ST = { tube: true, glow: 1 };
    var base = mk(W, H), bg = ctx2d(base), baseImg = new ImageData(W, H);
    yield 0;
    for (var yb2 = rb.y0; yb2 < rb.y1; yb2 += 16) { composeRows(baseImg, rb.x0, rb.y0, W, yb2, Math.min(rb.y1, yb2 + 16), ST, true); yield 0; }
    bg.putImageData(baseImg, 0, 0);

    // 4. the props on the carpet, each lit by the floor where it stands
    var props = propList().filter(function (p) { return !(p.y > rb.y1 || p.x > rb.x1 || p.x + p.c.width < rb.x0 || p.y + p.c.height < rb.y0); });
    function litProp(p, tube) {
      var L = [0, 0, 0], f2 = floorF(p.fy), X2 = worldX(p.fx, f2), Z2 = ZW / f2;
      ambient(L, p.fx, p.fy, AMB);
      floorLight(L, p.fx, p.fy, X2, Z2); if (tube) tubeOnFloor(L, X2, Z2, 1.4); smallLights(L, p.fx, p.fy - 30);
      halo(L, p.fx, p.y, 0.5);
      var c2 = mk(p.c.width, p.c.height), g2 = ctx2d(c2); g2.drawImage(p.c, 0, 0);
      var im = g2.getImageData(0, 0, c2.width, c2.height), dd = im.data;
      for (var q = 0; q < dd.length; q += 4) if (dd[q + 3]) { dd[q] *= Math.min(1.1, L[0] * 1.15); dd[q + 1] *= Math.min(1.1, L[1] * 1.15); dd[q + 2] *= Math.min(1.1, L[2] * 1.15); }
      g2.putImageData(im, 0, 0);
      return c2;
    }
    props.forEach(function (p) { bg.drawImage(litProp(p, true), p.x - rb.x0, p.y - rb.y0); });
    px(bg, -38 - rb.x0, 548 - rb.y0, '#e8c870');      // the token's edge catches the light
    yield 0;

    // 5. what glows by itself
    bg.drawImage(emC, 0, 0);
    bg.save(); bg.translate(-rb.x0, -rb.y0); drawHallEmissive(bg, true); drawFarMachine(bg, 1); bg.restore();

    // 6. the patches for the slow states: the tube out, the far machine's hum
    // the patch covers every pixel the tube lit (and the tube itself, and the props near it)
    var tl0 = tubeLine();
    var TP = { x0: Math.min(TB.x0, tl0.x0 - 4, ASH.x - 10), y0: Math.min(TB.y0, tl0.y - 4), x1: Math.max(TB.x1 + 1, tl0.x1 + 5), y1: Math.max(TB.y1 + 1, tl0.y + 4) };
    TP.x0 = Math.max(TP.x0, rb.x0); TP.y0 = Math.max(TP.y0, rb.y0); TP.x1 = Math.min(TP.x1, rb.x1); TP.y1 = Math.min(TP.y1, rb.y1);
    var tubeOff = null;
    if (TP.x1 > TP.x0 && TP.y1 > TP.y0) {
      tubeOff = { x: TP.x0, y: TP.y0, c: mk(TP.x1 - TP.x0, TP.y1 - TP.y0) };
      var tg = ctx2d(tubeOff.c);
      tg.putImageData(compose(TP.x0, TP.y0, TP.x1 - TP.x0, TP.y1 - TP.y0, { tube: false, glow: 1 }), 0, 0);
      // the props and the glows inside the patch, again, in the dark
      tg.save(); tg.translate(-TP.x0, -TP.y0);
      props.forEach(function (p) {
        if (p.x + p.c.width < TP.x0 || p.x > TP.x1 || p.y + p.c.height < TP.y0 || p.y > TP.y1) return;
        tg.drawImage(litProp(p, false), p.x, p.y);
      });
      tg.drawImage(emC, rb.x0, rb.y0);
      drawHallEmissive(tg, false); drawFarMachine(tg, 1);
      tg.restore();
    }
    yield 0;
    var GP = { x0: 404, y0: 276, x1: 456, y1: 340 }, glow = [[], []];
    [false, true].forEach(function (tube) {
      [0.72, 0.86].forEach(function (k) {
        var gc = mk(GP.x1 - GP.x0, GP.y1 - GP.y0), gg = ctx2d(gc);
        gg.putImageData(compose(GP.x0, GP.y0, GP.x1 - GP.x0, GP.y1 - GP.y0, { tube: tube, glow: k }), 0, 0);
        gg.translate(-GP.x0, -GP.y0); drawFarMachine(gg, k);
        glow[tube ? 1 : 0].push({ x: GP.x0, y: GP.y0, c: gc, k: k });
      });
    });
    // the far machine alone, to shine through the dim in PLAY
    var farSprite = mk(GP.x1 - GP.x0, GP.y1 - GP.y0), fg = ctx2d(farSprite); fg.translate(-GP.x0, -GP.y0); drawFarMachine(fg, 1);

    // 7. the cut: never a pixel over the machine
    [bg].forEach(function (g3) { CUT.forEach(function (q) { g3.clearRect(q[0] - rb.x0, q[1] - rb.y0, q[2], q[3]); }); });

    yield 0;
    // the light the haze sees, at a quarter resolution
    var LG = { x0: rb.x0, y0: rb.y0, w: Math.ceil(W / 4) + 1, h: Math.ceil(H / 4) + 1 };
    LG.r = new Float32Array(LG.w * LG.h); LG.g = new Float32Array(LG.w * LG.h); LG.b = new Float32Array(LG.w * LG.h); LG.t = new Float32Array(LG.w * LG.h);
    for (var gy = 0; gy < LG.h; gy++) for (var gx = 0; gx < LG.w; gx++) {
      var lx = rb.x0 + gx * 4, ly = rb.y0 + gy * 4, L3 = [0.02, 0.02, 0.03];
      if (ly < WALL_Y + 20) {
        halo(L3, lx, ly, 1); smallLights(L3, lx, ly);
        if (inHall(lx, ly)) { var hr2 = hallR(lx, ly), hc3 = hallCoords(lx, ly, hr2.r); farLight(L3, hc3.u, hc3.v, hc3.d, 0.7); }
      }
      var gi = gy * LG.w + gx; LG.r[gi] = L3[0]; LG.g[gi] = L3[1]; LG.b[gi] = L3[2];
      // the tube's glow hanging in the air round the doorway, kept apart so it goes out with the tube
      var LT = [0, 0, 0]; pointL(LT, [1, 1, 1], 0.8, lx, ly, (tl0.x0 + tl0.x1) / 2, tl0.y + 20, 60); LG.t[gi] = LT[0];
    }

    return {
      rb: rb, sA: sA, devW: devW, devH: devH, base: base, tubeOff: tubeOff, glow: glow, farSprite: { x: GP.x0, y: GP.y0, c: farSprite },
      lg: LG, ms: now() - t0
    };
  }

  // the tube and its fixture on the hall ceiling (on: lit; off: dark glass, the ends glowing)
  function tubeLine() {
    var r = TUBE.r, y = Math.round(HALL.hy + (HALL.t - HALL.hy) * r) + 2;
    return { x0: Math.round(HALL.hx + (TUBE.u0 - HALL.hx) * r), x1: Math.round(HALL.hx + (TUBE.u1 - HALL.hx) * r), y: y };
  }
  function drawHallEmissive(g, on) {
    var t = tubeLine();
    hline(g, t.x0 - 2, t.x1 + 2, t.y - 2, '#1a1820');
    hline(g, t.x0 - 1, t.x1 + 1, t.y - 1, '#2a2830');
    if (on) {
      hline(g, t.x0, t.x1, t.y, P.TUBE); hline(g, t.x0, t.x1, t.y + 1, P.TUBE_E);
      for (var x = t.x0; x <= t.x1; x++) if (bay(x, t.y + 2) < 0.4) px(g, x, t.y + 2, '#56607a');
    } else {
      hline(g, t.x0, t.x1, t.y, P.TUBE_OFF); hline(g, t.x0, t.x1, t.y + 1, '#2a2e38');
      px(g, t.x0, t.y, P.FILAMENT); px(g, t.x0 + 1, t.y, '#6a3a1a'); px(g, t.x1, t.y, P.FILAMENT);
    }
  }
  // the machine at the end of the hall: a lit shape, nothing on it
  function drawFarMachine(g, k) {
    var r = HALL.rf, fx = HALL.hx, fy = Math.round(HALL.hy + (HALL.b - HALL.hy) * r);
    var w = 7, h = 17, x0 = Math.round(fx - w / 2), y0 = fy - h;
    // the air round it, lit: a soft ordered glow, densest at its face
    for (var y = y0 - 9; y < fy + 1; y++) for (var x = x0 - 8; x < x0 + w + 8; x++) {
      var dx = Math.max(x0 - x, 0, x - (x0 + w - 1)), dy = Math.max(y0 + 3 - y, 0, y - (fy - 1)), d = Math.sqrt(dx * dx + dy * dy * 1.4);
      if (d === 0) continue;
      var a = Math.exp(-d / 1.7) * 0.95 * k;
      if (a > 0.22 && dth(x, y, a)) px(g, x, y, a > 0.5 && dth(x + 1, y + 2, a - 0.3) ? '#3e6a5e' : '#24403a');
    }
    // its silhouette: a crest, shoulders, the lit face (nothing on it), a plinth
    rect(g, x0, y0 + 3, w, h - 3, '#101c1a');
    rect(g, x0 + 1, y0 + 1, w - 2, 2, '#101c1a'); px(g, x0 + 3, y0, '#101c1a');
    var face = k > 0.9 ? '#cfeee0' : k > 0.8 ? '#a8dcc8' : '#88c4b0';
    rect(g, x0 + 1, y0 + 4, w - 2, 9, face);
    hline(g, x0 + 1, x0 + w - 2, y0 + 4, k > 0.9 ? '#f4fff8' : face);
    hline(g, x0 + 1, x0 + w - 2, y0 + 12, '#6aa290');
    px(g, x0 + 3, y0 + 1, '#5a8a7c');
    rect(g, x0 + 1, y0 + 14, w - 2, 2, '#1c302c');
  }

  /* ══ the live things ══ */
  // the smoke: veils hanging where there's light to see them by, drifting
  // toward the back hall (the draught goes that way), fading out at the
  // edges of the light rather than wrapping round
  var WISPS = [];
  var HAZE_X0 = -330, HAZE_X1 = 720;
  // lookup tables: exp(-q) for q in [0, 5), and a tile of smoke-noise
  var EXPL = new Float32Array(256); for (var ei = 0; ei < 256; ei++) EXPL[ei] = Math.exp(-ei * 5 / 256);
  var NZ = new Float32Array(256 * 64); for (var ny2 = 0; ny2 < 64; ny2++) for (var nx2 = 0; nx2 < 256; nx2++) NZ[ny2 * 256 + nx2] = vnoise(nx2 * 0.06, ny2 * 0.16, 5) * 0.8 + vnoise(nx2 * 0.2, ny2 * 0.4, 6) * 0.2;
  (function () {
    var spec = [
      [40, -22, 230, 26], [330, 2, 210, 20], [-70, 58, 170, 22], [470, 76, 160, 24], [436, 214, 104, 34],
      [-150, 128, 150, 20], [600, 150, 180, 22], [190, -70, 280, 30], [-260, -30, 190, 24], [250, 100, 120, 18]
    ];
    spec.forEach(function (q, i) {
      WISPS.push({ x: q[0], y: q[1], w: q[2], h: q[3], v: 1.2 + h01(i, 1, 9) * 1.8, ph: h01(i, 2, 9) * 50, i: i });
    });
  })();
  function hazeWisp(w, t, rb, lg, tubeOn) {
    // three puffs that drift apart and back together; the dither is fixed to
    // the room's pixels, so the smoke crawls across it rather than sliding
    var span = HAZE_X1 - HAZE_X0, u = (((w.x - HAZE_X0 + w.v * t) % span) + span) % span, cx = HAZE_X0 + u;
    var fade = sstep(0, 90, u) * (1 - sstep(span - 120, span, u));
    if (fade <= 0.02) return null;
    var cy = w.y + Math.sin(t / 23 + w.ph) * 6;
    var puffs = [], bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (var k = 0; k < 3; k++) {
      var pp = [cx + (k - 1) * w.w * 0.26 + Math.sin(t / (17 + k * 5) + w.ph + k) * w.w * 0.1, cy + Math.sin(t / (13 + k * 7) + k * 2 + w.ph) * w.h * 0.22, w.w * (0.2 + 0.05 * k), w.h * (0.34 + 0.05 * ((k + 1) % 3))];
      puffs.push(pp);
      // a puff reaches q = 5 at 2.24 radii: the canvas holds all of it, no hard edges
      bx0 = Math.min(bx0, pp[0] - pp[2] * 2.25); bx1 = Math.max(bx1, pp[0] + pp[2] * 2.25);
      by0 = Math.min(by0, pp[1] - pp[3] * 2.25); by1 = Math.max(by1, pp[1] + pp[3] * 2.25);
    }
    var x0 = Math.floor(bx0), y0 = Math.floor(by0), bw = Math.ceil(bx1) - x0 + 1, bh = Math.ceil(by1) - y0 + 1;
    if (x0 > rb.x1 || x0 + bw < rb.x0 || y0 > rb.y1 || y0 + bh < rb.y0) return null;
    var cache = w.cache || (w.cache = { c: mk(bw, bh) });
    if (cache.c.width < bw || cache.c.height < bh) cache.c = mk(Math.max(bw, cache.c.width), Math.max(bh, cache.c.height));
    var g = ctx2d(cache.c); g.clearRect(0, 0, cache.c.width, cache.c.height);
    // (one buffer per wisp, grown as needed and reused: no allocation a step)
    if (!cache.img || cache.img.width < bw || cache.img.height < bh) cache.img = g.createImageData(Math.max(bw, cache.img ? cache.img.width : 0) + 8, Math.max(bh, cache.img ? cache.img.height : 0) + 4);
    var img = cache.img, d = img.data, IW = img.width;
    for (var cr = 0; cr < bh; cr++) d.fill(0, cr * IW * 4, (cr * IW + bw) * 4);
    var any = false;
    var nshift = Math.floor(t * 0.7) + w.i * 37;
    for (var y = y0; y < y0 + bh; y++) {
      var gy = clamp(Math.round((y - lg.y0) / 4), 0, lg.h - 1), nrow = ((y + w.i * 11) & 63) * 256;
      for (var x = x0; x < x0 + bw; x++) {
        var gx = clamp(Math.round((x - lg.x0) / 4), 0, lg.w - 1), gi = gy * lg.w + gx;
        var tt = tubeOn ? lg.t[gi] : 0, lr = lg.r[gi] + tt * LC.TUBE[0], lgg = lg.g[gi] + tt * LC.TUBE[1], lb = lg.b[gi] + tt * LC.TUBE[2];
        var I = Math.max(lr, lgg, lb);
        if (I < 0.05) continue;
        var den = 0;
        for (k = 0; k < 3; k++) { var p = puffs[k], ux = (x - p[0]) / p[2], uy = (y - p[1]) / p[3], q = ux * ux + uy * uy; if (q < 5) den += EXPL[(q * 51.2) | 0]; }
        if (den < 0.05) continue;
        den *= (0.45 + 0.55 * NZ[nrow + ((x + nshift) & 255)]) * fade;
        var a = Math.min(1, den) * Math.min(1, I * 1.8);
        if (dth(x, y, a)) {
          var o = ((y - y0) * IW + (x - x0)) * 4, hz = 170 + 50 * Math.min(1, den);
          d[o] = hz * Math.min(1.1, lr) + 34; d[o + 1] = hz * Math.min(1.1, lgg) + 30; d[o + 2] = hz * Math.min(1.1, lb) + 48;
          d[o + 3] = 40 + 60 * a;
          any = true;
        }
      }
    }
    g.putImageData(img, 0, 0, 0, 0, bw, bh);
    return any ? { c: cache.c, x: x0, y: y0 } : null;
  }

  // the tube's schedule: mostly on, a stutter now and then, sometimes a dark spell
  function tubeOnAt(t, calm) {
    if (calm) return true;
    var slot = Math.floor(t / 11), u = t - slot * 11;
    if (h01(slot, 0, 311) > 0.62) return true;
    var st = h01(slot, 1, 311) * 7, dur = 0.35 + h01(slot, 2, 311) * 1.2, dark = h01(slot, 3, 311) < 0.3 ? 1.5 + h01(slot, 4, 311) * 3 : 0;
    if (u < st || u > st + dur + dark + 0.5) return true;
    if (u > st + dur && u < st + dur + dark) return false;
    if (u >= st + dur + dark) return h01(Math.floor(u * 24), slot, 313) > 0.35;   // re-striking
    return h01(Math.floor(u * 30), slot, 312) > 0.5;
  }
  function glowLevel(t, calm) { if (calm) return 2; var v = Math.sin(t * 2 * Math.PI / 4.6) + 0.35 * Math.sin(t * 2 * Math.PI / 17); return v > 0.5 ? 2 : v > -0.55 ? 1 : 0; }

  var wake = { t0: null };
  function drawLive(g, t, calm, rb, flare) {
    // the cigarette in the stand: the ember breathes, the smoke climbs and leans toward the hall
    var ex = ASH.x + 8, ey = ASH.foot - 63;
    var br = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3) * Math.sin(t * 0.37);
    px(g, ex, ey, br > 0.2 ? '#ff7a2a' : '#a8401a');
    if (br > 0.75) px(g, ex, ey - 1, '#ffb070');
    var lx = null;
    for (var i = 0; i < 44; i++) {
      var yy = ey - 2 - i, a = i / 44, sway = Math.sin(i * 0.16 - t * 1.7) * (1 + a * 5) + a * a * 9;
      // near the top it curls over once, the way a thread of smoke does in still air
      if (i > 30) sway += Math.sin((i - 30) * 0.5) * 2.5;
      var xx = Math.round(ex + sway), col = i < 10 ? 'rgba(190,182,200,0.8)' : i < 24 ? 'rgba(150,140,170,0.6)' : 'rgba(120,110,145,' + (0.45 * (1 - (i - 24) / 20)).toFixed(2) + ')';
      if (i > 36 && bay(xx, yy) > (1 - a) * 1.6) { lx = xx; continue; }            // breaking up at the end
      px(g, xx, yy, col);
      if (lx != null && Math.abs(xx - lx) > 1) px(g, (xx + lx) >> 1, yy, col);    // never a gap in the line
      lx = xx;
    }
    // the unplugged plug's prongs catch the marquee's light now and then
    if (calm || Math.floor(t / 2.3) % 3 === 0) { px(g, -25, 532, '#fff8e8'); px(g, -24, 534, '#d8d8e4'); }
    // the mother lode wakes the building for one beat: HOLLER ROLLER's
    // backlight stutters on, SCRIP CREEK's neon buzzes pink, then it's dark
    if (flare > 0.5) { if (wake.t0 == null || t < wake.t0) wake.t0 = t; } else if (flare <= 0.02) wake.t0 = null;
    var wu = wake.t0 != null ? t - wake.t0 : 9;
    if (!calm && wu < 1.4) {
      var on = wu < 0.08 || (wu > 0.16 && wu < 0.3) || (wu > 0.42 && wu < 1.1 && h01(Math.floor(t * 20), 7, 521) > 0.15);
      if (on) {
        var hm = HRG.marquee;
        rect(g, HRF.x + hm.x0 + 6, HRF.y + hm.y0 + 7, hm.x1 - hm.x0 - 12, hm.y1 - hm.y0 - 14, P.LIT);
        S.textC(g, 'HOLLER ROLLER', HRF.x + 108, HRF.y + hm.y0 + 13, P.WOOD1, 2);
        for (var hx2 = hm.x0 + 4; hx2 <= hm.x1 - 5; hx2++) px(g, HRF.x + hx2, HRF.y + hm.y1 - 1, P.PINK);
      }
      var on2 = wu > 0.1 && wu < 1.3 && h01(Math.floor(t * 30), 8, 522) > 0.25;
      if (on2) { var nm = 'SCRIP CREEK'; text(g, nm, SCF.x + Math.round(108 - textW(nm, 2) / 2), SCF.y + 20, P.PINK, 2); }
    }
    // the moth at the EXIT sign
    var mt = calm ? 0 : Math.floor(t * 8) / 8;
    var mx = EXIT.x + EXIT.w / 2 + Math.sin(mt * 1.9) * 16 + Math.sin(mt * 5.3) * 3, my = EXIT.y + 4 + Math.sin(mt * 2.7 + 1) * 8 + Math.cos(mt * 4.1) * 2;
    var flap = Math.floor(mt * 8) % 2;
    mx = Math.round(mx); my = Math.round(my);
    rect(g, mx, my, 1, 2, '#6a5a50');
    if (flap) { px(g, mx - 1, my, '#c8b8a0'); px(g, mx + 1, my, '#c8b8a0'); px(g, mx - 2, my - 1, '#8a7a6a'); px(g, mx + 2, my - 1, '#8a7a6a'); }
    else { px(g, mx - 1, my + 1, '#a89880'); px(g, mx + 1, my + 1, '#a89880'); }
    // the possum's glass eyes catch MOTHER LODE's light; now and then the lids flutter
    var blinkSlot = Math.floor(t / 7.3), bu = t - blinkSlot * 7.3, blink = !calm && h01(blinkSlot, 0, 401) < 0.55 && bu > 3 && bu < 3.16;
    if (flare > 0.3) {   // the jackpot's light: the possum's glass eyes blaze
      [[EYESHINE[0][0] - 1, EYESHINE[0][1]], [EYESHINE[1][0] - 1, EYESHINE[1][1]]].forEach(function (e) {
        rect(g, e[0], e[1], 2, 2, '#fff3c2'); px(g, e[0] - 1, e[1], P.GOLD); px(g, e[0] + 2, e[1] + 1, P.GOLD);
      });
    } else if (!blink) {
      px(g, EYESHINE[0][0], EYESHINE[0][1], P.GOLD); px(g, EYESHINE[0][0], EYESHINE[0][1] + 1, '#a8741e');
      px(g, EYESHINE[1][0], EYESHINE[1][1], P.GOLD);
    }
    // the clock: it said 2:13 when you came in, and it only goes forward
    var secs = 2 * 3600 + 13 * 60 + t, hh = secs / 3600 % 12, mm = secs / 60 % 60, ss = Math.floor(secs % 60);
    var c = CLOCK;
    // the dial: nicotine cream, lit by the marquee's spill (it has to read:
    // it is the one thing in the room that only goes forward)
    ellipse(g, c.cx, c.cy, c.r - 1, c.r - 1, '#9a8c6c'); ellipse(g, c.cx, c.cy, c.r - 3, c.r - 3, '#aa9c78');
    for (var q = 0; q < 12; q++) {
      var qa = q / 12 * Math.PI * 2, qr = c.r - 2;
      px(g, Math.round(c.cx + Math.sin(qa) * qr), Math.round(c.cy - Math.cos(qa) * qr), q % 3 ? '#6a5e48' : '#1a1410');
    }
    for (var sq = 0; sq < 7; sq++) px(g, c.cx - 3 + sq, c.cy + 5 + (sq % 2), sq % 3 ? '#7a6c52' : '#3a3024');   // the name, scratched off
    function hand(frac, len, col) { var a = frac * Math.PI * 2; line(g, c.cx, c.cy, c.cx + Math.sin(a) * len, c.cy - Math.cos(a) * len, col); }
    hand(hh / 12, 5, '#141016'); hand(Math.floor(mm) / 60, 7, '#141016'); if (!calm) hand(ss / 60, 8, '#b0302a');
    px(g, c.cx, c.cy, '#6a1a18');
    // a glint on the dropped token, and in SCRIP CREEK's field
    var gs = Math.floor(t / 5.1);
    if (!calm && h01(gs, 0, 501) < 0.5 && t - gs * 5.1 < 0.25) { var tx = -37, ty = 548; px(g, tx, ty, '#fff4c0'); px(g, tx - 1, ty, '#d4b25e'); px(g, tx + 1, ty, '#d4b25e'); px(g, tx, ty - 1, '#d4b25e'); }
    var gs2 = Math.floor(t / 3.7), gq = SC_GLINTS[h32(gs2, 0, 503) % SC_GLINTS.length];
    if (!calm && t - gs2 * 3.7 < 0.3) { px(g, gq[0], gq[1], '#ffe9a8'); if (t - gs2 * 3.7 < 0.15) { px(g, gq[0] - 1, gq[1], P.TOK_L); px(g, gq[0] + 1, gq[1], P.TOK_L); } }
    // the car out in the lot: its hazards are still going
    var hz = calm ? 1 : Math.floor(t * 1.4) % 2;
    if (hz) { var cx2 = WIN.x0 + 62, cy2 = WIN.y0 + 164; px(g, cx2 - 22, cy2 - 6, P.AMBER); px(g, cx2 + 21, cy2 - 6, P.AMBER); px(g, cx2 - 21, cy2 - 6, '#8a5a1a'); px(g, cx2 + 20, cy2 - 6, '#8a5a1a'); if (bay(cx2, cy2) >= 0) { px(g, cx2 - 22, cy2 - 3, '#5a3a14'); px(g, cx2 + 21, cy2 - 3, '#5a3a14'); } }
  }

  /* ══ mounting over main's canvas ══ */
  function now() { return root.performance && performance.now ? performance.now() : 0; }
  var M = null;   // the mounted state
  var stats = { builds: 0, buildMs: 0, statics: 0, staticMs: 0, lives: 0, liveMs: 0, hazes: 0 };

  function mount(handle) {
    var host = document.getElementById('pachinko-mount');
    var main = host && host.querySelector('canvas.pachinko-canvas');
    if (!main || !handle.view) return false;
    function layer(cls) {
      var c = document.createElement('canvas'); c.className = 'pachinko-room ' + cls; c.setAttribute('aria-hidden', 'true');
      return c;
    }
    var sc = layer('pachinko-room-static'), lc = layer('pachinko-room-live');
    main.parentNode.insertBefore(sc, main.nextSibling);   // static right over the game canvas…
    main.parentNode.insertBefore(lc, sc.nextSibling);     // …the live things over that
    var calm = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    sc.style.opacity = lc.style.opacity = '0';
    M = { handle: handle, main: main, sc: sc, lc: lc, sctx: ctx2d(sc), lctx: ctx2d(lc), room: null, lastKey: '', liveKey: '', pendingSize: null, sizeT: 0, t0: now(), calm: calm, harness: !!handle.harness };
    return true;
  }
  function placeLayers() {
    var m = M.main, w = m.width, h = m.height;
    [M.sc, M.lc].forEach(function (c) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      c.style.width = m.style.width; c.style.height = m.style.height;
      c.style.left = m.offsetLeft + 'px'; c.style.top = m.offsetTop + 'px';
    });
    M.sctx.imageSmoothingEnabled = false; M.lctx.imageSmoothingEnabled = false;
  }
  // the room comes up softly once it's baked (and goes dark while a resize re-bakes it)
  function show(on) {
    [M.sc, M.lc].forEach(function (c) {
      c.style.transition = on && !M.harness ? 'opacity 0.9s ease-out' : 'none';
      c.style.opacity = on ? '1' : '0';
    });
  }
  function clock() { var v = M.handle.view; return M.harness ? (v.t || 0) : (now() - M.t0) / 1000; }
  // the case's jolt (the 13 landing, the vein cracking): the room jolts with
  // it. main's blit() is mirrored here; a view.jolt = [jx, jy] from main, if
  // it ever sets one, wins (requests.md)
  function jolt(cam) {
    var v = M.handle.view, fx = v.fx || {}, t = v.t || 0;
    if (v.jolt && v.jolt.length === 2) return v.jolt;
    if (cam.k !== 1) return [0, 0];
    // (main jolts at the 13 itself only when no part has taken the lode over;
    // with the mischief part loaded, the part's own fx.shake is the jolt)
    var su = fx.lode && !(root.PachinkoMischief && root.PachinkoMischief.attach) ? t - fx.lode.t0 : -1, dur = 0.3, sa = 1, sh = fx.shake;
    if (sh && t - sh.t0 >= 0 && t - sh.t0 < sh.dur) { su = t - sh.t0; dur = sh.dur; sa = sh.amp || 1; }
    if (su < 0 || su >= dur) return [0, 0];
    var amp = Math.round((1 - su / dur) * Math.max(1, cam.s / 2) * sa);
    return [Math.floor(su * 60) % 2 ? amp : -amp, Math.floor(su * 45) % 2 ? amp : 0];
  }
  // the mother lode's flare reaches the room: the dim lifts for a moment
  function flareOf() { var fx = M.handle.view.fx; return fx && fx.flare > 0 ? Math.min(1, fx.flare) : 0; }
  function dimOf(cam) { var k = clamp(cam.k || 0, 0, 1); return k * k * (3 - 2 * k); }
  function camXform(g, cam, j) {
    var s = cam.s, ox = (M.room.rb.x0 - cam.x) * s + j[0], oy = (M.room.rb.y0 - cam.y) * s + j[1];
    if (cam.k === 0 || cam.k === 1) { ox = Math.round(ox); oy = Math.round(oy); }
    g.setTransform(s, 0, 0, s, ox, oy);
  }
  function clearCut(g, cam, j) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    CUT.forEach(function (q) {
      var x0 = Math.round((q[0] - cam.x) * cam.s + j[0]), y0 = Math.round((q[1] - cam.y) * cam.s + j[1]);
      var x1 = Math.round((q[0] + q[2] - cam.x) * cam.s + j[0]), y1 = Math.round((q[1] + q[3] - cam.y) * cam.s + j[1]);
      g.clearRect(x0, y0, x1 - x0, y1 - y0);
    });
  }
  function paintStatic(cam, j, t) {
    var t0 = now(), g = M.sctx, rm = M.room, W = M.sc.width, H = M.sc.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    camXform(g, cam, j);
    var rb = rm.rb;
    g.drawImage(rm.base, 0, 0);
    var st = M.state;
    if (!st.tube && rm.tubeOff) g.drawImage(rm.tubeOff.c, rm.tubeOff.x - rb.x0, rm.tubeOff.y - rb.y0);
    if (st.glow < 2) { var gp = rm.glow[st.tube ? 1 : 0][st.glow]; g.drawImage(gp.c, gp.x - rb.x0, gp.y - rb.y0); }
    var dim = dimOf(cam) * (1 - 0.8 * M.flare);
    if (dim > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(7,6,13,' + (0.72 * dim).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      // the one down the hall stays on
      camXform(g, cam, j); g.globalAlpha = 0.55 * dim;
      g.drawImage(rm.farSprite.c, rm.farSprite.x - rb.x0, rm.farSprite.y - rb.y0);
      g.globalAlpha = 1;
    }
    clearCut(g, cam, j);
    stats.statics++; stats.staticMs += now() - t0;
  }
  function paintLive(cam, j, t) {
    var t0 = now(), g = M.lctx, rm = M.room, W = M.lc.width, H = M.lc.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    camXform(g, cam, j);
    var rb = rm.rb, dim = dimOf(cam) * (1 - 0.8 * M.flare);
    g.save();
    g.globalAlpha = 1 - 0.75 * dim;
    // the smoke moves on its own slower clock (4 fps); between its steps the
    // cached veils are only re-blitted
    var ht = M.calm ? 0 : Math.floor(t * 4) / 4, hk = ht + '|' + M.state.tube + '|' + rm.lg.w;
    if (M.hazeKey !== hk) { M.haze = WISPS.map(function (w) { return hazeWisp(w, ht, rb, rm.lg, M.state.tube); }); M.hazeKey = hk; stats.hazes++; }
    g.translate(-rb.x0, -rb.y0);
    for (var i = 0; i < M.haze.length; i++) { var r = M.haze[i]; if (r) g.drawImage(r.c, r.x, r.y); }
    drawLive(g, t, M.calm, rb, M.flare);
    g.restore(); g.globalAlpha = 1;
    clearCut(g, cam, j);
    stats.lives++; stats.liveMs += now() - t0;
  }
  function frameKey(cam, j) { return [cam.x, cam.y, cam.s, cam.k, j[0], j[1], M.sc.width, M.sc.height].join(','); }

  function tick(force) {
    if (!M) return;
    var main = M.main, w = main.width, h = main.height;
    // the machine was taken away (handle.destroy()): the room goes with it
    if (!main.isConnected) { M.sc.remove(); M.lc.remove(); M = null; return; }
    if (!M.room || M.room.devW !== w || M.room.devH !== h) {
      var key = w + 'x' + h;
      // wait for the size to settle (a window drag re-bakes once, not per
      // step), then bake in slices of ≤ 6 ms so the game never hitches
      if (!force && M.pendingSize !== key) { M.pendingSize = key; M.sizeT = now(); M.gen = null; show(false); return; }
      if (!force && now() - M.sizeT < 140) return;
      if (!M.gen || M.genKey !== key) { M.gen = buildGen(w, h); M.genKey = key; M.genT = 0; }
      var t0 = now(), r;
      do { r = M.gen.next(); } while (!r.done && (force || now() - t0 < 6));
      M.genT += now() - t0;
      if (!r.done) return;
      M.room = r.value; M.gen = null; stats.builds++; stats.buildMs = M.genT; M.pendingSize = null; M.lastKey = ''; M.liveKey = '';
      show(true);
    }
    placeLayers();
    var v = M.handle.view, cam = v.cam;
    if (!cam || !cam.s) return;
    var j = jolt(cam), t = clock();
    M.state = { tube: tubeOnAt(t, M.calm), glow: glowLevel(t, M.calm) };
    M.flare = Math.round(flareOf() * 12) / 12;
    var key = frameKey(cam, j) + '|' + M.state.tube + M.state.glow + '|' + M.flare;
    if (force || key !== M.lastKey) { paintStatic(cam, j, t); M.lastKey = key; }
    var lkey = frameKey(cam, j) + '|' + M.flare + '|' + (M.calm ? 0 : Math.floor(t * 8)) + M.state.tube + (M.calm ? Math.floor(t / 60) : 0);
    if (force || lkey !== M.liveKey) { paintLive(cam, j, t); M.liveKey = lkey; }
  }
  function loop() { tick(false); if (M) root.requestAnimationFrame(loop); }

  function start() {
    var h = root.__pachinko;
    if (!h || !h.view) { setTimeout(start, 30); return; }
    if (!mount(h)) return;
    if (M.harness && h.harness) {
      // every harness shot includes the room, at the harness's clock
      var H = h.harness, r0 = H.render;
      H.render = function () { var v = r0.apply(H, arguments); tick(true); return v; };
      tick(true);
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { setTimeout(function () { tick(true); }, 0); }).observe(M.main.parentNode);
    } else root.requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);

  root.PachinkoRoom = {
    stats: stats, CUT: CUT,
    geometry: { WALL_Y: WALL_Y, CEIL_Y: CEIL_Y, HOR: HOR, HALL: HALL, HRF: HRF, SCF: SCF },
    paint: function () { tick(true); }, tick: function () { tick(false); }, rebuild: function () { if (M) { M.room = null; M.gen = null; tick(true); } },
    get room() { return M && M.room; }
  };
})(typeof window !== 'undefined' ? window : this);
