// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE ORGANIST (KOLOB.Organist)
//
// Every ward has one, and every ward's is different. The organ at the rim of
// Kolob's light was built from one set of plans; the person on the bench was
// not. Each Sunday seats an organist, drawn from three kinds the colony's
// meetinghouses have always known:
//
//   THE PLAIN ORGANIST plays what is printed. Four-square, the tempo the
//     chorister set, soft flutes and a quiet pedal; every repeated note
//     struck again, every line given its breath, never a note between the
//     lines. The ward always knows where it is.
//   THE VICTORIAN learned from a Salt Lake City organist who learned from a
//     London one. Suspensions at the cadences, passing notes in the tenor,
//     the vox humana with its tremulant (every organist was told not to
//     overdo it; every organist did), and the swell pedal breathing under the
//     line — opening toward the high note, closing at the close. Between the
//     lines, now and then, one voice holds over and links the next.
//   THE IMPROVISER plays the hymn, mostly. The interludes wander; the tune
//     goes down into the pedals with figures running over it; and once in a
//     meeting, at most, a fill between the lines strays into a key the hymn
//     has never visited, until the ward's next entry drags the organ back.
//
// The roots. The chorale prelude, which existed to introduce the
// congregation's chorale (Bach's Orgelbüchlein), and the Latter-day Saint
// habit of the organist playing a hymn arrangement before the meeting. The
// "giving out" of the tune before the people sing it. The Zwischenspiele,
// the organ's interludes between the lines of a Lutheran chorale — and the
// consistory at Arnstadt, 1706, which reprimanded a young organist for "many
// curious variationes in the chorale, mingling many strange tones in it, so
// that the congregation was confounded by it". And Charles Ives, organist at
// Danbury, New Haven and Central Presbyterian until 1902, whose Adeste
// Fideles in an Organ Prelude lays the hymn in the pedals under a manual
// part living its own life, and whose father trained him to sing in one key
// over an accompaniment in another. (PLAN-COMPOSITION §5.2, §14 item 4 —
// approved, sparingly; §15 item 2 — the prelude on the day's first hymn,
// approved, as a draw, never the fixed opening.)
//
// WHAT THIS ROOM DOES. It PLANS, purely — no audio, no DOM, no Math.random,
// no clock (SCORE §1): every die is the caller's stream, forked by label, and
// thrown whether or not it is used. A plan is plain JSON: phrases of keys in
// exact just intonation (monzos relative to the day's keynote), the swell's
// movements, the log's lines, and — for a hymn — when the ward sings each
// line, so the singers and the organ keep one clock. Then a small PERFORMER
// lays a plan onto a KOLOB.VoicesOrgan a few seconds ahead of the music
// (never the whole hymn at once), and reports every written note it sounds.
//
//   seat(stream, info)                    → an organist for the Sunday
//       info: { kind, houseDialect, bright, ives }        stream: cast:<n> → member:organist
//   preludeDraw(organist, stream, info)   → { play, why, odds, roll }
//       info: { trombones, withheld, organSits, hymn, unison, guest, hum }  (a draw; refusals are listed)
//   prelude(organist, hymn, stream, opts) → Plan   (30–50 s on the day's first hymn)
//   accompany(organist, hymn, stream, opts) → Plan (giving out, the verses under
//       the ward — each on its registration, at its place in the organist's
//       arc (VERSE_DYN) — fills between the lines, interludes between verses,
//       the amen, and a modulation by a common-tone pivot when opts.next's key
//       differs)
//       opts: { verses (2), beatS (hymn.beatS), hymnIndex (0), next: {keyMonzo, mode} | null,
//               giveOut (true), accompanied (the dialect's own), amen (true) }
//   hymnHands(organist, hymn, stream, opts) → the same hymn written in PIECES
//       (for the meeting) — giveOut, verse, interlude, amen, modulation,
//       each from the time it is handed; the ward waits for a verse's fills
//       (piece.waits), and the organ plays by the chorister's clock (ck)
//   modulate(organist, from, to, stream, opts) → Plan (the pivot alone, for a joint)
//   measure(plan) → the rates the lab and the tools count (fills per join, ornaments per line, …)
//   describe(plan) → plain words, one line per event
//   lineEvents(hymn, line, part, t0, beatS, next, ck) / lineDur(line, beatS, next, ck)
//       → THE CLOCK the ward must sing by (the organ plays by it); ck: the
//       chorister's ({rit, hold}), or null — the organist's own
//   perform(organ, plan, t0, { keynoteHz, onNote, onEvent, hymnId }) → { pump(now, ahead), until }
//
// THE LEDGER. An organist carries the meeting's ledger (organist.ledger):
// hymns played, fills, and strange fills — at most ONE strange fill a
// meeting, whatever the dice say. Seat a new organist for a new meeting.
// No fill, and no organ at all, in the unaccompanied dialects (the Sacred
// Harp, the psalmody, the Old Way, and the Shaker unison song — or whatever
// the dialect's own profile says, where it has one).
//
// LEVEL. The organist's organ is made with ORGAN_GAIN into the engine's
// organ layer (0.40); organist-lab measures every style's prelude and
// accompaniment against the engine's own organChord through the same layer,
// and they sit within ±2 LU of it (the owner found the organ "pretty loud";
// nothing here is louder than the organ he has now). In the meeting the
// organ under the ward is lifted by kolob-voices-organ.js's UNDER_WARD_DB to
// where the organ's own part lines sit under the hymns (some 5 dB over
// organChord); the preludes are played as planned here.
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Organist = (function () {
  "use strict";
  var K = window.KOLOB;

  // the gain an organist's organ is built with (VoicesOrgan.create opts.gain),
  // into the organ layer — calibrated in organist-lab against organChord
  var ORGAN_GAIN = 1.15;
  // the organ alone in the prelude plays a little forward (dB) — by style
  // (measured over twenty Sundays in organist-lab: the Victorian's
  // preludes sat about 0.8 LU over the engine's organ, the swell voluntary
  // up to +2.2, and the improviser's — running flutes over a pedal tune —
  // about 1.3 LU under it, down to −2.6; each is centred here)
  var PRELUDE_LIFT = { plain: 1.3, victorian: 0.5, improviser: 2.4 };
  // …and a hymn's, by style (dB): the Victorian's swell breathing at the
  // high line and his last verse on the full organ, and the improviser's
  // brighter stops, sat their hymns about 0.6–0.7 LU over the plain
  // organist's; each is brought to the band's middle, the arc inside it kept
  var HYMN_LIFT = { plain: 0, victorian: -0.5, improviser: -0.4 };

  // ==========================================================================
  // PITCH — exact, as monzos [2, 3, 5, 7] (SCORE §2), relative to the keynote
  // ==========================================================================
  function mz(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function oct(m, k) { return [m[0] + k, m[1], m[2], m[3] || 0]; }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function cents(m) { return 1200 * Math.log(ratio(m)) / Math.LN2; }
  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && (a[3] || 0) === (b[3] || 0); }
  function cls(m) { return oct(m, -Math.floor(cents(m) / 1200 + 1e-9)); }       // the octave-free class, [1, 2)
  function near(m, c) { var k = cls(m); return oct(k, Math.round((c - cents(k)) / 1200)); }
  var COMMA = [-4, 4, -1, 0];                                                    // 81/80
  function commaNear(a, b) { var x = cls(a), y = cls(b); return eq(cls(mz(x, COMMA)), y) || eq(cls(mz(y, COMMA)), x); }
  var UP_SEMI = [4, -1, -1, 0], DN_SEMI = [-4, 1, 1, 0];                         // 16/15 up, down
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  // a fraction "a/b" as a monzo (for the tables below)
  function frac(s) {
    var p = String(s).split("/"), m = [0, 0, 0, 0];
    [[+p[0], 1], [+(p[1] || 1), -1]].forEach(function (q) {
      var n = q[0];
      [2, 3, 5, 7].forEach(function (pr, i) { while (n % pr === 0 && n > 1) { m[i] += q[1]; n /= pr; } });
    });
    return m;
  }
  // a degree of the mode (0 = the final; 7 an octave up), as the composer
  // spells it — or, standing alone, from the parent scales below
  var PARENT = {
    ionian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian: ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian: ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
  };
  PARENT.penta = PARENT.hexa = PARENT.ionian;
  function degM(mode, d, alt) {
    var C = K.Composer;
    if (C && C.spelledMonzo) return C.spelledMonzo(mode, d, alt || 0);
    var o = Math.floor(d / 7), m = frac((PARENT[mode] || PARENT.ionian)[((d % 7) + 7) % 7]);
    m = oct(m, o);
    return alt > 0 ? mz(m, [-3, -1, 2, 0]) : alt < 0 ? mz(m, [3, 1, -2, 0]) : m;   // 25/24
  }
  var MINOR = { aeolian: true, dorian: true };
  // the mode's own collection, as classes in the hymn's key (the gapped
  // scales leave their gaps: no fa or ti in the pentatonic)
  function scaleOf(mode, key) {
    var drop = mode === "penta" ? { 3: 1, 6: 1 } : mode === "hexa" ? { 6: 1 } : {}, out = [];
    for (var d = 0; d < 7; d++) if (!drop[d]) out.push(cls(mz(key, degM(mode, d, 0))));
    return out;
  }
  // the scale's next pitch above (dir +1) or below (−1) m
  function stepOf(scale, m, dir) {
    var c0 = cents(m), best = null, bd = 1e9;
    scale.forEach(function (s) {
      for (var k = -2; k <= 2; k++) {
        var p = near(s, c0 + dir * 150 + k * 1200), d = (cents(p) - c0) * dir;
        if (d > 60 && d < bd) { bd = d; best = p; }
      }
    });
    return best || (dir > 0 ? mz(m, [-3, 2, 0, 0]) : mz(m, [3, -2, 0, 0]));
  }

  // ==========================================================================
  // THE STOPS THEY DRAW — registrations as the organ's own {stop: level}
  // (KOLOB.VoicesOrgan.STOPS), named the way an organist would say them
  // ==========================================================================
  var REG = {
    "soft flutes":         { flute8: 0.85, flute4: 0.4, bourdon16: 0.6, trem: 0 },
    "quiet flute":         { flute8: 1, bourdon16: 0.5, trem: 0 },
    "flutes 8 & 4":        { flute8: 0.9, flute4: 0.8, bourdon16: 0.65, trem: 0 },
    "hymn principal":      { principal8: 1, flute8: 0.5, flute4: 0.35, bourdon16: 0.8, trem: 0 },
    "principal & 4":       { principal8: 0.9, flute4: 0.75, bourdon16: 0.7, trem: 0 },
    "vox humana":          { vox8: 1, flute8: 0.55, bourdon16: 0.5, trem: 1 },
    "vox & flutes":        { vox8: 0.7, flute8: 0.8, flute4: 0.3, bourdon16: 0.55, trem: 0.8 },
    "vox solo":            { vox8: 1, flute8: 0.25, trem: 1 },                 // the tune alone, trembling
    "flutes, trembling":   { flute8: 0.8, flute4: 0.2, bourdon16: 0.6, trem: 1 },  // under the vox solo
    "echo flute":          { flute8: 0.7, trem: 0.45 },
    "trumpet":             { trumpet8: 1, flute8: 0.35, bourdon16: 0.5, trem: 0 },
    "trumpet solo":        { trumpet8: 1, flute8: 0.2, trem: 0 },
    "full organ":          { principal8: 1, flute8: 0.6, flute4: 0.7, mixture: 1, trumpet8: 0.8, bourdon16: 1, trem: 0 },
    "principal & mixture": { principal8: 1, flute4: 0.5, mixture: 0.7, bourdon16: 0.85, trem: 0 },
    "sixteen & four":      { flute4: 1, bourdon16: 0.9, trem: 0 },                   // the gap: nothing at 8′
    "glass":               { mixture: 0.75, flute4: 0.35, trem: 0 },               // the mixture alone
    "pedal tune":          { principal8: 0.8, trumpet8: 0.22, bourdon16: 1, trem: 0 },
    "figures":             { flute8: 0.55, flute4: 0.75, trem: 0 },
  };
  if (Object.freeze) { for (var rn in REG) Object.freeze(REG[rn]); Object.freeze(REG); }
  // THE BALANCE (dB, per registration): what the organist's ear does without
  // thinking — a soft registration played so it still carries, a big one
  // held back — so that every Sunday's organ sits at the level of the organ
  // the meeting has now (±2 LU), whichever stops are drawn. Measured in
  // organist-lab (OrganistLab.registrations(true): the same two lines on
  // every registration at swell 0.62); each trim closes 80 % of the gap to
  // the hymn principal, so a flute is still a little softer than the full
  // organ — the three the plain organist lives on nearly all of it (the
  // plain organist has no louder stops to reach for).
  // The balance is only where each registration SITS. What the organist
  // then does with it — a quiet middle verse, the last on the full organ —
  // is VERSE_DYN below, on top of it. (With the balance alone, the
  // Victorian's three verses of seed 1840 read −31.4, −31.6 and −31.8 LUFS
  // — the full organ 0.4 dB QUIETER than the first verse, only brighter —
  // while the note promised a quiet verse and a full last one: hence
  // VERSE_DYN. Loosening the balance instead would take the plain
  // organist's flutes, which have nothing louder to reach for, 2–3 LU under
  // the engine's organ.)
  var REG_TRIM = {"soft flutes": 4.5, "quiet flute": 3.9, "flutes 8 & 4": 3.3, "hymn principal": 0.0, "principal & 4": 2.2, "vox humana": 2.9, 
    "vox & flutes": 2.3, "vox solo": 4.9, "flutes, trembling": 4.3, "echo flute": 5.9, "trumpet": 2.8, "trumpet solo": 3.8, "full organ": -1.5, 
    "principal & mixture": 1.2, "sixteen & four": 5.7, "glass": 6.5, "pedal tune": 2.6, "figures": 5.8 };
  function trimOf(reg) { return typeof reg === "string" && REG_TRIM[reg] != null ? REG_TRIM[reg] : 0; }
  // THE VERSE'S DYNAMIC (dB, over the balance): the arc of a hymn, verse by
  // verse, as each organist draws it. The plain organist has none: the
  // flutes all the way, a principal at most for the last verse, at one
  // level. The Victorian takes a middle verse down (the vox over the
  // flutes, or the flutes alone) and the last of three up, on the full
  // organ with the shutters open. The improviser's arc is his registrations'
  // own: the thin middle verses a little under, the mixture or the full
  // organ over. The loudest verse is held within +2 LU of the engine's
  // organ under the singing (organist-lab, Check: "the verses"); so that
  // the arc can still rise to it, an organist who means to end on the full
  // organ or the mixture begins the first verse a little held back
  // (VERSE_RESERVE) — the hymn builds, it does not only get brighter.
  var VERSE_DYN = {
    plain: {},
    victorian: { "vox & flutes": -3.5, "flutes 8 & 4": -3, "full organ": 1.2 },
    improviser: { "sixteen & four": -2.5, "flutes 8 & 4": -2, "principal & mixture": 0.8, "full organ": 1.2 },
  };
  function dynOf(style, reg) { var d = VERSE_DYN[style] || {}; return d[reg] != null ? d[reg] : 0; }
  var VERSE_RESERVE = -0.8;
  // how a verse's registration is named in the plan's words
  var SAYS = { "soft flutes": "on soft flutes", "quiet flute": "on one quiet flute", "flutes 8 & 4": "on the flutes, 8′ and 4′", "hymn principal": "on the principal",
               "principal & 4": "on the principal and the 4′", "vox & flutes": "on the vox humana over the flutes",
               "full organ": "on the full organ", "principal & mixture": "on the principal and the mixture",
               "sixteen & four": "on a 16′ and a 4′, nothing between" };
  function regOf(name) {
    var r = REG[name] || name, o = {};
    for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    return o;
  }
  // what the log says when a registration is drawn
  var PULLS = {
    "soft flutes": "draws the soft flutes", "quiet flute": "draws one quiet flute", "flutes 8 & 4": "draws the flutes, 8′ and 4′",
    "hymn principal": "draws the principal", "principal & 4": "draws the principal and the 4′ flute",
    "vox humana": "pulls the vox humana, with the tremulant", "vox & flutes": "pulls the vox humana over the flutes",
    "vox solo": "sets the tune on the vox humana", "echo flute": "draws the echo flute", "trumpet": "draws the trumpet",
    "trumpet solo": "sets the tune on the trumpet", "full organ": "draws the full organ, mixtures and all",
    "principal & mixture": "draws the principal and the mixture", "sixteen & four": "draws a 16′ and a 4′ with nothing between",
    "glass": "draws the mixture alone", "pedal tune": "puts the tune in the pedals", "figures": "sets the flutes running",
    "flutes, trembling": "draws the flutes with the tremulant",
  };

  // ==========================================================================
  // THE THREE ORGANISTS
  // ==========================================================================
  // touch: how a repeated note is taken (struck again after a lift, or held)
  // and how long the lift is. fill: the share of the joins between lines
  // that get a fill (before the organist's own appetite), and the cap per
  // hymn. prelude: how often the prelude on the day's first hymn is theirs.
  var STYLES = {
    plain: {
      id: "plain", en: "the plain organist",
      about: "four-square, as printed; soft flutes; every repeated note struck again; never a note between the lines",
      weight: 0.36, prelude: 0.36,
      touch: { repeat: { S: "strike", A: "strike", T: "strike", B: "strike" }, gap: 0.06 },
      fill: { rate: 0, cap: 0 }, strange: false,
    },
    victorian: {
      id: "victorian", en: "the Victorian",
      about: "suspensions at the cadences, passing notes in the inner voices, the vox humana and the swell; links a line to the next with a held note",
      weight: 0.38, prelude: 0.46,
      touch: { repeat: { S: "strike", A: "tie", T: "tie", B: "tie" }, gap: 0.045 },
      fill: { rate: 0.13, cap: 2 }, strange: false,
    },
    improviser: {
      id: "improviser", en: "the improviser",
      about: "wanders in the interludes, the tune in the pedals under running figures, Ivesian; once a meeting at most, a fill in a strange key",
      weight: 0.26, prelude: 0.42,
      touch: { repeat: { S: "strike", A: "tie", T: "tie", B: "strike" }, gap: 0.05 },
      fill: { rate: 0.12, cap: 2 }, strange: true,
    },
  };
  // the colony's organists (Deseret for the log; the English is dev-only)
  var ROSTER = {
    plain: [["𐐐𐐴𐑉𐐲𐑋 𐐓𐐰𐑌𐐲𐑉", "Hyrum Tanner"], ["𐐢𐐯𐐻𐐨 𐐔𐐲𐑌", "Lettie Dunn"]],
    victorian: [["𐐊𐐼𐐨𐑊𐐨𐐲 𐐛𐐫𐑉𐑌", "Adelia Thorne"], ["𐐇𐐼𐐶𐐮𐑌 𐐣𐐪𐑉𐑇", "Edwin Marsh"]],
    improviser: [["𐐃𐑉𐐮𐑌 𐐚𐐰𐑌𐑅", "Orrin Vance"], ["𐐔𐐯𐑊𐑁𐐨𐐲 𐐝𐐫𐑉𐐲𐑌𐑅𐐲𐑌", "Delphia Sorensen"]],
  };
  // the keys an improviser wanders to, as transpositions of the hymn's key
  var STRAY_KEYS = [
    ["45/32", "a tritone away", 1.2], ["5/4", "a major third up", 1], ["8/5", "a major third down", 1],
    ["6/5", "a minor third up", 0.8], ["9/8", "a whole step up", 0.9], ["16/15", "a half step up", 0.6],
  ];
  var UNACCOMPANIED = { sacredharp: true, psalmody: true, oldway: true, shaker: true };
  // the chance that a fill of the wandering improviser's is the strange one
  // (once he has strayed far enough, and only the first; see accompany)
  var STRANGE_ODDS = 0.3;
  function accompaniedDialect(dialect) {
    var D = K.Dialects && K.Dialects.get ? K.Dialects.get(dialect) : null;
    if (D && D.organ != null) return !!D.organ;
    return !UNACCOMPANIED[dialect];
  }

  // seat(stream, info) → the Sunday's organist. DICE: every die is thrown
  // first, eight of them, whether or not info.style forces the style —
  // deliberate; a draw left out would move every draw after it.
  function seat(stream, info) {
    info = info || {};
    var R = stream.fork("organist");
    var dStyle = R.rnd(0, 1), dName = R.rnd(0, 1), dTempo = R.rnd(0, 1), dSwell = R.rnd(0, 1),
        dFill = R.rnd(0, 1), dKey = R.rnd(0, 1), dBit = R.rnd(0, 1), dPre = R.rnd(0, 1);
    var w = { plain: STYLES.plain.weight, victorian: STYLES.victorian.weight, improviser: STYLES.improviser.weight };
    if (info.kind === "conference" || info.kind === "jubilee") w.victorian *= 1.5;
    if (info.kind === "fast") w.plain *= 1.6;
    if (info.houseDialect === "sacredharp" || info.houseDialect === "oldway") w.plain *= 1.3;
    if (info.houseDialect === "gospel") w.victorian *= 1.2;
    if (info.ives) w.improviser *= 1.6;
    if (info.bright != null) w.improviser *= 0.8 + 0.5 * info.bright;
    // (the calendar's Sunday leans the bench — a Victorian
    // at a wedding or a dedication, the plain organist at a funeral: info.lean,
    // factors on the three; the same die)
    if (info.lean) ["plain", "victorian", "improviser"].forEach(function (k) { if (info.lean[k] != null) w[k] *= info.lean[k]; });
    var force = info.style && STYLES[info.style] ? info.style : null;
    var tot = w.plain + w.victorian + w.improviser, x = dStyle * tot;
    var style = force || (x < w.plain ? "plain" : x < w.plain + w.victorian ? "victorian" : "improviser");
    var ros = ROSTER[style], who = ros[Math.min(ros.length - 1, Math.floor(dName * ros.length))];
    var kt = 0; STRAY_KEYS.forEach(function (s) { kt += s[2]; });
    var acc = 0, sk = STRAY_KEYS[0], kx = dKey * kt;
    for (var i = 0; i < STRAY_KEYS.length; i++) { acc += STRAY_KEYS[i][2]; if (kx < acc) { sk = STRAY_KEYS[i]; break; } }
    return {
      id: "organist", style: style, nameDs: who[0], nameEn: who[1],
      habits: {
        tempo: style === "plain" ? 0.98 + 0.06 * dTempo : style === "victorian" ? 1.02 + 0.08 * dTempo : 0.96 + 0.1 * dTempo,
        swell: style === "plain" ? 0 : 0.5 + 0.5 * dSwell,             // how much the swell moves
        fill: 0.75 + 0.5 * dFill,                                     // appetite for fills, around the style's rate
        strayKey: frac(sk[0]), strayName: sk[1],
        bitonal: style === "improviser" ? 0.14 + 0.14 * dBit : 0,     // the second key, in the prelude
        prelude: STYLES[style].prelude * (0.85 + 0.3 * dPre),
      },
      ledger: { hymns: 0, fills: 0, strange: 0 },
    };
  }

  // preludeDraw: is the prelude this organist's chorale prelude on the day's
  // first hymn? A draw (never the fixed opening), refused when the dawn
  // belongs to someone else: the trombones play the first hymn themselves,
  // a withheld tune must not be given away, and the brush arbor has no organ.
  // (In the meeting, refused too when the day's first hymn
  // is one line sung in unison — the Old Way's lined tune, a Shaker song:
  // there is no harmony for the organ to set it in — when another guest
  // wakes the morning (the steeples), and when the ward hums the morning in.
  // A Sacred Harp tune, a fuging tune or a gospel song the ward will sing
  // without the organ may still be the organist's prelude: the tune played
  // over before the class takes it up raw.)
  function preludeDraw(organist, stream, info) {
    info = info || {};
    var R = stream.fork("organist:prelude"), roll = R.rnd(0, 1);
    var odds = organist.habits.prelude, why = null;
    if (!info.hymn) why = "no first hymn yet";
    else if (info.trombones) why = "the trombones play the first hymn at dawn";
    else if (info.withheld) why = "the day's tune is withheld until the doxology";
    else if (info.organSits) why = "the organ sits out this prelude (the brush arbor)";
    else if (info.unison) why = "the first hymn is one line, sung in unison";
    else if (info.guest) why = "another guest wakes the morning (" + info.guest + ")";
    else if (info.hum) why = "the ward hums the morning in";
    return { play: !why && roll < odds, why: why || (roll < odds ? null : "the dice"), odds: r3(odds), roll: r3(roll) };
  }

  // ==========================================================================
  // THE CLOCK — the one the ward sings by, and the organ plays by
  // ==========================================================================
  function verseLinesOf(h) { return h.lines.concat(h.refrain || []); }
  function localLen(line) {
    var m = 0;
    Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { m = Math.max(m, n.beat + n.beats); }); });
    return m;
  }
  function spanBeats(line, next) {
    var len = 0;
    if (next && next.startBeat != null && line.startBeat != null) len = next.startBeat - line.startBeat;
    if (!(len > 0)) len = K.Score && K.Score.lineLength ? K.Score.lineLength(line) : localLen(line);
    return len;
  }
  // a fermata holds its note and moves everything after it.
  // ck — WHOSE CLOCK: null is the organist's own,
  // strict, a fermata held 1.7 times its length (the lab's, and the organ
  // alone's: the giving-out, an interlude). In the meeting the ward sings by
  // the CHORISTER's clock (kolob-cast.js clockOf — her tempo, a broadening
  // toward the close, her fermatas as long as she likes): ck = { rit, hold },
  // the same arithmetic to the last operation, so that the organ under a
  // line lands on every note the thirty-two sing.
  function clockOf(line, beatS, ck) {
    var holds = [], rit = ck && ck.rit ? ck.rit : 0, xm = ck && ck.hold != null ? ck.hold - 1 : 0.7;
    var len = Math.max(1, localLen(line));
    (line.fermataBeats || []).forEach(function (fb) {
      var l = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) l = Math.max(l, n.beats); }); });
      holds.push({ at: fb + l, extra: xm * l * beatS });
    });
    return function (b) {
      var t = rit ? beatS * (b + rit * b * b * b / (3 * len * len)) : b * beatS;
      holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; });
      return t;
    };
  }
  // one line, one part, from t0: every note as it is sung, ties joined, and
  // the breath taken out of the line's last note → { ev: [{t, dur, n}], end }
  function lineEvents(h, line, part, t0, beatS, next, ck) {
    var clk = clockOf(line, beatS, ck), ns = line.notes[part] || [], ev = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var st = t0 + clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);
      ev.push({ t: st, dur: dur, n: n });
    }
    return { ev: ev, end: t0 + lineDur(line, beatS, next, ck) };
  }
  function lineDur(line, beatS, next, ck) {
    return clockOf(line, beatS, ck)(spanBeats(line, next)) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
  }
  // how much of the line's last note the ward gives to its breath
  function breathOf(h, line, beatS, next, ck) {
    if (line.breathAfter === false) return 0;
    var ns = line.notes[h.melodyPart] || line.notes[Object.keys(line.notes)[0]];
    if (!ns || !ns.length) return 0;
    var last = ns[ns.length - 1], clk = clockOf(line, beatS, ck), k0 = ns.length - 1;
    while (k0 > 0 && ns[k0 - 1].tie) k0--;
    var dur = clk(last.beat + last.beats) - clk(ns[k0].beat);
    return Math.min(0.3 * beatS, 0.25 * dur);
  }

  // ==========================================================================
  // THE PLAN — plain JSON: phrases of keys, the swell, the log, the ward
  // ==========================================================================
  function newPlan(kind, organist, h) {
    return {
      kind: kind, style: organist.style, organist: { nameDs: organist.nameDs, nameEn: organist.nameEn },
      hymnId: h ? h.id : null, dur: 0, phrases: [], swell: [], events: [], ward: [], fills: [], sections: [], verseDyn: [],
      counts: { lines: 0, joins: 0, fills: 0, strange: 0, susp: 0, app: 0, pass: 0, echo: 0, link: 0, fig: 0, arabesque: 0, quote: 0, seq: 0, keys: 0, regs: 0, swells: 0 },
    };
  }
  // a phrase: one registration, one level law (texture = the voices it carries)
  function phrase(plan, t, reg, label, texture) {
    var p = { t: r3(t), reg: reg, label: label, texture: texture || 4, notes: [], report: [] };
    plan.phrases.push(p);
    return p;
  }
  var VPART = { S: 1, A: 0.8, T: 0.8, B: 0.9 };
  // a key as played (plan time t); `written` true reports it as a note of the
  // Score, and any ornament reports itself with its kind
  function key(p, t, dur, m, part, o) {
    o = o || {};
    if (dur < 0.03) return null;
    var n = { at: r3(t - p.t), dur: r3(dur), m: m, part: part, v: o.v != null ? o.v : (VPART[part] || 0.75) };
    if (o.pedal) n.pedal = true;
    if (o.pedalOnly) n.pedalOnly = true;
    if (o.orn) n.orn = o.orn;
    p.notes.push(n);
    if (o.report !== false) {
      var rp = { at: n.at, dur: n.dur, m: m, part: part, orn: o.orn || null, line: o.line, beat: o.beat, deg: o.deg };
      if (o.pedal || o.pedalOnly) rp.pedal = true;       // (the pedal's 16′ is a note too — SCORE §6, doublings reported)
      if (o.pedalOnly) rp.pedalOnly = true;              // (…and a key the feet alone hold sounds no manual pipe)
      p.report.push(rp);
    }
    return n;
  }
  function swell(plan, t, e, ramp) { plan.swell.push({ t: r3(t), e: r3(clamp(e, 0, 1)), ramp: ramp == null ? 0.8 : ramp }); plan.counts.swells++; }
  function say(plan, organist, t, action, extra) {
    var e = { t: r3(t), type: "cast", memberId: "organist", nameDs: organist.nameDs, action: action };
    if (extra) for (var k in extra) e[k] = extra[k];
    plan.events.push(e);
  }
  function draws(plan, organist, t, reg) {
    if (reg === plan._reg) return;
    plan._reg = reg; plan.counts.regs++;
    say(plan, organist, t, PULLS[reg] || "changes the stops", { registration: reg });
  }
  function section(plan, t, end, what) { plan.sections.push({ t: r3(t), end: r3(end), what: what }); }
  function finish(plan, end) {
    var last = end;
    plan.phrases.forEach(function (p) { p.notes.forEach(function (n) { last = Math.max(last, p.t + n.at + n.dur); }); });
    plan.dur = r3(last + 0.6);                      // the pipes' own release, and the room's
    delete plan._reg;
    plan.phrases.sort(function (a, b) { return a.t - b.t; });
    plan.swell.sort(function (a, b) { return a.t - b.t; });
    plan.events.sort(function (a, b) { return a.t - b.t; });
    // in time order (a stable sort: at one moment, the order they were planned)
    plan.sections.sort(function (a, b) { return a.t - b.t; });
    plan.phrases.forEach(function (p) { plan.counts.keys += p.notes.length; });
    return plan;
  }

  // ==========================================================================
  // THE TOUCH — one line of the Score, as this organist's hands take it
  // ==========================================================================
  // → [{t, dur, m, part, n, pedal}] (plan time). Repeated notes are held or
  // struck again after a lift, as the style has it; every other join is
  // legato (the next key goes down as this one comes up). ck: whose clock
  // (clockOf) — the chorister's, under the ward in the meeting.
  function handsOn(h, line, next, t0, beatS, touch, ck) {
    var parts = Object.keys(line.notes).filter(function (p) { return line.notes[p] && line.notes[p].length; });
    var sat = parts.length >= 3, out = [];
    parts.forEach(function (p) {
      var ev = lineEvents(h, line, p, t0, beatS, next, ck).ev, prev = null;
      ev.forEach(function (e) {
        var x = { t: e.t, dur: e.dur, m: mz(h.keyMonzo, e.n.monzo), part: p, n: e.n, pedal: sat && p === "B", written: [e] };
        if (prev && eq(prev.m, x.m) && Math.abs(prev.t + prev.dur - x.t) < 0.02) {
          if ((touch.repeat[p] || "strike") === "tie") { prev.dur = x.t + x.dur - prev.t; prev.written.push(e); return; }
          prev.dur = Math.max(0.05, prev.dur - touch.gap);        // the lift before the key speaks again
        }
        out.push(x); prev = x;
      });
    });
    // a tune given alone (a unison dialect, an Earth tune's melody): the organ
    // doubles it an octave under, the lower line in the pedal
    if (!sat && parts.length === 1) {
      out.slice().forEach(function (x) { out.push({ t: x.t, dur: x.dur, m: oct(x.m, -1), part: "B", n: x.n, pedal: true, written: [] }); });
    }
    return out;
  }
  function withPedal(r, ped) { if (ped) r.pedal = true; return r; }
  // the tune on a stop of its own: the melody part — the soprano, or a
  // Sacred Harp or psalmody tune's tenor (in the meeting a chorale prelude
  // may be on one) — and the other parts under it
  function tuneOf(h) { return [h.melodyPart || "S"]; }
  function underTune(h) { var mp = h.melodyPart || "S"; return ["S", "A", "T", "B"].filter(function (p) { return p !== mp; }); }
  // lay hands-on keys into a phrase (the written notes reported as the Score's)
  function lay(p, keys, o) {
    o = o || {};
    keys.forEach(function (x) {
      var v = (VPART[x.part] || 0.8) * (o.v || 1);
      var parts = o.only ? o.only.indexOf(x.part) >= 0 : true;
      if (!parts) return;
      var k = key(p, x.t, x.dur, x.m, x.part, { v: v, pedal: x.pedal && !o.noPedal, orn: x.orn, report: false });
      if (!k) return;
      // the report: each WRITTEN note, at its written time and length (a
      // held note is still two notes on the page; a note the organist lets
      // fall late, under a suspension, was still written on the beat —
      // SCORE §9.2), and each ornament as what it is
      var ped = !!(x.pedal && !o.noPedal);
      if (x.orn && !(x.written && x.written.length)) p.report.push(withPedal({ at: r3(x.t - p.t), dur: r3(x.dur), m: x.m, part: x.part, orn: x.orn, line: o.line }, ped));
      else (x.written || []).forEach(function (e) {
        p.report.push(withPedal({ at: r3(e.t - p.t), dur: r3(e.dur), m: x.m, part: x.part, orn: null, line: o.line, beat: e.n.beat, deg: e.n.deg }, ped));
      });
    });
  }

  // ==========================================================================
  // THE VICTORIAN'S HANDS — suspensions, appoggiaturas, passing notes
  // ==========================================================================
  // the note of part p that begins at t (±5 ms), and the one sounding just before it
  function at(keys, p, t) { for (var i = 0; i < keys.length; i++) if (keys[i].part === p && Math.abs(keys[i].t - t) < 0.005) return keys[i]; return null; }
  function before(keys, p, t) {
    var best = null;
    keys.forEach(function (x) { if (x.part === p && x.t < t - 0.005 && Math.abs(x.t + x.dur - t) < 0.08 && (!best || x.t > best.t)) best = x; });
    return best;
  }
  // a cadence decorated: a voice that steps DOWN into the cadence chord is
  // held over it and resolves late (4–3, 9–8, 7–6 — whatever the chord makes
  // of it); failing that, an inner voice leans on the note above (an
  // appoggiatura). The tune (S) is never touched: it must stay the hymn.
  function cadenceSusp(h, line, keys, t0, beatS, R, scale, plan) {
    var cb = line.cadence && line.cadence.beat != null ? line.cadence.beat : null;
    if (cb == null || cb <= 0) return false;
    // (the tune is never touched: a tenor tune's tenor neither)
    var tc = t0 + clockOf(line, beatS)(cb), order = (R.chance(0.6) ? ["A", "T"] : ["T", "A"]).filter(function (q) { return q !== h.melodyPart; });
    for (var i = 0; i < order.length; i++) {
      var y = at(keys, order[i], tc), x = y && before(keys, order[i], tc);
      if (!y || !x) continue;
      var drop = cents(x.m) - cents(y.m);
      if (drop > 70 && drop < 260 && y.dur > 0.35 * beatS) {
        var hold = Math.min(0.5 * y.dur, beatS);
        x.dur = tc + hold - x.t; x.orn = "susp";
        y.t = tc + hold; y.dur -= hold;
        plan.counts.susp++;
        return true;
      }
    }
    var p2 = order[0], y2 = at(keys, p2, tc);
    if (y2 && y2.dur > 0.7 * beatS) {
      var hold2 = Math.min(0.45 * y2.dur, 0.8 * beatS), up = near(stepOf(scale, y2.m, 1), cents(y2.m) + 180);
      keys.push({ t: tc, dur: hold2, m: up, part: p2, orn: "app", pedal: false, written: [] });
      y2.t += hold2; y2.dur -= hold2;
      plan.counts.app++;
      return true;
    }
    return false;
  }
  // passing notes: an inner voice or the bass that leaps a third walks it,
  // the passing note on the second half of the first (at most `cap` a line)
  function passing(keys, beatS, R, rate, scale, plan, cap, tune) {
    var n = 0;
    ["A", "T", "B"].filter(function (q) { return q !== tune; }).forEach(function (p) {
      var ks = keys.filter(function (x) { return x.part === p && !x.orn; }).sort(function (a, b) { return a.t - b.t; });
      for (var i = 0; i + 1 < ks.length && n < cap; i++) {
        var x = ks[i], y = ks[i + 1], d = cents(y.m) - cents(x.m);
        var roll = R.rnd(0, 1);                                 // DICE: thrown for every candidate, used or not — deliberate; the shared stream, so a draw left out would move every draw after it
        if (Math.abs(x.t + x.dur - y.t) > 0.03 || x.dur < 0.9 * beatS || Math.abs(d) < 250 || Math.abs(d) > 450) continue;
        if (roll >= rate) continue;
        var mid = stepOf(scale, x.m, d > 0 ? 1 : -1), mc = cents(mid);
        if ((mc - cents(x.m)) * (mc - cents(y.m)) >= 0) continue;   // not between them
        var half = x.dur / 2;
        x.dur = half;
        keys.push({ t: x.t + half, dur: half, m: mid, part: p, orn: "pass", pedal: x.pedal, written: [] });
        plan.counts.pass++; n++;
      }
    });
  }

  // ==========================================================================
  // THE IMPROVISER'S HANDS — running figures over a harmony
  // ==========================================================================
  // the classes of the chord the hymn stands on at beat b of a line
  function chordClassesAt(h, line, b) {
    var out = [];
    Object.keys(line.notes).forEach(function (p) {
      line.notes[p].forEach(function (n) {
        if (n.beat <= b + 1e-6 && n.beat + n.beats > b + 1e-6 && !n.nct) {
          var c = cls(mz(h.keyMonzo, n.monzo));
          if (!out.some(function (o) { return eq(o, c); })) out.push(c);
        }
      });
    });
    if (!out.length) out.push(cls(mz(h.keyMonzo, [0, 0, 0, 0])));
    return out;
  }
  // chord tones laid out through a range (cents from the keynote), low to high
  function ladder(classes, lo, hi) {
    var out = [];
    classes.forEach(function (c) {
      for (var k = -4; k <= 4; k++) { var m = oct(c, k), x = cents(m); if (x >= lo && x <= hi) out.push({ m: m, c: x }); }
    });
    return out.sort(function (a, b) { return a.c - b.c; });
  }
  // FIGURES: a steady run of `sub`-second notes from t to t1 on phrase p,
  // following chordAt(τ) → classes; cells of 3–4 notes drawn from a small
  // book (arpeggio up or down, a turn, a scale, Ives's wandering cell);
  // continuity from the last note; `xpose` moves the manuals to another key.
  var CELLS = [["arp", 3], ["turn", 2], ["scale", 2], ["broken", 1.5], ["wander", 1.2]];
  function figures(plan, p, t, t1, sub, chordAt, scale, R, o) {
    o = o || {};
    var lo = o.lo != null ? o.lo : 0, hi = o.hi != null ? o.hi : 1650, xp = o.xpose || null;
    var cur = o.from != null ? o.from : (lo + hi) / 2, dir = o.dir || 1, n = 0, cellLeft = 0, kind = "arp", wand = null;
    var sc = xp ? scale.map(function (s) { return cls(mz(s, xp)); }) : scale;
    for (var tt = t; tt < t1 - sub * 0.5; tt += sub) {
      var ch = chordAt(tt);
      if (xp) ch = ch.map(function (c) { return cls(mz(c, xp)); });
      var lad = ladder(ch, lo, hi), m = null;
      if (cellLeft <= 0) {
        kind = R.pickW(CELLS); cellLeft = kind === "turn" ? 4 : R.pick([3, 4]);
        if (R.chance(0.3)) dir = -dir;
        if (kind !== "wander") wand = null;             // a wandering cell walks on from where it was
      }
      var roll = R.rnd(0, 1);
      if (kind === "arp" || kind === "broken") {
        var next = null;
        for (var i = 0; i < lad.length; i++) {
          if (dir > 0 && lad[i].c > cur + 40) { next = lad[i]; break; }
          if (dir < 0 && lad[lad.length - 1 - i].c < cur - 40) { next = lad[lad.length - 1 - i]; break; }
        }
        if (kind === "broken" && roll < 0.5 && next) {        // leap past one, fall back (the Alberti turn)
          var j = lad.indexOf(next) + dir; if (j >= 0 && j < lad.length) next = lad[j];
        }
        if (!next) { dir = -dir; next = lad.length ? lad[dir > 0 ? 0 : lad.length - 1] : null; }
        m = next ? next.m : null;
      } else if (kind === "turn") {
        var base = lad.length ? lad.reduce(function (a, b) { return Math.abs(b.c - cur) < Math.abs(a.c - cur) ? b : a; }) : null;
        var ph = cellLeft % 4;
        if (base) m = ph === 3 ? stepOf(sc, base.m, 1) : ph === 1 ? stepOf(sc, base.m, -1) : base.m;
      } else if (kind === "scale") {
        var here = near(sc[0], cur), best = null;
        sc.forEach(function (s) { var q = near(s, cur); if (Math.abs(cents(q) - cur) < Math.abs(cents(here) - cur)) here = q; });
        best = stepOf(sc, here, dir);
        if (cents(best) > hi || cents(best) < lo) { dir = -dir; best = stepOf(sc, here, dir); }
        m = best;
      } else {                                                    // wander: a 3-note cell, moved on by a step each time
        if (!wand) {
          var b0 = lad.length ? lad[Math.floor(roll * lad.length)] : null;
          wand = b0 ? [b0.m, stepOf(sc, b0.m, dir), stepOf(sc, stepOf(sc, b0.m, dir), dir)] : null;
        }
        if (wand) { m = wand[(4 - cellLeft + 3) % 3]; if (cellLeft === 1) wand = wand.map(function (q) { return stepOf(sc, q, -dir); }); }
      }
      cellLeft--;
      if (!m) continue;
      var c = cents(m);
      if (c > hi + 50) { m = oct(m, -1); dir = -1; } else if (c < lo - 50) { m = oct(m, 1); dir = 1; }
      cur = cents(m);
      key(p, tt, sub * (o.legato || 0.94), m, o.part || "fig", { v: o.v || 0.62, orn: "fig" });
      n++;
    }
    plan.counts.fig += n;
    return cur;
  }

  // ==========================================================================
  // CHORDS OF ITS OWN — for modulations, interludes and the strange fill
  // ==========================================================================
  var QUAL = {
    maj: ["1/1", "5/4", "3/2"], min: ["1/1", "6/5", "3/2"], dom7: ["1/1", "5/4", "3/2", "16/9"],
    dim7: ["1/1", "6/5", "36/25", "216/125"], add9: ["1/1", "5/4", "3/2", "9/8"], add6: ["1/1", "5/4", "3/2", "5/3"],
    open5: ["1/1", "3/2"],
  };
  // the key's own chords, by function, with roots that make them just (ii's
  // re at 10/9, as the composer tunes it)
  function keyChords(keyMonzo, mode) {
    var minor = !!MINOR[mode], R0 = function (f) { return mz(keyMonzo, frac(f)); };
    var list = minor ? [
      ["i", R0("1/1"), "min"], ["iv", R0("4/3"), mode === "dorian" ? "maj" : "min"], ["VI", R0("8/5"), "maj"],
      ["III", R0("6/5"), "maj"], ["ii", R0("10/9"), "min"], ["V", R0("3/2"), "maj"], ["V7", R0("3/2"), "dom7"], ["VII", R0("16/9"), "maj"],
    ] : [
      ["I", R0("1/1"), "maj"], ["ii", R0("10/9"), "min"], ["iii", R0("5/4"), "min"], ["IV", R0("4/3"), "maj"],
      ["V", R0("3/2"), "maj"], ["V7", R0("3/2"), "dom7"], ["vi", R0("5/3"), "min"],
    ];
    if (mode === "dorian") list[1][0] = "IV";
    return list.map(function (c) { return { roman: c[0], root: c[1], q: c[2] }; });
  }
  function tonesOf(ch) { return QUAL[ch.q].map(function (f) { return cls(mz(ch.root, frac(f))); }); }
  var RANGE = { B: [-2500, -400], T: [-1400, 250], A: [-750, 800], S: [-100, 1500] };
  // voice a chord in four parts near `prev` ({S,A,T,B} monzos, or null):
  // the root in the bass (or `bass` if given), every class sounded, no
  // crossing, no gap over an octave above the tenor, common tones kept
  // (o.keep: how much a kept tone is worth — a pivot holds its own)
  function voiceChord(ch, prev, o) {
    o = o || {};
    var tones = tonesOf(ch), root = cls(o.bass || ch.root);
    var bc = prev ? cents(prev.B) : -1500, B = near(root, bc);
    if (cents(B) > RANGE.B[1]) B = oct(B, -1); if (cents(B) < RANGE.B[0]) B = oct(B, 1);
    function opts(part) {
      var r = RANGE[part], out = [];
      tones.forEach(function (c) { for (var k = -4; k <= 4; k++) { var m = oct(c, k), x = cents(m); if (x >= r[0] && x <= r[1]) out.push(m); } });
      return out;
    }
    var OS = opts("S"), OA = opts("A"), OT = opts("T"), best = null, bestCost = 1e9;
    var tgt = prev ? { S: cents(prev.S), A: cents(prev.A), T: cents(prev.T) } : { S: 700, A: 300, T: -200 };
    OS.forEach(function (s) {
      OA.forEach(function (a) {
        OT.forEach(function (tn) {
          var cs = cents(s), ca = cents(a), ct = cents(tn), cb = cents(B);
          if (!(cs > ca + 20 && ca > ct + 20 && ct > cb + 20)) return;
          if (cs - ca > 1220 || ca - ct > 1220) return;
          // every tone sounds — except, in a four-note chord, the fifth may
          // go (never the seventh, never the added note: they are the point)
          var have = [B, tn, a, s].map(cls), missing = 0, lostFifth = false;
          tones.forEach(function (c, ti) { if (!have.some(function (hc) { return eq(hc, c); })) { missing++; if (ti === 2) lostFifth = true; } });
          if (missing > (tones.length === 4 && lostFifth ? 1 : 0)) return;
          var cost = (Math.abs(cs - tgt.S) + Math.abs(ca - tgt.A) + Math.abs(ct - tgt.T)) / 100 + missing * 3;
          if (prev) [["S", s], ["A", a], ["T", tn]].forEach(function (q) { if (eq(prev[q[0]], q[1])) cost -= o.keep || 1.5; });
          if (tones.length >= 3 && eq(cls(s), tones[1]) && eq(cls(B), tones[1])) cost += 2;     // no doubled third on the outside
          if (cost < bestCost) { bestCost = cost; best = { S: s, A: a, T: tn, B: B }; }
        });
      });
    });
    return best || { S: near(tones[0], 700), A: near(tones[tones.length > 2 ? 2 : 0], 300), T: near(tones[1] || tones[0], -200), B: B };
  }
  // chords → keys on a phrase: a key stays down while its pitch goes on —
  // in the same part, or handed to another (the finger does not care which
  // voice the page gives a held common tone to, so a pivot's
  // common tone is held, not struck again). The bass is the pedal's too: a
  // manual key the bass takes over gets its pedal note beside it, and the
  // bass's own key (pedal and all) is never handed up to a manual voice.
  function layChords(p, list, t, prev, o) {
    o = o || {};
    var parts = ["S", "A", "T", "B"].filter(function (q) { return !(o.only && o.only.indexOf(q) < 0); }), open = {}, into = o.into || [];
    list.forEach(function (c) {
      var v = c.voicing, next = {}, taken = [];
      function keep(q, x) { x.dur += c.dur; if (q === "B" && x.mate) x.mate.dur += c.dur; next[q] = x; taken.push(x); }
      if (c.tie !== false) {
        parts.forEach(function (q) { var x = open[q]; if (x && eq(x.m, v[q])) keep(q, x); });
        parts.forEach(function (q) {
          if (next[q]) return;
          parts.some(function (r) {
            var x = open[r];
            if (!x || r === "B" || taken.indexOf(x) >= 0 || !eq(x.m, v[q])) return false;
            if (q === "B" && !o.noPedal) { x.mate = { t: t, dur: 0, m: v[q], part: "B", pedalOnly: true }; into.push(x.mate); }
            keep(q, x);
            return true;
          });
        });
      }
      parts.forEach(function (q) {
        if (next[q]) return;
        next[q] = { t: t, dur: c.dur, m: v[q], part: q };
        into.push(next[q]);
      });
      open = next;
      t += c.dur;
    });
    into.forEach(function (x) {
      key(p, x.t, x.dur * (o.legato || 0.98), x.m, x.part, { v: (VPART[x.part] || 0.8) * (o.v || 1), pedal: (x.part === "B" || x.pedalOnly) && !o.noPedal, pedalOnly: x.pedalOnly, orn: o.orn });
    });
    return t;
  }
  // the chord the hymn ends on, as the organ last held it
  function finalVoicing(h) {
    var L = h.amen || h.lines[h.lines.length - 1], v = {};
    ["S", "A", "T", "B"].forEach(function (p) {
      var ns = L.notes[p] || L.notes[h.melodyPart];
      if (ns && ns.length) v[p] = mz(h.keyMonzo, ns[ns.length - 1].monzo);
    });
    if (!v.B) v.B = oct(v.S || h.keyMonzo, -2);
    ["S", "A", "T"].forEach(function (p) { if (!v[p]) v[p] = v.S || oct(v.B, 2); });
    return v;
  }

  // ==========================================================================
  // THE PRELUDE — the day's first hymn, before anyone sings it (§15 item 2)
  // ==========================================================================
  // How long the chosen lines last at a beat, with a lift between lines.
  function span(h, lines, idx, beatS, lift, rit) {
    var t = 0;
    idx.forEach(function (i, k) {
      var last = k === idx.length - 1;
      t += lineDur(lines[i], beatS * (last && rit ? rit : 1), lines[i + 1]) + (last ? 0 : lift * beatS);
    });
    return t;
  }
  // THE FIT. A prelude lasts lo…hi seconds (30–50: the plan's window). Its
  // shapes are tried in the organist's order of preference — the whole tune
  // once; the tune twice (the plain organist's way with a short hymn); the
  // tune and an echo of its last line; or, for a long one, its head and its
  // home (the first, second and last lines; the first and last) — and the
  // first shape that lands in the window at a beat the organist would take
  // (never quicker than the ward sings it, never a dirge) is played. Every
  // part of a prelude is counted in beats, so its length is the beat times a
  // number, and the beat is solved for the drawn length.
  function lastLine(idx) { return idx[idx.length - 1]; }
  function shapeBeats(h, lines, shape, lift, rit, extra) {
    var s1 = span(h, lines, shape.idx, 1, lift, rit), b = s1 + extra;
    if (shape.echo) b += lift + lineDur(lines[lastLine(shape.idx)], rit, lines[lastLine(shape.idx) + 1]);
    if (shape.twice) b += lift + s1;
    return b;
  }
  function fitPrelude(h, lines, target, lo, hi, bmin, bmax, lift, rit, extra, order) {
    var n = lines.length, all = [];
    for (var i = 0; i < n; i++) all.push(i);
    var shapes = {
      once: { idx: all }, echo: { idx: all, echo: true }, twice: { idx: all, twice: true },
      head4: { idx: n > 4 ? [0, 1, n - 2, n - 1] : all }, head3: { idx: n > 3 ? [0, 1, n - 1] : all }, head2: { idx: n > 2 ? [0, n - 1] : all },
    };
    var best = null, bestMiss = 1e9;
    for (var k = 0; k < order.length; k++) {
      var sh = shapes[order[k]], B = shapeBeats(h, lines, sh, lift, rit, extra);
      var bs = clamp(target / B, bmin, bmax), D = bs * B;
      var miss = D < lo ? lo - D : D > hi ? D - hi : 0;
      if (miss === 0) return { shape: sh, name: order[k], beatS: bs, dur: D };
      if (miss < bestMiss) { bestMiss = miss; best = { shape: sh, name: order[k], beatS: bs, dur: D }; }
    }
    return best;
  }
  // the prelude's lines laid end to end → [{i, line, next, t, bs, again}]
  function layLines(h, lines, idx, t, beatS, lift, rit, again) {
    var out = [];
    idx.forEach(function (i, k) {
      var last = k === idx.length - 1, bs = beatS * (last && rit ? rit : 1);
      out.push({ i: i, line: lines[i], next: lines[i + 1], t: t, bs: bs, again: !!again });
      t += lineDur(lines[i], bs, lines[i + 1]) + (last ? 0 : lift * beatS);
    });
    return { lines: out, end: t };
  }

  function prelude(organist, h, stream, opts) {
    opts = opts || {};
    var plan = newPlan("prelude", organist, h), R = stream.fork("prelude:" + organist.style);
    var lines = verseLinesOf(h), scale = scaleOf(h.mode, h.keyMonzo), style = organist.style;
    var lo = opts.lo || 30, hi = opts.hi || 50;
    if (style === "improviser") return preludeImproviser(organist, h, R, plan, lines, scale, lo, hi);
    // ---- the plain organist, and the Victorian: the hymn in four parts ----
    var vic = style === "victorian";
    var target = R.rnd(lo + 3, hi - 4), lift = vic ? 0.55 : 0.3;
    var manner = vic ? R.pickW([["vox solo", 0.4], ["swell voluntary", 0.38], ["trumpet tune", 0.22]])
                     : R.pickW([["soft flutes", 0.45], ["quiet flute", 0.3], ["flutes 8 & 4", 0.25]]);
    var intro = vic && R.chance(0.55), introB = R.rnd(2.2, 3.2), rit = vic ? R.rnd(1.15, 1.35) : 1.08;
    var dEcho = R.rnd(0, 1), sw0 = R.rnd(0, 1), holdB = vic ? 1.6 : 0.7;
    var tempo = organist.habits.tempo;
    var fit = fitPrelude(h, lines, target, lo, hi,
      h.beatS * (vic ? 1.08 : 1.0) * tempo, h.beatS * (vic ? 1.5 : 1.32) * tempo, lift, rit,
      (intro ? introB + 0.35 : 0) + holdB,
      vic ? ["once", "echo", "head4", "head3", "head2"] : ["once", "twice", "echo", "head4", "head3", "head2"]);
    var beatS = fit.beatS, idx = fit.shape.idx;
    var t0 = 0;
    if (intro) {
      // the Victorian's intonation: the first chord, held, the swell opening on it
      var first = handsOn(h, lines[idx[0]], lines[idx[0] + 1], 0, beatS, STYLES.victorian.touch).filter(function (x) { return x.t < 0.01; });
      var pi = phrase(plan, 0, manner === "swell voluntary" ? "hymn principal" : "flutes, trembling", "the intonation", 4);
      draws(plan, organist, 0, pi.reg);
      var introS = introB * beatS;
      first.forEach(function (x) { key(pi, 0, introS, x.m, x.part, { v: VPART[x.part], pedal: x.pedal, orn: "intro" }); });
      swell(plan, 0, 0.18, 0.05); swell(plan, 0.1, 0.62, introS * 0.8);
      section(plan, 0, introS, "the first chord, the swell opening on it");
      t0 = introS + 0.35 * beatS;
    }
    var laid = layLines(h, lines, idx, t0, beatS, lift, fit.shape.twice ? 1 : rit), end = laid.end;
    if (fit.shape.twice) {
      // the plain organist plays a short hymn through twice, the second time softer
      var again = layLines(h, lines, idx, end + lift * beatS, beatS, lift, rit, true);
      laid.lines = laid.lines.concat(again.lines); end = again.end;
    }
    var solo = manner === "vox solo" ? "vox solo" : manner === "trumpet tune" ? "trumpet solo" : null;
    var under = manner === "vox solo" ? "flutes, trembling" : manner === "trumpet tune" ? "soft flutes" : manner === "swell voluntary" ? "hymn principal" : manner;
    var peakLine = -1; laid.lines.forEach(function (L, k) { if (L.line.peak && !L.again) peakLine = k; });
    if (peakLine < 0) peakLine = Math.max(0, laid.lines.length - 2);
    var base = vic ? (manner === "swell voluntary" ? 0.32 : 0.5) : 0.6 + 0.1 * sw0;
    if (!intro) swell(plan, 0, base, 0.05);
    laid.lines.forEach(function (L, k) {
      var keys = handsOn(h, L.line, L.next, L.t, L.bs, STYLES[vic ? "victorian" : "plain"].touch);
      if (vic) {
        var die = R.fork("line:" + L.i);
        if (die.chance(0.85)) cadenceSusp(h, L.line, keys, L.t, L.bs, die, scale, plan);
        passing(keys, L.bs, die, 0.4, scale, plan, 2, h.melodyPart);
        // the Victorian breathes the swell with the line: open toward the
        // high note, back at the close
        var dist = Math.abs(k - peakLine), top = manner === "swell voluntary" ? 0.95 : 0.78;
        var e = base + (top - base) * (k === peakLine ? 1 : k < peakLine ? 0.45 + 0.4 * (k / Math.max(1, peakLine)) : 0.4 / dist);
        swell(plan, L.t + 0.2, e * (0.85 + 0.15 * organist.habits.swell), lineDur(L.line, L.bs, L.next) * 0.5);
      } else if (L.again && k === laid.lines.length - idx.length) {
        swell(plan, L.t - 0.2, Math.max(0.3, base - 0.14), 1.2);  // the second time, the shutters a little closed
      }
      var label = "line " + (L.i + 1) + " of the hymn" + (L.again ? ", again" : "");
      var reg1 = L.again && !vic ? "quiet flute" : under;
      if (solo) {
        var ps = phrase(plan, L.t, solo, label + ", the tune on its own stop", 1.6), pu = phrase(plan, L.t, under, label, 3);
        draws(plan, organist, L.t, solo);
        lay(ps, keys, { only: tuneOf(h), line: L.i, v: 1.05 }); lay(pu, keys, { only: underTune(h), line: L.i });
      } else {
        var pa = phrase(plan, L.t, reg1, label, 4);
        draws(plan, organist, L.t, reg1);
        lay(pa, keys, { line: L.i });
      }
      plan.counts.lines++;
      section(plan, L.t, L.t + lineDur(L.line, L.bs, L.next), label + (solo ? " — the tune on the " + (solo === "vox solo" ? "vox humana" : "trumpet") : ""));
    });
    // an echo: the last line again, softer — the plain organist on one flute,
    // the Victorian on the echo flute with the tremulant
    if (fit.shape.echo) {
      var li = lastLine(idx), L2 = lines[li], bs2 = beatS * rit, te = end + lift * beatS;
      var echoReg = vic ? "echo flute" : "quiet flute";
      var pe = phrase(plan, te, echoReg, "the last line again, an echo", 4);
      draws(plan, organist, te, echoReg);
      var ek = handsOn(h, L2, lines[li + 1], te, bs2, STYLES[vic ? "victorian" : "plain"].touch);
      if (vic) cadenceSusp(h, L2, ek, te, bs2, R.fork("echo"), scale, plan);
      lay(pe, ek, { line: li, v: 0.85 });
      swell(plan, te, Math.max(0.2, base - 0.15 - 0.1 * dEcho), 1.2);
      plan.counts.echo++;
      section(plan, te, te + lineDur(L2, bs2, lines[li + 1]), "the last line again, softly (an echo)");
      end = te + lineDur(L2, bs2, lines[li + 1]);
    }
    // the close: the last chord held (the plain organist a little; the
    // Victorian long, the swell closing on it)
    extendLast(plan, holdB * beatS);
    if (vic) swell(plan, end - 1.2 * beatS, 0.2, 2.2 * beatS);
    say(plan, organist, 0, "plays the day's first hymn as a prelude", { manner: manner });
    plan.liftDb = PRELUDE_LIFT[style];
    plan.manner = manner + (fit.name === "once" ? "" : " (" + ({ echo: "with an echo", twice: "twice through", head4: "four lines", head3: "three lines", head2: "first and last lines" })[fit.name] + ")");
    plan.beatS = r3(beatS); plan.lineIdx = idx;
    return finish(plan, end + holdB * beatS);
  }

  // hold the last chord longer: every key that ends at the plan's last moment
  function extendLast(plan, by) {
    var endT = 0;
    plan.phrases.forEach(function (p) { p.notes.forEach(function (n) { endT = Math.max(endT, p.t + n.at + n.dur); }); });
    plan.phrases.forEach(function (p) {
      p.notes.forEach(function (n) { if (Math.abs(p.t + n.at + n.dur - endT) < 0.35) n.dur = r3(n.dur + by); });
      p.report.forEach(function (n) { if (Math.abs(p.t + n.at + n.dur - endT) < 0.35) n.dur = r3(n.dur + by); });
    });
  }

  // The improviser's prelude: the tune in the pedals, in long notes (a cantus
  // firmus in augmentation), under flutes running figures from the hymn's own
  // chords; figures alone first, a bar of them between the lines, and an
  // open chord at the end. Rarely, the manuals run in a second key the whole
  // time the tune walks home in its own (Ives's Adeste Fideles).
  function preludeImproviser(organist, h, R, plan, lines, scale, lo, hi) {
    var pb = h.beatS * R.rnd(0.82, 1.0) * organist.habits.tempo, target = R.rnd(lo + 4, hi - 4);
    var augDraw = R.rnd(0, 1), subK = R.pickW([[2, 0.45], [3, 0.35], [4, 0.2]]);
    var bit = R.rnd(0, 1) < organist.habits.bitonal, bitWhere = R.pickW([["middle", 0.6], ["all", 0.4]]);
    var introB = R.rint(2, 3), rit = R.rnd(0, 1), endKind = R.pickW([["add9", 1], ["add6", 1], ["open5", 0.8]]);
    var codaB = R.rnd(1.5, 2.5), holdB = R.rnd(2.6, 3.6), xk = organist.habits.strayKey;
    // the fit: the tune in augmentation (each of its beats 1.3–2.3 of the
    // prelude's), its lines chosen, and the augmentation solved so the whole
    // lands on the drawn length — the whole of a tune that fits; the head
    // and home of a long one (four lines, three, two); a short one slower
    var n = lines.length, all = [], idx = null, aug = 1.6;
    for (var i = 0; i < n; i++) all.push(i);
    var fixedB = introB + codaB + holdB;
    var cands = [all, n > 4 ? [0, 1, n - 2, n - 1] : null, n > 3 ? [0, 1, n - 1] : null, n > 2 ? [0, n - 1] : null].filter(function (c) { return c; });
    function beatsOf(c) { var lb = 0; c.forEach(function (j) { lb += spanBeats(lines[j], lines[j + 1]); }); return lb; }
    for (var ci = 0; ci < cands.length && !idx; ci++) {
      var need = (target / pb - fixedB - (cands[ci].length - 1)) / beatsOf(cands[ci]);
      if (need > 2.3) { idx = cands[ci]; aug = 2.3; }              // short even at the slowest
      else if (need >= 1.3) { idx = cands[ci]; aug = need; }
    }
    if (!idx) {                                                       // long even in two lines: a quicker beat
      idx = cands[cands.length - 1]; aug = 1.3;
      pb = Math.max(h.beatS * 0.7, target / (fixedB + idx.length - 1 + aug * beatsOf(idx)));
    }
    var est = pb * (fixedB + (idx.length - 1) + aug * beatsOf(idx));
    if (est < lo + 1) pb *= Math.min(1.5, (lo + 2) / est);        // a short tune: a broader beat
    aug = aug * (0.97 + 0.06 * augDraw);
    var sub = pb / subK;
    // where the tune sits: its mean in the pedal compass (8′ pitch around the
    // octave under the keynote; the bourdon sounds another octave down)
    var mel = [];
    idx.forEach(function (j) { (lines[j].notes[h.melodyPart] || []).forEach(function (x) { mel.push(cents(mz(h.keyMonzo, x.monzo))); }); });
    var mean = mel.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, mel.length);
    var shift = Math.round((-1000 - mean) / 1200);
    // the figures' harmony: the hymn's chord at the tune's beat (the cantus
    // time maps back to the hymn's beat), or the first chord before it enters
    var map = [];                                    // [{t0, t1, line, b0}]
    var t = introB * pb, pT = phrase(plan, t, "pedal tune", "the tune in the pedals", 1.5);
    idx.forEach(function (j, k) {
      var L = lines[j], lb = spanBeats(L, lines[j + 1]), ns = L.notes[h.melodyPart] || [];
      map.push({ t0: t, t1: t + lb * aug * pb, line: L });
      for (var q = 0; q < ns.length; q++) {
        var x = ns[q], b1 = x.beat + x.beats;
        while (ns[q].tie && q + 1 < ns.length) { q++; b1 = ns[q].beat + ns[q].beats; }
        var st = t + x.beat * aug * pb, du = (b1 - x.beat) * aug * pb;
        key(pT, st, du - 0.06, oct(mz(h.keyMonzo, x.monzo), shift), "B", { v: 1, pedal: true, orn: null, line: j, beat: x.beat, deg: x.deg });
      }
      plan.counts.lines++;
      section(plan, t, t + lb * aug * pb, "line " + (j + 1) + " in the pedals, long notes" + (bit && (bitWhere === "all" || k === 1) ? "; the flutes in another key" : ""));
      t += lb * aug * pb + (k < idx.length - 1 ? 1 * pb : 0);
    });
    var tuneEnd = t;
    function chordAt(tt) {
      for (var z = 0; z < map.length; z++) {
        var M = map[z];
        if (tt < M.t1 + (z < map.length - 1 ? 1 * pb : 99)) {
          var b = Math.max(0, (tt - M.t0) / (aug * pb));
          return chordClassesAt(h, M.line, Math.min(b, spanBeats(M.line) - 0.01));
        }
      }
      return chordClassesAt(h, map[map.length - 1].line, 0);
    }
    // the figures: before, through and after the tune; a second key in the
    // middle line (or throughout) when the dice say so
    var fReg = R.pickW([["figures", 0.6], ["sixteen & four", 0.25], ["flutes 8 & 4", 0.15]]);
    draws(plan, organist, 0, fReg);
    var pF = phrase(plan, 0, fReg, "running figures", 2.2), cur = 700;
    section(plan, 0, introB * pb, "running figures on the flutes, alone");
    var bounds = [0].concat(map.map(function (M) { return M.t0; })).concat([tuneEnd]);
    var codaEnd = tuneEnd + codaB * pb;
    for (var s = 0; s + 1 < bounds.length; s++) {
      var segBit = bit && (bitWhere === "all" ? s > 0 : s === 2 && bounds.length > 3);
      cur = figures(plan, pF, bounds[s], bounds[s + 1], sub, chordAt, scale, R.fork("fig:" + s), { from: cur, xpose: segBit ? xk : null, lo: 150, hi: 1650 });
      if (segBit && !plan._saidBit) { plan._saidBit = true; say(plan, organist, bounds[s], "lets the flutes run in another key (" + organist.habits.strayName + ")"); }
    }
    // the coda: the figures slow (twice as long), then the open chord
    figures(plan, pF, tuneEnd, codaEnd, sub * 2, chordAt, scale, R.fork("fig:coda"), { from: cur, lo: 150, hi: 1400, v: 0.52 });
    var fin = { root: mz(h.keyMonzo, [0, 0, 0, 0]), q: MINOR[h.mode] && endKind !== "open5" ? "min" : endKind };
    if (MINOR[h.mode] && endKind === "add9") fin.q = "min";
    var vc = voiceChord(fin, null), pC = phrase(plan, codaEnd, "flutes 8 & 4", "an open chord to end", 4);
    var hold = holdB * pb;
    layChords(pC, [{ voicing: vc, dur: hold }], codaEnd, null, { v: 0.8, orn: "close" });
    if (endKind === "add9" || endKind === "add6") {                 // Ives's last word: the added tone, high
      key(pC, codaEnd + 0.4 * pb, hold - 0.4 * pb, near(mz(h.keyMonzo, frac(endKind === "add9" ? "9/8" : "5/3")), 1300), "S", { v: 0.55, orn: "added" });
    }
    swell(plan, 0, 0.5, 0.05); swell(plan, introB * pb, 0.6 + 0.1 * rit, 2);
    swell(plan, codaEnd, 0.25, hold * 0.7);
    section(plan, tuneEnd, codaEnd + hold, "the figures slow, and an open chord");
    say(plan, organist, introB * pb, "puts the tune in the pedals");
    delete plan._saidBit;
    plan.liftDb = PRELUDE_LIFT.improviser;
    plan.manner = "the tune in the pedals" + (bit ? " (bitonal)" : ""); plan.bitonal = bit; plan.beatS = r3(pb); plan.lineIdx = idx;
    return finish(plan, codaEnd + hold);
  }

  // ==========================================================================
  // THE HYMN — giving out, the verses under the ward, fills, interludes
  // ==========================================================================
  // the registrations, verse by verse. lean (THE ARC OF LIGHT,
  // kolob-calendar.js regLean — the light of the hymn's rite and the
  // Sunday's own hand, −1 the plainest … +1 the fullest; 0 leaves the
  // thresholds where they stand) moves
  // the thresholds the same four dice are read against: a hymn in the early
  // morning keeps nearer the flutes, the doxology in full light reaches for
  // the full organ (a Victorian's last verse even of two, a plain
  // organist's principal), a funeral's organ stays soft
  function verseRegs(style, verses, R, lean) {
    var out = [], d = [R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1)];
    var up = Math.max(0, lean || 0), dn = Math.max(0, -(lean || 0));
    for (var v = 0; v < verses; v++) {
      var last = v === verses - 1 && verses > 1, r;
      if (style === "plain") r = last && d[0] < 0.35 + 0.35 * up - 0.25 * dn ? "hymn principal" : v === 0 && dn > 0.5 ? "quiet flute" : "soft flutes";
      else if (style === "victorian") {
        if (v === 0) r = dn > 0.55 ? "flutes 8 & 4" : "hymn principal";
        else if (last) r = (verses >= 3 || up > 0.6) && d[1] < 0.7 + 0.25 * up - 0.35 * dn ? "full organ" : "hymn principal";
        else r = d[2] < 0.55 + 0.2 * dn - 0.15 * up ? "vox & flutes" : "flutes 8 & 4";
      } else {
        if (v === 0) r = d[1] < 0.5 + 0.3 * dn ? "principal & 4" : "hymn principal";
        else if (last) r = d[2] < 0.45 - 0.2 * dn ? "principal & mixture" : d[2] < 0.75 + 0.2 * up - 0.3 * dn ? "full organ" : "hymn principal";
        else r = d[3] < 0.4 + 0.2 * dn ? "sixteen & four" : d[3] < 0.75 ? "flutes 8 & 4" : "principal & 4";
      }
      out.push(r);
    }
    return out;
  }
  // where the shutters stand for a verse on each registration (the full
  // organ's last verse is played with them open, not held back)
  var SWELL_OF = { "soft flutes": 0.66, "quiet flute": 0.7, "flutes 8 & 4": 0.66, "hymn principal": 0.62, "principal & 4": 0.62,
                   "vox & flutes": 0.66, "full organ": 0.64, "principal & mixture": 0.62, "sixteen & four": 0.68, "trumpet": 0.62 };

  // THE HYMN, IN PIECES (the organist in the meeting). A
  // meeting cannot plan a hymn whole. It decides between the verses whether
  // the fuging or a guest takes the gap, it writes each verse a few seconds
  // before it is sung, and the ward sings by the CHORISTER's clock, not the
  // organist's. So the organist's hands on one hymn are a writer of pieces —
  // the giving-out, each verse (the fills between its lines, and how long
  // the ward waits for each), each interlude, the amen, a modulation — every
  // piece laid from the time it is handed (0, in the meeting; the running
  // time, in accompany), with the same dice and the same arithmetic as the
  // whole. accompany() lays them end to end exactly as it always laid the
  // hymn (organist-lab hears the same hymn, key for key).
  //
  //   hands = hymnHands(organist, h, stream, opts)      (opts: as accompany's)
  //   hands.giveOut(at)          → piece; piece.next: where the ward's first verse begins
  //   hands.verse(v, at, o)      → piece; piece.ward: when each line begins;
  //                                piece.waits[i]: how long the ward waits after line i for a fill
  //       o = { bs (the verse's beat: the chorister's), clock(i) → the chorister's clock for
  //             line i ({rit, hold}: clockOf), rest (the organ rests: a hummed verse) }
  //   hands.interlude(v, at)     → piece (after verse v)
  //   hands.amen(at, o)          → piece; o = { bs, ck }
  //   hands.modulation(next, at) → piece (to next.keyMonzo, by a common tone)
  //   hands.regs[v], hands.accompanied, hands.giveReg, hands.state (the hymn's fills, so far)
  // A piece is a plan (finished: its phrases, swell, log, ward, fills,
  // sections, counts), plus piece.next — where whatever follows it begins.
  function hymnHands(organist, h, stream, opts) {
    opts = opts || {};
    var style = organist.style, S = STYLES[style];
    var R = stream.fork("organist:" + style);
    var verses = Math.max(1, opts.verses || 2), beatS = opts.beatS || h.beatS, lines = verseLinesOf(h);
    var hymnIndex = opts.hymnIndex || 0, scale = scaleOf(h.mode, h.keyMonzo);
    var withOrgan = opts.accompanied != null ? !!opts.accompanied : accompaniedDialect(h.dialect);
    var regs = verseRegs(style, verses, R.fork("regs"), opts.reg);
    var giveReg = style === "plain" ? "flutes 8 & 4" : style === "victorian" ? R.pickW([["trumpet", 0.45], ["hymn principal", 0.55]]) : R.pickW([["trumpet solo", 0.5], ["principal & 4", 0.5]]);
    var tacetDie = R.rnd(0, 1), tacetAt = R.rnd(0, 1);   // DICE: thrown for every hymn, used or not — deliberate; a draw left out would move every draw after it
    organist.ledger.hymns++;
    // the hymn's own state, carried from piece to piece: the stops last
    // drawn, the fills so far (the cap is the hymn's; never two joins
    // running), and whether the meeting's one strange fill is spent
    var st = { reg: undefined, fills: 0, lastFillJoin: -9, joinNo: 0, strangeUsed: organist.ledger.strange >= 1 };
    // (each piece carries the style's hymn level, HYMN_LIFT, as the whole
    // hymn does in accompany: a piece the meeting plays on its own sits
    // where the same notes sit in the lab's hymn)
    function open(kind) { var p = newPlan("hymn", organist, h); p._reg = st.reg; p.piece = kind; p.accompanied = withOrgan; p.liftDb = HYMN_LIFT[style] || 0; return p; }
    function close(p, next) { st.reg = p._reg; p.next = next; return finish(p, next); }
    function strayOf(v) { return clamp(0.3 * v + 0.25 * hymnIndex + (verses === 1 ? 0.3 : 0), 0, 1); }

    // ---- giving out: the tune's last line, the organ alone
    function giveOut(at) {
      var p = open("giveout"), t = at || 0;
      var li = h.lines.length - 1, gL = h.lines[li], gbs = beatS * (style === "victorian" ? 1.06 : 1);
      var gk = handsOn(h, gL, null, t, gbs, S.touch);
      draws(p, organist, t, giveReg);
      // the shutters a little open for the organ alone (at 0.82 the
      // Victorian's and the improviser's giving out was often the loudest
      // moment of the hymn, up to +2 LU over the engine's organ)
      swell(p, t, style === "victorian" ? 0.76 : 0.74, 0.05);
      if (giveReg === "trumpet solo") {
        var gs = phrase(p, t, "trumpet solo", "giving out: the tune on the trumpet", 1.6), gu = phrase(p, t, "soft flutes", "giving out", 3);
        lay(gs, gk, { only: tuneOf(h), line: li }); lay(gu, gk, { only: underTune(h), line: li });
      } else {
        if (style === "victorian") cadenceSusp(h, gL, gk, t, gbs, R.fork("giveout"), scale, p);
        lay(phrase(p, t, giveReg, "giving out: the last line", 4), gk, { line: li });
      }
      var gEnd = t + lineDur(gL, gbs, null);
      if (style === "victorian") extendLast(p, 0.6 * beatS);
      say(p, organist, t, "gives out the tune");
      section(p, t, gEnd, "the organ gives out the tune (its last line)");
      return close(p, gEnd + (style === "victorian" ? 1.3 : 0.9) * beatS);
    }

    // ---- a verse: the Score's four parts under the ward, and now and then
    // a fill after a line, for which the ward waits
    function verse(v, at, o) {
      o = o || {};
      var p = open("verse"), t = at || 0, bs = o.bs || beatS, ckOf = o.clock || function () { return null; };
      var reg = regs[v], stray = strayOf(v);
      var baseSw = SWELL_OF[reg] != null ? SWELL_OF[reg] : 0.62, dynV = dynOf(style, reg);
      if (v === 0 && verses > 1 && !dynV && dynOf(style, regs[verses - 1]) > 0) dynV = VERSE_RESERVE;
      p.verseDyn.push({ verse: v, reg: reg, dyn: dynV });
      p.waits = {};
      if (o.rest) {
        // the organ rests (the ward hums the verse): its lines, on the
        // chorister's clock, and nothing under them
        lines.forEach(function (L, i) {
          p.ward.push({ kind: "line", verse: v, i: i, t: r3(t), beatS: bs });
          t += lineDur(L, bs, lines[i + 1], ckOf(i));
          p.counts.lines++; if (i < lines.length - 1) p.counts.joins++;
        });
        section(p, at || 0, t, "verse " + (v + 1) + " — the organ rests; the ward hums it");
        return close(p, t);
      }
      if (v === 0 || reg !== regs[v - 1]) draws(p, organist, t, reg);
      swell(p, t - 0.3, baseSw, 0.8);
      // the improviser now and then lifts both hands for a line of a middle
      // verse, and lets the ward sing it alone
      var tacetLine = style === "improviser" && verses >= 3 && v === 1 && tacetDie < 0.25 ? Math.floor(tacetAt * lines.length) : -1;
      var peakLine = -1; lines.forEach(function (L, i) { if (L.peak) peakLine = i; });
      var carry = null;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i], nx = lines[i + 1], ck = ckOf(i), ld = lineDur(L, bs, nx, ck), tL = t;
        p.ward.push({ kind: "line", verse: v, i: i, t: r3(t), beatS: bs });
        p.counts.lines++;
        var keys = handsOn(h, L, nx, t, bs, S.touch, ck), tacet = i === tacetLine;
        // a suspension carried over from the last join: this line's first
        // note in that voice waits under the held one, and falls to it late
        if (carry) {
          var cy = keys.filter(function (x) { return x.part === carry.part && Math.abs(x.t - tL) < 0.01; })[0];
          if (cy && !tacet && cy.dur > carry.hold + 0.05) { cy.t += carry.hold; cy.dur -= carry.hold; }
          else if (carry.note) {                           // nothing to fall to: the held note lets go at the entry
            carry.note.dur = r3(carry.note.dur - carry.hold);
            carry.phrase.report.forEach(function (r) { if (r.orn === "susp") r.dur = carry.note.dur; });
          }
          carry = null;
        }
        t += ld;
        // ---- a fill after this line? (sparingly; never two joins running).
        // Decided before the line is laid: a fill may hold the line's last
        // chord on through the ward's breath.
        var fill = null;
        if (i < lines.length - 1) {
          p.counts.joins++; st.joinNo++;
          // DICE: the join's four dice are all thrown, on the join's own fork, whether or not a fill comes — deliberate; must stay
          var die = R.fork("join:" + v + ":" + i), roll = die.rnd(0, 1), kindRoll = die.rnd(0, 1), lenRoll = die.rnd(0, 1), strRoll = die.rnd(0, 1);
          var rate = S.fill.rate * organist.habits.fill * (style === "improviser" ? 0.8 + 0.6 * stray : 1);
          if (rate > 0 && roll < rate && st.fills < S.fill.cap && st.joinNo - st.lastFillJoin > 1) {
            // the strange fill: at most one a meeting, and then only a
            // chance at a fill once he has wandered far enough (at
            // 0.55 it came in four improviser meetings in five, the
            // commonest fill of a late hymn; at 0.3 it is a surprise)
            var strange = S.strange && !st.strangeUsed && stray >= 0.45 && strRoll < STRANGE_ODDS;
            var fs = t - breathOf(h, L, bs, nx, ck), np0 = p.phrases.length;
            fill = style === "victorian"
              ? fillVictorian(p, organist, h, L, nx, tacet ? [] : keys, fs, t, bs, scale, kindRoll, lenRoll, reg, i, die)
              : fillImproviser(p, organist, h, L, nx, tacet ? [] : keys, fs, t, bs, scale, kindRoll, lenRoll, strange, stray, i, die);
            fill.verse = v; fill.after = i;
            // a fill is played as softly as the verse it is in, never louder
            for (var fp = np0; fp < p.phrases.length; fp++) p.phrases[fp].dyn = Math.min(0, dynV);
            if (fill.carry) { carry = fill.carry; carry.phrase = fill.phrase; }
            delete fill.carry; delete fill.phrase;
            p.fills.push(fill);
            p.counts.fills++; st.fills++; st.lastFillJoin = st.joinNo;
            organist.ledger.fills++;
            if (fill.strange) { p.counts.strange++; organist.ledger.strange++; st.strangeUsed = true; }
          }
        }
        if (tacet) {
          say(p, organist, tL, "lifts both hands; the ward sings a line alone");
          section(p, tL, tL + ld, "verse " + (v + 1) + ", line " + (i + 1) + " — the ward alone");
        } else {
          var ph = phrase(p, tL, reg, "verse " + (v + 1) + ", line " + (i + 1), 4);
          ph.dyn = dynV;
          lay(ph, keys, { line: i, v: v === verses - 1 && reg === "full organ" ? 0.95 : 1 });
          section(p, tL, tL + ld, "verse " + (v + 1) + ", line " + (i + 1) +
            (i === 0 && (v === 0 || reg !== regs[v - 1] || dynV) ? " — " + (SAYS[reg] || reg) +
              (v === 0 && dynV === VERSE_RESERVE ? ", held back (the last verse will be fuller)" : dynV < 0 ? ", quieter" : dynV > 0 ? ", fuller" : "") : ""));
          // the Victorian's swell breathes with the line
          if (style === "victorian" && organist.habits.swell > 0.1) {
            // (on the full organ the box is already open; he leans on it less)
            var lift = (i === peakLine ? 0.16 : 0.05 * (i + 1) / lines.length) * (reg === "full organ" ? 0.5 : 1);
            swell(p, tL + 0.2, baseSw + lift * organist.habits.swell, ld * 0.45);
            swell(p, tL + ld * 0.62, baseSw - 0.03, ld * 0.3);
          }
        }
        if (fill) {
          section(p, fill.t, fill.t + fill.dur, fill.what);
          p.waits[i] = fill.t + fill.dur - t;           // the ward waits for the organist
          t = fill.t + fill.dur;
        }
      }
      return close(p, t);
    }

    // ---- between verses v and v + 1: the interlude
    function interludePiece(v, at) {
      var p = open("interlude"), t = at || 0;
      var id = interlude(p, organist, h, lines, t, beatS, scale, v, verses, strayOf(v), R.fork("interlude:" + v), regs[v + 1]);
      section(p, t, t + id.dur, id.what);
      p.what = id.what;
      return close(p, t + id.dur);
    }

    // ---- the amen, the ward's and the organ's
    function amen(at, o) {
      o = o || {};
      var p = open("amen"), t = at || 0, bs = o.bs || beatS, ck = o.ck || null;
      var aL = h.amen, ad = lineDur(aL, bs, null, ck);
      p.ward.push({ kind: "amen", verse: verses - 1, i: -1, t: r3(t), beatS: bs });
      // the amen is the ward's: the organ plays it as written, under them —
      // the Victorian's cadence suspensions are for the organ alone (the
      // prelude, the giving out, the interlude), never held over singers
      // resolving away from the note (held over, it was 20 amens in 20)
      var ak = handsOn(h, aL, null, t, bs, S.touch, ck), pa = phrase(p, t, regs[verses - 1], "the amen", 4);
      pa.dyn = dynOf(style, regs[verses - 1]);
      lay(pa, ak, { line: "amen" });
      section(p, t, t + ad, "the amen");
      return close(p, t + ad);
    }

    // ---- to the next hymn's key, by a common tone
    function modulationPiece(next, at) {
      var p = open("modulation"), t = at || 0;
      var md = modulation(p, organist, finalVoicing(h), h.keyMonzo, next.keyMonzo, next.mode || h.mode, t, beatS, R.fork("modulation"));
      section(p, t, t + md.dur, md.what);
      return close(p, t + md.dur);
    }

    return {
      accompanied: withOrgan, verses: verses, beatS: beatS, regs: regs.slice(), giveReg: giveReg, liftDb: HYMN_LIFT[style] || 0, state: st,
      giveOut: giveOut, verse: verse, interlude: interludePiece, amen: amen, modulation: modulationPiece,
    };
  }
  // a piece laid into a whole plan (its times are the plan's already)
  function absorb(plan, p) {
    ["phrases", "swell", "events", "ward", "fills", "sections", "verseDyn"].forEach(function (k) { Array.prototype.push.apply(plan[k], p[k]); });
    for (var c in p.counts) if (c !== "keys") plan.counts[c] = (plan.counts[c] || 0) + p.counts[c];
    if (p.modulation) plan.modulation = p.modulation;
    return p.next;
  }

  function accompany(organist, h, stream, opts) {
    opts = opts || {};
    var H = hymnHands(organist, h, stream, opts), plan = newPlan("hymn", organist, h);
    var verses = H.verses, beatS = H.beatS, lines = verseLinesOf(h), hymnIndex = opts.hymnIndex || 0, t = 0;
    plan.accompanied = H.accompanied; plan.verses = verses; plan.beatS = r3(beatS); plan.liftDb = H.liftDb;   // (absorb takes a piece's notes, not its lift: the whole carries it once)
    // ---- unaccompanied: the ward alone, lines end to end; the organist sits
    if (!H.accompanied) {
      for (var uv = 0; uv < verses; uv++) {
        lines.forEach(function (L, i) {
          plan.ward.push({ kind: "line", verse: uv, i: i, t: r3(t), beatS: beatS });
          t += lineDur(L, beatS, lines[i + 1]);
          plan.counts.lines++; if (i < lines.length - 1) plan.counts.joins++;
        });
        if (uv < verses - 1) t += 1.1 * beatS;
      }
      section(plan, 0, t, "the ward alone — no organ in this dialect");
      return finish(plan, t);
    }
    if (opts.giveOut !== false) t = absorb(plan, H.giveOut(t));
    for (var v = 0; v < verses; v++) {
      t = absorb(plan, H.verse(v, t));
      if (v < verses - 1) t = absorb(plan, H.interlude(v, t));
    }
    if (h.amen && opts.amen !== false) { t += 0.3 * beatS; t = absorb(plan, H.amen(t)); }
    if (opts.next && opts.next.keyMonzo && !eq(cls(opts.next.keyMonzo), cls(h.keyMonzo))) { t += 0.6 * beatS; t = absorb(plan, H.modulation(opts.next, t)); }
    plan.stray = r3(clamp(0.3 * (verses - 1) + 0.25 * hymnIndex, 0, 1));
    return finish(plan, t);
  }

  // ---- the Victorian's fill: one voice links the lines ----------------------
  // Over the chord held through the ward's breath, the tenor (or the alto):
  //  · holds its note on INTO the next line, where it hangs over the new
  //    chord and falls a step late — the suspension that links two lines
  //    (where that voice's next note lies a step below);
  //  · or walks from its last note into the next line's, stepwise;
  //  · or leans on the note above and comes back.
  // Or "echo": the tune's last notes again, an octave up on the echo flute,
  // while the ward breathes.
  function fillVictorian(plan, organist, h, L, nx, keys, fs, lineEnd, beatS, scale, kindRoll, lenRoll, reg, li, R) {
    var kind = kindRoll < 0.68 ? "link" : "echo", beats = kind === "link" ? 1 + 0.5 * Math.round(lenRoll) : 1.5 + 0.5 * Math.round(lenRoll);
    var dur = br0(lineEnd - fs) + beats * beatS, fe = fs + dur;
    if (kind === "link") {
      var order = R.chance(0.65) ? ["T", "A"] : ["A", "T"], voice = order[0], carry = null;
      function firstOf(q) { return nx && nx.notes[q] && nx.notes[q][0] ? { m: mz(h.keyMonzo, nx.notes[q][0].monzo), n: nx.notes[q][0] } : null; }
      // a voice that can fall a step into the next line takes the suspension
      order.some(function (q) {
        var lk = lastOf(keys, q), nf = firstOf(q);
        if (!lk || !nf) return false;
        var drop = cents(lk.m) - cents(nf.m);
        if (drop > 70 && drop < 260) { voice = q; carry = { part: q, hold: Math.min(0.5 * nf.n.beats * beatS, beatS) }; return true; }
        return false;
      });
      // hold the chord (all but the tune and the moving voice) through the
      // breath and the fill: each part's last key runs on to the ward's entry
      ["A", "T", "B"].forEach(function (q) {
        if (q === voice) return;
        var lk = lastOf(keys, q);
        if (lk && lk.t + lk.dur > fs - 0.35 * beatS) lk.dur = fe - lk.t;
      });
      var last = lastOf(keys, voice), nextFirst = firstOf(voice);
      var p = phrase(plan, fs, reg, "a link between the lines", 4), words;
      if (last) {
        last.dur = Math.max(0.05, fs - last.t);        // the moving voice's own last note gives way to the link
        var from = last.m, walk = [];
        if (carry) {
          // one key, held from the breath on over the next line's first chord
          var n = key(p, fs, dur + carry.hold, from, voice, { v: 0.85, orn: "susp" });
          carry.note = n; plan.counts.susp++;
          words = "a link: the " + (voice === "T" ? "tenor" : "alto") + " holds over into the next line and falls a step late (a suspension)";
        } else {
          if (nextFirst && !eq(cls(nextFirst.m), cls(from))) {
            var dir = cents(nextFirst.m) > cents(from) ? 1 : -1, m = from, guard = 0;
            walk.push(from);
            while (guard++ < 4) { m = stepOf(scale, m, dir); if ((cents(nextFirst.m) - cents(m)) * dir < 40) break; walk.push(m); }
          }
          if (walk.length < 2) walk = [from, near(stepOf(scale, from, 1), cents(from) + 180), from];   // lean on the note above, and back
          var each = dur / walk.length;
          walk.forEach(function (m2, k) { key(p, fs + k * each, each * 0.97, m2, voice, { v: 0.85, orn: "link" }); });
          words = "a link: the " + (voice === "T" ? "tenor" : "alto") + (walk.length > 3 || walk[walk.length - 1] !== from ? " walks into the next line" : " leans on the note above, and back");
        }
      }
      plan.counts.link++;
      say(plan, organist, fs, carry ? "holds a note over into the next line" : "links the lines");
      return { t: r3(fs), dur: r3(dur), kind: carry ? "suspension" : "link", strange: false, carry: carry, phrase: p, what: words || "a link between the lines" };
    }
    var mel = keys.filter(function (x) { return x.part === "S"; }).sort(function (a, b) { return a.t - b.t; }).slice(-3);
    var pe = phrase(plan, fs, "echo flute", "an echo between the lines", 1.2), each2 = dur / Math.max(1, mel.length);
    mel.forEach(function (x, k) { key(pe, fs + k * each2, each2 * 0.92, oct(x.m, 1), "S", { v: 0.8, orn: "echo" }); });
    plan.counts.echo++;
    say(plan, organist, fs, "echoes the line on the echo flute");
    return { t: r3(fs), dur: r3(dur), kind: "echo", strange: false, what: "an echo: the line's last notes, an octave up, on the echo flute" };
  }
  function br0(x) { return Math.max(0, x); }
  function lastOf(keys, part) { var b = null; keys.forEach(function (x) { if (x.part === part && (!b || x.t > b.t)) b = x; }); return b; }

  // ---- the improviser's fill ------------------------------------------------
  // over the bass held through the breath: a QUOTE (the next line's head,
  // quick, an octave up), an ARABESQUE (a turn around the tune's last note),
  // or a SEQUENCE (the last three notes, stepped down). The further he has
  // strayed, the more chromatic. And once a meeting, at most, the STRANGE
  // fill: a chord and a figure in a key the hymn never visits — the bass let
  // go, the flutes in the wrong key, until the ward's next entry drags the
  // organ home (the next line's keys are the hymn's own).
  function fillImproviser(plan, organist, h, L, nx, keys, fs, lineEnd, beatS, scale, kindRoll, lenRoll, strange, stray, li, R) {
    var kind = strange ? "strange" : kindRoll < 0.4 ? "quote" : kindRoll < 0.75 ? "arabesque" : "seq";
    var beats = strange ? 2.5 + 1.5 * lenRoll : 1.5 + 1.5 * lenRoll;
    var dur = br0(lineEnd - fs) + beats * beatS, fe = fs + dur, chroma = stray > 0.5;
    var mel = keys.filter(function (x) { return x.part === "S"; }).sort(function (a, b) { return a.t - b.t; });
    var lastS = mel.length ? mel[mel.length - 1].m : mz(h.keyMonzo, [0, 0, 0, 0]);
    var nextHead = nx && nx.notes[h.melodyPart] ? nx.notes[h.melodyPart].slice(0, 4).map(function (x) { return mz(h.keyMonzo, x.monzo); }) : [lastS];
    if (!strange) {
      // the bass holds through (the pedal under the arabesque)
      var lb = lastOf(keys, "B");
      if (lb && lb.t + lb.dur > fs - 0.35 * beatS) lb.dur = fe - lb.t;
    }
    var reg = strange ? "glass" : R.pickW([["sixteen & four", 0.45], ["figures", 0.35], ["echo flute", 0.2]]);
    var p = phrase(plan, fs, reg, strange ? "a strange fill" : "a fill between the lines", 1.4), notes = [];
    if (kind === "quote") notes = nextHead.map(function (m) { return oct(m, 1); });
    else if (kind === "arabesque") {
      var up = stepOf(scale, lastS, 1), dn = stepOf(scale, lastS, -1);
      if (chroma) { up = mz(lastS, UP_SEMI); }
      notes = [lastS, up, lastS, dn, lastS, up].map(function (m) { return oct(m, 1); });
    } else if (kind === "seq") {
      var cell = mel.slice(-3).map(function (x) { return x.m; });
      if (cell.length < 2) cell = [lastS, stepOf(scale, lastS, -1)];
      var down = cell.map(function (m) { return chroma ? mz(m, DN_SEMI) : stepOf(scale, m, -1); });
      notes = cell.concat(down).map(function (m) { return oct(m, 1); });
    } else {
      // the strange key: its own chord held soft on the flutes, and the next
      // line's head run in it, bright, on the mixture — then let go at the
      // ward's entry
      var xk = organist.habits.strayKey, root = mz(h.keyMonzo, xk);
      var vc = voiceChord({ root: root, q: MINOR[h.mode] ? "min" : "maj" }, null);
      var pc = phrase(plan, fs, "quiet flute", "the strange key's chord", 3);
      ["A", "T", "B"].forEach(function (q) { key(pc, fs, dur - 0.05, vc[q], q, { v: 0.62, pedal: q === "B", orn: "strange" }); });
      notes = nextHead.concat(nextHead.slice(0, 2)).map(function (m) { return oct(mz(m, xk), 1); });
      say(plan, organist, fs, "strays into a strange key (" + organist.habits.strayName + ")");
    }
    // a quick figure, evenly through the fill
    var each = Math.min(beatS * 0.5, dur / Math.max(1, notes.length)), t0 = fe - each * notes.length;
    notes.forEach(function (m, k) {
      var c = cents(m); if (c > 2000) m = oct(m, -1); if (c < 200) m = oct(m, 1);
      key(p, t0 + k * each, each * 0.9, m, "S", { v: strange ? 0.7 : 0.72, orn: strange ? "strange" : kind === "seq" ? "seq" : kind });
    });
    if (kind !== "strange") plan.counts[kind] = (plan.counts[kind] || 0) + 1;
    if (!strange) say(plan, organist, fs, kind === "quote" ? "quotes the next line between the lines" : kind === "arabesque" ? "turns an arabesque between the lines" : "runs a sequence between the lines");
    var words = { quote: "a quote: the next line's head, quick and high", arabesque: "an arabesque around the tune's last note", seq: "a sequence: the line's last notes, stepped down",
                  strange: "the strange fill: a chord and a figure " + organist.habits.strayName + ", until the ward drags the organ back" };
    return { t: r3(fs), dur: r3(dur), kind: kind, strange: !!strange, what: words[kind] + (chroma && !strange ? " (chromatic)" : "") };
  }

  // ---- the interlude between verses -------------------------------------------
  function interlude(plan, organist, h, lines, t, beatS, scale, v, verses, stray, R, nextReg) {
    var style = organist.style, lastV = v === verses - 2;
    if (style === "plain") {
      // the plain organist lifts, counts a beat, and they go on
      return { dur: 1.1 * beatS, what: "a breath between verses" };
    }
    if (style === "victorian") {
      // the last line's close again, softly, broadened, with its suspension
      // (the line's last three chords: the cadence, and what leads to it)
      var L = lines[lines.length - 1], ld = lineDur(L, beatS, null);
      var all = handsOn(h, L, null, 0, beatS, STYLES.victorian.touch), ons = [];
      all.forEach(function (x) { if (!ons.some(function (o) { return Math.abs(o - x.t) < 0.01; })) ons.push(x.t); });
      ons.sort(function (a, b) { return a - b; });
      var from = ons[Math.max(0, ons.length - 3)], bs = beatS * 1.18, shift = t - from * 1.18;
      var ks = all.filter(function (x) { return x.t + x.dur > from + 0.01; });
      ks.forEach(function (x) {
        if (x.t < from) { x.dur -= from - x.t; x.t = from; }
        x.t = x.t * 1.18 + shift; x.dur *= 1.18;
        x.written = (x.written || []).filter(function (e) { return e.t + e.dur > from + 0.01; }).map(function (e) {
          var st = Math.max(e.t, from); return { t: st * 1.18 + shift, dur: (e.t + e.dur - st) * 1.18, n: e.n };
        });
      });
      var sus = cadenceSusp(h, L, ks, shift, bs, R, scale, plan);
      var reg = R.pickW([["vox & flutes", 0.5], ["echo flute", 0.25], ["soft flutes", 0.25]]);
      var p = phrase(plan, t, reg, "interlude: the close again, softly", 4);
      draws(plan, organist, t, reg);
      lay(p, ks, { line: lines.length - 1, v: 0.85 });
      var dur = (ld - from) * 1.18 + 0.7 * beatS;
      swell(plan, t, 0.45, 0.6); swell(plan, t + dur - 1.2 * beatS, SWELL_OF[nextReg] || 0.62, 0.9 * beatS);
      plan.counts.seq++;
      return { dur: dur, what: "an interlude: the close again, softly" + (sus ? ", with its suspension" : "") };
    }
    // the improviser: the first line's head in the tenor, sequenced upward
    // over a pedal point — the tonic, or the dominant before the last verse
    // (§3.5) — and a dominant chord to hand the verse back
    var L0 = lines[0], head = (L0.notes[h.melodyPart] || []).slice(0, 4);
    if (head.length < 2) return { dur: 1.1 * beatS, what: "a breath between verses" };
    var reg2 = R.pickW([["principal & 4", 0.4], ["flutes 8 & 4", 0.35], ["sixteen & four", 0.25]]);
    var pedalM = mz(h.keyMonzo, lastV ? frac("3/4") : frac("1/2")), pedB = near(pedalM, -1500);
    var reps = 2 + (stray > 0.6 ? 1 : 0), unit = beatS * 0.75, tt = t;
    var p2 = phrase(plan, t, reg2, "interlude: the first line's head, sequenced", 2.5);
    draws(plan, organist, t, reg2);
    // the head in the tenor's compass, its own intervals kept
    var cellM = head.map(function (x) { return mz(h.keyMonzo, x.monzo); });
    var sh = Math.round((-400 - cents(cellM[0])) / 1200);
    cellM = cellM.map(function (m) { return oct(m, sh); });
    for (var r = 0; r < reps; r++) {
      cellM.forEach(function (m, k) { key(p2, tt + k * unit, unit * 0.92, m, "T", { v: 0.78, orn: "seq" }); });
      tt += cellM.length * unit + 0.25 * unit;
      cellM = cellM.map(function (m) { return stray > 0.5 && r === 0 ? mz(m, [-3, 2, 0, 0]) : stepOf(scale, m, 1); });   // up a step (whole-tone when strayed)
    }
    var dom = voiceChord({ root: mz(h.keyMonzo, frac("3/2")), q: MINOR[h.mode] ? "maj" : "dom7" }, null);
    key(p2, t, tt - t, pedB, "B", { v: 0.85, pedal: true, orn: "pedalpoint" });
    var pd = phrase(plan, tt, reg2, "interlude: the dominant", 4);
    layChords(pd, [{ voicing: dom, dur: 1.5 * beatS }], tt, null, { v: 0.85, orn: "seq" });
    plan.counts.seq++;
    var d = tt - t + 1.5 * beatS + 0.3 * beatS;
    return { dur: d, what: "an interlude: the first line's head, sequenced over a " + (lastV ? "dominant" : "tonic") + " pedal" + (stray > 0.5 ? ", wandering" : "") };
  }

  // ==========================================================================
  // THE MODULATION — to the next hymn's key, through a common tone (§3.7)
  // ==========================================================================
  // From the chord the organ holds, a chord of the NEW key that shares a
  // tone with it (the pivot: the common tone held, the other voices moving),
  // then the new key's dominant seventh, then its tonic. The Victorian leans
  // a 4–3 on the dominant; the improviser, sometimes, detours through a
  // chromatic mediant first. The common tone is exact where the keys allow
  // (a just fourth or fifth apart, the chorister's usual step), and re-struck
  // where it lies a comma off.
  function modulation(plan, organist, fromV, fromKey, toKey, toMode, t, beatS, R) {
    var style = organist.style, list = keyChords(toKey, toMode), have = ["S", "A", "T", "B"].map(function (p) { return cls(fromV[p]); });
    var dDet = R.rnd(0, 1), dSus = R.rnd(0, 1);   // DICE: both thrown first, used or not — deliberate; a draw left out would move every draw after it
    var pivot = null, best = -1, commaOnly = false;
    ["ii", "IV", "iv", "vi", "VI", "iii", "III", "I", "i", "V7"].forEach(function (rn, pri) {
      list.forEach(function (c) {
        if (c.roman !== rn) return;
        var tn = tonesOf(c), exact = 0, near1 = 0;
        tn.forEach(function (x) { if (have.some(function (y) { return eq(x, y); })) exact++; else if (have.some(function (y) { return commaNear(x, y); })) near1++; });
        var score = exact * 10 + near1 * 3 - pri * 0.1;
        if (score > best) { best = score; pivot = c; commaOnly = exact === 0 && near1 > 0; }
      });
    });
    var V7 = list.filter(function (c) { return c.roman === "V7"; })[0], I = list.filter(function (c) { return c.roman === "I" || c.roman === "i"; })[0];
    var seq = [];
    if (pivot && pivot.roman !== "V7") seq.push({ c: pivot, beats: 2 });
    if (style === "improviser" && dDet < 0.4) seq.push({ c: { root: mz(toKey, frac(MINOR[toMode] ? "8/5" : "5/4")), q: "maj", roman: "♮III" }, beats: 1.5 });
    seq.push({ c: V7, beats: 2 });
    seq.push({ c: I, beats: style === "victorian" ? 3.5 : 3 });
    var reg = style === "plain" ? "soft flutes" : style === "victorian" ? "vox & flutes" : "flutes 8 & 4";
    var p = phrase(plan, t, reg, "modulation to the next hymn's key", 4);
    draws(plan, organist, t, reg);
    var prev = fromV, out = [], common = null;
    // the old tonic, re-sounded softly so the pivot has something to hold
    out.push({ voicing: fromV, dur: 1 * beatS });
    seq.forEach(function (s, k) {
      var vc = voiceChord(s.c, prev, k === 0 ? { keep: 6 } : null);
      out.push({ voicing: vc, dur: s.beats * beatS, roman: s.c.roman });
      // the common tone is the PIVOT's: a pitch of the first new chord held
      // over from the old tonic, in whichever voice now has it (layChords
      // keeps its key down); a tone two later chords share is no pivot
      if (k === 0) ["S", "A", "T", "B"].forEach(function (q) {
        if (!common && ["S", "A", "T", "B"].some(function (r) { return eq(vc[q], prev[r]); })) common = { part: q, m: vc[q] };
      });
      prev = vc;
    });
    var keysOut = [];
    layChords(p, out, t, null, { v: 0.85, orn: "mod", into: keysOut });
    // the Victorian's 4–3 on the dominant: the tonic of the new key held
    // over its arrival, falling to the leading tone
    if (style === "victorian" && dSus < 0.8) {
      var vAt = t + out.slice(0, out.length - 2).reduce(function (a, c) { return a + c.dur; }, 0), vv = out[out.length - 2].voicing;
      // only where the soprano has the leading tone: the tonic a semitone
      // above it is held over, and falls
      var sN = null; p.notes.forEach(function (n) { if (n.part === "S" && Math.abs(p.t + n.at - vAt) < 0.01) sN = n; });
      var sus = sN ? near(mz(toKey, [0, 0, 0, 0]), cents(vv.S) + 110) : null, gap = sus ? cents(sus) - cents(vv.S) : 0;
      if (sN && gap > 80 && gap < 140 && sN.dur > beatS) {
        sN.at = r3(sN.at + 0.8 * beatS); sN.dur = r3(sN.dur - 0.8 * beatS);
        key(p, vAt, 0.8 * beatS, sus, "S", { v: 0.95, orn: "susp" });
        plan.counts.susp++;
      }
    }
    var dur = out.reduce(function (a, c) { return a + c.dur; }, 0);
    swell(plan, t, 0.58, 0.8); swell(plan, t + dur - 1.5 * beatS, 0.5, 1.2);
    say(plan, organist, t, "modulates to the next hymn's key");
    // the words follow the chords as they sound, from the old tonic: each
    // new chord named once, in order, the first with its common tone
    var held = common ? ", its common tone held in the " + { S: "soprano", A: "alto", T: "tenor", B: "bass" }[common.part]
             : commaOnly && seq[0].c === pivot ? ", its common tone re-struck a comma off" : "";
    var names = seq.map(function (s, k) {
      var r = s.c.roman, w = r === "♮III" ? "a chromatic mediant (♮III)" : r === "V7" && s.c === pivot ? "the new key's V7, as the pivot" : s.c === pivot ? "the pivot " + r + " of the new key" : r;
      return k === 0 ? w + held : w;
    });
    var words = "a modulation: " + names.slice(0, -1).join(", then ") + ", then " + names[names.length - 1];
    plan.modulation = { pivot: pivot ? pivot.roman : null, common: common ? common.part : null, commaOnly: commaOnly, chords: out.map(function (c) { return c.roman || "old I"; }) };
    return { dur: dur + 0.4 * beatS, what: words };
  }
  // the modulation alone, for a joint between hymns (from/to: a hymn, or
  // { keyMonzo, mode, voicing? })
  function modulate(organist, from, to, stream, opts) {
    opts = opts || {};
    var plan = newPlan("modulation", organist, from && from.lines ? from : null);
    var fromKey = from.keyMonzo, beatS = opts.beatS || (from.beatS || 0.8);
    var fromV = from.lines ? finalVoicing(from) : (from.voicing || voiceChord({ root: fromKey, q: MINOR[from.mode] ? "min" : "maj" }, null));
    if (eq(cls(fromKey), cls(to.keyMonzo))) return finish(plan, 0);
    var md = modulation(plan, organist, fromV, fromKey, to.keyMonzo, to.mode || from.mode, 0, beatS, stream.fork("organist:modulation"));
    section(plan, 0, md.dur, md.what);
    return finish(plan, md.dur);
  }

  // ==========================================================================
  // VARIATIONS ON A HYMN (PLAN-COMPOSITION §8.5). The noon organ
  // recital, and Charles Ives's Variations on "America" (1891, written at
  // seventeen for a Fourth of July in Brewster, full of jokes): the Sunday's
  // organist takes one of the meeting's composed hymns through three to five
  // characters — the tune first as a PLAIN CHORALE (the theme), then as a
  // TRIO (the tune in the pedals, two lines above it on two manuals), a
  // MINUET (in three, the bass on the downbeat and the chords after it), a
  // POLONAISE (in three, in the minor, the dance's own rhythm in the left
  // hand, as Ives's fourth variation has it), a MARCH (in two, the pedal's
  // oom-pah, chords on the off-beats), a CANON (the tune chasing itself), the
  // BITONAL INTERLUDE (the tune in two keys at once — Ives's own joke: his
  // interludes set it in F and in D♭ together, his father's ear-training
  // made into a piece), and a GRAND FINAL STATEMENT on the full organ.
  //   The organist's style chooses and plays them. THE PLAIN ORGANIST gives a
  // short set (three or four), the dances plain, the trio on the Score's own
  // inner parts, and only now and then the interlude in two keys — played
  // straight-faced, as printed. THE VICTORIAN gives four or five: the minuet
  // on the vox humana, the march on the trumpet, suspensions at the chorale's
  // closes and his finale building from the principal and mixture to the full
  // organ, and the plagal amen. THE IMPROVISER always plays the interlude in
  // two keys (his own stray key), runs figures over the pedal tune, sets his
  // canon at the fifth, adds sixths to the march's off-beats, and ends on a
  // chord with a tone added high.
  //   The re-barring. A hymn tune in any metre becomes a dance by its own
  // stresses: every stressed syllable (the Score's Note.stress) opens a bar
  // of the dance, the notes of its foot share the bar by the dance's cells
  // (a minuet's half and quarter, the polonaise's eighth-and-two-sixteenths,
  // the march's dotted pair), the unstressed notes before the first stress
  // are its pickup, and the harmony under each new beat is the hymn's own
  // chord at the melody note's first beat. So the minuet, the polonaise and
  // the march are the hymn's own tune and harmony, re-danced.
  //   PURE, as the rest of this room: every die is the caller's stream.
  //   variations(organist, hymn, stream, opts) → Plan (kind "variations")
  //     opts: { characters: [ids] (forced, the lab's), count, lo, hi (the
  //             whole set's length window, s: 105–165) }
  //     plan.variations: [{ id, en, t, end, regs, keys (the keys it sounds in,
  //       monzos), lines, beatS, meter }]; plan.characters; plan.manner
  // ==========================================================================
  var VAR_CHARS = {
    chorale:   { en: "a plain chorale", order: 0, share: 1.0 },
    trio:      { en: "a trio, the tune in the pedals", order: 1, share: 1.0 },
    canon:     { en: "a canon", order: 2, share: 0.9 },
    minuet:    { en: "a minuet", order: 3, share: 1.0 },
    bitonal:   { en: "an interlude in two keys at once", order: 3.5, share: 0.55 },
    polonaise: { en: "a polonaise, in the minor", order: 4, share: 1.0 },
    march:     { en: "a march", order: 5, share: 0.85 },
    finale:    { en: "a grand final statement on the full organ", order: 9, share: 1.25 },
  };
  // how many characters (the chorale and the finale among them), and which
  // the middle is drawn from, by style (weights); the improviser's interlude
  // in two keys is never left out
  var VAR_POOL = {
    plain:      { count: [[3, 0.55], [4, 0.45]], w: { trio: 1.2, minuet: 1, march: 1, canon: 0.8, polonaise: 0.35, bitonal: 0.35 } },
    victorian:  { count: [[4, 0.5], [5, 0.5]], w: { trio: 1, minuet: 1.1, polonaise: 1, march: 1, canon: 0.7, bitonal: 0.9 } },
    improviser: { count: [[4, 0.4], [5, 0.6]], w: { trio: 1, canon: 1, polonaise: 0.9, march: 0.8, minuet: 0.6 }, always: ["bitonal"] },
  };
  // the level of the set, as the prelude's (dB; set in guests3b-lab against
  // the organist's own chorale prelude on the same hymn and the engine's organ)
  var VAR_LIFT = { plain: 1.3, victorian: 0.5, improviser: 2.4 };
  // …and each character's own, over its stops' balance (dB): measured in
  // guests3b-lab over nine sets (the three organists, three dialects), the
  // finale on the full organ stood 2.6–5.1 LU over the organist's own
  // chorale prelude on the same hymn (up to 4.7 over the engine's organ) and
  // the Victorian's minuet on the vox humana 3.6–4.6 under it; the finale is
  // held back and the minuet brought forward, so the set's loudest moment
  // is within ±2 LU of the organ the owner has set. (The plain organist's
  // finale is held back less: at −3 dB it sat under his own trio — the
  // finale must still be the set's climax)
  var VAR_DYN = { finale: -3.0, minuet: 1.5 };
  var VAR_DYN_STYLE = { plain: { finale: -1.5 } };

  // the tune of a line, its tied notes joined: [{ b, beats, m (from the
  // keynote), n }]
  function tuneLine(h, line) {
    var ns = line.notes[h.melodyPart] || [], out = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      out.push({ b: n.beat, beats: b1 - n.beat, m: mz(h.keyMonzo, n.monzo), n: n });
    }
    return out;
  }
  // what the Score sounds at beat b of a line: its chord's classes (passing
  // notes left out), its lowest note, and its root (the class the chord book
  // names, as the Score spells it; else the bass)
  function heard(h, line, b) {
    var cl = [], bass = null;
    Object.keys(line.notes).forEach(function (p) {
      (line.notes[p] || []).forEach(function (n) {
        if (!(n.beat <= b + 1e-6 && n.beat + n.beats > b + 1e-6)) return;
        var m = mz(h.keyMonzo, n.monzo);
        if (!bass || cents(m) < cents(bass)) bass = m;
        if (n.nct) return;
        var c = cls(m);
        if (!cl.some(function (o) { return eq(o, c); })) cl.push(c);
      });
    });
    if (!bass) { bass = oct(h.keyMonzo, -1); cl.push(cls(h.keyMonzo)); }
    if (!cl.length) cl.push(cls(bass));
    var ch = null;
    (line.chords || []).forEach(function (c) { if (c.beat <= b + 1e-6 && c.beat + (c.len || 1) > b + 1e-6) ch = c; });
    var root = cls(bass);
    if (ch && ch.rootDeg != null) {
      var want = cls(mz(h.keyMonzo, degM(h.mode, ch.rootDeg, ch.rootAlt || 0)));
      cl.forEach(function (c) { if (eq(c, want) || commaNear(c, want)) root = c; });
    }
    return { classes: cl, bass: bass, root: root, chord: ch };
  }
  // the lines a character plays: the whole tune, or its head and its home
  function lineSets(n) {
    var all = []; for (var i = 0; i < n; i++) all.push(i);
    var out = [all];
    if (n > 4) out.push([0, 1, n - 2, n - 1]);
    if (n > 3) out.push([0, 1, n - 1]);
    if (n > 2) out.push([0, n - 1]);
    if (n > 1) out.push([0, 1]);
    out.push([0]);
    return out;
  }

  // REBAR — a line's tune in a dance's metre (the header). cells[k]: the
  // lengths (dance beats) of a foot of k notes; last[k]: the line's last foot
  var DANCE = {
    minuet: { bar: 3, cells: { 1: [3], 2: [2, 1], 3: [1, 1, 1], 4: [1, 0.5, 0.5, 1], 5: [1, 0.5, 0.5, 0.5, 0.5], 6: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
              pick: { 1: [1], 2: [0.5, 0.5], 3: [0.5, 0.25, 0.25] } },
    polonaise: { bar: 3, cells: { 1: [3], 2: [2, 1], 3: [1.5, 0.5, 1], 4: [0.5, 0.25, 0.25, 2], 5: [0.5, 0.25, 0.25, 1, 1], 6: [0.5, 0.25, 0.25, 0.5, 0.5, 1], 7: [0.5, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5] },
                 pick: { 1: [1], 2: [0.5, 0.5], 3: [0.5, 0.25, 0.25] } },
    march: { bar: 2, cells: { 1: [2], 2: [1.5, 0.5], 3: [1, 0.5, 0.5], 4: [0.75, 0.25, 0.5, 0.5], 5: [0.5, 0.25, 0.25, 0.5, 0.5], 6: [0.5, 0.25, 0.25, 0.5, 0.25, 0.25] },
             pick: { 1: [0.5], 2: [0.25, 0.25], 3: [0.5, 0.25, 0.25] } },
  };

  // a foot of k notes in `total` dance beats: the dance's cells for k, the
  // last cell stretched or shortened to fill (never under a quarter beat)
  function fitFoot(D, k, total) {
    var c = D.cells[k] ? D.cells[k].slice() : null;
    if (!c) { c = []; for (var i = 0; i < k; i++) c.push(total / k); return c; }
    var s = 0; for (var j = 0; j < c.length - 1; j++) s += c[j];
    if (total - s >= 0.25) c[c.length - 1] = total - s;
    else { var sc = total / (s + c[c.length - 1]); c = c.map(function (x) { return x * sc; }); }
    return c;
  }
  // a line's feet: every stressed syllable opens one; the unstressed notes
  // before the first are its pickup; a foot too full for one bar is two
  function feetOf(h, line, dance) {
    var D = DANCE[dance], tn = tuneLine(h, line), feet = [], pick = [], maxK = 0;
    Object.keys(D.cells).forEach(function (k) { maxK = Math.max(maxK, +k); });
    tn.forEach(function (x) {
      if (x.n.stress && x.n.syl != null) feet.push([x]);
      else if (feet.length) feet[feet.length - 1].push(x);
      else pick.push(x);
    });
    if (!feet.length) { feet = []; pick.forEach(function (x, i) { if (i % 2 === 0) feet.push([x]); else feet[feet.length - 1].push(x); }); pick = []; }
    var out = [];
    feet.forEach(function (f) { while (f.length > maxK) out.push(f.splice(0, Math.ceil(f.length / 2))); out.push(f); });
    if (pick.length > 3) { out.unshift(pick.slice(3)); pick = pick.slice(0, 3); }
    return { feet: out, pick: pick };
  }
  function pickBeats(h, line, dance) {
    var p = feetOf(h, line, dance).pick, c = DANCE[dance].pick[p.length] || [];
    return c.reduce(function (a, b) { return a + b; }, 0);
  }
  // → { notes: [{ b, d, x, fem? }], beats, pick } in dance beats from the
  // line's start (its pickup first); nextPick: the next line's pickup, which
  // completes this line's last bar. A polonaise's line closes on its second
  // beat: a last foot of one note leans on the step above first (fem)
  function rebar(h, line, dance, nextPick) {
    var D = DANCE[dance], F = feetOf(h, line, dance), out = [], b = 0;
    var pc = D.pick[F.pick.length] || [];
    F.pick.forEach(function (x, i) { out.push({ b: b, d: pc[i], x: x }); b += pc[i]; });
    var pick = b;
    F.feet.forEach(function (f, i) {
      var last = i === F.feet.length - 1, total = last ? Math.max(1, D.bar - (nextPick || 0)) : D.bar;
      if (last && dance === "polonaise" && f.length === 1 && total >= 2) {
        out.push({ b: b, d: 1, x: f[0], fem: true }); out.push({ b: b + 1, d: total - 1, x: f[0] }); b += total; return;
      }
      var c = last && dance === "polonaise" && f.length === 2 && total >= 2 ? [1, total - 1] : fitFoot(D, f.length, total);
      f.forEach(function (x, j) { out.push({ b: b, d: c[j], x: x }); b += c[j]; });
    });
    return { notes: out, beats: b, pick: pick };
  }
  // the hymn's own beat under dance beat β of a re-barred line (a long
  // note of the hymn keeps its chord changes, spread over its new length)
  function origAt(rb, beta) {
    var ns = rb.notes, e = ns[0];
    for (var i = 0; i < ns.length; i++) if (ns[i].b <= beta + 1e-6) e = ns[i];
    var f = Math.max(0, Math.min(0.999, (beta - e.b) / e.d));
    return e.x.b + (e.fem ? 0 : f * e.x.beats);
  }

  // THE POLONAISE'S MINOR — a major hymn's tune and chords in its tonic
  // minor: mi, la and ti lowered a small semitone (25/24), so the tonic
  // chord turns minor, IV minor, vi becomes VI, iii becomes III and ii turns
  // diminished, every chord still just; but a chord of the dominant keeps
  // its leading tone, as the harmonic minor does (V stays major)
  var LOWERED = [[-2, 0, 1, 0], [0, -1, 1, 0], [-3, 1, 1, 0]];            // 5/4, 5/3, 15/8
  var SMALL_DOWN = [3, 1, -2, 0];                                         // 24/25
  function neg(m) { return [-m[0], -m[1], -m[2], -(m[3] || 0)]; }
  function minorM(key, m, dominant) {
    var rel = cls(mz(m, neg(key)));
    for (var i = 0; i < LOWERED.length; i++) if (eq(rel, LOWERED[i]) && !(i === 2 && dominant)) return mz(m, SMALL_DOWN);
    return m;
  }
  function dominantOf(key, H) {
    var r = cls(mz(H.root, neg(key)));
    return (!!H.chord && H.chord.fn === "D") || eq(r, [-1, 1, 0, 0]) || eq(r, [-3, 1, 1, 0]);
  }
  // a tune note a comma from a tone of the chord under it takes the chord's
  // (as the composer's own commas do)
  function snap(m, classes) {
    for (var i = 0; i < classes.length; i++) if (!eq(cls(m), classes[i]) && commaNear(m, classes[i])) return near(classes[i], cents(m));
    return m;
  }
  // a left hand's chord: up to n tones of the chord between −900 c and a
  // third under the tune's note, kept near the last (the root chosen last)
  function leftHand(classes, root, top, n, prev) {
    var hi = Math.min(500, top - 280), lo = -900, around = prev != null ? prev : Math.min(-100, hi - 350);
    var lad = ladder(classes, lo, hi).sort(function (a, b) { return Math.abs(a.c - around) - Math.abs(b.c - around); });
    var out = [], used = [];
    [false, true].forEach(function (rootToo) {
      lad.forEach(function (x) {
        if (out.length >= n) return;
        var c = cls(x.m);
        if (used.some(function (u) { return eq(u, c); }) || (!rootToo && eq(c, root) && classes.length > 1)) return;
        out.push(x.m); used.push(c);
      });
    });
    return out;
  }
  // the pedal's note of a class: near the last one, between −2300 and −700 c
  function bassNote(c, prev) {
    var m = near(c, prev != null ? prev : -1500);
    while (cents(m) > -700) m = oct(m, -1);
    while (cents(m) < -2300) m = oct(m, 1);
    return m;
  }
  function fifthOf(H) {
    var f = cls(mz(H.root, [-1, 1, 0, 0]));
    return H.classes.some(function (c) { return eq(c, f); }) ? f : H.root;
  }

  // THE CHARACTERS — each lays its keys on the set's plan from t (C: the
  // set's context, below) and says where it ended, what it drew, and in
  // which keys: → { end, regs, keys, beatS, meter }
  var VAR_PLAY = {};
  // whole lines of the Score as the style's hands take them (the chorale,
  // the finale): o = { rit, tag, solo, under, octave, regOf(k) }
  function scoreLines(C, idx, t, bs, reg, o) {
    o = o || {};
    var h = C.h, lines = C.lines, touch = STYLES[C.style].touch, vic = C.style === "victorian", regs = [];
    // (the tune doubled an octave up only where its top stays under two
    // octaves above the keynote: a whole statement doubled, or none of it)
    var top = -1e9;
    idx.forEach(function (i) { (lines[i].notes[h.melodyPart] || []).forEach(function (n) { top = Math.max(top, cents(mz(h.keyMonzo, n.monzo))); }); });
    var dbl = !!o.octave && top + 1200 <= 2450;
    idx.forEach(function (i, k) {
      var last = k === idx.length - 1, L = lines[i], nx = lines[i + 1], b = bs * (last && o.rit ? o.rit : 1);
      var keys = handsOn(h, L, nx, t, b, touch), rg = o.regOf ? o.regOf(k) : reg;
      if (vic) {
        var die = C.R.fork("hands:" + o.tag + ":" + i);
        if (die.chance(0.8)) cadenceSusp(h, L, keys, t, b, die, C.scale, C.plan);
        passing(keys, b, die, 0.35, C.scale, C.plan, 2, h.melodyPart);
      }
      if (dbl) keys.filter(function (x) { return x.part === h.melodyPart && !x.orn; }).forEach(function (x) {
        keys.push({ t: x.t, dur: x.dur, m: oct(x.m, 1), part: "S", orn: "octave", pedal: false, written: [] });
      });
      var label = o.tag + ", line " + (i + 1);
      if (o.solo) {
        var ps = phrase(C.plan, t, o.solo, label + ", the tune on its own stop", 1.6), pu = phrase(C.plan, t, o.under, label, 3);
        draws(C.plan, C.organist, t, o.solo);
        lay(ps, keys, { only: tuneOf(h), line: i, v: 1.05 }); lay(pu, keys, { only: underTune(h), line: i });
        if (regs.indexOf(o.solo) < 0) regs.push(o.solo);
        if (regs.indexOf(o.under) < 0) regs.push(o.under);
      } else {
        var pa = phrase(C.plan, t, rg, label, 4);
        draws(C.plan, C.organist, t, rg);
        lay(pa, keys, { line: i });
        if (regs.indexOf(rg) < 0) regs.push(rg);
      }
      if (C.style === "victorian" && o.breathe !== false) swell(C.plan, t + 0.2, (o.sw || 0.6) + (k === idx.length - 2 ? 0.25 : 0.1 * k / Math.max(1, idx.length - 1)), lineDur(L, b, nx) * 0.5);
      C.plan.counts.lines++;
      t += lineDur(L, b, nx) + (last ? 0 : C.lift * bs);
    });
    return { end: t, regs: regs };
  }
  // the beat of a line at dt seconds into it, on the organist's own clock
  // (a fermata's hold read as the beat it holds; near enough for figures)
  function lineBeatAt(line, bs, dt) { return Math.min(Math.max(0, dt / bs), Math.max(0, spanBeats(line) - 0.01)); }
  // the chord a line ends on, part by part, as the organ last held it
  function lineEndChord(h, line) {
    var v = {};
    ["S", "A", "T", "B"].forEach(function (p) { var ns = line.notes[p]; if (ns && ns.length) v[p] = mz(h.keyMonzo, ns[ns.length - 1].monzo); });
    if (!v.B) v.B = oct(v.T || v.S || h.keyMonzo, -1);
    ["S", "A", "T"].forEach(function (p) { if (!v[p]) v[p] = v.S || oct(v.B, 2); });
    return v;
  }
  // THE THEME: the hymn as written, a plain chorale — the plain organist on
  // the principal, the Victorian on the principal with his
  // suspensions and his swell, the improviser on the principal and the 4′;
  // a tenor tune (the Sacred Harp's) on the trumpet in the tenor
  VAR_PLAY.chorale = function (C, idx, t) {
    var h = C.h, R = C.R.fork("var:chorale"), st = C.style;
    var bs = h.beatS * C.tempo * (st === "plain" ? R.rnd(1.05, 1.15) : st === "victorian" ? R.rnd(1.1, 1.22) : R.rnd(1.0, 1.1));
    // DICE: the plain organist's theme is the principal, as printed — his
    // flutes are his dances'; the die is thrown all the same and its result
    // discarded (`void`), deliberately: a draw left out would move every
    // draw after it on this fork
    var regDie = R.rnd(0, 1), reg = st === "improviser" ? "principal & 4" : "hymn principal";
    void regDie;
    var rit = R.rnd(1.08, 1.2);
    swell(C.plan, t, st === "plain" ? 0.62 : 0.55, 0.05);
    var tenor = h.melodyPart !== "S";
    var r = scoreLines(C, idx, t, bs, reg, { rit: rit, tag: "the theme", solo: tenor ? "trumpet solo" : null, under: tenor ? "soft flutes" : null, sw: 0.55 });
    return { end: r.end, regs: r.regs, keys: [h.keyMonzo], beatS: bs, meter: h.modeOfTime };
  };
  // THE GRAND FINAL STATEMENT: the hymn again, broad, on the full organ —
  // the plain organist pulls it all out for the last time through; the
  // Victorian builds from the principal and the mixture to the full organ,
  // the tune doubled an octave up, and closes with the plagal amen; the
  // improviser doubles the tune and ends with a tone added high
  VAR_PLAY.finale = function (C, idx, t) {
    var h = C.h, R = C.R.fork("var:finale"), st = C.style;
    var bs = h.beatS * C.tempo * R.rnd(1.24, 1.42), rit = R.rnd(1.25, 1.45), holdB = R.rnd(2.6, 3.6);
    var amen = st === "victorian" && R.chance(0.7), added = R.pickW([["9/8", 1], ["5/3", 1]]);
    var build = st === "victorian" && idx.length > 1;
    swell(C.plan, t, build ? 0.62 : 0.85, 0.05);
    if (build) swell(C.plan, t + 0.5, 1, 5 * bs);
    var r = scoreLines(C, idx, t, bs, "full organ", { rit: rit, tag: "the finale", octave: st !== "plain", breathe: false,
                                                      regOf: build ? function (k) { return k === 0 ? "principal & mixture" : "full organ"; } : null });
    var end = r.end, lastL = C.lines[idx[idx.length - 1]], fin = lineEndChord(h, lastL), hold = holdB * bs * rit;
    if (amen) {
      var minor = !!MINOR[h.mode];
      var vIV = voiceChord({ root: mz(h.keyMonzo, frac("4/3")), q: minor ? "min" : "maj" }, fin);
      var vI = voiceChord({ root: h.keyMonzo, q: minor ? "min" : "maj" }, vIV);
      var pA = phrase(C.plan, end, "full organ", "the amen", 4);
      end = layChords(pA, [{ voicing: vIV, dur: 2 * bs * rit }, { voicing: vI, dur: hold }], end + 0.15 * bs, fin, { orn: "amen" });
      say(C.plan, C.organist, end - hold, "closes with the amen");
    } else {
      extendLast(C.plan, hold);
      if (st === "improviser") {
        var pX = phrase(C.plan, end - 0.2 * bs, "flutes 8 & 4", "a tone added high", 1);
        key(pX, end - 0.2 * bs, hold, near(mz(h.keyMonzo, frac(added)), 1350), "S", { v: 0.5, orn: "added" });
      }
      end += hold;
    }
    swell(C.plan, end - hold * 0.8, 0.55, hold * 0.7);
    return { end: end, regs: r.regs, keys: [h.keyMonzo], beatS: bs, meter: h.modeOfTime };
  };
  // THE TRIO: the tune in the pedals (the principal and a whisper of the
  // trumpet at 8′, the bourdon under it), and two lines above it on two
  // manuals — the Score's own inner parts, for the plain organist and the
  // Victorian (his with passing notes); for the improviser, running flutes
  // over the hymn's chords, and the alto held under them
  VAR_PLAY.trio = function (C, idx, t) {
    var h = C.h, R = C.R.fork("var:trio"), st = C.style, lines = C.lines, touch = STYLES[st].touch;
    var bs = h.beatS * C.tempo * R.rnd(0.95, 1.08), subK = R.pickW([[2, 0.6], [3, 0.4]]);
    var others = ["S", "A", "T", "B"].filter(function (p) { return p !== h.melodyPart && lines[idx[0]].notes[p] && lines[idx[0]].notes[p].length; });
    function meanOf(p) { var s = 0, n = 0; idx.forEach(function (i) { (lines[i].notes[p] || []).forEach(function (x) { s += cents(mz(h.keyMonzo, x.monzo)); n++; }); }); return n ? s / n : 0; }
    others.sort(function (a, b) { return meanOf(b) - meanOf(a); });
    var RH = others[0], LH = others[1] || null, lhUp = LH === "B";
    var tuneMean = meanOf(h.melodyPart), lhMean = LH ? meanOf(LH) + (lhUp ? 1200 : 0) : meanOf(RH) - 700;
    var shift = Math.floor((Math.min(-1000, lhMean - 900) - tuneMean) / 1200);
    if (tuneMean + 1200 * shift < -2300) shift++;
    var regR = st === "improviser" ? "figures" : "flutes 8 & 4", regL = st === "victorian" ? "soft flutes" : st === "improviser" ? "flutes 8 & 4" : "quiet flute";
    var pP = phrase(C.plan, t, "pedal tune", "the trio: the tune in the pedals", 1.5), pR = phrase(C.plan, t, regR, "the trio: the right hand", 2.2), pL = phrase(C.plan, t, regL, "the trio: the left hand", 2.2);
    draws(C.plan, C.organist, t, "pedal tune");
    say(C.plan, C.organist, t, "puts the tune in the pedals");
    swell(C.plan, t, 0.6, 0.05);
    var map = [], cur = 900;
    idx.forEach(function (i, k) {
      var L = lines[i], nx = lines[i + 1], keys = handsOn(h, L, nx, t, bs, touch), end = t + lineDur(L, bs, nx);
      if (st === "victorian") passing(keys, bs, R.fork("pass:" + i), 0.45, C.scale, C.plan, 3, h.melodyPart);
      keys.forEach(function (x) {
        if (x.part === h.melodyPart && !x.orn) {
          (x.written || []).forEach(function (e, j) { if (!j) key(pP, x.t, x.dur - 0.04, oct(x.m, shift), "B", { v: 1, pedal: true, line: i, beat: e.n.beat, deg: e.n.deg }); });
        }
      });
      if (st === "improviser") map.push({ t0: t, t1: end, line: L });
      else lay(pR, keys.filter(function (x) { return x.part === RH; }), { line: i });
      var lk = LH ? keys.filter(function (x) { return x.part === LH; }) : [];
      if (lhUp) lk = lk.map(function (x) { return { t: x.t, dur: x.dur, m: oct(x.m, 1), part: "T", orn: x.orn, written: x.written, pedal: false }; });
      lay(pL, lk.map(function (x) { x.pedal = false; return x; }), { line: i });
      C.plan.counts.lines++;
      t = end + (k < idx.length - 1 ? C.lift * bs : 0);
    });
    if (st === "improviser") map.forEach(function (M, k) {
      cur = figures(C.plan, pR, M.t0, M.t1, bs / subK, function (tt) { return chordClassesAt(h, M.line, Math.max(0, lineBeatAt(M.line, bs, tt - M.t0))); }, C.scale, R.fork("fig:" + k), { from: cur, lo: 350, hi: 1700 });
    });
    return { end: t, regs: [regR, regL, "pedal tune"], keys: [h.keyMonzo], beatS: bs, meter: h.modeOfTime };
  };
  // the tune of the chosen lines laid end to end on the organist's clock
  // → { notes: [{ t, dur, m, i (the line), n }], end }
  function tuneRun(C, idx, t, bs) {
    var h = C.h, out = [];
    idx.forEach(function (i, k) {
      var L = C.lines[i], nx = C.lines[i + 1];
      lineEvents(h, L, h.melodyPart, t, bs, nx).ev.forEach(function (e) { out.push({ t: e.t, dur: e.dur, m: mz(h.keyMonzo, e.n.monzo), i: i, n: e.n }); });
      t += lineDur(L, bs, nx) + (k < idx.length - 1 ? C.lift * bs : 0);
    });
    return { notes: out, end: t };
  }
  function soundAt(list, tt) { for (var i = 0; i < list.length; i++) if (list[i].t <= tt && list[i].t + list[i].dur > tt) return list[i]; return null; }
  // how much two strands grate: the seconds both sound a second, a seventh
  // or a tritone apart (sampled every `step`)
  var HARSH = [[60, 250], [560, 640], [950, 1140]];
  function harshness(a, b, step, t0, t1) {
    var s = 0;
    for (var tt = t0; tt < t1; tt += step) {
      var x = soundAt(a, tt), y = soundAt(b, tt);
      if (!x || !y) continue;
      var d = Math.abs(cents(x.m) - cents(y.m)) % 1200;
      if (HARSH.some(function (r) { return d >= r[0] && d <= r[1]; })) s += step;
    }
    return s;
  }
  // THE CANON: the tune chasing itself — at the octave below for the plain
  // organist and the Victorian, at the fifth or the fourth below for the
  // improviser — over a tonic held in the pedal. The follower comes in one
  // to four beats behind: the organist tries each and keeps the one that
  // grates least (the improviser, now and then, the one after it)
  VAR_PLAY.canon = function (C, idx, t) {
    var h = C.h, R = C.R.fork("var:canon"), st = C.style;
    var bs = h.beatS * C.tempo * R.rnd(0.95, 1.06), second = R.chance(0.35), ivU = R.rnd(0, 1);
    var ivs = st === "improviser" ? [["at the fifth below", [1, -1, 0, 0]], ["at the fourth below", [-2, 1, 0, 0]]] : [["at the octave below", [-1, 0, 0, 0]]];
    var iv = ivs[Math.min(ivs.length - 1, Math.floor(ivU * ivs.length))];
    var run = tuneRun(C, idx, t, bs);
    var cands = [1, 2, 3, 4].map(function (d) {
      var f = run.notes.map(function (x) { return { t: x.t + d * bs, dur: x.dur, m: mz(x.m, iv[1]), i: x.i, n: x.n }; });
      return { d: d, f: f, harsh: harshness(run.notes, f, bs / 4, t + d * bs, run.end) };
    }).sort(function (a, b) { return a.harsh - b.harsh || a.d - b.d; });
    var pick = st === "improviser" && second ? cands[1] : cands[0], lag = pick.d * bs;
    var regA = st === "victorian" ? "hymn principal" : "flutes 8 & 4", regB = st === "plain" ? "quiet flute" : st === "victorian" ? "flutes 8 & 4" : "trumpet";
    var pA = phrase(C.plan, t, regA, "the canon: the tune", 1.6), pB = phrase(C.plan, t + lag, regB, "the canon: the tune again, " + iv[0], 1.6);
    var pP = phrase(C.plan, t, "soft flutes", "the canon: the tonic in the pedal", 1);
    draws(C.plan, C.organist, t, regA);
    say(C.plan, C.organist, t + lag, "sets the tune in canon", { interval: iv[0], lag: pick.d });
    swell(C.plan, t, 0.58, 0.05);
    var lastA = run.notes[run.notes.length - 1], lastB = pick.f[pick.f.length - 1];
    run.notes.forEach(function (x) { key(pA, x.t, x === lastA ? x.dur + lag : x.dur, x.m, "S", { v: 1, line: x.i, beat: x.n.beat, deg: x.n.deg }); });
    pick.f.forEach(function (x) {
      var m = x.m;
      // (a canon at the fifth or the fourth ends on the nearest tone of the
      // tonic chord, not on the tune's last note moved)
      if (x === lastB && ivs.length > 1) {
        m = ["1/1", MINOR[h.mode] ? "6/5" : "5/4", "3/2"].map(function (f) { return near(cls(mz(h.keyMonzo, frac(f))), cents(x.m)); })
          .reduce(function (a, b) { return Math.abs(cents(b) - cents(x.m)) < Math.abs(cents(a) - cents(x.m)) ? b : a; });
      }
      key(pB, x.t, x.dur, m, "T", { v: 0.95, line: x.i, beat: x.n.beat, deg: x.n.deg, orn: "canon" });
    });
    var end = run.end + lag;
    key(pP, t, end - t, near(cls(h.keyMonzo), -1500), "B", { v: 0.8, pedal: true, pedalOnly: true, orn: "pedalpoint" });
    return { end: end + 0.3 * bs, regs: [regA, regB, "soft flutes"], keys: [h.keyMonzo], beatS: bs, meter: h.modeOfTime, lag: pick.d, interval: iv[0], harsh: +pick.harsh.toFixed(2) };
  };
  // TWO KEYS HEARD: a set of pitches (cents) that no one just major scale
  // holds (every tone within 25 c of a degree, re at 9/8 or 10/9) is heard
  // in two keys; → the share of the sampled moments with two or more tones
  // sounding that are so (A, B: [{t, dur, m}])
  var MAJ_CENTS = ["1/1", "9/8", "10/9", "5/4", "4/3", "3/2", "5/3", "15/8"].map(function (f) { return cents(frac(f)); });
  function pcOf(c) { return ((c % 1200) + 1200) % 1200; }
  function inMajor(c, tonic) { var d = pcOf(c - tonic); return MAJ_CENTS.some(function (x) { var e = Math.abs(d - x); return e < 25 || e > 1175; }); }
  function oneKey(cs) {
    for (var i = 0; i < cs.length; i++) for (var j = 0; j < MAJ_CENTS.length; j++) {
      var tn = cs[i] - MAJ_CENTS[j];
      if (cs.every(function (c) { return inMajor(c, tn); })) return true;
    }
    return false;
  }
  function twoKeyShare(A, B, t0, t1, step) {
    var on = 0, bi = 0;
    for (var tt = t0; tt < t1; tt += step) {
      var cs = [];
      [A, B].forEach(function (L) { L.forEach(function (x) { if (x.t <= tt && x.t + x.dur > tt) cs.push(cents(x.m)); }); });
      if (cs.length < 2) continue;
      on++;
      if (!oneKey(cs)) bi++;
    }
    return on ? bi / on : 0;
  }

  // THE INTERLUDE IN TWO KEYS (Ives's joke): above, the hymn in its own key
  // — the tune and the two parts under it — on a bright stop; below, the
  // tune again in ANOTHER key, a beat or three behind (a canon in two keys,
  // as Ives set it), with that key's own bass under it in the pedal: two
  // keys, each whole in itself, sounding together. The second key is Ives's
  // own for the plain organist and the Victorian (a major third down, most
  // often: his F against D♭), and the improviser's own stray key for him.
  // The lag is the one that grates MOST (the canon's search, turned round:
  // the joke must be heard); the plain organist plays it as printed, two
  // beats. One line or two, then both keys' last chords together, and the
  // next variation comes home.
  VAR_PLAY.bitonal = function (C, idx, t) {
    var h = C.h, R = C.R.fork("var:bitonal"), st = C.style, lines = C.lines, touch = STYLES[st].touch;
    idx = idx.slice(0, 2);
    var bs = h.beatS * C.tempo * R.rnd(1.0, 1.12);
    var ivesKey = R.pickW([["4/5", 3], ["5/4", 1], ["16/15", 0.6], ["45/32", 0.6]]);
    var kx = st === "improviser" ? C.organist.habits.strayKey : frac(ivesKey), keyB = mz(h.keyMonzo, kx);
    var upper = [h.melodyPart].concat(["S", "A", "T"].filter(function (p) { return p !== h.melodyPart && lines[idx[0]].notes[p] && lines[idx[0]].notes[p].length; }).slice(0, 2));
    var bassP = lines[idx[0]].notes.B && lines[idx[0]].notes.B.length && upper.indexOf("B") < 0 ? "B" : null;
    var run = tuneRun(C, idx, t, bs);
    // the hymn's own key, as it will sound (for the search below)
    var upEv = [], bev0 = [], mid = [], tq = t, midP = upper[1] || null;
    idx.forEach(function (i, k) {
      var L = lines[i], nx = lines[i + 1];
      upper.forEach(function (p) { lineEvents(h, L, p, tq, bs, nx).ev.forEach(function (e) { upEv.push({ t: e.t, dur: e.dur, m: mz(h.keyMonzo, e.n.monzo) }); }); });
      if (midP) lineEvents(h, L, midP, tq, bs, nx).ev.forEach(function (e) { mid.push({ t: e.t, dur: e.dur, m: mz(h.keyMonzo, e.n.monzo), i: i, n: e.n }); });
      if (bassP) lineEvents(h, L, bassP, tq, bs, nx).ev.forEach(function (e) { bev0.push({ e: e, i: i }); });
      tq += lineDur(L, bs, nx) + (k < idx.length - 1 ? C.lift * bs : 0);
    });
    // THE SEARCH: the style's own second key and lag, kept if the two keys
    // are heard (at least 30 % of the moments with two tones sounding);
    // else the other keys, and the most bitonal of them
    // (the other key's tune, and the part under it in that key too, so that
    // each key sounds a whole chord of its own)
    function lowerOf(k) {
      var s2 = Math.round((-1300 - cents(k)) / 1200);
      return run.notes.concat(mid).map(function (x, j) { return { t: x.t, dur: x.dur, m: oct(mz(x.m, k), s2), i: x.i, n: x.n, mid: j >= run.notes.length }; });
    }
    function trial(k, d) {
      var f = lowerOf(k).map(function (x) { return { t: x.t + d * bs, dur: x.dur, m: x.m }; });
      bev0.forEach(function (b) { f.push({ t: b.e.t + d * bs, dur: b.e.dur, m: mz(mz(h.keyMonzo, b.e.n.monzo), k) }); });
      return { k: k, d: d, two: twoKeyShare(upEv, f, t, run.end + d * bs, bs / 2) };
    }
    var dLags = st === "plain" ? [2] : [1, 2, 3], pref = dLags.map(function (d) { return trial(kx, d); }).sort(function (a, b) { return b.two - a.two || a.d - b.d; })[0];
    if (pref.two < 0.3) {
      ["4/5", "5/4", "16/15", "45/32", "6/5"].forEach(function (f) {
        dLags.forEach(function (d) { var x = trial(frac(f), d); if (x.two > pref.two + 0.05) pref = x; });
      });
    }
    kx = pref.k; keyB = mz(h.keyMonzo, kx);
    var lower = lowerOf(kx);
    var dly = pref.d, lag = dly * bs;
    var regU = st === "improviser" ? "glass" : "flutes 8 & 4", regL = st === "plain" ? "hymn principal" : st === "victorian" ? "trumpet" : "principal & 4";
    var pU = phrase(C.plan, t, regU, "the interlude: the hymn in its own key", 2.5), pL = phrase(C.plan, t + lag, regL, "the interlude: the tune in another key", 1.6);
    var pB = phrase(C.plan, t + lag, "soft flutes", "the interlude: the other key's bass", 1);
    draws(C.plan, C.organist, t, regU);
    say(C.plan, C.organist, t + lag, "plays the tune in two keys at once", { second: kx });
    swell(C.plan, t, 0.45, 0.05);
    var tt = t, bm = 0, bn = 0, bev = [];
    idx.forEach(function (i, k) {
      var L = lines[i], nx = lines[i + 1], keys = handsOn(h, L, nx, tt, bs, touch);
      lay(pU, keys.filter(function (x) { return upper.indexOf(x.part) >= 0; }).map(function (x) { x.pedal = false; return x; }), { line: i });
      if (bassP) lineEvents(h, L, bassP, tt, bs, nx).ev.forEach(function (e) { bev.push({ e: e, i: i }); bm += cents(mz(h.keyMonzo, e.n.monzo)); bn++; });
      tt += lineDur(L, bs, nx) + (k < idx.length - 1 ? C.lift * bs : 0);
    });
    var hold = 1.5 * bs;
    var lastTune = run.notes.length - 1, lastMid = lower.length - 1;
    lower.forEach(function (x, j) {
      key(pL, x.t + lag, j === lastTune || (x.mid && j === lastMid) ? x.dur + hold : x.dur, x.m, x.mid ? "A" : "T", { v: x.mid ? 0.75 : 0.95, line: x.i, beat: x.n.beat, deg: x.n.deg, orn: "bitonal" });
    });
    var sB = Math.round((-1700 - (bm / Math.max(1, bn) + cents(kx))) / 1200);
    bev.forEach(function (b, j) {
      key(pB, b.e.t + lag, j === bev.length - 1 ? b.e.dur + hold : b.e.dur, oct(mz(mz(h.keyMonzo, b.e.n.monzo), kx), sB), "B",
          { v: 0.85, pedal: true, pedalOnly: true, line: b.i, beat: b.e.n.beat, deg: b.e.n.deg, orn: "bitonal" });
    });
    // the hymn's key holds its last chord while the other key catches up —
    // and each key's last chord is a whole one, its third sounded (a bare
    // fifth in each key, a third apart, would be heard as one key's chord)
    pU.notes.forEach(function (n) { if (Math.abs(pU.t + n.at + n.dur - run.end) < 0.4) n.dur = r3(n.dur + lag + 0.5 * bs); });
    var third = frac(MINOR[h.mode] ? "6/5" : "5/4"), lastU = run.notes[run.notes.length - 1];
    key(pU, lastU.t, run.end - lastU.t + lag + 0.5 * bs, near(cls(mz(h.keyMonzo, third)), cents(lastU.m) - 250), "A", { v: 0.7, orn: "bitonal" });
    var lastL = lower[run.notes.length - 1];
    key(pL, lastL.t + lag, run.end - lastL.t + hold, near(cls(mz(keyB, third)), cents(lastL.m) + 250), "A", { v: 0.7, orn: "bitonal" });
    var end = run.end + lag + hold;
    return { end: end + 0.4 * bs, regs: [regU, regL].concat(bassP ? ["soft flutes"] : []), keys: [h.keyMonzo, keyB], beatS: bs, meter: h.modeOfTime,
             lag: dly, second: kx, lines: idx, twoKeys: +pref.two.toFixed(3) };
  };
  // A DANCE: the tune re-barred (rebar), the bass in the pedal and the left
  // hand's chords in the dance's own pattern — per bar, [beat, length,
  // "root" | "fifth" | "chord", tones] — and the line's last bar its close.
  // cfg: { dance, q (s a dance beat), regM, regA, pattern, close, touch(d),
  // minor, vamp (bars of the pattern on the first chord before the tune),
  // added (a class added to the off-beat chords: the improviser's sixth), v }
  function dance(C, idx, t, cfg, label) {
    var h = C.h, lines = C.lines, D = DANCE[cfg.dance], q = cfg.q, key0 = h.keyMonzo;
    var scaleM = cfg.minor ? scaleOf("aeolian", key0) : C.scale;
    var pm = phrase(C.plan, t, cfg.regM, label + ": the tune", 1.6), pa = phrase(C.plan, t, cfg.regA, label + ": the bass and the chords", 3);
    draws(C.plan, C.organist, t, cfg.regM);
    var bassPrev = null, lhPrev = null;
    function harmony(L, ob) {
      var H = heard(h, L, ob);
      H.dom = dominantOf(key0, H);
      if (!cfg.minor) return H;
      var cl = [];
      H.classes.forEach(function (c) { var x = cls(minorM(key0, c, H.dom)); if (!cl.some(function (o) { return eq(o, x); })) cl.push(x); });
      return { classes: cl, root: cls(minorM(key0, H.root, H.dom)), bass: minorM(key0, H.bass, H.dom), dom: H.dom, chord: H.chord };
    }
    function bar(at, pat, H, top, lastBar, limit) {
      pat.forEach(function (ev) {
        if (ev[0] >= limit - 1e-6) return;
        var st = at + ev[0] * q, du = Math.min(ev[1], limit - ev[0]) * q, Hx = typeof H === "function" ? H(ev[0]) : H;
        if (ev[2] === "root" || ev[2] === "fifth") {
          var m = bassNote(ev[2] === "fifth" ? fifthOf(Hx) : Hx.root, bassPrev);
          bassPrev = cents(m);
          key(pa, st, du, m, "B", { v: 0.85, pedal: true, orn: "acc" });
        } else {
          var cl = cfg.added && !lastBar ? Hx.classes.concat([cls(mz(Hx.root, cfg.added))]) : Hx.classes;
          var ch = leftHand(cl, Hx.root, typeof top === "function" ? top(ev[0]) : top, ev[3] || 2, lhPrev);
          if (ch.length) lhPrev = ch.reduce(function (a, m2) { return a + cents(m2); }, 0) / ch.length;
          ch.forEach(function (m2) { key(pa, st, du, m2, "A", { v: 0.6, orn: "acc" }); });
        }
      });
    }
    if (cfg.vamp) {
      var H0 = harmony(lines[idx[0]], 0), top0 = cents(tuneLine(h, lines[idx[0]])[0].m);
      for (var vb = 0; vb < cfg.vamp; vb++) bar(t + vb * D.bar * q, cfg.pattern, H0, top0, false, D.bar);
      t += cfg.vamp * D.bar * q - pickBeats(h, lines[idx[0]], cfg.dance) * q;
    }
    idx.forEach(function (i, k) {
      var L = lines[i], np = k < idx.length - 1 ? pickBeats(h, lines[idx[k + 1]], cfg.dance) : 0, rb = rebar(h, L, cfg.dance, np), mel = [];
      rb.notes.forEach(function (e) {
        var H = harmony(L, e.x.b), m = cfg.minor ? minorM(key0, e.x.m, H.dom) : e.x.m;
        m = snap(m, H.classes);
        if (e.fem) m = stepOf(scaleM, m, 1);
        mel.push({ b: e.b, d: e.d, m: m });
        key(pm, t + e.b * q, e.d * q * cfg.touch(e.d), m, "S", { v: cfg.v || 1, line: i, deg: e.x.n.deg, orn: e.fem ? "app" : null });
      });
      function topAt(beta) { var c = 1200; mel.forEach(function (x) { if (x.b <= beta + 1e-6 && x.b + x.d > beta + 1e-6) c = cents(x.m); }); return c; }
      for (var bb = rb.pick; bb < rb.beats - 1e-6; bb += D.bar) {
        var lastBar = bb + D.bar >= rb.beats - 1e-6;
        (function (b0) { bar(t + b0 * q, lastBar ? cfg.close : cfg.pattern, function (beta) { return harmony(L, origAt(rb, b0 + beta)); }, function (beta) { return topAt(b0 + beta); }, lastBar, rb.beats - b0); })(bb);
      }
      C.plan.counts.lines++;
      t += rb.beats * q;
    });
    return t;
  }
  // THE MINUET: in three, graceful and detached — the bass on the downbeat,
  // two soft chords after it. The plain organist on the flutes; the
  // Victorian's tune on the vox humana over trembling flutes; the
  // improviser's on the mixture alone, glassy and high
  VAR_PLAY.minuet = function (C, idx, t) {
    var R = C.R.fork("var:minuet"), st = C.style;
    var q = st === "plain" ? R.rnd(0.5, 0.56) : st === "victorian" ? R.rnd(0.46, 0.52) : R.rnd(0.42, 0.5);
    var regM = st === "plain" ? "flutes 8 & 4" : st === "victorian" ? "vox solo" : "glass", regA = st === "victorian" ? "flutes, trembling" : st === "plain" ? "quiet flute" : "flutes 8 & 4";
    swell(C.plan, t, st === "victorian" ? 0.5 : 0.56, 0.05);
    say(C.plan, C.organist, t, "turns the tune into a minuet");
    var end = dance(C, idx, t, {
      dance: "minuet", q: q, regM: regM, regA: regA,
      pattern: [[0, 0.85, "root"], [1, 0.42, "chord", 2], [2, 0.42, "chord", 2]], close: [[0, 2.6, "root"], [0, 2.6, "chord", 3]],
      touch: function (d) { return d >= 2 ? 0.94 : d >= 1 ? 0.7 : 0.9; }, v: 1,
    }, "the minuet");
    return { end: end + 0.5 * q, regs: [regM, regA], keys: [C.h.keyMonzo], beatS: q, meter: "3/4" };
  };
  // THE POLONAISE: in three, stately, in the minor (a minor hymn stays in its
  // own) — the left hand in the dance's own rhythm, an eighth and two
  // sixteenths and four eighths, and each line closing on the second beat
  VAR_PLAY.polonaise = function (C, idx, t) {
    var R = C.R.fork("var:polonaise"), st = C.style, q = R.rnd(0.56, 0.66);
    var regM = st === "plain" ? "hymn principal" : st === "victorian" ? "trumpet" : "principal & mixture", regA = st === "victorian" ? "principal & 4" : "flutes 8 & 4";
    var minor = !MINOR[C.h.mode];
    swell(C.plan, t, 0.62, 0.05);
    say(C.plan, C.organist, t, "turns the tune into a polonaise" + (minor ? " (in the minor)" : ""));
    var P = 3;
    var end = dance(C, idx, t, {
      dance: "polonaise", q: q, regM: regM, regA: regA, minor: minor,
      pattern: [[0, 0.85, "root"], [0, 0.3, "chord", P], [0.5, 0.17, "chord", P], [0.75, 0.17, "chord", P], [1, 0.3, "chord", P], [1.5, 0.3, "chord", P], [2, 0.3, "chord", P], [2.5, 0.3, "chord", P]],
      close: [[0, 0.9, "root"], [0, 0.45, "chord", P], [1, 1.7, "chord", P], [1, 1.7, "root"]],
      touch: function (d) { return d >= 2 ? 0.94 : d <= 0.25 ? 0.85 : 0.8; }, v: 1,
    }, "the polonaise");
    return { end: end + 0.6 * q, regs: [regM, regA], keys: [C.h.keyMonzo], beatS: q, meter: "3/4", minor: minor };
  };
  // THE MARCH: in two, brisk — the pedal's oom-pah (the root, then the
  // fifth), chords on the off-beats, two bars of it alone to step off. The
  // Victorian's tune on the trumpet; the improviser's off-beats carry an
  // added sixth, a country band's harmony
  VAR_PLAY.march = function (C, idx, t) {
    var R = C.R.fork("var:march"), st = C.style, q = R.rnd(0.46, 0.54), vamp = R.pickW([[2, 3], [1, 1], [0, 1]]);
    var regM = st === "plain" ? "hymn principal" : st === "victorian" ? "trumpet solo" : "trumpet", regA = st === "victorian" ? "principal & 4" : st === "plain" ? "flutes 8 & 4" : "sixteen & four";
    swell(C.plan, t, 0.66, 0.05);
    say(C.plan, C.organist, t, "turns the tune into a march");
    var end = dance(C, idx, t, {
      dance: "march", q: q, regM: regM, regA: regA, vamp: vamp, added: st === "improviser" ? frac("5/3") : null,
      pattern: [[0, 0.5, "root"], [0.5, 0.24, "chord", 2], [1, 0.5, "fifth"], [1.5, 0.24, "chord", 2]], close: [[0, 1.3, "root"], [0, 1.3, "chord", 3]],
      touch: function (d) { return d >= 1.5 ? 0.86 : d >= 1 ? 0.8 : d >= 0.5 ? 0.74 : 0.66; }, v: 1,
    }, "the march");
    return { end: end + 0.5 * q, regs: [regM, regA], keys: [C.h.keyMonzo], beatS: q, meter: "2/4" };
  };
  function wpick(u, pairs) {
    var tot = 0; pairs.forEach(function (p) { tot += p[1]; });
    var x = u * tot;
    for (var i = 0; i < pairs.length; i++) { x -= pairs[i][1]; if (x <= 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  var VAR_SAYS = { chorale: "plays the hymn as a plain chorale", finale: "gives the hymn on the full organ" };
  function variations(organist, h, stream, opts) {
    opts = opts || {};
    var style = STYLES[organist.style] ? organist.style : "plain", pool = VAR_POOL[style];
    var plan = newPlan("variations", organist, h), R = stream.fork("variations:" + style);
    // DICE: every die first, whether or not opts names the count or the
    // characters — deliberate; a draw left out would move every draw after it
    var dCount = R.rnd(0, 1), dPick = [R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1)], dLen = R.rnd(0, 1), dIntro = R.rnd(0, 1);
    var gaps = [0, 1, 2, 3, 4, 5, 6].map(function () { return R.rnd(0.9, 1.5); });
    var lo = opts.lo || 105, hi = opts.hi || 165, target = lo + (hi - lo) * dLen;
    var count = Math.max(3, Math.min(5, opts.count || wpick(dCount, pool.count))), chars;
    if (opts.characters && opts.characters.length) chars = opts.characters.filter(function (c) { return VAR_PLAY[c]; });
    else {
      var mids = (pool.always || []).slice(), w = {}, k = 0;
      Object.keys(pool.w).forEach(function (c) { w[c] = pool.w[c]; });
      while (mids.length < count - 2 && Object.keys(w).length) {
        var id = wpick(dPick[k++], Object.keys(w).map(function (c) { return [c, w[c]]; }));
        mids.push(id); delete w[id];
      }
      mids.sort(function (a, b) { return VAR_CHARS[a].order - VAR_CHARS[b].order; });
      chars = ["chorale"].concat(mids.slice(0, count - 2)).concat(["finale"]);
    }
    var C = { plan: plan, organist: organist, h: h, style: style, R: R, lines: verseLinesOf(h), scale: scaleOf(h.mode, h.keyMonzo),
              tempo: organist.habits && organist.habits.tempo || 1, lift: 0.4 };
    var sets = lineSets(C.lines.length), shares = 0;
    chars.forEach(function (c) { shares += VAR_CHARS[c].share; });
    // the organist's way in: the Victorian's first chord swelling, the
    // improviser's flutes running on it; the plain organist begins
    var t = 0;
    if (style !== "plain" && dIntro < (style === "victorian" ? 0.6 : 0.5)) {
      var first = handsOn(h, C.lines[0], C.lines[1], 0, h.beatS * 1.2, STYLES[style].touch).filter(function (x) { return x.t < 0.01; });
      var introS = h.beatS * 1.2 * (style === "victorian" ? 2.6 : 3);
      var pi = phrase(plan, 0, style === "victorian" ? "hymn principal" : "figures", "the way in", 4);
      draws(plan, organist, 0, pi.reg);
      if (style === "victorian") first.forEach(function (x) { key(pi, 0, introS, x.m, x.part, { v: VPART[x.part], pedal: x.pedal, orn: "intro" }); });
      else figures(plan, pi, 0, introS, h.beatS * 1.2 / 3, function () { return chordClassesAt(h, C.lines[0], 0); }, C.scale, R.fork("intro"), { lo: 300, hi: 1500 });
      swell(plan, 0, 0.2, 0.05); swell(plan, 0.1, 0.6, introS * 0.8);
      section(plan, 0, introS, style === "victorian" ? "the way in: the first chord, the swell opening on it" : "the way in: the flutes running on the first chord");
      t = introS + 0.4 * h.beatS;
    }
    say(plan, organist, t, "plays variations on the hymn", { characters: chars.slice() });
    plan.variations = [];
    var nVar = 0;
    chars.forEach(function (c, ci) {
      var budget = target * VAR_CHARS[c].share / shares, best = null;
      // the lines that fit its share (tried on a scratch plan, the same dice)
      for (var si = 0; si < sets.length; si++) {
        var scratch = newPlan("scratch", organist, h), SC = {};
        for (var q in C) SC[q] = C[q];
        SC.plan = scratch;
        var d = VAR_PLAY[c](SC, sets[si], 0).end;
        if (!best || d < best.d) best = { d: d, idx: sets[si] };
        if (d <= budget * 1.25) { best = { d: d, idx: sets[si] }; break; }
      }
      var p0 = plan.phrases.length, r = VAR_PLAY[c](C, best.idx, t);
      var vd = VAR_DYN_STYLE[style] && VAR_DYN_STYLE[style][c] != null ? VAR_DYN_STYLE[style][c] : VAR_DYN[c];
      if (vd) plan.phrases.slice(p0).forEach(function (p) { p.dyn = (p.dyn || 0) + vd; });
      var name = c === "chorale" ? "the theme" : c === "finale" ? "the finale" : c === "bitonal" ? "an interlude" : "variation " + (++nVar);
      var what = name + ": " + VAR_CHARS[c].en + " (" + r.regs.join("; ") + ")" + (c === "bitonal" ? " — the tune in two keys" : "");
      section(plan, t, r.end, what);
      if (VAR_SAYS[c]) say(plan, organist, t, VAR_SAYS[c]);
      var rec = { id: c, name: name, en: VAR_CHARS[c].en, t: r3(t), end: r3(r.end), regs: r.regs, keys: r.keys, lines: r.lines || best.idx, beatS: r3(r.beatS), meter: r.meter };
      ["lag", "interval", "harsh", "second", "minor", "twoKeys"].forEach(function (x) { if (r[x] != null) rec[x] = r[x]; });
      plan.variations.push(rec);
      t = r.end + (ci < chars.length - 1 ? gaps[ci] * h.beatS : 0);
    });
    plan.characters = chars;
    plan.liftDb = VAR_LIFT[style];
    plan.manner = chars.map(function (c) { return c; }).join(", ");
    plan.beatS = r3(h.beatS);
    return finish(plan, t);
  }

  // ==========================================================================
  // MEASURE AND DESCRIBE — for the lab and the tools
  // ==========================================================================
  // the ornaments that are decoration (not the modulation's chords, not an
  // intonation or a closing chord, not a pedal point)
  var DECOR = { susp: 1, app: 1, pass: 1, echo: 1, link: 1, fig: 1, seq: 1, quote: 1, arabesque: 1, strange: 1, added: 1 };
  function measure(plan) {
    var c = plan.counts, orn = 0, keys = 0, byOrn = {}, regs = {};
    plan.phrases.forEach(function (p) {
      regs[typeof p.reg === "string" ? p.reg : "custom"] = (regs[typeof p.reg === "string" ? p.reg : "custom"] || 0) + p.notes.length;
      p.notes.forEach(function (n) { keys++; if (n.orn) byOrn[n.orn] = (byOrn[n.orn] || 0) + 1; if (DECOR[n.orn]) orn++; });
    });
    var mins = Math.max(1e-6, plan.dur / 60);
    return {
      kind: plan.kind, style: plan.style, seconds: plan.dur, accompanied: plan.accompanied !== false,
      lines: c.lines, joins: c.joins, fills: c.fills, strange: c.strange, fillRate: c.joins ? r3(c.fills / c.joins) : 0,
      ornamentKeys: orn, ornamentShare: keys ? r3(orn / keys) : 0, ornamentsPerLine: c.lines ? r3(orn / c.lines) : 0, byOrnament: byOrn,
      suspensions: c.susp, appoggiaturas: c.app, passing: c.pass, keys: keys, keysPerMinute: Math.round(keys / mins),
      registrations: regs, regChanges: c.regs, swellMoves: c.swells, fillKinds: plan.fills.map(function (f) { return f.kind + (f.strange ? "!" : ""); }),
      verseDyn: (plan.verseDyn || []).map(function (v) { return v.reg + (v.dyn ? " " + (v.dyn > 0 ? "+" : "") + v.dyn + " dB" : ""); }),
    };
  }
  function describe(plan) {
    var out = [];
    plan.sections.forEach(function (s) { out.push(fmt(s.t) + "–" + fmt(s.end) + "  " + s.what); });
    return out;
    function fmt(x) { var m = Math.floor(x / 60), s = x - 60 * m; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  }

  // ==========================================================================
  // THE PERFORMER — a plan laid onto an organ, a few seconds ahead
  // ==========================================================================
  // perform(organ, plan, t0, o) → { pump(now, ahead), until, done() }
  //   organ: a KOLOB.VoicesOrgan instance (one per meeting is enough)
  //   o: { keynoteHz, onNote(layer, freq, startTime, dur, extra), onEvent(e), hymnId, layer }
  // pump(now) schedules every key, swell move and log line that begins
  // before now + ahead (default 3 s) — call it from the clock's lane or a
  // timer; it returns true when the plan is all laid. Nothing is read from
  // the audio clock here: `now` is the caller's scheduled time.
  // A PHRASE IS LAID IN PIECES: each pump puts
  // down only the keys that speak before the horizon, so a long phrase — the
  // improviser's running figures, 181–231 keys, and the tune under them in
  // the pedals — reaches the organ a few seconds at a time, not a thousand
  // nodes in one pump at its first note (the phones). A phrase's first piece
  // draws its stops and its tremulant, at the phrase's own time, exactly as
  // a whole phrase did; its later pieces leave the tremulant be. Its written
  // notes are reported piece by piece with its keys.
  function perform(organ, plan, t0, o) {
    o = o || {};
    var K0 = o.keynoteHz || 261.63, layer = o.layer || "organ";
    var ph = plan.phrases.slice(), sw = plan.swell.slice(), ev = plan.events.slice(), i = 0, j = 0, k = 0, open = [];
    function hz(m) { return K0 * ratio(m); }
    function byAt(a, b) { return a.at - b.at; }                  // stable: a chord keeps its order
    function tell(P, r) {
      var x = { part: r.part, monzo: r.m };
      if (plan.hymnId || o.hymnId) x.hymnId = o.hymnId || plan.hymnId;
      if (r.line != null) x.line = r.line;
      if (r.beat != null) x.beat = r.beat;
      if (r.deg != null) x.deg = r.deg;
      if (r.orn) x.orn = r.orn;
      x.organist = plan.style;
      // (the pedal's 16′, where the registration has one, is a
      // note of its own — the caller reports the doubling; a key the feet
      // alone hold sounds no manual pipe)
      if (r.pedal && (P.reg.bourdon16 || 0) > 0) x.pedal = true;
      if (r.pedalOnly) x.pedalOnly = true;
      o.onNote(layer, hz(r.m), P.tp + r.at, r.dur, x);
    }
    function lay(P, lim) {
      var a0 = P.a;
      while (P.a < P.notes.length && P.notes[P.a].at <= lim) P.a++;
      if (P.a > a0) {
        var g = P.g;
        organ.play(P.tp, P.notes.slice(a0, P.a).map(function (n) {
          return { f: hz(n.m), dur: n.dur, at: n.at, v: n.v * g, pedal: !!n.pedal, pedalOnly: !!n.pedalOnly };
        }), P.reg, { texture: P.p.texture, trem: P.first });
        P.first = false;
      }
      while (P.b < P.rep.length && P.rep[P.b].at <= lim) { if (o.onNote) tell(P, P.rep[P.b]); P.b++; }
    }
    function done() { return i >= ph.length && !open.length && j >= sw.length && k >= ev.length; }
    function pump(now, ahead) {
      var horizon = now + (ahead == null ? 3 : ahead);
      while (j < sw.length && t0 + sw[j].t <= horizon) { organ.setSwell(sw[j].e, t0 + sw[j].t, sw[j].ramp); j++; }
      // the phrases already sounding first (keys go down in time order, so
      // the organ's touch finds every key that is down), then those that
      // begin: their first piece at once, at least its first chord — the
      // stops and the tremulant are drawn in the order the phrases begin
      open.forEach(function (Q) { lay(Q, horizon - Q.tp); });
      while (i < ph.length && t0 + ph[i].t <= horizon) {
        var p = ph[i++], tp = t0 + p.t;
        var P = { p: p, tp: tp, reg: regOf(p.reg), a: 0, b: 0, first: true, notes: p.notes.slice().sort(byAt), rep: p.report.slice().sort(byAt),
                  g: Math.pow(10, ((p.trim != null ? p.trim : trimOf(p.reg)) + (p.dyn || 0) + (plan.liftDb || 0)) / 20) };
        lay(P, Math.max(horizon - tp, P.notes.length ? P.notes[0].at : 0));
        open.push(P);
      }
      open = open.filter(function (Q) { return Q.a < Q.notes.length || Q.b < Q.rep.length; });
      while (k < ev.length && t0 + ev[k].t <= horizon) {
        var e = {}, src = ev[k++];
        for (var q in src) e[q] = src[q];
        e.t = t0 + src.t;
        if (o.onEvent) o.onEvent(e);
      }
      return done();
    }
    return { pump: pump, until: t0 + plan.dur, done: done };
  }

  return {
    ORGAN_GAIN: ORGAN_GAIN, STYLES: STYLES, REG: REG, REG_TRIM: REG_TRIM, ROSTER: ROSTER, STRAY_KEYS: STRAY_KEYS,
    seat: seat, preludeDraw: preludeDraw, prelude: prelude, accompany: accompany, modulate: modulate, hymnHands: hymnHands,
    // the organist's variations on a hymn, the guest's (kolob-guest-variations.js)
    variations: variations, VAR_CHARS: VAR_CHARS, VAR_POOL: VAR_POOL, VAR_LIFT: VAR_LIFT, VAR_DYN: VAR_DYN, rebar: rebar,
    measure: measure, describe: describe, perform: perform, regOf: regOf,
    lineEvents: lineEvents, lineDur: lineDur, breathOf: breathOf, verseLines: verseLinesOf, accompanied: accompaniedDialect,
    // pure hands, for the lab and the harness
    keyChords: keyChords, voiceChord: voiceChord, scaleOf: scaleOf, cents: cents, ratio: ratio,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-organist.js"] = true;   // the load guard's roll call
