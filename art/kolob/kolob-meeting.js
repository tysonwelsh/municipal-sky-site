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
  function singHymn(h, row, t) { return S.singHymn(h, row, t); }
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
  var CALENDAR = [["ordinary", 0.52], ["fast", 0.15], ["conference", 0.19], ["jubilee", 0.14]];
  var SEASON_OF = { fast: [0, 0.35], ordinary: [0.2, 0.7], conference: [0.5, 0.9], jubilee: [0.7, 1] };
  var seasonPos = 0;
  var F0_RANGE = [52, 78];       // the keynote's window, Hz of F0 (see THE KEYNOTE in planMeeting)

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
    var activity = R.pickW(CALENDAR);
    var sr = SEASON_OF[activity];
    seasonPos = sr[0] + (sr[1] - sr[0]) * seasonDie;               // 0 the fast-day trough … 1 the festival
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
    Desk.reset();                   // a new tuning: a clean page in the chord book

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
    C.visitLogged = true;
    // THE QUESTION IS SHELVED (owner, 2026-09-27: "one of the less interesting
    // guests… there's better stuff we could be focusing on"). Its code stays
    // in kolob-guests.js; it simply never seats. Its dice are still thrown
    // below, so every other draw of the meeting falls exactly where it did.
    // The forcing switch no longer offers it.
    var SHELVED_GUESTS = { question: true };
    // (the switch draws its guest; a dev who names one — the harness, a
    // lab — gets that one, and the die is thrown all the same)
    var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true };
    var forcedPick = pickWith(forcedDie, [["bands", 2], ["steeples", 1], ["oldtune", 1], ["trombones", 1]]);
    var forcedType = forceVisitation ? (FORCEABLE[forceVisitation] ? forceVisitation : forcedPick) : null;
    // the trombones asked for by name keep the prelude for themselves, and no
    // band crosses their morning (the guests who would have sat there take
    // their other seats; the dice are thrown as ever)
    var dawnAsked = forcedType === "trombones";
    var haveSec = {};
    for (var vp = 0; vp < plan.length; vp++) haveSec[plan[vp].type] = true;
    function seatIn(prefs) {
      for (var sp = 0; sp < prefs.length; sp++) if (haveSec[prefs[sp]] && !(dawnAsked && prefs[sp] === "prelude")) return prefs[sp];
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
      var stSeat = forcedType === "steeples" ? "prelude" : (stSeatDie && !dawnAsked ? "prelude" : "postlude");
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
      tbInfo = { n: C.meetingNum, kind: activity, sunday: null, sections: plan, guests: C.visitations, force: dawnAsked };
      var tbSeat = TB.plan(tbInfo, tbStream);
      if (tbSeat) C.visitations.push({ type: "trombones", section: "prelude", at: tbSeat.at, dur: tbSeat.dur, fired: false, stream: tbStream });
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
    if (C.visitations.length) emitEvent({
      type: "guests-drawn", guests: C.visitations.map(function (v) { return { guest: v.type, section: v.section }; }),
      cat: "visitation-draw", label: C.visitations.map(function (v) { return v.type + "@" + v.section; }).join(","),
    });
    // THE RASPBERRY AMEN — its own flag, not a seated visitation: it has no
    // section, only the meeting's final cadence. Never on a fast Sunday; a
    // solemn meeting does not end on a joke.
    C.raspberry = forceRaspberry || (activity !== "fast" && razzDie);
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
    var HY = Hymnal() && KOLOB.Composer ? Hymnal() : null;
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
    // THE DAY'S HYMNAL (round 3; PLAN-COMPOSITION §3, §3.7, §4): the house
    // dialect, and for every singing section — each hymn and the doxology —
    // its own dialect (leaning to the house's) and key (leaning home), the
    // meter the plan drew, the day's mode, and the gesture its first line is
    // seeded from. The dice are hymnal:<n>'s; the hymns themselves are
    // written on hymn:<n>:<i> by the composer, ordered now and written off
    // the audio path (kolob-hymnal.js). The trombones' dawn keys the first
    // hymn at home: they play it before anyone has sung.
    C.house = null; C.hymnal = []; C.hymn = null;
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
        return { type: ps.type, meter: ps.meter || null, index: idx, mode: modeThen };
      });
      var day = HY.plan({
        n: C.meetingNum, kind: activity, mode: S.mode, seating: C.seating ? C.seating.name : null,
        sections: secs,
        trombones: !!dawn, cumulative: !!C.cumulative,
        theme: th ? th.notes.map(function (n) { return n.deg; }) : null,
        subs: subsM.map(function (m) { return m.notes.map(function (n) { return n.deg; }); }),
      }, stream("hymnal"));
      C.house = day.house;
      C.hymnal = day.rows;
      HY.prepare(S.visitSeed(), C.meetingNum, day.rows);
      if (dawn && day.rows.length) dawn.hymnId = day.rows[0].id;
      // (typed only, as new words are: SCORE §9.5)
      emitEvent({ type: "hymnal", house: C.house, hymns: day.rows.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, key: r.key, meter: r.meter }; }) });
    }
    emitEvent({
      type: "prelude-seating", n: C.meetingNum, seating: C.seating.name, under: C.seating.under, style: C.seating.style, at: C.seating.at, full: C.seating.full, spread: C.seating.spread,
      len: C.seating.len, preludeS: +plan[0].dur.toFixed(2), sits: Object.keys(C.seating.sits), lean: C.seating.lean, hum: C.seating.hum ? { n: C.seating.hum.n, s: C.seating.hum.s, at: C.seating.hum.at, until: C.seating.hum.until } : null,
      cat: "seating", label: "⌖ the prelude is seated", detail: C.seating.name + (C.seating.style ? " · " + C.seating.style : "") + (C.seating.under !== C.seating.name ? " (the morning after: " + C.seating.under + ")" : ""),
    });
    enterSection(0, t);
    // The Liahona: the load-bearing draws, surfaced as the oracle's pointing.
    emitEvent({
      type: "liahona", points: "day", mode: S.mode, kind: activity, f0: S.F0,
      cat: "liahona", label: "⌖ the Liahona points",
      detail: S.mode + " · " + activity + " · F0 " + S.F0.toFixed(1) + " Hz",
    });
    // (SCORE §6: the calendar's Sunday is FORM's, and not yet drawn — null
    // until it is; the house dialect is the day's hymnal's, above)
    emitEvent({
      type: "meeting-start", n: C.meetingNum, sunday: null, kind: activity, mode: S.mode,
      keynoteHz: S.F0 * S.ROOT_MULT, houseDialect: C.house, f0: S.F0, season: seasonPos,
      cat: "meeting", label: "☀ meeting " + C.meetingNum,
      detail: "F0 " + S.F0.toFixed(1) + " Hz · " + S.mode + " · " + activity + " · season " + seasonPos.toFixed(2),
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
    var under = pickWith(pickU, SEATING_ODDS), name = under, anchor = 0;
    var tb = visitationOf("trombones"), st = visitationOf("steeples");
    if (tb && tb.section === "prelude") { name = "trombones"; anchor = tb.at + tb.dur + 2; }
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
    };
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
      emitEvent({ type: "liahona", points: "meter", meter: C.meter, cat: "liahona", label: "⌖ the meter is given", detail: C.meter + " — " + METERS[C.meter].join(".") });
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
    emitEvent({
      type: "section-start", section: s.type, index: i, dur: s.dur, meter: s.type === "hymn" ? C.meter : null,
      cat: "section", label: "§ " + s.type.toUpperCase(), detail: (s.type === "hymn" ? C.meter + " · " : "") + Math.round(s.dur) + "s",
    });
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
        emitEvent({
          type: "hymn-announced", leaderDs: null,
          hymn: { id: composed.id, number: composed.number, nameDs: composed.nameDs, meter: composed.meter, dialect: composed.dialect,
                  authorDs: composed.hymnist ? composed.hymnist.nameDs : null, mode: composed.mode, key: row.key, keyMonzo: composed.keyMonzo.slice(),
                  form: composed.form, modeOfTime: composed.modeOfTime },
        });
        C.hymn = { id: composed.id, row: row, dialect: composed.dialect, key: row.key, active: true, from: t, until: t };
        var perf = singHymn(composed, row, t);
        if (perf && perf.end > t) C.sectionDur = s.dur = Math.max(s.dur, perf.end - t + perf.tail);
      } else {
        emitEvent({ type: "hymn-announced", hymn: { id: hymnId(), number: null, nameDs: null, meter: C.meter, dialect: null, authorDs: null }, leaderDs: null });
      }
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
      if (!V.fired && !(CUED[V.type] || V.cued) && V.section === C.section && x > 0.2 && x < 0.55 &&
          !C.jointing && !inHush() && !inFuging() && !inVisit() && !hymnSounding()) {
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
    if (C.section !== "sacrament" && C.section !== "testimony" && !C.jointing && !inHush() && !hymnSounding() && unbiddenDie) {
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
      cueAt("conductor", t + jointDur + 0.5, function (tn) {
        if (C.si >= C.plan.length - 1) planMeeting(tn);
        else enterSection(C.si + 1, tn);
      });
    }
    cueAt("conductor", t + 0.6, conductorTick);
  }

  // A GUEST ARRIVES at t: marked, its set piece placed, its span told (the
  // page's direction line names it while it sounds; the joint waits for it).
  // A guest the minutes may not name (UNLOGGED below) carries that on every
  // event and note it sends, and the page is never told it came.
  var VISIT_FN = { question: unansweredQuestion, bands: twoBandsCross, steeples: steeplesAnswer, oldtune: oldTuneRemembered, trombones: trombonesAtDawn };
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
    arrive(V, t);
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
  var LISTENED = { trombones: true };
  // …and while a composed hymn is sung (round 3): the ward and (in the
  // Tabernacle) the organ under it are the music; the house's own voices —
  // the organist's free chords, the harmonium, the strings, the clarinet —
  // speak around the hymn, not over it (PLAN-COMPOSITION §1.1: the motif
  // engine works AROUND the hymns), and come back when it is done
  function hallListens() { return (inVisit() && !!LISTENED[C.visitType]) || hymnSounding(); }

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
  function jointHeld() { return guestSounding() || (!!S.ctx && (now() < Desk.sungUntil() + CHOIR_BREATH_S || (!!C.hymn && (C.hymn.active || now() < C.hymn.until + CHOIR_BREATH_S)))); }
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
      if (R.chance(Math.max(MEETINGS[C.meeting.activity].bells, 0.6))) {
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
      // theirs, dominant to home, and the meeting too; the Old Way's house
      // keeps the amen for the meeting's end and closes between as often by
      // the dominant as by the amen (round 3: the plagal share follows the
      // house — round 2's joints were 82 % plagal on every Sunday)
      var kindDie = R.pickW([["plagal", 3], ["authentic", 2], ["half", 1]]);
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? kindDie : "plagal");
      if (C.house === "sacredharp") kind = isLast || kindDie !== "half" ? "authentic" : "half";
      else if (C.house === "oldway" && !isLast) kind = kindDie === "plagal" && C.section !== "doxology" ? "authentic" : kind;
      var chords = Desk.cadence(kind, R, t, "joint");
      var chDur = R.rnd(2.6, 3.6);
      // the brush arbor has no organ (THE PRELUDE'S SEATING): its amen is
      // bowed — the strings on each chord's bare fifth — and the organist is
      // first heard in the meeting that follows (round 2 of the polish: the
      // arbor's organ used to play the prelude's closing amen)
      var bowed = C.section === "prelude" && !!C.seating && !!C.seating.sits.organ;
      for (var i = 0; i < chords.length; i++) {
        Desk.write(chords[i], t + i * chDur, "joint");
        var cd = chDur * (i === chords.length - 1 ? 1.7 : 1.02);
        if (bowed) stringsPad(t + i * chDur, cd + 0.6, 0.8, true);
        else organChord(t + i * chDur, cd, chords[i], 0.6);
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
    var A = C.meeting ? MEETINGS[C.meeting.activity] : null;
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
    sunday: function () { return C.meeting ? MEETINGS[C.meeting.activity] : null; },
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
      return L > 0 ? L : 1;
    },
    hymnId: hymnId,
    moment: moment,
    // THE DAY'S HYMNAL (round 3): the house dialect, the day's hymns (a row
    // per singing section: id, dialect, key, meter, mode — a copy), the
    // hymn being sung ({id, dialect, key, active, until}, a copy; null when
    // none), and the performer's hands (above)
    house: function () { return C.house; },
    hymnal: function () { return C.hymnal.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; }); },
    hymn: function () { return C.hymn ? { id: C.hymn.id, dialect: C.hymn.dialect, key: C.hymn.key, active: C.hymn.active, from: C.hymn.from, until: C.hymn.until } : null; },
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
    function advance(opts, R, t, by, dur) { return write(Harmony.advance(opts, momentAt(t), R), t, by || "organ", dur); }
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
      advance: advance, harmonize: harmonize, cadence: cadence, write: write, voice: voice,
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
