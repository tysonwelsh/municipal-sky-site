// ============================================================================
// KOLOB — kolob-pitch.js: the tuning
//
// 5-limit just intonation over a fixed per-meeting tonic: the collections
// (the meeting's mode), the projection of 7-degree shapes onto gapped
// scales, degree → frequency, and the nearest-pitch table. Plus the
// exact-ratio monzo helpers of SCORE.md §2, which the composer, the
// harmony, the cast, the guests and the meeting read. The house's rooms are
// listed in _engine.php.
//
// Public surface: KOLOB.Pitch = { COLLECTIONS, MODE_NAMES, MODE_MONZOS,
//   ROOT_MULT, colN, projDeg, degFreq, tuning(mode, f0), ratio, mul, div,
//   fromFraction, cents, centsOf, octaveReduce, degMonzo, commaOf, the
//   parent scales (PARENT_FRACTIONS, PARENT_RATIOS, CLASSES, modeName), the
//   7-limit constants, limitOf, septimalOf, harmonicSeventh, proportion,
//   oddParts }; and KOLOB.Num = { clamp, mod, r3, r4, positive, pickWith },
//   the small arithmetic every room uses (NUMBERS, at the foot). A room
//   borrows these rather than typing its own; where a room keeps a copy, a
//   comment beside it says why it is not this one (SCORE.md §2).
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ==========================================================================
  // TUNING — 5-limit just intonation over a fixed per-meeting tonic.
  // ==========================================================================
  // Everything is a ratio of F0 (La Monte Young's discipline). The COLLECTION
  // is the meeting's mode — hymnbook major, the English folk modes, and the
  // gapped folk-hymn scales. One gesture pool is authored in 7-degree space
  // and projected onto smaller collections via DEG_MAP.
  var F0 = 65;                                   // set per meeting in planMeeting()
  var ROOT_MULT = 4;                             // melodic root = F0 * 4 (~260 Hz)
  var COLLECTIONS = {
    ionian:     { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8], map: [0,1,2,3,4,5,6] },
    mixolydian: { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    dorian:     { ratios: [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    aeolian:    { ratios: [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9], map: [0,1,2,3,4,5,6] },
    penta:      { ratios: [1, 9/8, 5/4, 3/2, 5/3],            map: [0,1,2,2,3,4,4] },
    hexa:       { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3],       map: [0,1,2,3,4,5,5] },
  };
  var MODE_NAMES = Object.keys(COLLECTIONS);
  var mode = "ionian";
  function COL() { return COLLECTIONS[mode]; }
  function colN() { return COL().ratios.length; }
  // Project a 7-degree index (gestures, chord roots) into the current collection.
  function projDeg(d7) {
    var n = colN();
    if (n === 7) return d7;
    var oct = Math.floor(d7 / 7);
    var d = ((d7 % 7) + 7) % 7;
    return COL().map[d] + oct * n;
  }
  function degFreq(i) {                          // i = collection-degree index; octaves fold at n
    var n = colN();
    var oct = Math.floor(i / n);
    var d = ((i % n) + n) % n;
    return F0 * ROOT_MULT * COL().ratios[d] * Math.pow(2, oct);
  }
  // Ascending frequency table across ~3.5 octaves for nearest-pitch work.
  var SCALE = [];
  function rebuildScale() {
    SCALE.length = 0;
    var n = colN();
    for (var i = -2 * n; i <= 2 * n + 3; i++) SCALE.push({ deg: ((i % n) + n) % n, idx: i, freq: degFreq(i) });
  }
  function harm(h) { return F0 * h; }            // harmonic h of the fundamental
  // A TUNING, spelled out — the same projection and the same
  // degree → frequency as above, but for a mode and an F0 the caller names,
  // so the composers can work from a moment in their hands instead of the
  // meeting's current mode. Pure: it reads nothing but its arguments.
  function tuning(modeName, f0) {
    var col = COLLECTIONS[modeName] || COLLECTIONS.ionian;
    var n = col.ratios.length;
    function classOf(i) { return ((i % n) + n) % n; }
    return {
      mode: COLLECTIONS[modeName] ? modeName : "ionian", F0: f0, n: n, ratios: col.ratios,
      classOf: classOf,
      projDeg: function (d7) {
        if (n === 7) return d7;
        var oct = Math.floor(d7 / 7);
        return col.map[((d7 % 7) + 7) % 7] + oct * n;
      },
      degFreq: function (i) { return f0 * ROOT_MULT * col.ratios[classOf(i)] * Math.pow(2, Math.floor(i / n)); },
    };
  }

  // ==========================================================================
  // EXACT RATIOS — the monzo helpers (SCORE.md §2). Pure: the composer reads
  // them (commaOf for the marks, oddParts and proportion for the ringing
  // chords), the harmony (degMonzo, mul), the cast, the guests and the
  // meeting. A monzo is the exponents of 2, 3, 5, 7: [a, b, c, d] is
  // 2^a · 3^b · 5^c · 7^d, so 3/2 is [-1, 1, 0, 0] and 7/4 is [-2, 0, 0, 1].
  // ==========================================================================
  var PRIMES = [2, 3, 5, 7];
  function ratio(m) {
    var r = 1;
    for (var i = 0; i < 4; i++) r *= Math.pow(PRIMES[i], m[i] || 0);
    return r;
  }
  function mul(m1, m2) { return [0, 1, 2, 3].map(function (i) { return (m1[i] || 0) + (m2[i] || 0); }); }
  function div(m1, m2) { return [0, 1, 2, 3].map(function (i) { return (m1[i] || 0) - (m2[i] || 0); }); }
  // "10/9" → [1, -2, 1, 0]. Only 7-limit ratios have a monzo here; anything
  // with a larger prime is a spelling mistake, and says so.
  function fromFraction(s) {
    var parts = String(s).split("/");
    var num = parseInt(parts[0], 10), den = parts.length > 1 ? parseInt(parts[1], 10) : 1;
    var m = [0, 0, 0, 0];
    [[num, 1], [den, -1]].forEach(function (nd) {
      var n = nd[0];
      for (var i = 0; i < 4; i++) while (n > 1 && n % PRIMES[i] === 0) { n /= PRIMES[i]; m[i] += nd[1]; }
      if (n !== 1) throw new Error("fromFraction: " + s + " is not 7-limit");
    });
    return m;
  }
  function cents(m) { return centsOf(ratio(m)); }
  // a ratio's size in cents
  function centsOf(r) { return 1200 * Math.log2(r); }
  // Fold into the octave [1/1, 2/1) by adjusting the power of two.
  function octaveReduce(m) {
    var r = m.slice(0, 4); while (r.length < 4) r.push(0);
    r[0] -= Math.floor(Math.log2(ratio(r)) + 1e-9);
    return r;
  }
  // The six modes as exact ratios — the same tables as COLLECTIONS above,
  // spelled as fractions so the monzo is the truth and the float the echo.
  var MODE_FRACTIONS = {
    ionian:     ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian:     ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian:    ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
    penta:      ["1/1", "9/8", "5/4", "3/2", "5/3"],
    hexa:       ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3"],
  };
  var MODE_MONZOS = {};
  Object.keys(MODE_FRACTIONS).forEach(function (k) { MODE_MONZOS[k] = MODE_FRACTIONS[k].map(fromFraction); });
  // THE PARENT SCALE of each mode: the seven-note scale its degrees are
  // spelled in (SCORE.md §2, "Degree against monzo"). The four seven-note
  // modes are their own parents; the gapped scales are major collections
  // that leave notes out, so theirs is the ionian (the same table). As
  // fractions (exact), as the floats of COLLECTIONS, and CLASSES: the
  // parent's degrees each mode's collection holds (no fa or ti in the
  // pentatonic, no ti in the hexatonic). Shared by every room that spells a
  // degree, so read, never written.
  var PARENT_FRACTIONS = { ionian: MODE_FRACTIONS.ionian, mixolydian: MODE_FRACTIONS.mixolydian, dorian: MODE_FRACTIONS.dorian, aeolian: MODE_FRACTIONS.aeolian };
  PARENT_FRACTIONS.penta = PARENT_FRACTIONS.hexa = PARENT_FRACTIONS.ionian;
  var PARENT_RATIOS = { ionian: COLLECTIONS.ionian.ratios, mixolydian: COLLECTIONS.mixolydian.ratios, dorian: COLLECTIONS.dorian.ratios, aeolian: COLLECTIONS.aeolian.ratios };
  PARENT_RATIOS.penta = PARENT_RATIOS.hexa = PARENT_RATIOS.ionian;
  var CLASSES = {
    ionian: [0, 1, 2, 3, 4, 5, 6], mixolydian: [0, 1, 2, 3, 4, 5, 6], dorian: [0, 1, 2, 3, 4, 5, 6],
    aeolian: [0, 1, 2, 3, 4, 5, 6], penta: [0, 1, 2, 4, 5], hexa: [0, 1, 2, 3, 4, 5],
  };
  // a mode's name as given, or the ionian for anything that is not one of the six
  function modeName(m) { return COLLECTIONS[m] ? m : "ionian"; }
  // A collection-degree index (as degFreq takes it: octaves fold at the
  // collection's size) → its exact monzo relative to the key.
  function degMonzo(modeName, i) {
    var tbl = MODE_MONZOS[modeName] || MODE_MONZOS.ionian;
    var n = tbl.length;
    var oct = Math.floor(i / n);
    var d = ((i % n) + n) % n;
    return mul(tbl[d], [oct, 0, 0, 0]);
  }
  // Johnston's marks for a pitch m against the unmarked pitch it is spelled
  // as. The 7 mark lowers by 36/35; the + and − marks raise and lower by the
  // syntonic comma 81/80. Anything else left over is rounded to the nearest
  // whole comma (and clamped), so a mark is always one the engraver can draw.
  function commaOf(m, spelled) {
    var d = div(m, spelled);
    var septimal = (d[3] || 0) > 0 ? 1 : 0;
    if (septimal) d = div(d, [-2, -2, 1, 1]);          // take out one 35/36
    var c = cents(octaveReduce(d));
    if (c > 600) c -= 1200;
    var syn = Math.round(c / 21.506);
    return { syntonic: syn < -1 ? -1 : (syn > 1 ? 1 : syn), septimal: septimal };
  }

  // ==========================================================================
  // THE SEVENTH HARMONIC — 7-limit helpers. The only
  // place Kolob's lattice reaches past 5 is dialect D, gospel and barbershop
  // (PLAN-COMPOSITION §3.D, §3.4): the dominant seventh sung justly is not
  // 16/9 or 9/5 above its root but 7/4, the seventh partial — the chord is
  // then 4:5:6:7, a slice of one harmonic series, and it RINGS: the
  // overtones of the four notes land on one another and a phantom fifth
  // voice sings over the quartet. Everything here is exact (monzos); the
  // floats are echoes.
  // ==========================================================================
  var SEPTIMAL_SEVENTH = [-2, 0, 0, 1];                  // 7/4, the harmonic seventh (968.8 c)
  var SEPTIMAL_COMMA = [6, -2, 0, -1];                   // 64/63, 7/4 against the Pythagorean 16/9 (27.3 c)
  var JOHNSTON_SEVEN = [2, 2, -1, -1];                   // 36/35, what Johnston's "7" lowers (48.8 c: 7/4 against 9/5)
  var BARBERSHOP = [[0, 0, 0, 0], [-2, 0, 1, 0], [-1, 1, 0, 0], [-2, 0, 0, 1]];   // 1/1 5/4 3/2 7/4 — the 4:5:6:7
  // the highest prime a monzo leans on (1 for 1/1)
  function limitOf(m) { for (var i = 3; i >= 0; i--) if (m[i]) return PRIMES[i]; return 1; }
  // a monzo's septimal exponent (how many 7s it carries, signed)
  function septimalOf(m) { return m[3] || 0; }
  // the barbershop seventh on a root: four exact pitches, 4:5:6:7 above it
  function harmonicSeventh(root) { return BARBERSHOP.map(function (iv) { return mul(root, iv); }); }
  // the proportion of some pitches read as a CHORD: every note a harmonic of
  // one fundamental, octaves and inversions set aside. Each pitch is taken
  // against the first, its twos struck out (an octave changes nothing), and
  // the odd parts brought to whole numbers; then each odd harmonic is set in
  // the octave of the highest. So a dominant seventh sung justly reads
  // "4:5:6:7" in any voicing (odd harmonics 1, 3, 5, 7), a just major triad
  // "4:5:6", a just minor one "10:12:15" (3, 5 and 15 over a fundamental two
  // octaves and a third below) and a bare fifth "2:3". Exact throughout.
  function oddParts(monzos) {
    if (!monzos.length) return [];
    var ref = monzos[0], rel = monzos.map(function (m) { var r = div(m, ref); r[0] = 0; return r; });
    var lo = [0, 0, 0, 0];
    rel.forEach(function (r) { for (var i = 1; i < 4; i++) lo[i] = Math.min(lo[i], r[i]); });
    var odd = [];
    rel.forEach(function (r) { var x = Math.round(ratio(div(r, lo))); if (odd.indexOf(x) < 0) odd.push(x); });
    var g = odd.reduce(function (a, b) { while (b) { var t = b; b = a % b; a = t; } return a; });
    return odd.map(function (x) { return x / g; }).sort(function (a, b) { return a - b; });
  }
  function proportion(monzos) {
    var odd = oddParts(monzos);
    if (!odd.length) return "";
    var top = odd[odd.length - 1], L = Math.pow(2, Math.floor(Math.log2(top) + 1e-9));
    return odd.map(function (o) { while (o < L) o *= 2; return o; }).sort(function (a, b) { return a - b; }).join(":");
  }

  // ==========================================================================
  // NUMBERS — KOLOB.Num: the small arithmetic the rooms each used to type
  // for themselves. It is not pitch; it is raised here because this room
  // stands first among the house's rooms in every list that loads a room
  // which needs it (the page's, the composer's desk, every lab's), so a room
  // finds it as it loads and whenever it calls.
  // ==========================================================================
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  // the remainder that never goes negative: mod(-1, 7) is 6
  function mod(a, n) { return ((a % n) + n) % n; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  // x read as a number when it is a positive one, else d (a field of the
  // material a room is handed: a keynote, a beat)
  function positive(x, d) { x = +x; return isFinite(x) && x > 0 ? x : d; }
  // a weighted pick by a die already thrown: u in [0, 1), pool [[item,
  // weight], …] → the item u falls on (the last when u runs off the end;
  // null from an empty pool). It throws no die of its own: the caller threw
  // u on its stream (SCORE.md §3), whether or not the pick is used
  function pickWith(u, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = u * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool.length ? pool[pool.length - 1][0] : null;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  // (configurable, so the room can be loaded twice without "Cannot redefine")
  Object.defineProperty(S, "F0", { enumerable: true, configurable: true, get: function () { return F0; }, set: function (v) { F0 = v; } });
  S.ROOT_MULT = ROOT_MULT;
  Object.defineProperty(S, "mode", { enumerable: true, configurable: true, get: function () { return mode; }, set: function (v) { mode = v; } });
  S.COL = COL;
  S.colN = colN;
  S.projDeg = projDeg;
  S.degFreq = degFreq;
  S.SCALE = SCALE;
  S.rebuildScale = rebuildScale;
  S.harm = harm;
  // the room's public face on the KOLOB namespace
  KOLOB.Pitch = {
    COLLECTIONS: COLLECTIONS, MODE_NAMES: MODE_NAMES, MODE_MONZOS: MODE_MONZOS, ROOT_MULT: ROOT_MULT,
    colN: colN, projDeg: projDeg, degFreq: degFreq, tuning: tuning,
    ratio: ratio, mul: mul, div: div, fromFraction: fromFraction, cents: cents, centsOf: centsOf,
    octaveReduce: octaveReduce, degMonzo: degMonzo, commaOf: commaOf,
    // the parent scales
    PARENT_FRACTIONS: PARENT_FRACTIONS, PARENT_RATIOS: PARENT_RATIOS, CLASSES: CLASSES, modeName: modeName,
    // the seventh harmonic
    SEPTIMAL_SEVENTH: SEPTIMAL_SEVENTH, SEPTIMAL_COMMA: SEPTIMAL_COMMA, JOHNSTON_SEVEN: JOHNSTON_SEVEN, BARBERSHOP: BARBERSHOP,
    limitOf: limitOf, septimalOf: septimalOf, harmonicSeventh: harmonicSeventh, proportion: proportion, oddParts: oddParts,
  };
  KOLOB.Num = { clamp: clamp, mod: mod, r3: r3, r4: r4, positive: positive, pickWith: pickWith };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-pitch.js"] = true;   // the load guard's roll call
})();
