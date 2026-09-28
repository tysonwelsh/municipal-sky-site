// ============================================================================
// KOLOB — the open hymnal (visualizer)
//
// Three instruments of seeing, all printed things:
//  · THE ORGAN — the black pipe silhouettes of the tabernacle facade, standing
//    on the wheel's horizon INSIDE the wheel, under the arch of its hour ring
//    the way a case's pipes stand under an arch, breathing with the actual
//    sound: a spectrum analyzer racked the way real pipes are racked (gravest
//    in the middle, alternating outward), each with the paper-colored mouth
//    near its foot. Fed by an AnalyserNode on the master bus; at rest it
//    settles into the quiet stepped skyline of the hymnbook cover.
//  · THE PAGE — "The Colony Tunebook" (v0.31; plainer in v0.32): a grand
//    staff engraved the way a tunebook is engraved — two staves a
//    grand-staff gap apart, a brace, treble and bass clefs (baked outlines,
//    no font needed). Notes print as 4-shape SHAPE-NOTE heads (fa △, sol ○,
//    la ▭, mi ◇) with real stems, open/filled heads, flags and dots read from
//    their lengths, in one hymnbook-green ink from the moment they sound;
//    the ink dries as the page turns at 60 px/s. Just the notes: no signs
//    or words on the staff. Each voice is staffed by the part it reports
//    (closed score: S and A on the treble, T and B on the bass). A composed
//    hymn prints from its Score as a hymnal prints it (round 3b): barlines
//    in its mode of time, double bars at its lines' ends and the final bar
//    at its end, beams, rests, fermatas and ties, its two voices a staff
//    sharing stems where they move together, the tune's heads heavier; the
//    Old Way one line with its ornaments; the organ's giving-out too, but
//    never the organ under the singing. The
//    clarinet prints cue-size, the harmonium grace-size, bells and handbells
//    as ringed heads; the trombone choir at dawn prints its chorale in closed score,
//    the far choir pale and the near one full; an old tune remembered prints
//    faint and fine in round notes; the telegraph punches its holes
//    straight into the paper down the middle; the Question is framed in
//    cartouches; a visiting band slides through in round notes on its own
//    layer. The staves and clefs are a static layer; the ink is re-engraved
//    from data each frame, and nothing moves but the scroll and the drying.
//    In the sacrament the page dries almost blank.
//  · THE WHEEL — the order of service seated round the rim of one great
//    wheel, of which the page shows only the crown: a sun low on a far
//    horizon. The section now playing is lettered at the crown beneath ONE
//    gilt arc fixed to the page, which fills as the section plays; when it
//    is full the wheel turns anticlockwise a seat beneath it and the arc
//    fills again. Spokes and hour-marks beneath the banner make the turning
//    visible; the disc inside the hour ring is left clear for the organ.
//    Postlude turns into the next meeting's prelude like any other seat — the
//    cycle is the picture.
//
// No neon, no glitch, no CRT. A printed thing.
// Public surface: window.KolobViz = { init(canvas, wheelCanvas),
//   setConductor, setWheelLabels, wheelSeatAt, setTuningMarks, probe }
// ============================================================================

window.KolobViz = (function () {
  "use strict";
  var K = window.KolobAudio;

  var canvas = null, ctx2d = null;
  var staffLayer = null;                           // static: the staves, brace and clefs (the ink and band layers are below, with the page)
  var wheel = null, xctx = null;                   // the order of service, with the facade inside it
  var W = 0, H = 0, XW = 0, XH = 0, dpr = 1;
  var running = false;

  var cond = { section: null, local: 0, intensity: 0, f0: 65, mode: "ionian", hush: false, fuging: false };
  var playing = false;
  var paused = false;                              // the meeting held: the page stops turning and drying

  var PIPE = "#17201a";                            // the black of the facade
  var PAPER = "#f5f0e4";                           // cream, for the pipe mouths

  // ---- the organ: spectrum → facade ------------------------------------------
  // Band k is seated the way real pipes are racked: the gravest pipe in the
  // middle, then alternating left/right outward, so the facade breathes from
  // its center. An AnalyserNode taps the master bus once audio exists.
  // Kept ODD so the seating below places the gravest pipe dead-center and pairs
  // the rest symmetrically outward; fewer pipes also widen `step`, so the bars
  // and the gaps between them both grow with the count.
  var NPIPES = 21;
  var analyser = null, freqData = null, bandBins = null;
  var bands = [], seatOf = [];
  (function () {
    var c = Math.floor(NPIPES / 2);
    for (var k = 0; k < NPIPES; k++) {
      bands.push(0);
      seatOf.push(c + Math.ceil(k / 2) * (k % 2 === 1 ? -1 : 1));
    }
  })();

  function ensureAnalyser() {
    if (analyser || !K || !K.attachAnalyser) return;
    analyser = K.attachAnalyser();                 // null until the audio ctx exists
    if (!analyser) return;
    analyser.smoothingTimeConstant = 0.82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    // log-spaced bands, ~55 Hz to ~3.6 kHz — the world the meeting sounds in
    var nyquist = analyser.context.sampleRate / 2;
    var perBin = nyquist / analyser.frequencyBinCount;
    bandBins = [];
    for (var k = 0; k < NPIPES; k++) {
      var lo = 55 * Math.pow(3600 / 55, k / NPIPES);
      var hi = 55 * Math.pow(3600 / 55, (k + 1) / NPIPES);
      var b0 = Math.max(1, Math.floor(lo / perBin));
      var b1 = Math.max(b0, Math.floor(hi / perBin));
      bandBins.push([b0, b1]);
    }
  }

  function drawPipe(c, cx, baseY, w, h) {
    // Rb: the foot — just slightly thinner than the shoulder (r) so the pipe
    // tapers gently inward toward the base without the heavy-footed look of the
    // original 0.5w base.
    var r = w * 0.4, Rb = w * 0.36;
    var topY = baseY - h;
    // body — a slightly tapered foot up to the shoulders, then a domed cap
    c.beginPath();
    c.moveTo(cx - Rb, baseY);
    c.lineTo(cx - r, topY + r);
    c.quadraticCurveTo(cx - r, topY, cx, topY);
    c.quadraticCurveTo(cx + r, topY, cx + r, topY + r);
    c.lineTo(cx + Rb, baseY);
    c.closePath();
    c.fillStyle = PIPE;
    c.fill();
    // the mouth — a paper-colored pointed arch near the foot, the one detail
    // that says "organ pipe" and not "bar graph"
    var mh = Math.min(w * 0.85, h * 0.3);
    var mw = w * 0.42;                               // a narrower mouth arch
    var my = baseY - Math.max(10, h * 0.13);
    c.beginPath();
    c.moveTo(cx - mw / 2, my);
    c.quadraticCurveTo(cx - mw * 0.18, my - mh * 0.55, cx, my - mh);
    c.quadraticCurveTo(cx + mw * 0.18, my - mh * 0.55, cx + mw / 2, my);
    c.closePath();
    c.fillStyle = PAPER;
    c.fill();
  }

  // sample the spectrum into the 21 bands, with an analyzer's feel: quick to
  // rise, slower to fall. Silent (every band settling to 0) when not playing.
  function updateBands(dt) {
    if (playing) ensureAnalyser();
    var live = playing && analyser;
    if (live) analyser.getByteFrequencyData(freqData);
    for (var k = 0; k < NPIPES; k++) {
      var target = 0;
      if (live) {
        var span = bandBins[k], peak = 0;
        for (var b = span[0]; b <= span[1] && b < freqData.length; b++) {
          if (freqData[b] > peak) peak = freqData[b];
        }
        target = Math.pow(peak / 255, 1.3);
      }
      bands[k] += (target - bands[k]) * Math.min(1, dt * (target > bands[k] ? 9 : 2.4));
    }
  }
  // The facade stands INSIDE the wheel: the pipes' feet on the horizon (the
  // impost is the horizon rule), seated across the hour ring's chord. Every
  // pipe may rise to the same ceiling — the crown of the hour ring — so the
  // outer pipes are no longer pinned under the arch where it bends down to
  // the horizon (v0.30, owner: "let the pipes ignore the arc for now"); a
  // tall outer pipe simply crosses the ring. The travel still favours the
  // centre (the outer seats reach ~55% of the crown), so the facade keeps
  // its shape. At rest the minimum heights alone draw the stepped skyline of
  // the hymnbook cover. Drawn on the wheel canvas by drawWheel, after the
  // ring and the seat labels and before the fixed arc and the horizon rule.
  function drawFacade(c, g) {
    var baseY = g.horizonY, cx = g.cx, cy = g.cy, rIn = g.rHour;
    var dy = cy - baseY;                                       // the wheel's centre is this far below the horizon
    var halfChord = Math.sqrt(Math.max(0, rIn * rIn - dy * dy)); // the hour ring's half-width at the horizon
    var span = Math.max(60, (halfChord - 8) * 2);
    var step = span / NPIPES;
    var x0 = cx - span / 2 + step / 2;
    var CEIL = 6;                                              // paper between the tallest cap and the ring's crown
    var maxH = Math.max(50, baseY - (cy - rIn) - CEIL);        // one ceiling for every pipe: the crown of the hour ring
    for (var k = 0; k < NPIPES; k++) {
      var seat = seatOf[k];
      var x = x0 + seat * step;
      // wider, graver pipes toward the center of the facade
      var centerness = 1 - Math.abs(seat - (NPIPES - 1) / 2) / ((NPIPES - 1) / 2);
      var w = step * (0.5 + centerness * 0.34);
      var minH = 18 + centerness * 22;
      var h = minH + bands[k] * (maxH - minH) * (0.55 + centerness * 0.45);
      drawPipe(c, x, baseY, w, Math.min(h, maxH));
    }
  }

  // ---- pitch → staff position -----------------------------------------------
  var COLLECTIONS = {
    ionian:     [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8],
    mixolydian: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9],
    dorian:     [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9],
    aeolian:    [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9],
    penta:      [1, 9/8, 5/4, 3/2, 5/3],
    hexa:       [1, 9/8, 5/4, 4/3, 3/2, 5/3],
  };
  // 4-shape solmization per collection degree (fa sol la fa sol la mi).
  // The rudiments fix the key note as fa (major) or la (minor), so the
  // modal collections take the shapes of the tune they are written as:
  // dorian as a minor tune whose raised sixth is still fa, mixolydian as a
  // major tune whose lowered seventh is still mi (the Score may add the
  // accidental; the shape does not change with it).
  var SHAPES = {
    ionian:     ["fa", "sol", "la", "fa", "sol", "la", "mi"],
    mixolydian: ["fa", "sol", "la", "fa", "sol", "la", "mi"],
    dorian:     ["la", "mi", "fa", "sol", "la", "fa", "sol"],
    aeolian:    ["la", "mi", "fa", "sol", "la", "fa", "sol"],
    penta:      ["fa", "sol", "la", "sol", "la"],
    hexa:       ["fa", "sol", "la", "fa", "sol", "la"],
  };
  function degOf(freq) {
    var ratios = COLLECTIONS[cond.mode] || COLLECTIONS.ionian;
    var root = (cond.f0 || 65) * 4;
    var r = freq / root;
    var oct = 0;
    while (r >= 2) { r /= 2; oct++; }
    while (r < 1) { r *= 2; oct--; }
    var best = 0, bd = 1e9;
    for (var i = 0; i < ratios.length; i++) {
      var d = Math.abs(Math.log2(r / ratios[i]));
      if (d < bd) { bd = d; best = i; }
    }
    // a pitch just under the octave belongs to the next octave's do
    if (Math.abs(Math.log2(r / 2)) < bd) { best = 0; oct++; }
    return { deg: best, oct: oct, n: ratios.length };
  }
  // ==========================================================================
  // THE PAGE — "The Colony Tunebook" (v0.31, owner's Direction A; made
  // plainer in v0.32). A grand staff engraved the way a tunebook is
  // engraved: four shapes with their stems grown from the shape's own
  // corner, open and filled heads, flags and augmentation dots read from
  // each note's length, broad-nib contrast on the open heads and a
  // letterpress impression on every head, pre-rendered once per size at
  // device resolution (the sprite atlas). One ink, hymnbook green, from the
  // moment a note sounds; the ink dries as the page turns. Just the notes:
  // no signs or words on the staff. Nothing prints outside the plate: a
  // note beyond the ledger room folds silently by octaves until it fits.
  //
  // q is a diatonic-step lattice: bass rules at q = 0,2,4,6,8, middle C (the
  // meeting's tonic-root) at q = 10, treble rules at q = 12..20. The staves
  // stand a normal grand-staff gap apart (5 sp): a treble note at q10 hangs
  // on its ledger under the treble, a bass note at q10 on its ledger over the
  // bass, and the telegraph punches its holes along the middle of the gap.
  //
  // Everything on the page is kept as data, stamped with the audio time it
  // sounds at, and re-engraved each frame from the page clock (the audio
  // clock, smoothed), so the scroll is exact: x is time, and a page that
  // falls behind catches up whole. Nothing on the page moves but the scroll
  // and the drying.
  // (SATB part identity came with round 2.5: each note's reported part. A
  // composed hymn is engraved from its Score since round 3b — barlines,
  // double and final bars, beams, rests, fermatas, ties, closed score with
  // the tune marked: THE HYMNAL ON THE STAFF, below. Words and the running
  // head stay off the page, by the owner's ruling.)
  // ==========================================================================
  var STAFFPOS = {
    ionian:     [0, 1, 2, 3, 4, 5, 6],
    mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian:     [0, 1, 2, 3, 4, 5, 6],
    aeolian:    [0, 1, 2, 3, 4, 5, 6],
    penta:      [0, 1, 2, 4, 5],
    hexa:       [0, 1, 2, 3, 4, 5],
  };
  var Q_MID = 10;                                  // middle C / the meeting's tonic-root
  function noteQ(freq) {
    var d = degOf(freq);
    var letters = STAFFPOS[cond.mode] || STAFFPOS.ionian;
    var pos = letters[d.deg];
    if (pos == null) pos = d.deg;
    var q = Q_MID + pos + 7 * d.oct;
    while (q < -24) q += 7;                        // guard against nonsense only; the page folds (silently) at draw time
    while (q > 44) q -= 7;
    var shapes = SHAPES[cond.mode] || SHAPES.ionian;
    return { q: q, shape: shapes[d.deg] || "sol" };
  }
  // the visiting band plays in its own key: its staff letter comes from the
  // equal-tempered distance to the ward's do, not from the ward's scale
  var ET_LETTER = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  function bandQ(freq) {
    var s = Math.round(12 * Math.log2(freq / ((cond.f0 || 65) * 4)));
    var oct = Math.floor(s / 12), pc = s - oct * 12;
    return Q_MID + ET_LETTER[pc] + 7 * oct;
  }

  // ---- ink ----------------------------------------------------------------------
  // One ink (v0.32, owner): hymnbook green, from the moment a note sounds.
  // No gilt strike, no cooling, no glow; only the drying fades it.
  var C_INK = [30, 77, 59];
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : +(+a).toFixed(3)) + ")"; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  var FG = '"EB Garamond", Georgia, serif';

  // The two clefs, baked as self-contained outlines (traced from a serif music
  // glyph) so they render identically for every visitor — no font dependency.
  // Coordinates are font units (y-up, 1000 upm).
  var CLEF_TREBLE = { bbox: [120, -291, 542, 900], d: "M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z" };
  var CLEF_BASS   = { bbox: [75, 166, 607, 757],   d: "M564 704Q582 704 594.5 691.0Q607 678 607.0 661.0Q607 644 593.0 631.0Q579 618 563 618Q521 618 521 663Q521 681 534.0 692.5Q547 704 564 704ZM607 469Q607 450 594.0 437.0Q581 424 564 424Q521 424 521 469Q521 485 533.5 498.0Q546 511 564.0 511.0Q582 511 594.5 497.0Q607 483 607 469ZM285 757Q366 757 421.0 701.5Q476 646 476 569Q476 531 465.5 495.0Q455 459 432.0 426.5Q409 394 386.0 367.0Q363 340 326.0 313.0Q289 286 264.0 267.5Q239 249 196.5 226.0Q154 203 135.5 193.5Q117 184 80 166L75 182Q76 183 102.0 200.0Q128 217 144.0 227.5Q160 238 191.5 263.0Q223 288 244.0 309.5Q265 331 291.5 363.5Q318 396 334.0 427.0Q350 458 361.5 498.0Q373 538 373 578Q373 735 262 735Q225 735 199.0 725.5Q173 716 161.5 702.0Q150 688 145.0 677.5Q140 667 140 659Q140 644 160 644Q168 644 179.0 647.5Q190 651 194 651Q221 651 239.0 634.0Q257 617 257 592Q257 563 235.0 544.0Q213 525 183 525Q144 525 119.0 548.0Q94 571 94 607Q94 673 150.5 715.0Q207 757 285 757Z" };
  var trebPath = null, bassPath = null;            // Path2D, built on first resize

  // ---- the glyph atlas ----------------------------------------------------------
  // Noteheads in staff spaces (y down): polygons for fa/la/mi, ellipses for sol
  // and the band's round notes. The fa's upright edge is the stem's side.
  var SH = {
    fa_u: { poly: [[-0.64, 0.45], [0.64, 0.45], [0.64, -0.47]] },
    fa_d: { poly: [[-0.64, -0.47], [-0.64, 0.45], [0.64, 0.45]] },
    la: { poly: [[-0.55, -0.42], [0.55, -0.42], [0.55, 0.42], [-0.55, 0.42]] },
    mi: { poly: [[0, -0.54], [0.66, 0], [0, 0.54], [-0.66, 0]] },
    sol: { ell: [0.60, 0.43, -0.26] },
    round: { ell: [0.59, 0.42, -0.36] }
  };
  // stem attach points (the head's own edge on the stem side), in sp
  var ANCH = {
    fa_u: { u: [0.64, 0.45] }, fa_d: { d: [-0.64, -0.47] },
    la: { u: [0.55, 0.2], d: [-0.55, -0.2] },
    mi: { u: [0.66, 0.02], d: [-0.66, -0.02] },
    sol: { u: [0.58, -0.08], d: [-0.58, 0.08] },
    round: { u: [0.57, -0.1], d: [-0.57, 0.1] }
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
  // (heavy: the tune's head, round 3b — a little larger, its open heads
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
    var key = k + "|" + (open ? 1 : 0) + "|" + px.toFixed(2) + "|" + rgb.join(",") + "|" + dpr + (heavy ? "|h" : "");
    var sp = sprites.get(key);
    if (sp) return sp;
    if (sprites.size > 1500) sprites.clear();
    var s = px * dpr, size = Math.ceil(s * 2.0 / 2) * 2 + 8;
    var cv = document.createElement("canvas"); cv.width = cv.height = size;
    var c = cv.getContext("2d"), o = size / 2;
    c.translate(o, o);
    var full = headPaths(k, s, open, heavy);
    c.fillStyle = rgba(rgb);
    c.shadowColor = rgba(rgb, heavy ? 0.45 : 0.3); c.shadowBlur = (heavy ? 1.0 : 0.7) * dpr;   // a hair of ink spread
    c.fill(full, "evenodd");
    c.shadowColor = "transparent";
    if (heavy) {                                   // the heavier head's rim: the outline struck once more
      c.strokeStyle = rgba(rgb); c.lineWidth = Math.max(0.6 * dpr, 0.07 * s); c.lineJoin = "round";
      var rim = new Path2D();
      if (SH[k].poly) polyTo(rim, SH[k].poly, s * HEAVY);
      else rim.ellipse(0, 0, SH[k].ell[0] * s * HEAVY, SH[k].ell[1] * s * HEAVY, SH[k].ell[2], 0, Math.PI * 2);
      c.stroke(rim);
    }
    // letterpress impression: a pale inner edge low-right, as if pressed into the cream
    c.save(); c.clip(full, "evenodd");
    c.translate(-0.6 * dpr, -0.6 * dpr);
    c.strokeStyle = "rgba(255, 250, 236, 0.34)"; c.lineWidth = 1.0 * dpr;
    c.stroke(full);
    c.restore();
    sp = { cv: cv, o: o };
    sprites.set(key, sp);
    return sp;
  }
  // ---- the hymnal's other signs (round 3b) — rests, the fermata, the three
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
    var key = "g:" + name + "|" + s.toFixed(2) + "|" + rgb.join(",") + "|" + dpr;
    var sp = sprites.get(key);
    if (sp) return sp;
    if (sprites.size > 1500) sprites.clear();
    var G0 = GLYPHS[name], b = G0.box, k = s * dpr, pad = 3;
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
    c.drawImage(sp.cv, Math.round(x * dpr - sp.ox) / dpr, Math.round(y * dpr - sp.oy) / dpr, sp.cv.width / dpr, sp.cv.height / dpr);
  }

  // ---- geometry -------------------------------------------------------------------
  // The plate runs from just under the wheel's horizon rule (the staff canvas
  // is drawn 20px up over the wheel band) to just above the console (drawn
  // 12px up into the canvas foot). Nothing is inked outside it.
  var G = null;
  function pageGeom() {
    var top = 20, bot = H - 13;
    var sp = clamp((bot - top) / 19, 6, 11.5);
    var g = { sp: sp, top: top, bot: bot };
    g.T = Math.round(top + (bot - top - 13 * sp) / 2);   // treble top line (q20)
    g.Tb = g.T + 4 * sp;                                  // treble bottom line (q12)
    g.B = g.Tb + 5 * sp;                                  // bass top line (q8): a grand-staff gap, middle C's ledger in it
    g.Bb = g.B + 4 * sp;                                  // bass bottom line (q0)
    g.tapeY = (g.Tb + g.B) / 2;                           // the telegraph's holes, centred in the gap
    g.xBar = Math.round(1.55 * sp + 4);
    g.clefX = g.xBar + 0.7 * sp;
    g.trebH = 6.9 * sp;
    g.trebW = g.trebH * (CLEF_TREBLE.bbox[2] - CLEF_TREBLE.bbox[0]) / (CLEF_TREBLE.bbox[3] - CLEF_TREBLE.bbox[1]);
    g.bassH = 3.3 * sp;
    g.bassW = g.bassH * (CLEF_BASS.bbox[2] - CLEF_BASS.bbox[0]) / (CLEF_BASS.bbox[3] - CLEF_BASS.bbox[1]);
    g.clefEnd = g.clefX + Math.max(g.trebW, g.bassW);
    g.xE = W - Math.round(3.2 * sp);                     // the engraving point
    g.fade0 = g.clefEnd + 0.4 * sp; g.fade1 = g.fade0 + 6 * sp;
    // the ledger room: beyond it a note folds in by octaves, silently
    g.qMaxT = 20 + Math.floor(2 * (g.T - top - 0.62 * sp) / sp);
    g.qMinB = 0 - Math.floor(2 * (bot - g.Bb - 0.62 * sp) / sp);
    g.yT = function (q) { return g.T + (20 - q) * sp / 2; };
    g.yB = function (q) { return g.B + (8 - q) * sp / 2; };
    g.y = function (st, q) { return st === "T" ? g.yT(q) : g.yB(q); };
    g.mid = function (st) { return st === "T" ? g.yT(16) : g.yB(4); };
    return g;
  }

  // ---- the page clock -----------------------------------------------------------
  // One time base (v0.32). Every engraved item carries the AUDIO time it
  // sounds at, and PT is the audio clock as the page reads it: smoothed, so
  // the scroll is even though the audio clock ticks in chunks. x and the
  // drying are both worked out from PT at draw time, so when
  // the page has to catch up (a hidden tab, a stall, a slow device) all the
  // ink moves at once and the page simply shows the present — nothing
  // replays late. PT holds while the meeting is held, and after STOP it
  // follows the audio clock on (the clock keeps running) so the last ink
  // drains away. DRY is the drying clock: it advances with PT, faster in the
  // sacrament and the postlude.
  var SCROLL_PX_S = 60;                            // the owner's rate (v0.31; it was 11)
  var PT = 0, DRY = 0, ptSynced = false, lastAudio = -1;
  var PT_SNAP = 0.5;                               // further off than this, the page jumps to the present
  var PT_TAU = 0.25;                               // the smoothing's time constant, in seconds
  var PT_LEAD = 0.1;                               // the page never runs further than this ahead of the sound
  function audioNow() { return K && K.getAudioTime ? K.getAudioTime() : 0; }
  function tickClock(dt) {                         // dt: the real time since the last frame, uncapped
    var a = audioNow(), moving = a > lastAudio + 1e-6;
    lastAudio = a;
    if (paused) return;
    var p0 = PT;
    PT += dt;
    if ((playing || moving) && a > 0) {            // follow the audio clock while it runs
      var err = a - PT;
      if (!ptSynced || Math.abs(err) > PT_SNAP) { PT = a; ptSynced = true; }
      else {
        PT += err * (1 - Math.exp(-dt / PT_TAU));
        if (PT > a + PT_LEAD) PT = Math.max(p0, a + PT_LEAD);   // the sound has stalled: wait for it
      }
    }
    DRY += Math.max(0, PT - p0) * (1 + (cond.section === "sacrament" ? 30 : 0) + (cond.section === "postlude" ? 5 : 0));
  }

  // ---- note intake ----------------------------------------------------------------
  // The engine emits notes when it SCHEDULES them, a line at a time, often
  // seconds early. Everything one call emits (and the events it raises) is
  // taken in together at the end of the task, so a hymn line is read as a
  // line: its beat is estimated from its own lengths, its chords stacked.
  var intake = [], intakeArmed = false;
  var groups = [];                                 // engraved note groups (heads on one stem)
  var tapes = [];                                  // telegraph messages
  var questions = [];                              // the question: askings, and the empty measure
  var bandNotes = [], visits = [];                  // the visiting band, on its own layer
  // (round 2.5: the trombone choir at dawn and the old tune are engraved too
  // — the staff never sits blank while a guest of ours is playing)
  // (round 3b: the organ when it plays alone — the giving-out, the organist's
  // prelude and fills, the house's own chords where no one sings over them;
  // the ward's handbells; the full ward, whatever layer it sings on)
  var MELODIC = { clarinet: 1, bagpipe: 1, choir: 1, bells: 1, harmonium: 1, strings: 1, trombones: 1, oldtune: 1,
                  organ: 1, handbells: 1, ward: 1, cast: 1 };
  var CHOIR_LAYERS = { choir: 1, ward: 1, cast: 1 };
  var lastBeat = { choir: 1.15 };
  // Closed score, read from the part each note reports (SCORE §6): the
  // soprano and alto on the treble, the tenor and bass on the bass; where
  // two voices share a staff, the upper's stems go up and the lower's down.
  // A reported part holds its staff down to two ledgers into the gap (the
  // telegraph's lane lies beyond); a note that would go further prints on
  // the other staff, where it sits (a part kept on its own staff, the
  // trombones', folds back an octave instead: foldFor). A note with no
  // such part (the strings' root, fifth and octave, the clarinet, the
  // bells) takes the staff its pitch belongs to, middle C and above on the
  // treble.
  var PART_STAFF = { S: "T", A: "T", T: "B", B: "B" };
  var PART_DIR = { S: 1, A: -1, T: 1, B: -1 };
  var GAP_T = 8, GAP_B = 12;                       // the deepest a part reaches into the gap: two ledgers
  // (a composed hymn's tune goes further, and keeps its staff: to a step
  // over its third ledger — THE HYMNAL ON THE STAFF)
  var TUNE_T = 5, TUNE_B = 15;
  function staffOf(n, q, strict) {
    var ps = PART_STAFF[n.part];
    if (!ps) return q >= Q_MID ? "T" : "B";
    if (strict) return ps;
    if (ps === "T" && q < GAP_T) return "B";
    if (ps === "B" && q > GAP_B) return "T";
    return ps;
  }
  function queueIntake(x) {
    intake.push(x);
    if (!intakeArmed) {
      intakeArmed = true;
      Promise.resolve().then(flushIntake);
    }
  }
  // (a note or event that says logged: false — an unlogged guest's, the
  // Hosanna's shout — is never engraved: SCORE §6, PLAN §8.12)
  function onNote(n) {
    if (!n || n.logged === false) return;
    if (n.layer === "telegraph") { if (n.marks && n.marks.length) queueIntake({ note: n }); return; }
    if (n.layer === "band") { if (n.freq > 20) queueIntake({ note: n }); return; }
    if (!n.freq || n.freq < 20 || !MELODIC[n.layer]) return;
    if (n.layer === "organ" && (n.part === "pedal" || n.pedal)) return;   // the 16′ under the bass: a stop drawn, not a note written
    queueIntake({ note: n });
  }
  // the typed bus (SCORE.md §6; round 2): the page reads the event's type,
  // never its label — the Question's askings and its silence, and STOP;
  // (round 3b) the hymn board's announcement, each verse's performance, and
  // each composed line told with its Score, which comes in with its notes
  function onEvent(ev) {
    if (!ev || ev.logged === false) return;
    if (ev.type === "question-asking" || ev.type === "question-unanswered") queueIntake({ ev: ev });
    else if (ev.type === "transport" && ev.action === "stop") queueIntake({ stop: ev.t != null ? ev.t : audioNow() });
    else if (ev.type === "hymn-announced" && ev.hymn && ev.hymn.id) announceHymn(ev.hymn);
    else if (ev.type === "verse-start" && ev.hymnId) verseBegins(ev);
    else if (ev.type === "verse-line" && ev.composed && ev.score && ev.hymnId) queueIntake({ ev: ev });
  }

  // the beat of a line: the length that makes its notes the simplest values
  // (quarters, halves, dotted, eighths), held between 0.75 and 1.65 s with a
  // gentle pull toward hymn time
  var GRID = [0.25, 0.5, 1, 1.5, 2, 3, 4];
  function estimateBeat(durs, fallback) {
    var ds = durs.filter(function (d) { return d > 0.08 && d < 7; });
    if (ds.length < 3) return fallback;
    var best = fallback, bc = 1e9;
    for (var b = 0.75; b <= 1.651; b += 0.01) {
      var cost = 0.5 * Math.abs(Math.log2(b / 1.15)) * ds.length * 0.25;
      for (var i = 0; i < ds.length; i++) {
        var r = ds[i] / b, e = 9;
        for (var j = 0; j < GRID.length; j++) e = Math.min(e, Math.abs(Math.log2(r / GRID[j])));
        cost += e;
      }
      if (cost < bc) { bc = cost; best = b; }
    }
    return best;
  }
  // seconds → a note value against the line's beat. A line whose beat is
  // the tune's own (fine: the old tune's notes say where they fall in it)
  // can also print a dotted eighth, three quarters of a beat (MARTYR's
  // dotted figure). Against a beat estimated from the lengths, that is too
  // fine to tell from a quarter sung short, and the line reads as before.
  function valueOf(beats, layer, fine) {
    if (layer === "strings" && beats >= 7) return { open: true, stem: false, breve: true, dots: 0, flags: 0 };
    if (beats >= 3.5) return { open: true, stem: false, dots: 0, flags: 0 };
    if (beats >= 2.6) return { open: true, stem: true, dots: 1, flags: 0 };
    if (beats >= 1.75) return { open: true, stem: true, dots: 0, flags: 0 };
    if (beats >= 1.3) return { open: false, stem: true, dots: 1, flags: 0 };
    if (fine && beats >= 0.62 && beats < 0.87) return { open: false, stem: true, dots: 1, flags: 1 };
    if (beats >= 0.72) return { open: false, stem: true, dots: 0, flags: 0 };
    if (beats >= 0.36) return { open: false, stem: true, dots: 0, flags: 1 };
    return { open: false, stem: true, dots: 0, flags: 2 };
  }
  var SCALE = { choir: 1, bagpipe: 1, strings: 1, bells: 1, clarinet: 0.75, harmonium: 0.6, trombones: 1, oldtune: 1,
                organ: 1, handbells: 1, ward: 1, cast: 1 };

  function flushIntake() {
    intakeArmed = false;
    var batch = intake; intake = [];
    var byLayer = {}, question = null, unanswered = null, stopAt = null, i;
    var hymnLines = {}, lineEvs = {}, lineOrder = [], fugs = [];
    function lineNotes(k) { if (!hymnLines[k]) { hymnLines[k] = []; if (!lineEvs[k]) lineOrder.push(k); } return hymnLines[k]; }
    for (i = 0; i < batch.length; i++) {
      var it = batch[i];
      if (it.stop != null) { stopAt = stopAt == null ? it.stop : Math.min(stopAt, it.stop); continue; }
      if (it.ev) {
        if (it.ev.type === "question-asking") question = it.ev;
        else if (it.ev.type === "question-unanswered") unanswered = it.ev;
        else if (it.ev.type === "verse-line") {
          var ek = lineKey(it.ev);
          if (!lineEvs[ek] && !hymnLines[ek]) lineOrder.push(ek);
          lineEvs[ek] = it.ev;
        }
        continue;
      }
      var n = it.note;
      if (n.layer === "telegraph") { takeTape(n); continue; }
      if (n.fuging && n.hymnId && CHOIR_LAYERS[n.layer]) { fugs.push(n); continue; }   // the fuge between the verses: takeFuging
      // a composed hymn's notes are engraved from its Score, a line at a time
      var route = scoreRoute(n);
      if (route) { lineNotes(lineKey(n)).push({ n: n, under: route === "under" }); continue; }
      (byLayer[n.layer] = byLayer[n.layer] || []).push(n);
    }
    lineOrder.forEach(function (k) {
      var ns = hymnLines[k] || [];
      if (takeHymnLine(ns, lineEvs[k] || null)) return;
      // no Score to read it by: the notes print as the page hears them (never the organ under the ward)
      ns.forEach(function (x) { if (!x.under) (byLayer[x.n.layer] = byLayer[x.n.layer] || []).push(x.n); });
    });
    if (fugs.length && !takeFuging(fugs)) fugs.forEach(function (fn) { (byLayer[fn.layer] = byLayer[fn.layer] || []).push(fn); });
    if (byLayer.band) takeBand(byLayer.band);
    if (byLayer.trombones) takeTrombones(byLayer.trombones);
    if (byLayer.oldtune) takeOldTune(byLayer.oldtune);
    Object.keys(byLayer).forEach(function (layer) {
      if (layer === "band" || layer === "trombones" || layer === "oldtune") return;
      var ns = byLayer[layer];
      var beat = estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat[layer] || lastBeat.choir || 1.15);
      if (ns.length >= 3) lastBeat[layer] = beat;
      takeLayer(layer, ns, beat, question);
    });
    if (question) takeQuestion(byLayer.clarinet || [], question);
    if (unanswered) takeUnanswered(unanswered);
    if (stopAt != null) silence(stopAt);
    // bounded memory: the page shows ~15 s; keep generously more
    if (groups.length > 900) groups.splice(0, groups.length - 900);
    if (marks.length > 900) marks.splice(0, marks.length - 900);
    if (bandNotes.length > 500) bandNotes.splice(0, bandNotes.length - 500);
  }

  // STOP: nothing more is printed. Ink the engine had scheduled (a choir
  // line runs up to ~36 s ahead, the band's whole crossing) that will not
  // now sound is lifted from the page; what was sounding keeps its place,
  // its length cut to the voices' fade (the engine closes their bus over
  // 0.6 s), and a message being keyed is cut where the key stopped. Called
  // with the stop's audio time, from the "■" transport event or, failing
  // that, when the conductor first reports the meeting stopped.
  var STOP_FADE = 0.6;
  function silence(cut) {
    var end = cut + STOP_FADE, i, k;
    for (i = 0, k = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.tp > cut) continue;
      if (gr.tp + gr.dur > end) gr.dur = end - gr.tp;
      if (gr.beam) gr.beam.members = gr.beam.members.filter(function (m) { return m.tp <= cut; });
      groups[k++] = gr;
    }
    groups.length = k;
    // the hymn's own marks: a bar, a rest, a fermata, a tie or slur not yet reached is lifted
    for (i = 0, k = 0; i < marks.length; i++) {
      var mk0 = marks[i];
      if (mk0.tp > cut || (mk0.tp2 != null && mk0.tp2 > end)) continue;
      marks[k++] = mk0;
    }
    marks.length = k;
    wardSpans = wardSpans.filter(function (w) { return w.tp0 <= cut; });
    for (i = 0, k = 0; i < bandNotes.length; i++) {
      var n = bandNotes[i];
      if (n.tp > cut) continue;
      if (n.tp + n.dur > end) n.dur = end - n.tp;
      bandNotes[k++] = n;
    }
    bandNotes.length = k;
    for (i = visits.length - 1; i >= 0; i--) {
      var bd = visits[i];
      if (bd.tp0 > cut) { visits.splice(i, 1); continue; }
      bd.tp1 = Math.min(bd.tp1, end);
      bd.bass = bd.bass.filter(function (bb) { return bb.tp <= cut; });
    }
    for (i = tapes.length - 1; i >= 0; i--) {      // a message being keyed is cut where the key stopped
      var T = tapes[i], lim = cut - T.tp;
      if (lim < 0) { tapes.splice(i, 1); continue; }
      if (T.Tt > lim) {
        T.marks = T.marks.filter(function (m) { return m.tp <= end; });   // only what was punched before the key fell silent
        if (!T.marks.length) { tapes.splice(i, 1); continue; }
        var lm = T.marks[T.marks.length - 1];
        T.Tt = lm.at + lm.len;
      }
    }
    for (i = questions.length - 1; i >= 0; i--) {
      var qn = questions[i];
      qn.asks = qn.asks.filter(function (ak) { return ak.tp0 <= cut; });
      qn.asks.forEach(function (ak) { ak.tp1 = Math.min(ak.tp1, end); });
      if (qn.na) {
        if (qn.na.tp0 > cut) qn.na = null;
        else qn.na.tp1 = Math.min(qn.na.tp1, Math.max(cut, qn.na.tp0 + 1));
      }
      if (!qn.asks.length && !qn.na) questions.splice(i, 1);
    }
  }

  // one layer's notes from one call → groups of heads on shared stems.
  // opt, for the guests: staff — one staff for the whole call; strict — a
  // part keeps its own staff however deep in the gap (foldFor keeps it off
  // the telegraph's line); shift — a written octave per staff ({T, B}, in
  // steps of the staff); shape — one head for every note; ink, thin, dry —
  // its ink, its line weight and how fast it dries, against the ward's (1
  // each); fineBeat — the beat is the tune's own (valueOf)
  function takeLayer(layer, ns, beat, question, opt) {
    opt = opt || {};
    var byT = {}, voices = { T: {}, B: {} };
    ns.forEach(function (n) {
      var nq = taggedQ(n) || noteQ(n.freq), st = opt.staff || staffOf(n, nq.q, opt.strict);
      var p = { n: n, q: nq.q + (opt.shift ? opt.shift[st] || 0 : 0), shape: opt.shape || nq.shape, st: st };
      if (PART_DIR[n.part]) voices[st][n.part] = 1;
      var k = Math.round(n.startTime * 50);
      (byT[k] = byT[k] || []).push(p);
    });
    // two parts or more on one staff in this call are voices: each keeps
    // its own stem when it moves alone (the alto's passing note stems down)
    var voiced = { T: Object.keys(voices.T).length > 1, B: Object.keys(voices.B).length > 1 };
    // the Question's askings fold together (if they must), so the phrase keeps its shape
    var askMax = null;
    if (question && layer === "clarinet") {
      askMax = -1e9;
      ns.forEach(function (n) { askMax = Math.max(askMax, noteQ(n.freq).q); });
    }
    Object.keys(byT).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var parts = byT[k].slice().sort(function (a, b) { return b.n.freq - a.n.freq; });
      var t0 = parts[0].n.startTime;
      ["T", "B"].forEach(function (st) {
        var onSt = parts.filter(function (p) { return p.st === st; });
        if (!onSt.length) return;
        // heads that last alike share a stem; a different length gets its own
        var byDur = {};
        onSt.forEach(function (p) { var dk = Math.round(p.n.duration * 20); (byDur[dk] = byDur[dk] || []).push(p); });
        var keys = Object.keys(byDur), closed = parts.length >= 3 && (!!CHOIR_LAYERS[layer] || layer === "organ");
        // (a unison of the whole ward: one head, however many throats — where
        // a crowd reports one place at several lengths, the longest wins it;
        // a quartet's two voices on one pitch keep their two heads)
        if (keys.length > 1 && onSt.length > 4) {
          var bestAt = {};
          keys.forEach(function (dk) { byDur[dk].forEach(function (p) { if (!bestAt[p.q] || +dk > +bestAt[p.q]) bestAt[p.q] = dk; }); });
          keys.forEach(function (dk) { byDur[dk] = byDur[dk].filter(function (p) { return bestAt[p.q] === dk; }); if (!byDur[dk].length) delete byDur[dk]; });
          keys = Object.keys(byDur);
        }
        // two lengths at once on one staff are two voices, set the way a
        // hymnal sets them: the lower first with its stem down, the upper
        // with its stem up (if their heads would touch, the page moves the
        // later one aside at draw time — see placeColumn)
        var meanQ = {};
        keys.forEach(function (dk) { var sq = 0; byDur[dk].forEach(function (p) { sq += p.q; }); meanQ[dk] = sq / byDur[dk].length; });
        keys.sort(function (a, b) { return meanQ[a] - meanQ[b] || a - b; });
        keys.forEach(function (dk, gi) {
          var ps = byDur[dk], dur = ps[0].n.duration;
          var v = valueOf(dur / beat, layer, opt.fineBeat);
          var seen = {}, heads = [];
          ps.forEach(function (p) {
            if (seen[p.q]) return; seen[p.q] = 1;               // unison parts share a head
            heads.push({ q: p.q, shape: p.shape, open: v.open, dots: v.dots });
          });
          var grp = {
            layer: layer, tp: t0, dur: dur, st: st, heads: heads, v: v,
            scale: SCALE[layer] || 1, dir: 0, noStem: !v.stem, flags: v.flags
          };
          if (opt.ink != null && opt.ink !== 1) grp.ink = opt.ink;
          if (opt.thin) grp.thin = opt.thin;
          if (opt.dry) grp.dry = opt.dry;
          if (layer === "bells" || layer === "handbells") { grp.noStem = true; grp.ring = true; grp.flags = 0; heads.forEach(function (h) { h.open = true; h.dots = 0; }); }
          if (layer === "organ") grp.alone = true;             // printed only where no one sings over it (organAlone)
          if (layer === "harmonium" && question) {        // the answers: slashed grace notes
            grp.slash = true; grp.noStem = false; grp.flags = 1; grp.dir = 1;
            heads.forEach(function (h) { h.open = false; h.dots = 0; });
          }
          if (askMax != null) grp.askMax = askMax;
          if (!grp.dir) {
            var vd = voiced[st] ? voiceDir(ps) : 0, pd = posDir(heads, st);
            if (vd) {
              grp.dir = vd;
              if (pd !== vd && keys.length === 1) grp.alt = pd;   // alone on its staff: if the voice's stem would be stubby (layoutGroup)
            }
            else if (keys.length > 1) grp.dir = gi === keys.length - 1 ? 1 : -1;
            else if (closed) grp.dir = st === "T" ? 1 : -1;
            else grp.dir = pd;
          }
          groups.push(grp);
        });
      });
    });
  }
  // the position rule: the stem turns away from the head that lies furthest
  // from its staff's middle line (down from a high note, up from a low one)
  function posDir(heads, st) {
    var mq = st === "T" ? 16 : 4, far = heads[0];
    heads.forEach(function (h) { if (Math.abs(h.q - mq) > Math.abs(far.q - mq)) far = h; });
    return far.q >= mq ? -1 : 1;
  }
  // the stem the parts on one stem agree on (S and T up, A and B down), or
  // 0 when they don't agree or report no part: a shared stem goes the
  // closed score's way, a lone line the way its heads lie. A voice's own
  // stem that the plate's edge or the gap would cut short (a lone high
  // soprano's, stem up over the treble) takes the position rule instead:
  // see layoutGroup.
  function voiceDir(ps) {
    var d = 0;
    for (var i = 0; i < ps.length; i++) {
      var pd = PART_DIR[ps[i].n.part];
      if (!pd || (d && pd !== d)) return 0;
      d = pd;
    }
    return d;
  }

  // ---- the trombone choir at dawn ------------------------------------------------
  // A four-part chorale, the day's first hymn, printed as the hymnal prints
  // it before anyone sings it: a closed score, the soprano and alto
  // trombones on the treble, tenor and bass on the bass, each part on its
  // own staff the whole chorale through. Parts that move together share a
  // stem, turned the way the chord lies (the bass's low chords stem up
  // into the gap, not down onto the console); a part that moves alone keeps
  // its voice's stem (the alto's and the bass's down). The two choirs
  // answer each other across the town, and the page shows which is which by
  // its ink alone: the far choir's lines are pale, the near choir's full.
  // When the far choir joins the near one's last chord it doubles it, and
  // unison parts share a head: the chord is printed once.
  //
  // The chorale is set where the trombones are warm, which is not where a
  // hymnal's voices sit: often the tenor and alto lie a third to a fifth
  // under their singers'. So the page chooses, for the whole chorale and
  // for each staff, the octave it is written in: as it sounds, unless an
  // octave up (or down) spares the reader at least a quarter of a ledger
  // line a note — the way a men's choir's tenors are printed on the treble
  // an octave above their sound. The bass staff never climbs over the
  // treble's octave. The engine plays the whole chorale in one call, so the
  // page reads it whole.
  var TROMBONE_INK = { far: 0.42, near: 1 };
  function ledgerCost(st, q) {                     // ledger lines a note needs, the gap's weighing more; past the plate, more again
    if (st === "T") return q < 12 ? 1.5 * Math.floor((12 - q) / 2) : q > 20 ? Math.floor((q - 20) / 2) + (q > 24 ? 3 : 0) : 0;
    return q > 8 ? 1.5 * Math.floor((q - 8) / 2) : q < 0 ? Math.floor(-q / 2) + (q < -4 ? 3 : 0) : 0;
  }
  function writtenOctaves(ns) {
    var out = { T: 0, B: 0 };
    ["T", "B"].forEach(function (st) {
      var qs = [];
      ns.forEach(function (n) { if (PART_STAFF[n.part] === st) qs.push(noteQ(n.freq).q); });
      if (!qs.length) return;
      var cost = {}, best = 0;
      [-7, 0, 7].forEach(function (k) {
        var c = 0;
        qs.forEach(function (q) { c += ledgerCost(st, q + k); });
        cost[k] = c / qs.length;
        if (cost[k] < cost[best]) best = k;
      });
      if (best && cost[best] < cost[0] - 0.25) out[st] = best;
    });
    if (out.B > out.T) out.B = out.T;
    return out;
  }
  function takeTrombones(ns) {
    var near = ns.filter(function (n) { return n.choir !== "far"; });
    ns = ns.filter(function (n) {
      if (n.choir !== "far") return true;
      for (var i = 0; i < near.length; i++) {
        var m = near[i];
        if (m.part === n.part && m.startTime <= n.startTime + 1e-6 && n.startTime - m.startTime < 0.3 &&
            Math.abs(Math.log2(n.freq / m.freq)) < 0.03) return false;   // the far choir, joining: already printed
      }
      return true;
    });
    var shift = writtenOctaves(ns);
    ["far", "near"].forEach(function (ch) {
      var mine = ns.filter(function (n) { return (n.choir === "far") === (ch === "far"); });
      if (!mine.length) return;
      // each choir has its own beat (the far one drags a little)
      var key = "trombones:" + ch;
      var beat = choraleBeat(mine) || estimateBeat(mine.map(function (n) { return n.duration; }), lastBeat[key] || lastBeat.choir || 1.15);
      if (mine.length >= 3) lastBeat[key] = beat;
      takeLayer("trombones", mine, beat, null, { strict: true, shift: shift, ink: TROMBONE_INK[ch] });
    });
  }
  // A chorale moves in its beat: its commonest length is the quarter, so a
  // brisk dawn reads in quarters and halves as the chorale book prints it,
  // not in eighths pulled toward hymn time. Null when no length is common
  // enough to be sure (then the line's own estimate stands).
  function choraleBeat(ns) {
    var bins = {}, n = 0, best = null, bc = 0;
    ns.forEach(function (x) {
      if (!(x.duration > 0.2 && x.duration < 2.5)) return;
      var k = Math.round(Math.log2(x.duration) * 25);          // bins of about 3 %
      bins[k] = (bins[k] || 0) + 1; n++;
    });
    Object.keys(bins).forEach(function (k) {
      k = +k;
      var c = bins[k] + 0.5 * ((bins[k - 1] || 0) + (bins[k + 1] || 0));
      if (c > bc) { bc = c; best = k; }
    });
    return best != null && n >= 6 && bc >= 0.25 * n ? clamp(Math.pow(2, best / 25), 0.35, 1.8) : null;
  }

  // ---- the old tune -----------------------------------------------------------------
  // An Earth tune remembered: the colony's own hymn, from the tunebook, but
  // from the Earth of three thousand years ago, and the memory prints it
  // the way Earth's hymnals had come to print it — in round notes (the
  // book of 1985 among them), before the colony took up the shapes again.
  // It is engraved finely and faintly, a hairline of green that dries twice
  // as fast as the ward's ink, so the tune fades from the page as it fades
  // from the air; the second try, the head alone trailing off, is fainter
  // still. One staff for the whole memory: the one its line needs the
  // fewest ledger lines on. Its beat is the book's own: the notes report
  // where they fall in the tune, and the wear (a note dropped, one held
  // wrong) moves the time but not the beat, so the middle of the ratios is
  // the beat.
  var OLDTUNE_INK = { 1: 0.5, 2: 0.3 };
  function takeOldTune(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var rs = [], qs = [];
    for (var i = 0; i < ns.length; i++) {
      qs.push(noteQ(ns[i].freq).q);
      var a = ns[i - 1], b = ns[i];
      if (a && a.tryNo === b.tryNo && a.line === b.line && typeof a.beat === "number" && typeof b.beat === "number" && b.beat > a.beat)
        rs.push((b.startTime - a.startTime) / (b.beat - a.beat));
    }
    rs.sort(function (x, y) { return x - y; });
    var beat = rs.length >= 2 ? clamp(rs[rs.length >> 1], 0.3, 3)
      : estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.oldtune || lastBeat.choir || 1.15);
    lastBeat.oldtune = beat;
    var cT = 0, cB = 0;
    qs.forEach(function (q) { cT += ledgerCost("T", q); cB += ledgerCost("B", q); });
    var st = cT <= cB ? "T" : "B";
    [1, 2].forEach(function (tryNo) {
      var mine = ns.filter(function (n) { return (n.tryNo === 2 ? 2 : 1) === tryNo; });
      if (mine.length) takeLayer("oldtune", mine, beat, null, { staff: st, shape: "round", ink: OLDTUNE_INK[tryNo], thin: 0.7, dry: 2, fineBeat: rs.length >= 2 });
    });
  }
  // ==========================================================================
  // THE HYMNAL ON THE STAFF (round 3b; PLAN-ENGRAVING §4.3–§4.4)
  //
  // A composed hymn is not guessed at from its sound. The engine tells the
  // page each line with its Score as it hands the line to the voices
  // (verse-line: the Line as the composer wrote it, where it begins and the
  // beat it is sung to), and every note it sings names its part, its line
  // and its beat. So the page prints the hymn the way the hymnal prints it:
  //
  //  · the barlines of its mode of time, from the line's own place in the
  //    bar; a double bar where each line of the poem ends, and the final bar
  //    where the hymn ends (after the A-men, or after the last verse when
  //    the performance names how many it sings); each bar standing clear of
  //    the ink either side of it, the downbeat's notes making room for it
  //    where the page is tight (drawHymnBar);
  //  · every note at its written value — quarters, halves, dots, a whole in
  //    a Sacred Harp 3/2 — and the quick notes of one voice beamed within
  //    the beat of the mode of time instead of flagged; rests where a part
  //    is silent (the fuge's voices before they come in); fermatas where
  //    the Score holds, over the treble and under the bass; ties; a slur
  //    over the tune's melismas; an accidental where the Score alters a
  //    degree;
  //  · CLOSED SCORE, from the parts that sound (whoever sings them, and the
  //    organ doubling them under the Tabernacle's verses): the two upper
  //    voices on the treble, the upper's stems up and the lower's down, the
  //    two lower voices on the bass the same way; where the two on one
  //    staff move together through a beat they share their stems (the
  //    treble's up, the bass's down, as the tunebook sets them). The voices
  //    keep their order on the page: gospel's lead sings under its tenor, so
  //    there the tenor and the lead take the treble and the baritone and the
  //    bass the bass (kolob-dialects.js, GOSPEL.voiceOrder);
  //  · THE TUNE MARKED in every dialect that sings in parts, by a slightly
  //    heavier head: the soprano's in the Tabernacle, the tenor's in the
  //    Sacred Harp and the psalmody, the lead's in gospel — and the tune
  //    keeps its staff and its stem however high it climbs (a Sacred Harp
  //    tenor on its third ledger over the bass staff, its stem shortened,
  //    never turned: the gap between the staves is shared out with the tune
  //    first, shareGap);
  //  · the fuging between the verses, the voices entering one by one on the
  //    tune's head, printed as a free passage: its written values in the
  //    verse's beat, no barlines, the close under a fermata (takeFuging);
  //  · a unison (the Old Way, the Shaker's and the Primary's songs) as one
  //    line on the staff it sits best on, the Old Way's ornaments marked
  //    where the composer placed them — a turn, a slide into the note, a
  //    grace before it (each singer decorates them their own way: the sign
  //    says where, the ear hears how);
  //  · (optional, the owner's call) Ben Johnston's tuning marks before a
  //    head the colony tunes away from its spelling: − or + for a syntonic
  //    comma, 7 for the septimal seventh that rings. TUNING_MARKS below.
  //
  // The ward prints as its four parts however many sing them: the page
  // reads each part once, from the Score, and the notes only say which
  // parts sound and when. The organ under the singing is not printed, as in
  // hymnals; the organ alone (its giving-out of the tune, a prelude, a fill
  // between the lines, the house's own chords where no one sings) is.
  // Everything is green; nothing is text.
  // ==========================================================================
  // (off until the owner rules: in the Tabernacle a − now and then, but a
  // gospel hymn rings a 7+ before half its notes, and the 7 reads as a
  // figure. true — or KolobViz.setTuningMarks(true) — prints them.)
  var TUNING_MARKS = false;                        // Johnston's − + 7
  var marks = [];                                  // a composed line's own marks: bars, rests, fermatas, ties and slurs
  var lastEndBar = null;                           // the last line's double bar, until the next line comes
  var wardSpans = [];                              // where the ward sings a composed line (the organ under it is not printed)
  var hymnBook = {}, hymnIds = [];                 // id → what the page knows of a hymn (its Score, from the engine)
  var VOICE_ORDER = { gospel: ["S", "T", "A", "B"] };
  var MELODY_PART = { sacredharp: "T", psalmody: "T", gospel: "T" };
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };   // (kolob-composer.js DO_OF, if the composer is absent)
  var SHAPE4 = ["fa", "sol", "la", "fa", "sol", "la", "mi"];                             // do re mi fa sol la ti, in four shapes

  function hymnOf(id) {
    var h = hymnBook[id];
    if (!h) {
      h = hymnBook[id] = { id: id };
      hymnIds.push(id);
      if (hymnIds.length > 16) delete hymnBook[hymnIds.shift()];
    }
    if (!h.score && K && K.getHymn) {
      var sc = null;
      try { sc = K.getHymn(id); } catch (e) { sc = null; }
      if (sc && sc.lines) {
        h.score = sc;
        ["dialect", "mode", "keyMonzo", "modeOfTime", "melodyPart"].forEach(function (k) { if (h[k] == null && sc[k] != null) h[k] = sc[k]; });
      }
    }
    return h;
  }
  function announceHymn(hy) {
    var h = hymnOf(hy.id);
    ["dialect", "mode", "keyMonzo", "modeOfTime"].forEach(function (k) { if (hy[k] != null) h[k] = hy[k]; });
  }
  // (a verse's performance: the beat it is sung to, and — when the engine
  // names it — how many verses the hymn is sung to, so the last one ends on
  // the final bar)
  function verseBegins(ev) {
    var h = hymnOf(ev.hymnId), P = ev.performance || {};
    if (P.beatS > 0) h.bs = P.beatS;
    if (typeof P.verses === "number") h.verses = P.verses;
    else if (typeof ev.verses === "number") h.verses = ev.verses;
  }
  function lineKey(x) { return x.hymnId + "|" + x.verse + "|" + x.line + (x.amen ? "|a" : "") + (x.givingOut ? "|g" : ""); }
  // which notes the Score engraves: a composed hymn's (not a guest's, not
  // the fuging's head, which has no line), and of the organ's only its
  // giving-out; the organ under the ward only tells which parts sound
  function scoreRoute(n) {
    if (!n.hymnId || typeof n.beat !== "number" || n.line == null || n.fuging) return null;
    if (n.layer === "organ") {
      if (n.givingOut) return "line";
      if ((typeof n.verse === "number" && n.verse >= 0) || n.amen) return "under";
      return null;
    }
    return CHOIR_LAYERS[n.layer] ? "line" : null;
  }
  function doOf(mode) {
    var C = window.KOLOB && window.KOLOB.Composer, d = C && C.doOf ? C.doOf(mode) : null;
    return typeof d === "number" ? d : DO_OF[mode] || 0;
  }
  // the shape a degree is sung on (the same syllable the ward sings on the notes)
  function shapeOfDeg(mode, deg) { return SHAPE4[(((deg - doOf(mode)) % 7) + 7) % 7]; }
  function monzoCents(m) { return 1200 * ((m[0] || 0) + (m[1] || 0) * Math.log2(3) + (m[2] || 0) * Math.log2(5) + (m[3] || 0) * Math.log2(7)); }
  // the hymn's key, in staff steps from the day's keynote (a fourth up: three)
  function keySteps(m) { return m ? Math.round(monzoCents(m) * 7 / 1200) : 0; }
  // a note that names its degree in a composed hymn's key is placed by it,
  // not by its sound (a hymn keyed a fourth away would misspell): the
  // octave from its frequency, the step from its degree
  function taggedQ(n) {
    if (typeof n.deg !== "number" || !n.keyMonzo || !n.hymnId || !(CHOIR_LAYERS[n.layer] || n.layer === "organ")) return null;
    var h = hymnBook[n.hymnId], mode = (h && h.mode) || cond.mode;
    var key = Math.pow(2, monzoCents(n.keyMonzo) / 1200), K0 = (cond.f0 || 65) * 4;
    var oct = Math.round(Math.log2(n.freq / (K0 * key)) - n.deg / 7);
    return { q: Q_MID + keySteps(n.keyMonzo) + n.deg + 7 * oct, shape: shapeOfDeg(mode, n.deg) };
  }
  function timeSig(mot) {
    var m = /^(\d+)\/(\d+)$/.exec(mot || "");
    return m ? { bar: +m[1], den: +m[2] } : { bar: 4, den: 4 };
  }
  // a line's clock in beats (kolob-hymnal.js clockOf, the performer's own):
  // a fermata holds its note seven-tenths again and moves all that follows
  function unitsOf(line) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { (line.notes[p] || []).forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len });
    });
    return function (b) { var u = b; for (var i = 0; i < holds.length; i++) if (b >= holds[i].at - 1e-6) u += holds[i].extra; return u; };
  }
  // how long a line is, in beats: to where the next begins, or to its last note's end
  function spanBeats(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    var S = window.KOLOB && window.KOLOB.Score;
    if (S && S.lineLength) { try { var L = S.lineLength(line); if (L > 0) return L; } catch (e) {} }
    var e = 0;
    Object.keys(line.notes).forEach(function (p) { (line.notes[p] || []).forEach(function (n) { e = Math.max(e, n.beat + n.beats); }); });
    return e;
  }
  // a written length (in whole notes) → the glyph that writes it
  var WVAL = [[2, "breve"], [1.5, "w", 1], [1, "w"], [0.75, "h", 1], [0.5, "h"], [0.375, "q", 1], [0.25, "q"],
              [0.1875, "e", 1], [0.125, "e"], [0.09375, "s", 1], [0.0625, "s"]];
  function writtenValue(w) {
    var pick = null, i;
    for (i = 0; i < WVAL.length && !pick; i++) if (Math.abs(WVAL[i][0] - w) < 1e-3) pick = WVAL[i];
    for (i = 0; i < WVAL.length && !pick; i++) if (WVAL[i][0] <= w + 1e-3) pick = WVAL[i];   // (the plainest glyph under it)
    if (!pick) pick = WVAL[WVAL.length - 1];
    if (pick[1] === "breve") return { open: true, stem: false, breve: true, dots: 0, flags: 0 };
    return { open: pick[1] === "w" || pick[1] === "h", stem: pick[1] !== "w", dots: pick[2] || 0, flags: pick[1] === "e" ? 1 : pick[1] === "s" ? 2 : 0 };
  }
  // the dialect's voices, top to bottom: the upper two on the treble, the
  // lower two on the bass, the upper of each pair stems up
  function staffPlan(dialect) {
    var o = VOICE_ORDER[dialect] || ["S", "A", "T", "B"], out = {};
    out[o[0]] = { st: "T", dir: 1 }; out[o[1]] = { st: "T", dir: -1 };
    out[o[2]] = { st: "B", dir: 1 }; out[o[3]] = { st: "B", dir: -1 };
    return out;
  }
  // where a line begins and the beat it goes at, from its notes, when no
  // verse-line told it (the organ's giving-out): t = t0 + beat·units(b)
  function fitClock(ns, U, bs0) {
    var us = ns.map(function (n) { return U(n.beat); }), ts = ns.map(function (n) { return n.startTime; });
    var mu = 0, mt = 0, i, k = ns.length;
    if (!k) return null;
    for (i = 0; i < k; i++) { mu += us[i]; mt += ts[i]; }
    mu /= k; mt /= k;
    var cov = 0, vr = 0;
    for (i = 0; i < k; i++) { cov += (us[i] - mu) * (ts[i] - mt); vr += (us[i] - mu) * (us[i] - mu); }
    var bs = vr > 1e-6 ? cov / vr : bs0;
    if (!(bs > 0.05)) {                                 // one chord alone: its length says the beat
      var r = ns.map(function (n) { return n.duration / Math.max(0.25, n.beats || 1); }).sort(function (a, b) { return a - b; });
      bs = r[r.length >> 1];
    }
    if (!(bs > 0.05)) return null;
    return { t0: mt - bs * mu, bs: bs };
  }

  // One composed line, taken in whole: its notes (and the organ under
  // them), and its verse-line when it came. → true when it is engraved
  function takeHymnLine(entries, ev) {
    var first = ev || (entries[0] && entries[0].n);
    if (!first || !first.hymnId) return false;
    var h = hymnOf(first.hymnId), sc = h.score;
    var li = first.line, verse = first.verse, amen = !!first.amen, giving = !ev && !!first.givingOut;
    var vl = sc ? sc.lines.concat(sc.refrain || []) : null;
    var line = ev && ev.score ? ev.score : !sc ? null : amen ? sc.amen : giving ? sc.lines[li] : vl[li];
    if (!line || !line.notes) return false;
    if (!entries.some(function (x) { return !x.under; })) return true;   // the organ under a line no one here sings: nothing to print
    var next = amen || giving || !vl ? null : vl[li + 1] || null;
    var dialect = (ev && ev.dialect) || h.dialect || "tabernacle";
    var mode = h.mode || cond.mode;
    var keyM = (ev && ev.keyMonzo) || entries[0].n.keyMonzo || h.keyMonzo || [0, 0, 0, 0];
    var ts = timeSig(h.modeOfTime), bar0 = line.barStart || 0;
    var melody = h.melodyPart || MELODY_PART[dialect] || "S";
    var U = unitsOf(line), t0, bs;
    if (ev && ev.start != null && ev.beatS > 0) { t0 = ev.start; bs = ev.beatS; }
    else {
      var fit = fitClock(entries.map(function (x) { return x.n; }).filter(function (n) { return !n.octave; }), U, h.bs);
      if (!fit) return false;
      t0 = fit.t0; bs = fit.bs;
    }
    function T(b) { return t0 + U(b) * bs; }
    // the parts that sound: whoever sings them, and the organ under them
    var sounding = {}, np = 0;
    entries.forEach(function (x) {
      var p = x.n.layer === "organ" ? x.n.part : (x.n.sings || x.n.part);
      if (line.notes[p] && line.notes[p].length && !sounding[p]) { sounding[p] = 1; np++; }
    });
    if (!np) return false;
    var parts = Object.keys(sounding), multi = np > 1, plan = staffPlan(dialect), ks = keySteps(keyM);
    var layer = giving ? "organ" : "choir";
    var span = spanBeats(line, next), tEnd = T(span) + ((line.fermataBeats || []).length ? 0.3 * bs : 0);
    // a unison sits on the one staff it needs the fewest ledger lines on
    var single = null;
    if (!multi) {
      var cT = 0, cB = 0;
      line.notes[parts[0]].forEach(function (n) { cT += ledgerCost("T", Q_MID + ks + n.deg); cB += ledgerCost("B", Q_MID + ks + n.deg); });
      single = cT <= cB ? "T" : "B";
    }
    // the written notes — a note held over a barline is written as two,
    // tied across it (a note never crosses a barline)
    var W = [];
    function downbeatsIn(b, b1) {
      var out = [], d = b + (ts.bar - ((((b + bar0) % ts.bar) + ts.bar) % ts.bar));
      for (; d < b1 - 1e-6; d += ts.bar) if (d > b + 1e-6) out.push(d);
      return out;
    }
    parts.forEach(function (p) {
      var pl = plan[p] || { st: "T", dir: 1 }, ns = line.notes[p], tune = multi && p === melody;
      ns.forEach(function (n, j) {
        var q = Q_MID + ks + n.deg, st = single || pl.st, hop = false;
        if (!single) {                                  // (two ledgers into the gap at most: past that, the other staff —
          // but a step further, hanging under its second ledger, where the
          // other staff leaves the gap open then: deepOK, below. The TUNE
          // never crosses: a Sacred Harp tenor climbing to its high notes
          // stays on the bass staff on its third ledger, and a step over it,
          // its stem kept and shortened — the reader follows the melody on
          // one staff, as a closed-score hymnal prints it; only past that,
          // where its head would all but touch the other staff, does it go
          // over)
          var dT = tune ? TUNE_T : GAP_T - 1, dB = tune ? TUNE_B : GAP_B + 1;
          if (st === "T" && q < dT) { st = "B"; hop = true; }
          else if (st === "B" && q > dB) { st = "T"; hop = true; }
        }
        var cuts = [n.beat].concat(downbeatsIn(n.beat, n.beat + n.beats), [n.beat + n.beats]);
        for (var c = 0; c + 1 < cuts.length; c++) {
          var b = cuts[c], b1 = cuts[c + 1], last = c + 2 === cuts.length;
          W.push({ p: p, n: n, j: j, seg: c, b: b, b1: b1, q: q, st: st, hop: hop, dir: single || hop ? 0 : pl.dir,
                   w: (b1 - b) / ts.den, tp: T(b), dur: Math.max(0.05, T(b1) - T(b)),
                   heavy: tune, tied: c > 0 || (j > 0 && !!ns[j - 1].tie), tieOn: last ? !!n.tie : true,
                   head: null, grp: null });
        }
      });
    });
    // (a part a step deeper than two ledgers stays on its staff only if the
    // other staff has no note then reaching toward it; else it crosses)
    // (the tune past its second ledger stays unless a note of the other
    // staff then lies within a space and a half of it: two heads all but
    // touching across the gap, where it goes over after all)
    W.forEach(function (x) {
      if (single || x.hop || !x.heavy || !(x.st === "T" ? x.q < GAP_T - 1 : x.q > GAP_B + 1)) return;
      var other = x.st === "T" ? "B" : "T", ux = uOf(x.st, x.q);
      if (W.some(function (y) { return y.st === other && y.b < x.b1 - 1e-6 && y.b1 > x.b + 1e-6 && Math.abs(uOf(y.st, y.q) - ux) < 1.5; })) { x.st = other; x.hop = true; x.dir = 0; }
    });
    W.forEach(function (x) {
      var deep = x.st === "T" ? x.q < GAP_T : x.q > GAP_B;
      if (single || x.hop || !deep || x.heavy) return;
      var other = x.st === "T" ? "B" : "T", crowd = W.some(function (y) {
        return y !== x && y.st === other && y.b < x.b1 - 1e-6 && y.b1 > x.b + 1e-6 && (other === "B" ? y.q > Q_MID : y.q < Q_MID);
      });
      if (crowd) { x.st = other; x.hop = true; x.dir = 0; }
    });
    var win = ts.den === 8 ? 3 : 1;                    // the beat of the mode of time: a quarter, a half, or 6/8's dotted quarter
    function winOf(b) { return Math.floor((b + bar0) / win + 1e-6); }
    function mkHead(x, v) {
      var n = x.n, hd = { q: x.q, shape: shapeOfDeg(mode, n.deg), open: v.open, dots: v.dots, heavy: x.heavy };
      if (x.seg > 0) return hd;                      // (a tied continuation carries no signs)
      if (n.comma || n.septimal) hd.jm = { c: n.comma || 0, s7: !!n.septimal };
      if (n.ornament) hd.orn = n.ornament;
      if (n.ornament === "grace") hd.graceShape = shapeOfDeg(mode, n.deg + 1);   // (the grace is the step above: the performers' own)
      return hd;
    }
    var made = [], byGrpOn = {};
    ["T", "B"].forEach(function (st) {
      var xs = W.filter(function (x) { return x.st === st; });
      if (!xs.length) return;
      var voiceOf = {};
      xs.forEach(function (x) { if (!x.hop && x.dir) voiceOf[x.p] = x.dir; });
      var upper = null, lower = null;
      Object.keys(voiceOf).forEach(function (p) { if (voiceOf[p] > 0) upper = p; else lower = p; });
      var two = !!(upper && lower), together = {};
      if (two) {                                        // a beat through which the two voices move alike
        var on = {};
        xs.forEach(function (x) { if (x.hop) return; var k = winOf(x.b); (on[k] = on[k] || { U: [], L: [] })[x.p === upper ? "U" : "L"].push(x); });
        Object.keys(on).forEach(function (k) {
          var a = on[k].U, b = on[k].L;
          together[k] = a.length > 0 && a.length === b.length && a.every(function (x, i) {
            var y = b[i];
            return Math.abs(x.b - y.b) < 1e-6 && Math.abs(x.b1 - y.b1) < 1e-6 && x.tieOn === y.tieOn && (x.seg === 0 && !!x.n.fermata) === (y.seg === 0 && !!y.n.fermata);
          });
        });
      }
      var byOn = {};
      xs.forEach(function (x) { var k = Math.round(x.b * 1000); (byOn[k] = byOn[k] || []).push(x); });
      Object.keys(byOn).sort(function (a, b) { return a - b; }).forEach(function (k) {
        var here = byOn[k], sets = [];
        var tog = two && together[winOf(here[0].b)];
        here.forEach(function (x) {
          if (tog && !x.hop) {
            var s0 = sets.filter(function (s) { return s.voice === "both"; })[0];
            if (!s0) sets.push(s0 = { xs: [], voice: "both", dir: st === "T" ? 1 : -1 });
            s0.xs.push(x);
          } else sets.push({ xs: [x], voice: x.hop ? "hop" : two ? x.p : "one", dir: two && !x.hop ? x.dir : 0 });
        });
        // (the stem-down voice is set first: where the two lie a second
        // apart, the stem-up voice is the one moved over, as engravers do)
        sets.sort(function (a, b) { return (a.dir < 0 ? 0 : 1) - (b.dir < 0 ? 0 : 1); });
        var coAt = {};
        sets.forEach(function (set) {
          var v = writtenValue(set.xs[0].w), heads = [], seen = {}, dur = 0;
          set.xs.forEach(function (x) {
            dur = Math.max(dur, x.dur);
            if (seen[x.q]) { if (x.heavy) seen[x.q].heavy = true; x.head = seen[x.q]; return; }   // unison parts share a head
            x.head = seen[x.q] = mkHead(x, v);
            heads.push(x.head);
          });
          var grp = { layer: layer, tp: set.xs[0].tp, dur: dur, st: st, heads: heads, v: v, scale: 1, dir: set.dir,
                      noStem: !v.stem, flags: v.flags, hymn: true, voice: set.voice, win: winOf(set.xs[0].b), xs: set.xs, lead: 0,
                      tune: set.xs.some(function (x) { return x.heavy; }) };
          if (!grp.dir) grp.dir = posDir(heads, st);
          // two voices on one note of one length: one head, two stems (the lower voice's head is the upper's,
          // and goes where it goes: coOf)
          if (set.voice !== "both" && set.voice !== "hop" && set.voice !== "one" && heads.length === 1) {
            var ck = heads[0].q + "|" + v.open + "|" + v.dots;
            if (coAt[ck]) { heads[0].ghost = true; grp.noCol = true; grp.coOf = coAt[ck]; }
            else coAt[ck] = grp;
          }
          set.xs.forEach(function (x) { x.grp = grp; });
          groups.push(grp);
          made.push(grp);
          (byGrpOn[st + "|" + k] = byGrpOn[st + "|" + k] || []).push(grp);
        });
      });
      // accidentals: an altered degree, or its return, once in a bar
      var state = {};
      xs.slice().sort(function (a, b) { return a.b - b.b; }).forEach(function (x) {
        if (x.tied || !x.head || x.head.ghost) return;
        var key = Math.floor((x.b + bar0) / ts.bar + 1e-6) + ":" + x.q, alt = x.n.alt || 0, was = state[key] || 0;
        if (alt !== was) x.head.acc = alt > 0 ? "s" : alt < 0 ? "f" : "n";
        state[key] = alt;
      });
      // beams: one voice's quick notes, within one beat, with no rest between
      var runs = {};
      made.forEach(function (gp) { if (gp.st === st && gp.voice !== "hop") (runs[gp.voice + "|" + gp.win] = runs[gp.voice + "|" + gp.win] || []).push(gp); });
      Object.keys(runs).forEach(function (rk) {
        var gs = runs[rk].sort(function (a, b) { return a.tp - b.tp; }), cur = [];
        function close() { if (cur.length >= 2) makeBeam(cur, st); cur = []; }
        gs.forEach(function (gp) {
          if (gp.flags >= 1 && gp.v.stem) {
            var last = cur[cur.length - 1];
            if (last && Math.abs(last.xs[0].b1 - gp.xs[0].b) > 1e-6) close();
            cur.push(gp);
          } else close();
        });
        close();
      });
    });
    // how far each group's ink reaches left of its head (a barline stands clear of it)
    made.forEach(function (gp) {
      var lead = 0.64;
      gp.heads.forEach(function (hd) {
        var l = 0.64 + (hd.acc ? 1.25 : 0) + (TUNING_MARKS && hd.jm ? 0.85 * ((hd.jm.c ? 1 : 0) + (hd.jm.s7 ? 1 : 0)) : 0) + (hd.orn === "grace" || hd.orn === "slide" ? 1.3 : 0);
        lead = Math.max(lead, l);
      });
      gp.lead = lead;
    });
    // the staves this line prints on
    var sts = {};
    W.forEach(function (x) { sts[x.st] = 1; });
    var stList = ["T", "B"].filter(function (s) { return sts[s]; });
    var sys = { hymnId: h.id, tp: t0, tp1: tEnd };
    // rests, where a part that sings in this line is silent (they join the
    // page after the bars, so a rest just after a barline is set from it)
    var restAt = {}, restMarks = [];
    parts.forEach(function (p) {
      var ns = line.notes[p], t = 0, gaps = [];
      ns.forEach(function (n) { if (n.beat > t + 1e-6) gaps.push([t, n.beat]); t = Math.max(t, n.beat + n.beats); });
      if (span > t + 1e-6) gaps.push([t, span]);
      var st = single || (plan[p] || { st: "T" }).st, dir = single ? 0 : (plan[p] || { dir: 0 }).dir;
      var both = !single && parts.some(function (o) { return o !== p && (plan[o] || {}).st === st; });
      gaps.forEach(function (gp) {
        var a = gp[0];
        while (a < gp[1] - 1e-6) {
          var into = (((a + bar0) % ts.bar) + ts.bar) % ts.bar, nb = a + (ts.bar - into);
          var e = Math.min(gp[1], nb), whole = (e - a) / ts.den, full = Math.abs((e - a) - ts.bar) < 1e-6;
          (full ? [{ v: 1, at: 0, full: true }] : splitRest(whole)).forEach(function (r) {
            var ra = a + r.at * ts.den, re = full ? e : ra + r.v * ts.den, key = st + "|" + Math.round(ra * 1000) + "|" + r.v;
            var voice = both ? (dir > 0 ? "U" : "L") : "C";
            if (restAt[key]) { if (restAt[key].voice !== voice) { restAt[key].voice = "C"; restAt[key].q = restQ(st, full ? 1 : r.v, "C", null); } return; }
            // (a voice's rest stands clear of the other voice's notes sounding over it)
            var qs = W.filter(function (x) { return x.st === st && x.p !== p && x.b < re - 1e-6 && x.b1 > ra + 1e-6; }).map(function (x) { return x.q; });
            restMarks.push(restAt[key] = { kind: "rest", tp: T(ra), st: st, v: r.v, full: !!r.full, voice: voice, q: restQ(st, full ? 1 : r.v, voice, qs), sys: sys });
          });
          a = e;
        }
      });
    });
    // barlines: every downbeat inside the line, and the line's end
    var lastLine = !amen && !giving && vl && li === vl.length - 1;
    var final = amen || (lastLine && !(sc && sc.amen) && typeof h.verses === "number" && verse === h.verses - 1);
    // (each bar knows the notes either side of it, so that on a crowded
    // page it stands between their inks: drawHymnBar — before it, every note
    // begun in the two seconds before it whose ink might reach it: a quarter
    // stemmed up beside the beamed eighths of the other voice as much as the
    // last eighth)
    function before(bb) {
      var tb = T(bb);
      return made.filter(function (gp) { return gp.xs[0].b < bb - 1e-6 && gp.tp > tb - 2; });
    }
    // (and the rests just before it: their ink is the bar's to clear too)
    function restsBefore(tb) { return restMarks.filter(function (r) { return r.tp < tb - 1e-6 && r.tp > tb - 4; }); }
    var b = (ts.bar - (bar0 % ts.bar)) % ts.bar;
    if (b < 1e-6) b = ts.bar;
    for (; b < span - 1e-6; b += ts.bar) {
      var lead = 0, nx = [];
      stList.forEach(function (st) { (byGrpOn[st + "|" + Math.round(b * 1000)] || []).forEach(function (gp) { lead = Math.max(lead, gp.lead); nx.push(gp); }); });
      var bm = { kind: "bar", type: "single", tp: T(b), sts: stList, off: lead ? -(lead + 0.55) : 0, pv: before(b), pvRests: restsBefore(T(b)), nx: nx, sys: sys };
      // the notes on the downbeat make room for their bar if they must (placeColumn),
      // and a rest there stands after it
      nx.forEach(function (gp) { gp.barIn = bm; });
      restMarks.forEach(function (r) { if (Math.abs(r.tp - bm.tp) < 1e-6) r.barIn = bm; });
      marks.push(bm);
    }
    // (the double bar stands just before the next line's first note; the
    // final bar where the last note's written length ends)
    var endBar = { kind: "bar", type: final ? "final" : "double", tp: final ? T(span) : tEnd, sts: stList, off: final ? 0 : -1.35, pv: before(span + 1), pvRests: restsBefore(T(span) + 1e-3), nx: null, sys: sys };
    marks.push(endBar);
    restMarks.forEach(function (r) { marks.push(r); });
    // the line before's double bar learns this line's first notes: it stands
    // clear of them too (they make room for it, as for any bar)
    var le = lastEndBar;
    if (le && le.sys.hymnId === h.id && t0 - le.tp > -1.5 && t0 - le.tp < 4 && made.length) {
      var fb0 = Math.min.apply(null, made.map(function (gp) { return gp.xs[0].b; }));
      le.nx = made.filter(function (gp) { return Math.abs(gp.xs[0].b - fb0) < 1e-6 && !gp.barIn; });
      le.nx.forEach(function (gp) { gp.barIn = le; });
    }
    lastEndBar = final ? null : endBar;
    // fermatas: over the treble, under the bass (over a unison)
    var fbs = {};
    W.forEach(function (x) { if (x.n.fermata && x.seg === 0) fbs[Math.round(x.b * 1000)] = x.b; });
    (line.fermataBeats || []).forEach(function (fb) { fbs[Math.round(fb * 1000)] = fb; });
    Object.keys(fbs).forEach(function (k) {
      stList.forEach(function (st) {
        var gs = byGrpOn[st + "|" + k], up = single ? true : st === "T";
        if (!gs || !gs.length) return;
        gs.forEach(function (gp) { gp.ferm = up ? 1 : -1; });   // (its stem leaves the fermata room at the plate's edge)
        marks.push({ kind: "ferm", tp: T(fbs[k]), st: st, up: up, grps: gs, sys: sys });
      });
    });
    // ties, and the slur over a melisma of the tune
    parts.forEach(function (p) {
      var xs = W.filter(function (x) { return x.p === p; }).sort(function (a, b) { return a.b - b.b; });
      xs.forEach(function (x, i) {
        var y = xs[i + 1];
        if (x.tieOn && y && x.grp && y.grp && x.st === y.st) marks.push({ kind: "tie", tp: x.tp, tp2: y.tp, g1: x.grp, g2: y.grp, q1: x.q, q2: y.q, st: x.st, sys: sys });
      });
      if (p !== melody) return;
      function cont(x) { return x.n.syl == null || x.seg > 0; }   // (a melisma's later notes; a tied note's continuation)
      for (var i = 0; i < xs.length; i++) {
        if (cont(xs[i])) continue;
        var j = i;
        while (j + 1 < xs.length && cont(xs[j + 1])) j++;
        var allTied = true;
        for (var k2 = i; k2 < j; k2++) if (!xs[k2].tieOn) allTied = false;
        if (j > i && !allTied && xs[i].st === xs[j].st) marks.push({ kind: "slur", tp: xs[i].tp, tp2: xs[j].tp, g1: xs[i].grp, g2: xs[j].grp, q1: xs[i].q, q2: xs[j].q, st: xs[i].st, sys: sys });
        i = j;
      }
    });
    shareRoom(made);
    if (!giving) wardSpans.push({ tp0: t0, tp1: tEnd });
    if (wardSpans.length > 60) wardSpans.splice(0, wardSpans.length - 60);
    return true;
  }
  // Where a rest stands on its staff (its anchor, in steps): the whole
  // rest hangs from the fourth line, the half sits on the middle line, the
  // others on the middle line; a voice's own rest, when two share the
  // staff, is raised (the upper voice's) or lowered (the lower's) a line,
  // and further if the other voice's notes over it would touch it.
  var REST_EXT = { rest1: [-1, 0], rest2: [0, 1], rest4: [-3, 3], rest8: [-2, 1.5], rest16: [-3, 1.5] };   // [below, above] the anchor, in steps
  function restName(v) { return (REST_OF[v] || REST_OF[0.25])[0]; }
  function restQ(st, v, voice, qs) {
    var nm = restName(v), mid = st === "T" ? 16 : 4, ext = REST_EXT[nm], onLine = nm === "rest1" || nm === "rest2";
    var q = (nm === "rest1" ? mid + 2 : mid) + (voice === "U" ? 2 : voice === "L" ? -2 : 0);
    if (qs && qs.length) {
      if (voice === "U") { var lo = Math.max.apply(null, qs) + 2 - ext[0]; if (q < lo) q = onLine ? Math.ceil(lo / 2) * 2 : Math.ceil(lo); }
      if (voice === "L") { var hi = Math.min.apply(null, qs) - 2 - ext[1]; if (q > hi) q = onLine ? Math.floor(hi / 2) * 2 : Math.floor(hi); }
    }
    return q;
  }
  // The gap between the staves, shared out note by note: a treble stem may
  // reach down into it as far as the bass's ink at that moment allows (and
  // a bass stem up as far as the treble's). Where both staves send a stem
  // into the gap at once, the gap is divided between them (shareGap):
  // at the telegraph's line, as round 2.5 had it, when both stems fit;
  // else moved so that each keeps a stem — the tune's first
  function shareRoom(made) {
    made.forEach(function (gp) {
      gp.gapIn = !!(gp.v.stem && (gp.st === "T" ? gp.dir < 0 : gp.dir > 0));
      gp.uNear = null;
      gp.heads.forEach(function (hd) { var u = uOf(gp.st, hd.q); gp.uNear = gp.uNear == null ? u : gp.st === "T" ? Math.min(gp.uNear, u) : Math.max(gp.uNear, u); });
    });
    // (a beam's notes share one stem height: each asks for room from the
    // beam's head nearest the gap, and a little more, for the beam itself)
    made.forEach(function (gp) {
      if (!gp.beam || gp.beam.shared) return;
      var bm = gp.beam, u = null;
      bm.shared = true;
      bm.members.forEach(function (m) { if (m.uNear != null) u = u == null ? m.uNear : bm.st === "T" ? Math.min(u, m.uNear) : Math.max(u, m.uNear); });
      bm.members.forEach(function (m) { m.uNear = u; m.want = GAP_WANT + 0.4; });
    });
    made.forEach(function (gp) {
      var other = gp.st === "T" ? "B" : "T", qx = null, facing = [];
      made.forEach(function (o2) {
        if (o2.st !== other || Math.abs(o2.tp - gp.tp) > 0.35) return;
        if (o2.gapIn) facing.push(o2);
        o2.heads.forEach(function (hd) { qx = qx == null ? hd.q : other === "B" ? Math.max(qx, hd.q) : Math.min(qx, hd.q); });
      });
      gp.room = { q: qx, div: null };
      if (!gp.gapIn) return;
      facing.forEach(function (o2) {
        var d = gp.st === "T" ? shareGap(gp, o2) : shareGap(o2, gp);
        if (d == null) return;
        if (gp.room.div == null) gp.room.div = d;
        else gp.room.div = gp.st === "T" ? Math.max(gp.room.div, d) : Math.min(gp.room.div, d);
      });
    });
  }
  // Heights in the gap, in staff spaces over the bass staff's top line: the
  // treble's bottom line at 5, the telegraph's holes at 2.5. (The same at
  // every staff size, so a line's sharing of the gap is worked out once.)
  function uOf(st, q) { return st === "T" ? 5 + (q - 12) / 2 : (q - 8) / 2; }
  // Two stems in the gap at once, the treble's down (tg) and the bass's up
  // (bg): where they divide it (a height each stays 0.3 sp clear of), or
  // null when they do not meet — each then runs as far as the other staff's
  // heads allow, beside the other's stem if they pass. The division is the
  // telegraph's line where both keep a stem there; else it moves toward the
  // one that has room to give, the tune keeping at least 2.2 sp of stem (2.6
  // under a beam, its want) and the other voice at least 1.3; where even
  // that will not fit, the tune has
  // what it needs and the other voice what is left (layoutGroup turns an
  // other voice's stem that is left under 1.3 sp; the tune's never turns).
  var GAP_WANT = 2.2, GAP_MIN = 1.3;
  function shareGap(tg, bg) {
    var uT = tg.uNear, uB = bg.uNear;
    var eT = Math.max(uT - 3.5, uB + 0.95, 0.45), eB = Math.min(uB + 3.5, uT - 0.95, 4.55);
    if (eB + 0.6 <= eT) return null;
    var lo = uB + (bg.tune ? bg.want || GAP_WANT : GAP_MIN) + 0.3, hi = uT - (tg.tune ? tg.want || GAP_WANT : GAP_MIN) - 0.3;
    if (lo <= hi) return clamp(2.5, lo, hi);
    var lo2 = uB + GAP_MIN + 0.3, hi2 = uT - GAP_MIN - 0.3;   // (no room for the tune's 2.2: all the other voice can give)
    if (lo2 > hi2) return null;
    return bg.tune ? hi2 : lo2;
  }
  // a silent stretch as rests, in whole-note units (the plainest values,
  // largest first: hymn-lab's)
  function splitRest(w) {
    var V = [1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125, 0.0625], out = [], at = 0;
    while (w > 1e-6) {
      var v = V.filter(function (x) { return x <= w + 1e-6; })[0];
      if (!v) break;
      out.push({ v: v, at: at }); at += v; w -= v;
    }
    return out;
  }
  // a beam: the groups it joins, and the stem it turns them to — a voice's
  // own where two share the staff apart, the shared one where they move
  // together, else the position rule over the whole group
  function makeBeam(gs, st) {
    var v = gs[0].voice, bm = { members: gs.slice(), st: st, fixed: v === "one" ? 0 : gs[0].dir, geo: null };
    gs.forEach(function (gp) { gp.beam = bm; });
  }
  // The fuging between the verses: the voices go out one by one on the
  // tune's first notes, a few seconds apart, and gather into the dialect's
  // close. Its entries come by the second, not by the bar (the engine
  // staggers them 2.4–3.2 s), so the page prints it as a hymnal prints a
  // free passage: no barlines inside it; each voice's notes at their
  // written values in the verse's own beat, its quick notes beamed within
  // its beat; the voices in closed score as in the verses (the stems by
  // part, the tune's heads heavier); the close as two chords in whole
  // notes, a fermata over the last, and a double bar after it. → false
  // while the hymn's beat is not known (the old reading then prints it)
  function takeFuging(ns) {
    var h = hymnBook[ns[0].hymnId];
    if (!h || !(h.bs > 0.05)) return false;
    var bs = h.bs, ts = timeSig(h.modeOfTime), dialect = h.dialect || "tabernacle", plan = staffPlan(dialect);
    var melody = h.melodyPart || MELODY_PART[dialect] || "S", win = ts.den === 8 ? 3 : 1;
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    function partOf(n) { return n.sings || n.part; }
    function onKey(n) { return Math.round(n.startTime * 50); }
    // the close: the chords at its end, where the voices sing together
    var ons = [], byOn = {};
    ns.forEach(function (n) { var k = onKey(n); if (!byOn[k]) { byOn[k] = []; ons.push(k); } byOn[k].push(n); });
    var close = {}, nClose = 0;
    for (var i = ons.length - 1; i >= 0 && nClose < 2 && byOn[ons[i]].length >= 2; i--) { close[ons[i]] = ++nClose; }
    var parts = {};
    ns.forEach(function (n) { parts[partOf(n)] = 1; });
    var multi = Object.keys(parts).length > 1, made = [], t0 = ns[0].startTime, tEnd = t0;
    ns.forEach(function (n) { tEnd = Math.max(tEnd, n.startTime + n.duration); });
    var sys = { hymnId: h.id, tp: t0, tp1: tEnd };
    function placeOf(n, tune, pl) {                  // its staff and step (the tune keeps its staff, as in the verses)
      var tq = taggedQ(n) || noteQ(n.freq), st = pl.st, hop = false;
      if (multi) {
        if (st === "T" && tq.q < (tune ? TUNE_T : GAP_T - 1)) { st = "B"; hop = true; }
        else if (st === "B" && tq.q > (tune ? TUNE_B : GAP_B + 1)) { st = "T"; hop = true; }
      }
      return { q: tq.q, shape: tq.shape, st: st, hop: hop };
    }
    // each voice's entry, beamed in the entry's own beat
    var byPart = {};
    ns.forEach(function (n) { if (!close[onKey(n)]) (byPart[partOf(n)] = byPart[partOf(n)] || []).push(n); });
    Object.keys(byPart).forEach(function (p) {
      var pl = plan[p] || { st: "T", dir: 1 }, tune = multi && p === melody, e0 = byPart[p][0].startTime, run = [];
      byPart[p].forEach(function (n) {
        var at = placeOf(n, tune, pl), beats = Math.max(0.25, Math.round(n.duration / bs * 4) / 4), v = writtenValue(beats / ts.den);
        var grp = { layer: n.layer, tp: n.startTime, dur: n.duration, st: at.st, heads: [{ q: at.q, shape: at.shape, open: v.open, dots: v.dots, heavy: tune }],
                    v: v, scale: 1, dir: at.hop || !multi ? 0 : pl.dir, noStem: !v.stem, flags: v.flags, hymn: true,
                    voice: at.hop ? "hop" : multi ? p : "one", win: Math.floor((n.startTime - e0) / bs / win + 1e-6), tune: tune, lead: 0 };
        if (!grp.dir) grp.dir = posDir(grp.heads, at.st);
        groups.push(grp); made.push(grp);
        var last = run[run.length - 1], quick = grp.flags >= 1 && grp.v.stem && !at.hop;
        if (quick && last && last.win === grp.win && last.st === grp.st && Math.abs(last.tp + last.dur - grp.tp) < 0.05) run.push(grp);
        else { if (run.length >= 2) makeBeam(run, run[0].st); run = quick ? [grp] : []; }
      });
      if (run.length >= 2) makeBeam(run, run[0].st);
    });
    // the close: on each staff, its voices' heads together
    var wv = writtenValue(1), lastGs = [];
    ons.forEach(function (k) {
      if (!close[k]) return;
      var onSt = {};
      byOn[k].forEach(function (n) {
        var p = partOf(n), pl = plan[p] || { st: "T", dir: 1 }, tune = multi && p === melody, at = placeOf(n, tune, pl);
        var o = onSt[at.st] = onSt[at.st] || { heads: [], ps: {}, dur: 0, tp: n.startTime };
        o.ps[p] = pl.dir; o.dur = Math.max(o.dur, n.duration);
        var same = o.heads.filter(function (hd) { return hd.q === at.q; })[0];
        if (same) { if (tune) same.heavy = true; return; }
        o.heads.push({ q: at.q, shape: at.shape, open: true, dots: 0, heavy: tune });
      });
      var gs = [];
      Object.keys(onSt).forEach(function (st) {
        var o = onSt[st], two = Object.keys(o.ps).length > 1;
        var grp = { layer: byOn[k][0].layer, tp: o.tp, dur: o.dur, st: st, heads: o.heads, v: wv, scale: 1, dir: two ? (st === "T" ? 1 : -1) : 0,
                    noStem: true, flags: 0, hymn: true, voice: two ? "both" : "one", win: 0, tune: o.heads.some(function (hd) { return hd.heavy; }), lead: 0 };
        if (!grp.dir) grp.dir = posDir(o.heads, st);
        groups.push(grp); made.push(grp); gs.push(grp);
      });
      if (close[k] === 1) lastGs = gs;           // (the last chord: numbered from the end)
    });
    lastGs.forEach(function (gp) {
      gp.ferm = gp.st === "T" ? 1 : -1;
      marks.push({ kind: "ferm", tp: gp.tp, st: gp.st, up: gp.st === "T", grps: [gp], sys: sys });
    });
    shareRoom(made);
    // the double bar after the close (and before the verse that follows)
    var sts = {};
    made.forEach(function (gp) { sts[gp.st] = 1; });
    var tLast = lastGs.length ? lastGs[0].tp : t0;
    var endBar = { kind: "bar", type: "double", tp: tEnd, sts: ["T", "B"].filter(function (st) { return sts[st]; }), off: -1.35,
                   pv: made.filter(function (gp) { return gp.tp >= tLast - 1e-6; }), pvRests: [], nx: null, sys: sys };
    marks.push(endBar);
    lastEndBar = endBar;
    wardSpans.push({ tp0: t0, tp1: tEnd });
    return true;
  }
  // The organ alone. Its notes are printed only where no one sings over
  // them — under a composed line of the ward, or under the choir's own
  // singing, the organ doubles what the page already shows (as a hymnal
  // prints no accompaniment). Decided once, when the note is first reached.
  function organAlone(gr) {
    for (var i = 0; i < wardSpans.length; i++) if (gr.tp >= wardSpans[i].tp0 - 0.3 && gr.tp <= wardSpans[i].tp1 + 0.3) return false;
    for (i = 0; i < groups.length; i++) {
      var o = groups[i];
      if (!CHOIR_LAYERS[o.layer] || o.ring) continue;
      if (o.tp <= gr.tp + 0.25 && o.tp + o.dur >= gr.tp - 0.05) return false;
    }
    return true;
  }

  // Beyond the ledger room a group folds in silently by octaves until it
  // fits the plate (no 8va: the owner wants just the notes). The fold is
  // decided at draw time, so a resize re-folds it. A voice that keeps above
  // the ledger room keeps its shape: a note that would fold less than the
  // voice's last folded note, close behind it, folds as far (if it still
  // sits on or near the staff). The Question's asking folds as one phrase.
  // The gap is the telegraph's: no stem ever crosses its middle. So a fold
  // never carries a head into the gap (nothing is lifted over the bass
  // staff's ledger-free space, q9, or sunk under the treble's, q11), and a
  // head that would sit more than two ledgers into the gap, on the
  // telegraph's line (a part kept on its own staff: a trombone tenor high
  // over the bass staff), folds back toward its staff. When folding a
  // whole chord would carry a head into the gap (a trombone chord whose
  // bass drops under the plate while its tenor sits high), or a head lies
  // too deep in it, the chord folds head by head, each only as far as it
  // needs: the tenor stays where it is and the bass comes up an octave.
  var lastFold = {};
  var FOLD_B = 9, FOLD_T = 11;                     // no fold carries a head past these into the gap
  function foldFor(grp, g) {
    if (grp.fold && grp.fold.sp === g.sp) return grp.fold;
    var hi = -1e9, lo = 1e9, sh = 0, tr = grp.st === "T";
    grp.heads.forEach(function (h) { hi = Math.max(hi, h.q); lo = Math.min(lo, h.q); });
    // (a composed hymn's note may hang a step under the second ledger: its
    // line knew the other staff left room there — takeHymnLine; its tune
    // goes a step past the third)
    var gT = grp.hymn ? (grp.tune ? TUNE_T : GAP_T - 1) : GAP_T, gB = grp.hymn ? (grp.tune ? TUNE_B : GAP_B + 1) : GAP_B;
    var deep = tr ? lo < gT : hi > gB;             // a head on the telegraph's line
    if (grp.askMax != null) hi = Math.max(hi, grp.askMax);
    if (tr) { while (hi - sh > g.qMaxT) sh += 7; }
    else { while (lo + sh < g.qMinB) sh += 7; }
    var key = grp.layer + grp.st, lf = lastFold[key];
    if (sh && lf && lf.sp === g.sp && grp.tp - lf.tp1 < 1.2 && lf.sh > sh &&
        (tr ? lo - lf.sh >= 9 : hi + lf.sh <= 11)) sh = lf.sh;
    var per = null;
    if (deep || (sh && (tr ? lo - sh < FOLD_T : hi + sh > FOLD_B))) {
      per = []; sh = 0;                            // head by head: only a head off the plate, or too deep in the gap, folds
      grp.heads.forEach(function (h) {
        var d = 0;                                 // this head's move, in steps (up +)
        if (tr) { while (h.q + d > g.qMaxT) d -= 7; while (h.q + d < gT) d += 7; }
        else { while (h.q + d < g.qMinB) d += 7; while (h.q + d > gB) d -= 7; }
        per.push(d);
        sh = Math.max(sh, tr ? -d : d);            // (the voice's shape follows the plate-edge folds only)
      });
      if (!per.some(function (d) { return d; })) per = null;
    }
    if (sh) lastFold[key] = { sp: g.sp, sh: sh, tp1: grp.tp + grp.dur };
    grp.fold = { sp: g.sp, oct: per ? 0 : sh / 7, per: per, heads: null };
    return grp.fold;
  }
  // the heads as they print, folded (two parts folded onto one line print
  // one head)
  function drawnHeads(grp, g) {
    var f = foldFor(grp, g);
    if (!f.oct && !f.per) return grp.heads;
    if (f.heads) return f.heads;
    var dq = grp.st === "T" ? -7 : 7, seen = {}, out = [];
    grp.heads.forEach(function (h, i) {
      var q = h.q + (f.per ? f.per[i] : dq * f.oct);
      if (seen[q]) return;
      seen[q] = 1;
      var c = {};
      for (var k in h) c[k] = h[k];                // (its weight, its marks, its ornament go with it)
      c.q = q;
      out.push(c);
    });
    f.heads = out;
    return out;
  }

  // ---- the telegraph ------------------------------------------------------------
  function takeTape(n) {
    var U = 1e9;
    n.marks.forEach(function (m) { if (m.len > 0) U = Math.min(U, m.len); });
    if (!(U < 1e8)) U = 0.08;
    var last = n.marks[n.marks.length - 1];
    // each hole keeps the time it is punched, and dries from it like a note
    var marks = n.marks.map(function (m) { return { at: m.at, len: m.len, dah: !!m.dah, tp: n.startTime + m.at + m.len }; });
    tapes.push({ tp: n.startTime, marks: marks, U: U, Tt: last.at + last.len });
    if (tapes.length > 12) tapes.shift();
  }
  // ---- the Question ---------------------------------------------------------------
  // The clarinet's askings arrive in the same call that raises "? the
  // question": each unbroken run of its notes is one asking, framed in a
  // cartouche. The harmonium's answers (same call) print as grace notes.
  function takeQuestion(clar, ev) {
    var ns = clar.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var asks = [], cur = null;
    ns.forEach(function (n) {
      if (cur && n.startTime - cur.t1 < 0.08) { cur.t1 = n.startTime + n.duration; cur.n++; }
      else { cur = { t0: n.startTime, t1: n.startTime + n.duration, n: 1 }; asks.push(cur); }
    });
    asks = asks.filter(function (a) { return a.n >= 2; });
    var qn = { asks: asks.map(function (a) { return { tp0: a.t0, tp1: a.t1 }; }), na: null,
               lastEnd: asks.length ? asks[asks.length - 1].t1 : (ev.t || audioNow()) };
    questions.push(qn);
    if (questions.length > 4) questions.shift();
  }
  function takeUnanswered(ev) {
    var tp = ev.t || audioNow(), qn = questions[questions.length - 1];
    var start = qn && !qn.na && Math.abs(tp - qn.lastEnd) < 40 ? qn.lastEnd + 0.9 : tp - 0.6;
    if (!qn || qn.na) { qn = { asks: [], lastEnd: start }; questions.push(qn); }
    qn.na = { tp0: start, tp1: start + 6 };
  }
  // ---- the band -------------------------------------------------------------------
  // Round notes on their own layer, sliding through the ward's page
  // at the band's own (quicker) rate; ink follows its approach and recession.
  function takeBand(ns) {
    ns.sort(function (a, b) { return a.startTime - b.startTime; });
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: ns[ns.length - 1].startTime + ns[ns.length - 1].duration, bass: [] };
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }   // the fife is written an octave under its sound
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel) bd.bass.push({ tp: nb.tp });              // its barlines fall on the oom
      bandNotes.push(nb);
    });
    visits.push(bd);
    if (visits.length > 3) visits.shift();
  }

  // ---- drawing helpers ------------------------------------------------------------
  function snapRect(c, x, y, w, h) {
    var r = dpr, x0 = Math.round(x * r), y0 = Math.round(y * r);
    var x1 = Math.max(x0 + 1, Math.round((x + w) * r)), y1 = Math.max(y0 + 1, Math.round((y + h) * r));
    c.fillRect(x0 / r, y0 / r, (x1 - x0) / r, (y1 - y0) / r);
  }
  function hLine(c, x0, x1, y, th) { snapRect(c, x0, y - th / 2, x1 - x0, th); }
  function vLine(c, x, y0, y1, th) { snapRect(c, x - th / 2, Math.min(y0, y1), th, Math.abs(y1 - y0)); }
  function drawSprite(c, sp, x, y) {
    c.drawImage(sp.cv, Math.round(x * dpr - sp.o) / dpr, Math.round(y * dpr - sp.o) / dpr, sp.cv.width / dpr, sp.cv.height / dpr);
  }
  function ledgersFor(st, q) {
    var out = [], l;
    if (st === "T") { for (l = 10; l >= q; l -= 2) out.push(l); for (l = 22; l <= q; l += 2) out.push(l); }
    else { for (l = 10; l <= q; l += 2) out.push(l); for (l = -2; l >= q; l -= 2) out.push(l); }
    return out;
  }
  // the ink dries: ~3 %/s of page time, far faster in the sacrament (and
  // an item's own dry, when it has one, faster again: the old tune's). An
  // item is anchored at its onset (tp, or tp0 for the spans: an asking, the
  // empty measure, the band's visit); one first drawn late is credited its age.
  function dryA(it) {
    if (it.d0 == null) it.d0 = DRY - Math.max(0, PT - (it.tp != null ? it.tp : it.tp0));
    return Math.exp(-0.03 * (it.dry || 1) * Math.max(0, DRY - it.d0));
  }
  // a rounded rectangle, also where the canvas has no roundRect (Safari < 16)
  function rrect(c, x, y, w, h, r) {
    if (typeof c.roundRect === "function") { c.roundRect(x, y, w, h, r); return; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  // The telegraph yields to the music: while a message is on the page,
  // every head, ledger, stem, dot and bell ring that lands in the middle of
  // the gap records a clearance here (at its own ink's strength), and no
  // hole is punched where one lies.
  var KO = [], koY0 = 0, koY1 = -1, KO_PAD = 0.3;
  function koHit(y0, y1) { return y1 > koY0 && y0 < koY1; }
  function koRect(c, x0, y0, x1, y1) {
    if (koHit(y0, y1)) KO.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, a: c.globalAlpha });
  }
  function koEllipse(c, x, y, rx, ry) {
    if (koHit(y - ry, y + ry)) KO.push({ e: 1, x: x, y: y, rx: rx, ry: ry, a: c.globalAlpha });
  }
  function koCovers(x0, y0, x1, y1) {              // does any visible note's clearance touch this box?
    for (var i = 0; i < KO.length; i++) {
      var k = KO[i];
      if (k.a < 0.02) continue;
      var kx0 = k.e ? k.x - k.rx : k.x, kx1 = k.e ? k.x + k.rx : k.x + k.w;
      var ky0 = k.e ? k.y - k.ry : k.y, ky1 = k.e ? k.y + k.ry : k.y + k.h;
      if (kx0 < x1 && x0 < kx1 && ky0 < y1 && y0 < ky1) return true;
    }
    return false;
  }
  function text(c, str, x, y, font, rgb, a, align) {
    c.font = font; c.textAlign = align || "left"; c.textBaseline = "alphabetic";
    c.fillStyle = rgba(rgb, a == null ? 1 : a);
    c.fillText(str, x, y);
    return c.measureText(str).width;
  }

  // How far into the gap a stem from staff st may reach (a y): its own half
  // of the gap (the telegraph's line, less a little air); or, for a hymn's
  // note whose moment the other staff leaves open (room: the other staff's
  // nearest head then, or none), as far as that head allows, short of the
  // other staff's own lines.
  function gapLimit(g, st, room) {
    var sp = g.sp, y;
    if (!room) return st === "T" ? g.tapeY - 0.3 * sp : g.tapeY + 0.3 * sp;
    if (st === "T") {
      y = room.q != null ? Math.min(g.B - 0.45 * sp, g.yB(room.q) - 0.95 * sp) : g.B - 0.45 * sp;
      if (room.div != null) y = Math.min(y, g.B - (room.div + 0.3) * sp);     // (the gap divided with a bass stem: shareGap)
      return y;
    }
    y = room.q != null ? Math.max(g.Tb + 0.45 * sp, g.yT(room.q) + 0.95 * sp) : g.Tb + 0.45 * sp;
    if (room.div != null) y = Math.max(y, g.B - (room.div - 0.3) * sp);
    return y;
  }
  // a group of heads on one stem (a chord, or a single note): where its
  // heads and stem fall. Shared by drawGroup and the column check.
  function layoutGroup(g, X, heads, st, dir, o) {
    var sp = g.sp, sc = o.scale || 1, s = sp * sc, th = o.thin || 1;   // thin: a finer burin (the old tune)
    var sw = Math.max((th < 1 ? 1 : 1.4) / dpr, 0.12 * sp * (sc < 1 ? 0.85 : 1) * th);
    var hs = heads.slice().sort(function (a, b) { return a.q - b.q; });
    var stem = dir !== 0 && !o.noStem;
    // A stem never crosses the middle of the gap, where the other staff's
    // stems and the telegraph's holes lie: one reaching into the gap stops
    // short of it, and one whose head already lies too near it to grow a
    // stem there turns away from the gap instead (a tenor high over the
    // bass staff, an alto deep under the treble). (Round 3b: a composed
    // hymn's note may reach further where the other staff leaves the gap
    // open at that moment — gapLimit, o.room.) Before that, a voice's own
    // stem (o.alt: the position rule's way) that the plate's edge or the gap
    // would cut under 3 sp past its head turns the position rule's way, if
    // that stem grows longer. (Round 3b, round 2: where both staves send a
    // stem into the gap at once, the line has divided it between them —
    // shareGap — at the telegraph's line when both fit, else nearer the
    // voice with room to give, the tune's stem first.)
    var gapPad = 0.3 * sp, mid = g.mid(st);
    var yHi = g.y(st, hs[hs.length - 1].q), yLo = g.y(st, hs[0].q);
    // (o.keep: a voice of a closed score — the alto under a soprano, the
    // tenor over a bass — keeps its own stem even near the gap: shortened
    // there, down to 1.3 sp past its head, rather than turned into the
    // other voice's. o.tune: the tune's own stem is never turned — a Sacred
    // Harp tenor high over the bass staff keeps its stem up, as short as the
    // gap leaves it, down to 1 sp)
    var minS = o.tune ? 1.0 : o.keep ? 1.3 : 2.2, gapY = gapLimit(g, st, o.room);
    function stemEnd(d) {                          // where a stem turned d ends
      var ye;
      // (o.ferm: a fermata stands beyond this stem — over the treble, under
      // the bass — and the plate's edge must hold both)
      var edgeT = g.top + (o.ferm > 0 ? 1.65 : 0.3) * sp, edgeB = g.bot - (o.ferm < 0 ? 1.65 : 0.3) * sp;
      if (d > 0) {
        ye = Math.min(yHi - 3.5 * s, mid);
        ye = Math.max(ye, Math.min(edgeT, yHi - 2.2 * s));   // a stem stays on the plate
        if (st === "B") ye = Math.max(ye, Math.min(gapY, yHi - minS * s));   // …and on its side of the gap
      } else {
        ye = Math.max(yLo + 3.5 * s, mid);
        ye = Math.min(ye, Math.max(edgeB, yLo + 2.2 * s));
        if (st === "T") ye = Math.min(ye, Math.max(gapY, yLo + minS * s));
      }
      return ye;
    }
    function reach(d) { return d > 0 ? yHi - stemEnd(1) : stemEnd(-1) - yLo; }   // past the stem's last head
    // (a beamed group's stem is the beam's: its direction and its end are
    // the beam's own, already kept off the gap's middle — beamGeo)
    if (!o.beamY && !o.tune) {
      if (stem && o.alt && o.alt !== dir && reach(dir) < 3 * s && reach(o.alt) > reach(dir)) dir = o.alt;
      if (stem && st === "B" && dir > 0 && yHi - gapY < minS * s) dir = -1;
      else if (stem && st === "T" && dir < 0 && gapY - yLo < minS * s) dir = 1;
    }
    var sx = X + dir * (0.57 * s - sw / 2);
    // (a heavy head — the tune's — is drawn HEAVY times the size: its stem
    // meets its own edge, hs2)
    var placed = hs.map(function (h) {
      var k = shapeKey(h.shape, dir || 1), hx = X, hs2 = h.heavy ? s * HEAVY : s;
      if (stem) { var an = anchorOf(k, dir); hx = sx - an[0] * hs2 + dir * sw / 2; }
      return { h: h, k: k, x: hx, y: g.y(st, h.q), hs: hs2 };
    });
    // a second on one stem: the upper (stem up) / lower (stem down) head crosses to the other side
    for (var i = 1; i < placed.length; i++) {
      if (placed[i].h.q - placed[i - 1].h.q === 1) {
        var d = dir || 1, mv = d > 0 ? placed[i] : placed[i - 1];
        mv.x += d * (0.57 * (placed[i].hs + placed[i - 1].hs) - sw);
      }
    }
    var top = placed[placed.length - 1], bot = placed[0], y0 = null, yEnd = null;
    if (stem) {
      if (dir > 0) { var an0 = anchorOf(bot.k, 1); y0 = bot.y + an0[1] * bot.hs; }
      else { var an1 = anchorOf(top.k, -1); y0 = top.y + an1[1] * top.hs; }
      yEnd = o.beamY ? o.beamY(sx) : stemEnd(dir);
    }
    // augmentation dots sit right of the heads (and of an up-stem)
    var right = -1e9;
    placed.forEach(function (p) { right = Math.max(right, p.x + 0.64 * p.hs); });
    if (dir > 0 && stem) right = Math.max(right, sx + sw / 2);
    var ledgers = [];
    placed.forEach(function (p) {
      if (p.h.ghost) return;                       // (a second voice's head that is the first's: its ledgers are drawn once)
      var ls = ledgersFor(st, p.h.q);
      for (var li = 0; li < ls.length; li++) ledgers.push([p.x - 0.98 * s, g.y(st, ls[li]), p.x + 0.98 * s]);
    });
    return { s: s, sw: sw, sx: sx, stem: stem, dir: dir, placed: placed, top: top, bot: bot, y0: y0, yEnd: yEnd, right: right, ledgers: ledgers };
  }
  // the ink a laid-out group covers, as boxes: its heads (with their dots,
  // breve strokes or bell ring), its ledgers, its stem and its flags. Used to
  // keep two voices at one x out of each other's way.
  function groupBoxes(L, o) {
    var s = L.s, out = [], hasDots = false, lh = 0.1 * s;
    L.ledgers.forEach(function (l) { out.push([l[0], l[1] - lh, l[2], l[1] + lh, 1]); });   // [4]: a ledger
    L.placed.forEach(function (p) {
      if (p.h.ghost) return;
      var hw = o.breve ? 1.1 * s : o.ring ? 1.05 * s : 0.64 * p.hs, hh = o.ring ? 1.05 * s : 0.52 * p.hs;   // a bell's ring is part of its head
      out.push([p.x - hw, p.y - hh, p.x + hw, p.y + hh, 0, 1]);                                        // [5]: a head
      if (p.h.dots) hasDots = true;
      var lead = headLead(p.h, s);                                                                     // an accidental, a tuning mark, a grace before it
      if (lead > 0.7 * s) out.push([p.x - lead, p.y - 1.2 * s, p.x - 0.64 * s, p.y + 1.2 * s, 0, 0, 1]);                 // [6]: a sign before a head
    });
    if (hasDots) out.push([L.right + 0.25 * s, L.bot.y - 0.6 * s, L.right + 0.75 * s, L.top.y + 0.6 * s]);
    if (L.stem) {
      var ya = Math.min(L.y0, L.yEnd), yb = Math.max(L.y0, L.yEnd);
      out.push([L.sx - L.sw / 2 - 0.08 * s, ya, L.sx + L.sw / 2 + 0.08 * s, yb]);
      if (o.flags) {
        var fy = L.yEnd, fl = (0.8 * (o.flags - 1) + 2.8) * s, d = L.yEnd < L.y0 ? 1 : -1;
        out.push([L.sx, Math.min(fy, fy + d * fl), L.sx + 1.05 * s, Math.max(fy, fy + d * fl)]);
      }
    }
    return out;
  }
  function drawGroup(c, g, X, heads, st, dir, o) {
    var sp = g.sp, L = layoutGroup(g, X, heads, st, dir, o);
    dir = L.dir;                                          // (turned away from the gap, if it had to be)
    var s = L.s, sw = L.sw, sx = L.sx, placed = L.placed, top = L.top, bot = L.bot, yEnd = L.yEnd;
    var pad = KO_PAD * sp;
    c.fillStyle = rgba(o.rgb);
    var th = o.thin || 1, lth = Math.max((th < 1 ? 0.9 : 1.2) / dpr, 0.16 * sp * th);
    L.ledgers.forEach(function (l) {
      hLine(c, l[0], l[2], l[1], lth);
      koRect(c, l[0] - pad, l[1] - lth / 2 - pad, l[2] + pad, l[1] + lth / 2 + pad);
    });
    if (L.stem) {
      vLine(c, sx, L.y0, yEnd, sw);
      koRect(c, sx - sw / 2 - pad, Math.min(L.y0, yEnd), sx + sw / 2 + pad, Math.max(L.y0, yEnd));
      if (!o.beamY) for (var f = 0; f < (o.flags || 0); f++) drawFlag(c, sx, yEnd + dir * f * 0.8 * s, dir, s, sw);   // (a beamed note's flags are its beams)
      if (o.slash) {
        c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = Math.max(1 / dpr, 0.1 * sp); c.lineCap = "round";
        c.beginPath(); c.moveTo(sx - 0.7 * s, yEnd + dir * 2.1 * s); c.lineTo(sx + 0.8 * s, yEnd + dir * 0.9 * s); c.stroke(); c.restore();
      }
    }
    placed.forEach(function (p) {
      if (p.h.ghost) return;
      drawSprite(c, headSprite(p.k, p.h.open, s, o.rgb, p.h.heavy), p.x, p.y);
      koEllipse(c, p.x, p.y, 0.68 * p.hs + pad, 0.55 * p.hs + pad);
      if (p.h.acc || p.h.jm || p.h.orn) headMarks(c, g, p, st, s, sw, o, L);
    });
    if (o.breve) {                                        // the breve's side strokes
      placed.forEach(function (p) {
        [-1, 1].forEach(function (sd) {
          vLine(c, p.x + sd * 0.82 * s, p.y - 0.55 * s, p.y + 0.55 * s, sw);
          vLine(c, p.x + sd * 1.02 * s, p.y - 0.55 * s, p.y + 0.55 * s, sw);
        });
      });
    }
    // augmentation dots, each in a space, clear of the stem
    var used = {};
    placed.slice().reverse().forEach(function (p) {
      if (!p.h.dots || p.h.ghost) return;
      var dq = p.h.q % 2 === 0 ? p.h.q + 1 : p.h.q;
      while (used[dq]) dq -= 2;
      used[dq] = 1;
      var dy = g.y(st, dq);
      c.beginPath(); c.arc(L.right + 0.5 * s, dy, 0.19 * s, 0, Math.PI * 2); c.fill();
      koEllipse(c, L.right + 0.5 * s, dy, 0.19 * s + pad, 0.19 * s + pad);
    });
    return { sx: sx, yEnd: yEnd, topY: top.y, botY: bot.y, topX: top.x, botX: bot.x, sw: sw, L: L };
  }
  function drawFlag(c, sx, y, dir, s, sw) {
    c.save(); c.translate(sx - sw / 2, y); c.scale(s, dir > 0 ? s : -s);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0.13, 0);
    c.bezierCurveTo(0.2, 0.55, 0.58, 0.82, 0.82, 1.22);
    c.bezierCurveTo(1.04, 1.6, 1.02, 2.2, 0.8, 2.72);
    c.lineTo(0.73, 2.68);
    c.bezierCurveTo(0.88, 2.22, 0.82, 1.82, 0.6, 1.56);
    c.bezierCurveTo(0.42, 1.34, 0.2, 1.22, 0, 1.12);
    c.closePath(); c.fill(); c.restore();
  }
  // ---- the hymn's signs (round 3b) -------------------------------------------
  // how far a head's own signs reach to its left: an accidental, Johnston's
  // marks (if they are printed), a slide or a grace before it
  function headLead(h, s) {
    var l = 0.64 * (h.heavy ? HEAVY : 1);
    if (h.acc) l += 1.25;
    if (TUNING_MARKS && h.jm) l += 0.85 * ((h.jm.c ? 1 : 0) + (h.jm.s7 ? 1 : 0));
    if (h.orn === "grace" || h.orn === "slide") l = Math.max(l, 0.64 + 1.4);
    return l * s;
  }
  // a head's signs: before it its accidental and (the owner's call) its
  // tuning marks; the Old Way's ornament where the composer placed one
  function headMarks(c, g, p, st, s, sw, o, L) {
    var x = p.x - 0.64 * (p.hs || s), y = p.y, h = p.h;
    if (h.acc) {
      x -= 0.3 * s;
      var nm = h.acc === "s" ? "sharp" : h.acc === "f" ? "flat" : "natural", bx = GLYPHS[nm].box;
      drawGlyph(c, nm, x - bx[2] * s, y, s, o.rgb);
      x -= (bx[2] - bx[0]) * s;
    }
    if (TUNING_MARKS && h.jm) {                     // Johnston: the comma's sign next to the head, the 7 before it; small
      var ts = 0.78 * s;
      var my = h.q % 2 !== 0 ? y : y - 0.5 * s;     // (in a space, never on a line, where a dash would vanish)
      if (h.jm.c) {
        x -= 0.22 * s;
        var mw = 0.56 * ts, th = Math.max(0.9 / dpr, 0.13 * ts);
        snapRect(c, x - mw, my - th / 2, mw, th);
        if (h.jm.c > 0) snapRect(c, x - mw / 2 - th / 2, my - mw / 2, th, mw);
        x -= mw;
      }
      if (h.jm.s7) { x -= 0.18 * s; drawGlyph(c, "j7", x - 0.36 * ts, my, ts, o.rgb); x -= 0.72 * ts; }
    }
    if (h.orn === "turn") {                         // above the note (and above its stem, over the staff)
      var top = st === "T" ? g.T : g.B, yt = Math.min(y - 1.5 * s, top - 0.9 * g.sp);
      if (L.stem && L.dir > 0) yt = Math.min(yt, L.yEnd - 0.8 * s);
      yt = Math.max(yt, g.top + 0.7 * g.sp);
      drawGlyph(c, "turn", p.x, yt, s, o.rgb);
    } else if (h.orn === "slide") {                 // a slide up into the note
      c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = Math.max(1 / dpr, 0.13 * s); c.lineCap = "round";
      c.beginPath(); c.moveTo(p.x - 1.75 * s, y + 0.95 * s); c.quadraticCurveTo(p.x - 1.25 * s, y + 0.75 * s, p.x - 0.86 * s, y + 0.12 * s); c.stroke();
      c.restore();
    } else if (h.orn === "grace") {                 // a grace note, a step above, slashed
      var gs = 0.6 * s, gx = p.x - 1.7 * s, gy = g.y(st, h.q + 1), gsw = Math.max(1 / dpr, 0.1 * s);
      drawSprite(c, headSprite(shapeKey(h.graceShape || "sol", 1), false, gs, o.rgb), gx, gy);
      var gsx = gx + 0.57 * gs;
      vLine(c, gsx, gy - 0.1 * gs, gy - 3.0 * gs, gsw);
      drawFlag(c, gsx, gy - 3.0 * gs, 1, gs, gsw);
      c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = gsw; c.lineCap = "round";
      c.beginPath(); c.moveTo(gsx - 0.7 * gs, gy - 1.1 * gs); c.lineTo(gsx + 0.8 * gs, gy - 2.4 * gs); c.stroke(); c.restore();
    }
  }
  // A beam, laid once per staff size: the stems of its notes turned one way
  // (the voice's own, the pair's shared, or away from the head furthest from
  // the middle line), its slope the melody's, gently (at most 0.9 sp over
  // the group), every stem at least 2.9 sp past its far head, and the whole
  // kept off the gap's middle and on the plate. Where that would leave a
  // stem stubby, a beam free to turn turns. y is the beam's outer edge.
  function beamGeo(bm, g) {
    if (bm.geo && bm.geo.sp === g.sp) return bm.geo;
    var ms = bm.members;
    if (ms.length < 2) return null;
    var sp = g.sp, s = sp, st = bm.st, sw = Math.max(1.4 / dpr, 0.12 * sp);
    var nb = 1;
    ms.forEach(function (m) { nb = Math.max(nb, m.flags || 1); });
    function build(dir) {
      var pts = ms.map(function (m) {
        var hi = 1e9, lo = -1e9;
        drawnHeads(m, g).forEach(function (hd) { var y = g.y(st, hd.q); hi = Math.min(hi, y); lo = Math.max(lo, y); });
        var x = (m.tp - ms[0].tp) * SCROLL_PX_S + (m.col && m.col.sp === sp ? m.col.dx : 0) + dir * (0.57 * s - sw / 2);
        var far = dir > 0 ? hi : lo, near = dir > 0 ? lo : hi;
        return { x: x, far: far, near: near, ideal: far - dir * 3.5 * s, need: far - dir * (2.9 + 0.75 * (nb - 1)) * s };
      });
      var a = pts[0], b = pts[pts.length - 1];
      var m = clamp(b.ideal - a.ideal, -0.9 * s, 0.9 * s) / ((b.x - a.x) || 1), y0 = a.ideal;
      pts.forEach(function (p) {
        var by = y0 + m * (p.x - a.x);
        if (dir > 0 ? by > p.need : by < p.need) y0 += p.need - by;
      });
      // the gap's middle, and the plate's edges
      var yMin = 1e9, yMax = -1e9;
      pts.forEach(function (p) { var by = y0 + m * (p.x - a.x); yMin = Math.min(yMin, by); yMax = Math.max(yMax, by); });
      var lim = dir > 0 ? g.top + 0.3 * sp : g.bot - 0.3 * sp;
      ms.forEach(function (m) {                    // (the gap: the most any of its notes may have)
        if (dir > 0 && st === "B") lim = Math.max(lim, gapLimit(g, st, m.room));
        if (dir < 0 && st === "T") lim = Math.min(lim, gapLimit(g, st, m.room));
      });
      if (dir > 0 && yMin < lim) y0 += lim - yMin;
      if (dir < 0 && yMax > lim) y0 -= yMax - lim;
      var short = 1e9;
      pts.forEach(function (p) { var by = y0 + m * (p.x - a.x); short = Math.min(short, dir * (p.far - by)); });
      return { dir: dir, y0: y0, m: m, x0: a.x, short: short, sp: sp };
    }
    var d0 = bm.fixed;
    if (!d0) {                                     // the position rule, over the whole group
      var mq = st === "T" ? 16 : 4, far = null;
      ms.forEach(function (m) { drawnHeads(m, g).forEach(function (hd) { if (far == null || Math.abs(hd.q - mq) > Math.abs(far - mq)) far = hd.q; }); });
      d0 = far >= mq ? -1 : 1;
    }
    var geo = build(d0);
    if (!bm.fixed && geo.short < 2.4 * s) { var alt = build(-d0); if (alt.short > geo.short) geo = alt; }
    bm.geo = geo;
    return geo;
  }
  function beamYAt(bm, geo) {
    var x0 = X(bm.members[0].tp) + geo.x0;
    return function (x) { return geo.y0 + geo.m * (x - x0); };
  }
  // the beam itself: from its first stem to its last, or, while its notes
  // are still coming, as far as the engraving point — the burin's stroke
  var FRAME = 0;
  function drawBeam(c, g, bm) {
    var geo = bm.geo, ms = bm.members;
    if (!geo || ms.length < 2) return;
    var sp = g.sp, s = sp, sw = Math.max(1.4 / dpr, 0.12 * sp), yAt = beamYAt(bm, geo), dir = geo.dir;
    var xs = [], a = 0;
    ms.forEach(function (m) {
      var drawn = m.drawnAt === FRAME;
      if (drawn) a = Math.max(a, m.lastA || 0);
      xs.push(drawn ? m.lastSx : m.tp > PT ? null : undefined);        // null: not yet reached; undefined: dried or gone
    });
    var i0 = -1, i1 = -1;
    for (var i = 0; i < xs.length; i++) if (typeof xs[i] === "number") { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 0 || a < 0.02) return;
    var xa = xs[i0] - sw / 2, xb = xs[i1] + sw / 2;
    if (i1 < ms.length - 1 && xs[i1 + 1] === null) xb = Math.max(xb, Math.min(X(ms[i1 + 1].tp) + dir * (0.57 * s - sw / 2), g.xE + 0.3 * sp));
    var th = 0.5 * s * dir;                        // (inward, toward the heads)
    c.globalAlpha = a;
    c.fillStyle = rgba(C_INK);
    function band(x1, x2, off) {
      if (x2 <= x1) return;
      c.beginPath();
      c.moveTo(x1, yAt(x1) + off); c.lineTo(x2, yAt(x2) + off); c.lineTo(x2, yAt(x2) + off + th); c.lineTo(x1, yAt(x1) + off + th);
      c.closePath(); c.fill();
      var e1 = Math.min(off, off + th), e2 = Math.max(off, off + th);   // (the telegraph keeps clear of it)
      koRect(c, x1, Math.min(yAt(x1), yAt(x2)) + e1 - KO_PAD * sp, x2, Math.max(yAt(x1), yAt(x2)) + e2 + KO_PAD * sp);
    }
    band(xa, xb, 0);
    // a sixteenth's second beam: between two sixteenths, or a stub toward its neighbour
    var off2 = 0.75 * s * dir;
    for (i = i0; i <= i1; i++) {
      if ((ms[i].flags || 1) < 2) continue;
      var nx = i < i1 && (ms[i + 1].flags || 1) >= 2, pv = i > i0 && (ms[i - 1].flags || 1) >= 2;
      if (nx) band(xs[i] - sw / 2, xs[i + 1] + sw / 2, off2);
      else if (!pv) {
        if (i < i1) band(xs[i] - sw / 2, xs[i] + 1.0 * s, off2);
        else band(xs[i] - 1.0 * s, xs[i] + sw / 2, off2);
      }
    }
  }
  // the hymn's marks, each reached like a note and drying like one
  function drawMarks(c) {
    var g = G, sp = g.sp, keep = 0;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], x = X(m.tp), xl = m.tp2 != null ? X(m.tp2) : x;
      if (Math.max(x, xl) < -6 * sp) continue;       // gone past the clefs
      marks[keep++] = m;
      if (m.tp > PT || x > g.xE + 3 * sp) continue;
      var a = dryA(m);
      if (a < 0.02) continue;
      c.globalAlpha = a;
      c.fillStyle = rgba(C_INK);
      if (m.kind === "bar") drawHymnBar(c, g, m, x);
      else if (m.kind === "rest") drawRest(c, g, m, x);
      else if (m.kind === "ferm") drawFermata(c, g, m, x);
      else drawTieOrSlur(c, g, m);
    }
    marks.length = keep;
    c.globalAlpha = 1;
  }
  // A single bar, the double bar at a line's end, the final bar at the
  // hymn's. At 60 px/s a quick note before a downbeat leaves little room,
  // so a bar is set the engraver's way: it stands clear of the ink either
  // side of it — the notes and rests before it (their heads and dots, their
  // stems, an unbeamed note's flag: a stem-up eighth's reaches 1.6 sp past
  // its head) and the notes on its downbeat (an accidental, a head, a stem
  // down, which keeps a little more air so that it never reads as a second
  // bar). Where there is not that much room, the downbeat's notes on both
  // staves make it, together, when they are first set (placeColumn → barPush)
  // — the page's time bends by a staff space or so at the bar, as a
  // hymnal's spacing does. Only the ink between the staff's own lines is
  // weighed: the bar stands there alone.
  var BAR_AIR = 0.35, BAR_AIR_STEM = 0.5;          // in sp: from the ink before a bar; after it, to a head or a stem
  function barInk(m, g) {                          // the bar's own ink, left and right of its x (xb)
    var thin = Math.max(1.2 / dpr, 0.16 * g.sp);
    return { th: thin, wl: m.type === "double" ? 0.5 * g.sp + thin / 2 : m.type === "final" ? 0.8 * g.sp + thin / 2 : thin / 2,
             wr: m.type === "final" ? 0 : thin / 2 };
  }
  // (the staff and a space either side of it: a stem that ends just over the
  // staff, or a head on the ledger by it, would read as one stroke with a bar)
  function inBand(g, st, b) { var top = st === "T" ? g.T : g.B, sp = g.sp; return b[3] > top - sp && b[1] < top + 5 * sp; }
  function drawnInk(gr) {                          // the boxes of what this frame drew (page x)
    if (gr.boxF !== FRAME) { gr.boxF = FRAME; gr.boxC = groupBoxes(gr.lastL, gr.lastO || {}); }
    return gr.boxC;
  }
  // a rest's place about its own time's x: after its bar, if one stands at it
  function restPlace(r, g) {
    var sp = g.sp, nm = REST_OF[r.full ? 1 : r.v] || REST_OF[0.25], bx = GLYPHS[nm[0]].box;
    var rx = (r.full ? 1.4 : 0.5) * sp;
    if (r.barIn && r.barIn.relSp === sp) rx = Math.max(rx, r.barIn.rel + BAR_AIR * sp - bx[0] * sp);
    return { rx: rx, nm: nm, x0: rx + bx[0] * sp, x1: rx + Math.max(bx[2] * sp, nm[1] ? 1.13 * sp : 0), y0: bx[1] * sp, y1: bx[3] * sp };
  }
  // what a bar must clear, about its own time's x: pr, the rightmost ink
  // before it; nl, the leftmost after it, less its air. now: as this frame
  // drew them; else as they will be set before the downbeat makes room
  function barExtents(m, g, now) {
    var sp = g.sp, xm = X(m.tp), pr = -1e9, nl = 1e9;
    (m.pv || []).forEach(function (gr) {
      if (m.sts.indexOf(gr.st) < 0) return;
      var bx, off;
      if (gr.drawnAt === FRAME && gr.lastL) { bx = drawnInk(gr); off = -xm; }
      else if (now) return;
      else { var ik = inkOf(gr, g); bx = ik.boxes; off = (gr.tp - m.tp) * SCROLL_PX_S + ik.dx; }
      bx.forEach(function (b) { if (inBand(g, gr.st, b)) pr = Math.max(pr, b[2] + off); });
    });
    (m.pvRests || []).forEach(function (r) {
      if (m.sts.indexOf(r.st) < 0 || (now && dryA(r) < 0.02)) return;
      var rp = restPlace(r, g), ry = g.y(r.st, r.q != null ? r.q : restQ(r.st, r.full ? 1 : r.v, r.voice, null));
      if (inBand(g, r.st, [0, ry + rp.y0, 0, ry + rp.y1])) pr = Math.max(pr, (r.tp - m.tp) * SCROLL_PX_S + rp.x1);
    });
    // (a guest's notes on the same staff — the clarinet over a psalm tune —
    // are not the hymn's to move, but the bar keeps clear of them too)
    foreignNow.forEach(function (gr) {
      if (gr.drawnAt !== FRAME || m.sts.indexOf(gr.st) < 0 || Math.abs(gr.lastX - xm) > 5 * sp) return;
      var before = gr.tp < m.tp;
      drawnInk(gr).forEach(function (b) {
        if (!inBand(g, gr.st, b)) return;
        if (before) pr = Math.max(pr, b[2] - xm); else nl = Math.min(nl, b[0] - xm - BAR_AIR * sp);
      });
    });
    (m.nx || []).forEach(function (gr) {
      var bx, off, L;
      if (now) { if (gr.drawnAt !== FRAME || !gr.lastL) return; bx = drawnInk(gr); off = -xm; L = gr.lastL; }
      else { var pg = prepGroup(gr, g); L = layoutGroup(g, 0, pg.heads, gr.st, gr.dir, pg.o); bx = groupBoxes(L, pg.o); off = (gr.tp - m.tp) * SCROLL_PX_S; }
      var sb = L.stem ? L.sx - L.sw / 2 - 0.08 * L.s : null;
      bx.forEach(function (b) {
        if (!inBand(g, gr.st, b)) return;
        var stem = sb != null && !b[4] && !b[5] && Math.abs(b[0] - sb) < 1e-6;
        nl = Math.min(nl, b[0] + off - (stem ? BAR_AIR_STEM : BAR_AIR) * sp);
      });
    });
    return { pr: pr, nl: nl };
  }
  // the room the downbeat's notes make for their bar (0 if there is room
  // already): worked out once per staff size, the same for every note on
  // that downbeat, so a chord across the staves stays upright
  function barPush(m, g) {
    if (m.push && m.push.sp === g.sp) return m.push.dx;
    m.push = { sp: g.sp, dx: 0 };                  // (set first: a bar is never asked twice while it is being worked out)
    var e = barExtents(m, g, false), bi = barInk(m, g);
    if (e.pr > -1e8 && e.nl < 1e8) m.push.dx = Math.max(0, e.pr + BAR_AIR * g.sp + bi.wl + bi.wr - e.nl);
    return m.push.dx;
  }
  function drawHymnBar(c, g, m, x) {
    var sp = g.sp, bi = barInk(m, g), thin = bi.th, xb = x + m.off * sp;
    var e = barExtents(m, g, true);
    var lo = x + e.pr + BAR_AIR * sp + bi.wl, hi = x + e.nl - bi.wr;
    if (e.nl < 1e8 && xb > hi) xb = hi;
    if (e.pr > -1e8 && xb < lo) xb = e.nl < 1e8 && hi < lo ? (lo + hi) / 2 : lo;
    m.rel = xb + bi.wr - x; m.relSp = sp;           // (a rest on its downbeat stands after it: restPlace)
    m.sts.forEach(function (st) {
      var top = st === "T" ? g.T : g.B, bot = top + 4 * sp;
      if (m.type === "double") { vLine(c, xb - 0.5 * sp, top, bot, thin); vLine(c, xb, top, bot, thin); }
      else if (m.type === "final") { vLine(c, xb - 0.8 * sp, top, bot, thin); snapRect(c, xb - 0.5 * sp, top, 0.5 * sp, 4 * sp); }
      else vLine(c, xb, top, bot, thin);
    });
  }
  // a rest: the whole hanging from the fourth line, the half on the middle
  // line, the rest on the middle; a voice's own raised or lowered a space
  // when the two share the staff. A whole or half rest set off the staff
  // hangs from (or sits on) a ledger line of its own, as a hymnal prints it.
  var REST_OF = { 1: ["rest1", 0], 0.75: ["rest2", 1], 0.5: ["rest2", 0], 0.375: ["rest4", 1], 0.25: ["rest4", 0], 0.1875: ["rest8", 1], 0.125: ["rest8", 0], 0.0625: ["rest16", 0] };
  function drawRest(c, g, m, x) {
    var sp = g.sp, rp = restPlace(m, g), r = rp.nm;
    var q = m.q != null ? m.q : restQ(m.st, m.full ? 1 : m.v, m.voice, null);
    var rx = x + rp.rx, ry = g.y(m.st, q), pad = KO_PAD * sp;
    if (r[0] === "rest1" || r[0] === "rest2") {
      var lth = Math.max(1.2 / dpr, 0.16 * sp);
      ledgersFor(m.st, q).forEach(function (l) {
        var ly = g.y(m.st, l);
        hLine(c, rx - 0.95 * sp, rx + 0.95 * sp, ly, lth);
        koRect(c, rx - 0.95 * sp - pad, ly - lth / 2 - pad, rx + 0.95 * sp + pad, ly + lth / 2 + pad);
      });
    }
    drawGlyph(c, r[0], rx, ry, sp, C_INK);
    koRect(c, x + rp.x0 - pad, ry + rp.y0 - pad, x + rp.x1 + pad, ry + rp.y1 + pad);
    if (r[1]) { var dq = q % 2 === 0 ? q + 1 : q; c.beginPath(); c.arc(rx + 0.95 * sp, g.y(m.st, dq), 0.18 * sp, 0, Math.PI * 2); c.fill(); }
  }
  // a fermata over the treble's topmost ink at its beat (under the bass's lowest)
  function drawFermata(c, g, m, x) {
    var sp = g.sp, hx = null, yInk = m.up ? 1e9 : -1e9;
    m.grps.forEach(function (gr) {
      var L = gr.drawnAt === FRAME ? gr.lastL : null;
      if (!L) return;
      L.placed.forEach(function (p) {
        yInk = m.up ? Math.min(yInk, p.y - 0.6 * sp) : Math.max(yInk, p.y + 0.6 * sp);
        if (hx == null || (m.up ? p.y <= L.top.y : p.y >= L.bot.y)) hx = p.x;
      });
      if (L.stem && (L.dir > 0) === m.up) yInk = m.up ? Math.min(yInk, L.yEnd) : Math.max(yInk, L.yEnd);
    });
    if (hx == null) return;                        // (its notes have dried from the page)
    var top = m.st === "T" ? g.T : g.B, bot = top + 4 * sp;
    if (m.up) drawGlyph(c, "fermU", hx, clamp(Math.min(yInk - 0.45 * sp, top - 0.7 * sp), g.top + 1.2 * sp, 1e9), sp, C_INK);
    else drawGlyph(c, "fermD", hx, clamp(Math.max(yInk + 0.45 * sp, bot + 0.7 * sp), -1e9, g.bot - 1.2 * sp), sp, C_INK);
  }
  // a tie, or the slur over a melisma: a crescent from head to head, on the
  // side away from the stem, drawn as far as the engraving point has reached
  function drawTieOrSlur(c, g, m) {
    var sp = g.sp, s = sp;
    function at(gr, q) {
      var x = gr.drawnAt === FRAME ? gr.lastX : X(gr.tp) + (gr.col && gr.col.sp === sp ? gr.col.dx : 0);
      var f = gr.fold && gr.fold.sp === sp ? gr.fold : null, dq = f && f.oct ? (m.st === "T" ? -7 : 7) * f.oct : 0;
      return { x: x, y: g.y(m.st, q + dq), dir: gr.drawnAt === FRAME && gr.lastL ? gr.lastL.dir : gr.dir };
    }
    var A = at(m.g1, m.q1), B = at(m.g2, m.q2);
    var side = A.dir > 0 ? 1 : -1;                 // (+1: below the heads)
    if (m.kind === "slur" && B.dir !== A.dir) side = -1;
    var tie = m.kind === "tie", dy = (tie ? 0.55 : 0.9) * s * side, gx = tie ? 0.6 * s : 0.1 * s;
    var x1 = A.x + gx, x2 = B.x - gx, y1 = A.y + dy, y2 = B.y + dy;
    if (x2 - x1 < 0.6 * s) return;
    var h = side * clamp(0.12 * (x2 - x1), 0.4 * s, 1.3 * s), th = side * Math.max(0.9 / dpr, 0.14 * s), dx = x2 - x1;
    c.save();
    c.beginPath(); c.rect(0, 0, g.xE + 0.3 * sp, H); c.clip();
    c.beginPath();
    c.moveTo(x1, y1);
    c.bezierCurveTo(x1 + dx * 0.25, y1 + h, x2 - dx * 0.25, y2 + h, x2, y2);
    c.bezierCurveTo(x2 - dx * 0.25, y2 + h - th, x1 + dx * 0.25, y1 + h - th, x1, y1);
    c.closePath(); c.fill();
    c.restore();
  }
  function drawBarline(c, g, x, kind, st) {
    var sp = g.sp, top = st === "T" ? g.T : g.B, bot = top + 4 * sp;
    if (kind === "dotted") {
      for (var q = 0; q < 4; q++) {
        var yy = top + (q + 0.5) * sp;
        c.beginPath(); c.arc(x, yy - 0.18 * sp, 0.11 * sp, 0, Math.PI * 2); c.arc(x, yy + 0.2 * sp, 0.11 * sp, 0, Math.PI * 2); c.fill();
      }
      return;
    }
    vLine(c, x, top, bot, Math.max(1.2 / dpr, 0.16 * sp));
  }
  // ---- the static staff layer: two staves, a brace, and the two clefs --------
  function buildStaffLayer(c) {
    var g = G, sp = g.sp;
    c.clearRect(0, 0, W, H);
    var lw = Math.max(1, Math.round(0.13 * sp * dpr)) / dpr;
    c.fillStyle = rgba(C_INK, 0.52);
    [12, 14, 16, 18, 20].forEach(function (q) { hLine(c, g.xBar, W, g.yT(q), lw); });
    [0, 2, 4, 6, 8].forEach(function (q) { hLine(c, g.xBar, W, g.yB(q), lw); });
    c.fillStyle = rgba(C_INK);
    vLine(c, g.xBar, g.T - lw / 2, g.Bb + lw / 2, Math.max(1.4 / dpr, 0.16 * sp));   // the system's opening barline
    var bw = 1.25 * sp, bx0 = g.xBar - 0.35 * sp - bw, yt = g.T, bh = g.Bb - g.T;   // the brace
    c.save(); c.translate(bx0, yt); c.scale(bw, bh);
    c.beginPath();
    c.moveTo(1, 0);
    c.bezierCurveTo(0.32, 0.03, 0.26, 0.14, 0.3, 0.26);
    c.bezierCurveTo(0.34, 0.38, 0.32, 0.47, 0, 0.5);
    c.bezierCurveTo(0.32, 0.53, 0.34, 0.62, 0.3, 0.74);
    c.bezierCurveTo(0.26, 0.86, 0.32, 0.97, 1, 1);
    c.bezierCurveTo(0.56, 0.96, 0.62, 0.86, 0.6, 0.74);
    c.bezierCurveTo(0.58, 0.6, 0.5, 0.53, 0.06, 0.5);
    c.bezierCurveTo(0.5, 0.47, 0.58, 0.4, 0.6, 0.26);
    c.bezierCurveTo(0.62, 0.14, 0.56, 0.04, 1, 0);
    c.closePath(); c.fill();
    c.restore();
    if (!trebPath && typeof Path2D === "function") {
      trebPath = new Path2D(CLEF_TREBLE.d);
      bassPath = new Path2D(CLEF_BASS.d);
    }
    function clef(cl, path, left, topY, h) {
      var bb = cl.bbox, s = h / (bb[3] - bb[1]);
      c.save(); c.translate(left - bb[0] * s, topY + bb[3] * s); c.scale(s, -s); c.fill(path); c.restore();
    }
    if (trebPath) {                                   // seated on their lines: the curl on G (q14), the dots round F (q6)
      clef(CLEF_TREBLE, trebPath, g.clefX, g.yT(14) - 0.583 * g.trebH, g.trebH);
      clef(CLEF_BASS, bassPath, g.clefX, g.yB(6) - 0.237 * g.bassH, g.bassH);
    }
  }

  // ---- the ward's page ----------------------------------------------------------
  function X(tp) { return Math.round((G.xE - (PT - tp) * SCROLL_PX_S) * dpr) / dpr; }
  // Two voices at one x. A group is placed the first time it is drawn: if
  // its ink would run into a group already placed close by on the same
  // staff (a stem through the other voice's head, heads or dots that
  // touch), it is set to the right, clear of that ink, the way a second
  // voice is set. Quick notes ask a little more air: where either note is
  // flagged, a head that would all but touch a head beside it (the old
  // tune's sixteenths, a quarter of its beat apart at 60 px/s) is set aside
  // the same way. (Heads only: a flag reaching toward the next note of an
  // ordinary run of eighths is left as it was, so a run is not pushed along
  // note by note.) The offset is kept, and worked out again if the staff
  // space changes (a resize).
  // (a hymn's note is never set more than HYMN_DX_MAX staff spaces after its
  // time: where the music is denser than 60 px/s can hold — a 6/8 hymn's
  // quick bars — the offsets would otherwise carry on from note to note and
  // bar to bar, and the page drift from the sound; there it lets the inks
  // come close instead)
  var HYMN_DX_MAX = 2.4;
  function placeColumn(gr, g, heads, o) {
    if (gr.col && gr.col.sp === g.sp) return gr.col.dx;
    var sp = g.sp, tol = 0.05 * sp, gap = 0.3 * sp;
    var bx = groupBoxes(layoutGroup(g, 0, heads, gr.st, gr.dir, o), o);
    // (a hymn's two voices a second apart are set the engraver's way: the
    // second head one head's width over, its ledger running under the
    // first — a ledger is no obstacle between them)
    if (gr.hymn) bx = bx.filter(function (b0) { return !b0[4]; });
    var bL = 1e9;
    for (var q = 0; q < bx.length; q++) bL = Math.min(bL, bx[q][0]);
    var cap = gr.hymn ? HYMN_DX_MAX * sp : 1e9;
    var dx = gr.barIn ? Math.min(cap, barPush(gr.barIn, g)) : 0;   // (a downbeat's note makes room for its bar first)
    for (var pass = 0; pass < 4; pass++) {
      var need = dx;
      for (var i = 0; i < groups.length; i++) {
        var A = groups[i];
        if (A === gr || !A.col || A.col.sp !== sp || A.st !== gr.st || !(A.lastA > 0.05)) continue;
        var off = (A.tp - gr.tp) * SCROLL_PX_S + A.col.dx;     // A's origin, from ours
        if (off < dx - 8 * sp || off > dx + 8 * sp) continue;
        var ab = A.col.boxes, hit = false, aR = -1e9, air = o.flags || A.flags ? gap : 0, hy = gr.hymn && A.hymn;
        for (var m = 0; m < ab.length; m++) {
          if (hy && ab[m][4]) continue;
          var ax0 = ab[m][0] + off, ax1 = ab[m][2] + off;
          aR = Math.max(aR, ax1);
          for (var n = 0; !hit && n < bx.length; n++) {
            var b = bx[n], ha = air && ab[m][5] && b[5] ? air : 0;   // two heads, one of them flagged: air between them
            if (hy) ha = ab[m][6] || b[6] ? 0.2 * sp : 0;      // (a hymn's beamed voices need no flag's air; a sharp is not set against the ink before it)
            if (ab[m][4] && b[4]) continue;                     // ledgers may meet
            if (ax0 - ha < b[2] + dx - tol && b[0] + dx < ax1 + ha - tol && ab[m][1] < b[3] - tol && b[1] < ab[m][3] - tol) hit = true;
          }
        }
        if (hit) need = Math.max(need, aR + (hy ? 0.08 * sp : gap) - bL);
      }
      if (need <= dx) break;
      dx = need;
    }
    gr.col = { sp: sp, dx: Math.min(dx, cap), boxes: bx };
    return dx;
  }
  var foreignNow = [];                             // this frame's notes that are not a composed hymn's (drawHymnBar keeps clear of them)
  function drawPage(c) {
    var g = G, sp = g.sp, xR = g.xE + 3 * sp;
    foreignNow.length = 0;
    // the groups — heads on their stems, in the one ink
    var keep = 0, beamsNow = [];
    for (var i = 0; i < groups.length; i++) {
      var gr = groups[i], x = X(gr.tp);
      if (x < -6 * sp) continue;                               // gone past the clefs
      groups[keep++] = gr;
      if (gr.tp > PT || x > xR) continue;                      // not yet sung
      if (gr.alone) {                                          // the organ: only where no one sings over it
        if (gr.aloneOk == null) gr.aloneOk = organAlone(gr);
        if (!gr.aloneOk) continue;
      }
      var a = dryA(gr) * (gr.ink || 1);                    // a guest's own ink: the far choir's, the old tune's
      gr.lastA = a;
      if (a < 0.02) continue;
      var pg = prepGroup(gr, g), heads = pg.heads, o = pg.o;
      x += gr.noCol ? coDx(gr, g) : placeColumn(gr, g, heads, o);
      if (gr.beam && gr.beam.geo) {
        o.beamY = beamYAt(gr.beam, gr.beam.geo);
        if (beamsNow.indexOf(gr.beam) < 0) beamsNow.push(gr.beam);
      }
      c.globalAlpha = a;
      var r = drawGroup(c, g, x, heads, gr.st, gr.dir, o);
      gr.drawnAt = FRAME; gr.lastX = x; gr.lastSx = r.sx; gr.lastL = r.L; gr.lastO = o;
      if (!gr.hymn) foreignNow.push(gr);
      if (gr.ring) drawBellRing(c, g, x, g.y(gr.st, heads[0].q), gr.scale);
    }
    groups.length = keep;
    beamsNow.forEach(function (bm) { drawBeam(c, g, bm); });
    drawMarks(c);
    c.globalAlpha = 1;
    drawQuestions(c);
  }
  // a group's heads and how it is engraved, this frame (a beamed note's stem is the beam's)
  function prepGroup(gr, g) {
    var heads = drawnHeads(gr, g), o = inkOpts(gr);
    if (gr.beam) {
      var bg = beamGeo(gr.beam, g);
      if (bg) { gr.dir = bg.dir; o.flags = 0; }
    }
    return { heads: heads, o: o };
  }
  // (a second voice's stem on the first's head goes where that head went)
  function coDx(gr, g) { var p = gr.coOf; return p && p.col && p.col.sp === g.sp ? p.col.dx : 0; }
  // the ink a group will lay, as boxes about its own time's x, and its
  // column's offset: set now if it has not been (a bar asks after the notes
  // before it)
  function inkOf(gr, g) {
    if (gr.noCol) {
      if (!(gr.inkBx && gr.inkBx.sp === g.sp)) {
        var pg = prepGroup(gr, g);
        gr.inkBx = { sp: g.sp, boxes: groupBoxes(layoutGroup(g, 0, pg.heads, gr.st, gr.dir, pg.o), pg.o) };
      }
      return { dx: coDx(gr, g), boxes: gr.inkBx.boxes };
    }
    if (!(gr.col && gr.col.sp === g.sp)) { var p2 = prepGroup(gr, g); placeColumn(gr, g, p2.heads, p2.o); }
    return gr.col;
  }
  // how a group is engraved (alt: the stem it takes if its voice's own would be stubby)
  function inkOpts(gr) {
    return { scale: gr.scale, rgb: C_INK, noStem: gr.noStem, flags: gr.flags, slash: gr.slash, breve: gr.v && gr.v.breve, ring: gr.ring, thin: gr.thin, alt: gr.alt,
             keep: gr.hymn && (gr.voice === "both" || (gr.voice !== "one" && gr.voice !== "hop")), room: gr.room, ferm: gr.ferm || 0,
             tune: !!(gr.hymn && gr.tune && gr.voice !== "one" && gr.voice !== "hop" && gr.voice !== "both") };
  }
  // a bell: a ringed head — one thin ring, drawn with the head, that dries
  // with it (no spreading rings: nothing on the page moves but the scroll)
  function drawBellRing(c, g, x, y, sc) {
    var r = 0.98 * g.sp * (sc || 1), lw = Math.max(1 / dpr, 0.07 * g.sp);
    c.save();
    c.strokeStyle = rgba(C_INK); c.lineWidth = lw;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.restore();
    koEllipse(c, x, y, r + lw + KO_PAD * g.sp, r + lw + KO_PAD * g.sp);
  }

  // the telegraph: its message punched straight into the page's paper along
  // the middle of the gap (v0.32, owner: no tape, no container) — a round
  // hole for a dit, a slot for a dah, each showing the plate beneath with a
  // little shadow under its upper lip. A hole is punched at the engraving
  // point when its key lifts and then travels with the page like a note (so
  // the message is laid out at the page's own scale); it dries like a note,
  // and it is never punched where a note, ledger or stem has the gap.
  function tapeLive() {
    for (var i = 0; i < tapes.length; i++) if (tapes[i].tp <= PT) return true;
    return false;
  }
  function holeR(T) { return Math.min(0.23 * G.sp, 0.45 * T.U * SCROLL_PX_S); }
  function drawTapes(c) {
    var g = G, sp = g.sp, cy = g.tapeY;
    for (var i = tapes.length - 1; i >= 0; i--) {
      var T = tapes[i];
      if (T.tp > PT) continue;
      if (X(T.tp + T.Tt) < -4 * sp) { tapes.splice(i, 1); continue; }
      var hr = holeR(T), inset = Math.min(0.04 * sp, 0.1 * hr);
      for (var j = 0; j < T.marks.length; j++) {
        var mk = T.marks[j];
        if (mk.tp > PT) break;                           // punched when the key lifts
        var xa = X(T.tp + mk.at) + inset, xb = X(mk.tp) - inset;
        if (xb < -2 * sp) continue;
        var a = dryA(mk);
        if (a < 0.02) continue;
        var hx0 = mk.dah ? xa : (xa + xb) / 2 - hr, hx1 = mk.dah ? Math.max(xb, xa + 2 * hr) : (xa + xb) / 2 + hr;
        if (koCovers(hx0, cy - hr, hx1, cy + hr)) continue;   // the music has the gap here
        c.globalAlpha = a;
        c.beginPath();
        if (!mk.dah) c.arc((xa + xb) / 2, cy, hr, 0, Math.PI * 2);
        else rrect(c, xa, cy - hr, Math.max(2 * hr, xb - xa), 2 * hr, hr);
        c.fillStyle = "#ddd1b4"; c.fill();              // the plate seen through the hole
        c.save(); c.clip();
        c.strokeStyle = "rgba(60, 45, 20, 0.6)"; c.lineWidth = 0.87 * hr;
        var d = 0.39 * hr;
        c.beginPath();
        if (!mk.dah) c.arc((xa + xb) / 2, cy + d, hr, Math.PI, Math.PI * 2);
        else { c.moveTo(xa, cy + 0.1 * hr); c.arcTo(xa, cy - hr + d, xa + hr, cy - hr + d, hr); c.lineTo(xb - hr, cy - hr + d); c.arcTo(xb, cy - hr + d, xb, cy + 0.1 * hr, hr); }
        c.stroke(); c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  // the Question: each asking in a slender double-ruled cartouche with its
  // "?" at the head, in the one green ink; then, after the last, an empty
  // measure between dotted barlines — the answer that does not come
  function drawQuestions(c) {
    var g = G, sp = g.sp;
    for (var qi = questions.length - 1; qi >= 0; qi--) {
      var qn = questions[qi], alive = false;
      qn.asks.forEach(function (ak) {
        if (ak.tp0 > PT) { alive = true; return; }
        var x0 = X(ak.tp0) - 3.0 * sp, x1 = X(ak.tp1) + 0.6 * sp;
        if (x1 > -2 * sp) alive = true; else return;
        var y0 = g.T - 2.55 * sp, y1 = g.Tb + 1.25 * sp, r = 1.15 * sp;
        c.save();
        c.beginPath(); c.rect(0, 0, g.xE + 0.5 * sp, H); c.clip();          // pulled by the burin only as far as the engraving point
        c.globalAlpha = dryA(ak);
        c.strokeStyle = rgba(C_INK); c.lineWidth = Math.max(1.1 / dpr, 0.13 * sp);
        c.beginPath(); rrect(c, x0, y0, x1 - x0, y1 - y0, r); c.stroke();
        c.lineWidth = Math.max(0.8 / dpr, 0.05 * sp); c.strokeStyle = rgba(C_INK, 0.7);
        c.beginPath(); rrect(c, x0 + 0.28 * sp, y0 + 0.28 * sp, x1 - x0 - 0.56 * sp, y1 - y0 - 0.56 * sp, r - 0.28 * sp); c.stroke();
        c.lineWidth = Math.max(1.1 / dpr, 0.13 * sp); c.strokeStyle = rgba(C_INK);
        c.beginPath(); c.moveTo(x1 + 0.35 * sp, y0 + 0.9 * sp); c.lineTo(x1 + 0.35 * sp, y1 - 0.9 * sp); c.stroke();
        text(c, "?", x0 + 1.2 * sp, g.yT(16) + 0.95 * sp, "italic 500 " + (2.7 * sp).toFixed(1) + "px " + FG, C_INK, 1, "center");
        c.restore();
      });
      if (qn.na) {
        var na = qn.na;
        if (na.tp0 <= PT) {
          var xa = X(na.tp0), xb = X(na.tp1);
          if (xb > -2 * sp) alive = true;
          c.globalAlpha = dryA(na); c.fillStyle = rgba(C_INK);
          if (xa > -sp) { drawBarline(c, g, xa, "dotted", "T"); drawBarline(c, g, xa, "dotted", "B"); }
          if (na.tp1 <= PT && xb > -sp) { drawBarline(c, g, xb, "dotted", "T"); drawBarline(c, g, xb, "dotted", "B"); }
          c.globalAlpha = 1;
        } else alive = true;
      }
      if (!alive && !qn.asks.some(function (ak) { return ak.tp0 > PT; })) questions.splice(qi, 1);
    }
  }

  // ---- the band's own layer ---------------------------------------------------
  // Round notes in the same green, on their own layer under the ward's ink,
  // sliding through at the band's own (quicker) rate; each note's ink follows
  // the band's approach, crossing and recession. Barlines every two of its
  // beats. No figures or words: the round heads and the pace say "not ours".
  function drawBand(c) {
    var g = G, sp = g.sp, keep = 0;
    for (var i = 0; i < bandNotes.length; i++) {
      var n = bandNotes[i], bd = n.bd;
      var x = Math.round((g.xE - (PT - n.tp) * SCROLL_PX_S * bd.r) * dpr) / dpr;
      if (x < -6 * sp) continue;
      bandNotes[keep++] = n;
      if (n.tp > PT) continue;
      c.globalAlpha = (0.12 + 0.68 * n.loud) * dryA(n);
      if (n.mel) {
        var q = n.q;
        while (q > g.qMaxT) q -= 7;                              // folded in silently, like the ward's
        drawGroup(c, g, x, [{ q: q, shape: "round", open: n.v.open, dots: n.v.dots }], "T", q >= 16 ? -1 : 1,
          { rgb: C_INK, noStem: !n.v.stem, flags: n.v.flags });
      } else {
        // the oom-pah, written the bandsman's way — a staccato quarter
        var rb = drawGroup(c, g, x, [{ q: n.q, shape: "round", open: false }], "B", -1, { rgb: C_INK });
        var dq = n.q % 2 === 0 ? n.q + 1.5 : n.q + 2;
        c.beginPath(); c.arc(rb.topX, g.yB(dq), 0.17 * sp, 0, Math.PI * 2); c.fill();
      }
    }
    bandNotes.length = keep;
    // the band's barlines, every two of its beats
    for (var b = visits.length - 1; b >= 0; b--) {
      var bd2 = visits[b];
      var XB = function (tp) { return Math.round((g.xE - (PT - tp) * SCROLL_PX_S * bd2.r) * dpr) / dpr; };
      if (bd2.tp0 > PT) continue;
      if (XB(bd2.tp1) < -6 * sp) { visits.splice(b, 1); continue; }
      for (var k = 1; k < bd2.bass.length; k++) {
        var tb = bd2.bass[k].tp;
        if (tb > PT) break;
        var xb = XB(tb) - 1.8 * sp;
        if (xb < -sp || xb > g.xE) continue;
        var life = clamp((tb - bd2.tp0) / Math.max(1, bd2.tp1 - bd2.tp0), 0, 1);
        c.globalAlpha = (0.1 + 0.4 * Math.sin(Math.PI * life)) * dryA(bd2.bass[k]);
        c.fillStyle = rgba(C_INK);
        drawBarline(c, g, xb, "single", "T"); drawBarline(c, g, xb, "single", "B");
      }
    }
    c.globalAlpha = 1;
  }

  // ---- the frame ----------------------------------------------------------------
  var inkLayer = null, bandLayer = null, tapeLayer = null;
  var lastFrame = 0;
  function paintLayer(layer, fn) {
    var c = layer.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    c.clearRect(0, 0, layer.width, layer.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save();
    c.beginPath(); c.rect(0, G.top, W, G.bot - G.top); c.clip();   // the plate
    try { fn(c); } finally { c.restore(); }                          // one bad frame must not leave the plate clipped
    // the ink dissolves before it reaches the clefs
    c.globalCompositeOperation = "destination-out";
    var gr = c.createLinearGradient(G.fade0, 0, G.fade1, 0);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr; c.fillRect(0, 0, G.fade1 + 1, H);
    c.globalCompositeOperation = "source-over";
  }
  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!ctx2d || !G) return;
    var raw = lastFrame ? Math.max(0, (ts - lastFrame) / 1000) : 0.016;
    var dt = Math.min(0.1, raw);                     // for the wheel's easing
    lastFrame = ts;
    tickClock(raw);                                  // the page keeps the real time: after a hidden spell it shows the present
    FRAME++;
    // the ward's ink first, noting where the music has the middle of the gap
    var hasTape = tapes.length > 0;
    KO.length = 0;
    if (hasTape && tapeLive()) { var tH = 0.4 * G.sp; koY0 = G.tapeY - tH; koY1 = G.tapeY + tH; }
    paintLayer(inkLayer, drawPage);
    koY0 = 0; koY1 = -1;
    if (hasTape) paintLayer(tapeLayer, drawTapes);
    var hasBand = bandNotes.length > 0 || visits.length > 0;
    if (hasBand) paintLayer(bandLayer, drawBand);
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if (staffLayer) ctx2d.drawImage(staffLayer, 0, 0);
    if (hasBand) ctx2d.drawImage(bandLayer, 0, 0);          // the guests' layer lies under the ward's ink
    if (hasTape) ctx2d.drawImage(tapeLayer, 0, 0);          // the telegraph's holes, under the ward's ink and never beneath a note
    ctx2d.drawImage(inkLayer, 0, 0);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (XW > 120) drawWheel(dt);                   // the facade rides inside the wheel (once the band is laid out)
  }

  // ---- the wheel — the order of service round the crown -----------------------
  var SEATS = ["prelude", "invocation", "hymn", "testimony", "sacrament", "doxology", "postlude"];
  var NSEAT = SEATS.length, SEAT_STEP = Math.PI * 2 / NSEAT;
  var seatLabels = ["PRELUDE", "INVOCATION", "HYMN", "TESTIMONY", "SACRAMENT", "DOXOLOGY", "POSTLUDE"];
  var seatSpoken = seatLabels.slice();             // for the live region (always Latin)
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var wh = {
    seat: 0,                 // the seat at the crown (folded)
    offset: 0,               // the wheel's rotation, in seats — grows anticlockwise
    from: 0, to: 0, t: 1, dur: 0, e: 1, wrap: false,
    fill: 0, fillHold: 0,    // the arc: what is shown, and what it held when the turn began
    liveKey: "",
  };
  function seatOfType(t) { return t === "interlude" ? "hymn" : t; }
  // Fold the plan onto the seven seats: which seat is up, and how far through
  // it — several hymns (and the interlude) share one seat, so the arc fills in
  // parts, a tick between them.
  function wheelState() {
    var type = seatOfType(cond.section || "prelude");
    var seat = Math.max(0, SEATS.indexOf(type));
    var plan = cond.plan, si = cond.sectionIndex || 0, k = 0, count = 1;
    if (plan && plan.length) {
      count = 0;
      for (var i = 0; i < plan.length; i++) if (seatOfType(plan[i]) === type) { if (i < si) k++; count++; }
      count = Math.max(1, count);
    }
    k = Math.min(k, count - 1);
    var local = Math.max(0, Math.min(1, cond.local || 0));
    return { seat: seat, prog: (k + local) / count, count: count, k: k };
  }
  function wheelGeom() {
    var fontPx = Math.max(14, Math.min(24, XW * 0.03));     // the type scales with the wheel
    var crownY = Math.round(XH * 0.14);                     // the sky above the crown: a breath under the running head
    // the horizon is pinned to the plate (4px above its foot) so the divider
    // before the staff sits at one height at every width; the wheel's radius
    // follows from it — the crown shows 0.52 R above the horizon, deep enough
    // that the organ stands inside the hour ring with headroom — capped so a
    // narrow page still sees the neighbouring seats
    var horizonY = XH - 4;                                  // at the band's foot: the staff plate is drawn up over it
    var R = Math.min((horizonY - crownY) / 0.52, XW * 0.62);
    var rBanner = R - fontPx * 2.35;                        // the banner's inner rule
    return {
      fontPx: fontPx, R: R, cx: XW / 2, cy: crownY + R, crownY: crownY,
      horizonY: horizonY,
      rBanner: rBanner,
      rHour: rBanner - fontPx * 1.3,                         // the hour ring: the arch the organ stands under
    };
  }
  // Set a string along a circle: glyph by glyph, each rotated to the tangent at
  // its own angle, the word centred on `centreA`. Deseret letters are astral
  // code points, so the string is split with Array.from, not charAt.
  function curvedText(c, txt, cx, cy, r, centreA, track) {
    var glyphs = Array.from(txt), widths = [], total = 0;
    for (var i = 0; i < glyphs.length; i++) { widths[i] = c.measureText(glyphs[i]).width; total += widths[i]; }
    total += track * (glyphs.length - 1);
    var ang = centreA - (total / 2) / r;
    for (var j = 0; j < glyphs.length; j++) {
      var ga = ang + (widths[j] / 2) / r;
      c.save();
      c.translate(cx + Math.cos(ga) * r, cy + Math.sin(ga) * r);
      c.rotate(ga + Math.PI / 2);
      c.fillText(glyphs[j], 0, 0);
      c.restore();
      ang += (widths[j] + track) / r;
    }
  }
  function inkA(a) { return "rgba(30, 77, 59, " + a.toFixed(3) + ")"; }
  function giltA(a) { return "rgba(138, 122, 69, " + a.toFixed(3) + ")"; }
  function radial(c, cx, cy, a, r0, r1) {
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.stroke();
  }
  function drawWheel(dt) {
    if (!xctx) return;
    var c = xctx, st = wheelState();
    // a new seat is up: turn to it — always anticlockwise, always forward round
    // the wheel, so postlude → prelude is one seat and a rehearsal skip back
    // goes the long way round (faster, the further it has to go)
    if (playing && st.seat !== wh.seat) {
      var steps = (st.seat - wh.seat + NSEAT) % NSEAT;
      wh.wrap = st.seat < wh.seat;
      wh.from = wh.offset; wh.to = wh.offset + steps; wh.t = 0;
      wh.dur = reduceMotion ? 0 : Math.min(3, 1.6 + 0.4 * (steps - 1));
      wh.fillHold = wh.fill;
      wh.seat = st.seat;
    }
    if (wh.t < 1) {
      wh.t = wh.dur > 0 ? Math.min(1, wh.t + dt / wh.dur) : 1;
      wh.e = wh.t < 0.5 ? 2 * wh.t * wh.t : 1 - Math.pow(-2 * wh.t + 2, 2) / 2;
      wh.offset = wh.from + (wh.to - wh.from) * wh.e;
      if (wh.t >= 1) { wh.offset = wh.offset % NSEAT; wh.wrap = false; wh.fill = 0; }
    }
    var turning = wh.t < 1;
    // the arc follows the conductor with a short lag; through a turn it holds
    // what it had and fades, then starts again from nothing for the risen seat
    if (turning) {
      wh.fill = wh.fillHold;
    } else {
      var target = playing ? st.prog : 0;
      if (target < wh.fill - 0.3) wh.fill = target;          // a skip: no rewind
      else wh.fill += (target - wh.fill) * Math.min(1, dt * 5);
    }
    var fillAlpha = turning ? 1 - wh.e : 1;

    var g = wheelGeom(), R = g.R, cx = g.cx, cy = g.cy, fontPx = g.fontPx;
    var TRACK = fontPx * 0.14;
    c.clearRect(0, 0, XW, XH);
    c.font = fontPx + 'px "Noto Sans Deseret", "EB Garamond", serif';
    if ("letterSpacing" in c) c.letterSpacing = "0em";
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.lineWidth = 1;

    c.save();
    c.beginPath(); c.rect(0, 0, XW, g.horizonY); c.clip();  // the wheel lives above the horizon

    // the sun's body: a breath of gilt at the crown, fading to paper
    var grad = c.createRadialGradient(cx, g.crownY + R * 0.18, 0, cx, g.crownY + R * 0.18, R * 0.75);
    grad.addColorStop(0, giltA(0.10)); grad.addColorStop(1, giltA(0));
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
    // the rim, and the banner's inner rule
    c.strokeStyle = inkA(0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = inkA(0.3);
    c.beginPath(); c.arc(cx, cy, g.rBanner, 0, Math.PI * 2); c.stroke();
    // beneath the banner: the dial. A faint hour ring, a spoke to every seat
    // across the band between the ring and the banner, quarter-marks standing
    // out from the ring between the seats — the turning made visible. Nothing
    // is drawn inside the ring: that disc is the organ's.
    var rHour = g.rHour;
    c.strokeStyle = inkA(0.12);
    c.beginPath(); c.arc(cx, cy, rHour, 0, Math.PI * 2); c.stroke();
    for (var q = 0; q < NSEAT * 4; q++) {
      var qa = -Math.PI / 2 + (q / 4 - wh.offset) * SEAT_STEP;
      if (q % 4 === 0) { c.strokeStyle = inkA(0.2); radial(c, cx, cy, qa, rHour, g.rBanner); }
      else { var half = q % 4 === 2; c.strokeStyle = inkA(half ? 0.3 : 0.2); radial(c, cx, cy, qa, rHour, rHour + (half ? 9 : 5)); }
    }
    // the seats: a tick on the rim, the label lettered round the banner
    for (var i = 0; i < NSEAT; i++) {
      var a = -Math.PI / 2 + (i - wh.offset) * SEAT_STEP;
      c.strokeStyle = inkA(0.45); radial(c, cx, cy, a, R, R - 7);
      var alpha = 0.62;
      if (playing) {
        if (i === wh.seat) alpha = 1;
        else if (i < wh.seat) alpha = 0.28;
        else if (wh.wrap && turning) alpha = 0.28 + 0.34 * wh.e;   // the finished seats clear as the new meeting rises
      }
      c.fillStyle = inkA(alpha);
      curvedText(c, seatLabels[i] || SEATS[i], cx, cy, R - fontPx * 1.6, a, TRACK);
    }
    // the organ, standing on the horizon inside the hour ring
    updateBands(dt);
    drawFacade(c, g);
    // THE arc — one, fixed to the page at the crown; the wheel turns beneath it.
    // It runs from the left neighbour's tick to the right neighbour's: the whole
    // crown of the wheel is the bar, and each section refills it.
    var span = SEAT_STEP * 2, a0 = -Math.PI / 2 - SEAT_STEP, rr = R + 6;
    c.save();
    c.setLineDash([1, 3]); c.strokeStyle = inkA(0.3);
    c.beginPath(); c.arc(cx, cy, rr, a0, a0 + span); c.stroke();
    c.restore();
    c.strokeStyle = inkA(0.4);
    radial(c, cx, cy, a0, rr - 3, rr + 3); radial(c, cx, cy, a0 + span, rr - 3, rr + 3);
    if (wh.fill > 0.002 && fillAlpha > 0.01) {
      c.lineWidth = 3; c.lineCap = "butt"; c.strokeStyle = giltA(fillAlpha);
      c.beginPath(); c.arc(cx, cy, rr, a0, a0 + span * wh.fill); c.stroke();
      c.lineWidth = 1;
    }
    // a seat that folds several hymns: ticks divide the arc, one hymn to a part
    if (playing && st.count > 1) {
      c.strokeStyle = inkA(0.45);
      for (var k = 1; k < st.count; k++) radial(c, cx, cy, a0 + span * k / st.count, rr - 3, rr + 3);
    }
    c.restore();

    // the horizon: the letterpress rule the wheel sets behind and the organ
    // stands on (its impost) — one hairline; the double rule stays unique to
    // the title
    c.strokeStyle = inkA(0.42);
    c.beginPath(); c.moveTo(0, g.horizonY + 0.5); c.lineTo(XW, g.horizonY + 0.5); c.stroke();

    // the live region, for readers who cannot see the wheel: on a new seat and
    // at the quarter-marks, never every frame
    var live = document.getElementById("kolob-wheel-live");
    if (live) {
      var key = playing ? wh.seat + ":" + st.k + ":" + Math.floor(st.prog * 4) : "idle";
      if (key !== wh.liveKey) {
        wh.liveKey = key;
        live.textContent = playing
          ? seatSpoken[wh.seat] + (st.count > 1 ? " " + (st.k + 1) + " of " + st.count : "") + " · " + Math.round(st.prog * 100) + "%"
          : "";
      }
    }
  }
  // Which seat is under a point of the wheel canvas (CSS px) — for the dev
  // jump menu. Null off the wheel or beneath the horizon.
  function wheelSeatAt(x, y) {
    if (!xctx) return null;
    var g = wheelGeom();
    if (y > g.horizonY) return null;
    var d = Math.hypot(x - g.cx, y - g.cy);
    if (d < g.rBanner - 4 || d > g.R + 12) return null;
    var a = Math.atan2(y - g.cy, x - g.cx);
    var i = Math.round((a + Math.PI / 2) / SEAT_STEP + wh.offset);
    return SEATS[((i % NSEAT) + NSEAT) % NSEAT];
  }
  function setWheelLabels(display, spoken) {
    if (display && display.length === NSEAT) seatLabels = display.slice();
    if (spoken && spoken.length === NSEAT) seatSpoken = spoken.slice();
  }

  // ---- lifecycle -------------------------------------------------------------
  function resize() {
    if (!canvas) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);   // DPR-3 phones get crisp rules (the budget allows it)
    var rect = canvas.getBoundingClientRect();
    W = Math.max(60, Math.round(rect.width));
    H = Math.max(60, Math.round(rect.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx2d = canvas.getContext("2d");
    G = pageGeom();
    function layer() { var l = document.createElement("canvas"); l.width = W * dpr; l.height = H * dpr; return l; }
    // the static staff layer (staves, brace, clefs), and the two ink layers
    // the page is re-engraved on each frame — the ward's, and the band's
    staffLayer = layer();
    var sctx = staffLayer.getContext("2d");
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStaffLayer(sctx);
    inkLayer = layer(); bandLayer = layer(); tapeLayer = layer();
    if (wheel) {
      var xr = wheel.getBoundingClientRect();
      XW = Math.max(60, Math.round(xr.width));
      XH = Math.max(60, Math.round(xr.height));
      wheel.width = XW * dpr; wheel.height = XH * dpr;
      xctx = wheel.getContext("2d");
      xctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function init(mainCanvas, wheelCanvas) {
    canvas = mainCanvas || null;
    wheel = wheelCanvas || null;
    if (!canvas && !wheel) return;
    resize();
    window.addEventListener("resize", resize);
    // the plates may be laid out after init (the stylesheet still loading):
    // re-measure whenever either canvas changes size
    if (typeof ResizeObserver === "function") {
      var armed = false, ro = new ResizeObserver(function () {
        if (armed) return; armed = true;
        requestAnimationFrame(function () {
          armed = false;
          var r1 = canvas ? canvas.getBoundingClientRect() : null, r2 = wheel ? wheel.getBoundingClientRect() : null;
          if ((r1 && (Math.round(r1.width) !== W || Math.round(r1.height) !== H)) ||
              (r2 && (Math.round(r2.width) !== XW || Math.round(r2.height) !== XH))) resize();
        });
      });
      if (canvas) ro.observe(canvas);
      if (wheel) ro.observe(wheel);
    }
    if (K) {
      if (K.setNoteListener) K.setNoteListener(onNote);
      if (K.setEventListener) K.setEventListener(onEvent);
    }
    running = true;
    requestAnimationFrame(frame);
  }
  function setConductor(c, isPlaying, isPaused) {
    if (c) cond = c;
    var was = playing;
    playing = !!isPlaying;
    paused = !!isPaused;
    // stopped: nothing more is struck (the "■" event usually got here first,
    // with the exact time; this catches a stop that came without it)
    if (was && !playing) silence(audioNow());
  }

  // Johnston's tuning marks on or off (the owner's call; TUNING_MARKS above):
  // from the next frame the page draws them or not (the room the page kept
  // before a marked head stays as it was set)
  function setTuningMarks(on) { TUNING_MARKS = !!on; }

  // (for the silent checks: what is on the page now — never used by the app)
  function probe() {
    return {
      PT: PT, sp: G ? G.sp : null, xE: G ? G.xE : null,
      groups: groups.map(function (gr) { return { layer: gr.layer, tp: gr.tp, st: gr.st, dir: gr.dir, x: gr.drawnAt === FRAME ? gr.lastX : null, voice: gr.voice || null, beam: gr.beam ? gr.beam.members.indexOf(gr) : null, heads: gr.heads.map(function (h) { return h.q + (h.heavy ? "H" : "") + (h.ghost ? "G" : "") + (h.acc || "") + (h.jm ? "j" : "") + (h.orn ? "o" : ""); }).join(","), flags: gr.flags, alone: gr.alone ? !!gr.aloneOk : null }; }),
      marks: marks.map(function (m) { return { kind: m.kind, type: m.type || null, tp: m.tp, x: X(m.tp) + (m.rel != null && G && m.relSp === G.sp ? m.rel : (m.off || 0) * (G ? G.sp : 0)), st: m.st || (m.sts || []).join(""), v: m.v, voice: m.voice, push: m.push ? m.push.dx : null }; }),
    };
  }

  return { init: init, setConductor: setConductor, setWheelLabels: setWheelLabels, wheelSeatAt: wheelSeatAt, setTuningMarks: setTuningMarks, probe: probe };
})();
