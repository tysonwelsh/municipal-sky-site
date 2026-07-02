// ============================================================================
// BARDO བར་དོ — Tibetan aleatoric liturgy-engine (audio)
//
// A generative jukebox in the lineage of Prospero's Jukebox, Antariksh and
// ZANKYŌ — but Tibetan, and a different vessel entirely: a derelict
// monastery-ark adrift in the intermediate state, its ritual engine still
// performing the ceremony that would carry it through. Luminous, spacious,
// bone-dry at the edges. A meditation on impermanence, not a haunted house.
//
// Architecture (what makes this one different):
//  · The conductor is a VIRTUAL UMDZÉ — a cymbal-cadence state machine.
//    Ceremonies run GENERATION → OFFERING×n → ACTION → DISSOLUTION →
//    DEDICATION, joined by authentic cadence formulas ('bebs accelerating
//    rolls, counted gsum-brdung beats, the final damped bzhag). Form is
//    event-driven, not clock-driven.
//  · Dual pitch domain over a relative fundamental (~55-65 Hz, per ceremony):
//    the HARMONIC SERIES itself (chant/dungchen/hull — spectral harmony: the
//    "chord" is which harmonics are illuminated) and just-intonation
//    anhemitonic PENTATONIC rotations (gyaling) as mode-agnostic indices.
//  · Dual motif representation — degree arrays ↔ yang-yig glide CONTOURS —
//    with a translation layer, a composable transform algebra, motif
//    identity + genealogy, a small working set (one ceremony theme + two
//    subsidiaries), and a dialogue ledger of answer-obligations.
//  · Four-activity grammar (pacify/enrich/magnetize/destroy) selects instrumentation
//    per section: peaceful = silnyen+gyaling+conch; wrathful = rolmo+kangling
//    +dungchen growl. Wrathful stays rare and ritualized — fierce compassion,
//    not metal.
//  · Everything seeded (mulberry32): a ceremony is reproducible and shareable.
//
// Layers: hull, chant, murmur, dungchen, gyaling, dungkar, kangling, umdze,
// floor, noise, ambient.   Public surface: window.BardoAudio
// ============================================================================

window.BardoAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null, masterSat = null;
  // Two spaces: the NAVE (vast dark ritual hall) and the HULL (tighter, metallic).
  var naveSend = null, naveDry = null, naveWet = null, naveConv = null, navePre = null;
  var hullSend = null, hullDry = null, hullWet = null, hullConv = null, hullPre = null;
  var gritShaper = null, gritMakeup = null, dryGritGain = null;
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // SEEDED RNG — every choice flows through rng(); ceremonies are reproducible.
  // ==========================================================================
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 108;
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
  // TUNING — relative fundamental + dual pitch domain
  // ==========================================================================
  // Each ceremony picks its own fundamental in the documented Gyuto chant zone.
  // Everything above is just-intonation ratios of it: the harmonic series for
  // the chant/horn/hull world, and a just anhemitonic pentatonic (all ratios
  // low-harmonic, so both domains always agree) for the gyaling/folk world.
  var F0 = 58;                                  // set per ceremony in planCeremony()
  var PENTA_JUST = [1, 9/8, 5/4, 3/2, 5/3];     // do re mi sol la
  var ROTATION_NAMES = ["gong", "shang", "jiao", "zhi", "yu"]; // rotation labels (mode of the penta)
  var rotation = 0;                              // current pentatonic rotation 0..4
  var PENTA_ROOT_MULT = 4;                       // penta root = F0 * 4 (~232 Hz)

  function pentaRatio(deg) {                     // deg = degree index within one octave (0..4) + rotation
    var d = ((deg % 5) + 5) % 5;
    var r = PENTA_JUST[(d + rotation) % 5] / PENTA_JUST[rotation];
    if (r < 1) r *= 2;
    return r;
  }
  function degFreq(i) {                          // i = degree index (any int); octaves fold at 5
    var oct = Math.floor(i / 5);
    return F0 * PENTA_ROOT_MULT * pentaRatio(i) * Math.pow(2, oct);
  }
  // Ascending frequency table across ~3.5 octaves (idx −5..12).
  var SCALE = [];
  function rebuildScale() {
    SCALE.length = 0;
    for (var i = -5; i <= 12; i++) SCALE.push({ deg: ((i % 5) + 5) % 5, idx: i, freq: degFreq(i) });
  }
  function scaleIndexOf(i) {
    for (var k = 0; k < SCALE.length; k++) if (SCALE[k].idx === i) return k;
    return 5;
  }
  function harm(h) { return F0 * h; }            // harmonic h of the fundamental
  // Gravity degrees: tonic (0) and sol (3). Phrases rest on 0/3/1.
  var IMPORTANT_DEG = { 0: true, 3: true };
  var REST_DEG = { 0: true, 3: true, 1: true };

  // Spectral chords — which harmonics are "illuminated" this section. Chant
  // melody targets, hull resonators, and bell tunings all read this.
  var SPECTRAL_SETS = [
    [3, 4, 5], [4, 5, 6], [4, 6, 7], [5, 6, 8], [4, 5, 8], [6, 8, 9], [5, 7, 9], [6, 8, 10]
  ];
  var spectral = [4, 5, 6];

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  var LAYERS = ["hull", "chant", "murmur", "dungchen", "gyaling", "dungkar", "kangling", "umdze", "floor", "noise", "ambient"];
  var GRIT_LAYERS = { hull: true, noise: true };   // parallel grit bus (kept modest — bone-dust, not metal)
  var HULL_SPACE = { hull: true, noise: true, ambient: true };  // tighter metallic reverb; rest go to the nave
  var DRY_CLOSE = { murmur: true };                             // the guiding voice speaks close to the ear

  var layerGains = {};
  var layerVolumes = { hull: 0.55, chant: 0.85, murmur: 0.4, dungchen: 0.6, gyaling: 0.5, dungkar: 0.35, kangling: 0.5, umdze: 0.55, floor: 0.22, noise: 0.32, ambient: 0.5 };
  var layerMuted = {}; LAYERS.forEach(function (l) { layerMuted[l] = false; });
  var layerRate = {}; LAYERS.forEach(function (l) { layerRate[l] = 1; });

  var LAYER_PARAM_DEFAULTS = {
    hull:     { cutoff: 210, drive: 0.4, sub: 0.5, movement: 0.2, ring: 0.25 },
    chant:    { monks: 3, growl: 0.55, vowel: 0.5, glide: 0.6, pace: 1.0 },
    murmur:   { syllables: 0.5, openness: 0.5, presence: 0.5 },
    dungchen: { breath: 0.5, growl: 0.5, brightness: 0.45, pace: 1.0 },
    gyaling:  { reed: 0.55, trill: 0.5, pace: 1.0, glide: 0.55, shadow: 0.6 },
    dungkar:  { wah: 0.45, breath: 0.4 },
    kangling: { rasp: 0.6, instability: 0.5 },
    umdze:    { ring: 0.55, weight: 0.5 },
    floor:    { swing: 0.5, rattle: 0.55, bell: 0.55 },
    noise:    { density: 0.35, color: 0.5, dust: 0.55 },
    ambient:  {},
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));
  // floor 0.5: the damaru/bell floor should be felt more than heard — half the
  // event density while its RATE slider still reads a clean 1.00x.
  var LAYER_RATE_TRIM = { floor: 0.5 };
  var LAYER_VOL_TRIM = { chant: 1.1 };

  var NAVE_REVERB = { decay: 8.0, preDelay: 70, wet: 0.36, hfDamp: 1.2 };  // vast dark ritual hall
  var HULL_REVERB = { decay: 3.2, preDelay: 25, wet: 0.28 };               // close resonant metal

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
    ev.t = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT — signal chain
  //   layers → layerGain → (grit layers → gritShaper → gritMakeup(0.4)) →
  //   naveSend or hullSend → dry + (preDelay→convolver→wet) → master →
  //   masterSat(gentle tanh) → compressor → out.
  //   dryGritGain: parallel close/dry grit path opened by wrathful intensity.
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
    compressorNode.threshold.setValueAtTime(-18, ctx.currentTime);
    compressorNode.knee.setValueAtTime(16, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(3, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.015, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.25, ctx.currentTime);
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.15) / Math.tanh(1.15); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    compressorNode.connect(ctx.destination);

    var effectsReady = false;
    try {
      naveSend = ctx.createGain(); naveDry = ctx.createGain(); naveWet = ctx.createGain();
      naveConv = ctx.createConvolver(); navePre = ctx.createDelay(0.25);
      naveSend.connect(naveDry); naveSend.connect(navePre); navePre.connect(naveConv); naveConv.connect(naveWet);
      naveDry.connect(masterGain); naveWet.connect(masterGain);
      buildIR(naveConv, navePre, naveWet, NAVE_REVERB, true);

      hullSend = ctx.createGain(); hullDry = ctx.createGain(); hullWet = ctx.createGain();
      hullConv = ctx.createConvolver(); hullPre = ctx.createDelay(0.25);
      hullSend.connect(hullDry); hullSend.connect(hullPre); hullPre.connect(hullConv); hullConv.connect(hullWet);
      hullDry.connect(masterGain); hullWet.connect(masterGain);
      buildIR(hullConv, hullPre, hullWet, HULL_REVERB, false);

      // Grit bus. LESSON (hard-won in ZANKYŌ): a grit waveshaper has huge
      // small-signal makeup gain and will rail the bus, stealing all master
      // headroom so every onset clicks. Always attenuate AFTER the shaper.
      gritShaper = ctx.createWaveShaper();
      gritShaper.curve = buildGritCurve(0.3);
      gritShaper.oversample = "4x";
      gritMakeup = ctx.createGain();
      // 0.15: measured — the curve's ~12x small-signal boost otherwise rails
      // the bus with the hull drone (offline render showed peak 2.17, 20k
      // clipped samples via the compressor's auto-makeup).
      gritMakeup.gain.setValueAtTime(0.15, ctx.currentTime);
      gritShaper.connect(gritMakeup);
      gritMakeup.connect(hullSend);
      dryGritGain = ctx.createGain();
      dryGritGain.gain.setValueAtTime(0, ctx.currentTime);
      gritMakeup.connect(dryGritGain);
      dryGritGain.connect(masterGain);

      effectsReady = true;
    } catch (e) {
      naveSend = ctx.createGain(); naveSend.connect(masterGain); hullSend = naveSend;
      if (window.console) console.warn("Bardo effects init failed, dry fallback:", e);
    }

    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      if (GRIT_LAYERS[layer] && effectsReady && gritShaper) node.connect(gritShaper);
      else if (DRY_CLOSE[layer] && effectsReady) {
        node.connect(masterGain);                              // intimate: mostly dry…
        var whisper = ctx.createGain();
        whisper.gain.setValueAtTime(0.3, ctx.currentTime);
        node.connect(whisper); whisper.connect(naveSend);      // …with a breath of the nave
      }
      else if (HULL_SPACE[layer] && effectsReady) node.connect(hullSend);
      else node.connect(naveSend);
      layerGains[layer] = node;
      applyLayerGain(layer);
    }
  }

  function buildIR(conv, pre, wet, R, nave) {
    var len = Math.floor(ctx.sampleRate * R.decay);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var ph1 = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate;
        var env = Math.exp(-2.2 * t / R.decay);
        var hf = Math.exp(-(R.hfDamp ? 3.8 : 2.6) * t / R.decay);
        // The nave breathes (slow swell ripple); the hull rings (metallic modes).
        var color = nave
          ? 1 + 0.08 * Math.sin(2 * Math.PI * 0.7 * t + ph1)
          : 1 + 0.12 * Math.sin(2 * Math.PI * 2200 * t + ph1) + 0.07 * Math.sin(2 * Math.PI * 4100 * t + ph2);
        data[i] = (Math.random() * 2 - 1) * env * hf * color;
      }
    }
    conv.buffer = buf;
    pre.delayTime.setValueAtTime(R.preDelay / 1000, ctx.currentTime);
    wet.gain.setValueAtTime(R.wet, ctx.currentTime);
  }

  function buildGritCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = 2 + amount * 30;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = (1 + k) * x / (1 + k * Math.abs(x));
      y += 0.03 * Math.sin(x * 7);                 // dust, not crunch
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
    n.loopStart = 0; n.loopEnd = NOISE_BUF_DURATION;
    return n;
  }
  function noiseOffset() { return rng() * 20; }
  // Click-safe gain envelope: always from true zero, linear on/off ramps.
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }

  // ==========================================================================
  // THE UMDZÉ — ceremony conductor (cymbal-cadence state machine)
  // ==========================================================================
  // A ceremony is a seeded plan of sections. Sections are unmetered inside;
  // their joints are cymbal cadence formulas scheduled on the audio clock.
  // Every layer reads C (the conductor state) when it fires.
  var SECTION_TYPES = ["generation", "offering", "action", "dissolution", "dedication"];
  var ACTIVITIES = {
    pacify:    { wrathful: 0, gyaling: true, kangling: false, cymbal: "silnyen", grit: 0.06 },
    enrich:    { wrathful: 0, gyaling: true, kangling: false, cymbal: "silnyen", grit: 0.1 },
    magnetize: { wrathful: 0.5, gyaling: true, kangling: true, cymbal: "rolmo", grit: 0.2 },
    destroy:   { wrathful: 1, gyaling: false, kangling: true, cymbal: "rolmo", grit: 0.34 },
  };
  var C = {
    ceremony: 0,
    plan: [],
    si: 0,                    // section index
    section: "generation",
    activity: "pacify",
    sectionStart: 0,
    sectionDur: 120,
    cadencing: false,
    tuttiUntil: 0,
    hushUntil: 0,
    offeringCount: 0,
  };

  function planCeremony() {
    C.ceremony++;
    // New fundamental + rotation + spectral world each ceremony.
    F0 = rnd(55, 65);
    rotation = rint(0, 4);
    rebuildScale();
    var plan = [];
    plan.push({ type: "generation", dur: rnd(95, 140), activity: "pacify" });
    var offerings = rint(2, 3);
    for (var i = 0; i < offerings; i++) {
      plan.push({
        type: "offering", dur: rnd(130, 190),
        activity: pickW([["pacify", 4], ["enrich", 3], ["magnetize", 2], ["destroy", 1]]),
      });
    }
    plan.push({ type: "action", dur: rnd(120, 165), activity: pickW([["magnetize", 3], ["destroy", 2], ["enrich", 1]]) });
    plan.push({ type: "dissolution", dur: rnd(100, 145), activity: "pacify" });
    plan.push({ type: "dedication", dur: rnd(24, 40), activity: "pacify" });
    C.plan = plan;
    C.si = 0;
    C.offeringCount = offerings;
    enterSection(0);
    Motif.newCeremony();
    emitEvent({ cat: "ceremony", label: "☸ ceremony " + C.ceremony, detail: "F0 " + F0.toFixed(1) + " Hz · rotation " + ROTATION_NAMES[rotation] + " · " + offerings + " offerings" });
  }

  function enterSection(i) {
    var s = C.plan[i];
    C.si = i;
    C.section = s.type;
    C.activity = s.activity;
    C.sectionStart = ctx ? ctx.currentTime : 0;
    C.sectionDur = s.dur;
    C.cadencing = false;
    C.tuttiUntil = 0;
    C.tuttiFired = false;
    // Illuminate a new spectral chord — brighter/denser sets later in the arc.
    var bias = i / Math.max(1, C.plan.length - 1);
    var idx = Math.min(SPECTRAL_SETS.length - 1, Math.floor(bias * (SPECTRAL_SETS.length - 2) + rng() * 2.4));
    spectral = SPECTRAL_SETS[idx].slice();
    emitEvent({ cat: "section", label: "§ " + s.type.toUpperCase(), detail: s.activity + " · harmonics " + spectral.join("·") + " · " + Math.round(s.dur) + "s" });
    Motif.onSection(s.type);
  }

  // Local position 0..1 within the current section.
  function localArc() {
    if (!ctx) return 0;
    return Math.max(0, Math.min(1, (ctx.currentTime - C.sectionStart) / C.sectionDur));
  }
  // Global intensity 0..1 — the master expression parameter, shaped per section.
  function intensity() {
    var x = localArc();
    switch (C.section) {
      case "generation": return 0.05 + 0.25 * x * x;
      case "offering": {
        // terraced: rise to a shoulder, tutti near the top, settle slightly
        var base = 0.25 + 0.45 * (x < 0.75 ? smooth(x / 0.75) : 1 - 0.2 * smooth((x - 0.75) / 0.25));
        if (ctx && ctx.currentTime < C.tuttiUntil) base += 0.18;
        return Math.min(1, base);
      }
      case "action": return 0.55 + 0.45 * smooth(x);
      case "dissolution": return 0.65 * Math.pow(1 - x, 1.5);
      case "dedication": return 0.03;
    }
    return 0.3;
  }
  function smooth(z) { z = Math.max(0, Math.min(1, z)); return z * z * (3 - 2 * z); }
  function isWrathful() { return ACTIVITIES[C.activity].wrathful > 0 && (C.section === "action" || C.section === "offering"); }
  function inHush() { return ctx && ctx.currentTime < C.hushUntil; }
  function inTutti() { return ctx && ctx.currentTime < C.tuttiUntil; }

  // --- conductor poll: advances sections, fires tuttis, drives the grit mix ---
  function conductorTick() {
    if (!playing) return;
    var x = localArc();
    // Offering tutti: near the local peak, the winds blaze together once.
    if (C.section === "offering" && !C.tuttiFired && x > 0.62 && x < 0.8) {
      C.tuttiFired = true;
      var tuttiDur = rnd(14, 22);
      C.tuttiUntil = ctx.currentTime + tuttiDur;
      emitEvent({ cat: "conductor", label: "✦ tutti", detail: C.activity + " · " + Math.round(tuttiDur) + "s" });
      // after the tutti: the stop — a held hush with a lone bell in the ma
      scheduleRaw(function () { hushMa(); }, tuttiDur * 1000);
    }
    // Section end → cadence → advance.
    if (!C.cadencing && x >= 1) {
      C.cadencing = true;
      var last = C.si >= C.plan.length - 1;
      var cadType = last ? "bzhag" : (C.plan[C.si + 1].type === "action" ? "bebs-ring" : (C.section === "generation" ? "counted" : "bebs"));
      var cadDur = runCadence(cadType);
      scheduleRaw(function () {
        if (C.si >= C.plan.length - 1) planCeremony();
        else enterSection(C.si + 1);
      }, (cadDur + 0.4) * 1000);
    }
    // Wrathful grit crossfade — modest ceiling; dust and closeness, not crunch.
    if (dryGritGain) {
      var g = ACTIVITIES[C.activity].grit * intensity();
      dryGritGain.gain.setTargetAtTime(g, ctx.currentTime, 1.2);
    }
    scheduleRaw(conductorTick, 500);
  }

  // The stop after a tutti: master dips to a hush, a lone bell rings in the ma,
  // voices breathe back in. (BARDO's tender cousin of ZANKYŌ's KIRU.)
  function hushMa() {
    if (!playing) return;
    var t = ctx.currentTime;
    var holdS = rnd(4.5, 7.5);
    C.hushUntil = t + holdS + 2;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value || masterVolume, t);
    masterGain.gain.linearRampToValueAtTime(masterVolume * 0.22, t + 0.9);
    drilbuBell(t + 1.4, 1.0);
    masterGain.gain.setValueAtTime(masterVolume * 0.22, t + 0.9 + holdS);
    masterGain.gain.linearRampToValueAtTime(masterVolume, t + 0.9 + holdS + 2.2);
    emitEvent({ cat: "conductor", label: "◦ ma", detail: "the held silence · " + holdS.toFixed(1) + "s" });
  }

  // ==========================================================================
  // CYMBAL CADENCE VOCABULARY — the umdzé's actual strokes.
  // Returns total cadence duration (s). All strokes on the audio clock.
  // ==========================================================================
  function cymbalStroke(t, opts) {
    var kind = opts.kind || ACTIVITIES[C.activity].cymbal;   // silnyen bright/thin, rolmo dark/gongy
    var open = opts.open !== false;
    var gain = (opts.gain != null ? opts.gain : 0.5) * getLayerParam("umdze", "weight", 0.5) * 2;
    var dest = panAt("umdze", opts.pan || 0);
    var ring = getLayerParam("umdze", "ring", 0.55);
    var decay = open ? (kind === "rolmo" ? rnd(2.5, 4.5) : rnd(1.6, 2.8)) * (0.5 + ring) : 0.14;
    // noise burst
    var burst = noiseSource();
    var bf = ctx.createBiquadFilter();
    bf.type = "highpass"; bf.frequency.setValueAtTime(kind === "rolmo" ? 900 : 2000, t);
    var bg = ctx.createGain();
    burst.connect(bf); bf.connect(bg); bg.connect(dest);
    env(bg, t, [[0.004, gain * 0.8], [Math.min(0.35, decay * 0.3), gain * 0.12], [decay * 0.7, 0]]);
    burst.start(t, noiseOffset()); burst.stop(t + decay + 0.1);
    // inharmonic partials
    var ratios = kind === "rolmo" ? [1, 2.32, 3.85, 5.7, 7.4] : [1, 2.9, 5.1, 7.8, 11.2];
    var base = kind === "rolmo" ? rnd(310, 360) : rnd(520, 610);
    for (var i = 0; i < ratios.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base * ratios[i] * (1 + rnd(-0.004, 0.004)), t);
      var og = ctx.createGain();
      o.connect(og); og.connect(dest);
      var pg = gain * 0.22 / (1 + i * 0.7);
      env(og, t, [[0.003, pg], [decay * (0.5 + 0.5 * rng()), 0]]);
      o.start(t); o.stop(t + decay + 0.1);
    }
    emitNote("umdze", 0, t, decay);
  }
  function ngaThump(t, heavy) {
    var dest = panAt("umdze", 0);
    var o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(rnd(88, 105), t);
    o.frequency.exponentialRampToValueAtTime(rnd(62, 72), t + 0.22);
    var og = ctx.createGain();
    o.connect(og); og.connect(dest);
    env(og, t, [[0.006, heavy ? 0.75 : 0.4], [0.35, 0]]);
    o.start(t); o.stop(t + 0.5);
    var th = noiseSource();
    var tf = ctx.createBiquadFilter(); tf.type = "lowpass"; tf.frequency.setValueAtTime(400, t);
    var tg = ctx.createGain();
    th.connect(tf); tf.connect(tg); tg.connect(dest);
    env(tg, t, [[0.004, heavy ? 0.3 : 0.16], [0.12, 0]]);
    th.start(t, noiseOffset()); th.stop(t + 0.25);
  }
  // 'bebs — a crash decaying into an accelerating, quieting roll ending in sizzle.
  function bebsRoll(t0, waves) {
    var t = t0, w;
    for (w = 0; w < waves; w++) {
      cymbalStroke(t, { gain: 0.7, open: true });
      ngaThump(t, true);
      var ioi = 0.62, amp = 0.5;
      t += 0.5;
      while (ioi > 0.045) {
        cymbalStroke(t, { gain: amp, open: false });
        if (chance(0.5)) ngaThump(t, false);
        t += ioi;
        ioi *= 0.87;
        amp *= 0.93;
      }
      t += rnd(0.8, 1.4);
    }
    return t - t0;
  }
  // Counted beats — gsum brdung: |1 2 3|1 2 3| with the count as sacred number.
  function countedBeats(t0) {
    var t = t0;
    var count = pickW([[3, 5], [4, 2], [5, 1]]);   // 3 dominates, as in the tradition
    for (var rep = 0; rep < 2; rep++) {
      for (var b = 0; b < count; b++) {
        cymbalStroke(t, { gain: b === 0 ? 0.65 : 0.4, open: b === count - 1 });
        ngaThump(t, b === 0);
        t += rnd(0.78, 0.95);
      }
      t += rnd(0.5, 0.9);
    }
    return t - t0;
  }
  // bzhag — two light strokes and one heavy damped placement; the piece is set down.
  function bzhag(t0) {
    cymbalStroke(t0, { gain: 0.3, open: false });
    cymbalStroke(t0 + 0.7, { gain: 0.3, open: false });
    cymbalStroke(t0 + 1.55, { gain: 0.85, open: false });
    ngaThump(t0 + 1.55, true);
    drilbuBell(t0 + 3.2, 0.8);
    return 6.5;
  }
  function runCadence(type) {
    var t = ctx.currentTime + 0.15;
    var dur = 2;
    if (type === "bebs") dur = bebsRoll(t, 1);
    else if (type === "bebs-ring") dur = bebsRoll(t, rint(2, 3));
    else if (type === "counted") dur = countedBeats(t);
    else if (type === "bzhag") dur = bzhag(t);
    emitEvent({ cat: "cadence", label: "⛧ " + type, detail: Math.round(dur) + "s joint" });
    return dur;
  }

  // ==========================================================================
  // MOTIF ENGINE — dual representation, transform algebra, genealogy, ledger.
  // ==========================================================================
  // A DEGREE motif: { kind:"degree", notes:[{deg (scale idx int), durBeats}] }
  // A CONTOUR motif: { kind:"contour", points:[{t 0..1, h (harmonic number)}] }
  // Both carry: { name, gen, chain[] } — identity + genealogy.
  var Motif = (function () {
    var NAMES = ["KA", "KHA", "GA"];              // ka kha ga — first letters of the Tibetan alphabet
    var working = { theme: null, subs: [] };      // the whole ceremony works ≤3 ideas
    var ledger = [];                              // [{to, motif, deadline, type, fromVoice}]
    var stats = { developments: 0, answers: 0, transformsUsed: {} };

    function freshDegreeMotif(name) {
      var len = pickW([[4, 3], [5, 4], [6, 3], [7, 2]]);
      var notes = [], d = pickW([[0, 4], [3, 3], [1, 2], [2, 1]]);
      for (var i = 0; i < len; i++) {
        notes.push({ deg: d, durBeats: pickW([[1, 5], [2, 3], [0.5, 2], [3, 1]]) });
        var step = pickW([[1, 5], [2, 3], [3, 1]]) * (chance(0.55) ? -1 : 1);
        d += step;
        if (d < -3) d += 5; if (d > 9) d -= 5;
      }
      // rest the phrase on a gravity degree, longer
      notes[notes.length - 1].deg = nearestRest(notes[notes.length - 1].deg);
      notes[notes.length - 1].durBeats = Math.max(2, notes[notes.length - 1].durBeats * 2);
      return { kind: "degree", name: name, gen: 0, chain: [], notes: notes };
    }
    // Fold a harmonic number back into the singable window by OCTAVE
    // displacement (h ↔ 2h is an octave in the series) — never flatten a
    // contour against a clamp wall.
    function foldH(h) {
      if (!isFinite(h)) return 4;
      h = Math.round(h);
      if (h < 1) h = 2 - h;                        // reflect through the fundamental — stays positive
      while (h < 3) h *= 2;
      while (h > 12) h = Math.round(h / 2);
      return h;
    }
    function freshContourMotif(name) {
      var n = rint(3, 5), pts = [];
      var pool = spectral.slice();
      var h = pick(pool);
      for (var i = 0; i < n; i++) {
        pts.push({ t: i / (n - 1), h: h });
        var neighbors = pool.filter(function (x) { return x !== h; });
        var roll = rng();
        if (roll < 0.55) h = pick(neighbors);                       // another illuminated harmonic
        else if (roll < 0.85) {                                     // ornamental passing tone toward one
          var target = pick(neighbors);
          h = foldH(h + (Math.sign(target - h) || 1));
        }
        else h = foldH(h + pickW([[-1, 2], [1, 3], [2, 1]]));       // step off the set, briefly
      }
      pts[n - 1].h = pick(spectral);               // resolve into the illuminated set
      // the lead voice deserves a real shape: ≥3 distinct harmonics when there's room
      if (n >= 4) {
        var uniq = {}; pts.forEach(function (p) { uniq[p.h] = true; });
        if (Object.keys(uniq).length < 3) pts[1].h = foldH(pts[1].h + (chance(0.5) ? 1 : -1));
      }
      return { kind: "contour", name: name, gen: 0, chain: [], points: pts };
    }
    function nearestRest(d) {
      var dd = ((d % 5) + 5) % 5;
      if (REST_DEG[dd]) return d;
      for (var off = 1; off <= 2; off++) {
        if (REST_DEG[(((d + off) % 5) + 5) % 5]) return d + off;
        if (REST_DEG[(((d - off) % 5) + 5) % 5]) return d - off;
      }
      return d;
    }

    // ---- the transform algebra (each returns a NEW motif, chain appended) ----
    function clone(m) { return JSON.parse(JSON.stringify(m)); }
    var TRANSFORMS = {
      invert: function (m) {                       // mirror around first note / first point
        if (m.kind === "degree") {
          var axis = m.notes[0].deg;
          m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        } else {
          var ax = m.points[0].h;
          m.points.forEach(function (p) { p.h = foldH(Math.round(ax - (p.h - ax))); });
        }
        return m;
      },
      transpose: function (m) {                    // interval-preserving, NOT just octaves
        var by = pickW([[1, 3], [2, 3], [-1, 3], [-2, 2], [3, 1], [5, 1], [-5, 1]]);
        if (m.kind === "degree") m.notes.forEach(function (n) { n.deg += by; });
        else {
          var s = (Math.abs(by) >= 3 ? 2 : 1) * (by < 0 ? -1 : 1);   // real shift, both directions
          m.points.forEach(function (p) { p.h = foldH(p.h + s); });
        }
        return m;
      },
      fragmentHead: function (m) {
        if (m.kind === "degree") m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2)));
        else m.points = m.points.slice(0, Math.max(2, Math.ceil(m.points.length / 2))).map(function (p, i, a) { return { t: i / Math.max(1, a.length - 1), h: p.h }; });
        return m;
      },
      fragmentTail: function (m) {
        if (m.kind === "degree") m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2)));
        else m.points = m.points.slice(-Math.max(2, Math.ceil(m.points.length / 2))).map(function (p, i, a) { return { t: i / Math.max(1, a.length - 1), h: p.h }; });
        return m;
      },
      augment: function (m) {
        var f = rnd(1.35, 1.9);
        if (m.kind === "degree") m.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * f); });
        else m.stretch = Math.min(2.4, (m.stretch || 1) * f);
        return m;
      },
      diminish: function (m) {
        var f = rnd(0.5, 0.72);
        if (m.kind === "degree") m.notes.forEach(function (n) { n.durBeats = Math.max(0.4, n.durBeats * f); });
        else m.stretch = Math.max(0.4, (m.stretch || 1) * f);
        return m;
      },
      retrograde: function (m) {
        if (m.kind === "degree") m.notes.reverse();
        else { m.points.reverse(); m.points.forEach(function (p, i, a) { p.t = i / Math.max(1, a.length - 1); }); }
        return m;
      },
      sequence: function (m) {                     // repeat the idea at a transposition — real sequencing
        if (m.kind === "degree") {
          var step = pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
          var rep = clone(m).notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
          m.notes = m.notes.concat(rep).slice(0, 12);              // runaway guard
        } else {
          var extra = clone(m).points.map(function (p) { return { h: foldH(p.h + 1), t: 0 }; });
          m.points = m.points.concat(extra).slice(0, 10);
          m.points.forEach(function (p, i, a) { p.t = i / Math.max(1, a.length - 1); });
        }
        return m;
      },
      ambitus: function (m) {                      // widen/narrow the reach (contour speciality)
        var f = chance(0.6) ? rnd(1.3, 1.8) : rnd(0.55, 0.8);
        if (m.kind === "contour") {
          var ax = m.points[0].h;
          m.points.forEach(function (p) { p.h = foldH(Math.round(ax + (p.h - ax) * f)); });
        } else {
          var axd = m.notes[0].deg;
          m.notes.forEach(function (n) { n.deg = Math.round(axd + (n.deg - axd) * f); });
        }
        return m;
      },
      ornament: function (m) {                     // yang-yig turns: neighbor passing tones between leaps
        if (m.kind === "degree") {
          var res = [];
          for (var i = 0; i < m.notes.length; i++) {
            var n = m.notes[i], nx = m.notes[i + 1];
            if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && chance(0.6)) {
              res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
              res.push({ deg: n.deg + Math.sign(nx.deg - n.deg), durBeats: Math.max(0.4, n.durBeats * 0.35) });
            } else res.push({ deg: n.deg, durBeats: n.durBeats });
          }
          m.notes = res;
        } else {
          var out = [m.points[0]];
          for (var j = 1; j < m.points.length; j++) {
            var a = m.points[j - 1].h, b = m.points[j].h;
            if (out.length + (m.points.length - j) < 9 && Math.abs(b - a) >= 2 && chance(0.7))
              out.push({ t: 0, h: foldH(Math.round((a + b) / 2)) });
            out.push(m.points[j]);
          }
          m.points = out;
          m.points.forEach(function (p, i2, arr) { p.t = i2 / Math.max(1, arr.length - 1); });
        }
        return m;
      },
    };

    // ---- chain grammar: which transform, given kind + section + chain so far ----
    // Sophistication = context-sensitivity: the same motif is worked differently
    // by the shawm and the chant, and differently in offering than in action.
    var KIND_WEIGHTS = {
      degree:  { transpose: 4, invert: 3, sequence: 2.5, fragmentHead: 2.5, fragmentTail: 2, augment: 2.5, diminish: 2, retrograde: 1.5, ambitus: 1.5, ornament: 2.5 },
      contour: { ambitus: 3.5, invert: 3, ornament: 3, retrograde: 2, fragmentHead: 2, fragmentTail: 2, augment: 2.5, diminish: 2, transpose: 1.5, sequence: 1 },
    };
    var SECTION_TILT = {
      generation:  { transpose: 1.6, augment: 1.5, ornament: 0.6, sequence: 0.4, fragmentHead: 0.5, fragmentTail: 0.5, diminish: 0.5 },
      offering:    { invert: 1.4, sequence: 1.4, ornament: 1.4, ambitus: 1.2 },
      action:      { diminish: 1.7, fragmentHead: 1.5, fragmentTail: 1.4, sequence: 1.6, retrograde: 1.2, augment: 0.5 },
      dissolution: { augment: 1.6, fragmentTail: 1.4, ornament: 0.4, sequence: 0.3, diminish: 0.4 },
    };
    var AFFINITY = {                               // pairs that compose well lean into each other
      fragmentHead: { sequence: 2.4, ornament: 1.6 },
      fragmentTail: { sequence: 2.4, ornament: 1.6 },
      invert:       { augment: 1.7, transpose: 1.5 },
      sequence:     { diminish: 1.6 },
      ornament:     { augment: 1.4 },
    };
    function motifLen(m) { return m.kind === "degree" ? m.notes.length : m.points.length; }
    function beatsOf(m) { var b = 0; if (m.kind === "degree") m.notes.forEach(function (n) { b += n.durBeats; }); return b; }
    function isPalindromic(m) {
      var s = m.kind === "degree" ? m.notes.map(function (n) { return n.deg; }) : m.points.map(function (p) { return p.h; });
      for (var i = 0; i < s.length; i++) if (s[i] !== s[s.length - 1 - i]) return false;
      return true;
    }
    function lastRealLink(chain) {
      for (var i = chain.length - 1; i >= 0; i--)
        if (chain[i] !== "translate" && chain[i] !== "dissolve" && chain[i] !== "tether") return chain[i];
      return null;
    }
    function allowedTransform(name, m, chain) {
      var len = motifLen(m);
      var last = lastRealLink(chain);
      if (name === last) return false;             // never twice running (invert∘invert is a no-op)
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;                // fragmenting a fragment leaves 2 notes of nothing
        var frags = 0;
        for (var i = 0; i < chain.length; i++) if (chain[i].indexOf("fragment") === 0) frags++;
        if (frags >= 1 && len <= 6) return false;
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false;   // no-op on palindromes
      if (name === "augment") {
        if (m.kind === "degree" && beatsOf(m) > 18) return false;
        if (m.kind === "contour" && (m.stretch || 1) > 2.2) return false;
      }
      if (name === "diminish" && m.kind === "contour" && (m.stretch || 1) < 0.5) return false;
      return true;
    }
    function pickTransform(m, chain) {
      var w = KIND_WEIGHTS[m.kind], tilt = SECTION_TILT[C.section] || {};
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
    // Keep a degree motif's centre of mass inside the shawm's window by whole
    // octaves — internal intervals untouched, so the contour survives intact.
    function recentre(m) {
      if (m.kind !== "degree" || !m.notes.length) return m;
      var sum = 0; m.notes.forEach(function (n) { sum += n.deg; });
      var mean = sum / m.notes.length;
      while (mean > 7) { m.notes.forEach(function (n) { n.deg -= 5; }); mean -= 5; }
      while (mean < 0) { m.notes.forEach(function (n) { n.deg += 5; }); mean += 5; }
      return m;
    }

    // ---- translation between domains ----
    function degreesToContour(m) {
      // map scale degrees onto nearby harmonics: the chant sings the gyaling's idea
      var pts = m.notes.map(function (n, i) {
        var ratio = degFreq(n.deg) / F0;           // fold into the singable harmonic zone
        while (ratio > 12) ratio /= 2;
        while (ratio < 3) ratio *= 2;
        return { t: i / Math.max(1, m.notes.length - 1), h: Math.round(ratio) };
      });
      // preserve the melodic shape through quantization: where two DIFFERENT
      // degrees have collapsed onto the same harmonic, lean the later point in
      // the melodic direction (only within the window — no fold jumps here)
      for (var i = 1; i < pts.length; i++) {
        var dd = m.notes[i].deg - m.notes[i - 1].deg;
        var cand = pts[i].h + (dd > 0 ? 1 : -1);
        if (dd !== 0 && pts[i].h === pts[i - 1].h && cand >= 3 && cand <= 12) pts[i].h = cand;
      }
      return { kind: "contour", name: m.name, gen: m.gen + 1, chain: m.chain.concat(["translate"]), points: pts };
    }
    function contourToDegrees(m) {
      var notes = m.points.map(function (p) {
        var f = harm(p.h) * 2;                     // lift into gyaling register
        var best = 0, bd = 1e9;
        for (var k = 0; k < SCALE.length; k++) {
          var d = Math.abs(Math.log2(SCALE[k].freq / f));
          if (d < bd) { bd = d; best = k; }
        }
        return { deg: SCALE[best].idx, durBeats: pickW([[1, 4], [2, 2], [1.5, 2]]) };
      });
      return { kind: "degree", name: m.name, gen: m.gen + 1, chain: m.chain.concat(["translate"]), notes: notes };
    }

    // ---- development policy (section-aware) ----
    // The ceremony BUILDS: lineage[] holds each idea's most-developed living
    // descendant, so development can accumulate instead of restarting from the
    // seed every phrase — while the tether keeps deep descendants recognizable.
    var lineage = {};
    var climaxReprised = false;
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
    // onto the descendant — development may wander, but the head-motive returns.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc) return m;
      // cross-domain identity: translate the ancestor into this kind if needed
      var src = anc.kind === m.kind ? anc
        : (m.kind === "contour" ? degreesToContour(anc) : contourToDegrees(anc));
      if (m.kind === "degree") {
        var k = Math.min(3, src.notes.length, Math.max(1, m.notes.length - 1));
        m.notes = clone(src).notes.slice(0, k).concat(m.notes.slice(k));
      } else {
        var kp = Math.min(2, src.points.length, m.points.length);
        for (var i = 0; i < kp; i++) m.points[i].h = src.points[i].h;
      }
      m.chain = m.chain.concat(["tether"]);
      stats.transformsUsed.tether = (stats.transformsUsed.tether || 0) + 1;
      return m;
    }
    function develop(m, maxChain) {
      // Renewal: after long development the line returns to its source —
      // identity over archaeology. (Ledger ping-pong otherwise compounds
      // generations into the twenties.)
      if (m.gen >= 9) {
        var anc = ancestorOf(m.name);
        if (anc) m = (anc.kind === m.kind) ? anc : (m.kind === "contour" ? degreesToContour(anc) : contourToDegrees(anc));
      }
      var out = clone(m);
      var links = rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(out, out.chain.concat(used));
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
      emitEvent({ cat: "motif", label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") });
      return out;
    }
    // Which motif should a voice work right now?
    function request(kind) {
      var m;
      switch (C.section) {
        case "generation":
          m = chance(0.7) ? working.theme : pick(working.subs); break;
        case "offering":
          m = pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]); break;
        case "action":
          m = chance(0.6) ? working.theme : pick(working.subs); break;   // the reprise: theme dominates
        case "dissolution":
          m = pickW([[working.theme, 4], [working.subs[0], 1]]); break;
        default:
          m = working.theme;
      }
      if (!m) m = working.theme;
      // Work the LINEAGE (what the ceremony has built) about half the time in
      // the middle sections; the tether in develop() keeps it recognizable.
      if (C.section === "offering" || C.section === "action") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && chance(0.45)) m = line;
      }
      // Match the requested domain via translation if needed.
      if (m.kind !== kind) m = (kind === "contour") ? degreesToContour(m) : contourToDegrees(m);
      // How hard to develop, by section:
      if (C.section === "generation" && m.gen === 0 && chance(0.5)) return clone(m);   // state it plainly first
      if (C.section === "action" && !climaxReprised && localArc() > 0.55) {
        // THE reprise: once per action, at the climax, the literal theme —
        // not a development of it. Unmistakable.
        climaxReprised = true;
        var th = working.theme;
        var lit = th.kind === kind ? clone(th) : (kind === "contour" ? degreesToContour(th) : contourToDegrees(th));
        emitEvent({ cat: "motif", label: "✸ reprise " + th.name, detail: "the theme returns, verbatim" });
        return lit;
      }
      if (C.section === "dissolution") {
        // dissolve what the ceremony built: the most-developed descendant
        var deep = lineage[m.name];
        var src = (deep && deep.gen > m.gen) ? clone(deep) : m;
        if (src.kind !== kind) src = (kind === "contour") ? degreesToContour(src) : contourToDegrees(src);
        return decompose(src);
      }
      return develop(m, C.section === "action" ? 3 : 2);
    }
    // Dissolution: the motif releases its notes one at a time into the drone.
    function decompose(m) {
      var out = clone(m);
      var x = localArc();                          // deeper into dissolution = fewer notes remain
      if (out.kind === "degree") {
        var keep = Math.max(1, Math.round(out.notes.length * (1 - 0.8 * x)));
        while (out.notes.length > keep) out.notes.splice(rint(1, out.notes.length - 1), 1);
        out.notes.forEach(function (n) { n.durBeats *= 1 + x; });
      } else {
        var kp = Math.max(2, Math.round(out.points.length * (1 - 0.6 * x)));
        while (out.points.length > kp) out.points.splice(rint(1, out.points.length - 2), 1);
        out.points.forEach(function (p, i, a) { p.t = i / Math.max(1, a.length - 1); });
        out.stretch = (out.stretch || 1) * (1 + x);
      }
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: "motif", label: "࿙ " + out.name + " dissolves", detail: "releasing notes into the drone" });
      return out;
    }

    // ---- dialogue ledger: real obligations between voices ----
    function post(fromVoice, toVoice, motif, type) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: ctx.currentTime + rnd(6, 16) });
      if (ledger.length > 6) ledger.shift();
    }
    function claim(voice, kind) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      }
      if (!ob) {
        // Call-and-response must be AUDIBLE: an obligation past its deadline
        // is taken up by whichever voice speaks next (never the caller itself).
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && ctx.currentTime > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) {                            // renewal applies to answers too
        var anc = ancestorOf(m.name);
        if (anc) m = clone(anc);
      }
      if (m.kind !== kind) m = (kind === "contour") ? degreesToContour(m) : contourToDegrees(m);
      var ans;
      if (ob.type === "imitate") ans = develop(m, 1);
      else if (ob.type === "invert") {
        // mirror the call — unless the call was itself a mirror (invert∘invert
        // is a no-op): then answer with the crab, or a transposition.
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(m, 2);
      stats.answers++;
      emitEvent({ cat: "motif", label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen });
      return ans;
    }
    function overdueFor(voice) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && ctx && ctx.currentTime > ledger[i].deadline) return true;
      }
      return false;
    }

    function newCeremony() {
      working.theme = freshDegreeMotif(NAMES[0]);
      working.subs = [freshContourMotif(NAMES[1]), chance(0.5) ? freshDegreeMotif(NAMES[2]) : freshContourMotif(NAMES[2])];
      ledger.length = 0;
      lineage = {};
      climaxReprised = false;
      emitEvent({ cat: "motif", label: "❁ working set", detail: "theme " + NAMES[0] + " (" + working.theme.notes.length + " notes) + " + NAMES[1] + ", " + NAMES[2] });
    }
    function onSection(type) {
      if (type === "action") climaxReprised = false;   // the reprise belongs to this section's climax
    }

    return {
      newCeremony: newCeremony, onSection: onSection,
      request: request, post: post, claim: claim, overdueFor: overdueFor,
      decompose: decompose, develop: develop,
      stats: function () { return { developments: stats.developments, answers: stats.answers, transforms: Object.keys(stats.transformsUsed), working: { theme: working.theme && working.theme.name, gens: working.theme && working.theme.gen } }; },
    };
  })();

  // ==========================================================================
  // VOICE: HULL — the ship's resonant structure. Modal resonators tuned to the
  // illuminated harmonics; ring-mod sheen for the alien edge. Grit bus.
  // ==========================================================================
  var hullResonators = null;
  function hullCycle() {
    if (!playing) return;
    var t = ctx.currentTime;
    var dur = rnd(26, 38);
    var overlap = 8;
    var inten = intensity();
    var dest = panAt("hull", 0);
    var cutoff = getLayerParam("hull", "cutoff", 210);
    var subAmt = getLayerParam("hull", "sub", 0.5);
    var move = getLayerParam("hull", "movement", 0.2);
    var ringAmt = getLayerParam("hull", "ring", 0.25);

    var master = ctx.createGain();
    // modal resonator path: saw pair → 3 high-Q bandpasses on the spectral set
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff * (0.8 + inten * 0.8), t);
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.setValueAtTime(rnd(0.02, 0.05), t);
    lfoG.gain.setValueAtTime(cutoff * move, t);
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    var mix = ctx.createGain(); mix.gain.setValueAtTime(0.55, t);
    for (var v = 0; v < 2; v++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(F0 * 2 * (1 + (v ? rnd(0.002, 0.004) : -rnd(0.002, 0.004))), t);
      o.connect(mix);
      o.start(t); o.stop(t + dur + 0.2);
    }
    mix.connect(lp); lp.connect(master);
    for (var r = 0; r < Math.min(3, spectral.length); r++) {
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(harm(spectral[r]), t);
      bp.Q.setValueAtTime(14, t);
      var bg = ctx.createGain(); bg.gain.setValueAtTime(0.5 / (r + 1), t);
      mix.connect(bp); bp.connect(bg); bg.connect(master);
    }
    if (subAmt > 0.05) {
      var sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(F0, t);
      var sg = ctx.createGain(); sg.gain.setValueAtTime(subAmt * 0.5, t);
      sub.connect(sg); sg.connect(master);
      sub.start(t); sub.stop(t + dur + 0.2);
    }
    // ring-mod sheen: AM at an inharmonic partial — the alien shimmer
    var outGain = ctx.createGain();
    master.connect(outGain); outGain.connect(dest);
    if (ringAmt > 0.03) {
      var ring = ctx.createGain(); ring.gain.setValueAtTime(0, t);
      var ro = ctx.createOscillator();
      ro.frequency.setValueAtTime(F0 * rnd(4.4, 5.1), t);      // between harmonics — not of this series
      var rg = ctx.createGain(); rg.gain.setValueAtTime(ringAmt * 0.5, t);
      ro.connect(rg); rg.connect(ring.gain);
      master.connect(ring); ring.connect(dest);
      ro.start(t); ro.stop(t + dur + 0.2);
    }
    var peak = 0.18 * (0.55 + inten * 0.55) * (C.section === "dedication" ? 0.3 : 1);
    env(outGain, t, [[overlap * 0.7, peak], [dur - overlap * 1.4, peak * 0.92], [overlap * 0.7, 0]]);
    lfo.start(t); lfo.stop(t + dur + 0.2);
    emitNote("hull", F0 * 2, t, dur);
    scheduleLayer(hullCycle, (dur - overlap) * 1000, "hull");
  }

  // ==========================================================================
  // VOICE: CHANT — the lead. One low pulse-rich source per monk, formant
  // filters; the SECOND formant is tuned to a single harmonic and swept
  // between harmonics along yang-yig contour curves. The one-voice chord.
  // ==========================================================================
  function chantPhrase() {
    if (!playing) return;
    if (C.section === "dedication" || inHush()) { scheduleRaw(chantPhrase, 4000); return; }
    var inten = intensity();
    // chant sits out sometimes in generation, always breathes between phrases
    if (C.section === "generation" && chance(0.35)) { scheduleRaw(chantPhrase, rnd(6, 12) * 1000); return; }

    var motif = Motif.overdueFor("chant") ? Motif.claim("chant", "contour") : Motif.request("contour");
    if (!motif) { scheduleRaw(chantPhrase, 5000); return; }

    var t = ctx.currentTime + 0.1;
    var pace = getLayerParam("chant", "pace", 1);
    var glideAmt = getLayerParam("chant", "glide", 0.6);
    var growl = getLayerParam("chant", "growl", 0.55);
    var monks = Math.round(getLayerParam("chant", "monks", 3));
    var stretch = (motif.stretch || 1);
    var phraseDur = rnd(11, 20) * stretch / pace * (1 - inten * 0.25);
    phraseDur = Math.max(7, Math.min(26, phraseDur));

    for (var mk = 0; mk < monks; mk++) {
      var det = mk === 0 ? 0 : rnd(-0.018, 0.018);            // ±cents spread — the loose unison
      var stagger = mk === 0 ? 0 : rnd(0.1, 0.9);
      chantMonk(t + stagger, phraseDur, motif, det, growl, glideAmt, mk, monks);
    }
    emitNote("chant", harm(motif.points[0].h), t, phraseDur);

    // Post an obligation: someone should answer this contour.
    if (chance(0.45)) Motif.post("chant", pickW([["gyaling", 3], ["dungchen", 2]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));

    var gap = rnd(2.5, 6) * (1.3 - inten * 0.6);
    // audible in-breath in the gap
    scheduleRaw(function () { if (playing && !inHush()) breathNoise(ctx.currentTime, "chant"); }, (phraseDur + 0.3) * 1000);
    scheduleRaw(chantPhrase, (phraseDur + gap) * 1000);
  }
  function chantMonk(t, dur, motif, det, growl, glideAmt, mk, monks) {
    var dest = panAt("chant", mk === 0 ? 0 : (mk % 2 ? -0.4 : 0.4));
    var f0 = F0 * (1 + det);
    // source: saw at f0 + sub-saw at f0/2 (period-doubled growl)
    var src = ctx.createGain();
    var o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.setValueAtTime(f0, t);
    var g1 = ctx.createGain(); g1.gain.setValueAtTime(0.5, t);
    o1.connect(g1); g1.connect(src);
    var o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.setValueAtTime(f0 / 2, t);
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.42 * growl, t);
    o2.connect(g2); g2.connect(src);
    // formants: F1 slow vowel drift, F2 = THE MELODY (harmonic isolation), F3 presence
    var f1 = ctx.createBiquadFilter(); f1.type = "bandpass";
    f1.frequency.setValueAtTime(rnd(380, 520), t);
    f1.frequency.linearRampToValueAtTime(rnd(430, 640), t + dur);
    f1.Q.setValueAtTime(7, t);
    var f2 = ctx.createBiquadFilter(); f2.type = "bandpass";
    f2.Q.setValueAtTime(24 + (mk === 0 ? 6 : 0), t);
    var f3 = ctx.createBiquadFilter(); f3.type = "bandpass";
    f3.frequency.setValueAtTime(2350, t); f3.Q.setValueAtTime(5, t);
    var f1g = ctx.createGain(); f1g.gain.setValueAtTime(0.8, t);
    var f2g = ctx.createGain(); f2g.gain.setValueAtTime(1.15, t);
    var f3g = ctx.createGain(); f3g.gain.setValueAtTime(0.12, t);
    src.connect(f1); f1.connect(f1g);
    src.connect(f2); f2.connect(f2g);
    src.connect(f3); f3.connect(f3g);
    var vg = ctx.createGain();
    f1g.connect(vg); f2g.connect(vg); f3g.connect(vg);
    vg.connect(dest);
    // realize the contour: F2 glides between harmonic targets (yang-yig curves)
    var pts = motif.points;
    f2.frequency.setValueAtTime(harm(pts[0].h) * (1 + det), t);
    var lastAt = t;
    for (var i = 1; i < pts.length; i++) {
      var jitter = mk === 0 ? 0 : rnd(-0.06, 0.06);           // heterophonic timing divergence
      var at = t + Math.max(0.05, Math.min(0.98, pts[i].t + jitter)) * dur;
      at = Math.max(at, lastAt + 0.25);                        // keep automation monotonic
      var glideDur = Math.max(0.3, (at - lastAt) * glideAmt);
      f2.frequency.setValueAtTime(harm(pts[i - 1].h) * (1 + det), Math.max(lastAt + 0.05, at - glideDur));
      f2.frequency.linearRampToValueAtTime(harm(pts[i].h) * (1 + det), at);
      lastAt = at;
    }
    // amplitude: slow swell, undulating sustain, gentle release
    var peak = 0.3 / Math.sqrt(monks);
    env(vg, t, [[rnd(1.2, 2.2), peak], [dur - 4, peak * 0.85], [1.8, 0]]);
    [o1, o2].forEach(function (o) { o.start(t); o.stop(t + dur + 0.3); });
  }
  function breathNoise(t, layer) {
    var dest = panAt(layer, 0);
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(rnd(700, 1400), t); f.Q.setValueAtTime(1.2, t);
    var g = ctx.createGain();
    n.connect(f); f.connect(g); g.connect(dest);
    env(g, t, [[0.25, 0.05], [rnd(0.3, 0.6), 0]]);
    n.start(t, noiseOffset()); n.stop(t + 1.2);
  }

  // ==========================================================================
  // VOICE: FLOOR — damaru swung rattle + drilbu bell shimmer. The continuous
  // polyrhythmic ground under everything. (Ellingson: the rattle deliberately
  // contrasts with the cymbal pulse.)
  // ==========================================================================
  function damaruCycle() {
    if (!playing) return;
    if (C.section === "dedication") { scheduleRaw(damaruCycle, 3000); return; }
    var t = ctx.currentTime;
    var inten = intensity();
    var swing = getLayerParam("floor", "swing", 0.5);
    var rattle = getLayerParam("floor", "rattle", 0.55);
    var period = rnd(0.3, 0.5) / (0.7 + swing * 0.6) / (1 + inten * 0.35);
    var beats = rint(5, 9);
    var amp = rattle * 0.32 * (0.35 + inten * 0.75) * (C.section === "dissolution" ? (1 - localArc() * 0.8) : 1);
    for (var b = 0; b < beats; b++) {
      var bt = t + b * period * (1 + rnd(-0.12, 0.12));
      damaruSnap(bt, amp);
      damaruSnap(bt + rnd(0.035, 0.06), amp * 0.75);          // the paired second striker
    }
    emitNote("floor", 0, t, beats * period);
    scheduleLayer(damaruCycle, beats * period * 1000 + rnd(200, 1400) * (1.4 - inten), "floor");
  }
  function damaruSnap(t, amp) {
    var dest = panAt("floor", rnd(-0.35, 0.35));
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(rnd(1300, 2600), t); f.Q.setValueAtTime(2.5, t);
    var g = ctx.createGain();
    n.connect(f); f.connect(g); g.connect(dest);
    env(g, t, [[0.003, amp], [0.05, 0]]);
    n.start(t, noiseOffset()); n.stop(t + 0.1);
    var o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(rnd(420, 560), t);
    var og = ctx.createGain();
    o.connect(og); og.connect(dest);
    env(og, t, [[0.002, amp * 0.4], [0.045, 0]]);
    o.start(t); o.stop(t + 0.08);
  }
  // Drilbu — inharmonic partials in doublet pairs (the beating shimmer of a real
  // bell). Rung at cadence moments and sparsely on its own; vajra-taps between.
  function drilbuBell(t, gainMul) {
    if (!ctx) return;
    var dest = panAt("floor", rnd(-0.2, 0.2));
    var bellAmt = getLayerParam("floor", "bell", 0.55);
    var base = harm(pick(spectral)) * 8;                       // land the strike ~1.5-3k
    while (base > 3400) base /= 2;
    while (base < 1400) base *= 2;
    var ratios = [1, 2.71, 5.42, 8.17];
    var g0 = (gainMul || 0.6) * bellAmt * 0.5;
    for (var i = 0; i < ratios.length; i++) {
      for (var d = 0; d < 2; d++) {                            // doublet: ±0.5-3 Hz → beating
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(base * ratios[i] + (d ? rnd(0.5, 3) : 0), t);
        var og = ctx.createGain();
        o.connect(og); og.connect(dest);
        var pg = g0 * 0.5 / (1 + i * 1.1);
        env(og, t, [[0.004, pg], [rnd(2.5, 7) / (1 + i * 0.6), 0]]);
        o.start(t); o.stop(t + 8);
      }
    }
    // low hum partial
    var hum = ctx.createOscillator();
    hum.type = "sine"; hum.frequency.setValueAtTime(base * 0.5, t);
    var hg = ctx.createGain();
    hum.connect(hg); hg.connect(dest);
    env(hg, t, [[0.01, g0 * 0.3], [rnd(4, 8), 0]]);
    hum.start(t); hum.stop(t + 9);
    emitNote("floor", base, t, 6);
  }
  function drilbuCycle() {
    if (!playing) return;
    var t = ctx.currentTime;
    if (C.section === "dedication") {
      drilbuBell(t + 0.1, 1.0);                                // the lone dedication bell
      scheduleRaw(drilbuCycle, rnd(12, 18) * 1000);
      return;
    }
    if (chance(0.55)) drilbuBell(t + 0.05, rnd(0.35, 0.7));
    else vajraTap(t + 0.05);
    scheduleLayer(drilbuCycle, rnd(9, 22) * 1000 * (1.3 - intensity() * 0.5), "floor");
  }
  function vajraTap(t) {
    var dest = panAt("floor", rnd(-0.15, 0.15));
    var o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(rnd(2800, 3600), t);
    var og = ctx.createGain();
    o.connect(og); og.connect(dest);
    env(og, t, [[0.002, 0.12 * getLayerParam("floor", "bell", 0.55)], [0.09, 0]]);
    o.start(t); o.stop(t + 0.15);
  }

  // ==========================================================================
  // VOICE: DUNGCHEN — the long horn pair. Fundamental F0×2, gliding up toward
  // F0×3 and back in slow portamento swells. Five documented articulations,
  // chosen by activity and intensity:
  //   rgyang    clean sustained pedal (saw → lowpass, arched swell)
  //   rdor      loose-lip growl (20-40 Hz AM roughness, darker filter)
  //   kha-rdor  short growl stab (~1.5 s)
  //   tir       overblown blast — the lowpass opens AND a per-note tanh drive
  //             ramps up, so the brass brightens nonlinearly with loudness
  //   tsag      soft sine at 2-3× the horn fundamental; seals the phrase
  // A phrase is gsum 'bud: three-to-four swells ended with a tsag. Two players
  // sit a few cents apart; when A growls low, B floats the high tsag — the
  // traditional interlock.
  // ==========================================================================
  function dungchenTechnique(inten) {
    var w = ACTIVITIES[C.activity].wrathful;
    return pickW([
      ["rgyang", 4 - w * 2],
      ["rdor", 1 + w * 3 + inten],
      ["kha-rdor", 0.4 + w * 2.5],
      ["tir", (inten > 0.55 || inTutti()) ? 0.6 + w * 2 : 0.05],
    ]);
  }
  function dungchenSwell(t, dur, fTarget, tech, det, pan) {
    var dest = panAt("dungchen", pan);
    var breath = getLayerParam("dungchen", "breath", 0.5);
    var growl = getLayerParam("dungchen", "growl", 0.5);
    var bright = getLayerParam("dungchen", "brightness", 0.45);
    var ft = fTarget * (1 + det);
    if (tech === "tsag") {
      // the closing tone: a soft sine two-to-three times the horn fundamental
      var so = ctx.createOscillator();
      so.type = "sine"; so.frequency.setValueAtTime(ft, t);
      var sg = ctx.createGain();
      so.connect(sg); sg.connect(dest);
      env(sg, t, [[0.14, 0.2], [dur * 0.35, 0.14], [dur * 0.65, 0]]);
      so.start(t); so.stop(t + dur + 0.3);
      return;
    }
    var f0 = F0 * 2 * (1 + det);
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    // slow portamento: rise from the pedal to the target, settle back down
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(ft, t + dur * 0.45);
    o.frequency.setValueAtTime(ft, t + dur * 0.72);
    o.frequency.linearRampToValueAtTime(f0, t + dur);
    var grly = tech === "rdor" || tech === "kha-rdor";
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    var cutBase = (grly ? 230 : 330) * (0.6 + bright);
    lp.frequency.setValueAtTime(cutBase, t);
    lp.frequency.linearRampToValueAtTime(cutBase * (tech === "tir" ? 5 : 2.1), t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(cutBase, t + dur);
    o.connect(lp);
    var tail = lp;
    if (tech === "tir") {
      // Overblown: drive ramps INTO the tanh so the tone brightens nonlinearly
      // with loudness. LESSON (see grit bus): a shaper has huge small-signal
      // makeup gain — always attenuate AFTER it, or every onset clicks.
      var drive = ctx.createGain();
      drive.gain.setValueAtTime(0.6, t);
      drive.gain.linearRampToValueAtTime(2.5, t + dur * 0.55);
      drive.gain.linearRampToValueAtTime(0.7, t + dur);
      var ws = ctx.createWaveShaper();
      var wc = new Float32Array(512);
      for (var wi = 0; wi < 512; wi++) { var wx = (wi / 511) * 2 - 1; wc[wi] = Math.tanh(wx * 2.4) / Math.tanh(2.4); }
      ws.curve = wc; ws.oversample = "2x";
      var post = ctx.createGain();
      post.gain.setValueAtTime(0.42, t);                       // the attenuation, post-shaper
      lp.connect(drive); drive.connect(ws); ws.connect(post);
      tail = post;
    }
    if (grly) {
      // loose lips: 20-40 Hz amplitude roughness riding the swell
      var am = ctx.createGain();
      var depth = 0.18 + growl * 0.32;
      am.gain.setValueAtTime(1 - depth, t);
      var amLfo = ctx.createOscillator();
      amLfo.frequency.setValueAtTime(rnd(20, 40), t);
      var amG = ctx.createGain(); amG.gain.setValueAtTime(depth, t);
      amLfo.connect(amG); amG.connect(am.gain);
      tail.connect(am); tail = am;
      amLfo.start(t); amLfo.stop(t + dur + 0.2);
    }
    var og = ctx.createGain();
    tail.connect(og); og.connect(dest);
    var peak = tech === "kha-rdor" ? 0.36 : 0.3;
    var atk = tech === "kha-rdor" ? 0.09 : dur * 0.38;
    env(og, t, [[atk, peak], [Math.max(0.05, dur * 0.9 - atk), peak * 0.75], [dur * 0.1, 0]]);
    o.start(t); o.stop(t + dur + 0.2);
    // chuff — the breath transient of a very long pipe speaking
    if (breath > 0.05) {
      var n = noiseSource();
      var nf = ctx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.setValueAtTime(rnd(350, 650), t); nf.Q.setValueAtTime(1, t);
      var ng = ctx.createGain();
      n.connect(nf); nf.connect(ng); ng.connect(dest);
      env(ng, t, [[0.03, 0.13 * breath], [0.22, 0]]);
      n.start(t, noiseOffset()); n.stop(t + 0.4);
    }
  }
  function dungchenPhrase() {
    if (!playing) return;
    if (C.section === "dedication" || inHush()) { scheduleRaw(dungchenPhrase, 6000); return; }
    if (C.section === "generation" && chance(0.55)) { scheduleRaw(dungchenPhrase, rnd(12, 24) * 1000); return; }
    var inten = intensity();
    var forward = inTutti() || C.activity === "magnetize" || C.activity === "destroy";
    var pace = getLayerParam("dungchen", "pace", 1);
    var motif = Motif.overdueFor("dungchen") ? Motif.claim("dungchen", "contour")
      : (chance(0.5) ? Motif.request("contour") : null);
    var pts = motif ? motif.points : null;
    var mid = 0;
    if (pts) { for (var pi = 0; pi < pts.length; pi++) mid += pts[pi].h; mid /= pts.length; }
    var swells = rint(3, 4);                                   // gsum 'bud — the counted breath
    var detA = -rnd(0.0012, 0.0025), detB = rnd(0.0012, 0.003); // the pair, a few cents apart
    var t = ctx.currentTime + 0.1, t0 = t;
    for (var s = 0; s < swells; s++) {
      var tech = dungchenTechnique(inten);
      var dur = (tech === "kha-rdor" ? rnd(1.2, 1.9) : rnd(3, 8)) / pace;
      // the contour decides whether this swell reaches the 3rd harmonic or rests on the 2nd
      var hT = pts ? (pts[Math.min(s, pts.length - 1)].h > mid ? 3 : 2) : (chance(0.4) ? 3 : 2);
      var target = harm(hT);
      dungchenSwell(t, dur, target, tech, detA, -0.3);
      emitNote("dungchen", target, t, dur);
      if ((tech === "rdor" || tech === "kha-rdor") && chance(0.6)) {
        // interlock: A growls low while B answers with the high tsag
        var hB = pick([4, 6]);
        var tb = t + dur * rnd(0.3, 0.5);
        dungchenSwell(tb, rnd(1, 1.8), harm(hB), "tsag", detB, 0.3);
        emitNote("dungchen", harm(hB), tb, 1.4);
      } else if (chance(0.7)) {
        dungchenSwell(t + rnd(0.05, 0.3), dur * rnd(0.8, 0.98), target, tech, detB, 0.3);
      }
      t += dur + rnd(0.2, 1.2);
    }
    var hSeal = pick([4, 6]);                                  // the tsag seal
    var sealDur = rnd(1, 1.7);
    dungchenSwell(t, sealDur, harm(hSeal), "tsag", detB, 0.25);
    emitNote("dungchen", harm(hSeal), t, sealDur);
    var phraseLen = (t + sealDur) - t0;
    var gap = forward ? rnd(5, 12) : (C.section === "generation" ? rnd(20, 40) : rnd(12, 26));
    if (inTutti()) gap *= 0.5;
    scheduleLayer(dungchenPhrase, (phraseLen + gap) * 1000, "dungchen");
  }

  // ==========================================================================
  // VOICE: GYALING — the double-reed shawm pair; THE discrete-pitch melodic
  // voice, peaceful sections only. Circular breathing: a phrase is one unbroken
  // line — portamento between degrees, fast upper-neighbor trills on held
  // notes, first and last notes held long (the documented style). HETEROPHONY:
  // a second player reads the same melody a breath behind and a hair sharp,
  // making trill choices alone — two musicians, one page.
  // ==========================================================================
  function gyalingDeg(d) {
    while (d < -5) d += 5;
    while (d > 12) d -= 5;
    return d;
  }
  function renderGyalingVoice(t, notes, cents, pan, isMain, forceTrill) {
    var dest = panAt("gyaling", pan);
    var reed = getLayerParam("gyaling", "reed", 0.55);
    var trillAmt = getLayerParam("gyaling", "trill", 0.5);
    var glideAmt = getLayerParam("gyaling", "glide", 0.55);
    var det = Math.pow(2, cents / 1200);
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200 + reed * 2300, t);        // the reed formant sits still while the melody moves under it
    bp.Q.setValueAtTime(2.5 + reed * 6, t);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(4200, t);
    var g = ctx.createGain();
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
    o.frequency.setValueAtTime(notes[0].f * det, t);
    var tt = t, total = 0, i;
    for (i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.03, Math.min(0.22, n.dur * 0.35) * (0.3 + glideAmt));
        o.frequency.setValueAtTime(notes[i - 1].f * det, tt);
        o.frequency.linearRampToValueAtTime(n.f * det, tt + port);
      }
      // trill: fast upper-neighbor flutter on held notes — each player decides alone
      if (n.dur > 1.1 && (forceTrill || chance(trillAmt * 0.8))) {
        var trT = tt + n.dur * rnd(0.3, 0.45);
        var half = rnd(0.07, 0.11);
        var reps = Math.max(1, Math.min(rint(3, 6), Math.floor((n.dur * 0.45) / (half * 2))));
        for (var r = 0; r < reps; r++) {
          o.frequency.setValueAtTime(n.fUp * det, trT + r * half * 2);
          o.frequency.setValueAtTime(n.f * det, trT + r * half * 2 + half);
        }
      }
      if (isMain) emitNote("gyaling", n.f, tt, n.dur);
      tt += n.dur;
      total += n.dur;
    }
    var peak = 0.2;
    env(g, t, [[0.35, peak], [Math.max(0.1, total - 1.45), peak * 0.9], [1.1, 0]]);
    o.start(t); o.stop(t + total + 1.3);
    return total;
  }
  function gyalingPhrase() {
    if (!playing) return;
    if (!ACTIVITIES[C.activity].gyaling || inHush() || C.section === "dedication") {
      scheduleRaw(gyalingPhrase, 5000); return;
    }
    var inten = intensity();
    var motif = Motif.overdueFor("gyaling") ? Motif.claim("gyaling", "degree") : Motif.request("degree");
    if (!motif) { scheduleRaw(gyalingPhrase, 5000); return; }
    var pace = getLayerParam("gyaling", "pace", 1);
    var shadowAmt = getLayerParam("gyaling", "shadow", 0.6);
    var beat = rnd(0.5, 0.75) / pace / (0.8 + inten * 0.4);
    var notes = [];
    for (var i = 0; i < motif.notes.length; i++) {
      var ki = scaleIndexOf(gyalingDeg(motif.notes[i].deg));
      var d = motif.notes[i].durBeats * beat;
      if (i === 0 || i === motif.notes.length - 1) d = Math.max(d, beat * rnd(2.2, 3.2));   // held long at both ends
      notes.push({ f: SCALE[ki].freq, fUp: SCALE[Math.min(SCALE.length - 1, ki + 1)].freq, dur: Math.max(0.28, d) });
    }
    var t = ctx.currentTime + 0.1;
    var phraseDur = renderGyalingVoice(t, notes, 0, -0.25, true, false);
    // the shadow player: same page, a breath behind, +10 cents, own trills
    renderGyalingVoice(t + shadowAmt * rnd(0.15, 0.4), notes, 10, 0.3, false, false);
    // and answers flow back into the dialogue
    if (chance(0.4)) Motif.post("gyaling", pickW([["chant", 3], ["dungchen", 1]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    var gap = rnd(3, 9) * (1.35 - inten * 0.6);
    if (inTutti()) gap *= 0.45;
    scheduleLayer(gyalingPhrase, (phraseDur + gap) * 1000, "gyaling");
  }

  // ==========================================================================
  // VOICE: MURMUR — wordless 'don recitation. A low voice speaking no language
  // at all: syllable-gated formant jumps over a quiet reed of sound. The
  // guiding voice of the ship — intimate, close to the ear, never words.
  // ==========================================================================
  var MURMUR_VOWELS = [[300, 800], [420, 1050], [520, 1400], [640, 1750], [780, 2050], [880, 2200]];
  function murmurRender(t, dur) {
    var dest = panAt("murmur", 0);
    var presence = getLayerParam("murmur", "presence", 0.5);
    var openness = getLayerParam("murmur", "openness", 0.5);
    var sylRate = 4 + getLayerParam("murmur", "syllables", 0.5) * 4;    // 4-8 syl/s
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    // recitation-tone drift — speech prosody, not song
    o.frequency.setValueAtTime(F0 * 2, t);
    o.frequency.linearRampToValueAtTime(F0 * 2 * rnd(0.985, 1.02), t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(F0 * 2 * 0.98, t + dur);
    // Pre-attenuate the saw before the resonant formants: at Q 9-11 the
    // resonance boosts ~9x and (measured) rails the master via the
    // compressor's auto-makeup. Source low, formants gentler.
    var pre = ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.setValueAtTime(5, t);
    var f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.setValueAtTime(6, t);
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(1400, t);
    var f1g = ctx.createGain(); f1g.gain.setValueAtTime(1, t);
    var f2g = ctx.createGain(); f2g.gain.setValueAtTime(0.65, t);
    var gate = ctx.createGain();
    var og = ctx.createGain();
    pre.connect(f1); f1.connect(f1g); f1g.connect(gate);
    pre.connect(f2); f2.connect(f2g); f2g.connect(gate);
    gate.connect(og); og.connect(dest);
    gate.gain.setValueAtTime(0, t);
    var st = t + 0.05, end = t + dur - 0.4;
    // Formant jumps as short linearRamps, NOT setTargetAtTime: exponential-
    // approach automation on biquad frequency destabilizes the filter
    // (measured: sustained full-scale oscillation). Ramps are safe.
    var pv1 = 500, pv2 = 1400;
    while (st < end) {
      var syl = 1 / (sylRate * rnd(0.8, 1.25));
      var v = pick(MURMUR_VOWELS);
      var t1 = v[0], t2 = v[1] * (0.75 + openness * 0.5);
      f1.frequency.setValueAtTime(pv1, st); f1.frequency.linearRampToValueAtTime(t1, st + 0.03);
      f2.frequency.setValueAtTime(pv2, st); f2.frequency.linearRampToValueAtTime(t2, st + 0.03);
      pv1 = t1; pv2 = t2;
      var on = Math.max(0.03, syl * 0.22);                     // soft attacks — no clicks
      var hold = syl * rnd(0.42, 0.68);
      gate.gain.setValueAtTime(0, st);
      gate.gain.linearRampToValueAtTime(1, st + on);
      gate.gain.linearRampToValueAtTime(0, st + on + hold);
      st += syl + (chance(0.12) ? rnd(0.15, 0.5) : 0);         // breath commas
    }
    var peak = 0.5 * presence;                                 // pre-gain dropped 6x; net sits under the voices
    env(og, t, [[1.2, peak], [Math.max(0.4, dur - 2.6), peak * 0.9], [1.4, 0]]);
    o.start(t); o.stop(t + dur + 0.3);
    emitNote("murmur", 0, t, dur);
    return dur;
  }
  function murmurPhrase() {
    if (!playing) return;
    var speaks = C.section === "generation" || (C.section === "offering" && localArc() < 0.5);
    if (!speaks || inHush()) { scheduleRaw(murmurPhrase, 5000); return; }
    var dur = rnd(6, 14);
    murmurRender(ctx.currentTime + 0.05, dur);
    scheduleLayer(murmurPhrase, (dur + rnd(2, 5)) * 1000, "murmur");
  }

  // ==========================================================================
  // VOICE: DUNGKAR — the conch. One vowel-like tone per long stretch, a folded
  // harmonic in the shell's speaking range; the player's hand in the mouth is
  // a slow lowpass wah with occasional deliberate dips. Peaceful activities
  // only; falls silent as the mandala dissolves.
  // ==========================================================================
  function dungkarFoldHarm() {
    var h = pick(spectral);
    while (F0 * h < 290) h *= 2;                               // fold up into the conch band
    while (F0 * h > 560 && h > 1) h -= 1;                      // ease down along the series
    return h;
  }
  function dungkarTone(t, dur, f, overlap) {
    var dest = panAt("dungkar", rnd(-0.25, 0.25));
    var wah = getLayerParam("dungkar", "wah", 0.45);
    var breath = getLayerParam("dungkar", "breath", 0.4);
    var mix = ctx.createGain();
    var o1 = ctx.createOscillator();
    o1.type = "triangle"; o1.frequency.setValueAtTime(f, t);
    var g1 = ctx.createGain(); g1.gain.setValueAtTime(0.55, t);
    o1.connect(g1); g1.connect(mix);
    var partials = [2, 3];
    for (var p = 0; p < partials.length; p++) {
      var op = ctx.createOscillator();
      op.type = "sine"; op.frequency.setValueAtTime(f * partials[p], t);
      var gp = ctx.createGain(); gp.gain.setValueAtTime(p === 0 ? 0.14 : 0.07, t);
      op.connect(gp); gp.connect(mix);
      op.start(t); op.stop(t + dur + 0.3);
    }
    if (breath > 0.05) {
      var n = noiseSource();
      var nf = ctx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.setValueAtTime(f * 3, t); nf.Q.setValueAtTime(1.5, t);
      var ng = ctx.createGain(); ng.gain.setValueAtTime(breath * 0.05, t);
      n.connect(nf); nf.connect(ng); ng.connect(mix);
      n.start(t, noiseOffset()); n.stop(t + dur + 0.3);
    }
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(f * 2.6, t);
    lp.Q.setValueAtTime(1.1, t);
    // Hand-wah: LFO depth kept WELL below the lowest dip target — stacking a
    // big a-rate LFO on top of setTargetAtTime dips drove the cutoff toward
    // zero and blew the biquad up (measured: 2.0 peak, click storm from the
    // first dip). Depth ≤ f*0.35 keeps the cutoff safely positive everywhere.
    var lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(rnd(0.05, 0.1), t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(f * 0.35 * wah, t);
    lfo.connect(lg); lg.connect(lp.frequency);
    // Deliberate wah dips as sorted, non-overlapping linearRamps —
    // setTargetAtTime on biquad frequency blew the filter up (measured).
    var dipT = [];
    var dips = rint(0, 2);
    for (var d = 0; d < dips; d++) dipT.push(t + rnd(0.25, 0.7) * dur);
    dipT.sort(function (a, b) { return a - b; });
    var dipCursor = t + 0.1;
    for (var d2 = 0; d2 < dipT.length; d2++) {
      var dt = Math.max(dipT[d2], dipCursor);
      var fall = rnd(0.8, 1.4), dipHold = rnd(0.6, 1.2), rise = rnd(1.4, 2.6);
      if (dt + fall + dipHold + rise > t + dur - 0.5) break;
      lp.frequency.setValueAtTime(f * 2.6, dt);
      lp.frequency.linearRampToValueAtTime(f * 1.3, dt + fall);
      lp.frequency.setValueAtTime(f * 1.3, dt + fall + dipHold);
      lp.frequency.linearRampToValueAtTime(f * 2.6, dt + fall + dipHold + rise);
      dipCursor = dt + fall + dipHold + rise + 0.2;
    }
    var og = ctx.createGain();
    mix.connect(lp); lp.connect(og); og.connect(dest);
    var peak = 0.22;
    env(og, t, [[overlap * 0.9, peak], [Math.max(0.5, dur - overlap * 1.8), peak * 0.9], [overlap * 0.9, 0]]);
    o1.start(t); o1.stop(t + dur + 0.3);
    lfo.start(t); lfo.stop(t + dur + 0.3);
  }
  function dungkarCycle() {
    if (!playing) return;
    var peaceful = C.activity === "pacify" || C.activity === "enrich";
    var silent = !peaceful || C.section === "dedication" || (C.section === "dissolution" && localArc() > 0.5) || inHush();
    if (silent) { scheduleRaw(dungkarCycle, 7000); return; }
    var t = ctx.currentTime;
    var dur = rnd(20, 35), overlap = 6;                        // long crossfading cycles, like the hull
    var f = harm(dungkarFoldHarm());
    dungkarTone(t, dur, f, overlap);
    emitNote("dungkar", f, t, dur);
    scheduleLayer(dungkarCycle, (dur - overlap) * 1000, "dungkar");
  }

  // ==========================================================================
  // VOICE: KANGLING — the thighbone trumpet. Wrathful event voice, rare and
  // ritualized: a two-note whinny stated three times (the traditional
  // grouping), double-bell dual resonance, pitch that will not quite hold
  // still. Fierce compassion — it cuts, then it is gone.
  // ==========================================================================
  function kanglingNote(t, dur, f, c1, c2) {
    var dest = panAt("kangling", rnd(-0.4, 0.4));
    var rasp = getLayerParam("kangling", "rasp", 0.6);
    var instab = getLayerParam("kangling", "instability", 0.5);
    var mix = ctx.createGain();
    var o1 = ctx.createOscillator(); o1.type = "sawtooth";
    var o2 = ctx.createOscillator(); o2.type = "square";
    var g1 = ctx.createGain(); g1.gain.setValueAtTime(0.55, t);
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.3, t);
    o1.connect(g1); g1.connect(mix);
    o2.connect(g2); g2.connect(mix);
    [o1, o2].forEach(function (o) {                            // fast up-glide in, falling out
      o.frequency.setValueAtTime(f * 0.82, t);
      o.frequency.linearRampToValueAtTime(f, t + Math.min(0.09, dur * 0.25));
      o.frequency.setValueAtTime(f, t + dur * 0.72);
      o.frequency.linearRampToValueAtTime(f * 0.88, t + dur);
    });
    var wob = ctx.createOscillator();                          // the pitch will not hold still
    wob.frequency.setValueAtTime(rnd(4.5, 7), t);
    wob.frequency.linearRampToValueAtTime(rnd(3, 8), t + dur * 0.5 + 0.5);
    var wg = ctx.createGain(); wg.gain.setValueAtTime(f * 0.006 * instab, t);
    wob.connect(wg); wg.connect(o1.frequency); wg.connect(o2.frequency);
    if (rasp > 0.05) {                                         // bone-noise, mixed before the bells
      var n = noiseSource();
      var ng = ctx.createGain(); ng.gain.setValueAtTime(0.14 * rasp, t);
      n.connect(ng); ng.connect(mix);
      n.start(t, noiseOffset()); n.stop(t + dur + 0.2);
    }
    var og = ctx.createGain();
    var centers = [c1, c2];
    for (var b = 0; b < 2; b++) {                              // the double bell: two resonances, slightly apart
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.setValueAtTime(centers[b], t); bp.Q.setValueAtTime(4.5, t);
      var bg = ctx.createGain(); bg.gain.setValueAtTime(b === 0 ? 0.9 : 0.65, t);
      mix.connect(bp); bp.connect(bg); bg.connect(og);
    }
    og.connect(dest);
    env(og, t, [[0.03, 0.3], [dur * 0.55, 0.23], [Math.max(0.08, dur * 0.45 - 0.03), 0]]);
    o1.start(t); o1.stop(t + dur + 0.15);
    o2.start(t); o2.stop(t + dur + 0.15);
    wob.start(t); wob.stop(t + dur + 0.15);
  }
  function kanglingCycle() {
    if (!playing) return;
    if (!(ACTIVITIES[C.activity].kangling && intensity() > 0.45) || inHush()) {
      scheduleRaw(kanglingCycle, 9000); return;
    }
    var t = ctx.currentTime + 0.1;
    var hHi = rint(13, 16);                                    // high harmonics — the bone register
    var hLo = hHi - rint(2, 4);
    var bp1 = rnd(700, 900), bp2 = rnd(920, 1100);
    var tt = t;
    for (var rep = 0; rep < 3; rep++) {
      var d1 = rnd(0.3, 0.5), d2 = rnd(0.4, 0.7);
      kanglingNote(tt, d1, harm(hHi), bp1, bp2);
      emitNote("kangling", harm(hHi), tt, d1);
      var t2 = tt + d1 + rnd(0.04, 0.1);
      kanglingNote(t2, d2, harm(hLo), bp1, bp2);
      emitNote("kangling", harm(hLo), t2, d2);
      tt = t2 + d2 + rnd(0.5, 1.1);
    }
    emitEvent({ cat: "voice", label: "࿊ kangling", detail: C.activity + " · h" + hHi + "→h" + hLo + " ×3" });
    scheduleLayer(kanglingCycle, rnd(25, 60) * 1000, "kangling");
  }

  // ==========================================================================
  // VOICE: NOISE — bone-dust. Not walls: this ship is luminous. Two textures:
  // dust-drift (long quiet filtered swells, lowpassed early, banded in action)
  // and dust-crackle (sparse granular tick clusters — dry disintegration, most
  // at home in dissolution, where the mandala is being swept).
  // ==========================================================================
  function dustDrift(t, dur, peak) {
    var color = getLayerParam("noise", "color", 0.5);
    var dust = getLayerParam("noise", "dust", 0.55);
    var dest = panAt("noise", rnd(-0.35, 0.35));
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    if (C.section === "action" || isWrathful()) {
      f.type = "bandpass";
      f.frequency.setValueAtTime(rnd(400, 1300) * (0.6 + color * 0.8), t);
      f.Q.setValueAtTime(rnd(1.5, 4), t);
    } else {
      f.type = "lowpass";
      f.frequency.setValueAtTime(300 + color * 600, t);
    }
    var g = ctx.createGain();
    n.connect(f); f.connect(g); g.connect(dest);
    var p = Math.min(0.12, peak * (0.55 + dust * 0.7));
    env(g, t, [[dur * 0.45, p], [dur * 0.25, p * 0.8], [dur * 0.3, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.2);
    emitNote("noise", 0, t, dur);
  }
  function dustCrackle(t) {
    var dust = getLayerParam("noise", "dust", 0.55);
    var span = rnd(2, 5), ticks = rint(5, 15);
    for (var i = 0; i < ticks; i++) {
      var tt = t + rng() * span;
      var n = noiseSource();
      var f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.setValueAtTime(rnd(1800, 5200), tt); f.Q.setValueAtTime(rnd(4, 9), tt);
      var g = ctx.createGain();
      n.connect(f); f.connect(g); g.connect(panAt("noise", rnd(-0.5, 0.5)));
      env(g, tt, [[0.003, 0.05 * dust * rnd(0.5, 1)], [rnd(0.015, 0.05), 0]]);
      n.start(tt, noiseOffset()); n.stop(tt + 0.12);
    }
    emitNote("noise", 0, t, span);
  }
  function noiseCycle() {
    if (!playing) return;
    if (C.section === "dedication" || inHush()) { scheduleRaw(noiseCycle, 6000); return; }
    var density = getLayerParam("noise", "density", 0.35);
    var t = ctx.currentTime + 0.05;
    var crackleP = C.section === "dissolution" ? 0.55 : 0.2;   // the sweeping of the sand
    var dur;
    if (chance(crackleP)) { dustCrackle(t); dur = rnd(2, 5); }
    else {
      dur = rnd(8, 20);
      var peak = Math.min(0.12, 0.02 + intensity() * ACTIVITIES[C.activity].grit * 0.9);
      dustDrift(t, dur, peak);
    }
    scheduleLayer(noiseCycle, (dur * rnd(0.6, 0.9) + rnd(3, 10) * (1.5 - density)) * 1000, "noise");
  }

  // ==========================================================================
  // VOICE: AMBIENT — the event pool. Small ritual machines and far-field
  // phenomena; every pitched one is tuned to the illuminated harmonics.
  // ==========================================================================
  function ambientHarm(minF, maxF) {   // fold a spectral harmonic into a band (stays exact)
    var h = pick(spectral);
    while (F0 * h < minF) h *= 2;
    while (F0 * h > maxF && h > 1) h -= 1;
    return h;
  }
  // prayer-wheel rotor: a rotating cycle of six soft blips with slight
  // accel/decel — a machine reciting.
  function evPrayerWheel(t) {
    var f = harm(ambientHarm(350, 900));
    var revs = rint(2, 4), period = rnd(0.5, 1);
    var total = revs * 6, tt = t;
    for (var i = 0; i < total; i++) {
      var o = ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(f, tt);
      var g = ctx.createGain();
      o.connect(g); g.connect(panAt("ambient", 0.25 * Math.sin((i % 6) / 6 * Math.PI * 2)));
      env(g, tt, [[0.012, i % 6 === 0 ? 0.07 : 0.045], [0.1, 0]]);
      o.start(tt); o.stop(tt + 0.2);
      var speed = 0.85 + 0.4 * Math.sin((i / total) * Math.PI);   // spun, then let settle
      tt += (period / 6) / speed;
    }
    emitNote("ambient", f, t, tt - t);
    return "prayer-wheel rotor";
  }
  // wind-horse static: prayer-flags in solar wind — a noise gust fluttering at 8-15 Hz.
  function evWindHorse(t) {
    var dur = rnd(3, 8);
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(rnd(900, 2600), t); f.Q.setValueAtTime(rnd(1, 2.2), t);
    var fl = ctx.createGain();
    fl.gain.setValueAtTime(0.7, t);
    var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(rnd(8, 15), t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(0.3, t);
    lfo.connect(lg); lg.connect(fl.gain);
    var g = ctx.createGain();
    n.connect(f); f.connect(fl); fl.connect(g); g.connect(panAt("ambient", rnd(-0.5, 0.5)));
    env(g, t, [[dur * 0.4, 0.06], [dur * 0.6, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.2);
    lfo.start(t); lfo.stop(t + dur + 0.2);
    emitNote("ambient", 0, t, dur);
    return "wind-horse static";
  }
  // resonance vessel: a standing bowl — inharmonic partials in beating doublet pairs.
  function evVessel(t) {
    var base = harm(ambientHarm(180, 420));
    var ratios = [1, 2.8, 5.4, 8.6];
    var decay = rnd(10, 25);
    var dest = panAt("ambient", rnd(-0.3, 0.3));
    for (var i = 0; i < ratios.length; i++) {
      for (var d = 0; d < 2; d++) {
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(base * ratios[i] + (d ? rnd(0.5, 8) : 0), t);
        var g = ctx.createGain();
        o.connect(g); g.connect(dest);
        env(g, t, [[0.006, 0.045 / (1 + i * 0.9)], [decay / (1 + i * 0.7), 0]]);
        o.start(t); o.stop(t + decay + 1);
      }
    }
    var n = noiseSource();                                     // the strike itself
    var nf = ctx.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.setValueAtTime(base * 4, t); nf.Q.setValueAtTime(3, t);
    var ng = ctx.createGain();
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    env(ng, t, [[0.004, 0.05], [0.09, 0]]);
    n.start(t, noiseOffset()); n.stop(t + 0.2);
    emitNote("ambient", base, t, decay);
    return "resonance vessel";
  }
  // void chime: tiny high sine pings on the spectral harmonics.
  function evChime(t) {
    var count = rint(2, 4), tt = t;
    for (var i = 0; i < count; i++) {
      var f = harm(ambientHarm(1400, 3400));
      var o = ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(f, tt);
      var g = ctx.createGain();
      o.connect(g); g.connect(panAt("ambient", rnd(-0.5, 0.5)));
      env(g, tt, [[0.005, 0.045], [rnd(1, 2.4), 0]]);
      o.start(tt); o.stop(tt + 2.8);
      emitNote("ambient", f, tt, 1.5);
      tt += rnd(0.4, 1.6);
    }
    return "void chime";
  }
  // hull groan: the ship settling — a slow saw gliss through a resonant band.
  function evGroan(t) {
    var dur = rnd(4, 8);
    var down = chance(0.6);
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(down ? harm(3) : harm(2), t);
    o.frequency.linearRampToValueAtTime(down ? harm(2) : harm(3), t + dur);
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(rnd(130, 250), t); f.Q.setValueAtTime(rnd(6, 10), t);
    var g = ctx.createGain();
    o.connect(f); f.connect(g); g.connect(panAt("ambient", rnd(-0.2, 0.2)));
    env(g, t, [[dur * 0.45, 0.09], [dur * 0.55, 0]]);
    o.start(t); o.stop(t + dur + 0.2);
    emitNote("ambient", 0, t, dur);                            // a gliss owns no single pitch
    return "hull groan";
  }
  // distant transmission: another vessel, far away — a kangling-like call and a
  // damaru rattle behind a narrow band of static.
  function evTransmission(t) {
    var dest = panAt("ambient", pick([-0.6, 0.6]));
    var f = harm(rint(12, 16));
    var o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f, t);
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.setValueAtTime(rnd(850, 1050), t); bp.Q.setValueAtTime(12, t);
    var g = ctx.createGain();
    o.connect(bp); bp.connect(g); g.connect(dest);
    env(g, t, [[0.3, 0.035], [0.6, 0.012], [0.25, 0.03], [0.9, 0]]);
    o.start(t); o.stop(t + 2.3);
    var ticks = rint(3, 5);
    for (var i = 0; i < ticks; i++) {
      var tt = t + 0.4 + rng() * 1.4;
      var n = noiseSource();
      var nf = ctx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.setValueAtTime(rnd(1500, 2500), tt); nf.Q.setValueAtTime(6, tt);
      var ng = ctx.createGain();
      n.connect(nf); nf.connect(ng); ng.connect(dest);
      env(ng, tt, [[0.003, 0.018], [0.04, 0]]);
      n.start(tt, noiseOffset()); n.stop(tt + 0.1);
    }
    emitNote("ambient", f, t, 2.2);
    return "distant transmission";
  }
  // comet dust: sparse high ticks against the hull.
  function evComet(t) {
    var span = rnd(1, 3), ticks = rint(3, 8);
    for (var i = 0; i < ticks; i++) {
      var tt = t + rng() * span;
      var n = noiseSource();
      var hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.setValueAtTime(rnd(6000, 9000), tt);
      var g = ctx.createGain();
      n.connect(hp); hp.connect(g); g.connect(panAt("ambient", rnd(-0.6, 0.6)));
      env(g, tt, [[0.002, 0.03 * rnd(0.5, 1)], [0.015, 0]]);
      n.start(tt, noiseOffset()); n.stop(tt + 0.08);
    }
    emitNote("ambient", 0, t, span);
    return "comet dust";
  }
  // breath of the nave: the room inhales.
  function evNaveBreath(t) {
    var dur = rnd(6, 12);
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(rnd(220, 420), t);
    var g = ctx.createGain();
    n.connect(f); f.connect(g); g.connect(panAt("ambient", 0));
    env(g, t, [[dur * 0.5, 0.08], [dur * 0.5, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.2);
    emitNote("ambient", 0, t, dur);
    return "breath of the nave";
  }
  // mani telemetry: the ship's prayer-counter — soft square blips in sixes.
  function evMani(t) {
    var f = harm(ambientHarm(500, 1100));
    var groups = chance(0.4) ? 2 : 1, tt = t;
    for (var gI = 0; gI < groups; gI++) {
      var ioi = rnd(0.11, 0.18);
      for (var i = 0; i < 6; i++) {
        var o = ctx.createOscillator();
        o.type = "square"; o.frequency.setValueAtTime(f, tt);
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 2.5, tt);
        var g = ctx.createGain();
        o.connect(lp); lp.connect(g); g.connect(panAt("ambient", 0.35));
        env(g, tt, [[0.004, 0.03], [0.05, 0]]);
        o.start(tt); o.stop(tt + 0.09);
        tt += ioi;
      }
      tt += rnd(0.6, 1);
    }
    emitNote("ambient", f, t, tt - t);
    return "mani telemetry";
  }
  function ambientEvent() {
    if (!playing) return;
    if (C.section === "dedication" || inHush()) { scheduleRaw(ambientEvent, 6000); return; }
    var fn = pickW([
      [evPrayerWheel, 4], [evWindHorse, 4], [evVessel, 3], [evChime, 3],
      [evGroan, 2], [evTransmission, 2], [evComet, 3], [evNaveBreath, 3], [evMani, 2],
    ]);
    var name = fn(ctx.currentTime + 0.1);
    emitEvent({ cat: "ambient", label: "⋆ " + name, detail: C.section + " · " + C.activity });
    var gap = rnd(14, 40) * (1.15 - intensity() * 0.35);
    scheduleLayer(ambientEvent, gap * 1000, "ambient");
  }

  // ==========================================================================
  // SAMPLE — one short isolated gesture per layer, playable while stopped
  // (the museum-card audition: touch an instrument, hear it alone).
  // ==========================================================================
  function sample(layer) {
    init();
    if (!SCALE.length) rebuildScale();
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    var t = ctx.currentTime + 0.08;
    switch (layer) {
      case "hull": {
        var dest = panAt("hull", 0);
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.setValueAtTime(260, t);
        var og = ctx.createGain();
        lp.connect(og); og.connect(dest);
        for (var v = 0; v < 2; v++) {
          var o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(F0 * 2 * (1 + (v ? 0.003 : -0.003)), t);
          o.connect(lp); o.start(t); o.stop(t + 6.3);
        }
        var sub = ctx.createOscillator();
        sub.type = "sine"; sub.frequency.setValueAtTime(F0, t);
        var sg = ctx.createGain(); sg.gain.setValueAtTime(0.5, t);
        sub.connect(sg); sg.connect(og);
        sub.start(t); sub.stop(t + 6.3);
        env(og, t, [[2.4, 0.22], [1.2, 0.2], [2.4, 0]]);
        emitNote("hull", F0 * 2, t, 6);
        break;
      }
      case "chant": {
        var m = { kind: "contour", name: "SAMPLE", gen: 0, chain: [], points: [{ t: 0, h: 4 }, { t: 0.55, h: 5 }, { t: 1, h: 4 }] };
        chantMonk(t, 5, m, 0, 0.55, 0.6, 0, 1);
        emitNote("chant", harm(4), t, 5);
        break;
      }
      case "murmur": murmurRender(t, 3); break;
      case "dungchen":
        dungchenSwell(t, 5, harm(3), "rgyang", 0, 0);
        emitNote("dungchen", harm(3), t, 5);
        break;
      case "gyaling": {
        var ki = scaleIndexOf(2);
        renderGyalingVoice(t, [{ f: SCALE[ki].freq, fUp: SCALE[Math.min(SCALE.length - 1, ki + 1)].freq, dur: 2.4 }], 0, 0, true, true);
        break;
      }
      case "dungkar": {
        var fk = harm(dungkarFoldHarm());
        dungkarTone(t, 8, fk, 2.5);
        emitNote("dungkar", fk, t, 8);
        break;
      }
      case "kangling":
        kanglingNote(t, 0.4, harm(14), 800, 980);
        kanglingNote(t + 0.5, 0.55, harm(11), 800, 980);
        emitNote("kangling", harm(14), t, 0.4);
        emitNote("kangling", harm(11), t + 0.5, 0.55);
        break;
      case "umdze": cymbalStroke(t, { gain: 0.6, open: true }); break;
      case "floor":
        damaruSnap(t, 0.3); damaruSnap(t + 0.05, 0.22);
        drilbuBell(t + 0.5, 0.8);
        break;
      case "noise": dustDrift(t, 6, 0.1); break;
      case "ambient": evVessel(t); break;
      default: return;
    }
    emitEvent({ cat: "transport", label: "◈ sample " + layer, detail: "" });
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (playing) return;
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    playing = true;
    planCeremony();
    // staggered assembly — the sound-world builds like the generation stage it is
    hullCycle();
    scheduleRaw(damaruCycle, 4000);
    scheduleRaw(drilbuCycle, 9000);
    scheduleRaw(chantPhrase, 7000);
    scheduleRaw(murmurPhrase, 12000);
    scheduleRaw(ambientEvent, 15000);
    scheduleRaw(dungkarCycle, 18000);
    scheduleRaw(noiseCycle, 20000);
    scheduleRaw(gyalingPhrase, 25000);
    scheduleRaw(dungchenPhrase, 35000);
    scheduleRaw(kanglingCycle, 40000);      // gates itself: wrathful + intensity only
    scheduleRaw(conductorTick, 1000);
    emitEvent({ cat: "transport", label: "▶ the ritual engine wakes", detail: "seed " + seed });
  }
  function stop() {
    playing = false;
    clearAllTimers();
    if (masterGain && ctx) {
      var t = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value || masterVolume, t);
      masterGain.gain.linearRampToValueAtTime(0, t + 0.6);
      scheduleForStop();
    }
    emitEvent({ cat: "transport", label: "■ stilled", detail: "" });
  }
  function scheduleForStop() {
    setTimeout(function () {
      if (!playing && masterGain && ctx) masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }, 800);
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  return {
    init: init,
    play: play,
    stop: stop,
    isPlaying: function () { return playing; },
    sample: sample,
    setMasterVolume: function (v) { masterVolume = v; if (masterGain && ctx && playing) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setLayerVolume: function (layer, v) { layerVolumes[layer] = v; if (ctx) applyLayerGain(layer); },
    toggleLayer: function (layer) { layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return !layerMuted[layer]; },
    setLayerRate: function (layer, r) { layerRate[layer] = r; },
    setLayerParam: function (layer, key, v) { if (!layerParams[layer]) layerParams[layer] = {}; layerParams[layer][key] = v; },
    getLayerParam: getLayerParam,
    getLayerDefaults: function () { return JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS)); },
    getLayers: function () { return LAYERS.slice(); },
    getVolumes: function () { return JSON.parse(JSON.stringify(layerVolumes)); },
    getSeed: function () { return seed; },
    reseed: function (s) { seed = (s >>> 0) || 108; rngState = seed; },
    getConductor: function () {
      return {
        ceremony: C.ceremony, section: C.section, activity: C.activity,
        local: localArc(), intensity: intensity(),
        tutti: inTutti(), hush: inHush(),
        f0: F0, rotation: ROTATION_NAMES[rotation], spectral: spectral.slice(),
        sectionIndex: C.si, planLength: C.plan.length,
      };
    },
    getMotifStats: function () { return Motif.stats(); },
    setNoteListener: function (fn) { noteListeners.push(fn); },
    setEventListener: function (fn) { eventListeners.push(fn); },
    attachAnalyser: function () {
      if (!ctx || !masterGain) return null;
      var an = ctx.createAnalyser(); an.fftSize = 1024;
      masterGain.connect(an);
      return an;
    },
  };
})();
