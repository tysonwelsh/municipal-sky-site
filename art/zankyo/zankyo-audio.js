// ============================================================================
// ZANKYŌ 残響 — Japanese aleatoric noise-engine (audio)
//
// A generative jukebox in the lineage of Prospero's Jukebox and Antariksh, but
// Japanese: beautiful kankyō-ongaku (environmental/ambient) textures eroded by
// Japanoise grit, on a haunting HIRAJOSHI pentatonic, structured by JO-HA-KYŪ
// (the classical slow → accelerate → burst form). A derelict orbital station,
// year 3042 — a punk noise band's idea of gagaku.
//
// Layers: subDrone, sho (cluster drone), shakuhachi (lead), koto, shamisen,
// taiko, noise (japanoise), ambient (event pool). Multiple melodic voices work
// a per-cycle motif genealogy (a theme + two subsidiaries, transform chains,
// an identity tether) and talk through a dialogue ledger with deadlines;
// everything musical is seeded (mulberry32, ?seed=) so a night is shareable.
// Above the cycles, a META-ARC: each jo-ha-kyū draws its own length and a slow
// meta-curve (~5–8 cycles per swing) drifts the mode lottery dark and back,
// scales the KIRU's severity, and tilts global density — the loop is a
// journey. Within a cycle, an ELASTIC PULSE: the taiko publishes its grid and
// koto/shamisen onsets magnetize to it as the kyū builds (shakuhachi floats).
//
// Architecture mirrors the proven Antariksh engine: ctx → grit waveshaper →
// reverb → master → compressor → destination; per-layer GainNodes; a rate-aware
// scheduler; per-layer params for the console; a jo-ha-kyū arc; an event-log
// feed. Public surface: window.ZankyoAudio
//
// ZANKYŌ 2 (Phase 0, 2026-09): the engine stands on the Prospero's Jukebox v2
// SUBSTRATE, loaded by relative path from ../prosperos-jukebox-v2/ and never
// modified here — PJ2.Rand (forked seeded streams: one per subsystem, so a
// new ambient draw can never re-roll a melody), PJ2.Clock (the lookahead
// transport: one lane per layer, the console's rate knobs are lane.rate,
// background tabs keep time), PJ2.Pitch (a mutable pitch field carrying the
// four modes — the door to sea changes), PJ2.Voice (click-safe envelopes, the
// pooled panner rack, the shared noise buffer). The grit bus, its makeup-down,
// the shamisen saturator, the master saturator/compressor/trim and the
// metallic reverb are kept exactly as tuned. Every callback receives its
// exact scheduled audio time `t` and places audio at `t`, never at "now".
// ============================================================================

window.ZankyoAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null;
  var reverbSend = null;           // the dry sum: everything that goes to the rooms, at unity, to the master
  var roomHull = null, roomCorridor = null, roomBlend = null, farWall = null;   // Phase 1: two real rooms + the corridor's answer
  var sumVoices = null, sumSho = null, sumAmb = null;                           // group sums registered with the room blend
  var gritShaper = null;           // distortion bus (gritty instruments route here)
  var shamEdge = null;             // shamisen's own gentle saturator (bite without the grit-bus onset spike)
  var dryGritGain = null;          // parallel dry grit send, opened up toward the kyū climax
  var gritMakeup = null;           // the grit bus's makeup-DOWN stage (tapped by attachBusAnalyser)
  var masterSat = null;
  var bg = null;                   // background-audio handle (lock-screen survival)
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // The substrate (see header). Hard requirement: index.php loads the pj2-*
  // modules before this file; the harness evals them first.
  var PJ = window.PJ2;
  if (!PJ || !PJ.Rand || !PJ.Clock || !PJ.Pitch || !PJ.Voice) {
    throw new Error("ZankyoAudio: the PJ2 substrate (pj2-rand/pitch/clock/voice) must load first");
  }
  var clock = null;                // PJ2.Clock — created with the ctx, started per play

  // ==========================================================================
  // SEEDED STREAMS — every musical choice flows through a forked PJ2.Rand
  // stream; a performance is reproducible and shareable (?seed=). Each
  // subsystem owns its stream (the kolob-text lesson: adding a draw to the
  // ambient pool must not re-roll every melody after it). Streams are
  // re-forked from the master seed at every play(), so stop → play replays
  // the same performance. Math.random survives only in noise-buffer /
  // reverb-IR generation, where it shapes texture, not music.
  // ==========================================================================
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 3042;
      }
    } catch (e) {}
    return (Date.now() % 0xffffffff) >>> 0;
  })();
  // form: cycle lengths, the meta-swing, the mode lottery, the KIRU's dice.
  // motif: the working set, transforms, the ledger. One per voice body. The
  // last four are reserved for later phases (weather field, joints,
  // visitations) and the console's ♪ audition, which must never perturb a
  // performance in progress.
  var STREAM_LABELS = ["form", "motif", "shakuhachi", "koto", "shamisen", "sho", "subDrone",
    "taiko", "noise", "ambient", "weather", "joints", "visit", "sample",
    "conductor", "air", "rooms", "fx"];                                   // Phase 1: the form, the air, the rooms
  var S = null;                                // the streams, forked per play
  function forkStreams() {
    var master = PJ.Rand.stream(seed);
    S = {};
    for (var i = 0; i < STREAM_LABELS.length; i++) S[STREAM_LABELS[i]] = master.fork(STREAM_LABELS[i]);
  }

  // ==========================================================================
  // SCALE — HIRAJOSHI (平調子)
  // ==========================================================================
  // A dark koto pentatonic with two semitone steps (the haunting Japanese
  // sound). Offsets in semitones from the tonic: 0, 2, 3, 7, 8.
  // Tonic low and a little detuned-feeling for grit. Just-ish via equal temper.
  var TONIC_HZ = 146.83;                       // D3
  // Related dark Japanese pentatonic modes — each jo-ha-kyū cycle modulates
  // between them for long-form variety (beyond a single fixed scale).
  var MODES = {
    hirajoshi: { offsets: [0, 2, 3, 7, 8],  name: "Hirajoshi", kana: ["一", "二", "三", "四", "五"] },
    insen:     { offsets: [0, 1, 5, 7, 8],  name: "In-sen",    kana: ["陰", "二", "三", "四", "五"] },
    kumoi:     { offsets: [0, 2, 3, 7, 9],  name: "Kumoi",     kana: ["雲", "二", "三", "四", "五"] },
    iwato:     { offsets: [0, 1, 5, 6, 10], name: "Iwato",     kana: ["岩", "二", "三", "四", "五"] },
  };
  // (mode-lottery weights live in metaModePool() below — they drift with the
  // meta-arc: home-leaning at the trough, in-sen/iwato-leaning at the peak)
  var currentMode = "hirajoshi";
  // THE PITCH FIELD (PJ2.Pitch): tonic + mode + tuning, mutable only through
  // modulate(). Every frequency is a query on the field at use time; the
  // SCALE table below is a cached register-spanning view of it, rebuilt on
  // every modulation. Sounding notes keep their Hz across a change (the
  // kolob straddle lesson) — the field never retunes what already rang.
  var field = PJ.Pitch.field({ tonicHz: TONIC_HZ, mode: { name: "hirajoshi", steps: MODES.hirajoshi.offsets }, tuning: "et" });
  function degFreq(i, octShift) {              // i = scale-degree index (folds by field.size), octShift in octaves
    return field.degFreq(i, octShift || 0);
  }

  // Ascending frequency table across registers (degree index -5 .. 15 ≈ 4 oct).
  var SCALE_LO = -5, SCALE_HI = 15;
  var SCALE = (function () {
    var arr = [];
    for (var i = SCALE_LO; i <= SCALE_HI; i++) arr.push({ deg: ((i % 5) + 5) % 5, freq: degFreq(i, 0), idx: i });
    return arr;
  })();
  function rebuildScale() {
    var n = field.size;
    for (var k = 0; k < SCALE.length; k++) { SCALE[k].freq = degFreq(SCALE[k].idx, 0); SCALE[k].deg = ((SCALE[k].idx % n) + n) % n; }
  }
  // 12-TET note name for a tonic (flats: the station sinks, it does not rise)
  var NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  function noteName(hz) { var n = Math.round(12 * Math.log(hz / 440) / Math.LN2) + 69; return NOTE_NAMES[((n % 12) + 12) % 12]; }
  // The tonic keeps to one register band (G2 … G3): a fourth up that would
  // leave it becomes a fifth down (the koto's retuning between pieces —
  // same pitch class, the strings loosened instead of tightened).
  var TONIC_LO = 98, TONIC_HI = 196;
  function foldTonic(hz) { while (hz >= TONIC_HI) hz /= 2; while (hz < TONIC_LO) hz *= 2; return hz; }
  // setMode(name, extra, t, tonicHz): one atomic modulate() of mode and
  // (optionally) tonic — sounding notes keep their Hz (the straddle lesson).
  function setMode(name, extra, t, tonicHz) {
    if (!MODES[name]) return;
    currentMode = name;
    var patch = { mode: { name: name, steps: MODES[name].offsets } };
    if (tonicHz) patch.tonicHz = tonicHz;
    field.modulate(patch);
    rebuildScale();
    SCALE_INFO.name = MODES[name].name; SCALE_INFO.kana = MODES[name].kana.slice(); SCALE_INFO.tonic = noteName(field.tonicHz);
    emitEvent({ cat: "mode", label: "⟳ mode", detail: MODES[name].name + " on " + SCALE_INFO.tonic + (extra ? " · " + extra : "") }, t);
  }
  // Pitch classes (cents mod 1200) of a (mode, tonic) — for the pivots.
  function pcSet(steps, tonicHz) {
    var out = [], base = 1200 * Math.log(tonicHz) / Math.LN2;
    for (var i = 0; i < steps.length; i++) { var c = (base + 100 * steps[i]) % 1200; out.push(c < 0 ? c + 1200 : c); }
    return out;
  }
  function sharedPcs(a, b) {
    var n = 0;
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) { var d = Math.abs(a[i] - b[j]) % 1200; if (d > 600) d = 1200 - d; if (d <= 15) { n++; break; } }
    return n;
  }
  function scaleIndexOf(i) {                    // map a degree index i to SCALE array index
    var k = i - SCALE_LO;
    return k < 0 ? 0 : k > SCALE.length - 1 ? SCALE.length - 1 : k;
  }
  function nearestScaleIndex(freq) {
    var best = 0, bd = 1e9;
    for (var k = 0; k < SCALE.length; k++) {
      var d = Math.abs(Math.log2(SCALE[k].freq / freq));
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // Tonic (degree 0) and the fifth-ish (degree 3 = +7 semis) are the gravity notes.
  var IMPORTANT_DEG = { 0: true, 3: true };
  var REST_DEG = { 0: true, 3: true, 1: true };

  var SCALE_INFO = {
    name: "Hirajoshi",
    tonic: "D",
    degrees: ["Sa", "—", "—", "—", "—"],       // (filled below as kana labels)
    kana: ["一", "二", "三", "四", "五"],
    mood: "haunted · derelict · neon-rust",
  };

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  var LAYERS = ["subDrone", "sho", "shakuhachi", "koto", "shamisen", "taiko", "noise", "ambient"];
  // Shamisen is deliberately NOT routed through the grit bus: the grit curve's
  // ~27x small-signal makeup spikes its plucked onset into an audible click.
  // Its own sawari buzz + the master saturator keep it abrasive without that.
  var GRIT_LAYERS = { subDrone: true, taiko: true, noise: true }; // route through distortion

  var layerGains = {};
  var layerVolumes = { subDrone: 0.6, sho: 0.62, shakuhachi: 0.85, koto: 0.6, shamisen: 0.75, taiko: 0.62, noise: 0.5, ambient: 0.55 };
  var layerMuted   = { subDrone: false, sho: false, shakuhachi: false, koto: false, shamisen: false, taiko: false, noise: false, ambient: false };
  var layerRate    = { subDrone: 1, sho: 1, shakuhachi: 1, koto: 1, shamisen: 1, taiko: 1, noise: 1, ambient: 1 };
  var DEFAULT_LAYER_VOL = 0.7;

  var LAYER_PARAM_DEFAULTS = {
    subDrone:   { cutoff: 220, drive: 0.5, sub: 0.6, movement: 0.18 },
    sho:        { cutoff: 1400, voices: 5, shimmer: 0.4, drift: 0.5 },
    shakuhachi: { breath: 0.55, muraiki: 0.4, pace: 1.0, glide: 0.6, ornament: 0.5 },
    koto:       { brightness: 7, pace: 1.0, gliss: 0.4, sustain: 1.0 },
    shamisen:   { sawari: 0.6, drive: 0.5, pace: 1.0, attack: 0.5 },
    taiko:      { punch: 0.6, drive: 0.5, lowTune: 1.0 },
    noise:      { density: 0.4, color: 0.5, crush: 0.4 },
    ambient:    {},
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));

  // Dark, long, slightly metallic reverb.
  var REVERB = { decay: 6.5, preDelay: 60, wet: 0.34, hfDamp: 1.1 };

  // Per-layer hidden trims (slider reads clean, effective value differs).
  // 0.9 on the main instruments: ~10% more air between phrases by default —
  // ambient and noise keep their pace (they're the weather, not the band).
  var LAYER_RATE_TRIM = { shakuhachi: 0.9, koto: 0.9, shamisen: 0.9, taiko: 0.9 };
  // Volume trim: shakuhachi + koto sit ~10% louder than their slider implies, so
  // they read more clearly in the mix without changing the displayed values.
  // shamisen 2.2: makes up the level it lost coming off the grit bus (which was
  // boosting it ~5-10x via the grit curve's makeup) so it sits in the mix again.
  // koto 1.25 / shamisen 2.5 (ZANKYŌ 2, Phase 1): +1.1 dB each — with the air
  // they are often the only line for 20–40 s and read under the drone bed
  // at the old trims (critic's real-audio measurement; owner may revert).
  var LAYER_VOL_TRIM = { shakuhachi: 1.1, koto: 1.25, shamisen: 2.5 };

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration) {
    for (var i = 0; i < noteListeners.length; i++) {
      try { noteListeners[i]({ layer: layer, freq: freq, startTime: startTime, duration: duration || 0 }); } catch (e) {}
    }
  }
  function emitEvent(ev, t) {                   // t: the scheduled audio time the event belongs to
    if (eventListeners.length === 0) return;
    ev.t = t != null ? t : (ctx ? ctx.currentTime : 0);
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT
  // ==========================================================================
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    sharedNoiseBuf = PJ.Voice.noiseBuffer(ctx, NOISE_BUF_DURATION);          // texture, not music — stays unseeded
    if (!S) forkStreams();                                                    // the ♪ audition may run before play()
    // The transport: one lookahead clock, one lane per layer (+ "form" for
    // the cycle watch). Lane rates are the console's RATE knobs.
    clock = PJ.Clock.create(ctx, { tickMs: 25, aheadS: 0.25, onError: function (err, where) {
      if (window.console) console.error("ZankyoAudio lane " + (where && where.lane) + " threw at t=" + (where && where.t), err);
    } });
    for (var lni = 0; lni < LAYERS.length; lni++) clock.lane(LAYERS[lni]).rate = layerRate[LAYERS[lni]] || 1;

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-20, ctx.currentTime);
    compressorNode.knee.setValueAtTime(14, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(5, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.012, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.2, ctx.currentTime);
    // Master saturator — glues the escalating wall into one cohesive distorted
    // mass and protects against clipping when grit + noise stack in the kyū.
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.25) / Math.tanh(1.25); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    // Output safety trim — measured (offline render): the kyū wall drives the
    // compressor's auto-makeup to 1.05–1.10 peak (79 clipped samples / 450 s).
    // −1.1 dB post-compressor keeps the DAC clean; the mix itself is untouched.
    var outTrim = ctx.createGain();
    outTrim.gain.setValueAtTime(0.88, ctx.currentTime);
    compressorNode.connect(outTrim);
    // Final hop: prefer the background-audio route (a MediaStreamDestination
    // feeding a real <audio> element — survives screen lock / backgrounding
    // and carries lock-screen controls). Identical signal either way.
    bg = window.MskyBackgroundAudio ? window.MskyBackgroundAudio.create({
      context: ctx,
      source: outTrim,
      title: "ZANKYŌ 残響",
      artist: "Municipal Sky",
      artwork: "/images/zankyo-share.png",
      onPlay: play,
      onPause: stop,
    }) : null;
    if (!bg || !bg.routed) outTrim.connect(ctx.destination);

    var effectsReady = false;
    try {
      // THE DRY SUM: every room-bound source also reaches the master dry at
      // unity, exactly as the old single reverb's dry path did.
      reverbSend = ctx.createGain();
      reverbSend.gain.setValueAtTime(1, ctx.currentTime);
      reverbSend.connect(masterGain);
      // THE ROOMS (Phase 1): two real impulse responses, WET-ONLY, crossfaded
      // per scene by PJ2.Fx.roomBlend. The hull (R1 reactor hall — vast,
      // slow, metallic) and the corridor (a railway tunnel — close, resonant).
      // Wet-only on purpose: PJ2.Voice.reverb sums its own dry inside, and
      // two of those crossfaded equal-power add the SAME dry signal
      // coherently — a +3 dB dry bump at mid-balance. With the dry summed
      // once above and only the tails blended, the cos/sin law is exactly
      // right (uncorrelated tails), and the mix stays put as scenes turn.
      roomHull = zkRoom({ irUrl: "ir/hull-r1-reactor-hall.wav", preDelayS: 0.05, wet: REVERB.wet, fallback: "metal" });
      roomCorridor = zkRoom({ irUrl: "ir/corridor-railway-tunnel.wav", preDelayS: 0.01, wet: 0.30, fallback: "plain" });
      roomBlend = PJ.Fx.roomBlend(ctx, { close: roomCorridor, wide: roomHull, balance: 0.85 });
      // Group sums: registered with the blend at their own depth bias, and
      // all of them into the dry sum. Voices (shakuhachi, koto, the far
      // wall's answer) at 0; ambient a step deeper in the hull; grit closer.
      sumVoices = ctx.createGain(); sumVoices.gain.setValueAtTime(1, ctx.currentTime);
      sumSho = ctx.createGain(); sumSho.gain.setValueAtTime(1, ctx.currentTime);
      sumAmb = ctx.createGain(); sumAmb.gain.setValueAtTime(1, ctx.currentTime);
      sumVoices.connect(reverbSend); roomBlend.register("voices", sumVoices, 0);
      sumSho.connect(reverbSend); roomBlend.register("sho", sumSho, 0.1);
      sumAmb.connect(reverbSend); roomBlend.register("ambient", sumAmb, 0.15);
      // THE FAR WALL: the corridor answering the koto — modulated, dark, low
      // feedback; the answer goes into the rooms like any voice. One seeded
      // draw at build (the drift LFO's phase) on the fx stream.
      farWall = PJ.Fx.delay(ctx, { timeS: 0.37, feedback: 0.28, damp: 1400, driftHz: 0.03, driftDepth: 0.004, wet: 0.28, rng: S.fx });   // wet 0.28 (critic P1 r2: 0.16 measured ~20 dB under the koto)
      farWall.output.connect(sumVoices);

      gritShaper = ctx.createWaveShaper();
      gritShaper.curve = buildGritCurve(0.6);
      gritShaper.oversample = "4x";
      // Makeup-DOWN: the grit curve boosts small signals ~27x and rails the bus
      // to full-scale under any real drone level, leaving the master zero
      // headroom — so every new note onset (koto, taiko) clips into an audible
      // click. Pull the gritty bus back to a sane level; the distortion timbre
      // is baked into the waveshape and survives the attenuation.
      gritMakeup = ctx.createGain();
      gritMakeup.gain.setValueAtTime(0.4, ctx.currentTime);
      gritShaper.connect(gritMakeup);
      gritMakeup.connect(reverbSend); roomBlend.register("grit", gritMakeup, -0.12);
      // parallel dry path — crossfaded up by the arc so the kyū gets close + abrasive
      dryGritGain = ctx.createGain();
      dryGritGain.gain.setValueAtTime(0, ctx.currentTime);
      gritMakeup.connect(dryGritGain);
      dryGritGain.connect(masterGain);

      // Shamisen's own saturator: a near-unity-makeup tanh that gives the
      // shamisen back its abrasive bite (and the presence it lost when taken off
      // the main grit bus) WITHOUT that bus's ~27x onset spike. Soft attack
      // transient, not a click.
      shamEdge = ctx.createWaveShaper();
      var sec = new Float32Array(1024);
      for (var si = 0; si < 1024; si++) { var sx = (si / 1023) * 2 - 1; sec[si] = Math.tanh(sx * 2.5) / Math.tanh(2.5); }
      shamEdge.curve = sec; shamEdge.oversample = "2x";
      shamEdge.connect(reverbSend); roomBlend.register("shamisen", shamEdge, -0.05);

      effectsReady = true;
    } catch (e) {
      reverbSend = ctx.createGain();
      reverbSend.connect(masterGain);
      if (window.console) console.warn("Zankyo effects init failed, dry fallback:", e);
    }

    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      if (GRIT_LAYERS[layer] && effectsReady && gritShaper) node.connect(gritShaper);
      else if (layer === "shamisen" && effectsReady && shamEdge) node.connect(shamEdge);
      else if (layer === "sho" && effectsReady && sumSho) node.connect(sumSho);
      else if (layer === "ambient" && effectsReady && sumAmb) node.connect(sumAmb);
      else if (effectsReady && sumVoices) { node.connect(sumVoices); if (layer === "koto" && farWall) node.connect(farWall.send); }
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
  }

  // A WET-ONLY convolution room: send → preDelay → convolver → wet → master.
  // The measured impulse response is fetched and decoded once per URL (cached
  // on the ctx); the graph stands immediately with an empty convolver and the
  // real room arrives when decode lands (under the near-silent jo opening).
  // On ANY failure — no fetch/decode (the harness mock), a missing file,
  // undecodable bytes — a generated pour fills the convolver: "metal" is
  // ZANKYŌ's original 6.5 s plate-like hull, "plain" a short dry corridor.
  // Unseeded Math.random is permitted here only: texture, not music.
  function zkRoom(spec) {
    var send = ctx.createGain(), pre = ctx.createDelay(0.25), conv = ctx.createConvolver(), wet = ctx.createGain();
    send.gain.setValueAtTime(1, ctx.currentTime);
    pre.delayTime.setValueAtTime(spec.preDelayS, ctx.currentTime);
    wet.gain.setValueAtTime(spec.wet, ctx.currentTime);
    send.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(masterGain);
    var poured = false;
    function pour() {
      if (poured) return;
      poured = true;
      var decay = spec.fallback === "metal" ? REVERB.decay : 1.6;
      var len = Math.floor(ctx.sampleRate * decay), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var data = buf.getChannelData(ch);
        var ph1 = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;  // per-channel phase → no comb
        for (var i = 0; i < len; i++) {
          var t = i / ctx.sampleRate;
          var env = Math.exp(-2.0 * t / decay), hf = Math.exp(-3.5 * t / decay);
          var color = spec.fallback === "metal" ? 1 + 0.10 * Math.sin(2 * Math.PI * 1700 * t + ph1) + 0.06 * Math.sin(2 * Math.PI * 3300 * t + ph2) : 1;
          var edge = i >= len * 0.95 ? (len - i) / (len * 0.05) : 1;
          data[i] = (Math.random() * 2 - 1) * env * hf * color * edge;
        }
      }
      conv.buffer = buf;
    }
    var room = { send: send, output: wet, conv: conv, irUrl: spec.irUrl, real: false, setWet: function (v) { wet.gain.setValueAtTime(v, ctx.currentTime); } };
    if (spec.irUrl && typeof fetch === "function" && typeof ctx.decodeAudioData === "function") {
      var store = ctx.__zkIrBufs || (ctx.__zkIrBufs = {});
      if (!store[spec.irUrl]) {
        store[spec.irUrl] = fetch(spec.irUrl).then(function (r) { if (!r || !r.ok) throw new Error("HTTP " + (r && r.status)); return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (res, rej) {
            var done = false;
            function ok(b) { if (!done) { done = true; res(b); } }
            function bad(x) { if (!done) { done = true; rej(x || new Error("decode failed")); } }
            try { var p = ctx.decodeAudioData(ab.slice(0), ok, bad); if (p && p.then) p.then(ok, bad); } catch (x) { bad(x); }
          }); })
          .catch(function (x) { delete store[spec.irUrl]; throw x; });
      }
      store[spec.irUrl].then(function (b) { if (!poured) { poured = true; conv.buffer = b; room.real = true; } }).catch(function () { pour(); });
    } else pour();
    return room;
  }

  // Asymmetric soft-clip with a hint of crossover grit — harsher than a plain tanh.
  function buildGritCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = 2 + amount * 40;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = (1 + k) * x / (1 + k * Math.abs(x));     // soft-clip
      y += 0.04 * Math.sin(x * 9);                      // subtle harmonic crud
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }

  // ==========================================================================
  // SCHEDULING + HELPERS
  // ==========================================================================
  // Every layer loop lives on its own PJ2.Clock lane. `t` is always the
  // SCHEDULED audio time handed to the caller (never ctx.currentTime, which
  // the lookahead clock runs up to 0.25 s behind): the next fire is placed at
  // an absolute audio time, so a thousand phrases later the loop is exactly
  // where arithmetic says it is. The console's RATE knob is lane.rate — the
  // Clock divides the delay by it and bends already-pending events when it
  // turns. The hidden per-layer trim stays a divisor on the delay itself.
  function lane(name) { return clock.lane(name); }
  function trimOf(layer) { return LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1; }
  function after(layer, t, delayS, fn) {        // trimmed: the whole delay is "rest"
    var L = lane(layer);
    return L.at(t + delayS / trimOf(layer) / L.rate, guarded(fn));
  }
  function afterRaw(layer, t, delayS, fn) {     // untrimmed: caller already trimmed the rest part
    var L = lane(layer);
    return L.at(t + delayS / L.rate, guarded(fn));
  }
  function guarded(fn) { return function (t) { if (playing) fn(t); }; }

  function lg(layer) { return layerGains[layer]; }
  // The panner rack: three persistent seats per layer (L / C / R at ±0.5)
  // instead of one panner per note — stereo width with a constant node
  // count. ZANKYŌ's own seat rule (|pan| > 0.2 goes to a side) is kept over
  // PJ2.Voice.pannerPool's ±0.66 nearest-seat: the lead draws pans within
  // ±0.25 and would otherwise collapse to mono-centre (critic, Phase 0).
  var panPool = {};
  function panAt(layer, p) {
    var pool = panPool[layer];
    if (!pool) {
      pool = panPool[layer] = [-0.5, 0, 0.5].map(function (pp) {
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(layerGains[layer]); return sp;
      });
    }
    var cl = p < -1 ? -1 : (p > 1 ? 1 : p);
    return pool[cl < -0.2 ? 0 : cl > 0.2 ? 2 : 1];
  }
  function getLayerParam(layer, key, fallback) {
    if (layerParams[layer] && layerParams[layer][key] != null) return layerParams[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    node.gain.setValueAtTime(layerMuted[layer] ? 0 : layerVolumes[layer] * trim, ctx.currentTime);
  }
  function noiseSource() {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf; n.loop = true;
    return n;
  }

  // ==========================================================================
  // THE FORM — cycle plans on PJ2.Conductor (ZANKYŌ 2, Phase 1)
  // ==========================================================================
  // jo-ha-kyū (序破急) is the GRAMMAR; each cycle is a PLAN written in it.
  // A "performance" of the Conductor is one cycle: a seeded scene list under
  // the grammar — jo → ha (with an optional sub-scene: a kakeai duet, a koto
  // solo, a muraiki solo breath; an optional taiko oroshi rolling into the
  // kyū) → kyū → release — whose proportions come from the cycle's KIND
  // (Kolob's meeting activity, ZANKYŌ's way):
  //   常 ordinary · 儀式 rite (long ceremonial jo, shō-heavy) · 漂流 drift
  //   (kankyō-ongaku, ambient-heavy, the kyū barely arrives) · 嵐 storm (short
  //   jo, noise wall, taiko wall) · 沈黙 silence (mostly ma; the KIRU cuts
  //   nothing) · 放送 broadcast (comms-vox and static-gated ambient).
  // And a SEATING: which voices are present this cycle — every voice is
  // rested about one cycle in four; named seatings (shakuhachi alone over
  // the drones in the jo; a koto-led danmono with no shamisen; a taiko-led
  // cycle where the shakuhachi enters only for the reprise; a dead station
  // of drones, noise and ambient) are drawn on top.
  // The TIDE is the old meta-arc generalized: one seeded cosine over 5–8
  // cycles tilting the kind lottery (storms at the dark peak, drift and
  // silence at the trough), the mode lottery, the KIRU's severity and the
  // global density. INTENSITY is continuous (the Conductor crossfades scene
  // curves at every boundary); the bargraph and viz keep reading a 0–1
  // level, so the faceplate is untouched. JOINTS land at exact audio times.
  var conductor = null;
  var air = null;
  // THE AIR'S CLOCK reads the CLAIMANT'S scheduled time, never the wall
  // clock: the lookahead pump fires a callback anywhere in [t − 0.25, t]
  // (1.6 s early in a hidden tab), so an Air sweeping expiries against
  // ctx.currentTime would grant or deny by how early the pump ran and the
  // seeded performance would diverge under timer jitter (critic, Phase 1
  // round 1 — measured at 5 ms). Every claim sets airT to its own t first.
  var airT = 0, airClock = { now: function () { return airT; } };
  function airClaimAt(t, voice, span, margin) { airT = t; return air.tryClaim(voice, span, margin); }
  var cyc = { n: -1, kind: "ordinary", seating: null, seatingLabel: "", durS: 420, startT: 0, mode: "hirajoshi" };
  var scn = { type: null, activity: null, startT: 0, durS: 1 };
  var pendingPlan = null;                        // written by DRAM.plan(), consumed at performance-begin

  // kind → proportions of the cycle, the kyū's ceiling, and the tilts every
  // body reads (rest multiplier, ambient gap, noise amount, sub-scene and
  // oroshi odds, the air's margin multiplier)
  var KINDS = {
    ordinary:  { kana: "常",   jo: 0.45, ha: 0.37, kyu: 0.13, rel: 0.05, peak: 1.0,  restMul: 1.0,  ambGap: 1.0,  noiseMul: 1.0, sub: 0.55, oroshi: 0.30, marginMul: 1.0 },
    rite:      { kana: "儀式", jo: 0.55, ha: 0.28, kyu: 0.10, rel: 0.07, peak: 0.9,  restMul: 1.15, ambGap: 1.1,  noiseMul: 0.8, sub: 0.40, oroshi: 0.35, marginMul: 1.3 },
    drift:     { kana: "漂流", jo: 0.45, ha: 0.40, kyu: 0.07, rel: 0.08, peak: 0.62, restMul: 1.4,  ambGap: 0.55, noiseMul: 0.6, sub: 0.35, oroshi: 0.10, marginMul: 1.5 },
    storm:     { kana: "嵐",   jo: 0.20, ha: 0.50, kyu: 0.22, rel: 0.08, peak: 1.0,  restMul: 0.85, ambGap: 1.2,  noiseMul: 1.6, sub: 0.50, oroshi: 0.60, marginMul: 0.7 },
    silence:   { kana: "沈黙", jo: 0.50, ha: 0.30, kyu: 0.08, rel: 0.12, peak: 0.7,  restMul: 2.2,  ambGap: 1.4,  noiseMul: 0.5, sub: 0.30, oroshi: 0.0,  marginMul: 2.5 },
    broadcast: { kana: "放送", jo: 0.40, ha: 0.40, kyu: 0.12, rel: 0.08, peak: 0.9,  restMul: 1.1,  ambGap: 0.7,  noiseMul: 1.1, sub: 0.45, oroshi: 0.20, marginMul: 1.1 },
  };
  function K() { return KINDS[cyc.kind] || KINDS.ordinary; }
  // scene type → jo-ha-kyū phase name (the bodies and the Motif grammar
  // speak in phases; the plan speaks in scenes)
  var PHASE_OF = { jo: "jo", ha: "ha", kakeai: "ha", solo: "ha", oroshi: "ha", kyu: "kyū", release: "release" };
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // The grammar's curves, scaled by the kind's ceiling: jo 0→0.25, ha
  // 0.25→0.8, kyū 0.8→1, release 0.8→0 (the old piecewise arc, now one
  // scene each and crossfaded); the ha's sub-scenes hold their own level.
  var CURVES = {
    jo:      function (x) { return 0.25 * x * x; },
    ha:      function (x) { return 0.25 + 0.55 * smooth(x); },
    kakeai:  function (x) { return 0.5 + 0.1 * smooth(x); },
    solo:    function (x) { return 0.38 + 0.05 * Math.sin(Math.PI * x); },
    oroshi:  function (x) { return 0.6 + 0.2 * x; },
    kyu:     function (x) { return 0.8 + 0.2 * Math.sqrt(x); },
    release: function (x) { return 0.8 * Math.pow(1 - x, 3); },
  };
  function sceneDef(type, limit, overlap) {
    return { intensity: function (x) { return clamp01(CURVES[type](x) * K().peak); }, airLimit: limit, overlapChance: overlap };
  }
  // The mode lottery, tilted by the tide: the trough leans home
  // (hirajoshi/kumoi); the peak leans to the two darkest modes (in-sen's
  // flat 2nd, iwato's tritone). Flat-ish: every mode stays in play.
  function modePool(d) {
    return [["hirajoshi", 4 - 2 * d], ["insen", 2 + 2 * d], ["kumoi", 3 - 1.5 * d], ["iwato", 1.5 + 2.5 * d]];
  }
  var MELODIC = ["shakuhachi", "koto", "shamisen"];
  // SEATING — every draw is taken unconditionally (stream discipline), the
  // named seating then overrides, the kind tilts, and a guarantee keeps at
  // least one melodic voice unless the station is dead.
  function drawSeating(rng, kind) {
    var named = rng.pickW([["free", 6.5], ["shakuhachi alone", 1.2], ["danmono", 1.0], ["taiko-led", 0.8],
      ["dead station", (kind === "drift" || kind === "silence") ? 1.1 : 0.45]]);
    var s = { shakuhachi: rng.chance(0.78), koto: rng.chance(0.75), shamisen: rng.chance(0.72), taiko: rng.chance(0.75), sho: rng.chance(0.8), entry: {}, named: named };
    if (named === "shakuhachi alone") { s.shakuhachi = true; s.entry.koto = "ha"; s.entry.shamisen = "ha"; }
    else if (named === "danmono") { s.koto = true; s.shamisen = false; }
    else if (named === "taiko-led") { s.taiko = true; s.shakuhachi = true; s.entry.shakuhachi = "reprise"; }
    else if (named === "dead station") { s.shakuhachi = s.koto = s.shamisen = s.taiko = false; s.sho = true; }   // dead, not switched off: the shō is a drone here
    if (kind === "rite") s.sho = true;
    if (kind === "storm") s.taiko = true;
    if (kind === "silence" && s.shakuhachi && s.koto && s.shamisen) s.shamisen = false;
    if (named !== "dead station" && !s.shakuhachi && !s.koto && !s.shamisen) s.shakuhachi = true;
    var present = [];
    for (var i = 0; i < MELODIC.length; i++) if (s[MELODIC[i]]) present.push(MELODIC[i] + (s.entry[MELODIC[i]] ? "(" + s.entry[MELODIC[i]] + ")" : ""));
    if (s.taiko) present.push("taiko");
    if (s.sho) present.push("sho");
    s.label = named === "dead station" ? "dead station" : present.join("+") + (named !== "free" ? " · named: " + named : "");
    return s;
  }
  function planCycle(rng, tidePos) {
    var tp = clamp01(tidePos || 0);
    var durS = rng.rnd(300, 600);                // this cycle's own breadth
    var kind = rng.pickW([["ordinary", 3], ["rite", 1.5], ["drift", 1 + 2 * (1 - tp)], ["storm", 0.5 + 3 * tp], ["silence", 0.6 + 1.6 * (1 - tp)], ["broadcast", 1]]);
    var Kd = KINDS[kind];
    var mode = rng.pickW(modePool(tp));
    var pitch = drawPitchMove(rng, mode, tp);   // 海 the sea change, or a mode-tonic pivot, or nothing
    var seating = drawSeating(rng, kind);
    var subDraw = rng.chance(Kd.sub), subKind = rng.pickW([["kakeai", 3], ["koto", 2], ["breath", 2]]);
    var oroDraw = rng.chance(Kd.oroshi);
    var melodicSeated = 0;
    for (var i = 0; i < MELODIC.length; i++) if (seating[MELODIC[i]] && seating.entry[MELODIC[i]] !== "reprise") melodicSeated++;
    var sub = null;
    if (subDraw) {
      if (subKind === "kakeai" && melodicSeated >= 2) sub = "kakeai";
      else if (subKind === "koto" && seating.koto) sub = "koto";
      else if (subKind === "breath" && seating.shakuhachi && seating.entry.shakuhachi !== "reprise") sub = "breath";
    }
    var oroshi = oroDraw && seating.taiko;
    var scenes = [{ type: "jo", durS: durS * Kd.jo, activity: null }];
    var haDur = durS * Kd.ha, oroDur = oroshi ? haDur * 0.15 : 0, haRemain = haDur - oroDur;
    if (sub) {
      scenes.push({ type: "ha", durS: haRemain * 0.5, activity: null });
      scenes.push({ type: sub === "kakeai" ? "kakeai" : "solo", durS: haRemain * 0.28, activity: sub });
      scenes.push({ type: "ha", durS: haRemain * 0.22, activity: null });
    } else scenes.push({ type: "ha", durS: haRemain, activity: null });
    if (oroshi) scenes.push({ type: "oroshi", durS: oroDur, activity: null });
    scenes.push({ type: "kyu", durS: durS * Kd.kyu, activity: null });
    scenes.push({ type: "release", durS: durS * Kd.rel, activity: null });
    pendingPlan = { kind: kind, mode: mode, seating: seating, durS: durS, pitch: pitch };
    return scenes;
  }
  // 海 THE SEA CHANGE — once every 2–4 cycles, at a cycle boundary, the
  // field's tonic moves: up a fourth or down a fifth (the traditional koto
  // retuning between pieces; a home pull keeps the wander on the circle of
  // fourths from drifting forever), or — rare, dark-tide only — the
  // station's own gesture, a SEMITONE SINK (the reactor sagging; Sycorax's
  // rule). Otherwise, when the mode changes, about half the time it PIVOTS on
  // shared tones instead of restarting on the tonic (hirajoshi on D → in-sen
  // on A shares four pitches): the same four modes yield far more colors.
  // Every draw is taken unconditionally (stream discipline).
  var cyclesSinceSea = 0;
  function drawPitchMove(rng, mode, tp) {
    var seaDraw = rng.next(), sinkDraw = rng.next(), pivotDraw = rng.next(), dirDraw = rng.next(), pivotPick = rng.next();
    var cur = field.tonicHz, curPcs = pcSet(MODES[currentMode].offsets, cur);
    var due = cyclesSinceSea >= 4 || (cyclesSinceSea >= 2 && seaDraw < 0.45);
    if (cyc.n >= 0 && due) {
      if (tp > 0.7 && sinkDraw < 0.22) {
        return { kind: "sink", tonicHz: foldTonic(cur * Math.pow(2, -1 / 12)), label: "semitone sink" };
      }
      // distance from home (D) on the circle of fourths: k up-fourths mod 12
      var off = ((Math.round(12 * Math.log(cur / TONIC_HZ) / Math.LN2) % 12) + 12) % 12;
      var k = (off * 5) % 12, dist = Math.min(k, 12 - k);
      var homeward = k !== 0 && dirDraw < 0.3 + 0.2 * dist;
      var up = homeward ? (k <= 6 ? -5 : 5) : (k <= 6 ? 5 : -5);   // +5 = up a fourth, −5 = down a fourth (= up a fifth, folded)
      var raw = cur * Math.pow(2, up / 12), folded = foldTonic(raw);
      var label = up > 0 ? (folded < raw ? "down a fifth" : "up a fourth") : (folded > raw ? "up a fifth" : "down a fourth");
      return { kind: "sea", tonicHz: folded, label: label };
    }
    if (mode !== currentMode && pivotDraw < 0.5) {
      // candidate tonics: the current field's own pitches; keep those where
      // the new mode shares ≥ 4 pitch classes with what is sounding now
      var cands = [], steps = MODES[mode].offsets;
      for (var d = 0; d < field.size; d++) {
        var th = foldTonic(field.degFreq(d, 0));
        if (Math.abs(th - cur) < 1) continue;
        var n = sharedPcs(pcSet(steps, th), curPcs);
        if (n >= 4) cands.push([th, n]);
      }
      if (cands.length) {
        var pick = cands[Math.floor(pivotPick * cands.length)];
        return { kind: "pivot", tonicHz: pick[0], label: "pivot · " + pick[1] + " shared" };
      }
    }
    return null;
  }
  // JOINTS — a page of static, a hull tick, a single fūrin, or nothing
  // (about one in three pass silent). The kyū → release joint IS the KIRU.
  function jointBody(kind, t) {
    var out = panAt("ambient", S.joints.rnd(-0.5, 0.5));
    if (kind === "static") {
      var nz = noiseSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = "highpass"; hp.frequency.setValueAtTime(1500 + S.joints.rnd(0, 2500), t);
      nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.25 + S.joints.rnd(0, 0.4);
      PJ.Voice.env(g.gain, t, [[0.01, 0.045], [d - 0.03, 0.03], [0.02, 0]]);
      nz.start(t, S.joints.rnd(0, 10)); nz.stop(t + d + 0.05);
    } else if (kind === "hull tick") {
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1400 + S.joints.rnd(0, 1600), t);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
      o.connect(og); og.connect(out);
      PJ.Voice.env(og.gain, t, [[0.003, 0.06], [0.11, 0.002], [0.03, 0]]);
      o.start(t); o.stop(t + 0.2);
    } else if (kind === "furin") {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(S.joints.rnd(0, 4)));
      var fo = ctx.createOscillator(), fg = ctx.createGain();
      fo.type = "triangle"; fo.frequency.setValueAtTime(SCALE[idx].freq * 2, t);
      fo.connect(fg); fg.connect(out);
      PJ.Voice.env(fg.gain, t, [[0.004, 0.035], [1.3, 0.0005], [0.1, 0]]);
      fo.start(t); fo.stop(t + 1.5);
    }
  }
  var DRAM = {
    name: "zankyo",
    durationRangeS: [300, 600],
    plan: planCycle,
    scenes: {
      jo:      sceneDef("jo", 1, 0.05),
      ha:      sceneDef("ha", 2, 0.25),
      kakeai:  sceneDef("kakeai", 2, 0.35),
      solo:    sceneDef("solo", 1, 0),
      oroshi:  sceneDef("oroshi", 2, 0.2),
      kyu:     sceneDef("kyu", 3, 0.5),
      release: sceneDef("release", 1, 0),
    },
    joint: function (fromType, toType, t) {
      if (!playing) return null;
      if (fromType === "kyu" && toType === "release") { kiru(t); return "kiru"; }
      var draw = S.joints.pickW([["silent", 34], ["static", 22], ["hull tick", 22], ["furin", 22]]);   // unconditional
      emitEvent({ cat: "form", label: "⌁ joint", detail: "joint: " + draw + " · " + fromType + "→" + toType }, t);
      if (draw === "silent") return null;
      try { jointBody(draw, t); } catch (e) { return null; }
      return draw;
    },
    chainOverlapS: [0, 0],
    tide: { periodPerfs: [5, 8], labels: ["drifting dark", "the dark peak", "returning light", "home"] },
  };
  function onConductorEvent(evt) {
    if (evt.type === "performance" && evt.phase === "begin") {
      var p = pendingPlan || { kind: "ordinary", mode: "hirajoshi", seating: drawSeating(S.form, "ordinary"), durS: evt.durS };
      pendingPlan = null;
      cyc.n = evt.n - 1; cyc.kind = p.kind; cyc.seating = p.seating; cyc.durS = evt.durS; cyc.startT = evt.t; cyc.mode = p.mode;
      arcStartTime = evt.t; ARC_PERIOD = evt.durS;
      var pm = p.pitch, fromName = noteName(field.tonicHz);
      cyclesSinceSea++;
      setMode(p.mode, "cycle " + cyc.n + " · " + Math.round(evt.durS) + "s · kind: " + p.kind + " · meta " + evt.tidePos.toFixed(2) + " (" + evt.tideLabel + ")" + (pm && pm.kind === "pivot" ? " · " + pm.label : ""), evt.t, pm ? pm.tonicHz : null);
      if (pm && pm.kind !== "pivot") {
        cyclesSinceSea = 0;
        emitEvent({ cat: "mode", label: "海 sea change", detail: fromName + " → " + noteName(field.tonicHz) + " · " + pm.label + " · " + MODES[p.mode].name + " · cycle " + cyc.n }, evt.t);
      }
      emitEvent({ cat: "form", label: "❁ cycle plan", detail: KINDS[p.kind].kana + " kind: " + p.kind + " · seating: " + p.seating.label + " · scenes: " + evt.scenes.join(">") }, evt.t);
      Motif.newCycle(evt.t);
    } else if (evt.type === "scene") {
      scn.type = evt.scene; scn.activity = evt.activity; scn.startT = evt.t; scn.durS = evt.durS;
      Motif.setDialogue(evt.scene === "kakeai" ? { postMul: 1.6, types: [["imitate", 6], ["invert", 1], ["develop", 1]] } : null);
      emitEvent({ cat: "form", label: "▸ scene", detail: "scene: " + evt.scene + (evt.activity ? " (" + evt.activity + ")" : "") + " · " + Math.round(evt.durS) + "s · " + (evt.idx + 1) + "/" + evt.count }, evt.t);
      setSceneRoom(evt);
    }
  }
  // Room balance per scene (0 = the corridor, close; 1 = the hull, vast):
  // jo deep in the hull, kyū close and dry with the grit send open, release
  // back to the hull for the bell. Ramped 8–16 s on the rooms stream.
  var ROOM_BALANCE = { jo: 0.85, ha: 0.5, kakeai: 0.45, solo: 0.65, oroshi: 0.3, kyu: 0.12, release: 0.9 };
  function setSceneRoom(evt) {
    var rampS = Math.min(S.rooms.rnd(8, 16), 0.6 * evt.durS);   // draw first, unconditionally; short scenes arrive in their room
    if (!roomBlend) return;
    var bal = ROOM_BALANCE[evt.scene] != null ? ROOM_BALANCE[evt.scene] : 0.5;
    try { roomBlend.setBalance(bal, rampS); } catch (e) {}
  }

  // ---- what the bodies read ----
  var ARC_PERIOD = 420;                          // the CURRENT cycle's length (telemetry; the Conductor owns the clock)
  var arcStartTime = 0;
  function getArc(t) {                          // continuous intensity at the scheduled time (defaults to now)
    if (!ctx || !playing || !conductor) return 0;
    return conductor.intensityAt(t != null ? t : ctx.currentTime);
  }
  function arcPos(t) {                           // raw 0..1 position within the cycle
    if (!ctx || !playing || cyc.n < 0) return 0;
    var at = t != null ? t : ctx.currentTime;
    return clamp01((at - cyc.startT) / cyc.durS);
  }
  function sceneX(t) { var at = t != null ? t : ctx.currentTime; return scn.durS > 0 ? clamp01((at - scn.startT) / scn.durS) : 0; }
  function arcPhase(t) {
    if (!ctx || !playing || !scn.type) return "—";
    return PHASE_OF[scn.type] || "ha";
  }
  function sceneType() { return scn.type; }
  // The one verbatim reprise's window: late in the kyū (Motif asks this).
  function repriseWindow(t) { return scn.type === "kyu" && sceneX(t) > 0.55; }
  function arcInfo() {
    if (!ctx || !playing) return { level: 0, phase: "—" };
    return { level: getArc(), phase: arcPhase() };
  }
  // The tide (the meta-arc): 0 = trough (home, light) … 1 = peak (dark).
  function tidePos() { return conductor ? conductor.tide().pos : 0; }
  function metaSeverity() { return tidePos() * (cyc.kind === "drift" ? 0.5 : 1); }
  // Global density tilt (±12% on melodic rest multipliers with the tide) ×
  // the kind's own rest multiplier (silence rests most, storm least).
  function metaRestMul() { return (1 + 0.12 * (1 - 2 * tidePos())) * K().restMul; }
  // Is this voice seated right now? The cycle's seating, its entry rule
  // (koto/shamisen "from the ha"; the shakuhachi "for the reprise only"),
  // and the ha's solo sub-scenes (one voice alone).
  function seated(voice, t) {
    var s = cyc.seating;
    if (!s) return true;
    if (s[voice] === false) return false;
    var e = s.entry[voice];
    if (e === "ha" && arcPhase(t) === "jo") return false;
    if (e === "reprise" && !Motif.wantsReprise(t)) return false;
    if (scn.type === "solo") {
      if (scn.activity === "koto" && voice !== "koto") return false;
      if (scn.activity === "breath" && voice !== "shakuhachi") return false;
    }
    return true;
  }
  // THE AIR's manners: the scene's declared limit and overlap chance, the
  // silence kind capping the air at one voice.
  function airLimitNow() { var l = conductor ? conductor.airLimit() : 1; return cyc.kind === "silence" ? 1 : l; }
  function airOverlapNow() { return conductor ? conductor.overlapChance() : 0; }
  // A claim's margin of silence after the phrase, by phase and kind.
  function airMargin(R, t) {
    var ph = arcPhase(t), m;
    if (ph === "jo") m = R.rnd(3, 7); else if (ph === "ha") m = R.rnd(1.5, 4); else if (ph === "kyū") m = R.rnd(0.4, 1.5); else m = R.rnd(3, 6);
    return m * K().marginMul;
  }
  function getMetaInfo() {                       // read-only console/harness surface
    var td = conductor ? conductor.tide() : { pos: 0, periodPerfs: 0, label: "—" };
    return { cycle: cyc.n, metaPos: td.pos, period: cyc.durS, severity: metaSeverity(), metaPeriod: td.periodPerfs,
      kind: cyc.kind, seating: cyc.seatingLabel || (cyc.seating && cyc.seating.label) || "", scene: scn.type, activity: scn.activity, tideLabel: td.label };
  }

  // ==========================================================================
  // ELASTIC SHARED PULSE — the ensemble locks as the climax builds
  // ==========================================================================
  // The taiko publishes its grid (bpm + anchor beat) whenever it schedules a
  // pattern; koto and shamisen phrase-onsets MAGNETIZE toward the nearest
  // upcoming beat with strength that rises with the arc — free-floating in the
  // jo, audibly locked and DRIVING through the kyū, and free again the moment
  // the KIRU gates the drums. The shakuhachi never locks: the soloist floats
  // over the tightening ensemble.
  var pulse = { bpm: 0, beat: 0, anchor: 0, active: false };
  function pulseStrength(arc) {
    if (!pulse.active || pulse.beat <= 0 || arc < 0.45) return 0;
    var s = (arc - 0.45) / 0.5;                  // 0 at arc 0.45 → 1 at 0.95
    if (s > 1) s = 1;
    return s * 0.85;                             // never a hard snap — elastic, not sequenced
  }
  // Blend a freely-chosen onset toward the nearest UPCOMING taiko beat.
  // Only ever delays (audio can't rewind), and never by more than one beat.
  function pulseSnap(t, arc) {
    var s = pulseStrength(arc);
    if (s <= 0) return t;
    var grid = pulse.anchor + Math.ceil((t - pulse.anchor) / pulse.beat) * pulse.beat;
    if (grid - t > pulse.beat + 1e-6) return t;  // degenerate-grid guard
    return t + (grid - t) * s;
  }
  // Light duration quantization above arc 0.7 — note lengths lean ~30% toward
  // the nearest half-beat, so the locked phrases also SPEAK in the meter.
  function pulseQuantDur(dur, arc) {
    if (!pulse.active || pulse.beat <= 0 || arc < 0.7) return dur;
    var half = pulse.beat * 0.5;
    var q = Math.max(half * 0.5, Math.round(dur / half) * half);
    return dur + (q - dur) * 0.3;
  }

  // ==========================================================================
  // MOTIF ENGINE — working set, transform algebra, genealogy, dialogue ledger
  // ==========================================================================
  // Replaces the old 24-slot motif soup + single lastCall. Each jo-ha-kyū
  // cycle works THREE ideas deeply — a theme and two subsidiaries, named by
  // katakana iroha (イ ロ ハ), drawn from the six authentic seed gestures
  // below (the cultural DNA). A motif carries identity + genealogy:
  //   { name, gen, chain[], notes: [{ deg (SCALE index), durBeats }] }.
  // Development ACCUMULATES: it continues from the most-developed living
  // descendant instead of restarting from the seed; an identity tether grafts
  // the ancestor's opening back every 3rd generation; the shakuhachi restates
  // the theme verbatim once, late in the kyū — the last word before the KIRU;
  // and a decomposed ghost of each cycle's deepest development opens the next
  // cycle's jo, so the 7-minute cycles chain into a journey, not a loop.
  // Call-and-response is a real obligation LEDGER with deadlines, not a
  // fixed-probability echo of whoever spoke last.

  // Register FOLDING, not clamping: out-of-range degrees fold back by octaves
  // (5 scale steps), so a transposed motif keeps its contour instead of
  // flattening against the rails.
  function foldDeg(i) {
    var n = field.size;
    i = Math.round(i);
    while (i < 0) i += n;
    while (i > SCALE.length - 1) i -= n;
    return i;
  }
  // Shift a motif into a voice's register by whole octaves (mean toward the
  // voice's center), then fold stragglers — the intervals survive intact.
  function fitToRegister(notes, center) {
    if (!notes.length) return [];
    var sum = 0, i;
    for (i = 0; i < notes.length; i++) sum += notes[i].deg;
    var n = field.size, shift = Math.round((center - sum / notes.length) / n) * n;
    var out = [];
    for (i = 0; i < notes.length; i++) out.push({ deg: foldDeg(notes[i].deg + shift), durBeats: notes[i].durBeats });
    return out;
  }

  var Motif = (function () {
    var NAMES = ["イ", "ロ", "ハ"];                // katakana iroha — the working set's names
    var SEED_PHRASES = [                           // the twelve authentic gestures — the ancestor pool
      { name: "honkyoku descent", degs: [3, 2, 1, 0], durs: [1, 1, 1, 2] },            // → tonic (shakuhachi, jo)
      { name: "sakura sigh",      degs: [1, 2, 1],    durs: [1, 1.5, 2] },             // the most recognizably-Japanese turn
      { name: "kumoi cadence",    degs: [4, 3, 0],    durs: [1, 1, 2] },
      { name: "tsugaru run",      degs: [0, 1, 2, 3, 4], durs: [0.5, 0.5, 0.5, 0.5, 1.5] },  // hammer run
      { name: "midare leaps",     degs: [0, 4, 1, 3, 0], durs: [1, 0.5, 1, 0.5, 2] },  // scattered (kyū)
      { name: "kakegoe answer",   degs: [0, 1, 2],    durs: [0.5, 0.5, 1.5] },         // retrograde-pairs with the sigh
      // ZANKYŌ 2 (Phase 2): the pool grows — each a real idiom's contour, none a quotation
      { name: "netori tuning",    degs: [0, 1, 0, 3, 3], durs: [3, 1, 2, 1, 4] },       // the gagaku tuning-in: tonic tried, the fifth held
      { name: "sugagaki figure",  degs: [3, 3, 2, 3, 0], durs: [0.5, 0.5, 1, 0.5, 2] }, // koto: the repeated-note strum figure
      { name: "rokudan opening",  degs: [0, 0, 4, 3, 5, 3], durs: [1, 1, 1, 0.5, 2, 2] }, // danmono: the tonic twice, then the rise
      { name: "jongara lick",     degs: [5, 4, 3, 4, 3, 2, 0], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5] }, // Tsugaru: the fast fall
      { name: "kagura call",      degs: [0, 3, 3, 5, 3], durs: [1, 1.5, 0.5, 2, 2] },   // the shrine flute's rising call
      { name: "yatai-bayashi",    degs: [0, 0, 1, 0, 3, 0], durs: [0.5, 0.25, 0.25, 0.5, 0.5, 1] }, // the festival drum's don-doko-don, sung
    ];
    // ---- THE IMPROVISER (ported in spirit from the Jukebox's motif improviser):
    // a first-order Markov walk in degree-class space with JAPANESE-IDIOM
    // transition tables and tendency rules — the semitone above the tonic
    // FALLS (in-sen / iwato's second), the fifth LEAPS to the octave, the sixth
    // sinks back onto the fifth, and descents end on the tonic with a MERI dip
    // (the final note carries a meri tag the shakuhachi honours as a bend).
    // Each cycle's working set gains one NEWBORN from here; the pool of names
    // grows all night. All draws on the motif stream.
    var BORN_ROWS = [
      [1,   3,   2,   3,   1  ],   // from the tonic: to the 2nd or the 5th
      [4,   0.5, 2.5, 1,   0.5],   // from the 2nd: falls to the tonic
      [2,   3,   1,   3,   1  ],   // from the 3rd
      [3,   1,   2.5, 1,   3  ],   // from the 5th: to the tonic (the leap), the 6th, the 3rd
      [1,   0.5, 2,   4,   1  ],   // from the 6th: back to the fifth
    ];
    var BORN_DURS = [[0.5, 3], [1, 5], [1.5, 3], [2, 1.5]];
    var SYL_A = ["ka", "shi", "to", "mi", "yu", "ha", "ne", "sa", "ku", "ri"];
    var SYL_B = ["ge", "ro", "n", "ki", "ma", "zu", "te", "yo", "ru", "e"];
    var bornSerial = 0, bornNames = {};
    function birth() {
      var R = S.motif, n = R.rint(4, 7), notes = [], cls = R.pickW([[0, 3], [3, 2], [1, 1], [2, 1], [4, 1]]);
      var deg = scaleIndexOf(cls) + 5 * R.rint(0, 1);       // absolute degree index in the mid band
      for (var i = 0; i < n; i++) {
        var last = i === n - 1;
        var row = BORN_ROWS[((cls % 5) + 5) % 5];
        var pool = [];
        for (var c = 0; c < 5; c++) pool.push([c, row[c] * (last && c === 0 ? 3 : 1)]);   // descents end on the tonic
        var next = R.pickW(pool);
        var up = R.next() < 0.5, dirDraw = R.next();
        // tendency rules
        if (cls === 1 && next === 0) up = false;                                   // the second falls
        else if (cls === 3 && next === 0) up = dirDraw < 0.6;                      // the fifth leaps to the octave
        else if (cls === 4 && next === 3) up = false;                              // the sixth sinks
        var cur = ((deg % 5) + 5) % 5, delta = ((next - cur) % 5 + 5) % 5;         // steps up to reach `next`
        deg = up ? deg + delta : deg - (5 - delta) % 5;
        if (delta === 0) deg += up ? 5 : -5;                                       // same class → the octave
        deg = foldDeg(deg);
        cls = next;
        var dur = R.pickW(BORN_DURS) * (last ? 1.6 : 1);
        notes.push({ deg: deg, durBeats: dur, meri: !!(last && cls === 0) });
      }
      var nm = R.pick(SYL_A) + R.pick(SYL_B);
      if (bornNames[nm]) nm = nm + "·" + (++bornSerial);
      bornNames[nm] = 1;
      return { name: "born: " + nm, degs: null, notes: notes };
    }
    var working = { theme: null, subs: [] };       // the whole cycle works ≤3 ideas
    var ledger = [];                               // [{from, to, motif, type, deadline}]
    var lineage = {};                              // most-developed living descendant per name
    var ghost = null;                              // decomposed memory carried across the KIRU
    var reprised = false;                          // the one verbatim kyū statement, per cycle
    var plainCounts = {};                          // plain statements per motif per cycle (≤3 — learn it, then work it)
    var stats = { developments: 0, answers: 0, transformsUsed: {} };

    function clone(m) { return JSON.parse(JSON.stringify(m)); }
    function fromSeed(i, name) {
      var s = SEED_PHRASES[i], notes = [];
      for (var k = 0; k < s.degs.length; k++) notes.push({ deg: scaleIndexOf(s.degs[k]), durBeats: s.durs[k] });
      return { name: name, gen: 0, chain: [], notes: notes, src: s.name };   // src: the gesture this line descends from
    }

    // ---- the transform algebra (each mutates a clone; chain appended by develop) ----
    var TRANSFORMS = {
      invert: function (m) {                       // mirror on the first degree
        var axis = m.notes[0].deg;
        m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        return m;
      },
      transpose: function (m) {                    // ±1–3 scale DEGREES — real pitch-content change, not octaves
        var by = S.motif.pickW([[1, 3], [2, 3], [-1, 3], [-2, 3], [3, 1], [-3, 1]]);
        m.notes.forEach(function (n) { n.deg += by; });
        return m;
      },
      fragmentHead: function (m) { m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      fragmentTail: function (m) { m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      augment: function (m) {
        var f = S.motif.rnd(1.35, 1.9);
        m.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * f); });
        return m;
      },
      diminish: function (m) {
        var f = S.motif.rnd(0.5, 0.72);
        m.notes.forEach(function (n) { n.durBeats = Math.max(0.3, n.durBeats * f); });
        return m;
      },
      retrograde: function (m) { m.notes.reverse(); return m; },
      sequence: function (m) {                     // restate at a transposition — real sequencing
        var step = S.motif.pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = m.notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
        m.notes = m.notes.concat(rep).slice(0, 12);            // runaway guard
        return m;
      },
      ornament: function (m) {                     // neighbor-tone turns — koto kazashi / shakuhachi ornaments
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && S.motif.chance(0.6)) {
            res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
            res.push({ deg: n.deg + (nx.deg > n.deg ? 1 : -1), durBeats: Math.max(0.35, n.durBeats * 0.35) });
          } else res.push({ deg: n.deg, durBeats: n.durBeats });
        }
        m.notes = res;
        return m;
      },
    };

    // ---- chain grammar: which transform, given VOICE + jo-ha-kyū phase ----
    // Sophistication = context-sensitivity: the same motif is worked
    // differently by each instrument, and differently in jo than in kyū.
    var VOICE_WEIGHTS = {
      // the shakuhachi works contour: ornament, augmentation, mirrors
      shakuhachi: { ornament: 3.5, augment: 3, invert: 2.5, transpose: 2.5, fragmentTail: 1.5, fragmentHead: 1.5, retrograde: 1.5, sequence: 1, diminish: 1 },
      // the koto sequences and fragments — danmono figuration
      koto: { sequence: 3.5, fragmentHead: 2.5, fragmentTail: 2.5, transpose: 2.5, invert: 2, ornament: 2, diminish: 1.5, augment: 1.5, retrograde: 1.5 },
      // the shamisen diminishes and splinters — fast Tsugaru fragmentation
      shamisen: { diminish: 3.5, fragmentHead: 3, fragmentTail: 2.5, sequence: 2.5, transpose: 2, retrograde: 1.5, invert: 1.5, ornament: 1, augment: 0.5 },
    };
    var PHASE_TILT = {
      jo:      { augment: 1.7, transpose: 1.4, ornament: 0.6, sequence: 0.4, fragmentHead: 0.5, fragmentTail: 0.5, diminish: 0.4 },   // state plainly, stretch
      ha:      { invert: 1.4, sequence: 1.3, ornament: 1.4, transpose: 1.1 },                                                          // explore widely
      "kyū":   { diminish: 1.8, fragmentHead: 1.5, fragmentTail: 1.4, sequence: 1.6, retrograde: 1.2, augment: 0.4 },                  // drive — stretto
      release: { augment: 1.6, fragmentTail: 1.4, ornament: 0.4, sequence: 0.3, diminish: 0.4 },                                       // the ma decomposes
    };
    var AFFINITY = {                               // pairs that compose well lean into each other
      fragmentHead: { sequence: 2.4, ornament: 1.6 },
      fragmentTail: { sequence: 2.4, ornament: 1.6 },
      invert:       { augment: 1.7, transpose: 1.5 },
      sequence:     { diminish: 1.6 },
      ornament:     { augment: 1.4 },
    };
    function beatsOf(m) { var b = 0; m.notes.forEach(function (n) { b += n.durBeats; }); return b; }
    function isPalindromic(m) {
      var s = m.notes.map(function (n) { return n.deg; });
      for (var i = 0; i < s.length; i++) if (s[i] !== s[s.length - 1 - i]) return false;
      return true;
    }
    function lastRealLink(chain) {
      for (var i = chain.length - 1; i >= 0; i--)
        if (chain[i] !== "tether" && chain[i] !== "dissolve" && chain[i] !== "ghost") return chain[i];
      return null;
    }
    function allowedTransform(name, m, chain) {
      var len = m.notes.length;
      if (name === lastRealLink(chain)) return false;              // never twice running (invert∘invert is a no-op)
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;                                // fragmenting a fragment leaves 2 notes of nothing
        var frags = 0;
        for (var i = 0; i < chain.length; i++) if (chain[i].indexOf("fragment") === 0) frags++;
        if (frags >= 1 && len <= 6) return false;
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false; // no-op on palindromes (the sakura sigh!)
      if (name === "augment" && beatsOf(m) > 18) return false;
      if (name === "diminish" && beatsOf(m) < 2.5) return false;
      return true;
    }
    function pickTransform(voice, m, chain, t) {
      var w = VOICE_WEIGHTS[voice] || VOICE_WEIGHTS.koto;
      var tilt = PHASE_TILT[arcPhase(t)] || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1);
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        pool.push([name, wt]);
      }
      return pool.length ? S.motif.pickW(pool) : null;
    }
    // Keep the motif's centre of mass in the singable mid-band by whole
    // octaves — internal intervals untouched; voices re-register per phrase.
    function recentre(m) {
      if (!m.notes.length) return m;
      var sum = 0; m.notes.forEach(function (n) { sum += n.deg; });
      var mean = sum / m.notes.length;
      while (mean > 13) { m.notes.forEach(function (n) { n.deg -= 5; }); mean -= 5; }
      while (mean < 5) { m.notes.forEach(function (n) { n.deg += 5; }); mean += 5; }
      return m;
    }

    // ---- genealogy: lineage, tether, development ----
    function ancestorOf(name) {
      if (working.theme && working.theme.name === name) return working.theme;
      for (var i = 0; i < working.subs.length; i++) if (working.subs[i] && working.subs[i].name === name) return working.subs[i];
      return working.theme;
    }
    function remember(m) {
      var cur = lineage[m.name];
      if (!cur || m.gen >= cur.gen) lineage[m.name] = clone(m);
    }
    // Identity tether: every 3rd generation, graft the ancestor's opening back
    // onto the descendant — development may wander; the head-motive returns.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc) return m;
      var src = clone(anc).notes;
      var shift = Math.round((m.notes[0].deg - src[0].deg) / 5) * 5;   // meet the descendant's register
      for (var i = 0; i < src.length; i++) src[i].deg += shift;
      var k = Math.min(3, src.length, Math.max(1, m.notes.length - 1));
      m.notes = src.slice(0, k).concat(m.notes.slice(k));
      m.chain = m.chain.concat(["tether"]);
      stats.transformsUsed.tether = (stats.transformsUsed.tether || 0) + 1;
      return m;
    }
    function develop(voice, m, maxChain, t) {
      // Renewal: after long development the line returns to its source —
      // identity over archaeology (ledger ping-pong otherwise compounds
      // generations into the twenties).
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = anc; }
      var out = clone(m);
      var links = S.motif.rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voice, out, out.chain.concat(used), t);
        if (!name) break;
        out = TRANSFORMS[name](out);
        used.push(name);
        stats.transformsUsed[name] = (stats.transformsUsed[name] || 0) + 1;
      }
      if (!used.length) {                          // grammar cornered — a transposition always speaks
        out = TRANSFORMS.transpose(out);
        used.push("transpose");
        stats.transformsUsed.transpose = (stats.transformsUsed.transpose || 0) + 1;
      }
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(used);
      if (out.gen >= 3 && out.gen % 3 === 0) out = tether(out);
      recentre(out);
      stats.developments++;
      remember(out);
      emitEvent({ cat: voice, label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") + " · " + arcPhase(t) }, t);
      return out;
    }
    // The ma decomposing a motif: notes released, time stretched.
    function decompose(m, voice, t) {
      var out = clone(m);
      var keep = Math.max(2, Math.round(out.notes.length * S.motif.rnd(0.4, 0.7)));
      while (out.notes.length > keep) out.notes.splice(S.motif.rint(1, out.notes.length - 1), 1);
      out.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * S.motif.rnd(1.4, 2)); });
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: voice, label: "散 " + out.name + " decomposes", detail: "releasing notes into the ma" }, t);
      return out;
    }
    function makeGhost(m) {
      var g = clone(m);
      var keep = Math.max(2, Math.round(g.notes.length * 0.5));
      while (g.notes.length > keep) g.notes.splice(S.motif.rint(1, g.notes.length - 1), 1);
      g.notes.forEach(function (n) { n.durBeats = Math.min(8, n.durBeats * S.motif.rnd(2, 3)); });
      g.chain = g.chain.concat(["ghost"]);
      return g;
    }

    // ---- what should a voice play right now? ----
    function request(voice, t) {
      if (!working.theme) return null;
      var phase = arcPhase(t);
      // After the KIRU hush, the new jo opens with a decomposed ghost of the
      // previous cycle's deepest development — the journey across the cut.
      if (ghost && phase === "jo") {
        var g = ghost; ghost = null;
        emitEvent({ cat: voice, label: "残 ghost of " + g.name + "·g" + g.gen, detail: "the last cycle, decomposed — notes dropped, time stretched" }, t);
        return g;
      }
      // ONE guaranteed verbatim theme statement, late in the kyū — the last
      // word before the cut. The shakuhachi speaks it.
      if (voice === "shakuhachi" && !reprised && repriseWindow(t)) {
        reprised = true;
        emitEvent({ cat: "shakuhachi", label: "✸ reprise " + working.theme.name, detail: "the theme verbatim — the last word before the cut" }, t);
        return clone(working.theme);
      }
      var m;
      if (phase === "jo") m = S.motif.chance(0.7) ? working.theme : S.motif.pick(working.subs);
      else if (phase === "ha") m = S.motif.pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]);
      else m = S.motif.chance(0.6) ? working.theme : S.motif.pick(working.subs);   // kyū/release: the theme drives
      if (!m) m = working.theme;
      // Work what the cycle has BUILT: continue from the most-developed living
      // descendant about half the time in ha/kyū (the tether keeps it honest).
      if (phase === "ha" || phase === "kyū") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && S.motif.chance(0.45)) m = line;
      }
      // jo states plainly first — an idea must be LEARNED before it is worked,
      // but only a few times: after that, even the jo varies it
      if (phase === "jo" && m.gen === 0 && (plainCounts[m.name] || 0) < 3 && S.motif.chance(0.5)) {
        plainCounts[m.name] = (plainCounts[m.name] || 0) + 1;
        emitEvent({ cat: voice, label: "○ " + m.name + " stated plain", detail: m.notes.length + " notes · jo" }, t);
        return clone(m);
      }
      if (phase === "release") return decompose(m, voice, t);       // the ma after the cut
      return develop(voice, m, phase === "kyū" ? 3 : 2, t);
    }

    // ---- dialogue ledger: real obligations between voices, with deadlines ----
    var POST_P = { shakuhachi: 0.45, koto: 0.4, shamisen: 0.35 };   // ≈ the old per-voice answer densities
    var POST_TO = {
      shakuhachi: [["koto", 3], ["shamisen", 2]],
      koto: [["shakuhachi", 3], ["shamisen", 2]],
      shamisen: [["koto", 3], ["shakuhachi", 2]],
    };
    function post(fromVoice, toVoice, motif, type, t) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: t + S.motif.rnd(6, 16) });
      if (ledger.length > 6) ledger.shift();
    }
    function postFrom(voice, motif, t) {
      if (!working.theme || !S.motif.chance((POST_P[voice] || 0.4) * dialogue.postMul)) return;
      post(voice, S.motif.pickW(POST_TO[voice]), motif, S.motif.pickW(dialogue.types), t);
    }
    // The dialogue's manners, set by the scene: a kakeai duet posts more and
    // imitates; the default is the ledger's old balance.
    var DIALOGUE_DEFAULT = { postMul: 1, types: [["imitate", 3], ["invert", 2], ["develop", 2]] };
    var dialogue = DIALOGUE_DEFAULT;
    function setDialogue(d) { dialogue = d || DIALOGUE_DEFAULT; }
    function claim(voice, t) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      if (!ob) {
        // Call-and-response must be AUDIBLE: an obligation past its deadline
        // is taken up by whichever voice speaks next (never the caller itself).
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && t > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = clone(anc); }   // renewal applies to answers too
      var ans;
      if (ob.type === "imitate") ans = develop(voice, m, 1, t);
      else if (ob.type === "invert") {
        // mirror the call — unless the call was itself a mirror (invert∘invert
        // is a no-op): then answer with the crab, or a transposition.
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(voice, m, 2, t);
      stats.answers++;
      emitEvent({ cat: voice, label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen }, t);
      return ans;
    }
    function overdueFor(voice, t) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && t > ledger[i].deadline) return true;
      }
      return false;
    }

    // ---- cycle boundaries (called at each mode change) ----
    function newCycle(t) {
      // carry a decomposed memory of the deepest development across the cut
      ghost = null;
      var deepest = null, second = null, k;
      for (k in lineage) if (lineage[k] && (!deepest || lineage[k].gen > deepest.gen)) deepest = lineage[k];
      for (k in lineage) if (lineage[k] && lineage[k] !== deepest && (!second || lineage[k].gen > second.gen)) second = lineage[k];
      if (deepest && deepest.gen > 0) ghost = makeGhost(deepest);
      // THE WORKING SET (Phase 2): イ one authentic gesture (the theme — learnable,
      // reprised verbatim), ロ one INHERITED descendant (last cycle's second-deepest
      // living line, or its deepest, carried with its generation and chain — the
      // work continues), ハ one NEWBORN from the improviser. Cycle 0, with nothing
      // to inherit, draws two authentics.
      var order = [], i; for (i = 0; i < SEED_PHRASES.length; i++) order.push(i);
      var picks = [];
      while (picks.length < 2) picks.push(order.splice(Math.floor(S.motif.next() * order.length), 1)[0]);
      working.theme = fromSeed(picks[0], NAMES[0]);
      var inherit = second || deepest, names = [SEED_PHRASES[picks[0]].name];
      var sub1;
      if (inherit && inherit.gen > 0) {
        sub1 = clone(inherit); sub1.name = NAMES[1]; sub1.chain = inherit.chain.concat(["inherit"]);
        names.push("inherited: " + (inherit.src || inherit.name) + "·g" + inherit.gen);
      } else { sub1 = fromSeed(picks[1], NAMES[1]); names.push(SEED_PHRASES[picks[1]].name); }
      var born = birth(), bornMotif = { name: NAMES[2], gen: 0, chain: [], notes: born.notes, src: born.name };
      names.push(born.name);
      working.subs = [sub1, bornMotif];
      // the authentic subsidiary may enter pre-transposed — pitch variety, not novelty churn
      if (S.motif.chance(0.5) && !(inherit && inherit.gen > 0)) { TRANSFORMS.transpose(sub1); sub1.chain = ["transpose"]; recentre(sub1); }
      recentre(bornMotif);
      ledger.length = 0;
      lineage = {};
      reprised = false;
      plainCounts = {};
      emitEvent({
        cat: "mode", label: "❁ working set",
        detail: NAMES[0] + " " + names[0] + " · " + NAMES[1] + " " + names[1] + " · " + NAMES[2] + " " + names[2],
      }, t);
    }
    function reset() {
      working.theme = null; working.subs = [];
      ledger.length = 0; lineage = {}; ghost = null; reprised = false; plainCounts = {};
    }

    // The guaranteed kyū reprise outranks even ledger obligations — the voice
    // asks this first so the theme's last word can never be talked over.
    function wantsReprise(t) {
      return !!working.theme && !reprised && repriseWindow(t);
    }

    return {
      reset: reset, newCycle: newCycle, wantsReprise: wantsReprise, setDialogue: setDialogue,
      request: request, claim: claim, overdueFor: overdueFor, postFrom: postFrom,
      stats: function () {
        return {
          developments: stats.developments, answers: stats.answers,
          transforms: Object.keys(stats.transformsUsed),
          working: { theme: working.theme && working.theme.name, themeGen: working.theme && working.theme.gen },
        };
      },
    };
  })();

  // A biased hirajoshi walk. state = { idx, dir, center }; returns phrase of
  // { deg, durBeats }. window widens / steps loosen with arc.
  function walk(R, state, len, windowR, arc) {  // R: the walking voice's own stream
    var notes = [];
    if (R.next() < 0.4) state.dir = -state.dir;
    for (var i = 0; i < len; i++) {
      var step = R.next() < (0.62 - arc * 0.18) ? 1 : R.next() < 0.8 ? 2 : 3;
      state.idx += state.dir * step;
      if (state.idx < state.center - windowR) { state.idx = state.center - windowR; state.dir = 1; }
      if (state.idx > state.center + windowR) { state.idx = state.center + windowR; state.dir = -1; }
      if (state.idx < 0) state.idx = 0; else if (state.idx >= SCALE.length) state.idx = SCALE.length - 1;
      if (R.next() < 0.34) state.idx = pullTo(state.idx, IMPORTANT_DEG);
      notes.push({ deg: state.idx, durBeats: 0.6 + R.next() * 0.9 });
    }
    state.idx = pullTo(state.idx, REST_DEG);
    notes.push({ deg: state.idx, durBeats: 1.4 + R.next() * 1.2 });
    return notes;
  }
  function pullTo(idx, flags) {
    for (var r = 0; r <= 2; r++) {
      if (SCALE[idx + r] && flags[SCALE[idx + r].deg]) return idx + r;
      if (SCALE[idx - r] && flags[SCALE[idx - r].deg]) return idx - r;
    }
    return idx;
  }

  // ==========================================================================
  // SUB-DRONE — deep distorted ground (the derelict's hull resonance)
  // ==========================================================================
  function subDroneCycle(t) {
    if (!playing) return;
    var c = ctx, now = t, out = lg("subDrone");
    var cutoff = getLayerParam("subDrone", "cutoff", 220);
    var movement = getLayerParam("subDrone", "movement", 0.18);
    var subAmt = getLayerParam("subDrone", "sub", 0.6);
    var dur = 26 + S.subDrone.next() * 10, fadeIn = 7, fadeOut = 8;

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.8, now);
    var mlfo = c.createOscillator(), mg = c.createGain();
    mlfo.type = "sine"; mlfo.frequency.setValueAtTime(0.02 + S.subDrone.next() * 0.03, now);
    mg.gain.setValueAtTime(cutoff * movement, now); mlfo.connect(mg); mg.connect(lp.frequency);
    mlfo.start(now); mlfo.stop(now + dur + 0.3);
    var bus = c.createGain();
    PJ.Voice.env(bus.gain, now, [[fadeIn, 1], [dur - fadeIn - fadeOut, 1], [fadeOut, 0]]);
    lp.connect(bus); bus.connect(out);

    // tonic + fifth, detuned sawtooth pairs (grit comes from the distortion bus)
    var roots = [degFreq(0, -1), degFreq(3, -1)];
    for (var k = 0; k < roots.length; k++) {
      [-7, 7].forEach(function (det) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(roots[k], now); o.detune.setValueAtTime(det, now);
        o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.05, now);
        o.start(now); o.stop(now + dur + 0.3);
      });
    }
    if (subAmt > 0.01) {
      var so = c.createOscillator(), sg = c.createGain();
      so.type = "sine"; so.frequency.setValueAtTime(degFreq(0, -2), now);
      so.connect(sg); sg.connect(lp); sg.gain.setValueAtTime(0.08 * subAmt, now);
      so.start(now); so.stop(now + dur + 0.3);
    }
    var overlap = 7 + S.subDrone.next() * 3;
    after("subDrone", now, dur - overlap, subDroneCycle);
  }

  // ==========================================================================
  // SHŌ 笙 — gagaku mouth-organ cluster drone (shimmering tone-clusters)
  // ==========================================================================
  // THE ELEVEN AITAKE (合竹) as interval shapes — semitones above the lowest
  // sounding pipe, after the documented chart (the shō's fixed chords: each
  // a stack of 4ths/5ths with a 2nd rubbing inside and an octave on top).
  // The shapes are approximations of the traditional voicings; the station
  // PROJECTS each onto the current field (every offset to its nearest scale
  // tone), so in a five-note mode two pipes may fold onto one pitch and the
  // cluster reads as 4–6 voices. Color, never harmony.
  var AITAKE = [
    { kana: "乙", name: "otsu",  semis: [0, 2, 7, 9, 12, 14] },
    { kana: "一", name: "ichi",  semis: [0, 5, 7, 12, 14, 19] },
    { kana: "工", name: "kō",    semis: [0, 2, 5, 7, 12, 14] },
    { kana: "凢", name: "bō",    semis: [0, 3, 5, 10, 12, 15] },
    { kana: "乞", name: "kotsu", semis: [0, 2, 4, 9, 11, 14] },
    { kana: "十", name: "jū",    semis: [0, 5, 7, 9, 12, 17] },
    { kana: "下", name: "ge",    semis: [0, 2, 7, 9, 14, 16] },
    { kana: "美", name: "bi",    semis: [0, 3, 7, 10, 12, 15] },
    { kana: "行", name: "gyō",   semis: [0, 2, 5, 7, 9, 14] },
    { kana: "比", name: "hi",    semis: [0, 5, 7, 12, 14, 17] },
    { kana: "言", name: "gon",   semis: [0, 2, 7, 12, 14, 19] },
  ];
  var lastAitake = null;                         // the cluster still sounding (te-utsuri reads it)
  function projectAitake(a, baseHz, maxVoices) {
    var out = [], seen = {};
    for (var i = 0; i < a.semis.length && out.length < maxVoices; i++) {
      var f = field.snap(baseHz * Math.pow(2, a.semis[i] / 12)), key = f.toFixed(3);
      if (!seen[key]) { seen[key] = 1; out.push(f); }
    }
    out.sort(function (x, y) { return x - y; });
    return out;
  }
  function sharedFreqs(a, b) {
    if (!a || !b) return 0;
    var n = 0;
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) if (Math.abs(1200 * Math.log(a[i] / b[j]) / Math.LN2) < 15) { n++; break; }
    return n;
  }
  // Draw the next aitake: the base pipe sits high (~A4–B4, degree 6–7 of the
  // field's mid octave); candidates are weighted by tones shared with the
  // cluster still sounding (te-utsuri: the player moves one pipe at a time).
  function chooseAitake(R, maxVoices) {
    var base = SCALE[scaleIndexOf(6 + R.rint(0, 1))].freq;
    var pool = [];
    for (var i = 0; i < AITAKE.length; i++) {
      var fr = projectAitake(AITAKE[i], base, maxVoices), sh = sharedFreqs(fr, lastAitake);
      pool.push([{ a: AITAKE[i], freqs: fr, shared: sh }, 1 + (lastAitake ? sh * 1.5 : 0)]);
    }
    var pick = R.pickW(pool);
    return { kana: pick.a.kana, name: pick.a.name, freqs: pick.freqs, shared: pick.shared };
  }
  // Sustained 5–6 note clusters (aitake) built from in-scale degrees, breathing
  // slowly, with a high digital shimmer. The shimmering harmonic bed.
  function shoCycle(t) {
    if (!playing) return;
    if (!seated("sho", t)) { afterRaw("sho", t, 12, shoCycle); return; }   // rested this cycle — ask again later
    var c = ctx, now = t, out = lg("sho");
    var cutoff = getLayerParam("sho", "cutoff", 1400);
    var voices = Math.round(getLayerParam("sho", "voices", 5));
    var shimmer = getLayerParam("sho", "shimmer", 0.4);
    var drift = getLayerParam("sho", "drift", 0.5);
    var dur = (14 + S.sho.next() * 8) * (cyc.kind === "rite" ? 1.4 : 1), fadeIn = 5, fadeOut = 6;   // the rite's clusters breathe longer

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.5, now);
    var bus = c.createGain();
    PJ.Voice.env(bus.gain, now, [[fadeIn, 0.5], [dur - fadeIn - fadeOut, 0.5], [fadeOut, 0]]);
    lp.connect(bus); bus.connect(out);

    // THE AITAKE (Phase 2): one of the eleven named voicings, projected onto
    // the current mode; TE-UTSURI — the next cluster is drawn to share tones
    // with the one still sounding, and its voices enter one at a time.
    var ait = chooseAitake(S.sho, voices);
    var freqs = ait.freqs, shared = ait.shared;
    emitEvent({ cat: "sho", label: "笙 " + ait.kana + " " + ait.name, detail: "aitake · " + freqs.length + " voices · base " + noteName(freqs[0]) + (shared ? " · te-utsuri " + shared + " shared" : "") }, now);
    for (var v = 0; v < freqs.length; v++) {
      var f = freqs[v];
      var vIn = now + v * S.sho.rnd(0.4, 1.1);           // te-utsuri: the voices enter one at a time
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, now);
      o.detune.setValueAtTime((S.sho.next() * 2 - 1) * 6 * drift, now);
      var dl = c.createOscillator(), dlg = c.createGain();
      dl.type = "sine"; dl.frequency.setValueAtTime(0.05 + S.sho.next() * 0.08, now);
      dlg.gain.setValueAtTime(5 * drift, now); dl.connect(dlg); dlg.connect(o.detune);
      dl.start(now); dl.stop(now + dur + 0.2);
      o.connect(g); g.connect(lp); PJ.Voice.env(g.gain, vIn, [[2.5, 0.045], [Math.max(0.1, now + dur - vIn - 2.5), 0.045]]);
      o.start(vIn); o.stop(now + dur + 0.2);
      // nasal free-reed character: square reed sub + 5th/7th partials
      [[1, "square", 0.018], [5, "sine", 0.014], [7, "sine", 0.008]].forEach(function (pr) {
        var po = c.createOscillator(), pg = c.createGain();
        po.type = pr[1]; po.frequency.setValueAtTime(f * pr[0], vIn);
        po.connect(pg); pg.connect(lp); PJ.Voice.env(pg.gain, vIn, [[2.5, pr[2]], [Math.max(0.1, now + dur - vIn - 2.5), pr[2]]]);
        po.start(vIn); po.stop(now + dur + 0.2);
      });
      if (shimmer > 0.01) {
        var ho = c.createOscillator(), hg = c.createGain();
        ho.type = "triangle"; ho.frequency.setValueAtTime(f * 4, vIn);
        ho.connect(hg); hg.connect(bus); PJ.Voice.env(hg.gain, vIn, [[2.5, 0.009 * shimmer], [Math.max(0.1, now + dur - vIn - 2.5), 0.009 * shimmer]]);
        ho.start(vIn); ho.stop(now + dur + 0.2);
      }
      emitNote("sho", f, now);                           // one shared t per cluster, so voicings group
    }
    lastAitake = freqs;
    var overlap = 4 + S.sho.next() * 2;
    after("sho", now, dur - overlap, shoCycle);
  }

  // ==========================================================================
  // SHAKUHACHI 尺八 — breathy bamboo flute lead (the voice)
  // ==========================================================================
  // The primary melodic line: long, spacious phrases full of MA (silence),
  // breath, meri-kari pitch bends, and occasional MURAIKI (explosive breath
  // noise — the gritty cry). Motif memory + answers other voices.
  var shakuState = { idx: 10, dir: 1, center: 10 };
  function startShakuhachi(t) {
    if (!playing) return;
    shakuState.center = scaleIndexOf(5);         // mid-high register, above the drones
    shakuState.idx = shakuState.center; shakuState.dir = 1;
    shakuhachiPhrase(t);
  }
  function shakuhachiPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("shakuhachi", now)) { afterRaw("shakuhachi", now, S.shakuhachi.rnd(5, 9), shakuhachiPhrase); return; }
    // THE AIR: claim before speaking (phrase + a margin of silence after);
    // denied → let the moment pass and ask again shortly.
    var margin = airMargin(S.shakuhachi, now);
    var tok = airClaimAt(now, "shakuhachi", shakuState.lastSpan || 3.5, margin);
    if (!tok) { afterRaw("shakuhachi", now, S.shakuhachi.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), shakuhachiPhrase); return; }
    var breathSolo = scn.type === "solo" && scn.activity === "breath";   // the muraiki solo breath
    var pace = getLayerParam("shakuhachi", "pace", 1.0) * (1 + arc * 0.6) * (breathSolo ? 0.7 : 1);
    var glideAmt = getLayerParam("shakuhachi", "glide", 0.6);
    var ornament = getLayerParam("shakuhachi", "ornament", 0.5);
    var muraiki = getLayerParam("shakuhachi", "muraiki", 0.4);
    var breath = getLayerParam("shakuhachi", "breath", 0.55);

    shakuState.center = Math.round(scaleIndexOf(5) + arc * 4);

    // motif work — ledger obligations first, then the working set; free walks
    // remain as the improvisatory glue between statements
    var phrase, motif = null;
    if (Motif.wantsReprise(now)) motif = Motif.request("shakuhachi", now);
    if (!motif && Motif.overdueFor("shakuhachi", now)) motif = Motif.claim("shakuhachi", now);
    if (!motif && S.shakuhachi.chance(0.6)) motif = Motif.request("shakuhachi", now);
    if (motif) {
      phrase = fitToRegister(motif.notes, shakuState.center);
      Motif.postFrom("shakuhachi", motif, now);
    } else {
      phrase = walk(S.shakuhachi, shakuState, 2 + Math.floor(S.shakuhachi.next() * 3) + Math.floor(arc * 2), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shakuhachi", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    if (breathSolo && phrase.length > 2) phrase = phrase.slice(0, 2);        // one or two long breaths
    if (phrase.length) shakuState.idx = phrase[phrase.length - 1].deg;   // melodic continuity for the next walk

    var beat = 0.62 / pace, t = now + 0.05, prev = null, sched = [];
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.25, n.durBeats * beat);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var glideFrom = (prev && S.shakuhachi.next() < glideAmt) ? prev : null;
      var mur = (i === 0 && S.shakuhachi.next() < muraiki * (0.4 + arc * 0.6) * (breathSolo ? 3 : 1));
      shakuhachiNote(f, t, dur, { glideFrom: glideFrom, breath: breath, muraiki: mur ? muraiki : 0, bend: S.shakuhachi.next() < ornament || !!n.meri });   // a born descent ends in a meri dip
      sched.push({ f: f, t: t, dur: dur });
      prev = f;
      t += dur + S.shakuhachi.next() * 0.05;
    }
    shakuState.lastSpan = t - now;
    tok.until = t + margin;                      // the claim's true footprint: the phrase as rendered + the margin
    // 〰 SANKYOKU HETEROPHONY — in the ha especially, the koto sometimes reads
    // the same phrase a breath behind (jiuta ensemble texture): the same note
    // list, its own ornament choices, a hair sharp. The shadow is a GRANTED
    // overlap: it asks the air (a second holder needs the scene's limit or
    // the overlap dice) and the koto must be seated.
    if (sched.length >= 3 && S.shakuhachi.chance(arcPhase(now) === "ha" ? 0.22 : 0.08) && seated("koto", now) && airClaimAt(now, "koto", t - now, 0)) {
      var lag = S.shakuhachi.rnd(0.15, 0.4), sharp = Math.pow(2, S.shakuhachi.rnd(2, 3.5) / 1200), sprev = null;
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        kotoNote(sn.f * sharp, sn.t + lag + S.shakuhachi.rnd(0, 0.05), Math.max(0.12, sn.dur * 0.8),
          { gain: 0.65, glideFrom: (sprev && S.shakuhachi.chance(0.3)) ? sprev * sharp : null, bend: S.shakuhachi.chance(0.2) });
        sprev = sn.f;
      }
      emitEvent({ cat: "koto", label: "〰 koto shadows shakuhachi", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" }, now);
    }
    // MA — breathing space between phrases (more in jo, less in kyū; the meta
    // journey tilts overall density ±12% — the shakuhachi stays UNLOCKED from
    // the pulse but still breathes with the long form)
    var ma = (1.8 + S.shakuhachi.next() * 4) * (1 - arc * 0.55) * metaRestMul() / trimOf("shakuhachi");
    afterRaw("shakuhachi", now, (t - now) + ma, shakuhachiPhrase);
  }
  function shakuhachiNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var out = panAt("shakuhachi", (S.shakuhachi.next() * 2 - 1) * 0.25);
    var o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "sine"; o2.type = "triangle";
    if (opts.glideFrom) {                          // meri-kari slide
      var gt = Math.min(dur * 0.5, 0.4);
      o.frequency.setValueAtTime(opts.glideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + gt);
      o2.frequency.setValueAtTime(opts.glideFrom, t); o2.frequency.exponentialRampToValueAtTime(freq, t + gt);
    } else { o.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq, t); }
    if (opts.bend) {                               // expressive mid-note dip (meri)
      o.frequency.exponentialRampToValueAtTime(freq * 0.97, t + dur * 0.6);
      o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.85);
    }
    var g = c.createGain(), g2 = c.createGain();
    o.connect(g); g.connect(out); o2.connect(g2); g2.connect(out);
    var peak = 0.16;   // the shakuhachi is the lead — give it presence
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.09);
    g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.22));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(peak * 0.25, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);

    // breath noise + muraiki (the gritty explosive attack)
    var br = opts.breath == null ? 0.5 : opts.breath;
    if (br > 0.01 && sharedNoiseBuf) {
      var nz = noiseSource();
      var bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.setValueAtTime(freq * 2.4, t); bpf.Q.setValueAtTime(1.4, t);
      var ng = c.createGain(); nz.connect(bpf); bpf.connect(ng); ng.connect(out);
      var bpeak = 0.02 * br + 0.12 * (opts.muraiki || 0);   // muraiki spikes the breath
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(bpeak, t + (opts.muraiki ? 0.015 : 0.09));
      ng.gain.exponentialRampToValueAtTime(0.0001, t + (opts.muraiki ? Math.min(dur, 0.5) : dur));
      nz.start(t, S.shakuhachi.next() * 20); nz.stop(t + dur + 0.1);
    }
    emitNote("shakuhachi", freq, t, dur);
  }

  // ==========================================================================
  // KOTO 箏 — plucked zither (bright melodic voice + glissando flourishes)
  // ==========================================================================
  var kotoState = { idx: 8, dir: 1, center: 8 };
  function startKoto(t) {
    if (!playing) return;
    kotoState.center = scaleIndexOf(4); kotoState.idx = kotoState.center; kotoState.dir = 1;
    kotoPhrase(t);
  }
  function kotoPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("koto", now)) { afterRaw("koto", now, S.koto.rnd(5, 9), kotoPhrase); return; }
    var margin = airMargin(S.koto, now);
    var tok = airClaimAt(now, "koto", kotoState.lastSpan || 2.5, margin);
    if (!tok) { afterRaw("koto", now, S.koto.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), kotoPhrase); return; }
    var kotoSolo = scn.type === "solo" && scn.activity === "koto";
    var pace = getLayerParam("koto", "pace", 1.0) * (1 + arc * 0.7) * (kotoSolo ? 0.9 : 1);
    var glissAmt = getLayerParam("koto", "gliss", 0.4) * (kotoSolo ? 1.6 : 1);
    kotoState.center = Math.round(scaleIndexOf(4) + arc * 3);
    var phrase, motif = null;
    if (Motif.overdueFor("koto", now)) motif = Motif.claim("koto", now);
    if (!motif && S.koto.chance(0.55)) motif = Motif.request("koto", now);
    if (motif) { phrase = fitToRegister(motif.notes, kotoState.center); Motif.postFrom("koto", motif, now); }
    else {
      phrase = walk(S.koto, kotoState, 3 + Math.floor(S.koto.next() * 3) + Math.floor(arc * 2), 7 + Math.round(arc * 2), arc);
      emitEvent({ cat: "koto", label: "fresh", detail: phrase.length + " notes" }, now);
    }
    if (phrase.length) kotoState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic pulse)
    var beat = 0.4 / pace, t = pulseSnap(now + 0.05, arc), prev = null, sched = [];
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = pulseQuantDur(Math.max(0.12, n.durBeats * beat), arc);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      kotoNote(f, t, dur, { glideFrom: (prev && S.koto.next() < 0.3) ? prev : null, bend: S.koto.next() < 0.2 });
      sched.push({ f: f, t: t, dur: dur });
      prev = f; t += dur + S.koto.next() * 0.03;
    }
    // 〰 sankyoku heterophony downward: the shamisen sometimes shadows the koto
    // a breath behind — same page, its own accents, a hair sharp (a granted
    // overlap, as above).
    if (sched.length >= 3 && S.koto.chance(arcPhase(now) === "ha" ? 0.2 : 0.07) && seated("shamisen", now) && airClaimAt(now, "shamisen", t - now, 0)) {
      var lag = S.koto.rnd(0.15, 0.4), sharp = Math.pow(2, S.koto.rnd(2, 3.5) / 1200);
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        shamisenNote(sn.f * sharp, sn.t + lag + S.koto.rnd(0, 0.04), Math.max(0.1, Math.min(sn.dur, 0.3)), { gain: sh % 2 === 0 ? 0.6 : 0.4 });
      }
      emitEvent({ cat: "shamisen", label: "〰 shamisen shadows koto", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" }, now);
    }
    // glissando flourish — a rapid run up/down the scale (more in ha/kyū)
    if (S.koto.next() < glissAmt * (0.3 + arc)) {
      var up = S.koto.next() < 0.5, start = kotoState.idx, gn = 4 + Math.floor(S.koto.next() * 5), gt = t;
      for (var k = 0; k < gn; k++) {
        var gi = Math.max(0, Math.min(SCALE.length - 1, start + (up ? k : -k)));
        kotoNote(SCALE[gi].freq, gt, 0.14, { gain: 0.7 }); gt += 0.05 + S.koto.next() * 0.03;
      }
      t = gt; emitEvent({ cat: "koto", label: "gliss", detail: (up ? "↑" : "↓") + gn }, now);
    }
    kotoState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (1.6 + S.koto.next() * 3.2) * (1 - arc * 0.5) * (arc < 0.15 ? 4 : 1) * metaRestMul() / trimOf("koto");  // sparse in jo; meta tilts density ±12%
    afterRaw("koto", now, (t - now) + rest, kotoPhrase);
  }
  function kotoNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var bright = getLayerParam("koto", "brightness", 7), sustain = getLayerParam("koto", "sustain", 1.0);
    var out = panAt("koto", (S.koto.next() * 2 - 1) * 0.35);
    var o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = "sawtooth"; o2.type = "triangle"; o2.detune.setValueAtTime(4, t);
    if (opts.glideFrom) { var gt = Math.min(dur * 0.35, 0.18); o1.frequency.setValueAtTime(opts.glideFrom, t); o1.frequency.exponentialRampToValueAtTime(freq, t + gt); o2.frequency.setValueAtTime(opts.glideFrom, t); o2.frequency.exponentialRampToValueAtTime(freq, t + gt); }
    else { o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq, t); }
    if (opts.bend) { o1.frequency.linearRampToValueAtTime(freq * 1.03, t + dur * 0.5); o1.frequency.linearRampToValueAtTime(freq, t + dur * 0.8); }   // oshide press-bend
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(freq * bright, t); f.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 300), t + dur * 0.7); f.Q.setValueAtTime(3, t);
    var g = c.createGain(); o1.connect(f); o2.connect(f); f.connect(g); g.connect(out);
    var peak = 0.13 * (opts.gain == null ? 1 : opts.gain), dec = dur * sustain;
    // Click-safe: linear fades from/to true zero; anchors clamped inside the note.
    var decA = Math.min(0.15 * sustain, dec * 0.6), atkK = Math.max(0.004, Math.min(0.006, decA * 0.5));
    if (atkK >= decA) atkK = decA * 0.5;
    PJ.Voice.env(g.gain, t, [[atkK, peak], [decA - atkK, peak * 0.3], [dec - decA, 0]]);
    o1.start(t); o1.stop(t + dec + 0.05); o2.start(t); o2.stop(t + dec + 0.05);
    var sh = c.createOscillator(), shg = c.createGain(); sh.type = "sine"; sh.frequency.setValueAtTime(freq * 2, t); sh.connect(shg); shg.connect(out);
    shg.gain.setValueAtTime(0.0001, t); shg.gain.exponentialRampToValueAtTime(0.015, t + 0.04); shg.gain.exponentialRampToValueAtTime(0.001, t + dec); sh.start(t); sh.stop(t + dec + 0.1);
    emitNote("koto", freq, t, dur);
  }

  // ==========================================================================
  // SHAMISEN 三味線 — gritty plucked lute with SAWARI buzz (tsugaru/punk edge)
  // ==========================================================================
  var shamiState = { idx: 7, dir: 1, center: 7 };
  function startShamisen(t) {
    if (!playing) return;
    shamiState.center = scaleIndexOf(3); shamiState.idx = shamiState.center; shamiState.dir = 1;
    shamisenPhrase(t);
  }
  function shamisenPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("shamisen", now)) { afterRaw("shamisen", now, S.shamisen.rnd(5, 9), shamisenPhrase); return; }
    var margin = airMargin(S.shamisen, now);
    var tok = airClaimAt(now, "shamisen", shamiState.lastSpan || 1.8, margin);
    if (!tok) { afterRaw("shamisen", now, S.shamisen.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), shamisenPhrase); return; }
    var pace = getLayerParam("shamisen", "pace", 1.0) * (1 + arc * 1.0);   // comes alive in ha/kyū
    shamiState.center = Math.round(scaleIndexOf(3) + arc * 3);
    var phrase, motif = null;
    if (Motif.overdueFor("shamisen", now)) motif = Motif.claim("shamisen", now);
    if (!motif && S.shamisen.chance(0.45)) motif = Motif.request("shamisen", now);
    if (motif) { phrase = fitToRegister(motif.notes, shamiState.center); Motif.postFrom("shamisen", motif, now); }
    else {
      phrase = walk(S.shamisen, shamiState, 3 + Math.floor(S.shamisen.next() * 4) + Math.floor(arc * 3), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shamisen", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    if (phrase.length) shamiState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic pulse)
    var beat = 0.28 / pace, t = pulseSnap(now + 0.05, arc);
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var dur = pulseQuantDur(Math.max(0.1, Math.min(n.durBeats, 1) * beat), arc);
      // tsugaru hammer-on: a quick lower-neighbor grace before the beat
      if (S.shamisen.next() < 0.25 + arc * 0.3) {
        shamisenNote(SCALE[Math.max(0, n.deg - 1)].freq, t, 0.05, { gain: 0.55 });
        t += 0.05;
      }
      shamisenNote(f, t, dur, { gain: (i % 2 === 0 ? 1.0 : 0.6) });
      t += dur + 0.01;
    }
    shamiState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (2.2 + S.shamisen.next() * 3.5) * (1 - arc * 0.6) * (arc < 0.3 ? 5 : 1) * metaRestMul() / trimOf("shamisen");  // mostly absent in jo; meta tilts density ±12%
    afterRaw("shamisen", now, (t - now) + rest, shamisenPhrase);
  }
  function shamisenNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var sawari = getLayerParam("shamisen", "sawari", 0.6), attack = getLayerParam("shamisen", "attack", 0.5);
    var out = panAt("shamisen", (S.shamisen.next() * 2 - 1) * 0.3);
    var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(freq, t);
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 2, t + dur * 0.6); f.Q.setValueAtTime(2, t);
    var g = c.createGain(); o.connect(f); f.connect(g); g.connect(out);
    var peak = 0.13 * (opts.gain == null ? 1 : opts.gain);
    // Click-safe envelope: LINEAR fades from/to TRUE zero with a ≥5ms minimum
    // fade (a fast exp ramp from ~0 on a bright sawtooth still ticks). Anchors
    // clamped inside the note so events stay in time order; exp is used only
    // between non-zero values.
    var decA = Math.min(0.12, dur * 0.6);
    var atk = Math.max(0.005, Math.min(0.002 + (1 - attack) * 0.02, decA * 0.6));
    if (atk >= decA) atk = decA * 0.5;
    PJ.Voice.env(g.gain, t, [[atk, peak], [decA - atk, peak * 0.2], [dur - decA, 0]]);
    o.start(t); o.stop(t + dur + 0.02);
    if (sawari > 0.01) {                                   // sawari buzz — bright high resonance (grit)
      var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(freq * 1.005, t);
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(freq * 7, t); bp.Q.setValueAtTime(6, t);
      var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);
      var sawIn = Math.min(0.014, dur * 0.4);              // linear fade-in from true zero (no resonant onset tick)
      PJ.Voice.env(bg.gain, t, [[sawIn, 0.05 * sawari], [dur * 0.7 - sawIn, 0.005 * sawari], [dur * 0.4, 0]]);
      bo.start(t); bo.stop(t + dur * 1.2 + 0.05);
    }
    emitNote("shamisen", freq, t, dur);
  }

  // ==========================================================================
  // TAIKO 太鼓 — drums (silent in jo; drives the ha → kyū climb)
  // ==========================================================================
  function startTaiko(t) { if (playing) taikoPulse(t); }
  function taikoHit(t, accent) {
    var c = ctx, out = panAt("taiko", (S.taiko.next() * 2 - 1) * 0.2);
    var lowTune = getLayerParam("taiko", "lowTune", 1.0), punch = getLayerParam("taiko", "punch", 0.6);
    var o = c.createOscillator(), g = c.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(95 * lowTune, t); o.frequency.exponentialRampToValueAtTime(45 * lowTune, t + 0.16);
    o.connect(g); g.connect(out);
    var peak = (0.14 + punch * 0.1) * (accent ? 1.2 : 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.start(t); o.stop(t + 0.5);
    if (sharedNoiseBuf) {
      var nz = noiseSource(); var bp = c.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.setValueAtTime(800, t);
      var ng = c.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.06 * (accent ? 1.2 : 0.8), t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      nz.start(t, S.taiko.next() * 10); nz.stop(t + 0.2);
    }
  }
  function taikoPulse(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("taiko", now)) { pulse.active = false; afterRaw("taiko", now, 8, taikoPulse); return; }   // rested this cycle
    if (scn.type === "oroshi") { taikoOroshi(now); return; }
    if (arc < 0.3) { pulse.active = false; afterRaw("taiko", now, 3 + S.taiko.next() * 3, taikoPulse); return; }   // silent in jo — no grid to lock to
    var bpm = 50 + arc * 90, beat = 60 / bpm, beats = 2 + Math.floor(arc * 8), t = now + 0.05;
    pulse.bpm = bpm; pulse.beat = beat; pulse.anchor = t; pulse.active = true;   // publish the grid — the ensemble magnetizes to this
    for (var i = 0; i < beats; i++) { if (S.taiko.next() < 0.5 + arc * 0.45) taikoHit(t, i % 4 === 0); t += beat * (S.taiko.next() < 0.3 ? 0.5 : 1); }
    emitEvent({ cat: "taiko", label: "pattern", detail: beats + " beats · " + Math.round(bpm) + "bpm" }, now);
    var rest = (2 + S.taiko.next() * 4) * (1 - arc * 0.7) / trimOf("taiko");
    afterRaw("taiko", now, (t - now) + rest, taikoPulse);
  }

  // 颪 OROSHI — the accelerating roll into the kyū (the ha's last sub-scene):
  // a run of strokes whose interval shrinks across the roll, the grid
  // published at the roll's last interval so the ensemble's magnet keeps
  // something steady to pull to.
  function taikoOroshi(now) {
    // ONE roll spanning the rest of the scene: strokes whose interval shrinks
    // linearly from `from` to `to` so the sum of intervals fills the time.
    var remain = Math.max(4, scn.startT + scn.durS - now - 0.3);
    var from = 0.5 + S.taiko.rnd(-0.06, 0.06), to = 0.085 + S.taiko.rnd(-0.01, 0.01);
    var n = Math.max(8, Math.round(remain / ((from + to) / 2))), t = now + 0.05;
    for (var i = 0; i < n; i++) {
      taikoHit(t, i % 4 === 0 || i >= n - 3);   // the last three strokes all accented — the arrival
      t += from + (to - from) * (i / (n - 1));
    }
    pulse.bpm = 60 / to; pulse.beat = to; pulse.anchor = t; pulse.active = true;
    emitEvent({ cat: "taiko", label: "颪 oroshi", detail: n + " strokes over " + Math.round(t - now) + "s · " + Math.round(1000 * from) + "→" + Math.round(1000 * to) + " ms" }, now);
    afterRaw("taiko", now, (t - now) + S.taiko.rnd(0.6, 1.6), taikoPulse);
  }

  // ==========================================================================
  // NOISE 雑音 — japanoise texture (arc-driven walls of grit)
  // ==========================================================================
  // Sparse, swelling beds of filtered/crushed noise that grow with the arc —
  // gentle hiss in jo, scraping walls in kyū. Routed through the distortion bus.
  function noiseEvent(t) {
    if (!playing) return;
    var c = ctx, now = t, out = lg("noise");
    var arc = getArc(now);
    var density = getLayerParam("noise", "density", 0.4);
    var color = getLayerParam("noise", "color", 0.5);
    var crush = getLayerParam("noise", "crush", 0.4);

    var dur = 2 + S.noise.next() * 5 + arc * 4;
    var nz = noiseSource();
    var bp = c.createBiquadFilter();
    bp.type = arc > 0.6 ? "bandpass" : "lowpass";
    var fc = 200 + color * 3000 + arc * 2500;
    bp.frequency.setValueAtTime(fc, now); bp.Q.setValueAtTime(0.5 + crush * 8 + arc * 6, now);
    // sweep the filter for a scraping motion
    bp.frequency.linearRampToValueAtTime(fc * (0.5 + S.noise.next()), now + dur);
    var g = c.createGain(); nz.connect(bp); bp.connect(g); g.connect(out);
    var peak = (0.05 + arc * 0.22) * (0.4 + density) * K().noiseMul;   // the storm's wall, the drift's hiss
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    nz.start(now, S.noise.next() * 10); nz.stop(now + dur + 0.1);
    if (arc > 0.4) emitEvent({ cat: "noise", label: "wall", detail: arcPhase(now) }, now);

    var gap = (6 + S.noise.next() * 10) * (1 - arc * 0.6) / (0.4 + density) / K().noiseMul;
    after("noise", now, gap, noiseEvent);
  }

  // ==========================================================================
  // AMBIENT — quirky events (derelict orbital station incidentals)
  // ==========================================================================
  function ambBonsho(t) {                          // temple bell (bonshō) — deep, long, inharmonic
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3);
    var base = degFreq(0, -1) * (S.ambient.next() < 0.5 ? 1 : Math.pow(2, 7 / 12));
    var partials = [{ m: 1, a: 0.08, d: 6 }, { m: 2.7, a: 0.04, d: 4 }, { m: 5.2, a: 0.02, d: 2.4 }, { m: 8.1, a: 0.012, d: 1.5 }];
    partials.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * p.m, t); o.detune.setValueAtTime((S.ambient.next() * 2 - 1) * 5, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p.a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      o.start(t); o.stop(t + p.d + 0.1);
    });
  }
  function ambFurin(t) {                            // wind-chime (fūrin) — a few tiny high pings
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.6);
    var n = 2 + Math.floor(S.ambient.next() * 3), tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(S.ambient.next() * 4));
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq * 2, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.start(tt); o.stop(tt + 1.5); tt += 0.12 + S.ambient.next() * 0.2;
    }
  }
  function ambSuikinkutsu(t) {                      // water drip resonance (suikinkutsu)
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.5);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(7) + Math.floor(S.ambient.next() * 5))].freq * 2;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
  }
  function ambGlitch(t) {                           // digital glitch / static burst (the 3042 grit)
    if (!sharedNoiseBuf) return;
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.8);
    var n = 3 + Math.floor(S.ambient.next() * 6), tt = t;
    for (var i = 0; i < n; i++) {
      var nz = noiseSource();
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(800 + S.ambient.next() * 4000, tt);
      var g = ctx.createGain(); nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.02 + S.ambient.next() * 0.05;
      g.gain.setValueAtTime(0.05, tt); g.gain.setValueAtTime(0.0001, tt + d);
      nz.start(tt, S.ambient.next() * 10); nz.stop(tt + d + 0.02); tt += d + S.ambient.next() * 0.06;
    }
  }
  function ambDistantTaiko(t) {                     // a lone distant drum hit
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.4);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
    if (sharedNoiseBuf) {
      var nz = noiseSource(); var bp = ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.setValueAtTime(400, t);
      var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      nz.start(t, S.ambient.next() * 10); nz.stop(t + 0.2);
    }
  }
  function ambKotoSweep(t) {                        // a fast koto-ish glissando flourish
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.5);
    var start = scaleIndexOf(3), n = 6, tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, start + i);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.045, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
      o.start(tt); o.stop(tt + 0.65); tt += 0.06;
    }
  }
  function ambBiwa(t) {                            // plucked lute with sawari buzz
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.4);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(0) + Math.floor(S.ambient.next() * 5))].freq, dec = 1.6 + S.ambient.next() * 1.2;
    var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 2, t + dec * 0.7); lp.Q.setValueAtTime(2, t);
    var g = c.createGain(); o.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.start(t); o.stop(t + dec + 0.05);
    var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(f * 7, t); bo.frequency.exponentialRampToValueAtTime(f * 4, t + dec);
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(f * 6, t); bp.Q.setValueAtTime(7, t);
    var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.045, t + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, t + dec * 1.2);
    bo.start(t); bo.stop(t + dec * 1.3);
  }
  function ambCommsVox(t) {                         // malfunctioning comms — stuttered vowel-formant glitch
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.6);
    var carrier = c.createOscillator(); carrier.type = "sawtooth"; carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(2)].freq * 2, t);
    var vca = c.createGain(); vca.connect(out); vca.gain.setValueAtTime(0.0001, t);
    [700, 1100, 2600].forEach(function (ff) { var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(ff, t); bp.Q.setValueAtTime(8, t); carrier.connect(bp); bp.connect(vca); });
    var syl = 3 + Math.floor(S.ambient.next() * 4), tt = t;
    for (var i = 0; i < syl; i++) {
      var d = 0.05 + S.ambient.next() * 0.12;
      carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(Math.floor(S.ambient.next() * 5))].freq * 2, tt);
      vca.gain.setValueAtTime(0.05, tt); vca.gain.setValueAtTime(0.0001, tt + d);
      tt += d + 0.04 + S.ambient.next() * 0.08;
    }
    carrier.start(t); carrier.stop(tt + 0.1);
    if (sharedNoiseBuf) { var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(2000, t); var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out); ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.0001, tt); nz.start(t, S.ambient.next() * 10); nz.stop(tt + 0.1); }
  }
  function ambGeigerHum(t) {                        // dying machinery — sagging drone + thinning radiation clicks
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3), dur = 3 + S.ambient.next() * 3, base = degFreq(0, -2);
    [-8, 8].forEach(function (det) {
      var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(base, t); o.detune.setValueAtTime(det, t); o.frequency.exponentialRampToValueAtTime(base * 0.94, t + dur);
      var g = c.createGain(); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.1);
    });
    if (sharedNoiseBuf) {
      var tt = t + 0.2;
      while (tt < t + dur) {
        var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(3000, tt);
        var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out);
        ng.gain.setValueAtTime(0.04, tt); ng.gain.setValueAtTime(0.0001, tt + 0.01);
        nz.start(tt, S.ambient.next() * 10); nz.stop(tt + 0.03);
        tt += 0.05 + S.ambient.next() * 0.3 * (1 + ((tt - t) / dur) * 3);   // clicks thin out as it dies
      }
    }
  }
  var AMBIENT_POOL = [
    { fn: ambBonsho,       w: 4, name: "Temple bell" },
    { fn: ambFurin,        w: 4, name: "Wind chime" },
    { fn: ambGlitch,       w: 4, name: "Static glitch" },
    { fn: ambSuikinkutsu,  w: 3, name: "Water drip" },
    { fn: ambDistantTaiko, w: 3, name: "Distant taiko" },
    { fn: ambKotoSweep,    w: 2, name: "Koto sweep" },
    { fn: ambBiwa,         w: 3, name: "Biwa" },
    { fn: ambCommsVox,     w: 2, name: "Comms vox" },
    { fn: ambGeigerHum,    w: 3, name: "Geiger hum" },
  ];
  // The kind gates the pool: a broadcast cycle is static and comms; drift is
  // water, bells and chimes; silence keeps the bell and little else; the
  // storm crackles. (Multipliers on the flat weights above.)
  var AMBIENT_KIND_W = {
    broadcast: { "Static glitch": 3, "Comms vox": 5, "Geiger hum": 2, "Koto sweep": 0.5 },
    drift:     { "Water drip": 2, "Temple bell": 1.5, "Wind chime": 2, "Static glitch": 0.5 },
    silence:   { "Temple bell": 2, "Wind chime": 0.6, "Static glitch": 0.4, "Distant taiko": 0.4, "Koto sweep": 0.3, "Comms vox": 0.5, "Biwa": 0.6, "Geiger hum": 0.6 },
    storm:     { "Static glitch": 2, "Distant taiko": 2, "Geiger hum": 1.5, "Water drip": 0.5 },
    rite:      { "Temple bell": 2, "Biwa": 1.5 },
  };
  function startAmbient(t) { if (playing) ambientEvent(t); }
  function ambientEvent(t) {
    if (!playing) return;
    var now = t, total = 0, i, kw = AMBIENT_KIND_W[cyc.kind] || {};
    function w(en) { return en.w * (kw[en.name] != null ? kw[en.name] : 1); }
    for (i = 0; i < AMBIENT_POOL.length; i++) total += w(AMBIENT_POOL[i]);
    var r = S.ambient.next() * total, entry = AMBIENT_POOL[0];
    for (i = 0; i < AMBIENT_POOL.length; i++) { r -= w(AMBIENT_POOL[i]); if (r <= 0) { entry = AMBIENT_POOL[i]; break; } }
    try { entry.fn(now + 0.05); } catch (e) {}
    emitEvent({ cat: "ambient", label: entry.name }, now);
    var gap = (12 + S.ambient.next() * 22) * (1 - getArc(now) * 0.35) * K().ambGap;
    after("ambient", now, gap, ambientEvent);
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (playing) return;
    playing = true;
    if (bg) bg.started();
    // one fresh world per play, all of it derived from the seed
    forkStreams();
    clock.start();
    var t0 = clock.now();
    arcStartTime = t0;
    cyc.n = -1; cyc.seating = null; scn.type = null; pendingPlan = null; cyclesSinceSea = 0;
    field.modulate({ tonicHz: TONIC_HZ, mode: { name: "hirajoshi", steps: MODES.hirajoshi.offsets } }); currentMode = "hirajoshi"; rebuildScale();   // every play opens at home
    pulse.active = false;                        // no grid until the taiko speaks
    lastAitake = null;
    Motif.reset();                               // the Conductor's first performance builds cycle 0's working set
    emitEvent({ cat: "mode", label: "▶ play", detail: "seed " + seed }, t0);
    masterGain.gain.cancelScheduledValues(t0);
    masterGain.gain.setValueAtTime(masterVolume, t0);
    for (var i = 0; i < LAYERS.length; i++) { applyLayerGain(LAYERS[i]); lane(LAYERS[i]).rate = layerRate[LAYERS[i]] || 1; }
    // THE AIR and THE CONDUCTOR — fresh per play, on their own streams. The
    // conductor starts FIRST so cycle 0's mode, kind and seating are drawn
    // before any body sounds (the shō's opening cluster is in the cycle's mode).
    airT = t0;
    air = PJ.Air.create({ clock: airClock, rng: S.air, limit: airLimitNow, overlapChance: airOverlapNow });
    conductor = PJ.Conductor.create({ clock: clock, rng: S.conductor, dramaturgy: DRAM, onEvent: onConductorEvent,
      jointTools: function () { return { ctx: ctx, rng: S.joints, field: field }; }, air: air, seed: seed });
    conductor.start();
    // drones first; voices and grit enter in turn (jo opening)
    subDroneCycle(t0);
    shoCycle(t0);
    after("shakuhachi", t0, 4, startShakuhachi);
    after("koto", t0, 10, startKoto);
    after("shamisen", t0, 16, startShamisen);
    after("taiko", t0, 22, startTaiko);
    after("noise", t0, 8, noiseEvent);
    after("ambient", t0, 7, startAmbient);
    lane("form").every(formPulse);
  }
  // The form pulse (0.7 s, on its own lane): crossfades the dry-grit send up
  // as the intensity rises — the kyū gets close + abrasive. Cycle boundaries
  // and the KIRU are the Conductor's now (exact audio times).
  function formPulse(t) {
    if (!playing) return null;
    if (dryGritGain) dryGritGain.gain.setTargetAtTime(getArc(t) * 0.7, t, 0.5);
    return 0.7;
  }
  // 斬 KIRU — a final taiko roll + noise swell, then a sudden cut to a hush; a
  // lone temple bell rings in the silence (ma); the voices return as a new jo.
  // Severity rides the meta-curve: at the trough a passing hush (shallow dip,
  // ~3 s of ma, one bell); at the peak a devastating cut (down to 0.08 of
  // master, up to ~9 s of held silence, the bell tolling twice).
  function kiru(t) {
    if (!ctx || !masterGain || !playing) return;
    var sev = metaSeverity();
    var dip = 0.3 - 0.22 * sev;                                           // hush depth: 0.3 → 0.08 of master
    var hold = 3 + 6 * sev;                                               // held silence: ~3 s → ~9 s
    var twice = sev > 0.45 && S.form.chance(0.4 + sev * 0.5);                    // the bell tolls again near the peak
    // 沈黙 in a silence cycle the KIRU cuts nothing: no roll, no swell — the
    // hush simply deepens and the bell speaks into it.
    var cutsSomething = cyc.kind !== "silence" && cyc.seating && cyc.seating.named !== "dead station";
    if (cutsSomething) {
      for (var i = 0; i < 6; i++) taikoHit(t + i * 0.08, i === 5);        // final roll
      var nz = noiseSource(), bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(4500, t + 0.5); bp.Q.setValueAtTime(2, t);
      var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(lg("noise"));
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28, t + 0.5); ng.gain.setValueAtTime(0.0001, t + 0.56);
      nz.start(t); nz.stop(t + 0.6);
    }
    masterGain.gain.cancelScheduledValues(t);                            // the cut
    masterGain.gain.setValueAtTime(masterVolume, t + 0.52);
    masterGain.gain.linearRampToValueAtTime(masterVolume * dip, t + 0.58);
    ambBonsho(t + 0.78);                                                  // a lone bell in the ma
    if (twice) ambBonsho(t + 0.78 + hold * S.form.rnd(0.4, 0.6));                // … and again, deeper into the silence
    masterGain.gain.setValueAtTime(masterVolume * dip, t + 0.6 + hold);  // hold the silence
    masterGain.gain.linearRampToValueAtTime(masterVolume, t + 0.6 + hold + 1.5);  // voices return
    emitEvent({ cat: "noise", label: "斬 KIRU", detail: "the cut · severity " + sev.toFixed(2) + " · hush " + dip.toFixed(2) + " · ma " + hold.toFixed(1) + "s" + (twice ? " · the bell twice" : "") + (cutsSomething ? "" : " · cuts nothing") }, t);
  }
  function stop() {
    if (!playing) return;
    playing = false;
    if (bg) bg.stopped();
    if (conductor) { try { conductor.stop(); } catch (e) {} }
    if (clock) clock.stop();                     // every lane's pending events die here
    if (ctx) {
      for (var i = 0; i < LAYERS.length; i++) {
        var node = layerGains[LAYERS[i]];
        if (node) { node.gain.cancelScheduledValues(ctx.currentTime); node.gain.setValueAtTime(0, ctx.currentTime); }
      }
    }
  }

  // ==========================================================================
  // SAMPLE — audition one instrument in isolation (works while stopped)
  // ==========================================================================
  function samplePhrase(noteFn, t, degs, dur) {
    var prev = null;
    for (var i = 0; i < degs.length; i++) {
      var f = SCALE[scaleIndexOf(degs[i])].freq;
      noteFn(f, t, dur, { glideFrom: prev, gain: 1, breath: 0.5, bend: i === degs.length - 1 });
      prev = f; t += dur * 0.9;
    }
  }
  function sampleDrone(t) {
    var dur = 3, lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(getLayerParam("subDrone", "cutoff", 220), t);
    var bus = ctx.createGain(); lp.connect(bus); bus.connect(lg("subDrone"));
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 0.8); bus.gain.setValueAtTime(1, t + dur - 1); bus.gain.linearRampToValueAtTime(0, t + dur);
    [degFreq(0, -1), degFreq(3, -1)].forEach(function (rf) {
      [-7, 7].forEach(function (det) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(rf, t); o.detune.setValueAtTime(det, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.05, t); o.start(t); o.stop(t + dur + 0.1); });
    });
    var so = ctx.createOscillator(), sg = ctx.createGain(); so.type = "sine"; so.frequency.setValueAtTime(degFreq(0, -2), t); so.connect(sg); sg.connect(lp); sg.gain.setValueAtTime(0.08, t); so.start(t); so.stop(t + dur + 0.1);
  }
  function sampleSho(t) {
    var dur = 3, lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(getLayerParam("sho", "cutoff", 1400), t);
    var bus = ctx.createGain(); lp.connect(bus); bus.connect(lg("sho"));
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(0.5, t + 0.8); bus.gain.setValueAtTime(0.5, t + dur - 1); bus.gain.linearRampToValueAtTime(0, t + dur);
    chooseAitake(S.sample, 6).freqs.forEach(function (f) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.045, t); o.start(t); o.stop(t + dur + 0.1); });
  }
  function sampleNoise(t) {
    var dur = 2.5, nz = noiseSource(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(3000, t + dur); bp.Q.setValueAtTime(4, t);
    var g = ctx.createGain(); nz.connect(bp); bp.connect(g); g.connect(lg("noise"));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); nz.start(t, S.sample.next() * 5); nz.stop(t + dur + 0.1);
  }
  function sample(layer) {
    init();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (bg) bg.poke();               // audition while stopped: the <audio> route must be live
    // The audition draws from its own stream: while it plays, every body
    // borrows S.sample so a ♪ press mid-performance re-rolls nothing.
    var borrowed = ["shakuhachi", "koto", "shamisen", "taiko", "ambient", "noise", "sho", "subDrone"], saved = {}, bi;
    for (bi = 0; bi < borrowed.length; bi++) { saved[borrowed[bi]] = S[borrowed[bi]]; S[borrowed[bi]] = S.sample; }
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    var node = layerGains[layer];
    if (node) { var vt = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1; node.gain.cancelScheduledValues(ctx.currentTime); node.gain.setValueAtTime((layerVolumes[layer] != null ? layerVolumes[layer] : DEFAULT_LAYER_VOL) * vt, ctx.currentTime); }
    var t = ctx.currentTime + 0.05;
    switch (layer) {
      case "subDrone": sampleDrone(t); break;
      case "sho": sampleSho(t); break;
      case "shakuhachi": samplePhrase(shakuhachiNote, t, [4, 2, 3, 0], 0.7); break;
      case "koto": samplePhrase(kotoNote, t, [0, 2, 3, 4, 2, 0], 0.4); break;
      case "shamisen": samplePhrase(shamisenNote, t, [0, 2, 0, 3, 0], 0.3); break;
      case "taiko": for (var i = 0; i < 4; i++) taikoHit(t + i * 0.22, i === 0); break;
      case "noise": sampleNoise(t); break;
      case "ambient": var e = AMBIENT_POOL[Math.floor(S.sample.next() * AMBIENT_POOL.length)]; try { e.fn(t); } catch (x) {} break;
    }
    for (bi = 0; bi < borrowed.length; bi++) S[borrowed[bi]] = saved[borrowed[bi]];
    emitEvent({ cat: "mode", label: "♪ sample", detail: layer });
  }

  // ==========================================================================
  // MIXER API
  // ==========================================================================
  function setMasterVolume(val) {
    masterVolume = Math.max(0, Math.min(1, val));
    if (ctx && masterGain && playing) { masterGain.gain.cancelScheduledValues(ctx.currentTime); masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime); }
  }
  function setLayerVolume(layer, val) { if (layerVolumes[layer] != null) { layerVolumes[layer] = Math.max(0, Math.min(1, val)); if (ctx) applyLayerGain(layer); } }
  function setLayerRate(layer, rate) {
    if (layerRate[layer] == null) return;
    layerRate[layer] = Math.max(0.05, rate);
    if (clock) lane(layer).rate = layerRate[layer];   // bends the lane's pending events in place
  }
  function toggleLayer(layer) { if (layerMuted[layer] == null) return false; layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return layerMuted[layer]; }
  function setLayerParam(layer, key, val) { if (layerParams[layer]) layerParams[layer][key] = val; }
  function resetLayerParams(layer) { if (LAYER_PARAM_DEFAULTS[layer]) layerParams[layer] = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS[layer])); }
  function getState() { return { playing: playing, masterVolume: masterVolume, layerVolumes: layerVolumes, layerMuted: layerMuted, layerRate: layerRate }; }

  // ==========================================================================
  // PUBLIC SURFACE
  // ==========================================================================
  return {
    init: init, play: play, stop: stop,
    setMasterVolume: setMasterVolume, setLayerVolume: setLayerVolume, setLayerRate: setLayerRate,
    setLayerParam: setLayerParam, getLayerParam: getLayerParam, resetLayerParams: resetLayerParams,
    toggleLayer: toggleLayer, getState: getState, sample: sample,
    LAYERS: LAYERS.slice(), LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS, DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    SCALE_INFO: SCALE_INFO,
    getArc: getArc, getArcInfo: arcInfo, getMetaInfo: getMetaInfo,
    getAirInfo: function () { return air ? air.info() : null; },
    getRooms: function () { return { hull: roomHull, corridor: roomCorridor, blend: roomBlend, farWall: farWall }; },
    getSeed: function () { return seed; },
    reseed: function (s) { seed = (s >>> 0) || 3042; if (S) forkStreams(); },
    getField: function () { return field; },
    getClock: function () { return clock; },
    getMotifStats: function () { return Motif.stats(); },
    getMode: function () { return { key: currentMode, name: MODES[currentMode].name, kana: MODES[currentMode].kana.slice(), tonicHz: field.tonicHz, tonic: noteName(field.tonicHz), offsets: MODES[currentMode].offsets.slice() }; },
    setNoteListener: function (fn) { if (typeof fn === "function") { if (noteListeners.indexOf(fn) < 0) noteListeners.push(fn); } else noteListeners.length = 0; },
    setEventListener: function (fn) { if (typeof fn === "function") { if (eventListeners.indexOf(fn) < 0) eventListeners.push(fn); } else eventListeners.length = 0; },
    getAudioContext: function () { return ctx; },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    attachAnalyser: function (node) { if (!masterGain || !node) return false; try { masterGain.connect(node); return true; } catch (e) { return false; } },
    attachLayerAnalyser: function (layer, node) { if (!layerGains[layer] || !node) return false; try { layerGains[layer].connect(node); return true; } catch (e) { return false; } },
    // dev tap on the buses (critic's instrument): dry (the room-bound sum),
    // grit (post makeup-down), hull / corridor (each room's wet return), farWall
    attachBusAnalyser: function (name, node) {
      var src = { dry: reverbSend, grit: gritMakeup, hull: roomHull && roomHull.output, corridor: roomCorridor && roomCorridor.output, farWall: farWall && farWall.output }[name];
      if (!src || !node) return false;
      try { src.connect(node); return true; } catch (e) { return false; }
    },
  };
})();
