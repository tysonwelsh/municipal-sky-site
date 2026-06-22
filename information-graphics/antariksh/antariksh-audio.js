// ============================================================================
// ANTARIKSH — aleatoric raga engine (audio)
//
// A standalone generative-music engine in the spirit of Prospero's Jukebox,
// but built around a single Hindustani raga: MALKAUNS (pentatonic, midnight,
// meditative). Free-rhythm alap — no metric pulse — over a tanpura drone, with
// a "balanced hybrid" timbre: traditional bones (tanpura, plucked string) plus
// a futuristic synth pad glowing underneath.
//
// PHASE 1 (this file, for now): the foundation —
//   • tanpura  — cyclic plucked drone (Sa + Ma, with jivari shimmer)
//   • pad      — continuous detuned synth drone (the futuristic glow)
// The melodic alap voices (neo-sitar lead, bansuri, pakad phrase memory, the
// performance arc) layer in next.
//
// Architecture mirrors Prospero's proven engine: one AudioContext, a master →
// compressor → destination chain, a convolver reverb, per-layer GainNodes,
// a rate-aware scheduler, and per-layer params exposed to a mixer UI. Single
// raga, so layers are top-level (no per-track dimension).
//
// Public surface: window.AntarikshAudio
// ============================================================================

window.AntarikshAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null;
  var reverbSend = null, reverbDry = null, reverbWet = null, reverbConv = null, reverbPreDelay = null;
  var padWaveshaper = null;
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // RAGA: MALKAUNS
  // ==========================================================================
  // Sa is the tonic. Deep register (C3) suits Malkauns' mandra-heavy, midnight
  // character. Swaras use just-intonation ratios from Sa — the tanpura drone in
  // particular wants pure intervals, not equal temperament.
  var SA_HZ = 130.81;                                    // C3
  var SWARA = {                                          // ratio from Sa
    S: 1 / 1,        // Sa
    g: 6 / 5,        // komal Ga  (minor third)
    M: 4 / 3,        // shuddha Ma (perfect fourth)
    d: 8 / 5,        // komal Dha (minor sixth)
    n: 16 / 9,       // komal Ni  (minor seventh)
  };
  var RAGA = {
    name: "Malkauns",
    thaat: "Bhairavi",
    swaras: ["S", "g", "M", "d", "n"],                  // pentatonic (audava)
    aroha:   ["S", "g", "M", "d", "n", "S'"],           // ascending
    avaroha: ["S'", "n", "d", "M", "g", "S"],           // descending
    vadi: "M",                                          // most important note
    samvadi: "S",                                       // second-most
    drone: ["S", "M"],                                  // no Pa → tanpura tunes to Ma
    mood: "midnight · meditative · deep",
  };
  // octave 0 = the central (madhya) Sa register; -1 = mandra (low), +1 = taar.
  function swaraFreq(name, octave) {
    return SA_HZ * SWARA[name] * Math.pow(2, octave || 0);
  }

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  var LAYERS = ["tanpura", "pad", "lead", "bansuri", "santoor", "ambient"];
  var DRONE_LAYERS = { pad: true };                     // route through warmth waveshaper

  var layerGains = {};                                  // layer -> GainNode
  var layerVolumes = { tanpura: 0.65, pad: 0.55, lead: 0.7, bansuri: 0.85, santoor: 0.5, ambient: 0.6 };
  var layerMuted   = { tanpura: false, pad: false, lead: false, bansuri: false, santoor: false, ambient: false };
  var layerRate    = { tanpura: 1, pad: 1, lead: 1, bansuri: 1, santoor: 1, ambient: 1 };

  var DEFAULT_LAYER_VOL = 0.8;

  // Mixer-exposed knobs per layer, with defaults.
  var LAYER_PARAM_DEFAULTS = {
    // tempo  — tanpura cycle length (s); brightness — jivari filter mult;
    // jivari — buzzing-shimmer amount; decay — string decay (s);
    // width  — stereo spread of the four strings.
    tanpura: { tempo: 6.5, brightness: 3.0, jivari: 0.8, decay: 6.0, width: 0.75 },
    // cutoff — pad lowpass (Hz); detune — pair detune (cents); movement —
    // filter-LFO depth; sub — sub-octave weight.
    pad:     { cutoff: 340, detune: 9, movement: 0.18, sub: 0.45 },
    // brightness — pluck filter cutoff mult; resonance — filter Q (sitar twang);
    // pace — overall speed (higher = faster notes + shorter rests); ornament —
    // andolan/turn amount; pakad — chance a phrase is a recalled signature
    // phrase vs freshly improvised; glide — meend (portamento) amount.
    lead:    { brightness: 8, resonance: 5, pace: 1.0, ornament: 0.5, pakad: 0.4, glide: 0.55 },
    // breath — airy noise amount; pace — speed; glide — meend amount.
    bansuri: { breath: 0.5, pace: 1.0, glide: 0.7 },
    // shimmer — octave shimmer-tail amount; spread — stereo placement.
    santoor: { shimmer: 0.5, spread: 0.55 },
    // No knobs — just volume / rate / mute. Events are self-contained.
    ambient: {},
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));

  // Cosmic reverb — long and spacious.
  var REVERB = { decay: 5.5, preDelay: 50, wet: 0.32, hfDamp: 1.6 };

  // ==========================================================================
  // LISTENERS (for a future visualization layer; harmless if unused)
  // ==========================================================================
  var noteListeners = [], ambientListeners = [];
  function emitNote(layer, freq, startTime, duration) {
    for (var i = 0; i < noteListeners.length; i++) {
      try { noteListeners[i]({ layer: layer, freq: freq, startTime: startTime, duration: duration || 0 }); } catch (e) {}
    }
  }
  // Phrase/event-level log feed (for the activity log UI). Each ev: { cat, label,
  // detail? } — cat is one of lead/bansuri/santoor/ambient/arc.
  var eventListeners = [];
  function emitEvent(ev) {
    if (eventListeners.length === 0) return;
    ev.t = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT — build the audio graph
  // ==========================================================================
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Shared white-noise buffer (for plucked-string excitation).
    var noiseSamples = Math.floor(ctx.sampleRate * NOISE_BUF_DURATION);
    sharedNoiseBuf = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    var nd = sharedNoiseBuf.getChannelData(0);
    for (var ni = 0; ni < noiseSamples; ni++) nd[ni] = Math.random() * 2 - 1;

    // Master chain: masterGain → compressor → destination.
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-22, ctx.currentTime);
    compressorNode.knee.setValueAtTime(12, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(4, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.01, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(compressorNode);
    compressorNode.connect(ctx.destination);

    // Effects chain (reverb + pad warmth). Falls back to dry on failure.
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

      padWaveshaper = ctx.createWaveShaper();
      padWaveshaper.curve = buildWaveshaperCurve(5);
      padWaveshaper.oversample = "2x";
      padWaveshaper.connect(reverbSend);

      effectsReady = true;
    } catch (e) {
      reverbSend = ctx.createGain();
      reverbSend.connect(masterGain);
      if (window.console) console.warn("Antariksh effects init failed, dry fallback:", e);
    }

    // Per-layer gain nodes. Drone layers route through the warmth waveshaper.
    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      if (DRONE_LAYERS[layer] && effectsReady && padWaveshaper) node.connect(padWaveshaper);
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
  }

  // Convolver IR — exponential noise tail (cosmic, long).
  function buildReverbIR() {
    var len = Math.floor(ctx.sampleRate * REVERB.decay);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate;
        var env = Math.exp(-3.0 * t / REVERB.decay);
        var hf = Math.exp(-REVERB.hfDamp * t / REVERB.decay);
        data[i] = (Math.random() * 2 - 1) * env * hf;
      }
    }
    reverbConv.buffer = buf;
    reverbPreDelay.delayTime.setValueAtTime(REVERB.preDelay / 1000, ctx.currentTime);
    reverbWet.gain.setValueAtTime(REVERB.wet, ctx.currentTime);
  }

  function buildWaveshaperCurve(amount) {
    var n = 256, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // ==========================================================================
  // SCHEDULING + LAYER HELPERS
  // ==========================================================================
  var timers = new Set();
  // Rate-aware: the whole delay is divided by the layer's RATE (more rate =
  // events fire more often). Used by single recurring events (tanpura cycle,
  // pad cycle, santoor sparkle).
  function scheduleLayer(fn, baseMs, layer) {
    var rate = getRate(layer);
    var ms = baseMs / (rate || 1);
    var id = setTimeout(function () {
      timers.delete(id);
      if (playing) fn();
    }, ms);
    timers.add(id);
  }
  // Rate-neutral: the caller has already applied any rate scaling. Used by the
  // phrase layers (lead, bansuri) so RATE shrinks only the inter-phrase rest,
  // never the phrase itself (which would overlap phrases at high rates).
  function scheduleRaw(fn, ms, layer) {
    var id = setTimeout(function () {
      timers.delete(id);
      if (playing) fn();
    }, ms);
    timers.add(id);
  }
  function clearAllTimers() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers.clear();
  }

  function lg(layer) { return layerGains[layer]; }
  // A per-event StereoPanner feeding a layer's gain (for spatial width).
  function panAt(layer, p) {
    var sp = ctx.createStereoPanner();
    sp.pan.setValueAtTime(p < -1 ? -1 : (p > 1 ? 1 : p), ctx.currentTime);
    sp.connect(layerGains[layer]);
    return sp;
  }
  // Per-layer "trims" — hidden multipliers so a layer can sit at a different
  // effective level than its slider reads. Lets us tune the actual feel while
  // the slider keeps a clean default (e.g. lead RATE shows 1.00× but plays
  // sparser). Trim 1 = no change.
  var LAYER_RATE_TRIM = { lead: 0.5 };          // sitar fires less often than the slider implies
  var LEAD_ORNAMENT_TRIM = 0.6;                 // and is less ornamented than the slider implies
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
    var vol = layerMuted[layer] ? 0 : layerVolumes[layer];
    node.gain.setValueAtTime(vol, ctx.currentTime);
  }

  // ==========================================================================
  // TANPURA — cyclic plucked drone (Sa + Ma) with jivari shimmer
  // ==========================================================================
  // The four strings of a Malkauns tanpura: Ma (madhyam — because there is no
  // Pa), two Sa, and a low Sa. Plucked in sequence, evenly across the cycle,
  // each ringing for seconds so they overlap into a continuous, breathing wash.
  function tanpuraCycle() {
    if (!playing) return;
    var now = ctx.currentTime;
    var tempo = getLayerParam("tanpura", "tempo", 4.2);
    var width = getLayerParam("tanpura", "width", 0.3);

    var strings = [
      { f: swaraFreq("M", 0),  pan: -1.0, g: 0.95 },     // Ma string (plucked first)
      { f: swaraFreq("S", 0),  pan:  0.5, g: 1.0 },      // Sa
      { f: swaraFreq("S", 0),  pan: -0.5, g: 1.0 },      // Sa
      { f: swaraFreq("S", -1), pan:  0.0, g: 0.8 },      // low Sa
    ];
    for (var i = 0; i < strings.length; i++) {
      var s = strings[i];
      // Even spacing across the cycle + a little human jitter.
      var t = now + (i / strings.length) * tempo + (Math.random() * 2 - 1) * 0.02;
      var out = panAt("tanpura", s.pan * width);
      tanpuraPluck(s.f, t, out, s.g);
      emitNote("tanpura", s.f, t);
    }
    scheduleLayer(tanpuraCycle, tempo * 1000, "tanpura");
  }

  function tanpuraPluck(freq, t, out, gainMult) {
    var c = ctx;
    if (gainMult == null) gainMult = 1;
    var decay = getLayerParam("tanpura", "decay", 3.6);
    var bright = getLayerParam("tanpura", "brightness", 6.0);
    var jivari = getLayerParam("tanpura", "jivari", 0.5);

    // --- Body: a warm additive harmonic stack with a SOFT attack and long
    //     decay. Deliberately NOT Karplus-Strong — the KS pluck's broadband
    //     transient reads as a harpsichord. This rounded harmonic body reads as
    //     a sustained plucked drone string instead. A gentle lowpass settles the
    //     timbre as it rings out. ---
    var partials = [
      { mult: 1, amp: 0.12,  type: "triangle" },
      { mult: 2, amp: 0.06,  type: "sine" },
      { mult: 3, amp: 0.035, type: "sine" },
      { mult: 4, amp: 0.02,  type: "sine" },
    ];
    var lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(freq * 6, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2.5, 200), t + decay * 0.8);
    lp.Q.setValueAtTime(0.4, t);
    var body = c.createGain();
    lp.connect(body); body.connect(out);
    body.gain.setValueAtTime(0.0001, t);
    body.gain.exponentialRampToValueAtTime(gainMult, t + 0.03);   // soft (non-percussive) attack
    body.gain.exponentialRampToValueAtTime(0.04 * gainMult, t + decay * 0.7);
    body.gain.linearRampToValueAtTime(0, t + decay);
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var o = c.createOscillator();
      o.type = p.type;
      o.frequency.setValueAtTime(freq * p.mult, t);
      var g = c.createGain();
      g.gain.setValueAtTime(p.amp, t);
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + decay + 0.05);
    }

    // --- Jivari shimmer: the tanpura's signature buzzing overtone bloom — a
    //     bright sawtooth through a slowly-sweeping bandpass. It SWELLS IN after
    //     the pluck (the string settling on the bridge thread — the "juuu"),
    //     then rings out. With the KS body gone, this carries the character. ---
    if (jivari > 0.001) {
      var so = c.createOscillator();
      so.type = "sawtooth";
      so.frequency.setValueAtTime(freq, t);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(freq * bright, t);
      bp.Q.setValueAtTime(5, t);
      var lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.5 + Math.random() * 0.8, t);
      var lfoG = c.createGain();
      lfoG.gain.setValueAtTime(freq * 3, t);
      lfo.connect(lfoG); lfoG.connect(bp.frequency);
      var sg = c.createGain();
      so.connect(bp); bp.connect(sg); sg.connect(out);
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(0.06 * jivari * gainMult, t + 0.18);   // bloom in
      sg.gain.exponentialRampToValueAtTime(0.01 * jivari * gainMult, t + decay * 0.6);
      sg.gain.linearRampToValueAtTime(0, t + decay);
      so.start(t); so.stop(t + decay + 0.05);
      lfo.start(t); lfo.stop(t + decay + 0.05);
    }
  }

  // ==========================================================================
  // PAD — continuous detuned synth drone (the futuristic glow)
  // ==========================================================================
  // Overlapping ~25s segments of detuned sawtooth pairs on Sa (two octaves) and
  // Ma, through a slowly-moving lowpass — a warm digital pad beneath the
  // tanpura. Cycles like Prospero's Eno-style drone so it can evolve and never
  // clicks.
  function padCycle() {
    if (!playing) return;
    var c = ctx, now = c.currentTime;
    var out = lg("pad");
    var cutoff = getLayerParam("pad", "cutoff", 340);
    var detune = getLayerParam("pad", "detune", 9);
    var movement = getLayerParam("pad", "movement", 0.18);
    var sub = getLayerParam("pad", "sub", 0.45);
    var dur = 22 + Math.random() * 8, fadeIn = 6, fadeOut = 7;

    // Shared lowpass with a slow movement LFO on its cutoff.
    var lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(cutoff, now);
    lp.Q.setValueAtTime(0.7, now);
    var mlfo = c.createOscillator();
    mlfo.type = "sine";
    mlfo.frequency.setValueAtTime(0.03 + Math.random() * 0.04, now);
    var mg = c.createGain();
    mg.gain.setValueAtTime(cutoff * movement, now);
    mlfo.connect(mg); mg.connect(lp.frequency);
    mlfo.start(now); mlfo.stop(now + dur + 0.3);

    // Fade bus.
    var bus = c.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + fadeIn);
    bus.gain.setValueAtTime(1, now + dur - fadeOut);
    bus.gain.linearRampToValueAtTime(0, now + dur);
    lp.connect(bus); bus.connect(out);

    // Detuned sawtooth pairs on Sa (low + mid) and Ma.
    var notes = [swaraFreq("S", -1), swaraFreq("S", 0), swaraFreq("M", 0)];
    for (var k = 0; k < notes.length; k++) {
      addPadVoice(notes[k],  detune, 0.045, lp, now, dur);
      addPadVoice(notes[k], -detune, 0.045, lp, now, dur);
    }
    // Sub-octave sine for weight.
    if (sub > 0.001) {
      var so = c.createOscillator();
      var sgn = c.createGain();
      so.type = "sine";
      so.frequency.setValueAtTime(swaraFreq("S", -2), now);
      so.connect(sgn); sgn.connect(lp);
      sgn.gain.setValueAtTime(0.06 * sub, now);
      so.start(now); so.stop(now + dur + 0.3);
    }

    var overlap = 6 + Math.random() * 3;
    scheduleLayer(padCycle, (dur - overlap) * 1000, "pad");
  }
  function addPadVoice(freq, detuneCents, amp, dest, now, dur) {
    var c = ctx;
    var o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, now);
    o.detune.setValueAtTime(detuneCents, now);
    var g = c.createGain();
    o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(amp, now);
    o.start(now); o.stop(now + dur + 0.3);
  }

  // ==========================================================================
  // PERFORMANCE ARC — the long-form alap development
  // ==========================================================================
  // A slow global "intensity" envelope (0 = contemplative low alap, 1 = peak)
  // that climbs over minutes then relaxes, the way an alap unfolds: the focus
  // register rises mandra → madhya → taar, phrases grow longer, denser, faster
  // and more ornamented, then settle back down. The drones stay constant — the
  // foundation. Derived from elapsed play time so it's deterministic/resumable;
  // a coprime modulation keeps successive cycles from being identical.
  var ARC_PERIOD = 360;                 // seconds for one develop→relax cycle (~6 min)
  var arcStartTime = 0;
  function getArc() {
    if (!ctx || !playing) return 0;
    var el = ctx.currentTime - arcStartTime;
    var ph = ((el / ARC_PERIOD) % 1 + 1) % 1;
    var base;
    if (ph < 0.7) { var x = ph / 0.7; base = x * x * (3 - 2 * x); }        // smoothstep rise (70%)
    else { var y = (ph - 0.7) / 0.3; base = 1 - y * y * (3 - 2 * y); }     // smoothstep fall (30%)
    var vary = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(2 * Math.PI * el / 257));
    var a = base * vary;
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }
  function arcInfo() {
    if (!ctx || !playing) return { level: 0, register: "—", stage: "idle" };
    var lvl = getArc();
    var el = ctx.currentTime - arcStartTime;
    var ph = ((el / ARC_PERIOD) % 1 + 1) % 1;
    return {
      level: lvl,
      register: lvl < 0.34 ? "mandra" : lvl < 0.67 ? "madhya" : "taar",
      stage: ph < 0.7 ? "developing" : "relaxing",
    };
  }

  // ==========================================================================
  // LEAD — neo-sitar alap voice (the improvising melodic line)
  // ==========================================================================
  // The heart of the engine: free-rhythm Malkauns improvisation over the drone.
  // A biased random walk through the raga's notes, gravitating to the vadi (Ma)
  // and samvadi (Sa) and resting on nyas tones, interleaved with recalled
  // signature phrases (pakad). Ornamented with meend (glides) and andolan
  // (gentle oscillation). Voiced by a subtractive synth pluck — NOT Karplus-
  // Strong — so it reads as a bright plucked lead, not a harpsichord.

  // Scale laid out across registers (mandra -1 → taar +1, plus the top Sa),
  // ascending. Each entry knows its swara so we can bias toward important notes.
  var SCALE = (function () {
    var arr = [];
    var order = ["S", "g", "M", "d", "n"];
    [-1, 0, 1].forEach(function (oct) {
      order.forEach(function (sw) { arr.push({ sw: sw, oct: oct, freq: swaraFreq(sw, oct) }); });
    });
    arr.push({ sw: "S", oct: 2, freq: swaraFreq("S", 2) });
    return arr;
  })();
  var IMPORTANT = { S: true, M: true };                 // vadi (M) + samvadi (S)
  var REST_TONES = { S: true, M: true, g: true };       // nyas (cadence) swaras
  function scaleIndexOf(sw, oct) {
    for (var i = 0; i < SCALE.length; i++) if (SCALE[i].sw === sw && SCALE[i].oct === oct) return i;
    return 5; // middle Sa fallback
  }
  function nearestFlag(idx, flags) {                    // search ±2 for a flagged swara
    for (var r = 0; r <= 2; r++) {
      if (SCALE[idx + r] && flags[SCALE[idx + r].sw]) return idx + r;
      if (SCALE[idx - r] && flags[SCALE[idx - r].sw]) return idx - r;
    }
    return idx;
  }
  function nearestScaleIndex(freq) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < SCALE.length; i++) {
      var d = Math.abs(Math.log2(SCALE[i].freq / freq));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // The raga note `delta` scale-steps from `freq` (clamped to range). Used by
  // the ornaments to find authentic upper/lower neighbors.
  function scaleStep(freq, delta) {
    var j = nearestScaleIndex(freq) + delta;
    if (j < 0) j = 0; else if (j >= SCALE.length) j = SCALE.length - 1;
    return SCALE[j].freq;
  }

  // Pakad — Malkauns signature phrases (swara + octave). These are what make it
  // identifiably Malkauns rather than a generic pentatonic. Seeded into memory
  // and recalled (verbatim / octave-shifted / time-stretched) alongside fresh
  // improvisation.
  var PAKAD = [
    [["n", -1], ["d", -1], ["S", 0]],                                   // n. d. S
    [["S", 0], ["g", 0], ["M", 0]],                                     // S g M
    [["M", 0], ["g", 0], ["S", 0]],                                     // M g S
    [["g", 0], ["M", 0], ["d", 0]],                                     // g M d
    [["M", 0], ["d", 0], ["n", 0], ["d", 0], ["M", 0], ["g", 0], ["S", 0]], // M d n d M g S
    [["n", -1], ["S", 0], ["g", 0], ["S", 0]],                          // n. S g S
    [["d", 0], ["n", 0], ["d", 0], ["M", 0]],                           // d n d M
  ];
  function pakadToNotes(tokens) {
    return tokens.map(function (tok, i) {
      return { freq: swaraFreq(tok[0], tok[1]), dur: (i === tokens.length - 1 ? 1.5 : 0.7),
               glide: i > 0, gain: 1 };
    });
  }
  var leadMemory = [];                                   // note-array phrases (pakad + remembered)

  // Generation state.
  var leadIdx = 5, leadCenter = 5, leadDir = 1, leadTier = "", lastRecallTag = "verbatim";

  function pickStep(arc) {
    arc = arc || 0;
    var r = Math.random();
    return r < 0.6 - arc * 0.16 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 4;   // wider leaps as it develops
  }
  function phraseLen(arc) {
    var lens = [3, 3, 4, 4, 5, 5, 6, 7];
    return lens[Math.floor(Math.random() * lens.length)] + Math.floor((arc || 0) * 2);
  }
  function noteDur(i, len) {
    if (Math.random() < 0.16) return 1.0 + Math.random() * 0.9;   // occasional held note
    return 0.42 + Math.random() * 0.6;
  }

  // A freshly improvised phrase: biased walk, ending on a rest tone (nyas).
  // The arc widens the exploration window, lengthens phrases, and loosens the
  // steps as the development intensifies. (The focus register itself is steered
  // by the arc in leadPhrase.)
  function freshPhrase() {
    var arc = getArc();
    var len = phraseLen(arc), windowR = 7 + Math.round(arc * 3), notes = [];
    if (Math.random() < 0.4) leadDir = -leadDir;
    for (var i = 0; i < len; i++) {
      leadIdx += leadDir * pickStep(arc);
      if (leadIdx < leadCenter - windowR) { leadIdx = leadCenter - windowR; leadDir = 1; }
      if (leadIdx > leadCenter + windowR) { leadIdx = leadCenter + windowR; leadDir = -1; }
      if (leadIdx < 0) leadIdx = 0;
      if (leadIdx >= SCALE.length) leadIdx = SCALE.length - 1;
      if (Math.random() < 0.35) leadIdx = nearestFlag(leadIdx, IMPORTANT);   // pull to vadi/samvadi
      var sc = SCALE[leadIdx];
      notes.push({ freq: sc.freq, dur: noteDur(i, len), glide: true, gain: 1 });
    }
    // Cadence on a rest tone (nyas), held.
    leadIdx = nearestFlag(leadIdx, REST_TONES);
    notes.push({ freq: SCALE[leadIdx].freq, dur: 1.2 + Math.random() * 1.3, glide: true, gain: 1, hold: true });
    return notes;
  }

  // Recall a stored phrase, possibly transformed (always stays in raga).
  function recallPakad() {
    var src = leadMemory[Math.floor(Math.random() * leadMemory.length)];
    var notes = src.map(function (n) { return { freq: n.freq, dur: n.dur, glide: n.glide, gain: n.gain }; });
    var r = Math.random();
    if (r < 0.25) {                                       // octave shift
      lastRecallTag = "octave";
      var up = Math.random() < 0.5 ? 2 : 0.5;
      notes.forEach(function (n) {
        var f = n.freq * up;
        if (f >= swaraFreq("S", -1) && f <= swaraFreq("S", 2)) n.freq = f;
      });
    } else if (r < 0.5) {                                 // time stretch
      lastRecallTag = "stretch";
      var s = 1.3 + Math.random() * 0.6;
      notes.forEach(function (n) { n.dur *= s; });
    } else {
      lastRecallTag = "verbatim";
    }
    // Resync the walk to the phrase's last note so fresh material continues sensibly.
    var lastF = notes[notes.length - 1].freq, best = 5, bestD = 1e9;
    for (var i = 0; i < SCALE.length; i++) {
      var d = Math.abs(Math.log2(SCALE[i].freq / lastF));
      if (d < bestD) { bestD = d; best = i; }
    }
    leadIdx = best;
    return notes;
  }

  function startLead() {
    if (!playing) return;
    leadMemory = PAKAD.map(pakadToNotes);
    leadCenter = scaleIndexOf("S", 0);
    leadIdx = leadCenter;
    leadDir = 1;
    leadPhrase();
  }

  function leadPhrase() {
    if (!playing) return;
    var now = ctx.currentTime;
    var arc = getArc();
    var pace = getLayerParam("lead", "pace", 1.0) * (1 + arc * 0.7);          // faster as it develops
    var ornamentAmt = Math.min(1, getLayerParam("lead", "ornament", 0.5) * LEAD_ORNAMENT_TRIM + arc * 0.35);  // more animated
    var glideAmt = getLayerParam("lead", "glide", 0.55);
    var pakadProb = getLayerParam("lead", "pakad", 0.4);

    // Arc steers the focus register: mandra (low) early, climbing to taar (high)
    // at the peak — nudged a step at a time toward the arc's target.
    var targetCenter = Math.round(4 + arc * 8);
    if (leadCenter < targetCenter && Math.random() < 0.6) leadCenter++;
    else if (leadCenter > targetCenter && Math.random() < 0.6) leadCenter--;
    else if (Math.random() < 0.18) leadCenter += (Math.random() < 0.5 ? -1 : 1);
    if (leadCenter < 2) leadCenter = 2; else if (leadCenter > 13) leadCenter = 13;

    var usePakad = leadMemory.length && Math.random() < pakadProb;
    var phrase = usePakad ? recallPakad() : freshPhrase();
    emitEvent({ cat: "lead", label: usePakad ? ("pakad · " + lastRecallTag) : "fresh",
                detail: phrase.length + " notes" });
    // Announce register changes — the alap climbing mandra → madhya → taar.
    var tier = leadCenter < 5 ? "mandra" : leadCenter < 10 ? "madhya" : "taar";
    if (tier !== leadTier) { leadTier = tier; emitEvent({ cat: "arc", label: "→ " + tier }); }
    // Remember some fresh phrases too (motif memory), capped.
    if (phrase.length >= 3 && Math.random() < 0.25) {
      leadMemory.push(phrase.map(function (n) { return { freq: n.freq, dur: n.dur, glide: n.glide, gain: n.gain }; }));
      if (leadMemory.length > 18) leadMemory.splice(PAKAD.length, 1);   // keep seeded pakad
    }

    var t = now + 0.05, prevFreq = null;
    for (var i = 0; i < phrase.length; i++) {
      var note = phrase[i];
      var dur = note.dur / pace;
      var gain = note.gain || 1;
      var glideFrom = (prevFreq && note.glide && Math.random() < glideAmt) ? prevFreq : null;

      // Ornament choice — intensity scaled by the Ornament knob. Gamak (heavy
      // shake) favors longer notes; murki (light turn) any note; otherwise a
      // plain note, optionally with andolan on sustained notes.
      var r = Math.random();
      if (dur > 0.7 && r < ornamentAmt * 0.22) {
        renderGamak(note.freq, t, dur, gain);
      } else if (r < ornamentAmt * 0.30) {
        renderMurki(note.freq, t, dur, gain, glideFrom);
      } else {
        var opts = { gain: gain };
        if (glideFrom) opts.glideFrom = glideFrom;
        if (dur > 0.95 && Math.random() < ornamentAmt * 0.7) opts.andolan = true;
        leadNote(note.freq, t, dur, opts);
      }
      prevFreq = note.freq;
      t += dur + Math.random() * 0.05;
    }

    // RATE shrinks only the rest between phrases (the phrase must play out in
    // full), so rate = how often phrases fire without overlapping them.
    var phraseDur = t - now;
    var rest = (1.4 + Math.random() * 3.4) / pace / getRate("lead");
    scheduleRaw(leadPhrase, (phraseDur + rest) * 1000, "lead");
  }

  // Subtractive synth-pluck voice: saw pair → resonant lowpass with a pluck
  // sweep, fast attack into a ringing sustain, with sympathetic-string shimmer.
  // Meend (opts.glideFrom) glides pitch in; andolan adds a gentle oscillation.
  function leadNote(freq, t, dur, opts) {
    var c = ctx;
    opts = opts || {};
    var bright = getLayerParam("lead", "brightness", 8);
    var reso = getLayerParam("lead", "resonance", 5);
    var gain = opts.gain == null ? 1 : opts.gain;
    var out = panAt("lead", (Math.random() * 2 - 1) * 0.25);

    var o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = "sawtooth"; o2.type = "sawtooth";
    o2.detune.setValueAtTime(7, t);
    if (opts.glideFrom) {                                 // meend
      var gt = Math.min(dur * 0.45, 0.35);
      o1.frequency.setValueAtTime(opts.glideFrom, t);
      o1.frequency.exponentialRampToValueAtTime(freq, t + gt);
      o2.frequency.setValueAtTime(opts.glideFrom, t);
      o2.frequency.exponentialRampToValueAtTime(freq, t + gt);
    } else {
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq, t);
    }
    if (opts.andolan) {                                  // gentle pitch oscillation
      var vib = c.createOscillator(), vibG = c.createGain();
      vib.type = "sine"; vib.frequency.setValueAtTime(4.2, t);
      vibG.gain.setValueAtTime(freq * 0.007, t);
      vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
      vib.start(t); vib.stop(t + dur + 0.1);
    }
    var f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * bright, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.8, 300), t + dur * 0.8);
    f.Q.setValueAtTime(reso, t);
    var g = c.createGain();
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(out);
    var peak = 0.14 * gain;
    // Keep the attack/decay/hold anchors strictly inside the note. Short
    // ornament notes (murki ~0.1s, gamak ~0.19s) were shorter than the fixed
    // 0.18s decay anchor, so the release ramp landed first and the next ramp
    // climbed exponentially up from ~0 → a broadband click. Clamping fixes it.
    var decA = Math.min(0.18, dur * 0.5);
    var atkA = Math.min(0.006, decA * 0.5);
    var holdT = Math.min(Math.max(0.2, dur - 0.3), dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atkA);           // pluck attack
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + decA);    // → ringing sustain
    if (holdT > decA + 0.001) g.gain.setValueAtTime(peak * 0.35, t + holdT);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o1.start(t); o1.stop(t + dur + 0.05);
    o2.start(t); o2.stop(t + dur + 0.05);

    // Sympathetic shimmer (sitar's resonating strings): a faint octave that
    // blooms and lingers slightly past the note.
    var sh = c.createOscillator(), shg = c.createGain();
    sh.type = "sine"; sh.frequency.setValueAtTime(freq * 2, t);
    sh.connect(shg); shg.connect(out);
    shg.gain.setValueAtTime(0.0001, t);
    shg.gain.exponentialRampToValueAtTime(0.018 * gain, t + 0.06);
    shg.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.1 + 0.1);
    sh.start(t); sh.stop(t + dur * 1.2 + 0.15);

    emitNote("lead", freq, t, dur);
  }

  // --- Murki: a fast, light ornamental turn — a quick flick to the upper then
  //     lower neighbor, then the main note. Delicate, occupies the note's head. ---
  function renderMurki(freq, t, dur, gain, glideFrom) {
    var up = scaleStep(freq, 1), dn = scaleStep(freq, -1);
    var gw = 0.07, seq = [up, dn], tt = t, prev = glideFrom;
    for (var i = 0; i < seq.length; i++) {
      leadNote(seq[i], tt, gw * 1.5, { gain: gain * 0.7, glideFrom: prev || undefined });
      prev = seq[i]; tt += gw;
    }
    var mainDur = Math.max(0.2, dur - (tt - t));
    leadNote(freq, tt, mainDur, { gain: gain, glideFrom: prev });
  }

  // --- Gamak: a forceful oscillation — repeated, glided swings between the note
  //     and the scale-step below, accented on the beat note. The vigorous shake
  //     that gives Hindustani phrases their weight. Settles on the note. ---
  function renderGamak(freq, t, dur, gain) {
    var lower = scaleStep(freq, -1);
    var sw = 0.16;
    var count = Math.max(3, Math.min(8, Math.round(dur / sw)));
    var tt = t, prev = null;
    for (var i = 0; i < count; i++) {
      var target = (i % 2 === 0) ? freq : lower;
      leadNote(target, tt, sw * 1.2, { gain: gain * (i % 2 === 0 ? 1 : 0.8), glideFrom: prev || undefined });
      prev = target; tt += sw;
    }
    var rem = dur - (tt - t);
    if (rem > 0.18) leadNote(freq, tt, rem, { gain: gain, glideFrom: prev });
  }

  // ==========================================================================
  // BANSURI — breathy flute (second melodic voice)
  // ==========================================================================
  // Sparse, sustained phrases high in the register that answer the lead (free
  // heterophony, like a flute/sitar jugalbandi). Smooth and vocal: sine tone +
  // breath noise + vibrato, heavy on meend (the flute's finger-slide glides).
  var bansIdx = 7, bansCenter = 7, bansDir = 1;

  function startBansuri() {
    if (!playing) return;
    bansCenter = scaleIndexOf("S", 1);          // start high — above the drone, where a flute lives
    bansIdx = bansCenter;
    bansDir = 1;
    bansuriPhrase();
  }

  function bansuriPhrase() {
    if (!playing) return;
    var now = ctx.currentTime;
    var arc = getArc();
    var pace = getLayerParam("bansuri", "pace", 1.0) * (1 + arc * 0.5);
    var glideAmt = getLayerParam("bansuri", "glide", 0.7);
    var breath = getLayerParam("bansuri", "breath", 0.5);

    // The flute stays high (above the drone, so it's audible from the start) and
    // climbs further with the development. Floored at the upper-madhya register.
    var targetC = Math.round(10 + arc * 4);
    if (bansCenter < targetC && Math.random() < 0.5) bansCenter++;
    else if (bansCenter > targetC && Math.random() < 0.5) bansCenter--;
    if (bansCenter < 8) bansCenter = 8; else if (bansCenter > 15) bansCenter = 15;

    var len = [1, 2, 2, 3, 3, 4][Math.floor(Math.random() * 6)] + Math.floor(arc * 1.5);
    var notes = [];
    if (Math.random() < 0.45) bansDir = -bansDir;
    for (var i = 0; i < len; i++) {
      bansIdx += bansDir * pickStep();
      if (bansIdx < bansCenter - 4) { bansIdx = bansCenter - 4; bansDir = 1; }
      if (bansIdx > bansCenter + 5) { bansIdx = bansCenter + 5; bansDir = -1; }
      if (bansIdx < 0) bansIdx = 0;
      if (bansIdx >= SCALE.length) bansIdx = SCALE.length - 1;
      if (Math.random() < 0.4) bansIdx = nearestFlag(bansIdx, IMPORTANT);
      notes.push({ freq: SCALE[bansIdx].freq, dur: 0.9 + Math.random() * 1.6, glide: true });
    }
    bansIdx = nearestFlag(bansIdx, REST_TONES);
    notes.push({ freq: SCALE[bansIdx].freq, dur: 1.8 + Math.random() * 1.8, glide: true, hold: true });

    var t = now + 0.05, prev = null;
    for (var k = 0; k < notes.length; k++) {
      var n = notes[k];
      var dur = n.dur / pace;
      var opts = { breath: breath };
      if (prev && n.glide && Math.random() < glideAmt) opts.glideFrom = prev;
      if (dur > 1.3) opts.vibrato = true;
      bansuriNote(n.freq, t, dur, opts);
      prev = n.freq;
      t += dur + Math.random() * 0.08;
    }
    emitEvent({ cat: "bansuri", label: "phrase", detail: notes.length + " notes" });
    var rest = (3 + Math.random() * 6) / pace / getRate("bansuri");   // RATE shrinks the gap
    scheduleRaw(bansuriPhrase, (t - now + rest) * 1000, "bansuri");
  }

  function bansuriNote(freq, t, dur, opts) {
    var c = ctx;
    opts = opts || {};
    var out = panAt("bansuri", (Math.random() * 2 - 1) * 0.3);

    var o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "sine"; o2.type = "sine";
    if (opts.glideFrom) {                                 // meend
      var gt = Math.min(dur * 0.5, 0.45);
      o.frequency.setValueAtTime(opts.glideFrom, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + gt);
      o2.frequency.setValueAtTime(opts.glideFrom * 2, t);
      o2.frequency.exponentialRampToValueAtTime(freq * 2, t + gt);
    } else {
      o.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 2, t);
    }
    if (opts.vibrato) {
      var vib = c.createOscillator(), vibG = c.createGain();
      vib.type = "sine"; vib.frequency.setValueAtTime(5.2, t);
      vibG.gain.setValueAtTime(freq * 0.008, t);
      vib.connect(vibG); vibG.connect(o.frequency);
      vib.start(t); vib.stop(t + dur + 0.1);
    }
    var g = c.createGain(), g2 = c.createGain();
    o.connect(g); g.connect(out);
    o2.connect(g2); g2.connect(out);
    var peak = 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.08);          // soft flute attack
    g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(peak * 0.22, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
    o2.start(t); o2.stop(t + dur + 0.05);

    // Breath noise: bandpass-filtered air around the pitch.
    var breath = opts.breath == null ? 0.5 : opts.breath;
    if (breath > 0.01 && sharedNoiseBuf) {
      var nz = c.createBufferSource();
      nz.buffer = sharedNoiseBuf; nz.loop = true;
      var bpf = c.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.setValueAtTime(freq * 2.5, t);
      bpf.Q.setValueAtTime(1.8, t);
      var ng = c.createGain();
      nz.connect(bpf); bpf.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.02 * breath, t + 0.08);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      nz.start(t, Math.random() * 20); nz.stop(t + dur + 0.1);
    }
    emitNote("bansuri", freq, t, dur);
  }

  // ==========================================================================
  // SANTOOR — hammered-dulcimer shimmer (cosmic texture)
  // ==========================================================================
  // Sparse, high, metallic pings — single drops or quick tremolo-ish runs —
  // with inharmonic partials and a shimmer tail, drifting through the long
  // reverb. The futuristic sparkle dusted over the raga.
  var santIdx = 10;

  function startSantoor() {
    if (!playing) return;
    santIdx = scaleIndexOf("S", 1);
    santoorEvent();
  }

  function santoorEvent() {
    if (!playing) return;
    var now = ctx.currentTime;
    var shimmer = getLayerParam("santoor", "shimmer", 0.5);
    var spread = getLayerParam("santoor", "spread", 0.55);
    var lowIdx = scaleIndexOf("M", 0);
    var arc = getArc();

    var run = Math.random() < (0.4 + arc * 0.4) ? (2 + Math.floor(Math.random() * 3)) : 1;
    var t = now + 0.05;
    for (var i = 0; i < run; i++) {
      santIdx += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2));
      if (santIdx < lowIdx) santIdx = lowIdx;
      if (santIdx >= SCALE.length) santIdx = SCALE.length - 1;
      santoorNote(SCALE[santIdx].freq, t, shimmer, spread);
      t += 0.09 + Math.random() * 0.13;                  // quick run
    }
    emitEvent({ cat: "santoor", label: "shimmer", detail: run > 1 ? run + " notes" : "ping" });
    var rest = (5 + Math.random() * 10) * (1 - arc * 0.45);   // denser sparkle at the peak
    scheduleLayer(santoorEvent, rest * 1000, "santoor");
  }

  function santoorNote(freq, t, shimmer, spread) {
    var c = ctx;
    var out = panAt("santoor", (Math.random() * 2 - 1) * spread);
    var partials = [{ m: 1, a: 0.06, d: 1.8 }, { m: 2.01, a: 0.03, d: 1.3 }, { m: 3.02, a: 0.015, d: 0.9 }];
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq * p.m, t);
      var g = c.createGain();
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p.a, t + 0.004);          // struck attack
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);         // metallic ring-out
      o.start(t); o.stop(t + p.d + 0.05);
    }
    if (shimmer > 0.01) {                                // faint octave shimmer tail
      var so = c.createOscillator();
      so.type = "sine";
      so.frequency.setValueAtTime(freq * 2, t);
      var sg = c.createGain();
      so.connect(sg); sg.connect(out);
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(0.02 * shimmer, t + 0.06);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      so.start(t); so.stop(t + 2.7);
    }
    emitNote("santoor", freq, t);
  }

  // ==========================================================================
  // AMBIENT — quirky events (a Hindu starship adrift in the far future)
  // ==========================================================================
  // Sparse, characterful one-shots from a weighted pool: temple bells and conch
  // and swarmandal sweeps; console chirps, telemetry, and thruster hum. All
  // pitched to the raga's swaras so they sit harmonically over the drone — the
  // futuristic-Indian flavor dusted in, like Prospero's ambient pools.

  function ambSwarmandal(t) {                 // a quick harp sweep up the raga (swarmandal)
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.5);
    var seq = [["S", 0], ["g", 0], ["M", 0], ["d", 0], ["n", 0], ["S", 1], ["g", 1]];
    var step = 0.08 + Math.random() * 0.05;
    for (var i = 0; i < seq.length; i++) {
      var f = swaraFreq(seq[i][0], seq[i][1]), tt = t + i * step;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(f, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.05, tt + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.7);
      o.start(tt); o.stop(tt + 0.75);
    }
  }

  function ambTempleBell(t) {                 // deep mandir bell, inharmonic, long shimmer
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.3);
    var base = Math.random() < 0.5 ? swaraFreq("S", -1) : swaraFreq("M", -1);
    var partials = [{ m: 1, a: 0.07, d: 5 }, { m: 2.76, a: 0.04, d: 3.5 }, { m: 5.4, a: 0.02, d: 2.2 }, { m: 8.2, a: 0.012, d: 1.4 }];
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * p.m, t);
      o.detune.setValueAtTime((Math.random() * 2 - 1) * 4, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p.a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      o.start(t); o.stop(t + p.d + 0.1);
    }
  }

  function ambSingingBowl(t) {                // struck bowl, slow swell + beating shimmer
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.25);
    var base = swaraFreq("S", 0);
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * (i === 0 ? 1 : 2.01), t);
      o.detune.setValueAtTime(i === 0 ? -6 : 7, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      o.start(t); o.stop(t + 4.6);
    }
  }

  function ambOmSwell(t) {                    // a cosmic "Om" — vowel-formant swell on Sa
    var out = panAt("ambient", 0);
    var f = swaraFreq("S", 0);
    var saw = ctx.createOscillator();
    saw.type = "sawtooth"; saw.frequency.setValueAtTime(f, t);
    var vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.type = "sine"; vib.frequency.setValueAtTime(4.5, t); vibG.gain.setValueAtTime(f * 0.005, t);
    vib.connect(vibG); vibG.connect(saw.frequency); vib.start(t); vib.stop(t + 4);
    var amp = ctx.createGain(); amp.connect(out);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.06, t + 1.2);
    amp.gain.setValueAtTime(0.06, t + 2.2);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    [[500, 6], [800, 8]].forEach(function (F) {          // "oh/om" vowel formants
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.setValueAtTime(F[0], t); bp.Q.setValueAtTime(F[1], t);
      saw.connect(bp); bp.connect(amp);
    });
    saw.start(t); saw.stop(t + 4);
  }

  function ambConsoleChirp(t) {               // friendly ship-AI blip, gliding between swaras
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.6);
    var blips = 1 + Math.floor(Math.random() * 2), tt = t;
    for (var b = 0; b < blips; b++) {
      var f1 = SCALE[8 + Math.floor(Math.random() * 5)].freq;
      var f2 = SCALE[8 + Math.floor(Math.random() * 6)].freq;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f1, tt);
      o.frequency.exponentialRampToValueAtTime(f2, tt + 0.18);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.04, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.28);
      o.start(tt); o.stop(tt + 0.3);
      tt += 0.22 + Math.random() * 0.12;
    }
  }

  function ambConch(t) {                      // shankh — a breathy horn tone on Sa
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.2);
    var f = swaraFreq("S", 0);
    var o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f * 0.996, t);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 4, t); lp.Q.setValueAtTime(2, t);
    var g = ctx.createGain();
    o.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.25);
    g.gain.setValueAtTime(0.05, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.start(t); o.stop(t + 1.9);
    if (sharedNoiseBuf) {
      var nz = ctx.createBufferSource(); nz.buffer = sharedNoiseBuf; nz.loop = true;
      var bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass"; bpf.frequency.setValueAtTime(f * 3, t); bpf.Q.setValueAtTime(1.5, t);
      var ng = ctx.createGain(); nz.connect(bpf); bpf.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.02, t + 0.3);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      nz.start(t, Math.random() * 20); nz.stop(t + 1.9);
    }
  }

  function ambDataShimmer(t) {                // telemetry — a fast burst of tiny pitched blips
    var out = panAt("ambient", (Math.random() * 2 - 1) * 0.7);
    var n = 5 + Math.floor(Math.random() * 5), tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, 10 + Math.floor(Math.random() * 6));
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.setValueAtTime(SCALE[idx].freq, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.012, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
      o.start(tt); o.stop(tt + 0.09);
      tt += 0.05 + Math.random() * 0.06;
    }
  }

  function ambDeepThruster(t) {               // the ship's low hum — filtered-noise swell + Sa sub
    if (!sharedNoiseBuf) return;
    var out = panAt("ambient", 0);
    var nz = ctx.createBufferSource(); nz.buffer = sharedNoiseBuf; nz.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(110, t); lp.Q.setValueAtTime(3, t);
    var g = ctx.createGain(); nz.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    nz.start(t, Math.random() * 10); nz.stop(t + 4.6);
    var o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(swaraFreq("S", -2), t);
    o.connect(og); og.connect(out);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.03, t + 1.5);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    o.start(t); o.stop(t + 4.6);
  }

  var AMBIENT_POOL = [
    { fn: ambSwarmandal,   w: 1.5, name: "Swarmandal sweep" },
    { fn: ambTempleBell,   w: 4,   name: "Temple bell" },
    { fn: ambConsoleChirp, w: 4,   name: "Console chirp" },
    { fn: ambDataShimmer,  w: 4,   name: "Telemetry" },
    { fn: ambSingingBowl,  w: 2,   name: "Singing bowl" },
    { fn: ambOmSwell,      w: 2,   name: "Om swell" },
    { fn: ambConch,        w: 2,   name: "Conch" },
    { fn: ambDeepThruster, w: 2,   name: "Deep thruster" },
  ];

  function startAmbient() { if (playing) ambientEvent(); }
  function ambientEvent() {
    if (!playing) return;
    var now = ctx.currentTime;
    var total = 0, i;
    for (i = 0; i < AMBIENT_POOL.length; i++) total += AMBIENT_POOL[i].w;
    var r = Math.random() * total, entry = AMBIENT_POOL[0];
    for (i = 0; i < AMBIENT_POOL.length; i++) { r -= AMBIENT_POOL[i].w; if (r <= 0) { entry = AMBIENT_POOL[i]; break; } }
    try { entry.fn(now + 0.05); } catch (e) {}
    emitEvent({ cat: "ambient", label: entry.name });
    var gap = (14 + Math.random() * 26) * (1 - getArc() * 0.3);   // a touch denser at the peak
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
    arcStartTime = ctx.currentTime;       // the development begins anew each play
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    for (var i = 0; i < LAYERS.length; i++) applyLayerGain(LAYERS[i]);
    tanpuraCycle();
    padCycle();
    // Voices enter in turn, the way an alap unfolds: lead first, then the
    // bansuri answers, then santoor sparkle drifts in.
    scheduleLayer(startLead, 3500, "lead");
    scheduleLayer(startBansuri, 13000, "bansuri");
    scheduleLayer(startSantoor, 20000, "santoor");
    scheduleLayer(startAmbient, 9000, "ambient");
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearAllTimers();
    if (ctx) {
      for (var i = 0; i < LAYERS.length; i++) {
        var node = layerGains[LAYERS[i]];
        if (node) {
          node.gain.cancelScheduledValues(ctx.currentTime);
          node.gain.setValueAtTime(0, ctx.currentTime);
        }
      }
    }
  }

  // ==========================================================================
  // MIXER API
  // ==========================================================================
  function setMasterVolume(val) {
    masterVolume = Math.max(0, Math.min(1, val));
    if (ctx && masterGain && playing) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }
  }
  function setLayerVolume(layer, val) {
    if (layerVolumes[layer] == null) return;
    layerVolumes[layer] = Math.max(0, Math.min(1, val));
    if (ctx) applyLayerGain(layer);
  }
  function setLayerRate(layer, rate) {
    if (layerRate[layer] == null) return;
    layerRate[layer] = Math.max(0.05, rate);
  }
  function toggleLayer(layer) {
    if (layerMuted[layer] == null) return layerMuted[layer];
    layerMuted[layer] = !layerMuted[layer];
    if (ctx) applyLayerGain(layer);
    return layerMuted[layer];
  }
  function setLayerParam(layer, key, val) {
    if (!layerParams[layer]) return;
    layerParams[layer][key] = val;
  }
  function resetLayerParams(layer) {
    if (!LAYER_PARAM_DEFAULTS[layer]) return;
    layerParams[layer] = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS[layer]));
  }

  function getState() {
    return {
      playing: playing,
      masterVolume: masterVolume,
      layerVolumes: layerVolumes,
      layerMuted: layerMuted,
      layerRate: layerRate,
    };
  }

  // ==========================================================================
  // PUBLIC SURFACE
  // ==========================================================================
  return {
    init: init,
    play: play,
    stop: stop,
    setMasterVolume: setMasterVolume,
    setLayerVolume: setLayerVolume,
    setLayerRate: setLayerRate,
    setLayerParam: setLayerParam,
    getLayerParam: getLayerParam,
    resetLayerParams: resetLayerParams,
    toggleLayer: toggleLayer,
    getState: getState,
    LAYERS: LAYERS.slice(),
    LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS,
    DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    RAGA: RAGA,
    // For a future visualization layer.
    setNoteListener: function (fn) {
      if (typeof fn === "function") noteListeners.push(fn); else noteListeners.length = 0;
    },
    setAmbientListener: function (fn) {
      if (typeof fn === "function") ambientListeners.push(fn); else ambientListeners.length = 0;
    },
    setEventListener: function (fn) {
      if (typeof fn === "function") eventListeners.push(fn); else eventListeners.length = 0;
    },
    getArc: getArc,
    getArcInfo: arcInfo,
    getAudioContext: function () { return ctx; },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    attachAnalyser: function (node) {
      if (!masterGain || !node) return false;
      try { masterGain.connect(node); return true; } catch (e) { return false; }
    },
    attachLayerAnalyser: function (layer, node) {
      if (!layerGains[layer] || !node) return false;
      try { layerGains[layer].connect(node); return true; } catch (e) { return false; }
    },
  };
})();
