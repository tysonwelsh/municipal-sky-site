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
  var halo = null, haloSend = null, layHalo = null, haloRetuneAt = null;         // Phase 3: the koto's sympathetic strings
  var weather = null;                                                            // Phase 3: PJ2.Fx.weather — the continuous modulator field
  var gritShaperB = null, gritBlendA = null, gritBlendB = null;                   // Phase 3: the second grit curve, crossfaded by the weather
  var screechBus = null;                                                         // Phase 3: the feedback-screech bodies' sum (tapped)
  var cutGrit = null, cutSho = null, cutAmb = null, cutTaiko = null;              // Phase 4: THE CUT — gains over the landscape groups (never the master); Phase M r3: the kit has its own
  var radioBus = null;                                                           // Phase 4: the lost broadcast's radio filter
  var duckGrit = null, duckSho = null, carveGrit = null, carveSho = null, carveGrit2 = null, carveSho2 = null, shelfGrit = null, shelfSho = null, pickGrit = null, pickSho = null;   // Phase M: THE CREW LOWERS ITS VOICE — one writer's gains and notches over the landscape
  var landscapeTap = null, outTrim = null;                                        // Phase M: dev taps — the landscape sum (grit bus + shō, as cut) and the output
  var layerIn = {}, presenceOf = {};                                              // Phase M: per-layer entry node → presence stage → the layer gain (so the tap hears it)
  var gritShaper = null;           // distortion bus (gritty instruments route here)
  var taikoShaper = null, taikoMakeup = null;   // Phase M (orchestrator Q4): the kit's own grit curve — it no longer shares the drone's clip
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
    "conductor", "air", "rooms", "fx",                                    // Phase 1: the form, the air, the rooms
    "hichiriki", "biwa", "pa", "halo",                                    // Phase 3: the new bodies
    "signal"];                                                             // S1: the receiver — reel choice, window, in-point, the dropouts (zk-broadcast.js)
  var S = null;                                // the streams, forked per play
  function forkStreams() {
    var master = PJ.Rand.stream(seed);
    S = {};
    for (var i = 0; i < STREAM_LABELS.length; i++) S[STREAM_LABELS[i]] = master.fork(STREAM_LABELS[i]);
    // THE WEATHER (Phase 3): PJ2.Fx.weather — slow deterministic drift the
    // whole engine reads at schedule time; built here, four draws per channel
    // at build and NONE after (the determinism contract). Knob values are
    // offsets on it: brightness (string lowpass, shō cutoff), breath
    // (shakuhachi noise / vowel, muraiki odds), gritColor (the noise layer's
    // filter centre; the grit curve's crud via the second curve's crossfade),
    // gapMul (±15 % on phrase gaps), roomTilt (±0.05 on the room balance).
    weather = PJ.Fx.weather(S.weather, ZK_WEATHER);
  }
  var ZK_WEATHER = {
    brightness: { period1: 331, period2: 487, depth: 0.42 },
    breath:     { period1: 211, period2: 389, depth: 0.38 },
    gritColor:  { period1: 293, period2: 557, depth: 0.45 },
    gapMul:     { period1: 173, period2: 443, depth: 0.35 },
    roomTilt:   { period1: 257, period2: 521, depth: 0.45 },
  };
  var WX_STILL = { brightness: 0.5, breath: 0.5, gritColor: 0.5, gapMul: 0.5, roomTilt: 0.5 };
  function wxAt(t) { return weather ? weather.at(t) : WX_STILL; }

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
  var TONIC_LO = 100, TONIC_HI = 200;         // not on a scale-tone edge (G3 = 195.998 would wobble across 196)
  function foldTonic(hz) { while (hz >= TONIC_HI) hz /= 2; while (hz < TONIC_LO) hz *= 2; return hz; }
  // THE SUB REGISTER folds on its own: the drone's saw roots live in 64–128 Hz
  // whatever the tonic (73.4 at D3, 98 at G2 and G3, 103.8 at A♭2), the fifth
  // folds into the same band, the sub sine is root/2 (never below 32 Hz —
  // at the low tonics degFreq(0, −2) went subsonic and ate the compressor's
  // headroom; critic, Phase 2). Geiger hum, bonshō and the audition drone
  // read the same helper.
  function foldInto(hz, lo, hi) { while (hz >= hi) hz /= 2; while (hz < lo) hz *= 2; return hz; }
  function subRoot() { return foldInto(field.tonicHz, 64, 128); }
  function subFifth() { return foldInto(subRoot() * Math.pow(2, 7 / 12), 64, 128); }
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
  var LAYERS = ["subDrone", "sho", "shakuhachi", "hichiriki", "koto", "shamisen", "biwa", "taiko", "noise", "ambient", "pa", "broadcast"];   // broadcast (S1): the receiver — a real reel from the past, heard in the hull
  // Shamisen is deliberately NOT routed through the grit bus: the grit curve's
  // ~27x small-signal makeup spikes its plucked onset into an audible click.
  // Its own sawari buzz + the master saturator keep it abrasive without that.
  var GRIT_LAYERS = { subDrone: true, taiko: true, noise: true }; // route through distortion

  var layerGains = {};
  var layerVolumes = { subDrone: 0.6, sho: 0.62, shakuhachi: 0.85, hichiriki: 0.7, koto: 0.6, shamisen: 0.75, biwa: 0.7, taiko: 0.62, noise: 0.5, ambient: 0.55, pa: 0.6, broadcast: 0.7 };
  var layerMuted   = { subDrone: false, sho: false, shakuhachi: false, hichiriki: false, koto: false, shamisen: false, biwa: false, taiko: false, noise: false, ambient: false, pa: false, broadcast: false };
  var layerRate    = { subDrone: 1, sho: 1, shakuhachi: 1, hichiriki: 1, koto: 1, shamisen: 1, biwa: 1, taiko: 1, noise: 1, ambient: 1, pa: 1, broadcast: 1 };
  var DEFAULT_LAYER_VOL = 0.7;

  var LAYER_PARAM_DEFAULTS = {
    subDrone:   { cutoff: 220, drive: 0.5, sub: 0.6, movement: 0.18 },
    sho:        { cutoff: 1400, voices: 5, shimmer: 0.4, drift: 0.5 },
    shakuhachi: { breath: 0.55, muraiki: 0.4, pace: 1.0, glide: 0.6, ornament: 0.5 },
    hichiriki:  { reed: 0.5, enbai: 0.6, breath: 0.35, pace: 1.0 },
    koto:       { brightness: 7, pace: 1.0, gliss: 0.4, sustain: 1.0, pluck: 0.5 },
    shamisen:   { sawari: 0.6, drive: 0.5, pace: 1.0, attack: 0.5 },
    biwa:       { sawari: 0.8, tremolo: 0.6, pace: 1.0 },
    taiko:      { punch: 0.6, drive: 0.5, lowTune: 1.0, kakegoe: 0.5 },
    noise:      { density: 0.4, color: 0.5, crush: 0.4 },
    ambient:    {},
    pa:         { presence: 0.5, static: 0.5 },
    broadcast:  { band: 0.5, flutter: 0.5, grit: 0.5 },   // S1: how narrow the radio band, how deep the fading, how much the receiver distorts
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));

  // Dark, long, slightly metallic reverb.
  var REVERB = { decay: 6.5, preDelay: 60, wet: 0.34, hfDamp: 1.1 };

  // Per-layer hidden trims (slider reads clean, effective value differs).
  // 0.9 on the main instruments: ~10% more air between phrases by default —
  // ambient and noise keep their pace (they're the weather, not the band).
  var LAYER_RATE_TRIM = { shakuhachi: 0.9, koto: 0.9, shamisen: 0.9, taiko: 0.9, hichiriki: 0.9, biwa: 0.9 };
  // Volume trim: shakuhachi + koto sit ~10% louder than their slider implies, so
  // they read more clearly in the mix without changing the displayed values.
  // shamisen 2.2: makes up the level it lost coming off the grit bus (which was
  // boosting it ~5-10x via the grit curve's makeup) so it sits in the mix again.
  // koto 1.25 / shamisen 2.5 (ZANKYŌ 2, Phase 1): +1.1 dB each — with the air
  // they are often the only line for 20–40 s and read under the drone bed
  // at the old trims (critic's real-audio measurement; owner may revert).
  // Phase M (the mix pass, the last lever, within the +3 dB budget): koto 1.25 → 1.6 (+2.1; the
  // pick burst rides its peak rows, the two together land at +3),
  // shamisen 2.5 → 3.0 (+1.6),
  // biwa 2.0 → 2.8, hichiriki and PA 1 → 1.4 (+2.9 dB each) — the bodies the owner
  // heard buried; the shakuhachi and the shamisen already read.
  var LAYER_VOL_TRIM = { shakuhachi: 1.1, koto: 1.6, shamisen: 3.0, biwa: 2.55, hichiriki: 1.4, pa: 1.4 };   // biwa 2.8 → 2.55 (round 2): its strums' picks summed per row pushed the peak to +3.4
  // PRESENCE (Phase M): a peaking boost on each body's defining band, chosen
  // from the masker map — the band where the landscape is weakest against the
  // voice — pre-attenuated (pre) so the compressor sees no new peak. Measured:
  // the koto's harmonics at 1–1.6 kHz come within 2–3 dB of the landscape
  // (its 2–4 kHz holds nothing: the string's lowpass sits at ~4 f); the biwa's
  // sawari lives at 1–2 kHz; the PA's F1 at 500–800 Hz; the hichiriki's
  // formants at 1.9–3.9 kHz over the landscape's flat crud.
  var PRESENCE = {
    // koto and shamisen: NO presence stage — measured, their bodies hold almost
    // nothing at 1.5–4 kHz (koto −73 dBFS in-band vs −47 at the fundamental; the
    // string's lowpass sits at ~4 f), so a boost there lifts nothing and only
    // spends the +3 dB peak budget; the budget goes to the trim instead. The
    // biwa's sawari does live at 1–3 kHz and keeps its boost.
    biwa:      { f: 2500, db: 3.0, q: 0.8, pre: 0.95 },
    hichiriki: { f: 2400, db: 2.5, q: 1.2, pre: 0.92 },
    pa:        { f: 1500, db: 3.0, q: 1.0, pre: 0.92 },   // the PA's band as measured, 0.8–3.2 kHz (F2 and the static), where the shō masks it
  };

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration) {
    roomSpeak(layer, startTime, duration, freq);   // Phase M: the crew hears who is about to speak
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
      if (typeof console !== "undefined" && console.error) console.error("ZankyoAudio lane " + (where && where.lane) + " threw at t=" + (where && where.t), err && err.stack ? err.stack : err);
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
    outTrim = ctx.createGain();
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
      // THE CUT (Phase 4, Sycorax's mechanics): the KIRU lives on dedicated
      // gains over the LANDSCAPE groups — shō, ambient, and the grit bus below
      // — never on the master. Three nodes, one schedule (kiru writes the same
      // envelope to each); the melodic voices are silenced by scheduling, not
      // gain, and their tails and the rooms ring into the hush. Tap "cut".
      cutSho = ctx.createGain(); cutSho.gain.setValueAtTime(1, ctx.currentTime);
      cutAmb = ctx.createGain(); cutAmb.gain.setValueAtTime(1, ctx.currentTime);
      cutGrit = ctx.createGain(); cutGrit.gain.setValueAtTime(1, ctx.currentTime);
      duckSho = ctx.createGain(); duckSho.gain.setValueAtTime(1, ctx.currentTime);
      carveSho = ctx.createBiquadFilter(); carveSho.type = "peaking"; carveSho.frequency.setValueAtTime(400, ctx.currentTime); carveSho.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveSho.gain.setValueAtTime(0, ctx.currentTime);
      shelfSho = ctx.createBiquadFilter(); shelfSho.type = "highshelf"; shelfSho.frequency.setValueAtTime(1500, ctx.currentTime); shelfSho.gain.setValueAtTime(LAND_SHELF_DB, ctx.currentTime);
      pickSho = ctx.createBiquadFilter(); pickSho.type = "peaking"; pickSho.frequency.setValueAtTime(2500, ctx.currentTime); pickSho.Q.setValueAtTime(0.8, ctx.currentTime); pickSho.gain.setValueAtTime(0, ctx.currentTime);
      carveSho2 = ctx.createBiquadFilter(); carveSho2.type = "peaking"; carveSho2.frequency.setValueAtTime(400, ctx.currentTime); carveSho2.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveSho2.gain.setValueAtTime(0, ctx.currentTime);
      sumSho.connect(duckSho); duckSho.connect(carveSho); carveSho.connect(carveSho2); carveSho2.connect(shelfSho); shelfSho.connect(pickSho); pickSho.connect(cutSho);   // the same duck, notches, shelf and pick dip as the grit bus (Phase M)
      cutSho.connect(reverbSend); roomBlend.register("sho", cutSho, 0.1);
      sumAmb.connect(cutAmb); cutAmb.connect(reverbSend); roomBlend.register("ambient", cutAmb, 0.15);
      // THE RADIO (Phase 4): the lost broadcast surfaces through this — a
      // bandpass the width of an old receiver, into the ambient sum.
      radioBus = ctx.createGain(); radioBus.gain.setValueAtTime(1, ctx.currentTime);
      var radioBp = ctx.createBiquadFilter(); radioBp.type = "bandpass"; radioBp.frequency.setValueAtTime(1300, ctx.currentTime); radioBp.Q.setValueAtTime(0.9, ctx.currentTime);
      radioBus.connect(radioBp); radioBp.connect(sumAmb);
      // THE FAR WALL: the corridor answering the koto — modulated, dark, low
      // feedback; the answer goes into the rooms like any voice. One seeded
      // draw at build (the drift LFO's phase) on the fx stream.
      farWall = PJ.Fx.delay(ctx, { timeS: 0.37, feedback: 0.28, damp: 1400, driftHz: 0.03, driftDepth: 0.004, wet: 0.28, rng: S.fx });   // wet 0.28 (critic P1 r2: 0.16 measured ~20 dB under the koto)
      farWall.output.connect(sumVoices);
      // THE KOTO'S SYMPATHETIC HALO (Phase 3): PJ2.Fx.sympathetic — eight
      // strings tuned to the field in the koto's register, never excited
      // directly: they hear the shakuhachi and the shamisen through a whisper
      // send and hum. Retuned ONLY at the first scene boundary after a sea
      // change (the straddle lesson applied to resonance). Loop gain: each
      // comb's lowpass is Q −6 dB (|H| ≤ 1), feedback 0.95 → the loop gain IS
      // 0.95 < 1; T60 ≈ ln(0.001)/ln(0.95) ≈ 135 round trips ≈ 0.9 s at 147 Hz.
      layHalo = ctx.createGain(); layHalo.gain.setValueAtTime(1, ctx.currentTime);
      layHalo.connect(sumVoices);
      halo = PJ.Fx.sympathetic(ctx, { nStrings: 8, freqs: haloFreqs(), out: layHalo, level: 0.08, feedback: 0.95, damp: 3000 });
      haloSend = ctx.createGain(); haloSend.gain.setValueAtTime(0.25, ctx.currentTime);   // a whisper that exists: target ≈ −27 dB rel master
      haloSend.connect(halo.input);
      // THE SCREECH BUS: the noise layer's feedback bodies sum here (tapped
      // for the critic) before the noise layer gain, so the layer's mute and
      // volume still own them.
      screechBus = ctx.createGain(); screechBus.gain.setValueAtTime(1, ctx.currentTime);

      gritShaper = ctx.createWaveShaper();
      gritShaper.curve = buildGritCurve(0.6);
      gritShaper.oversample = "4x";
      // THE SECOND GRIT CURVE (Phase 3): a cruddier shape, crossfaded with
      // the first by the weather's gritColor (equal-power chords on the
      // form pulse) — the grit's colour drifts, its level does not. Both
      // curves feed the SAME makeup-down stage.
      gritShaperB = ctx.createWaveShaper();
      gritShaperB.curve = buildGritCurve(0.9);
      gritShaperB.oversample = "4x";
      gritBlendA = ctx.createGain(); gritBlendA.gain.setValueAtTime(1, ctx.currentTime);
      gritBlendB = ctx.createGain(); gritBlendB.gain.setValueAtTime(0, ctx.currentTime);
      gritShaper.connect(gritBlendA); gritShaperB.connect(gritBlendB);
      // Makeup-DOWN: the grit curve boosts small signals ~27x and rails the bus
      // to full-scale under any real drone level, leaving the master zero
      // headroom — so every new note onset (koto, taiko) clips into an audible
      // click. Pull the gritty bus back to a sane level; the distortion timbre
      // is baked into the waveshape and survives the attenuation.
      // Phase M (the mix pass) — A FAULT FIXED AND A RE-BASE: since Phase 3 the
      // second curve (gritShaperB) had no input, so the weather's crossfade faded
      // the WHOLE grit bus by cos θ — down 15 dB at gritColor 0.9 — and every
      // "master ha −25" in the reports was that accident, not the mix. With the
      // input connected the bus holds its level; the makeup is re-based from 0.4
      // to 0.29 (−2.8 dB) so the fixed bus sits at rc.10's measured TIME-AVERAGE
      // (grit bus −17.9 dBFS mean vs −15.0 unfaded, both captures, both seeds):
      // the integrated loudness compares like with like, and the voices gain
      // ~2.8 dB of separation wherever the drone used to be full.
      gritMakeup = ctx.createGain();
      gritMakeup.gain.setValueAtTime(0.29, ctx.currentTime);
      gritBlendA.connect(gritMakeup); gritBlendB.connect(gritMakeup);
      // THE CREW LOWERS ITS VOICE (Phase M): between the makeup-down and the
      // KIRU's cut gain, a duck gain and a peaking notch that one writer
      // (roomPulse) drives while a melodic voice or the PA speaks — the
      // landscape steps back a few dB and opens at the speaking register.
      // Idle they are unity and flat: the grit is untouched when nobody plays.
      duckGrit = ctx.createGain(); duckGrit.gain.setValueAtTime(1, ctx.currentTime);
      carveGrit = ctx.createBiquadFilter(); carveGrit.type = "peaking"; carveGrit.frequency.setValueAtTime(400, ctx.currentTime); carveGrit.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveGrit.gain.setValueAtTime(0, ctx.currentTime);
      // THE PICK BAND KEPT CLEAR (Phase M, lever 2): a static high shelf, −3 dB
      // above 1.5 kHz, on the grit bus and the shō — the plucked bodies' 1.5–4 kHz
      // is where the drone's crud and the shō's shimmer sat 5–15 dB over the
      // koto's pick; the band holds ~0.1 % of the landscape's power, so the
      // loudness does not move and the hull's body below is untouched.
      shelfGrit = ctx.createBiquadFilter(); shelfGrit.type = "highshelf"; shelfGrit.frequency.setValueAtTime(1500, ctx.currentTime); shelfGrit.gain.setValueAtTime(LAND_SHELF_DB, ctx.currentTime);
      // and a DYNAMIC dip in the pick band (peaking 2.5 kHz, Q 0.8 → 1.4–4.5 kHz), opened only while a plucked voice speaks (the writer below), so the wall keeps its top when nobody plucks
      pickGrit = ctx.createBiquadFilter(); pickGrit.type = "peaking"; pickGrit.frequency.setValueAtTime(2500, ctx.currentTime); pickGrit.Q.setValueAtTime(0.8, ctx.currentTime); pickGrit.gain.setValueAtTime(0, ctx.currentTime);
      // r3: a SECOND notch per bus — notch 1 follows the plucked / reed / PA spans, notch 2 the shakuhachi's, so a koto under a flute has its own band cleared (one notch at the mean pitch cleared neither)
      carveGrit2 = ctx.createBiquadFilter(); carveGrit2.type = "peaking"; carveGrit2.frequency.setValueAtTime(400, ctx.currentTime); carveGrit2.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveGrit2.gain.setValueAtTime(0, ctx.currentTime);
      gritMakeup.connect(duckGrit); duckGrit.connect(carveGrit); carveGrit.connect(carveGrit2); carveGrit2.connect(shelfGrit); shelfGrit.connect(pickGrit); pickGrit.connect(cutGrit);
      cutGrit.connect(reverbSend); roomBlend.register("grit", cutGrit, -0.12);
      // dev tap: the LANDSCAPE as the critic measures it — the grit bus and the
      // shō after their cut gains (ambient events keep their own depth and are
      // not part of the sum the crew ducks)
      landscapeTap = ctx.createGain(); landscapeTap.gain.setValueAtTime(1, ctx.currentTime);
      cutGrit.connect(landscapeTap); cutSho.connect(landscapeTap); cutAmb.connect(landscapeTap);   // grit-cut + shō-cut + ambient-cut: the landscape exactly as it reaches the dry sum
      // THE KIT'S OWN CLIP (Phase M, the orchestrator's Q4): the taiko used to
      // ride the drone's shaper and lose the clip to it — a hit on a railed
      // drone gets ~14 dB less of the curve's gain than the drone does, so the
      // kit read 18 dB under the bus it was in. Now it has its own copy of the
      // grit curve (the same 0.6 shape, 4× oversampled) and its own makeup-down,
      // first set so a LOUD hit left the shaper at the level it entered (the curve
      // gives ~+17 dB at the rail; 0.13 took it back), then doubled by ruling —
      // see the makeup line below.
      // Into the KIRU's cut gain after the crew's chain: the cut still hushes the
      // kit; the crew does not duck or notch it (it is a voice, not the floor).
      taikoShaper = ctx.createWaveShaper(); taikoShaper.curve = buildGritCurve(0.6); taikoShaper.oversample = "4x";
      taikoMakeup = ctx.createGain(); taikoMakeup.gain.setValueAtTime(0.26, ctx.currentTime);   // r3 (orchestrator Q6): 0.13 → 0.26 — the one deliberate level move of the pass: a kit 17–19 dB under the drone is not audible; +6 dB puts its hits near the koto's level (~+0.15 dB integrated while it drums)
      // r3: the kit's own CUT gain (the KIRU hushes it with the landscape) into the
      // dry sum and the rooms like the grit, and into the dry-grit send it always
      // had — but NOT into the landscape tap: the kit is a voice, measured against
      // the landscape, not part of it.
      cutTaiko = ctx.createGain(); cutTaiko.gain.setValueAtTime(1, ctx.currentTime);
      taikoShaper.connect(taikoMakeup); taikoMakeup.connect(cutTaiko);
      cutTaiko.connect(reverbSend); roomBlend.register("taiko", cutTaiko, -0.12);
      // parallel dry path — crossfaded up by the arc so the kyū gets close + abrasive
      dryGritGain = ctx.createGain();
      dryGritGain.gain.setValueAtTime(0, ctx.currentTime);
      cutGrit.connect(dryGritGain); if (cutTaiko) cutTaiko.connect(dryGritGain);
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
      // PRESENCE, NOT GAIN (Phase M): every source of a layer enters through
      // layerIn; the named bodies pass a small peaking boost on their defining
      // band — pre-attenuated so the compressor sees no new peak — before the
      // layer gain, so the layer tap (the critic's) hears exactly what the mix does.
      var entry = ctx.createGain(), pr = PRESENCE[layer];
      entry.gain.setValueAtTime(pr ? pr.pre : 1, ctx.currentTime);
      if (pr) {
        var pk = ctx.createBiquadFilter(); pk.type = "peaking";
        pk.frequency.setValueAtTime(pr.f, ctx.currentTime); pk.Q.setValueAtTime(pr.q, ctx.currentTime); pk.gain.setValueAtTime(pr.db, ctx.currentTime);
        entry.connect(pk); pk.connect(node); presenceOf[layer] = pk;
      } else entry.connect(node);
      layerIn[layer] = entry;
      if (layer === "taiko" && effectsReady && taikoShaper) node.connect(taikoShaper);                                            // Phase M: the kit's own clip (Q4)
      else if (GRIT_LAYERS[layer] && effectsReady && gritShaper) { node.connect(gritShaper); if (gritShaperB) node.connect(gritShaperB); }   // Phase M: the second curve finally HAS an input (see the makeup note)
      else if (layer === "shamisen" && effectsReady && shamEdge) node.connect(shamEdge);
      else if (layer === "sho" && effectsReady && sumSho) node.connect(sumSho);
      else if (layer === "ambient" && effectsReady && sumAmb) node.connect(sumAmb);
      else if (layer === "broadcast" && effectsReady && roomBlend) {
        // THE RECEIVER (S1): the reel is heard IN the reactor hall — registered
        // with the blend a step deeper than the ambient (+0.3), into the dry
        // sum like every room-bound source, and a low send to the far wall (the
        // corridor repeats a syllable). Not through the KIRU's cut: a signal is
        // never seated where the KIRU falls.
        node.connect(reverbSend); roomBlend.register("broadcast", node, 0.3);
        if (farWall) { var bcFw = ctx.createGain(); bcFw.gain.setValueAtTime(0.35, ctx.currentTime); node.connect(bcFw); bcFw.connect(farWall.send); }
      }
      else if (layer === "biwa" && effectsReady && shamEdge) node.connect(shamEdge);      // the biwa shares the shamisen's saturator (stateless)
      else if (effectsReady && sumVoices) {
        node.connect(sumVoices);
        if ((layer === "koto" || layer === "pa") && farWall) node.connect(farWall.send);   // the corridor answers the koto and the PA
        if ((layer === "shakuhachi" || layer === "shamisen") && haloSend) node.connect(haloSend);   // the koto's strings hear them
      }
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
    if (screechBus && layerIn.noise) screechBus.connect(layerIn.noise);
  }
  // The halo's strings: the field's degrees across the koto's two octaves
  // (D3–D5 at home), eight of them.
  function haloFreqs() {
    var out = [];
    for (var i = 0; i < 8; i++) out.push(field.degFreq(i, 0));
    return out;
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

  function lg(layer) { return layerIn[layer] || layerGains[layer]; }   // the layer's ENTRY (Phase M: through the presence stage into the layer gain)
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
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(lg(layer)); return sp;
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
  // THE HOLD (S1): while a signal is up the melodic voices may not claim the
  // air at all — pj2-air's limit floor is 1, so the hold lives here as a
  // per-voice window {from, until}; a claim inside it is denied (counted).
  // The drones, shō, noise and ambient never ask, so they continue.
  var airHold = {}, airHoldDenials = 0;
  function airClaimAt(t, voice, span, margin) {
    airT = t;
    var h = airHold[voice];
    if (h && t >= h.from && t < h.until) { airHoldDenials++; return null; }
    return air.tryClaim(voice, span, margin);
  }
  var signalProvider = null;                     // zk-broadcast.js installs itself here (S1)
  function signalUp(t) { for (var k in airHold) { var h = airHold[k]; if (h && t >= h.from && t < h.until) return true; } return false; }   // a signal holds the air at t
  var cyc = { n: -1, kind: "ordinary", seating: null, seatingLabel: "", durS: 420, startT: 0, mode: "hirajoshi", visit: null };
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
  var MELODIC = ["shakuhachi", "koto", "shamisen", "hichiriki", "biwa"];
  // SEATING — every draw is taken unconditionally (stream discipline), the
  // named seating then overrides, the kind tilts, and a guarantee keeps at
  // least one melodic voice unless the station is dead.
  function drawSeating(rng, kind) {
    var named = rng.pickW([["free", 6.5], ["shakuhachi alone", 1.2], ["danmono", 1.0], ["taiko-led", 0.8],
      ["dead station", (kind === "drift" || kind === "silence") ? 1.1 : 0.45]]);
    if (cyc.n < 0 && named === "dead station") named = "free";   // the first cycle must show the bodies before their absence can mean anything
    if (lastCycleEmpty && named === "dead station") named = "free";   // never two empty cycles in a row (critic, Phase 4)
    var s = { shakuhachi: rng.chance(0.78), koto: rng.chance(0.75), shamisen: rng.chance(0.72), taiko: rng.chance(0.75), sho: rng.chance(0.8), entry: {}, named: named,
      // Phase 3: the hichiriki lives in the rite (always) and visits elsewhere; the biwa belongs to drift and silence
      hichiriki: rng.chance(kind === "rite" ? 1 : 0.3), biwa: rng.chance(kind === "drift" || kind === "silence" ? 0.65 : 0.15) };
    if (named === "shakuhachi alone") { s.shakuhachi = true; s.entry.koto = "ha"; s.entry.shamisen = "ha"; }
    else if (named === "danmono") { s.koto = true; s.shamisen = false; }
    else if (named === "taiko-led") { s.taiko = true; s.shakuhachi = true; s.entry.shakuhachi = "reprise"; if (!s.koto && !s.shamisen) s.koto = true; }   // the plucked voices carry a taiko-led cycle
    else if (named === "dead station") { s.shakuhachi = s.koto = s.shamisen = s.taiko = s.hichiriki = s.biwa = false; s.sho = true; }   // dead, not switched off: the shō is a drone here
    if (kind === "rite") s.sho = true;
    if (kind === "storm") s.taiko = true;
    if (kind === "silence" && s.shakuhachi && s.koto && s.shamisen) s.shamisen = false;
    if (kind === "rite") s.hichiriki = true;
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
    var visit = drawVisitation(rng, kind, tp, seating);   // 客 at most one guest per cycle, on its own dice
    if (visit && visit.name === "mu") { seating.shakuhachi = seating.koto = seating.shamisen = seating.taiko = seating.hichiriki = seating.biwa = seating.sho = false; seating.named = "dead station"; seating.label = "mu (dead station)"; }
    if (visit && visit.name === "the festival") seating.taiko = true;
    var subDraw = rng.chance(Kd.sub), subKind = rng.pickW([["kakeai", 3], ["koto", 2], ["breath", 2]]);
    var oroDraw = rng.chance(Kd.oroshi);
    var melodicSeated = 0;
    for (var i = 0; i < 3; i++) if (seating[MELODIC[i]] && seating.entry[MELODIC[i]] !== "reprise") melodicSeated++;   // the kakeai is the sankyoku trio's
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
    if (visit) {                                    // seat the guest in the scene where it belongs
      var want = visit.name === "the festival" ? "ha" : visit.name === "the tolling" ? "jo" : visit.name === "mu" ? "jo" : (visit.name === "the line" ? "jo" : "ha");
      var idx = -1;
      for (var vi = 0; vi < scenes.length; vi++) if (scenes[vi].type === want) { idx = vi; break; }
      if (idx < 0) idx = 0;
      visit.sceneIdx = idx; visit.scene = scenes[idx].type;
    }
    pendingPlan = { kind: kind, mode: mode, seating: seating, durS: durS, pitch: pitch, visit: visit, sceneDurS: scenes.map(function (sc) { return sc.durS; }) };
    return scenes;
  }
  // 客 VISITATIONS (Phase 4) — rare seeded guests. Each rolls its OWN die every
  // cycle (unconditionally; the tide tilts the odds, the kind doubles them
  // where they belong); if more than one is drawn, one is picked — never two
  // in one cycle. Cycle 0 never hosts one.
  //   放送 the broadcast — a lost gagaku recording surfaces through the static
  //   祭 the festival   — the taiko goes to a full matsuri pattern with kakegoe for one ha
  //   無 mu             — a cycle where only the reactor and the ambient breathe; the KIRU cuts silence
  //   回線 the line     — the PA and the comms-vox trade a conversation over static; nothing else claims the air
  //   鐘 the tolling    — the bonshō every ~20 s across the whole jo, the hull ringing in sympathy
  var VISITATIONS = ["the broadcast", "the festival", "mu", "the line", "the tolling"];
  var VISIT_KANA = { "the broadcast": "放送", "the festival": "祭", "mu": "無", "the line": "回線", "the tolling": "鐘" };
  function drawVisitation(rng, kind, tp, seating) {
    var p = {
      "the broadcast": kind === "broadcast" ? 1 : (0.30 + 0.08 * tp) * (kind === "drift" ? 1.5 : 1),   // S1: the signal about one cycle in three (the critic measured 0.3 per 3 on the base); a 放送 cycle always carries one
      "the festival":  (0.10 + 0.10 * tp) * (kind === "storm" ? 2 : 1),
      "mu":            (0.03 + 0.03 * (1 - tp)) * (kind === "drift" || kind === "silence" ? 1.5 : 1),   // rare: a dead night is one cycle, not a third of them
      "the line":      0.07 * (kind === "broadcast" ? 1.8 : 1),
      "the tolling":   (0.09 + 0.05 * tp) * (kind === "rite" ? 2 : 1),
    };
    var drawn = [];
    for (var i = 0; i < VISITATIONS.length; i++) { var hit = rng.chance(p[VISITATIONS[i]]); if (hit) drawn.push([VISITATIONS[i], VISITATIONS[i] === "the broadcast" ? 1.5 : 1]); }   // S1: the signal leans a collision its way (same draw count; 2.5 starved the other guests)
    var pick = rng.pickW(drawn.length ? drawn : [["none", 1]]);   // one pickW draw either way
    if (cyc.n < 0 || pick === "none") return null;
    if (pick === "the festival" && seating.named === "dead station") return null;
    if (pick === "mu" && (lastCycleEmpty || seating.named === "dead station")) return null;   // never two empty cycles in a row
    return { name: pick };
  }
  var visitActive = null;                          // the guest in progress: { name, until }
  var lastCycleEmpty = false;                      // the previous cycle was mu or a dead station
  function fireVisitation(v, t) {
    var name = v.name;
    emitEvent({ cat: "form", label: "客 " + VISIT_KANA[name] + " " + name, detail: "begins · " + scn.type + " · " + Math.round(scn.durS) + "s" }, t);
    if (name === "the broadcast") {
      var took = false;
      if (signalProvider) { try { took = !!signalProvider.fire(t); } catch (e) { took = false; } }   // S1: the receiver takes it when it can (it decides at t0 − 1 and falls back itself)
      if (!took) visitBroadcast(t);
    }
    else if (name === "the festival") visitActive = { name: name, until: scn.startT + scn.durS };
    else if (name === "the line") visitLine(t);
    else if (name === "the tolling") visitTolling(t);
    // mu is the seating itself; the KIRU cuts silence
  }
  // 放送 THE BROADCAST — an Etenraku-SHAPED contour (shape only, no quotation):
  // hichiriki + a flute (the shakuhachi's kan register an octave up, a breath
  // behind) over a shō aitake, all through the radio bandpass and a bed of
  // static; fades in from the static and dissolves back into it. Takes the
  // air if it can; a radio does not ask twice.
  var ETENRAKU_SHAPE = [[3, 2], [4, 1], [3, 2], [2, 1], [0, 3], [2, 1], [3, 1], [4, 2], [5, 1], [4, 1], [3, 3], [2, 1], [0, 4]];
  function visitBroadcast(t0) {
    var R = S.visit, t = t0 + 2, beat = 1.35 + R.rnd(0, 0.4), total = 0, i;
    for (i = 0; i < ETENRAKU_SHAPE.length; i++) total += ETENRAKU_SHAPE[i][1] * beat;
    var dur = total + 6;
    airClaimAt(t0, "broadcast", dur, 4);
    // the static bed: rises, holds under, swallows the end
    var nz = noiseSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(1800, t0);
    nz.connect(hp); hp.connect(ng); ng.connect(radioBus);
    PJ.Voice.env(ng.gain, t0, [[2, 0.05], [dur - 6, 0.025], [3, 0.06], [1.5, 0]]);
    nz.start(t0, R.next() * 10); nz.stop(t0 + dur + 2);
    var fade = ctx.createGain(); fade.connect(radioBus);
    PJ.Voice.env(fade.gain, t0, [[3, 0.9], [dur - 7, 0.9], [4, 0]]);
    var base = scaleIndexOf(6), prev = null;
    // the shō under it: one aitake for the whole recording, through the radio
    var ait = chooseAitake(R, 5), c = ctx;
    for (i = 0; i < ait.freqs.length; i++) {
      var so = c.createOscillator(), sg = c.createGain(); so.type = "sawtooth"; so.frequency.setValueAtTime(ait.freqs[i], t);
      var slp = c.createBiquadFilter(); slp.type = "lowpass"; slp.frequency.setValueAtTime(1400, t);
      so.connect(slp); slp.connect(sg); sg.connect(fade);
      PJ.Voice.env(sg.gain, t, [[3, 0.03], [total - 3, 0.03], [3, 0]]);
      so.start(t); so.stop(t + total + 3.2);
      emitNote("sho", ait.freqs[i], t);
    }
    var tt = t;
    for (i = 0; i < ETENRAKU_SHAPE.length; i++) {
      var deg = base + ETENRAKU_SHAPE[i][0], d = ETENRAKU_SHAPE[i][1] * beat;
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, deg))].freq;
      hichirikiNote(f, tt, d * 0.95, { glideFrom: prev, gain: 0.7, out: fade });
      var f2 = SCALE[Math.max(0, Math.min(SCALE.length - 1, deg + 5))].freq;   // the flute an octave up, a breath behind
      shakuhachiNote(f2, tt + 0.12 + R.rnd(0, 0.1), d * 0.85, { glideFrom: prev ? prev * 2 : null, breath: 0.7, out: fade });
      prev = f; tt += d;
    }
    emitEvent({ cat: "form", label: "客 放送 the recording dissolves", detail: Math.round(dur) + "s" }, t0 + dur);
  }
  // 回線 THE LINE — the PA and the comms-vox trade a conversation over static
  // for 40–90 s; nothing else claims the air (the line holds it).
  function visitLine(t0) {
    var R = S.visit, dur = 40 + R.rnd(0, 50), t = t0 + 1;
    var tok = airClaimAt(t0, "line", dur, 5);
    var nz = noiseSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2500, t0);
    nz.connect(hp); hp.connect(ng); ng.connect(lg("pa"));
    PJ.Voice.env(ng.gain, t0, [[1, 0.02], [dur - 2, 0.02], [1, 0]]);
    nz.start(t0, R.next() * 10); nz.stop(t0 + dur + 0.2);
    var who = 0;
    while (t < t0 + dur - 4) {
      if (who === 0) { var d = 1.5 + R.rnd(0, 2); paSpeak(t, d, { gain: 0.8 }); t += d + 0.6 + R.rnd(0, 1.2); }
      else { ambCommsVox(t); t += 1.2 + R.rnd(0, 1.5); }
      who = 1 - who;
      if (R.next() < 0.15) t += 2 + R.rnd(0, 3);   // a long pause on the line
    }
    if (tok) tok.until = t0 + dur + 5;
    emitEvent({ cat: "form", label: "客 回線 the line goes dead", detail: Math.round(dur) + "s" }, t0 + dur);
  }
  // 鐘 THE TOLLING — the bonshō every ~20 s across the whole jo; the room goes
  // all the way into the hull and the koto's strings ring with every stroke.
  function visitTolling(t0) {
    var R = S.visit, t = t0 + 3, end = scn.startT + scn.durS - 5, n = 0;
    if (roomBlend) { try { roomBlend.setBalance(1, 6); } catch (e) {} }
    while (t < end) { ambBonsho(t, { halo: true }); n++; t += 18 + R.rnd(0, 6); }
    emitEvent({ cat: "form", label: "客 鐘 the tolling", detail: n + " strokes across the jo" }, t0);
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
      kyu:     sceneDef("kyu", 2, 0.45),        // five melodic voices now: two hold the kyū, a third by the dice — the tangle earned, not the norm
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
      if (pm) haloRetuneAt = evt.t;                 // the strings ring on in the old world until the next boundary
      if (pm && pm.kind !== "pivot") {
        cyclesSinceSea = 0;
        emitEvent({ cat: "mode", label: "海 sea change", detail: fromName + " → " + noteName(field.tonicHz) + " · " + pm.label + " · " + MODES[p.mode].name + " · cycle " + cyc.n }, evt.t);
      }
      emitEvent({ cat: "form", label: "❁ cycle plan", detail: KINDS[p.kind].kana + " kind: " + p.kind + " · seating: " + p.seating.label + " · scenes: " + evt.scenes.join(">") }, evt.t);
      cyc.visit = p.visit || null; visitActive = null;
      lastCycleEmpty = !!(p.seating && p.seating.named === "dead station");
      if (p.visit) emitEvent({ cat: "form", label: "客 " + VISIT_KANA[p.visit.name] + " " + p.visit.name, detail: "visitation: " + p.visit.name + " · seated in " + p.visit.scene + " (" + (p.visit.sceneIdx + 1) + "/" + evt.scenes.length + ")" }, evt.t);
      // S1: the receiver is ARMED at plan time — it draws the reel and schedules
      // its prefetch from the hosting scene's start (≥ 20 s before any t0)
      if (p.visit && p.visit.name === "the broadcast" && signalProvider && p.sceneDurS) {
        var hostStart = evt.t; for (var hi = 0; hi < p.visit.sceneIdx; hi++) hostStart += p.sceneDurS[hi];
        try { signalProvider.arm({ cycle: cyc.n, kind: p.kind, hostStartT: hostStart, hostDurS: p.sceneDurS[p.visit.sceneIdx], tidePos: evt.tidePos }); } catch (e) {}
      }
      Motif.newCycle(evt.t);
    } else if (evt.type === "scene") {
      scn.type = evt.scene; scn.activity = evt.activity; scn.startT = evt.t; scn.durS = evt.durS;
      Motif.setDialogue(evt.scene === "kakeai" ? { postMul: 1.6, types: [["imitate", 6], ["invert", 1], ["develop", 1]] } : null);
      emitEvent({ cat: "form", label: "▸ scene", detail: "scene: " + evt.scene + (evt.activity ? " (" + evt.activity + ")" : "") + " · " + Math.round(evt.durS) + "s · " + (evt.idx + 1) + "/" + evt.count }, evt.t);
      setSceneRoom(evt);
      if (visitActive && evt.t >= visitActive.until) visitActive = null;
      if (cyc.visit && cyc.visit.sceneIdx === evt.idx && !cyc.visit.fired) { cyc.visit.fired = true; try { fireVisitation(cyc.visit, evt.t + (cyc.visit.name === "the tolling" ? 0 : S.visit.rnd(8, 25))); } catch (e) {} }
    }
  }
  // Room balance per scene (0 = the corridor, close; 1 = the hull, vast):
  // jo deep in the hull, kyū close and dry with the grit send open, release
  // back to the hull for the bell. Ramped 8–16 s on the rooms stream.
  var ROOM_BALANCE = { jo: 0.85, ha: 0.5, kakeai: 0.45, solo: 0.65, oroshi: 0.3, kyu: 0.12, release: 0.9 };
  function setSceneRoom(evt) {
    var rampS = Math.min(S.rooms.rnd(8, 16), 0.6 * evt.durS);   // draw first, unconditionally; short scenes arrive in their room
    if (!roomBlend) return;
    var bal = clamp01((ROOM_BALANCE[evt.scene] != null ? ROOM_BALANCE[evt.scene] : 0.5) + 0.1 * (wxAt(evt.t).roomTilt - 0.5));   // the weather's ±0.05
    try { roomBlend.setBalance(bal, rampS); } catch (e) {}
    // the koto's halo retunes at the first scene boundary AFTER a sea change
    if (haloRetuneAt != null && evt.t > haloRetuneAt + 0.5 && halo) { haloRetuneAt = null; try { halo.retune(haloFreqs()); } catch (e2) {} }
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
  function gapMulAt(t) { return 0.85 + 0.3 * wxAt(t).gapMul; }   // the weather's ±15 % on phrase gaps
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
    if (scn.type === "kakeai" && (voice === "hichiriki" || voice === "biwa")) return false;   // the duet is the trio's
    if (voice === "biwa" && arcPhase(t) === "kyū") return false;                             // the narrator falls silent when the storm comes
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
    if (visitActive && visitActive.name === "the festival" && pulse.active && pulse.beat > 0) return 0.95;   // 祭 the ensemble locks hard
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
      var N = field.size, deg = scaleIndexOf(cls) + N * R.rint(0, 1);   // absolute degree index in the mid band
      for (var i = 0; i < n; i++) {
        var last = i === n - 1;
        var row = BORN_ROWS[((cls % N) + N) % N] || BORN_ROWS[0];
        var pool = [];
        for (var c = 0; c < N; c++) pool.push([c, (row[c] || 1) * (last && c === 0 ? 3 : 1)]);   // descents end on the tonic
        var next = R.pickW(pool);
        var up = R.next() < 0.5, dirDraw = R.next();
        // tendency rules
        if (cls === 1 && next === 0) up = false;                                   // the second falls
        else if (cls === 3 && next === 0) up = dirDraw < 0.6;                      // the fifth leaps to the octave
        else if (cls === 4 && next === 3) up = false;                              // the sixth sinks
        var cur = ((deg % N) + N) % N, delta = ((next - cur) % N + N) % N;         // steps up to reach `next`
        deg = up ? deg + delta : deg - (N - delta) % N;
        if (delta === 0) deg += up ? N : -N;                                       // same class → the octave
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
      // the hichiriki stretches and mirrors (the reed holds a line); the biwa splinters and reverses (the narrator's fragments)
      hichiriki: { augment: 3.5, invert: 2.5, transpose: 2.5, fragmentHead: 2, fragmentTail: 1.5, retrograde: 1, ornament: 0.5, sequence: 0.5, diminish: 0.3 },
      biwa: { fragmentHead: 3, fragmentTail: 3, retrograde: 2, augment: 2, transpose: 2, invert: 1.5, diminish: 1, sequence: 0.5, ornament: 0.3 },
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
    var POST_P = { shakuhachi: 0.45, koto: 0.4, shamisen: 0.35, hichiriki: 0.3, biwa: 0.25 };   // ≈ the old per-voice answer densities
    var POST_TO = {
      shakuhachi: [["koto", 3], ["shamisen", 2], ["hichiriki", 1]],
      koto: [["shakuhachi", 3], ["shamisen", 2], ["biwa", 1]],
      shamisen: [["koto", 3], ["shakuhachi", 2]],
      hichiriki: [["shakuhachi", 3], ["koto", 1]],
      biwa: [["koto", 2], ["shakuhachi", 1]],
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
        sub1.gen = Math.min(inherit.gen, 3);            // room to develop: at its old g8–9 the line renewed to itself and froze
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
    var roots = [subRoot(), subFifth()];
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
      so.type = "sine"; so.frequency.setValueAtTime(subRoot() / 2, now);
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
    var cutoff = getLayerParam("sho", "cutoff", 1400) * (0.8 + 0.4 * wxAt(t).brightness);   // the weather breathes the shō's cutoff
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
      var mur = (i === 0 && S.shakuhachi.next() < muraiki * (0.4 + arc * 0.6) * (breathSolo ? 3 : 1) * (0.6 + 0.8 * wxAt(t).breath));
      shakuhachiNote(f, t, dur, { glideFrom: glideFrom, breath: breath, muraiki: mur ? muraiki : 0, bend: S.shakuhachi.next() < ornament || !!n.meri, atari: prev === f });   // a born descent ends in a meri dip; a repeated pitch is an atari
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
    var ma = (1.8 + S.shakuhachi.next() * 4) * (1 - arc * 0.55) * metaRestMul() * gapMulAt(t) / trimOf("shakuhachi");
    afterRaw("shakuhachi", now, (t - now) + ma, shakuhachiPhrase);
  }
  // The shakuhachi body (Phase 3): two REGISTERS with different bodies —
  // otsu (low, dark, sine-heavy) below A4, kan (overblown: breathier, more
  // 3rd partial, brighter) above; breath through TWO formant bandpasses (the
  // bore's own, and a vowel around 2.8 kHz); YURI vibrato that blooms late in
  // a long note (an LFO on the oscillators — an audio-rate input, never an
  // automation writer); meri/kari as pitch AND timbre (the meri dip darkens
  // the tone through the note's own lowpass); MURAIKI as a real
  // noise-dominant tone (the breath outweighs the tone for the attack);
  // tongue-less ATARI re-attacks on repeated pitches (a dip, not a strike).
  // The weather's breath channel breathes the noise and the vowel.
  function shakuhachiNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var R = S.shakuhachi, wx = wxAt(t);
    var kan = freq >= 440;
    var out = opts.out || panAt("shakuhachi", (R.next() * 2 - 1) * 0.25);
    var o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "sine"; o2.type = kan ? "sine" : "triangle";
    var f2mul = kan ? 3 : 1;                                   // kan: the 3rd partial rides along; otsu: the triangle body
    if (opts.glideFrom) {                          // meri-kari slide
      var gt = Math.min(dur * 0.5, 0.4);
      o.frequency.setValueAtTime(opts.glideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + gt);
      o2.frequency.setValueAtTime(opts.glideFrom * f2mul, t); o2.frequency.exponentialRampToValueAtTime(freq * f2mul, t + gt);
    } else { o.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq * f2mul, t); }
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.setValueAtTime(0.7, t);
    var cut = Math.min(16000, freq * (kan ? 10 : 6));
    lp.frequency.setValueAtTime(cut, t);
    if (opts.bend) {                               // meri: the pitch dips AND the tone darkens
      o.frequency.exponentialRampToValueAtTime(freq * 0.97, t + dur * 0.6);
      o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.85);
      lp.frequency.linearRampToValueAtTime(cut * 0.45, t + dur * 0.6);
      lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.9);
    }
    var g = c.createGain(), g2 = c.createGain(), mix = c.createGain();
    o.connect(g); g.connect(mix); o2.connect(g2); g2.connect(mix); mix.connect(lp); lp.connect(out);
    mix.gain.setValueAtTime(1, t);
    var peak = 0.16 * (opts.muraiki ? 0.7 : 1);                  // the lead's presence; muraiki lets the breath lead
    var atk = opts.atari ? 0.06 : 0.09;
    if (opts.atari) {                              // a dip and a swell, no new strike
      PJ.Voice.env(g.gain, t, [[0.004, peak * 0.35], [atk, peak], [Math.max(0.1, dur - atk - 0.22), peak], [0.22, 0]]);
    } else {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + atk);
      g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.22));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    var p2 = peak * (kan ? 0.18 : 0.25);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(p2, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
    // YURI — vibrato that blooms late in a long note
    if (dur > 1.2) {
      var lfo = c.createOscillator(), lg0 = c.createGain();
      lfo.type = "sine"; lfo.frequency.setValueAtTime(4.8 + R.next() * 1.2, t);
      var depth = freq * 0.007;                                 // ≈ ±12 cents at full bloom
      PJ.Voice.env(lg0.gain, t, [[dur * 0.45, 0], [dur * 0.4, depth], [dur * 0.15, 0]]);
      lfo.connect(lg0); lg0.connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    // breath noise through two formants + muraiki (the gritty explosive attack)
    var br = (opts.breath == null ? 0.5 : opts.breath) * (0.7 + 0.6 * wx.breath) * (kan ? 1.6 : 1);
    if (br > 0.01 && sharedNoiseBuf) {
      var nz = noiseSource(), ng = c.createGain();
      var bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.setValueAtTime(freq * 2.4, t); bpf.Q.setValueAtTime(1.4, t);
      var vow = c.createBiquadFilter(); vow.type = "bandpass"; vow.frequency.setValueAtTime(2200 + 1200 * wx.breath, t); vow.Q.setValueAtTime(3, t);
      var vg = c.createGain(); vg.gain.setValueAtTime(0.5, t);
      nz.connect(bpf); bpf.connect(ng); nz.connect(vow); vow.connect(vg); vg.connect(ng); ng.connect(out);
      var bpeak = 0.02 * br + 0.14 * (opts.muraiki || 0);      // muraiki: the breath leads
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(bpeak, t + (opts.muraiki ? 0.015 : 0.09));
      ng.gain.exponentialRampToValueAtTime(0.0001, t + (opts.muraiki ? Math.min(dur, 0.5) : dur));
      nz.start(t, R.next() * 20); nz.stop(t + dur + 0.1);
    }
    emitNote("shakuhachi", freq, t, dur);
  }

  // ==========================================================================
  // HICHIRIKI 篳篥 — the gagaku double reed (Phase 3; Kolob's chanter recipe
  // re-voiced): a detuned sawtooth pair, PRE-ATTENUATED, through a reed-buzz
  // waveshaper, coloured by two fixed nasal formants and a breath of air;
  // the characteristic ENBAI slide into every note. Piercing, so it sits at
  // whisper gain before the formants (the Bardo lesson). A melodic voice:
  // claims the air; seated always in a rite, sometimes elsewhere; in the kyū
  // it takes the cry — long high notes.
  // ==========================================================================
  var reedCurveCache = {};
  function reedCurve(amount) {
    var key = amount.toFixed(2);
    if (reedCurveCache[key]) return reedCurveCache[key];
    var n = 1024, cv = new Float32Array(n), k = 3 + amount * 12;
    for (var i = 0; i < n; i++) { var x = (i / (n - 1)) * 2 - 1; cv[i] = (1 - amount) * x + amount * (Math.tanh(k * x) / Math.tanh(k)); }
    reedCurveCache[key] = cv;
    return cv;
  }
  function hichirikiNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var R = S.hichiriki, wx = wxAt(t);
    var reed = getLayerParam("hichiriki", "reed", 0.5), enbai = getLayerParam("hichiriki", "enbai", 0.6), breathAmt = getLayerParam("hichiriki", "breath", 0.35) * (0.7 + 0.6 * wx.breath);
    var out = opts.out || panAt("hichiriki", (R.next() * 2 - 1) * 0.3);
    var mix = c.createGain(); mix.gain.setValueAtTime(0.5, t);
    var slideFrom = opts.glideFrom || freq * Math.pow(2, -(0.4 + enbai * 0.6) / 12);   // the enbai: from below, always
    var slideT = 0.1 + enbai * 0.15;
    for (var d = 0; d < 2; d++) {
      var o = c.createOscillator(); o.type = "sawtooth";
      o.detune.setValueAtTime(d ? 4 : -4, t);
      o.frequency.setValueAtTime(slideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + Math.min(slideT, dur * 0.4));
      if (opts.bend) { o.frequency.exponentialRampToValueAtTime(freq * 0.975, t + dur * 0.6); o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.85); }
      o.connect(mix); o.start(t); o.stop(t + dur + 0.5);
    }
    var pre = c.createGain(); pre.gain.setValueAtTime(0.22, t);     // pre-attenuate before the buzz + the formants
    var shaper = c.createWaveShaper(); shaper.curve = reedCurve(0.45);
    mix.connect(pre); pre.connect(shaper);
    var fmix = c.createGain(); fmix.gain.setValueAtTime(1, t);
    var dry = c.createGain(); dry.gain.setValueAtTime(0.5, t); shaper.connect(dry); dry.connect(fmix);
    var bp1 = c.createBiquadFilter(); bp1.type = "bandpass"; bp1.frequency.setValueAtTime(1900 + reed * 700, t); bp1.Q.setValueAtTime(6, t);
    var g1 = c.createGain(); g1.gain.setValueAtTime(0.8, t); shaper.connect(bp1); bp1.connect(g1); g1.connect(fmix);
    var bp2 = c.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.setValueAtTime(3100 + reed * 800, t); bp2.Q.setValueAtTime(7, t);
    var g2 = c.createGain(); g2.gain.setValueAtTime(0.5, t); shaper.connect(bp2); bp2.connect(g2); g2.connect(fmix);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3600 + reed * 2000, t);
    var og = c.createGain(); fmix.connect(lp); lp.connect(og); og.connect(out);
    if (breathAmt > 0.02 && sharedNoiseBuf) {
      var nz = noiseSource(), nbp = c.createBiquadFilter(), ng = c.createGain();
      nbp.type = "bandpass"; nbp.frequency.setValueAtTime(3200, t); nbp.Q.setValueAtTime(1.4, t);
      nz.connect(nbp); nbp.connect(ng); ng.connect(out);
      var npk = breathAmt * 0.06;
      PJ.Voice.env(ng.gain, t, [[0.06, npk], [Math.max(0.1, dur - 0.26), npk * 0.8], [0.2, 0]]);
      nz.start(t, R.next() * 20); nz.stop(t + dur + 0.3);
    }
    var peak = 0.50 * (opts.gain == null ? 1 : opts.gain);     // target −9 ± 2 dB rel master (critic r1)
    var atk = opts.swell ? Math.min(1.2, dur * 0.3) : 0.05, rel = Math.min(0.6, 0.2 + dur * 0.06);
    PJ.Voice.env(og.gain, t, [[atk, peak], [Math.max(0.06, dur - atk - rel), peak * 0.9], [rel, 0]]);
    emitNote("hichiriki", freq, t, dur);
  }
  var hichiState = { idx: 11, dir: 1, center: 11, lastSpan: 0 };
  function startHichiriki(t) {
    if (!playing) return;
    hichiState.center = scaleIndexOf(6); hichiState.idx = hichiState.center; hichiState.dir = 1;
    hichirikiPhrase(t);
  }
  function hichirikiPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.hichiriki;
    if (!seated("hichiriki", now)) { afterRaw("hichiriki", now, R.rnd(6, 10), hichirikiPhrase); return; }
    var margin = airMargin(R, now) * 1.2;
    var tok = airClaimAt(now, "hichiriki", hichiState.lastSpan || 5, margin);
    if (!tok) { afterRaw("hichiriki", now, R.rnd(5, 9), hichirikiPhrase); return; }   // a sparse voice does not hammer a full air
    var pace = getLayerParam("hichiriki", "pace", 1.0) * (1 + arc * 0.3);
    var cry = arcPhase(now) === "kyū";
    hichiState.center = Math.round(scaleIndexOf(6) + arc * 3 + (cry ? 2 : 0));
    var phrase, motif = null;
    if (Motif.overdueFor("hichiriki", now)) motif = Motif.claim("hichiriki", now);
    if (!motif && R.chance(0.5)) motif = Motif.request("hichiriki", now);
    if (motif) { phrase = fitToRegister(motif.notes, hichiState.center).slice(0, cry ? 2 : 4); Motif.postFrom("hichiriki", motif, now); }
    else {
      phrase = walk(R, hichiState, 1 + Math.floor(R.next() * 2), 4, arc);
      emitEvent({ cat: "hichiriki", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    if (phrase.length) hichiState.idx = phrase[phrase.length - 1].deg;
    var beat = (cry ? 2.2 : 1.4) / pace, t = now + 0.05, prev = null;
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.8, n.durBeats * beat);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      hichirikiNote(f, t, dur, { glideFrom: (prev && R.next() < 0.6) ? prev : null, bend: R.next() < 0.35 || !!n.meri, swell: i === 0 && !cry });
      prev = f; t += dur + R.next() * 0.1;
    }
    hichiState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (5 + R.next() * 8) * (1 - arc * 0.5) * metaRestMul() * gapMulAt(t) / trimOf("hichiriki");
    afterRaw("hichiriki", now, (t - now) + rest, hichirikiPhrase);
  }

  // ==========================================================================
  // BIWA 琵琶 — promoted from the ambient pool to a VOICE (Phase 3): the
  // satsuma-biwa's tremolo strums, a huge sawari, a narrator who has no story
  // left. Seated in drift and silence cycles above all; claims the air; long
  // silences between utterances; the lowest register of the plucked family.
  // ==========================================================================
  var biwaState = { idx: 6, dir: 1, center: 6, lastSpan: 0 };
  function biwaStrum(freq, t, opts) {                       // a tremolo strum: 3–7 restrikes at 45–80 ms, velocity decaying
    var R = S.biwa, n = 3 + Math.floor(R.next() * 5), tt = t, tremolo = getLayerParam("biwa", "tremolo", 0.6);
    for (var i = 0; i < n; i++) {
      stringNote("biwa", freq, tt, 0.9 + (i === n - 1 ? 1.2 : 0), { vel: 0.9 - i * 0.08, gain: opts && opts.gain != null ? opts.gain : 1 });
      tt += 0.045 + (1 - tremolo) * 0.035 + R.next() * 0.02;
    }
    return tt - t;
  }
  function startBiwa(t) {
    if (!playing) return;
    biwaState.center = scaleIndexOf(2); biwaState.idx = biwaState.center; biwaState.dir = -1;
    biwaPhrase(t);
  }
  function biwaPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.biwa;
    if (!seated("biwa", now)) { afterRaw("biwa", now, R.rnd(8, 14), biwaPhrase); return; }
    var margin = airMargin(R, now) * 1.5;
    var tok = airClaimAt(now, "biwa", biwaState.lastSpan || 4, margin);
    if (!tok) { afterRaw("biwa", now, R.rnd(8, 14), biwaPhrase); return; }
    biwaState.center = Math.round(scaleIndexOf(2) + arc * 2);
    var phrase, motif = null;
    if (Motif.overdueFor("biwa", now)) motif = Motif.claim("biwa", now);
    if (!motif && R.chance(0.4)) motif = Motif.request("biwa", now);
    if (motif) { phrase = fitToRegister(motif.notes, biwaState.center).slice(0, 4); Motif.postFrom("biwa", motif, now); }
    else { phrase = walk(R, biwaState, 1 + Math.floor(R.next() * 3), 4, arc); emitEvent({ cat: "biwa", label: "fresh", detail: phrase.length + " notes" }, now); }
    if (phrase.length) biwaState.idx = phrase[phrase.length - 1].deg;
    var t = now + 0.05, strummed = false;
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      if ((i === 0 || i === phrase.length - 1) && R.next() < 0.6) { t += biwaStrum(f, t, {}) + 0.3; strummed = true; }
      else { stringNote("biwa", f, t, Math.max(0.6, n.durBeats * 0.9), { vel: 0.6 + R.next() * 0.35 }); t += Math.max(0.6, n.durBeats * 0.9) + R.next() * 0.3; }
    }
    if (strummed) emitEvent({ cat: "biwa", label: "琵琶 strum", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") }, now);
    biwaState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (8 + R.next() * 12) * (1 - arc * 0.3) * metaRestMul() * gapMulAt(t) / trimOf("biwa");
    afterRaw("biwa", now, (t - now) + rest, biwaPhrase);
  }

  // ==========================================================================
  // THE PLUCKED STRING (Phase 3) — koto, shamisen and biwa share one body
  // ==========================================================================
  // In the Library's manner, made a real string: a ONE-PERIOD noise burst
  // looped (a noise-excited wavetable — harmonic at the note, every note a
  // different random timbre: texture, unseeded) through a frequency-tracking
  // lowpass that dulls as the string dies. PLUCK POSITION is baked into the
  // burst as a comb (y[n] = x[n] − x[n − pos·N]): a different tone per note.
  // PLECTRUM NOISE — the koto's tsume tick, the shamisen's and biwa's bachi
  // slap — is a separate short burst. A VELOCITY LAW scales level, starting
  // brightness and decay; REGISTER-DEPENDENT DECAY: low strings ring, high
  // strings snap. playbackRate corrects the period quantization exactly and
  // carries the glides and the oshide press-bend. The old envelope shapes
  // (linear from true zero, exponential knee, linear to zero) are kept.
  var STRING_KIT = {
    // peaks 0.16 / 0.16 / 0.14 (critic, Phase 3 r2): with the brown burst the body
    // carries a sawtooth's power through its lowpass; target −16 ± 2 dB rel master
    koto:     { plectrum: "tsume", peak: 0.16, decay: 1.0,  brightK: 0.35, brightBase: 1.5, sawari: 0,   sparkle: 0.015 },
    shamisen: { plectrum: "bachi", peak: 0.16, decay: 0.75, brightK: 0.45, brightBase: 1.6, sawari: 1,   sparkle: 0 },
    biwa:     { plectrum: "bachi", peak: 0.14, decay: 1.3,  brightK: 0.3,  brightBase: 1.3, sawari: 1.6, sparkle: 0 },
  };
  function stringNote(layer, freq, t, dur, opts) {
    var c = ctx, K = STRING_KIT[layer], R = S[layer]; opts = opts || {};
    var wx = wxAt(t);
    var vel = opts.vel != null ? opts.vel : (0.55 + R.next() * 0.45);
    var out = panAt(layer, (R.next() * 2 - 1) * (layer === "koto" ? 0.35 : 0.3));
    var sr = c.sampleRate || 48000;
    var N = Math.max(8, Math.round(sr / freq)), rate = freq * N / sr;
    var pos = 0.12 + R.next() * 0.25;                          // pluck position, as a fraction of the string
    if (layer === "koto") pos = 0.1 + getLayerParam("koto", "pluck", 0.5) * 0.3 + (R.next() - 0.5) * 0.08;
    var buf = c.createBuffer(1, N, sr), d = buf.getChannelData(0), k = Math.max(1, Math.round(pos * N));
    var raw = new Float32Array(N);
    for (var i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;                 // texture, not music
    for (i = 0; i < N; i++) d[i] = raw[i] - raw[(i - k + N) % N];             // the pluck-position comb
    // A BROWN burst (critic, Phase 3 r2): a white one-period burst loses
    // ~23 dB through the note's lowpass at ~4 f whatever its level; a leaky
    // integrator run twice around the loop tilts it to ~1/n² — a plucked
    // string's real initial displacement (a triangle) — and it then keeps
    // within 1 dB of a sawtooth through the same lowpass. DC removed after.
    var acc = 0, pass, m = 0;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < N; i++) { acc = 0.995 * acc + d[i]; if (pass) d[i] = acc; }
    for (i = 0; i < N; i++) m += d[i]; m /= N; for (i = 0; i < N; i++) d[i] -= m;
    // then normalise to a fixed RMS (0.5; a sawtooth's is 0.58) so the level
    // lives in the peak below and does not scatter per pluck
    var en = 0; for (i = 0; i < N; i++) en += d[i] * d[i];
    var sc = 0.5 / Math.sqrt(Math.max(1e-9, en / N)); for (i = 0; i < N; i++) d[i] *= sc;
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    src.playbackRate.setValueAtTime(rate, t);
    if (opts.glideFrom) { var gt = Math.min(dur * 0.35, 0.18); src.playbackRate.setValueAtTime(rate * opts.glideFrom / freq, t); src.playbackRate.exponentialRampToValueAtTime(rate, t + gt); }
    if (opts.bend) { src.playbackRate.linearRampToValueAtTime(rate * 1.03, t + dur * 0.5); src.playbackRate.linearRampToValueAtTime(rate, t + dur * 0.8); }   // oshide press-bend
    // register-dependent decay: low strings ring, high strings snap
    var regMul = freq < 200 ? 1.6 : freq < 400 ? 1.2 : freq < 800 ? 0.9 : 0.65;
    var sustain = layer === "koto" ? getLayerParam("koto", "sustain", 1.0) : 1;
    var dec = Math.max(0.12, dur * sustain * K.decay * regMul * (0.9 + 0.2 * vel));
    var brightKnob = layer === "koto" ? getLayerParam("koto", "brightness", 7) : 6;
    var bright = (K.brightBase + brightKnob * K.brightK) * (0.8 + 0.4 * wx.brightness) * (0.8 + 0.4 * vel);
    var lp = c.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(16000, freq * bright), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.8, 120), t + dec * 0.8);   // the string dulls
    lp.Q.setValueAtTime(0.7, t);
    var g = c.createGain(); src.connect(lp); lp.connect(g); g.connect(out);
    var peak = K.peak * (opts.gain == null ? 1 : opts.gain) * (0.4 + 0.6 * vel);
    var atk = Math.max(0.004, Math.min(0.006, dec * 0.3)), knee = Math.min(0.15, dec * 0.6);
    if (atk >= knee) atk = knee * 0.5;
    PJ.Voice.env(g.gain, t, [[atk, peak], [knee - atk, peak * 0.3], [dec - knee, 0]]);
    src.start(t); src.stop(t + dec + 0.05);
    // THE PICK (Phase M — the mix pass, the orchestrator's ruling): the plan's
    // plectrum noise made a real transient. Measured, the string bodies hold
    // almost nothing at 1.5–4 kHz (the lowpass sits at ~4 f), so the koto's
    // tsume tick and the bachi's slap were the only pick there — and 25–30 dB
    // under the landscape's crud. Now: a 2–4 kHz BANDPASS burst, ≤ 15 ms,
    // click-safe (1.5 ms from true zero, 3 ms to zero), pre-attenuated (the
    // bandpass peaks at unity; the level lives in pp), per-note varied in
    // centre and length from the TEXTURE stream (Math.random, never the
    // voice's seeded stream, so the note stream is byte-identical). The bachi
    // keeps its low slap beside the click. The seeded draw for the noise
    // offset is kept in place (stream discipline).
    if (sharedNoiseBuf) {
      var tsume = K.plectrum === "tsume", gmul = (0.7 + 0.3 * vel) * Math.max(0.75, opts.gain == null ? 1 : opts.gain);   // a gentler law than the body's (critic r1): the softest plucks and the shadow notes still show their pick; the loud end is unchanged (floor 0.75, not 0.85: a gliss run's picks summed in one row pushed the koto's peak to +3.6)
      var pn = noiseSource(), pf = c.createBiquadFilter(), pg = c.createGain();
      pf.type = "bandpass"; pf.frequency.setValueAtTime((tsume ? 3000 : 2500) * Math.pow(2, (Math.random() - 0.5) * 0.7), t); pf.Q.setValueAtTime(1.0, t);   // 2.4–3.8 kHz tsume, 2.0–3.2 kHz bachi
      pn.connect(pf); pf.connect(pg); pg.connect(out);
      var pd = 0.007 + Math.random() * 0.0035, pp = (tsume ? 0.17 : 0.12) * gmul;                                       // 7–10.5 ms body of the burst; ≤ 15 ms in all (measured: 0.11 read +4.8 at the koto's onset in the jo, −0.6 in the ha — the noise bodies own that band there)
      PJ.Voice.env(pg.gain, t, [[0.0015, pp], [pd, pp * 0.3], [0.003, 0]]);
      pn.start(t, R.next() * 10); pn.stop(t + pd + 0.02);
      if (!tsume) {                                                                                                 // the bachi's slap: the old lowpassed thud, as it was
        var sn2 = noiseSource(), sf2 = c.createBiquadFilter(), sg2 = c.createGain();
        sf2.type = "lowpass"; sf2.frequency.setValueAtTime(900, t);
        sn2.connect(sf2); sf2.connect(sg2); sg2.connect(out);
        var sp2 = 0.05 * gmul;
        PJ.Voice.env(sg2.gain, t, [[0.0015, sp2], [0.012, sp2 * 0.3], [0.006, 0]]);
        sn2.start(t, (pos * 7) % 10); sn2.stop(t + 0.04);                                                       // offset from a value already drawn — no new seeded draw
      }
    }
    // sawari — the bridge buzz: a resonant high comb that sings on the
    // lowest strings only (shamisen: the lowest string; biwa: always, huge)
    var sawAmt = layer === "shamisen" ? getLayerParam("shamisen", "sawari", 0.6) * (freq < 220 ? 1 : 0.15) : layer === "biwa" ? getLayerParam("biwa", "sawari", 0.8) : 0;
    if (sawAmt > 0.02) {
      var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(freq * 1.005, t);
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(Math.min(12000, freq * 7), t); bp.Q.setValueAtTime(6, t);
      var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);   // a bandpass peaks at unity: the pre-attenuation lives in sp
      var sawIn = Math.min(0.014, dec * 0.4), sp = 0.05 * sawAmt * K.sawari * vel;
      PJ.Voice.env(bg.gain, t, [[sawIn, sp], [dec * 0.7 - sawIn, sp * 0.1], [dec * 0.4, 0]]);
      bo.start(t); bo.stop(t + dec * 1.2 + 0.05);
    }
    if (K.sparkle > 0) {                                     // the koto's octave sparkle
      var sh = c.createOscillator(), shg = c.createGain(); sh.type = "sine"; sh.frequency.setValueAtTime(freq * 2, t); sh.connect(shg); shg.connect(out);
      PJ.Voice.env(shg.gain, t, [[0.04, K.sparkle * (0.7 + 0.6 * wx.brightness) * vel], [Math.max(0.05, dec - 0.04), 0.001], [0.05, 0]]);
      sh.start(t); sh.stop(t + dec + 0.15);
    }
    emitNote(layer, freq, t, dur);
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
    var rest = (1.6 + S.koto.next() * 3.2) * (1 - arc * 0.5) * (arc < 0.15 ? 4 : 1) * metaRestMul() * gapMulAt(t) / trimOf("koto");  // sparse in jo; meta tilts density ±12%
    afterRaw("koto", now, (t - now) + rest, kotoPhrase);
  }
  function kotoNote(freq, t, dur, opts) { stringNote("koto", freq, t, dur, opts); }

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
    var rest = (2.2 + S.shamisen.next() * 3.5) * (1 - arc * 0.6) * (arc < 0.3 ? 5 : 1) * metaRestMul() * gapMulAt(t) / trimOf("shamisen");  // mostly absent in jo; meta tilts density ±12%
    afterRaw("shamisen", now, (t - now) + rest, shamisenPhrase);
  }
  function shamisenNote(freq, t, dur, opts) { stringNote("shamisen", freq, t, dur, opts); }

  // ==========================================================================
  // TAIKO 太鼓 — drums (silent in jo; drives the ha → kyū climb)
  // ==========================================================================
  function startTaiko(t) { if (playing) taikoPulse(t); }
  // THE KIT (Phase 3): three drums —
  //   ō-daiko  (don): the deep long hit, 95→45 Hz sine + a lowpassed skin burst
  //   shime    (ka? no — "tsu"/"ko"): the high tight drum, 240→180 Hz, a body
  //            resonance around 1.2 kHz, short
  //   ka:      the rim click — a 15 ms highpassed tick
  function taikoHit(t, accent, drum) {
    var c = ctx, R = S.taiko, out = panAt("taiko", (R.next() * 2 - 1) * 0.2);
    var lowTune = getLayerParam("taiko", "lowTune", 1.0), punch = getLayerParam("taiko", "punch", 0.6);
    drum = drum || "odaiko";
    if (drum === "ka") {
      if (!sharedNoiseBuf) return;
      var kn = noiseSource(), kh = c.createBiquadFilter(), kg = c.createGain();
      kh.type = "highpass"; kh.frequency.setValueAtTime(3500, t);
      kn.connect(kh); kh.connect(kg); kg.connect(out);
      var kp = (0.05 + punch * 0.04) * (accent ? 1.2 : 0.8);
      PJ.Voice.env(kg.gain, t, [[0.001, kp], [0.012, kp * 0.2], [0.008, 0]]);
      kn.start(t, R.next() * 10); kn.stop(t + 0.05);
      var ko = c.createOscillator(), kog = c.createGain(); ko.type = "sine"; ko.frequency.setValueAtTime(2100, t);
      ko.connect(kog); kog.connect(out); PJ.Voice.env(kog.gain, t, [[0.001, kp * 0.5], [0.02, 0.001], [0.01, 0]]); ko.start(t); ko.stop(t + 0.05);
      return;
    }
    var o = c.createOscillator(), g = c.createGain(); o.type = "sine";
    if (drum === "shime") {
      o.frequency.setValueAtTime(240 * lowTune, t); o.frequency.exponentialRampToValueAtTime(180 * lowTune, t + 0.06);
      o.connect(g); g.connect(out);
      var sp = (0.10 + punch * 0.06) * (accent ? 1.2 : 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(sp, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.start(t); o.stop(t + 0.2);
      if (sharedNoiseBuf) {                                  // the body resonance
        var sn = noiseSource(), sb = c.createBiquadFilter(), sg = c.createGain();
        sb.type = "bandpass"; sb.frequency.setValueAtTime(1200, t); sb.Q.setValueAtTime(5, t);
        sn.connect(sb); sb.connect(sg); sg.connect(out);                          // bandpass peaks at unity: attenuation in the envelope
        PJ.Voice.env(sg.gain, t, [[0.002, 0.028 * (accent ? 1.2 : 0.8)], [0.05, 0.0016], [0.02, 0]]);
        sn.start(t, R.next() * 10); sn.stop(t + 0.1);
      }
      return;
    }
    o.frequency.setValueAtTime(95 * lowTune, t); o.frequency.exponentialRampToValueAtTime(45 * lowTune, t + 0.16);
    o.connect(g); g.connect(out);
    var peak = (0.14 + punch * 0.1) * (accent ? 1.2 : 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.55 : 0.4));
    o.start(t); o.stop(t + 0.6);
    if (sharedNoiseBuf) {
      var nz = noiseSource(); var bp = c.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.setValueAtTime(800, t);
      var ng = c.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.06 * (accent ? 1.2 : 0.8), t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      nz.start(t, R.next() * 10); nz.stop(t + 0.2);
    }
  }
  // THE PATTERN VOCABULARY — strings over a half-beat grid: D ō-daiko accent,
  // d ō-daiko soft, s shime, S shime accent, k ka, . rest. The ji is the base
  // pulse (the ha); the matsuri patterns are the kyū's (and the festival's).
  var TAIKO_PATTERNS = {
    ji:      [["D.d.d.d.", 3], ["D.d.D.d.", 2], ["D...d...", 2], ["D.d.d.k.", 1]],
    matsuri: [["D.ssD.s.", 3], ["DsdsD.k.", 2], ["D.D.ss.k", 2], ["dsdsdsDk", 2], ["D..sD.sk", 1.5]],   // don-doko-don, the yatai-bayashi shape
  };
  function taikoPattern(t0, kind, beat, hitP) {
    var R = S.taiko, pat = R.pickW(TAIKO_PATTERNS[kind]), t = t0, half = beat * 0.5;
    for (var i = 0; i < pat.length; i++) {
      var ch = pat.charAt(i);
      if (ch !== "." && R.next() < hitP) {
        if (ch === "D") taikoHit(t, true, "odaiko"); else if (ch === "d") taikoHit(t, false, "odaiko");
        else if (ch === "S") taikoHit(t, true, "shime"); else if (ch === "s") taikoHit(t, false, "shime");
        else if (ch === "k") taikoHit(t, false, "ka");
      }
      t += half;
    }
    return { end: t, pat: pat };
  }
  function taikoPulse(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.taiko;
    if (!seated("taiko", now)) { pulse.active = false; afterRaw("taiko", now, 8, taikoPulse); return; }   // rested this cycle
    if (scn.type === "oroshi") { taikoOroshi(now); return; }
    if (arc < 0.3) { pulse.active = false; afterRaw("taiko", now, 3 + R.next() * 3, taikoPulse); return; }   // silent in jo — no grid to lock to
    var bpm = 50 + arc * 90, beat = 60 / bpm, t = now + 0.05;
    pulse.bpm = bpm; pulse.beat = beat; pulse.anchor = t; pulse.active = true;   // publish the grid — the ensemble magnetizes to this
    var kyu = arcPhase(now) === "kyū";
    var festival = !!(visitActive && visitActive.name === "the festival" && now < visitActive.until);
    if (festival) { bpm = Math.max(bpm, 96); beat = 60 / bpm; pulse.bpm = bpm; pulse.beat = beat; }
    var kind = kyu || festival || (arc > 0.62 && R.next() < 0.5) ? "matsuri" : "ji";
    var res = taikoPattern(t, kind, beat, festival ? 1 : 0.55 + arc * 0.45);
    // KAKEGOE — the crew calling time to nobody, through the broken PA
    var kk = getLayerParam("taiko", "kakegoe", 0.5);
    if (kind === "matsuri" && R.next() < kk * (festival ? 0.6 : kyu ? 0.35 : 0.15)) { paKakegoe(t - 0.12); emitEvent({ cat: "pa", label: "掛け声 kakegoe", detail: festival ? "祭" : arcPhase(now) }, now); }
    t = res.end;
    emitEvent({ cat: "taiko", label: kind === "matsuri" ? "祭 " + res.pat : "地 " + res.pat, detail: Math.round(bpm) + "bpm" }, now);
    var rest = (2 + R.next() * 4) * (1 - arc * 0.7) * (festival ? 0.25 : 1) / trimOf("taiko");
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
      taikoHit(t, i % 4 === 0 || i >= n - 3, (i % 4 === 0 || i >= n - 3) ? "odaiko" : "shime");   // the roll on the shime, the accents on the ō-daiko
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
  // A JAPANOISE VOCABULARY (Phase 3), drawn per scene and by cycle kind:
  //   wall     — the existing filtered-noise swell (the kyū's wall)
  //   screech  — a bandpass in a GAIN-BUDGETED feedback loop (delay 4–8 ms →
  //              bandpass → 0.9 → back): a bandpass biquad's peak gain is 1 at
  //              its centre for any Q, so 0.9 IS the loop gain; the centre
  //              sweeps and the loop rings — feedback squeal, never runaway
  //   static   — bit-crushed: noise through a 12-step waveshaper staircase
  //   rumble   — contact-mic: a low saw at half the sub root through the grit
  //              bus with a slow amplitude LFO
  // The colour of the wall's filter follows the weather's gritColor.
  var NOISE_KIND_W = {
    ordinary:  [["wall", 4], ["screech", 1], ["static", 1.5], ["rumble", 1.5]],
    storm:     [["wall", 4], ["screech", 3], ["static", 1.5], ["rumble", 1]],
    broadcast: [["wall", 2], ["screech", 0.5], ["static", 4], ["rumble", 1]],
    drift:     [["wall", 1.5], ["screech", 0.3], ["static", 0.5], ["rumble", 3]],
    silence:   [["wall", 1], ["screech", 0.2], ["static", 0.5], ["rumble", 2]],
    rite:      [["wall", 3], ["screech", 0.6], ["static", 1], ["rumble", 2]],
  };
  var noiseBodyForScene = null, noiseBodyScene = null;
  function noiseBody() {
    var key = cyc.n + ":" + scn.type + ":" + scn.startT;
    if (noiseBodyScene !== key) { noiseBodyScene = key; noiseBodyForScene = S.noise.pickW(NOISE_KIND_W[cyc.kind] || NOISE_KIND_W.ordinary); }
    return noiseBodyForScene;
  }
  var crushCurve = null;
  var liveRings = [];                              // screech loops in flight — torn down by their lane event, or by stop()
  function ringDown(nodes) { for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} } var k = liveRings.indexOf(nodes); if (k >= 0) liveRings.splice(k, 1); }
  function noiseEvent(t) {
    if (!playing) return;
    var c = ctx, now = t, out = lg("noise");
    var arc = getArc(now);
    var density = getLayerParam("noise", "density", 0.4);
    var color = getLayerParam("noise", "color", 0.5);
    var crush = getLayerParam("noise", "crush", 0.4);
    var wx = wxAt(now), body = noiseBody();
    var dur = 2 + S.noise.next() * 5 + arc * 4;
    var peak = (0.05 + arc * 0.22) * (0.4 + density) * K().noiseMul;   // the storm's wall, the drift's hiss
    if (body === "screech" && arc > 0.3) {
      // excite a short burst into the loop; the centre sweeps up then down
      var nz0 = noiseSource(), exg = c.createGain(), dl = c.createDelay(0.05), bpq = c.createBiquadFilter(), fb = c.createGain(), og = c.createGain();
      dl.delayTime.setValueAtTime(0.004 + S.noise.next() * 0.004, now);
      bpq.type = "bandpass"; bpq.Q.setValueAtTime(4, now);
      var f0 = 700 + S.noise.next() * 600, f1 = f0 * (2 + S.noise.next() * 2);
      bpq.frequency.setValueAtTime(f0, now); bpq.frequency.linearRampToValueAtTime(f1, now + dur * 0.6); bpq.frequency.linearRampToValueAtTime(f0 * 0.8, now + dur);
      fb.gain.setValueAtTime(0.9, now);                                  // the loop gain, exactly
      nz0.connect(exg); exg.connect(dl); dl.connect(bpq); bpq.connect(fb); fb.connect(dl); bpq.connect(og); og.connect(screechBus || out);
      PJ.Voice.env(exg.gain, now, [[0.02, 0.4], [Math.max(0.05, dur * 0.5), 0.15], [0.05, 0]]);   // the excitation, then the loop rings
      PJ.Voice.env(og.gain, now, [[dur * 0.3, peak * 0.7], [dur * 0.4, peak * 0.5], [dur * 0.3, 0]]);
      nz0.start(now, S.noise.next() * 10); nz0.stop(now + dur + 0.1);
      // TEAR THE LOOP DOWN: a node in a live cycle is never collected — the
      // delay and biquad would render forever. Close the feedback, then
      // disconnect the whole ring on the noise lane once it has rung out
      // (0.9^n: −60 dB in ~65 trips ≈ 0.5 s).
      var tEnd = now + dur + 1.5;
      fb.gain.setValueAtTime(0.9, tEnd - 0.3); fb.gain.linearRampToValueAtTime(0, tEnd);
      var ring = [nz0, exg, dl, bpq, fb, og]; liveRings.push(ring);
      lane("noise").at(tEnd + 0.2, function () { ringDown(ring); });
      if (arc > 0.4) emitEvent({ cat: "noise", label: "screech", detail: arcPhase(now) + " · " + Math.round(f0) + "→" + Math.round(f1) + " Hz" }, now);
    } else if (body === "static") {
      if (!crushCurve) { crushCurve = new Float32Array(1024); for (var ci = 0; ci < 1024; ci++) { var cx = (ci / 1023) * 2 - 1; crushCurve[ci] = Math.round(cx * 6) / 6; } }
      var nz1 = noiseSource(), ws = c.createWaveShaper(), bp1 = c.createBiquadFilter(), g1 = c.createGain();
      ws.curve = crushCurve;
      bp1.type = "bandpass"; bp1.frequency.setValueAtTime(1200 + wx.gritColor * 2500, now); bp1.Q.setValueAtTime(0.8, now);
      nz1.connect(ws); ws.connect(bp1); bp1.connect(g1); g1.connect(out);
      var sd = Math.min(dur, 1.5 + S.noise.next() * 2), sp = peak * 0.6;
      // gated bursts: the carrier drops in and out
      var segs = [], tt = 0, on = true;
      while (tt < sd - 0.1) { var seg = 0.05 + S.noise.next() * 0.25; segs.push([seg, on ? sp : 0]); tt += seg; on = !on; }
      segs.push([0.05, 0]);
      PJ.Voice.env(g1.gain, now, segs);
      nz1.start(now, S.noise.next() * 10); nz1.stop(now + sd + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "static", detail: arcPhase(now) }, now);
    } else if (body === "rumble") {
      var ro = c.createOscillator(), rg = c.createGain(), rl = c.createBiquadFilter(), lfo = c.createOscillator(), lg2 = c.createGain();
      ro.type = "sawtooth"; ro.frequency.setValueAtTime(subRoot() / 2, now);
      rl.type = "lowpass"; rl.frequency.setValueAtTime(140, now); rl.Q.setValueAtTime(0.7, now);
      lfo.type = "sine"; lfo.frequency.setValueAtTime(0.3 + S.noise.next() * 0.7, now);
      lg2.gain.setValueAtTime(0.5, now); lfo.connect(lg2);
      var rv = c.createGain(); rv.gain.setValueAtTime(0.5, now); lg2.connect(rv.gain);   // amplitude LFO (0..1 around 0.5)
      ro.connect(rl); rl.connect(rv); rv.connect(rg); rg.connect(out);
      var rp = peak * 0.5;
      PJ.Voice.env(rg.gain, now, [[dur * 0.4, rp], [dur * 0.3, rp], [dur * 0.3, 0]]);
      ro.start(now); ro.stop(now + dur + 0.1); lfo.start(now); lfo.stop(now + dur + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "rumble", detail: arcPhase(now) }, now);
    } else {
      var nz = noiseSource();
      var bp = c.createBiquadFilter();
      bp.type = arc > 0.6 ? "bandpass" : "lowpass";
      var fc = (200 + color * 3000 + arc * 2500) * (0.7 + 0.6 * wx.gritColor);
      bp.frequency.setValueAtTime(fc, now); bp.Q.setValueAtTime(0.5 + crush * 8 + arc * 6, now);
      // sweep the filter for a scraping motion
      bp.frequency.linearRampToValueAtTime(fc * (0.5 + S.noise.next()), now + dur);
      var g = c.createGain(); nz.connect(bp); bp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      nz.start(now, S.noise.next() * 10); nz.stop(now + dur + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "wall", detail: arcPhase(now) }, now);
    }

    var gap = (6 + S.noise.next() * 10) * (1 - arc * 0.6) / (0.4 + density) / K().noiseMul;
    after("noise", now, gap, noiseEvent);
  }

  // ==========================================================================
  // THE PA 放送 (Phase 3) — the station's announcements. A formant voice in
  // the Kolob still-small-voice manner: a sawtooth, PRE-ATTENUATED, through
  // F1/F2 bandpasses, gated into wordless syllables with a reciting-tone
  // drift, decaying into static (the carrier drops out; hiss takes over).
  // Speaks in broadcast cycles, and once, rarely, in a KIRU's hush. Never
  // claims the air — it is the station, not a player. Kakegoe shouts ride
  // the same body, short and hard. Through the far wall like the koto.
  // ==========================================================================
  var PA_VOWELS = [[320, 850], [430, 1100], [540, 1450], [660, 1800], [790, 2050]];
  function paSpeak(t, dur, opts) {
    var c = ctx, R = S.pa; opts = opts || {};
    var presence = getLayerParam("pa", "presence", 0.5), staticAmt = getLayerParam("pa", "static", 0.5);
    var out = panAt("pa", opts.pan != null ? opts.pan : (R.next() * 2 - 1) * 0.3);
    var f0 = field.snap(foldInto(field.tonicHz * 1.5, 150, 300));   // the reciting tone: a scale tone near the tonic's fifth
    var o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.985 + R.next() * 0.035), t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(f0 * 0.985, t + dur);
    var pre = c.createGain(); pre.gain.setValueAtTime(0.6, t);         // −4.4 dB into unity-peak formants (they pass little of a 150–300 Hz saw)
    o.connect(pre);
    var f1 = c.createBiquadFilter(); f1.type = "bandpass"; f1.Q.setValueAtTime(5, t);
    var f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.Q.setValueAtTime(6, t);
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(1400, t);
    var f1g = c.createGain(); f1g.gain.setValueAtTime(1, t);
    var f2g = c.createGain(); f2g.gain.setValueAtTime(0.6, t);
    var gate = c.createGain(), og = c.createGain();
    pre.connect(f1); f1.connect(f1g); f1g.connect(gate);
    pre.connect(f2); f2.connect(f2g); f2g.connect(gate);
    // a dry BODY beside the formants (critic, Phase 3 r2): the formants pass
    // little of a 150–300 Hz saw; a lowpassed dry path gives the voice a chest
    var body = c.createBiquadFilter(); body.type = "lowpass"; body.frequency.setValueAtTime(900, t); body.Q.setValueAtTime(0.7, t);
    var bodyG = c.createGain(); bodyG.gain.setValueAtTime(0.2, t);
    pre.connect(body); body.connect(bodyG); bodyG.connect(gate);
    gate.connect(og); og.connect(out);
    gate.gain.setValueAtTime(0, t);
    var sylRate = opts.shout ? 4 : 2 + R.next() * 1.5, st = t + 0.03, end = t + dur - (opts.shout ? 0.02 : 0.4);
    var pv1 = 500, pv2 = 1400;
    while (st < end) {
      var syl = 1 / (sylRate * (0.8 + R.next() * 0.45));
      var v = PA_VOWELS[Math.floor(R.next() * PA_VOWELS.length)];
      f1.frequency.setValueAtTime(pv1, st); f1.frequency.linearRampToValueAtTime(v[0], st + 0.035);   // short anchored ramps, never setTarget on a biquad
      f2.frequency.setValueAtTime(pv2, st); f2.frequency.linearRampToValueAtTime(v[1], st + 0.035);
      pv1 = v[0]; pv2 = v[1];
      var on = Math.max(0.03, syl * 0.24), hold = syl * (0.4 + R.next() * 0.22);
      gate.gain.setValueAtTime(0, st);
      gate.gain.linearRampToValueAtTime(1, st + on);
      gate.gain.linearRampToValueAtTime(0, st + on + hold);
      st += syl + (!opts.shout && R.next() < 0.2 ? 0.3 + R.next() * 0.8 : 0);    // long breath commas
    }
    var peak = (opts.shout ? 0.8 : 0.90) * presence * (opts.gain || 1);   // target −18 ± 3 dB rel master while speaking; the shout capped at 0.8
    if (opts.shout) PJ.Voice.env(og.gain, t, [[0.02, peak], [Math.max(0.05, dur - 0.1), peak * 0.8], [0.08, 0]]);
    else PJ.Voice.env(og.gain, t, [[0.5, peak], [Math.max(0.4, dur * 0.55 - 0.5), peak * 0.9], [dur * 0.45, 0]]);   // decays into the static below
    o.start(t); o.stop(t + dur + 0.3);
    // the carrier fails: static rises as the voice fades
    if (sharedNoiseBuf && staticAmt > 0.02) {
      var nz = noiseSource(), hp = c.createBiquadFilter(), ng = c.createGain();
      hp.type = "highpass"; hp.frequency.setValueAtTime(2000 + R.next() * 1500, t);
      nz.connect(hp); hp.connect(ng); ng.connect(out);
      var sp = 0.03 * staticAmt;
      if (opts.shout) PJ.Voice.env(ng.gain, t, [[0.01, sp], [dur, sp * 0.5], [0.05, 0]]);
      else PJ.Voice.env(ng.gain, t, [[dur * 0.5, sp * 0.3], [dur * 0.3, sp], [dur * 0.2 + 0.4, 0]]);
      nz.start(t, R.next() * 10); nz.stop(t + dur + 0.5);
    }
    emitNote("pa", f0, t, dur);
  }
  function paKakegoe(t) { paSpeak(t, 0.28 + S.pa.next() * 0.16, { shout: true, pan: 0.25 }); }
  function startPA(t) { if (playing) paCycle(t); }
  function paCycle(t0) {
    if (!playing) return;
    var now = t0, R = S.pa;
    if (cyc.kind !== "broadcast") { afterRaw("pa", now, 15 + R.next() * 10, paCycle); return; }   // only a broadcast cycle announces
    if (signalUp(now + 0.05)) { afterRaw("pa", now, 8, paCycle); return; }                          // S1 (critic r1): the tannoy does not talk over a signal — try again after the hold (no draw)
    var dur = 4 + R.next() * 5;
    paSpeak(now + 0.05, dur, {});
    emitEvent({ cat: "pa", label: "放送 announcement", detail: dur.toFixed(1) + "s · " + arcPhase(now) }, now);
    afterRaw("pa", now, dur + 30 + R.next() * 50, paCycle);
  }

  // ==========================================================================
  // AMBIENT — quirky events (derelict orbital station incidentals)
  // ==========================================================================
  function ambBonsho(t, opts) {                    // temple bell (bonshō) — deep, long, inharmonic
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3);
    if (opts && opts.halo && haloSend) {             // the hull (the koto's strings) ringing in sympathy
      var hs = ctx.createGain(); hs.gain.setValueAtTime(0.5, t); hs.connect(haloSend); out = (function (dest, tap) { var g = ctx.createGain(); g.gain.setValueAtTime(1, t); g.connect(dest); g.connect(tap); return g; })(out, hs);
    }
    var base = S.ambient.next() < 0.5 ? subRoot() : subFifth();
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
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3), dur = 3 + S.ambient.next() * 3, base = subRoot() / 2;
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
    { fn: ambCommsVox,     w: 2, name: "Comms vox" },
    { fn: ambGeigerHum,    w: 3, name: "Geiger hum" },
  ];
  // The kind gates the pool: a broadcast cycle is static and comms; drift is
  // water, bells and chimes; silence keeps the bell and little else; the
  // storm crackles. (Multipliers on the flat weights above.)
  var AMBIENT_KIND_W = {
    broadcast: { "Static glitch": 3, "Comms vox": 5, "Geiger hum": 2, "Koto sweep": 0.5 },
    drift:     { "Water drip": 2, "Temple bell": 1.5, "Wind chime": 2, "Static glitch": 0.5 },
    silence:   { "Temple bell": 2, "Wind chime": 0.6, "Static glitch": 0.4, "Distant taiko": 0.4, "Koto sweep": 0.3, "Comms vox": 0.5, "Geiger hum": 0.6 },
    storm:     { "Static glitch": 2, "Distant taiko": 2, "Geiger hum": 1.5, "Water drip": 0.5 },
    rite:      { "Temple bell": 2 },
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
    lastAitake = null; visitActive = null; cyc.visit = null; airHold = {}; airHoldDenials = 0;
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
    after("hichiriki", t0, 30, startHichiriki);
    after("pa", t0, 40, startPA);
    after("biwa", t0, 26, startBiwa);
    after("noise", t0, 8, noiseEvent);
    after("ambient", t0, 7, startAmbient);
    lane("form").every(formPulse);
    roomReset(t0);
    lane("room").every(roomPulse);               // Phase M: the crew listens for who speaks
  }
  // The form pulse (0.7 s, on its own lane): crossfades the dry-grit send up
  // as the intensity rises — the kyū gets close + abrasive. Cycle boundaries
  // and the KIRU are the Conductor's now (exact audio times).
  function formPulse(t) {
    if (!playing) return null;
    if (dryGritGain) dryGritGain.gain.setTargetAtTime(getArc(t) * 0.7, t, 0.5);
    // the grit's colour: equal-power crossfade of the two curves by the
    // weather's gritColor (anchored ramps every pulse — the weather moves
    // ≤ 0.026/s, so each chord is a hair)
    if (gritBlendA && gritBlendB) {
      // Phase M: complementary AMPLITUDE law (1 − x, x), not cos/sin — the two
      // curves shape the same signal, so their outputs are correlated and an
      // equal-power law would bump the bus +3 dB at mid-blend; with linear
      // weights the sum's level holds and only the colour moves.
      var gc = wxAt(t + 0.7).gritColor;
      gritBlendA.gain.setValueAtTime(gritBlendA.gain.value, t); gritBlendA.gain.linearRampToValueAtTime(1 - gc, t + 0.7);
      gritBlendB.gain.setValueAtTime(gritBlendB.gain.value, t); gritBlendB.gain.linearRampToValueAtTime(gc, t + 0.7);
    }
    return 0.7;
  }
  // 斬 KIRU — a final taiko roll + noise swell, then a sudden cut to a hush; a
  // lone temple bell rings in the silence (ma); the voices return as a new jo.
  // Severity rides the meta-curve: at the trough a passing hush (shallow dip,
  // ~3 s of ma, one bell); at the peak a devastating cut (down to 0.08 of
  // master, up to ~9 s of held silence, the bell tolling twice).
  // 斬 KIRU — the cut (Phase 4: Sycorax's mechanics). A final taiko roll +
  // noise swell, then the LANDSCAPE (grit bus, shō, ambient) drops on its own
  // cut gains — never the master — to a hush; the melodic voices stop MID-
  // GESTURE by scheduling (their lanes' pending phrases die where they stand,
  // their sounding tails and the rooms ring into the silence) and re-arm
  // after the hush; the hush is INHABITED: a lone bonshō always, the broken
  // PA rarely, and the koto's halo (never cut) ringing out. Severity rides
  // the tide: at the trough a passing hush, at the peak a devastating cut,
  // the bell tolling twice. In a silence or dead-station cycle the KIRU cuts
  // nothing: no roll, no swell — the hush deepens and the bell speaks.
  var MELODIC_LANES = ["shakuhachi", "koto", "shamisen", "hichiriki", "biwa"];
  var MELODIC_RESTART = { shakuhachi: function (t) { shakuhachiPhrase(t); }, koto: function (t) { kotoPhrase(t); }, shamisen: function (t) { shamisenPhrase(t); },
    hichiriki: function (t) { hichirikiPhrase(t); }, biwa: function (t) { biwaPhrase(t); } };
  function cutEnvelope(g, t, dip, hold) {
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t + 0.52);
    g.linearRampToValueAtTime(dip, t + 0.58);
    g.setValueAtTime(dip, t + 0.6 + hold);
    g.linearRampToValueAtTime(1, t + 0.6 + hold + 1.5);
  }
  function kiru(t) {
    if (!ctx || !playing) return;
    var sev = metaSeverity();
    var dip = 0.3 - 0.22 * sev;                                           // hush depth: 0.3 → 0.08 of the landscape
    var hold = 3 + 6 * sev;                                               // held silence: ~3 s → ~9 s
    var twice = sev > 0.45 && S.form.chance(0.4 + sev * 0.5);            // the bell tolls again near the peak
    var paHush = S.form.chance(0.2);                                      // unconditional draws
    var cutsSomething = cyc.kind !== "silence" && cyc.seating && cyc.seating.named !== "dead station";
    if (cutsSomething) {
      for (var i = 0; i < 6; i++) taikoHit(t + i * 0.08, i === 5, i === 5 ? "odaiko" : "shime");   // final roll
      var nz = noiseSource(), bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(4500, t + 0.5); bp.Q.setValueAtTime(2, t);
      var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(lg("noise"));
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28, t + 0.5); ng.gain.setValueAtTime(0.0001, t + 0.56);
      nz.start(t); nz.stop(t + 0.6);
    }
    // the cut: the landscape's three gains, one schedule each — the master is untouched
    if (cutGrit) { cutEnvelope(cutGrit.gain, t, dip, hold); cutEnvelope(cutSho.gain, t, dip, hold); cutEnvelope(cutAmb.gain, t, dip, hold); if (cutTaiko) cutEnvelope(cutTaiko.gain, t, dip, hold); }
    // the melodic voices stop mid-gesture and re-arm after the hush
    var tBack = t + 0.6 + hold + 1.0;
    for (var li = 0; li < MELODIC_LANES.length; li++) {
      var L = MELODIC_LANES[li];
      try { lane(L).cancelAll(); } catch (e) {}
      lane(L).at(tBack + li * 0.7, guarded(MELODIC_RESTART[L]));
    }
    ambBonsho(t + 0.78, { halo: true });                                  // a lone bell in the ma — the koto's strings hear it
    if (twice) ambBonsho(t + 0.78 + hold * S.form.rnd(0.4, 0.6), { halo: true });   // … and again, deeper into the silence
    if (paHush && cyc.kind !== "silence") { paSpeak(t + 1.6, Math.min(hold - 0.5, 3 + S.pa.next() * 2), { gain: 0.6 }); emitEvent({ cat: "pa", label: "放送 in the hush", detail: "the PA speaks into the ma" }, t + 1.6); }
    emitEvent({ cat: "noise", label: "斬 KIRU", detail: "the cut · severity " + sev.toFixed(2) + " · hush " + dip.toFixed(2) + " · ma " + hold.toFixed(1) + "s" + (twice ? " · the bell twice" : "") + (cutsSomething ? "" : " · cuts nothing") + " · landscape only" }, t);
  }
  // ==========================================================================
  // THE CREW LOWERS ITS VOICE (Phase M — the mix pass, 2026-09)
  // ==========================================================================
  // The owner heard the newer bodies buried. Measured (real audio, per note):
  // the grit bus — the sub-drone through the grit shaper — is ~78 % of the
  // master's power and masks every fundamental below ~400 Hz by 10–25 dB; the
  // shō sits flat from 315 Hz to 1 kHz and is the koto's second masker. So the
  // landscape MAKES ROOM instead of the voices getting louder: while a melodic
  // voice or the PA speaks, the grit bus and the shō (never the ambient
  // events) step back — a duck whose depth belongs to the VOICE (the rare
  // ones, PA / biwa / hichiriki, get the crew's full silence; the koto and the
  // shakuhachi, who speak most of the ha and kyū, a smaller step, so the
  // master's integrated loudness holds within the brief's ±0.7 dB) and to the
  // SCENE (the whole floor in the jo, a hair in the kyū where the wall is the
  // point) — and a shallow peaking notch opens at the speaking register on
  // both. ONE WRITER: emitNote hands roomSpeak the span and pitch of every
  // note the moment it is scheduled (whole phrases arrive seconds ahead);
  // roomPulse, on its own lane every 0.25 s, renders the envelope for the
  // coming window from those spans in five anchored 50 ms chords — attack
  // ~150 ms, release ~600 ms, the notch's centre gliding in log-frequency —
  // and remembers exactly what it wrote, so every anchor is the true value
  // (no .value reads, no setTarget). The pulse draws no randomness and emits
  // nothing: the note stream is untouched; only the envelope's timing can
  // differ by a lookahead between runs.
  var ROOM_VOICES = { shakuhachi: 1.5, koto: 2, shamisen: 2, hichiriki: 2, biwa: 2, pa: 2, broadcast: 2 };   // broadcast (S1): the grit steps back 2 dB (+ the 2 dB notch = the mix pass's 4 dB cap, orchestrator ruling; the reel reads +11–14 dB over the landscape in its band, so no more is needed)          // the grit bus: duck + notch ≤ 4 dB in 150–1200 Hz (orchestrator's cap)
  var ROOM_VOICES_SHO = { shakuhachi: 1.5, koto: 3.5, shamisen: 2.5, hichiriki: 3, biwa: 3, pa: 4, broadcast: 4 };   // the shō: the PA's masker at 0.8–3.2 kHz, so it steps back further for the PA   // the crew's step for each speaker, dB, in the jo (measured: the landscape is 78 % of the master's power, so every dB of duck while a voice speaks is ~0.8 dB of loudness for that time — the budget caps the frequent speakers)
  var ROOM_SCENE = { jo: 1.0, ha: 0.9, "kyū": 0.8, release: 0.8 };                          // jo deepest, kyū shallowest (the ruling); the ha is where the strings live                          // × by phase (the loudness budget: voices speak ~45 % of the jo, ~80 % of the ha, ~95 % of the kyū)
  var ROOM_CARVE_DB = -2, ROOM_Q = 2.0;
  var ROOM_CARVE_KOTO_DB = -4, ROOM_KOTO_DEEP = { jo: 1, ha: 1 };                           // r3 (orchestrator Q5): the koto's notch −4 in the jo and ha (duck 2 + notch 4 = the 6 dB cap for the koto there); kyū and release stay at 4                                                       // the notch at the speaking register: narrow (a critical band) and deeper — it clears the fundamental's band for a fraction of the power a broad duck would spend
  var ROOM_F_LO = 150, ROOM_F_HI = 1200;                                                    // the dip stays inside 150–1200 Hz (the orchestrator's cap)
  var LAND_SHELF_DB = -3;                                                                  // the static shelf above 1.5 kHz on the grit bus and the shō
  var ROOM_PICK = { koto: -4, shamisen: -4, biwa: -4, pa: -6, broadcast: -4 };   // the signal's speech band is the pick band                            // the pick-band dip (1.4–4.5 kHz, above the cap) while a plucked voice or the PA speaks, dB × scene; the PA deeper (critic r2)
  var ROOM_F_HI_SHO = 1600;                                                                // the shō's notch may follow the PA's band centre; the grit's stays inside 150–1200
  var ROOM_GROUP = { koto: 1, shamisen: 1, biwa: 1, hichiriki: 1, pa: 1, shakuhachi: 2, broadcast: 1 };  // notch 1: the plucked / reed / PA; notch 2: the flute (critic r2 §3.1)
  var ROOM_PA_SHO_F = 1100, ROOM_PA_SHO_Q = 1.0;                                          // the PA's shō notch: 1.1 kHz at Q 1 clears 0.8–1.6 kHz, where the shō's A5 partials cover the tannoy (critic r2 §3.2)
  var room = { spans: [], g: 1, gs: 1, pg: 0, cg: [0, 0], lf: [Math.log(400), Math.log(400)], lfs: [Math.log(400), Math.log(400)], qs: ROOM_Q };
  function roomSpeak(layer, t, dur, f) {
    if (!ROOM_VOICES[layer] || !(dur > 0) || !(f > 0)) return;
    room.spans.push({ a: t, b: t + dur, f: f, fs: layer === "pa" ? ROOM_PA_SHO_F : f, qs: layer === "pa" ? ROOM_PA_SHO_Q : ROOM_Q, db: ROOM_VOICES[layer], dbs: ROOM_VOICES_SHO[layer] || ROOM_VOICES[layer], pk: ROOM_PICK[layer] || 0, grp: ROOM_GROUP[layer] || 1, koto: layer === "koto" });   // the PA: the grit notch at its reciting tone, the shō's at 1.1 kHz
  }
  function roomReset(t) {
    room.spans.length = 0; room.g = 1; room.gs = 1; room.pg = 0; room.cg = [0, 0]; room.lf = [Math.log(400), Math.log(400)]; room.lfs = [Math.log(400), Math.log(400)]; room.qs = ROOM_Q;
    if (!duckGrit) return;
    [duckGrit.gain, duckSho.gain].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(1, t); });
    [carveGrit.gain, carveSho.gain, carveGrit2.gain, carveSho2.gain, pickGrit.gain, pickSho.gain].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(0, t); });
    [carveGrit.frequency, carveSho.frequency, carveGrit2.frequency, carveSho2.frequency].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(400, t); });
    carveSho.Q.cancelScheduledValues(t); carveSho.Q.setValueAtTime(ROOM_Q, t);
  }
  function roomPulse(t) {
    if (!playing || !duckGrit) return null;
    var P = 0.25, N = 5, dt = P / N, sp = room.spans, keep = [], i;
    for (i = 0; i < sp.length; i++) if (sp[i].b > t - 1) keep.push(sp[i]);      // spans older than the release are forgotten
    room.spans = sp = keep;
    var scene = ROOM_SCENE[arcPhase(t)] != null ? ROOM_SCENE[arcPhase(t)] : 0.7, deepPhase = !!ROOM_KOTO_DEEP[arcPhase(t)];
    var g = room.g, gs = room.gs, pg = room.pg, cg = room.cg.slice(), lf = room.lf.slice(), lfs = room.lfs.slice(), qs = room.qs;
    var CG = [carveGrit, carveGrit2], CS = [carveSho, carveSho2];
    duckGrit.gain.setValueAtTime(g, t); duckSho.gain.setValueAtTime(gs, t);              // anchors: this writer's own last values, which the previous window's ramps reached at t
    pickGrit.gain.setValueAtTime(pg, t); pickSho.gain.setValueAtTime(pg, t);
    for (var n = 0; n < 2; n++) { CG[n].gain.setValueAtTime(cg[n], t); CS[n].gain.setValueAtTime(cg[n], t); CG[n].frequency.setValueAtTime(Math.exp(lf[n]), t); CS[n].frequency.setValueAtTime(Math.exp(lfs[n]), t); }
    carveSho.Q.setValueAtTime(qs, t);
    for (var k = 1; k <= N; k++) {
      var tau = t + k * dt, step = 0, steps = 0, pk = 0, sp1 = [0, 0], fsum = [0, 0], fssum = [0, 0], fn = [0, 0], qmin = ROOM_Q, kotoDeep = false;
      for (i = 0; i < sp.length; i++) if (sp[i].a <= tau && tau <= sp[i].b) {
        var x = sp[i], gi = x.grp === 2 ? 1 : 0;
        if (x.koto && deepPhase) kotoDeep = true;
        if (x.db > step) step = x.db; if (x.dbs > steps) steps = x.dbs; if (x.pk < pk) pk = x.pk;
        sp1[gi] = 1; fsum[gi] += Math.log(x.f); fssum[gi] += Math.log(x.fs); fn[gi]++; if (gi === 0 && x.qs < qmin) qmin = x.qs;
      }
      var target = step > 0 ? Math.pow(10, -step * scene / 20) : 1, targetS = steps > 0 ? Math.pow(10, -steps * scene / 20) : 1;
      var a = 1 - Math.exp(-dt / (target < g ? 0.05 : 0.2));                   // attack ≈ 150 ms (3 τ), release ≈ 600 ms
      g += (target - g) * a;
      gs += (targetS - gs) * (1 - Math.exp(-dt / (targetS < gs ? 0.05 : 0.2)));
      pg += (pk * scene - pg) * a;
      for (n = 0; n < 2; n++) {
        cg[n] += ((sp1[n] ? (n === 0 && kotoDeep ? ROOM_CARVE_KOTO_DB : ROOM_CARVE_DB) * scene : 0) - cg[n]) * a;
        if (fn[n]) {
          var lt = Math.max(Math.log(ROOM_F_LO), Math.min(Math.log(ROOM_F_HI), fsum[n] / fn[n])); lf[n] += (lt - lf[n]) * (1 - Math.exp(-dt / 0.04));
          var lts = Math.max(Math.log(ROOM_F_LO), Math.min(Math.log(ROOM_F_HI_SHO), fssum[n] / fn[n])); lfs[n] += (lts - lfs[n]) * (1 - Math.exp(-dt / 0.04));
        }
        CG[n].gain.linearRampToValueAtTime(cg[n], tau); CS[n].gain.linearRampToValueAtTime(cg[n], tau);
        CG[n].frequency.linearRampToValueAtTime(Math.exp(lf[n]), tau); CS[n].frequency.linearRampToValueAtTime(Math.exp(lfs[n]), tau);
      }
      qs += (qmin - qs) * (1 - Math.exp(-dt / 0.04)); carveSho.Q.linearRampToValueAtTime(qs, tau);   // the PA's shō notch is wider (Q 1); the strings' stays a critical band (Q 2)
      duckGrit.gain.linearRampToValueAtTime(g, tau); duckSho.gain.linearRampToValueAtTime(gs, tau);
      pickGrit.gain.linearRampToValueAtTime(pg, tau); pickSho.gain.linearRampToValueAtTime(pg, tau);
    }
    room.g = g; room.gs = gs; room.pg = pg; room.cg = cg; room.lf = lf; room.lfs = lfs; room.qs = qs;
    return P;
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (bg) bg.stopped();
    if (conductor) { try { conductor.stop(); } catch (e) {} }
    if (signalProvider) { try { signalProvider.stop(); } catch (e) {} }
    if (clock) clock.stop();                     // every lane's pending events die here
    while (liveRings.length) ringDown(liveRings[0]);   // screech loops in flight lose their lane teardown with the clock — tear them down here
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
    [subRoot(), subFifth()].forEach(function (rf) {
      [-7, 7].forEach(function (det) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(rf, t); o.detune.setValueAtTime(det, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.05, t); o.start(t); o.stop(t + dur + 0.1); });
    });
    var so = ctx.createOscillator(), sg = ctx.createGain(); so.type = "sine"; so.frequency.setValueAtTime(subRoot() / 2, t); so.connect(sg); sg.connect(lp); sg.gain.setValueAtTime(0.08, t); so.start(t); so.stop(t + dur + 0.1);
  }
  function sampleSho(t) {
    var dur = 3, lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(getLayerParam("sho", "cutoff", 1400), t);
    var bus = ctx.createGain(); lp.connect(bus); bus.connect(lg("sho"));
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(0.5, t + 0.8); bus.gain.setValueAtTime(0.5, t + dur - 1); bus.gain.linearRampToValueAtTime(0, t + dur);
    chooseAitake(S.sample, 6).freqs.forEach(function (f) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.045, t); o.start(t); o.stop(t + dur + 0.1); });
  }
  function sampleNoise(t, kind) {
    if (kind && kind !== "wall") {
      // audition one vocabulary body through the real noiseEvent (the bench's
      // instrument): force the scene's body, a mid intensity, one event
      var savedBody = noiseBodyForScene, savedScene = noiseBodyScene, savedPlaying = playing, savedArc = getArc;
      noiseBodyForScene = kind; noiseBodyScene = cyc.n + ":" + scn.type + ":" + scn.startT;
      playing = true; getArc = function () { return 0.7; };
      var savedAfter = after; after = function () {};                 // one event, no loop
      try { noiseEvent(t); } catch (e) {}
      after = savedAfter; getArc = savedArc; playing = savedPlaying;
      noiseBodyForScene = savedBody; noiseBodyScene = savedScene;
      return;
    }
    var dur = 2.5, nz = noiseSource(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(3000, t + dur); bp.Q.setValueAtTime(4, t);
    var g = ctx.createGain(); nz.connect(bp); bp.connect(g); g.connect(lg("noise"));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); nz.start(t, S.sample.next() * 5); nz.stop(t + dur + 0.1);
  }
  function sample(layer, variant) {
    init();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (bg) bg.poke();               // audition while stopped: the <audio> route must be live
    // The audition draws from its own stream: while it plays, every body
    // borrows S.sample so a ♪ press mid-performance re-rolls nothing.
    var borrowed = ["shakuhachi", "koto", "shamisen", "taiko", "ambient", "noise", "sho", "subDrone", "hichiriki", "biwa", "pa"], saved = {}, bi;
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
      case "hichiriki": samplePhrase(hichirikiNote, t, [3, 4, 3, 0], 1.4); break;
      case "pa": paSpeak(t, 4, {}); break;
      case "biwa": biwaStrum(SCALE[scaleIndexOf(0)].freq, t, {}); stringNote("biwa", SCALE[scaleIndexOf(3)].freq, t + 1.2, 1.4, { vel: 0.8 }); stringNote("biwa", SCALE[scaleIndexOf(0)].freq, t + 2.4, 2, { vel: 0.7 }); break;
      case "taiko": taikoPattern(t, "matsuri", 0.5, 1); taikoHit(t + 2.2, true, "odaiko"); taikoHit(t + 2.6, false, "shime"); taikoHit(t + 2.8, false, "ka"); break;
      case "noise": sampleNoise(t, variant); break;
      case "ambient": var e = AMBIENT_POOL[Math.floor(S.sample.next() * AMBIENT_POOL.length)]; try { e.fn(t); } catch (x) {} break;
      case "broadcast": if (signalProvider && signalProvider.sample) { try { signalProvider.sample(t); } catch (x2) {} } break;
    }
    for (bi = 0; bi < borrowed.length; bi++) S[borrowed[bi]] = saved[borrowed[bi]];
    emitEvent({ cat: "mode", label: "♪ sample", detail: layer + (variant ? " · " + variant : "") });
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
    getAirInfo: function () { if (!air) return null; var ai = air.info(); ai.holdDenials = airHoldDenials; return ai; },
    // THE SIGNAL SEAM (S1): zk-broadcast.js installs a provider {arm, fire, stop,
    // sample?}; the engine hands it its tools. Nothing here is for the page.
    _signal: {
      install: function (p) { signalProvider = p || null; },
      tools: function () {
        return {
          ctx: ctx, PJ: PJ, S: S, lane: lane, playing: function () { return playing; },
          emitEvent: emitEvent, lg: lg, roomSpeak: roomSpeak, noiseSource: noiseSource, panAt: panAt,
          getArc: getArc, arcPhase: arcPhase, scene: function () { return { type: scn.type, activity: scn.activity, startT: scn.startT, durS: scn.durS }; },
          cycle: function () { return { n: cyc.n, kind: cyc.kind, startT: cyc.startT, durS: cyc.durS, visit: cyc.visit ? cyc.visit.name : null }; },
          getLayerParam: getLayerParam, bonsho: function (t) { ambBonsho(t, { halo: true }); },
          airHold: function (map) { for (var k in map) airHold[k] = map[k]; }, airHoldClear: function () { airHold = {}; },
          fallback: visitBroadcast, fieldTonic: function () { return field.tonicHz; },
        };
      },
    },
    getRooms: function () { return { hull: roomHull, corridor: roomCorridor, blend: roomBlend, farWall: farWall, halo: halo }; },
    getWeather: function () { return weather; },
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
      var src = { dry: reverbSend, grit: gritMakeup, hull: roomHull && roomHull.output, corridor: roomCorridor && roomCorridor.output, farWall: farWall && farWall.output,
        halo: layHalo, screech: screechBus, cut: cutGrit, radio: radioBus,
        landscape: landscapeTap, duck: duckGrit, out: outTrim, taiko: cutTaiko }[name];           // taiko: the kit after its own clip and cut, as it reaches the dry sum                  // Phase M: the landscape sum, the duck gain, the output
      if (!src || !node) return false;
      try { src.connect(node); return true; } catch (e) { return false; }
    },
  };
})();
