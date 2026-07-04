/* HOLLER ROLLER — renderer
 *
 * All art is procedural pixel art drawn from PAL with a seeded RNG, so the
 * wood grain, stains, and wear are identical on every load. The machine is
 * rendered once into a static offscreen layer at boot; drawFrame() blits it
 * and paints the few live elements (window fog, dying marquee bulb, neon
 * breathing, possum blink) on top.
 *
 * Internal resolution 216×384 (9:16 portrait). Machine-space coordinates for
 * the ball sim come later (milestone 2); everything here is screen-space.
 */
window.SkeeBallRender = (function () {
  'use strict';

  var W = 216, H = 384;

  /* ── palette ───────────────────────────────────────────────────────── */
  var PAL = {
    // the room at night
    NIGHT0: '#07060d', NIGHT1: '#100e1e', NIGHT2: '#1a1730',
    PUR1: '#2c2347', PUR2: '#453567', FOG: '#6f5d95',
    MOON: '#f2eede',
    // bone
    BONE: '#e8dfc8', BONE_D: '#b0a78d',
    // electric pink
    PINK: '#ff4fa8', PINK_D: '#a63a70', PINK_DK: '#521f3c',
    // aged cabinet wood, amber gone grey
    WOOD1: '#1d140d', WOOD2: '#34261a', WOOD3: '#4e3a26',
    WOOD4: '#684f31', WOOD5: '#83683f', WOOD6: '#9c8253',
    // lane wax
    LANE1: '#c9a96b', LANE2: '#b28f55', LANE3: '#93743f',
    // cork rings
    CORK1: '#96754e', CORK2: '#6e5335', CORK3: '#b3915f',
    GAP: '#0c0906',
    // hardware
    BRASS1: '#8c6f35', BRASS2: '#c2a04e',
    STEEL1: '#4c4c58', STEEL2: '#8b8b9a',
    // faded hand-painted trim
    RED1: '#5f222c', RED2: '#8a3340',
    // marquee backlight
    LIT: '#eeddA4', LIT_D: '#c6b075',
    // possum
    FUR1: '#928da0', FUR2: '#625d70', FUR3: '#3b3745'
  };

  /* ── deterministic RNG (mulberry32) ────────────────────────────────── */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ── pixel helpers ─────────────────────────────────────────────────── */
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function hline(g, x0, x1, y, c) { rect(g, x0, y, x1 - x0 + 1, 1, c); }
  function vline(g, x, y0, y1, c) { rect(g, x, y0, 1, y1 - y0 + 1, c); }

  // filled ellipse, rasterized row by row
  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var dy = -ry; dy <= ry; dy++) {
      var t = dy / (ry + 0.5);
      var hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
      g.fillRect(Math.round(cx - hw), cy + dy, Math.round(hw * 2) || 1, 1);
    }
  }

  // checkerboard dither fill: density 0..1 via threshold on a 4×4 bayer-ish grid
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dither(g, x, y, w, h, c, density) {
    g.fillStyle = c;
    for (var j = 0; j < h; j++)
      for (var i = 0; i < w; i++)
        if (BAYER[(j % 4) * 4 + (i % 4)] / 16 < density)
          g.fillRect(x + i, y + j, 1, 1);
  }

  // dithered ellipse ring (for glows)
  function glowRing(g, cx, cy, rx, ry, spread, c, density) {
    g.fillStyle = c;
    for (var j = -(ry + spread); j <= ry + spread; j++)
      for (var i = -(rx + spread); i <= rx + spread; i++) {
        var d = (i * i) / ((rx + spread) * (rx + spread)) + (j * j) / ((ry + spread) * (ry + spread));
        var inner = (i * i) / (rx * rx) + (j * j) / (ry * ry);
        if (d <= 1 && inner > 1 &&
          BAYER[((j + 64) % 4) * 4 + ((i + 64) % 4)] / 16 < density * (1 - d) * 2)
          g.fillRect(cx + i, cy + j, 1, 1);
      }
  }

  /* ── 3×5 pixel font ────────────────────────────────────────────────── */
  var FONT = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
    E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
    I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
    Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 7, 1, 7],
    '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 2, 2],
    '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
    '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2], '!': [2, 2, 2, 0, 2],
    '¢': [2, 3, 6, 3, 2], "'": [2, 2, 0, 0, 0], ' ': [0, 0, 0, 0, 0]
  };
  function text(g, str, x, y, c, scale) {
    scale = scale || 1;
    g.fillStyle = c;
    var cx = x;
    for (var k = 0; k < str.length; k++) {
      var gl = FONT[str[k]] || FONT[' '];
      for (var row = 0; row < 5; row++)
        for (var col = 0; col < 3; col++)
          if (gl[row] & (4 >> col))
            g.fillRect(cx + col * scale, y + row * scale, scale, scale);
      cx += 4 * scale;
    }
    return cx - x - scale; // rendered width
  }
  function textW(str, scale) { return (str.length * 4 - 1) * (scale || 1); }
  function textC(g, str, cx, y, c, scale) { // centered
    return text(g, str, Math.round(cx - textW(str, scale) / 2), y, c, scale);
  }

  /* ── cabinet geometry (shared with future physics/render mapping) ──── */
  // The cabinet tapers toward the top: one-point perspective, player at the
  // bottom edge. left/right outer edge x at a given y:
  var CAB_TOP = 50, CAB_BOT = 372;
  function cabL(y) { var t = (y - CAB_TOP) / (CAB_BOT - CAB_TOP); return Math.round(30 - 22 * t); }
  function cabR(y) { var t = (y - CAB_TOP) / (CAB_BOT - CAB_TOP); return Math.round(186 + 22 * t); }

  var GEO = {
    marquee: { x0: 36, x1: 180, y0: 56, y1: 94 },
    score: { y0: 94, y1: 122 },
    target: { y0: 122, y1: 232, cx: 108, cy: 180 },
    // ring stack: alternating dark gaps and cork rims, outside → in.
    // Painted point labels sit in the dark gaps at bottom-center.
    rings: [
      { rx: 60, ry: 44, c: 'GAP', label: '10', ly: 218 },
      { rx: 51, ry: 37, c: 'CORK' },
      { rx: 43, ry: 30, c: 'GAP', label: '20', ly: 205 },
      { rx: 35, ry: 24, c: 'CORK' },
      { rx: 28, ry: 18, c: 'GAP', label: '30', ly: 193 },
      { rx: 21, ry: 13, c: 'CORK' },
      { rx: 15, ry: 9, c: 'GAP', label: '40', ly: 184 },
      { rx: 8, ry: 4, c: 'CORK' },
      { rx: 4, ry: 2, c: 'GAP' } // the 50 hole
    ],
    holes100: [{ x: 54, y: 136 }, { x: 162, y: 136 }],
    ramp: { y0: 232, y1: 256 },
    lane: { y0: 256, y1: 332, xt0: 66, xt1: 150, xb0: 36, xb1: 180 },
    rail: { y0: 332, y1: 352 },
    front: { y0: 352, y1: 372 },
    window: { x0: 22, x1: 88, y0: 4, y1: 44 },
    possum: { cx: 108, top: 18 },
    drums: { x0: 80, y0: 100, cells: 4, cw: 14, ch: 16 }
  };
  function laneL(y) { var t = (y - GEO.lane.y0) / (GEO.lane.y1 - GEO.lane.y0); return Math.round(GEO.lane.xt0 + (GEO.lane.xb0 - GEO.lane.xt0) * t); }
  function laneR(y) { var t = (y - GEO.lane.y0) / (GEO.lane.y1 - GEO.lane.y0); return Math.round(GEO.lane.xt1 + (GEO.lane.xb1 - GEO.lane.xt1) * t); }

  /* ══ static scene ═════════════════════════════════════════════════ */

  function drawRoom(g, R) {
    rect(g, 0, 0, W, H, PAL.NIGHT1);
    // wall panelling: faint vertical seams
    for (var x = 6; x < W; x += 24) vline(g, x, 0, 352, PAL.NIGHT2);
    // corner vignette down into black
    dither(g, 0, 0, W, 10, PAL.NIGHT0, 0.7);
    dither(g, 0, 10, 14, H - 10, PAL.NIGHT0, 0.55);
    dither(g, W - 14, 10, 14, H - 10, PAL.NIGHT0, 0.55);
    // floorboards
    rect(g, 0, 352, W, 32, PAL.NIGHT0);
    for (var fy = 356, step = 4; fy < H; fy += step, step += 3)
      hline(g, 0, W - 1, fy, PAL.NIGHT2);
    dither(g, 0, 352, W, 8, PAL.NIGHT2, 0.3);
    // low fog hugging the floor
    dither(g, 0, 344, W, 14, PAL.PUR1, 0.35);
    dither(g, 0, 350, W, 10, PAL.PUR2, 0.15);
  }

  function drawWindow(g, R) {
    var w = GEO.window;
    // frame
    rect(g, w.x0 - 3, w.y0 - 3, (w.x1 - w.x0) + 6, (w.y1 - w.y0) + 6, PAL.WOOD2);
    rect(g, w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0, PAL.NIGHT2);
    // night sky gradient by dither
    dither(g, w.x0, w.y0, w.x1 - w.x0, 14, PAL.PUR1, 0.5);
    dither(g, w.x0, w.y0 + 20, w.x1 - w.x0, w.y1 - w.y0 - 20, PAL.PUR1, 0.8);
    // the moon (kept clear of the muntin bars: pane centers at ±16,±10)
    var mx = w.x0 + 16, my = w.y0 + 13;
    ellipse(g, mx, my, 8, 8, PAL.MOON);
    px(g, mx - 3, my - 3, PAL.BONE_D); px(g, mx + 3, my + 2, PAL.BONE_D);
    px(g, mx, my + 4, PAL.BONE_D); px(g, mx + 4, my - 3, PAL.BONE_D);
    glowRing(g, mx, my, 8, 8, 4, PAL.FOG, 0.5);
    // bare treeline
    g.fillStyle = PAL.NIGHT0;
    for (var tx = w.x0; tx < w.x1; tx += 7) {
      var th = 6 + Math.floor(R() * 8);
      rect(g, tx, w.y1 - th, 2, th, PAL.NIGHT0);
      px(g, tx - 1, w.y1 - th + 2, PAL.NIGHT0);
      px(g, tx + 2, w.y1 - th + 3, PAL.NIGHT0);
    }
    // muntins
    var mx = Math.round((w.x0 + w.x1) / 2), my = Math.round((w.y0 + w.y1) / 2);
    vline(g, mx, w.y0, w.y1 - 1, PAL.WOOD2); vline(g, mx + 1, w.y0, w.y1 - 1, PAL.WOOD1);
    hline(g, w.x0, w.x1 - 1, my, PAL.WOOD2); hline(g, w.x0, w.x1 - 1, my + 1, PAL.WOOD1);
    // glass glint
    px(g, w.x0 + 4, w.y0 + 3, PAL.FOG); px(g, w.x0 + 5, w.y0 + 4, PAL.FOG);
  }

  // wood-grain fill between two x-edge functions
  function woodBand(g, R, y0, y1, fL, fR, base, dark, light) {
    for (var y = y0; y < y1; y++) hline(g, fL(y), fR(y), y, base);
    // grain streaks follow the taper
    for (var s = 0; s < 90; s++) {
      var ys = y0 + R() * (y1 - y0), len = 3 + R() * 14;
      var t = R();
      var c = R() < 0.6 ? dark : light;
      for (var d = 0; d < len && ys + d < y1; d++) {
        var y2 = Math.round(ys + d);
        var xx = fL(y2) + t * (fR(y2) - fL(y2));
        px(g, Math.round(xx), y2, c);
      }
    }
  }

  function drawCabinetBody(g, R) {
    // silhouette shadow on the wall
    for (var y = CAB_TOP; y < CAB_BOT; y++) {
      hline(g, cabL(y) - 2, cabR(y) + 2, y, PAL.NIGHT0);
    }
    // side rails (everything between outer edge and playfield interior)
    woodBand(g, R, CAB_TOP, CAB_BOT, cabL, cabR, PAL.WOOD3, PAL.WOOD2, PAL.WOOD4);
    // outer edge highlights / shadows
    for (y = CAB_TOP; y < CAB_BOT; y++) {
      px(g, cabL(y), y, PAL.WOOD5);
      px(g, cabR(y), y, PAL.WOOD1);
    }
  }

  function drawMarquee(g, R) {
    var m = GEO.marquee;
    // frame
    rect(g, m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, PAL.WOOD4);
    rect(g, m.x0 + 1, m.y0 + 1, m.x1 - m.x0 - 2, 2, PAL.WOOD5);
    rect(g, m.x0 + 1, m.y1 - 3, m.x1 - m.x0 - 2, 2, PAL.WOOD2);
    // faded painted red trim stripe
    hline(g, m.x0 + 2, m.x1 - 3, m.y0 + 4, PAL.RED1);
    hline(g, m.x0 + 2, m.x1 - 3, m.y1 - 5, PAL.RED1);
    // backlit panel
    var p = { x0: m.x0 + 6, x1: m.x1 - 6, y0: m.y0 + 7, y1: m.y1 - 7 };
    rect(g, p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, PAL.LIT);
    // panel grime: darker at edges + water streaks
    dither(g, p.x0, p.y0, p.x1 - p.x0, 3, PAL.LIT_D, 0.5);
    dither(g, p.x0, p.y1 - 4, p.x1 - p.x0, 4, PAL.LIT_D, 0.6);
    for (var s = 0; s < 6; s++) {
      var sx = p.x0 + 4 + R() * (p.x1 - p.x0 - 8);
      dither(g, sx, p.y0, 2, p.y1 - p.y0, PAL.LIT_D, 0.5);
    }
    // lettering (dark on lit panel); the dying bulb cell is drawn dynamically
    textC(g, 'HOLLER', 76, m.y0 + 13, PAL.WOOD1, 2);
    textC(g, 'ROLLER', 146, m.y0 + 13, PAL.WOOD1, 2);
    // pink neon tube along the marquee bottom
    hline(g, m.x0 + 4, m.x1 - 5, m.y1 - 1, PAL.PINK);
    hline(g, m.x0 + 4, m.x1 - 5, m.y1, PAL.PINK_D);
    dither(g, m.x0 + 4, m.y1 + 1, m.x1 - m.x0 - 8, 2, PAL.PINK_DK, 0.4);
  }

  // eye rectangles shared by the static draw and the dynamic blink
  var EYES = {
    L: { x: -7, y: 14, w: 4, h: 5 },  // the left one is bigger…
    R: { x: 4, y: 15, w: 3, h: 4 }   // …and they don't quite agree
  };

  function drawPossum(g, R) {
    var cx = GEO.possum.cx, top = GEO.possum.top;
    // steel mounting pole down into the marquee (drawn first, behind the head)
    rect(g, cx - 2, top + 28, 5, GEO.marquee.y0 - (top + 28), PAL.STEEL1);
    vline(g, cx - 2, top + 28, GEO.marquee.y0 - 1, PAL.STEEL2);
    px(g, cx, top + 36, PAL.STEEL2); px(g, cx, top + 40, PAL.STEEL2); // bolts
    // ears: big, round, chewed
    ellipse(g, cx - 12, top + 5, 7, 7, PAL.FUR3);
    ellipse(g, cx + 12, top + 5, 7, 7, PAL.FUR3);
    ellipse(g, cx - 12, top + 6, 4, 4, PAL.PINK_D);
    ellipse(g, cx + 12, top + 6, 4, 4, PAL.PINK_D);
    // a notch bitten out of the left ear
    rect(g, cx - 17, top + 1, 3, 3, PAL.NIGHT1);
    // grey head dome
    ellipse(g, cx, top + 15, 13, 11, PAL.FUR1);
    dither(g, cx - 13, top + 7, 8, 9, PAL.FUR2, 0.45);
    dither(g, cx + 6, top + 8, 8, 8, PAL.FUR2, 0.4);
    // white face: brow patch, then a wedge tapering down a longer snout
    ellipse(g, cx, top + 13, 8, 6, PAL.BONE);
    ellipse(g, cx, top + 21, 6, 6, PAL.BONE);
    ellipse(g, cx, top + 28, 3, 4, PAL.BONE);
    ellipse(g, cx, top + 33, 2, 2, PAL.BONE);
    // dark eye smudges (possums look permanently unslept)
    dither(g, cx + EYES.L.x - 1, top + EYES.L.y - 1, EYES.L.w + 2, EYES.L.h + 2, PAL.FUR2, 0.3);
    dither(g, cx + EYES.R.x - 1, top + EYES.R.y - 1, EYES.R.w + 2, EYES.R.h + 2, PAL.FUR2, 0.3);
    // eyes: black beads with pink neon glints
    rect(g, cx + EYES.L.x, top + EYES.L.y, EYES.L.w, EYES.L.h, PAL.NIGHT0);
    rect(g, cx + EYES.R.x, top + EYES.R.y, EYES.R.w, EYES.R.h, PAL.NIGHT0);
    px(g, cx + EYES.L.x + 2, top + EYES.L.y + 1, PAL.PINK);
    px(g, cx + EYES.R.x + 1, top + EYES.R.y + 1, PAL.PINK);
    // animatronic seam across the cranium + exposed steel patch with rivets
    hline(g, cx - 11, cx + 11, top + 8, PAL.FUR2);
    rect(g, cx + 7, top + 9, 6, 4, PAL.STEEL2);
    hline(g, cx + 7, cx + 12, top + 9, PAL.STEEL1);
    vline(g, cx + 7, top + 9, top + 12, PAL.STEEL1);
    px(g, cx + 9, top + 11, PAL.STEEL1); px(g, cx + 12, top + 12, PAL.STEEL1);
    // pink nose at the snout tip + whisker dots
    rect(g, cx - 2, top + 34, 4, 3, PAL.PINK);
    px(g, cx - 1, top + 34, PAL.BONE);   // wet glint
    px(g, cx - 6, top + 28, PAL.BONE_D); px(g, cx + 5, top + 28, PAL.BONE_D);
    px(g, cx - 7, top + 31, PAL.BONE_D); px(g, cx + 6, top + 31, PAL.BONE_D);
    // a sparse tuft of guard hairs on the crown
    px(g, cx - 2, top + 3, PAL.FUR2); px(g, cx, top + 2, PAL.FUR2); px(g, cx + 2, top + 3, PAL.FUR2);
  }

  function drawScoreBar(g, R) {
    var s = GEO.score;
    var x0 = cabL(s.y0) + 4, x1 = cabR(s.y0) - 4;
    rect(g, x0, s.y0, x1 - x0, s.y1 - s.y0, PAL.WOOD2);
    hline(g, x0, x1 - 1, s.y0, PAL.WOOD4);
    hline(g, x0, x1 - 1, s.y1 - 1, PAL.WOOD1);
    // hand-painted SCORE, slightly crooked
    text(g, 'SCORE', x0 + 8, s.y0 + 8, PAL.BONE_D, 1);
    px(g, x0 + 8, s.y0 + 13, PAL.WOOD2); // paint flaking off the S
    // drum counter window
    var d = GEO.drums;
    rect(g, d.x0 - 2, d.y0 - 2, d.cells * d.cw + 4, d.ch + 4, PAL.WOOD1);
    for (var i = 0; i < d.cells; i++) {
      var dx = d.x0 + i * d.cw;
      rect(g, dx, d.y0, d.cw - 2, d.ch, PAL.BONE);
      dither(g, dx, d.y0, d.cw - 2, 2, PAL.BONE_D, 0.6);       // drum curvature
      dither(g, dx, d.y0 + d.ch - 2, d.cw - 2, 2, PAL.BONE_D, 0.6);
      textC(g, '0', dx + (d.cw - 2) / 2, d.y0 + 5, PAL.NIGHT0, 1);
    }
    // 9 ball lamps, dim pink — these light per remaining ball in play
    for (i = 0; i < 9; i++) {
      var lx = x1 - 42 + i * 4;
      px(g, lx, s.y0 + 9, PAL.PINK_DK);
      px(g, lx, s.y0 + 10, PAL.PINK_DK);
    }
    text(g, 'BALLS', x1 - 42, s.y0 + 14, PAL.BONE_D, 1);
  }

  function drawTarget(g, R) {
    var t = GEO.target;
    var x0 = function (y) { return cabL(y) + 5; }, x1 = function (y) { return cabR(y) - 5; };
    // backstop panel: near-black aged walnut
    woodBand(g, R, t.y0, t.y1, x0, x1, PAL.WOOD2, PAL.WOOD1, PAL.WOOD3);
    dither(g, 60, t.y0, 100, 8, PAL.WOOD1, 0.5);
    // inner frame lip
    for (var y = t.y0; y < t.y1; y++) { px(g, x0(y), y, PAL.WOOD1); px(g, x1(y), y, PAL.WOOD5); }

    // ring stack, outside in
    for (var i = 0; i < GEO.rings.length; i++) {
      var r = GEO.rings[i];
      if (r.c === 'GAP') {
        ellipse(g, t.cx, t.cy, r.rx, r.ry, PAL.GAP);
      } else {
        ellipse(g, t.cx, t.cy, r.rx, r.ry, PAL.CORK1);
        // top-edge highlight, bottom-edge shade: rims are raised hoops
        ellipse(g, t.cx, t.cy - 1, r.rx, r.ry, PAL.CORK3);
        ellipse(g, t.cx, t.cy, r.rx - 1, r.ry - 1, PAL.CORK1);
        dither(g, t.cx - r.rx, t.cy + r.ry - 3, r.rx * 2, 3, PAL.CORK2, 0.5);
      }
    }
    // scuffed cork: ball burns on the rims
    for (var s = 0; s < 26; s++) {
      var a = R() * Math.PI * 2, rr = 0.3 + R() * 0.65;
      var sx = t.cx + Math.cos(a) * 60 * rr, sy = t.cy + Math.sin(a) * 44 * rr;
      px(g, Math.round(sx), Math.round(sy), R() < 0.5 ? PAL.CORK2 : PAL.WOOD2);
    }
    // the dent in the 40 ring's rim (flat spot, upper right) — this is
    // load-bearing later: balls that catch it can rattle out into the 30
    rect(g, t.cx + 6, t.cy - 10, 5, 2, PAL.CORK2);
    px(g, t.cx + 7, t.cy - 11, PAL.WOOD1);
    px(g, t.cx + 9, t.cy - 10, PAL.GAP);

    // painted point values in the dark gaps
    for (i = 0; i < GEO.rings.length; i++) {
      var rg = GEO.rings[i];
      if (rg.label) textC(g, rg.label, t.cx, rg.ly, PAL.BONE, 1);
    }

    // the two 100 holes, dark mouths with pink light way down inside
    for (i = 0; i < GEO.holes100.length; i++) {
      var h = GEO.holes100[i];
      ellipse(g, h.x, h.y - 1, 10, 6, PAL.WOOD4);   // raised surround, lit top
      ellipse(g, h.x, h.y, 10, 6, PAL.WOOD1);
      ellipse(g, h.x, h.y, 8, 4, PAL.GAP);          // the hole
      ellipse(g, h.x, h.y + 2, 4, 1, PAL.PINK_DK);  // glow from below
      px(g, h.x, h.y + 2, PAL.PINK_D);
      // label sits fully inside the target panel (score bar owns y < 122)
      textC(g, '100', h.x, h.y - 13, PAL.PINK, 1);
    }
  }

  function drawRamp(g, R) {
    var rp = GEO.ramp;
    // the hump: top edge dips at the sides, glossy wax on the crown
    for (var x = laneL(rp.y1); x <= laneR(rp.y1); x++) {
      var n = Math.abs(x - 108) / (laneR(rp.y1) - 108);
      var top = rp.y0 + Math.round(4 * n * n);
      vline(g, x, top, rp.y1, PAL.LANE2);
      px(g, x, top, PAL.WOOD2);            // lip
      px(g, x, top + 1, PAL.LANE1);        // crown highlight
      if ((x + 2) % 5 === 0) px(g, x, top + 2 + ((x * 7) % 3), PAL.LANE1);
      px(g, x, rp.y1 - 1, PAL.LANE3);      // base shadow
    }
    // wax gleam streak
    dither(g, 88, rp.y0 + 2, 40, 3, PAL.BONE, 0.25);
  }

  function drawLane(g, R) {
    var ln = GEO.lane;
    for (var y = ln.y0; y < ln.y1; y++) hline(g, laneL(y), laneR(y), y, PAL.LANE2);
    // plank seams converging toward the vanishing point
    for (var k = 1; k < 6; k++) {
      var f = k / 6;
      for (y = ln.y0; y < ln.y1; y++) {
        var xx = laneL(y) + f * (laneR(y) - laneL(y));
        if ((y + k) % 2) px(g, Math.round(xx), y, PAL.LANE3);
      }
    }
    // wax sheen down the center, dithered edges
    for (y = ln.y0; y < ln.y1; y++) {
      var lw = Math.round((laneR(y) - laneL(y)) * 0.16);
      hline(g, 108 - lw, 108 + lw, y, PAL.LANE1);
    }
    dither(g, 84, ln.y0, 12, ln.y1 - ln.y0, PAL.LANE2, 0.5);
    dither(g, 120, ln.y0, 12, ln.y1 - ln.y0, PAL.LANE2, 0.5);
    // scuffs and ball tracks
    for (var s = 0; s < 40; s++) {
      var sy = ln.y0 + R() * (ln.y1 - ln.y0);
      var sx = laneL(sy) + R() * (laneR(sy) - laneL(sy));
      var len = 2 + R() * 6;
      for (var d = 0; d < len; d++) px(g, Math.round(sx), Math.round(sy + d), PAL.LANE3);
    }
    // side gutters + bumper caps on the rails
    for (y = ln.y0; y < ln.y1; y++) {
      px(g, laneL(y) - 1, y, PAL.WOOD1);
      px(g, laneL(y) - 2, y, PAL.WOOD2);
      px(g, laneR(y) + 1, y, PAL.WOOD1);
      px(g, laneR(y) + 2, y, PAL.WOOD5);
    }
    // chalk ghost arrow worn into the wax near the throw line
    var ay = ln.y1 - 18;
    dither(g, 104, ay, 9, 12, PAL.BONE, 0.22);
    dither(g, 100, ay + 4, 4, 4, PAL.BONE, 0.18);
    dither(g, 113, ay + 4, 4, 4, PAL.BONE, 0.18);
  }

  function drawFrontPanel(g, R) {
    var rl = GEO.rail, fr = GEO.front;
    var x0 = cabL(rl.y0) + 3, x1 = cabR(rl.y0) - 3;
    // rail face
    woodBand(g, R, rl.y0, fr.y1, function () { return x0; }, function () { return x1; }, PAL.WOOD3, PAL.WOOD2, PAL.WOOD4);
    hline(g, x0, x1, rl.y0, PAL.WOOD5);
    // ball return trough
    rect(g, x0 + 6, rl.y0 + 4, x1 - x0 - 12, 14, PAL.WOOD1);
    hline(g, x0 + 6, x1 - 6, rl.y0 + 4, PAL.NIGHT0);
    hline(g, x0 + 6, x1 - 6, rl.y0 + 17, PAL.WOOD4); // brass-lit lip
    // nine bone-white balls racked and waiting
    for (var i = 0; i < 9; i++) {
      var bx = x0 + 14 + i * 17, by = rl.y0 + 11;
      ellipse(g, bx, by, 5, 5, PAL.BONE);
      px(g, bx - 2, by - 2, PAL.MOON);                    // glint
      dither(g, bx - 3, by + 2, 7, 3, PAL.BONE_D, 0.6);   // shade
      if (i === 2 || i === 6) px(g, bx + 1, by, PAL.BONE_D); // scuffed ones
      if (i === 4) { px(g, bx, by - 1, PAL.CORK2); px(g, bx + 1, by + 1, PAL.CORK2); } // the dirty one
    }
    // coin door (left)
    rect(g, x0 + 10, fr.y0 + 3, 34, 15, PAL.BRASS1);
    rect(g, x0 + 11, fr.y0 + 4, 32, 1, PAL.BRASS2);
    rect(g, x0 + 22, fr.y0 + 7, 10, 2, PAL.NIGHT0);   // coin slot
    text(g, '5¢', x0 + 15, fr.y0 + 11, PAL.WOOD1, 1);
    px(g, x0 + 12, fr.y0 + 5, PAL.WOOD1); px(g, x0 + 42, fr.y0 + 16, PAL.WOOD1); // screws
    // ticket window (right) with one ticket left sticking out
    text(g, 'TICKETS', x1 - 40, fr.y0 + 2, PAL.BONE_D, 1);
    rect(g, x1 - 42, fr.y0 + 9, 32, 8, PAL.WOOD1);
    rect(g, x1 - 40, fr.y0 + 11, 28, 4, PAL.NIGHT0);
    rect(g, x1 - 34, fr.y0 + 10, 12, 5, PAL.PINK_D);  // the ticket
    rect(g, x1 - 34, fr.y0 + 12, 12, 1, PAL.PINK);
    px(g, x1 - 30, fr.y0 + 11, PAL.PINK_DK); px(g, x1 - 26, fr.y0 + 13, PAL.PINK_DK);
  }

  function drawBaseAndStain(g, R) {
    // plinth
    var y0 = GEO.front.y1;
    rect(g, cabL(y0) - 2, y0, cabR(y0) - cabL(y0) + 4, 8, PAL.WOOD2);
    hline(g, cabL(y0) - 2, cabR(y0) + 2, y0, PAL.WOOD4);
    // waterline stain creeping up the cabinet: wavy dark tide-mark
    for (var x = cabL(y0) - 2; x <= cabR(y0) + 2; x++) {
      var wave = Math.round(6 + 3 * Math.sin(x * 0.22) + 2 * Math.sin(x * 0.07 + 2));
      for (var d = 0; d < wave; d++) {
        if (BAYER[((d + x) % 4) * 4 + (x % 4)] / 16 < 0.75 - d / wave * 0.55)
          px(g, x, y0 + 7 - d, PAL.WOOD1);
      }
      px(g, x, y0 + 7 - wave, PAL.PUR1); // faint purple tide-line
    }
    // shadow pooling under the machine
    dither(g, cabL(y0) - 6, y0 + 8, cabR(y0) - cabL(y0) + 12, 5, PAL.NIGHT0, 0.8);
  }

  // a small neon sign hanging on the wall, pointing somewhere off-frame.
  // The prize counter exists. You just can't see it from here.
  var SIGN = { x0: 160, y0: 14, w: 32, h: 13 };
  function drawPrizesSign(g, R, lit) {
    var s = SIGN;
    // hanging chains up to the ceiling shadow
    for (var y = 0; y < s.y0; y += 2) { px(g, s.x0 + 4, y, PAL.STEEL1); px(g, s.x0 + s.w - 4, y, PAL.STEEL1); }
    rect(g, s.x0, s.y0, s.w, s.h, PAL.NIGHT0);
    rect(g, s.x0 + 1, s.y0 + 1, s.w - 2, s.h - 2, PAL.NIGHT2);
    textC(g, 'PRIZES', s.x0 + s.w / 2, s.y0 + 4, lit ? PAL.PINK : PAL.PINK_DK, 1);
    if (lit) dither(g, s.x0 - 2, s.y0 - 2, s.w + 4, s.h + 4, PAL.PINK_DK, 0.12);
  }

  function drawCobwebsAndGrime(g, R) {
    // cobweb in the top-right cabinet corner
    var cx = cabR(CAB_TOP) - 1, cy = CAB_TOP + 2;
    g.fillStyle = PAL.FOG;
    for (var i = 0; i < 3; i++) {
      var rr = 5 + i * 4;
      for (var a = Math.PI * 0.5; a <= Math.PI; a += 0.22)
        if ((i + Math.round(a * 10)) % 2) px(g, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.8), PAL.PUR2);
    }
    px(g, cx - 4, cy + 3, PAL.FOG); px(g, cx - 9, cy + 6, PAL.PUR2);
    // drip stains running down the side rails, following the cabinet taper.
    // Each drip keeps a fixed offset from its rail's outer edge.
    for (i = 0; i < 5; i++) {
      var left = [true, true, false, false, true][i];
      var off = [8, 3, 6, 2, 12][i];
      var sy0 = [122, 96, 122, 150, 232][i];
      var len = 10 + (i * 7) % 18;
      for (var d = 0; d < len; d++) {
        var yy = sy0 + d;
        var xx = left ? cabL(yy) + off : cabR(yy) - off;
        if ((d + i) % 3) px(g, xx, yy, PAL.WOOD1);
      }
    }
  }

  /* ══ layer assembly ═══════════════════════════════════════════════ */

  var staticLayer = null;

  function buildStatic() {
    staticLayer = document.createElement('canvas');
    staticLayer.width = W; staticLayer.height = H;
    var g = staticLayer.getContext('2d');
    var R = rng(0xC0FFEE);
    drawRoom(g, R);
    drawWindow(g, R);
    drawCabinetBody(g, R);
    drawTarget(g, R);
    drawRamp(g, R);
    drawLane(g, R);
    drawScoreBar(g, R);
    drawMarquee(g, R);
    drawFrontPanel(g, R);
    drawBaseAndStain(g, R);
    drawCobwebsAndGrime(g, R);
    drawPrizesSign(g, R, true);
    drawPossum(g, R);
    return staticLayer;
  }

  /* ══ dynamic frame ════════════════════════════════════════════════ */

  // little deterministic-ish flicker state (Date-free; driven by t)
  function flickerAt(t, rate, seed) {
    // pseudo-random square wave: hash of the time bucket
    var b = Math.floor(t * rate) + seed;
    b = Math.imul(b ^ b >>> 13, 0x5bd1e995); b ^= b >>> 15;
    return (b >>> 0) / 4294967296;
  }

  function drawFrame(ctx, t) {
    if (!staticLayer) buildStatic();
    ctx.drawImage(staticLayer, 0, 0);
    var g = ctx;

    // ── fog drifting past the window panes
    var w = GEO.window;
    g.save();
    g.beginPath();
    g.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
    g.clip();
    var span = (w.x1 - w.x0) + 60;
    for (var i = 0; i < 3; i++) {
      var fx = w.x0 - 30 + (((t * (3 + i * 2.1)) + i * 47) % span);
      var fy = w.y0 + 8 + i * 11;
      dither(g, Math.round(fx), fy, 34, 5, PAL.FOG, 0.3);
      dither(g, Math.round(fx) - 8, fy + 2, 22, 3, PAL.PUR2, 0.4);
    }
    g.restore();

    // ── the dying marquee bulb behind ROLLER's final R
    // ROLLER is centered at 146, scale 2 → glyphs advance 8px from x=123;
    // the last R occupies x 163..169. Its backlight cell: x 161..172.
    var f = flickerAt(t, 7, 13);
    var dying = f < 0.25 ? 0.9 : (f < 0.45 ? 0.5 : 0.1); // mostly dark, stutters lit
    if (dying > 0.05) {
      g.globalAlpha = dying;
      rect(g, 161, GEO.marquee.y0 + 8, 12, GEO.marquee.y1 - GEO.marquee.y0 - 16, '#3c2814');
      g.globalAlpha = 1;
      if (dying > 0.5) textC(g, 'R', 166, GEO.marquee.y0 + 13, PAL.WOOD2, 2);
    }

    // ── neon breathing on the 100 holes
    var breathe = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.4));
    for (i = 0; i < GEO.holes100.length; i++) {
      var h = GEO.holes100[i];
      glowRing(g, h.x, h.y, 9, 5, 4, PAL.PINK_DK, breathe);
      if (flickerAt(t, 2.3, i * 7) > 0.2) { // pink core, rarely gutters out
        ellipse(g, h.x, h.y + 2, 3, 1, PAL.PINK_D);
        px(g, h.x, h.y + 2, PAL.PINK);
      }
    }

    // ── possum blink: 150ms flutters, each eye on its own clock
    // (that's the deranged part)
    var cx = GEO.possum.cx, top = GEO.possum.top;
    if (flickerAt(t, 6.7, 3) < 0.025)
      rect(g, cx + EYES.L.x, top + EYES.L.y, EYES.L.w, EYES.L.h, PAL.FUR2);
    if (flickerAt(t, 6.7, 11) < 0.025)
      rect(g, cx + EYES.R.x, top + EYES.R.y, EYES.R.w, EYES.R.h, PAL.FUR2);

    // ── the PRIZES sign shorts out now and then
    if (flickerAt(t, 1.6, 21) < 0.13) {
      var R0 = rng(1); // deterministic redraw, unlit
      drawPrizesSign(g, R0, false);
    }

    // ── marquee neon reflection shimmer on the wax crown of the ramp
    if (flickerAt(t, 9, 5) < 0.5)
      dither(g, 96, GEO.ramp.y0 + 1, 24, 2, PAL.PINK_DK, 0.2);
  }

  return {
    W: W, H: H, PAL: PAL, GEO: GEO,
    buildStatic: buildStatic,
    drawFrame: drawFrame
  };
})();
