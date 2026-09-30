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
  // each note's length and broad-nib contrast on the open heads, each head
  // one clean strike (its halo and pale letterpress edge read as a blurred
  // second stroke, and were taken off in v0.36), pre-rendered once per size
  // at device resolution (the sprite atlas). One ink, hymnbook green, from the
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
    round: { ell: [0.59, 0.42, -0.36] },
    // (round 3c) a spoken syllable's cross: one filled mark, struck once —
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
    c.fill(full, "evenodd");                       // one clean strike: no ink spread, no second edge (the owner, v0.36)
    if (heavy) {                                   // the heavier head's rim: the outline struck once more
      c.strokeStyle = rgba(rgb); c.lineWidth = Math.max(0.6 * dpr, 0.07 * s); c.lineJoin = "round";
      var rim = new Path2D();
      if (SH[k].poly) polyTo(rim, SH[k].poly, s * HEAVY);
      else rim.ellipse(0, 0, SH[k].ell[0] * s * HEAVY, SH[k].ell[1] * s * HEAVY, SH[k].ell[2], 0, Math.PI * 2);
      c.stroke(rim);
    }
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
  // (the Hosanna is audio-only whatever it says: the owner's ruling, round 3c)
  function onNote(n) {
    if (!n || n.logged === false || n.hosanna) return;
    if (n.layer === "telegraph") { if (n.marks && n.marks.length) queueIntake({ note: n }); return; }
    if (n.layer === "band") { if (n.freq > 20) queueIntake({ note: n }); return; }
    if (NEW_GUEST_LAYERS[n.layer] || (n.layer === "voice" && n.speech)) { if (n.freq > 20) queueIntake({ note: n }); return; }   // (round 3c: THE NEW GUESTS)
    if (!n.freq || n.freq < 20 || !MELODIC[n.layer]) return;
    if (n.layer === "organ" && (n.part === "pedal" || n.pedal) && !n.variations) return;   // the 16′ under the bass: a stop drawn, not a note written (the variations' own pedal line: takeVariations)
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
    takeNewGuests(byLayer);                          // (round 3c: it takes its own out of byLayer)
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
  // each); fineBeat — the beat is the tune's own (valueOf); (round 3c) qOf —
  // a note's place and shape where it names them in a key of its own
  // (keyedQ); head — a guest's own mark on a head; scale — its size
  function takeLayer(layer, ns, beat, question, opt) {
    opt = opt || {};
    var byT = {}, voices = { T: {}, B: {} };
    ns.forEach(function (n) {
      var nq = (opt.qOf && opt.qOf(n)) || taggedQ(n) || noteQ(n.freq), st = opt.staff || staffOf(n, nq.q, opt.strict);
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
        var atOnce = [];
        keys.forEach(function (dk, gi) {
          var ps = byDur[dk], dur = ps[0].n.duration;
          var v = valueOf(dur / beat, layer, opt.fineBeat);
          var seen = {}, heads = [];
          ps.forEach(function (p) {
            if (seen[p.q]) return; seen[p.q] = 1;               // unison parts share a head
            var hd = { q: p.q, shape: p.shape, open: v.open, dots: v.dots };
            if (opt.head) opt.head(p.n, hd);                     // (a guest's own mark on its head: the fiddle's tune, a stressed syllable)
            heads.push(hd);
          });
          var grp = {
            layer: layer, tp: t0, dur: dur, st: st, heads: heads, v: v,
            scale: opt.scale || SCALE[layer] || 1, dir: 0, noStem: !v.stem, flags: v.flags
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
          if (!grp.noStem) atOnce.push(grp);
        });
        // (r3c-engrave2: two voices at once on a staff whose parts would stem
        // them alike — the organist's canon, both voices the tune, one of them
        // an octave down on the bass staff — are set as two voices share a
        // staff: the lower's stem down, the upper's up. Stemmed alike, the
        // lower's stem ran up through the upper's head, the page set it aside,
        // and the canon drifted from its time)
        if (atOnce.length > 1 && atOnce.every(function (gp) { return gp.dir === atOnce[0].dir; })) {
          atOnce[0].dir = -1; atOnce[0].alt = 0;
          atOnce[atOnce.length - 1].dir = 1; atOnce[atOnce.length - 1].alt = 0;
        }
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
  // THE NEW GUESTS ON THE STAFF (round 3c; handoff r3c-engrave-1)
  //
  // Nine guests came into the meeting in round 3c, and the staff sat nearly
  // blank under most of them. Each now prints in the page's own vocabulary,
  // as plainly as it can be written truly, in the one green ink; the far
  // ones paler, as the far choir and the old tune are:
  //
  //  · THE FAR TOWER's change ringing: every stroke a bell's ringed head,
  //    small and pale across the valley — rounds a stair of heads down the
  //    scale, the changes the same stair with its steps changed a pair at a
  //    time (takeTower);
  //  · THE HANDCART COMPANY's unison in octaves: the women's line (and the
  //    child's, the same heads) on the treble, the men's and the captain's
  //    an octave under it on the bass, in the key the company chose, pale as
  //    the road is far and fullest where it passes nearest (takeHandcart);
  //  · THE GULLS: each cry a small head with no stem, the lead gull's in the
  //    first hymn's own shapes — the head of the hymn, cried — and the
  //    flock's chatter round, not ours (takeGulls);
  //  · THE FAR WARD: the same hymn a line behind, in closed score, pale, as
  //    the far choir prints, and small, stepping aside for ours (takeFarWard);
  //  · THE SOCIAL HALL: the fiddle's reel (or jig, or quadrille) in small heads,
  //    the hymn's own notes in it a heavier head, its running eighths beamed
  //    by the beat, a bar at each bar, a double bar where a strain goes
  //    round or the next begins, the final bar after its last double stop;
  //    its cuts and slides marked; the open string it leans on a whole note
  //    under the tune; the caller's calls as spoken heads (takeFiddle,
  //    takeSpoken);
  //  · THE TESTIMONY-BEARERS: speech written as speech — a cross for each
  //    syllable at its pitch, no stem (it keeps no beat), the stressed ones
  //    heavier; the reed that plays the words back does so in the words'
  //    own rhythm, so its heads have no stems either, and a note it plays
  //    with the speaker shares the speaker's head; the tune it makes of them
  //    prints as any tune (takeSpoken, takeReedWords);
  //  · THE GIFT OF TONGUES: one line on the staff that suits it, a slur over
  //    each melisma, its quick notes a singer's run (small, beamed); the
  //    ward's hummed chord in its four parts (takeTongues);
  //  · THE ORGANIST'S VARIATIONS: the organ alone, as it prints, with a bar
  //    where the Score has one (the theme, the trio's tune in the pedals,
  //    the finale; the re-barred dances keep none), and the bitonal
  //    interlude's own bass (takeVariations).
  //
  // The Hosanna never prints (the owner's ruling: audio-only; onNote).
  // Nothing here is text, and nothing moves but the scroll and the drying.
  // ==========================================================================
  var NEW_GUEST_LAYERS = { fiddle: 1, handcart: 1, gulls: 1, tower: 1, farward: 1 };
  // A note's place and shape in a key of its own, as the note names it: its
  // degree (deg), else its interval (monzo), else its sound — counted from
  // the key's tonic (keyM, from the day's keynote), in the octave it sounds
  // in; its shape the syllable it is sung on in that key's mode.
  function keyedQ(freq, keyM, deg, monzo, mode) {
    var tonic = (cond.f0 || 65) * 4 * Math.pow(2, (keyM ? monzoCents(keyM) : 0) / 1200);
    var c = typeof deg === "number" ? null : monzo ? monzoCents(monzo) : 1200 * Math.log2(freq / tonic);
    var st = c == null ? deg : Math.round(c * 7 / 1200);
    st += 7 * Math.round(Math.log2(freq / tonic) - (c == null ? deg / 7 : c / 1200));
    var q = Q_MID + keySteps(keyM) + st;
    while (q < -24) q += 7;                        // (a guard only: the page folds at draw time)
    while (q > 44) q -= 7;
    return { q: q, shape: shapeOfDeg(mode || cond.mode, st) };
  }
  // (the groups one takeLayer call made, and a guest's own cap on them; line:
  // the one line they make, which reads in the order it is sung — orderAt)
  function madeSince(g0, cap, line) {
    var out = groups.slice(g0);
    if (cap != null) out.forEach(function (gr) { gr.cap = cap; gr.tight = true; if (line) gr.line = line; });
    return out;
  }
  // "free" notes — a cry, a syllable, a bell's stroke: heads with no stem
  function unstemmed(gs, open) {
    gs.forEach(function (gr) {
      gr.noStem = true; gr.flags = 0;
      gr.heads.forEach(function (h) { h.open = !!open; h.dots = 0; });
    });
  }
  // One call's notes, read by guest. The guests with layers of their own
  // come whole; those on the house's layers (the gift and the caller on the
  // choir's, the reeds that answer a testimony, the organist's variations)
  // are taken out of theirs by what their notes say, and the rest of the
  // house's notes print as they always have.
  function takeNewGuests(byLayer) {
    function pull(layer, test) {
      var ns = byLayer[layer];
      if (!ns) return [];
      var mine = ns.filter(test), rest = ns.filter(function (n) { return !test(n); });
      if (rest.length) byLayer[layer] = rest; else delete byLayer[layer];
      return mine;
    }
    function own(layer, fn) { if (byLayer[layer]) { fn(byLayer[layer]); delete byLayer[layer]; } }
    own("tower", takeTower);
    own("handcart", takeHandcart);
    own("gulls", takeGulls);
    own("farward", takeFarWard);
    own("fiddle", takeFiddle);
    own("voice", function (ns) { takeSpoken(ns, "voice"); });
    var calls = pull("choir", function (n) { return n.guest === "socialhall"; });
    if (calls.length) takeSpoken(calls, "choir");
    var gift = pull("choir", function (n) { return n.guest === "tongues" && n.role === "tongues"; });
    if (gift.length) takeTongues(gift);
    var hum = pull("choir", function (n) { return n.guest === "tongues" && n.role === "hum"; });
    if (hum.length) takeHum(hum);
    ["harmonium", "clarinet"].forEach(function (ly) {
      var words = pull(ly, function (n) { return n.testimony && (n.move === "echo" || n.move === "double"); });
      if (words.length) takeReedWords(words, ly);
    });
    var vars = pull("organ", function (n) { return n.variations; });
    if (vars.length) takeVariations(vars);
  }

  // ---- change ringing from a far tower ----------------------------------------
  // Each stroke a bell's head, ringed as the steeples' bells are, small and
  // pale: the tower is across the valley. Rounds print as a stair of heads
  // down the scale, row after row, the handstroke's pause the page's own
  // time; the changes as the same stair with its steps swapped a pair at a
  // time, so the method can be read from the heads alone (the ringers' blue
  // line is the path one bell's head takes through the rows; the page leaves
  // it to the eye, as it leaves the words). A muffled touch is paler still.
  // (Round 2: the head is filled, and its ring stands a fifth of a space off
  // it — a hollow head in a ring that hugged it read as two outlines, one
  // inside the other: the second stroke the owner ruled out. The ring is the
  // bell's one outline, 0.4 sp round about a smaller head: two strokes a
  // step apart (1.15 sp at the page's rate) stand clear of each other with
  // room to spare, so a stroke pushed aside catches up within a few. The
  // peal is one line, printed in the order it is rung — the method is read
  // from that order.)
  var TOWER_INK = 0.5, TOWER_MUFFLED = 0.32, TOWER_SCALE = 0.3, TOWER_RING = 1.333;   // (small: a peal's strokes come a staff space apart at the page's rate; the ring, in the head's own size: 0.4 sp)
  function takeTower(ns) {
    var g0 = groups.length;
    takeLayer("tower", ns, 1, null, { scale: TOWER_SCALE, ink: ns[0].muffled ? TOWER_MUFFLED : TOWER_INK,
      qOf: function (n) { return keyedQ(n.freq, null, null, n.monzo, cond.mode); } });
    var gs = madeSince(g0, 1, "peal");
    unstemmed(gs, false);
    gs.forEach(function (gr) { gr.ring = true; gr.ringK = TOWER_RING; });
  }

  // ---- the gulls ---------------------------------------------------------------
  // A cry is not a note of a tune, and keeps no beat: each prints as a small
  // head with no stem, where it is cried and as loud as it carries. The lead
  // gull's cries trace the head of the day's first hymn, so its heads are the
  // hymn's own shapes on the hymn's own degrees (the joke, made visible); the
  // flock's chatter prints round, as a stranger's notes do.
  var GULL_SCALE = 0.6, CHATTER_SCALE = 0.5;
  function takeGulls(ns) {
    ns.forEach(function (n) {
      var h = n.hymnId ? hymnOf(n.hymnId) : null, lead = typeof n.deg === "number", g0 = groups.length;
      takeLayer("gulls", [n], 1, null, { scale: lead ? GULL_SCALE : CHATTER_SCALE, ink: clamp(0.2 + 0.8 * (n.loud == null ? 0.5 : n.loud), 0.25, 0.9),
        qOf: function (m) {
          if (lead) return keyedQ(m.freq, h && h.keyMonzo, m.deg, null, h && h.mode);
          return { q: noteQ(m.freq).q, shape: "round" };
        } });
      unstemmed(madeSince(g0, 1, "gulls"), false);   // (r3c-engrave2: the flock's cries print in the order they are cried, a hair apart where they come together)
    });
  }

  // ---- the far ward ------------------------------------------------------------
  // Another congregation across the valley, singing our hymn a line behind
  // us in its own tuning: printed as the far trombone choir is, in closed
  // score and pale, each part on its own staff with its own stem, placed by
  // the degree it sings in the hymn's key and written in our verse's beat —
  // at grace size (it is across the valley, and it sings on our beats: four
  // voices to a staff, where full heads would crowd our bars), and it gives
  // way to our hymn: on a beat it shares with us our notes are set first and
  // its notes step aside for them, and it waits for a bar of ours just after
  // it (barWaits). Nothing of either is printed over the other.
  var FARWARD_INK = 0.42, FARWARD_SCALE = 0.6;
  function takeFarWard(ns) {
    var h = hymnOf(ns[0].hymnId), mode = h.mode || cond.mode;
    var beat = h.bs || estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.farward || lastBeat.choir || 1.15);
    if (!h.bs && ns.length >= 3) lastBeat.farward = beat;
    var g0 = groups.length;
    takeLayer("farward", ns, beat, null, { strict: true, ink: FARWARD_INK, fineBeat: !!h.bs, scale: FARWARD_SCALE,
      qOf: function (n) { return typeof n.deg === "number" ? keyedQ(n.freq, h.keyMonzo, n.deg, null, mode) : null; } });
    // (r3c-engrave2: and on each staff its notes read left to right in the
    // order they are sung, whichever part sings them — a part's note set
    // late no longer prints after a later note of the other part: orderAt)
    madeSince(g0, 1.5, "farward").forEach(function (gr) { gr.yields = true; });
  }

  // ---- the handcart company ----------------------------------------------------
  // ALL IS WELL in unison as the company walks: the women (and the child
  // among them) on the treble, the men and the captain an octave under them
  // on the bass — one line in octaves, each voice its own stem. The company
  // sings in a key of its own choosing (the day's, its dominant's or its
  // subdominant's), read from its notes, and the heads are that key's shapes.
  // Its beat is the tune's own (each note says where it falls in its line).
  // It is always far off: pale, and palest at either end of the road. Each
  // throat's line comes on its own, so a head another voice has already
  // printed at that place is not printed again (the unison shares a head).
  var COMPANY_KEYS = [[0, 0, 0, 0], [-1, 1, 0, 0], [2, -1, 0, 0]];
  var company = null;
  function companyKey(ns) {
    var K0 = (cond.f0 || 65) * 4, best = null, bc = 1e9, R = COLLECTIONS.ionian.concat([2]);
    COMPANY_KEYS.forEach(function (k) {
      var tonic = K0 * Math.pow(2, monzoCents(k) / 1200), cost = 0;
      ns.forEach(function (n) {
        var r = Math.log2(n.freq / tonic); r -= Math.floor(r);
        var e = 1;
        for (var i = 0; i < R.length; i++) e = Math.min(e, Math.abs(r - Math.log2(R[i])));
        cost += e;
      });
      if (cost < bc - 1e-9) { bc = cost; best = k; }
    });
    return best;
  }
  function takeHandcart(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var t0 = ns[0].startTime;
    if (!company || t0 - company.t1 > 40) company = { key: companyKey(ns), t1: t0, seen: {}, beat: 0 };
    var rs = [], loud = 0;
    for (var i = 1; i < ns.length; i++) {
      var a = ns[i - 1], b = ns[i];
      if (a.line === b.line && a.verse === b.verse && typeof a.beat === "number" && typeof b.beat === "number" && b.beat > a.beat)
        rs.push((b.startTime - a.startTime) / (b.beat - a.beat));
    }
    rs.sort(function (x, y) { return x - y; });
    if (rs.length >= 2) company.beat = clamp(rs[rs.length >> 1], 0.3, 3);
    var beat = company.beat || estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.choir || 1.15);
    // (a walking company sings its notes short of their length, and breathes:
    // each note is written for as long as the tune gives it, to the next
    // note's beat in its line — the last of a line as it is sung)
    var written = {};
    if (company.beat) ns.forEach(function (n, i) {
      for (var j = i + 1; j < ns.length; j++) {
        var m = ns[j];
        if (m.voice !== n.voice || m.verse !== n.verse || m.line !== n.line || typeof m.beat !== "number" || typeof n.beat !== "number") continue;
        if (m.beat > n.beat) { written[i] = (m.beat - n.beat) * beat; break; }
      }
    });
    var key = company.key, mine = [];
    ns.forEach(function (n, i) {
      var nq = keyedQ(n.freq, key, null, null, "ionian"), at = company.seen[nq.q] = company.seen[nq.q] || [];
      company.t1 = Math.max(company.t1, n.startTime + n.duration);
      for (var j = 0; j < at.length; j++) if (Math.abs(at[j] - n.startTime) < 0.12) return;
      at.push(n.startTime);
      loud += n.loud == null ? 0.5 : n.loud;
      mine.push({ freq: n.freq, startTime: n.startTime, duration: written[i] || n.duration, part: n.octave < 0 ? "B" : "S", nq: nq });
    });
    Object.keys(company.seen).forEach(function (q) { company.seen[q] = company.seen[q].filter(function (t) { return t > t0 - 30; }); });
    if (!mine.length) return;
    var g0 = groups.length;
    takeLayer("handcart", mine, beat, null, { strict: true, fineBeat: !!company.beat, ink: clamp(0.14 + 0.42 * loud / mine.length, 0.18, 0.56),
      qOf: function (n) { return n.nq; } });
    madeSince(g0, 1.5, "company");
  }

  // ---- the Social Hall ---------------------------------------------------------
  // The fiddle's dance, made of one of the day's hymns, printed as a fiddler's
  // tunebook prints a reel: on the treble in small heads (it runs in eighths
  // a staff space apart at the page's rate, and each bar must find its room
  // between them: at full size the bars would stand on the ink), the hymn's
  // own notes in it a heavier head — the tune marked, as in the hymns — and
  // the fiddler's figures between them plain; a double stop two heads on one
  // stem; the running eighths beamed within the beat (in pairs in 2/4, in
  // threes in 6/8); a bar at each bar; a double bar where a strain goes round again or
  // the next begins; the final bar after its last double stop. Its cuts and
  // slides are marked where the fiddler plays them (the Old Way's signs: a
  // grace, a slide). The open string it leans on is a whole note, where it
  // sounds. The notes are placed in the danced hymn's key, by their degree.
  // The fiddle is in the room with us, a step nearer than the ward: full ink.
  var FIDDLE_SCALE = 0.55, FIDDLE_CAP = 3;
  var FIDDLE_TUNE = { tune: 1, cad: 1 }, FIDDLE_ORN = { cut: "grace", slide: "slide" };
  var hall = null;                                 // the dance being printed: its hymn, its eighth, where its bars fall
  function fiddleEighth(ns) {                      // the running note: the shortest length the fiddle keeps to
    var bins = {}, mx = 0;
    ns.forEach(function (n) {
      if (n.part === "drone" || n.part === "stop" || !(n.duration > 0.08 && n.duration < 0.6)) return;
      var k = Math.round(Math.log2(n.duration) * 25);
      bins[k] = (bins[k] || 0) + 1; mx = Math.max(mx, bins[k]);
    });
    var ks = Object.keys(bins).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < ks.length; i++) if (bins[ks[i]] >= 0.25 * mx && bins[ks[i]] >= 2) return Math.pow(2, ks[i] / 25);
    return 0;
  }
  function takeFiddle(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var id = ns[0].dances || null, t0 = ns[0].startTime;
    if (!hall || hall.id !== id || t0 - hall.t1 > 20) hall = { id: id, e: 0, last: null, bars: [], lens: [], finalAt: 0, finalBar: null, t1: t0 };
    var h = id ? hymnOf(id) : {}, keyM = h.keyMonzo || null, mode = h.mode || cond.mode;
    if (!hall.e) hall.e = fiddleEighth(ns);
    var beat = 2 * (hall.e || 0.19);
    ns.forEach(function (n) { hall.t1 = Math.max(hall.t1, n.startTime + n.duration); });
    var line = ns.filter(function (n) { return n.part !== "drone"; }), drones = ns.filter(function (n) { return n.part === "drone"; });
    var qOf = function (n) { return keyedQ(n.freq, keyM, n.deg, n.monzo, mode); };
    var g0 = groups.length;
    if (line.length) takeLayer("fiddle", line, beat, null, { staff: "T", scale: FIDDLE_SCALE, fineBeat: true, qOf: qOf,
      head: function (n, hd) { if (FIDDLE_TUNE[n.part]) hd.heavy = true; if (FIDDLE_ORN[n.orn]) hd.orn = FIDDLE_ORN[n.orn]; } });
    var made = madeSince(g0, FIDDLE_CAP, "fiddle");
    if (drones.length) {
      var d0 = groups.length;
      takeLayer("fiddle", drones, beat, null, { scale: FIDDLE_SCALE, qOf: qOf });
      madeSince(d0, FIDDLE_CAP);
    }
    fiddleBars(made, line);
    fiddleBeams(made);
  }
  // Where the dance's bars fall: each note names its strain, the time
  // through, its line and its bar, and a bar begins wherever that changes.
  // A double bar where a strain begins, or goes round again (its line or its
  // bar going back: the AA, the BB, the tag), the final bar where the last
  // double stop ends. Each bar is set as the hymn's are (barPlace): clear of
  // the ink either side, its downbeat's notes making room for it if they must.
  function fiddleBars(made, ns) {
    var at = {};
    made.forEach(function (gr) { if (gr.st === "T") { var k = Math.round(gr.tp * 1000); (at[k] = at[k] || []).push(gr); } });
    ns.forEach(function (n) {
      if (n.part === "stop") return;
      var fin = n.part === "final" || n.strain == null, L = hall.last;
      var cur = fin ? { strain: "final" } : { strain: n.strain + "|" + n.time, line: n.line, bar: n.bar };
      if (fin) hall.finalAt = Math.max(hall.finalAt || 0, n.startTime + n.duration);
      if (L && L.strain === cur.strain && L.line === cur.line && L.bar === cur.bar) return;
      hall.last = cur;
      var prev = hall.bars.length ? hall.bars[hall.bars.length - 1] : null;
      hall.bars.push(n.startTime);                  // (the dance's first note begins its first bar: no bar before it)
      if (!L || prev == null || n.startTime <= prev + 1e-6) return;
      var round = L.strain === cur.strain && (cur.line < L.line || (cur.line === L.line && cur.bar < L.bar));
      var type = !fin && (L.strain !== cur.strain || round) ? "double" : "single";
      fiddleBar(type, n.startTime, at[Math.round(n.startTime * 1000)] || []);
      hall.lens.push(Math.round((n.startTime - prev) / (hall.e || 0.19)));
    });
    if (hall.bars.length > 64) hall.bars.splice(0, hall.bars.length - 64);
    if (hall.lens.length > 64) hall.lens.splice(0, hall.lens.length - 64);
    if (hall.finalAt && !hall.finalBar) hall.finalBar = fiddleBar("final", hall.finalAt, []);
  }
  function fiddleBar(type, tp, nx) {
    var bm = { kind: "bar", type: type, tp: tp, sts: ["T"], off: type === "final" ? 0 : -1, pv: [], pvRests: [], nx: nx, sys: { hymnId: null } };
    nx.forEach(function (gp) { gp.barIn = bm; });
    marks.push(bm);
    return bm;
  }
  // The running eighths beamed within the beat: in threes where the bar
  // holds six of them (a jig, a 6/8 quadrille), else in pairs; a longer note
  // or a bar breaks the beam. The beam takes the position rule over its notes.
  function fiddleBeams(made) {
    var six = 0;
    hall.lens.forEach(function (k) { if (k === 6 || k === 3) six++; });
    var win = (six * 2 > hall.lens.length ? 3 : 2) * (hall.e || 0.19);
    var run = [], key = null;
    function close() { if (run.length > 1) { makeBeam(run, "T"); run[0].beam.fixed = 0; } run = []; key = null; }
    made.filter(function (gr) { return gr.st === "T" && !gr.noStem; }).sort(function (a, b) { return a.tp - b.tp; }).forEach(function (gr) {
      if (gr.barIn || !(gr.flags >= 1) || (run.length && Math.abs(run[run.length - 1].tp - gr.tp) < 1e-6)) close();
      if (!(gr.flags >= 1)) return;
      var ref = gr.tp;                             // (the bar it lies in)
      for (var i = 0; i < hall.bars.length; i++) if (hall.bars[i] <= gr.tp + 1e-6) ref = hall.bars[i];
      var k = ref + ":" + Math.floor((gr.tp - ref) / win + 0.02);
      if (key != null && k !== key) close();
      key = k; run.push(gr);
    });
    close();
  }

  // ---- speech: the testimony-bearers, and the caller ------------------------------
  // Speech is written as speech has long been written in music: a cross for
  // each syllable, at the pitch it is spoken on, and no stem — it keeps no
  // beat. A stressed syllable is a heavier cross. The caller's calls are the
  // same (chanted on the tune's fifth, but spoken, not sung).
  var spoken = [];                                 // (the syllables just printed: a reed that plays with the speaker shares them)
  // (round 2: two crosses side by side keep a fifth of a space between them —
  // closer, their arms met tip to tip and read as one mark, XX)
  var SPOKEN_AIR = 0.2;
  function takeSpoken(ns, layer) {
    var g0 = groups.length;
    takeLayer(layer === "voice" ? "voice" : "caller", ns, 1, null, { shape: "x",
      head: function (n, hd) { if (n.accent) hd.heavy = true; } });
    var gs = madeSince(g0, 3, "speech"), tl = 0;             // (a call on a strain's downbeat stands clear of its double bar)
    unstemmed(gs, false);
    gs.forEach(function (gr) { tl = Math.max(tl, gr.tp); gr.air = SPOKEN_AIR; gr.heads.forEach(function (h) { spoken.push({ tp: gr.tp, q: h.q }); }); });
    while (spoken.length && spoken[0].tp < tl - 40) spoken.shift();
  }
  // The reed that answers a testimony: where it plays the words back, or
  // with the speaker, it keeps the words' own rhythm, so its heads have no
  // stems either (its size the reed's own: the harmonium's grace, the
  // clarinet's cue); a note it plays with the speaker, on the speaker's
  // place, is the speaker's head already. The tune it makes of the words
  // prints as a tune (it is left to the house's own reading).
  function takeReedWords(ns, layer) {
    var mine = ns.filter(function (n) {
      if (n.move !== "double") return true;
      var q = noteQ(n.freq).q;
      for (var i = spoken.length - 1; i >= 0; i--) if (spoken[i].q === q && Math.abs(spoken[i].tp - n.startTime) < 0.06) return false;
      return true;
    });
    if (!mine.length) return;
    var g0 = groups.length;
    takeLayer(layer, mine, 1, null, {});
    unstemmed(madeSince(g0, 1), false);
  }

  // ---- the gift of tongues -----------------------------------------------------
  // One of the ward rises and sings a free song: one line on the staff it
  // sits best on (as the old tune is set), at its values in the beat it is
  // sung to, its stems by where its heads lie; a slur over each melisma, from
  // the syllable's first note to its last. The ward's hummed chord at the end
  // prints in its four parts, a head a part (takeHum, below).
  var TONGUES_RUN = 0.55;
  function takeTongues(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var beat = estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.tongues || lastBeat.choir || 1.15);
    if (ns.length >= 3) lastBeat.tongues = beat;
    var cT = 0, cB = 0, line = ns.map(function (n) {
      var nq = keyedQ(n.freq, null, n.deg, n.monzo, cond.mode);
      cT += ledgerCost("T", nq.q); cB += ledgerCost("B", nq.q);
      return { freq: n.freq, startTime: n.startTime, duration: n.duration, nq: nq, slur: !!n.slur };
    });
    var st = cT <= cB ? "T" : "B", g0 = groups.length;
    takeLayer("choir", line, beat, null, { staff: st, qOf: function (n) { return n.nq; } });
    var at = {};
    madeSince(g0, 1.5, "tongues").forEach(function (gr) { at[Math.round(gr.tp * 1000)] = gr; });
    var first = null, last = null, run = [], seg = [];
    function slur() {
      if (first && last && last.grp !== first.grp) marks.push({ kind: "slur", tp: first.grp.tp, tp2: last.grp.tp, g1: first.grp, g2: last.grp, q1: first.q, q2: last.q, st: st, line: seg.slice() });
      first = last = null; seg = [];
    }
    function beamRun() { if (run.length > 1) { makeBeam(run, st); run[0].beam.fixed = 0; } run = []; }
    line.forEach(function (x) {
      var grp = at[Math.round(x.startTime * 1000)];
      if (!grp) return;
      if (!x.slur) { beamRun(); slur(); first = { grp: grp, q: x.nq.q }; seg = [grp]; }
      else if (first) { last = { grp: grp, q: x.nq.q }; if (seg.indexOf(grp) < 0) seg.push(grp); }
      // (a melisma's quick notes, quicker than the page can print full
      // heads, are the singer's run: small notes, beamed, under the slur)
      if (x.slur && x.duration < 0.6 * beat) { grp.scale = TONGUES_RUN; if (grp.flags >= 1 && !grp.noStem) run.push(grp); else beamRun(); }
      else if (x.slur) beamRun();
    });
    beamRun();
    slur();
  }
  // The ward hums the song's last note: every throat of a part on one note,
  // each entering a moment after the last, over a second or two and across
  // the engine's calls. A part prints once, one head however many throats
  // hum it (as the whole ward's unison does), from its first throat's entry.
  var hummed = [];
  function takeHum(ns) {
    var mode = cond.mode, fresh = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; }).filter(function (n) {
      var q = keyedQ(n.freq, null, n.deg, n.monzo, mode).q;
      for (var i = 0; i < hummed.length; i++) if (hummed[i].part === n.part && hummed[i].q === q && Math.abs(n.startTime - hummed[i].t) < 3) return false;
      hummed.push({ part: n.part, q: q, t: n.startTime });
      return true;
    });
    while (hummed.length > 32) hummed.shift();
    if (!fresh.length) return;
    var g0 = groups.length;
    takeLayer("choir", fresh, lastBeat.tongues || lastBeat.choir || 1.15, null, { qOf: function (n) { return keyedQ(n.freq, null, n.deg, n.monzo, mode); } });
    madeSince(g0, 1.5);
  }

  // ---- the organist's variations ------------------------------------------------
  // The organ alone, printed as the organ alone prints (chords on shared
  // stems, only where no one sings over it), in the beat the set is played
  // to — the theme's notes say where they fall in their line, so the beat is
  // read from them, as the old tune's is — with a bar wherever the Score has
  // one: at each note that falls on a downbeat of the hymn's mode of time,
  // counted from its line's place in the bar. The dances are re-barred (a
  // minuet in 3/4, a march in 2/4) and their notes say no beat: they keep no
  // bars rather than the wrong ones. The pedal doubles the manuals' bass
  // through the set (a 16′ under it, not written, as ever) — except in the
  // bitonal interlude, where it plays the other key's bass alone: that line
  // is written.
  var varBars = [];                                // (the downbeats already barred: a phrase's notes may come in two calls)
  var varSet = null;                               // (the set being printed: its hymn, each part's last note, the beats read)
  function takeVariations(ns) {
    ns = ns.filter(function (n) {
      if (n.part !== "pedal" && !n.pedal) return true;
      for (var i = 0; i < ns.length; i++) {
        var m = ns[i], d = Math.log2(m.freq / n.freq);
        if (m.part === "B" && Math.abs(m.startTime - n.startTime) < 0.03 && Math.abs(d - Math.round(d)) < 0.02) return false;
      }
      return true;
    });
    if (!ns.length) return;
    // (the organist lays the set a chord at a time, so the beat is read
    // across the calls: each part's note against its last in the same line)
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var h = ns[0].hymnId ? hymnOf(ns[0].hymnId) : null, sc = h && h.score;
    if (!varSet || varSet.id !== (h && h.id) || ns[0].startTime - varSet.t1 > 12) varSet = { id: h && h.id, prev: {}, rs: [], t1: 0 };
    ns.forEach(function (n) {
      varSet.t1 = Math.max(varSet.t1, n.startTime + n.duration);
      if (typeof n.beat !== "number" || n.line == null) return;
      var k = n.part + "|" + n.line, p = varSet.prev[k];
      if (p && n.beat > p.beat && n.startTime > p.t + 0.02) varSet.rs.push((n.startTime - p.t) / (n.beat - p.beat));
      varSet.prev[k] = { t: n.startTime, beat: n.beat };
    });
    while (varSet.rs.length > 24) varSet.rs.shift();
    var rs = varSet.rs.slice().sort(function (a, b) { return a - b; });
    var fine = rs.length >= 2, beat = fine ? clamp(rs[rs.length >> 1], 0.3, 2.4)
      : estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.organ || lastBeat.choir || 1.15);
    ns.forEach(function (n) {                      // (where the beat falls: the last note that names its beat)
      if (typeof n.beat === "number" && Math.abs(n.beat - Math.round(n.beat)) < 1e-6) varSet.ref = { t: n.startTime, b: n.beat };
    });
    var g0 = groups.length;
    takeLayer("organ", ns, beat, null, { fineBeat: fine, head: function (n, hd) { if (n.part === "fig") hd.fig = true; } });
    var made = madeSince(g0, 2);
    varFigures(made, fine ? beat : 0);
    if (!sc || !sc.lines) return;
    var vl = sc.lines.concat(sc.refrain || []), ts = timeSig(h.modeOfTime), downs = [];
    // (r3c-engrave2: in the canon, and in the two keys' interlude, a voice
    // follows the leader a beat or two behind, counting the tune's beats as
    // its own — and its downbeats are not the bar's. Barred at both, the
    // canon had a bar every half bar, and each pushed the notes after it
    // further from their time, until they stood 14 spaces late. A canon is
    // barred by its leader: a note names a downbeat only where its line's
    // count began with the earliest voice's — lead)
    varSet.lead = varSet.lead || {};
    function lead(n) {
      var o = n.startTime - n.beat * beat, ls = varSet.lead[n.line] || (varSet.lead[n.line] = []);
      var win = 2 * ts.bar * beat, tol = 0.25 * beat;
      for (var i = ls.length - 1; i >= 0; i--) {
        var d = o - ls[i];
        if (d <= -win || d >= win) continue;
        if (d < -tol) { ls[i] = o; return true; }  // (an earlier voice: the leader after all)
        return d < tol;
      }
      ls.push(o);
      if (ls.length > 8) ls.shift();
      return true;
    }
    ns.forEach(function (n) {
      var ln = typeof n.beat === "number" && n.line != null ? vl[n.line] : null;
      if (!ln || !lead(n)) return;
      var pos = ((n.beat + (ln.barStart || 0)) % ts.bar + ts.bar) % ts.bar;
      if (pos > 1e-6 && ts.bar - pos > 1e-6) return;
      if (!downs.some(function (t) { return Math.abs(t - n.startTime) < 0.03; })) downs.push(n.startTime);
    });
    // (r3c-engrave2: every note on a bar's downbeat stands after it, whichever
    // call brought it — the organist lays a chord at a time, and the pedal or
    // the figure on the downbeat may come a call before the bar or after it.
    // Only notes not yet set: nothing printed moves)
    function onDown(gr, bm) { return gr.layer === "organ" && !gr.col && !gr.noCol && gr.drawnAt == null && Math.abs(gr.tp - bm.tp) < 0.03; }
    made.forEach(function (gr) {
      for (var i = 0; i < varBars.length; i++) {
        var vb = varBars[i];
        if (vb.at || !onDown(gr, vb) || vb.nx.indexOf(gr) >= 0) continue;
        if (!vb.nx.some(function (m) { return m.col; })) vb.push = null;   // (its room worked out again, while none of its notes is set)
        vb.nx.push(gr); gr.barIn = vb;
      }
    });
    downs.sort(function (a, b) { return a - b; }).forEach(function (tb) {
      if (varBars.some(function (vb) { return Math.abs(vb.tp - tb) < 0.03; })) return;
      var before = groups.some(function (gr) { return gr.layer === "organ" && gr.tp < tb - 0.03 && gr.tp > tb - 6; });
      if (!before) return;                         // (no bar before the set's first note)
      // (through both staves, as an organ's bars run: a figure laid in a
      // call of its own keeps clear of the bar where it falls — clearance)
      var bm = { kind: "bar", type: "single", tp: tb, sts: ["T", "B"], off: -1, pv: [], pvRests: [], nx: [], sys: { hymnId: null } };
      groups.forEach(function (gr) { if (onDown(gr, bm)) bm.nx.push(gr); });
      bm.nx.forEach(function (gp) { gp.barIn = bm; });
      varBars.push(bm);
      marks.push(bm);
    });
    while (varBars.length > 64) varBars.shift();
  }
  // The organist's running figure (the trio's right hand, a dance's
  // accompaniment: its notes say no line) runs a staff space apart at the
  // page's rate: it prints small, the tune and its parts full, and its
  // quick notes are beamed within the beat. (Round 2: 0.6, near the fiddle's
  // reel. At cue size a head and its air all but filled the time between two
  // of its notes at 860 px, so a note pushed once could never catch up, and
  // the figure and the bars after it drifted a dozen spaces from their
  // time.) The organist lays them a note at
  // a time, seconds ahead, so a beam is joined across the calls — only while
  // none of its notes has yet been set on the page (nothing printed moves).
  // (Round 2: while the figure runs over them on the treble — the trio's
  // flutes over the hymn's chords, the alto held under them — the staff is
  // two voices, set as two voices share a staff: the figure's stems up, the
  // chords' down. Else a figure's head fell on a chord's stem at the same
  // beat, and the two leapfrogged each other along the page. Only notes not
  // yet set are turned: nothing printed moves.)
  var VAR_FIG_SCALE = 0.6, VAR_UNDER_S = 1.5;
  function figOnly(gr) { return gr.heads.every(function (h) { return h.fig; }); }
  function varUnder(t) {
    groups.forEach(function (A) {
      if (A.layer === "organ" && A.st === "T" && !A.col && A.drawnAt == null && !A.beam && Math.abs(A.tp - t) < VAR_UNDER_S && !figOnly(A)) { A.dir = -1; A.alt = 0; }
    });
  }
  function varFigures(made, beatS) {
    made.forEach(function (gr) {
      if (!figOnly(gr)) {
        if (gr.st === "T" && varSet.figT != null && Math.abs(gr.tp - varSet.figT) < VAR_UNDER_S) { gr.dir = -1; gr.alt = 0; }
        return;
      }
      gr.scale = VAR_FIG_SCALE; gr.line = "fig";
      if (gr.st === "T") { gr.dir = 1; gr.alt = 0; varSet.figT = gr.tp; varUnder(gr.tp); }
      var run = varSet.run, ref = varSet.ref;
      if (!(gr.flags >= 1) || gr.noStem || !(beatS > 0) || !ref) { varSet.run = null; return; }
      var key = gr.st + ":" + (ref.b + Math.floor((gr.tp - ref.t) / beatS + 0.02));
      var open = run && run.key === key && run.gs[run.gs.length - 1].tp < gr.tp - 1e-6 &&
        run.gs.every(function (m) { return !m.col && m.drawnAt == null; }) && !(run.gs[0].beam && run.gs[0].beam.laid);   // (nor once its line has been looked along: beamLay)
      if (!open) { varSet.run = { key: key, gs: [gr] }; return; }
      run.gs.push(gr);
      if (run.gs[0].beam) { run.gs[0].beam.members.push(gr); gr.beam = run.gs[0].beam; gr.beam.geo = null; }
      else { makeBeam(run.gs, gr.st); gr.beam.fixed = 0; }
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
  var givenOut = [];                               // (the lines the organ has given out, engraved: r3c-engrave2)
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
    // (r3c-engrave2: the organist gives the line out a chord at a time, and
    // each chord came here alone and engraved the whole line again from the
    // Score, its clock fitted from that one chord — two or three copies of
    // every chord, a hair or a beat apart, one over another: the doubled,
    // smeared notes at the head of every accompanied hymn. A line given out
    // is engraved once, from its first chord; the rest of its chords find it
    // already on the page)
    if (giving) {
      var gk = lineKey(first);
      if (givenOut.some(function (e) { return e.k === gk && t0 < e.t1 && T(span) > e.t0; })) return true;
      givenOut.push({ k: gk, t0: t0, t1: tEnd });
      if (givenOut.length > 40) givenOut.shift();
    }
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
      xs.forEach(function (x) { x.two = two; });   // (r3c-engrave2: a tie or slur of a voice that shares its staff keeps to the voice's side)
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
    // (r3c-engrave2: where two voices share the staff, the upper voice's
    // curve lies above and the lower's below — each on its own side, as an
    // engraver sets them; alone on its staff, its stems decide: settleCurve)
    function vside(x) { return x.two && !x.hop && x.dir ? (x.dir > 0 ? -1 : 1) : 0; }
    parts.forEach(function (p) {
      var xs = W.filter(function (x) { return x.p === p; }).sort(function (a, b) { return a.b - b.b; });
      xs.forEach(function (x, i) {
        var y = xs[i + 1];
        if (x.tieOn && y && x.grp && y.grp && x.st === y.st) marks.push({ kind: "tie", tp: x.tp, tp2: y.tp, g1: x.grp, g2: y.grp, q1: x.q, q2: y.q, st: x.st, sys: sys, vside: vside(x) });
      });
      if (p !== melody) return;
      function cont(x) { return x.n.syl == null || x.seg > 0; }   // (a melisma's later notes; a tied note's continuation)
      for (var i = 0; i < xs.length; i++) {
        if (cont(xs[i])) continue;
        var j = i;
        while (j + 1 < xs.length && cont(xs[j + 1])) j++;
        var allTied = true;
        for (var k2 = i; k2 < j; k2++) if (!xs[k2].tieOn) allTied = false;
        if (j > i && !allTied && xs[i].st === xs[j].st) marks.push({ kind: "slur", tp: xs[i].tp, tp2: xs[j].tp, g1: xs[i].grp, g2: xs[j].grp, q1: xs[i].q, q2: xs[j].q, st: xs[i].st, sys: sys,
          vside: vside(xs[i]), line: xs.slice(i, j + 1).map(function (x) { return x.grp; }).filter(function (gp, k, a) { return gp && a.indexOf(gp) === k; }) });
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
    // (round 3c: the tune and the tuba are written; the after-beats, the
    // second cornet and the doublings are heard, not printed — and a march
    // laid out a bar at a time is one visit, per band, while it plays)
    ns = ns.filter(function (n) { return n.part !== "alto" && n.part !== "cornet2" && !n.doubling; });
    if (!ns.length) return;
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = null;
    for (var vi = visits.length - 1; vi >= 0 && !bd; vi--) if (visits[vi].band === (ns[0].band || 0) && ns[0].startTime - visits[vi].tp1 < 4) bd = visits[vi];
    if (!bd) { bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: 0, bass: [], band: ns[0].band || 0 }; visits.push(bd); if (visits.length > 4) visits.shift(); }
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel && n.downbeat !== false) bd.bass.push({ tp: nb.tp });   // its barlines fall on each bar's oom
      bd.tp1 = Math.max(bd.tp1, n.startTime + n.duration);
      bandNotes.push(nb);
    });
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
    if (koHit(y0, y1)) KO.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, a: koA != null ? koA : c.globalAlpha });   // (koA: a note struck on the proof sheet, at its own strength)
  }
  function koEllipse(c, x, y, rx, ry) {
    if (koHit(y - ry, y + ry)) KO.push({ e: 1, x: x, y: y, rx: rx, ry: ry, a: koA != null ? koA : c.globalAlpha });
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
    // (round 3c, round 2: each flag past the first lengthens its stem by the
    // flags' own step, so a sixteenth's second flag clears its head as an
    // eighth's one flag does)
    var sL = 3.5 + (o.flags > 1 && !o.beamY ? 0.8 * (o.flags - 1) : 0);
    function stemEnd(d) {                          // where a stem turned d ends
      var ye;
      // (o.ferm: a fermata stands beyond this stem — over the treble, under
      // the bass — and the plate's edge must hold both)
      var edgeT = g.top + (o.ferm > 0 ? 1.65 : 0.3) * sp, edgeB = g.bot - (o.ferm < 0 ? 1.65 : 0.3) * sp;
      if (d > 0) {
        ye = Math.min(yHi - sL * s, mid);
        ye = Math.max(ye, Math.min(edgeT, yHi - 2.2 * s));   // a stem stays on the plate
        if (st === "B") ye = Math.max(ye, Math.min(gapY, yHi - minS * s));   // …and on its side of the gap
      } else {
        ye = Math.max(yLo + sL * s, mid);
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
    // (round 3c, round 2: a flag is one clean strike, clear of its own head —
    // the owner's rule. A stem turned down hangs its flags back up over its
    // lowest head; where the plate's edge or the gap cuts it too short for
    // them to clear that head — the trio's tune two ledgers under the bass
    // staff — it turns up, and its flags hang beside the head instead)
    if (stem && !o.beamY && !o.tune && o.flags > 0 && dir < 0 && reach(-1) < flagClear(o.flags, s) && reach(1) > reach(-1)) dir = 1;
    // (r3c-engrave2: and the same the other way: a stem up held short under
    // the plate's top edge hangs its flag down beside its head — the organ's
    // high eighths at 390 px — so it turns down where that stem is longer;
    // a voice of a closed score keeps its stem, and its flag is shortened)
    else if (stem && !o.beamY && !o.tune && !o.keep && o.flags > 0 && dir > 0 && reach(1) < flagClear(o.flags, s) && reach(-1) > reach(1)) dir = -1;
    // (and where neither way is long enough — a high note under the plate's
    // top edge, its stem down stopped at the gap — its flags are drawn a
    // little shorter, to clear the head by the same hair: fk)
    var fk = stem && !o.beamY && o.flags > 0 ? clamp((reach(dir < 0 ? -1 : 1) - flagClear(o.flags, s) + 2.8 * s) / (2.8 * s), 0.5, 1) : 1;
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
    // augmentation dots, each in a space (a head on a line has its dot in
    // the space above), clear of the stem; two heads that would share a
    // space step down
    var dots = [], used = {};
    placed.slice().reverse().forEach(function (p) {
      if (!p.h.dots || p.h.ghost) return;
      var dq = p.h.q % 2 === 0 ? p.h.q + 1 : p.h.q;
      while (used[dq]) dq -= 2;
      used[dq] = 1;
      dots.push([right + 0.5 * s, g.y(st, dq)]);
    });
    return { s: s, sw: sw, sx: sx, stem: stem, dir: dir, placed: placed, top: top, bot: bot, y0: y0, yEnd: yEnd, right: right, ledgers: ledgers, dots: dots, st: st, g: g, fk: fk };
  }
  // The ink a laid-out group covers, as boxes — every stroke drawGroup lays
  // for it: its heads (a bell's ring, a breve's strokes), its ledgers, its
  // dots, the signs before and over a head (signsOf: the same geometry the
  // drawing uses), its stem, its flags and a grace's slash. The one measure
  // of a note's ink (round 3b, round 3): it keeps two voices at one x out of
  // each other's way, and it is what a bar stands clear of. [4]: a ledger,
  // [5]: a head, [6]: a sign, [7]: a stem.
  var HEAD_EXT = { mi: [0.66, 0.54], x: [0.5, 0.5] };           // (a head's half-width and half-height, in its own size: the diamond is the widest)
  function headExt(p, o, s) {
    var he = HEAD_EXT[p.k] || [0.64, 0.52], rim = p.h.heavy ? 0.07 * s : 0;   // (the tune's head: its rim struck once more)
    return [o.breve ? 1.1 * s : o.ring ? ((o.ringK || 0.98) + 0.07) * s : he[0] * p.hs + rim, o.ring ? ((o.ringK || 0.98) + 0.07) * s : he[1] * p.hs + rim];   // (a bell's ring is part of its head)
  }
  function groupBoxes(L, o) {
    var s = L.s, out = [], lh = 0.1 * s;
    L.ledgers.forEach(function (l) { out.push([l[0], l[1] - lh, l[2], l[1] + lh, 1]); });
    L.placed.forEach(function (p) {
      if (p.h.ghost) return;
      var e = headExt(p, o, s);
      out.push([p.x - e[0], p.y - e[1], p.x + e[0], p.y + e[1], 0, 1]);
      if (p.h.acc || p.h.jm || p.h.orn) signsOf(p, L).forEach(function (it) { out.push([it.b[0], it.b[1], it.b[2], it.b[3], 0, 0, 1]); });
    });
    var dr = 0.22 * s;                                   // (a dot's ink, 0.19 sp, and its edge)
    L.dots.forEach(function (d) { out.push([d[0] - dr, d[1] - dr, d[0] + dr, d[1] + dr]); });
    if (L.stem) {
      var ya = Math.min(L.y0, L.yEnd), yb = Math.max(L.y0, L.yEnd), dn = L.yEnd < L.y0 ? 1 : -1;
      // (where a stem leaves its head it runs inside that head's box, so
      // its own box starts at the head's edge: the root of a stem is not
      // taken for ink against the other voice's head a third away)
      var ah = dn > 0 ? L.bot : L.top;
      if (!ah.h.ghost) {
        var ah1 = headExt(ah, o, s)[1];
        if (dn > 0) yb = Math.max(ya, Math.min(yb, ah.y - ah1)); else ya = Math.min(yb, Math.max(ya, ah.y + ah1));
      }
      out.push([L.sx - L.sw / 2 - 0.08 * s, ya, L.sx + L.sw / 2 + 0.08 * s, yb, 0, 0, 0, 1]);
      if (o.flags && !o.beamY) {
        var fy = L.yEnd, fl = (0.8 * (o.flags - 1) + 2.8 * L.fk) * s;
        out.push([L.sx, Math.min(fy, fy + dn * fl), L.sx + 1.05 * s, Math.max(fy, fy + dn * fl)]);
      }
      if (o.slash) out.push([L.sx - 0.75 * s, Math.min(L.yEnd + dn * 2.15 * s, L.yEnd + dn * 0.85 * s), L.sx + 0.85 * s, Math.max(L.yEnd + dn * 2.15 * s, L.yEnd + dn * 0.85 * s)]);
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
      if (!o.beamY) for (var f = 0; f < (o.flags || 0); f++) drawFlag(c, sx, yEnd + dir * f * 0.8 * s, dir, s, sw, L.fk);   // (a beamed note's flags are its beams)
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
    // augmentation dots, each in a space, clear of the stem (layoutGroup)
    L.dots.forEach(function (d) {
      c.beginPath(); c.arc(d[0], d[1], 0.19 * s, 0, Math.PI * 2); c.fill();
      koEllipse(c, d[0], d[1], 0.19 * s + pad, 0.19 * s + pad);
    });
    return { sx: sx, yEnd: yEnd, topY: top.y, botY: bot.y, topX: top.x, botX: bot.x, sw: sw, L: L };
  }
  // (round 3c, round 2) how far past its lowest head a stem turned down must
  // reach for n flags to clear that head: the flags' own run back up the
  // stem (2.8 for the first, 0.8 for each after it — drawGroup), the head's
  // half-height, and a hair of air — so the flag and the head are two marks,
  // each struck once, and never one over the other
  function flagClear(n, s) { return (0.8 * (n - 1) + 3.4) * s; }
  function drawFlag(c, sx, y, dir, s, sw, fk) {       // (fk: its length, where a stem too short for it must keep it off its head)
    c.save(); c.translate(sx - sw / 2, y); c.scale(s, (dir > 0 ? s : -s) * (fk || 1));
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
  // A head's signs, where they are drawn: before it its accidental and (the
  // owner's call) its tuning marks; the Old Way's ornament where the
  // composer placed one. Each is { k: its kind, b: its ink's box, … }; the
  // one place their geometry lives, so what headMarks draws is what
  // groupBoxes measures (round 3b, round 3).
  function signsOf(p, L) {
    var g = L.g, st = L.st, s = L.s, x = p.x - 0.64 * (p.hs || s), y = p.y, h = p.h, out = [], bx;
    function glyph(nm, gx, gy, gs) { var b = GLYPHS[nm].box; out.push({ k: "glyph", nm: nm, x: gx, y: gy, s: gs, b: [gx + b[0] * gs, gy + b[1] * gs, gx + b[2] * gs, gy + b[3] * gs] }); }
    if (h.acc) {
      x -= 0.3 * s;
      var nm = h.acc === "s" ? "sharp" : h.acc === "f" ? "flat" : "natural";
      bx = GLYPHS[nm].box;
      glyph(nm, x - bx[2] * s, y, s);
      x -= (bx[2] - bx[0]) * s;
    }
    if (TUNING_MARKS && h.jm) {                     // Johnston: the comma's sign next to the head, the 7 before it; small
      var ts = 0.78 * s;
      var my = h.q % 2 !== 0 ? y : y - 0.5 * s;     // (in a space, never on a line, where a dash would vanish)
      if (h.jm.c) {
        x -= 0.22 * s;
        var mw = 0.56 * ts, th = Math.max(0.9 / dpr, 0.13 * ts);
        out.push({ k: "comma", x: x, y: my, mw: mw, th: th, plus: h.jm.c > 0, b: [x - mw, h.jm.c > 0 ? my - mw / 2 : my - th / 2, x, h.jm.c > 0 ? my + mw / 2 : my + th / 2] });
        x -= mw;
      }
      if (h.jm.s7) { x -= 0.18 * s; glyph("j7", x - 0.36 * ts, my, ts); x -= 0.72 * ts; }
    }
    if (h.orn === "turn") {                         // above the note (and above its stem, over the staff)
      var top = st === "T" ? g.T : g.B, yt = Math.min(y - 1.5 * s, top - 0.9 * g.sp);
      if (L.stem && L.dir > 0) yt = Math.min(yt, L.yEnd - 0.8 * s);
      yt = Math.max(yt, g.top + 0.7 * g.sp);
      glyph("turn", p.x, yt, s);
    } else if (h.orn === "slide") {                 // a slide up into the note
      var lw = Math.max(1 / dpr, 0.13 * s);
      out.push({ k: "slide", x: p.x, y: y, lw: lw, b: [p.x - 1.75 * s - lw, y + 0.12 * s - lw, p.x - 0.86 * s + lw, y + 0.95 * s + lw] });
    } else if (h.orn === "grace") {                 // a grace note, a step above, slashed
      var gs = 0.6 * s, gx = p.x - 1.7 * s, gy = g.y(st, h.q + 1), gsw = Math.max(1 / dpr, 0.1 * s), gsx = gx + 0.57 * gs;
      out.push({ k: "grace", gs: gs, gx: gx, gy: gy, gsw: gsw, gsx: gsx, shape: h.graceShape || "sol",
                 b: [gx - 0.68 * gs, gy - 3.05 * gs, gsx + 1.0 * gs, gy + 0.56 * gs] });
    }
    return out;
  }
  function headMarks(c, g, p, st, s, sw, o, L) {
    signsOf(p, L).forEach(function (it) {
      if (it.k === "glyph") drawGlyph(c, it.nm, it.x, it.y, it.s, o.rgb);
      else if (it.k === "comma") {
        snapRect(c, it.x - it.mw, it.y - it.th / 2, it.mw, it.th);
        if (it.plus) snapRect(c, it.x - it.mw / 2 - it.th / 2, it.y - it.mw / 2, it.th, it.mw);
      } else if (it.k === "slide") {
        c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = it.lw; c.lineCap = "round";
        c.beginPath(); c.moveTo(it.x - 1.75 * s, it.y + 0.95 * s); c.quadraticCurveTo(it.x - 1.25 * s, it.y + 0.75 * s, it.x - 0.86 * s, it.y + 0.12 * s); c.stroke();
        c.restore();
      } else if (it.k === "grace") {
        var gs = it.gs, gsx = it.gsx, gy = it.gy, gsw = it.gsw;
        drawSprite(c, headSprite(shapeKey(it.shape, 1), false, gs, o.rgb), it.gx, gy);
        vLine(c, gsx, gy - 0.1 * gs, gy - 3.0 * gs, gsw);
        drawFlag(c, gsx, gy - 3.0 * gs, 1, gs, gsw);
        c.save(); c.strokeStyle = rgba(o.rgb); c.lineWidth = gsw; c.lineCap = "round";
        c.beginPath(); c.moveTo(gsx - 0.7 * gs, gy - 1.1 * gs); c.lineTo(gsx + 0.8 * gs, gy - 2.4 * gs); c.stroke(); c.restore();
      }
    });
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
      // (round 3c, round 2: a guest's beam lies level. Its notes may be set
      // well after their time — the organist's figure pushed on by the chords
      // under it — and a slope laid where they were expected, followed out to
      // where they stand, ran the beam off the plate and left its stems bare
      // to the edge; level, it meets every stem wherever the note is set)
      if (ms[0].cap != null) m = 0;
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
    if (i1 < ms.length - 1 && xs[i1 + 1] === null) xb = Math.max(xb, Math.min(X(ms[i1 + 1].tp) + dir * (0.57 * s - sw / 2), g.xE));   // (r3c-engrave2: as far as the burin, and no further)
    var th = 0.5 * s * dir;                        // (inward, toward the heads)
    // (r3c-engrave2: struck at full strength with its notes on the proof
    // sheet, and laid on the page with them once, at their one alpha —
    // impress; the ink it covers is returned for the patch)
    c.fillStyle = rgba(C_INK);
    var bb = [xa, 1e9, xb, -1e9];
    function band(x1, x2, off) {
      if (x2 <= x1) return;
      bb[0] = Math.min(bb[0], x1); bb[2] = Math.max(bb[2], x2);
      bb[1] = Math.min(bb[1], yAt(x1) + Math.min(off, off + th), yAt(x2) + Math.min(off, off + th));
      bb[3] = Math.max(bb[3], yAt(x1) + Math.max(off, off + th), yAt(x2) + Math.max(off, off + th));
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
    return bb[3] > bb[1] ? bb : null;
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
      // (r3c-engrave2: a bar or a rest set a little after its time waits,
      // like a note, until the burin reaches it: nothing prints ahead of it)
      if (m.kind === "bar") { if (x + barPlace(m, g) > g.xE + BURIN_EPS * sp) continue; drawHymnBar(c, g, m, x); }
      else if (m.kind === "rest") { if (x + restPlace(m, g).rx > g.xE + BURIN_EPS * sp) continue; drawRest(c, g, m, x); }
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
  // a rest's place about its own time's x: after its bar, if one stands at it
  function restPlace(r, g) {
    var sp = g.sp, nm = REST_OF[r.full ? 1 : r.v] || REST_OF[0.25], bx = GLYPHS[nm[0]].box;
    var rx = (r.full ? 1.4 : 0.5) * sp;
    if (r.barIn && r.barIn.relSp === sp) rx = Math.max(rx, r.barIn.rel + BAR_AIR * sp - bx[0] * sp);
    return { rx: rx, nm: nm, x0: rx + bx[0] * sp, x1: rx + Math.max(bx[2] * sp, nm[1] ? 1.13 * sp : 0), y0: bx[1] * sp, y1: bx[3] * sp };
  }
  // What a bar must clear, about its own time's x: pr, the rightmost ink
  // before it; nl, the leftmost after it, less its air (ar: the air the
  // nearest ink after it asks). All of it read from the one measure of a
  // note's ink — groupBoxes on inkLayout's layout, ledgers and all, where
  // the note is set (inkOf) — whether the bar is asking for room (pushing:
  // its downbeat's notes as laid out before they make it) or being placed
  // (as they stand). Before it: its line's notes and rests of the two
  // seconds before it, and a guest's notes on its staves (the clarinet over
  // a psalm tune: not the hymn's to move, so the bar keeps clear of them;
  // a guest's note after a bar keeps clear of the bar instead, placeColumn).
  function barExtents(m, g, pushing) {
    var sp = g.sp, pr = -1e9, nl = 1e9, ar = BAR_AIR * sp;
    function after(x, air) { if (x - air < nl) { nl = x - air; ar = air; } }
    function before(gr) {
      var ik = inkOf(gr, g), off = (gr.tp - m.tp) * SCROLL_PX_S + ik.dx;
      ik.boxes.forEach(function (b) { if (inBand(g, gr.st, b)) pr = Math.max(pr, b[2] + off); });
    }
    (m.pv || []).forEach(function (gr) { if (m.sts.indexOf(gr.st) >= 0 && gr.lastA >= 0.02) before(gr); });
    (m.pvRests || []).forEach(function (r) {
      if (m.sts.indexOf(r.st) < 0 || dryA(r) < 0.02) return;
      var rp = restPlace(r, g), ry = g.y(r.st, r.q != null ? r.q : restQ(r.st, r.full ? 1 : r.v, r.voice, null));
      if (inBand(g, r.st, [0, ry + rp.y0, 0, ry + rp.y1])) pr = Math.max(pr, (r.tp - m.tp) * SCROLL_PX_S + rp.x1);
    });
    for (var i = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.hymn || gr.tp >= m.tp || gr.tp < m.tp - 2 || m.sts.indexOf(gr.st) < 0 || !(gr.col && gr.col.sp === sp) || !(gr.lastA >= 0.02) || (gr.alone && !gr.aloneOk)) continue;
      if (m.nx && m.nx.indexOf(gr) >= 0) continue;   // (a downbeat's note a hair early is after its bar, not before it: r3c-engrave2)
      before(gr);
    }
    (m.nx || []).forEach(function (gr) {
      var bx, off;
      if (pushing) { var pg = prepGroup(gr, g); bx = groupBoxes(inkLayout(gr, g, pg.heads, pg.o), pg.o); off = (gr.tp - m.tp) * SCROLL_PX_S; }
      else {
        if (!(gr.lastA >= 0.02) || !(gr.noCol || (gr.col && gr.col.sp === sp))) return;   // (not set yet: it will clear the bar where it stands, barPush)
        var ik = inkOf(gr, g); bx = ik.boxes; off = (gr.tp - m.tp) * SCROLL_PX_S + ik.dx;
      }
      bx.forEach(function (b) { if (inBand(g, gr.st, b)) after(b[0] + off, (b[7] ? BAR_AIR_STEM : BAR_AIR) * sp); });
    });
    return { pr: pr, nl: nl, ar: ar };
  }
  // The room the downbeat's notes make for their bar (0 if there is room
  // already): worked out once per staff size, the same for every note on
  // that downbeat, so a chord across the staves stays upright; the notes
  // take it as far as HYMN_DX_MAX allows (placeColumn).
  function barPush(m, g) {
    if (m.push && m.push.sp === g.sp) return m.push;
    var p = m.push = { sp: g.sp, dx: 0 };          // (set first: a bar is never asked twice while it is being worked out)
    var e = barExtents(m, g, true), bi = barInk(m, g), aL = BAR_AIR * g.sp;
    if (e.nl < 1e8) {
      // (a bar already placed — a double bar whose next line's first notes
      // come after it — stays where it stands: its notes clear it there)
      if (m.at && m.at.sp === g.sp) p.dx = Math.max(0, m.at.rel + bi.wr - e.nl);
      else if (e.pr > -1e8) p.dx = Math.max(0, e.pr + aL + bi.wl + bi.wr - e.nl);
    }
    return p;
  }
  // A bar is placed once (setDue: when it is due, after the notes either
  // side of it that are due with it have been set), about its own time's
  // x, and then never moves: ink before it drying away, or a guest's note
  // coming after it, leaves it where it was printed. (Nothing on the page
  // moves but the scroll and the drying.) Where the inks either side leave
  // it less than its air, it keeps the same share of its air on each side.
  function barPlace(m, g) {
    var sp = g.sp, bi = barInk(m, g);
    if (!(m.at && m.at.sp === sp)) {
      var e = barExtents(m, g, false), aL = BAR_AIR * sp, rel = (m.off || 0) * sp;
      var lo = e.pr + aL + bi.wl, hi = e.nl - bi.wr;
      if (e.nl < 1e8 && rel > hi) rel = hi;
      if (e.pr > -1e8 && rel < lo) rel = e.nl < 1e8 && hi < lo ? lo + (hi - lo) * aL / (aL + e.ar) : lo;
      m.at = { sp: sp, rel: rel };
    }
    m.rel = m.at.rel + bi.wr; m.relSp = sp;          // (a rest on its downbeat stands after it: restPlace)
    return m.at.rel;
  }
  function drawHymnBar(c, g, m, x) {
    var sp = g.sp, bi = barInk(m, g), thin = bi.th, xb = x + barPlace(m, g);
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
  // a tie, or the slur over a melisma: a crescent from head to head, drawn
  // as far as the engraving point has reached (and no further: the burin)
  function drawTieOrSlur(c, g, m) {
    var sh = tieShape(g, m);
    if (!sh) return;
    var x1 = sh.x1, x2 = sh.x2, y1 = sh.y1, y2 = sh.y2, h = sh.h, th = sh.th, dx = x2 - x1;
    c.save();
    c.beginPath(); c.rect(0, 0, g.xE, H); c.clip();
    c.beginPath();
    c.moveTo(x1, y1);
    c.bezierCurveTo(x1 + dx * 0.25, y1 + h, x2 - dx * 0.25, y2 + h, x2, y2);
    c.bezierCurveTo(x2 - dx * 0.25, y2 + h - th, x1 + dx * 0.25, y1 + h - th, x1, y1);
    c.closePath(); c.fill();
    c.restore();
  }
  // (the crescent drawTieOrSlur lays, or null while it is not yet to be
  // drawn: its geometry in one place, so the silent checks measure what is
  // drawn — probe("ink"). Round 3c, round 2)
  // (r3c-engrave2) SETTLED ONCE. A slur or a tie is laid out once, whole,
  // when the last of its notes is set — its side, its ends, its depth — and
  // never again: from then on it only travels with the page. Laid out stroke
  // by stroke before, it read its side from a note not yet set (a slur drawn
  // over a run jumped under it when the run's last note printed), and its
  // tail followed its last note to wherever that note was set. Now nothing
  // of it is drawn until both its notes stand where they will stay; the
  // burin then cuts it as far as it has reached. Its side: on a staff two
  // voices share, the upper voice's above and the lower's below (a tie of
  // the soprano no longer dips into the alto); alone on its staff, away from
  // its notes' stems, or above where they point both ways. An end whose
  // stem stands on the curve's side begins past that stem, or ends before it.
  function tieShape(g, m) {
    var sp = g.sp;
    if (!(m.set && m.set.sp === sp)) {
      if (!setNow(m.g1, g) || !setNow(m.g2, g) || !prints(m.g1) || !prints(m.g2)) return null;
      m.set = settleCurve(g, m);
    }
    var z = m.set, x0 = X(m.tp);
    if (!z.ok) return null;
    return { x1: x0 + z.x1, y1: z.y1, x2: x0 + z.x2, y2: z.y2, side: z.side, h: z.h, th: z.th };
  }
  function setNow(gr, g) { return gr.noCol ? gr.dueSp === g.sp : !!(gr.col && gr.col.sp === g.sp); }
  function prints(gr) { return gr.lastA >= 0.02 && !(gr.alone && gr.aloneOk === false); }
  // (a set note as it is struck: its layout about x 0, and its x)
  function struck(gr, g) {
    var pg = prepGroup(gr, g);
    return { L: inkLayout(gr, g, pg.heads, pg.o), o: pg.o, x: X(gr.tp) + (gr.noCol ? coDx(gr, g) : gr.col.dx) };
  }
  // (the curve's one layout: its ends and side about its first note's own
  // time's x, its depth; ok false where it is too short to draw)
  function settleCurve(g, m) {
    var s = g.sp, tie = m.kind === "tie", A = struck(m.g1, g), B = struck(m.g2, g);
    function fq(gr) { var f = gr.fold && gr.fold.sp === s ? gr.fold : null; return f && f.oct ? (m.st === "T" ? -7 : 7) * f.oct : 0; }
    var side = m.vside || 0;                       // (+1: below the heads; the voice's own side, where two share the staff)
    if (!side) {
      if (tie) side = A.L.dir > 0 ? 1 : -1;
      else {
        var up = A.L.dir > 0 && B.L.dir > 0;       // (a slur under stems that all point up; else over)
        (m.line || []).forEach(function (gr) { if (gr !== m.g1 && gr !== m.g2 && setNow(gr, g) && prints(gr) && struck(gr, g).L.dir <= 0) up = false; });
        side = up ? 1 : -1;
      }
    }
    var sw = A.L.sw, over = side < 0, dy0 = tie ? 0.55 : 0.9, gx = (tie ? 0.6 : 0.1) * s, x1 = A.x + gx, x2 = B.x - gx, d1 = dy0, d2 = dy0;
    // (a stem up on the curve's side stands right of its head: the curve
    // begins past it; a stem down on its side stands left: it ends before it.
    // Where that would leave too short a curve — two quick notes a space
    // apart — it is struck from the heads as ever, across the stem's root)
    var sA = A.L.stem && over && A.L.dir > 0, sB = B.L.stem && !over && B.L.dir < 0;
    var xs1 = sA ? A.x + A.L.sx + sw / 2 + 0.25 * s : x1, xs2 = sB ? B.x + B.L.sx - sw / 2 - 0.25 * s : x2;
    if ((sA || sB) && xs2 - xs1 >= 1.5 * s) {
      if (sA) { x1 = xs1; d1 = tie ? 0.55 : 0.6; }
      if (sB) { x2 = xs2; d2 = tie ? 0.55 : 0.6; }
    }
    var y1 = g.y(m.st, m.q1 + fq(m.g1)) + side * d1 * s, y2 = g.y(m.st, m.q2 + fq(m.g2)) + side * d2 * s;
    if (x2 - x1 < 0.6 * s) return { sp: s, ok: false };
    var sh = { x1: x1, y1: y1, x2: x2, y2: y2, side: side,
               h: side * clamp(0.12 * (x2 - x1), 0.4 * s, 1.3 * s), th: side * Math.max(0.9 / dpr, 0.14 * s) };
    if (!tie) {
      // (fitted to its own line; and where that leaves it across another
      // head set in its span — a far choir's pale note, set late, just
      // there — fitted to that head too, if within its bounds that clears
      // every head; else it keeps its own line's fit)
      var pre = { x1: sh.x1, y1: sh.y1, x2: sh.x2, y2: sh.y2, side: sh.side, h: sh.h, th: sh.th };
      slurFit(g, m, sh);
      var near = groups.filter(function (gr) { return gr.st === m.st && gr.tp > m.tp - 3 && gr.tp < m.tp2 + 1 && setNow(gr, g) && prints(gr); });
      if (curveCross(g, sh, near)) {
        slurFit(g, m, pre, near);
        if (!curveCross(g, pre, near)) sh = pre;
      }
    }
    var x0 = X(m.tp);
    return { sp: s, ok: true, side: side, x1: sh.x1 - x0, y1: sh.y1, x2: sh.x2 - x0, y2: sh.y2, h: sh.h, th: sh.th };
  }
  // (round 3c, round 2) A slur passes over every head between its ends. The
  // hymn's melismas are two or three notes, but the gift of tongues' runs
  // dip and climb under one slur, and a crescent struck from the first head
  // to the last cut through the heads between — a second stroke across a
  // head, which the owner ruled out. So the slur curves deeper, as far as
  // 2.2 spaces, to pass them with a quarter space's air; where even that is
  // not enough, both its ends stand further off their heads, alike — but
  // never more than a space further (SLUR_END): a slur keeps beside its own
  // notes. (Heads only: a slur may cross a stem, as in any score.)
  // (r3c-engrave2: fitted once, when it is settled, to the heads of its own
  // line where they stand — the melisma's notes, the singer's run:
  // settleCurve. Fitted before to every head on the staff, wherever it
  // might come, and free to move its ends without limit, the tenor's slur,
  // set under its notes, went looking for the bass's heads under it and hung
  // three spaces below its own notes. Now it lies on its voice's own side,
  // where the other voice is not, and its ends move a space at most: it
  // stays beside its notes. A note set after it keeps out from under it:
  // slurHit)
  var SLUR_DEEP = 2.2, SLUR_AIR = 0.25, SLUR_N = 24, SLUR_END = 1;
  function slurFit(g, m, sh, also) {
    var s = g.sp, sd = sh.side, tt = Math.abs(sh.th), dx = sh.x2 - sh.x1, E = [], pts = [], i;
    (m.line || [m.g1, m.g2]).concat(also || []).forEach(function (gr) {
      if (gr.st !== m.st || !setNow(gr, g) || !prints(gr)) return;
      var k = struck(gr, g);
      k.L.placed.forEach(function (p) {
        if (p.h.ghost) return;
        var e = headExt(p, k.o, k.L.s), x0 = k.x + p.x - e[0], x1 = k.x + p.x + e[0];
        if (x1 < sh.x1 || x0 > sh.x2) return;
        E.push([x0 - tt, x1 + tt, sd > 0 ? p.y + e[1] : -(p.y - e[1])]);   // (its span, and its edge toward the slur, in the slur's sense)
      });
    });
    for (i = 1; i < SLUR_N; i++) {                 // (the curve's inner edge, sampled: where it is, and how much a deeper curve moves it)
      var t = i / SLUR_N, u = 1 - t;
      pts.push({ x: sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t), L: sd * (sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t)), c: 3 * t * u });
    }
    var need = Math.abs(sh.h), rest = 0;
    pts.forEach(function (p) { E.forEach(function (e) { if (p.x >= e[0] && p.x <= e[1]) need = Math.max(need, (e[2] + SLUR_AIR * s - p.L) / p.c + tt); }); });
    var hh = Math.min(need, SLUR_DEEP * s);
    pts.forEach(function (p) { E.forEach(function (e) { if (p.x >= e[0] && p.x <= e[1]) rest = Math.max(rest, e[2] + SLUR_AIR * s - p.L - (hh - tt) * p.c); }); });
    var e = sd * clamp(rest, 0, SLUR_END * s);
    sh.h = sd * hh; sh.y1 += e; sh.y2 += e;
  }
  // (does the crescent sh lie across any head of the groups gs, set where
  // they stand? — its twelfths against each head, as slurHit weighs them)
  function curveCross(g, sh, gs) {
    var s = g.sp, tol = 0.05 * s, dx = sh.x2 - sh.x1, pv = null, sl = [], i;
    for (i = 0; i <= 12; i++) {
      var t = i / 12, u = 1 - t, c3 = 3 * t * u, xx = sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
      var yl = sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t), ya = yl + sh.h * c3, yb = yl + (sh.h - sh.th) * c3;
      if (pv) sl.push([pv[0], Math.min(pv[1], pv[2], ya, yb), xx, Math.max(pv[1], pv[2], ya, yb)]);
      pv = [xx, ya, yb];
    }
    for (i = 0; i < gs.length; i++) {
      var k = struck(gs[i], g), ps = k.L.placed;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j].h.ghost) continue;
        var e = headExt(ps[j], k.o, k.L.s), b = [k.x + ps[j].x - e[0], ps[j].y - e[1], k.x + ps[j].x + e[0], ps[j].y + e[1]];
        for (var q = 0; q < sl.length; q++) if (b[0] < sl[q][2] - tol && sl[q][0] < b[2] - tol && b[1] < sl[q][3] - tol && sl[q][1] < b[3] - tol) return true;
      }
    }
    return false;
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
  // Two voices at one x. A group is placed once, when it falls due: if
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
  // (a hymn's note is set at most HYMN_DX_MAX staff spaces after its time:
  // where the music is denser than 60 px/s can hold — a 6/8 hymn's quick
  // bars — the offsets would otherwise carry on from note to note and bar
  // to bar, and the page drift from the sound; there it lets the inks come
  // close instead. The cap holds a bar's push and the notes that must
  // follow a pushed downbeat alike. Round 3b, round 3: one thing may stand
  // past it — a voice stepping aside beside the head of the other voice of
  // its chord (a second, or a head beside the other's dot: at most
  // SIDE_MAX past it), and only where the notes after it can still clear
  // it within the cap (roomAfter). The chord itself, set upright, keeps
  // to the cap: chordPlace. A note is drawn from its first frame to its
  // last at the offset it was set at: setDue.)
  var HYMN_DX_MAX = 2.4, SIDE_MAX = 2.6;
  var STACK = 0.2;                                 // (two heads a third apart, one over the other, as a chord's stand: the tune's heavier head too)
  function placeColumn(gr, g, heads, o) {
    if (gr.col && gr.col.sp === g.sp) return gr.col.dx;
    var dx0 = startOf(gr, g);
    if (gr.hymn) dx0 = Math.max(dx0, chordPlace(gr, g).dx);
    var c = clearance(gr, g, heads, o, dx0, null);
    gr.col = { sp: g.sp, dx: Math.min(c.need, c.lim), boxes: c.bx, ink: c.ink };
    return gr.col.dx;
  }
  // where a group's placing starts: a downbeat's note makes room for its
  // bar first (barPush; within the cap, like any offset)
  function startOf(gr, g) { return gr.barIn ? barPush(gr.barIn, g).dx : 0; }
  // The place of a hymn's chord on one staff (each voice its own group, a
  // stem each): its voices start together, upright, from the furthest any
  // of them must go to clear the ink already set, each within its own
  // bound — so a voice carried by its own run of notes does not leave the
  // other behind, and the other is not set past it as if it were in its
  // way. Worked out once, for all of them.
  function chordPlace(gr, g) {
    if (gr.chord && gr.chord.sp === g.sp) return gr.chord;
    var ms = [], ch = { sp: g.sp, dx: 0 };
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A.hymn && !A.noCol && A.st === gr.st && Math.abs(A.tp - gr.tp) < 1e-6) ms.push(A);
    }
    if (ms.length > 1) ms.forEach(function (A) {
      var pg = prepGroup(A, g), c = clearance(A, g, pg.heads, pg.o, startOf(A, g), ms);
      ch.dx = Math.max(ch.dx, Math.min(c.need, c.lim));
    });
    ms.forEach(function (A) { A.chord = ch; });
    gr.chord = ch;
    return ch;
  }
  // How far a group must go, from dx0, to clear the ink already set on its
  // staff (need), and how far it may go (lim: the cap, or a side-step's
  // place). skip: the groups not reckoned with (its own chord, while the
  // chord's place is being found).
  function clearance(gr, g, heads, o, dx0, skip) {
    var sp = g.sp, tol = 0.05 * sp, gap = (gr.tight ? 0.08 : 0.3) * sp;   // (round 3c: a new guest's quick notes keep the hymn's close air)
    var ink = groupBoxes(inkLayout(gr, g, heads, o), o), bx = ink;
    // (a hymn's two voices a second apart are set the engraver's way: the
    // second head one head's width over, its ledger running under the
    // first — a ledger is no obstacle between them)
    if (gr.hymn) bx = bx.filter(function (b0) { return !b0[4]; });
    var bL = 1e9;
    for (var q = 0; q < bx.length; q++) bL = Math.min(bL, bx[q][0]);
    // (round 3c: a new guest's note keeps within its own cap, as a hymn's
    // does, so a quick guest — the fiddle's reel — never drifts from its sound)
    var lim = gr.hymn ? HYMN_DX_MAX * sp : gr.cap != null ? gr.cap * sp : 1e9, dx = dx0;
    var ord = gr.cap != null ? orderAt(gr, g) : -1e9;   // (round 3c, round 2: a guest's line in the order it is sung)
    if (!gr.hymn) ord = Math.max(ord, barAfter(gr, g, bx));   // (r3c-engrave2: and after the bars before it)
    if (ord > dx) dx = ord;
    for (var pass = 0; pass < (gr.hymn ? 4 : 8); pass++) {      // (round 3c: a guest's note, with beams to clear as well, may need more; round 2: so may the house's reeds, stepping round a peal)
      var need = dx;
      for (var i = 0; i < groups.length; i++) {
        var A = groups[i];
        if (A === gr || !A.col || A.col.sp !== sp || A.st !== gr.st || !(A.lastA > 0.05) || (skip && skip.indexOf(A) >= 0)) continue;
        var off = (A.tp - gr.tp) * SCROLL_PX_S + A.col.dx;     // A's origin, from ours
        if (off < dx - 8 * sp || off > dx + 8 * sp) continue;
        var ab = A.col.boxes, hit = false, aR = -1e9, air = o.flags || A.flags ? gap : 0, hy = gr.hymn && A.hymn;
        if (gr.air || A.air) air = Math.max(air, Math.max(gr.air || 0, A.air || 0) * sp);   // (round 3c, round 2: a spoken cross's own air)
        var chord = hy && Math.abs(A.tp - gr.tp) < 1e-6;     // (two voices of one chord: an accidental stands before both heads)
        for (var m = 0; m < ab.length; m++) {
          if (hy && ab[m][4]) continue;
          var ax0 = ab[m][0] + off, ax1 = ab[m][2] + off;
          aR = Math.max(aR, ax1);
          for (var n = 0; !hit && n < bx.length; n++) {
            var b = bx[n], ha = air && ab[m][5] && b[5] ? air : 0;   // two heads, one of them flagged: air between them
            if (hy) ha = (ab[m][6] || b[6]) && !chord ? 0.2 * sp : 0;   // (a hymn's beamed voices need no flag's air; a sharp is not set against the ink before it)
            if (ab[m][4] && b[4]) continue;                     // ledgers may meet
            var ty = hy && ab[m][5] && b[5] ? STACK * sp : tol;
            if (ax0 - ha < b[2] + dx - tol && b[0] + dx < ax1 + ha - tol && ab[m][1] < b[3] - ty && b[1] < ab[m][3] - ty) hit = true;
          }
        }
        if (!hit) continue;
        var req = aR + (hy ? 0.08 * sp : Math.max(gap, air)) - bL;   // (round 2: a spoken cross's air is kept, not only asked)
        need = Math.max(need, req);
        if (!hy) continue;
        if (chord) {                                         // its own chord: a side-step, past the cap only where there is room after it
          var side = Math.min(A.col.dx + SIDE_MAX * sp, req);
          if (side > lim && roomAfter(gr, g, bx, side)) lim = side;
        }
      }
      // (a guest's note stands clear of the hymn's bars, as of its notes:
      // the bar was placed first, and does not move)
      if (!gr.hymn) for (var k2 = 0; k2 < marks.length; k2++) {
        var mb = marks[k2];
        if (mb.kind !== "bar" || !(mb.at && mb.at.sp === sp) || mb.sts.indexOf(gr.st) < 0 || Math.abs(mb.tp - gr.tp) > 3) continue;
        var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel, xl = xb - bi.wl - BAR_AIR * sp, xr = xb + bi.wr + BAR_AIR * sp;
        for (var n2 = 0; n2 < bx.length; n2++) {
          if (inBand(g, gr.st, bx[n2]) && bx[n2][0] + dx < xr && bx[n2][2] + dx > xl) { need = Math.max(need, xr - bL); break; }
        }
      }
      // (round 3c: a guest's note keeps its heads out from under a guest's laid beam)
      if (gr.cap != null) { var be = beamHit(gr, g, bx, dx); if (be != null) need = Math.max(need, be + gap - bL); }
      var su = slurHit(gr, g, bx, dx); if (su != null) need = Math.max(need, su + SLUR_AIR * sp - bL);   // (r3c-engrave2: and out from under a slur)
      if (need <= dx) break;
      dx = need;
    }
    // (round 3c: past its cap a new guest's note may come close to the ink
    // before it, as a hymn's does, but it never stands on a bar, and no
    // head of either is struck through by the other's ink — a stem, a
    // ledger, a flag, a beam, another head: there it goes on past)
    // (round 2: the order of its line lifts its cap only as far as the order
    // asks — past that it goes on only for a bar, a head or a beam, as before)
    if (!gr.hymn && dx > lim && ord > lim) lim = ord;
    if (!gr.hymn && gr.cap != null && dx > lim && (onBar(gr, g, bx, lim) || onHead(gr, g, bx, lim) || beamHit(gr, g, bx, lim) != null || slurHit(gr, g, bx, lim) != null)) lim = dx;
    return { need: dx, lim: lim, bx: bx, ink: ink };
  }
  // (r3c-engrave2) A note after a bar in time prints after it on the page.
  // A guest's note is set after the bars placed before it, and it kept clear
  // of one only where it would stand on it: where the bar had been set far
  // along (after notes pushed late), a downbeat's note held at its cap
  // printed before its own bar. The least offset that puts its ink in the
  // staff after every bar placed at or before its time, with the bar's air;
  // -1e9 where none asks.
  function barAfter(gr, g, bx) {
    var sp = g.sp, out = -1e9, bL = 1e9;
    for (var n = 0; n < bx.length; n++) if (inBand(g, gr.st, bx[n])) bL = Math.min(bL, bx[n][0]);
    if (bL > 1e8) return out;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind !== "bar" || !(mb.at && mb.at.sp === sp) || mb.sts.indexOf(gr.st) < 0 || mb.tp > gr.tp + 0.03 || mb.tp < gr.tp - 3) continue;
      var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel;
      out = Math.max(out, xb + bi.wr + BAR_AIR * sp - bL);
    }
    return out;
  }
  // (on a bar, or within a pixel or two of it: the page's pixels round each
  // item's place on its own, so a hair's breadth is not clear)
  function onBar(gr, g, bx, x) {
    var pad = 0.2 * g.sp;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind !== "bar" || !(mb.at && mb.at.sp === g.sp) || mb.sts.indexOf(gr.st) < 0 || Math.abs(mb.tp - gr.tp) > 3) continue;
      var bi = barInk(mb, g), xb = (mb.tp - gr.tp) * SCROLL_PX_S + mb.at.rel;
      for (var n = 0; n < bx.length; n++) if (inBand(g, gr.st, bx[n]) && bx[n][0] + x < xb + bi.wr + pad && bx[n][2] + x > xb - bi.wl - pad) return true;
    }
    return false;
  }
  // (a head struck through: one note's head under another's ink — its stem,
  // a ledger, a flag, a sign, its head — either way round. Every head is
  // one clean strike, the owner's rule: a stem across it is a second stroke)
  function onHead(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || !A.col || A.col.sp !== sp || A.st !== gr.st || !(A.lastA > 0.05)) continue;
      var off = (A.tp - gr.tp) * SCROLL_PX_S + A.col.dx, ab = A.col.ink || A.col.boxes;   // (all its ink: a hymn's ledgers too)
      if (off < x - 5 * sp || off > x + 5 * sp) continue;
      for (var m = 0; m < ab.length; m++) {
        for (var n = 0; n < bx.length; n++) {
          var a = ab[m], b = bx[n];
          if (!a[5] && !b[5]) continue;                          // (ink on ink, no head between: the clearance's own care)
          if (a[0] + off < b[2] + x - tol && b[0] + x < a[2] + off - tol && a[1] < b[3] - tol && b[1] < a[3] - tol) return true;
        }
      }
    }
    return false;
  }
  // (round 3c, round 2) A guest's line reads left to right in the order it
  // is sung: a note never prints left of an earlier note of its own line on
  // its staff (the organist's running figure, pushed along by the chords
  // under it, read backwards and lost its beams). Where an earlier note has
  // been set past its time, this one follows it — enough after it to read
  // as after it (0.6 sp, or less where its own time is nearer: two heads
  // that would touch are kept apart by the clearance as ever), and always
  // more than half the way closer than its time would put it, so an offset
  // dies away along the line within a few notes (a note whose neighbour
  // kept its place is not touched). The least offset that keeps the order;
  // -1e9 where nothing asks. Only a guest's one line asks it (madeSince's
  // line): the fiddle's tune (its open string is a voice of its own, held),
  // the organist's figure, the gift's song, the company's unison, the
  // spoken words, the far tower's peal, the gulls' cries, and (r3c-engrave2)
  // the far ward's notes on each staff, whichever part sings them — not the
  // organ's chords and pedal, whose voices ran away when held to one order.
  function orderAt(gr, g) {
    var sp = g.sp, out = -1e9;
    if (!gr.line) return out;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || A.line !== gr.line || A.layer !== gr.layer || A.st !== gr.st || A.noCol || !(A.col && A.col.sp === sp) || !(A.lastA > 0.05)) continue;
      var d0 = (gr.tp - A.tp) * SCROLL_PX_S;
      if (d0 < 1e-3 || d0 > 12 * sp) continue;
      var adv = Math.min(0.6 * sp, 0.45 * d0);
      out = Math.max(out, A.col.dx - d0 + adv);
    }
    return out;
  }
  // The far ward sings on our beats, a line behind, and its notes can fall
  // where one of our bars must stand (a double bar in our breath between two
  // lines, a bar squeezed before a quick downbeat). A bar keeps clear of the
  // ink before it, and a note keeps clear of a bar placed before it — so a
  // far note that falls just before a bar of ours waits until that bar has
  // been placed, and then keeps clear of it. It prints a moment behind the
  // burin; once printed it never moves.
  // (and on each beat it shares with us, our notes are set first, a
  // moment before it, so it is the far ward's that steps aside)
  // (and a far note sung a hair before one of ours waits for ours too, so
  // that ours is set first and it is the far ward's that keeps clear; never
  // for a note of ours that will not print — the organ under a singer)
  var BAR_WAIT_S = 0.7, YIELD_LAG = 0.08, NOTE_WAIT_S = 0.45;
  function barWaits(gr, g) {
    if (PT < gr.tp + YIELD_LAG) return true;
    for (var k = 0; k < marks.length; k++) {
      var mb = marks[k];
      if (mb.kind === "bar" && !(mb.at && mb.at.sp === g.sp) && mb.sts.indexOf(gr.st) >= 0 && mb.tp >= gr.tp - 1e-6 && mb.tp - gr.tp <= BAR_WAIT_S) return true;
    }
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A === gr || A.yields || A.noCol || A.st !== gr.st || A.tp < gr.tp - 1e-6 || A.tp - gr.tp > NOTE_WAIT_S) continue;
      if (!(A.col && A.col.sp === g.sp) && !(A.alone && A.aloneOk === false)) return true;
    }
    return false;
  }
  // (round 3c) A guest's beam — the fiddle's eighths, the organist's running
  // figure, a singer's run — is laid when its first note is set, and it
  // would run across whatever lies between its stems: a caller's cross, the
  // open string under the tune. So before it is laid it looks along its
  // line; where it would cross another note's head (one set, or one coming
  // in its span, where it will stand: an organ's chord under its figure,
  // the fiddle's open string — the notes of its own line before and after
  // it keep out from under it themselves) it is laid on the other side of
  // its notes, the stems turned; and where that side is crossed too it is
  // not laid, and its notes keep their own flags — which the page steps
  // aside for, as for any ink.
  var beamTally = { laid: 0, turned: 0, cut: 0, by: {} };   // (for the silent checks: probe().beams)
  function beamLay(bm, g) {
    if (bm.laid) return;
    bm.laid = true;
    var ms = bm.members;
    if (ms.some(function (m) { return m.col; })) return;
    var geo = beamGeo(bm, g);
    if (!geo) return;
    var why = beamBlocked(bm, geo, g);
    if (!why) { beamTally.laid++; return; }
    bm.fixed = -geo.dir; bm.geo = null;            // (the other side of its notes: the organist's figure over the chord, not through it)
    var alt = beamGeo(bm, g);
    if (alt && alt.dir !== geo.dir && !beamBlocked(bm, alt, g)) { beamTally.laid++; beamTally.turned++; return; }
    beamTally.cut++; beamTally.by[why] = (beamTally.by[why] || 0) + 1;
    ms.forEach(function (m) { m.beam = null; });
    bm.geo = null;
  }
  // (what its line, geo, would cross — the crossed note's layer, "~" if it
  // is still to come — or null)
  function beamBlocked(bm, geo, g) {
    var ms = bm.members, sp = g.sp, yAt = beamYAt(bm, geo), dir = geo.dir, pad = 0.3 * sp;
    var two = ms.some(function (m) { return (m.flags || 1) >= 2; }), ext = (two ? 1.25 : 0.5) * sp * dir;
    var xa = X(ms[0].tp) + geo.x0 - pad, xb = X(ms[ms.length - 1].tp) + geo.x0 + 0.5 * sp + pad;   // (its last note may be set a little after its time)
    function crosses(b) {                          // (a head's box against the band where the head stands)
      var x0 = Math.max(b[0], xa), x1 = Math.min(b[2], xb);
      if (x1 <= x0) return false;
      var lo = Math.min(yAt(x0), yAt(x1)) + Math.min(0, ext) - pad, hi = Math.max(yAt(x0), yAt(x1)) + Math.max(0, ext) + pad;
      return b[3] > lo && b[1] < hi;
    }
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i];
      if (A.beam === bm || A.st !== bm.st || A.noCol || A.tp < ms[0].tp - 3 || A.tp > ms[ms.length - 1].tp + 1) continue;
      if (!(A.col && A.col.sp === sp) && A.layer === ms[0].layer &&          // (its own line's notes still to come, before or after it, keep
          (A.tp < ms[0].tp - 1e-6 || A.tp > ms[ms.length - 1].tp + 1e-6)) continue;   // out from under it themselves: beamHit)
      var set = A.col && A.col.sp === sp, x0 = X(A.tp) + (set ? A.col.dx : 0), reach = set ? 0 : (A.cap != null ? A.cap : HYMN_DX_MAX) * sp;
      var hb = set ? A.col.ink.filter(function (b) { return b[5]; }).map(function (b) { return [b[0] + x0, b[1], b[2] + x0 + reach, b[3]]; })
        : drawnHeads(A, g).map(function (h) { var y = g.y(A.st, h.q), s = (A.scale || 1) * sp; return [x0 - 0.7 * s, y - 0.55 * s, x0 + 0.7 * s + reach, y + 0.55 * s]; });
      for (var k = 0; k < hb.length; k++) if (crosses(hb[k])) return A.layer + (set ? "" : "~");
    }
    return null;
  }
  // (and a guest's note that comes after such a beam is laid keeps its head
  // out from under it: where one of its heads at x, from its own time's
  // place, would lie under a laid guest beam of another's, the beam's right
  // end, from the same place — the note goes on past it; else null)
  function beamHit(gr, g, bx, x) {
    var sp = g.sp, x0g = X(gr.tp), sw = Math.max(1.4 / dpr, 0.12 * sp), pad = 0.3 * sp, end = null;
    for (var i = 0; i < groups.length; i++) {
      var A = groups[i], bm = A.beam;
      if (!bm || bm === gr.beam || A !== bm.members[0] || !bm.laid || !bm.geo || bm.geo.sp !== sp || bm.st !== gr.st || Math.abs(A.tp - gr.tp) > 4) continue;
      var ms = bm.members, dir = bm.geo.dir, yAt = beamYAt(bm, bm.geo), so = dir * (0.57 * sp - sw / 2);
      var ext = (ms.some(function (m) { return (m.flags || 1) >= 2; }) ? 1.25 : 0.5) * sp * dir;
      var xs = ms.map(function (m) { return X(m.tp) + (m.col && m.col.sp === sp ? m.col.dx : 0) + so; });
      var xa = Math.min.apply(null, xs) - sw / 2 - pad, xb = Math.max.apply(null, xs) + sw / 2 + pad;
      for (var n = 0; n < bx.length; n++) {
        if (!bx[n][5]) continue;
        var h0 = Math.max(x0g + x + bx[n][0], xa), h1 = Math.min(x0g + x + bx[n][2], xb);
        if (h1 <= h0) continue;
        var lo = Math.min(yAt(h0), yAt(h1)) + Math.min(0, ext) - pad, hi = Math.max(yAt(h0), yAt(h1)) + Math.max(0, ext) + pad;
        if (bx[n][3] > lo && bx[n][1] < hi) { end = Math.max(end == null ? -1e9 : end, xb - x0g); break; }
      }
    }
    return end;
  }
  // (r3c-engrave2) A slur is settled when its last note is set, and a note
  // that comes after it — the next of the singer's notes, close behind the
  // run's last — keeps its heads out from under it, as from under a beam:
  // where one of its heads at x would lie under a settled slur or tie on
  // its staff, the curve's right end (from its own time's place) — it goes
  // on past; else null.
  function slurHit(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp, end = null;
    for (var k = 0; k < marks.length; k++) {
      var m = marks[k], z = m.set && m.set.sp === sp ? m.set : null;
      if ((m.kind !== "slur" && m.kind !== "tie") || !z || !z.ok || m.st !== gr.st || m.g1 === gr || m.g2 === gr || Math.abs(m.tp - gr.tp) > 6) continue;
      var o = (m.tp - gr.tp) * SCROLL_PX_S, x1 = o + z.x1, x2 = o + z.x2, dx = x2 - x1, pv = null, sl = [];
      for (var i = 0; i <= 12; i++) {             // (the crescent in twelfths, as probe("ink") slices it)
        var t = i / 12, u = 1 - t, c3 = 3 * t * u, xx = x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
        var yl = z.y1 * u * u * (1 + 2 * t) + z.y2 * t * t * (3 - 2 * t), ya = yl + z.h * c3, yb = yl + (z.h - z.th) * c3;
        if (pv) sl.push([pv[0], Math.min(pv[1], pv[2], ya, yb), xx, Math.max(pv[1], pv[2], ya, yb)]);
        pv = [xx, ya, yb];
      }
      for (var n = 0; n < bx.length; n++) {
        var b = bx[n];
        if (!b[5]) continue;
        for (var q = 0; q < sl.length; q++) if (b[0] + x < sl[q][2] - tol && sl[q][0] < b[2] + x - tol && b[1] < sl[q][3] - tol && sl[q][1] < b[3] - tol) { end = Math.max(end == null ? -1e9 : end, x2); break; }
      }
    }
    return end;
  }
  // May a voice step aside past the cap, to x (its ink bx)? Only where the
  // hymn's notes after it on its staff, set at the cap, would still clear
  // it there: then nothing after it has to go past the cap for it, and
  // where the music is too dense for that (a 6/8 hymn's sixteenths) the
  // chord keeps to the cap as before.
  function roomAfter(gr, g, bx, x) {
    var sp = g.sp, tol = 0.05 * sp, cap = HYMN_DX_MAX * sp, bR = -1e9;
    for (var q = 0; q < bx.length; q++) bR = Math.max(bR, bx[q][2]);
    for (var i = 0; i < groups.length; i++) {
      var B = groups[i];
      if (!B.hymn || B.noCol || B.st !== gr.st || B.tp <= gr.tp + 1e-6) continue;
      var off = (B.tp - gr.tp) * SCROLL_PX_S + cap;          // B's origin, set at the cap, from ours
      if (off > x + bR + 3 * sp) continue;
      var pg = prepGroup(B, g), bb = groupBoxes(inkLayout(B, g, pg.heads, pg.o), pg.o);
      for (var m = 0; m < bb.length; m++) {
        if (bb[m][4]) continue;
        for (var n = 0; n < bx.length; n++) {
          var b = bx[n], ty = bb[m][5] && b[5] ? STACK * sp : tol;
          if (bb[m][0] + off < b[2] + x + 0.08 * sp && b[0] + x < bb[m][2] + off && bb[m][1] < b[3] - ty && b[1] < bb[m][3] - ty) return false;
        }
      }
    }
    return true;
  }
  // Everything newly due on the page is set before any of it is drawn, in
  // the order of its time — a note, then the bar that stands after it — so
  // that where a slow frame or a hidden tab brings several notes at once,
  // each is set as it would have been one at a time (a note clears only
  // what came before it), and a bar is placed once the notes either side
  // of it that are due with it have been set. (Round 3b, round 3.)
  function setDue(g) {
    var sp = g.sp, due = [], i;
    for (i = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.tp > PT || X(gr.tp) < -6 * sp || (gr.noCol ? gr.dueSp === sp : gr.col && gr.col.sp === sp)) continue;
      due.push(gr);
    }
    for (i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (m.kind === "bar" && m.tp <= PT && !(m.at && m.at.sp === sp) && X(m.tp) >= -6 * sp) due.push(m);
    }
    if (!due.length) return;
    // (at one time: the hymn's notes, then their bar, then a guest's note,
    // which keeps clear of the bar placed before it)
    function rank(it) { return it.kind === "bar" ? 1 : it.hymn ? 0 : 2; }
    function at(it) { return it.tp + (it.yields ? YIELD_LAG : 0); }   // (round 3c: the far ward after our notes of its beat)
    due.sort(function (a, b) { return at(a) - at(b) || rank(a) - rank(b); });
    due.forEach(function (it) {
      if (it.kind === "bar") { barPlace(it, g); return; }
      if (it.yields && barWaits(it, g)) return;                // (round 3c: the far ward's note just before a bar of ours waits for it)
      if (it.alone) {                                          // the organ: only where no one sings over it
        if (it.aloneOk == null) it.aloneOk = organAlone(it);
        if (!it.aloneOk) return;
      }
      it.lastA = dryA(it) * (it.ink || 1);
      if (it.lastA < 0.02) return;
      if (it.noCol) { it.dueSp = sp; return; }
      var pg = prepGroup(it, g);
      placeColumn(it, g, pg.heads, pg.o);
    });
  }
  function drawPage(c) {
    var g = G, sp = g.sp, xR = g.xE + 3 * sp;
    setDue(g);
    // the groups — heads on their stems, in the one ink: each note (a beam
    // with its notes) one impression, laid once at its alpha (impress)
    var keep = 0, units = [];
    proofC.setTransform(1, 0, 0, 1, 0, 0); proofC.globalAlpha = 1;
    proofC.clearRect(0, 0, proofLayer.width, proofLayer.height);
    proofC.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < groups.length; i++) {
      var gr = groups[i], x = X(gr.tp);
      if (x < -6 * sp) continue;                               // gone past the clefs
      groups[keep++] = gr;
      if (gr.tp > PT || x > xR) continue;                      // not yet sung
      if (gr.yields && !(gr.col && gr.col.sp === sp) && barWaits(gr, g)) continue;
      if (gr.alone) {                                          // the organ: only where no one sings over it
        if (gr.aloneOk == null) gr.aloneOk = organAlone(gr);
        if (!gr.aloneOk) continue;
      }
      var a = dryA(gr) * (gr.ink || 1);                    // a guest's own ink: the far choir's, the old tune's
      gr.lastA = a;
      if (a < 0.02) continue;
      var pg = prepGroup(gr, g), heads = pg.heads, o = pg.o;
      x += gr.noCol ? coDx(gr, g) : placeColumn(gr, g, heads, o);
      // (r3c-engrave2: nothing prints ahead of the burin. A note set past
      // its time — stepping aside, making room for a bar — waits where it
      // was set until the burin reaches it, and is struck there, once)
      if (x > g.xE + BURIN_EPS * sp) continue;
      var u, bm = gr.beam && gr.beam.geo ? gr.beam : null;
      if (bm) {
        o.beamY = beamYAt(bm, bm.geo);
        if (bm.uF !== FRAME) { bm.uF = FRAME; bm.u = { a: 0, its: [], bm: bm }; units.push(bm.u); }
        u = bm.u;
      } else units.push(u = { a: 0, its: [], bm: null });
      u.a = Math.max(u.a, a);
      u.its.push({ gr: gr, x: x, heads: heads, o: o });
      gr.drawnAt = FRAME; gr.lastX = x; gr.lastO = o;
    }
    groups.length = keep;
    for (i = 0; i < units.length; i++) impress(c, g, units[i]);
    drawMarks(c);
    c.globalAlpha = 1;
    drawQuestions(c);
  }
  // ---- one even tone (r3c-engrave2) ------------------------------------------
  // The owner, close to a pale note: "as though there's two strokes for each
  // note". There were. A note is several strokes — its head, its stem (whose
  // root lies inside the head), its flags (a sixteenth's two, one over the
  // other), the ledger its head sits on — and each was laid at the note's
  // own alpha, so wherever two met the ink lay twice and printed darker: a
  // dark seam where the stem crosses the head, a darker tongue where the
  // flags meet. Now a note is struck whole, at full strength, on a proof
  // sheet (a scratch layer the page's size), and that patch of the sheet is
  // laid on the page once, at the note's alpha: one even tone however its
  // strokes meet, fresh or drying, near or far. A beam and the notes it joins
  // are one impression (their stems run into it), a bell and its ring
  // another. (The paper's own lines still show through pale ink, as they
  // would through any thin ink.)
  var BURIN_EPS = 0.05;                            // (sp: the burin's own hair)
  var proofLayer = null, proofC = null, koA = null;
  function impress(c, g, u) {
    var pc = proofC, sp = g.sp, bb = [1e9, 1e9, -1e9, -1e9];
    function grow(b) { bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); }
    koA = u.a;                                     // (the telegraph weighs the ink at its own strength)
    for (var i = 0; i < u.its.length; i++) {
      var it = u.its[i], gr = it.gr, r = drawGroup(pc, g, it.x, it.heads, gr.st, gr.dir, it.o);
      gr.lastSx = r.sx; gr.lastL = r.L;
      groupBoxes(r.L, it.o).forEach(grow);
      if (gr.ring) {
        var y = g.y(gr.st, it.heads[0].q), rr = ((gr.ringK || 0.98) * (gr.scale || 1) + 0.1) * sp;
        drawBellRing(pc, g, it.x, y, gr.scale, gr.ringK);
        grow([it.x - rr, y - rr, it.x + rr, y + rr]);
      }
    }
    if (u.bm) { var bb2 = drawBeam(pc, g, u.bm); if (bb2) grow(bb2); }
    koA = null;
    stamp(c, g, u.a, bb);
  }
  // (the patch bb of the proof sheet — every stroke of one impression, and a
  // margin for their soft edges — laid on the page at alpha a; the sheet
  // then wiped there for the next)
  function stamp(c, g, a, bb) {
    if (!(bb[2] > bb[0])) return;
    var pc = proofC, pad = 0.35 * g.sp, d = dpr;
    var x0 = Math.max(0, Math.floor((bb[0] - pad) * d)), y0 = Math.max(0, Math.floor((bb[1] - pad) * d));
    var x1 = Math.min(proofLayer.width, Math.ceil((bb[2] + pad) * d)), y1 = Math.min(proofLayer.height, Math.ceil((bb[3] + pad) * d));
    if (x1 <= x0 || y1 <= y0) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = a;
    c.drawImage(proofLayer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    c.restore();
    pc.save(); pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(x0, y0, x1 - x0, y1 - y0); pc.restore();
  }
  // a group's heads and how it is engraved, this frame (a beamed note's stem is the beam's)
  function prepGroup(gr, g) {
    if (gr.beam && gr.cap != null && !gr.beam.laid) beamLay(gr.beam, g);   // (round 3c: a guest's beam is not laid across a head)
    var heads = drawnHeads(gr, g), o = inkOpts(gr);
    if (gr.beam) {
      var bg = beamGeo(gr.beam, g);
      if (bg) { gr.dir = bg.dir; o.flags = 0; }
    }
    return { heads: heads, o: o };
  }
  // The one measure of a group's ink (round 3b, round 3): the group laid
  // out as drawPage lays it — a beamed note's stem run to its beam, never
  // turned — at its own time's x (0), its column's offset aside. Where a
  // note is set (placeColumn) and what a bar weighs, both when it asks its
  // downbeat for room and when it is placed (barExtents), are this layout's
  // boxes (groupBoxes, ledger lines included), and drawPage draws this
  // layout: so a bar never stands on ink its push did not see.
  function inkLayout(gr, g, heads, o) {
    var bm = gr.beam, geo = bm && bm.geo && bm.geo.sp === g.sp ? bm.geo : null, o2 = o;
    if (geo) {
      o2 = {};
      for (var k in o) o2[k] = o[k];
      var x0 = (bm.members[0].tp - gr.tp) * SCROLL_PX_S + geo.x0;
      o2.beamY = function (x) { return geo.y0 + geo.m * (x - x0); };
    }
    return layoutGroup(g, 0, heads, gr.st, gr.dir, o2);
  }
  // (a second voice's stem on the first's head goes where that head went)
  function coDx(gr, g) { var p = gr.coOf; return p && p.col && p.col.sp === g.sp ? p.col.dx : 0; }
  // the ink a group will lay, as boxes about its own time's x (every box
  // groupBoxes knows: its ledgers too), and its column's offset: set now
  // if it has not been (a bar asks after the notes before it)
  function inkOf(gr, g) {
    if (gr.noCol) {
      if (!(gr.inkBx && gr.inkBx.sp === g.sp)) {
        var pg = prepGroup(gr, g);
        gr.inkBx = { sp: g.sp, boxes: groupBoxes(inkLayout(gr, g, pg.heads, pg.o), pg.o) };
      }
      return { dx: coDx(gr, g), boxes: gr.inkBx.boxes };
    }
    if (!(gr.col && gr.col.sp === g.sp)) { var p2 = prepGroup(gr, g); placeColumn(gr, g, p2.heads, p2.o); }
    return { dx: gr.col.dx, boxes: gr.col.ink };
  }
  // how a group is engraved (alt: the stem it takes if its voice's own would be stubby)
  function inkOpts(gr) {
    return { scale: gr.scale, rgb: C_INK, noStem: gr.noStem, flags: gr.flags, slash: gr.slash, breve: gr.v && gr.v.breve, ring: gr.ring, ringK: gr.ringK, thin: gr.thin, alt: gr.alt,
             keep: gr.hymn && (gr.voice === "both" || (gr.voice !== "one" && gr.voice !== "hop")), room: gr.room, ferm: gr.ferm || 0,
             tune: !!(gr.hymn && gr.tune && gr.voice !== "one" && gr.voice !== "hop" && gr.voice !== "both") };
  }
  // a bell: a ringed head — one thin ring, drawn with the head, that dries
  // with it (no spreading rings: nothing on the page moves but the scroll)
  function drawBellRing(c, g, x, y, sc, k) {       // (k: the ring's radius in the head's own size — the far tower's, round 3c)
    var r = (k || 0.98) * g.sp * (sc || 1), lw = Math.max(1 / dpr, 0.07 * g.sp);
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
      // (each note struck whole on the proof sheet and laid once at its
      // alpha, as the ward's are: one even tone — impress, r3c-engrave2)
      var ba = (0.12 + 0.68 * n.loud) * dryA(n), bo, rb, bb = [1e9, 1e9, -1e9, -1e9];
      if (n.mel) {
        var q = n.q;
        while (q > g.qMaxT) q -= 7;                              // folded in silently, like the ward's
        bo = { rgb: C_INK, noStem: !n.v.stem, flags: n.v.flags };
        rb = drawGroup(proofC, g, x, [{ q: q, shape: "round", open: n.v.open, dots: n.v.dots }], "T", q >= 16 ? -1 : 1, bo);
      } else {
        // the oom-pah, written the bandsman's way — a staccato quarter
        bo = { rgb: C_INK };
        rb = drawGroup(proofC, g, x, [{ q: n.q, shape: "round", open: false }], "B", -1, bo);
        var dq = n.q % 2 === 0 ? n.q + 1.5 : n.q + 2, dy = g.yB(dq);
        proofC.beginPath(); proofC.arc(rb.topX, dy, 0.17 * sp, 0, Math.PI * 2); proofC.fill();
        bb = [rb.topX - 0.2 * sp, dy - 0.2 * sp, rb.topX + 0.2 * sp, dy + 0.2 * sp];
      }
      groupBoxes(rb.L, bo).forEach(function (b) { bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); });
      stamp(c, g, ba, bb);
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
    proofLayer = layer(); proofC = proofLayer.getContext("2d");   // (the proof sheet each note is struck on, whole: impress)
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
  // (a dev's view of the page; probe("ink") adds each drawn note's ink and
  // each placed bar's, in page px, for the bars-touch-no-ink check)
  function probe(what) {
    if (what === "ink") return probeInk();
    return {
      PT: PT, sp: G ? G.sp : null, xE: G ? G.xE : null, beams: beamTally,
      groups: groups.map(function (gr) { return { layer: gr.layer, tp: gr.tp, st: gr.st, dir: gr.dir, x: gr.drawnAt === FRAME ? gr.lastX : null, voice: gr.voice || null, beam: gr.beam ? gr.beam.members.indexOf(gr) : null, heads: gr.heads.map(function (h) { return h.q + (h.heavy ? "H" : "") + (h.ghost ? "G" : "") + (h.acc || "") + (h.jm ? "j" : "") + (h.orn ? "o" : ""); }).join(","), flags: gr.flags, alone: gr.alone ? !!gr.aloneOk : null, dx: gr.col ? gr.col.dx : null, barIn: gr.barIn ? gr.barIn.tp : null }; }),
      marks: marks.map(function (m) { return { kind: m.kind, type: m.type || null, tp: m.tp, x: X(m.tp) + (m.rel != null && G && m.relSp === G.sp ? m.rel : (m.off || 0) * (G ? G.sp : 0)), st: m.st || (m.sts || []).join(""), v: m.v, voice: m.voice, push: m.push ? m.push.dx : null, rel: m.at ? m.at.rel : null, nx: m.nx ? m.nx.length : null }; }),
    };
  }

  function probeInk() {
    var g = G, out = { sp: g ? g.sp : null, T: g ? g.T : null, B: g ? g.B : null, notes: [], bars: [] };
    if (!g) return out;
    groups.forEach(function (gr) {
      if (gr.drawnAt !== FRAME) return;
      var bx = gr.noCol ? (gr.inkBx && gr.inkBx.boxes) : (gr.col && gr.col.ink);
      // (each box: its ink in page px, whether it is a head, and what it is —
      // "h" a head, "l" a ledger, "s" a stem, "g" a sign, "" a flag or a dot)
      if (bx) out.notes.push({ layer: gr.layer, st: gr.st, tp: gr.tp, a: gr.lastA, guest: gr.cap != null, hymn: !!gr.hymn,
        boxes: bx.map(function (b) { return [b[0] + gr.lastX, b[1], b[2] + gr.lastX, b[3], b[5] ? 1 : 0, b[5] ? "h" : b[4] ? "l" : b[7] ? "s" : b[6] ? "g" : ""]; }) });
    });
    // (each drawn beam, as drawBeam lays it, in slices a quarter space wide:
    // its members' own heads lie at their stems' other ends)
    out.beams = [];
    var seenB = [];
    groups.forEach(function (gr) {
      var bm = gr.beam;
      if (!bm || gr.drawnAt !== FRAME || seenB.indexOf(bm) >= 0 || !bm.geo || bm.members.length < 2) return;
      seenB.push(bm);
      var s = g.sp, sw = Math.max(1.4 / dpr, 0.12 * s), yAt = beamYAt(bm, bm.geo), dir = bm.geo.dir, xs = [];
      bm.members.forEach(function (m) { if (m.drawnAt === FRAME) xs.push(m.lastSx); });
      if (xs.length < 1) return;
      var two = bm.members.some(function (m) { return (m.flags || 1) >= 2; }), ext = (two ? 1.25 : 0.5) * s * dir;
      // (round 3c, round 2: from its first stem to its last, as drawBeam lays
      // it — a beam whose notes print out of order draws nothing, and says so)
      var xa = xs[0] - sw / 2, xb = xs[xs.length - 1] + sw / 2, segs = [];
      for (var x = xa; x < xb - 0.01; x += 0.25 * s) {
        var x2 = Math.min(xb, x + 0.25 * s), y1 = Math.min(yAt(x), yAt(x2)), y2 = Math.max(yAt(x), yAt(x2));
        segs.push([x, y1 + Math.min(0, ext), x2, y2 + Math.max(0, ext)]);
      }
      out.beams.push({ layer: gr.layer, st: gr.st, tps: bm.members.map(function (m) { return m.tp; }), a: gr.lastA, guest: gr.cap != null, segs: segs, rev: xb <= xa });
    });
    // (round 3c, round 2: each drawn slur and tie, as tieShape lays it, in
    // slices a twenty-fourth of its span wide, each the crescent's full depth)
    out.slurs = [];
    marks.forEach(function (m) {
      if ((m.kind !== "slur" && m.kind !== "tie") || m.tp > PT || dryA(m) < 0.02) return;
      var sh = tieShape(g, m);
      if (!sh) return;
      var dx = sh.x2 - sh.x1, segs = [], pv = null;
      for (var i = 0; i <= 24; i++) {
        var t = i / 24, u = 1 - t, c3 = 3 * t * u, x = sh.x1 + dx * (0.75 * t * u * u + 2.25 * t * t * u + t * t * t);
        var yl = sh.y1 * u * u * (1 + 2 * t) + sh.y2 * t * t * (3 - 2 * t), ya = yl + sh.h * c3, yb = yl + (sh.h - sh.th) * c3;
        if (pv && x <= g.xE) segs.push([pv[0], Math.min(pv[1], pv[2], ya, yb), x, Math.max(pv[1], pv[2], ya, yb)]);
        pv = [x, ya, yb];
      }
      out.slurs.push({ kind: m.kind, st: m.st, tp: m.tp, tp2: m.tp2, q1: m.q1, side: sh.side, segs: segs });   // (r3c-engrave2: its head and side — two voices' ties may start together)
    });
    marks.forEach(function (m) {
      if (m.kind !== "bar" || !(m.at && m.at.sp === g.sp) || m.tp > PT) return;
      var bi = barInk(m, g), xb = X(m.tp) + m.at.rel;
      out.bars.push({ tp: m.tp, type: m.type, sts: m.sts, x0: xb - bi.wl, x1: xb + bi.wr });
    });
    return out;
  }

  return { init: init, setConductor: setConductor, setWheelLabels: setWheelLabels, wheelSeatAt: wheelSeatAt, setTuningMarks: setTuningMarks, probe: probe };
})();
