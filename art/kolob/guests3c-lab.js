// ============================================================================
// GUESTS LAB, ROUND 3C — audition bench for the gift of tongues, the far
// ward and the Hosanna (dev, unlinked).
//
// The seed seats the Sunday's ward (KOLOB.Cast, cast:1) and composes the
// hymn (KOLOB.Composer, hymn:1:1) in the dialect on the controls. THE GIFT
// is sung by one of that ward's testimony-bearers and hummed by the rest.
// THE FAR WARD sings that hymn a line late, across the colony, against the
// ward singing it here — the Cast's own performer, cue sheet and organ, as
// the meeting has them — so the canon can be heard as the meeting will
// make it. THE HOSANNA shouts and then sings ASSEMBLY with the full organ,
// and the lab shows what it told (nothing: every stage logged:false).
//
// Everything plays through the app's own master chain (glue → master 0.6 →
// tanh → compressor, as kolob-core.js builds it) plus a brick-wall guard at
// −1 dBFS, in the app's rooms (guests-lab's chain, line for line). CHECK
// renders offline and measures loudness against the v0.30 organ reference,
// peak, clipping and clicks; the far ward's lag, tuning and distance; the
// Hosanna's shout and hymn apart.
//
// Dev console: Guests3c.play(id, o), .check(id, o), .odds(N), .purity(),
// .hymn(), .ward(), .score(id), .stop(). Public surface: window.Guests3c
// ============================================================================
window.Guests3c = (function () {
  "use strict";

  var SR = 48000;
  var K = window.KOLOB, TG = K.GuestTongues, FW = K.GuestFarWard, HO = K.GuestHosanna, Cast = K.Cast, V = K.VoicesVocal;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = $(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = $(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function R(seed) { return window.PJ2.Rand.stream(seed >>> 0); }
  function settings(o) {
    o = o || {};
    return {
      seed: o.seed != null ? o.seed : Math.round(num("kg3-seed", 7)),
      sunday: o.sunday || val("kg3-sunday", "fast"),
      dialect: o.dialect || val("kg3-dialect", "tabernacle"),
      mode: o.mode != null ? o.mode : val("kg3-mode", ""),
      keynote: Math.max(200, Math.min(320, o.keynote != null ? o.keynote : num("kg3-key", 260))),
    };
  }
  var KIND = { ordinary: "ordinary", wedding: "ordinary", funeral: "ordinary", fast: "fast", conference: "conference", dedication: "conference", pioneer: "jubilee", christmas: "jubilee", easter: "jubilee" };

  // ==========================================================================
  // THE WARD AND THE HYMN — seated and composed here, from the controls
  // ==========================================================================
  var cache = {};
  function wardOf(st) {
    var k = "w:" + st.seed;
    return cache[k] || (cache[k] = Cast.seat(R(st.seed).fork("cast:1"), {}));
  }
  function hymnOf(st) {
    var k = "h:" + st.seed + ":" + st.dialect + ":" + st.mode;
    if (cache[k]) return cache[k];
    var opts = { dialect: st.dialect, id: "h:1:1" };
    if (st.mode) opts.mode = st.mode;
    return (cache[k] = K.Composer.compose(R(st.seed).fork("hymn:1:1"), opts));
  }
  function stream(id, seed) { return R(seed).fork({ tongues: TG, farward: FW, hosanna: HO }[id].LABEL + 1); }

  // ==========================================================================
  // THE CHAIN — guests-lab's (kolob-core.js init()'s): rooms → voicesBus →
  // glue → master 0.6 → tanh(1.15) → compressor(−18/3:1) → a brick-wall guard
  // THE ROOMS: the tabernacle (St Margaret's, wet 0.40), the meetinghouse
  // (short, wet 0.28), dry — or, the default, AS SEATED: both rooms, the way
  // kolob-core.js seats every layer, at the section's balance plus the
  // layer's depth. The gift and the Hosanna where the choir sits (the
  // testimony's balance, the doxology's); the ward in the hymn; the far ward
  // through the tabernacle's wide send (a guest outside the windows: all wide)
  // ==========================================================================
  var ROOM_BALANCE = { testimony: 0.5, hymn: 0.5, doxology: 0.62 };
  var CHOIR_DEPTH = 0.05, ORGAN_DEPTH = 0.10;
  function fetchIR(ctx) {
    var url = "../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("ir " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .catch(function () { return null; });
  }
  var TAPS = [[0.008, 0.9], [0.013, 0.7], [0.019, 0.62], [0.026, 0.5], [0.033, 0.42], [0.041, 0.34], [0.052, 0.27], [0.064, 0.2]];
  function pour(ctx, decayS, bright) {
    var len = Math.floor(ctx.sampleRate * decayS), buf = ctx.createBuffer(2, len, ctx.sampleRate), s = 12345;
    function r() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, a = Math.min(0.95, 0.35 * bright);
      for (var i = 0; i < len; i++) {
        var tt = i / ctx.sampleRate, env = Math.pow(1 - i / len, 2.2) * Math.min(1, tt / 0.06);
        lp += a * (r() - lp); d[i] = lp * env * 0.5;
      }
      TAPS.forEach(function (tp, k) { var ix = Math.floor((tp[0] + (ch ? 0.0013 * (k % 3) : 0)) * ctx.sampleRate); if (ix < len) d[ix] += tp[1] * 0.5 * (k % 2 ? -1 : 1); });
    }
    return buf;
  }
  function buildChain(ctx, room, irBuf, dest, balance) {
    var t = 0, session = ctx.createGain(), voicesBus = ctx.createGain();
    function roomUnit(src, which) {
      var dry = ctx.createGain(); dry.gain.value = 1;
      src.connect(dry); dry.connect(voicesBus);
      if (which === "dry") return;
      var spec = which === "close" ? { pre: 0.012, wet: 0.28 } : { pre: 0.063, wet: 0.40 };
      var pre = ctx.createDelay(0.25); pre.delayTime.value = spec.pre;
      var conv = ctx.createConvolver();
      conv.buffer = which === "close" ? pour(ctx, 1.4, 1.2) : (irBuf || pour(ctx, 5.5, 0.8));
      var wet = ctx.createGain(); wet.gain.value = spec.wet;
      src.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(voicesBus);
    }
    if (room === "seated") {
      var th = Math.max(0, Math.min(1, balance != null ? balance : 0.5)) * Math.PI / 2;
      var gc = ctx.createGain(), gw = ctx.createGain();
      gc.gain.value = Math.cos(th); gw.gain.value = Math.sin(th);
      session.connect(gc); session.connect(gw);
      roomUnit(gc, "close"); roomUnit(gw, "wide");
    } else roomUnit(session, room);
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
    // the tabernacle's wide send for a guest outside the windows (the far ward)
    var wideIn = ctx.createGain(); roomUnit(wideIn, room === "dry" ? "dry" : "wide");
    return { input: session, wide: wideIn, out: fade, room: room, balance: balance };
  }
  function balanceFor(id) {
    var cl = function (x) { return Math.max(0, Math.min(1, x)); };
    if (id === "tongues") return cl(ROOM_BALANCE.testimony + CHOIR_DEPTH);
    if (id === "hosanna" || id === "shout") return cl(ROOM_BALANCE.doxology + CHOIR_DEPTH);
    if (id === "reference") return cl(ROOM_BALANCE.testimony + ORGAN_DEPTH);
    return cl(ROOM_BALANCE.hymn + CHOIR_DEPTH);
  }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o) → { dur, score?, stats?, expect }
  //   into: { input (the section's rooms), wide (the tabernacle's send) }
  //   expect: the times (s, from t) at which a transient is asked for
  // ==========================================================================
  var P = {};
  function budgetStats(t, end) {
    var b = V.budget ? V.budget.report(t, end) : null;
    return b ? { peakLive: b.peak, meanLive: Math.round(b.mean) } : null;
  }
  function sungExpect(lines, t) {
    var ex = [];
    lines.forEach(function (x) { if (!x.slur) ex.push([x.t - t - 0.16, x.t - t + 0.08]); });
    return ex;
  }
  // THE GIFT: one of the ward's testimony-bearers sings; the ward hums; the reed
  P.tongues = function (ctx, into, t, o) {
    var st = settings(o), ward = wardOf(st), s = stream("tongues", st.seed);
    var info = { n: 1, kind: KIND[st.sunday], sunday: st.sunday, house: st.dialect, sections: [{ type: "testimony" }], guests: [], ward: ward, force: true };
    var seat = TG.plan(info, s), h = hymnOf(st);
    var mat = { mode: h.mode, keynoteHz: st.keynote, house: st.dialect, ward: ward, singer: seat ? seat.singer : null, harmonium: o.noReed ? false : undefined };
    if (V.budget) V.budget.reset();
    var end = TG.perform(ctx, into.input, t, mat, s, { defer: o.defer || null, onNote: o.onNote || null, onStage: o.onStage || null, only: o.only || null });
    var sc = TG.perform.last.score;
    var hum0 = sc.stages[3].t - t, reed0 = sc.reed.notes.length ? sc.reed.notes[0].t - t : null;
    var windows = [{ name: "the song", a: 0.3, b: hum0 }, { name: "the ward's hum", a: hum0, b: reed0 != null && !o.noReed ? reed0 + 3 : end - t }];
    if (reed0 != null && !o.noReed) windows.push({ name: "the harmonium (with the hum's tail)", a: reed0, b: end - t });
    return { dur: end - t + 1.5, score: sc, seat: seat, expect: sungExpect(sc.notes, t), stats: budgetStats(t, end), windows: windows };
  };
  // OUR WARD SINGS THE HYMN — the Cast's plan and cue sheet, as the meeting
  // writes them (the organ's lines on the pipe organ where the dialect has
  // one); the sheet's verses are the far ward's cue
  var WARD_LAB = 0.16, ORGAN_LAB = 0.9;               // (the engine's WARD_LEVEL; the organ as cast-lab has it)
  function wardSheet(st) {
    var k = "s:" + st.seed + ":" + st.dialect + ":" + st.mode + ":" + st.keynote;
    if (cache[k]) return cache[k];
    var ward = wardOf(st), h = hymnOf(st), organ = !!(K.Dialects && K.Dialects.get(h.dialect) && K.Dialects.get(h.dialect).organ);
    var plan = Cast.planHymn(ward, h, R(st.seed).fork("hymn:1:1").fork("performance"), { organ: organ, first: false });
    var sheet = Cast.score(ward, h, plan, { stream: R(st.seed).fork("hymn:1:1").fork("performance"), keynoteHz: st.keynote });
    var verses = [];
    sheet.lines.forEach(function (ln) { if (ln.verse >= 0 && !ln.amen && !ln.tag && (!verses[ln.verse] || ln.at < verses[ln.verse].at)) verses[ln.verse] = { at: ln.at, beatS: ln.beatS }; });
    var amen = sheet.lines.filter(function (ln) { return ln.amen; })[0] || null;
    return (cache[k] = { ward: ward, hymn: h, plan: plan, sheet: sheet, organ: organ, verses: verses.filter(Boolean), amenAt: amen ? amen.at : null });
  }
  function freshSheet(sh) { var o = {}; for (var k in sh) o[k] = sh[k]; o._ci = 0; o._oi = 0; return o; }
  P.near = function (ctx, into, t, o) {
    var st = settings(o), ws = wardSheet(st), bus = ctx.createGain();
    bus.gain.value = WARD_LAB; bus.connect(into.input);
    var ob = ctx.createGain(); ob.gain.value = ORGAN_LAB; ob.connect(into.input);
    var org = ws.organ && K.VoicesOrgan ? K.VoicesOrgan.create(ctx, ob, { gain: 1, seed: st.seed, t0: t }) : null;
    var perf = Cast.performer(ws.ward, { V: V, synth: R(st.seed).fork("synth:vocal"), organ: org ? function (at, oc) { org.play(at, oc.notes, oc.registration); } : null });
    if (V.budget && !o.keepBudget) V.budget.reset();
    var sheet = freshSheet(ws.sheet), buses = { hall: bus, near: bus };
    // live, the engine's own way: a pump every 0.12 s of the clock, at most
    // twelve lines a call, each joined 0.6 s before it sounds (the ward's
    // desk, kolob-voices-choir.js); offline, every line at once
    if (o.defer) (function tick(at) {
      o.defer(at, function () {
        perf.pump(ctx, buses, t, sheet, at + 3.0, { max: 12, urgent: at + 1.2, arm: at + 0.6, now: at });
        if (at < t + ws.sheet.end + 2) tick(at + 0.12);
      });
    })(t);
    else perf.schedule(ctx, buses, t, sheet);
    return { dur: ws.sheet.end + 3, expect: [], stats: budgetStats(t, t + ws.sheet.end), ws: ws };
  };
  function farMaterial(st, t, o) {
    var ws = wardSheet(st), h = ws.hymn;
    return { hymn: h, keynoteHz: st.keynote, voices: o.voices || null, verses: ws.verses.length, beatS: ws.verses[0] ? ws.verses[0].beatS : h.beatS,
             timing: ws.verses.map(function (v) { return { at: t + v.at, beatS: v.beatS }; }), amen: ws.amenAt != null, amenAt: ws.amenAt != null ? t + ws.amenAt : null,
             from: o.from || null };
  }
  P.far = function (ctx, into, t, o) {
    var st = settings(o), s = stream("farward", st.seed), mat = farMaterial(st, t, o);
    if (o.far) mat.far = o.far;
    if (o.nearby) mat.nearby = true;
    if (V.budget && !o.keepBudget) V.budget.reset();
    var end = FW.perform(ctx, into.wide, t, mat, s, { defer: o.defer || null, onNote: o.onNote || null, onStage: o.onStage || null });
    return { dur: end - t + 1, expect: [], stats: budgetStats(t, end), last: FW.perform.last, ws: wardSheet(st) };
  };
  // (how long each runs, without building it: the sheet's end, the far ward's lag and tail)
  P.near.est = function (o) { return wardSheet(settings(o)).sheet.end + 3; };
  P.far.est = function (o) { var ws = wardSheet(settings(o)); return ws.sheet.end + ws.hymn.beatS * 20 + 9; };
  P.canon = function (ctx, into, t, o) {
    var a = P.near(ctx, into, t, o), b = P.far(ctx, into, t, Object.assign({}, o, { keepBudget: true }));
    return { dur: Math.max(a.dur, b.dur), expect: [], stats: budgetStats(t, t + Math.max(a.dur, b.dur)), last: b.last, ws: a.ws };
  };
  P.canon.est = P.far.est;
  // THE HOSANNA: the shout, then ASSEMBLY with the full organ (o.shoutOnly:
  // the shout and its amens alone). Everything it tells is kept (told) to
  // show it is all logged: false
  P.hosanna = function (ctx, into, t, o) {
    var st = settings(o), s = stream("hosanna", st.seed), ward = wardOf(st), sun = st.sunday === "easter" || st.sunday === "dedication" ? st.sunday : "dedication";
    if (V.budget) V.budget.reset();
    var stages = [], notes = 0, hooks = { defer: o.defer || null, onStage: function (x) { stages.push(x); if (o.onStage) o.onStage(x); }, onNote: function () { notes++; } };
    var end = HO.perform(ctx, into.input, t, { keynoteHz: st.keynote, ward: ward, sunday: sun }, s, hooks), sc = HO.perform.last.score, tl = sc.timeline;
    var windows = [{ name: "the shout (three Hosannas and the amens)", a: tl.cries[0].t0 - 0.2, b: tl.amen.t1 + 1.5 }, { name: "the organ gives out the hymn", a: tl.giving.t0, b: tl.giving.t1 },
                   { name: "The Spirit of God (the verse)", a: tl.lines[0].t0, b: tl.lines[4].t0 }, { name: "the chorus", a: tl.lines[4].t0, b: end - t }];
    var ex = [];
    sc.people.forEach(function (p) { p.lines.forEach(function (ln) { var tt = ln.t - t; ln.notes.forEach(function (n) { if (!n.rest && !n.slur) ex.push([tt - 0.16, tt + 0.08]); tt += n.dur; }); }); });
    sc.hymn.lines.forEach(function (ln) { ["S", "A", "T", "B"].forEach(function (p) { ln.parts[p].forEach(function (n) { if (!n.slur) ex.push([n.t - t - 0.16, n.t - t + 0.08]); }); }); });
    return { dur: end - t + 1.5, score: sc, expect: ex, stats: budgetStats(t, end), windows: windows, stages: stages, told: function () { return { stages: stages, notes: notes }; } };
  };
  P.hosanna.est = function (o) { var st = settings(o); return HO.timeline(stream("hosanna", st.seed), st.sunday).end + 1.5; };
  // (for the cost's baseline: the lab's rooms alone, nothing sounding)
  P.silence = function (ctx, into, t, o) { return { dur: (o && o.secs) || 30, expect: [] }; };
  // ---- the level reference: the v0.30 organChord, line for line (the
  // instruments, trombone and guests labs' P.reference) ------------------------
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, oct = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, oct); }
  var REF_GAINMUL = 0.75 * (0.6 + 0.4 * 0.21), REF_DUR = 6, REF_STEP = 6.4;
  function env(g, t, pts) { g.gain.setValueAtTime(0, t); var tt = t; for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); } return tt; }
  P.reference = function (ctx, into, t) {
    var chords = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(260, d); });
      var tt = t + i * REF_STEP, dur = REF_DUR, stops = 0.5, trem = 0.15, pedal = 0.6;
      var master = ctx.createGain(); master.connect(into.input);
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
  // LIVE PLAYBACK — one context; phrases play into the current room chain;
  // the meter sits after it. The guests lay themselves out a slice at a time
  // (hooks.defer), as the engine's clock will have them: each slice on a
  // timer of its own, a little before it sounds, its main-thread cost kept
  // ==========================================================================
  var actx = null, chain = null, irBuf = null, room = "seated", current = null, analyser = null, told = [];
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    return fetchIR(actx).then(function (b) { irBuf = b; });
  }
  function stop() {
    if (!current) return;
    var c = current;
    c.timers.forEach(function (x) { clearTimeout(x); });
    c.chain.out.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.chain.out.disconnect(); } catch (e) { /* gone */ } }, 400);
    if (V.forget) V.forget(actx);
    current = null;
    $("kg3-now").textContent = "";
  }
  function play(id, o) {
    o = o || {};
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      var ch = buildChain(actx, room, irBuf, analyser, balanceFor(id));
      var me = { id: id, timers: [], chain: ch, cost: { press: 0, slices: [] } };
      told = [];
      var oo = Object.assign({}, o, {
        onStage: function (s) { told.push(s); $("kg3-now").textContent = s.stage + (s.logged === false ? "  (logged: false)" : ""); },
        defer: function (at, fn) {
          me.timers.push(setTimeout(function () {
            if (current !== me) return;
            var c0 = performance.now(); fn(); me.cost.slices.push(performance.now() - c0);
          }, Math.max(0, (at - actx.currentTime) * 1000)));
        },
      });
      current = me;
      var c1 = performance.now();
      var res = P[id](actx, { input: ch.input, wide: ch.wide }, actx.currentTime + 0.3, oo);
      me.cost.press = performance.now() - c1;
      me.until = actx.currentTime + res.dur;
      me.timers.push(setTimeout(function () { if (current === me) stop(); }, (res.dur + 4) * 1000));
      res.cost = me.cost;
      return res;
    });
  }
  function cost() {
    if (!current) return null;
    var c = current.cost, mx = 0;
    c.slices.forEach(function (x) { mx = Math.max(mx, x); });
    return { id: current.id, press: +c.press.toFixed(1), slices: c.slices.length, largest: +mx.toFixed(1) };
  }
  function meter() {
    if (!analyser) return null;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var pk = 0; for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > pk) pk = x; }
    return { peak: 20 * Math.log10(pk + 1e-9) };
  }

  // ==========================================================================
  // CHECK — offline render, and the measures
  // ==========================================================================
  var offlineIR = null;
  function render(id, o) {
    o = o || {};
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : fetchIR(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      var est;
      if (P[id].est) est = { dur: P[id].est(o) };
      else {
        var dummy = new OfflineAudioContext(2, SR, SR), dch = buildChain(dummy, "dry", null, dummy.destination, 0.5);
        est = P[id](dummy, { input: dch.input, wide: dch.wide }, 0.1, o);
        if (V.forget) V.forget(dummy);
      }
      var rm = o.room || room, len = Math.ceil((est.dur + 1.2 + (rm === "dry" ? 0 : 3)) * SR);
      var off = new OfflineAudioContext(2, len, SR);
      var ch = buildChain(off, rm, ir, off.destination, balanceFor(id));
      var res = P[id](off, { input: ch.input, wide: ch.wide }, 0.1, o);
      return off.startRendering().then(function (buf) { return { buf: buf, res: res }; });
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
  // BS.1770-4 over [a, b) samples: integrated (gated) and the loudest 3 s
  function loudnessOf(k, a, b) {
    a = a || 0; b = b || k[0].length;
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
  // the spectral centroid (Hz) of [a, b) s, from 8192-point frames: how
  // bright, or how far away, a sound is heard
  function centroid(mono, a, b) {
    var N = 8192, num = 0, den = 0;
    for (var s = Math.floor(a * SR); s + N <= Math.min(mono.length, b * SR); s += N) {
      var re = new Float32Array(N), im = new Float32Array(N);
      for (var u = 0; u < N; u++) re[u] = mono[s + u] * (0.5 - 0.5 * Math.cos(2 * Math.PI * u / N));
      fft(re, im);
      for (var j = 1; j < N / 2; j++) { var p = re[j] * re[j] + im[j] * im[j], f = j * SR / N; if (f < 60) continue; num += p * f; den += p; }
    }
    return den ? Math.round(num / den) : null;
  }
  function fft(re, im) {
    var n = re.length, i, j = 0, k, len, tr, ti;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr; } }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k + len / 2], ai = im[i + k + len / 2];
          tr = ar * cr - ai * ci; ti = ar * ci + ai * cr;
          re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti; re[i + k] += tr; im[i + k] += ti;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  function analyse(buf, res, id, windows) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length, pk = 0, clip = 0, mono = new Float32Array(n);
    for (var i = 0; i < n; i++) { mono[i] = (L[i] + Rr[i]) * 0.5; var a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > pk) pk = a; if (a > 0.989) clip++; }
    var kw = [kWeight(L), kWeight(Rr)], lu = loudnessOf(kw);
    // CLICKS: 1 ms blocks above 4 kHz standing 12× (21.6 dB) over the loudest
    // block of the 30 ms either side — sorted: inside a window the phrase
    // asked for (a consonant) it is speech; any other is a click
    var hp = highpass(mono, 4000), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) { var e2 = 0; for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q]; hf.push(Math.sqrt(e2 / H)); }
    function maxOf(arr) { var mx = 0; for (var z0 = 0; z0 < arr.length; z0++) if (arr[z0] > mx) mx = arr[z0]; return mx; }
    var ex = (res.expect || []).map(function (w) { return [w[0] + 0.1 - 0.012, w[1] + 0.1 + 0.012]; });
    var strokes = 0, clicks = [];
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = Math.max(maxOf(hf.slice(z - 30, z - 2)), maxOf(hf.slice(z + 3, z + 30)));
      if (hf[z] > ref * 12) { var tz = z * H / SR, asked = ex.some(function (w) { return tz >= w[0] && tz <= w[1]; }); if (asked) strokes++; else clicks.push(+(tz - 0.1).toFixed(3)); }
    }
    var out = { id: id, seconds: +(n / SR).toFixed(1), lufs: lu.I, lufsShortMax: lu.S, peakDb: +db(pk).toFixed(2), clipped: clip, consonants: strokes, clicks: clicks.length, clickTimes: clicks.slice(0, 12) };
    if (res.stats) out.nodes = res.stats;
    if (windows) out.windows = windows.map(function (w) {
      var a0 = Math.max(0, Math.floor((w.a + 0.1) * SR)), b0 = Math.min(n, Math.floor((w.b + 0.1) * SR));
      var lw = b0 - a0 > SR * 3.2 ? loudnessOf(kw, a0, b0) : { I: null, S: null };
      return { name: w.name, from: +w.a.toFixed(1), to: +w.b.toFixed(1), lufs: lw.I, lufsShortMax: lw.S, centroidHz: centroid(mono, w.a + 0.1, w.b + 0.1) };
    });
    return out;
  }
  var refLufs = {};                                // the reference's loudest 3 s, by room
  function reference(rm) {
    rm = rm || room;
    if (refLufs[rm] != null) return Promise.resolve(refLufs[rm]);
    return render("reference", { room: rm }).then(function (r) { refLufs[rm] = analyse(r.buf, r.res, "reference").lufsShortMax; return refLufs[rm]; });
  }
  function check(id, o) {
    o = o || {};
    return reference(o.room).then(function (ref) {
      return render(id, o).then(function (r) {
        var out = analyse(r.buf, r.res, id, r.res.windows);
        out.refShortMax = ref; out.vsRef = +(out.lufsShortMax - ref).toFixed(1);
        if (out.windows) out.windows.forEach(function (w) { if (w.lufsShortMax != null) w.vsRef = +(w.lufsShortMax - ref).toFixed(1); });
        out.res = r.res;
        return out;
      });
    });
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function mmss(s) { var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function table(head, rows) {
    var wrap = el("div", "kg3-scroll"), t = el("table", "kg3-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    t.appendChild(tr);
    rows.forEach(function (r) { var row = el("tr"); r.forEach(function (c) { row.appendChild(el("td", null, c == null ? "—" : String(c))); }); t.appendChild(row); });
    wrap.appendChild(t);
    return wrap;
  }
  function button(txt, cls, fn) { var b = el("button", cls || null, txt); b.type = "button"; b.addEventListener("click", fn); return b; }
  function busy(btn, p) { btn.disabled = true; return p.then(function (x) { btn.disabled = false; return x; }, function (e) { btn.disabled = false; throw e; }); }
  function showErr(host) { return function (e) { host.textContent = "error: " + (e && e.message ? e.message : e); if (window.console) console.warn(e); }; }
  function sign(x) { return (x > 0 ? "+" : "") + x; }
  function measLine(r) {
    return "loudness " + r.lufs + " LUFS (loudest 3 s " + r.lufsShortMax + ", " + sign(r.vsRef) + " LU against the organ reference) · peak " + r.peakDb + " dBFS · clipped " + r.clipped +
      " · consonants " + r.consonants + " · clicks " + r.clicks + (r.clicks ? " (at " + r.clickTimes.join(", ") + " s)" : "") +
      (r.nodes ? " · the voices' nodes ≈" + r.nodes.peakLive + " live at the peak, " + r.nodes.meanLive + " on average" : "");
  }
  function costLine(host) {
    var c = cost();
    if (c) host.textContent = "laid out as the engine's clock will lay it: " + c.press + " ms of main thread at the press, then " + c.slices + " slice" + (c.slices === 1 ? "" : "s") + " a little ahead of the sound, the largest " + c.largest + " ms";
  }
  var views = {};
  function hymnLine() {
    var st = settings(), h = hymnOf(st), hy = h.hymnist || {}, w = wardOf(st);
    var e = $("kg3-hymn"); e.textContent = "";
    e.appendChild(el("b", null, h.nameEn || h.id));
    e.appendChild(document.createTextNode(" · " + h.meter + " · " + h.dialect + " · " + h.mode + " · " + h.modeOfTime + " · " + (hy.nameEn ? "by " + hy.nameEn + " · " : "") +
      h.beatS.toFixed(2) + " s a beat · the ward: " + w.members.filter(function (m) { return m.k != null; }).length + " in the pews, the testimony-bearers " + [].concat(w.roles.testimony || []).map(function (id) { return w.byId[id].nameEn; }).join(", ")));
  }

  // ---- the gift of tongues ----------------------------------------------------
  function tonguesCard() {
    var v = views.tongues = {}, card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The gift of tongues"));
    card.appendChild(el("p", "kg3-phrase", "In the testimony one of the ward rises and sings, unbidden: a free, melismatic song in syllables no one knows — Deseret sounds from a small tongue of the song's own — rising to a height and coming down to rest. The ward, moved, hums its last note as a chord; the harmonium softly takes up its opening."));
    var row = el("div", "kg3-row");
    row.appendChild(button("▶ the gift", "kg3-play", function () { play("tongues").then(function () { v.costHost = v.cost; }); }));
    row.appendChild(button("▶ in a brush arbor (no harmonium)", null, function () { play("tongues", { noReed: true }); }));
    var bC = button("check", "kg3-check", function () { busy(bC, check("tongues").then(function (r) { v.meas.textContent = measLine(r); })).catch(showErr(v.meas)); });
    row.appendChild(bC);
    card.appendChild(row);
    v.who = el("p", "kg3-stat"); card.appendChild(v.who);
    v.words = el("div", "kg3-words"); card.appendChild(v.words);
    v.song = el("div"); card.appendChild(v.song);
    v.plan = el("ol", "kg3-plan"); card.appendChild(v.plan);
    v.meas = el("p", "kg3-meas"); card.appendChild(v.meas);
    v.cost = el("p", "kg3-stat"); card.appendChild(v.cost);
    return card;
  }
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  function tonguesPlan() {
    var v = views.tongues, st = settings(), ward = wardOf(st), s = stream("tongues", st.seed), h = hymnOf(st), sc, seat;
    try {
      seat = TG.plan({ n: 1, kind: KIND[st.sunday], sunday: st.sunday, house: st.dialect, sections: [{ type: "testimony" }], guests: [], ward: ward, force: true }, s);
      sc = TG.score({ mode: h.mode, keynoteHz: st.keynote, house: st.dialect, ward: ward, singer: seat.singer }, s, 0);
    } catch (e) { v.who.textContent = "score: " + e.message; return; }
    var m = sc.singer ? ward.byId[sc.singer] : null;
    v.who.textContent = (m ? m.nameEn + " (" + m.nameDs + "), a " + ({ S: "treble", A: "alto", T: "tenor", B: "bass" }[m.part]) + " and one of the day's testimony-bearers" : "a voice of the ward") +
      " · " + sc.style + " style · " + sc.mode + " · the tongue: " + sc.tongue.consonants.join(" ") + " / " + sc.tongue.vowels.join(" ") +
      " · " + sc.shape.phrases + " phrases, " + sc.notes.filter(function (x) { return !x.slur; }).length + " syllables, " + sc.shape.melismas + " melisma notes · ends on " + sc.final.name +
      " · " + (seat.seeds ? "SEEDS the next hymn (gesture " + sc.gesture.join(" ") + ")" : "does not seed the next hymn") + " · " + mmss(sc.end);
    v.words.textContent = "";
    sc.tongue.words.forEach(function (w) { var sp = el("span", null, w.ds || w.sounds); sp.appendChild(el("br")); sp.appendChild(el("small", null, w.sounds)); v.words.appendChild(sp); });
    v.song.textContent = "";
    sc.lines.forEach(function (ln) {
      var syl = ln.notes.filter(function (x) { return !x.slur; }).map(function (x) { return x.vowel; }).join(" ");
      var mel = ln.notes.filter(function (x) { return x.slur; }).length;
      v.song.appendChild(el("p", "kg3-song", mmss(ln.t0) + " — " + syl + (mel ? "  (" + mel + " notes of melisma)" : "") + (ln.echo ? " · the name again" : "") + (ln.peak ? " · the height" : "")));
    });
    v.plan.textContent = "";
    sc.stages.forEach(function (sg) { v.plan.appendChild(el("li", null, mmss(sg.t) + " — " + sg.stage)); });
    v.plan.appendChild(el("li", null, "the chord the ward hums: " + ["S", "A", "T", "B"].map(function (p) { return p + " " + sc.chord[p].f.toFixed(1) + " Hz"; }).join(" · ")));
  }

  // ---- the far ward -------------------------------------------------------------
  function farOpts() { var f = val("kg3-far", "auto"), vo = val("kg3-voices", "desks"); return { far: f === "auto" ? null : f, voices: vo }; }
  function farwardCard() {
    var v = views.farward = {}, card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The far ward"));
    card.appendChild(el("p", "kg3-phrase", "Through the open windows, another ward elsewhere in the colony sings the same hymn a line late — heard across the valley, a little sharp or flat of ours and drifting, sometimes in another harmonization, on its own chorister's time: a canon at a distance."));
    var row = el("div", "kg3-row"), fs = el("select"), vs = el("select");
    fs.id = "kg3-far"; vs.id = "kg3-voices";
    [["auto", "as the seed draws it"], ["same", "our harmonization"], ["sacredharp", "Sacred Harp"], ["tabernacle", "Tabernacle"], ["shaker", "in unison (Shaker)"]].forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; fs.appendChild(op); });
    [["desks", "eight pews of three (as built)"], ["people", "twenty-four throats (the A/B)"]].forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; vs.appendChild(op); });
    var l1 = el("label", null, "their harmony "); l1.appendChild(fs);
    var l2 = el("label", null, "their voices "); l2.appendChild(vs);
    row.appendChild(l1); row.appendChild(l2);
    card.appendChild(row);
    var row2 = el("div", "kg3-row");
    row2.appendChild(button("▶ the canon", "kg3-play", function () { play("canon", farOpts()); }));
    row2.appendChild(button("▶ the far ward alone", null, function () { play("far", farOpts()); }));
    row2.appendChild(button("▶ our ward alone", null, function () { play("near", farOpts()); }));
    var bC = button("check", "kg3-check", function () { busy(bC, farCheck()).catch(showErr(v.meas)); });
    row2.appendChild(bC);
    card.appendChild(row2);
    v.stat = el("p", "kg3-stat"); card.appendChild(v.stat);
    v.plan = el("ol", "kg3-plan"); card.appendChild(v.plan);
    v.meas = el("p", "kg3-meas"); card.appendChild(v.meas);
    v.meas2 = el("div"); card.appendChild(v.meas2);
    v.cost = el("p", "kg3-stat"); card.appendChild(v.cost);
    [fs, vs].forEach(function (x) { x.addEventListener("change", farwardPlan); });
    return card;
  }
  function farPrepared(st) { var ws = wardSheet(st), fo = farOpts(); return FW.prepare({ hymn: ws.hymn, keynoteHz: st.keynote, far: fo.far, voices: fo.voices }, stream("farward", st.seed)); }
  function farwardPlan() {
    var v = views.farward, st = settings(), ws, pr, seat;
    try {
      ws = wardSheet(st); pr = farPrepared(st);
      seat = FW.plan({ n: 1, kind: KIND[st.sunday], sunday: st.sunday, sections: [{ type: "prelude" }, { type: "invocation" }, { type: "hymn" }, { type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" }],
                       hymnal: [{ id: ws.hymn.id, section: 2, dialect: ws.hymn.dialect }], guests: [], force: true }, stream("farward", st.seed));
    } catch (e) { v.stat.textContent = "prepare: " + e.message; return; }
    var joined = FW.versesJoined(pr.from, ws.verses.length);
    v.stat.textContent = (seat ? "seated on the hymn (" + seat.section + "), " : "refused (" + (st.dialect === "oldway" ? "a lined hymn is the ward's alone" : "—") + "), ") +
      "their harmony: " + (pr.far === "same" ? "ours (" + ws.hymn.dialect + ")" : pr.setting.dialect + ", set again from our tune") + " · a " + pr.lagLines + "-line lag (" + pr.lagBeats + " beats) · " +
      (pr.side < 0 ? "from the left" : "from the right") + " (" + pr.side.toFixed(2) + ") · distance " + pr.distance.toFixed(2) + " (air above " + pr.lpHz + " Hz gone, " + Math.round(pr.delayS * 1000) + " ms across) · tuned " +
      sign(+pr.cents.toFixed(1)) + " cents, drifting " + sign(+pr.drift.toFixed(1)) + " more · their tempo ×" + pr.tempo.toFixed(3) + ", fermatas ×" + pr.holdMul.toFixed(2) + " · joins verse" + (joined.length > 1 ? "s " : " ") + joined.map(function (x) { return x + 1; }).join(", ") + " of our " + ws.verses.length + (pr.amen ? ", and the A-men" : "");
    v.plan.textContent = "";
    v.plan.appendChild(el("li", null, "our ward: " + ws.plan.verses.map(function (P2) { return P2.practice; }).join(", ") + (ws.organ ? " — with the organ" : " — unaccompanied") + " · verses begin at " + ws.verses.map(function (x) { return mmss(x.at); }).join(", ")));
    v.plan.appendChild(el("li", null, "their pews: " + pr.desks.map(function (d) { return d.voicePart + " on " + d.sings + (d.oct !== 1 ? (d.oct > 1 ? " (8va)" : " (8vb)") : ""); }).join(" · ")));
  }
  function farCheck() {
    var v = views.farward, o = farOpts();
    return reference().then(function (ref) {
      return render("near", o).then(function (rn) {
        var an = analyse(rn.buf, rn.res, "near");
        return render("far", Object.assign({}, o, { nearby: true })).then(function (rn2) {
          var nearMeas = { high: highShare(rn2.buf), centroid: centroid2(rn2.buf), lu: analyse(rn2.buf, rn2.res, "far-nearby").lufsShortMax };
          return render("far", o).then(function (rf) { rf.near = nearMeas; return rf; });
        }).then(function (rf) {
          var af = analyse(rf.buf, rf.res, "far"), last = rf.res.last, ws = rf.res.ws, pr = last.prepared, lags = [], cents = [];
          last.told.forEach(function (x) {
            var ours = ws.verses[x.v]; if (!ours) return;
            // the lag: their first line against our first line's length, and in seconds
            var ourLine = ws.sheet.lines.filter(function (ln) { return ln.verse === x.v && ln.line === 0; })[0];
            lags.push({ v: x.v + 1, s: +(x.t0 + pr.delayS - (0.1 + ours.at)).toFixed(2), lines: ourLine ? +((x.t0 + pr.delayS - (0.1 + ours.at)) / ourLine.len).toFixed(2) : null });
            x.sc.lines.forEach(function (ln) { ln.desks.forEach(function (dk) { dk.notes.forEach(function (n) { cents.push(n.cents); }); }); });
          });
          var cMin = Math.min.apply(null, cents), cMax = Math.max.apply(null, cents);
          v.meas.textContent = "our ward: loudest 3 s " + an.lufsShortMax + " LUFS (" + sign(+(an.lufsShortMax - ref).toFixed(1)) + " LU against the organ reference), centroid " + centroid2(rn.buf) + " Hz · the far ward: loudest 3 s " + af.lufsShortMax + " LUFS (" +
            sign(+(af.lufsShortMax - an.lufsShortMax).toFixed(1)) + " LU under ours; integrated " + sign(+(af.lufs - an.lufs).toFixed(1)) + "), centroid " + centroid2(rf.buf) + " Hz · clicks: ours " + an.clicks + ", theirs " + af.clicks + " · peak " + Math.max(an.peakDb, af.peakDb) + " dBFS" +
            (af.nodes ? " · their voices' nodes ≈" + af.nodes.peakLive + " live at the peak" : "");
          v.meas2.textContent = "";
          if (rf.near) v.meas2.appendChild(el("p", "kg3-stat", "what the valley takes (the same pews with no distance between, against them across it): the high band (2.5–8 kHz against 250 Hz–2.5 kHz) " + rf.near.high + " dB nearby → " + highShare(rf.buf) + " dB across the valley; centroid " + rf.near.centroid + " → " + centroid2(rf.buf) + " Hz; loudest 3 s " + rf.near.lu + " → " + af.lufsShortMax + " LUFS; heard " + Math.round(pr.delayS * 1000) + " ms late, from " + (pr.side < 0 ? "the left" : "the right") + " (" + pr.side.toFixed(2) + ")"));
          v.meas2.appendChild(table(["verse", "they begin after us", "in our first line's length", "their tuning against ours (cents)"], lags.map(function (x, i) { return [x.v, x.s + " s", x.lines, i === 0 ? cMin.toFixed(1) + " … " + cMax.toFixed(1) + " over the whole" : ""]; })));
          return { near: an, far: af, lags: lags, cents: [cMin, cMax], ref: ref, valley: rf.near ? { highNearby: rf.near.high, highFar: highShare(rf.buf), centroidNearby: rf.near.centroid, centroidFar: centroid2(rf.buf), luNearby: rf.near.lu, luFar: af.lufsShortMax } : null, prepared: { far: pr.far, setting: pr.setting.dialect, lagLines: pr.lagLines, lagBeats: pr.lagBeats, cents: pr.cents, drift: pr.drift, distance: pr.distance, side: pr.side, from: pr.from } };
        });
      });
    });
  }
  // the high band's share: energy 2.5–8 kHz against 250 Hz–2.5 kHz (dB)
  function highShare(buf) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), N = 8192, lo = 0, hi = 0;
    for (var s0 = 0; s0 + N <= L.length; s0 += N) {
      var re = new Float32Array(N), im = new Float32Array(N);
      for (var u = 0; u < N; u++) re[u] = (L[s0 + u] + Rr[s0 + u]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * u / N));
      fft(re, im);
      for (var j = 1; j < N / 2; j++) { var f = j * SR / N, pw = re[j] * re[j] + im[j] * im[j]; if (f >= 250 && f < 2500) lo += pw; else if (f >= 2500 && f < 8000) hi += pw; }
    }
    return +(10 * Math.log10((hi + 1e-20) / (lo + 1e-20))).toFixed(1);
  }
  function centroid2(buf) { var L = buf.getChannelData(0), Rr = buf.getChannelData(1), m = new Float32Array(L.length); for (var i = 0; i < L.length; i++) m[i] = (L[i] + Rr[i]) * 0.5; return centroid(m, 0, L.length / SR); }

  // ---- the Hosanna -------------------------------------------------------------
  function hosannaCard() {
    var v = views.hosanna = {}, card = el("section", "kg3-card"), h = el("h2", "kg3-name", "The Hosanna");
    h.appendChild(el("span", "kg3-badge", "Easter · a dedication · unlogged"));
    card.appendChild(h);
    card.appendChild(el("p", "kg3-phrase", "At the close of the doxology the ward stands and shouts, together, “Hosanna, Hosanna, Hosanna, to God and the Lamb” three times, and “Amen, Amen, and Amen” — a massed crowd on the voices' own vowels, the room ringing between — and then sings “The Spirit of God” (ASSEMBLY) with the full organ. Nothing is written in the minutes or on the board: every stage it tells is logged: false."));
    var row = el("div", "kg3-row");
    row.appendChild(button("▶ the Hosanna", "kg3-play", function () { play("hosanna"); }));
    var bC = button("check", "kg3-check", function () { busy(bC, check("hosanna").then(function (r) { hosannaMeas(r); })).catch(showErr(v.meas)); });
    row.appendChild(bC);
    card.appendChild(row);
    v.rule = el("p", "kg3-stat"); card.appendChild(v.rule);
    v.plan = el("ol", "kg3-plan"); card.appendChild(v.plan);
    v.meas = el("p", "kg3-meas"); card.appendChild(v.meas);
    v.meas2 = el("div"); card.appendChild(v.meas2);
    v.cost = el("p", "kg3-stat"); card.appendChild(v.cost);
    return card;
  }
  function hosannaRule() {
    var st = settings(), secs = [{ type: "prelude" }, { type: "hymn" }, { type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" }], rows = [];
    Object.keys(K.Calendar.SUNDAYS).forEach(function (sun) {
      var n = 0, forced = 0, N = 2000;
      for (var i = 1; i <= N; i++) { var s = R(i).fork(HO.LABEL + 1); if (HO.plan({ n: 1, kind: K.Calendar.SUNDAYS[sun].kind, sunday: sun, sections: secs }, s)) n++; if (HO.plan({ n: 1, sunday: sun, sections: secs, force: true }, s)) forced++; }
      rows.push([sun, (100 * n / N).toFixed(1) + " %", forced ? "yes" : "never"]);
    });
    return rows;
  }
  function hosannaPlan() {
    var v = views.hosanna, st = settings(), sc;
    try { sc = HO.score({ keynoteHz: st.keynote, ward: wardOf(st), sunday: st.sunday }, stream("hosanna", st.seed), 0); } catch (e) { v.rule.textContent = "score: " + e.message; return; }
    var seat = HO.plan({ n: 1, sunday: st.sunday, sections: [{ type: "hymn" }, { type: "doxology" }, { type: "postlude" }], force: true }, stream("hosanna", st.seed));
    v.rule.textContent = "this Sunday (" + st.sunday + "): " + (seat ? "it may come — seated at the doxology's close, logged: " + seat.logged + ", " + mmss(seat.dur) : "never (" + HO.decide({ sunday: st.sunday, sections: [{ type: "doxology" }] }, stream("hosanna", st.seed)).why + ") — the lab plays it as a dedication's") +
      " · " + sc.people.length + " voices shout (the thirty-two and the Primary's " + (sc.people.length - 32) + ") · ASSEMBLY (№" + sc.tune.number + ") in the day's key, " + sc.hymn.beatS.toFixed(2) + " s a beat, full organ";
    v.plan.textContent = "";
    sc.stages.forEach(function (sg) { v.plan.appendChild(el("li", null, mmss(sg.t) + " — " + sg.stage + " (logged: " + sg.logged + ")")); });
    v.plan.appendChild(el("li", null, "the chorus's second line, sung: " + sc.hymn.lines[5].parts.S.filter(function (n) { return !n.slur; }).map(function (n) { return n.vowel; }).join(" ")));
  }
  function hosannaMeas(r) {
    var v = views.hosanna, told = r.res.told();
    v.meas.textContent = measLine(r) + " · it told " + told.stages.length + " stages, " + told.stages.filter(function (x) { return x.logged === false; }).length + " of them logged: false; hymn notes offered to the staff " + told.notes + " (the shout none)";
    v.meas2.textContent = "";
    v.meas2.appendChild(table(["part", "from", "to", "loudest 3 s (LU against the organ reference)", "integrated", "centroid (Hz)"], r.windows.map(function (w) { return [w.name, mmss(w.from), mmss(w.to), w.vsRef != null ? sign(w.vsRef) : "—", w.lufs, w.centroidHz]; })));
    v.meas2.appendChild(el("p", "kg3-stat", "plan() over 2,000 meetings a Sunday — seated / seated when forced:"));
    v.meas2.appendChild(table(["Sunday", "seated", "even when forced?"], hosannaRule()));
  }

  // ---- the odds and purity ------------------------------------------------------
  // THE STAND-IN: the dice kolob-meeting.js planMeeting throws, in its order,
  // for what matters to a seat — the calendar's Sunday and its kind; the
  // order of service (hymns by kind, the testimony cut, an interlude, the
  // second doxology); the hymnal's rows (a dialect each, a round after the
  // first hymn now and then); and the other guests' dice and seats (the
  // bands, the steeples, the old tune, the trombones, the singing school,
  // the handbells). The harness measures the same against the real planner
  // once the engine seats these guests.
  var HYMNS = { ordinary: 2, fast: 1, conference: 3, jubilee: 3 };
  var DIALECT_W = [["tabernacle", 4], ["sacredharp", 1.5], ["psalmody", 1], ["gospel", 1.2], ["shaker", 0.8], ["oldway", 1.5]];
  function standIn(Rs) {
    var sunday = K.Calendar.draw(Rs.next()), kind = K.Calendar.kindOf(sunday), pl = K.Calendar.SUNDAYS[sunday].plan || {};
    var cutT = Rs.chance(pl.cutTestimony != null ? pl.cutTestimony : 0.25), inter = Rs.chance(0.15), dox2 = Rs.chance(pl.secondDox != null ? pl.secondDox : kind === "jubilee" ? 0.5 : 0);
    var nH = pl.hymns || HYMNS[kind], secs = [{ type: "prelude" }, { type: "invocation" }];
    for (var h = 0; h < nH; h++) secs.push({ type: "hymn" });
    secs.push({ type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" });
    if (cutT) secs = secs.filter(function (x) { return x.type !== "testimony"; });
    if (nH >= 2 && inter) for (var i = 0; i < secs.length; i++) if (secs[i].type === "hymn") { secs.splice(i + 1, 0, { type: "interlude" }); break; }
    if (dox2) secs.splice(secs.length - 1, 0, { type: "doxology" });
    var rows = [], first = true;
    secs.forEach(function (x, k) { if (x.type === "hymn" || x.type === "doxology") { var d = Rs.pickW(DIALECT_W), rd = Rs.next(); rows.push({ id: "h:" + k, section: k, dialect: d, piece: !first && x.type === "hymn" && rd < 0.2 ? "round" : null }); first = false; } });
    var house = rows.length ? rows[0].dialect : "tabernacle", guests = [];
    function idx(type) { for (var j = 0; j < secs.length; j++) if (secs[j].type === type) return j; return -1; }
    function add(type, sec) { var j = idx(sec); if (j >= 0) guests.push({ type: type, section: sec, index: j }); }
    var bD = Rs.chance(0.36), bS = Rs.chance(0.7), stD = Rs.chance(0.075), stS = Rs.chance(0.55), oD = Rs.chance(0.12), oS = Rs.chance(0.65), tD = Rs.next(), ssD = Rs.chance(0.1), hbD = Rs.chance(0.125), hbS = Rs.next();
    if (bD) add("bands", bS ? "doxology" : "hymn");
    if (stD) add("steeples", stS ? "prelude" : "postlude");
    if (oD) add("oldtune", oS ? "prelude" : "testimony");
    var pre = guests.some(function (g) { return g.section === "prelude"; });
    if (!bD && !pre && tD < 0.21) add("trombones", "prelude");
    if (!guests.some(function (g) { return g.section === "prelude"; }) && ssD) add("singingschool", "prelude");
    if (hbD) add("handbells", hbS < 0.38 ? "invocation" : hbS < 0.64 ? "sacrament" : "postlude");
    return { sunday: sunday, kind: kind, house: house, sections: secs, hymnal: rows, guests: guests };
  }
  function odds(N) {
    N = N || 20000;
    var R0 = R(99).fork("lab:odds"), res = { n: N, tongues: {}, farward: {}, hosanna: {}, any: 0, two: 0, beside: 0, byGuest: { tongues: 0, farward: 0, hosanna: 0 } };
    for (var i = 1; i <= N; i++) {
      var m = standIn(R0), seated = [];
      ["tongues", "farward", "hosanna"].forEach(function (g) {
        var G = { tongues: TG, farward: FW, hosanna: HO }[g], info = { n: i, kind: m.kind, sunday: m.sunday, house: m.house, sections: m.sections, hymnal: m.hymnal, guests: m.guests.concat(seated) };
        var seat = G.plan(info, R(i).fork(G.LABEL + i)), row = res[g][m.sunday] = res[g][m.sunday] || { n: 0, seated: 0 };
        row.n++;
        if (seat) { row.seated++; res.byGuest[g]++; seated.push({ type: g, section: seat.section, index: seat.sectionIndex != null ? seat.sectionIndex : m.sections.map(function (x) { return x.type; }).indexOf(seat.section) }); }
      });
      if (seated.length) res.any++;
      if (seated.length > 1) res.two++;
      seated.forEach(function (a) { m.guests.forEach(function (b) { if (a.type !== "hosanna" && Math.abs(a.index - b.index) <= 1) res.beside++; }); });
    }
    return res;
  }
  // PURITY: every plan and score twice on the same stream, alike; no Math.random
  function purity() {
    var st = settings(), ward = wardOf(st), h = hymnOf(st), secs = [{ type: "prelude" }, { type: "hymn" }, { type: "testimony" }, { type: "sacrament" }, { type: "doxology" }, { type: "postlude" }];
    var real = Math.random, calls = 0, out = {};
    Math.random = function () { calls++; return real(); };
    try {
      function twice(fn) { return JSON.stringify(fn()) === JSON.stringify(fn()); }
      out.tongues = twice(function () { var s = stream("tongues", st.seed), seat = TG.plan({ sunday: "fast", kind: "fast", sections: secs, guests: [], ward: ward, force: true }, s); return [seat, TG.score({ mode: h.mode, keynoteHz: st.keynote, ward: ward, singer: seat.singer, house: st.dialect }, s, 0)]; });
      out.farward = twice(function () { var s = stream("farward", st.seed), pr = FW.prepare({ hymn: h, keynoteHz: st.keynote }, s); return [FW.plan({ sunday: "conference", kind: "conference", sections: secs, hymnal: [{ id: h.id, section: 1, dialect: h.dialect }], guests: [], force: true }, s), pr.far, pr.lagBeats, FW.score(pr, 1, 10, h.beatS, { origin: 10, span: 60 }, s)]; });
      out.hosanna = twice(function () { var s = stream("hosanna", st.seed); return [HO.plan({ sunday: "easter", sections: secs, force: true }, s), HO.score({ keynoteHz: st.keynote, ward: ward, sunday: "easter" }, s, 0)]; });
    } finally { Math.random = real; }
    out.mathRandomCalls = calls;
    out.hosannaElsewhere = Object.keys(K.Calendar.SUNDAYS).filter(function (sun) { return sun !== "easter" && sun !== "dedication" && HO.plan({ sunday: sun, sections: secs, force: true }, stream("hosanna", st.seed)); });
    return out;
  }
  function oddsCard() {
    var v = views.odds = {}, card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The odds, and purity"));
    card.appendChild(el("p", "kg3-phrase", "Each guest's plan() over 20,000 meetings of a stand-in for the engine's planner (the calendar's Sundays, the order of service, the hymnal's dialects, the other guests' own dice and seats); and every plan and score run twice on the same stream, with Math.random watched."));
    var row = el("div", "kg3-row"), out = el("div"), pOut = el("p", "kg3-meas");
    var bO = button("run the odds", null, function () {
      busy(bO, new Promise(function (res) { setTimeout(function () { res(odds(20000)); }, 20); })).then(function (r) {
        out.textContent = "";
        var suns = Object.keys(K.Calendar.SUNDAYS);
        out.appendChild(table(["guest", "all"].concat(suns), ["tongues", "farward", "hosanna"].map(function (g) {
          return [g === "farward" ? "the far ward" : g === "tongues" ? "the gift of tongues" : "the Hosanna", (100 * r.byGuest[g] / r.n).toFixed(1) + " %"].concat(suns.map(function (sn) { var x = r[g][sn]; return x ? (100 * x.seated / x.n).toFixed(1) + " %" : "—"; }));
        })));
        out.appendChild(el("p", "kg3-stat", "meetings with at least one of the three: " + (100 * r.any / r.n).toFixed(1) + " % · with two or three: " + (100 * r.two / r.n).toFixed(1) + " % · seated in or beside another guest's section (the gift and the far ward): " + r.beside));
      });
    });
    var bP = button("check purity", null, function () { var r = purity(); pOut.textContent = "same stream, same plan and score — the gift: " + (r.tongues ? "yes" : "NO") + " · the far ward: " + (r.farward ? "yes" : "NO") + " · the Hosanna: " + (r.hosanna ? "yes" : "NO") + " · Math.random calls: " + r.mathRandomCalls + " · the Hosanna seated, even forced, on any Sunday but Easter and a dedication: " + (r.hosannaElsewhere.length ? "YES " + r.hosannaElsewhere.join(", ") : "never"); });
    row.appendChild(bO); row.appendChild(bP);
    card.appendChild(row); card.appendChild(out); card.appendChild(pOut);
    return card;
  }

  // ---- the gift's pitch, tracked ---------------------------------------------------
  // The singer alone, dry, rendered; a YIN pitch track (12 kHz, 40 ms
  // windows, 20 ms hops) against the score: how many frames sound the note
  // written for them (within 60 cents), for the syllables and for the
  // melismas apart — the first 70 ms of each note left out (the voice's scoop)
  function yin(x, sr, fmin, fmax, win, hop) {
    var W = Math.round((win || 0.04) * sr), H = Math.round((hop || 0.02) * sr), tmin = Math.floor(sr / fmax), tmax = Math.ceil(sr / fmin), out = [];
    for (var s0 = 0; s0 + W + tmax < x.length; s0 += H) {
      var e = 0; for (var i = 0; i < W; i++) e += x[s0 + i] * x[s0 + i];
      if (e / W < 1e-7) { out.push(null); continue; }
      var d = new Float32Array(tmax + 1), run = 0, best = -1;
      for (var tau = 1; tau <= tmax; tau++) {
        var sum = 0; for (var j = 0; j < W; j++) { var df = x[s0 + j] - x[s0 + j + tau]; sum += df * df; }
        run += sum; d[tau] = sum * tau / (run || 1);
      }
      for (var t2 = tmin; t2 < tmax; t2++) if (d[t2] < 0.15 && d[t2] <= d[t2 + 1]) { best = t2; break; }
      if (best < 0) { out.push(null); continue; }
      var a = d[best - 1], b = d[best], c = d[best + 1], sh = (a - c) / (2 * (a - 2 * b + c) || 1);
      out.push(sr / (best + (isFinite(sh) ? sh : 0)));
    }
    return { f: out, hop: H / sr, win: W / sr };
  }
  function pitchCheck() {
    return render("tongues", { only: "singer", room: "dry" }).then(function (r) {
      var sc = r.res.score, L = r.buf.getChannelData(0), Rr = r.buf.getChannelData(1), ds = 4, n = Math.floor(L.length / ds), x = new Float32Array(n);
      for (var i = 0; i < n; i++) { var acc = 0; for (var k = 0; k < ds; k++) acc += L[i * ds + k] + Rr[i * ds + k]; x[i] = acc / (2 * ds); }
      var fs = sc.notes.map(function (m) { return m.f; }), tr = yin(x, SR / ds, Math.min.apply(null, fs) / 1.5, Math.max.apply(null, fs) * 1.5);
      var tally = { syl: [0, 0], mel: [0, 0], octave: 0, unvoiced: 0 };
      sc.notes.forEach(function (m) {
        var a = m.t + 0.07, b = m.t + m.dur - 0.02;
        for (var q = Math.ceil((a - tr.win / 2) / tr.hop); q * tr.hop + tr.win / 2 < b; q++) {          // (the score's times are the render's own)
          var f = tr.f[q], key = m.slur ? "mel" : "syl";
          if (f == null) { tally.unvoiced++; continue; }
          var c = 1200 * Math.log(f / m.f) / Math.LN2;
          tally[key][1]++;
          if (Math.abs(c) <= 60) tally[key][0]++; else if (Math.abs(Math.abs(c) - 1200) <= 60) tally.octave++;
        }
      });
      // EACH NOTE HEARD: a fine track (20 ms windows, 5 ms hops); a note's
      // median pitch over the second half of its length, against the
      // pitch written for it and its neighbours' — identified when it is
      // nearer its own than either neighbour's, and within 60 cents
      var fine = yin(x, SR / ds, Math.min.apply(null, fs) / 1.5, Math.max.apply(null, fs) * 1.5, 0.02, 0.005), ident = { syl: [0, 0], mel: [0, 0] }, dev = [];
      sc.notes.forEach(function (m, i) {
        var a = m.t + 0.5 * m.dur, b = m.t + 0.97 * m.dur, got = [];
        for (var q = Math.ceil((a - fine.win / 2) / fine.hop); q * fine.hop + fine.win / 2 < b; q++) if (fine.f[q]) got.push(fine.f[q]);
        if (!got.length) return;
        got.sort(function (u, v) { return u - v; });
        var f = got[Math.floor(got.length / 2)], key = m.slur ? "mel" : "syl", c = 1200 * Math.log(f / m.f) / Math.LN2;
        var near = function (g) { return g ? Math.abs(1200 * Math.log(f / g) / Math.LN2) : 1e9; };
        var prev = sc.notes[i - 1] && Math.abs(sc.notes[i - 1].f / m.f - 1) > 0.01 ? sc.notes[i - 1].f : null, next = sc.notes[i + 1] && Math.abs(sc.notes[i + 1].f / m.f - 1) > 0.01 ? sc.notes[i + 1].f : null;
        ident[key][1]++;
        if (Math.abs(c) <= 60 && Math.abs(c) < near(prev) && Math.abs(c) < near(next)) ident[key][0]++;
        if (m.slur) dev.push(Math.abs(c));
      });
      dev.sort(function (u, v) { return u - v; });
      return { syllables: tally.syl, melisma: tally.mel, octave: tally.octave, unvoiced: tally.unvoiced, identified: ident, melismaMedianCents: dev.length ? +dev[Math.floor(dev.length / 2)].toFixed(1) : null, melismaNotes: sc.notes.filter(function (m) { return m.slur; }).length,
               meanMelismaNoteS: +(sc.notes.filter(function (m) { return m.slur; }).reduce(function (a2, m) { return a2 + m.dur; }, 0) / Math.max(1, sc.notes.filter(function (m) { return m.slur; }).length)).toFixed(3) };
    });
  }

  // ---- INIT ---------------------------------------------------------------------
  var CARDS = [["tongues", tonguesCard, tonguesPlan], ["farward", farwardCard, farwardPlan], ["hosanna", hosannaCard, hosannaPlan], ["odds", oddsCard, function () {}]];
  function refresh() {
    try { hymnLine(); } catch (e) { $("kg3-hymn").textContent = "compose: " + e.message; return; }
    CARDS.forEach(function (c) { if (views[c[0]] || c[0] === "odds") try { c[2](); } catch (e) { if (window.console) console.warn(c[0], e); } });
  }
  function init() {
    var host = $("kg3-cards");
    CARDS.forEach(function (c) { if (c[0] === "tongues" && !TG) return; if (c[0] === "farward" && !FW) return; if (c[0] === "hosanna" && !HO) return; host.appendChild(c[1]()); });
    ["kg3-seed", "kg3-sunday", "kg3-dialect", "kg3-mode", "kg3-key"].forEach(function (id) { $(id).addEventListener("change", function () { stop(); refresh(); }); });
    $("kg3-room").addEventListener("change", function (e) { room = e.target.value; });
    $("kg3-stop").addEventListener("click", stop);
    $("kg3-compose").addEventListener("click", function () { $("kg3-seed").value = Math.round(num("kg3-seed", 7)) + 1; stop(); refresh(); });
    // a link can carry the settings: ?seed=7&sunday=easter&dialect=sacredharp&mode=dorian&key=260
    var q = window.location.search;
    [["seed", "kg3-seed"], ["sunday", "kg3-sunday"], ["dialect", "kg3-dialect"], ["mode", "kg3-mode"], ["key", "kg3-key"], ["room", "kg3-room"]].forEach(function (p) {
      var m = new RegExp("[?&]" + p[0] + "=([^&#]*)").exec(q);
      if (m) { var e = $(p[1]); if (e) e.value = decodeURIComponent(m[1]); }
    });
    room = val("kg3-room", "seated");
    refresh();
    setInterval(function () {
      var m = meter(), me = $("kg3-meter");
      if (me) me.textContent = m ? "out " + (m.peak < -90 ? "—" : m.peak.toFixed(1) + " dBFS") : "out —";
      if (current) { var v = views[current.id === "shout" ? "hosanna" : current.id === "near" || current.id === "far" || current.id === "canon" ? "farward" : current.id]; if (v && v.cost) costLine(v.cost); }
    }, 200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return {
    play: play, stop: stop, check: check, render: render, refresh: refresh, cost: cost, farCheck: function () { return farCheck(); },
    now: function () { return actx ? actx.currentTime : 0; }, ctx: function () { return actx; }, odds: odds, purity: purity, standIn: standIn, pitchCheck: pitchCheck,
    hymn: function () { return hymnOf(settings()); }, ward: function () { return wardOf(settings()); }, told: function () { return told.slice(); },
    _P: P, _settings: settings,
  };
})();
