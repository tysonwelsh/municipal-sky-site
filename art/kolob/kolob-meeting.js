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
  function fugingEntry() { return S.fugingEntry(); }
  // from kolob-voices-ground.js
  function tubaBlat(t, gainMul) { return S.tubaBlat(t, gainMul); }
  function meetinghouseBell(t, gainMul) { return S.meetinghouseBell(t, gainMul); }
  // from kolob-voices-field.js
  function evTuningFork(t) { return S.evTuningFork(t); }
  // from kolob-guests.js
  function razzCluster() { return S.razzCluster(); }
  function cumulativeAssembly() { return S.cumulativeAssembly(); }
  function unansweredQuestion() { return S.unansweredQuestion(); }
  function twoBandsCross() { return S.twoBandsCross(); }
  function steeplesAnswer() { return S.steeplesAnswer(); }
  function oldTuneCandidates() { return S.oldTuneCandidates(); }
  function oldTuneRemembered(V) { return S.oldTuneRemembered(V); }
  // from kolob-core.js
  function rnd(a, b) { return S.rnd(a, b); }
  function rint(a, b) { return S.rint(a, b); }
  function chance(p) { return S.chance(p); }
  function pick(arr) { return S.pick(arr); }
  function pickW(pool) { return S.pickW(pool); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function setRoomBalance(x, rampS, hold) { return S.setRoomBalance(x, rampS, hold); }
  function scheduleRaw(fn, ms) { return S.scheduleRaw(fn, ms); }
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

  function planMeeting() {
    C.meetingNum++;
    if (C.meetingNum === 1) { metaPeriod = rnd(4, 7); metaPhase = rnd(0, 0.3); }
    else { metaPhase += 1 / metaPeriod; if (metaPhase >= 1) { metaPhase -= 1; metaPeriod = rnd(4, 7); } }
    seasonPos = 0.5 - 0.5 * Math.cos(2 * Math.PI * metaPhase);   // 0 trough … 1 festival peak

    S.F0 = rnd(58, 74);
    var activity = pickW([
      ["ordinary", 3],
      ["fast", 1 + 2.5 * (1 - seasonPos)],
      ["conference", 0.6 + 2.6 * seasonPos],
      ["jubilee", 0.2 + 1.8 * seasonPos],
    ]);
    C.meeting = { activity: activity };
    var A = MEETINGS[activity];
    // Mode lottery, tilted bright or modal by the kind of Sunday.
    var b = A.bright;
    S.mode = pickW([
      ["ionian", 2 + 2 * b],
      ["penta", 2.5],
      ["hexa", 1.5],
      ["mixolydian", 1 + b],
      ["dorian", 1.4 - b * 0.8],
      ["aeolian", 1.2 - b * 0.8],
    ]);
    rebuildScale();
    S.Harmony.reset();

    var plan = [];
    plan.push({ type: "prelude", dur: rnd(60, 90) });
    plan.push({ type: "invocation", dur: rnd(60, 100) });
    for (var h = 0; h < A.hymns; h++) {
      plan.push({ type: "hymn", dur: rnd(120, 180), meter: pickW(A.meterW) });
    }
    plan.push({ type: "testimony", dur: rnd(110, 160) });
    plan.push({ type: "sacrament", dur: rnd(100, 150) });
    plan.push({ type: "doxology", dur: rnd(70, 110) });
    plan.push({ type: "postlude", dur: rnd(40, 70) });
    // THE ORDER IS NOT FIXED — seeded mutations keep the ritual itself
    // aleatoric. Some Sundays have no testimony; some hold an interlude of
    // organ and tines between hymns; testimony and sacrament may trade
    // places; a jubilee may sing the doxology twice.
    if (chance(0.25)) {
      for (var ti = plan.length - 1; ti >= 0; ti--) if (plan[ti].type === "testimony") plan.splice(ti, 1);
    }
    if (A.hymns >= 2 && chance(0.15)) {
      for (var hi = 0; hi < plan.length; hi++) {
        if (plan[hi].type === "hymn") { plan.splice(hi + 1, 0, { type: "interlude", dur: rnd(50, 80) }); break; }
      }
    }
    if (chance(0.1)) {
      var tIdx = -1, sIdx = -1;
      for (var pi = 0; pi < plan.length; pi++) {
        if (plan[pi].type === "testimony") tIdx = pi;
        if (plan[pi].type === "sacrament") sIdx = pi;
      }
      if (tIdx >= 0 && sIdx >= 0) { var tmp = plan[tIdx]; plan[tIdx] = plan[sIdx]; plan[sIdx] = tmp; }
    }
    if (activity === "jubilee" && chance(0.5)) {
      plan.splice(plan.length - 1, 0, { type: "doxology", dur: rnd(40, 60) });
    }
    C.plan = plan;
    C.si = 0;
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
    var forcedType = forceVisitation ? pickW([["question", 2], ["bands", 2], ["steeples", 1], ["oldtune", 1]]) : null;
    if (forcedType === "question" || chance(0.29)) {
      var qSeat = (forcedType === "question" || chance(0.7))
        ? seatIn(["invocation", "testimony", "hymn"])
        : seatIn(["testimony", "interlude", "invocation"]);
      if (qSeat) C.visitations.push({ type: "question", section: qSeat, fired: false });
    }
    if (forcedType === "bands" || chance(0.36)) {
      var bSeat = forcedType === "bands"
        ? seatIn(["hymn", "doxology", "postlude"])
        : (chance(0.7) ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]));
      if (bSeat) C.visitations.push({ type: "bands", section: bSeat, fired: false });
    }
    // the steeples: bells at the meeting's edges — the framing sections where
    // a bell has civic meaning (calling the valley in, ringing it home)
    if (forcedType === "steeples" || chance(0.075)) {
      var stSeat = forcedType === "steeples" ? "prelude" : (chance(0.55) ? "prelude" : "postlude");
      C.visitations.push({ type: "steeples", section: stSeat, fired: false });
    }
    // THE OLD TUNE — its own die, gated by the mode law (tuneFitsMode): major
    // memories on major-ish Sundays; on dark Sundays the gate OPENS for
    // KINGSFOLD alone. Seats where remembering belongs: the prelude's
    // pre-gathering reverie, or testimony. Never the sacrament.
    var oldPool = oldTuneCandidates();
    if (oldPool.length && (forcedType === "oldtune" || chance(0.15))) {
      var oSeat = forcedType === "oldtune"
        ? seatIn(["prelude", "testimony", "hymn"])
        : (chance(0.65) ? seatIn(["prelude", "testimony"]) : seatIn(["testimony", "interlude", "prelude"]));
      if (oSeat) C.visitations.push({ type: "oldtune", section: oSeat, fired: false, tune: pickW(oldPool) });
    }
    // CUMULATIVE FORM (after Ives's cumulative settings): the day's theme is
    // WITHHELD — only its fragments circulate, endings first — until the
    // doxology sings it whole for the first time. Rarest of the guests
    // (~1 meeting in 12) because it is a meeting-SHAPE, not an event.
    // Governed by the 𐐐𐐄𐐢 pill: always / natural 8% / never. Set BEFORE
    // Motif.newMeeting() — the theme-length guard there reads the flag.
    C.cumulative = cumulativeMode === "always" || (cumulativeMode === "natural" && chance(0.08));
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
    C.raspberry = forceRaspberry || (activity !== "fast" && chance(0.05));
    S.Motif.newMeeting();
    if (C.cumulative) {
      var wTheme = S.Motif.theme();
      emitEvent({ cat: "visitation", label: "◌ the tune is withheld", detail: (wTheme ? wTheme.name + " · " : "") + "until the doxology" });
    }
    enterSection(0);
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

  function enterSection(i) {
    var s = C.plan[i];
    C.si = i;
    C.section = s.type;
    C.sectionStart = S.ctx ? S.ctx.currentTime : 0;
    C.sectionDur = s.dur;
    C.jointing = false;
    C.fugingFired = false;
    C.fugingUntil = 0;
    // the fuging entry is an EVENT, not a fixture — some hymns are meadows
    C.fugingPlanned = s.type === "hymn" && chance(0.6);
    if (s.type === "hymn") C.verseLine = 0;
    if (s.type === "hymn" && s.meter) {
      C.meter = s.meter;
      emitEvent({ cat: "liahona", label: "⌖ the meter is given", detail: C.meter + " — " + S.METERS[C.meter].join(".") });
    }
    // the doxology SUNRISE: a dark-mode meeting may lift into major at the
    // last — rare, and the most audible surprise the engine owns
    if (s.type === "doxology" && (S.mode === "aeolian" || S.mode === "dorian") && chance(0.4)) {
      S.mode = pick(["ionian", "mixolydian"]);
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

  function localArc() {
    if (!S.ctx) return 0;
    return Math.max(0, Math.min(1, (S.ctx.currentTime - C.sectionStart) / C.sectionDur));
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
        if (S.ctx && S.ctx.currentTime < C.fugingUntil) base += 0.12;
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
  function inHush() { return S.ctx && S.ctx.currentTime < C.hushUntil; }
  function inFuging() { return S.ctx && S.ctx.currentTime < C.fugingUntil; }
  function inVisit() { return S.ctx && S.ctx.currentTime < C.visitUntil; }
  // the question is a scored passage — its performers' free cycles sit out;
  // the bands are a COLLISION — nobody sits out, that is the piece
  function inQuestion() { return inVisit() && C.visitType === "question"; }
  function silenceMul() { return C.meeting ? MEETINGS[C.meeting.activity].silenceMul : 1; }
  // The airy multiplier applied to every phrase gap: wide at rest, still wide
  // at the peaks. The frontier never crowds.
  function gapMul() { return (2.2 - intensity() * 0.9) * silenceMul(); }

  // --- conductor poll: advances sections, fires fuging entries, keeps time ---
  function conductorTick() {
    if (!S.playing) return;
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
        var vdur = (VISIT_FN[V.type] || twoBandsCross)(V);
        C.visitType = V.type;
        C.visitUntil = S.ctx.currentTime + vdur;
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
      var adur = cumulativeAssembly();
      C.assemblyUntil = S.ctx.currentTime + adur;
    }
    if (C.section === "hymn" && C.fugingPlanned && !C.fugingFired && x > 0.6 && x < 0.8 && !inHush() && !inVisit()) {
      C.fugingFired = true;
      var fugDur = fugingEntry();
      C.fugingUntil = S.ctx.currentTime + fugDur;
      if (chance(0.3)) scheduleRaw(function () { stillness("after the gathering"); }, (fugDur + 1.5) * 1000);
    }
    // Testimony: the Cage silences — rare, long, authoritative.
    if (C.section === "testimony" && !inHush() && chance(0.008)) {
      stillness("testimony");
    }
    // And once in a great while a silence falls where none was scheduled —
    // about once a meeting, somewhere, unannounced.
    if (C.section !== "sacrament" && C.section !== "testimony" && !C.jointing && !inHush() && chance(0.0004)) {
      stillness("unbidden");
    }
    // Section end → joint → advance.
    if (!C.jointing && x >= 1) {
      C.jointing = true;
      var last = C.si >= C.plan.length - 1;
      var jointDur = runJoint(last);
      scheduleRaw(function () {
        if (C.si >= C.plan.length - 1) planMeeting();
        else enterSection(C.si + 1);
      }, (jointDur + 0.5) * 1000);
    }
    scheduleRaw(conductorTick, 600);
  }

  // Dev aid: jump the meeting to a section of the plan. Voices notice on
  // their next scheduled fire; a few tail notes from the old section may
  // ring over the seam — acceptable for a rehearsal skip.
  function skipToSection(type) {
    if (!S.playing) return false;
    var idx = -1;
    for (var i = 0; i < C.plan.length; i++) if (C.plan[i].type === type) { idx = i; break; }
    if (idx < 0) return false;
    C.hushUntil = 0;
    S.air.busyUntil = 0; S.air.holders = 0;
    if (S.droneDuck && S.ctx) {
      // release any stillness dip that was in flight
      S.droneDuck.gain.cancelScheduledValues(S.ctx.currentTime);
      S.droneDuck.gain.setValueAtTime(1, S.ctx.currentTime);
    }
    enterSection(idx);
    emitEvent({ cat: "conductor", label: "↷ skipped", detail: "to " + type + " (dev)" });
    return true;
  }

  // The stillness — the ground falls away. Only the DRONE recedes; the other
  // voices keep speaking and stand exposed in the open air. Sometimes a
  // tuning fork rings in it; the ground breathes back after.
  function stillness(why) {
    if (!S.playing || !S.droneDuck) return;
    var t = S.ctx.currentTime;
    var holdS = rnd(6, 14) * silenceMul();
    C.hushUntil = t + holdS + 2.5;
    S.droneDuck.gain.cancelScheduledValues(t);
    S.droneDuck.gain.setValueAtTime(S.droneDuck.gain.value || 1, t);
    S.droneDuck.gain.linearRampToValueAtTime(0.12, t + 1.4);
    if (chance(0.5)) evTuningFork(t + rnd(2, holdS * 0.5));
    S.droneDuck.gain.setValueAtTime(0.12, t + 1.4 + holdS);
    S.droneDuck.gain.linearRampToValueAtTime(1, t + 1.4 + holdS + 3);
    emitEvent({ cat: "conductor", label: "◦ the still small voice", detail: why + " · " + holdS.toFixed(1) + "s" });
  }

  // ==========================================================================
  // SECTION JOINTS — an organ cadence and a single bell. No cymbals in Zion.
  // ==========================================================================

  function runJoint(isLast) {
    var t = S.ctx.currentTime + 0.2;
    var dur = 4;
    var next = !isLast && C.plan[C.si + 1] ? C.plan[C.si + 1].type : null;
    if (next === "sacrament" || C.section === "sacrament") {
      // fade into (or out of) the quietest room through pure drone — no chord
      dur = rnd(4, 7);
      emitEvent({ cat: "cadence", label: "∴ the room empties", detail: "into stillness" });
    } else if (isLast && C.raspberry) {
      // THE RASPBERRY AMEN (after the close of Ives's Second Symphony): the
      // cadence sets up in earnest — the IV played perfectly straight — and
      // the organist's hands land a quiet fistful of seconds where the tonic
      // should be. The tuba player commits to it. Held long enough to be
      // unmistakably on purpose; the bell rings anyway, unbothered; the
      // clerk's pen stops mid-word.
      var rChords = S.Harmony.cadence("plagal");
      var rDur = rnd(2.6, 3.6);
      organChord(t, rDur * 1.02, rChords[0], 0.6);             // the setup, in earnest
      organChord(t + rDur, 3.2, razzCluster(), 0.5);           // the resolution that isn't
      tubaBlat(t + rDur);
      dur = rDur + 3.2 + 1.5;
      // the sexton usually didn't notice — the ritual visibly continues
      if (chance(Math.max(MEETINGS[C.meeting.activity].bells, 0.6))) {
        meetinghouseBell(t + dur * 0.75, 1.0);
      }
      var razzWait = (t + rDur) - S.ctx.currentTime;
      scheduleRaw(function () {
        emitEvent({ cat: "visitation", label: "∴ raspberry", detail: "the tuba's own" });
      }, (razzWait + 0.15) * 1000);
      scheduleRaw(function () {
        emitEvent({ cat: "visitation", label: "∴ amen—", detail: "the organist's own" });
      }, (razzWait + 0.9) * 1000);
    } else {
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? pickW([["plagal", 3], ["authentic", 2], ["half", 1]]) : "plagal");
      var chords = S.Harmony.cadence(kind);
      var chDur = rnd(2.6, 3.6);
      for (var i = 0; i < chords.length; i++) {
        organChord(t + i * chDur, chDur * (i === chords.length - 1 ? 1.7 : 1.02), chords[i], 0.6);
      }
      dur = chDur * chords.length + 1.5;
      if (chance(MEETINGS[C.meeting.activity].bells)) {
        meetinghouseBell(t + dur * 0.7, isLast ? 1.0 : rnd(0.5, 0.8));
        if (C.meeting.activity === "jubilee" && chance(0.6)) {
          // a small peal for a festival Sunday
          for (var p = 1; p <= rint(2, 4); p++) meetinghouseBell(t + dur * 0.7 + p * rnd(1.4, 2.2), rnd(0.4, 0.7));
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
  S.MEETINGS = MEETINGS;
  S.C = C;
  Object.defineProperty(S, "forceVisitation", { enumerable: true, get: function () { return forceVisitation; }, set: function (v) { forceVisitation = v; } });
  Object.defineProperty(S, "forceRaspberry", { enumerable: true, get: function () { return forceRaspberry; }, set: function (v) { forceRaspberry = v; } });
  Object.defineProperty(S, "cumulativeMode", { enumerable: true, get: function () { return cumulativeMode; }, set: function (v) { cumulativeMode = v; } });
  Object.defineProperty(S, "seasonPos", { enumerable: true, get: function () { return seasonPos; }, set: function (v) { seasonPos = v; } });
  S.planMeeting = planMeeting;
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
})();
