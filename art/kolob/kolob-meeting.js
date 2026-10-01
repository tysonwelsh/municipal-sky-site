// ============================================================================
// KOLOB — kolob-meeting.js: the chorister
//
// The planner (planMeeting: the Sunday, the keynote, the mode, the order of
// service, the guests against one budget, the day's hymnal, the ward and its
// organist, the prelude's seating), the conductor's tick (sections, the
// stillness, the fuging entry, the guests' arrivals), the joints between
// sections and the reckoning at them, THE CHORISTER'S BOOK (S.Meeting: the
// meeting's own state C, which the other rooms read only through its frozen
// accessors, and which the composers receive as a MOMENT) and THE CHORD
// DESK (S.Harmony: the harmony the house sings, voiced, written into the
// chord book at its time and announced). A section does not turn over while
// a guest, or a line the choir has written, is still sounding.
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
  function cycle(lane, self, turn, t, fallbackS) { return S.cycle(lane, self, turn, t, fallbackS); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  // (the guests the meeting performs itself — the far ward inside our hymn,
  // the Hosanna, the testimony-bearers — report their notes too)
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
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
  // The meeting-activity axis: what kind of Sunday is it?
  var MEETINGS = {
    ordinary:   { silenceMul: 1.0, hymns: 2, bells: 0.5, choirSize: 3, bright: 0.5,  meterW: [["CM", 3], ["LM", 2], ["SM", 2], ["87.87", 2], ["CMD", 1]] },
    fast:       { silenceMul: 1.7, hymns: 1, bells: 0.2, choirSize: 2, bright: 0.3,  meterW: [["CM", 3], ["SM", 3], ["LM", 2], ["87.87", 1], ["CMD", 0.5]] },
    conference: { silenceMul: 0.75, hymns: 3, bells: 0.8, choirSize: 4, bright: 0.75, meterW: [["CMD", 3], ["87.87", 3], ["CM", 2], ["LM", 2], ["SM", 1]] },
    jubilee:    { silenceMul: 0.6, hymns: 3, bells: 1.0, choirSize: 4, bright: 0.9,  meterW: [["CMD", 3], ["87.87", 2.5], ["CM", 2], ["LM", 1.5], ["SM", 1]] },
  };
  // C, the conductor's state, lives three lifetimes. THE VISIT's:
  // meetingNum, from 1, begun again by resetVisit (a new seed). THE
  // MEETING's: meeting, plan, the guests (visitations, visitUntil,
  // visitType, visitSecond, visitLogged, budget, hosanna, hosannaStream,
  // testimony), the withheld tune (cumulative, assemblyFired,
  // assemblyUntil, payoff), raspberry, the seatings (seating, scenes,
  // chorale), the day's hymnal (house, hymnal, forms, reckoning), the
  // organist and the ward — resetMeetingState() is the one place they are
  // reset, as planMeeting begins, so nothing of the last meeting (one that
  // ran out or one stopped half-way) is read by the next; the plan then
  // fills them in. THE SECTION's: si, section, sectionStart, sectionDur,
  // jointing, fromLevel, the fuging (fugingPlanned, fugingFired,
  // fugingUntil) and hymn (the meeting's reset clears it too), written by
  // enterSection as each section begins, a meeting's first among them, and
  // the singing's verseLine and meter, written as a singing section begins
  // and read on from there. And the stillness's hold, hushUntil, is the
  // stillness's own (inHush, below).
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
  // the natural draw's odds — the ONE number; the page reads it through
  // KolobAudio.getCumulativeOdds() for the switch's text
  var CUMULATIVE_ODDS = 0.08;
  // THE CALENDAR (PLAN-COMPOSITION §7.1). Each meeting draws a Sunday of the
  // colony year at the calendar's own odds — there is no journey across
  // meetings, and the first visit is no trough of one (a meta-season that
  // began every visit at its fast-day bottom made meeting 1 a fast Sunday
  // 36 % of the time, not the plan's 15 %, and the lean Sunday, the plain
  // temper and the thinnest prelude came with it). The calendar's nine
  // Sundays (kolob-calendar.js) are drawn on one die at the plan's own
  // shares — ordinary 45 %, fast 15, General Conference 12, Pioneer Day 8,
  // Christmas 6, Easter 6, a wedding 4, a funeral 3, a dedication 1 — and
  // each belongs to one of the four kinds the house has always known (a
  // wedding and a funeral are ordinary meetings, a dedication a conference,
  // the three feasts jubilees), so the kinds fall out of it at ordinary 52,
  // fast 15, conference 13 and jubilee 20 %. (The owner's ruling on the
  // kinds' shares: ordinary 45–55, fast ~15, conference 15–20, jubilee
  // 10–15 — the Sundays' shares, summed by kind, run a little over it for
  // the jubilees.) The season is the Sunday's own warmth, placed inside its
  // kind by a die of its own: a fast Sunday runs low, a jubilee high, and
  // they overlap at the edges, as the kinds do. SEASON_OF is the kinds'
  // warmth, for every Sunday whose row carries no season of its own.
  var SEASON_OF = { fast: [0, 0.35], ordinary: [0.2, 0.7], conference: [0.5, 0.9], jubilee: [0.7, 1] };
  // (the calendar is required: every page that plays a meeting loads it
  // ahead of this room, on _engine.php's list, and tools/loadcheck.js fails
  // a list that does not)
  function Calendar() { return KOLOB.Calendar; }
  var seasonPos = 0;
  var F0_RANGE = [52, 78];       // the keynote's window, Hz of F0 (see THE KEYNOTE in planMeeting)

  // THE RECKONING'S ORDER (PLAN §7.2): what the desk needs to write the
  // doxology for the drone — the first doxology's row, and every section
  // before it with the key and the mode it is sung in (a hymn's own; the
  // other rites the day's keynote and the day's mode). null when the plan
  // has no doxology. The switch does not reach the desk: with it off the
  // doxology is written and kept exactly as with it on, and only the drone
  // stays home (§7.2's own fallback, "the cantus only for the key plan, with
  // no audible glide") — so the owner's A/B changes the drone and nothing
  // else. (With the switch also keeping the desk from the reckoning, 10 of
  // 14 Sundays sang another closing hymn.)
  function reckoningOn() { return !(KOLOB.Experimental && KOLOB.Experimental.isOn && !KOLOB.Experimental.isOn("reckoning")); }
  function reckoningInfo(plan, rows, CAL) {
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

  // THE MEETING'S STATE (C, above): every field a meeting owns, set to what
  // it is before anything is planned. The plan fills each in below; nothing
  // reads one between here and there, so a field the plan once cleared where
  // it was drawn reads the same, and one it cleared only on one road (the
  // reckoning, inside the day's hymnal) is clear on every road. It throws no
  // die. (The payoff is set from the withheld tune where that is drawn.)
  function resetMeetingState() {
    C.meeting = null; C.plan = [];
    C.visitations = []; C.visitUntil = 0; C.visitType = null; C.visitSecond = false; C.visitLogged = true;
    C.budget = { refused: [], reserved: null };
    C.hosanna = null; C.hosannaStream = null; C.testimony = null;
    C.cumulative = false; C.assemblyFired = false; C.assemblyUntil = 0; C.payoff = null;
    C.raspberry = false;
    C.seating = null; C.scenes = null; C.chorale = null;
    C.house = null; C.hymnal = []; C.hymn = null; C.forms = null; C.reckoning = null;
    C.organist = null; C.ward = null;
  }

  // THE PLAN — every die of the meeting is thrown from meeting:<n>, in one
  // fixed order, whether it is used or not (SCORE.md §3: a hymn not sung, a
  // guest refused, a switch that forces another guest in — none of them
  // shifts a die that follows). t is the downbeat or the joint that calls it.
  function planMeeting(t) {
    C.meetingNum++;
    resetMeetingState();
    // (the reckoning: a new meeting's drone stands on its keynote — a meeting
    // ends home, so this is a turn only after a dev jump or a STOP while the
    // drone stood off home; a new seed's drone is let go at the reseed)
    if (S.droneNote && S.droneTurn && S.droneNote().mul !== 1) S.droneTurn(t, [0, 0, 0, 0], 3, "tonic", null);
    var R = stream("meeting");
    // (the first die is the old cosine's period, thrown still so that every
    // die after it lands where it did; the second places the season)
    R.rnd(4, 7);
    var seasonDie = R.rnd(0, 0.3) / 0.3;

    // THE KEYNOTE — the day's fundamental, a seven-semitone window (A♭3 to
    // E♭4 at the keynote, F0·4; F0 52–78 Hz). A narrower window (58–74 Hz,
    // 4.2 semitones) left 43 % of pairs of visits with keynotes the ear
    // could not tell apart. Every voice was sung at both ends of this one
    // before it was set (a compass check: six seeds × 20 minutes at each
    // end): the choir's basses keep their 5th percentile at D♯2 and its
    // sopranos their 95th at G5, the trombones stay in their compass (the
    // guest places its octave), and every voice moves by the semitone or
    // two the window grew and no further. (The band's cornet already stood
    // above its compass at 74 Hz — p95 G6 — and is a semitone higher at 78:
    // a known edge.)
    S.F0 = R.rnd(F0_RANGE[0], F0_RANGE[1]);
    // THE SUNDAY (PLAN §7.1): the day of the colony year, from the die that
    // once drew the kind alone — and the kind from the Sunday
    var CAL = Calendar(), dayU = R.next();
    var sunday = CAL.draw(dayU);
    var activity = CAL.kindOf(sunday);
    var SUN = CAL.SUNDAYS[sunday];
    var sr = SUN && SUN.season ? SUN.season : SEASON_OF[activity];
    seasonPos = sr[0] + (sr[1] - sr[0]) * seasonDie;               // 0 the fast-day trough … 1 the festival
    // the kind's row with the Sunday laid over it (how many hymns, how still,
    // how bright, how many bells): what S.Meeting.sunday() hands the voices
    var A = CAL.meetingRow(sunday, MEETINGS[activity]);
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
    Desk.reset(true);               // a new tuning: a clean page in the chord book, and the meeting's count of fifths

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
    // THE ARC OF LIGHT (PLAN §7.3): each rite's light, from
    // dawn to full daylight and evening, the Sunday's own (a funeral's dawn
    // darker, its morning climbing late) — read by the hymnal (each hymn's
    // dialect), the organ (its stops) and the meeting's intensity
    for (var li0 = 0; li0 < plan.length; li0++) plan[li0].light = CAL.light(plan, li0, sunday);
    // the guests' dice — each guest keeps its own die, as before, and all are
    // thrown every meeting
    // (THE GUESTS' ODDS are one table, the calendar's GUEST_ODDS, read for
    // this Sunday — for the dice the plan throws itself, here, and
    // handed to every guest's own room as info.odds. A changed number moves
    // no die: each chance is one draw, whatever it is read against)
    function oddsOf(g, dflt) { var o = CAL.guestOdds(g, sunday); return o != null ? o : dflt; }
    var forcedDie = R.rnd(0, 1);
    var qDie = R.chance(0.29), qSeatDie = R.chance(0.7);
    // DICE: the Question's — shelved (the owner, 2026-09-27: "one of the less
    // interesting guests… there's better stuff we could be focusing on"; its
    // set piece is shelved/kolob-question-setpiece.js) — thrown and never
    // read, so every later draw lands where it did
    void qDie; void qSeatDie;
    // (the band plans itself, on guest:bands:<n>: these two are thrown, unused)
    var bDie = R.chance(oddsOf("bands", 0.36)), bSeatDie = R.chance(0.7);
    void bDie; void bSeatDie;   // DICE: thrown and never read, so every later draw lands where it did
    var stDie = R.chance(oddsOf("steeples", 0.075)), stSeatDie = R.chance(0.55);
    var oDie = R.chance(oddsOf("oldtune", 0.15)), oSeatDie = R.chance(0.65), oTuneDie = R.rnd(0, 1);
    var cumDie = R.chance(CUMULATIVE_ODDS);
    var razzDie = R.chance(0.05);
    // IVES VISITATIONS — guests in the meeting. Each rolls its OWN dice,
    // read against the calendar's odds for the Sunday (GUEST_ODDS: the
    // band's row is the owner's 36 %), and each is seated where its own room
    // or its seat list allows; the budget below decides who stays. The 𐐌𐐚𐐞
    // switch forces one guaranteed guest, seated early enough that the
    // guarantee is heard. (The Question's die, 29 %, is still thrown; it
    // never seats.)
    // (the switch draws its guest; a dev who names one — the harness, a
    // lab — gets that one, and the die is thrown all the same)
    // (every guest may be named — the handcart company, the
    // gulls, the variations, change ringing, the gift of tongues, the far
    // ward, the Hosanna (on its own Sundays only), the Social Hall and the
    // testimony-bearers; the switch's own pick gains the Ivesian ones — not
    // the Social Hall, the gift or the Hosanna, which are no Ives visitations)
    var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true, handbells: true, singingschool: true,
                      handcart: true, gulls: true, variations: true, changes: true, tongues: true, farward: true, hosanna: true, socialhall: true, testimony: true };
    var forcedPick = pickWith(forcedDie, [["bands", 2], ["steeples", 1], ["oldtune", 1], ["trombones", 1], ["handbells", 1],
                                          ["handcart", 1], ["gulls", 1], ["variations", 1], ["changes", 1], ["farward", 1]]);
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
    // THE GUEST BUDGET (PLAN §8, §8.13; the calendar's GUEST_BUDGET): two
    // guests a meeting at most, the Hosanna counted; one
    // showpiece (the organist's variations, the Social Hall, the Hosanna);
    // never two guests in the same or neighbouring rites, but the pairs the
    // Sunday allows. Each guest's own rules come first, in its own room; the
    // budget is asked last, and a guest it refuses is simply not seated (its
    // dice were thrown). The guests are asked in a fixed order (the calendar's
    // GUEST_BUDGET.order), which is also who yields when it is full. A guest
    // named by the switch is seated past the budget, and the others leave it
    // its place. (C.budget: who was refused, and why — the census reads it)
    var BUD = CAL.GUEST_BUDGET;
    function indexOfSec(type) { for (var q = 0; q < plan.length; q++) if (plan[q].type === type) return q; return -1; }
    function seatIndex(V) { return typeof V.index === "number" ? V.index : indexOfSec(V.section); }
    // (the switch's guest keeps its place until it is seated: change ringing
    // is the steeples'; the Hosanna's place is kept by its own reservation;
    // the testimony-bearers are no guest and keep none)
    var forcedSeat = forcedType === "changes" ? "steeples" : forcedType === "hosanna" || forcedType === "testimony" ? null : forcedType;
    function budgetRefuses(type, section, index, skip) {
      if (forcedSeat === type) return null;
      var others = C.visitations.filter(function (v) { return v !== skip; });
      var n = others.length + (C.budget.reserved && C.budget.reserved !== type ? 1 : 0) + (forcedSeat && !visitationOf(forcedSeat) ? 1 : 0);
      if (n >= BUD.max) return "the budget is full";
      if (BUD.showpieces[type] && (others.some(function (v) { return BUD.showpieces[v.type]; }) || (C.budget.reserved && BUD.showpieces[C.budget.reserved]) || (forcedSeat && BUD.showpieces[forcedSeat]))) return "the meeting has its showpiece";
      var at = typeof index === "number" ? index : indexOfSec(section);
      for (var q = 0; q < others.length; q++) {
        var vi = seatIndex(others[q]);
        if (vi >= 0 && at >= 0 && vi === at) return "in the " + others[q].type + "'s rite";
        if (vi >= 0 && at >= 0 && Math.abs(vi - at) === 1 && !CAL.neighboursMay(others[q].type, type, sunday)) return "beside the " + others[q].type;
      }
      return null;
    }
    function admit(V) {
      var why = budgetRefuses(V.type, V.section, V.index);
      if (why) { C.budget.refused.push({ guest: V.type, section: V.section, why: why }); return false; }
      C.visitations.push(V);
      return true;
    }
    // the guests seated so far as a guest's own room is told of them: each
    // with its rite's place in the plan (index: the far ward's hymn is not
    // the first hymn), less those the Sunday lets sit
    // beside `type` in a neighbouring rite (the band and the dance on
    // Pioneer Day) — the room would refuse them, and the budget has allowed it
    function seatedFor(type, section) {
      return C.visitations.map(function (v) { return { type: v.type, section: v.section, index: seatIndex(v) }; })
        .filter(function (g) { return !(type && CAL.neighboursMay(g.type, type, sunday) && g.section !== section); });
    }
    // a rite held at least `until` s for a guest seated in it
    function holdSection(type, until) {
      for (var hs = 0; hs < plan.length; hs++) if (plan[hs].type === type) { plan[hs].dur = Math.max(plan[hs].dur, until); break; }
    }
    // (the first seat of prefs the budget admits the guest to)
    function seatFree(type, prefs) {
      for (var sp = 0; sp < prefs.length; sp++) if (haveSec[prefs[sp]] && !(morningAsked && prefs[sp] === "prelude") && !budgetRefuses(type, prefs[sp])) return prefs[sp];
      return null;
    }
    // THE HOSANNA, asked first (PLAN §8.12): the rite of Easter and of a
    // dedication, at the last doxology's close, takes the meeting's
    // showpiece and one of its two places when it comes. Its plan is pure,
    // on its own stream: asked here whether it will come, and planned at its
    // hook below, once every other guest is known (whom it sits beside)
    var HOg = KOLOB.GuestHosanna || null, hoStream = stream("guest:hosanna");
    var hoOdds = oddsOf("hosanna", null);
    var hoAsk = HOg && SUN && SUN.hosanna ? HOg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: [], odds: hoOdds, force: forcedType === "hosanna" }, hoStream) : null;
    if (hoAsk) C.budget.reserved = "hosanna";
    // THE NAUVOO BRASS BAND (PLAN §8.2): kolob-guest-bands.js
    // decides, on guest:bands:<n> — the owner's 36 % and the Sunday's welcome
    // (the calendar's table), the section (the prelude or the postlude —
    // never while the ward sings, the owner's rule from v0.36.1), the moment,
    // which of the day's hymns it marches, and whether a second band comes.
    // It keeps its own time (cued): it strikes up over the gathering or the
    // going-out, and the house carries on — the collision is the piece.
    // (bDie and bSeatDie above are still
    // thrown, unused.) A handcart company asked for by name keeps the band
    // away, as the trombones asked for do: one procession a Sunday. So does
    // any guest the switch names that keeps a seat (else the band, asked
    // first, took the forced guest's rite or the one beside it); the
    // Hosanna and the bearers keep none, and let it march.
    var GBg = KOLOB.GuestBands || null;
    var bandYields = !!forcedSeat && forcedSeat !== "bands";
    if (GBg && !dawnAsked && !bandYields) {
      var bStream = stream("guest:bands");
      var bSeat = GBg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, odds: oddsOf("bands", null), force: forcedType === "bands" }, bStream);
      if (bSeat) admit({ type: "bands", section: bSeat.section, at: bSeat.at, dur: bSeat.dur, fired: false, cued: true, stream: bStream, pick: bSeat.pick, second: bSeat.second });
    }
    // the steeples: bells at the meeting's edges — the framing sections where
    // a bell has civic meaning (calling the valley in, ringing it home)
    // (change ringing asked for by name rings from the steeples' seat, the
    // prelude; the budget may send them to their other edge)
    var stAsked = forcedType === "steeples" || forcedType === "changes";
    if (stAsked || stDie) {
      var stFirst = stAsked ? "prelude" : (stSeatDie && !morningAsked ? "prelude" : "postlude");
      var stSeat = stAsked ? stFirst : seatFree("steeples", stFirst === "prelude" ? ["prelude", "postlude"] : ["postlude", "prelude"]);
      if (stSeat) admit({ type: "steeples", section: stSeat, fired: false });
      else C.budget.refused.push({ guest: "steeples", section: stFirst, why: budgetRefuses("steeples", stFirst) || "no edge free" });
    }
    // THE OLD TUNE — its own die, gated by the mode law (kolob-guests.js,
    // oldTuneCandidates): an Earth tune surfaces only on a Sunday of its own
    // colour — the minor tunes on dark Sundays, the major on bright ones —
    // and only where the day's tuning holds every note of the melody it
    // will sing. Seats where remembering belongs: the prelude's
    // pre-gathering reverie, or testimony. Never the sacrament.
    var oldPool = oldTuneCandidates();
    // (the first of its seats the budget admits it to)
    if (oldPool.length && (forcedType === "oldtune" || oDie)) {
      var oPrefs = forcedType === "oldtune" ? ["prelude", "testimony", "hymn"] : (oSeatDie ? ["prelude", "testimony"] : ["testimony", "interlude", "prelude"]);
      var oSeat = forcedType === "oldtune" ? seatIn(oPrefs) : seatFree("oldtune", oPrefs);
      if (oSeat) admit({ type: "oldtune", section: oSeat, fired: false, tune: pickWith(oTuneDie, oldPool) });
      else if (seatIn(oPrefs)) C.budget.refused.push({ guest: "oldtune", section: seatIn(oPrefs), why: budgetRefuses("oldtune", seatIn(oPrefs)) });
    }
    // THE TROMBONE CHOIR AT DAWN (PLAN-COMPOSITION §14, item 3 —
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
      tbInfo = { n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, odds: oddsOf("trombones", null), force: forcedType === "trombones" };
      var tbSeat = TB.plan(tbInfo, tbStream);
      if (tbSeat && forcedType !== "singingschool") admit({ type: "trombones", section: "prelude", at: tbSeat.at, dur: tbSeat.dur, fired: false, cued: true, stream: tbStream });
    }
    // THE SINGING SCHOOL (PLAN-COMPOSITION §15 item 3 —
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
      var ssSeat = SSg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, odds: oddsOf("singingschool", null),
                              experimental: KOLOB.Experimental ? KOLOB.Experimental.snapshot() : {}, force: forcedType === "singingschool" }, ssStream);
      if (ssSeat) admit({ type: "singingschool", section: "prelude", at: ssSeat.at, dur: ssSeat.dur, fired: false, cued: true, stream: ssStream, experimental: true });
    }
    // CUMULATIVE FORM (after Ives's cumulative settings): the day's theme is
    // WITHHELD — only its fragments circulate, endings first — until the
    // doxology sings it whole for the first time. Rarest of the guests
    // (~1 meeting in 12) because it is a meeting-SHAPE, not an event.
    // Governed by the 𐐐𐐄𐐢 pill: always / natural 8% / never. Set BEFORE
    // Motif.newMeeting() — the theme-length guard there reads the flag.
    C.cumulative = cumulativeMode === "always" || (cumulativeMode === "natural" && cumDie);
    // THE RASPBERRY AMEN — its own flag, not a seated visitation: it has no
    // section, only the meeting's final cadence. Never on a fast Sunday; a
    // solemn meeting does not end on a joke.
    C.raspberry = forceRaspberry || (activity !== "fast" && !(SUN && SUN.noRaspberry) && razzDie);
    Motif.newMeeting(moment(), stream("motif"));
    if (C.cumulative) {
      var wTheme = Motif.theme();
      emitEvent({
        type: "guest", guest: "assembly", stage: "withheld", logged: true, theme: wTheme ? wTheme.name : null,
      });
    }
    // The trombones' chorale. With the day's hymnal they play the day's
    // FIRST COMPOSED HYMN, which the composer writes off the audio path
    // (THE DAY'S HYMNAL, below): the chorale is taken up at their cue, a few
    // seconds into the prelude, and the prelude then yields to it
    // (cuedArrival). Without the hymnal — a lab that loads no composer — the
    // chorale is written now (dawnChorale: the day's theme poured into the
    // first hymn's meter and set by Harmony; its harmonizing paid here, not
    // in the clock's callback), and the prelude yields at once: it
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
    // THE DAY'S HYMNAL (PLAN-COMPOSITION §3, §3.7, §4): the house
    // dialect, and for every singing section — each hymn and the doxology —
    // its own dialect (leaning to the house's) and key (leaning home), the
    // meter the plan drew, the day's mode, and the gesture its first line is
    // seeded from. The dice are hymnal:<n>'s; the hymns themselves are
    // written on hymn:<n>:<i> by the composer, ordered now and written off
    // the audio path (kolob-hymnal.js). The trombones' dawn keys the first
    // hymn at home: they play it before anyone has sung.
    // (the doxology's payoff, set here and not with the meeting's reset: it
    // is read from the withheld tune, drawn above — its assembly, unless the
    // day's forms below give the doxology another)
    C.payoff = C.cumulative ? "assembly" : null;
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
      // THE DAY'S FORMS: a round, the partner hymn, the
      // wandering refrain — and the doxology's one payoff (kolob-hymnal.js
      // forms, on forms:<n>).
      var fm = HY.forms ? HY.forms({ n: C.meetingNum, kind: activity, sunday: sunday, cumulative: !!C.cumulative }, day.rows, stream("forms")) : null;
      C.forms = fm;
      if (fm && fm.payoff) C.payoff = fm.payoff;
      // THE KOLOB RECKONING (PLAN §7.2): the doxology is
      // written so that its opening can be the drone's cantus — the desk
      // writes it a few ways and keeps the first whose notes stand, one a
      // section, on the key of every section before it (the prelude's and
      // the other rites' the day's own, a hymn's its own), else falls back
      // to the doxology as the composer first wrote it and the drone on the
      // keynote (KOLOB.Experimental.reckoning; ?exp=-reckoning)
      // (the orders are posted once every guest and every rite's seating is
      // known — a still sacrament lets the cantus stand on any note of the
      // tune — below, still inside this plan)
      prep = { rows: day.rows, fm: fm };
      if (dawn && day.rows.length) dawn.hymnId = day.rows[0].id;
      // (typed only, as new words are: SCORE §9.5)
      emitEvent({ type: "hymnal", house: C.house, hymns: day.rows.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, key: r.key, meter: r.meter, piece: r.piece || (r.partnerOf ? "partner" : "hymn") }; }),
                  forms: fm ? { round: fm.round, partner: fm.partner, refrain: fm.refrain ? { id: fm.refrain.id, dialect: fm.refrain.dialect, after: fm.refrain.statements.map(function (x) { return x.after; }) } : null, payoff: fm.payoff, why: fm.dice.why } : null });
    }
    // THE ORGANIST AND THE WARD, SEATED BEFORE THE GUESTS THAT NEED THEM
    // (the variations are the Sunday's organist's; the gift of tongues'
    // singer is one of the day's testimony-bearers, always, because the
    // ward is seated first). Pure seatings on
    // cast:<n>'s forks, so seating them here moves no die; they are told
    // below, at THE WARD.
    var OR = KOLOB.Organist && S.castStream ? KOLOB.Organist : null;
    // (the Sunday leans the bench — a Victorian at a
    // conference, a wedding or a dedication, the plain organist at a fast or
    // a funeral — and seats as many of the ward you come to know as its
    // character asks: the fast Sunday three testimony-bearers, a dedication
    // every one of the optional roles, a funeral fewer)
    if (OR) C.organist = OR.seat(S.castStream(C.meetingNum), { kind: activity, sunday: sunday, lean: SUN ? SUN.organist : null, houseDialect: C.house, bright: A ? A.bright : 0.5, ives: !!S.forceVisitation });
    C.ward = KOLOB.Cast && S.castStream ? KOLOB.Cast.seat(S.castStream(C.meetingNum), { organist: C.organist ? C.organist.style : null, enthusiast: !!(C.forms && C.forms.refrain), size: SUN ? SUN.cast : null }) : null;
    if (C.organist && C.ward && C.ward.byId.organist) { C.organist.nameDs = C.ward.byId.organist.nameDs; C.organist.nameEn = C.ward.byId.organist.nameEn; }
    // (the practice rehearses the day's first hymn)
    if (school && C.hymnal.length) school.hymnId = C.hymnal[0].id;
    // THE WARD'S HANDBELL CHOIR (PLAN-COMPOSITION §15 item 5): about one
    // meeting in eight, eight to twelve ringers in a line
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
      var hbSeat = HBg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, odds: oddsOf("handbells", null), force: forcedType === "handbells" }, hbStream);
      if (hbSeat) {
        var hbRows = C.hymnal.filter(function (r) { return r.piece !== "round"; });
        var hbRow = hbSeat.seat === "postlude" ? hbRows[hbRows.length - 1] : hbRows[0];
        admit({ type: "handbells", section: hbSeat.seat, at: hbSeat.at, dur: hbSeat.dur, fired: false, cued: true, stream: hbStream,
                             hymnId: hbRow ? hbRow.id : null, piece: hbSeat.piece });
      }
    }
    // VARIATIONS ON A HYMN (PLAN §8.5): the Sunday's organist
    // takes one of the meeting's hymns through three to five characters, in
    // the prelude (the day's first hymn) or the postlude (one the ward has
    // sung) — kolob-guest-variations.js decides, on guest:variations:<n>,
    // told who is already seated (its die thrown whether or not the organ is
    // the pipes). The set is made ready off the clock, in the page's idle
    // time once its hymn is written (readyAhead, below: prepare measures
    // 12 ms at the median and 77 at worst), and its cue
    // holds the section. In the prelude it is the morning: the house waits
    // for the end of the set (variationsSeating), and no chorale prelude.
    var GVg = KOLOB.GuestVariations || null;
    if (GVg) {
      var gvStream = stream("guest:variations");
      var gvSeat = GVg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("variations"), odds: oddsOf("variations", null),
                              hymns: C.hymnal.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, piece: r.piece }; }),
                              organist: C.organist ? { style: C.organist.style } : null, withheld: !!C.cumulative,
                              organSits: !!(C.seating && (C.seating.sits.organ || C.seating.hum)), force: forcedType === "variations" }, gvStream);
      if (gvSeat && C.organist && S.pipeOn && S.pipeOn()) {
        var gvV = { type: "variations", section: gvSeat.seat, at: gvSeat.at, dur: gvSeat.dur, fired: false, cued: true, stream: gvStream, hymnId: gvSeat.hymnId };
        if (admit(gvV)) {
          if (gvSeat.seat === "prelude") C.seating = variationsSeating(C.seating, gvV);
          readyAhead(gvV, variationsMaterial);
        }
      }
    }
    // CHANGE RINGING (PLAN §8.3): when the steeples ring, some
    // Sundays the far bells are a band ringing changes — Plain Hunt or Plain
    // Bob from a far tower (kolob-guest-changes.js, on guest:changes:<n>, its
    // die thrown every meeting). A variant of the steeples, not a guest of
    // its own: the budget has already counted the steeples.
    var GCg = KOLOB.GuestChanges || null;
    if (GCg) {
      var gcStream = stream("guest:changes");
      var gcSeat = GCg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("changes"), odds: oddsOf("changes", null),
                              keynoteHz: S.F0 * S.ROOT_MULT, force: forcedType === "changes" }, gcStream);
      var stV = visitationOf("steeples");
      if (gcSeat && stV) { stV.stream = gcStream; stV.changes = { at: gcSeat.at, dur: gcSeat.dur, method: gcSeat.method }; }
    }
    // THE GIFT OF TONGUES (PLAN §8.6): in the testimony one of the
    // day's testimony-bearers rises and sings a free song in syllables no one
    // knows; the ward hums its last note, and the harmonium takes up its
    // opening (kolob-guest-tongues.js decides, on guest:tongues:<n> — most on
    // a fast Sunday and at a dedication; never in or beside another guest's
    // rite). The ward is seated above, so the singer is always a bearer. Its
    // song may seed the next hymn (THE GIFT'S SEED, where the orders go).
    var TGg = KOLOB.GuestTongues || null, tgV = null;
    if (TGg) {
      var tgStream = stream("guest:tongues");
      var tgSeat = TGg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, house: C.house, sections: plan, guests: seatedFor("tongues"), ward: C.ward || null,
                              odds: oddsOf("tongues", null), force: forcedType === "tongues" }, tgStream);
      if (tgSeat) {
        tgV = { type: "tongues", section: "testimony", at: tgSeat.at, dur: tgSeat.dur, fired: false, cued: true, stream: tgStream, seat: tgSeat,
                singer: C.ward && TGg.singerOf ? TGg.singerOf(tgSeat, C.ward) : null };
        if (!admit(tgV)) tgV = null;
        else holdSection("testimony", tgSeat.holdUntil);
      }
    }
    // THE FAR WARD (PLAN §8.8): a second congregation far across
    // the valley sings one of our hymns with us, a half to a whole line
    // behind, verse by verse, in its own tuning (kolob-guest-farward.js
    // decides, on guest:farward:<n>: a hymn, never the doxology, a round, a
    // lined hymn or the Primary's). It is hooked to the ward's own singing of
    // that hymn (kolob-voices-choir.js), not cued; its rite is the hymn's own
    // place in the plan (index), and the hymn is held for its last verse.
    var FWg = KOLOB.GuestFarWard || null;
    if (FWg && C.hymnal && C.hymnal.length) {
      var fwStream = stream("guest:farward");
      // (its rows name the rite by its place in the plan: the hymnal's index)
      var fwRows = C.hymnal.filter(function (r) { return r.index != null; }).map(function (r) { return { id: r.id, section: r.index, dialect: r.dialect, piece: r.piece || (r.partnerOf ? "partner" : null), kind: r.kind || null }; });
      var fwSeat = FWg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, hymnal: fwRows, guests: seatedFor("farward"),
                              odds: oddsOf("farward", null), force: forcedType === "farward" }, fwStream);
      if (fwSeat) admit({ type: "farward", section: fwSeat.section, index: fwSeat.sectionIndex, hymnId: fwSeat.hymnId, fired: false, stream: fwStream, seat: fwSeat, ofHymn: true });
    }
    // THE SOCIAL HALL (PLAN §8.9): after the benediction the
    // benches are pushed back — a fiddle, a caller, a reel or a jig made of
    // one of the day's hymns; it REPLACES THE POSTLUDE (the organ's voluntary
    // and the postlude's seating wait for it). Rare: Pioneer Day's, a
    // wedding's, a jubilee's; never at a funeral or on a fast Sunday; never
    // beside a guest but the band crossing the doxology on Pioneer Day
    // (kolob-guest-socialhall.js decides, on guest:socialhall:<n>; the Sunday
    // is always handed in: its funeral rule reads it). A showpiece.
    var SHg = KOLOB.GuestSocialHall || null;
    if (SHg) {
      var shStream = stream("guest:socialhall");
      var shSeat = SHg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("socialhall", "postlude"),
                              odds: oddsOf("socialhall", null), force: forcedType === "socialhall" }, shStream);
      if (shSeat && admit({ type: "socialhall", section: "postlude", at: shSeat.at, dur: shSeat.dur, fired: false, cued: true, stream: shStream, replaces: "postlude" })) {
        holdSection("postlude", shSeat.holdUntil);
        // (the room's own sounds — the floor, the claps, the benches — baked
        // once for the page's context in its idle time, off the clock: about
        // 45 ms, which the dance's first ticks would otherwise pay; asked
        // again when the timer comes, as readyAhead's poll is, so a STOP
        // inside the 2.5 s leaves the page idle — each kind is then baked
        // when first wanted, as before; a bake that throws is told, and the
        // same holds)
        if (SHg.bake && S.ctx && S.playing && typeof setTimeout !== "undefined") setTimeout(function () { if (S.ctx && S.playing) S.confess("the Social Hall's sounds could not be baked ahead (each is baked when first wanted)", function () { SHg.bake(S.ctx); }); }, 2500);
      }
    }
    // THE HANDCART COMPANY and THE GULLS (PLAN §8.11, §8.10):
    // asked last, so each sees every guest already seated (never with the
    // band, the handcarts; never in or beside another guest's rite, both;
    // never at a funeral, the gulls). Both keep their own time (cued); the
    // company's passage is exact at plan time (ALL IS WELL needs no
    // composer), and its section is held for it.
    var GHc = KOLOB.GuestHandcart || null, GGu = KOLOB.GuestGulls || null;
    if (GHc) {
      var hcStream = stream("guest:handcart");
      var hcSeat = GHc.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("handcart"), odds: oddsOf("handcart", null), force: forcedType === "handcart" }, hcStream);
      if (hcSeat && admit({ type: "handcart", section: hcSeat.section, at: hcSeat.at, dur: hcSeat.dur, fired: false, cued: true, stream: hcStream })) holdSection(hcSeat.section, hcSeat.holdUntil);
    }
    if (GGu) {
      var gStream = stream("guest:gulls");
      var gSeat = GGu.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("gulls"), odds: oddsOf("gulls", null), force: forcedType === "gulls" }, gStream);
      if (gSeat && admit({ type: "gulls", section: gSeat.section, at: gSeat.at, dur: gSeat.dur, fired: false, cued: true, stream: gStream })) holdSection(gSeat.section, gSeat.holdUntil);
    }
    // THE HOSANNA (PLAN §8.12 — Easter and a dedication only; AUDIO-ONLY and
    // UNLOGGED, the owner's ruling: no row in the minutes, no word on the
    // board, nothing on the staff — ENGRAVE_HYMN false). Asked above;
    // planned here, once every guest is known: it names whom it sits beside
    // and does not give way to them (GuestHosanna.YIELD false: the rite of
    // its Sunday, not a visitor the budget drew — a working rule the owner
    // has not ruled on). It comes
    // at the last doxology's close, after its hymn. Never pushed into
    // C.visitations: "guests-drawn" and the minutes must not name it.
    var hoSeat = hoAsk ? HOg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("hosanna"), odds: hoOdds, force: forcedType === "hosanna" }, hoStream) : null;
    if (!hoSeat) C.budget.reserved = null;
    C.hosanna = SUN && SUN.hosanna ? { possible: true, built: !!HOg, seat: hoSeat, fired: false, until: 0 } : null;
    C.hosannaStream = hoSeat ? hoStream : null;
    // THE TESTIMONY-BEARERS SPEAK (PLAN-COMPOSITION §5.2): the day's
    // testimony-bearers rise one by one and bear
    // testimony — a voice in speech, never in words, whose melody the
    // harmonium or the clarinet plays back and makes a tune of — and sit
    // down. Not guests: the testimony's own people, kept out of
    // C.visitations and the budget (no guest beside the testimony is refused
    // for them); a guest seated IN the testimony (the gift, the old tune)
    // keeps it for itself (kolob-testimony.js decides, on
    // guest:testimony:<n>). Cued as the testimony begins (enterSection).
    var TMg = KOLOB.Testimony || null;
    if (TMg && C.ward) {
      var tmStream = stream("guest:testimony");
      var tmSeat = TMg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                              bearers: (C.ward.roles.testimony || []).length || null, force: forcedType === "testimony" }, tmStream);
      if (tmSeat) { C.testimony = { seat: tmSeat, stream: tmStream, material: null, fired: false, until: 0 }; holdSection("testimony", tmSeat.holdUntil); }
    }
    if (C.visitations.length) emitEvent({
      type: "guests-drawn", guests: C.visitations.map(function (v) { return { guest: v.type, section: v.section, index: seatIndex(v) }; }),
    });
    // THE SEATINGS OF THE OTHER RITES (PLAN §7.4): the
    // invocation, an interlude, the testimony, the sacrament and the
    // postlude each draw how the house sits for them — the plain house,
    // lined out only, the brush arbor, an organ voluntary, the choir alone —
    // leaning by the Sunday, one die a rite on scenes:<n>, every die thrown;
    // and never two empty rites running (a hymn, the prelude and a rite a
    // guest is seated in are never empty). Drawn once every guest is seated.
    var scR = stream("scenes"), scs = CAL.scenes(plan, sunday, C.visitations, scR);
    C.scenes = scs.map(function (x, i) {
      if (!x.scene) return null;
      var spec = CAL.SCENES[x.scene], hum = null;
      if (spec.hum) { var hr = scR.fork("hum:" + i); hum = { n: hr.rint(spec.hum.n[0], spec.hum.n[1]), s: +hr.rnd(spec.hum.s[0], spec.hum.s[1]).toFixed(2) }; }
      return { name: x.scene, empty: !!x.empty, forced: !!x.forced, sits: spec.sits || {}, lean: spec.lean || {}, lined: !!spec.lined, fifths: !!spec.fifths,
               hum: hum, full: false, spread: "close" };
    });
    // THE DAY'S HYMNS ORDERED (the desk writes them off the audio path),
    // with the reckoning's order laid on the doxology's
    if (prep) {
      // THE GIFT'S SEED: a song received in
      // tongues may come back — its opening seeds the first line of the next
      // singing row after the testimony: a hymn whenever one follows it, the
      // doxology only when it has no other payoff (it carries the day's theme
      // home otherwise). Pure: the song's score on the gift's own stream.
      if (tgV && tgV.seat && tgV.seat.seeds && TGg.gesture && TGg.score) {
        tIdx = indexOfSec("testimony");
        var nextRow = null;
        for (var nr = 0; nr < prep.rows.length && !nextRow; nr++) if (prep.rows[nr].index != null && prep.rows[nr].index > tIdx) nextRow = prep.rows[nr];
        if (nextRow && nextRow.piece !== "round" && !nextRow.partnerOf && (nextRow.section === "hymn" || (nextRow.section === "doxology" && !C.payoff))) {
          var gest = TGg.gesture(TGg.score({ mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, house: C.house, part: tgV.seat.part }, tgV.stream, 0));
          if (gest && gest.length) { nextRow.gestures = gest; tgV.seeded = nextRow.id; }
        }
      }
      var rk = reckoningInfo(plan, prep.rows, CAL);
      // (held: the switch is off — the same doxology, the drone at home)
      if (rk) C.reckoning = { planned: true, held: !reckoningOn(), doxId: rk.doxId, sections: rk.sections.map(function (x) { return x.index; }), result: null };
      HY.prepare(S.visitSeed(), C.meetingNum, prep.rows, prep.fm, rk);
    }
    // THE WARD (PLAN-COMPOSITION §5): the Sunday's thirty-two and the
    // people among them — the chorister, the precentor, the soloist, and
    // three to five of the old bass, the harmony alto, the enthusiast, the
    // child and the newcomer; the testimony-bearers and the organist are
    // seated too. Pure seating on cast:<n> (kolob-cast.js); they sing every
    // hymn, and everything the choir sings around the hymns. Told with the
    // prelude's seating, by role, in Deseret.
    // THE ORGANIST (PLAN-COMPOSITION §5.2, §14 item 4, §15 item 2): the
    // Sunday's organist — the plain organist, the
    // Victorian or the improviser (kolob-organist.js seat: the kind of
    // Sunday, the house, the light and the Ives switch tilt the draw) — on
    // cast:<n>'s fork `organist`, seated first so that the ward's organist
    // (its name, its archetype) is the same person; the meeting's ledger
    // (hymns, fills, the one strange fill) is theirs.
    // (both are seated above, before the guests who need them — the
    // organist's variations and the gift of tongues' singer)
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
        guest: C.seating.name === "steeples" ? "the steeples" : C.seating.name === "school" ? "the singing school" : C.seating.name === "variations" ? "the organist's variations" : null, hum: !!C.seating.hum,
      });
      C.organist.preludeDraw = pd;
      if (pd.play) { C.seating = choraleSeating(C.seating); C.chorale = { hymnId: fh.id, begun: false, until: 0, plan: null }; }
    }
    var wardTold = C.ward ? { seated: 32, people: C.ward.individuals.map(function (id) { var m = C.ward.byId[id]; return { memberId: id, role: m.role, nameDs: m.nameDs, part: m.part }; }) } : null;
    var organistTold = C.organist ? { style: C.organist.style, nameDs: C.organist.nameDs, nameEn: C.organist.nameEn /* dev only, never rendered */, prelude: C.organist.preludeDraw ? { play: C.organist.preludeDraw.play, why: C.organist.preludeDraw.why, odds: C.organist.preludeDraw.odds } : null } : null;
    emitEvent({
      type: "prelude-seating", n: C.meetingNum, seating: C.seating.name, under: C.seating.under, style: C.seating.style, at: C.seating.at, full: C.seating.full, spread: C.seating.spread, ward: wardTold, organist: organistTold,
      len: C.seating.len, preludeS: +plan[0].dur.toFixed(2), sits: Object.keys(C.seating.sits), lean: C.seating.lean, hum: C.seating.hum ? { n: C.seating.hum.n, s: C.seating.hum.s, at: C.seating.hum.at, until: C.seating.hum.until } : null,
    });
    // THE CALENDAR, told once a meeting, typed only (the
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
    });
    // (SCORE §6: the calendar's Sunday and the house dialect, the day's
    // hymnal's, above; sundayDs the programme card's name)
    emitEvent({
      type: "meeting-start", n: C.meetingNum, sunday: sunday, kind: activity, mode: S.mode,
      keynoteHz: S.F0 * S.ROOT_MULT, houseDialect: C.house, f0: S.F0, season: seasonPos, sundayDs: SUN ? SUN.ds : null,
    });
  }

  // ==========================================================================
  // THE PRELUDE'S SEATING (PLAN-COMPOSITION §7.4; the owner: "prioritize
  // variation wherever we can"). One timetable for every visit — the drone
  // at 0:00.1 and the organ at 0:02.7 on 400 of 400 seeds, the field at
  // 0:16, the strings at 0:24, the harmonium, the clarinet, the tines and
  // the wire each at its fixed second — made every first minute the same,
  // and 358 of 400 first chords were a bare fifth. So each Sunday draws how
  // its morning is seated, on its own stream prelude:<n>
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
  // THE PRELUDE'S TEXTURE (lean): a seating that changed only who enters
  // when, and nothing after, left every Sunday the same texture three
  // minutes in; so each seating also leans the
  // whole prelude — how long each voice rests between its turns (a factor
  // on its drawn gap: under 1 it plays more, over 1 less), how often the
  // deacon tries a line and the parlor organ sets a chord, and which of the
  // valley's sounds come most. How hard it leans is drawn too (a lean of
  // 0.55–1 as an exponent on every factor), so two organ voluntaries are
  // not one texture. A guest's seating (trombones, steeples) leans the way
  // the Sunday would have been seated without it (the seating die still
  // names one: "under"), so the morning after the dawn is itself drawn.
  // And every Sunday has a hand of its own on top of its seating's (a
  // seating alone is nine textures, and two Sundays seated alike were
  // near-twins by three minutes in): each voice's rest is leaned by a
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
  // hymn (drawn, so even the grid it listens on is the Sunday's own; a
  // fixed 20 s put it on the same second every visit)
  var CHOIR_CALL = [12, 30];
  // the still voice's first call: it only listens for the invocation, on a
  // 7 s round (a fixed 12 s put its first phrase on the same second in one
  // visit of twelve; the grid is the Sunday's own)
  var VOICE_CALL = [5, 12];
  // lean: gap factors per layer; speak: the deacon's chance to try a line on
  // a prelude turn (0.45 outside a leaning seating); chord: the parlor
  // organ's chance to set a chord (0.55); field: weights on the valley's
  // sounds (the others 1); organDur: a factor on the organ's chord lengths.
  // w: the seating's odds. The organ voluntary is one of the house's
  // mornings at the same odds as the ground and the valley: drawn half
  // again as often as any other it was the commonest way a visit woke (a
  // quarter of first visits) and the likeliest pair of near-twins
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
    // (the singing school — the choir still practising as you arrive; the
    // house wakes after it, counted from the practice's end,
    // and the valley and the drone at their own times: it is morning outside)
    school:    { w: 0,   full: 0.45, anchored: HOUSE_WAKERS,
                 at: { drone: [0.5, 6], organ: [1, 5], ambient: [2, 30], strings: [4, 12], harmonium: [8, 18], clarinet: [10, 22], bells: [6, 40], telegraph: [8, 60] } },
    // (the organist's chorale prelude on the day's first hymn — seated over
    // the drawn morning when the organist's own die says
    // so, never drawn here: choraleSeating. anchored: counted from its end)
    chorale:   { w: 0,   full: 0.5,  anchored: { strings: true, harmonium: true, clarinet: true },
                 at: { drone: [0.3, 3], organ: [2.5, 7], ambient: [8, 26], bells: [30, 56], telegraph: [40, 76], strings: [4, 14], harmonium: [8, 20], clarinet: [10, 24] } },
  };
  var SEATING_ODDS = Object.keys(SEATINGS).filter(function (k) { return SEATINGS[k].w > 0; }).map(function (k) { return [k, SEATINGS[k].w]; });
  // (a morning the organist's variations keep is seated as the chorale
  // prelude's is — anything that looks the seating up by its name finds
  // one)
  SEATINGS.variations = SEATINGS.chorale;
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
    // (DICE: its die comes after the waking's, so every entrance above
    // falls where it did)
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
    var mLean = C.meeting && Calendar().SUNDAYS[C.meeting.sunday] ? Calendar().SUNDAYS[C.meeting.sunday].morning || {} : {};
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
  // THE CHORALE PRELUDE'S MORNING: the organist's
  // chorale prelude on the day's first hymn is one of the prelude's
  // seatings — seated like the guests' (the trombones', the steeples'),
  // over the one the Sunday drew, which keeps its texture, its length and
  // its manner for the rest of the prelude ("under"). The drone and the
  // valley wake around the organist; the house — the strings, the harmonium
  // and the deacon — is counted from the chorale's end (CHORALE_EST, its
  // likely length: the house also listens while the organist plays,
  // however long that proves to be). The same dice as the drawn morning.
  var CHORALE_EST = 44;
  var CHORALE_AFTER_S = 26;                      // the prelude goes on at least this long after the chorale (the house wakes into it)
  var SCHOOL_AFTER_S = 22;                       // …and after the singing school's practice
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
  // THE VARIATIONS' MORNING: as the chorale
  // prelude's — the drone and the valley wake around the organist, and the
  // house (the organ's own chords too) waits for the end of the set, at the
  // length its plan estimated (the set made ready is held to exactly, by its
  // cue)
  function variationsSeating(seat, V) {
    var spec = SEATINGS.chorale, U = seat._u.U, at = {}, after = V.at + V.dur + 2;
    WAKERS.concat(["choir"]).forEach(function (l) { var r = spec.at[l] || CHOIR_CALL; at[l] = r[0] + (r[1] - r[0]) * U[l]; });
    Object.keys(spec.anchored).concat(["organ"]).forEach(function (l) { if (at[l] != null) at[l] += after; });
    Object.keys(at).forEach(function (l) { at[l] = +at[l].toFixed(2); });
    at.voice = seat.at.voice;
    var out = {}; for (var k in seat) out[k] = seat[k];
    out.name = "variations"; out.at = at; out.full = seat._u.fullU < spec.full; out.sits = {}; out.fifths = false; out.hum = null;
    return out;
  }
  // MADE READY OFF THE CLOCK: a guest whose
  // material is dear to make — the variations' set, 12 ms of main thread at
  // the median and 77 at worst — is made ready in the page's idle time (a
  // timer of its own, never a cue of the clock), once its hymn is back from
  // the composer's desk. Only the material: its cue still holds the section,
  // so the meeting is the same whenever this lands; a cue that comes first
  // makes it ready itself (the old way). Pure, so either road makes the same.
  function readyAhead(V, make) {
    if (typeof setTimeout === "undefined") return;
    var n = C.meetingNum, tries = 0;
    function poll() {
      if (C.meetingNum !== n || V.fired || V.material || !S.playing) return;
      var HY = Hymnal();
      if (V.hymnId && HY && HY.ready && !HY.ready(V.hymnId)) { if (++tries < 240) setTimeout(poll, 250); return; }
      make(V, true);
    }
    setTimeout(poll, 50);
  }
  // THE VARIATIONS' MATERIAL: the hymn as the composer wrote it, the
  // Sunday's organist's set made ready (pure, on its own stream); at the cue
  // (not `ahead`), the section held for it exactly
  function variationsMaterial(V, ahead) {
    var G = KOLOB.GuestVariations, h = V.hymnId && Hymnal() ? Hymnal().get(V.hymnId) : null;
    if (!V.material) {
      if (!G || !h || !C.organist) return;
      try { V.material = G.prepare({ hymn: h, organist: C.organist, keynoteHz: S.F0 * S.ROOT_MULT, seat: V.section }, V.stream); }
      catch (e) { V.material = null; if (window.console) console.warn("Kolob: the variations could not be made ready:", e); return; }
    }
    if (ahead) return;
    V.dur = V.material.dur;
    var hold = (V.at || 0) + V.dur + 3;
    if (C.section === V.section) C.sectionDur = C.plan[C.si].dur = Math.max(C.sectionDur, hold);
  }

  function visitationOf(type) {
    for (var i = 0; i < C.visitations.length; i++) if (C.visitations[i].type === type) return C.visitations[i];
    return null;
  }
  // THE DAWN'S CHORALE — what the trombones play when no composed hymn is
  // to be had (a lab without the composer): the day's theme poured into
  // the first hymn's meter, one line
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
    // on the tonic; the owner heard a forced tonic close and ruled it open
    // (PLAN-COMPOSITION §15: "keep it open"). The morning is not over
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
    // its first line — the doxology too (else it walked on from wherever
    // the last hymn had stopped, and its Score opened at verse 1, or
    // mid-stanza with no verse-start at all)
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
      emitEvent({ type: "liahona", points: "meter", meter: C.meter });   // (a round's "meter" is its segments' lengths)
    }
    // the doxology SUNRISE: a dark-mode meeting may lift into major at the
    // last — rare, and the most audible surprise the engine owns
    if (s.type === "doxology" && (S.mode === "aeolian" || S.mode === "dorian") && sunriseDie) {
      S.mode = sunriseMode;
      rebuildScale();
      Desk.reset();                 // the new mode starts a clean page
      emitEvent({
        type: "sunrise", mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, f0: S.F0,
      });
    }
    var scn = C.scenes && C.scenes[i] ? C.scenes[i] : null;
    emitEvent({
      type: "section-start", section: s.type, index: i, dur: s.dur, meter: s.type === "hymn" ? C.meter : null,
      light: s.light != null ? s.light : null, scene: scn ? scn.name : null,
    });
    // the rite's seating, when it is not the plain house (typed only; the
    // minutes give it a row)
    if (scn && scn.name !== "plain") emitEvent({ type: "scene", section: s.type, index: i, scene: scn.name, forced: !!scn.forced, sits: Object.keys(scn.sits || {}), light: s.light != null ? s.light : null });
    // (and the voices it sits out let go of whatever they wrote before it
    // began — the joint's clarinet phrase, a chord of the strings — over
    // the house's release, as for a guest: else a phrase written in the
    // joint rang thirty seconds into the choir alone)
    if (scn && scn.sits && Object.keys(scn.sits).length && S.houseLetsGo) S.houseLetsGo(t, "the rite's seating: " + scn.name, true, scn.sits);
    // a singing section announces its hymn (SCORE §6): its number and its
    // Deseret name for the board, its meter, its dialect, and its hymnist's
    // name in Deseret — the composer's hymn, sung verse by verse
    // by the choir (THE COMPOSED HYMN, kolob-voices-choir.js), which now
    // owns the section's singing; the section lasts at least as long as the
    // hymn does. Without a composed hymn (no composer loaded, or one it could
    // not write) the choir walks the day's motifs through the meter, and
    // the board has nothing to give but the meter.
    if (s.type === "hymn" || s.type === "doxology") {
      if (composed) {
        // the ward's plan for it first (who keys it, who comes forward and
        // when), so the board can name them (THE WARD SINGS THE HYMN,
        // kolob-voices-choir.js)
        var pre = S.hymnPlan ? S.hymnPlan(composed, row) : null;
        emitEvent({
          type: "hymn-announced", leaderDs: pre ? pre.leaderDs : null, ward: pre ? pre.announce : null,
          hymn: { id: composed.id, number: composed.number, nameDs: composed.nameDs, meter: composed.meter, dialect: composed.dialect,
                  authorDs: composed.hymnist ? composed.hymnist.nameDs : null, mode: composed.mode, key: row.key, keyMonzo: composed.keyMonzo.slice(),
                  form: composed.form, modeOfTime: composed.modeOfTime },
        });
        C.hymn = { id: composed.id, row: row, dialect: composed.dialect, key: row.key, active: true, from: t, until: t };
        // (a hand-over that throws lets the hymn go at once — else C.hymn.active
        // stood for the rest of the visit, the joint held and the house
        // resting; once the performer has it, a link of its chain that throws
        // lets it go: kolob-voices-choir.js, A LINK THAT THROWS)
        var perf = null, taken = false;
        try { perf = singHymn(composed, row, t, pre); taken = true; } finally { if (!taken) HymnHands.done(composed.id, t); }
        if (perf && perf.end > t) C.sectionDur = s.dur = Math.max(s.dur, perf.end - t + perf.tail);
      } else {
        emitEvent({ type: "hymn-announced", hymn: { id: hymnId(), number: null, nameDs: null, meter: C.meter, dialect: null, authorDs: null }, leaderDs: null });
      }
    }
    // (the reckoning) a rite that is not a hymn begins on
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
      if (!(V.cued && V.section === s.type && !V.fired)) return;
      // (a guest whose material is made at its cue has it made a second
      // before, by a cue of its own — the band's march, the company,
      // the gulls, the dance: never one wake that makes it and plays it too)
      if (PRE_MADE[V.type] && (V.at || 0) >= 1.2) cueAt("guests", t + V.at - 1, function () { preMake(V, i); });
      cueAt("guests", t + (V.at || 0), function (tc) { cuedArrival(V, tc); });
    });
    // THE TESTIMONY-BEARERS: cued as the testimony begins, at the
    // moment their plan drew — not a guest, and asked nothing of the budget
    if (s.type === "testimony" && C.testimony && !C.testimony.fired) cueAt("guests", t + C.testimony.seat.at, testimonyBegins);
  }

  // (every clock below is the music's now: the cue's scheduled time)
  function localArc() {
    if (!S.ctx) return 0;
    return Math.max(0, Math.min(1, (now() - C.sectionStart) / C.sectionDur));
  }
  // Global intensity 0..1 — ceilings kept LOW. This is open country; even the
  // doxology's full gathering leaves sky above it.
  // THE ARC OF LIGHT (PLAN §7.3): every rite's curve is drawn from its
  // LIGHT (the calendar's arc, the Sunday's own — kolob-calendar.js), so
  // the same rite is fuller in full light and plainer at dawn (the second
  // hymn over the first, a funeral's invocation under an ordinary one's),
  // and a rite does not begin at its own level with a jump: its first
  // seconds are a crossfade from where the last rite ended (XFADE_S: a
  // tenth of the rite, eight seconds at the least, fourteen at the most).
  // At the arc's ordinary lights the curves sit where fixed ones per rite
  // would (the prelude
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
  // THE STILLNESS'S HOLD (stillness, below): the conductor begins nothing
  // in it — no guest's arrival, no fuging, no Hosanna, no testimony's or
  // unbidden stillness, and the assembly only at its fallback. It is the
  // drone's dip, and ends as the dip does: at its own time, at a dev jump,
  // or at STOP (meetingStop) — the hold ends with the meeting STOP ends, so
  // a PLAY inside it does not begin the next one hushed. A joint does not
  // end it, the last one neither: a stillness late in a postlude holds on
  // into the next meeting's first seconds, under the drone still dipped.
  function inHush() { return S.ctx && now() < C.hushUntil; }
  function inFuging() { return S.ctx && now() < C.fugingUntil; }
  function inVisit() { return S.ctx && now() < C.visitUntil; }
  // (the bands are a COLLISION — nobody sits out for them, that is the piece)
  function silenceMul() { return C.meeting && C.meeting.row ? C.meeting.row.silenceMul : 1; }
  // The airy multiplier applied to every phrase gap: wide at rest, still wide
  // at the peaks. The frontier never crowds.
  function gapMul() { return (2.2 - intensity() * 0.9) * silenceMul(); }

  // --- conductor poll: advances sections, fires fuging entries, keeps time ---
  // A cue every 0.6 s of the music. Its three dice (the stillness after a
  // gathering, the testimony's silence, the unbidden one) are thrown on every
  // tick, used or not. (Under the core's net, S.cycle, at its own pace: a
  // tick that throws before it has re-armed is re-armed by the core 0.6 s
  // later, as it would have re-armed itself, and the throw is reported — the
  // meeting goes on changing section.)
  function conductorTick(t) { return cycle("conductor", conductorTick, conductorTickTurn, t, 0.6); }
  function conductorTickTurn(t) {
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
      if (!V.fired && !V.cued && !V.ofHymn && V.section === C.section && x > 0.2 && x < 0.55 &&
          !C.jointing && !inHush() && !inFuging() && !inVisit() && !hymnSounding() && !choraleSounding()) {
        arrive(V, t);
        break;
      }
    }
    // The cumulative assembly: the withheld tune arrives in the doxology. A
    // hush or a guest may delay it; past x 0.7 the fallback fires regardless
    // (compressed) — the payoff is never skipped. It waits for a doxology
    // line the choir is still singing (the same choir sings it),
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
    // The fuging waits for a verse the choir is still singing: the same four
    // voices cannot go out one by one while they sing the couplet they
    // wrote half a minute ahead, and the convergence amen could land on a
    // chord of that couplet. The choir, for its part, begins no couplet
    // from x 0.45 while a planned fuging waits (fugingNear): else a hymn
    // whose window the verses happened to fill lost its fuging, and a hymn
    // was a meadow by collision rather than by its die — seed 1847 went 45
    // minutes without one. A meadow is the die's to decide (fugingDie, 40 %
    // of hymns).
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
    // joint (else the section turned over under a band in mid-crossing).
    // So does the choir: a couplet is written half a minute ahead, and the
    // organ's cadence waits until its last chord has been sung and the
    // congregation has drawn a breath (else the joint's amen, and the next
    // section's first chords, landed under a line still being sung).
    // THE HOSANNA (PLAN §8.12, the owner's ruling): at the close of
    // the last doxology — its hymn sung to its last chord, a band that
    // crossed it gone — the ward rises. Unlogged; it holds the section, so
    // the meeting's last joint waits for it.
    if (C.hosanna && C.hosanna.seat && !C.hosanna.fired && C.section === "doxology" && C.si === C.hosanna.seat.sectionIndex &&
        !C.jointing && !hymnSounding() && !guestSounding() && !choirSinging() && !inHush() && (C.hymn || x > 0.5)) {
      hosannaBegins(t);
    }
    if (!C.jointing && x >= 1 && !jointHeld()) {
      C.jointing = true;
      var last = C.si >= C.plan.length - 1;
      var jointDur = runJoint(last, t);
      if (!last) reckonTurn(t + 0.2, jointDur, C.si + 1);
      // (the joint is over when its continuation has run: enterSection lets
      // it go as it begins, and if a throw — in the next section's entrance,
      // or the next meeting's plan — came before it got there, the finally
      // does, and the clock reports the throw; else the meeting stayed in
      // its joint for the rest of the visit and began nothing more)
      cueAt("conductor", t + jointDur + 0.5, function (tn) {
        try {
          if (C.si >= C.plan.length - 1) planMeeting(tn);
          else enterSection(C.si + 1, tn);
        } finally { C.jointing = false; }
      });
    }
    cueAt("conductor", t + 0.6, conductorTick);
  }

  // THE RECKONING AT A JOINT (PLAN §7.2). As a joint
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
  var VISIT_FN = { bands: function (V, t) { return S.nauvooBand(V, t); }, steeples: steeplesAnswer, oldtune: oldTuneRemembered, trombones: trombonesAtDawn,
                   handbells: handbellsRing, singingschool: singingSchool,
                   // (every set piece is kolob-guests.js's — the far ward is not
                   // here: it sings inside the ward's own hymn; nor the
                   // Hosanna, which comes at the doxology's close, unlogged)
                   handcart: function (V, t) { return S.handcartCompany(V, t); }, gulls: function (V, t) { return S.gullsOver(V, t); },
                   variations: function (V, t) { return S.organistVariations(V, t); }, tongues: function (V, t) { return S.tonguesGift(V, t); },
                   socialhall: function (V, t) { return S.socialHall(V, t); } };
  function arrive(V, t) {
    V.fired = true;
    V.logged = !UNLOGGED[V.type];
    // THE HOUSE LETS GO (SCORE's guest rule): the
    // organ's chord, the strings' pad and the harmonium's and clarinet's
    // lines release over 1.5 s as the visitor comes in (kolob-core.js)
    S.houseLetsGo(t, V.type, V.logged);
    // type → set piece; each receives its visitation record (the old tune its
    // drawn tune, the trombones their stream and chorale)
    var vdur = VISIT_FN[V.type](V, t);
    C.visitType = V.type;
    C.visitLogged = V.logged;
    C.visitSecond = V.type === "bands" && !!V.second;   // (the page says "two bands" only when a second one comes)
    C.visitUntil = t + vdur;
    guestSpan(V.type, t, vdur, V.logged);
  }
  // THE GUESTS THAT KEEP THEIR OWN TIME (their record says cued: true) are
  // cued when their section begins (enterSection), at the moment their plan
  // drew, never found by the poll. The cue still asks: the guest's own
  // meeting, its section still standing (a dev jump may have left it), no
  // joint sounding, no other guest.
  // the guests made ready a second before their cue, and how
  var PRE_MADE = { bands: true, handcart: true, gulls: true, socialhall: true };
  function preMake(V, i) {
    if (!S.playing || V.fired || V.material || C.visitations.indexOf(V) < 0 || C.si !== i) return;
    if (V.type === "socialhall") standingMaterial(V); else outsideMaterial(V);
  }
  function cuedArrival(V, t) {
    if (!S.playing || V.fired || C.visitations.indexOf(V) < 0 || C.section !== V.section || C.jointing || inVisit()) return;
    if (V.type === "trombones" && !V.material) dawnFromHymnal(V);
    if ((V.type === "handbells" || V.type === "singingschool" || V.type === "socialhall") && !V.material) standingMaterial(V);
    // (the guests from outside, made ready a second before by a cue of
    // their own — outsideMaterial — else now; the
    // variations' set made ready in idle time, else now, and held for here)
    if ((V.type === "bands" || V.type === "handcart" || V.type === "gulls") && !V.material) outsideMaterial(V);
    if (V.type === "variations") variationsMaterial(V);
    arrive(V, t);
  }
  // THE FAR WARD IN OUR HYMN (PLAN §8.8):
  // the ward's hymn (kolob-voices-choir.js, singHymnWard) asks as it begins
  // whether a far ward sings it with us. If so, it is made ready then (pure,
  // 0–5 ms) and staged on the wide send — twenty-four throats of its own,
  // across the valley — and the ward's desk tells it each verse as it writes
  // it (PREP_S ahead), the A-men, and the end. Its span is told from its
  // first verse to its last note (one minutes row), and the hymn is held for
  // its last line and a breath. It never plays with the organ: another
  // ward, unaccompanied.
  function farWardFor(h, nVerses) {
    var FW = KOLOB.GuestFarWard, V = null;
    for (var i = 0; i < C.visitations.length; i++) { var x = C.visitations[i]; if (x.type === "farward" && x.hymnId === h.id && !x.fired) V = x; }
    if (!FW || !V || C.si !== V.index || !S.ctx || !S.playing) return null;
    V.fired = true; V.meetingNum = C.meetingNum; V.logged = !UNLOGGED.farward;
    var n = C.meetingNum, sec = C.section;
    function live() { return !!S.playing && C.meetingNum === n && C.visitations.indexOf(V) >= 0; }
    try {
      V.prepared = FW.prepare({ hymn: h, keynoteHz: S.F0 * S.ROOT_MULT }, V.stream);
      V.stage = FW.stage(S.ctx, S.wideSend(), V.prepared, V.stream, {
        defer: function (at, fn) { cueAt("guests", at, function () { if (live()) fn(); }); },
        onNote: function (nt) { emitNote("farward", nt.freq, nt.t, nt.dur, { part: nt.part, deg: nt.deg, cents: nt.cents, verse: nt.verse, line: nt.line, hymnId: h.id, guest: "farward", logged: V.logged }); },
      });
    } catch (e) { if (window.console) console.warn("Kolob: the far ward could not be made ready:", e); return null; }
    V.joined = FW.versesJoined(V.seat.from, nVerses);
    var last = 0, told = false;
    function hold(t1) { last = Math.max(last, t1); return last + 2; }
    return {
      verse: function (v, tv, beatS) {
        if (V.joined.indexOf(v) < 0) return 0;
        var r = V.stage.verse(v, tv, beatS, V.joined.length);
        if (!told) {
          told = true;
          emitEvent({ type: "guest-start", guest: "farward", section: sec, until: r.t1, logged: V.logged });
          emitEvent({ type: "guest", guest: "farward", stage: "verse", section: sec, hymnId: h.id, logged: V.logged });
        }
        return hold(r.t1);
      },
      amen: function (ta, beatS) { return told ? hold(V.stage.amen(ta, beatS)) : 0; },
      close: function (te) {
        if (!told) return 0;
        V.stage.close(te);
        cueAt("conductor", Math.max(te, last + 0.5), function () { emitEvent({ type: "guest-end", guest: "farward", section: sec, logged: V.logged }); });
        return last + 2;
      },
    };
  }
  // THE HOSANNA'S PERFORMANCE: the shout
  // three times as a crowd of raised voices, the amens, then ASSEMBLY — "The
  // Spirit of God" — by the full ward and the full organ, the chorus's
  // Hosanna on the shout's syllables. AUDIO-ONLY AND UNLOGGED: every note
  // and the span say logged: false and name the Hosanna, so the minutes
  // write no row, the board no word, the staff no note (ENGRAVE_HYMN false);
  // no hymn-announced, no verse-start (it sings ASSEMBLY itself, not through
  // the hymn board). The house lets go and listens; the drone stays home.
  function hosannaBegins(t) {
    var H = C.hosanna, G = KOLOB.GuestHosanna;
    H.fired = true;
    if (!G || !S.ctx || !C.hosannaStream) return;
    var n = C.meetingNum, end;
    S.houseLetsGo(t, "hosanna", false);
    try {
      end = G.perform(S.ctx, S.seatedSend("choir"), t, { keynoteHz: S.F0 * S.ROOT_MULT, ward: C.ward, sunday: C.meeting ? C.meeting.sunday : null }, C.hosannaStream, {
        defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C.meetingNum === n) fn(); }); },
        organDest: S.seatedSend("organ"),
        onStage: function () { /* nothing is told */ },
        onNote: function (x) {
          emitNote(x.layer, x.freq, x.t, x.dur, { part: x.part, hymnId: x.hymnId, line: x.line, beat: x.beat, deg: x.deg, monzo: x.monzo, hosanna: true,
                                                  engrave: !!x.engrave, guest: "hosanna", logged: false });
        },
      });
    } catch (e) { if (window.console) console.warn("Kolob: the Hosanna could not be sung:", e); return; }
    guestSpan("hosanna", t, end - t, false);
    C.visitType = "hosanna"; C.visitLogged = false; C.visitUntil = end;
    C.sectionDur = Math.max(C.sectionDur, end - C.sectionStart + 3);
    H.until = end;
  }
  // THE TESTIMONY-BEARERS SPEAK: as the first bearer rises the house lets
  // go (else its strings and organ rang on under the first speaker for up
  // to 30 s), and it
  // listens while they speak (testimonySounding); each rises, bears
  // testimony — a speech-melody the harmonium or the clarinet plays back and
  // makes a tune of — and sits down. In the house's own key (the keynote,
  // the day's mode), so an answer posts to the motif engine as it stands;
  // the reed never rubs a second against the drone where the reckoning has
  // stood it. Their seats are guests' seats of their own depth (speaker,
  // reed), not the house's layers.
  function testimonyBegins(tc) {
    var T = C.testimony;
    if (!T || T.fired || C.section !== "testimony" || !S.playing || !KOLOB.Testimony || !KOLOB.VoicesVocal) return;
    T.fired = true;
    if (S.houseLetsGo) S.houseLetsGo(tc, "testimony", true);
    try {
      T.material = KOLOB.Testimony.prepare({ ward: C.ward, keynoteHz: S.F0 * S.ROOT_MULT, keyMonzo: [0, 0, 0, 0], mode: S.mode, sunday: C.meeting ? C.meeting.sunday : null,
                                             silenceMul: silenceMul(), droneMonzo: S.droneNote ? S.droneNote().monzo : null }, T.stream);
    } catch (e) { if (window.console) console.warn("Kolob: the testimony could not be made ready:", e); return; }
    var n = C.meetingNum;
    function live() { return !!S.playing && C.testimony === T && C.meetingNum === n; }
    var end = KOLOB.Testimony.perform(S.ctx, S.seatedSend("speaker"), tc, T.material, T.stream, {
      dests: { speaker: S.seatedSend("speaker"), harmonium: S.seatedSend("reed"), clarinet: S.seatedSend("reed") },
      defer: function (at, fn) { cueAt("guests", at, function () { if (live()) fn(); }); },
      onNote: function (x) {
        emitNote(x.layer, x.freq, x.t, x.dur, { part: x.part, member: x.member, speech: !!x.speech, deg: x.deg, monzo: x.monzo, keyMonzo: x.keyMonzo, move: x.move || null, accent: x.accent, testimony: true });
      },
      onStage: function (st) {
        var ev = { type: "testimony", stage: st.stage, memberId: st.member || st.memberId || null, section: "testimony" };
        if (st.t0 == null || st.t0 <= now() + 1e-6) emitEvent(ev); else cueAt("guests", st.t0, function () { if (live()) emitEvent(ev); });
      },
      onCast: function (c) {
        cueAt("guests", Math.max(c.t, now()), function () {
          if (!live()) return;
          var m = C.ward && C.ward.byId[c.memberId];
          emitEvent({ type: "cast", memberId: c.memberId, nameDs: c.nameDs || (m ? m.nameDs : "") || "", action: c.action,
                      actionDs: KOLOB.Cast && KOLOB.Cast.ACTION_DS ? KOLOB.Cast.ACTION_DS[c.action] || null : null, role: m ? m.role || null : null });
        });
      },
      onAnswer: function (a) { Motif.post(a.instrument, "clarinet", a.motif, "imitate", S.moment(), T.stream.fork("answer:" + a.memberId)); },
    });
    T.until = end;
  }
  function testimonySounding() { return !!C.testimony && C.testimony.fired && !!S.ctx && now() < C.testimony.until; }
  // (the testimony is the bearers' from its start until the last sits down:
  // the still small voice keeps its peace through it — kolob-voices-field.js)
  function testimonyHolds() { return !!C.testimony && C.section === "testimony" && (!C.testimony.fired || testimonySounding()); }
  // THE BELLS' AND THE PRACTICE'S MATERIAL: the day's
  // hymn as the composer wrote it (the first hymn; the doxology's, for the
  // bells in the postlude) — waiting since the plan, or written now and
  // counted — made ready by the guest itself (prepare: pure, on its own
  // stream), and the section held as long as the piece now is exactly
  // (THE SOCIAL HALL's material too — the day's hymns as the
  // composer wrote them, the doxology's the likeliest to be danced, then the
  // first hymn's; the ward's fiddler and caller; the Sunday, always handed in)
  function standingMaterial(V) {
    var G = V.type === "handbells" ? KOLOB.GuestHandbells : V.type === "socialhall" ? KOLOB.GuestSocialHall : KOLOB.GuestSingingSchool;
    if (!G) return;
    var mat;
    if (V.type === "socialhall") {
      var HYs = Hymnal();
      mat = { hymns: (C.hymnal || []).map(function (r) { return { hymn: HYs ? HYs.get(r.id) : null, section: r.section }; })
                                     .filter(function (x) { return x.hymn && x.hymn.lines && x.hymn.lines.length; }),
              keynoteHz: S.F0 * S.ROOT_MULT, ward: C.ward, sunday: C.meeting ? C.meeting.sunday : null, kind: C.meeting ? C.meeting.activity : null };
    } else {
      var h = V.hymnId && Hymnal() ? Hymnal().get(V.hymnId) : null;
      mat = { hymn: h, keynoteHz: S.F0 * S.ROOT_MULT, mode: S.mode };
      if (V.type === "handbells") { mat.seat = V.section; if (V.piece) mat.piece = V.piece; }
    }
    try { V.material = G.prepare(mat, V.stream); }
    catch (e) { V.material = null; if (window.console) console.warn("Kolob: the " + V.type + " could not be made ready:", e); return; }
    var sc = G.score(V.material, V.stream, 0);
    V.dur = sc.end;
    var hold = (V.at || 0) + V.dur + (V.type === "singingschool" ? SCHOOL_AFTER_S : 3);
    if (C.section === V.section) C.sectionDur = C.plan[C.si].dur = Math.max(C.sectionDur, hold);
  }
  // THE GUESTS OUTSIDE: THEIR MATERIAL — made ready a second before their
  // cue, in a cue of its own (no wake of the clock both makes a march and
  // lays its first bar):
  // pure, a millisecond or two. The band's march is one of the day's hymns
  // (its plan's pick among them, the one its own section sings left out when
  // there is another; never the doxology's before a doxology has been sung —
  // on a withheld Sunday it is the day's tune assembled at last, and on any
  // Sunday the theme's coming home is the doxology's to make), in its own key
  // against the key sounding now. THE SECOND BAND (it must come: it
  // vanished whenever one hymn was left to march) takes the next hymn of the
  // pool; with one, the section's own — the ward's hymn in the stranger's
  // key, the sharpest Ives collision — or else the same march again, in the
  // other key and at its own pace. The company sings ALL IS WELL on the day's
  // keynote; the gulls cry the head of the day's first hymn. Every choice is
  // the plan's: a hymn not yet back from the composer's desk is written now
  // (counted), never passed over, so the same seed marches the same march.
  function outsideMaterial(V) {
    var HY = Hymnal(), keynote = S.F0 * S.ROOT_MULT;
    try {
      if (V.type === "handcart") { V.material = { homeHz: keynote }; return; }
      var rows = (C.hymnal || []).filter(function (r) { return r.piece !== "round"; });
      if (V.type === "gulls") {
        var first = rows[0] && HY ? HY.get(rows[0].id) : null;
        V.material = KOLOB.GuestGulls.prepare({ hymn: first, keynoteHz: keynote }, V.stream);
        return;
      }
      var sungDox = false;
      for (var di = 0; di < C.si && di < C.plan.length; di++) if (C.plan[di].type === "doxology") sungDox = true;
      var marchable = rows.filter(function (r) { return sungDox || r.section !== "doxology"; });
      var own = C.hymn ? C.hymn.id : null, others = marchable.filter(function (r) { return r.id !== own; });
      var pool = others.length ? others : marchable;
      if (!pool.length || !HY) { V.material = null; return; }
      var i = Math.min(pool.length - 1, Math.floor((V.pick || 0) * pool.length));
      var h = HY.get(pool[i].id), h2 = null;
      if (V.second) h2 = pool.length > 1 ? HY.get(pool[(i + 1) % pool.length].id) : own && own !== pool[i].id ? HY.get(own) : h;
      var here = own ? HY.get(own) : null;
      var home = keynote * (here && here.keyMonzo ? KOLOB.Pitch.ratio(here.keyMonzo) : 1);
      V.material = KOLOB.GuestBands.prepare({ hymn: h, homeHz: home, second: h2 ? { hymn: h2 } : null }, V.stream);
    } catch (e) { V.material = null; if (window.console) console.warn("Kolob: the " + V.type + " could not be made ready:", e); }
  }
  // THE DAWN PLAYS THE FIRST HYMN: the trombones take up the
  // day's first composed hymn at their cue — written off the audio path
  // since the plan (kolob-hymnal.js), so it is waiting; a late one is
  // written here and counted. The trombone room re-voices it for the
  // brass (a few ms), and now the chorale's length is exact: the prelude
  // lasts at least until the far choir's last chord has rung out over the
  // town. No hymn to be had → dawnChorale's chorale of the poured theme.
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
  // (the handcart company is listened to — the melodic voices find
  // the air taken, the drone and the valley stay; so are the organist's
  // variations, the gift of tongues, the Social Hall and the Hosanna. The
  // band and the gulls take no air: the meeting carries on regardless)
  var LISTENED = { trombones: true, handbells: true, singingschool: true, handcart: true, variations: true, tongues: true, socialhall: true, hosanna: true };
  // …and while a composed hymn is sung: the ward and (in the
  // Tabernacle) the organ under it are the music; the house's own voices —
  // the organist's free chords, the harmonium, the strings, the clarinet —
  // speak around the hymn, not over it (PLAN-COMPOSITION §1.1: the motif
  // engine works AROUND the hymns), and come back when it is done
  // …and while the organist plays the chorale prelude:
  // the drone and the valley stay (it is morning outside); the house's own
  // voices wait for the organist, and so does a guest
  // …and while the testimony-bearers speak: the deacon's clarinet,
  // the harmonium and the strings wait; the drone and the field stay
  function hallListens() { return (inVisit() && !!LISTENED[C.visitType]) || hymnSounding() || choraleSounding() || testimonySounding(); }
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
  // keep their own rows; the direction line and the tools read these)
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
  // none of those notes, and the hymn board's direction line never names it.
  // The table is read when a guest arrives.
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
    emitEvent({ type: "skip", to: type });
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
    emitEvent({ type: "stillness", why: why, holdS: holdS });
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
      emitEvent({ type: "room-empties", toward: next });
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
        emitEvent({ type: "guest", guest: "raspberry", stage: "blat", logged: true });
      });
      cueAt("conductor", t + rDur + 0.9, function () {
        emitEvent({ type: "guest", guest: "raspberry", stage: "amen", logged: true });
      });
    } else {
      // the organ's amen is the Tabernacle's (PLAN §3.C: the amen lives there,
      // and stays Kolob's signature as the share of the Sundays sung in that
      // voice): a Sacred Harp house closes its sections as its tunes close
      // theirs, dominant to home, and the meeting too (the plagal share
      // follows the house: with one table for every house the joints were
      // 82 % plagal on every Sunday). The Old Way's lined hymns carry no
      // harmony at all; the
      // organist's amens between its sections are the Sunday's only closes,
      // and stay as ever.
      var kindDie = R.pickW([["plagal", 3], ["authentic", 2], ["half", 1]]);
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? kindDie : "plagal");
      if (C.house === "sacredharp") kind = isLast || kindDie !== "half" ? "authentic" : "half";
      var chords = Desk.cadence(kind, R, t, "joint");
      var chDur = R.rnd(2.6, 3.6);
      // the brush arbor has no organ (THE PRELUDE'S SEATING): its amen is
      // bowed — the strings on each chord's bare fifth — and the organist is
      // first heard in the meeting that follows (else the arbor's organ
      // played the prelude's closing amen)
      // (and so is the amen of a rite seated in the brush arbor: else the
      // arbor's organ sat the rite out and then played its amen)
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
    emitEvent({ type: "joint", last: !!isLast, toward: next, dur: dur });
    return dur;
  }

  // ==========================================================================
  // THE CHORISTER'S BOOK — C's frozen interface
  // ==========================================================================
  // C is this room's own: the plan, the section, the hymn's meter and verse,
  // the guests, the withheld tune. The other rooms read it ONLY through
  // these accessors (S.Meeting), so C can change its shape behind them
  // without an edit in every voice. The object is frozen:
  // no room can add to it or rebind it. The one write the house makes is the
  // verse's walk (advanceVerse).
  //
  //   meetingNum()    this visit's meeting count, from 1
  //   activity()      the kind of Sunday: ordinary | fast | conference |
  //                   jubilee (null before the first meeting)
  //   sunday()        the kind's row of MEETINGS with the Sunday's plan laid
  //                   over it (silenceMul, hymns, bells, choirSize, bright,
  //                   meterW; sunday: the Sunday's id), or null — NOT the
  //                   calendar's Sunday, which is day(): the names clash,
  //                   and every voice reads sunday() for the row
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
  //                   {type, section, at, dur, fired} (a copy: the guests'
  //                   rooms and the tools read it; nothing writes through it)
  //   hymnId()        the hymn being sung (SCORE §3: h:<meeting>:<i>, the
  //                   i-th singing section of the meeting — hymns and the
  //                   doxology — counted from 1)
  //   seating()       the prelude's seating (its name, the waking, the
  //                   rests, the first chord, the hum, the lean); waking()
  //                   its entrances; lean(layer) a factor on that voice's
  //                   rests — the prelude's seating's, or the rite's own
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
      if (!V.fired && !V.cued && !V.ofHymn && V.section === C.section) return V;
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
    // the section's fuging (the die the section drew), still to come
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
    // (the MEETINGS row with the Sunday laid over it — not the calendar's
    // Sunday, which is day() below; the name clash stands)
    sunday: function () { return C.meeting ? C.meeting.row : null; },
    // the calendar's Sunday: its id (ordinary, fast, conference, pioneer,
    // christmas, easter, wedding, funeral, dedication), its name in Deseret
    // for the programme card (en: dev and Latin), its kind
    day: function () {
      if (!C.meeting) return null;
      var SD = C.meeting.sunday ? Calendar().SUNDAYS[C.meeting.sunday] : null;
      return { id: C.meeting.sunday || null, kind: C.meeting.activity, nameDs: SD ? SD.ds : null, nameEn: SD ? SD.en : null };
    },
    // the light of the rite now (0 night … 1 full daylight; the calendar's
    // arc), and of every rite of the plan
    light: function () { return C.plan[C.si] && C.plan[C.si].light != null ? C.plan[C.si].light : null; },
    lights: function () { return C.plan.map(function (s) { return s.light != null ? s.light : null; }); },
    // the rite's seating (THE SEATINGS OF THE OTHER RITES, in the plan): its name
    // and what it asks of the house ({name, sits, lean, lined, fifths, hum,
    // forced}), or null (a hymn, the prelude, the plain house)
    scene: function () { return sceneNow(); },
    scenes: function () { return C.scenes ? C.scenes.map(function (x) { return x ? { name: x.name, empty: x.empty, forced: x.forced } : null; }) : null; },
    sits: function (layer) { var sc = sceneNow(); return !!(sc && sc.sits && sc.sits[layer]); },
    // the reckoning: {planned, held (the switch off: the
    // drone at home), doxId, ok, from, cantus, why} once read, or null
    reckoning: function () { return C.reckoning ? JSON.parse(JSON.stringify(C.reckoning)) : null; },
    // the Hosanna: {possible, built, seat ({sectionIndex, dur,
    // beside…} or null: not this Sunday), fired, until} on Easter and a
    // dedication, else null — for the dev tools and the harness only: the
    // page is never told of it
    hosanna: function () { return C.hosanna ? JSON.parse(JSON.stringify(C.hosanna)) : null; },
    // the guest budget's account: who it refused and why, and
    // whether a place was kept for the Hosanna
    budget: function () { return C.budget ? JSON.parse(JSON.stringify(C.budget)) : null; },
    // the testimony-bearers: their seat ({at, dur, bearers…}),
    // whether they have risen, and until when they speak — or null
    testimony: function () { return C.testimony ? { seat: JSON.parse(JSON.stringify(C.testimony.seat)), fired: !!C.testimony.fired, until: C.testimony.until } : null; },
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
    visitSecond: function () { return !!C.visitSecond; },
    guests: function () {
      return C.visitations.map(function (v) { return { type: v.type, section: v.section, at: v.at != null ? v.at : null, dur: v.dur != null ? v.dur : null, fired: !!v.fired,
        index: typeof v.index === "number" ? v.index : C.plan.map(function (p) { return p.type; }).indexOf(v.section), changes: v.changes ? v.changes.method || true : null, hymnId: v.hymnId || null, seeded: v.seeded || null, second: v.type === "bands" ? !!v.second : null }; });
    },
    // the prelude's seating (THE PRELUDE'S SEATING): its name, the waking's
    // entrances (s after the downbeat), whether the first chord is full, who
    // sits the prelude out, and whether the strings keep to bare fifths
    seating: function () { return C.seating || null; },
    waking: function () { return C.seating ? C.seating.at : null; },
    // a planned fuging entry is near and not yet sung: the choir leaves its
    // window free (x 0.45–0.8 of a hymn)
    fugingNear: function () {
      if (C.section !== "hymn" || !C.fugingPlanned || C.fugingFired) return false;
      var x = localArc();
      return x >= 0.45 && x < 0.8;
    },
    // the texture: a factor on the named voice's rest between its turns —
    // the prelude's seating's lean while a prelude lasts (THE PRELUDE'S
    // SEATING), the rite's own seating's otherwise (THE SEATINGS OF THE
    // OTHER RITES); under 1 it plays more, over 1 less; 1 where neither
    // names the voice
    lean: function (layer) {
      var L = C.section === "prelude" && C.seating ? C.seating.lean[layer] : null;
      // (every other rite leans by its own seating)
      if (L == null && C.section !== "prelude") { var sc = sceneNow(); L = sc && sc.lean ? sc.lean[layer] : null; }
      return L > 0 ? L : 1;
    },
    hymnId: hymnId,
    moment: moment,
    // THE DAY'S HYMNAL: the house dialect, the day's hymns (a row
    // per singing section: id, dialect, key, meter, mode — a copy), the
    // hymn being sung ({id, dialect, key, active, until}, a copy; null when
    // none), and the performer's hands (above)
    house: function () { return C.house; },
    // the Sunday's ward (kolob-cast.js's Ward, seated with the plan), or null
    ward: function () { return C.ward || null; },
    // the Sunday's organist (kolob-organist.js's seat —
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
      emitEvent({ type: "chorale-prelude", hymnId: C.chorale.hymnId, t0: t0, until: until, style: what ? what.style : null, manner: what ? what.manner : null });
    },
    hymnal: function () { return C.hymnal.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; }); },
    hymn: function () { return C.hymn ? { id: C.hymn.id, dialect: C.hymn.dialect, key: C.hymn.key, active: C.hymn.active, from: C.hymn.from, until: C.hymn.until } : null; },
    // the day's forms (a copy) and the doxology's one
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
  //   reset(meeting)                a clean page: a new meeting, a sunrise
  //                                 (and a PLAY after STOP, which is a new
  //                                 meeting: the stopped one's lines are
  //                                 shut outside and hold nothing); a new
  //                                 meeting (meeting true) counts its
  //                                 fifths again, a sunrise counts on
  //   fifthCount()                  the parallel fifths the meeting has
  //                                 sung (getConductor's fifths)
  var Desk = (function () {
    var book = KOLOB.Score.chordBook();
    var fifths = 0;                   // parallel fifths sung this meeting: counted, reported — they should be > 0
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
        // for the tools (the minutes print no chord): when it sounds,
        // which chord it is, who wrote it, the voicing as sung
        at: t, chord: chord.id, by: by || "", page: book.page(), n: S.colN(),
        voicing: v.slice(), freqs: chord.freqs.slice(), pinned: !!chord.pinned, seat: chord.seat || 1,
      });
      return chord;
    }
    // (dur: how long a singer holds it — the humming seating's chords are
    // the choir's, and the joint and the organist wait for them)
    // THE HOUSE LEANS ON THE DRONE (the reckoning). While
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
      emitEvent({ type: "cadence", kind: kind, by: by || "", at: t, hymnId: sec === "hymn" || sec === "doxology" ? hymnId() : null });
      return chords;
    }
    function voice(root7, opts, R, t) { return Harmony.voice(root7, opts, momentAt(t), R); }
    return {
      at: function (t) { return book.at(t); },
      chordTones: function (t) { return Harmony.chordTones(book.at(t)); },
      advance: advance, harmonize: harmonize, cadence: cadence, write: write, voice: voice, pedalClass: dronePedalClass,
      sungUntil: function () { return sung; },
      reset: function (meeting) { book.reset(); sung = 0; if (meeting) fifths = 0; },
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
  // STOP (kolob-core.js): the stopped meeting's stillness ends with it — its
  // hold here (inHush), its dip at the next PLAY (the core lifts the drone's
  // duck). Everything else the meeting owned is reset when the next one is
  // planned (resetMeetingState).
  function meetingStop() { C.hushUntil = 0; }

  S.Meeting = Book;
  S.moment = moment;
  S.Harmony = Desk;
  Object.defineProperty(S, "forceVisitation", { enumerable: true, configurable: true, get: function () { return forceVisitation; }, set: function (v) { forceVisitation = v; } });
  Object.defineProperty(S, "forceRaspberry", { enumerable: true, configurable: true, get: function () { return forceRaspberry; }, set: function (v) { forceRaspberry = v; } });
  Object.defineProperty(S, "cumulativeMode", { enumerable: true, configurable: true, get: function () { return cumulativeMode; }, set: function (v) { cumulativeMode = v; } });
  Object.defineProperty(S, "seasonPos", { enumerable: true, configurable: true, get: function () { return seasonPos; }, set: function (v) { seasonPos = v; } });
  S.planMeeting = planMeeting;
  S.CUMULATIVE_ODDS = CUMULATIVE_ODDS;
  S.resetVisit = resetVisit;
  S.meetingStop = meetingStop;
  S.localArc = localArc;
  S.intensity = intensity;
  S.inHush = inHush;
  S.inFuging = inFuging;
  S.inVisit = inVisit;
  S.hallListens = hallListens;
  S.testimonyHolds = testimonyHolds;
  S.farWardFor = farWardFor;
  S.silenceMul = silenceMul;
  S.gapMul = gapMul;
  S.conductorTick = conductorTick;
  S.skipToSection = skipToSection;
  // the room's public face on the KOLOB namespace (dev: nothing on the page
  // reads it; the labs and the harness may)
  KOLOB.Meeting = { MEETINGS: MEETINGS, book: Book, desk: Desk, planMeeting: planMeeting, conductorTick: conductorTick, runJoint: runJoint, dawnChorale: dawnChorale, F0_RANGE: F0_RANGE };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-meeting.js"] = true;   // the load guard's roll call
})();
