// ============================================================================
// KOLOB — the open hymnal (visualizer)
//
// Three instruments of seeing, all printed things:
//  · THE ORGAN — the black pipe silhouettes of the tabernacle facade, standing
//    on their impost line, breathing with the actual sound: a spectrum
//    analyzer racked the way real pipes are racked (gravest in the middle,
//    alternating outward), each with the paper-colored mouth near its foot.
//    Fed by an AnalyserNode on the master bus; at rest it settles into the
//    quiet stepped skyline of the hymnbook cover.
//  · THE PAGE — a scrolling engraving on a GRAND STAFF: two five-line staves
//    joined by a brace, a treble clef and a bass clef (baked as outlines, no
//    font needed). Melodic notes print as 4-shape SHAPE-NOTE heads (fa △, sol ○,
//    la ▭, mi ◇) in green ink, each snapped to the line or space of its pitch —
//    the tonic-root sits at middle C, so the choir bass fills the bass staff and
//    the soprano the treble, with ledger lines (middle C included) for the
//    excursions. The staves and clefs are a static layer; only the ink scrolls.
//    Deeper motif generations print worn — double-struck, spread. The ink dries
//    and pales as the page scrolls on. In the sacrament the page goes almost
//    blank; ink returns with the doxology.
//  · THE LIAHONA — a small engraved dial in a hexagonal case. One needle
//    walks the section, a second leans with the intensity; it glints when
//    the oracle points.
//  · THE WHEEL — the order of service seated round the rim of one great
//    wheel, of which the page shows only the crown: a sun low on a far
//    horizon. The section now playing is lettered at the crown beneath ONE
//    gilt arc fixed to the page, which fills as the section plays; when it
//    is full the wheel turns anticlockwise a seat beneath it and the arc
//    fills again. Spokes and hour-marks beneath the banner make the turning
//    visible. Postlude turns into the next meeting's prelude like any other
//    seat — the cycle is the picture.
//
// No neon, no glitch, no CRT. A printed thing with one soft glow in it.
// Public surface: window.KolobViz = { init(canvas, dialCanvas, organCanvas, wheelCanvas),
//   setConductor, setWheelLabels, wheelSeatAt }
// ============================================================================

window.KolobViz = (function () {
  "use strict";
  var K = window.KolobAudio;

  var canvas = null, ctx2d = null;
  var page = null, pctx = null;                    // offscreen ink layer (scrolls)
  var staffLayer = null;                           // static: the staves + clefs
  var fadeCanvas = null, fadeCtx = null, fadeGrad = null;  // left-edge ink fade
  var fadeX0 = 90, fadeX1 = 150;                    // ink: ~0 at x≤fadeX0, full at x≥fadeX1
  var dial = null, dctx = null;
  var organ = null, octx = null;                   // the facade
  var wheel = null, xctx = null;                   // the order of service
  var W = 0, H = 0, DW = 0, DH = 0, OW = 0, OH = 0, XW = 0, XH = 0, dpr = 1;
  var running = false;

  var cond = { section: null, local: 0, intensity: 0, f0: 65, mode: "ionian", hush: false, fuging: false };
  var playing = false;
  var curGen = 0;                                  // engraving wear follows the working generation
  var liahonaGlint = 0;                            // seconds of glint remaining

  var INK = "#1e4d3b";                             // hymnbook green
  var INK_SOFT = "rgba(30, 77, 59, 0.55)";
  var RULE = "rgba(30, 77, 59, 0.42)";            // the printed staff rules
  var GOLD = "#8a7a45";                            // a restrained gilt for the dial
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

  function drawOrgan(dt) {
    if (!octx) return;
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
      // analyzer feel: quick to rise, slower to fall
      bands[k] += (target - bands[k]) * Math.min(1, dt * (target > bands[k] ? 9 : 2.4));
    }

    octx.clearRect(0, 0, OW, OH);
    var baseY = OH - 16;
    var span2 = Math.min(OW * 0.86, 640);
    var step = span2 / NPIPES;
    var x0 = (OW - span2) / 2 + step / 2;
    for (var k2 = 0; k2 < NPIPES; k2++) {
      var seat = seatOf[k2];
      // wider, graver pipes toward the center of the facade; at rest the
      // minimum heights alone draw the stepped skyline of the hymnbook cover
      var centerness = 1 - Math.abs(seat - (NPIPES - 1) / 2) / ((NPIPES - 1) / 2);
      var w = step * (0.5 + centerness * 0.34);
      var minH = 20 + centerness * 22;
      var maxH = OH - 10;
      var h = minH + bands[k2] * (maxH - minH) * (0.55 + centerness * 0.45);
      drawPipe(octx, x0 + seat * step, baseY, w, h);
    }
    // the impost — the case line the pipes stand on
    octx.strokeStyle = INK;
    octx.globalAlpha = 0.6;
    octx.lineWidth = 1.4;
    octx.beginPath(); octx.moveTo(OW * 0.04, baseY + 1); octx.lineTo(OW * 0.96, baseY + 1); octx.stroke();
    octx.globalAlpha = 0.3;
    octx.lineWidth = 1;
    octx.beginPath(); octx.moveTo(OW * 0.07, baseY + 5); octx.lineTo(OW * 0.93, baseY + 5); octx.stroke();
    octx.globalAlpha = 1;
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
  // 4-shape solmization per collection degree (fa sol la fa sol la mi)
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
    return { deg: best, oct: oct, n: ratios.length };
  }
  // ==========================================================================
  // THE GRAND STAFF — two five-line staves joined by a brace.
  // q is a diatonic-step lattice spanning BOTH staves: bass rules at
  // q=0,2,4,6,8; the middle-C gap (q=10, a shared ledger, undrawn); treble
  // rules at q=12,14,16,18,20. The tonic-root (~middle C, F0·4) is anchored at
  // q=10, so the melody rides the gap and lower treble, the choir bass fills the
  // bass staff, and high doublings the upper treble — the ~4-octave range that
  // used to pile onto ledger lines now sits on its proper staff.
  // STAFFPOS gives the diatonic letter (0..6) of each collection degree, so the
  // gapped folk scales (penta/hexa) simply leave their missing letters empty.
  var STAFFPOS = {
    ionian:     [0, 1, 2, 3, 4, 5, 6],
    mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian:     [0, 1, 2, 3, 4, 5, 6],
    aeolian:    [0, 1, 2, 3, 4, 5, 6],
    penta:      [0, 1, 2, 4, 5],
    hexa:       [0, 1, 2, 3, 4, 5],
  };
  var Q_MID = 10;                                  // middle C / the meeting's tonic-root
  var BASS_RULES = [0, 2, 4, 6, 8], TREBLE_RULES = [12, 14, 16, 18, 20];
  var STAFF_LO = -4, STAFF_HI = 24;                // fold only beyond ~4 octaves
  // Vertical lattice: q0..q20 fill the central 70% of the strip; 15% of clear
  // paper above and below carries the ledger lines.
  function stepFrac() { return 0.70 / 20; }        // fraction of H per diatonic step
  function stepPx() { return H * stepFrac(); }
  function yOfQ(q) { return H * (0.85 - stepFrac() * q); }   // q0 at 85%, q20 at 15%
  function staffQ(freq) {
    var d = degOf(freq);
    var letters = STAFFPOS[cond.mode] || STAFFPOS.ionian;
    var pos = letters[d.deg];
    if (pos == null) pos = d.deg;
    var q = Q_MID + pos + 7 * d.oct;               // diatonic letter from the tonic-root
    while (q < STAFF_LO) q += 7;                    // fold only the rare >4-octave extremes
    while (q > STAFF_HI) q -= 7;
    return q;
  }
  // ledger positions for a note at q: middle C in the gap, plus each staff line
  // the note has climbed beyond its own staff (never on the drawn rules).
  function ledgersForQ(q) {
    var out = [], l;
    if (q === Q_MID) out.push(Q_MID);
    for (l = 22; l <= q; l += 2) out.push(l);      // above the treble staff
    for (l = -2; l >= q; l -= 2) out.push(l);      // below the bass staff
    return out;
  }

  // The two clefs, baked as self-contained outlines (traced from a serif music
  // glyph) so they render identically for every visitor — no font dependency.
  // Coordinates are font units (y-up, 1000 upm); drawClef flips and scales them.
  var CLEF_TREBLE = { bbox: [120, -291, 542, 900], d: "M434 2Q464 -103 464 -170Q464 -223 427.0 -257.0Q390 -291 337 -291Q287 -291 250.0 -261.5Q213 -232 213 -190Q213 -160 233.5 -133.5Q254 -107 283.5 -107.0Q313 -107 331.5 -128.5Q350 -150 350 -178Q350 -240 280 -240Q298 -268 338 -268Q353 -268 368.5 -263.5Q384 -259 401.0 -248.0Q418 -237 428.5 -213.5Q439 -190 439 -157Q439 -136 411 -6Q389 -12 356 -12Q259 -12 189.5 60.0Q120 132 120 232Q120 267 131.5 303.0Q143 339 157.5 366.5Q172 394 200.5 428.5Q229 463 248.5 483.5Q268 504 303 539Q280 621 280 689Q280 779 313.0 839.5Q346 900 379 900Q389 900 401.5 887.0Q414 874 426.0 851.0Q438 828 446.5 790.5Q455 753 455 710Q455 551 342 447L368 329Q384 332 397 332Q458 332 500.0 282.5Q542 233 542 162Q542 44 434 2ZM426 746Q426 801 394 801Q358 801 333.0 748.0Q308 695 308 630Q308 588 321 557Q359 580 392.5 639.5Q426 699 426 746ZM498 128Q498 183 466.0 216.0Q434 249 383 249L428 23Q498 52 498 128ZM407 17 361 247Q334 241 311.5 214.0Q289 187 289 158Q289 143 295.0 128.5Q301 114 309.5 104.0Q318 94 327.0 86.0Q336 78 342.0 74.5Q348 71 348 71L340 66Q307 75 277.5 106.0Q248 137 248 184Q248 231 277.5 270.5Q307 310 343 323L325 430Q168 299 168 177Q168 104 223.0 55.0Q278 6 348 6Q365 6 407 17Z" };
  var CLEF_BASS   = { bbox: [75, 166, 607, 757],   d: "M564 704Q582 704 594.5 691.0Q607 678 607.0 661.0Q607 644 593.0 631.0Q579 618 563 618Q521 618 521 663Q521 681 534.0 692.5Q547 704 564 704ZM607 469Q607 450 594.0 437.0Q581 424 564 424Q521 424 521 469Q521 485 533.5 498.0Q546 511 564.0 511.0Q582 511 594.5 497.0Q607 483 607 469ZM285 757Q366 757 421.0 701.5Q476 646 476 569Q476 531 465.5 495.0Q455 459 432.0 426.5Q409 394 386.0 367.0Q363 340 326.0 313.0Q289 286 264.0 267.5Q239 249 196.5 226.0Q154 203 135.5 193.5Q117 184 80 166L75 182Q76 183 102.0 200.0Q128 217 144.0 227.5Q160 238 191.5 263.0Q223 288 244.0 309.5Q265 331 291.5 363.5Q318 396 334.0 427.0Q350 458 361.5 498.0Q373 538 373 578Q373 735 262 735Q225 735 199.0 725.5Q173 716 161.5 702.0Q150 688 145.0 677.5Q140 667 140 659Q140 644 160 644Q168 644 179.0 647.5Q190 651 194 651Q221 651 239.0 634.0Q257 617 257 592Q257 563 235.0 544.0Q213 525 183 525Q144 525 119.0 548.0Q94 571 94 607Q94 673 150.5 715.0Q207 757 285 757Z" };
  var trebPath = null, bassPath = null;            // Path2D, built on first resize
  function drawClef(c, clef, path, leftX, targetTop, targetH) {
    var bb = clef.bbox, gh = bb[3] - bb[1], s = targetH / gh;
    c.save();
    c.translate(leftX - bb[0] * s, targetTop + bb[3] * s);
    c.scale(s, -s);                                // font units are y-up
    c.fillStyle = INK;
    c.fill(path);
    c.restore();
  }

  // ---- note intake -----------------------------------------------------------
  var pending = [];                                // notes waiting for their startTime
  var pendingTelegraph = [];                        // telegraph runs waiting to start
  var activeTelegraph = [];                          // runs keying out mark-by-mark
  var MELODIC = { clarinet: 1, bagpipe: 1, choir: 1, bells: 1, harmonium: 1, strings: 1, ambient: 0 };
  function onNote(n) {
    if (!n) return;
    // the wire is not a voice: it carries a Morse run to lay down as tape
    if (n.layer === "telegraph" && n.marks && n.marks.length) {
      if (pendingTelegraph.length > 20) pendingTelegraph.shift();
      pendingTelegraph.push(n);
      return;
    }
    if (!n.freq || n.freq < 20) return;
    if (!MELODIC[n.layer]) return;
    if (pending.length > 240) pending.shift();
    pending.push(n);
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.cat === "motif") {
      var m = /·g(\d+)/.exec(ev.label || "");
      if (m) curGen = parseInt(m[1], 10);
    }
    if (ev.cat === "liahona") liahonaGlint = 2.2;
    if (ev.cat === "fuging") stampFuging();
    if (ev.cat === "meeting") curGen = 0;
  }

  // ---- drawing ---------------------------------------------------------------
  function shapePath(c, shape, x, y, s) {
    c.beginPath();
    if (shape === "fa") {                          // right triangle, the fa flag
      c.moveTo(x - s, y + s * 0.8);
      c.lineTo(x + s, y + s * 0.8);
      c.lineTo(x - s, y - s * 0.8);
      c.closePath();
    } else if (shape === "la") {                   // rectangle
      c.rect(x - s, y - s * 0.7, s * 2, s * 1.4);
    } else if (shape === "mi") {                   // diamond
      c.moveTo(x, y - s * 0.9);
      c.lineTo(x + s, y);
      c.lineTo(x, y + s * 0.9);
      c.lineTo(x - s, y);
      c.closePath();
    } else {                                       // sol — the oval
      c.ellipse(x, y, s, s * 0.72, -0.22, 0, Math.PI * 2);
    }
  }
  // the short strokes that carry a note above/below its staff — middle C in the
  // gap, and one per staff line the note has climbed past the treble/bass edge
  function drawLedgers(x, q, s, alpha) {
    var ls = ledgersForQ(q);
    if (!ls.length) return;
    pctx.save();
    pctx.globalAlpha = alpha * 0.72;
    pctx.strokeStyle = INK;
    pctx.lineWidth = 1;
    var half = s * 2.0;
    for (var i = 0; i < ls.length; i++) {
      var ly = yOfQ(ls[i]);
      pctx.beginPath(); pctx.moveTo(x - half, ly); pctx.lineTo(x + half, ly); pctx.stroke();
    }
    pctx.restore();
  }
  function printNote(n) {
    var d = degOf(n.freq);
    var shapes = SHAPES[cond.mode] || SHAPES.ionian;
    var shape = shapes[d.deg] || "sol";
    var q = staffQ(n.freq);                        // the grand-staff line/space
    var x = W - 26;
    var y = yOfQ(q);
    var sp = stepPx();
    var s = sp * (n.layer === "clarinet" ? 0.85 : n.layer === "bagpipe" ? 0.92 : n.layer === "bells" ? 0.6 : 0.74);
    var filled = (n.duration || 1) < 1.6;          // long notes print hollow
    var alpha = n.layer === "choir" ? 0.68 : n.layer === "harmonium" ? 0.45 : n.layer === "bells" ? 0.72 : 0.95;
    var wear = Math.min(0.5, curGen * 0.07);       // engraving wear: deep descendants double-strike

    pctx.save();
    pctx.translate(0.5, 0.5);
    pctx.strokeStyle = INK;
    pctx.fillStyle = INK;
    pctx.lineWidth = 1.2;
    pctx.globalAlpha = alpha;
    drawLedgers(x, q, s, alpha);
    if (wear > 0.06) {                             // the worn plate: a pale offset strike
      pctx.save();
      pctx.globalAlpha = alpha * wear;
      shapePath(pctx, shape, x + 1.6, y + 1.1, s);
      pctx.stroke();
      pctx.restore();
    }
    shapePath(pctx, shape, x, y, s);
    if (filled) pctx.fill(); else pctx.stroke();
    // the stem points away from the middle line of the note's own staff
    // (treble middle = q16, bass middle = q4), the way engraved notation sets it
    var pivot = q >= Q_MID ? 16 : 4;
    var stemLen = 2.2 * sp;
    pctx.globalAlpha = alpha * 0.8;
    pctx.beginPath();
    if (q < pivot) { pctx.moveTo(x + s, y - 1); pctx.lineTo(x + s, y - stemLen); }
    else { pctx.moveTo(x - s, y + 1); pctx.lineTo(x - s, y + stemLen); }
    pctx.stroke();
    pctx.restore();
  }
  // ---- the wire's Morse, as telegraph tape -----------------------------------
  // The telegraph is not a voice, so it is not engraved as note-heads. Its run
  // of dits (dots) and dahs (short bars) is laid on a faint wire through the
  // middle of the grand staff — the way a telegraph register inked a paper tape.
  // The taps are far too quick to space out by scroll time, so the whole run is
  // stamped at once, then travels and fades with the rest of the ink.
  // The final layout of a mark run: each mark's resting x (left edge) once the
  // whole tape has been keyed out, with the band's right edge at the engraving
  // point. The gap AFTER each mark groups the tape: tight within a letter, wider
  // between letters, wider still between words (matching the keyed timing).
  function telegraphLayout(marks) {
    var sp = stepPx();
    var rd = Math.max(1.4, sp * 0.26), dahLen = sp * 1.7, dahThick = Math.max(2, sp * 0.44);
    var gi = sp * 0.5, gl = sp * 1.5, gw = sp * 2.8;
    function gapW(g) { return g === "w" ? gw : g === "l" ? gl : g === "e" ? 0 : gi; }
    var xs = [], gapAfter = [], total = 0, i;
    for (i = 0; i < marks.length; i++) {
      xs[i] = total;
      gapAfter[i] = gapW(marks[i].gap);
      total += (marks[i].dah ? dahLen : 2 * rd) + gapAfter[i];
    }
    var last = marks[marks.length - 1];
    var fxLeft = (W - 26) - total;                 // band left edge, once complete
    var fx = xs.map(function (x) { return fxLeft + x; });
    return { fx: fx, gapAfter: gapAfter, rd: rd, dahLen: dahLen, dahThick: dahThick,
             Tt: last.at + last.len };
  }
  // Stamp ONE dit/dah (with its leading run of wire) onto the scrolling page.
  function stampMark(mark, x, lay, leadGap) {
    var y = yOfQ(Q_MID);                            // the middle-C line, dead centre
    var mw = mark.dah ? lay.dahLen : 2 * lay.rd;
    pctx.save();
    pctx.translate(0.5, 0.5);
    // the wire, continuing from the previous mark
    pctx.globalAlpha = 0.3;
    pctx.strokeStyle = INK;
    pctx.lineWidth = 1;
    pctx.beginPath(); pctx.moveTo(x - leadGap, y); pctx.lineTo(x + mw, y); pctx.stroke();
    // the mark
    pctx.fillStyle = INK;
    pctx.globalAlpha = 0.72;
    if (mark.dah) pctx.fillRect(x, y - lay.dahThick / 2, lay.dahLen, lay.dahThick);
    else { pctx.beginPath(); pctx.arc(x + lay.rd, y, lay.rd, 0, Math.PI * 2); pctx.fill(); }
    pctx.restore();
  }
  // ---- the static staff layer: two staves, a brace, and the two clefs --------
  // Drawn once per resize onto its own canvas, then composited under the
  // scrolling ink each frame (so the rules and clefs hold still while notes
  // travel).
  function buildStaffLayer(c) {
    c.clearRect(0, 0, W, H);
    var xL = 22, xR = W;                            // rules run from the barline to the right edge
    var sp = stepPx(), staffH = 8 * sp;
    // the ten rules
    c.strokeStyle = RULE; c.lineWidth = 1;
    var rules = BASS_RULES.concat(TREBLE_RULES);
    for (var i = 0; i < rules.length; i++) {
      var yy = yOfQ(rules[i]) + 0.5;
      c.beginPath(); c.moveTo(xL, yy); c.lineTo(xR, yy); c.stroke();
    }
    // the left barline joining the staves through the gap
    c.strokeStyle = INK_SOFT; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(xL + 0.5, yOfQ(20)); c.lineTo(xL + 0.5, yOfQ(0)); c.stroke();
    // the brace
    var bx = 12, yt = yOfQ(20), yb = yOfQ(0), mid = (yt + yb) / 2;
    c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = "round";
    c.beginPath();
    c.moveTo(bx + 6, yt);
    c.quadraticCurveTo(bx - 3, yt, bx + 1, (yt + mid) / 2);
    c.quadraticCurveTo(bx + 5, mid - 3, bx - 4, mid);
    c.quadraticCurveTo(bx + 5, mid + 3, bx + 1, (yb + mid) / 2);
    c.quadraticCurveTo(bx - 3, yb, bx + 6, yb);
    c.stroke();
    // the two clefs — treble curl on the G line (q14), bass dots on the F line (q6)
    if (!trebPath && typeof Path2D === "function") {
      trebPath = new Path2D(CLEF_TREBLE.d);
      bassPath = new Path2D(CLEF_BASS.d);
    }
    var bassH = 0.80 * staffH;
    if (trebPath) {
      // Seat each clef by its reference line so size can change without shifting
      // the seating: the treble curl (0.58 down its glyph) rides the G line
      // (q14); the bass dots (0.24 down) straddle the F line (q6).
      var trebH = 1.28 * staffH;
      drawClef(c, CLEF_TREBLE, trebPath, 30, yOfQ(14) - 0.583 * trebH, trebH);
      drawClef(c, CLEF_BASS,   bassPath, 30, yOfQ(6)  - 0.237 * bassH, bassH);
    }
    // The scrolling ink must be gone by the time it reaches the clefs. Compute
    // the right edge of the (wider) bass clef, and fade the ink to nothing just
    // before it — so notes never cross the clefs or the brace.
    var bassW = bassH * (CLEF_BASS.bbox[2] - CLEF_BASS.bbox[0]) / (CLEF_BASS.bbox[3] - CLEF_BASS.bbox[1]);
    fadeX0 = 30 + bassW + 4;                        // ink ≈ 0 here (just past the clefs)
    fadeX1 = fadeX0 + 58;                           // ink at full strength here
  }
  function stampFuging() {
    if (!pctx) return;
    pctx.save();
    pctx.globalAlpha = 0.5;
    pctx.fillStyle = INK;
    pctx.font = "italic " + Math.max(13, Math.round(H * 0.06)) + "px serif";
    pctx.fillText("⁂", W - 34, H * 0.16);
    pctx.restore();
  }

  var lastFrame = 0;
  var scrollAcc = 0;
  var SCROLL_PX_S = 11;                            // the page turns slowly — prairie time
  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!ctx2d || !pctx) return;
    var dt = lastFrame ? Math.min(0.1, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;

    // scroll the ink leftward (whole pixels only; sub-pixel drift blurs ink)
    scrollAcc += SCROLL_PX_S * dt;
    var shift = Math.floor(scrollAcc);
    if (shift > 0) {
      scrollAcc -= shift;
      pctx.save();
      pctx.globalCompositeOperation = "copy";
      pctx.drawImage(page, -shift, 0);
      pctx.restore();
    }
    // the ink dries: a whisper of erasure each frame. 0.0006/frame at 60fps
    // ≈ 3.5%/s — a note holds for a minute and is gone within two. The
    // sacrament blanks the page in a few seconds; the postlude dries faster.
    pctx.save();
    pctx.globalCompositeOperation = "destination-out";
    pctx.globalAlpha = 0.0006 + (cond.section === "sacrament" ? 0.02 : 0) + (cond.section === "postlude" ? 0.004 : 0);
    pctx.fillRect(0, 0, W, H);
    pctx.restore();

    // print notes whose moment has come
    if (playing && K && K.getAudioTime) {
      var now = K.getAudioTime();
      var i = 0;
      while (i < pending.length) {
        if (pending[i].startTime <= now + 0.03) {
          if (pending[i].startTime > now - 2) printNote(pending[i]);
          pending.splice(i, 1);
        } else i++;
      }
      // telegraph: a message that has begun moves to the active list; there each
      // mark is stamped at the instant it is keyed. To land at readable spacing
      // despite the slow scroll, a mark is stamped to the RIGHT of its resting
      // place by exactly the scroll still to come before the message ends — so
      // by the last tap the whole run has drifted into its proper tape.
      var j = 0;
      while (j < pendingTelegraph.length) {
        var pt = pendingTelegraph[j];
        if (pt.startTime <= now + 0.03) {
          if (pt.startTime > now - 3 && pt.marks && pt.marks.length) {
            activeTelegraph.push({ marks: pt.marks, t0: pt.startTime, count: 0, lay: telegraphLayout(pt.marks) });
          }
          pendingTelegraph.splice(j, 1);
        } else j++;
      }
      var a = 0;
      while (a < activeTelegraph.length) {
        var msg = activeTelegraph[a];
        while (msg.count < msg.marks.length && msg.t0 + msg.marks[msg.count].at <= now + 0.02) {
          var mi = msg.count, mk = msg.marks[mi];
          var mx = msg.lay.fx[mi] + SCROLL_PX_S * (msg.lay.Tt - mk.at);
          stampMark(mk, mx, msg.lay, mi > 0 ? msg.lay.gapAfter[mi - 1] : msg.lay.rd);
          msg.count++;
        }
        if (msg.count >= msg.marks.length) activeTelegraph.splice(a, 1); else a++;
      }
    }

    // composite to screen: the static staves + clefs, then the scrolling ink —
    // but the ink is first pulled through a left-edge fade so notes dissolve to
    // nothing just before the clefs and brace instead of sliding across them.
    ctx2d.clearRect(0, 0, W, H);
    if (staffLayer) ctx2d.drawImage(staffLayer, 0, 0, W, H);
    if (fadeCtx && fadeGrad) {
      fadeCtx.globalCompositeOperation = "source-over";
      fadeCtx.clearRect(0, 0, W, H);
      fadeCtx.drawImage(page, 0, 0);
      fadeCtx.globalCompositeOperation = "destination-in";   // keep ink only where the mask is opaque
      fadeCtx.fillStyle = fadeGrad;
      fadeCtx.fillRect(0, 0, W, H);
      ctx2d.drawImage(fadeCanvas, 0, 0);
    } else {
      ctx2d.drawImage(page, 0, 0);
    }

    drawOrgan(dt);
    drawDial(dt);
    drawWheel(dt);
  }

  // ---- the Liahona dial — a hexagonal case -----------------------------------
  function hexPathAt(c, x, y, s) {
    c.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 90);       // pointy-top
      c[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(a) * s, y + Math.sin(a) * s);
    }
    c.closePath();
  }
  // radius of that hexagon's boundary at angle a — so the section ticks land
  // exactly on the case, corner or edge alike
  function hexR(a, s) {
    var deg = (a * 180 / Math.PI % 60 + 60) % 60;  // fold to one 60° sector
    if (deg > 30) deg = 60 - deg;                  // distance to nearest edge-center
    return s * Math.cos(Math.PI / 6) / Math.cos(deg * Math.PI / 180);
  }
  function drawDial(dt) {
    if (!dctx) return;
    var w = DW, h = DH;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;
    dctx.clearRect(0, 0, w, h);
    dctx.save();
    dctx.translate(0.5, 0.5);
    // engraved rim, double rule
    dctx.strokeStyle = INK_SOFT;
    dctx.lineWidth = 1;
    hexPathAt(dctx, cx, cy, R); dctx.stroke();
    hexPathAt(dctx, cx, cy, R * 0.86); dctx.stroke();
    // ticks — seven, one per section of the order, rim to rim
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
      var tr0 = hexR(a, R * 0.86), tr1 = hexR(a, R);
      dctx.beginPath();
      dctx.moveTo(cx + Math.cos(a) * tr0, cy + Math.sin(a) * tr0);
      dctx.lineTo(cx + Math.cos(a) * tr1, cy + Math.sin(a) * tr1);
      dctx.stroke();
    }
    if (playing) {
      // the section needle — walks the whole order of service
      var prog = ((cond.sectionIndex || 0) + Math.max(0, Math.min(1, cond.local || 0))) / Math.max(1, cond.planLength || 7);
      var na = -Math.PI / 2 + prog * Math.PI * 2;
      // the one soft glow in the whole interface (it is named Kolob, after all)
      var glow = liahonaGlint > 0 ? 0.6 + 0.4 * Math.sin(liahonaGlint * 9) : 0.18;
      dctx.save();
      dctx.shadowColor = "rgba(138, 160, 90, " + glow.toFixed(2) + ")";
      dctx.shadowBlur = liahonaGlint > 0 ? 9 : 4;
      dctx.strokeStyle = GOLD;
      dctx.lineWidth = 1.6;
      dctx.beginPath();
      dctx.moveTo(cx - Math.cos(na) * R * 0.14, cy - Math.sin(na) * R * 0.14);
      dctx.lineTo(cx + Math.cos(na) * R * 0.78, cy + Math.sin(na) * R * 0.78);
      dctx.stroke();
      dctx.restore();
      // the intensity pointer — a short inner leaf
      var ia = -Math.PI / 2 + (cond.intensity || 0) * Math.PI * 2;
      dctx.strokeStyle = INK;
      dctx.globalAlpha = 0.7;
      dctx.lineWidth = 1.1;
      dctx.beginPath();
      dctx.moveTo(cx, cy);
      dctx.lineTo(cx + Math.cos(ia) * R * 0.42, cy + Math.sin(ia) * R * 0.42);
      dctx.stroke();
      dctx.globalAlpha = 1;
    }
    // hub
    dctx.fillStyle = INK;
    dctx.beginPath(); dctx.arc(cx, cy, 2.2, 0, Math.PI * 2); dctx.fill();
    dctx.restore();
    if (liahonaGlint > 0) liahonaGlint = Math.max(0, liahonaGlint - dt);
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
    var R = Math.max(XW * 0.5, 280);
    var crownY = XH * 0.30;
    return {
      fontPx: fontPx, R: R, cx: XW / 2, cy: crownY + R, crownY: crownY,
      horizonY: crownY + Math.min(R * 0.44, XH - crownY - 8),
      rBanner: R - fontPx * 2.35,                            // the banner's inner rule
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
    // beneath the banner: the dial. A spoke to every seat, a faint hour ring
    // with quarter-marks between the seats — the turning made visible.
    var rHour = g.rBanner - fontPx * 1.3;
    c.strokeStyle = inkA(0.12);
    c.beginPath(); c.arc(cx, cy, rHour, 0, Math.PI * 2); c.stroke();
    for (var q = 0; q < NSEAT * 4; q++) {
      var qa = -Math.PI / 2 + (q / 4 - wh.offset) * SEAT_STEP;
      if (q % 4 === 0) { c.strokeStyle = inkA(0.2); radial(c, cx, cy, qa, 0, g.rBanner); }
      else { var half = q % 4 === 2; c.strokeStyle = inkA(half ? 0.3 : 0.2); radial(c, cx, cy, qa, rHour, rHour - (half ? 9 : 5)); }
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

    // the horizon: the letterpress rule the wheel sets behind
    c.strokeStyle = inkA(0.42);
    c.beginPath(); c.moveTo(0, g.horizonY + 0.5); c.lineTo(XW, g.horizonY + 0.5); c.stroke();
    c.strokeStyle = inkA(0.16);
    c.beginPath(); c.moveTo(0, g.horizonY + 4.5); c.lineTo(XW, g.horizonY + 4.5); c.stroke();

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
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var rect = canvas.getBoundingClientRect();
    W = Math.max(60, Math.round(rect.width));
    H = Math.max(60, Math.round(rect.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx2d = canvas.getContext("2d");
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    var old = page;
    page = document.createElement("canvas");
    page.width = W; page.height = H;
    pctx = page.getContext("2d");
    if (old) pctx.drawImage(old, 0, 0, W, H);
    // rebuild the static staff layer (staves, brace, clefs) at device resolution
    staffLayer = document.createElement("canvas");
    staffLayer.width = W * dpr; staffLayer.height = H * dpr;
    var sctx = staffLayer.getContext("2d");
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStaffLayer(sctx);                          // also sets fadeX0 / fadeX1
    // a same-size layer used to fade the scrolling ink toward the left (built
    // fresh so it tracks W/H); the gradient is the fade mask, transparent under
    // the clefs and opaque out where the notes are engraved.
    fadeCanvas = document.createElement("canvas");
    fadeCanvas.width = W; fadeCanvas.height = H;
    fadeCtx = fadeCanvas.getContext("2d");
    fadeGrad = fadeCtx.createLinearGradient(fadeX0, 0, fadeX1, 0);
    fadeGrad.addColorStop(0, "rgba(0,0,0,0)");
    fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
    if (dial) {
      var dr = dial.getBoundingClientRect();
      DW = Math.max(40, Math.round(dr.width));
      DH = Math.max(40, Math.round(dr.height));
      dial.width = DW * dpr; dial.height = DH * dpr;
      dctx = dial.getContext("2d");
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (organ) {
      var or = organ.getBoundingClientRect();
      OW = Math.max(60, Math.round(or.width));
      OH = Math.max(60, Math.round(or.height));
      organ.width = OW * dpr; organ.height = OH * dpr;
      octx = organ.getContext("2d");
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (wheel) {
      var xr = wheel.getBoundingClientRect();
      XW = Math.max(60, Math.round(xr.width));
      XH = Math.max(60, Math.round(xr.height));
      wheel.width = XW * dpr; wheel.height = XH * dpr;
      xctx = wheel.getContext("2d");
      xctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function init(mainCanvas, dialCanvas, organCanvas, wheelCanvas) {
    canvas = mainCanvas || null;
    dial = dialCanvas || null;
    organ = organCanvas || null;
    wheel = wheelCanvas || null;
    if (!canvas && !dial && !organ && !wheel) return;
    resize();
    window.addEventListener("resize", resize);
    if (K) {
      if (K.setNoteListener) K.setNoteListener(onNote);
      if (K.setEventListener) K.setEventListener(onEvent);
    }
    running = true;
    requestAnimationFrame(frame);
  }
  function setConductor(c, isPlaying) {
    if (c) cond = c;
    playing = !!isPlaying;
  }

  return { init: init, setConductor: setConductor, setWheelLabels: setWheelLabels, wheelSeatAt: wheelSeatAt };
})();
