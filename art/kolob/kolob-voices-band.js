// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE BRASS BAND (KOLOB.VoicesBand)
//
// The Nauvoo Brass Band crossed the plains in 1846 and played the camps to
// sleep; the colony kept the name and the instrumentation, because a
// saxhorn band is the right size for a town square at the edge of the
// light. Cornet on the tune, alto horns on the after-beats, the tuba's
// oom-pah under everything, and a snare and bass drum kept LIGHT — this is
// a parade, not a battle.
//
// What makes brass sound like brass, done cheaply:
//  · BRIGHTNESS FOLLOWS BREATH. A lip-buzzed horn grows richer in upper
//    harmonics as it gets louder — the one physical fact the ear uses to
//    tell brass from an organ reed. Each note runs a harmonic-rich wave
//    through a lowpass whose cutoff rises with the note's attack and its
//    dynamic, then settles back as the lips relax.
//  · THE LIP FINDS THE NOTE. Every tongued note starts a few cents flat and
//    locks on within ~30 ms: the slot of the harmonic series catching.
//  · SECTIONS HAVE A GRAIN. The cornet and tuba buses run a soft saturator
//    — at forte the edge (cuivré) comes up on its own; at piano it is
//    transparent. The alto horns stay clean: they play chords, and a shared
//    saturator would beat the chord's notes against each other.
//  · Conical bores: cornet and alto horn (saxhorns) are mellower than a
//    trumpet — the waves fall off faster and the formant sits lower.
//
// Cost: 3 nodes per brass note (osc → lowpass → gain); snare 6, bass drum
// 5; ~12 standing nodes per band. A quickstep strain with four parts runs
// about 25 nodes live at once.
//
// Public surface: KOLOB.VoicesBand.create(ctx, destination, opts) → band
//   band.play(t, notes, instrument, dynamics)
//      notes: [{f, dur, at?, acc?, stacc?}]  instrument: "cornet"|"alto"|"tuba"
//      dynamics: "pp"…"ff" or 0–1
//   band.drum(t, kind, dynamics)             kind: "snare"|"flam"|"roll"|"bass"
//   band.out (a gain — fade and pan the whole band from outside)
//   band.stats() → { standing, created, peakLive }
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.VoicesBand = (function () {
  "use strict";

  var DYN = { ppp: 0.12, pp: 0.2, p: 0.32, mp: 0.45, mf: 0.6, f: 0.78, ff: 0.95, fff: 1 };
  function dynOf(d) { return typeof d === "number" ? Math.max(0, Math.min(1, d)) : (DYN[d] != null ? DYN[d] : 0.6); }

  // the sections: spectral tilt of the wave, the formant the bell throws,
  // cutoff range (× f) from piano to forte, attack, where they stand, level
  var INSTR = {
    cornet: { tilt: 0.95, formant: 1250, fw: 700,  lo: 2.2, hi: 9,   atk: 0.022, scoop: 22, pan: -0.28, level: 0.11, grain: 1.6, vib: 4 },
    alto:   { tilt: 1.25, formant: 800,  fw: 500,  lo: 1.8, hi: 5.5, atk: 0.034, scoop: 14, pan: 0.22,  level: 0.055, grain: 0,   vib: 0 },
    tuba:   { tilt: 1.05, formant: 420,  fw: 320,  lo: 2.5, hi: 9,   atk: 0.045, scoop: 18, pan: 0.04,  level: 0.12, grain: 1.2, vib: 0 },
  };

  function mulberry(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function streamOf(opts) {
    if (opts.rand && opts.rand.rnd) return opts.rand;
    var next = (window.PJ2 && PJ2.Rand) ? PJ2.Rand.stream(opts.seed || 1846).fork("synth:band").next : mulberry(opts.seed || 1846);
    return { rnd: function (a, b) { return a + next() * (b - a); }, chance: function (p) { return next() < p; } };
  }
  var NOISE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function noiseBuf(ctx) {
    var b = NOISE && NOISE.get(ctx);
    if (b) return b;
    var n = Math.floor(ctx.sampleRate * 2), r = mulberry(0x5eed);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = r() * 2 - 1;
    if (NOISE) NOISE.set(ctx, b);
    return b;
  }

  function create(ctx, destination, opts) {
    opts = opts || {};
    var R = streamOf(opts);
    var created = 0, spans = [];
    function count(n, t0, t1) { created += n; spans.push([t0, t1, n]); }

    var out = ctx.createGain(); out.gain.value = 0.8 * (opts.gain != null ? opts.gain : 1);
    out.connect(destination);
    function panner(p) {
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.value = p;
      sp.connect(out);
      return sp;
    }
    // soft saturation: transparent at piano, an edge at forte
    function grain(drive) {
      var ws = ctx.createWaveShaper(), c = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
      ws.curve = c; ws.oversample = "2x";
      return ws;
    }
    var buses = {}, standing = 1;
    Object.keys(INSTR).forEach(function (k) {
      var spec = INSTR[k], p = panner(spec.pan);
      if (spec.grain) { var ws = grain(spec.grain); ws.connect(p); buses[k] = ws; standing += 2; }
      else { buses[k] = p; standing += 1; }
    });
    var drums = panner(0.08); standing += 1;
    var drumLP = ctx.createBiquadFilter(); drumLP.type = "lowpass"; drumLP.frequency.value = 7500; drumLP.connect(drums); standing += 1;

    // one wave per section and register (cached by quarter-octave band)
    var waves = {};
    function waveFor(k, f) {
      var band = Math.round(Math.log(f) / Math.LN2 * 4), key = k + band;
      if (waves[key]) return waves[key];
      var spec = INSTR[k], fb = Math.pow(2, band / 4);
      var n = Math.min(48, Math.floor(10000 / fb)), real = new Float32Array(n + 1), imag = new Float32Array(n + 1), ss = 0;
      for (var h = 1; h <= n; h++) {
        var hz = h * fb;
        var a = Math.pow(h, -spec.tilt) * (0.55 + Math.exp(-Math.pow((hz - spec.formant) / spec.fw, 2)));
        imag[h] = a; ss += a * a;
      }
      var nrm = 0.8 / Math.sqrt(ss / 2 + 1e-9);
      for (var j = 1; j <= n; j++) imag[j] *= nrm;
      try { waves[key] = ctx.createPeriodicWave(real, imag, { disableNormalization: true }); }
      catch (e) { waves[key] = ctx.createPeriodicWave(real, imag); }
      return waves[key];
    }

    // one tongued brass note
    function note(t, f, dur, k, dyn, acc, stacc) {
      var spec = INSTR[k];
      var d = Math.min(1, dyn * (acc ? 1.18 : 1));
      var len = stacc ? Math.min(dur, Math.max(0.09, dur * 0.45)) : dur * 0.94;
      var rel = t + len, tEnd = rel + 0.25;
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.setPeriodicWave(waveFor(k, f));
      // the lip finds the slot: a few cents flat, locked within ~30 ms
      var sc = spec.scoop * (0.6 + 0.8 * d) * R.rnd(0.7, 1.2);
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(-sc, t);
      o.detune.setTargetAtTime(0, t + 0.004, 0.012);
      if (spec.vib && len > 0.5) {                     // a little cornet vibrato on held notes only
        o.detune.setValueAtTime(0, t + 0.25);
        for (var vt = t + 0.3, ph = 0; vt < rel - 0.05; vt += 0.09, ph++) o.detune.linearRampToValueAtTime(ph % 2 ? -spec.vib : spec.vib, vt);
      }
      // brightness follows breath
      var cLo = Math.min(9000, f * spec.lo), cHi = Math.min(12000, f * (spec.lo + (spec.hi - spec.lo) * Math.pow(d, 1.4)));
      lp.type = "lowpass"; lp.Q.value = 1.1;
      lp.frequency.setValueAtTime(cLo, t);
      lp.frequency.linearRampToValueAtTime(cHi * (acc ? 1.15 : 1.05), t + spec.atk * 1.2);
      lp.frequency.setTargetAtTime(cHi * 0.72, t + spec.atk * 1.2, 0.08);
      lp.frequency.setTargetAtTime(cLo, rel, 0.03);
      var lv = spec.level * (0.25 + 0.75 * d);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lv * (acc ? 1.2 : 1.05), t + spec.atk);
      g.gain.setTargetAtTime(lv, t + spec.atk, 0.06);
      g.gain.setValueAtTime(lv, Math.max(t + spec.atk + 0.01, rel - 0.001));
      g.gain.setTargetAtTime(0, Math.max(t + spec.atk + 0.01, rel), stacc ? 0.018 : 0.035);
      o.connect(lp); lp.connect(g); g.connect(buses[k]);
      o.start(t); o.stop(tEnd);
      count(3, t, tEnd);
      return 3;
    }

    function play(t, notes, instrument, dynamics) {
      var k = INSTR[instrument] ? instrument : "cornet";
      var dyn = dynOf(dynamics), n = 0;
      notes.forEach(function (nt) {
        var d = nt.dyn != null ? dynOf(nt.dyn) : dyn;
        n += note(t + (nt.at || 0), nt.f, nt.dur, k, d, !!nt.acc, !!nt.stacc);
      });
      return n;
    }

    // ---- the drums, kept light ------------------------------------------
    function snare(t, lv) {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = R.rnd(3200, 3800); hp.Q.value = 0.7;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(lv * 0.5, t + 0.002);
      gn.gain.setTargetAtTime(0, t + 0.004, 0.045);
      src.connect(hp); hp.connect(gn); gn.connect(drumLP);
      src.start(t, R.rnd(0, 1.7)); src.stop(t + 0.35);
      var o = ctx.createOscillator(), go = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(215, t); o.frequency.exponentialRampToValueAtTime(175, t + 0.05);
      go.gain.setValueAtTime(0, t); go.gain.linearRampToValueAtTime(lv * 0.35, t + 0.002);
      go.gain.setTargetAtTime(0, t + 0.004, 0.025);
      o.connect(go); go.connect(drumLP);
      o.start(t); o.stop(t + 0.2);
      count(5, t, t + 0.35);
      return 5;
    }
    function bassDrum(t, lv) {
      var o = ctx.createOscillator(), go = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.12);
      go.gain.setValueAtTime(0, t); go.gain.linearRampToValueAtTime(lv * 0.8, t + 0.004);
      go.gain.setTargetAtTime(0, t + 0.01, 0.13);
      o.connect(go); go.connect(drums);
      o.start(t); o.stop(t + 0.9);
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(lv * 0.25, t + 0.002);
      gn.gain.setTargetAtTime(0, t + 0.004, 0.02);
      src.connect(lp); lp.connect(gn); gn.connect(drums);
      src.start(t, R.rnd(0, 1.7)); src.stop(t + 0.15);
      count(5, t, t + 0.9);
      return 5;
    }
    function drum(t, kind, dynamics) {
      var lv = 0.3 * (0.25 + 0.75 * dynOf(dynamics));
      if (kind === "bass") return bassDrum(t, lv);
      if (kind === "flam") return snare(t - 0.028, lv * 0.45) + snare(t, lv);
      if (kind === "roll") {                         // a short five-stroke roll into t
        var n = 0;
        for (var i = 0; i < 4; i++) n += snare(t - 0.2 + i * 0.05, lv * (0.35 + i * 0.06));
        return n + snare(t, lv);
      }
      return snare(t, lv);
    }

    function report() {
      var ev = [];
      spans.forEach(function (s) { ev.push([s[0], s[2]], [s[1], -s[2]]); });
      ev.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var live = 0, peak = 0;
      ev.forEach(function (e) { live += e[1]; if (live > peak) peak = live; });
      return { standing: standing, created: created, peakLive: peak + standing };
    }

    return { out: out, play: play, drum: drum, stats: report };
  }

  return { create: create, INSTRUMENTS: Object.keys(INSTR), DYNAMICS: DYN };
})();
