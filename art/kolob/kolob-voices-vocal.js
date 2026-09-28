// ============================================================================
// KOLOB 2 — THE VOCAL VOICES (KOLOB.VoicesVocal)
//
// People, not a pad. The old choir (kolob-audio.js, choirVoiceLine) is four
// sawtooth reeds through three bandpasses, one vowel a phrase: an organ stop
// that has learned to say "ah". This module is the ward itself:
//
//  · singer(spec)     one PERSON — a vibrato that blooms late in a long note
//                     and not before, breath in the tone and between the
//                     lines, a scoop into each note from below, a pitch
//                     habit, a timing habit, confidence (or the lack of it),
//                     and, for the old, the wobble of a voice sixty years in
//                     the same pew.
//  · desk(spec)       a pew of 2–4 people sharing one throat of formants
//                     (cheap), each with their own pitch, vibrato, drift and
//                     lateness — so they beat against each other like a
//                     congregation and never lock into a flanger. Since the
//                     owner chose the full ward (thirty-two singers, a throat
//                     each), desks are the documented fallback only.
//  · congregation()   4–8 desks, the massed singing, for that fallback.
//  · precentor(spec)  the ornamented solo line that lines out a hymn;
//                     congregation.lined() is the ward's slow heterophonic
//                     answer, every desk decorating the tune its own way.
//  · hum              every voice can sing a line on "mm".
//
// THE HOUSE RULE, kept: formant frequencies never chase automation. A biquad
// is born with its frequency and dies with it. A vowel CHANGE is a crossfade
// between two banks of fixed formants fed by the same glottal source — the
// shape of the mouth changes by one bank fading as the next one opens, never
// by sweeping a filter. (Every param this file automates is a gain, an
// oscillator frequency or an oscillator detune. Grep for it.)
//
// Round 3 (the cast crew) — what changed, and why:
//
//  · THE HISS BETWEEN THE NOTES. The owner heard "a brushing s sound… like
//    air being released out of a tire… in between notes when the hymns are
//    being sung." It was the breath. The throat's aspiration was a noise of
//    its own, on its own clock: it kept blowing for a quarter-second after
//    every line had ended (through a vowel bank still standing open), puffed
//    an "h" at 2.8× into the start of the next, and stayed at full strength
//    through every dip between notes while the voice fell away beneath it —
//    thirty-two times over. Now the breathiness is IN the voice: the noise
//    passes through each person's own envelope, so it rises and falls with
//    the tone and can never be heard without it. A breath you can hear is an
//    inhale, and only where a phrase breathes (a rest, or a line's start),
//    quiet, low (below ~3 kHz), and not every singer's. The s and f of the
//    shape syllables are softer and shorter. No level change is faster than
//    10 ms (a short note before "fa" or "sol" used to cut in half a
//    millisecond — a glottal click).
//  · THE LATE MAN'S MOUTH. A timing habit used to delay the pitch and leave
//    the consonant, the vowel and the breath on the beat. Now the whole mouth
//    is late with the person: one singer's throat follows that singer's own
//    onsets exactly, and a desk's throat follows the desk's lateness (its
//    people scatter around it).
//  · THE HONK. A harmonic landing on a narrow +16 dB first formant made
//    single notes jump up to 8 dB over their neighbours. Every note now gets
//    a make-up gain, computed from the mouth's own response at that note's
//    harmonics (the RBJ biquad formulas Web Audio uses, weighted by the
//    source's tilt), toward one level per vowel — ah the loudest, oo the
//    softest, as in real voices — with a gentle rise up the register.
//  · A THROAT FOR A PHONE. The gates now stand BEFORE the formant banks, so
//    a closed mouth passes silence and its filters rest (the browser skips a
//    silent filter); the breath's noises are baked once per context into
//    buffers (no highpass or bandpass filter per singer); a lone singer needs
//    no summing gain and no pre-attenuator (folded into the gates); a ward
//    can share a handful of pan positions (spec.sharedPan); and a line's
//    graph lets go of the room the moment its sources end.
//
// Also kept from Bardo: pre-attenuate before resonant formants. The cascade
// below can stack ~+20 dB where F1 and F2 crowd together (oo, oh).
//
// The source is not a sawtooth. A glottal pulse falls ~12 dB an octave and
// the lips give back ~6, so a voice leaves the mouth falling ~7–9 dB an
// octave, with a fundamental no louder than its octave (a sawtooth's
// fundamental towers; that tower is the reed, and the mud). Each person gets
// their own PeriodicWave — the same tilt family, but their own harmonic
// phases and small amplitude quirks — so two people on the same pitch sum
// like two people, not like one signal and its echo (which is what a
// flanger is).
//
// SCORE §1: synthesis only. Every call takes a scheduled time t; nothing here
// reads ctx.currentTime to decide when anything happens. Randomness is
// sound-level only (SCORE §3 `synth:vocal`) and never touches musical choice
// — except ornament(), which is a performer's decoration and takes its own
// stream from the caller.
//
// Notes in:  [{ f, dur, vowel, stress?, slur?, rest?, slide? }]
//   f      Hz (the caller owns pitch; exact ratios live upstream)
//   dur    seconds, onset to next onset
//   vowel  ah oh oo ee eh · fa sol la mi · hum   (default "ah")
//   slur   true → melisma continuation: no new consonant, no re-articulation
//   rest   true → silence (a breath) for dur
//   slide  true → a long, deliberate portamento into this note (precentor)
// t is the VOWEL onset of the first note, as written: the singer lands it
// there plus their own lateness. A leading consonant anticipates it by up to
// ~0.09 s and an inhale by ~0.36 s, so give sing() that much lead.
// sing(ctx, dest, t, notes, gain, opts?) — opts:
//   breathBefore  seconds of silence the caller left before t (a line's
//                 breath): the inhale fits inside it (default 0.36; below
//                 0.12 there is no audible inhale)
//   breathe       false → no audible inhale at all (a humming bed)
//   pan           this line's place in the field (a performer moving a
//                 singer between the pews and the hollow square)
// ============================================================================
window.KOLOB = window.KOLOB || {};
window.KOLOB.VoicesVocal = (function () {
  "use strict";

  // --------------------------------------------------------------------------
  // Streams. A PJ2.Rand stream when the substrate is loaded (SCORE §3);
  // otherwise a local mulberry32 with the same five methods, so the module
  // still runs in a bare page or in the Node harness.
  // --------------------------------------------------------------------------
  function localStream(seed) {
    var s = seed >>> 0;
    function next() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var st = {
      next: next,
      rnd: function (a, b) { return a + next() * (b - a); },
      rint: function (a, b) { return Math.floor(a + next() * (b - a + 1)); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      fork: function (label) {
        var h = 0x811c9dc5, str = String(label);
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        return localStream((seed ^ h) >>> 0);
      },
    };
    return st;
  }
  function streamFor(spec, label) {
    if (spec && spec.rand && spec.rand.rnd) return spec.rand;
    var seed = spec && spec.seed != null ? spec.seed : 1;
    var root = (typeof PJ2 !== "undefined" && PJ2.Rand) ? PJ2.Rand.stream(seed) : localStream(seed);
    return root.fork("synth:vocal").fork(label || "voice");
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function gauss(r) { return (r.rnd(0, 1) + r.rnd(0, 1) + r.rnd(0, 1) - 1.5) * 1.15; }   // ~N(0,1), cheap

  // --------------------------------------------------------------------------
  // THE MOUTH — vowel formants, F1 F2 F3 in Hz, for a man's and a woman's
  // tract (Peterson & Barney's averages, rounded; "oh" and "eh" from
  // Hillenbrand). Parts scale them: an alto's tract is a little longer than
  // a soprano's, a bass's longer than a tenor's; a child's is short.
  // --------------------------------------------------------------------------
  var VOWELS = {
    ah: { m: [730, 1090, 2440], w: [850, 1220, 2810] },
    oh: { m: [500, 850, 2400], w: [560, 950, 2750] },
    oo: { m: [330, 870, 2240], w: [380, 950, 2670] },
    ee: { m: [280, 2250, 2890], w: [320, 2700, 3250] },
    eh: { m: [530, 1840, 2480], w: [610, 2300, 2900] },
  };
  var PART = {
    //       tract   scale  lowest useful Hz (mud guard)  default pan  the part's middle (Hz)
    S:     { tract: "w", k: 1.00, hp: 200, pan: 0.30,  mid: 392 },
    A:     { tract: "w", k: 0.95, hp: 170, pan: -0.30, mid: 294 },
    T:     { tract: "m", k: 1.03, hp: 120, pan: 0.45,  mid: 220 },
    B:     { tract: "m", k: 0.95, hp: 78,  pan: -0.45, mid: 147 },
    child: { tract: "w", k: 1.16, hp: 260, pan: 0.10,  mid: 440 },
  };
  // How loud each mouth shape is at the same effort, against "ah" (the open
  // vowels carry; the closed ones — ee, oo — sit a dB or two under). The
  // make-up gain aims every note at its vowel's level, so a harmonic falling
  // on a formant peak no longer honks.
  var INTRINSIC = { ah: 1.0, oh: 0.94, eh: 0.92, ee: 0.84, oo: 0.8 };
  // A syllable is (consonant) + vowel + (coda). The four shape-note syllables
  // are the reason consonants exist here at all: fa, sol, la, mi.
  var SYL = {
    ah: { v: "ah" }, oh: { v: "oh" }, oo: { v: "oo" }, ee: { v: "ee" }, eh: { v: "eh" },
    fa: { c: "f", v: "ah" }, sol: { c: "s", v: "oh", coda: "l" }, la: { c: "l", v: "ah" }, mi: { c: "m", v: "ee" },
    hum: { v: "hum" }, mm: { v: "hum" },
  };
  var CONS_DUR = { f: 0.07, s: 0.08, l: 0.06, m: 0.075 };
  // the fricatives' strength, per singer. A ward's s is thirty-two small
  // ones, each at its own moment, so it smears into a brush a tenth of a
  // second long: each must be small (the owner heard the brush as a hiss)
  var FRIC_PEAK = { s: 0.015, f: 0.008 };
  // no level change faster than this (s): a 0.5 ms fall is a glottal click
  var MIN_RAMP = 0.010;

  // A bank's filter chain (all FIXED for the bank's life). Cascade peaking
  // resonators, the way a vocal tract is built (Klatt's cascade branch): the
  // source passes through every formant in turn, so vowels keep their
  // valleys and a voice keeps its body between the peaks.
  function bankSpec(key, tract, k, f0, bright) {
    if (key === "hum" || key === "m") {
      // lips closed: the nasal murmur — a low pole, everything above ~700 Hz
      // swallowed. The hum is this bank held.
      return [
        { type: "lowpass", f: 620 * k, q: 0.8, g: 0 },
        { type: "peaking", f: 260 * k, q: 2.4, g: 11 },
        { type: "peaking", f: 2300 * k, q: 5, g: 3 },
      ];
    }
    if (key === "l") {
      return [
        { type: "peaking", f: 360 * k, q: 5, g: 12 },
        { type: "peaking", f: (tract === "w" ? 1450 : 1250) * k, q: 7, g: 7 },
        { type: "peaking", f: 2800 * k, q: 8, g: 4 },
      ];
    }
    var F = VOWELS[key][tract].map(function (x) { return x * k; });
    // Formant tuning, the thing every soprano learns without being told: when
    // the pitch climbs past the first formant the jaw drops and F1 rides just
    // above the fundamental. Fixed at bank birth, like everything else.
    if (f0 * 1.08 > F[0]) F[0] = f0 * 1.15;
    return [
      { type: "peaking", f: F[0], q: F[0] / (60 + F[0] * 0.07), g: 16 },
      { type: "peaking", f: F[1], q: F[1] / (80 + F[1] * 0.05), g: key === "ee" ? 14 : 12 },
      { type: "peaking", f: F[2], q: F[2] / 170, g: 7 + 6 * bright },
    ];
  }
  // which bank a note needs: a vowel's bank is shared by every note whose
  // fundamental stays under its first formant; above it (the jaw drops), a
  // bank per 60 Hz band, tuned for the first note that opens it. Ceil, not
  // round: a note just over F1 must never reuse the untuned bank (the honk).
  function bankKey(key, f0, P) {
    if (key === "hum" || key === "m" || key === "l") return key;
    var over = f0 * 1.08 - VOWELS[key][P.tract][0] * P.k;
    return key + "|" + (over > 0 ? Math.ceil(over / 60) : 0);
  }

  // --------------------------------------------------------------------------
  // THE EAR OF THE MOUTH — the magnitude response of a Web Audio biquad (the
  // RBJ cookbook, as the spec gives it: Q in dB for low/highpass), so the
  // make-up gain can be worked out on paper, without a node.
  // --------------------------------------------------------------------------
  function biquadCoefs(type, f, q, g, sr) {
    var w0 = 2 * Math.PI * Math.min(f, sr * 0.499) / sr, cw = Math.cos(w0), sw = Math.sin(w0), A = Math.pow(10, g / 40);
    var al = (type === "lowpass" || type === "highpass") ? sw / (2 * Math.pow(10, q / 20)) : sw / (2 * q);
    var b0, b1, b2, a0, a1, a2;
    if (type === "lowpass") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "bandpass") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }   // peaking
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function mag2(c, c1, c2, s1, s2) {
    var nr = c[0] + c[1] * c1 + c[2] * c2, ni = -(c[1] * s1 + c[2] * s2);
    var dr = 1 + c[3] * c1 + c[4] * c2, di = -(c[3] * s1 + c[4] * s2);
    return (nr * nr + ni * ni) / (dr * dr + di * di);
  }
  // the energy a note of f0 leaves the mouth with, through `chain` (a list of
  // coefficient sets), for a source of tilt `tilt` (the fundamental held to
  // 0.55, as waveFor builds it). (The harmonic's angle is worked once and
  // shared by every filter: this runs for every note of every singer, on
  // the page's main thread.)
  function mouthEnergy(chain, f0, tilt, sr) {
    var e = 0, hmax = Math.min(32, Math.floor(7000 / f0));   // (above ~7 kHz the tilt has left next to nothing)
    for (var h = 1; h <= hmax; h++) {
      var a = Math.pow(h, -tilt) * (h === 1 ? 0.55 : 1), w = 2 * Math.PI * h * f0 / sr, m = 1;
      var c1 = Math.cos(w), s1 = Math.sin(w), c2 = c1 * c1 - s1 * s1, s2 = 2 * s1 * c1;
      for (var i = 0; i < chain.length; i++) m *= mag2(chain[i], c1, c2, s1, s2);
      e += a * a * m;
    }
    return Math.sqrt(e);
  }

  // --------------------------------------------------------------------------
  // THE THROAT — glottal-source waves (as radiated), cached per context.
  // Harmonic n has amplitude n^-tilt (tilt ~1.3: ~8 dB/octave; ~1.6 for a
  // breathy, old or child's voice), the fundamental held down to the level
  // of the octave, with per-variant phase and a little amplitude unevenness —
  // the fingerprint of one person's folds.
  // --------------------------------------------------------------------------
  var H = 64;
  function waveFor(ctx, tilt, variant) {
    var cache = ctx.__kolobVocalWaves || (ctx.__kolobVocalWaves = {});
    var key = Math.round(tilt * 10) + ":" + variant;
    if (cache[key]) return cache[key];
    var r = localStream(0x5eed + variant * 7919 + Math.round(tilt * 10));
    var re = new Float32Array(H + 1), im = new Float32Array(H + 1), ss = 0;
    for (var n = 1; n <= H; n++) {
      var a = Math.pow(n, -tilt) * (1 + r.rnd(-0.18, 0.18)) * (n === 1 ? 0.55 : 1);
      var ph = r.rnd(0, Math.PI * 2);
      re[n] = a * Math.cos(ph); im[n] = a * Math.sin(ph); ss += a * a / 2;
    }
    var norm = 0.5 / Math.sqrt(ss);                     // every person at the same RMS
    for (var m = 1; m <= H; m++) { re[m] *= norm; im[m] *= norm; }
    return (cache[key] = ctx.createPeriodicWave(re, im, { disableNormalization: true }));
  }
  // THE BREATH'S NOISES, baked once per context: white noise put through the
  // filters a throat used to carry of its own, and made circular (the tail
  // crossfaded into the head) so the loop has no seam.
  //   asp   aspiration: above ~1.1 kHz, softened above ~5.5 kHz — it goes into
  //         the voice and through the mouth, so it takes the vowel's colour
  //   fric  the s and the f: a band around 5.2 kHz, straight out
  //   inh   an inhale: 350 Hz – 2.8 kHz, a soft "hh", never a hiss
  function bakedNoise(ctx, kind) {
    var cache = ctx.__kolobVocalNoise || (ctx.__kolobVocalNoise = {});
    if (cache[kind]) return cache[kind];
    var sr = ctx.sampleRate, len = Math.floor(sr * 2.0), fade = Math.floor(sr * 0.05), n = len + fade;
    // (a plain xorshift, inline: this runs once per context, on the main
    // thread, and a hundred thousand stream calls are a visible pause)
    var st = (0xb4ea7 + (kind === "asp" ? 0 : kind === "fric" ? 17 : 29)) >>> 0;
    var x = new Float32Array(n);
    for (var i = 0; i < n; i++) { st ^= st << 13; st ^= st >>> 17; st ^= st << 5; x[i] = (st >>> 0) / 2147483648 - 1; }
    var stages = kind === "asp" ? [["highpass", 1100, 0.5, 0], ["lowpass", 5500, -3, 0]]
      : kind === "fric" ? [["bandpass", 5200, 0.9, 0]]
      : [["highpass", 350, 0, 0], ["lowpass", 2800, 0, 0], ["peaking", 1500, 1.2, 4]];
    stages.forEach(function (s) {
      var c = biquadCoefs(s[0], s[1], s[2], s[3], sr), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (var j = 0; j < n; j++) {
        var y = c[0] * x[j] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
        x2 = x1; x1 = x[j]; y2 = y1; y1 = y; x[j] = y;
      }
    });
    var b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ss = 0;
    for (var k = 0; k < len; k++) {
      var v = x[k + fade];
      if (k < fade) { var u = k / fade; v = x[k + fade] * Math.sqrt(u) + x[k + len] * Math.sqrt(1 - u); }
      d[k] = v; ss += v * v;
    }
    // aspiration and inhale at a known RMS (0.55, what the old highpassed
    // noise carried); the fricative keeps the band's own level
    if (kind !== "fric") { var g = 0.55 / Math.sqrt(ss / len); for (var q = 0; q < len; q++) d[q] *= g; }
    return (cache[kind] = b);
  }
  // FIXED NODES ARE BORN FIXED. A param given its value in the constructor
  // has no timeline at all: the browser treats it as a constant (a filter
  // computes its coefficients once, not per sample), and a gain that is a
  // constant 0 hands on silence the filters after it can skip. A param set
  // with setValueAtTime keeps a timeline, and a gate with an opening still
  // to come is worked sample by sample — zeros, but zeros that cost. (The
  // fallbacks serve an old browser, or the Node harness's mock.)
  function gainNode(ctx, v) {
    if (typeof GainNode === "function") { try { return new GainNode(ctx, { gain: v }); } catch (e) { /* fall through */ } }
    var g = ctx.createGain(); g.gain.value = v; return g;
  }
  function filterNode(ctx, type, f, q, g) {
    if (typeof BiquadFilterNode === "function") { try { return new BiquadFilterNode(ctx, { type: type, frequency: f, Q: q, gain: g || 0 }); } catch (e) { /* fall through */ } }
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g || 0; return b;
  }
  function pannerNode(ctx, pan) {
    if (typeof StereoPannerNode === "function") { try { return new StereoPannerNode(ctx, { pan: pan }); } catch (e) { /* fall through */ } }
    var p = ctx.createStereoPanner(); p.pan.value = pan; return p;
  }
  // A ward can share a few pan positions instead of a panner per singer:
  // one StereoPanner per destination per twentieth of the field, made once.
  function sharedPanner(ctx, dest, pan) {
    var c = dest.__kolobPans || (dest.__kolobPans = {}), key = Math.round(clamp(pan, -1, 1) * 20) / 20;
    if (!c[key]) { var sp = pannerNode(ctx, key); sp.connect(dest); c[key] = sp; }
    return c[key];
  }

  // --------------------------------------------------------------------------
  // THE BUDGET — a ledger of node lifetimes, so a lab (or the core) can ask
  // "how many nodes are alive at second s" without instrumenting Web Audio.
  // Every renderLine() files one entry: its node count and [born, dies].
  // --------------------------------------------------------------------------
  var ledger = [];
  var budget = {
    add: function (kind, nodes, t0, t1) { ledger.push({ kind: kind, nodes: nodes, t0: t0, t1: t1 }); if (ledger.length > 8000) ledger.splice(0, 2000); },
    reset: function () { ledger = []; },
    aliveAt: function (t) { var n = 0; for (var i = 0; i < ledger.length; i++) if (ledger[i].t0 <= t && t < ledger[i].t1) n += ledger[i].nodes; return n; },
    // nodes alive, second by second over [from, to) — each second's figure
    // is the most alive at any quarter-second inside it:
    // { perSecond: [...], peak, mean, byKind: {kind: peak} }
    report: function (from, to) {
      var per = [], peak = 0, sum = 0, byKind = {};
      for (var s = Math.floor(from); s < to; s++) {
        var n = 0;
        for (var q = 0; q < 4; q++) {
          var at = s + q * 0.25 + 0.125, m = 0, kinds = {};
          for (var i = 0; i < ledger.length; i++) {
            var e = ledger[i];
            if (e.t0 <= at && e.t1 > at) { m += e.nodes; kinds[e.kind] = (kinds[e.kind] || 0) + e.nodes; }
          }
          if (m > n) n = m;
          for (var kk in kinds) if (!byKind[kk] || kinds[kk] > byKind[kk]) byKind[kk] = kinds[kk];
        }
        per.push(n); sum += n; if (n > peak) peak = n;
      }
      return { perSecond: per, peak: peak, mean: per.length ? sum / per.length : 0, byKind: byKind };
    },
  };

  // --------------------------------------------------------------------------
  // A person's defaults, by part and age. Everything is overridable in spec.
  // --------------------------------------------------------------------------
  function personDefaults(spec, r) {
    var part = PART[spec.part] ? spec.part : "S";
    var age = spec.age || "mid";
    var old = age === "old", young = age === "young", child = part === "child";
    var vib = spec.vibrato || {};
    return {
      part: part, age: age,
      tract: PART[part].tract, k: PART[part].k * (spec.tractScale || r.rnd(0.975, 1.025)) * (old ? 0.97 : 1),
      hp: PART[part].hp, mid: PART[part].mid,
      vibRate: vib.rate != null ? vib.rate : (child ? 5.9 : old ? r.rnd(4.2, 4.7) : r.rnd(5.0, 5.9)),
      vibDepth: vib.depth != null ? vib.depth : (child ? 10 : old ? r.rnd(55, 75) : young ? r.rnd(18, 32) : r.rnd(28, 45)),
      vibDelay: vib.onsetDelay != null ? vib.onsetDelay : (child ? 0.7 : old ? 0.15 : r.rnd(0.3, 0.55)),
      breath: spec.breath != null ? spec.breath : (child ? 0.65 : old ? 0.5 : 0.35),
      bright: spec.brightness != null ? spec.brightness : 0.5,
      habit: spec.pitchHabitCents || 0,
      late: (spec.timingHabitMs || 0) / 1000,
      conf: spec.confidence != null ? spec.confidence : 0.7,
      // drift: how far the pitch wanders inside a held note (cents, sd);
      // the old voice wanders a lot and sags on long notes
      drift: spec.drift != null ? spec.drift : (old ? 9 : young || child ? 2.5 : 4),
      sag: old ? 10 : 0,
      tilt: (old ? 1.5 : child ? 1.6 : 1.3) + (0.5 - (spec.brightness != null ? spec.brightness : 0.5)) * 0.5,
      pan: spec.pan != null ? spec.pan : PART[part].pan,
      sharedPan: !!spec.sharedPan,
      level: spec.level != null ? spec.level : 1,
    };
  }

  // --------------------------------------------------------------------------
  // renderLine — the one renderer. A "throat" of nVoices people (1 for a
  // singer, 2–4 for a desk) shares one mud guard, one tilt and one set of
  // vowel banks; each person has their own source, breath, vibrato, drift,
  // timing and envelope.
  //
  //   person osc ─┐                                   ┌► gate ah ─► bank ah ─┐
  //   breath asp ─┴► person env ─► (sum) ─► hp ─► tilt┤                      ├► out ─► pan ─► dest
  //                                                   └► gate ee ─► bank ee ─┤
  //   inhale (only where a phrase breathes) ──────────────────────────────────┤
  //   fricative (only where a line says f or s) ──────────────────────────────┘
  //
  // The gates stand before the banks: a closed gate passes silence, and a
  // bank with silence in it costs (next to) nothing.
  // --------------------------------------------------------------------------
  function renderLine(ctx, dest, P, people, t, notes, gain, kind, opts) {
    opts = opts || {};
    var nodes = 0;
    function mk(fn) { nodes++; return fn(); }
    var r = P.rand, sr = ctx.sampleRate || 48000;
    if (!notes || !notes.length) return t;
    var solo = people.length === 1;

    // ---- the timeline as written ----
    var ev = [], tt = t;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var syl = n.rest ? null : (SYL[n.vowel || "ah"] || SYL.ah);
      ev.push({ s: tt, d: n.dur, f: n.f, rest: !!n.rest || !n.f, syl: syl, slur: !!n.slur, slide: !!n.slide, stress: n.stress != null ? n.stress : 1 });
      tt += n.dur;
    }
    var end = tt;
    // the throat's lateness moves the whole mouth — consonant, vowel, breath
    // and pitch together (a late singer is late all through, not just in
    // the pitch)
    var late = P.late || 0;
    var born = Math.max(0, t + late - 0.5), dies = end + late + 0.45;
    // the sources run only while they can be heard: from just before the
    // first sound to just after the last release (a line's graph used to
    // idle half a second either side, doubling the ward at every line join)
    var soundFrom = Infinity, soundTo = 0;

    // ---- the people's onsets: a lone singer's mouth is where they are ----
    var ons = people.map(function (who) {
      var on = [], prevOn = -1e9;
      for (var i2 = 0; i2 < ev.length; i2++) {
        var o = ev[i2].s + late + who.lag + gauss(r) * who.slop;
        if (ev[i2].slur) o = ev[i2].s + late + who.lag;          // melisma: no re-attack slop
        o = Math.max(o, prevOn + 0.04, born + 0.05);
        on.push(o); prevOn = o;
      }
      return on;
    });
    var ms = solo ? ons[0] : ev.map(function (e) { return Math.max(e.s + late, born + 0.05); });
    var mEnd = end + late + (solo ? people[0].lag : 0);
    ons.forEach(function (on, pi) {
      for (var q0 = 0; q0 < ev.length; q0++) if (!ev[q0].rest) { soundFrom = Math.min(soundFrom, on[q0] - 0.12); break; }
      soundTo = Math.max(soundTo, end + late + people[pi].lag + 0.12);
    });
    soundFrom = Math.max(born + 0.01, soundFrom);
    dies = Math.max(soundTo, mEnd + 0.16) + 0.04;
    function mDur(k) { return (k + 1 < ev.length ? ms[k + 1] : mEnd) - ms[k]; }

    // ---- shared chain ----
    var out = mk(function () { return gainNode(ctx, gain * P.level); });
    var tail, where = opts.pan != null ? opts.pan : P.pan;
    if (P.sharedPan) { out.connect(sharedPanner(ctx, dest, where)); tail = out; }
    else {
      var pan = mk(function () { return pannerNode(ctx, clamp(where, -1, 1)); });
      out.connect(pan); pan.connect(dest); tail = pan;
    }
    var hp = mk(function () { return filterNode(ctx, "highpass", P.hp, 0.6); });
    var tiltF = 3800 + 2200 * P.bright;
    var tilt = mk(function () { return filterNode(ctx, "lowpass", tiltF, 0.6); });
    hp.connect(tilt);
    var sum = hp;
    if (!solo) {
      sum = mk(function () { return gainNode(ctx, 1 / Math.sqrt(people.length)); });
      sum.connect(hp);
    }
    var throatChain = [biquadCoefs("highpass", P.hp, 0.6, 0, sr), biquadCoefs("lowpass", tiltF, 0.6, 0, sr)];

    // the breath in the tone: one baked noise for the throat, into every
    // person's own envelope (a desk's people share it, so it is scaled for
    // the coherent sum) — it can only ever be heard inside the voice
    var br = P.breath;
    var aspSrc = mk(function () { return ctx.createBufferSource(); });
    aspSrc.buffer = bakedNoise(ctx, "asp"); aspSrc.loop = true;
    var asp = mk(function () { return gainNode(ctx, 0.06 * br / Math.sqrt(people.length)); });
    aspSrc.connect(asp);

    // ---- the vowel banks: created on first use, fixed for life ----
    var banks = {};
    function bankEnergy(key, f0) {
      var sp = bankSpec(key, P.tract, P.k, f0, P.bright);
      return mouthEnergy(throatChain.concat(sp.map(function (s) { return biquadCoefs(s.type, s.f, s.q, s.g, sr); })), f0, P.tilt, sr);
    }
    function refLevel(key) {
      // the level this throat aims a vowel at. The open vowels share one
      // reference, chosen so that the throat's average over its compass and
      // a verse's mix of vowels stays where it was (only the honks and the
      // holes are evened out); each vowel then sits its intrinsic step under
      // "ah". The closed mouths (hum, m, l) keep their own level at the
      // part's middle, flattened across the register. Worked once a person.
      var ref = P._mouthRef || (P._mouthRef = {});
      var base = key === "hum" || key === "m" || key === "l" ? key : "ah";
      if (ref[base] == null) {
        if (base !== "ah") ref[base] = bankEnergy(base, P.mid);
        else {
          var num = 0, den = 0, mix = { ah: 3, oh: 2, ee: 2, oo: 1.5, eh: 1.5 };
          for (var st = -9; st <= 9; st += 6) {
            var f = P.mid * Math.pow(2, st / 12), rise = Math.pow(f / P.mid, 0.3);
            for (var v in mix) { var e = bankEnergy(v, f), sh = INTRINSIC[v] * rise; num += mix[v] * e * e; den += mix[v] * sh * sh; }
          }
          ref.ah = Math.sqrt(num / den);
        }
      }
      return ref[base] * (INTRINSIC[key] || 1);
    }
    function bank(key, f0) {
      var id = bankKey(key, f0, P);
      if (banks[id]) return banks[id];
      var spec = bankSpec(key, P.tract, P.k, f0, P.bright);
      var gate = mk(function () { return gainNode(ctx, 0); });   // shut, and silent, until its first opening
      tilt.connect(gate);
      var prev = gate;
      for (var j = 0; j < spec.length; j++) {
        var sj = spec[j];
        var bq = mk(function () { return filterNode(ctx, sj.type, sj.f, sj.q, sj.g); });   // born with its formant, dies with it
        prev.connect(bq); prev = bq;
      }
      prev.connect(out);
      var chain = throatChain.concat(spec.map(function (s) { return biquadCoefs(s.type, s.f, s.q, s.g, sr); }));
      return (banks[id] = { id: id, key: key, gate: gate, chain: chain, val: 0, last: born, mk: {}, used: false });
    }
    // the gate's level for a note: the pre-attenuation (0.11) times the
    // make-up that brings this note to its vowel's level, rising gently
    // (~1.8 dB an octave) up the register as real voices do
    function level(b, f0) {
      var key = Math.round(f0 * 4);
      if (b.mk[key] == null) {
        var e = mouthEnergy(b.chain, f0, P.tilt, sr);
        b.mk[key] = 0.11 * clamp(refLevel(b.key) / Math.max(e, 1e-9), 0.25, 4) * Math.pow(f0 / P.mid, 0.3);
      }
      return b.mk[key];
    }
    // gate automation, always forward in time: ramp b to v, from a to z
    function gateRamp(b, a, z, v) {
      var g = b.gate.gain;
      a = Math.max(a, b.last); z = Math.max(z, a + 0.004);
      g.setValueAtTime(b.val, a); g.linearRampToValueAtTime(v, z);
      // a closed mouth ends on a set value: its timeline done, its silence true
      if (v === 0) g.setValueAtTime(0, z + 0.01);
      b.val = v; b.last = z + (v === 0 ? 0.01 : 0);
    }
    // open b while closing the mouth before it, centred on time c, width w
    var cur = null;
    function switchTo(b, c, w, v) {
      var a0 = Math.max(c - w / 2, born + 0.001);
      if (b === cur) { gateRamp(b, a0, a0 + w, v); return; }
      if (cur) gateRamp(cur, a0, a0 + w, 0);
      gateRamp(b, a0, a0 + w, v);
      cur = b;
    }

    // ---- walk the syllables: which mouth, when, how open; consonants ----
    var cons = [];           // {s, e, c} consonant windows (the mouth's time)
    for (var k = 0; k < ev.length; k++) {
      var e = ev[k];
      if (e.rest) continue;
      var sy = e.syl, s0 = ms[k], vb = bank(sy.v, e.f), lv = level(vb, e.f);
      if (!e.slur && sy.c) {
        var cd = CONS_DUR[sy.c], cs = s0 - cd * 0.8;
        cons.push({ s: cs, e: s0 + cd * 0.2, c: sy.c });
        if (sy.c === "m" || sy.c === "l") { var cb = bank(sy.c, e.f); switchTo(cb, cs, 0.03, level(cb, e.f)); }
        switchTo(vb, s0 + cd * 0.2, sy.c === "m" || sy.c === "l" ? 0.05 : 0.03, lv);
      } else if (vb === cur) {
        // the same mouth on a new pitch: only its make-up moves, across the join
        gateRamp(vb, s0 - 0.02, s0 + 0.04, lv);
      } else {
        // vowel to vowel: a slower crossfade — the mouth reshapes through the join
        switchTo(vb, s0, cur ? 0.09 : 0.02, lv);
      }
      if (sy.coda && !(ev[k + 1] && ev[k + 1].slur)) {
        // "sol": the l closes the syllable in its last 12 %
        var dk = mDur(k), ce = s0 + dk, cl = Math.min(0.09, dk * 0.12), nxt = ev[k + 1];
        if (nxt && !nxt.rest) { var lb = bank("l", e.f); switchTo(lb, ce - cl - 0.02, 0.04, level(lb, e.f)); }
      }
    }
    // the mouth closes after the last release (its banks fall silent)
    if (cur) gateRamp(cur, mEnd + 0.08, mEnd + 0.14, 0);

    // ---- the inhale: only where a phrase breathes, and not every singer ----
    var breaths = [];
    var bb = opts.breathBefore != null ? opts.breathBefore : 0.36;
    var dIn = r.rnd(0, 1);                                   // (drawn whether or not it is used)
    if (opts.breathe !== false && bb >= 0.12 && dIn < 0.25 + 0.6 * br) breaths.push({ at: ms[0] - Math.min(0.36, bb - 0.04), len: Math.min(0.32, bb - 0.08) });
    for (var q = 0; q < ev.length; q++) {
      var dR = r.rnd(0, 1);
      if (!ev[q].rest || ev[q].d <= 0.25 || q + 1 >= ev.length || opts.breathe === false) continue;
      var nextOn = ms[q + 1];
      if (dR < 0.25 + 0.6 * br) breaths.push({ at: nextOn - Math.min(0.36, ev[q].d - 0.06), len: Math.min(0.32, ev[q].d - 0.1) });
    }
    breaths = breaths.filter(function (b) { return b.at >= born + 0.01 && b.len >= 0.1; });
    if (breaths.length) {
      var inSrc = mk(function () { return ctx.createBufferSource(); });
      inSrc.buffer = bakedNoise(ctx, "inh"); inSrc.loop = true;
      var inh = mk(function () { return gainNode(ctx, 0); });
      inSrc.connect(inh); inh.connect(out);
      breaths.forEach(function (b) {
        // a draw of air: a soft rise and a quicker fall, never above a murmur
        var pk = 0.011 * (0.5 + br);
        inh.gain.setValueAtTime(0, b.at);
        inh.gain.linearRampToValueAtTime(pk, b.at + b.len * 0.65);
        inh.gain.linearRampToValueAtTime(0, b.at + b.len);
      });
      inSrc.start(Math.max(born, breaths[0].at - 0.01), r.rnd(0, 1.9)); inSrc.stop(breaths[breaths.length - 1].at + breaths[breaths.length - 1].len + 0.02);
    }
    // ---- fricatives: only if the line says f or s ----
    var fr = cons.filter(function (C) { return C.c === "f" || C.c === "s"; });
    if (fr.length) {
      var fSrc = mk(function () { return ctx.createBufferSource(); });
      fSrc.buffer = bakedNoise(ctx, "fric"); fSrc.loop = true;
      var fric = mk(function () { return gainNode(ctx, 0); });
      fSrc.connect(fric); fric.connect(out);
      var fT = born;
      fr.forEach(function (C) {
        var pk2 = FRIC_PEAK[C.c], a = Math.max(C.s, fT + 0.002), len = Math.max(0.03, C.e - a);
        fric.gain.setValueAtTime(0, a);
        fric.gain.linearRampToValueAtTime(pk2, a + len * 0.35);
        fric.gain.linearRampToValueAtTime(pk2 * 0.6, a + len * 0.7);
        fric.gain.linearRampToValueAtTime(0, a + len + 0.012);
        fT = a + len + 0.012;
      });
      fSrc.start(Math.max(born, fr[0].s - 0.01), r.rnd(0, 1.9)); fSrc.stop(fT + 0.02);
    }

    // ---- the people ----
    var firstOsc = null;
    for (var p = 0; p < people.length; p++) renderPerson(people[p], ons[p]);

    function renderPerson(who, on) {
      var osc = mk(function () { return ctx.createOscillator(); });
      osc.setPeriodicWave(waveFor(ctx, who.tilt, who.variant));
      var envG = mk(function () { return gainNode(ctx, 0); });
      osc.connect(envG); asp.connect(envG); envG.connect(sum);
      if (!firstOsc) firstOsc = osc;
      var endP = end + late + who.lag;

      // --- pitch: scoops on the OSCILLATOR, never on a filter ---
      var fq = osc.frequency, prevF = null, fT = born, firstSet = false;
      // every event strictly after the last: a grace note's glide may not
      // reach back into the one before it
      function fset(v, time) { time = Math.max(time, fT + 0.001); fq.setValueAtTime(v, time); fT = time; }
      function framp(v, time) { time = Math.max(time, fT + 0.002); fq.linearRampToValueAtTime(v, time); fT = time; }
      for (var j2 = 0; j2 < ev.length; j2++) {
        var e2 = ev[j2];
        if (e2.rest) { prevF = null; continue; }
        var target = e2.f, s0 = on[j2];
        if (prevF == null) {
          // a fresh entry: from below, by how unsure this person is (and the
          // very first pitch is set from the start, so the oscillator never
          // speaks at its default before it)
          var from = target * Math.pow(2, -(who.scoop * r.rnd(0.7, 1.3)) / 1200);
          if (!firstSet) { fq.setValueAtTime(from, born); firstSet = true; }
          fset(from, s0 - 0.03);
          framp(target * Math.pow(2, -who.scoop * 0.15 / 1200), s0 + 0.07);
          framp(target, s0 + 0.16 + (1 - who.conf) * 0.1);
        } else if (target !== prevF) {
          var port = e2.slide ? Math.min(0.42, e2.d * 0.4) : Math.min(0.14, 0.05 + e2.d * 0.06) * (0.6 + (1 - who.conf));
          var up = target > prevF;
          fset(prevF, s0 - port * 0.35);
          // up: land a hair under and settle; down: fall through a hair and come back
          framp(target * Math.pow(2, (up ? -who.scoop * 0.2 : who.scoop * 0.08) / 1200), s0 + port * 0.65);
          framp(target, s0 + port * 0.65 + 0.07);
        } else {
          fset(target, s0);
        }
        prevF = target;
      }

      // --- detune: habit + wandering + (old) sag + the vibrato, as ONE
      // curve. The vibrato used to be an oscillator of its own (and a gain)
      // modulating the detune: two more nodes running for every singer. It
      // is worked out here instead, sample by sample at 125 a second, and
      // written into the detune with the drift, as one value curve. The
      // same shapes as before: a little shimmer at every onset, the full
      // vibrato blooming late, and only in a note long enough to hold it.
      var walkPts = [[born, 0]], walk = 0, wT = born;
      for (var j3 = 0; j3 < ev.length; j3++) {
        var e3 = ev[j3];
        if (e3.rest) continue;
        var s3 = on[j3], steps = Math.max(1, Math.round(e3.d / 0.32));
        for (var st = 1; st <= steps; st++) {
          walk = walk * 0.6 + gauss(r) * who.drift;
          var sag = who.sag * (st / steps) * (e3.d > 1 ? 1 : 0.3);
          var at3 = Math.max(s3 + e3.d * st / steps, wT + 0.01);
          walkPts.push([at3, walk - sag]); wT = at3;
        }
      }
      var depthPts = [[born, 0]], vT = born, vCur = 0, rates = [[born, who.vibRate]];
      function vpt(v, time) { time = Math.max(time, vT + 0.001); depthPts.push([time, v]); vT = time; vCur = v; }
      for (var j4 = 0; j4 < ev.length; j4++) {
        var e4 = ev[j4];
        if (e4.rest) continue;
        var s4 = on[j4], bloomAt = s4 + who.vibDelay;
        var nextS = j4 + 1 < ev.length ? on[j4 + 1] : endP;
        // settle back to a shimmer across the join (a ramp, not a step: a
        // step in depth is a step in pitch)
        vpt(vCur, s4 - 0.03);
        vpt(who.vibDepth * 0.12, s4 + 0.05);
        var rateJ = r.rnd(0.96, 1.04);
        if (nextS - bloomAt > 0.25) {
          vpt(who.vibDepth * 0.12, bloomAt);
          vpt(who.vibDepth, Math.min(nextS - 0.06, bloomAt + 0.45));
          rates.push([bloomAt, who.vibRate * rateJ]);
        }
      }
      function lerpAt(pts, time) {
        if (time <= pts[0][0]) return pts[0][1];
        for (var q1 = 1; q1 < pts.length; q1++) {
          if (time <= pts[q1][0]) { var p0 = pts[q1 - 1], p1 = pts[q1], u = (time - p0[0]) / Math.max(1e-9, p1[0] - p0[0]); return p0[1] + (p1[1] - p0[1]) * u; }
        }
        return pts[pts.length - 1][1];
      }
      var CURVE_HZ = 125, c0 = soundFrom, c1 = soundTo, nC = Math.max(2, Math.ceil((c1 - c0) * CURVE_HZ) + 1);
      var curve = new Float32Array(nC), phase = r.rnd(0, Math.PI * 2), ri = 0;
      for (var k5 = 0; k5 < nC; k5++) {
        var tk = c0 + (c1 - c0) * k5 / (nC - 1);
        while (ri + 1 < rates.length && rates[ri + 1][0] <= tk) ri++;
        curve[k5] = who.habit + lerpAt(walkPts, tk) + lerpAt(depthPts, tk) * Math.sin(phase);
        phase += 2 * Math.PI * rates[ri][1] * (c1 - c0) / (nC - 1);
      }
      osc.detune.setValueAtTime(curve[0], born);
      osc.detune.setValueCurveAtTime(curve, c0, c1 - c0);

      // --- the envelope: phrase shape, accents, articulation, consonants.
      // Every change takes at least MIN_RAMP; a point that cannot fit before
      // the next one is dropped rather than squeezed (open issue 3) ---
      var g = envG.gain, lvl = who.level;
      g.setValueAtTime(0, born);
      var lastT = born;
      function pt(time, v) { time = Math.max(time, lastT + MIN_RAMP); g.linearRampToValueAtTime(v, time); lastT = time; }
      function fits(time) { return time >= lastT + MIN_RAMP; }
      for (var j5 = 0; j5 < ev.length; j5++) {
        var e5 = ev[j5];
        if (e5.rest) continue;
        var s5 = on[j5];
        var nxtRest = j5 + 1 >= ev.length || ev[j5 + 1].rest;
        var eEnd = j5 + 1 < ev.length ? on[j5 + 1] : endP;
        var len = eEnd - s5;
        var L = lvl * (0.8 + 0.2 * e5.stress);
        var sc = e5.syl.c && !e5.slur ? e5.syl.c : null, fricative = sc === "f" || sc === "s";
        var starting = j5 === 0 || ev[j5 - 1].rest;
        if (starting) {
          var att = Math.min(0.05 + (1 - who.conf) * 0.12 + (fricative ? 0 : 0.03), len * 0.45);
          var from0 = s5 - (sc ? 0.02 : 0.04);
          if (fits(from0)) pt(from0, 0);
          pt(s5 + att, L);
        } else if (e5.slur) {
          // melisma: no re-attack, just the new pitch
        } else {
          // the dip was reached at the end of the note before; rise out of it
          pt(s5 + Math.min(0.05 + (fricative ? 0.02 : 0), len * 0.4), L);
        }
        // long notes breathe: a small swell and a relaxation (messa di voce)
        if (len > 0.9) { pt(s5 + len * 0.45, L * 1.1); pt(eEnd - 0.12, L * 0.92); }
        if (nxtRest) {
          var rel = Math.min(0.28, Math.max(0.1, len * 0.3), len * 0.6);
          if (fits(eEnd - rel)) pt(eEnd - rel, L * (len > 0.9 ? 0.92 : 1));
          pt(eEnd + 0.03, 0);
        } else if (!ev[j5 + 1].slur) {
          // the join: hold, then dip into the next syllable's consonant
          var nx = ev[j5 + 1];
          var nsc = nx.syl && nx.syl.c ? nx.syl.c : null;
          var cd2 = nsc ? CONS_DUR[nsc] : 0.05;
          // (a sung s or f all but stops the voice; in a legato ward, not quite)
          var dip = nsc === "f" || nsc === "s" ? 0.25 : nsc === "m" ? 0.55 : nsc === "l" ? 0.62 : 0.72;
          var nL = lvl * (0.8 + 0.2 * nx.stress);
          var dipAt = eEnd - cd2 * 0.8;
          if (len <= 0.9 && fits(dipAt - 0.04) && dipAt - 0.04 > s5 + 0.06) pt(dipAt - 0.04, L * 0.97);
          pt(Math.max(dipAt, lastT + MIN_RAMP), nL * dip);
        }
      }

      var startAt = soundFrom + r.rnd(0, 0.01);
      osc.start(startAt); osc.stop(soundTo);
    }

    aspSrc.start(soundFrom, r.rnd(0, 1.9)); aspSrc.stop(soundTo);
    // let go of the room when the line is done: the whole throat is unhooked
    // from its destination (or its shared panner) and can be collected
    if (firstOsc) firstOsc.onended = function () { try { tail.disconnect(); } catch (err) { /* already gone */ } };
    budget.add(kind, nodes, soundFrom, dies);          // the span it sounds (and costs)
    return end;
  }

  // one person inside a throat (the throat carries their lateness; `lag` is
  // only a desk-mate's offset from the desk)
  function person(D, r, over) {
    over = over || {};
    return {
      variant: r.rint(0, 11),
      tilt: D.tilt + r.rnd(-0.08, 0.08),
      lag: over.lag || 0,
      slop: (0.006 + (1 - D.conf) * 0.035) * (over.slopMul || 1),
      scoop: 25 + (1 - D.conf) * 110,
      conf: D.conf,
      habit: D.habit + (over.detune || 0),
      drift: D.drift,
      sag: D.sag,
      vibRate: over.vibRate || D.vibRate,
      vibDepth: over.vibDepth != null ? over.vibDepth : D.vibDepth,
      vibDelay: over.vibDelay != null ? over.vibDelay : D.vibDelay,
      level: (over.level || 1) * (0.62 + 0.38 * D.conf),
    };
  }

  // ==========================================================================
  // singer(spec) — one person, noticeably a person.
  //   spec = { part: S|A|T|B|child, age: young|mid|old,
  //            vibrato: {rate, depth (cents), onsetDelay (s)}, breath 0..1,
  //            brightness 0..1, pitchHabitCents, timingHabitMs, confidence 0..1,
  //            level (a multiplier, default 1), pan, sharedPan (one of the
  //            destination's shared pan positions instead of a panner of
  //            their own), seed | rand }
  // ==========================================================================
  function singer(spec) {
    spec = spec || {};
    var r = streamFor(spec, "singer:" + (spec.name || spec.part || "S"));
    var D = personDefaults(spec, r);
    D.rand = r;
    var who = person(D, r);
    function sing(ctx, dest, t, notes, gain, opts) {
      return renderLine(ctx, dest, D, [who], t, notes, gain == null ? 1 : gain, spec.kind || "singer", opts);
    }
    return {
      spec: spec, traits: D,
      sing: sing,
      hum: function (ctx, dest, t, notes, gain, opts) { return sing(ctx, dest, t, withVowel(notes, "hum"), gain, opts); },
    };
  }

  // ==========================================================================
  // desk(spec) — a pew: 2–4 people, one shared mouth. (The fallback, should a
  // device prove it cannot hold the full ward: never a planned reduction.)
  //   spec = { part, voices 2..4, age, confidence, brightness, breath,
  //            lag (s, the whole pew's lateness), spreadMs (between people),
  //            detuneCents (the spread of their pitches), pan, seed | rand }
  // Why it does not flange: every person has their own glottal wave (phases),
  // their own ±detune (≥ 5 cents apart, never a constant tiny offset), their
  // own drift walk and their own vibrato rate — so the beats between them
  // wander instead of sweeping one comb up and down the spectrum.
  // ==========================================================================
  function desk(spec) {
    spec = spec || {};
    var r = streamFor(spec, "desk:" + (spec.name || spec.part || "S"));
    var D = personDefaults(spec, r);
    D.rand = r;
    var n = clamp(spec.voices || 3, 1, 4);
    var spread = (spec.spreadMs != null ? spec.spreadMs : 28) / 1000;
    var det = spec.detuneCents != null ? spec.detuneCents : 11;
    D.late += spec.lag || 0;
    // young pews beat too regularly without a floor under their wandering
    if (D.age === "young" && spec.drift == null) D.drift = Math.max(D.drift, 3.5);
    if (D.age === "young" && !(spec.vibrato && spec.vibrato.depth != null)) D.vibDepth = Math.max(D.vibDepth, 24);
    // detunes: spread evenly across ±det, shuffled, jittered — distinct by construction
    var slots = [];
    for (var i = 0; i < n; i++) slots.push(n === 1 ? 0 : -det + (2 * det * i) / (n - 1));
    var people = [];
    for (var j = 0; j < n; j++) {
      var pick = slots.splice(r.rint(0, slots.length - 1), 1)[0];
      people.push(person(D, r, {
        detune: pick + r.rnd(-1.5, 1.5),
        lag: j === 0 ? 0 : r.rnd(-spread, spread),
        vibRate: D.vibRate * r.rnd(0.88, 1.12),
        vibDepth: D.vibDepth * r.rnd(0.6, 1.25),
        vibDelay: D.vibDelay * r.rnd(0.8, 1.4),
        level: r.rnd(0.8, 1.0),
      }));
    }
    function sing(ctx, dest, t, notes, gain, opts) {
      return renderLine(ctx, dest, D, people, t, notes, gain == null ? 1 : gain, "desk", opts);
    }
    return {
      spec: spec, traits: D, part: D.part, voices: n,
      sing: sing,
      hum: function (ctx, dest, t, notes, gain, opts) { return sing(ctx, dest, t, withVowel(notes, "hum"), gain, opts); },
    };
  }

  function withVowel(notes, v) { return notes.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; if (!c.rest) c.vowel = v; return c; }); }

  // ==========================================================================
  // ornament(notes, rand, opts) — a performer's decoration of a plain line:
  // slides into leaps, passing tones through thirds, turns and upper
  // neighbours on long notes. Pure: returns new notes, draws every die
  // unconditionally (SCORE §3), so a refused ornament never shifts the next.
  //   opts = { amount 0..1, tonicHz, scale: [ratios within the octave] }
  // ==========================================================================
  function scaleTones(opts) {
    var sc = opts.scale || [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8], out = [];
    for (var o = -3; o <= 3; o++) for (var i = 0; i < sc.length; i++) out.push(opts.tonicHz * sc[i] * Math.pow(2, o));
    return out.sort(function (a, b) { return a - b; });
  }
  function neighbor(tones, f, dir) {
    if (dir > 0) { for (var i = 0; i < tones.length; i++) if (tones[i] > f * 1.02) return tones[i]; }
    else { for (var j = tones.length - 1; j >= 0; j--) if (tones[j] < f / 1.02) return tones[j]; }
    return f;
  }
  function ornament(notes, r, opts) {
    opts = opts || {};
    var amt = opts.amount != null ? opts.amount : 0.6;
    var tones = scaleTones({ tonicHz: opts.tonicHz || 196, scale: opts.scale });
    var out = [];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i], nx = notes[i + 1], pv = notes[i - 1];
      var dSlide = r.next ? r.next() : r.rnd(0, 1), dTurn = r.rnd(0, 1), dPass = r.rnd(0, 1), dGrace = r.rnd(0, 1), dShape = r.rnd(0, 1);
      if (n.rest) { out.push(n); continue; }
      var base = {}; for (var k in n) base[k] = n[k];
      var leap = pv && !pv.rest && Math.abs(Math.log(n.f / pv.f)) > 0.17;   // > ~3 semitones
      if (leap && dSlide < amt * 0.9) base.slide = true;
      var pieces = [base];
      if (n.dur >= 0.9 && dTurn < amt * 0.7) {
        // a turn: upper, main, lower, main — or (dShape) an upper-neighbour sigh
        var u = neighbor(tones, n.f, 1), l = neighbor(tones, n.f, -1), q = Math.min(0.16, n.dur * 0.12);
        if (dShape < 0.6) {
          pieces = [cp(base, { dur: n.dur - 3 * q }), cp(base, { f: u, dur: q, slur: true, slide: false }), cp(base, { dur: q, slur: true, slide: false }), cp(base, { f: l, dur: q, slur: true, slide: false })];
          // end back on the main note by stealing from the first piece
          pieces[0].dur -= q; pieces.push(cp(base, { dur: q, slur: true, slide: false }));
        } else {
          pieces = [cp(base, { dur: n.dur * 0.6 }), cp(base, { f: u, dur: n.dur * 0.22, slur: true, slide: true }), cp(base, { dur: n.dur * 0.18, slur: true })];
        }
      } else if (nx && !nx.rest && dPass < amt * 0.8) {
        var ratio = nx.f / n.f, lr = Math.abs(Math.log(ratio));
        if (lr > 0.16 && lr < 0.36) {
          // a third: fill it with the scale tone between
          var mid = neighbor(tones, n.f, ratio > 1 ? 1 : -1);
          var pd = Math.min(n.dur * 0.35, 0.3);
          pieces = [cp(base, { dur: n.dur - pd }), cp(base, { f: mid, dur: pd, slur: true, slide: false })];
        }
      }
      if (dGrace < amt * 0.25 && n.dur >= 0.5 && pieces.length === 1) {
        // a grace from above, snatched
        var g = neighbor(tones, n.f, 1);
        pieces = [cp(base, { f: g, dur: 0.09 }), cp(base, { dur: n.dur - 0.09, slur: true, slide: false })];
      }
      for (var p = 0; p < pieces.length; p++) out.push(pieces[p]);
    }
    return out;
  }
  function cp(n, over) { var c = {}; for (var k in n) c[k] = n[k]; for (var o in over) c[o] = over[o]; return c; }

  // ==========================================================================
  // precentor(spec) — a singer who lines out: sings the plain line with his
  // own ornaments (slides into leaps, turns on the long notes).
  // ==========================================================================
  function precentor(spec) {
    spec = spec || {};
    var s = singer(Object.assign({ part: "T", age: "mid", confidence: 0.95, brightness: 0.6, breath: 0.4, vibrato: { rate: 5.2, depth: 30, onsetDelay: 0.45 }, name: "precentor", kind: "precentor" }, spec));
    var orn = streamFor(spec, "precentor:ornament");
    return {
      spec: spec, traits: s.traits, singer: s,
      line: function (ctx, dest, t, notes, gain, opts) {
        return s.sing(ctx, dest, t, ornament(notes, opts && opts.rand || orn, Object.assign({ amount: 0.75 }, opts || {})), gain, opts);
      },
      sing: s.sing, hum: s.hum,
    };
  }

  // ==========================================================================
  // congregation(spec) — the ward, as desks (the fallback; see desk()).
  //   spec = { desks: 4..8, voicesPerDesk: 2..4,
  //            parts: ["S","A","T","B",…] (optional; defaults spread the
  //            parts), width (pan spread 0..1), seed | rand }
  // sing(ctx, dest, t, {S,A,T,B}, gain) — each desk sings its part's notes.
  // lined(ctx, dest, t, melody, gain, opts) — the Old Way reply: every desk
  //   on the tune (men an octave down), each ornamenting in its own way,
  //   each arriving in its own time. Pass the melody already slowed.
  // ==========================================================================
  var PART_ORDER = ["S", "B", "A", "T", "S", "B", "A", "T"];
  function congregation(spec) {
    spec = spec || {};
    var nd = clamp(spec.desks || 6, 1, 8);
    var root = streamFor(spec, "congregation");
    var width = spec.width != null ? spec.width : 0.75;
    var desks = [];
    for (var i = 0; i < nd; i++) {
      var part = spec.parts && spec.parts[i] ? spec.parts[i] : PART_ORDER[i];
      var r = root.fork("desk:" + i);
      var sameBefore = 0; for (var j = 0; j < i; j++) if (desks[j].part === part) sameBefore++;
      var pan = clamp(PART[part].pan * width * 1.2 + (sameBefore ? (sameBefore % 2 ? -0.35 : 0.35) * width : 0) + r.rnd(-0.08, 0.08), -0.9, 0.9);
      desks.push(desk({
        part: part, rand: r, name: "desk" + i,
        voices: spec.voicesPerDesk || 3,
        age: r.pick(["young", "mid", "mid", "old"]),
        confidence: r.rnd(0.45, 0.85),
        brightness: r.rnd(0.35, 0.6),
        breath: r.rnd(0.25, 0.5),
        lag: r.rnd(0, 0.07),
        spreadMs: r.rnd(18, 40),
        detuneCents: r.rnd(8, 14),
        pan: pan,
      }));
    }
    var orn = root.fork("lined"), linedCalls = 0;
    function perPartGain(part) { var c = 0; for (var i = 0; i < desks.length; i++) if (desks[i].part === part) c++; return 1 / Math.sqrt(Math.max(1, c)); }
    return {
      desks: desks,
      sing: function (ctx, dest, t, parts, gain, opts) {
        var end = t;
        for (var i = 0; i < desks.length; i++) {
          var d = desks[i], line = parts[d.part];
          if (!line) continue;
          end = Math.max(end, d.sing(ctx, dest, t, line, (gain == null ? 1 : gain) * perPartGain(d.part), opts));
        }
        return end;
      },
      hum: function (ctx, dest, t, parts, gain, opts) {
        var hp = {}; for (var k in parts) hp[k] = withVowel(parts[k], "hum");
        return this.sing(ctx, dest, t, hp, gain, opts);
      },
      lined: function (ctx, dest, t, melody, gain, opts) {
        opts = opts || {};
        var end = t, g = (gain == null ? 1 : gain) / Math.sqrt(desks.length / 2), call = linedCalls++;
        for (var i = 0; i < desks.length; i++) {
          var d = desks[i];
          var oct = d.part === "T" || d.part === "B" ? (opts.menOctave != null ? opts.menOctave : 0.5) : 1;
          var line = melody.map(function (n) { return n.rest ? n : cp(n, { f: n.f * oct }); });
          // a desk's appetite for ornament is its habit (same every line); the
          // ornaments themselves are new each line
          var mine = ornament(line, orn.fork("desk:" + i + ":" + call), { amount: (opts.amount != null ? opts.amount : 0.55) * orn.fork("amt:" + i).rnd(0.5, 1.2), tonicHz: opts.tonicHz, scale: opts.scale });
          var arrive = orn.fork("arrive:" + i + ":" + call).rnd(0, opts.spread != null ? opts.spread : 0.35);
          end = Math.max(end, d.sing(ctx, dest, t + arrive, mine, g, opts));
        }
        return end;
      },
    };
  }

  // A rough budget without rendering: nodes built for a throat of n people
  // singing a line with v distinct vowel banks (a gate and three filters
  // each), plus the inhale and the fricative when the line has them.
  function estimateNodes(people, vowels, extras) {
    return 5 + (people > 1 ? 1 : 0) + 4 * people + 4 * (vowels || 3) + 2 * (extras || 0);
  }

  return {
    singer: singer,
    desk: desk,
    congregation: congregation,
    precentor: precentor,
    ornament: ornament,
    budget: budget,
    estimateNodes: estimateNodes,
    VOWELS: VOWELS,
    SYLLABLES: Object.keys(SYL),
    // for the benches (pure): the make-up gain's arithmetic
    _mouth: { bankSpec: bankSpec, biquadCoefs: biquadCoefs, mouthEnergy: mouthEnergy, INTRINSIC: INTRINSIC, PART: PART },
  };
})();
