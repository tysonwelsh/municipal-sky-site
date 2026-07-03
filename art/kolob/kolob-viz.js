// ============================================================================
// KOLOB — the open hymnal (visualizer)
//
// Two instruments of seeing, both printed things:
//  · THE PAGE — a scrolling engraving. Melodic notes print as 4-shape
//    SHAPE-NOTE heads (fa △, sol ○, la ▭, mi ◇) in green ink over the ruled
//    paper (the rules themselves are CSS; the canvas holds only ink). Deeper
//    motif generations print worn — double-struck, spread. The ink dries and
//    pales as the page scrolls on. In the sacrament the page goes almost
//    blank; ink returns with the doxology.
//  · THE LIAHONA — a small engraved dial. One needle walks the section, a
//    second leans with the intensity; it glints when the oracle points.
//
// No neon, no glitch, no CRT. A printed thing with one soft glow in it.
// Public surface: window.KolobViz = { init(canvas, dialCanvas), setConductor }
// ============================================================================

window.KolobViz = (function () {
  "use strict";
  var K = window.KolobAudio;

  var canvas = null, ctx2d = null;
  var page = null, pctx = null;                    // offscreen ink layer
  var dial = null, dctx = null;
  var W = 0, H = 0, DW = 0, DH = 0, dpr = 1;
  var running = false;

  var cond = { section: null, local: 0, intensity: 0, f0: 65, mode: "ionian", hush: false, fuging: false };
  var playing = false;
  var curGen = 0;                                  // engraving wear follows the working generation
  var liahonaGlint = 0;                            // seconds of glint remaining

  var INK = "#1e4d3b";                             // hymnbook green
  var INK_SOFT = "rgba(30, 77, 59, 0.55)";
  var GOLD = "#8a7a45";                            // a restrained gilt for the dial

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
  function yOf(freq) {
    // log-pitch mapping across ~4 octaves of the meeting's world
    var root = (cond.f0 || 65) * 2;
    var pos = Math.log2(freq / root);              // 0..~4
    var frac = Math.max(0, Math.min(1, pos / 4.2));
    return H * (0.88 - frac * 0.76);
  }

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
  function printNote(n) {
    var d = degOf(n.freq);
    var shapes = SHAPES[cond.mode] || SHAPES.ionian;
    var shape = shapes[d.deg] || "sol";
    var x = W - 26;
    var y = yOf(n.freq);
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
    if (wear > 0.06) {                             // the worn plate: a pale offset strike
      pctx.save();
      pctx.globalAlpha = alpha * wear;
      shapePath(pctx, shape, x + 1.6, y + 1.1, s);
      pctx.stroke();
      pctx.restore();
    }
    shapePath(pctx, shape, x, y, s);
    if (filled) pctx.fill(); else pctx.stroke();
    // the stem
    pctx.globalAlpha = alpha * 0.8;
    pctx.beginPath();
    pctx.moveTo(x + s, y - 1);
    pctx.lineTo(x + s, y - 16);
    pctx.stroke();
    pctx.restore();
  }
  function stampFuging() {
    if (!pctx) return;
    pctx.save();
    pctx.globalAlpha = 0.5;
    pctx.fillStyle = INK;
    pctx.font = "italic " + Math.round(H * 0.06) + "px serif";
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

    drawDial(dt);
  }

  // ---- the Liahona dial ------------------------------------------------------
  function drawDial(dt) {
    if (!dctx) return;
    var w = DW, h = DH;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
    dctx.clearRect(0, 0, w, h);
    dctx.save();
    dctx.translate(0.5, 0.5);
    // engraved rim, double rule
    dctx.strokeStyle = INK_SOFT;
    dctx.lineWidth = 1;
    dctx.beginPath(); dctx.arc(cx, cy, R, 0, Math.PI * 2); dctx.stroke();
    dctx.beginPath(); dctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2); dctx.stroke();
    // ticks — seven, one per section of the order
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
      dctx.beginPath();
      dctx.moveTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
      dctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
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
  }

  function init(mainCanvas, dialCanvas) {
    canvas = mainCanvas || null;
    dial = dialCanvas || null;
    if (!canvas && !dial) return;
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
