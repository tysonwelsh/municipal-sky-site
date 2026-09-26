// ============================================================================
// INSTRUMENTS LAB — audition bench for KOLOB 2's new voices (dev, unlinked).
//
// Every instrument plays a short musical phrase in just intonation, through
// the app's own master chain (glue → master 0.6 → tanh → compressor, copied
// from kolob-audio.js init) plus a safety limiter, in the app's rooms. The
// lab never plays louder than the app: its level reference is the v0.30
// organ chord, rebuilt here line for line, and every phrase is balanced
// against it.
//
// CHECK renders a phrase offline (OfflineAudioContext, same graph) and
// reports what a critic would measure: peak and RMS at the output, peak
// before the chain (clipping has nowhere to hide), transient spikes that
// fall outside the phrase's intended attacks, the spectrum in five bands,
// and a spectrogram. Dev console: InstrumentsLab.check(id, {reg}).
//
// Public surface: window.InstrumentsLab
// ============================================================================
window.InstrumentsLab = (function () {
  "use strict";

  var K = 260;                                   // the keynote (≈ the app's F0·4)
  var SR = 48000;

  // ---- tuning helpers -------------------------------------------------------
  // 5-limit major, plus the 7-limit strangers the fiddle wants
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) {                          // d: 1-based scale degree, may run past 7 or below 1
    var i = d - 1, oct = Math.floor(i / 7), k = ((i % 7) + 7) % 7;
    return key * MAJ[k] * Math.pow(2, oct);
  }

  // ==========================================================================
  // THE CHAIN — copied from kolob-audio.js init(): rooms → voicesBus → glue →
  // masterGain(0.6) → tanh(1.15) → compressor(−18/3:1) — then a brick-wall
  // guard at −1 dBFS (the lab's promise never to exceed the app).
  // ==========================================================================
  var irBufCache = {};
  function fetchIR(ctx) {
    var url = "../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("ir " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .catch(function () { return null; });
  }
  // the app's pour (early taps + noise tail) for the close room / fallback
  var TAPS = [[0.008, 0.9], [0.013, 0.7], [0.019, 0.62], [0.026, 0.5], [0.033, 0.42], [0.041, 0.34], [0.052, 0.27], [0.064, 0.2]];
  function pour(ctx, decayS, bright) {
    var len = Math.floor(ctx.sampleRate * decayS), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    var s = 12345;
    function r() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, a = Math.min(0.95, 0.35 * bright);
      for (var i = 0; i < len; i++) {
        var tt = i / ctx.sampleRate;
        var env = Math.pow(1 - i / len, 2.2) * Math.min(1, tt / 0.06);
        lp += a * (r() - lp);
        d[i] = lp * env * 0.5;
      }
      TAPS.forEach(function (tp, k) { var ix = Math.floor((tp[0] + (ch ? 0.0013 * (k % 3) : 0)) * ctx.sampleRate); if (ix < len) d[ix] += tp[1] * 0.5 * (k % 2 ? -1 : 1); });
    }
    return buf;
  }
  function buildChain(ctx, room, irBuf, dest) {
    var t = 0;
    var session = ctx.createGain();              // instruments land here
    var voicesBus = ctx.createGain();
    var dry = ctx.createGain(); dry.gain.value = 1;
    session.connect(dry); dry.connect(voicesBus);
    if (room !== "dry") {
      var spec = room === "close" ? { pre: 0.012, wet: 0.28 } : { pre: 0.063, wet: 0.40 };
      var pre = ctx.createDelay(0.25); pre.delayTime.value = spec.pre;
      var conv = ctx.createConvolver();
      conv.buffer = room === "close" ? pour(ctx, 1.4, 1.2) : (irBuf || pour(ctx, 5.5, 0.8));
      var wet = ctx.createGain(); wet.gain.value = spec.wet;
      session.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(voicesBus);
    }
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = ctx.createGain(); master.gain.value = 0.6;
    var sat = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = c; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var guard = ctx.createDynamicsCompressor();
    guard.threshold.setValueAtTime(-1, t); guard.knee.setValueAtTime(0, t); guard.ratio.setValueAtTime(20, t);
    guard.attack.setValueAtTime(0.002, t); guard.release.setValueAtTime(0.1, t);
    voicesBus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(guard);
    guard.connect(dest);
    return { input: session, out: guard };
  }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o, seed) → { dur, nodes }
  // ==========================================================================
  // OLD HUNDRED (Genevan Psalter, 1551), first two lines, SATB in C, JI.
  // Degrees per chord: [S, A, T, B] with octave offsets (C4 = keynote).
  var C4 = K;
  function f(d, oct) { return deg(C4, d) * Math.pow(2, oct || 0); }
  var OLD100 = [
    // line 1: do do ti la sol do re mi
    [[f(1, 1), f(3), f(5, -1), f(1, -1)], 2],
    [[f(1, 1), f(3), f(6, -1), f(6, -2)], 1],
    [[f(7), f(2), f(5, -1), f(5, -2)], 1],
    [[f(6), f(3), f(1), f(6, -2)], 1],
    [[f(5), f(3), f(1), f(1, -1)], 1],
    [[f(1, 1), f(4), f(6, -1), f(4, -2)], 1],
    [[f(2, 1), f(5), f(7, -1), f(5, -2)], 1],
    [[f(3, 1), f(5), f(1), f(1, -1)], 2],
    null,
    // line 2: mi mi mi re do fa mi re
    [[f(3, 1), f(5), f(1), f(1, -1)], 2],
    [[f(3, 1), f(1, 1), f(3), f(6, -2)], 1],
    [[f(3, 1), f(5), f(1), f(3, -1)], 1],
    [[f(2, 1), f(5), f(7, -1), f(5, -2)], 1],
    [[f(1, 1), f(5), f(3), f(1, -1)], 1],
    [[f(4, 1), f(6), f(1), f(4, -2)], 1],
    [[f(3, 1), f(5), f(1), f(1, -1)], 1],
    [[f(2, 1), f(5), f(7, -1), f(5, -2)], 3],
  ];
  function hymnNotes(beat, lines) {
    var notes = [], at = 0;
    OLD100.forEach(function (row, i) {
      if (lines === 1 && i > 7) return;
      if (!row) { at += beat * 0.6; return; }       // the breath at the line's end
      var d = row[1] * beat;
      row[0].forEach(function (fr, v) { notes.push({ f: fr, dur: d * 0.97, at: at, pedal: v === 3 }); });
      at += d;
    });
    return { notes: notes, dur: at };
  }

  var P = {};

  // ---- the organ ------------------------------------------------------------
  P.organ = function (ctx, into, t, o, seed) {
    var organ = KOLOB.VoicesOrgan.create(ctx, into, { seed: seed, t0: t });
    var reg = o.reg || "hymn principal";
    var R = KOLOB.VoicesOrgan.REGISTRATIONS[reg] || {};
    var sw = o.swell != null ? o.swell : (R.swell != null ? R.swell : 0.8);
    organ.setSwell(sw, t, 0.05);
    var h = hymnNotes(o.beat || 0.82, o.lines || 2);
    if (o.sweep) {                                  // swell box: shut → open → half, across the phrase
      organ.setSwell(0.05, t, 0.05);
      organ.setSwell(1, t + 0.3, h.dur * 0.55);
      organ.setSwell(0.45, t + h.dur * 0.62, h.dur * 0.3);
    }
    organ.play(t, h.notes, reg);
    live.organ = organ;
    return { dur: h.dur + 0.5, stats: organ.stats() };
  };

  // ---- the band: an eight-bar quickstep strain in F, played twice -----------
  P.band = function (ctx, into, t, o, seed) {
    var band = KOLOB.VoicesBand.create(ctx, into, { seed: seed });
    var F = K * 4 / 3, b = o.beat || 0.5, e = b / 2;  // 2/4, quarter = b
    // melody in eighths: [degree, eighths] (0 = rest)
    var tune = [
      [[1, 1], [3, 1], [5, 1], [8, 1]], [[8, 2], [7, 1], [6, 1]], [[5, 2], [6, 1], [5, 1]], [[4, 2], [3, 2]],
      [[2, 1], [3, 1], [4, 1], [5, 1]], [[6, 1], [5, 1], [4, 1], [2, 1]], [[3, 1], [5, 1], [4, 1], [2, 1]], [[1, 3], [0, 1]],
    ];
    var HARM = ["I", "I", "I", "IV", "V", "V", "I", "I"];
    var ALTO = { I: [5 / 8, 3 / 4, 1], IV: [2 / 3, 5 / 6, 1], V: [9 / 16, 3 / 4, 15 / 16] };
    var TUBA = { I: [1 / 4, 3 / 16], IV: [1 / 3, 1 / 4], V: [3 / 16, 9 / 32] };
    var bars = 8, reps = 2, barLen = 2 * b;
    for (var r = 0; r < reps; r++) {
      var dyn = r ? "f" : "mf";
      for (var bar = 0; bar < bars; bar++) {
        var bt = t + (r * bars + bar) * barLen, h = HARM[bar];
        if (r === 1 && bar === 6) h = "I";
        var at = 0;
        var mel = tune[bar].map(function (n) {
          var nt = { f: n[0] ? deg(F, n[0]) : 0, dur: n[1] * e, at: at, acc: at === 0, stacc: n[1] === 1 && n[0] !== 0 };
          at += n[1] * e;
          return nt;
        }).filter(function (n) { return n.f; });
        band.play(bt, mel, "cornet", dyn);
        // oom-pah: tuba on the beats, alto horns on the after-beats
        band.play(bt, [{ f: F * TUBA[h][0], dur: e * 1.4, at: 0, acc: true }, { f: F * TUBA[h][1], dur: e * 1.4, at: b }], "tuba", dyn);
        var ch = bar === 7 ? [] : [e, b + e];
        ch.forEach(function (a) {
          band.play(bt, ALTO[h].map(function (rt) { return { f: F * rt, dur: e * 0.9, at: a, stacc: true }; }), "alto", r ? "mf" : "mp");
        });
        band.drum(bt, "bass", r ? "mf" : "mp");
        if (bar === 3 && r === 0) band.drum(bt + b, "flam", "mf");
        else if (bar !== 7) band.drum(bt + b, "snare", "mp");
        if (bar === 7 && r === 0) band.drum(bt + b + e, "roll", "mf");
      }
    }
    // the final chord of the strain
    var ft = t + bars * reps * barLen;
    band.play(ft, [{ f: deg(F, 1), dur: 1.2, acc: true }], "cornet", "f");
    band.play(ft, ALTO.I.map(function (rt) { return { f: F * rt, dur: 1.2 }; }), "alto", "mf");
    band.play(ft, [{ f: F / 4, dur: 1.2, acc: true }], "tuba", "f");
    band.drum(ft, "bass", "f");
    live.band = band;
    return { dur: bars * reps * barLen + 1.8, stats: band.stats() };
  };

  // ---- the fiddle: a reel in D, over its own open strings -------------------
  P.fiddle = function (ctx, into, t, o, seed) {
    var folk = KOLOB.VoicesFolk.create(ctx, into, { seed: seed });
    var D = K * 9 / 8, e = o.eighth || 0.17;
    var A = [
      [5, 3, 1, 3, 5, 8, 7, 6], [5, 6, 5, 3, 2, 3, 1, 1],
      [5, 3, 1, 3, 5, 8, 9, 10], [8, 7, 6, 5, 3, 2, 1, 0],
    ];
    var notes = [], at = 0;
    function push(d, len, extra) {
      var nt = { f: d ? deg(D, d) : 0, dur: len, at: at };
      for (var k in extra) nt[k] = extra[k];
      notes.push(nt); at += len;
    }
    for (var rep = 0; rep < 2; rep++) {
      A.forEach(function (bar, bi) {
        bar.forEach(function (d, i) {
          if (bi === 3 && i === 6) {
            // the cadence: D held as a double stop with A, then the blue
            // seventh (7/4 over D) leaned on, then home
            push(1, e * 2, { also: [deg(D, 5)], acc: true });
            return;
          }
          if (bi === 3 && i === 7) return;
          push(d, e, { slur: i % 2 === 1, acc: i % 4 === 0, orn: (i === 0 && bi % 2 === 1) ? "cut" : null });
        });
      });
    }
    // tag: the 7/6 slide into the major third, then the ringing close on the
    // harmonic seventh over the open D
    push(3, e * 2, { also: [D * 7 / 6], acc: true });
    push(1, e * 2, { also: [D * 7 / 4 / 2 * 2], acc: true });
    push(1, e * 5, { also: [deg(D, 5)], slur: false, acc: true });
    var drone = o.drone === false ? [] : [D];
    folk.fiddle(t, notes, { drone: drone, droneLevel: 0.32, dyn: 0.75 });
    live.folk = folk;
    return { dur: at + 0.6, stats: folk.stats() };
  };

  // ---- the handbells: a Primary song in 6/8 ---------------------------------
  P.handbells = function (ctx, into, t, o, seed) {
    var folk = KOLOB.VoicesFolk.create(ctx, into, { seed: seed });
    var G = K * 3 / 2, e = o.eighth || 0.24;        // G4
    // [degree, eighths]; 6/8, the tune a child could ring
    var tune = [[5, 2], [3, 1], [5, 2], [6, 1], [5, 3], [3, 3], [1, 2], [2, 1], [3, 2], [5, 1], [2, 6],
                [5, 2], [3, 1], [5, 2], [6, 1], [8, 3], [6, 3], [5, 2], [3, 1], [2, 2], [3, 1], [1, 6]];
    var notes = [], at = 0, bars = 0;
    tune.forEach(function (n, i) {
      var len = n[1] * e;
      notes.push({ f: deg(G, n[0]), at: at, dur: len > 4 * e ? null : len * 1.6, v: 1, pan: ((n[0] % 3) - 1) * 0.3 });
      at += len;
    });
    // the low bells: one ringer per hand, on each bar's downbeat
    var CH = [[1, 5], [1, 5], [5, 2], [5, 7], [1, 5], [4, 6], [5, 2], [1, 5]];
    for (bars = 0; bars < 8; bars++) {
      notes.push({ f: deg(G / 2, CH[bars][0]), at: bars * 6 * e, dur: bars === 7 ? null : 6 * e, v: 0.55, pan: -0.35 });
      notes.push({ f: deg(G / 2, CH[bars][1]), at: bars * 6 * e + 3 * e, dur: 3 * e, v: 0.4, pan: 0.35 });
    }
    folk.handbells(t, notes);
    live.folk = folk;
    return { dur: at + 3, stats: folk.stats() };
  };

  // ---- the gulls: a flock crossing, the lead bird tracing OLD HUNDRED's head
  P.gulls = function (ctx, into, t, o, seed) {
    var folk = KOLOB.VoicesFolk.create(ctx, into, { seed: seed });
    var head = [f(1, 1), f(1, 1), f(7), f(6), f(5), f(1, 1), f(2, 1), f(3, 1)];
    folk.gulls(t, { notes: head, beat: o.beat || 0.5, birds: o.birds || 4, from: -0.8, to: 0.75, dist: 0.2 });
    live.folk = folk;
    return { dur: head.length * (o.beat || 0.5) + 3.2, stats: folk.stats() };
  };

  // ---- the handcart company: wheels under a unison line ---------------------
  // (the company is a lab stand-in — five throats on "ah" — not the choir
  // crew's voice; the line is a plain pentatonic walk, not ALL IS WELL)
  function company(ctx, into, t, notes, beat) {
    var bus = ctx.createGain(); bus.gain.value = 1;
    var f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 700; f1.Q.value = 5;
    var f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1150; f2.Q.value = 6;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    var mix = ctx.createGain(); mix.gain.value = 0.9;
    bus.connect(f1); bus.connect(f2); bus.connect(lp); f1.connect(mix); f2.connect(mix);
    var lg = ctx.createGain(); lg.gain.value = 0.15; lp.connect(lg); lg.connect(mix);
    // the company walks past: in from the left, out to the right
    var pn = ctx.createStereoPanner(); pn.pan.setValueAtTime(-0.6, t);
    var total = 0; notes.forEach(function (n) { total += n[1] * beat; });
    pn.pan.linearRampToValueAtTime(0.6, t + total);
    var near = ctx.createGain(); near.gain.setValueAtTime(0, t);
    near.gain.linearRampToValueAtTime(1, t + total * 0.4); near.gain.setValueAtTime(1, t + total * 0.6);
    near.gain.linearRampToValueAtTime(0.0, t + total + 0.4);
    mix.connect(near); near.connect(pn); pn.connect(into);
    var nodes = 10;
    for (var v = 0; v < 5; v++) {
      var o = ctx.createOscillator(); o.type = "sawtooth";
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      var det = (v - 2) * 5 + (v % 2 ? 2 : -2), lag = v * 0.035;
      var at = t + lag, oct = v === 4 ? 0.5 : 1;
      notes.forEach(function (n, i) {
        var fr = n[0] * oct;
        if (i === 0) o.frequency.setValueAtTime(fr, at);
        else o.frequency.setTargetAtTime(fr, at, 0.04);
        g.gain.setTargetAtTime(0.085, at, 0.06);
        if (n[2]) g.gain.setTargetAtTime(0.0, at + n[1] * beat - 0.12, 0.04);
        at += n[1] * beat;
      });
      g.gain.setTargetAtTime(0, at - 0.1, 0.1);
      o.detune.value = det;
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(at + 1);
      nodes += 2;
    }
    return nodes;
  }
  P.handcart = function (ctx, into, t, o, seed) {
    var folk = KOLOB.VoicesFolk.create(ctx, into, { seed: seed });
    var beat = o.beat || 0.8, C = K / 2 * 1.5;       // G3
    var line = [[1, 1], [1, 1], [2, 1], [3, 2], [5, 1], [3, 1], [2, 2, 1],
                [1, 1], [2, 1], [3, 1], [5, 1], [6, 2], [5, 2, 1],
                [3, 1], [5, 1], [6, 1], [5, 1], [3, 1], [2, 1], [1, 2, 1]].map(function (n) {
      var d = n[0], r = [1, 9 / 8, 5 / 4, 0, 3 / 2, 5 / 3][d - 1];
      return [C * r, n[1], n[2]];
    });
    var total = 0; line.forEach(function (n) { total += n[1] * beat; });
    folk.wheels(t, total + 3, { beat: beat, carts: o.carts || 2, from: -0.75, to: 0.7, creak: 0.8 });
    var cn = company(ctx, into, t + 1.2, line, beat);
    live.folk = folk;
    var st = folk.stats(); st.created += cn; st.peakLive += cn;
    return { dur: total + 3.4, stats: st };
  };

  // ---- the reference: the v0.30 organ chord, line for line ------------------
  P.reference = function (ctx, into, t) {
    var chords = [[1, 3, 5, 8], [4, 6, 8, 11], [5, 7, 9, 12], [1, 3, 5, 8]];
    var n = 0;
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(K / 2, d); });
      var tt = t + i * 3.2, dur = 3.4, stops = 0.5, trem = 0.15, pedal = 0.6;
      var m = ctx.createGain(); m.connect(into); n++;
      var RANKS = [1, 2, 3, 4], PP = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
      freqs.forEach(function (fr) {
        fr *= 0.5 * 2;                               // the app halves chord.freqs; ours are already low
        for (var r = 0; r < 4; r++) {
          var g = PP[r] * (1 - stops) + FL[r] * stops; if (g < 0.05) continue;
          var pair = r === 0 ? 2 : 1;
          for (var d = 0; d < pair; d++) {
            var o = ctx.createOscillator(); o.frequency.value = fr * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1);
            var og = ctx.createGain(); og.gain.value = g * 0.16 / 2 / pair;
            o.connect(og); og.connect(m); o.start(tt); o.stop(tt + dur + 0.3); n += 2;
          }
        }
      });
      var sub = ctx.createOscillator(); sub.frequency.value = freqs[0] * 0.5;
      var sg = ctx.createGain(); sg.gain.value = pedal * 0.15; sub.connect(sg); sg.connect(m); sub.start(tt); sub.stop(tt + dur + 0.3);
      var lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; var lg = ctx.createGain(); lg.gain.value = trem * 0.1;
      lfo.connect(lg); lg.connect(m.gain); lfo.start(tt); lfo.stop(tt + dur + 0.3);
      n += 4;
      var peak = 0.75 * 0.9, atk = Math.min(2.2, dur * 0.3);
      m.gain.setValueAtTime(0, tt); m.gain.linearRampToValueAtTime(peak, tt + 0.6);
      m.gain.setValueAtTime(peak * 0.92, tt + dur - 0.9); m.gain.linearRampToValueAtTime(0, tt + dur);
      void atk;
    });
    return { dur: chords.length * 3.2 + 1, stats: { standing: 0, created: n, peakLive: n } };
  };

  var PHRASES = [
    { id: "organ", name: "The organ", phrase: "OLD HUNDRED, two lines, SATB + pedal" },
    { id: "band", name: "The brass band", phrase: "a quickstep strain, twice (mf, then f)" },
    { id: "fiddle", name: "The fiddle", phrase: "a reel in D over the open D string" },
    { id: "handbells", name: "The handbells", phrase: "a Primary song in 6/8" },
    { id: "gulls", name: "The gulls", phrase: "a flock crossing; the lead bird traces OLD HUNDRED" },
    { id: "handcart", name: "The handcart company", phrase: "two carts under a walking unison line" },
    { id: "reference", name: "Level reference", phrase: "the v0.30 organ, rebuilt — what the app sounds like" },
  ];

  // ==========================================================================
  // LIVE PLAYBACK
  // ==========================================================================
  var ctx = null, chain = null, irBuf = null, room = "wide", live = {}, current = null, analyser = null;
  function ensure() {
    if (ctx) return Promise.resolve();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    return fetchIR(ctx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild() {
    if (chain) { try { chain.out.disconnect(); } catch (e) {} }
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(ctx.destination);
    chain = buildChain(ctx, room, irBuf, analyser);
  }
  function stop() {
    if (!current) return;
    var g = current.gain, c = current;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) {} }, 400);
    current = null;
  }
  function play(id, o) {
    return ensure().then(function () {
      if (ctx.state === "suspended") ctx.resume();
      stop();
      var g = ctx.createGain(); g.connect(chain.input);
      var seed = seedValue();
      var res = P[id](ctx, g, ctx.currentTime + 0.12, o || {}, seed);
      current = { gain: g, id: id, until: ctx.currentTime + res.dur };
      return res;
    });
  }
  function setRoom(r) { room = r; if (ctx) rebuild(); }
  function setSwell(e) { if (live.organ && ctx) live.organ.setSwell(e, ctx.currentTime, 0.25); }
  function seedValue() {
    var el = document.getElementById("kil-seed");
    var v = el ? parseInt(el.value, 10) : 1847;
    return isFinite(v) ? v : 1847;
  }
  // a small live meter (peak dBFS at the output)
  function meter() {
    if (!analyser) return null;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var pk = 0, ss = 0; for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > pk) pk = x; ss += x * x; }
    return { peak: 20 * Math.log10(pk + 1e-9), rms: 10 * Math.log10(ss / a.length + 1e-12) };
  }

  // ==========================================================================
  // CHECK — offline render + the critic's measures
  // ==========================================================================
  var offlineIR = null;
  function check(id, o) {
    o = o || {};
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : fetchIR(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      // dry run to learn the duration, then the real render
      var dummy = new OfflineAudioContext(2, SR, SR);
      var est = P[id](dummy, dummy.destination, 0.1, o, o.seed || 1847);
      var len = Math.ceil((est.dur + 1.2 + (o.room === "dry" ? 0 : 3)) * SR);
      var off = new OfflineAudioContext(4, len, SR);
      off.destination.channelCount = 4; off.destination.channelInterpretation = "discrete";
      var merger = off.createChannelMerger(4); merger.connect(off.destination);
      var ch = buildChain(off, o.room || "wide", ir, merger);
      // the tap before the chain: channels 2–3
      var split = off.createChannelSplitter(2);
      ch.input.connect(split); split.connect(merger, 0, 2); split.connect(merger, 1, 3);
      var mainSplit = off.createChannelSplitter(2);
      ch.out.disconnect(); ch.out.connect(mainSplit); mainSplit.connect(merger, 0, 0); mainSplit.connect(merger, 1, 1);
      var res = P[id](off, ch.input, 0.1, o, o.seed || 1847);
      return off.startRendering().then(function (buf) { return analyse(buf, res, id, o); });
    });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
  function analyse(buf, res, id, o) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), PL = buf.getChannelData(2), PR = buf.getChannelData(3);
    var n = L.length, pk = 0, ppk = 0, clip = 0, ss = 0, act = 0;
    var mono = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var m = (L[i] + Rr[i]) * 0.5; mono[i] = m;
      var a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > pk) pk = a; if (a > 0.989) clip++;
      var b = Math.max(Math.abs(PL[i]), Math.abs(PR[i])); if (b > ppk) ppk = b;
    }
    // RMS over the loud part (blocks within 30 dB of the loudest block)
    var B = 2400, blocks = [];
    for (var s = 0; s + B <= n; s += B) { var e = 0; for (var j = s; j < s + B; j++) e += mono[j] * mono[j]; blocks.push(e / B); }
    var bmax = Math.max.apply(null, blocks);
    blocks.forEach(function (e) { if (e > bmax * 0.001) { ss += e; act++; } });
    var rms = Math.sqrt(ss / Math.max(1, act));
    // transients: 1 ms blocks of the second difference, against the median
    // of the 30 ms either side — a click is a spike ≥ 12× (21.6 dB)
    var H = 48, hf = [];
    for (var k = 2; k + H <= n; k += H) {
      var e2 = 0;
      for (var q = k; q < k + H; q++) { var d2 = mono[q] - 2 * mono[q - 1] + mono[q - 2]; e2 += d2 * d2; }
      hf.push(Math.sqrt(e2 / H));
    }
    var spikes = [];
    for (var z = 30; z < hf.length - 30; z++) {
      // a click stands above BOTH sides: an attack out of silence has its
      // sustain after it, and a decaying strike has its ring
      var bef = hf.slice(z - 30, z - 2).sort(function (a2, b2) { return a2 - b2; });
      var aft = hf.slice(z + 3, z + 30).sort(function (a2, b2) { return a2 - b2; });
      var med = Math.max(bef[bef.length >> 1], aft[aft.length >> 1]);
      if (hf[z] > med * 12 && hf[z] > 0.002) spikes.push(+(z * H / SR).toFixed(3));
    }
    // spectrum: average power in five bands + centroid (Welch, 4096)
    var N = 4096, bands = [0, 0, 0, 0, 0], cnum = 0, cden = 0, tnum = 0, tden = 0;
    var win = new Float32Array(N); for (var w = 0; w < N; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / N);
    var re = new Float32Array(N), im = new Float32Array(N), frames = 0;
    var spec = [];
    for (var st = 0; st + N <= n; st += N / 2) {
      for (var u = 0; u < N; u++) { re[u] = mono[st + u] * win[u]; im[u] = 0; }
      fft(re, im);
      var col = new Float32Array(N / 2);
      for (var bin = 1; bin < N / 2; bin++) {
        var pw = re[bin] * re[bin] + im[bin] * im[bin], hz = bin * SR / N;
        col[bin] = pw;
        var bi = hz < 120 ? 0 : hz < 500 ? 1 : hz < 2000 ? 2 : hz < 6000 ? 3 : 4;
        bands[bi] += pw; cnum += pw * hz; cden += pw;
        if (hz >= 200 && hz <= 8000) { tnum += pw * hz; tden += pw; }
      }
      spec.push(col); frames++;
    }
    var tot = bands.reduce(function (a3, b3) { return a3 + b3; }, 0);
    var out = {
      id: id, reg: o.reg || null, seconds: +(n / SR).toFixed(2),
      peakDb: +db(pk).toFixed(2), rmsDb: +db(rms).toFixed(2), preChainPeakDb: +db(ppk).toFixed(2),
      clippedSamples: clip, transients: spikes.length, transientTimes: spikes.slice(0, 24),
      bandsPct: { sub: 0, low: 0, mid: 0, pres: 0, air: 0 }, centroidHz: Math.round(cnum / (cden || 1)), timbreCentroidHz: Math.round(tnum / (tden || 1)),
      nodes: res.stats,
    };
    ["sub", "low", "mid", "pres", "air"].forEach(function (nm, ix) { out.bandsPct[nm] = +(100 * bands[ix] / (tot || 1)).toFixed(1); });
    out._spec = spec; out._n = N;
    return out;
  }
  // radix-2 in-place FFT
  function fft(re, im) {
    var n = re.length, i, j = 0, k, len, tr, ti;
    for (i = 1; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k + len / 2], ai = im[i + k + len / 2];
          tr = ar * cr - ai * ci; ti = ar * ci + ai * cr;
          re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti;
          re[i + k] += tr; im[i + k] += ti;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  // spectrogram onto a canvas: log frequency 60 Hz – 12 kHz, 70 dB range
  function drawSpectrogram(canvas, res) {
    var spec = res._spec, N = res._n, W = canvas.width, Hh = canvas.height, c2 = canvas.getContext("2d");
    var img = c2.createImageData(W, Hh), mx = 0;
    spec.forEach(function (col) { for (var b = 1; b < col.length; b++) if (col[b] > mx) mx = col[b]; });
    for (var x = 0; x < W; x++) {
      var col2 = spec[Math.min(spec.length - 1, Math.floor(x / W * spec.length))];
      for (var y = 0; y < Hh; y++) {
        var hz = 60 * Math.pow(200, 1 - y / (Hh - 1));
        var bin = Math.max(1, Math.min(N / 2 - 1, Math.round(hz * N / SR)));
        var v = 10 * Math.log10((col2[bin] + 1e-20) / mx);
        var a = Math.max(0, Math.min(1, (v + 70) / 70));
        var p = (y * W + x) * 4;
        // ink on paper
        img.data[p] = 245 - a * (245 - 30); img.data[p + 1] = 240 - a * (240 - 77); img.data[p + 2] = 228 - a * (228 - 59); img.data[p + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function statLine(st) { return "nodes: " + st.created + " created · ≈" + st.peakLive + " live at peak (incl. " + st.standing + " standing)"; }
  function mount() {
    var host = document.getElementById("kil-cards");
    if (!host) return;
    var regSel = null;
    PHRASES.forEach(function (ph) {
      var card = el("section", "kil-card");
      card.appendChild(el("h2", "kil-name", ph.name));
      card.appendChild(el("p", "kil-phrase", ph.phrase));
      var row = el("div", "kil-row");
      var opts = {};
      if (ph.id === "organ") {
        regSel = el("select"); regSel.id = "kil-reg";
        Object.keys(KOLOB.VoicesOrgan.REGISTRATIONS).forEach(function (r) { var op = el("option", null, r); op.value = r; regSel.appendChild(op); });
        regSel.value = "hymn principal";
        var lab = el("label", null, "registration "); lab.appendChild(regSel); row.appendChild(lab);
        var sw = el("input"); sw.type = "range"; sw.min = 0; sw.max = 1; sw.step = 0.01; sw.value = 0.85; sw.id = "kil-swell";
        var sl = el("label", null, "swell "); sl.appendChild(sw); row.appendChild(sl);
        sw.addEventListener("input", function () { setSwell(+sw.value); });
        regSel.addEventListener("change", function () {
          var R = KOLOB.VoicesOrgan.REGISTRATIONS[regSel.value]; if (R && R.swell != null) sw.value = R.swell;
        });
      }
      var readout = el("p", "kil-stat", "");
      var btn = el("button", "kil-play", "play");
      btn.type = "button";
      btn.addEventListener("click", function () {
        var o = {};
        if (ph.id === "organ") { o.reg = regSel.value; o.swell = +document.getElementById("kil-swell").value; }
        play(ph.id, o).then(function (res) { readout.textContent = statLine(res.stats); });
      });
      row.appendChild(btn);
      if (ph.id === "organ") {
        var sweep = el("button", "kil-play", "swell sweep"); sweep.type = "button";
        sweep.addEventListener("click", function () {
          play("organ", { reg: regSel.value, sweep: true, lines: 1 }).then(function (res) { readout.textContent = statLine(res.stats); });
        });
        row.appendChild(sweep);
      }
      if (ph.id === "fiddle") {
        var nd = el("button", "kil-play", "no drone"); nd.type = "button";
        nd.addEventListener("click", function () { play("fiddle", { drone: false }).then(function (res) { readout.textContent = statLine(res.stats); }); });
        row.appendChild(nd);
      }
      var chk = el("button", "kil-check", "check"); chk.type = "button";
      var report = el("div", "kil-report");
      chk.addEventListener("click", function () {
        chk.disabled = true; report.textContent = "rendering offline…";
        var o2 = { room: room };
        if (ph.id === "organ") o2.reg = regSel.value;
        check(ph.id, o2).then(function (r) {
          chk.disabled = false;
          report.textContent = "";
          var p = el("p", "kil-meas",
            "peak " + r.peakDb + " dBFS · rms " + r.rmsDb + " dBFS · before the chain " + r.preChainPeakDb + " dBFS · clipped " + r.clippedSamples +
            " · stray transients " + r.transients + " · centroid " + r.centroidHz + " Hz (200 Hz–8 kHz: " + r.timbreCentroidHz + ") · bands % sub " + r.bandsPct.sub + " / low " + r.bandsPct.low +
            " / mid " + r.bandsPct.mid + " / presence " + r.bandsPct.pres + " / air " + r.bandsPct.air);
          report.appendChild(p);
          var cv = el("canvas", "kil-spec"); cv.width = 640; cv.height = 160; report.appendChild(cv);
          drawSpectrogram(cv, r);
          readout.textContent = statLine(r.nodes);
        }, function (err) { chk.disabled = false; report.textContent = "check failed: " + err; });
      });
      row.appendChild(chk);
      card.appendChild(row); card.appendChild(readout); card.appendChild(report);
      host.appendChild(card);
    });
    var stopB = document.getElementById("kil-stop");
    if (stopB) stopB.addEventListener("click", stop);
    var roomSel = document.getElementById("kil-room");
    if (roomSel) roomSel.addEventListener("change", function () { setRoom(roomSel.value); });
    var mEl = document.getElementById("kil-meter");
    if (mEl) setInterval(function () {
      var m = meter(); if (!m) return;
      mEl.textContent = m.peak > -90 ? ("out " + m.peak.toFixed(1) + " dBFS peak") : "out —";
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  return { play: play, stop: stop, check: check, setRoom: setRoom, phrases: PHRASES, drawSpectrogram: drawSpectrogram, _P: P };
})();
