// ============================================================================
// PJ2.Fx — timbral air for Prospero's Jukebox v2 (Phase 3, module 1)
//
// Loads after pj2-voice.js, before pj2-air.js. Four independent tools that
// give the Library its sense of ROOM without ever touching the compositional
// machinery: a far-wall delay (the wall answers, it never "echoes"), a
// sympathetic-string halo (a family first — strings that ring because the
// harpsichord spoke, never because anyone plucked them), a pure weather field
// (the continuous modulator that replaces per-phrase parameter dice), and the
// room-blend crossfader that carries every layer between the close parlor
// and the wide hall as scenes turn.
//
// Everything here is LAZY (functions take a ctx, real or harness mock) and
// mock-guarded in pj2-voice.js's style: every AudioParam write goes through
// setP, every optional node type behind a typeof check or try/catch, so a
// recording mock that lacks PeriodicWave or BiquadFilter degrades instead of
// dying. No DOM, no wall clock, no top-level AudioContext.
//
// Randomness contract (the kolob-text lesson, strictly):
//   - Fx.weather CONSUMES ITS STREAM AT BUILD TIME ONLY — exactly four draws
//     per channel (phase1, phase2, detune1, detune2), in spec-key order.
//     at(t) is pure math thereafter; two same-seed builds agree forever.
//   - Fx.delay MAY take opts.rng and, if given, draws EXACTLY ONCE at build
//     for the drift LFO's starting phase — the draw happens whether or not
//     the ctx supports PeriodicWave, so the stream advances identically under
//     mock and browser (the fallback loses the phase, never the determinism).
//   - Fx.sympathetic and Fx.roomBlend consume no randomness at all.
//   - No Math.random anywhere in this file: nothing here is texture — even
//     the drift phase is musical state that must replay from the seed.
//
// DSP lessons, in the family tradition:
//   1. FEEDBACK LOOPS ARE GAIN BUDGETS, NOT VIBES. The worst-case loop gain
//      of delay→lowpass→feedbackGain is feedback × max|H(f)| of the filter.
//      A biquad lowpass is only ≤ unity across its whole passband when
//      Q ≤ 1/√2 (at the default Q=1 it PEAKS ~+1.25 dB near cutoff, i.e.
//      ×1.155 — a 0.9 "feedback" would really loop at 1.04 and run away).
//      We pin Q = 0.5 in every loop here, so max|H| = 1 exactly at DC and
//      the printed feedback number IS the loop gain. See each cap below.
//   2. ANY WebAudio FEEDBACK CYCLE GAINS AN IMPLICIT RENDER-QUANTUM DELAY
//      (128 samples ≈ 2.7 ms @48k). The sympathetic combs therefore ring
//      slightly FLAT of 1/delayTime, more so for high strings. We still set
//      delayTime = 1/f (the spec'd contract) and accept the offset: the halo
//      is never excited directly and sits at whisper level — the detune reads
//      as duplex scaling on an old piano, not as a wrong note. (Exact tuning
//      would set 1/f − 128/sr, which goes negative above ~370 Hz anyway.)
//   3. LINEAR CROSSFADES SAG. Ramping two gains linearly from (1,0) to (0,1)
//      passes through (0.5,0.5) = −3 dB total power at the midpoint — the
//      room would audibly duck every time it morphed. Equal-power means
//      walking the quarter circle (cos θ, sin θ); since AudioParams only ramp
//      in straight lines, roomBlend subdivides each move into short chords of
//      that circle (8 segments sag < 0.05 dB — below anyone's threshold,
//      and each chord is an ANCHORED linear ramp, so it is also click-safe).
//   4. RAMPS FROM WHEREVER-THE-PARAM-WAS CLICK. Same as pj2-voice lesson #3:
//      every fade here cancels, re-anchors at the current value, then ramps.
// ============================================================================
(function () {
  "use strict";

  window.PJ2 = window.PJ2 || {};
  var Fx = window.PJ2.Fx = {};

  // --------------------------------------------------------------------------
  // Helpers — identical spirit to pj2-voice.js: a mock that only records (or
  // lacks a param entirely) must never crash us.
  // --------------------------------------------------------------------------
  function setP(param, v, t) {
    if (!param) return;
    if (typeof param.setValueAtTime === "function") param.setValueAtTime(v, t || 0);
    else param.value = v;
  }
  function now(ctx) {
    return (ctx && typeof ctx.currentTime === "number") ? ctx.currentTime : 0;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Anchored fade (pj2-voice fadeTo pattern): cancel pending automation,
  // re-anchor at the CURRENT value, then linear-ramp to the target. `from`
  // falls back when the mock exposes no live .value.
  function anchorTo(param, t, fallbackFrom) {
    if (!param) return fallbackFrom;
    var from = (typeof param.value === "number") ? param.value : fallbackFrom;
    if (typeof param.cancelScheduledValues === "function") param.cancelScheduledValues(t);
    setP(param, from, t);
    return from;
  }
  function rampTo(param, v, t) {
    if (!param) return;
    if (typeof param.linearRampToValueAtTime === "function") param.linearRampToValueAtTime(v, t);
    else param.value = v;
  }

  // ==========================================================================
  // Fx.delay — the far wall.
  //
  //   send → delay → [thin highpass] → lowpass(damp, Q .5) → feedbackGain → delay
  //                                           └────────────→ wetGain(wet) → output
  //
  // A slow sine LFO (driftHz ~0.02–0.06) wanders delayTime by driftDepth —
  // tape-adjacent wow, never rhythmic. If opts.rng (a PJ2.Rand stream) is
  // passed, ONE draw at build seeds the LFO's phase via a single-partial
  // PeriodicWave (sin(ωt+φ) = sinφ·cos + cosφ·sin); without PeriodicWave
  // support (harness mock) we fall back to a plain sine — the draw is taken
  // regardless, so the stream's downstream sequence never depends on the ctx.
  //
  // HARD CAPS (clamped, never thrown — graceful thinning philosophy):
  //   feedback ≤ 0.55 — with Q pinned at 0.5 the passband gain is ≤ 1, so
  //     0.55 IS the worst-case loop gain: every round trip loses ≥ 5.2 dB,
  //     −60 dB in 12 trips ≈ 5 s at the default 0.42 s line. Even if an
  //     implementation's filter misbehaved by a full +1 dB the loop would sit
  //     at 0.62 — nowhere near runaway. Musically it is the real cap: past
  //     ~0.55 the third answer is as loud as conversation, and the owner rule
  //     is "the far wall answers," never "echo effect."
  //   wet ≤ 0.4 — the repeat may never rival the voice; Library runs 0.18.
  //   driftDepth ≤ 0.01 s — delayTime slew is the pitch bend: max detune ≈
  //     depth·2π·driftHz = 0.01·2π·0.06 ≈ 0.38% ≈ 6.5 cents. Tape wow,
  //     below the vibrato threshold; more would read as a chorus effect.
  //
  // Far-wall Library defaults (owner-tuned, documented per spec):
  //   timeS 0.42, feedback 0.22, damp 1600, driftHz 0.03, driftDepth 0.004,
  //   wet 0.18 at the send.
  //
  // THE "THIN" OPTION (additive; PLAN-ARIEL §5 — Ariel's ascending echoes).
  //   opts.thin = { hz, maxHz }   (or true for both defaults)
  //     hz     starting cutoff, default 320, clamped [40, 4000]
  //     maxHz  the cutoff's hard ceiling, default 2400, clamped [hz, 6000]
  //   Inserts ONE highpass (Q pinned 0.5, same loop-gain honesty as the
  //   lowpass — |H| ≤ 1 everywhere, so the feedback cap stays the true loop
  //   gain) INSIDE the feedback loop, ahead of the damping lowpass. Because
  //   it sits in the LOOP, its effect COMPOUNDS PER PASS: the first answer
  //   is thinned once, the second twice, the third three times — every
  //   repeat is lighter than the last, echoes that ASCEND as they recede.
  //   The wet tap is post-filter (unchanged), so even the first answer wears
  //   the character.
  //     handle.setThin(targetHz, rampS)
  //   re-aims the cutoff with an ANCHORED linear ramp (never setTargetAtTime
  //   on a filter mid-note — the bardo lesson; anchored ramps are the
  //   sanctioned move). Target clamps to [40, maxHz]; rampS floors at 0.05 s.
  //   Ariel rides this through its release scene (cutoff climbs as the music
  //   climbs out of register) and re-anchors it low at the evening seam.
  //   setThin without opts.thin is a harmless no-op — callers needn't branch.
  //   WITHOUT opts.thin the graph, the draws and every param write are
  //   byte-identical to the pre-thin build (verified by graph capture) —
  //   nobody who didn't ask pays anything.
  // ==========================================================================
  Fx.delay = function (ctx, opts) {
    opts = opts || {};
    var timeS = clamp((opts.timeS != null) ? opts.timeS : 0.42, 0.02, 2.0);
    var feedback = clamp((opts.feedback != null) ? opts.feedback : 0.22, 0, 0.55);
    var damp = clamp((opts.damp != null) ? opts.damp : 1600, 200, 12000);
    var driftHz = clamp((opts.driftHz != null) ? opts.driftHz : 0.03, 0.005, 0.12);
    var driftDepth = clamp((opts.driftDepth != null) ? opts.driftDepth : 0.004, 0, 0.01);
    var wet = clamp((opts.wet != null) ? opts.wet : 0.18, 0, 0.4);
    // The thin option's own hard caps (see header): resolved up front so the
    // clamped figures are the single truth for both build and setThin.
    var thinSpec = opts.thin || null;
    var thinHp = null; // assigned in the build below when thin was asked for
    var thinHz = 0, thinMaxHz = 0;
    if (thinSpec) {
      thinHz = clamp((thinSpec.hz != null) ? thinSpec.hz : 320, 40, 4000);
      thinMaxHz = clamp((thinSpec.maxHz != null) ? thinSpec.maxHz : 2400, thinHz, 6000);
    }

    // The one optional seeded draw — ALWAYS taken when a stream is passed
    // (see randomness contract in the header).
    var phase = 0;
    if (opts.rng && typeof opts.rng.next === "function") {
      phase = opts.rng.next() * Math.PI * 2;
    }

    var t0 = now(ctx);
    var send = ctx.createGain();
    var output = ctx.createGain();
    var wetGain = ctx.createGain();
    setP(send.gain, 1, t0);
    setP(output.gain, 1, t0);
    setP(wetGain.gain, wet, t0);

    try {
      // maxDelay leaves room for the full drift excursion in BOTH directions
      // plus margin — a DelayNode clips modulation at its maxDelay, and a
      // clipped LFO is a sawtooth, which zippers.
      var delay = ctx.createDelay(Math.max(1, timeS + 2 * 0.01 + 0.05));
      setP(delay.delayTime, timeS, t0);

      var fbGain = ctx.createGain();
      setP(fbGain.gain, feedback, t0);

      var tail = delay; // where the loop is tapped from (post-filter if we have one)
      if (thinSpec && typeof ctx.createBiquadFilter === "function") {
        // The thin highpass lives INSIDE the loop, ahead of the damping
        // lowpass — each circulation sheds more low end than the last, which
        // is the whole ascending-echo thesis (header, THE "THIN" OPTION).
        thinHp = ctx.createBiquadFilter();
        try { thinHp.type = "highpass"; } catch (eT) {}
        setP(thinHp.frequency, thinHz, t0);
        setP(thinHp.Q, 0.5, t0); // |H| ≤ 1: the feedback cap stays honest
        delay.connect(thinHp);
        tail = thinHp;
      }
      if (typeof ctx.createBiquadFilter === "function") {
        var lp = ctx.createBiquadFilter();
        try { lp.type = "lowpass"; } catch (e0) {}
        setP(lp.frequency, damp, t0);
        // Q = 0.5, NOT the default 1: over-damped ⇒ |H| ≤ 1 everywhere, so
        // the feedback cap is the true loop gain (header lesson #1).
        setP(lp.Q, 0.5, t0);
        tail.connect(lp);
        tail = lp;
      }
      send.connect(delay);
      tail.connect(fbGain);
      fbGain.connect(delay);
      tail.connect(wetGain);
      wetGain.connect(output);

      // Drift LFO. Guarded to the teeth: a lean mock may lack oscillators,
      // PeriodicWave, or param-input connect — every rung degrades.
      if (driftDepth > 0 && typeof ctx.createOscillator === "function") {
        try {
          var lfo = ctx.createOscillator();
          var phased = false;
          try {
            if (phase !== 0 &&
                typeof ctx.createPeriodicWave === "function" &&
                typeof lfo.setPeriodicWave === "function" &&
                typeof Float32Array !== "undefined") {
              // Partial 1 only: real (cos) = sinφ, imag (sin) = cosφ gives
              // sin(2π·driftHz·t + φ). Normalization keeps it unit amplitude.
              var real = new Float32Array([0, Math.sin(phase)]);
              var imag = new Float32Array([0, Math.cos(phase)]);
              lfo.setPeriodicWave(ctx.createPeriodicWave(real, imag));
              phased = true;
            }
          } catch (e1) { phased = false; }
          if (!phased) { try { lfo.type = "sine"; } catch (e2) {} }
          setP(lfo.frequency, driftHz, t0);
          var driftGain = ctx.createGain();
          setP(driftGain.gain, driftDepth, t0);
          lfo.connect(driftGain);
          try { driftGain.connect(delay.delayTime); } catch (e3) {}
          if (typeof lfo.start === "function") lfo.start(t0);
        } catch (e4) {}
      }
    } catch (e) {
      // No DelayNode at all (very lean mock): degrade to a quiet pass-through
      // at the wet level rather than dying — pj2-voice reverb fallback spirit.
      send.connect(wetGain);
      wetGain.connect(output);
    }

    return {
      send: send,
      output: output,
      setWet: function (v, rampS) {
        var target = clamp(v, 0, 0.4); // hard cap holds at runtime too
        var t = now(ctx);
        if (rampS) {
          anchorTo(wetGain.gain, t, wet);
          rampTo(wetGain.gain, target, t + rampS);
        } else {
          setP(wetGain.gain, target, t);
        }
        wet = target;
      },
      // The thin loop filter, exposed for telemetry/harness (null when the
      // option was not requested or the ctx has no BiquadFilter).
      thin: thinHp,
      // Re-aim the thin cutoff — anchored linear ramp, hard-capped to
      // [40, maxHz] (see header). No-op without opts.thin, so callers that
      // sometimes build plain delays never need to branch.
      setThin: function (targetHz, rampS) {
        if (!thinHp) return;
        var target = clamp(targetHz, 40, thinMaxHz);
        var t = now(ctx);
        var r = Math.max(0.05, rampS || 0); // even "instant" moves ramp — house rule
        anchorTo(thinHp.frequency, t, thinHz);
        rampTo(thinHp.frequency, target, t + r);
        thinHz = target;
      },
    };
  };

  // ==========================================================================
  // Fx.sympathetic — the halo. A bank of Karplus-style ringing strings:
  //
  //   input ─┬→ delay(1/f₀) → lowpass(damp, Q .5) ─┬→ fbGain(≤.97) → delay
  //          │                                     └→ bankSum
  //          └→ ... (one comb per string) ...
  //   bankSum → fadeGain(1) → levelGain(level) → out
  //
  // NEVER excited directly — the caller routes a small send from the exciter
  // (the pluck) into .input, and the strings whose partials it grazes wake
  // and hum. Summed level defaults to 0.05 (whisper: six strings ringing at
  // once must still sit under the room tone); setLevel clamps at 0.3.
  //
  // FEEDBACK CAP 0.97, hard: with Q pinned at 0.5 the comb's loop gain equals
  // the feedback value (header lesson #1), so 0.97 rings T60 ≈
  // ln(0.001)/ln(0.97) ≈ 227 round trips — for a 220 Hz string (4.5 ms line)
  // about one second of audible hang, exactly a sympathetic string's breath.
  // At 1.0 the comb is a perfect oscillator and the halo becomes a drone that
  // never decays; anything ≥ ~0.98 hangs so long it reads as an added voice,
  // which the air protocol would never have granted. Clamped, never thrown.
  //
  // RETUNE IS GLITCH-FREE BY CONSTRUCTION: jumping a DelayNode's delayTime
  // while its loop carries signal splices the buffer read head — a click,
  // then a wrong-pitch smear as the old tail circulates at the new period.
  // So retune(freqs) fades the bank OUTPUT to zero over 0.3 s (anchored
  // ramp), swaps every delayTime at the bottom with setValueAtTime (the loop
  // still glitches internally — but into a closed fader), then fades back
  // over 0.3 s, unveiling the bank already ringing at the new tuning. The
  // loops themselves are never interrupted. Callers retune ONLY when the
  // dramaturgy says so (first scene boundary after a sea change).
  // ==========================================================================
  Fx.sympathetic = function (ctx, opts) {
    opts = opts || {};
    var n = (opts.nStrings != null) ? opts.nStrings
          : (opts.freqs ? opts.freqs.length : 6);
    n = clamp(Math.floor(n), 1, 12); // node budget: each string is 3 nodes
    // Default tuning is a neutral overtone fan off 110 Hz (partials 2..n+1);
    // real callers always retune to field degrees — this just guarantees the
    // bank is never born with delayTime 0 (a zero-length feedback comb is a
    // DC amplifier).
    var freqs = opts.freqs;
    if (!freqs || !freqs.length) {
      freqs = [];
      for (var k = 0; k < n; k++) freqs.push(110 * (k + 2));
    }
    var damp = clamp((opts.damp != null) ? opts.damp : 3000, 500, 8000);
    var fb = clamp((opts.feedback != null) ? opts.feedback : 0.95, 0, 0.97);
    var level = clamp((opts.level != null) ? opts.level : 0.05, 0, 0.3);
    var FADE_S = 0.3;

    function periodOf(f) {
      // delayTime = 1/f, clamped into the node's legal range. Floor of 1 Hz
      // keeps 1/f ≤ 1 (our maxDelay); ceiling keeps silly-high freqs from
      // asking for sub-sample lines. See header lesson #2 for why the true
      // ring lands ~128/sr flat of this and why we accept it.
      return clamp(1 / clamp(f, 1, 8000), 1 / 8000, 1.0);
    }

    var t0 = now(ctx);
    var input = ctx.createGain();
    var bankSum = ctx.createGain();
    var fadeGain = ctx.createGain();
    var levelGain = ctx.createGain();
    setP(input.gain, 1, t0);
    setP(bankSum.gain, 1, t0);
    setP(fadeGain.gain, 1, t0);
    setP(levelGain.gain, level, t0);
    bankSum.connect(fadeGain);
    fadeGain.connect(levelGain);
    if (opts.out) {
      try { levelGain.connect(opts.out); } catch (eo) {}
    }

    var strings = [];
    for (var i = 0; i < n; i++) {
      var f = freqs[i % freqs.length];
      try {
        var d = ctx.createDelay(1.0);
        setP(d.delayTime, periodOf(f), t0);
        var g = ctx.createGain();
        setP(g.gain, fb, t0);
        var tail = d;
        var lp = null;
        if (typeof ctx.createBiquadFilter === "function") {
          lp = ctx.createBiquadFilter();
          try { lp.type = "lowpass"; } catch (e0) {}
          setP(lp.frequency, damp, t0);
          setP(lp.Q, 0.5, t0); // loop-gain honesty again (lesson #1)
          d.connect(lp);
          tail = lp;
        }
        input.connect(d);
        tail.connect(g);
        g.connect(d);
        tail.connect(bankSum);
        strings.push({ delay: d, lp: lp, fb: g, freq: f });
      } catch (e) {
        // A ctx without DelayNode: the bank silently has fewer (or zero)
        // strings; input/output plumbing above still stands.
      }
    }

    return {
      input: input,
      output: levelGain, // exposed so callers without opts.out can route later
      strings: strings,  // [{delay, lp, fb, freq}] — telemetry / harness

      retune: function (newFreqs) {
        if (!newFreqs || !newFreqs.length) return;
        var t = now(ctx);
        var g = fadeGain.gain;
        var from = anchorTo(g, t, 1);
        rampTo(g, 0, t + FADE_S); // fade down — anchored above
        for (var s = 0; s < strings.length; s++) {
          var nf = newFreqs[s % newFreqs.length];
          strings[s].freq = nf;
          // The swap happens exactly at the fade's bottom: setValueAtTime is
          // its own anchor, and the fader is closed while the splice smears.
          setP(strings[s].delay.delayTime, periodOf(nf), t + FADE_S);
        }
        rampTo(g, from, t + 2 * FADE_S); // fade back — unveils the new tuning
      },

      setLevel: function (v, rampS) {
        var target = clamp(v, 0, 0.3);
        var t = now(ctx);
        if (rampS) {
          anchorTo(levelGain.gain, t, level);
          rampTo(levelGain.gain, target, t + rampS);
        } else {
          setP(levelGain.gain, target, t);
        }
        level = target;
      },
    };
  };

  // ==========================================================================
  // Fx.weather — the continuous modulator field. PURE: no audio nodes, no
  // clock, no state after build. Replaces per-phrase parameter dice with
  // slow deterministic weather the whole engine reads at schedule time.
  //
  // Each named channel is two slow sines around 0.5:
  //
  //   value(t) = 0.5 + depth · ( sin(2πt/p₁′ + φ₁) + sin(2πt/p₂′ + φ₂) ) / 2
  //
  // with seeded phases φ and periods detuned upward by a seeded 0.5–4.5%
  // (p′ = p·(1+δ)). Give the two periods coprime-ish values (the shipped
  // Library spec uses primes) and the channel's true repeat is p₁′·p₂′/gcd —
  // hours; with the irrational-ish detune on top it never audibly loops.
  // Four draws per channel at build, in spec-key order — the determinism
  // contract (see header). depth clamps to 0.5 so the range is [0,1] BY
  // CONSTRUCTION (0.5 ± depth); we clamp the output too, but it never bites.
  //
  // SMOOTHNESS BOUND (documented per spec): the derivative of the channel is
  // bounded by depth·(2π/p₁′ + 2π/p₂′)/2 = depth·π·(1/p₁′ + 1/p₂′). Periods
  // clamp to ≥ 120 s BEFORE the upward-only detune, and depth ≤ 0.5, so the
  // universal worst case is 0.5·π·(2/120) = π/120 ≈ 0.0262 per second. Any
  // 1 s sample step moves a channel by at most |Δ| ≤ 0.0262 — and per
  // channel, ≤ depth·π·(1/p₁′ + 1/p₂′), exposed as .bound(name) so the
  // harness asserts the exact figure, not the ceiling.
  // ==========================================================================

  // The Library's channels (spec §Fx.weather): periods are PRIMES in the
  // 120–600 s band (pairwise coprime by construction), depths sized to how
  // much each parameter may breathe. Callers pass their own spec to
  // Fx.weather; this constant is the Library's, importable by pj2-library.
  Fx.WEATHER_LIBRARY = {
    brightness: { period1: 331, period2: 487, depth: 0.42 }, // filter cutoffs, harmonic mix
    breath:     { period1: 211, period2: 389, depth: 0.38 }, // hum vowel openness, vibrato
    gapMul:     { period1: 173, period2: 443, depth: 0.35 }, // phrase/ambient gap scaling
    wetTilt:    { period1: 257, period2: 521, depth: 0.45 }, // room balance nudge, rain gate
    haloLevel:  { period1: 149, period2: 569, depth: 0.5  }, // sympathetic bank level
  };

  Fx.weather = function (rng, spec) {
    spec = spec || Fx.WEATHER_LIBRARY;
    var names = [];
    var chans = {};
    for (var name in spec) {
      if (!Object.prototype.hasOwnProperty.call(spec, name)) continue;
      var c = spec[name] || {};
      var p1 = clamp((c.period1 != null) ? c.period1 : 300, 120, 3600);
      var p2 = clamp((c.period2 != null) ? c.period2 : 420, 120, 3600);
      var depth = clamp((c.depth != null) ? c.depth : 0.4, 0, 0.5);
      // The four draws, always in this order — adding/removing/reordering
      // ANY draw here is a breaking change to every seeded performance.
      var ph1 = rng.next() * Math.PI * 2;
      var ph2 = rng.next() * Math.PI * 2;
      var d1 = 1 + 0.005 + rng.next() * 0.04; // upward-only detune keeps the
      var d2 = 1 + 0.005 + rng.next() * 0.04; // period floor (and the bound)
      chans[name] = {
        w1: (2 * Math.PI) / (p1 * d1),
        w2: (2 * Math.PI) / (p2 * d2),
        ph1: ph1,
        ph2: ph2,
        depth: depth,
      };
      names.push(name);
    }

    return {
      names: names,
      at: function (t) {
        var out = {};
        for (var i = 0; i < names.length; i++) {
          var ch = chans[names[i]];
          var v = 0.5 + ch.depth *
            (Math.sin(ch.w1 * t + ch.ph1) + Math.sin(ch.w2 * t + ch.ph2)) / 2;
          out[names[i]] = clamp(v, 0, 1); // never bites; belt and braces
        }
        return out;
      },
      // Exact per-second smoothness bound for one channel (see header note):
      // |d/dt value| ≤ depth·(w1 + w2)/2. Universal ceiling ≈ 0.0262/s.
      bound: function (name) {
        var ch = chans[name];
        if (!ch) return 0;
        return ch.depth * (ch.w1 + ch.w2) / 2;
      },
    };
  };

  // ==========================================================================
  // Fx.roomBlend — one knob, two rooms. The caller owns two PJ2.Voice.reverb
  // instances (close parlor, wide hall); roomBlend owns a PAIR of send gains
  // per registered layer and crossfades ALL pairs equal-power on setBalance.
  //
  //   layer src ─┬→ gClose(cos θ) → close.send
  //              └→ gWide (sin θ) → wide.send        θ = x·π/2
  //
  // register(name, srcNode, baseBias): baseBias is a per-layer offset ADDED
  // to the global balance before the law (clamped to [0,1]) — the ambient
  // pool can live a step deeper in the hall than the pluck at every scene
  // without its own automation.
  //
  // setBalance(x, rampS): x=0 all-parlor, x=1 all-hall. Scene-set by the
  // library (settling/candle-out ~0.15, chapters ~0.35, seizure ~0.4,
  // reverie ~0.65, +0.08 for the evening after a sea change), ramped 12–20 s,
  // weather.wetTilt nudging ±0.05. Ramps are ANCHORED and walk the
  // equal-power circle in short linear chords (header lesson #3), so the
  // move is click-safe AND never ducks: a²+b² stays within 0.05 dB of unity
  // for the whole journey, and lands on it exactly.
  // ==========================================================================
  Fx.roomBlend = function (ctx, opts) {
    opts = opts || {};
    // Accept a reverb unit ({send, output}) or a bare destination node.
    function sendOf(r) { return (r && r.send) ? r.send : r; }
    var closeIn = sendOf(opts.close);
    var wideIn = sendOf(opts.wide);
    var balance = clamp((opts.balance != null) ? opts.balance : 0.15, 0, 1);
    var layers = [];

    // The equal-power law, per layer: bias shifts x, clamp, quarter circle.
    function gainsFor(x, bias) {
      var ex = clamp(x + (bias || 0), 0, 1);
      var th = ex * Math.PI / 2;
      return { close: Math.cos(th), wide: Math.sin(th) };
    }

    return {
      layers: layers, // [{name, bias, close, wide}] — telemetry / harness

      register: function (name, srcNode, baseBias) {
        var t = now(ctx);
        var gc = ctx.createGain();
        var gw = ctx.createGain();
        var g0 = gainsFor(balance, baseBias);
        setP(gc.gain, g0.close, t);
        setP(gw.gain, g0.wide, t);
        try {
          if (srcNode && typeof srcNode.connect === "function") {
            srcNode.connect(gc);
            srcNode.connect(gw);
          }
        } catch (e0) {}
        try { if (closeIn) gc.connect(closeIn); } catch (e1) {}
        try { if (wideIn) gw.connect(wideIn); } catch (e2) {}
        var layer = { name: name, bias: baseBias || 0, close: gc, wide: gw };
        layers.push(layer);
        return layer;
      },

      setBalance: function (x, rampS) {
        x = clamp(x, 0, 1);
        // Floor at 50 ms: even an "instant" balance move must be a ramp
        // (house rule — steps on live sends click). Library passes 12–20 s.
        rampS = Math.max(0.05, (rampS != null) ? rampS : 12);
        var t = now(ctx);
        // Chord count: 8 for real scene moves; short utility fades take 2.
        var steps = (rampS >= 1) ? 8 : 2;
        var from = balance;
        for (var i = 0; i < layers.length; i++) {
          var L = layers[i];
          var g0 = gainsFor(from, L.bias);
          anchorTo(L.close.gain, t, g0.close);
          anchorTo(L.wide.gain, t, g0.wide);
          for (var s = 1; s <= steps; s++) {
            var xs = from + (x - from) * (s / steps);
            var g = gainsFor(xs, L.bias);
            var ts = t + rampS * (s / steps);
            rampTo(L.close.gain, g.close, ts);
            rampTo(L.wide.gain, g.wide, ts);
          }
        }
        balance = x;
      },

      balance: function () { return balance; },
    };
  };

})();
