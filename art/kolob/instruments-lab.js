// ============================================================================
// INSTRUMENTS LAB — audition bench for KOLOB 2's new voices (dev, unlinked).
//
// Every instrument plays a short musical phrase in just intonation, through
// the app's own master chain (glue → master 0.6 → tanh → compressor, copied
// from kolob-audio.js init) plus a safety limiter, in the app's rooms. The
// lab never plays louder than the app. Its level reference is the v0.30
// organChord as the prelude plays it (gainMul 0.75 × (0.6 + 0.4 × 0.21) —
// mid-prelude intensity — peak gainMul × 0.7, linear ramps through env()),
// rebuilt line for line; the new organ is calibrated against it. Both are
// heard as they leave the organ, before the app's organ-layer volume (0.52).
//
// CHECK renders a phrase offline (OfflineAudioContext, same graph) and
// reports what a critic would measure: loudness (BS.1770 integrated, and
// the loudest 3 s), peak and RMS at the output, peak before the chain
// (clipping has nowhere to hide), clicks — spikes of high-frequency energy
// that stand out of the sound on both sides, however quiet — the spectrum in
// five bands, and a spectrogram. It renders the seed in the seed field and,
// for the organ, the swell on the slider. Dev console:
// InstrumentsLab.check(id, {reg, swell, seed, room}); InstrumentsLab.render()
// returns the rendered AudioBuffer itself.
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
    // the last hop: a fader, so a live room change crossfades instead of cutting
    var fade = ctx.createGain(); fade.gain.value = 1;
    voicesBus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(guard);
    guard.connect(fade); fade.connect(dest);
    return { input: session, out: fade };
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
  // a phrase lasts until its last note has rung out, not when the tune stops
  function tail(t, dur, st) { return Math.max(dur, (st.until || 0) - t + 0.1); }

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
    keep(ctx, "organ", organ);
    var st = organ.stats();
    return { dur: tail(t, h.dur + 0.5, st), stats: st };
  };

  // ---- the cornet alone: the Question, as Ives gave it to a trumpet ----------
  // (owner, 2026-09-27: "I'm not seeing the cornet"). The band's lead cornet,
  // unaccompanied, asks v0.30's question — sol la re' ti re' — three times as
  // Kolob 2 will: the first and last verbatim, the middle one bent.
  P.cornet = function (ctx, into, t, o, seed) {
    var band = KOLOB.VoicesBand.create(ctx, into, { seed: seed });
    var q = 0.88 * ((o.beat || 0.5) / 0.5);
    var ASK = [[5, 1.3], [6, 0.9], [9, 1.0], [7, 0.8], [9, 2.8]];            // 1-based degrees of the old question
    var BENT = [[5, 1.3], [6, 0.9], [9, 0.7], [8, 0.4], [7, 0.8], [9, 2.8]];
    var tt = t;
    [ASK, BENT, ASK].forEach(function (fig, k) {
      var at = 0, notes = fig.map(function (n) { var x = { f: deg(K, n[0]), dur: n[1] * q, at: at, acc: at === 0 }; at += n[1] * q; return x; });
      band.play(tt, notes, "cornet", k === 1 ? "mf" : "mp");
      tt += at + 3.2;                                                          // the silence where an answer would be
    });
    keep(ctx, "cornet", band);
    var st = band.stats();
    return { dur: tail(t, tt - t, st), stats: st };
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
        // drum strokes sound at or after the time asked; LEAD is how far after
        // it the accent lands — so ask early by that much to land on the beat
        var LEAD = KOLOB.VoicesBand.LEAD;
        band.drum(bt, "bass", r ? "mf" : "mp");
        if (bar === 3 && r === 0) band.drum(bt + b - LEAD.flam, "flam", "mf");
        else if (bar !== 7) band.drum(bt + b, "snare", "mp");
        if (bar === 7 && r === 0) band.drum(bt + b + e - LEAD.roll, "roll", "mf");
      }
    }
    // the final chord of the strain
    var ft = t + bars * reps * barLen;
    band.play(ft, [{ f: deg(F, 1), dur: 1.2, acc: true }], "cornet", "f");
    band.play(ft, ALTO.I.map(function (rt) { return { f: F * rt, dur: 1.2 }; }), "alto", "mf");
    band.play(ft, [{ f: F / 4, dur: 1.2, acc: true }], "tuba", "f");
    band.drum(ft, "bass", "f");
    keep(ctx, "band", band);
    var st = band.stats();
    return { dur: tail(t, bars * reps * barLen + 1.8, st), stats: st };
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
    // tag: on the one string, a finger lands on the blue third (7/6 over D)
    // and slides up to the major third (5/4) over the open D; then the
    // ringing close — D with the harmonic seventh (7/4) on the A string —
    // and D with A, open
    push(3, e * 2, { orn: "slide", from: D * 7 / 6, acc: true });
    push(1, e * 2, { also: [D * 7 / 4], acc: true });
    push(1, e * 5, { also: [deg(D, 5)], slur: false, acc: true });
    var drone = o.drone === false ? [] : [D];
    folk.fiddle(t, notes, { drone: drone, droneLevel: 0.32, dyn: 0.75 });
    keep(ctx, "folk", folk);
    var st = folk.stats();
    return { dur: tail(t, at + 0.6, st), stats: st };
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
    keep(ctx, "folk", folk);
    var st = folk.stats();
    return { dur: tail(t, at + 0.5, st), stats: st };
  };

  // ---- the gulls: a flock crossing, the lead bird tracing OLD HUNDRED's head
  P.gulls = function (ctx, into, t, o, seed) {
    var folk = KOLOB.VoicesFolk.create(ctx, into, { seed: seed });
    var head = [f(1, 1), f(1, 1), f(7), f(6), f(5), f(1, 1), f(2, 1), f(3, 1)];
    folk.gulls(t, { notes: head, beat: o.beat || 0.5, birds: o.birds || 4, from: -0.8, to: 0.75, dist: 0.2 });
    keep(ctx, "folk", folk);
    var st = folk.stats();
    return { dur: tail(t, head.length * (o.beat || 0.5) + 3.2, st), stats: st };
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
    var nodes = 8;                                  // bus, f1, f2, lp, mix, lg, pn, near
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
    keep(ctx, "folk", folk);
    var st = folk.stats(); st.created += cn; st.peakLive += cn;
    return { dur: tail(t, total + 3.4, st), stats: st };
  };

  // ---- the reference: the v0.30 organ, as the prelude plays it -------------
  // kolob-audio.js organChord(t, dur, chord, gainMul), line for line, with the
  // organ layer's default params (stops 0.5, tremulant 0.15, pedal 0.6):
  // every rank a sine, the unison rank a detuned pair, the whole chord an
  // octave down, a sine pedal two octaves under the bass, and env()'s LINEAR
  // ramps — [atk, peak] [hold, peak × 0.92] [dur × 0.28, 0] with atk =
  // min(2.2, dur × 0.3) and peak = gainMul × 0.7. The prelude calls it with
  // gainMul = 0.75 × (0.6 + 0.4 × intensity), intensity 0.12 → 0.30, i.e.
  // 0.49 … 0.54; the lab takes the middle (0.513). The chords are voiced the
  // way the app's Harmony spreads SATB (bass an octave under the keynote,
  // soprano an octave over), and last 6 s, the prelude's shortest; the lab
  // closes the app's 4–10 s silences between them to a breath. The tremulant
  // LFO runs at 5.5 Hz (the app draws 5–6). What the lab plays is what the
  // organ layer receives — in the app the layer's volume (0.52) follows.
  var REF_GAINMUL = 0.75 * (0.6 + 0.4 * 0.21);
  var REF_DUR = 6, REF_STEP = 6.4;
  function env(g, t, pts) {                         // kolob-audio.js env(): from true zero, linear
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  P.reference = function (ctx, into, t, o) {
    // I – IV – V – I, SATB as [B, T, A, S] in 1-based degrees of the keynote
    var chords = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
    var gainMul = o.gainMul != null ? o.gainMul : REF_GAINMUL, n = 0;
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(K, d); });  // chord.freqs, around the keynote
      var tt = t + i * REF_STEP, dur = REF_DUR, stops = 0.5, trem = 0.15, pedal = 0.6;
      var master = ctx.createGain(); master.connect(into); n++;
      var RANKS = [1, 2, 3, 4], PP = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
      var nTones = freqs.length;
      for (var v = 0; v < nTones; v++) {
        var f0 = freqs[v] * 0.5;
        for (var r = 0; r < RANKS.length; r++) {
          var g = PP[r] * (1 - stops) + FL[r] * stops;
          if (g < 0.05) continue;
          var pair = r === 0 ? 2 : 1;                           // chorus detune on the unison rank only
          for (var d = 0; d < pair; d++) {
            var osc = ctx.createOscillator(); osc.type = "sine";
            osc.frequency.setValueAtTime(f0 * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), tt);
            var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(nTones) / pair, tt);
            osc.connect(og); og.connect(master);
            osc.start(tt); osc.stop(tt + dur + 0.3); n += 2;
          }
        }
      }
      if (pedal > 0.05) {
        var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, tt);
        var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, tt);
        sub.connect(sg); sg.connect(master); sub.start(tt); sub.stop(tt + dur + 0.3); n += 2;
      }
      if (trem > 0.02) {
        var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, tt);
        var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, tt);
        lfo.connect(lg); lg.connect(master.gain); lfo.start(tt); lfo.stop(tt + dur + 0.3); n += 2;
      }
      var peak = gainMul * 0.7;
      var atk = Math.min(2.2, dur * 0.3);
      env(master, tt, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    });
    return { dur: (chords.length - 1) * REF_STEP + REF_DUR + 0.5, stats: { standing: 0, created: n, peakLive: n } };
  };

  var PHRASES = [
    { id: "organ", name: "The organ", phrase: "OLD HUNDRED, two lines, SATB + pedal" },
    { id: "reference", name: "The v0.30 organ (level reference)", phrase: "organChord as the prelude plays it, line for line — hymn principal on the new organ matches its loudness" },
    { id: "band", name: "The brass band", phrase: "a quickstep strain, twice (mf, then f)" },
    { id: "cornet", name: "The cornet alone", phrase: "the Question, asked three times (the middle one bent), as Ives gave it to a trumpet" },
    { id: "fiddle", name: "The fiddle", phrase: "a reel in D over the open D string" },
    { id: "handbells", name: "The handbells", phrase: "a Primary song in 6/8" },
    { id: "gulls", name: "The gulls", phrase: "a flock crossing; the lead bird traces OLD HUNDRED" },
    { id: "handcart", name: "The handcart company", phrase: "two carts under a walking unison line" },
  ];

  // ==========================================================================
  // LIVE PLAYBACK
  // ==========================================================================
  // One live context. Phrases play into `labIn`, which feeds the current room
  // chain; the analyser (the meter) sits after it and is built once. A room
  // change builds the new chain and crossfades — the phrase keeps playing.
  var actx = null, chain = null, irBuf = null, room = "wide", live = {}, current = null, analyser = null, labIn = null;
  // only the live context's instruments answer the page's controls (an
  // offline CHECK builds its own, and must not steal the swell slider)
  function keep(c, key, inst) { if (c === actx) live[key] = inst; }
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    labIn = actx.createGain();
    return fetchIR(actx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild() {
    var old = chain, t = actx.currentTime, X = 0.25;
    chain = buildChain(actx, room, irBuf, analyser);
    labIn.connect(chain.input);
    if (!old) return;
    // crossfade the rooms; then let the old one go
    chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + X);
    old.out.gain.setValueAtTime(1, t); old.out.gain.linearRampToValueAtTime(0, t + X);
    setTimeout(function () {
      try { labIn.disconnect(old.input); } catch (e) {}
      try { old.out.disconnect(); } catch (e2) {}
    }, (X + 0.15) * 1000);
  }
  function stop() {
    if (!current) return;
    var c = current;
    c.gain.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) {} }, 400);
    current = null;
  }
  function play(id, o) {
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      var g = actx.createGain(); g.connect(labIn);
      var res = P[id](actx, g, actx.currentTime + 0.12, o || {}, seedValue());
      current = { gain: g, id: id, until: actx.currentTime + res.dur };
      return res;
    });
  }
  function setRoom(r) { room = r; if (actx) rebuild(); }
  function setSwell(e) { if (live.organ && actx) live.organ.setSwell(e, actx.currentTime, 0.25); }
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
  // render(id, o) → Promise<{buf, res}>: the phrase through the chain,
  // offline. buf has four channels: 0–1 the output, 2–3 the signal before
  // the chain. o: {reg, swell, seed, room, …phrase options}
  function render(id, o) {
    o = o || {};
    var seed = o.seed != null ? o.seed : 1847;
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : fetchIR(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      // a dry run to learn the duration, then the real render
      var dummy = new OfflineAudioContext(2, SR, SR);
      var est = P[id](dummy, dummy.destination, 0.1, o, seed);
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
      var res = P[id](off, ch.input, 0.1, o, seed);
      return off.startRendering().then(function (buf) { return { buf: buf, res: res }; });
    });
  }
  function check(id, o) {
    o = o || {};
    return render(id, o).then(function (r) { return analyse(r.buf, r.res, id, o); });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
  // ---- loudness, BS.1770-4: K-weighting (48 kHz coefficients), 400 ms
  // blocks at 75 % overlap, gated at −70 LUFS and −10 LU; and the loudest
  // 3-second window (short-term maximum)
  function biquad(x, b, a) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function kWeight(x) {
    var s1 = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
    return biquad(s1, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  }
  function highpass4k(x) {                        // 2 × 2nd-order Butterworth at 4 kHz
    var w = Math.tan(Math.PI * 4000 / SR), q = Math.SQRT1_2, nn = 1 / (1 + w / q + w * w);
    var bb = [nn, -2 * nn, nn], aa = [1, 2 * (w * w - 1) * nn, (1 - w / q + w * w) * nn];
    return biquad(biquad(x, bb, aa), bb, aa);
  }
  function loudness(chs) {
    var k = chs.map(kWeight), n = k[0].length;
    var sq = new Float64Array(n + 1);                // running sum of both channels' squares
    for (var i = 0; i < n; i++) { var e = 0; for (var c = 0; c < k.length; c++) e += k[c][i] * k[c][i]; sq[i + 1] = sq[i] + e; }
    function L(s, len) { return -0.691 + 10 * Math.log10((sq[s + len] - sq[s]) / len + 1e-20); }
    var B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), S3 = Math.round(3 * SR), blocks = [];
    for (var s = 0; s + B <= n; s += H) blocks.push(L(s, B));
    var abs = blocks.filter(function (l) { return l > -70; });
    function meanL(ls) { var m = 0; ls.forEach(function (l) { m += Math.pow(10, (l + 0.691) / 10); }); return -0.691 + 10 * Math.log10(m / Math.max(1, ls.length) + 1e-20); }
    var gate = meanL(abs) - 10;
    var I = meanL(abs.filter(function (l) { return l > gate; }));
    var sMax = -Infinity;
    for (var s3 = 0; s3 + S3 <= n; s3 += H) sMax = Math.max(sMax, L(s3, S3));
    if (!isFinite(sMax)) sMax = L(0, n);
    return { I: abs.length ? I : -Infinity, S: sMax };
  }
  function analyse(buf, res, id, o) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), PL = buf.getChannelData(2), PR = buf.getChannelData(3);
    var n = L.length, pk = 0, ppk = 0, clip = 0, ss = 0, act = 0;
    var mono = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var m = (L[i] + Rr[i]) * 0.5; mono[i] = m;
      var a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > pk) pk = a; if (a > 0.989) clip++;
      var b = Math.max(Math.abs(PL[i]), Math.abs(PR[i])); if (b > ppk) ppk = b;
    }
    var lu = loudness([L, Rr]);
    // RMS over the loud part (blocks within 30 dB of the loudest block)
    var B = 2400, blocks = [];
    for (var s = 0; s + B <= n; s += B) { var e = 0; for (var j = s; j < s + B; j++) e += mono[j] * mono[j]; blocks.push(e / B); }
    var bmax = Math.max.apply(null, blocks);
    blocks.forEach(function (e) { if (e > bmax * 0.001) { ss += e; act++; } });
    var rms = Math.sqrt(ss / Math.max(1, act));
    // CLICKS: a click is broadband, so it shows above 4 kHz, where tones
    // (and a ringing bell) leave the band nearly empty. 1 ms blocks of the
    // signal through a 4th-order high-pass at 4 kHz; a click is a block ≥ 12×
    // (21.6 dB) over the LOUDEST block of the 30 ms on EACH side — an attack
    // has its sustain after it, a decay has its ring before it, and a bright
    // low tone's once-a-period edge has its own twin a period away. The floor
    // is −100 dBFS above 4 kHz, not a level: a cut at −55 dBFS into digital
    // silence (−79 dBFS above 4 kHz) is a click too, and the ear finds it in
    // a quiet room. Below the floor sits Chrome's own end to every
    // setTargetAtTime(0): it snaps to zero once the gain is under ~4.5e-5,
    // a step of at most −87 dBFS — inaudible, and in every release there is.
    var hp = highpass4k(mono), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) {
      var e2 = 0;
      for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q];
      hf.push(Math.sqrt(e2 / H));
    }
    function pct(arr, p) { var c = arr.slice().sort(function (a2, b2) { return a2 - b2; }); return c[Math.min(c.length - 1, Math.floor(c.length * p))]; }
    var spikes = [], worst = null;
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = Math.max(pct(hf.slice(z - 30, z - 2), 1), pct(hf.slice(z + 3, z + 30), 1));
      if (hf[z] > ref * 12) {
        spikes.push(+(z * H / SR).toFixed(3));
        if (!worst || hf[z] > worst.hf) worst = { t: +(z * H / SR).toFixed(3), hf: hf[z], db: +db(hf[z]).toFixed(1), overDb: +db(hf[z] / (ref + 1e-20)).toFixed(1) };
      }
    }
    // spectrum: average power in five bands + centroid (Welch, 4096)
    var N = 4096, bands = [0, 0, 0, 0, 0], cnum = 0, cden = 0, tnum = 0, tden = 0;
    var win = new Float32Array(N); for (var w = 0; w < N; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / N);
    var re = new Float32Array(N), im = new Float32Array(N);
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
      spec.push(col);
    }
    var tot = bands.reduce(function (a3, b3) { return a3 + b3; }, 0);
    var out = {
      id: id, reg: o.reg || null, seed: o.seed != null ? o.seed : 1847, swell: o.swell != null ? o.swell : null, room: o.room || "wide",
      seconds: +(n / SR).toFixed(2),
      lufs: +lu.I.toFixed(1), lufsShortMax: +lu.S.toFixed(1),
      peakDb: +db(pk).toFixed(2), rmsDb: +db(rms).toFixed(2), preChainPeakDb: +db(ppk).toFixed(2),
      clippedSamples: clip, transients: spikes.length, transientTimes: spikes.slice(0, 24), worstTransient: worst,
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
        // the check renders what the page is set to: its seed, its room, and
        // for the organ the registration and the swell on the slider
        var o2 = { room: room, seed: seedValue() };
        if (ph.id === "organ") { o2.reg = regSel.value; o2.swell = +document.getElementById("kil-swell").value; }
        check(ph.id, o2).then(function (r) {
          chk.disabled = false;
          report.textContent = "";
          var p = el("p", "kil-meas",
            "seed " + r.seed + (r.reg ? " · " + r.reg + " · swell " + r.swell : "") + " · loudness " + r.lufs + " LUFS (loudest 3 s " + r.lufsShortMax + ")" +
            " · peak " + r.peakDb + " dBFS · rms " + r.rmsDb + " dBFS · before the chain " + r.preChainPeakDb + " dBFS · clipped " + r.clippedSamples +
            " · clicks " + r.transients + (r.transients ? " (first at " + r.transientTimes[0] + " s)" : "") + " · centroid " + r.centroidHz + " Hz (200 Hz–8 kHz: " + r.timbreCentroidHz + ") · bands % sub " + r.bandsPct.sub + " / low " + r.bandsPct.low +
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

  return { play: play, stop: stop, check: check, render: render, loudness: loudness, setRoom: setRoom, phrases: PHRASES, drawSpectrogram: drawSpectrogram, _P: P };
})();
