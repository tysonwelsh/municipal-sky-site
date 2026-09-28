// ============================================================================
// ORGANIST LAB — the bench where the Sunday's organist is heard (dev, unlinked)
//
// A composed hymn (KOLOB.Composer), an organist seated for it (KOLOB.Organist:
// the plain organist, the Victorian, the improviser), and what the organist
// makes of it on the pipe organ (KOLOB.VoicesOrgan): the chorale prelude; the
// hymn given out, accompanied under the ward (thirty-two singers,
// KOLOB.VoicesVocal, singing by the organist's own clock), filled between
// the lines, bridged between the verses, and walked to the next hymn's key.
//
// THE LEVEL. Everything goes through the app's master chain (glue → 0.6 →
// tanh → compressor) and a brick-wall limiter, never louder than the app. The
// organ plays into an ORGAN LAYER at the engine's own 0.40 (v0.34: the owner
// found the organ "pretty loud"), and the engine's organ — organChord, copied
// here line for line from kolob-voices-organ.js, at the gains the meeting
// gives it in the prelude and under the singing — plays into the same layer.
// CHECK measures the two against each other (BS.1770, the loudest 3 s).
//
// THE BREATH. The owner heard "a breath, or a brushing sound, in between the
// notes when the hymns are being sung". In the lab's hymns that was the pipe
// organ's chiff, full-strength on every key of every chord. CHECK renders the
// hymn three ways, dry — as the organ plays it now, with the old full chiff
// on every key, and with no chiff at all — and reports how loud the breath is
// against the tone, both ways.
//
// For silent checks: window.OrganistLab = { compose, play, stop, check,
// compare, meeting, findStrange, level, plans }.
// ============================================================================
(function () {
  "use strict";
  var K = window.KOLOB || {};
  var errEl = document.getElementById("kol-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent += msg + "\n"; }
  window.addEventListener("error", function (e) { showErr("JS error: " + e.message + " @ " + String(e.filename || "").split("/").pop() + ":" + e.lineno); });
  var need = { Composer: K.Composer, Dialects: K.Dialects, Score: K.Score, VoicesVocal: K.VoicesVocal, VoicesOrgan: K.VoicesOrgan, Organist: K.Organist, Rand: window.PJ2 && PJ2.Rand };
  var missing = Object.keys(need).filter(function (k) { return !need[k]; });
  if (missing.length) { showErr("missing: " + missing.join(", ")); return; }
  var O = K.Organist, C = K.Composer, V = K.VoicesVocal;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function mmss(x) { var m = Math.floor(x / 60), s = x - 60 * m; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }

  var KEYNOTE_HZ = 261.63;                 // the day's keynote, about middle C (the app's F0 · 4)
  var SR = 48000;
  var ORGAN_LAYER = 0.40;                  // the engine's organ layer (kolob-core.js layerVolumes, v0.34)
  // the ward: hymn-lab's thirty-two, set a little back (hymn-lab's 0.88 put
  // them some 12 dB over the organ at the engine's organ level; the bench is
  // the organist's, so the organ must be heard under them)
  var WARD_LAYER = 0.5;
  var NEXT = [["same", "the same key (no modulation)"], ["2,-1,0,0", "up a just fourth (4/3)"], ["-1,1,0,0", "up a just fifth (3/2)"],
              ["1,-1,0,0", "down a just fifth (2/3)"], ["-2,1,0,0", "down a just fourth (3/4)"], ["4,-1,-1,0", "up a semitone (16/15)"]];
  $("kol-next").innerHTML = NEXT.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + "</option>"; }).join("");
  $("kol-next").value = "2,-1,0,0";

  // ?seed= ?style= ?dialect= ?verses= ?index= ?next= ?ward=0 ?play=prelude|hymn|ref
  var Q = new URLSearchParams(location.search);
  if (Q.get("seed")) $("kol-seed").value = Q.get("seed");
  ["style", "dialect", "verses", "index", "next"].forEach(function (k) { if (Q.get(k) != null && $("kol-" + k)) $("kol-" + k).value = Q.get(k); });
  if (Q.get("ward") === "0") $("kol-ward").checked = false;

  // ==========================================================================
  // THE HYMN AND THE ORGANIST
  // ==========================================================================
  var S = { hymn: null, org: null, pre: null, plan: null, draw: null, seed: 1847 };
  function settings() {
    var nx = $("kol-next").value;
    return { seed: Math.max(1, Math.floor(+$("kol-seed").value) || 1), style: $("kol-style").value || null, dialect: $("kol-dialect").value,
             verses: +$("kol-verses").value, index: +$("kol-index").value, next: nx === "same" ? null : nx.split(",").map(Number) };
  }
  function syncURL(s) {
    var u = new URL(location.href);
    u.searchParams.set("seed", s.seed); u.searchParams.set("dialect", s.dialect); u.searchParams.set("verses", s.verses);
    u.searchParams.set("index", s.index); u.searchParams.set("next", $("kol-next").value);
    if (s.style) u.searchParams.set("style", s.style); else u.searchParams.delete("style");
    history.replaceState(null, "", u);
  }
  // one Sunday: the hymn, the organist seated, the prelude and the hymn planned
  function build(s) {
    var root = PJ2.Rand.stream(s.seed);
    var hymn = C.compose(root.fork("hymn:1:" + (s.index + 1)), { dialect: s.dialect, keyMonzo: [0, 0, 0, 0] });
    var org = O.seat(root.fork("cast:1"), { style: s.style, kind: "ordinary" });
    // a later hymn of the day: the organist has already played the earlier ones
    org.ledger.hymns = s.index;
    var pre = O.prelude(org, hymn, root.fork("cast:1"));
    var plan = O.accompany(org, hymn, root.fork("hymn:1:" + (s.index + 1)), { verses: s.verses, hymnIndex: s.index,
      next: s.next ? { keyMonzo: s.next, mode: hymn.mode } : null });
    var draw = O.preludeDraw(org, root.fork("cast:1"), { hymn: hymn });
    return { hymn: hymn, org: org, pre: pre, plan: plan, draw: draw, seed: s.seed };
  }
  function compose() {
    stop();
    var s = settings();
    syncURL(s);
    var b = build(s);
    S.hymn = b.hymn; S.org = b.org; S.pre = b.pre; S.plan = b.plan; S.draw = b.draw; S.seed = b.seed;
    render();
    ["kol-play-prelude", "kol-play-hymn", "kol-play-ref", "kol-check", "kol-compare", "kol-meeting", "kol-find"].forEach(function (id) { $(id).disabled = false; });
    return b;
  }
  $("kol-compose").addEventListener("click", compose);
  $("kol-another").addEventListener("click", function () { $("kol-seed").value = (Math.floor(+$("kol-seed").value) || 0) + 1; compose(); });

  var ABOUT = {
    plain: "Plays what is printed: four-square, at the chorister's tempo, soft flutes and a quiet pedal. Every repeated note is struck again; every line has its breath; nothing between the lines, and between verses only a breath.",
    victorian: "Suspensions at the cadences and passing notes in the inner voices; the vox humana and its tremulant; the swell breathing under the line, open toward the high note, closed at the close. Now and then one voice holds over and walks into the next line, or the line's end echoes on the echo flute.",
    improviser: "Plays the hymn, mostly. The interludes wander (the first line's head, sequenced over a pedal point); the prelude puts the tune in the pedals under running figures, rarely in two keys at once; and once in a meeting, at most, a fill between the lines strays into a key the hymn never visits, until the ward's next entry drags the organ back.",
  };
  function render() {
    var h = S.hymn, o = S.org, m1 = O.measure(S.pre), m2 = O.measure(S.plan);
    $("kol-who").innerHTML =
      '<h2 class="kol-sec">The Sunday\'s organist</h2>' +
      '<div class="kol-who"><span class="kol-name">' + esc(o.nameDs) + '</span><span class="kol-en">' + esc(o.nameEn) + " · " + esc(O.STYLES[o.style].en) + "</span></div>" +
      '<p class="kol-meta">' + esc(ABOUT[o.style]) + "</p>" +
      '<p class="kol-meta">The hymn: <b>' + esc(h.number + " " + (h.nameEn || "")) + "</b> <span>" + esc(h.nameDs) + "</span> · " + esc(h.meter) + " · " + esc(h.mode) +
      " · " + esc(h.dialect) + (h.hymnist ? " · by " + esc(h.hymnist.nameEn) : "") + " · " + (S.plan.accompanied ? "with the organ" : "<b>no organ in this dialect</b>") + "</p>" +
      '<p class="kol-meta">Habits: tempo ×' + o.habits.tempo.toFixed(2) + (o.style !== "plain" ? " · the swell " + pct(o.habits.swell) : " · the swell never moves") +
      (o.style !== "plain" ? " · fills ×" + o.habits.fill.toFixed(2) : "") + (o.style === "improviser" ? " · wanders " + esc(o.habits.strayName) + " · two keys in the prelude " + pct(o.habits.bitonal) : "") +
      " · plays the prelude on the first hymn about " + pct(o.habits.prelude) + " of Sundays (this Sunday's die: " + (S.draw.play ? "<b>yes</b>" : "no — " + esc(S.draw.why)) + "; the lab plays it anyway).</p>";
    listPlan("prelude", S.pre); listPlan("hymn", S.plan);
    $("kol-cap-prelude").textContent = S.pre.manner + " · " + f1(S.pre.dur) + " s · " + m1.keys + " keys · ornaments " + pct(m1.ornamentShare) + " of keys" + (S.pre.bitonal ? " · two keys at once" : "");
    $("kol-cap-hymn").textContent = f1(S.plan.dur) + " s · " + m2.lines + " lines sung · fills " + m2.fills + " of " + m2.joins + " joins" + (m2.strange ? " (" + m2.strange + " strange)" : "") +
      " · ornaments " + pct(m2.ornamentShare) + " of keys · " + m2.regChanges + " registrations";
    listenNote();
  }
  function listPlan(which, plan) {
    $("kol-plan-" + which).innerHTML = plan.sections.map(function (s, i) {
      return '<li data-i="' + i + '"><span class="tm">' + mmss(s.t) + "</span>" + esc(s.what) + "</li>";
    }).join("") || "<li>—</li>";
  }

  // ==========================================================================
  // THE ROOM — the app's master chain, the organ layer at 0.40, the ward
  // ==========================================================================
  var irBytes = null;
  var irReady = fetch("../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function (b) { irBytes = b; }, function () { irBytes = null; });
  function pouredIR(ctx) {
    var len = Math.floor(ctx.sampleRate * 2.8), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), s = 12345 + c * 999; for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * Math.pow(1 - i / len, 3.2) * 0.5; } }
    return b;
  }
  function irFor(ctx) {
    return irReady.then(function () {
      if (!irBytes) return pouredIR(ctx);
      return ctx.decodeAudioData(irBytes.slice(0)).then(function (b) { return b; }, function () { return pouredIR(ctx); });
    });
  }
  function chain(ctx, ir, dest) {
    var t = 0;
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, t); return g; }
    var organ = G(ORGAN_LAYER), ward = G(WARD_LAYER), hall = G(1);
    organ.connect(hall); ward.connect(hall);
    var dry = G(0.72), wetIn = G(0.75), conv = ctx.createConvolver(), wet = G(0.9 * 0.85);
    conv.buffer = ir;
    hall.connect(dry); hall.connect(wetIn); wetIn.connect(conv); conv.connect(wet);
    var bus = G(1); dry.connect(bus); wet.connect(bus);
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = G(0.6);
    var sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = curve; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
    bus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim); lim.connect(dest || ctx.destination);
    var meter = ctx.createAnalyser(); meter.fftSize = 2048; lim.connect(meter);
    return { organ: organ, ward: ward, out: lim, meter: meter };
  }

  // ==========================================================================
  // THE ENGINE'S ORGAN — organChord (kolob-voices-organ.js), line for line,
  // with the organ layer's default params (stops 0.5, tremulant 0.15, pedal
  // 0.6) and core's env(): the reference the organist is levelled against.
  // In the prelude the meeting calls it with gainMul 0.75 × (0.6 + 0.4 ×
  // intensity), intensity 0.12 → 0.30 (mid: 0.513); under the singing with
  // 0.5 × (0.6 + 0.5 × intensity), intensity 0.28 → 0.62 (mid: 0.41).
  // ==========================================================================
  var REF = { prelude: { gainMul: 0.75 * (0.6 + 0.4 * 0.21), dur: 6, step: 6.4 }, hymn: { gainMul: 0.5 * (0.6 + 0.5 * 0.45), dur: 9, step: 9.4 } };
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, o = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, o); }
  var REF_CHORDS = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];   // I IV V I as [B, T, A, S]
  function env(g, t, pts) { g.gain.setValueAtTime(0, t); var tt = t; for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); } return tt; }
  // fixed: the round-3 request — the tremulant on a gain of its own AFTER the
  // envelope (1 ± 0.015), so it can never sound a chord the envelope has let go
  function organChord(ctx, dest, t, dur, freqs, gainMul, fixed) {
    var stops = 0.5, trem = 0.15, pedal = 0.6;
    var master = ctx.createGain(), tremG = null;
    if (fixed) { tremG = ctx.createGain(); tremG.gain.value = 1; master.connect(tremG); tremG.connect(dest); }
    else master.connect(dest);
    var RANKS = [1, 2, 3, 4], P = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32], nTones = freqs.length;
    for (var v = 0; v < nTones; v++) {
      var f = freqs[v] * 0.5;
      for (var r = 0; r < RANKS.length; r++) {
        var g = P[r] * (1 - stops) + FL[r] * stops;
        if (g < 0.05) continue;
        var pair = r === 0 ? 2 : 1;
        for (var d = 0; d < pair; d++) {
          var o = ctx.createOscillator(); o.type = "sine";
          o.frequency.setValueAtTime(f * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), t);
          var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(nTones) / pair, t);
          o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + 0.3);
        }
      }
    }
    var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, t);
    var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, t); sub.connect(sg); sg.connect(master); sub.start(t); sub.stop(t + dur + 0.3);
    var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, t); lfo.connect(lg); lg.connect(fixed ? tremG.gain : master.gain); lfo.start(t); lfo.stop(t + dur + 0.3);
    var peak = (gainMul || 1) * 0.7, atk = Math.min(2.2, dur * 0.3);
    env(master, t, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
  }
  function playReference(ctx, dest, t, which, fixed) {
    var R = REF[which], n = which === "prelude" ? 4 : 3;
    for (var i = 0; i < n; i++) organChord(ctx, dest, t + i * R.step, R.dur, REF_CHORDS[i].map(function (d) { return deg(KEYNOTE_HZ, d); }), R.gainMul, fixed);
    return (n - 1) * R.step + R.dur + 0.4;
  }

  // ==========================================================================
  // THE WARD — thirty-two people, eight to a part (hymn-lab's, the owner's
  // choice), singing each line by the organist's clock
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function fullWard(seed) {
    var root = PJ2.Rand.stream(seed).fork("fullward"), people = [];
    ["S", "A", "T", "B"].forEach(function (part) {
      for (var k = 0; k < 8; k++) {
        var r = root.fork(part + ":" + k), base = { S: 0.30, A: -0.30, T: 0.45, B: -0.45 }[part] * 0.9;
        people.push({ part: part, k: k, singer: V.singer({
          seed: seed, name: "ward-" + part + k, part: part, age: r.pick(["young", "mid", "mid", "old"]),
          confidence: r.rnd(0.45, 0.9), brightness: r.rnd(0.3, 0.65), breath: r.rnd(0.2, 0.55),
          pitchHabitCents: r.rnd(-12, 12), timingHabitMs: r.rnd(0, 70) + r.rnd(-10, 25), tractScale: r.rnd(0.95, 1.05),
          pan: Math.max(-0.9, Math.min(0.9, base + r.rnd(-0.3, 0.3))) }) });
      }
    });
    return people;
  }
  function assignment(h, person) {
    var p = person.part, k = person.k;
    if (h.dialect === "oldway") return [h.melodyPart, p === "T" || p === "B" ? 0.5 : 1];
    if (h.dialect === "sacredharp") {
      if (p === "S") return k < 6 ? ["S", 1] : ["T", 2];
      if (p === "T") return k < 6 ? ["T", 1] : ["S", 0.5];
      if (p === "A") return h.lines[0].notes.A ? ["A", 1] : (k < 4 ? ["S", 1] : ["T", 2]);
      return ["B", 1];
    }
    return [p, 1];
  }
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 2], ["oo", 1.5], ["eh", 1.5]];
  function toSung(h, evs, t0, oct, vowels) {
    var out = [], t = t0, base = KEYNOTE_HZ * ratio(h.keyMonzo), lastV = "ah";
    evs.forEach(function (e) {
      if (e.t > t + 0.004) out.push({ rest: true, dur: e.t - t });
      if (e.n.syl != null) lastV = vowels[e.n.syl % vowels.length];
      out.push({ f: base * ratio(e.n.monzo) * oct, dur: e.dur, vowel: lastV, stress: e.n.stress, slur: e.n.syl === null });
      t = e.t + e.dur;
    });
    return out;
  }
  // one entry of plan.ward, sung by everyone (at T0 + entry.t)
  function singEntry(ac, dest, h, ward, entry, T0, seed) {
    var lines = O.verseLines(h), line = entry.kind === "amen" ? h.amen : lines[entry.i], next = entry.kind === "amen" ? null : lines[entry.i + 1];
    var vr = PJ2.Rand.stream(seed).fork("vowels:" + entry.verse), vowels = [];
    for (var i = 0; i < 64; i++) vowels.push(vr.pickW(VOWELS));
    if (entry.kind === "amen") vowels = ["ah", "eh"];
    var t0 = T0 + entry.t, g1 = 1 / Math.sqrt(8);
    ward.forEach(function (person) {
      var asg = assignment(h, person);
      var ev = O.lineEvents(h, line, asg[0], t0, entry.beatS, next).ev;
      var sung = toSung(h, ev, t0, asg[1], vowels);
      if (sung.length) person.singer.sing(ac, dest, t0, sung, g1);
    });
  }

  // ==========================================================================
  // PLAYING — a plan laid onto the organ a few seconds ahead (the performer's
  // pump), the ward's lines handed out three seconds before they sound
  // ==========================================================================
  var AC = null, timer = null, ROOM = null;
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (AC) { var a = AC; AC = null; try { a.close(); } catch (e) { /* gone */ } }
    document.querySelectorAll(".kol-plan li.on").forEach(function (li) { li.classList.remove("on"); });
    $("kol-stop").disabled = true;
    $("kol-now").textContent = "";
  }
  $("kol-stop").addEventListener("click", stop);
  function level() {
    if (!AC || !ROOM) return { rms: -120, peak: 0 };
    var a = new Float32Array(ROOM.meter.fftSize); ROOM.meter.getFloatTimeDomainData(a);
    var s2 = 0, pk = 0; for (var i = 0; i < a.length; i++) { s2 += a[i] * a[i]; pk = Math.max(pk, Math.abs(a[i])); }
    return { rms: Math.round(10 * Math.log10(s2 / a.length + 1e-12) * 10) / 10, peak: Math.round(pk * 1000) / 1000, t: AC.currentTime };
  }
  function play(kind) {
    if (!S.plan) compose();
    stop();
    var Ctor = window.AudioContext || window.webkitAudioContext, ac;
    try { ac = AC = new Ctor(); } catch (e) { showErr("no audio: " + e.message); return; }
    $("kol-stop").disabled = false;
    $("kol-now").textContent = "the organist takes the bench…";
    irFor(ac).then(function (ir) {
      if (AC !== ac) return;
      var room = ROOM = chain(ac, ir);
      if (ac.state === "suspended" && ac.resume) ac.resume();
      var T0 = ac.currentTime + 0.8, endAt, plan = null, perf = null, jobs = [], listId = null;
      if (kind === "ref") {
        var d1 = playReference(ac, room.organ, T0, "prelude");
        var d2 = playReference(ac, room.organ, T0 + d1 + 1.5, "hymn");
        endAt = T0 + d1 + 1.5 + d2 + 1.5;
        jobs.push({ at: T0, say: "the engine's organ, as the prelude plays it (four chords)" });
        jobs.push({ at: T0 + d1 + 1.5, say: "the engine's organ, as it swells under the singing (three chords)" });
      } else {
        plan = kind === "prelude" ? S.pre : S.plan; listId = "kol-plan-" + (kind === "prelude" ? "prelude" : "hymn");
        var organ = K.VoicesOrgan.create(ac, room.organ, { gain: O.ORGAN_GAIN, seed: S.seed, t0: T0 - 0.3 });
        perf = O.perform(organ, plan, T0, { keynoteHz: KEYNOTE_HZ });
        endAt = T0 + plan.dur + 1.5;
        if (kind === "hymn" && $("kol-ward").checked) {
          var ward = fullWard(S.seed);
          plan.ward.forEach(function (e) { jobs.push({ at: T0 + e.t, fn: function () { singEntry(ac, room.ward, S.hymn, ward, e, T0, S.seed); } }); });
        }
      }
      var h0 = S.hymn;
      function pump() {
        if (AC !== ac) return;
        var now = ac.currentTime;
        if (perf) perf.pump(now, 3);
        while (jobs.length && jobs[0].at - 3 <= now) { var j = jobs[0]; if (j.fn) { jobs.shift(); j.fn(); } else if (j.at <= now) { jobs.shift(); $("kol-now").textContent = j.say; } else break; }
        if (plan) {
          var tp = now - T0, cur = null;
          plan.sections.forEach(function (s, i) { if (tp >= s.t && tp < s.end) cur = i; });
          document.querySelectorAll("#" + listId + " li").forEach(function (li) { li.classList.toggle("on", +li.getAttribute("data-i") === cur); });
          $("kol-now").textContent = tp < 0 ? "" : cur != null ? plan.sections[cur].what : (tp < plan.dur ? "…" : "");
        }
        if (now > endAt) stop();
      }
      jobs.sort(function (a, b) { return a.at - b.at; });
      pump();
      timer = setInterval(pump, 120);
      void h0;
    });
  }
  $("kol-play-prelude").addEventListener("click", function () { play("prelude"); });
  $("kol-play-hymn").addEventListener("click", function () { play("hymn"); });
  $("kol-play-ref").addEventListener("click", function () { play("ref"); });

  // ==========================================================================
  // OFFLINE RENDERS — the organ alone, through the same layer and room
  // ==========================================================================
  // what: a plan, or "ref:prelude" / "ref:hymn"; o: { dry, chiff, legatoChiff }
  function renderOffline(what, o) {
    o = o || {};
    var refKind = typeof what === "string" ? what.split(":")[1] : null;
    var dur = refKind ? (REF[refKind].step * 3 + REF[refKind].dur + 1) : what.dur + 0.4;
    var off = new OfflineAudioContext(2, Math.ceil((dur + (o.dry ? 0.8 : 3.2)) * SR), SR);
    return irFor(off).then(function (ir) {
      var into = o.dry ? off.destination : chain(off, ir).organ;
      if (refKind) playReference(off, into, 0.2, refKind, /:fixed$/.test(what));
      else {
        var organ = K.VoicesOrgan.create(off, into, { gain: O.ORGAN_GAIN * (o.dry ? ORGAN_LAYER : 1), seed: S.seed, t0: 0, chiff: o.chiff, legatoChiff: o.legatoChiff });
        O.perform(organ, what, 0.2, { keynoteHz: KEYNOTE_HZ }).pump(0, 1e9);
      }
      return off.startRendering();
    });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
  // loudness, BS.1770-4 (K-weighting at 48 kHz, 400 ms blocks at 75 %,
  // gated at −70 LUFS and −10 LU), and the loudest 3-second window
  function biquad(x, b, a) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) { var v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  }
  function kWeight(x) {
    var s1 = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
    return biquad(s1, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  }
  function highpass(x, hz) {
    var w = Math.tan(Math.PI * hz / SR), q = Math.SQRT1_2, nn = 1 / (1 + w / q + w * w);
    var bb = [nn, -2 * nn, nn], aa = [1, 2 * (w * w - 1) * nn, (1 - w / q + w * w) * nn];
    return biquad(biquad(x, bb, aa), bb, aa);
  }
  function loudness(chs) {
    var k = chs.map(kWeight), n = k[0].length, sq = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) { var e = 0; for (var c = 0; c < k.length; c++) e += k[c][i] * k[c][i]; sq[i + 1] = sq[i] + e; }
    function L(s, len) { return -0.691 + 10 * Math.log10((sq[s + len] - sq[s]) / len + 1e-20); }
    var B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), S3 = Math.round(3 * SR), blocks = [];
    for (var s = 0; s + B <= n; s += H) blocks.push(L(s, B));
    var abs = blocks.filter(function (l) { return l > -70; });
    function meanL(ls) { var m = 0; ls.forEach(function (l) { m += Math.pow(10, (l + 0.691) / 10); }); return -0.691 + 10 * Math.log10(m / Math.max(1, ls.length) + 1e-20); }
    var gate = meanL(abs) - 10, I = meanL(abs.filter(function (l) { return l > gate; })), sMax = -Infinity;
    for (var s3 = 0; s3 + S3 <= n; s3 += H) sMax = Math.max(sMax, L(s3, S3));
    return { I: abs.length ? I : -Infinity, S: isFinite(sMax) ? sMax : L(0, n) };
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
  // what a critic measures: loudness, peak, clicks, the spectrum in five bands
  function analyse(buf, keepSpec) {
    var Lc = buf.getChannelData(0), Rc = buf.getChannelData(1), n = Lc.length, mono = new Float32Array(n), pk = 0;
    for (var i = 0; i < n; i++) { mono[i] = (Lc[i] + Rc[i]) * 0.5; pk = Math.max(pk, Math.abs(Lc[i]), Math.abs(Rc[i])); }
    var lu = loudness([Lc, Rc]);
    // CLICKS (the instruments lab's detector): 1 ms blocks above 4 kHz; a
    // click is a block ≥ 12× (21.6 dB) over the loudest block of the 30 ms
    // on EACH side, above a −100 dBFS floor
    var hp = highpass(mono, 4000), H = 48, hf = [];
    for (var kk = 0; kk + H <= n; kk += H) { var e2 = 0; for (var q = kk; q < kk + H; q++) e2 += hp[q] * hp[q]; hf.push(Math.sqrt(e2 / H)); }
    var clicks = [];
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = 0;
      for (var y = z - 30; y < z - 2; y++) ref = Math.max(ref, hf[y]);
      for (y = z + 3; y < z + 30; y++) ref = Math.max(ref, hf[y]);
      if (hf[z] > ref * 12) clicks.push({ t: +(z * H / SR).toFixed(3), db: +db(hf[z]).toFixed(1), over: +db(hf[z] / (ref + 1e-20)).toFixed(1) });
    }
    var N = 4096, bands = [0, 0, 0, 0, 0], cn = 0, cd = 0, win = new Float32Array(N), re = new Float32Array(N), im = new Float32Array(N), spec = [];
    for (var w = 0; w < N; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / N);
    for (var st = 0; st + N <= n; st += N / 2) {
      for (var u = 0; u < N; u++) { re[u] = mono[st + u] * win[u]; im[u] = 0; }
      fft(re, im);
      var col = keepSpec ? new Float32Array(N / 2) : null;
      for (var bin = 1; bin < N / 2; bin++) {
        var pw = re[bin] * re[bin] + im[bin] * im[bin], hz = bin * SR / N;
        if (col) col[bin] = pw;
        bands[hz < 120 ? 0 : hz < 500 ? 1 : hz < 2000 ? 2 : hz < 6000 ? 3 : 4] += pw; cn += pw * hz; cd += pw;
      }
      if (col) spec.push(col);
    }
    var tot = bands.reduce(function (a, b) { return a + b; }, 0) || 1;
    return { lufs: +lu.I.toFixed(1), loud3: +lu.S.toFixed(1), peakDb: +db(pk).toFixed(1), clicks: clicks, centroid: Math.round(cn / (cd || 1)),
             bands: bands.map(function (b) { return +(100 * b / tot).toFixed(1); }), seconds: +(n / SR).toFixed(1), spec: spec, N: N };
  }
  // THE BREATH: the organ dry, three ways; the chiff is what the first two
  // have that the third lacks (the dice are thrown alike, so the difference
  // is exact). → breath against tone (dB), overall and above 1.5 kHz
  function breath(plan) {
    // "was": the round-2 voicing — the chiff at its old level (1.0), full on every key
    var old = K.VoicesOrgan.CHIFF ? 1 / K.VoicesOrgan.CHIFF.level : 1;
    return Promise.all([renderOffline(plan, { dry: true }), renderOffline(plan, { dry: true, chiff: old, legatoChiff: 1 }), renderOffline(plan, { dry: true, chiff: 0 })]).then(function (b) {
      function mono(buf) { var L = buf.getChannelData(0), R = buf.getChannelData(1), m = new Float32Array(L.length); for (var i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) * 0.5; return m; }
      var A = mono(b[0]), B = mono(b[1]), Z = mono(b[2]);
      function diff(X) { var d = new Float32Array(X.length); for (var i = 0; i < X.length; i++) d[i] = X[i] - Z[i]; return d; }
      function E(x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * x[i]; return s; }
      var cA = diff(A), cB = diff(B), zh = highpass(Z, 1500);
      return {
        now: +(10 * Math.log10(E(cA) / E(Z))).toFixed(1), was: +(10 * Math.log10(E(cB) / E(Z))).toFixed(1),
        nowHi: +(10 * Math.log10(E(highpass(cA, 1500)) / E(zh))).toFixed(1), wasHi: +(10 * Math.log10(E(highpass(cB, 1500)) / E(zh))).toFixed(1),
      };
    });
  }

  // ==========================================================================
  // CHECK
  // ==========================================================================
  var lastCheck = null;
  function check() {
    if (!S.plan) compose();
    var out = $("kol-checkout"); out.innerHTML = '<p class="kol-cap">rendering the organ alone, and the engine\'s organ…</p>';
    var jobs = [renderOffline(S.pre), renderOffline("ref:prelude"), renderOffline("ref:hymn"), renderOffline("ref:prelude:fixed")];
    if (S.plan.accompanied) jobs.push(renderOffline(S.plan));
    return Promise.all(jobs).then(function (bufs) {
      var a = bufs.map(function (b, i) { return analyse(b, i === 4); });
      var res = { prelude: a[0], refPrelude: a[1], refHymn: a[2], refFixed: a[3], hymn: a[4] || null };
      res.deltaPrelude = +(a[0].loud3 - a[1].loud3).toFixed(1);
      res.deltaHymn = a[4] ? +(a[4].loud3 - a[2].loud3).toFixed(1) : null;
      return (S.plan.accompanied ? breath(S.plan) : Promise.resolve(null)).then(function (br) {
        res.breath = br; lastCheck = res;
        paintCheck(res);
        return strip(res);
      });
    }).catch(function (e) { showErr("check: " + (e && e.stack || e)); throw e; });
  }
  function strip(res) {
    var o = {};
    for (var k in res) {
      var v = res[k];
      if (v && typeof v === "object" && v.spec) { var c = {}; for (var q in v) if (q !== "spec" && q !== "N") c[q] = v[q]; c.clicks = v.clicks.length; c.firstClicks = v.clicks.slice(0, 4); o[k] = c; }
      else o[k] = v;
    }
    return o;
  }
  function inBand(d) { return d != null && Math.abs(d) <= 2 ? "in" : "out"; }
  function paintCheck(r) {
    var rows = [["this organist's prelude", r.prelude, r.deltaPrelude, "the engine's organ in the prelude"],
                ["this organist's hymn (organ alone)", r.hymn, r.deltaHymn, "the engine's organ under the singing"],
                ["the engine's organ, prelude", r.refPrelude, null, ""], ["the engine's organ, under the singing", r.refHymn, null, ""],
                ["the engine's organ, prelude, its tremulant fixed (the request)", r.refFixed, null, ""]];
    var html = '<table class="kol-table wide"><tr><th>render</th><th>loudest 3 s (LUFS)</th><th>against the engine</th><th>integrated</th><th>peak</th><th>clicks</th><th>centroid</th><th>bands: sub / low / mid / presence / air</th></tr>' +
      rows.filter(function (x) { return x[1]; }).map(function (x) {
        var a = x[1];
        return "<tr><td>" + esc(x[0]) + '</td><td class="num">' + f1(a.loud3) + '</td><td class="num ' + (x[2] == null ? "" : inBand(x[2])) + '">' +
          (x[2] == null ? "—" : (x[2] > 0 ? "+" : "") + f1(x[2]) + " LU vs " + esc(x[3])) + '</td><td class="num">' + f1(a.lufs) + '</td><td class="num">' + f1(a.peakDb) + " dBFS</td>" +
          '<td class="num ' + (a.clicks.length ? "out" : "in") + '">' + a.clicks.length + '</td><td class="num">' + a.centroid + ' Hz</td><td class="num">' + a.bands.join(" / ") + "</td></tr>";
      }).join("") + "</table>";
    if (r.breath) html += '<p class="kol-note" style="margin-top:0.6rem">The breath between the notes (the chiff, against the tone, the hymn dry): <b>' + f1(r.breath.now) + " dB</b> overall and <b>" +
      f1(r.breath.nowHi) + " dB</b> above 1.5 kHz, now. With the chiff as the round-2 organ spoke it (its old level, full on every key): " + f1(r.breath.was) + " dB and " + f1(r.breath.wasHi) + " dB.</p>" +
      (r.refPrelude.clicks.length ? '<p class="kol-cap">The engine\'s organ clicks at its chords\' ends (' + r.refPrelude.clicks.map(function (c) { return c.t + " s"; }).join(", ") + '): its tremulant rides the chord after the envelope has let go, then the pipes stop dead. With the one-line fix: ' + r.refFixed.clicks.length + " clicks.</p>" : "");
    if (!r.hymn) html += '<p class="kol-cap">This dialect is sung without the organ: there is no hymn for the organ to measure.</p>';
    $("kol-checkout").innerHTML = html;
    if (r.hymn) drawSpec($("kol-spec"), r.hymn);
  }
  function drawSpec(canvas, res) {
    canvas.hidden = false;
    var spec = res.spec, N = res.N, W = canvas.width, Hh = canvas.height, c2 = canvas.getContext("2d"), img = c2.createImageData(W, Hh), mx = 0;
    spec.forEach(function (col) { for (var b = 1; b < col.length; b++) if (col[b] > mx) mx = col[b]; });
    for (var x = 0; x < W; x++) {
      var col2 = spec[Math.min(spec.length - 1, Math.floor(x / W * spec.length))];
      for (var y = 0; y < Hh; y++) {
        var hz = 60 * Math.pow(200, 1 - y / (Hh - 1)), bin = Math.max(1, Math.min(N / 2 - 1, Math.round(hz * N / SR)));
        var a = Math.max(0, Math.min(1, (10 * Math.log10((col2[bin] + 1e-20) / mx) + 70) / 70)), p = (y * W + x) * 4;
        img.data[p] = 245 - a * 215; img.data[p + 1] = 240 - a * 163; img.data[p + 2] = 228 - a * 169; img.data[p + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
  }
  $("kol-check").addEventListener("click", function () { check(); });

  // ==========================================================================
  // COMPARE — the three organists on the same hymn
  // ==========================================================================
  function compare() {
    if (!S.plan) compose();
    var s = settings(), out = $("kol-compareout");
    out.innerHTML = '<p class="kol-cap">planning and rendering three organists…</p>';
    var styles = ["plain", "victorian", "improviser"], rows = [];
    var chainP = Promise.resolve();
    styles.forEach(function (st) {
      chainP = chainP.then(function () {
        var b = build({ seed: s.seed, style: st, dialect: s.dialect, verses: s.verses, index: s.index, next: s.next });
        var mp = O.measure(b.pre), mh = O.measure(b.plan);
        return Promise.all([renderOffline(b.pre), b.plan.accompanied ? renderOffline(b.plan) : Promise.resolve(null)]).then(function (bufs) {
          rows.push({ style: st, name: b.org.nameEn, manner: b.pre.manner, pre: mp, hymn: mh, aPre: analyse(bufs[0]), aHymn: bufs[1] ? analyse(bufs[1]) : null, fills: b.plan.fills });
        });
      });
    });
    return chainP.then(function () {
      function regs(m) { return Object.keys(m.registrations).sort(function (a, b) { return m.registrations[b] - m.registrations[a]; }).slice(0, 3).join(", "); }
      out.innerHTML = '<table class="kol-table wide"><tr><th>organist</th><th>the prelude</th><th>fills (of the joins)</th><th>ornaments</th><th>stops drawn most (hymn)</th><th>prelude: loudest 3 s · centroid · bands</th><th>hymn: loudest 3 s · centroid · bands</th></tr>' +
        rows.map(function (r) {
          return "<tr><td>" + esc(O.STYLES[r.style].en) + "<br><small>" + esc(r.name) + "</small></td><td>" + esc(r.manner) + "<br><small>" + f1(r.pre.seconds) + " s</small></td>" +
            '<td class="num">' + r.hymn.fills + " of " + r.hymn.joins + " (" + pct(r.hymn.fillRate) + ")" + (r.hymn.strange ? ", " + r.hymn.strange + " strange" : "") + "<br><small>" + esc(r.fills.map(function (f) { return f.kind; }).join(", ")) + "</small></td>" +
            '<td class="num">prelude ' + pct(r.pre.ornamentShare) + " of keys<br>hymn " + pct(r.hymn.ornamentShare) + " · " + r.hymn.ornamentsPerLine.toFixed(2) + "/line</td><td>" + esc(regs(r.hymn)) + "</td>" +
            '<td class="num">' + f1(r.aPre.loud3) + " · " + r.aPre.centroid + " Hz · " + r.aPre.bands.join("/") + "</td>" +
            '<td class="num">' + (r.aHymn ? f1(r.aHymn.loud3) + " · " + r.aHymn.centroid + " Hz · " + r.aHymn.bands.join("/") : "no organ") + "</td></tr>";
        }).join("") + "</table>";
      return rows.map(function (r) { return { style: r.style, manner: r.manner, pre: r.pre, hymn: r.hymn, aPre: stripA(r.aPre), aHymn: r.aHymn ? stripA(r.aHymn) : null }; });
    }).catch(function (e) { showErr("compare: " + (e && e.stack || e)); throw e; });
  }
  function stripA(a) { return { loud3: a.loud3, lufs: a.lufs, centroid: a.centroid, bands: a.bands, clicks: a.clicks.length, peakDb: a.peakDb }; }
  $("kol-compare").addEventListener("click", function () { compare(); });

  // ==========================================================================
  // A MEETING'S WORTH — one organist, four hymns, the ledger
  // ==========================================================================
  function meeting(seed, style) {
    var s = settings(); seed = seed || s.seed; style = style === undefined ? s.style : style;
    var root = PJ2.Rand.stream(seed), org = O.seat(root.fork("cast:1"), { style: style, kind: "ordinary" });
    var dialects = ["tabernacle", "sacredharp", "tabernacle", "tabernacle"], keys = [[0, 0, 0, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, 0, 0, 0]];
    var hymns = dialects.map(function (d, i) { return C.compose(root.fork("hymn:1:" + (i + 1)), { dialect: d, keyMonzo: keys[i] }); });
    var rows = hymns.map(function (h, i) {
      var nx = hymns[i + 1];
      var plan = O.accompany(org, h, root.fork("hymn:1:" + (i + 1)), { verses: 3, hymnIndex: i, next: nx ? { keyMonzo: nx.keyMonzo, mode: nx.mode } : null });
      var m = O.measure(plan);
      return { hymn: h.number + " " + (h.nameEn || ""), dialect: h.dialect, accompanied: plan.accompanied, fills: m.fills, joins: m.joins, strange: m.strange,
               kinds: plan.fills.map(function (f) { return "v" + (f.verse + 1) + "·l" + (f.after + 1) + " " + f.kind; }), keys: m.keys, modulation: plan.modulation || null };
    });
    return { seed: seed, organist: org.nameEn + " (" + org.style + ")", ledger: org.ledger, rows: rows };
  }
  function paintMeeting(r) {
    $("kol-meetingout").innerHTML = '<p class="kol-cap">' + esc(r.organist) + " · seed " + r.seed + " · the meeting's ledger: " + r.ledger.fills + " fills, " + r.ledger.strange + " strange (at most one)</p>" +
      '<table class="kol-table wide"><tr><th>hymn</th><th>dialect</th><th>organ</th><th>fills</th><th>where, and what</th><th>then</th></tr>' +
      r.rows.map(function (x) {
        return "<tr><td>" + esc(x.hymn) + "</td><td>" + esc(x.dialect) + "</td><td>" + (x.accompanied ? "yes" : "<b>none</b> (" + x.keys + " keys)") + '</td><td class="num">' + x.fills + " of " + x.joins +
          (x.strange ? ' <b class="out">· strange</b>' : "") + "</td><td><small>" + esc(x.kinds.join("; ")) + "</small></td><td><small>" +
          esc(x.modulation ? "to the next key by " + (x.modulation.pivot || "V7") + (x.modulation.common ? ", common tone held" : "") : "—") + "</small></td></tr>";
      }).join("") + "</table>";
  }
  $("kol-meeting").addEventListener("click", function () { paintMeeting(meeting()); });
  // find the next seed whose improviser strays: three verses, the third hymn of the day
  function findStrange() {
    var s = settings();
    for (var k = 1; k <= 300; k++) {
      var seed = s.seed + k;
      var b = build({ seed: seed, style: "improviser", dialect: "tabernacle", verses: 3, index: 2, next: s.next });
      if (b.plan.counts.strange > 0) {
        $("kol-seed").value = seed; $("kol-style").value = "improviser"; $("kol-dialect").value = "tabernacle"; $("kol-verses").value = "3"; $("kol-index").value = "2";
        compose();
        var f = S.plan.fills.filter(function (x) { return x.strange; })[0];
        $("kol-meetingout").innerHTML = '<p class="kol-cap">seed ' + seed + ": the strange fill is after verse " + (f.verse + 1) + ", line " + (f.after + 1) + ", at " + mmss(f.t) + " into the hymn — press ▶ The hymn.</p>";
        return { seed: seed, at: f.t, verse: f.verse, after: f.after };
      }
    }
    return null;
  }
  $("kol-find").addEventListener("click", findStrange);

  // ==========================================================================
  // WHAT TO LISTEN FOR — in plain words
  // ==========================================================================
  var LISTEN = {
    plain: "<b>The plain organist.</b> In the prelude: the hymn played straight through on soft flutes (a short hymn twice, the second time softer), a small hold on the last chord. In the hymn: the last line given out on the flutes, then the four parts under the ward exactly as printed, every repeated note struck again; nothing at all between the lines; between verses a single breath.",
    victorian: "<b>The Victorian.</b> In the prelude: the tune on the vox humana (it trembles) over flutes, or on the trumpet, or the swell opening and closing on the principal; at every line's close an inner voice hangs on over the new chord and falls a step late (a suspension), and passing notes walk the tenor. In the hymn: the tune given out broadly, the swell breathing with each line, a quiet contemplative verse on the vox, the last verse on the full organ; now and then, between lines, the tenor walks into the next line or the line's end echoes high on the echo flute; between verses the close again, softly.",
    improviser: "<b>The improviser.</b> In the prelude: flutes running in steady notes; then the hymn tune enters deep in the pedals in long notes, under the figures, line by line (on some Sundays the flutes run in a different key the whole time the tune walks home in its own); an open chord with an added note to end. In the hymn: the interludes take the first line's opening and climb it in steps over a held bass; between lines, now and then, a quick quote of the next line or a little turn; and once a meeting, at most, a fill that lands in the wrong key — a chord and a figure somewhere strange — until the ward comes in and the organ is back with them.",
  };
  function listenNote() {
    var st = S.org.style;
    $("kol-listen").innerHTML = '<h2 class="kol-sec">What to listen for</h2><p>' + LISTEN[st] + "</p>" +
      "<p>Try the three organists on the same seed (the organist menu): the same hymn, three Sundays. The engine's organ button plays the organ the meeting has now, at the level it has now; the organist sits at that level (Check measures it).</p>" +
      (S.plan.accompanied ? "" : "<p><b>This hymn's dialect is sung without the organ</b>: the organist sits, there is no giving out and nothing between the lines; the ward sings alone.</p>");
  }

  // ==========================================================================
  // THE REGISTRATIONS, LEVELLED — every registration the organists draw,
  // playing the same two lines of this hymn at one swell (0.62), organ alone
  // through the organ layer: the loudest 3 s, and where the sound sits. (The
  // organist's REG_TRIM table is read from this; the critic can re-read it.)
  // ==========================================================================
  function registrations(untrimmed) {
    if (!S.plan) compose();
    var h = S.hymn, lines = O.verseLines(h), notes = [], t = 0;
    for (var i = 0; i < 2 && i < lines.length; i++) {
      ["S", "A", "T", "B"].forEach(function (p) {
        O.lineEvents(h, lines[i], p, t, h.beatS, lines[i + 1]).ev.forEach(function (e) {
          var m = [h.keyMonzo[0] + e.n.monzo[0], h.keyMonzo[1] + e.n.monzo[1], h.keyMonzo[2] + e.n.monzo[2], (h.keyMonzo[3] || 0) + (e.n.monzo[3] || 0)];
          notes.push({ at: e.t, dur: e.dur, m: m, part: p, v: { S: 1, A: 0.8, T: 0.8, B: 0.9 }[p], pedal: p === "B" });
        });
      });
      t = O.lineEvents(h, lines[i], "S", t, h.beatS, lines[i + 1]).end;
    }
    var names = Object.keys(O.REG), rows = [], seq = Promise.resolve();
    names.forEach(function (name) {
      seq = seq.then(function () {
        var plan = { dur: t + 0.6, phrases: [{ t: 0, reg: name, texture: 4, notes: notes, report: [], trim: untrimmed ? 0 : undefined }], swell: [{ t: 0, e: 0.62, ramp: 0.05 }], events: [] };
        return renderOffline(plan).then(function (b) { var a = analyse(b); rows.push({ reg: name, loud3: a.loud3, lufs: a.lufs, centroid: a.centroid, bands: a.bands, clicks: a.clicks.length }); });
      });
    });
    return seq.then(function () { return rows; });
  }

  // the page's handles, for the silent checks (tools, the critic)
  window.OrganistLab = {
    compose: compose, play: play, stop: stop, check: check, compare: compare, meeting: meeting, findStrange: findStrange, level: level, registrations: registrations,
    plans: function () { return { prelude: S.pre, hymn: S.plan, organist: S.org, hymn_: S.hymn }; },
    measure: function () { return { prelude: O.measure(S.pre), hymn: O.measure(S.plan) }; },
    lastCheck: function () { return lastCheck ? strip(lastCheck) : null; },
    // any plan (or "ref:prelude"), rendered offline and measured: for critics
    analysePlan: function (plan, o) { return renderOffline(plan, o).then(function (b) { return stripA(Object.assign(analyse(b), {})) && (function (a) { var c = stripA(a); c.clickTimes = a.clicks.slice(0, 8); return c; })(analyse(b)); }); },
  };
  compose();
  if (Q.get("play")) play(Q.get("play"));
})();
