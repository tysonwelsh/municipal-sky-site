/* SCRIP CREEK — renderer
 *
 * All art is procedural pixel art drawn from PAL with a seeded RNG, so the
 * tarnish, grime, and every coin in the pile are identical on every load.
 * The machine renders once into a static offscreen layer at boot;
 * drawFrame() blits it and paints the few live elements (marquee flicker,
 * the raccoon's animatronic eyes, the dying interior bulb, the glass eye's
 * glint, the HUD counts) on top.
 *
 * Internal resolution 216×384 (9:16 portrait), house standard. Machine-
 * space coordinates for the pile sim come in milestone 2; everything here
 * is screen-space.
 *
 * View: head-on through the glass, slightly from above, one-point
 * perspective — the field narrows toward the back. Two tiers: the moving
 * pusher shelf (upper, farther) and the static tray (lower, nearer),
 * then the lip, then the trough (yours, center) and gutters (the house's).
 */
window.CoinPusherRender = (function () {
  'use strict';

  var S = window.ArcadeSprites;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline,
    ellipse = S.ellipse, dither = S.dither, glowRing = S.glowRing,
    text = S.text, textW = S.textW, textC = S.textC;

  var W = 216, H = 384, CX = 108;

  /* ── palette: the night is shared; the machine is local ───────────── */
  var NIGHT = window.ArcadePalette;
  var PAL = {
    // oxidized enamel cabinet, painted-tin blues
    ENAM1: '#1b2030', ENAM2: '#28304a', ENAM3: '#38466b',
    // interior steel
    STEEL1: '#4c4c58', STEEL2: '#8b8b9a',
    SHELF: '#565664', SHELF_D: '#3e3e4a', TRAY: '#61616f',
    // brass trim & the warm interior bulb light
    BRASS1: '#8c6f35', BRASS2: '#c2a04e',
    LIT: '#c2a06a', LIT_D: '#8f7340',
    // tokens (plain brass, tarnished, buffalo-head)
    TOK: '#b3924a', TOK_L: '#d4b25e', TOK_D: '#7e6533',
    TOK_T: '#8a7a4e', BUF: '#9a6f3a',
    // the raccoon
    RC1: '#8d8896', RC2: '#5e5a68', RC3: '#3a3742', MASK: '#16121c',
    // sundries
    JAR: '#93a691', JAR_D: '#6b7d6b',
    VERD: '#4a6b52', RUST: '#6e4632'
  };
  for (var k in NIGHT) PAL[k] = NIGHT[k];

  /* ── geometry ──────────────────────────────────────────────────────── */
  var GEO = {
    cab: { x0: 16, x1: 200, y0: 10, y1: 366 },
    marquee: { x0: 24, x1: 192, y0: 16, y1: 48 },
    plaque: { x0: 60, x1: 156, y0: 52, y1: 66 },
    glass: { x0: 26, x1: 190, y0: 68, y1: 284 },
    // the coin field, in perspective: narrower at the back.
    // Screen maps machine space (see project()): z=0 at the lip (y 256),
    // z=86 at the back wall (y 152); walls flare a little wider up front.
    field: { yBack: 152, yLip: 256, backInset: 46, frontInset: 32 },
    lip: { y: 256 },
    apron: { y0: 258, y1: 282 },
    trough: { x0: 76, x1: 140 },
    raccoon: { cx: CX, headY: 86 },
    hud: { x0: 26, x1: 190, y0: 290, y1: 316 },
    door: { x0: 40, x1: 70, y0: 324, y1: 352 },
    dish: { x0: 118, x1: 178, y0: 326, y1: 352 },
    // live-element cells (drawFrame redraws these over the static layer)
    flickerLetter: null,     // filled in by drawMarquee
    eyes: [{ x: 97, y: 82 }, { x: 115, y: 82 }],
    deadBulb: 3,             // index of the dead bulb in the light strip
    bulbs: [],               // filled in by drawInterior
    glassEye: { x: 152, y: 236 }
  };

  function fieldL(y) {
    var f = GEO.field;
    var t = (Math.max(f.yBack, Math.min(f.yLip, y)) - f.yBack) / (f.yLip - f.yBack);
    return Math.round(f.backInset + (f.frontInset - f.backInset) * t);
  }
  function fieldR(y) { return W - fieldL(y); }

  /* machine space → screen. z=0 lip → y 256; z=86 wall → y 152.
   * Machine x runs 0..150 (center 75); the field is 152 px wide up front,
   * 124 px at the wall. Shelf-tier bodies ride LIFT px higher. */
  var LIFT = 7;
  function halfW(z) { return 76 - z * (14 / 86); }
  function project(x, z, tier) {
    var h = halfW(z);
    return {
      x: CX + (x - 75) * (h / 75),
      y: 256 - z * (104 / 86) - (tier === 1 ? LIFT : 0),
      s: h / 76
    };
  }

  /* ── the room ──────────────────────────────────────────────────────── */
  function drawRoom(g, R) {
    rect(g, 0, 0, W, H, PAL.NIGHT0);
    // the dark gets a bruise-purple cast lower down
    dither(g, 0, 140, W, 120, PAL.NIGHT1, 0.5);
    rect(g, 0, 260, W, H - 260, PAL.NIGHT1);
    dither(g, 0, 250, W, 30, PAL.NIGHT1, 0.5);
    // fog drifting past, low density, mid-height
    dither(g, 0, 60, 18, 90, PAL.PUR1, 0.18);
    dither(g, 198, 80, 18, 100, PAL.PUR1, 0.15);
    dither(g, 0, 100, 14, 40, PAL.FOG, 0.05);
    dither(g, 202, 120, 14, 40, PAL.FOG, 0.05);
    // floorboards
    rect(g, 0, 366, W, H - 366, PAL.NIGHT1);
    for (var y = 368; y < H; y += 5) hline(g, 0, W - 1, y, PAL.NIGHT0);
    for (var i = 0; i < 8; i++) {
      var bx = (i * 43 + (i % 3) * 11) % W;
      vline(g, bx, 366 + (i % 4), 366 + 4 + (i % 4), PAL.NIGHT0);
    }
    // the machine's shadow pools on the boards
    dither(g, 10, 364, 196, 14, PAL.NIGHT0, 0.7);
  }

  /* ── cabinet body ──────────────────────────────────────────────────── */
  function drawCabinet(g, R) {
    var c = GEO.cab;
    rect(g, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, PAL.ENAM2);
    // side shading: left catches faint fog light, right falls off
    vline(g, c.x0, c.y0, c.y1, PAL.ENAM3);
    vline(g, c.x0 + 1, c.y0 + 2, c.y1 - 2, PAL.ENAM3);
    vline(g, c.x1 - 1, c.y0, c.y1, PAL.ENAM1);
    vline(g, c.x1 - 2, c.y0 + 2, c.y1 - 2, PAL.ENAM1);
    hline(g, c.x0, c.x1 - 1, c.y0, PAL.ENAM3);
    // brass top rail
    hline(g, c.x0 + 2, c.x1 - 3, c.y0 + 2, PAL.BRASS1);
    px(g, c.x0 + 2, c.y0 + 2, PAL.BRASS2);
    // paint chips down the sides, enamel worn to steel
    for (var i = 0; i < 26; i++) {
      var cy = c.y0 + 8 + Math.floor(R() * (c.y1 - c.y0 - 20));
      var cxx = R() < 0.5 ? c.x0 + Math.floor(R() * 4) : c.x1 - 1 - Math.floor(R() * 4);
      px(g, cxx, cy, R() < 0.4 ? PAL.STEEL1 : PAL.ENAM1);
      if (R() < 0.3) px(g, cxx + (R() < 0.5 ? 1 : -1), cy + 1, PAL.STEEL1);
    }
  }

  /* ── marquee: SCRIP CREEK ──────────────────────────────────────────── */
  function drawMarquee(g, R) {
    var m = GEO.marquee;
    rect(g, m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, PAL.NIGHT1);
    dither(g, m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, PAL.PUR1, 0.12);
    // brass frame, dinged
    hline(g, m.x0, m.x1 - 1, m.y0, PAL.BRASS1);
    hline(g, m.x0, m.x1 - 1, m.y1 - 1, PAL.BRASS1);
    vline(g, m.x0, m.y0, m.y1 - 1, PAL.BRASS1);
    vline(g, m.x1 - 1, m.y0, m.y1 - 1, PAL.BRASS1);
    px(g, m.x0, m.y0, PAL.BRASS2); px(g, m.x1 - 1, m.y0, PAL.BRASS2);
    // neon glow bed behind the letters
    var name = 'SCRIP CREEK';
    var tx = Math.round(CX - textW(name, 2) / 2), ty = 20;
    dither(g, tx - 4, ty - 2, textW(name, 2) + 8, 14, PAL.PINK_DK, 0.4);
    text(g, name, tx, ty, PAL.PINK, 2);
    // the second R buzzes and dies; drawFrame owns that cell
    GEO.flickerLetter = { ch: 'R', x: tx + 7 * 8, y: ty, cellX: tx + 7 * 8 - 1, cellY: ty - 2, cellW: 9, cellH: 14 };
    // subtitle, hand-painted, a little crooked
    textC(g, 'PUSH YER LUCK', CX + 1, 37, PAL.BONE_D, 1);
    // moth grime in the marquee corners
    dither(g, m.x0 + 2, m.y0 + 2, 10, 5, PAL.NIGHT0, 0.4);
    dither(g, m.x1 - 14, m.y1 - 7, 12, 5, PAL.NIGHT0, 0.35);
  }

  /* ── the coal company plaque ───────────────────────────────────────── */
  function drawPlaque(g, R) {
    var p = GEO.plaque;
    rect(g, p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, PAL.BRASS1);
    hline(g, p.x0, p.x1 - 1, p.y0, PAL.BRASS2);
    vline(g, p.x0, p.y0, p.y1 - 1, PAL.BRASS2);
    hline(g, p.x0 + 1, p.x1 - 1, p.y1 - 1, PAL.ENAM1);
    // screws
    px(g, p.x0 + 2, p.y0 + 2, PAL.STEEL2); px(g, p.x1 - 3, p.y0 + 2, PAL.STEEL2);
    px(g, p.x0 + 2, p.y1 - 3, PAL.STEEL2); px(g, p.x1 - 3, p.y1 - 3, PAL.STEEL2);
    textC(g, 'PROPERTY OF', CX, p.y0 + 2, PAL.ENAM1, 1);
    // the company name, scratched out beyond reading
    var sx = p.x0 + 6, sy = p.y0 + 8;
    text(g, 'COAL & LAND CO.', sx + 26, sy, PAL.ENAM1, 1);
    rect(g, sx, sy, 22, 5, PAL.BRASS1);
    for (var i = 0; i < 26; i++) {
      var gx = sx + Math.floor(R() * 22), gy = sy + Math.floor(R() * 5);
      px(g, gx, gy, R() < 0.55 ? PAL.ENAM1 : PAL.RUST);
    }
    hline(g, sx - 1, sx + 22, sy + 2, PAL.ENAM1);
  }

  /* ── glass frame + interior shell ──────────────────────────────────── */
  function drawGlassShell(g, R) {
    var gl = GEO.glass;
    // interior darkness first; warm zones get painted over it
    rect(g, gl.x0, gl.y0, gl.x1 - gl.x0, gl.y1 - gl.y0, PAL.NIGHT1);
    // brass glazing frame
    hline(g, gl.x0 - 1, gl.x1, gl.y0 - 1, PAL.BRASS1);
    hline(g, gl.x0 - 1, gl.x1, gl.y1, PAL.BRASS1);
    vline(g, gl.x0 - 1, gl.y0 - 1, gl.y1, PAL.BRASS1);
    vline(g, gl.x1, gl.y0 - 1, gl.y1, PAL.BRASS1);
    px(g, gl.x0 - 1, gl.y0 - 1, PAL.BRASS2);
    px(g, gl.x1, gl.y0 - 1, PAL.BRASS2);
  }

  /* ── the raccoon parlor (upper interior) ───────────────────────────── */
  function drawRaccoon(g, R) {
    var cx = GEO.raccoon.cx;
    var gl = GEO.glass;
    // soft ambience, full glass width so no seams show
    dither(g, gl.x0 + 1, 69, gl.x1 - gl.x0 - 2, 47, PAL.PUR1, 0.12);
    dither(g, gl.x0 + 1, 104, gl.x1 - gl.x0 - 2, 12, PAL.LIT_D, 0.10); // spill from the strip below
    // perch rod
    hline(g, 62, 154, 114, PAL.BRASS1);
    for (var i = 66; i < 154; i += 9) px(g, i, 114, PAL.BRASS2);

    // tail hugging the head's right side, drawn first so the head overlaps
    // it — the rings say raccoon from any distance
    var tp = [[127, 77], [133, 85], [134, 94], [130, 102]];
    for (i = 0; i < tp.length; i++)
      ellipse(g, tp[i][0], tp[i][1], 6, 5, i % 2 ? PAL.MASK : PAL.RC1);

    // ears, tall on top of the head (head overlaps their bases)
    ellipse(g, 94, 68, 6, 6, PAL.RC2); ellipse(g, 122, 68, 6, 6, PAL.RC2);
    ellipse(g, 94, 69, 3, 3, PAL.MASK); ellipse(g, 122, 69, 3, 3, PAL.MASK);
    px(g, 90, 63, PAL.RC1); px(g, 126, 63, PAL.RC1);

    // head
    ellipse(g, cx, 86, 18, 14, PAL.RC1);
    dither(g, cx - 14, 74, 28, 6, PAL.RC2, 0.4);
    // fur jags at the cheeks
    for (i = 0; i < 6; i++) {
      px(g, cx - 19 + (i % 2), 82 + i * 2, PAL.RC1);
      px(g, cx + 18 + ((i + 1) % 2), 82 + i * 2, PAL.RC1);
    }
    // the mask
    ellipse(g, 97, 84, 7, 5, PAL.MASK);
    ellipse(g, 119, 84, 7, 5, PAL.MASK);
    rect(g, 97, 82, 22, 5, PAL.MASK);
    // white brows over the mask, white cheeks under it
    hline(g, 92, 101, 78, PAL.BONE_D);
    hline(g, 115, 124, 78, PAL.BONE_D);
    dither(g, 94, 90, 12, 4, PAL.BONE_D, 0.5);
    dither(g, 110, 90, 12, 4, PAL.BONE_D, 0.5);
    // muzzle, nose, mouth
    ellipse(g, cx, 94, 6, 5, PAL.BONE);
    rect(g, cx - 2, 90, 4, 3, PAL.MASK);
    px(g, cx - 1, 90, PAL.RC1);
    vline(g, cx, 93, 96, PAL.MASK);
    px(g, cx - 2, 97, PAL.MASK); px(g, cx + 2, 97, PAL.MASK);
    // (eyes are live — drawFrame paints them into GEO.eyes cells)

    // paws pressed on the glass, with grease smudges around them
    glowRing(g, 98, 107, 6, 4, 3, PAL.FOG, 0.10);
    glowRing(g, 118, 107, 6, 4, 3, PAL.FOG, 0.10);
    for (i = 0; i < 2; i++) {
      var pxx = i ? 114 : 94;
      rect(g, pxx, 106, 9, 5, PAL.RC2);
      vline(g, pxx + 2, 102, 106, PAL.RC2); vline(g, pxx + 4, 101, 106, PAL.RC2);
      vline(g, pxx + 6, 102, 106, PAL.RC2);
      px(g, pxx + 2, 101, PAL.BONE_D); px(g, pxx + 4, 100, PAL.BONE_D);
      px(g, pxx + 6, 101, PAL.BONE_D);
      vline(g, pxx + 3, 103, 106, PAL.RC3); vline(g, pxx + 5, 103, 106, PAL.RC3);
    }
  }

  /* ── field interior (static parts): walls, light strip, apron ─────── */
  function drawInterior(g, R) {
    var gl = GEO.glass, f = GEO.field;
    // back area behind the field
    rect(g, gl.x0 + 1, 118, gl.x1 - gl.x0 - 2, f.yBack - 118, PAL.ENAM1);
    // back wall, warm-lit steel (the shelf's coins get scraped against this)
    rect(g, f.backInset, 118, W - f.backInset * 2, f.yBack - 118, PAL.SHELF_D);
    dither(g, f.backInset, 118, W - f.backInset * 2, f.yBack - 118, PAL.LIT_D, 0.25);
    hline(g, f.backInset, W - f.backInset - 1, f.yBack - 1, PAL.NIGHT1);
    // the chute rail the spout slides on
    hline(g, f.backInset + 2, W - f.backInset - 3, 128, PAL.STEEL1);
    hline(g, f.backInset + 2, W - f.backInset - 3, 127, PAL.STEEL2);
    // interior light strip: five bulbs, one dead
    GEO.bulbs = [];
    for (var i = 0; i < 5; i++) {
      var bx = 52 + i * 24;
      GEO.bulbs.push({ x: bx, y: 120 });
      if (i === GEO.deadBulb) {
        rect(g, bx, 120, 14, 4, PAL.RC3);
        dither(g, bx, 120, 14, 4, PAL.NIGHT0, 0.4); // grime on the cold glass
      } else {
        rect(g, bx, 120, 14, 4, PAL.BONE);
        hline(g, bx + 1, bx + 12, 120, PAL.MOON);
        dither(g, bx - 2, 125, 18, 5, PAL.LIT, 0.35);
      }
    }
    // side walls of the field, in perspective
    for (var y = f.yBack; y <= f.yLip; y++) {
      hline(g, gl.x0 + 1, fieldL(y) - 1, y, PAL.ENAM1);
      hline(g, fieldR(y) + 1, gl.x1 - 1, y, PAL.ENAM1);
      px(g, fieldL(y), y, PAL.SHELF_D);
      px(g, fieldR(y), y, PAL.SHELF_D);
      if (y % 3) { px(g, fieldL(y) + 1, y, PAL.LIT_D); px(g, fieldR(y) - 1, y, PAL.LIT_D); }
    }

    // apron: the drop — trough center (warm, yours), gutters (cold, theirs)
    var a = GEO.apron, tr = GEO.trough;
    for (y = a.y0 + 2; y < a.y1; y++) hline(g, fieldL(y), fieldR(y), y, PAL.NIGHT0);
    dither(g, tr.x0 + 2, a.y0 + 2, tr.x1 - tr.x0 - 4, 5, PAL.LIT, 0.25);
    dither(g, fieldL(a.y0 + 4), a.y0 + 4, tr.x0 - fieldL(a.y0 + 4), a.y1 - a.y0 - 6, PAL.PUR1, 0.25);
    dither(g, tr.x1, a.y0 + 4, fieldR(a.y0 + 4) - tr.x1, a.y1 - a.y0 - 6, PAL.PUR1, 0.25);
    vline(g, tr.x0, a.y0 + 2, a.y1 - 1, PAL.STEEL1);
    vline(g, tr.x1, a.y0 + 2, a.y1 - 1, PAL.STEEL1);
    px(g, tr.x0, a.y0 + 2, PAL.STEEL2); px(g, tr.x1, a.y0 + 2, PAL.STEEL2);
  }

  /* ── coins ─────────────────────────────────────────────────────────── */
  // kind: 0 plain, 1 tarnished, 2 buffalo-head
  function coin(g, x, y, r, kind, glint) {
    var ry = Math.max(1, Math.round(r * 0.45));
    var face = kind === 2 ? PAL.BUF : kind === 1 ? PAL.TOK_T : PAL.TOK;
    ellipse(g, x, y + 1, r, ry, PAL.TOK_D);           // edge/shadow
    ellipse(g, x, y, r, ry, face);                    // face
    if (r >= 4) {
      hline(g, x - r + 2, x + r - 2, y - ry + 1, kind === 1 ? PAL.TOK : PAL.TOK_L);
      if (kind === 2) { px(g, x, y, PAL.TOK_D); px(g, x - 1, y, PAL.TOK_D); } // the buffalo, squinted at
    }
    if (glint) px(g, x - (r >> 1), y - 1, PAL.MOON);
  }

  /* ── the cargo: prize drawers, anchored at center-bottom ───────────── */
  function drawJar(g, x, y) {
    ellipse(g, x, y, 7, 2, PAL.SHELF_D);
    rect(g, x - 6, y - 14, 12, 14, PAL.JAR);
    vline(g, x - 5, y - 13, y - 2, PAL.BONE_D);
    vline(g, x + 4, y - 13, y - 2, PAL.JAR_D);
    rect(g, x - 6, y - 16, 12, 3, PAL.BRASS1);
    hline(g, x - 6, x + 5, y - 16, PAL.BRASS2);
    rect(g, x - 4, y - 10, 8, 6, PAL.BONE);
    textC(g, '13', x, y - 9, PAL.NIGHT0, 1);
    dither(g, x - 5, y - 4, 10, 3, PAL.PINK_DK, 0.3); // whatever's inside catches the neon
  }
  function drawArrowhead(g, x, y) {
    for (var i = 0; i < 7; i++)
      hline(g, x - Math.floor(i / 2), x + Math.floor(i / 2), y - 7 + i, i < 6 ? PAL.STEEL2 : PAL.STEEL1);
    px(g, x - 1, y - 5, PAL.STEEL1); px(g, x + 1, y - 3, PAL.STEEL1); // knap chips
  }
  function drawFortune(g, x, y) {
    rect(g, x - 4, y - 5, 9, 6, PAL.BONE);
    hline(g, x - 4, x + 4, y - 3, PAL.BONE_D);
    vline(g, x - 4, y - 5, y, PAL.PINK_D);
  }
  function drawEye(g, x, y, glintOff) {
    ellipse(g, x, y, 4, 2, PAL.SHELF_D);
    ellipse(g, x, y - 2, 3, 3, PAL.BONE);
    rect(g, x - 1, y - 3, 2, 2, PAL.PINK_D);
    px(g, x, y - 2, PAL.NIGHT0);
    if (!glintOff) px(g, x - 1, y - 4, PAL.MOON);
  }
  function drawPrizeBody(g, p, sx, sy, glintOff) {
    if (p.type === 'jar') drawJar(g, sx, sy + 2);
    else if (p.type === 'arrowhead') drawArrowhead(g, sx, sy + 2);
    else if (p.type === 'fortune') drawFortune(g, sx, sy + 1);
    else if (p.type === 'eye') drawEye(g, sx, sy + 1, glintOff);
  }

  /* ── the live field: surfaces, face, pile — drawn from the sim ─────── */
  function drawFieldDyn(ctx, sim, chuteX, t) {
    var f = GEO.field, y;
    var yFace = Math.round(256 - sim.faceZ() * (104 / 86));

    // shelf top: from the back wall down to the moving front edge
    for (y = f.yBack; y < yFace - LIFT; y++) hline(ctx, fieldL(y), fieldR(y), y, PAL.SHELF);
    dither(ctx, 46, f.yBack, W - 92, Math.max(0, yFace - LIFT - f.yBack), PAL.LIT_D, 0.12);
    // the face itself
    hline(ctx, fieldL(yFace - LIFT), fieldR(yFace - LIFT), yFace - LIFT, PAL.STEEL2);
    for (y = yFace - LIFT + 1; y <= yFace + 2; y++) hline(ctx, fieldL(y), fieldR(y), y, PAL.STEEL1);
    dither(ctx, fieldL(yFace), yFace - 2, fieldR(yFace) - fieldL(yFace), 4, PAL.NIGHT1, 0.3);
    for (var b = 0; b < 4; b++) px(ctx, 62 + b * 32, yFace - LIFT + 3, PAL.SHELF_D); // bolts
    // tray: from under the face down to the lip
    for (y = yFace + 3; y < 256; y++) hline(ctx, fieldL(y), fieldR(y), y, PAL.TRAY);
    dither(ctx, 40, yFace + 3, W - 80, 256 - yFace - 3, PAL.LIT_D, 0.10);
    dither(ctx, 60, yFace + 3, W - 120, 6, PAL.STEEL2, 0.15); // scrape tracks
    // the corroded token, welded to the tray; it will never move
    coin(ctx, 44, 250, 5, 1, false);
    glowRing(ctx, 44, 250, 5, 3, 2, PAL.VERD, 0.5);
    // the lip
    hline(ctx, fieldL(256), fieldR(256), 256, PAL.BRASS2);
    hline(ctx, fieldL(257), fieldR(257), 257, PAL.BRASS1);

    // bodies, back to front so the front overlaps
    var falls = [];
    var bodies = sim.coins.concat(sim.prizes).sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < bodies.length; i++) {
      var c = bodies[i];
      if (c.fall && (c.fall.state === 'out' || c.fall.state === 'chute')) { falls.push(c); continue; }
      var pr = project(c.x, c.z, c.tier);
      var sy = pr.y;
      if (c.fall && c.fall.state === 'tip') sy = pr.y - LIFT * (1 - c.fall.T); // dropping off the shelf edge
      if (c.type) drawPrizeBody(ctx, c, Math.round(pr.x), Math.round(sy), (t % 9100) > 8850);
      else coin(ctx, Math.round(pr.x), Math.round(sy), Math.max(3, Math.round(5 * pr.s)), c.kind, c.kind === 2);
    }

    // the chute spout, riding its rail
    var cs = project(chuteX, 84, 0);
    rect(ctx, Math.round(cs.x) - 4, 126, 8, 5, PAL.BRASS1);
    rect(ctx, Math.round(cs.x) - 3, 131, 6, 4, PAL.BRASS2);
    rect(ctx, Math.round(cs.x) - 2, 135, 4, 2, PAL.NIGHT0); // the mouth

    // falling bodies draw over everything on their way down
    for (i = 0; i < falls.length; i++) {
      var fc = falls[i];
      var T = Math.min(1, fc.fall.T);
      if (fc.fall.state === 'chute') {
        var target = project(fc.x, 60, 0);
        var fy = 137 + (target.y - 137) * T;
        coin(ctx, Math.round(target.x), Math.round(fy), 4, fc.kind, false);
      } else { // 'out': over the lip, into the dark
        var lx = project(fc.x, 0, 0).x;
        var fy2 = 257 + T * 19;
        if (fc.type) drawPrizeBody(ctx, fc, Math.round(lx), Math.round(fy2), true);
        else coin(ctx, Math.round(lx), Math.round(fy2), T > 0.5 ? 4 : 5, T > 0.5 ? 1 : fc.kind, false);
      }
    }
  }

  /* ── debug overlay: the true top-down machine space ────────────────── */
  function drawDebug(ctx, sim) {
    var ox = 4, oy = 132, sc = 0.4;
    rect(ctx, ox - 2, oy - 2, Math.round(150 * sc) + 4, Math.round(90 * sc) + 4, PAL.NIGHT0);
    // lip, trough lanes, wall, face
    hline(ctx, ox, ox + Math.round(150 * sc), oy + Math.round(90 * sc), PAL.BRASS2);
    hline(ctx, ox + Math.round(44 * sc), ox + Math.round(106 * sc), oy + Math.round(90 * sc) + 1, PAL.PINK);
    hline(ctx, ox, ox + Math.round(150 * sc), oy + Math.round((90 - 86) * sc), PAL.STEEL2);
    var fy = oy + Math.round((90 - sim.faceZ()) * sc);
    hline(ctx, ox, ox + Math.round(150 * sc), fy, PAL.MOON);
    var all = sim.coins.concat(sim.prizes);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.fall && c.fall.state === 'out') continue;
      px(ctx, ox + Math.round(c.x * sc), oy + Math.round((90 - c.z) * sc),
        c.type ? PAL.PINK : c.tier === 1 ? PAL.BONE : PAL.LIT);
    }
  }

  /* ── glass reflections (the room behind the player) ────────────────── */
  function drawReflections(g, R) {
    var gl = GEO.glass;
    // two long diagonal sheens
    for (var i = 0; i < 90; i++) {
      var x = gl.x0 + 18 + i, y = gl.y1 - 20 - Math.floor(i * 1.6);
      if (y > gl.y0 + 4 && x < gl.x1 - 4 && (i + y) % 3 === 0) px(g, x, y, PAL.FOG);
      x += 52; y += 26;
      if (y > gl.y0 + 4 && y < gl.y1 - 4 && x < gl.x1 - 4 && (i + y) % 4 === 0) px(g, x, y, PAL.PUR2);
    }
    // the window behind the player, faint in the upper right — moonlit fog
    var wx = 156, wy = 72;
    dither(g, wx, wy, 22, 18, PAL.MOON, 0.06);
    rect(g, wx + 10, wy, 2, 18, PAL.NIGHT1);
    rect(g, wx, wy + 8, 22, 2, PAL.NIGHT1);
  }

  /* ── HUD band: pocket + tray, painted tin ──────────────────────────── */
  function drawHudPanel(g, R) {
    var h = GEO.hud;
    rect(g, h.x0, h.y0, h.x1 - h.x0, h.y1 - h.y0, PAL.ENAM1);
    hline(g, h.x0, h.x1 - 1, h.y0, PAL.ENAM3);
    hline(g, h.x0, h.x1 - 1, h.y1 - 1, PAL.NIGHT0);
    vline(g, CX, h.y0 + 3, h.y1 - 4, PAL.ENAM3);
    text(g, 'TOKENS', 36, h.y0 + 4, PAL.BONE_D, 1);
    text(g, 'TRAY', 120, h.y0 + 4, PAL.BONE_D, 1);
    coin(g, 100, h.y0 + 17, 4, 0, true);
    coin(g, 180, h.y0 + 17, 4, 0, false);
    // (counts are live; drawFrame owns the number cells)
  }

  /* ── coin door + payout dish + base ────────────────────────────────── */
  function drawFrontHardware(g, R) {
    var d = GEO.door;
    rect(g, d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0, PAL.STEEL1);
    hline(g, d.x0, d.x1 - 1, d.y0, PAL.STEEL2);
    vline(g, d.x0, d.y0, d.y1 - 1, PAL.STEEL2);
    px(g, d.x0 + 2, d.y0 + 2, PAL.STEEL2); px(g, d.x1 - 3, d.y0 + 2, PAL.STEEL2);
    px(g, d.x0 + 2, d.y1 - 3, PAL.STEEL2); px(g, d.x1 - 3, d.y1 - 3, PAL.STEEL2);
    // token slot, brass-lipped
    rect(g, d.x0 + 11, d.y0 + 7, 8, 12, PAL.NIGHT0);
    vline(g, d.x0 + 10, d.y0 + 7, d.y0 + 18, PAL.BRASS1);
    vline(g, d.x0 + 19, d.y0 + 7, d.y0 + 18, PAL.BRASS1);
    textC(g, 'ONE', (d.x0 + d.x1) / 2, d.y1 - 8, PAL.BONE_D, 1);

    // payout dish, brass, worn bright where hands go
    var s = GEO.dish;
    rect(g, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0, PAL.BRASS1);
    hline(g, s.x0, s.x1 - 1, s.y0, PAL.BRASS2);
    ellipse(g, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2 + 1, (s.x1 - s.x0) / 2 - 4, (s.y1 - s.y0) / 2 - 5, PAL.NIGHT0);
    ellipse(g, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2 + 2, (s.x1 - s.x0) / 2 - 6, (s.y1 - s.y0) / 2 - 7, PAL.NIGHT1);
    hline(g, s.x0 + 8, s.x1 - 9, s.y1 - 3, PAL.BRASS2);

    // base: waterlogged, corroding
    var c = GEO.cab;
    rect(g, c.x0 + 2, 354, c.x1 - c.x0 - 4, 12, PAL.ENAM1);
    dither(g, c.x0 + 2, 356, c.x1 - c.x0 - 4, 10, PAL.NIGHT0, 0.3);
    dither(g, c.x0 + 2, 360, 40, 6, PAL.VERD, 0.35);
    dither(g, c.x1 - 44, 359, 42, 7, PAL.VERD, 0.28);
    dither(g, c.x0 + 30, 361, 60, 5, PAL.RUST, 0.2);
  }

  /* ── build & frame ─────────────────────────────────────────────────── */
  var staticLayer = null, overlayLayer = null;
  function buildStatic() {
    staticLayer = document.createElement('canvas');
    staticLayer.width = W; staticLayer.height = H;
    var g = staticLayer.getContext('2d');
    var R = window.Arcade.rng(1913); // the year on the plaque, if you could read it
    drawRoom(g, R);
    drawCabinet(g, R);
    drawMarquee(g, R);
    drawPlaque(g, R);
    drawGlassShell(g, R);
    drawRaccoon(g, R);
    drawInterior(g, R);
    drawHudPanel(g, R);
    drawFrontHardware(g, R);
    // the glass sits in front of the pile, so its reflections live on a
    // transparent overlay blitted after the dynamic field
    overlayLayer = document.createElement('canvas');
    overlayLayer.width = W; overlayLayer.height = H;
    drawReflections(overlayLayer.getContext('2d'), R);
  }

  // deterministic flicker: mostly on, sputters in bursts
  function flickerAt(t, rate, seed) {
    var s = Math.sin(t * 0.00113 * rate + seed) + Math.sin(t * 0.0071 * rate + seed * 3);
    if (s > 1.55) return 0;       // off
    if (s > 1.30) return 1;       // dim
    return 2;                     // on
  }

  function drawFrame(ctx, t, opts) {
    opts = opts || {};
    ctx.drawImage(staticLayer, 0, 0);

    // the pile, live from the sim
    if (opts.sim) {
      drawFieldDyn(ctx, opts.sim, opts.chuteX == null ? 75 : opts.chuteX, t);
      ctx.drawImage(overlayLayer, 0, 0);
      if (opts.debug) drawDebug(ctx, opts.sim);
    }

    // the marquee's second R, dying
    var fl = GEO.flickerLetter;
    if (fl) {
      var st = flickerAt(t, 1, 7);
      rect(ctx, fl.cellX, fl.cellY, fl.cellW, fl.cellH, PAL.NIGHT1);
      if (st === 2) {
        dither(ctx, fl.cellX, fl.cellY, fl.cellW, fl.cellH, PAL.PINK_DK, 0.4);
        text(ctx, fl.ch, fl.x, fl.y, PAL.PINK, 2);
      } else if (st === 1) {
        text(ctx, fl.ch, fl.x, fl.y, PAL.PINK_D, 2);
      } else {
        text(ctx, fl.ch, fl.x, fl.y, PAL.PINK_DK, 2);
      }
    }

    // animatronic eyes: amber, unblinking except when they aren't
    var blink = (t % 4700) < 110 || (t % 4700) > 4550 && (t % 4700) < 4620;
    for (var i = 0; i < GEO.eyes.length; i++) {
      var e = GEO.eyes[i];
      if (blink) {
        rect(ctx, e.x, e.y, 4, 3, PAL.MASK);
        hline(ctx, e.x, e.x + 3, e.y + 1, PAL.RC3);
      } else {
        rect(ctx, e.x, e.y, 4, 3, PAL.LIT);
        px(ctx, e.x + 1, e.y + 1, PAL.LIT_D);
        px(ctx, e.x, e.y, PAL.MOON);
      }
    }

    // the bulb next to the dead one buzzes sometimes
    var b = GEO.bulbs[GEO.deadBulb - 1];
    if (b && flickerAt(t, 0.6, 21) < 2) {
      rect(ctx, b.x, b.y, 14, 4, PAL.LIT_D);
    }

    // fog crossing the reflected window
    var drift = Math.floor(t * 0.004) % 40;
    dither(ctx, 156 + (drift > 20 ? 40 - drift : drift) - 6, 74, 10, 12, PAL.MOON, 0.05);

    // HUD counts
    var h = GEO.hud;
    rect(ctx, 36, h.y0 + 12, 58, 10, PAL.ENAM1);
    rect(ctx, 120, h.y0 + 12, 52, 10, PAL.ENAM1);
    text(ctx, String(opts.tokens == null ? 0 : opts.tokens), 36, h.y0 + 12, PAL.BONE, 2);
    text(ctx, String(opts.tray == null ? 0 : opts.tray), 120, h.y0 + 12, PAL.BONE, 2);
  }

  return {
    W: W, H: H, PAL: PAL,
    get GEO() { return GEO; },
    fieldL: fieldL, fieldR: fieldR,
    project: project,
    coin: coin,
    buildStatic: buildStatic,
    drawFrame: drawFrame
  };
})();
