// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE CALENDAR (KOLOB.Calendar): the Sunday, the light, the
// seatings, the reckoning
//
// The shape of a visit (PLAN-COMPOSITION §7).
//
// THE SUNDAY OF THE COLONY YEAR (§7.1). Every visit draws a Sunday — an
// ordinary one most often, a fast Sunday, General Conference, Pioneer Day,
// Christmas, Easter, a wedding, a funeral, and once in a hundred visits the
// dedication of a house — at the plan's own shares. There is no journey
// across visits: the calendar is there so that a person who comes back finds
// another Sunday. Each Sunday has its CHARACTER, and the character is what
// the rest of the house reads: the house dialect it leans to (the hymnal's
// SUNDAY_LEAN), the meeting's plan (how many hymns, whether the testimony
// is kept, how long the rites run, how still the silences are), which guests
// it welcomes (the handbells at Christmas, Easter and a wedding; the
// trombones at Easter, a funeral and a dedication; the bands and the gospel
// ring on Pioneer Day; the Primary's song at Christmas), how many of the
// ward come forward, which organist is likely on the bench and how full the
// organ is drawn, and how the morning is seated. The four kinds of meeting
// the house has always known (ordinary, fast, conference, jubilee) remain
// underneath: each Sunday belongs to one, and a room that has only ever
// read the kind still reads it.
//
// THE ARC OF LIGHT (§7.3). A meeting rises. Its sections are weighted from
// dawn to full daylight — the prelude and the invocation plain and open
// (the Sacred Harp, the Old Way and the Shakers likelier, the organ on its
// flutes), the hymns fuller one after another (the morning), the sacrament
// the stillest point (before the sun clears the rim), the doxology full
// light (the Tabernacle and the gospel ring, the sevenths, the full organ),
// and the postlude evening. The light of each section is a number from 0
// to 1 (light()); the hymnal leans each hymn's dialect by it
// (dialectLean()), the organ draws its stops by it (the organist's verses,
// the house's chords), and the meeting's intensity — which every voice
// reads for how often it speaks and how loud — follows it, crossfaded over
// the joints, in place of the fixed curves each section kept before. A
// funeral is slow, then rising: its dawn is darker and its morning climbs
// late to the same full light.
//
// SEATINGS (§7.4). The prelude draws its seating in kolob-meeting.js
// (seatPrelude). The other rites that are not hymns draw one here
// (scenes()): the house as it always sat (plain), LINED OUT
// ONLY (the deacon gives the lines and the ward answers; no organ, no
// harmonium, no strings), the BRUSH ARBOR (no organ; the strings on bare
// fifths), an ORGAN VOLUNTARY (the organ leads, the others sparing), or THE
// CHOIR ALONE (the ward hums a few of the day's chords; the organ, the
// harmonium and the deacon wait). THE RULE: no two sections in a row are
// empty — a hymn, the prelude and any section a guest is seated in are never
// empty; a rite whose seating is the plain house is, and the next rite may
// not be plain as well (its die is read again from the others).
//
// THE KOLOB RECKONING (§7.2). One of Kolob's days is a thousand of Earth's
// years; the drone moves as Kolob moves, slowly. The doxology's tune is
// chosen first: its opening notes become a slow CANTUS, one note a section,
// carried by the drone and gliding to the next only under a joint's hush —
// and each note stands on its section's harmony (the tonic, the third or the
// fifth of the key the section is sung in). In the doxology the ward sings
// the tune at its own pace: the melody the drone has been spelling all
// meeting. Here: reckon(hymn, info) reads a written doxology against the
// sections before it (pure); the hymnal's desk writes the doxology up to
// RECKON_CANDIDATES ways and keeps the first whose opening stands on every
// section's key (else the first whose strong notes — the tune's stressed
// skeleton — do). The cantus is as long as the meeting has sections before
// its doxology (four to seven notes), not the plan's seven to nine: one
// note a section, and no more sections than the order of service has
// (kolob-hymnal.js, the errand "reckon"). If none does, the meeting FALLS
// BACK cleanly: the doxology as the composer first wrote it, and the drone
// on the day's keynote as ever (no glide). The switch
// KOLOB.Experimental.reckoning (?exp=-reckoning) turns the drone's part of
// it off: the doxology the desk kept is written and sung all the same, and
// the drone stays home (§7.2's fallback, "the cantus only for the key plan,
// with no audible glide") — the owner's A/B is the drone, nothing else.
//
// PURE (SCORE §1): no AudioContext, no DOM, no Math.random, no clock. Every
// die is the caller's (a PJ2.Rand stream, or a die already thrown); it loads
// in Node and in the composer's worker (kolob-hymnal.js DESK_OPTIONAL),
// where the errand calls reckon().
//
// Public surface: window.KOLOB.Calendar = {
//   SUNDAYS, ORDER, KINDS
//   draw(u)                 → a Sunday's id, from a die already thrown (u in [0,1))
//   kindOf(id)              → the house's kind: ordinary | fast | conference | jubilee
//   sunday(id)              → the Sunday's character (a copy)
//   meetingRow(id, kindRow) → the kind's MEETINGS row with the Sunday laid over it
//   phaseOf(plan, i)        → dawn | morning | stillness | full | evening
//   light(plan, i, id)      → the section's light, 0–1;  lights(plan, id) → every section's
//   dialectLean(light)      → { dialect: factor } (the hymnal's per-hymn lean)
//   regLean(light, id)      → −1 … +1 (softer … fuller stops)
//   richHymnist(u, dialect, light, hymnists) → a hymnist's id at full light (or null)
//   scenes(plan, id, guests, R) → [{ scene, empty, forced }] a seating per section
//   SCENES, SCENE_ODDS
//   reckon(hymn, info)      → { ok, from, cantus: [...], why }   (pure; the desk's)
//   RECKON_CANDIDATES }
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Calendar = (function () {
  "use strict";

  // ==========================================================================
  // THE SUNDAYS — the plan's shares (§7.1), each Sunday's name for the
  // programme card (the clerk's Deseret capitals; en is the dev tools' and
  // the Latin switch's), the kind of meeting it belongs to, and its character
  // ==========================================================================
  //   share     the draw's weight (they sum to 1)
  //   kind      the house's four: what every room that reads only the kind reads
  //   plan      the meeting's shape laid over the kind's (MEETINGS):
  //               hymns, silenceMul, bright, bells, meterW — and the dice's
  //               own odds: cutTestimony, interlude, tradeTS, secondDox;
  //               lens: a factor on a rite's drawn length
  //   season    where the Sunday's warmth sits (0 the fast-day trough … 1 the
  //             festival): the day's temper, the piper
  //   (guests   a Sunday's row carries no guest odds: they are one table,
  //             GUEST_ODDS, below the Sundays)
  //   cast      how many of the ward you come to know: opt (the optional
  //             roles, beside the chorister, the precentor and the soloist)
  //             and testimony (how many rise)
  //   organist  factors on the three organists' odds
  //   reg       how the organ is drawn, −1 … +1 (the plain flutes … the full
  //             organ), on top of the light
  //   morning   factors on the prelude's seatings (seatPrelude)
  //   scenes    factors on the other rites' seatings (scenes)
  //   arc       the Sunday's own light: offsets and overrides (ARC below) —
  //             and its own dawn, so that the Sunday is heard in the first
  //             minutes (else a wedding and an ordinary Sunday were
  //             near-twins there): a fast Sunday's and
  //             Christmas's grey and sparse, a wedding's late and awake,
  //             a funeral's darkest, the feasts' lifted
  //   dox       factors on the doxology's own dialect (a funeral rises into
  //             the Tabernacle's "all is well"; Easter's full Tabernacle)
  //   hosanna   the Hosanna may come (§8.12; audio-only, unlogged)
  var SUNDAYS = {
    ordinary: {
      share: 0.45, kind: "ordinary", ds: "𐐃𐐡𐐔𐐆𐐤𐐇𐐡𐐆 𐐝𐐊𐐤𐐔𐐁", en: "AN ORDINARY SUNDAY",
      about: "the house style varies",
      plan: {}, season: [0.2, 0.7], cast: { opt: [3, 5], testimony: [2, 3] },
      organist: {}, reg: 0, morning: {}, scenes: {}, arc: {},
    },
    fast: {
      share: 0.15, kind: "fast", ds: "𐐙𐐈𐐝𐐓 𐐝𐐊𐐤𐐔𐐁", en: "FAST SUNDAY",
      about: "testimony-heavy and sparse; the Sacred Harp and the Old Way; the precentor",
      // (the testimony is the meeting's centre: never cut, and longer)
      plan: { cutTestimony: 0, lens: { testimony: 1.35, invocation: 1.1 } }, season: [0, 0.35],
      cast: { opt: [3, 4], testimony: [3, 3] },
      organist: { plain: 1.3 }, reg: -0.45,
      morning: { arbor: 1.8, ground: 1.4, humming: 1.3, voluntary: 0.6, parlor: 0.8 },
      scenes: { lined: 2.2, arbor: 1.6, voluntary: 0.6, choir: 0.9 },
      arc: { dawn: [0.09, 0.15], morning: [0.32, 0.5], full: 0.8, stillness: 0.06 },
    },
    conference: {
      share: 0.12, kind: "conference", ds: "𐐖𐐇𐐤𐐊𐐡𐐊𐐢 𐐗𐐉𐐤𐐙𐐡𐐇𐐤𐐝", en: "GENERAL CONFERENCE",
      about: "three hymns, the choir, the full organ, the Tabernacle",
      plan: { hymns: 3 }, season: [0.5, 0.9], cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { victorian: 1.3 }, reg: 0.4,
      morning: { voluntary: 1.9, humming: 1.2, arbor: 0.5, valley: 0.8 },
      scenes: { voluntary: 1.8, choir: 1.5, lined: 0.5, arbor: 0.5 },
      arc: { lift: 0.04 },
    },
    pioneer: {
      share: 0.08, kind: "jubilee", ds: "𐐑𐐌𐐊𐐤𐐀𐐡 𐐔𐐁", en: "PIONEER DAY",
      about: "the brass bands, the gospel ring; the handcarts remembered",
      plan: { hymns: 3, secondDox: 0.5 }, season: [0.75, 1],
      cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { improviser: 1.2 }, reg: 0.25,
      morning: { parlor: 1.6, voluntary: 1.2, valley: 1.2 },
      scenes: { arbor: 1.3, voluntary: 1.2 },
      arc: { lift: 0.06 }, dox: { gospel: 1.5 },
    },
    christmas: {
      share: 0.06, kind: "jubilee", ds: "𐐗𐐡𐐆𐐝𐐣𐐊𐐝", en: "CHRISTMAS",
      about: "shape-note carols, the bells, the Primary",
      plan: { hymns: 3, secondDox: 0.3 }, season: [0.6, 0.9],
      cast: { opt: [4, 5], testimony: [2, 2] },
      organist: {}, reg: 0.1,
      morning: { humming: 2, valley: 1.4, strings: 1.2 },
      scenes: { choir: 1.8, voluntary: 1.2 },
      arc: { dawn: [0.09, 0.15], evening: 0.5 },
    },
    easter: {
      share: 0.06, kind: "jubilee", ds: "𐐀𐐝𐐓𐐊𐐡", en: "EASTER",
      about: "the brightest light, the Tabernacle in full; the Hosanna possible",
      plan: { hymns: 3, secondDox: 0.5, bright: 0.95 }, season: [0.85, 1],
      cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { victorian: 1.3 }, reg: 0.5,
      morning: { voluntary: 1.7, strings: 1.3 },
      scenes: { voluntary: 1.5, choir: 1.3 },
      arc: { lift: 0.1 }, hosanna: true, dox: { tabernacle: 1.5, gospel: 1.3, oldway: 0.5 },
    },
    wedding: {
      share: 0.04, kind: "ordinary", ds: "𐐊 𐐎𐐇𐐔𐐆𐐥", en: "A WEDDING",
      about: "gentle; a love song; the soloist",
      plan: { hymns: 2, cutTestimony: 0.6, bright: 0.7, silenceMul: 0.9 }, season: [0.5, 0.8],
      cast: { opt: [3, 5], testimony: [2, 2] },
      organist: { victorian: 1.4 }, reg: -0.1,
      morning: { parlor: 2.4, strings: 2.0, voluntary: 1.4, arbor: 0.4, ground: 0.6, valley: 0.6 },
      scenes: { voluntary: 1.5, choir: 1.1, lined: 0.5 },
      arc: { dawn: [0.2, 0.3], morning: [0.45, 0.62], evening: 0.5 },
    },
    funeral: {
      share: 0.03, kind: "ordinary", ds: "𐐊 𐐙𐐧𐐤𐐊𐐡𐐊𐐢", en: "A FUNERAL",
      about: "hopeful: slow, then rising — all is well",
      // (no raspberry, no refrain, no round, no singing school: the forms and
      // the guests' own rooms refuse them at a funeral)
      plan: { hymns: 2, silenceMul: 1.35, bright: 0.4, bells: 0.3, cutTestimony: 0.1, lens: { invocation: 1.2, sacrament: 1.2 },
              meterW: [["LM", 3], ["CM", 3], ["SM", 2], ["87.87", 1]] },
      season: [0.1, 0.45], cast: { opt: [2, 4], testimony: [2, 3] },
      organist: { plain: 1.4, victorian: 1.2, improviser: 0.6 }, reg: -0.5,
      morning: { ground: 1.8, strings: 1.7, humming: 1.4, voluntary: 0.7, parlor: 0.6, valley: 0.8 },
      scenes: { choir: 1.6, voluntary: 1.3, lined: 0.6, arbor: 0.8 },
      arc: { dawn: [0.06, 0.1], morning: [0.2, 0.52], stillness: 0.05, full: 1, evening: 0.55 },
      dox: { tabernacle: 3, oldway: 0.3, sacredharp: 0.5, psalmody: 0.6, shaker: 0.6 },
      noRaspberry: true,
    },
    dedication: {
      share: 0.01, kind: "conference", ds: "𐐊 𐐔𐐇𐐔𐐆𐐗𐐁𐐟𐐊𐐤", en: "A DEDICATION",
      about: "the Hosanna, the full organ, conference forces",
      plan: { hymns: 3, bright: 0.9 }, season: [0.8, 1], cast: { opt: [5, 5], testimony: [2, 3] },
      organist: { victorian: 1.6 }, reg: 0.6,
      morning: { voluntary: 2.4, humming: 1.2 },
      scenes: { voluntary: 1.8, choir: 1.6, arbor: 0.4, lined: 0.4 },
      arc: { lift: 0.08 }, hosanna: true, dox: { tabernacle: 1.5 },
    },
  };
  var ORDER = ["ordinary", "fast", "conference", "pioneer", "christmas", "easter", "wedding", "funeral", "dedication"];

  // ==========================================================================
  // THE GUESTS' ODDS — ONE TABLE (PLAN §8, §8.13)
  // ==========================================================================
  // How likely each guest is to be asked to a meeting, Sunday by Sunday: the
  // die each guest throws on its own stream (guest:<name>:<n>, or the
  // meeting's own for the steeples and the old tune) is read against this
  // number — change a cell and that guest comes more or less often on that
  // Sunday, and nothing else moves. Asked is not seated: the meeting then
  // seats it only where the budget has room (GUEST_BUDGET, below) and its
  // own rules allow (a band never with the trombones, the old tune only on a
  // Sunday of its own colour, the Social Hall never at a funeral…), so what
  // is heard is a little under the table. The band's row is the owner's own
  // 36 %, leaned by the Sunday; the rest are set so that some sixty
  // meetings in a hundred carry a guest (PLAN §8: about 55 %; measured over
  // 1,000 first meetings) and every guest is heard. The owner tunes them by
  // ear.
  //   changes  — not a guest of its own: of the Sundays the steeples ring,
  //              how often the far bells are a band ringing changes
  //   hosanna  — Easter and a dedication only (the rite of those Sundays,
  //              unlogged); nowhere else, whatever the table says
  var GUEST_COLUMNS = ORDER;
  var GUEST_ODDS = {
    //              ordin   fast    confer  pioneer xmas    easter  wedding funeral dedic
    bands:         [0.36,   0.18,   0.36,   0.76,   0.18,   0.25,   0.22,   0.05,   0.36],
    steeples:      [0.025,  0.015,  0.025,  0.015,  0.06,   0.04,   0.04,   0.015,  0.04],
    changes:       [0.5,    0.3,    0.55,   0.55,   0.75,   0.7,    0.85,   0.65,   0.75],
    oldtune:       [0.04,   0.05,   0.04,   0.05,   0.05,   0.04,   0.05,   0.07,   0.04],
    trombones:     [0.05,   0.015,  0.085,  0.05,   0.12,   0.155,  0.05,   0.12,   0.155],
    singingschool: [0.04,   0.035,  0.015,  0.04,   0.05,   0.04,   0.025,  0,      0.015],
    handbells:     [0.04,   0.015,  0.04,   0.04,   0.11,   0.085,  0.085,  0.015,  0.05],
    variations:    [0.04,   0.015,  0.075,  0.075,  0.05,   0.06,   0.05,   0,      0.075],
    tongues:       [0.025,  0.095,  0.01,   0.01,   0.01,   0.025,  0.01,   0.025,  0.085],
    farward:       [0.035,  0.06,   0.07,   0.025,  0.04,   0.035,  0.015,  0.025,  0.05],
    socialhall:    [0.025,  0,      0.01,   0.17,   0.06,   0.04,   0.13,   0,      0.025],
    handcart:      [0.025,  0.015,  0.025,  0.205,  0.01,   0.025,  0.015,  0.06,   0.015],
    gulls:         [0.025,  0.015,  0.025,  0.07,   0.01,   0.035,  0.035,  0,      0.015],
    hosanna:       [0,      0,      0,      0,      0,      0.5,    0,      0,      0.95],
  };
  // THE BUDGET — what the meeting will seat, whoever is asked:
  //   max         guests a meeting, at most (PLAN §8: 0–2; the Hosanna counts)
  //   showpieces  the big guests, one a meeting at most: the organist's
  //               variations, the Social Hall, the Hosanna — each the
  //               meeting's showpiece when it comes
  //   neighbours  guests that may sit in neighbouring rites on a Sunday
  //               (PLAN §8.13: never two guests in the same or neighbouring
  //               rites — but on Pioneer Day the band and the dance after
  //               it are one day's joy). The Hosanna keeps its own rule
  //               (GuestHosanna.YIELD: false, it does not give way)
  //   order       the order the meeting asks them in, which is also who
  //               yields when the budget is full (the last asked)
  var GUEST_BUDGET = {
    max: 2,
    showpieces: { variations: true, socialhall: true, hosanna: true },
    neighbours: { pioneer: [["bands", "socialhall"]] },
    order: ["bands", "steeples", "oldtune", "trombones", "singingschool", "handbells", "variations",
            "tongues", "farward", "socialhall", "handcart", "gulls"],
  };
  // guestOdds(guest, sunday) → the table's number, or null for a guest the
  // table does not name (its own room's odds then stand)
  function guestOdds(guest, id) {
    var row = GUEST_ODDS[guest], k = ORDER.indexOf(id);
    if (!row) return null;
    return row[k >= 0 ? k : 0];
  }
  // may these two sit side by side on this Sunday?
  function neighboursMay(a, b, id) {
    var ok = GUEST_BUDGET.neighbours[id] || [];
    for (var i = 0; i < ok.length; i++) if ((ok[i][0] === a && ok[i][1] === b) || (ok[i][0] === b && ok[i][1] === a)) return true;
    return false;
  }
  var KINDS = ["ordinary", "fast", "conference", "jubilee"];
  if (Object.freeze) ORDER.forEach(function (k) { Object.freeze(SUNDAYS[k]); });

  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function pickWith(u, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = u * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool.length ? pool[pool.length - 1][0] : null;
  }

  // draw(u): the Sunday, from a die the plan has already thrown (the one
  // that picked the kind before: the plan's every later die lands where it
  // did)
  function draw(u) { return pickWith(u, ORDER.map(function (k) { return [k, SUNDAYS[k].share]; })); }
  function kindOf(id) { return SUNDAYS[id] ? SUNDAYS[id].kind : "ordinary"; }
  function sunday(id) { return SUNDAYS[id] ? copy(SUNDAYS[id]) : null; }
  // the kind's row of MEETINGS with the Sunday's plan laid over it (a copy)
  function meetingRow(id, kindRow) {
    var o = copy(kindRow || {}), p = SUNDAYS[id] ? SUNDAYS[id].plan : {};
    ["hymns", "silenceMul", "bright", "bells", "choirSize", "meterW"].forEach(function (k) { if (p[k] != null) o[k] = copy(p[k]); });
    o.sunday = id;
    return o;
  }

  // ==========================================================================
  // THE ARC OF LIGHT (§7.3)
  // ==========================================================================
  // A section's phase is its place in the rite: before the first hymn it is
  // dawn; the hymns and whatever stands between them (the testimony, an
  // interlude) are the morning; the sacrament is the stillness; the doxology
  // full light; the postlude evening.
  //   dawn      [prelude, invocation]
  //   morning   [lo, hi]: the first singing section of the morning at lo, the
  //             last before the doxology at hi, the rest between — the hymns
  //             grow fuller one after another; a testimony or an interlude
  //             takes the light of where it stands
  //   stillness the sacrament
  //   full      the doxology (a jubilee's second doxology, the reprise, a
  //             little under it)
  //   evening   the postlude
  var ARC = { dawn: [0.12, 0.2], morning: [0.4, 0.66], stillness: 0.08, full: 1, evening: 0.4 };
  function phaseOf(plan, i) {
    var s = plan[i] && plan[i].type;
    if (s === "prelude" || s === "invocation") {
      // (an invocation after a hymn — never, in the plan's orders — is morning)
      for (var k = 0; k < i; k++) if (plan[k].type === "hymn") return "morning";
      return "dawn";
    }
    if (s === "sacrament") return "stillness";
    if (s === "doxology") return "full";
    if (s === "postlude") return "evening";
    return "morning";
  }
  function arcOf(id) {
    var a = SUNDAYS[id] && SUNDAYS[id].arc ? SUNDAYS[id].arc : {};
    var lift = a.lift || 0;
    return {
      dawn: (a.dawn || ARC.dawn).map(function (x) { return clamp(x + lift, 0, 1); }),
      morning: (a.morning || ARC.morning).map(function (x) { return clamp(x + lift, 0, 1); }),
      stillness: clamp((a.stillness != null ? a.stillness : ARC.stillness) + lift * 0.5, 0, 1),
      full: clamp(a.full != null ? a.full : ARC.full, 0, 1),
      evening: clamp((a.evening != null ? a.evening : ARC.evening) + lift, 0, 1),
    };
  }
  // light(plan, i, id): the section's light. plan: [{type}]
  function light(plan, i, id) {
    var A = arcOf(id), ph = phaseOf(plan, i), s = plan[i] ? plan[i].type : null;
    if (ph === "dawn") return r3(s === "prelude" ? A.dawn[0] : A.dawn[1]);
    if (ph === "stillness") return r3(A.stillness);
    if (ph === "evening") return r3(A.evening);
    if (ph === "full") {
      var nd = 0; for (var k = 0; k < i; k++) if (plan[k].type === "doxology") nd++;
      return r3(nd ? A.full * 0.92 : A.full);
    }
    // the morning: the singing sections in order, lo to hi; the rest take
    // the light of the singing section before them (or the first's)
    var sing = [], before = -1;
    for (var j = 0; j < plan.length; j++) {
      if (phaseOf(plan, j) !== "morning") continue;
      if (plan[j].type === "hymn") { if (j <= i) before = sing.length; sing.push(j); }
    }
    if (!sing.length) return r3((A.morning[0] + A.morning[1]) / 2);
    var k2 = before < 0 ? 0 : before, n = sing.length;
    var x = n > 1 ? k2 / (n - 1) : 0.35;
    var L = A.morning[0] + (A.morning[1] - A.morning[0]) * x;
    // (a rite between the hymns is a shade under the hymn before it)
    if (s !== "hymn") L -= 0.06;
    return r3(clamp(L, 0, 1));
  }
  function lights(plan, id) { return plan.map(function (s, i) { return light(plan, i, id); }); }

  // THE DIALECTS BY THE LIGHT — the factor each dialect's weight takes at a
  // light (the hymnal multiplies each hymn's own draw by it). At dawn the
  // plain and open styles: the Sacred Harp's bare fifths, the Old Way's
  // single line, the Shakers' unison; at full light the Tabernacle and the
  // gospel ring, the sevenths; the morning between leaves the house's
  // weights nearly as they are. Interpolated in the log between the anchors.
  // (Full light leans harder to the gospel ring than to the Tabernacle: the
  // doxology's table already gives the Tabernacle its brightness, and at an
  // even lean the ring was rarer at full light than in the morning — 14 %
  // against 18 % of hymns — so the sevenths never rose)
  var LIGHT_ANCHORS = [
    [0.1,  { sacredharp: 1.55, oldway: 1.6, shaker: 1.45, psalmody: 1.15, tabernacle: 0.72, gospel: 0.5 }],
    [0.5,  { sacredharp: 1.05, oldway: 1.0, shaker: 1.0, psalmody: 1.1, tabernacle: 1.0, gospel: 0.95 }],
    [1.0,  { sacredharp: 0.42, oldway: 0.28, shaker: 0.6, psalmody: 0.65, tabernacle: 1.9, gospel: 4.6 }],
  ];
  // THE HARMONISTS AT FULL LIGHT: a Tabernacle hymn sung in full light is
  // written by one of the colony's hymnists leaning to their appetite for
  // the sevenths and the secondary dominants (kolob-hymnists.js: sevenths,
  // color) — richHymnist() weights each by their lean to the dialect times
  // (RICH_BASE + sevenths + color)², on the caller's own die; below
  // RICH_FROM the composer draws its hymnist as ever
  var RICH_FROM = 0.9, RICH_BASE = 0.3, RICH_DIALECTS = { tabernacle: true };
  function richHymnist(u, dialect, L, list) {
    if (!RICH_DIALECTS[dialect] || L == null || L < RICH_FROM || !list || !list.length) return null;
    return pickWith(u, list.map(function (h) {
      var lw = h.lean && h.lean[dialect] != null ? h.lean[dialect] : 0.05, x = RICH_BASE + (h.sevenths || 0) + (h.color || 0);
      return [h.id, lw * x * x];
    }));
  }
  var DIALECTS = ["tabernacle", "sacredharp", "oldway", "psalmody", "gospel", "shaker"];
  function dialectLean(L) {
    L = clamp(L == null ? 0.5 : L, 0, 1);
    var a = LIGHT_ANCHORS[0], b = LIGHT_ANCHORS[LIGHT_ANCHORS.length - 1];
    for (var i = 0; i < LIGHT_ANCHORS.length - 1; i++) if (L >= LIGHT_ANCHORS[i][0] && L <= LIGHT_ANCHORS[i + 1][0]) { a = LIGHT_ANCHORS[i]; b = LIGHT_ANCHORS[i + 1]; break; }
    if (L < LIGHT_ANCHORS[0][0]) b = a;
    var x = b[0] > a[0] ? (L - a[0]) / (b[0] - a[0]) : 0, out = {};
    DIALECTS.forEach(function (d) { out[d] = r3(Math.exp(Math.log(a[1][d]) * (1 - x) + Math.log(b[1][d]) * x)); });
    return out;
  }
  // THE STOPS BY THE LIGHT: −1 the plainest (one soft flute) … +1 the full
  // organ; the Sunday's own reg on top (a funeral's softer, a dedication's
  // fuller)
  function regLean(L, id) {
    var base = (clamp(L == null ? 0.5 : L, 0, 1) - 0.5) * 2;           // dawn −0.8, stillness −0.84, full +1
    var own = SUNDAYS[id] ? SUNDAYS[id].reg || 0 : 0;
    return r3(clamp(base * 0.8 + own * 0.5, -1, 1));
  }

  // ==========================================================================
  // SEATINGS FOR THE OTHER RITES (§7.4)
  // ==========================================================================
  //   sits    the house's voices that sit this rite out (they rest; the
  //           joint's amen is the organ's still)
  //   lean    factors on a voice's rest between its turns (under 1 it plays
  //           more), as the prelude's seatings lean
  //   lined   the deacon lines out and the ward answers, even outside a hymn
  //   fifths  the strings keep to bare fifths
  //   hum     the ward hums n of the day's chords, s seconds a chord
  var SCENES = {
    plain:     { empty: true },
    lined:     { lined: true, sits: { organ: true, harmonium: true, strings: true }, lean: { clarinet: 0.4 } },
    arbor:     { sits: { organ: true, harmonium: true }, fifths: true, lean: { strings: 0.6, clarinet: 0.8, ambient: 0.7 } },
    voluntary: { lean: { organ: 0.35, strings: 1.5, harmonium: 1.7, clarinet: 1.6, bells: 1.2 } },
    choir:     { hum: { n: [2, 4], s: [5, 8] }, sits: { organ: true, harmonium: true, clarinet: true }, lean: { strings: 1.5 } },
  };
  // the odds, rite by rite (the testimony and the sacrament keep mostly to
  // themselves; an interlude and the postlude are the organ's own)
  // (the sacrament is the stillness: its one seating besides the plain house
  // is the ward humming softly — the strings keep silent there, so an arbor
  // would be the plain house by another name)
  var SCENE_ODDS = {
    invocation: { plain: 1.4, lined: 1.0, arbor: 0.7, voluntary: 0.7, choir: 0.6 },
    interlude:  { voluntary: 1.5, arbor: 0.9, choir: 0.8, lined: 0.6 },
    testimony:  { plain: 1.6, choir: 0.7, arbor: 0.6, lined: 0.6, voluntary: 0.35 },
    sacrament:  { plain: 3.0, choir: 0.5 },
    postlude:   { voluntary: 1.6, plain: 1.0, arbor: 0.6, choir: 0.6 },
  };
  var NEVER_EMPTY = { prelude: true, hymn: true, doxology: true };
  // again(u, pool, key): a die u that fell on `key` in `pool`, read afresh —
  // where it lay inside key's share, stretched to [0, 1) (u as it was when
  // key is not in the pool, or its share is nothing)
  function again(u, pool, key) {
    var total = 0, a = null, w = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    if (!(total > 0)) return u;
    var at = 0;
    for (i = 0; i < pool.length; i++) { if (pool[i][0] === key) { a = at / total; w = pool[i][1] / total; break; } at += pool[i][1]; }
    if (a == null || !(w > 0)) return u;
    return clamp((u - a) / w, 0, 0.999999);
  }
  // the stillest rite keeps its stillness: when the rule would seat it, the
  // rite before it is seated instead, where that one may be
  var KEEPS_STILL = { sacrament: true };
  // scenes(plan, id, guests, R): one die a section, every section, thrown
  // whether it is used or not (R: the meeting's scenes:<n> stream). guests:
  // the seated guests ({type, section}); a rite a guest is seated in is not
  // empty. → [{ scene, empty, forced }]
  function scenes(plan, id, guests, R) {
    var lean = SUNDAYS[id] ? SUNDAYS[id].scenes || {} : {};
    var dice = plan.map(function () { return R.next(); });
    var out = [], prevEmpty = false;
    plan.forEach(function (s, i) {
      var type = s.type, odds = SCENE_ODDS[type];
      var guested = (guests || []).some(function (g) { return g && g.section === type; });
      if (!odds) { out.push({ scene: null, empty: false, forced: false }); prevEmpty = false; return; }
      var pool = Object.keys(odds).map(function (k) { return [k, odds[k] * (lean[k] != null ? lean[k] : 1)]; });
      var sc = pickWith(dice[i], pool), forced = false;
      var empty = SCENES[sc].empty && !guested && !NEVER_EMPTY[type];
      // THE RULE: never two empty sections running — the die read again
      // from the seatings that are not the plain house (the sacrament's
      // stillness kept: the rite before it takes the seating instead). The
      // die is read again WITHIN the plain house's share of it (again(), a
      // fresh die given that it fell there): read as it fell, a die low
      // enough to land on the plain house — first in the testimony's pool —
      // landed again on the first seating after it, and the choir alone
      // took 44 % of the testimonies the rule seated
      if (empty && prevEmpty) {
        var back = out[i - 1], bOdds = back && SCENE_ODDS[plan[i - 1].type];
        if (KEEPS_STILL[type] && bOdds) {
          var bAll = Object.keys(bOdds).map(function (k) { return [k, bOdds[k] * (lean[k] != null ? lean[k] : 1)]; });
          var bPool = bAll.filter(function (p) { return !SCENES[p[0]].empty; });
          out[i - 1] = { scene: pickWith(again(dice[i - 1], bAll, "plain"), bPool), empty: false, forced: true };
        } else {
          sc = pickWith(again(dice[i], pool, "plain"), pool.filter(function (p) { return !SCENES[p[0]].empty; }));
          empty = false; forced = true;
        }
      }
      out.push({ scene: sc, empty: empty, forced: forced });
      prevEmpty = empty;
    });
    return out;
  }

  // ==========================================================================
  // THE KOLOB RECKONING (§7.2) — pure: a written doxology read against the
  // sections before it
  // ==========================================================================
  // info: { sections: [{ index, type, keyMonzo, mode }] — every section from
  //   the prelude to the last before the doxology, in order; its key (a
  //   hymn's own, else home) and its mode }
  // → { ok, from (0: the prelude carries the first note; 1: the prelude is
  //   dawn on the keynote and the cantus begins in the invocation), n,
  //   cantus: [{ index, type, deg, tuneMonzo, monzo (the note as the drone
  //   sounds it — the section's own chord tone, exact), role }], why }
  // A note is heard at a section when its class lies within TOLERANCE of the
  // tonic, the third or the fifth of the section's key in the section's
  // mode; the drone then sounds THAT tone (a comma from the tune's spelling
  // at most — the harmony's tuning, never the melody's, so it never beats
  // against the chord it stands under).
  var TOLERANCE_C = 25;
  var STILL_ANY_NOTE = false;   // true lets a still rite (the sacrament seated plain, no guest in it) stand on any note of the tune; off because a drone off the chord there clashed a second in 61 % of the sacrament's harmonies, against the keynote's 37 % (14 seeds)
  var MINOR = { dorian: true, aeolian: true };
  function cents(m) { return 1200 * (m[0] + m[1] * Math.log2(3) + m[2] * Math.log2(5) + (m[3] || 0) * Math.log2(7)); }
  function mz(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function cls(m) { var c = cents(m), k = Math.floor(c / 1200 + 1e-9); return [m[0] - k, m[1], m[2], m[3] || 0]; }
  function pcDist(a, b) { var d = Math.abs(((cents(a) - cents(b)) % 1200 + 1200) % 1200); return Math.min(d, 1200 - d); }
  // (the day's scale at home, exact: a note in it, octave aside)
  var SCALES = {
    ionian: [[0, 0, 0, 0], [-3, 2, 0, 0], [-2, 0, 1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, -1, 1, 0], [-3, 1, 1, 0]],
    mixolydian: [[0, 0, 0, 0], [-3, 2, 0, 0], [-2, 0, 1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, -1, 1, 0], [4, -2, 0, 0]],
    dorian: [[0, 0, 0, 0], [-3, 2, 0, 0], [1, 1, -1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, -1, 1, 0], [4, -2, 0, 0]],
    aeolian: [[0, 0, 0, 0], [-3, 2, 0, 0], [1, 1, -1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [3, 0, -1, 0], [4, -2, 0, 0]],
  };
  SCALES.penta = SCALES.hexa = SCALES.ionian;
  function inScale(m, mode) { return (SCALES[mode] || SCALES.ionian).some(function (d) { return pcDist(m, d) < 0.5; }); }
  function triad(key, mode) {
    var third = MINOR[mode] ? [1, 1, -1, 0] : [-2, 0, 1, 0];              // 6/5 : 5/4
    return [["tonic", cls(key)], ["third", cls(mz(key, third))], ["fifth", cls(mz(key, [-1, 1, 0, 0]))]];
  }
  // the tune's first notes: the melody part's onsets, in order, as absolute
  // monzos (the hymn's key plus the note's), across its lines — every
  // syllable's note ("notes"), or only the notes on the strong syllables
  // ("strong": the tune's skeleton, the notes a cantus firmus in long values
  // keeps; a hymn sets its chord tones on its stresses, and its passing
  // notes between)
  function tuneOnsets(h, n, strong) {
    var out = [], part = h.melodyPart || "S", key = h.keyMonzo || [0, 0, 0, 0];
    var lines = (h.lines || []).concat(h.refrain || []);
    for (var i = 0; i < lines.length && out.length < n; i++) {
      var ns = (lines[i].notes && lines[i].notes[part]) || [];
      for (var j = 0; j < ns.length && out.length < n; j++) {
        var x = ns[j];
        // (a syllable's first note only: a melisma's continuation, or the
        // far side of a tie, is the same syllable still sounding)
        if (x.syl === null || (j > 0 && ns[j - 1].tie)) continue;
        if (!x.monzo) continue;
        if (strong && !x.stress) continue;
        out.push({ deg: x.deg, monzo: mz(key, x.monzo) });
      }
    }
    return out;
  }
  function fitFrom(notes, secs, from) {
    var cantus = [], bad = [];
    for (var j = from; j < secs.length; j++) {
      var s = secs[j], nt = notes[j - from];
      if (!nt) { bad.push(j); continue; }
      // (a still rite keeps the rule every rite keeps — the tonic, the third
      // or the fifth — unless STILL_ANY_NOTE is set: the strings bow the
      // day's chord there, so the drone is not all there is in it)
      if (STILL_ANY_NOTE && s.still && s.mode && inScale(nt.monzo, s.mode)) {
        cantus.push({ index: s.index, type: s.type, deg: nt.deg, tuneMonzo: cls(nt.monzo), monzo: cls(nt.monzo), role: "alone", off: 0 });
        continue;
      }
      var best = null;
      triad(s.keyMonzo || [0, 0, 0, 0], s.mode).forEach(function (t) {
        var d = pcDist(nt.monzo, t[1]);
        if (d <= TOLERANCE_C && (!best || d < best.d)) best = { role: t[0], monzo: t[1], d: d };
      });
      if (!best) { bad.push(j); continue; }
      cantus.push({ index: s.index, type: s.type, deg: nt.deg, tuneMonzo: cls(nt.monzo), monzo: best.monzo, role: best.role, off: r3(best.d) });
    }
    return { cantus: cantus, bad: bad };
  }
  // THE CANTUS MUST MOVE: a reading whose notes are fewer than CANTUS_MOVES
  // pitches (the prelude's keynote counted where the cantus begins after
  // it) is no cantus — a tune whose stressed notes are all sol turned the
  // drone once and held it fourteen minutes (seed 37), and spelled
  // nothing the doxology could be recognised by — so the desk tries the
  // next way of writing it instead
  var CANTUS_MOVES = 3;
  function moves(cantus, from) {
    var seen = from === 1 ? [[0, 0, 0, 0]] : [];
    cantus.forEach(function (c) { if (!seen.some(function (m) { return pcDist(m, c.monzo) < 1; })) seen.push(c.monzo); });
    return seen.length >= Math.min(CANTUS_MOVES, cantus.length + (from === 1 ? 1 : 0));
  }
  // reckon(h, info, by): by "notes" (every syllable's note, the plan's own
  // reading) or "strong" (the skeleton); either way, in order, one a section
  function reckon(h, info, by) {
    var secs = (info && info.sections) || [], strong = by === "strong";
    if (!h || !h.lines || !secs.length) return { ok: false, from: null, n: 0, cantus: [], by: by || "notes", why: "no doxology, or no section before it" };
    var notes = tuneOnsets(h, secs.length, strong);
    if (notes.length < Math.min(3, secs.length)) return { ok: false, from: null, n: 0, cantus: [], by: by || "notes", why: "the tune is too short" };
    // A: the prelude carries the first note — which must be the keynote the
    // drone already sounds at dawn
    var A = fitFrom(notes, secs, 0);
    var firstHome = pcDist(notes[0].monzo, [0, 0, 0, 0]) <= TOLERANCE_C;
    if (!A.bad.length && firstHome && moves(A.cantus, 0)) return { ok: true, from: 0, n: A.cantus.length, cantus: A.cantus, by: strong ? "strong" : "notes", why: null };
    // B: the prelude is dawn on the keynote; the cantus begins in the invocation
    if (secs.length > 1) {
      var B = fitFrom(notes, secs, 1);
      if (!B.bad.length && moves(B.cantus, 1)) return { ok: true, from: 1, n: B.cantus.length, cantus: B.cantus, by: strong ? "strong" : "notes", why: null };
      if (!B.bad.length) return { ok: false, from: null, n: 0, cantus: [], by: strong ? "strong" : "notes", why: "the tune hardly moves (fewer than " + CANTUS_MOVES + " notes of it)" };
      return { ok: false, from: null, n: 0, cantus: [], by: strong ? "strong" : "notes", why: (B.bad.length) + " of " + (secs.length - 1) + " notes stand off their section's key", bad: B.bad };
    }
    return { ok: false, from: null, n: 0, cantus: [], by: strong ? "strong" : "notes", why: "one section before the doxology" };
  }
  // how many ways the desk writes a doxology before it falls back (the first
  // is the doxology the composer would have written anyway). 24: with the
  // still sacrament held to the rule, 12 reckoned 62.7 %
  // of 600 doxologies (the tune's own notes on 150 of them); 24 reckon
  // 70.5 % (211 by its own notes), for twice the desk's time in the
  // composer's worker, off the audio path (Node: 82 → 130 ms at the median)
  var RECKON_CANDIDATES = 24;

  return {
    SUNDAYS: SUNDAYS, ORDER: ORDER, KINDS: KINDS,
    GUEST_ODDS: GUEST_ODDS, GUEST_COLUMNS: GUEST_COLUMNS, GUEST_BUDGET: GUEST_BUDGET, guestOdds: guestOdds, neighboursMay: neighboursMay,
    draw: draw, kindOf: kindOf, sunday: sunday, meetingRow: meetingRow,
    ARC: ARC, phaseOf: phaseOf, light: light, lights: lights, dialectLean: dialectLean, regLean: regLean, richHymnist: richHymnist,
    SCENES: SCENES, SCENE_ODDS: SCENE_ODDS, scenes: scenes,
    reckon: reckon, tuneOnsets: tuneOnsets, RECKON_CANDIDATES: RECKON_CANDIDATES, TOLERANCE_C: TOLERANCE_C,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-calendar.js"] = true;   // the load guard's roll call
