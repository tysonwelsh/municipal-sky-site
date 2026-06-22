// ============================================================================
// Prospero's Jukebox — Scene Visualization
//
// Renders generative-data-driven visuals for each layer. Each visualization
// subscribes to a listener exposed by ProsperoAudio and renders the
// underlying signal structure — not arbitrary motion.
//
// First viz: drone as pitch-time ribbons.
//   X axis = time (now at right edge, history scrolling left)
//   Y axis = log frequency (low at bottom, high at top)
//   Each cycle = a horizontal "lens" whose thickness traces the amplitude
//   envelope (fade-in → hold → fade-out). Sub-octave appears as a separate
//   ribbon at half-frequency.
// ============================================================================

// ----------------------------------------------------------------------------
// Shared track palette + helpers. Canvas-rendered visuals can't read CSS
// variables, so colors are duplicated here. Keep this in rough alignment with
// the per-track theme overrides in prosperos-jukebox.css.
// ----------------------------------------------------------------------------
var TRACK_COLORS = {
  library: {
    // Raw RGB triples for renderers that build their own rgba strings.
    fgRGB:  "255, 170, 0",
    subRGB: "255, 130, 40",
    bg:     "#0a0a0a",
    // Drone ribbon
    droneMain:      "rgba(255, 170, 0, 0.55)",
    droneSub:       "rgba(255, 130, 40, 0.45)",
    droneThickPeak: 0.09,           // reference peak gain for max ribbon thickness
    // Grid / labels
    gridLine:       "rgba(255, 170, 0, 0.06)",
    gridLineMid:    "rgba(255, 170, 0, 0.10)",
    gridStrong:     "rgba(255, 170, 0, 0.22)",
    gridLabel:      "rgba(255, 170, 0, 0.18)",
    gridLabelDense: "rgba(255, 170, 0, 0.30)",
    nowLine:        "rgba(255, 170, 0, 0.35)",
    nowLabel:       "rgba(255, 170, 0, 0.45)",
    // Density curve
    curve:          "rgba(244, 201, 90, 0.85)",
    curveFuture:    "rgba(244, 201, 90, 0.40)",
    fill:           "rgba(255, 170, 0, 0.10)",
    fillFuture:     "rgba(255, 170, 0, 0.05)",
    futureTint:     "rgba(255, 170, 0, 0.03)",
    dot:            "rgba(244, 201, 90, 0.95)",
  },
  sycorax: {
    fgRGB:  "196, 181, 253",
    subRGB: "128, 224, 208",
    bg:     "#08070f",
    droneMain:      "rgba(196, 181, 253, 0.55)", // lavender
    droneSub:       "rgba(155, 135, 216, 0.45)",
    droneThickPeak: 0.035,                       // sycorax drones are quieter; rescale
    gridLine:       "rgba(196, 181, 253, 0.06)",
    gridLineMid:    "rgba(196, 181, 253, 0.10)",
    gridStrong:     "rgba(196, 181, 253, 0.22)",
    gridLabel:      "rgba(196, 181, 253, 0.18)",
    gridLabelDense: "rgba(196, 181, 253, 0.30)",
    nowLine:        "rgba(196, 181, 253, 0.35)",
    nowLabel:       "rgba(196, 181, 253, 0.45)",
    curve:          "rgba(196, 181, 253, 0.85)",
    curveFuture:    "rgba(196, 181, 253, 0.40)",
    fill:           "rgba(196, 181, 253, 0.10)",
    fillFuture:     "rgba(196, 181, 253, 0.05)",
    futureTint:     "rgba(196, 181, 253, 0.03)",
    dot:            "rgba(196, 181, 253, 0.95)",
  },
  ariel: {
    // Sky-blue / aqua palette for the airy/aquatic F-Lydian mood.
    fgRGB:  "150, 220, 255",
    subRGB: "100, 200, 220",
    bg:     "#06090e",
    droneMain:      "rgba(150, 220, 255, 0.55)",
    droneSub:       "rgba(100, 200, 220, 0.45)",
    droneThickPeak: 0.06,
    gridLine:       "rgba(150, 220, 255, 0.06)",
    gridLineMid:    "rgba(150, 220, 255, 0.10)",
    gridStrong:     "rgba(150, 220, 255, 0.22)",
    gridLabel:      "rgba(150, 220, 255, 0.18)",
    gridLabelDense: "rgba(150, 220, 255, 0.30)",
    nowLine:        "rgba(150, 220, 255, 0.35)",
    nowLabel:       "rgba(150, 220, 255, 0.45)",
    curve:          "rgba(180, 235, 255, 0.85)",
    curveFuture:    "rgba(180, 235, 255, 0.40)",
    fill:           "rgba(150, 220, 255, 0.10)",
    fillFuture:     "rgba(150, 220, 255, 0.05)",
    futureTint:     "rgba(150, 220, 255, 0.03)",
    dot:            "rgba(180, 235, 255, 0.95)",
  },
};

function vizCurrentTrack() {
  if (!window.ProsperoAudio || !ProsperoAudio.getState) return "library";
  return (ProsperoAudio.getState().currentTrack) || "library";
}

function vizColors() {
  return TRACK_COLORS[vizCurrentTrack()] || TRACK_COLORS.library;
}


// ============================================================================
// Event log — every audible event the engine emits, newest at top.
//
// Subscribes to four listeners on ProsperoAudio:
//   - setMotifListener:   motif fires from the primary melodic layer
//   - setDroneListener:   one entry per drone cycle (pitches + chord)
//   - setAmbientListener: ambient-pool event names (page_turn, cricket, etc.)
//   - setPreviewListener: layer previews triggered from the mixer
//
// The session timer resets when the track switches (motif listener emits
// `clear`). Header label retints via CSS theme classes set by the UI.
// ============================================================================
(function () {
  "use strict";
  if (!window.ProsperoAudio || !ProsperoAudio.setMotifListener) return;

  var logEl = document.getElementById("jukebox-log");
  var labelEl = document.getElementById("jukebox-log-label");
  if (!logEl) return;

  var LOG_MAX = 200;
  var sessionStart = null;

  var EMPTY_COPY = {
    library: "Press PLAY on the Library track. Audio events will appear here as they fire.",
    sycorax: "Press PLAY on the Sycorax track. Audio events will appear here as they fire.",
    ariel:   "Press PLAY on the Ariel track. Audio events will appear here as they fire.",
  };

  function formatTime(sec) {
    if (sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec - m * 60);
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function pitchClassFromHz(hz) {
    if (!hz || hz <= 0) return "";
    var midi = 69 + 12 * Math.log2(hz / 440);
    var names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    var octave = Math.floor(midi / 12) - 1;
    return names[((Math.round(midi) % 12) + 12) % 12] + octave;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function clearLog(track) {
    sessionStart = null;
    logEl.innerHTML =
      '<div class="jukebox-log-empty">' +
      escapeHtml(EMPTY_COPY[track] || "Press PLAY.") +
      "</div>";
  }

  // Display names for the log's layer pill. Mirrors the labels used in
  // the mixer (UI.js TRACK_LAYERS) so the log calls each voice the same
  // thing the mixer does — HARPSICHORD instead of MELODY, MUSIC BOX
  // instead of MUSICBOX, GHOST TONES instead of GHOST, etc. Keep in
  // sync with prosperos-jukebox-ui.js → TRACK_LAYERS.
  var LAYER_DISPLAY = {
    library: {
      drone:    "DRONE",
      melody:   "HARPSICHORD",
      musicBox: "MUSIC BOX",
      clock:    "CLOCK",
      hum:      "HUM",
      ambient:  "AMBIENT",
    },
    sycorax: {
      drone:      "DRONE",
      whispers:   "WHISPERS",
      ghost:      "GHOST TONES",
      waterphone: "WATERPHONE",
      heartbeat:  "HEARTBEAT",
      scrape:     "SCRAPE",
      ambient:    "AMBIENT",
    },
    ariel: {
      breeze:  "BREEZE",
      bass:    "BASS",
      chimes:  "CHIMES",
      flutter: "FLUTTER",
      bubbles: "BUBBLES",
      whistle: "WHISTLE",
      ambient: "AMBIENT",
    },
  };
  function layerLabel(track, key) {
    if (LAYER_DISPLAY[track] && LAYER_DISPLAY[track][key]) {
      return LAYER_DISPLAY[track][key];
    }
    // Fallback: split camelCase into words and uppercase ("musicBox" → "MUSIC BOX")
    return (key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toUpperCase();
  }

  function appendRow(timeSec, track, layer, detailHTML) {
    if (sessionStart == null) {
      sessionStart = timeSec;
      logEl.innerHTML = "";
    }
    var row = document.createElement("div");
    row.className = "jukebox-log-row";
    row.innerHTML =
      '<span class="jukebox-log-time">' +
        formatTime(timeSec - sessionStart) +
      '</span>' +
      '<span class="jukebox-log-layer" data-layer="' + escapeHtml(layer || "") + '">' +
        escapeHtml(layerLabel(track, layer)) +
      '</span>' +
      '<span class="jukebox-log-detail">' + detailHTML + '</span>';
    logEl.insertBefore(row, logEl.firstChild);
    while (logEl.childElementCount > LOG_MAX) {
      logEl.removeChild(logEl.lastChild);
    }
  }

  // --- Motif (melody / ghost / whistle) ---
  ProsperoAudio.setMotifListener(function (ev) {
    if (!ev) return;
    if (ev.type === "clear") { clearLog(ev.track); return; }
    if (ev.type !== "fire") return;
    var detail;
    if (ev.motifId) {
      // Motif-style entry (harpsichord, ghost, waterphone, whistle):
      // action tag + motif id + cluster + optional transform.
      var transform = ev.transform
        ? ' <span class="meta">' + escapeHtml(ev.transform) + '</span>'
        : "";
      detail =
        '<span class="log-tag ' + escapeHtml(ev.action) + '">' +
          escapeHtml(ev.action) +
        '</span>' +
        '<span class="jukebox-log-id">#' + escapeHtml(ev.motifId) + '</span> ' +
        '<span class="jukebox-log-cluster">' + escapeHtml(ev.cluster || "") + '</span>' +
        transform;
    } else {
      // Note-style entry (music box, hum, chimes, flutter, bubbles, etc.):
      // a single detail string set by the engine emit site.
      detail =
        '<span class="log-tag note">note</span>' +
        '<span class="jukebox-log-cluster">' +
          escapeHtml(ev.detail || "") +
        '</span>';
    }
    appendRow(ev.time, ev.track, ev.layer, detail);
  });

  // --- Drone cycles ---
  // setDroneListener is now multi-cast (the spiral viz already subscribes
  // upstream). Drone events are intentionally not logged here per user
  // request; uncomment the block below to surface them.
  // ProsperoAudio.setDroneListener(function (ev) {
  //   appendRow(ev.startTime, ev.track, "drone", "cycle · " + ev.duration.toFixed(0) + "s");
  // });

  // --- Ambient events (page_turn, cricket, owl_hoot, ...) ---
  if (ProsperoAudio.setAmbientListener) {
    ProsperoAudio.setAmbientListener(function (ev) {
      if (!ev || ev.type !== "fire") return;
      var detail =
        '<span class="jukebox-log-cluster">' +
          escapeHtml((ev.event || "").replace(/_/g, " ")) +
        '</span>';
      appendRow(ev.time, ev.track, ev.layer, detail);
    });
  }

  // Initialize the empty state.
  var initialTrack = (ProsperoAudio.getState && ProsperoAudio.getState().currentTrack) || "library";
  clearLog(initialTrack);
})();

// ============================================================================
// Harmonic / spell-pose indicator — track-aware
//
// Library: shows the chord currently implied by the drone (e.g. "C minor").
// Sycorax: shows the current "spell pose" name (e.g. "Hex"). The header
// label adapts to whichever framing applies. Briefly flashes on change.
// ============================================================================
(function () {
  "use strict";
  if (!window.ProsperoAudio || !ProsperoAudio.setHarmonicListener) return;

  var chordEl = document.getElementById("jukebox-harmonic-chord");
  var droneEl = document.getElementById("jukebox-harmonic-drone");
  var labelEl = document.getElementById("jukebox-harmonic-label");
  if (!chordEl || !droneEl) return;

  var HEADER_COPY = {
    library: "HARMONIC · current center",
    sycorax: "SPELL · current pose",
    ariel:   "BREEZE · current center",
  };

  var flashTimer = null;
  function flash() {
    chordEl.classList.add("flash");
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { chordEl.classList.remove("flash"); }, 600);
  }

  function setHeader(track) {
    if (!labelEl) return;
    labelEl.textContent = HEADER_COPY[track] || HEADER_COPY.library;
  }

  ProsperoAudio.setHarmonicListener(function (ev) {
    if (!ev || ev.type !== "change") return;
    var prevChord = chordEl.textContent;
    chordEl.textContent = ev.chord || "--";
    droneEl.textContent = "drone " + (ev.drone || "--");
    setHeader(ev.track);
    if (prevChord !== chordEl.textContent) flash();
  });

  // Initialize header for whatever track is active when the page loads.
  var initialTrack = (ProsperoAudio.getState && ProsperoAudio.getState().currentTrack) || "library";
  setHeader(initialTrack);
})();

// ============================================================================
// Density envelope curve
//
// Scrolling line graph of the density multiplier. Right edge = now,
// ~240s of history scrolling left (long enough to see a full LFO_A cycle).
// Y axis spans the audio engine's DENSITY_RANGE. Reference lines at min,
// 1.0 baseline, and max so you can read the value at a glance.
// ============================================================================
(function () {
  "use strict";
  if (!window.ProsperoAudio) return;

  var canvas = document.getElementById("jukebox-viz-density");
  if (!canvas) return;
  var ctx2d = canvas.getContext("2d");
  var readoutEl = document.getElementById("jukebox-viz-density-readout");

  var TIME_WINDOW_SEC = 240;   // past window (left edge to "now")
  var TIME_PREVIEW_SEC = 30;   // future preview ("now" to right edge)
  var TOTAL_WINDOW_SEC = TIME_WINDOW_SEC + TIME_PREVIEW_SEC;

  // Read the currently-selected track from the shared module-level helper.
  var currentTrack = vizCurrentTrack;

  var range = (ProsperoAudio.getDensityRange && ProsperoAudio.getDensityRange()) || [0.4, 1.4];
  var MIN_D = range[0];
  var MAX_D = range[1];

  // Curve is computed on demand from ProsperoAudio.getDensityAt(t) — no
  // sample buffer. The audio engine exposes density as a pure function of
  // time, so any pixel column can be evaluated directly. SAMPLE_STEP_PX
  // controls smoothness vs. work per frame.
  var SAMPLE_STEP_PX = 2;

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function densityToY(d, h) {
    var norm = (d - MIN_D) / (MAX_D - MIN_D);
    if (norm < 0) norm = 0;
    else if (norm > 1) norm = 1;
    // 8% top/bottom padding so curve doesn't kiss edges
    return h * (0.92 - 0.84 * norm);
  }

  // X coordinate corresponding to "now" — the past/future split.
  function nowX(w) {
    return w * TIME_WINDOW_SEC / TOTAL_WINDOW_SEC;
  }

  function drawGrid(w, h) {
    var pal = vizColors();
    ctx2d.save();
    ctx2d.lineWidth = 1;
    var nX = nowX(w);

    // Subtle tint behind the future zone so the eye reads it as forecast.
    ctx2d.fillStyle = pal.futureTint;
    ctx2d.fillRect(nX, 0, w - nX, h);

    // Reference lines: min (dim), baseline 1.0 (a bit brighter), max (dim)
    var refs = [
      { d: MIN_D, color: pal.gridLineMid,   label: MIN_D.toFixed(2) + "×" },
      { d: 1.0,   color: pal.gridStrong,    label: "1.00×" },
      { d: MAX_D, color: pal.gridLineMid,   label: MAX_D.toFixed(2) + "×" },
    ];
    refs.forEach(function (r) {
      if (r.d < MIN_D || r.d > MAX_D) return;
      var y = densityToY(r.d, h);
      ctx2d.strokeStyle = r.color;
      ctx2d.beginPath();
      ctx2d.moveTo(0, y);
      ctx2d.lineTo(w, y);
      ctx2d.stroke();
      ctx2d.fillStyle = pal.gridLabelDense;
      ctx2d.font = '11px "VT323", monospace';
      ctx2d.textBaseline = "bottom";
      ctx2d.fillText(r.label, 4, y - 2);
    });

    // "Now" line at the past/future split
    ctx2d.strokeStyle = pal.nowLine;
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(nX, 0);
    ctx2d.lineTo(nX, h);
    ctx2d.stroke();

    // "NOW" label just above the bottom, to the right of the line
    ctx2d.fillStyle = pal.nowLabel;
    ctx2d.font = '11px "VT323", monospace';
    ctx2d.textBaseline = "bottom";
    ctx2d.fillText("NOW", nX + 4, h - 4);

    ctx2d.restore();
  }

  // Map a canvas X (0..w) to the absolute time it represents.
  // Left edge = now - TIME_WINDOW_SEC, "now" at x = nowX(w), right edge =
  // now + TIME_PREVIEW_SEC.
  function xToTime(x, now, w) {
    return now - TIME_WINDOW_SEC + (x / w) * TOTAL_WINDOW_SEC;
  }

  // Fill the area under the density curve across [xStart, xEnd].
  function fillUnderCurve(xStart, xEnd, now, w, h, fillStyle) {
    ctx2d.beginPath();
    ctx2d.moveTo(xStart, h);
    var first = true;
    for (var x = xStart; x <= xEnd; x += SAMPLE_STEP_PX) {
      var d = ProsperoAudio.getDensityAt(xToTime(x, now, w), currentTrack());
      var y = densityToY(d, h);
      if (first) { ctx2d.lineTo(xStart, y); first = false; }
      ctx2d.lineTo(x, y);
    }
    // Make sure the path reaches xEnd exactly (loop may stop short)
    var dEnd = ProsperoAudio.getDensityAt(xToTime(xEnd, now, w), currentTrack());
    ctx2d.lineTo(xEnd, densityToY(dEnd, h));
    ctx2d.lineTo(xEnd, h);
    ctx2d.closePath();
    ctx2d.fillStyle = fillStyle;
    ctx2d.fill();
  }

  // Stroke the density curve across [xStart, xEnd].
  function strokeCurve(xStart, xEnd, now, w, h, strokeStyle, lineWidth, dash) {
    ctx2d.save();
    if (dash) ctx2d.setLineDash(dash);
    ctx2d.beginPath();
    var first = true;
    for (var x = xStart; x <= xEnd; x += SAMPLE_STEP_PX) {
      var d = ProsperoAudio.getDensityAt(xToTime(x, now, w), currentTrack());
      var y = densityToY(d, h);
      if (first) { ctx2d.moveTo(x, y); first = false; }
      else ctx2d.lineTo(x, y);
    }
    var dEnd = ProsperoAudio.getDensityAt(xToTime(xEnd, now, w), currentTrack());
    ctx2d.lineTo(xEnd, densityToY(dEnd, h));
    ctx2d.strokeStyle = strokeStyle;
    ctx2d.lineWidth = lineWidth;
    ctx2d.stroke();
    ctx2d.restore();
  }

  function tick() {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;

    var now = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
    var nX = nowX(w);

    // Clear with the panel background
    ctx2d.fillStyle = "#0a0a0a";
    ctx2d.fillRect(0, 0, w, h);
    drawGrid(w, h);

    var pal = vizColors();
    if (ProsperoAudio.getDensityAt) {
      // Past: 0 .. nowX — solid fill + solid line
      fillUnderCurve(0, nX, now, w, h, pal.fill);
      // Future: nowX .. w — fainter fill + dashed line
      fillUnderCurve(nX, w, now, w, h, pal.fillFuture);
      strokeCurve(0, nX, now, w, h, pal.curve, 2, null);
      strokeCurve(nX, w, now, w, h, pal.curveFuture, 1.5, [4, 4]);
    }

    // Current-value readout (header) and the dot, both anchored to "now"
    var dNow = ProsperoAudio.getDensity ? ProsperoAudio.getDensity(currentTrack()) : 1;
    if (readoutEl) readoutEl.textContent = dNow.toFixed(2) + "×";
    var curY = densityToY(dNow, h);
    ctx2d.fillStyle = pal.dot;
    ctx2d.beginPath();
    ctx2d.arc(nX, curY, 3.5, 0, Math.PI * 2);
    ctx2d.fill();

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();


// ============================================================================
// 3D Pitch Spiral — single integrated visualization that replaces the flat
// pitch-class ridgeline AND the pulse constellation. The ridgeline is now a
// continuous coil wrapping a vertical cylinder (one turn per octave, 96
// spectral samples per turn). The pulse constellation sits on a horizontal
// floor plane below the spiral; looking down through the spiral shows the
// constellation laid out like a clock face beneath it. Camera is
// drag-rotatable (mouse / touch). Per-track tonic anchor (C / Eb / F),
// per-track scale highlighting, and Ariel's whistle-tracking lollipop are
// all preserved.
//
// Honest preset: dB → linear height in [-75, -10], no perceptual tilt,
// no spectral blur, no gamma lift, straight-line interpolation between
// FFT bins.
// ============================================================================
(function () {
  "use strict";
  if (!window.ProsperoAudio) { console.error("Spiral: engine not loaded"); return; }
  var canvas = document.getElementById("jukebox-viz-spiral");
  if (!canvas) return;
  var ctx2d = canvas.getContext("2d");

  // ---------- Constants (honest preset) ----------
  var OCTAVES = 7;
  var BASE_OCTAVE = 1;
  var SAMPLES_PER_TURN = 96;
  var TOTAL_SAMPLES = OCTAVES * SAMPLES_PER_TURN;
  var FFT_SIZE = 8192;
  var DB_FLOOR = -75;
  var DB_CEIL  = -10;
  var DB_PER_OCTAVE_TILT = 0;
  var BLUR_SIGMA = 0;
  var PEAK_KNEE  = 1.0;
  var PEAK_GAMMA = 1.0;

  // ---------- Per-track config ----------
  var PITCH_CLASSES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  var CONST_PITCH_LABELS = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  var ANCHORS = {
    library: { pcIndex: 0, name: "C"  },
    sycorax: { pcIndex: 3, name: "Eb" },
    ariel:   { pcIndex: 5, name: "F"  },
  };
  var KEY_PITCHES = {
    library: { name: "C Dorian",             classes: ["C","D","D#","F","G","A","A#"] },
    sycorax: { name: "Eb Chromatic-Locrian", classes: ["D#","E","F#","G","G#","A#","B"] },
    ariel:   { name: "F Lydian",             classes: ["C","D","E","F","G","A","B"] },
  };
  // Canvas palette comes from the shared theme registry — see
  // prosperos-jukebox-themes.js → JUKEBOX_THEMES[track].canvas. Single
  // source of truth for both CSS vars and canvas drawing.
  function paletteFor(track) {
    var t = (window.JUKEBOX_THEMES && window.JUKEBOX_THEMES[track])
      || (window.JUKEBOX_THEMES && window.JUKEBOX_THEMES.library);
    return (t && t.canvas) || {
      // Defensive fallback if the themes file failed to load.
      bg: "#0a0805",
      ribbonStroke: [255, 220, 130], ribbonFill: [255, 170, 0],
      baseStroke:   [180, 130, 60],
      inKeyLabel:   [255, 220, 140], outKeyLabel: [120, 95, 50],
      octaveLabel:  [255, 200, 120],
      constFg: "255, 170, 0",        constSub: "255, 130, 40",
      lollipopHead: "rgba(255, 220, 130, 1)",
    };
  }
  function anchorFreq(pc, octave) { return 16.35 * Math.pow(2, octave + pc / 12); }

  // ---------- Camera ----------
  var DEFAULT_YAW = 0.6;
  var DEFAULT_PITCH = 0.3;   // look slightly DOWN on the spiral (negative looked up at its underside)
  var camYaw = DEFAULT_YAW, camPitch = DEFAULT_PITCH;
  var autoRotate = true;
  var dragging = false, lastMx = 0, lastMy = 0;

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function startDrag(x, y) {
    dragging = true; lastMx = x; lastMy = y;
    canvas.classList.add("is-dragging");
  }
  function moveDrag(x, y) {
    if (!dragging) return;
    var dx = x - lastMx, dy = y - lastMy;
    lastMx = x; lastMy = y;
    camYaw += dx * 0.01;
    camPitch += dy * 0.01;
    var lim = Math.PI / 2 - 0.05;
    if (camPitch > lim) camPitch = lim;
    if (camPitch < -lim) camPitch = -lim;
  }
  function endDrag() {
    dragging = false;
    canvas.classList.remove("is-dragging");
  }
  canvas.addEventListener("mousedown", function (e) { startDrag(e.clientX, e.clientY); });
  window.addEventListener("mousemove", function (e) { moveDrag(e.clientX, e.clientY); });
  window.addEventListener("mouseup", endDrag);
  canvas.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchmove", function (e) {
    if (!dragging || e.touches.length !== 1) return;
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", endDrag);

  var autoBtn  = document.getElementById("jukebox-viz-spiral-auto");
  var resetBtn = document.getElementById("jukebox-viz-spiral-view");
  if (autoBtn) {
    // Reflect the default-on state in the button's visual class.
    autoBtn.classList.toggle("active", autoRotate);
    autoBtn.addEventListener("click", function () {
      autoRotate = !autoRotate;
      autoBtn.classList.toggle("active", autoRotate);
    });
  }
  if (resetBtn) resetBtn.addEventListener("click", function () {
    camYaw = DEFAULT_YAW;
    camPitch = DEFAULT_PITCH;
  });

  // ---------- Audio ----------
  ProsperoAudio.init();
  var actx = ProsperoAudio.getAudioContext();
  var sampleRate = actx.sampleRate;
  var analyser = actx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.05;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  ProsperoAudio.attachAnalyser(analyser);
  var fftBins = analyser.frequencyBinCount;
  var fftData = new Float32Array(fftBins);

  // Isolated whistle tap for Ariel's lollipop overlay
  var whistleAnalyser = actx.createAnalyser();
  whistleAnalyser.fftSize = FFT_SIZE;
  whistleAnalyser.smoothingTimeConstant = 0.08;
  whistleAnalyser.minDecibels = -100;
  whistleAnalyser.maxDecibels = 0;
  var whistleTapOk = ProsperoAudio.attachLayerAnalyser
    ? ProsperoAudio.attachLayerAnalyser("ariel", "whistle", whistleAnalyser)
    : false;
  var whistleFft = new Float32Array(fftBins);

  // Isolated Library melody (harpsichord) tap — waveform drives a vibrating
  // ripple on the baseline spiral wherever a note fires.
  var melodyAnalyser = actx.createAnalyser();
  melodyAnalyser.fftSize = FFT_SIZE;
  melodyAnalyser.smoothingTimeConstant = 0;
  var melodyTapOk = ProsperoAudio.attachLayerAnalyser
    ? ProsperoAudio.attachLayerAnalyser("library", "melody", melodyAnalyser)
    : false;
  var melodyTime = new Float32Array(FFT_SIZE);

  // Per-note events from the engine → active baseline plucks.
  // Defaults ported from the harpsichord-strings prototype.
  var HARP_TAU = 2, HARP_SIGMA_OCT = 0.05, HARP_WSAMP = 200;
  var HARP_AUDIO_GAIN = 20, HARP_AMP = 80, HARP_LIFETIME = 7;
  var harpQueue = [], harpPlucks = [];
  var harpActive = false, harpNow = 0, harpRadial = 0;
  if (ProsperoAudio.setNoteListener) {
    ProsperoAudio.setNoteListener(function (ev) {
      if (ev.track === "library" && ev.layer === "melody") harpQueue.push(ev);  // harpsichord baseline
      else if (ev.track === "library" && ev.layer === "hum") humQueue.push(ev);  // hum lollipop
      else if (ev.track === "library" && ev.layer === "musicBox") boxQueue.push(ev);  // music-box glints
      else if (ev.track === "ariel" && ev.layer === "bass") bassQueue.push(ev);  // Ariel bass baseline
      else if (ev.track === "ariel" && ev.layer === "bubbles") bubbleQueue.push(ev);  // rising bubbles
    });
  }
  // Radial baseline displacement at sample (o,b) from all active plucks.
  function harpDr(o, b) {
    if (!harpActive) return 0;
    var ofSample = o + b / SAMPLES_PER_TURN, dr = 0;
    for (var i = 0; i < harpPlucks.length; i++) {
      var pk = harpPlucks[i];
      var dOct = ofSample - pk.octaveFloat;
      if (dOct < -HARP_SIGMA_OCT * 3 || dOct > HARP_SIGMA_OCT * 3) continue;
      var env = Math.exp(-(dOct * dOct) / (2 * HARP_SIGMA_OCT * HARP_SIGMA_OCT));
      var decay = Math.exp(-(harpNow - pk.startTime) / HARP_TAU);
      var frac = dOct / (2.5 * HARP_SIGMA_OCT) + 0.5;
      if (frac < 0) frac = 0; else if (frac > 1) frac = 1;
      var wv = melodyTime[(frac * (HARP_WSAMP - 1)) | 0] * HARP_AUDIO_GAIN;
      if (wv > 2.6) wv = 2.6; else if (wv < -2.6) wv = -2.6;
      dr += harpRadial * decay * env * wv;
    }
    return dr;
  }

  // Ariel bass — same baseline-ripple mechanic, tuned to read SMOOTH (the bass
  // is a low, mellow tone, and a wider window shows a single gentle wave).
  var bassAnalyser = actx.createAnalyser();
  bassAnalyser.fftSize = FFT_SIZE;
  bassAnalyser.smoothingTimeConstant = 0;
  var bassTapOk = ProsperoAudio.attachLayerAnalyser
    ? ProsperoAudio.attachLayerAnalyser("ariel", "bass", bassAnalyser)
    : false;
  var bassTime = new Float32Array(FFT_SIZE);
  var BASS_TAU = 2.5, BASS_SIGMA_OCT = 0.06, BASS_WSAMP = 300;
  var BASS_AUDIO_GAIN = 20, BASS_AMP = 80, BASS_LIFETIME = 8;
  var bassQueue = [], bassPlucks = [];
  var bassActive = false, bassNow = 0, bassRadial = 0;
  function bassDr(o, b) {
    if (!bassActive) return 0;
    var ofSample = o + b / SAMPLES_PER_TURN, dr = 0;
    for (var i = 0; i < bassPlucks.length; i++) {
      var pk = bassPlucks[i];
      var dOct = ofSample - pk.octaveFloat;
      if (dOct < -BASS_SIGMA_OCT * 3 || dOct > BASS_SIGMA_OCT * 3) continue;
      var env = Math.exp(-(dOct * dOct) / (2 * BASS_SIGMA_OCT * BASS_SIGMA_OCT));
      var decay = Math.exp(-(bassNow - pk.startTime) / BASS_TAU);
      var frac = dOct / (2.5 * BASS_SIGMA_OCT) + 0.5;
      if (frac < 0) frac = 0; else if (frac > 1) frac = 1;
      var wv = bassTime[(frac * (BASS_WSAMP - 1)) | 0] * BASS_AUDIO_GAIN;
      if (wv > 2.6) wv = 2.6; else if (wv < -2.6) wv = -2.6;
      dr += bassRadial * decay * env * wv;
    }
    return dr;
  }

  // Hum lollipop (Library hum layer) — a tracked marker on the spiral at the
  // hum's pitch, like the Ariel whistle. Pitch comes from note events; the head
  // height follows the hum layer's live level.
  var humAnalyser = actx.createAnalyser();
  humAnalyser.fftSize = FFT_SIZE;
  humAnalyser.smoothingTimeConstant = 0.1;
  var humTapOk = ProsperoAudio.attachLayerAnalyser
    ? ProsperoAudio.attachLayerAnalyser("library", "hum", humAnalyser)
    : false;
  var humTime = new Float32Array(FFT_SIZE);
  var humQueue = [], humLollipop = null, humLevel = 0, humWidth = 0;
  var HUM_GAIN = 16, LOLLI_HEIGHT = 2;   // head/bar max-height multiplier (whistle + hum)
  var BRIGHT_GAIN = 30;                  // maps hum high-frequency content -> bar width

  // Per-vowel hum-bar shapes (from the vowel-bars prototype). Roundness applies
  // to "oo" only; every other bar has square corners. peak +pointed = pointed
  // top, −peak = concave, both edge to edge.
  var HUM_VOWEL_SHAPES = {
    ng: { width: 1.0, height: 0.95, peak:  0.08, pointed: 0, round: 0.10 },
    oo: { width: 1.0, height: 1.00, peak:  0.00, pointed: 0, round: 0.60 },
    uh: { width: 1.0, height: 1.00, peak:  0.00, pointed: 0, round: 0.08 },
    oh: { width: 1.0, height: 1.00, peak: -0.02, pointed: 0, round: 0.00 },
    ah: { width: 1.0, height: 1.00, peak:  0.04, pointed: 1, round: 0.00 },
  };
  var HUM_BAR_HALF = 1;          // base half-width in samples (× vowel width)
  var HUM_WSAMP = 520;           // waveform samples spanned along the bar's height
  var HUM_RIPPLE_GAIN = 16;      // waveform → baseline-offset (samples) for the side ripple
  var HUM_RIPPLE_SMOOTH = 30;    // moving-average radius — rounds the ripple's waves
  var humSmooth = new Float32Array(FFT_SIZE);   // smoothed hum waveform (ripple source)
  function smoothHumWave(src, dst, r, count) {
    if (r < 1) { for (var q = 0; q < count; q++) dst[q] = src[q]; return; }
    var n = src.length, inv = 1 / (2 * r + 1);
    for (var i = 0; i < count; i++) {
      var sum = 0;
      for (var k = -r; k <= r; k++) { var j = i + k; if (j < 0) j = 0; else if (j >= n) j = n - 1; sum += src[j]; }
      dst[i] = sum * inv;
    }
  }

  // (Hum bar is drawn in the tick as an explicit vertical-edged bar at the hum's
  // pitch, with the baseline beneath it skipped so there's no flat bottom.)

  // Music-box glints (Library musicBox layer) — a lo-fi "soft glow star" at each
  // ping's pitch on the spiral that drifts UP from the baseline over its life.
  // Driven by note events: pitch sets where it sits, the note's VELOCITY
  // (loudness) sets how high it rises (the spiral already encodes pitch as
  // position, so height carries loudness instead). Tuned in the
  // music-box-glint-prototype.html sandbox (style A). No analyser tap needed.
  var BOX_GLINT_LIFE  = 1.5;     // seconds on screen
  var BOX_GLINT_BLOOM = 0.08;    // seconds to reach full brightness
  var BOX_GLINT_R     = 6.5;     // sparkle base radius (px)
  var BOX_RISE_MIN    = 0.175;   // drift above baseline for the softest note (× peakUp)
  var BOX_RISE_VAR    = 0.475;   // loudness adds up to this much more (× peakUp)
  var BOX_SPIN        = 12 * Math.PI / 180;   // slow spin (rad/s)
  var BOX_SHIM        = 0.4;     // shimmer / twinkle amount
  var boxQueue = [], boxGlints = [];

  // Lo-fi soft-glow-star sparkle in screen space at (sx0, sy0): posterized
  // stepped-ring glow, 4 spinning tapered rays, flickering square specks, a
  // bright core — all snapped to a 2px grid. `env` sizes it, `depth` fades the
  // far side of the cylinder, `col` is the [r,g,b] glint color.
  function drawGlintStar(sx0, sy0, age, env, depth, R, rot, seed, col) {
    var shim = 1 + BOX_SHIM * 0.3 * Math.sin(age * 10 + seed * 4);   // subtle twinkle
    var e = env * depth * (shim < 0 ? 0 : shim);
    if (e <= 0.003) return;
    var cr = col[0], cg = col[1], cb = col[2];
    function ca(a) { a = a < 0 ? 0 : (a > 1 ? 1 : a); return "rgba(" + cr + "," + cg + "," + cb + "," + a.toFixed(3) + ")"; }
    var GS = 2, sx = Math.round(sx0 / GS) * GS, sy = Math.round(sy0 / GS) * GS;
    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";
    var rings = 5, maxR = R * (0.9 + 0.7 * env);                     // posterized glow
    for (var k = rings; k >= 1; k--) {
      ctx2d.fillStyle = ca(0.15 * e * (1 - (k - 1) / rings));
      ctx2d.beginPath(); ctx2d.arc(sx, sy, maxR * (k / rings), 0, Math.PI * 2); ctx2d.fill();
    }
    var len = R * 1.8 * (0.5 + 0.5 * env), wid = R * 0.22;           // 4 spinning rays
    ctx2d.fillStyle = ca(0.85 * e);
    for (var i = 0; i < 4; i++) {
      ctx2d.save(); ctx2d.translate(sx, sy); ctx2d.rotate(rot + i * Math.PI / 2);
      ctx2d.beginPath(); ctx2d.moveTo(0, -wid); ctx2d.lineTo(len, 0); ctx2d.lineTo(0, wid); ctx2d.closePath();
      ctx2d.fill(); ctx2d.restore();
    }
    for (var s2 = 0; s2 < 4; s2++) {                                 // flickering square specks
      var fl = Math.sin(age * (8 + s2 * 3) + seed * 5 + s2);
      if (fl <= 0.55) continue;
      var ang = seed * 2 + s2 * 1.9, dist = R * (1.1 + 0.5 * ((s2 * 7 + seed) % 1));
      var px = Math.round((sx + Math.cos(ang) * dist) / GS) * GS;
      var py = Math.round((sy + Math.sin(ang) * dist) / GS) * GS;
      var fa = 0.7 * e * (fl - 0.55) / 0.45; fa = fa < 0 ? 0 : (fa > 1 ? 1 : fa);
      ctx2d.fillStyle = "rgba(255,255,255," + fa.toFixed(3) + ")";
      ctx2d.fillRect(px - 1, py - 1, GS, GS);
    }
    var coreA = 0.9 * e; if (coreA > 1) coreA = 1;                   // bright core
    ctx2d.fillStyle = "rgba(255,255,255," + coreA.toFixed(3) + ")";
    ctx2d.beginPath(); ctx2d.arc(sx, sy, R * 0.2 * (0.6 + env), 0, Math.PI * 2); ctx2d.fill();
    ctx2d.restore();
  }

  // Rising bubbles (Ariel bubbles layer) — each gliss note spawns a bubble that
  // floats up the cylinder (tracking its pitch glide), wobbles, then pops. Also
  // note-event driven; no analyser tap.
  var BUBBLE_RISE_EXTRA = 0.45;  // extra octaves of buoyant drift past the gliss end
  var BUBBLE_AFTER      = 1.1;   // seconds of drift after the note ends, then pop
  var BUBBLE_R          = 7;     // base bubble pixel radius
  var BUBBLE_WOBBLE     = 0.06;  // theta wobble amplitude (radians)
  var bubbleQueue = [], bubbles = [];

  // Drone cycles for the constellation floor
  var droneCycles = [];
  if (ProsperoAudio.setDroneListener) {
    ProsperoAudio.setDroneListener(function (cycle) { droneCycles.push(cycle); });
  }

  // ---------- Per-track anchor / FFT mapping ----------
  var trackedLollipop = null;
  var ANCHOR_PC = ANCHORS.library.pcIndex;
  var ANCHOR_NAME = ANCHORS.library.name;
  var ROW_F_MIN = anchorFreq(ANCHOR_PC, BASE_OCTAVE);
  var sampleFftIdx = new Float32Array(TOTAL_SAMPLES);
  function rebuildSampleFftIdx() {
    for (var o = 0; o < OCTAVES; o++) {
      var rowF = ROW_F_MIN * Math.pow(2, o);
      for (var b = 0; b < SAMPLES_PER_TURN; b++) {
        var f = rowF * Math.pow(2, b / SAMPLES_PER_TURN);
        sampleFftIdx[o * SAMPLES_PER_TURN + b] = f * FFT_SIZE / sampleRate;
      }
    }
  }
  function applyAnchor(track) {
    var a = ANCHORS[track] || ANCHORS.library;
    ANCHOR_PC = a.pcIndex; ANCHOR_NAME = a.name;
    ROW_F_MIN = anchorFreq(a.pcIndex, BASE_OCTAVE);
    rebuildSampleFftIdx();
    trackedLollipop = null;
    // Old baseline tracks a different bin layout — zero it so we don't
    // subtract phantom levels from the new track's spectrum.
    for (var bz = 0; bz < baselineLin.length; bz++) baselineLin[bz] = 0;
  }
  rebuildSampleFftIdx();

  // ---------- Magnitudes + optional whistle subtraction (Ariel) ----------
  var magnitudes = new Float32Array(TOTAL_SAMPLES);
  var WHISTLE_SUBTRACT_SCALE = 0.18;

  // ---------- Adaptive baseline (delta spiral) ----------
  // To stop sustained content (drone partials) from drowning out transient
  // events on the spiral, we maintain a slow per-bin EMA of the current
  // linear amplitude. The display value is then `(current - baseline) +
  // baseline * BASELINE_RETAIN`. A sustained tone melts into the baseline
  // (so it's drawn at ~30% of its raw height), while a transient pops
  // because it's freshly above baseline (drawn at ~full height minus the
  // small baseline component). Reset on track switch.
  //
  // BASELINE_ALPHA controls how fast the baseline tracks. At 60 fps,
  // 0.005 ≈ 3.3 s time constant — fast enough to follow a drone cycle,
  // slow enough to ignore transient hits.
  // BASELINE_RETAIN controls how much of the sustained drone stays
  // visible. 0 = transients only; 1 = original honest spiral.
  var BASELINE_ALPHA  = 0.005;
  var BASELINE_RETAIN = 0.30;
  var baselineLin = new Float32Array(TOTAL_SAMPLES);
  function computeMagnitudes(subtractWhistle) {
    analyser.getFloatFrequencyData(fftData);
    for (var o = 0; o < OCTAVES; o++) {
      var tilt = (o - (OCTAVES - 1) / 2) * DB_PER_OCTAVE_TILT;
      for (var b = 0; b < SAMPLES_PER_TURN; b++) {
        var idx = o * SAMPLES_PER_TURN + b;
        var fi = sampleFftIdx[idx];
        var lo = Math.floor(fi), t = fi - lo, hi = lo + 1;
        if (lo < 0) lo = 0;
        if (hi >= fftBins) hi = fftBins - 1;
        var db = fftData[lo] * (1 - t) + fftData[hi] * t;
        if (subtractWhistle) {
          var wdb = whistleFft[lo] * (1 - t) + whistleFft[hi] * t;
          var ma = Math.pow(10, db / 20);
          var wa = Math.pow(10, wdb / 20) * WHISTLE_SUBTRACT_SCALE;
          var residual = Math.max(1e-10, ma - wa);
          db = 20 * Math.log10(residual);
        }
        magnitudes[idx] = db + tilt;
      }
    }
  }

  var blurTempBuf = new Float32Array(SAMPLES_PER_TURN);
  function applySpectralBlur(sigma) {
    if (sigma <= 0) return;
    var halfWidth = Math.max(1, Math.ceil(sigma * 3));
    var kernelLen = halfWidth * 2 + 1;
    var kernel = new Float32Array(kernelLen);
    var twoSigmaSq = 2 * sigma * sigma;
    var ksum = 0;
    for (var k = 0; k < kernelLen; k++) {
      var dx = k - halfWidth;
      kernel[k] = Math.exp(-dx * dx / twoSigmaSq);
      ksum += kernel[k];
    }
    for (var k2 = 0; k2 < kernelLen; k2++) kernel[k2] /= ksum;
    for (var o = 0; o < OCTAVES; o++) {
      var rowOffset = o * SAMPLES_PER_TURN;
      for (var b = 0; b < SAMPLES_PER_TURN; b++) {
        var acc = 0, wAcc = 0;
        for (var k3 = 0; k3 < kernelLen; k3++) {
          var src = b + (k3 - halfWidth);
          if (src >= 0 && src < SAMPLES_PER_TURN) {
            acc += magnitudes[rowOffset + src] * kernel[k3];
            wAcc += kernel[k3];
          }
        }
        blurTempBuf[b] = wAcc > 0 ? acc / wAcc : magnitudes[rowOffset + b];
      }
      for (var b2 = 0; b2 < SAMPLES_PER_TURN; b2++) {
        magnitudes[rowOffset + b2] = blurTempBuf[b2];
      }
    }
  }

  function normDb(db) {
    if (db < DB_FLOOR) return 0;
    if (db > DB_CEIL) return 1;
    return (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
  }

  // Update the per-bin baseline EMA and rewrite `magnitudes` in-place to
  // the "delta + retained baseline" view described above. Operates in
  // linear amplitude space (subtraction in dB doesn't subtract energy).
  function applyAdaptiveBaseline() {
    for (var bi = 0; bi < TOTAL_SAMPLES; bi++) {
      var dB = magnitudes[bi];
      // Clamp before pow to avoid denormals and pow(10, -Inf) edge cases.
      var lin = dB > -120 ? Math.pow(10, dB / 20) : 0;
      // EMA toward current magnitude
      baselineLin[bi] += (lin - baselineLin[bi]) * BASELINE_ALPHA;
      var bsl = baselineLin[bi];
      var transient = lin - bsl;
      if (transient < 0) transient = 0;
      var disp = transient + bsl * BASELINE_RETAIN;
      magnitudes[bi] = disp > 1e-10 ? 20 * Math.log10(disp) : -120;
    }
  }

  // ---------- Constellation helpers ----------
  var HALO_WAVE_POINTS = 96;
  var HALO_WAVE_AMP_FRAC = 0.2;
  var LIBRARY_LOWPASS = 240;
  var HARMONIC_FREQ_CEILING = 800;
  var SLOWDOWN = 60;
  var HALO_LIB_WAVELENGTHS = 6;
  function lowpassResponse(f) {
    var r = f / LIBRARY_LOWPASS;
    return 1 / Math.sqrt(1 + r * r);
  }
  function libraryTriangleHarmonics(fundamental, maxFreq) {
    var result = [];
    for (var n = 1; n <= 9; n += 2) {
      var f = fundamental * n;
      if (f > maxFreq) break;
      var triAmp = 1 / (n * n);
      result.push({ freq: f, relAmp: triAmp * lowpassResponse(f) });
    }
    return result;
  }
  function freqToMidi(f) { return 12 * Math.log2(f / 440) + 69; }
  function pitchClassOf(f) { return ((freqToMidi(f) % 12) + 12) % 12; }
  function intervalSemitones(f1, f2) {
    var m = Math.abs(freqToMidi(f1) - freqToMidi(f2));
    return Math.round(m) % 12;
  }
  var INTERVAL_NAMES = {
    0: "unison", 1: "m2", 2: "M2", 3: "m3", 4: "M3",
    5: "P4", 6: "tritone", 7: "P5", 8: "m6", 9: "M6",
    10: "m7", 11: "M7",
  };
  function consonance(semitones) {
    var C = { 0: 1.0, 7: 0.95, 5: 0.85, 4: 0.75, 3: 0.7,
              8: 0.55, 9: 0.55, 2: 0.4, 10: 0.4,
              1: 0.25, 11: 0.25, 6: 0.3 };
    return C[semitones] != null ? C[semitones] : 0.5;
  }
  function envelopeAt(cycle, t) {
    var rel = t - cycle.startTime;
    if (rel < 0 || rel > cycle.duration) return 0;
    if (rel < cycle.fadeIn) return (rel / cycle.fadeIn) * cycle.peakGain;
    if (rel > cycle.duration - cycle.fadeOut) {
      return ((cycle.duration - rel) / cycle.fadeOut) * cycle.peakGain;
    }
    return cycle.peakGain;
  }
  function buildPartialsForCycleTone(cycle, toneIdx, now) {
    var result = [];
    var fund = cycle.frequencies[toneIdx];
    if (fund == null) return result;
    var amp = envelopeAt(cycle, now);
    if (amp === 0) return result;
    var normAmp = amp / cycle.peakGain;
    var harmonics = libraryTriangleHarmonics(fund, HARMONIC_FREQ_CEILING);
    for (var i = 0; i < harmonics.length; i++) {
      var h = harmonics[i];
      result.push({ freq: h.freq, amp: normAmp * h.relAmp });
    }
    if (toneIdx === 0 && cycle.subFreq) {
      result.push({
        freq: cycle.subFreq,
        amp: normAmp * (cycle.subPeakGain / cycle.peakGain) * 0.85,
      });
    }
    return result;
  }
  function constNodeWorld(freq, constMaxR) {
    var theta = (pitchClassOf(freq) / 12) * 2 * Math.PI;
    var midi = freqToMidi(freq);
    var oct = Math.floor(midi / 12) - 1;
    var norm = Math.max(0, Math.min(1, (oct - 1) / 4));
    var r = 0.25 * constMaxR + norm * 0.75 * constMaxR;
    return { x: r * Math.cos(theta), z: r * Math.sin(theta), r: r, theta: theta };
  }
  function projWorld(x, y, z, cx, cy, cy1, sy1, cp1, sp1) {
    var x1 = x * cy1 - z * sy1;
    var z1 = x * sy1 + z * cy1;
    var y1 = y * cp1 - z1 * sp1;
    var z2 = y * sp1 + z1 * cp1;
    return { sx: cx + x1, sy: cy - y1, z: z2 };
  }

  // ---------- 3D scratch ----------
  var innerProj = new Float32Array(TOTAL_SAMPLES * 3);
  var outerProj = new Float32Array(TOTAL_SAMPLES * 3);
  var quadOrder = new Int32Array(TOTAL_SAMPLES - 1);
  var quadZ = new Float32Array(TOTAL_SAMPLES - 1);
  for (var qi = 0; qi < quadOrder.length; qi++) quadOrder[qi] = qi;

  function project(x, y, z, cy1, sy1, cp1, sp1, out, off) {
    var x1 = x * cy1 - z * sy1;
    var z1 = x * sy1 + z * cy1;
    var y1 = y * cp1 - z1 * sp1;
    var z2 = y * sp1 + z1 * cp1;
    out[off]     = x1;
    out[off + 1] = y1;
    out[off + 2] = z2;
  }

  // ---------- Whistle peak detection (Ariel) ----------
  var WHISTLE_PEAK_DB_THRESHOLD = -55;
  var WHISTLE_PEAK_DROP_DB = 8;
  var WHISTLE_FREQ_MIN_BIN = Math.floor(200 * FFT_SIZE / sampleRate);
  var WHISTLE_FREQ_MAX_BIN = Math.ceil(3500 * FFT_SIZE / sampleRate);
  function parabolicRefine(arr, bin) {
    if (bin <= 0 || bin >= arr.length - 1) return bin;
    var y0 = arr[bin - 1], y1 = arr[bin], y2 = arr[bin + 1];
    var denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) < 1e-6) return bin;
    var offset = 0.5 * (y0 - y2) / denom;
    if (offset < -0.5) offset = -0.5;
    if (offset > 0.5) offset = 0.5;
    return bin + offset;
  }
  function detectWhistlePeaks() {
    var raw = [];
    var maxBin = Math.min(whistleFft.length - 2, WHISTLE_FREQ_MAX_BIN);
    for (var i = Math.max(1, WHISTLE_FREQ_MIN_BIN); i <= maxBin; i++) {
      var db = whistleFft[i];
      if (db > WHISTLE_PEAK_DB_THRESHOLD &&
          db > whistleFft[i - 1] && db > whistleFft[i + 1]) {
        var refined = parabolicRefine(whistleFft, i);
        raw.push({ freq: refined * sampleRate / FFT_SIZE, db: db });
      }
    }
    if (raw.length === 0) return raw;
    raw.sort(function (a, b) { return b.db - a.db; });
    var ceiling = raw[0].db - WHISTLE_PEAK_DROP_DB;
    var bright = raw.filter(function (p) { return p.db >= ceiling; });
    var kept = [];
    for (var k = 0; k < bright.length; k++) {
      var p = bright[k], isHarmonic = false;
      for (var j = 0; j < bright.length; j++) {
        if (k === j || bright[j].db <= p.db) continue;
        var ratio = p.freq / bright[j].freq;
        for (var n2 = 2; n2 <= 5; n2++) {
          if (Math.abs(ratio - n2) < 0.04) { isHarmonic = true; break; }
        }
        if (isHarmonic) break;
      }
      if (!isHarmonic) kept.push(p);
    }
    return kept;
  }

  // ---------- 3D Lollipop state ----------
  var HEAD_SMOOTH = 0.30;
  var NOTE_START_GAP_FRAMES = 3;
  function updateLollipop3D(peaks, octaveStep, peakUp) {
    var p = null;
    if (peaks.length > 0) {
      var best = peaks[0];
      for (var i = 1; i < peaks.length; i++) if (peaks[i].db > best.db) best = peaks[i];
      p = best;
    }
    if (p) {
      var octaveFloat = Math.log2(p.freq / ROW_F_MIN);
      if (octaveFloat < 0 || octaveFloat >= OCTAVES) return;
      var rawOctIdx = Math.floor(octaveFloat);
      var isNoteStart =
        !trackedLollipop || trackedLollipop.framesQuiet > NOTE_START_GAP_FRAMES;
      var octIdx = isNoteStart ? rawOctIdx : trackedLollipop.octIdx;
      var fracInOctave = Math.max(0, Math.min(0.999, octaveFloat - octIdx));
      var theta = fracInOctave * 2 * Math.PI;
      var yBase = (octIdx + fracInOctave - (OCTAVES - 1) / 2) * octaveStep;
      var nv = normDb(p.db);
      var yHead = yBase + nv * peakUp;
      if (isNoteStart) {
        trackedLollipop = {
          theta: theta, yBase: yBase, yHead: yHead,
          octIdx: octIdx, freq: p.freq, framesQuiet: 0,
        };
      } else {
        var dT = theta - trackedLollipop.theta;
        while (dT >  Math.PI) dT -= 2 * Math.PI;
        while (dT < -Math.PI) dT += 2 * Math.PI;
        trackedLollipop.theta += dT * HEAD_SMOOTH;
        trackedLollipop.yHead += (yHead - trackedLollipop.yHead) * HEAD_SMOOTH;
        trackedLollipop.yBase = yBase;
        trackedLollipop.freq = p.freq;
        trackedLollipop.framesQuiet = 0;
      }
    } else if (trackedLollipop) {
      var fi = trackedLollipop.freq * FFT_SIZE / sampleRate;
      var bLo = Math.max(0, Math.floor(fi - 2));
      var bHi = Math.min(whistleFft.length - 1, Math.ceil(fi + 2));
      var sampledDb = -Infinity;
      for (var bb = bLo; bb <= bHi; bb++) {
        if (whistleFft[bb] > sampledDb) sampledDb = whistleFft[bb];
      }
      if (sampledDb > -80) {
        var n2 = normDb(sampledDb);
        var t2 = trackedLollipop.yBase + n2 * peakUp;
        trackedLollipop.yHead += (t2 - trackedLollipop.yHead) * HEAD_SMOOTH;
        trackedLollipop.framesQuiet = 0;
      } else {
        trackedLollipop.framesQuiet++;
        trackedLollipop.yHead +=
          (trackedLollipop.yBase - trackedLollipop.yHead) * 0.3;
        if ((trackedLollipop.yHead - trackedLollipop.yBase) < octaveStep * 0.03 ||
            trackedLollipop.framesQuiet > 12) {
          trackedLollipop = null;
        }
      }
    }
  }
  // Build an rgba string from a "rgba(r,g,b,a)" template by scaling its
  // alpha. Lets us reuse the palette's lollipop color with a depth fade.
  function fadeRgba(rgba, mult) {
    return rgba.replace(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/,
      function (_, r, g, b, a) {
        var newA = Math.max(0, Math.min(1, parseFloat(a) * mult));
        return "rgba(" + r + "," + g + "," + b + "," + newA.toFixed(3) + ")";
      });
  }
  function drawLollipop3D(pal, baseRadius, cx, cy, cy1, sy1, cp1, sp1, depthAlpha, lpOverride) {
    var lp = lpOverride || trackedLollipop;
    if (!lp) return;
    if (depthAlpha == null) depthAlpha = 1;
    var ct = Math.cos(lp.theta), st = Math.sin(lp.theta);
    var pb = projWorld(baseRadius * ct, lp.yBase, baseRadius * st, cx, cy, cy1, sy1, cp1, sp1);
    var ph = projWorld(baseRadius * ct, lp.yHead, baseRadius * st, cx, cy, cy1, sy1, cp1, sp1);
    var head = fadeRgba(pal.lollipopHead, depthAlpha);
    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";
    var grad = ctx2d.createRadialGradient(ph.sx, ph.sy, 1, ph.sx, ph.sy, 16);
    grad.addColorStop(0, head);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = grad;
    ctx2d.beginPath(); ctx2d.arc(ph.sx, ph.sy, 16, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.globalCompositeOperation = "source-over";
    ctx2d.strokeStyle = head; ctx2d.lineWidth = 2;
    ctx2d.beginPath(); ctx2d.moveTo(pb.sx, pb.sy); ctx2d.lineTo(ph.sx, ph.sy); ctx2d.stroke();
    ctx2d.fillStyle = head;
    ctx2d.beginPath(); ctx2d.arc(pb.sx, pb.sy, 2.2, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.beginPath(); ctx2d.arc(ph.sx, ph.sy, 5, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.fillStyle = "rgba(255,255,255," + (0.85 * depthAlpha).toFixed(3) + ")";
    ctx2d.beginPath(); ctx2d.arc(ph.sx, ph.sy, 1.6, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.restore();
  }

  // ---------- Track switch detection ----------
  function currentTrack() {
    return (ProsperoAudio.getState && ProsperoAudio.getState().currentTrack) || "library";
  }
  var lastTrack = currentTrack();
  applyAnchor(lastTrack);

  // ---------- Main render loop ----------
  function tick() {
    var track = currentTrack();
    if (track !== lastTrack) {
      lastTrack = track;
      applyAnchor(track);
    }
    var pal = paletteFor(track);
    var keyInfo = KEY_PITCHES[track] || KEY_PITCHES.library;
    var inKey = {};
    keyInfo.classes.forEach(function (c) { inKey[c] = true; });

    var whistleOverlay = (track === "ariel") && whistleTapOk;
    if (whistleOverlay) whistleAnalyser.getFloatFrequencyData(whistleFft);

    // Harpsichord baseline plucks (Library only): read the melody waveform and
    // activate scheduled notes whose start time has arrived.
    harpActive = false;
    if (track === "library") {
      if (melodyTapOk) melodyAnalyser.getFloatTimeDomainData(melodyTime);
      harpNow = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      for (var qi = harpQueue.length - 1; qi >= 0; qi--) {
        if (harpNow >= harpQueue[qi].startTime) {
          var ev = harpQueue.splice(qi, 1)[0];
          var of = Math.log2(ev.freq / ROW_F_MIN);
          if (of >= 0 && of < OCTAVES) harpPlucks.push({ octaveFloat: of, startTime: ev.startTime });
        }
      }
      if (harpQueue.length > 64) harpQueue.splice(0, harpQueue.length - 64);
      harpPlucks = harpPlucks.filter(function (p) { return (harpNow - p.startTime) < HARP_LIFETIME; });
      harpActive = melodyTapOk && harpPlucks.length > 0;
    } else {
      harpPlucks.length = 0; harpQueue.length = 0;
    }

    // Ariel bass baseline ripple (Ariel track only).
    bassActive = false;
    if (track === "ariel") {
      if (bassTapOk) bassAnalyser.getFloatTimeDomainData(bassTime);
      bassNow = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      for (var bqi = bassQueue.length - 1; bqi >= 0; bqi--) {
        if (bassNow >= bassQueue[bqi].startTime) {
          var bev = bassQueue.splice(bqi, 1)[0];
          var bof = Math.log2(bev.freq / ROW_F_MIN);
          if (bof < 0) bof = 0.001; else if (bof >= OCTAVES) bof = OCTAVES - 0.001;
          bassPlucks.push({ octaveFloat: bof, startTime: bev.startTime });
        }
      }
      if (bassQueue.length > 64) bassQueue.splice(0, bassQueue.length - 64);
      bassPlucks = bassPlucks.filter(function (p) { return (bassNow - p.startTime) < BASS_LIFETIME; });
      bassActive = bassTapOk && bassPlucks.length > 0;
    } else {
      bassPlucks.length = 0; bassQueue.length = 0;
    }

    // Hum lollipop update (Library only): live level → head height; note events
    // → pitch. Removed promptly when the current note's scheduled span ends, so
    // it doesn't linger (unless the next note has already taken over).
    if (track === "library") {
      if (humTapOk) humAnalyser.getFloatTimeDomainData(humTime);
      var hs = 0, hd = 0, hprev = humTime[0];
      for (var hn = 1; hn < humTime.length; hn++) {
        var hx = humTime[hn]; hs += hx * hx;
        var hdd = hx - hprev; hd += hdd * hdd; hprev = hx;   // derivative energy ~ brightness
      }
      var hlvl = Math.min(1, Math.sqrt(hs / humTime.length) * HUM_GAIN);
      humLevel = humLevel * 0.55 + hlvl * 0.45;            // bar HEIGHT: snappy level follow
      var bright = hs > 1e-9 ? Math.min(1, (hd / hs) * BRIGHT_GAIN) : 0;
      humWidth = humWidth * 0.7 + bright * 0.3;            // bar WIDTH: hum brightness/openness
      var latest = null, keep = [];
      for (var hqi = 0; hqi < humQueue.length; hqi++) {
        var e = humQueue[hqi];
        if (harpNow >= e.startTime) { if (!latest || e.startTime > latest.startTime) latest = e; }
        else keep.push(e);
      }
      humQueue = keep.length > 64 ? keep.slice(keep.length - 64) : keep;
      if (latest) {
        var hof = Math.log2(latest.freq / ROW_F_MIN);
        if (hof < 0) hof = 0.001; else if (hof >= OCTAVES) hof = OCTAVES - 0.001;
        humLollipop = { octaveFloat: hof, freq: latest.freq, vowel: latest.vowel || "uh",
                        endTime: latest.startTime + (latest.duration || 1) };
      }
      if (humLollipop && harpNow > humLollipop.endTime + 0.15) humLollipop = null;
    } else {
      humQueue.length = 0; humLollipop = null; humLevel = 0;
    }

    // Music-box glints (Library only): activate scheduled glints whose start
    // time has arrived; expire by lifetime.
    if (track === "library") {
      var gNow = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      for (var gqi = boxQueue.length - 1; gqi >= 0; gqi--) {
        if (gNow >= boxQueue[gqi].startTime) {
          var gev = boxQueue.splice(gqi, 1)[0];
          var gof = Math.log2(gev.freq / ROW_F_MIN);
          if (gof >= 0 && gof < OCTAVES) {
            // Loudness (velocity 0.45..1.0) → how high this glint drifts.
            var gv = gev.velocity == null ? 0.8 : gev.velocity;
            var gnorm = (gv - 0.45) / 0.55; if (gnorm < 0) gnorm = 0; else if (gnorm > 1) gnorm = 1;
            boxGlints.push({
              octaveFloat: gof, startTime: gev.startTime,
              riseFrac: BOX_RISE_MIN + BOX_RISE_VAR * gnorm,
              seed: Math.random() * 6.283,
              dir: Math.random() < 0.5 ? -1 : 1,
            });
          }
        }
      }
      if (boxQueue.length > 64) boxQueue.splice(0, boxQueue.length - 64);
      boxGlints = boxGlints.filter(function (g) { return (gNow - g.startTime) < BOX_GLINT_LIFE; });
    } else {
      boxGlints.length = 0; boxQueue.length = 0;
    }

    // Rising bubbles (Ariel only): spawn at each gliss note's pitch, store the
    // glide endpoints so the bubble climbs in step with the audio.
    if (track === "ariel") {
      var uNow = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      for (var uqi = bubbleQueue.length - 1; uqi >= 0; uqi--) {
        if (uNow >= bubbleQueue[uqi].startTime) {
          var uev = bubbleQueue.splice(uqi, 1)[0];
          var sof = Math.log2(uev.freq / ROW_F_MIN);
          var eof = uev.endFreq ? Math.log2(uev.endFreq / ROW_F_MIN) : sof;
          if (sof >= 0 && sof < OCTAVES) {
            bubbles.push({
              startOct: sof,
              glissEndOct: eof,
              driftTo: Math.min(OCTAVES - 0.01, eof + BUBBLE_RISE_EXTRA),
              startTime: uev.startTime,
              dur: uev.duration || 1,
              phase: Math.random() * Math.PI * 2,
              r: BUBBLE_R * (0.8 + Math.random() * 0.5),
            });
          }
        }
      }
      if (bubbleQueue.length > 64) bubbleQueue.splice(0, bubbleQueue.length - 64);
      bubbles = bubbles.filter(function (bb) { return (uNow - bb.startTime) < (bb.dur + BUBBLE_AFTER); });
    } else {
      bubbles.length = 0; bubbleQueue.length = 0;
    }

    computeMagnitudes(whistleOverlay);
    applyAdaptiveBaseline();
    applySpectralBlur(BLUR_SIGMA);
    if (autoRotate) camYaw += 0.0015;

    var rect = canvas.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    ctx2d.fillStyle = pal.bg;
    ctx2d.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    // Size the spiral from the canvas HEIGHT (fixed 720px) so narrowing the viz
    // pane just trims the empty space beside the spiral instead of shrinking it.
    // Cap by width so it can't overflow on very narrow screens.
    var baseRadius = Math.min(h * 0.20, w * 0.45);
    var octaveStep = baseRadius * 0.55;
    harpRadial = octaveStep * (HARP_AMP / 350);   // vertical scale (relative to octave spacing) for the pluck
    bassRadial = octaveStep * (BASS_AMP / 350);
    var peakUp     = octaveStep * 1.5;
    var cy1 = Math.cos(camYaw),   sy1 = Math.sin(camYaw);
    var cp1 = Math.cos(camPitch), sp1 = Math.sin(camPitch);

    // Hum bar: the baseline samples it spans (sL..sR), its height, and its center
    // sample — used to skip the baseline under it and to draw it as a vertical-
    // edged bar (depth-sorted with the spiral). Width (sample span) = brightness.
    var humBarSL = -1, humBarSR = -1, humBarHt = 0, humBarCenter = 0;
    var humBarZ = 0, humBarDepth = 1, humShape = null, humVowel = "uh";
    if (track === "library" && humLollipop) {
      humVowel = humLollipop.vowel || "uh";
      humShape = HUM_VOWEL_SHAPES[humVowel] || HUM_VOWEL_SHAPES.uh;
      humBarCenter = Math.round(humLollipop.octaveFloat * SAMPLES_PER_TURN);
      var halfSamp = Math.max(1, Math.round(HUM_BAR_HALF * humShape.width));   // samples each side (vowel width)
      humBarSL = Math.max(0, humBarCenter - halfSamp);
      humBarSR = Math.min(TOTAL_SAMPLES - 1, humBarCenter + halfSamp);
      humBarCenter = Math.max(0, Math.min(TOTAL_SAMPLES - 1, humBarCenter));
      humBarHt = humLevel * peakUp * LOLLI_HEIGHT * humShape.height;           // height = level × vowel height
      smoothHumWave(humTime, humSmooth, HUM_RIPPLE_SMOOTH, HUM_WSAMP + 1);     // side-ripple source
    }

    // 1) Build spiral inner + outer projected points (no draw yet)
    for (var o = 0; o < OCTAVES; o++) {
      for (var b = 0; b < SAMPLES_PER_TURN; b++) {
        var idx = o * SAMPLES_PER_TURN + b;
        var theta = (b / SAMPLES_PER_TURN) * 2 * Math.PI;
        var yWorld = (o + b / SAMPLES_PER_TURN - (OCTAVES - 1) / 2) * octaveStep;
        var mag = normDb(magnitudes[idx]);
        var peakMag = mag <= PEAK_KNEE
          ? PEAK_KNEE * Math.pow(mag / PEAK_KNEE, PEAK_GAMMA)
          : mag;
        var ct = Math.cos(theta), st = Math.sin(theta);
        var xW = baseRadius * ct, zW = baseRadius * st;
        var dy = harpDr(o, b) + bassDr(o, b);   // baseline vibrates vertically (harpsichord on Library, bass on Ariel)
        project(xW, yWorld + dy,                     zW, cy1, sy1, cp1, sp1, innerProj, idx * 3);
        project(xW, yWorld + dy + peakMag * peakUp,  zW, cy1, sy1, cp1, sp1, outerProj, idx * 3);
      }
    }

    // Hum bar depth — from its center sample's projected z, so it depth-sorts
    // into the quad pass and fades like the rest of the baseline. drawHumBar()
    // strokes an explicit bar: vertical left/right edges (constant angle) and a
    // top that follows the spiral; no bottom edge (the baseline under it is
    // skipped), so it reads as the baseline rising straight up into a bar.
    if (humBarSL >= 0) {
      humBarZ = innerProj[humBarCenter * 3 + 2];
      humBarDepth = 0.35 + 0.65 * (humBarZ + baseRadius) / (baseRadius * 2);
      if (humBarDepth < 0.15) humBarDepth = 0.15; else if (humBarDepth > 1) humBarDepth = 1;
    }
    // Top of the bar (world-y above the baseline) at across-bar position u∈[-1,1],
    // shaped by the current vowel: edge-to-edge peak/concave, or rounded corners
    // for oo, else flat.
    function humTopProfile(u, halfSpan) {
      var pk = humShape.peak;
      if (pk > 0.0001 || pk < -0.0001) {
        var a = u < 0 ? -u : u;
        var sh = (1 - u * u) * (1 - humShape.pointed) + (1 - a) * humShape.pointed;
        return humBarHt * (1 + pk * sh);
      }
      if (humVowel === "oo" && humShape.round > 0.001 && halfSpan > 0) {
        var halfWworld = halfSpan * (2 * Math.PI * baseRadius / SAMPLES_PER_TURN);
        var rad = humShape.round * Math.min(halfWworld, humBarHt * 0.95);
        var radFx = halfWworld > 0 ? rad / halfWworld : 0;
        var au = u < 0 ? -u : u;
        if (au <= 1 - radFx) return humBarHt;
        var aa = (au - (1 - radFx)) / radFx;
        return humBarHt - rad * (1 - Math.sqrt(Math.max(0, 1 - aa * aa)));
      }
      return humBarHt;
    }
    // Side ripple: shift along the baseline (in samples) by the smoothed hum
    // waveform, sampled along the bar's height and anchored at the base.
    function humRipple(hFrac) {
      if (!humTapOk) return 0;
      var f = hFrac < 0 ? 0 : (hFrac > 1 ? 1 : hFrac);
      var w = f < 0.15 ? f / 0.15 : 1;   // anchored at the base, full amplitude over the rest of the height
      return humSmooth[(f * (HUM_WSAMP - 1)) | 0] * HUM_RIPPLE_GAIN * w;
    }
    function drawHumBar() {
      var halfSpan = (humBarSR - humBarSL) / 2;
      if (halfSpan < 0.5) halfSpan = 0.5;
      var pts = [], ML = 12, TT = 26;
      var hL = humTopProfile(-1, halfSpan), hR = humTopProfile(1, halfSpan);
      for (var s1 = 0; s1 <= ML; s1++) pts.push([humBarSL, hL * (s1 / ML)]);              // left side
      for (var i = 0; i <= TT; i++) {                                                      // top (vowel shape)
        var u = -1 + 2 * i / TT;
        pts.push([humBarCenter + u * halfSpan, humTopProfile(u, halfSpan)]);
      }
      for (var s2 = 1; s2 <= ML; s2++) pts.push([humBarSR, hR * (1 - s2 / ML)]);           // right side
      ctx2d.save();
      ctx2d.strokeStyle = "rgba(" + pal.ribbonStroke[0] + "," + pal.ribbonStroke[1] + "," +
        pal.ribbonStroke[2] + "," + (0.9 * humBarDepth).toFixed(3) + ")";
      ctx2d.lineWidth = 1.3;
      ctx2d.lineJoin = "round";
      ctx2d.beginPath();
      for (var p = 0; p < pts.length; p++) {
        var hWorld = pts[p][1];
        var sRip = pts[p][0] + humRipple(hWorld / (humBarHt || 1));   // ripple along the baseline
        var of = sRip / SAMPLES_PER_TURN;
        var th = (of - Math.floor(of)) * 2 * Math.PI;
        var by2 = (of - (OCTAVES - 1) / 2) * octaveStep;
        var pr = projWorld(baseRadius * Math.cos(th), by2 + hWorld, baseRadius * Math.sin(th),
                           cx, cy, cy1, sy1, cp1, sp1);
        if (p === 0) ctx2d.moveTo(pr.sx, pr.sy); else ctx2d.lineTo(pr.sx, pr.sy);
      }
      ctx2d.stroke();
      ctx2d.restore();
    }

    // 2) Constellation floor (drawn before spiral; spiral occludes overlap)
    var floorY = -((OCTAVES - 1) / 2) * octaveStep - octaveStep * 0.55;
    var constMaxR = baseRadius;
    var haloMaxR  = baseRadius * 0.20;
    var nowAudio = ProsperoAudio.getAudioTime
      ? ProsperoAudio.getAudioTime()
      : (performance.now() / 1000);
    droneCycles = droneCycles.filter(function (c) {
      return c.startTime + c.duration + 0.5 >= nowAudio;
    });
    var activeCycles = droneCycles.filter(function (c) {
      return (!c.track || c.track === track) &&
             nowAudio >= c.startTime &&
             nowAudio <= c.startTime + c.duration;
    });

    // Chromatic spokes
    ctx2d.strokeStyle = "rgba(" + pal.constFg + ", 0.13)";
    ctx2d.lineWidth = 1;
    var centerP = projWorld(0, floorY, 0, cx, cy, cy1, sy1, cp1, sp1);
    for (var si = 0; si < 12; si++) {
      var sa = (si / 12) * 2 * Math.PI;
      var endP = projWorld(constMaxR * Math.cos(sa), floorY, constMaxR * Math.sin(sa),
                            cx, cy, cy1, sy1, cp1, sp1);
      ctx2d.beginPath();
      ctx2d.moveTo(centerP.sx, centerP.sy);
      ctx2d.lineTo(endP.sx, endP.sy);
      ctx2d.stroke();
    }
    // Outer ring
    ctx2d.strokeStyle = "rgba(" + pal.constFg + ", 0.20)";
    ctx2d.beginPath();
    var ringSamples = 64;
    for (var ri = 0; ri <= ringSamples; ri++) {
      var ra = (ri / ringSamples) * 2 * Math.PI;
      var rp = projWorld(constMaxR * Math.cos(ra), floorY, constMaxR * Math.sin(ra),
                          cx, cy, cy1, sy1, cp1, sp1);
      if (ri === 0) ctx2d.moveTo(rp.sx, rp.sy);
      else ctx2d.lineTo(rp.sx, rp.sy);
    }
    ctx2d.stroke();

    // Halo waveforms per partial node
    ctx2d.globalCompositeOperation = "lighter";
    for (var ci = 0; ci < activeCycles.length; ci++) {
      var cycle = activeCycles[ci];
      var amp = envelopeAt(cycle, nowAudio);
      if (amp === 0) continue;
      var intensity = amp / cycle.peakGain;
      var visualIntensity = Math.min(1, intensity * 1.7);
      var progress = (nowAudio - cycle.startTime) / cycle.duration;
      var baseRingR = progress * haloMaxR;
      for (var ti = 0; ti < cycle.frequencies.length; ti++) {
        var freq = cycle.frequencies[ti];
        var node = constNodeWorld(freq, constMaxR);
        var partials = buildPartialsForCycleTone(cycle, ti, nowAudio);
        ctx2d.strokeStyle = "rgba(" + pal.constFg + ", " + (visualIntensity * 0.85).toFixed(3) + ")";
        ctx2d.lineWidth = 0.5 + 0.8 * visualIntensity;
        if (!partials.length || baseRingR < haloMaxR * 0.04) {
          ctx2d.beginPath();
          var circSamples = 48;
          for (var cs = 0; cs <= circSamples; cs++) {
            var ca = (cs / circSamples) * 2 * Math.PI;
            var cp = projWorld(node.x + baseRingR * Math.cos(ca), floorY,
                                node.z + baseRingR * Math.sin(ca),
                                cx, cy, cy1, sy1, cp1, sp1);
            if (cs === 0) ctx2d.moveTo(cp.sx, cp.sy);
            else ctx2d.lineTo(cp.sx, cp.sy);
          }
          ctx2d.stroke();
        } else {
          var fMin = Infinity;
          for (var pi2 = 0; pi2 < partials.length; pi2++) {
            if (partials[pi2].freq < fMin) fMin = partials[pi2].freq;
          }
          var waveAmp = baseRingR * HALO_WAVE_AMP_FRAC;
          ctx2d.beginPath();
          for (var kk = 0; kk <= HALO_WAVE_POINTS; kk++) {
            var hth = (kk / HALO_WAVE_POINTS) * 2 * Math.PI;
            var disp = 0;
            for (var pp = 0; pp < partials.length; pp++) {
              var part = partials[pp];
              var spatialK = HALO_LIB_WAVELENGTHS * part.freq / fMin;
              var omegaT = (2 * Math.PI * part.freq / SLOWDOWN) * nowAudio;
              disp += part.amp * Math.sin(spatialK * hth) * Math.cos(omegaT);
            }
            var hr = baseRingR + disp * waveAmp;
            var hp = projWorld(node.x + hr * Math.cos(hth), floorY,
                                node.z + hr * Math.sin(hth),
                                cx, cy, cy1, sy1, cp1, sp1);
            if (kk === 0) ctx2d.moveTo(hp.sx, hp.sy);
            else ctx2d.lineTo(hp.sx, hp.sy);
          }
          ctx2d.closePath();
          ctx2d.stroke();
        }
      }
    }
    ctx2d.globalCompositeOperation = "source-over";

    // Connecting lines
    for (var ci2 = 0; ci2 < activeCycles.length; ci2++) {
      var cyc2 = activeCycles[ci2];
      if (cyc2.frequencies.length < 2) continue;
      var amp2 = envelopeAt(cyc2, nowAudio);
      if (amp2 === 0) continue;
      var intensity2 = amp2 / cyc2.peakGain;
      var sem = intervalSemitones(cyc2.frequencies[0], cyc2.frequencies[1]);
      var cons = consonance(sem);
      var alpha = intensity2 * (0.6 + cons * 0.4);
      if (alpha < 0.02) continue;
      var nA = constNodeWorld(cyc2.frequencies[0], constMaxR);
      var nB = constNodeWorld(cyc2.frequencies[1], constMaxR);
      var pA = projWorld(nA.x, floorY, nA.z, cx, cy, cy1, sy1, cp1, sp1);
      var pB = projWorld(nB.x, floorY, nB.z, cx, cy, cy1, sy1, cp1, sp1);
      ctx2d.strokeStyle = "rgba(" + pal.constFg + ", " + alpha.toFixed(3) + ")";
      ctx2d.lineWidth = 0.5 + cons * 1.0;
      ctx2d.beginPath();
      ctx2d.moveTo(pA.sx, pA.sy);
      ctx2d.lineTo(pB.sx, pB.sy);
      ctx2d.stroke();
    }

    // Harmonic dots
    for (var ci3 = 0; ci3 < activeCycles.length; ci3++) {
      var cyc3 = activeCycles[ci3];
      var amp3 = envelopeAt(cyc3, nowAudio);
      if (amp3 === 0) continue;
      var intensity3 = amp3 / cyc3.peakGain;
      for (var fi3 = 0; fi3 < cyc3.frequencies.length; fi3++) {
        var fundF = cyc3.frequencies[fi3];
        var harms = libraryTriangleHarmonics(fundF, 4000);
        for (var hi = 1; hi < Math.min(3, harms.length); hi++) {
          var harm = harms[hi];
          var hn = constNodeWorld(harm.freq, constMaxR);
          var ha = intensity3 * harm.relAmp;
          if (ha < 0.02) continue;
          var hpp = projWorld(hn.x, floorY, hn.z, cx, cy, cy1, sy1, cp1, sp1);
          ctx2d.fillStyle = "rgba(" + pal.constFg + ", " + (ha * 0.55).toFixed(3) + ")";
          ctx2d.beginPath();
          ctx2d.arc(hpp.sx, hpp.sy, 1.5 + ha * 2, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
    }

    // Partial nodes (and sub-octave dot)
    for (var ci4 = 0; ci4 < activeCycles.length; ci4++) {
      var cyc4 = activeCycles[ci4];
      var amp4 = envelopeAt(cyc4, nowAudio);
      if (amp4 === 0) continue;
      var intensity4 = amp4 / cyc4.peakGain;
      for (var fi4 = 0; fi4 < cyc4.frequencies.length; fi4++) {
        var pn = constNodeWorld(cyc4.frequencies[fi4], constMaxR);
        var pnP = projWorld(pn.x, floorY, pn.z, cx, cy, cy1, sy1, cp1, sp1);
        ctx2d.fillStyle = "rgba(" + pal.constFg + ", " + intensity4.toFixed(3) + ")";
        ctx2d.beginPath();
        ctx2d.arc(pnP.sx, pnP.sy, 1.5 + intensity4 * 2, 0, Math.PI * 2);
        ctx2d.fill();
      }
      if (cyc4.subFreq) {
        var sn = constNodeWorld(cyc4.subFreq, constMaxR);
        var snP = projWorld(sn.x, floorY, sn.z, cx, cy, cy1, sy1, cp1, sp1);
        var subI = intensity4 * (cyc4.subPeakGain / cyc4.peakGain);
        ctx2d.fillStyle = "rgba(" + pal.constSub + ", " + subI.toFixed(3) + ")";
        ctx2d.beginPath();
        ctx2d.arc(snP.sx, snP.sy, 1.5 + subI * 2, 0, Math.PI * 2);
        ctx2d.fill();
      }
    }

    // 3) Spiral quads: sort by mean projected z and draw back to front.
    //    For Ariel, the lollipop is interleaved into this sort at its own
    //    depth so coils in front of the lollipop occlude it correctly.
    var nQuads = TOTAL_SAMPLES - 1;
    for (var k = 0; k < nQuads; k++) {
      quadOrder[k] = k;
      quadZ[k] = (innerProj[k*3 + 2] + outerProj[k*3 + 2] +
                  innerProj[(k+1)*3 + 2] + outerProj[(k+1)*3 + 2]) * 0.25;
    }
    var qzRef = quadZ;
    Array.prototype.sort.call(quadOrder, function (a, b) { return qzRef[a] - qzRef[b]; });

    // ---- Ariel lollipop: update first, compute its representative z ----
    var lollipopZ = null;
    var lollipopDepthAlpha = 1;
    if (whistleOverlay) {
      var whistlePeaks = detectWhistlePeaks();
      updateLollipop3D(whistlePeaks, octaveStep, peakUp);   // Ariel whistle: original height
      if (trackedLollipop) {
        // Use the head's projected z as the depth marker. The head is
        // the visually dominant decoration; ordering by it makes the
        // brightest part of the lollipop fall behind front-facing coils.
        var lp = trackedLollipop;
        var ctL = Math.cos(lp.theta), stL = Math.sin(lp.theta);
        var phL = projWorld(baseRadius * ctL, lp.yHead, baseRadius * stL,
                            cx, cy, cy1, sy1, cp1, sp1);
        lollipopZ = phL.z;
        // Depth-based alpha fade: back of the cylinder (-baseRadius) →
        // dim; front (+baseRadius) → bright. Reinforces occlusion since
        // the spiral's translucent fills alone don't fully cover the
        // lollipop.
        lollipopDepthAlpha = 0.20 + 0.80 * (lollipopZ + baseRadius) / (baseRadius * 2);
        if (lollipopDepthAlpha < 0.10) lollipopDepthAlpha = 0.10;
        if (lollipopDepthAlpha > 1)    lollipopDepthAlpha = 1;
      }
    } else if (trackedLollipop) {
      trackedLollipop = null;
    }
    var lollipopDrawn = false;
    var barDrawn = false;

    var fR = pal.ribbonFill[0], fG = pal.ribbonFill[1], fB = pal.ribbonFill[2];
    var sR = pal.ribbonStroke[0], sG = pal.ribbonStroke[1], sB = pal.ribbonStroke[2];
    var bR2 = pal.baseStroke[0], bG2 = pal.baseStroke[1], bB2 = pal.baseStroke[2];
    var depthDenom = baseRadius * 2;
    for (var s = 0; s < nQuads; s++) {
      var k2 = quadOrder[s];
      var zAvg = quadZ[k2];

      // If the lollipop sits behind this quad in z (i.e., this quad is
      // more in-front), draw the lollipop now so this quad can paint
      // over it.
      if (lollipopZ !== null && !lollipopDrawn && zAvg >= lollipopZ) {
        drawLollipop3D(pal, baseRadius, cx, cy, cy1, sy1, cp1, sp1, lollipopDepthAlpha);
        lollipopDrawn = true;
      }
      // Same for the hum bar: draw it before the first quad that sits in front,
      // so coils nearer the camera paint over it.
      if (humBarSL >= 0 && !barDrawn && zAvg >= humBarZ) {
        drawHumBar();
        barDrawn = true;
      }

      var depth = 0.35 + 0.65 * (zAvg + baseRadius) / depthDenom;
      if (depth < 0.15) depth = 0.15;
      if (depth > 1) depth = 1;

      var x1i = cx + innerProj[k2*3],     y1i = cy - innerProj[k2*3 + 1];
      var x1o = cx + outerProj[k2*3],     y1o = cy - outerProj[k2*3 + 1];
      var x2o = cx + outerProj[(k2+1)*3], y2o = cy - outerProj[(k2+1)*3 + 1];
      var x2i = cx + innerProj[(k2+1)*3], y2i = cy - innerProj[(k2+1)*3 + 1];

      ctx2d.beginPath();
      ctx2d.moveTo(x1i, y1i);
      ctx2d.lineTo(x1o, y1o);
      ctx2d.lineTo(x2o, y2o);
      ctx2d.lineTo(x2i, y2i);
      ctx2d.closePath();
      ctx2d.fillStyle = "rgba(" + fR + "," + fG + "," + fB + "," + (0.28 * depth).toFixed(3) + ")";
      ctx2d.fill();

      // Fluctuating top edge — thin and faint now. The peaks read from the
      // ribbon fill; emphasis is on the fixed baseline below, not this edge.
      ctx2d.beginPath();
      ctx2d.moveTo(x1o, y1o);
      ctx2d.lineTo(x2o, y2o);
      ctx2d.strokeStyle = "rgba(" + bR2 + "," + bG2 + "," + bB2 + "," + (0.25 * depth).toFixed(3) + ")";
      ctx2d.lineWidth = 0.6;
      ctx2d.stroke();

      // Fixed baseline along the bottom of the spiral — the emphasized line
      // (constant radius/height; does not fluctuate with magnitude). Skipped on
      // the stretch under the hum bar, whose vertical edges replace it so there
      // is no flat bottom beneath the bar.
      if (!(humBarSL >= 0 && k2 >= humBarSL && k2 < humBarSR)) {
        ctx2d.beginPath();
        ctx2d.moveTo(x1i, y1i);
        ctx2d.lineTo(x2i, y2i);
        ctx2d.strokeStyle = "rgba(" + sR + "," + sG + "," + sB + "," + (0.9 * depth).toFixed(3) + ")";
        ctx2d.lineWidth = 1.3;
        ctx2d.stroke();
      }

      // Subtle octave-boundary notch: a small dot on the fixed baseline
      // wherever one octave's turn ends and the next begins (every
      // SAMPLES_PER_TURN samples). Inside the depth sort so coils in front
      // still occlude it.
      if (k2 % SAMPLES_PER_TURN === 0 && k2 !== 0) {
        ctx2d.beginPath();
        ctx2d.arc(x1i, y1i, 2, 0, Math.PI * 2);
        ctx2d.fillStyle = "rgba(" + sR + "," + sG + "," + sB + "," + (0.9 * depth).toFixed(3) + ")";
        ctx2d.fill();
      }
    }

    // Lollipop sat in front of every quad — draw it now.
    if (lollipopZ !== null && !lollipopDrawn) {
      drawLollipop3D(pal, baseRadius, cx, cy, cy1, sy1, cp1, sp1, lollipopDepthAlpha);
    }
    // Hum bar sat in front of every quad — draw it now.
    if (humBarSL >= 0 && !barDrawn) drawHumBar();

    // ---- Music-box glints (Library): lo-fi soft glow stars that drift up from
    //      the baseline. Pitch → position on the spiral; loudness → rise height;
    //      each spins slowly and twinkles. Drawn over the spiral (additive);
    //      depth alpha dims glints on the far side of the cylinder.
    if (track === "library" && boxGlints.length) {
      var gT = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      var gStr = pal.ribbonStroke;
      for (var gi2 = 0; gi2 < boxGlints.length; gi2++) {
        var gl = boxGlints[gi2];
        var gAge = gT - gl.startTime;
        // Bloom up fast, then ease out over the remaining lifetime.
        var gEnv = gAge < BOX_GLINT_BLOOM
          ? gAge / BOX_GLINT_BLOOM
          : Math.pow(1 - (gAge - BOX_GLINT_BLOOM) / (BOX_GLINT_LIFE - BOX_GLINT_BLOOM), 1.8);
        if (gEnv <= 0.001) continue;
        var gTheta = (gl.octaveFloat - Math.floor(gl.octaveFloat)) * 2 * Math.PI;
        // Drift UP from the baseline over its life (ease-out), to a loudness-set
        // height. The spiral encodes pitch as position; height carries loudness.
        var grt = gAge / BOX_GLINT_LIFE; if (grt > 1) grt = 1;
        var gRise = gl.riseFrac * peakUp * (1 - Math.pow(1 - grt, 1.6));
        var gY = (gl.octaveFloat - (OCTAVES - 1) / 2) * octaveStep + gRise;
        var gp = projWorld(baseRadius * Math.cos(gTheta), gY, baseRadius * Math.sin(gTheta),
                           cx, cy, cy1, sy1, cp1, sp1);
        var gDepth = 0.3 + 0.7 * (gp.z + baseRadius) / (baseRadius * 2);
        if (gDepth < 0.12) gDepth = 0.12; else if (gDepth > 1) gDepth = 1;
        var gRot = gl.seed + gl.dir * BOX_SPIN * gAge;
        drawGlintStar(gp.sx, gp.sy, gAge, gEnv, gDepth, BOX_GLINT_R, gRot, gl.seed, gStr);
      }
    }

    // ---- Rising bubbles (Ariel): float up the cylinder tracking the gliss,
    //      wobble side to side, then expand-and-pop at the end.
    if (track === "ariel" && bubbles.length) {
      var bT = ProsperoAudio.getAudioTime ? ProsperoAudio.getAudioTime() : (performance.now() / 1000);
      ctx2d.save();
      for (var bi2 = 0; bi2 < bubbles.length; bi2++) {
        var bub = bubbles[bi2];
        var bAge = bT - bub.startTime;
        var bTotal = bub.dur + BUBBLE_AFTER;
        var bT01 = bAge / bTotal; if (bT01 < 0) bT01 = 0; else if (bT01 > 1) bT01 = 1;
        // Pitch: glide start→end during the note, then buoyant drift upward.
        var bOf;
        if (bAge < bub.dur) {
          bOf = bub.startOct + (bub.glissEndOct - bub.startOct) * (bAge / bub.dur);
        } else {
          var bAft = (bAge - bub.dur) / BUBBLE_AFTER; if (bAft > 1) bAft = 1;
          bOf = bub.glissEndOct + (bub.driftTo - bub.glissEndOct) * bAft;
        }
        if (bOf < 0) bOf = 0; else if (bOf >= OCTAVES) bOf = OCTAVES - 0.01;
        var bWob = Math.sin(bAge * 3.2 + bub.phase) * BUBBLE_WOBBLE;
        var bTheta = (bOf - Math.floor(bOf)) * 2 * Math.PI + bWob;
        var bY = (bOf - (OCTAVES - 1) / 2) * octaveStep;
        var bp = projWorld(baseRadius * Math.cos(bTheta), bY, baseRadius * Math.sin(bTheta),
                           cx, cy, cy1, sy1, cp1, sp1);
        var bDepth = 0.25 + 0.75 * (bp.z + baseRadius) / (baseRadius * 2);
        if (bDepth < 0.12) bDepth = 0.12; else if (bDepth > 1) bDepth = 1;
        // Fade in quickly; pop (expand + fade) over the last ~18% of life.
        var bPop = bT01 > 0.82 ? (bT01 - 0.82) / 0.18 : 0;
        var bFade = bT01 < 0.1 ? bT01 / 0.1 : (1 - bPop);
        if (bFade <= 0.001) continue;
        var bR = bub.r * (1 + 0.25 * Math.sin(bAge * 2.1 + bub.phase)) * (1 + bPop * 1.4);
        var bA = bFade * bDepth;
        var bFil = pal.ribbonFill;
        ctx2d.strokeStyle = "rgba(" + bFil[0] + "," + bFil[1] + "," + bFil[2] + "," + (0.7 * bA).toFixed(3) + ")";
        ctx2d.lineWidth = 1.2;
        ctx2d.beginPath(); ctx2d.arc(bp.sx, bp.sy, bR, 0, Math.PI * 2); ctx2d.stroke();
        ctx2d.fillStyle = "rgba(" + bFil[0] + "," + bFil[1] + "," + bFil[2] + "," + (0.10 * bA).toFixed(3) + ")";
        ctx2d.fill();
        // Specular highlight, upper-left (suppressed as it pops).
        if (bPop < 0.5) {
          ctx2d.fillStyle = "rgba(255,255,255," + (0.7 * bA * (1 - bPop * 2)).toFixed(3) + ")";
          ctx2d.beginPath();
          ctx2d.arc(bp.sx - bR * 0.33, bp.sy - bR * 0.33, Math.max(0.8, bR * 0.18), 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
      ctx2d.restore();
    }

    // 5) Pitch-class labels on the constellation ring (full brightness,
    //    in-key vs out-of-key tinted)
    var labelR = constMaxR * 1.10;
    ctx2d.font = '12px "VT323", monospace';
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    for (var pli = 0; pli < 12; pli++) {
      var pla = (pli / 12) * 2 * Math.PI;
      var plp = projWorld(labelR * Math.cos(pla), floorY, labelR * Math.sin(pla),
                            cx, cy, cy1, sy1, cp1, sp1);
      var pcName = CONST_PITCH_LABELS[pli];
      var col = inKey[pcName] ? pal.inKeyLabel : pal.outKeyLabel;
      ctx2d.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0.95)";
      ctx2d.fillText(pcName, plp.sx, plp.sy);
    }

    // 6) Interval labels at the midpoint of each pair
    for (var ci5 = 0; ci5 < activeCycles.length; ci5++) {
      var cyc5 = activeCycles[ci5];
      if (cyc5.frequencies.length < 2) continue;
      var amp5 = envelopeAt(cyc5, nowAudio);
      if (amp5 === 0) continue;
      var intensity5 = amp5 / cyc5.peakGain;
      if (intensity5 < 0.1) continue;
      var sem5 = intervalSemitones(cyc5.frequencies[0], cyc5.frequencies[1]);
      var lblTxt = INTERVAL_NAMES[sem5] || "";
      if (!lblTxt) continue;
      var nA2 = constNodeWorld(cyc5.frequencies[0], constMaxR);
      var nB2 = constNodeWorld(cyc5.frequencies[1], constMaxR);
      var mx = (nA2.x + nB2.x) * 0.5;
      var mz = (nA2.z + nB2.z) * 0.5;
      var mp = projWorld(mx, floorY, mz, cx, cy, cy1, sy1, cp1, sp1);
      var tw = ctx2d.measureText(lblTxt).width;
      ctx2d.fillStyle = "rgba(10, 8, 5, 0.85)";
      ctx2d.fillRect(mp.sx - tw / 2 - 4, mp.sy - 9, tw + 8, 16);
      ctx2d.fillStyle = "rgba(" + pal.constFg + ", " + (0.55 + intensity5 * 0.35).toFixed(3) + ")";
      ctx2d.fillText(lblTxt, mp.sx, mp.sy);
    }

    // 7) Octave axis on the left (fixed pixel x; y tracks pitch only)
    var tickX  = cx - baseRadius - 28;
    var labelX = tickX - 8;
    var capW   = 4;
    var oR = pal.octaveLabel[0], oG = pal.octaveLabel[1], oB = pal.octaveLabel[2];
    ctx2d.font = '13px "VT323", monospace';
    ctx2d.textAlign = "right";
    ctx2d.textBaseline = "middle";
    ctx2d.strokeStyle = "rgba(" + oR + "," + oG + "," + oB + ",0.45)";
    ctx2d.lineWidth = 1;
    ctx2d.fillStyle = "rgba(" + oR + "," + oG + "," + oB + ",0.85)";
    for (var oi = 0; oi < OCTAVES; oi++) {
      var yStart = (oi - (OCTAVES - 1) / 2) * octaveStep;
      var yEnd   = (oi + 1 - (OCTAVES - 1) / 2) * octaveStep;
      var yCenter = (yStart + yEnd) * 0.5;
      var sStart  = cy - yStart  * cp1;
      var sEnd    = cy - yEnd    * cp1;
      var sCenter = cy - yCenter * cp1;
      ctx2d.beginPath();
      ctx2d.moveTo(tickX, sStart);
      ctx2d.lineTo(tickX, sEnd);
      ctx2d.moveTo(tickX - capW, sStart);
      ctx2d.lineTo(tickX + capW, sStart);
      ctx2d.moveTo(tickX - capW, sEnd);
      ctx2d.lineTo(tickX + capW, sEnd);
      ctx2d.stroke();
      ctx2d.fillText(ANCHOR_NAME + (BASE_OCTAVE + oi), labelX, sCenter);
    }

    // 8) Scale name in the bottom-right corner
    ctx2d.fillStyle = "rgba(" + oR + "," + oG + "," + oB + ",0.55)";
    ctx2d.font = '12px "VT323", monospace';
    ctx2d.textAlign = "right";
    ctx2d.fillText(keyInfo.name, w - 12, h - 8);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
