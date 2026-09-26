// ============================================================================
// KOLOB — kolob-pitch.js: the tuning
//
// 5-limit just intonation over a fixed per-meeting tonic: the collections
// (the meeting's mode), the projection of 7-degree shapes onto gapped
// scales, degree → frequency, and the nearest-pitch table. Plus, new for
// Kolob 2 and not yet consulted by the engine, the exact-ratio monzo
// helpers of SCORE.md §2. Split from kolob-audio.js (v0.30); see the room
// list in kolob-core.js.
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
  function scaleIndexOf(i) {
    for (var k = 0; k < SCALE.length; k++) if (SCALE[k].idx === i) return k;
    return Math.floor(SCALE.length / 2);
  }
  function harm(h) { return F0 * h; }            // harmonic h of the fundamental
  // Gravity: do and sol. Phrases rest on do / mi / sol (collection-degree classes).
  function gravityDegs() { var n = colN(); return n === 5 ? { 0: true, 3: true } : { 0: true, 4: true }; }
  function restDegs() { var n = colN(); return n === 5 ? { 0: true, 2: true, 3: true } : { 0: true, 2: true, 4: true }; }

  // ==========================================================================
  // EXACT RATIOS — the monzo helpers (SCORE.md §2). New in Kolob 2 and pure:
  // nothing in the engine consults them yet; the composer and the engraver
  // will. A monzo is the exponents of 2, 3, 5, 7: [a, b, c, d] is
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
  function cents(m) { return 1200 * Math.log2(ratio(m)); }
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
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  Object.defineProperty(S, "F0", { enumerable: true, get: function () { return F0; }, set: function (v) { F0 = v; } });
  S.ROOT_MULT = ROOT_MULT;
  Object.defineProperty(S, "mode", { enumerable: true, get: function () { return mode; }, set: function (v) { mode = v; } });
  S.COL = COL;
  S.colN = colN;
  S.projDeg = projDeg;
  S.degFreq = degFreq;
  S.SCALE = SCALE;
  S.rebuildScale = rebuildScale;
  S.harm = harm;
  // the room's public face on the KOLOB namespace
  KOLOB.Pitch = {
    COLLECTIONS: COLLECTIONS, MODE_NAMES: MODE_NAMES, MODE_MONZOS: MODE_MONZOS,
    colN: colN, projDeg: projDeg, degFreq: degFreq,
    ratio: ratio, mul: mul, div: div, fromFraction: fromFraction, cents: cents,
    octaveReduce: octaveReduce, degMonzo: degMonzo, commaOf: commaOf,
  };
})();
