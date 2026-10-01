// ============================================================================
// KOLOB — kolob-plan.js: the plan (KOLOB.Plan)
//
// The meeting's plan, out of the conductor. kolob-meeting.js conducts a
// meeting: it enters each rite, ticks through it, closes it at a joint and
// keeps the chorister's book. What that meeting is to be is decided here:
// the Sunday, the keynote, the mode, the order of service and the light of
// every rite, the dice the plan throws for its own guests and for the
// switches (THE DAY); and once the house is tuned to the day, every guest
// seated against one budget, the prelude's seating, the day's hymnal and its
// forms, the organist and the ward, the testimony, the Hosanna, the other
// rites' seatings, the gift's seed, the reckoning's order and the chorale
// prelude (THE SEATING).
//
// PURE PLANNING, as the guest rooms keep theirs. Nothing here touches an
// AudioContext, the DOM, a clock, a timer, Math.random, Date, the shared bag
// (KOLOB._s), a cue or an event, and nothing writes what it is handed: every
// die is a stream's, handed in, and everything decided is in the object
// returned. It calls only the pure rooms (the calendar, the hymnal's plan
// and forms, every guest room's plan, the cast's and the organist's seats)
// — and, on a page that loads no composer, the house's own pen for the
// trombones' dawn (info.dawnChorale), which pours the day's gestures and,
// on a withheld Sunday, develops one and tells it, as it did when this was
// the conductor's code. No page and no lab loads the meeting without the
// composer today, so that road is never taken.
// The conductor writes the result into the house (the keynote and the mode
// into the tuning, the rest into its state C), tells what is to be told and
// posts what is made off the clock (the hymnal's orders, the variations'
// readiness, the Social Hall's bake), in the order they always were. The
// dice are thrown in the order they were thrown when this was the
// conductor's own code, on the same streams (SCORE §3), so a seed plays the
// meeting it played: tools/golden.js holds the plan for 40 seeds, and holds
// it to this paragraph (each half run with the house shut, so that a touch
// of anything named above throws and is told, and run again on fresh
// streams, with every guest the switch may name); the tally holds the
// music.
//
// TWO HALVES, because the house does one thing between them: it tunes
// itself to the day (S.F0, S.mode, the scale) and opens the day's gestures
// (KOLOB.Melody.Motif, on motif:<n>, a room with state of its own), and the
// seating reads both — the Earth tunes the day's tuning admits, and the
// gestures the day's hymns are seeded from.
//
// Public surface: KOLOB.Plan
//   day(n, info, draws)    THE DAY: every die of meeting:<n>, in its order —
//                          the season, the keynote, the Sunday, the mode, the
//                          order of service and its mutations, the arc of
//                          light, the plan's own guest dice, the switch's
//                          pick, the withheld tune and the raspberry amen →
//                          { n, F0, seasonPos, mode, meeting, sunday,
//                            activity, row, sections, forcedType,
//                            cumulative, raspberry, dice }
//     info   what the house tells the plan, none of it a die: calendar
//            (KOLOB.Calendar), forceVisitation (the 𐐌𐐚𐐞 switch: true, a
//            guest's name, or false), forceRaspberry, cumulativeMode
//            ("always" | "natural" | "never")
//   seat(day, info, draws) THE SEATING, on the day day() drew (not changed:
//                          its order of service is copied, and the copy is
//                          held for the guests seated in it) →
//                          { sections, visitations, budget, hosanna,
//                            hosannaStream, testimony, seating, scenes,
//                            chorale, house, hymnal, forms, payoff,
//                            reckoning, organist, ward — C's fields of the
//                            same names, sections its plan —
//                            ready (the variations to make ready off the
//                            clock, or null), bake (the Social Hall's sounds
//                            to bake ahead), orders ({ rows, forms,
//                            reckoning } for the composer's desk, or null
//                            where no composer is loaded) }
//     info   calendar and forceVisitation as day()'s, and, once the house is
//            tuned to the day: pipeOn (whether the pipe organ sounds,
//            S.pipeOn() — no variations and no chorale prelude without it),
//            experimental (KOLOB.Experimental.snapshot(): the singing
//            school's switch), reckoning (the reckoning's switch: off, its
//            order is held), oldTunes (the Earth tunes the day's tuning
//            admits, weighted: kolob-guests.js oldTuneCandidates), keynoteHz
//            (the day's keynote, F0 · ROOT_MULT), theme and subs (the day's
//            gestures as degrees), dawnChorale ((sections, R) → the dawn's
//            chorale where no composer is loaded: the house's, from the
//            day's theme — never asked on a page that loads the composer)
//     draws  the dice, as the core deals them: stream(label) is this
//            meeting's <label>:<n> (kolob-core.js S.stream — the same stream
//            every time it is asked for); castStream(n) is cast:<n>, a fresh
//            fork each time (S.castStream). day() asks for "meeting"; seat()
//            for each guest's guest:<name>, "prelude", "meeting" (each
//            doxology's section:<i>, a fresh fork), "hymnal", "forms" and
//            "scenes", and for cast:<n>
//   placeOf(sections, V)   a seated guest's rite by its place in the order
//                          of service (its own index, or its section's first)
//   MEETINGS, SEASON_OF, F0_RANGE, CUMULATIVE_ODDS, FORCEABLE, SCHOOL_AFTER_S
//                          its tables
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Plan = (function () {
  "use strict";
  var KOLOB = window.KOLOB;

  // The meeting-activity axis: what kind of Sunday is it?
  var MEETINGS = {
    ordinary:   { silenceMul: 1.0, hymns: 2, bells: 0.5, choirSize: 3, bright: 0.5,  meterW: [["CM", 3], ["LM", 2], ["SM", 2], ["87.87", 2], ["CMD", 1]] },
    fast:       { silenceMul: 1.7, hymns: 1, bells: 0.2, choirSize: 2, bright: 0.3,  meterW: [["CM", 3], ["SM", 3], ["LM", 2], ["87.87", 1], ["CMD", 0.5]] },
    conference: { silenceMul: 0.75, hymns: 3, bells: 0.8, choirSize: 4, bright: 0.75, meterW: [["CMD", 3], ["87.87", 3], ["CM", 2], ["LM", 2], ["SM", 1]] },
    jubilee:    { silenceMul: 0.6, hymns: 3, bells: 1.0, choirSize: 4, bright: 0.9,  meterW: [["CMD", 3], ["87.87", 2.5], ["CM", 2], ["LM", 1.5], ["SM", 1]] },
  };
  // CUMULATIVE FORM's natural odds — the ONE number; the page reads it
  // through KolobAudio.getCumulativeOdds() for the switch's text (the
  // switch itself, the 𐐐𐐄𐐢 pill, is the house's: kolob-meeting.js
  // cumulativeMode, handed in as info.cumulativeMode)
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
  var F0_RANGE = [52, 78];       // the keynote's window, Hz of F0 (see THE KEYNOTE in day)
  // the guests a dev may name with the switch (the harness's force=, the
  // page's ?guest=): every guest — the handcart company, the gulls, the
  // variations, change ringing, the gift of tongues, the far ward, the
  // Hosanna (on its own Sundays only), the Social Hall and the
  // testimony-bearers among them; the switch's own pick (forcedPick, below)
  // gains the Ivesian ones only — not the Social Hall, the gift or the
  // Hosanna, which are no Ives visitations
  var FORCEABLE = { bands: true, steeples: true, oldtune: true, trombones: true, handbells: true, singingschool: true,
                    handcart: true, gulls: true, variations: true, changes: true, tongues: true, farward: true, hosanna: true, socialhall: true, testimony: true };

  // a weighted pick from a die already thrown (u in [0,1)): the plan throws
  // its dice first and reads them after, so a pool that is empty or forced
  // never changes how many dice were thrown (KOLOB.Num's, kolob-pitch.js)
  function pickWith(u, pool) { return KOLOB.Num.pickWith(u, pool); }

  // THE DAY — every die of meeting:<n> is thrown here, in one fixed order,
  // whether it is used or not (SCORE.md §3: a hymn not sung, a guest
  // refused, a switch that forces another guest in — none of them shifts a
  // die that follows).
  function day(n, info, draws) {
    var CAL = info.calendar;
    var R = draws.stream("meeting");
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
    var F0 = R.rnd(F0_RANGE[0], F0_RANGE[1]);
    // THE SUNDAY (PLAN §7.1): the day of the colony year, from the die that
    // once drew the kind alone — and the kind from the Sunday
    var dayU = R.next();
    var sunday = CAL.draw(dayU);
    var activity = CAL.kindOf(sunday);
    var SUN = CAL.SUNDAYS[sunday];
    var sr = SUN && SUN.season ? SUN.season : SEASON_OF[activity];
    var seasonPos = sr[0] + (sr[1] - sr[0]) * seasonDie;               // 0 the fast-day trough … 1 the festival
    // the kind's row with the Sunday laid over it (how many hymns, how still,
    // how bright, how many bells): what S.Meeting.sunday() hands the voices
    var A = CAL.meetingRow(sunday, MEETINGS[activity]);
    var SP = SUN ? SUN.plan : {};
    // Mode lottery, tilted bright or modal by the kind of Sunday.
    var b = A.bright;
    var mode = R.pickW([
      ["ionian", 2 + 2 * b],
      ["penta", 2.5],
      ["hexa", 1.5],
      ["mixolydian", 1 + b],
      ["dorian", 1.4 - b * 0.8],
      ["aeolian", 1.2 - b * 0.8],
    ]);

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
    // THE SWITCH'S GUEST (the 𐐌𐐚𐐞 switch forces one guaranteed guest,
    // seated early enough that the guarantee is heard): the switch draws its
    // guest; a dev who names one — the harness, a lab — gets that one, and
    // the die is thrown all the same
    var forcedPick = pickWith(forcedDie, [["bands", 2], ["steeples", 1], ["oldtune", 1], ["trombones", 1], ["handbells", 1],
                                          ["handcart", 1], ["gulls", 1], ["variations", 1], ["changes", 1], ["farward", 1]]);
    var forcedType = info.forceVisitation ? (FORCEABLE[info.forceVisitation] ? info.forceVisitation : forcedPick) : null;
    // CUMULATIVE FORM (after Ives's cumulative settings): the day's theme is
    // WITHHELD — only its fragments circulate, endings first — until the
    // doxology sings it whole for the first time. Rarest of the guests
    // (~1 meeting in 12) because it is a meeting-SHAPE, not an event.
    // Governed by the 𐐐𐐄𐐢 pill: always / natural 8% / never. (The
    // conductor opens the motif engine's day after this, with the flag in
    // its moment: the theme-length guard there reads it.)
    var cumulative = info.cumulativeMode === "always" || (info.cumulativeMode === "natural" && cumDie);
    // THE RASPBERRY AMEN — its own flag, not a seated visitation: it has no
    // section, only the meeting's final cadence. Never on a fast Sunday; a
    // solemn meeting does not end on a joke.
    var raspberry = info.forceRaspberry || (activity !== "fast" && !(SUN && SUN.noRaspberry) && razzDie);
    return {
      n: n, F0: F0, seasonPos: seasonPos, mode: mode,
      // (the conductor's C.meeting, as it has always been shaped)
      meeting: { activity: activity, sunday: sunday, row: A },
      sunday: sunday, activity: activity, row: A, sections: plan,
      forcedType: forcedType, cumulative: cumulative, raspberry: raspberry,
      // the dice the plan threw for its own guests (the steeples', the old
      // tune's), read where those guests are seated
      dice: { stDie: stDie, stSeatDie: stSeatDie, oDie: oDie, oSeatDie: oSeatDie, oTuneDie: oTuneDie },
    };
  }


  // THE SEATING — everything the meeting decides once the house is tuned to
  // its day: the guests, each on its own room's stream and against one
  // budget; the prelude's seating; the day's hymnal and its forms; the
  // organist and the ward; the testimony; the Hosanna; the other rites'
  // seatings; the gift's seed; the reckoning's order; the chorale prelude.
  // Every die is thrown on the stream it was thrown on when this was the
  // conductor's own code, in the same order, used or not.
  function seat(today, info, draws) {
    var n = today.n, CAL = info.calendar, sunday = today.sunday, activity = today.activity, SUN = CAL.SUNDAYS[sunday], A = today.row;
    var mode = today.mode, cumulative = today.cumulative, forcedType = today.forcedType;
    var stDie = today.dice.stDie, stSeatDie = today.dice.stSeatDie, oDie = today.dice.oDie, oSeatDie = today.dice.oSeatDie, oTuneDie = today.dice.oTuneDie;
    function stream(label) { return draws.stream(label); }
    function oddsOf(g, dflt) { var o = CAL.guestOdds(g, sunday); return o != null ? o : dflt; }
    // the order of service, the seating's own copy of the day's (a rite is
    // held here for a guest seated in it)
    var plan = today.sections.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; return o; });
    // what the meeting will hold (C's fields of the same names), as each is
    // before anything is seated
    var visitations = [], budget = { refused: [], reserved: null };
    var hosanna = null, hosannaStream = null, testimony = null, seating = null, scenes = null, chorale = null;
    var house = null, hymnal = [], forms = null, payoff = null, reckoning = null, organist = null, ward = null;
    // …and what the house is to do with it off the clock
    var ready = null, bake = false, orders = null;
    function visitationOf(type) {
      for (var i = 0; i < visitations.length; i++) if (visitations[i].type === type) return visitations[i];
      return null;
    }
    // IVES VISITATIONS — guests in the meeting. Each rolls its OWN dice,
    // read against the calendar's odds for the Sunday (GUEST_ODDS: the
    // band's row is the owner's 36 %), and each is seated where its own room
    // or its seat list allows; the budget below decides who stays. The 𐐌𐐚𐐞
    // switch forces one guaranteed guest (the day drew it: forcedType),
    // seated early enough that the guarantee is heard. (The Question's die,
    // 29 %, is still thrown; it never seats.)
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
    // its place. (budget, the meeting's C.budget: who was refused, and why —
    // the census reads it)
    var BUD = CAL.GUEST_BUDGET;
    function indexOfSec(type) { return indexOfRite(plan, type); }
    function seatIndex(V) { return placeOf(plan, V); }
    // (the switch's guest keeps its place until it is seated: change ringing
    // is the steeples'; the Hosanna's place is kept by its own reservation;
    // the testimony-bearers are no guest and keep none)
    var forcedSeat = forcedType === "changes" ? "steeples" : forcedType === "hosanna" || forcedType === "testimony" ? null : forcedType;
    function budgetRefuses(type, section, index, skip) {
      if (forcedSeat === type) return null;
      var others = visitations.filter(function (v) { return v !== skip; });
      var count = others.length + (budget.reserved && budget.reserved !== type ? 1 : 0) + (forcedSeat && !visitationOf(forcedSeat) ? 1 : 0);
      if (count >= BUD.max) return "the budget is full";
      if (BUD.showpieces[type] && (others.some(function (v) { return BUD.showpieces[v.type]; }) || (budget.reserved && BUD.showpieces[budget.reserved]) || (forcedSeat && BUD.showpieces[forcedSeat]))) return "the meeting has its showpiece";
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
      if (why) { budget.refused.push({ guest: V.type, section: V.section, why: why }); return false; }
      visitations.push(V);
      return true;
    }
    // the guests seated so far as a guest's own room is told of them: each
    // with its rite's place in the plan (index: the far ward's hymn is not
    // the first hymn), less those the Sunday lets sit
    // beside `type` in a neighbouring rite (the band and the dance on
    // Pioneer Day) — the room would refuse them, and the budget has allowed it
    function seatedFor(type, section) {
      return visitations.map(function (v) { return { type: v.type, section: v.section, index: seatIndex(v) }; })
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
    var hoAsk = HOg && SUN && SUN.hosanna ? HOg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: [], odds: hoOdds, force: forcedType === "hosanna" }, hoStream) : null;
    if (hoAsk) budget.reserved = "hosanna";
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
      var bSeat = GBg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: visitations, odds: oddsOf("bands", null), force: forcedType === "bands" }, bStream);
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
      else budget.refused.push({ guest: "steeples", section: stFirst, why: budgetRefuses("steeples", stFirst) || "no edge free" });
    }
    // THE OLD TUNE — its own die, gated by the mode law (kolob-guests.js
    // oldTuneCandidates, handed in as info.oldTunes): an Earth tune surfaces
    // only on a Sunday of its own colour — the minor tunes on dark Sundays,
    // the major on bright ones — and only where the day's tuning holds every
    // note of the melody it will sing. Seats where remembering belongs: the
    // prelude's pre-gathering reverie, or testimony. Never the sacrament.
    var oldPool = info.oldTunes;
    // (the first of its seats the budget admits it to)
    if (oldPool.length && (forcedType === "oldtune" || oDie)) {
      var oPrefs = forcedType === "oldtune" ? ["prelude", "testimony", "hymn"] : (oSeatDie ? ["prelude", "testimony"] : ["testimony", "interlude", "prelude"]);
      var oSeat = forcedType === "oldtune" ? seatIn(oPrefs) : seatFree("oldtune", oPrefs);
      if (oSeat) admit({ type: "oldtune", section: oSeat, fired: false, tune: pickWith(oTuneDie, oldPool) });
      else if (seatIn(oPrefs)) budget.refused.push({ guest: "oldtune", section: seatIn(oPrefs), why: budgetRefuses("oldtune", seatIn(oPrefs)) });
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
    var TB = (KOLOB.GuestTrombones || null), tbStream = null, tbInfo = null;
    if (TB) {
      tbStream = stream("guest:trombones");
      tbInfo = { n: n, kind: activity, sunday: sunday, sections: plan, guests: visitations, odds: oddsOf("trombones", null), force: forcedType === "trombones" };
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
    // switch is read by the house, once — info.experimental — and handed
    // down so the planner stays pure).
    // It keeps its own time (cued), and the morning is seated around it
    // (seatPrelude: the house wakes after the practice).
    var SSg = KOLOB.GuestSingingSchool || null;
    if (SSg) {
      var ssStream = stream("guest:singingschool");
      var ssSeat = SSg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: visitations, odds: oddsOf("singingschool", null),
                              experimental: info.experimental, force: forcedType === "singingschool" }, ssStream);
      if (ssSeat) admit({ type: "singingschool", section: "prelude", at: ssSeat.at, dur: ssSeat.dur, fired: false, cued: true, stream: ssStream, experimental: true });
    }
    // The trombones' chorale. With the day's hymnal they play the day's
    // FIRST COMPOSED HYMN, which the composer writes off the audio path
    // (THE DAY'S HYMNAL, below): the chorale is taken up at their cue, a few
    // seconds into the prelude, and the prelude then yields to it
    // (cuedArrival). Without the hymnal — a lab that loads no composer — the
    // chorale is written now (info.dawnChorale, the house's: the day's theme
    // poured into the first hymn's meter and set by Harmony; its harmonizing
    // paid here, not in the clock's callback), and the prelude yields at
    // once: it lasts at least until the far choir's last chord has rung out.
    var dawn = visitationOf("trombones");
    var HY = KOLOB.Hymnal && KOLOB.Composer ? KOLOB.Hymnal : null, prep = null;
    if (dawn) dawn.tbInfo = tbInfo;
    if (dawn && !HY) {
      dawn.material = TB.chorale(info.dawnChorale(plan, dawn.stream.fork("material")));
      tbInfo.material = dawn.material;             // (with the chorale in hand, the plan's length is exact)
      var tbExact = TB.plan(tbInfo, tbStream);
      if (tbExact) { dawn.at = tbExact.at; dawn.dur = tbExact.dur; plan[0].dur = Math.max(plan[0].dur, tbExact.holdUntil); }
    }
    // the prelude's seating: who wakes the Sunday, and when (below)
    seating = seatPrelude(stream("prelude"), SUN, visitationOf);
    if (seating.len !== 1 && plan[0].type === "prelude") plan[0].dur *= seating.len;
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
    payoff = cumulative ? "assembly" : null;
    if (HY) {
      // (a dark Sunday's doxology may rise into major — the sunrise, drawn
      // from that section's own fork when it begins: read here from a fresh
      // copy of the same fork, so its hymn is written in the mode it is sung
      // in and the section's dice are untouched)
      var modeThen = mode;
      var secs = plan.map(function (ps, idx) {
        if (ps.type === "doxology" && (modeThen === "aeolian" || modeThen === "dorian")) {
          var Rs = stream("meeting").fork("section:" + idx);
          Rs.chance(0.6);
          var rises = Rs.chance(0.4), to = Rs.pick(["ionian", "mixolydian"]);
          if (rises) modeThen = to;
        }
        return { type: ps.type, meter: ps.meter || null, index: idx, mode: modeThen, light: ps.light };
      });
      var dayHymns = HY.plan({
        n: n, kind: activity, sunday: sunday, mode: mode, seating: seating ? seating.name : null,
        sections: secs,
        trombones: !!dawn, cumulative: !!cumulative,
        theme: info.theme, subs: info.subs,
      }, stream("hymnal"));
      house = dayHymns.house;
      hymnal = dayHymns.rows;
      // THE DAY'S FORMS: a round, the partner hymn, the
      // wandering refrain — and the doxology's one payoff (kolob-hymnal.js
      // forms, on forms:<n>).
      var fm = HY.forms ? HY.forms({ n: n, kind: activity, sunday: sunday, cumulative: !!cumulative }, dayHymns.rows, stream("forms")) : null;
      forms = fm;
      if (fm && fm.payoff) payoff = fm.payoff;
      // THE KOLOB RECKONING (PLAN §7.2): the doxology is
      // written so that its opening can be the drone's cantus — the desk
      // writes it a few ways and keeps the first whose notes stand, one a
      // section, on the key of every section before it (the prelude's and
      // the other rites' the day's own, a hymn's its own), else falls back
      // to the doxology as the composer first wrote it and the drone on the
      // keynote (KOLOB.Experimental.reckoning; ?exp=-reckoning)
      // (the orders are made once every guest and every rite's seating is
      // known — a still sacrament lets the cantus stand on any note of the
      // tune — below, and posted by the conductor)
      prep = { rows: dayHymns.rows, fm: fm };
      if (dawn && dayHymns.rows.length) dawn.hymnId = dayHymns.rows[0].id;
    }
    // THE ORGANIST AND THE WARD, SEATED BEFORE THE GUESTS THAT NEED THEM
    // (the variations are the Sunday's organist's; the gift of tongues'
    // singer is one of the day's testimony-bearers, always, because the
    // ward is seated first). Pure seatings on
    // cast:<n>'s forks, so seating them here moves no die; the conductor
    // tells them with the prelude's seating (THE WARD, below).
    var OR = KOLOB.Organist && draws.castStream ? KOLOB.Organist : null;
    // (the Sunday leans the bench — a Victorian at a
    // conference, a wedding or a dedication, the plain organist at a fast or
    // a funeral — and seats as many of the ward you come to know as its
    // character asks: the fast Sunday three testimony-bearers, a dedication
    // every one of the optional roles, a funeral fewer)
    if (OR) organist = OR.seat(draws.castStream(n), { kind: activity, sunday: sunday, lean: SUN ? SUN.organist : null, houseDialect: house, bright: A ? A.bright : 0.5, ives: !!info.forceVisitation });
    ward = KOLOB.Cast && draws.castStream ? KOLOB.Cast.seat(draws.castStream(n), { organist: organist ? organist.style : null, enthusiast: !!(forms && forms.refrain), size: SUN ? SUN.cast : null }) : null;
    if (organist && ward && ward.byId.organist) { organist.nameDs = ward.byId.organist.nameDs; organist.nameEn = ward.byId.organist.nameEn; }
    // (the practice rehearses the day's first hymn)
    if (school && hymnal.length) school.hymnId = hymnal[0].id;
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
      var hbSeat = HBg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: visitations, odds: oddsOf("handbells", null), force: forcedType === "handbells" }, hbStream);
      if (hbSeat) {
        var hbRows = hymnal.filter(function (r) { return r.piece !== "round"; });
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
    // time once its hymn is written (the conductor's readyAhead, handed it
    // as `ready`: prepare measures 12 ms at the median and 77 at worst), and
    // its cue holds the section. In the prelude it is the morning: the house
    // waits for the end of the set (variationsSeating), and no chorale
    // prelude.
    var GVg = KOLOB.GuestVariations || null;
    if (GVg) {
      var gvStream = stream("guest:variations");
      var gvSeat = GVg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("variations"), odds: oddsOf("variations", null),
                              hymns: hymnal.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, piece: r.piece }; }),
                              organist: organist ? { style: organist.style } : null, withheld: !!cumulative,
                              organSits: !!(seating && (seating.sits.organ || seating.hum)), force: forcedType === "variations" }, gvStream);
      if (gvSeat && organist && info.pipeOn) {
        var gvV = { type: "variations", section: gvSeat.seat, at: gvSeat.at, dur: gvSeat.dur, fired: false, cued: true, stream: gvStream, hymnId: gvSeat.hymnId };
        if (admit(gvV)) {
          if (gvSeat.seat === "prelude") seating = variationsSeating(seating, gvV);
          ready = gvV;
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
      var gcSeat = GCg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("changes"), odds: oddsOf("changes", null),
                              keynoteHz: info.keynoteHz, force: forcedType === "changes" }, gcStream);
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
      var tgSeat = TGg.plan({ n: n, kind: activity, sunday: sunday, house: house, sections: plan, guests: seatedFor("tongues"), ward: ward || null,
                              odds: oddsOf("tongues", null), force: forcedType === "tongues" }, tgStream);
      if (tgSeat) {
        tgV = { type: "tongues", section: "testimony", at: tgSeat.at, dur: tgSeat.dur, fired: false, cued: true, stream: tgStream, seat: tgSeat,
                singer: ward && TGg.singerOf ? TGg.singerOf(tgSeat, ward) : null };
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
    if (FWg && hymnal && hymnal.length) {
      var fwStream = stream("guest:farward");
      // (its rows name the rite by its place in the plan: the hymnal's index)
      var fwRows = hymnal.filter(function (r) { return r.index != null; }).map(function (r) { return { id: r.id, section: r.index, dialect: r.dialect, piece: r.piece || (r.partnerOf ? "partner" : null), kind: r.kind || null }; });
      var fwSeat = FWg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, hymnal: fwRows, guests: seatedFor("farward"),
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
      var shSeat = SHg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("socialhall", "postlude"),
                              odds: oddsOf("socialhall", null), force: forcedType === "socialhall" }, shStream);
      if (shSeat && admit({ type: "socialhall", section: "postlude", at: shSeat.at, dur: shSeat.dur, fired: false, cued: true, stream: shStream, replaces: "postlude" })) {
        holdSection("postlude", shSeat.holdUntil);
        bake = true;          // (its room's own sounds baked ahead, in the page's idle time: the house's)
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
      var hcSeat = GHc.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("handcart"), odds: oddsOf("handcart", null), force: forcedType === "handcart" }, hcStream);
      if (hcSeat && admit({ type: "handcart", section: hcSeat.section, at: hcSeat.at, dur: hcSeat.dur, fired: false, cued: true, stream: hcStream })) holdSection(hcSeat.section, hcSeat.holdUntil);
    }
    if (GGu) {
      var gStream = stream("guest:gulls");
      var gSeat = GGu.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("gulls"), odds: oddsOf("gulls", null), force: forcedType === "gulls" }, gStream);
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
    // visitations: "guests-drawn" and the minutes must not name it.
    var hoSeat = hoAsk ? HOg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: seatedFor("hosanna"), odds: hoOdds, force: forcedType === "hosanna" }, hoStream) : null;
    if (!hoSeat) budget.reserved = null;
    hosanna = SUN && SUN.hosanna ? { possible: true, built: !!HOg, seat: hoSeat, fired: false, until: 0 } : null;
    hosannaStream = hoSeat ? hoStream : null;
    // THE TESTIMONY-BEARERS SPEAK (PLAN-COMPOSITION §5.2): the day's
    // testimony-bearers rise one by one and bear
    // testimony — a voice in speech, never in words, whose melody the
    // harmonium or the clarinet plays back and makes a tune of — and sit
    // down. Not guests: the testimony's own people, kept out of
    // visitations and the budget (no guest beside the testimony is refused
    // for them); a guest seated IN the testimony (the gift, the old tune)
    // keeps it for itself (kolob-testimony.js decides, on
    // guest:testimony:<n>). Cued as the testimony begins (the conductor's
    // enterSection).
    var TMg = KOLOB.Testimony || null;
    if (TMg && ward) {
      var tmStream = stream("guest:testimony");
      var tmSeat = TMg.plan({ n: n, kind: activity, sunday: sunday, sections: plan, guests: visitations,
                              bearers: (ward.roles.testimony || []).length || null, force: forcedType === "testimony" }, tmStream);
      if (tmSeat) { testimony = { seat: tmSeat, stream: tmStream, material: null, fired: false, until: 0 }; holdSection("testimony", tmSeat.holdUntil); }
    }
    // THE SEATINGS OF THE OTHER RITES (PLAN §7.4): the
    // invocation, an interlude, the testimony, the sacrament and the
    // postlude each draw how the house sits for them — the plain house,
    // lined out only, the brush arbor, an organ voluntary, the choir alone —
    // leaning by the Sunday, one die a rite on scenes:<n>, every die thrown;
    // and never two empty rites running (a hymn, the prelude and a rite a
    // guest is seated in are never empty). Drawn once every guest is seated.
    var scR = stream("scenes"), scs = CAL.scenes(plan, sunday, visitations, scR);
    scenes = scs.map(function (x, i) {
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
        var tIdx = indexOfSec("testimony");
        var nextRow = null;
        for (var nr = 0; nr < prep.rows.length && !nextRow; nr++) if (prep.rows[nr].index != null && prep.rows[nr].index > tIdx) nextRow = prep.rows[nr];
        if (nextRow && nextRow.piece !== "round" && !nextRow.partnerOf && (nextRow.section === "hymn" || (nextRow.section === "doxology" && !payoff))) {
          var gest = TGg.gesture(TGg.score({ mode: mode, keynoteHz: info.keynoteHz, house: house, part: tgV.seat.part }, tgV.stream, 0));
          if (gest && gest.length) { nextRow.gestures = gest; tgV.seeded = nextRow.id; }
        }
      }
      var rk = reckoningInfo(plan, prep.rows, CAL, scenes, visitations, mode);
      // (held: the switch is off — the same doxology, the drone at home)
      if (rk) reckoning = { planned: true, held: !info.reckoning, doxId: rk.doxId, sections: rk.sections.map(function (x) { return x.index; }), result: null };
      orders = { rows: prep.rows, forms: prep.fm, reckoning: rk };
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
    if (organist && HY && hymnal.length && info.pipeOn) {
      var fh = hymnal[0];
      var pd = OR.preludeDraw(organist, draws.castStream(n), {
        hymn: fh, trombones: !!dawn, withheld: !!cumulative, organSits: !!seating.sits.organ, unison: fh.dialect === "oldway" || fh.dialect === "shaker",
        guest: seating.name === "steeples" ? "the steeples" : seating.name === "school" ? "the singing school" : seating.name === "variations" ? "the organist's variations" : null, hum: !!seating.hum,
      });
      organist.preludeDraw = pd;
      if (pd.play) { seating = choraleSeating(seating); chorale = { hymnId: fh.id, begun: false, until: 0, plan: null }; }
    }
    return {
      sections: plan, visitations: visitations, budget: budget, hosanna: hosanna, hosannaStream: hosannaStream, testimony: testimony,
      seating: seating, scenes: scenes, chorale: chorale, house: house, hymnal: hymnal, forms: forms, payoff: payoff, reckoning: reckoning,
      organist: organist, ward: ward, ready: ready, bake: bake, orders: orders,
    };
  }
  // a seated guest's rite, by its place in the order of service: its own
  // index (the far ward's hymn is not the first hymn), or the first rite of
  // its section; -1 where the plan has none
  function placeOf(sections, V) { return typeof V.index === "number" ? V.index : indexOfRite(sections, V.section); }
  function indexOfRite(sections, type) { for (var q = 0; q < sections.length; q++) if (sections[q].type === type) return q; return -1; }

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
  //               (its amen is bowed, not played — the conductor's
  //               runJoint), the strings on bare fifths, the clarinet over
  //               them
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
  // (PR the meeting's prelude:<n>; SUN the Sunday's row of the calendar;
  // visitationOf the guests seated so far, by type)
  function seatPrelude(PR, SUN, visitationOf) {
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
    var mLean = SUN ? SUN.morning || {} : {};
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
  // (the prelude then goes on at least CHORALE_AFTER_S after the chorale's
  // end, the conductor's, kolob-meeting.js)
  var CHORALE_EST = 44;
  var SCHOOL_AFTER_S = 22;                       // the prelude goes on at least this long after the singing school's practice
  function choraleSeating(morning) {
    var spec = SEATINGS.chorale, U = morning._u.U, at = {};
    WAKERS.concat(["choir"]).forEach(function (l) {
      var r = spec.at[l] || CHOIR_CALL, x = r[0] + (r[1] - r[0]) * U[l];
      at[l] = x;
    });
    Object.keys(spec.anchored).forEach(function (l) { at[l] += at.organ + CHORALE_EST; });
    Object.keys(at).forEach(function (l) { at[l] = +at[l].toFixed(2); });
    at.voice = morning.at.voice;
    var out = {};
    for (var k in morning) out[k] = morning[k];
    out.name = "chorale"; out.at = at; out.full = morning._u.fullU < spec.full; out.sits = {}; out.fifths = false; out.hum = null;
    return out;
  }
  // THE VARIATIONS' MORNING: as the chorale
  // prelude's — the drone and the valley wake around the organist, and the
  // house (the organ's own chords too) waits for the end of the set, at the
  // length its plan estimated (the set made ready is held to exactly, by its
  // cue)
  function variationsSeating(morning, V) {
    var spec = SEATINGS.chorale, U = morning._u.U, at = {}, after = V.at + V.dur + 2;
    WAKERS.concat(["choir"]).forEach(function (l) { var r = spec.at[l] || CHOIR_CALL; at[l] = r[0] + (r[1] - r[0]) * U[l]; });
    Object.keys(spec.anchored).concat(["organ"]).forEach(function (l) { if (at[l] != null) at[l] += after; });
    Object.keys(at).forEach(function (l) { at[l] = +at[l].toFixed(2); });
    at.voice = morning.at.voice;
    var out = {}; for (var k in morning) out[k] = morning[k];
    out.name = "variations"; out.at = at; out.full = morning._u.fullU < spec.full; out.sits = {}; out.fifths = false; out.hum = null;
    return out;
  }

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
  // (the switch is the house's: handed in as info.reckoning, it only marks
  // the order held. scenes, visitations: the rites' seatings and the guests
  // as seated; mode the day's)
  function reckoningInfo(plan, rows, CAL, scenes, visitations, mode) {
    var dox = null, byIndex = {};
    for (var i = 0; i < rows.length; i++) { if (rows[i].index != null) byIndex[rows[i].index] = rows[i]; if (!dox && rows[i].section === "doxology") dox = rows[i]; }
    if (!dox || dox.index == null || dox.index < 1) return null;
    var secs = [];
    for (var j = 0; j < dox.index; j++) {
      var r = byIndex[j], sc = scenes && scenes[j];
      // (the sacrament seated plain, with no guest in it: STILL — the drone
      // is all there is, and the cantus may stand on any note of the tune)
      var still = plan[j].type === "sacrament" && (!sc || sc.name === "plain") && !visitations.some(function (v) { return v.section === "sacrament"; });
      secs.push({ index: j, type: plan[j].type, keyMonzo: r ? r.keyMonzo.slice() : [0, 0, 0, 0], mode: r ? r.mode : mode, still: still });
    }
    return { doxId: dox.id, sections: secs, candidates: CAL.RECKON_CANDIDATES };
  }

  return {
    day: day, seat: seat, placeOf: placeOf,
    MEETINGS: MEETINGS, SEASON_OF: SEASON_OF, F0_RANGE: F0_RANGE, CUMULATIVE_ODDS: CUMULATIVE_ODDS, FORCEABLE: FORCEABLE, SCHOOL_AFTER_S: SCHOOL_AFTER_S,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-plan.js"] = true;   // the load guard's roll call
