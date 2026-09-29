// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE FAR WARD (KOLOB.GuestFarWard)
//
// Charles Ives heard music from far away and wrote it down as he heard it:
// in "The Unanswered Question" the strings are placed offstage; in the
// Fourth Symphony a distant choir; in "From the Steeples and the Mountains"
// bells answering across a valley; and in his father's Danbury, George Ives
// stood a band across the pond to hear his hymn come back late. Henry Brant
// made a life of it — orchestras on balconies and in stairwells, the same
// music a room away and a beat behind — and the old camp meetings did it
// without trying: two congregations in the one grove, singing the one hymn
// out of step, each hearing the other through the trees.
//
// At the rim of Kolob's light the colony is many settlements, and on some
// Sundays, through the chapel's open windows, the ward hears another ward
// — elsewhere in the colony, across the valley — singing THE SAME HYMN a
// line late: the same tune, heard across distance (the high frequencies
// gone, the sound late and wide with the valley's air), in its own tuning
// (a little sharp or a little flat of ours, and drifting, as a ward singing
// unaccompanied does: PLAN §3.6), sometimes in another harmonization —
// they sing it Sacred Harp while we sing it Tabernacle — and on its own
// chorister's time. Antiphony across the colony; the hymn doubled into a
// canon at a distance.
//
// THE SEAT. plan(meetingInfo, stream) decides: about one meeting in ten,
// leaning to a conference and a fast Sunday (PLAN §8.13) and to Christmas;
// seated on one of the day's hymns (never the doxology, which carries the
// meeting's payoff; never a round, a lined Old Way hymn, the Primary's song
// or a statement of the refrain), in a section with no guest in it or
// beside it (§8.13). Which verses it joins — from the second on, the last
// only, or all of them — is the seat's. Every die is thrown first.
//
// THE CANON. The far ward begins each verse it joins half a line to a line
// after ours (a drawn lag, whole beats), and sings the verse on its own
// chorister's clock (its own tempo, a hair off ours, and its own fermatas),
// re-finding us at the next verse; it sings the A-men after its last verse
// when ours does. Its harmony is its own dialect's (Composer.setTune: the
// tune kept, set again) or ours.
//
// THE VOICES. A second congregation, heard as one: eight pews of three
// (KOLOB.VoicesVocal.desk — twenty-four people, each pew one shared mouth
// with its own people's pitches, vibratos and lateness), which is how a
// congregation a valley away is heard. (The home ward is thirty-two throats
// by the owner's ruling; this is a different ward, at a distance where a pew
// is a voice. `material.voices: "people"` seats twenty-four throats instead,
// for the owner's A/B: the lab measures both.)
//
// PURE PLANNING. plan(), decide(), prepare() and score() touch no
// AudioContext, DOM, clock or Math.random; their dice come from the guest's
// stream (guest:farward:<n>) and its forks "seat", "shape", "material",
// "vowels", "synth". stage()/perform() read no clock: everything is placed
// at or after the times given, a line at a time through hooks.defer.
//
// Public surface: window.KOLOB.GuestFarWard
//   plan(meetingInfo, stream) → { guest: "farward", seat: "hymn", section,
//        sectionIndex, hymnId, from: "second"|"last"|"all", lagLines, far,
//        odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type}], hymnal?: [{id,
//       section (index), dialect, piece?, kind?}], guests: [{type, section,
//       index?}], force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare({ hymn, keynoteHz, voices?, far? }, stream) → the far ward's material
//     (pure; setTune'd when its dialect is another — a few ms, off the clock)
//   score(prepared, v, at, ourLines?, ourBeatS?) → one far verse as data (pure)
//   stage(ctx, dest, prepared, stream, hooks?) → { verse(v, ourAt, ourLines?,
//        ourBeatS?) → {t0, t1}, amen(ourAt) → t1, close(tEnd), prepared }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (the lab's
//     way: every joined verse at once, on our verses' times or its own)
//   warm(ctx)  — the valley's air, poured once (call it at the button press)
//   ODDS, EXCLUDES, FAR_DIALECTS, NAME, LABEL, LEVEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestFarWard = (function () {
  "use strict";

  var NAME = "farward";
  var LABEL = "guest:farward:";

  // ==========================================================================
  // THE ODDS — a starting point, for the owner's ear
  // ==========================================================================
  var ODDS = {
    base: 0.1,
    weight: {
      ordinary: 1, fast: 1.7, conference: 1.9, jubilee: 0.9,
      pioneer: 0.7, christmas: 1.3, easter: 1, wedding: 0.6, funeral: 0.8, dedication: 1.6,
    },
    cap: 0.5,
  };
  var EXCLUDES = [];                              // (only the PLAN §8.13 rule: no guest in or beside its section)
  var REFUSE_DIALECT = { oldway: 1 };             // a lined hymn is the precentor's and the ward's alone
  var REFUSE_PIECE = { round: 1, refrain: 1, refrainIn: 1, partner: 1 };
  // the far ward's harmony, by ours: the same, or another dialect's
  var FAR_DIALECTS = {
    tabernacle: [["same", 3], ["sacredharp", 3], ["shaker", 1]],
    sacredharp: [["same", 3], ["tabernacle", 3], ["shaker", 1]],
    psalmody: [["same", 2], ["sacredharp", 2], ["tabernacle", 2]],
    gospel: [["same", 3], ["tabernacle", 2], ["sacredharp", 1]],
    shaker: [["same", 3], ["sacredharp", 1], ["tabernacle", 1]],
    other: [["same", 3], ["sacredharp", 1], ["tabernacle", 1]],
  };
  // its bus. Calibrated in guests3c-lab against the ward singing the same
  // hymn in the same room: the far ward heard about 11 LU under ours
  var LEVEL = 1.0;
  var DESK_GAIN = 0.1;

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestFarWard: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  function pickW(R, pool) {
    var tot = 0, i; for (i = 0; i < pool.length; i++) tot += pool[i][1];
    var x = R.rnd(0, tot);
    for (i = 0; i < pool.length; i++) { x -= pool[i][1]; if (x <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }
  function pickWith(u, pool) { return pickW({ rnd: function (a, b) { return a + u * (b - a); } }, pool); }

  // ==========================================================================
  // THE SHAPE — every die of one performance, drawn in order
  // ==========================================================================
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      from: pickW(r, [["second", 5.5], ["last", 2.5], ["all", 2]]),
      lagLines: pickW(r, [[0.5, 3], [0.75, 1.2], [1, 3]]),
      dialectDie: r.next(),
      side: (r.chance(0.5) ? -1 : 1) * r.rnd(0.45, 0.85),
      distance: r.rnd(0, 1),                      // how far across the valley: the air, the level, the delay
      cents: (r.chance(0.5) ? -1 : 1) * r.rnd(8, 20),   // their pitch against ours
      drift: r.rnd(-3, 12),                       // and where it goes over their singing (sharp as they warm, mostly)
      tempo: r.rnd(0.985, 1.015),                 // their chorister's pace against ours
      holdMul: r.rnd(1.3, 1.9),                   // and her fermatas
      breath: r.rnd(0.25, 0.5),                   // the breath between their lines (s)
    };
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), rowDie = rs.next();
    var sh = shapeOf(stream);
    var p = oddsFor(info), why = null, secs = info.sections || [], guests = info.guests || [];
    function idxOf(g) {
      if (typeof g.index === "number") return [g.index];
      var out = []; for (var j = 0; j < secs.length; j++) if (secs[j] && secs[j].type === g.section) out.push(j);
      return out;
    }
    function crowded(si) { return guests.some(function (g) { return g && g.type !== NAME && idxOf(g).some(function (gi) { return Math.abs(gi - si) <= 1; }); }); }
    // the hymns it may join: the hymnal's rows (the plan's hymn sections, when
    // the hymnal is not handed in)
    var rows = info.hymnal && info.hymnal.length ? info.hymnal : secs.map(function (s, i) { return s && s.type === "hymn" ? { id: null, section: i, dialect: null } : null; }).filter(Boolean);
    var ok = rows.filter(function (row) {
      var s = secs[row.section];
      return s && s.type === "hymn" && !REFUSE_DIALECT[row.dialect] && !REFUSE_PIECE[row.piece] && row.kind !== "primary" && !crowded(row.section);
    });
    if (!rows.length) why = "no hymn";
    else if (!ok.length) why = "no hymn it may join";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var row = ok[Math.min(ok.length - 1, Math.floor(rowDie * ok.length))];
    var far = pickWith(sh.dialectDie, FAR_DIALECTS[row.dialect] || FAR_DIALECTS.other);
    return {
      seat: {
        guest: NAME, seat: "hymn", section: secs[row.section].type, sectionIndex: row.section, hymnId: row.id || null,
        from: sh.from, lagLines: sh.lagLines, far: far === row.dialect ? "same" : far, side: +sh.side.toFixed(2), odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE MATERIAL — the far ward's setting of our hymn, and its pews (pure)
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function lineLen(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    var S = window.KOLOB.Score;
    if (S && S.lineLength) return S.lineLength(line);
    var end = 0; for (var p in line.notes) (line.notes[p] || []).forEach(function (n) { end = Math.max(end, n.beat + n.beats); });
    return end;
  }
  // the lines a verse sings, in order: the verse, the fuge sung again as the
  // books repeat it, the refrain (as the ward sings them: kolob-cast.js)
  function lineOrder(h) {
    var order = [], nL = h.lines.length, all = h.lines.concat(h.refrain || []);
    for (var i = 0; i < all.length; i++) order.push(i);
    if (h.fuge && h.fuge.repeatFrom != null) for (var q = h.fuge.repeatFrom; q < nL; q++) order.splice(nL + (q - h.fuge.repeatFrom), 0, q);
    return order;
  }
  // the pews: eight of three, by the setting's parts — the four parts two
  // pews each; the Sacred Harp's treble and tenor doubled in octaves by the
  // women and the men; one tune in unison, the men an octave down
  function pews(setting) {
    var parts = Object.keys(setting.lines[0].notes).filter(function (p) { return (setting.lines[0].notes[p] || []).length; });
    var mp = setting.melodyPart || "S", has = function (p) { return parts.indexOf(p) >= 0; };
    if (parts.length <= 1) return [["S", mp, 1], ["S", mp, 1], ["A", mp, 1], ["A", mp, 1], ["T", mp, 0.5], ["T", mp, 0.5], ["B", mp, 0.5], ["B", mp, 0.5]];
    if (setting.dialect === "sacredharp" || setting.dialect === "psalmody")
      return [["S", has("S") ? "S" : "T", 1], ["S", "T", has("T") ? 2 : 1], ["A", has("A") ? "A" : "S", 1], ["A", has("T") ? "T" : "S", has("T") ? 2 : 1],
              ["T", has("T") ? "T" : mp, 1], ["T", has("S") ? "S" : mp, 0.5], ["B", has("B") ? "B" : mp, has("B") ? 1 : 0.5], ["B", has("B") ? "B" : mp, has("B") ? 1 : 0.5]];
    return ["S", "S", "A", "A", "T", "T", "B", "B"].map(function (p) { return [p, has(p) ? p : mp, has(p) ? 1 : (p === "T" || p === "B" ? 0.5 : 1)]; });
  }
  function prepare(material, stream) {
    material = material || {};
    var h = material.hymn;
    if (!h || !h.lines || !h.lines.length) throw new Error("KOLOB.GuestFarWard: prepare needs the hymn (a SCORE Hymn)");
    var sh = shapeOf(stream), far = pickWith(sh.dialectDie, FAR_DIALECTS[h.dialect] || FAR_DIALECTS.other), setting = h;
    if (material.far) far = material.far;                 // (the seat's own draw, or a lab's choice: "same" | a dialect)
    var C = window.KOLOB.Composer, nAll = h.lines.length + (h.refrain ? h.refrain.length : 0);
    if (far !== "same" && far !== h.dialect && C && C.setTune) {
      try {
        var st = C.setTune(need(stream).fork("material").fork("setTune"), h, { dialect: far, keyMonzo: h.keyMonzo, id: h.id + ":far" });
        if (st && st.lines && st.lines.length + (st.refrain ? st.refrain.length : 0) === nAll) setting = st;
      } catch (e) { setting = h; }
    }
    if (setting === h) far = "same";
    var r = stream.fork("material").fork("pews"), layout = pews(setting), ages = ["young", "mid", "mid", "old"];
    var desks = layout.map(function (d, k) {
      return { voicePart: d[0], sings: d[1], oct: d[2], spec: {
        part: d[0], voices: 3, age: ages[Math.floor(r.next() * 4)], confidence: r.rnd(0.45, 0.85), brightness: r.rnd(0.3, 0.55), breath: r.rnd(0.2, 0.45),
        lag: r.rnd(0, 0.06), spreadMs: r.rnd(18, 40), detuneCents: r.rnd(8, 14), pan: clamp((k % 2 ? 1 : -1) * r.rnd(0.02, 0.14), -0.2, 0.2) } };
    });
    // (the lines in our order; each as long as the far ward's own setting of it)
    var order = lineOrder(h), allS = setting.lines.concat(setting.refrain || []), nS = setting.lines.length;
    var lens = order.map(function (li) { return lineLen(allS[li], allS[li + 1] && li + 1 !== nS ? allS[li + 1] : null); });
    var d = sh.distance;
    return {
      hymn: h, setting: setting, far: far, order: order, lineBeats: lens, keynoteHz: material.keynoteHz || 260,
      lagLines: sh.lagLines, lagBeats: Math.max(2, Math.round(sh.lagLines * lens[0])), from: sh.from,
      tempo: sh.tempo, holdMul: sh.holdMul, breath: sh.breath, cents: sh.cents, drift: sh.drift,
      side: sh.side, distance: d, lpHz: Math.round(3200 - 1800 * d), delayS: r4(0.12 + 0.3 * d), direct: r4(0.55 - 0.25 * d), wet: r4(0.6 + 0.3 * d), trimDb: r4(-(2 + 4 * d)),
      desks: desks, voices: material.voices === "people" ? "people" : "desks", amen: !!(h.amen && (far === "same" || far === "tabernacle")),
      nearby: !!material.nearby,                  // (a lab's A/B: the same ward with no valley between — what the distance takes)
    };
  }

  // ==========================================================================
  // ONE FAR VERSE — on the far chorister's own clock, in the far ward's own
  // tuning (pure). at: when the far ward begins it (ours + the lag);
  // ourBeatS: our performance's beat; tune: {origin, span} — where their
  // drift is measured from, and over how long it runs
  // ==========================================================================
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 2], ["oo", 1.5], ["eh", 1.5]];
  function clockOf(line, beatS, holdMul) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { (line.notes[p] || []).forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: (holdMul - 1) * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  function partEvents(line, len, part, t0, beatS, holdMul) {
    var ev = [], clk = clockOf(line, beatS, holdMul), ns = line.notes[part] || [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var st = t0 + clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);   // the breath
      ev.push({ t: st, dur: dur, n: n });
    }
    return { ev: ev, end: t0 + clk(len) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0) };
  }
  function centsAt(pr, tune, t) { return pr.cents + pr.drift * clamp(tune && tune.span ? (t - tune.origin) / tune.span : 0, 0, 1); }
  function score(pr, v, at, ourBeatS, tune, stream) {
    var set = pr.setting, all = set.lines.concat(set.refrain || []), beatS = (ourBeatS || pr.hymn.beatS) / pr.tempo;
    var base = pr.keynoteHz * ratio(set.keyMonzo || [0, 0, 0, 0]), t = at, lines = [];
    var vr = stream ? stream.fork("vowels").fork("verse:" + v) : null, vow = [];
    for (var q = 0; q < 400; q++) vow.push(vr ? pickW(vr, VOWELS) : "ah");
    function sing(line, len, t0, li) {
      var desks = pr.desks.map(function (d, k) {
        var pe = partEvents(line, len, d.sings, t0, beatS, pr.holdMul), notes = [], last = "ah";
        pe.ev.forEach(function (e) {
          if (e.n.syl != null) last = vow[e.n.syl % vow.length];
          var c = centsAt(pr, tune, e.t);
          notes.push({ t: r4(e.t), dur: r4(e.dur), f: base * ratio(e.n.monzo) * d.oct * Math.pow(2, c / 1200), vowel: last, slur: e.n.syl === null, stress: e.n.stress, deg: e.n.deg, beat: e.n.beat, cents: r4(c) });
        });
        return { k: k, part: d.sings, notes: notes };
      });
      var end = partEvents(line, len, set.melodyPart || "S", t0, beatS, pr.holdMul).end;
      lines.push({ li: li, t0: r4(t0), t1: r4(end), desks: desks });
      return end;
    }
    pr.order.forEach(function (li, j) { t = sing(all[li], pr.lineBeats[j], t, li); });
    return { v: v, t0: r4(at), t1: r4(t), beatS: r4(beatS), lines: lines };
  }
  function amenScore(pr, at, ourBeatS, tune) {
    var h = pr.hymn, beatS = (ourBeatS || h.beatS) / pr.tempo, base = pr.keynoteHz * ratio(h.keyMonzo || [0, 0, 0, 0]), a = h.amen;
    if (!a) return null;
    var len = lineLen(a, null), desks = pr.desks.map(function (d, k) {
      var sings = a.notes[d.sings] ? d.sings : (d.voicePart === "T" || d.voicePart === "B" ? (a.notes.T ? "T" : "B") : "S");
      var pe = partEvents(a, len, sings, at, beatS * 1.1, pr.holdMul);
      return { k: k, part: sings, notes: pe.ev.map(function (e, i) { var c = centsAt(pr, tune, e.t); return { t: r4(e.t), dur: r4(e.dur), f: base * ratio(e.n.monzo) * (a.notes[d.sings] ? d.oct : 1) * Math.pow(2, c / 1200), vowel: i ? "eh" : "ah", stress: 1, cents: r4(c) }; }) };
    });
    return { t0: r4(at), t1: r4(partEvents(a, len, "S", at, beatS * 1.1, pr.holdMul).end), desks: desks };
  }

  // ==========================================================================
  // THE VALLEY'S AIR — the far ward's own space, poured once per context: a
  // dark, open tail (no walls) with a few late answers off the hills
  // ==========================================================================
  function valley(ctx) {
    if (ctx.__kolobValley) return ctx.__kolobValley;
    var sr = ctx.sampleRate, len = Math.floor(sr * 3.4), buf = ctx.createBuffer(2, len, sr), s = 90210;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }
    var HILLS = [[0.21, 0.34], [0.37, 0.22], [0.52, 0.15], [0.83, 0.08]];
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var tt = i / sr, e = Math.exp(-tt / 0.62) * Math.min(1, tt / 0.09);
        lp += 0.16 * (rnd() - lp); d[i] = lp * e * 0.9;
      }
      HILLS.forEach(function (hh, k) {
        var at = Math.floor((hh[0] + (ch ? 0.011 * (k + 1) : 0)) * sr);
        for (var j = 0; j < 240 && at + j < len; j++) d[at + j] += hh[1] * 0.4 * Math.exp(-j / 60) * (j % 2 ? -1 : 1) * (0.5 + 0.5 * Math.cos(j / 38));
      });
    }
    return (ctx.__kolobValley = buf);
  }
  function warm(ctx) { valley(ctx); }

  // ==========================================================================
  // STAGE — the far ward's pews and its distance, and a verse at a time
  // (the engine's way: each verse is handed as our ward's verse is written)
  // ==========================================================================
  var AHEAD = 2.5, TAIL = 5;
  // ARMING (VoicesVocal's): with the engine's clock, each line is built a
  // little ahead and joins the room only just before it sounds, each mouth
  // only around its own moments; one arm-tick cue at a time from t to the
  // end joins what is due and parts what has rung out (the ward's own pump
  // may call VoicesVocal.arm too: it is one queue). With no clock (an
  // offline render), every line joins at once.
  var ARM_STEP = 0.1, ARM_LEAD = 0.8;
  function armTicker(V, ctx, hooks, t, end) {
    if (!hooks.defer || !V.arm) return false;
    (function tick(at) {
      hooks.defer(at, function () {
        V.arm(ctx, at + ARM_LEAD, at);
        if (at < end + 1.5) tick(at + ARM_STEP);
      });
    })(t);
    return true;
  }
  function toSung(notes) {
    var out = [], t = notes.length ? notes[0].t : 0;
    notes.forEach(function (x) {
      if (x.t > t + 0.004) out.push({ rest: true, dur: x.t - t });
      out.push({ f: x.f, dur: x.dur, vowel: x.vowel, stress: x.stress, slur: !!x.slur });
      t = x.t + x.dur;
    });
    return out;
  }
  function stage(ctx, dest, pr, stream, hooks) {
    var V = window.KOLOB.VoicesVocal;
    if (!V || !V.desk) throw new Error("KOLOB.GuestFarWard: load kolob-voices-vocal.js first");
    hooks = hooks || {};
    var synth = stream.fork("synth");
    function G(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
    function F(type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    // the distance: sound takes its time across the valley; the air takes the
    // highs; most of what arrives is the valley's answer; it comes from one side
    var input = G(1), delay = ctx.createDelay(1), hp = F("highpass", 140, 0.6), lp = F("lowpass", pr.lpHz, 0.5), lp2 = F("lowpass", pr.lpHz * 1.4, 0.5);
    var direct = G(pr.direct), conv = ctx.createConvolver(), wet = G(pr.wet), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : G(1);
    var out = G(LEVEL * Math.pow(10, pr.trimDb / 20));
    delay.delayTime.value = pr.delayS; conv.buffer = valley(ctx);
    if (pan.pan) pan.pan.value = clamp(pr.side, -0.9, 0.9);
    if (pr.nearby) { input.connect(direct); direct.gain.value = 1; }
    else { input.connect(delay); delay.connect(hp); hp.connect(lp); lp.connect(lp2); lp2.connect(direct); lp2.connect(conv); conv.connect(wet); }
    direct.connect(pan); wet.connect(pan); pan.connect(out); out.connect(dest);
    var pewsV = pr.desks.map(function (d, k) {
      var spec = {}; for (var x in d.spec) spec[x] = d.spec[x];
      spec.rand = synth.fork("desk:" + k); spec.name = "farward:" + k;
      if (pr.voices !== "people") return { sing: V.desk(spec).sing, n: 1 };
      var ppl = [0, 1, 2].map(function (i) { var s2 = {}; for (var y in spec) s2[y] = spec[y]; s2.rand = synth.fork("desk:" + k + ":" + i); s2.pitchHabitCents = (i - 1) * spec.detuneCents * 0.8; s2.timingHabitMs = (spec.lag + (i - 1) * spec.spreadMs / 1000) * 1000; return V.singer(s2); });
      return { sing: function (c, dd, t, notes, g, o) { ppl.forEach(function (p) { p.sing(c, dd, t, notes, g / Math.sqrt(3), o); }); }, n: 3 };
    });
    var origin = null, span = null, lastEnd = -1e9, told = [], armed = false, armUntil = -1;
    // (the arm-tick runs over each verse as it is handed; a verse handed while
    // an earlier one's tick still runs just extends it)
    function armTo(from, to) {
      if (!hooks.defer || !V.arm) return false;
      if (armUntil >= from) { armUntil = Math.max(armUntil, to); return true; }
      armUntil = to;
      (function tick(at) { hooks.defer(at, function () { V.arm(ctx, at + ARM_LEAD, at); if (at < armUntil + 1.5) tick(at + ARM_STEP); else armUntil = -1; }); })(from);
      return true;
    }
    function lay(sc, now) {
      sc.lines.forEach(function (ln, j) {
        function go() {
          ln.desks.forEach(function (dk) {
            if (!dk.notes.length) return;
            pewsV[dk.k].sing(ctx, input, dk.notes[0].t, toSung(dk.notes), DESK_GAIN, { breathBefore: j ? pr.breath : 0.5, breathe: false, defer: armed });
          });
          if (hooks.onNote) ln.desks.forEach(function (dk) { if (dk.k % 2) return; dk.notes.forEach(function (n) { hooks.onNote({ layer: "farward", freq: n.f, t: n.t + pr.delayS, dur: n.dur, part: dk.part, guest: NAME, deg: n.deg, cents: n.cents, verse: sc.v, line: ln.li }); }); });
        }
        if (hooks.defer && ln.t0 - AHEAD > now) hooks.defer(ln.t0 - AHEAD, go); else go();
      });
    }
    return {
      prepared: pr, told: told,
      // v: the verse; ourAt: when ours begins it; ourBeatS: our beat; verses:
      // how many the far ward will sing in all (their drift runs over them)
      verse: function (v, ourAt, ourBeatS, verses) {
        var bs = ourBeatS || pr.hymn.beatS, at = Math.max(ourAt + pr.lagBeats * bs, lastEnd + pr.breath);
        if (origin === null) { origin = at; span = Math.max(20, (verses || 2) * pr.lineBeats.reduce(function (a, b) { return a + b; }, 0) * bs); }
        var sc = score(pr, v, at, bs, { origin: origin, span: span }, stream);
        armed = armTo(ourAt - 0.5, sc.t1 + pr.delayS);
        lay(sc, ourAt - 0.5);
        lastEnd = sc.t1; told.push({ v: v, ourAt: ourAt, t0: sc.t0, t1: sc.t1, sc: sc });
        if (hooks.onStage) hooks.onStage({ stage: "verse", v: v, t: sc.t0, guest: NAME });
        return { t0: sc.t0 + pr.delayS, t1: sc.t1 + pr.delayS };
      },
      amen: function (ourAt, ourBeatS) {
        if (!pr.amen) return lastEnd + pr.delayS;
        var at = Math.max(lastEnd + 0.3 * (ourBeatS || pr.hymn.beatS), ourAt), sc = amenScore(pr, at, ourBeatS, { origin: origin == null ? at : origin, span: span || 20 });
        if (!sc) return lastEnd + pr.delayS;
        armed = armTo(ourAt - 0.5, sc.t1 + pr.delayS);
        lay({ v: -1, lines: [{ li: -1, t0: sc.t0, t1: sc.t1, desks: sc.desks }] }, ourAt - 0.5);
        lastEnd = sc.t1;
        return sc.t1 + pr.delayS;
      },
      close: function (tEnd) {
        var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = G(0);
        sent.connect(sg); sg.connect(out);
        sent.onended = function () { try { sg.disconnect(); sent.disconnect(); input.disconnect(); out.disconnect(); } catch (e) { /* gone */ } };
        sent.start(Math.max(0, Math.min(tEnd, lastEnd))); sent.stop(Math.max(tEnd, lastEnd) + pr.delayS + TAIL);
        return Math.max(tEnd, lastEnd) + pr.delayS + TAIL;
      },
    };
  }

  // which of our n verses the far ward joins (the seat's `from`)
  function versesJoined(from, n) {
    var out = [], i;
    if (from === "all" || n <= 1) for (i = 0; i < n; i++) out.push(i);
    else if (from === "last") out.push(n - 1);
    else for (i = 1; i < n; i++) out.push(i);
    return out;
  }
  // PERFORM — the lab's way: every verse it joins, laid out at once, against
  // our verses' times (material.timing: [{at, beatS}] a verse, from the ward's
  // sheet) or, with none, on a nominal clock of our verses from t
  function perform(ctx, dest, t, material, stream, hooks) {
    material = material || {};
    var pr = material.prepared || prepare(material, stream), st = stage(ctx, dest, pr, stream, hooks);
    var n = material.verses || (material.timing ? material.timing.length : 3), joined = versesJoined(material.from || pr.from, n);
    var bs = material.beatS || pr.hymn.beatS, verseS = pr.lineBeats.reduce(function (a, b) { return a + b; }, 0) * bs * 1.08 + 1.2;
    joined.forEach(function (v) {
      var tm = material.timing && material.timing[v];
      st.verse(v, tm ? tm.at : t + v * verseS, tm && tm.beatS ? tm.beatS : bs, joined.length);
    });
    var end = material.amen === false ? null : st.amen(material.amenAt || t, bs);
    var fin = st.close(end || t);
    perform.last = { prepared: pr, told: st.told, joined: joined, end: fin };
    return fin;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, score: score, stage: stage, perform: perform, warm: warm,
    versesJoined: versesJoined, lineOrder: lineOrder,
    ODDS: ODDS, EXCLUDES: EXCLUDES, FAR_DIALECTS: FAR_DIALECTS, NAME: NAME, LABEL: LABEL,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
    get DESK_GAIN() { return DESK_GAIN; }, set DESK_GAIN(v) { DESK_GAIN = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-farward.js"] = true;   // the load guard's roll call (round 3c)
