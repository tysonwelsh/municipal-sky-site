// ============================================================================
// BAGPIPE LAB — timbre workbench for a candidate KOLOB voice.
//
// The GOAL is the SOUND of the instrument — a reedy, textured, buzzing voice to
// sit against Kolob's smooth organs and drones — NOT the Highland-bagpipe idiom
// (the fixed pipe scale, the jig, the grace-note flicks). So the audition
// harness speaks Kolob's own musical language:
//   · pitches are DEGREES of Kolob's modal COLLECTIONS in 5-limit JUST
//     INTONATION over a fixed tonic (F0), the melodic root at F0*4 (~260 Hz);
//   · the demo line is a slow, stepwise HYMN phrase that rests on do/mi/sol
//     with breath at the end — not a reel;
//   · a plagal IV->I ("amen") chord auditions the reed as HARMONY.
//
// What's copied in a patch is PURE TIMBRE (reed wave, buzz, formants, breath,
// motion, drone, envelope). Mode and tonic are audition context, not part of
// the voice — Kolob supplies those at runtime. The timbre vocabulary mirrors
// kolob-audio.js so a dialed-in patch drops straight into a KolobAudio voice.
//
// Public surface: window.BagpipeLab
// ============================================================================
window.BagpipeLab = (function () {
  "use strict";

  // ==========================================================================
  // KOLOB TUNING — mirrored from kolob-audio.js. 5-limit JI over a fixed tonic.
  //   degFreq(i) = F0 * ROOT_MULT * ratios[degree] * 2^octave
  // ==========================================================================
  var COLLECTIONS = {
    ionian:     [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
    mixolydian: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 16 / 9],
    dorian:     [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 16 / 9],
    aeolian:    [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 16 / 9],
    penta:      [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
    hexa:       [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3],
  };
  var MODES = Object.keys(COLLECTIONS);
  var ROOT_MULT = 4;

  var tonic = 65, mode = "ionian";                 // audition context, not timbre
  function ratios() { return COLLECTIONS[mode]; }
  function melodicRoot() { return tonic * ROOT_MULT; }
  function degFreq(i) {
    var r = ratios(), n = r.length;
    var oct = Math.floor(i / n), d = ((i % n) + n) % n;
    return tonic * ROOT_MULT * r[d] * Math.pow(2, oct);
  }
  // Two octaves of the collection above the melodic root — the audition keyboard.
  function noteList() {
    var r = ratios(), n = r.length, out = [];
    for (var i = 0; i <= 2 * n; i++) {
      var d = ((i % n) + n) % n;
      out.push({ idx: i, deg: d, oct: Math.floor(i / n), freq: degFreq(i) });
    }
    return out;
  }

  // ==========================================================================
  // TIMBRE PARAMETER SCHEMA — the copied patch. Pure instrument sound.
  // ==========================================================================
  var PARAMS = [
    // ----- Reed & tone -----
    { key: "reedWave", label: "Reed wave", group: "Reed & tone", kind: "select", def: "saw",
      options: [["saw", "sawtooth (bright, all harmonics)"], ["square", "square (hollow)"],
                ["pulse", "pulse (nasal, tunable width)"], ["rich", "rich reed (brightest)"]],
      structural: true, hint: "The raw reed spectrum before the formants shape it." },
    { key: "pulseWidth", label: "Pulse width", group: "Reed & tone", kind: "range",
      min: 0.05, max: 0.95, step: 0.01, unit: "", def: 0.5, structural: true,
      hint: "Only for the pulse wave — narrow = thin & nasal, 0.5 = square." },
    { key: "reedDetune", label: "Reed beat", group: "Reed & tone", kind: "range",
      min: 0, max: 18, step: 0.5, unit: "¢", def: 7,
      hint: "Two chanter reeds detuned against each other. The shimmer of a real reed." },
    { key: "buzz", label: "Reed buzz / grit", group: "Reed & tone", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.4,
      hint: "Waveshaping edge — the rasp that gives the sound its texture." },
    { key: "bright", label: "Brightness", group: "Reed & tone", kind: "range",
      min: 400, max: 6500, step: 50, unit: "Hz", def: 4600,
      hint: "Final lowpass on the reed. Lower = mellower, darker." },
    { key: "reedLevel", label: "Reed level", group: "Reed & tone", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.7,
      hint: "Loudness of the reed against the drone backdrop." },

    // ----- Formants -----
    { key: "f1", label: "Formant 1", group: "Formants (nasal color)", kind: "range",
      min: 500, max: 3500, step: 25, unit: "Hz", def: 2400,
      hint: "The main resonant peak — the vowel-like body of the reed." },
    { key: "f1Q", label: "Formant 1 sharpness", group: "Formants (nasal color)", kind: "range",
      min: 0.5, max: 16, step: 0.1, unit: "Q", def: 6,
      hint: "How narrow/vocal that peak is. High = pinched & nasal." },
    { key: "f1Gain", label: "Formant 1 amount", group: "Formants (nasal color)", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.8, hint: "Weight of the first formant." },
    { key: "f2", label: "Formant 2", group: "Formants (nasal color)", kind: "range",
      min: 1200, max: 5200, step: 25, unit: "Hz", def: 3600,
      hint: "Upper resonance — the bright ring on top." },
    { key: "f2Q", label: "Formant 2 sharpness", group: "Formants (nasal color)", kind: "range",
      min: 0.5, max: 16, step: 0.1, unit: "Q", def: 7, hint: "Sharpness of the upper peak." },
    { key: "f2Gain", label: "Formant 2 amount", group: "Formants (nasal color)", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.55, hint: "Weight of the second formant." },
    { key: "dryTilt", label: "Dry body", group: "Formants (nasal color)", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.5,
      hint: "How much raw reed bypasses the formants — keeps the fundamental full." },

    // ----- Breath & motion -----
    { key: "breath", label: "Breath texture", group: "Breath & motion", kind: "range",
      min: 0, max: 0.5, step: 0.005, unit: "", def: 0.14,
      hint: "Filtered air noise mixed in — the grain the smooth organs lack." },
    { key: "breathColor", label: "Breath color", group: "Breath & motion", kind: "range",
      min: 400, max: 6500, step: 50, unit: "Hz", def: 3200,
      hint: "Where the air noise sits — low = hiss/rush, high = whistle." },
    { key: "vibRate", label: "Vibrato rate", group: "Breath & motion", kind: "range",
      min: 0, max: 8, step: 0.1, unit: "Hz", def: 0, hint: "Speed of pitch vibrato." },
    { key: "vibDepth", label: "Vibrato depth", group: "Breath & motion", kind: "range",
      min: 0, max: 45, step: 1, unit: "¢", def: 0, hint: "Amount of pitch vibrato." },
    { key: "pressure", label: "Bag pressure sway", group: "Breath & motion", kind: "range",
      min: 0, max: 0.35, step: 0.01, unit: "", def: 0.06,
      hint: "Slow loudness wobble — the living unsteadiness of a squeezed bag." },
    { key: "grace", label: "Grace flick (optional)", group: "Breath & motion", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0,
      hint: "The Highland-pipe blip on note changes. Off by default — Kolob phrases smoothly." },
    { key: "gliss", label: "Note glide", group: "Breath & motion", kind: "range",
      min: 0.005, max: 0.14, step: 0.005, unit: "s", def: 0.03,
      hint: "Portamento time between notes. Short = crisp, long = smeary." },

    // ----- Drone backdrop -----
    { key: "droneVoicing", label: "Drone voicing", group: "Drone backdrop (audition)", kind: "select",
      def: "tonic+octave", structural: true,
      options: [["none", "no drone"], ["tonic", "single tenor"], ["tonic+octave", "bass + tenor"],
                ["tonic+fifth", "tenor + fifth"], ["bass+2tenor", "bass + 2 tenors"]],
      hint: "A held ground to hear the reed in context. Kolob has its own drone layer." },
    { key: "droneLevel", label: "Drone level", group: "Drone backdrop (audition)", kind: "range",
      min: 0, max: 1, step: 0.01, unit: "", def: 0.4, hint: "Loudness of the drone bank." },
    { key: "droneDetune", label: "Drone beat", group: "Drone backdrop (audition)", kind: "range",
      min: 0, max: 25, step: 0.5, unit: "¢", def: 8,
      hint: "Detuning between drones — the slow beating that makes them breathe." },
    { key: "droneBuzz", label: "Drone grit", group: "Drone backdrop (audition)", kind: "range",
      min: 0, max: 0.6, step: 0.01, unit: "", def: 0.12, hint: "Waveshaping edge on the drones." },
    { key: "droneBright", label: "Drone brightness", group: "Drone backdrop (audition)", kind: "range",
      min: 150, max: 2500, step: 25, unit: "Hz", def: 800,
      hint: "Lowpass on the drones. Low = a warm hum, high = a reedy buzz." },

    // ----- Envelope -----
    { key: "attack", label: "Reed attack", group: "Envelope", kind: "range",
      min: 0.005, max: 0.6, step: 0.005, unit: "s", def: 0.08, hint: "Fade-in when the reed starts." },
    { key: "release", label: "Reed release", group: "Envelope", kind: "range",
      min: 0.02, max: 1.2, step: 0.01, unit: "s", def: 0.25, hint: "Fade-out when the reed stops." },
  ];

  // ==========================================================================
  // PRESETS — four reed CHARACTERS (pure timbre; mode/tonic chosen separately).
  // ==========================================================================
  var PRESETS = [
    { name: "Reedy organ", desc: "Bright & buzzing but blended — a reed that sits in the congregation.",
      p: { reedWave: "saw", pulseWidth: 0.5, reedDetune: 7, buzz: 0.4, bright: 4600, reedLevel: 0.7,
           f1: 2400, f1Q: 6, f1Gain: 0.8, f2: 3600, f2Q: 7, f2Gain: 0.55, dryTilt: 0.5,
           breath: 0.14, breathColor: 3200, vibRate: 0, vibDepth: 0, pressure: 0.06, grace: 0, gliss: 0.03,
           droneVoicing: "tonic+octave", droneLevel: 0.4, droneDetune: 8, droneBuzz: 0.12, droneBright: 800,
           attack: 0.08, release: 0.25 } },
    { name: "Soft reed", desc: "Mellow, warm, close — a parlor-harmonium cousin with a little grain.",
      p: { reedWave: "saw", pulseWidth: 0.5, reedDetune: 5, buzz: 0.12, bright: 2100, reedLevel: 0.62,
           f1: 1500, f1Q: 4, f1Gain: 0.7, f2: 2600, f2Q: 4, f2Gain: 0.4, dryTilt: 0.6,
           breath: 0.07, breathColor: 2200, vibRate: 0, vibDepth: 0, pressure: 0.05, grace: 0, gliss: 0.04,
           droneVoicing: "tonic", droneLevel: 0.32, droneDetune: 6, droneBuzz: 0.05, droneBright: 600,
           attack: 0.12, release: 0.4 } },
    { name: "Vocal reed", desc: "Sweeter and vowel-like, a touch of vibrato — nearly a voice.",
      p: { reedWave: "pulse", pulseWidth: 0.5, reedDetune: 3, buzz: 0.18, bright: 3200, reedLevel: 0.66,
           f1: 1100, f1Q: 3.5, f1Gain: 0.8, f2: 2500, f2Q: 5, f2Gain: 0.45, dryTilt: 0.45,
           breath: 0.05, breathColor: 1800, vibRate: 5, vibDepth: 12, pressure: 0.08, grace: 0, gliss: 0.05,
           droneVoicing: "tonic+fifth", droneLevel: 0.3, droneDetune: 5, droneBuzz: 0.08, droneBright: 700,
           attack: 0.1, release: 0.5 } },
    { name: "Frontier grit", desc: "Gutsy and coarse — maximum reedy texture for the open air.",
      p: { reedWave: "saw", pulseWidth: 0.5, reedDetune: 10, buzz: 0.55, bright: 3900, reedLevel: 0.7,
           f1: 2000, f1Q: 8, f1Gain: 0.85, f2: 3200, f2Q: 8, f2Gain: 0.6, dryTilt: 0.4,
           breath: 0.2, breathColor: 3600, vibRate: 2, vibDepth: 6, pressure: 0.1, grace: 0, gliss: 0.03,
           droneVoicing: "bass+2tenor", droneLevel: 0.5, droneDetune: 13, droneBuzz: 0.25, droneBright: 1000,
           attack: 0.09, release: 0.3 } },
  ];

  // ==========================================================================
  // STATE
  // ==========================================================================
  var params = {};
  PARAMS.forEach(function (d) { params[d.key] = d.def; });

  var ctx = null;
  var running = false, droneOn = true, masterVol = 0.55;
  var curIdx = 0;                                   // current degree index
  var noiseBuf = null;
  var N = {};                                        // node registry
  var seqTimer = null;

  // ==========================================================================
  // AUDIO HELPERS
  // ==========================================================================
  function makeNoise() {
    var len = 2 * ctx.sampleRate;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function shaperCurve(amount) {
    var n = 1024, c = new Float32Array(n), k = 3 + amount * 12, i, x;
    for (i = 0; i < n; i++) {
      x = (i / (n - 1)) * 2 - 1;
      c[i] = (1 - amount) * x + amount * (Math.tanh(k * x) / Math.tanh(k));
    }
    return c;
  }
  function pulseWave(width) {
    var H = 42, real = new Float32Array(H + 1), imag = new Float32Array(H + 1), n;
    for (n = 1; n <= H; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * width);
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  function reedWaveTable() {
    var H = 34, real = new Float32Array(H + 1), imag = new Float32Array(H + 1), n;
    for (n = 1; n <= H; n++) imag[n] = 1 / Math.pow(n, 0.82);
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  function setReedType(osc) {
    if (params.reedWave === "pulse") osc.setPeriodicWave(pulseWave(params.pulseWidth));
    else if (params.reedWave === "rich") osc.setPeriodicWave(reedWaveTable());
    else osc.type = params.reedWave === "saw" ? "sawtooth" : params.reedWave;
  }

  // The timbre chain shared by the persistent reed and by transient chord
  // voices: waveshaper "buzz" -> dry body + two bandpass formants -> brightness.
  function makeTimbreChain() {
    var shaper = ctx.createWaveShaper(); shaper.curve = shaperCurve(params.buzz);
    var mix = ctx.createGain();
    var dry = ctx.createGain(); dry.gain.value = params.dryTilt;
    shaper.connect(dry); dry.connect(mix);
    var bp1 = ctx.createBiquadFilter(); bp1.type = "bandpass";
    bp1.frequency.value = params.f1; bp1.Q.value = params.f1Q;
    var g1 = ctx.createGain(); g1.gain.value = params.f1Gain;
    shaper.connect(bp1); bp1.connect(g1); g1.connect(mix);
    var bp2 = ctx.createBiquadFilter(); bp2.type = "bandpass";
    bp2.frequency.value = params.f2; bp2.Q.value = params.f2Q;
    var g2 = ctx.createGain(); g2.gain.value = params.f2Gain;
    shaper.connect(bp2); bp2.connect(g2); g2.connect(mix);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = params.bright;
    mix.connect(lp);
    return { in: shaper, out: lp, shaper: shaper, dry: dry, bp1: bp1, g1: g1, bp2: bp2, g2: g2, lp: lp };
  }

  // ==========================================================================
  // GRAPH
  // ==========================================================================
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = makeNoise();
  }

  function buildChanter() {
    var t = ctx.currentTime;
    var osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
    setReedType(osc1); setReedType(osc2);
    var f = degFreq(curIdx);
    osc1.frequency.setValueAtTime(f, t); osc2.frequency.setValueAtTime(f, t);
    osc1.detune.setValueAtTime(-params.reedDetune / 2, t);
    osc2.detune.setValueAtTime(params.reedDetune / 2, t);
    var oscMix = ctx.createGain(); oscMix.gain.value = 0.5;
    osc1.connect(oscMix); osc2.connect(oscMix);

    var chain = makeTimbreChain(); oscMix.connect(chain.in);
    var lvl = ctx.createGain(); lvl.gain.value = 0;
    chain.out.connect(lvl); lvl.connect(N.reedBus);

    var vib = ctx.createOscillator(); vib.frequency.value = params.vibRate;
    var vibG = ctx.createGain(); vibG.gain.value = params.vibDepth;
    vib.connect(vibG); vibG.connect(osc1.detune); vibG.connect(osc2.detune);

    osc1.start(); osc2.start(); vib.start();
    N.chanter = { osc1: osc1, osc2: osc2, lvl: lvl, vib: vib, vibG: vibG, chain: chain };
  }

  // A short-lived reed voice at a fixed pitch — used to stack chord tones.
  function spawnReedVoice(freq, t, dur, peak) {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    setReedType(o1); setReedType(o2);
    o1.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq, t);
    o1.detune.setValueAtTime(-params.reedDetune / 2, t);
    o2.detune.setValueAtTime(params.reedDetune / 2, t);
    var oscMix = ctx.createGain(); oscMix.gain.value = 0.5;
    o1.connect(oscMix); o2.connect(oscMix);
    var chain = makeTimbreChain(); oscMix.connect(chain.in);
    var g = ctx.createGain(); g.gain.value = 0; chain.out.connect(g); g.connect(N.reedBus);
    var a = 0.14, r = Math.min(0.6, dur * 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + r);
    o1.start(t); o2.start(t); o1.stop(t + dur + r + 0.1); o2.stop(t + dur + r + 0.1);
  }

  // Drone frequencies keyed to the melodic root (F0*4) — one/two octaves down,
  // matching Kolob's low harmonic register (F0, 2·F0).
  function droneSpec() {
    var root = melodicRoot();
    switch (params.droneVoicing) {
      case "none":         return [];
      case "tonic":        return [[root / 2, 0]];
      case "tonic+fifth":  return [[root / 2, -1], [root / 2 * 1.5, 1]];
      case "bass+2tenor":  return [[root / 4, 0], [root / 2, -1], [root / 2, 1]];
      case "tonic+octave":
      default:             return [[root / 4, -1], [root / 2, 1]];
    }
  }
  function buildDrones() {
    var spec = droneSpec();
    var shaper = ctx.createWaveShaper(); shaper.curve = shaperCurve(params.droneBuzz);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = params.droneBright;
    shaper.connect(lp); lp.connect(N.droneMaster);
    var voices = [];
    spec.forEach(function (s) {
      var o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.value = s[0]; o.detune.value = s[1] * params.droneDetune;
      var g = ctx.createGain(); g.gain.value = spec.length ? 0.8 / spec.length : 0;
      o.connect(g); g.connect(shaper); o.start();
      voices.push({ osc: o, gain: g, sign: s[1] });
    });
    N.drones = { voices: voices, shaper: shaper, lp: lp };
  }

  function build() {
    ensureCtx();
    var t = ctx.currentTime;
    N.master = ctx.createGain(); N.master.gain.value = masterVol;
    N.comp = ctx.createDynamicsCompressor();
    N.comp.threshold.value = -14; N.comp.ratio.value = 3; N.comp.knee.value = 6;
    N.mixBus = ctx.createGain();

    N.reedBus = ctx.createGain();
    N.ampMod = ctx.createGain(); N.ampMod.gain.value = 1;
    N.press = ctx.createOscillator(); N.press.frequency.value = 0.3;
    N.pressG = ctx.createGain(); N.pressG.gain.value = params.pressure;
    N.press.connect(N.pressG); N.pressG.connect(N.ampMod.gain); N.press.start();
    N.reedBus.connect(N.ampMod); N.ampMod.connect(N.mixBus);

    N.noise = ctx.createBufferSource(); N.noise.buffer = noiseBuf; N.noise.loop = true;
    N.breathBP = ctx.createBiquadFilter(); N.breathBP.type = "bandpass";
    N.breathBP.frequency.value = params.breathColor; N.breathBP.Q.value = 1.4;
    N.breathG = ctx.createGain(); N.breathG.gain.value = 0;
    N.noise.connect(N.breathBP); N.breathBP.connect(N.breathG); N.breathG.connect(N.reedBus);
    N.noise.start();

    N.droneMaster = ctx.createGain(); N.droneMaster.gain.value = 0;
    N.droneMaster.connect(N.mixBus);

    N.mixBus.connect(N.comp); N.comp.connect(N.master); N.master.connect(ctx.destination);

    buildChanter();
    buildDrones();

    var a = params.attack;
    N.chanter.lvl.gain.setValueAtTime(0, t);
    N.chanter.lvl.gain.linearRampToValueAtTime(params.reedLevel, t + a);
    N.breathG.gain.setValueAtTime(0, t);
    N.breathG.gain.linearRampToValueAtTime(params.breath, t + a);
    N.droneMaster.gain.setValueAtTime(0, t);
    N.droneMaster.gain.linearRampToValueAtTime(droneOn ? params.droneLevel : 0, t + a);
  }

  function teardownDrones() {
    if (!N.drones) return;
    N.drones.voices.forEach(function (v) { try { v.osc.stop(); } catch (e) {} });
    N.drones = null;
  }

  function stopAll() {
    if (!ctx || !running) return;
    running = false;
    var t = ctx.currentTime, r = params.release;
    if (N.chanter) N.chanter.lvl.gain.setTargetAtTime(0, t, r / 3);
    if (N.breathG) N.breathG.gain.setTargetAtTime(0, t, r / 3);
    if (N.droneMaster) N.droneMaster.gain.setTargetAtTime(0, t, r / 3);
    var chanter = N.chanter, drones = N.drones, press = N.press, noise = N.noise;
    setTimeout(function () {
      try { if (press) press.stop(); if (noise) noise.stop(); } catch (e) {}
      if (chanter) { try { chanter.osc1.stop(); chanter.osc2.stop(); chanter.vib.stop(); } catch (e) {} }
      if (drones) drones.voices.forEach(function (v) { try { v.osc.stop(); } catch (e) {} });
      N = {};
    }, r * 1000 + 400);
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
  }

  function start() {
    ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (running) return;
    running = true;
    build();
  }

  // ==========================================================================
  // NOTES / PHRASES — Kolob's degrees, not the pipe scale.
  // ==========================================================================
  function playNote(idx) {
    curIdx = idx;
    if (!running || !N.chanter) return;
    var t = ctx.currentTime, f = degFreq(idx), gliss = params.gliss;
    [N.chanter.osc1, N.chanter.osc2].forEach(function (o) {
      o.frequency.cancelScheduledValues(t);
      var cur = Math.max(20, o.frequency.value);
      if (params.grace > 0.02) {
        var gf = degFreq(idx + 2);                 // an upper-neighbor flick, in-mode
        var gd = 0.012 + params.grace * 0.05;
        o.frequency.setValueAtTime(cur, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, gf), t + gd * 0.5);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f), t + gd + gliss);
      } else {
        o.frequency.setValueAtTime(cur, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f), t + gliss);
      }
    });
  }

  // A slow, stepwise HYMN line that rests on do/mi/sol with breath at the end —
  // Kolob's phrasing, sounded by the reed. Degrees, with per-note beats.
  function playHymnLine() {
    if (!running) start();
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
    // [degreeIndex, beats] — antecedent, breath, consequent; ends on do.
    var line = [
      [0, 1], [1, 1], [2, 1], [3, 1], [2, 2], [4, 2],
      [0, 0], // breath (silent placeholder handled below via longer gap)
      [4, 1], [3, 1], [2, 1], [1, 1], [0, 3],
    ];
    var beat = 620, step = 0;
    (function next() {
      if (!running || step >= line.length) { seqTimer = null; return; }
      var e = line[step];
      if (e[1] === 0) { step++; seqTimer = setTimeout(next, beat * 1.4); return; } // breath
      playNote(e[0]);
      if (window.__bplHighlight) window.__bplHighlight(e[0]);
      var dur = e[1] * beat;
      step++;
      seqTimer = setTimeout(next, dur);
    })();
  }

  // A plagal IV -> I ("amen") cadence — Kolob's cadential gravity — sounded as
  // stacked reed voices so the timbre can be heard as HARMONY.
  function playChord() {
    if (!running) start();
    var t = ctx.currentTime + 0.05;
    var peak = params.reedLevel * 0.42;
    // duck the melodic reed while the chords ring, then restore
    if (N.chanter) {
      N.chanter.lvl.gain.setTargetAtTime(0, t, 0.05);
      N.chanter.lvl.gain.setTargetAtTime(running ? params.reedLevel : 0, t + 4.2, 0.15);
    }
    var IV = [3, 5, 7], I = [0, 2, 4];             // triads by degree index
    IV.forEach(function (d) { spawnReedVoice(degFreq(d), t, 1.7, peak); });
    I.forEach(function (d) { spawnReedVoice(degFreq(d), t + 1.9, 2.2, peak); });
    if (window.__bplHighlight) window.__bplHighlight(0);
  }

  // ==========================================================================
  // LIVE PARAMETER UPDATES
  // ==========================================================================
  function setParam(key, value) {
    params[key] = value;
    if (!ctx || !running) return;
    var t = ctx.currentTime, c = N.chanter, d = N.drones, ch = c && c.chain;
    switch (key) {
      case "reedWave": case "pulseWidth": rebuildChanter(); break;
      case "reedDetune":
        if (c) { c.osc1.detune.setTargetAtTime(-value / 2, t, 0.02);
                 c.osc2.detune.setTargetAtTime(value / 2, t, 0.02); } break;
      case "buzz": if (ch) ch.shaper.curve = shaperCurve(value); break;
      case "bright": if (ch) ch.lp.frequency.setTargetAtTime(value, t, 0.03); break;
      case "reedLevel": if (c) c.lvl.gain.setTargetAtTime(value, t, 0.03); break;
      case "f1": if (ch) ch.bp1.frequency.setTargetAtTime(value, t, 0.03); break;
      case "f1Q": if (ch) ch.bp1.Q.setTargetAtTime(value, t, 0.03); break;
      case "f1Gain": if (ch) ch.g1.gain.setTargetAtTime(value, t, 0.03); break;
      case "f2": if (ch) ch.bp2.frequency.setTargetAtTime(value, t, 0.03); break;
      case "f2Q": if (ch) ch.bp2.Q.setTargetAtTime(value, t, 0.03); break;
      case "f2Gain": if (ch) ch.g2.gain.setTargetAtTime(value, t, 0.03); break;
      case "dryTilt": if (ch) ch.dry.gain.setTargetAtTime(value, t, 0.03); break;
      case "breath": if (N.breathG) N.breathG.gain.setTargetAtTime(value, t, 0.03); break;
      case "breathColor": if (N.breathBP) N.breathBP.frequency.setTargetAtTime(value, t, 0.03); break;
      case "vibRate": if (c) c.vib.frequency.setTargetAtTime(value, t, 0.05); break;
      case "vibDepth": if (c) c.vibG.gain.setTargetAtTime(value, t, 0.05); break;
      case "pressure": if (N.pressG) N.pressG.gain.setTargetAtTime(value, t, 0.05); break;
      case "droneVoicing": rebuildDrones(); break;
      case "droneLevel": if (N.droneMaster && droneOn) N.droneMaster.gain.setTargetAtTime(value, t, 0.05); break;
      case "droneDetune":
        if (d) d.voices.forEach(function (v) { v.osc.detune.setTargetAtTime(v.sign * value, t, 0.05); }); break;
      case "droneBuzz": if (d) d.shaper.curve = shaperCurve(value); break;
      case "droneBright": if (d) d.lp.frequency.setTargetAtTime(value, t, 0.03); break;
      // grace, gliss, attack, release: read at use-time.
    }
  }

  function rebuildChanter() {
    if (!ctx || !running || !N.chanter) return;
    var old = N.chanter, t = ctx.currentTime, lvl = params.reedLevel;
    old.lvl.gain.setTargetAtTime(0, t, 0.02);
    setTimeout(function () { try { old.osc1.stop(); old.osc2.stop(); old.vib.stop(); } catch (e) {} }, 120);
    buildChanter();
    N.chanter.lvl.gain.setValueAtTime(0, ctx.currentTime);
    N.chanter.lvl.gain.linearRampToValueAtTime(lvl, ctx.currentTime + 0.05);
  }
  function rebuildDrones() {
    if (!ctx || !running) return;
    teardownDrones();
    buildDrones();
    if (N.droneMaster) N.droneMaster.gain.setTargetAtTime(droneOn ? params.droneLevel : 0, ctx.currentTime, 0.05);
  }

  // ==========================================================================
  // TRANSPORT / CONTEXT / API
  // ==========================================================================
  function toggleDrone(on) {
    droneOn = on;
    if (ctx && running && N.droneMaster)
      N.droneMaster.gain.setTargetAtTime(on ? params.droneLevel : 0, ctx.currentTime, 0.05);
  }
  function setMaster(v) {
    masterVol = v;
    if (ctx && N.master) N.master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
  }
  function setTonic(hz) {
    tonic = hz;
    if (ctx && running) { playNote(curIdx); rebuildDrones(); }
  }
  function setMode(name) {
    if (!COLLECTIONS[name]) return;
    mode = name;
    // keep the same degree index; clamp if the new collection is smaller
    var n = ratios().length; if (curIdx > 2 * n) curIdx = 2 * n;
    if (ctx && running) playNote(curIdx);
  }
  function loadPreset(idx) {
    var pre = PRESETS[idx]; if (!pre) return;
    PARAMS.forEach(function (dsc) { if (pre.p[dsc.key] != null) params[dsc.key] = pre.p[dsc.key]; });
    if (ctx && running) {
      rebuildChanter(); rebuildDrones();
      Object.keys(params).forEach(function (k) { setParam(k, params[k]); });
      playNote(curIdx);
    }
  }

  return {
    PARAMS: PARAMS, PRESETS: PRESETS, MODES: MODES,
    params: params,
    start: start, stop: stopAll, isRunning: function () { return running; },
    playNote: playNote, playHymnLine: playHymnLine, playChord: playChord,
    setParam: setParam, getParam: function (k) { return params[k]; },
    toggleDrone: toggleDrone, setMaster: setMaster, loadPreset: loadPreset,
    setTonic: setTonic, setMode: setMode,
    getTonic: function () { return tonic; }, getMode: function () { return mode; },
    melodicRoot: melodicRoot, noteList: noteList, degFreq: degFreq,
  };
})();

// ============================================================================
// UI WIRING
// ============================================================================
(function () {
  "use strict";
  var B = window.BagpipeLab;
  if (!B) return;

  var reedBtn = document.getElementById("bpl-reed");
  var droneBtn = document.getElementById("bpl-drone");
  var lineBtn = document.getElementById("bpl-line");
  var chordBtn = document.getElementById("bpl-chord");
  var masterSl = document.getElementById("bpl-master");
  var modeSel = document.getElementById("bpl-mode");
  var tonicSl = document.getElementById("bpl-tonic");
  var tonicVal = document.getElementById("bpl-tonic-val");
  var presetsEl = document.getElementById("bpl-presets");
  var keysEl = document.getElementById("bpl-keys");
  var controlsEl = document.getElementById("bpl-controls");
  var jsonEl = document.getElementById("bpl-json");
  var copyBtn = document.getElementById("bpl-copy");
  var copyMsg = document.getElementById("bpl-copy-msg");
  var nameEl = document.getElementById("bpl-patch-name");

  var activePreset = -1;

  // ----- Transport -----
  reedBtn.addEventListener("click", function () {
    if (B.isRunning()) { B.stop(); reedBtn.textContent = "Start reed"; reedBtn.classList.remove("is-on"); }
    else { B.start(); reedBtn.textContent = "Stop reed"; reedBtn.classList.add("is-on"); }
  });
  var droneState = true;
  droneBtn.classList.add("is-on");
  droneBtn.addEventListener("click", function () {
    droneState = !droneState; B.toggleDrone(droneState);
    droneBtn.textContent = "Drone: " + (droneState ? "on" : "off");
    droneBtn.classList.toggle("is-on", droneState);
  });
  function ensureRunningUI() {
    if (!B.isRunning()) { reedBtn.textContent = "Stop reed"; reedBtn.classList.add("is-on"); }
  }
  lineBtn.addEventListener("click", function () { ensureRunningUI(); B.playHymnLine(); });
  chordBtn.addEventListener("click", function () { ensureRunningUI(); B.playChord(); });
  masterSl.addEventListener("input", function () { B.setMaster(this.value / 100); });

  // ----- Audition context: mode + tonic -----
  var MODE_LABEL = { ionian: "Ionian (major)", mixolydian: "Mixolydian", dorian: "Dorian",
                     aeolian: "Aeolian (minor)", penta: "Pentatonic", hexa: "Hexatonic (gapped)" };
  B.MODES.forEach(function (m) {
    var o = document.createElement("option"); o.value = m; o.textContent = MODE_LABEL[m] || m;
    modeSel.appendChild(o);
  });
  modeSel.value = B.getMode();
  modeSel.addEventListener("change", function () { B.setMode(this.value); buildKeys(); });
  tonicSl.value = B.getTonic();
  function tonicReadout() { tonicVal.textContent = B.getTonic() + " Hz  ·  root " + Math.round(B.melodicRoot()) + " Hz"; }
  tonicSl.addEventListener("input", function () { B.setTonic(parseInt(this.value, 10)); tonicReadout(); buildKeys(); });
  tonicReadout();

  // ----- Chanter keys (degrees of the current mode) -----
  var keyEls = [];
  function degLabel(nt) {
    var s = String(nt.deg + 1);
    if (nt.oct > 0) s = s + "˙";              // dot = upper octave
    return s;
  }
  function buildKeys() {
    keysEl.innerHTML = ""; keyEls = [];
    B.noteList().forEach(function (nt) {
      var k = document.createElement("button");
      k.type = "button"; k.className = "bpl-key";
      k.innerHTML = degLabel(nt) + "<small>" + Math.round(nt.freq) + " Hz</small>";
      k.addEventListener("click", function () {
        ensureRunningUI(); if (!B.isRunning()) B.start();
        B.playNote(nt.idx); highlight(nt.idx);
      });
      keysEl.appendChild(k); keyEls.push({ el: k, idx: nt.idx });
    });
  }
  function highlight(idx) {
    keyEls.forEach(function (k) { k.el.classList.toggle("is-playing", k.idx === idx); });
  }
  window.__bplHighlight = highlight;
  buildKeys();

  // ----- Controls grid -----
  var inputs = {};
  var groups = {}, order = [];
  B.PARAMS.forEach(function (d) {
    if (!groups[d.group]) { groups[d.group] = []; order.push(d.group); }
    groups[d.group].push(d);
  });
  order.forEach(function (gname) {
    var title = document.createElement("p");
    title.className = "bpl-sec-title"; title.textContent = gname;
    controlsEl.appendChild(title);
    var grid = document.createElement("div"); grid.className = "bpl-grid";
    controlsEl.appendChild(grid);
    groups[gname].forEach(function (d) {
      var ctl = document.createElement("div"); ctl.className = "bpl-ctl";
      var top = document.createElement("div"); top.className = "bpl-ctl-top";
      var lab = document.createElement("span"); lab.className = "bpl-ctl-label"; lab.textContent = d.label;
      var val = document.createElement("span"); val.className = "bpl-ctl-val";
      top.appendChild(lab); top.appendChild(val); ctl.appendChild(top);
      var input;
      if (d.kind === "select") {
        input = document.createElement("select");
        d.options.forEach(function (o) {
          var opt = document.createElement("option"); opt.value = o[0]; opt.textContent = o[1]; input.appendChild(opt);
        });
        input.value = B.getParam(d.key);
        input.addEventListener("change", function () {
          B.setParam(d.key, this.value); val.textContent = shortOpt(d, this.value); markDirty(); writeJSON();
        });
        val.textContent = shortOpt(d, input.value);
      } else {
        input = document.createElement("input");
        input.type = "range"; input.min = d.min; input.max = d.max; input.step = d.step;
        input.value = B.getParam(d.key);
        input.addEventListener("input", function () {
          var v = parseFloat(this.value); B.setParam(d.key, v); val.textContent = fmt(v, d); markDirty(); writeJSON();
        });
        val.textContent = fmt(parseFloat(input.value), d);
      }
      ctl.appendChild(input);
      var hint = document.createElement("span"); hint.className = "bpl-ctl-hint"; hint.textContent = d.hint;
      ctl.appendChild(hint); grid.appendChild(ctl);
      inputs[d.key] = { input: input, val: val, def: d };
    });
  });

  function shortOpt(d, v) {
    var o = d.options.filter(function (x) { return x[0] === v; })[0];
    return o ? o[1].split(" ")[0] : v;
  }
  function fmt(v, d) {
    var s = (d.step < 1) ? (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)) : String(Math.round(v));
    return s + (d.unit ? " " + d.unit : "");
  }
  function markDirty() {
    if (activePreset >= 0) {
      activePreset = -1;
      Array.prototype.forEach.call(presetsEl.children, function (c) { c.classList.remove("is-active"); });
    }
  }
  function syncControls() {
    B.PARAMS.forEach(function (d) {
      var rec = inputs[d.key]; if (!rec) return;
      var v = B.getParam(d.key); rec.input.value = v;
      rec.val.textContent = (d.kind === "select") ? shortOpt(d, v) : fmt(parseFloat(v), d);
    });
  }

  // ----- Presets -----
  B.PRESETS.forEach(function (pre, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "bpl-preset";
    b.innerHTML = '<span class="bpl-preset-name">' + pre.name + '</span>' +
                  '<span class="bpl-preset-desc">' + pre.desc + '</span>';
    b.addEventListener("click", function () {
      B.loadPreset(i); activePreset = i;
      Array.prototype.forEach.call(presetsEl.children, function (c, ci) { c.classList.toggle("is-active", ci === i); });
      syncControls();
      if (!nameEl.value) nameEl.value = pre.name;
      writeJSON();
    });
    presetsEl.appendChild(b);
  });

  // ----- Copy patch: pure timbre, with audition context noted separately -----
  function currentPatch() {
    var p = { name: nameEl.value || "untitled reed", params: {} };
    B.PARAMS.forEach(function (d) { p.params[d.key] = B.getParam(d.key); });
    p.masterVol = parseFloat(masterSl.value) / 100;
    p.auditionedIn = { mode: B.getMode(), tonicHz: B.getTonic() };  // context, not part of the voice
    return p;
  }
  function writeJSON() { jsonEl.value = JSON.stringify(currentPatch(), null, 2); }
  nameEl.addEventListener("input", writeJSON);
  copyBtn.addEventListener("click", function () {
    writeJSON();
    var text = jsonEl.value;
    function done() { copyMsg.classList.add("show"); setTimeout(function () { copyMsg.classList.remove("show"); }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { jsonEl.select(); document.execCommand("copy"); done(); });
    } else { jsonEl.select(); document.execCommand("copy"); done(); }
  });

  writeJSON();
})();
