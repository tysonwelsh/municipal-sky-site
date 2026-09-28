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
//       info: { trombones, withheld, organSits, hymn }    (a draw; refusals are listed)
//   prelude(organist, hymn, stream, opts) → Plan   (30–50 s on the day's first hymn)
//   accompany(organist, hymn, stream, opts) → Plan (giving out, the verses under
//       the ward, fills between the lines, interludes between verses, the amen,
//       and a modulation by a common-tone pivot when opts.next's key differs)
//       opts: { verses (2), beatS (hymn.beatS), hymnIndex (0), next: {keyMonzo, mode} | null,
//               giveOut (true), accompanied (the dialect's own), amen (true) }
//   modulate(organist, from, to, stream, opts) → Plan (the pivot alone, for a joint)
//   measure(plan) → the rates a critic counts (fills per join, ornaments per line, …)
//   describe(plan) → plain words, one line per event
//   lineEvents(hymn, line, part, t0, beatS, next) / lineDur(line, beatS, next)
//       → THE CLOCK the ward must sing by (the organ plays by it)
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
// organ layer (0.40, v0.34); organist-lab measures every style's prelude and
// accompaniment against the engine's own organChord through the same layer,
// and they sit within ±2 LU of it (the owner found the organ "pretty loud";
// nothing here is louder than the organ he has now).
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Organist = (function () {
  "use strict";
  var K = window.KOLOB;

  // the gain an organist's organ is built with (VoicesOrgan.create opts.gain),
  // into the organ layer — calibrated in organist-lab against organChord
  var ORGAN_GAIN = 1.15;
  // the organ alone in the prelude plays a little forward (dB)
  var PRELUDE_LIFT = 1.3;

  // ==========================================================================
  // PITCH — exact, as monzos [2, 3, 5, 7] (SCORE §2), relative to the keynote
  // ==========================================================================
  function mz(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function oct(m, k) { return [m[0] + k, m[1], m[2], m[3] || 0]; }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function cents(m) { return 1200 * Math.log(ratio(m)) / Math.LN2; }
  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && (a[3] || 0) === (b[3] || 0); }
  function cls(m) { return oct(m, -Math.floor(cents(m) / 1200 + 1e-9)); }       // the octave-free class, [1, 2)
  function sameCls(a, b) { return eq(cls(a), cls(b)); }
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
  var REG_TRIM = {"soft flutes": 4.5, "quiet flute": 3.9, "flutes 8 & 4": 3.3, "hymn principal": 0.0, "principal & 4": 2.2, "vox humana": 2.9, 
    "vox & flutes": 2.3, "vox solo": 4.9, "flutes, trembling": 4.3, "echo flute": 5.9, "trumpet": 2.8, "trumpet solo": 3.8, "full organ": -1.5, 
    "principal & mixture": 1.2, "sixteen & four": 5.7, "glass": 6.5, "pedal tune": 2.6, "figures": 5.8 };
  function trimOf(reg) { return typeof reg === "string" && REG_TRIM[reg] != null ? REG_TRIM[reg] : 0; }
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
  function accompaniedDialect(dialect) {
    var D = K.Dialects && K.Dialects.get ? K.Dialects.get(dialect) : null;
    if (D && D.organ != null) return !!D.organ;
    return !UNACCOMPANIED[dialect];
  }

  // seat(stream, info) → the Sunday's organist. Every die is thrown first.
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
  function preludeDraw(organist, stream, info) {
    info = info || {};
    var R = stream.fork("organist:prelude"), roll = R.rnd(0, 1);
    var odds = organist.habits.prelude, why = null;
    if (!info.hymn) why = "no first hymn yet";
    else if (info.trombones) why = "the trombones play the first hymn at dawn";
    else if (info.withheld) why = "the day's tune is withheld until the doxology";
    else if (info.organSits) why = "the organ sits out this prelude (the brush arbor)";
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
  // a fermata holds its note and moves everything after it
  function clockOf(line, beatS) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  // one line, one part, from t0: every note as it is sung, ties joined, and
  // the breath taken out of the line's last note → { ev: [{t, dur, n}], end }
  function lineEvents(h, line, part, t0, beatS, next) {
    var clk = clockOf(line, beatS), len = spanBeats(line, next), ns = line.notes[part] || [], ev = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var st = t0 + clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);
      ev.push({ t: st, dur: dur, n: n });
    }
    return { ev: ev, end: t0 + lineDur(line, beatS, next) };
  }
  function lineDur(line, beatS, next) {
    return clockOf(line, beatS)(spanBeats(line, next)) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
  }
  // how much of the line's last note the ward gives to its breath
  function breathOf(h, line, beatS, next) {
    if (line.breathAfter === false) return 0;
    var ns = line.notes[h.melodyPart] || line.notes[Object.keys(line.notes)[0]];
    if (!ns || !ns.length) return 0;
    var last = ns[ns.length - 1], clk = clockOf(line, beatS), k0 = ns.length - 1;
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
      hymnId: h ? h.id : null, dur: 0, phrases: [], swell: [], events: [], ward: [], fills: [], sections: [],
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
    if (o.report !== false) p.report.push({ at: n.at, dur: n.dur, m: m, part: part, orn: o.orn || null, line: o.line, beat: o.beat, deg: o.deg });
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
    plan.phrases.forEach(function (p) { plan.counts.keys += p.notes.length; });
    return plan;
  }

  // ==========================================================================
  // THE TOUCH — one line of the Score, as this organist's hands take it
  // ==========================================================================
  // → [{t, dur, m, part, n, pedal}] (plan time). Repeated notes are held or
  // struck again after a lift, as the style has it; every other join is
  // legato (the next key goes down as this one comes up).
  function handsOn(h, line, next, t0, beatS, touch) {
    var parts = Object.keys(line.notes).filter(function (p) { return line.notes[p] && line.notes[p].length; });
    var sat = parts.length >= 3, out = [];
    parts.forEach(function (p) {
      var ev = lineEvents(h, line, p, t0, beatS, next).ev, prev = null;
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
      if (x.orn && !(x.written && x.written.length)) p.report.push({ at: r3(x.t - p.t), dur: r3(x.dur), m: x.m, part: x.part, orn: x.orn, line: o.line });
      else (x.written || []).forEach(function (e) {
        p.report.push({ at: r3(e.t - p.t), dur: r3(e.dur), m: x.m, part: x.part, orn: null, line: o.line, beat: e.n.beat, deg: e.n.deg });
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
    var tc = t0 + clockOf(line, beatS)(cb), order = R.chance(0.6) ? ["A", "T"] : ["T", "A"];
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
  function passing(keys, beatS, R, rate, scale, plan, cap) {
    var n = 0;
    ["A", "T", "B"].forEach(function (p) {
      var ks = keys.filter(function (x) { return x.part === p && !x.orn; }).sort(function (a, b) { return a.t - b.t; });
      for (var i = 0; i + 1 < ks.length && n < cap; i++) {
        var x = ks[i], y = ks[i + 1], d = cents(y.m) - cents(x.m);
        var roll = R.rnd(0, 1);                                 // thrown for every candidate
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
          if (prev) [["S", s], ["A", a], ["T", tn]].forEach(function (q) { if (eq(prev[q[0]], q[1])) cost -= 1.5; });
          if (tones.length >= 3 && eq(cls(s), tones[1]) && eq(cls(B), tones[1])) cost += 2;     // no doubled third on the outside
          if (cost < bestCost) { bestCost = cost; best = { S: s, A: a, T: tn, B: B }; }
        });
      });
    });
    return best || { S: near(tones[0], 700), A: near(tones[tones.length > 2 ? 2 : 0], 300), T: near(tones[1] || tones[0], -200), B: B };
  }
  // chords → keys on a phrase: each part held while it keeps its pitch
  function layChords(p, list, t, prev, o) {
    o = o || {};
    var parts = ["S", "A", "T", "B"], open = {}, into = o.into || [];
    list.forEach(function (c, i) {
      var v = c.voicing, tt = t;
      parts.forEach(function (q) {
        if (o.only && o.only.indexOf(q) < 0) return;
        var hold = open[q];
        if (hold && eq(hold.m, v[q]) && c.tie !== false) { hold.dur += c.dur; return; }
        open[q] = { t: tt, dur: c.dur, m: v[q], part: q };
        into.push(open[q]);
      });
      t += c.dur;
    });
    into.forEach(function (x) {
      key(p, x.t, x.dur * (o.legato || 0.98), x.m, x.part, { v: (VPART[x.part] || 0.8) * (o.v || 1), pedal: x.part === "B" && !o.noPedal, orn: o.orn });
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
        passing(keys, L.bs, die, 0.4, scale, plan, 2);
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
        lay(ps, keys, { only: ["S"], line: L.i, v: 1.05 }); lay(pu, keys, { only: ["A", "T", "B"], line: L.i });
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
    plan.liftDb = PRELUDE_LIFT;
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
    plan.liftDb = PRELUDE_LIFT;
    plan.manner = "the tune in the pedals" + (bit ? " (bitonal)" : ""); plan.bitonal = bit; plan.beatS = r3(pb); plan.lineIdx = idx;
    return finish(plan, codaEnd + hold);
  }

  // ==========================================================================
  // THE HYMN — giving out, the verses under the ward, fills, interludes
  // ==========================================================================
  // the registrations, verse by verse
  function verseRegs(style, verses, R) {
    var out = [], d = [R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1), R.rnd(0, 1)];
    for (var v = 0; v < verses; v++) {
      var last = v === verses - 1 && verses > 1, r;
      if (style === "plain") r = last && d[0] < 0.35 ? "hymn principal" : "soft flutes";
      else if (style === "victorian") {
        if (v === 0) r = "hymn principal";
        else if (last) r = verses >= 3 && d[1] < 0.7 ? "full organ" : "hymn principal";
        else r = d[2] < 0.55 ? "vox & flutes" : "flutes 8 & 4";
      } else {
        if (v === 0) r = d[1] < 0.5 ? "principal & 4" : "hymn principal";
        else if (last) r = d[2] < 0.45 ? "principal & mixture" : d[2] < 0.75 ? "full organ" : "hymn principal";
        else r = d[3] < 0.4 ? "sixteen & four" : d[3] < 0.75 ? "flutes 8 & 4" : "principal & 4";
      }
      out.push(r);
    }
    return out;
  }
  var SWELL_OF = { "soft flutes": 0.66, "quiet flute": 0.7, "flutes 8 & 4": 0.66, "hymn principal": 0.62, "principal & 4": 0.62,
                   "vox & flutes": 0.66, "full organ": 0.56, "principal & mixture": 0.58, "sixteen & four": 0.68, "trumpet": 0.62 };

  function accompany(organist, h, stream, opts) {
    opts = opts || {};
    var plan = newPlan("hymn", organist, h), style = organist.style, S = STYLES[style];
    var R = stream.fork("organist:" + style);
    var verses = Math.max(1, opts.verses || 2), beatS = opts.beatS || h.beatS, lines = verseLinesOf(h);
    var hymnIndex = opts.hymnIndex || 0, scale = scaleOf(h.mode, h.keyMonzo);
    var withOrgan = opts.accompanied != null ? !!opts.accompanied : accompaniedDialect(h.dialect);
    plan.accompanied = withOrgan; plan.verses = verses; plan.beatS = r3(beatS);
    var regs = verseRegs(style, verses, R.fork("regs"));
    var giveReg = style === "plain" ? "flutes 8 & 4" : style === "victorian" ? R.pickW([["trumpet", 0.45], ["hymn principal", 0.55]]) : R.pickW([["trumpet solo", 0.5], ["principal & 4", 0.5]]);
    var tacetDie = R.rnd(0, 1), tacetAt = R.rnd(0, 1);
    var t = 0;
    organist.ledger.hymns++;
    // ---- unaccompanied: the ward alone, lines end to end; the organist sits
    if (!withOrgan) {
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
    // ---- giving out: the tune's last line, the organ alone
    if (opts.giveOut !== false) {
      var li = h.lines.length - 1, gL = h.lines[li], gbs = beatS * (style === "victorian" ? 1.06 : 1);
      var gk = handsOn(h, gL, null, 0, gbs, S.touch);
      draws(plan, organist, 0, giveReg);
      swell(plan, 0, style === "plain" ? 0.74 : 0.82, 0.05);
      if (giveReg === "trumpet solo") {
        var gs = phrase(plan, 0, "trumpet solo", "giving out: the tune on the trumpet", 1.6), gu = phrase(plan, 0, "soft flutes", "giving out", 3);
        lay(gs, gk, { only: ["S"], line: li }); lay(gu, gk, { only: ["A", "T", "B"], line: li });
      } else {
        if (style === "victorian") cadenceSusp(h, gL, gk, 0, gbs, R.fork("giveout"), scale, plan);
        lay(phrase(plan, 0, giveReg, "giving out: the last line", 4), gk, { line: li });
      }
      var gEnd = lineDur(gL, gbs, null);
      if (style === "victorian") extendLast(plan, 0.6 * beatS);
      say(plan, organist, 0, "gives out the tune");
      section(plan, 0, gEnd, "the organ gives out the tune (its last line)");
      t = gEnd + (style === "victorian" ? 1.3 : 0.9) * beatS;
    }
    // ---- the verses
    var fillsInHymn = 0, lastFillJoin = -9, joinNo = 0, strangeUsed = organist.ledger.strange >= 1, carry = null;
    for (var v = 0; v < verses; v++) {
      var reg = regs[v], stray = clamp(0.3 * v + 0.25 * hymnIndex + (verses === 1 ? 0.3 : 0), 0, 1);
      var baseSw = SWELL_OF[reg] != null ? SWELL_OF[reg] : 0.62;
      if (v === 0 || reg !== regs[v - 1]) draws(plan, organist, t, reg);
      swell(plan, t - 0.3, baseSw, 0.8);
      // the improviser now and then lifts both hands for a line of a middle
      // verse, and lets the ward sing it alone
      var tacetLine = style === "improviser" && verses >= 3 && v === 1 && tacetDie < 0.25 ? Math.floor(tacetAt * lines.length) : -1;
      var peakLine = -1; lines.forEach(function (L, i) { if (L.peak) peakLine = i; });
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i], nx = lines[i + 1], ld = lineDur(L, beatS, nx), tL = t;
        plan.ward.push({ kind: "line", verse: v, i: i, t: r3(t), beatS: beatS });
        plan.counts.lines++;
        var keys = handsOn(h, L, nx, t, beatS, S.touch), tacet = i === tacetLine;
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
          plan.counts.joins++; joinNo++;
          var die = R.fork("join:" + v + ":" + i), roll = die.rnd(0, 1), kindRoll = die.rnd(0, 1), lenRoll = die.rnd(0, 1), strRoll = die.rnd(0, 1);
          var rate = S.fill.rate * organist.habits.fill * (style === "improviser" ? 0.8 + 0.6 * stray : 1);
          if (rate > 0 && roll < rate && fillsInHymn < S.fill.cap && joinNo - lastFillJoin > 1) {
            var strange = S.strange && !strangeUsed && stray >= 0.45 && strRoll < 0.55;
            var fs = t - breathOf(h, L, beatS, nx);
            fill = style === "victorian"
              ? fillVictorian(plan, organist, h, L, nx, tacet ? [] : keys, fs, t, beatS, scale, kindRoll, lenRoll, reg, i, die)
              : fillImproviser(plan, organist, h, L, nx, tacet ? [] : keys, fs, t, beatS, scale, kindRoll, lenRoll, strange, stray, i, die);
            fill.verse = v; fill.after = i;
            if (fill.carry) { carry = fill.carry; carry.phrase = fill.phrase; }
            delete fill.carry; delete fill.phrase;
            plan.fills.push(fill);
            plan.counts.fills++; fillsInHymn++; lastFillJoin = joinNo;
            organist.ledger.fills++;
            if (fill.strange) { plan.counts.strange++; organist.ledger.strange++; strangeUsed = true; }
          }
        }
        if (tacet) {
          say(plan, organist, tL, "lifts both hands; the ward sings a line alone");
          section(plan, tL, tL + ld, "verse " + (v + 1) + ", line " + (i + 1) + " — the ward alone");
        } else {
          var p = phrase(plan, tL, reg, "verse " + (v + 1) + ", line " + (i + 1), 4);
          lay(p, keys, { line: i, v: v === verses - 1 && reg === "full organ" ? 0.95 : 1 });
          section(plan, tL, tL + ld, "verse " + (v + 1) + ", line " + (i + 1));
          // the Victorian's swell breathes with the line
          if (style === "victorian" && organist.habits.swell > 0.1) {
            var lift = i === peakLine ? 0.16 : 0.05 * (i + 1) / lines.length;
            swell(plan, tL + 0.2, baseSw + lift * organist.habits.swell, ld * 0.45);
            swell(plan, tL + ld * 0.62, baseSw - 0.03, ld * 0.3);
          }
        }
        if (fill) {
          section(plan, fill.t, fill.t + fill.dur, fill.what);
          t = fill.t + fill.dur;                        // the ward waits for the organist
        }
      }
      // ---- between verses: the interlude
      if (v < verses - 1) {
        var id = interlude(plan, organist, h, lines, t, beatS, scale, v, verses, stray, R.fork("interlude:" + v), regs[v + 1]);
        section(plan, t, t + id.dur, id.what);
        t += id.dur;
      }
    }
    // ---- the amen, the ward's and the organ's
    if (h.amen && opts.amen !== false) {
      t += 0.3 * beatS;
      var aL = h.amen, ad = lineDur(aL, beatS, null);
      plan.ward.push({ kind: "amen", verse: verses - 1, i: -1, t: r3(t), beatS: beatS });
      var ak = handsOn(h, aL, null, t, beatS, S.touch);
      if (style === "victorian") cadenceSusp(h, aL, ak, t, beatS, R.fork("amen"), scale, plan);
      lay(phrase(plan, t, regs[verses - 1], "the amen", 4), ak, { line: "amen" });
      section(plan, t, t + ad, "the amen");
      t += ad;
    }
    // ---- to the next hymn's key, by a common tone
    if (opts.next && opts.next.keyMonzo && !eq(cls(opts.next.keyMonzo), cls(h.keyMonzo))) {
      t += 0.6 * beatS;
      var md = modulation(plan, organist, finalVoicing(h), h.keyMonzo, opts.next.keyMonzo, opts.next.mode || h.mode, t, beatS, R.fork("modulation"));
      section(plan, t, t + md.dur, md.what);
      t += md.dur;
    }
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
    var dDet = R.rnd(0, 1), dSus = R.rnd(0, 1);
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
    var prev = fromV, out = [], tt = t, common = null;
    // the old tonic, re-sounded softly so the pivot has something to hold
    out.push({ voicing: fromV, dur: 1 * beatS });
    seq.forEach(function (s) {
      var vc = voiceChord(s.c, prev);
      out.push({ voicing: vc, dur: s.beats * beatS, roman: s.c.roman });
      if (!common) ["S", "A", "T", "B"].forEach(function (q) { if (!common && eq(vc[q], prev[q])) common = { part: q, m: vc[q] }; });
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
    var words = "a modulation: " + (pivot ? "the pivot " + pivot.roman + " of the new key" + (common ? ", its common tone held in the " + { S: "soprano", A: "alto", T: "tenor", B: "bass" }[common.part] : commaOnly ? ", its common tone re-struck a comma off" : "") : "straight to the new dominant") + ", then V7 and I";
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
  // MEASURE AND DESCRIBE — for the critic and the lab
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
  // pump(now) schedules every phrase, swell move and log line that begins
  // before now + ahead (default 3 s) — call it from the clock's lane or a
  // timer; it returns true when the plan is all laid. Nothing is read from
  // the audio clock here: `now` is the caller's scheduled time.
  function perform(organ, plan, t0, o) {
    o = o || {};
    var K0 = o.keynoteHz || 261.63, layer = o.layer || "organ";
    var ph = plan.phrases.slice(), sw = plan.swell.slice(), ev = plan.events.slice(), i = 0, j = 0, k = 0;
    function hz(m) { return K0 * ratio(m); }
    function pump(now, ahead) {
      var horizon = now + (ahead == null ? 3 : ahead);
      while (j < sw.length && t0 + sw[j].t <= horizon) { organ.setSwell(sw[j].e, t0 + sw[j].t, sw[j].ramp); j++; }
      while (i < ph.length && t0 + ph[i].t <= horizon) {
        var p = ph[i++], tp = t0 + p.t, g = Math.pow(10, ((p.trim != null ? p.trim : trimOf(p.reg)) + (plan.liftDb || 0)) / 20);
        organ.play(tp, p.notes.map(function (n) {
          return { f: hz(n.m), dur: n.dur, at: n.at, v: n.v * g, pedal: !!n.pedal, pedalOnly: !!n.pedalOnly };
        }), regOf(p.reg), { texture: p.texture });
        if (o.onNote) p.report.forEach(function (r) {
          var x = { part: r.part, monzo: r.m };
          if (plan.hymnId || o.hymnId) x.hymnId = o.hymnId || plan.hymnId;
          if (r.line != null) x.line = r.line;
          if (r.beat != null) x.beat = r.beat;
          if (r.deg != null) x.deg = r.deg;
          if (r.orn) x.orn = r.orn;
          x.organist = plan.style;
          o.onNote(layer, hz(r.m), tp + r.at, r.dur, x);
        });
      }
      while (k < ev.length && t0 + ev[k].t <= horizon) {
        var e = {}, src = ev[k++];
        for (var q in src) e[q] = src[q];
        e.t = t0 + src.t;
        if (o.onEvent) o.onEvent(e);
      }
      return i >= ph.length && j >= sw.length && k >= ev.length;
    }
    return { pump: pump, until: t0 + plan.dur, done: function () { return i >= ph.length && j >= sw.length && k >= ev.length; } };
  }

  return {
    ORGAN_GAIN: ORGAN_GAIN, STYLES: STYLES, REG: REG, REG_TRIM: REG_TRIM, ROSTER: ROSTER, STRAY_KEYS: STRAY_KEYS,
    seat: seat, preludeDraw: preludeDraw, prelude: prelude, accompany: accompany, modulate: modulate,
    measure: measure, describe: describe, perform: perform, regOf: regOf,
    lineEvents: lineEvents, lineDur: lineDur, breathOf: breathOf, verseLines: verseLinesOf, accompanied: accompaniedDialect,
    // pure hands, for the lab and the harness
    keyChords: keyChords, voiceChord: voiceChord, scaleOf: scaleOf, cents: cents, ratio: ratio,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-organist.js"] = true;   // the load guard's roll call
