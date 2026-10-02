// ============================================================================
// KOLOB — kolob-meeting.js: the chorister
//
// The meeting conducted. What it is to be is the plan's (kolob-plan.js,
// KOLOB.Plan, pure: the Sunday, the keynote, the mode, the order of
// service, the guests against one budget, the day's hymnal, the ward and its
// organist, the prelude's seating); planMeeting asks the plan, writes what
// it decided into the house and tells it. Here: the guests' readiness off
// the clock, the sections entered, the conductor's tick (the stillness, the
// fuging entry, the guests' arrivals), the joints between sections and the
// reckoning at them, THE CHORISTER'S BOOK (S.Meeting: the
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
  // room is loaded before the first note, so the call always finds its owner;
  // each wrapper is named after the lend it calls and passes its arguments
  // through in order — tools/lends.js checks) ----
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
  function nauvooBand(V, t) { return S.nauvooBand(V, t); }
  function handcartCompany(V, t) { return S.handcartCompany(V, t); }
  function gullsOver(V, t) { return S.gullsOver(V, t); }
  function organistVariations(V, t) { return S.organistVariations(V, t); }
  function tonguesGift(V, t) { return S.tonguesGift(V, t); }
  function socialHall(V, t) { return S.socialHall(V, t); }
  function castEvent(c, ward) { return S.castEvent(c, ward); }
  function guestsLane(live) { return S.guestsLane(live); }
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
  // (the kinds of Sunday, MEETINGS, are the plan's: kolob-plan.js)
  // C, the conductor's state, lives three lifetimes. THE VISIT's:
  // meetingNum, from 1, begun again by resetVisit (a new seed). THE
  // MEETING's: meeting, plan, the guests (visitations, visitUntil,
  // visitType, visitSecond, visitLogged, budget, hosanna, hosannaStream,
  // testimony), the withheld tune (cumulative, assemblyFired,
  // assemblyUntil, payoff), raspberry, the seatings (seating, scenes,
  // chorale), the day's hymnal (house, hymnal, forms, reckoning), the
  // organist and the ward — resetMeetingState() is the one place they are
  // reset, as planMeeting begins, so nothing of the last meeting (one that
  // ran out or one stopped half-way) is read by the next; planMeeting then
  // fills them in from the plan (kolob-plan.js). THE SECTION's: si,
  // section, sectionStart, sectionDur, jointing, fromLevel, the fuging
  // (fugingPlanned, fugingFired,
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
    seating: null,               // the prelude's seating (THE PRELUDE'S SEATING, kolob-plan.js)
    house: null,                 // the house dialect (THE DAY'S HYMNAL, kolob-plan.js)
    hymnal: [],                  // the day's hymns: a row per singing section, in order
    hymn: null,                  // the composed hymn being sung: { id, row, active, until, from }
  };
  var forceVisitation = false;   // the 𐐌𐐚𐐞 switch: guarantee a guest next meeting
  var forceRaspberry = false;    // dev/test hook only — never part of the 𐐌𐐚𐐞 pool
  // CUMULATIVE FORM's governor — the 𐐐𐐄𐐢 pill: "always" | "natural" | "never"
  // (its natural odds, the ONE number, are the plan's CUMULATIVE_ODDS:
  // kolob-plan.js, lent below as S.CUMULATIVE_ODDS for the page's switch)
  var cumulativeMode = "natural";
  // THE PLAN (kolob-plan.js, KOLOB.Plan): the Sunday, the keynote, the mode,
  // the order of service and every die of meeting:<n>, pure — handed what
  // the house knows and the streams it throws on, and conducted here.
  // Required, as the calendar is: _engine.php loads it ahead of this room,
  // and tools/loadcheck.js fails a list that does not
  function Plan() { return KOLOB.Plan; }
  // (the calendar is required: every page that plays a meeting loads it
  // ahead of this room, on _engine.php's list, and tools/loadcheck.js fails
  // a list that does not)
  function Calendar() { return KOLOB.Calendar; }
  var seasonPos = 0;             // the Sunday's warmth, 0 the fast-day trough … 1 the festival (the plan's day)

  // THE RECKONING'S SWITCH (?exp=-reckoning): off, the plan's order for the
  // doxology is held and only the drone stays home (THE RECKONING'S ORDER,
  // kolob-plan.js, says why the switch does not reach the desk)
  function reckoningOn() { return !(KOLOB.Experimental && KOLOB.Experimental.isOn && !KOLOB.Experimental.isOn("reckoning")); }

  // THE MEETING'S STATE (C, above): every field a meeting owns, set to what
  // it is before anything is planned. planMeeting fills each in below from
  // the plan (KOLOB.Plan); nothing reads one between here and there, so a
  // field the plan once cleared where it was drawn reads the same, and one
  // it cleared only on one road (the reckoning, inside the day's hymnal) is
  // clear on every road. It throws no die. (The payoff is set from the
  // withheld tune where that is drawn.)
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

  // THE PLAN — every decision of the meeting is the plan's (kolob-plan.js,
  // KOLOB.Plan: pure, every die thrown in one fixed order whether it is used
  // or not — SCORE.md §3: a hymn not sung, a guest refused, a switch that
  // forces another guest in, none of them shifts a die that follows). This
  // function asks it in its two halves, handing each what the house knows
  // and the core's streams: the day, and — once the house is tuned to the
  // day and the day's gestures are drawn — the seating. It writes what the
  // plan decided into the house (the tuning, the motif, C), and tells it and
  // posts what is made off the clock in the order the plan always did. t is
  // the downbeat or the joint that calls it.
  function planMeeting(t) {
    C.meetingNum++;
    resetMeetingState();
    // (the reckoning: a new meeting's drone stands on its keynote — a meeting
    // ends home, so this is a turn only after a dev jump or a STOP while the
    // drone stood off home; a new seed's drone is let go at the reseed)
    if (S.droneNote && S.droneTurn && S.droneNote().mul !== 1) S.droneTurn(t, [0, 0, 0, 0], 3, "tonic", null);
    var draws = { stream: stream, castStream: S.castStream || null };
    // THE DAY (KOLOB.Plan.day): the season, the keynote, the Sunday, the
    // mode, the order of service, the arc of light, the plan's own guest
    // dice and the switch's pick, the withheld tune and the raspberry amen
    var today = Plan().day(C.meetingNum, { calendar: Calendar(), forceVisitation: forceVisitation, forceRaspberry: forceRaspberry, cumulativeMode: cumulativeMode }, draws);
    // the house tuned to the day — its keynote, its warmth, its Sunday, its
    // mode — and a clean page in the chord book
    S.F0 = today.F0;
    seasonPos = today.seasonPos;
    C.meeting = today.meeting;
    S.mode = today.mode;
    rebuildScale();
    Desk.reset(true);               // a new tuning: a clean page in the chord book, and the meeting's count of fifths
    // the withheld tune and the raspberry amen, as the day drew them
    // (CUMULATIVE FORM and THE RASPBERRY AMEN, kolob-plan.js) — set BEFORE
    // Motif.newMeeting(): the theme-length guard there reads the withheld
    // tune's flag in the moment. The day's gestures are drawn (motif:<n>)
    // and told; the seating seeds the day's hymns from them
    C.cumulative = today.cumulative;
    C.raspberry = today.raspberry;
    Motif.newMeeting(moment(), stream("motif"));
    if (C.cumulative) {
      var wTheme = Motif.theme();
      emitEvent({
        type: "guest", guest: "assembly", stage: "withheld", logged: true, theme: wTheme ? wTheme.name : null,
      });
    }
    // THE SEATING (KOLOB.Plan.seat): the guests against one budget, the
    // prelude's seating, the day's hymnal and forms, the organist and the
    // ward, the testimony, the Hosanna, the other rites' seatings, the
    // gift's seed, the reckoning's order and the chorale prelude — handed
    // what only the house knows: whether the pipes sound, the switches, the
    // Earth tunes its tuning admits, the keynote, the day's gestures (as
    // degrees), and its own pen for the dawn's chorale where no composer is
    // loaded (dawnChorale, below)
    var th = Motif.theme(), subsM = Motif.subs ? Motif.subs() : [];
    var seated = Plan().seat(today, {
      calendar: Calendar(), forceVisitation: forceVisitation, pipeOn: !!(S.pipeOn && S.pipeOn()),
      experimental: KOLOB.Experimental ? KOLOB.Experimental.snapshot() : {}, reckoning: reckoningOn(),
      oldTunes: oldTuneCandidates(), keynoteHz: S.F0 * S.ROOT_MULT,
      theme: th ? th.notes.map(function (x) { return x.deg; }) : null,
      subs: subsM.map(function (m) { return m.notes.map(function (x) { return x.deg; }); }),
      dawnChorale: dawnChorale,
    }, draws);
    // the meeting as the plan seated it (C)
    var plan = C.plan = seated.sections;
    C.si = 0;
    C.visitations = seated.visitations; C.budget = seated.budget;
    C.hosanna = seated.hosanna; C.hosannaStream = seated.hosannaStream; C.testimony = seated.testimony;
    C.seating = seated.seating; C.scenes = seated.scenes; C.chorale = seated.chorale;
    C.house = seated.house; C.hymnal = seated.hymnal; C.forms = seated.forms; C.payoff = seated.payoff; C.reckoning = seated.reckoning;
    C.organist = seated.organist; C.ward = seated.ward;
    // TOLD AND POSTED, in the order the plan told and posted them when it
    // was this room's own code: the day's hymnal; the variations made ready
    // and the Social Hall's sounds baked, each by a timer of its own; the
    // guests drawn; the hymns ordered from the composer's desk; the
    // prelude's seating; the calendar; then the first section, the Liahona
    // and the meeting's start
    var orders = seated.orders, fm = C.forms;
    // (typed only, as new words are: SCORE §9.5)
    if (orders) emitEvent({ type: "hymnal", house: C.house, hymns: orders.rows.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, key: r.key, meter: r.meter, piece: r.piece || (r.partnerOf ? "partner" : "hymn") }; }),
                            forms: fm ? { round: fm.round, partner: fm.partner, refrain: fm.refrain ? { id: fm.refrain.id, dialect: fm.refrain.dialect, after: fm.refrain.statements.map(function (x) { return x.after; }) } : null, payoff: fm.payoff, why: fm.dice.why } : null });
    if (seated.ready) readyAhead(seated.ready, variationsMaterial);
    // (the Social Hall's own sounds — the floor, the claps, the benches —
    // baked once for the page's context in its idle time, off the clock:
    // about 45 ms, which the dance's first ticks would otherwise pay; asked
    // again when the timer comes, as readyAhead's poll is, so a STOP inside
    // the 2.5 s leaves the page idle — each kind is then baked when first
    // wanted, as before; a bake that throws is told, and the same holds)
    var SHg = KOLOB.GuestSocialHall || null;
    if (seated.bake && SHg && SHg.bake && S.ctx && S.playing && typeof setTimeout !== "undefined") setTimeout(function () { if (S.ctx && S.playing) S.confess("the Social Hall's sounds could not be baked ahead (each is baked when first wanted)", function () { SHg.bake(S.ctx); }); }, 2500);
    if (C.visitations.length) emitEvent({
      type: "guests-drawn", guests: C.visitations.map(function (v) { return { guest: v.type, section: v.section, index: Plan().placeOf(plan, v) }; }),
    });
    // THE DAY'S HYMNS ORDERED (the desk writes them off the audio path),
    // with the reckoning's order laid on the doxology's
    if (orders) Hymnal().prepare(S.visitSeed(), C.meetingNum, orders.rows, orders.forms, orders.reckoning);
    var CAL = Calendar(), sunday = today.sunday, activity = today.activity, SUN = CAL.SUNDAYS[sunday], A = today.row;
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

  // THE CHORALE PRELUDE'S MORNING is seated by the plan (kolob-plan.js THE
  // PRELUDE'S SEATING, with every other morning); once the chorale has
  // begun, the prelude goes on at least this long after its end (the house
  // wakes into it)
  var CHORALE_AFTER_S = 26;
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
    // the section's hymn, written ahead (THE DAY'S HYMNAL, kolob-plan.js):
    // asked for now (kolob-hymnal.js has it waiting; a late one is written
    // here, counted)
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
      default: break;                  // (a section not named: the level below)
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
      assemblyArrives(t, cumulativeAssembly);
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
  var VISIT_FN = { bands: nauvooBand, steeples: steeplesAnswer, oldtune: oldTuneRemembered, trombones: trombonesAtDawn,
                   handbells: handbellsRing, singingschool: singingSchool,
                   // (every set piece is kolob-guests.js's, borrowed above — the
                   // far ward is not here: it sings inside the ward's own hymn;
                   // nor the Hosanna, which comes at the doxology's close, unlogged)
                   handcart: handcartCompany, gulls: gullsOver, variations: organistVariations, tongues: tonguesGift,
                   socialhall: socialHall };
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
  // A GUEST OF THE MEETING'S OWN STANDS — the far ward, the Hosanna, the
  // testimony-bearers, whom the meeting performs itself: every slice, row and
  // cast they lay out ahead asks it when its cue comes — while the music
  // plays, while the meeting is the one that seated it (n), and while
  // still(), its own record still held, holds. (The glue's guests ask the
  // same through the chorister's book: kolob-guests.js C_live.)
  function standsFor(n, still) { return function () { return !!S.playing && C.meetingNum === n && (!still || !!still()); }; }
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
    var live = standsFor(n, function () { return C.visitations.indexOf(V) >= 0; });
    try {
      V.prepared = FW.prepare({ hymn: h, keynoteHz: S.F0 * S.ROOT_MULT }, V.stream);
      V.stage = FW.stage(S.ctx, S.wideSend(), V.prepared, V.stream, {
        defer: guestsLane(live),
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
        defer: guestsLane(standsFor(n)),
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
    var live = standsFor(n, function () { return C.testimony === T; });
    var end = KOLOB.Testimony.perform(S.ctx, S.seatedSend("speaker"), tc, T.material, T.stream, {
      dests: { speaker: S.seatedSend("speaker"), harmonium: S.seatedSend("reed"), clarinet: S.seatedSend("reed") },
      defer: guestsLane(live),
      onNote: function (x) {
        emitNote(x.layer, x.freq, x.t, x.dur, { part: x.part, member: x.member, speech: !!x.speech, deg: x.deg, monzo: x.monzo, keyMonzo: x.keyMonzo, move: x.move || null, accent: x.accent, testimony: true });
      },
      onStage: function (st) {
        var ev = { type: "testimony", stage: st.stage, memberId: st.member || st.memberId || null, section: "testimony" };
        if (st.t0 == null || st.t0 <= now() + 1e-6) emitEvent(ev); else cueAt("guests", st.t0, function () { if (live()) emitEvent(ev); });
      },
      onCast: function (c) {
        cueAt("guests", Math.max(c.t, now()), function () {
          if (live()) emitEvent(castEvent(c, C.ward));
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
    var hold = (V.at || 0) + V.dur + (V.type === "singingschool" ? Plan().SCHOOL_AFTER_S : 3);
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
  // THE WHOLE TUNE AT LAST (the cumulative form): the withheld tune is
  // marked sung before a note of it sounds, and its span — play(t) lays the
  // assembly out from t and returns how long it sounds — is held and told
  // as a guest's: the conductor's own assembly (cumulativeAssembly,
  // kolob-guests.js), or a composed doxology's first verse, already laid
  // out by the ward (hands.assemblyBegins)
  function assemblyArrives(t, play) {
    C.assemblyFired = true;
    var dur = play(t);
    C.assemblyUntil = t + dur;
    guestSpan("assembly", t, dur);
  }
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
    // (from where the drone stands: a stillness can fall inside another
    // step back — THE DRONE STEPS BACK, kolob-core.js)
    S.droneStepBack(t, null, 0.12, 1.4, null, true);
    if (forkDie) evTuningFork(t + forkAt);
    S.droneComesBack(t + 1.4 + holdS, 0.12, 3);
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
      // the brush arbor has no organ (kolob-plan.js, THE PRELUDE'S
      // SEATING): its amen is bowed — the strings on each chord's bare
      // fifth — and the organist is
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
  //   sunday()        the kind's row of MEETINGS (kolob-plan.js) with the
  //                   Sunday's plan laid over it (silenceMul, hymns, bells,
  //                   choirSize, bright, meterW; sunday: the Sunday's id),
  //                   or null — NOT the calendar's Sunday, which is day():
  //                   the names clash, and every voice reads sunday() for
  //                   the row
  //   section()       the rite now: prelude … postlude, or interlude
  //   sectionIndex()  its place in the plan;  plan() the plan's sections'
  //                   types (one array a plan, shared: read, never written)
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
  // the day's hymnal's row for a hymn id (THE DAY'S HYMNAL, kolob-plan.js),
  // or null
  function hymnalRow(id) {
    for (var i = 0; i < C.hymnal.length; i++) if (C.hymnal[i].id === id) return C.hymnal[i];
    return null;
  }
  // the rite's seating, as drawn (THE SEATINGS OF THE OTHER RITES, in the
  // plan's seating, kolob-plan.js): null for a hymn, the prelude (seated by
  // its own) and the plain house
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
    // the assembly — its span told as the conductor's own assembly's is
    // (assemblyArrives)
    assemblyBegins: function (t, dur) {
      if (!C.cumulative || C.assemblyFired) return false;
      assemblyArrives(t, function () { return dur; });
      return true;
    },
  };
  function hymnId() {
    var k = 0;
    for (var i = 0; i <= C.si && i < C.plan.length; i++) if (C.plan[i].type === "hymn" || C.plan[i].type === "doxology") k++;
    return "h:" + C.meetingNum + ":" + Math.max(1, k);
  }
  // the plan's sections by type, mapped once a plan (the page's poll asks
  // for them every 300 ms of a meeting, through getConductor): a plan is
  // replaced whole, never edited but for a section's length, so the array
  // stands until C.plan does. It is shared: read it, never write it.
  var planTypes = { of: null, types: null };
  function planTypesNow() {
    if (planTypes.of !== C.plan) { planTypes.of = C.plan; planTypes.types = C.plan.map(function (s) { return s.type; }); }
    return planTypes.types;
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
    // the rite's seating (THE SEATINGS OF THE OTHER RITES, kolob-plan.js):
    // its name and what it asks of the house ({name, sits, lean, lined,
    // fifths, hum, forced}), or null (a hymn, the prelude, the plain house)
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
    plan: function () { return planTypesNow(); },
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
    // the prelude's seating (THE PRELUDE'S SEATING, kolob-plan.js): its
    // name, the waking's entrances (s after the downbeat), whether the first
    // chord is full, who sits the prelude out, and whether the strings keep
    // to bare fifths
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
    // OTHER RITES; both the plan's, kolob-plan.js); under 1 it plays more,
    // over 1 less; 1 where neither names the voice
    lean: function (layer) {
      var L = C.section === "prelude" && C.seating ? C.seating.lean[layer] : null;
      // (every other rite leans by its own seating)
      if (L == null && C.section !== "prelude") { var sc = sceneNow(); L = sc && sc.lean ? sc.lean[layer] : null; }
      return L > 0 ? L : 1;
    },
    hymnId: hymnId,
    moment: moment,
    // THE DAY'S HYMNAL (kolob-plan.js): the house dialect, the day's hymns
    // (a row per singing section: id, dialect, key, meter, mode — a copy), the
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
      // id while a hymn is sung. The desk tells it at t, the cadence's FIRST
      // chord, as it writes the close; the ward's own fuging tells its close
      // at its SECOND chord, as it lands — wardFuging, kolob-voices-choir.js.
      // Two moments on purpose, not a copy to fold: the dumps and the tools
      // that count cadences have always read each where it is)
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
  S.CUMULATIVE_ODDS = Plan().CUMULATIVE_ODDS;
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
  // (MEETINGS and F0_RANGE are the plan's, named here as they always were)
  KOLOB.Meeting = { MEETINGS: Plan().MEETINGS, book: Book, desk: Desk, planMeeting: planMeeting, conductorTick: conductorTick, runJoint: runJoint, dawnChorale: dawnChorale, F0_RANGE: Plan().F0_RANGE };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-meeting.js"] = true;   // the load guard's roll call
})();
