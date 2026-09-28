// ============================================================================
// CAST LAB (dev only; see cast-lab.php) — the Sunday's ward, and a hymn sung
// by it.
//
// Seat:    KOLOB.Cast.seat(stream "cast:1") — the ward, its people.
// Compose: KOLOB.Composer.compose(stream "hymn:1:1", {dialect, mode}).
// Plan:    KOLOB.Cast.planHymn(ward, hymn, "hymn:1:1" → "performance") — the
//          keying or the pitching, a practice per verse, who comes forward.
// Score:   KOLOB.Cast.score(...) — every singer's line in seconds.
// Sing:    KOLOB.Cast.performer(ward, {V, synth "synth:vocal"}) — a pump
//          hands each line to its singer a few seconds before it sounds (so a
//          long hymn never builds its whole graph at once, and Stop is
//          instant); the organ (KOLOB.VoicesOrgan) under the Tabernacle.
// Watch:   the seating chart lights whoever is singing and rings whoever is
//          forward; the log prints the typed events as they happen.
// Bench:   offline renders (the join meter, clicks, level, nodes, speed) and
//          the phone test (real time, with the whole meeting underneath in
//          the same audio context).
// ============================================================================
(function () {
  "use strict";
  var K = window.KOLOB || {};
  var errEl = document.getElementById("kcl-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent += msg + "\n"; }
  window.addEventListener("error", function (e) { showErr("JS error: " + e.message + " @ " + String(e.filename || "").split("/").pop() + ":" + e.lineno); });
  var need = { Cast: K.Cast, Composer: K.Composer, Dialects: K.Dialects, Score: K.Score, VoicesVocal: K.VoicesVocal, VoicesOrgan: K.VoicesOrgan, Rand: window.PJ2 && PJ2.Rand };
  for (var nm in need) if (!need[nm]) { showErr(nm + " did not load."); return; }
  var Cast = K.Cast, C = K.Composer, D = K.Dialects, V = K.VoicesVocal;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function mmss(t) { t = Math.max(0, t); var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }

  // ==========================================================================
  // THE CONTROLS
  // ==========================================================================
  var MODES = [["", "any (the dialect draws)"], ["ionian", "ionian (major)"], ["mixolydian", "mixolydian"], ["dorian", "dorian"], ["aeolian", "aeolian (minor)"], ["penta", "pentatonic"], ["hexa", "hexatonic"]];
  $("kcl-mode").innerHTML = MODES.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + "</option>"; }).join("");
  var Q = new URLSearchParams(location.search);
  if (Q.get("seed")) $("kcl-seed").value = Q.get("seed");
  ["dialect", "mode", "verses"].forEach(function (k) { if (Q.get(k) != null) $("kcl-" + k).value = Q.get(k); });
  if (Q.get("organ") === "0") $("kcl-organ").checked = false;
  if (Q.get("first") === "0") $("kcl-first").checked = false;
  function settings() {
    return {
      seed: Math.max(1, Math.floor(+$("kcl-seed").value || 1)), dialect: $("kcl-dialect").value, mode: $("kcl-mode").value || undefined,
      verses: $("kcl-verses").value ? +$("kcl-verses").value : undefined, organ: $("kcl-organ").checked, first: $("kcl-first").checked,
    };
  }
  function syncURL(s) {
    try {
      var u = new URLSearchParams();
      u.set("seed", s.seed); u.set("dialect", s.dialect);
      if (s.mode) u.set("mode", s.mode); if (s.verses) u.set("verses", s.verses);
      if (!s.organ) u.set("organ", "0"); if (!s.first) u.set("first", "0");
      history.replaceState(null, "", location.pathname + "?" + u.toString());
    } catch (e) { /* a sandboxed page keeps its address */ }
  }

  var KEYNOTE_HZ = 261.63, GIVE_OUT = 2.8;
  // how far ahead of its first sound a handed line (and each of its mouths)
  // joins the room — the voices' ARMING. Five of this page's pump intervals
  // (120 ms): a pump stalled for half a second still joins every mouth in
  // time. (A page playing sound is not timer-throttled in the background;
  // a caller whose pump can stall longer should lead by more — a longer
  // lead costs a little audio time, never sound.)
  var ARM_LEAD = 0.6;
  var S = null;    // { s, ward, hymn, plan, sheet }

  // ==========================================================================
  // BUILD — seat, compose, plan, score; then draw
  // ==========================================================================
  function build() {
    stop();
    var s = settings();
    try {
      var root = PJ2.Rand.stream(s.seed);
      var ward = Cast.seat(root.fork("cast:1"));
      var hymn = C.compose(root.fork("hymn:1:1"), { dialect: s.dialect, mode: s.mode, id: "h:1:1" });
      var organ = s.organ && !!D.get(hymn.dialect).organ;
      var plan = Cast.planHymn(ward, hymn, root.fork("hymn:1:1").fork("performance"), { verses: s.verses, organ: organ, first: s.first });
      var sheet = Cast.score(ward, hymn, plan, { stream: root.fork("hymn:1:1").fork("performance"), keynoteHz: KEYNOTE_HZ });
      S = { s: s, ward: ward, hymn: hymn, plan: plan, sheet: sheet };
    } catch (e) { showErr("build failed: " + (e && e.stack || e)); return; }
    syncURL(s);
    drawBoard(); drawChart(); drawPeople(); drawLog();
    $("kcl-playbtn").disabled = false; $("kcl-measure").disabled = false; $("kcl-stress").disabled = false; $("kcl-headroom").disabled = false;
    $("kcl-organ").disabled = !D.get(S.hymn.dialect).organ;
  }
  $("kcl-build").addEventListener("click", build);
  $("kcl-another").addEventListener("click", function () { $("kcl-seed").value = (Math.floor(+$("kcl-seed").value) || 0) + 1; build(); });

  var DIALECT_NAME = { tabernacle: "C · Tabernacle", sacredharp: "A · Sacred Harp", oldway: "F · The Old Way" };
  var PRACTICE_NAME = { sung: "sung", notes: "on the notes (fa sol la mi)", lined: "lined out", hummed: "hummed", unison: "in unison", descant: "with a descant" };
  var KEYING_NAME = { hum: "hums do, then the tune's first note", fasola: "sings fa… sol… la…, then the first note", fifth: "gives sol–do, then the note" };
  function nameOf(id) { var m = S.ward.byId[id]; return m ? m.nameDs : id; }
  function roleOf(id) { var m = S.ward.byId[id]; return m && m.role ? Cast.ROLE_NAME[m.role] : ""; }
  function drawBoard() {
    var h = S.hymn, p = S.plan, ch = S.ward.byId[p.chorister];
    var key = p.keying ? (p.keying.kind === "pitching" ? "the pitching: the keyer hums the tonic, each section finds its first note, a chord builds" : "the chorister " + (KEYING_NAME[p.keying.habit] || "keys it") + (p.keying.under ? " (under the organ's last chord)" : ""))
      : "the organ gives out the tune";
    $("kcl-hymn").innerHTML =
      '<div class="kcl-board"><span class="kcl-num">' + h.number + '</span><span class="kcl-name">' + esc(h.nameDs) + '</span><span class="kcl-en">' + esc(h.nameEn) + " (dev)</span></div>" +
      '<p class="kcl-meta"><b>' + esc(DIALECT_NAME[h.dialect]) + "</b> · " + esc(h.meter) + " · " + esc(h.mode) + " · " + esc(h.modeOfTime) +
      (h.hymnist ? " · by " + esc(h.hymnist.nameDs) : "") + " · led by " + esc(ch.nameDs) + ' <span class="kcl-en">(' + esc(ch.nameEn) + ", " + esc(ch.archetypeEn) + ")</span></p>" +
      '<p class="kcl-meta">Before the first verse: <b>' + esc(key) + "</b>. The ward sits " + (p.layout === "square" ? "in the hollow square (trebles one side, basses the other, the tenors with the tune in the middle)" : "in the pews, families together") +
      ". About " + mmss(S.sheet.end) + " long.</p>" +
      '<ul class="kcl-verses" id="kcl-verselist">' + p.verses.map(function (v, i) {
        var f = (v.forward || []).map(function (x) { return esc(nameOf(x.memberId)) + " <small>(" + esc(Cast.ROLE_NAME[x.role]) + ")</small> " + esc(x.action) + (x.lines.length < lineCount() ? " <small>on line " + x.lines.map(function (l) { return l + 1; }).join(", ") + "</small>" : ""); });
        return '<li data-v="' + i + '"><b>Verse ' + (i + 1) + "</b> · " + esc(PRACTICE_NAME[v.practice] || v.practice) + (f.length ? " · " + f.join("; ") : " · the ward together") + "</li>";
      }).join("") + (p.amen && h.amen ? '<li data-v="amen"><b>Amen</b> · the plagal A-men</li>' : "") + "</ul>";
  }
  function lineCount() { return S.hymn.lines.length + (S.hymn.refrain ? S.hymn.refrain.length : 0); }

  // --- the seating chart ---
  var W = 600, Hc = 400;
  function seatXY(m) {
    var p = S.plan.layout;
    if (m.role === "organist") return [W - 46, 44];
    if (S.ward.roles.chorister === m.id) return [W / 2, 52];
    if (p === "square") {
      // the hollow square: trebles left, basses right, tenors facing the leader, altos behind
      var i = m.k;
      if (m.part === "S") return [110, 140 + i * 30];
      if (m.part === "B") return [W - 110, 140 + i * 30];
      if (m.part === "T") return [180 + i * 34, 110];
      if (m.part === "A") return [180 + i * 34, 370];
      if (m.part === "child") return [80, 140 + 7.6 * 30];
    }
    var row = m.pew.row, x = W / 2 + m.pew.x * 250;
    if (m.part === "child") x += 0;
    // two people on the same spot sit shoulder to shoulder
    return [x, 120 + row * 36];
  }
  function drawChart() {
    var ward = S.ward, svg = ['<svg class="kcl-chart" viewBox="0 0 ' + W + " " + Hc + '" role="img" aria-label="the seating chart">'];
    svg.push('<text class="lbl" x="' + W / 2 + '" y="22" text-anchor="middle">the stand</text>');
    svg.push('<text class="lbl" x="' + (W - 46) + '" y="22" text-anchor="middle">the organ</text>');
    if (S.plan.layout !== "square") for (var r = 0; r < 8; r++) svg.push('<line class="pew" x1="40" x2="' + (W - 40) + '" y1="' + (132 + r * 36) + '" y2="' + (132 + r * 36) + '"/>');
    else svg.push('<text class="lbl" x="' + W / 2 + '" y="245" text-anchor="middle">the hollow square</text>');
    // spread people who land on the same place
    var placed = {};
    var badge = {}; ward.individuals.forEach(function (id, i) { badge[id] = i + 1; });
    ward.members.forEach(function (m) {
      var xy = seatXY(m), key = Math.round(xy[0] / 14) + ":" + Math.round(xy[1] / 14);
      while (placed[key]) { xy[0] += 15; key = Math.round(xy[0] / 14) + ":" + Math.round(xy[1] / 14); }
      placed[key] = true;
      var ind = badge[m.id], rad = m.part === "child" ? 6 : 8.5, cls = m.part ? "p" + m.part : "pB";
      svg.push('<g class="m" data-id="' + m.id + '" transform="translate(' + xy[0].toFixed(1) + "," + xy[1].toFixed(1) + ')"><title>' + esc(m.nameEn + " · " + m.nameDs + (m.role ? " · " + Cast.ROLE_NAME[m.role] : "") + (m.part ? " · " + Cast.PART_NAME[m.part] : "")) + "</title>" +
        '<circle class="glow" r="' + (rad + 5) + '"/>' +
        (m.role === "organist" ? '<rect class="seat sing" x="-9" y="-9" width="18" height="18" rx="3" fill="#6b5f47"/>' : '<circle class="seat ' + cls + '" r="' + rad + '"/>') +
        (ind ? '<circle class="ring" r="' + (rad + 1.5) + '"/><text class="badge" y="' + (-rad - 4) + '" text-anchor="middle">' + ind + "</text>" : "") + "</g>");
    });
    svg.push("</svg>");
    $("kcl-chartbox").innerHTML = svg.join("");
    $("kcl-legend").innerHTML = [["S", "treble"], ["A", "alto"], ["T", "tenor"], ["B", "bass"], ["C", "child"]].map(function (p) { return '<span><i style="background:var(--p' + p[0] + ')"></i>' + p[1] + "</span>"; }).join("") +
      "<span>ringed and numbered: the people you will meet · a halo: forward now</span>";
  }
  function drawPeople() {
    var ward = S.ward, moments = {};
    S.plan.verses.forEach(function (v, i) { (v.forward || []).forEach(function (f) { (moments[f.memberId] = moments[f.memberId] || []).push("verse " + (i + 1) + ": " + f.action); }); });
    if (S.plan.keying) (moments[S.plan.keying.by] = moments[S.plan.keying.by] || []).unshift(S.plan.keying.kind === "pitching" ? "pitches the tune" : "keys the hymn");
    $("kcl-people").innerHTML = ward.individuals.map(function (id, i) {
      var m = ward.byId[id], v = m.voice || {}, tr = [];
      if (m.part) tr.push(Cast.PART_NAME[m.part]);
      if (v.age) tr.push(v.age);
      if (v.pitchHabitCents != null && Math.abs(v.pitchHabitCents) >= 4) tr.push(Math.abs(Math.round(v.pitchHabitCents)) + " cents " + (v.pitchHabitCents < 0 ? "flat" : "sharp"));
      if (v.timingHabitMs != null && Math.abs(v.timingHabitMs) >= 15) tr.push(Math.abs(Math.round(v.timingHabitMs)) + " ms " + (v.timingHabitMs > 0 ? "late" : "early"));
      if (v.confidence != null) tr.push("confidence " + v.confidence.toFixed(2));
      if (v.level != null && v.level !== 1) tr.push((v.level > 1 ? "+" : "") + (20 * Math.log10(v.level)).toFixed(1) + " dB");
      if (m.habit && m.habit.style) tr.push("plays " + m.habit.style);
      if (m.habit && m.habit.tempoMul) tr.push("tempo ×" + m.habit.tempoMul.toFixed(2) + ", fermatas ×" + m.habit.holdMul.toFixed(1));
      if (m.habit && m.habit.contour) tr.push("speaks " + m.habit.contour + ", " + m.habit.rate.toFixed(1) + " syllables a second");
      if (m.parent) tr.push("sits with " + ward.byId[m.parent].nameEn);
      var mo = moments[id] || [];
      if (m.role === "testimony") mo = ["will rise at the testimony (a later round)"];
      if (m.role === "organist") mo = [S.plan.organ ? "at the organ for this hymn" : "the organ is silent for this hymn"];
      return '<li data-id="' + id + '"><div class="who"><span class="n">' + (i + 1) + '</span><span class="role">' + esc(Cast.ROLE_NAME[m.role]) + '</span><span class="dsn">' + esc(m.nameDs) + '</span><span class="en">' + esc(m.nameEn) + "</span></div>" +
        '<p class="desc">' + esc(m.archetypeEn) + "</p>" + '<p class="traits">' + esc(tr.join(" · ")) + "</p>" +
        (mo.length ? '<p class="moments"><b>This hymn:</b> ' + esc(mo.join("; ")) + "</p>" : '<p class="moments">sings with the ward this hymn</p>') + "</li>";
    }).join("");
  }
  function eventText(e) {
    if (e.type === "hymn-announced") return "Hymn " + e.hymn.number + " · " + e.hymn.nameDs + " · led by " + e.leaderDs;
    if (e.type === "verse-start") return "verse " + (e.verse + 1) + " · " + (PRACTICE_NAME[e.practice] || e.practice);
    if (e.type === "cast") return e.nameDs + " — " + (roleOf(e.memberId) || "") + " — " + e.action;
    return e.type;
  }
  function drawLog() {
    $("kcl-log").innerHTML = S.sheet.events.map(function (e, i) { return '<li class="todo" data-i="' + i + '"><span class="t">' + mmss(e.t) + "</span><span>" + esc(eventText(e)) + "</span></li>"; }).join("");
  }

  // ==========================================================================
  // THE ROOM — the voices lab's master chain (glue, master 0.6, tanh,
  // compressor) with a brick-wall limiter: never louder than the app. `lin`
  // gives the linear chain the join meter reads (no dynamics, so stems add).
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
  function chain(ctx, lin) {
    var t = 0;
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, t); return g; }
    var layer = 0.8 * 1.1, near = G(layer), hall = G(layer);
    var dry = G(1), wetIn = G(1), conv = ctx.createConvolver(), wet = G(0.9 * 0.85);
    var nd = G(1.0), nw = G(0.35), hd = G(0.72), hw = G(0.75);
    near.connect(nd); near.connect(nw); hall.connect(hd); hall.connect(hw);
    nd.connect(dry); hd.connect(dry); nw.connect(wetIn); hw.connect(wetIn);
    var bus = G(1), out;
    dry.connect(bus); wetIn.connect(conv); conv.connect(wet); wet.connect(bus);
    if (lin) { var m = G(0.6); bus.connect(m); m.connect(ctx.destination); out = m; }
    else {
      var glue = ctx.createDynamicsCompressor();
      glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
      glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
      var master = G(0.6), sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
      sat.curve = curve; sat.oversample = "2x";
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
      comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
      var lim = ctx.createDynamicsCompressor();
      lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
      lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
      bus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim); lim.connect(ctx.destination); out = lim;
    }
    var ready = irReady.then(function () {
      if (!irBytes) { conv.buffer = pouredIR(ctx); return; }
      return ctx.decodeAudioData(irBytes.slice(0)).then(function (buf) { conv.buffer = buf; }, function () { conv.buffer = pouredIR(ctx); });
    });
    return { near: near, hall: hall, ready: ready, out: out, detach: function () { try { out.disconnect(); } catch (e) { /* gone */ } } };
  }
  // the organ, into a bus of its own: at the ward's level while it gives out the tune, then under them
  function organFor(ctx, room, t0, sheet) {
    if (!S.plan.organ) return { bus: null, play: null };
    var bus = ctx.createGain(), firstVerse = sheet.events.filter(function (e) { return e.type === "verse-start"; })[0];
    bus.gain.setValueAtTime(GIVE_OUT, Math.max(0, t0 - 0.5));
    if (firstVerse) { bus.gain.setValueAtTime(GIVE_OUT, t0 + firstVerse.t - 0.45); bus.gain.linearRampToValueAtTime(1, t0 + firstVerse.t - 0.05); }
    bus.connect(room.hall);
    var org = K.VoicesOrgan.create(ctx, bus, { gain: 0.9, seed: S.s.seed, t0: t0 });
    return { bus: bus, play: function (t, o) { org.play(t, o.notes, o.registration); } };
  }
  function freshSheet() { var sh = {}; for (var k in S.sheet) sh[k] = S.sheet[k]; sh._ci = 0; sh._oi = 0; return sh; }

  // ==========================================================================
  // PLAY — real time; the pump hands the lines over 3 s ahead
  // ==========================================================================
  var AC = null, timer = null, ROOM = null, live = null;
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (AC) { var a = AC; AC = null; try { a.close(); } catch (e) { /* gone */ } }
    live = null;
    $("kcl-stop").disabled = true;
    $("kcl-now").textContent = "";
    paint(-1);
  }
  $("kcl-stop").addEventListener("click", stop);
  function play() {
    if (!S) return;
    stop();
    var Ctor = window.AudioContext || window.webkitAudioContext;
    try { AC = new Ctor({ latencyHint: "playback" }); } catch (e) { showErr("no audio: " + e.message); return; }
    var ac = AC, room = chain(ac);
    ROOM = room;
    // a meter on the way out (for the silent checks: is the ward singing?)
    room.meter = ac.createAnalyser(); room.meter.fftSize = 2048; room.out.connect(room.meter);
    $("kcl-stop").disabled = false;
    $("kcl-now").textContent = "the ward is finding its seats…";
    room.ready.then(function () {
      if (AC !== ac) return;
      if (ac.state === "suspended" && ac.resume) ac.resume();
      var t0 = ac.currentTime + 1.2, sheet = freshSheet(), org = organFor(ac, room, t0, sheet);
      V.budget.reset();
      var perf = Cast.performer(S.ward, { V: V, synth: PJ2.Rand.stream(S.s.seed).fork("synth:vocal"), organ: org.play });
      live = { ac: ac, t0: t0, sheet: sheet, perf: perf, room: room };
      function pump() {
        if (AC !== ac) return;
        var now = ac.currentTime;
        perf.pump(ac, room, t0, sheet, now + 3.0, { max: 12, urgent: now + 1.2, arm: now + ARM_LEAD, now: now });
        paint(now - t0);
        if (now > t0 + sheet.end + 3.5) stop();
      }
      pump();
      timer = setInterval(pump, 120);
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  }
  $("kcl-playbtn").addEventListener("click", play);

  // who is singing and who is forward at time t (seconds from the hymn's start)
  var lastPaint = { log: -1 };
  function paint(t) {
    if (!S) return;
    var singing = {}, fwd = {}, verseNow = null;
    if (t >= 0) {
      S.sheet.cues.forEach(function (c) {
        if (c.at > t + 0.05) return;
        var len = 0; c.notes.forEach(function (n) { len += n.dur; });
        if (t < c.at + len) { singing[c.memberId] = true; if (c.forward) fwd[c.memberId] = true; }
      });
      S.sheet.events.forEach(function (e) { if (e.type === "verse-start" && e.t <= t) verseNow = e.verse; });
    }
    document.querySelectorAll("#kcl-chartbox g.m").forEach(function (g) {
      var id = g.getAttribute("data-id"), seat = g.querySelector(".seat");
      if (seat && id !== "organist") seat.classList.toggle("sing", !!singing[id] || t < 0);
      g.classList.toggle("fwd", !!fwd[id]);
    });
    document.querySelectorAll("#kcl-people li").forEach(function (li) { li.classList.toggle("fwd", !!fwd[li.getAttribute("data-id")]); });
    document.querySelectorAll("#kcl-verselist li").forEach(function (li) { li.classList.toggle("is-now", verseNow != null && li.getAttribute("data-v") === String(verseNow)); });
    // the log: what has happened, and the latest
    var latest = -1;
    S.sheet.events.forEach(function (e, i) { if (t >= 0 && e.t <= t) latest = i; });
    if (latest !== lastPaint.log) {
      document.querySelectorAll("#kcl-log li").forEach(function (li) {
        var i = +li.getAttribute("data-i");
        li.className = i <= latest ? (i === latest ? "done is-now" : "done") : "todo";
      });
      lastPaint.log = latest;
      var cur = document.querySelector("#kcl-log li.is-now");
      if (cur && cur.parentNode) { var box = cur.parentNode; box.scrollTop = Math.max(0, cur.offsetTop - box.offsetTop - 60); }
    }
    if (t >= 0 && latest >= 0) $("kcl-now").textContent = mmss(t) + " · " + eventText(S.sheet.events[latest]);
  }

  // ==========================================================================
  // THE BENCH
  // ==========================================================================
  function fft(re, im) {
    var n = re.length, i, j = 0, k;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { k = re[i]; re[i] = re[j]; re[j] = k; k = im[i]; im[i] = im[j]; im[j] = k; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (j = 0; j < len / 2; j++) {
          var a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function mono(buf) { var a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a, m = new Float32Array(a.length); for (var i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5; return m; }
  function db(p) { return 10 * Math.log10(Math.max(p, 1e-15)); }
  // the 3–12 kHz band, frame by frame (5 ms hop): its mean-square, and how
  // noise-like it is (spectral flatness: ~0 a chord, ~1 a hiss)
  function bandFrames(x, sr) {
    var N = 1024, hop = 240, win = new Float32Array(N), wsum = 0;
    for (var i = 0; i < N; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); wsum += win[i] * win[i]; }
    var nf = Math.max(0, Math.floor((x.length - N) / hop) + 1), e = new Float64Array(nf), fl = new Float64Array(nf), re = new Float32Array(N), im = new Float32Array(N);
    var b0 = Math.ceil(3000 * N / sr), b1 = Math.floor(12000 * N / sr);
    for (var f = 0; f < nf; f++) {
      var s = f * hop;
      for (var k = 0; k < N; k++) { re[k] = x[s + k] * win[k]; im[k] = 0; }
      fft(re, im);
      var sum = 0, lg = 0, nb = 0;
      for (var b = b0; b <= b1; b++) { var p = re[b] * re[b] + im[b] * im[b] + 1e-20; sum += p; lg += Math.log(p); nb++; }
      e[f] = 2 * sum / (N * wsum); fl[f] = Math.exp(lg / nb) / (sum / nb);
    }
    return { e: e, fl: fl, hop: hop / sr, N: N / sr };
  }
  function windowMean(arr, B, a, b) { var s = 0, n = 0; for (var f = 0; f < arr.length; f++) { var tc = f * B.hop + B.N / 2; if (tc >= a && tc < b) { s += arr[f]; n++; } } return n ? s / n : 0; }
  function joinReport(buf, joins, t0) {
    var B = bandFrames(mono(buf), buf.sampleRate), by = {};
    joins.forEach(function (j) {
      var a = t0 + j.t - 0.06, b = t0 + j.t + 0.09;
      if (b > buf.duration) return;
      var r = by[j.kind] = by[j.kind] || { e: 0, fl: 0, n: 0 };
      r.e += windowMean(B.e, B, a, b); r.fl += windowMean(B.fl, B, a, b); r.n++;
    });
    var out = {};
    for (var k in by) out[k] = { n: by[k].n, db: +db(by[k].e / by[k].n).toFixed(1), flat: +(by[k].fl / by[k].n).toFixed(3) };
    return out;
  }
  function clicks(x, sr) {
    var n = x.length, d2 = new Float32Array(n);
    for (var k = 2; k < n; k++) d2[k] = x[k] - 2 * x[k - 1] + x[k - 2];
    var H = Math.floor(sr * 0.01), pre = new Float64Array(n + 1);
    for (var k2 = 0; k2 < n; k2++) pre[k2 + 1] = pre[k2] + d2[k2] * d2[k2];
    var out = [], lastC = -1e9;
    for (var k3 = H; k3 < n - H; k3++) {
      var v = Math.abs(d2[k3]); if (v < 2e-3) continue;
      var loc = Math.sqrt((pre[k3 + H] - pre[k3 - H] - v * v) / (2 * H - 1));
      if (v > 10 * loc + 1e-4 && k3 - lastC > sr * 0.02) { out.push(+(k3 / sr).toFixed(3)); lastC = k3; }
    }
    return out;
  }
  function levels(buf) {
    var x = mono(buf), sr = buf.sampleRate, pk = 0, W = Math.floor(sr * 0.4), wins = [];
    for (var c = 0; c < buf.numberOfChannels; c++) { var d = buf.getChannelData(c); for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > pk) pk = a; } }
    for (var w = 0; w + W <= x.length; w += W) { var s2 = 0; for (var j = w; j < w + W; j++) s2 += x[j] * x[j]; wins.push(s2 / W); }
    wins.sort(function (p, q) { return q - p; });
    var top = wins.slice(0, Math.max(1, Math.floor(wins.length / 2))), tm = 0; top.forEach(function (v) { tm += v; });
    return { peakDb: +(20 * Math.log10(pk + 1e-12)).toFixed(2), loudDb: +db(tm / top.length).toFixed(1), clicks: clicks(x, sr) };
  }
  // render the hymn (or its first `limit` seconds) offline, the pump driven
  // by suspend() exactly as the live pump hands lines over
  function render(opts) {
    opts = opts || {};
    var sr = 48000, t0 = 1.0, len = Math.min(S.sheet.end, opts.limit || 1e9) + 3;
    var ctx = new OfflineAudioContext(2, Math.ceil((t0 + len) * sr), sr);
    if (opts.silentFolds) {
      // the singers' folds silenced: what is left is the breath and the consonants
      var orig = ctx.createPeriodicWave.bind(ctx);
      ctx.createPeriodicWave = function (re, im) { return orig(new Float32Array(re.length), new Float32Array(im.length), { disableNormalization: true }); };
    }
    var room = chain(ctx, opts.linear), sheet = freshSheet();
    return room.ready.then(function () {
      V.budget.reset();
      var org = opts.organ === false ? { play: null } : organFor(ctx, room, t0, sheet);
      var perf = Cast.performer(S.ward, { V: V, synth: PJ2.Rand.stream(S.s.seed).fork("synth:vocal"), organ: org.play });
      var q = 128 / sr, lastPump = 0;
      // (armed as the live pump arms: each line joins the room ARM_LEAD before
      // it sounds, the next pump being a second on — so what is measured is
      // the path that is played)
      perf.pump(ctx, room, t0, sheet, 3.0, { arm: 1 + ARM_LEAD, now: 0 });
      for (var s = 1; s < t0 + len; s += 1) {
        (function (at) {
          ctx.suspend(Math.round(at / q) * q).then(function () { perf.pump(ctx, room, t0, sheet, Math.min(at + 3.0, t0 + len - 0.5), { arm: at + 1 + ARM_LEAD, now: at }); lastPump = at; ctx.resume(); });
        })(s);
      }
      var ms0 = performance.now();
      return ctx.startRendering().then(function (buf) {
        return { buf: buf, t0: t0, ms: performance.now() - ms0, dur: t0 + len, nodes: V.budget.report(0, t0 + len), joins: S.sheet.joins.filter(function (j) { return j.t < len - 3; }) };
      });
    });
  }
  function drawSpec(buf, a, b) {
    var cv = $("kcl-spec"); cv.hidden = false;
    var g = cv.getContext("2d"), Wd = cv.width, Ht = cv.height, x = mono(buf), sr = buf.sampleRate, N = 1024;
    var re = new Float32Array(N), im = new Float32Array(N), win = new Float32Array(N), maxBin = Math.floor(12000 * N / sr);
    for (var i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    var img = g.createImageData(Wd, Ht);
    for (var c = 0; c < Wd; c++) {
      var s = Math.floor((a + (b - a) * c / Wd) * sr) - N / 2;
      for (var k = 0; k < N; k++) { re[k] = (x[s + k] || 0) * win[k]; im[k] = 0; }
      fft(re, im);
      for (var y = 0; y < Ht; y++) {
        var bin = Math.floor((Ht - 1 - y) / (Ht - 1) * maxBin), m = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]) / (N / 4);
        var d = (20 * Math.log10(m + 1e-12) + 100) / 80; d = d < 0 ? 0 : d > 1 ? 1 : d;
        var o = (y * Wd + c) * 4;
        img.data[o] = 251 - d * 220; img.data[o + 1] = 246 - d * 210; img.data[o + 2] = 234 - d * 200; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = "#7a4a1e"; g.font = "13px Georgia";
    [3000, 6000, 9000].forEach(function (f) { var yy = (Ht - 1) * (1 - f / 12000); g.fillRect(0, yy, 8, 1); g.fillText(f / 1000 + " kHz", 10, yy + 4); });
    g.fillText(a.toFixed(1) + " s", 4, Ht - 4); g.fillText(b.toFixed(1) + " s", Wd - 48, Ht - 4);
  }
  function tr(k, v, ok) { return "<tr><th>" + k + "</th><td class='" + (ok === false ? "no" : ok ? "ok" : "") + "'>" + v + "</td></tr>"; }
  function measure(limit) {
    if (!S) return Promise.reject(new Error("seat a ward first"));
    $("kcl-report").innerHTML = "<p>rendering the hymn as heard, then the folds silenced…</p>";
    var out = {};
    return render({ limit: limit || 75 }).then(function (r) {
      out.heard = levels(r.buf); out.renderX = +(r.dur * 1000 / r.ms).toFixed(2); out.nodes = { peak: r.nodes.peak, mean: Math.round(r.nodes.mean) }; out.dur = +r.dur.toFixed(1);
      out.joinsHeard = joinReport(r.buf, r.joins, r.t0);
      var sp = Math.min(r.dur - 1, r.t0 + 14);
      drawSpec(r.buf, Math.max(0, sp - 12), sp);
      out.specPng = $("kcl-spec").toDataURL("image/png");
      return render({ limit: limit || 75, linear: true, silentFolds: true, organ: false });
    }).then(function (r2) {
      out.joinsBreath = joinReport(r2.buf, r2.joins, r2.t0);
      function row(j) { return Object.keys(j).map(function (k) { return k + ": " + j[k].db + " dB (flatness " + j[k].flat + ", n " + j[k].n + ")"; }).join(" · "); }
      $("kcl-report").innerHTML = "<table>" +
        tr("rendered", out.dur + " s at " + out.renderX + "× real time (offline, this machine)") +
        tr("level", "loud half " + out.heard.loudDb + " dBFS · peak " + out.heard.peakDb + " dBFS", out.heard.peakDb < -0.5) +
        tr("clicks", out.heard.clicks.length + (out.heard.clicks.length ? " at " + out.heard.clicks.slice(0, 8).join(", ") + " s" : ""), out.heard.clicks.length === 0) +
        tr("3–12 kHz at the joins, as heard", row(out.joinsHeard)) +
        tr("… the breath and the consonants alone", row(out.joinsBreath)) +
        tr("nodes", "peak " + out.nodes.peak + " sounding at once · mean " + out.nodes.mean) + "</table>";
      delete out.specPng;
      return out;
    }).catch(function (e) { showErr(String(e && e.stack || e)); throw e; });
  }
  $("kcl-measure").addEventListener("click", function () { measure(); });

  // --- THE PHONE TEST: the hymn in real time over a whole meeting, in the
  // meeting's own audio context. Did the audio clock keep real time? Did the
  // pump hand every line over in time? (The headless driver throttles the
  // CPU; this page only measures.)
  function stress(seconds, o) {
    if (!S) return Promise.reject(new Error("seat a ward first"));
    stop();
    seconds = seconds || 60;
    var withWard = !(o && o.ward === false);          // (false: the meeting alone, the control)
    var KA = window.KolobAudio;
    if (!KA) return Promise.reject(new Error("the engine did not load"));
    $("kcl-report").innerHTML = "<p>the meeting is called; the ward sings over it for " + seconds + " s…</p>";
    KA.reseed(S.s.seed); KA.play();
    var an = KA.attachAnalyser(), ac = an && an.context;
    if (!ac) return Promise.reject(new Error("no engine context"));
    var room = chain(ac), longTasks = [], po = null;
    try { po = new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { longTasks.push(e.duration); }); }); po.observe({ entryTypes: ["longtask"] }); } catch (e) { po = null; }
    return room.ready.then(function () {
      return new Promise(function (resolve) {
        // (the meeting brings its own organ: the lab's pipe organ stays silent here)
        var skipped = false, t0 = ac.currentTime + 2.0, sheet = freshSheet();
        V.budget.reset();
        var perf = Cast.performer(S.ward, { V: V, synth: PJ2.Rand.stream(S.s.seed).fork("synth:vocal") });
        var wall0 = performance.now(), ac0 = ac.currentTime, samples = [], handed = 0, late = 0, minMargin = 1e9, pumpMs = [], hymns = 1, joinedMax = 0, joinedSum = 0, joinedN = 0;
        var under0 = ac.playbackStats ? { events: ac.playbackStats.underrunEvents, seconds: ac.playbackStats.underrunDuration } : null;
        var iv = setInterval(function () {
          // both clocks read together, before the pump (a long pump read
          // between them used to shave the measured ratio)
          var now = ac.currentTime, wallNow = performance.now();
          if (!skipped && now > ac0 + 3) { skipped = KA.skipToSection("hymn") || true; }
          if (now > t0 + sheet.end + 1.5) { t0 = now + 1.5; sheet = freshSheet(); hymns++; }
          var p0 = performance.now(), got = withWard ? perf.pump(ac, room, t0, sheet, now + 3.0, { max: 12, urgent: now + 1.2, arm: now + ARM_LEAD, now: now }) : [];
          pumpMs.push(performance.now() - p0);
          got.forEach(function (c) { handed++; var m = t0 + c.at - now; if (m < minMargin) minMargin = m; if (m < 0.45) late++; });
          samples.push([wallNow - wall0, now - ac0]);
          var jn = V.joined ? V.joined(ac) : 0; joinedMax = Math.max(joinedMax, jn); joinedSum += jn; joinedN++;
          if (performance.now() - wall0 > seconds * 1000) {
            clearInterval(iv);
            try { po && po.disconnect(); } catch (e) { /* none */ }
            var last = samples[samples.length - 1], worst = 1e9;
            for (var i = 0; i < samples.length; i++) for (var j = i + 1; j < samples.length; j++) if (samples[j][0] - samples[i][0] >= 5000) { worst = Math.min(worst, (samples[j][1] - samples[i][1]) / ((samples[j][0] - samples[i][0]) / 1000)); break; }
            pumpMs.sort(function (a, b) { return a - b; });
            var res = {
              withWard: withWard, seconds: +(last[0] / 1000).toFixed(1), clockRatio: +(last[1] / (last[0] / 1000)).toFixed(3), worst5sRatio: +worst.toFixed(3),
              cuesHanded: handed, lateCues: late, minMarginS: +minMargin.toFixed(2), hymnsStarted: hymns,
              pumpMsP95: +pumpMs[Math.floor(pumpMs.length * 0.95)].toFixed(1), pumpMsMax: +pumpMs[pumpMs.length - 1].toFixed(1),
              longTasks: longTasks.length, longTaskMaxMs: longTasks.length ? Math.round(Math.max.apply(null, longTasks)) : 0,
              wardNodesPeak: V.budget.report(ac0, ac.currentTime).peak, joinedMax: joinedMax, joinedMean: joinedN ? Math.round(joinedSum / joinedN) : 0, meetingSection: KA.getConductor ? KA.getConductor().section : null,
              baseLatency: ac.baseLatency, outputLatency: ac.outputLatency, sampleRate: ac.sampleRate,
            };
            var ps = ac.playbackStats || null;
            if (ps) res.underruns = { events: ps.underrunEvents - under0.events, seconds: +(ps.underrunDuration - under0.seconds).toFixed(3) };
            room.detach(); KA.stop();
            $("kcl-report").innerHTML = "<table>" +
              tr("ran", res.seconds + " s of wall clock; the meeting in its " + esc(res.meetingSection || "?") + ", " + res.hymnsStarted + " hymn(s) sung over it") +
              tr("audio clock", "× " + res.clockRatio + " of real time (worst 5 s: × " + res.worst5sRatio + ")", res.worst5sRatio > 0.98) +
              tr("the pump", res.cuesHanded + " lines handed · " + res.lateCues + " late · the tightest " + res.minMarginS + " s ahead · a pump takes " + res.pumpMsP95 + " ms (95th pct), " + res.pumpMsMax + " ms at most", res.lateCues === 0) +
              tr("main thread", res.longTasks + " long tasks, the longest " + res.longTaskMaxMs + " ms") +
              (res.underruns ? tr("the audio thread", res.underruns.events + " underruns (" + res.underruns.seconds + " s of glitch)", res.underruns.events === 0) : "") +
              tr("the ward's nodes", "peak " + res.wardNodesPeak + " built and alive at once · at most " + res.joinedMax + " mouths, breaths and consonants joined to the room (mean " + res.joinedMean + ")") + "</table>";
            resolve(res);
          }
        }, 120);
      });
    });
  }
  $("kcl-stress").addEventListener("click", function () { stress(60).catch(function (e) { showErr(String(e && e.stack || e)); }); });

  // --- THE HEADROOM TEST: how much of the audio thread the meeting and the
  // ward leave free. DevTools' CPU throttle slows the page's main thread, not
  // the audio thread, so the audio side is measured by what it can still
  // carry: plain probe voices (a sawtooth through three filters, inaudible)
  // are added fifty at a time until the audio clock falls behind real time.
  // Alone, the thread carries N0 of them; under the meeting (and the ward),
  // N1. The load is 1 − N1/N0, and a phone four times slower needs four
  // times that under one.
  function probeVoices(ac, n, into) {
    for (var i = 0; i < n; i++) {
      var o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = 90 + (into.length % 200) * 1.7;
      var b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter(), b3 = ac.createBiquadFilter();
      b1.type = "peaking"; b1.frequency.value = 700; b1.gain.value = 10; b2.type = "peaking"; b2.frequency.value = 1500; b2.gain.value = 8; b3.type = "lowpass"; b3.frequency.value = 5000;
      o.connect(b1); b1.connect(b2); b2.connect(b3); b3.connect(into.sink); o.start(); into.push(o);
    }
  }
  function capacity(ac, step, hold, tick) {
    var into = [], stepN = step || 50, res = [];
    into.sink = ac.createGain(); into.sink.gain.value = 0.0001; into.sink.connect(ac.destination);
    return new Promise(function (resolve) {
      var a0 = null, w0 = null, next = performance.now() + 5000, fails = 0;
      var iv = setInterval(function () {
        if (tick) tick();
        if (performance.now() < next) return;
        if (a0 != null) {
          var r = (ac.currentTime - a0) / ((performance.now() - w0) / 1000);
          res.push([into.length, +r.toFixed(3)]);
          fails = r < 0.985 ? fails + 1 : 0;
          if (fails >= 2 || into.length >= 3000) {
            clearInterval(iv);
            into.forEach(function (o) { try { o.stop(); } catch (e) { /* gone */ } });
            try { into.sink.disconnect(); } catch (e) { /* gone */ }
            var clean = res.filter(function (x) { return x[1] >= 0.985; }).map(function (x) { return x[0]; });
            resolve({ max: clean.length ? Math.max.apply(null, clean) : 0, steps: res });
            return;
          }
        }
        probeVoices(ac, stepN, into);
        a0 = ac.currentTime; w0 = performance.now(); next = performance.now() + (hold || 3) * 1000;
      }, 120);
    });
  }
  function headroom(opts) {
    opts = opts || {};
    if (!S) return Promise.reject(new Error("seat a ward first"));
    stop();
    var KA = window.KolobAudio, step = opts.step || 50, hold = opts.hold || 3;
    $("kcl-report").innerHTML = "<p>measuring what the audio thread can carry: alone, under the meeting, under the meeting and the ward…</p>";
    function alone() { var ac = new AudioContext(); return capacity(ac, step, hold).then(function (r) { ac.close(); return r; }); }
    function withMeeting(ward) {
      KA.reseed(S.s.seed); KA.play();
      var ac = KA.attachAnalyser().context, room = ward ? chain(ac) : null, skipped = false;
      return (room ? room.ready : Promise.resolve()).then(function () {
        var t0 = ac.currentTime + 2.0, sheet = freshSheet(), perf = null;
        if (ward) perf = Cast.performer(S.ward, { V: V, synth: PJ2.Rand.stream(S.s.seed).fork("synth:vocal") });
        return capacity(ac, step, hold, function () {
          var now = ac.currentTime;
          if (!skipped && now > 3) skipped = KA.skipToSection("hymn") || true;
          if (perf) { if (now > t0 + sheet.end + 1.5) { t0 = now + 1.5; sheet = freshSheet(); } perf.pump(ac, room, t0, sheet, now + 3.0, { max: 12, urgent: now + 1.2, arm: now + ARM_LEAD, now: now }); }
        }).then(function (r) { if (room) room.detach(); KA.stop(); return r; });
      });
    }
    var out = {};
    return alone().then(function (r) { out.alone = r; return withMeeting(false); })
      .then(function (r) { out.meeting = r; return withMeeting(true); })
      .then(function (r) {
        out.meetingAndWard = r;
        var n0 = out.alone.max || 1;
        out.meetingLoad = +(1 - out.meeting.max / n0).toFixed(2);
        out.load = +(1 - r.max / n0).toFixed(2);
        out.wardLoad = +Math.max(0, out.load - out.meetingLoad).toFixed(2);
        out.phoneAt4x = +(out.load * 4).toFixed(2);
        $("kcl-report").innerHTML = "<table>" +
          tr("the audio thread alone", "carried " + out.alone.max + " probe voices before its clock fell behind") +
          tr("under the meeting", out.meeting.max + " (the meeting takes about " + Math.round(out.meetingLoad * 100) + " %)") +
          tr("under the meeting and the ward", r.max + " (together about " + Math.round(out.load * 100) + " %; the ward about " + Math.round(out.wardLoad * 100) + " %)") +
          tr("a phone four times slower", "about " + Math.round(out.phoneAt4x * 100) + " % of its audio thread", out.phoneAt4x < 1) + "</table>";
        return out;
      });
  }

  $("kcl-headroom").addEventListener("click", function () { headroom({ step: 25 }).catch(function (e) { showErr(String(e && e.stack || e)); }); });

  // for the headless checks (CDP): window.CastLab
  window.CastLab = {
    build: build, play: play, stop: stop, measure: measure, stress: stress, headroom: headroom, ready: irReady,
    state: function () { return S; },
    summary: function () {
      if (!S) return null;
      return { hymn: S.hymn.nameEn, dialect: S.hymn.dialect, verses: S.plan.verses.map(function (v) { return v.practice; }), keying: S.plan.keying, end: S.sheet.end, cues: S.sheet.cues.length,
               individuals: S.ward.individuals.map(function (id) { var m = S.ward.byId[id]; return m.role + ":" + m.nameEn; }), events: S.sheet.events.length };
    },
    // the level leaving the limiter now (dBFS), and where the hymn is
    level: function () {
      if (!live || !ROOM || !ROOM.meter) return null;
      var a = new Float32Array(ROOM.meter.fftSize), s2 = 0, pk = 0; ROOM.meter.getFloatTimeDomainData(a);
      for (var i = 0; i < a.length; i++) { s2 += a[i] * a[i]; pk = Math.max(pk, Math.abs(a[i])); }
      return { t: +(live.ac.currentTime - live.t0).toFixed(2), rms: +(10 * Math.log10(s2 / a.length + 1e-12)).toFixed(1), peak: +pk.toFixed(3) };
    },
  };
  build();
  if (Q.has("play")) play();
})();
