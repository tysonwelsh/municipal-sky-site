// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE CALENDAR (KOLOB.Calendar): the Sunday, the light, the
// seatings, the reckoning
//
// Round 3b, step 4: the shape of a visit (PLAN-COMPOSITION §7).
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
// SEATINGS (§7.4). The prelude has had its seatings since the v0.34 polish
// (kolob-meeting.js seatPrelude). The other rites that are not hymns now
// draw one too (scenes()): the house as it always sat (plain), LINED OUT
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
// sections before it (pure); the hymnal's desk writes the doxology a few
// ways and keeps the first whose opening stands on every section's key
// (kolob-hymnal.js, the errand "reckon"). If none does, the meeting FALLS
// BACK cleanly: the doxology as the composer first wrote it, and the drone
// on the day's keynote as ever (no glide). The switch
// KOLOB.Experimental.reckoning (?exp=-reckoning) turns it off.
//
// PURE (SCORE §1): no AudioContext, no DOM, no Math.random, no clock. Every
// die is the caller's (a PJ2.Rand stream, or a die already thrown); it loads
// in Node and in the composer's worker (kolob-hymnal.js DESK_FILES), where
// the errand calls reckon().
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
  //   guests    factors on the odds of the guests whose dice the plan throws
  //             itself (the bands, the steeples, the old tune); the trombones,
  //             the handbells and the singing school read the Sunday in their
  //             own rooms (their ODDS.weight tables)
  //   cast      how many of the ward you come to know: opt (the optional
  //             roles, beside the chorister, the precentor and the soloist)
  //             and testimony (how many rise)
  //   organist  factors on the three organists' odds
  //   reg       how the organ is drawn, −1 … +1 (the plain flutes … the full
  //             organ), on top of the light
  //   morning   factors on the prelude's seatings (seatPrelude)
  //   scenes    factors on the other rites' seatings (scenes)
  //   arc       the Sunday's own light: offsets and overrides (ARC below)
  //   dox       factors on the doxology's own dialect (a funeral rises into
  //             the Tabernacle's "all is well"; Easter's full Tabernacle)
  //   hosanna   the Hosanna may come (§8.12; not built yet — a hook, unlogged)
  var SUNDAYS = {
    ordinary: {
      share: 0.45, kind: "ordinary", ds: "𐐃𐐡𐐔𐐆𐐤𐐇𐐡𐐆 𐐝𐐊𐐤𐐔𐐁", en: "AN ORDINARY SUNDAY",
      about: "the house style varies",
      plan: {}, season: [0.2, 0.7], guests: {}, cast: { opt: [3, 5], testimony: [2, 3] },
      organist: {}, reg: 0, morning: {}, scenes: {}, arc: {},
    },
    fast: {
      share: 0.15, kind: "fast", ds: "𐐙𐐈𐐝𐐓 𐐝𐐊𐐤𐐔𐐁", en: "FAST SUNDAY",
      about: "testimony-heavy and sparse; the Sacred Harp and the Old Way; the precentor",
      // (the testimony is the meeting's centre: never cut, and longer)
      plan: { cutTestimony: 0, lens: { testimony: 1.35, invocation: 1.1 } }, season: [0, 0.35],
      guests: { bands: 0.5, steeples: 0.6, oldtune: 1.2 }, cast: { opt: [3, 4], testimony: [3, 3] },
      organist: { plain: 1.3 }, reg: -0.45,
      morning: { arbor: 1.8, ground: 1.4, humming: 1.3, voluntary: 0.6, parlor: 0.8 },
      scenes: { lined: 2.2, arbor: 1.6, voluntary: 0.6, choir: 0.9 },
      arc: { morning: [0.32, 0.5], full: 0.8, stillness: 0.06 },
    },
    conference: {
      share: 0.12, kind: "conference", ds: "𐐖𐐇𐐤𐐊𐐡𐐊𐐢 𐐗𐐉𐐤𐐙𐐡𐐇𐐤𐐝", en: "GENERAL CONFERENCE",
      about: "three hymns, the choir, the full organ, the Tabernacle",
      plan: { hymns: 3 }, season: [0.5, 0.9], guests: {}, cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { victorian: 1.3 }, reg: 0.4,
      morning: { voluntary: 1.9, humming: 1.2, arbor: 0.5, valley: 0.8 },
      scenes: { voluntary: 1.8, choir: 1.5, lined: 0.5, arbor: 0.5 },
      arc: { lift: 0.04 },
    },
    pioneer: {
      share: 0.08, kind: "jubilee", ds: "𐐑𐐌𐐊𐐤𐐀𐐡 𐐔𐐁", en: "PIONEER DAY",
      about: "the brass bands, the gospel ring; the handcarts remembered",
      plan: { hymns: 3, secondDox: 0.5 }, season: [0.75, 1],
      guests: { bands: 2.1, steeples: 0.8, oldtune: 1.3 }, cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { improviser: 1.2 }, reg: 0.25,
      morning: { parlor: 1.6, voluntary: 1.2, valley: 1.2 },
      scenes: { arbor: 1.3, voluntary: 1.2 },
      arc: { lift: 0.06 }, dox: { gospel: 1.5 },
    },
    christmas: {
      share: 0.06, kind: "jubilee", ds: "𐐗𐐡𐐆𐐝𐐣𐐊𐐝", en: "CHRISTMAS",
      about: "shape-note carols, the bells, the Primary",
      plan: { hymns: 3, secondDox: 0.3 }, season: [0.6, 0.9],
      guests: { bands: 0.5, steeples: 2.4, oldtune: 1.2 }, cast: { opt: [4, 5], testimony: [2, 2] },
      organist: {}, reg: 0.1,
      morning: { humming: 2, valley: 1.4, strings: 1.2 },
      scenes: { choir: 1.8, voluntary: 1.2 },
      arc: { evening: 0.5 },
    },
    easter: {
      share: 0.06, kind: "jubilee", ds: "𐐀𐐝𐐓𐐊𐐡", en: "EASTER",
      about: "the brightest light, the Tabernacle in full; the Hosanna possible",
      plan: { hymns: 3, secondDox: 0.5, bright: 0.95 }, season: [0.85, 1],
      guests: { bands: 0.7, steeples: 1.8 }, cast: { opt: [4, 5], testimony: [2, 3] },
      organist: { victorian: 1.3 }, reg: 0.5,
      morning: { voluntary: 1.7, strings: 1.3 },
      scenes: { voluntary: 1.5, choir: 1.3 },
      arc: { lift: 0.1 }, hosanna: true, dox: { tabernacle: 1.5, gospel: 1.3, oldway: 0.5 },
    },
    wedding: {
      share: 0.04, kind: "ordinary", ds: "𐐊 𐐎𐐇𐐔𐐆𐐥", en: "A WEDDING",
      about: "gentle; a love song; the soloist",
      plan: { hymns: 2, cutTestimony: 0.6, bright: 0.7, silenceMul: 0.9 }, season: [0.5, 0.8],
      guests: { bands: 0.6, steeples: 1.5, oldtune: 1.3 }, cast: { opt: [3, 5], testimony: [2, 2] },
      organist: { victorian: 1.4 }, reg: -0.1,
      morning: { parlor: 1.8, strings: 1.5, voluntary: 1.2, arbor: 0.5 },
      scenes: { voluntary: 1.5, choir: 1.1, lined: 0.5 },
      arc: { morning: [0.45, 0.62], evening: 0.5 },
    },
    funeral: {
      share: 0.03, kind: "ordinary", ds: "𐐊 𐐙𐐧𐐤𐐊𐐡𐐊𐐢", en: "A FUNERAL",
      about: "hopeful: slow, then rising — all is well",
      // (no raspberry, no refrain, no round, no singing school: the forms and
      // the guests' own rooms refuse them at a funeral)
      plan: { hymns: 2, silenceMul: 1.35, bright: 0.4, bells: 0.3, cutTestimony: 0.1, lens: { invocation: 1.2, sacrament: 1.2 },
              meterW: [["LM", 3], ["CM", 3], ["SM", 2], ["87.87", 1]] },
      season: [0.1, 0.45], guests: { bands: 0.15, steeples: 0.8, oldtune: 1.6 }, cast: { opt: [2, 4], testimony: [2, 3] },
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
      plan: { hymns: 3, bright: 0.9 }, season: [0.8, 1], guests: { steeples: 1.6 }, cast: { opt: [5, 5], testimony: [2, 3] },
      organist: { victorian: 1.6 }, reg: 0.6,
      morning: { voluntary: 2.4, humming: 1.2 },
      scenes: { voluntary: 1.8, choir: 1.6, arbor: 0.4, lined: 0.4 },
      arc: { lift: 0.08 }, hosanna: true, dox: { tabernacle: 1.5 },
    },
  };
  var ORDER = ["ordinary", "fast", "conference", "pioneer", "christmas", "easter", "wedding", "funeral", "dedication"];
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
  var LIGHT_ANCHORS = [
    [0.1,  { sacredharp: 1.55, oldway: 1.6, shaker: 1.45, psalmody: 1.15, tabernacle: 0.72, gospel: 0.5 }],
    [0.5,  { sacredharp: 1.05, oldway: 1.0, shaker: 1.0, psalmody: 1.1, tabernacle: 1.0, gospel: 0.95 }],
    [1.0,  { sacredharp: 0.42, oldway: 0.28, shaker: 0.6, psalmody: 0.65, tabernacle: 2.2, gospel: 2.2 }],
  ];
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
      // stillness kept: the rite before it takes the seating instead)
      if (empty && prevEmpty) {
        var back = out[i - 1], bOdds = back && SCENE_ODDS[plan[i - 1].type];
        if (KEEPS_STILL[type] && bOdds) {
          var bPool = Object.keys(bOdds).filter(function (k) { return !SCENES[k].empty; }).map(function (k) { return [k, bOdds[k] * (lean[k] != null ? lean[k] : 1)]; });
          out[i - 1] = { scene: pickWith(dice[i - 1], bPool), empty: false, forced: true };
        } else {
          sc = pickWith(dice[i], pool.filter(function (p) { return !SCENES[p[0]].empty; }));
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
      // (a still rite — the sacrament seated plain, no guest in it — has
      // nothing sounding for the drone to stand against: in it the drone is
      // all there is, and any note of the tune is heard as itself)
      if (s.still && s.mode && inScale(nt.monzo, s.mode)) {
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
    if (!A.bad.length && firstHome) return { ok: true, from: 0, n: A.cantus.length, cantus: A.cantus, by: strong ? "strong" : "notes", why: null };
    // B: the prelude is dawn on the keynote; the cantus begins in the invocation
    if (secs.length > 1) {
      var B = fitFrom(notes, secs, 1);
      if (!B.bad.length) return { ok: true, from: 1, n: B.cantus.length, cantus: B.cantus, by: strong ? "strong" : "notes", why: null };
      return { ok: false, from: null, n: 0, cantus: [], by: strong ? "strong" : "notes", why: (B.bad.length) + " of " + (secs.length - 1) + " notes stand off their section's key", bad: B.bad };
    }
    return { ok: false, from: null, n: 0, cantus: [], by: strong ? "strong" : "notes", why: "one section before the doxology" };
  }
  // how many ways the desk writes a doxology before it falls back (the first
  // is the doxology the composer would have written anyway)
  var RECKON_CANDIDATES = 12;

  return {
    SUNDAYS: SUNDAYS, ORDER: ORDER, KINDS: KINDS,
    draw: draw, kindOf: kindOf, sunday: sunday, meetingRow: meetingRow,
    ARC: ARC, phaseOf: phaseOf, light: light, lights: lights, dialectLean: dialectLean, regLean: regLean,
    SCENES: SCENES, SCENE_ODDS: SCENE_ODDS, scenes: scenes,
    reckon: reckon, tuneOnsets: tuneOnsets, RECKON_CANDIDATES: RECKON_CANDIDATES, TOLERANCE_C: TOLERANCE_C,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-calendar.js"] = true;   // the load guard's roll call
