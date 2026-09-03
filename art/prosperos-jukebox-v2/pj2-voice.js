// ============================================================================
// PJ2.Voice — graph plumbing for Prospero's Jukebox v2 (Phase 0, module 4)
//
// The other Phase 0 modules decide WHAT to play (Rand), at WHAT pitch (Pitch),
// and WHEN (Clock). This module owns HOW sound reaches the speakers: the
// master bus, the rooms (generated-IR reverbs), the stereo field (a pooled
// panner rack), click-safe envelopes, and the polyphony budget that keeps
// fugal moments from ballooning the node graph — the one flaw every sibling
// review found.
//
// Everything here is LAZY: no AudioContext is created in this module; every
// function takes a ctx (real or a harness mock whose nodes merely record
// connections). No DOM access, no wall-clock reads.
//
// DSP lessons inherited from the siblings (zankyo → bardo → kolob):
//   1. WAVESHAPER SMALL-SIGNAL GAIN — a normalized tanh curve
//      tanh(x*k)/tanh(k) is NOT unity at small signals: its slope at zero is
//      k/tanh(k) (~1.66x at k=1.5, a free +4.4 dB). Budget for it in the
//      master level and never stack saturators casually.
//   2. PRE-ATTENUATE BEFORE RESONANT FILTERS — a high-Q biquad can ring far
//      above its input level; feed it quiet and make the level up AFTER, or
//      the onset transient slams the compressor (bardo's grit-bus lesson).
//   3. RAMPS FROM TRUE ZERO — every gain envelope anchors with
//      setValueAtTime and starts/ends at actual 0 via linearRamp;
//      exponentialRamp only between two strictly positive endpoints (it can
//      never pass through zero and throws or clicks if asked to).
//   4. NEVER setTargetAtTime ON FILTER FREQUENCIES MID-NOTE — the murmur
//      formants in bardo zippered; anchored linear ramps do not.
//   5. PAN SLOTS PULLED IN FROM THE EDGES — hard ±1 pans read as separate
//      tracks, not one ensemble; kolob settled on gentle spread (±0.42..0.66)
//      so voices share the centre of the room.
// ============================================================================
(function () {
  "use strict";

  window.PJ2 = window.PJ2 || {};
  var Voice = window.PJ2.Voice = {};

  // shared background-audio state (see buildBus's final hop): one helper
  // handle + rail per AudioContext, mutable lock-screen transport handlers
  var bgShared = null;
  var bgHandlers = { onPlay: null, onPause: null };
  Voice.background = {
    setHandlers: function (h) {
      bgHandlers.onPlay = (h && h.onPlay) || null;
      bgHandlers.onPause = (h && h.onPause) || null;
    },
    started: function () { if (bgShared && bgShared.bg) { try { bgShared.bg.started(); } catch (e) {} } },
    stopped: function () { if (bgShared && bgShared.bg) { try { bgShared.bg.stopped(); } catch (e) {} } },
    poke: function () { if (bgShared && bgShared.bg) { try { bgShared.bg.poke(); } catch (e) {} } },
    updateMetadata: function (meta) {
      if (bgShared && bgShared.bg && bgShared.bg.updateMetadata) {
        try { bgShared.bg.updateMetadata(meta); } catch (e) {}
      }
    },
    handle: function () { return bgShared ? bgShared.bg : null; },
  };

  // --------------------------------------------------------------------------
  // Small helpers — every AudioParam write goes through setP so a harness mock
  // that only records calls (or lacks a param entirely) never crashes us.
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

  // Gentle tanh saturator curve, kolob-style (kolob-audio.js:249). Normalized
  // so full-scale maps to full-scale — which is exactly why lesson #1 above
  // matters: small-signal gain = amount/tanh(amount).
  function buildSatCurve(amount) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // ==========================================================================
  // buildBus — the master chain, matched to kolob's (the family's best):
  //
  //   voicesBus → glue compressor (1.7:1, knee 30 — a blend, not a level;
  //   lets the ensemble breathe as one body of sound) → masterGain →
  //   tanh saturator (amount 1.5, gentle warmth; see lesson #1 for its
  //   hidden +4.4 dB) → limiter compressor (-18 dB, 3:1 — the actual
  //   safety net) → out.
  //
  // "Out" prefers window.MskyBackgroundAudio when present (kolob-audio.js:258
  // pattern): a MediaStreamDestination feeding a real <audio> element, which
  // survives screen lock / backgrounding and carries lock-screen controls.
  // Identical signal either way. Everything guarded so a mocked ctx works.
  // ==========================================================================
  Voice.buildBus = function (ctx, opts) {
    opts = opts || {};
    var t0 = now(ctx);

    var voicesBus = ctx.createGain();
    setP(voicesBus.gain, 1, t0);

    var glue = ctx.createDynamicsCompressor();
    setP(glue.threshold, -20, t0);
    setP(glue.knee, 30, t0);
    setP(glue.ratio, 1.7, t0);
    setP(glue.attack, 0.025, t0);
    setP(glue.release, 0.22, t0);

    var masterGain = ctx.createGain();
    // Default 0.6, not 1.0 — headroom for the saturator's small-signal gain
    // (lesson #1) plus tutti moments, so the limiter idles instead of pumping.
    var curVol = (opts.volume != null) ? opts.volume : 0.6;
    setP(masterGain.gain, curVol, t0);

    var sat = ctx.createWaveShaper();
    try { sat.curve = buildSatCurve(1.5); sat.oversample = "2x"; } catch (e) {}

    var limiter = ctx.createDynamicsCompressor();
    setP(limiter.threshold, -18, t0);
    setP(limiter.knee, 16, t0);
    setP(limiter.ratio, 3, t0);
    setP(limiter.attack, 0.015, t0);
    setP(limiter.release, 0.25, t0);

    voicesBus.connect(glue);
    glue.connect(masterGain);
    masterGain.connect(sat);
    sat.connect(limiter);

    // Final hop: prefer the background-audio route if the site helper is
    // loaded AND actually manages to route (bg.routed). ONE shared handle
    // per AudioContext: buses are per-run, but the helper's hidden <audio>
    // element + listeners must not multiply — so the handle wires a
    // persistent RAIL gain once, and every new bus's limiter feeds the
    // rail. Lock-screen transport routes through mutable handlers the UI
    // registers (Voice.background.setHandlers). Fully guarded — in the
    // harness there is no MskyBackgroundAudio and we fall through to
    // ctx.destination (which a mock supplies as a plain recording node).
    var bg = null;
    try {
      if (typeof window !== "undefined" && window.MskyBackgroundAudio &&
          typeof window.MskyBackgroundAudio.create === "function") {
        if (!bgShared || bgShared.ctx !== ctx) {
          var rail = ctx.createGain();
          bgShared = {
            ctx: ctx, rail: rail,
            bg: window.MskyBackgroundAudio.create({
              context: ctx,
              source: rail,
              title: opts.title || "Prospero's Jukebox v2",
              artist: opts.artist || "Municipal Sky",
              artwork: opts.artwork || "/images/prosperos-jukebox-v2-art.png",
              onPlay: function () { if (bgHandlers.onPlay) bgHandlers.onPlay(); },
              onPause: function () { if (bgHandlers.onPause) bgHandlers.onPause(); },
            }),
          };
        }
        bg = bgShared.bg;
        if (bg && bg.routed) {
          limiter.connect(bgShared.rail);
          // a bus is only ever built to sound RIGHT NOW — declare intent so
          // the media element runs and the lock-screen session is live
          if (typeof bg.started === "function") bg.started();
        }
      }
    } catch (e) { bg = null; }
    if (!bg || !bg.routed) {
      if (ctx.destination && typeof limiter.connect === "function") limiter.connect(ctx.destination);
    }

    return {
      input: voicesBus,          // layers/reverb outputs connect here
      masterGain: masterGain,    // volume control + analyser taps
      output: limiter,           // last node before out (for tests/telemetry)
      bg: bg,                    // background-audio handle or null
      setMasterVolume: function (v) {
        curVol = v;
        setP(masterGain.gain, v, now(ctx));
      },
      fadeTo: function (v, s) {
        var g = masterGain.gain, t = now(ctx);
        if (!g) return;
        // Anchor at the CURRENT value before ramping (lesson #3) — a ramp
        // without a preceding event ramps from the last event, wherever
        // that was, and jumps audibly.
        var from = (typeof g.value === "number") ? g.value : curVol;
        if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
        setP(g, from, t);
        if (typeof g.linearRampToValueAtTime === "function") g.linearRampToValueAtTime(v, t + (s || 0));
        else setP(g, v, t);
        curVol = v;
      },
      attachAnalyser: function (analyser) {
        if (typeof masterGain.connect === "function") masterGain.connect(analyser);
      },
    };
  };

  // ==========================================================================
  // reverb — one generated-IR room (kolob-audio.js:312 / bardo-audio.js:278
  // lineage). Multiple instances = multiple spaces; v2 wants per-track rooms.
  //
  //   send ─→ dry(1.0) ────────────────────→ output   (connect output to Bus.input)
  //     └──→ preDelay → convolver → wet(w) ─↗
  //
  // spec: { decayS, preDelayS, wet, brightness, ripple?, irUrl? }
  //   brightness — the HF-damping envelope's exponent (kolob's hfDamp):
  //                LOWER = brighter tail (0.8 was the tabernacle, 1.6 the
  //                parlor). The damping runs on its own exponential so the
  //                room darkens as it decays, like air absorption.
  //   ripple     — depth (0..~0.1) of a slow amplitude swell on the tail
  //                ("the hall inhaling", kolob's tabernacle at 0.5 Hz), or
  //                {depth, hz} to pick the breathing rate.
  //   irUrl      — Phase 5 groundwork (owner, 2026-08-03): a MEASURED
  //                impulse response replaces the generated pour. Loading is
  //                async by nature, so the graph goes up immediately with
  //                an empty convolver (wet path silent, dry path live) and
  //                the real room arrives when decode lands — milliseconds
  //                on a local fetch, under the near-silent opening every
  //                track composes anyway. On ANY failure — no fetch/decode
  //                in the harness mock, missing file, undecodable bytes —
  //                the generated pour fills the convolver instead: the
  //                engine can never lose its room to a network hiccup.
  //                Bytes cache per URL (module), decoded buffers per ctx.
  // ==========================================================================
  var irBytesCache = {}; // url -> Promise<ArrayBuffer>, failures evicted
  function loadIRBytes(url) {
    if (!irBytesCache[url]) {
      irBytesCache[url] = fetch(url).then(function (r) {
        if (!r || !r.ok) throw new Error("HTTP " + (r && r.status));
        return r.arrayBuffer();
      }).catch(function (e) { delete irBytesCache[url]; throw e; });
    }
    return irBytesCache[url];
  }
  function decodeIR(ctx, url) {
    var store = ctx.__pj2IrBufs || (ctx.__pj2IrBufs = {});
    if (!store[url]) {
      store[url] = loadIRBytes(url).then(function (ab) {
        return new Promise(function (res, rej) {
          // callback form first — old Safari has no promise decodeAudioData;
          // slice() because decode detaches the buffer and the cache keeps it
          var done = false;
          function ok(b) { if (!done) { done = true; res(b); } }
          function bad(e) { if (!done) { done = true; rej(e || new Error("decode failed")); } }
          try {
            var p = ctx.decodeAudioData(ab.slice(0), ok, bad);
            if (p && p.then) p.then(ok, bad);
          } catch (e) { bad(e); }
        });
      }).catch(function (e) { delete store[url]; throw e; });
    }
    return store[url];
  }

  Voice.reverb = function (ctx, spec) {
    spec = spec || {};
    var decayS = spec.decayS || 2.0;
    var preDelayS = spec.preDelayS || 0.02;
    var wet = (spec.wet != null) ? spec.wet : 0.35;
    var brightness = (spec.brightness != null) ? spec.brightness : 1.0;
    var rippleDepth = 0, rippleHz = 0.5;
    if (typeof spec.ripple === "number") rippleDepth = spec.ripple;
    else if (spec.ripple) { rippleDepth = spec.ripple.depth || 0; rippleHz = spec.ripple.hz || 0.5; }

    var t0 = now(ctx);
    var send = ctx.createGain();
    var output = ctx.createGain();
    setP(send.gain, 1, t0);
    setP(output.gain, 1, t0);
    var wetGain = null;

    try {
      var dry = ctx.createGain();
      setP(dry.gain, 1, t0);
      wetGain = ctx.createGain();
      setP(wetGain.gain, wet, t0);
      var pre = ctx.createDelay(Math.max(0.25, preDelayS));
      setP(pre.delayTime, preDelayS, t0);
      var conv = ctx.createConvolver();

      // ---- generated stereo IR ------------------------------------------
      // Unseeded Math.random is permitted HERE ONLY: it shapes texture, not
      // music (the zankyo-audio.js:45 rule) — the performance stays
      // reproducible from its seed even though every room is a fresh pour
      // of noise. Two independently-poured channels + independent ripple
      // phases = decorrelated L/R, which is what makes it read as a SPACE
      // rather than a mono echo in the middle of the head.
      var poured = false;
      function pourGenerated() {
        if (poured) return;
        poured = true;
        var sr = ctx.sampleRate || 44100;
        var len = Math.max(2, Math.floor(sr * decayS));
        var buf = ctx.createBuffer(2, len, sr);
        var fadeStart = Math.floor(len * 0.95); // kill the truncation click at
                                                // the buffer edge (kolob cuts at
                                                // ~-19 dB; we fade the last 5%)
        for (var ch = 0; ch < 2; ch++) {
          var data = buf.getChannelData(ch);
          var ph = Math.random() * Math.PI * 2;
          for (var i = 0; i < len; i++) {
            var t = i / sr;
            var env = Math.exp(-2.2 * t / decayS);              // amplitude tail
            var hf = Math.exp(-(brightness * 2.6) * t / decayS); // HF darkening
            var color = rippleDepth
              ? 1 + rippleDepth * Math.sin(2 * Math.PI * rippleHz * t + ph)
              : 1;
            var edge = i >= fadeStart ? (len - i) / (len - fadeStart) : 1;
            data[i] = (Math.random() * 2 - 1) * env * hf * color * edge;
          }
        }
        conv.buffer = buf;
      }
      if (spec.irUrl && typeof fetch === "function" &&
          typeof ctx.decodeAudioData === "function") {
        decodeIR(ctx, spec.irUrl).then(function (b) {
          if (!poured) { poured = true; conv.buffer = b; }
        }).catch(function () { pourGenerated(); });
      } else {
        pourGenerated();
      }
      // --------------------------------------------------------------------

      send.connect(dry);
      dry.connect(output);
      send.connect(pre);
      pre.connect(conv);
      conv.connect(wetGain);
      wetGain.connect(output);
    } catch (e) {
      // A ctx without buffer/convolver support (or a very lean mock): degrade
      // to a dry pass-through rather than dying — same spirit as kolob's
      // effects-init fallback (kolob-audio.js:284).
      send.connect(output);
    }

    return {
      send: send,
      output: output,
      setWet: function (v) { if (wetGain) setP(wetGain.gain, v, now(ctx)); },
    };
  };

  // ==========================================================================
  // pannerPool — exactly `slots` StereoPanners at fixed, evenly spread pans,
  // each fed by a persistent input gain. v1 allocated one panner PER NOTE;
  // the pool is the zankyo/kolob optimization: the stereo image quantizes to
  // a few seats in the room and the node count stays constant forever.
  //
  // Spread is ±0.66, not ±1 (lesson #5): hard-panned slots read as separate
  // tracks; pulled in, the voices share the centre and blend.
  // ==========================================================================
  Voice.pannerPool = function (ctx, destNode, slots) {
    slots = slots || 3;
    var WIDTH = 0.66;
    var hasPanner = typeof ctx.createStereoPanner === "function";
    var pans = [], inputs = [];
    for (var i = 0; i < slots; i++) {
      var p = slots === 1 ? 0 : WIDTH * ((2 * i / (slots - 1)) - 1);
      var input = ctx.createGain();
      setP(input.gain, 1, now(ctx));
      if (hasPanner) {
        var sp = ctx.createStereoPanner();
        setP(sp.pan, p, now(ctx));
        input.connect(sp);
        sp.connect(destNode);
      } else {
        // Harness mocks (and ancient Safari) may lack StereoPanner: mono
        // fallback, the input gain feeds the destination directly.
        input.connect(destNode);
      }
      pans.push(p);
      inputs.push(input);
    }
    return {
      at: function (pan) {
        var v = clamp(pan || 0, -1, 1), best = 0, bestD = Infinity;
        for (var j = 0; j < pans.length; j++) {
          var d = Math.abs(pans[j] - v);
          if (d < bestD) { bestD = d; best = j; }
        }
        return inputs[best];
      },
      slots: slots,
      pans: pans, // exposed for tests/telemetry
    };
  };

  // ==========================================================================
  // env — the click-safe envelope writer (bardo-audio.js:360 lineage,
  // lesson #3 codified). segments = [[dt, value], ...] cumulative from t0.
  //
  //   - ALWAYS anchors with setValueAtTime(0, t0) before any ramp: a ramp
  //     with no prior event ramps from wherever the last event left the
  //     param — an audible jump.
  //   - exponentialRamp ONLY when both the previous and target values are
  //     strictly positive (it cannot pass through zero); otherwise linear.
  //   - `base` is the floor for exponential targets: pass base as a segment
  //     value to decay "to silence" exponentially, then follow with a short
  //     [dt, 0] linear tail to land at TRUE zero.
  //
  // Returns the end time so callers can stop sources / release budget there.
  // ==========================================================================
  Voice.env = function (param, t0, segments, base) {
    if (base == null) base = 0.0001;
    param.setValueAtTime(0, t0); // the anchor — from true zero, every time
    var t = t0, prev = 0;
    for (var i = 0; i < segments.length; i++) {
      t += segments[i][0];
      var v = segments[i][1];
      if (prev > 0 && v > 0) {
        param.exponentialRampToValueAtTime(Math.max(v, base), t);
      } else {
        param.linearRampToValueAtTime(Math.max(v, 0), t);
      }
      prev = v;
    }
    return t;
  };

  // ==========================================================================
  // adsr — convenience over env(). {a, d, s, r, peak, durS}: attack/decay/
  // release in seconds, s = sustain LEVEL AS A FRACTION of peak, durS = total
  // intended note length (release begins at durS - r). If durS is shorter
  // than a+d+r the hold collapses to zero and the note simply runs a+d+r —
  // we never truncate a release, that is where the click lives.
  // ==========================================================================
  Voice.adsr = function (param, t0, o) {
    o = o || {};
    var a = (o.a != null) ? o.a : 0.01;
    var d = (o.d != null) ? o.d : 0.05;
    var s = (o.s != null) ? o.s : 0.7;
    var r = (o.r != null) ? o.r : 0.1;
    var peak = (o.peak != null) ? o.peak : 1;
    var durS = (o.durS != null) ? o.durS : (a + d + r);
    var sus = peak * s;
    var hold = Math.max(0, durS - a - d - r);
    var segs = [[a, peak]];
    if (d > 0) segs.push([d, sus]);
    if (hold > 0) segs.push([hold, sus]); // ramp-to-same-value = flat hold
    segs.push([r, 0]);                    // land at true zero, linearly
    return Voice.env(param, t0, segs);
  };

  // ==========================================================================
  // budget — the polyphony ceiling. Claims count VOICES (one claim = one
  // voice, however many nodes it spends — nNodes is recorded for telemetry
  // only). Over budget → null, NEVER a throw: the caller skips the note.
  // Graceful thinning, no voice stealing — in an aleatoric texture a missing
  // note is unremarkable; a stolen one clicks.
  //
  // Auto-release needs a clock: call .bindClock(clock) with a PJ2.Clock (or
  // anything exposing .at(timeS, fn)/.cancel(id)). Unbound, the budget falls
  // back to requiring explicit release(token) — forgetting then leaks the
  // slot, so bind the clock in real engines.
  // ==========================================================================
  Voice.budget = function (maxVoices) {
    var max = maxVoices || 24;
    var AUTO_GRACE = 0.05; // release a hair AFTER endTime, never before
    var active = {};
    var count = 0, totalNodes = 0, nextId = 1;
    var clock = null;

    function release(token) {
      if (!token || !active[token.id]) return;
      delete active[token.id];
      count--;
      totalNodes -= token.nNodes || 0;
      if (clock && token.__autoId != null && typeof clock.cancel === "function") {
        try { clock.cancel(token.__autoId); } catch (e) {}
      }
      token.__autoId = null;
    }

    var api = {
      claim: function (nNodes, endTimeS) {
        if (count >= max) return null; // graceful thinning — never throw
        var token = {
          id: nextId++,
          nNodes: nNodes || 0,
          endTimeS: (endTimeS != null) ? endTimeS : null,
          __autoId: null,
        };
        active[token.id] = token;
        count++;
        totalNodes += token.nNodes;
        if (clock && token.endTimeS != null && typeof clock.at === "function") {
          try {
            // The lookahead clock fires callbacks up to aheadS EARLY — that is
            // its whole job (callers place audio at the passed t). But a budget
            // slot must not free before the note actually ends, or a tutti can
            // over-admit past max during the lookahead window (~0.25s, ~1.6s in
            // hidden tabs). On an early fire, re-arm with a DOUBLING grace so
            // the re-arm time escapes the current lookahead horizon in a few
            // steps (the clock picks up same-horizon reschedules within one
            // tick, during which the audio clock does not advance — re-arming
            // at the same time would spin forever). Capped: past 8 attempts,
            // release anyway rather than risk leaking the slot.
            var arm = function (attempt) {
              var when = token.endTimeS + AUTO_GRACE * Math.pow(2, attempt);
              token.__autoId = clock.at(when, function () {
                token.__autoId = null; // consumed — nothing left to cancel
                if (attempt < 8 && typeof clock.now === "function" &&
                    clock.now() < token.endTimeS) { arm(attempt + 1); return; }
                release(token);
              });
            };
            arm(0);
          } catch (e) { token.__autoId = null; }
        }
        return token;
      },
      release: release,
      active: function () { return count; },
      stats: function () { return { voices: count, nodes: totalNodes, max: max }; },
      bindClock: function (c) { clock = c; return api; },
    };
    api.bind = api.bindClock; // spec §4 names it .bind; caller convention is .bindClock
    return api;
  };

  // ==========================================================================
  // noiseBuffer — one shared white-noise buffer per ctx (zankyo/kolob
  // pattern: 30 seconds, mono, looped by every consumer). Cached ON the ctx
  // so the harness's fresh mock contexts each get their own.
  //
  // Unseeded Math.random is permitted here: texture, not music
  // (zankyo-audio.js:45 rule) — noise is noise regardless of the seed.
  // ==========================================================================
  Voice.noiseBuffer = function (ctx, seconds) {
    seconds = seconds || 30;
    var cache = ctx.__pj2NoiseBuf;
    if (cache && cache.seconds >= seconds) return cache.buf;
    var sr = ctx.sampleRate || 44100;
    var n = Math.max(1, Math.floor(sr * seconds));
    var buf = ctx.createBuffer(1, n, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    ctx.__pj2NoiseBuf = { seconds: seconds, buf: buf };
    return buf;
  };

  // Helper: a looping BufferSource over the shared buffer with a random read
  // offset (so simultaneous consumers don't phase against each other —
  // texture, not music, again). Caller connects it and calls
  // src.start(t, src.randomOffset).
  Voice.noiseBuffer.source = function (ctx, seconds) {
    seconds = seconds || 30;
    var buf = Voice.noiseBuffer(ctx, seconds);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = buf.duration || seconds;
    src.randomOffset = Math.random() * Math.max(0, seconds - 1);
    return src;
  };

  // ==========================================================================
  // wander — plan §11: "knobs that should wander". Three kinds of draw for a
  // desk parameter, so an instrument is played rather than set:
  //
  //   TOUCH      a fresh draw every sounding (bow pressure, a roll's speed,
  //              a twang count, a chord's parts) — "no two alike";
  //   CHARACTER  drawn ONCE per evening (a reed's buzz, a bell's beating
  //              rate, a motor's speed, a register) — the instrument stays
  //              itself, each night a slightly different one;
  //   WEATHER    a value that wanders slowly over minutes (bellows depth,
  //              air, tape wow, a section's tuning) — deterministic in t.
  //
  // The desk knob the owner tuned stays the CENTRE. A parameter def in an
  // engine's LAYER_PARAMS may carry an authored span:
  //     { key, label, min, max, def, lo, hi, per: "touch"|"character"|"weather",
  //       round?: true, weights?: [[value, weight], ...] }
  // The span [lo, hi] is authored around def; when the owner moves the knob
  // the span TRANSLATES with it (lo + (knob − def) … hi + (knob − def)) and is
  // clamped to [min, max]. One `vary` knob per layer (0–2, def 1) scales the
  // half-width about the centre: 0 = fixed at the knob, 1 = the authored span,
  // 2 = twice as wide (still clamped). `weights` replaces the uniform draw
  // with a weighted choice (a chord of 2/3/4 parts) — used only while the
  // knob still sits on its default; a moved knob is the owner's word and wins.
  //
  // Stream discipline (pj2-rand's law): every draw happens on the helper's
  // OWN forks — "wander:<layer>:dress:<evening>" for character,
  // "wander:<layer>:touch" for touch, "wander:<layer>:weather" for the
  // weather phases — so adding a wander to a voice never re-rolls any
  // existing stream, and the same seed still plays the same evening.
  //
  //   var w = PJ2.Voice.wander({
  //     root:   rootStream,                 // the run's root PJ2.Rand stream
  //     layer:  "cello",
  //     params: LAYER_PARAMS.cello,         // the defs, spans included
  //     knob:   function (k) { return pVal("cello", k); },  // the centre
  //     vary:   function () { return pVal("cello", "vary"); },
  //   });
  //   w.dress(eveningIndex);          // at every performance begin (and play)
  //   w.touch("rosin")                // per sounding
  //   w.character("brightness")       // the evening's value (cached)
  //   w.weather("sway", t)            // slow drift, deterministic in t
  //   w.value("anything", t)          // dispatches on the def's `per`
  //
  // A def without `per` (or without lo/hi) is fixed: value() returns the
  // knob. Nothing here touches Math.random, the clock, or any AudioParam.
  // ==========================================================================
  Voice.wander = function (opts) {
    var root = opts.root, layer = String(opts.layer || "layer");
    var defs = opts.params || [];
    var knob = opts.knob || function () { return 1; };
    var varyFn = opts.vary || function () { return 1; };
    var byKey = {};
    for (var i = 0; i < defs.length; i++) byKey[defs[i].key] = defs[i];
    var touchRng = root.fork("wander:" + layer + ":touch");
    var wxRng = root.fork("wander:" + layer + ":weather");
    var dressVals = {};       // character values for the current evening
    var evening = 0;

    // the weather LFO: two slow sines with seeded periods (60–240 s) and
    // phases, summed to [-1, 1] and softened, one pair per weather param
    var wxPhase = {};
    function wxOf(key) {
      var w = wxPhase[key];
      if (!w) {
        w = wxPhase[key] = {
          p1: wxRng.rnd(60, 150), p2: wxRng.rnd(150, 240),
          f1: wxRng.rnd(0, Math.PI * 2), f2: wxRng.rnd(0, Math.PI * 2),
        };
      }
      return w;
    }
    function lfo(key, t) {
      var w = wxOf(key);
      var v = 0.6 * Math.sin(2 * Math.PI * t / w.p1 + w.f1) +
              0.4 * Math.sin(2 * Math.PI * t / w.p2 + w.f2);
      return Math.max(-1, Math.min(1, v));
    }

    function clampTo(d, v) {
      if (d.min != null && v < d.min) v = d.min;
      if (d.max != null && v > d.max) v = d.max;
      return v;
    }
    // the translated span around the current knob, and the vary-scaled
    // value for a unit draw u in [0, 1] (0.5 = the centre)
    function fromUnit(d, u) {
      var c = knob(d.key);
      var vy = varyFn();
      if (!(vy > 0) || d.lo == null || d.hi == null) return c;
      var shift = c - d.def;
      var lo = d.lo + shift, hi = d.hi + shift;
      var draw = lo + u * (hi - lo);
      var v = c + vy * (draw - c);
      v = clampTo(d, v);
      return d.round ? Math.round(v) : v;
    }
    function moved(d) { return Math.abs(knob(d.key) - d.def) > 1e-9; }
    function weighted(d, rng) {
      // a weighted categorical draw (2/3/4 parts); a moved knob wins
      if (moved(d) || !(varyFn() > 0)) return knob(d.key);
      return rng.pickW(d.weights);
    }
    function drawWith(d, rng) {
      if (!d) return 1;
      if (d.weights) return weighted(d, rng);
      return fromUnit(d, rng.next());
    }

    var api = {
      // re-draw every character value: call at each performance begin
      dress: function (n) {
        evening = (n == null) ? evening + 1 : n;
        var rng = root.fork("wander:" + layer + ":dress:" + evening);
        dressVals = {};
        for (var i = 0; i < defs.length; i++) {
          var d = defs[i];
          if (d.per === "character") dressVals[d.key] = drawWith(d, rng);
        }
        return api;
      },
      touch: function (key) { return drawWith(byKey[key], touchRng); },
      character: function (key) {
        var d = byKey[key];
        if (!d) return 1;
        if (dressVals[key] == null) dressVals[key] = drawWith(d, root.fork("wander:" + layer + ":dress:" + evening));
        // a knob moved after the dress wins immediately
        return moved(d) && !d.weights ? fromUnit(d, 0.5) : dressVals[key];
      },
      weather: function (key, t) {
        var d = byKey[key];
        if (!d) return 1;
        var v = fromUnit(d, 0.5 + 0.5 * lfo(key, t || 0));
        return v;
      },
      value: function (key, t) {
        var d = byKey[key];
        if (!d || !d.per) return knob(key);
        if (d.per === "touch") return api.touch(key);
        if (d.per === "character") return api.character(key);
        if (d.per === "weather") return api.weather(key, t);
        return knob(key);
      },
      // for the harness and the desk: the authored + translated span
      span: function (key) {
        var d = byKey[key];
        if (!d || d.lo == null) return null;
        var shift = knob(key) - d.def;
        return { lo: clampTo(d, d.lo + shift), hi: clampTo(d, d.hi + shift), per: d.per || null };
      },
      evening: function () { return evening; },
    };
    return api;
  };

})();
