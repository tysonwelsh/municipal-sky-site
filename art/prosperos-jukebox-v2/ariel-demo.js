// ============================================================================
// Prospero's Jukebox v2 — ariel-demo.js (Ariel form-monitor driver)
//
// The thinnest possible skin over the PJ2.Ariel facade (form-demo.js pattern,
// verbatim philosophy): Play/Stop, a seed, a volume slider, a ~300 ms
// getInfo() poll into a monitor table, and an event log fed by
// setEventListener. What a human wants to stare at while an Ariel evening
// flies:
//
//   - performance # + elapsed/planned — evenings are short (4–10 min); is
//     the chaining seamless, does the high tail ring over the new alighting?
//   - weather aloft (the tide): still-air → rising-thermals → gale → clearing
//   - scene + progress — the quick song/flight alternation, hover, swirl,
//     and the release's ascent
//   - intensity meter — reads as weather, band 0.04..0.65, swirl peaks 0.65
//   - harmony — the float: I and II should own the room, V should visit and
//     never insist, #iv° should NEVER appear as a root
//   - signature — the theme (or the PROMOTED ghost) + generations: is one
//     idea flying all evening?
//   - air/budget — turn-taking with flight clouds holding ONE claim each
//   - sky — weather channels, room balance (release ramps → 0.85), thin/halo
//
// The log prints performance/scene/joint/tide lines plus the narration:
// cadences (lift/float/up-half, with the rising-voicing flag), sea changes
// (always upward), the ghost (promoted or quiet), the reground (the seam's
// tonic reset), the release choreography, the feather, develops/answers.
//
// House rules: no AudioContext until Play; the only DOM access is element
// lookup + listeners; evals headless (the element guard returns first).
// ============================================================================
(function () {
  "use strict";

  var LOG_KEEP = 100;
  var POLL_MS = 300;

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
  var elSignature = document.getElementById("pj2-signature");
  var elAir       = document.getElementById("pj2-air");
  var elBudget    = document.getElementById("pj2-budget");
  var elSky       = document.getElementById("pj2-sky");
  var elLog       = document.getElementById("pj2-log");
  if (!elPlay || !elLog) return; // headless eval / partial page: nothing to drive

  var engine = null;
  var engineSeed = null;
  var monitorId = null; // starts on first Play, never stops — watching the
                        // budget drain AFTER stop is part of the point
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

  // The engine narrates; we transcribe. Air claims and joint-gesture
  // internals stay off the log (monitor material — they'd bury the form).
  function onEvent(e) {
    switch (e.type) {
      case "performance":
        if (e.phase === "begin") {
          log(fmtT(e.t) + "  EVENING #" + e.n + " begins — " + Math.round(e.durS) + "s, " +
            e.sceneCount + " scenes [" + e.scenes.join(" > ") + "], aloft: " + e.tideLabel +
            " (" + e.tidePos.toFixed(2) + "), chain overlap " + e.chainOverlapS.toFixed(1) + "s");
        } else {
          log(fmtT(e.t) + "  EVENING #" + e.n + " ends after " + Math.round(e.elapsedS) + "s");
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
        log(fmtT(e.t) + "  aloft -> " + e.label + " (pos " + e.pos.toFixed(2) + ", period " +
          e.periodPerfs.toFixed(1) + " evenings)");
        break;
      case "engine":
        log(fmtT(e.t) + "  engine: " + e.state + (e.seed != null ? " (seed " + e.seed + ")" : ""));
        break;
      // ---- the Ariel narration ------------------------------------------
      case "cadence":
        log(fmtT(e.t) + "    cadence (" + e.kind + "): " +
          (e.chords ? e.chords.join(" -> ") : "?") + ", " + e.from + " -> " + e.to +
          (e.arrivalAbove ? " — arrival voiced above" : ""));
        break;
      case "seachange":
        log(fmtT(e.t) + "  SEA CHANGE (" + (e.target ? e.target.kind : "?") +
          (e.target && e.target.toDeg != null ? " -> deg " + e.target.toDeg : "") + "): now " +
          (e.field ? e.field.mode + " on " + (+e.field.tonicHz).toFixed(1) + " Hz" : "?") +
          (e.pivotDegs ? ", pivots [" + e.pivotDegs.join(",") + "]" : ""));
        break;
      case "reground":
        log(fmtT(e.t) + "  REGROUND: the seam returns home — " +
          (e.from ? e.from.mode + " " + (+e.from.tonicHz).toFixed(1) + " Hz" : "?") + " -> " +
          (e.to ? e.to.mode + " " + (+e.to.tonicHz).toFixed(1) + " Hz" : "?") +
          " (the high tail rings on)");
        break;
      case "ghost":
        log(fmtT(e.t) + "    ghost: “" + e.name + "” returns" +
          (e.promoted ? " — PROMOTED: the same bird, new feathers" : ", half-remembered") +
          " (" + e.voice + ")");
        break;
      case "release":
        log(fmtT(e.t) + "    RELEASE (" + Math.round(e.durS) + "s): the idea climbs out — " +
          "room to the sky, echoes thinning upward, bass to speak last");
        break;
      case "feather":
        log(fmtT(e.t) + "    feather: last night's final note, one chime (deg " + e.deg + ")");
        break;
      case "develop":
        log(fmtT(e.t) + "      develop: " + e.name + " gen " + e.gen +
          (e.transform ? " via " + e.transform : "") + " (" + e.voice + ")");
        break;
      case "answer":
        log(fmtT(e.t) + "      answer: " + e.name + " gen " + e.gen + " (" + e.voice + ")");
        break;
      // "air", "joint-gesture", "bass-flourish" intentionally unlogged.
    }
  }

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

    elChord.textContent = (info.harmony || "—") +
      (info.tonicHz ? "  ·  " + info.mode + " on " + (+info.tonicHz).toFixed(1) + " Hz" : "");

    var sig = info.signature;
    var mo = info.motif;
    if (sig && sig.name) {
      elSignature.textContent = "“" + sig.name + "”" +
        (sig.promoted ? " (promoted ghost)" : "") +
        " · gen " + (sig.themeGen == null ? 0 : sig.themeGen) +
        " · deepest " + (sig.maxGen == null ? 0 : sig.maxGen) +
        (mo ? " · " + (mo.developments || 0) + " dev / " + (mo.answers || 0) + " ans" : "") +
        (mo && mo.ghostCarried ? " · ghost carried" : "");
    } else {
      elSignature.textContent = "—";
    }

    elAir.textContent = (info.airHolders == null ? "—" : info.airHolders + " holder(s)") +
      ", " + (info.airOverlaps || 0) + " overlap grant(s) total";

    elBudget.textContent = info.budget
      ? info.budget.voices + "/" + info.budget.max + " voices, " + info.budget.nodes + " nodes"
      : "—";

    var wx = info.weather;
    elSky.textContent = wx
      ? "gustiness " + (+wx.gustiness).toFixed(2) +
        " · altitude " + (+wx.altitude).toFixed(2) +
        " · shimmer " + (+wx.shimmer).toFixed(2) +
        " · thermals " + (+wx.thermals).toFixed(2) +
        " · room " + (info.roomBalance != null ? (+info.roomBalance).toFixed(2) : "?") +
        " · halo " + (info.haloLevel != null ? (+info.haloLevel).toFixed(3) : "?")
      : "—";
  }

  function startMonitor() {
    if (monitorId == null) monitorId = setInterval(pollMonitor, POLL_MS);
  }

  function ensureEngine() {
    var s = readSeed();
    if (!engine) {
      engine = PJ2.Ariel.create({ seed: s, volume: readVol() });
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
    if (engine) engine.stop(); // 1.5 s fade; the monitor shows the budget drain
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
