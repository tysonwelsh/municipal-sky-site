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
// ============================================================================

window.ZankyoAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null;
  var reverbSend = null, reverbDry = null, reverbWet = null, reverbConv = null, reverbPreDelay = null;
  var gritShaper = null;           // distortion bus (gritty instruments route here)
  var shamEdge = null;             // shamisen's own gentle saturator (bite without the grit-bus onset spike)
  var dryGritGain = null;          // parallel dry grit send, opened up toward the kyū climax
  var masterSat = null;
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // SEEDED RNG — every musical choice flows through rng(); a performance is
  // reproducible and shareable (?seed=). Math.random survives only in init
  // noise-buffer / reverb-IR generation, where it shapes texture, not music.
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
  var rngState = seed;
  function mulberry32() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rng() { return mulberry32(); }
  function rnd(a, b) { return a + rng() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function chance(p) { return rng() < p; }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickW(pool) {              // pool = [[value, weight], ...]
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = rng() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
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
  function pickMode() { return pickW(metaModePool()); }
  function setMode(name, extra) {
    if (!MODES[name]) return;
    currentMode = name; CUR_OFFSETS = MODES[name].offsets; rebuildScale();
    SCALE_INFO.name = MODES[name].name; SCALE_INFO.kana = MODES[name].kana.slice();
    emitEvent({ cat: "mode", label: "⟳ mode", detail: MODES[name].name + (extra ? " · " + extra : "") });
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
  var LAYER_VOL_TRIM = { shakuhachi: 1.1, koto: 1.1, shamisen: 2.2 };

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
    for (var ni = 0; ni < noiseSamples; ni++) nd[ni] = Math.random() * 2 - 1;   // texture, not music — stays unseeded

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
    outTrim.connect(ctx.destination);

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
      // Makeup-DOWN: the grit curve boosts small signals ~27x and rails the bus
      // to full-scale under any real drone level, leaving the master zero
      // headroom — so every new note onset (koto, taiko) clips into an audible
      // click. Pull the gritty bus back to a sane level; the distortion timbre
      // is baked into the waveshape and survives the attenuation.
      var gritMakeup = ctx.createGain();
      gritMakeup.gain.setValueAtTime(0.4, ctx.currentTime);
      gritShaper.connect(gritMakeup);
      gritMakeup.connect(reverbSend);
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
      shamEdge.connect(reverbSend);

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
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
  }

  function buildReverbIR() {
    var len = Math.floor(ctx.sampleRate * REVERB.decay);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var ph1 = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;  // per-channel phase → no comb (texture, unseeded)
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
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    node.gain.setValueAtTime(layerMuted[layer] ? 0 : layerVolumes[layer] * trim, ctx.currentTime);
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
  var ARC_PERIOD = 420;                          // the CURRENT cycle's length — redrawn ~rnd(300,600)s at each boundary
  var arcStartTime = 0;                          // start of the CURRENT cycle (advances by ARC_PERIOD at each boundary)
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
  function arcPos() {                            // raw 0..1 position within the cycle
    if (!ctx || !playing) return 0;
    return (((ctx.currentTime - arcStartTime) / ARC_PERIOD) % 1 + 1) % 1;
  }
  function arcPhase() {
    if (!ctx || !playing) return "—";
    var ph = arcPos();
    return ph < 0.45 ? "jo" : ph < 0.82 ? "ha" : ph < 0.95 ? "kyū" : "release";
  }
  function arcInfo() {
    if (!ctx || !playing) return { level: 0, phase: "—" };
    return { level: getArc(), phase: arcPhase() };
  }

  // ==========================================================================
  // META-ARC — the journey across cycles
  // ==========================================================================
  // Cycles used to be identical 420 s laps. Now each jo-ha-kyū draws its own
  // length, and a slow seeded meta-curve (one swing ≈ 5–8 cycles) travels over
  // them: at the meta-TROUGH the music rests at home — hirajoshi/kumoi-leaning,
  // a KIRU that is barely a breath; at the meta-PEAK it has migrated somewhere
  // dark — in-sen/iwato-leaning, a devastating cut, the bell tolling twice —
  // and then it returns. A long listen goes somewhere and comes back; the
  // loop becomes a journey.
  var metaCycle = -1;                            // current cycle index (-1 = not started)
  var metaPeriod = 6;                            // cycles per meta-swing — redrawn each full swing
  var metaPhase = 0;                             // meta position within the swing, 0..1 (wraps)
  var metaPos = 0;                               // 0 = trough (home, light) … 1 = peak (dark)
  function metaSeverity() { return metaPos; }    // KIRU severity rides the meta-curve directly
  // Gentle global density tilt (±12% on melodic rest multipliers): the dark
  // half of the journey crowds in a little; the return breathes out again.
  function metaRestMul() { return 1 + 0.12 * (1 - 2 * metaPos); }
  // Mode-lottery drift: the trough leans home (hirajoshi/kumoi); the peak
  // leans toward the two darkest modes (in-sen's flat 2nd, iwato's tritone).
  // Deliberately flat-ish — every mode stays in play at every meta position;
  // the journey is a lean, not a lockout.
  function metaModePool() {
    var d = metaPos;
    return [
      ["hirajoshi", 4 - 2 * d],
      ["insen", 2 + 2 * d],
      ["kumoi", 3 - 1.5 * d],
      ["iwato", 1.5 + 2.5 * d],
    ];
  }
  // Called once per cycle boundary (from updateDryGrit's watch): draw this
  // cycle's length, advance the meta-curve, modulate the mode, refresh the
  // motif working set. Everything here is seeded — a boundary is a downbeat
  // of the long form, not a reset.
  function beginCycle(n) {
    metaCycle = n;
    ARC_PERIOD = rnd(300, 600);                  // this cycle's own breadth
    if (n === 0) { metaPeriod = rnd(5, 8); metaPhase = 0; }
    else {
      metaPhase += 1 / metaPeriod;
      if (metaPhase >= 1) { metaPhase -= 1; metaPeriod = rnd(5, 8); }   // a new swing, its own span
    }
    metaPos = 0.5 - 0.5 * Math.cos(2 * Math.PI * metaPhase);
    // Cycle 0 draws from the same lottery as every other boundary (at the
    // trough, so home-leaning) — a performance can open in any mode, and the
    // draw is seeded, so a shared ?seed= still opens identically.
    setMode(pickMode(),
      "cycle " + n + " · " + Math.round(ARC_PERIOD) + "s · meta " + metaPos.toFixed(2) +
      (metaPhase < 0.5 ? " (drifting dark)" : " (returning light)"));
    Motif.newCycle();
  }
  function getMetaInfo() {                       // read-only console/harness surface
    return { cycle: metaCycle, metaPos: metaPos, period: ARC_PERIOD, severity: metaSeverity(), metaPeriod: metaPeriod };
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
    i = Math.round(i);
    while (i < 0) i += 5;
    while (i > SCALE.length - 1) i -= 5;
    return i;
  }
  // Shift a motif into a voice's register by whole octaves (mean toward the
  // voice's center), then fold stragglers — the intervals survive intact.
  function fitToRegister(notes, center) {
    if (!notes.length) return [];
    var sum = 0, i;
    for (i = 0; i < notes.length; i++) sum += notes[i].deg;
    var shift = Math.round((center - sum / notes.length) / 5) * 5;
    var out = [];
    for (i = 0; i < notes.length; i++) out.push({ deg: foldDeg(notes[i].deg + shift), durBeats: notes[i].durBeats });
    return out;
  }

  var Motif = (function () {
    var NAMES = ["イ", "ロ", "ハ"];                // katakana iroha — the working set's names
    var SEED_PHRASES = [                           // the six authentic gestures — the ancestor pool
      { name: "honkyoku descent", degs: [3, 2, 1, 0], durs: [1, 1, 1, 2] },            // → tonic (shakuhachi, jo)
      { name: "sakura sigh",      degs: [1, 2, 1],    durs: [1, 1.5, 2] },             // the most recognizably-Japanese turn
      { name: "kumoi cadence",    degs: [4, 3, 0],    durs: [1, 1, 2] },
      { name: "tsugaru run",      degs: [0, 1, 2, 3, 4], durs: [0.5, 0.5, 0.5, 0.5, 1.5] },  // hammer run
      { name: "midare leaps",     degs: [0, 4, 1, 3, 0], durs: [1, 0.5, 1, 0.5, 2] },  // scattered (kyū)
      { name: "kakegoe answer",   degs: [0, 1, 2],    durs: [0.5, 0.5, 1.5] },         // retrograde-pairs with the sigh
    ];
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
      return { name: name, gen: 0, chain: [], notes: notes };
    }

    // ---- the transform algebra (each mutates a clone; chain appended by develop) ----
    var TRANSFORMS = {
      invert: function (m) {                       // mirror on the first degree
        var axis = m.notes[0].deg;
        m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        return m;
      },
      transpose: function (m) {                    // ±1–3 scale DEGREES — real pitch-content change, not octaves
        var by = pickW([[1, 3], [2, 3], [-1, 3], [-2, 3], [3, 1], [-3, 1]]);
        m.notes.forEach(function (n) { n.deg += by; });
        return m;
      },
      fragmentHead: function (m) { m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      fragmentTail: function (m) { m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      augment: function (m) {
        var f = rnd(1.35, 1.9);
        m.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * f); });
        return m;
      },
      diminish: function (m) {
        var f = rnd(0.5, 0.72);
        m.notes.forEach(function (n) { n.durBeats = Math.max(0.3, n.durBeats * f); });
        return m;
      },
      retrograde: function (m) { m.notes.reverse(); return m; },
      sequence: function (m) {                     // restate at a transposition — real sequencing
        var step = pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = m.notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
        m.notes = m.notes.concat(rep).slice(0, 12);            // runaway guard
        return m;
      },
      ornament: function (m) {                     // neighbor-tone turns — koto kazashi / shakuhachi ornaments
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && chance(0.6)) {
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
    function pickTransform(voice, m, chain) {
      var w = VOICE_WEIGHTS[voice] || VOICE_WEIGHTS.koto;
      var tilt = PHASE_TILT[arcPhase()] || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1);
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        pool.push([name, wt]);
      }
      return pool.length ? pickW(pool) : null;
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
    function develop(voice, m, maxChain) {
      // Renewal: after long development the line returns to its source —
      // identity over archaeology (ledger ping-pong otherwise compounds
      // generations into the twenties).
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = anc; }
      var out = clone(m);
      var links = rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voice, out, out.chain.concat(used));
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
      emitEvent({ cat: voice, label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") + " · " + arcPhase() });
      return out;
    }
    // The ma decomposing a motif: notes released, time stretched.
    function decompose(m, voice) {
      var out = clone(m);
      var keep = Math.max(2, Math.round(out.notes.length * rnd(0.4, 0.7)));
      while (out.notes.length > keep) out.notes.splice(rint(1, out.notes.length - 1), 1);
      out.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * rnd(1.4, 2)); });
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: voice, label: "散 " + out.name + " decomposes", detail: "releasing notes into the ma" });
      return out;
    }
    function makeGhost(m) {
      var g = clone(m);
      var keep = Math.max(2, Math.round(g.notes.length * 0.5));
      while (g.notes.length > keep) g.notes.splice(rint(1, g.notes.length - 1), 1);
      g.notes.forEach(function (n) { n.durBeats = Math.min(8, n.durBeats * rnd(2, 3)); });
      g.chain = g.chain.concat(["ghost"]);
      return g;
    }

    // ---- what should a voice play right now? ----
    function request(voice) {
      if (!working.theme) return null;
      var phase = arcPhase();
      // After the KIRU hush, the new jo opens with a decomposed ghost of the
      // previous cycle's deepest development — the journey across the cut.
      if (ghost && phase === "jo") {
        var g = ghost; ghost = null;
        emitEvent({ cat: voice, label: "残 ghost of " + g.name + "·g" + g.gen, detail: "the last cycle, decomposed — notes dropped, time stretched" });
        return g;
      }
      // ONE guaranteed verbatim theme statement, late in the kyū — the last
      // word before the cut. The shakuhachi speaks it.
      if (voice === "shakuhachi" && !reprised && phase === "kyū" && arcPos() > 0.9) {
        reprised = true;
        emitEvent({ cat: "shakuhachi", label: "✸ reprise " + working.theme.name, detail: "the theme verbatim — the last word before the cut" });
        return clone(working.theme);
      }
      var m;
      if (phase === "jo") m = chance(0.7) ? working.theme : pick(working.subs);
      else if (phase === "ha") m = pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]);
      else m = chance(0.6) ? working.theme : pick(working.subs);   // kyū/release: the theme drives
      if (!m) m = working.theme;
      // Work what the cycle has BUILT: continue from the most-developed living
      // descendant about half the time in ha/kyū (the tether keeps it honest).
      if (phase === "ha" || phase === "kyū") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && chance(0.45)) m = line;
      }
      // jo states plainly first — an idea must be LEARNED before it is worked,
      // but only a few times: after that, even the jo varies it
      if (phase === "jo" && m.gen === 0 && (plainCounts[m.name] || 0) < 3 && chance(0.5)) {
        plainCounts[m.name] = (plainCounts[m.name] || 0) + 1;
        emitEvent({ cat: voice, label: "○ " + m.name + " stated plain", detail: m.notes.length + " notes · jo" });
        return clone(m);
      }
      if (phase === "release") return decompose(m, voice);          // the ma after the cut
      return develop(voice, m, phase === "kyū" ? 3 : 2);
    }

    // ---- dialogue ledger: real obligations between voices, with deadlines ----
    var POST_P = { shakuhachi: 0.45, koto: 0.4, shamisen: 0.35 };   // ≈ the old per-voice answer densities
    var POST_TO = {
      shakuhachi: [["koto", 3], ["shamisen", 2]],
      koto: [["shakuhachi", 3], ["shamisen", 2]],
      shamisen: [["koto", 3], ["shakuhachi", 2]],
    };
    function post(fromVoice, toVoice, motif, type) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: ctx.currentTime + rnd(6, 16) });
      if (ledger.length > 6) ledger.shift();
    }
    function postFrom(voice, motif) {
      if (!working.theme || !chance(POST_P[voice] || 0.4)) return;
      post(voice, pickW(POST_TO[voice]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    }
    function claim(voice) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      if (!ob) {
        // Call-and-response must be AUDIBLE: an obligation past its deadline
        // is taken up by whichever voice speaks next (never the caller itself).
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && ctx.currentTime > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = clone(anc); }   // renewal applies to answers too
      var ans;
      if (ob.type === "imitate") ans = develop(voice, m, 1);
      else if (ob.type === "invert") {
        // mirror the call — unless the call was itself a mirror (invert∘invert
        // is a no-op): then answer with the crab, or a transposition.
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(voice, m, 2);
      stats.answers++;
      emitEvent({ cat: voice, label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen });
      return ans;
    }
    function overdueFor(voice) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && ctx && ctx.currentTime > ledger[i].deadline) return true;
      }
      return false;
    }

    // ---- cycle boundaries (called at each mode change) ----
    function newCycle() {
      // carry a decomposed memory of the deepest development across the cut
      ghost = null;
      var deepest = null, k;
      for (k in lineage) if (lineage[k] && (!deepest || lineage[k].gen > deepest.gen)) deepest = lineage[k];
      if (deepest && deepest.gen > 0) ghost = makeGhost(deepest);
      // a fresh working set, drawn from the ancestral pool
      var order = [0, 1, 2, 3, 4, 5], picks = [];
      while (picks.length < 3) picks.push(order.splice(Math.floor(rng() * order.length), 1)[0]);
      working.theme = fromSeed(picks[0], NAMES[0]);
      working.subs = [fromSeed(picks[1], NAMES[1]), fromSeed(picks[2], NAMES[2])];
      // subsidiaries may enter pre-transposed — pitch variety, not novelty churn
      working.subs.forEach(function (s) {
        if (chance(0.5)) { TRANSFORMS.transpose(s); s.chain = ["transpose"]; recentre(s); }
      });
      ledger.length = 0;
      lineage = {};
      reprised = false;
      plainCounts = {};
      emitEvent({
        cat: "mode", label: "❁ working set",
        detail: NAMES[0] + " " + SEED_PHRASES[picks[0]].name + " · " + NAMES[1] + " " + SEED_PHRASES[picks[1]].name + " · " + NAMES[2] + " " + SEED_PHRASES[picks[2]].name,
      });
    }
    function reset() {
      working.theme = null; working.subs = [];
      ledger.length = 0; lineage = {}; ghost = null; reprised = false; plainCounts = {};
    }

    // The guaranteed kyū reprise outranks even ledger obligations — the voice
    // asks this first so the theme's last word can never be talked over.
    function wantsReprise() {
      return !!working.theme && !reprised && arcPhase() === "kyū" && arcPos() > 0.9;
    }

    return {
      reset: reset, newCycle: newCycle, wantsReprise: wantsReprise,
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
  function walk(state, len, windowR, arc) {
    var notes = [];
    if (rng() < 0.4) state.dir = -state.dir;
    for (var i = 0; i < len; i++) {
      var step = rng() < (0.62 - arc * 0.18) ? 1 : rng() < 0.8 ? 2 : 3;
      state.idx += state.dir * step;
      if (state.idx < state.center - windowR) { state.idx = state.center - windowR; state.dir = 1; }
      if (state.idx > state.center + windowR) { state.idx = state.center + windowR; state.dir = -1; }
      if (state.idx < 0) state.idx = 0; else if (state.idx >= SCALE.length) state.idx = SCALE.length - 1;
      if (rng() < 0.34) state.idx = pullTo(state.idx, IMPORTANT_DEG);
      notes.push({ deg: state.idx, durBeats: 0.6 + rng() * 0.9 });
    }
    state.idx = pullTo(state.idx, REST_DEG);
    notes.push({ deg: state.idx, durBeats: 1.4 + rng() * 1.2 });
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
    var dur = 26 + rng() * 10, fadeIn = 7, fadeOut = 8;

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.8, now);
    var mlfo = c.createOscillator(), mg = c.createGain();
    mlfo.type = "sine"; mlfo.frequency.setValueAtTime(0.02 + rng() * 0.03, now);
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
    var overlap = 7 + rng() * 3;
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
    var dur = 14 + rng() * 8, fadeIn = 5, fadeOut = 6;

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
    var base = scaleIndexOf(6 + Math.floor(rng() * 2));
    var used = {};
    for (var v = 0; v < voices; v++) {
      var idx = base + [0, 1, 2, 4, 5][v % 5];
      if (idx >= SCALE.length) idx = SCALE.length - 1;
      if (used[idx]) idx = Math.min(SCALE.length - 1, idx + 1);
      used[idx] = 1;
      var f = SCALE[idx].freq;
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, now);
      o.detune.setValueAtTime((rng() * 2 - 1) * 6 * drift, now);
      var dl = c.createOscillator(), dlg = c.createGain();
      dl.type = "sine"; dl.frequency.setValueAtTime(0.05 + rng() * 0.08, now);
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
    var overlap = 4 + rng() * 2;
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

    // motif work — ledger obligations first, then the working set; free walks
    // remain as the improvisatory glue between statements
    var phrase, motif = null;
    if (Motif.wantsReprise()) motif = Motif.request("shakuhachi");
    if (!motif && Motif.overdueFor("shakuhachi")) motif = Motif.claim("shakuhachi");
    if (!motif && chance(0.6)) motif = Motif.request("shakuhachi");
    if (motif) {
      phrase = fitToRegister(motif.notes, shakuState.center);
      Motif.postFrom("shakuhachi", motif);
    } else {
      phrase = walk(shakuState, 2 + Math.floor(rng() * 3) + Math.floor(arc * 2), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shakuhachi", label: "fresh", detail: phrase.length + " notes · " + arcPhase() });
    }
    if (phrase.length) shakuState.idx = phrase[phrase.length - 1].deg;   // melodic continuity for the next walk

    var beat = 0.62 / pace, t = now + 0.05, prev = null, sched = [];
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.25, n.durBeats * beat);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var glideFrom = (prev && rng() < glideAmt) ? prev : null;
      var mur = (i === 0 && rng() < muraiki * (0.4 + arc * 0.6));
      shakuhachiNote(f, t, dur, { glideFrom: glideFrom, breath: breath, muraiki: mur ? muraiki : 0, bend: rng() < ornament });
      sched.push({ f: f, t: t, dur: dur });
      prev = f;
      t += dur + rng() * 0.05;
    }
    // 〰 SANKYOKU HETEROPHONY — in the ha especially, the koto sometimes reads
    // the same phrase a breath behind (jiuta ensemble texture): the same note
    // list, its own ornament choices, a hair sharp.
    if (sched.length >= 3 && chance(arcPhase() === "ha" ? 0.22 : 0.08)) {
      var lag = rnd(0.15, 0.4), sharp = Math.pow(2, rnd(2, 3.5) / 1200), sprev = null;
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        kotoNote(sn.f * sharp, sn.t + lag + rnd(0, 0.05), Math.max(0.12, sn.dur * 0.8),
          { gain: 0.65, glideFrom: (sprev && chance(0.3)) ? sprev * sharp : null, bend: chance(0.2) });
        sprev = sn.f;
      }
      emitEvent({ cat: "koto", label: "〰 koto shadows shakuhachi", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" });
    }
    // MA — breathing space between phrases (more in jo, less in kyū; the meta
    // journey tilts overall density ±12% — the shakuhachi stays UNLOCKED from
    // the pulse but still breathes with the long form)
    var ma = (1.8 + rng() * 4) * (1 - arc * 0.55) * metaRestMul() / getRate("shakuhachi");
    scheduleRaw(shakuhachiPhrase, (t - now + ma) * 1000);
  }
  function shakuhachiNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var out = panAt("shakuhachi", (rng() * 2 - 1) * 0.25);
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
      nz.start(t, rng() * 20); nz.stop(t + dur + 0.1);
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
    var phrase, motif = null;
    if (Motif.overdueFor("koto")) motif = Motif.claim("koto");
    if (!motif && chance(0.55)) motif = Motif.request("koto");
    if (motif) { phrase = fitToRegister(motif.notes, kotoState.center); Motif.postFrom("koto", motif); }
    else {
      phrase = walk(kotoState, 3 + Math.floor(rng() * 3) + Math.floor(arc * 2), 7 + Math.round(arc * 2), arc);
      emitEvent({ cat: "koto", label: "fresh", detail: phrase.length + " notes" });
    }
    if (phrase.length) kotoState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic pulse)
    var beat = 0.4 / pace, t = pulseSnap(now + 0.05, arc), prev = null, sched = [];
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = pulseQuantDur(Math.max(0.12, n.durBeats * beat), arc);
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      kotoNote(f, t, dur, { glideFrom: (prev && rng() < 0.3) ? prev : null, bend: rng() < 0.2 });
      sched.push({ f: f, t: t, dur: dur });
      prev = f; t += dur + rng() * 0.03;
    }
    // 〰 sankyoku heterophony downward: the shamisen sometimes shadows the koto
    // a breath behind — same page, its own accents, a hair sharp.
    if (sched.length >= 3 && chance(arcPhase() === "ha" ? 0.2 : 0.07)) {
      var lag = rnd(0.15, 0.4), sharp = Math.pow(2, rnd(2, 3.5) / 1200);
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        shamisenNote(sn.f * sharp, sn.t + lag + rnd(0, 0.04), Math.max(0.1, Math.min(sn.dur, 0.3)), { gain: sh % 2 === 0 ? 0.6 : 0.4 });
      }
      emitEvent({ cat: "shamisen", label: "〰 shamisen shadows koto", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" });
    }
    // glissando flourish — a rapid run up/down the scale (more in ha/kyū)
    if (rng() < glissAmt * (0.3 + arc)) {
      var up = rng() < 0.5, start = kotoState.idx, gn = 4 + Math.floor(rng() * 5), gt = t;
      for (var k = 0; k < gn; k++) {
        var gi = Math.max(0, Math.min(SCALE.length - 1, start + (up ? k : -k)));
        kotoNote(SCALE[gi].freq, gt, 0.14, { gain: 0.7 }); gt += 0.05 + rng() * 0.03;
      }
      t = gt; emitEvent({ cat: "koto", label: "gliss", detail: (up ? "↑" : "↓") + gn });
    }
    var rest = (1.6 + rng() * 3.2) * (1 - arc * 0.5) * (arc < 0.15 ? 4 : 1) * metaRestMul() / getRate("koto");  // sparse in jo; meta tilts density ±12%
    scheduleRaw(kotoPhrase, (t - now + rest) * 1000);
  }
  function kotoNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var bright = getLayerParam("koto", "brightness", 7), sustain = getLayerParam("koto", "sustain", 1.0);
    var out = panAt("koto", (rng() * 2 - 1) * 0.35);
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
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atkK);
    g.gain.exponentialRampToValueAtTime(peak * 0.3, t + decA);
    g.gain.linearRampToValueAtTime(0, t + dec);
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
    var phrase, motif = null;
    if (Motif.overdueFor("shamisen")) motif = Motif.claim("shamisen");
    if (!motif && chance(0.45)) motif = Motif.request("shamisen");
    if (motif) { phrase = fitToRegister(motif.notes, shamiState.center); Motif.postFrom("shamisen", motif); }
    else {
      phrase = walk(shamiState, 3 + Math.floor(rng() * 4) + Math.floor(arc * 3), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shamisen", label: "fresh", detail: phrase.length + " notes · " + arcPhase() });
    }
    if (phrase.length) shamiState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic pulse)
    var beat = 0.28 / pace, t = pulseSnap(now + 0.05, arc);
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      var dur = pulseQuantDur(Math.max(0.1, Math.min(n.durBeats, 1) * beat), arc);
      // tsugaru hammer-on: a quick lower-neighbor grace before the beat
      if (rng() < 0.25 + arc * 0.3) {
        shamisenNote(SCALE[Math.max(0, n.deg - 1)].freq, t, 0.05, { gain: 0.55 });
        t += 0.05;
      }
      shamisenNote(f, t, dur, { gain: (i % 2 === 0 ? 1.0 : 0.6) });
      t += dur + 0.01;
    }
    var rest = (2.2 + rng() * 3.5) * (1 - arc * 0.6) * (arc < 0.3 ? 5 : 1) * metaRestMul() / getRate("shamisen");  // mostly absent in jo; meta tilts density ±12%
    scheduleRaw(shamisenPhrase, (t - now + rest) * 1000);
  }
  function shamisenNote(freq, t, dur, opts) {
    var c = ctx; opts = opts || {};
    var sawari = getLayerParam("shamisen", "sawari", 0.6), attack = getLayerParam("shamisen", "attack", 0.5);
    var out = panAt("shamisen", (rng() * 2 - 1) * 0.3);
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
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(peak * 0.2, t + decA);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
    if (sawari > 0.01) {                                   // sawari buzz — bright high resonance (grit)
      var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(freq * 1.005, t);
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(freq * 7, t); bp.Q.setValueAtTime(6, t);
      var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);
      bg.gain.setValueAtTime(0, t);                        // linear fade-in from true zero (no resonant onset tick)
      bg.gain.linearRampToValueAtTime(0.05 * sawari, t + Math.min(0.014, dur * 0.4));
      bg.gain.exponentialRampToValueAtTime(0.005 * sawari, t + dur * 0.7);
      bg.gain.linearRampToValueAtTime(0, t + dur * 1.1);
      bo.start(t); bo.stop(t + dur * 1.2 + 0.05);
    }
    emitNote("shamisen", freq, t, dur);
  }

  // ==========================================================================
  // TAIKO 太鼓 — drums (silent in jo; drives the ha → kyū climb)
  // ==========================================================================
  function startTaiko() { if (playing) taikoPulse(); }
  function taikoHit(t, accent) {
    var c = ctx, out = panAt("taiko", (rng() * 2 - 1) * 0.2);
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
      nz.start(t, rng() * 10); nz.stop(t + 0.2);
    }
  }
  function taikoPulse() {
    if (!playing) return;
    var now = ctx.currentTime, arc = getArc();
    if (arc < 0.3) { pulse.active = false; scheduleRaw(taikoPulse, (3 + rng() * 3) * 1000); return; }   // silent in jo — no grid to lock to
    var bpm = 50 + arc * 90, beat = 60 / bpm, beats = 2 + Math.floor(arc * 8), t = now + 0.05;
    pulse.bpm = bpm; pulse.beat = beat; pulse.anchor = t; pulse.active = true;   // publish the grid — the ensemble magnetizes to this
    for (var i = 0; i < beats; i++) { if (rng() < 0.5 + arc * 0.45) taikoHit(t, i % 4 === 0); t += beat * (rng() < 0.3 ? 0.5 : 1); }
    emitEvent({ cat: "taiko", label: "pattern", detail: beats + " beats · " + Math.round(bpm) + "bpm" });
    var rest = (2 + rng() * 4) * (1 - arc * 0.7) / getRate("taiko");
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

    var dur = 2 + rng() * 5 + arc * 4;
    var nz = noiseSource();
    var bp = c.createBiquadFilter();
    bp.type = arc > 0.6 ? "bandpass" : "lowpass";
    var fc = 200 + color * 3000 + arc * 2500;
    bp.frequency.setValueAtTime(fc, now); bp.Q.setValueAtTime(0.5 + crush * 8 + arc * 6, now);
    // sweep the filter for a scraping motion
    bp.frequency.linearRampToValueAtTime(fc * (0.5 + rng()), now + dur);
    var g = c.createGain(); nz.connect(bp); bp.connect(g); g.connect(out);
    var peak = (0.05 + arc * 0.22) * (0.4 + density);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    nz.start(now, rng() * 10); nz.stop(now + dur + 0.1);
    if (arc > 0.4) emitEvent({ cat: "noise", label: "wall", detail: arcPhase() });

    var gap = (6 + rng() * 10) * (1 - arc * 0.6) / (0.4 + density);
    scheduleLayer(noiseEvent, gap * 1000, "noise");
  }

  // ==========================================================================
  // AMBIENT — quirky events (derelict orbital station incidentals)
  // ==========================================================================
  function ambBonsho(t) {                          // temple bell (bonshō) — deep, long, inharmonic
    var out = panAt("ambient", (rng() * 2 - 1) * 0.3);
    var base = degFreq(0, -1) * (rng() < 0.5 ? 1 : Math.pow(2, 7 / 12));
    var partials = [{ m: 1, a: 0.08, d: 6 }, { m: 2.7, a: 0.04, d: 4 }, { m: 5.2, a: 0.02, d: 2.4 }, { m: 8.1, a: 0.012, d: 1.5 }];
    partials.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * p.m, t); o.detune.setValueAtTime((rng() * 2 - 1) * 5, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p.a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      o.start(t); o.stop(t + p.d + 0.1);
    });
  }
  function ambFurin(t) {                            // wind-chime (fūrin) — a few tiny high pings
    var out = panAt("ambient", (rng() * 2 - 1) * 0.6);
    var n = 2 + Math.floor(rng() * 3), tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(rng() * 4));
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq * 2, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.start(tt); o.stop(tt + 1.5); tt += 0.12 + rng() * 0.2;
    }
  }
  function ambSuikinkutsu(t) {                      // water drip resonance (suikinkutsu)
    var out = panAt("ambient", (rng() * 2 - 1) * 0.5);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(7) + Math.floor(rng() * 5))].freq * 2;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
  }
  function ambGlitch(t) {                           // digital glitch / static burst (the 3042 grit)
    if (!sharedNoiseBuf) return;
    var out = panAt("ambient", (rng() * 2 - 1) * 0.8);
    var n = 3 + Math.floor(rng() * 6), tt = t;
    for (var i = 0; i < n; i++) {
      var nz = noiseSource();
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(800 + rng() * 4000, tt);
      var g = ctx.createGain(); nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.02 + rng() * 0.05;
      g.gain.setValueAtTime(0.05, tt); g.gain.setValueAtTime(0.0001, tt + d);
      nz.start(tt, rng() * 10); nz.stop(tt + d + 0.02); tt += d + rng() * 0.06;
    }
  }
  function ambDistantTaiko(t) {                     // a lone distant drum hit
    var out = panAt("ambient", (rng() * 2 - 1) * 0.4);
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
      nz.start(t, rng() * 10); nz.stop(t + 0.2);
    }
  }
  function ambKotoSweep(t) {                        // a fast koto-ish glissando flourish
    var out = panAt("ambient", (rng() * 2 - 1) * 0.5);
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
    var c = ctx, out = panAt("ambient", (rng() * 2 - 1) * 0.4);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(0) + Math.floor(rng() * 5))].freq, dec = 1.6 + rng() * 1.2;
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
    var c = ctx, out = panAt("ambient", (rng() * 2 - 1) * 0.6);
    var carrier = c.createOscillator(); carrier.type = "sawtooth"; carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(2)].freq * 2, t);
    var vca = c.createGain(); vca.connect(out); vca.gain.setValueAtTime(0.0001, t);
    [700, 1100, 2600].forEach(function (ff) { var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(ff, t); bp.Q.setValueAtTime(8, t); carrier.connect(bp); bp.connect(vca); });
    var syl = 3 + Math.floor(rng() * 4), tt = t;
    for (var i = 0; i < syl; i++) {
      var d = 0.05 + rng() * 0.12;
      carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(Math.floor(rng() * 5))].freq * 2, tt);
      vca.gain.setValueAtTime(0.05, tt); vca.gain.setValueAtTime(0.0001, tt + d);
      tt += d + 0.04 + rng() * 0.08;
    }
    carrier.start(t); carrier.stop(tt + 0.1);
    if (sharedNoiseBuf) { var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(2000, t); var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out); ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.0001, tt); nz.start(t, rng() * 10); nz.stop(tt + 0.1); }
  }
  function ambGeigerHum(t) {                        // dying machinery — sagging drone + thinning radiation clicks
    var c = ctx, out = panAt("ambient", (rng() * 2 - 1) * 0.3), dur = 3 + rng() * 3, base = degFreq(0, -2);
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
        nz.start(tt, rng() * 10); nz.stop(tt + 0.03);
        tt += 0.05 + rng() * 0.3 * (1 + ((tt - t) / dur) * 3);   // clicks thin out as it dies
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
    var r = rng() * total, entry = AMBIENT_POOL[0];
    for (i = 0; i < AMBIENT_POOL.length; i++) { r -= AMBIENT_POOL[i].w; if (r <= 0) { entry = AMBIENT_POOL[i]; break; } }
    try { entry.fn(now + 0.05); } catch (e) {}
    emitEvent({ cat: "ambient", label: entry.name });
    var gap = (12 + rng() * 22) * (1 - getArc() * 0.35);
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
    metaCycle = -1; lastPhase = "";
    pulse.active = false;                        // no grid until the taiko speaks
    Motif.reset();                               // updateDryGrit() below builds cycle 0's working set
    emitEvent({ cat: "mode", label: "▶ play", detail: "seed " + seed });
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
  // Watches for the cycle boundary (each cycle its own seeded length → the
  // meta-arc advances, the mode modulates), and fires the KIRU (斬 — the cut)
  // at the kyū → release transition: the climax's payoff.
  var lastPhase = "";
  function updateDryGrit() {
    if (!playing) return;
    if (dryGritGain) dryGritGain.gain.setTargetAtTime(getArc() * 0.7, ctx.currentTime, 0.5);
    if (metaCycle < 0) beginCycle(0);
    else if (ctx.currentTime - arcStartTime >= ARC_PERIOD) { arcStartTime += ARC_PERIOD; beginCycle(metaCycle + 1); }
    var phase = arcPhase();
    if (lastPhase === "kyū" && phase === "release") kiru();
    lastPhase = phase;
    scheduleRaw(updateDryGrit, 700);
  }
  // 斬 KIRU — a final taiko roll + noise swell, then a sudden cut to a hush; a
  // lone temple bell rings in the silence (ma); the voices return as a new jo.
  // Severity rides the meta-curve: at the trough a passing hush (shallow dip,
  // ~3 s of ma, one bell); at the peak a devastating cut (down to 0.08 of
  // master, up to ~9 s of held silence, the bell tolling twice).
  function kiru() {
    if (!ctx || !masterGain || !playing) return;
    var t = ctx.currentTime;
    var sev = metaSeverity();
    var dip = 0.3 - 0.22 * sev;                                           // hush depth: 0.3 → 0.08 of master
    var hold = 3 + 6 * sev;                                               // held silence: ~3 s → ~9 s
    var twice = sev > 0.45 && chance(0.4 + sev * 0.5);                    // the bell tolls again near the peak
    for (var i = 0; i < 6; i++) taikoHit(t + i * 0.08, i === 5);          // final roll
    var nz = noiseSource(), bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(4500, t + 0.5); bp.Q.setValueAtTime(2, t);
    var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(lg("noise"));
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28, t + 0.5); ng.gain.setValueAtTime(0.0001, t + 0.56);
    nz.start(t); nz.stop(t + 0.6);
    masterGain.gain.cancelScheduledValues(t);                            // the cut
    masterGain.gain.setValueAtTime(masterVolume, t + 0.52);
    masterGain.gain.linearRampToValueAtTime(masterVolume * dip, t + 0.58);
    ambBonsho(t + 0.78);                                                  // a lone bell in the ma
    if (twice) ambBonsho(t + 0.78 + hold * rnd(0.4, 0.6));                // … and again, deeper into the silence
    masterGain.gain.setValueAtTime(masterVolume * dip, t + 0.6 + hold);  // hold the silence
    masterGain.gain.linearRampToValueAtTime(masterVolume, t + 0.6 + hold + 1.5);  // voices return
    emitEvent({ cat: "noise", label: "斬 KIRU", detail: "the cut · severity " + sev.toFixed(2) + " · hush " + dip.toFixed(2) + " · ma " + hold.toFixed(1) + "s" + (twice ? " · the bell twice" : "") });
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
    var base = scaleIndexOf(6);
    [0, 1, 2, 4, 5].forEach(function (off) { var f = SCALE[Math.min(SCALE.length - 1, base + off)].freq; var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.045, t); o.start(t); o.stop(t + dur + 0.1); });
  }
  function sampleNoise(t) {
    var dur = 2.5, nz = noiseSource(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(3000, t + dur); bp.Q.setValueAtTime(4, t);
    var g = ctx.createGain(); nz.connect(bp); bp.connect(g); g.connect(lg("noise"));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); nz.start(t, rng() * 5); nz.stop(t + dur + 0.1);
  }
  function sample(layer) {
    init();
    if (ctx.state === "suspended") ctx.resume();
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
      case "ambient": var e = AMBIENT_POOL[Math.floor(rng() * AMBIENT_POOL.length)]; try { e.fn(t); } catch (x) {} break;
    }
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
    toggleLayer: toggleLayer, getState: getState, sample: sample,
    LAYERS: LAYERS.slice(), LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS, DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    SCALE_INFO: SCALE_INFO,
    getArc: getArc, getArcInfo: arcInfo, getMetaInfo: getMetaInfo,
    getSeed: function () { return seed; },
    reseed: function (s) { seed = (s >>> 0) || 3042; rngState = seed; },
    getMotifStats: function () { return Motif.stats(); },
    getMode: function () { return { key: currentMode, name: MODES[currentMode].name, kana: MODES[currentMode].kana.slice() }; },
    setNoteListener: function (fn) { if (typeof fn === "function") { if (noteListeners.indexOf(fn) < 0) noteListeners.push(fn); } else noteListeners.length = 0; },
    setEventListener: function (fn) { if (typeof fn === "function") { if (eventListeners.indexOf(fn) < 0) eventListeners.push(fn); } else eventListeners.length = 0; },
    getAudioContext: function () { return ctx; },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    attachAnalyser: function (node) { if (!masterGain || !node) return false; try { masterGain.connect(node); return true; } catch (e) { return false; } },
    attachLayerAnalyser: function (layer, node) { if (!layerGains[layer] || !node) return false; try { layerGains[layer].connect(node); return true; } catch (e) { return false; } },
  };
})();
