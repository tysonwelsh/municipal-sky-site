/* Arcade sprites — the shared pixel toolbox.
 *
 * Low-level pixel helpers and the house 3×5 font, used by every machine's
 * procedural renderer. Universe actors (fauna heads, moths, fog drift)
 * accumulate here as machines prove them shared; today it's the drawing
 * primitives and type, which the coin pusher needs and skee ball already
 * duplicates (it de-duplicates at its retrofit).
 *
 * Every function takes a 2d context `g` first. No state, no palette —
 * callers pass colors.
 */
window.ArcadeSprites = (function () {
  'use strict';

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
    '¢': [2, 3, 6, 3, 2], "'": [2, 2, 0, 0, 0], ' ': [0, 0, 0, 0, 0],
    '&': [2, 5, 2, 5, 3], '_': [0, 0, 0, 0, 7], '?': [6, 1, 2, 0, 2]
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
  }
  function textW(str, scale) { return (str.length * 4 - 1) * (scale || 1); }
  function textC(g, str, cx, y, c, scale) { // centered
    text(g, str, Math.round(cx - textW(str, scale) / 2), y, c, scale);
  }

  return {
    px: px, rect: rect, hline: hline, vline: vline,
    ellipse: ellipse, dither: dither, glowRing: glowRing,
    FONT: FONT, text: text, textW: textW, textC: textC
  };
})();
