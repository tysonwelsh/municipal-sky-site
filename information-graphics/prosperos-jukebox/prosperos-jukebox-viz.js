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
// Drone visualization — Pulse Constellation
//
// A chromatic-circle layout where each drone partial appears as a node at
// its pitch-class angle, octave-out via radius. Each node grows a waveform
// halo ring whose base radius tracks cycle progress and whose shape is the
// slowed sound wave of that node's tone (fundamental + odd triangle
// harmonics, attenuated by the actual 180 Hz lowpass for Library).
// ============================================================================

(function () {
  "use strict";

  if (!window.ProsperoAudio) {
    console.error("Viz: ProsperoAudio engine not loaded");
    return;
  }

  var canvas = document.getElementById("jukebox-viz-drone");
  if (!canvas) return;
  var ctx2d = canvas.getContext("2d");

  // ---------- Constants ----------
  var PITCH_LABELS = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  var HALO_MAX_RADIUS = 38;       // px — how far rings expand from each node
  var HALO_WAVE_AMP_FRAC = 0.2;   // wave displacement as fraction of base radius
  var HALO_WAVE_POINTS = 180;
  var HALO_WAVELENGTHS_BY_TRACK = { // wavelengths of fMin around the ring
    library: 6,
    sycorax: 3,
    ariel:   3,
  };
  // SLOWDOWN — real partial Hz / SLOWDOWN = visible Hz. Same as the mockup.
  var SLOWDOWN = 60;
  // Triangle harmonics + 180 Hz lowpass response for Library.
  var LIBRARY_LOWPASS = 180;
  // Library drone uses triangle oscillators; Sycorax uses sawtooth (rich
  // odd+even harmonics) but heavily lowpass-filtered. For both tracks the
  // visual wave is well-approximated by the triangle harmonic series for
  // each fundamental.
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
  var HARMONIC_FREQ_CEILING = 800;

  // Interval helpers + consonance scoring (for the connecting line/label).
  function freqToMidi(f) { return 12 * Math.log2(f / 440) + 69; }
  function pitchClass(f) { return ((freqToMidi(f) % 12) + 12) % 12; }
  function pitchClassAngle(f) { return (pitchClass(f) / 12) * 2 * Math.PI - Math.PI / 2; }
  function intervalSemitones(f1, f2) {
    var m = Math.abs(freqToMidi(f1) - freqToMidi(f2));
    return Math.round(m) % 12;
  }
  function consonance(semitones) {
    var C = { 0: 1.0, 7: 0.95, 5: 0.85, 4: 0.75, 3: 0.7,
              8: 0.55, 9: 0.55, 2: 0.4, 10: 0.4,
              1: 0.25, 11: 0.25, 6: 0.3 };
    return C[semitones] != null ? C[semitones] : 0.5;
  }
  var INTERVAL_NAMES = {
    0: "unison", 1: "m2", 2: "M2", 3: "m3", 4: "M3",
    5: "P4",     6: "tritone", 7: "P5", 8: "m6", 9: "M6",
    10: "m7",    11: "M7",
  };

  // ---------- Cycle bookkeeping ----------
  // Each entry: {track, startTime, duration, fadeIn, fadeOut, peakGain,
  //              frequencies[], subFreq|null, subPeakGain}
  var cycles = [];
  ProsperoAudio.setDroneListener(function (cycle) { cycles.push(cycle); });

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

  // ---------- Canvas resize (DPR-aware) ----------
  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ---------- Main render ----------
  function tick() {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    var now = ProsperoAudio.getAudioTime
              ? ProsperoAudio.getAudioTime()
              : (performance.now() / 1000);
    var track = vizCurrentTrack();
    var pal = vizColors();
    var palFg  = pal.fgRGB  || "255, 170, 0";
    var palSub = pal.subRGB || "255, 130, 40";

    // Clear with the panel background
    ctx2d.fillStyle = pal.bg || "#0a0a0a";
    ctx2d.fillRect(0, 0, w, h);

    // Prune cycles that have fully ended
    cycles = cycles.filter(function (c) {
      return c.startTime + c.duration + 0.5 >= now;
    });

    // ---------- Background: chromatic spokes + outer ring + labels ----------
    var cx = w / 2, cy = h / 2;
    var maxR = Math.min(cx, cy) - 24;

    function nodePos(freq) {
      var a = pitchClassAngle(freq);
      var midi = freqToMidi(freq);
      var oct = Math.floor(midi / 12) - 1;
      var norm = Math.max(0, Math.min(1, (oct - 1) / 4));
      var r = 0.25 * maxR + norm * 0.75 * maxR;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }

    ctx2d.strokeStyle = "rgba(" + palFg + ", 0.13)";
    ctx2d.lineWidth = 1;
    ctx2d.fillStyle = "rgba(" + palFg + ", 0.45)";
    ctx2d.font = '12px "VT323", monospace';
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * 2 * Math.PI - Math.PI / 2;
      ctx2d.beginPath();
      ctx2d.moveTo(cx, cy);
      ctx2d.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      ctx2d.stroke();
      ctx2d.fillText(PITCH_LABELS[i],
                     cx + Math.cos(a) * (maxR + 12),
                     cy + Math.sin(a) * (maxR + 12));
    }
    ctx2d.strokeStyle = "rgba(" + palFg + ", 0.20)";
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx2d.stroke();
    ctx2d.textAlign = "left";
    ctx2d.textBaseline = "alphabetic";

    // Filter to current track's cycles
    var activeCycles = cycles.filter(function (c) {
      return (!c.track || c.track === track) &&
             now >= c.startTime && now <= c.startTime + c.duration;
    });

    // ---------- Layer 1: Waveform halo rings per partial node ----------
    var haloWavelengths = HALO_WAVELENGTHS_BY_TRACK[track] || 3;
    ctx2d.globalCompositeOperation = "lighter";
    activeCycles.forEach(function (cycle) {
      var amp = envelopeAt(cycle, now);
      if (amp === 0) return;
      var intensity = amp / cycle.peakGain;
      var visualIntensity = Math.min(1, intensity * 1.7); // faster fade
      var progress = (now - cycle.startTime) / cycle.duration;
      var baseRingR = progress * HALO_MAX_RADIUS;

      cycle.frequencies.forEach(function (freq, toneIdx) {
        var n = nodePos(freq);
        ctx2d.strokeStyle = "rgba(" + palFg + ", " + (visualIntensity * 0.85) + ")";
        ctx2d.lineWidth = 0.5 + 0.8 * visualIntensity;

        var partials = buildPartialsForCycleTone(cycle, toneIdx, now);
        if (!partials.length || baseRingR < 1.5) {
          ctx2d.beginPath();
          ctx2d.arc(n.x, n.y, baseRingR, 0, Math.PI * 2);
          ctx2d.stroke();
          return;
        }

        var fMin = Infinity;
        for (var pi = 0; pi < partials.length; pi++) {
          if (partials[pi].freq < fMin) fMin = partials[pi].freq;
        }
        var waveAmp = baseRingR * HALO_WAVE_AMP_FRAC;

        ctx2d.beginPath();
        for (var k = 0; k <= HALO_WAVE_POINTS; k++) {
          var theta = (k / HALO_WAVE_POINTS) * 2 * Math.PI;
          var disp = 0;
          for (var p = 0; p < partials.length; p++) {
            var part = partials[p];
            var spatialK = haloWavelengths * part.freq / fMin;
            var omegaT = (2 * Math.PI * part.freq / SLOWDOWN) * now;
            disp += part.amp * Math.sin(spatialK * theta) * Math.cos(omegaT);
          }
          var r = baseRingR + disp * waveAmp;
          var x = n.x + r * Math.cos(theta);
          var y = n.y + r * Math.sin(theta);
          if (k === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.closePath();
        ctx2d.stroke();
      });
    });
    ctx2d.globalCompositeOperation = "source-over";

    // ---------- Layer 2: Connecting line between the two partials ----------
    activeCycles.forEach(function (cycle) {
      if (cycle.frequencies.length < 2) return;
      var amp = envelopeAt(cycle, now);
      if (amp === 0) return;
      var intensity = amp / cycle.peakGain;
      var sem = intervalSemitones(cycle.frequencies[0], cycle.frequencies[1]);
      var cons = consonance(sem);
      var alpha = intensity * (0.6 + cons * 0.4);
      if (alpha < 0.02) return;
      var a = nodePos(cycle.frequencies[0]);
      var b = nodePos(cycle.frequencies[1]);
      ctx2d.strokeStyle = "rgba(" + palFg + ", " + alpha + ")";
      ctx2d.lineWidth = 0.5 + cons * 1.0;
      ctx2d.beginPath();
      ctx2d.moveTo(a.x, a.y);
      ctx2d.lineTo(b.x, b.y);
      ctx2d.stroke();
    });

    // ---------- Layer 3: Harmonic position dots (3f, 5f overtones) ----------
    activeCycles.forEach(function (cycle) {
      var amp = envelopeAt(cycle, now);
      if (amp === 0) return;
      var intensity = amp / cycle.peakGain;
      cycle.frequencies.forEach(function (freq) {
        var harmonics = libraryTriangleHarmonics(freq, 4000);
        for (var hi = 1; hi < Math.min(3, harmonics.length); hi++) {
          var harm = harmonics[hi];
          var hp = nodePos(harm.freq);
          var ha = intensity * harm.relAmp;
          if (ha < 0.02) continue;
          ctx2d.fillStyle = "rgba(" + palFg + ", " + (ha * 0.55) + ")";
          ctx2d.beginPath();
          ctx2d.arc(hp.x, hp.y, 1.5 + ha * 2, 0, Math.PI * 2);
          ctx2d.fill();
        }
      });
    });

    // ---------- Layer 4: Partial nodes (small dots on top) ----------
    activeCycles.forEach(function (cycle) {
      var amp = envelopeAt(cycle, now);
      if (amp === 0) return;
      var intensity = amp / cycle.peakGain;
      cycle.frequencies.forEach(function (freq) {
        var p = nodePos(freq);
        ctx2d.fillStyle = "rgba(" + palFg + ", " + intensity + ")";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, 1.5 + intensity * 2, 0, Math.PI * 2);
        ctx2d.fill();
      });
      if (cycle.subFreq) {
        var sp = nodePos(cycle.subFreq);
        var subI = intensity * (cycle.subPeakGain / cycle.peakGain);
        ctx2d.fillStyle = "rgba(" + palSub + ", " + subI + ")";
        ctx2d.beginPath();
        ctx2d.arc(sp.x, sp.y, 1.5 + subI * 2, 0, Math.PI * 2);
        ctx2d.fill();
      }
    });

    // ---------- Layer 5: Interval label at midpoint of pair ----------
    ctx2d.font = '12px "VT323", monospace';
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    activeCycles.forEach(function (cycle) {
      if (cycle.frequencies.length < 2) return;
      var amp = envelopeAt(cycle, now);
      if (amp === 0) return;
      var intensity = amp / cycle.peakGain;
      if (intensity < 0.1) return;
      var sem = intervalSemitones(cycle.frequencies[0], cycle.frequencies[1]);
      var txt = INTERVAL_NAMES[sem] || "";
      if (!txt) return;
      var a = nodePos(cycle.frequencies[0]);
      var b = nodePos(cycle.frequencies[1]);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var tw = ctx2d.measureText(txt).width;
      ctx2d.fillStyle = "rgba(10, 8, 5, 0.85)";
      ctx2d.fillRect(mx - tw / 2 - 4, my - 10, tw + 8, 18);
      ctx2d.fillStyle = "rgba(" + palFg + ", " + (0.55 + intensity * 0.35) + ")";
      ctx2d.fillText(txt, mx, my);
    });
    ctx2d.textAlign = "left";
    ctx2d.textBaseline = "alphabetic";

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ============================================================================
// Motif log — track-aware
//
// Subscribes to ProsperoAudio.setMotifListener. Shows harpsichord motifs on
// Library, ghost motifs on Sycorax. Header label and empty-state copy
// re-theme based on the current track.
// ============================================================================
(function () {
  "use strict";
  if (!window.ProsperoAudio || !ProsperoAudio.setMotifListener) return;

  var logEl = document.getElementById("jukebox-log");
  var labelEl = document.getElementById("jukebox-log-label");
  if (!logEl) return;

  var LOG_MAX = 60;
  var sessionStart = null; // audio time of first event in this session

  // Per-track display copy. Tracks with multiple motif layers (Sycorax has
  // both ghost and waterphone) share one log; the LAYER column on each row
  // tells you which layer fired.
  var TRACK_COPY = {
    library: { header: "HARPSICHORD · motif log", empty: "Press PLAY on the Library track. New motifs will appear here, with returns shown in gold." },
    sycorax: { header: "SYCORAX · motif log",     empty: "Press PLAY on the Sycorax track. Ghost-tone and waterphone motifs will appear here, with returns shown in gold." },
    ariel:   { header: "WHISTLE · motif log",     empty: "Press PLAY on the Ariel track. Whistle motifs will appear here as they're captured and recalled." },
  };

  function copyFor(track) {
    return TRACK_COPY[track] || { header: "MOTIF · log", empty: "No motif layer for this track yet." };
  }

  function setHeader(track) {
    if (!labelEl) return;
    labelEl.textContent = copyFor(track).header;
  }

  function formatTime(sec) {
    if (sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec - m * 60);
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function clearLog(track) {
    sessionStart = null;
    var copy = copyFor(track || "library");
    logEl.innerHTML = '<div class="jukebox-log-empty">' + copy.empty + '</div>';
    setHeader(track);
  }

  function renderRow(ev) {
    // First event after a clear seeds sessionStart and updates the header
    if (sessionStart == null) {
      sessionStart = ev.time;
      logEl.innerHTML = "";
      setHeader(ev.track);
    }

    var row = document.createElement("div");
    row.className = "jukebox-log-row";

    var t = document.createElement("span");
    t.className = "jukebox-log-time";
    t.textContent = formatTime(ev.time - sessionStart);

    var lyr = document.createElement("span");
    lyr.className = "jukebox-log-layer";
    lyr.setAttribute("data-layer", ev.layer || "");
    lyr.textContent = (ev.layer || "").toUpperCase();

    var id = document.createElement("span");
    id.className = "jukebox-log-id";
    id.textContent = "#" + ev.motifId;

    var cl = document.createElement("span");
    cl.className = "jukebox-log-cluster";
    cl.textContent = ev.cluster;

    var act = document.createElement("span");
    act.className = "jukebox-log-action";
    var tag = document.createElement("span");
    tag.className = "log-tag " + ev.action;
    tag.textContent = ev.action;
    act.appendChild(tag);
    if (ev.action === "transform" && ev.transform) {
      var x = document.createElement("span");
      x.className = "jukebox-log-transform";
      x.textContent = ev.transform;
      act.appendChild(x);
    }

    row.appendChild(t);
    row.appendChild(lyr);
    row.appendChild(id);
    row.appendChild(cl);
    row.appendChild(act);

    // Newest at top
    logEl.insertBefore(row, logEl.firstChild);

    // Cap the row count
    while (logEl.childElementCount > LOG_MAX) {
      logEl.removeChild(logEl.lastChild);
    }
  }

  ProsperoAudio.setMotifListener(function (ev) {
    if (!ev) return;
    if (ev.type === "clear") { clearLog(ev.track); return; }
    if (ev.type === "fire") { renderRow(ev); return; }
  });

  // Initialize header for whatever track is active when the page loads.
  var initialTrack = (ProsperoAudio.getState && ProsperoAudio.getState().currentTrack) || "library";
  setHeader(initialTrack);
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
