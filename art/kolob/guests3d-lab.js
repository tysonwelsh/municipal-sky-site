// ============================================================================
// GUESTS LAB 3d — audition bench for the Social Hall and the Testimony (dev,
// unlinked; the script keeps its global name, GuestsLab3c).
//
// THE SOCIAL HALL (KOLOB.GuestSocialHall): the benches pushed back, the
// fiddler tuning, the caller, the potatoes, a reel, jig or quadrille made of
// one of the day's hymns (the lab composes the day's first hymn and its
// doxology, in the dialects on the card), AABB two or three times through,
// the floor and the hands, the tag, the final, applause — its plan, its
// strains (the hymn's own notes marked), its people from a ward the cast
// seats here. THE TESTIMONY (KOLOB.Testimony): the ward's testimony-bearers
// rise one by one and speak, and the harmonium or the clarinet takes up
// each one's speech-melody — each bearer's contour drawn against the reed's
// notes, so you can see the words become music.
//
// Everything plays through the app's own master chain (glue → master 0.6 →
// tanh → compressor, as kolob-core.js builds it) plus a brick-wall guard at
// −1 dBFS, in the app's rooms (the guests lab's chain, line for line): the
// lab never plays louder than the app. CHECK renders offline (the same
// graph) and measures loudness against the v0.30 organ reference, peak,
// clipping and clicks — high-frequency bursts nothing scheduled.
//
// Dev console: GuestsLab3c.play(id, o), .check(id, o), .odds(N), .purity(),
// .day(), .score("hall" | "testimony"), .stop(). Public surface: window.GuestsLab3c
// ============================================================================
window.GuestsLab3c = (function () {
  "use strict";

  var SR = 48000;
  var K = window.KOLOB, SH = K.GuestSocialHall, TM = K.Testimony || null, CAL = K.Calendar;
  function mod(a, n) { return ((a % n) + n) % n; }

  // ==========================================================================
  // THE CHAIN — the guests lab's (kolob-core.js init()'s): rooms → voicesBus
  // → glue → master 0.6 → tanh(1.15) → compressor(−18/3:1), then a guard at
  // −1 dBFS. AS SEATED: both rooms at the section's balance (kolob-core.js
  // ROOM_BALANCE) plus the layer's depth: the Social Hall a step nearer than
  // the ward (the benches pushed back, the room a hall: HALL_DEPTH), the
  // testimony's speaker as near as the still small voice and the reeds where
  // the harmonium sits (one balance for the whole testimony: their mean).
  // ==========================================================================
  var ROOM_BALANCE = { testimony: 0.30, postlude: 0.55, prelude: 0.55 };
  var HALL_DEPTH = -0.2, SPEAKER_DEPTH = -0.35, REED_DEPTH = -0.15, ORGAN_DEPTH = 0.10;
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
  function buildChain(ctx, room, irBuf, dest, balance) {
    var t = 0;
    var session = ctx.createGain(), voicesBus = ctx.createGain();
    // one room: a send → its dry (1) and its wet (pre-delay → convolver)
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
    return { input: session, out: fade, room: room, balance: balance };
  }
  // where each sits, as seated (0 = all meetinghouse … 1 = all tabernacle)
  function balanceFor(id) {
    var cl = function (x) { return Math.max(0, Math.min(1, x)); };
    if (id === "hall") return cl(ROOM_BALANCE.postlude + HALL_DEPTH);
    if (id === "testimony") return cl(ROOM_BALANCE.testimony + (SPEAKER_DEPTH + REED_DEPTH) / 2);
    return cl(ROOM_BALANCE.prelude + ORGAN_DEPTH);           // the reference: where the prelude seats the organ
  }

  // ==========================================================================
  // THE DAY — the day's first hymn and its doxology, composed here, and the
  // ward the Sunday seats (its testimony-bearers, its enthusiast, its old bass)
  // ==========================================================================
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = document.getElementById(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function settings(o) {
    o = o || {};
    return {
      seed: o.seed != null ? o.seed : Math.round(num("kg3-seed", 4)),
      sunday: o.sunday || val("kg3-sunday", "pioneer"),
      mode: o.mode != null ? o.mode : val("kg3-mode", ""),
      keynote: Math.max(200, Math.min(320, o.keynote != null ? o.keynote : num("kg3-key", 262))),
      first: o.first || val("kg3-first", "gospel"),
      dox: o.dox || val("kg3-dox", "tabernacle"),
    };
  }
  var dayCache = null, dayKey = null;
  function day(o) {
    var st = settings(o), key = [st.seed, st.mode, st.first, st.dox, st.sunday].join(":");
    if (dayCache && dayKey === key) return dayCache;
    var root = window.PJ2.Rand.stream(st.seed >>> 0);
    function opts(d) { var x = { dialect: d }; if (st.mode) x.mode = st.mode; return x; }
    var first = K.Composer.compose(root.fork("hymn:1:1"), opts(st.first));
    var dox = K.Composer.compose(root.fork("hymn:1:3"), opts(st.dox));
    var sun = CAL && CAL.SUNDAYS[st.sunday] ? CAL.SUNDAYS[st.sunday] : null;
    var ward = K.Cast.seat(root.fork("cast:1"), { size: sun ? sun.cast : null });
    dayCache = { st: st, first: first, dox: dox, ward: ward, sunday: st.sunday, kind: CAL ? CAL.kindOf(st.sunday) : st.sunday };
    dayKey = key;
    return dayCache;
  }
  function hallStream(seed) { return window.PJ2.Rand.stream(seed >>> 0).fork(SH.LABEL + 1); }
  function tmStream(seed) { return window.PJ2.Rand.stream(seed >>> 0).fork((TM ? TM.LABEL : "guest:testimony:") + 1); }
  function hallMaterial(o) {
    o = o || {};
    var D = day(o), on = o.on || val("kg3-on", "auto"), hymns = [{ hymn: D.first, section: "hymn" }, { hymn: D.dox, section: "doxology" }];
    if (on === "first") hymns = [hymns[0]]; else if (on === "doxology") hymns = [hymns[1]];
    var piece = o.piece || val("kg3-piece", "auto"), times = +(o.times || val("kg3-times", "auto"));
    return SH.prepare({ hymns: hymns, keynoteHz: D.st.keynote, ward: D.ward, sunday: D.sunday, kind: D.kind,
                        piece: piece === "auto" ? null : piece, times: times === 2 || times === 3 ? times : null }, hallStream(D.st.seed));
  }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o) → { dur, score, expect, stats }
  //   expect: the windows (s, from t) in which a transient is asked for
  // ==========================================================================
  var P = {};
  P.hall = function (ctx, into, t, o) {
    o = o || {};
    var D = day(o), M = hallMaterial(o), sc = SH.score(M, hallStream(D.st.seed), t);
    if (K.VoicesVocal && K.VoicesVocal.budget) K.VoicesVocal.budget.reset();
    var end = SH.perform(ctx, into, t, M, hallStream(D.st.seed), { onNote: o.onNote, defer: o.defer, onStage: o.onStage, onCast: o.onCast });
    var ex = [];
    sc.floor.forEach(function (f) { ex.push([f.t - t, f.t - t + 0.2]); });
    sc.claps.forEach(function (c) { ex.push([c.t - t, c.t - t + (c.dur || 0.15)]); });
    sc.scrapes.forEach(function (s) { ex.push([s.t - t, s.t - t + s.dur + 0.05]); });
    // the bow biting at a chop, a cut; the calls' consonants
    sc.fiddle.forEach(function (ph) { var at0 = ph.t - t; ph.notes.forEach(function (n) { if (n.f && (n.orn === "cut" || ph.stage === "potatoes" || n.acc)) ex.push([at0 + n.at - 0.02, at0 + n.at + 0.05]); }); });
    sc.calls.forEach(function (c) { var tt = c.t - t; c.notes.forEach(function (n) { ex.push([tt - 0.1, tt + 0.06]); tt += n.dur; }); });
    var last = SH.perform.last, bud = K.VoicesVocal && K.VoicesVocal.budget ? K.VoicesVocal.budget.report(t, end + 2) : null;
    return { dur: end - t + 3, score: sc, material: M, expect: ex,
             stats: { fiddle: last && last.folk ? last.folk.stats() : null, floorNodes: last ? last.floorNodes() : 0, slices: last ? last.slices : 0, voicesPeak: bud ? bud.peak : null, voicesMean: bud ? Math.round(bud.mean) : null } };
  };

  // ==========================================================================
  // THE TESTIMONY — the Sunday's bearers (the ward seated above), in the
  // day's mode on the keynote (the engine hands the testimony's own key)
  // ==========================================================================
  var tmNowHost = null;
  function tmMaterial(o) {
    o = o || {};
    var D = day(o), sun = CAL && CAL.SUNDAYS[D.sunday];
    return TM.prepare({ ward: D.ward, keynoteHz: D.st.keynote, mode: D.st.mode || D.dox.mode, sunday: D.sunday,
                        silenceMul: sun && sun.plan && sun.plan.silenceMul || 1 }, tmStream(D.st.seed));
  }
  P.testimony = function (ctx, into, t, o) {
    o = o || {};
    var D = day(o), M = tmMaterial(o), sc = TM.score(M, tmStream(D.st.seed), t);
    if (K.VoicesVocal && K.VoicesVocal.budget) K.VoicesVocal.budget.reset();
    var end = TM.perform(ctx, into, t, M, tmStream(D.st.seed), { onNote: o.onNote, defer: o.defer, onStage: o.onStage, onCast: o.onCast, onAnswer: o.onAnswer });
    var ex = [];
    sc.creaks.forEach(function (c) { ex.push([c.t - t, c.t - t + 0.55]); });
    sc.speakers.forEach(function (sp) { var tt = sp.t - t; sp.notes.forEach(function (n) { ex.push([tt - 0.1, tt + 0.06]); tt += n.dur; }); });
    sc.reeds.forEach(function (r) { var tt = r.t - t; r.notes.forEach(function (n) { ex.push([tt - 0.02, tt + 0.05]); tt += n.dur; }); });
    var last = TM.perform.last, bud = K.VoicesVocal.budget.report(t, end + 2);
    return { dur: end - t + 3, score: sc, material: M, expect: ex,
             stats: { reeds: last.nodes.reeds, room: last.nodes.room, slices: last.slices, voicesPeak: bud.peak, voicesMean: Math.round(bud.mean) } };
  };
  function tmCard() {
    var c = el("section", "kg3-card");
    c.appendChild(el("h2", "kg3-name", "The testimony"));
    c.appendChild(el("p", "kg3-phrase", "Two or three of the ward rise, one at a time, and speak — a speech-melody on their own voice, vowels and soft consonants, no English — and the parlor's harmonium or the deacon's clarinet takes it up: the first sentence played back, the next doubled as it is spoken, the last made into a tune. Each speaker's pace, compass and shape are their own (after Steve Reich's Different Trains)."));
    if (!TM) { c.appendChild(el("p", "kg3-stat", "kolob-testimony.js is not loaded.")); return c; }
    var r = el("div", "kg3-row"), meas = el("p", "kg3-meas", ""), stat = el("p", "kg3-stat", "");
    var play = button("▶ the testimony", "kg3-play", function () { busy(play, GuestsLab3c.play("testimony").then(function (res) { stat.textContent = res.dur.toFixed(1) + " s · laid out at the press in " + res.cost.press.toFixed(1) + " ms, then slice by slice"; })).catch(showErr(stat)); });
    var chk = button("check", "kg3-check", function () { meas.textContent = "rendering…"; busy(chk, check("testimony").then(function (x) { meas.textContent = measLine(x); var s = x.nodes || {}; stat.textContent = "the reeds: " + s.reeds + " nodes built (a line is one voice) · the pews: " + s.room + " · the voices: " + s.voicesPeak + " alive at most, " + s.voicesMean + " on average · " + s.slices + " slices"; })).catch(showErr(meas)); });
    r.appendChild(play); r.appendChild(chk); c.appendChild(r);
    tmNowHost = el("p", "kg3-now", ""); c.appendChild(tmNowHost);
    c.appendChild(meas); c.appendChild(stat);
    var host = el("div"); host.id = "kg3-tm-plan"; c.appendChild(host);
    return c;
  }
  var PART_NAME = { S: "treble", A: "alto", T: "tenor", B: "bass" };
  function tmPlan() {
    var host = document.getElementById("kg3-tm-plan");
    if (!host) return;
    host.textContent = "";
    var M, sc;
    try { M = tmMaterial(); sc = TM.score(M, tmStream(settings().seed), 0); } catch (e) { host.textContent = "error: " + e.message; return; }
    host.appendChild(el("p", "kg3-stat", "the key: " + M.mode + " on " + M.finalHz.toFixed(1) + " Hz · " + M.bearers.length + " rise · " + mmss(sc.end) + " in all · the tunes handed to the motif engine: " + sc.answers.length));
    M.bearers.forEach(function (b) {
      var h = el("p", "kg3-bearer");
      h.appendChild(el("b", null, b.nameEn || "one of the ward"));
      h.appendChild(document.createTextNode(" " + (b.nameDs || "") + " — " + (b.archetypeEn || b.archetype) + " · " + (PART_NAME[b.part] || b.part) + ", " + b.voice.age + " · " + (+b.habit.rate).toFixed(1) + " syllables a second, a compass of " + (+b.habit.range).toFixed(1) + " semitones, " + b.habit.contour + ", pauses of " + (+b.habit.pauses).toFixed(2) + " s · " + b.sentences.length + " sentences (" + b.sentences.map(function (s) { return s.move; }).join(", ") + ") · the " + b.reed));
      host.appendChild(h);
      host.appendChild(plotBearer(M, sc, b));
    });
    host.appendChild(el("p", "kg3-legend", "Each drawing is one bearer's testimony, left to right in time: the thin line is the speech's pitch (carried by whole octaves into the reed's register, so the two can be seen together), the thick marks the reed's notes on the day's just scale (the faint lines) — played back after the first sentence, with the next, and at last as a tune."));
  }
  function plotBearer(M, sc, b) {
    var NS = "http://www.w3.org/2000/svg", W = 900, H = 150, pad = 6;
    var sps = sc.speakers.filter(function (sp) { return sp.k === b.k; }), rds = sc.reeds.filter(function (r) { return r.k === b.k; });
    function stOf(f) { return 12 * Math.log(f / M.finalHz) / Math.LN2; }
    var speech = [], reed = [];
    sps.forEach(function (sp) {
      var tt = sp.t, seg = [];
      sp.notes.forEach(function (n) {
        if (n.rest) { if (seg.length) speech.push(seg); seg = []; tt += n.dur; return; }
        n.glide.forEach(function (g) { seg.push([tt + g[0] * n.dur, stOf(n.f * g[1])]); });
        tt += n.dur;
      });
      if (seg.length) speech.push(seg);
    });
    rds.forEach(function (r) { var tt = r.t; r.notes.forEach(function (n) { reed.push([tt, tt + n.dur, stOf(n.f), r.move]); tt += n.dur; }); });
    function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
    var off = 12 * Math.round((median(reed.map(function (x) { return x[2]; })) - median([].concat.apply([], speech).map(function (p) { return p[1]; }))) / 12);
    var all = reed.map(function (x) { return x[2]; }).concat([].concat.apply([], speech).map(function (p) { return p[1] + off; }));
    var lo = Math.min.apply(null, all) - 2, hi = Math.max.apply(null, all) + 2;
    var t0 = Math.min.apply(null, sps.map(function (s) { return s.t; }).concat(rds.map(function (r) { return r.t; }))), t1 = Math.max.apply(null, reed.map(function (x) { return x[1]; }).concat([].concat.apply([], speech).map(function (p) { return p[0]; })));
    function X(t) { return pad + (W - 2 * pad) * (t - t0) / Math.max(1e-6, t1 - t0); }
    function Yy(s) { return H - pad - (H - 2 * pad) * (s - lo) / Math.max(1e-6, hi - lo); }
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("class", "kg3-plot"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", (b.nameEn || "a bearer") + ": the speech's pitch and the reed's notes");
    function line(x1, y1, x2, y2, stroke, w, op) { var l = document.createElementNS(NS, "line"); l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.setAttribute("stroke", stroke); l.setAttribute("stroke-width", w); if (op) l.setAttribute("opacity", op); svg.appendChild(l); }
    var PF = { ionian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"], mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"], dorian: ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"], aeolian: ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"] };
    var tbl = PF[M.mode] || PF.ionian, cls = { penta: [0, 1, 2, 4, 5], hexa: [0, 1, 2, 3, 4, 5] }[M.mode] || [0, 1, 2, 3, 4, 5, 6];
    for (var d = -21; d <= 35; d++) {
      if (cls.indexOf(mod(d, 7)) < 0) continue;
      var fr = tbl[mod(d, 7)].split("/"), s = 12 * Math.log(fr[0] / fr[1]) / Math.LN2 + 12 * Math.floor(d / 7);
      if (s >= lo && s <= hi) line(pad, Yy(s), W - pad, Yy(s), mod(d, 7) === 0 ? "#8a7a45" : "#1e4d3b", mod(d, 7) === 0 ? 0.8 : 0.4, 0.35);
    }
    speech.forEach(function (seg) {
      var pl = document.createElementNS(NS, "polyline");
      pl.setAttribute("points", seg.map(function (p) { return X(p[0]).toFixed(1) + "," + Yy(p[1] + off).toFixed(1); }).join(" "));
      pl.setAttribute("fill", "none"); pl.setAttribute("stroke", "#1e4d3b"); pl.setAttribute("stroke-width", "1.4");
      svg.appendChild(pl);
    });
    reed.forEach(function (x) { line(X(x[0]), Yy(x[2]), Math.max(X(x[0]) + 2, X(x[1]) - 1.5), Yy(x[2]), x[3] === "tune" ? "#9a4a2a" : "#b8743f", 4, x[3] === "double" ? 0.75 : 0.95); });
    return svg;
  }
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

  // current room chain; the meter sits after it. A room change crossfades.
  // ==========================================================================
  var actx = null, chain = null, irBuf = null, room = "seated", current = null, analyser = null, labIn = null, lights = [], stagesNow = [];
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    labIn = actx.createGain();
    return fetchIR(actx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild(balance) {
    var old = chain, t = actx.currentTime, XF = 0.25;
    chain = buildChain(actx, room, irBuf, analyser, balance != null ? balance : old ? old.balance : 0.5);
    labIn.connect(chain.input);
    if (!old) return;
    chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + XF);
    old.out.gain.setValueAtTime(1, t); old.out.gain.linearRampToValueAtTime(0, t + XF);
    setTimeout(function () { try { labIn.disconnect(old.input); } catch (e) {} try { old.out.disconnect(); } catch (e2) {} }, (XF + 0.15) * 1000);
  }
  function stop() {
    lights = []; stagesNow = [];
    if (!current) return;
    var c = current;
    c.timers.forEach(function (x) { clearTimeout(x); });
    c.gain.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) {} }, 400);
    current = null;
  }
  function play(id, o) {
    o = o || {};
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      // (as seated: the room moves to where this guest sits)
      if (room === "seated" && Math.abs((chain.balance || 0) - balanceFor(id, o)) > 1e-6) rebuild(balanceFor(id, o));
      var g = actx.createGain(); g.connect(labIn);
      lights = []; stagesNow = [];
      // THE LAB'S CLOCK: the guests lay themselves out a slice at a time
      // (hooks.defer), as the engine's clock will have them — each slice on
      // a timer of its own, a little before it sounds; what each costs the
      // main thread is kept (cost())
      var me = { gain: g, id: id, timers: [], cost: { press: 0, slices: [] } };
      var oo = Object.assign({}, o, {
        onNote: function (n) { lights.push(n); },
        onStage: function (st) { stagesNow.push(st); },
        defer: function (at, fn) {
          me.timers.push(setTimeout(function () {
            if (current !== me) return;
            var c0 = performance.now(); fn(); me.cost.slices.push(performance.now() - c0);
          }, Math.max(0, (at - actx.currentTime) * 1000)));
        },
      });
      current = me;
      var c1 = performance.now();
      var res = P[id](actx, g, actx.currentTime + 0.15, oo);
      me.cost.press = performance.now() - c1;
      me.until = actx.currentTime + res.dur;
      res.cost = me.cost;
      return res;
    });
  }
  function setRoom(r) { room = r; if (actx) rebuild(); }
  // the main thread each live performance cost: at the press, and each slice
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
      var ch = buildChain(off, rm, ir, off.destination, balanceFor(id, o));
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

  // ==========================================================================
  // THE CARDS
  // ==========================================================================
  function mmss(s) { s = Math.round(s * 10) / 10; var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function button(txt, cls, fn) { var b = el("button", cls || null, txt); b.type = "button"; b.addEventListener("click", fn); return b; }
  function busy(btn, p) { btn.disabled = true; return p.then(function (x) { btn.disabled = false; return x; }, function (e) { btn.disabled = false; throw e; }); }
  function select(id, label, opts, dflt) {
    var lab = el("label", null, label + " "), s = el("select"); s.id = id;
    opts.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === dflt) op.selected = true; s.appendChild(op); });
    lab.appendChild(s); return lab;
  }
  function table(head, rows) {
    var wrap = el("div", "kg3-scroll"), t = el("table", "kg3-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); }); t.appendChild(tr);
    rows.forEach(function (r) { var r2 = el("tr"); r.forEach(function (c) { r2.appendChild(el("td", null, String(c))); }); t.appendChild(r2); });
    wrap.appendChild(t); return wrap;
  }
  function measLine(r) {
    return "LUFS " + r.lufs + " (loudest 3 s " + r.lufsShortMax + ", " + (r.vsRef >= 0 ? "+" : "") + r.vsRef + " LU against the organ) · peak " + r.peakDb + " dBFS · clipped " + r.clipped + " · clicks " + r.clicks + (r.clicks ? " at " + r.clickTimes.join(", ") + " s" : "") + " · asked-for strokes " + r.strokes + " · " + r.seconds + " s";
  }
  function showErr(host) { return function (e) { host.textContent = "error: " + (e && e.message ? e.message : e); if (window.console) console.warn(e); }; }
  var DIALECTS = [["tabernacle", "Tabernacle"], ["gospel", "gospel"], ["sacredharp", "Sacred Harp"], ["psalmody", "psalmody"], ["shaker", "Shaker"], ["oldway", "the Old Way"]];
  var nowHost = null;
  function hallCard() {
    var c = el("section", "kg3-card");
    c.appendChild(el("h2", "kg3-name", "The Social Hall"));
    c.appendChild(el("p", "kg3-phrase", "After the benediction the benches are pushed back. The fiddler tunes; the caller calls; two bars of the home chord chopped; then a dance made of one of the day's hymns — its first two lines the A strain, its last two (or its refrain) the B — two or three times through, the floor and the hands, the tag, the final ringing the tonic's harmonic seventh (4:7) before its fifth, and applause. It replaces the postlude."));
    var r1 = el("div", "kg3-row");
    r1.appendChild(select("kg3-first", "the first hymn", DIALECTS, "gospel"));
    r1.appendChild(select("kg3-dox", "the doxology", DIALECTS, "tabernacle"));
    r1.appendChild(select("kg3-on", "dance on", [["auto", "as the die says (the doxology likeliest)"], ["first", "the first hymn"], ["doxology", "the doxology"]], "auto"));
    c.appendChild(r1);
    var r2 = el("div", "kg3-row");
    r2.appendChild(select("kg3-piece", "the dance", [["auto", "as drawn"], ["reel", "a reel (2/4)"], ["jig", "a jig (6/8)"], ["quadrille", "a quadrille"]], "auto"));
    r2.appendChild(select("kg3-times", "times through", [["auto", "as the Sunday says"], ["2", "twice"], ["3", "three times"]], "auto"));
    var play = button("▶ dance", "kg3-play", function () { busy(play, GuestsLab3c.play("hall").then(function (res) { hallStat.textContent = res.dur.toFixed(1) + " s · laid out at the press in " + res.cost.press.toFixed(1) + " ms, then slice by slice"; })).catch(showErr(hallStat)); });
    var chk = button("check", "kg3-check", function () { hallMeas.textContent = "rendering…"; busy(chk, check("hall").then(function (r) { hallMeas.textContent = measLine(r); hallStat.textContent = statLine(r.nodes); })).catch(showErr(hallMeas)); });
    r2.appendChild(play); r2.appendChild(chk);
    c.appendChild(r2);
    nowHost = el("p", "kg3-now", ""); c.appendChild(nowHost);
    var hallMeas = el("p", "kg3-meas", ""), hallStat = el("p", "kg3-stat", "");
    c.appendChild(hallMeas); c.appendChild(hallStat);
    var planHost = el("div"); planHost.id = "kg3-hall-plan"; c.appendChild(planHost);
    [r1, r2].forEach(function (r) { r.addEventListener("change", function () { hallPlan(); }); });
    return c;
  }
  function statLine(s) {
    if (!s) return "";
    var f = s.fiddle || {};
    return "the fiddle: " + (f.created || 0) + " nodes built, " + (f.peakLive || 0) + " alive at most · the floor and the hands: " + (s.floorNodes || 0) + " nodes (two an event, each a few tenths of a second) · the voices: " + (s.voicesPeak != null ? s.voicesPeak + " alive at most, " + s.voicesMean + " on average" : "—") + " · " + (s.slices || 0) + " slices";
  }
  function who(p) { return p ? (p.nameEn ? p.nameEn + " (" + (p.nameDs || "") + (p.role ? ", " + p.role : "") + ")" : "one of the ward") : "—"; }
  function hallPlan() {
    var host = document.getElementById("kg3-hall-plan");
    if (!host) return;
    host.textContent = "";
    var M, sc;
    try { M = hallMaterial(); sc = SH.score(M, hallStream(settings().seed), 0); } catch (e) { host.textContent = "error: " + e.message; return; }
    var ppl = M.people, ul = el("ul", "kg3-plan");
    function li(t) { ul.appendChild(el("li", null, t)); }
    li("the dance: a " + M.piece + " in " + M.meter + ", " + Math.round(60 / M.beat) + " beats a minute" + (M.swing > 1.001 ? " (the eighths lilt " + ((M.swing - 1) * 100).toFixed(0) + " %)" : "") + ", AABB " + M.times + " times through — " + mmss(sc.end) + " in all, the dance from " + mmss(sc.tDance));
    li("made of " + M.source);
    li("the fiddler: " + who(ppl.fiddler) + " · the caller: " + who(ppl.caller) + " · whoops from " + (ppl.whoopers || []).map(who).join(", "));
    li("the calls: " + sc.calls.filter(function (c) { return c.who === "caller" && SH.CALLS[c.call]; }).map(function (c) { return SH.CALLS[c.call].en + " (" + mmss(c.t) + ")"; }).join(" · "));
    li("the drone: the tonic at " + sc.registers.drone.toFixed(1) + " Hz, cross-tuned; the A strain " + (sc.registers.A >= 0 ? "+" : "") + sc.registers.A + " and the B " + (sc.registers.B >= 0 ? "+" : "") + sc.registers.B + " octave(s) from the hymn's own register");
    var sept = sc.notes.filter(function (n) { return n.septimal; }), blue = sept.filter(function (n) { return n.orn === "slide"; }).length;
    li("the seventh harmonic: " + sept.length + " septimal notes — " + blue + " blue slides (7/6 → 5/4), " + sept.filter(function (n) { return n.part === "stop"; }).length + " 4:7 double stops (the dominant's at a half cadence, the final's)");
    li("the floor: " + sc.floor.length + " footfalls on the beat (" + sc.floor.filter(function (f) { return f.kind === "stamp"; }).length + " stamps), " + sc.claps.filter(function (c) { return c.kind === "clap"; }).length + " claps on the back-beat, " + sc.scrapes.length + " benches");
    host.appendChild(ul);
    ["A", "B"].forEach(function (S) {
      M.tune[S].forEach(function (ln, i) {
        var p = el("p", "kg3-strain");
        p.appendChild(document.createTextNode(S + (i + 1) + "  "));
        ln.beats.forEach(function (bt, k) {
          bt.forEach(function (e) { p.appendChild(el("span", e.kind === "tune" || e.kind === "cad" ? "h" : null, (e.tie ? "~" : String(e.d) + (e.n8 > 1 ? ":" + e.n8 : "") + (e.cut ? "'" : "")) + " ")); });
          if (k % 2 === 1) p.appendChild(document.createTextNode("| "));
        });
        p.appendChild(document.createTextNode("  (" + ln.kept + " of the line's " + ln.hymnNotes + " notes)"));
        host.appendChild(p);
      });
    });
    host.appendChild(el("p", "kg3-legend", "Degrees from the hymn's final (0 = do, 7 its octave); the hymn's own notes in red; :2, :3 eighths held; ' a cut; ~ tied on; | between the bars; the pickup into what follows is written when the score knows what follows."));
  }

  // ==========================================================================
  // THE ODDS — each plan() over a stand-in for the engine's planner: the
  // calendar's Sundays at their shares, each Sunday's own plan (its hymns,
  // the testimony cut or kept, the second doxology), and the other guests'
  // dice and seats as kolob-meeting.js throws them (the bands, the steeples,
  // the old tune — its pool assumed non-empty four times in five — and the
  // handbells at their measured seats). The harness re-measures on the real
  // planner once the engine seats these.
  // ==========================================================================
  var HYMNS_BY_KIND = { ordinary: 2, fast: 1, conference: 3, jubilee: 3 };
  var HB_W = { christmas: 2.8, easter: 2.4, wedding: 2.4, dedication: 1.4, pioneer: 1.1, funeral: 0.6, fast: 0.4, conference: 1.1, ordinary: 1 };
  function standIn(R) {
    var sunday = CAL.draw(R.next()), S = CAL.SUNDAYS[sunday], kind = S.kind, SP = S.plan || {}, GW = S.guests || {};
    var hymns = SP.hymns || HYMNS_BY_KIND[kind];
    var cut = R.chance(SP.cutTestimony != null ? SP.cutTestimony : 0.25), inter = R.chance(SP.interlude != null ? SP.interlude : 0.15), trade = R.chance(SP.tradeTS != null ? SP.tradeTS : 0.1);
    var d2u = R.next(), dox2 = SP.secondDox != null ? d2u < SP.secondDox : (kind === "jubilee" && d2u < 0.5);
    var secs = ["prelude", "invocation"];
    for (var h = 0; h < hymns; h++) { secs.push("hymn"); if (h === 0 && inter && hymns >= 2) secs.push("interlude"); }
    if (!cut) secs.push("testimony");
    secs.push("sacrament");
    if (trade && !cut) { var a = secs.indexOf("testimony"), b = secs.indexOf("sacrament"); secs[a] = "sacrament"; secs[b] = "testimony"; }
    secs.push("doxology"); if (dox2) secs.push("doxology"); secs.push("postlude");
    var have = {}, guests = [];
    secs.forEach(function (s) { have[s] = true; });
    function seatIn(prefs) { for (var k = 0; k < prefs.length; k++) if (have[prefs[k]]) return prefs[k]; return null; }
    var bD = R.chance(Math.min(0.9, 0.36 * (GW.bands != null ? GW.bands : 1))), bS = R.chance(0.7);
    var sD = R.chance(Math.min(0.9, 0.075 * (GW.steeples != null ? GW.steeples : 1))), sS = R.chance(0.55);
    var oD = R.chance(Math.min(0.9, 0.15 * (GW.oldtune != null ? GW.oldtune : 1))), oS = R.chance(0.65), pool = R.chance(0.8);
    var hD = R.chance(Math.min(0.9, 0.14 * (HB_W[sunday] || 1))), hS = R.next();
    if (bD) { var bs = bS ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]); if (bs) guests.push({ type: "bands", section: bs }); }
    if (sD) guests.push({ type: "steeples", section: sS ? "prelude" : "postlude" });
    if (oD && pool) { var os = oS ? seatIn(["prelude", "testimony"]) : seatIn(["testimony", "interlude", "prelude"]); if (os) guests.push({ type: "oldtune", section: os }); }
    if (hD && !guests.some(function (g) { return g.type === "steeples"; })) guests.push({ type: "handbells", section: hS < 0.38 ? "invocation" : hS < 0.64 ? "sacrament" : "postlude" });
    return { n: 1, kind: kind, sunday: sunday, sections: secs.map(function (t) { return { type: t }; }), guests: guests, bearers: (S.cast && S.cast.testimony) || [2, 3] };
  }
  function odds(N) {
    N = N || 20000;
    var by = {}, tot = { n: 0, hall: 0, tm: 0, testimony: 0 }, why = {};
    CAL.ORDER.forEach(function (s) { by[s] = { n: 0, hall: 0, tm: 0, testimony: 0 }; });
    for (var i = 0; i < N; i++) {
      var R = window.PJ2.Rand.stream(i + 1).fork("odds"), info = standIn(R), row = by[info.sunday];
      var hd = SH.decide(info, window.PJ2.Rand.stream(i + 1).fork(SH.LABEL + 1));
      row.n++; tot.n++;
      if (hd.seat) { row.hall++; tot.hall++; } else why[hd.why.replace(/\(.*\)/, "(…)")] = (why[hd.why.replace(/\(.*\)/, "(…)")] || 0) + 1;
      var hasT = info.sections.some(function (s) { return s.type === "testimony"; });
      if (hasT) { row.testimony++; tot.testimony++; }
      if (TM && TM.plan(info, window.PJ2.Rand.stream(i + 1).fork(TM.LABEL + 1))) { row.tm++; tot.tm++; }
    }
    return { N: N, by: by, tot: tot, why: why };
  }
  function pct(a, b) { return b ? (100 * a / b).toFixed(1) + " %" : "—"; }
  function oddsCard() {
    var c = el("section", "kg3-card");
    c.appendChild(el("h2", "kg3-name", "The odds"));
    c.appendChild(el("p", "kg3-phrase", "Each plan() over 20,000 meetings of a stand-in for the engine's planner: the calendar's Sundays at their shares, each Sunday's own plan and welcome, the other guests' dice and seats."));
    var host = el("div");
    var b = button("run the odds", "kg3-play", function () {
      host.textContent = "counting…";
      setTimeout(function () {
        var o = odds(20000); host.textContent = "";
        var rows = CAL.ORDER.map(function (s) { var r = o.by[s]; return [CAL.SUNDAYS[s].en.toLowerCase(), r.n, pct(r.hall, r.n), pct(r.testimony, r.n), pct(r.tm, r.n), pct(r.tm, r.testimony)]; });
        rows.push(["every Sunday", o.tot.n, pct(o.tot.hall, o.tot.n), pct(o.tot.testimony, o.tot.n), pct(o.tot.tm, o.tot.n), pct(o.tot.tm, o.tot.testimony)]);
        host.appendChild(table(["the Sunday", "meetings", "the Social Hall", "a testimony", "the bearers speak", "…of testimonies"], rows));
        host.appendChild(el("p", "kg3-stat", "the Social Hall refused: " + Object.keys(o.why).map(function (k) { return k + " " + pct(o.why[k], o.N); }).join(" · ")));
      }, 30);
    });
    c.appendChild(b); c.appendChild(host);
    return c;
  }

  // ==========================================================================
  // PURITY — every plan and score twice on the same stream, and Math.random
  // counted while they run
  // ==========================================================================
  function purity() {
    var calls = 0, orig = Math.random, bad = [], n = 0;
    Math.random = function () { calls++; return orig(); };
    try {
      for (var s = 1; s <= 12; s++) {
        var o = { seed: s, sunday: ["pioneer", "wedding", "ordinary", "christmas"][s % 4], first: DIALECTS[s % DIALECTS.length][0], dox: DIALECTS[(s + 2) % DIALECTS.length][0] };
        var D = day(o), hy = [{ hymn: D.first, section: "hymn" }, { hymn: D.dox, section: "doxology" }];
        var m1 = SH.prepare({ hymns: hy, keynoteHz: 262, ward: D.ward, sunday: D.sunday }, hallStream(s)), m2 = SH.prepare({ hymns: hy, keynoteHz: 262, ward: D.ward, sunday: D.sunday }, hallStream(s));
        if (JSON.stringify(m1) !== JSON.stringify(m2)) bad.push("hall prepare " + s);
        if (JSON.stringify(SH.score(m1, hallStream(s), 0)) !== JSON.stringify(SH.score(m2, hallStream(s), 0))) bad.push("hall score " + s);
        var info = standIn(window.PJ2.Rand.stream(s).fork("odds"));
        info.force = true;
        if (JSON.stringify(SH.plan(info, hallStream(s))) !== JSON.stringify(SH.plan(info, hallStream(s)))) bad.push("hall plan " + s);
        ["funeral", "fast"].forEach(function (x) { var i2 = { kind: x === "fast" ? "fast" : "ordinary", sunday: x, sections: info.sections, guests: [], force: true }; if (SH.plan(i2, hallStream(s))) bad.push("hall seated at a " + x + " " + s); });
        if (TM) {
          var tmat = { ward: D.ward, keynoteHz: 262, mode: D.dox.mode, sunday: D.sunday };
          var t1 = TM.prepare(tmat, tmStream(s)), t2 = TM.prepare(tmat, tmStream(s));
          if (JSON.stringify(t1) !== JSON.stringify(t2)) bad.push("testimony prepare " + s);
          if (JSON.stringify(TM.score(t1, tmStream(s), 0)) !== JSON.stringify(TM.score(t2, tmStream(s), 0))) bad.push("testimony score " + s);
          if (JSON.stringify(TM.plan(info, tmStream(s))) !== JSON.stringify(TM.plan(info, tmStream(s)))) bad.push("testimony plan " + s);
        }
        n++;
      }
    } finally { Math.random = orig; }
    return { seeds: n, differences: bad, mathRandom: calls };
  }
  function purityCard() {
    var c = el("section", "kg3-card");
    c.appendChild(el("h2", "kg3-name", "Purity"));
    c.appendChild(el("p", "kg3-phrase", "Twelve Sundays: each plan, preparation and score made twice on the same stream and compared; Math.random counted while they run; the Social Hall asked for, and refused, at a funeral and on a fast Sunday."));
    var out = el("p", "kg3-stat", "");
    var b = button("check purity", "kg3-play", function () { out.textContent = "checking…"; setTimeout(function () { var r = purity(); out.textContent = r.seeds + " Sundays · differences: " + (r.differences.length ? r.differences.join(", ") : "none") + " · Math.random calls: " + r.mathRandom; }, 30); });
    c.appendChild(b); c.appendChild(out);
    return c;
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function hymnLine() {
    var host = document.getElementById("kg3-hymn"), D = day();
    host.textContent = "";
    function add(label, h) { host.appendChild(document.createTextNode(label + " ")); host.appendChild(el("b", null, h.nameEn || h.id)); host.appendChild(document.createTextNode(" (" + h.dialect + ", " + h.mode + ", " + h.meter + ") · ")); }
    add("the first hymn:", D.first); add("the doxology:", D.dox);
    var bearers = (D.ward.roles.testimony || []).map(function (id) { var m = D.ward.byId[id]; return m.nameEn + " (" + m.archetypeEn + ")"; });
    host.appendChild(document.createTextNode("the ward: " + D.ward.members.filter(function (m) { return m.k != null; }).length + " in the pews; rising at the testimony: " + bearers.join("; ")));
  }
  function refresh() {
    try { hymnLine(); } catch (e) { document.getElementById("kg3-hymn").textContent = "error: " + e.message; }
    hallPlan();
    if (TM && typeof tmPlan === "function") tmPlan();
  }
  function tick() {
    var m = meter(), mh = document.getElementById("kg3-meter");
    if (mh) mh.textContent = m ? "out " + (m.peak < -90 ? "—" : m.peak.toFixed(1) + " dBFS") : "out —";
    if (!current || !actx) { if (nowHost && nowHost.textContent && !current) nowHost.textContent = ""; return; }
    var now = actx.currentTime, st = null;
    stagesNow.forEach(function (s) { if (s.t0 <= now && now < s.t1) st = s; });
    var host = current.id === "hall" ? nowHost : (typeof tmNowHost !== "undefined" ? tmNowHost : null);
    if (host) { host.textContent = ""; if (st) { host.appendChild(document.createTextNode("now: ")); host.appendChild(el("em", null, st.label || st.stage)); } }
  }
  function fromURL() {
    var q = new URLSearchParams(location.search);
    [["seed", "kg3-seed"], ["sunday", "kg3-sunday"], ["mode", "kg3-mode"], ["key", "kg3-key"], ["first", "kg3-first"], ["dox", "kg3-dox"], ["on", "kg3-on"], ["piece", "kg3-piece"], ["times", "kg3-times"], ["room", "kg3-room"]].forEach(function (p) {
      var v = q.get(p[0]), e = document.getElementById(p[1]); if (v != null && e) e.value = v;
    });
    if (q.get("room")) room = q.get("room");
  }
  function init() {
    var cards = document.getElementById("kg3-cards");
    cards.appendChild(hallCard());
    if (typeof tmCard === "function") cards.appendChild(tmCard());
    cards.appendChild(oddsCard()); cards.appendChild(purityCard());
    fromURL();
    ["kg3-seed", "kg3-sunday", "kg3-mode", "kg3-key"].forEach(function (id) { document.getElementById(id).addEventListener("change", refresh); });
    document.getElementById("kg3-room").addEventListener("change", function (e) { setRoom(e.target.value); });
    document.getElementById("kg3-compose").addEventListener("click", function () { var s = document.getElementById("kg3-seed"); s.value = (+s.value || 0) + 1; refresh(); });
    document.getElementById("kg3-stop").addEventListener("click", stop);
    refresh();
    setInterval(tick, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return {
    play: play, stop: stop, check: check, render: render, odds: odds, purity: purity, day: day, cost: cost,
    hallMaterial: hallMaterial, standIn: standIn, P: P,
    score: function (id) { var st = settings(); return id === "hall" ? SH.score(hallMaterial(), hallStream(st.seed), 0) : TM ? TM.score(tmMaterial(), tmStream(st.seed), 0) : null; },
  };
})();
