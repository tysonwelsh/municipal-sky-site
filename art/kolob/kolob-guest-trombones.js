// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE TROMBONE CHOIR AT DAWN (KOLOB.GuestTrombones)
//
// In Bethlehem, Pennsylvania, the Moravians have kept a trombone choir since
// 1754: soprano, alto, tenor and bass trombones, which climb the belfry to
// announce a death in the congregation, a feast, the turn of the year, and
// play chorales down onto the sleeping town. In Salem, North Carolina, since
// 1772, the Easter sunrise service begins in the dark: brass choirs stand in
// different streets and play chorales to one another, a phrase here, the
// next phrase there, while the people walk to the graveyard to meet the sun.
//
// At the rim of Kolob's light the colony keeps the custom. Some Sundays,
// in the first minute of the prelude — dawn, on the meeting's arc of light —
// a trombone choir far across the settlement plays a line of the day's
// first hymn as a slow chorale. A second choir, nearer and on the other
// side, answers with the next line. Two to four exchanges, soft, the far
// one dark and wide with the town's air, the near one round and present;
// the near choir brings the hymn home, and sometimes the far choir joins
// its last chord. The first hymn is heard before anyone sings it.
//
// THE SEAT. plan(meetingInfo, stream) decides whether this meeting has the
// choir: about one meeting in five as the engine stands (a conditional
// chance, weighted up on conference and jubilee Sundays — and on the
// calendar's Easter, Christmas, funerals and dedications when those exist —
// and down on fast Sundays), and NEVER in a meeting that also has the
// crossing bands. It sits only in the prelude, at a moment in the first
// minute, and it will not share the prelude with another guest (the
// steeples and the old tune seat there too; two far-off events at dawn
// would be one blur). Every die is drawn before any refusal, so a refusal
// never moves another draw.
//
// THE MATERIAL. perform(ctx, dest, t, material, stream) plays the day's
// first hymn. Until the hymn composer exists, the engine passes Harmony's
// four-part harmonization, and this module takes it in any of these shapes:
//   · { mode, keynoteHz, lines: [line, …] }, each line a list of chords:
//       [B, T, A, S] degree arrays, or {degs: [B,T,A,S], beats, fermata},
//       or exactly what Harmony.harmonize() returns ({chord: {voicing}, dur});
//     or { mode, keynoteHz, chords: [chord, …], lineLengths: [8, 6, 8, 6] };
//     with, best, tune: { space: "d7", lines: [[deg, …], …] } — the melody
//     those chords harmonize, one note per chord, so the soprano keeps the
//     tune's own octaves (Harmony folds each note into range separately);
//   · { mode, keynoteHz, melody: [{deg, beats}, …], lineLengths } or
//     { …, melodyLines: [[…], …] } — the fallback: harmonized here;
//   · { hymn: <a SCORE Hymn>, keynoteHz } — an Earth tune, or the composer's
//     hymn when it lands: every part the Score has, with its own rhythm.
// Degrees are COLLECTION indices unless material.space is "d7": 0 is the
// keynote, the mode's size (7, 6 or 5) the octave above, as degFreq takes
// them; "d7" means the motif engine's 7-degree space (projected, as
// projDeg does). Anything empty or unreadable falls back to this mode's
// sample hymn: a guest never throws in the middle of a meeting.
//
// THE TUNING. Each chord is tuned justly by a small search: every tone may
// lean a syntonic comma (81/80) up or down, and the choice that leaves the
// fewest sour thirds and fifths, moving the fewest tones (the tonic almost
// never; the two-fifths tones re and te first), wins. That turns the ii
// chord's 40/27 wolf into a pure fifth (re at 10/9), and the minor modes'
// III and v and VII into pure triads (te at 9/5, re at 10/9) — the wolves the
// wave-1 critic heard in the Question's chorale. Harmony's own frequencies
// are therefore NOT used unless material.trustFreqs is set; its degrees are.
//
// THE VOICING. The chords are the engine's; who plays which of their tones,
// and in which octave, is the choir's. Harmony voices each chord for its
// own soprano and then pins the tune over it, so its alto can stand above
// the melody and its parts move in blocks — fifths and octaves in parallel,
// leaps of an octave in every part (it rewards parallel fifths: the
// dispersed harmony of the Sacred Harp, right for the ward, wrong for a
// Moravian chorale). So the soprano is set to the tune, and the lower three
// are voiced again under it by the fallback harmonizer's own voicer, one
// pass over the whole chorale: inner voices near, no parallels, no
// crossing, each line closing in root position. Over 66 tunes (1,882
// chords) of the engine's Harmony that took the parallel fifths and octaves
// from about 1,900 to about 30, and the inner voices' leaps past a fifth
// from about 650 to about 10.
// Then the whole chorale is placed in the trombones' ranges: the choir plays
// it where the instruments are warm (an octave down if it sits high), and a
// part that still strays is folded line by line.
//
// THE PLAYERS. Four parts on three instruments of KOLOB.VoicesBand:
// soprano on the alto trombone, alto and tenor on tenor trombones, bass on
// the bass trombone (a three-part shape-note tune plays S, T, B). Each
// choir is its own band with a distance (far ≈ 0.8, near ≈ 0.25), a side
// (opposite sides of the stereo field) and a spread (the far choir is one
// point; the near one has width); both share one town room, so they stand
// in the same place. However the dice fell for their distances and
// dynamics, the far choir is trimmed to be heard 7–9 LU under the near
// one (a drawn gap; the lab measures it within about 1.5 LU of the draw),
// so the antiphony never collapses into two equal choirs. It is also
// darker, by how far it stands: 3–9 dB poorer above 1 kHz over seeds 1–12
// (about 5.5 at the median), 12 dB at the far end of its distance — and at
// the near end of it (farDist under 0.8, about four seeds in ten) the two
// choirs' colour is nearly the same, and "far" is heard in the level, the
// side and the town's air (the round-2 critic's measure). Each phrase is an arch — a
// breath attack, a swell to its middle, a fade on the fermata — and a
// repeated line comes back softer. In a minor mode the near choir may end
// on a major chord (the tierce de Picardie: the dawn's own answer).
//
// PURE PLANNING. plan(), score(), chorale(), harmonize() and decide() touch
// no AudioContext, DOM, clock or Math.random; every die comes from the
// stream passed in. Musical dice and sound-level dice live on separate
// forks of it: "seat" (the odds and the moment), "shape" (the exchanges,
// tempo, sides, distances, dynamics — so plan() and perform() agree without
// passing anything between them: a fork derives from the stream's birth
// seed, whatever has been drawn since), and "synth" (the players' detune,
// the echo's delay). perform() reads no clock either: everything is placed
// at or after the t it is given.
//
// Public surface: window.KOLOB.GuestTrombones
//   plan(meetingInfo, stream) → { guest, seat: "prelude", at, dur, holdUntil,
//        exchanges, lines, estimated, odds, logged: true } | null
//     meetingInfo: { n, kind: "ordinary"|"fast"|"conference"|"jubilee",
//       sunday?: "easter"|"christmas"|"funeral"|"dedication"|"pioneer"|…,
//       sections: [{type, dur}], guests: [{type, section}], material?, force? }
//     (with material — best, a prepared chorale — dur is exact; without it,
//     an estimate from a nominal Common Meter hymn, and estimated: true)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { onNote({freq, t, dur, part, choir, line, loud}), onPhrase(ph),
//              only: "far"|"near" (a lab's solo; the engine never sets it) }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }   (plan, explained)
//   score(material, stream, t0) → the whole performance as data (pure)
//   chorale(material) → the material, read, tuned, voiced and placed (pure);
//     itself material — pass it to plan() and perform() (see chorale)
//   harmonize(mode, melodyLines) → chords, four parts (pure, deterministic)
//   SAMPLES (a short hymn melody per mode), ODDS, EXCLUDES, LEVEL, LABEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestTrombones = (function () {
  "use strict";

  var NAME = "trombones";
  var LABEL = "guest:trombones:";                 // the stream's label: + the meeting number

  // ==========================================================================
  // THE ODDS — a starting point, for the owner's ear
  // ==========================================================================
  // p = base × weight[sunday or kind], capped. The base is conditional: the
  // choir is refused when the bands are seated (≈36 % of meetings) or another
  // guest holds the prelude (≈11 %), so base 0.34 comes out at about one
  // meeting in five over the engine's present mix of Sundays (the harness
  // and the lab's odds card measure it against the real planner).
  var ODDS = {
    base: 0.34,
    weight: {
      ordinary: 1, fast: 0.35, conference: 1.5, jubilee: 1.5,
      // the Sunday calendar (PLAN-COMPOSITION §7.1), when it exists
      easter: 2.6, christmas: 2.1, funeral: 2.1, dedication: 2.6,
      pioneer: 0.9, wedding: 1,
    },
    cap: 0.9,
  };
  var EXCLUDES = ["bands"];                       // never with the crossing bands
  var AT = [4, 14];                                // the moment in the prelude, s
  var MAX_DUR = 90;                                // the exchanges shorten to fit
  // the guest's own bus. At 1.15 the dawn's loudest 3 s (the near choir)
  // sit 2–4 LU under the organ reference in the lab (six modes, both
  // sources: handoff r2-trombones-1) — in the app
  // (where the organ layer plays at 0.52 into both rooms, and a guest goes
  // to the wide room alone) that is about the organ's own level at dawn; the
  // far choir sits some 7–9 LU under it. For the owner's ear.
  var LEVEL = 1.15;

  function oddsFor(info) {
    var w = ODDS.weight;
    var k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }

  // ==========================================================================
  // THE SHAPE — the musical dice of one performance, all drawn, in order
  // ==========================================================================
  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestTrombones: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      exchanges: r.pickW([[2, 5], [3, 3], [4, 1.2]]),
      beatS: r.rnd(1.0, 1.28),         // the near choir's pace: seconds per melody note
      farLag: r.rnd(1.0, 1.07),        // the far choir's leader takes it a shade slower
      farLeft: r.chance(0.5),
      farPan: r.rnd(0.55, 0.85),
      nearPan: r.rnd(0.25, 0.5),
      farDist: r.rnd(0.74, 0.88),
      nearDist: r.rnd(0.16, 0.3),
      farDyn: r.rnd(0.52, 0.62),       // mp–mf where they stand: the distance takes the rest
      nearDyn: r.rnd(0.4, 0.5),        // p–mp: close, present, and early
      gap: r.rnd(0.5, 1.4),            // how long the answer waits after the call lets go
      fermata: r.rnd(1.7, 2.3),        // the line's last chord, held
      swell: r.rnd(0.08, 0.16),        // each phrase's arch
      farAtk: r.rnd(0.22, 0.4),        // a breath attack on a phrase's first chord
      nearAtk: r.rnd(0.12, 0.22),
      together: r.chance(0.35),        // the far choir joins the last chord
      picardy: r.chance(0.55),         // a minor hymn ends major
      flatCents: r.rnd(0, 3),          // cold brass across the town, a hair flat
      echoSoft: r.rnd(0.78, 0.9),      // a repeated line comes back softer
      gapLu: r.rnd(7, 9),              // how much quieter the far choir is heard than the near one
    };
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), at = rs.rnd(AT[0], AT[1]);          // every die, first
    var sh = shapeOf(stream);
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [];
    var prelude = null;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === "prelude") { prelude = secs[i]; break; }
    function has(fn) { for (var j = 0; j < guests.length; j++) if (guests[j] && fn(guests[j])) return true; return false; }
    if (!prelude) why = "no prelude";
    else if (has(function (g) { return EXCLUDES.indexOf(g.type) >= 0; })) why = "the bands are coming";
    else if (has(function (g) { return g.section === "prelude" && g.type !== NAME; })) why = "the prelude is taken";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var tl = timeline(info.material ? chorale(info.material) : null, sh);
    var dur = +(tl.end).toFixed(2);
    return {
      seat: {
        guest: NAME, seat: "prelude", at: +at.toFixed(2), dur: dur,
        holdUntil: +(at + dur + 4).toFixed(2),       // the prelude should last at least this long
        exchanges: tl.exchanges, lines: tl.order.length, estimated: !info.material,
        odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // PITCH — the mode's collection, read late from kolob-pitch.js
  // ==========================================================================
  function col(mode) {
    var P = window.KOLOB.Pitch;
    if (!P || !P.COLLECTIONS) throw new Error("KOLOB.GuestTrombones: load kolob-pitch.js first");
    return P.COLLECTIONS[mode] || P.COLLECTIONS.ionian;
  }
  function modeName(mode) { var P = window.KOLOB.Pitch; return P && P.COLLECTIONS[mode] ? mode : "ionian"; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function ratioOf(mode, idx) {
    var c = col(mode), n = c.ratios.length;
    return c.ratios[mod(idx, n)] * Math.pow(2, Math.floor(idx / n));
  }
  function fromD7(mode, d7) {                       // projDeg, for any mode (pure)
    var c = col(mode), n = c.ratios.length;
    if (n === 7) return d7;
    return c.map[mod(d7, 7)] + Math.floor(d7 / 7) * n;
  }
  function cents(r) { return 1200 * Math.log(r) / Math.LN2; }
  function fold(r) { while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; }

  // ---- the comma tuner --------------------------------------------------------
  // Each class present may lean 81/80 either way; the lean that leaves the
  // fewest sour consonances wins, and moving a tone has a price: the tonic
  // 20 (it is the drone's), a tone built from two fifths (9/8, 16/9 —
  // the comma-ambiguous ones) 3, any other 6. What a pair of tones is MEANT
  // to be is read from the mode's own table (a 40/27 is a sour fifth, and
  // stays a fifth); a pair that is no consonance at all there (a passing
  // second) is not the tuner's business.
  var PURE = [0, 315.641, 386.314, 498.045, 701.955, 813.686, 884.359, 1200];
  var VARY = [1, 81 / 80, 80 / 81];
  function meant(a, b) {
    var c = cents(fold(b / a)), best = null, d = 41;
    for (var i = 0; i < PURE.length; i++) if (Math.abs(c - PURE[i]) < d) { d = Math.abs(c - PURE[i]); best = PURE[i]; }
    return best;
  }
  function sour(a, b, target) {
    var c = cents(fold(b / a));
    if (target === 0 && c > 600) c -= 1200;
    if (target === 1200 && c < 600) c += 1200;
    return Math.abs(c - target);
  }
  var TUNED = {};
  function tuneChord(mode, classes) {
    var c = col(mode), n = c.ratios.length;
    var cls = [];
    classes.forEach(function (k) { k = mod(k, n); if (cls.indexOf(k) < 0) cls.push(k); });
    cls.sort(function (a, b) { return a - b; });
    var key = mode + ":" + cls.join(",");
    if (TUNED[key]) return TUNED[key];
    var price = cls.map(function (k) {
      var r = c.ratios[k];
      if (k === 0) return 20;
      return (Math.abs(r - 9 / 8) < 1e-9 || Math.abs(r - 16 / 9) < 1e-9) ? 3 : 6;
    });
    var best = null, bestCost = 1e9, combos = Math.pow(3, cls.length);
    for (var m = 0; m < combos; m++) {
      var pick = [], x = m, cost = 0;
      for (var i = 0; i < cls.length; i++) { pick.push(x % 3); x = Math.floor(x / 3); if (pick[i]) cost += price[i]; }
      for (var a = 0; a < cls.length; a++) for (var b = a + 1; b < cls.length; b++) {
        var tg = meant(c.ratios[cls[a]], c.ratios[cls[b]]);
        if (tg != null) cost += sour(c.ratios[cls[a]] * VARY[pick[a]], c.ratios[cls[b]] * VARY[pick[b]], tg);
      }
      if (cost < bestCost - 1e-9) { bestCost = cost; best = pick; }
    }
    var out = {};
    cls.forEach(function (k, i) { out[k] = VARY[best[i]]; });
    TUNED[key] = out;
    return out;
  }

  // ==========================================================================
  // THE FALLBACK HARMONIZER — four parts under a given melody (pure)
  // ==========================================================================
  // Chorale style, as the Moravians' hymnbooks set it: triads from the
  // mode's own collection (no chromatic chord, no diminished triad), roots
  // moving mostly by fifth and step, a half close on the odd lines, home on
  // the last; contrary and oblique motion, no parallel fifths or octaves, no
  // crossing, the inner voices near. The pentatonic and hexatonic Sundays
  // have no leading tone, so their dominant is the bare fifth sol–re (the
  // open sound of the tunebooks), and the pentatonic's predominant the bare
  // re–la. A short melody note that is not in the chord may pass over held
  // parts. One dynamic-programming pass over the whole tune; deterministic.
  var VOCAB = {
    ionian:     [["I", [0, 2, 4], 0, "T"], ["ii", [1, 3, 5], 1, "S"], ["iii", [2, 4, 6], 2, "R"], ["IV", [3, 5, 0], 3, "S"], ["V", [4, 6, 1], 4, "D"], ["vi", [5, 0, 2], 5, "R"]],
    mixolydian: [["I", [0, 2, 4], 0, "T"], ["ii", [1, 3, 5], 1, "S"], ["IV", [3, 5, 0], 3, "S"], ["v", [4, 6, 1], 4, "D"], ["vi", [5, 0, 2], 5, "R"], ["♭VII", [6, 1, 3], 6, "D"]],
    dorian:     [["i", [0, 2, 4], 0, "T"], ["ii", [1, 3, 5], 1, "S"], ["♭III", [2, 4, 6], 2, "R"], ["IV", [3, 5, 0], 3, "S"], ["v", [4, 6, 1], 4, "D"], ["♭VII", [6, 1, 3], 6, "D"]],
    aeolian:    [["i", [0, 2, 4], 0, "T"], ["♭III", [2, 4, 6], 2, "R"], ["iv", [3, 5, 0], 3, "S"], ["v", [4, 6, 1], 4, "D"], ["♭VI", [5, 0, 2], 5, "R"], ["♭VII", [6, 1, 3], 6, "D"]],
    hexa:       [["I", [0, 2, 4], 0, "T"], ["ii", [1, 3, 5], 1, "S"], ["IV", [3, 5, 0], 3, "S"], ["vi", [5, 0, 2], 5, "R"], ["V⁵", [4, 1], 4, "D"]],
    penta:      [["I", [0, 2, 3], 0, "T"], ["vi", [4, 0, 2], 5, "R"], ["V⁵", [3, 1], 4, "D"], ["ii⁵", [1, 4], 1, "S"]],
  };
  // root motion in 7-degree space: down a fifth is the strongest
  var MOTION = { 0: 0.9, 3: 0, 4: 0.6, 1: 0.5, 5: 0.5, 2: 1.1, 6: 1.3 };
  // the compass the voicer writes in, as ratios of the keynote: the
  // trombones' own, not a singing choir's — the floors are the comfortable
  // floors of RANGE (below) over a middle-C keynote (55, 98 and 147 Hz over
  // 260). A singers' compass (bass from 0.28, alto from 0.7) left a soprano
  // that dips to the keynote no alto under it: one chord in eighteen of the
  // engine's fell back to a plain stack, and its parallels came with it.
  var VOICE = { B: [0.22, 0.95], T: [0.4, 1.4], A: [0.56, 2.0] };

  function indicesIn(mode, lo, hi) {
    var n = col(mode).ratios.length, out = [];
    for (var i = -4 * n; i <= 4 * n; i++) { var r = ratioOf(mode, i); if (r >= lo && r <= hi) out.push(i); }
    return out;
  }
  function cadenceCost(ch, pos, isFirst) {
    // pos: "final" | "open" | "close" | null (not a line end)
    var fn = ch.fn, c = 0;
    if (isFirst) c += fn === "T" ? 0 : 2;
    if (pos === "final") c += fn === "T" ? 0 : 8;
    else if (pos === "open") c += fn === "D" ? 0 : fn === "T" ? 1.5 : 2;
    else if (pos === "close") c += fn === "T" ? 0 : fn === "R" ? 0.6 : fn === "D" ? 1 : 1.8;
    return c;
  }
  // THE VOICER: the SATB seats one chord can take under a given soprano, and
  // the price of moving from one seat to the next — shared by the harmonizer
  // (which chooses its chords) and the re-voicer (which is handed them).
  // A chord here is { cls: [root, third, fifth] (or [root, fifth]: open),
  // open, name }; seats are collection indices [B, T, A, S].
  function voicer(mode) {
    var n = col(mode).ratios.length;
    var Bs = indicesIn(mode, VOICE.B[0], VOICE.B[1]), Ts = indicesIn(mode, VOICE.T[0], VOICE.T[1]), As = indicesIn(mode, VOICE.A[0], VOICE.A[1]);
    function voicings(ch, s) {
      var out = [], has = {};
      ch.cls.forEach(function (k) { has[k] = true; });
      var root = ch.cls[0], third = ch.open ? null : ch.cls[1];
      Bs.forEach(function (b) {
        var bc = mod(b, n), inv = 0;
        if (bc === root) inv = 0; else if (third != null && bc === third) inv = 1.2; else return;
        Ts.forEach(function (tt) {
          if (tt <= b || tt - b > Math.round(n * 1.5) || !has[mod(tt, n)]) return;
          As.forEach(function (a) {
            if (a <= tt || a >= s || a - tt > n || s - a > n || !has[mod(a, n)]) return;
            var v = [b, tt, a, s], cnt = {};
            v.forEach(function (x) { var q = mod(x, n); cnt[q] = (cnt[q] || 0) + 1; });
            var cost = inv;
            // the low-interval limit: a third or a fourth between bass and
            // tenor, down under B♭2, is mud on brass — the tenor stands a
            // fifth or more above a low bass
            if (ratioOf(mode, b) < 0.45 && cents(ratioOf(mode, tt) / ratioOf(mode, b)) < 690) cost += 3;
            if (!ch.open) {
              if (!cnt[ch.cls[1]]) cost += 3;                     // no third
              if (!cnt[ch.cls[2]]) cost += 0.6;                   // no fifth
              if ((cnt[ch.cls[1]] || 0) > 1) cost += 0.8;          // a doubled third
              if (mode === "ionian" && ch.name === "V" && (cnt[6] || 0) > 1) cost += 3;   // a doubled leading tone
            } else if (!cnt[ch.cls[0]] || !cnt[ch.cls[1]]) return;
            out.push({ v: v, cost: cost });
          });
        });
      });
      return out;
    }
    function ivl(a, b) { return mod(Math.round(cents(ratioOf(mode, b) / ratioOf(mode, a))), 1200); }
    function perfect(cc) { return cc < 30 || cc > 1170 || Math.abs(cc - 702) < 30; }
    function move(p, q, breath) {
      var cst = (Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) + 0.4 * Math.abs(q[0] - p[0])) * (breath ? 0.3 : 0.6);
      if (Math.abs(q[1] - p[1]) > n / 2) cst += 1.5;
      if (Math.abs(q[2] - p[2]) > n / 2) cst += 1.5;
      if (Math.abs(q[0] - p[0]) > n) cst += 2;               // a bass leap wider than the octave
      if (breath) return cst;
      for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
        var di = q[i] - p[i], dj = q[j] - p[j];
        if (!di || !dj || (di > 0) !== (dj > 0)) continue;
        var c1 = ivl(p[i], p[j]), c2 = ivl(q[i], q[j]);
        if (perfect(c1) && perfect(c2) && Math.abs(c1 % 1200 - c2 % 1200) < 40) cst += 8;
      }
      var dB = q[0] - p[0], dS = q[3] - p[3];
      if (dB && dS && (dB > 0) === (dS > 0) && Math.abs(dS) > 1 && perfect(ivl(q[0], q[3]))) cst += 1;
      if (q[1] > p[2] || q[2] < p[1]) cst += 0.5;
      return cst;
    }
    return { n: n, voicings: voicings, move: move };
  }

  function harmonize(mode, melodyLines) {
    mode = modeName(mode);
    var n = col(mode).ratios.length;
    var V = VOCAB[mode].map(function (v) { return { name: v[0], cls: v[1], r7: v[2], fn: v[3], open: v[1].length === 2 }; });
    var Vc = voicer(mode), voicings = Vc.voicings, move = Vc.move;
    // the melody, flattened, with its line ends and a register the soprano
    // can sing (its middle near 1.45 × the keynote)
    var notes = [];
    melodyLines.forEach(function (ln, li) {
      ln.forEach(function (nt, k) {
        notes.push({ s: nt.idx, beats: nt.beats, line: li, end: k === ln.length - 1, start: k === 0, last: li === melodyLines.length - 1 && k === ln.length - 1 });
      });
    });
    if (!notes.length) return [];
    var sorted = notes.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
    var med = sorted[Math.floor(sorted.length / 2)], shift = 0, bestD = 1e9;
    for (var k = -3; k <= 3; k++) {
      var dd = Math.abs(Math.log(ratioOf(mode, med + k * n) / 1.45));
      if (dd < bestD) { bestD = dd; shift = k * n; }
    }
    notes.forEach(function (x) { x.s += shift; });
    function lineRole(x) {
      if (!x.end) return null;
      if (x.last) return "final";
      return x.line % 2 === 0 ? "open" : "close";
    }
    // the pass: states per melody note
    var layers = [];
    notes.forEach(function (x, i) {
      var states = [], sc = mod(x.s, n), role = lineRole(x);
      V.forEach(function (ch, ci) {
        if (ch.cls.indexOf(sc) < 0) return;
        voicings(ch, x.s).forEach(function (vc) {
          // a line closes in root position
          states.push({ ci: ci, v: vc.v, own: vc.cost + cadenceCost(ch, role, i === 0) + (x.end && mod(vc.v[0], n) !== ch.cls[0] ? 4 : 0), hold: false });
        });
      });
      // a note no chord can seat (a melody far out of the singers' compass)
      // is doubled plainly rather than breaking the chain
      if (!states.length) {
        var home = 0;
        V.forEach(function (ch, ci) { if (ch.cls.indexOf(sc) >= 0 && !home) home = ci; });
        states.push({ ci: home, v: [x.s - 2 * n, x.s - n, x.s - Math.ceil(n / 2), x.s], own: 50, hold: false });
      }
      layers.push(states);
    });
    // held parts under a short passing note
    var prevLayer = null;
    for (var i2 = 0; i2 < layers.length; i2++) {
      var L = layers[i2], x2 = notes[i2];
      if (prevLayer) {
        var canHold = x2.beats <= 0.5 && !x2.start && !x2.end;
        L.forEach(function (st) { st.cost = 1e9; st.back = -1; });
        if (canHold) {
          prevLayer.forEach(function (ps, pi) {
            if (ps.v[2] >= x2.s) return;
            var step = Math.abs(x2.s - ps.v[3]) === 1;
            L.push({ ci: ps.ci, v: [ps.v[0], ps.v[1], ps.v[2], x2.s], own: step ? 0.4 : 2, hold: true, cost: 1e9, back: -1, holdOf: pi });
          });
        }
        var breath = notes[i2 - 1].end;
        L.forEach(function (st) {
          if (st.hold) { var ps0 = prevLayer[st.holdOf]; st.cost = ps0.cost + st.own; st.back = st.holdOf; return; }
          for (var pj = 0; pj < prevLayer.length; pj++) {
            var ps = prevLayer[pj];
            if (ps.cost >= 1e9) continue;
            var same = ps.ci === st.ci;
            // a hymn changes chord on most notes: staying costs, unless the
            // note is short
            var prog = same ? (x2.beats < 1 ? 0.2 : 1.8 + (ps.v.join() === st.v.slice(0, 3).concat(ps.v[3]).join() ? 0.6 : 0)) : MOTION[mod(V[st.ci].r7 - V[ps.ci].r7, 7)];
            if (!same && V[ps.ci].fn === "D" && V[st.ci].fn === "S") prog += 1.8;       // no retrogression
            // nor a see-saw (I–V–I–V): back to the chord of two notes ago
            var pp = i2 >= 2 && ps.back >= 0 ? layers[i2 - 2][ps.back] : null;
            if (!same && pp && pp.ci === st.ci && pp.ci !== ps.ci) prog += 0.7;
            var cst = ps.cost + st.own + prog + move(ps.v, st.v, breath);
            if (cst < st.cost) { st.cost = cst; st.back = pj; }
          }
        });
      } else L.forEach(function (st) { st.cost = st.own; st.back = -1; });
      prevLayer = L;
    }
    // walk back
    var last = layers[layers.length - 1], bi = -1, bc = 1e9;
    last.forEach(function (st, k2) { if (st.cost < bc) { bc = st.cost; bi = k2; } });
    var out = new Array(notes.length);
    for (var li2 = layers.length - 1; li2 >= 0; li2--) {
      var st2 = layers[li2][bi];
      if (!st2) { st2 = { ci: 0, v: [notes[li2].s - 2 * n, notes[li2].s - n, notes[li2].s - 1, notes[li2].s], hold: false, back: -1 }; }
      out[li2] = { degs: st2.v.slice(), beats: notes[li2].beats, roman: V[st2.ci].name, hold: st2.hold, line: notes[li2].line };
      bi = st2.back;
    }
    // back into lines
    var lines = [];
    out.forEach(function (ch) { (lines[ch.line] = lines[ch.line] || []).push(ch); });
    return lines;
  }

  // ==========================================================================
  // THE SAMPLES — a short hymn tune in each of Kolob's six modes (CM 8.6.8.6,
  // 7-degree space, [deg, beats]): the lab's chorales, and what the choir
  // plays if the engine ever hands it nothing. Written for the choir, in the
  // manner of the tunebooks; none is an Earth tune.
  // ==========================================================================
  var SAMPLES = {
    ionian: [
      [[0, 1], [2, 1], [4, 1], [7, 1], [5, 1], [4, 1], [2, 1], [4, 2]],
      [[4, 1], [5, 1], [7, 1], [5, 1], [4, 1], [2, 2]],
      [[2, 1], [4, 1], [7, 1], [9, 1], [8, 1], [7, 1], [5, 1], [4, 2]],
      [[7, 1], [5, 1], [4, 1], [2, 1], [1, 1], [0, 2]],
    ],
    mixolydian: [
      [[0, 1], [4, 1], [4, 1], [5, 1], [6, 1], [5, 1], [4, 1], [4, 2]],
      [[7, 1], [6, 1], [4, 1], [5, 1], [4, 1], [2, 2]],
      [[4, 1], [6, 1], [7, 1], [8, 1], [9, 1], [8, 1], [7, 1], [6, 2]],
      [[4, 1], [5, 1], [6, 1], [4, 1], [1, 1], [0, 2]],
    ],
    dorian: [
      [[0, 1], [0, 1], [2, 1], [4, 1], [5, 1], [4, 1], [2, 1], [4, 2]],
      [[7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [2, 2]],
      [[4, 1], [5, 1], [7, 1], [8, 1], [7, 1], [6, 1], [5, 1], [4, 2]],
      [[5, 1], [4, 1], [2, 1], [3, 1], [1, 1], [0, 2]],
    ],
    aeolian: [
      [[0, 1], [2, 1], [4, 1], [4, 1], [5, 1], [4, 1], [2, 1], [1, 2]],
      [[2, 1], [4, 1], [5, 1], [4, 1], [2, 1], [0, 2]],
      [[4, 1], [7, 1], [7, 1], [6, 1], [5, 1], [4, 1], [5, 1], [4, 2]],
      [[2, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 2]],
    ],
    hexa: [
      [[0, 1], [2, 1], [4, 1], [4, 1], [5, 1], [4, 1], [3, 1], [1, 2]],
      [[2, 1], [3, 1], [4, 1], [2, 1], [1, 1], [0, 2]],
      [[4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [5, 1], [4, 2]],
      [[3, 1], [2, 1], [4, 1], [2, 1], [1, 1], [0, 2]],
    ],
    penta: [
      [[0, 1], [1, 1], [2, 1], [4, 1], [5, 1], [4, 1], [2, 1], [4, 2]],
      [[7, 1], [5, 1], [4, 1], [2, 1], [1, 1], [2, 2]],
      [[4, 1], [5, 1], [7, 1], [8, 1], [7, 1], [5, 1], [4, 1], [5, 2]],
      [[4, 1], [2, 1], [1, 1], [2, 1], [1, 1], [0, 2]],
    ],
  };
  function sampleMaterial(mode, keynoteHz) {
    mode = modeName(mode);
    return { mode: mode, keynoteHz: keynoteHz || 260, space: "d7", melodyLines: SAMPLES[mode].map(function (ln) { return ln.map(function (x) { return { deg: x[0], beats: x[1] }; }); }) };
  }

  // ==========================================================================
  // READING THE MATERIAL — into lines of parts, in Hz (pure)
  // ==========================================================================
  var PARTS = ["B", "T", "A", "S"];
  // the trombones' compass: comfortable, and the most a chorale may ask
  var RANGE = {
    S: { inst: "altoTrombone",  comf: [196, 660], ext: [147, 740] },
    A: { inst: "tenorTrombone", comf: [147, 440], ext: [104, 587] },
    T: { inst: "tenorTrombone", comf: [98, 370],  ext: [70, 466] },   // the F attachment reaches C2
    B: { inst: "bassTrombone",  comf: [55, 262],  ext: [41, 330] },
  };

  function num(x, d) { x = +x; return isFinite(x) && x > 0 ? x : d; }
  // (a note is a degree, {deg, beats | durBeats | dur}, or a [deg, beats]
  // row — the SAMPLES' own shape; the critic found a row read as degree 0)
  function degOf(x) { return typeof x === "number" ? x : Array.isArray(x) ? (x[0] != null ? +x[0] : null) : (x && x.deg != null ? +x.deg : null); }
  function beatsOf(x) { return Array.isArray(x) ? num(x[1], 1) : x && typeof x === "object" ? num(x.beats != null ? x.beats : (x.durBeats != null ? x.durBeats : x.dur), 1) : 1; }

  // one chord, from any of the accepted shapes → {degs, beats, fermata,
  // freqs?, hold, tones?} — tones is Harmony's own {class: "root" | "third" |
  // "fifth"}, when the chord comes straight from Harmony.harmonize()
  function readChord(ch) {
    if (Array.isArray(ch)) return { degs: ch.slice(0, 4), beats: 1 };
    if (!ch || typeof ch !== "object") return null;
    if (ch.chord && ch.chord.voicing) return { degs: ch.chord.voicing.slice(0, 4), beats: num(ch.dur, 1), freqs: ch.chord.freqs || null, tones: ch.chord.tones || null };
    if (ch.degs) return { degs: ch.degs.slice(0, 4), beats: num(ch.beats != null ? ch.beats : ch.dur, 1), fermata: !!ch.fermata, freqs: ch.freqs || null, hold: !!ch.hold, tones: ch.tones || null };
    return null;
  }
  function splitInto(list, lens) {
    var out = [], i = 0;
    if (lens && lens.length) {
      lens.forEach(function (L) { if (i < list.length) { out.push(list.slice(i, i + L)); i += L; } });
      if (i < list.length) out.push(list.slice(i));
      return out;
    }
    var m = Math.max(1, Math.round(list.length / 7)), per = Math.ceil(list.length / m);
    for (var k = 0; k < list.length; k += per) out.push(list.slice(k, k + per));
    return out;
  }

  // WHAT A GIVEN CHORD IS: its root, third and fifth, as classes of the mode.
  // Harmony says so itself (its tones; an open chord has no third, unless
  // the tune sings it). A bare [B,T,A,S] is read against the mode's own
  // triads (the harmonizer's vocabulary): the one that holds all its tones,
  // rooted on its bass if one is, else with its bass for a third — and a
  // chord of two tones, root and fifth, stays open. Anything else (a
  // diminished triad, a seventh) is taken as it stands, rooted on its bass.
  function chordSpec(mode, d, tones) {
    var n = col(mode).ratios.length, sCls = mod(d[3], n), roles = {}, classes = [];
    d.forEach(function (x) { if (x != null) { var k = mod(x, n); if (classes.indexOf(k) < 0) classes.push(k); } });
    if (tones) Object.keys(tones).forEach(function (k) { roles[tones[k]] = mod(+k, n); });
    var cls = null, name = null;
    if (roles.root != null && roles.fifth != null && roles.root !== roles.fifth) {
      var third = roles.third != null ? roles.third : (sCls !== roles.root && sCls !== roles.fifth ? sCls : null);
      cls = third != null ? [roles.root, third, roles.fifth] : [roles.root, roles.fifth];
      VOCAB[mode].forEach(function (v) { if (v[1][0] === cls[0] && v[1].length === 3 && cls.length === 3 && v[1][1] === cls[1]) name = v[0]; });
    } else {
      var bassCls = mod(d[0], n), best = null, bs = -1;
      VOCAB[mode].forEach(function (v) {
        if (!classes.every(function (k) { return v[1].indexOf(k) >= 0; })) return;
        var sc = v[1][0] === bassCls ? 2 : (v[1].length === 3 && v[1][1] === bassCls ? 1 : 0);
        if (sc > bs) { bs = sc; best = v; }
      });
      if (best) {
        name = best[0];
        var tri = best[1];
        cls = tri.length === 3 && classes.length === 2 && classes.indexOf(tri[1]) < 0 ? [tri[0], tri[2]] : tri.slice();
      } else cls = [bassCls].concat(classes.filter(function (k) { return k !== bassCls; }));
    }
    return { cls: cls, open: cls.length === 2, name: name };
  }

  // THE RE-VOICING: the chords as given, seated for four trombones under the
  // soprano by the harmonizer's own pass — one sweep over the whole chorale
  // for the cheapest path: inner voices near, contrary and oblique motion,
  // no parallel fifths or octaves, no crossing, a line closing in root
  // position, a breath between lines. The chords stay the engine's; only who
  // plays which tone, and in which octave, is the choir's.
  // rows: [{ s (the soprano's index), spec (chordSpec), end, brk }] → each
  // row gets v: [B, T, A, S]
  function revoice(mode, rows) {
    var Vc = voicer(mode), n = Vc.n, prev = null;
    rows.forEach(function (x) {
      var st = Vc.voicings(x.spec, x.s).map(function (vc) {
        return { v: vc.v, own: vc.cost + (x.end && mod(vc.v[0], n) !== x.spec.cls[0] ? 4 : 0), cost: 1e9, back: -1 };
      });
      // a soprano no seat fits under (far out of the compass): the chord's
      // tones stacked plainly down from it, rather than a broken chain
      if (!st.length) st.push({ v: stack(x.spec, x.s, n), own: 50, cost: 1e9, back: -1 });
      if (prev) {
        st.forEach(function (s2) {
          prev.forEach(function (p, pj) {
            var c = p.cost + s2.own + Vc.move(p.v, s2.v, x.brk);
            if (c < s2.cost) { s2.cost = c; s2.back = pj; }
          });
        });
      } else st.forEach(function (s2) { s2.cost = s2.own; });
      x.states = st; prev = st;
    });
    var bi = -1, bc = 1e9;
    prev.forEach(function (s2, k) { if (s2.cost < bc) { bc = s2.cost; bi = k; } });
    for (var i = rows.length - 1; i >= 0; i--) {
      var s3 = rows[i].states[bi];
      rows[i].v = s3.v; bi = s3.back;
      delete rows[i].states;
    }
    return rows;
  }
  function stack(spec, s, n) {
    function below(x, set) { for (var y = x - 1; y > x - 2 * n; y--) if (set.indexOf(mod(y, n)) >= 0) return y; return x - n; }
    var a = below(s, spec.cls), t = below(a, spec.cls), b = below(t - Math.floor(n / 2) + 1, [spec.cls[0]]);
    return [b, t, a, s];
  }

  // chords (collection or d7 degrees) → lines of parts.
  //   o: { space ("d7" | "collection"), trust (Harmony's own frequencies),
  //        tune (the tune's lines, collection indices), voiced (the
  //        harmonizer's own output: already seated, played as it stands) }
  //
  // THE SOPRANO. Harmony pins its soprano to the tune but folds each note
  // into the soprano's compass on its own, so the tune can leap a sixth or
  // an octave where it steps, and its alto can stand above the melody. An
  // arranger would not. Best of all, the engine passes the tune it
  // harmonized (material.tune): then the soprano is the tune, octaves and
  // all. Without it, the tune's contour is rebuilt from the GIVEN steps:
  // each interval as written, unless it is wider than a tritone — then its
  // nearest octave (a tune moving by steps, thirds and fourths comes back
  // exactly; a melodic fifth or sixth comes back inverted, the price of
  // guessing), and each line is set where a soprano sings (its middle near
  // 1.45 × the keynote), which also mends a guess that went astray between
  // lines. Then the lower parts are voiced again under it (THE RE-VOICING,
  // above): Harmony voiced them for ITS soprano, and moved under the tune's
  // they would go in blocks — octaves and fifths in parallel, leaps of an
  // octave in every part.
  function fromChords(mode, K, lines, o) {
    o = o || {};
    var n = col(mode).ratios.length, space = o.space === "d7" ? "d7" : "collection", tuneLines = o.tune;
    function octaveNear(x, ref) {
      var best = x, bd = 1e9;
      for (var k = -5; k <= 5; k++) { var y = x + k * n, dd = Math.abs(cents(ratioOf(mode, y) / ratioOf(mode, ref))); if (dd < bd - 1e-9) { bd = dd; best = y; } }
      return best;
    }
    var L = lines.map(function (ln) {
      return ln.map(function (ch) {
        var d = ch.degs.map(function (x) { return x == null ? null : (space === "d7" ? fromD7(mode, x) : Math.round(x)); });
        return { ch: ch, d: d, orig: d.slice() };
      });
    });
    function anchor(group) {                         // set a run of soprano notes where a soprano sings
      var sop = [];
      group.forEach(function (x) { if (x.d[3] != null) sop.push(x.d[3]); });
      if (!sop.length) return;
      var srt = sop.slice().sort(function (a, b) { return a - b; }), med = srt[Math.floor(srt.length / 2)], sh = 0, bd = 1e9;
      for (var k = -4; k <= 4; k++) { var dd = Math.abs(Math.log(ratioOf(mode, med + k * n) / 1.45)); if (dd < bd - 1e-9) { bd = dd; sh = k * n; } }
      group.forEach(function (x) { if (x.d[3] != null) x.d[3] += sh; });
    }
    if (!o.voiced) {
      var fits = tuneLines && tuneLines.length === L.length && L.every(function (ln, i) { return tuneLines[i].length === ln.length; });
      if (fits) {
        // the tune itself: its octaves are the truth
        L.forEach(function (ln, i) { ln.forEach(function (x, j) { x.d[3] = tuneLines[i][j]; }); });
        var all = [];
        L.forEach(function (ln) { all = all.concat(ln); });
        anchor(all);
      } else {
        // the tune, rebuilt from its given steps, a line at a time
        var given = null, cur = null;
        L.forEach(function (ln) {
          ln.forEach(function (x) {
            var s0 = x.d[3];
            if (given == null) cur = s0;
            else {
              var step = s0 - given;
              if (Math.abs(cents(ratioOf(mode, s0) / ratioOf(mode, given))) > 600) step = octaveNear(s0, given) - given;
              cur += step;
            }
            given = s0; x.d[3] = cur;
          });
          anchor(ln);
        });
      }
      var rows = [];
      L.forEach(function (ln, li) {
        ln.forEach(function (x, j) {
          rows.push({ s: x.d[3], spec: chordSpec(mode, x.orig, x.ch.tones), end: j === ln.length - 1, brk: li > 0 && j === 0, x: x });
        });
      });
      revoice(mode, rows).forEach(function (r) { r.x.d = r.v.slice(); });
    }
    return L.map(function (ln) {
      var parts = { B: [], T: [], A: [], S: [] }, beat = 0;
      ln.forEach(function (x) {
        var ch = x.ch, d = x.d;
        var tune = tuneChord(mode, d.filter(function (y) { return y != null; }));
        // Harmony's own frequencies, when trusted: each tone class as Harmony
        // tuned it, in the octave the choir plays it
        var hz = null;
        if (o.trust && ch.freqs) { hz = {}; x.orig.forEach(function (y, i) { if (y != null && ch.freqs[i] > 0) hz[mod(y, n)] = ch.freqs[i]; }); }
        PARTS.forEach(function (p, pi) {
          if (d[pi] == null) return;
          var f = K * ratioOf(mode, d[pi]) * tune[mod(d[pi], n)];
          if (hz && hz[mod(d[pi], n)]) { var g = hz[mod(d[pi], n)]; f = g * Math.pow(2, Math.round(Math.log(f / g) / Math.LN2)); }
          var last = parts[p][parts[p].length - 1];
          if (ch.hold && last && Math.abs(last.f - f) < 0.01 && last.beat + last.beats >= beat - 1e-9) { last.beats += ch.beats; return; }
          parts[p].push({ f: f, beat: beat, beats: ch.beats, cls: mod(d[pi], n) });
        });
        beat += ch.beats;
      });
      return { parts: parts, beats: beat };
    });
  }

  // a SCORE Hymn → lines of parts, with the Score's own rhythm and monzos
  function monzoRatio(m) { m = m || [0, 0, 0, 0]; return Math.pow(2, m[0] || 0) * Math.pow(3, m[1] || 0) * Math.pow(5, m[2] || 0) * Math.pow(7, m[3] || 0); }
  function fromHymn(h, K) {
    var key = monzoRatio(h.keyMonzo);
    return (h.lines || []).map(function (ln) {
      var parts = { B: [], T: [], A: [], S: [] }, end = 0;
      PARTS.forEach(function (p) {
        var src = (ln.notes && ln.notes[p]) || [], out = [];
        src.forEach(function (nt) {
          if (!nt || nt.monzo == null) return;
          var f = K * key * monzoRatio(nt.monzo);
          var prev = out[out.length - 1];
          if (prev && prev.tie && Math.abs(prev.f - f) < 0.01) { prev.beats += nt.beats; prev.tie = !!nt.tie; prev.fermata = prev.fermata || !!nt.fermata; }
          else out.push({ f: f, beat: +nt.beat, beats: +nt.beats, tie: !!nt.tie, fermata: !!nt.fermata });
          end = Math.max(end, +nt.beat + +nt.beats);
        });
        parts[p] = out;
      });
      return { parts: parts, beats: end };
    });
  }

  // the trombones' registers: one octave for the whole chorale, then any
  // part that still strays, folded line by line
  function place(lines) {
    function span(p, k) {
      var lo = 1e9, hi = 0;
      lines.forEach(function (ln) { ln.parts[p].forEach(function (nt) { var f = nt.f * Math.pow(2, k); if (f < lo) lo = f; if (f > hi) hi = f; }); });
      return hi ? [lo, hi] : null;
    }
    function out(v, rg) { return v < rg[0] ? cents(rg[0] / v) / 100 : v > rg[1] ? cents(v / rg[1]) / 100 : 0; }
    var best = 0, bestCost = 1e9;
    [0, -1, 1, -2].forEach(function (k) {
      var cost = Math.abs(k) * 0.5;
      PARTS.forEach(function (p) {
        var s = span(p, k); if (!s) return;
        cost += out(s[0], RANGE[p].comf) + out(s[1], RANGE[p].comf) + 4 * (out(s[0], RANGE[p].ext) + out(s[1], RANGE[p].ext));
      });
      if (cost < bestCost - 1e-9) { bestCost = cost; best = k; }
    });
    var m = Math.pow(2, best);
    lines.forEach(function (ln) { PARTS.forEach(function (p) { ln.parts[p].forEach(function (nt) { nt.f *= m; }); }); });
    // a part-line still out of its compass (by more than a third of a
    // semitone's worth of slack) folds an octave — only if the fold crosses
    // no neighbour at any shared moment; otherwise it stays, a little
    // strained, which a real player would rather than swap parts
    var SLACK = Math.pow(2, 60 / 1200);
    function at(ns, beat) { for (var i = 0; i < ns.length; i++) if (ns[i].beat <= beat + 1e-6 && ns[i].beat + ns[i].beats > beat + 1e-6) return ns[i]; return null; }
    function crosses(ln, p, mul) {
      var pi = PARTS.indexOf(p), below = null, above = null;
      for (var q = pi - 1; q >= 0; q--) if (ln.parts[PARTS[q]].length) { below = ln.parts[PARTS[q]]; break; }
      for (var r = pi + 1; r < 4; r++) if (ln.parts[PARTS[r]].length) { above = ln.parts[PARTS[r]]; break; }
      return ln.parts[p].some(function (nt) {
        var f = nt.f * mul, lo = below && at(below, nt.beat), hi = above && at(above, nt.beat);
        return (lo && lo.f >= f) || (hi && hi.f <= f);
      });
    }
    lines.forEach(function (ln) {
      PARTS.forEach(function (p) {
        var ns = ln.parts[p];
        if (!ns.length) return;
        var rg = RANGE[p].ext;
        for (var g = 0; g < 2; g++) {
          var lo = Math.min.apply(null, ns.map(function (x) { return x.f; })), hi = Math.max.apply(null, ns.map(function (x) { return x.f; }));
          var mul = lo * SLACK < rg[0] && hi * 2 <= rg[1] * SLACK ? 2 : (hi > rg[1] * SLACK && lo / 2 >= rg[0] / SLACK ? 0.5 : 1);
          if (mul === 1 || crosses(ln, p, mul)) break;
          ns.forEach(function (x) { x.f *= mul; });
        }
      });
    });
    return best;
  }

  // chorale(material) → { mode, keynoteHz, lines: [{parts:{B,T,A,S}, beats}],
  //   source, octave, voices, prepared: true }
  // What it returns is itself material: handed back (to plan, score or
  // perform), it is used as it stands. Harmonizing a melody here costs up to
  // ~65 ms, re-voicing Harmony's chords ~10: an engine prepares the chorale
  // when it plans the meeting, not inside a clock callback.
  function chorale(material) {
    if (material && material.prepared && material.lines) return material;
    var M = material || {};
    var mode = modeName(M.mode || (M.hymn && M.hymn.mode));
    var K = num(M.keynoteHz, 260), space = M.space === "d7" ? "d7" : "collection";
    var lines = null, source = null;
    try {
      if (M.hymn && M.hymn.lines && M.hymn.lines.length) {
        var parts = {}, h = M.hymn;
        h.lines.forEach(function (ln) { PARTS.forEach(function (p) { if (ln.notes && ln.notes[p] && ln.notes[p].length) parts[p] = true; }); });
        if (Object.keys(parts).length >= 2) { lines = fromHymn(h, K); source = "hymn"; }
        else {
          var mp = h.melodyPart || "S";
          var ml = h.lines.map(function (ln) { return ((ln.notes && ln.notes[mp]) || []).map(function (nt) { return { idx: fromD7(mode, nt.deg), beats: num(nt.beats, 1) }; }); });
          lines = fromChords(mode, K, harmonize(mode, ml.filter(function (l) { return l.length; })), { voiced: true }); source = "hymn melody, harmonized here";
        }
      } else if (M.lines || M.chords) {
        var raw = M.lines ? M.lines : splitInto(M.chords, M.lineLengths);
        // (a chord needs its soprano; every tone it gives must be a number)
        var cl = raw.map(function (ln) {
          return (ln || []).map(readChord).filter(function (c) {
            return c && c.degs && c.degs.length === 4 && c.degs[3] != null && c.degs.every(function (x) { return x == null || isFinite(+x); });
          });
        }).filter(function (ln) { return ln.length; });
        // the tune the chords harmonize, if the engine passes it too
        var tl = null;
        if (M.tune && M.tune.lines) {
          var tsp = M.tune.space === "collection" ? "collection" : "d7";
          tl = M.tune.lines.map(function (ln) {
            return (ln || []).map(function (x) { var d = degOf(x); return d == null ? null : (tsp === "d7" ? fromD7(mode, d) : Math.round(d)); }).filter(function (x) { return x != null; });
          }).filter(function (ln) { return ln.length; });
        }
        if (cl.length) { lines = fromChords(mode, K, cl, { space: space, trust: !!M.trustFreqs, tune: tl }); source = tl && tl.length === cl.length ? "chords, with the tune" : "chords"; }
      } else if (M.melody || M.melodyLines) {
        var mlines = M.melodyLines ? M.melodyLines : splitInto(M.melody, M.lineLengths);
        var idxLines = mlines.map(function (ln) {
          return (ln || []).map(function (x) { var d = degOf(x); return d == null ? null : { idx: space === "d7" ? fromD7(mode, d) : Math.round(d), beats: beatsOf(x) }; }).filter(Boolean);
        }).filter(function (ln) { return ln.length; });
        if (idxLines.length) { lines = fromChords(mode, K, harmonize(mode, idxLines), { voiced: true }); source = "melody, harmonized here"; }
      }
    } catch (e) { lines = null; }
    if (!lines || !lines.length || !lines.some(function (l) { return l.beats > 0; })) {
      var smp = sampleMaterial(mode, K);
      var sl = smp.melodyLines.map(function (ln) { return ln.map(function (x) { return { idx: fromD7(mode, x.deg), beats: x.beats }; }); });
      lines = fromChords(mode, K, harmonize(mode, sl), { voiced: true });
      source = "sample (" + mode + ")";
    }
    // a single long line becomes two: an antiphony needs a call and an answer
    if (lines.length === 1 && lines[0].beats >= 4) lines = halve(lines[0]);
    var octave = place(lines);
    var voices = PARTS.filter(function (p) { return lines.some(function (l) { return l.parts[p].length; }); });
    return { mode: mode, keynoteHz: K, lines: lines, source: source, octave: octave, voices: voices, prepared: true };
  }
  function halve(line) {
    var cut = line.beats / 2, a = { parts: {}, beats: 0 }, b = { parts: {}, beats: 0 };
    // cut at the onset nearest the middle that all parts share (or the middle)
    var onsets = {};
    PARTS.forEach(function (p) { line.parts[p].forEach(function (nt) { onsets[nt.beat] = (onsets[nt.beat] || 0) + 1; }); });
    var best = cut, bd = 1e9;
    Object.keys(onsets).forEach(function (k) { var x = +k; if (x > 0 && Math.abs(x - cut) < bd) { bd = Math.abs(x - cut); best = x; } });
    PARTS.forEach(function (p) {
      a.parts[p] = []; b.parts[p] = [];
      line.parts[p].forEach(function (nt) {
        if (nt.beat < best) a.parts[p].push(Object.assign({}, nt, { beats: Math.min(nt.beats, best - nt.beat) }));
        else b.parts[p].push(Object.assign({}, nt, { beat: nt.beat - best }));
      });
    });
    a.beats = best; b.beats = line.beats - best;
    return [a, b];
  }

  // ==========================================================================
  // THE EXCHANGE — who plays which line, when (pure)
  // ==========================================================================
  // 2E phrases alternate far, near, far, near… With as many lines as
  // phrases, the hymn is played through; with more lines, the first half of
  // the phrases open it and the second half close it (so it always ends on
  // its last line — the final cadence); with fewer, it plays through and
  // the last lines come round again, softer, like a repeated couplet.
  function lineOrder(m, P) {
    var out = [], i;
    if (P <= m) {
      var h = Math.ceil(P / 2);
      for (i = 0; i < h; i++) out.push(i);
      for (i = m - (P - h); i < m; i++) out.push(i);
    } else {
      for (i = 0; i < m; i++) out.push(i);
      var extra = P - m;
      while (extra > 0) { var take = Math.min(extra, m); for (i = m - take; i < m; i++) out.push(i); extra -= take; }
    }
    return out;
  }
  // a nominal hymn for estimates (CM, a note a beat, a two-beat close)
  var NOMINAL = [8, 6, 8, 6].map(function (L) { return { beats: L + 1, onset: L - 1, median: 1 }; });
  // the line's last onset (where its final sonority begins): the fermata
  // stretches the time from there to the line's end, and every part's last
  // note ends together with it
  function lineMeta(ln) {
    var lens = [], onset = 0;
    PARTS.forEach(function (p) {
      ln.parts[p].forEach(function (nt) { lens.push(nt.beats); if (nt.beat < ln.beats - 1e-6) onset = Math.max(onset, nt.beat); });
    });
    lens.sort(function (a, b) { return a - b; });
    return { beats: ln.beats, onset: onset, median: lens.length ? lens[Math.floor(lens.length / 2)] : 1 };
  }
  // The hold is the written length times the fermata — unless the line is
  // written with its fermata already (the engine's pourIntoLine ends every
  // line on a note of 2.2–5 beats): a fermata is not held twice. So the
  // last sonority lasts the longer of its written length and a two-note
  // close held by the fermata.
  function heldEnd(mt, fermata) {
    var last = mt.beats - mt.onset;
    return mt.onset + Math.max(last, Math.min(last * fermata, 2 * mt.median * fermata));
  }
  function timeline(ch, sh) {
    var metas = ch ? ch.lines.map(lineMeta) : NOMINAL;
    var all = [];
    metas.forEach(function (m) { all.push(m.median); });
    all.sort(function (a, b) { return a - b; });
    var unit = all.length ? all[Math.floor(all.length / 2)] : 1;
    function phraseLen(mt, far) {
      var spb = sh.beatS / unit * (far ? sh.farLag : 1);
      return heldEnd(mt, sh.fermata) * spb;
    }
    var E = sh.exchanges, order, t, starts;
    for (;;) {
      order = lineOrder(metas.length, 2 * E);
      t = 0; starts = [];
      for (var k = 0; k < order.length; k++) {
        var len = phraseLen(metas[order[k]], k % 2 === 0);
        starts.push([t, t + len]);
        t += len + (k < order.length - 1 ? 0.6 + sh.gap : 0.9);
      }
      if (t <= MAX_DUR || E <= 2) break;
      E--;
    }
    return { exchanges: E, order: order, spans: starts, end: t, unit: unit };
  }

  // ==========================================================================
  // THE SCORE — the whole performance as data (pure)
  // ==========================================================================
  function score(material, stream, t0) {
    var sh = shapeOf(stream);
    var ch = chorale(material);
    var tl = timeline(ch, sh);
    t0 = +t0 || 0;
    var farSide = sh.farLeft ? -1 : 1;
    var phrases = [];
    var minor = ch.mode === "aeolian" || ch.mode === "dorian";
    tl.order.forEach(function (li, k) {
      var far = k % 2 === 0, line = ch.lines[li], mt = lineMeta(line);
      var spb = sh.beatS / tl.unit * (far ? sh.farLag : 1);
      var start = t0 + tl.spans[k][0];
      var base = (far ? sh.farDyn : sh.nearDyn) * (k >= ch.lines.length ? sh.echoSoft : 1);
      var final = k === tl.order.length - 1;
      function arc(beat) { return base * (1 + sh.swell * Math.sin(Math.PI * Math.min(1, beat / Math.max(1e-6, line.beats)))); }
      var parts = {};
      PARTS.forEach(function (p) {
        var src = line.parts[p];
        parts[p] = src.map(function (nt, i) {
          var last = nt.beat + nt.beats >= line.beats - 1e-6;
          var prev = src[i - 1];
          var joined = !!prev && prev.beat + prev.beats >= nt.beat - 1e-6;
          var dur = (last ? heldEnd(mt, sh.fermata) - nt.beat : nt.beats) * spb;
          var f = nt.f * (far ? Math.pow(2, -sh.flatCents / 1200) : 1);
          if (final && last && minor && sh.picardy && isMinorThirdOverTonic(nt.f, line, ch.keynoteHz)) f *= 25 / 24;
          return {
            f: f, t: start + nt.beat * spb, dur: dur,
            dyn: arc(nt.beat), dynEnd: last ? arc(nt.beat) * 0.72 : arc(nt.beat + nt.beats),
            atk: joined ? null : (far ? sh.farAtk : sh.nearAtk), legato: joined,
            rel: last ? (far ? 0.3 : 0.24) : 0.05,
          };
        });
      });
      phrases.push({ choir: far ? "far" : "near", line: li, t0: start, t1: t0 + tl.spans[k][1], pan: far ? farSide * sh.farPan : -farSide * sh.nearPan, parts: parts, repeat: k >= ch.lines.length });
    });
    // the far choir joins the near one's last chord
    if (sh.together && phrases.length) {
      var fin = phrases[phrases.length - 1], jp = {};
      PARTS.forEach(function (p) {
        var ns = fin.parts[p], lastN = ns[ns.length - 1];
        jp[p] = lastN ? [{ f: lastN.f * Math.pow(2, -sh.flatCents / 1200), t: lastN.t + 0.12, dur: Math.max(0.6, lastN.dur - 0.12), dyn: sh.farDyn * 0.9, dynEnd: sh.farDyn * 0.65, atk: sh.farAtk, legato: false, rel: 0.3 }] : [];
      });
      // (the join begins where its first chord enters — just after the near
      // choir's last onset — not as that chord fades: a row the engine
      // prints at t0 must come when the two choirs are heard together)
      var jt0 = Infinity;
      PARTS.forEach(function (p) { jp[p].forEach(function (nt) { if (nt.t < jt0) jt0 = nt.t; }); });
      phrases.push({ choir: "far", line: fin.line, t0: isFinite(jt0) ? jt0 : fin.t1 - 0.5, t1: fin.t1, pan: farSide * sh.farPan, parts: jp, joins: true });
    }
    var end = t0;
    phrases.forEach(function (ph) { PARTS.forEach(function (p) { ph.parts[p].forEach(function (nt) { end = Math.max(end, nt.t + nt.dur + nt.rel * 3); }); }); });
    return {
      shape: sh, chorale: ch, order: tl.order, exchanges: tl.exchanges, phrases: phrases, t0: t0, end: end,
      farSide: sh.farLeft ? "west" : "east", nearSide: sh.farLeft ? "east" : "west",
    };
  }
  function isMinorThirdOverTonic(f, line, K) {
    var bass = line.parts.B.length ? line.parts.B[line.parts.B.length - 1] : null;
    if (!bass || Math.abs(cents(fold(bass.f / K))) > 5 && Math.abs(cents(fold(bass.f / K)) - 1200) > 5) return false;
    return Math.abs(cents(fold(f / K)) - cents(6 / 5)) < 6;
  }

  // ==========================================================================
  // PERFORM — two choirs, one town, placed at t (synthesis; reads no clock)
  // ==========================================================================
  var INST = { S: "altoTrombone", A: "tenorTrombone", T: "tenorTrombone", B: "bassTrombone" };
  // the far choir's trim (dB, within ±9): near and far as heard — each
  // choir's dynamic plus its distance — set sh.gapLu apart
  function farTrimDb(sh) {
    var VB = window.KOLOB.VoicesBand;
    if (!VB || !VB.distanceDb) return 0;
    var near = VB.dynamicDb(sh.nearDyn) + VB.distanceDb(sh.nearDist);
    var far = VB.dynamicDb(sh.farDyn) + VB.distanceDb(sh.farDist);
    return Math.max(-9, Math.min(9, near - sh.gapLu - far));
  }
  function perform(ctx, dest, t, material, stream, hooks) {
    var VB = window.KOLOB.VoicesBand;
    if (!VB || !VB.townRoom) throw new Error("KOLOB.GuestTrombones: load kolob-voices-band.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t);
    var sh = sc.shape, synth = stream.fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    var town = VB.townRoom(ctx, bus, { seconds: 2.6 });
    var farPan = (sh.farLeft ? -1 : 1) * sh.farPan, nearPan = -(sh.farLeft ? -1 : 1) * sh.nearPan;
    // the far choir is heard gapLu under the near one, whatever the dice
    // made of their distances and dynamics (distance and dynamic both
    // change the level; left alone, they can nearly cancel)
    var farGain = Math.pow(10, farTrimDb(sh) / 20);
    var far = VB.create(ctx, bus, { rand: synth.fork("far"), distance: sh.farDist, room: town, side: farPan, spread: 0.2, gain: farGain });
    var near = VB.create(ctx, bus, { rand: synth.fork("near"), distance: sh.nearDist, room: town, side: nearPan, spread: 0.75 });
    sc.phrases.forEach(function (ph) {
      if (hooks.only && ph.choir !== hooks.only) return;       // (a lab's "far only" / "near only")
      var band = ph.choir === "far" ? far : near;
      PARTS.forEach(function (p) {
        var ns = ph.parts[p];
        if (!ns.length) return;
        band.play(0, ns.map(function (nt) {
          return { f: nt.f, at: nt.t, dur: nt.dur, dyn: nt.dyn, dynEnd: nt.dynEnd, atk: nt.atk, legato: nt.legato, rel: nt.rel };
        }), INST[p], 0.5);
        if (hooks.onNote) ns.forEach(function (nt) {
          hooks.onNote({ freq: nt.f, t: nt.t, dur: nt.dur, part: p, choir: ph.choir, line: ph.line, loud: ph.choir === "far" ? 0.35 : 0.8 });
        });
      });
      if (hooks.onPhrase) hooks.onPhrase({ choir: ph.choir, line: ph.line, t0: ph.t0, t1: ph.t1, pan: ph.pan, repeat: !!ph.repeat, joins: !!ph.joins });
    });
    // when the last of the town's air has died, let both choirs go
    var tail = sc.end + 4.5;
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () {
      far.dispose(); near.dispose(); town.dispose();
      try { sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) {}
    };
    sent.start(Math.max(0, t)); sent.stop(tail);      // (a lab may place t before the context's birth: a solo choir heard from its first phrase)
    perform.last = { far: far, near: near, score: sc };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, perform: perform, score: score, chorale: chorale, harmonize: function (mode, melodyLines, space) {
      mode = modeName(mode);
      var ls = (melodyLines || []).map(function (ln) {
        return ln.map(function (x) { var d = degOf(x); return { idx: space === "d7" ? fromD7(mode, d) : d, beats: beatsOf(x) }; });
      });
      return harmonize(mode, ls);
    },
    tuneChord: tuneChord, lineOrder: lineOrder, sample: sampleMaterial,
    SAMPLES: SAMPLES, ODDS: ODDS, EXCLUDES: EXCLUDES, RANGE: RANGE, NAME: NAME, LABEL: LABEL,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-trombones.js"] = true;   // the load guard's roll call (the engine seats it from round 2)
