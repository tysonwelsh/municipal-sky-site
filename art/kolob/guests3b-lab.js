// ============================================================================
// GUESTS LAB 3B — the bench for the organist's variations on a hymn and for
// change ringing from a far tower (dev, unlinked; see guests3b-lab.php)
//
// THE CHAIN is the app's (kolob-core.js init(), as guests-lab and the
// trombone lab copy it): the rooms → the voices' bus → glue → master 0.6 →
// tanh(1.15) → compressor (−18, 3:1) → a brick-wall guard at −1 dBFS. The
// ROOMS: the tabernacle (St Margaret's, wet 0.40) and the meetinghouse
// (short, wet 0.28); AS SEATED, each voice goes into both at the section's
// balance plus its layer's depth (PJ2.Fx.roomBlend, as the engine seats a
// layer): the organ into the organ layer at the owner's 0.40, at the
// prelude's balance and the organ's depth; the far tower into the
// tabernacle's wide send alone (the steeples' visitors' way); the
// meetinghouse bell into the bells layer (0.5).
//
// For silent checks: window.Guests3bLab = { compose, playVariations,
// playChanges, stop, checkVariations, checkChanges, analyse, odds, purity,
// state }.
// ============================================================================
window.Guests3bLab = (function () {
  "use strict";

  var SR = 48000;
  var K = window.KOLOB, GV = K.GuestVariations, GC = K.GuestChanges, O = K.Organist, VO = K.VoicesOrgan;
  var ORGAN_LAYER = 0.40, BELLS_LAYER = 0.5;
  var ROOM_BALANCE = { prelude: 0.55, postlude: 0.55 }, ORGAN_DEPTH = 0.10, BELLS_DEPTH = 0;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = $(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = $(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function mmss(x) { var m = Math.floor(x / 60), s = x - 60 * m; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  function cl01(x) { return Math.max(0, Math.min(1, x)); }

  // ==========================================================================
  // THE ROOMS AND THE CHAIN
  // ==========================================================================
  var irBytes = null;
  var irReady = fetch("../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function (b) { irBytes = b; }, function () { irBytes = null; });
  var TAPS = [[0.008, 0.9], [0.013, 0.7], [0.019, 0.62], [0.026, 0.5], [0.033, 0.42], [0.041, 0.34], [0.052, 0.27], [0.064, 0.2]];
  function pour(ctx, decayS, bright) {
    var len = Math.floor(ctx.sampleRate * decayS), buf = ctx.createBuffer(2, len, ctx.sampleRate), s = 12345;
    function r() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, a = Math.min(0.95, 0.35 * bright);
      for (var i = 0; i < len; i++) { var tt = i / ctx.sampleRate; lp += a * (r() - lp); d[i] = lp * Math.pow(1 - i / len, 2.2) * Math.min(1, tt / 0.06) * 0.5; }
      TAPS.forEach(function (tp, k) { var ix = Math.floor((tp[0] + (ch ? 0.0013 * (k % 3) : 0)) * ctx.sampleRate); if (ix < len) d[ix] += tp[1] * 0.5 * (k % 2 ? -1 : 1); });
    }
    return buf;
  }
  function irFor(ctx) {
    return irReady.then(function () {
      if (!irBytes) return pour(ctx, 5.5, 0.8);
      return ctx.decodeAudioData(irBytes.slice(0)).then(function (b) { return b; }, function () { return pour(ctx, 5.5, 0.8); });
    });
  }
  // → { organ, bells, wide, out }: the three ways in (see the header)
  function buildChain(ctx, ir, dest, room) {
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, 0); return g; }
    var voices = G(1);
    function unit(which) {
      var src = G(1), dry = G(1);
      src.connect(dry); dry.connect(voices);
      if (which === "dry") return src;
      var spec = which === "close" ? { pre: 0.012, wet: 0.28 } : { pre: 0.063, wet: 0.40 };
      var pre = ctx.createDelay(0.25); pre.delayTime.setValueAtTime(spec.pre, 0);
      var conv = ctx.createConvolver(); conv.buffer = which === "close" ? pour(ctx, 1.4, 1.2) : ir;
      var wet = G(spec.wet);
      src.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(voices);
      return src;
    }
    var rooms = room === "seated" ? { close: unit("close"), wide: unit("wide") } : { one: unit(room) };
    function seat(balance) {
      var g = G(1);
      if (rooms.one) { g.connect(rooms.one); return g; }
      var th = cl01(balance) * Math.PI / 2, gc = G(Math.cos(th)), gw = G(Math.sin(th));
      g.connect(gc); g.connect(gw); gc.connect(rooms.close); gw.connect(rooms.wide);
      return g;
    }
    var organ = G(ORGAN_LAYER), bells = G(BELLS_LAYER);
    organ.connect(seat(ROOM_BALANCE.prelude + ORGAN_DEPTH));
    bells.connect(seat(ROOM_BALANCE.prelude + BELLS_DEPTH));
    var wide = rooms.one ? rooms.one : rooms.wide;
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, 0); glue.knee.setValueAtTime(22, 0); glue.ratio.setValueAtTime(1.7, 0); glue.attack.setValueAtTime(0.025, 0); glue.release.setValueAtTime(0.22, 0);
    var master = G(0.6), sat = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = c; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, 0); comp.knee.setValueAtTime(16, 0); comp.ratio.setValueAtTime(3, 0); comp.attack.setValueAtTime(0.015, 0); comp.release.setValueAtTime(0.25, 0);
    var guard = ctx.createDynamicsCompressor();
    guard.threshold.setValueAtTime(-1, 0); guard.knee.setValueAtTime(0, 0); guard.ratio.setValueAtTime(20, 0); guard.attack.setValueAtTime(0.002, 0); guard.release.setValueAtTime(0.1, 0);
    voices.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(guard); guard.connect(dest);
    var meter = ctx.createAnalyser(); meter.fftSize = 2048; guard.connect(meter);
    return { organ: organ, bells: bells, wide: wide, out: guard, meter: meter };
  }

  // ==========================================================================
  // THE REFERENCES. The engine's organ as the prelude plays it (organChord,
  // copied line for line from kolob-voices-organ.js, R1 applied — organist-
  // lab's REF.prelude: four chords at 0.75 × (0.6 + 0.4 × 0.21)) into the
  // organ layer; and the steeples as the meeting rings them now (kolob-
  // guests.js steeplesAnswer, one minute of it: the meetinghouse bell into
  // the bells layer, two far steeples down their lowpass into the wide send;
  // kolob-voices-ground.js bellStrike, copied)
  // ==========================================================================
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, o = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, o); }
  var REF_CHORDS = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
  function env(g, t, pts) { g.gain.setValueAtTime(0, t); var tt = t; for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); } return tt; }
  function organChord(ctx, dest, t, dur, freqs, gainMul) {
    var stops = 0.5, trem = 0.15, pedal = 0.6, peak = (gainMul || 1) * 0.7;
    var master = ctx.createGain(), tremG = ctx.createGain(); tremG.gain.value = 1; master.connect(tremG); tremG.connect(dest);
    var RANKS = [1, 2, 3, 4], P = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32], n = freqs.length;
    for (var v = 0; v < n; v++) {
      var f = freqs[v] * 0.5;
      for (var r = 0; r < RANKS.length; r++) {
        var g = P[r] * (1 - stops) + FL[r] * stops;
        if (g < 0.05) continue;
        var pair = r === 0 ? 2 : 1;
        for (var d = 0; d < pair; d++) {
          var o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), t);
          var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(n) / pair, t);
          o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + 0.3);
        }
      }
    }
    var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, t);
    var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, t); sub.connect(sg); sg.connect(master); sub.start(t); sub.stop(t + dur + 0.3);
    var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(Math.min(0.3, trem * 0.1 / (0.92 * peak)), t);
    lfo.connect(lg); lg.connect(tremG.gain); lfo.start(t); lfo.stop(t + dur + 0.3);
    var atk = Math.min(2.2, dur * 0.3);
    env(master, t, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
  }
  function organReference(ctx, into, t, key) {
    for (var i = 0; i < 4; i++) organChord(ctx, into.organ, t + i * 6.4, 6, REF_CHORDS[i].map(function (d) { return deg(key, d); }), 0.75 * (0.6 + 0.4 * 0.21));
    return 3 * 6.4 + 6 + 0.4;
  }
  // (a fixed little generator: the reference's own sound-level jitter)
  function jit(seed) { var s = seed >>> 0 || 1; return function (a, b) { s = (s * 1664525 + 1013904223) >>> 0; return a + (b - a) * (s / 4294967296); }; }
  function bellStrike(ctx, t, gainMul, base, dest, hum, J) {
    var ratios = [1, 2.0, 2.76, 3.98, 5.4], g0 = (gainMul || 0.6) * 0.55;
    for (var i = 0; i < ratios.length; i++) for (var d = 0; d < 2; d++) {
      var o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(base * ratios[i] + (d ? J(0.4, 2.2) : 0), t);
      var og = ctx.createGain(); o.connect(og); og.connect(dest);
      env(og, t, [[0.005, g0 * 0.5 / (1 + i)], [J(3.5, 8) / (1 + i * 0.55), 0]]);
      o.start(t); o.stop(t + 10);
    }
    if (hum) {
      var h = ctx.createOscillator(); h.type = "sine"; h.frequency.setValueAtTime(base * 0.5, t);
      var hg = ctx.createGain(); h.connect(hg); hg.connect(dest); env(hg, t, [[0.012, g0 * 0.28], [J(5, 9), 0]]); h.start(t); h.stop(t + 10);
    }
  }
  // the steeples, one minute: the home bell every 8 s, two far steeples on
  // their own periods (the meeting's gains: 0.6 × ring 0.55, the visitors
  // 0.35–0.5 of it down a 2.4 kHz lowpass, all tabernacle) → { dur, expect }
  function steeplesReference(ctx, into, t, key) {
    var J = jit(7), home = key * 5 / 4 * 2, ring = 0.55, hg = 0.6 * ring, expect = [];
    while (home > 700) home /= 2; while (home < 300) home *= 2;
    for (var ht = 0; ht < 58; ht += 8) { bellStrike(ctx, t + ht, hg, home, into.bells, true, J); expect.push([ht, ht + 0.03]); }
    [[9 / 8, 0.8, 6.5], [4 / 3, -0.85, 9]].forEach(function (v, k) {
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2400, t);
      var pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(v[1], t); lp.connect(pan); pan.connect(into.wide);
      var base = home * v[0]; while (base > 700) base /= 2; while (base < 300) base *= 2;
      for (var vt = 3.5 + 3 * k; vt < 48; vt += v[2]) { bellStrike(ctx, t + vt, hg * 0.42, base, lp, false, J); expect.push([vt, vt + 0.03]); }
    });
    return { dur: 66, expect: expect };
  }

  // ==========================================================================
  // THE HYMN, THE ORGANIST, THE GUESTS' MATERIAL — from the controls
  // ==========================================================================
  var S = { hymn: null, hymnKey: null, org: null, vmat: null, cmat: null };
  function settings() {
    return {
      seed: Math.round(num("k3b-seed", 4)), dialect: val("k3b-dialect", "tabernacle"),
      keynote: Math.max(200, Math.min(320, num("k3b-key", 262))), room: val("k3b-room", "seated"),
      style: val("k3b-style", ""), chars: val("k3b-chars", "auto"),
      stage: val("k3b-stage", ""), piece: val("k3b-piece", ""), muffle: val("k3b-muffle", "auto"), blue: Math.round(num("k3b-blue", 2)),
    };
  }
  function stream(seed, label) { return window.PJ2.Rand.stream(seed >>> 0).fork(label); }
  function composeHymn(st) {
    var key = st.seed + ":" + st.dialect;
    if (S.hymn && S.hymnKey === key) return S.hymn;
    S.hymn = K.Composer.compose(stream(st.seed, "hymn:1:1"), { dialect: st.dialect });
    S.hymnKey = key;
    return S.hymn;
  }
  var CHAR_SETS = { auto: null, all: ["chorale", "trio", "canon", "minuet", "bitonal", "polonaise", "march", "finale"] };
  function organistFor(st) { return O.seat(stream(st.seed, "cast:1"), st.style ? { style: st.style } : {}); }
  function varMaterial(st) {
    var h = composeHymn(st), org = organistFor(st), chars = CHAR_SETS[st.chars] !== undefined ? CHAR_SETS[st.chars] : ["chorale", st.chars];
    S.org = org;
    S.vmat = GV.prepare({ hymn: h, organist: org, keynoteHz: st.keynote, characters: chars }, stream(st.seed, GV.LABEL + 1));
    return S.vmat;
  }
  function ringMaterial(st) {
    var mat = { keynoteHz: st.keynote };
    if (st.stage) mat.stage = st.stage;
    if (st.piece) mat.piece = st.piece;
    if (st.muffle !== "auto") mat.muffled = st.muffle === "on";
    S.cmat = GC.prepare(mat, stream(st.seed, GC.LABEL + 1));
    return S.cmat;
  }

  // ==========================================================================
  // LIVE — a context, the chain, and the guest laid out through a stand-in
  // for the engine's clock (defer: a timer that fires at the time asked);
  // the main thread each lay-out takes is timed (the press, each slice)
  // ==========================================================================
  var live = null;
  function stop() {
    if (!live) return;
    var L = live; live = null;
    L.timers.forEach(function (x) { clearTimeout(x); });
    clearInterval(L.tick);
    try { L.out.disconnect(); } catch (e) { /* gone */ }
    setTimeout(function () { try { L.ctx.close(); } catch (e) { /* gone */ } }, 200);
    document.querySelectorAll(".k3b-plan li.on").forEach(function (li) { li.classList.remove("on"); });
  }
  function start(build) {
    stop();
    var Ctor = window.AudioContext || window.webkitAudioContext, ctx = new Ctor(), st = settings();
    var L = live = { ctx: ctx, timers: [], slices: [], press: 0, notes: 0, st: st };
    return irFor(ctx).then(function (ir) {
      if (live !== L) return null;
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      var into = buildChain(ctx, ir, ctx.destination, st.room);
      L.out = into.out; L.meter = into.meter;
      var t0 = ctx.currentTime + 0.4;
      var hooks = {
        defer: function (at, fn) {
          L.timers.push(setTimeout(function () {
            if (live !== L) return;
            var a = performance.now(); fn(); L.slices.push(performance.now() - a);
          }, Math.max(0, (at - ctx.currentTime) * 1000)));
        },
        onNote: function () { L.notes++; },
      };
      var a = performance.now(), r = build(ctx, into, t0, hooks);
      L.press = performance.now() - a;
      L.t0 = t0; L.end = r.end;
      L.tick = setInterval(function () { if (live === L) { meter(); if (r.tick) r.tick(ctx.currentTime - t0); if (ctx.currentTime > r.end + 1) stop(); } }, 150);
      return L;
    });
  }
  function meter() {
    if (!live || !live.meter) return;
    var a = new Float32Array(live.meter.fftSize); live.meter.getFloatTimeDomainData(a);
    var s2 = 0, pk = 0; for (var i = 0; i < a.length; i++) { s2 += a[i] * a[i]; pk = Math.max(pk, Math.abs(a[i])); }
    var m = $("k3b-meter"); if (m) m.textContent = "out " + f1(10 * Math.log10(s2 / a.length + 1e-12)) + " dB rms · peak " + pk.toFixed(2);
  }
  function cost() {
    if (!live) return "";
    var mx = 0; live.slices.forEach(function (x) { mx = Math.max(mx, x); });
    return "laid out: " + f1(live.press) + " ms at the press, then " + live.slices.length + " slices (the largest " + f1(mx) + " ms)";
  }
  function playVariations() {
    var st = settings(), mat = varMaterial(st);
    return start(function (ctx, into, t0, hooks) {
      hooks.onStage = function () { /* the plan list lights as it sounds */ };
      var end = GV.perform(ctx, into.organ, t0, mat, stream(st.seed, GV.LABEL + 1), hooks);
      return { end: end, tick: function (tp) {
        var cur = -1; mat.plan.sections.forEach(function (s, i) { if (tp >= s.t && tp < s.end) cur = i; });
        document.querySelectorAll("#k3b-vplan li").forEach(function (li) { li.classList.toggle("on", +li.getAttribute("data-i") === cur); });
        var c = $("k3b-vcost"); if (c) c.textContent = cost() + " · organ pipes built " + (GV.perform.last && GV.perform.last.organ && GV.perform.last.organ.stats ? GV.perform.last.organ.stats().created : "—");
      } };
    });
  }
  function playChanges(withHome) {
    var st = settings(), mat = ringMaterial(st);
    return start(function (ctx, into, t0, hooks) {
      var home = st.keynote * 5 / 4 * 2, J = jit(3);
      while (home > 700) home /= 2; while (home < 300) home *= 2;
      if (withHome !== false) bellStrike(ctx, t0, 0.6 * 0.55, home, into.bells, true, J);       // the meetinghouse bell's first word
      var lead = withHome !== false ? 4 : 0;
      var end = GC.perform(ctx, into.wide, t0 + lead, mat, stream(st.seed, GC.LABEL + 1), hooks);
      var sc = GC.score(mat, stream(st.seed, GC.LABEL + 1), t0 + lead);
      if (withHome !== false) bellStrike(ctx, sc.lastStrike + 3, 0.6 * 0.55 * 0.9, home, into.bells, true, J);   // …and its last
      return { end: Math.max(end, sc.lastStrike + 10), tick: function (tp) {
        var row = -1; sc.strikes.forEach(function (s) { if (s.t - t0 <= tp) row = s.row; });
        var r = $("k3b-rownow"); if (r) r.textContent = row >= 0 ? "row " + (row + 1) + " of " + mat.rows.length + ": " + mat.rows[row] : "";
        var c = $("k3b-ccost"); if (c) c.textContent = cost();
      } };
    });
  }

  // ==========================================================================
  // CHECK — offline renders (silent), and the house's measures: BS.1770
  // loudness (integrated, and the loudest 3 s — over the whole and over
  // each span asked for), peak, clipped samples, and clicks (1 ms blocks
  // above 4 kHz standing 12× — 21.6 dB — over the loudest block of the
  // 30 ms either side; a burst inside a window a stroke was asked for is a
  // stroke, any other a click)
  // ==========================================================================
  var offlineIR = null;
  function render(dur, build, room) {
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : irFor(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      var off = new OfflineAudioContext(2, Math.ceil((dur + 4) * SR), SR);
      var into = buildChain(off, ir, off.destination, room || settings().room);
      var a = performance.now(), res = build(off, into, 0.1) || {};
      res.buildMs = performance.now() - a;
      var r0 = performance.now();
      return off.startRendering().then(function (buf) { res.renderMs = performance.now() - r0; return { buf: buf, res: res }; });
    });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
  function biquad(x, b, a) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) { var v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
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
  function loudnessOf(k, a, b) {
    a = Math.max(0, a || 0); b = Math.min(k[0].length, b || k[0].length);
    var n = b - a, sq = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) { var e = 0; for (var c = 0; c < k.length; c++) e += k[c][a + i] * k[c][a + i]; sq[i + 1] = sq[i] + e; }
    function L(s, len) { return -0.691 + 10 * Math.log10((sq[s + len] - sq[s]) / len + 1e-20); }
    var B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), S3 = Math.round(3 * SR), blocks = [];
    for (var s = 0; s + B <= n; s += H) blocks.push(L(s, B));
    var abs = blocks.filter(function (l) { return l > -70; });
    function meanL(ls) { var m = 0; ls.forEach(function (l) { m += Math.pow(10, (l + 0.691) / 10); }); return -0.691 + 10 * Math.log10(m / Math.max(1, ls.length) + 1e-20); }
    var gate = meanL(abs) - 10, I = meanL(abs.filter(function (l) { return l > gate; })), sMax = -Infinity;
    for (var s3 = 0; s3 + S3 <= n; s3 += H) { var l3 = L(s3, S3); if (l3 > sMax) sMax = l3; }
    if (!isFinite(sMax)) sMax = L(0, n);
    return { I: abs.length ? +I.toFixed(1) : -Infinity, S: +sMax.toFixed(1) };
  }
  // → { lufs, s3, peakDb, clipped, clicks, strokes, clickTimes, spans: [{…, lufs, s3}] }
  function analyse(buf, res) {
    var L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, pk = 0, clip = 0, mono = new Float32Array(n);
    for (var i = 0; i < n; i++) { mono[i] = (L[i] + R[i]) * 0.5; var a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; if (a > 0.989) clip++; }
    var kw = [kWeight(L), kWeight(R)], lu = loudnessOf(kw);
    var hp = highpass(mono, 4000), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) { var e2 = 0; for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q]; hf.push(Math.sqrt(e2 / H)); }
    var ex = (res.expect || []).map(function (w) { return [w[0] + 0.1 - 0.012, w[1] + 0.1 + 0.012]; });
    ex.sort(function (x, y) { return x[0] - y[0]; });
    function asked(tz) { var lo = 0, hi = ex.length - 1; while (lo <= hi) { var mid = (lo + hi) >> 1; if (ex[mid][1] < tz) lo = mid + 1; else if (ex[mid][0] > tz) hi = mid - 1; else return true; } return false; }
    var strokes = 0, clicks = [];
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = 0;
      for (var y = z - 30; y < z + 30; y++) if ((y < z - 2 || y > z + 2) && hf[y] > ref) ref = hf[y];
      if (hf[z] > ref * 12) { var tz = z * H / SR; if (asked(tz)) strokes++; else clicks.push(+(tz - 0.1).toFixed(3)); }
    }
    var spans = (res.spans || []).map(function (sp) {
      var l = loudnessOf(kw, Math.floor((sp.t0 + 0.1) * SR), Math.floor((sp.t1 + 0.1) * SR));
      var o = {}; for (var kk in sp) o[kk] = sp[kk]; o.lufs = l.I; o.s3 = l.S; return o;
    });
    return { seconds: +(n / SR).toFixed(1), lufs: lu.I, s3: lu.S, peakDb: +db(pk).toFixed(2), clipped: clip, strokes: strokes, clicks: clicks.length, clickTimes: clicks.slice(0, 10),
             spans: spans, buildMs: res.buildMs != null ? +res.buildMs.toFixed(1) : null, renderMs: res.renderMs != null ? Math.round(res.renderMs) : null, nodes: res.nodes || null };
  }

  // the variations, the same organist's chorale prelude on the same hymn,
  // and the engine's organ — each rendered alone, in the same room
  function checkVariations() {
    var st = settings(), mat = varMaterial(st), h = composeHymn(st), org = S.org, out = {};
    var spans = mat.plan.variations.map(function (v) { return { id: v.id, t0: v.t, t1: v.end }; });
    return render(mat.plan.dur, function (ctx, into, t) {
      GV.perform(ctx, into.organ, t, mat, stream(st.seed, GV.LABEL + 1), {});
      var o = GV.perform.last.organ;
      return { spans: spans, get nodes() { return o.stats(); } };
    }).then(function (r) {
      out.variations = analyse(r.buf, r.res); out.variations.nodes = GV.perform.last.organ.stats();
      var pre = O.prelude(org, h, stream(st.seed, "cast:1"));
      return render(pre.dur, function (ctx, into, t) {
        var organ = VO.create(ctx, into.organ, { gain: O.ORGAN_GAIN, seed: st.seed, t0: t });
        O.perform(organ, pre, t, { keynoteHz: st.keynote }).pump(0, 1e9);
        return {};
      });
    }).then(function (r) {
      out.prelude = analyse(r.buf, r.res);
      return render(26, function (ctx, into, t) { organReference(ctx, into, t, st.keynote); return {}; });
    }).then(function (r) {
      out.reference = analyse(r.buf, r.res);
      out.vsPrelude = +(out.variations.s3 - out.prelude.s3).toFixed(1);
      out.vsReference = +(out.variations.s3 - out.reference.s3).toFixed(1);
      out.style = mat.style; out.characters = mat.characters.slice(); out.dur = mat.dur;
      S.lastVarCheck = out;
      return out;
    });
  }
  // the ringing alone (every stroke a stroke, not a click), the steeples as
  // the meeting rings them, and the engine's organ — the same room
  function checkChanges() {
    var st = settings(), mat = ringMaterial(st), out = {};
    var sc = GC.score(mat, stream(st.seed, GC.LABEL + 1), 0);
    return render(mat.dur, function (ctx, into, t) {
      GC.perform(ctx, into.wide, t, mat, stream(st.seed, GC.LABEL + 1), {});
      return { expect: sc.strikes.map(function (s) { return [s.t - 0.03, s.t + 0.04]; }), spans: sc.stages.map(function (x) { return { id: x.stage, t0: x.t0, t1: x.t1 }; }),
               nodes: { standing: GC.perform.last.nodesStanding, strokes: sc.strikes.length } };
    }).then(function (r) {
      out.ringing = analyse(r.buf, r.res);
      return render(66, function (ctx, into, t) { return steeplesReference(ctx, into, t, st.keynote); });
    }).then(function (r) {
      out.steeples = analyse(r.buf, r.res);
      return render(26, function (ctx, into, t) { organReference(ctx, into, t, st.keynote); return {}; });
    }).then(function (r) {
      out.reference = analyse(r.buf, r.res);
      out.vsSteeples = +(out.ringing.s3 - out.steeples.s3).toFixed(1);
      out.vsReference = +(out.ringing.s3 - out.reference.s3).toFixed(1);
      out.method = mat.methodName; out.piece = mat.piece; out.touch = mat.touch; out.muffled = mat.muffled; out.verify = mat.verify;
      S.lastRingCheck = out;
      return out;
    });
  }

  // ==========================================================================
  // THE PLAN, READ — each character's own marks, from the plan alone (pure):
  // its metre, its beat, how many keys a second, where it sits (the mean
  // pitch, cents from the keynote), its stops, its keys; and for each, the
  // share of its sounding moments whose pitches fit no single just major
  // scale (the interlude in two keys should be high; the rest near nought)
  // ==========================================================================
  var MAJ_C = ["1/1", "9/8", "10/9", "5/4", "4/3", "3/2", "5/3", "15/8"].map(function (f) { var p = f.split("/"); return 1200 * Math.log2(+p[0] / +p[1]); });
  function pcOf(c) { return ((c % 1200) + 1200) % 1200; }
  function inMajor(c, tn) { var d = pcOf(c - tn); return MAJ_C.some(function (x) { var e = Math.abs(d - x); return e < 25 || e > 1175; }); }
  function oneKey(cs) {
    for (var i = 0; i < cs.length; i++) for (var j = 0; j < MAJ_C.length; j++) { var tn = cs[i] - MAJ_C[j]; if (cs.every(function (c) { return inMajor(c, tn); })) return true; }
    return false;
  }
  function ratioOf(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function centsOf(m) { return 1200 * Math.log2(ratioOf(m)); }
  function fracOf(m) {
    var n = 1, d = 1;
    [[2, m[0]], [3, m[1]], [5, m[2]], [7, m[3] || 0]].forEach(function (p) { if (p[1] > 0) n *= Math.pow(p[0], p[1]); else d *= Math.pow(p[0], -p[1]); });
    return n + "/" + d;
  }
  function readPlan(plan) {
    return plan.variations.map(function (v) {
      var ns = [];
      plan.phrases.forEach(function (p) { p.notes.forEach(function (n) { var t = p.t + n.at; if (t >= v.t - 1e-6 && t < v.end) ns.push({ t: t, dur: n.dur, c: centsOf(n.m) }); }); });
      var on = 0, bi = 0;
      for (var tt = v.t; tt < v.end; tt += 0.05) {
        var cs = ns.filter(function (x) { return x.t <= tt && x.t + x.dur > tt; }).map(function (x) { return x.c; });
        if (cs.length < 2) continue;
        on++; if (!oneKey(cs)) bi++;
      }
      var mean = ns.reduce(function (a, x) { return a + x.c; }, 0) / Math.max(1, ns.length);
      return { id: v.id, name: v.name, meter: v.meter, beatS: v.beatS, seconds: +(v.end - v.t).toFixed(1), keysPerS: +(ns.length / Math.max(0.1, v.end - v.t)).toFixed(1),
               meanCents: Math.round(mean), regs: v.regs, keys: v.keys.map(function (k, i) { return i ? fracOf(k.map(function (x, j) { return x - v.keys[0][j]; })) + " from the hymn's key" : "the hymn's key"; }),
               minor: !!v.minor, twoKeys: on ? +(bi / on).toFixed(2) : 0, lines: v.lines.length, lag: v.lag || null, interval: v.interval || null };
    });
  }

  // ==========================================================================
  // PURITY — every plan, set and ringing made twice on the same stream must
  // be the same, and none may call Math.random
  // ==========================================================================
  function purity() {
    var st = settings(), orig = Math.random, calls = 0, out = {};
    Math.random = function () { calls++; return orig(); };
    try {
      var info = { n: 1, kind: "conference", sunday: "conference", sections: ["prelude", "invocation", "hymn", "doxology", "postlude"].map(function (t) { return { type: t }; }),
                   guests: [{ type: "steeples", section: "prelude" }], hymns: [{ id: "h:1:1", section: "hymn", dialect: "tabernacle" }, { id: "h:1:3", section: "doxology", dialect: "gospel" }],
                   organist: { style: "improviser" }, force: true };
      function twice(f) { return JSON.stringify(f()) === JSON.stringify(f()); }
      out.variationsSet = twice(function () { return varMaterial(st).plan; });
      out.variationsSeat = twice(function () { return GV.decide(info, stream(st.seed, GV.LABEL + 1)); });
      out.ringing = twice(function () { return GC.score(ringMaterial(st), stream(st.seed, GC.LABEL + 1), 0); });
      out.ringingSeat = twice(function () { return GC.decide(info, stream(st.seed, GC.LABEL + 1)); });
      [["minor", "course"], ["doubles", "touch"], ["covered", "hunt"]].forEach(function (x) {
        var m = GC.prepare({ keynoteHz: 262, stage: x[0], piece: x[1] }, stream(st.seed, GC.LABEL + 1));
        out[x.join(" ")] = m.verify.ok ? "true, round, the treble hunting (" + m.touch.changes + " changes)" : m.verify.errors.join("; ");
      });
    } finally { Math.random = orig; }
    out.mathRandomCalls = calls;
    return out;
  }

  // ==========================================================================
  // THE ODDS — each guest's plan() over n meetings of a stand-in for the
  // engine's planner: the calendar's Sundays at their shares, the organist
  // by the style weights and the Sunday's lean, the house and each hymn's
  // dialect, the withheld tune (8 %), and the other guests' own dice and
  // seats as kolob-meeting.js throws them (bands 36 %, steeples 7.5 % and old
  // tune 15 %, each × the Sunday's welcome; the trombones', the singing
  // school's and the handbells' approximated at 10, 10 and 12 %)
  // ==========================================================================
  var HOUSE = [["tabernacle", 0.36], ["sacredharp", 0.14], ["psalmody", 0.1], ["gospel", 0.12], ["oldway", 0.14], ["shaker", 0.14]];
  function odds(n) {
    n = n || 20000;
    var CAL = K.Calendar, R = window.PJ2.Rand.stream(90210);
    var suns = CAL.ORDER.map(function (k) { return [k, CAL.SUNDAYS[k].share]; });
    var T = { meetings: n, variations: 0, seats: { prelude: 0, postlude: 0 }, bySunday: {}, meetingsBySunday: {}, byStyle: {}, styles: {}, why: {}, steeples: 0, changes: 0, changesBySunday: {}, steeplesBySunday: {} };
    for (var i = 0; i < n; i++) {
      var sun = R.pickW(suns), SU = CAL.SUNDAYS[sun], kind = SU.kind, GW = SU.guests || {};
      T.meetingsBySunday[sun] = (T.meetingsBySunday[sun] || 0) + 1;
      var types = ["prelude", "invocation", "hymn", "testimony", "sacrament"].concat(R.chance(0.7) ? ["hymn"] : []).concat(["doxology", "postlude"]);
      var sections = types.map(function (t) { return { type: t }; }), guests = [];
      function taken(s) { return guests.some(function (g) { return g.section === s; }); }
      if (R.chance(Math.min(0.9, 0.36 * (GW.bands != null ? GW.bands : 1)))) guests.push({ type: "bands", section: R.chance(0.7) ? "doxology" : "hymn" });
      var steep = R.chance(Math.min(0.9, 0.075 * (GW.steeples != null ? GW.steeples : 1))), stPre = R.chance(0.55);
      if (steep) guests.push({ type: "steeples", section: stPre ? "prelude" : "postlude" });
      if (R.chance(Math.min(0.9, 0.15 * (GW.oldtune != null ? GW.oldtune : 1)) * 0.8)) guests.push({ type: "oldtune", section: R.chance(0.65) && !taken("prelude") ? "prelude" : "testimony" });
      var tbD = R.chance(0.1), ssD = R.chance(0.1), hbD = R.chance(0.12), hbS = R.pickW([["invocation", 1], ["sacrament", 0.9], ["postlude", 1.1]]);
      if (tbD && !taken("prelude")) guests.push({ type: "trombones", section: "prelude" });
      if (ssD && sun !== "funeral" && !taken("prelude")) guests.push({ type: "singingschool", section: "prelude" });
      if (hbD && !steep && !taken(hbS)) guests.push({ type: "handbells", section: hbS });
      var house = R.pickW(HOUSE), hymns = [];
      types.forEach(function (t, k) {
        if (t !== "hymn" && t !== "doxology") return;
        var d = t === "doxology" && R.chance(0.5) ? "tabernacle" : R.chance(0.6) ? house : R.pickW(HOUSE);
        hymns.push({ id: "h:1:" + (hymns.length + 1), section: t, dialect: d, piece: "compose" });
      });
      var lean = SU.organist || {}, sw = [["plain", 0.36 * (lean.plain || 1)], ["victorian", 0.38 * (lean.victorian || 1)], ["improviser", 0.26 * (lean.improviser || 1)]];
      var style = R.pickW(sw), withheld = R.chance(0.08);
      T.styles[style] = (T.styles[style] || 0) + 1;
      var d1 = GV.decide({ n: 1, kind: kind, sunday: sun, sections: sections, guests: guests, hymns: hymns, organist: { style: style }, withheld: withheld }, R.fork("variations:" + i));
      if (d1.seat) { T.variations++; T.seats[d1.seat.seat]++; T.bySunday[sun] = (T.bySunday[sun] || 0) + 1; T.byStyle[style] = (T.byStyle[style] || 0) + 1; }
      else T.why[d1.why.replace(/ \(.*$/, "")] = (T.why[d1.why.replace(/ \(.*$/, "")] || 0) + 1;
      if (steep) {
        T.steeples++; T.steeplesBySunday[sun] = (T.steeplesBySunday[sun] || 0) + 1;
        var d2 = GC.decide({ kind: kind, sunday: sun, sections: sections, guests: guests }, R.fork("changes:" + i));
        if (d2.seat) { T.changes++; T.changesBySunday[sun] = (T.changesBySunday[sun] || 0) + 1; }
      }
    }
    return T;
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function opt(sel, pairs, v) { pairs.forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; if (p[0] === v) o.selected = true; sel.appendChild(o); }); return sel; }
  function labelled(txt, node) { var l = el("label", null, txt + " "); l.appendChild(node); return l; }
  function button(txt, cls, fn) { var b = el("button", cls, txt); b.type = "button"; b.addEventListener("click", fn); return b; }
  function table(head, rows) {
    var w = el("div", "k3b-scroll"), t = el("table", "k3b-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); }); t.appendChild(tr);
    rows.forEach(function (r) { var x = el("tr"); r.forEach(function (c) { x.appendChild(el("td", null, c == null ? "—" : String(c))); }); t.appendChild(x); });
    w.appendChild(t); return w;
  }
  function busy(btn, p) { btn.disabled = true; return p.then(function (x) { btn.disabled = false; return x; }, function (e) { btn.disabled = false; throw e; }); }
  var Q = new URLSearchParams(location.search);
  function build() {
    var cards = $("k3b-cards");
    // ---- the variations ----
    var cv = el("section", "k3b-card");
    cv.appendChild(el("h2", "k3b-name", "Variations on a hymn"));
    cv.appendChild(el("p", "k3b-phrase", "The Sunday's organist takes the hymn through three to five characters — the style chooses them, and plays them its own way. The plain organist gives a short set, straight-faced; the Victorian a long one, on the vox humana and the trumpet, to the full organ and the amen; the improviser always plays the tune in two keys at once."));
    var r1 = el("div", "k3b-row");
    r1.appendChild(labelled("organist", opt(el("select"), [["", "as seated (the seed's)"], ["plain", "the plain organist"], ["victorian", "the Victorian"], ["improviser", "the improviser"]], Q.get("style") || "")));
    r1.lastChild.querySelector("select").id = "k3b-style";
    r1.appendChild(labelled("characters", opt(el("select"), [["auto", "as the organist draws them"], ["all", "all eight (a demonstration)"], ["trio", "the theme, then the trio"], ["canon", "the theme, then the canon"],
      ["minuet", "the theme, then the minuet"], ["bitonal", "the theme, then two keys at once"], ["polonaise", "the theme, then the polonaise"], ["march", "the theme, then the march"], ["finale", "the theme, then the finale"]], Q.get("chars") || "auto")));
    r1.lastChild.querySelector("select").id = "k3b-chars";
    cv.appendChild(r1);
    var r2 = el("div", "k3b-row");
    r2.appendChild(button("▶ play the variations", "k3b-play", function () { playVariations(); }));
    var bc = button("check", "k3b-check", function () { busy(bc, checkVariations()).then(showVarCheck); });
    r2.appendChild(bc);
    r2.appendChild(button("read the plan", null, function () { showVarPlan(true); }));
    r2.appendChild(button("purity", null, function () { var p = purity(), box = $("k3b-vres"); box.innerHTML = ""; box.appendChild(table(["check", "result"], Object.keys(p).map(function (k) { return [k, p[k]]; }))); }));
    cv.appendChild(r2);
    cv.appendChild(el("ol", "k3b-plan")).id = "k3b-vplan";
    cv.appendChild(el("p", "k3b-stat")).id = "k3b-vcost";
    cv.appendChild(el("div")).id = "k3b-vres";
    cards.appendChild(cv);
    // ---- the change ringing ----
    var cc = el("section", "k3b-card");
    cc.appendChild(el("h2", "k3b-name", "Change ringing from a far tower"));
    cc.appendChild(el("p", "k3b-phrase", "The meetinghouse bell rings, and across the valley a band rings rounds, then Plain Hunt or Plain Bob — the bells changing places a pair at a time, every row a new order — until they come round; rounds, and stand. Tower bells: the hum, the minor-third tierce, the nominal. At a funeral, half-muffled."));
    var r3 = el("div", "k3b-row");
    r3.appendChild(labelled("bells", opt(el("select"), [["", "as the band draws"], ["minor", "six: Minor"], ["doubles", "five: Doubles"], ["covered", "six: Doubles, the tenor covering"]], Q.get("stage") || "")));
    r3.lastChild.querySelector("select").id = "k3b-stage";
    r3.appendChild(labelled("ring", opt(el("select"), [["", "as the band draws"], ["hunt", "Plain Hunt"], ["course", "a plain course of Plain Bob"], ["touch", "a touch of Plain Bob (bobs)"]], Q.get("piece") || "")));
    r3.lastChild.querySelector("select").id = "k3b-piece";
    r3.appendChild(labelled("muffled", opt(el("select"), [["auto", "as the Sunday (a funeral)"], ["on", "half-muffled"], ["off", "open"]], Q.get("muffle") || "auto")));
    r3.lastChild.querySelector("select").id = "k3b-muffle";
    r3.appendChild(labelled("blue line", opt(el("select"), [["2", "the 2"], ["3", "the 3"], ["4", "the 4"], ["5", "the 5"], ["6", "the 6"]], Q.get("blue") || "2")));
    r3.lastChild.querySelector("select").id = "k3b-blue";
    cc.appendChild(r3);
    var r4 = el("div", "k3b-row");
    r4.appendChild(button("▶ ring (the meetinghouse bell first and last)", "k3b-play", function () { playChanges(true); }));
    r4.appendChild(button("▶ the tower alone", null, function () { playChanges(false); }));
    var bk = button("check", "k3b-check", function () { busy(bk, checkChanges()).then(showRingCheck); });
    r4.appendChild(bk);
    cc.appendChild(r4);
    cc.appendChild(el("p", "k3b-stat")).id = "k3b-method";
    cc.appendChild(el("p", "k3b-stat")).id = "k3b-rownow";
    cc.appendChild(el("div", "k3b-leads")).id = "k3b-leads";
    cc.appendChild(el("p", "k3b-stat")).id = "k3b-ccost";
    cc.appendChild(el("div")).id = "k3b-cres";
    cards.appendChild(cc);
    ["k3b-stage", "k3b-piece", "k3b-muffle", "k3b-blue"].forEach(function (id) { $(id).addEventListener("change", showRows); });
    ["k3b-style", "k3b-chars"].forEach(function (id) { $(id).addEventListener("change", function () { showVarPlan(false); }); });
    // ---- the odds ----
    var co = el("section", "k3b-card");
    co.appendChild(el("h2", "k3b-name", "The odds"));
    co.appendChild(el("p", "k3b-phrase", "Each guest's own plan() over 20,000 meetings of a stand-in for the engine's planner."));
    var bo = button("run the odds", "k3b-check", function () { bo.disabled = true; setTimeout(function () { showOdds(odds(20000)); bo.disabled = false; }, 30); });
    co.appendChild(bo);
    co.appendChild(el("div")).id = "k3b-ores";
    cards.appendChild(co);
  }
  function showHymn() {
    var st = settings(), h = composeHymn(st), p = $("k3b-hymn");
    p.innerHTML = "";
    p.appendChild(document.createTextNode("The hymn: "));
    p.appendChild(el("b", null, h.nameEn || h.nameDs));
    p.appendChild(document.createTextNode(" — " + h.dialect + ", " + h.mode + ", " + h.meter + ", " + h.modeOfTime + ", " + h.lines.length + " lines" + (h.refrain ? " and a refrain" : "") + (GV.harmonized(h) ? "" : " (in unison: the organist cannot vary it)")));
  }
  function showVarPlan(withRead) {
    var st = settings(), mat;
    try { mat = varMaterial(st); } catch (e) { $("k3b-vplan").innerHTML = ""; $("k3b-vcost").textContent = e.message; return; }
    var ol = $("k3b-vplan"); ol.innerHTML = "";
    mat.plan.sections.forEach(function (s, i) { var li = el("li", null, mmss(s.t) + "–" + mmss(s.end) + "  " + s.what); li.setAttribute("data-i", i); ol.appendChild(li); });
    $("k3b-vcost").textContent = mat.organist.nameEn + " (" + mat.style + ") · " + mat.characters.length + " characters · " + f1(mat.dur) + " s · " + mat.plan.counts.keys + " keys";
    if (!withRead) return;
    var box = $("k3b-vres"); box.innerHTML = "";
    box.appendChild(el("p", "k3b-stat", "Each character's own marks, read from the plan (twoKeys: the share of its sounding moments whose pitches fit no single just major scale)."));
    box.appendChild(table(["character", "metre", "beat s", "s", "keys/s", "mean c", "stops", "keys", "twoKeys"], readPlan(mat.plan).map(function (r) {
      return [r.name + (r.minor ? " (minor)" : "") + (r.interval ? " (" + r.interval + ", " + r.lag + " beats)" : ""), r.meter, r.beatS, r.seconds, r.keysPerS, r.meanCents, r.regs.join("; "), r.keys.join(" + "), r.twoKeys];
    })));
  }
  function showVarCheck(o) {
    var box = $("k3b-vres"); box.innerHTML = "";
    box.appendChild(el("p", "k3b-stat", "The set " + f1(o.dur) + " s (" + o.style + ": " + o.characters.join(", ") + "): the loudest 3 s " + o.vsPrelude + " LU against the organist's own chorale prelude on this hymn, " + o.vsReference + " LU against the engine's organ; " + o.variations.clicks + " clicks, " + o.variations.clipped + " clipped samples; organ pipes built " + (o.variations.nodes ? o.variations.nodes.created + ", at most " + o.variations.nodes.peakLive + " at once" : "—") + "; rendered in " + o.variations.renderMs + " ms."));
    box.appendChild(table(["what", "LUFS", "loudest 3 s", "peak dB", "clicks"], [
      ["the variations", o.variations.lufs, o.variations.s3, o.variations.peakDb, o.variations.clicks],
      ["the organist's chorale prelude (same hymn)", o.prelude.lufs, o.prelude.s3, o.prelude.peakDb, o.prelude.clicks],
      ["the engine's organ (organChord, prelude)", o.reference.lufs, o.reference.s3, o.reference.peakDb, o.reference.clicks]]));
    box.appendChild(table(["character", "LUFS", "loudest 3 s", "against the prelude"], o.variations.spans.map(function (s) { return [s.id, s.lufs, s.s3, +(s.s3 - o.prelude.s3).toFixed(1)]; })));
  }
  // THE RINGERS' ROWS: a lead to a column; the treble's path red, one working
  // bell's blue (the ringers' own "blue line")
  function showRows() {
    var st = settings(), m = ringMaterial(st), box = $("k3b-leads"), W = m.working, N = m.bells.length;
    box.innerHTML = "";
    $("k3b-method").textContent = m.methodName + " — " + (m.piece === "hunt" ? "plain hunt" : m.piece === "course" ? "a plain course" : "a touch: " + m.touch.calls.replace(/-/g, "–").replace(/b/g, "B") + " (" + m.touch.bobs + " bobs)") +
      ", " + m.touch.changes + " changes; " + (m.muffled ? "half-muffled; " : "") + f1(m.dur) + " s. The ring: " + m.bells.map(function (b) { return b.bell + " " + b.solfa + " " + Math.round(b.f) + " Hz"; }).join(", ") +
      ". Verified: " + (m.verify.ok ? "every row a permutation, every bell moving a place at most, true, coming round, the treble hunting." : m.verify.errors.join("; "));
    var rows = m.methodRows, per = 2 * W, blue = String(Math.min(N, Math.max(2, st.blue)));
    for (var L0 = 0; L0 < rows.length - 1; L0 += per) {
      var chunk = rows.slice(L0, Math.min(rows.length, L0 + per + 1)), col = el("div", "k3b-lead"), lines = { 1: [], b: [] };
      chunk.forEach(function (r, i) {
        var d = el("div", i === chunk.length - 1 && chunk.length > per ? "le" : null);
        r.split("").forEach(function (c, p) { var s = el("span", null, c); s.style.display = "inline-block"; s.style.width = "1.25em"; s.style.textAlign = "center"; s.style.letterSpacing = "0"; d.appendChild(s); if (c === "1") lines[1].push([p, i]); if (c === blue) lines.b.push([p, i]); });
        col.appendChild(d);
      });
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 " + (N * 10) + " " + (chunk.length * 10)); svg.setAttribute("preserveAspectRatio", "none");
      svg.style.width = "100%"; svg.style.height = "100%";
      [["1", "#9a4a2a"], ["b", "#2b5c9a"]].forEach(function (q) {
        var pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        pl.setAttribute("points", lines[q[0]].map(function (x) { return (x[0] * 10 + 5) + "," + (x[1] * 10 + 5); }).join(" "));
        pl.setAttribute("fill", "none"); pl.setAttribute("stroke", q[1]); pl.setAttribute("stroke-width", "1.6"); pl.setAttribute("vector-effect", "non-scaling-stroke"); pl.setAttribute("opacity", "0.75");
        svg.appendChild(pl);
      });
      col.appendChild(svg);
      box.appendChild(col);
    }
  }
  function showRingCheck(o) {
    var box = $("k3b-cres"); box.innerHTML = "";
    box.appendChild(el("p", "k3b-stat", o.method + " (" + o.piece + (o.muffled ? ", half-muffled" : "") + "): the loudest 3 s " + o.vsSteeples + " LU against the steeples as the meeting rings them, " + o.vsReference + " LU against the engine's organ; " +
      o.ringing.strokes + " strokes heard as strokes, " + o.ringing.clicks + " clicks, " + o.ringing.clipped + " clipped samples; " + o.ringing.nodes.standing + " standing nodes for " + o.ringing.nodes.strokes + " strokes; rendered in " + o.ringing.renderMs + " ms."));
    box.appendChild(table(["what", "LUFS", "loudest 3 s", "peak dB", "clicks"], [
      ["the far tower", o.ringing.lufs, o.ringing.s3, o.ringing.peakDb, o.ringing.clicks],
      ["the steeples (the meeting's, a minute)", o.steeples.lufs, o.steeples.s3, o.steeples.peakDb, o.steeples.clicks],
      ["the engine's organ (organChord, prelude)", o.reference.lufs, o.reference.s3, o.reference.peakDb, o.reference.clicks]]));
  }
  function pct(a, b) { return b ? (100 * a / b).toFixed(1) + " %" : "—"; }
  function showOdds(T) {
    var box = $("k3b-ores"); box.innerHTML = "";
    box.appendChild(el("p", "k3b-stat", "The variations seated in " + pct(T.variations, T.meetings) + " of " + T.meetings + " meetings (the prelude " + pct(T.seats.prelude, T.variations) + ", the postlude " + pct(T.seats.postlude, T.variations) +
      "). Change ringing: " + pct(T.changes, T.steeples) + " of the " + T.steeples + " meetings the steeples ring, " + pct(T.changes, T.meetings) + " of all."));
    box.appendChild(table(["Sunday", "meetings", "variations", "steeples", "changes"], Object.keys(T.meetingsBySunday).map(function (s) {
      return [s, T.meetingsBySunday[s], pct(T.bySunday[s] || 0, T.meetingsBySunday[s]), T.steeplesBySunday[s] || 0, pct(T.changesBySunday[s] || 0, T.steeplesBySunday[s] || 0)];
    })));
    box.appendChild(table(["organist", "meetings", "variations"], Object.keys(T.styles).map(function (s) { return [s, T.styles[s], pct(T.byStyle[s] || 0, T.styles[s])]; })));
    box.appendChild(table(["not seated because", "meetings"], Object.keys(T.why).map(function (w) { return [w, T.why[w]]; })));
    S.lastOdds = T;
  }
  function compose() { stop(); S.hymn = null; showHymn(); showVarPlan(false); showRows(); }
  function init() {
    ["seed", "dialect", "key", "room"].forEach(function (k) { if (Q.get(k) != null && $("k3b-" + k)) $("k3b-" + k).value = Q.get(k); });
    build();
    $("k3b-compose").addEventListener("click", function () { $("k3b-seed").value = Math.round(num("k3b-seed", 4)) + 1; compose(); });
    $("k3b-stop").addEventListener("click", stop);
    ["k3b-seed", "k3b-dialect"].forEach(function (id) { $(id).addEventListener("change", compose); });
    $("k3b-key").addEventListener("change", function () { showRows(); });
    compose();
  }
  init();
  return {
    compose: compose, playVariations: playVariations, playChanges: playChanges, stop: stop, checkVariations: checkVariations, checkChanges: checkChanges,
    readPlan: function () { return readPlan(varMaterial(settings()).plan); }, odds: odds, purity: purity, cost: cost, state: S, settings: settings,
  };
})();
