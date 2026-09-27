// ============================================================================
// KOLOB — kolob-meeting.js: the chorister
//
// Meetings, sections, the intensity arc, the conductor's tick, stillness,
// and the joints between sections. Split from kolob-audio.js (v0.30); see
// the room list in kolob-core.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-pitch.js
  function rebuildScale() { return S.rebuildScale(); }
  // from kolob-voices-organ.js
  function organChord(t, dur, chord, gainMul) { return S.organChord(t, dur, chord, gainMul); }
  // from kolob-voices-choir.js
  function fugingEntry(t) { return S.fugingEntry(t); }
  // from kolob-voices-ground.js
  function tubaBlat(t, gainMul) { return S.tubaBlat(t, gainMul); }
  function meetinghouseBell(t, gainMul, R) { return S.meetinghouseBell(t, gainMul, R); }
  // from kolob-voices-field.js
  function evTuningFork(t) { return S.evTuningFork(t); }
  // from kolob-guests.js
  function razzCluster() { return S.razzCluster(); }
  function cumulativeAssembly(t) { return S.cumulativeAssembly(t); }
  function unansweredQuestion(V, t) { return S.unansweredQuestion(V, t); }
  function twoBandsCross(V, t) { return S.twoBandsCross(V, t); }
  function steeplesAnswer(V, t) { return S.steeplesAnswer(V, t); }
  function oldTuneCandidates() { return S.oldTuneCandidates(); }
  function oldTuneRemembered(V, t) { return S.oldTuneRemembered(V, t); }
  // from kolob-core.js
  function stream(label) { return S.stream(label); }
  function turn(label) { return S.turn(label); }
  function now() { return S.now(); }
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function setRoomBalance(x, rampS, hold) { return S.setRoomBalance(x, rampS, hold); }
  // (the other rooms' state, read and written through S: S.ctx, S.droneDuck,
  // S.roomBalanceHeld, S.roomRampNext, S.playing, S.F0, S.mode, S.ROOM_BALANCE,
  // S.ROOM_RAMP_S, S.air, S.Harmony, S.METERS, S.Motif)

  // ==========================================================================
  // THE CHORISTER — meeting conductor.
  // ==========================================================================
  // A meeting is a seeded plan of sections. Sections are unmetered inside;
  // their joints are organ cadences and a single bell — not percussion.
  // Every layer reads C (the conductor state) when it fires.
  var SECTION_TYPES = ["prelude", "invocation", "hymn", "testimony", "sacrament", "doxology", "postlude"];
  // The meeting-activity axis: what kind of Sunday is it?
  var MEETINGS = {
    ordinary:   { silenceMul: 1.0, hymns: 2, bells: 0.5, choirSize: 3, bright: 0.5,  meterW: [["CM", 3], ["LM", 2], ["SM", 2], ["87.87", 2], ["CMD", 1]] },
    fast:       { silenceMul: 1.7, hymns: 1, bells: 0.2, choirSize: 2, bright: 0.3,  meterW: [["CM", 3], ["SM", 3], ["LM", 2], ["87.87", 1], ["CMD", 0.5]] },
    conference: { silenceMul: 0.75, hymns: 3, bells: 0.8, choirSize: 4, bright: 0.75, meterW: [["CMD", 3], ["87.87", 3], ["CM", 2], ["LM", 2], ["SM", 1]] },
    jubilee:    { silenceMul: 0.6, hymns: 3, bells: 1.0, choirSize: 4, bright: 0.9,  meterW: [["CMD", 3], ["87.87", 2.5], ["CM", 2], ["LM", 1.5], ["SM", 1]] },
  };
  var C = {
    meetingNum: 0,
    meeting: null,               // { activity }
    plan: [],
    si: 0,
    section: "prelude",
    meter: "CM",                 // current hymn's meter
    sectionStart: 0,
    sectionDur: 120,
    jointing: false,
    fugingFired: false,
    fugingPlanned: false,
    fugingUntil: 0,
    hushUntil: 0,
    verseLine: 0,
    visitations: [],             // Ives guests drawn for this meeting
    visitUntil: 0,
    visitType: null,
    raspberry: false,            // this meeting ends on the organist's own amen
    cumulative: false,           // the tune is withheld until the doxology
    assemblyFired: false,
    assemblyUntil: 0,
  };
  var forceVisitation = false;   // the 𐐌𐐚𐐞 switch: guarantee a guest next meeting
  var forceRaspberry = false;    // dev/test hook only — never part of the 𐐌𐐚𐐞 pool
  // CUMULATIVE FORM's governor — the 𐐐𐐄𐐢 pill: "always" | "natural" | "never"
  var cumulativeMode = "natural";
  // META-SEASONS — the journey across meetings. A slow seeded cosine swings
  // the colony from quiet fast-day troughs to conference/jubilee peaks over
  // 4-7 meetings, the way ZANKYŌ's meta-arc drifts its cycles dark and back.
  var metaPhase = 0, metaPeriod = 5, seasonPos = 0;

  // a weighted pick from a die already thrown (u in [0,1)): the plan throws
  // its dice first and reads them after, so a pool that is empty or forced
  // never changes how many dice were thrown
  function pickWith(u, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = u * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool.length ? pool[pool.length - 1][0] : null;
  }

  // THE PLAN — every die of the meeting is thrown from meeting:<n>, in one
  // fixed order, whether it is used or not (SCORE.md §3: a hymn not sung, a
  // guest refused, a switch that forces another guest in — none of them
  // shifts a die that follows). t is the downbeat or the joint that calls it.
  function planMeeting(t) {
    C.meetingNum++;
    var R = stream("meeting");
    var periodDie = R.rnd(4, 7), phaseDie = R.rnd(0, 0.3);
    if (C.meetingNum === 1) { metaPeriod = periodDie; metaPhase = phaseDie; }
    else { metaPhase += 1 / metaPeriod; if (metaPhase >= 1) { metaPhase -= 1; metaPeriod = periodDie; } }
    seasonPos = 0.5 - 0.5 * Math.cos(2 * Math.PI * metaPhase);   // 0 trough … 1 festival peak

    S.F0 = R.rnd(58, 74);
    var activity = R.pickW([
      ["ordinary", 3],
      ["fast", 1 + 2.5 * (1 - seasonPos)],
      ["conference", 0.6 + 2.6 * seasonPos],
      ["jubilee", 0.2 + 1.8 * seasonPos],
    ]);
    C.meeting = { activity: activity };
    var A = MEETINGS[activity];
    // Mode lottery, tilted bright or modal by the kind of Sunday.
    var b = A.bright;
    S.mode = R.pickW([
      ["ionian", 2 + 2 * b],
      ["penta", 2.5],
      ["hexa", 1.5],
      ["mixolydian", 1 + b],
      ["dorian", 1.4 - b * 0.8],
      ["aeolian", 1.2 - b * 0.8],
    ]);
    rebuildScale();
    S.Harmony.reset();

    // the dice of the order of service: three hymns are always drawn (the most
    // any Sunday sings) and every mutation's die is thrown
    var preludeDur = R.rnd(60, 90), invocationDur = R.rnd(60, 100);
    var hymnDice = [];
    for (var hd = 0; hd < 3; hd++) hymnDice.push({ dur: R.rnd(120, 180), meter: R.pickW(A.meterW) });
    var testimonyDur = R.rnd(110, 160), sacramentDur = R.rnd(100, 150), doxologyDur = R.rnd(70, 110), postludeDur = R.rnd(40, 70);
    var cutTestimony = R.chance(0.25);
    var addInterlude = R.chance(0.15), interludeDur = R.rnd(50, 80);
    var tradeTS = R.chance(0.1);
    var secondDox = R.chance(0.5), secondDoxDur = R.rnd(40, 60);

    var plan = [];
    plan.push({ type: "prelude", dur: preludeDur });
    plan.push({ type: "invocation", dur: invocationDur });
    for (var h = 0; h < A.hymns; h++) {
      plan.push({ type: "hymn", dur: hymnDice[h].dur, meter: hymnDice[h].meter });
    }
    plan.push({ type: "testimony", dur: testimonyDur });
    plan.push({ type: "sacrament", dur: sacramentDur });
    plan.push({ type: "doxology", dur: doxologyDur });
    plan.push({ type: "postlude", dur: postludeDur });
    // THE ORDER IS NOT FIXED — seeded mutations keep the ritual itself
    // aleatoric. Some Sundays have no testimony; some hold an interlude of
    // organ and tines between hymns; testimony and sacrament may trade
    // places; a jubilee may sing the doxology twice.
    if (cutTestimony) {
      for (var ti = plan.length - 1; ti >= 0; ti--) if (plan[ti].type === "testimony") plan.splice(ti, 1);
    }
    if (A.hymns >= 2 && addInterlude) {
      for (var hi = 0; hi < plan.length; hi++) {
        if (plan[hi].type === "hymn") { plan.splice(hi + 1, 0, { type: "interlude", dur: interludeDur }); break; }
      }
    }
    if (tradeTS) {
      var tIdx = -1, sIdx = -1;
      for (var pi = 0; pi < plan.length; pi++) {
        if (plan[pi].type === "testimony") tIdx = pi;
        if (plan[pi].type === "sacrament") sIdx = pi;
      }
      if (tIdx >= 0 && sIdx >= 0) { var tmp = plan[tIdx]; plan[tIdx] = plan[sIdx]; plan[sIdx] = tmp; }
    }
    if (activity === "jubilee" && secondDox) {
      plan.splice(plan.length - 1, 0, { type: "doxology", dur: secondDoxDur });
    }
    C.plan = plan;
    C.si = 0;
    // the guests' dice — each guest keeps its own die, as before, and all are
    // thrown every meeting
    var forcedDie = R.rnd(0, 1);
    var qDie = R.chance(0.29), qSeatDie = R.chance(0.7);
    var bDie = R.chance(0.36), bSeatDie = R.chance(0.7);
    var stDie = R.chance(0.075), stSeatDie = R.chance(0.55);
    var oDie = R.chance(0.15), oSeatDie = R.chance(0.65), oTuneDie = R.rnd(0, 1);
    var cumDie = R.chance(0.08);
    var razzDie = R.chance(0.05);
    // IVES VISITATIONS — guests in the meeting. Each rolls its OWN dice
    // (bands 36%, question 29%, per the owner's taste — roughly half of
    // meetings carry one of the pair; a double bill lands ~1 in 10). The
    // question favors the invocation; the bands favor the doxology. The
    // 𐐌𐐚𐐞 switch forces one guaranteed guest, seated early enough that the
    // guarantee is heard.
    C.visitations = [];
    C.visitUntil = 0;
    C.visitType = null;
    var haveSec = {};
    for (var vp = 0; vp < plan.length; vp++) haveSec[plan[vp].type] = true;
    function seatIn(prefs) {
      for (var sp = 0; sp < prefs.length; sp++) if (haveSec[prefs[sp]]) return prefs[sp];
      return null;
    }
    // THE QUESTION IS SHELVED (owner, 2026-09-27: "one of the less interesting
    // guests… there's better stuff we could be focusing on"). Its code stays
    // in kolob-guests.js; it simply never seats. Its dice are still thrown
    // below, so every other draw of the meeting falls exactly where it did.
    // The forcing switch no longer offers it.
    var SHELVED_GUESTS = { question: true };
    var forcedType = forceVisitation ? pickWith(forcedDie, [["bands", 2], ["steeples", 1], ["oldtune", 1]]) : null;
    if (forcedType === "question" || qDie) {
      var qSeat = (forcedType === "question" || qSeatDie)
        ? seatIn(["invocation", "testimony", "hymn"])
        : seatIn(["testimony", "interlude", "invocation"]);
      if (qSeat && !SHELVED_GUESTS.question) C.visitations.push({ type: "question", section: qSeat, fired: false });
    }
    if (forcedType === "bands" || bDie) {
      var bSeat = forcedType === "bands"
        ? seatIn(["hymn", "doxology", "postlude"])
        : (bSeatDie ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]));
      if (bSeat) C.visitations.push({ type: "bands", section: bSeat, fired: false });
    }
    // the steeples: bells at the meeting's edges — the framing sections where
    // a bell has civic meaning (calling the valley in, ringing it home)
    if (forcedType === "steeples" || stDie) {
      var stSeat = forcedType === "steeples" ? "prelude" : (stSeatDie ? "prelude" : "postlude");
      C.visitations.push({ type: "steeples", section: stSeat, fired: false });
    }
    // THE OLD TUNE — its own die, gated by the mode law (tuneFitsMode): major
    // memories on major-ish Sundays; on dark Sundays the gate OPENS for
    // KINGSFOLD alone. Seats where remembering belongs: the prelude's
    // pre-gathering reverie, or testimony. Never the sacrament.
    var oldPool = oldTuneCandidates();
    if (oldPool.length && (forcedType === "oldtune" || oDie)) {
      var oSeat = forcedType === "oldtune"
        ? seatIn(["prelude", "testimony", "hymn"])
        : (oSeatDie ? seatIn(["prelude", "testimony"]) : seatIn(["testimony", "interlude", "prelude"]));
      if (oSeat) C.visitations.push({ type: "oldtune", section: oSeat, fired: false, tune: pickWith(oTuneDie, oldPool) });
    }
    // CUMULATIVE FORM (after Ives's cumulative settings): the day's theme is
    // WITHHELD — only its fragments circulate, endings first — until the
    // doxology sings it whole for the first time. Rarest of the guests
    // (~1 meeting in 12) because it is a meeting-SHAPE, not an event.
    // Governed by the 𐐐𐐄𐐢 pill: always / natural 8% / never. Set BEFORE
    // Motif.newMeeting() — the theme-length guard there reads the flag.
    C.cumulative = cumulativeMode === "always" || (cumulativeMode === "natural" && cumDie);
    C.assemblyFired = false;
    C.assemblyUntil = 0;
    if (C.cumulative) {
      // a marching band may still call, but never over the assembly
      for (var cvi = 0; cvi < C.visitations.length; cvi++) {
        if (C.visitations[cvi].type === "bands" && C.visitations[cvi].section === "doxology") {
          C.visitations[cvi].section = haveSec.hymn ? "hymn" : "postlude";
        }
      }
    }
    if (C.visitations.length) emitEvent({ cat: "visitation-draw", label: C.visitations.map(function (v) { return v.type + "@" + v.section; }).join(",") });
    // THE RASPBERRY AMEN — its own flag, not a seated visitation: it has no
    // section, only the meeting's final cadence. Never on a fast Sunday; a
    // solemn meeting does not end on a joke.
    C.raspberry = forceRaspberry || (activity !== "fast" && razzDie);
    S.Motif.newMeeting(stream("motif"));
    if (C.cumulative) {
      var wTheme = S.Motif.theme();
      emitEvent({ cat: "visitation", label: "◌ the tune is withheld", detail: (wTheme ? wTheme.name + " · " : "") + "until the doxology" });
    }
    enterSection(0, t);
    // The Liahona: the load-bearing draws, surfaced as the oracle's pointing.
    emitEvent({
      cat: "liahona", label: "⌖ the Liahona points",
      detail: S.mode + " · " + activity + " · F0 " + S.F0.toFixed(1) + " Hz",
    });
    emitEvent({
      cat: "meeting", label: "☀ meeting " + C.meetingNum,
      detail: "F0 " + S.F0.toFixed(1) + " Hz · " + S.mode + " · " + activity + " · season " + seasonPos.toFixed(2),
    });
  }

  // A section begins at t (a joint's end, the downbeat, or a dev jump). Its
  // dice come from its own fork of the plan, thrown whether used or not.
  function enterSection(i, t) {
    var s = C.plan[i];
    var R = stream("meeting").fork("section:" + i);
    var fugingDie = R.chance(0.6), sunriseDie = R.chance(0.4), sunriseMode = R.pick(["ionian", "mixolydian"]);
    C.si = i;
    C.section = s.type;
    C.sectionStart = t;
    C.sectionDur = s.dur;
    C.jointing = false;
    C.fugingFired = false;
    C.fugingUntil = 0;
    // the fuging entry is an EVENT, not a fixture — some hymns are meadows
    C.fugingPlanned = s.type === "hymn" && fugingDie;
    if (s.type === "hymn") C.verseLine = 0;
    if (s.type === "hymn" && s.meter) {
      C.meter = s.meter;
      emitEvent({ cat: "liahona", label: "⌖ the meter is given", detail: C.meter + " — " + S.METERS[C.meter].join(".") });
    }
    // the doxology SUNRISE: a dark-mode meeting may lift into major at the
    // last — rare, and the most audible surprise the engine owns
    if (s.type === "doxology" && (S.mode === "aeolian" || S.mode === "dorian") && sunriseDie) {
      S.mode = sunriseMode;
      rebuildScale();
      S.Harmony.reset();
      emitEvent({
        cat: "meeting", label: "☀ sunrise",
        detail: "F0 " + S.F0.toFixed(1) + " Hz · " + S.mode + " · " + (C.meeting ? C.meeting.activity : "") + " · season " + seasonPos.toFixed(2),
      });
    }
    emitEvent({ cat: "section", label: "§ " + s.type.toUpperCase(), detail: (s.type === "hymn" ? C.meter + " · " : "") + Math.round(s.dur) + "s" });
    // the gathering moves in the room with the section — unless the room lab holds it
    if (!S.roomBalanceHeld) setRoomBalance(S.ROOM_BALANCE[s.type] != null ? S.ROOM_BALANCE[s.type] : 0.45, S.roomRampNext);
    S.roomRampNext = S.ROOM_RAMP_S;
    S.Motif.onSection(s.type);
  }

  // (every clock below is the music's now: the cue's scheduled time)
  function localArc() {
    if (!S.ctx) return 0;
    return Math.max(0, Math.min(1, (now() - C.sectionStart) / C.sectionDur));
  }
  // Global intensity 0..1 — ceilings kept LOW. This is open country; even the
  // doxology's full gathering leaves sky above it.
  function intensity() {
    var x = localArc();
    switch (C.section) {
      case "prelude": return 0.12 + 0.18 * smooth(x);
      case "invocation": return 0.06 + 0.08 * x;
      case "hymn": {
        var base = 0.28 + 0.34 * (x < 0.75 ? smooth(x / 0.75) : 1 - 0.25 * smooth((x - 0.75) / 0.25));
        if (S.ctx && now() < C.fugingUntil) base += 0.12;
        return Math.min(0.75, base);
      }
      case "testimony": return 0.2;
      case "interlude": return 0.14 + 0.08 * smooth(x);
      case "sacrament": return 0.05;
      case "doxology": return Math.min(0.8, 0.32 + 0.48 * smooth(x < 0.8 ? x / 0.8 : 1 - 0.4 * smooth((x - 0.8) / 0.2)));
      case "postlude": return 0.28 * (1 - x);
    }
    return 0.25;
  }
  function smooth(z) { z = Math.max(0, Math.min(1, z)); return z * z * (3 - 2 * z); }
  function inHush() { return S.ctx && now() < C.hushUntil; }
  function inFuging() { return S.ctx && now() < C.fugingUntil; }
  function inVisit() { return S.ctx && now() < C.visitUntil; }
  // the question is a scored passage — its performers' free cycles sit out;
  // the bands are a COLLISION — nobody sits out, that is the piece
  function inQuestion() { return inVisit() && C.visitType === "question"; }
  function silenceMul() { return C.meeting ? MEETINGS[C.meeting.activity].silenceMul : 1; }
  // The airy multiplier applied to every phrase gap: wide at rest, still wide
  // at the peaks. The frontier never crowds.
  function gapMul() { return (2.2 - intensity() * 0.9) * silenceMul(); }

  // --- conductor poll: advances sections, fires fuging entries, keeps time ---
  // A cue every 0.6 s of the music. Its three dice (the stillness after a
  // gathering, the testimony's silence, the unbidden one) are thrown on every
  // tick, used or not.
  function conductorTick(t) {
    if (!S.playing) return;
    var R = stream("conductor");
    var afterDie = R.chance(0.3), testimonyDie = R.chance(0.008), unbiddenDie = R.chance(0.0004);
    var x = localArc();
    // Fuging entry: once per hymn, past the shoulder — the voices go their
    // ways and gather again. A stillness follows the convergence.
    // Ives visitations: fire once, past the section's first quarter, never
    // over a hush, a fuging gathering, a joint, or each other.
    for (var vv = 0; vv < C.visitations.length; vv++) {
      var V = C.visitations[vv];
      if (!V.fired && V.section === C.section && x > 0.2 && x < 0.55 &&
          !C.jointing && !inHush() && !inFuging() && !inVisit()) {
        V.fired = true;
        // type → set piece; the old tune receives its visitation record (the drawn tune)
        var VISIT_FN = { question: unansweredQuestion, bands: twoBandsCross, steeples: steeplesAnswer, oldtune: oldTuneRemembered };
        var vdur = (VISIT_FN[V.type] || twoBandsCross)(V, t);
        C.visitType = V.type;
        C.visitUntil = t + vdur;
        break;
      }
    }
    // The cumulative assembly: the withheld tune arrives in the doxology. A
    // hush or a guest may delay it; past x 0.7 the fallback fires regardless
    // (compressed) — the payoff is never skipped.
    if (C.cumulative && !C.assemblyFired && C.section === "doxology" &&
        ((x > 0.35 && !C.jointing && !inHush() && !inFuging() && !inVisit()) ||
         (x > 0.7 && !C.jointing))) {
      C.assemblyFired = true;
      var adur = cumulativeAssembly(t);
      C.assemblyUntil = t + adur;
    }
    if (C.section === "hymn" && C.fugingPlanned && !C.fugingFired && x > 0.6 && x < 0.8 && !inHush() && !inVisit()) {
      C.fugingFired = true;
      var fugDur = fugingEntry(t);
      C.fugingUntil = t + fugDur;
      if (afterDie) cueAt("conductor", t + fugDur + 1.5, function (ts) { stillness("after the gathering", ts); });
    }
    // Testimony: the Cage silences — rare, long, authoritative.
    if (C.section === "testimony" && !inHush() && testimonyDie) {
      stillness("testimony", t);
    }
    // And once in a great while a silence falls where none was scheduled —
    // about once a meeting, somewhere, unannounced.
    if (C.section !== "sacrament" && C.section !== "testimony" && !C.jointing && !inHush() && unbiddenDie) {
      stillness("unbidden", t);
    }
    // Section end → joint → advance.
    if (!C.jointing && x >= 1) {
      C.jointing = true;
      var last = C.si >= C.plan.length - 1;
      var jointDur = runJoint(last, t);
      cueAt("conductor", t + jointDur + 0.5, function (tn) {
        if (C.si >= C.plan.length - 1) planMeeting(tn);
        else enterSection(C.si + 1, tn);
      });
    }
    cueAt("conductor", t + 0.6, conductorTick);
  }

  // Dev aid: jump the meeting to a section of the plan. Voices notice on
  // their next scheduled fire; a few tail notes from the old section may
  // ring over the seam — acceptable for a rehearsal skip.
  // (a press of a button, not a cue: its now is the audio clock's)
  function skipToSection(type) {
    if (!S.playing) return false;
    var idx = -1;
    for (var i = 0; i < C.plan.length; i++) if (C.plan[i].type === type) { idx = i; break; }
    if (idx < 0) return false;
    var t = now();
    C.hushUntil = 0;
    S.air.busyUntil = 0; S.air.holders = 0;
    if (S.droneDuck && S.ctx) {
      // release any stillness dip that was in flight
      S.droneDuck.gain.cancelScheduledValues(t);
      S.droneDuck.gain.setValueAtTime(1, t);
    }
    enterSection(idx, t);
    emitEvent({ cat: "conductor", label: "↷ skipped", detail: "to " + type + " (dev)" });
    return true;
  }

  // The stillness — the ground falls away. Only the DRONE recedes; the other
  // voices keep speaking and stand exposed in the open air. Sometimes a
  // tuning fork rings in it; the ground breathes back after.
  function stillness(why, t) {
    if (!S.playing || !S.droneDuck) return;
    var R = turn("stillness");
    var holdS = R.rnd(6, 14) * silenceMul();
    var forkDie = R.chance(0.5), forkAt = R.rnd(2, holdS * 0.5);
    C.hushUntil = t + holdS + 2.5;
    S.droneDuck.gain.cancelScheduledValues(t);
    S.droneDuck.gain.setValueAtTime(S.droneDuck.gain.value || 1, t);
    S.droneDuck.gain.linearRampToValueAtTime(0.12, t + 1.4);
    if (forkDie) evTuningFork(t + forkAt);
    S.droneDuck.gain.setValueAtTime(0.12, t + 1.4 + holdS);
    S.droneDuck.gain.linearRampToValueAtTime(1, t + 1.4 + holdS + 3);
    emitEvent({ cat: "conductor", label: "◦ the still small voice", detail: why + " · " + holdS.toFixed(1) + "s" });
  }

  // ==========================================================================
  // SECTION JOINTS — an organ cadence and a single bell. No cymbals in Zion.
  // ==========================================================================

  // A joint's dice are its own fork of joints:<n>, one per section ended.
  function runJoint(isLast, tc) {
    var R = stream("joints").fork("joint:" + C.si);
    var t = tc + 0.2;
    var dur = 4;
    var next = !isLast && C.plan[C.si + 1] ? C.plan[C.si + 1].type : null;
    if (next === "sacrament" || C.section === "sacrament") {
      // fade into (or out of) the quietest room through pure drone — no chord
      dur = R.rnd(4, 7);
      emitEvent({ cat: "cadence", label: "∴ the room empties", detail: "into stillness" });
    } else if (isLast && C.raspberry) {
      // THE RASPBERRY AMEN (after the close of Ives's Second Symphony): the
      // cadence sets up in earnest — the IV played perfectly straight — and
      // the organist's hands land a quiet fistful of seconds where the tonic
      // should be. The tuba player commits to it. Held long enough to be
      // unmistakably on purpose; the bell rings anyway, unbothered; the
      // clerk's pen stops mid-word.
      var rChords = S.Harmony.cadence("plagal", R);
      var rDur = R.rnd(2.6, 3.6);
      organChord(t, rDur * 1.02, rChords[0], 0.6);             // the setup, in earnest
      organChord(t + rDur, 3.2, razzCluster(), 0.5);           // the resolution that isn't
      tubaBlat(t + rDur);
      dur = rDur + 3.2 + 1.5;
      // the sexton usually didn't notice — the ritual visibly continues
      if (R.chance(Math.max(MEETINGS[C.meeting.activity].bells, 0.6))) {
        meetinghouseBell(t + dur * 0.75, 1.0, R);
      }
      cueAt("conductor", t + rDur + 0.15, function () {
        emitEvent({ cat: "visitation", label: "∴ raspberry", detail: "the tuba's own" });
      });
      cueAt("conductor", t + rDur + 0.9, function () {
        emitEvent({ cat: "visitation", label: "∴ amen—", detail: "the organist's own" });
      });
    } else {
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? R.pickW([["plagal", 3], ["authentic", 2], ["half", 1]]) : "plagal");
      var chords = S.Harmony.cadence(kind, R);
      var chDur = R.rnd(2.6, 3.6);
      for (var i = 0; i < chords.length; i++) {
        organChord(t + i * chDur, chDur * (i === chords.length - 1 ? 1.7 : 1.02), chords[i], 0.6);
      }
      dur = chDur * chords.length + 1.5;
      if (R.chance(MEETINGS[C.meeting.activity].bells)) {
        meetinghouseBell(t + dur * 0.7, isLast ? 1.0 : R.rnd(0.5, 0.8), R);
        if (C.meeting.activity === "jubilee" && R.chance(0.6)) {
          // a small peal for a festival Sunday
          for (var p = 1; p <= R.rint(2, 4); p++) meetinghouseBell(t + dur * 0.7 + p * R.rnd(1.4, 2.2), R.rnd(0.4, 0.7), R);
          dur += 5;
        }
      }
    }
    emitEvent({ cat: "cadence", label: "∴ joint", detail: (isLast ? "meeting ends" : "toward " + next) + " · " + Math.round(dur) + "s" });
    return dur;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  // A new seed is a new visit: the meeting count and the seasons start again.
  function resetVisit() { C.meetingNum = 0; metaPhase = 0; metaPeriod = 5; seasonPos = 0; }

  S.MEETINGS = MEETINGS;
  S.C = C;
  Object.defineProperty(S, "forceVisitation", { enumerable: true, configurable: true, get: function () { return forceVisitation; }, set: function (v) { forceVisitation = v; } });
  Object.defineProperty(S, "forceRaspberry", { enumerable: true, configurable: true, get: function () { return forceRaspberry; }, set: function (v) { forceRaspberry = v; } });
  Object.defineProperty(S, "cumulativeMode", { enumerable: true, configurable: true, get: function () { return cumulativeMode; }, set: function (v) { cumulativeMode = v; } });
  Object.defineProperty(S, "seasonPos", { enumerable: true, configurable: true, get: function () { return seasonPos; }, set: function (v) { seasonPos = v; } });
  S.planMeeting = planMeeting;
  S.resetVisit = resetVisit;
  S.localArc = localArc;
  S.intensity = intensity;
  S.inHush = inHush;
  S.inFuging = inFuging;
  S.inVisit = inVisit;
  S.inQuestion = inQuestion;
  S.silenceMul = silenceMul;
  S.gapMul = gapMul;
  S.conductorTick = conductorTick;
  S.skipToSection = skipToSection;
  // the room's public face on the KOLOB namespace
  KOLOB.Meeting = { MEETINGS: MEETINGS, C: C, planMeeting: planMeeting, conductorTick: conductorTick, runJoint: runJoint };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-meeting.js"] = true;   // the load guard's roll call
})();
