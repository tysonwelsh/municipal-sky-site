// ============================================================================
// QUESTION LAB — audition bench for KOLOB.Question (kolob-question.js).
// UNLINKED dev tool, like tune-lab and room-lab.
//
// The QUESTIONS are the module's, read live, exactly as the engine will be
// handed them: the visit's bank written once from question:bank, then each
// meeting's pick → askings → answers → ground → seat → timeline from its own
// question:<n> forks, the question just heard stepping aside. What this file
// keeps a copy of is only the VOICES — the deacon's clarinet, the parlor
// harmonium, the drone, the strings — adapted from kolob-audio.js's
// renderClarinetLine / renderHarmonium / droneCycle / stringsPad, and run
// through a master chain with a limiter at the app's own loudness (SCORE
// §7). Changes from the originals: the harmonium's bellows breathe in a gain
// of their own instead of adding to the envelope (a stopped LFO left a step
// behind); every oscillator stops only after its envelope has reached zero;
// the drone holds until its own release; and the answerers climb in level
// to Ives's climax instead of stopping short under the asker.
//
// Sound-level jitter (detune, attack lengths) comes from a synth:lab stream
// reborn for each performance, never from the musical streams (SCORE §3).
// Every performance can also be rendered OFFLINE (renderOffline), which is
// how agents measure it without a sound in the room.
//
// Public surface: window.QuestionLab
// ============================================================================
window.QuestionLab = (function () {
  "use strict";

  var Q = window.KOLOB.Question;
  var Rand = window.PJ2.Rand;
  var NAMES = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  var FLATTED = { mixolydian: { 6: true }, dorian: { 2: true, 6: true }, aeolian: { 2: true, 5: true, 6: true } };
  var LOWER = { 2: "me", 5: "le", 6: "te" };
  var MODE_NAME = { ionian: "ionian", mixolydian: "mixolydian", dorian: "dorian", aeolian: "aeolian", penta: "pentatonic", hexa: "hexatonic" };
  var MEETINGS = 6;
  // Stand-ins for "today's hymns" until the composer lands: plain hymn-book
  // lines in 7-degree spelling. They are the answerers' material AND the
  // meeting's excludeLines, so no question can ever match one.
  var HYMN_LINES = [
    [0, 0, 2, 4, 4, 5, 4],
    [4, 5, 4, 2, 0, 1, 2, 1],
    [2, 3, 4, 4, 5, 5, 4],
    [7, 6, 5, 4, 3, 2, 1, 0],
    [4, 4, 7, 6, 5, 4, 2, 4],
    [0, 4, 3, 2, 1, 2, 0],
  ];

  var state = { seed: 1, mode: "ionian", n: 1, material: "hymns", ground: "auto", room: "none", chosen: null, bank: null, visit: null, ev: null };
  function $(id) { return document.getElementById(id); }
  function cls(d) { return ((d % 7) + 7) % 7; }
  function solName(d, mode) {
    var c = cls(d), o = Math.floor(d / 7);
    var nm = FLATTED[mode] && FLATTED[mode][c] ? LOWER[c] : NAMES[c];
    return nm + (o > 0 ? "′".repeat(o) : o < 0 ? "ˌ".repeat(-o) : "");
  }
  function solLine(degs, mode) { return degs.map(function (d) { return solName(d, mode); }).join(" – "); }
  function material() { return state.material === "hymns" ? HYMN_LINES : []; }
  function qName(q) { return q.fromBank === "old" ? "the old one" : "new · " + q.index; }

  // ==========================================================================
  // THE VISIT for a seed: its bank, written once from question:bank, and
  // meetings 1…6, each drawing from it with the last one heard stepping
  // aside. Each meeting gets a v0.30-shaped section plan of its own so
  // seat() and the cap have real durations to work against; "room" lets
  // FORM grant the invocation, an interlude or the postlude up to 125 s when
  // the Question sits there (the request in the handoff).
  // ==========================================================================
  var bankCache = {};
  function bankFor(seed) {
    if (!bankCache[seed]) bankCache[seed] = Q.bank(Rand.stream(seed).fork("question:bank"));
    return bankCache[seed];
  }
  function labPlan(seed, n, room) {
    var s = Rand.stream(seed).fork("lab:plan:" + n);
    var plan = [
      { type: "prelude", dur: s.rnd(60, 90) },
      { type: "invocation", dur: s.rnd(60, 100) },
      { type: "hymn", dur: s.rnd(120, 180) },
      { type: "testimony", dur: s.rnd(110, 160) },
      { type: "sacrament", dur: s.rnd(100, 150) },
      { type: "doxology", dur: s.rnd(70, 110) },
      { type: "postlude", dur: s.rnd(40, 70) },
    ];
    if (s.chance(0.25)) plan.splice(3, 1);                         // some Sundays have no testimony
    if (s.chance(0.15)) plan.splice(3, 0, { type: "interlude", dur: s.rnd(50, 80) });
    if (room === "form") plan.forEach(function (p) { if (/invocation|interlude|postlude/.test(p.type)) p.stretchTo = 125; });
    return plan;
  }
  function meetingOpts(seed, mode, n, recent, mat, room) {
    return { bank: bankFor(seed), mode: mode, n: n, recent: recent, material: mat, excludeLines: HYMN_LINES, sections: labPlan(seed, n, room) };
  }
  function visitFor(seed, mode, mat, room, upTo, chosen, chosenAt) {
    var root = Rand.stream(seed), recent = [], evs = [];
    for (var n = 1; n <= upTo; n++) {
      var o = meetingOpts(seed, mode, n, recent.slice(), mat, room);
      if (n === chosenAt && chosen) o.questionId = chosen;
      var ev = Q.compose(root.fork("question:" + n), o);
      evs.push(ev);
      if (ev) recent.push(ev.question.id);
    }
    return evs;
  }

  // ==========================================================================
  // ENGRAVING — plain and small. do = C4 on the page (sounding an octave up,
  // as the clarinet plays it); one position per diatonic step; spacing by
  // duration, with room made before a flat so it never crowds the flag of
  // the note before; ledger lines.
  // ==========================================================================
  var HS = 4;                                                     // half a staff space, px
  function yOf(p) { return 30 + (10 - p) * HS; }
  function staffSVG(notes, mode, opts) {
    opts = opts || {};
    var x = 40, parts = [], heads = [];
    for (var i = 0; i < notes.length; i++) {
      var flat = FLATTED[mode] && FLATTED[mode][cls(notes[i].deg)];
      if (flat && i > 0) x += 9;                                   // the accidental's own room
      heads.push({ x: x, n: notes[i], flat: flat });
      x += 17 + Math.min(4, notes[i].beats) * 15;
    }
    var W = Math.max(160, x + 6), H = 100;
    var ink = opts.faint ? "#8fa89c" : "#1e4d3b", hi = "#9a5a3a";
    for (var l = 0; l < 5; l++) {
      var yy = yOf(2 + l * 2);
      parts.push('<line x1="4" x2="' + (W - 4) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + ink + '" stroke-opacity="0.55" stroke-width="0.8"/>');
    }
    parts.push('<text x="4" y="' + (yOf(1) + 1) + '" font-size="47" fill="' + ink + '" font-family="\'Apple Symbols\',\'Segoe UI Symbol\',\'Noto Music\',serif">𝄞</text>');
    if (opts.label) parts.push('<text x="' + (W - 6) + '" y="10" text-anchor="end" font-size="9" fill="' + ink + '" fill-opacity="0.6" font-style="italic">' + opts.label + '</text>');
    for (i = 0; i < heads.length; i++) {
      var h = heads[i], p = h.n.deg, cy = yOf(p), b = h.n.beats;
      var col = opts.mark && opts.mark[i] ? hi : ink;
      for (var lp = 0; lp >= p; lp -= 2) if (lp <= 0) parts.push('<line x1="' + (h.x - 7.5) + '" x2="' + (h.x + 7.5) + '" y1="' + yOf(lp) + '" y2="' + yOf(lp) + '" stroke="' + ink + '" stroke-width="0.9"/>');
      for (lp = 12; lp <= p; lp += 2) parts.push('<line x1="' + (h.x - 7.5) + '" x2="' + (h.x + 7.5) + '" y1="' + yOf(lp) + '" y2="' + yOf(lp) + '" stroke="' + ink + '" stroke-width="0.9"/>');
      if (h.flat) parts.push('<text x="' + (h.x - 14) + '" y="' + (cy + 3.5) + '" font-size="12" fill="' + col + '">♭</text>');
      var open = b >= 1.9;
      parts.push('<ellipse cx="' + h.x + '" cy="' + cy + '" rx="4.7" ry="3.3" transform="rotate(-20 ' + h.x + ' ' + cy + ')" fill="' + (open ? "none" : col) + '" stroke="' + col + '" stroke-width="' + (open ? 1.3 : 0.6) + '"/>');
      if (b < 3.9) {
        var up = p < 6, sx = up ? h.x + 4.3 : h.x - 4.3, sy2 = up ? cy - 25 : cy + 25;
        parts.push('<line x1="' + sx + '" x2="' + sx + '" y1="' + cy + '" y2="' + sy2 + '" stroke="' + col + '" stroke-width="1"/>');
        var flags = b <= 0.3 ? 2 : b <= 0.8 ? 1 : 0;
        for (var f = 0; f < flags; f++) {
          var fy = sy2 + (up ? f * 6 : -f * 6);
          parts.push('<path d="M' + sx + ' ' + fy + ' q 6 ' + (up ? 6 : -6) + ' 5 ' + (up ? 13 : -13) + '" fill="none" stroke="' + col + '" stroke-width="1.3"/>');
        }
      }
      if ([0.75, 1.5, 3, 6].indexOf(b) >= 0) parts.push('<circle cx="' + (h.x + 8) + '" cy="' + (cy - (p % 2 === 0 ? 2 : 0)) + '" r="1.3" fill="' + col + '"/>');
    }
    return '<svg class="oql-staff" width="' + W + '" viewBox="0 0 ' + W + ' ' + H + '" style="max-width:100%;width:' + W + 'px" role="img" aria-label="' + (opts.aria || "staff") + '">' + parts.join("") + '</svg>';
  }
  function qNotes(q) { return q.degs.map(function (d, i) { return { deg: d, beats: q.beats[i] }; }); }

  // ==========================================================================
  // RENDER — the bank (spelled into this meeting's mode), the visit, the
  // event, the timeline.
  // ==========================================================================
  function modesThatSing(w) {
    return Q.MODES.filter(function (m) { return !!Q.spellIn(w, m); });
  }
  function render() {
    var ev = state.ev, mode = state.mode, bk = state.bank;
    var el = Q.eligible(bk, mode, { excludeLines: HYMN_LINES });
    var sungById = {}, outById = {};
    el.pool.forEach(function (q) { sungById[q.id] = q; });
    el.out.forEach(function (o) { outById[o.id] = o.why; });
    var html = [];
    bk.questions.forEach(function (w) {
      var q = sungById[w.id], lit = ev && ev.question.id === w.id;
      var ms = modesThatSing(w);
      var head = '<div class="oql-card' + (lit ? " lit" : "") + (q ? "" : " out") + '">' +
        '<div class="oql-card-top"><span class="oql-card-name">' + qName(w) + '</span>' +
        '<span class="oql-card-tag">' + (lit ? "asked in meeting " + state.n : "") + '</span></div>';
      if (!q) {
        html.push(head + staffSVG(qNotes(w), "ionian", { aria: "question " + w.index + " as written", faint: true }) +
          '<div class="oql-sol">' + solLine(w.degs, "ionian") + ' <span class="oql-meta">(as written)</span></div>' +
          '<div class="oql-meta">sits this meeting out: ' + outById[w.id] + '. Sings in: ' + ms.map(function (m) { return MODE_NAME[m]; }).join(", ") + '.</div></div>');
        return;
      }
      var r = Q.rules(q);
      var cents = [];
      for (var j = 1; j < q.degs.length; j++) cents.push(Math.round(Q.cents(q.degs[j], mode) - Q.cents(q.degs[j - 1], mode)));
      var widest = Math.max.apply(null, cents.map(Math.abs));
      var moved = q.degs.map(function (d, i) { return d !== w.degs[i] ? i : -1; }).filter(function (i) { return i >= 0; });
      var marks = {}; moved.forEach(function (i) { marks[i] = true; });
      html.push(head + staffSVG(qNotes(q), mode, { aria: "question " + w.index, mark: marks }) +
        '<div class="oql-sol">' + solLine(q.degs, mode) + '</div>' +
        (moved.length ? '<div class="oql-meta">written ' + moved.map(function (i) { return solName(w.degs[i], "ionian"); }).join(", ") + '; the ' + MODE_NAME[mode] + ' sings ' + moved.map(function (i) { return solName(q.degs[i], mode); }).join(", ") + '</div>' : "") +
        '<div class="oql-meta">beats ' + q.beats.join(" · ") + ' · widest leap ' + widest + '¢ · ' +
        (r.ok ? "rules ✓" : (q.fromBank === "old" ? "ancestor (exempt): " + r.fails.join(", ") : '<span class="bad">' + r.fails.join(", ") + "</span>")) +
        ' · sings in ' + (ms.length === 6 ? "all six modes" : ms.map(function (m) { return MODE_NAME[m]; }).join(", ")) + '</div>' +
        '<div class="oql-card-btns"><button type="button" data-play="' + w.id + '">▶ play</button>' +
        '<button type="button" data-choose="' + w.id + '">' + (lit ? "asking this one" : "ask this one") + '</button></div></div>');
    });
    $("oql-bank").innerHTML = html.join("");
    $("oql-bank").querySelectorAll("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () { playQuestion(b.getAttribute("data-play")); });
    });
    $("oql-bank").querySelectorAll("[data-choose]").forEach(function (b) {
      b.addEventListener("click", function () { state.chosen = b.getAttribute("data-choose"); refresh(); });
    });
    renderVisit();
    renderEvent();
  }
  function renderVisit() {
    var chips = state.visit.map(function (ev, i) {
      var n = i + 1;
      var q = ev && ev.question;
      return '<button type="button" class="oql-chip' + (n === state.n ? " on" : "") + '" data-meeting="' + n + '">meeting ' + n + '<br><b>' +
        (q ? qName(q) : "—") + '</b></button>';
    });
    $("oql-visit").innerHTML = chips.join("");
    $("oql-visit").querySelectorAll("[data-meeting]").forEach(function (b) {
      b.addEventListener("click", function () { $("oql-n").value = b.getAttribute("data-meeting"); readControls(); state.chosen = null; refresh(); });
    });
  }
  function groundOf(ev) { return state.ground === "auto" ? ev.ground : state.ground; }
  function squeezeText(ev) {
    var tl = ev.timeline;
    if (!tl.pressure) return "at its own pace";
    var bits = [];
    if (tl.keep < 1) {
      var cut = ev.answers.map(function (a) { var v = a.voices[0]; return (v.kept != null ? v.kept : v.notes.length) + " of " + (v.of != null ? v.of : v.notes.length); });
      bits.push("the answers broken off (" + cut.join(", ") + " notes)");
    }
    if (tl.tailS < 8) bits.push("the tail " + tl.tailS.toFixed(1) + " s");
    if (tl.gapMul < 1) bits.push("the breaths ×" + tl.gapMul.toFixed(2));
    if (tl.beatS < tl.naturalBeatS - 1e-9) bits.push("the asker hurried " + tl.naturalBeatS.toFixed(2) + " → " + tl.beatS.toFixed(2) + " s a beat");
    return "squeezed to fit (pressure " + tl.pressure.toFixed(2) + "): " + bits.join(", ");
  }
  function renderEvent() {
    var ev = state.ev, mode = state.mode;
    if (!ev) { $("oql-event").innerHTML = "<p>No question can be asked in this meeting.</p>"; return; }
    var q = ev.question, tl = ev.timeline;
    var b = ev.askings[1].bent;
    var bendTxt = b.kind === "note"
      ? "one note displaced: note " + (b.index + 1) + ", " + solName(b.from, mode) + " → " + solName(b.to, mode)
      : (b.variant === "late" ? "the rhythm shifted: comes in " + b.offsetBeats + " beat late, the first long clipped"
      : "the rhythm shifted: notes " + (b.index + 1) + "–" + (b.index + 2) + " trade lengths") + (b.hemmedIn ? " (every lawful note bend was shut)" : "");
    var st = ev.seat;
    var seatTxt = st ? "the " + st.section + " (" + Math.round(st.plannedS) + " s planned" + (st.stretched ? ", FORM grants " + Math.round(st.sectionS) + " s" : "") + "; cap 45 % = " + Math.round(st.capS) + " s)" : "nowhere — no section is long enough";
    var h = [];
    h.push("<p><strong>Meeting " + state.n + " asks " + qName(q) + "</strong> · " + solLine(q.degs, mode) +
      (ev.stepAside.length ? " · stepping aside: " + ev.stepAside.map(function (id) { return qName(state.bank.questions.filter(function (w) { return w.id === id; })[0]); }).join(", ") : "") + "</p>");
    h.push("<p>The asker's pace " + tl.naturalBeatS.toFixed(2) + " s a beat; " + squeezeText(ev) + ".</p>");
    h.push("<p>Asked three times. The second asking: " + bendTxt + ".</p>");
    h.push("<p>Ground: <strong>" + groundOf(ev) + "</strong>" + (state.ground !== "auto" ? " (forced; drawn: " + ev.ground + ")" : "") +
      (groundOf(ev) === "chorale" ? " — the strings, " + (ev.chorale ? ev.chorale.beatS : "2.0") + " s a beat, at their own pace" : " — the drone alone") + "</p>");
    h.push("<p>Seat: " + seatTxt + " · this event " + Math.round(tl.total) + " s (" + (tl.fits === false ? "<span style='color:#9a5a3a'>over the cap</span>" : tl.fits ? "fits" : "no cap") +
      "; at its own pace " + Math.round(ev.naturalS) + " s, its most hurried " + Math.round(ev.needS) + " s)</p>");
    var strip = ['<div class="oql-tl" id="oql-tl">'];
    tl.items.forEach(function (it) {
      var c = it.kind === "asking" ? "ask" : it.kind === "answer" ? "ans" : "tail";
      var lab = it.kind === "asking" ? "? " + (it.k + 1) + (it.k === 1 ? " bent" : "") : it.kind === "answer" ? "answer " + (it.k + 1) : "unanswered";
      strip.push('<span class="' + c + '" style="left:' + (100 * it.t / tl.total) + '%;width:' + (100 * it.dur / tl.total) + '%">' + lab + '</span>');
    });
    strip.push('<i class="head" id="oql-head"></i></div><div class="oql-tl-scale"><span>0 s</span><span>' + Math.round(tl.total) + ' s</span></div>');
    h.push(strip.join(""));
    var cards = [], marks = {};
    if (b.kind === "note") marks[b.index] = true;
    cards.push('<div class="oql-card"><div class="oql-card-top"><span class="oql-card-name">asking 2, bent</span></div>' +
      staffSVG(ev.askings[1].degs.map(function (d, i) { return { deg: d, beats: ev.askings[1].beats[i] }; }), mode, { mark: marks }) + '</div>');
    ev.answers.forEach(function (a) {
      a.voices.forEach(function (v) {
        var name = v.role === "doubling" ? "harmonium, second rank" : v.voice;
        var tag = v.role === "doubling" ? doublingTag(v.notes) : a.develop + " · from " + a.from;
        if (v.kept != null && v.kept < v.of) tag += " · broken off, " + v.kept + " of " + v.of;
        cards.push('<div class="oql-card"><div class="oql-card-top"><span class="oql-card-name">answer ' + (a.k + 1) + ' · ' + name + '</span>' +
          '<span class="oql-card-tag">' + tag + '</span></div>' +
          staffSVG(v.notes, mode) +
          '<div class="oql-meta">' + v.notes.map(function (n) { return solName(n.deg, mode); }).join(" ") + '</div></div>');
      });
    });
    h.push('<div class="oql-answers">' + cards.join("") + "</div>");
    $("oql-event").innerHTML = h.join("");
  }
  function doublingTag(notes) {
    var c = {};
    notes.forEach(function (n) { c[n.interval] = (c[n.interval] || 0) + 1; });
    var k = Object.keys(c);
    return "a pure " + (k.length === 1 ? k[0] : k.map(function (x) { return x + " ×" + c[x]; }).join(", ")) + " above, in the scale";
  }

  function refresh() {
    stop();
    state.bank = bankFor(state.seed);
    state.visit = visitFor(state.seed, state.mode, material(), state.room, MEETINGS, state.chosen, state.n);
    state.ev = state.visit[state.n - 1];
    render();
  }

  // ==========================================================================
  // AUDIO — the master chain (after kolob-audio.js: glue → master 0.6 →
  // tanh saturation → compressor) with a brick-wall limiter at the end, and
  // a small seeded hall. Layer gains are the app's defaults. chainFor()
  // builds it on any context — the live one, or an OfflineAudioContext for
  // silent measurement.
  // ==========================================================================
  var LAYER_VOL = { clarinet: 0.38, harmonium: 0.45, strings: 0.5, drone: 0.55 };
  var MASTER = 0.6;
  // the voices' levels in a performance. The asker is the clarinet, central.
  // The answerers grow as Ives's flutes do: the first well under the asker,
  // attempting; the last over it — the outburst that is the piece's climax,
  // and then nothing.
  var ASKER = 0.9;
  var ANSWER_MIX = [
    { harmonium: 1.9, doubling: 1.2, clarinet: 0.55 },
    { harmonium: 4.2, doubling: 2.4, clarinet: 0.8 },
  ];
  function chainFor(c) {
    var t = 0;
    var voicesIn = c.createGain(); voicesIn.gain.setValueAtTime(1, t);
    var glue = c.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = c.createGain(); master.gain.setValueAtTime(MASTER, t);
    var sat = c.createWaveShaper();
    var curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = curve; sat.oversample = "2x";
    var comp = c.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var lim = c.createDynamicsCompressor();                         // the limiter: nothing past −1.5 dBFS
    lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
    voicesIn.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim);
    lim.connect(c.destination);
    // the hall: a short seeded pour of decaying noise, early taps first
    var sr = c.sampleRate, len = Math.floor(sr * 2.4), ir = c.createBuffer(2, len, sr);
    var ns = Rand.stream(7).fork("synth:lab:hall");
    for (var ch = 0; ch < 2; ch++) {
      var dd = ir.getChannelData(ch);
      for (var k = 0; k < len; k++) {
        var tt = k / sr;
        dd[k] = (ns.rnd(0, 1) * 2 - 1) * Math.exp(-tt * 2.9) * Math.min(1, tt / 0.05) * 0.55;
      }
      [[0.011, 0.6], [0.019, 0.45], [0.031, 0.35], [0.047, 0.25]].forEach(function (tap) { dd[Math.floor(tap[0] * sr) + ch * 7] += tap[1]; });
    }
    var hall = c.createConvolver(); hall.buffer = ir;
    var wet = c.createGain(); wet.gain.setValueAtTime(0.32, t);
    hall.connect(wet); wet.connect(voicesIn);
    var LAYER = {};
    Object.keys(LAYER_VOL).forEach(function (name) {
      var g = c.createGain(); g.gain.setValueAtTime(LAYER_VOL[name], t);
      g.connect(voicesIn); g.connect(hall);
      LAYER[name] = g;
    });
    return { ctx: c, out: lim, LAYER: LAYER };
  }
  var live = null, P = null, timers = [];
  function ensureLive() {
    if (!live) live = chainFor(new (window.AudioContext || window.webkitAudioContext)());
    if (live.ctx.state === "suspended") live.ctx.resume();
    return live;
  }
  // a PERFORMANCE: its own bus per layer (so STOP can fade it without a
  // click), its own node list, and its own sound-level jitter stream
  function performance(chain, seed, solo) {
    var c = chain.ctx, bus = {};
    Object.keys(chain.LAYER).forEach(function (name) {
      var g = c.createGain(); g.gain.setValueAtTime(solo && solo !== name ? 0 : 1, 0); g.connect(chain.LAYER[name]); bus[name] = g;
    });
    return { ctx: c, bus: bus, nodes: [], syn: Rand.stream(seed).fork("synth:lab") };
  }
  function stop() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
    if (!P) { setNow(""); return; }
    var t = P.ctx.currentTime, old = P;
    Object.keys(old.bus).forEach(function (k) {
      var g = old.bus[k].gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.12);
    });
    old.nodes.forEach(function (o) { try { o.stop(t + 0.2); } catch (e) {} });
    setTimeout(function () { Object.keys(old.bus).forEach(function (k) { try { old.bus[k].disconnect(); } catch (e) {} }); }, 600);
    P = null;
    var head = $("oql-head"); if (head) head.style.display = "none";
    setNow("");
  }
  function osc(p, type, f, t) {
    var o = p.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); p.nodes.push(o); return o;
  }
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  function pan(p, dest, v, t) {
    var sp = p.ctx.createStereoPanner(); sp.pan.setValueAtTime(v, t); sp.connect(dest); return sp;
  }

  // THE CLARINET — the deacon, after renderClarinetLine: triangle + a soft
  // octave sine through a fixed lowpass, portamento between notes, a
  // delayed shallow vibrato. (Its grace note, an equal-tempered whole step
  // in v0.30, is left out: the Question is asked plain.)
  function clarinetLine(p, t, notes, gainMul, pv) {
    var c = p.ctx, dest = pan(p, p.bus.clarinet, pv || 0, t);
    var o = osc(p, "triangle", notes[0].f, t), o8 = osc(p, "sine", notes[0].f * 2, t);
    var g8 = c.createGain(); g8.gain.setValueAtTime(0.12, t);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(9000, notes[0].f * 5), t);
    var g = c.createGain();
    o.connect(lp); o8.connect(g8); g8.connect(lp); lp.connect(g); g.connect(dest);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.04, Math.min(0.2, n.dur * 0.25));
        o.frequency.setValueAtTime(notes[i - 1].f, tt); o.frequency.linearRampToValueAtTime(n.f, tt + port);
        o8.frequency.setValueAtTime(notes[i - 1].f * 2, tt); o8.frequency.linearRampToValueAtTime(n.f * 2, tt + port);
      }
      tt += n.dur; total += n.dur;
    }
    var lfo = osc(p, "sine", p.syn.rnd(4.5, 5.5), t);
    var lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + total * 0.4);
    lg.gain.linearRampToValueAtTime(notes[0].f * 0.004 * 0.8, t + total * 0.7);
    lfo.connect(lg); lg.connect(o.frequency);
    var peak = (gainMul || 1) * 0.34;
    var atk = Math.min(p.syn.rnd(0.4, 0.8), Math.max(0.08, total * 0.3));
    var rel = Math.min(p.syn.rnd(0.9, 1.4), Math.max(0.3, total * 0.5));
    var end = env(g, t, [[atk, peak], [Math.max(0.05, total - atk - rel * 0.4), peak * 0.9], [rel, 0]]);
    [o, o8, lfo].forEach(function (x) { x.start(t); x.stop(end + 0.1); });
    return total;
  }
  // THE HARMONIUM — the parlor pump organ, after renderHarmonium: a detuned
  // saw pair through a still reed formant; the bellows breathe (0.2–0.4 Hz)
  // in their own gain stage.
  function harmoniumLine(p, t, notes, gainMul, pv) {
    var c = p.ctx, dest = pan(p, p.bus.harmonium, pv || 0, t);
    var mix = c.createGain(), os = [];
    for (var d = 0; d < 2; d++) {
      var o = osc(p, "sawtooth", notes[0].f * (d ? 1.004 : 0.996), t);
      var og = c.createGain(); og.gain.setValueAtTime(0.5, t);
      o.connect(og); og.connect(mix); os.push(o);
    }
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(2000, t); bp.Q.setValueAtTime(3.5, t);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
    var bel = c.createGain(); bel.gain.setValueAtTime(1, t);
    var g = c.createGain();
    // the reed's body: v0.30's still formant alone thins an answer to a
    // whisper at −45 dB, lost under the drone; a dark parallel path gives the
    // answerers the chest to argue with
    var body = c.createBiquadFilter(); body.type = "lowpass"; body.frequency.setValueAtTime(1400, t);
    var bg = c.createGain(); bg.gain.setValueAtTime(0.55, t);
    mix.connect(bp); bp.connect(lp); mix.connect(body); body.connect(bg); bg.connect(lp);
    lp.connect(bel); bel.connect(g); g.connect(dest);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        for (var oi = 0; oi < os.length; oi++) {
          var det = oi ? 1.004 : 0.996;
          os[oi].frequency.setValueAtTime(notes[i - 1].f * det, tt);
          os[oi].frequency.linearRampToValueAtTime(n.f * det, tt + Math.min(0.12, n.dur * 0.3));
        }
      }
      tt += n.dur; total += n.dur;
    }
    var lfo = osc(p, "sine", p.syn.rnd(0.2, 0.4), t);
    var lg = c.createGain(); lg.gain.setValueAtTime(0.1, t);
    lfo.connect(lg); lg.connect(bel.gain);
    var peak = (gainMul || 1) * 0.22;
    var atk = Math.min(p.syn.rnd(0.35, 0.6), Math.max(0.06, total * 0.25));
    var rel = Math.min(p.syn.rnd(0.8, 1.2), Math.max(0.3, total * 0.4));
    var end = env(g, t, [[atk, peak], [Math.max(0.05, total - atk - rel * 0.3), peak * 0.9], [rel, 0]]);
    os.concat([lfo]).forEach(function (x) { x.start(t); x.stop(end + 0.1); });
    return total;
  }
  // THE DRONE — after droneCycle: sine partials 1–4 of F0 and a quiet fifth
  // an octave up. It was there before the question and stays after it: it
  // swells in, HOLDS for the whole of dur, and only then lets go.
  function drone(p, t, dur, f0) {
    var c = p.ctx, m = c.createGain(); m.connect(p.bus.drone);
    var edge = Math.min(4, Math.max(0.5, dur * 0.15));
    var end = env(m, t, [[edge, 0.45], [Math.max(0.1, dur - edge), 0.43], [edge, 0]]);
    [[1, 0.4], [2, 0.24], [3, 0.12], [4, 0.07], [6, 0.04]].forEach(function (pt) {
      var o = osc(p, "sine", f0 * pt[0], t);
      var og = c.createGain(); og.gain.setValueAtTime(pt[1], t);
      o.connect(og); og.connect(m);
      o.start(t); o.stop(end + 0.1);
    });
    return end;
  }
  // THE STRINGS — Ives's strings, after stringsPad: three detuned saws per
  // part through a fixed lowpass, four parts moving together from chord to
  // chord at the chorale's own slow beat, bowing on regardless, and drawing
  // breath (loopGapBeats) between passes.
  function chorale(p, t, dur, ch, doHz) {
    var c = p.ctx, m = c.createGain(); m.connect(p.bus.strings);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1150, t); lp.connect(m);
    var gap = ch.loopGapBeats != null ? ch.loopGapBeats : 2;
    var seq = [], tt = 0, ci = 0;
    while (tt < dur) { var cc = ch.chords[ci % ch.chords.length]; seq.push({ t: tt, c: cc }); tt += cc.beats * ch.beatS; ci++; if (ci % ch.chords.length === 0) tt += ch.beatS * gap; }
    for (var part = 0; part < 4; part++) {
      var pg = c.createGain(); pg.gain.setValueAtTime(part === 0 ? 0.034 : 0.026, t); pg.connect(lp);
      for (var d = 0; d < 3; d++) {
        var spread = 1 + (d - 1) * p.syn.rnd(0.002, 0.0035);
        var f = function (s) { return doHz * Q.ratioOf(s.c.monzos[Math.min(part, s.c.monzos.length - 1)]) * spread; };
        var o = osc(p, "sawtooth", f(seq[0]), t);
        for (var s = 1; s < seq.length; s++) {
          var at = t + seq[s].t;
          o.frequency.setValueAtTime(f(seq[s - 1]), at - 0.18);
          o.frequency.linearRampToValueAtTime(f(seq[s]), at);
        }
        o.connect(pg); o.start(t); o.stop(t + dur + 0.2);
      }
    }
    var edge = Math.min(6, dur * 0.2);
    env(m, t, [[edge, 0.45], [Math.max(0.5, dur - edge * 2), 0.42], [edge, 0]]);   // ppp, offstage
  }

  // ==========================================================================
  // PERFORM
  // ==========================================================================
  function f0For(seed) { return Math.round(Rand.stream(seed).fork("lab:f0").rnd(58, 74) * 10) / 10; }
  function doHz(seed) { return f0For(seed) * 4; }                  // the choir's do; the clarinet sits an octave up
  function asHz(notes, beatS, seed, octUp) {
    var base = doHz(seed) * (octUp ? 2 : 1);
    return notes.map(function (n) {
      return { f: base * Q.ratioOf(n.monzo), dur: Math.max(0.12, (n.beats != null ? n.beats : 1) * beatS) };
    });
  }
  function setNow(txt) { var el = $("oql-now"); if (el) el.textContent = txt; }
  function later(sec, fn) { timers.push(setTimeout(fn, Math.max(0, sec * 1000))); }

  // one question, alone over the drone, at the asker's own unhurried pace:
  // the drone first, then the question, and the drone still there under
  // the held last note and a breath beyond it
  function scheduleQuestion(p, t0, q, beat, seed) {
    var notes = asHz(q.degs.map(function (d, i) { return { deg: d, beats: q.beats[i], monzo: q.monzos[i] }; }), beat, seed, true);
    var lead = 1.5, tot = 0;
    notes.forEach(function (n) { tot += n.dur; });
    drone(p, t0, lead + tot + 3.5, f0For(seed));
    clarinetLine(p, t0 + lead, notes, ASKER, 0);
    return { start: t0 + lead, total: lead + tot + 3.5 + 1.5 };
  }
  function playQuestion(id) {
    var q = Q.eligible(state.bank, state.mode, {}).pool.filter(function (x) { return x.id === id; })[0];
    if (!q) return;
    stop();
    P = performance(ensureLive(), state.seed);
    var beat = state.ev ? state.ev.timeline.naturalBeatS : 0.85;
    var r = scheduleQuestion(P, P.ctx.currentTime + 0.1, q, beat, state.seed);
    setNow(qName(q) + " · " + solLine(q.degs, state.mode) + " · " + beat.toFixed(2) + " s a beat");
    later(r.total, function () { setNow(""); });
  }

  // the whole event: the drone first, then the three askings and the
  // answers on the timeline, and the ground beneath
  function scheduleFull(p, t0, ev, gr, seed, mode, cb) {
    var tl = ev.timeline, beat = tl.beatS;
    var lead = 3, T = t0 + lead, total = tl.total + lead;
    drone(p, t0, total, f0For(seed));
    if (gr === "chorale") {
      var ch = ev.chorale || Q.chorale(material(), Rand.stream(seed).fork("question:" + (ev.n || 1)).fork("ground").fork("chorale"), mode);
      chorale(p, t0 + 0.5, total, ch, doHz(seed));
    }
    var segs = [];
    tl.items.forEach(function (it) {
      segs.push({ kind: it.kind, k: it.k, t: T + it.t, dur: it.dur });
      if (it.kind === "asking") {
        var a = ev.askings[it.k];
        var notes = asHz(a.degs.map(function (d, i) { return { deg: d, beats: a.beats[i], monzo: a.monzos[i] }; }), beat, seed, true);
        clarinetLine(p, T + it.t + (a.offsetBeats || 0) * beat, notes, ASKER, 0);
        if (cb) cb(lead + it.t, "? the question — asking " + (it.k + 1) + (a.bent ? " (bent)" : ""));
      } else if (it.kind === "answer") {
        var an = ev.answers[it.k], mix = ANSWER_MIX[Math.min(it.k, ANSWER_MIX.length - 1)];
        an.voices.forEach(function (v) {
          var at = T + it.t + v.entryBeats * beat;
          var ns = asHz(v.notes, beat, seed, true);
          if (v.voice === "clarinet") clarinetLine(p, at, ns, mix.clarinet, 0.35);
          else if (v.role === "doubling") harmoniumLine(p, at, ns, mix.doubling, -0.35);
          else harmoniumLine(p, at, ns, mix.harmonium, -0.2);
        });
        if (cb) cb(lead + it.t, "the answer " + (it.k + 1) + " — " + an.develop + ", from " + an.from);
      } else if (cb) {
        cb(lead + it.t + 1.5, "? unanswered — " + (gr === "chorale" ? "the strings play on" : "the drone alone"));
      }
    });
    return { start: T, total: total, segments: segs };
  }
  function playFull() {
    var ev = state.ev;
    if (!ev) return null;
    stop();
    P = performance(ensureLive(), state.seed);
    var t0 = P.ctx.currentTime + 0.15;
    var r = scheduleFull(P, t0, ev, groundOf(ev), state.seed, state.mode, function (at, txt) { later(at, function () { setNow(txt); }); });
    // a playhead on the strip (clock-driven, not animation-driven)
    var head = $("oql-head"), mine = P, tl = ev.timeline;
    if (head) head.style.display = "block";
    var tick = function () {
      if (P !== mine) return;
      var el = mine.ctx.currentTime - r.start;
      if (head) head.style.left = Math.max(0, Math.min(100, 100 * el / tl.total)) + "%";
      if (el < tl.total + 1) timers.push(setTimeout(tick, 250));
      else { setNow(""); if (head) head.style.display = "none"; }
    };
    tick();
    return { start: r.start, total: r.total };
  }
  // OFFLINE — the same performance rendered silently, for measurement.
  // opts: { seed, mode, n, ground, room, material, question: id (one
  // question alone), solo: layer name }. Resolves to { buffer, segments }.
  function renderOffline(opts) {
    opts = opts || {};
    var seed = opts.seed != null ? opts.seed : state.seed, mode = opts.mode || state.mode, n = opts.n || state.n;
    var mat = (opts.material || state.material) === "hymns" ? HYMN_LINES : [];
    var evs = visitFor(seed, mode, mat, opts.room || state.room, n, opts.chosen || null, n), ev = evs[n - 1];
    var sr = 48000, r, dur;
    if (opts.question) {
      var q = Q.eligible(bankFor(seed), mode, {}).pool.filter(function (x) { return x.id === opts.question; })[0];
      var qd = 1.5 + 5; q.beats.forEach(function (b) { qd += b * ev.timeline.naturalBeatS; });
      dur = qd + 1;
      var oc1 = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
      var p1 = performance(chainFor(oc1), seed, opts.solo);
      r = scheduleQuestion(p1, 0.05, q, ev.timeline.naturalBeatS, seed);
      return oc1.startRendering().then(function (buf) { return { buffer: buf, start: r.start, total: r.total, ev: ev }; });
    }
    dur = ev.timeline.total + 3 + 3;
    var oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    var p = performance(chainFor(oc), seed, opts.solo);
    var gr = opts.ground && opts.ground !== "auto" ? opts.ground : ev.ground;
    r = scheduleFull(p, 0.05, ev, gr, seed, mode, null);
    return oc.startRendering().then(function (buf) { return { buffer: buf, start: r.start, total: r.total, segments: r.segments, ev: ev, ground: gr }; });
  }

  // ==========================================================================
  // STATS over 200 visits. The rule check is RESTATED here from plain
  // ratios, independent of Q.rules, and so are the critic's measures (the
  // triad leap, the arpeggio, the doubling's interval), so the module is
  // not marking its own homework.
  // ==========================================================================
  var RATIOS = {
    ionian: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8], mixolydian: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9],
    dorian: [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9], aeolian: [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9],
    penta: [1, 9/8, 5/4, null, 3/2, 5/3, null], hexa: [1, 9/8, 5/4, 4/3, 3/2, 5/3, null],
  };
  function labCents(d, mode) {
    var r = RATIOS[mode][cls(d)];
    return r == null ? null : 1200 * Math.log2(r) + 1200 * Math.floor(d / 7);
  }
  function inLattice(monzo, mode) {
    var r = Q.ratioOf(monzo), oct = Math.floor(Math.log2(r) + 1e-9), red = r / Math.pow(2, oct);
    return RATIOS[mode].some(function (x) { return x != null && Math.abs(x - red) < 1e-9; });
  }
  function labRules(q, mode) {
    var f = [], d = q.degs, b = q.beats, n = d.length;
    if (n < 5 || n > 6) f.push("length");
    var c = d.map(function (x) { return labCents(x, mode); });
    if (c.some(function (x) { return x == null; })) return ["outside the scale"];
    if (!(c[1] > c[0])) f.push("first move not upward");
    if (c.slice(1).some(function (x) { return x <= c[0]; })) f.push("dips below its start");
    if (c[n - 1] - c[0] < 480) f.push("not rising a fourth");
    var big = false, leaps = 0, turns = 0;
    for (var i = 1; i < n; i++) {
      var iv = Math.abs(c[i] - c[i - 1]);
      if (iv >= 790 && iv <= 1130) big = true;
      if (iv >= 250) leaps++;
      if (iv > 1150) f.push("wider than a seventh");
      if (iv < 1) f.push("a repeated note");
      if (i > 1 && (c[i] > c[i - 1]) !== (c[i - 1] > c[i - 2])) turns++;
    }
    if (!big) f.push("no sixth or seventh");
    if (leaps < 2 || turns < 1) f.push("not angular");
    if ([0, 2, 4].indexOf(cls(d[n - 1])) >= 0) f.push("ends on the tonic triad");
    if (d[n - 1] < 5) f.push("ends low");
    var higher = {};
    for (i = 0; i < n - 1; i++) if (c[i] > c[n - 1] + 0.01) higher[Math.round(c[i])] = 1;
    if (Object.keys(higher).length > 1) f.push("last not highest or second-highest");
    if (c[n - 1] - c[n - 2] < -400) f.push("falls more than a third at the end");
    if (Math.max.apply(null, d) > 12 || Math.min.apply(null, d) < -2 || Math.max.apply(null, d) - Math.min.apply(null, d) > 11) f.push("out of range");
    var last = b[n - 1];
    var fam = b[0] > b[1] && b[0] > b[2] && last >= 2.5 && b.slice(0, -1).every(function (x) { return last >= 1.5 * x; }) &&
              Math.max(b[n - 2], b[n - 3]) > b[1];
    if (!fam) f.push("rhythm outside the family");
    return f;
  }
  function triadLeap(q, mode) {
    for (var i = 1; i < q.degs.length; i++) {
      var w = Math.abs(labCents(q.degs[i], mode) - labCents(q.degs[i - 1], mode));
      if (w >= 790 && w <= 1130 && [0, 2, 4].indexOf(cls(q.degs[i])) >= 0 && [0, 2, 4].indexOf(cls(q.degs[i - 1])) >= 0) return true;
    }
    return false;
  }
  function arpeggio(q) {
    var t = q.degs.map(function (d) { return [0, 2, 4].indexOf(cls(d)) >= 0; });
    for (var i = 2; i < t.length; i++) if (t[i] && t[i - 1] && t[i - 2]) return true;
    return false;
  }
  function intervalName(c) {
    var names = [[702, "fifth"], [386, "M3"], [316, "m3"], [884, "M6"], [814, "m6"], [498, "fourth"]], a = Math.abs(c);
    for (var i = 0; i < names.length; i++) if (Math.abs(a - names[i][0]) < 1) return names[i][1] + (c < 0 ? " below" : "");
    return Math.round(c) + "¢";
  }
  function measure(mode, from, room) {
    var R = { mode: mode, gen: 0, pass: 0, fails: {}, uniqP: {}, uniqPR: {}, phrase: {}, starts: {}, ends: {}, triadLeap: 0, arp: 0,
              tries: 0, ruleRej: 0, evalRej: 0, lawful: 0, elig: [], adjacent: 0, meetings: 0,
              verbatim: 0, bentOk: 0, bends: { note: 0, rhythm: 0 }, hemmed: 0, ansN: 0, ansIn: 0, rise: 0, faster: 0,
              dbl: {}, dblN: 0, chordN: 0, chordBad: 0, chor: 0, seats: {}, squeeze: {}, fitsN: 0, excluded: 0,
              self: { verbatim: 0, embedded: 0, moved: 0, octave: 0, n: 0 } };
    for (var s = from; s < from + 200; s++) {
      var bk = bankFor(s), st = bk.stats;
      R.tries += st.tries; R.ruleRej += st.ruleRejects + st.familyRejects; R.evalRej += st.evalRejects; R.lawful += st.tries - st.ruleRejects - st.familyRejects;
      var el = Q.eligible(bk, mode, {});
      R.elig.push(el.pool.length);
      R.excluded += Q.eligible(bk, mode, { excludeLines: HYMN_LINES }).out.filter(function (o) { return /hymns/.test(o.why); }).length;
      var first = null;
      el.pool.forEach(function (q) {
        if (q.fromBank !== "gen") return;
        if (!first) first = q;
        R.gen++;
        var fl = labRules(q, mode);
        if (!fl.length) R.pass++; else fl.forEach(function (x) { R.fails[x] = (R.fails[x] || 0) + 1; });
        var key = solLine(q.degs, mode);
        R.uniqP[key] = 1; R.uniqPR[key + "/" + q.beats.join(".")] = 1; R.phrase[key] = (R.phrase[key] || 0) + 1;
        var e = solName(q.degs[q.degs.length - 1], mode), b0 = solName(q.degs[0], mode);
        R.ends[e] = (R.ends[e] || 0) + 1; R.starts[b0] = (R.starts[b0] || 0) + 1;
        if (triadLeap(q, mode)) R.triadLeap++;
        if (arpeggio(q)) R.arp++;
      });
      // the hymn-line self-test: the first new question, sung back as a line
      if (first) {
        R.self.n++;
        var size = mode === "penta" ? 5 : mode === "hexa" ? 6 : 7;
        var classes = [0, 1, 2, 3, 4, 5, 6].filter(function (c) { return RATIOS[mode][c] != null; });
        var moved = first.degs.map(function (d) { var i = Q.scaleIndex(d, mode) + 2; return Math.floor(i / size) * 7 + classes[((i % size) + size) % size]; });
        var tests = { verbatim: first.degs, embedded: [0, 1].concat(first.degs, [2, 1]), moved: [0].concat(moved, [0]), octave: first.degs.map(function (d) { return d - 7; }) };
        Object.keys(tests).forEach(function (k) {
          if (Q.eligible(bk, mode, { excludeLines: [tests[k]] }).out.some(function (o) { return o.id === first.id; })) R.self[k]++;
        });
      }
      // three meetings of the visit, the last heard stepping aside each time
      var evs = visitFor(s, mode, s % 2 ? HYMN_LINES : [], room, 3, null, 0);
      for (var m = 1; m < evs.length; m++) { R.meetings++; if (evs[m] && evs[m - 1] && evs[m].question.id === evs[m - 1].question.id) R.adjacent++; }
      var ev = evs[0];
      if (!ev) continue;
      var a = ev.askings, q0 = ev.question;
      if (a[0].degs.join() === q0.degs.join() && a[2].degs.join() === q0.degs.join() && a[0].beats.join() === q0.beats.join() && a[2].beats.join() === q0.beats.join()) R.verbatim++;
      var b1 = a[1].bent;
      R.bends[b1.kind]++;
      if (b1.hemmedIn) R.hemmed++;
      var diffNotes = a[1].degs.filter(function (d, i) { return d !== q0.degs[i]; }).length;
      var diffBeats = a[1].beats.join() !== q0.beats.join() || a[1].offsetBeats > 0;
      var lawful = true;
      if (b1.kind === "note") {
        var before = labRules(q0, mode);
        lawful = labRules({ degs: a[1].degs, beats: q0.beats }, mode).every(function (x) { return x === "no sixth or seventh" || before.indexOf(x) >= 0; });
      }
      if (lawful && ((b1.kind === "note" && diffNotes === 1 && !diffBeats) || (b1.kind === "rhythm" && diffNotes === 0 && diffBeats))) R.bentOk++;
      ev.answers.forEach(function (an) {
        var main = an.voices[0].notes;
        an.voices.forEach(function (v) {
          v.notes.forEach(function (nn, i) {
            R.ansN++; if (inLattice(nn.monzo, mode)) R.ansIn++;
            if (v.role === "doubling") {
              R.dblN++;
              var c = 1200 * Math.log2(Q.ratioOf(nn.monzo) / Q.ratioOf(main[i].monzo));
              var nm = intervalName(c); R.dbl[nm] = (R.dbl[nm] || 0) + 1;
            }
          });
        });
      });
      var full = ev.answersFull || ev.answers;
      var h0 = full[0].voices[0].notes, h1 = full[1].voices[0].notes;
      var mean = function (arr, key) { return arr.reduce(function (x, y) { return x + y[key]; }, 0) / arr.length; };
      if (mean(h1, "deg") > mean(h0, "deg")) R.rise++;
      if (mean(h1, "beats") < mean(h0, "beats")) R.faster++;
      Q.chorale(HYMN_LINES, Rand.stream(s).fork("question:1").fork("ground").fork("chorale"), mode).chords.forEach(function (c) {
        R.chordN++; for (var i = 1; i < c.degs.length; i++) if (c.degs[i] <= c.degs[i - 1]) { R.chordBad++; break; }
      });
      if (ev.ground === "chorale") R.chor++;
      var sk = ev.seat ? ev.seat.section : "—";
      R.seats[sk] = (R.seats[sk] || 0) + 1;
      var z = R.squeeze[sk] = R.squeeze[sk] || { n: 0, easy: 0, cut: 0, breaths: 0, hurried: 0 };
      var tl = ev.timeline;
      z.n++; if (!tl.pressure) z.easy++; if (tl.keep < 1) z.cut++; if (tl.gapMul < 1) z.breaths++; if (tl.beatS < tl.naturalBeatS - 1e-9) z.hurried++;
      if (tl.fits !== false) R.fitsN++;
    }
    var ch3000 = 0;
    for (var g = from; g < from + 3000; g++) if (Q.ground(Rand.stream(g).fork("question:1").fork("ground")) === "chorale") ch3000++;
    R.chor3000 = ch3000;
    return R;
  }
  function pct(a, b) { return b ? (100 * a / b).toFixed(1) + " %" : "—"; }
  function shares(obj, total, max) {
    return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, max || 9)
      .map(function (k) { return "<b>" + k + "</b> " + (100 * obj[k] / total).toFixed(0) + "%"; }).join(" · ");
  }
  function renderStats(rows) {
    var h = [];
    rows.forEach(function (r) {
      var ok = r.pass === r.gen;
      var top = Object.keys(r.phrase).sort(function (a, b) { return r.phrase[b] - r.phrase[a]; }).slice(0, 3);
      var el = r.elig, elMin = Math.min.apply(null, el), elMean = el.reduce(function (x, y) { return x + y; }, 0) / el.length;
      var seatTxt = Object.keys(r.seats).sort(function (a, b) { return r.seats[b] - r.seats[a]; }).map(function (k) {
        var z = r.squeeze[k];
        return "<b>" + k + "</b> " + r.seats[k] + (z ? " <span class='oql-meta'>(own pace " + z.easy + ", answers cut " + z.cut + ", breaths " + z.breaths + ", hurried " + z.hurried + ")</span>" : "");
      }).join("<br>");
      var self = r.self;
      h.push('<section class="oql-mode"><h3>' + MODE_NAME[r.mode] + '</h3><dl>' +
        '<dt>rules kept</dt><dd class="' + (ok ? "ok" : "bad") + '">' + pct(r.pass, r.gen) + ' <span class="oql-meta">' + r.pass + "/" + r.gen + " new questions as sung here" + (ok ? "" : " · " + Object.keys(r.fails).join(", ")) + '</span></dd>' +
        '<dt>can be asked here</dt><dd>' + elMean.toFixed(1) + ' of 7 per visit <span class="oql-meta">(fewest ' + elMin + '; the rest have no lawful way round a missing tone)</span></dd>' +
        '<dt>distinct</dt><dd>' + Object.keys(r.uniqP).length + " / " + r.gen + ' by pitch <span class="oql-meta">· ' + Object.keys(r.uniqPR).length + " with rhythm</span></dd>" +
        '<dt>commonest</dt><dd class="oql-meta">' + top.map(function (k) { return k + " ×" + r.phrase[k]; }).join("<br>") + '</dd>' +
        '<dt>ends on</dt><dd class="oql-meta">' + shares(r.ends, r.gen) + '</dd>' +
        '<dt>starts on</dt><dd class="oql-meta">' + shares(r.starts, r.gen) + '</dd>' +
        '<dt>bugle calls</dt><dd>' + r.triadLeap + ' triad leaps · ' + r.arp + ' arpeggios <span class="oql-meta">(of ' + r.gen + ')</span></dd>' +
        '<dt>the critic</dt><dd class="oql-meta">turned away ' + pct(r.evalRej, r.lawful) + ' of lawful candidates; the rules refused ' + pct(r.ruleRej, r.tries) + ' of raw draws</dd>' +
        '<dt>askings</dt><dd class="oql-meta">1st & 3rd verbatim ' + r.verbatim + '/200 · 2nd bent and still lawful ' + r.bentOk + '/200 (note ' + r.bends.note + ', rhythm ' + r.bends.rhythm + ', of which hemmed in ' + r.hemmed + ')</dd>' +
        '<dt>the visit</dt><dd class="oql-meta">the same question twice running: ' + r.adjacent + ' of ' + r.meetings + ' meetings</dd>' +
        '<dt>answers</dt><dd class="oql-meta">in the scale ' + pct(r.ansIn, r.ansN) + ' · 2nd higher ' + r.rise + '/200, faster ' + r.faster + '/200</dd>' +
        '<dt>second rank</dt><dd class="oql-meta">' + shares(r.dbl, r.dblN) + '</dd>' +
        '<dt>chorale</dt><dd class="oql-meta">ground ' + pct(r.chor, 200) + ' (over 3000 seeds ' + pct(r.chor3000, 3000) + ') · chords not in four distinct rising parts: ' + r.chordBad + '/' + r.chordN + '</dd>' +
        '<dt>hymn lines</dt><dd class="oql-meta">self-test refused verbatim ' + self.verbatim + '/' + self.n + ', inside a line ' + self.embedded + ', moved up two steps ' + self.moved + ', an octave down ' + self.octave + ' · the six stand-ins turned away ' + r.excluded + '</dd>' +
        '<dt>seats</dt><dd>' + seatTxt + '<br><span class="oql-meta">fits its cap ' + r.fitsN + '/200</span></dd>' +
        '</dl></section>');
    });
    $("oql-stats").innerHTML = '<div class="oql-modes">' + h.join("") + "</div>";
  }
  function runStats(modes) {
    $("oql-stats").innerHTML = "<p class='oql-meta'>measuring…</p>";
    var rows = [];
    var i = 0;
    (function step() {
      if (i >= modes.length) { renderStats(rows); return; }
      rows.push(measure(modes[i++], Math.max(1, state.seed), state.room));
      setTimeout(step, 0);
    })();
    return rows;
  }

  // ==========================================================================
  // WIRING
  // ==========================================================================
  function readControls() {
    state.seed = Math.max(0, Math.floor(+$("oql-seed").value || 0));
    state.mode = $("oql-mode").value;
    state.n = Math.max(1, Math.min(MEETINGS, Math.floor(+$("oql-n").value || 1)));
    state.material = $("oql-material").value;
    state.ground = $("oql-ground").value;
    state.room = $("oql-room").value;
  }
  function init() {
    ["oql-seed", "oql-mode", "oql-n", "oql-material", "oql-room"].forEach(function (id) {
      $(id).addEventListener("change", function () { readControls(); state.chosen = null; refresh(); });
    });
    $("oql-ground").addEventListener("change", function () { readControls(); renderEvent(); });
    $("oql-prev").addEventListener("click", function () { $("oql-seed").value = Math.max(0, state.seed - 1); readControls(); state.chosen = null; refresh(); });
    $("oql-next").addEventListener("click", function () { $("oql-seed").value = state.seed + 1; readControls(); state.chosen = null; refresh(); });
    $("oql-play").addEventListener("click", function () { playFull(); });
    $("oql-stop").addEventListener("click", stop);
    $("oql-stats-mode").addEventListener("click", function () { runStats([state.mode]); });
    $("oql-stats-all").addEventListener("click", function () { runStats(Q.MODES); });
    readControls();
    refresh();
    runStats([state.mode]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return {
    playFull: playFull, playQuestion: playQuestion, stop: stop, renderOffline: renderOffline,
    measure: measure, labRules: labRules, runStats: runStats,
    set: function (o) {
      if (o.seed != null) $("oql-seed").value = o.seed;
      if (o.mode) $("oql-mode").value = o.mode;
      if (o.n) $("oql-n").value = o.n;
      if (o.ground) $("oql-ground").value = o.ground;
      if (o.material) $("oql-material").value = o.material;
      if (o.room) $("oql-room").value = o.room;
      readControls(); state.chosen = o.chosen != null ? o.chosen : null; refresh();
      return state.ev;
    },
    output: function () { return ensureLive().out; },
    layers: function () { return ensureLive().LAYER; },          // dev: per-voice taps for measurement
    context: function () { return ensureLive().ctx; },
    event: function () { return state.ev; },
    bank: function () { return state.bank; },
    mix: { ASKER: ASKER, ANSWER_MIX: ANSWER_MIX },
  };
})();
