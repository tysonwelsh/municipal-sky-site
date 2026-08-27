// ============================================================================
// Prospero's Jukebox v2 — substrate-demo.js (Phase 0 smoke test driver)
//
// This is the first time the four Phase 0 modules play together, and its ONLY
// job is to prove the substrate's promises audibly:
//
//   1. THE CLOCK KEEPS ITS WORD — every melody note logs its lookahead margin
//      (scheduled t minus ctx.currentTime at the moment the callback ran).
//      With aheadS=0.25 those margins should sit comfortably positive; if you
//      ever see them go negative the transport is late and we want to know
//      on THIS page, not three phases from now inside a fugue.
//   2. MODULATION DOESN'T RETUNE THE PAST — "modulate ↑4" moves the field's
//      tonic up a fourth. A 12-second drone that started before the click
//      keeps ringing at its old pitches while new notes arrive in the new
//      key (kolob's straddle lesson, the whole reason PitchField exists).
//      We re-query the field for every note, so the change needs no plumbing.
//   3. THE BUDGET THINS GRACEFULLY — every note claims a voice; when refused
//      the note is silently skipped and a counter ticks. No throw, no steal.
//   4. LANE RATE BENDS LIVE — the slider writes melLane.rate mid-flight and
//      the pending notes rescale proportionally.
//
// The patches are deliberately dumb (a sine dyad, a triangle pluck). This is
// a substrate test, not music — resist the urge to make it pretty.
//
// House rules honored: everything lazy-inits inside start() (no top-level
// AudioContext), the only DOM access is element lookup + listeners, and the
// whole file evals headless under the harness's mocked window/document.
// ============================================================================
(function () {
  "use strict";

  // Tonics matching v1's three worlds: Library C4 (262), Sycorax Eb4 (311),
  // Ariel F4 (349) — the roots its frozen Hz tables were built on.
  var TONICS = { dorian: 262, sycorax: 311, lydian: 349 };

  var MAX_VOICES = 24;       // budget ceiling, spec §6
  var LOG_KEEP = 60;         // telemetry lines kept in the <pre>

  // ---- DOM (this script loads at the end of the body; everything exists) --
  var elPlay    = document.getElementById("pj2-play");
  var elStop    = document.getElementById("pj2-stop");
  var elSeed    = document.getElementById("pj2-seed");
  var elMode    = document.getElementById("pj2-mode");
  var elMod     = document.getElementById("pj2-modulate");
  var elRate    = document.getElementById("pj2-rate");
  var elRateOut = document.getElementById("pj2-rate-out");
  var elLog     = document.getElementById("log");

  // ---- engine state, all null until Play -------------------------------
  var ctx = null;            // ONE AudioContext for the page, reused across
                             // Play/Stop via suspend/resume (browsers cap
                             // how many you may create; closing loses the
                             // user-gesture unlock on iOS)
  var bus = null, room = null, pool = null;
  var clock = null, budget = null, field = null;
  var melLane = null, droneLane = null;
  var playing = false;
  var refusals = 0, noteCount = 0;
  var logLines = [];

  // ------------------------------------------------------------------------
  // telemetry log: <pre> + console, ring-buffered so an hour of notes
  // doesn't grow the DOM without bound.
  // ------------------------------------------------------------------------
  function log(line) {
    logLines.push(line);
    if (logLines.length > LOG_KEEP) logLines.shift();
    elLog.textContent = logLines.join("\n");
    if (typeof console !== "undefined" && console.log) console.log("[pj2-demo] " + line);
  }

  function currentRate() {
    var v = parseFloat(elRate.value);
    return (isFinite(v) && v > 0) ? v : 1;
  }

  // ------------------------------------------------------------------------
  // DRONE — a soft two-oscillator dyad: the tonic an octave down, plus the
  // nearest scale tone to a pure fifth above it ("fifth-ish": in dorian and
  // lydian that IS the fifth; in sycorax the field decides what haunts that
  // slot). ~12s long on a ~10s cycle, so consecutive drones crossfade
  // through their slow attack/release skirts.
  //
  // The field is queried AT FIRE TIME: a drone born after a modulation
  // speaks the new key; one born before keeps ringing in the old one. The
  // overlap window is exactly where you HEAR promise #2.
  // ------------------------------------------------------------------------
  function playDrone(t, rand) {
    var durS = 12;
    var token = budget.claim(3, t + durS + 0.1);
    if (!token) { refusals++; return; }              // thinning, not throwing

    var f0 = field.degFreq(0, -1);
    var f1 = field.snap(f0 * 1.5);                   // fifth-ish, mode-agnostic

    var g = ctx.createGain();
    // Slow skirts: 3.5s in, 4s out. peak 0.13 keeps two overlapped drones
    // (plus the melody) well under the glue compressor's working range.
    PJ2.Voice.adsr(g.gain, t, { a: 3.5, d: 0.5, s: 0.85, r: 4, peak: 0.13, durS: durS });
    g.connect(pool.at(0));                           // centre seat of the room

    var oscA = ctx.createOscillator();
    var oscB = ctx.createOscillator();
    oscA.type = "sine";
    oscB.type = "sine";
    oscA.frequency.setValueAtTime(f0, t);            // set once, never rewritten:
    oscB.frequency.setValueAtTime(f1, t);            // modulation can't touch us
    oscA.connect(g);
    oscB.connect(g);
    oscA.start(t);
    oscB.start(t);
    oscA.stop(t + durS + 0.05);                      // just past the envelope's
    oscB.stop(t + durS + 0.05);                      // true-zero landing

    log("drone  " + f0.toFixed(1) + "+" + f1.toFixed(1) + "Hz  t=" + t.toFixed(3) +
        "  (" + field.mode + " @ " + field.tonicHz.toFixed(1) + ")");
  }

  // ------------------------------------------------------------------------
  // PLUCK — the melody voice: one triangle through a sharp adsr, ~0.8s.
  // Simple on purpose; the interesting part is the numbers we log around it.
  // ------------------------------------------------------------------------
  function playPluck(t, freq, pan) {
    var durS = 0.8;
    var token = budget.claim(2, t + durS + 0.1);
    if (!token) {
      refusals++;
      log("mel    SKIPPED (budget full, " + budget.active() + "/" + MAX_VOICES +
          ")  refusals=" + refusals);
      return;
    }

    var osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);           // set once — see drone note

    var g = ctx.createGain();
    // Sharp attack, quick decay to a low sustain, gentle tail landing at
    // true zero (lesson #3 in pj2-voice.js — the release IS the click guard).
    PJ2.Voice.adsr(g.gain, t, { a: 0.005, d: 0.12, s: 0.25, r: 0.35, peak: 0.22, durS: durS });

    osc.connect(g);
    g.connect(pool.at(pan));                         // nearest pooled seat
    osc.start(t);
    osc.stop(t + durS + 0.05);

    noteCount++;
    // THE telemetry line: scheduled t vs the audio clock at this very call.
    // margin ≈ how far ahead of realtime the transport is thinking.
    var margin = t - ctx.currentTime;
    log("mel #" + noteCount + "  " + freq.toFixed(1) + "Hz  t=" + t.toFixed(3) +
        "  now=" + ctx.currentTime.toFixed(3) +
        "  margin=" + (margin >= 0 ? "+" : "") + (margin * 1000).toFixed(0) + "ms" +
        "  refusals=" + refusals);
  }

  // ------------------------------------------------------------------------
  // Play: lazily build the whole graph, fork the streams, arm two lanes.
  // ------------------------------------------------------------------------
  function start() {
    if (playing) return;

    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      ctx.resume();
    }

    // Fresh graph every Play. The previous run's bus was faded to zero and
    // disconnected in stop(); on a dev bench, rebuilding beats untangling.
    bus = PJ2.Voice.buildBus(ctx, { title: "PJ2 substrate demo" });
    room = PJ2.Voice.reverb(ctx, { decayS: 3, preDelayS: 0.03, wet: 0.3, brightness: 1 });
    room.output.connect(bus.input);
    pool = PJ2.Voice.pannerPool(ctx, room.send, 3);  // 3 seats into the room

    var seed = parseInt(elSeed.value, 10);
    if (!isFinite(seed)) seed = 1;
    var modeName = elMode.value;
    field = PJ2.Pitch.field({ tonicHz: TONICS[modeName] || 262, mode: modeName });

    // One master stream; each lane forks its own so their draw counts can
    // never perturb each other (the whole point of PJ2.Rand.fork).
    var rand = PJ2.Rand.stream(seed);
    var droneRand = rand.fork("drone");
    var melRand = rand.fork("melody");

    clock = PJ2.Clock.create(ctx);
    budget = PJ2.Voice.budget(MAX_VOICES).bindClock(clock);

    refusals = 0;
    noteCount = 0;
    logLines = [];
    log("play  seed=" + seed + "  mode=" + modeName +
        "  tonic=" + field.tonicHz + "Hz  budget=" + MAX_VOICES + " voices");

    // ---- drone lane: ~10s cycle under 12s notes = overlapping crossfades
    droneLane = clock.lane("drone");
    droneLane.every(function (t) {
      playDrone(t, droneRand);
      return 10 + droneRand.rnd(-1, 1);              // ~10s, gently uneven
    });

    // ---- melody lane: seeded random walk over the field's 3-octave table.
    // The table is re-queried every note so modulation reaches the future
    // without touching the past. Same mode ⇒ same table length, so the walk
    // index survives the key change untranslated.
    melLane = clock.lane("melody");
    melLane.rate = currentRate();
    var walkIdx = Math.floor(field.table(-1, 1).length / 2) + melRand.rint(-3, 3);
    melLane.every(function (t) {
      var tbl = field.table(-1, 1);
      walkIdx += melRand.pick([-2, -1, -1, 1, 1, 2]);   // stepwise bias
      if (walkIdx < 0) walkIdx = -walkIdx;              // reflect at the edges
      if (walkIdx > tbl.length - 1) walkIdx = 2 * (tbl.length - 1) - walkIdx;
      playPluck(t, tbl[walkIdx].freq, melRand.rnd(-1, 1));
      return melRand.rnd(0.3, 1.2);                     // seeded, lane-rate-scaled
    });

    clock.start();
    playing = true;
  }

  // ------------------------------------------------------------------------
  // Stop: kill the transport (cancels ALL pending events), fade the master
  // to true zero over 0.3s, then suspend the context once the fade has
  // landed. Sounding oscillators all have scheduled stop() times, so they
  // die on their own; suspending just stops the meter running. Play() then
  // resumes the same context and builds a fresh graph.
  // ------------------------------------------------------------------------
  function stop() {
    if (!playing) return;
    playing = false;
    clock.stop();
    bus.fadeTo(0, 0.3);
    log("stop  (faded; " + noteCount + " notes, " + refusals + " refusals)");

    var deadBus = bus;
    window.setTimeout(function () {
      if (playing) return;                           // Play won the race — leave it be
      // Unhook the dead graph from the destination so successive runs don't
      // stack silent-but-alive chains, then park the context.
      try {
        if (deadBus && deadBus.output && typeof deadBus.output.disconnect === "function") {
          deadBus.output.disconnect();
        }
      } catch (e) {}
      if (ctx && ctx.state === "running" && typeof ctx.suspend === "function") {
        ctx.suspend();
      }
    }, 400);                                         // fade (300ms) + landing room
  }

  // ------------------------------------------------------------------------
  // Modulate ↑4: tonic up a perfect fourth (×4/3). Compounds on repeat
  // clicks — C→F→Bb→... — which is a feature: keep pressing and listen to
  // the drones straddle each boundary. Nothing else here retunes anything;
  // the proof is in what you DON'T hear (no pitch-bend lurch).
  // ------------------------------------------------------------------------
  elMod.addEventListener("click", function () {
    if (!field) { log("modulate: press Play first"); return; }
    var res = field.modulate({ tonicHz: field.tonicHz * 4 / 3 });
    log("MODULATE ↑4  tonic " + res.from.tonicHz.toFixed(1) + " → " +
        res.to.tonicHz.toFixed(1) + "Hz — sounding notes keep old pitch");
  });

  // Rate slider drives the melody lane LIVE — pending notes rescale
  // proportionally inside the clock (spec §3 .rate semantics).
  elRate.addEventListener("input", function () {
    var v = currentRate();
    elRateOut.textContent = v.toFixed(2) + "×";
    if (melLane) melLane.rate = v;
  });

  elPlay.addEventListener("click", start);
  elStop.addEventListener("click", stop);

  // Harness hook (dev bench only): lets the headless smoke test reach the
  // live objects to assert budget ceilings and lane rates. Not part of any
  // shipping surface.
  window.PJ2Demo = {
    _debug: function () {
      return {
        ctx: ctx, field: field, clock: clock, budget: budget,
        melLane: melLane, droneLane: droneLane,
        playing: playing, refusals: refusals, noteCount: noteCount
      };
    }
  };
})();
