/* MOTHER LODE — art kit
 *
 * The machine-local palette and the small drawing helpers every art file
 * shares: seeded hashes, thick lines, an extended 3×5 font (the house
 * font plus the punctuation a museum card needs), and canvas creation.
 * Loaded before pachinko-art-*.js and pachinko-render.js; everything
 * hangs off window.PachinkoArt.
 *
 * Deterministic: no Math.random, no Date. Everything seeded.
 */
(function (root) {
  'use strict';
  var S = root.ArcadeSprites || (typeof require === 'function' && require('../arcade/arcade-sprites.js'));
  var AP = root.ArcadePalette || (typeof require === 'function' && require('../arcade/arcade-palette.js'));

  var A = root.PachinkoArt = root.PachinkoArt || {};
  A.S = S; A.AP = AP;

  /* ── palette ─────────────────────────────────────────────────────────
   * The night (shared) + the machine's own: the case (bottle-green
   * enamel on steel, brass), the glass (nicotine), the painted backdrop,
   * the strata, coal, timber, steel, lamp amber, the figurines' paint. */
  A.PAL = {
    NIGHT0: AP.NIGHT0, NIGHT1: AP.NIGHT1, NIGHT2: AP.NIGHT2,
    PUR1: AP.PUR1, PUR2: AP.PUR2, FOG: AP.FOG, MOON: AP.MOON,
    BONE: AP.BONE, BONE_D: AP.BONE_D,
    PINK: AP.PINK, PINK_D: AP.PINK_D, PINK_DK: AP.PINK_DK,
    // the case: institutional bottle-green enamel over steel, chipped
    CASE0: '#0b1310', CASE1: '#12201b', CASE2: '#1b2f27', CASE3: '#284338', CASE4: '#3a5a4b', CASE5: '#557a66',
    CHIP: '#5e5a52',
    // brass (plates, rail, trim) and its tarnish
    BRASS0: '#3b2c14', BRASS1: '#6e5424', BRASS2: '#a3823c', BRASS3: '#d1b064', BRASS4: '#f1dc9a', VERD: '#4f7d68',
    // paper: the legend card, labels (nicotine-aged)
    PAPER: '#d9cca3', PAPER_D: '#b8a77a', PAPER_DD: '#8e7d56', INK: '#231d1a', INK_L: '#4a3f36', TAPE: '#c9b47a',
    // the marquee
    MQ_BG0: '#150c24', MQ_BG1: '#231438', MQ_RAY: '#3b1f4f', MQ_RAY2: '#4f2a5a',
    GOLD0: '#5a2a0c', GOLD1: '#9a4a12', GOLD2: '#d4781e', GOLD3: '#f2a93a', GOLD4: '#ffd76a', GOLD5: '#fff3c2',
    RED0: '#2c0a12', RED1: '#6e1422', RED2: '#a82834',
    BULB: '#ffe9a8', BULB_D: '#6b5a3a', BULB_DEAD: '#2a2620',
    // painted backdrop (too pretty)
    SKY0: '#141238', SKY1: '#1f1a52', SKY2: '#2e2468', SKY3: '#4a2f78', SKY4: '#7a3f7c', SKY5: '#b85a6e', SKY6: '#e89a6a',
    RIDGE0: '#0e0c1c', RIDGE1: '#1a1630', RIDGE2: '#28224a', RIDGE3: '#3b3162', RIDGE4: '#534580',
    MOONP: '#f6e7b0', MOONP_D: '#d8c07a', STAR: '#fff4d0',
    // strata
    SOIL0: '#2e1c12', SOIL1: '#452c1a', SOIL2: '#5e3e22', ROOT: '#7a5a38',
    SAND0: '#6a5232', SAND1: '#8a6c40', SAND2: '#a8874e', SAND3: '#c4a468',
    SHALE0: '#22283c', SHALE1: '#2e3752', SHALE2: '#3e4a6a', SHALE3: '#56648a',
    LIME0: '#50545e', LIME1: '#6c727e', LIME2: '#8c929c', LIME3: '#acb2b8',
    COAL0: '#0a090c', COAL1: '#131218', COAL2: '#1d1b24', COAL3: '#2b2934', GLINT: '#dfe6ff', GLINT_D: '#8a93b8',
    CLAY0: '#3a3a30', CLAY1: '#525440', CLAY2: '#6a6e52',
    DEEP0: '#140e1a', DEEP1: '#211828', DEEP2: '#302238', DEEP3: '#42304c',
    QUARTZ: '#e6e0cc', QUARTZ_D: '#a8a290', VEIN0: '#6e4c14', VEIN1: '#b8862a', VEIN2: '#e8b64a', VEIN3: '#fff0a0',
    // cut faces, voids
    VOID0: '#060508', VOID1: '#0e0b12', VOID2: '#17121c',
    // timber
    TIM0: '#241810', TIM1: '#3a2818', TIM2: '#563c22', TIM3: '#74532f', TIM4: '#94703f', END: '#b08a52',
    // steel / iron / rust
    IRON0: '#16161c', IRON1: '#2c2c36', IRON2: '#4a4a58', IRON3: '#72728a', IRON4: '#a4a4bc', RUST: '#7a3a1c', RUST2: '#a4542a',
    // lamp light
    LAMP: '#ffc46a', FLAME0: '#ff8a2a', FLAME1: '#ffd060', FLAME2: '#fff6d0',
    // the glass
    NIC: '#c8a040', SMEAR: '#e8e0c8',
    // figurine paint
    FACE: '#e8b894', FACE_D: '#b87e62', CHEEK: '#e0707a', WOOD_BARE: '#d8bc8a', WOOD_BARE_D: '#a88a5a',
    COAT_B: '#2c3e6a', COAT_B2: '#40588e', COAT_R: '#6a1e28', COAT_R2: '#8e3038', COAT_G: '#34482c', COAT_G2: '#4a6440',
    COAT_K: '#1c1a22', COAT_K2: '#34303e', COAT_O: '#8a5a1c', COAT_O2: '#b07a2a',
    APRON: '#5a3a22', APRON2: '#7a5232', BEARD: '#e6e2d8', BEARD_D: '#aaa498', BOOT: '#141016', CAP: '#22202a', CAP2: '#3c3846',
    MOTH: '#d8ccb0', MOTH_D: '#8a7e68', RAT: '#c89a9a',
    FISH: '#e0283c', FISH2: '#ff5a64', FISH_D: '#8a1224'
  };

  /* ── deterministic randomness ───────────────────────────────────────── */
  A.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  // stateless hash → [0,1)
  A.hash01 = function (seed, i, j) {
    var h = (seed | 0) ^ Math.imul((i | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((j | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h = Math.imul(h ^ h >>> 16, 0x85ebca6b); h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  A.makeCanvas = function (w, h) {
    if (typeof document !== 'undefined') {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    return new OffscreenCanvas(w, h);
  };

  /* ── pixel helpers beyond the house set ─────────────────────────────── */
  var px = S.px, rect = S.rect;
  // 1-px Bresenham line
  A.line = function (g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = c;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var n = 0; n < 2000; n++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  // thick line: stamps a w×w square along a Bresenham path
  A.thick = function (g, x0, y0, x1, y1, w, c) {
    g.fillStyle = c;
    var len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), o = (w - 1) / 2;
    for (var i = 0; i <= len; i++) {
      var t = len ? i / len : 0;
      g.fillRect(Math.round(x0 + (x1 - x0) * t - o), Math.round(y0 + (y1 - y0) * t - o), w, w);
    }
  };
  // filled disc of radius r at a half-pixel-aware centre
  A.disc = function (g, cx, cy, r, c) {
    g.fillStyle = c;
    for (var y = Math.floor(-r); y <= Math.ceil(r); y++)
      for (var x = Math.floor(-r); x <= Math.ceil(r); x++)
        if ((x + 0.5 - (cx % 1)) * (x + 0.5 - (cx % 1)) + (y + 0.5 - (cy % 1)) * (y + 0.5 - (cy % 1)) <= r * r)
          g.fillRect(Math.floor(cx) + x, Math.floor(cy) + y, 1, 1);
  };
  // Bayer test at absolute canvas coordinates
  var BAYER = S.BAYER;
  A.bayer = function (x, y) { return BAYER[((y & 3) * 4) + (x & 3)] / 16; };
  // a pixel only if the Bayer threshold at (x,y) is under d
  A.dpx = function (g, x, y, c, d) { if (A.bayer(x | 0, y | 0) < d) px(g, x, y, c); };

  /* ── type: the house 3×5 plus a museum's punctuation ────────────────── */
  var EXTRA = {
    ':': [0, 2, 0, 2, 0], ',': [0, 0, 0, 2, 4], '/': [1, 1, 2, 4, 4], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4],
    '=': [0, 7, 0, 7, 0], '#': [5, 7, 5, 7, 5], '+': [0, 2, 7, 2, 0], '"': [5, 5, 0, 0, 0], ';': [0, 2, 0, 2, 4],
    '*': [0, 5, 2, 5, 0], '[': [3, 2, 2, 2, 3], ']': [6, 2, 2, 2, 6], '%': [5, 1, 2, 4, 5], '$': [3, 6, 2, 3, 6],
    '°': [2, 5, 2, 0, 0], '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4]
  };
  var FONT = {};
  for (var k in S.FONT) FONT[k] = S.FONT[k];
  for (k in EXTRA) FONT[k] = EXTRA[k];
  A.FONT = FONT;
  // typewriter text: fixed pitch 4 px, `ink(i, col, row)` may return a
  // per-pixel colour or null (worn ribbon, over-struck keys)
  A.text = function (g, str, x, y, c, scale, ink) {
    scale = scale || 1; str = String(str).toUpperCase();
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var gl = FONT[str[i]] || FONT[' '];
      for (var row = 0; row < 5; row++)
        for (var col = 0; col < 3; col++)
          if (gl[row] & (4 >> col)) {
            var cc = ink ? ink(i, col, row) : c;
            if (cc) { g.fillStyle = cc; g.fillRect(cx + col * scale, y + row * scale, scale, scale); }
          }
      cx += 4 * scale;
    }
  };
  A.textW = function (str, scale) { return (String(str).length * 4 - 1) * (scale || 1); };
  A.textC = function (g, str, cx, y, c, scale, ink) { A.text(g, str, Math.round(cx - A.textW(str, scale) / 2), y, c, scale, ink); };

  // parse '#rrggbb' → [r,g,b]
  A.rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  A.mix = function (a, b, t) {
    var p = A.rgb(a), q = A.rgb(b);
    var r = function (i) { return Math.round(p[i] + (q[i] - p[i]) * t); };
    return '#' + ((1 << 24) + (r(0) << 16) + (r(1) << 8) + r(2)).toString(16).slice(1);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
