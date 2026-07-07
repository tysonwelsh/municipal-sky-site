// ============================================================================
// Prospero's Jukebox v2 — form-demo.js (Phase 1 form-monitor driver)
//
// The thinnest possible skin over the PJ2.Library facade: Play/Stop, a seed,
// a volume slider, a ~300ms getInfo() poll into a monitor table, and an event
// log fed by setEventListener. Everything interesting happens inside the
// engine; this file's only intelligence is knowing which numbers a human
// wants to stare at while an evening unfolds:
//
//   - performance # + elapsed/planned seconds — is the chaining seamless?
//   - tide label + position bar — does the weather drift across evenings?
//   - scene name + progress bar — is the plan being walked in order?
//   - intensity meter — does it read as weather (no steps, band 0.04..0.65)?
//   - harmony — the current chord name (Phase 2's grammar, one glance)
//   - motif — theme name + living generation, developments/answers so far
//   - air holders + overlap count — is turn-taking the norm, overlap rare?
//   - weather — the five Phase 3 channels, live (do they drift, never step?)
//   - room — the parlor↔hall balance bar (does it morph with the scenes?)
//   - halo — the sympathetic bank's whisper level (does it gutter at the end?)
//   - budget voices/nodes — does the ceiling hold, does it drain on stop?
//
// Phase 3 also brings the alchemical display labels (PJ2.Library.LABELS, the
// PLAN-GRAPHICS shared vocabulary): the scene readout and scene log lines
// show the operation (Calcinatio … Coagulatio) beside the internal name, and
// seachange/ghost/cadence lines print their event labels (Transmutatio,
// Caput Mortuum, Ablutio/Suspensio/Resolutio).
//
// The log prints performance/scene/joint/tide lines (the joint's `did` label
// shows which quiet gesture a boundary drew — "(silence)" is a legitimate
// and frequent draw) plus the Phase 2 narration: cadences (with their kind
// and chord names), the sea change (with its target), the ghost, and every
// develop/answer as the motif engine works its ideas — capped at 100 rows
// so an overnight run can't grow the DOM without bound.
//
// House rules honored: no AudioContext until Play (the facade lazy-inits on
// first play()), the only DOM access is element lookup + listeners, and the
// file evals headless (the element guard below returns before any wiring if
// there is no real page under us).
// ============================================================================
(function () {
  "use strict";

  var LOG_KEEP = 100;    // event-log ring buffer, spec §8 "capped ~100 rows"
  var POLL_MS = 300;     // monitor cadence, spec §8 "~300ms"

  // ---- DOM (script loads at the end of the body; everything exists) --------
  var elPlay      = document.getElementById("pj2-play");
  var elStop      = document.getElementById("pj2-stop");
  var elSeed      = document.getElementById("pj2-seed");
  var elVol       = document.getElementById("pj2-vol");
  var elVolOut    = document.getElementById("pj2-vol-out");
  var elState     = document.getElementById("pj2-state");
  var elPerf      = document.getElementById("pj2-perf");
  var elTide      = document.getElementById("pj2-tide");
  var elTideFill  = document.getElementById("pj2-tide-fill");
  var elScene     = document.getElementById("pj2-scene");
  var elSceneFill = document.getElementById("pj2-scene-fill");
  var elInt       = document.getElementById("pj2-int");
  var elIntFill   = document.getElementById("pj2-int-fill");
  var elChord     = document.getElementById("pj2-chord");
  var elMotif     = document.getElementById("pj2-motif");
  var elAir       = document.getElementById("pj2-air");
  var elWeather   = document.getElementById("pj2-weather");
  var elRoom      = document.getElementById("pj2-room");
  var elRoomFill  = document.getElementById("pj2-room-fill");
  var elHalo      = document.getElementById("pj2-halo");
  var elBudget    = document.getElementById("pj2-budget");
  var elLog       = document.getElementById("pj2-log");
  if (!elPlay || !elLog) return; // headless eval / partial page: nothing to drive

  // ---- engine state ---------------------------------------------------------
  var engine = null;       // ONE facade per page; reseed() swaps its world
  var engineSeed = null;
  var monitorId = null;    // the poll starts on first Play and never stops —
                           // watching the budget drain AFTER stop is the point
  var logLines = [];

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function readSeed() {
    var v = parseInt(elSeed.value, 10);
    return (isFinite(v) && v >= 0) ? (v >>> 0) : 1;
  }
  function readVol() {
    var v = parseFloat(elVol.value);
    return isFinite(v) ? clamp01(v) : 0.5;
  }

  // ------------------------------------------------------------------------
  // Event log: ring-buffered <pre>, newest at the bottom, auto-scrolled.
  // ------------------------------------------------------------------------
  function log(line) {
    logLines.push(line);
    if (logLines.length > LOG_KEEP) logLines.shift();
    elLog.textContent = logLines.join("\n");
    elLog.scrollTop = elLog.scrollHeight;
  }

  function fmtT(t) {
    if (typeof t !== "number" || !isFinite(t)) return "     ?";
    var s = t.toFixed(1);
    while (s.length < 7) s = " " + s;
    return s;
  }

  // The conductor narrates; we transcribe. Air claims and the dramaturgy's
  // internal joint-gesture events are monitor material, not log material —
  // they'd bury the form lines this page exists to show.
  function onEvent(e) {
    switch (e.type) {
      case "performance":
        if (e.phase === "begin") {
          log(fmtT(e.t) + "  PERFORMANCE #" + e.n + " begins — " + Math.round(e.durS) + "s, " +
            e.sceneCount + " scenes [" + e.scenes.join(" > ") + "], tide " + e.tideLabel +
            " (" + e.tidePos.toFixed(2) + "), chain overlap " + e.chainOverlapS.toFixed(1) + "s");
        } else {
          log(fmtT(e.t) + "  PERFORMANCE #" + e.n + " ends after " + Math.round(e.elapsedS) + "s");
        }
        break;
      case "scene":
        log(fmtT(e.t) + "    scene " + (e.idx + 1) + "/" + e.count + ": " + e.scene +
          (e.label ? " — " + e.label : "") +
          " (" + Math.round(e.durS) + "s" + (e.activity ? ", " + e.activity : "") + ")");
        break;
      case "joint":
        log(fmtT(e.t) + "    joint " + e.from + " -> " + e.to + ": " +
          (e.did == null ? "(silence)" : e.did) + (e.error ? "  [threw: " + e.error + "]" : ""));
        break;
      case "tide":
        log(fmtT(e.t) + "  tide -> " + e.label + " (pos " + e.pos.toFixed(2) + ", period " +
          e.periodPerfs.toFixed(1) + " perfs)");
        break;
      case "engine":
        log(fmtT(e.t) + "  engine: " + e.state + (e.seed != null ? " (seed " + e.seed + ")" : ""));
        break;
      // ---- Phase 2 narration ----------------------------------------------
      case "cadence":
        log(fmtT(e.t) + "    cadence (" + e.kind + (e.label ? " — " + e.label : "") + "): " +
          (e.chords ? e.chords.join(" -> ") : "?") + ", " + e.from + " -> " + e.to +
          " (arrives at boundary)");
        break;
      case "seachange":
        log(fmtT(e.t) + "  SEA CHANGE" + (e.label ? " — " + e.label : "") +
          " (" + (e.target ? e.target.kind : "?") +
          (e.target && e.target.toDeg != null ? " -> deg " + e.target.toDeg : "") + "): now " +
          (e.field ? e.field.mode + " on " + (+e.field.tonicHz).toFixed(1) + " Hz" : "?") +
          (e.pivotDegs ? ", pivots [" + e.pivotDegs.join(",") + "]" : ""));
        break;
      case "ghost":
        log(fmtT(e.t) + "    ghost" + (e.label ? " — " + e.label : "") +
          ": “" + e.name + "” returns, half-remembered (" + e.voice + ")");
        break;
      case "develop":
        log(fmtT(e.t) + "      develop: " + e.name + " gen " + e.gen +
          (e.transform ? " via " + e.transform : "") + " (" + e.voice + ")");
        break;
      case "answer":
        log(fmtT(e.t) + "      answer: " + e.name + " gen " + e.gen + " (" + e.voice + ")");
        break;
      // "air" and "joint-gesture" intentionally not logged — see above.
    }
  }

  // ------------------------------------------------------------------------
  // The monitor: ~300ms getInfo() poll. The shape is whatever the facade
  // returns — conductor.info() flattened plus airHolders/airOverlaps/budget —
  // and every read below is guarded so a missing field renders as a dash,
  // not a broken monitor.
  // ------------------------------------------------------------------------
  function pollMonitor() {
    if (!engine) return;
    var info;
    try { info = engine.getInfo(); } catch (e) { return; }

    elState.textContent = info.playing ? "playing" : "stopped";

    if (info.perfN) {
      elPerf.textContent = "#" + info.perfN +
        "  (" + Math.round(info.elapsedS || 0) + "s / " + Math.round(info.durS || 0) + "s planned)";
    } else {
      elPerf.textContent = "—";
    }

    var tp = (typeof info.tidePos === "number") ? clamp01(info.tidePos) : null;
    elTideFill.style.width = (tp == null ? 0 : Math.round(tp * 100)) + "%";
    elTide.textContent = tp == null ? "—"
      : (info.tideLabel || "?") + " (" + tp.toFixed(2) + ")";

    var x = (typeof info.x === "number") ? clamp01(info.x) : null;
    elSceneFill.style.width = (x == null ? 0 : Math.round(x * 100)) + "%";
    // The alchemical operation (sceneLabel — engine-provided display
    // vocabulary) reads beside the internal scene name.
    elScene.textContent = info.sceneType
      ? info.sceneType + (info.sceneLabel ? " — " + info.sceneLabel : "") +
        (info.activity ? " · " + info.activity : "") +
        "  (" + (info.sceneIdx + 1) + "/" + info.sceneCount + ")"
      : "—";

    var iv = (typeof info.intensity === "number") ? clamp01(info.intensity) : null;
    elIntFill.style.width = (iv == null ? 0 : Math.round(iv * 100)) + "%";
    elInt.textContent = iv == null ? "—" : iv.toFixed(3);

    elChord.textContent = info.harmony || "—";

    var mo = info.motif;
    if (mo && mo.working && mo.working.theme) {
      elMotif.textContent = "“" + mo.working.theme + "” gen " +
        (mo.working.themeGen == null ? 0 : mo.working.themeGen) +
        " · working " + mo.working.count + "/3" +
        " · " + (mo.developments || 0) + " dev / " + (mo.answers || 0) + " ans" +
        (mo.ghostCarried ? " · ghost carried" : "");
    } else {
      elMotif.textContent = "—";
    }

    elAir.textContent = (info.airHolders == null ? "—" : info.airHolders + " holder(s)") +
      ", " + (info.airOverlaps || 0) + " overlap grant(s) total";

    // ---- Phase 3 sound telemetry ------------------------------------------
    var wx = info.weather;
    if (wx && typeof wx.brightness === "number") {
      elWeather.textContent =
        "brightness " + wx.brightness.toFixed(2) +
        " · breath " + wx.breath.toFixed(2) +
        " · gapMul " + wx.gapMul.toFixed(2) +
        " · wetTilt " + wx.wetTilt.toFixed(2) +
        " · haloLevel " + wx.haloLevel.toFixed(2);
    } else {
      elWeather.textContent = "—";
    }

    var rb = (typeof info.roomBalance === "number") ? clamp01(info.roomBalance) : null;
    elRoomFill.style.width = (rb == null ? 0 : Math.round(rb * 100)) + "%";
    elRoom.textContent = rb == null ? "—"
      : rb.toFixed(2) + "  (0 = close parlor, 1 = wide hall)";

    elHalo.textContent = (typeof info.haloLevel === "number")
      ? info.haloLevel.toFixed(4) + "  (whisper cap 0.07)"
      : "—";

    elBudget.textContent = info.budget
      ? info.budget.voices + "/" + info.budget.max + " voices, " + info.budget.nodes + " nodes"
      : "—";
  }

  function startMonitor() {
    if (monitorId == null) monitorId = setInterval(pollMonitor, POLL_MS);
  }

  // ------------------------------------------------------------------------
  // Engine plumbing: one facade, created on first Play. A changed seed goes
  // through reseed() (a hard cut by design — reproducibility over grace on a
  // dev bench); the facade restarts itself if it was mid-evening.
  // ------------------------------------------------------------------------
  function ensureEngine() {
    var s = readSeed();
    if (!engine) {
      engine = PJ2.Library.create({ seed: s, volume: readVol() });
      engine.setEventListener(onEvent);
      engineSeed = s;
    } else if (s !== engineSeed) {
      engineSeed = s;
      engine.reseed(s);
    }
    return engine;
  }

  elPlay.addEventListener("click", function () {
    var e = ensureEngine();
    e.setMasterVolume(readVol());
    e.play();
    startMonitor();
  });

  elStop.addEventListener("click", function () {
    if (engine) engine.stop(); // 1.5s fade; the monitor shows the budget drain
  });

  elVol.addEventListener("input", function () {
    var v = readVol();
    elVolOut.textContent = v.toFixed(2);
    if (engine) engine.setMasterVolume(v);
  });

  // Prefill the seed from ?seed= so a shared URL reproduces its evening even
  // though we always pass the input's value explicitly to create()/reseed().
  try {
    var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
    if (m) elSeed.value = String((+m[1]) >>> 0);
  } catch (e) { /* headless: no location */ }
})();
