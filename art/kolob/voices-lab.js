// ============================================================================
// VOICES LAB (dev only; see voices-lab.php).
//
// One line of an original common-metre tune in G (8 syllables, then 6), four
// parts, exact 5-limit ratios over a C keynote (the ii chord takes its A at
// 10/9, so the fifth A–E is pure; the tenor moves a comma to get there, as a
// choir does). Sung six ways, plus a hum, plus each person alone.
//
// The lab owns: the tune, the master chain (a copy of kolob-core.js's —
// glue, master 0.6, tanh, compressor — with a brick-wall limiter after it),
// a copy of v0.30's choirVoiceLine for the A/B, and the bench (offline
// render → peak, level, clicks, mud, harshness, flanger test, node budget).
// All the singing is KOLOB.VoicesVocal.
// ============================================================================
(function () {
  "use strict";
  var V = window.KOLOB && window.KOLOB.VoicesVocal;
  var errEl = document.getElementById("vl-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent += msg + "\n"; }
  window.addEventListener("error", function (e) { showErr("JS error: " + e.message + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno); });
  if (!V) { showErr("kolob-voices-vocal.js did not load."); return; }
  var $ = function (id) { return document.getElementById(id); };

  // --------------------------------------------------------------------------
  // THE TUNE. G2 = 98 Hz (C keynote × 3/2, two octaves down). Ratios over G.
  // --------------------------------------------------------------------------
  var G2 = 261.63 * 3 / 2 / 4;
  var RATIO = { G: 1, A: 9 / 8, "A~": 10 / 9, B: 5 / 4, C: 4 / 3, D: 3 / 2, E: 5 / 3, "F#": 15 / 8 };
  var SHAPE = { G: "fa", A: "sol", "A~": "sol", B: "la", C: "fa", D: "sol", E: "la", "F#": "mi" };   // four-shape: do=fa re=sol mi=la fa=fa sol=sol la=la ti=mi
  function hz(name) {
    var m = /^([A-G](?:#|~)?)(\d)$/.exec(name);
    var pc = m[1], oct = +m[2];
    // G, A, B sit in the octave named from the G below; C–F# from the G below the C
    var base = pc[0] === "G" || pc[0] === "A" || pc[0] === "B" ? oct - 2 : oct - 3;
    return G2 * RATIO[pc] * Math.pow(2, base);
  }
  var TUNE = {
    S: "D4 G4 G4 B4 A4 G4 B4 D5 | D5 C5 B4 G4 B4 A4",
    A: "B3 D4 E4 D4 D4 E4 D4 G4 | F#4 E4 D4 E4 D4 D4",
    T: "G3 B3 C4 G3 F#3 B3 G3 B3 | A3 A~3 G3 C4 G3 F#3",
    B: "G2 G2 C3 G2 D3 E3 B2 G2 | D3 A~2 G2 C3 D3 D3",
    // the soloist's descant, over the last verse
    D: "B4 D5 E5 D5 F#5 E5 G5 G5 | F#5 E5 D5 E5 D5 D5",
  };
  var BEATS = [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2];
  var WORDS = ["oh", "ee", "ah", "oo", "ah", "ee", "oh", "ah", "oo", "ee", "ah", "oh", "ee", "ah"];   // the vowel colour of an imagined verse
  function names(part) { return TUNE[part].replace("|", "").trim().split(/\s+/); }
  // notes for one part: vowels = "notes" | "ah" | "oo" | "words" | "hum" | array
  function partLine(part, beat, vowels, opts) {
    opts = opts || {};
    var nm = names(part), out = [];
    for (var i = 0; i < nm.length; i++) {
      var d = BEATS[i] * beat;
      if (i === 13) d *= 1.5;                                  // the fermata
      var pc = nm[i].replace(/\d$/, "");
      var v = Array.isArray(vowels) ? vowels[i] : vowels === "notes" ? SHAPE[pc] : vowels === "words" ? WORDS[i] : vowels;
      var f = hz(nm[i]) * (opts.oct || 1);
      if (i === 7) {
        out.push({ f: f, dur: d - 0.4 * beat, vowel: v, stress: 1 });
        out.push({ rest: true, dur: 0.4 * beat });               // the breath between the lines
      } else out.push({ f: f, dur: d, vowel: v, stress: i % 2 ? 1 : 0 });
    }
    return out;
  }
  function parts(beat, vowels) { return { S: partLine("S", beat, vowels), A: partLine("A", beat, vowels), T: partLine("T", beat, vowels), B: partLine("B", beat, vowels) }; }
  function lineDur(beat) { var s = 0; for (var i = 0; i < 14; i++) s += BEATS[i] * beat * (i === 13 ? 1.5 : 1); return s; }
  function phrase(notes, which) { var k = 0; while (k < notes.length && !notes[k].rest) k++; return which === 1 ? notes.slice(0, k) : notes.slice(k + 1); }
  function slow(notes, mul) { return notes.map(function (n) { var c = {}; for (var k in n) c[k] = n[k]; c.dur = n.dur * mul; return c; }); }
  var SCALE = { tonicHz: G2 * 2, scale: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8] };

  // --------------------------------------------------------------------------
  // THE MASTER CHAIN — kolob-core.js's, plus a limiter; two ways in:
  //   near — a voice stepping forward (drier), hall — the congregation.
  // The layer gain is the choir's in the app (0.8 × trim 1.1).
  // --------------------------------------------------------------------------
  var irBytes = null;
  var irReady = fetch("../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function (b) { irBytes = b; }, function () { irBytes = null; });
  function pouredIR(ctx) {
    var len = Math.floor(ctx.sampleRate * 2.8), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), s = 12345 + c * 999; for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * Math.pow(1 - i / len, 3.2) * 0.5; } }
    return b;
  }
  function chain(ctx, roomAmt) {
    var t = 0;
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, t); return g; }
    var layer = 0.8 * 1.1;
    var near = G(layer), hall = G(layer);
    var dry = G(1), wetIn = G(1), conv = ctx.createConvolver(), wet = G(0.9 * roomAmt);
    var nd = G(1.0), nw = G(0.35), hd = G(0.72), hw = G(0.75);
    near.connect(nd); near.connect(nw); hall.connect(hd); hall.connect(hw);
    nd.connect(dry); hd.connect(dry); nw.connect(wetIn); hw.connect(wetIn);
    var bus = G(1);
    dry.connect(bus);
    wetIn.connect(conv); conv.connect(wet); wet.connect(bus);
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
    var lim = ctx.createDynamicsCompressor();                  // the lab's promise: never louder than the app
    lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
    bus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    var ready = irReady.then(function () {
      if (!irBytes) { conv.buffer = pouredIR(ctx); return; }
      return ctx.decodeAudioData(irBytes.slice(0)).then(function (buf) { conv.buffer = buf; }, function () { conv.buffer = pouredIR(ctx); });
    });
    return { near: near, hall: hall, ready: ready, out: lim, stop: function () { try { lim.disconnect(); } catch (e) { /* gone */ } } };
  }

  // --------------------------------------------------------------------------
  // TODAY'S QUARTET — v0.30's choirVoiceLine, copied (now kolob-voices-choir.js's),
  // with the layer params at their defaults (vowel 0.4, scoop 0.5) and all
  // four voices (a conference meeting). For the A/B only.
  // --------------------------------------------------------------------------
  var CHOIR_FORMANTS = {
    ah: [[700, 1080, 2650], [600, 1040, 2250], [440, 1800, 2700], [340, 870, 2250]],
    oo: [[325, 700, 2530], [370, 630, 2750], [300, 870, 2240], [280, 630, 2340]],
  };
  var CHOIR_PANS = [0.35, -0.35, 0.55, -0.55];
  function quartet(ctx, dest, t, beat, rand) {
    var rnd = function (a, b) { return rand.rnd(a, b); };
    var pool = [-0.42, 0, 0.42].map(function (pp) { var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, 0); sp.connect(dest); return sp; });
    function panAt(p) { return pool[p < -0.2 ? 0 : p > 0.2 ? 2 : 1]; }
    function env(g, t0, pts) { g.gain.setValueAtTime(0, t0); var tt = t0; for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); } return tt; }
    function choirVoiceLine(t, notes, vi, gainMul) {
      var vowelAmt = 0.4, scoop = 0.5;
      var o = ctx.createOscillator(); o.type = "sawtooth";
      var pre = ctx.createGain(); pre.gain.setValueAtTime(0.16, t); o.connect(pre);
      var fAh = CHOIR_FORMANTS.ah[vi], fOo = CHOIR_FORMANTS.oo[vi];
      var vg = ctx.createGain();
      for (var fi = 0; fi < 3; fi++) {
        var bq = ctx.createBiquadFilter(); bq.type = "bandpass";
        bq.frequency.setValueAtTime(fAh[fi] * (1 - vowelAmt) + fOo[fi] * vowelAmt, t);
        bq.Q.setValueAtTime(fi === 0 ? 6 : fi === 1 ? 9 : 5, t);
        var bg = ctx.createGain(); bg.gain.setValueAtTime(fi === 0 ? 1 : fi === 1 ? 0.6 : 0.1, t);
        pre.connect(bq); bq.connect(bg); bg.connect(vg);
      }
      vg.connect(panAt(CHOIR_PANS[vi]));
      var det = 1 + rnd(-0.004, 0.004);
      o.frequency.setValueAtTime(notes[0].f * det, t);
      var tt = t, total = 0;
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        if (i > 0) {
          var port = Math.max(0.1, Math.min(0.45, n.dur * 0.3)) * (0.4 + scoop);
          o.frequency.setValueAtTime(notes[i - 1].f * det, tt);
          o.frequency.linearRampToValueAtTime(n.f * det, tt + port);
        }
        tt += n.dur; total += n.dur;
      }
      var peak = (gainMul || 1) * 0.5;
      env(vg, t, [[rnd(0.6, 1.2), peak], [Math.max(0.2, total - 2.4), peak * 0.88], [rnd(1, 1.6), 0]]);
      o.start(t); o.stop(t + total + 1.8);
      return total;
    }
    // v0.30 sings a line without the mid-line breath: the rest folds into the note before
    var P = parts(beat, "ah"), total = 0;
    ["S", "A", "T", "B"].forEach(function (p, vi) {
      var ns = [];
      P[p].forEach(function (n) { if (n.rest) ns[ns.length - 1].dur += n.dur; else ns.push({ f: n.f, dur: n.dur }); });
      var stagger = vi === 0 ? 0 : rnd(0.05, 0.25);
      total = Math.max(total, stagger + choirVoiceLine(t + stagger, ns, vi, 0.95 * (vi === 0 ? 1 : 0.8)));
    });
    return t + total + 1.8;
  }

  // --------------------------------------------------------------------------
  // THE CAST (seeded from the lab's seed)
  // --------------------------------------------------------------------------
  function cast(seed) {
    return {
      alto: V.singer({ seed: seed, name: "alto", part: "A", age: "mid", confidence: 0.95, brightness: 0.62, breath: 0.3, vibrato: { rate: 5.5, depth: 34, onsetDelay: 0.4 }, pan: -0.18 }),
      oldBass: V.singer({ seed: seed, name: "oldbass", part: "B", age: "old", confidence: 0.8, brightness: 0.3, breath: 0.45, pitchHabitCents: -24, timingHabitMs: 95, pan: -0.3 }),
      child: V.singer({ seed: seed, name: "child", part: "child", age: "young", confidence: 0.55, brightness: 0.6, breath: 0.7, timingHabitMs: 40, pan: 0.12 }),
      soloist: V.singer({ seed: seed, name: "soloist", part: "S", age: "mid", confidence: 0.97, brightness: 0.7, breath: 0.25, vibrato: { rate: 5.7, depth: 42, onsetDelay: 0.3 }, pan: 0.15 }),
      precentor: V.precentor({ seed: seed, pan: 0.05 }),
    };
  }
  function ward(seed, o) { return V.congregation({ seed: seed, desks: o.desks, voicesPerDesk: o.per }); }

  // THE FULL WARD (owner's A/B, 2026-09-26): thirty-two people, each with a
  // throat of their own — own vowel banks, breath and tilt as well as their
  // own pitch, timing and vibrato — against the same thirty-two seated as
  // eight desks of four. Eight to a part; power-matched to the desks (each
  // voice at 1/√8 of the part, as a desk's four sum at 1/√4 and a part's two
  // desks at 1/√2).
  var FULL_PARTS = ["S", "A", "T", "B"];
  function fullWard(seed) {
    var root = PJ2.Rand.stream(seed).fork("fullward"), people = [];
    FULL_PARTS.forEach(function (part, pi) {
      for (var k = 0; k < 8; k++) {
        var r = root.fork(part + ":" + k);
        var base = { S: 0.30, A: -0.30, T: 0.45, B: -0.45 }[part] * 0.9;
        people.push(V.singer({
          seed: seed, name: "ward-" + part + k, part: part,
          age: r.pick(["young", "mid", "mid", "old"]),
          confidence: r.rnd(0.45, 0.9),
          brightness: r.rnd(0.3, 0.65),
          breath: r.rnd(0.2, 0.55),
          pitchHabitCents: r.rnd(-12, 12),
          timingHabitMs: r.rnd(0, 70) + r.rnd(-10, 25),
          tractScale: r.rnd(0.95, 1.05),
          pan: Math.max(-0.9, Math.min(0.9, base + r.rnd(-0.3, 0.3))),
        }));
      }
    });
    return {
      sing: function (ctx, dest, t, parts, gain) {
        var end = t, g = (gain == null ? 1 : gain) / Math.sqrt(8);
        people.forEach(function (p) { var line = parts[p.spec.part]; if (line) end = Math.max(end, p.sing(ctx, dest, t, line, g)); });
        return end;
      },
    };
  }

  // --------------------------------------------------------------------------
  // THE DEMONSTRATIONS. Each: (ctx, bus, t0, o) → end time. o = {seed, desks,
  // per, beat}. Level constants are set so each sits at the quartet's level
  // (measured on the bench: RMS within ±1.5 dB).
  // --------------------------------------------------------------------------
  var CONG = 1.0, SOLO = 0.55, QUARTET_MATCH = Math.pow(10, 16 / 20);
  var DEMOS = [
    { id: "quartet", n: "1", name: "Today's quartet", desc: "v0.30: four sawtooth voices, one vowel, three bandpasses (the A)",
      run: function (ctx, bus, t, o) {
        // alone, the old quartet sits ~16 dB under the app's hymn level (it
        // was one layer among many); matched, the A/B is about timbre, not volume
        var d = bus.hall;
        if (o.match) { d = ctx.createGain(); d.gain.setValueAtTime(QUARTET_MATCH, 0); d.connect(bus.hall); }
        return quartet(ctx, d, t, o.beat, PJ2.Rand.stream(o.seed).fork("quartet"));
      } },
    { id: "ward", n: "2", name: "The congregation", desc: "desks of people, the line on the vowels of a verse",
      run: function (ctx, bus, t, o) { return ward(o.seed, o).sing(ctx, bus.hall, t, parts(o.beat, "words"), CONG) + 1; } },
    { id: "full32", n: "2a", name: "The full ward: 32 people, each their own voice", desc: "every singer with a throat of their own (8 to a part) — the owner's A/B",
      run: function (ctx, bus, t, o) { return fullWard(o.seed).sing(ctx, bus.hall, t, parts(o.beat, "words"), CONG) + 1; } },
    { id: "desks32", n: "2b", name: "The same 32 as 8 desks of 4", desc: "four to a shared throat — the economical way, for the A/B",
      run: function (ctx, bus, t, o) { return V.congregation({ seed: o.seed, desks: 8, voicesPerDesk: 4 }).sing(ctx, bus.hall, t, parts(o.beat, "words"), CONG) + 1; } },
    { id: "forward", n: "3", name: "People come forward", desc: "twice through: the harmony alto; then the old bass and a child on the tune",
      run: function (ctx, bus, t, o) {
        var W = ward(o.seed, o), K = cast(o.seed), L = lineDur(o.beat) + o.beat;
        W.sing(ctx, bus.hall, t, parts(o.beat, "words"), CONG * 0.8);
        K.alto.sing(ctx, bus.near, t, partLine("A", o.beat, "words"), SOLO);
        var t2 = t + L;
        W.sing(ctx, bus.hall, t2, parts(o.beat, "words"), CONG * 0.8);
        K.alto.sing(ctx, bus.near, t2, partLine("A", o.beat, "words"), SOLO * 0.8);
        K.oldBass.sing(ctx, bus.near, t2, partLine("B", o.beat, "words"), SOLO * 1.15);
        // the child loses the words in the first line (hums them), finds them in
        // the second. At pitch: the tune is in the treble here, and a child tops
        // out near G5 (an octave up is for a tune in the tenor — open issue 4)
        var cw = WORDS.map(function (w, i) { return i >= 2 && i <= 5 ? "hum" : w; });
        return K.child.sing(ctx, bus.near, t2, partLine("S", o.beat, cw), SOLO * 1.1) + 1;
      } },
    { id: "lined", n: "4", name: "Lining out", desc: "the precentor ornaments a line; the ward answers slowly, each desk its own way",
      run: function (ctx, bus, t, o) {
        var W = ward(o.seed, o), K = cast(o.seed);
        var mel = partLine("S", o.beat, "words", { oct: 0.5 });   // the precentor is a tenor: the tune an octave down
        var tt = t;
        for (var ph = 1; ph <= 2; ph++) {
          var line = phrase(mel, ph);
          tt = K.precentor.line(ctx, bus.near, tt, slow(line, 1.1), SOLO * 1.05, SCALE) + 0.5;
          tt = W.lined(ctx, bus.hall, tt, slow(phrase(partLine("S", o.beat, "words"), ph), 2.2), CONG * 0.95, { tonicHz: SCALE.tonicHz, scale: SCALE.scale, amount: 0.6, spread: 0.4 }) + 0.9;
        }
        return tt;
      } },
    { id: "notes", n: "5", name: "On the notes, then on ah and oo", desc: "fa sol la mi (each part its own shapes), then the verse on ah, then oo",
      run: function (ctx, bus, t, o) {
        var W = ward(o.seed, o), L = lineDur(o.beat) + o.beat * 1.2, tt = t;
        ["notes", "ah", "oo"].forEach(function (v, i) { W.sing(ctx, bus.hall, tt + i * L, parts(o.beat, v), CONG); });
        return tt + 3 * L;
      } },
    { id: "descant", n: "6", name: "A descant", desc: "the soloist's descant above the ward, on the last verse",
      run: function (ctx, bus, t, o) {
        var W = ward(o.seed, o), K = cast(o.seed);
        W.sing(ctx, bus.hall, t, parts(o.beat, "words"), CONG * 0.85);
        return K.soloist.sing(ctx, bus.near, t, partLine("D", o.beat, "words"), SOLO * 0.8) + 1;
      } },
    { id: "hum", n: "+", name: "The ward hums", desc: "the same line on mm — under a prayer, or a testimony",
      run: function (ctx, bus, t, o) { return ward(o.seed, o).hum(ctx, bus.hall, t, parts(o.beat, "ah"), CONG * 0.95) + 1; } },
  ];
  var PEOPLE = [
    { id: "p-alto", name: "the harmony alto", run: function (ctx, bus, t, o) { return cast(o.seed).alto.sing(ctx, bus.near, t, partLine("A", o.beat, "words"), SOLO) + 1; } },
    { id: "p-bass", name: "the old bass", run: function (ctx, bus, t, o) { return cast(o.seed).oldBass.sing(ctx, bus.near, t, partLine("B", o.beat, "words"), SOLO * 1.15) + 1; } },
    { id: "p-child", name: "the child", run: function (ctx, bus, t, o) { return cast(o.seed).child.sing(ctx, bus.near, t, partLine("S", o.beat, "words"), SOLO * 1.1) + 1; } },
    { id: "p-solo", name: "the soloist", run: function (ctx, bus, t, o) { return cast(o.seed).soloist.sing(ctx, bus.near, t, partLine("D", o.beat, "words"), SOLO * 0.8) + 1; } },
    { id: "p-prec", name: "the precentor", run: function (ctx, bus, t, o) { return cast(o.seed).precentor.line(ctx, bus.near, t, slow(partLine("S", o.beat, "words", { oct: 0.5 }), 1.1), SOLO * 1.05, SCALE) + 1; } },
    { id: "p-desk", name: "one desk (sopranos)", run: function (ctx, bus, t, o) { return ward(o.seed, o).desks[0].sing(ctx, bus.hall, t, partLine("S", o.beat, "words"), CONG) + 1; } },
    { id: "p-desk-notes", name: "one desk, on the notes", run: function (ctx, bus, t, o) { return ward(o.seed, o).desks[0].sing(ctx, bus.hall, t, partLine("S", o.beat, "notes"), CONG) + 1; } },
    { id: "p-desk-hum", name: "one desk, humming", run: function (ctx, bus, t, o) { return ward(o.seed, o).desks[1].hum(ctx, bus.hall, t, partLine("B", o.beat, "ah"), CONG * 0.95) + 1; } },
  ];
  function byId(id) { var all = DEMOS.concat(PEOPLE); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }

  // --------------------------------------------------------------------------
  // LIVE PLAYBACK
  // --------------------------------------------------------------------------
  var live = null, liveCtx = null, lastId = "ward", statusTimer = null;
  function opts() {
    return { seed: parseInt($("vl-seed").value, 10) || 1, desks: +$("vl-desks").value, per: +$("vl-per").value, beat: +$("vl-beat").value, room: +$("vl-room").value / 100, match: $("vl-match").checked };
  }
  function stopLive() {
    if (live) live.stop();
    live = null;
    if (liveCtx) { var c = liveCtx; liveCtx = null; c.close().catch(function () {}); }
    clearInterval(statusTimer);
    paintOn(null);
  }
  function play(id) {
    stopLive();
    var d = byId(id); if (!d) return;
    lastId = id;
    var o = opts();
    var ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });
    liveCtx = ctx;
    var bus = chain(ctx, o.room);
    live = bus;
    paintOn(id);
    bus.ready.then(function () {
      if (liveCtx !== ctx) return;
      V.budget.reset();
      var t0 = ctx.currentTime + 0.6;                   // the one read of the clock: when the page starts
      var end = d.run(ctx, bus, t0, o);
      var rep = V.budget.report(t0 - 0.5, end);
      var len = end - t0;
      $("vl-status").innerHTML = "playing <b>" + d.name + "</b> · " + len.toFixed(1) + " s · nodes alive: " + (id === "quartet" ? "47 (v0.30's own, 11 a voice — not in the ledger)" : "peak <b>" + rep.peak + "</b>, mean " + rep.mean.toFixed(0)) +
        (id === "full32" || id === "desks32" ? " · thirty-two singers" : /^(ward|forward|lined|notes|descant|hum|p-desk)/.test(id) ? " · desks " + o.desks + " × " + o.per : "");
      drawBudget(rep);
      statusTimer = setInterval(function () { if (liveCtx === ctx && ctx.currentTime > t0 + len + 2.5) stopLive(); }, 500);
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  }
  function paintOn(id) {
    document.querySelectorAll("[data-demo]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-demo") === id); });
  }

  // --------------------------------------------------------------------------
  // THE BENCH
  // --------------------------------------------------------------------------
  // offline render: resolves { buffer, ms, dur, budget }
  function render(runFn, o, tail) {
    var sr = 48000;
    // a dry pass on a throwaway context sizes the render (nothing is rendered)
    var probe = new OfflineAudioContext(2, sr, sr);
    var pbus = { near: probe.createGain(), hall: probe.createGain() };
    var dur = runFn(probe, pbus, 0.6, o) + (tail || 2.5);
    var ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    var bus = chain(ctx, o.room);
    return bus.ready.then(function () {
      V.budget.reset();
      var end = runFn(ctx, bus, 0.6, o);
      var budget = V.budget.report(0, end);
      var t0 = performance.now();
      return ctx.startRendering().then(function (buf) { return { buffer: buf, ms: performance.now() - t0, dur: dur, budget: budget }; });
    });
  }
  // --- tiny FFT (radix 2, in place) ---
  function fft(re, im) {
    var n = re.length, i, j = 0, k;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { k = re[i]; re[i] = re[j]; re[j] = k; k = im[i]; im[i] = im[j]; im[j] = k; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (j = 0; j < len / 2; j++) {
          var a = i + j, b = a + len / 2;
          var tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function mono(buf) { var a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a, m = new Float32Array(a.length); for (var i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5; return m; }
  function stft(x, sr, N, hop, fn) {
    var win = new Float32Array(N); for (var i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    var re = new Float32Array(N), im = new Float32Array(N), mag = new Float32Array(N / 2), fr = 0;
    for (var s = 0; s + N <= x.length; s += hop, fr++) {
      for (var k = 0; k < N; k++) { re[k] = x[s + k] * win[k]; im[k] = 0; }
      fft(re, im);
      for (var b = 0; b < N / 2; b++) mag[b] = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      fn(mag, fr, s);
    }
    return fr;
  }
  function db(x) { return 20 * Math.log(Math.max(x, 1e-9)) / Math.LN10; }
  function analyse(res) {
    var buf = res.buffer, sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1);
    var peak = 0, clip = 0, ss = 0, n = L.length;
    for (var i = 0; i < n; i++) { var a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clip++; ss += (L[i] * L[i] + R[i] * R[i]) / 2; }
    var x = mono(buf);
    // loudness where it sings: RMS over 400 ms windows, the loud half averaged
    var W = Math.floor(sr * 0.4), wins = [];
    for (var w = 0; w + W <= n; w += W) { var s2 = 0; for (var j = w; j < w + W; j++) s2 += x[j] * x[j]; wins.push(s2 / W); }
    wins.sort(function (p, q) { return q - p; });
    var top = wins.slice(0, Math.max(1, Math.floor(wins.length / 2))), tm = 0; top.forEach(function (v) { tm += v; }); tm /= top.length;
    // clicks: the second difference against its own local level. A click is
    // a sample-scale discontinuity: |d2| far above the 20 ms neighbourhood.
    var d2 = new Float32Array(n);
    for (var k = 2; k < n; k++) d2[k] = x[k] - 2 * x[k - 1] + x[k - 2];
    var H = Math.floor(sr * 0.01), pre = new Float64Array(n + 1);
    for (var k2 = 0; k2 < n; k2++) pre[k2 + 1] = pre[k2] + d2[k2] * d2[k2];
    var clicks = [], lastC = -1e9;
    for (var k3 = H; k3 < n - H; k3++) {
      var v = Math.abs(d2[k3]);
      if (v < 2e-3) continue;
      var loc = Math.sqrt((pre[k3 + H] - pre[k3 - H] - v * v) / (2 * H - 1));
      if (v > 10 * loc + 1e-4 && k3 - lastC > sr * 0.02) { clicks.push(+(k3 / sr).toFixed(3)); lastC = k3; }
    }
    // bands and the spectrogram
    var N = 2048, hop = Math.max(512, Math.floor(n / 1000 / 512) * 512 || 512);
    var bands = { low: 0, mud: 0, body: 0, presence: 0, air: 0 }, tot = 0, cols = [];
    var binHz = sr / N;
    stft(x, sr, N, hop, function (mag) {
      var col = new Float32Array(260);
      for (var b = 1; b < N / 2; b++) {
        var f = b * binHz, p = mag[b] * mag[b];
        tot += p;
        if (f < 120) bands.low += p; else if (f < 250) bands.mud += p; else if (f < 2000) bands.body += p; else if (f < 5000) bands.presence += p; else bands.air += p;
      }
      for (var y = 0; y < 260; y++) {
        var fy = 50 * Math.pow(200, y / 259), bi = Math.round(fy / binHz), bj = Math.max(bi, Math.round(50 * Math.pow(200, (y + 1) / 259) / binHz));
        var m = 0; for (var q = bi; q <= bj && q < N / 2; q++) if (mag[q] > m) m = mag[q];
        col[y] = m;
      }
      cols.push(col);
    });
    for (var kb in bands) bands[kb] = +(100 * bands[kb] / tot).toFixed(1);
    return {
      dur: +res.dur.toFixed(2), renderMs: Math.round(res.ms), xRealtime: +(res.dur * 1000 / res.ms).toFixed(1),
      peakDb: +db(peak).toFixed(2), clipSamples: clip, rmsDb: +db(Math.sqrt(ss / n)).toFixed(1), loudDb: +(10 * Math.log(tm) / Math.LN10).toFixed(1),
      clicks: clicks.length, clickTimes: clicks.slice(0, 12), bandsPct: bands,
      nodesPeak: res.budget.peak, nodesMean: Math.round(res.budget.mean), nodesByKind: res.budget.byKind, perSecond: res.budget.perSecond,
      _cols: cols,
    };
  }
  function drawSpec(cols) {
    var cv = $("vl-spec"); cv.hidden = false;
    var w = cv.width, h = cv.height, g = cv.getContext("2d"), img = g.createImageData(w, h);
    var maxv = 1e-9; cols.forEach(function (c) { for (var y = 0; y < c.length; y++) if (c[y] > maxv) maxv = c[y]; });
    for (var x = 0; x < w; x++) {
      var c = cols[Math.min(cols.length - 1, Math.floor(x * cols.length / w))];
      for (var y = 0; y < h; y++) {
        var v = c ? c[Math.floor((h - 1 - y) * c.length / h)] : 0;
        var d = (db(v / maxv) + 80) / 80; d = d < 0 ? 0 : d > 1 ? 1 : d;
        // paper → green ink → near-black
        var o = (y * w + x) * 4;
        img.data[o] = 245 - d * 225; img.data[o + 1] = 240 - d * 190; img.data[o + 2] = 228 - d * 190; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var y250 = h - 1 - Math.round(Math.log(250 / 50) / Math.log(200) * (h - 1));
    g.strokeStyle = "rgba(138,122,69,0.9)"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, y250); g.lineTo(w, y250); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#8a7a45"; g.font = "12px Georgia"; g.fillText("250 Hz", 4, y250 - 3);
  }
  function drawBudget(rep) {
    var cv = $("vl-budget"); cv.hidden = false;
    var g = cv.getContext("2d"), w = cv.width, h = cv.height, per = rep.perSecond || [];
    g.clearRect(0, 0, w, h);
    var mx = Math.max(1, rep.peak), bw = w / Math.max(1, per.length);
    g.fillStyle = "rgba(30,77,59,0.75)";
    per.forEach(function (v, i) { var bh = (v / mx) * (h - 18); g.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh); });
    g.fillStyle = "#1e4d3b"; g.font = "12px Georgia"; g.fillText("nodes alive per second · peak " + rep.peak + " · mean " + Math.round(rep.mean), 4, 12);
  }
  function row(k, v, ok) { return "<tr><th>" + k + "</th><td class='" + (ok === false ? "vl-no" : "vl-ok") + "'>" + v + "</td></tr>"; }
  function reportHtml(name, a) {
    return "<p><b>" + name + "</b></p><table>" +
      row("length", a.dur + " s · rendered in " + a.renderMs + " ms (" + a.xRealtime + "× real time)") +
      row("peak", a.peakDb + " dBFS · clipped samples " + a.clipSamples, a.clipSamples === 0 && a.peakDb < -0.5) +
      row("level", "RMS " + a.rmsDb + " dBFS · loud half " + a.loudDb + " dBFS") +
      row("clicks", a.clicks + (a.clicks ? " at " + a.clickTimes.join(", ") + " s" : ""), a.clicks === 0) +
      row("energy", "&lt;120 Hz " + a.bandsPct.low + " % · 120–250 " + a.bandsPct.mud + " % · 250–2k " + a.bandsPct.body + " % · 2–5k " + a.bandsPct.presence + " % · &gt;5k " + a.bandsPct.air + " %") +
      row("nodes", "peak " + a.nodesPeak + " · mean " + a.nodesMean + " · " + Object.keys(a.nodesByKind).map(function (k) { return k + " " + a.nodesByKind[k]; }).join(", ")) +
      "</table>";
  }
  function measure(id, over) {
    var d = byId(id), o = Object.assign(opts(), over || {});
    return render(d.run, o).then(function (res) {
      var a = analyse(res);
      a.id = id;
      return a;
    });
  }

  // --- the flanger test: the per-harmonic envelope of a held note. Two
  // people at a fixed tiny detune beat PERIODICALLY on every harmonic (the
  // comb sweeping: a flanger). A desk should wander instead: low periodicity.
  function heldRun(naive) {
    return function (ctx, bus, t, o) {
      var dsk = naive
        ? V.desk({ seed: o.seed, name: "naive", part: "T", voices: 2, detuneCents: 1.5, spreadMs: 0, drift: 0, vibrato: { depth: 0, rate: 5, onsetDelay: 9 }, confidence: 1 })
        : V.congregation({ seed: o.seed, desks: 4, voicesPerDesk: o.per }).desks[3];     // the tenor desk
      return dsk.sing(ctx, bus.hall, t, [{ f: G2 * 2, dur: 6, vowel: "ah" }], 1) + 0.5;
    };
  }
  function periodicity(buf, f0) {
    var x = mono(buf), sr = buf.sampleRate, N = 8192, hop = 480, envs = [];
    for (var h = 1; h <= 10; h++) envs.push([]);
    stft(x, sr, N, hop, function (mag, fr, s) {
      var tsec = s / sr;
      if (tsec < 2.0 || tsec > 6.0) return;
      for (var h = 1; h <= 10; h++) {
        var b = Math.round(h * f0 * N / sr), m = 0;
        for (var q = b - 2; q <= b + 2; q++) if (mag[q] > m) m = mag[q];
        envs[h - 1].push(m);
      }
    });
    var per = [], depth = [];
    envs.forEach(function (e) {
      var n = e.length, mean = 0; e.forEach(function (v) { mean += v; }); mean /= n;
      var z = e.map(function (v) { return v - mean; }), r0 = 0; z.forEach(function (v) { r0 += v * v; });
      var best = 0, crossed = false;
      for (var lag = 3; lag < Math.min(200, n - 20); lag++) {
        var r = 0; for (var i = 0; i + lag < n; i++) r += z[i] * z[i + lag];
        r /= r0 * (n - lag) / n;
        if (r < 0) crossed = true; else if (crossed && r > best) best = r;
      }
      per.push(best);
      var sorted = e.slice().sort(function (a, b) { return a - b; });
      depth.push(db(sorted[Math.floor(n * 0.95)] / Math.max(1e-9, sorted[Math.floor(n * 0.05)])));
    });
    function med(a) { var s = a.slice().sort(function (p, q) { return p - q; }); return s[Math.floor(s.length / 2)]; }
    return { periodicity: +med(per).toFixed(2), amDepthDb: +med(depth).toFixed(1), perHarmonic: per.map(function (v) { return +v.toFixed(2); }) };
  }
  function flangeTest() {
    var o = Object.assign(opts(), { room: 0 });
    return Promise.all([render(heldRun(false), o), render(heldRun(true), o)]).then(function (rs) {
      return { desk: periodicity(rs[0].buffer, G2 * 2), naive: periodicity(rs[1].buffer, G2 * 2) };
    });
  }

  // --- the budget: 6 desks + 2 soloists (the descant scene, on the notes,
  // which opens the most mouths), for every quality setting ---
  function budgetRun(desks) {
    return function (ctx, bus, t, o) {
      var W = V.congregation({ seed: o.seed, desks: desks, voicesPerDesk: o.per }), K = cast(o.seed);
      W.sing(ctx, bus.hall, t, parts(o.beat, "notes"), CONG);
      K.alto.sing(ctx, bus.near, t, partLine("A", o.beat, "notes"), SOLO);
      return K.soloist.sing(ctx, bus.near, t, partLine("D", o.beat, "notes"), SOLO) + 1;
    };
  }
  function budgetTable(withCpu) {
    var o = opts(), rows = [], chainP = Promise.resolve();
    [2, 3, 4, 6, 8].forEach(function (d) {
      chainP = chainP.then(function () {
        if (!withCpu) {
          var probe = new OfflineAudioContext(2, 48000, 48000);
          V.budget.reset();
          var end = budgetRun(d)(probe, { near: probe.createGain(), hall: probe.createGain() }, 0.6, o);
          var rep = V.budget.report(0, end);
          rows.push({ desks: d, peak: rep.peak, mean: Math.round(rep.mean), byKind: rep.byKind });
          return;
        }
        return render(budgetRun(d), o).then(function (res) {
          rows.push({ desks: d, peak: res.budget.peak, mean: Math.round(res.budget.mean), byKind: res.budget.byKind, xRealtime: +(res.dur * 1000 / res.ms).toFixed(1) });
        });
      });
    });
    return chainP.then(function () { return rows; });
  }

  // --------------------------------------------------------------------------
  // THE PAGE
  // --------------------------------------------------------------------------
  var demosEl = $("vl-demos");
  DEMOS.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "vl-demo"; b.setAttribute("data-demo", d.id);
    b.innerHTML = "<b><i>" + d.n + "</i>" + d.name + "</b><span>" + d.desc + "</span>";
    b.addEventListener("click", function () { play(d.id); });
    demosEl.appendChild(b);
  });
  var peopleEl = $("vl-people");
  PEOPLE.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "vl-btn"; b.setAttribute("data-demo", d.id); b.textContent = d.name;
    b.addEventListener("click", function () { play(d.id); });
    peopleEl.appendChild(b);
  });
  [["vl-desks", ""], ["vl-per", ""], ["vl-beat", " s"], ["vl-room", ""]].forEach(function (p) {
    var el = $(p[0]), out = $(p[0] + "-out");
    var paint = function () { out.textContent = (p[0] === "vl-beat" ? (+el.value).toFixed(2) : el.value) + p[1]; };
    el.addEventListener("input", paint); paint();
  });
  $("vl-stop").addEventListener("click", stopLive);
  $("vl-measure").addEventListener("click", function () {
    var d = byId(lastId);
    $("vl-report").innerHTML = "<p>rendering <b>" + d.name + "</b>…</p>";
    measure(lastId).then(function (a) { $("vl-report").innerHTML = reportHtml(d.name, a); drawSpec(a._cols); drawBudget({ perSecond: a.perSecond, peak: a.nodesPeak, mean: a.nodesMean }); })
      .catch(function (e) { showErr(String(e && e.stack || e)); });
  });
  $("vl-flange").addEventListener("click", function () {
    $("vl-report").innerHTML = "<p>rendering two held notes…</p>";
    flangeTest().then(function (r) {
      $("vl-report").innerHTML = "<p><b>Flanger test</b> — a held G3 on ah; per-harmonic envelope, harmonics 1–10. Periodicity near 1 means the beating repeats like a comb sweep.</p><table>" +
        row("one desk", "periodicity " + r.desk.periodicity + " · AM depth " + r.desk.amDepthDb + " dB", r.desk.periodicity < 0.5) +
        row("naive pair (fixed 3-cent detune, no drift, no vibrato)", "periodicity " + r.naive.periodicity + " · AM depth " + r.naive.amDepthDb + " dB") + "</table>";
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  });
  $("vl-budget-btn").addEventListener("click", function () {
    $("vl-report").innerHTML = "<p>counting (and rendering, for the CPU column)…</p>";
    budgetTable(true).then(function (rows) {
      $("vl-report").innerHTML = "<p><b>Node budget</b> — the descant scene on the notes: the congregation + 2 soloists (alto, descant); " + opts().per + " people a desk.</p><table><tr><th>desks</th><th>peak nodes</th><th>mean</th><th>render speed</th></tr>" +
        rows.map(function (r) { return "<tr><td>" + r.desks + "</td><td>" + r.peak + "</td><td>" + r.mean + "</td><td>" + r.xRealtime + "× real time</td></tr>"; }).join("") + "</table>";
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  });

  // --- THE HONK TEST (open issue 2): one steady singer sings a scale across
  // the part's compass on each vowel. Every note's level (the steady middle,
  // RMS, dry), and how far any note stands above the mean of its two
  // neighbours: the old mouth let a harmonic land on its +16 dB first
  // formant, and a note honked up to 8 dB over the notes beside it.
  function honkTest(seed) {
    var SC = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
    function hzOf(d) { return 261.63 * SC[((d % 7) + 7) % 7] * Math.pow(2, Math.floor(d / 7)); }
    var RANGE = { S: [0, 11], A: [-3, 8], T: [-7, 4], B: [-12, 0] }, VOW = ["ah", "oh", "oo", "ee", "eh"], NOTE = 0.7;
    var out = { parts: {}, worstExcess: 0, worstJump: 0, worstAt: "" }, chainP = Promise.resolve();
    Object.keys(RANGE).forEach(function (part) {
      chainP = chainP.then(function () {
        var sr = 48000, lines = [], t = 0.6;
        VOW.forEach(function (v) {
          var notes = [];
          for (var d = RANGE[part][0]; d <= RANGE[part][1]; d++) notes.push({ f: hzOf(d), dur: NOTE, vowel: v, stress: 1 });
          lines.push({ v: v, t: t, notes: notes }); t += notes.length * NOTE + 1.2;
        });
        var ctx = new OfflineAudioContext(1, Math.ceil((t + 1) * sr), sr);
        var s = V.singer({ seed: seed || 11, name: "honk-" + part, part: part, age: "mid", confidence: 0.95, brightness: 0.5, breath: 0.35, pitchHabitCents: 0, timingHabitMs: 0, pan: 0 });
        lines.forEach(function (L) { s.sing(ctx, ctx.destination, L.t, L.notes, 1); });
        return ctx.startRendering().then(function (buf) {
          var x = buf.getChannelData(0), res = {};
          lines.forEach(function (L) {
            var dbs = L.notes.map(function (n, i) {
              var a = Math.floor((L.t + i * NOTE + 0.25) * sr), b = Math.floor((L.t + i * NOTE + 0.6) * sr), s2 = 0;
              for (var k = a; k < b; k++) s2 += x[k] * x[k];
              return 10 * Math.log10(s2 / (b - a) + 1e-15);
            });
            var ex = 0, jump = 0, at = -1;
            for (var i = 1; i < dbs.length; i++) jump = Math.max(jump, Math.abs(dbs[i] - dbs[i - 1]));
            for (var j = 1; j < dbs.length - 1; j++) { var e = dbs[j] - (dbs[j - 1] + dbs[j + 1]) / 2; if (e > ex) { ex = e; at = j; } }
            res[L.v] = { maxExcessDb: +ex.toFixed(2), atHz: at >= 0 ? +L.notes[at].f.toFixed(1) : null, maxJumpDb: +jump.toFixed(2), meanDb: +(dbs.reduce(function (p, q) { return p + q; }, 0) / dbs.length).toFixed(2) };
            if (ex > out.worstExcess) { out.worstExcess = +ex.toFixed(2); out.worstAt = part + " " + L.v + " " + res[L.v].atHz + " Hz"; }
            out.worstJump = Math.max(out.worstJump, +jump.toFixed(2));
          });
          out.parts[part] = res;
        });
      });
    });
    return chainP.then(function () { return out; });
  }
  $("vl-honk").addEventListener("click", function () {
    $("vl-report").innerHTML = "<p>singing scales on five vowels in four parts…</p>";
    honkTest(opts().seed).then(function (r) {
      $("vl-report").innerHTML = "<p><b>The honk test</b> — one steady singer, a scale across the part's compass on each vowel. The worst note stands <b>" + r.worstExcess +
        " dB</b> above its neighbours (" + r.worstAt + "); the largest step between adjacent notes is " + r.worstJump + " dB.</p><table><tr><th>part</th><th>ah</th><th>oh</th><th>oo</th><th>ee</th><th>eh</th></tr>" +
        Object.keys(r.parts).map(function (p) { return "<tr><td>" + p + "</td>" + ["ah", "oh", "oo", "ee", "eh"].map(function (v) { var x = r.parts[p][v]; return "<td class='" + (x.maxExcessDb > 3 ? "vl-no" : "vl-ok") + "'>+" + x.maxExcessDb + " · " + x.meanDb + " dB</td>"; }).join("") + "</tr>"; }).join("") +
        "</table><p class='vl-note'>Each cell: the worst note over its neighbours, then the vowel's mean level. The open vowels carry (ah), the closed ones sit a dB or two under (oo, ee), as in real voices.</p>";
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  });

  // --- THE JOIN METER: the 3–12 kHz band in the 150 ms around every note
  // join of the lab's line (where the owner heard a hiss), as heard and with
  // the singers' folds silenced (the breath and the consonants alone)
  function joinTimes(beat, t0) {
    var out = [], t = t0;
    for (var i = 0; i < 14; i++) { if (i) out.push({ t: t, kind: i === 8 ? "line" : "note" }); t += BEATS[i] * beat * (i === 13 ? 1.5 : 1); }
    return out;
  }
  function joinMeter(id) {
    var d = byId(id || "full32"), o = Object.assign(opts(), { room: 0 });
    function once(silent) {
      var sr = 48000, probe = new OfflineAudioContext(2, sr, sr);
      var dur = d.run(probe, { near: probe.createGain(), hall: probe.createGain() }, 0.6, o) + 1.5;
      var ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
      if (silent) { var orig = ctx.createPeriodicWave.bind(ctx); ctx.createPeriodicWave = function (re, im) { return orig(new Float32Array(re.length), new Float32Array(im.length), { disableNormalization: true }); }; }
      var g = ctx.createGain(); g.gain.value = 0.6; g.connect(ctx.destination);
      d.run(ctx, { near: g, hall: g }, 0.6, o);
      return ctx.startRendering();
    }
    function band(buf) {
      var x = mono(buf), sr = buf.sampleRate, N = 1024, hop = 240, e = [], b0 = Math.ceil(3000 * N / sr), b1 = Math.floor(12000 * N / sr);
      stft(x, sr, N, hop, function (mag, fr, s) { var p = 0; for (var b = b0; b <= b1; b++) p += mag[b] * mag[b]; e.push([(s + N / 2) / sr, p]); });
      var joins = joinTimes(o.beat, 0.6), res = {};
      joins.forEach(function (j) {
        var sum = 0, n = 0; e.forEach(function (f) { if (f[0] >= j.t - 0.06 && f[0] < j.t + 0.09) { sum += f[1]; n++; } });
        var r = res[j.kind] = res[j.kind] || { p: 0, n: 0 }; r.p += n ? sum / n : 0; r.n++;
      });
      var o2 = {}; for (var k in res) o2[k] = +(10 * Math.log10(res[k].p / res[k].n + 1e-20)).toFixed(1);
      return o2;
    }
    return Promise.all([once(false), once(true)]).then(function (rs) { return { demo: d.id, heard: band(rs[0]), breath: band(rs[1]) }; });
  }
  $("vl-joins").addEventListener("click", function () {
    $("vl-report").innerHTML = "<p>rendering the full ward twice (as heard, and the folds silenced)…</p>";
    joinMeter("full32").then(function (r) {
      $("vl-report").innerHTML = "<p><b>The join meter</b> — the full ward (2a), dry: the 3–12 kHz band in the 150 ms around each join (relative dB; the same scale for both rows).</p><table>" +
        row("as heard", "note joins " + r.heard.note + " · the line's breath " + r.heard.line) +
        row("the breath and the consonants alone", "note joins " + r.breath.note + " · the line's breath " + r.breath.line) + "</table>";
    }).catch(function (e) { showErr(String(e && e.stack || e)); });
  });

  // for the headless bench (CDP): window.VoicesLab.measure("ward") → report
  window.VoicesLab = {
    demos: DEMOS.map(function (d) { return d.id; }), people: PEOPLE.map(function (d) { return d.id; }),
    play: play, stop: stopLive, measure: measure, flangeTest: flangeTest, budgetTable: budgetTable, honkTest: honkTest, joinMeter: joinMeter,
    specPng: function (a) { drawSpec(a._cols); return $("vl-spec").toDataURL("image/png"); },
    ready: irReady,
    // the detector's own sanity check: a sine with one hard step in it must
    // read as one click; the same sine without the step, as none
    selfTest: function () {
      var sr = 48000, n = sr * 3;
      function buf(step) {
        var c = new OfflineAudioContext(2, n, sr), b = c.createBuffer(2, n, sr);
        for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / sr) + (step && i > sr * 1.5 ? 0.05 : 0); }
        return analyse({ buffer: b, ms: 1, dur: 3, budget: { peak: 0, mean: 0, byKind: {}, perSecond: [] } }).clicks;
      }
      return { withStep: buf(true), clean: buf(false) };
    },
  };
})();
