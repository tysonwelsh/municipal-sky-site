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
//                     congregation and never lock into a flanger.
//  · congregation()   4–8 desks, the massed singing; `desks` is the quality
//                     knob (phones get fewer pews, not a worse room).
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
// t is the VOWEL onset of the first note (singers land the vowel on the
// beat); a leading consonant anticipates it by up to ~0.12 s and an inhale
// by ~0.35 s, so give sing() that much lead.
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
    //       tract   scale  lowest useful Hz (mud guard)  default pan
    S:     { tract: "w", k: 1.00, hp: 200, pan: 0.30 },
    A:     { tract: "w", k: 0.95, hp: 170, pan: -0.30 },
    T:     { tract: "m", k: 1.03, hp: 120, pan: 0.45 },
    B:     { tract: "m", k: 0.95, hp: 78,  pan: -0.45 },
    child: { tract: "w", k: 1.16, hp: 260, pan: 0.10 },
  };
  // A syllable is (consonant) + vowel + (coda). The four shape-note syllables
  // are the reason consonants exist here at all: fa, sol, la, mi.
  var SYL = {
    ah: { v: "ah" }, oh: { v: "oh" }, oo: { v: "oo" }, ee: { v: "ee" }, eh: { v: "eh" },
    fa: { c: "f", v: "ah" }, sol: { c: "s", v: "oh", coda: "l" }, la: { c: "l", v: "ah" }, mi: { c: "m", v: "ee" },
    hum: { v: "hum" }, mm: { v: "hum" },
  };
  var CONS_DUR = { f: 0.085, s: 0.11, l: 0.06, m: 0.075 };

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
  function noiseBuf(ctx) {
    if (ctx.__kolobVocalNoise) return ctx.__kolobVocalNoise;
    var len = Math.floor(ctx.sampleRate * 2.5), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    var r = localStream(0xb4ea7);
    for (var i = 0; i < len; i++) d[i] = r.rnd(-1, 1);
    return (ctx.__kolobVocalNoise = b);
  }

  // --------------------------------------------------------------------------
  // THE BUDGET — a ledger of node lifetimes, so a lab (or the core) can ask
  // "how many nodes are alive at second s" without instrumenting Web Audio.
  // Every renderLine() files one entry: its node count and [born, dies].
  // --------------------------------------------------------------------------
  var ledger = [];
  var budget = {
    add: function (kind, nodes, t0, t1) { ledger.push({ kind: kind, nodes: nodes, t0: t0, t1: t1 }); if (ledger.length > 4000) ledger.splice(0, 1000); },
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
      hp: PART[part].hp,
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
    };
  }

  // --------------------------------------------------------------------------
  // renderLine — the one renderer. A "throat" of nVoices people (1 for a
  // singer, 2–4 for a desk) shares one breath, one mud guard, one tilt and
  // one set of vowel banks; each person has their own source, vibrato, drift,
  // timing and envelope.
  //
  //   person osc ─► person env ─┐
  //   person osc ─► person env ─┼─► sum ─► hp ─► tilt lp ─► pre ─┬─► bank ah ─► gate ─┐
  //   noise ─► hp ─► aspiration ───────────────────────────────►┘   bank ee ─► gate ─┼─► out ─► pan ─► dest
  //                  └─► inhale ───────────────────────────────────────────────────────┤
  //   noise ─► fricative bp ─► fric (f, s) ─────────────────────────────────────────────┘
  // --------------------------------------------------------------------------
  function renderLine(ctx, dest, P, people, t, notes, gain, kind) {
    var nodes = 0;
    function mk(fn) { nodes++; return fn(); }
    var r = P.rand;
    if (!notes || !notes.length) return t;

    // ---- the timeline (nominal, i.e. the throat's own) ----
    var ev = [], tt = t;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var syl = n.rest ? null : (SYL[n.vowel || "ah"] || SYL.ah);
      ev.push({ s: tt, d: n.dur, f: n.f, rest: !!n.rest || !n.f, syl: syl, slur: !!n.slur, slide: !!n.slide, stress: n.stress != null ? n.stress : 1 });
      tt += n.dur;
    }
    var end = tt;
    var born = t - 0.45, dies = end + 0.4;

    // ---- shared chain ----
    var out = mk(function () { return ctx.createGain(); });
    out.gain.setValueAtTime(gain, born);
    var pan = mk(function () { return ctx.createStereoPanner(); });
    pan.pan.setValueAtTime(clamp(P.pan, -1, 1), born);
    out.connect(pan); pan.connect(dest);

    var sum = mk(function () { return ctx.createGain(); });
    sum.gain.setValueAtTime(1 / Math.sqrt(people.length), born);
    var hp = mk(function () { return ctx.createBiquadFilter(); });
    hp.type = "highpass"; hp.frequency.setValueAtTime(P.hp, born); hp.Q.setValueAtTime(0.6, born);
    var tilt = mk(function () { return ctx.createBiquadFilter(); });
    tilt.type = "lowpass"; tilt.frequency.setValueAtTime(4200 + 2400 * P.bright, born); tilt.Q.setValueAtTime(0.6, born);
    var pre = mk(function () { return ctx.createGain(); });
    pre.gain.setValueAtTime(0.11, born);
    sum.connect(hp); hp.connect(tilt); tilt.connect(pre);

    // breath: one noise for the throat — aspiration into the mouth (so it
    // takes the vowel's colour), an inhale straight out, fricatives for f/s
    var noise = mk(function () { return ctx.createBufferSource(); });
    noise.buffer = noiseBuf(ctx); noise.loop = true;
    var nhp = mk(function () { return ctx.createBiquadFilter(); });
    nhp.type = "highpass"; nhp.frequency.setValueAtTime(1100, born); nhp.Q.setValueAtTime(0.5, born);
    var asp = mk(function () { return ctx.createGain(); });
    var inh = mk(function () { return ctx.createGain(); });
    var fbp = mk(function () { return ctx.createBiquadFilter(); });
    fbp.type = "bandpass"; fbp.frequency.setValueAtTime(5200, born); fbp.Q.setValueAtTime(0.9, born);
    var fric = mk(function () { return ctx.createGain(); });
    noise.connect(nhp); nhp.connect(asp); nhp.connect(inh); noise.connect(fbp); fbp.connect(fric);
    // aspiration and the inhale go in through the mouth (tilt → banks): the
    // breath takes the vowel's shape and loses its hiss
    asp.connect(tilt); inh.connect(tilt); fric.connect(out);
    asp.gain.setValueAtTime(0, born); inh.gain.setValueAtTime(0, born); fric.gain.setValueAtTime(0, born);

    // ---- the vowel banks: created on first use, fixed for life ----
    var banks = {};
    function bank(key, f0) {
      var reg = (key === "hum" || key === "m" || key === "l") ? "" : "|" + Math.round(Math.max(0, f0 * 1.08 - VOWELS[key][P.tract][0] * P.k) / 60);
      var id = key + reg;
      if (banks[id]) return banks[id];
      var spec = bankSpec(key, P.tract, P.k, f0, P.bright);
      var prev = pre;
      for (var j = 0; j < spec.length; j++) {
        var bq = mk(function () { return ctx.createBiquadFilter(); });
        bq.type = spec[j].type;
        bq.frequency.setValueAtTime(spec[j].f, born);          // born with it…
        bq.Q.setValueAtTime(spec[j].q, born);
        bq.gain.setValueAtTime(spec[j].g, born);               // …dies with it
        prev.connect(bq); prev = bq;
      }
      var gate = mk(function () { return ctx.createGain(); });
      gate.gain.setValueAtTime(0, born);
      prev.connect(gate); gate.connect(out);
      return (banks[id] = { gate: gate, open: false, last: born });
    }
    // gate crossfades: open b while closing a, centred on time c, width w
    var cur = null;
    function switchTo(b, c, w) {
      if (b === cur) return;
      var a0 = Math.max(c - w / 2, born + 0.001);
      if (cur) {
        var g = cur.gate.gain;
        g.setValueAtTime(1, Math.max(a0, cur.last)); g.linearRampToValueAtTime(0, a0 + w); cur.last = a0 + w;
      }
      var gb = b.gate.gain;
      gb.setValueAtTime(0, Math.max(a0, b.last)); gb.linearRampToValueAtTime(1, a0 + w); b.last = a0 + w;
      cur = b;
    }

    // ---- walk the syllables: which mouth, when; consonant windows ----
    var cons = [];           // {s, e, c} consonant windows (nominal)
    var lastF = null;
    for (var k = 0; k < ev.length; k++) {
      var e = ev[k];
      if (e.rest) continue;
      var sy = e.syl;
      if (!e.slur && sy.c) {
        var cd = CONS_DUR[sy.c], cs = e.s - cd * 0.8;
        cons.push({ s: cs, e: e.s + cd * 0.2, c: sy.c });
        if (sy.c === "m" || sy.c === "l") switchTo(bank(sy.c, e.f), cs, 0.03);
        switchTo(bank(sy.v, e.f), e.s + cd * 0.2, sy.c === "m" || sy.c === "l" ? 0.05 : 0.03);
      } else {
        // vowel to vowel: a slower crossfade — the mouth reshapes through the join
        switchTo(bank(sy.v, e.f), e.s, cur ? 0.09 : 0.02);
      }
      if (sy.coda && !(ev[k + 1] && ev[k + 1].slur)) {
        // "sol": the l closes the syllable in its last 12 %
        var ce = e.s + e.d, cl = Math.min(0.09, e.d * 0.12);
        var nxt = ev[k + 1];
        if (nxt && !nxt.rest) switchTo(bank("l", e.f), ce - cl - 0.02, 0.04);
      }
      lastF = e.f;
    }

    // ---- breath events (shared): inhale before the line and at each rest ----
    var br = P.breath;
    function inhale(at, len) {
      if (at < born + 0.01) return;
      inh.gain.setValueAtTime(0, at);
      inh.gain.linearRampToValueAtTime(0.10 * br, at + len * 0.6);
      inh.gain.linearRampToValueAtTime(0, at + len);
    }
    inhale(t - 0.42, 0.34);
    for (var q = 0; q < ev.length; q++) if (ev[q].rest && ev[q].d > 0.25) inhale(ev[q].s + ev[q].d - 0.36, 0.32);
    // fricatives
    for (var c2 = 0; c2 < cons.length; c2++) {
      var C = cons[c2];
      if (C.c !== "f" && C.c !== "s") continue;
      var peak = C.c === "s" ? 0.055 : 0.025;
      fric.gain.setValueAtTime(0, C.s);
      fric.gain.linearRampToValueAtTime(peak, C.s + (C.e - C.s) * 0.35);
      fric.gain.linearRampToValueAtTime(peak * 0.7, C.s + (C.e - C.s) * 0.7);
      fric.gain.linearRampToValueAtTime(0, C.e + 0.015);
    }
    // aspiration rides the phonation: a steady breathiness, and a puff "h"
    // where a phrase begins on a bare vowel
    var aspLvl = 0.10 * br;
    var phr = true;
    for (var a = 0; a < ev.length; a++) {
      var ea = ev[a];
      if (ea.rest) {
        asp.gain.setValueAtTime(aspLvl, Math.max(born + 0.002, ea.s - 0.08));
        asp.gain.linearRampToValueAtTime(0, ea.s + 0.02);
        phr = true; continue;
      }
      if (phr) {
        var hs = ea.s - 0.07;
        asp.gain.setValueAtTime(0, hs);
        asp.gain.linearRampToValueAtTime(ea.syl.c ? aspLvl : aspLvl * 2.8, hs + 0.05);
        asp.gain.linearRampToValueAtTime(aspLvl, ea.s + 0.12);
        phr = false;
      }
    }
    asp.gain.setValueAtTime(aspLvl, Math.max(end - 0.3, t + 0.2));
    asp.gain.linearRampToValueAtTime(0, end + 0.25);

    // ---- the people ----
    for (var p = 0; p < people.length; p++) renderPerson(people[p]);

    function renderPerson(who) {
      var osc = mk(function () { return ctx.createOscillator(); });
      osc.setPeriodicWave(waveFor(ctx, who.tilt, who.variant));
      var envG = mk(function () { return ctx.createGain(); });
      var lfo = mk(function () { return ctx.createOscillator(); });
      lfo.type = "sine";
      var lfoG = mk(function () { return ctx.createGain(); });
      osc.connect(envG); envG.connect(sum);
      lfo.connect(lfoG); lfoG.connect(osc.detune);

      // this person's onsets: habit + desk lag + a little per-note slop;
      // the less confident, the sloppier, and never out of order
      var on = [], prevOn = -1e9;
      for (var i2 = 0; i2 < ev.length; i2++) {
        var o = ev[i2].s + who.lag + gauss(r) * who.slop;
        if (ev[i2].slur) o = ev[i2].s + who.lag;                 // melisma: no re-attack slop
        o = Math.max(o, prevOn + 0.04, born + 0.05);
        on.push(o); prevOn = o;
      }
      var endP = end + who.lag;

      // --- pitch: scoops on the OSCILLATOR, never on a filter ---
      var fr = osc.frequency, prevF = null, fT = born;
      // every event strictly after the last: a grace note's glide may not
      // reach back into the one before it
      function fset(v, time) { time = Math.max(time, fT + 0.001); fr.setValueAtTime(v, time); fT = time; }
      function framp(v, time) { time = Math.max(time, fT + 0.002); fr.linearRampToValueAtTime(v, time); fT = time; }
      for (var j2 = 0; j2 < ev.length; j2++) {
        var e2 = ev[j2];
        if (e2.rest) { prevF = null; continue; }
        var target = e2.f, s0 = on[j2];
        if (prevF == null) {
          // a fresh entry: from below, by how unsure this person is
          var from = target * Math.pow(2, -(who.scoop * r.rnd(0.7, 1.3)) / 1200);
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

      // --- detune: habit + wandering + (old) sag inside long notes ---
      var dt = osc.detune, walk = 0, dT = born;
      dt.setValueAtTime(who.habit, born);
      for (var j3 = 0; j3 < ev.length; j3++) {
        var e3 = ev[j3];
        if (e3.rest) continue;
        var s3 = on[j3], steps = Math.max(1, Math.round(e3.d / 0.32));
        for (var st = 1; st <= steps; st++) {
          walk = walk * 0.6 + gauss(r) * who.drift;
          var sag = who.sag * (st / steps) * (e3.d > 1 ? 1 : 0.3);
          var at3 = Math.max(s3 + e3.d * st / steps, dT + 0.01);
          dt.linearRampToValueAtTime(who.habit + walk - sag, at3); dT = at3;
        }
      }

      // --- vibrato: late bloom. A little shimmer at the onset; the full
      // vibrato only in a note long enough to have one ---
      lfo.frequency.setValueAtTime(who.vibRate, born);
      var vg = lfoG.gain, vT = born, vCur = 0;
      vg.setValueAtTime(0, born);
      function vset(v, time) { time = Math.max(time, vT + 0.001); vg.setValueAtTime(v, time); vT = time; vCur = v; }
      function vramp(v, time) { time = Math.max(time, vT + 0.002); vg.linearRampToValueAtTime(v, time); vT = time; vCur = v; }
      for (var j4 = 0; j4 < ev.length; j4++) {
        var e4 = ev[j4];
        if (e4.rest) continue;
        var s4 = on[j4], bloomAt = s4 + who.vibDelay;
        var nextS = j4 + 1 < ev.length ? on[j4 + 1] : endP;
        // settle back to a shimmer across the join (a ramp, not a step: a
        // step in depth is a step in pitch)
        vset(vCur, s4 - 0.03);
        vramp(who.vibDepth * 0.12, s4 + 0.05);
        var rateJ = r.rnd(0.96, 1.04);
        if (nextS - bloomAt > 0.25) {
          vset(who.vibDepth * 0.12, bloomAt);
          vramp(who.vibDepth, Math.min(nextS - 0.06, bloomAt + 0.45));
          lfo.frequency.setValueAtTime(who.vibRate * rateJ, bloomAt);
        }
      }

      // --- the envelope: phrase shape, accents, articulation, consonants ---
      var g = envG.gain, lvl = who.level;
      g.setValueAtTime(0, born);
      var lastT = born;
      function pt(time, v) { if (time <= lastT + 0.0005) time = lastT + 0.0005; g.linearRampToValueAtTime(v, time); lastT = time; }
      function hold(time, v) { if (time <= lastT + 0.0005) time = lastT + 0.0005; g.setValueAtTime(v, time); lastT = time; }
      for (var j5 = 0; j5 < ev.length; j5++) {
        var e5 = ev[j5];
        if (e5.rest) continue;
        var s5 = on[j5];
        var nxtRest = j5 + 1 >= ev.length || ev[j5 + 1].rest;
        var eEnd = j5 + 1 < ev.length ? on[j5 + 1] : endP;
        var L = lvl * (0.8 + 0.2 * e5.stress);
        var sc = e5.syl.c && !e5.slur ? e5.syl.c : null;
        var starting = j5 === 0 || ev[j5 - 1].rest;
        if (starting) {
          var att = 0.05 + (1 - who.conf) * 0.12 + (sc === "f" || sc === "s" ? 0 : 0.03);
          hold(s5 - (sc ? 0.02 : 0.04), 0);
          pt(s5 + att, L);
        } else if (e5.slur) {
          // melisma: no re-attack, just the new pitch
        } else {
          var dip = sc === "f" || sc === "s" ? 0.06 : sc === "m" ? 0.55 : sc === "l" ? 0.62 : 0.72;
          var cdur = sc ? CONS_DUR[sc] : 0.05;
          pt(s5 - cdur * 0.8, L * dip);
          pt(s5 + 0.05 + (sc === "f" || sc === "s" ? 0.02 : 0), L);
        }
        // long notes breathe: a small swell and a relaxation (messa di voce)
        var len = eEnd - s5;
        if (len > 0.9) { pt(s5 + len * 0.45, L * 1.1); pt(eEnd - 0.12, L * 0.92); }
        if (nxtRest) {
          var rel = Math.min(0.28, Math.max(0.1, len * 0.3));
          pt(eEnd - rel, L * (len > 0.9 ? 0.92 : 1));
          pt(eEnd + 0.03, 0);
        } else {
          var nx = ev[j5 + 1];
          var nsc = nx.syl && nx.syl.c && !nx.slur ? nx.syl.c : null;
          var cd2 = nsc ? CONS_DUR[nsc] : 0.05;
          if (len > 0.9) { /* the swell already set a point */ } else pt(Math.max(s5 + 0.08, eEnd - cd2 * 0.8 - 0.04), L * 0.97);
        }
      }

      var startAt = born + 0.02 + r.rnd(0, 0.01);
      osc.start(startAt); osc.stop(dies);
      lfo.start(startAt + r.rnd(0, 1 / who.vibRate)); lfo.stop(dies);
    }

    noise.start(born, r.rnd(0, 2)); noise.stop(dies);
    budget.add(kind, nodes, born, dies);
    return end;
  }

  // one person inside a throat
  function person(D, r, over) {
    over = over || {};
    return {
      variant: r.rint(0, 11),
      tilt: D.tilt + r.rnd(-0.08, 0.08),
      lag: D.late + (over.lag || 0),
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
  //            pan, seed | rand }
  // ==========================================================================
  function singer(spec) {
    spec = spec || {};
    var r = streamFor(spec, "singer:" + (spec.name || spec.part || "S"));
    var D = personDefaults(spec, r);
    D.rand = r;
    var who = person(D, r);
    function sing(ctx, dest, t, notes, gain) {
      return renderLine(ctx, dest, D, [who], t, notes, gain == null ? 1 : gain, spec.kind || "singer");
    }
    return {
      spec: spec, traits: D,
      sing: sing,
      hum: function (ctx, dest, t, notes, gain) { return sing(ctx, dest, t, withVowel(notes, "hum"), gain); },
    };
  }

  // ==========================================================================
  // desk(spec) — a pew: 2–4 people, one shared mouth.
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
    function sing(ctx, dest, t, notes, gain) {
      return renderLine(ctx, dest, D, people, t, notes, gain == null ? 1 : gain, "desk");
    }
    return {
      spec: spec, traits: D, part: D.part, voices: n,
      sing: sing,
      hum: function (ctx, dest, t, notes, gain) { return sing(ctx, dest, t, withVowel(notes, "hum"), gain); },
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
        return s.sing(ctx, dest, t, ornament(notes, opts && opts.rand || orn, Object.assign({ amount: 0.75 }, opts || {})), gain);
      },
      sing: s.sing, hum: s.hum,
    };
  }

  // ==========================================================================
  // congregation(spec) — the ward, as desks.
  //   spec = { desks: 4..8 (the QUALITY knob), voicesPerDesk: 2..4,
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
      sing: function (ctx, dest, t, parts, gain) {
        var end = t;
        for (var i = 0; i < desks.length; i++) {
          var d = desks[i], line = parts[d.part];
          if (!line) continue;
          end = Math.max(end, d.sing(ctx, dest, t, line, (gain == null ? 1 : gain) * perPartGain(d.part)));
        }
        return end;
      },
      hum: function (ctx, dest, t, parts, gain) {
        var hp = {}; for (var k in parts) hp[k] = withVowel(parts[k], "hum");
        return this.sing(ctx, dest, t, hp, gain);
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
          end = Math.max(end, d.sing(ctx, dest, t + arrive, mine, g));
        }
        return end;
      },
    };
  }

  // A rough budget without rendering: nodes alive for a throat of n people
  // singing a line with v distinct vowels (3 filters + a gate per bank).
  function estimateNodes(people, vowels) { return 12 + 4 * people + 4 * (vowels || 3); }

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
  };
})();
