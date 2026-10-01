// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE NAUVOO BRASS BAND GOES BY (KOLOB.GuestBands)
//
// Charles Ives remembered his father's band in Danbury marching round the
// green while a second band came the other way, each in its own key and
// its own time, and the town heard both at once; he wrote it down in
// Putnam's Camp. The Nauvoo Brass Band — William Pitt's band, which played
// the Saints across Iowa in 1846 and the camps to sleep at night — was a
// saxhorn band: cornets on the tune, alto horns on the after-beats, a tuba
// under everything, a snare and a bass drum. At the rim of Kolob's light
// the colony kept both the band and the habit of marching it through town
// on a Sunday.
//
// So, some Sundays, as the ward gathers or goes out (the prelude or the
// postlude; never over the ward's singing — the owner, v0.36.1), a band
// comes up the road.
// It is playing a MARCH, and the march is one of the day's own hymns — the
// band's arranger has turned it into a quickstep, as the bandmasters of
// the 1850s turned every tune they knew — in its own key (a fifth or a
// fourth from the meeting's), at its own marching pace, with nothing to do
// with the meeting's time. It is first heard far off at one end of the
// colony (a drum, a cornet), swells as it comes, passes the meetinghouse,
// and goes on out the other end, and the house carries on regardless.
// The collision is the piece. It plays its march through (a short march:
// 55 s at most, repeats dropped first) and is gone: it does not loop. Now and then (one visit in ten; one in four on Pioneer
// Day) a SECOND band comes the other way with a march of its own.
//
// THE MARCH, in real strains, as the 1850s quickstep had them:
//   · an INTRODUCTION — the tune's head in octaves by the whole band, or
//     four bars of oom-pah on the dominant, or the drums' roll-off alone
//     (the way a marching band begins);
//   · the FIRST STRAIN, twice (A A): the hymn's first half, the cornet on
//     the tune (the second time with a second cornet a third or sixth
//     under it), the alto horns on the after-beats, the tuba's oom-pah on
//     the chord's root and fifth, the bass drum on the downbeat and the
//     snare light;
//   · the SECOND STRAIN, twice (B B): the hymn's second half (or its
//     refrain), with the march's dotted "long–short" where the hymn ran in
//     even eighths; half the time the first B is the BASS STRAIN — the
//     tune down in the tuba and the alto horns while the cornets punch the
//     after-beats — and the cornets take it back the second time;
//   · the TRIO, in the subdominant, as a march's trio is: the tune's first
//     half again, softly, legato, the alto horns holding the chords and the
//     snare silent — and, when there is room, once more as the GRANDIOSO,
//     the whole band full, the drums rolling into it;
//   · and the STINGER: one short tonic chord on the last after-beat —
//     after which the band marches on to its drums alone, the STREET BEAT,
//     and they carry it round the last houses and out of hearing (the
//     march ends at the stinger; the meeting waits for no drum).
// Hymns in 3/4 or 3/2 are turned into a 6/8 quickstep (the first beat of
// the bar held, the other two a lilting quarter and eighth) or a 2/4 march
// (long, short, short); hymns in 4/4 or 2/2 march in 2/4, now and then in
// 6/8; a 6/8 hymn stays in 6/8. The harmony is the hymn's own, as the
// composer wrote it, tuned justly on each chord's root (a Sacred Harp
// hymn's bare fifths get their thirds: a band plays triads); a hymn with no
// harmony (the Old Way, the Shakers) is harmonized the bandmaster's way,
// on I, IV and V. The fermatas are gone: a band marching does not stop.
//
// THE ROAD. The band is a point travelling a straight road past the
// meetinghouse (KOLOB.VoicesBand.road): its distance is the distance of a
// real passer-by — √(D² + x²), the road's nearest point D away, the band
// walking it at its own pace — read on the distance stage's scale (the
// direct sound, the air's loss of the top, the town's reverberance, the
// echo off the houses), and its side turns from one end of the field to
// the other as it passes. It is nearest partway through the second strain,
// and it goes out during the trio. The meeting is inside; the band never
// comes closer than the street.
//
// PURE PLANNING. plan(), decide(), prepare() and score() touch no
// AudioContext, DOM, clock or Math.random: every die is the stream's —
// guest:bands:<n>, forked "seat" (the odds, the section, the moment, which
// hymn), "shape" (the key, the meter, the pace, the road, the strains'
// devices, the second band's dice — so plan() and perform() agree without
// passing anything between them) and "synth" (the players' own detune and
// the drums' noise). perform() reads no clock: everything is placed at or
// after the t it is given, and laid out a few bars at a time through
// hooks.defer, a little ahead of the sound.
//
// Public surface: window.KOLOB.GuestBands
//   plan(meetingInfo, stream) → { guest: "bands", seat, section, at, dur,
//        holdUntil, pick, second, estimated, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}],
//       guests: [{type, section}], material?, force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the march (pure; itself material)
//     material: { hymn: <a SCORE Hymn>, homeHz (the tonic sounding in the
//       band's section; else keynoteHz × ratio(keyMonzo)), second?: {hymn} }
//   score(material, stream, t0) → the whole passage as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onNote({freq, t, dur, part, band, strain, bar,
//              beat, downbeat, beatS, loud, hymnId (that band's own)}), onStage({stage, t0, band,
//              side, label, detail}), still (a lab's: no road — the band
//              stands in the street and plays) }
//   ODDS, EXCLUDES, SEATS, AT, LEVEL, LABEL, NAME, MAX_DUR
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestBands = (function () {
  "use strict";

  var NAME = "bands";
  var LABEL = "guest:bands:";                     // the stream's label: + the meeting number

  // ==========================================================================
  // THE ODDS — the owner's own (kolob-meeting.js: "bands 36 %, per the
  // owner's taste"), and the calendar's welcome, unchanged
  // ==========================================================================
  // p = base × weight[sunday, else kind], capped: 0.36, times
  // kolob-calendar.js's SUNDAYS[·].guests.bands — about one ordinary Sunday
  // in three, three Pioneer Days in four, almost never a funeral. The kinds
  // (a meeting with no calendar) stand at 1. In the meeting these are the
  // calendar's GUEST_ODDS row "bands", handed in as info.odds — the same
  // numbers; this table is the labs' and a page's without the calendar.
  // Change the calendar's row to change the meeting.
  var ODDS = {
    base: 0.36,
    weight: {
      ordinary: 1, fast: 0.5, conference: 1, jubilee: 1,
      pioneer: 2.1, christmas: 0.5, easter: 0.7, wedding: 0.6, funeral: 0.15, dedication: 1,
    },
    cap: 0.9,
    // the second band, among the Sundays a band comes at all
    second: { base: 0.1, weight: { pioneer: 2.5, jubilee: 1.5, conference: 1.2 }, cap: 0.35 },
  };
  // never beside the trombones at dawn (they refuse a meeting the band
  // crosses; this says it from the band's side too) or the handcart company
  // (the band's pastoral cousin: one procession a Sunday)
  var EXCLUDES = ["trombones", "handcart"];
  // the seats (the owner, v0.36.1: never while the ward sings — a band over
  // the full ward's hymn is too much): the gathering before the meeting
  // seven times in ten, else the going-out after it; a band asked for by
  // name comes to the gathering, so it is heard soon. A section another
  // guest holds is passed over.
  var SEATS = { usual: ["prelude", "postlude"], other: ["postlude", "prelude"], forced: ["prelude", "postlude"] };
  // the moment it strikes up, as a share of its section's planned length
  // (it is far off for its first twenty seconds or so)
  var AT = { prelude: [0.05, 0.3], postlude: [0.05, 0.25] };
  var AT_MIN = 8;
  var MAX_DUR = 55;                                 // the strains shorten to fit (s; 55 since v0.36.1, the owner: at 110 it went on a bit long)
  var CAD_S = 16;                                   // the drums' street beat after the stinger (s, about)
  var AWAY_DB = -30;                                // …over which the band goes out of hearing
  // the band's bus into the tabernacle's wide send (calibrated in the lab
  // against the organ reference)
  var LEVEL = 0.43;

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestBands: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function weightOf(tbl, info) {
    var w = tbl.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return w[k] != null ? w[k] : 1;
  }
  // (the meeting hands this room its odds from Calendar.GUEST_ODDS,
  // info.odds; a lab without them reads the room's own ODDS)
  function oddsFor(info) { return info && info.odds != null ? Math.max(0, Math.min(1, +info.odds)) : Math.min(ODDS.cap, ODDS.base * weightOf(ODDS, info)); }
  function secondOdds(info) { return Math.min(ODDS.second.cap, ODDS.second.base * weightOf(ODDS.second, info)); }

  // ==========================================================================
  // THE SHAPE — the musical dice of one passage, all drawn, in order
  // ==========================================================================
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    var one = function () {
      return {
        up: r.pickW([["fifth", 0.55], ["fourth", 0.45]]),   // its own key, a fifth or a fourth from the meeting's
        meterDie: r.next(),                  // 6/8 or 2/4 (read against the hymn's own time)
        pace: r.next(),                      // where in the march's tempo range
        fromWest: r.chance(0.5),
        nearD: r.rnd(0.2, 0.32),             // the road's nearest point, on the distance scale
        farD: r.rnd(0.86, 0.95),             // where it is first heard
        crossAt: r.rnd(0.46, 0.6),           // how far into the march it passes nearest
        intro: r.pickW([["unison", 0.4], ["vamp", 0.35], ["rolloff", 0.25]]),
        bassStrain: r.chance(0.5),           // the first B down in the low brass
        dotted: r.chance(0.55),              // the second strain's long–short (2/4)
        grandioso: r.chance(0.65),           // the trio once more, full
        pahPah: r.chance(0.45),              // 6/8's after-beats: two a beat (else one)
        snare: r.rnd(0.3, 0.42),             // how light the drums are
        second2cornet: r.chance(0.7),        // a second cornet on the repeats
      };
    };
    var a = one();
    var secondDie = r.next();
    var b = one();
    return {
      a: a, b: b, secondDie: secondDie,
      b2: { enter: r.rnd(0.3, 0.45), tempo: r.pickW([[r.rnd(0.8, 0.9), 1], [r.rnd(1.1, 1.22), 1]]), key: r.pickW([["fourth", 1], ["fifth", 1], ["tone", 0.6]]) },
    };
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  // (a nominal march for the estimate, when the plan has no hymn yet: a Common
  // Meter tune in 4/4, ten march bars a half — the engine plans again with
  // the prepared march for the exact length)
  function estimate(sh) {
    var bars = 4 + 2 * 10 + 2 * 10 + 10 * (sh.a.grandioso ? 2 : 1) + 1;
    return bars * barS(sh.a, "2/4");
  }
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), seatDie = rs.chance(0.7), atU = rs.next(), pick = rs.next();   // DICE: every die, first
    var sh = shapeOf(stream);
    var p = oddsFor(info), p2 = secondOdds(info), why = null, seat = null;
    var secs = info.sections || [], guests = info.guests || [];
    function has(fn) { for (var j = 0; j < guests.length; j++) if (guests[j] && fn(guests[j])) return true; return false; }
    function taken(type) { return has(function (g) { return g.section === type && g.type !== NAME; }); }
    var prefs = info.force ? SEATS.forced : seatDie ? SEATS.usual : SEATS.other, sec = null;
    for (var k = 0; k < prefs.length && !seat; k++) {
      for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === prefs[k] && !taken(prefs[k])) { seat = prefs[k]; sec = secs[i]; break; }
    }
    if (has(function (g) { return EXCLUDES.indexOf(g.type) >= 0; })) why = "the " + (has(function (g) { return g.type === "trombones"; }) ? "trombones hold the dawn" : "handcarts are on the road");
    else if (!seat) why = "no prelude or postlude free";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var span = AT[seat], secDur = sec && sec.dur > 0 ? sec.dur : 120;
    var at = Math.max(AT_MIN, secDur * (span[0] + (span[1] - span[0]) * atU));
    var second = info.force === "second" || sh.secondDie < p2;
    var dur = info.material ? score(info.material, stream, 0).end : estimate(sh) * (second ? 1.15 : 1);
    return {
      seat: {
        guest: NAME, seat: seat, section: seat, at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 3).toFixed(2),       // the section should last at least this long
        pick: +pick.toFixed(4), second: second, estimated: !info.material,
        odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // PITCH — exact ratios (SCORE §2): the composer's spelling, copied so the
  // room stands alone (a lab, the harness), and the just intervals a band's
  // chord is tuned by above its root
  // ==========================================================================
  var FR = {
    ionian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"], mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian: ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"], aeolian: ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
  };
  FR.penta = FR.hexa = FR.ionian;
  var SEMIS = {};
  function mzOf(s) {
    var P = [2, 3, 5, 7], parts = String(s).split("/"), m = [0, 0, 0, 0];
    [[+parts[0], 1], [parts.length > 1 ? +parts[1] : 1, -1]].forEach(function (nd) {
      var n = nd[0];
      for (var i = 0; i < 4; i++) while (n > 1 && n % P[i] === 0) { n /= P[i]; m[i] += nd[1]; }
    });
    return m;
  }
  function mzAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function cents(r) { return 1200 * Math.log(r) / Math.LN2; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function modeOf(m) { return FR[m] ? m : "ionian"; }
  Object.keys(FR).forEach(function (k) { SEMIS[k] = FR[k].map(function (f) { return Math.round(cents(ratio(mzOf(f))) / 100); }); });
  var SCALE = {};
  Object.keys(FR).forEach(function (k) { SCALE[k] = FR[k].map(mzOf); });
  var CHROMA_UP = [-4, 1, 1, 0], CHROMA_DN = [4, -1, -1, 0];
  function spelled(mode, d, alt) {
    mode = modeOf(mode);
    if (alt > 0) return mzAdd(spelled(mode, d + 1, 0), CHROMA_UP);
    if (alt < 0) return mzAdd(spelled(mode, d - 1, 0), CHROMA_DN);
    var o = Math.floor(d / 7), m = SCALE[mode][mod(d, 7)];
    return [m[0] + o, m[1], m[2], m[3]];
  }
  function semi(mode, d, alt) { mode = modeOf(mode); return 12 * Math.floor(d / 7) + SEMIS[mode][mod(d, 7)] + (alt || 0); }
  // just intervals above a root, by the semitones they span (the composer's JUST)
  var JUST = { 0: "1/1", 1: "16/15", 2: "9/8", 3: "6/5", 4: "5/4", 5: "4/3", 6: "64/45", 7: "3/2", 8: "8/5", 9: "5/3", 10: "16/9", 11: "15/8" };
  Object.keys(JUST).forEach(function (k) { JUST[k] = mzOf(JUST[k]); });
  // a frequency moved by whole octaves to lie nearest a target (geometric)
  function nearOct(f, target) { return f * Math.pow(2, Math.round(Math.log(target / f) / Math.LN2)); }
  function intoRange(f, lo) { while (f < lo) f *= 2; while (f >= lo * 2) f /= 2; return f; }
  var KEY_UP = { fifth: 3 / 2, fourth: 4 / 3, tone: 9 / 8 };

  // ==========================================================================
  // THE ARRANGER'S DESK, 1 — the hymn read as a barred tune with its chords
  // ==========================================================================
  // (the composer's TIMES: beats in a bar, and whether the bar walks in twos,
  // threes, or compound threes)
  var TIME = {
    "4/4": { bar: 4, kind: "duple" }, "2/2": { bar: 2, kind: "duple" }, "2/4": { bar: 2, kind: "duple" },
    "3/4": { bar: 3, kind: "triple" }, "3/2": { bar: 3, kind: "triple" }, "6/8": { bar: 6, kind: "compound" },
  };
  // a chord of the hymn as the band tunes it: its root (a monzo in the
  // hymn's key) and the semitones of its tones above the root. A bare fifth
  // gets the third its mode gives it; a chord with no third gets one too.
  function chordOf(mode, ch) {
    if (!ch || ch.rootDeg == null) return null;
    var rd = mod(ch.rootDeg, 7), ra = ch.rootAlt || 0, rs = semi(mode, rd, ra);
    var iv = [];
    (ch.tones || []).forEach(function (t) { var s = mod(semi(mode, t[0], t[1] || 0) - rs, 12); if (iv.indexOf(s) < 0) iv.push(s); });
    if (iv.indexOf(0) < 0) iv.push(0);
    var q = ch.quality || "";
    if (q === "open5" || q === "sus" || (iv.indexOf(3) < 0 && iv.indexOf(4) < 0)) {
      var th = mod(semi(mode, rd + 2, 0) - rs, 12);
      iv = iv.filter(function (s) { return s !== 5 && s !== 2; });          // a band resolves the suspension
      iv.push(th === 3 || th === 4 ? th : 4);
    }
    if (iv.indexOf(7) < 0 && iv.indexOf(6) < 0 && iv.indexOf(8) < 0) iv.push(7);
    iv.sort(function (a, b) { return a - b; });
    var third = iv.indexOf(3) >= 0 ? 3 : 4, fifth = iv.indexOf(7) >= 0 ? 7 : iv.indexOf(6) >= 0 ? 6 : 8;
    var sev = iv.indexOf(10) >= 0 ? 10 : iv.indexOf(11) >= 0 ? 11 : iv.indexOf(9) >= 0 && q.indexOf("7") >= 0 ? 9 : null;
    var root = spelled(mode, rd, ra);
    return { root: [root[0] - Math.floor(Math.log(ratio(root)) / Math.LN2), root[1], root[2], root[3]], third: third, fifth: fifth, seventh: sev, name: ch.name || ch.roman || null };
  }
  // the hymn with no harmony (the Old Way, the Shakers: one line in unison)
  // harmonized the bandmaster's way. At each bar the chord moves if the tune
  // lets it — up a fourth by preference (I→IV, V→I, ii→V), else up a fifth —
  // among the triads that hold the tune's note there; within the bar it holds
  // while the tune stays in it; a line's second-to-last bar leans to V (or
  // IV), its last note to I. The triads are the mode's own (a dorian IV is
  // major, an aeolian v minor), tuned justly on their roots.
  var BANDMASTER = { major: [[0, 1], [4, 0.9], [3, 0.85], [5, 0.4], [1, 0.35]], minor: [[0, 1], [3, 0.85], [4, 0.75], [6, 0.7], [2, 0.6]] };
  function harmonizeLine(mode, notes, bar, kind) {
    var out = [], cur = null, pool = SEMIS[mode][2] === 3 ? BANDMASTER.minor : BANDMASTER.major;
    if (!notes.length) return out;
    var p0 = notes[0].p, pEnd = notes[notes.length - 1].p + notes[notes.length - 1].len;
    var beat = kind === "compound" ? 3 : 1;
    function noteAt(p) { var hit = null; notes.forEach(function (n) { if (n.p <= p + 1e-6 && p < n.p + n.len - 1e-6) hit = n; }); return hit; }
    function holds(root, cls) { return [0, 2, 4].some(function (k) { return mod(root + k, 7) === cls; }); }
    var lastBar = Math.floor((pEnd - 1e-6) / bar) * bar;
    for (var p = Math.floor(p0 / beat) * beat; p < pEnd - 1e-6; p += beat) {
      var n = noteAt(Math.max(p, p0)) || notes[0], cls = mod(n.deg, 7), want = null;
      // (the chord moves at a bar, at the middle of a bar of four, or under a
      // long note; a short note between is a passing note, over the chord it passes)
      var atBar = mod(p, bar) < 1e-6 || (bar === 4 && mod(p, bar) === 2), strong = atBar || n.len >= 1.5 * beat - 1e-6;
      var lastNote = n === notes[notes.length - 1], penult = !lastNote && p >= lastBar - bar - 1e-6 && p < lastBar - 1e-6;
      if (lastNote && holds(0, cls)) want = 0;
      else if (penult && atBar && holds(4, cls)) want = 4;
      else if (cur != null && (holds(cur, cls) || !strong) && !atBar) want = cur;
      else {
        var best = -1;
        pool.forEach(function (c) {
          if (!holds(c[0], cls)) return;
          var sc = c[1] + (cur == null ? 0 : mod(c[0] - cur, 7) === 3 ? 0.9 : mod(c[0] - cur, 7) === 4 ? 0.5 : c[0] === cur ? 0.2 : 0);
          if (sc > best) { best = sc; want = c[0]; }
        });
      }
      if (want == null) want = cur != null ? cur : 0;
      if (want !== cur || !out.length) out.push({ p: Math.max(p, p0), len: beat, rootDeg: want });
      else out[out.length - 1].len += beat;
      cur = want;
    }
    return out.map(function (c) { return { p: c.p, len: c.len, chord: chordOf(mode, { rootDeg: c.rootDeg, tones: [[c.rootDeg, 0], [mod(c.rootDeg + 2, 7), 0], [mod(c.rootDeg + 4, 7), 0]] }) }; });
  }
  // readTune(hymn) → { mode, bar, kind, lines: [{start, end, notes, chords,
  // refrain}] }: every line laid end to end on the hymn's own bar grid, in
  // hymn beats (a line starts where the last one ended, moved on to its own
  // place in the bar, so each line keeps its accent; the fermatas are not
  // held — a band marching does not stop). notes: {p, len, monzo, deg, alt};
  // chords: {p, len, chord} — the hymn's own, or the bandmaster's.
  function guessTime(h) {
    if (TIME[h.modeOfTime]) return TIME[h.modeOfTime];
    var m = /^(\d+)\/(\d+)$/.exec(h.modeOfTime || "");
    if (m && +m[1] % 3 === 0 && +m[1] > 3) return { bar: +m[1], kind: "compound" };
    if (m && +m[1] === 3) return { bar: 3, kind: "triple" };
    return { bar: m ? +m[1] : 4, kind: "duple" };
  }
  function readTune(h) {
    if (!h || !h.lines || !h.lines.length) throw new Error("KOLOB.GuestBands: a hymn with lines is required");
    var mode = modeOf(h.mode), tm = guessTime(h), mp = h.melodyPart || "S";
    var all = h.lines.concat(h.refrain || []), out = [], pos = null;
    all.forEach(function (L, li) {
      var ns = ((L.notes && (L.notes[mp] || L.notes.S || L.notes.T)) || []).filter(function (n) { return n && n.monzo && !n.rest && n.beats > 0; });
      if (!ns.length) return;
      var bs = mod(L.barStart != null ? L.barStart : 0, tm.bar), b0 = ns[0].beat || 0;
      var start = pos == null ? bs : pos + mod(bs + b0 - pos, tm.bar) - b0;
      var notes = [];
      ns.forEach(function (n) {
        var prev = notes[notes.length - 1];
        // (a note tied on from the one before, at the same pitch, is one note)
        if (prev && n.tie && prev.monzo.join() === n.monzo.join()) { prev.len += n.beats; return; }
        notes.push({ p: start + n.beat, len: n.beats, monzo: [n.monzo[0] || 0, n.monzo[1] || 0, n.monzo[2] || 0, n.monzo[3] || 0], deg: n.deg, alt: n.alt || 0 });
      });
      var chords = (L.chords || []).map(function (c) { return { p: start + c.beat, len: c.len, chord: chordOf(mode, c) }; }).filter(function (c) { return c.chord; });
      if (!chords.length) chords = harmonizeLine(mode, notes, tm.bar, tm.kind);
      var last = notes[notes.length - 1];
      out.push({ start: start + b0, end: last.p + last.len, notes: notes, chords: chords, refrain: li >= h.lines.length });
      pos = last.p + last.len;
    });
    return { mode: mode, bar: tm.bar, kind: tm.kind, lines: out, id: h.id || null, name: h.nameEn || h.id || null };
  }

  // ==========================================================================
  // THE ARRANGER'S DESK, 2 — the tune in march time
  // ==========================================================================
  // A march bar is two beats: a quarter each in 2/4, a dotted quarter each in
  // 6/8. A hymn in two (4/4, 2/2, 2/4) marches beat for beat; in 6/8 its
  // half-beats lilt, long–short. A hymn in three (3/4, 3/2) puts one of its
  // bars in each march bar: its first beat held a whole march beat, its
  // other two a lilting quarter and eighth (6/8) or two eighths (2/4). A
  // hymn in 6/8 stays there, eighth for eighth.
  function meterFor(tune, a) {
    if (tune.kind === "compound") return "6/8";
    return a.meterDie < (tune.kind === "triple" ? 0.7 : 0.35) ? "6/8" : "2/4";
  }
  function beatSOf(a, meter) { return 60 / (meter === "6/8" ? 100 + 16 * a.pace : 108 + 18 * a.pace); }
  function barS(a, meter) { return 2 * beatSOf(a, meter); }
  function lerp(pts, x) {
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0] + 1e-9) {
      var p = pts[i - 1], q = pts[i];
      return p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]);
    }
    return pts[pts.length - 1][1];
  }
  var LILT = [[0, 0], [0.5, 2 / 3], [1, 1]];
  function warper(tune, meter) {
    var bar = tune.bar, kind = tune.kind, MB, w;
    if (kind === "compound") { MB = 2; w = function (q) { return q * 2 / bar; }; }
    else if (kind === "triple") {
      MB = 2;
      var T = meter === "6/8" ? [[0, 0], [1, 1], [2, 5 / 3], [3, 2]] : [[0, 0], [1, 1], [2, 1.5], [3, 2]];
      w = function (q) { return lerp(T, q * 3 / bar); };
    } else {
      MB = bar;
      w = meter === "6/8" ? function (q) { var k = Math.floor(q + 1e-9); return k + lerp(LILT, q - k); } : function (q) { return q; };
    }
    return function (r) { var hb = Math.floor(r / bar + 1e-9), q = r - hb * bar; return hb * MB + w(q); };
  }
  // a strain: some of the tune's lines, measured from its first downbeat in
  // march beats (the pickup before it is negative)
  function strainOf(tune, lines, meter, dotted) {
    var W = warper(tune, meter), bar = tune.bar;
    var s0 = lines[0].start, D0 = s0 + mod(bar - mod(s0, bar), bar);
    if (mod(s0, bar) < 1e-6) D0 = s0;
    var notes = [], chords = [];
    lines.forEach(function (L) {
      L.notes.forEach(function (n) {
        var m0 = W(n.p - D0), m1 = W(n.p + n.len - D0);
        notes.push({ m: m0, len: m1 - m0, monzo: n.monzo, deg: n.deg, alt: n.alt });
      });
      L.chords.forEach(function (c) {
        var m0 = W(c.p - D0), m1 = W(c.p + c.len - D0);
        chords.push({ m: m0, len: m1 - m0, chord: c.chord });
      });
    });
    // the march's dotted long–short, where a beat holds two even halves
    if (dotted && meter === "2/4") {
      for (var i = 0; i + 1 < notes.length; i++) {
        var a = notes[i], b = notes[i + 1], k = Math.floor(a.m + 1e-9);
        if (Math.abs(a.m - k) < 1e-6 && Math.abs(a.len - 0.5) < 1e-6 && Math.abs(b.m - k - 0.5) < 1e-6 && Math.abs(b.len - 0.5) < 1e-6) {
          a.len = 0.75; b.m = k + 0.75; b.len = 0.25; i++;
        }
      }
    }
    var last = notes[notes.length - 1];
    return { meter: meter, pk: Math.max(0, -notes[0].m), notes: notes, chords: chords, endM: last.m + last.len };
  }
  // how many march bars a strain takes before the next strain's downbeat
  // (the next strain's pickup is played in its last bar)
  function barsOf(st, nextPk) { return Math.max(1, Math.ceil((st.endM + (nextPk || 0)) / 2 - 1e-6)); }
  function chordAt(st, m) {
    var hit = null;
    for (var i = 0; i < st.chords.length; i++) { var c = st.chords[i]; if (c.m <= m + 1e-6) hit = c; else break; }
    return (hit || st.chords[0] || { chord: { root: [0, 0, 0, 0], third: 4, fifth: 7, seventh: null } }).chord;
  }
  // the tune's halves: the verse and the refrain, or the first lines and the rest
  function halves(tune) {
    var ls = tune.lines, v = ls.filter(function (l) { return !l.refrain; }), r = ls.filter(function (l) { return l.refrain; });
    if (r.length) return { A: v, B: r };
    if (ls.length === 1) return { A: ls, B: ls, same: true };
    var h = Math.ceil(ls.length / 2);
    return { A: ls.slice(0, h), B: ls.slice(h) };
  }

  // ==========================================================================
  // THE ARRANGER'S DESK, 3 — the parts, beat by beat
  // ==========================================================================
  // Every event is placed in march beats from its strain's downbeat:
  // { m, len, part, inst, f, dyn, acc, stacc }. A tone of a chord is the
  // band's do (tHz) × the chord's root × the just interval above it.
  var TUNE_AT = 560, TRIO_AT = 500, LOW_TUNE_AT = 150, ALTO_LO = 233, CORNET_PAH_LO = 350, TUBA_LO = 55;
  function toneHz(tHz, ch, s) { return tHz * ratio(ch.root) * ratio(JUST[s]); }
  // one octave for the whole tune (never a note folded on its own: the
  // tune keeps its shape), putting its middle where the instrument sings
  function octaveFor(tHz, notes, target) {
    var fs = notes.map(function (n) { return tHz * ratio(n.monzo); }).sort(function (a, b) { return a - b; });
    var mid = fs.length ? Math.sqrt(fs[0] * fs[fs.length - 1]) : tHz;
    return Math.pow(2, Math.round(Math.log(target / mid) / Math.LN2));
  }
  // the second cornet: the chord's tone a third to a sixth under the tune,
  // else the scale's third under it
  function under(f, ch, tHz, n, mode) {
    var best = null;
    [0, ch.third, ch.fifth, ch.seventh].forEach(function (s) {
      if (s == null) return;
      var g = intoRange(toneHz(tHz, ch, s), f / 2);
      if (g <= f * 0.805 && g >= f * 0.59 && (!best || g > best)) best = g;
    });
    if (best) return best;
    var r = ratio(spelled(mode, n.deg - 2, 0)) / ratio(spelled(mode, n.deg, n.alt || 0));
    return f * r;
  }
  function chordTones(tHz, ch, lo) {
    var ss = ch.seventh != null ? [ch.third, ch.fifth, ch.seventh] : [0, ch.third, ch.fifth];
    return ss.map(function (s) { return intoRange(toneHz(tHz, ch, s), lo); }).sort(function (a, b) { return a - b; });
  }
  function tubaRoot(tHz, ch) { return intoRange(toneHz(tHz, ch, 0), TUBA_LO); }
  function tubaFifth(tHz, ch) {
    var r = tubaRoot(tHz, ch), g = intoRange(toneHz(tHz, ch, ch.fifth), TUBA_LO);
    if (g > r) g /= 2;
    return g < 44 ? g * 2 : g;
  }
  // role: "plain" (the tune on top), "bass" (the tune in the low brass),
  // "trio" (soft, held), "grand" (full)
  // THE PAH KEEPS OFF THE TUNE'S SEMITONE: an after-beat chord tone within
  // a semitone of a tune note sounding with it,
  // in any octave — the tune's passing fa against the alto horns' mi, 112
  // cents — is left out, the bandmaster's courtesy (the chord's other tones
  // still speak). Read over the whole march at once, so the next strain's
  // pickup in the last bar of this one, or the first strain's under the
  // introduction's vamp, is heard too. A held chord (the trio's) keeps off
  // only the note it begins with; a passing note across it is the tune's.
  function offTheTune(ev) {
    var tune = ev.filter(function (e) { return e.part === "melody" && !e.doubling; }).sort(function (x, y) { return x.m - y.m; });
    var longest = 0; tune.forEach(function (n) { longest = Math.max(longest, n.len); });
    function semi(a, b) { var c = ((1200 * Math.log(a / b) / Math.LN2) % 1200 + 1200) % 1200; c = Math.min(c, 1200 - c); return c > 60 && c < 150; }
    function from(m) { var lo = 0, hi = tune.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (tune[mid].m < m) lo = mid + 1; else hi = mid; } return lo; }
    return ev.filter(function (e) {
      if (e.part !== "alto" || e.strain === "stinger") return true;
      var until = e.len > 0.5 ? e.m + 1e-6 : e.m + e.len;
      for (var i = from(e.m - longest - 1e-6); i < tune.length && tune[i].m < until; i++) {
        var n = tune[i];
        if (n.m + n.len > e.m + 1e-6 && semi(e.f, n.f)) return false;
      }
      return true;
    });
  }
  function partsOf(st, o) {
    var ev = [], mode = o.mode, tHz = o.tHz, dyn = o.dyn, role = o.role, beats = o.bars * 2;
    var AFTER = o.meter === "6/8" ? (o.pahPah ? [1 / 3, 2 / 3] : [2 / 3]) : [0.5];
    var trio = role === "trio";
    st.notes.forEach(function (n) {
      var down = Math.abs(n.m - Math.round(n.m / 2) * 2) < 1e-6, stacc = !trio && n.len <= 0.5 + 1e-6;
      if (role === "bass") {
        var fl = tHz * ratio(n.monzo) * o.octLow;
        ev.push({ m: n.m, len: n.len, part: "melody", inst: "tuba", f: fl, dyn: dyn, acc: down, stacc: stacc });
        ev.push({ m: n.m, len: n.len, part: "melody", inst: "alto", f: fl * 2, dyn: dyn * 0.9, acc: down, stacc: stacc, doubling: true });
        return;
      }
      var f = tHz * ratio(n.monzo) * o.octTune;
      ev.push({ m: n.m, len: n.len, part: "melody", inst: "cornet", f: f, dyn: dyn * (down ? 1 : 0.94), acc: down && !trio, stacc: stacc });
      if (o.cornet2 && n.len >= 0.5 - 1e-6) ev.push({ m: n.m, len: n.len, part: "cornet2", inst: "cornet", f: under(f, chordAt(st, n.m), tHz, n, mode), dyn: dyn * 0.82, acc: false, stacc: stacc });
    });
    for (var b = 0; b < beats; b++) {
      var ch = chordAt(st, b), down = b % 2 === 0;
      if (trio) {
        if (down) ev.push({ m: b, len: 1.7, part: "bass", inst: "tuba", f: tubaRoot(tHz, ch), dyn: dyn, downbeat: true });
        chordTones(tHz, chordAt(st, b), ALTO_LO).forEach(function (g) { ev.push({ m: b, len: 0.92, part: "alto", inst: "alto", f: g, dyn: dyn * 0.8 }); });
        continue;
      }
      // (the oom on the root, the pah on the fifth below — the root again
      // wherever the chord has just changed)
      var fresh = b > 0 && chordAt(st, b - 1) !== ch;
      if (role !== "bass") ev.push({ m: b, len: 0.5, part: "bass", inst: "tuba", f: down || fresh ? tubaRoot(tHz, ch) : tubaFifth(tHz, ch), dyn: dyn, acc: down, stacc: true, downbeat: down });
      AFTER.forEach(function (x) {
        var c2 = chordAt(st, b + x), lo = role === "bass" ? CORNET_PAH_LO : ALTO_LO, inst = role === "bass" ? "cornet" : "alto";
        chordTones(tHz, c2, lo).forEach(function (g) { ev.push({ m: b + x, len: 0.28, part: "alto", inst: inst, f: g, dyn: dyn * (role === "bass" ? 0.7 : 0.85), stacc: true }); });
      });
    }
    return ev;
  }
  // the drums, kept light — { m, kind, dyn }: the bass drum on the downbeat
  // (and every beat in the grandioso), the snare tapping the after-beat, a
  // flam every fourth bar; "rollTo" is a five-stroke roll whose accent lands
  // on m (the next strain's downbeat); the trio has the bass drum alone
  function drumsOf(o) {
    var ev = [], beats = o.bars * 2, d = o.drum, six = o.meter === "6/8";
    for (var b = 0; b < beats; b++) {
      var down = b % 2 === 0, bar = Math.floor(b / 2);
      if (o.role === "trio") { if (down) ev.push({ m: b, kind: "bass", dyn: d * 0.55 }); continue; }
      if (down || o.role === "grand") ev.push({ m: b, kind: "bass", dyn: d * (down ? 1 : 0.7) });
      if (down && bar % 4 === 0 && b > 0) ev.push({ m: b, kind: "flam", dyn: d * 0.75 });
      if (six) ev.push({ m: b + 2 / 3, kind: "snare", dyn: d * 0.55 });
      else {
        ev.push({ m: b + 0.5, kind: "snare", dyn: d * 0.5 });
        if (o.role === "grand" || (o.dotted && !down)) ev.push({ m: b + 0.75, kind: "snare", dyn: d * 0.38 });
      }
    }
    if (o.rollOut) ev.push({ m: beats, kind: "rollTo", dyn: d * 0.85 });
    return ev;
  }
  // THE STREET BEAT — after the stinger the band marches on to its drums
  // alone, as a band on parade does between marches: a four-bar phrase over
  // and over (the bass drum on every step; the snare's taps, a roll landing
  // on the second beat of the second bar, a flam on each beat of the fourth),
  // `phrases` times from m0 — { m, kind, dyn }
  function cadenceOf(m0, phrases, meter, d) {
    var ev = [], six = meter === "6/8", taps = six ? [2 / 3, 1, 1 + 2 / 3] : [0.5, 1, 1.5];
    for (var p = 0; p < phrases; p++) for (var bar = 0; bar < 4; bar++) {
      var m = m0 + (p * 4 + bar) * 2;
      ev.push({ m: m, kind: "bass", dyn: d });
      if (bar === 3) { ev.push({ m: m, kind: "flam", dyn: d * 0.8 }, { m: m + 1, kind: "flam", dyn: d * 0.7 }); continue; }
      if (bar === 1) {
        ev.push({ m: m + (six ? 1 / 3 : 0.5), kind: "snare", dyn: d * 0.5 }, { m: m + 1, kind: "rollTo", dyn: d * 0.7 }, { m: m + (six ? 1 + 2 / 3 : 1.5), kind: "snare", dyn: d * 0.45 });
        continue;
      }
      if (bar === 0) ev.push({ m: m, kind: "flam", dyn: d * 0.75 });
      taps.forEach(function (x, j) { ev.push({ m: m + x, kind: "snare", dyn: d * (j === 1 ? 0.55 : 0.45) }); });
    }
    return ev;
  }
  // THE INTRODUCTION, four bars: the tune's head in octaves by the whole
  // band then two bars on the dominant ("unison"); four bars of oom-pah,
  // I I V V7 ("vamp"); or the drums' roll-off alone and then the dominant
  // ("rolloff") — the way a marching band strikes up
  function introOf(kind, A, o) {
    var ev = [], dr = [], mode = o.mode, tHz = o.tHz, dyn = o.dyn;
    var I = chordOf(mode, { rootDeg: 0, tones: [[0, 0], [2, 0], [4, 0]] });
    var V = chordOf(mode, { rootDeg: 4, tones: [[4, 0], [6, 0], [1, 0]] });
    var V7 = chordOf(mode, { rootDeg: 4, tones: [[4, 0], [6, 0], [1, 0], [3, 0]] });
    function vamp(b0, chords) {
      chords.forEach(function (ch, k) {
        for (var j = 0; j < 2; j++) {
          var b = b0 + k * 2 + j;
          ev.push({ m: b, len: 0.5, part: "bass", inst: "tuba", f: j ? tubaFifth(tHz, ch) : tubaRoot(tHz, ch), dyn: dyn, acc: !j, stacc: true, downbeat: !j });
          (o.meter === "6/8" ? (o.pahPah ? [1 / 3, 2 / 3] : [2 / 3]) : [0.5]).forEach(function (x) {
            chordTones(tHz, ch, ALTO_LO).forEach(function (g) { ev.push({ m: b + x, len: 0.28, part: "alto", inst: "alto", f: g, dyn: dyn * 0.85, stacc: true }); });
          });
          dr.push({ m: b + (o.meter === "6/8" ? 2 / 3 : 0.5), kind: "snare", dyn: o.drum * 0.5 });
          if (!j) dr.push({ m: b, kind: "bass", dyn: o.drum });
        }
      });
    }
    if (kind === "unison") {
      var head = [], got = 0, m0 = A.notes[0].m;
      for (var i = 0; i < A.notes.length && got < 4 - 1e-6; i++) {
        var n = A.notes[i], len = Math.min(n.len, 4 - got);
        head.push({ m: n.m - m0, len: len, monzo: n.monzo }); got = n.m - m0 + len;
      }
      var octLo = octaveFor(tHz, head, 110);
      head.forEach(function (n) {
        var f = tHz * ratio(n.monzo), down = Math.abs(n.m % 2) < 1e-6;
        ev.push({ m: n.m, len: n.len, part: "melody", inst: "cornet", f: f * o.octTune, dyn: dyn, acc: down, stacc: n.len <= 0.5 });
        ev.push({ m: n.m, len: n.len, part: "melody", inst: "alto", f: f * o.octTune / 2, dyn: dyn, acc: down, stacc: n.len <= 0.5, doubling: true });
        ev.push({ m: n.m, len: n.len, part: "bass", inst: "tuba", f: f * octLo, dyn: dyn, acc: down, stacc: n.len <= 0.5, downbeat: down });
      });
      dr.push({ m: 0, kind: "flam", dyn: o.drum }, { m: 0, kind: "bass", dyn: o.drum });
      vamp(4, [V, V7]);
    } else if (kind === "vamp") vamp(0, [I, I, V, V7]);
    else {
      // the roll-off: flam, flam, a roll to the third beat, flam — the bass drum under
      dr.push({ m: 0, kind: "flam", dyn: o.drum }, { m: 0, kind: "bass", dyn: o.drum }, { m: 1, kind: "flam", dyn: o.drum * 0.8 },
              { m: 2, kind: "rollTo", dyn: o.drum }, { m: 2, kind: "bass", dyn: o.drum }, { m: 3, kind: "flam", dyn: o.drum * 0.8 });
      vamp(4, [V, V7]);
    }
    dr.push({ m: 8, kind: "rollTo", dyn: o.drum * 0.9 });
    return { bars: 4, ev: ev, drums: dr };
  }
  // ARRANGE — one band's whole march, in seconds from its first sound:
  // { meter, beatS, tHz, mode, events, drums, sections, end, hymnId, name }
  // a: that band's dice (shapeOf); o: { homeHz, key, beatS (a second band's pace), maxS }
  function arrange(hymn, a, o) {
    var tune = readTune(hymn), meter = meterFor(tune, a), beatS = o.beatS || beatSOf(a, meter);
    var hv = halves(tune), mode = tune.mode, key = o.key || a.up;
    var tHz = o.homeHz * KEY_UP[key];
    var A = strainOf(tune, hv.A, meter, false), B = strainOf(tune, hv.B, meter, a.dotted), T = A;
    // (a tune too short to halve — a strain under six bars — gives each
    // strain the whole tune; the bass strain and the dotting tell them apart)
    if (!hv.same && barsOf(A, B.pk) < 6) { A = T = strainOf(tune, tune.lines, meter, false); B = strainOf(tune, tune.lines, meter, a.dotted); hv.same = true; }
    [A, B].forEach(function (st) { st.chords.sort(function (x, y) { return x.m - y.m; }); });
    var octTune = octaveFor(tHz, A.notes.concat(B.notes), TUNE_AT), octLow = octaveFor(tHz, B.notes, LOW_TUNE_AT);
    var tT = tHz * 4 / 3, octTrio = octaveFor(tT, T.notes, TRIO_AT);
    var steps = [
      { name: "A", st: A, role: "plain", dyn: 0.72 },
      { name: "A2", st: A, role: "plain", dyn: 0.76, cornet2: a.second2cornet },
      { name: "B", st: B, role: a.bassStrain || hv.same ? "bass" : "plain", dyn: 0.72 },
      { name: "B2", st: B, role: "plain", dyn: 0.8, cornet2: a.second2cornet },
      { name: "trio", st: T, role: "trio", dyn: 0.42, trio: true, gain: 0.63 },
    ];
    if (a.grandioso) steps.push({ name: "grandioso", st: T, role: "grand", dyn: 0.9, trio: true, cornet2: true });
    function beatsOf(list) {
      var b = 8;
      list.forEach(function (s, k) { b += barsOf(s.st, list[k + 1] ? list[k + 1].st.pk : 0) * 2; });
      return b + 2;
    }
    // (the strains shorten to fit: the second B goes first, then the second
    // A, then the grandioso — a march is still a march without its repeats)
    var maxS = o.maxS || MAX_DUR;
    ["B2", "A2", "grandioso"].forEach(function (nm) {
      if (beatsOf(steps) * beatS > maxS) steps = steps.filter(function (s) { return s.name !== nm; });
    });
    var drum = a.snare, ev = [], drums = [], sections = [];
    var intro = introOf(a.intro, A, { mode: mode, tHz: tHz, dyn: a.intro === "unison" ? 0.85 : 0.72, meter: meter, pahPah: a.pahPah, drum: drum, octTune: octTune });
    function put(list, M, sname, dst) { list.forEach(function (e) { var x = Object.assign({}, e); x.m = M + e.m; x.strain = sname; dst.push(x); }); }
    put(intro.ev, 0, "intro", ev); put(intro.drums, 0, "intro", drums);
    sections.push({ name: "intro", m0: 0, m1: 8, gain: 1 });
    var M = 8, last = null;
    steps.forEach(function (s, k) {
      var next = steps[k + 1], bars = barsOf(s.st, next ? next.st.pk : 0);
      var tk = s.trio ? tT : tHz;
      put(partsOf(s.st, { mode: mode, tHz: tk, dyn: s.dyn, role: s.role, bars: bars, meter: meter, pahPah: a.pahPah, cornet2: !!s.cornet2,
                          octTune: s.trio ? octTrio : octTune, octLow: octLow }), M, s.name, ev);
      put(drumsOf({ bars: bars, drum: drum * (s.role === "grand" ? 1.2 : 1), meter: meter, role: s.role, dotted: s.name.charAt(0) === "B" && a.dotted,
                    rollOut: !!next && (next.name === "B" || next.name === "grandioso") }), M, s.name, drums);
      sections.push({ name: s.name, m0: M, m1: M + bars * 2, gain: s.gain || 1, role: s.role });
      last = { s: s, M: M, tk: tk };
      M += bars * 2;
    });
    // the STINGER: one short tonic chord, on the after-beat once the last note has gone
    var lastEnd = last.M + last.s.st.endM, mS = Math.ceil(lastEnd * 2 - 1e-6) / 2;
    if (Math.abs(mS - Math.round(mS)) < 1e-6) mS += 0.5;
    var I = chordOf(mode, { rootDeg: 0, tones: [[0, 0], [2, 0], [4, 0]] }), tk = last.tk, oct = last.s.trio ? octTrio : octTune;
    ev.push({ m: mS, len: 0.3, part: "bass", inst: "tuba", f: tubaRoot(tk, I), dyn: 0.95, acc: true, stacc: true, strain: "stinger" });
    chordTones(tk, I, ALTO_LO).forEach(function (g) { ev.push({ m: mS, len: 0.3, part: "alto", inst: "alto", f: g, dyn: 0.9, acc: true, stacc: true, strain: "stinger" }); });
    ev.push({ m: mS, len: 0.3, part: "melody", inst: "cornet", f: nearOct(tk * oct, TUNE_AT), dyn: 0.95, acc: true, stacc: true, strain: "stinger" });
    drums.push({ m: mS, kind: "bass", dyn: drum * 1.2, strain: "stinger" }, { m: mS, kind: "flam", dyn: drum, strain: "stinger" });
    var endM = mS + 1;
    // …and the drums carry it off: the street beat from the next bar, for
    // about CAD_S seconds (whole phrases), while the road carries the band
    // round the far end of the colony (score, perform: out of hearing). The
    // march ends at the stinger — the meeting waits for no drum.
    var cadM = Math.ceil(endM / 2 - 1e-9) * 2, phrases = Math.max(2, Math.ceil(CAD_S / (8 * beatS)));
    cadenceOf(cadM, phrases, meter, drum * 0.9).forEach(function (e) { e.strain = "cadence"; drums.push(e); });
    var goneM = cadM + phrases * 8;
    function sec(e) {
      var x = Object.assign({}, e);
      x.t = e.m * beatS; x.dur = e.len != null ? e.len * beatS : 0;
      x.bar = Math.floor(e.m / 2 + 1e-9); x.beat = +(e.m - x.bar * 2).toFixed(4); x.downbeat = !!e.downbeat;
      return x;
    }
    var events = offTheTune(ev).map(sec).sort(function (x, y) { return x.t - y.t; });
    var drumEv = drums.map(sec).sort(function (x, y) { return x.t - y.t; });
    return {
      meter: meter, beatS: beatS, tHz: tHz, key: key, mode: mode, events: events, drums: drumEv,
      sections: sections.map(function (s) { return { name: s.name, t0: s.m0 * beatS, t1: s.m1 * beatS, gain: s.gain, role: s.role || null }; }),
      end: endM * beatS, cadence: { t0: cadM * beatS, t1: goneM * beatS }, gone: goneM * beatS,
      hymnId: tune.id, name: tune.name, strains: steps.map(function (s) { return s.name; }), intro: a.intro,
    };
  }

  // ==========================================================================
  // PREPARE — the march (or two), written from the day's hymn (pure)
  // ==========================================================================
  function homeOf(m) { return m.homeHz || (m.keynoteHz || 260) * (m.keyMonzo ? ratio(m.keyMonzo) : 1); }
  function prepare(material, stream) {
    if (material && material.prepared) return material;
    material = material || {};
    var sh = shapeOf(stream), home = homeOf(material);
    var one = arrange(material.hymn, sh.a, { homeHz: home, maxS: MAX_DUR - 4 });
    var bands = [one];
    if (material.second && material.second.hymn) {
      // the second band: the other way, in another key (never the first's),
      // at a pace of its own against the first's, entering partway through
      var k2 = sh.b2.key === one.key ? (one.key === "fifth" ? "fourth" : "fifth") : sh.b2.key;
      var room = one.end * (1 - sh.b2.enter) + 18;
      bands.push(arrange(material.second.hymn, sh.b, { homeHz: home, key: k2, beatS: one.beatS / sh.b2.tempo, maxS: Math.min(MAX_DUR - 4, room) }));
    }
    return { prepared: true, shape: sh, bands: bands, homeHz: home, enter2: sh.b2.enter, hymnId: one.hymnId };
  }

  // ==========================================================================
  // THE ROAD — a passer-by's distance, √(D² + x²), on the distance scale
  // ==========================================================================
  // (d = 0 is the meetinghouse doorway, 6 m; d = 1 the far end of the colony,
  // 480 m, on a log scale, as the ear hears distance.) The band is heard
  // first at farD, passes nearest (nearD) crossAt of the way through its
  // march, and walks on; its side is the sine of where it stands.
  var R0 = 6, RSPAN = 80;
  function dOfR(r) { return Math.max(0, Math.min(1, Math.log(r / R0) / Math.log(RSPAN))); }
  function rOfD(d) { return R0 * Math.pow(RSPAN, d); }
  // (len: the march, to its stinger; tail: the drums after it — the road
  // goes on under them, at the same pace)
  function roadOf(len, a, fromWest, still, tail) {
    var tc = a.crossAt * len, pts = [];
    len += tail || 0;
    if (still) return { tc: tc, points: [{ t: 0, d: a.nearD, side: 0 }, { t: len + 6, d: a.nearD, side: 0 }] };
    var D = rOfD(a.nearD), v = Math.sqrt(Math.max(1, rOfD(a.farD) * rOfD(a.farD) - D * D)) / Math.max(1, tc);
    var sign = fromWest ? 1 : -1;
    function at(t) { var x = v * (t - tc), r = Math.sqrt(D * D + x * x); return { t: +t.toFixed(3), d: +dOfR(r).toFixed(4), side: +(sign * 0.92 * x / r).toFixed(4) }; }
    for (var t = 0; t < len + 6; t += 1) { if (t < tc && t + 1 > tc) pts.push(at(t), at(tc)); else pts.push(at(t)); }
    pts.push(at(len + 6));
    return { tc: tc, points: pts };
  }
  function dAt(pts, t) {
    if (t <= pts[0].t) return pts[0].d;
    for (var i = 1; i < pts.length; i++) if (t <= pts[i].t) return pts[i - 1].d + (pts[i].d - pts[i - 1].d) * (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t);
    return pts[pts.length - 1].d;
  }

  // ==========================================================================
  // SCORE — the whole passage as data (pure): each band's march placed at
  // its start, its road, and the moments the minutes tell
  // ==========================================================================
  var KEY_WORD = { fifth: "a fifth away", fourth: "a fourth away", tone: "a tone away" };
  function score(material, stream, t0, opts) {
    t0 = t0 || 0; opts = opts || {};
    var P = prepare(material, stream), sh = P.shape, out = { bands: [], stages: [], end: t0, prepared: P };
    P.bands.forEach(function (bd, k) {
      var a = k ? sh.b : sh.a, fromWest = k ? !sh.a.fromWest : a.fromWest;
      var start = t0 + (k ? P.enter2 * P.bands[0].end : 0), rd = roadOf(bd.end, a, fromWest, !!opts.still, bd.gone - bd.end);
      var pts = rd.points.map(function (p) { return { t: +(start + p.t).toFixed(3), d: p.d, side: p.side }; });
      function loud(t) { return +Math.max(0, Math.min(1, (0.97 - dAt(pts, t)) / (0.97 - a.nearD))).toFixed(3); }
      var ev = bd.events.map(function (e) { var x = Object.assign({}, e); x.t = +(start + e.t).toFixed(4); x.loud = loud(x.t); return x; });
      var dr = bd.drums.map(function (e) { var x = Object.assign({}, e); x.t = +(start + e.t).toFixed(4); return x; });
      var side = fromWest ? "west" : "east", other = fromWest ? "east" : "west";
      out.bands.push({ k: k, start: start, end: start + bd.end, gone: start + bd.gone, cadence: { t0: start + bd.cadence.t0, t1: start + bd.cadence.t1 },
                       events: ev, drums: dr, path: pts, tc: start + rd.tc, nearD: a.nearD,
                       sections: bd.sections.map(function (s) { return { name: s.name, t0: start + s.t0, t1: start + s.t1, gain: s.gain, role: s.role }; }),
                       meter: bd.meter, beatS: bd.beatS, key: bd.key, tHz: bd.tHz, hymnId: bd.hymnId, name: bd.name, strains: bd.strains, intro: bd.intro, from: side });
      var what = (bd.meter === "6/8" ? "a quickstep" : "a march") + " · " + KEY_WORD[bd.key];
      out.stages.push({ stage: k ? "second" : "approaches", band: k, t0: start, side: side, label: k ? "⇋ a second band approaches" : "⇋ a band approaches",
                        detail: "from the " + side + " · " + (k ? "another key" : "its own key"), what: what, hymnId: bd.hymnId, meter: bd.meter, strains: bd.strains });
      // (its nearest: a band going by, in its own key and its own time; the
      // bands CROSS only when a second is nearest while the first still plays)
      var both = k > 0 && start + rd.tc < out.bands[0].end;
      out.stages.push({ stage: "cross", band: k, t0: start + rd.tc, side: side, both: both, label: both ? "⇋ the bands cross" : k ? "⇋ the second band goes by" : "⇋ the band goes by",
                        detail: both ? "two times at once" : "its own key, its own time" });
      out.stages.push({ stage: "passes", band: k, t0: start + bd.end, side: other, label: "⇋ passes on", detail: k ? "the second band" : "" });
      out.end = Math.max(out.end, start + bd.end);
      out.gone = Math.max(out.gone || 0, start + bd.gone);
    });
    out.stages.sort(function (x, y) { return x.t0 - y.t0; });
    return out;
  }

  // ==========================================================================
  // PERFORM — the band (or two) in the street, placed at t (reads no clock)
  // ==========================================================================
  // Each band is a KOLOB.VoicesBand made with no distance of its own, played
  // into a road (VoicesBand.road) that carries it past; both roads share one
  // town's air. Its march is laid out a bar at a time, each bar AHEAD
  // seconds before it sounds (hooks.defer, on the engine's clock), so no one
  // callback builds more than a bar of nodes; a lab with no clock lays it
  // all out at once.
  var AHEAD = 2.5, SLICE_BARS = 1, SPACE = 0.12;
  function perform(ctx, dest, t, material, stream, hooks) {
    var VB = window.KOLOB.VoicesBand;
    if (!VB || !VB.road) throw new Error("KOLOB.GuestBands: load kolob-voices-band.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t, { still: !!hooks.still }), synth = need(stream).fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL * (sc.bands.length > 1 ? 0.85 : 1); bus.connect(dest);
    // (the town's air is borrowed — made ahead by VoicesBand.warm — so no
    // convolver is built in this callback; a second band is built in a
    // callback of its own, just before it strikes up)
    var town = VB.lendTown ? VB.lendTown(ctx, bus, { seconds: 2.6 }) : VB.townRoom(ctx, bus, { seconds: 2.6 }), made = [];
    // (every callback of the passage at a moment of its own: the engine's
    // clock fires every cue inside its quarter-second look-ahead in one
    // wake, so two callbacks within GAP of each other would share one)
    var taken = [], GAP = 0.05;
    function slot(at) {
      for (var moved = true; moved;) {
        moved = false;
        for (var q = 0; q < taken.length; q++) if (Math.abs(taken[q] - at) < GAP) { at = taken[q] + GAP + 0.01; moved = true; }
      }
      taken.push(at);
      return at;
    }
    sc.bands.forEach(function (bd) {
      var echo = synth.rnd(0.19, 0.31), me = { bd: bd, band: null, road: null };
      made.push(me);
      function build() {
        if (me.band) return me.band;
        var rd = VB.road(ctx, bus, { room: town, echoDelay: echo });
        rd.path(bd.path);
        var band = VB.create(ctx, rd.input, { rand: synth.fork("band:" + bd.k), side: 0, spread: 0.3, gain: 1 });
        // the conductor's dynamics: the trio played softer by the whole band
        var og = band.out.gain;
        og.setValueAtTime(0.8 * bd.sections[0].gain, bd.start);
        bd.sections.forEach(function (s, i) {
          if (i === 0) return;
          og.setValueAtTime(0.8 * bd.sections[i - 1].gain, Math.max(bd.start, s.t0 - 0.35));
          og.linearRampToValueAtTime(0.8 * s.gain, s.t0 + 0.05);
        });
        // over the rise: past the colony's last houses the drums go out of
        // hearing — the band's gain falls AWAY_DB across the street beat, on
        // top of what the road's distance takes (whose scale ends at the
        // colony's far end, 13.5 dB down: no road alone reaches silence)
        var lastG = 0.8 * bd.sections[bd.sections.length - 1].gain;
        og.setValueAtTime(lastG, bd.cadence.t0);
        og.exponentialRampToValueAtTime(lastG * Math.pow(10, AWAY_DB / 20), bd.cadence.t1);
        og.setTargetAtTime(0, bd.cadence.t1, 0.3);
        me.band = band; me.road = rd;
        return band;
      }
      var sliceS = SLICE_BARS * 2 * bd.beatS, slices = [];
      bd.events.forEach(function (e) { var i = Math.max(0, Math.floor((e.t - bd.start) / sliceS)); (slices[i] = slices[i] || { ev: [], dr: [] }).ev.push(e); });
      bd.drums.forEach(function (e) { var i = Math.max(0, Math.floor((e.t - bd.start) / sliceS)); (slices[i] = slices[i] || { ev: [], dr: [] }).dr.push(e); });
      var setUpAt = bd.start - AHEAD - 0.4;
      if (hooks.defer && setUpAt > t) hooks.defer(slot(setUpAt), build); else build();
      // (only the first band's first bar at the press; each bar after it a
      // callback of its own, AHEAD of its sound — and never two in one tick
      // of the clock: a bar already inside the look-ahead waits SPACE seconds
      // after the last. A second band's first bar is a callback too: the
      // press builds one band, never two; and its bars, and its building,
      // take a moment no other callback of the passage has taken — slot().)
      slices.forEach(function (sl, i) {
        if (!sl) return;
        var at = Math.max(bd.start + i * sliceS - AHEAD, t + SPACE * i);
        if (hooks.defer && (i > 0 || bd.k > 0)) hooks.defer(slot(at), function () { lay(build(), bd, sl); });
        else lay(build(), bd, sl);
      });
    });
    function lay(band, bd, sl) {
      sl.ev.forEach(function (e) {
        band.play(e.t, [{ f: e.f, dur: e.dur, acc: !!e.acc, stacc: !!e.stacc, dyn: e.dyn }], e.inst);
        if (hooks.onNote) hooks.onNote({ freq: e.f, t: e.t, dur: e.dur, part: e.part, inst: e.inst, band: bd.k, strain: e.strain, bar: e.bar, beat: e.beat,
                                          downbeat: !!e.downbeat, doubling: !!e.doubling, beatS: bd.beatS, meter: bd.meter, loud: e.loud, hymnId: bd.hymnId });
      });
      sl.dr.forEach(function (e) {
        if (e.kind === "rollTo") band.drum(Math.max(bd.start, e.t - VB.LEAD.roll), "roll", e.dyn);
        else band.drum(e.t, e.kind, e.dyn);
      });
    }
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    // when the last of the town's air has died, let every band and its road go
    var tail = sc.gone + 5;
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () {
      made.forEach(function (m) { if (m.band) { m.band.dispose(); m.road.dispose(); } });
      town.dispose();
      try { sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) {}
    };
    sent.start(Math.max(0, t)); sent.stop(tail);
    perform.last = { made: made, score: sc, bus: bus };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform,
    readTune: readTune, arrange: arrange, shape: shapeOf,
    ODDS: ODDS, EXCLUDES: EXCLUDES, SEATS: SEATS, AT: AT, NAME: NAME, LABEL: LABEL, MAX_DUR: MAX_DUR,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-bands.js"] = true;   // the load guard's roll call
