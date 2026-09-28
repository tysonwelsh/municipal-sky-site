// ============================================================================
// KOLOB — kolob-hymnal.js: the day's hymnal
//
// Round 3's integration: the meeting sings composed hymns. The composer
// (kolob-composer.js) writes a hymn at a desk of its own; this room is the
// chorister's hymnal for one Sunday — which style the house sings in, each
// hymn's style and key, the order the hymns are written in — and the errand
// boy who carries the orders to the composer's desk and the finished hymns
// back, so that the writing never happens where the music is being played.
//
// THE HOUSE DIALECT (PLAN-COMPOSITION §3, "how dialects are chosen"). Each
// Sunday draws a house dialect from the six the composer writes — the
// Tabernacle (C), the Sacred Harp (A), the Old Way (F), New England
// psalmody (B, the fuging tunes), gospel and barbershop (D) and the Shaker
// and Primary song (E) — at odds set by the kind of Sunday: a fast Sunday
// leans to the Sacred Harp, the Old Way and the psalmody; a conference to
// the Tabernacle, with gospel after it; a jubilee to the Tabernacle and the
// gospel ring; an ordinary Sunday mixes. Each hymn then draws its own
// dialect, weighted toward the house's. (A dialect is drawn only once
// KOLOB.Dialects has built it; all six are built since round 3.) The
// calendar's Sundays (step 4) lean the odds further: SUNDAY_LEAN, KIND_LEAN.
//
// THE DAY'S FORMS (round 3b, step 3: forms, below) — a round, the partner
// hymn, the wandering refrain, and the doxology's one payoff — are drawn with
// the plan on their own stream, and the composer's desk writes them as it
// writes the hymns: a round (round()), the partner on the first hymn
// (partner()), the refrain as written (wanderingRefrain()) and each of its
// statements set in the key and dialect of the hymn it follows (refrainIn()).
//
// THE LIGHT (round 3b, step 4; PLAN §7.3). Each hymn's dialect is drawn
// leaning by the light of its section, from the calendar's arc: a hymn sung
// early in the morning leans to the plain and open styles (the Sacred Harp,
// the Old Way, the Shakers), the hymns grow fuller one after another, and
// the doxology, full light, leans hard to the Tabernacle and the gospel ring
// — the sevenths, the full organ (KOLOB.Calendar.dialectLean). The house
// dialect itself is the Sunday's, drawn as before.
//
// THE RECKONING (round 3b, step 4; PLAN §7.2). On a Sunday the drone reckons
// (kolob-calendar.js), the doxology's order carries the sections before it:
// the desk writes the doxology — the composer's first, and then up to
// seven more on the stream's reckoning:<k> forks — and keeps the first whose
// opening notes stand, one a section, on each section's key (the tonic, the
// third or the fifth), marking it hymn.reckoning = {ok, k, from, cantus}. If
// none does, it keeps the first as written, marked {ok: false}: the meeting
// falls back to the drone on the keynote. The same by every road (the worker
// loads kolob-calendar.js too).
//
// KEYS PER HYMN (§3.7). The chorister keys each hymn from the day's keynote:
// at home, or a just fourth away either way (4/3 up, the subdominant; 3/4
// down, the dominant) — never further, and with a pull toward home: a hymn
// sung away is usually followed by one at home, the day's first hymn is
// usually at home (always, when the trombones play it at dawn), and the
// doxology is always at home. The organ modulates into a hymn sung away
// through a chord the two keys share (kolob-voices-organ.js).
//
// THE ERRAND (compose ahead, never on the audio path). Composing costs tens
// to hundreds of milliseconds, with a long tail. The clock looks a quarter
// of a second ahead; a callback that stalls longer than that places its
// notes in the past. So the plan only writes the ORDERS (cheap, pure), and
// the writing is done elsewhere:
//   1. in a Web Worker, when the page has one: the composer's own rooms are
//      loaded into it (the same files, by the same versioned URLs the page
//      loaded), and the finished hymns come back by message — the main
//      thread pays only the copy;
//   2. else in idle slices of the main thread (a timer, one hymn a slice),
//      outside every clock callback;
//   3. and if a hymn is asked for before it has come back — a slow machine,
//      a worker that failed to load — it is written there and then, and the
//      hymnal says so (stats().late). The hymn is the same hymn by every
//      road: the composer is pure, its stream is hymn:<n>:<i> off the
//      visit's seed, and the meeting's earlier hymns are handed to it in the
//      same order and the same (lightened) form.
//
// Public surface: KOLOB.Hymnal = {
//   plan(info, R)       → { house, rows } (pure: the day's dialects and keys)
//   forms(info, rows, R) → { round, partner, refrain, payoff, dice } (pure;
//                          marks the rows it makes a round or a partner)
//   prepare(seed, n, rows, forms)  the orders, posted (the forms' too)
//   get(id), ready(id), hymnOf(id), book()   the hymns
//   stats(), warm(), backend(), setBackend(name)
//   timeline(h, lines, beatS), verseSeconds(h, beatS)   (pure helpers)
//   HOUSE_ODDS, NEIGHBOURS, KEYS, SUNDAY_LEAN, KIND_LEAN, FORM_ODDS,
//   PARTNER_DIALECTS, REFRAIN_SET }
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  var S = KOLOB._s = KOLOB._s || {};

  // ==========================================================================
  // THE HOUSE DIALECT AND EACH HYMN'S (pure)
  // ==========================================================================
  // (weights; a dialect the composer has not built yet is left out of the
  // pool when it is read. An ordinary Sunday mixes, the Tabernacle — the
  // home dialect, PLAN §3.C — leading it. Measured over 2000 first meetings
  // of the calendar (round 3b, step 3): the house is the Tabernacle 43 %,
  // the Sacred Harp 23 %, the Old Way 12 %, gospel 9 %, the psalmody 8 %,
  // the Shakers 5 %; handoff r3b-styles-1 has each kind's)
  var HOUSE_ODDS = {
    ordinary:   { tabernacle: 5.0, sacredharp: 2.4, oldway: 1.5, psalmody: 1.2, gospel: 0.8, shaker: 0.6 },
    fast:       { sacredharp: 4.2, oldway: 3.4, tabernacle: 0.7, psalmody: 1.0, shaker: 0.8 },
    conference: { tabernacle: 7.0, sacredharp: 1.0, oldway: 0.3, gospel: 1.2, psalmody: 0.5 },
    jubilee:    { tabernacle: 5.0, sacredharp: 1.0, gospel: 3.0, shaker: 0.6 },
  };
  // a hymn's own dialect, given the house's: the house's own at 6, its
  // neighbours at these weights (a Sacred Harp house sings the Old Way
  // sooner than the Tabernacle; the Tabernacle's house seldom lines out)
  var NEIGHBOURS = {
    tabernacle: { sacredharp: 0.9, oldway: 0.35, gospel: 0.8, psalmody: 0.5, shaker: 0.3 },
    sacredharp: { oldway: 1.0, tabernacle: 0.45, psalmody: 1.0, shaker: 0.3 },
    oldway:     { sacredharp: 1.3, tabernacle: 0.5, shaker: 0.5 },
    psalmody:   { sacredharp: 1.2, tabernacle: 0.8, oldway: 0.4 },
    gospel:     { tabernacle: 1.5, shaker: 0.6, sacredharp: 0.3 },
    shaker:     { oldway: 1.0, sacredharp: 0.6, tabernacle: 0.6 },
  };
  var HOUSE_W = 6;
  // the brush arbor (the prelude's seating with no organ) is the Sacred
  // Harp's own place: an arbor morning leans the house to it — and, since
  // round 3b, to its elder sister the psalmody (the fuging tunes were
  // Yankee meeting-house music, sung without an organ, as the arbor sings)
  var ARBOR_LEAN = { sacredharp: 2.2, oldway: 1.4, psalmody: 1.6 };
  // THE CALENDAR'S SUNDAYS (PLAN-COMPOSITION §7.1 — FORM's, round 3b step
  // 4). The four kinds above are the house's own; when the calendar names
  // the Sunday (info.sunday), its lean multiplies the kind's odds — the
  // hooks are here now so that step 4 only names the day. Christmas sings
  // shape-note carols and the Primary; Pioneer Day the gospel ring; Easter
  // and a dedication the Tabernacle in full; a funeral is slow and hopeful
  // (the Tabernacle's "all is well", the Old Way); a wedding gentle. Until
  // the calendar is drawn, info.sunday is null and nothing here is read.
  var SUNDAY_LEAN = {
    christmas:  { shaker: 2.4, sacredharp: 1.4, psalmody: 1.2 },
    pioneer:    { gospel: 2.6, shaker: 1.3, sacredharp: 1.2 },
    easter:     { tabernacle: 1.6, gospel: 1.2 },
    dedication: { tabernacle: 1.8 },
    funeral:    { tabernacle: 1.4, oldway: 1.6, gospel: 0.3, shaker: 0.5 },
    wedding:    { tabernacle: 1.3, shaker: 1.4, gospel: 1.2, oldway: 0.4 },
  };
  // …and which of the unison song's three kinds (dialect E) the Sunday
  // leans to: Christmas and a wedding the children's Primary song, Pioneer
  // Day the Shakers' dancing hymn. (The composer draws the kind itself; a
  // lean is handed down only when the calendar names the day.)
  var KIND_LEAN = { christmas: "primary", wedding: "primary", pioneer: "shaker" };

  // THE KEYS — a monzo relative to the day's keynote. A just fourth either
  // way is the smallest move to a new tonic, so the tune's octave (which the
  // composer seats by the key's height) moves least.
  var KEYS = {
    home: [0, 0, 0, 0],
    sub:  [2, -1, 0, 0],                         // 4/3: up a fourth, the subdominant
    dom:  [-2, 1, 0, 0],                         // 3/4: down a fourth, the dominant
  };

  function built(name) { return !!(KOLOB.Dialects && KOLOB.Dialects.get && KOLOB.Dialects.get(name)); }
  function poolOf(table, lean, lean2) {
    var out = [];
    for (var k in table) if (Object.prototype.hasOwnProperty.call(table, k) && built(k)) out.push([k, table[k] * ((lean && lean[k]) || 1) * ((lean2 && lean2[k]) || 1)]);
    return out.length ? out : [["tabernacle", 1]];
  }

  // plan(info, R): the day's hymnal, from R (the meeting's hymnal:<n>
  // stream). Every die is thrown for every singing section in the plan,
  // used or not, so a change of one hymn's dialect never moves another's key.
  //   info: { n, kind, sunday?, mode, sections: [{type, meter, index, mode,
  //           light}], seating (its name), trombones (the dawn plays the
  //           first hymn), cumulative, theme ([deg]), subs ([[deg]]) }
  //   → { house, rows: [{ i, id, section, meter, dialect, key, keyMonzo,
  //                       mode, gestures }] }
  function plan(info, R) {
    var kind = HOUSE_ODDS[info.kind] ? info.kind : "ordinary";
    var houseDie = R.fork("house").next();
    var sunLean = info.sunday && SUNDAY_LEAN[info.sunday] ? SUNDAY_LEAN[info.sunday] : null;
    var house = pickWith(houseDie, poolOf(HOUSE_ODDS[kind], info.seating === "arbor" ? ARBOR_LEAN : null, sunLean));
    var rows = [], k = 0, prevAway = false;
    var singing = (info.sections || []).filter(function (s) { return s.type === "hymn" || s.type === "doxology"; });
    singing.forEach(function (s, j) {
      k++;
      var Rh = R.fork("hymn:" + k);
      var dDie = Rh.next(), kDie = Rh.next(), awayDie = Rh.next();
      var dox = s.type === "doxology";
      // the hymn's dialect: the house's, or a neighbour now and then; the
      // doxology leans to the Tabernacle's brightness on a Tabernacle or an
      // ordinary Sunday, and keeps the house's voice on a fast one
      var nb = NEIGHBOURS[house] || {}, table = {};
      table[house] = HOUSE_W;
      for (var d in nb) if (d !== house) table[d] = nb[d];
      if (dox && house !== "sacredharp" && house !== "oldway") table.tabernacle = (table.tabernacle || 0) + 2;
      // (the light of the hymn's section leans it: plain early, the
      // Tabernacle and the gospel ring at full light — round 3b, step 4)
      var litLean = s.light != null && KOLOB.Calendar && KOLOB.Calendar.dialectLean ? KOLOB.Calendar.dialectLean(s.light) : null;
      // (and the Sunday leans its doxology: a funeral rising into the
      // Tabernacle's "all is well", Easter's and a dedication's full
      // Tabernacle, Pioneer Day's gospel ring)
      var SD = dox && info.sunday && KOLOB.Calendar && KOLOB.Calendar.SUNDAYS[info.sunday] ? KOLOB.Calendar.SUNDAYS[info.sunday].dox : null;
      if (SD && litLean) { var lt2 = {}; for (var lk in litLean) lt2[lk] = litLean[lk] * (SD[lk] != null ? SD[lk] : 1); litLean = lt2; }
      var dialect = pickWith(dDie, poolOf(table, litLean, sunLean));
      // the key: home, or a fourth away, pulled home
      var key = "home";
      if (!dox) {
        var pHome = j === 0 ? (info.trombones ? 1 : 0.7) : (prevAway ? 0.8 : 0.45);
        if (kDie >= pHome) key = awayDie < 0.55 ? "dom" : "sub";
      }
      prevAway = key !== "home";
      // the material line one is seeded from (step 4 of the composer): the
      // day's theme for the first hymn and for the doxology — the theme comes
      // home at the end — and the day's other gestures between. On a
      // withheld Sunday (the cumulative form) only the doxology may carry the
      // theme: it is the tune assembled at last.
      var subs = info.subs || [], g = null;
      if (dox) g = info.theme;
      else if (info.cumulative) g = subs.length ? subs[(k - 1) % subs.length] : null;
      else g = k === 1 ? info.theme : (subs.length ? subs[(k - 2) % subs.length] : info.theme);
      rows.push({
        i: k, id: "h:" + info.n + ":" + k, section: s.type, index: s.index != null ? s.index : null,
        meter: s.meter || null, dialect: dialect, key: key, keyMonzo: KEYS[key].slice(), mode: s.mode || info.mode, light: s.light != null ? s.light : null,
        gestures: g && g.length ? [g.slice()] : null,
      });
      // (the calendar's lean on the unison song's kind: step 4's hook)
      if (dialect === "shaker" && info.sunday && KIND_LEAN[info.sunday]) rows[rows.length - 1].kind = KIND_LEAN[info.sunday];
    });
    return { house: house, rows: rows };
  }
  function pickWith(u, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = u * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // THE DAY'S FORMS (round 3b, step 3; PLAN-COMPOSITION §14 item 2, §15
  // item 4) — three pieces that are not one hymn after another, drawn with
  // the plan on their own stream (forms:<n>), every die thrown whether it is
  // used or not, so a Sunday without them is the Sunday it was:
  //
  //   A ROUND — now and then a hymn is sung as a canon over a short ground
  //     (the composer's round()): the ward goes in by sections or by the
  //     pews, one entry after another, and each group goes round and drops
  //     out in the order it came in. Never the day's first hymn (the dawn's
  //     trombones, the organist's chorale prelude, the singing school, the
  //     bells and the partner all take that one up), never the doxology.
  //   THE PARTNER HYMN — the closing hymn (the doxology) written on the
  //     first hymn's chords, in its meter, mode and key; in its last verse
  //     the organ, or a cornet of the ward's band, plays the first hymn
  //     against it (the composer's partner(), whose strict fit check falls
  //     back to "not combined": then the doxology is a hymn of its own in
  //     the first one's meter, sung as any other). Only where the first hymn
  //     is at home (the doxology always is) and the doxology keeps the day's
  //     mode (no sunrise); never on a Sunday of the cumulative assembly.
  //   THE WANDERING REFRAIN — two lines in the camp-meeting lilt that belong
  //     to the meeting (the composer's wanderingRefrain(), fitted to the
  //     day's keys): the enthusiast starts it alone after the first hymn's
  //     last verse and the ward takes it up; it comes back after a later
  //     hymn, in that hymn's key and dialect (refrainIn); and in the
  //     doxology the ward sings it unprompted — three statements at most.
  //     Never on a fast Sunday or at a funeral.
  //
  // THE DOXOLOGY'S ONE PAYOFF (the rule). The doxology pays off ONE of the
  // meeting's threads: the tune withheld and assembled at last (the
  // cumulative form), the partner hymn, the refrain — or, on a Sunday with
  // none of them, the bands crossing it. So the payoff is decided here, on
  // one die: the assembly when the tune is withheld, else the partner from
  // the die's bottom and the refrain from its top (the two can never both
  // land), each where it may sit; the meeting moves the bands out of the
  // doxology whenever the payoff is another's (kolob-meeting.js).
  //
  // THE ODDS. Each is tuned so that, over the calendar's kinds, the round
  // lands about one meeting in five, the partner hymn is composed for about
  // one in four and the refrain sung in about one in four: where a form may
  // not sit (a fast Sunday has one hymn and no refrain; a partner wants the
  // first hymn at home) its die reads a little higher where it may. (The
  // partner's fit check then combines the two tunes in about a third of
  // those — the composer's strictness, a loose fit being mud.)
  var FORM_ODDS = { round: 0.22, partner: 0.68, refrain: 0.32 };
  // the first hymns a partner is written on, and the dialect it is written
  // in — only where the composer's fit check can pass. Measured (hymns of
  // this round, 14 tries each): the Tabernacle on the Tabernacle combines
  // half the time (20 of 40); one tune on one tune nearly always (the
  // Shakers 6 of 7; an Old Way tune, sung plainly as the Shakers sing,
  // under a unison closing hymn 7 of 12). The Sacred Harp (0 of 36), gospel
  // (0 of 13) and the psalmody (0 of 12) never did, in their own dialect
  // or under a Tabernacle partner: their open fifths, swipes and fuges are
  // not chords a second tune can stand on. So they take no partner.
  var PARTNER_DIALECTS = { tabernacle: "tabernacle", shaker: "shaker", oldway: "shaker" };
  var PARTNER_TRIES = 14;
  // the dialect a statement of the refrain is set in, given the hymn it
  // follows: its own where the composer sets a tune anew in it; the Sacred
  // Harp's plain chords after a fuging tune; one tune, sung in unison, after
  // the Old Way (the ward bursting into the lilt after the slow lined hymn)
  var REFRAIN_SET = { tabernacle: "tabernacle", gospel: "gospel", shaker: "shaker", sacredharp: "sacredharp", psalmody: "sacredharp", oldway: "shaker" };
  // (and the dialect it is written in: the first hymn's, where the lilt's
  // own composer writes in it; else the camp meeting's own, gospel)
  var REFRAIN_WRITE = { tabernacle: 1, gospel: 1, shaker: 1 };
  var NO_REFRAIN = { fast: 1, funeral: 1 };
  // forms(info, rows, R) — pure. info: { n, kind, sunday?, cumulative };
  // rows: plan()'s; R: the meeting's forms:<n> stream.
  //   → { round: {i, id} | null, partner: {i, id, of} | null,
  //       refrain: { id (r:<n>:0, as written), dialect, mode, keys: [monzo…],
  //         statements: [{k, id (r:<n>:<k+1>),
  //         after (the hymn's id), dialect, keyMonzo, key, dox}] } | null,
  //       payoff: "assembly" | "partner" | "refrain" | null,
  //       dice (dev: what each die read, and why a form was refused) }
  // The rows it names are marked (row.piece = "round"; the partner's
  // doxology row takes the first hymn's dialect, meter and the order
  // partnerOf) — the orders prepare() posts read them.
  function forms(info, rows, R) {
    var roundDie = R.fork("round").next(), roundPick = R.fork("round:which").next();
    var payDie = R.fork("payoff").next(), laterPick = R.fork("refrain:later").next();
    var kind = info.sunday || info.kind;
    var out = { round: null, partner: null, refrain: null, payoff: null, dice: { round: +roundDie.toFixed(4), payoff: +payDie.toFixed(4), why: {} } };
    var first = null, dox = null, hymns = [];
    rows.forEach(function (r) {
      if (r.section === "hymn") { if (!first) first = r; hymns.push(r); }
      else if (r.section === "doxology" && !dox) dox = r;
    });
    // ---- the round ----
    var canRound = hymns.filter(function (r) { return r !== first; });
    if (!canRound.length) out.dice.why.round = "no hymn after the first";
    else if (kind === "funeral") out.dice.why.round = "not at a funeral";
    else if (roundDie < FORM_ODDS.round) {
      var rr = canRound[Math.min(canRound.length - 1, Math.floor(roundPick * canRound.length))];
      rr.piece = "round";
      // (the Old Way lines a hymn out; it has no round — the unison song does)
      if (rr.dialect === "oldway") rr.dialect = "shaker";
      out.round = { i: rr.i, id: rr.id, dialect: rr.dialect };
    } else out.dice.why.round = "not this Sunday";
    // ---- the doxology's one payoff ----
    var sameMode = first && dox && first.mode === dox.mode;
    var partnerOk = !info.cumulative && first && dox && first.key === "home" && sameMode && !!PARTNER_DIALECTS[first.dialect];
    var refrainOk = !info.cumulative && first && dox && !NO_REFRAIN[kind] && sameMode;
    if (info.cumulative) out.payoff = "assembly";
    else if (partnerOk && payDie < FORM_ODDS.partner) out.payoff = "partner";
    else if (refrainOk && payDie >= 1 - FORM_ODDS.refrain) out.payoff = "refrain";
    if (!partnerOk) out.dice.why.partner = info.cumulative ? "the tune is withheld: the assembly is the doxology's" : !first || !dox ? "no first hymn, or no doxology" : first.key !== "home" ? "the first hymn is keyed away from home" : !sameMode ? "the doxology rises into another mode" : "the first hymn's dialect (" + first.dialect + ") takes no partner";
    if (!refrainOk) out.dice.why.refrain = info.cumulative ? "the tune is withheld: the assembly is the doxology's" : NO_REFRAIN[kind] ? "never on a " + kind + " Sunday" : !first || !dox ? "no first hymn, or no doxology" : "the doxology rises into another mode";
    if (out.payoff === "partner") {
      dox.partnerOf = first.id; dox.dialect = PARTNER_DIALECTS[first.dialect]; dox.meter = first.meter;
      out.partner = { i: dox.i, id: dox.id, of: first.id, dialect: dox.dialect, firstDialect: first.dialect };
    }
    if (out.payoff === "refrain") {
      // the statements: after the first hymn; after a later one (the pick);
      // in the doxology — each in that hymn's key, in a dialect it sets well in
      var later = hymns.filter(function (r) { return r !== first; });
      var mid = later.length ? later[Math.min(later.length - 1, Math.floor(laterPick * later.length))] : null;
      var at = [first].concat(mid ? [mid] : []).concat([dox]);
      var wd = REFRAIN_WRITE[first.dialect] ? first.dialect : "gospel";
      var rid = "r:" + info.n;
      out.refrain = {
        id: rid + ":0", dialect: wd, mode: first.mode, keys: at.map(function (r) { return r.keyMonzo.slice(); }),
        statements: at.map(function (r, k) {
          return { k: k, id: rid + ":" + (k + 1), after: r.id, dialect: REFRAIN_SET[r.dialect] || "gospel", keyMonzo: r.keyMonzo.slice(), key: r.key, dox: r === dox };
        }),
      };
    }
    return out;
  }

  // ==========================================================================
  // THE TIMELINE OF A HYMN (pure) — a line laid out in seconds, as the lab
  // lays it (hymn-lab.js partEvents): a fermata holds its note and moves
  // everything after it; a tied note is one note; the last note of a line
  // gives up a breath (Line.breathAfter).
  // ==========================================================================
  function clockOf(line, beatS) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  function lineBeats(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    return KOLOB.Score && KOLOB.Score.lineLength ? KOLOB.Score.lineLength(line) : 8;
  }
  // one part of one line: [{at, dur, n}] in seconds from the line's start,
  // and the line's length in seconds (to the next line's start)
  function partLine(line, part, beatS, next) {
    var clk = clockOf(line, beatS), ns = line.notes[part] || [], ev = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var at = clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);
      ev.push({ at: at, dur: dur, n: n });
    }
    var len = clk(lineBeats(line, next)) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
    return { ev: ev, len: len };
  }
  // a verse's lines (the verse and its refrain) and their starts in seconds
  function timeline(h, lines, beatS) {
    var t = 0, out = [];
    for (var i = 0; i < lines.length; i++) {
      var pl = partLine(lines[i], h.melodyPart, beatS, lines[i + 1]);
      out.push({ line: lines[i], at: t, len: pl.len });
      t += pl.len;
    }
    return { lines: out, len: t };
  }
  function verseLines(h) { return h.lines.concat(h.refrain || []); }
  function verseSeconds(h, beatS) { return timeline(h, verseLines(h), beatS).len; }

  // ==========================================================================
  // THE ERRAND — the orders, the composer's desk, the hymns come back
  // ==========================================================================
  // What travels back: the Score whole, and of the composer's report only
  // what a reader of the meeting uses (the frame, the checks, the peak, the
  // fingerprint's shares). The same function lightens a hymn written in the
  // worker and one written here, so both roads give one object.
  function lighten(h) {
    if (!h) return h;
    var r = h.report || {}, fp = r.fingerprint || null;
    h.report = {
      frame: r.frame || null, peak: r.peak || null,
      checks: (r.checks || []).map(function (c) { return { name: c.name, ok: !!c.ok, hard: !!c.hard }; }),
      share: fp && fp.share ? fp.share : null,
    };
    return h;
  }
  // THE ORDER'S KIND (round 3b, step 3): a hymn (compose), a round (round),
  // the partner hymn on the first hymn (partner, dep: the first hymn), the
  // wandering refrain as written (refrain), or a statement of it set in a
  // later hymn's key and dialect (refrainIn, dep: the refrain) — one
  // function, the same on every road (it travels to the worker as text,
  // with lighten). The partner's fit is kept on the hymn (partner.combined,
  // partner.fit: the composer's own); a partner whose first hymn could not
  // be written is composed on its own.
  function errand(Cm, stream, how, opts, dep) {
    // THE RECKONING'S DOXOLOGY (round 3b, step 4): written a few ways, the
    // first whose opening stands on every section's key kept; else the
    // first as written (a partner is written once: its tune is the first
    // hymn's partner, not the reckoning's to choose)
    if (opts && opts.reckon) {
      var rk = opts.reckon, Cal = (typeof window !== "undefined" && window.KOLOB) ? window.KOLOB.Calendar : null;
      var plain = {}; for (var ok in opts) if (ok !== "reckon") plain[ok] = opts[ok];
      // (the tune's own first notes, one a section, on the first candidate
      // they fit; else its strong notes — the skeleton — on the first that
      // fits so; else the first as written, and the drone stays home)
      var tries = how === "partner" ? 1 : Math.max(1, rk.candidates || 1), first = null, firstFit = null, skel = null;
      for (var k = 0; k < tries; k++) {
        var hk = errand(Cm, k ? stream.fork("reckoning:" + k) : stream, how, plain, dep);
        var fit = Cal && hk ? Cal.reckon(hk, { sections: rk.sections }, "notes") : { ok: false, why: "no calendar in this room" };
        if (!first) { first = hk; firstFit = fit; }
        if (fit.ok) { hk.reckoning = { ok: true, k: k, tries: k + 1, by: "notes", from: fit.from, n: fit.n, cantus: fit.cantus }; return hk; }
        if (!skel && Cal && hk) { var sf = Cal.reckon(hk, { sections: rk.sections }, "strong"); if (sf.ok) skel = { h: hk, fit: sf, k: k }; }
      }
      if (skel) { skel.h.reckoning = { ok: true, k: skel.k, tries: tries, by: "strong", from: skel.fit.from, n: skel.fit.n, cantus: skel.fit.cantus }; return skel.h; }
      if (first) first.reckoning = { ok: false, k: 0, tries: tries, why: firstFit ? firstFit.why : null };
      return first;
    }
    if (how === "round") return Cm.round(stream, opts);
    if (how === "partner" && dep) return Cm.partner(stream, dep, opts).hymn;
    if (how === "refrain") return Cm.wanderingRefrain(stream, opts).hymn;
    if (how === "refrainIn" && dep) return Cm.refrainIn(stream, dep, opts);
    return Cm.compose(stream, opts);
  }
  // (the worker's body — stringified, so it carries lighten and errand with it)
  function workerMain() {
    var cache = {};
    self.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === "load") {
        try { self.window = self; importScripts.apply(self, m.urls); self.postMessage({ type: "loaded", ok: !!(self.KOLOB && self.KOLOB.Composer) }); }
        catch (err) { self.postMessage({ type: "loaded", ok: false, error: String(err && err.message || err) }); }
        return;
      }
      if (m.type === "forget") { for (var k in cache) if (k.indexOf(m.prefix) === 0) delete cache[k]; return; }
      if (m.type !== "compose") return;
      var t0 = self.performance && self.performance.now ? self.performance.now() : 0, h = null, err = null;
      try {
        var opts = m.opts || {};
        opts.others = (m.others || []).map(function (x) { return cache[x]; }).filter(Boolean);
        h = lighten(errand(self.KOLOB.Composer, self.PJ2.Rand.stream(m.seed).fork(m.label), m.how, opts, m.dep ? cache[m.dep] : null));
        cache[m.key] = h;
      } catch (x) { err = String(x && x.message || x); }
      var ms = self.performance && self.performance.now ? self.performance.now() - t0 : 0;
      self.postMessage({ type: "hymn", key: m.key, hymn: h, error: err, ms: ms });
    };
  }
  // the composer's rooms, in the order the page loaded them (the worker loads
  // the same files at the same versions — the same bytes, the same hymns)
  var DESK_FILES = ["pj2-rand.js", "kolob-pitch.js", "kolob-score.js", "kolob-tunes.js", "kolob-dialects.js", "kolob-hymnists.js", "kolob-composer.js"];
  // (and the calendar, where the page has it: the reckoning is read there —
  // round 3b, step 4; a lab without it writes no reckoned doxology)
  var DESK_OPTIONAL = ["kolob-calendar.js"];
  function deskUrls() {
    if (typeof document === "undefined" || !document.getElementsByTagName) return null;
    var scripts = document.getElementsByTagName("script"), urls = [];
    function find(name) {
      for (var j = 0; j < scripts.length; j++) {
        var src = scripts[j].src || "";
        if (src.split("?")[0].split("/").pop() === name) return src;
      }
      return null;
    }
    for (var i = 0; i < DESK_FILES.length; i++) {
      var found = find(DESK_FILES[i]);
      if (!found) return null;
      urls.push(found);
    }
    DESK_OPTIONAL.forEach(function (f) { var u = find(f); if (u) urls.push(u); });
    return urls;
  }

  var jobs = {};                 // key → { key, seed, label, opts, others, hymn, error, state, ms, how }
  var order = [];                // keys, in the order they were posted (the idle road writes them in turn)
  var worker = null, workerState = "none";   // none | loading | ready | failed
  var forced = null;             // a backend a test names: "worker" | "idle" | "sync"
  var idleArmed = false;
  var st = { posted: 0, composed: 0, byWorker: 0, byIdle: 0, late: 0, lateInCue: 0, failed: 0, workerMs: [], mainMs: [], receiveMs: [] };
  function keyOf(seed, id) { return seed + "|" + id; }
  function clock() { return typeof performance !== "undefined" && performance.now ? performance.now() : 0; }

  function backend() {
    if (forced) return forced;
    if (workerState === "ready" || workerState === "loading") return "worker";
    return "idle";
  }
  function setBackend(name) { forced = name === "worker" || name === "idle" || name === "sync" ? name : null; }
  // warm(): the worker is started early (at the page's first press), so its
  // rooms are loaded long before the first hymn is ordered
  function warm() {
    if (worker || workerState === "failed" || forced === "idle" || forced === "sync") return backend();
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) { workerState = "failed"; return backend(); }
    var urls = deskUrls();
    if (!urls) { workerState = "failed"; return backend(); }
    try {
      var src = lighten.toString() + "\n" + errand.toString() + "\n(" + workerMain.toString() + ")();";
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      workerState = "loading";
      worker.onmessage = onWorker;
      worker.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); failWorker(); };
      worker.postMessage({ type: "load", urls: urls });
    } catch (e) { failWorker(); }
    return backend();
  }
  function failWorker() {
    workerState = "failed";
    try { if (worker) worker.terminate(); } catch (e) {}
    worker = null;
    // whatever was waiting on the worker is written in the idle road instead
    order.forEach(function (k) { var j = jobs[k]; if (j && j.state === "posted") j.state = "queued"; });
    armIdle();
  }
  function onWorker(e) {
    var m = e.data || {};
    if (m.type === "loaded") {
      if (!m.ok) { failWorker(); return; }
      workerState = "ready";
      return;
    }
    if (m.type !== "hymn") return;
    var t0 = clock();
    var j = jobs[m.key];
    if (!j || j.hymn) return;                    // (written here already, while it was on its way)
    if (m.error || !m.hymn) { j.state = "queued"; j.error = m.error; st.failed++; armIdle(); return; }
    j.hymn = m.hymn; j.state = "done"; j.ms = m.ms; j.how = "worker";
    st.composed++; st.byWorker++; st.workerMs.push(Math.round(m.ms));
    st.receiveMs.push(+(clock() - t0).toFixed(2));
  }
  function send(j) {
    j.state = "posted";
    worker.postMessage({ type: "compose", key: j.key, seed: j.seed, label: j.label, opts: j.opts, others: j.others, how: j.piece, dep: j.dep || null });
  }

  // prepare(seed, n, rows, fm): the orders for meeting n, in the order the
  // hymns are sung (each hymn is written knowing the ones before it); a row
  // forms() made a round is ordered as a round, the doxology it made a
  // partner as the partner of the first hymn; and with the refrain (fm, the
  // day's forms), the refrain as written and each statement of it, ordered
  // just after the first hymn (they are sung minutes before the rest). The
  // refrain's orders stand aside: no hymn is written knowing them, and they
  // take no number on the board.
  // (rk, round 3b, step 4: the reckoning's order — {doxId, sections,
  // candidates} — laid on the doxology's; see THE RECKONING above)
  function prepare(seed, n, rows, fm, rk) {
    // (the orders of meetings long gone are dropped; the worker forgets them too)
    order = order.filter(function (k) {
      var keep = jobs[k] && jobs[k].n >= n - 1 && jobs[k].seed === seed;
      if (!keep) { if (jobs[k] && jobs[k].hymn) shelve(jobs[k]); delete jobs[k]; }
      return keep;
    });
    if (worker) worker.postMessage({ type: "forget", prefix: seed + "|h:" + (n - 2) + ":" });
    var earlier = [];
    function post(j) {
      jobs[j.key] = j;
      order.push(j.key);
      st.posted++;
      if (backend() === "worker" && worker) send(j);
    }
    var refrain = fm && fm.refrain ? fm.refrain : null;
    rows.forEach(function (r) {
      var key = keyOf(seed, r.id);
      if (jobs[key]) { earlier.push(key); return; }
      var opts = { dialect: r.dialect, meter: r.meter || undefined, mode: r.mode, keyMonzo: r.keyMonzo, id: r.id, gestures: r.gestures }, how = "compose", dep = null;
      if (r.kind) opts.kind = r.kind;
      if (r.piece === "round") { how = "round"; opts = { dialect: r.dialect, mode: r.mode, keyMonzo: r.keyMonzo, id: r.id }; }
      else if (r.partnerOf) { how = "partner"; dep = keyOf(seed, r.partnerOf); opts = { dialect: r.dialect, id: r.id, tries: PARTNER_TRIES }; }
      if (rk && r.id === rk.doxId) opts.reckon = { sections: rk.sections, candidates: rk.candidates };
      post({ key: key, n: n, i: r.i, id: r.id, seed: seed, label: "hymn:" + n + ":" + r.i, opts: opts, others: earlier.slice(), hymn: null, state: "queued", piece: how, dep: dep, how: null });
      earlier.push(key);
      if (refrain && r.i === 1) {
        var rkey = keyOf(seed, refrain.id);
        if (!jobs[rkey]) post({ key: rkey, n: n, i: null, id: refrain.id, seed: seed, label: "refrain:" + n, aside: true, piece: "refrain", dep: null, how: null, others: [], hymn: null, state: "queued",
                                opts: { keys: refrain.keys, dialect: refrain.dialect, mode: refrain.mode, id: refrain.id } });
        refrain.statements.forEach(function (x) {
          var skey = keyOf(seed, x.id);
          if (!jobs[skey]) post({ key: skey, n: n, i: null, id: x.id, seed: seed, label: "refrain:" + n + ":" + x.k, aside: true, piece: "refrainIn", dep: rkey, how: null, others: [], hymn: null, state: "queued",
                                  opts: { dialect: x.dialect, keyMonzo: x.keyMonzo, id: x.id } });
        });
      }
    });
    if (backend() === "idle") armIdle();
  }
  // THE IDLE ROAD — one hymn a slice, on a timer of its own (never a cue)
  function armIdle() {
    if (idleArmed || typeof setTimeout === "undefined") return;
    idleArmed = true;
    setTimeout(idleSlice, 0);
  }
  function idleSlice() {
    idleArmed = false;
    if (backend() === "worker" && workerState !== "failed") return;
    for (var i = 0; i < order.length; i++) {
      var j = jobs[order[i]];
      if (j && !j.hymn && j.state === "queued") { write(j, "idle"); break; }
    }
    for (var k = 0; k < order.length; k++) { var jj = jobs[order[k]]; if (jj && !jj.hymn && jj.state === "queued") { armIdle(); break; } }
  }
  // the composer at this desk: the stream, the earlier hymns, the same lightening
  function write(j, how) {
    // (every hymn before it first — the composer is handed them, in order)
    var others = j.others.map(function (k) { var o = jobs[k]; if (o && !o.hymn) write(o, how); return o ? o.hymn : null; }).filter(Boolean);
    // (and the one it is written on — the partner's first hymn, a
    // statement's refrain — before it)
    var dep = j.dep ? jobs[j.dep] : null;
    if (dep && !dep.hymn && dep.state !== "failed") write(dep, how);
    var t0 = clock();
    try {
      var opts = {}; for (var k in j.opts) opts[k] = j.opts[k] === undefined ? undefined : JSON.parse(JSON.stringify(j.opts[k]));
      opts.others = others;
      j.hymn = lighten(errand(KOLOB.Composer, window.PJ2.Rand.stream(j.seed).fork(j.label), j.piece, opts, dep ? dep.hymn : null));
      j.state = "done";
    } catch (e) {
      j.state = "failed"; j.error = String(e && e.message || e); st.failed++;
      if (typeof console !== "undefined" && console.warn) console.warn("Kolob: the composer could not write " + j.id + ": " + j.error);
    }
    j.ms = clock() - t0; j.how = how;
    if (j.hymn) { st.composed++; if (how === "idle") st.byIdle++; }
    st.mainMs.push(Math.round(j.ms * 10) / 10);
    return j.hymn;
  }
  // get(id): the hymn, as it came back — or written now, if it has not
  // (counted: late, and whether it was inside a clock callback)
  function get(id, seed) {
    var key = keyOf(seed != null ? seed : (S.visitSeed ? S.visitSeed() : 0), id), j = jobs[key];
    if (!j) return null;
    if (!j.hymn && j.state !== "failed") {
      st.late++;
      if (S.inCue && S.inCue()) st.lateInCue++;
      write(j, "late");
    }
    settle(j);
    return j.hymn;
  }
  // THE BOARD'S NUMBERS: the composer draws a hymn's number on its own
  // stream, and two hymns of one meeting can draw the same (1.6 % of
  // meetings); a meeting never gives out one number twice, so a later hymn
  // takes the next free number on — decided in the meeting's own order,
  // whatever order the hymns came back in
  function settle(j) {
    if (!j || !j.hymn || j.settled) return;
    if (j.aside) { j.settled = true; return; }            // (the refrain is not given out from the board)
    var used = {};
    order.forEach(function (k) {
      var o = jobs[k];
      if (!o || o === j || o.aside || o.n !== j.n || o.seed !== j.seed || o.i >= j.i) return;
      if (!o.hymn && o.state !== "failed") write(o, "late");
      settle(o);
      if (o.hymn) used[o.hymn.number] = true;
    });
    var num = j.hymn.number, tries = 0;
    while (used[num] && tries++ < 400) num = num % 380 + 1;
    j.hymn.number = num;
    j.settled = true;
  }
  function ready(id, seed) { var j = jobs[keyOf(seed != null ? seed : (S.visitSeed ? S.visitSeed() : 0), id)]; return !!(j && j.hymn); }
  // (a meeting long gone keeps its last few hymns on a shelf, so a reader —
  // the harness after a long run, the page's dev tools — can still find the
  // hymn an id named; the shelf holds sixteen)
  var shelf = [];
  function shelve(j) { shelf.push({ seed: j.seed, id: j.id, hymn: j.hymn }); if (shelf.length > 16) shelf.shift(); }
  function hymnOf(id, seed) {
    var sd = seed != null ? seed : (S.visitSeed ? S.visitSeed() : null);
    for (var k in jobs) if (jobs[k].id === id && jobs[k].hymn && (sd == null || jobs[k].seed === sd)) return jobs[k].hymn;
    for (var i = shelf.length - 1; i >= 0; i--) if (shelf[i].id === id && (sd == null || shelf[i].seed === sd)) return shelf[i].hymn;
    return null;
  }
  function book() { return order.map(function (k) { var j = jobs[k]; return { id: j.id, n: j.n, state: j.state, how: j.how, piece: j.piece || "compose", ms: j.ms != null ? Math.round(j.ms) : null }; }); }
  function stats() {
    function q(a, p) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
    return {
      backend: backend(), worker: workerState, posted: st.posted, composed: st.composed, byWorker: st.byWorker, byIdle: st.byIdle,
      late: st.late, lateInCue: st.lateInCue, failed: st.failed,
      workerMs: { n: st.workerMs.length, p50: q(st.workerMs, 0.5), p90: q(st.workerMs, 0.9), max: q(st.workerMs, 1) },
      mainMs: { n: st.mainMs.length, p50: q(st.mainMs, 0.5), p90: q(st.mainMs, 0.9), max: q(st.mainMs, 1) },
      receiveMs: { n: st.receiveMs.length, p50: q(st.receiveMs, 0.5), max: q(st.receiveMs, 1) },
    };
  }

  KOLOB.Hymnal = {
    plan: plan, forms: forms, prepare: prepare, get: get, ready: ready, hymnOf: hymnOf, book: book, stats: stats,
    warm: warm, backend: backend, setBackend: setBackend,
    timeline: timeline, partLine: partLine, verseLines: verseLines, verseSeconds: verseSeconds, lighten: lighten,
    HOUSE_ODDS: HOUSE_ODDS, NEIGHBOURS: NEIGHBOURS, KEYS: KEYS, SUNDAY_LEAN: SUNDAY_LEAN, KIND_LEAN: KIND_LEAN, FORM_ODDS: FORM_ODDS,
    PARTNER_DIALECTS: PARTNER_DIALECTS, REFRAIN_SET: REFRAIN_SET,
  };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-hymnal.js"] = true;   // the load guard's roll call
})();
