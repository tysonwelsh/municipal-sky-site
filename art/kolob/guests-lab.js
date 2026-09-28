// ============================================================================
// GUESTS LAB — audition bench for round 3's guests (dev, unlinked).
//
// The ward's handbell choir (KOLOB.GuestHandbells) and the singing school
// (KOLOB.GuestSingingSchool, EXPERIMENTAL), each performing a hymn that
// KOLOB.Composer writes here — seed, dialect (Tabernacle, Sacred Harp, the
// Old Way), mode and keynote on the controls. The bells: the hymn or a round
// as the seed draws it (or chosen), in any of the three seats; one bell and
// every technique; the line of ringers, low to high; the cascade; the comma
// bells. The school: the whole practice, with its lesson laid out — which
// part went wrong, where, against whom — and the experimental switch.
//
// Everything plays through the app's own master chain (glue → master 0.6 →
// tanh → compressor, as kolob-core.js builds it) plus a brick-wall guard at
// −1 dBFS, in the app's rooms (the trombone lab's chain, line for line): the
// lab never plays louder than the app. CHECK renders offline (the same
// graph) and measures loudness against the v0.30 organ reference, peak,
// clipping and clicks — high-frequency bursts nothing scheduled.
//
// Dev console: GuestsLab.play(id, o), .check(id, o), .odds(N), .purity(),
// .hymn(), .score("bells" | "school"), .stop(). Public surface: window.GuestsLab
// ============================================================================
window.GuestsLab = (function () {
  "use strict";

  var SR = 48000;
  var K = window.KOLOB, HB = K.GuestHandbells, SS = K.GuestSingingSchool, X = K.Experimental;
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };
  function mod(a, n) { return ((a % n) + n) % n; }

  // ==========================================================================
  // THE CHAIN — the trombone lab's (kolob-core.js init()'s): rooms →
  // voicesBus → glue → master 0.6 → tanh(1.15) → compressor(−18/3:1) — then
  // a brick-wall guard at −1 dBFS
  // ==========================================================================
  function fetchIR(ctx) {
    var url = "../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("ir " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .catch(function () { return null; });
  }
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
    var session = ctx.createGain(), voicesBus = ctx.createGain(), dry = ctx.createGain();
    dry.gain.value = 1;
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
    var fade = ctx.createGain(); fade.gain.value = 1;
    voicesBus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(guard);
    guard.connect(fade); fade.connect(dest);
    return { input: session, out: fade };
  }

  // ==========================================================================
  // THE HYMN — composed here, from the controls
  // ==========================================================================
  var hymn = null, hymnKey = null;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = document.getElementById(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function settings(o) {
    o = o || {};
    return {
      seed: o.seed != null ? o.seed : Math.round(num("kgl-seed", 4)),
      dialect: o.dialect || val("kgl-dialect", "tabernacle"),
      mode: o.mode != null ? o.mode : val("kgl-mode", ""),
      keynote: Math.max(200, Math.min(320, o.keynote != null ? o.keynote : num("kgl-key", 260))),
    };
  }
  function composeHymn(st) {
    var key = st.seed + ":" + st.dialect + ":" + st.mode;
    if (hymn && hymnKey === key) return hymn;
    var opts = { dialect: st.dialect };
    if (st.mode) opts.mode = st.mode;
    hymn = K.Composer.compose(window.PJ2.Rand.stream(st.seed).fork("hymn:1:1"), opts);
    hymnKey = key;
    return hymn;
  }
  function hbStream(seed) { return window.PJ2.Rand.stream(seed >>> 0).fork(HB.LABEL + 1); }
  function ssStream(seed) { return window.PJ2.Rand.stream(seed >>> 0).fork(SS.LABEL + 1); }
  function bellMaterial(st, o) {
    return HB.prepare({ hymn: composeHymn(st), keynoteHz: st.keynote, seat: o.seat || seatNow(), piece: o.piece || null, phone: o.phone != null ? o.phone : phoneNow() }, hbStream(st.seed));
  }
  function schoolMaterial(st) { return SS.prepare({ hymn: composeHymn(st), keynoteHz: st.keynote }, ssStream(st.seed)); }
  function seatNow() { return val("kgl-seat", "invocation"); }
  function pieceNow() { var v = val("kgl-piece", "auto"); return v === "auto" ? null : v; }
  function phoneNow() { var e = document.getElementById("kgl-phone"); return !!(e && e.checked); }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o) → { dur, stats?, score?, expect }
  //   expect: the times (s, from t) at which a transient is asked for
  // ==========================================================================
  var P = {};
  function bellExpect(sc, t) {
    var ex = [];
    sc.rings.forEach(function (rg) {
      ex.push([rg.t - t, rg.t - t + 0.03]);
      rg.hits.forEach(function (h) { ex.push([rg.t - t + h.at, rg.t - t + h.at + 0.03]); });
      if (rg.shake) ex.push([rg.t - t + rg.shake.at, rg.t - t + rg.shake.at + rg.shake.dur + 0.05]);
    });
    return ex;
  }
  P.bells = function (ctx, into, t, o) {
    var st = settings(o), mat = bellMaterial(st, { seat: o.seat, piece: o.piece !== undefined ? o.piece : pieceNow(), phone: o.phone });
    var hooks = { onNote: o.onNote || null, maxLive: o.maxLive };
    var end = HB.perform(ctx, into, t, mat, hbStream(st.seed), hooks);
    var last = HB.perform.last, s = last.folk.stats();
    return { dur: Math.max(end, last.score.until) - t + 1.5, stats: s, score: last.score, expect: bellExpect(last.score, t) };
  };
  // ONE BELL, EVERY TECHNIQUE: a G5 (or the hymn's do an octave up), rung
  // and let ring; damped; martellato; thumb-damped; shaken; struck three
  // times while it rings
  P.tech = function (ctx, into, t, o) {
    var st = settings(o), f = o.f || st.keynote * 2;
    var folk = K.VoicesFolk.create(ctx, into, { seed: st.seed });
    var seq = [
      { at: 0, o: { tech: "ring", v: 0.7 }, len: 3.6, name: "let ring (LV)" },
      { at: 3.8, o: { tech: "damp", damp: 0.7, v: 0.7 }, len: 1.2, name: "damped at the shoulder" },
      { at: 5.2, o: { tech: "mart", v: 0.85 }, len: 0.9, name: "martellato" },
      { at: 6.3, o: { tech: "thumb", v: 0.7 }, len: 0.9, name: "thumb damp" },
      { at: 7.4, o: { tech: "shake", v: 0.7, shake: { dur: 1.8 }, damp: 2.0 }, len: 2.5, name: "shaken, then damped" },
      { at: 10.1, o: { tech: "ring", v: 0.6, hits: [{ at: 0.6, v: 0.7 }, { at: 1.2, v: 0.8 }], damp: 3.2 }, len: 3.6, name: "struck again while it rings" },
    ];
    var ex = [];
    seq.forEach(function (x) {
      folk.ring(t + x.at, Object.assign({ f: f, pan: 0 }, x.o));
      ex.push([x.at, x.at + 0.03]);
      (x.o.hits || []).forEach(function (h) { ex.push([x.at + h.at, x.at + h.at + 0.03]); });
      if (x.o.shake) ex.push([x.at, x.at + x.o.shake.dur + 0.05]);
    });
    P.tech.seq = seq;
    return { dur: 14.2, stats: folk.stats(), expect: ex };
  };
  // DOWN THE LINE: every bell of the arrangement, low to high, each rung and
  // damped — where each ringer stands (the check reads each bell's side)
  P.line = function (ctx, into, t, o) {
    var st = settings(o), sc = HB.score(bellMaterial(st, o), hbStream(st.seed), 0);
    var folk = K.VoicesFolk.create(ctx, into, { seed: st.seed }), gap = 0.42, ex = [];
    sc.bells.forEach(function (b, i) { folk.ring(t + i * gap, { f: b.f, v: 0.7, tech: "damp", damp: 0.36, pan: b.pan }); ex.push([i * gap, i * gap + 0.03]); });
    P.line.bells = sc.bells; P.line.gap = gap;
    return { dur: sc.bells.length * gap + 0.8, stats: folk.stats(), expect: ex, line: sc.bells };
  };
  // THE COMMA BELLS: a letter the Score sings at two pitches (re at 9/8 and
  // at 10/9, say), one after the other, then together — 21.5 cents apart
  P.comma = function (ctx, into, t, o) {
    var st = settings(o), sc = HB.score(bellMaterial(st, o), hbStream(st.seed), 0);
    var pairs = {}, pair = null;
    sc.bells.forEach(function (b) { if (!b.alt) (pairs[b.letter] = pairs[b.letter] || []).push(b); });
    Object.keys(pairs).forEach(function (k) { if (!pair && pairs[k].length > 1) pair = pairs[k]; });
    var folk = K.VoicesFolk.create(ctx, into, { seed: st.seed });
    if (!pair) return { dur: 0.5, stats: folk.stats(), expect: [], none: true };
    folk.ring(t, { f: pair[0].f, v: 0.7, tech: "damp", damp: 1.6, pan: pair[0].pan });
    folk.ring(t + 1.9, { f: pair[1].f, v: 0.7, tech: "damp", damp: 1.6, pan: pair[1].pan });
    folk.ring(t + 3.8, { f: pair[0].f, v: 0.6, tech: "ring", pan: pair[0].pan });
    folk.ring(t + 3.8, { f: pair[1].f, v: 0.6, tech: "ring", pan: pair[1].pan });
    P.comma.pair = pair;
    return { dur: 8, stats: folk.stats(), expect: [[0, 0.03], [1.9, 1.93], [3.8, 3.83]], pair: pair };
  };
  P.school = function (ctx, into, t, o) {
    var st = settings(o), mat = schoolMaterial(st);
    if (K.VoicesVocal.budget) K.VoicesVocal.budget.reset();
    var end = SS.perform(ctx, into, t, mat, ssStream(st.seed), { onNote: o.onNote || null });
    var bud = K.VoicesVocal.budget ? K.VoicesVocal.budget.report(t, end) : null;
    var sc = SS.perform.last.score, ex = [];
    // (a sung onset carries its consonant; a rap on the stand is a rap)
    sc.items.forEach(function (it) {
      if (it.kind === "tap" || it.kind === "fork") ex.push([it.t - t - 0.02, it.t - t + 0.1]);
      if (it.kind === "fork") ex.push([it.t - t + 0.8, it.t - t + 1.0]);
      if (it.kind === "sing" || it.kind === "chorister") {
        var tt = it.t - t;
        it.notes.forEach(function (n) { if (!n.rest) ex.push([tt - 0.16, tt + 0.08]); tt += n.dur; });
      }
    });
    return { dur: end - t + 2.5, score: sc, expect: ex, stats: bud ? { created: 0, maxRing: 0, peakLive: bud.peak, singers: true, meanLive: Math.round(bud.mean) } : null };
  };
  // ---- the level reference: the v0.30 organChord, line for line (the
  // instruments and trombone labs' P.reference) ------------------------------
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, oct = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, oct); }
  var REF_GAINMUL = 0.75 * (0.6 + 0.4 * 0.21), REF_DUR = 6, REF_STEP = 6.4;
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  P.reference = function (ctx, into, t) {
    var chords = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(260, d); });
      var tt = t + i * REF_STEP, dur = REF_DUR, stops = 0.5, trem = 0.15, pedal = 0.6;
      var master = ctx.createGain(); master.connect(into);
      var RANKS = [1, 2, 3, 4], PP = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
      for (var v = 0; v < freqs.length; v++) {
        var f0 = freqs[v] * 0.5;
        for (var r = 0; r < RANKS.length; r++) {
          var g = PP[r] * (1 - stops) + FL[r] * stops;
          if (g < 0.05) continue;
          var pair = r === 0 ? 2 : 1;
          for (var d = 0; d < pair; d++) {
            var osc = ctx.createOscillator(); osc.type = "sine";
            osc.frequency.setValueAtTime(f0 * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), tt);
            var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(freqs.length) / pair, tt);
            osc.connect(og); og.connect(master); osc.start(tt); osc.stop(tt + dur + 0.3);
          }
        }
      }
      var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, tt);
      var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, tt);
      sub.connect(sg); sg.connect(master); sub.start(tt); sub.stop(tt + dur + 0.3);
      var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, tt);
      var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, tt);
      lfo.connect(lg); lg.connect(master.gain); lfo.start(tt); lfo.stop(tt + dur + 0.3);
      var peak = REF_GAINMUL * 0.7, atk = Math.min(2.2, dur * 0.3);
      env(master, tt, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    });
    return { dur: (chords.length - 1) * REF_STEP + REF_DUR + 0.5, expect: [] };
  };

  // ==========================================================================
  // LIVE PLAYBACK — one context; phrases play into `labIn`, which feeds the
  // current room chain; the meter sits after it. A room change crossfades.
  // ==========================================================================
  var actx = null, chain = null, irBuf = null, room = "wide", current = null, analyser = null, labIn = null, lights = [], lightTimer = null;
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    labIn = actx.createGain();
    return fetchIR(actx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild() {
    var old = chain, t = actx.currentTime, XF = 0.25;
    chain = buildChain(actx, room, irBuf, analyser);
    labIn.connect(chain.input);
    if (!old) return;
    chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + XF);
    old.out.gain.setValueAtTime(1, t); old.out.gain.linearRampToValueAtTime(0, t + XF);
    setTimeout(function () { try { labIn.disconnect(old.input); } catch (e) {} try { old.out.disconnect(); } catch (e2) {} }, (XF + 0.15) * 1000);
  }
  function stop() {
    lights = [];
    if (!current) return;
    var c = current;
    c.gain.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) {} }, 400);
    current = null;
  }
  function play(id, o) {
    o = o || {};
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      var g = actx.createGain(); g.connect(labIn);
      lights = [];
      var oo = Object.assign({}, o, { onNote: function (n) { lights.push(n); } });
      var res = P[id](actx, g, actx.currentTime + 0.15, oo);
      current = { gain: g, id: id, until: actx.currentTime + res.dur };
      return res;
    });
  }
  function setRoom(r) { room = r; if (actx) rebuild(); }
  function meter() {
    if (!analyser) return null;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var pk = 0; for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > pk) pk = x; }
    return { peak: 20 * Math.log10(pk + 1e-9) };
  }

  // ==========================================================================
  // CHECK — offline render, and the trombone lab's measures
  // ==========================================================================
  var offlineIR = null;
  function render(id, o) {
    o = o || {};
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : fetchIR(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      var dummy = new OfflineAudioContext(2, SR, SR);
      var est = P[id](dummy, dummy.destination, 0.1, o);
      var rm = o.room || room;
      var len = Math.ceil((est.dur + 1.2 + (rm === "dry" ? 0 : 3)) * SR);
      var off = new OfflineAudioContext(2, len, SR);
      var ch = buildChain(off, rm, ir, off.destination);
      var res = P[id](off, ch.input, 0.1, o);
      return off.startRendering().then(function (buf) { return { buf: buf, res: res }; });
    });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
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
  function highpass(x, fc) {
    var w = Math.tan(Math.PI * fc / SR), q = Math.SQRT1_2, nn = 1 / (1 + w / q + w * w);
    var bb = [nn, -2 * nn, nn], aa = [1, 2 * (w * w - 1) * nn, (1 - w / q + w * w) * nn];
    return biquad(biquad(x, bb, aa), bb, aa);
  }
  // BS.1770-4 over [a, b): integrated (gated) and the loudest 3-second window
  function loudnessOf(k, a, b) {
    a = a || 0; b = b || k[0].length;
    var n = b - a, sq = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) { var e = 0; for (var c = 0; c < k.length; c++) e += k[c][a + i] * k[c][a + i]; sq[i + 1] = sq[i] + e; }
    function L(s, len) { return -0.691 + 10 * Math.log10((sq[s + len] - sq[s]) / len + 1e-20); }
    var B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), S3 = Math.round(3 * SR), blocks = [];
    for (var s = 0; s + B <= n; s += H) blocks.push(L(s, B));
    var abs = blocks.filter(function (l) { return l > -70; });
    function meanL(ls) { var m = 0; ls.forEach(function (l) { m += Math.pow(10, (l + 0.691) / 10); }); return -0.691 + 10 * Math.log10(m / Math.max(1, ls.length) + 1e-20); }
    var gate = meanL(abs) - 10;
    var I = meanL(abs.filter(function (l) { return l > gate; }));
    var sMax = -Infinity;
    for (var s3 = 0; s3 + S3 <= n; s3 += H) { var l3 = L(s3, S3); if (l3 > sMax) sMax = l3; }
    if (!isFinite(sMax)) sMax = L(0, n);
    return { I: abs.length ? I : -Infinity, S: sMax };
  }
  function analyse(buf, res, id) {
    var L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, pk = 0, clip = 0;
    var mono = new Float32Array(n);
    for (var i = 0; i < n; i++) { mono[i] = (L[i] + R[i]) * 0.5; var a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; if (a > 0.989) clip++; }
    var kw = [kWeight(L), kWeight(R)], lu = loudnessOf(kw);
    // CLICKS: 1 ms blocks above 4 kHz standing 12× (21.6 dB) over the loudest
    // block of the 30 ms on each side (the instruments lab's measure) — and
    // then sorted: a burst inside a window the phrase asked for (a clapper,
    // a knock, a consonant, a rap) is a stroke; any other is a click
    var hp = highpass(mono, 4000), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) { var e2 = 0; for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q]; hf.push(Math.sqrt(e2 / H)); }
    function maxOf(arr) { var mx = 0; for (var z0 = 0; z0 < arr.length; z0++) if (arr[z0] > mx) mx = arr[z0]; return mx; }
    var ex = (res.expect || []).map(function (w) { return [w[0] + 0.1 - 0.012, w[1] + 0.1 + 0.012]; });
    var strokes = 0, clicks = [];
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = Math.max(maxOf(hf.slice(z - 30, z - 2)), maxOf(hf.slice(z + 3, z + 30)));
      if (hf[z] > ref * 12) {
        var tz = z * H / SR, asked = ex.some(function (w) { return tz >= w[0] && tz <= w[1]; });
        if (asked) strokes++; else clicks.push(+(tz - 0.1).toFixed(3));
      }
    }
    var out = { id: id, seconds: +(n / SR).toFixed(1), lufs: +lu.I.toFixed(1), lufsShortMax: +lu.S.toFixed(1), peakDb: +db(pk).toFixed(2), clipped: clip, strokes: strokes, clicks: clicks.length, clickTimes: clicks.slice(0, 12) };
    if (res.stats) out.nodes = res.stats;
    // THE LINE: each bell's side, from the output's own L/R energy while it
    // rings alone (dB; negative = left)
    if (res.line) {
      var gap = P.line.gap;
      out.line = res.line.map(function (b, i) {
        var a0 = Math.floor((0.1 + i * gap + 0.005) * SR), b0 = Math.floor((0.1 + i * gap + 0.3) * SR), eL = 0, eR = 0;
        for (var x = a0; x < b0; x++) { eL += L[x] * L[x]; eR += R[x] * R[x]; }
        return { f: b.f, pan: b.pan, balanceDb: +(10 * Math.log10((eR + 1e-12) / (eL + 1e-12))).toFixed(1) };
      });
      // is the line a line? rank correlation of pitch against side
      var bs = out.line.map(function (x) { return x.balanceDb; });
      var ranks = bs.map(function (v) { return bs.filter(function (w) { return w < v; }).length; });
      var m = (bs.length - 1) / 2, sxy = 0, sxx = 0, syy = 0;
      ranks.forEach(function (rk, i) { sxy += (i - m) * (rk - m); sxx += (i - m) * (i - m); syy += (rk - m) * (rk - m); });
      out.lineRho = +(sxy / Math.sqrt(sxx * syy + 1e-12)).toFixed(3);
    }
    // THE TWELFTH, measured: one bell rung alone (the technique phrase's
    // first ring) — the spectrum's peak near 3f against the peak near f
    if (id === "tech") {
      var N = 65536, a1 = Math.floor(0.12 * SR), re = new Float32Array(N), im = new Float32Array(N);
      for (var u = 0; u < N; u++) { var w0 = 0.5 - 0.5 * Math.cos(2 * Math.PI * u / N); re[u] = (mono[a1 + u] || 0) * w0; }
      fft(re, im);
      var f0 = res.f || settings().keynote * 2;
      function peakNear(fq) {
        var lo = Math.floor((fq * 0.97) * N / SR), hi = Math.ceil((fq * 1.03) * N / SR), bi = lo, bv = 0;
        for (var j = lo; j <= hi; j++) { var pw = re[j] * re[j] + im[j] * im[j]; if (pw > bv) { bv = pw; bi = j; } }
        var y0 = Math.log(re[bi - 1] * re[bi - 1] + im[bi - 1] * im[bi - 1] + 1e-30), y1 = Math.log(bv + 1e-30), y2 = Math.log(re[bi + 1] * re[bi + 1] + im[bi + 1] * im[bi + 1] + 1e-30);
        var d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 || 1);
        return (bi + d) * SR / N;
      }
      var pf = peakNear(f0), p3 = peakNear(3 * f0);
      out.twelfth = { fundamentalHz: +pf.toFixed(2), twelfthHz: +p3.toFixed(2), ratio: +(p3 / pf).toFixed(4), centsFromPure: +(1200 * Math.log(p3 / pf / 3) / Math.LN2).toFixed(2) };
    }
    return out;
  }
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
  var refLufs = null;
  function reference() {
    if (refLufs != null) return Promise.resolve(refLufs);
    return render("reference", { room: room }).then(function (r) { refLufs = analyse(r.buf, r.res, "reference").lufsShortMax; return refLufs; });
  }
  function check(id, o) {
    o = o || {};
    return reference().then(function (ref) {
      return render(id, o).then(function (r) {
        var out = analyse(r.buf, r.res, id);
        out.refShortMax = ref; out.vsRef = +(out.lufsShortMax - ref).toFixed(1);
        if (r.res.score) out.score = r.res.score;
        return out;
      });
    });
  }

  // ==========================================================================
  // THE ODDS — each guest's plan() over a stand-in of the engine's planner
  // ==========================================================================
  // The stand-in throws the dice kolob-meeting.js planMeeting throws, in its
  // order, for the parts that matter to a seat: the calendar's kind; the
  // order of service (hymns by kind, the testimony cut, the interlude, the
  // testimony and sacrament trading places, the second doxology); and the
  // other guests' dice and seats (the bands 36 %, the steeples 7.5 %, the old
  // tune 15 % when the mode admits a tune, the trombones at dawn as their
  // plan() would seat them). The harness measures the same against the real
  // planner once the engine seats these guests.
  var CALENDAR = [["ordinary", 0.52], ["fast", 0.15], ["conference", 0.19], ["jubilee", 0.14]];
  var HYMNS = { ordinary: 2, fast: 1, conference: 3, jubilee: 3 };
  var TB_W = { ordinary: 1, fast: 0.35, conference: 1.5, jubilee: 1.5 };
  function standIn(R) {
    var kind = R.pickW(CALENDAR);
    var cutT = R.chance(0.25), inter = R.chance(0.15), trade = R.chance(0.1), dox2 = R.chance(0.5);
    var secs = [{ type: "prelude" }, { type: "invocation" }];
    for (var h = 0; h < HYMNS[kind]; h++) secs.push({ type: "hymn" });
    secs.push({ type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" });
    if (cutT) secs = secs.filter(function (s) { return s.type !== "testimony"; });
    if (HYMNS[kind] >= 2 && inter) { for (var i = 0; i < secs.length; i++) if (secs[i].type === "hymn") { secs.splice(i + 1, 0, { type: "interlude" }); break; } }
    if (trade) {
      var ti = -1, si = -1;
      secs.forEach(function (s, k) { if (s.type === "testimony") ti = k; if (s.type === "sacrament") si = k; });
      if (ti >= 0 && si >= 0) { var tmp = secs[ti]; secs[ti] = secs[si]; secs[si] = tmp; }
    }
    if (kind === "jubilee" && dox2) secs.splice(secs.length - 1, 0, { type: "doxology" });
    var have = {}; secs.forEach(function (s) { have[s.type] = true; });
    function seatIn(prefs) { for (var k = 0; k < prefs.length; k++) if (have[prefs[k]]) return prefs[k]; return null; }
    var guests = [];
    var bDie = R.chance(0.36), bSeat = R.chance(0.7), stDie = R.chance(0.075), stSeat = R.chance(0.55), oDie = R.chance(0.15), oSeat = R.chance(0.65), pool = R.chance(0.8);
    if (bDie) { var bs = bSeat ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]); if (bs) guests.push({ type: "bands", section: bs }); }
    if (stDie) guests.push({ type: "steeples", section: stSeat ? "prelude" : "postlude" });
    if (pool && oDie) { var os = oSeat ? seatIn(["prelude", "testimony"]) : seatIn(["testimony", "interlude", "prelude"]); if (os) guests.push({ type: "oldtune", section: os }); }
    var tbRoll = R.next();
    var preTaken = guests.some(function (g) { return g.section === "prelude"; }), bands = guests.some(function (g) { return g.type === "bands"; });
    if (!bands && !preTaken && tbRoll < Math.min(0.9, 0.21 * TB_W[kind])) guests.push({ type: "trombones", section: "prelude" });
    return { kind: kind, sections: secs, guests: guests };
  }
  function odds(N, opts) {
    N = N || 20000; opts = opts || {};
    var R0 = window.PJ2.Rand.stream(99).fork("lab:odds");
    var res = { n: N, handbells: { seated: 0, byKind: {}, seats: {}, pieces: {}, why: {} }, school: { seated: 0, byKind: {}, why: {} }, both: 0 };
    var exp = opts.experimental || { singingSchool: true };
    for (var i = 1; i <= N; i++) {
      var m = standIn(R0);
      var hbd = HB.decide({ n: i, kind: m.kind, sections: m.sections, guests: m.guests }, window.PJ2.Rand.stream(i).fork(HB.LABEL + i));
      var ssd = SS.decide({ n: i, kind: m.kind, sections: m.sections, guests: m.guests, experimental: exp }, window.PJ2.Rand.stream(i).fork(SS.LABEL + i));
      var hk = res.handbells.byKind[m.kind] = res.handbells.byKind[m.kind] || { n: 0, seated: 0 };
      var sk = res.school.byKind[m.kind] = res.school.byKind[m.kind] || { n: 0, seated: 0 };
      hk.n++; sk.n++;
      if (hbd.seat) { res.handbells.seated++; hk.seated++; res.handbells.seats[hbd.seat.seat] = (res.handbells.seats[hbd.seat.seat] || 0) + 1; res.handbells.pieces[hbd.seat.piece] = (res.handbells.pieces[hbd.seat.piece] || 0) + 1; }
      else { var w = hbd.why.replace(/ \(.*/, ""); res.handbells.why[w] = (res.handbells.why[w] || 0) + 1; }
      if (ssd.seat) { res.school.seated++; sk.seated++; } else { var w2 = ssd.why.replace(/ \(.*/, ""); res.school.why[w2] = (res.school.why[w2] || 0) + 1; }
      if (hbd.seat && ssd.seat) res.both++;
    }
    res.handbells.rate = res.handbells.seated / N; res.school.rate = res.school.seated / N;
    return res;
  }

  // ==========================================================================
  // PURITY — the same stream, the same plan and score; no Math.random
  // ==========================================================================
  function purity() {
    var st = settings(), h = composeHymn(st), info = { n: 1, kind: "ordinary", sections: [{ type: "prelude" }, { type: "invocation" }, { type: "hymn" }, { type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" }], guests: [], force: true };
    var real = Math.random, calls = 0;
    Math.random = function () { calls++; return real(); };
    var a, b, c, d;
    try {
      a = JSON.stringify([HB.plan(info, hbStream(st.seed)), HB.score(HB.prepare({ hymn: h, keynoteHz: st.keynote }, hbStream(st.seed)), hbStream(st.seed), 0).rings]);
      b = JSON.stringify([HB.plan(info, hbStream(st.seed)), HB.score(HB.prepare({ hymn: h, keynoteHz: st.keynote }, hbStream(st.seed)), hbStream(st.seed), 0).rings]);
      c = JSON.stringify([SS.plan(Object.assign({ experimental: { singingSchool: true } }, info), ssStream(st.seed)), SS.score(SS.prepare({ hymn: h, keynoteHz: st.keynote }, ssStream(st.seed)), ssStream(st.seed), 0).items]);
      d = JSON.stringify([SS.plan(Object.assign({ experimental: { singingSchool: true } }, info), ssStream(st.seed)), SS.score(SS.prepare({ hymn: h, keynoteHz: st.keynote }, ssStream(st.seed)), ssStream(st.seed), 0).items]);
    } finally { Math.random = real; }
    var off = SS.plan(Object.assign({ experimental: { singingSchool: false } }, info), ssStream(st.seed));
    // the folk voice's decay law and the guest's copy of it
    var agree = [165, 260, 523, 1047, 2093, 2640].every(function (f) { return Math.abs(K.VoicesFolk.bell.tau(f) - HB.bellTau(f)) < 1e-12; });
    return { handbellsRepeat: a === b, schoolRepeat: c === d, mathRandomCalls: calls, schoolOffSeats: off, decayLawAgrees: agree };
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function mmss(s) { var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function table(head, rows) {
    var wrap = el("div", "kgl-scroll"), t = el("table", "kgl-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    t.appendChild(tr);
    rows.forEach(function (r) { var row = el("tr"); r.forEach(function (c) { row.appendChild(el("td", null, c == null ? "—" : String(c))); }); t.appendChild(row); });
    wrap.appendChild(t);
    return wrap;
  }
  function measLine(r) {
    return "loudness " + r.lufs + " LUFS (loudest 3 s " + r.lufsShortMax + ", " + (r.vsRef > 0 ? "+" : "") + r.vsRef + " LU against the organ reference) · peak " + r.peakDb + " dBFS · clipped " + r.clipped +
      " · strokes " + r.strokes + " · clicks " + r.clicks + (r.clicks ? " (at " + r.clickTimes.join(", ") + " s)" : "") +
      (r.nodes ? (r.nodes.singers ? " · the singers' nodes: ≈" + r.nodes.peakLive + " live at peak, " + r.nodes.meanLive + " on average" : " · nodes: " + r.nodes.created + " made, ≤ " + r.nodes.maxRing + " a ring, ≈" + r.nodes.peakLive + " live at peak") : "");
  }
  function bellName(b, mode) {
    var cl = mod(b.letter - DO_OF[mode], 7), oct = Math.floor((b.letter - DO_OF[mode]) / 7);
    return SOLF[cl] + (b.alt ? "♯" : "") + (oct > 1 ? "″" : oct > 0 ? "′" : oct < 0 ? "," : "");
  }
  function button(txt, cls, fn) { var b = el("button", cls || null, txt); b.type = "button"; b.addEventListener("click", fn); return b; }
  function busy(btn, p) {
    btn.disabled = true;
    return p.then(function (x) { btn.disabled = false; return x; }, function (e) { btn.disabled = false; throw e; });
  }

  var cards = null, hbView = {}, ssView = {};
  function hymnLine() {
    var st = settings(), h = composeHymn(st), hy = h.hymnist || {};
    var e = document.getElementById("kgl-hymn");
    e.textContent = "";
    e.appendChild(el("b", null, h.nameEn || h.id));
    e.appendChild(document.createTextNode(" · " + h.meter + " · " + ({ tabernacle: "Tabernacle", sacredharp: "Sacred Harp", oldway: "the Old Way" }[h.dialect] || h.dialect) + " · " + h.mode + " · " + h.modeOfTime + " · " + (hy.nameEn ? "by " + hy.nameEn + " · " : "") + h.beatS.toFixed(2) + " s a beat · the tune in the " + ({ S: "soprano", T: "tenor" }[h.melodyPart] || h.melodyPart)));
  }

  // ---- the handbell card ------------------------------------------------------
  function bellsCard() {
    var card = el("section", "kgl-card");
    card.appendChild(el("h2", "kgl-name", "The ward's handbell choir"));
    card.appendChild(el("p", "kgl-phrase", "Eight to twelve ringers in a line from low to high across the front of the chapel, ringing the day's hymn or a round: rung and damped, let ring, martellato on the padded table, the thumb damp, the shake, and a cascade down the line to finish. Close, bright and dry — the first guest that stands in the room."));
    var row = el("div", "kgl-row");
    var piece = el("select"); piece.id = "kgl-piece";
    [["auto", "as the seed draws it"], ["hymn", "the hymn"], ["round", "a round"]].forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; piece.appendChild(op); });
    var seat = el("select"); seat.id = "kgl-seat";
    [["invocation", "in the invocation"], ["sacrament", "before the sacrament"], ["postlude", "in the postlude"]].forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; seat.appendChild(op); });
    var lp = el("label", null, "ring "); lp.appendChild(piece);
    var ls = el("label", null, "seat "); ls.appendChild(seat);
    var phone = el("input"); phone.type = "checkbox"; phone.id = "kgl-phone";
    var lph = el("label"); lph.appendChild(phone); lph.appendChild(document.createTextNode(" a phone's cap (" + HB.MAX_LIVE.phone + " rings at once)"));
    row.appendChild(lp); row.appendChild(ls); row.appendChild(lph);
    card.appendChild(row);
    var row2 = el("div", "kgl-row");
    var bPlay = button("▶ ring", "kgl-play", function () { play("bells"); });
    var bCheck = button("check", "kgl-check", function () { busy(bCheck, check("bells").then(function (r) { hbView.meas.textContent = measLine(r); techRow(r.score); })).catch(showErr(hbView.meas)); });
    row2.appendChild(bPlay); row2.appendChild(bCheck);
    card.appendChild(row2);
    hbView.line = el("div", "kgl-line"); card.appendChild(hbView.line);
    hbView.sides = el("div", "kgl-stage-note"); card.appendChild(hbView.sides);
    hbView.stat = el("p", "kgl-stat"); card.appendChild(hbView.stat);
    hbView.plan = el("ol", "kgl-plan"); card.appendChild(hbView.plan);
    hbView.tech = el("p", "kgl-stat"); card.appendChild(hbView.tech);
    hbView.meas = el("p", "kgl-meas"); card.appendChild(hbView.meas);
    var row3 = el("div", "kgl-row");
    var bTech = button("one bell, every technique", null, function () { play("tech"); });
    var bTechC = button("check it", "kgl-check", function () { busy(bTechC, check("tech").then(function (r) { hbView.meas2.textContent = measLine(r) + (r.twelfth ? " · the twelfth " + r.twelfth.twelfthHz + " Hz over " + r.twelfth.fundamentalHz + " Hz: ×" + r.twelfth.ratio + " (" + (r.twelfth.centsFromPure >= 0 ? "+" : "") + r.twelfth.centsFromPure + " cents from a pure 3:1)" : ""); })).catch(showErr(hbView.meas2)); });
    var bLine = button("down the line, low to high", null, function () { play("line"); });
    var bLineC = button("check it", "kgl-check", function () { busy(bLineC, check("line").then(function (r) { hbView.meas2.textContent = measLine(r) + " · each bell's side, low to high (dB, − = left): " + r.line.map(function (x) { return (x.balanceDb > 0 ? "+" : "") + x.balanceDb; }).join(" ") + " · pitch against side, rank correlation " + r.lineRho; })).catch(showErr(hbView.meas2)); });
    var bComma = button("the comma bells", null, function () { play("comma").then(function (res) { hbView.meas2.textContent = res.none ? "this arrangement needs no comma bell" : "the comma pair: " + res.pair[0].f.toFixed(2) + " and " + res.pair[1].f.toFixed(2) + " Hz, " + (1200 * Math.log(res.pair[1].f / res.pair[0].f) / Math.LN2).toFixed(1) + " cents apart — alone, then together"; }); });
    [bTech, bTechC, bLine, bLineC, bComma].forEach(function (b) { row3.appendChild(b); });
    card.appendChild(row3);
    hbView.meas2 = el("p", "kgl-meas"); card.appendChild(hbView.meas2);
    [piece, seat, phone].forEach(function (x) { x.addEventListener("change", bellsPlan); });
    return card;
  }
  function techRow(sc) {
    var t = {}, roles = {};
    sc.strikes.forEach(function (s) { t[s.tech] = (t[s.tech] || 0) + 1; roles[s.role] = (roles[s.role] || 0) + 1; });
    var NAMES = { ring: "let ring", damp: "damped", mart: "martellato", thumb: "thumb damp", shake: "shaken" };
    hbView.tech.textContent = "strokes by technique: " + Object.keys(t).map(function (k) { return (NAMES[k] || k) + " " + t[k]; }).join(" · ") + " — by part: " + Object.keys(roles).map(function (k) { return k + " " + roles[k]; }).join(" · ");
  }
  function bellsPlan() {
    var st = settings(), sc;
    try { sc = HB.score(bellMaterial(st, { seat: seatNow(), piece: pieceNow(), phone: phoneNow() }), hbStream(st.seed), 0); }
    catch (e) { hbView.stat.textContent = "score: " + e.message; return; }
    hbView.score = sc;
    var line = hbView.line; line.textContent = "";
    // the ringers as we see them: the audience's left first
    var rs = sc.ringers.slice().sort(function (a, b) { return a.pan - b.pan; });
    rs.forEach(function (r) {
      var box = el("div", "kgl-ringer"); box.dataset.ringer = r.i;
      box.appendChild(el("b", null, "ringer " + (r.i + 1)));
      r.bells.forEach(function (bi) {
        var b = sc.bells[bi];
        var sp = el("span", null, bellName(b, sc.mode));
        sp.title = b.f.toFixed(2) + " Hz" + (b.spare ? " (in the set, not in this arrangement)" : "");
        sp.dataset.bell = bi;
        box.appendChild(sp); box.appendChild(el("br"));
      });
      line.appendChild(box);
    });
    hbView.sides.textContent = "";
    hbView.sides.appendChild(el("span", null, "← the audience's left" + (sc.shape.lowRight ? " (the treble)" : " (the bass)")));
    hbView.sides.appendChild(el("span", null, "(the " + (sc.shape.lowRight ? "bass" : "treble") + ") the audience's right →"));
    var commas = 0, byL = {};
    sc.bells.forEach(function (b) { if (!b.alt) byL[b.letter] = (byL[b.letter] || 0) + 1; });
    Object.keys(byL).forEach(function (k) { if (byL[k] > 1) commas += byL[k] - 1; });
    var alts = sc.bells.filter(function (b) { return b.alt; }).length;
    hbView.stat.textContent = sc.source + " · " + sc.piece + " · " + sc.seat + " · " + sc.bells.length + " bells (" + sc.bells[0].f.toFixed(0) + "–" + sc.bells[sc.bells.length - 1].f.toFixed(0) + " Hz; " + commas + " comma bell" + (commas === 1 ? "" : "s") + ", " + alts + " accidental" + (alts === 1 ? "" : "s") + ") · " +
      sc.ringers.length + " ringers · " + sc.rings.length + " rings for " + sc.strikes.length + " strokes · at most " + sc.live.peak + " ringing at once (cap " + sc.live.cap + (sc.live.stolen ? ", " + sc.live.stolen + " damped early" : "") + ") · " + sc.live.nodesPerRing + " nodes a ring · " + mmss(sc.end) + " · every bell's twelfth exactly 3:1";
    hbView.plan.textContent = "";
    sc.stages.forEach(function (sg) { hbView.plan.appendChild(el("li", null, mmss(sg.t0) + " — " + sg.label)); });
    techRow(sc);
  }

  // ---- the singing-school card --------------------------------------------------
  function schoolCard() {
    var card = el("section", "kgl-card");
    var h = el("h2", "kgl-name", "The singing school");
    ssView.badge = el("span", "kgl-badge", "experimental");
    h.appendChild(ssView.badge);
    card.appendChild(h);
    card.appendChild(el("p", "kgl-phrase", "You arrive while the choir is still practising the day's first hymn. The chorister strikes the fork; they sing the first line; one part goes wrong; she raps the stand; that part sings the passage alone, slowly, on the notes; and everyone sings it again, right. One correction — a charming rehearsal, not a glitch."));
    var flag = el("div", "kgl-flag");
    var cb = el("input"); cb.type = "checkbox"; cb.id = "kgl-exp";
    var lab = el("label"); lab.appendChild(cb); lab.appendChild(document.createTextNode(" seated in meetings (KOLOB.Experimental.singingSchool)"));
    flag.appendChild(lab);
    ssView.flagWhy = el("span", null, "");
    flag.appendChild(ssView.flagWhy);
    card.appendChild(flag);
    var how = el("p", "kgl-stat");
    how.appendChild(document.createTextNode("To switch it for a visit: "));
    how.appendChild(el("code", null, "?exp=-singingSchool"));
    how.appendChild(document.createTextNode(" in the address; in the console, "));
    how.appendChild(el("code", null, "KOLOB.Experimental.off(\"singingSchool\")"));
    how.appendChild(document.createTextNode(" (remembered by this browser until "));
    how.appendChild(el("code", null, "KOLOB.Experimental.reset()"));
    how.appendChild(document.createTextNode("). The lab plays the practice either way; the switch decides whether a meeting may seat it."));
    card.appendChild(how);
    ssView.gate = el("p", "kgl-stat"); card.appendChild(ssView.gate);
    cb.addEventListener("change", function () { X.set("singingSchool", cb.checked); });
    X.onChange(flagView);
    var row = el("div", "kgl-row");
    var bPlay = button("▶ the practice", "kgl-play", function () { play("school"); });
    var bCheck = button("check", "kgl-check", function () { busy(bCheck, check("school").then(function (r) { ssView.meas.textContent = measLine(r); })).catch(showErr(ssView.meas)); });
    row.appendChild(bPlay); row.appendChild(bCheck);
    card.appendChild(row);
    ssView.lesson = el("p", "kgl-lesson"); card.appendChild(ssView.lesson);
    ssView.notes = el("div"); card.appendChild(ssView.notes);
    ssView.plan = el("ol", "kgl-plan"); card.appendChild(ssView.plan);
    ssView.meas = el("p", "kgl-meas"); card.appendChild(ssView.meas);
    flagView();
    return card;
  }
  function flagView() {
    var on = X.isOn("singingSchool"), li = X.list().filter(function (x) { return x.name === "singingSchool"; })[0];
    var cb = document.getElementById("kgl-exp"); if (cb) cb.checked = on;
    ssView.badge.className = "kgl-badge" + (on ? "" : " off");
    ssView.badge.textContent = on ? "experimental · on" : "experimental · off";
    ssView.flagWhy.textContent = "(" + (li.from === "default" ? "the default" : li.from === "address" ? "from the address" : "switched in this browser") + ")";
    // what the planner says, for a meeting whose dice would seat it
    var st = settings(), info = { n: 1, kind: "ordinary", sections: [{ type: "prelude" }, { type: "invocation" }], guests: [], force: true };
    var d = SS.decide(info, ssStream(st.seed));
    ssView.gate.textContent = "plan() for a meeting that would seat it: " + (d.seat ? "seated in the prelude at " + d.seat.at + " s" : "refused — " + d.why);
  }
  function schoolPlan() {
    var st = settings(), sc;
    try { sc = SS.score(schoolMaterial(st), ssStream(st.seed), 0); }
    catch (e) { ssView.lesson.textContent = "score: " + e.message; return; }
    var mk = sc.lesson.mistake;
    ssView.lesson.textContent = "";
    ssView.lesson.appendChild(document.createTextNode("This practice: "));
    ssView.lesson.appendChild(el("em", null, mk.says));
    ssView.lesson.appendChild(document.createTextNode(" — " + mmss(sc.end) + " in all, " + (sc.lines > 1 ? "the second pass on through line 2" : "the second pass through line 1's cadence") + "."));
    ssView.notes.textContent = "";
    var mode = sc.prepared.mode;
    function nm(d) { var c = mod(d - DO_OF[mode], 7); return SOLF[c]; }
    if (mk.kind === "climb" && mk.wrong.length) {
      ssView.notes.appendChild(table(["note", "should be", "they sang", "off by"], mk.wrong.map(function (w) {
        var c = 1200 * Math.log(w.ratio / w.right) / Math.LN2;
        return [w.index + 1, nm(w.rightDeg), nm(w.deg), (c >= 0 ? "+" : "") + c.toFixed(0) + " cents"];
      })));
    }
    ssView.notes.appendChild(el("p", "kgl-stat", "the passage alone, on the notes: " + mk.passage.notes.map(function (n) { return n.shape; }).join(" · ") + " (notes " + (mk.passage.from + 1) + "–" + (mk.passage.to + 1) + " of the " + ({ S: "sopranos'", A: "altos'", T: "tenors'", B: "basses'", W: "women's", M: "men's" }[mk.group]) + " line)"));
    ssView.plan.textContent = "";
    sc.stages.forEach(function (sg) { ssView.plan.appendChild(el("li", null, mmss(sg.t0) + " — " + sg.label)); });
  }

  // ---- the odds and the purity card ----------------------------------------------
  function oddsCard() {
    var card = el("section", "kgl-card");
    card.appendChild(el("h2", "kgl-name", "The odds, and purity"));
    card.appendChild(el("p", "kgl-phrase", "Each guest's plan() over 20,000 meetings of a stand-in for the engine's planner (its calendar and order of service, and the other guests' own dice and seats); and the pure parts run twice on the same stream, with Math.random watched."));
    var out = el("div"), pOut = el("p", "kgl-meas");
    var row = el("div", "kgl-row");
    var bOdds = button("run the odds", null, function () {
      busy(bOdds, new Promise(function (res) { setTimeout(function () { res(odds(20000)); }, 20); })).then(function (r) {
        var off = odds(4000, { experimental: { singingSchool: false } });
        out.textContent = "";
        var kinds = ["ordinary", "fast", "conference", "jubilee"];
        out.appendChild(table(["guest", "all meetings"].concat(kinds), [
          ["the handbells", (100 * r.handbells.rate).toFixed(1) + " %"].concat(kinds.map(function (k) { var x = r.handbells.byKind[k]; return x ? (100 * x.seated / x.n).toFixed(1) + " %" : "—"; })),
          ["the singing school", (100 * r.school.rate).toFixed(1) + " %"].concat(kinds.map(function (k) { var x = r.school.byKind[k]; return x ? (100 * x.seated / x.n).toFixed(1) + " %" : "—"; })),
          ["the school, switched off", (100 * off.school.rate).toFixed(1) + " %", "", "", "", ""],
        ]));
        var seats = Object.keys(r.handbells.seats).map(function (s) { return s + " " + (100 * r.handbells.seats[s] / r.handbells.seated).toFixed(0) + " %"; }).join(" · ");
        var pieces = Object.keys(r.handbells.pieces).map(function (s) { return s + " " + (100 * r.handbells.pieces[s] / r.handbells.seated).toFixed(0) + " %"; }).join(" · ");
        out.appendChild(el("p", "kgl-stat", "the handbells' seats: " + seats + " · pieces: " + pieces + " · refused: " + Object.keys(r.handbells.why).map(function (w) { return w + " " + r.handbells.why[w]; }).join(" · ")));
        out.appendChild(el("p", "kgl-stat", "the singing school refused: " + Object.keys(r.school.why).map(function (w) { return w + " " + r.school.why[w]; }).join(" · ") + " · both in one meeting: " + r.both));
        out.appendChild(el("p", "kgl-stat", "per Sunday (plan()'s own chance, before refusals) — handbells: " + Object.keys(HB.ODDS.weight).map(function (k) { return k + " " + (100 * Math.min(HB.ODDS.cap, HB.ODDS.base * HB.ODDS.weight[k])).toFixed(0) + "%"; }).join(", ") + "; the school: " + Object.keys(SS.ODDS.weight).map(function (k) { return k + " " + (100 * Math.min(SS.ODDS.cap, SS.ODDS.base * SS.ODDS.weight[k])).toFixed(0) + "%"; }).join(", ")));
      });
    });
    var bPure = button("check purity", null, function () {
      var r = purity();
      pOut.textContent = "the handbells: same stream, same plan and score — " + (r.handbellsRepeat ? "yes" : "NO") + " · the school: " + (r.schoolRepeat ? "yes" : "NO") + " · Math.random calls while planning and scoring: " + r.mathRandomCalls + " · the school switched off seats: " + (r.schoolOffSeats ? "YES (wrong)" : "nothing") + " · the voice's decay law and the score's copy agree: " + (r.decayLawAgrees ? "yes" : "NO");
    });
    row.appendChild(bOdds); row.appendChild(bPure);
    card.appendChild(row); card.appendChild(out); card.appendChild(pOut);
    return card;
  }
  function showErr(host) { return function (e) { host.textContent = "error: " + (e && e.message ? e.message : e); if (window.console) console.warn(e); }; }

  // ---- light the ringer who strikes -------------------------------------------------
  function lightLoop() {
    if (lightTimer) return;
    lightTimer = setInterval(function () {
      var m = meter();
      var me = document.getElementById("kgl-meter");
      if (me) me.textContent = m ? "out " + (m.peak < -90 ? "—" : m.peak.toFixed(1) + " dBFS") : "out —";
      if (!actx || !hbView.line) return;
      var now = actx.currentTime, lit = {};
      lights.forEach(function (n) { if (n.ringer != null && n.t <= now && now < n.t + 0.16) lit[n.bell] = true; });
      Array.prototype.forEach.call(hbView.line.querySelectorAll("span[data-bell]"), function (sp) { sp.className = lit[sp.dataset.bell] ? "lit" : ""; });
    }, 60);
  }

  function refresh() {
    try { hymnLine(); } catch (e) { document.getElementById("kgl-hymn").textContent = "compose: " + e.message; return; }
    bellsPlan(); schoolPlan(); flagView();
  }
  function init() {
    cards = document.getElementById("kgl-cards");
    cards.appendChild(bellsCard());
    cards.appendChild(schoolCard());
    cards.appendChild(oddsCard());
    ["kgl-seed", "kgl-dialect", "kgl-mode", "kgl-key"].forEach(function (id) { document.getElementById(id).addEventListener("change", function () { stop(); refresh(); }); });
    document.getElementById("kgl-room").addEventListener("change", function (e) { setRoom(e.target.value); refLufs = null; });
    document.getElementById("kgl-stop").addEventListener("click", stop);
    document.getElementById("kgl-compose").addEventListener("click", function () { var s = document.getElementById("kgl-seed"); s.value = Math.round(num("kgl-seed", 4)) + 1; stop(); refresh(); });
    // a link can carry the settings: ?seed=4&dialect=sacredharp&mode=aeolian&piece=round&seat=postlude
    var q = window.location.search;
    [["seed", "kgl-seed"], ["dialect", "kgl-dialect"], ["mode", "kgl-mode"], ["key", "kgl-key"], ["piece", "kgl-piece"], ["seat", "kgl-seat"]].forEach(function (p) {
      var m = new RegExp("[?&]" + p[0] + "=([^&#]*)").exec(q);
      if (m) { var e = document.getElementById(p[1]); if (e) e.value = decodeURIComponent(m[1]); }
    });
    refresh();
    lightLoop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return {
    play: play, stop: stop, check: check, render: render, odds: odds, purity: purity, setRoom: setRoom,
    hymn: function () { return composeHymn(settings()); },
    score: function (which) { var st = settings(); return which === "school" ? SS.score(schoolMaterial(st), ssStream(st.seed), 0) : HB.score(bellMaterial(st, { seat: seatNow(), piece: pieceNow(), phone: phoneNow() }), hbStream(st.seed), 0); },
    refresh: refresh, _P: P,
  };
})();
