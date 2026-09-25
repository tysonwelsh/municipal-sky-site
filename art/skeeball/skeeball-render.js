/* HOLLER ROLLER — renderer
 *
 * All art is procedural pixel art drawn from PAL with a seeded RNG, so the
 * wood grain, stains, and wear are identical on every load. The machine is
 * rendered once into a static offscreen layer at boot; drawFrame() blits it
 * and paints the ambient life (dying marquee bulb, neon breathing, possum
 * blink); drawLive() paints everything that reacts to the game (drums,
 * racked balls, tickets, jackpot, possum gaze, attract/payout).
 *
 * Coordinates. The machine is drawn in a fixed 216×384 MACHINE FRAME
 * (every GEO number below is in it). The canvas is 216×H with H chosen at
 * boot in [384, 448] (setHeight) so a tall phone fills at the largest
 * integer scale: the extra rows are room — TOP rows of wall above the
 * marquee and BOT rows of floor below the plinth. The machine never moves
 * inside its frame; callers drawing in machine coordinates translate by
 * (0, R.TOP). project()/shadowAt() return machine-frame coordinates.
 *
 * The pixel toolbox and the night palette come from ../arcade/ (script
 * tags in index.php); only the machine's own wood/lane/cork/brass/possum
 * colours live here.
 */
(function (root) {
  'use strict';

  var S = root.ArcadeSprites, AP = root.ArcadePalette;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline,
    ellipse = S.ellipse, dither = S.dither, glowRing = S.glowRing,
    text = S.text, textC = S.textC, textW = S.textW, FONT = S.FONT;
  // the toolbox keeps its Bayer matrix private; the ramp shading and the
  // water stain index it directly, so they carry the same 4×4 here
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  var W = 216, MH = 384;           // canvas width; machine-frame height
  var H_MIN = 384, H_MAX = 448;
  var H = MH, TOP = 0, BOT = 0;    // canvas height; room rows above / below

  /* ── palette ───────────────────────────────────────────────────────── */
  var PAL = {
    // the room at night, bone, electric pink (shared: ArcadePalette)
    NIGHT0: AP.NIGHT0, NIGHT1: AP.NIGHT1, NIGHT2: AP.NIGHT2,
    PUR1: AP.PUR1, PUR2: AP.PUR2, FOG: AP.FOG, MOON: AP.MOON,
    BONE: AP.BONE, BONE_D: AP.BONE_D,
    PINK: AP.PINK, PINK_D: AP.PINK_D, PINK_DK: AP.PINK_DK,
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
    // marquee backlight: faded parchment tan, so the pale possum head reads
    LIT: '#c2a06a', LIT_D: '#8f7340',
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

  function makeCanvas(w, h) {
    if (typeof document !== 'undefined') {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    return new OffscreenCanvas(w, h);
  }

  /* ── cabinet geometry: the 'grand' layout ──────────────────────────── */
  // The marquee rides the top of the frame, the possum's snout overhangs
  // it, the drums need no SCORE label, and the ring bed is large and near
  // circular. Below the bed: a 14 px apron, the pit mouth, the ball-hop,
  // the alley, the ball-return rail and the front panel.
  var SPEC = {
    marqueeY0: 24, marqueeX0: 44, marqueeX1: 172,
    scoreH: 22,
    ringCy: 158, maxRx: 52, ratio: 0.95, bedExtend: 14,
    pitH: 14, hopH: 12, laneTopW: 66, laneBotW: 96, hump: 2,
    holeDx: 42, holeY: 100, holeRx: 10
  };

  // ring radii as fractions of maxRx, outside → in; even indexes are the
  // dark score TROUGHS (10/20/30/40 + the 50 hole), odd are the raised
  // cork RIMS between them. The physics rim radii [0.93, 0.744, 0.535,
  // 0.326, 0.116] (units) sit on the outer edge (0.93) and on the middle
  // of each cork band: measured band centres are 41.5/30.0/18.5/6.5 px
  // laterally and 39.5/28.5/17.5/6.0 px vertically against 41.6/29.9/18.2/
  // 6.5 and 39.2/28.2/17.2/6.1 px targets — every hoop is within 0.35 px
  // of its physical radius, so no hoop needed shifting.
  var RING_FR = [1, 0.825, 0.775, 0.60, 0.55, 0.375, 0.325, 0.15, 0.10];
  var GAP_LABELS = { 0: '10', 2: '20', 4: '30', 6: '40' };
  var CAB_BOT = 372;
  var SHELL = 7; // rail + outer shell thickness beyond the lane edge

  function makeGeo(spec) {
    var rings = [];
    for (var i = 0; i < RING_FR.length; i++) {
      var rx = Math.round(spec.maxRx * RING_FR[i]);
      var ry = Math.round(spec.maxRx * spec.ratio * RING_FR[i]);
      var r = { rx: rx, ry: Math.max(1, ry), c: (i % 2 === 0) ? 'GAP' : 'CORK' };
      if (GAP_LABELS[i]) {
        r.label = GAP_LABELS[i];
        r.ly = spec.ringCy + r.ry - 6; // bottom of the dark gap band
      }
      rings.push(r);
    }
    // bedExtend is an apron of bed BELOW the ring stack, so the rings sit
    // high (near the 100 holes) without dragging the lip up with them
    var bedBottom = spec.ringCy + Math.round(spec.maxRx * spec.ratio) + spec.bedExtend;
    var pit = { y0: bedBottom + 2, y1: bedBottom + 2 + spec.pitH };
    var marquee = { x0: spec.marqueeX0, x1: spec.marqueeX1, y0: spec.marqueeY0, y1: spec.marqueeY0 + 38 };
    var score = { y0: marquee.y1, y1: marquee.y1 + spec.scoreH };
    return {
      spec: spec,
      marquee: marquee,
      score: score,
      target: { y0: score.y1, y1: pit.y0, cx: 108, cy: spec.ringCy },
      pit: pit,
      bedBottom: bedBottom,
      bedExtend: spec.bedExtend,
      rings: rings,
      holes100: [{ x: 108 - spec.holeDx, y: spec.holeY }, { x: 108 + spec.holeDx, y: spec.holeY }],
      holeR: spec.holeRx,
      ramp: { y0: pit.y1, y1: pit.y1 + spec.hopH },
      lane: {
        y0: pit.y1 + spec.hopH, y1: 332,
        xt0: 108 - spec.laneTopW, xt1: 108 + spec.laneTopW,
        xb0: 108 - spec.laneBotW, xb1: 108 + spec.laneBotW
      },
      rail: { y0: 332, y1: 352 },
      front: { y0: 352, y1: 372 },
      possum: { cx: 108, top: marquee.y0 - 18 }, // snout overhangs the title
      drums: { x0: 80, y0: score.y0 + 3, cells: 4, cw: 14, ch: 15 }
    };
  }
  var GEO = makeGeo(SPEC);

  // One continuous body: the alley's side rails ARE its outer edges, so
  // above the junction (the bed's lip) the body is the alley's far width
  // plus the rail shell, receding gently toward the top; below it the body
  // follows the alley's flare toward the player.
  function laneHalf(yy) {
    var ln = GEO.lane, tt = (yy - ln.y0) / (ln.y1 - ln.y0);
    return (108 - ln.xt0) + ((108 - ln.xb0) - (108 - ln.xt0)) * tt;
  }
  function cabHalf(y) {
    var jy = GEO.pit.y0;
    if (y > GEO.lane.y1) return laneHalf(GEO.lane.y1) + SHELL; // front box
    if (y > jy) return laneHalf(y) + SHELL;                     // alley flare
    var jw = laneHalf(jy) + SHELL;
    var top = cabTop();
    return jw - 6 * (jy - y) / (jy - top);                      // upper body
  }
  function cabTop() { return GEO.marquee.y0 - 6; } // body starts under the topper
  function cabL(y) { return Math.round(108 - cabHalf(y)); }
  function cabR(y) { return Math.round(108 + cabHalf(y)); }
  function laneL(y) { var t = (y - GEO.lane.y0) / (GEO.lane.y1 - GEO.lane.y0); return Math.round(GEO.lane.xt0 + (GEO.lane.xb0 - GEO.lane.xt0) * t); }
  function laneR(y) { var t = (y - GEO.lane.y0) / (GEO.lane.y1 - GEO.lane.y0); return Math.round(GEO.lane.xt1 + (GEO.lane.xb1 - GEO.lane.xt1) * t); }

  /* ══ static scene ═════════════════════════════════════════════════ */
  // BARE = true draws the "bare" twin of the static layer: identical except
  // the parts drawLive animates (racked balls, the stub ticket, the possum's
  // eye beads). drawLive restores small regions from it before redrawing.
  var BARE = false;

  function drawRoom(g) {
    var y0 = -TOP, y1 = MH + BOT;
    rect(g, 0, y0, W, y1 - y0, PAL.NIGHT1);
    // wall panelling: faint vertical seams
    for (var x = 6; x < W; x += 24) vline(g, x, y0, 352, PAL.NIGHT2);
    // ceiling vignette at the true top, and the corners down into black
    // (TOP is a multiple of 4, so the side dither keeps its Bayer phase)
    dither(g, 0, y0, W, 10, PAL.NIGHT0, 0.7);
    dither(g, 0, y0 + 10, 14, y1 - y0 - 10, PAL.NIGHT0, 0.55);
    dither(g, W - 14, y0 + 10, 14, y1 - y0 - 10, PAL.NIGHT0, 0.55);
    // floorboards, receding lines further apart toward the viewer
    rect(g, 0, 352, W, y1 - 352, PAL.NIGHT0);
    for (var fy = 356, step = 4; fy < y1; fy += step, step += 3)
      hline(g, 0, W - 1, fy, PAL.NIGHT2);
    dither(g, 0, 352, W, 8, PAL.NIGHT2, 0.3);
    // low fog hugging the floor
    dither(g, 0, 344, W, 14, PAL.PUR1, 0.35);
    dither(g, 0, 350, W, 10, PAL.PUR2, 0.15);
  }

  // wood-grain fill between two x-edge functions
  function woodBand(g, R, y0, y1, fL, fR, base, dark, light) {
    for (var y = y0; y < y1; y++) hline(g, fL(y), fR(y), y, base);
    for (var s = 0; s < 90; s++) { // grain streaks follow the taper
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
    var top = cabTop();
    for (var y = top; y < CAB_BOT; y++) hline(g, cabL(y) - 2, cabR(y) + 2, y, PAL.NIGHT0); // wall shadow
    woodBand(g, R, top, CAB_BOT, cabL, cabR, PAL.WOOD3, PAL.WOOD2, PAL.WOOD4);
    for (y = top; y < CAB_BOT; y++) {
      px(g, cabL(y), y, PAL.WOOD5);
      px(g, cabR(y), y, PAL.WOOD1);
    }
  }

  function drawMarquee(g, R) {
    var m = GEO.marquee;
    rect(g, m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, PAL.WOOD4);
    rect(g, m.x0 + 1, m.y0 + 1, m.x1 - m.x0 - 2, 2, PAL.WOOD5);
    rect(g, m.x0 + 1, m.y1 - 3, m.x1 - m.x0 - 2, 2, PAL.WOOD2);
    hline(g, m.x0 + 2, m.x1 - 3, m.y0 + 4, PAL.RED1); // faded red trim
    hline(g, m.x0 + 2, m.x1 - 3, m.y1 - 5, PAL.RED1);
    var p = { x0: m.x0 + 6, x1: m.x1 - 6, y0: m.y0 + 7, y1: m.y1 - 7 };
    rect(g, p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, PAL.LIT);
    dither(g, p.x0, p.y0, p.x1 - p.x0, 3, PAL.LIT_D, 0.5);      // grime
    dither(g, p.x0, p.y1 - 4, p.x1 - p.x0, 4, PAL.LIT_D, 0.6);
    for (var s = 0; s < 6; s++) {                                // water streaks
      var sx = p.x0 + 4 + R() * (p.x1 - p.x0 - 8);
      dither(g, sx, p.y0, 2, p.y1 - p.y0, PAL.LIT_D, 0.5);
    }
    textC(g, 'HOLLER ROLLER', 108, m.y0 + 13, PAL.WOOD1, 2);
    drawTube(g, 0, null);                                         // pink neon
  }
  // the marquee's neon tube; `chase` (attract) runs bright segments along it
  function drawTube(g, t, chase) {
    var m = GEO.marquee, x0 = m.x0 + 4, x1 = m.x1 - 5;
    if (!chase) {
      hline(g, x0, x1, m.y1 - 1, PAL.PINK);
      hline(g, x0, x1, m.y1, PAL.PINK_D);
      dither(g, x0, m.y1 + 1, m.x1 - m.x0 - 8, 2, PAL.PINK_DK, 0.4);
      return;
    }
    // gas pulses running left→right: 16 px period, 5 px lit, a white-hot
    // leading pixel, the rest of the tube banked down to its dark pink
    var head = t * 38;
    for (var x = x0; x <= x1; x++) {
      var ph = ((x - head) % 16 + 16) % 16;
      var lit = ph < 5;
      px(g, x, m.y1 - 1, lit ? (ph < 1 ? PAL.MOON : PAL.PINK) : PAL.PINK_D);
      px(g, x, m.y1, lit ? PAL.PINK_D : PAL.PINK_DK);
      if (lit && BAYER[((m.y1 + 1) % 4) * 4 + (x % 4)] < 9) px(g, x, m.y1 + 1, PAL.PINK_DK);
      if (lit && ph < 3 && BAYER[((m.y1 + 2) % 4) * 4 + (x % 4)] < 5) px(g, x, m.y1 + 2, PAL.PINK_DK);
    }
  }

  // eye rectangles shared by the static draw and the live gaze
  var EYES = {
    L: { x: -7, y: 14, w: 4, h: 5 },  // the left one is bigger…
    R: { x: 4, y: 15, w: 3, h: 4 }    // …and they don't quite agree
  };

  function drawPossum(g, R) {
    var cx = GEO.possum.cx, top = GEO.possum.top;
    // ears: big, round, chewed
    ellipse(g, cx - 12, top + 5, 7, 7, PAL.FUR3);
    ellipse(g, cx + 12, top + 5, 7, 7, PAL.FUR3);
    ellipse(g, cx - 12, top + 6, 4, 4, PAL.PINK_D);
    ellipse(g, cx + 12, top + 6, 4, 4, PAL.PINK_D);
    rect(g, cx - 17, top + 1, 3, 3, PAL.NIGHT1); // a notch bitten out of the left ear
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
    if (!BARE) drawEyeBeads(g, 0, false);
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
  // black beads with pink neon glints; dx shifts the gaze, wide = startled
  function drawEyeBeads(g, dx, wide) {
    var cx = GEO.possum.cx + dx, top = GEO.possum.top;
    var L = EYES.L, Rr = EYES.R, e = wide ? 1 : 0;
    rect(g, cx + L.x - e, top + L.y - e, L.w + 2 * e, L.h + 2 * e, PAL.NIGHT0);
    rect(g, cx + Rr.x - e, top + Rr.y - e, Rr.w + 2 * e, Rr.h + 2 * e, PAL.NIGHT0);
    px(g, cx + L.x + 2, top + L.y + 1, PAL.PINK);
    px(g, cx + Rr.x + 1, top + Rr.y + 1, PAL.PINK);
    if (wide) { // pupils blown wide: the glints swell into 2×2 neon
      rect(g, cx + L.x + 1, top + L.y + 1, 2, 2, PAL.PINK);
      rect(g, cx + Rr.x, top + Rr.y + 1, 2, 2, PAL.PINK);
      px(g, cx + L.x + 1, top + L.y + 1, PAL.MOON);
    }
  }

  function drawScoreBar(g, R) {
    var s = GEO.score;
    var x0 = cabL(s.y0) + 4, x1 = cabR(s.y0) - 4;
    rect(g, x0, s.y0, x1 - x0, s.y1 - s.y0, PAL.WOOD2);
    hline(g, x0, x1 - 1, s.y0, PAL.WOOD4);
    hline(g, x0, x1 - 1, s.y1 - 1, PAL.WOOD1);
    // drum counter window (the drums speak for themselves: no SCORE label)
    var d = GEO.drums;
    rect(g, d.x0 - 2, d.y0 - 2, d.cells * d.cw + 4, d.ch + 4, PAL.WOOD1);
    for (var i = 0; i < d.cells; i++) {
      var dx = d.x0 + i * d.cw;
      rect(g, dx, d.y0, d.cw - 2, d.ch, PAL.BONE);
      dither(g, dx, d.y0, d.cw - 2, 2, PAL.BONE_D, 0.6);       // drum curvature
      dither(g, dx, d.y0 + d.ch - 2, d.cw - 2, 2, PAL.BONE_D, 0.6);
      textC(g, '0', dx + (d.cw - 2) / 2, d.y0 + 5, PAL.NIGHT0, 1);
    }
  }

  function drawTarget(g, R) {
    var t = GEO.target;
    var x0 = function (y) { return cabL(y) + 5; }, x1 = function (y) { return cabR(y) - 5; };
    // backstop panel: near-black aged walnut
    woodBand(g, R, t.y0, t.y1, x0, x1, PAL.WOOD2, PAL.WOOD1, PAL.WOOD3);
    dither(g, 60, t.y0, 100, 8, PAL.WOOD1, 0.5);
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
    var srx = SPEC.maxRx, sry = Math.round(srx * SPEC.ratio);
    for (var s = 0; s < 26; s++) {
      var a = R() * Math.PI * 2, rr = 0.3 + R() * 0.65;
      var sx = t.cx + Math.cos(a) * srx * rr, sy = t.cy + Math.sin(a) * sry * rr;
      px(g, Math.round(sx), Math.round(sy), R() < 0.5 ? PAL.CORK2 : PAL.WOOD2);
    }
    drawDent(g);

    // painted point values in the dark troughs
    for (i = 0; i < GEO.rings.length; i++) {
      var rg = GEO.rings[i];
      if (rg.label) textC(g, rg.label, t.cx, rg.ly, PAL.BONE, 1);
    }

    // the two 100 holes, dark mouths with pink light way down inside
    var hr = GEO.holeR;
    for (i = 0; i < GEO.holes100.length; i++) {
      var h = GEO.holes100[i];
      ellipse(g, h.x, h.y - 1, hr, Math.round(hr * 0.7), PAL.WOOD4); // surround, lit top
      ellipse(g, h.x, h.y, hr, Math.round(hr * 0.7), PAL.WOOD1);
      ellipse(g, h.x, h.y, hr - 2, Math.round(hr * 0.7) - 1, PAL.GAP); // the hole
      ellipse(g, h.x, h.y + 2, hr - 5, 1, PAL.PINK_DK);  // glow from below
      px(g, h.x, h.y + 1, PAL.PINK_D);
      textC(g, '100', h.x, h.y + 7, PAL.PINK, 1);        // label below the hole
    }
  }

  // The dent in the 40's rim (R_3, the hoop between the 30 and the 40) on
  // its upper-right octant: a 7 px run where the rim is pressed flat — the
  // round stair of highlights is cut back to one straight diagonal in
  // shadow, with raw chipped cork catching the light at its upper end. The
  // physics lowers rimH 40 % over the same arc; balls skip out into the 30.
  // Hand-placed pixels, relative to the ring centre (108, 158).
  var DENT = [
    // cut the round outer stair back to a straight 45° edge, 2 px inward:
    // beyond it the dark trough shows through (the rim is lower there)
    [8, -18, 'GAP'], [9, -18, 'GAP'],
    [9, -17, 'GAP'], [10, -17, 'GAP'], [11, -17, 'GAP'],
    [10, -16, 'GAP'], [11, -16, 'GAP'], [12, -16, 'GAP'],
    [11, -15, 'GAP'], [12, -15, 'GAP'], [13, -15, 'GAP'],
    [12, -14, 'GAP'], [13, -14, 'GAP'], [14, -14, 'GAP'],
    [13, -13, 'GAP'], [14, -13, 'GAP'], [15, -13, 'GAP'],
    [14, -12, 'GAP'], [15, -12, 'GAP'],
    // the pressed-flat face: one straight diagonal in shadow
    [8, -17, 'CORK2'], [9, -16, 'CORK2'], [10, -15, 'CORK2'],
    [11, -14, 'CORK2'], [12, -13, 'CORK2'], [13, -12, 'CORK2'],
    // crushed cork just inside it
    [8, -16, 'WOOD2'], [10, -14, 'WOOD2'],
    // the chip at the flat's upper end: raw cork catching the light
    [6, -19, 'BONE_D'], [7, -18, 'CORK3']
  ];
  function drawDent(g) {
    var cx = GEO.target.cx, cy = GEO.target.cy;
    for (var i = 0; i < DENT.length; i++) px(g, cx + DENT[i][0], cy + DENT[i][1], PAL[DENT[i][2]]);
  }

  // the machine's open mouth: the shadowed cavity between the bed's bottom
  // lip and the ball-hop. It spans the alley's width; the bed hangs over it.
  function drawPit(g, R) {
    var p = GEO.pit;
    hline(g, cabL(p.y0 - 2) + 5, cabR(p.y0 - 2) - 5, p.y0 - 2, PAL.WOOD5); // the lip
    hline(g, cabL(p.y0 - 1) + 5, cabR(p.y0 - 1) - 5, p.y0 - 1, PAL.WOOD3);
    for (var y = p.y0; y < p.y1; y++) {
      hline(g, cabL(y) + 5, cabR(y) - 5, y, PAL.WOOD2);        // shelf corners
      hline(g, laneL(y) - 3, laneR(y) + 3, y, PAL.NIGHT0);      // the mouth
    }
    // faint pink breathing way down inside (same light as the 100 holes)
    dither(g, 84, p.y0 + Math.round((p.y1 - p.y0) / 2), 48, 2, PAL.PINK_DK, 0.15);
    // dusty reflected light on the cavity's near edge
    dither(g, laneL(p.y1) + 2, p.y1 - 2, laneR(p.y1) - laneL(p.y1) - 4, 2, PAL.WOOD2, 0.35);
  }

  // the alley's side rails, running continuously from the bed's lip past
  // the pit and hop down to the player: a lit top edge converging on the
  // vanishing point, and a shadowed inner face dropping to the lane floor.
  function drawSideRails(g, R) {
    var yTop = GEO.pit.y0, yBot = GEO.lane.y1;
    function lineAt(x0, y0, x1, y1, y) {
      if (y <= y0) return x0;
      if (y >= y1) return x1;
      return x0 + (x1 - x0) * (y - y0) / (y1 - y0);
    }
    for (var side = 0; side < 2; side++) {
      var dir = side === 0 ? -1 : 1;
      var footT = side === 0 ? laneL(yTop) : laneR(yTop);
      var footB = side === 0 ? laneL(yBot) : laneR(yBot);
      var cT = { x: footT + dir * 2, y: yTop - 3 }, cB = { x: footB + dir * 7, y: yBot - 9 };
      var oT = { x: cT.x + dir * 3, y: cT.y }, oB = { x: cB.x + dir * 8, y: cB.y };
      for (var y = cT.y; y <= yBot; y++) {
        var xF = Math.round(lineAt(footT, yTop, footB, yBot, y));
        var xC = Math.round(lineAt(cT.x, cT.y, cB.x, cB.y, y));
        var xO = Math.round(lineAt(oT.x, oT.y, oB.x, oB.y, y));
        for (var x = xC; (x - xF) * dir >= 0; x += -dir)   // inner face
          px(g, x, y, ((x * 13 + y * 7) % 19 === 0) ? PAL.WOOD1 : PAL.WOOD2);
        px(g, xF, y, PAL.WOOD1);                            // gutter shadow
        if (y <= cB.y) {                                    // lit top edge
          for (x = xO; (x - xC) * dir >= 0; x += -dir) px(g, x, y, PAL.WOOD5);
          px(g, xC, y, PAL.WOOD6);
          px(g, xO + dir, y, PAL.WOOD2);
        }
      }
      for (y = cB.y; y <= yBot; y++) {                      // end-grain cap
        var xC2 = Math.round(lineAt(cT.x, cT.y, cB.x, cB.y, Math.min(y, cB.y)));
        var xO2 = Math.round(lineAt(oT.x, oT.y, oB.x, oB.y, Math.min(y, cB.y)));
        for (x = xO2; (x - xC2) * dir >= 0; x += -dir) px(g, x, y, PAL.WOOD3);
        px(g, xO2, y, PAL.WOOD2);
      }
    }
  }

  // the ball-hop: a small lane-wide bump whose face tilts toward the player
  // and the light — a hard bright crest blending down into the lane's wax
  function drawRamp(g, R) {
    var rp = GEO.ramp, hump = SPEC.hump, hw = SPEC.laneTopW;
    for (var y = rp.y0; y < rp.y1; y++) { // dark underfill: shadowed side walls
      hline(g, cabL(y) + 5, cabR(y) - 5, y, PAL.WOOD1);
      px(g, cabL(y) + 5, y, PAL.WOOD1); px(g, cabR(y) - 5, y, PAL.WOOD5);
    }
    for (var x = 108 - hw; x <= 108 + hw; x++) {
      var dx = Math.abs(x - 108);
      var yTop = rp.y0 + Math.round(hump * (dx / hw) * (dx / hw)); // crest dips at the sides
      for (y = yTop; y < rp.y1; y++) {
        var f = (y - yTop) / (rp.y1 - yTop);   // 0 at crest, 1 at lane
        var c = f < 0.45 ? PAL.LANE1 : PAL.LANE2;
        if (f > 0.35 && f < 0.55) c = (BAYER[(y % 4) * 4 + (x % 4)] < 8) ? PAL.LANE1 : PAL.LANE2;
        px(g, x, y, c);
      }
      px(g, x, yTop, PAL.BONE);                                     // crest edge
      if ((x + BAYER[x % 4]) % 2) px(g, x, rp.y1 - 1, PAL.LANE3);   // contact shadow
    }
    dither(g, 100, rp.y0, 16, 1, PAL.BONE, 0.3); // wax sparkle at the apex
  }

  function drawLane(g, R) {
    var ln = GEO.lane;
    for (var y = ln.y0; y < ln.y1; y++) hline(g, laneL(y), laneR(y), y, PAL.LANE2);
    for (var k = 1; k < 6; k++) { // plank seams converging toward the vanishing point
      var f = k / 6;
      for (y = ln.y0; y < ln.y1; y++) {
        var xx = laneL(y) + f * (laneR(y) - laneL(y));
        if ((y + k) % 2) px(g, Math.round(xx), y, PAL.LANE3);
      }
    }
    for (y = ln.y0; y < ln.y1; y++) { // wax sheen down the center
      var lw = Math.round((laneR(y) - laneL(y)) * 0.16);
      hline(g, 108 - lw, 108 + lw, y, PAL.LANE1);
    }
    dither(g, 84, ln.y0, 12, ln.y1 - ln.y0, PAL.LANE2, 0.5);
    dither(g, 120, ln.y0, 12, ln.y1 - ln.y0, PAL.LANE2, 0.5);
    for (var s = 0; s < 40; s++) { // scuffs and ball tracks
      var sy = ln.y0 + R() * (ln.y1 - ln.y0);
      var sx = laneL(sy) + R() * (laneR(sy) - laneL(sy));
      var len = 2 + R() * 6;
      for (var d = 0; d < len; d++) px(g, Math.round(sx), Math.round(sy + d), PAL.LANE3);
    }
    for (y = ln.y0; y < ln.y1; y++) { // side gutters + bumper caps
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

  // front panel furniture shared by the static draw and drawLive
  function frontX() { var y = GEO.rail.y0; return { x0: cabL(y) + 3, x1: cabR(y) - 3 }; }
  function rackBallAt(i) { var f = frontX(); return { x: f.x0 + 14 + i * 17, y: GEO.rail.y0 + 11 }; }
  function drawRackBall(g, i, bx, by) {
    ellipse(g, bx, by, 5, 5, PAL.BONE);
    px(g, bx - 2, by - 2, PAL.MOON);                    // glint
    dither(g, bx - 3, by + 2, 7, 3, PAL.BONE_D, 0.6);   // shade
    if (i === 2 || i === 6) px(g, bx + 1, by, PAL.BONE_D); // scuffed ones
    if (i === 4) { px(g, bx, by - 1, PAL.CORK2); px(g, bx + 1, by + 1, PAL.CORK2); } // the dirty one
  }
  function troughRect() { var f = frontX(), rl = GEO.rail; return { x: f.x0 + 6, y: rl.y0 + 4, w: f.x1 - f.x0 - 12, h: 14 }; }
  function slotRect() { var f = frontX(), fr = GEO.front; return { x: f.x1 - 42, y: fr.y0 + 9, w: 32, h: 8 }; }

  function drawFrontPanel(g, R) {
    var rl = GEO.rail, fr = GEO.front, f = frontX(), x0 = f.x0, x1 = f.x1;
    woodBand(g, R, rl.y0, fr.y1, function () { return x0; }, function () { return x1; }, PAL.WOOD3, PAL.WOOD2, PAL.WOOD4);
    hline(g, x0, x1, rl.y0, PAL.WOOD5);
    // ball return trough
    rect(g, x0 + 6, rl.y0 + 4, x1 - x0 - 12, 14, PAL.WOOD1);
    hline(g, x0 + 6, x1 - 6, rl.y0 + 4, PAL.NIGHT0);
    hline(g, x0 + 6, x1 - 6, rl.y0 + 17, PAL.WOOD4); // brass-lit lip
    // nine bone-white balls racked and waiting
    if (!BARE) for (var i = 0; i < 9; i++) { var b = rackBallAt(i); drawRackBall(g, i, b.x, b.y); }
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
    if (!BARE) {
      rect(g, x1 - 34, fr.y0 + 10, 12, 5, PAL.PINK_D);  // the ticket
      rect(g, x1 - 34, fr.y0 + 12, 12, 1, PAL.PINK);
      px(g, x1 - 30, fr.y0 + 11, PAL.PINK_DK); px(g, x1 - 26, fr.y0 + 13, PAL.PINK_DK);
    }
  }

  function drawBaseAndStain(g, R) {
    var y0 = GEO.front.y1;
    rect(g, cabL(y0) - 2, y0, cabR(y0) - cabL(y0) + 4, 8, PAL.WOOD2); // plinth
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
    dither(g, cabL(y0) - 6, y0 + 8, cabR(y0) - cabL(y0) + 12, 5, PAL.NIGHT0, 0.8); // pooled shadow
  }

  function drawCobwebsAndGrime(g, R) {
    var cx = cabR(cabTop()) - 1, cy = cabTop() + 2; // cobweb, top-right corner
    for (var i = 0; i < 3; i++) {
      var rr = 5 + i * 4;
      for (var a = Math.PI * 0.5; a <= Math.PI; a += 0.22)
        if ((i + Math.round(a * 10)) % 2) px(g, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.8), PAL.PUR2);
    }
    px(g, cx - 4, cy + 3, PAL.FOG); px(g, cx - 9, cy + 6, PAL.PUR2);
    // drip stains running down the side rails, following the cabinet taper
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

  var staticLayer = null, bareLayer = null, occluders = {};

  function setHeight(h) {
    h = Math.max(H_MIN, Math.min(H_MAX, Math.floor(h) || H_MIN));
    if (h === H && staticLayer) return false;
    var extra = h - MH;
    H = h;
    TOP = ((extra >> 1) >> 2) << 2; // about half the spare rows above, a multiple of 4
    BOT = extra - TOP;
    staticLayer = null; bareLayer = null; occluders = {};
    return true;
  }

  function renderLayer(bare) {
    var c = makeCanvas(W, H), g = c.getContext('2d');
    g.translate(0, TOP);
    BARE = bare;
    var R = rng(0xC0FFEE);
    drawRoom(g);
    drawCabinetBody(g, R);
    drawTarget(g, R);
    drawPit(g, R);
    drawRamp(g, R);
    drawLane(g, R);
    drawSideRails(g, R);
    drawScoreBar(g, R);
    drawMarquee(g, R);
    drawFrontPanel(g, R);
    drawBaseAndStain(g, R);
    drawCobwebsAndGrime(g, R);
    drawPossum(g, R);
    BARE = false;
    return c;
  }
  function buildStatic() {
    staticLayer = renderLayer(false);
    bareLayer = renderLayer(true);
    occluders = {};
    return staticLayer;
  }
  // copy a machine-frame rectangle from the bare layer (live elements are
  // repainted over their own clean background)
  function restore(g, x, y, w, h) {
    g.drawImage(bareLayer, x, y + TOP, w, h, x, y, w, h);
  }

  /* ══ dynamic frame: ambient life ══════════════════════════════════ */

  // deterministic flicker: hash of the time bucket (Date-free; driven by t)
  function flickerAt(t, rate, seed) {
    var b = Math.floor(t * rate) + seed;
    b = Math.imul(b ^ b >>> 13, 0x5bd1e995); b ^= b >>> 15;
    return (b >>> 0) / 4294967296;
  }

  function drawFrame(ctx, t, opts) {
    if (!staticLayer) buildStatic();
    ctx.drawImage(staticLayer, 0, 0);
    var g = ctx;
    g.save(); g.translate(0, TOP);
    if (opts && typeof opts.score === 'number') drawDrumDigits(g, opts.score);

    // ── the dying marquee bulb behind ROLLER's final R: 'HOLLER ROLLER' is
    // centred at 108, scale 2 → the last R occupies x 153..159
    var f = flickerAt(t, 7, 13);
    var dying = f < 0.25 ? 0.9 : (f < 0.45 ? 0.5 : 0.1); // mostly dark, stutters lit
    if (dying > 0.05) {
      g.globalAlpha = dying;
      rect(g, 151, GEO.marquee.y0 + 8, 12, GEO.marquee.y1 - GEO.marquee.y0 - 16, '#3c2814');
      g.globalAlpha = 1;
      if (dying > 0.5) textC(g, 'R', 156, GEO.marquee.y0 + 13, PAL.WOOD2, 2);
    }

    // ── neon breathing on the 100 holes
    var breathe = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.4));
    for (var i = 0; i < GEO.holes100.length; i++) drawHoleBreath(g, t, i, breathe);

    // ── possum blink: 150ms flutters, each eye on its own clock
    var cx = GEO.possum.cx, top = GEO.possum.top;
    if (flickerAt(t, 6.7, 3) < 0.025)
      rect(g, cx + EYES.L.x, top + EYES.L.y, EYES.L.w, EYES.L.h, PAL.FUR2);
    if (flickerAt(t, 6.7, 11) < 0.025)
      rect(g, cx + EYES.R.x, top + EYES.R.y, EYES.R.w, EYES.R.h, PAL.FUR2);

    // ── neon reflection shimmer along the ramp's polished lip
    if (flickerAt(t, 9, 5) < 0.5)
      dither(g, 98, GEO.ramp.y0, 20, 1, PAL.PINK_D, 0.12);
    g.restore();
  }
  function drawHoleBreath(g, t, i, breathe) {
    var hr = GEO.holeR, h = GEO.holes100[i];
    glowRing(g, h.x, h.y, hr - 1, Math.round(hr * 0.6) - 1, 4, PAL.PINK_DK, breathe);
    if (flickerAt(t, 2.3, i * 7) > 0.2) { // pink core, rarely gutters out
      ellipse(g, h.x, h.y + 1, 2, 1, PAL.PINK_D);
      px(g, h.x, h.y + 1, PAL.PINK);
    }
  }

  /* ══ the machine reacts: drawLive(ctx, t, view) ══════════════════ */
  //
  // view (all optional; main.js owns it):
  //   mode        'attract' | 'play' | 'payout'
  //   score       number shown on the drums
  //   drum        {from, to, t0} — roll from→to starting at t0 (main sets
  //               it when the score changes); absent = hold `score`
  //   highScore   attract shows it on the drums every 8 s
  //   ballsLeft   0..9 balls in the return rack (default 9)
  //   lift        {t0} — the ball in slot `ballsLeft` lifts into the lane
  //   ticketsOut  tickets cranked out so far (fractional = mid-ticket)
  //   cranking    the dispenser is running (ratchet jitter)
  //   hundreds    number of 100s this game (payout shows "13")
  //   jackpot     {hole: 0|1, t0} — that 100 hole flashes pink
  //   holeGlow    [a, b] 0..1 — a 100 hole swallowing a ball glows brighter
  //   ballSx      the ball's screen x (machine frame); the possum watches it
  //   wideT0      time of the last 100: the possum's pupils blow wide
  function drawLive(ctx, t, view) {
    if (!staticLayer) buildStatic();
    view = view || {};
    var g = ctx;
    g.save(); g.translate(0, TOP);
    var mode = view.mode || 'play';

    drawDrumsLive(g, t, view, mode);
    drawRackLive(g, t, view);
    drawTicketsLive(g, t, view);
    drawEyesLive(g, t, view);
    if (mode === 'attract') {
      drawTube(g, t, true);
      drawChalkNote(g, t);
    }
    drawHolesLive(g, t, view);
    if (mode === 'payout' && view.hundreds > 0) {
      // a pink "13" over the ticket window: thirteen tickets per 100
      if (flickerAt(t, 3, 17) > 0.2) {
        var s = slotRect();
        var label = view.hundreds > 1 ? '13X' + view.hundreds : '13';
        textC(g, label, s.x + s.w / 2, s.y - 20, PAL.PINK, 2);
      }
    }
    g.restore();
  }

  /* ── drums: each digit slides ~150 ms; the tens drum sticks ~200 ms ── */
  var DRUM_T = 0.15, TENS_LAG = 0.2;
  function digitsOf(v) {
    var s = String(Math.max(0, Math.min(9999, v | 0)));
    while (s.length < 4) s = '0' + s;
    return [+s[0], +s[1], +s[2], +s[3]];
  }
  // per-drum fractional position (drums only roll forward, through every
  // intermediate digit, like an odometer)
  function drumPositions(from, to, t0, t) {
    var a = digitsOf(from), b = digitsOf(to), out = [];
    for (var i = 0; i < 4; i++) {
      var steps = (b[i] - a[i] + 10) % 10;
      var start = t0 + (i === 2 ? TENS_LAG : 0);
      var k = Math.max(0, Math.min(1, (t - start) / DRUM_T));
      k = k * k * (3 - 2 * k);
      out.push(a[i] + steps * k);
    }
    return out;
  }
  function drawDrumCells(g, pos) {
    var d = GEO.drums;
    for (var i = 0; i < 4; i++) {
      var dx = d.x0 + i * d.cw, p = pos[i], base = Math.floor(p + 1e-6), fr = p - base;
      var off = Math.round(fr * 8);
      rect(g, dx, d.y0 + 2, d.cw - 2, d.ch - 4, PAL.BONE);
      g.save();
      g.beginPath(); g.rect(dx, d.y0 + 2, d.cw - 2, d.ch - 4); g.clip();
      textC(g, String(base % 10), dx + (d.cw - 2) / 2, d.y0 + 5 - off, PAL.NIGHT0, 1);
      if (off > 0) textC(g, String((base + 1) % 10), dx + (d.cw - 2) / 2, d.y0 + 13 - off, PAL.NIGHT0, 1);
      g.restore();
      if (off > 0) dither(g, dx, d.y0 + 2, d.cw - 2, 1, PAL.BONE_D, 0.5); // blur on the roll
    }
  }
  function drawDrumDigits(g, value) { drawDrumCells(g, digitsOf(value)); }
  function drawDrumsLive(g, t, view, mode) {
    var score = view.score | 0;
    if (mode === 'attract' && view.highScore > 0) {
      // every 8 s the drums roll over to the high score and back
      var c0 = Math.floor(t / 8) * 8, ph = t - c0;
      if (ph >= 5) drawDrumCells(g, drumPositions(score, view.highScore, c0 + 5, t));
      else drawDrumCells(g, drumPositions(view.highScore, score, c0, t));
      return;
    }
    var dr = view.drum;
    if (dr) drawDrumCells(g, drumPositions(dr.from, dr.to, dr.t0, t));
    else drawDrumDigits(g, score);
  }

  /* ── the ball-return rack ── */
  var LIFT_T = 0.4;
  function drawRackLive(g, t, view) {
    var n = view.ballsLeft == null ? 9 : Math.max(0, Math.min(9, view.ballsLeft | 0));
    var lifting = view.lift && t - view.lift.t0 < LIFT_T && t >= view.lift.t0;
    if (n === 9 && !lifting) return; // the static rack is already right
    var tr = troughRect();
    restore(g, tr.x, tr.y - 6, tr.w, tr.h + 6); // balls stand 1 px proud of the trough
    for (var i = 0; i < n; i++) { var b = rackBallAt(i); drawRackBall(g, i, b.x, b.y); }
    if (lifting) {
      // the next ball rises out of slot n and arcs up onto the throw line
      var k = (t - view.lift.t0) / LIFT_T, e = k * k * (3 - 2 * k);
      var from = rackBallAt(Math.min(8, n)), to = project(0, BALL_R, 0);
      var x = from.x + (to.sx - from.x) * e;
      var y = from.y + (to.sy - from.y) * e - Math.sin(k * Math.PI) * 10;
      var r = 5 + (6.8 * to.scale - 5) * e;
      drawBall(g, x, y, r);
    }
  }

  /* ── the ticket dispenser: a pink strip cranks out pixel by pixel ── */
  var TICKET_PX = 4; // one ticket = 4 px of strip: fill, stripe, fill, perforation
  function drawTicketsLive(g, t, view) {
    var out = view.ticketsOut || 0;
    if (out <= 0 && !view.cranking) return;
    var s = slotRect(), fr = GEO.front;
    restore(g, s.x, s.y, s.w, s.h);
    var x0 = s.x + 8, w = 12;                  // same stub position as the static ticket
    var len = Math.floor(out * TICKET_PX);
    if (view.cranking && flickerAt(t, 14, 29) < 0.5) len = Math.max(0, len - 1); // ratchet
    var yTop = fr.y0 + 10;                     // leaves the slot here
    var floorY = MH + BOT - 2;                 // the strip coils on the floor
    var hang = Math.max(0, Math.min(len, floorY - yTop));
    // pink hanging strip
    for (var k = 0; k < hang; k++) {
      var y = yTop + k, row = k % TICKET_PX;
      var c = row === 1 ? PAL.PINK : (row === 3 ? PAL.PINK_DK : PAL.PINK_D);
      if (row === 3) { for (var q = 0; q < w; q += 2) px(g, x0 + q, y, PAL.PINK_DK); px(g, x0 + 1, y, PAL.PINK_D); }
      else hline(g, x0, x0 + w - 1, y, c);
      px(g, x0 + w - 1, y, PAL.PINK_DK);       // shaded edge
    }
    // the slot mouth stays dark over the strip's root, so it reads as coming *out*
    hline(g, s.x + 2, s.x + s.w - 3, s.y + 2, PAL.NIGHT0);
    // the rest folds into a heap on the floor, layer on layer
    var rest = len - hang, layer = 0;
    while (rest > 0) {
      var lw = Math.min(rest, 16), jig = (layer % 2) ? 1 : -1;
      var ly = floorY - layer, lx = x0 - 2 + jig + ((layer * 5) % 3);
      hline(g, lx, lx + lw - 1, ly, (layer % 2) ? PAL.PINK : PAL.PINK_D);
      px(g, lx + lw - 1, ly, PAL.PINK_DK);
      rest -= 16; layer++;
    }
  }

  /* ── possum gaze ── */
  var WIDE_T = 2.5;
  function drawEyesLive(g, t, view) {
    var dx = 0;
    if (typeof view.ballSx === 'number') dx = Math.max(-2, Math.min(2, Math.round((view.ballSx - 108) / 22)));
    var wide = typeof view.wideT0 === 'number' && t >= view.wideT0 && t - view.wideT0 < WIDE_T;
    if (dx === 0 && !wide) return; // the static eyes (and drawFrame's blink) stand
    var cx = GEO.possum.cx, top = GEO.possum.top;
    restore(g, cx - 12, top + 11, 24, 11);
    drawEyeBeads(g, dx, wide);
    var e = wide ? 1 : 0; // a blink covers the whole (possibly blown-wide) bead
    if (flickerAt(t, 6.7, 3) < 0.025)
      rect(g, cx + dx + EYES.L.x - e, top + EYES.L.y - e, EYES.L.w + 2 * e, EYES.L.h + 2 * e, PAL.FUR2);
    if (flickerAt(t, 6.7, 11) < 0.025)
      rect(g, cx + dx + EYES.R.x - e, top + EYES.R.y - e, EYES.R.w + 2 * e, EYES.R.h + 2 * e, PAL.FUR2);
  }

  /* ── attract: "5¢ - SWIPE" chalked on the lane, fading in and out ── */
  function drawChalkNote(g, t) {
    var a = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 5); // 5 s breath
    a = Math.max(0, a * 1.2 - 0.1);
    if (a <= 0.02) return;
    var str = '5¢ - SWIPE', y = GEO.lane.y1 - 38, x = Math.round(108 - textW(str, 1) / 2);
    g.fillStyle = PAL.BONE;
    for (var k = 0; k < str.length; k++) {
      var gl = FONT[str[k]] || FONT[' '];
      for (var row = 0; row < 5; row++)
        for (var col = 0; col < 3; col++) {
          if (!(gl[row] & (4 >> col))) continue;
          var X = x + k * 4 + col, Y = y + row;
          // chalk: pixels drop out on the Bayer grid as it fades
          if (BAYER[(Y % 4) * 4 + (X % 4)] / 16 < a * 0.95) g.fillRect(X, Y, 1, 1);
        }
    }
  }

  /* ── the 100 holes: jackpot flash and the swallow glow ── */
  var JACKPOT_T = 1.6;
  function drawHolesLive(g, t, view) {
    var hr = GEO.holeR;
    for (var i = 0; i < 2; i++) {
      var h = GEO.holes100[i];
      var glow = view.holeGlow ? view.holeGlow[i] || 0 : 0;
      if (glow > 0) glowRing(g, h.x, h.y, hr - 1, Math.round(hr * 0.6) - 1, 5, PAL.PINK_D, 0.3 + 0.6 * glow);
      var jp = view.jackpot;
      if (jp && jp.hole === i && t >= jp.t0 && t - jp.t0 < JACKPOT_T) {
        var on = Math.floor((t - jp.t0) * 8) % 2 === 0;
        if (on) {
          ellipse(g, h.x, h.y, hr - 2, Math.round(hr * 0.7) - 1, PAL.PINK);
          ellipse(g, h.x, h.y + 1, hr - 5, 2, PAL.MOON);
          glowRing(g, h.x, h.y, hr, Math.round(hr * 0.7), 6, PAL.PINK, 0.9);
          textC(g, '100', h.x, h.y + 7, PAL.MOON, 1);
        } else {
          glowRing(g, h.x, h.y, hr, Math.round(hr * 0.7), 5, PAL.PINK_D, 0.7);
        }
      }
    }
  }

  /* ══ gameplay projection ══════════════════════════════════════════ */
  //
  // Machine units (shared with the physics, PLAN-2 §2): 1 unit = half the
  // lane width; x lateral, y up, z down the lane from the throw line.
  //   lane y = 0 for z ∈ [0, 3.5]; hop y = 0.28·((z−3.5)/0.7)² to the
  //   crest at z = 4.2; pit z ∈ [4.2, 4.75]; bed plane from the lip
  //   (z 4.75, y 0.2) rising at β = 0.72 rad, bed coords (u = x, v = slope
  //   distance from the lip); ring centre v = 1.20.
  var BALL_R = 0.11;
  var Z_HOP = 3.5, Z_CREST = 4.2, HOP_H = 0.28, Z_LIP = 4.75, Y_LIP = 0.2, BETA = 0.72;
  var COSB = Math.cos(BETA), SINB = Math.sin(BETA), TANB = Math.tan(BETA);
  var APRON_V = 0.27;       // drawn apron: 14 px below the outer ring ≈ 0.27 units
  var R10 = 0.93;           // outer rim radius, units ↔ rings[0] (52 × 49 px)
  var RIMS = [0.93, 0.744, 0.535, 0.326, 0.116];
  var CUPS = [10, 20, 30, 40, 50];

  // THE FIT (numbers for the 'grand' art):
  //  • Lane + hop, z ∈ [0, 4.2]: the surface point is exactly the old
  //    laneBall(x, z/4.2) — rows 332 (throw line) → 249.4 (z 3.5, the
  //    hop's foot) → 238 (crest), half-width 96 → 62 px per unit.
  //    The drawn hop already bakes its 0.28 rise into those rows, so height
  //    is measured from the local surface (lane or hop profile).
  //  • Bed, z ≥ 4.75: the surface point is the old bedPoint(u, v − 0.27,
  //    0.93): x = 108 + u·55.91 px, row = 207 − (v − 0.27)·52.69 — lip row
  //    221.2 (drawn lip 221), ring centre (v 1.20) row 158.0.
  //  • Pit, z ∈ [4.2, 4.75]: row, half-width and scale interpolate
  //    linearly from the crest (238, 62 px/u, 0.646) to the lip (221.2,
  //    55.9 px/u, 0.56) over a reference surface running 0.28 → 0.2.
  //  • scale: lane = half-width / 96 (1 at the throw line, 0.646 at the
  //    crest); bed = 0.56 / (1 + 0.16·v) → 0.470 at the ring centre, 0.41
  //    at the 100 holes, 0.38 at the backstop. Ball sprite r = 6.8·scale
  //    (6.8 px at the throw line, 4.4 at the crest, 3.2 at the ring centre).
  //  • height: y above the local surface lifts the sprite k = 73.95·scale
  //    px per unit (73.9 at the throw line, 47.8 at the crest, 34.7 at the
  //    ring centre). K0 = 73.95 is chosen so a ball RESTING on the bed
  //    (centre r/cosβ above the plane at a foot r·tanβ down-slope)
  //    projects onto its own contact point at the ring centre (±1 px from
  //    lip to backstop); on the lane a resting ball's sprite then sits
  //    1.3 px above its shadow, a ball on the crest touches the crest line,
  //    a 0.3-unit bounce off the ring centre rises 10 px (3 diameters)
  //    and an apex of 0.6 over the pit floats ~17 px above the mouth.
  var PX_U = 52 / R10, PX_V = 49 / R10;          // 55.91, 52.69 px per unit on the bed
  var RING_BOTTOM_ROW = 158 + 49;                 // outer ring's bottom (old v = 0)
  var LIP_ROW = RING_BOTTOM_ROW + APRON_V * PX_V; // 221.23
  var S_LIP = 0.56, BED_FALL = 0.16;
  var K0 = PX_V * SINB / (S_LIP / (1 + BED_FALL * 1.2)); // 73.95

  // z (0 throw line → 1 crest) to a screen row, with mild foreshortening
  function laneRowAt(zn) {
    var y1 = GEO.lane.y1, y0 = GEO.ramp.y0 + 1;
    var q = 0.45, t = zn * (1 + q) / (1 + q * zn);
    return y1 - (y1 - y0) * t;
  }
  function laneHalfAtRow(y) { return 108 - laneL(y); } // linear, extrapolates
  // inverse of laneRowAt: screen row → zn (0 throw line, 1 crest)
  function laneZAt(row) {
    var y1 = GEO.lane.y1, y0 = GEO.ramp.y0 + 1;
    var T = Math.max(0, Math.min(1, (y1 - row) / (y1 - y0)));
    var q = 0.45;
    return T / ((1 + q) - q * T);
  }
  // lane point (x in [-1,1], zn in [0,1]) → screen pos + perspective scale
  function laneBall(x, zn) {
    var y = laneRowAt(zn), hw = laneHalfAtRow(y);
    return { x: 108 + x * hw, y: y, s: hw / laneHalfAtRow(GEO.lane.y1) };
  }
  // bed point (u lateral, v up-slope from the outer ring's bottom, units
  // of R10) → screen, anchored to the drawn ring ellipses
  function bedPoint(u, v, r10) {
    var r0 = GEO.rings[0];
    return { x: 108 + u * (r0.rx / r10), y: (GEO.target.cy + r0.ry) - v * (r0.ry / r10), ky: r0.ry / r10 };
  }

  var CREST = null;
  function crest() {
    if (!CREST) { var c = laneBall(1, 1); CREST = { row: c.y, hw: c.x - 108, s: c.s }; }
    return CREST;
  }
  function surfY(z) {
    if (z <= Z_HOP) return 0;
    if (z <= Z_CREST) { var q = (z - Z_HOP) / (Z_CREST - Z_HOP); return HOP_H * q * q; }
    if (z <= Z_LIP) return HOP_H + (Y_LIP - HOP_H) * (z - Z_CREST) / (Z_LIP - Z_CREST);
    return Y_LIP + (z - Z_LIP) * TANB;
  }
  function bedScale(v) { return S_LIP / (1 + BED_FALL * Math.max(0, v)); }
  // the surface point under (x, z): screen position, scale, px per unit height
  function foot(x, z) {
    var sx, sy, sc, surface;
    if (z <= Z_CREST) {
      var lb = laneBall(x, z / Z_CREST);
      sx = lb.x; sy = lb.y; sc = lb.s; surface = z <= Z_HOP ? 'lane' : 'hop';
    } else if (z < Z_LIP) {
      var c = crest(), tau = (z - Z_CREST) / (Z_LIP - Z_CREST);
      sy = c.row + (LIP_ROW - c.row) * tau;
      sx = 108 + x * (c.hw + (PX_U - c.hw) * tau);
      sc = c.s + (S_LIP - c.s) * tau; surface = 'pit';
    } else {
      var v = (z - Z_LIP) / COSB;
      sx = 108 + x * PX_U; sy = LIP_ROW - v * PX_V; sc = bedScale(v); surface = 'bed';
    }
    return { sx: sx, sy: sy, scale: sc, k: K0 * sc, surface: surface };
  }
  // (x, y, z) machine units → machine-frame screen point + sprite scale
  function project(x, y, z) {
    var f = foot(x, z);
    return { sx: f.sx, sy: f.sy - (y - surfY(z)) * f.k, scale: f.scale };
  }
  // the ball's contact shadow on whatever surface lies under it (lane, hop
  // or bed); null over the pit mouth, where there is nothing to catch it
  function shadowAt(x, z) {
    var f = foot(x, z);
    if (f.surface === 'pit') return null;
    return { sx: f.sx, sy: f.sy, scale: f.scale, surface: f.surface,
      c: f.surface === 'bed' ? PAL.WOOD1 : PAL.LANE3 };
  }
  // bed coords of a machine point (the foot under it)
  function bedUV(x, z) { return { u: x, v: (z - Z_LIP) / COSB }; }
  // which cup the bed point (u, v) is in: 10..50, 100, or null
  function cupAt(u, v) {
    var d = Math.hypot(u, v - (R10 + APRON_V));
    for (var i = RIMS.length - 1; i >= 0; i--) if (d < RIMS[i]) return CUPS[i];
    for (var j = 0; j < 2; j++) if (Math.hypot(u - HOLES_U[j].u, v - HOLES_U[j].v) < 0.14) return 100;
    return null;
  }
  // the drawn 100 holes in bed units (lip-based v)
  var HOLES_U = GEO.holes100.map(function (h) {
    return { u: (h.x - 108) / PX_U, v: APRON_V + (RING_BOTTOM_ROW - h.y) / PX_V };
  });
  // the geometry as drawn, in physics units, for the one-way boot check
  var DRAWN = {
    rims: RIMS.slice(), ringCentreV: R10 + APRON_V, holes: HOLES_U,
    bedTopV: APRON_V + (RING_BOTTOM_ROW - GEO.target.y0) / PX_V,  // visible bed top (under the score bar)
    bedHalfW: (108 - (cabL(GEO.target.cy) + 5)) / PX_U               // bed inner wall at the ring centre row
  };
  function checkGeometry(pg) {
    var bad = [];
    if (!pg) return bad;
    function near(a, b, tol) { return Math.abs(a - b) <= tol; }
    if (pg.rims) pg.rims.forEach(function (r, i) { if (!near(r, RIMS[i], 0.01)) bad.push('rim ' + i + ' ' + r + ' vs drawn ' + RIMS[i]); });
    var hs = pg.holes || pg.holes100;
    if (hs) hs.forEach(function (h, i) {
      var d = HOLES_U[h.x < 0 || h.u < 0 ? 0 : 1], hv = h.v != null ? h.v : h.z;
      if (!near(Math.abs(h.x != null ? h.x : h.u), Math.abs(d.u), 0.02) || !near(hv, d.v, 0.03))
        bad.push('100 hole ' + i + ' at v ' + hv + ' vs drawn v ' + d.v.toFixed(3));
    });
    var hw = pg.bedHalfW || (pg.bed && pg.bed.halfW), top = pg.bed && pg.bed.vTop;
    if (hw && !near(hw, DRAWN.bedHalfW, 0.06)) bad.push('bed half-width ' + hw + ' vs drawn ' + DRAWN.bedHalfW.toFixed(2));
    if (top && top > DRAWN.bedTopV + 0.05) bad.push('backstop v ' + top + ' is under the score bar (visible bed top v ' + DRAWN.bedTopV.toFixed(2) + ')');
    if (pg.ringC && !near(pg.ringC.v, DRAWN.ringCentreV, 0.01)) bad.push('ring centre v ' + pg.ringC.v + ' vs drawn ' + DRAWN.ringCentreV);
    return bad;
  }

  /* ══ ball sprites and occlusion ═══════════════════════════════════ */

  function drawBall(g, x, y, r) {
    x = Math.round(x); y = Math.round(y); r = Math.max(1, Math.round(r));
    ellipse(g, x, y, r, r, PAL.BONE);
    if (r >= 3) {
      dither(g, x - r + 1, y + (r >> 1) - 1, r * 2 - 1, Math.max(1, r - (r >> 1)), PAL.BONE_D, 0.55);
      px(g, x - (r >> 1), y - (r >> 1), PAL.MOON);
    }
  }
  function drawBallShadow(g, x, y, r, c, flat) {
    ellipse(g, Math.round(x), Math.round(y), Math.max(1, Math.round(r)),
      Math.max(1, Math.round(r * (flat || 0.4))), c || PAL.LANE3);
  }

  // Occluders for a ball sinking into a cup: the static target region with
  // that cup's own trough pixels punched out. Drawn over the sinking ball,
  // clipped to rows below its contact point, it restores the near rim (and
  // anything else in front) so the ball drops *behind* the hoop.
  function troughMask(g, key) {
    var t = GEO.target, rg = GEO.rings;
    if (typeof key === 'number') {             // cup index 0..4 (10..50)
      var gi = key * 2;
      ellipse(g, t.cx, t.cy, rg[gi].rx, rg[gi].ry, '#fff');
      return gi + 1 < rg.length ? rg[gi + 1] : null; // inner hoop to put back
    }
    var h = GEO.holes100[key === 'h0' ? 0 : 1], hr = GEO.holeR;
    ellipse(g, h.x, h.y, hr - 2, Math.round(hr * 0.7) - 1, '#fff');
    return null;
  }
  function occluder(key) {
    if (occluders[key]) return occluders[key];
    var t = GEO.target, y0 = t.y0, hgt = t.y1 - t.y0;
    var c = makeCanvas(W, hgt), g = c.getContext('2d');
    g.drawImage(staticLayer, 0, y0 + TOP, W, hgt, 0, 0, W, hgt);
    g.save(); g.translate(0, -y0);
    g.globalCompositeOperation = 'destination-out';
    var inner = troughMask(g, key);
    g.restore();
    if (inner) { // put the inner hoop (and everything inside it) back
      var m = makeCanvas(W, hgt), mg = m.getContext('2d');
      mg.save(); mg.translate(0, -y0); ellipse(mg, t.cx, t.cy, inner.rx, inner.ry, '#fff'); mg.restore();
      mg.globalCompositeOperation = 'source-in';
      mg.drawImage(staticLayer, 0, y0 + TOP, W, hgt, 0, 0, W, hgt);
      g.drawImage(m, 0, 0);
    }
    occluders[key] = { canvas: c, y0: y0 };
    return occluders[key];
  }
  // cup: 10..50 or 100; side: which 100 hole (x sign); fromRow: rows at or
  // below this are in front of the ball; box: the ball's bounding box
  function drawSinkOccluder(g, cup, side, fromRow, box) {
    var key = cup === 100 ? (side < 0 ? 'h0' : 'h1') : CUPS.indexOf(cup);
    if (key === -1) return;
    var o = occluder(key);
    var y0 = Math.max(Math.ceil(fromRow), o.y0), y1 = Math.min(box.y1, o.y0 + o.canvas.height);
    if (y1 <= y0) return;
    var x0 = Math.max(0, box.x0), x1 = Math.min(W, box.x1);
    g.drawImage(o.canvas, x0, y0 - o.y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }

  var api = {
    W: W,
    get H() { return H; }, get TOP() { return TOP; }, get BOT() { return BOT; },
    MH: MH, H_MIN: H_MIN, H_MAX: H_MAX, PAL: PAL,
    get GEO() { return GEO; },
    setHeight: setHeight, buildStatic: buildStatic,
    get staticLayer() { return staticLayer; }, get bareLayer() { return bareLayer; },
    drawFrame: drawFrame, drawLive: drawLive,
    // projection
    UNITS: { BALL_R: BALL_R, Z_HOP: Z_HOP, Z_CREST: Z_CREST, HOP_H: HOP_H, Z_LIP: Z_LIP, Y_LIP: Y_LIP, BETA: BETA, RIMS: RIMS, CUPS: CUPS, K0: K0 },
    DRAWN: DRAWN, checkGeometry: checkGeometry,
    project: project, shadowAt: shadowAt, surfY: surfY, bedUV: bedUV, cupAt: cupAt,
    laneBall: laneBall, laneZAt: laneZAt, bedPoint: bedPoint,
    // sprites
    drawBall: drawBall, drawBallShadow: drawBallShadow, drawSinkOccluder: drawSinkOccluder,
    drawDrumDigits: drawDrumDigits,
    text: text, textC: textC, flickerAt: flickerAt
  };
  root.SkeeBallRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
