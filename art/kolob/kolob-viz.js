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
//  · THE PAGE — a scrolling engraving. Melodic notes print as 4-shape
//    SHAPE-NOTE heads (fa △, sol ○, la ▭, mi ◇) in green ink on a REAL diatonic
//    staff: each head snaps to the line or space of its scale-degree, with
//    ledger lines above and below, so the printed contour is the sung one (the
//    rules themselves are CSS; the canvas holds only ink). Deeper
//    motif generations print worn — double-struck, spread. The ink dries and
//    pales as the page scrolls on. In the sacrament the page goes almost
//    blank; ink returns with the doxology.
//  · THE LIAHONA — a small engraved dial in a hexagonal case. One needle
//    walks the section, a second leans with the intensity; it glints when
//    the oracle points.
//
// No neon, no glitch, no CRT. A printed thing with one soft glow in it.
// Public surface: window.KolobViz = { init(canvas, dialCanvas, organCanvas), setConductor }
// ============================================================================

window.KolobViz = (function () {
  "use strict";
  var K = window.KolobAudio;

  var canvas = null, ctx2d = null;
  var page = null, pctx = null;                    // offscreen ink layer
  var dial = null, dctx = null;
  var organ = null, octx = null;                   // the facade
  var W = 0, H = 0, DW = 0, DH = 0, OW = 0, OH = 0, dpr = 1;
  var running = false;

  var cond = { section: null, local: 0, intensity: 0, f0: 65, mode: "ionian", hush: false, fuging: false };
  var playing = false;
  var curGen = 0;                                  // engraving wear follows the working generation
  var liahonaGlint = 0;                            // seconds of glint remaining

  var INK = "#1e4d3b";                             // hymnbook green
  var INK_SOFT = "rgba(30, 77, 59, 0.55)";
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
  // The five printed rules are a REAL diatonic staff: a note snaps to a line or
  // space by its scale-degree letter, one diatonic step = half a staff-space.
  // STAFFPOS gives the diatonic letter (0..6) of each collection degree, so the
  // gapped folk scales (penta/hexa) simply leave their missing letters empty —
  // as a shape-note tunebook would.
  var STAFFPOS = {
    ionian:     [0, 1, 2, 3, 4, 5, 6],
    mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian:     [0, 1, 2, 3, 4, 5, 6],
    aeolian:    [0, 1, 2, 3, 4, 5, 6],
    penta:      [0, 1, 2, 4, 5],
    hexa:       [0, 1, 2, 3, 4, 5],
  };
  // The staff window, measured in diatonic steps p (p=0 is the bottom rule, p=8
  // the top rule). Two octaves are allowed — from 3 steps below the staff to 3
  // above — so the melody rides the rules with at most a couple of ledger lines.
  // Only the rarer-than-two-octave extremes (a deep bass, an octave doubling up
  // top) fold back in by whole octaves: the letter (hence the shape) survives,
  // just the register wraps, the way a small staff quietly gathers stray voices.
  var STAFF_LO = -3, STAFF_HI = 11;
  // Geometry MIRRORS kolob.css .kolob-viz-wrap: bottom rule at 76% of the strip,
  // 6% of the strip per diatonic step (so rule-to-rule = 12%). Keep these in sync
  // with the CSS background-position percentages.
  var STAFF_BOT = 0.76, STAFF_STEP = 0.06;
  function staffP(freq) {
    var d = degOf(freq);
    var letters = STAFFPOS[cond.mode] || STAFFPOS.ionian;
    var pos = letters[d.deg];
    if (pos == null) pos = d.deg;
    var p = pos + 7 * d.oct;                        // diatonic letter from the tonic-root
    while (p < STAFF_LO) p += 7;                    // fold only the >2-octave extremes
    while (p > STAFF_HI) p -= 7;
    return p;
  }
  function yOfP(p) { return H * (STAFF_BOT - p * STAFF_STEP); }

  // ---- note intake -----------------------------------------------------------
  var pending = [];                                // notes waiting for their startTime
  var MELODIC = { clarinet: 1, bagpipe: 1, choir: 1, bells: 1, harmonium: 1, ambient: 0 };
  function onNote(n) {
    if (!n || !n.freq || n.freq < 20) return;
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
  // the short strokes that carry a note above or below the five printed rules —
  // drawn only for the outermost octave-edges, one per line the note has climbed
  function drawLedgers(x, p, s, alpha) {
    pctx.save();
    pctx.globalAlpha = alpha * 0.72;
    pctx.strokeStyle = INK;
    pctx.lineWidth = 1;
    var half = s * 2.0, lp, ly;
    if (p > 8) for (lp = 10; lp <= p; lp += 2) { ly = yOfP(lp); pctx.beginPath(); pctx.moveTo(x - half, ly); pctx.lineTo(x + half, ly); pctx.stroke(); }
    if (p < 0) for (lp = -2; lp >= p; lp -= 2) { ly = yOfP(lp); pctx.beginPath(); pctx.moveTo(x - half, ly); pctx.lineTo(x + half, ly); pctx.stroke(); }
    pctx.restore();
  }
  function printNote(n) {
    var d = degOf(n.freq);
    var shapes = SHAPES[cond.mode] || SHAPES.ionian;
    var shape = shapes[d.deg] || "sol";
    var p = staffP(n.freq);                        // the diatonic line/space
    var x = W - 26;
    var y = yOfP(p);
    var s = n.layer === "clarinet" ? 6.5 : n.layer === "bagpipe" ? 7 : n.layer === "bells" ? 4.5 : 5.5;
    var filled = (n.duration || 1) < 1.6;          // long notes print hollow
    var alpha = n.layer === "choir" ? 0.68 : n.layer === "harmonium" ? 0.45 : n.layer === "bells" ? 0.72 : 0.95;
    var wear = Math.min(0.5, curGen * 0.07);       // engraving wear: deep descendants double-strike

    pctx.save();
    pctx.translate(0.5, 0.5);
    pctx.strokeStyle = INK;
    pctx.fillStyle = INK;
    pctx.lineWidth = 1.2;
    pctx.globalAlpha = alpha;
    if (p < 0 || p > 8) drawLedgers(x, p, s, alpha);
    if (wear > 0.06) {                             // the worn plate: a pale offset strike
      pctx.save();
      pctx.globalAlpha = alpha * wear;
      shapePath(pctx, shape, x + 1.6, y + 1.1, s);
      pctx.stroke();
      pctx.restore();
    }
    shapePath(pctx, shape, x, y, s);
    if (filled) pctx.fill(); else pctx.stroke();
    // the stem — flips at the middle rule (p=4) the way engraved notation does,
    // so high notes hang their stems down and nothing shoots off the strip
    pctx.globalAlpha = alpha * 0.8;
    pctx.beginPath();
    if (p > 4) { pctx.moveTo(x - s, y + 1); pctx.lineTo(x - s, y + 16); }
    else { pctx.moveTo(x + s, y - 1); pctx.lineTo(x + s, y - 16); }
    pctx.stroke();
    pctx.restore();
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
    }

    // composite to screen
    ctx2d.clearRect(0, 0, W, H);
    ctx2d.drawImage(page, 0, 0);

    drawOrgan(dt);
    drawDial(dt);
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
  }

  function init(mainCanvas, dialCanvas, organCanvas) {
    canvas = mainCanvas || null;
    dial = dialCanvas || null;
    organ = organCanvas || null;
    if (!canvas && !dial && !organ) return;
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

  return { init: init, setConductor: setConductor };
})();
