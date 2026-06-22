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
// taiko, noise (japanoise), ambient (event pool). Multiple melodic voices with
// motif memory + cross-voice call-and-response.
//
// Architecture mirrors the proven Antariksh engine: ctx → grit waveshaper →
// reverb → master → compressor → destination; per-layer GainNodes; a rate-aware
// scheduler; per-layer params for the console; a jo-ha-kyū arc; an event-log
// feed. Public surface: window.ZankyoAudio
// ============================================================================

window.ZankyoAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null;
  var reverbSend = null, reverbDry = null, reverbWet = null, reverbConv = null, reverbPreDelay = null;
  var gritShaper = null;           // distortion bus (gritty instruments route here)
  var dryGritGain = null;          // parallel dry grit send, opened up toward the kyū climax
  var masterSat = null;
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

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
  var MODE_POOL = [["hirajoshi", 5], ["insen", 3], ["kumoi", 3], ["iwato", 2]];
  var currentMode = "hirajoshi";
  var CUR_OFFSETS = MODES.hirajoshi.offsets;
  function semis(i) { return CUR_OFFSETS[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5); }
  function degFreq(i, octShift) {              // i = scale-degree index (can exceed 5), octShift in octaves
    return TONIC_HZ * Math.pow(2, semis(i) / 12 + (octShift || 0));
  }

  // Build an ascending frequency table across registers (oct -1 .. +2 ≈ 4 oct).
  var SCALE = (function () {
    var arr = [];
    for (var i = -5; i <= 15; i++) arr.push({ deg: ((i % 5) + 5) % 5, freq: degFreq(i, 0), idx: i });
    return arr;
  })();
  function rebuildScale() { for (var k = 0; k < SCALE.length; k++) SCALE[k].freq = degFreq(SCALE[k].idx, 0); }
  function pickMode() {
    var total = 0, i; for (i = 0; i < MODE_POOL.length; i++) total += MODE_POOL[i][1];
    var r = Math.random() * total, name = MODE_POOL[0][0];
    for (i = 0; i < MODE_POOL.length; i++) { r -= MODE_POOL[i][1]; if (r <= 0) { name = MODE_POOL[i][0]; break; } }
    return name;
  }
  function setMode(name) {
    if (!MODES[name]) return;
    currentMode = name; CUR_OFFSETS = MODES[name].offsets; rebuildScale();
    SCALE_INFO.name = MODES[name].name; SCALE_INFO.kana = MODES[name].kana.slice();
    emitEvent({ cat: "mode", label: "⟳ mode", detail: MODES[name].name });
  }
  function scaleIndexOf(i) {                    // map a degree index i to SCALE array index
    for (var k = 0; k < SCALE.length; k++) if (SCALE[k].idx === i) return k;
    return 5;
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
  var GRIT_LAYERS = { subDrone: true, shamisen: true, taiko: true, noise: true }; // route through distortion

  var layerGains = {};
  var layerVolumes = { subDrone: 0.6, sho: 0.62, shakuhachi: 0.85, koto: 0.55, shamisen: 0.5, taiko: 0.62, noise: 0.5, ambient: 0.55 };
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
  var LAYER_RATE_TRIM = {};

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration) {
    for (var i = 0; i < noteListeners.length; i++) {
      try { noteListeners[i]({ layer: layer, freq: freq, startTime: startTime, duration: duration || 0 }); } catch (e) {}
    }
  }
  function emitEvent(ev) {
    if (eventListeners.length === 0) return;
    ev.t = ctx ? ctx.currentTime : 0;
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

    var noiseSamples = Math.floor(ctx.sampleRate * NOISE_BUF_DURATION);
    sharedNoiseBuf = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    var nd = sharedNoiseBuf.getChannelData(0);
    for (var ni = 0; ni < noiseSamples; ni++) nd[ni] = Math.random() * 2 - 1;

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-20, ctx.currentTime);
    compressorNode.knee.setValueAtTime(14, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(5, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.008, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.2, ctx.currentTime);
    // Master saturator — glues the escalating wall into one cohesive distorted
    // mass and protects against clipping when grit + noise stack in the kyū.
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.4) / Math.tanh(1.4); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    compressorNode.connect(ctx.destination);

    var effectsReady = false;
    try {
      reverbSend = ctx.createGain();
      reverbDry = ctx.createGain();
      reverbWet = ctx.createGain();
      reverbConv = ctx.createConvolver();
      reverbPreDelay = ctx.createDelay(0.2);
      reverbSend.connect(reverbDry);
      reverbSend.connect(reverbPreDelay);
      reverbPreDelay.connect(reverbConv);
      reverbConv.connect(reverbWet);
      reverbDry.connect(masterGain);
      reverbWet.connect(masterGain);
      buildReverbIR();

      gritShaper = ctx.createWaveShaper();
      gritShaper.curve = buildGritCurve(0.6);
      gritShaper.oversample = "4x";
      gritShaper.connect(reverbSend);
      // parallel dry path — crossfaded up by the arc so the kyū gets close + abrasive
      dryGritGain = ctx.createGain();
      dryGritGain.gain.setValueAtTime(0, ctx.currentTime);
      gritShaper.connect(dryGritGain);
      dryGritGain.connect(masterGain);

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
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
  }

  function buildReverbIR() {
    var len = Math.floor(ctx.sampleRate * REVERB.decay);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var ph1 = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;  // per-channel phase → no comb
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate;
        var env = Math.exp(-2.0 * t / REVERB.decay);     // fuller tail
        var hf = Math.exp(-3.5 * t / REVERB.decay);       // darkens like a plate
        var metal = 1 + 0.10 * Math.sin(2 * Math.PI * 1700 * t + ph1) + 0.06 * Math.sin(2 * Math.PI * 3300 * t + ph2);
        data[i] = (Math.random() * 2 - 1) * env * hf * metal;
      }
    }
    reverbConv.buffer = buf;
    reverbPreDelay.delayTime.setValueAtTime(REVERB.preDelay / 1000, ctx.currentTime);
    reverbWet.gain.setValueAtTime(REVERB.wet, ctx.currentTime);
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
  var timers = new Set();
  function scheduleLayer(fn, baseMs, layer) {
    var ms = baseMs / (getRate(layer) || 1);
    var id = setTimeout(function () { timers.delete(id); if (playing) fn(); }, ms);
    timers.add(id);
  }
  function scheduleRaw(fn, ms) {
    var id = setTimeout(function () { timers.delete(id); if (playing) fn(); }, ms);
    timers.add(id);
  }
  function clearAllTimers() { timers.forEach(function (id) { clearTimeout(id); }); timers.clear(); }

  function lg(layer) { return layerGains[layer]; }
  // Three persistent panners per layer (L / C / R) instead of one per note —
  // keeps stereo width while collapsing the node count dramatically.
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
  function getRate(layer) {
    var base = (layerRate[layer] != null ? layerRate[layer] : 1);
    var trim = LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1;
    return base * trim;
  }
  function getLayerParam(layer, key, fallback) {
    if (layerParams[layer] && layerParams[layer][key] != null) return layerParams[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    node.gain.setValueAtTime(layerMuted[layer] ? 0 : layerVolumes[layer], ctx.currentTime);
  }
  function noiseSource() {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf; n.loop = true;
    return n;
  }

  // ==========================================================================
  // JO-HA-KYŪ ARC — the long-form development
  // ==========================================================================
  // 序破急: jo (slow, sparse, spacious intro) → ha (the "break/scattering",
  // building density + register + grit, rhythm emerging) → kyū (rapid, intense
  // climax, the noise wall) → a short release back to stillness, then begins
  // again. Asymmetric, more directional than a sine swell. Derived from elapsed
  // play time so it's deterministic/resumable.
  var ARC_PERIOD = 420;                          // ~7 min per full jo-ha-kyū cycle
  var arcStartTime = 0;
  function getArc() {
    if (!ctx || !playing) return 0;
    var ph = (((ctx.currentTime - arcStartTime) / ARC_PERIOD) % 1 + 1) % 1;
    // jo 0–0.45 (0→0.25), ha 0.45–0.82 (0.25→0.8), kyū 0.82–0.95 (0.8→1), release 0.95–1 (1→0)
    var a;
    if (ph < 0.45) { var x = ph / 0.45; a = 0.25 * (x * x); }
    else if (ph < 0.82) { var y = (ph - 0.45) / 0.37; a = 0.25 + 0.55 * (y * y * (3 - 2 * y)); }
    else if (ph < 0.95) { var z = (ph - 0.82) / 0.13; a = 0.8 + 0.2 * Math.sqrt(z); }   // steep rush to the peak
    else { var w = (ph - 0.95) / 0.05; a = 0.8 * Math.pow(1 - w, 3); }                    // kiru — near-instant cut, then ma
    var vary = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (ctx.currentTime - arcStartTime) / 271));
    a *= vary;
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }
  function arcPhase() {
    if (!ctx || !playing) return "—";
    var ph = (((ctx.currentTime - arcStartTime) / ARC_PERIOD) % 1 + 1) % 1;
    return ph < 0.45 ? "jo" : ph < 0.82 ? "ha" : ph < 0.95 ? "kyū" : "release";
  }
  function arcInfo() {
    if (!ctx || !playing) return { level: 0, phase: "—" };
    return { level: getArc(), phase: arcPhase() };
  }

  // ==========================================================================
  // SHARED MOTIF MEMORY (cross-voice call-and-response)
  // ==========================================================================
  // Melodic voices store and recall phrases; a phrase emitted by one voice can
  // be "answered" by another (echoed, often transformed). Each phrase is an
  // array of { deg (scale index), durBeats }.
  var sharedMotifs = [];                          // recent phrases, any voice
  var lastCall = null;                            // { phrase, voice } awaiting an answer
  function rememberMotif(phrase, voice) {
    if (phrase.length < 2) return;
    var copy = phrase.map(function (n) { return { deg: n.deg, durBeats: n.durBeats }; });
    sharedMotifs.push({ notes: copy, voice: voice });
    if (sharedMotifs.length > 24) sharedMotifs.shift();
    lastCall = { notes: copy, voice: voice };
  }
  function transformMotif(notes) {
    var out = notes.map(function (n) { return { deg: n.deg, durBeats: n.durBeats }; });
    var r = Math.random(), tag = "verbatim";
    if (r < 0.3) { tag = "octave"; var o = Math.random() < 0.5 ? 5 : -5; out.forEach(function (n) { n.deg += o; }); }
    else if (r < 0.55) { tag = "retro"; out.reverse(); }
    else if (r < 0.78) { tag = "stretch"; var s = 1.3 + Math.random() * 0.6; out.forEach(function (n) { n.durBeats *= s; }); }
    return { notes: out, tag: tag };
  }
  // Seed the shared memory with idiomatic Hirajoshi phrases (degree indices),
  // so call-and-response recalls real Japanese gestures, not only random walks.
  function seedMotifs() {
    var seeds = [
      [3, 2, 1, 0],          // Honkyoku descent → tonic (shakuhachi, jo)
      [1, 2, 1],             // Sakura sigh (the most recognizably-Japanese turn)
      [4, 3, 0],             // Kumoi cadence
      [0, 1, 2, 3, 4],       // Tsugaru hammer run
      [0, 4, 1, 3, 0],       // Midare scattered leaps (kyū)
      [0, 1, 2],             // Kakegoe answer (retrograde-pairs with the Sakura sigh)
    ];
    seeds.forEach(function (degs) {
      sharedMotifs.push({ notes: degs.map(function (d) { return { deg: scaleIndexOf(d), durBeats: 1 }; }), voice: "seed" });
    });
  }

  // A biased hirajoshi walk. state = { idx, dir, center }; returns phrase of
  // { deg, durBeats }. window widens / steps loosen with arc.
  function walk(state, len, windowR, arc) {
    var notes = [];
    if (Math.random() < 0.4) state.dir = -state.dir;
    for (var i = 0; i < len; i++) {
      var step = Math.random() < (0.62 - arc * 0.18) ? 1 : Math.random() < 0.8 ? 2 : 3;
      state.idx += state.dir * step;
      if (state.idx < state.center - windowR) { state.idx = state.center - windowR; state.dir = 1; }
      if (state.idx > state.center + windowR) { state.idx = state.center + windowR; state.dir = -1; }
      if (state.idx < 0) state.idx = 0; else if (state.idx >= SCALE.length) state.idx = SCALE.length - 1;
      if (Math.random() < 0.34) state.idx = pullTo(state.idx, IMPORTANT_DEG);
      notes.push({ deg: state.idx, durBeats: 0.6 + Math.random() * 0.9 });
    }
    state.idx = pullTo(state.idx, REST_DEG);
    notes.push({ deg: state.idx, durBeats: 1.4 + Math.random() * 1.2 });
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
  function subDroneCycle() {
    if (!playing) return;
    var c = ctx, now = c.currentTime, out = lg("subDrone");
    var cutoff = getLayerParam("subDrone", "cutoff", 220);
    var movement = getLayerParam("subDrone", "movement", 0.18);
    var subAmt = getLayerParam("subDrone", "sub", 0.6);
    var dur = 26 + Math.random() * 10, fadeIn = 7, fadeOut = 8;

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.8, now);
    var mlfo = c.createOscillator(), mg = c.createGain();
    mlfo.type = "sine"; mlfo.frequency.setValueAtTime(0.02 + Math.random() * 0.03, now);
    mg.gain.setValueAtTime(cutoff * movement, now); mlfo.connect(mg); mg.connect(lp.frequency);
    mlfo.start(now); mlfo.stop(now + dur + 0.3);
    var bus = c.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + fadeIn);
    bus.gain.setValueAtTime(1, now + dur - fadeOut);
    bus.gain.linearRampToValueAtTime(0, now + dur);
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
    var overlap = 7 + Math.random() * 3;
    scheduleLayer(subDroneCycle, (dur - overlap) * 1000, "subDrone");
  }

  // ==========================================================================
  // SHŌ 笙 — gagaku mouth-organ cluster drone (shimmering tone-clusters)
  // ==========================================================================
  // Sustained 5–6 note clusters (aitake) built from in-scale degrees, breathing
  // slowly, with a high digital shimmer. The shimmering harmonic bed.
  function shoCycle() {
    if (!playing) return;
    var c = ctx, now = c.currentTime, out = lg("sho");
    var cutoff = getLayerParam("sho", "cutoff", 1400);
    var voices = Math.round(getLayerParam("sho", "voices", 5));
    var shimmer = getLayerParam("sho", "shimmer", 0.4);
    var drift = getLayerParam("sho", "drift", 0.5);
    var dur = 14 + Math.random() * 8, fadeIn = 5, fadeOut = 6;

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.5, now);
    var bus = c.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(0.5, now + fadeIn);
    bus.gain.setValueAtTime(0.5, now + dur - fadeOut);
    bus.gain.linearRampToValueAtTime(0, now + dur);
    lp.connect(bus); bus.connect(out);

    // a real aitake cluster: a CLOSE voicing (with a deliberate semitone rub),
    // sitting high (~A4–A5) so the bed shimmers above the drones.
    var base = scaleIndexOf(6 + Math.floor(Math.random() * 2));
    var used = {};
    for (var v = 0; v < voices; v++) {
      var idx = base + [0, 1, 2, 4, 5][v % 5];
      if (idx >= SCALE.length) idx = SCALE.length - 1;
      if (used[idx]) idx = Math.min(SCALE.length - 1, idx + 1);
      used[idx] = 1;
      var f = SCALE[idx].freq;
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, now);
      o.detune.setValueAtTime((Math.random() * 2 - 1) * 6 * drift, now);
      var dl = c.createOscillator(), dlg = c.createGain();
      dl.type = "sine"; dl.frequency.setValueAtTime(0.05 + Math.random() * 0.08, now);
      dlg.gain.setValueAtTime(5 * drift, now); dl.connect(dlg); dlg.connect(o.detune);
      dl.start(now); dl.stop(now + dur + 0.2);
      o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.045, now);
      o.start(now); o.stop(now + dur + 0.2);
      // nasal free-reed character: square reed sub + 5th/7th partials
      [[1, "square", 0.018], [5, "sine", 0.014], [7, "sine", 0.008]].forEach(function (pr) {
        var po = c.createOscillator(), pg = c.createGain();
        po.type = pr[1]; po.frequency.setValueAtTime(f * pr[0], now);
        po.connect(pg); pg.connect(lp); pg.gain.setValueAtTime(pr[2], now);
        po.start(now); po.stop(now + dur + 0.2);
      });
      if (shimmer > 0.01) {
        var ho = c.createOscillator(), hg = c.createGain();
        ho.type = "triangle"; ho.frequency.setValueAtTime(f * 4, now);
        ho.connect(hg); hg.connect(bus); hg.gain.setValueAtTime(0.009 * shimmer, now);
        ho.start(now); ho.stop(now + dur + 0.2);
      }
      emitNote("sho", f, now);
    }
    var overlap = 4 + Math.random() * 2;
    scheduleLayer(shoCycle, (dur - overlap) * 1000, "sho");
  }

  // ==========================================================================
  // SHAKUHACHI 尺八 — breathy bamboo flute lead (the voice)
  // ==========================================================================
  // The primary melodic line: long, spacious phrases full of MA (silence),
  // breath, meri-kari pitch bends, and occasional MURAIKI (explosive breath
  // noise — the gritty cry). Motif memory + answers other voices.
  var shakuState = { idx: 10, dir: 1, center: 10 };
  function startShakuhachi() {
    if (!playing) return;
    shakuState.center = scaleIndexOf(5);         // mid-high register, above the drones
    shakuState.idx = shakuState.center; shakuState.dir = 1;
    shakuhachiPhrase();
  }
  function shakuhachiPhrase() {
    if (!playing) return;
    var now = ctx.currentTime, arc = getArc();
    var pace = getLayerParam("shakuhachi", "pace", 1.0) * (1 + arc * 0.6);
    var glideAmt = getLayerParam("shakuhachi", "glide", 0.6);
    var ornament = getLayerParam("shakuhachi", "ornament", 0.5);
    var muraiki = getLayerParam("shakuhachi", "muraiki", 0.4);
    var breath = getLayerParam("shakuhachi", "breath", 0.55);

    shakuState.center = Math.round(scaleIndexOf(5) + arc * 4);

    // sometimes answer a call from another voice (call-and-response)
    var phrase, action;
    if (lastCall && lastCall.voice !== "shakuhachi" && Math.random() < 0.4) {
      var tr = transformMotif(lastCall.notes); phrase = clampPhrase(tr.notes); action = "answer · " + tr.tag;
    } else if (sharedMotifs.length && Math.random() < 0.25) {
      var m = sharedMotifs[Math.floor(Math.random() * sharedMotifs.length)];
      var tr2 = transformMotif(m.notes); phrase = clampPhrase(tr2.notes); action = "recall · " + tr2.tag;
    } else {
      phrase = walk(shakuState, 2 + Math.floor(Math.random() * 3) + Math.floor(arc * 2), 6 + Math.round(arc * 2), arc);
      action = "fresh";
    }
    rememberMotif(phrase, "shakuhachi");
    emitEvent({ cat: "shakuhachi", label: action, detail: phrase.length + " notes · " + arcPhase() });

    var beat = 0.62 / pace, t = now + 0.05, prev = null;
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.25, n.durBeats * beat);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var glideFrom = (prev && Math.random() < glideAmt) ? prev : null;
      var mur = (i === 0 && Math.random() < muraiki * (0.4 + arc * 0.6));
      shakuhachiNote(f, t, dur, { glideFrom: glideFrom, breath: breath, muraiki: mur ? muraiki : 0, bend: Math.random() < ornament });
      prev = f;
      t += dur + Math.random() * 0.05;
    }
    // MA — breathing space between phrases (more in jo, less in kyū)
    var ma = (1.8 + Math.random() * 4) * (1 - arc * 0.55) / getRate("shakuhachi");
    scheduleRaw(shakuhachiPhrase, (t - now + ma) * 1000);
  }
  function clampPhrase(notes) {
    return notes.map(function (n) { return { deg: Math.max(0, Math.min(SCALE.length - 1, n.deg)), durBeats: n.durBeats }; });
  }
  function shakuhachiNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var out = panAt("shakuhachi", (Math.random() * 2 - 1) * 0.25);
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
      nz.start(t, Math.random() * 20); nz.stop(t + dur + 0.1);
    }
    emitNote("shakuhachi", freq, t, dur);
  }

  // ==========================================================================
  // KOTO 箏 — plucked zither (bright melodic voice + glissando flourishes)
  // ==========================================================================
  var kotoState = { idx: 8, dir: 1, center: 8 };
  function startKoto() {
    if (!playing) return;
    kotoState.center = scaleIndexOf(4); kotoState.idx = kotoState.center; kotoState.dir = 1;
    kotoPhrase();
  }
  function kotoPhrase() {
    if (!playing) return;
    var now = ctx.currentTime, arc = getArc();
    var pace = getLayerParam("koto", "pace", 1.0) * (1 + arc * 0.7);
    var glissAmt = getLayerParam("koto", "gliss", 0.4);
    kotoState.center = Math.round(scaleIndexOf(4) + arc * 3);
    var phrase, action;
    if (lastCall && lastCall.voice !== "koto" && Math.random() < 0.35) { var tr = transformMotif(lastCall.notes); phrase = clampPhrase(tr.notes); action = "answer · " + tr.tag; }
    else if (sharedMotifs.length && Math.random() < 0.25) { var m = sharedMotifs[Math.floor(Math.random() * sharedMotifs.length)]; var tr2 = transformMotif(m.notes); phrase = clampPhrase(tr2.notes); action = "recall · " + tr2.tag; }
    else { phrase = walk(kotoState, 3 + Math.floor(Math.random() * 3) + Math.floor(arc * 2), 7 + Math.round(arc * 2), arc); action = "fresh"; }
    rememberMotif(phrase, "koto");
    emitEvent({ cat: "koto", label: action, detail: phrase.length + " notes" });
    var beat = 0.4 / pace, t = now + 0.05, prev = null;
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.12, n.durBeats * beat);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      kotoNote(f, t, dur, { glideFrom: (prev && Math.random() < 0.3) ? prev : null, bend: Math.random() < 0.2 });
      prev = f; t += dur + Math.random() * 0.03;
    }
    // glissando flourish — a rapid run up/down the scale (more in ha/kyū)
    if (Math.random() < glissAmt * (0.3 + arc)) {
      var up = Math.random() < 0.5, start = kotoState.idx, gn = 4 + Math.floor(Math.random() * 5), gt = t;
      for (var k = 0; k < gn; k++) {
        var gi = Math.max(0, Math.min(SCALE.length - 1, start + (up ? k : -k)));
        kotoNote(SCALE[gi].freq, gt, 0.14, { gain: 0.7 }); gt += 0.05 + Math.random() * 0.03;
      }
      t = gt; emitEvent({ cat: "koto", label: "gliss", detail: (up ? "↑" : "↓") + gn });
    }
    var rest = (1.6 + Math.random() * 3.2) * (1 - arc * 0.5) * (arc < 0.15 ? 4 : 1) / getRate("koto");  // sparse in jo
    scheduleRaw(kotoPhrase, (t - now + rest) * 1000);
  }
  function kotoNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var bright = getLayerParam("koto", "brightness", 7), sustain = getLayerParam("koto", "sustain", 1.0);
    var out = panAt("koto", (Math.random() * 2 - 1) * 0.35);
    var o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = "sawtooth"; o2.type = "triangle"; o2.detune.setValueAtTime(4, t);
    if (opts.glideFrom) { var gt = Math.min(dur * 0.35, 0.18); o1.frequency.setValueAtTime(opts.glideFrom, t); o1.frequency.exponentialRampToValueAtTime(freq, t + gt); o2.frequency.setValueAtTime(opts.glideFrom, t); o2.frequency.exponentialRampToValueAtTime(freq, t + gt); }
    else { o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq, t); }
    if (opts.bend) { o1.frequency.linearRampToValueAtTime(freq * 1.03, t + dur * 0.5); o1.frequency.linearRampToValueAtTime(freq, t + dur * 0.8); }   // oshide press-bend
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(freq * bright, t); f.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 300), t + dur * 0.7); f.Q.setValueAtTime(3, t);
    var g = c.createGain(); o1.connect(f); o2.connect(f); f.connect(g); g.connect(out);
    var peak = 0.13 * (opts.gain == null ? 1 : opts.gain), dec = dur * sustain;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.005); g.gain.exponentialRampToValueAtTime(peak * 0.3, t + 0.15 * sustain); g.gain.linearRampToValueAtTime(0, t + dec);
    o1.start(t); o1.stop(t + dec + 0.05); o2.start(t); o2.stop(t + dec + 0.05);
    var sh = c.createOscillator(), shg = c.createGain(); sh.type = "sine"; sh.frequency.setValueAtTime(freq * 2, t); sh.connect(shg); shg.connect(out);
    shg.gain.setValueAtTime(0.0001, t); shg.gain.exponentialRampToValueAtTime(0.015, t + 0.04); shg.gain.exponentialRampToValueAtTime(0.001, t + dec); sh.start(t); sh.stop(t + dec + 0.1);
    emitNote("koto", freq, t, dur);
  }

  // ==========================================================================
  // SHAMISEN 三味線 — gritty plucked lute with SAWARI buzz (tsugaru/punk edge)
  // ==========================================================================
  var shamiState = { idx: 7, dir: 1, center: 7 };
  function startShamisen() {
    if (!playing) return;
    shamiState.center = scaleIndexOf(3); shamiState.idx = shamiState.center; shamiState.dir = 1;
    shamisenPhrase();
  }
  function shamisenPhrase() {
    if (!playing) return;
    var now = ctx.currentTime, arc = getArc();
    var pace = getLayerParam("shamisen", "pace", 1.0) * (1 + arc * 1.0);   // comes alive in ha/kyū
    shamiState.center = Math.round(scaleIndexOf(3) + arc * 3);
    var phrase, action;
    if (lastCall && lastCall.voice !== "shamisen" && Math.random() < 0.3) { var tr = transformMotif(lastCall.notes); phrase = clampPhrase(tr.notes); action = "answer · " + tr.tag; }
    else { phrase = walk(shamiState, 3 + Math.floor(Math.random() * 4) + Math.floor(arc * 3), 6 + Math.round(arc * 2), arc); action = "fresh"; }
    rememberMotif(phrase, "shamisen");
    emitEvent({ cat: "shamisen", label: action, detail: phrase.length + " notes · " + arcPhase() });
    var beat = 0.28 / pace, t = now + 0.05;
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var dur = Math.max(0.1, Math.min(n.durBeats, 1) * beat);
      // tsugaru hammer-on: a quick lower-neighbor grace before the beat
      if (Math.random() < 0.25 + arc * 0.3) {
        shamisenNote(SCALE[Math.max(0, n.deg - 1)].freq, t, 0.05, { gain: 0.55 });
        t += 0.05;
      }
      shamisenNote(f, t, dur, { gain: (i % 2 === 0 ? 1.0 : 0.6) });
      t += dur + 0.01;
    }
    var rest = (2.2 + Math.random() * 3.5) * (1 - arc * 0.6) * (arc < 0.3 ? 5 : 1) / getRate("shamisen");  // mostly absent in jo
    scheduleRaw(shamisenPhrase, (t - now + rest) * 1000);
  }
  function shamisenNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var sawari = getLayerParam("shamisen", "sawari", 0.6), attack = getLayerParam("shamisen", "attack", 0.5);
    var out = panAt("shamisen", (Math.random() * 2 - 1) * 0.3);
    var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(freq, t);
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 2, t + dur * 0.6); f.Q.setValueAtTime(2, t);
    var g = c.createGain(); o.connect(f); f.connect(g); g.connect(out);
    var peak = 0.13 * (opts.gain == null ? 1 : opts.gain), atk = 0.002 + (1 - attack) * 0.02;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + atk); g.gain.exponentialRampToValueAtTime(peak * 0.2, t + 0.12); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
    if (sawari > 0.01) {                                   // sawari buzz — bright high resonance (grit)
      var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(freq * 1.005, t);
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(freq * 7, t); bp.Q.setValueAtTime(6, t);
      var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);
      bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.05 * sawari, t + 0.01); bg.gain.exponentialRampToValueAtTime(0.005 * sawari, t + dur * 0.7); bg.gain.linearRampToValueAtTime(0, t + dur * 1.1);
      bo.start(t); bo.stop(t + dur * 1.2 + 0.05);
    }
    emitNote("shamisen", freq, t, dur);
  }

  // ==========================================================================
  // TAIKO 太鼓 — drums (silent in jo; drives the ha → kyū climb)
  // ==========================================================================
  function startTaiko() { if (playing) taikoPulse(); }
  function taikoHit(t, accent) {
    var c = ctx, out = panAt("taiko", (Math.random() * 2 - 1) * 0.2);
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
      nz.start(t, Math.random() * 10); nz.stop(t + 0.2);
    }
  }
  function taikoPulse() {
    if (!playing) return;
    var now = ctx.currentTime, arc = getArc();
    if (arc < 0.3) { scheduleRaw(taikoPulse, (3 + Math.random() * 3) * 1000); return; }   // silent in jo
    var bpm = 50 + arc * 90, beat = 60 / bpm, beats = 2 + Math.floor(arc * 8), t = now + 0.05;
    for (var i = 0; i < beats; i++) { if (Math.random() < 0.5 + arc * 0.45) taikoHit(t, i % 4 === 0); t += beat * (Math.random() < 0.3 ? 0.5 : 1); }
    emitEvent({ cat: "taiko", label: "pattern", detail: beats + " beats · " + Math.round(bpm) + "bpm" });
    var rest = (2 + Math.random() * 4) * (1 - arc * 0.7) / getRate("taiko");
    scheduleRaw(taikoPulse, (t - now + rest) * 1000);
  }

  // ==========================================================================
  // NOISE 雑音 — japanoise texture (arc-driven walls of grit)
  // ==========================================================================
  // Sparse, swelling beds of filtered/crushed noise that grow with the arc —
  // gentle hiss in jo, scraping walls in kyū. Routed through the distortion bus.
  function noiseEvent() {
    if (!playing) return;
    var c = ctx, now = c.currentTime, out = lg("noise");
    var arc = getArc();
    var density = getLayerParam("noise", "density", 0.4);
    var color = getLayerParam("noise", "color", 0.5);
    var crush = getLayerParam("noise", "crush", 0.4);

    var dur = 2 + Math.random() * 5 + arc * 4;
    var nz = noiseSource();
    var bp = c.createBiquadFilter();
    bp.type = arc > 0.6 ? "bandpass" : "lowpass";
    var fc = 200 + color * 3000 + arc * 2500;
    bp.frequency.setValueAtTime(fc, now); bp.Q.setValueAtTime(0.5 + crush * 8 + arc * 6, now);
    // sweep the filter for a scraping motion
    bp.frequency.linearRampToValueAtTime(fc * (0.5 + Math.random()), now + dur);
    var g = c.createGain(); nz.connect(bp); bp.connect(g); g.connect(out);
    var peak = (0.05 + arc * 0.22) * (0.4 + density);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    nz.start(now, Math.random() * 10); nz.stop(now + dur + 0.1);
    if (arc > 0.4) emitEvent({ cat: "noise", label: "wall", detail: arcPhase() });

    var gap = (6 + Math.random() * 10) * (1 - arc * 0.6) / (0.4 + density);
    scheduleLayer(noiseEvent, gap * 1000, "noise");
  }

  // ==========================================================================
  // AMBIENT — quirky events (derelict orbital station incidentals)
  // ==========================================================================
  function ambBonsho(t) {                          // temple bell (bonshō) — deep, long, inharmonic
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.3);
    var base = degFreq(0, -1) * (Math.random() < 0.5 ? 1 : Math.pow(2, 7 / 12));
    var partials = [{ m: 1, a: 0.08, d: 6 }, { m: 2.7, a: 0.04, d: 4 }, { m: 5.2, a: 0.02, d: 2.4 }, { m: 8.1, a: 0.012, d: 1.5 }];
    partials.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * p.m, t); o.detune.setValueAtTime((Math.random() * 2 - 1) * 5, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p.a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      o.start(t); o.stop(t + p.d + 0.1);
    });
  }
  function ambFurin(t) {                            // wind-chime (fūrin) — a few tiny high pings
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.6);
    var n = 2 + Math.floor(Math.random() * 3), tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(Math.random() * 4));
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq * 2, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.start(tt); o.stop(tt + 1.5); tt += 0.12 + Math.random() * 0.2;
    }
  }
  function ambSuikinkutsu(t) {                      // water drip resonance (suikinkutsu)
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.5);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(7) + Math.floor(Math.random() * 5))].freq * 2;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
  }
  function ambGlitch(t) {                           // digital glitch / static burst (the 3042 grit)
    if (!sharedNoiseBuf) return;
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.8);
    var n = 3 + Math.floor(Math.random() * 6), tt = t;
    for (var i = 0; i < n; i++) {
      var nz = noiseSource();
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(800 + Math.random() * 4000, tt);
      var g = ctx.createGain(); nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.02 + Math.random() * 0.05;
      g.gain.setValueAtTime(0.05, tt); g.gain.setValueAtTime(0.0001, tt + d);
      nz.start(tt, Math.random() * 10); nz.stop(tt + d + 0.02); tt += d + Math.random() * 0.06;
    }
  }
  function ambDistantTaiko(t) {                     // a lone distant drum hit
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.4);
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
      nz.start(t, Math.random() * 10); nz.stop(t + 0.2);
    }
  }
  function ambKotoSweep(t) {                        // a fast koto-ish glissando flourish
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.5);
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
    var c = ctx, out = panAt("ambient", (Math.random() * 2 - 1) * 0.4);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(0) + Math.floor(Math.random() * 5))].freq, dec = 1.6 + Math.random() * 1.2;
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
    var c = ctx, out = panAt("ambient", (Math.random() * 2 - 1) * 0.6);
    var carrier = c.createOscillator(); carrier.type = "sawtooth"; carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(2)].freq * 2, t);
    var vca = c.createGain(); vca.connect(out); vca.gain.setValueAtTime(0.0001, t);
    [700, 1100, 2600].forEach(function (ff) { var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(ff, t); bp.Q.setValueAtTime(8, t); carrier.connect(bp); bp.connect(vca); });
    var syl = 3 + Math.floor(Math.random() * 4), tt = t;
    for (var i = 0; i < syl; i++) {
      var d = 0.05 + Math.random() * 0.12;
      carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(Math.floor(Math.random() * 5))].freq * 2, tt);
      vca.gain.setValueAtTime(0.05, tt); vca.gain.setValueAtTime(0.0001, tt + d);
      tt += d + 0.04 + Math.random() * 0.08;
    }
    carrier.start(t); carrier.stop(tt + 0.1);
    if (sharedNoiseBuf) { var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(2000, t); var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out); ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.0001, tt); nz.start(t, Math.random() * 10); nz.stop(tt + 0.1); }
  }
  function ambGeigerHum(t) {                        // dying machinery — sagging drone + thinning radiation clicks
    var c = ctx, out = panAt("ambient", (Math.random() * 2 - 1) * 0.3), dur = 3 + Math.random() * 3, base = degFreq(0, -2);
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
        nz.start(tt, Math.random() * 10); nz.stop(tt + 0.03);
        tt += 0.05 + Math.random() * 0.3 * (1 + ((tt - t) / dur) * 3);   // clicks thin out as it dies
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
  function startAmbient() { if (playing) ambientEvent(); }
  function ambientEvent() {
    if (!playing) return;
    var now = ctx.currentTime, total = 0, i;
    for (i = 0; i < AMBIENT_POOL.length; i++) total += AMBIENT_POOL[i].w;
    var r = Math.random() * total, entry = AMBIENT_POOL[0];
    for (i = 0; i < AMBIENT_POOL.length; i++) { r -= AMBIENT_POOL[i].w; if (r <= 0) { entry = AMBIENT_POOL[i]; break; } }
    try { entry.fn(now + 0.05); } catch (e) {}
    emitEvent({ cat: "ambient", label: entry.name });
    var gap = (12 + Math.random() * 22) * (1 - getArc() * 0.35);
    scheduleLayer(ambientEvent, gap * 1000, "ambient");
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (playing) return;
    playing = true;
    arcStartTime = ctx.currentTime;
    lastCycle = -1; lastPhase = "";
    sharedMotifs.length = 0; lastCall = null;
    seedMotifs();
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    for (var i = 0; i < LAYERS.length; i++) applyLayerGain(LAYERS[i]);
    // drones first; voices and grit enter in turn (jo opening)
    subDroneCycle();
    shoCycle();
    scheduleLayer(startShakuhachi, 4000, "shakuhachi");
    scheduleLayer(startKoto, 10000, "koto");
    scheduleLayer(startShamisen, 16000, "shamisen");
    scheduleLayer(startTaiko, 22000, "taiko");
    scheduleLayer(noiseEvent, 8000, "noise");
    scheduleLayer(startAmbient, 7000, "ambient");
    updateDryGrit();
  }
  // Crossfade the dry-grit send up as the arc rises — kyū gets close + abrasive.
  // Modulates the MODE at each cycle boundary, and fires the KIRU (斬 — the cut)
  // at the kyū → release transition: the climax's payoff.
  var lastCycle = -1, lastPhase = "";
  function updateDryGrit() {
    if (!playing) return;
    if (dryGritGain) dryGritGain.gain.setTargetAtTime(getArc() * 0.7, ctx.currentTime, 0.5);
    var cyc = Math.floor((ctx.currentTime - arcStartTime) / ARC_PERIOD);
    if (cyc !== lastCycle) { lastCycle = cyc; setMode(cyc <= 0 ? "hirajoshi" : pickMode()); }
    var phase = arcPhase();
    if (lastPhase === "kyū" && phase === "release") kiru();
    lastPhase = phase;
    scheduleRaw(updateDryGrit, 700);
  }
  // 斬 KIRU — a final taiko roll + noise swell, then a sudden cut to a hush; a
  // lone temple bell rings in the silence (ma); the voices return as a new jo.
  function kiru() {
    if (!ctx || !masterGain || !playing) return;
    var t = ctx.currentTime;
    for (var i = 0; i < 6; i++) taikoHit(t + i * 0.08, i === 5);          // final roll
    var nz = noiseSource(), bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(4500, t + 0.5); bp.Q.setValueAtTime(2, t);
    var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(lg("noise"));
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28, t + 0.5); ng.gain.setValueAtTime(0.0001, t + 0.56);
    nz.start(t); nz.stop(t + 0.6);
    masterGain.gain.cancelScheduledValues(t);                            // the cut
    masterGain.gain.setValueAtTime(masterVolume, t + 0.52);
    masterGain.gain.linearRampToValueAtTime(masterVolume * 0.12, t + 0.58);
    ambBonsho(t + 0.78);                                                  // a lone bell in the ma
    masterGain.gain.setValueAtTime(masterVolume * 0.12, t + 6);          // hold the silence
    masterGain.gain.linearRampToValueAtTime(masterVolume, t + 7.5);     // voices return
    emitEvent({ cat: "noise", label: "斬 KIRU", detail: "the cut" });
  }
  function stop() {
    if (!playing) return;
    playing = false;
    clearAllTimers();
    if (ctx) {
      for (var i = 0; i < LAYERS.length; i++) {
        var node = layerGains[LAYERS[i]];
        if (node) { node.gain.cancelScheduledValues(ctx.currentTime); node.gain.setValueAtTime(0, ctx.currentTime); }
      }
    }
  }

  // ==========================================================================
  // MIXER API
  // ==========================================================================
  function setMasterVolume(val) {
    masterVolume = Math.max(0, Math.min(1, val));
    if (ctx && masterGain && playing) { masterGain.gain.cancelScheduledValues(ctx.currentTime); masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime); }
  }
  function setLayerVolume(layer, val) { if (layerVolumes[layer] != null) { layerVolumes[layer] = Math.max(0, Math.min(1, val)); if (ctx) applyLayerGain(layer); } }
  function setLayerRate(layer, rate) { if (layerRate[layer] != null) layerRate[layer] = Math.max(0.05, rate); }
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
    toggleLayer: toggleLayer, getState: getState,
    LAYERS: LAYERS.slice(), LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS, DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    SCALE_INFO: SCALE_INFO,
    getArc: getArc, getArcInfo: arcInfo,
    getMode: function () { return { key: currentMode, name: MODES[currentMode].name, kana: MODES[currentMode].kana.slice() }; },
    setNoteListener: function (fn) { if (typeof fn === "function") { if (noteListeners.indexOf(fn) < 0) noteListeners.push(fn); } else noteListeners.length = 0; },
    setEventListener: function (fn) { if (typeof fn === "function") { if (eventListeners.indexOf(fn) < 0) eventListeners.push(fn); } else eventListeners.length = 0; },
    getAudioContext: function () { return ctx; },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    attachAnalyser: function (node) { if (!masterGain || !node) return false; try { masterGain.connect(node); return true; } catch (e) { return false; } },
    attachLayerAnalyser: function (layer, node) { if (!layerGains[layer] || !node) return false; try { layerGains[layer].connect(node); return true; } catch (e) { return false; } },
  };
})();
