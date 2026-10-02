// ============================================================================
// KOLOB — kolob-viz-atlas.js: the glyph atlas — the page's ink, the clefs'
// outlines, the heads and the hymnal's signs
//
// One of the page's six files (kolob-viz.js raises KolobViz over them; THE
// SIX FILES there, and _viz.php's list). Everything the staff strikes is
// drawn here as outlines (no font) and rendered once a size, at the device's
// resolution, into one atlas of sprites: the four shapes and the band's round
// head, open and filled, the tune's heavier one, a spoken syllable's cross;
// the rests, the fermata, the three accidentals, the turn and Johnston's 7;
// the two clefs as baked outlines; the one green ink.
// Lends C_INK, rgba, clamp, CLEF_TREBLE, CLEF_BASS, shapeKey, anchorOf, HEAVY,
// headSprite, GLYPHS and drawGlyph (the LENT block at the foot); reads the
// device's pixel ratio, VS.dpr, from kolob-viz.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  // The page's shared state. Each of the page's files lends what the others
  // need onto VS (the LENT block at its foot); a name written VS.x belongs to
  // another of them; a bare name is this file's own or borrowed below.
  var VS = window.KOLOB._viz = window.KOLOB._viz || {};

  // (the other files' state, read through VS: VS.dpr)

  // ---- ink ----------------------------------------------------------------------
  // One ink (the owner): hymnbook green, from the moment a note sounds.
  // No gilt strike, no cooling, no glow; only the drying fades it.
  var C_INK = [30, 77, 59];
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : +(+a).toFixed(3)) + ")"; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  // The two clefs, baked as self-contained outlines (traced from a serif music
  // glyph) so they render identically for every visitor — no font dependency.
  // Coordinates are font units (y-up, 1000 upm).
  var CLEF_TREBLE = { bbox: [120, -291, 542, 900], d: "M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z" };
  var CLEF_BASS   = { bbox: [75, 166, 607, 757],   d: "M564 704Q582 704 594.5 691.0Q607 678 607.0 661.0Q607 644 593.0 631.0Q579 618 563 618Q521 618 521 663Q521 681 534.0 692.5Q547 704 564 704ZM607 469Q607 450 594.0 437.0Q581 424 564 424Q521 424 521 469Q521 485 533.5 498.0Q546 511 564.0 511.0Q582 511 594.5 497.0Q607 483 607 469ZM285 757Q366 757 421.0 701.5Q476 646 476 569Q476 531 465.5 495.0Q455 459 432.0 426.5Q409 394 386.0 367.0Q363 340 326.0 313.0Q289 286 264.0 267.5Q239 249 196.5 226.0Q154 203 135.5 193.5Q117 184 80 166L75 182Q76 183 102.0 200.0Q128 217 144.0 227.5Q160 238 191.5 263.0Q223 288 244.0 309.5Q265 331 291.5 363.5Q318 396 334.0 427.0Q350 458 361.5 498.0Q373 538 373 578Q373 735 262 735Q225 735 199.0 725.5Q173 716 161.5 702.0Q150 688 145.0 677.5Q140 667 140 659Q140 644 160 644Q168 644 179.0 647.5Q190 651 194 651Q221 651 239.0 634.0Q257 617 257 592Q257 563 235.0 544.0Q213 525 183 525Q144 525 119.0 548.0Q94 571 94 607Q94 673 150.5 715.0Q207 757 285 757Z" };

  // ---- the glyph atlas ----------------------------------------------------------
  // Noteheads in staff spaces (y down): polygons for fa/la/mi, ellipses for sol
  // and the band's round notes. The fa's upright edge is the stem's side.
  var SH = {
    fa_u: { poly: [[-0.64, 0.45], [0.64, 0.45], [0.64, -0.47]] },
    fa_d: { poly: [[-0.64, -0.47], [-0.64, 0.45], [0.64, 0.45]] },
    la: { poly: [[-0.55, -0.42], [0.55, -0.42], [0.55, 0.42], [-0.55, 0.42]] },
    mi: { poly: [[0, -0.54], [0.66, 0], [0, 0.54], [-0.66, 0]] },
    sol: { ell: [0.60, 0.43, -0.26] },
    round: { ell: [0.59, 0.42, -0.36] },
    // a spoken syllable's cross: one filled mark, struck once —
    // speech's head, as music has long written a spoken syllable
    x: { poly: [[0, -0.12], [0.36, -0.48], [0.48, -0.36], [0.12, 0], [0.48, 0.36], [0.36, 0.48],
                [0, 0.12], [-0.36, 0.48], [-0.48, 0.36], [-0.12, 0], [-0.48, -0.36], [-0.36, -0.48]] }
  };
  // stem attach points (the head's own edge on the stem side), in sp
  var ANCH = {
    fa_u: { u: [0.64, 0.45] }, fa_d: { d: [-0.64, -0.47] },
    la: { u: [0.55, 0.2], d: [-0.55, -0.2] },
    mi: { u: [0.66, 0.02], d: [-0.66, -0.02] },
    sol: { u: [0.58, -0.08], d: [-0.58, 0.08] },
    round: { u: [0.57, -0.1], d: [-0.57, 0.1] },
    x: { u: [0.36, -0.36], d: [-0.36, 0.36] }
  };
  function shapeKey(shape, dir) { return shape === "fa" ? (dir < 0 ? "fa_d" : "fa_u") : shape; }
  function anchorOf(k, dir) { var a = ANCH[k]; return (dir < 0 ? a.d : a.u) || a.u || a.d; }
  // broad-nib contrast: an edge is thick when it runs across the nib (held at 25°)
  var NIB = 25 * Math.PI / 180;
  function insetPoly(pts, tMin, tMax) {
    var n = pts.length, area = 0, i;
    for (i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    var sg = area > 0 ? 1 : -1, lines = [];
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      var ux = dx / L, uy = dy / L, nx = -sg * uy, ny = sg * ux;
      var av = Math.atan2(-dy, dx), k = Math.pow(Math.abs(Math.sin(av - NIB)), 2);
      var d = tMin + (tMax - tMin) * k;
      lines.push({ px: a[0] + nx * d, py: a[1] + ny * d, rx: ux, ry: uy });
    }
    var out = [];
    for (i = 0; i < n; i++) {
      var l1 = lines[(i + n - 1) % n], l2 = lines[i];
      var cr = l1.rx * l2.ry - l1.ry * l2.rx;
      var t = ((l2.px - l1.px) * l2.ry - (l2.py - l1.py) * l2.rx) / cr;
      out.push([l1.px + l1.rx * t, l1.py + l1.ry * t]);
    }
    return out;
  }
  function polyTo(p, pts, s) { p.moveTo(pts[0][0] * s, pts[0][1] * s); for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0] * s, pts[i][1] * s); p.closePath(); }
  // (heavy: the tune's head — a little larger, its open heads
  // cut with a broader nib, so the melody reads out of a closed score)
  var HEAVY = 1.1;
  function headPaths(k, s, open, heavy) {
    var sh = SH[k], full = new Path2D();
    if (heavy) s *= HEAVY;
    if (sh.poly) {
      polyTo(full, sh.poly, s);
      if (open) polyTo(full, insetPoly(sh.poly, heavy ? 0.12 : 0.075, heavy ? 0.3 : 0.21), s);
    } else {
      var e = sh.ell;
      full.ellipse(0, 0, e[0] * s, e[1] * s, e[2], 0, Math.PI * 2);
      if (open) full.ellipse(0, 0, e[0] * s * (heavy ? 0.54 : 0.66), e[1] * s * (heavy ? 0.36 : 0.5), e[2] - 0.5, 0, Math.PI * 2);
    }
    return full;
  }
  var sprites = new Map();
  function headSprite(k, open, px, rgb, heavy) {
    var key = k + "|" + (open ? 1 : 0) + "|" + px.toFixed(2) + "|" + rgb.join(",") + "|" + VS.dpr + (heavy ? "|h" : "");
    var sp = sprites.get(key);
    if (sp) return sp;
    if (sprites.size > 1500) sprites.clear();
    var s = px * VS.dpr, size = Math.ceil(s * 2.0 / 2) * 2 + 8;
    var cv = document.createElement("canvas"); cv.width = cv.height = size;
    var c = cv.getContext("2d"), o = size / 2;
    c.translate(o, o);
    var full = headPaths(k, s, open, heavy);
    c.fillStyle = rgba(rgb);
    c.fill(full, "evenodd");                       // one clean strike: no ink spread, no second edge (the owner's rule)
    if (heavy) {                                   // the heavier head's rim: the outline struck once more
      c.strokeStyle = rgba(rgb); c.lineWidth = Math.max(0.6 * VS.dpr, 0.07 * s); c.lineJoin = "round";
      var rim = new Path2D();
      if (SH[k].poly) polyTo(rim, SH[k].poly, s * HEAVY);
      else rim.ellipse(0, 0, SH[k].ell[0] * s * HEAVY, SH[k].ell[1] * s * HEAVY, SH[k].ell[2], 0, Math.PI * 2);
      c.stroke(rim);
    }
    sp = { cv: cv, o: o };
    sprites.set(key, sp);
    return sp;
  }
  // ---- the hymnal's other signs — rests, the fermata, the three
  // accidentals, the turn and Johnston's 7 — drawn as outlines (no font),
  // each rendered once per size into the same atlas. Units are staff spaces,
  // y down; box is [x0, y0, x1, y1] about the sign's anchor.
  var GLYPHS = {
    // the whole rest hangs from its line; the half sits on its line
    rest1: { box: [-0.62, -0.1, 0.62, 0.62], draw: function (c) { c.fillRect(-0.58, 0, 1.16, 0.52); } },
    rest2: { box: [-0.62, -0.62, 0.62, 0.1], draw: function (c) { c.fillRect(-0.58, -0.52, 1.16, 0.52); } },
    rest4: { box: [-0.5, -1.55, 0.65, 1.55], draw: function (c) {             // (the mockup's crotchet rest, on the middle line)
      c.beginPath();
      c.moveTo(-0.12, -1.48); c.lineTo(0.5, -0.74);
      c.bezierCurveTo(0.28, -0.5, 0.2, -0.3, 0.2, -0.1);
      c.bezierCurveTo(0.2, 0.12, 0.34, 0.3, 0.56, 0.52);
      c.lineTo(0.5, 0.58);
      c.bezierCurveTo(0.22, 0.46, -0.04, 0.5, -0.04, 0.76);
      c.bezierCurveTo(-0.04, 0.98, 0.08, 1.22, 0.24, 1.42);
      c.lineTo(0.18, 1.48);
      c.bezierCurveTo(-0.14, 1.22, -0.38, 0.96, -0.38, 0.7);
      c.bezierCurveTo(-0.38, 0.44, -0.12, 0.34, 0.16, 0.38);
      c.lineTo(-0.4, -0.3);
      c.bezierCurveTo(-0.16, -0.52, -0.02, -0.74, -0.02, -0.96);
      c.bezierCurveTo(-0.02, -1.16, -0.1, -1.32, -0.16, -1.42);
      c.closePath(); c.fill();
    } },
    rest8: { box: [-0.5, -0.75, 0.55, 0.85], draw: function (c) {             // a flag on a slant, its knob
      c.beginPath(); c.arc(-0.2, -0.42, 0.21, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.moveTo(-0.3, -0.26); c.quadraticCurveTo(0.08, -0.12, 0.38, -0.56);
      c.lineTo(0.46, -0.52); c.lineTo(0.06, 0.78); c.lineTo(-0.06, 0.78); c.lineTo(0.28, -0.3);
      c.quadraticCurveTo(0.02, -0.14, -0.3, -0.2); c.closePath(); c.fill();
    } },
    rest16: { box: [-0.75, -0.75, 0.55, 1.45], draw: function (c) {
      c.beginPath(); c.arc(-0.2, -0.42, 0.21, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-0.42, 0.34, 0.21, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.moveTo(-0.3, -0.26); c.quadraticCurveTo(0.08, -0.12, 0.38, -0.56);
      c.lineTo(0.46, -0.52); c.lineTo(-0.14, 1.38); c.lineTo(-0.26, 1.38); c.lineTo(0.28, -0.3);
      c.quadraticCurveTo(0.02, -0.14, -0.3, -0.2); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(-0.52, 0.5); c.quadraticCurveTo(-0.14, 0.64, 0.14, 0.24);
      c.lineTo(0.1, 0.4); c.quadraticCurveTo(-0.18, 0.66, -0.52, 0.56); c.closePath(); c.fill();
    } },
    // the fermata: a bow and its dot; the anchor is the bow's open side
    fermU: { box: [-1.05, -1.1, 1.05, 0.12], draw: function (c) {
      c.beginPath();
      c.ellipse(0, 0, 0.98, 0.98, 0, Math.PI, 2 * Math.PI, false);
      c.ellipse(0, -0.02, 0.86, 0.76, 0, 2 * Math.PI, Math.PI, true);
      c.closePath(); c.fill();
      c.beginPath(); c.arc(0, -0.24, 0.17, 0, Math.PI * 2); c.fill();
    } },
    fermD: { box: [-1.05, -0.12, 1.05, 1.1], draw: function (c) {
      c.beginPath();
      c.ellipse(0, 0, 0.98, 0.98, 0, Math.PI, 2 * Math.PI, true);
      c.ellipse(0, 0.02, 0.86, 0.76, 0, 2 * Math.PI, Math.PI, false);
      c.closePath(); c.fill();
      c.beginPath(); c.arc(0, 0.24, 0.17, 0, Math.PI * 2); c.fill();
    } },
    // the accidentals, centred on the head's line or space
    sharp: { box: [-0.55, -1.4, 0.55, 1.4], draw: function (c) {
      var w = 0.11;
      c.fillRect(-0.22 - w / 2, -1.2, w, 2.5); c.fillRect(0.22 - w / 2, -1.32, w, 2.5);
      [-0.36, 0.5].forEach(function (dy) {
        c.beginPath();
        c.moveTo(-0.5, dy + 0.14); c.lineTo(0.5, dy - 0.14); c.lineTo(0.5, dy - 0.48); c.lineTo(-0.5, dy - 0.2);
        c.closePath(); c.fill();
      });
    } },
    flat: { box: [-0.45, -1.75, 0.55, 0.6], draw: function (c) {
      c.fillRect(-0.4, -1.7, 0.11, 2.22);
      c.beginPath();
      c.moveTo(-0.3, 0.52); c.bezierCurveTo(0.2, 0.2, 0.62, -0.1, 0.46, -0.44);
      c.bezierCurveTo(0.34, -0.72, -0.02, -0.66, -0.3, -0.34);
      c.lineTo(-0.3, -0.16); c.bezierCurveTo(-0.08, -0.46, 0.2, -0.5, 0.26, -0.3);
      c.bezierCurveTo(0.34, -0.06, 0.02, 0.24, -0.3, 0.36);
      c.closePath(); c.fill();
    } },
    natural: { box: [-0.4, -1.4, 0.4, 1.4], draw: function (c) {
      var w = 0.11;
      c.fillRect(-0.3, -1.32, w, 2.0); c.fillRect(0.3 - w, -0.68, w, 2.0);
      [-0.3, 0.42].forEach(function (dy) {
        c.beginPath();
        c.moveTo(-0.3, dy + 0.1); c.lineTo(0.3, dy - 0.08); c.lineTo(0.3, dy - 0.36); c.lineTo(-0.3, dy - 0.18);
        c.closePath(); c.fill();
      });
    } },
    // the turn: a line lying on its side, swelling at its middle
    turn: { box: [-0.95, -0.55, 0.95, 0.55], draw: function (c) {
      c.beginPath();
      c.moveTo(-0.62, 0.3);
      c.bezierCurveTo(-1.02, 0.12, -0.84, -0.46, -0.4, -0.36);
      c.bezierCurveTo(-0.12, -0.3, 0.02, -0.06, 0.12, 0.12);
      c.bezierCurveTo(0.24, 0.32, 0.44, 0.36, 0.56, 0.2);
      c.bezierCurveTo(0.66, 0.06, 0.6, -0.12, 0.5, -0.2);
      c.lineTo(0.62, -0.3);
      c.bezierCurveTo(1.02, -0.12, 0.84, 0.46, 0.4, 0.36);
      c.bezierCurveTo(0.12, 0.3, -0.02, 0.06, -0.12, -0.12);
      c.bezierCurveTo(-0.24, -0.32, -0.44, -0.36, -0.56, -0.2);
      c.bezierCurveTo(-0.66, -0.06, -0.6, 0.12, -0.5, 0.2);
      c.closePath(); c.fill();
    } },
    // Johnston's septimal 7, drawn (a bar and a falling stroke), small
    j7: { box: [-0.36, -0.5, 0.36, 0.52], draw: function (c) {
      c.fillRect(-0.3, -0.46, 0.6, 0.13);
      c.beginPath(); c.moveTo(0.3, -0.46); c.lineTo(0.3, -0.33);
      c.quadraticCurveTo(0.02, -0.02, -0.06, 0.48); c.lineTo(-0.2, 0.48); c.quadraticCurveTo(-0.08, -0.06, 0.16, -0.33);
      c.closePath(); c.fill();
    } },
  };
  function glyphSprite(name, s, rgb) {
    var key = "g:" + name + "|" + s.toFixed(2) + "|" + rgb.join(",") + "|" + VS.dpr;
    var sp = sprites.get(key);
    if (sp) return sp;
    if (sprites.size > 1500) sprites.clear();
    var G0 = GLYPHS[name], b = G0.box, k = s * VS.dpr, pad = 3;
    var cv = document.createElement("canvas");
    cv.width = Math.ceil((b[2] - b[0]) * k) + 2 * pad; cv.height = Math.ceil((b[3] - b[1]) * k) + 2 * pad;
    var c = cv.getContext("2d");
    c.translate(pad - b[0] * k, pad - b[1] * k); c.scale(k, k);
    c.fillStyle = rgba(rgb);
    G0.draw(c);
    sp = { cv: cv, ox: pad - b[0] * k, oy: pad - b[1] * k };
    sprites.set(key, sp);
    return sp;
  }
  function drawGlyph(c, name, x, y, s, rgb) {
    var sp = glyphSprite(name, s, rgb);
    c.drawImage(sp.cv, Math.round(x * VS.dpr - sp.ox) / VS.dpr, Math.round(y * VS.dpr - sp.oy) / VS.dpr, sp.cv.width / VS.dpr, sp.cv.height / VS.dpr);
  }

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  VS.C_INK = C_INK;
  VS.rgba = rgba;
  VS.clamp = clamp;
  VS.CLEF_TREBLE = CLEF_TREBLE;
  VS.CLEF_BASS = CLEF_BASS;
  VS.shapeKey = shapeKey;
  VS.anchorOf = anchorOf;
  VS.HEAVY = HEAVY;
  VS.headSprite = headSprite;
  VS.GLYPHS = GLYPHS;
  VS.drawGlyph = drawGlyph;
})();
