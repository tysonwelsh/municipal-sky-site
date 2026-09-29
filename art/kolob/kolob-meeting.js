// ============================================================================
// KOLOB — kolob-meeting.js: the chorister
//
// Meetings, sections, the intensity arc, the conductor's tick, stillness,
// and the joints between sections. Split from kolob-audio.js (v0.30); see
// the room list in kolob-core.js.
//
// Round 2, milestone 2: C — the meeting's own state — stays in this room.
// The house reads it through THE CHORISTER'S BOOK (S.Meeting, below), a
// frozen set of accessors, and the composers receive a MOMENT made from it.
// The harmony the house sings is voiced, written into the chord book at its
// time and announced at THE CHORD DESK (S.Harmony, below); and a section
// does not turn over while a guest, or a line the choir has written, is
// still sounding.
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
  function singHymn(h, row, t, pre) { return S.singHymn(h, row, t, pre); }
  // from kolob-voices-ground.js
  function tubaBlat(t, gainMul) { return S.tubaBlat(t, gainMul); }
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
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
  function trombonesAtDawn(V, t) { return S.trombonesAtDawn(V, t); }
  function handbellsRing(V, t) { return S.handbellsRing(V, t); }
  function singingSchool(V, t) { return S.singingSchool(V, t); }
  // from kolob-core.js
  function stream(label) { return S.stream(label); }
  function turn(label) { return S.turn(label); }
  function now() { return S.now(); }
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function setRoomBalance(x, rampS, hold) { return S.setRoomBalance(x, rampS, hold); }
  // (the other rooms' state, read and written through S: S.ctx, S.droneDuck,
  // S.roomBalanceHeld, S.roomRampNext, S.playing, S.F0, S.mode, S.ROOM_BALANCE,
  // S.ROOM_RAMP_S, S.air)
  // the composers, reached on the KOLOB namespace (they read nothing of the
  // house; see THE CHORISTER'S BOOK and THE CHORD DESK below)
  var Harmony = KOLOB.Harmony, Motif = KOLOB.Melody.Motif, Prosody = KOLOB.Melody.Prosody, METERS = KOLOB.Melody.METERS;
  // the trombone choir at dawn plans itself (kolob-guest-trombones.js: pure,
  // handed a stream); read late, as a guest the house can do without
  function Trombones() { return KOLOB.GuestTrombones || null; }
  // the day's hymnal (kolob-hymnal.js): the house dialect, each hymn's
  // dialect and key, and the composer's desk, reached off the audio path
  function Hymnal() { return KOLOB.Hymnal || null; }

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
    visitLogged: true,           // the last guest may be named on the page
    raspberry: false,            // this meeting ends on the organist's own amen
    cumulative: false,           // the tune is withheld until the doxology
    assemblyFired: false,
    assemblyUntil: 0,
    seating: null,               // the prelude's seating (THE PRELUDE'S SEATING)
    house: null,                 // the house dialect (THE DAY'S HYMNAL)
    hymnal: [],                  // the day's hymns: a row per singing section, in order
    hymn: null,                  // the composed hymn being sung: { id, row, active, until, from }
  };
  var forceVisitation = false;   // the 𐐌𐐚𐐞 switch: guarantee a guest next meeting
  var forceRaspberry = false;    // dev/test hook only — never part of the 𐐌𐐚𐐞 pool
  // CUMULATIVE FORM's governor — the 𐐐𐐄𐐢 pill: "always" | "natural" | "never"
  var cumulativeMode = "natural";
  // THE CALENDAR (PLAN-COMPOSITION §7.1; the pre-v0.34 polish). Each meeting
  // draws a Sunday of the colony year at the calendar's own odds — there is
  // no journey across meetings, and the first visit is no longer the trough
  // of one. (v0.32's meta-season cosine began every visit at its fast-day
  // bottom, rnd(0, 0.3) of the swing, so meeting 1 was a fast Sunday 36 % of
  // the time, not the plan's 15 %, and the lean Sunday, the plain temper and
  // the thinnest prelude came with it.) The four kinds the house knows stand
  // in for the calendar's nine: ordinary for the ordinary Sunday and the
  // wedding, fast for the fast, conference for General Conference and the
  // dedication, jubilee for Pioneer Day, Christmas and Easter — the plan's
  // shares folded onto the kinds, then leaned half-way to the middle of each
  // band the owner ruled (ordinary 45–55, fast ~15, conference 15–20,
  // jubilee 10–15). The season is now the Sunday's own warmth, placed inside
  // its kind by the die that once set the cosine's phase: a fast Sunday runs
  // low, a jubilee high, and they overlap at the edges, as the kinds do.
  // ROUND 3b, STEP 4: the calendar's nine Sundays (kolob-calendar.js) are
  // drawn now, on the same die, at the plan's own shares — ordinary 45 %,
  // fast 15, General Conference 12, Pioneer Day 8, Christmas 6, Easter 6, a
  // wedding 4, a funeral 3, a dedication 1 — and each belongs to one of the
  // four kinds (a wedding and a funeral are ordinary meetings, a dedication a
  // conference, the three feasts jubilees), so the kinds fall out of it at
  // ordinary 52, fast 15, conference 13 and jubilee 20 %. CALENDAR below is
  // the fallback (a page without the calendar) and the kinds' shares as the
  // Sundays give them; SEASON_OF the kinds' warmth, where the Sunday has none.
  var CALENDAR = [["ordinary", 0.52], ["fast", 0.15], ["conference", 0.13], ["jubilee", 0.2]];
  var SEASON_OF = { fast: [0, 0.35], ordinary: [0.2, 0.7], conference: [0.5, 0.9], jubilee: [0.7, 1] };
  function Calendar() { return KOLOB.Calendar || null; }
  var seasonPos = 0;
  var F0_RANGE = [52, 78];       // the keynote's window, Hz of F0 (see THE KEYNOTE in planMeeting)

  // THE RECKONING'S ORDER (round 3b, step 4; PLAN §7.2): what the desk needs
  // to write the doxology for the drone — the first doxology's row, and
  // every section before it with the key and the mode it is sung in (a
  // hymn's own; the other rites the day's keynote and the day's mode).
  // null when the plan has no doxology, or on a page without the calendar.
  // The switch does not reach the desk: with it off the doxology is written
  // and kept exactly as with it on, and only the drone stays home (§7.2's
  // own fallback, "the cantus only for the key plan, with no audible
  // glide") — so the owner's A/B changes the drone and nothing else. (The
  // round-3b critic heard 10 of 14 Sundays sing another closing hymn when
  // the switch also kept the desk from the reckoning.)
  function reckoningOn() { return !(KOLOB.Experimental && KOLOB.Experimental.isOn && !KOLOB.Experimental.isOn("reckoning")); }
  function reckoningInfo(plan, rows, CAL) {
    if (!CAL || !CAL.reckon) return null;
    var dox = null, byIndex = {};
    for (var i = 0; i < rows.length; i++) { if (rows[i].index != null) byIndex[rows[i].index] = rows[i]; if (!dox && rows[i].section === "doxology") dox = rows[i]; }
    if (!dox || dox.index == null || dox.index < 1) return null;
    var secs = [];
    for (var j = 0; j < dox.index; j++) {
      var r = byIndex[j], sc = C.scenes && C.scenes[j];
      // (the sacrament seated plain, with no guest in it: STILL — the drone
      // is all there is, and the cantus may stand on any note of the tune)
      var still = plan[j].type === "sacrament" && (!sc || sc.name === "plain") && !C.visitations.some(function (v) { return v.section === "sacrament"; });
      secs.push({ index: j, type: plan[j].type, keyMonzo: r ? r.keyMonzo.slice() : [0, 0, 0, 0], mode: r ? r.mode : S.mode, still: still });
    }
    return { doxId: dox.id, sections: secs, candidates: CAL.RECKON_CANDIDATES };
  }

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
    // (the reckoning: a new meeting's drone stands on its keynote — a meeting
    // ends home, so this is a turn only after a dev jump)
    if (S.droneNote && S.droneTurn && S.droneNote().mul !== 1) S.droneTurn(t, [0, 0, 0, 0], 3, "tonic", null);
    var R = stream("meeting");
    // (the first die is the old cosine's period, thrown still so that every
    // die after it lands where it did; the second places the season)
    R.rnd(4, 7);
    var seasonDie = R.rnd(0, 0.3) / 0.3;

    // THE KEYNOTE — the day's fundamental, a seven-semitone window (A♭3 to
    // E♭4 at the keynote, F0·4; F0 52–78 Hz). v0.32 drew 58–74 Hz, 4.2
    // semitones: in 43 % of pairs of visits the keynote did not tell them
    // apart. Every voice was sung at both new ends before it widened (the
    // pre-v0.34 polish's compass check, the harness's f0= pin, six seeds ×
    // 20 minutes at each end): the choir's basses keep their 5th percentile
    // at D♯2 and its sopranos their 95th at G5, the trombones stay in their
    // compass (the guest places its octave), and every voice moves by the
    // semitone or two the window grew and no further. (The band's cornet
    // already stood above its compass at v0.32's top — p95 G6 at 74 Hz — and
    // is a semitone higher at 78: a known edge, not a new one.)
    S.F0 = R.rnd(F0_RANGE[0], F0_RANGE[1]);
    // THE SUNDAY (round 3b, step 4; PLAN §7.1): the day of the colony year,
    // from the die that once drew the kind — and the kind from the Sunday
    var CAL = Calendar(), dayU = R.next();
    var sunday = CAL ? CAL.draw(dayU) : null;
    var activity = CAL ? CAL.kindOf(sunday) : pickWith(dayU, CALENDAR);
    var SUN = CAL ? CAL.SUNDAYS[sunday] : null;
    var sr = SUN && SUN.season ? SUN.season : SEASON_OF[activity];
    seasonPos = sr[0] + (sr[1] - sr[0]) * seasonDie;               // 0 the fast-day trough … 1 the festival
    // the kind's row with the Sunday laid over it (how many hymns, how still,
    // how bright, how many bells): what S.Meeting.sunday() hands the voices
    var A = CAL ? CAL.meetingRow(sunday, MEETINGS[activity]) : MEETINGS[activity];
    var SP = SUN ? SUN.plan : {};
    C.meeting = { activity: activity, sunday: sunday, row: A };
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
    Desk.reset();                   // a new tuning: a clean page in the chord book

    // the dice of the order of service: three hymns are always drawn (the most
    // any Sunday sings) and every mutation's die is thrown
    // (the Sunday leans the odds of the plan's mutations and the length of a
    // rite — the same dice, read at the Sunday's odds: SP, its plan)
    var lens = SP.lens || {};
    var preludeDur = R.rnd(60, 90), invocationDur = R.rnd(60, 100) * (lens.invocation || 1);
    var hymnDice = [];
    for (var hd = 0; hd < 3; hd++) hymnDice.push({ dur: R.rnd(120, 180), meter: R.pickW(A.meterW) });
    var testimonyDur = R.rnd(110, 160) * (lens.testimony || 1), sacramentDur = R.rnd(100, 150) * (lens.sacrament || 1), doxologyDur = R.rnd(70, 110), postludeDur = R.rnd(40, 70);
    var cutTestimony = R.chance(SP.cutTestimony != null ? SP.cutTestimony : 0.25);
    var addInterlude = R.chance(SP.interlude != null ? SP.interlude : 0.15), interludeDur = R.rnd(50, 80);
    var tradeTS = R.chance(SP.tradeTS != null ? SP.tradeTS : 0.1);
    var secondDoxU = R.next(), secondDoxDur = R.rnd(40, 60);
    var secondDox = SP.secondDox != null ? secondDoxU < SP.secondDox : (activity === "jubilee" && secondDoxU < 0.5);

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
    if (secondDox) {
      plan.splice(plan.length - 1, 0, { type: "doxology", dur: secondDoxDur });
    }
    C.plan = plan;
    C.si = 0;
    // THE ARC OF LIGHT (round 3b, step 4; PLAN §7.3): each rite's light, from
    // dawn to full daylight and evening, the Sunday's own (a funeral's dawn
    // darker, its morning climbing late) — read by the hymnal (each hymn's
    // dialect), the organ (its stops) and the meeting's intensity
    for (var li0 = 0; li0 < plan.length; li0++) plan[li0].light = CAL ? CAL.light(plan, li0, sunday) : null;
    // the guests' dice — each guest keeps its own die, as before, and all are
    // thrown every meeting
    // (the Sunday's welcome: a factor on the odds of the guests whose dice
    // the plan throws itself — the bands on Pioneer Day, the steeples at
    // Christmas; the trombones, the handbells and the singing school read the
    // Sunday in their own rooms)
    var GW = SUN && SUN.guests ? SUN.guests : {};
    var forcedDie = R.rnd(0, 1);
    var qDie = R.chance(0.29), qSeatDie = R.chance(0.7);
    var bDie = R.chance(Math.min(0.9, 0.36 * (GW.bands != null ? GW.bands : 1))), bSeatDie = R.chance(0.7);
    var stDie = R.chance(Math.min(0.9, 0.075 * (GW.steeples != null ? GW.steeples : 1))), stSeatDie = R.chance(0.55);
    var oDie = R.chance(Math.min(0.9, 0.15 * (GW.oldtune != null ? GW.oldtune : 1))), oSeatDie = R.chance(0.65), oTuneDie = R.rnd(0, 1);
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
    C.visitLogged = true;
    // THE QUESTION IS SHELVED (owner, 2026-09-27: "one of the less interesting
    // guests… there's better stuff we could be focusing on"). Its code stays
    // in kolob-guests.js; it simply never seats. Its dice are still thrown
    // below, so every other draw of the meeting falls exactly where it did.
    // The forcing switch no longer offers it.
    var SHELVED_GUESTS = { question: true };
    // (the switch draws its guest; a dev who names one — the harness, a
    // lab — gets that one, and the die is thrown all the same)
    var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true, handbells: true, singingschool: true };
    var forcedPick = pickWith(forcedDie, [["bands", 2], ["steeples", 1], ["oldtune", 1], ["trombones", 1], ["handbells", 1]]);
    var forcedType = forceVisitation ? (FORCEABLE[forceVisitation] ? forceVisitation : forcedPick) : null;
    // the trombones asked for by name keep the prelude for themselves, and no
    // band crosses their morning (the guests who would have sat there take
    // their other seats; the dice are thrown as ever)
    var dawnAsked = forcedType === "trombones";
    // (and the singing school asked for by name keeps the morning too: no
    // other guest is seated in the prelude — the trombones' dice are thrown
    // all the same)
    var morningAsked = dawnAsked || forcedType === "singingschool";
    var haveSec = {};
    for (var vp = 0; vp < plan.length; vp++) haveSec[plan[vp].type] = true;
    function seatIn(prefs) {
      for (var sp = 0; sp < prefs.length; sp++) if (haveSec[prefs[sp]] && !(morningAsked && prefs[sp] === "prelude")) return prefs[sp];
      return null;
    }
    if (forcedType === "question" || qDie) {
      var qSeat = (forcedType === "question" || qSeatDie)
        ? seatIn(["invocation", "testimony", "hymn"])
        : seatIn(["testimony", "interlude", "invocation"]);
      if (qSeat && !SHELVED_GUESTS.question) C.visitations.push({ type: "question", section: qSeat, fired: false });
    }
    if ((forcedType === "bands" || bDie) && !dawnAsked) {
      var bSeat = forcedType === "bands"
        ? seatIn(["hymn", "doxology", "postlude"])
        : (bSeatDie ? seatIn(["doxology", "hymn", "postlude"]) : seatIn(["hymn", "postlude", "doxology"]));
      if (bSeat) C.visitations.push({ type: "bands", section: bSeat, fired: false });
    }
    // the steeples: bells at the meeting's edges — the framing sections where
    // a bell has civic meaning (calling the valley in, ringing it home)
    if (forcedType === "steeples" || stDie) {
      var stSeat = forcedType === "steeples" ? "prelude" : (stSeatDie && !morningAsked ? "prelude" : "postlude");
      C.visitations.push({ type: "steeples", section: stSeat, fired: false });
    }
    // THE OLD TUNE — its own die, gated by the mode law (kolob-guests.js,
    // oldTuneCandidates): an Earth tune surfaces only on a Sunday of its own
    // colour — the minor tunes on dark Sundays, the major on bright ones —
    // and only where the day's tuning holds every note of the melody it
    // will sing. Seats where remembering belongs: the prelude's
    // pre-gathering reverie, or testimony. Never the sacrament.
    var oldPool = oldTuneCandidates();
    if (oldPool.length && (forcedType === "oldtune" || oDie)) {
      var oSeat = forcedType === "oldtune"
        ? seatIn(["prelude", "testimony", "hymn"])
        : (oSeatDie ? seatIn(["prelude", "testimony"]) : seatIn(["testimony", "interlude", "prelude"]));
      if (oSeat) C.visitations.push({ type: "oldtune", section: oSeat, fired: false, tune: pickWith(oTuneDie, oldPool) });
    }
    // THE TROMBONE CHOIR AT DAWN (round 2; PLAN-COMPOSITION §14, item 3 —
    // after the Moravians of Bethlehem and the Salem Easter sunrise): some
    // Sundays, in the prelude's first minute, a trombone choir far across the
    // settlement plays a line of the day's first hymn, and a nearer choir on
    // the other side answers with the next. It keeps its own dice —
    // guest:trombones:<n>, the odds, the moment and the shape of the
    // exchanges — so a Sunday without it is the Sunday it was. It sits only
    // in the prelude, never beside another guest there, and never in a
    // meeting the bands cross (kolob-guest-trombones.js decides; it is told
    // who is already seated, and the bands are drawn first).
    var TB = Trombones(), tbStream = null, tbInfo = null;
    if (TB) {
      tbStream = stream("guest:trombones");
      tbInfo = { n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "trombones" };
      var tbSeat = TB.plan(tbInfo, tbStream);
      if (tbSeat && forcedType !== "singingschool") C.visitations.push({ type: "trombones", section: "prelude", at: tbSeat.at, dur: tbSeat.dur, fired: false, stream: tbStream });
    }
    // THE SINGING SCHOOL (round 3b, step 3; PLAN-COMPOSITION §15 item 3 —
    // EXPERIMENTAL, KOLOB.Experimental.singingSchool, ?exp=-singingSchool):
    // some Sundays you arrive while the choir is still practising the day's
    // first hymn — the fork, one part goes wrong, the chorister raps the
    // stand, that part alone on the notes, and all of them again. The prelude
    // only, never at a funeral, never when another guest has the morning
    // (kolob-guest-singingschool.js decides, on guest:singingschool:<n>; the
    // switch is read here, once, and handed down so the planner stays pure).
    // It keeps its own time (cued), and the morning is seated around it
    // (seatPrelude: the house wakes after the practice).
    var SSg = KOLOB.GuestSingingSchool || null;
    if (SSg) {
      var ssStream = stream("guest:singingschool");
      var ssSeat = SSg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                              experimental: KOLOB.Experimental ? KOLOB.Experimental.snapshot() : {}, force: forcedType === "singingschool" }, ssStream);
      if (ssSeat) C.visitations.push({ type: "singingschool", section: "prelude", at: ssSeat.at, dur: ssSeat.dur, fired: false, cued: true, stream: ssStream, experimental: true });
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
    // (the doxology's payoff — the assembly, the partner hymn, the refrain or
    // the bands — is settled with the day's hymnal, below: a band seated in
    // the doxology moves out whenever the payoff is another's)
    function bandsLeaveTheDoxology() {
      for (var cvi = 0; cvi < C.visitations.length; cvi++) {
        if (C.visitations[cvi].type === "bands" && C.visitations[cvi].section === "doxology") {
          C.visitations[cvi].section = haveSec.hymn ? "hymn" : "postlude";
        }
      }
    }
    // a marching band may still call, but never over the assembly
    if (C.cumulative) bandsLeaveTheDoxology();
    // THE RASPBERRY AMEN — its own flag, not a seated visitation: it has no
    // section, only the meeting's final cadence. Never on a fast Sunday; a
    // solemn meeting does not end on a joke.
    C.raspberry = forceRaspberry || (activity !== "fast" && !(SUN && SUN.noRaspberry) && razzDie);
    Motif.newMeeting(moment(), stream("motif"));
    if (C.cumulative) {
      var wTheme = Motif.theme();
      emitEvent({
        type: "guest", guest: "assembly", stage: "withheld", logged: true, theme: wTheme ? wTheme.name : null,
        cat: "visitation", label: "◌ the tune is withheld", detail: (wTheme ? wTheme.name + " · " : "") + "until the doxology",
      });
    }
    // The trombones' chorale. With the day's hymnal (round 3) they play the
    // day's FIRST COMPOSED HYMN, which the composer writes off the audio path
    // (THE DAY'S HYMNAL, below): the chorale is taken up at their cue, a few
    // seconds into the prelude, and the prelude then yields to it
    // (cuedArrival). Without the hymnal — a lab that loads no composer — the
    // chorale is written now, as round 2 wrote it (the day's theme poured
    // into the first hymn's meter and set by Harmony; its harmonizing paid
    // here, not in the clock's callback), and the prelude yields at once: it
    // lasts at least until the far choir's last chord has rung out.
    var dawn = visitationOf("trombones");
    var HY = Hymnal() && KOLOB.Composer ? Hymnal() : null, prep = null;
    if (dawn) dawn.tbInfo = tbInfo;
    if (dawn && !HY) {
      dawn.material = TB.chorale(dawnChorale(plan, dawn.stream.fork("material")));
      tbInfo.material = dawn.material;             // (with the chorale in hand, the plan's length is exact)
      var tbExact = TB.plan(tbInfo, tbStream);
      if (tbExact) { dawn.at = tbExact.at; dawn.dur = tbExact.dur; plan[0].dur = Math.max(plan[0].dur, tbExact.holdUntil); }
    }
    // the prelude's seating: who wakes the Sunday, and when (below)
    C.seating = seatPrelude();
    if (C.seating.len !== 1 && plan[0].type === "prelude") plan[0].dur *= C.seating.len;
    // (the practice's morning lasts until it is over and the house has played
    // a while after it; its exact length is known at its cue)
    var school = visitationOf("singingschool");
    if (school && plan[0].type === "prelude") plan[0].dur = Math.max(plan[0].dur, school.at + school.dur + SCHOOL_AFTER_S);
    // THE DAY'S HYMNAL (round 3; PLAN-COMPOSITION §3, §3.7, §4): the house
    // dialect, and for every singing section — each hymn and the doxology —
    // its own dialect (leaning to the house's) and key (leaning home), the
    // meter the plan drew, the day's mode, and the gesture its first line is
    // seeded from. The dice are hymnal:<n>'s; the hymns themselves are
    // written on hymn:<n>:<i> by the composer, ordered now and written off
    // the audio path (kolob-hymnal.js). The trombones' dawn keys the first
    // hymn at home: they play it before anyone has sung.
    C.house = null; C.hymnal = []; C.hymn = null; C.forms = null; C.payoff = C.cumulative ? "assembly" : null;
    if (HY) {
      var th = Motif.theme(), subsM = Motif.subs ? Motif.subs() : [];
      // (a dark Sunday's doxology may rise into major — the sunrise, drawn
      // from that section's own fork when it begins: read here from a fresh
      // copy of the same fork, so its hymn is written in the mode it is sung
      // in and the section's dice are untouched)
      var modeThen = S.mode;
      var secs = plan.map(function (ps, idx) {
        if (ps.type === "doxology" && (modeThen === "aeolian" || modeThen === "dorian")) {
          var Rs = stream("meeting").fork("section:" + idx);
          Rs.chance(0.6);
          var rises = Rs.chance(0.4), to = Rs.pick(["ionian", "mixolydian"]);
          if (rises) modeThen = to;
        }
        return { type: ps.type, meter: ps.meter || null, index: idx, mode: modeThen, light: ps.light };
      });
      var day = HY.plan({
        n: C.meetingNum, kind: activity, sunday: sunday, mode: S.mode, seating: C.seating ? C.seating.name : null,
        sections: secs,
        trombones: !!dawn, cumulative: !!C.cumulative,
        theme: th ? th.notes.map(function (n) { return n.deg; }) : null,
        subs: subsM.map(function (m) { return m.notes.map(function (n) { return n.deg; }); }),
      }, stream("hymnal"));
      C.house = day.house;
      C.hymnal = day.rows;
      // THE DAY'S FORMS (round 3b, step 3): a round, the partner hymn, the
      // wandering refrain — and the doxology's one payoff (kolob-hymnal.js
      // forms, on forms:<n>). A band seated in the doxology leaves it when
      // the payoff is another's; with none, the bands are the payoff.
      var fm = HY.forms ? HY.forms({ n: C.meetingNum, kind: activity, sunday: sunday, cumulative: !!C.cumulative }, day.rows, stream("forms")) : null;
      C.forms = fm;
      if (fm && fm.payoff) { C.payoff = fm.payoff; bandsLeaveTheDoxology(); }
      // THE KOLOB RECKONING (round 3b, step 4; PLAN §7.2): the doxology is
      // written so that its opening can be the drone's cantus — the desk
      // writes it a few ways and keeps the first whose notes stand, one a
      // section, on the key of every section before it (the prelude's and
      // the other rites' the day's own, a hymn's its own), else falls back
      // to the doxology as the composer first wrote it and the drone on the
      // keynote (KOLOB.Experimental.reckoning; ?exp=-reckoning)
      // (the orders are posted once every guest and every rite's seating is
      // known — a still sacrament lets the cantus stand on any note of the
      // tune — below, still inside this plan)
      C.reckoning = null;
      prep = { rows: day.rows, fm: fm };
      if (dawn && day.rows.length) dawn.hymnId = day.rows[0].id;
      // (typed only, as new words are: SCORE §9.5)
      emitEvent({ type: "hymnal", house: C.house, hymns: day.rows.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, key: r.key, meter: r.meter, piece: r.piece || (r.partnerOf ? "partner" : "hymn") }; }),
                  forms: fm ? { round: fm.round, partner: fm.partner, refrain: fm.refrain ? { id: fm.refrain.id, dialect: fm.refrain.dialect, after: fm.refrain.statements.map(function (x) { return x.after; }) } : null, payoff: fm.payoff, why: fm.dice.why } : null });
    }
    if (!C.payoff && C.visitations.some(function (v) { return v.type === "bands" && v.section === "doxology"; })) C.payoff = "bands";
    // (the practice rehearses the day's first hymn)
    if (school && C.hymnal.length) school.hymnId = C.hymnal[0].id;
    // THE WARD'S HANDBELL CHOIR (round 3b, step 3; PLAN-COMPOSITION §15
    // item 5): about one meeting in eight, eight to twelve ringers in a line
    // across the front of the chapel ring the day's hymn (or a round of their
    // own) in the invocation, before the sacrament, or in the postlude —
    // never with the steeples, never beside another guest
    // (kolob-guest-handbells.js decides, on guest:handbells:<n>, told who is
    // already seated: planned after the practice and after the bands have
    // found their section). They keep their own time (cued), stand in the
    // room a step nearer than the ward (seatedSend), and ring the day's
    // first hymn — the doxology's, in the postlude.
    var HBg = KOLOB.GuestHandbells || null;
    if (HBg) {
      var hbStream = stream("guest:handbells");
      var hbSeat = HBg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "handbells" }, hbStream);
      if (hbSeat) {
        var hbRows = C.hymnal.filter(function (r) { return r.piece !== "round"; });
        var hbRow = hbSeat.seat === "postlude" ? hbRows[hbRows.length - 1] : hbRows[0];
        C.visitations.push({ type: "handbells", section: hbSeat.seat, at: hbSeat.at, dur: hbSeat.dur, fired: false, cued: true, stream: hbStream,
                             hymnId: hbRow ? hbRow.id : null, piece: hbSeat.piece });
      }
    }
    // THE HOSANNA (PLAN §8.12: Easter and a dedication only; audio-only,
    // UNLOGGED — no row in the minutes, no word on the board) is not built
    // yet. The hook: the Sunday says whether it may come, and its die is
    // thrown now, on its own stream, so that the day it is built no other
    // die of the meeting moves. Nothing is told.
    var hoDie = stream("guest:hosanna").fork("seat").next();
    C.hosanna = SUN && SUN.hosanna ? { possible: true, built: false, die: +hoDie.toFixed(4) } : null;
    if (C.visitations.length) emitEvent({
      type: "guests-drawn", guests: C.visitations.map(function (v) { return { guest: v.type, section: v.section }; }),
      cat: "visitation-draw", label: C.visitations.map(function (v) { return v.type + "@" + v.section; }).join(","),
    });
    // THE SEATINGS OF THE OTHER RITES (round 3b, step 4; PLAN §7.4): the
    // invocation, an interlude, the testimony, the sacrament and the
    // postlude each draw how the house sits for them — the plain house,
    // lined out only, the brush arbor, an organ voluntary, the choir alone —
    // leaning by the Sunday, one die a rite on scenes:<n>, every die thrown;
    // and never two empty rites running (a hymn, the prelude and a rite a
    // guest is seated in are never empty). Drawn once every guest is seated.
    C.scenes = null;
    if (CAL) {
      var scR = stream("scenes"), scs = CAL.scenes(plan, sunday, C.visitations, scR);
      C.scenes = scs.map(function (x, i) {
        if (!x.scene) return null;
        var spec = CAL.SCENES[x.scene], hum = null;
        if (spec.hum) { var hr = scR.fork("hum:" + i); hum = { n: hr.rint(spec.hum.n[0], spec.hum.n[1]), s: +hr.rnd(spec.hum.s[0], spec.hum.s[1]).toFixed(2) }; }
        return { name: x.scene, empty: !!x.empty, forced: !!x.forced, sits: spec.sits || {}, lean: spec.lean || {}, lined: !!spec.lined, fifths: !!spec.fifths,
                 hum: hum, full: false, spread: "close" };
      });
    }
    // THE DAY'S HYMNS ORDERED (round 3: the desk writes them off the audio
    // path), with the reckoning's order laid on the doxology's
    if (prep) {
      var rk = reckoningInfo(plan, prep.rows, CAL);
      // (held: the switch is off — the same doxology, the drone at home)
      if (rk) C.reckoning = { planned: true, held: !reckoningOn(), doxId: rk.doxId, sections: rk.sections.map(function (x) { return x.index; }), result: null };
      HY.prepare(S.visitSeed(), C.meetingNum, prep.rows, prep.fm, rk);
    }
    // THE WARD (round 3b; PLAN-COMPOSITION §5): the Sunday's thirty-two and
    // the people among them — the chorister, the precentor, the soloist, and
    // three to five of the old bass, the harmony alto, the enthusiast, the
    // child and the newcomer; the testimony-bearers and the organist are
    // seated too (their turns are later rounds'). Pure seating on cast:<n>
    // (kolob-cast.js); they sing every hymn, and everything the choir sings
    // around the hymns. Told with the prelude's seating, by role, in Deseret.
    // THE ORGANIST (round 3b, step 2; PLAN-COMPOSITION §5.2, §14 item 4,
    // §15 item 2): the Sunday's organist — the plain organist, the
    // Victorian or the improviser (kolob-organist.js seat: the kind of
    // Sunday, the house, the light and the Ives switch tilt the draw) — on
    // cast:<n>'s fork `organist`, seated first so that the ward's organist
    // (its name, its archetype) is the same person; the meeting's ledger
    // (hymns, fills, the one strange fill) is theirs.
    C.organist = null; C.chorale = null;
    var OR = KOLOB.Organist && S.castStream ? KOLOB.Organist : null;
    // (round 3b, step 4: the Sunday leans the bench — a Victorian at a
    // conference, a wedding or a dedication, the plain organist at a fast or
    // a funeral — and seats as many of the ward you come to know as its
    // character asks: the fast Sunday three testimony-bearers, a dedication
    // every one of the optional roles, a funeral fewer)
    if (OR) C.organist = OR.seat(S.castStream(C.meetingNum), { kind: activity, sunday: sunday, lean: SUN ? SUN.organist : null, houseDialect: C.house, bright: A ? A.bright : 0.5, ives: !!S.forceVisitation });
    C.ward = KOLOB.Cast && S.castStream ? KOLOB.Cast.seat(S.castStream(C.meetingNum), { organist: C.organist ? C.organist.style : null, enthusiast: !!(C.forms && C.forms.refrain), size: SUN ? SUN.cast : null }) : null;
    if (C.organist && C.ward && C.ward.byId.organist) { C.organist.nameDs = C.ward.byId.organist.nameDs; C.organist.nameEn = C.ward.byId.organist.nameEn; }
    // THE CHORALE PRELUDE: some Sundays the organist's prelude on the day's
    // first hymn is the morning (the organist's own die, cast:<n> →
    // organist:prelude, at the style's odds; refused when the dawn is the
    // trombones' or the steeples', when the tune is withheld, in the brush
    // arbor, on a humming morning, and when the first hymn is one line sung
    // in unison) — seated over the morning the Sunday drew (choraleSeating)
    if (C.organist && HY && C.hymnal.length && S.pipeOn && S.pipeOn()) {
      var fh = C.hymnal[0];
      var pd = OR.preludeDraw(C.organist, S.castStream(C.meetingNum), {
        hymn: fh, trombones: !!dawn, withheld: !!C.cumulative, organSits: !!C.seating.sits.organ, unison: fh.dialect === "oldway" || fh.dialect === "shaker",
        guest: C.seating.name === "steeples" ? "the steeples" : C.seating.name === "school" ? "the singing school" : null, hum: !!C.seating.hum,
      });
      C.organist.preludeDraw = pd;
      if (pd.play) { C.seating = choraleSeating(C.seating); C.chorale = { hymnId: fh.id, begun: false, until: 0, plan: null }; }
    }
    var wardTold = C.ward ? { seated: 32, people: C.ward.individuals.map(function (id) { var m = C.ward.byId[id]; return { memberId: id, role: m.role, nameDs: m.nameDs, part: m.part }; }) } : null;
    var organistTold = C.organist ? { style: C.organist.style, nameDs: C.organist.nameDs, nameEn: C.organist.nameEn /* dev only, never rendered */, prelude: C.organist.preludeDraw ? { play: C.organist.preludeDraw.play, why: C.organist.preludeDraw.why, odds: C.organist.preludeDraw.odds } : null } : null;
    emitEvent({
      type: "prelude-seating", n: C.meetingNum, seating: C.seating.name, under: C.seating.under, style: C.seating.style, at: C.seating.at, full: C.seating.full, spread: C.seating.spread, ward: wardTold, organist: organistTold,
      len: C.seating.len, preludeS: +plan[0].dur.toFixed(2), sits: Object.keys(C.seating.sits), lean: C.seating.lean, hum: C.seating.hum ? { n: C.seating.hum.n, s: C.seating.hum.s, at: C.seating.hum.at, until: C.seating.hum.until } : null,
      cat: "seating", label: "⌖ the prelude is seated", detail: C.seating.name + (C.seating.style ? " · " + C.seating.style : "") + (C.seating.under !== C.seating.name ? " (the morning after: " + C.seating.under + ")" : ""),
    });
    // THE CALENDAR (round 3b, step 4), told once a meeting, typed only (the
    // tools and the harness read it; the page names the Sunday from
    // meeting-start): the Sunday, the light of every rite, their seatings,
    // and whether the doxology was ordered for the reckoning
    emitEvent({
      type: "calendar", n: C.meetingNum, sunday: sunday, kind: activity, nameDs: SUN ? SUN.ds : null,
      hymns: A.hymns, lights: plan.map(function (ps) { return ps.light; }), rites: plan.map(function (ps) { return ps.type; }),
      scenes: C.scenes ? C.scenes.map(function (x) { return x ? { scene: x.name, empty: x.empty, forced: x.forced } : null; }) : null,
      reckoning: C.reckoning ? { doxId: C.reckoning.doxId, sections: C.reckoning.sections.length, held: !!C.reckoning.held } : null,
    });
    enterSection(0, t);
    // The Liahona: the load-bearing draws, surfaced as the oracle's pointing.
    emitEvent({
      type: "liahona", points: "day", mode: S.mode, kind: activity, sunday: sunday, f0: S.F0,
      cat: "liahona", label: "⌖ the Liahona points",
      detail: S.mode + " · " + (sunday || activity) + " · F0 " + S.F0.toFixed(1) + " Hz",
    });
    // (SCORE §6: the calendar's Sunday — round 3b, step 4 — and the house
    // dialect, the day's hymnal's, above; sundayDs the programme card's name)
    emitEvent({
      type: "meeting-start", n: C.meetingNum, sunday: sunday, kind: activity, mode: S.mode,
      keynoteHz: S.F0 * S.ROOT_MULT, houseDialect: C.house, f0: S.F0, season: seasonPos, sundayDs: SUN ? SUN.ds : null,
      cat: "meeting", label: "☀ meeting " + C.meetingNum,
      detail: "F0 " + S.F0.toFixed(1) + " Hz · " + S.mode + " · " + activity + (sunday && sunday !== activity ? " (" + sunday + ")" : "") + " · season " + seasonPos.toFixed(2),
    });
  }

  // ==========================================================================
  // THE PRELUDE'S SEATING (PLAN-COMPOSITION §7.4, pulled forward by the
  // pre-v0.34 polish; the owner: "prioritize variation wherever we can").
  // Round 2 woke every visit on one timetable — the drone at 0:00.1 and the
  // organ at 0:02.7 on 400 of 400 seeds, the field at 0:16, the strings at
  // 0:24, the harmonium, the clarinet, the tines and the wire each at its
  // fixed second — and 358 of 400 first chords were a bare fifth. Now each
  // Sunday draws how its morning is seated, on its own stream prelude:<n>
  // (so no other die moves), and each seating wakes the valley in its own
  // order, every entrance drawn within its own window:
  //   voluntary — the organist first, and the organ leads the prelude, in
  //               one of three manners: a WALK of short chords, the old
  //               BREATH (a long chord, a long rest), or a CONSORT with
  //               the strings
  //   ground    — the drone alone at the downbeat; the field; then the
  //               organ, seldom
  //   valley    — the field and the tines first, and the valley keeps
  //               speaking; the house comes late and plays little
  //   strings   — a string pad on the open fifth before anything, and the
  //               pads overlap all prelude long
  //   parlor    — the harmonium first, close and warm, and the deacon
  //               answers; the parlor keeps the prelude, the organ sparing
  //   arbor     — the brush arbor: no organ and no harmonium in the prelude
  //               (its amen is bowed, not played — runJoint), the strings on
  //               bare fifths, the clarinet over them
  //   humming   — the ward hums as it gathers: a few voices of the choir on
  //               "mm", two to four of the day's chords, before the organist
  //               has touched a key (the organ waits for the hum to end)
  // and two seatings the guests bring with them:
  //   trombones — the trombones at dawn: the house (organ, strings,
  //               harmonium, clarinet) wakes in its drawn order after they
  //               have gone, but the valley does not wait for them — the
  //               drone, the field, the wire and the tines wake at their
  //               own drawn times, under the far choir and the near one
  //               (the house listens; the morning outside does not)
  //   steeples  — the steeples call the valley in: they ring first (a
  //               drawn 1–6 s in, cued like the trombones), then the house
  // THE PRELUDE'S TEXTURE (lean; round 2 of the polish — the critic: the
  // seatings changed who enters when, and nothing after, so three minutes
  // later every Sunday had the same texture): each seating also leans the
  // whole prelude — how long each voice rests between its turns (a factor
  // on its drawn gap: under 1 it plays more, over 1 less), how often the
  // deacon tries a line and the parlor organ sets a chord, and which of the
  // valley's sounds come most. How hard it leans is drawn too (a lean of
  // 0.55–1 as an exponent on every factor), so two organ voluntaries are
  // not one texture. A guest's seating (trombones, steeples) leans the way
  // the Sunday would have been seated without it (the seating die still
  // names one: "under"), so the morning after the dawn is itself drawn.
  // And every Sunday has a hand of its own on top of its seating's (the
  // critic, again: a seating is nine textures, and two Sundays seated alike
  // were near-twins by three minutes in): each voice's rest is leaned by a
  // die of its own, up to 1.8 times either way around the seating's lean
  // (so one voluntary's deacon is busy and another's all but silent), and
  // the valley keeps its own palette — every field sound weighted by a die,
  // up to 2.5 times either way around the seating's weights (one morning is
  // crickets and the clock, another wind and the beacon).
  // The organist's first chord of a seating may be FULL (its third sung)
  // at the seating's own odds, and it is set in close or open position (an
  // even draw): a morning is not always the same bare fifth.
  // A seating also sets how long its prelude lasts (len: a factor on the
  // plan's drawn length — an organ voluntary is brisk, a valley waking is
  // slow — so the first hymn comes in anywhere from about 1:45 to 3:35; a
  // guest's seating keeps the length its guest needs).
  // THE WAKING (what the first meeting's downbeat cues) is the only part a
  // later meeting does not use — its layers are already awake; the rests
  // (sits), the bare fifths, the first chord, the hum, the lean and the
  // length apply to every prelude.
  // Every die of the seating is thrown, whichever seating it lands on.
  // ==========================================================================
  var WAKERS = ["drone", "organ", "ambient", "strings", "harmonium", "clarinet", "bells", "telegraph"];
  // the house: what the dawn's trombones hold back until they have gone
  var HOUSE_WAKERS = { organ: true, strings: true, harmonium: true, clarinet: true };
  // the choir's first call, when it does not hum: it only listens for its
  // hymn (v0.32's fixed 20 s; drawn now, so even the grid it listens on is
  // the Sunday's own)
  var CHOIR_CALL = [12, 30];
  // the still voice's first call: it only listens for the invocation, on a
  // 7 s round (v0.32's fixed 12 s put its first phrase on the same second
  // in one visit of twelve — the grid is the Sunday's own now)
  var VOICE_CALL = [5, 12];
  // lean: gap factors per layer; speak: the deacon's chance to try a line on
  // a prelude turn (0.45 outside a leaning seating); chord: the parlor
  // organ's chance to set a chord (0.55); field: weights on the valley's
  // sounds (the others 1); organDur: a factor on the organ's chord lengths.
  // w: the seating's odds. The organ voluntary, v0.32's only morning, was
  // drawn half again as often as any other until round 2 of the polish,
  // and was the commonest way a visit woke (a quarter of first visits) and
  // the likeliest pair of near-twins; now it is one of the house's mornings
  // at the same odds as the ground and the valley
  var SEATINGS = {
    voluntary: { w: 2,   full: 0.5,  len: [0.75, 1],    at: { drone: [0.3, 4], organ: [1.2, 5], ambient: [10, 22], strings: [18, 34], harmonium: [26, 40], clarinet: [30, 46], bells: [36, 56], telegraph: [45, 70] },
                 lean: { organ: 0.5, strings: 1.5, harmonium: 1.6, clarinet: 1.5, bells: 1.3, telegraph: 1.4, ambient: 1.5 }, speak: 0.25, chord: 0.35,
                 // (the organist's manner, drawn: each overrides the lean where it names a layer)
                 styles: [["walk",    1, { lean: { organ: 0.2 }, organDur: 0.55 }],
                          ["breath",  1, { lean: { organ: 0.9 }, organDur: 1.3 }],
                          ["consort", 1, { lean: { organ: 0.55, strings: 0.55 } }]] },
    ground:    { w: 2,   full: 0.4,  len: [0.9, 1.2],   at: { drone: [0.1, 1], ambient: [4, 12], organ: [10, 18], bells: [20, 34], strings: [24, 40], harmonium: [30, 44], clarinet: [36, 50], telegraph: [40, 66] },
                 lean: { organ: 1.8, strings: 1.4, harmonium: 1.6, clarinet: 1.5, bells: 0.9, telegraph: 0.7, ambient: 0.5 }, speak: 0.35,
                 field: { wind: 2, clock: 1.8, fork: 1.8, crickets: 0.6, beacon: 0.6 } },
    valley:    { w: 2,   full: 0.45, len: [1, 1.3],     at: { ambient: [0.3, 3], bells: [4, 10], drone: [6, 14], telegraph: [12, 30], organ: [16, 28], strings: [26, 40], harmonium: [34, 50], clarinet: [40, 56] },
                 lean: { organ: 1.9, strings: 1.3, harmonium: 1.7, clarinet: 1.3, bells: 0.45, telegraph: 0.5, ambient: 0.3 },
                 field: { crickets: 2, bell: 1.8, beacon: 1.6, coyote: 3, clock: 0.5 } },
    strings:   { w: 1.5, full: 0.35, len: [0.8, 1.1],   at: { strings: [0.3, 2.5], drone: [3, 9], ambient: [8, 20], organ: [14, 26], harmonium: [28, 42], clarinet: [34, 50], bells: [40, 58], telegraph: [46, 72] },
                 lean: { organ: 1.7, strings: 0.45, harmonium: 1.5, clarinet: 1.2, bells: 1.1, telegraph: 1.1, ambient: 0.9 }, chord: 0.4 },
    parlor:    { w: 1.5, full: 0.5,  len: [0.75, 1],    at: { harmonium: [0.5, 3], drone: [2, 8], clarinet: [8, 16], ambient: [12, 24], organ: [18, 30], strings: [24, 38], bells: [38, 56], telegraph: [44, 70] },
                 lean: { organ: 1.8, strings: 1.5, harmonium: 0.4, clarinet: 0.6, bells: 1.2, telegraph: 1.2, ambient: 1.1 }, speak: 0.7, chord: 0.9 },
    arbor:     { w: 1.5, full: 0,    len: [0.9, 1.25],  sits: { organ: true, harmonium: true }, fifths: true,
                 at: { drone: [0.5, 5], ambient: [2, 10], strings: [6, 16], clarinet: [14, 26], bells: [20, 34], organ: [20, 40], harmonium: [30, 50], telegraph: [30, 60] },
                 lean: { strings: 0.75, clarinet: 0.55, bells: 0.8, ambient: 0.7 }, speak: 0.75,
                 field: { crickets: 2, wind: 1.5, clock: 0.3 } },
    // (the hum: its moment is the choir's waking; the organ is counted from
    // the hum's end — hum: [chords, seconds a chord] — and never writes a
    // chord of its own under it)
    humming:   { w: 1.5, full: 0.6,  len: [0.85, 1.15], hum: { n: [2, 4], s: [5, 8] },
                 at: { choir: [0.4, 3], drone: [2, 9], ambient: [6, 24], organ: [2, 9], strings: [20, 36], harmonium: [30, 46], clarinet: [34, 50], bells: [26, 50], telegraph: [40, 70] },
                 lean: { organ: 1.3, strings: 1.2, harmonium: 1.4, clarinet: 1.3, ambient: 0.9 } },
    // (anchored: what is counted from the guest — the trombones' last chord
    // and its air, or the steeples' first bell)
    trombones: { w: 0,   full: 0.5,  anchored: HOUSE_WAKERS,
                 at: { drone: [0.5, 6], organ: [0.5, 4], ambient: [1, 30], strings: [4, 12], harmonium: [8, 18], clarinet: [10, 22], bells: [4, 40], telegraph: [8, 60] } },
    steeples:  { w: 0,   full: 0.45, anchored: { organ: true, ambient: true, strings: true, harmonium: true, clarinet: true, telegraph: true, bells: true },
                 at: { drone: [0.3, 4], ambient: [6, 14], organ: [10, 20], strings: [16, 30], harmonium: [24, 40], clarinet: [30, 46], telegraph: [30, 60], bells: [40, 60] } },
    // (round 3b, step 3: the singing school — the choir still practising as
    // you arrive; the house wakes after it, counted from the practice's end,
    // and the valley and the drone at their own times: it is morning outside)
    school:    { w: 0,   full: 0.45, anchored: HOUSE_WAKERS,
                 at: { drone: [0.5, 6], organ: [1, 5], ambient: [2, 30], strings: [4, 12], harmonium: [8, 18], clarinet: [10, 22], bells: [6, 40], telegraph: [8, 60] } },
    // (round 3b, step 2: the organist's chorale prelude on the day's first
    // hymn — seated over the drawn morning when the organist's own die says
    // so, never drawn here: choraleSeating. anchored: counted from its end)
    chorale:   { w: 0,   full: 0.5,  anchored: { strings: true, harmonium: true, clarinet: true },
                 at: { drone: [0.3, 3], organ: [2.5, 7], ambient: [8, 26], bells: [30, 56], telegraph: [40, 76], strings: [4, 14], harmonium: [8, 20], clarinet: [10, 24] } },
  };
  var SEATING_ODDS = Object.keys(SEATINGS).filter(function (k) { return SEATINGS[k].w > 0; }).map(function (k) { return [k, SEATINGS[k].w]; });
  var STEEPLES_AT = [1, 6];                        // the steeples calling the valley in, s into the prelude
  var LEAN_POW = [0.55, 1];                        // how hard a seating leans (an exponent on its factors)
  var LEAN_LAYERS = ["organ", "strings", "harmonium", "clarinet", "bells", "telegraph", "ambient"];
  var LEAN_OWN = 1.8, LEAN_BOUNDS = [0.3, 3];      // the Sunday's own hand on each voice's rest, and the lean's bounds
  var FIELD_KEYS = ["wind", "crickets", "clock", "fork", "rain", "coyote", "bell", "beacon"];
  var FIELD_OWN = 2.5;                             // the valley's own palette, around the seating's weights
  function seatPrelude() {
    var PR = stream("prelude");
    var pickU = PR.next(), fullU = PR.next(), steeplesU = PR.next(), spreadU = PR.next(), lenU = PR.next();
    var U = {};
    WAKERS.forEach(function (l) { U[l] = PR.next(); });
    // (round 2 of the polish: its dice come after the waking's, so every
    // entrance above falls where it did)
    U.choir = PR.next();
    var leanU = PR.next(), styleU = PR.next(), humNU = PR.next(), humSU = PR.next();
    // (the Sunday's own hand and palette: after all of the above)
    var ownU = {}, palU = {};
    LEAN_LAYERS.forEach(function (l) { ownU[l] = PR.next(); });
    FIELD_KEYS.forEach(function (k) { palU[k] = PR.next(); });
    var voiceU = PR.next();
    // (the Sunday leans the morning: a funeral wakes on the ground or the
    // strings, a conference on the organ voluntary, Christmas humming — the
    // same die, read at the Sunday's odds)
    var mLean = C.meeting && Calendar() && Calendar().SUNDAYS[C.meeting.sunday] ? Calendar().SUNDAYS[C.meeting.sunday].morning || {} : {};
    var under = pickWith(pickU, SEATING_ODDS.map(function (o) { return [o[0], o[1] * (mLean[o[0]] != null ? mLean[o[0]] : 1)]; })), name = under, anchor = 0;
    var tb = visitationOf("trombones"), st = visitationOf("steeples"), ss = visitationOf("singingschool");
    if (tb && tb.section === "prelude") { name = "trombones"; anchor = tb.at + tb.dur + 2; }
    else if (ss && ss.section === "prelude") { name = "school"; anchor = ss.at + ss.dur + 2; }
    else if (st && st.section === "prelude") {
      name = "steeples";
      st.at = +(STEEPLES_AT[0] + (STEEPLES_AT[1] - STEEPLES_AT[0]) * steeplesU).toFixed(2);
      st.cued = true;                              // it keeps its own time now: cued as the prelude begins
      anchor = st.at;
    }
    var spec = SEATINGS[name];
    // the texture leans the way the Sunday was seated — a guest's seating,
    // the way it would have been without the guest (and never on a hum the
    // guest took the place of: the lean only)
    var tex = SEATINGS[spec.w > 0 ? name : under];
    var style = tex.styles ? pickWith(styleU, tex.styles.map(function (s) { return [s[0], s[1]]; })) : null;
    var styleSpec = null;
    if (style) tex.styles.forEach(function (s) { if (s[0] === style) styleSpec = s[2]; });
    var pow = LEAN_POW[0] + (LEAN_POW[1] - LEAN_POW[0]) * leanU, lean = {};
    var base = tex.lean || {}, over = (styleSpec && styleSpec.lean) || {};
    LEAN_LAYERS.forEach(function (l) {
      var m = over[l] != null ? over[l] : base[l] != null ? base[l] : 1;
      var own = Math.pow(LEAN_OWN, 2 * ownU[l] - 1);
      lean[l] = +Math.max(LEAN_BOUNDS[0], Math.min(LEAN_BOUNDS[1], Math.pow(m, pow) * own)).toFixed(3);
    });
    var field = {};
    FIELD_KEYS.forEach(function (k) {
      var m = tex.field && tex.field[k] != null ? tex.field[k] : 1;
      field[k] = +(m * Math.pow(FIELD_OWN, 2 * palU[k] - 1)).toFixed(3);
    });
    var hum = null;
    if (spec.hum) {
      var hn = spec.hum.n, hs = spec.hum.s;
      hum = { n: Math.min(hn[1], hn[0] + Math.floor((hn[1] - hn[0] + 1) * humNU)), s: +(hs[0] + (hs[1] - hs[0]) * humSU).toFixed(2) };
    }
    var at = {};
    WAKERS.concat(["choir"]).forEach(function (l) {
      var r = spec.at[l] || CHOIR_CALL, x = r[0] + (r[1] - r[0]) * U[l];
      var from = spec.anchored && spec.anchored[l] ? anchor : 0;
      at[l] = +(from + x).toFixed(2);
    });
    at.voice = +(VOICE_CALL[0] + (VOICE_CALL[1] - VOICE_CALL[0]) * voiceU).toFixed(2);
    // the hum's end: the organist's first touch is counted from it
    if (hum) { hum.at = at.choir; hum.until = +(at.choir + hum.n * hum.s + 1.5).toFixed(2); at.organ = +(hum.until + at.organ).toFixed(2); }
    var len = spec.len ? spec.len[0] + (spec.len[1] - spec.len[0]) * lenU : 1;
    return {
      name: name, under: under, style: style, at: at, full: fullU < spec.full, spread: spreadU < 0.5 ? "open" : "close", len: +len.toFixed(3),
      sits: spec.sits || {}, fifths: !!spec.fifths, lean: lean, leanPow: +pow.toFixed(3),
      speak: tex.speak != null ? tex.speak : null, chord: tex.chord != null ? tex.chord : null, field: field,
      organDur: (styleSpec && styleSpec.organDur) || 1, hum: hum,
      // (the waking's own dice, kept: the chorale prelude, seated once the
      // organist is, re-times the morning on them — choraleSeating)
      _u: { U: U, fullU: fullU },
    };
  }
  // THE CHORALE PRELUDE'S MORNING (round 3b, step 2): the organist's
  // chorale prelude on the day's first hymn is one of the prelude's
  // seatings — seated like the guests' (the trombones', the steeples'),
  // over the one the Sunday drew, which keeps its texture, its length and
  // its manner for the rest of the prelude ("under"). The drone and the
  // valley wake around the organist; the house — the strings, the harmonium
  // and the deacon — is counted from the chorale's end (CHORALE_EST, its
  // likely length: the house also listens while the organist plays,
  // however long that proves to be). The same dice as the drawn morning.
  var CHORALE_EST = 44;
  var CHORALE_AFTER_S = 26;
  var SCHOOL_AFTER_S = 22;                       // …and after the singing school's practice                      // the prelude goes on at least this long after the chorale (the house wakes into it)
  function choraleSeating(seat) {
    var spec = SEATINGS.chorale, U = seat._u.U, at = {};
    WAKERS.concat(["choir"]).forEach(function (l) {
      var r = spec.at[l] || CHOIR_CALL, x = r[0] + (r[1] - r[0]) * U[l];
      at[l] = x;
    });
    Object.keys(spec.anchored).forEach(function (l) { at[l] += at.organ + CHORALE_EST; });
    Object.keys(at).forEach(function (l) { at[l] = +at[l].toFixed(2); });
    at.voice = seat.at.voice;
    var out = {};
    for (var k in seat) out[k] = seat[k];
    out.name = "chorale"; out.at = at; out.full = seat._u.fullU < spec.full; out.sits = {}; out.fifths = false; out.hum = null;
    return out;
  }

  function visitationOf(type) {
    for (var i = 0; i < C.visitations.length; i++) if (C.visitations[i].type === type) return C.visitations[i];
    return null;
  }
  // THE DAWN'S CHORALE — what the trombones play until the hymn composer
  // exists: the day's theme poured into the first hymn's meter, one line
  // per line of it, and set in four parts by Harmony in the day's mode, each
  // line voiced on from the last; with the tune itself, so the choir's
  // soprano keeps its octaves. On a withheld Sunday (the cumulative form)
  // a working motif stands in for the theme, as it does for the visiting
  // band: the dawn must not give the tune away. Every die is the guest's
  // own (R, a fork of guest:trombones:<n>); nothing is written into the
  // chord book and nothing is announced — it is the trombones' page, not
  // the hall's. The trombone room reads it, tunes it and re-voices it.
  function dawnChorale(plan, R) {
    var mo = moment();
    mo.section = "prelude"; mo.arc = 0; mo.chord = null;
    var first = null;
    for (var i = 0; i < plan.length; i++) if (plan[i].type === "hymn") { first = plan[i]; break; }
    var meter = METERS[(first && first.meter) || "CM"] || METERS.CM;
    var src = C.cumulative ? Motif.anyWorking(mo, R) : Motif.theme();
    var tune = meter.map(function (nSyl) { return Prosody.pourIntoLine(src, nSyl, R); });
    var lines = tune.map(function (ln) {
      var hz = Harmony.harmonize(ln.map(function (x) { return { deg: x.deg, dur: x.durBeats }; }), mo, R);
      if (hz.length) mo = Harmony.standingOn(mo, hz[hz.length - 1].chord);
      return hz;
    });
    // …and the dawn ends where its harmony falls. Harmony sets each note from
    // the grammar, and the last line may close on IV, vi, iii or V as well as
    // on the tonic; the owner heard round 2's forced tonic close and ruled it
    // open (PLAN-COMPOSITION §15: "keep it open"). The morning is not over
    // when the trombones stop — the house comes in after them.
    return {
      mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, lines: lines,
      tune: { space: "d7", lines: tune.map(function (ln) { return ln.map(function (x) { return x.deg; }); }) },
    };
  }

  // A section begins at t (a joint's end, the downbeat, or a dev jump). Its
  // dice come from its own fork of the plan, thrown whether used or not.
  function enterSection(i, t) {
    var s = C.plan[i];
    // (the arc's crossfade: the level the last rite ended at — its own
    // curve at its close; none for a meeting's first rite)
    C.fromLevel = i > 0 && C.section && C.plan[i - 1] ? curveOf(C.plan[i - 1].type, 1, C.plan[i - 1].light != null ? C.plan[i - 1].light : (LIGHT_OF[C.plan[i - 1].type] || 0.4)) : null;
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
    // a singing section is a hymn of its own (its own hymnId), and begins at
    // its first line — the doxology too (round 2, the critic: it walked on
    // from wherever the last hymn had stopped, so its Score opened at verse 1,
    // or mid-stanza with no verse-start at all)
    if (s.type === "hymn" || s.type === "doxology") C.verseLine = 0;
    // a composed hymn belongs to its own section: a new section (a joint's
    // end, or a dev jump) lets the last one's performance go (its cues ask)
    C.hymn = null;
    // the section's hymn, written ahead (THE DAY'S HYMNAL): asked for now
    // (kolob-hymnal.js has it waiting; a late one is written here, counted)
    var row = (s.type === "hymn" || s.type === "doxology") ? hymnalRow(hymnId()) : null;
    var composed = row && Hymnal() ? Hymnal().get(row.id) : null;
    if (composed) C.meter = composed.meter;
    if (s.type === "hymn" && s.meter) {
      if (!composed) C.meter = s.meter;
      emitEvent({ type: "liahona", points: "meter", meter: C.meter, cat: "liahona", label: "⌖ the meter is given", detail: C.meter + " — " + (METERS[C.meter] ? METERS[C.meter].join(".") : String(C.meter)) });   // (a round's "meter" is its segments' lengths)
    }
    // the doxology SUNRISE: a dark-mode meeting may lift into major at the
    // last — rare, and the most audible surprise the engine owns
    if (s.type === "doxology" && (S.mode === "aeolian" || S.mode === "dorian") && sunriseDie) {
      S.mode = sunriseMode;
      rebuildScale();
      Desk.reset();                 // the new mode starts a clean page
      emitEvent({
        type: "sunrise", mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, f0: S.F0,
        cat: "meeting", label: "☀ sunrise",
        detail: "F0 " + S.F0.toFixed(1) + " Hz · " + S.mode + " · " + (C.meeting ? C.meeting.activity : "") + " · season " + seasonPos.toFixed(2),
      });
    }
    var scn = C.scenes && C.scenes[i] ? C.scenes[i] : null;
    emitEvent({
      type: "section-start", section: s.type, index: i, dur: s.dur, meter: s.type === "hymn" ? C.meter : null,
      light: s.light != null ? s.light : null, scene: scn ? scn.name : null,
      cat: "section", label: "§ " + s.type.toUpperCase(), detail: (s.type === "hymn" ? C.meter + " · " : "") + Math.round(s.dur) + "s",
    });
    // the rite's seating, when it is not the plain house (typed only; the
    // minutes give it a row)
    if (scn && scn.name !== "plain") emitEvent({ type: "scene", section: s.type, index: i, scene: scn.name, forced: !!scn.forced, sits: Object.keys(scn.sits || {}), light: s.light != null ? s.light : null });
    // (and the voices it sits out let go of whatever they wrote before it
    // began — the joint's clarinet phrase, a chord of the strings — over
    // the house's release, as for a guest; the round-3b critic heard a
    // phrase written in the joint ring thirty seconds into the choir alone)
    if (scn && scn.sits && Object.keys(scn.sits).length && S.houseLetsGo) S.houseLetsGo(t, "the rite's seating: " + scn.name, true, scn.sits);
    // a singing section announces its hymn (SCORE §6): its number and its
    // Deseret name for the board, its meter, its dialect, and (round 3) its
    // hymnist's name in Deseret — the composer's hymn, sung verse by verse
    // by the choir (THE COMPOSED HYMN, kolob-voices-choir.js), which now
    // owns the section's singing; the section lasts at least as long as the
    // hymn does. Without a composed hymn (no composer loaded, or one it could
    // not write) the choir walks the day's motifs through the meter, as
    // round 2 did, and the board has nothing to give but the meter.
    if (s.type === "hymn" || s.type === "doxology") {
      if (composed) {
        // the ward's plan for it first (who keys it, who comes forward and
        // when), so the board can name them (round 3b: THE WARD SINGS THE
        // HYMN, kolob-voices-choir.js)
        var pre = S.hymnPlan ? S.hymnPlan(composed, row) : null;
        emitEvent({
          type: "hymn-announced", leaderDs: pre ? pre.leaderDs : null, ward: pre ? pre.announce : null,
          hymn: { id: composed.id, number: composed.number, nameDs: composed.nameDs, meter: composed.meter, dialect: composed.dialect,
                  authorDs: composed.hymnist ? composed.hymnist.nameDs : null, mode: composed.mode, key: row.key, keyMonzo: composed.keyMonzo.slice(),
                  form: composed.form, modeOfTime: composed.modeOfTime },
        });
        C.hymn = { id: composed.id, row: row, dialect: composed.dialect, key: row.key, active: true, from: t, until: t };
        var perf = singHymn(composed, row, t, pre);
        if (perf && perf.end > t) C.sectionDur = s.dur = Math.max(s.dur, perf.end - t + perf.tail);
      } else {
        emitEvent({ type: "hymn-announced", hymn: { id: hymnId(), number: null, nameDs: null, meter: C.meter, dialect: null, authorDs: null }, leaderDs: null });
      }
    }
    // (round 3b, step 4: the reckoning) a rite that is not a hymn begins on
    // a chord that holds the drone's note, where the chord standing does not
    // — written by the drone, played by nobody: the strings' fifths, the
    // harmonium, the tines and the deacon's lean read it, and the house's
    // next chords lean on the drone from it (THE HOUSE LEANS ON THE DRONE)
    if (s.type !== "hymn" && s.type !== "doxology" && s.type !== "prelude") {
      var pcl = Desk.pedalClass(t);
      if (pcl != null && !(Harmony.chordTones(Desk.at(t)) || {})[pcl]) Desk.advance({ open: false }, stream("reckoning").fork("pedal:" + i), t + 0.05, "drone");
    }
    // the gathering moves in the room with the section — unless the room lab holds it
    if (!S.roomBalanceHeld) setRoomBalance(S.ROOM_BALANCE[s.type] != null ? S.ROOM_BALANCE[s.type] : 0.45, S.roomRampNext);
    S.roomRampNext = S.ROOM_RAMP_S;
    Motif.onSection(s.type);
    // a guest that keeps its own time is cued as its section begins, at the
    // moment its plan drew (the trombones: seconds into the prelude — too
    // early for the poll below, which waits out a section's first fifth)
    C.visitations.forEach(function (V) {
      if ((CUED[V.type] || V.cued) && V.section === s.type && !V.fired) cueAt("guests", t + (V.at || 0), function (tc) { cuedArrival(V, tc); });
    });
  }

  // (every clock below is the music's now: the cue's scheduled time)
  function localArc() {
    if (!S.ctx) return 0;
    return Math.max(0, Math.min(1, (now() - C.sectionStart) / C.sectionDur));
  }
  // Global intensity 0..1 — ceilings kept LOW. This is open country; even the
  // doxology's full gathering leaves sky above it.
  // THE ARC OF LIGHT (round 3b, step 4; PLAN §7.3) replaces the fixed curve
  // each rite kept: every rite's curve is drawn from its LIGHT (the
  // calendar's arc, the Sunday's own — kolob-calendar.js), so the same rite
  // is fuller in full light and plainer at dawn (the second hymn over the
  // first, a funeral's invocation under an ordinary one's), and a rite no
  // longer begins at its own level with a jump: its first seconds are a
  // crossfade from where the last rite ended (XFADE_S: a tenth of the rite,
  // eight seconds at the least, fourteen at the most). At the arc's
  // ordinary lights the curves sit where the old ones did (the prelude
  // 0.12–0.25, the invocation 0.07–0.15, a hymn 0.26–0.60 rising to 0.34–0.71
  // in the last hymn, the sacrament 0.05, the doxology 0.32–0.80, the
  // postlude 0.28 falling to nothing).
  var XFADE_S = [8, 14];
  var LIGHT_OF = { prelude: 0.12, invocation: 0.2, hymn: 0.5, interlude: 0.44, testimony: 0.44, sacrament: 0.08, doxology: 1, postlude: 0.4 };
  function curveOf(sec, x, L) {
    switch (sec) {
      case "prelude": return 0.08 + 0.3 * L + (0.1 + 0.3 * L) * smooth(x);
      case "invocation": return 0.03 + 0.2 * L + 0.08 * x;
      case "hymn": {
        var lo = 0.14 + 0.3 * L, hi = lo + 0.3 + 0.1 * L;
        var base = lo + (hi - lo) * (x < 0.75 ? smooth(x / 0.75) : 1 - 0.25 * smooth((x - 0.75) / 0.25));
        if (S.ctx && now() < C.fugingUntil) base += 0.12;
        return Math.min(0.78, base);
      }
      case "testimony": return 0.08 + 0.25 * L;
      case "interlude": return 0.06 + 0.2 * L + 0.08 * smooth(x);
      case "sacrament": return 0.02 + 0.35 * L;
      case "doxology": {
        var d0 = 0.12 + 0.2 * L, dp = 0.28 + 0.2 * L;
        return Math.min(0.8, d0 + dp * smooth(x < 0.8 ? x / 0.8 : 1 - 0.4 * smooth((x - 0.8) / 0.2)));
      }
      case "postlude": return (0.1 + 0.45 * L) * (1 - x);
    }
    return 0.25;
  }
  function lightNow() {
    var ps = C.plan[C.si];
    return ps && ps.type === C.section && ps.light != null ? ps.light : (LIGHT_OF[C.section] != null ? LIGHT_OF[C.section] : 0.4);
  }
  function intensity() {
    var v = curveOf(C.section, localArc(), lightNow());
    if (S.ctx && C.fromLevel != null) {
      // (read from outside a cue — the page's poll — the audio clock may
      // stand a moment behind a rite already begun on the music's clock:
      // that moment is the crossfade's first)
      var xf = Math.max(XFADE_S[0], Math.min(XFADE_S[1], 0.1 * C.sectionDur)), dt = now() - C.sectionStart;
      if (dt < xf) v = C.fromLevel + (v - C.fromLevel) * smooth(Math.max(0, dt) / xf);
    }
    return v;
  }
  function smooth(z) { z = Math.max(0, Math.min(1, z)); return z * z * (3 - 2 * z); }
  function inHush() { return S.ctx && now() < C.hushUntil; }
  function inFuging() { return S.ctx && now() < C.fugingUntil; }
  function inVisit() { return S.ctx && now() < C.visitUntil; }
  // the question is a scored passage — its performers' free cycles sit out;
  // the bands are a COLLISION — nobody sits out, that is the piece
  function inQuestion() { return inVisit() && C.visitType === "question"; }
  function silenceMul() { return C.meeting && C.meeting.row ? C.meeting.row.silenceMul : 1; }
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
      if (!V.fired && !(CUED[V.type] || V.cued) && V.section === C.section && x > 0.2 && x < 0.55 &&
          !C.jointing && !inHush() && !inFuging() && !inVisit() && !hymnSounding() && !choraleSounding()) {
        arrive(V, t);
        break;
      }
    }
    // The cumulative assembly: the withheld tune arrives in the doxology. A
    // hush or a guest may delay it; past x 0.7 the fallback fires regardless
    // (compressed) — the payoff is never skipped. It waits for a doxology
    // line the choir is still singing (the same choir sings it; round 2),
    // and that line holds the joint, so the wait never costs the payoff.
    // (a composed doxology IS the assembly: the performer tells it — below,
    // assemblyBegins — so the conductor's own stays for a Sunday without one)
    if (C.cumulative && !C.assemblyFired && C.section === "doxology" && !choirSinging() && !C.hymn &&
        ((x > 0.35 && !C.jointing && !inHush() && !inFuging() && !inVisit()) ||
         (x > 0.7 && !C.jointing))) {
      C.assemblyFired = true;
      var adur = cumulativeAssembly(t);
      C.assemblyUntil = t + adur;
      guestSpan("assembly", t, adur);
    }
    // The fuging waits for a verse the choir is still singing (round 2): the
    // same four voices cannot go out one by one while they sing the couplet
    // they wrote half a minute ahead, and v0.32's convergence amen could land
    // on a chord of that couplet. Its window is unchanged. The choir, for
    // its part, begins no couplet from x 0.45 while a planned fuging waits
    // (fugingNear; round 2 of the polish): before, a hymn whose window the
    // verses happened to fill lost its fuging, so a hymn was a meadow by
    // collision rather than by its die — seed 1847 went 45 minutes without
    // one. A meadow is the die's to decide (fugingDie, 40 % of hymns).
    // (a composed hymn places its own fuging between its verses, on its own
    // head — THE COMPOSED HYMN; the conductor's is for a hymn without one)
    if (C.section === "hymn" && C.fugingPlanned && !C.fugingFired && !C.hymn && x > 0.6 && x < 0.8 && !inHush() && !inVisit() && !choirSinging()) {
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
    // (never under a hymn being sung: the ground stays under the singers)
    if (C.section !== "sacrament" && C.section !== "testimony" && !C.jointing && !inHush() && !hymnSounding() && !choraleSounding() && unbiddenDie) {
      stillness("unbidden", t);
    }
    // Section end → joint → advance. A guest still sounding HOLDS THE JOINT:
    // the section runs on until the visitor has gone by (owner: "it's
    // ambient music… if the section needs to be a bit longer, that's okay"),
    // and the assembly of the withheld tune finishes before the amen of the
    // joint. v0.32 turned the section over under a band in mid-crossing.
    // So does the choir: a couplet is written half a minute ahead, and the
    // organ's cadence waits until its last chord has been sung and the
    // congregation has drawn a breath — v0.32 laid the joint's amen, and the
    // next section's first chords, under a line still being sung.
    if (!C.jointing && x >= 1 && !jointHeld()) {
      C.jointing = true;
      var last = C.si >= C.plan.length - 1;
      var jointDur = runJoint(last, t);
      if (!last) reckonTurn(t + 0.2, jointDur, C.si + 1);
      cueAt("conductor", t + jointDur + 0.5, function (tn) {
        if (C.si >= C.plan.length - 1) planMeeting(tn);
        else enterSection(C.si + 1, tn);
      });
    }
    cueAt("conductor", t + 0.6, conductorTick);
  }

  // THE RECKONING AT A JOINT (round 3b, step 4; PLAN §7.2). As a joint
  // begins, the drone turns to the next rite's note of the cantus — or home,
  // from the doxology on, where the ward sings the tune it has spelled —
  // gliding four to six seconds under the joint's hush (the joint waits for
  // a hymn's last chord and a breath before it begins, and the glide is
  // over before the next rite does: never under a line). The doxology's
  // reckoning is read at the first joint (the desk has long since written
  // it; if not, it is written there and then, as any hymn asked for early —
  // the same doxology by every road). Its glide's length is on
  // reckoning:<n> → glide:<i>; nothing else is drawn.
  function readReckoning() {
    var rk = C.reckoning;
    if (!rk) return null;
    if (rk.read) return rk;
    rk.read = true;
    var h = Hymnal() ? Hymnal().get(rk.doxId) : null, r = h && h.reckoning ? h.reckoning : null;
    rk.ok = !!(r && r.ok); rk.from = r ? r.from : null; rk.k = r ? r.k : null; rk.tries = r ? r.tries : null; rk.by = r && r.ok ? r.by || "notes" : null;
    rk.cantus = rk.ok ? r.cantus : []; rk.why = r && !r.ok ? (r.why || "no candidate fit") : (!h ? "the doxology was not written" : !r ? "the doxology was not ordered for it" : null);
    emitEvent({ type: "reckoning", ok: rk.ok, held: !!rk.held, doxId: rk.doxId, from: rk.from, k: rk.k, tries: rk.tries, by: rk.by, n: rk.cantus.length, why: rk.why,
                cantus: rk.cantus.map(function (c) { return { index: c.index, type: c.type, deg: c.deg, role: c.role, monzo: c.monzo.slice() }; }) });
    return rk;
  }
  function reckonTurn(t, jointDur, next) {
    if (!C.reckoning || !S.droneTurn) return;
    var rk = readReckoning();
    // (held: the switch is off, and the drone keeps the keynote all meeting)
    if (!rk || !rk.ok || rk.held || !C.plan[next]) return;
    var R = stream("reckoning").fork("glide:" + next);
    var g = Math.min(R.rnd(4, 6), Math.max(1.5, jointDur + 0.3));
    var note = null, k = null;
    for (var j = 0; j < rk.cantus.length; j++) if (rk.cantus[j].index === next) { note = rk.cantus[j]; k = j; }
    var to = note ? note.monzo : [0, 0, 0, 0], role = note ? note.role : "tonic";
    var turned = S.droneTurn(t, to, g, role, k);
    if (turned) emitEvent({ type: "drone-turn", at: t, index: next, section: C.plan[next].type, to: to.slice(), role: role, k: k, deg: note ? note.deg : null, glide: +turned.glide.toFixed(3),
                            fromHz: +turned.fromHz.toFixed(3), toHz: +turned.toHz.toFixed(3), home: !note, dox: C.plan[next].type === "doxology" });
  }

  // A GUEST ARRIVES at t: marked, its set piece placed, its span told (the
  // page's direction line names it while it sounds; the joint waits for it).
  // A guest the minutes may not name (UNLOGGED below) carries that on every
  // event and note it sends, and the page is never told it came.
  var VISIT_FN = { question: unansweredQuestion, bands: twoBandsCross, steeples: steeplesAnswer, oldtune: oldTuneRemembered, trombones: trombonesAtDawn,
                   handbells: handbellsRing, singingschool: singingSchool };
  function arrive(V, t) {
    V.fired = true;
    V.logged = !UNLOGGED[V.type];
    // THE HOUSE LETS GO (SCORE's guest rule; the pre-v0.34 polish): the
    // organ's chord, the strings' pad and the harmonium's and clarinet's
    // lines release over 1.5 s as the visitor comes in (kolob-core.js)
    S.houseLetsGo(t, V.type, V.logged);
    // type → set piece; each receives its visitation record (the old tune its
    // drawn tune, the trombones their stream and chorale)
    var vdur = (VISIT_FN[V.type] || twoBandsCross)(V, t);
    // (the bands crossing a doxology are its payoff, when nothing else is)
    if (V.type === "bands" && C.section === "doxology") emitEvent({ type: "payoff", kind: "bands", section: "doxology", hymnId: C.hymn ? C.hymn.id : null });
    C.visitType = V.type;
    C.visitLogged = V.logged;
    C.visitUntil = t + vdur;
    guestSpan(V.type, t, vdur, V.logged);
  }
  // THE GUESTS THAT KEEP THEIR OWN TIME — cued when their section begins
  // (enterSection), at the moment their plan drew, never found by the poll.
  // The cue still asks: the guest's own meeting, its section still standing
  // (a dev jump may have left it), no joint sounding, no other guest.
  var CUED = { trombones: true };
  function cuedArrival(V, t) {
    if (!S.playing || V.fired || C.visitations.indexOf(V) < 0 || C.section !== V.section || C.jointing || inVisit()) return;
    if (V.type === "trombones" && !V.material) dawnFromHymnal(V);
    if ((V.type === "handbells" || V.type === "singingschool") && !V.material) standingMaterial(V);
    arrive(V, t);
  }
  // THE BELLS' AND THE PRACTICE'S MATERIAL (round 3b, step 3): the day's
  // hymn as the composer wrote it (the first hymn; the doxology's, for the
  // bells in the postlude) — waiting since the plan, or written now and
  // counted — made ready by the guest itself (prepare: pure, on its own
  // stream), and the section held as long as the piece now is exactly
  function standingMaterial(V) {
    var G = V.type === "handbells" ? KOLOB.GuestHandbells : KOLOB.GuestSingingSchool;
    if (!G) return;
    var h = V.hymnId && Hymnal() ? Hymnal().get(V.hymnId) : null;
    var mat = { hymn: h, keynoteHz: S.F0 * S.ROOT_MULT, mode: S.mode };
    if (V.type === "handbells") { mat.seat = V.section; if (V.piece) mat.piece = V.piece; }
    try { V.material = G.prepare(mat, V.stream); }
    catch (e) { V.material = null; if (window.console) console.warn("Kolob: the " + V.type + " could not be made ready:", e); return; }
    var sc = G.score(V.material, V.stream, 0);
    V.dur = sc.end;
    var hold = (V.at || 0) + V.dur + (V.type === "singingschool" ? SCHOOL_AFTER_S : 3);
    if (C.section === V.section) C.sectionDur = C.plan[C.si].dur = Math.max(C.sectionDur, hold);
  }
  // THE DAWN PLAYS THE FIRST HYMN (round 3): the trombones take up the
  // day's first composed hymn at their cue — written off the audio path
  // since the plan (kolob-hymnal.js), so it is waiting; a late one is
  // written here and counted. The trombone room re-voices it for the
  // brass (a few ms), and now the chorale's length is exact: the prelude
  // lasts at least until the far choir's last chord has rung out over the
  // town. No hymn to be had → round 2's chorale of the poured theme.
  function dawnFromHymnal(V) {
    var TB = Trombones(), h = V.hymnId && Hymnal() ? Hymnal().get(V.hymnId) : null;
    if (!TB) return;
    V.material = h ? TB.chorale({ hymn: h, mode: h.mode, keynoteHz: S.F0 * S.ROOT_MULT }) : TB.chorale(dawnChorale(C.plan, V.stream.fork("material")));
    V.fromHymn = h ? h.id : null;
    if (V.tbInfo) {
      V.tbInfo.material = V.material;
      var ex = TB.plan(V.tbInfo, V.stream);
      if (ex) {
        V.dur = ex.dur;
        if (C.plan[0] && C.plan[0].type === "prelude") {
          C.plan[0].dur = Math.max(C.plan[0].dur, ex.holdUntil);
          if (C.section === "prelude") C.sectionDur = Math.max(C.sectionDur, C.plan[0].dur);
        }
      }
    }
  }
  // THE HOUSE LISTENS — a guest that is a chorale of its own (the trombones
  // at dawn, in the day's mode and on its own chords): while it sounds, the
  // organ, the harmonium and the strings rest their hands, and the melodic
  // voices find the air taken (the guest claims it); the drone and the field
  // stay — the chorale is the day's own mode, and it is morning outside.
  var LISTENED = { trombones: true, handbells: true, singingschool: true };
  // …and while a composed hymn is sung (round 3): the ward and (in the
  // Tabernacle) the organ under it are the music; the house's own voices —
  // the organist's free chords, the harmonium, the strings, the clarinet —
  // speak around the hymn, not over it (PLAN-COMPOSITION §1.1: the motif
  // engine works AROUND the hymns), and come back when it is done
  // …and while the organist plays the chorale prelude (round 3b, step 2):
  // the drone and the valley stay (it is morning outside); the house's own
  // voices wait for the organist, and so does a guest
  function hallListens() { return (inVisit() && !!LISTENED[C.visitType]) || hymnSounding() || choraleSounding(); }
  function choraleSounding() { return !!C.chorale && C.chorale.begun && !!S.ctx && now() < C.chorale.until; }

  // a guest is sounding: a visitation, or the whole tune at last
  function guestSounding() { return inVisit() || (!!S.ctx && now() < C.assemblyUntil); }
  // what holds the joint: a guest, or a line the choir has written and not
  // yet sung to its end (the chord desk keeps that time: sungUntil), and a
  // breath after it
  var CHOIR_BREATH_S = 1.0;
  // a composed hymn holds its section from its announcement to its last
  // chord and a breath after it — through its gaps too (a fuging, a guest,
  // an answer between verses are the hymn's own)
  function hymnSounding() { return !!C.hymn && (C.hymn.active || (!!S.ctx && now() < C.hymn.until)); }
  function choirSinging() { return !!S.ctx && (now() < Desk.sungUntil() || hymnSounding()); }
  function jointHeld() { return guestSounding() || choraleSounding() || (!!S.ctx && (now() < Desk.sungUntil() + CHOIR_BREATH_S || (!!C.hymn && (C.hymn.active || now() < C.hymn.until + CHOIR_BREATH_S)))); }
  // A guest's span, told as SCORE.md §6's typed events (the page's minutes
  // keep their own rows; these are for the harness and the typed bus)
  function guestSpan(type, t, dur, logged) {
    var sec = C.section, lg = logged !== false;
    emitEvent({ type: "guest-start", guest: type, section: sec, until: t + dur, logged: lg });
    cueAt("conductor", t + dur, function () {
      emitEvent({ type: "guest-end", guest: type, section: sec, logged: lg });
    });
  }
  // THE UNLOGGED GUESTS — a guest that "just happens, low-key" (PLAN §8.12,
  // the Hosanna): it sends logged: false on every event and on every note the
  // page may not show, the minutes print none of them, the staff engraves
  // none of those notes, and the hymn board's direction line never names it. The
  // Hosanna is not built yet; the table is read when a guest arrives, so a
  // test may add any guest to it (KOLOB._s.UNLOGGED_GUESTS.oldtune = true).
  var UNLOGGED = { hosanna: true };

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
    // (the reckoning: the drone jumps to the rite's own note, quickly)
    if (C.reckoning && S.droneTurn) {
      var rk = readReckoning(), note = null;
      if (rk && rk.ok && !rk.held) { rk.cantus.forEach(function (c, j) { if (c.index === idx) note = { c: c, k: j }; }); S.droneTurn(t, note ? note.c.monzo : [0, 0, 0, 0], 2, note ? note.c.role : "tonic", note ? note.k : null); }
    }
    emitEvent({ type: "skip", to: type, cat: "conductor", label: "↷ skipped", detail: "to " + type + " (dev)" });
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
    emitEvent({ type: "stillness", why: why, holdS: holdS, cat: "conductor", label: "◦ the still small voice", detail: why + " · " + holdS.toFixed(1) + "s" });
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
      emitEvent({ type: "room-empties", toward: next, cat: "cadence", label: "∴ the room empties", detail: "into stillness" });
    } else if (isLast && C.raspberry) {
      // THE RASPBERRY AMEN (after the close of Ives's Second Symphony): the
      // cadence sets up in earnest — the IV played perfectly straight — and
      // the organist's hands land a quiet fistful of seconds where the tonic
      // should be. The tuba player commits to it. Held long enough to be
      // unmistakably on purpose; the bell rings anyway, unbothered; the
      // clerk's pen stops mid-word.
      var rChords = Desk.cadence("plagal", R, t, "raspberry");
      var rDur = R.rnd(2.6, 3.6);
      Desk.write(rChords[0], t, "raspberry");                  // (the amen it sets up is never written: it never sounds)
      organChord(t, rDur * 1.02, rChords[0], 0.6);             // the setup, in earnest
      organChord(t + rDur, 3.2, razzCluster(), 0.5);           // the resolution that isn't
      tubaBlat(t + rDur);
      dur = rDur + 3.2 + 1.5;
      // the sexton usually didn't notice — the ritual visibly continues
      if (R.chance(Math.max(C.meeting.row.bells, 0.6))) {
        meetinghouseBell(t + dur * 0.75, 1.0, R);
      }
      cueAt("conductor", t + rDur + 0.15, function () {
        emitEvent({ type: "guest", guest: "raspberry", stage: "blat", logged: true, cat: "visitation", label: "∴ raspberry", detail: "the tuba's own" });
      });
      cueAt("conductor", t + rDur + 0.9, function () {
        emitEvent({ type: "guest", guest: "raspberry", stage: "amen", logged: true, cat: "visitation", label: "∴ amen—", detail: "the organist's own" });
      });
    } else {
      // the organ's amen is the Tabernacle's (PLAN §3.C: the amen lives there,
      // and stays Kolob's signature as the share of the Sundays sung in that
      // voice): a Sacred Harp house closes its sections as its tunes close
      // theirs, dominant to home, and the meeting too (round 3: the plagal
      // share follows the house — round 2's joints were 82 % plagal on every
      // Sunday). The Old Way's lined hymns carry no harmony at all; the
      // organist's amens between its sections are the Sunday's only closes,
      // and stay as ever.
      var kindDie = R.pickW([["plagal", 3], ["authentic", 2], ["half", 1]]);
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? kindDie : "plagal");
      if (C.house === "sacredharp") kind = isLast || kindDie !== "half" ? "authentic" : "half";
      var chords = Desk.cadence(kind, R, t, "joint");
      var chDur = R.rnd(2.6, 3.6);
      // the brush arbor has no organ (THE PRELUDE'S SEATING): its amen is
      // bowed — the strings on each chord's bare fifth — and the organist is
      // first heard in the meeting that follows (round 2 of the polish: the
      // arbor's organ used to play the prelude's closing amen)
      // (and so is the amen of a rite seated in the brush arbor — round 3b,
      // step 4, after the critic's round: the arbor's organ sat the rite
      // out and then played its amen)
      var scA = sceneNow();
      var bowed = (C.section === "prelude" && !!C.seating && !!C.seating.sits.organ) || !!(scA && scA.name === "arbor");
      for (var i = 0; i < chords.length; i++) {
        Desk.write(chords[i], t + i * chDur, "joint");
        var cd = chDur * (i === chords.length - 1 ? 1.7 : 1.02);
        if (bowed) stringsPad(t + i * chDur, cd + 0.6, 0.8, true);
        else organChord(t + i * chDur, cd, chords[i], 0.6);
      }
      dur = chDur * chords.length + 1.5;
      if (R.chance(C.meeting.row.bells)) {
        meetinghouseBell(t + dur * 0.7, isLast ? 1.0 : R.rnd(0.5, 0.8), R);
        if (C.meeting.activity === "jubilee" && R.chance(0.6)) {
          // a small peal for a festival Sunday
          for (var p = 1; p <= R.rint(2, 4); p++) meetinghouseBell(t + dur * 0.7 + p * R.rnd(1.4, 2.2), R.rnd(0.4, 0.7), R);
          dur += 5;
        }
      }
    }
    emitEvent({ type: "joint", last: !!isLast, toward: next, dur: dur, cat: "cadence", label: "∴ joint", detail: (isLast ? "meeting ends" : "toward " + next) + " · " + Math.round(dur) + "s" });
    return dur;
  }

  // ==========================================================================
  // THE CHORISTER'S BOOK — C's frozen interface (round 2, milestone 2)
  // ==========================================================================
  // C is this room's own: the plan, the section, the hymn's meter and verse,
  // the guests, the withheld tune. The other rooms read it ONLY through
  // these accessors (S.Meeting), so C can change its shape behind them — the
  // FORM crew will — without an edit in every voice. The object is frozen:
  // no room can add to it or rebind it. The one write the house makes is the
  // verse's walk (advanceVerse).
  //
  //   meetingNum()    this visit's meeting count, from 1
  //   activity()      the kind of Sunday: ordinary | fast | conference |
  //                   jubilee (null before the first meeting)
  //   sunday()        that kind's row of MEETINGS (silenceMul, hymns, bells,
  //                   choirSize, bright, meterW), or null
  //   section()       the rite now: prelude … postlude, or interlude
  //   sectionIndex()  its place in the plan;  plan() the plan's sections
  //   sectionDur()    its planned length, s (a guest, or a line the choir
  //                   is still singing, may hold it longer)
  //   jointing()      the section's time is up and its joint is sounding
  //                   (a voice that would begin a line waits for the next)
  //   meter()         the hymn's meter (CM, LM, SM, 87.87, CMD)
  //   verseLine()     where the hymn stands in its stanza; advanceVerse(k)
  //   cumulative()    the tune is withheld this meeting; assemblyFired()
  //                   it has been sung whole; withheld() the first and not
  //                   yet the second; assemblyUntil() when the assembly ends
  //   visitType()     the last guest that came (a guest is sounding while
  //                   S.inVisit()); visitLogged() whether the page may name it
  //   guests()        the guests drawn for this meeting, as plain rows
  //                   {type, section, at, dur, fired} (a copy: the harness
  //                   and the page to come read it; nothing writes through it)
  //   hymnId()        the hymn being sung (SCORE §3: h:<meeting>:<i>, the
  //                   i-th singing section of the meeting — hymns and the
  //                   doxology — counted from 1)
  //   seating()       the prelude's seating (its name, the waking, the
  //                   rests, the first chord, the hum, the lean); waking()
  //                   its entrances; lean(layer) the prelude's texture, a
  //                   factor on that voice's rests (1 outside a prelude)
  //   moment()        THE MOMENT: a plain object, the meeting at the music's
  //                   now — what the composers (Melody, Harmony) are handed
  //                   instead of the house:
  //                     { now, meeting, section, activity, bright, mode, F0,
  //                       seasonPos, arc, cumulative, assemblyFired, chord }
  //                   (chord is filled by the chord desk: the chord standing
  //                   at the time the caller names; null here)
  function moment() {
    var A = C.meeting ? C.meeting.row : null;
    return {
      now: now(), meeting: C.meetingNum, section: C.section,
      activity: C.meeting ? C.meeting.activity : null, bright: A ? A.bright : 0.5,
      mode: S.mode, F0: S.F0, seasonPos: seasonPos, arc: localArc(),
      cumulative: !!C.cumulative, assemblyFired: !!C.assemblyFired, chord: null,
    };
  }
  // the day's hymnal's row for a hymn id (THE DAY'S HYMNAL), or null
  function hymnalRow(id) {
    for (var i = 0; i < C.hymnal.length; i++) if (C.hymnal[i].id === id) return C.hymnal[i];
    return null;
  }
  // the rite's seating, as drawn (THE SEATINGS OF THE OTHER RITES, in the
  // plan): null for a hymn, the prelude (seated by its own) and the plain house
  function sceneNow() {
    var sc = C.scenes && C.scenes[C.si];
    return sc && sc.name !== "plain" && C.plan[C.si] && C.plan[C.si].type === C.section ? sc : null;
  }
  // THE COMPOSED HYMN's hands on the meeting (kolob-voices-choir.js, the
  // performer): the few writes a hymn makes, all through here
  function waitingGuest() {
    for (var i = 0; i < C.visitations.length; i++) {
      var V = C.visitations[i];
      if (!V.fired && !(CUED[V.type] || V.cued) && V.section === C.section) return V;
    }
    return null;
  }
  var HymnHands = {
    // is this performance still the section's? (a joint or a dev jump ends it)
    owns: function (id) { return !!C.hymn && C.hymn.id === id; },
    // the hymn's sound runs to at least t
    until: function (id, t) { if (C.hymn && C.hymn.id === id && t > C.hymn.until) C.hymn.until = t; },
    // the hymn's last chord is written: the joint waits for it, and a breath
    done: function (id, t) { if (C.hymn && C.hymn.id === id) { C.hymn.active = false; if (t > C.hymn.until) C.hymn.until = t; } },
    // the section's fuging (the die the section drew, round 2), still to come
    fugingPlanned: function () { return C.section === "hymn" && C.fugingPlanned && !C.fugingFired; },
    fuging: function (t, dur) { C.fugingFired = true; C.fugingUntil = t + dur; },
    // a guest seated in this section and not yet come: the hymn leaves it a
    // gap between two verses (the conductor's poll waits for the hymn) and
    // it arrives there — the span it keeps is returned (0: nobody came)
    guestWaiting: function () { var V = waitingGuest(); return V ? V.type : null; },
    guestInGap: function (t) {
      var V = waitingGuest();
      if (!V || !S.playing || C.jointing || inVisit()) return 0;
      arrive(V, t);
      return Math.max(0, C.visitUntil - t);
    },
    // the whole tune at last (the cumulative form): a composed doxology is
    // the assembly — its span told as the conductor's own assembly's was
    assemblyBegins: function (t, dur) {
      if (!C.cumulative || C.assemblyFired) return false;
      C.assemblyFired = true;
      C.assemblyUntil = t + dur;
      guestSpan("assembly", t, dur);
      return true;
    },
  };
  function hymnId() {
    var k = 0;
    for (var i = 0; i <= C.si && i < C.plan.length; i++) if (C.plan[i].type === "hymn" || C.plan[i].type === "doxology") k++;
    return "h:" + C.meetingNum + ":" + Math.max(1, k);
  }
  var Book = Object.freeze({
    meetingNum: function () { return C.meetingNum; },
    activity: function () { return C.meeting ? C.meeting.activity : null; },
    sunday: function () { return C.meeting ? C.meeting.row : null; },
    // (round 3b, step 4) the calendar's Sunday: its id (ordinary, fast,
    // conference, pioneer, christmas, easter, wedding, funeral, dedication),
    // its name in Deseret for the programme card (en: dev and Latin), its kind
    day: function () {
      if (!C.meeting) return null;
      var SD = Calendar() && C.meeting.sunday ? Calendar().SUNDAYS[C.meeting.sunday] : null;
      return { id: C.meeting.sunday || null, kind: C.meeting.activity, nameDs: SD ? SD.ds : null, nameEn: SD ? SD.en : null };
    },
    // the light of the rite now (0 night … 1 full daylight; the calendar's
    // arc), and of every rite of the plan
    light: function () { return C.plan[C.si] && C.plan[C.si].light != null ? C.plan[C.si].light : null; },
    lights: function () { return C.plan.map(function (s) { return s.light != null ? s.light : null; }); },
    // the rite's seating (round 3b, step 4 — THE SEATINGS below): its name
    // and what it asks of the house ({name, sits, lean, lined, fifths, hum,
    // forced}), or null (a hymn, the prelude, the plain house)
    scene: function () { return sceneNow(); },
    scenes: function () { return C.scenes ? C.scenes.map(function (x) { return x ? { name: x.name, empty: x.empty, forced: x.forced } : null; }) : null; },
    sits: function (layer) { var sc = sceneNow(); return !!(sc && sc.sits && sc.sits[layer]); },
    // the reckoning (round 3b, step 4): {planned, held (the switch off: the
    // drone at home), doxId, ok, from, cantus, why} once read, or null
    reckoning: function () { return C.reckoning ? JSON.parse(JSON.stringify(C.reckoning)) : null; },
    // (dev) the Hosanna's hook: {possible, built: false, die} on Easter and a dedication, else null
    hosanna: function () { return C.hosanna ? JSON.parse(JSON.stringify(C.hosanna)) : null; },
    section: function () { return C.section; },
    sectionIndex: function () { return C.si; },
    sectionDur: function () { return C.sectionDur; },
    jointing: function () { return !!C.jointing; },
    plan: function () { return C.plan.map(function (s) { return s.type; }); },
    meter: function () { return C.meter; },
    verseLine: function () { return C.verseLine || 0; },
    advanceVerse: function (k) { C.verseLine = (C.verseLine || 0) + k; },
    cumulative: function () { return !!C.cumulative; },
    assemblyFired: function () { return !!C.assemblyFired; },
    withheld: function () { return !!C.cumulative && !C.assemblyFired; },
    assemblyUntil: function () { return C.assemblyUntil; },
    visitType: function () { return C.visitType; },
    visitLogged: function () { return C.visitLogged !== false; },
    guests: function () {
      return C.visitations.map(function (v) { return { type: v.type, section: v.section, at: v.at != null ? v.at : null, dur: v.dur != null ? v.dur : null, fired: !!v.fired }; });
    },
    // the prelude's seating (THE PRELUDE'S SEATING): its name, the waking's
    // entrances (s after the downbeat), whether the first chord is full, who
    // sits the prelude out, and whether the strings keep to bare fifths
    seating: function () { return C.seating || null; },
    waking: function () { return C.seating ? C.seating.at : null; },
    // the prelude's texture (THE PRELUDE'S SEATING, its lean): a factor on
    // the named voice's rest between its turns while a prelude lasts — under
    // 1 it plays more, over 1 less; 1 in every other section
    // a planned fuging entry is near and not yet sung: the choir leaves its
    // window free (x 0.45–0.8 of a hymn)
    fugingNear: function () {
      if (C.section !== "hymn" || !C.fugingPlanned || C.fugingFired) return false;
      var x = localArc();
      return x >= 0.45 && x < 0.8;
    },
    lean: function (layer) {
      var L = C.section === "prelude" && C.seating ? C.seating.lean[layer] : null;
      // (round 3b, step 4: every other rite leans by its own seating)
      if (L == null && C.section !== "prelude") { var sc = sceneNow(); L = sc && sc.lean ? sc.lean[layer] : null; }
      return L > 0 ? L : 1;
    },
    hymnId: hymnId,
    moment: moment,
    // THE DAY'S HYMNAL (round 3): the house dialect, the day's hymns (a row
    // per singing section: id, dialect, key, meter, mode — a copy), the
    // hymn being sung ({id, dialect, key, active, until}, a copy; null when
    // none), and the performer's hands (above)
    house: function () { return C.house; },
    // the Sunday's ward (round 3b: kolob-cast.js's Ward, seated with the plan), or null
    ward: function () { return C.ward || null; },
    // the Sunday's organist (round 3b, step 2: kolob-organist.js's seat —
    // its style, its habits, its name, and the meeting's ledger, which the
    // organist's hands write as they play), or null
    organist: function () { return C.organist || null; },
    // the chorale prelude, when the morning was seated for it ({hymnId,
    // begun, until}, a copy), or null; choraleBegins(t0, until, what): the
    // organist has begun it — the house listens until `until`, the prelude
    // lasts long enough for it and a breath, and it is told
    chorale: function () { return C.chorale ? { hymnId: C.chorale.hymnId, begun: C.chorale.begun, until: C.chorale.until } : null; },
    choraleBegins: function (t0, until, what) {
      if (!C.chorale || C.chorale.begun) return;
      C.chorale.begun = true; C.chorale.until = until; C.chorale.plan = what || null;
      var need = until - C.sectionStart + CHORALE_AFTER_S;
      if (C.section === "prelude" && need > C.sectionDur) { C.sectionDur = need; if (C.plan[0] && C.plan[0].type === "prelude") C.plan[0].dur = need; }
      emitEvent({ type: "chorale-prelude", hymnId: C.chorale.hymnId, t0: t0, until: until, style: what ? what.style : null, manner: what ? what.manner : null,
                  cat: "organist", label: "♫ the chorale prelude", detail: (what ? what.style + " · " + what.manner + " · " : "") + (until - t0).toFixed(1) + " s" });
    },
    hymnal: function () { return C.hymnal.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; }); },
    hymn: function () { return C.hymn ? { id: C.hymn.id, dialect: C.hymn.dialect, key: C.hymn.key, active: C.hymn.active, from: C.hymn.from, until: C.hymn.until } : null; },
    // (round 3b, step 3) the day's forms (a copy) and the doxology's one
    // payoff; the refrain's statement that follows a hymn, if one does
    forms: function () { return C.forms ? JSON.parse(JSON.stringify({ round: C.forms.round, partner: C.forms.partner, refrain: C.forms.refrain, payoff: C.forms.payoff })) : null; },
    payoff: function () { return C.payoff || null; },
    refrainAfter: function (id) {
      if (!C.forms || !C.forms.refrain) return null;
      var st = C.forms.refrain.statements.filter(function (x) { return x.after === id; })[0];
      return st ? JSON.parse(JSON.stringify(st)) : null;
    },
    hymnSounding: hymnSounding,
    hands: HymnHands,
  });

  // ==========================================================================
  // THE CHORD DESK — the meeting's harmony, voiced, written, announced
  // ==========================================================================
  // The four-part engine (kolob-harmony.js) is pure: it voices a chord from
  // the chord the moment stands on and hands it back. The desk is where the
  // meeting uses it. Every call names the time its chord will sound, t; the
  // desk voices from the chord standing at t in the CHORD BOOK
  // (kolob-score.js) — not from whichever chord happened to be written
  // last — writes the new chord into the book at t, and announces it (the
  // harmony row, now with its time, its id and the whole voicing as sung).
  // The accompaniment asks the book the same question: at(t), the chord
  // standing when its note begins. So the organ, the harmonium, the strings
  // and the lean of the deacon's line follow the verse as it is sung, not
  // the last chord of the couplet the choir wrote half a minute ahead.
  //
  //   at(t), chordTones(t)          the chord standing at t (null if none)
  //   advance(opts, R, t, by, dur)  the next chord by the grammar, written at t
  //                                 (a singer's, by choir, names how long it
  //                                 is sung: dur)
  //   harmonize(line, R, t, beat, by)
  //                                 a line set under its tune, each chord
  //                                 written where it is sung (t + beats × beat)
  //   cadence(kind, R, t, by)       the two chords of a cadence, voiced from
  //                                 the chord at t; the CALLER writes each one
  //                                 at the time it sounds (its dice decide it)
  //   write(chord, t, by, dur)      into the book, and announced; a chord the
  //                                 choir sings (by choir, fuging, assembly)
  //                                 names how long it is sung, dur
  //   sungUntil()                   when the last chord the choir has written
  //                                 stops sounding — the joint waits for it
  //   voice(root7, opts, R, t)      a chord voiced and written nowhere (the
  //                                 rail's audition)
  //   reset()                       a clean page: a new meeting, a sunrise
  //                                 (and a PLAY after STOP, which is a new
  //                                 meeting: the stopped one's lines are
  //                                 shut outside and hold nothing)
  var Desk = (function () {
    var book = KOLOB.Score.chordBook();
    var fifths = 0;                   // parallel fifths sung: counted, reported — they should be > 0
    var sung = 0;                     // the end of the last chord the choir has written
    var SINGERS = { choir: true, fuging: true, assembly: true };
    function momentAt(t) { var m = moment(); m.chord = book.at(t); return m; }
    function write(chord, t, by, dur) {
      if (!chord) return null;
      book.write(chord, t, by);
      if (SINGERS[by] && dur > 0 && t + dur > sung) sung = t + dur;
      fifths += chord.fifths || 0;
      var v = chord.voicing;
      emitEvent({
        type: "chord",
        cat: "harmony",
        label: "♮ " + Harmony.ROMAN[chord.root] + (chord.open ? " open" : ""),
        detail: "b" + v[0] + " t" + v[1] + " a" + v[2] + " s" + v[3] + (fifths ? " · 5ths " + fifths : ""),
        // for the harness and the page to come (the minutes print no chord): when it sounds,
        // which chord it is, who wrote it, the voicing as sung
        at: t, chord: chord.id, by: by || "", page: book.page(), n: S.colN(),
        voicing: v.slice(), freqs: chord.freqs.slice(), pinned: !!chord.pinned, seat: chord.seat || 1,
      });
      return chord;
    }
    // (dur: how long a singer holds it — the humming seating's chords are
    // the choir's, and the joint and the organist wait for them)
    // THE HOUSE LEANS ON THE DRONE (round 3b, step 4: the reckoning). While
    // the drone stands on a cantus note that is not the keynote, a chord the
    // grammar draws that does not hold the drone's note is set instead on
    // the nearest root whose chord does — the house's harmony stands on the
    // drone, as a hymn's stands on a pedal, and never fights it (the rites
    // around the hymns; a composed hymn's own harmony is the composer's).
    function advance(opts, R, t, by, dur) {
      var mo = momentAt(t), ch = Harmony.advance(opts, mo, R), pc = dronePedalClass(t);
      if (pc != null && ch && !(Harmony.chordTones(ch) || {})[pc]) {
        var alt = pedalRoot(pc, ch.root);
        if (alt != null) { var ch2 = Harmony.voice(alt, opts, mo, R); if (ch2 && (Harmony.chordTones(ch2) || {})[pc]) ch = ch2; }
      }
      return write(ch, t, by || "organ", dur);
    }
    // the drone's note as a class of the day's collection (null: the
    // keynote, no reckoning, a note the day's mode does not hold, or a hymn
    // sounding — its harmony is its own)
    function dronePedalClass(t) {
      if (!S.droneNote || !C.reckoning || !C.reckoning.ok || C.reckoning.held || hymnSounding()) return null;
      var dn = S.droneNote();
      if (!dn || dn.role === "tonic" || t < dn.until) return null;
      var P = KOLOB.Pitch.tuning(S.mode, S.F0), c = ((1200 * Math.log2(dn.mul)) % 1200 + 1200) % 1200;
      for (var k = 0; k < P.ratios.length; k++) {
        var d = Math.abs(1200 * Math.log2(P.ratios[k]) - c);
        if (Math.min(d, 1200 - d) < 25) return k;
      }
      return null;
    }
    // the root nearest `from` (by steps of the scale, either way) whose triad
    // holds the class pc
    function pedalRoot(pc, from) {
      var P = KOLOB.Pitch.tuning(S.mode, S.F0), best = null;
      for (var r = 0; r < 7; r++) {
        var has = [0, 2, 4].some(function (iv) { return P.classOf(P.projDeg(r + iv)) === pc; });
        if (!has) continue;
        var d = Math.min((r - from + 7) % 7, (from - r + 7) % 7);
        if (best == null || d < best.d || (d === best.d && r < best.r)) best = { r: r, d: d };
      }
      return best ? best.r : null;
    }
    function harmonize(lineNotes, R, t, beat, by) {
      var hz = Harmony.harmonize(lineNotes, momentAt(t), R);
      var at = t;
      for (var i = 0; i < hz.length; i++) { write(hz[i].chord, at, by || "choir", hz[i].dur * beat); at += hz[i].dur * beat; }
      return hz;
    }
    function cadence(kind, R, t, by) {
      var chords = Harmony.cadence(kind, momentAt(t), R);
      kind = kind || "plagal";
      // (SCORE §6's cadence: its kind, who closes with it, when; the hymn's
      // id while a hymn is sung)
      var sec = C.section;
      emitEvent({ type: "cadence", kind: kind, by: by || "", at: t, hymnId: sec === "hymn" || sec === "doxology" ? hymnId() : null,
                  cat: "harmony", label: "∴ " + kind + " cadence", detail: kind === "half" ? "resting on the dominant" : "amen" });
      return chords;
    }
    function voice(root7, opts, R, t) { return Harmony.voice(root7, opts, momentAt(t), R); }
    return {
      at: function (t) { return book.at(t); },
      chordTones: function (t) { return Harmony.chordTones(book.at(t)); },
      advance: advance, harmonize: harmonize, cadence: cadence, write: write, voice: voice, pedalClass: dronePedalClass,
      sungUntil: function () { return sung; },
      reset: function () { book.reset(); sung = 0; },
      fifthCount: function () { return fifths; },
      pageNumber: function () { return book.page(); },
    };
  })();

  // the motif engine speaks through the clerk's minutes
  Motif.setLog(function (ev) { return emitEvent(ev); });

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  // A new seed is a new visit: the meeting count and the seasons start again.
  function resetVisit() { C.meetingNum = 0; seasonPos = 0; }

  S.MEETINGS = MEETINGS;
  S.Meeting = Book;
  S.moment = moment;
  S.Harmony = Desk;
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
  S.hallListens = hallListens;
  S.silenceMul = silenceMul;
  S.gapMul = gapMul;
  S.conductorTick = conductorTick;
  S.skipToSection = skipToSection;
  S.UNLOGGED_GUESTS = UNLOGGED;
  // the room's public face on the KOLOB namespace
  // (dawnChorale: the trombones' material as the plan writes it — for the
  // harness, which proves what the choir is handed)
  // (CALENDAR and F0_RANGE are read by the harness; F0_RANGE is writable for
  // the compass check, which sings every voice at both ends of the keynote)
  KOLOB.Meeting = { MEETINGS: MEETINGS, book: Book, desk: Desk, planMeeting: planMeeting, conductorTick: conductorTick, runJoint: runJoint, dawnChorale: dawnChorale,
                    CALENDAR: CALENDAR, F0_RANGE: F0_RANGE };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-meeting.js"] = true;   // the load guard's roll call
})();
