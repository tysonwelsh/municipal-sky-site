// ============================================================================
// QUESTION LAB — audition bench for KOLOB.Question (kolob-question.js).
// UNLINKED dev tool, like tune-lab and room-lab.
//
// The QUESTIONS are the module's, read live: bank → pick → askings →
// answers → ground → seat → timeline, every die from the seed's own
// question:<n> forks, so what this page plays is exactly what the meeting
// will be handed. What this file keeps a copy of is only the VOICES — the
// deacon's clarinet, the parlor harmonium, the drone, the strings — adapted
// from kolob-audio.js's renderClarinetLine / renderHarmonium / droneCycle /
// stringsPad, and run through a master chain with a limiter at the app's own
// loudness (SCORE §7). Two changes from the originals, both about clicks:
// the harmonium's bellows now breathe in a gain of their own instead of
// adding to the envelope (a stopped LFO left a step behind), and every
// oscillator stops only after its envelope has reached zero.
//
// Sound-level jitter (detune, attack lengths) comes from a synth:lab stream,
// never from the musical streams (SCORE §3).
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
  // Stand-ins for "today's hymns" until the composer lands: plain hymn-book
  // lines in 7-degree spelling. They are the answerers' material AND the
  // bank's excludeLines, so no question can ever match one.
  var HYMN_LINES = [
    [0, 0, 2, 4, 4, 5, 4],
    [4, 5, 4, 2, 0, 1, 2, 1],
    [2, 3, 4, 4, 5, 5, 4],
    [7, 6, 5, 4, 3, 2, 1, 0],
    [4, 4, 7, 6, 5, 4, 2, 4],
    [0, 4, 3, 2, 1, 2, 0],
  ];

  var state = { seed: 1, mode: "ionian", material: "hymns", ground: "auto", chosen: null, ev: null };
  function $(id) { return document.getElementById(id); }
  function cls(d) { return ((d % 7) + 7) % 7; }
  function solName(d, mode) {
    var c = cls(d), o = Math.floor(d / 7);
    var nm = FLATTED[mode] && FLATTED[mode][c] ? LOWER[c] : NAMES[c];
    return nm + (o > 0 ? "′".repeat(o) : o < 0 ? "ˌ".repeat(-o) : "");
  }
  function material() { return state.material === "hymns" ? HYMN_LINES : []; }

  // ==========================================================================
  // THE EVENT for a seed: the meeting's question:1 fork, handled exactly as
  // the meeting would — plus a v0.30-shaped section plan so seat() and the
  // cap have real durations to work against.
  // ==========================================================================
  function labPlan(seed) {
    var s = Rand.stream(seed).fork("lab:plan");
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
    return plan;
  }
  function eventFor(seed, mode, chosenIndex) {
    var qs = Rand.stream(seed).fork("question:1");
    var ev = Q.compose(qs, { mode: mode, n: 1, material: material(), excludeLines: HYMN_LINES, sections: labPlan(seed) });
    if (chosenIndex != null && ev.bank[chosenIndex] && ev.bank[chosenIndex] !== ev.question) {
      // the lab lets you perform any of the seven; the rest of the event is
      // re-derived from the same forks, as the meeting would for that pick
      var q = ev.bank[chosenIndex];
      var ask = Q.askings(q, qs.fork("bend"));
      var as = qs.fork("answers");
      var ans = [Q.answers(q, 0, material(), as, mode), Q.answers(q, 1, material(), as, mode)];
      var parts = { askings: ask, answers: ans };
      ev.question = q; ev.askings = ask; ev.answers = ans;
      ev.needS = Q.minimumS(parts);
      ev.timeline = Q.timeline(parts, { beatS: ev.timeline.beatS, capS: ev.seat ? ev.seat.capS : null });
    }
    return ev;
  }

  // ==========================================================================
  // ENGRAVING — plain and small. do = C4 on the page (sounding an octave up,
  // as the clarinet plays it); one position per diatonic step; spacing by
  // duration; ledger lines; a flat before a mode's lowered degree.
  // ==========================================================================
  var HS = 4;                                                     // half a staff space, px
  function yOf(p) { return 30 + (10 - p) * HS; }
  function staffSVG(notes, mode, opts) {
    opts = opts || {};
    var x = 40, parts = [], heads = [];
    for (var i = 0; i < notes.length; i++) {
      heads.push({ x: x, n: notes[i] });
      x += 17 + Math.min(4, notes[i].beats) * 15;
    }
    var W = Math.max(160, x + 6), H = 100;
    var ink = "#1e4d3b", hi = "#9a5a3a";
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
      if (FLATTED[mode] && FLATTED[mode][cls(p)]) parts.push('<text x="' + (h.x - 14) + '" y="' + (cy + 3.5) + '" font-size="12" fill="' + col + '">♭</text>');
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
  // RENDER — the bank, the event, the timeline.
  // ==========================================================================
  function render() {
    var ev = state.ev, mode = state.mode;
    var html = [];
    ev.bank.forEach(function (q, i) {
      var r = Q.rules(q);
      var lit = q === ev.question;
      var intervals = [];
      for (var j = 1; j < q.degs.length; j++) intervals.push(Math.round(Q.cents(q.degs[j], mode) - Q.cents(q.degs[j - 1], mode)));
      var widest = Math.max.apply(null, intervals.map(Math.abs));
      html.push('<div class="oql-card' + (lit ? " lit" : "") + '">' +
        '<div class="oql-card-top"><span class="oql-card-name">' + (q.fromBank === "old" ? "the old one" : "new · " + i) + '</span>' +
        '<span class="oql-card-tag">' + (lit ? "drawn for this meeting" : "") + '</span></div>' +
        staffSVG(qNotes(q), mode, { aria: "question " + i }) +
        '<div class="oql-sol">' + q.degs.map(function (d) { return solName(d, mode); }).join(" – ") + '</div>' +
        '<div class="oql-meta">beats ' + q.beats.join(" · ") + ' · widest leap ' + widest + '¢ · ' +
        (r.ok ? "rules ✓" : (q.fromBank === "old" ? "ancestor (exempt): " : '<span class="bad">') + r.fails.join(", ") + (q.fromBank === "old" ? "" : "</span>")) + '</div>' +
        '<div class="oql-card-btns"><button type="button" data-play="' + i + '">▶ play</button>' +
        '<button type="button" data-choose="' + i + '">' + (lit ? "performing this one" : "perform this one") + '</button></div></div>');
    });
    $("oql-bank").innerHTML = html.join("");
    $("oql-bank").querySelectorAll("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () { playQuestion(ev.bank[+b.getAttribute("data-play")]); });
    });
    $("oql-bank").querySelectorAll("[data-choose]").forEach(function (b) {
      b.addEventListener("click", function () { state.chosen = +b.getAttribute("data-choose"); refresh(); });
    });
    renderEvent();
  }
  function groundOf(ev) { return state.ground === "auto" ? ev.ground : state.ground; }
  function renderEvent() {
    var ev = state.ev, mode = state.mode, q = ev.question, tl = ev.timeline;
    var b = ev.askings[1].bent;
    var bendTxt = !b ? "—" : b.kind === "note"
      ? "one note displaced: note " + (b.index + 1) + ", " + solName(b.from, mode) + " → " + solName(b.to, mode)
      : b.variant === "late" ? "the rhythm shifted: comes in " + b.offsetBeats + " beat late, the first long clipped"
      : "the rhythm shifted: notes " + (b.index + 1) + "–" + (b.index + 2) + " trade lengths";
    var seatTxt = ev.seat ? "the " + ev.seat.section + " (" + Math.round(ev.seat.sectionS) + " s; cap 45 % = " + Math.round(ev.seat.capS) + " s)" : "nowhere — no section is long enough";
    var h = [];
    h.push("<p><strong>" + (q.fromBank === "old" ? "The old question" : "Question " + q.index) + "</strong> · " + q.degs.map(function (d) { return solName(d, mode); }).join(" – ") +
      " · beat " + tl.beatS.toFixed(2) + " s" + (tl.gapMul < 1 ? " (breaths shortened ×" + tl.gapMul.toFixed(1) + ")" : "") + "</p>");
    h.push("<p>Asked three times. The second asking: " + bendTxt + ".</p>");
    h.push("<p>Ground: <strong>" + groundOf(ev) + "</strong>" + (state.ground !== "auto" ? " (forced; drawn: " + ev.ground + ")" : "") +
      (groundOf(ev) === "chorale" ? " — the strings, " + (ev.chorale ? ev.chorale.beatS : "2.0") + " s a beat, at their own pace" : " — the drone alone") + "</p>");
    h.push("<p>Seat: " + seatTxt + " · this event " + Math.round(tl.total) + " s (" + (tl.fits ? "fits" : "<span style='color:#9a5a3a'>over the cap</span>") + "; its shortest possible form " + Math.round(ev.needS) + " s)</p>");
    // the timeline strip
    var strip = ['<div class="oql-tl" id="oql-tl">'];
    tl.items.forEach(function (it) {
      var c = it.kind === "asking" ? "ask" : it.kind === "answer" ? "ans" : "tail";
      var lab = it.kind === "asking" ? "? " + (it.k + 1) + (it.k === 1 ? " bent" : "") : it.kind === "answer" ? "answer " + (it.k + 1) : "unanswered";
      strip.push('<span class="' + c + '" style="left:' + (100 * it.t / tl.total) + '%;width:' + (100 * it.dur / tl.total) + '%">' + lab + '</span>');
    });
    strip.push('<i class="head" id="oql-head"></i></div><div class="oql-tl-scale"><span>0 s</span><span>' + Math.round(tl.total) + ' s</span></div>');
    h.push(strip.join(""));
    // the bent asking and the answers, engraved
    var cards = [];
    var marks = {};
    if (b && b.kind === "note") marks[b.index] = true;
    cards.push('<div class="oql-card"><div class="oql-card-top"><span class="oql-card-name">asking 2, bent</span></div>' +
      staffSVG(ev.askings[1].degs.map(function (d, i) { return { deg: d, beats: ev.askings[1].beats[i] }; }), mode, { mark: marks }) + '</div>');
    ev.answers.forEach(function (a) {
      a.voices.forEach(function (v) {
        var name = v.role === "doubling" ? "harmonium, second rank" : v.voice;
        cards.push('<div class="oql-card"><div class="oql-card-top"><span class="oql-card-name">answer ' + (a.k + 1) + ' · ' + name + '</span>' +
          '<span class="oql-card-tag">' + (v.role === "doubling" ? "a fifth up, in the scale" : a.develop + " · from " + a.from) + '</span></div>' +
          staffSVG(v.notes, mode) +
          '<div class="oql-meta">' + v.notes.map(function (n) { return solName(n.deg, mode); }).join(" ") + '</div></div>');
      });
    });
    h.push('<div class="oql-answers">' + cards.join("") + "</div>");
    $("oql-event").innerHTML = h.join("");
  }

  function refresh() {
    stop();
    state.ev = eventFor(state.seed, state.mode, state.chosen);
    render();
  }

  // ==========================================================================
  // AUDIO — the master chain (after kolob-audio.js: glue → master 0.6 →
  // tanh saturation → compressor) with a brick-wall limiter at the end, and
  // a small seeded hall. Layer gains are the app's defaults.
  // ==========================================================================
  var ctx = null, out = null, voicesIn = null, hall = null, LAYER = {}, bus = null, busNodes = [], timers = [];
  var LAYER_VOL = { clarinet: 0.38, harmonium: 0.45, strings: 0.5, drone: 0.55 };
  var MASTER = 0.6;
  var syn = Rand.stream(1).fork("synth:lab");
  function ensureCtx() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    var t = ctx.currentTime;
    voicesIn = ctx.createGain(); voicesIn.gain.setValueAtTime(1, t);
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = ctx.createGain(); master.gain.setValueAtTime(MASTER, t);
    var sat = ctx.createWaveShaper();
    var curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = curve; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var lim = ctx.createDynamicsCompressor();                       // the limiter: nothing past −1.5 dBFS
    lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
    voicesIn.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim);
    lim.connect(ctx.destination);
    out = lim;
    // the hall: a short seeded pour of decaying noise, early taps first
    var sr = ctx.sampleRate, len = Math.floor(sr * 2.4), ir = ctx.createBuffer(2, len, sr);
    var ns = Rand.stream(7).fork("synth:lab:hall");
    for (var ch = 0; ch < 2; ch++) {
      var dd = ir.getChannelData(ch);
      for (var k = 0; k < len; k++) {
        var tt = k / sr;
        dd[k] = (ns.next() * 2 - 1) * Math.exp(-tt * 2.9) * Math.min(1, tt / 0.05) * 0.55;
      }
      [[0.011, 0.6], [0.019, 0.45], [0.031, 0.35], [0.047, 0.25]].forEach(function (tap) { dd[Math.floor(tap[0] * sr) + ch * 7] += tap[1]; });
    }
    hall = ctx.createConvolver(); hall.buffer = ir;
    var wet = ctx.createGain(); wet.gain.setValueAtTime(0.32, t);
    hall.connect(wet); wet.connect(voicesIn);
    Object.keys(LAYER_VOL).forEach(function (name) {
      var g = ctx.createGain(); g.gain.setValueAtTime(LAYER_VOL[name], t);
      g.connect(voicesIn); g.connect(hall);
      LAYER[name] = g;
    });
  }
  // each performance gets its own bus, so STOP can fade it without a click
  function newBus() {
    stop();
    ensureCtx();
    var t = ctx.currentTime;
    bus = {};
    Object.keys(LAYER).forEach(function (name) {
      var g = ctx.createGain(); g.gain.setValueAtTime(1, t); g.connect(LAYER[name]); bus[name] = g;
    });
    busNodes = [];
    return bus;
  }
  function stop() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
    if (!ctx || !bus) { setNow(""); return; }
    var t = ctx.currentTime, oldBus = bus, oldNodes = busNodes;
    Object.keys(oldBus).forEach(function (k) {
      var g = oldBus[k].gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.12);
    });
    oldNodes.forEach(function (o) { try { o.stop(t + 0.2); } catch (e) {} });
    setTimeout(function () { Object.keys(oldBus).forEach(function (k) { try { oldBus[k].disconnect(); } catch (e) {} }); }, 600);
    bus = null; busNodes = [];
    var head = $("oql-head"); if (head) head.style.display = "none";
    setNow("");
  }
  function osc(type, f, t) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); busNodes.push(o); return o;
  }
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  function pan(dest, p) {
    var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(p, ctx.currentTime); sp.connect(dest); return sp;
  }

  // THE CLARINET — the deacon, after renderClarinetLine: triangle + a soft
  // octave sine through a fixed lowpass, portamento between notes, a
  // delayed shallow vibrato. (Its grace note, an equal-tempered whole step
  // in v0.30, is left out: the Question is asked plain.)
  function clarinetLine(t, notes, gainMul, p) {
    var dest = pan(bus.clarinet, p || 0);
    var o = osc("triangle", notes[0].f, t), o8 = osc("sine", notes[0].f * 2, t);
    var g8 = ctx.createGain(); g8.gain.setValueAtTime(0.12, t);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(9000, notes[0].f * 5), t);
    var g = ctx.createGain();
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
    var lfo = osc("sine", syn.rnd(4.5, 5.5), t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + total * 0.4);
    lg.gain.linearRampToValueAtTime(notes[0].f * 0.004 * 0.8, t + total * 0.7);
    lfo.connect(lg); lg.connect(o.frequency);
    var peak = (gainMul || 1) * 0.34;
    var atk = Math.min(syn.rnd(0.4, 0.8), Math.max(0.08, total * 0.3));
    var rel = Math.min(syn.rnd(0.9, 1.4), Math.max(0.3, total * 0.5));
    var end = env(g, t, [[atk, peak], [Math.max(0.05, total - atk - rel * 0.4), peak * 0.9], [rel, 0]]);
    [o, o8, lfo].forEach(function (x) { x.start(t); x.stop(end + 0.1); });
    return total;
  }
  // THE HARMONIUM — the parlor pump organ, after renderHarmonium: a detuned
  // saw pair through a still reed formant; the bellows breathe (0.2–0.4 Hz)
  // in their own gain stage.
  function harmoniumLine(t, notes, gainMul, p) {
    var dest = pan(bus.harmonium, p || 0);
    var mix = ctx.createGain(), os = [];
    for (var d = 0; d < 2; d++) {
      var o = osc("sawtooth", notes[0].f * (d ? 1.004 : 0.996), t);
      var og = ctx.createGain(); og.gain.setValueAtTime(0.5, t);
      o.connect(og); og.connect(mix); os.push(o);
    }
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(2000, t); bp.Q.setValueAtTime(3.5, t);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
    var bel = ctx.createGain(); bel.gain.setValueAtTime(1, t);
    var g = ctx.createGain();
    // the reed's body: v0.30's still formant alone thins an answer to a
    // whisper at −45 dB, lost under the drone; a dark parallel path gives the
    // answerers the chest to argue with
    var body = ctx.createBiquadFilter(); body.type = "lowpass"; body.frequency.setValueAtTime(1400, t);
    var bg = ctx.createGain(); bg.gain.setValueAtTime(0.55, t);
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
    var lfo = osc("sine", syn.rnd(0.2, 0.4), t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(0.1, t);
    lfo.connect(lg); lg.connect(bel.gain);
    var peak = (gainMul || 1) * 0.22;
    var atk = Math.min(syn.rnd(0.35, 0.6), Math.max(0.06, total * 0.25));
    var rel = Math.min(syn.rnd(0.8, 1.2), Math.max(0.3, total * 0.4));
    var end = env(g, t, [[atk, peak], [Math.max(0.05, total - atk - rel * 0.3), peak * 0.9], [rel, 0]]);
    os.concat([lfo]).forEach(function (x) { x.start(t); x.stop(end + 0.1); });
    return total;
  }
  // THE DRONE — after droneCycle: sine partials 1–4 of F0 and a quiet fifth
  // an octave up. It was there before the question and stays after it.
  function drone(t, dur, f0) {
    var m = ctx.createGain(); m.connect(bus.drone);
    [[1, 0.4], [2, 0.24], [3, 0.12], [4, 0.07], [6, 0.04]].forEach(function (pt) {
      var o = osc("sine", f0 * pt[0], t);
      var og = ctx.createGain(); og.gain.setValueAtTime(pt[1], t);
      o.connect(og); og.connect(m);
      o.start(t); o.stop(t + dur + 0.2);
    });
    var peak = 0.45;
    env(m, t, [[Math.min(5, dur * 0.2), peak], [Math.max(0.5, dur - 10), peak * 0.95], [Math.min(5, dur * 0.2), 0]]);
  }
  // THE STRINGS — Ives's strings, after stringsPad: three detuned saws per
  // part through a fixed lowpass, four parts moving together from chord to
  // chord at the chorale's own slow beat, bowing on regardless.
  function chorale(t, dur, ch, doHz, mode) {
    var m = ctx.createGain(); m.connect(bus.strings);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1150, t); lp.connect(m);
    var seq = [], tt = 0, ci = 0;
    while (tt < dur) { var c = ch.chords[ci % ch.chords.length]; seq.push({ t: tt, c: c }); tt += c.beats * ch.beatS; ci++; if (ci % ch.chords.length === 0) tt += ch.beatS * 2; }
    for (var part = 0; part < 4; part++) {
      var pg = ctx.createGain(); pg.gain.setValueAtTime(part === 0 ? 0.034 : 0.026, t); pg.connect(lp);
      for (var d = 0; d < 3; d++) {
        var spread = 1 + (d - 1) * syn.rnd(0.002, 0.0035);
        var f = function (s) { return doHz * Q.ratioOf(s.c.monzos[Math.min(part, s.c.monzos.length - 1)]) * spread; };
        var o = osc("sawtooth", f(seq[0]), t);
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
  function doHz() { return f0For(state.seed) * 4; }                // the choir's do; the clarinet sits an octave up
  function asHz(notes, beatS, octUp) {
    var base = doHz() * (octUp ? 2 : 1);
    return notes.map(function (n, i) {
      return { f: base * Q.ratioOf(n.monzo || Q.monzo(n.deg, state.mode)), dur: Math.max(0.12, (n.beats != null ? n.beats : 1) * beatS) };
    });
  }
  function setNow(txt) { var el = $("oql-now"); if (el) el.textContent = txt; }
  function later(sec, fn) { timers.push(setTimeout(fn, Math.max(0, sec * 1000))); }

  function playQuestion(q) {
    newBus();
    var t = ctx.currentTime + 0.1;
    var beat = state.ev.timeline.beatS;
    var notes = asHz(q.degs.map(function (d, i) { return { deg: d, beats: q.beats[i], monzo: q.monzos[i] }; }), beat, true);
    var tot = clarinetLine(t, notes, 0.9, 0);
    drone(t, tot + 4, f0For(state.seed));
    setNow("the question" + (q.fromBank === "old" ? " (the old one)" : " " + q.index) + " · " + q.degs.map(function (d) { return solName(d, state.mode); }).join(" – "));
    later(tot + 4.2, function () { setNow(""); });
  }

  function playFull() {
    var ev = state.ev, tl = ev.timeline, beat = tl.beatS, mode = state.mode;
    newBus();
    var lead = 3;                                                 // the drone first, then the question
    var t0 = ctx.currentTime + 0.15;
    var T = t0 + lead;
    var total = tl.total + lead;
    drone(t0, total + 1, f0For(state.seed));
    var gr = groundOf(ev);
    if (gr === "chorale") {
      var ch = ev.chorale || Q.chorale(material(), Rand.stream(state.seed).fork("question:1").fork("ground").fork("chorale"), mode);
      chorale(t0 + 0.5, total, ch, doHz(), mode);
    }
    tl.items.forEach(function (it) {
      if (it.kind === "asking") {
        var a = ev.askings[it.k];
        var notes = asHz(a.degs.map(function (d, i) { return { deg: d, beats: a.beats[i], monzo: a.monzos[i] }; }), beat, true);
        clarinetLine(T + it.t + (a.offsetBeats || 0) * beat, notes, 0.9, 0);
        later(lead + it.t, function () { setNow("? the question — asking " + (it.k + 1) + (a.bent ? " (bent)" : "")); });
      } else if (it.kind === "answer") {
        var an = ev.answers[it.k];
        an.voices.forEach(function (v) {
          var at = T + it.t + v.entryBeats * beat;
          var ns = asHz(v.notes, beat, true);
          // louder each time, as Ives's flutes are — but never over the asker
          if (v.voice === "clarinet") clarinetLine(at, ns, 0.45 + it.k * 0.1, 0.35);
          else if (v.role === "doubling") harmoniumLine(at, ns, 0.6 + it.k * 0.2, -0.35);
          else harmoniumLine(at, ns, 1.1 + it.k * 0.4, -0.2);
        });
        later(lead + it.t, function () { setNow("the answer " + (it.k + 1) + " — " + an.develop + ", from " + an.from); });
      } else {
        later(lead + it.t + 1.5, function () { setNow("? unanswered — " + (gr === "chorale" ? "the strings play on" : "the drone alone")); });
      }
    });
    // a playhead on the strip (clock-driven, not animation-driven)
    var head = $("oql-head");
    if (head) head.style.display = "block";
    var tick = function () {
      if (!bus || !ctx) return;
      var el = ctx.currentTime - T;
      if (head) head.style.left = Math.max(0, Math.min(100, 100 * el / tl.total)) + "%";
      if (el < tl.total + 1) timers.push(setTimeout(tick, 250));
      else { setNow(""); if (head) head.style.display = "none"; }
    };
    tick();
    return { start: T, total: total };
  }

  // ==========================================================================
  // STATS over 200 seeds. The rule check is RESTATED here from plain
  // ratios, independent of Q.rules, so the module is not marking its own
  // homework.
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
    var last = b[n - 1];
    var fam = b[0] > b[1] && b[0] > b[2] && last >= 2.5 && b.slice(0, -1).every(function (x) { return last >= 1.5 * x; }) &&
              Math.max(b[n - 2], b[n - 3]) > b[1];
    if (!fam) f.push("rhythm outside the family");
    return f;
  }
  function measure(mode, from) {
    var gen = 0, pass = 0, uniq = {}, tries = 0, ruleRej = 0, evalRej = 0, lawful = 0;
    var starts = new Array(12).fill(0), ends = new Array(12).fill(0), pcs = new Array(7).fill(0), contours = {}, leaps = [], within = 0, fails = {};
    var ansN = 0, ansIn = 0, rise = 0, faster = 0, chor = 0, seats = {}, fits = 0, bends = { note: 0, rhythm: 0 }, bentOk = 0, verbatim = 0, perBank = [];
    for (var s = from; s < from + 200; s++) {
      var qs = Rand.stream(s).fork("question:1");
      var ev = Q.compose(qs, { mode: mode, n: 1, material: s % 2 ? HYMN_LINES : [], excludeLines: HYMN_LINES, sections: labPlan(s) });
      var st = ev.bank.stats;
      tries += st.tries; ruleRej += st.ruleRejects; evalRej += st.evalRejects; lawful += st.tries - st.ruleRejects;
      var inBank = {};
      ev.bank.forEach(function (q) {
        if (q.fromBank !== "gen") return;
        gen++;
        var fl = labRules(q, mode);
        if (!fl.length) pass++; else fl.forEach(function (x) { fails[x] = (fails[x] || 0) + 1; });
        uniq[q.degs.join(".") + "/" + q.beats.join(".")] = 1;
        inBank[q.degs.join(".")] = 1;
        starts[Math.max(0, Math.min(11, q.degs[0]))]++;
        ends[Math.max(0, Math.min(11, q.degs[q.degs.length - 1]))]++;
        q.degs.forEach(function (d) { pcs[cls(d)]++; });
        var sig = [];
        var wide = 0;
        for (var i = 1; i < q.degs.length; i++) {
          sig.push(q.degs[i] > q.degs[i - 1] ? "↗" : "↘");
          wide = Math.max(wide, Math.abs(labCents(q.degs[i], mode) - labCents(q.degs[i - 1], mode)));
        }
        contours[sig.join("")] = 1;
        leaps.push(wide);
      });
      perBank.push(Object.keys(inBank).length);
      // askings, answers, ground, seat
      var a = ev.askings, q0 = ev.question;
      if (a[0].degs.join() === q0.degs.join() && a[2].degs.join() === q0.degs.join() && a[0].beats.join() === q0.beats.join() && a[2].beats.join() === q0.beats.join()) verbatim++;
      var b1 = a[1].bent;
      if (b1) {
        bends[b1.kind]++;
        var diffNotes = a[1].degs.filter(function (d, i) { return d !== q0.degs[i]; }).length;
        var diffBeats = a[1].beats.join() !== q0.beats.join() || a[1].offsetBeats > 0;
        if ((b1.kind === "note" && diffNotes === 1 && !diffBeats) || (b1.kind === "rhythm" && diffNotes === 0 && diffBeats)) bentOk++;
      }
      ev.answers.forEach(function (an) { an.voices.forEach(function (v) { v.notes.forEach(function (nn) { ansN++; if (inLattice(nn.monzo, mode)) ansIn++; }); }); });
      var h0 = ev.answers[0].voices[0].notes, h1 = ev.answers[1].voices[0].notes;
      var mean = function (arr, key) { return arr.reduce(function (x, y) { return x + y[key]; }, 0) / arr.length; };
      if (mean(h1, "deg") > mean(h0, "deg")) rise++;
      if (mean(h1, "beats") < mean(h0, "beats")) faster++;
      if (ev.ground === "chorale") chor++;
      var sk = ev.seat ? ev.seat.section : "—";
      seats[sk] = (seats[sk] || 0) + 1;
      if (ev.timeline.fits) fits++;
    }
    // the ground's one-in-three, over enough seeds to see it
    var chor3000 = 0;
    for (var g = from; g < from + 3000; g++) if (Q.ground(Rand.stream(g).fork("question:1").fork("ground")) === "chorale") chor3000++;
    return {
      chor3000: chor3000,
      mode: mode, gen: gen, pass: pass, uniq: Object.keys(uniq).length, tries: tries, ruleRej: ruleRej, evalRej: evalRej, lawful: lawful,
      starts: starts, ends: ends, pcs: pcs, contours: Object.keys(contours).length, meanLeap: leaps.reduce(function (x, y) { return x + y; }, 0) / leaps.length,
      fails: fails, ansN: ansN, ansIn: ansIn, rise: rise, faster: faster, chor: chor, seats: seats, fits: fits, bends: bends, bentOk: bentOk, verbatim: verbatim,
      minBank: Math.min.apply(null, perBank),
    };
  }
  function bars(arr, labels) {
    var mx = Math.max.apply(null, arr) || 1;
    return '<div class="oql-bars">' + arr.map(function (v) { return '<i style="height:' + Math.round(34 * v / mx) + 'px" title="' + v + '"></i>'; }).join("") + '</div>' +
      '<div class="oql-bars-lab">' + labels.map(function (l) { return "<b>" + l + "</b>"; }).join("") + "</div>";
  }
  function pct(a, b) { return b ? (100 * a / b).toFixed(1) + " %" : "—"; }
  function renderStats(rows) {
    var degLab = ["d", "r", "m", "f", "s", "l", "t", "d′", "r′", "m′", "f′", "s′"];
    var h = ['<table><thead><tr><th>mode</th><th>rules kept</th><th>distinct</th><th>critic turned away</th><th>starts</th><th>ends</th><th>pitch classes</th><th>contours · widest leap</th><th>askings · answers · ground · seat</th></tr></thead><tbody>'];
    rows.forEach(function (r) {
      var ok = r.pass === r.gen;
      var seatTxt = Object.keys(r.seats).map(function (k) { return k + " " + r.seats[k]; }).join(", ");
      h.push("<tr><td><strong>" + r.mode + "</strong></td>" +
        '<td class="' + (ok ? "ok" : "bad") + '">' + pct(r.pass, r.gen) + "<br><span class='oql-meta'>" + r.pass + "/" + r.gen + (ok ? "" : " · " + Object.keys(r.fails).join(", ")) + "</span></td>" +
        "<td>" + r.uniq + " / " + r.gen + "<br><span class='oql-meta'>every bank holds " + r.minBank + "+ distinct new</span></td>" +
        "<td>" + pct(r.evalRej, r.lawful) + "<br><span class='oql-meta'>of lawful candidates; the rules refused " + pct(r.ruleRej, r.tries) + " of raw draws</span></td>" +
        "<td>" + bars(r.starts.slice(0, 7), degLab.slice(0, 7)) + "</td>" +
        "<td>" + bars(r.ends.slice(5, 12), degLab.slice(5, 12)) + "</td>" +
        "<td>" + bars(r.pcs, degLab.slice(0, 7)) + "</td>" +
        "<td>" + r.contours + " shapes<br><span class='oql-meta'>mean widest " + Math.round(r.meanLeap) + "¢</span></td>" +
        "<td><span class='oql-meta'>1st & 3rd verbatim " + r.verbatim + "/200 · 2nd bent " + r.bentOk + "/200 (note " + r.bends.note + ", rhythm " + r.bends.rhythm + ")<br>" +
        "answers in the scale " + pct(r.ansIn, r.ansN) + " · 2nd higher " + r.rise + "/200, faster " + r.faster + "/200<br>" +
        "chorale ground " + pct(r.chor, 200) + " (over 3000 seeds " + pct(r.chor3000, 3000) + ")" + " · fits its cap " + r.fits + "/200<br>" + seatTxt + "</span></td></tr>");
    });
    h.push("</tbody></table>");
    $("oql-stats").innerHTML = h.join("");
  }
  function runStats(modes) {
    $("oql-stats").innerHTML = "<p class='oql-meta'>measuring…</p>";
    var rows = [];
    var i = 0;
    (function step() {
      if (i >= modes.length) { renderStats(rows); return; }
      rows.push(measure(modes[i++], Math.max(1, state.seed)));
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
    state.material = $("oql-material").value;
    state.ground = $("oql-ground").value;
  }
  function init() {
    ["oql-seed", "oql-mode", "oql-material"].forEach(function (id) {
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
    playFull: playFull, playQuestion: function (i) { playQuestion(state.ev.bank[i]); }, stop: stop,
    measure: measure, labRules: labRules,
    set: function (o) {
      if (o.seed != null) $("oql-seed").value = o.seed;
      if (o.mode) $("oql-mode").value = o.mode;
      if (o.ground) $("oql-ground").value = o.ground;
      if (o.material) $("oql-material").value = o.material;
      readControls(); state.chosen = o.chosen != null ? o.chosen : null; refresh();
      return state.ev;
    },
    output: function () { ensureCtx(); return out; },
    layers: function () { ensureCtx(); return LAYER; },          // dev: per-voice taps for measurement
    context: function () { ensureCtx(); return ctx; },
    event: function () { return state.ev; },
  };
})();
