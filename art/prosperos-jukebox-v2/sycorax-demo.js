// ============================================================================
// Prospero's Jukebox v2 — sycorax-demo.js (Sycorax-track dev-bench driver)
//
// The thinnest possible skin over the PJ2.Sycorax facade (form-demo.js's
// sibling, adapted to the rite's own telemetry): Play/Stop, a seed, a volume
// slider, a ~300ms getInfo() poll into a monitor table, and an event log fed
// by setEventListener. What a human wants to stare at while a rite unfolds:
//
//   - performance # + elapsed/planned — is the chaining seamless?
//   - tide label + position bar — how near does the menace circle?
//   - scene name + progress bar — the encirclement walked in order
//   - intensity meter — weather, not theater (band 0.04..0.65, no steps)
//   - pose — the pinned-i rotation (root never moves; the color does)
//   - motif — theme name + generation, developments/answers, ghost carried
//   - the air — holders + overlap count (this track responds, never duets)
//   - percussion — mode (heartbeat/walk/loose/clusters) + the walk period
//   - levels — noise vs gurdy (the 0.8× ceiling, visible) + grit blend
//   - the rite — bruise, cut state, sink state
//   - budget — the ceiling holds; it drains after Stop
//
// The log prints performance/scene/joint/tide lines plus the rite's own
// narration: THE CUT (with severity/dip/hold) and its return, the SINK
// (seachange), the ghost, the bruise, pose moves, darkening arrivals,
// organum, percussion walks/clusters, develops/answers — capped at 100 rows.
//
// House rules honored: no AudioContext until Play, DOM access is element
// lookup + listeners only, and the file evals headless (the element guard
// returns before wiring when there is no page under us).
// ============================================================================
(function () {
  "use strict";

  var LOG_KEEP = 100;
  var POLL_MS = 300;

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
  var elPose      = document.getElementById("pj2-pose");
  var elMotif     = document.getElementById("pj2-motif");
  var elAir       = document.getElementById("pj2-air");
  var elPerc      = document.getElementById("pj2-perc");
  var elLevels    = document.getElementById("pj2-levels");
  var elRite      = document.getElementById("pj2-rite");
  var elBudget    = document.getElementById("pj2-budget");
  var elLog       = document.getElementById("pj2-log");
  if (!elPlay || !elLog) return; // headless eval / partial page: nothing to drive

  // ---- engine state ---------------------------------------------------------
  var engine = null;
  var engineSeed = null;
  var monitorId = null;    // starts on first Play, never stops — watching the
                           // budget drain AFTER stop is the point
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

  // The engine narrates; we transcribe. Air claims, joint-gesture draws,
  // organum doubles and per-note percussion are monitor material, not log
  // material — they would bury the form lines this page exists to show.
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
      // ---- the rite's own narration -----------------------------------------
      case "cut":
        log(fmtT(e.t) + "  THE CUT — severity " + e.severity.toFixed(2) + ", dip to " +
          e.dip.toFixed(3) + ", held " + e.holdS.toFixed(1) + "s, return " +
          e.returnS.toFixed(1) + "s (the hush is inhabited)");
        break;
      case "cut-return":
        log(fmtT(e.t) + "    the cut releases over " + e.returnS.toFixed(1) + "s");
        break;
      case "seachange":
        log(fmtT(e.t) + "  THE SINK — the rite resumes lower: tonic now " +
          (e.field ? (+e.field.tonicHz).toFixed(1) + " Hz" : "?") +
          (e.pivotDegs ? ", pivots [" + e.pivotDegs.join(",") + "]" : ""));
        break;
      case "ghost":
        log(fmtT(e.t) + "    ghost: “" + e.name + "” returns, half-remembered (" + e.voice + ")");
        break;
      case "bruise":
        log(fmtT(e.t) + "  bruise carried: " + e.value.toFixed(2) +
          (e.value > 0.5 ? " (the evening opens on the sting)" : ""));
        break;
      case "pose":
        log(fmtT(e.t) + "      pose -> " + e.pose + " (" + e.via + ")");
        break;
      case "arrival":
        log(fmtT(e.t) + "    arrival darkens (into " + e.to + ")");
        break;
      case "percussion":
        if (e.mode === "walk") {
          log(fmtT(e.t) + "    the walk begins — period " + e.periodS.toFixed(2) + "s (±20%)");
        } else if (e.mode === "cluster") {
          log(fmtT(e.t) + "    cluster: " + e.n + " strokes, accelerating");
        }
        break;
      case "develop":
        log(fmtT(e.t) + "      develop: " + e.name + " gen " + e.gen +
          (e.transform ? " via " + e.transform : "") + " (" + e.voice + ")");
        break;
      case "answer":
        log(fmtT(e.t) + "      answer: " + e.name + " gen " + e.gen + " (" + e.voice + ")");
        break;
      // "air", "joint-gesture", "organum" intentionally not logged — see above.
    }
  }

  // ------------------------------------------------------------------------
  // The monitor: ~300ms getInfo() poll. Every read guarded — a missing
  // field renders as a dash, not a broken monitor.
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
    elScene.textContent = info.sceneType
      ? info.sceneType + (info.activity ? " · " + info.activity : "") +
        "  (" + (info.sceneIdx + 1) + "/" + info.sceneCount + ")"
      : "—";

    var iv = (typeof info.intensity === "number") ? clamp01(info.intensity) : null;
    elIntFill.style.width = (iv == null ? 0 : Math.round(iv * 100)) + "%";
    elInt.textContent = iv == null ? "—" : iv.toFixed(3);

    elPose.textContent = info.pose
      ? info.pose + " (root pinned to i" +
        (typeof info.tonicHz === "number" ? ", tonic " + info.tonicHz.toFixed(1) + " Hz" : "") + ")"
      : "—";

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

    var pc = info.percussion;
    elPerc.textContent = pc
      ? pc.mode + (pc.mode === "walk" && pc.walkPeriodS ? " · period " + pc.walkPeriodS.toFixed(2) + "s" : "")
      : "—";

    var lv = info.levels;
    if (lv) {
      var ratio = lv.gurdy > 0 ? (lv.noise / lv.gurdy) : 0;
      elLevels.textContent = "gurdy " + lv.gurdy.toFixed(3) +
        " · noise " + lv.noise.toFixed(3) + " (" + ratio.toFixed(2) + "× ≤ 0.8) · grit " +
        lv.grit.toFixed(3) + " (cap 0.5)";
    } else {
      elLevels.textContent = "—";
    }

    var cut = info.cut || {};
    var sink = info.sink || {};
    elRite.textContent = "bruise " + (typeof info.bruise === "number" ? info.bruise.toFixed(2) : "—") +
      " · cut " + (cut.active ? "ACTIVE" : (cut.fired ? "spent" : (cut.planned ? "planned" : "—"))) +
      (cut.planned ? " (sev " + cut.severity.toFixed(2) + ")" : "") +
      " · sink " + (sink.done ? "DONE" : (sink.planned ? "planned" : "—"));

    elBudget.textContent = info.budget
      ? info.budget.voices + "/" + info.budget.max + " voices, " + info.budget.nodes + " nodes"
      : "—";
  }

  function startMonitor() {
    if (monitorId == null) monitorId = setInterval(pollMonitor, POLL_MS);
  }

  // ------------------------------------------------------------------------
  // Engine plumbing: one facade, created on first Play. A changed seed goes
  // through reseed() (a hard cut by design — reproducibility over grace on
  // a dev bench); the facade restarts itself if it was mid-evening.
  // ------------------------------------------------------------------------
  function ensureEngine() {
    var s = readSeed();
    if (!engine) {
      engine = PJ2.Sycorax.create({ seed: s, volume: readVol() });
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

  // Prefill the seed from ?seed= so a shared URL reproduces its evening.
  try {
    var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
    if (m) elSeed.value = String((+m[1]) >>> 0);
  } catch (e) { /* headless: no location */ }
})();
