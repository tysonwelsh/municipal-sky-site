// ============================================================================
// KOLOB — kolob-composer.js: the hymn composer
//
// The ward sings new hymns every Sunday, and somebody in the settlement wrote
// them. This room is that somebody's desk: given a stream of dice and a few
// words about the day — the meter, the form, the dialect, the mode, the key,
// the hymnist, the mode of time — it writes one hymn tune, sets it in the
// dialect's harmony, checks it the way a tunebook's editor would, and hands
// back a Hymn (SCORE.md §5) with a Deseret name and a number for the board.
//
// HOW (PLAN-COMPOSITION §4, steps 1–7):
//   1. THE FRAME — meter, form, dialect, mode of time, key: a few dice.
//   2. THE SKELETON, BEFORE ANY NOTE — for every line a cadence target (the
//      degree it ends on and the chord it ends in), a contour, a start; for
//      the tune a floor and a PEAK, placed at 60–75 % of the way through.
//   3. RHYTHM FIRST — the syllables poured onto the mode of time: stressed
//      syllables on strong beats, a long note at each line's end, pickups;
//      a rhythm CELL per line, drawn before the notes, gives the feel.
//   4. MELODY BY GUIDED SEARCH — and here is the lesson of round 1 (critic/
//      enrichment-1 §2): best-of-N converges. Two hundred candidates scored
//      on one ruler all end the same way. So the things that make a tune
//      itself — each line's ENDING figure, its PEAK and its RHYTHM CELL — are
//      DRAWN first, from weighted tables, and only then does the search fill
//      the notes between, scoring singability, contour, the A/B relations
//      and a little memorability. The spread of what was drawn is reported.
//   5. HARMONY — the dialect's own harmonizer (kolob-dialects.js), planned
//      backwards from each line's cadence, voice-led, non-chord tones last.
//   6. CRITICISM AND REPAIR — a boring tune, a voice-leading fault, a line
//      too close to an Earth tune or to another hymn of the meeting: that
//      line is written again (bounded; there is always a fallback).
//   7. A NAME AND A NUMBER — in Deseret, for the hymn board.
//
// The colony's hymnists (kolob-hymnists.js) lean on every draw and every
// score: habits, never templates.
//
// PURE (SCORE.md §1): no AudioContext, no DOM, no Math.random, no clock. The
// caller's stream is the only die; everything the composer throws is thrown
// from forks of it, by label, so a change to how the alto is written never
// moves the tune. It loads headless in Node (`global.window = {}`).
//
// Public surface: KOLOB.Composer = {
//   compose(stream, opts) → Hymn   (+ dev fields: report, plan, nameEn, hymnist, amen)
//     opts.dialect: any of the six (the draw when none is named keeps to the
//     first three, so every earlier seed keeps its dialect); opts.kind for E
//   fingerprint(hymn) → the measured habits of a Score (the Earth tunes' too)
//   references() → the Earth tunes' fingerprints per dialect, and the tolerances
//   spread(streamOf, n, opts) → how varied n hymns are (endings, contours, …)
//   round(stream, opts) → a Hymn with .round {segments, entries, ground, pairs, delayBeats}
//   partner(stream, firstHymn, opts) → {hymn, combined, fit}: the closing hymn on the first's chords
//   fitTogether(h1, h2) → the strict fit report of two hymns sung together
//   wanderingRefrain(stream, {keys, dialect, mode}) → {hymn, keys, fits, compass}
//   refrainIn(stream, refrain, {dialect, keyMonzo}) / setTune(stream, hymn, …) → the tune set anew
//   METERS, FORMS, TIMES, MODES }
//
// ROUND 3 (the rest of the composer): dialects B, D and E live in
// kolob-dialects.js; here are what they need of the desk — E's kinds and D's
// refrain in the frame, the fuge's longer line and the septimal tuning in
// the Score, their own checks — and the three new kinds of piece at the
// foot: the round, the partner hymn, the wandering refrain. (Its second
// pass, after the critic: a fuge may run across two Score lines; D's chords
// are tuned a line at a time, so a note sung again stays put; the refrain's
// compass is measured against the day's keys before it is drawn.)
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Composer = (function () {
  "use strict";
  var K = window.KOLOB;

  // ==========================================================================
  // THE SCALE, AS A SINGER COUNTS IT
  // ==========================================================================
  // Degrees are counted in the seven-note parent scale of the mode (SCORE §2:
  // the degree is the spelling), deg 0 the final: do in the major modes, la
  // in aeolian, re in dorian, sol in mixolydian. The gapped scales are the
  // major scale with notes left out, so a pentatonic tune simply never
  // stands on fa or ti — though its alto may pass through them.
  var SEMIS = {
    ionian:     [0, 2, 4, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    aeolian:    [0, 2, 3, 5, 7, 8, 10],
  };
  SEMIS.penta = SEMIS.hexa = SEMIS.ionian;
  var MODES = ["ionian", "mixolydian", "dorian", "aeolian", "penta", "hexa"];
  // the degrees a TUNE may stand on (classes 0–6)
  var TUNE_CLASSES = {
    ionian: [0, 1, 2, 3, 4, 5, 6], mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian: [0, 1, 2, 3, 4, 5, 6], aeolian: [0, 1, 2, 3, 4, 5, 6],
    penta: [0, 1, 2, 4, 5], hexa: [0, 1, 2, 3, 4, 5],
  };
  // where do sits, counted from the final — so that the shape notes and the
  // tonal pulls read the same in every mode (aeolian's la is do's 5)
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };
  var MINOR = { aeolian: true, dorian: true };
  // the exact ratios of each mode's parent scale (kolob-pitch.js's tables;
  // the gapped scales' missing notes are the major scale's)
  var FRACTIONS = {
    ionian:     ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian:     ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian:    ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
  };
  FRACTIONS.penta = FRACTIONS.hexa = FRACTIONS.ionian;

  // ---- small hands ----------------------------------------------------------
  function cls(d) { return ((d % 7) + 7) % 7; }
  function octOf(d) { return Math.floor(d / 7); }
  // a degree (with its octave) and an alteration → semitones above the final
  function semi(mode, d, alt) { return 12 * octOf(d) + (SEMIS[mode] || SEMIS.ionian)[cls(d)] + (alt || 0); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  var EPS = 1e-6;

  // ---- exact pitch ------------------------------------------------------------
  // monzos: [2, 3, 5, 7] exponents (SCORE §2). Borrowed from kolob-pitch.js
  // when it is loaded; spelled out here too, so the room stands alone.
  function fromFraction(s) {
    if (K.Pitch && K.Pitch.fromFraction) return K.Pitch.fromFraction(s);
    var P = [2, 3, 5, 7], parts = String(s).split("/"), m = [0, 0, 0, 0];
    [[+parts[0], 1], [parts.length > 1 ? +parts[1] : 1, -1]].forEach(function (nd) {
      var n = nd[0];
      for (var i = 0; i < 4; i++) while (n > 1 && n % P[i] === 0) { n /= P[i]; m[i] += nd[1]; }
    });
    return m;
  }
  function mz(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]; }
  function mzNeg(a) { return [-a[0], -a[1], -a[2], -a[3]]; }
  function mzCents(m) { return 1200 * (m[0] + m[1] * Math.log2(3) + m[2] * Math.log2(5) + m[3] * Math.log2(7)); }
  var SCALE_MZ = {};
  MODES.forEach(function (k) { SCALE_MZ[k] = FRACTIONS[k].map(fromFraction); });
  var OCT = [1, 0, 0, 0];
  var COMMA = [-4, 4, -1, 0];                  // 81/80, the syntonic comma
  var CHROMA_UP = [-4, 1, 1, 0];               // 15/16: a sharp is the leading tone to the degree above
  var CHROMA_DN = [4, -1, -1, 0];              // 16/15: a flat leans on the degree below
  // the pitch a degree is SPELLED at (the scale's own ratio; an alteration
  // is the chromatic neighbour of the next degree, as kolob-tunes.js has it)
  function spelledMonzo(mode, d, alt) {
    var tbl = SCALE_MZ[mode] || SCALE_MZ.ionian;
    if (alt > 0) return mz(spelledMonzo(mode, d + 1, 0), CHROMA_UP);
    if (alt < 0) return mz(spelledMonzo(mode, d - 1, 0), CHROMA_DN);
    var o = octOf(d), m = tbl[cls(d)];
    return [m[0] + o, m[1], m[2], m[3]];
  }
  // just intervals above a chord's root, by the semitones they span
  var JUST = { 0: [0, 0, 0, 0], 3: [1, 1, -1, 0], 4: [-2, 0, 1, 0], 6: [6, -2, -1, 0] /* 64/45 */, 7: [-1, 1, 0, 0],
               8: [3, 0, -1, 0], 9: [0, -1, 1, 0], 10: [4, -2, 0, 0] /* 16/9 */, 11: [-3, 1, 1, 0], 2: [-3, 2, 0, 0], 5: [2, -1, 0, 0], 1: [4, -1, -1, 0] };

  // the stream's own hands, so a missing pickW never breaks a caller's toy
  function pickW(R, pool) {
    var tot = 0, i;
    for (i = 0; i < pool.length; i++) tot += Math.max(0, pool[i][1]);
    var x = R.next ? R.next() * tot : R.rnd(0, tot);
    for (i = 0; i < pool.length; i++) { x -= Math.max(0, pool[i][1]); if (x <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }
  function u01(R) { return R.next ? R.next() : R.rnd(0, 1); }
  function weightsOf(obj, mulObj, dflt) {
    var out = [];
    for (var k in obj) if (has(obj, k)) {
      var m = mulObj ? (has(mulObj, k) ? mulObj[k] : (dflt == null ? 0.35 : dflt)) : 1;
      out.push([k, obj[k] * m]);
    }
    return out;
  }

  // ==========================================================================
  // 1. THE FRAME — meters, forms, modes of time
  // ==========================================================================
  // A meter is its lines' syllable counts and the foot they walk in:
  // iambic (da-DUM), trochaic (DUM-da), anapestic (da-da-DUM, with one
  // syllable of pickup, as "How firm a foundation" has). A meter with R
  // carries a refrain of its own after every verse.
  var METERS = {
    "CM":     { lines: [8, 6, 8, 6], foot: "iamb" },
    "LM":     { lines: [8, 8, 8, 8], foot: "iamb" },
    "SM":     { lines: [6, 6, 8, 6], foot: "iamb" },
    "CMD":    { lines: [8, 6, 8, 6, 8, 6, 8, 6], foot: "iamb" },
    "87.87":  { lines: [8, 7, 8, 7], foot: "trochee" },
    "87.87D": { lines: [8, 7, 8, 7, 8, 7, 8, 7], foot: "trochee" },
    "76.76D": { lines: [7, 6, 7, 6, 7, 6, 7, 6], foot: "iamb" },
    "11s":    { lines: [11, 11, 11, 11], foot: "anapest" },
    "10.10R": { lines: [10, 10], foot: "iamb", refrain: [10, 10] },
    // (round 3: the short meters of the dancing songs and the Primary's)
    "66.66":  { lines: [6, 6, 6, 6], foot: "iamb" },
    "77.77":  { lines: [7, 7, 7, 7], foot: "trochee" },
    "65.65":  { lines: [6, 5, 6, 5], foot: "trochee" },
    "88.88":  { lines: [8, 8, 8, 8], foot: "trochee" },
    // (and the wandering refrain's couplets)
    "88":     { lines: [8, 8], foot: "iamb" },
    "86":     { lines: [8, 6], foot: "iamb" },
    "77":     { lines: [7, 7], foot: "trochee" },
  };
  function stressOf(n, foot) {
    var s = [];
    for (var i = 0; i < n; i++) {
      if (foot === "iamb") s.push(i % 2 === 1 ? 1 : 0);
      else if (foot === "trochee") s.push(i % 2 === 0 ? 1 : 0);
      else s.push(i % 3 === 1 ? 1 : 0);                      // the anapest, after one pickup
    }
    return s;
  }
  // FORMS: which lines are the same tune. A primed letter (A') is the line
  // it names begun again and turned elsewhere; lines of different lengths
  // can only be varied, never repeated exactly (the composer primes them).
  var FORMS = {
    4: { ABCD: 1, ABAC: 1, AABA: 1, "ABA'C": 1, "AA'BA": 1 },
    8: { ABACDEAC: 1, ABABCDAB: 1, ABACDEFC: 1, "ABCDEFA'D": 1 },
    2: { AB: 1 },
  };
  function formLetters(form) {
    var out = [], i = 0;
    while (i < form.length) {
      var L = form[i], prime = form[i + 1] === "'";
      out.push({ letter: L, prime: prime });
      i += prime ? 2 : 1;
    }
    return out;
  }
  // THE MODES OF TIME (PLAN §6.3, after the Sacred Harp's own): a bar, the
  // note that counts one beat, the length of one binary foot (a stressed
  // syllable and the unstressed one after it) and of one ternary foot, the
  // shortest and longest a line's last note may be, and a beat's length in
  // seconds at an ordinary pace (the dialect and the hymnist move it).
  var TIMES = {
    "4/4": { bar: 4, den: 4, bin: 2, ter: 4, fin: [2, 3], beatS: 0.62 },
    "2/2": { bar: 2, den: 2, bin: 2, ter: 3, fin: [2, 3], beatS: 0.92 },
    "3/4": { bar: 3, den: 4, bin: 3, ter: 3, fin: [2, 3], beatS: 0.5 },
    "3/2": { bar: 3, den: 2, bin: 3, ter: 3, fin: [2, 3], beatS: 0.62 },
    "6/8": { bar: 6, den: 8, bin: 3, ter: 6, fin: [2, 5], beatS: 0.27 },
    "2/4": { bar: 2, den: 4, bin: 2, ter: 3, fin: [1.5, 3], beatS: 0.55 },
  };
  // THE RHYTHM CELLS: how one foot's syllables share its length. A number is
  // one note; a list is a syllable held over two notes (a slur, a melisma).
  // Keyed by the foot's family and length; a cell a family lacks falls back
  // to its plain first entry.
  var CELLS = {
    "bin:2": { even: [1, 1], long: [1, 1], dotted: [1.5, 0.5], dotS: [1.5, 0.5], slurS: [[0.5, 0.5], 1], slurU: [1, [0.5, 0.5]] },
    "bin:3": { long: [2, 1], even: [2, 1], dotted: [[1.5, 0.5], 1], dotS: [[1.5, 0.5], 1], slurS: [[1, 1], 1], slurU: [2, [0.5, 0.5]] },
    "ter:3": { even: [1, 1, 1], long: [1, 1, 1], dotted: [1.5, 0.5, 1], dotS: [1.5, 0.5, 1], slurS: [[0.5, 0.5], 1, 1], slurU: [1, 1, [0.5, 0.5]] },
    "ter:4": { even: [2, 1, 1], long: [2, 1, 1], dotted: [[1.5, 0.5], 1, 1], dotS: [[1.5, 0.5], 1, 1], slurS: [[1, 1], 1, 1], slurU: [2, 1, [0.5, 0.5]] },
    "ter:6": { even: [3, 1, 2], long: [3, 1, 2], dotted: [2, 1, 3], dotS: [2, 1, 3], slurS: [[2, 1], 1, 2], slurU: [3, 1, [1, 1]] },
  };
  // a stretched foot (the gathering note, held a foot longer so the line's
  // stresses keep to the strong beats): its stressed syllable takes the room
  function stretchCell(cell, by) {
    var c = copy(cell);
    if (Array.isArray(c[0])) c[0][0] += by; else c[0] += by;
    return c;
  }
  function cellLen(c) { var s = 0; c.forEach(function (x) { s += Array.isArray(x) ? sum(x) : x; }); return s; }

  // ==========================================================================
  // 3. RHYTHM FIRST — one line's syllables poured onto the mode of time
  // ==========================================================================
  // Every stressed syllable begins a foot, and every foot begins on a strong
  // beat. The last stressed syllable is the line's long note; it is held
  // until the next line's pickup completes the bar, and a line that cannot
  // end so (a Common Meter eight in 4/4) holds one earlier stressed syllable
  // a foot longer — the gathering note — rather than cross a barline.
  //   → { notes: [{beat, beats, syl, stress, cont}], len, pickup, barStart }
  //   syl is the syllable's index within the line; cont marks a melisma's
  //   continuation note (no new syllable)
  function layoutLine(n, foot, time, cellIds, nextPickup, isLast, firstPickup, stretchPref) {
    var T = TIMES[time], stress = stressOf(n, foot);
    var fam = foot === "anapest" ? "ter" : "bin";
    var F = fam === "ter" ? T.ter : T.bin;
    var table = CELLS[fam + ":" + F] || CELLS[fam + ":" + (fam === "ter" ? 3 : 2)];
    var firstS = stress.indexOf(1);
    var pickupBeats = firstS;                              // one beat per pickup syllable
    // feet: [{ s: index of the stressed syllable, us: [unstressed after it] }]
    var feet = [];
    for (var i = firstS; i < n; i++) if (stress[i]) feet.push({ s: i, us: [] }); else if (feet.length) feet[feet.length - 1].us.push(i);
    var lastFoot = feet[feet.length - 1];
    // a note one glyph can write (a dotted value at most): a line's long
    // note of five crotchets would need a tie, so the line is laid out again
    function nice(beats) {
      var w = beats / T.den, V = [0.125, 0.1875, 0.25, 0.375, 0.5, 0.75, 1, 1.5];
      for (var i = 0; i < V.length; i++) if (Math.abs(V[i] - w) < EPS) return true;
      return false;
    }
    function attempt(stretched, loose) {
      var notes = [], pos = 0;
      for (var p = 0; p < pickupBeats; p++) notes.push({ beat: p, beats: 1, syl: p, stress: 0, cont: false });
      pos = pickupBeats;
      for (var k = 0; k < feet.length - 1; k++) {
        var f = feet[k], cid = cellIds[k] || "even";
        var cell = table[cid] || table[Object.keys(table)[0]];
        if (cell.length !== 1 + f.us.length) cell = table[Object.keys(table)[0]];
        if (stretched[k]) {
          cell = stretchCell(cell, F);
          if (!loose && !nice(Array.isArray(cell[0]) ? cell[0][0] : cell[0])) return null;
        }
        var sylIdx = [f.s].concat(f.us);
        cell.forEach(function (x, j) {
          var parts = Array.isArray(x) ? x : [x];
          parts.forEach(function (d, q) { notes.push({ beat: pos, beats: d, syl: sylIdx[j], stress: j === 0 && q === 0 ? 1 : 0, cont: q > 0 }); pos += d; });
        });
      }
      // the last foot: the long note, and a feminine ending's short syllables after it
      var trail = lastFoot.us.length;
      var sPos = pos, want = T.bar;
      var need = isLast ? (firstPickup || 0) : (nextPickup || 0);
      var lo = T.fin[0] + trail, hi = T.fin[1] + trail + (isLast ? T.bar : 0);
      var E = null, sLen = 0;
      for (var e = sPos + trail + 1; e <= sPos + hi + EPS; e += 0.5) {
        if (Math.abs(((e + need + (T.bar - pickupBeats % T.bar) % T.bar) % want)) > EPS || e - sPos < lo - EPS) continue;
        var room = e - sPos - trail;
        if (loose === "tie" || nice(room)) { E = e; sLen = room; break; }
        if (loose === "rest") {                            // hold what one glyph holds; breathe the rest
          for (var v = room - 0.5; v >= T.fin[0] - EPS; v -= 0.5) if (nice(v)) { E = e; sLen = v; break; }
          if (E != null) break;
        }
      }
      if (E == null) return null;
      notes.push({ beat: sPos, beats: sLen, syl: lastFoot.s, stress: 1, cont: false });
      for (var t2 = 0; t2 < trail; t2++) notes.push({ beat: sPos + (E - sPos - trail) + t2, beats: 1, syl: lastFoot.us[t2], stress: 0, cont: false });
      return { notes: notes, len: E, pickup: pickupBeats };
    }
    // the feet that start on a downbeat may be stretched; try none, then one
    // (the hymnist's preferred place first), then two
    var down = [];
    (function () {
      var pos = pickupBeats;
      for (var k = 0; k < feet.length - 1; k++) {
        if (Math.abs((pos - pickupBeats) % T.bar) < EPS) down.push(k);
        var cid = cellIds[k] || "even", cell = table[cid] || table[Object.keys(table)[0]];
        pos += cellLen(cell.length === 1 + feet[k].us.length ? cell : table[Object.keys(table)[0]]);
      }
    })();
    var order = stretchPref === "late" ? down.slice().reverse() : down.slice();
    var res = attempt({});
    for (var a = 0; !res && a < order.length; a++) { var st = {}; st[order[a]] = true; res = attempt(st); }
    for (a = 0; !res && a < order.length; a++) for (var b = a + 1; !res && b < order.length; b++) { var s2 = {}; s2[order[a]] = true; s2[order[b]] = true; res = attempt(s2); }
    if (!res) res = attempt({}, "rest");                   // a breath after a shorter long note, then
    if (!res) res = attempt({}, "tie");                    // or a tie, rather than no line
    if (!res) {                                            // never: but a line always comes back
      var plain = [], q = 0;
      for (var z = 0; z < n; z++) { var d = z === n - 1 ? 2 : 1; plain.push({ beat: q, beats: d, syl: z, stress: stress[z], cont: false }); q += d; }
      res = { notes: plain, len: q, pickup: pickupBeats };
    }
    res.barStart = ((T.bar - pickupBeats % T.bar) % T.bar);
    res.stress = stress;
    return res;
  }

  // ==========================================================================
  // THE RULER — a Score's measured habits (PLAN §2.6 and §12)
  // ==========================================================================
  // One ruler for the Earth tunes and the colony's, so "sounds like a Sacred
  // Harp tune" is a number that can be checked: the share of chord-to-chord
  // moves with parallel fifths, of sonorities with no third, of chromatic
  // notes and sevenths, the cadence mix, each part's compass, the tune's
  // leaps and melismas. Everything is read from the NOTES (the Earth tunes'
  // chord lists are partial), onset by onset, part by part.
  function partsOf(h) { var ps = {}; (h.lines || []).concat(h.refrain || []).forEach(function (l) { for (var p in l.notes) ps[p] = true; }); return ["S", "A", "T", "B"].filter(function (p) { return ps[p]; }); }
  function sonorities(h, line) {
    // every onset in the line → the note each part is sounding there
    var parts = Object.keys(line.notes), beats = {};
    parts.forEach(function (p) { line.notes[p].forEach(function (n) { beats[r3(n.beat)] = true; }); });
    var bs = Object.keys(beats).map(Number).sort(function (a, b) { return a - b; });
    return bs.map(function (b) {
      var s = { beat: b, notes: {}, onset: {} };
      parts.forEach(function (p) {
        var arr = line.notes[p];
        for (var i = 0; i < arr.length; i++) {
          var n = arr[i];
          if (n.beat <= b + EPS && b < n.beat + n.beats - EPS) { s.notes[p] = n; s.onset[p] = Math.abs(n.beat - b) < EPS; break; }
        }
      });
      return s;
    });
  }
  // the parts top to bottom: S A T B, unless the Hymn says otherwise (dialect
  // D sets the lead, T, second: S T A B)
  function orderOf(h) { return h.voiceOrder && h.voiceOrder.length === 4 ? h.voiceOrder : ["S", "A", "T", "B"]; }
  function fingerprint(h) {
    var mode = h.mode, parts = partsOf(h), mel = h.melodyPart, ORDER = orderOf(h);
    var lines = (h.lines || []).concat(h.refrain || []);
    var fp = { parts: parts.join(""), moves: 0, par5: 0, par8: 0, sonor: 0, thirdless: 0, crossing: 0, notes: 0, chromatic: 0,
               chords: 0, sevenths: 0, inversions: 0, susp: 0, melNotes: 0, melIntervals: 0, leaps: 0, bigLeaps: 0, steps: 0, repeats: 0, melisma: 0,
               cadences: {}, range: {}, rangeSemi: {}, lines: lines.length, closes: 0, closeThird: 0, closeHome: 0, closeDom: 0,
               // (round 3) closes on one pitch; onsets where a part is silent (a fuge's, an echo's); septimal notes; ornament marks
               closeUnison: 0, onsets: 0, stagger: 0, septimal: 0, ornaments: 0 };
    var lo = {}, hi = {}, loS = {}, hiS = {};
    lines.forEach(function (l) {
      var S = sonorities(h, l), prev = null;
      S.forEach(function (s) {
        var ps = Object.keys(s.notes), semis = {};
        ps.forEach(function (p) { var n = s.notes[p]; semis[p] = semi(mode, n.deg, n.alt || 0); });
        if (parts.length >= 2) { fp.onsets++; if (ps.length < parts.length) fp.stagger++; }
        if (ps.length >= 2) {
          fp.sonor++;
          var pcs = {}, third = false;
          ps.forEach(function (p) { pcs[((semis[p] % 12) + 12) % 12] = true; });
          var pl = Object.keys(pcs).map(Number);
          for (var i = 0; i < pl.length; i++) for (var j = 0; j < pl.length; j++) {
            var iv = ((pl[j] - pl[i]) % 12 + 12) % 12;
            if (iv === 3 || iv === 4) third = true;
          }
          if (!third) fp.thirdless++;
          // crossing: an upper part below a lower one (S A T B order, or the Hymn's own)
          var ord = ORDER.filter(function (p) { return semis[p] != null; }), cross = false;
          for (var k = 0; k + 1 < ord.length; k++) if (semis[ord[k]] < semis[ord[k + 1]]) cross = true;
          if (cross) fp.crossing++;
        }
        if (prev) {
          var both = ps.filter(function (p) { return prev.semis[p] != null && s.onset[p]; });
          if (both.length >= 2) {
            fp.moves++;
            var p5 = false, p8 = false;
            for (var a = 0; a < both.length; a++) for (var b = a + 1; b < both.length; b++) {
              var x = both[a], y = both[b];
              var m1 = semis[x] - prev.semis[x], m2 = semis[y] - prev.semis[y];
              if (!m1 || !m2 || (m1 > 0) !== (m2 > 0)) continue;
              var i1 = Math.abs(prev.semis[x] - prev.semis[y]) % 12, i2 = Math.abs(semis[x] - semis[y]) % 12;
              if (i1 === 7 && i2 === 7) p5 = true;
              if (i1 === 0 && i2 === 0) p8 = true;
            }
            if (p5) fp.par5++;
            if (p8) fp.par8++;
          }
        }
        prev = { semis: semis };
      });
      parts.forEach(function (p) {
        (l.notes[p] || []).forEach(function (n) {
          fp.notes++;
          if (n.alt) fp.chromatic++;
          if (n.monzo && n.monzo[3]) fp.septimal++;
          if (n.nct === "susp") fp.susp++;
          var d = n.deg, sd = semi(mode, n.deg, n.alt || 0);
          lo[p] = lo[p] == null ? d : Math.min(lo[p], d);
          hi[p] = hi[p] == null ? d : Math.max(hi[p], d);
          loS[p] = loS[p] == null ? sd : Math.min(loS[p], sd);
          hiS[p] = hiS[p] == null ? sd : Math.max(hiS[p], sd);
        });
      });
      var m = l.notes[mel] || [];
      m.forEach(function (n, i) {
        fp.melNotes++;
        if (n.syl === null) fp.melisma++;
        if (n.ornament) fp.ornaments++;
        if (i === 0) return;
        var iv = Math.abs(n.deg - m[i - 1].deg);
        fp.melIntervals++;
        if (iv === 0) fp.repeats++; else if (iv === 1) fp.steps++; else { fp.leaps++; if (iv >= 4) fp.bigLeaps++; }
      });
      var ck = (l.cadence && l.cadence.kind) || "none";
      fp.cadences[ck] = (fp.cadences[ck] || 0) + 1;
      // THE CLOSE, READ FROM THE NOTES (the cadence mix on one ruler for Earth
      // and colony): the sonority sounding at the line's cadence — on home's
      // chord, on the dominant's, or elsewhere; with its third or bare
      if (parts.length >= 2 && K.Dialects && K.Dialects.chordAt) {
        var cb = l.cadence && l.cadence.beat != null ? l.cadence.beat : null;
        if (cb == null) { var mm = l.notes[mel] || []; for (var q = mm.length - 1; q >= 0; q--) if (mm[q].stress) { cb = mm[q].beat; break; } }
        var at = [];
        parts.forEach(function (p) { (l.notes[p] || []).forEach(function (n) { if (n.beat <= cb + EPS && cb < n.beat + n.beats - EPS) at.push(n); }); });
        if (at.length >= 2) {
          at.sort(function (a, b) { return semi(mode, a.deg, a.alt || 0) - semi(mode, b.deg, b.alt || 0); });
          var cc = K.Dialects.chordAt(mode, at.map(function (n) { return { deg: n.deg, alt: n.alt || 0 }; }));
          fp.closes++;
          if (cc.quality === "unison") fp.closeUnison++;
          if (cc.third) fp.closeThird++;
          if (cc.root === 0) fp.closeHome++; else if (cc.root === 4) fp.closeDom++;
        }
      }
      (l.chords || []).forEach(function (c) {
        fp.chords++;
        if (/7/.test(c.quality) || c.dim7 || /7/.test(c.roman || "")) fp.sevenths++;
        if (c.inv === 1 || /6$/.test(c.roman || "")) fp.inversions++;
      });
    });
    parts.forEach(function (p) { fp.range[p] = hi[p] - lo[p]; fp.rangeSemi[p] = hiS[p] - loS[p]; });
    // the shares a reader compares
    function sh(a, b) { return b ? r3(a / b) : 0; }
    fp.share = {
      par5: sh(fp.par5, fp.moves), par8: sh(fp.par8, fp.moves), thirdless: sh(fp.thirdless, fp.sonor),
      crossing: sh(fp.crossing, fp.sonor), chromatic: sh(fp.chromatic, fp.notes), sevenths: sh(fp.sevenths, fp.chords),
      inversions: sh(fp.inversions, fp.chords), leap: sh(fp.leaps, fp.melIntervals), bigLeap: sh(fp.bigLeaps, fp.melIntervals),
      repeat: sh(fp.repeats, fp.melIntervals), melisma: sh(fp.melisma, fp.melNotes),
      closeThird: sh(fp.closeThird, fp.closes), closeHome: sh(fp.closeHome, fp.closes), closeDom: sh(fp.closeDom, fp.closes),
      closeUnison: sh(fp.closeUnison, fp.closes), stagger: sh(fp.stagger, fp.onsets), septimal: sh(fp.septimal, fp.notes), ornament: sh(fp.ornaments, fp.melNotes),
    };
    var cadN = 0; for (var ck in fp.cadences) cadN += fp.cadences[ck];
    fp.cadenceShare = {}; for (ck in fp.cadences) fp.cadenceShare[ck] = sh(fp.cadences[ck], cadN);
    fp.melodyRange = fp.range[mel];
    return fp;
  }

  // ==========================================================================
  // 2. THE SKELETON — before any note: every line's cadence and ending, the
  // tune's floor and PEAK, each line's contour and first note
  // ==========================================================================
  // A line's ROLE in the tune decides what its cadence may be: the first
  // line opens, the second arrives somewhere, the third departs, the last
  // comes home (a doubled tune does it twice, the middle arrival a half
  // close; a refrain comes home again).
  function roleOf(i, n) {
    if (i === n - 1) return "home";
    if (n >= 8 && i === n / 2 - 1) return "arrive";
    var k = n >= 8 ? i % (n / 2) : i;
    return k === 0 ? "open" : k === 1 ? "arrive" : "depart";
  }
  // THE ENDING FIGURES: a line's last notes, as steps from its target. They
  // are drawn, not searched (enrichment-1 §2): the search fills the notes
  // before them. A dialect says which fit which cadence (a Tabernacle
  // authentic close needs its next-to-last note in the dominant chord).
  var FIGURES = {
    "fall":      [1, 0],          // re–do, fa–mi, la–sol: the step down home
    "rise":      [-1, 0],         // ti–do, the leading tone; in a modal tune the subtonic
    "three":     [2, 1, 0],       // mi–re–do
    "four":      [3, 2, 1, 0],    // fa–mi–re–do
    "turn":      [0, -1, 0],      // do–ti–do
    "upturn":    [0, 1, 0],       // the upper neighbour
    "fifth":     [-3, 0],         // sol, up to do: the shape-note close
    "third":     [2, 0],          // mi, down to do: the gapped fall
    "triad":     [4, 2, 0],       // sol–mi–do
    "again":     [0, 0],          // the last note struck twice
    "climb":     [-2, -1, 0],     // la–ti–do
    "sigh":      [1, 1, 0],
  };
  // a hymnist's signature ending (a list of steps) → the figure's name
  function figureName(steps) {
    for (var k in FIGURES) if (FIGURES[k].join() === steps.join()) return k;
    return null;
  }

  // does a run of degrees sing a tritone between neighbours?
  function tritoneIn(mode, degs) {
    for (var i = 1; i < degs.length; i++) if (Math.abs(semi(mode, degs[i], 0) - semi(mode, degs[i - 1], 0)) % 12 === 6) return true;
    return false;
  }
  function drawFrame(R, opts, D, H) {
    // (dialect E first says which unison song it is: a Shaker hymn, a gift
    // song on wordless syllables, a Primary song with its chorus — and the
    // kind leans on the meters and the forms. The first three dialects throw
    // no such die.)
    var kind = null;
    if (D.kinds) {
      var kDraw = pickW(R.fork("kind"), weightsOf(D.kinds, H && H.kinds, 1));
      kind = opts.kind && D.kinds[opts.kind] != null ? opts.kind : kDraw;
    }
    var meterTable = kind && D.kindMeters && D.kindMeters[kind] ? D.kindMeters[kind] : D.meters;
    // one die per choice, thrown whether or not the caller named the answer
    var mDraw = pickW(R.fork("meter"), weightsOf(meterTable, H && H.meters));
    var tDraw = pickW(R.fork("time"), weightsOf(D.times, H && H.times));
    var oDraw = pickW(R.fork("mode"), weightsOf(D.modes, H && H.modes));
    var meter = opts.meter && METERS[opts.meter] ? opts.meter : mDraw;
    var time = opts.modeOfTime && TIMES[opts.modeOfTime] ? opts.modeOfTime : tDraw;
    var mode = opts.mode && SEMIS[opts.mode] ? opts.mode : oDraw;
    var M = METERS[meter];
    var nL = M.lines.length;
    var pool = [];
    var forms = FORMS[nL] || FORMS[4];
    if (D.extraForms && D.extraForms[nL]) { var fx = {}; for (var f0 in forms) fx[f0] = forms[f0]; for (f0 in D.extraForms[nL]) fx[f0] = D.extraForms[nL][f0]; forms = fx; }
    var kindForms = kind && D.kindForms ? D.kindForms[kind] || {} : null;
    for (var f in forms) if (has(forms, f)) {
      var w = forms[f] * (D.forms && D.forms[f] != null ? D.forms[f] : 1) * (H && H.forms && H.forms[f] != null ? H.forms[f] : (H ? 0.6 : 1));
      if (kindForms) w *= kindForms[f] != null ? kindForms[f] : (kind === "gift" ? 0.05 : 1);
      var repeats = formLetters(f).some(function (x, i, a) { return a.findIndex(function (y) { return y.letter === x.letter; }) !== i; });
      if (repeats && H) w *= 0.5 + (H.repeat || 0.5);
      pool.push([f, w]);
    }
    var fDraw = pickW(R.fork("form"), pool);
    var form = opts.form && formLetters(opts.form).length === nL ? opts.form : fDraw;
    // the refrain (a meter that has one; or, now and then, a hymnist's fondness)
    var refrainDie = u01(R.fork("refrain"));
    var refrain = M.refrain ? M.refrain.slice() : null;
    if (!refrain && D.refrains && H && refrainDie < (H.refrain || 0) * D.refrains && nL === 4) refrain = [M.lines[nL - 2], M.lines[nL - 1]];
    // (a gospel hymn always has its refrain, after every verse; a Primary
    // song its chorus; a gift song none — it is its own two strains)
    if (!refrain && (D.alwaysRefrain || kind === "primary")) {
      var rLen = u01(R.fork("refrain:length")) < (kind === "primary" ? 0.7 : 0.55) || nL < 4 ? 2 : 4;
      refrain = rLen === 2 ? [M.lines[nL - 2], M.lines[nL - 1]] : M.lines.slice(0, 4);
    }
    if (kind === "gift") refrain = null;
    return { meter: meter, time: time, mode: mode, form: form, refrain: refrain, foot: M.foot, lines: M.lines.slice(), kind: kind };
  }

  // the melody part's compass in degrees, given the key's height: the
  // dialect's range for that part (semitones above the day's keynote) read
  // as scale degrees of this mode on this key
  function degBounds(mode, keySemi, range) {
    var lo = null, hi = null;
    for (var d = -28; d <= 28; d++) {
      var s = keySemi + semi(mode, d, 0);
      if (s >= range[0] && lo == null) lo = d;
      if (s <= range[1]) hi = d;
    }
    return [lo, hi];
  }

  function planSkeleton(R, fr, D, H, keySemi) {
    var n = fr.lines.length, letters = formLetters(fr.form);
    var allLines = fr.lines.concat(fr.refrain || []);
    var N = allLines.length;
    var classes = TUNE_CLASSES[fr.mode];
    // the tune's height: its peak above the final, and its span
    var peakPool = weightsOf(D.peakTo, H && H.peakTo, 0.3).filter(function (x) { return classes.indexOf(cls(+x[0])) >= 0 && (fr.kind !== "primary" || +x[0] <= 7); });
    var peakTo = +pickW(R.fork("peak:height"), peakPool);
    var span = Math.round(R.fork("peak:span").rnd((H ? H.range[0] : D.range[0]) - 0.49, (H ? H.range[1] : D.range[1]) + 0.49));
    span = clamp(span, Math.max(4, peakTo), D.maxSpan || 10);
    var maxSemi = fr.kind === "primary" ? 12 : 17;                 // (a Primary song stays inside the octave)
    // the octave the tune sits in, for the part that sings it: where the
    // day's key lets its peak and a floor of sol-below both sit comfortably
    var mp = D.melodyPart, rng = D.ranges[mp], tess = D.tess[mp];
    var best = 0, bestCost = 1e9;
    for (var o = -2; o <= 2; o++) {
      var lo = keySemi + semi(fr.mode, Math.max(-3, peakTo - span) + 7 * o), hi = keySemi + semi(fr.mode, peakTo + 7 * o), fin = keySemi + 12 * o;
      // a final below the compass cannot be mended; a peak above it can come down
      var c = Math.max(0, rng[0] - fin) * 10 + Math.max(0, rng[0] - lo) * 3 + Math.max(0, hi - rng[1]) * 1.5 + Math.abs((lo + hi) / 2 - (tess[0] + tess[1]) / 2) * 0.2;
      if (c < bestCost) { bestCost = c; best = o; }
    }
    // a peak the key puts out of reach comes down (to a note the mode has)
    while (peakTo > 4 && keySemi + semi(fr.mode, peakTo + 7 * best) > rng[1]) { peakTo--; while (classes.indexOf(cls(peakTo)) < 0) peakTo--; }
    // the floor: where the tune may dip below its final — sol below is the
    // hymn's favourite floor, la and ti below are common, lower is rare; and
    // never below the part's compass on this key
    var fPool = [], fMin = D.floorMin != null ? D.floorMin : -5;
    for (var f = Math.max(fMin, peakTo - (D.maxSpan || 10)); f <= (D.floorMax != null ? D.floorMax : 0); f++) {
      if (classes.indexOf(cls(f)) < 0) continue;
      if (semi(fr.mode, peakTo, 0) - semi(fr.mode, f, 0) > maxSemi) continue;     // an octave and a fourth, in semitones (a child's song, an octave)
      var under = rng[0] - (keySemi + semi(fr.mode, f + 7 * best));
      var fw = Math.exp(-Math.pow((peakTo - f) - span, 2) / 3) * (f === -3 ? 1.6 : f === 0 ? 1.2 : f < -3 ? 0.35 : 1) * (under > 0 ? Math.exp(-under) * 0.05 : 1);
      fPool.push([f, fw]);
    }
    var floor = fPool.length ? pickW(R.fork("peak:floor"), fPool) : 0;
    while (semi(fr.mode, peakTo, 0) - semi(fr.mode, floor, 0) > maxSemi && floor < 0) floor++;
    span = peakTo - floor;
    var base = 7 * best;
    // where the peak falls: a line that is its own (not a copy of another),
    // whose middle is nearest the hymnist's (or the plan's) 60–75 %
    // (the tune's syllables are counted through the verse only: the peak is the verse's)
    var totalSyl = sum(fr.lines), acc = 0, span0 = [];
    var sylAt = [];
    fr.lines.forEach(function (c) { sylAt.push(acc); span0.push([(acc + 1) / (totalSyl - 1), (acc + c - 3) / (totalSyl - 1)]); acc += c; });
    var wantAt = clamp((H ? H.peakAt : 0.68) + R.fork("peak:line").rnd(-0.04, 0.04), 0.6, 0.75);
    // how well a line can hold the peak: how far its middle lies from the
    // wanted place, and whether it has room for the high note INSIDE the
    // band (the syllables of its middle that fall in 60–75 %)
    function offAt(k) { var sp2 = span0[k]; return wantAt < sp2[0] ? sp2[0] - wantAt : wantAt > sp2[1] ? wantAt - sp2[1] : 0; }
    function fitAt(k) {
      var inb = 0;
      for (var y = sylAt[k] + 1; y <= sylAt[k] + fr.lines[k] - 3; y++) { var gy = y / (totalSyl - 1); if (gy >= 0.6 - EPS && gy <= 0.75 + EPS) inb++; }
      return offAt(k) * 3 + (inb >= 2 ? 0 : inb === 1 ? 0.15 : 0.5);
    }
    var peakLine = -1, pBest = 1e9;
    for (var i = 0; i < n; i++) {
      var L = letters[i], firstOf = letters.findIndex(function (x) { return x.letter === L.letter; }) === i;
      var copies = letters.filter(function (x) { return x.letter === L.letter; }).length;
      var own = copies === 1 || L.prime;
      if (!own && !firstOf) continue;
      var cost = fitAt(i) + (own ? 0 : 0.3) + (i === n - 1 ? 0.1 : 0);
      if (cost < pBest) { pBest = cost; peakLine = i; }
    }
    // a form that repeats the line where the peak belongs (ABAC) turns that
    // line elsewhere instead: it begins as its model did and climbs (ABA'C)
    if (fitAt(peakLine) > 0.12) {
      var conv = -1, cBest = fitAt(peakLine) - 0.1;
      for (i = 0; i < n; i++) {
        var Li = letters[i], isFirst = letters.findIndex(function (x) { return x.letter === Li.letter; }) === i;
        if (!isFirst && !Li.prime && fitAt(i) < cBest) { cBest = fitAt(i); conv = i; }
      }
      if (conv >= 0) { letters[conv].prime = true; peakLine = conv; }
      fr.form = letters.map(function (x) { return x.letter + (x.prime ? "'" : ""); }).join("");
    }
    // the cadence of every line, its ending figure, its contour and first note
    var lines = [];
    for (i = 0; i < N; i++) {
      var inRefrain = i >= n, ri = inRefrain ? i - n : i;
      var role = inRefrain ? (i === N - 1 ? "home" : "open") : (fr.refrain && i === n - 1 ? "home" : roleOf(i, n));
      var Ri = R.fork("line:" + i);
      var cadPool = (D.cadences[role] || D.cadences.open).filter(function (c) { return !c[3] || c[3].indexOf(fr.mode) >= 0; });
      cadPool = cadPool.filter(function (c) { return classes.indexOf(cls(c[1])) >= 0; });
      // a line can only end where the tune's compass reaches
      var reach = cadPool.filter(function (c) { for (var t = floor; t <= peakTo - 1; t++) if (cls(t) === cls(c[1])) return true; return c[1] === 0; });
      if (reach.length) cadPool = reach;
      var cad = pickW(Ri.fork("cadence"), cadPool.map(function (c) { return [c, c[2]]; }));
      // (the Sacred Harp closes an inner line FULL now and then — its third
      // kept — more in the major modes than the minor, less for a hymnist who
      // loves the open fifth; an open close that keeps its third is imperfect)
      var fullDie = u01(Ri.fork("close:full")), kind = cad[0], full = false;
      if (D.fullClose && role !== "home" && (kind === "openfifth" || kind === "half")) {
        var pf = (MINOR[fr.mode] ? D.fullClose.minor : D.fullClose.major) * (1.25 - 0.5 * (H && H.open != null ? H.open : 0.7));
        if (fullDie < pf) { full = true; if (kind === "openfifth") kind = "imperfect"; }
      }
      // the ending: the dialect's appetite (its last line's own, where it has
      // one), the hymnist's signature on the last line
      var figPool = [];
      for (var fnm in D.figures) if (has(D.figures, fnm)) {
        var steps = FIGURES[fnm], okF = D.figureFits ? D.figureFits(cad[0], cad[1], steps, fr.mode, cad[4]) : true;
        if (!okF) continue;
        var degs = steps.map(function (s) { return cad[1] + s; });
        if (!degs.every(function (d) { return classes.indexOf(cls(d)) >= 0; })) continue;
        if (tritoneIn(fr.mode, degs)) continue;                    // (sol–do is a tritone in some modes' places)
        var fw = D.figures[fnm] * (fr.kind && D.kindFigures && D.kindFigures[fr.kind] && D.kindFigures[fr.kind][fnm] != null ? D.kindFigures[fr.kind][fnm] : 1);
        var hf = D.homeFigures ? D.homeFigures[MINOR[fr.mode] ? "minor" : "major"] : null;
        if (role === "home" && hf && hf[fnm] != null) fw *= hf[fnm];
        if (H && role === "home") (H.ending || []).forEach(function (e) { if (figureName(e[0]) === fnm) fw *= 1 + 0.6 * e[1]; });
        figPool.push([fnm, fw]);
      }
      if (!figPool.length) figPool.push(["fall", 1]);
      var fig = pickW(Ri.fork("figure"), figPool);
      var contour = pickW(Ri.fork("contour"), weightsOf(D.contours, H && H.contours));
      // (round 3, the critic's idiom notes — each a die of its own, thrown
      // after everything above, so a line it leaves alone is the line it was)
      // THE TABERNACLE RESTS mid-verse, now and then, on a chord that is
      // neither home's nor the dominant's — IV, vi, the mediant, with the
      // tune's own note in it — as the 1889 Psalmody does ("none:IV",
      // "half:iii"); the colony's hymns had closed on the dominant 45 % of
      // the time against the book's 29 %. The tune is unchanged: only the
      // chord under its last note moves.
      var planV = cad[4] || null, restDie = u01(Ri.fork("close:rest")), bareDie = u01(Ri.fork("close:bare")), bare = false;
      if (D.restClose && role !== "home" && !planV && !full) {
        var pr = kind === "half" ? D.restClose.half : kind === "imperfect" ? D.restClose.imperfect : 0;
        if (restDie < pr && (!D.restFits || D.restFits(fr.mode, cad[1]))) { kind = "none"; planV = "rest"; }
      }
      // THE SQUARE CLOSES BARE: a line may end on a unison or an octave,
      // every part on the tune's own note (one close in seven in the 1844
      // book; the colony's had been one in a hundred)
      if (D.bareClose && !full && (kind === "openfifth" || kind === "half") && cls(cad[1]) === (kind === "half" ? 4 : 0)) {
        if (bareDie < (role === "home" ? D.bareClose.home : D.bareClose.inner)) bare = true;
      }
      lines.push({ i: i, refrain: inRefrain, role: role, syl: allLines[i], cadence: kind, full: full, bare: bare, targetClass: cad[1], plan: planV, figure: fig, figPool: figPool,
                   figSteps: FIGURES[fig].slice(), contour: contour, peak: i === peakLine,
                   letter: inRefrain ? String.fromCharCode(72 + ri) : letters[i].letter, prime: inRefrain ? false : letters[i].prime,
                   cellDie: Ri.fork("cell"), startDie: Ri.fork("start"), fermDie: u01(Ri.fork("fermata")), die: Ri });
    }
    // THE FLOOR MAKES ROOM FOR THE LAST LINE'S ENDING. A tune that never goes
    // below its final cannot end ti–do, and a drawn ending that cannot be sung
    // falls back to the commonest one — which is how the endings collapsed
    // onto re–do (the round-2 critic). So when the last line's figure dips
    // under the final (ti–do, la–ti–do, sol–do, do–ti–do), the floor comes
    // down to meet it, if the compass, the key and an octave and a fourth allow.
    lines.forEach(function (L) {
      if (L.role !== "home") return;
      var need = Math.min.apply(null, L.figSteps);
      if (need >= floor) return;
      var fits = peakTo - need <= (D.maxSpan || 10) && semi(fr.mode, peakTo, 0) - semi(fr.mode, need, 0) <= maxSemi &&
                 rng[0] - (keySemi + semi(fr.mode, need + 7 * best, 0)) <= 1;
      if (fits) floor = need;
    });
    span = peakTo - floor;
    var sylBefore = [], a2 = 0;
    allLines.forEach(function (c, k) { sylBefore.push(k < n ? a2 : 0); if (k < n) a2 += c; });
    return { base: base, floor: floor + base, peak: peakTo + base, peakTo: peakTo, span: span, peakLine: peakLine, lines: lines, classes: classes,
             wantAt: wantAt, sylBefore: sylBefore, totalSyl: totalSyl };
  }

  // ==========================================================================
  // 3b. THE RHYTHM OF EVERY LINE — a cell drawn per line, before the notes;
  // a letter sung again is sung in its own rhythm again
  // ==========================================================================
  function planRhythm(fr, sk, D, H) {
    var pick = function (l) { return fr.foot === "trochee" ? 0 : 1; };
    var N = sk.lines.length, byLetter = {};
    return sk.lines.map(function (L, i) {
      var cellPool = weightsOf(D.cells, H && H.cells, 0.4);
      // (round 3, second pass: a dialect may lean its cells by the mode of time —
      // dialect E's dotted six-eight foot slurs a syllable over two notes, and
      // the unison songs had come to slur twice as often as SIMPLE GIFTS, which never does)
      if (D.timeCells && D.timeCells[fr.time]) cellPool = cellPool.map(function (c) { var m = D.timeCells[fr.time][c[0]]; return m != null ? [c[0], c[1] * m] : c; });
      var cell = pickW(L.cellDie.fork("which"), cellPool);
      var rate = D.cellRate != null ? D.cellRate : 0.5;
      var ids = [];
      for (var k = 0; k < 12; k++) ids.push(u01(L.cellDie.fork("foot:" + k)) < rate ? cell : (D.baseCell || "even"));
      var stretchPref = u01(L.cellDie.fork("stretch")) < 0.7 ? "early" : "late";
      var isLast = i === N - 1;
      var nextPickup = isLast ? 0 : pick(i + 1);
      var key = L.letter + ":" + L.syl;
      var lay;
      if (byLetter[key] && !L.prime) { lay = copy(byLetter[key]); lay.copied = true; }
      else lay = layoutLine(L.syl, fr.foot, fr.time, ids, nextPickup, isLast, pick(0), stretchPref);
      // the end of a copied line still has to meet the next line's pickup
      if (lay.copied && isLast) lay = layoutLine(L.syl, fr.foot, fr.time, ids, nextPickup, isLast, pick(0), stretchPref);
      if (!byLetter[key]) byLetter[key] = lay;
      lay.cell = cell;
      return lay;
    });
  }

  // (round 3) A PARTNER'S FRAME: every line as long as the first hymn's and
  // on the same bar-beat (its own rhythm where that fits, else the first
  // hymn's own), and every line's close on a note of the first hymn's chord
  // there — a different note from the first tune's, where there is one
  function partnerFrame(fr, sk, rh, D, P1, sameRhythm) {
    var plan = partnerPlan(P1), L1 = P1.lines.concat(P1.refrain || []);
    sk.partner = plan;
    sk.lines.forEach(function (L, i) {
      var pp = plan[i]; if (!pp) return;
      var next = L1[i + 1], want = next && i + 1 < L1.length ? next.startBeat - pp.startBeat : null;
      var lay = rh[i];
      if (sameRhythm || (want != null && Math.abs(lay.len - want) > EPS) || lay.barStart !== pp.barStart || (want == null && Math.abs(lay.len - pp.len) > EPS && lay.len < pp.len)) {
        var m = pp.line.notes[P1.melodyPart], first = null, sy = -1;
        m.forEach(function (n) { if (n.syl !== null && first == null) first = n.syl; });
        rh[i] = { notes: m.map(function (n) { if (n.syl !== null) sy = n.syl - first; return { beat: n.beat, beats: n.beats, syl: sy, stress: n.stress, cont: n.syl === null }; }),
                  len: want != null ? want : pp.len, pickup: lay.pickup, barStart: pp.barStart, cell: "the first hymn's", stress: lay.stress };
      }
      // the close: the first hymn's kind, on a note of its chord
      var tones = (pp.cadenceTones || []).filter(function (c) { return sk.classes.indexOf(c) >= 0; });
      L.cadence = pp.cadence.kind; L.plan = pp.line.plan && pp.line.plan.via ? pp.line.plan.via : null; L.full = false; L.bare = false;
      if (L.role !== "home" && tones.length && (tones.indexOf(cls(L.targetClass)) < 0 || (cls(L.targetClass) === pp.tuneEnd && tones.length > 1))) {
        var others = tones.filter(function (c) { return c !== pp.tuneEnd; });
        L.targetClass = (others.length ? others : tones)[Math.floor(u01(L.die.fork("partner:target")) * (others.length ? others : tones).length)];
      }
      var fits = (L.figPool || []).filter(function (fw) { return !D.figureFits || D.figureFits(L.cadence, L.targetClass, FIGURES[fw[0]], fr.mode, L.plan); });
      if (fits.length && !fits.some(function (fw) { return fw[0] === L.figure; })) { L.figure = pickW(L.die.fork("partner:figure"), fits); L.figSteps = FIGURES[L.figure].slice(); }
    });
  }
  // the partner's cost for a candidate line: its notes against the first
  // hymn's tune and chord, onset by onset (a clash on the beat, a note off
  // the chord, fifths and octaves in parallel with the other tune)
  function partnerCost(d, P, mode) {
    var pp = P.partner, c = 0, prev = null;
    for (var i = 0; i < d.length; i++) {
      var n = P.notes[i], s = semi(mode, d[i], 0), hm = pp.melAt(n.beat), cs = pp.classesAt(n.beat), strong = !!n.stress;
      if (cs && !cs[cls(d[i])]) c += strong || n.beats > 1 + EPS ? 6 : (i + 1 < d.length && Math.abs(d[i + 1] - d[i]) === 1 && i > 0 && Math.abs(d[i] - d[i - 1]) === 1 ? 0.5 : 4);
      if (hm != null) {
        var ic = Math.abs(s - hm) % 12;
        if (ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6) c += strong ? 6 : 1;
        if (ic === 0) c += 1.0;
        if (prev && prev.hm != null && s !== prev.s && hm !== prev.hm && (s > prev.s) === (hm > prev.hm) && prev.ic === ic && (ic === 0 || ic === 7)) c += 3;
        prev = { s: s, hm: hm, ic: ic };
      }
      // (the other tune moving on the beat under this one's held note)
      var end = n.beat + n.beats;
      for (var b = Math.ceil(n.beat + EPS); b < end - EPS; b++) { var hb = pp.melAt(b); if (hb != null) { var ib = Math.abs(s - hb) % 12; if (ib === 1 || ib === 2 || ib === 10 || ib === 11 || ib === 6) c += 1.5; } }
    }
    return c;
  }

  // ==========================================================================
  // 4. THE MELODY — the ending, the peak and the rhythm are already drawn;
  // the search fills the notes between them
  // ==========================================================================
  function semiDiff(mode, a, b) { return Math.abs(semi(mode, a, 0) - semi(mode, b, 0)); }
  // the soft shape a line leans toward, note by note
  function contourCurve(kind, n, s, e, apex, apexPos, floor) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var x = n > 1 ? i / (n - 1) : 0, v;
      if (kind === "arch") v = x <= apexPos ? s + (apex - s) * Math.sin(Math.PI / 2 * x / Math.max(0.05, apexPos)) : apex + (e - apex) * (x - apexPos) / Math.max(0.05, 1 - apexPos);
      else if (kind === "descent") { var top = Math.max(s, e + 3, apex - 1); v = x < 0.25 ? s + (top - s) * x / 0.25 : top + (e - top) * (x - 0.25) / 0.75; }
      else if (kind === "climb") { var bot = Math.max(floor, Math.min(s, e - 3)); v = x < 0.3 ? s + (bot - s) * x / 0.3 : bot + (e - bot) * (x - 0.3) / 0.7; }
      else v = s + (e - s) * x + 1.6 * Math.sin(2 * Math.PI * x);                 // wave
      out.push(v);
    }
    return out;
  }
  function intervals(d) { var o = []; for (var i = 1; i < d.length; i++) o.push(d[i] - d[i - 1]); return o; }
  function similarity(a, b) {
    var ia = intervals(a), ib = intervals(b), m = Math.min(ia.length, ib.length), same = 0;
    if (!m) return 0;
    for (var i = 0; i < m; i++) if (ia[i] === ib[i]) same++;
    return same / m;
  }
  // the longest run of equal intervals two melodies share, anywhere
  function sharedRun(a, b) {
    var ia = intervals(a), ib = intervals(b), best = 0;
    for (var i = 0; i < ia.length; i++) for (var j = 0; j < ib.length; j++) {
      var k = 0;
      while (i + k < ia.length && j + k < ib.length && ia[i + k] === ib[j + k]) k++;
      if (k > best) best = k;
    }
    return best;
  }

  // score a candidate line: lower is better. W: the dialect's weights; ctx:
  // the tune so far (the lines already written) and the line's plan.
  function lineCost(d, P, W, mode, done, gesture) {
    var n = d.length, c = 0, iv = intervals(d), leaps = 0, big = 0;
    for (var i = 0; i < iv.length; i++) {
      var a = Math.abs(iv[i]);
      if (a >= 2) leaps++;
      if (a >= 5) { big++; c += a === 7 ? W.octave : a === 5 && iv[i] > 0 ? W.sixth : 9; }
      if (a >= 1 && semiDiff(mode, d[i], d[i + 1]) === 6) c += 8;             // the tritone, sung
      if (a === 4) c += W.fifth;
      // a leap of a fourth or more is recovered by a step back
      if (a >= 3 && i + 1 < iv.length) {
        var nx = iv[i + 1];
        if (nx !== 0 && (nx > 0) === (iv[i] > 0)) c += Math.abs(nx) === 1 && a === 3 ? 0.6 : W.unrecovered;
        else if (Math.abs(nx) > 2) c += W.unrecovered * 0.5;
      }
      // two leaps the same way outline a chord, or they wander
      if (a >= 2 && i + 1 < iv.length && Math.abs(iv[i + 1]) >= 2 && (iv[i + 1] > 0) === (iv[i] > 0)) {
        var tot = Math.abs(iv[i] + iv[i + 1]);
        c += (a === 2 && Math.abs(iv[i + 1]) === 2) || (tot === 4 || tot === 7) ? 0.25 : 1.8;
      }
      if (iv[i] === 0 && i + 1 < iv.length && iv[i + 1] === 0) c += W.threeSame;
      // a see-saw (sol–la–sol–la) goes nowhere
      if (i + 2 < iv.length && iv[i] !== 0 && iv[i + 1] === -iv[i] && iv[i + 2] === iv[i]) c += W.seesaw != null ? W.seesaw : 1.2;
      if (iv[i] === 0) c += W.repeat;
    }
    var rate = iv.length ? leaps / iv.length : 0;
    c += W.leapFit * 10 * Math.pow(rate - P.leapTarget, 2);
    // the contour, softly
    var dev = 0;
    for (i = 0; i < n; i++) dev += Math.abs(d[i] - P.curve[i]);
    c += W.contour * dev / n;
    // the strong syllables stand on the chord of home more often than not
    for (i = 0; i < n; i++) {
      if (!P.notes[i].stress || P.fixed[i] != null) continue;
      var k = cls(d[i] - P.home);                                         // the final's own triad, in every mode
      if (k === 0 || k === 2 || k === 4) c -= W.stressHome; else if (k === 6 || k === 3) c += W.stressTense;
    }
    // the leading tone of a major tune leads
    if (P.major) for (i = 0; i + 1 < n; i++) if (cls(d[i] - P.doDeg) === 6 && d[i + 1] - d[i] !== 1 && d[i + 1] - d[i] !== -1) c += W.leadingTone;
    // a line needs a few pitches to be a tune
    var distinct = {}; d.forEach(function (x) { distinct[x] = true; });
    var nd = Object.keys(distinct).length;
    if (n >= 6 && nd < 4) c += W.fewPitches * (4 - nd);
    // no four notes spread wider than an octave
    for (i = 0; i + 3 < n; i++) { var mx = Math.max(d[i], d[i + 1], d[i + 2], d[i + 3]), mn = Math.min(d[i], d[i + 1], d[i + 2], d[i + 3]); if (mx - mn > 7) c += 1.2; }
    // the join with the line before
    if (P.prevEnd != null && Math.abs(d[0] - P.prevEnd) > 4) c += W.join * (Math.abs(d[0] - P.prevEnd) - 4);
    // A and B: a new letter must be new; the tune should remember itself
    var memo = 0;
    done.forEach(function (o) {
      if (o.letter !== P.letter) {
        var s = similarity(d, o.degs);
        if (s > 0.55) c += W.sameAsOther * (s - 0.55) * 4;
        if (sharedRun(d, o.degs) >= n - 2 && n >= 6) c += 3;
      }
      var run = sharedRun(d, o.degs);
      if (run >= 3) memo = Math.max(memo, Math.min(run, 5));
    });
    // a figure answered a step higher or lower inside the line: a sequence
    for (i = 0; i + 5 < n; i++) for (var j = i + 3; j + 2 < n; j++) {
      if (d[j] - d[i] !== 0 && Math.abs(d[j] - d[i]) <= 2 && d[j + 1] - d[j] === d[i + 1] - d[i] && d[j + 2] - d[j + 1] === d[i + 2] - d[i + 1] && Math.abs(d[i + 1] - d[i]) + Math.abs(d[i + 2] - d[i + 1]) > 0) { memo += 1.5 * P.sequence; i = n; break; }
    }
    c -= W.memory * memo;
    // a repair steers clear of the tune it echoed
    if (P.avoid && P.avoid.length) {
      var withTail = (P.prevTail || []).concat(d).concat(P.selfNext ? d.slice(0, 6) : []);
      for (i = 0; i < P.avoid.length; i++) { var cl = closeness(withTail, P.avoid[i]); if (cl.quote) c += 8; else if (cl.run >= 5) c += cl.run - 4; }
    }
    if (P.partner) c += partnerCost(d, P, mode);
    // the day's gesture, heard in the tune's opening line
    if (gesture && gesture.length > 2) {
      var gi = intervals(gesture), m2 = Math.min(gi.length, iv.length, 6), match = 0;
      for (i = 0; i < m2; i++) if (Math.sign(gi[i]) === Math.sign(iv[i])) match += Math.abs(gi[i] - iv[i]) <= 1 ? 1 : 0.5;
      c -= W.gesture * match / Math.max(1, m2);
    }
    return c;
  }

  // one line's melody: the fixed notes first (the head a varied line keeps,
  // the peak, the ending), then the search between them
  //   P = { notes (the rhythm), fixed: [deg|null], lo, hi, curve, start,
  //         leapTarget, letter, prevEnd, doDeg, major, sequence }
  function searchLine(P, W, mode, classes, done, gesture, R, tries) {
    var n = P.notes.length;
    // the compass, precomputed: which degrees the tune may stand on, and their semitones
    var OK = {}, SM = {};
    for (var q0 = P.lo - 8; q0 <= P.hi + 8; q0++) { OK[q0] = q0 >= P.lo && q0 <= P.hi && classes.indexOf(cls(q0)) >= 0; SM[q0] = semi(mode, q0, 0); }
    var allowed = function (d) { return OK[d] === true; };
    var la = W.leapAppetite * (0.6 + P.leapTarget * 2.2);
    var STEPW = { 0: W.repeatW, 1: 3.0, 2: 1.25 * la, 3: 0.55 * la, 4: 0.3 * la, 5: 0.1 * la, 7: 0.05 * la * W.octaveW };
    var best = null, bestC = 1e9, ranked = [];
    // a candidate from the day's gesture: its shape laid onto the rhythm
    function fromGesture() {
      if (!gesture || gesture.length < 2) return null;
      var d = [], off = P.start - gesture[0];
      for (var i = 0; i < n; i++) d.push(P.fixed[i] != null ? P.fixed[i] : (i < gesture.length ? gesture[i] + off : null));
      return d;
    }
    var G = fromGesture();
    for (var c = 0; c < tries; c++) {
      var d = [], ok = true;
      for (var i = 0; i < n; i++) {
        // every die thrown for every note, used or not (SCORE §3)
        var die = u01(R);
        if (P.fixed[i] != null) { d.push(P.fixed[i]); continue; }
        if (i === 0) { d.push(P.start); continue; }
        if (G && c % 6 === 0 && G[i] != null && allowed(G[i])) { d.push(G[i]); continue; }
        var prev = d[i - 1], pprev = i > 1 ? d[i - 2] : null;
        // the next fixed note must stay within reach
        var j = i + 1; while (j < n && P.fixed[j] == null) j++;
        var target = j < n ? P.fixed[j] : null;
        var pool = [], tot = 0;
        for (var cand = P.lo; cand <= P.hi; cand++) {
          if (!allowed(cand)) continue;
          var iv = cand - prev, a = Math.abs(iv), w = STEPW[a];
          if (!w) continue;
          if (P.notes[i].cont && (a === 0 || a > 2)) continue;           // a slur moves, by step or third
          if (a === 0 && pprev != null && pprev === prev) continue;
          if (Math.abs(SM[prev] - SM[cand]) === 6) continue;
          if (target != null && Math.abs(cand - target) > 2 * (j - i) + (j - i === 1 ? 2 : 0)) continue;
          if (target != null && j - i === 1 && Math.abs(cand - target) > 4) continue;
          w *= Math.exp(-Math.abs(cand - P.curve[i]) * W.pull);
          if (pprev != null && Math.abs(prev - pprev) >= 3) w *= (iv !== 0 && (iv > 0) !== (prev - pprev > 0) && a <= 2) ? 3 : 0.25;
          if (P.major && cls(prev - P.doDeg) === 6 && iv === 1) w *= 2.5;
          if (target != null && j - i <= 2) w *= Math.exp(-Math.abs(cand - target) * 0.35);
          if (P.partner) {                                                 // (a partner: the first hymn's chord and tune)
            var pcs = P.partner.classesAt(P.notes[i].beat), phm = P.partner.melAt(P.notes[i].beat), pst = !!P.notes[i].stress;
            if (pcs && !pcs[cls(cand)] && (pst || P.notes[i].beats > 1 + EPS || Math.abs(cand - prev) !== 1)) continue;   // (on the beat, or held, or leapt to: the chord's own note)
            if (pcs && !pcs[cls(cand)]) w *= 0.25;
            if (phm != null) { var pic = Math.abs(SM[cand] - phm) % 12; if (pic === 1 || pic === 2 || pic === 10 || pic === 11 || pic === 6) w *= pst ? 0.01 : 0.3; if (pic === 0) w *= 0.5; }
          }
          pool.push([cand, w]); tot += w;
        }
        if (!pool.length) {                                              // step toward where the line must go
          var toward = target != null ? target : P.curve[i];
          var st = prev + (toward > prev ? 1 : toward < prev ? -1 : 1);
          while (!allowed(st) && st < P.hi) st++;
          if (!allowed(st)) { ok = false; st = prev; }
          d.push(st); continue;
        }
        var x = die * tot, pick = pool[pool.length - 1][0];
        for (var q = 0; q < pool.length; q++) { x -= pool[q][1]; if (x <= 0) { pick = pool[q][0]; break; } }
        d.push(pick);
      }
      var cost = lineCost(d, P, W, mode, done, gesture) + (ok ? 0 : 20);
      ranked.push({ d: d, c: cost });
      if (cost < bestC) { bestC = cost; best = d; }
    }
    ranked.sort(function (a, b) { return a.c - b.c; });
    // how different the best few were: the search's own spread
    var top = ranked.slice(0, 8), diff = 0, pairs = 0;
    for (var a1 = 0; a1 < top.length; a1++) for (var b1 = a1 + 1; b1 < top.length; b1++) {
      pairs++; for (var k = 0; k < n; k++) if (top[a1].d[k] !== top[b1].d[k]) diff++;
    }
    return { degs: best, cost: bestC, topSpread: pairs ? r3(diff / pairs) : 0, tries: tries };
  }

  // the whole tune, line by line: a letter sung again is copied, a primed
  // letter keeps its head and turns elsewhere, a new letter is searched
  function composeMelody(fr, sk, rh, D, H, gesture, repairRound, only, avoid) {
    var mode = fr.mode, classes = sk.classes, done = [], out = [];
    var W = D.weights, doDeg = sk.base + DO_OF[mode], major = !MINOR[mode] && mode !== "mixolydian";
    var tries = D.search + (repairRound ? 80 : 0);
    var leapTarget = clamp((H ? H.leap : D.leap) * (D.leapScale || 1), 0.05, 0.7);
    // (round 3, second pass: dialect E's kinds walk by their own measure — a
    // Shaker hymn most of all, SIMPLE GIFTS leaping one step in seven; the
    // unison songs had leapt one in three, whatever the hymnist's habit)
    if (fr.kind && D.kindLeap && D.kindLeap[fr.kind] != null) {
      leapTarget = clamp(leapTarget * D.kindLeap[fr.kind], 0.05, 0.7);
      if (D.kindWeights && D.kindWeights[fr.kind]) { var W2 = {}; for (var wk in W) W2[wk] = W[wk]; for (wk in D.kindWeights[fr.kind]) W2[wk] = D.kindWeights[fr.kind][wk]; W = W2; }
    }
    sk.lines.forEach(function (L, i) {
      var lay = rh[i], notes = lay.notes, n = notes.length;
      var R = L.die.fork(repairRound ? "repair:" + repairRound : "melody");
      var PT = sk.partner ? sk.partner[i] || null : null;                  // (a partner's first hymn, this line)
      var prevEnd = done.length ? done[done.length - 1].degs[done[done.length - 1].degs.length - 1] : null;
      var first = null;
      for (var q = 0; q < done.length; q++) if (done[q].letter === L.letter) { first = done[q]; break; }
      if (only && only.indexOf(i) < 0 && out[i] == null && sk._prev && sk._prev[i]) {
        // a repair that leaves this line alone
        var keep = sk._prev[i];
        done.push(keep); out.push(keep); return;
      }
      // (a last line that repeats an earlier letter keeps its head and comes home)
      if (first && !L.prime && first.n === n && first.syl === L.syl && !(L.role === "home" && first.role !== "home")) {
        L.cadence = first.cadence; L.full = first.full; L.targetClass = first.targetClass; L.figure = first.figure; L.figSteps = first.figSteps.slice(); L.plan = first.plan;
        if (first.bare != null) L.bare = first.bare;
        L.copyOf = first.i;
        var cp = { i: i, letter: L.letter, role: first.role, plan: first.plan, full: first.full, bare: first.bare, degs: first.degs.slice(), n: n, syl: L.syl, cadence: L.cadence, targetClass: L.targetClass, figure: L.figure, figSteps: L.figSteps, cost: first.cost, topSpread: 0, copied: true };
        done.push(cp); out.push(cp); return;
      }
      var lo = sk.floor, hi = sk.peak - 1;
      // the target, in the octave the contour leans to (home is the final itself)
      var target;
      if (L.role === "home") target = sk.base;
      else {
        var opts2 = [];
        for (var t = lo; t <= hi; t++) if (cls(t - sk.base) === cls(L.targetClass)) opts2.push(t);
        var pref = sk.base + (L.contour === "climb" ? 5 : L.contour === "descent" ? 1 : 3);
        target = opts2.length ? pickW(L.die.fork("target"), opts2.map(function (t2) { return [t2, Math.exp(-Math.abs(t2 - pref) / 2)]; })) : sk.base;
      }
      // the long note is the cadence note; a feminine ending's syllables follow it
      var longIdx = n - 1;
      while (longIdx > 0 && !notes[longIdx].stress) longIdx--;
      var fixed = []; for (var k = 0; k < n; k++) fixed.push(null);
      // the ending figure stands on the last syllables (a slur between them is
      // left to the search, as a passing note)
      var onsets = [];
      for (k = 0; k <= longIdx; k++) if (!notes[k].cont) onsets.push(k);
      var fits = function (st) {
        return st.every(function (s2) { return target + s2 >= lo && target + s2 <= hi && classes.indexOf(cls(target + s2)) >= 0; }) && onsets.length - st.length >= 1 &&
               !tritoneIn(mode, st.map(function (s2) { return target + s2; }));
      };
      var steps = L.figSteps;
      // (round 3's dialects: a tune that keeps echoing an Earth tune through
      // two repairs draws its lines' endings again — the ending is one of the
      // fixed notes a search cannot move)
      if (D.figureRepair && repairRound >= 2 && avoid && avoid.length && L.figPool) {
        var again = L.figPool.filter(function (fw) { return fits(FIGURES[fw[0]]) && (!D.figureFits || D.figureFits(L.cadence, L.targetClass, FIGURES[fw[0]], mode, L.plan)); });
        if (again.length) { L.figure = pickW(L.die.fork("figure:repair:" + repairRound), again); steps = FIGURES[L.figure].slice(); L.figSteps = steps; }
      }
      if (!fits(steps)) {
        // the drawn figure does not fit here: another, DRAWN again from the
        // same table among the ones that do (never simply the heaviest — that
        // is how every hymn came to end re–do)
        var alt = (L.figPool || []).filter(function (fw) {
          return fw[0] !== L.figure && fits(FIGURES[fw[0]]) && (!D.figureFits || D.figureFits(L.cadence, L.targetClass, FIGURES[fw[0]], mode, L.plan));
        });
        L.figure = alt.length ? pickW(L.die.fork("figure:refit"), alt) : "fall"; steps = FIGURES[L.figure].slice(); L.figSteps = steps;
      }
      // the fixed notes: the ending figure on the last syllables (a slur
      // between them is left to the search, as a passing note), a feminine
      // ending's syllables after the long note, and a varied line's head (a
      // late repair lets the head go, when it is what echoes another tune)
      var figStart, headN, trailW = [];
      var trailDie = L.die.fork("trail");
      for (k = longIdx + 1; k < n; k++) trailW.push(pickW(trailDie, [[0, 3], [-1, 1]]));
      var lay = function (st) {
        for (var k1 = 0; k1 < n; k1++) fixed[k1] = null;
        figStart = onsets[onsets.length - st.length];
        for (k1 = 0; k1 < st.length; k1++) fixed[onsets[onsets.length - st.length + k1]] = target + st[k1];
        for (k1 = longIdx + 1; k1 < n; k1++) {
          var tv = fixed[k1 - 1] + trailW[k1 - longIdx - 1];
          fixed[k1] = tv >= lo && tv <= hi && classes.indexOf(cls(tv)) >= 0 ? tv : fixed[k1 - 1];
        }
        headN = 0;
        // (round 3's dialects: from the second repair a varied line lets its head go whatever failed — a head
        // and a peak side by side can leave a seventh no search can mend)
        if (first && !(repairRound >= 2 && ((avoid && avoid.length) || D.figureRepair))) {
          headN = Math.max(2, Math.floor(Math.min(n, first.n) * 0.45));
          for (k1 = 0; k1 < headN && k1 < figStart; k1++) fixed[k1] = first.degs[k1];
          // (a head that runs straight into the ending would leave the singers a
          // tritone or a seventh between two fixed notes: it lets go of its last)
          while (headN > 1 && headN <= figStart && fixed[headN] != null && fixed[headN - 1] != null && !singable(fixed[headN - 1], fixed[headN])) { headN--; fixed[headN] = null; }
        }
      };
      var singable = function (a, b) { var st = Math.abs(a - b); return st !== 6 && st <= 7 && semiDiff(mode, a, b) % 12 !== 6; };
      lay(steps);
      // the peak, on a strong syllable a third to three quarters in
      var peakIdx = -1;
      if (L.peak) {
        // on a strong syllable, inside the planned 60–75 % of the tune (give
        // or take one syllable), and never where a note already fixed beside
        // it would make the singers leap a sixth or more, or a tritone, to or
        // from the high note: the search cannot mend a leap between two fixed
        // notes (the round-2 critic found sung sevenths there)
        var tot1 = Math.max(1, sk.totalSyl - 1), grace = 1 / tot1;
        var posOf = function (k2) { return (sk.sylBefore[i] + notes[k2].syl) / tot1; };
        var inBand = function (k2) { var g2 = posOf(k2); return g2 >= 0.6 - grace - EPS && g2 <= 0.75 + grace + EPS; };
        var leapOk = function (a, b) { return Math.abs(a - b) <= 4 && semiDiff(mode, a, b) !== 6; };
        var nearOk = function (k2) {
          for (var s2 = -1; s2 <= 1; s2 += 2) {
            var j2 = k2 + s2;
            if (j2 < 0 || j2 >= n) continue;
            if (fixed[j2] != null && !leapOk(sk.peak, fixed[j2])) return false;
            // one free note between the peak and a fixed one: the two leaps must be bridgeable
            if (fixed[j2] == null && j2 + s2 >= 0 && j2 + s2 < n && fixed[j2 + s2] != null && Math.abs(sk.peak - fixed[j2 + s2]) > 5) return false;
          }
          return true;
        };
        var cands, clear, both;
        var gather = function () {
          cands = [];
          for (var k2 = 1; k2 < figStart; k2++) if (fixed[k2] == null && !notes[k2].cont) {
            if (PT && notes[k2].stress && (function () { var cs = PT.classesAt(notes[k2].beat); return cs && !cs[cls(sk.peak)]; })()) continue;   // (a partner's peak stands on the first hymn's chord)
            var wg = Math.exp(-Math.pow((posOf(k2) - sk.wantAt) / 0.05, 2)) + 0.02;
            cands.push([k2, wg * (notes[k2].stress ? 1 + notes[k2].beats : 0.25)]);
          }
          clear = cands.filter(function (c2) { return nearOk(c2[0]); });
          both = clear.filter(function (c2) { return inBand(c2[0]); });
          // (a varied line's head is memory; the peak is the tune's moment:
          // when the head leaves the high note no singable place in the band,
          // the head lets go of its last notes, one at a time, down to two)
          while (!both.length && headN > 2) {
            headN--; if (headN < figStart) fixed[headN] = null;
            cands = cands.concat(headN < figStart && !notes[headN].cont ? [[headN, (Math.exp(-Math.pow((posOf(headN) - sk.wantAt) / 0.05, 2)) + 0.02) * (notes[headN].stress ? 1 + notes[headN].beats : 0.25)]] : []);
            clear = cands.filter(function (c2) { return nearOk(c2[0]); });
            both = clear.filter(function (c2) { return inBand(c2[0]); });
          }
        };
        gather();
        // THE PEAK LINE'S ENDING MAY BE DRAWN AGAIN. When the drawn figure
        // leaves the high note no singable place inside the band (a low
        // ending, a short line), the other endings the cadence allows are
        // tried in a drawn order, and the first that makes room is kept: the
        // peak is the plan's promise, the figure one of several good closes.
        if (!both.length && L.figPool) {
          var others = L.figPool.filter(function (fw) {
            return fw[0] !== L.figure && fits(FIGURES[fw[0]]) && (!D.figureFits || D.figureFits(L.cadence, L.targetClass, FIGURES[fw[0]], mode, L.plan));
          }), order = [], od = L.die.fork("figure:peak");
          while (others.length) { var pk2 = pickW(od, others); order.push(pk2); others = others.filter(function (fw) { return fw[0] !== pk2; }); }
          for (var oi = 0; oi < order.length && !both.length; oi++) {
            lay(FIGURES[order[oi]]); gather();
            if (both.length) { L.figure = order[oi]; steps = FIGURES[L.figure].slice(); L.figSteps = steps; }
          }
          if (!both.length) { lay(steps); gather(); }
        }
        // the best of what the line offers: in the band and clear of its neighbours;
        // else clear of its neighbours; else in the band; else anything
        var inb = cands.filter(function (c2) { return inBand(c2[0]); });
        cands = both.length ? both : clear.length ? clear : inb.length ? inb : cands;
        if (!cands.length) for (k = 1; k < longIdx; k++) if (fixed[k] == null && nearOk(k)) cands.push([k, 1]);
        if (!cands.length) for (k = 1; k < longIdx; k++) if (fixed[k] == null) cands.push([k, 1]);
        // (a short varied line whose head and ending leave no room: the peak displaces the head)
        if (!cands.length) for (k = 1; k < figStart; k++) if (!notes[k].cont) cands.push([k, 1 + (notes[k].stress ? 1 : 0)]);
        peakIdx = cands.length ? pickW(L.die.fork(repairRound ? "peakAt:repair:" + repairRound : "peakAt"), cands) : -1;
        if (peakIdx >= 0) fixed[peakIdx] = sk.peak;
      }
      // the first note: home's chord to open the hymn, near the last line's end after
      var start;
      if (fixed[0] != null) start = fixed[0];
      else {
        var sPool = [];
        for (var s = lo; s <= hi; s++) {
          if (classes.indexOf(cls(s)) < 0) continue;
          var rel = cls(s - sk.base), w = rel === 0 ? 3 : rel === 4 ? 2.2 : rel === 2 ? 1.8 : 0.5;
          if (prevEnd == null) {
            // the hymn opens on the chord of home: do, mi, sol (or sol below, as a pickup)
            if (rel !== 0 && rel !== 2 && rel !== 4) w *= 0.04;
            w *= Math.exp(-Math.abs(s - (sk.base + (notes[0].stress ? 1 : -1))) / 2.5);
            if (!notes[0].stress && s - sk.base === -3) w *= 2.5;
          }
          else { var dj = Math.abs(s - prevEnd); w *= dj <= 2 ? 2 : dj <= 4 ? 1 : 0.15; }
          // (and within a singable leap of a note already fixed after it — the peak, a head)
          if (n > 1 && fixed[1] != null && (Math.abs(s - fixed[1]) > 4 || semiDiff(mode, s, fixed[1]) === 6)) w *= 0.01;
          if (PT) { var cs0 = PT.classesAt(notes[0].beat), hm0 = PT.melAt(notes[0].beat); if (cs0 && !cs0[cls(s)]) w *= 0.02; if (hm0 != null) { var i0 = Math.abs(semi(mode, s, 0) - hm0) % 12; if (i0 === 1 || i0 === 2 || i0 === 10 || i0 === 11 || i0 === 6) w *= 0.01; } }
          sPool.push([s, w]);
        }
        start = pickW(repairRound ? L.startDie.fork("repair:" + repairRound) : L.startDie, sPool);
        fixed[0] = start;
      }
      var apex = L.peak ? sk.peak : Math.min(hi, Math.max(start, target) + 2 + Math.floor(u01(L.die.fork("apex")) * 2.5));
      var apexPos = L.peak && peakIdx > 0 ? peakIdx / (n - 1) : 0.45;
      var P = { notes: notes, fixed: fixed, lo: lo, hi: hi, start: start, letter: L.letter, prevEnd: prevEnd, doDeg: doDeg, home: sk.base, major: major,
                curve: contourCurve(L.contour, n, start, target, apex, apexPos, lo), leapTarget: leapTarget, sequence: H ? H.sequence : 0.3,
                avoid: (avoid || []).map(function (a) { return a.map(function (x) { return x + sk.base; }); }),
                // (round 3's dialects: a line sung again straight after itself — AABA — is heard across its own join)
                selfNext: !!(D.figureRepair && sk.lines[i + 1] && sk.lines[i + 1].letter === L.letter && !sk.lines[i + 1].prime),
                partner: sk.partner ? sk.partner[i] || null : null,
                prevTail: done.length ? done[done.length - 1].degs.slice(-5) : [] };
      var res = searchLine(P, W, mode, classes, done, i === 0 ? gesture : null, R, tries);
      var rec = { i: i, letter: L.letter, role: L.role, plan: L.plan, full: L.full, bare: L.bare, degs: res.degs, n: n, syl: L.syl, cadence: L.cadence, targetClass: L.targetClass, figure: L.figure,
                  figSteps: L.figSteps.slice(), target: target, peakIdx: peakIdx, headN: headN, cost: r3(res.cost), topSpread: res.topSpread };
      done.push(rec); out.push(rec);
    });
    return out;
  }

  // ==========================================================================
  // 4b. THE SLURRED PASSING NOTE (round 3; the critic's idiom note: the
  // colony's Tabernacle tunes slurred 6 % of their notes, the Psalmody's 13 %)
  // ==========================================================================
  // After the search, where the tune leaps a third from a note long enough to
  // share, the singers may walk it: the note's second half becomes the step
  // between, on the same syllable — Careless's and Beesley's "the Lord" on two
  // notes. Each place throws its own die (the line's `slur:<k>`), so a tune
  // the dice leave alone is exactly the tune it was; the notes it keeps are
  // the notes the search chose, and a line sung again is slurred as it was
  // the first time.
  function slurPassing(fr, sk, rh, mel, D, H) {
    if (!D.melismaAdd) return { rh: rh, mel: mel, added: 0 };
    var T = TIMES[fr.time], unit = T.den === 8 ? 1 : 0.5, classes = sk.classes, added = 0;
    var rate = D.melismaAdd * (0.6 + 0.8 * (H && H.melisma != null ? H.melisma : 0.35));
    var byLine = [], rh2 = [], mel2 = [];
    sk.lines.forEach(function (L, i) {
      var lay = rh[i], m = mel[i], cp = L.copyOf;
      var src = cp != null && byLine[cp] && rh[cp].notes.length === lay.notes.length && mel[cp].degs.join() === m.degs.join() ? cp : i;
      var longIdx = lay.notes.length - 1; while (longIdx > 0 && !lay.notes[longIdx].stress) longIdx--;
      var at = src === i ? [] : byLine[src];
      if (src === i) for (var k = 0; k + 1 < lay.notes.length; k++) {
        var a = lay.notes[k], b = lay.notes[k + 1], da = m.degs[k], db = m.degs[k + 1];
        if (a.cont || b.cont || k >= longIdx - 1 || Math.abs(db - da) !== 2) continue;
        var half = a.beats / 2;
        if (half < unit - EPS || Math.abs(half / unit - Math.round(half / unit)) > EPS || a.beats > 2 * T.bin + EPS) continue;
        var mid = (da + db) / 2;
        if (classes.indexOf(cls(mid)) < 0) continue;
        if (u01(L.die.fork("slur:" + k)) < rate) at.push(k);
      }
      byLine[i] = at;
      if (!at.length) { rh2.push(lay); mel2.push(m); return; }
      var notes = [], degs = [], shift = 0, peakIdx = m.peakIdx;
      lay.notes.forEach(function (n, k2) {
        if (at.indexOf(k2) < 0) { notes.push(n); degs.push(m.degs[k2]); return; }
        var h = n.beats / 2;
        notes.push({ beat: n.beat, beats: h, syl: n.syl, stress: n.stress, cont: false });
        notes.push({ beat: n.beat + h, beats: h, syl: n.syl, stress: 0, cont: true });
        degs.push(m.degs[k2]); degs.push((m.degs[k2] + m.degs[k2 + 1]) / 2);
        if (peakIdx != null && peakIdx > k2) shift++;
        added++;
      });
      var lay2 = {}; for (var q in lay) lay2[q] = lay[q]; lay2.notes = notes;
      var m2 = {}; for (q in m) m2[q] = m[q]; m2.degs = degs; if (peakIdx != null && peakIdx >= 0) m2.peakIdx = peakIdx + shift;
      rh2.push(lay2); mel2.push(m2);
    });
    return { rh: rh2, mel: mel2, added: added };
  }

  // ==========================================================================
  // THE TUNING — every note an exact ratio (SCORE §2), leaning a comma
  // where the chord it sounds in needs it
  // ==========================================================================
  // A fixed table of degrees cannot tune every chord: the ii chord's re is a
  // comma too sharp for a pure fifth under la, the minor v's third a comma
  // flat. So each chord finds its root among three (the spelled degree, a
  // syntonic comma up, a comma down), stacks just intervals on it, and takes
  // the root whose chord moves the fewest of its notes off their spelling —
  // never more than a comma (the spelling still holds). A note that is no
  // chord tone keeps its spelled pitch. A melody alone (the Old Way) is
  // tuned by its own leaps: a fourth or a fifth is sung pure.
  function tuneChordTones(mode, tones) {
    // tones: [[class, alt], …] root first → { byClass: {class: {m, dev}}, moved }
    var root = tones[0], rootSp = spelledMonzo(mode, root[0], root[1]), best = null;
    [0, 1, -1].forEach(function (k) {
      var r = k === 0 ? rootSp : k > 0 ? mz(rootSp, COMMA) : mz(rootSp, mzNeg(COMMA));
      var by = {}, cost = Math.abs(k) * 0.6, ok = true;
      tones.forEach(function (t, i) {
        var sp = spelledMonzo(mode, t[0], t[1]);
        var iv = ((semi(mode, t[0], t[1]) - semi(mode, root[0], root[1])) % 12 + 12) % 12;
        var m = i === 0 ? r : mz(r, JUST[iv]);
        // the octave nearest the spelling
        var dc = mzCents(m) - mzCents(sp), o = Math.round(dc / 1200);
        m = mz(m, [-o, 0, 0, 0]);
        var dev = Math.round((mzCents(m) - mzCents(sp)) / 21.506);
        if (Math.abs(dev) > 1) ok = false;
        cost += Math.abs(dev);
        by[t[0] + ":" + t[1]] = { m: m, dev: dev };
      });
      if (ok && (!best || cost < best.cost - EPS)) best = { byClass: by, cost: cost };
    });
    return best;
  }
  function tuneNote(mode, n, chordTuning) {
    var key = cls(n.deg) + ":" + (n.alt || 0), sp = spelledMonzo(mode, n.deg, n.alt || 0);
    var t = chordTuning && chordTuning.byClass[key];
    if (!t || n.nct) return { monzo: sp, comma: 0 };
    var o = octOf(n.deg);
    var base = t.m, m = [base[0] + o, base[1], base[2], base[3]];
    // (the tone was placed near its spelling in the octave of degree 0–6)
    var dc = mzCents(m) - mzCents(sp), fix = Math.round(dc / 1200);
    m = mz(m, [-fix, 0, 0, 0]);
    return { monzo: m, comma: t.dev, sept: !!t.sept };
  }
  // THE RINGING SEVENTH (dialect D; kolob-pitch.js's 7-limit helpers): a
  // dominant seventh sung justly is 4:5:6:7 — root, 5/4, 3/2 and 7/4, the
  // seventh partial, which sits a septimal comma (64/63) under the
  // Pythagorean seventh and 36/35 under the 5-limit one; that is what makes
  // the chord bloom. The root finds its place as a triad's does (its
  // spelling, or a syntonic comma either side, whichever moves the root,
  // third and fifth least); the seventh is 7/4 above it, exactly, and wears
  // Johnston's "7".
  var SEPT_IV = [[0, 0, 0, 0], [-2, 0, 1, 0], [-1, 1, 0, 0], [-2, 0, 0, 1]];   // 1/1 5/4 3/2 7/4
  function tuneChordTones7(mode, tones) {
    var root = tones[0], rootSp = spelledMonzo(mode, root[0], root[1]), best = null;
    [0, 1, -1].forEach(function (k) {
      var r = k === 0 ? rootSp : k > 0 ? mz(rootSp, COMMA) : mz(rootSp, mzNeg(COMMA));
      var by = {}, cost = Math.abs(k) * 0.6, ok = true;
      tones.forEach(function (t, i) {
        var sp = spelledMonzo(mode, t[0], t[1]);
        var m = mz(r, SEPT_IV[Math.min(i, 3)]);
        var dc = mzCents(m) - mzCents(sp), o = Math.round(dc / 1200);
        m = mz(m, [-o, 0, 0, 0]);
        var off = mzCents(m) - mzCents(sp);
        if (i < 3) { var dev = Math.round(off / 21.506); if (Math.abs(dev) > 1) ok = false; cost += Math.abs(dev); by[t[0] + ":" + t[1]] = { m: m, dev: dev }; }
        else by[t[0] + ":" + t[1]] = { m: m, dev: 0, sept: true };
      });
      if (ok && (!best || cost < best.cost - EPS)) best = { byClass: by, cost: cost, ring: true };
    });
    return best;
  }
  // EVERY TUNING A CHORD MAY TAKE (dialect D): its spelled root, or a
  // syntonic comma either side, so long as each tone stays within a comma
  // of its spelling — the ringing seventh 4:5:6:7; and a minor seventh chord
  // sung as its own harmonics, 10:12:15:18 (the seventh 9/5), so that ii7 may
  // stand on the grave re, 10/9, with fa, la and do where the scale has them.
  // (The first three dialects keep tuneChordTones' one best tuning.)
  var MIN7_IV = [0, 2, -1, 0];                                              // 9/5
  // how far a pitch stands from its spelling, in cents, as the proofreader
  // reads it: a septimal note through Johnston's 7 (each 7 in its monzo is a
  // 36/35 below the note it marks)
  var JOHNSTON7 = mzCents([2, 2, -1, -1]);
  function offSpelling(m, sp) { return mzCents(m) - mzCents(sp) + JOHNSTON7 * (m[3] || 0); }
  function chordTunings(mode, tones, seven, min7) {
    var root = tones[0], rootSp = spelledMonzo(mode, root[0], root[1]), out = [];
    [0, 1, -1].forEach(function (k, ki) {
      var r = k === 0 ? rootSp : k > 0 ? mz(rootSp, COMMA) : mz(rootSp, mzNeg(COMMA));
      var by = {}, cost = Math.abs(k) * 0.6 + ki * 1e-4, ok = true;        // (a tie keeps the spelling, then a comma up, as tuneChordTones does)
      tones.forEach(function (t, i) {
        var sp = spelledMonzo(mode, t[0], t[1]), st = ((semi(mode, t[0], t[1]) - semi(mode, root[0], root[1])) % 12 + 12) % 12;
        var iv = seven ? SEPT_IV[Math.min(i, 3)] : min7 && st === 10 ? MIN7_IV : JUST[st];
        var m = i === 0 ? r : mz(r, iv), dc = mzCents(m) - mzCents(sp), o = Math.round(dc / 1200);
        m = mz(m, [-o, 0, 0, 0]);
        // (the seventh partial: spelled on its degree with Johnston's 7, and
        // within a syntonic comma of that spelling — so V7 and II7 never stand
        // a comma high, where the seventh would read two commas sharp)
        if (seven && i === 3) { if (Math.abs(offSpelling(m, sp)) > 23) ok = false; by[t[0] + ":" + t[1]] = { m: m, dev: 0, sept: true }; return; }
        var dev = Math.round((mzCents(m) - mzCents(sp)) / 21.506);
        if (Math.abs(dev) > 1) ok = false;
        cost += Math.abs(dev);
        by[t[0] + ":" + t[1]] = { m: m, dev: dev };
      });
      if (ok) out.push({ byClass: by, cost: cost, k: k, ring: !!seven });
    });
    return out;
  }
  // (dialect D) THE LINE'S TUNINGS CHOSEN TOGETHER. Each chord could take
  // the tuning that moves the fewest of its own notes off their spelling —
  // and round 3's critic heard what that costs: a voice singing the same
  // written note again into the next chord slid a comma, 189 times in forty
  // hymns, 42 of them a quarter-tone (fa from ii7 on 9/8, 27/20, down to the
  // ringing seventh of V7, 21/16; sol from I down to VI7's seventh on 5/3,
  // 35/24). A barbershop quartet tunes the chord to the note it already has.
  // So the line's chords choose their roots together, by a small search: each
  // tuning's own cost (its notes off their spelling), and at every change of
  // chord a cost for every note a voice strikes again that does not stay put
  // (squared, and a quarter-tone surcharged, so one 49-cent slide costs far
  // more than two commas shared; the lead's, the tune's own, three times
  // over), and for a bass
  // that moves by an impure fourth or fifth. The
  // chain then stands on pure fifths — VI7 on 27/16, II7 on 9/8, V7 on 3/2 —
  // and a prepared seventh falls by the septimal comma, 27 c, at most.
  function chooseTunings(mode, parts, order, lead) {
    var cands = order.map(function (ch) {
      var seven = !!(ch.ring && ch.tones && ch.tones.length === 4), c = ch.tones ? chordTunings(mode, ch.tones, seven, ch.quality === "min7") : [];
      return c.length ? c : [{ byClass: null, cost: 0, k: 0 }];
    });
    function chordOf(b) { var ci = -1; for (var i = 0; i < order.length; i++) if (order[i].beat <= b + EPS) ci = i; return ci; }
    // the joins each change of chord makes: a voice's note struck again, and the bass's step
    var joins = order.map(function () { return []; }), bass = order.map(function () { return null; });
    for (var p in parts) {
      var ns = parts[p];
      for (var k = 1; k < ns.length; k++) {
        var a = ns[k - 1], b = ns[k];
        if (a.nct || b.nct || Math.abs(a.beat + a.beats - b.beat) > EPS) continue;
        var ci = chordOf(b.beat);
        if (ci < 1 || chordOf(a.beat) !== ci - 1) continue;
        if (a.deg === b.deg && (a.alt || 0) === (b.alt || 0)) joins[ci].push([a, b, p === lead ? 3 : 1]);
        if (p === "B") bass[ci] = [a, b];
      }
    }
    function pitch(n, c) { return mzCents(tuneNote(mode, n, c.byClass ? c : null).monzo); }
    function step(ci, u, v) {
      var cu = cands[ci - 1][u], cv = cands[ci][v], c = 0;
      joins[ci].forEach(function (j) { var d = Math.abs(pitch(j[0], cu) - pitch(j[1], cv)) / 21.506; c += (d * d + (d > 1.5 ? 6 : 0)) * j[2]; });
      if (bass[ci]) {
        var iv = Math.abs(pitch(bass[ci][1], cv) - pitch(bass[ci][0], cu)) % 1200;
        if ((Math.abs(iv - 700) < 30 || Math.abs(iv - 500) < 30) && Math.abs(iv - 701.955) > 1 && Math.abs(iv - 498.045) > 1) c += 0.8;
      }
      return c;
    }
    var cost = [], back = [];
    order.forEach(function (ch, ci) {
      cost.push([]); back.push([]);
      cands[ci].forEach(function (cv, v) {
        if (ci === 0) { cost[0].push(cv.cost); back[0].push(-1); return; }
        var best = 1e18, arg = 0;
        cands[ci - 1].forEach(function (cu, u) { var x = cost[ci - 1][u] + step(ci, u, v); if (x < best - 1e-9) { best = x; arg = u; } });
        cost[ci].push(best + cv.cost); back[ci].push(arg);
      });
    });
    var pick = new Array(order.length);
    if (order.length) {
      var last = 0, L = cost[order.length - 1];
      for (var v2 = 1; v2 < L.length; v2++) if (L[v2] < L[last] - 1e-9) last = v2;
      for (var ci2 = order.length - 1; ci2 >= 0; ci2--) { pick[ci2] = cands[ci2][last]; last = back[ci2][last]; }
    }
    return pick.map(function (c) { return c && c.byClass ? c : null; });
  }
  // (dialect D) the chords in time order, each tuned as the line's search
  // chose — and to agree with any note HELD into it from the chord before (a
  // swipe's lead, a suspension), for a held note cannot move, and the chord
  // that turns under it must be tuned to it (the barbershop's rule: the lead
  // holds, the others find the ring)
  function tuneLinePartsHeld(mode, parts, chords, lead) {
    var order = chords.slice().sort(function (a, b) { return a.beat - b.beat; }), all = [];
    for (var p in parts) parts[p].forEach(function (n) { all.push(n); });
    var chosen = chooseTunings(mode, parts, order, lead);
    order.forEach(function (ch, ci) {
      var end = ci + 1 < order.length ? order[ci + 1].beat : 1e9;
      var held = all.filter(function (n) { return n.beat < ch.beat - EPS && n.beat + n.beats > ch.beat + EPS && n.monzo && !n.nct; });
      var seven = ch.ring && ch.tones && ch.tones.length === 4;
      var tt0 = chosen[ci];
      // a note held into the chord fixes it: the root is found FROM the held
      // note (the lead holding do while the chord swipes to II7 makes do the
      // seventh partial, and re, fi and la are tuned to it — 8/7, a septimal
      // comma over the spelled 9/8)
      var hk = held.filter(function (n) { return ch.tones && ch.tones.some(function (t) { return t[0] === cls(n.deg) && t[1] === (n.alt || 0); }); });
      if (hk.length && tt0) {
        var n0 = hk[0], i0 = -1;
        ch.tones.forEach(function (t, i) { if (t[0] === cls(n0.deg) && t[1] === (n0.alt || 0)) i0 = i; });
        var agreesNow = hk.every(function (n) { var t = tt0.byClass[cls(n.deg) + ":" + (n.alt || 0)]; var d = mzCents(n.monzo) - mzCents(t.m); return Math.abs(d / 1200 - Math.round(d / 1200)) < 1e-6; });
        if (!agreesNow) {
          var rsp = spelledMonzo(mode, ch.tones[0][0], ch.tones[0][1]), rootIv = seven ? SEPT_IV[Math.min(i0, 3)] : JUST[((semi(mode, ch.tones[i0][0], ch.tones[i0][1]) - semi(mode, ch.tones[0][0], ch.tones[0][1])) % 12 + 12) % 12];
          var r0 = mz(n0.monzo, mzNeg(rootIv)), dr = mzCents(r0) - mzCents(rsp); r0 = mz(r0, [-Math.round(dr / 1200), 0, 0, 0]);
          var by = {};
          ch.tones.forEach(function (t, i) {
            var sp = spelledMonzo(mode, t[0], t[1]);
            var iv = seven ? SEPT_IV[Math.min(i, 3)] : JUST[((semi(mode, t[0], t[1]) - semi(mode, ch.tones[0][0], ch.tones[0][1])) % 12 + 12) % 12];
            var m = mz(r0, iv), dc = mzCents(m) - mzCents(sp); m = mz(m, [-Math.round(dc / 1200), 0, 0, 0]);
            by[t[0] + ":" + t[1]] = { m: m, dev: Math.round((mzCents(m) - mzCents(sp)) / 21.506), sept: !!(seven && i === 3) };
          });
          // (only while every tone stays within a syntonic comma of its
          // spelling — a septimal one read through Johnston's 7 — the
          // proofreader's own allowance)
          if (Object.keys(by).every(function (k2) { return Math.abs(offSpelling(by[k2].m, spelledMonzo(mode, +k2.split(":")[0], +k2.split(":")[1]))) < 23; })) tt0 = { byClass: by };
        }
      }
      all.forEach(function (n) {
        if (n.beat < ch.beat - EPS || n.beat >= end - EPS) return;
        var r = tuneNote(mode, n, tt0);
        n.monzo = r.monzo; n.comma = r.comma;
        if (r.sept || n.monzo[3]) {
          n.septimal = 1;
          var co = K.Pitch && K.Pitch.commaOf ? K.Pitch.commaOf(n.monzo, spelledMonzo(mode, n.deg, n.alt || 0)) : null;
          n.comma = co ? co.syntonic : 0;
        }
      });
    });
    // (a note before the first chord, if any: its spelling)
    all.forEach(function (n) { if (!n.monzo || (n.monzo.join() === "0,0,0,0" && n.deg !== 0)) { n.monzo = spelledMonzo(mode, n.deg, n.alt || 0); n.comma = 0; } });
    return 0;
  }
  function tuneLineParts(mode, parts, chords, ring, lead) {
    if (ring) return tuneLinePartsHeld(mode, parts, chords, lead);
    var wolves = 0;
    for (var p in parts) parts[p].forEach(function (n) {
      var ch = null;
      for (var i = chords.length - 1; i >= 0; i--) if (chords[i].beat <= n.beat + EPS) { ch = chords[i]; break; }
      var seven = ring && ch && ch.ring && ch.tones && ch.tones.length === 4;
      var tt = ch && ch.tones ? (ch._tuning || (ch._tuning = (seven && tuneChordTones7(mode, ch.tones)) || tuneChordTones(mode, ch.tones))) : null;
      var r = tuneNote(mode, n, tt);
      n.monzo = r.monzo; n.comma = r.comma;
      if (r.sept) {
        // (the comma a septimal note wears is read through Johnston's 7, as SCORE §2's commaOf reads it)
        n.septimal = 1;
        var co = K.Pitch && K.Pitch.commaOf ? K.Pitch.commaOf(n.monzo, spelledMonzo(mode, n.deg, n.alt || 0)) : null;
        n.comma = co ? co.syntonic : 0;
      }
    });
    chords.forEach(function (c) { delete c._tuning; });
    return wolves;
  }
  // a tune alone: each note may lean a comma so that its leaps of a fourth
  // or a fifth ring pure (do, sol and the final never move)
  function tuneMelodyAlone(mode, notes) {
    var n = notes.length, INF = 1e9, cost = [], back = [];
    var opts = [0, 1, -1];
    function m(i, k) { var sp = spelledMonzo(mode, notes[i].deg, 0); return k === 0 ? sp : k > 0 ? mz(sp, COMMA) : mz(sp, mzNeg(COMMA)); }
    function wolf(a, b) {
      var c = Math.abs(mzCents(b) - mzCents(a)) % 1200;
      return Math.abs(c - 498.045) > 5 && Math.abs(c - 498.045) < 30 || Math.abs(c - 701.955) > 5 && Math.abs(c - 701.955) < 30 ? 1 : 0;
    }
    for (var i = 0; i < n; i++) {
      cost.push([]); back.push([]);
      var fixedHere = cls(notes[i].deg - 0) === 0 || cls(notes[i].deg) === 4;
      for (var a = 0; a < 3; a++) {
        var k = opts[a];
        if (fixedHere && k !== 0) { cost[i].push(INF); back[i].push(0); continue; }
        var own = Math.abs(k) * 0.4;
        if (i === 0) { cost[i].push(own); back[i].push(-1); continue; }
        var best = INF, arg = 0;
        for (var b = 0; b < 3; b++) {
          if (cost[i - 1][b] >= INF) continue;
          var x = cost[i - 1][b] + wolf(m(i - 1, opts[b]), m(i, k)) * 3 + (notes[i].deg === notes[i - 1].deg && opts[b] !== k ? 5 : 0);
          if (x < best) { best = x; arg = b; }
        }
        cost[i].push(best + own); back[i].push(arg);
      }
    }
    var last = 0; for (a = 1; a < 3; a++) if (cost[n - 1][a] < cost[n - 1][last]) last = a;
    for (i = n - 1; i >= 0; i--) { notes[i].monzo = m(i, opts[last]); notes[i].comma = opts[last]; last = back[i][last]; if (last < 0) last = 0; }
  }

  // ==========================================================================
  // 7. A NAME AND A NUMBER — for the hymn board, in Deseret
  // ==========================================================================
  // Tunes are named for places (NEW BRITAIN, IDUMEA, DESERET): these are the
  // colony's places and the scriptures' — hand-transliterated, phonemic, the
  // 1859 chart (nameEn is the dev's crib, never rendered). A prefix or a
  // suffix now and then; never an Earth tune's name.
  var NAMES = [
    ["Bountiful", "𐐒𐐵𐑌𐐻𐐮𐑁𐐳𐑊"], ["Zarahemla", "𐐞𐐰𐑉𐐲𐐸𐐯𐑋𐑊𐐲"], ["Cumorah", "𐐗𐐲𐑋𐐫𐑉𐐲"], ["Nauvoo", "𐐤𐐫𐑂𐐭"],
    ["Manti", "𐐣𐐰𐑌𐐻𐐴"], ["Ensign", "𐐇𐑌𐑅𐐴𐑌"], ["Sego", "𐐝𐐨𐑀𐐬"], ["Kolob", "𐐗𐐬𐑊𐐱𐐺"], ["Meridian", "𐐣𐐲𐑉𐐮𐐼𐐨𐐲𐑌"],
    ["Daybreak", "𐐔𐐩𐐺𐑉𐐩𐐿"], ["Harvest", "𐐐𐐪𐑉𐑂𐐮𐑅𐐻"], ["Cottonwood", "𐐗𐐱𐐻𐐲𐑌𐐶𐐳𐐼"], ["Jubilee", "𐐖𐐭𐐺𐐮𐑊𐐨"],
    ["Evening", "𐐀𐑂𐑌𐐮𐑍"], ["Liberty", "𐐢𐐮𐐺𐐲𐑉𐐻𐐨"], ["Emigration", "𐐇𐑋𐐮𐑀𐑉𐐩𐑇𐐲𐑌"], ["Beehive", "𐐒𐐨𐐸𐐴𐑂"],
    ["Wasatch", "𐐎𐐫𐑅𐐰𐐽"], ["Moroni", "𐐣𐐲𐑉𐐬𐑌𐐴"], ["Bethel", "𐐒𐐯𐑃𐐲𐑊"], ["Shiloh", "𐐟𐐴𐑊𐐬"], ["Lehi", "𐐢𐐨𐐸𐐴"],
    ["Kirtland", "𐐗𐐲𐑉𐐻𐑊𐐲𐑌𐐼"], ["Palmyra", "𐐑𐐰𐑊𐑋𐐴𐑉𐐲"], ["Sabbath", "𐐝𐐰𐐺𐐲𐑃"], ["Orchard", "𐐃𐑉𐐽𐐲𐑉𐐼"],
    ["Lamplight", "𐐢𐐰𐑋𐐹𐑊𐐴𐐻"], ["Rimlight", "𐐡𐐮𐑋𐑊𐐴𐐻"], ["Handcart", "𐐐𐐰𐑌𐐼𐐿𐐪𐑉𐐻"], ["Far West", "𐐙𐐪𐑉 𐐎𐐯𐑅𐐻"],
    ["Morning Star", "𐐣𐐫𐑉𐑌𐐮𐑍 𐐝𐐻𐐪𐑉"], ["Far Water", "𐐙𐐪𐑉 𐐎𐐫𐐻𐐲𐑉"], ["Silver Creek", "𐐝𐐮𐑊𐑂𐐲𐑉 𐐗𐑉𐐨𐐿"],
    ["Winter Quarters", "𐐎𐐮𐑌𐐻𐐲𐑉 𐐗𐐶𐐫𐑉𐐻𐐲𐑉𐑆"], ["Dawn", "𐐔𐐫𐑌"], ["Garden Grove", "𐐘𐐪𐑉𐐼𐐲𐑌 𐐘𐑉𐐬𐑂"],
  ];
  var PREFIX = [["New", "𐐤𐑏"], ["Old", "𐐄𐑊𐐼"], ["Far", "𐐙𐐪𐑉"]];
  var SUFFIX = [["Hill", "𐐐𐐮𐑊"], ["Road", "𐐡𐐬𐐼"], ["Spring", "𐐝𐐹𐑉𐐮𐑍"], ["Light", "𐐢𐐴𐐻"], ["Crossing", "𐐗𐑉𐐫𐑅𐐮𐑍"]];
  function nameOf(R) {
    var base = NAMES[Math.floor(u01(R.fork("name")) * NAMES.length)];
    var dp = u01(R.fork("name:prefix")), ds = u01(R.fork("name:suffix"));
    var pre = PREFIX[Math.floor(u01(R.fork("name:which-prefix")) * PREFIX.length)], suf = SUFFIX[Math.floor(u01(R.fork("name:which-suffix")) * SUFFIX.length)];
    var en = base[0], d = base[1];
    var single = base[0].indexOf(" ") < 0;
    if (single && dp < 0.14 && pre[0] !== base[0].split(" ")[0]) { en = pre[0] + " " + en; d = pre[1] + " " + d; }
    else if (single && ds < 0.16) { en = en + " " + suf[0]; d = d + " " + suf[1]; }
    var number = 1 + Math.floor(u01(R.fork("number")) * 380);
    return { nameEn: en.toUpperCase(), nameDs: d, number: number };
  }

  // ==========================================================================
  // 6. THE EDITOR'S CHECKS — what a tunebook's editor would send back
  // ==========================================================================
  // (the Earth tunes' melodies, read once, for the "too close" check)
  var EARTH_MEL = null;
  function earthMelodies() {
    if (EARTH_MEL) return EARTH_MEL;
    EARTH_MEL = [];
    var T = K.Tunes && K.Tunes.list;
    (T || []).forEach(function (h) {
      var m = [];
      (h.lines || []).concat(h.refrain || []).forEach(function (l) { (l.notes[h.melodyPart] || []).forEach(function (n) { if (n.syl !== null) m.push(n.deg); }); });
      EARTH_MEL.push({ id: h.id, degs: m });
    });
    return EARTH_MEL;
  }
  // how close two melodies come: the longest run of intervals they share —
  // and whether it is the tune's own (a scale walked by step is everyone's:
  // a run is only a quotation when it is long, or carries leaps of its own)
  function closeness(a, b) {
    var ia = intervals(a), ib = intervals(b), best = { run: 0, leaps: 0 };
    for (var i = 0; i < ia.length; i++) for (var j = 0; j < ib.length; j++) {
      var k = 0, lp = 0;
      while (i + k < ia.length && j + k < ib.length && ia[i + k] === ib[j + k]) { if (Math.abs(ia[i + k]) >= 2) lp++; k++; }
      if (k > best.run || (k === best.run && lp > best.leaps)) best = { run: k, leaps: lp };
    }
    best.quote = best.run >= 9 || (best.run >= 6 && best.leaps >= 2);
    return best;
  }
  function melodyOf(h) {
    var m = [];
    (h.lines || []).concat(h.refrain || []).forEach(function (l) { (l.notes[h.melodyPart] || []).forEach(function (n) { if (n.syl !== null) m.push(n.deg); }); });
    return m;
  }
  // parallels, crossing and spacing, onset by onset, part by part
  function voiceLeading(h) {
    var out = { par5: 0, par8: 0, crossing: 0, spacing: 0, where: [] }, mode = h.mode, ORDER = orderOf(h);
    (h.lines || []).concat(h.refrain || []).forEach(function (l, li) {
      var S = sonorities(h, l), prev = null;
      S.forEach(function (s) {
        var semis = {};
        Object.keys(s.notes).forEach(function (p) { var n = s.notes[p]; semis[p] = semi(mode, n.deg, n.alt || 0); });
        var ord = ORDER.filter(function (p) { return semis[p] != null; });
        for (var k = 0; k + 1 < ord.length; k++) if (semis[ord[k]] < semis[ord[k + 1]]) { out.crossing++; if (out.where.length < 6) out.where.push("line " + (li + 1) + " beat " + s.beat + ": " + ord[k] + " below " + ord[k + 1]); }
        var o0 = ORDER[0], o1 = ORDER[1], o2 = ORDER[2];
        if (semis[o0] != null && semis[o1] != null && semis[o0] - semis[o1] > 12) out.spacing++;
        if (semis[o1] != null && semis[o2] != null && semis[o1] - semis[o2] > 12) out.spacing++;
        if (prev) {
          for (var a = 0; a < ord.length; a++) for (var b = a + 1; b < ord.length; b++) {
            var x = ord[a], y = ord[b];
            if (prev[x] == null || prev[y] == null) continue;
            var m1 = semis[x] - prev[x], m2 = semis[y] - prev[y];
            if (!m1 || !m2 || (m1 > 0) !== (m2 > 0)) continue;
            var i1 = Math.abs(prev[x] - prev[y]) % 12, i2 = Math.abs(semis[x] - semis[y]) % 12;
            if (i1 === 7 && i2 === 7) { out.par5++; if (out.where.length < 6) out.where.push("line " + (li + 1) + " beat " + s.beat + ": fifths " + x + "–" + y); }
            if (i1 === 0 && i2 === 0) { out.par8++; if (out.where.length < 6) out.where.push("line " + (li + 1) + " beat " + s.beat + ": octaves " + x + "–" + y); }
          }
        }
        prev = semis;
      });
    });
    return out;
  }
  function checkHymn(h, ctx) {
    var D = ctx.D, checks = [], fp = fingerprint(h);
    function add(name, ok, detail, hard) { checks.push({ name: name, ok: !!ok, detail: detail, hard: hard !== false }); }
    // 1. a valid Score. (A septimal note — the ringing seventh's 7/4 — is
    // spelled on its degree and wears Johnston's "7": SCORE §2's commaOf reads
    // it through that mark, 36/35. kolob-score.js's proofreader predates the
    // 7-limit and allows only the syntonic comma, so it is shown each such
    // note through its mark; every other note, and every note's monzo, it
    // reads as it stands. See the handoff's request.)
    var sevens = 0, shown = h;
    if (h.lines.concat(h.refrain || []).some(function (l) { return Object.keys(l.notes).some(function (p) { return l.notes[p].some(function (n) { return n.monzo && n.monzo[3]; }); }); })) {
      shown = copy(h);
      shown.lines.concat(shown.refrain || []).forEach(function (l) { Object.keys(l.notes).forEach(function (p) { l.notes[p].forEach(function (n) {
        var k7 = n.monzo[3]; if (!k7) return; sevens++;
        for (var q = 0; q < Math.abs(k7); q++) n.monzo = k7 > 0 ? mz(n.monzo, [2, 2, -1, -1]) : mz(n.monzo, [-2, -2, 1, 1]);
      }); }); });
    }
    var problems = K.Score && K.Score.validateHymn ? K.Score.validateHymn(shown) : [];
    add("valid Score", !problems.length, problems.length ? problems.slice(0, 3).join("; ") : "kolob-score.js validates it" + (sevens ? " (its " + sevens + " septimal notes read through Johnston's 7, as SCORE §2's commaOf reads them)" : ""));
    // 2. the peak, where the plan put it
    var lines = h.lines.concat(h.refrain || []), top = -1e9, topLines = [];
    lines.forEach(function (l, i) { (l.notes[h.melodyPart] || []).forEach(function (n) { if (n.deg > top) { top = n.deg; topLines = [i]; } else if (n.deg === top && topLines.indexOf(i) < 0) topLines.push(i); }); });
    var planned = ctx.sk.peakLine, pos = ctx.peakPos, grace = 1 / Math.max(1, ctx.sk.totalSyl - 1);
    var posOk = pos >= 0.6 - grace - EPS && pos <= 0.75 + grace + EPS;
    add("a planned peak", topLines.indexOf(planned) >= 0 && top === ctx.sk.peak && posOk, "the high note (" + (top - ctx.sk.base) + " steps over the final) in line " + (planned + 1) + " at " + Math.round(pos * 100) + "% of the tune" +
        (posOk ? " (planned 60–75 %)" : " — OUTSIDE the planned 60–75 % (± one syllable)") + (topLines.length > 1 ? " (also touched in line " + topLines.filter(function (x) { return x !== planned; }).map(function (x) { return x + 1; }).join(", ") + ")" : ""));
    // 3. the cadence plan, met
    var missed = [];
    lines.forEach(function (l, i) {
      var pl = l.plan, mel = l.notes[h.melodyPart], fin = null;
      for (var k = mel.length - 1; k >= 0; k--) if (mel[k].stress && mel[k].syl !== null) { fin = mel[k]; break; }
      var targetOk = fin && cls(fin.deg - ctx.sk.base) === cls(pl.targetClass);
      var kindOk = pl.cadence === l.cadence.kind || (pl.cadence === "imperfect" && l.cadence.kind === "authentic") || !!l.plan.elided;   // (a fuge runs on through its first line's close)
      if (!targetOk || !kindOk) missed.push("line " + (i + 1) + ": planned " + pl.cadence + " on " + pl.targetClass + ", got " + l.cadence.kind + (targetOk ? "" : " (wrong last note)"));
    });
    add("cadence plan met", !missed.length, missed.length ? missed.join("; ") : lines.map(function (l) { return l.cadence.kind; }).join(" · "));
    // 3b. the full closes stand on their roots (the Tabernacle): the last
    // chord of every authentic or plagal close, of a tonicized arrival and
    // of the amen in root position, and the dominant before the last
    if (D.id === "tabernacle") {
      var inv = [];
      lines.forEach(function (l, i) {
        var k = l.cadence.kind, cb = l.cadence.beat, at = null, before = null;
        l.chords.forEach(function (c) { if (c.beat <= cb + EPS) { if (at) before = at; at = c; } });
        var fullClose = k === "authentic" || k === "plagal" || l.plan.role === "home";
        if (fullClose && at && at.inv) inv.push("line " + (i + 1) + " ends on " + at.roman);
        var bass = l.notes.B || [], bn = null;
        for (var q = bass.length - 1; q >= 0; q--) if (bass[q].beat <= cb + EPS) { bn = bass[q]; break; }
        if (fullClose && at && bn && cls(bn.deg) !== cls(at.rootDeg) && !at.dim7) inv.push("line " + (i + 1) + ": the bass is not on the root");
        if (l.plan.role === "home" && before && (before.name === "V" || before.name === "V7") && before.inv) inv.push("line " + (i + 1) + ": " + before.roman + " before the close");
      });
      if (h.amen && h.amen.chords.some(function (c) { return c.inv; })) inv.push("the amen is inverted");
      add("the closes stand on their roots", !inv.length, inv.length ? inv.join("; ") : "every full close, and the amen, with the root in the bass (" + lines.filter(function (l) { return l.cadence.kind === "authentic" || l.cadence.kind === "plagal"; }).length + " full closes)");
    }
    // 4. singable ranges: no part wider than an octave and a fourth — counted
    // in semitones (ten steps can be eighteen)
    var wide = []; for (var p in fp.rangeSemi) if (fp.rangeSemi[p] > 17) wide.push(p + " " + fp.rangeSemi[p]);
    add("singable range", !wide.length, wide.length ? wide.join(", ") + " semitones (more than 17)" : Object.keys(fp.rangeSemi).map(function (q) { return q + " " + fp.rangeSemi[q]; }).join(", ") + " semitones (≤ 17, an octave and a fourth)");
    // 4b. singable leaps in the tune: inside a line, no tritone, no seventh,
    // nothing wider than an octave
    var badLeaps = [];
    lines.forEach(function (l, i) {
      var m = l.notes[h.melodyPart] || [];
      for (var k = 1; k < m.length; k++) {
        var st = Math.abs(m[k].deg - m[k - 1].deg), se = Math.abs(semi(h.mode, m[k].deg, m[k].alt || 0) - semi(h.mode, m[k - 1].deg, m[k - 1].alt || 0));
        if (se === 6 || st === 6 || st > 7) badLeaps.push("line " + (i + 1) + ": " + (se === 6 ? "a tritone" : st === 6 ? "a seventh" : "wider than an octave"));
      }
    });
    add("singable leaps", !badLeaps.length, badLeaps.length ? badLeaps.slice(0, 3).join("; ") : "no tritone, no seventh, nothing past the octave in the tune");
    // 5. voice-leading, by the dialect's own law
    var vl = voiceLeading(h), vlBad = [];
    if (!D.rules.parallels && (vl.par5 || vl.par8)) vlBad.push(vl.par5 + " parallel fifths, " + vl.par8 + " octaves");
    if (!D.rules.crossing && vl.crossing) vlBad.push(vl.crossing + " crossings");
    if (D.rules.spacing && vl.spacing) vlBad.push(vl.spacing + " gaps wider than an octave");
    add("voice-leading (" + D.id + ")", !vlBad.length, vlBad.length ? vlBad.join("; ") + (vl.where.length ? " — " + vl.where.join("; ") : "") :
        (D.rules.parallels ? vl.par5 + " parallel fifths (welcome here), " + vl.crossing + " crossings (allowed)" : "no parallels, no crossing"));
    // 6. a tune worth singing twice
    var mel = melodyOf(h), distinct = {}; mel.forEach(function (d) { distinct[d] = true; });
    var durs = {}; lines.forEach(function (l) { (l.notes[h.melodyPart] || []).forEach(function (n) { durs[n.beats] = true; }); });
    var nd = Object.keys(distinct).length, boring = nd < (D.id === "oldway" ? 4 : 5) || Object.keys(durs).length < 2;
    // (the Tabernacle's "closes stand on their roots" and the rest above are
    // the first three dialects'; the round-3 dialects' own laws follow below)
    add("not a boring tune", !boring, nd + " pitches, " + Object.keys(durs).length + " note lengths");
    // 7. not an Earth tune, and not another hymn of the meeting
    var near = { run: 0, leaps: 0, quote: false, id: null };
    earthMelodies().forEach(function (e) { var r = closeness(mel, e.degs); if (r.quote > near.quote || (r.quote === near.quote && r.run > near.run)) { r.id = e.id; near = r; } });
    add("not an Earth tune", !near.quote, "longest run of intervals shared with an Earth tune: " + near.run + " (" + near.leaps + " leaps)" + (near.id ? ", " + near.id.replace("earth:", "").toUpperCase() : "") + " — a quotation is 9 in a row, or 6 with two leaps");
    var nearO = { run: 0, leaps: 0, quote: false };
    (ctx.others || []).forEach(function (o) { var r = closeness(mel, melodyOf(o)); if (r.quote > nearO.quote || (r.quote === nearO.quote && r.run > nearO.run)) nearO = r; });
    add("not another hymn of the meeting", !nearO.quote, (ctx.others || []).length ? "longest shared run: " + nearO.run + " (" + nearO.leaps + " leaps)" : "no other hymn given");
    // 8. (round 3) each new dialect's own law
    if (D.id === "psalmody") {
      var fg = h.fuge, fl = null;
      // (the fuge as sung: its line, or its two lines run together — the
      // second's notes moved on by the first's length)
      if (fg) {
        var fls = (fg.lines || [fg.line]).map(function (i) { return h.lines[i]; }), fOff = 0;
        fl = { notes: {}, cadence: null };
        fls.forEach(function (l, j) {
          Object.keys(l.notes).forEach(function (q) { (fl.notes[q] = fl.notes[q] || []).push.apply(fl.notes[q], l.notes[q].map(function (n) { return { beat: n.beat + fOff, beats: n.beats, deg: n.deg, alt: n.alt, syl: n.syl }; })); });
          if (j === fls.length - 1) fl.cadence = { kind: l.cadence.kind, beat: l.cadence.beat + fOff };
          fOff += j + 1 < fls.length ? fls[j + 1].startBeat - l.startBeat : 0;
        });
      }
      if (fl) {
        var probs = [], head = fg.entries.filter(function (e) { return e.part === "T"; })[0];
        var tuneOn = (fl.notes.T || []).filter(function (n) { return n.syl !== null; }), hs = Math.max(2, fg.head || 3);
        var tuneIv = intervals(tuneOn.slice(0, hs).map(function (n) { return n.deg; }));
        var at = fg.entries.map(function (e) { return e.at; });
        if (fg.entries.length !== 4) probs.push(fg.entries.length + " entries");
        for (var e2 = 1; e2 < at.length; e2++) if (at[e2] < at[e2 - 1] - EPS) probs.push("entries out of order");
        if (at[1] <= at[0] + EPS) probs.push("the tenor does not follow the bass");
        fg.entries.forEach(function (e) {
          var ns = (fl.notes[e.part] || []).filter(function (n) { return n.syl !== null; });
          var iv = intervals(ns.slice(0, hs).map(function (n) { return n.deg; }));
          if (iv.join() !== tuneIv.join()) probs.push(e.part + " does not take up the head");
          // the entering note against what already sounds: no second, seventh or tritone
          var first = fl.notes[e.part][0], sf = semi(h.mode, first.deg, first.alt || 0);
          Object.keys(fl.notes).forEach(function (q) {
            if (q === e.part) return;
            var o = null; fl.notes[q].forEach(function (n) { if (n.beat <= first.beat + EPS && first.beat < n.beat + n.beats - EPS) o = n; });
            if (!o) return;
            var ic = Math.abs(sf - semi(h.mode, o.deg, o.alt || 0)) % 12;
            if (ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6) probs.push(e.part + " enters against " + q + " by a dissonance");
          });
        });
        // they meet on the written cadence: every part begins a note there
        var cb2 = fl.cadence.beat;
        ["S", "A", "T", "B"].forEach(function (q) { if (!(fl.notes[q] || []).some(function (n) { return Math.abs(n.beat - cb2) < EPS; })) probs.push(q + " misses the cadence"); });
        var where = fls.length > 1 ? "lines " + (fg.lines[0] + 1) + "–" + (fg.lines[1] + 1) : "line " + (fg.line + 1);
        add("the fuge", !probs.length, probs.length ? probs.slice(0, 3).join("; ") :
            where + ": " + fg.entries.map(function (e) { return e.part + " at beat " + e.at + (e.transpose ? " (" + (e.transpose > 0 ? "+" : "") + e.transpose + " steps)" : ""); }).join(", ") + "; a head of " + (fg.headNotes || hs) + " notes; all four meet on the " + fl.cadence.kind + " close");
      } else add("the fuge", true, "none written in this tune (a plain psalm tune)", false);
    }
    if (D.id === "gospel") {
      // the lead in the second voice: the tenor harmony over it, the baritone and the bass under it
      var lp = [];
      h.lines.concat(h.refrain || []).forEach(function (l, i) {
        sonorities(h, l).forEach(function (so) {
          var sm = {}; Object.keys(so.notes).forEach(function (q) { sm[q] = semi(h.mode, so.notes[q].deg, so.notes[q].alt || 0); });
          if (sm.S != null && sm.T != null && sm.S <= sm.T) lp.push("line " + (i + 1) + ": the tenor harmony under the lead");
          if (sm.A != null && sm.T != null && sm.A >= sm.T) lp.push("line " + (i + 1) + ": the baritone over the lead");
        });
      });
      add("the lead in the second voice", !lp.length, lp.length ? lp.slice(0, 3).join("; ") : "every chord: the tenor harmony over the lead, the baritone and the bass under it");
      // every dominant seventh rings: its notes stand exactly 4:5:6:7
      var rung = 0, full = 0, sour = [];
      h.lines.concat(h.refrain || []).concat(h.tag ? [h.tag] : []).forEach(function (l, i) {
        (l.chords || []).forEach(function (c) {
          if (c.quality !== "dom7") return;
          rung++;
          // (every note sounding at the chord's first beat, held ones included — a swipe's lead)
          var ms = [];
          Object.keys(l.notes).forEach(function (q) { l.notes[q].forEach(function (n) { if (!n.nct && n.beat <= c.beat + EPS && c.beat < n.beat + n.beats - EPS) ms.push(n.monzo); }); });
          // (as harmonics of one fundamental: the odd parts 1, 3, 5, 7 — or some
          // of them, the seventh among them, where a tone is left out)
          var odd = K.Pitch && K.Pitch.oddParts ? K.Pitch.oddParts(ms) : [], pr = K.Pitch ? K.Pitch.proportion(ms) : "";
          var inSeries = odd.length >= 2 && odd.every(function (o) { return o === 1 || o === 3 || o === 5 || o === 7; }) && odd.indexOf(7) >= 0;
          if (odd.join() === "1,3,5,7") full++;
          else if (!inSeries) sour.push((l.plan && l.plan.role === "tag" ? "the tag" : "line " + (i + 1)) + " " + c.roman + " " + pr);
        });
      });
      add("ringing sevenths (4:5:6:7)", rung > 0 && full > 0 && !sour.length, sour.length ? sour.slice(0, 3).join("; ") :
          rung + " dominant sevenths, every one tuned on the seventh partial; " + full + " sung complete, exactly 4:5:6:7");
      if (D.alwaysRefrain) add("a refrain after the verse", !!(h.refrain && h.refrain.length), h.refrain ? h.refrain.length + " lines of refrain" : "no refrain");
      var rep = ctx.harm || {};
      // (the tag is the harmonizer's until the Hymn is finished: read it there — round 3's first pass read h.tag, not yet set, and always said "no tag")
      add("swipes, echoes and the tag", true, (rep.swipes || 0) + " swipes, " + (rep.echoes || 0) + " echoes, " + (rep.tag ? "a tag (" + (rep.tag.chain || []).join("–") + ")" : "no tag"), false);
    }
    if (D.id === "shaker") {
      var ps = Object.keys(h.lines[0].notes);
      add("one melody", ps.length === 1 && ps[0] === "S", ps.length === 1 ? "the tune alone, in unison" + (h.drone ? ", over a drone" : "") : "parts: " + ps.join(""));
      if (h.kind === "primary") add("a child's compass", fp.rangeSemi.S <= 12, fp.rangeSemi.S + " semitones (a Primary song keeps inside the octave)");
      if (h.kind === "gift") add("a gift song on vocables", !!(h.verses && h.verses.length && h.verses[0].length), (h.vocablesEn || []).slice(0, 8).join(" ") + " …", false);
    }
    // the idiom: this hymn's fingerprint against the dialect's Earth tunes (reported, not a gate:
    // one short hymn can stray where thirty cannot — the lab's spread panel measures the thirty)
    var tol = D.tolerance, idiom = [];
    if (MINOR[h.mode] && tol.minor) { var t2 = {}; for (var kk in tol) t2[kk] = tol[kk]; for (kk in tol.minor) t2[kk] = tol.minor[kk]; tol = t2; }
    ["par5", "thirdless", "crossing", "chromatic", "sevenths", "leap", "melisma", "closeThird", "septimal", "stagger"].forEach(function (k) {
      var v = fp.share[k]; if (tol[k] && (v < tol[k][0] - EPS || v > tol[k][1] + EPS)) idiom.push(k + " " + v + " (want " + tol[k][0] + "–" + tol[k][1] + ")");
    });
    add("idiom (" + D.id + " fingerprint)", !idiom.length, idiom.length ? idiom.join("; ") : "within the Earth tunes' tolerances", false);
    return { checks: checks, fingerprint: fp, voiceLeading: vl, earthNearest: near };
  }

  // ==========================================================================
  // 5. HARMONY, AND THE SCORE ITSELF
  // ==========================================================================
  function harmonizeTune(fr, sk, rh, mel, D, H, R, keySemi, partnerLines) {
    var mode = fr.mode, bounds = {}, tess = {};
    ["S", "A", "T", "B"].forEach(function (p) { if (D.ranges[p]) { bounds[p] = degBounds(mode, keySemi, D.ranges[p]); tess[p] = degBounds(mode, keySemi, D.tess[p]); } });
    var lines = sk.lines.map(function (L, i) {
      var notes = rh[i].notes.map(function (n, k) { return { beat: n.beat, beats: n.beats, deg: mel[i].degs[k], syl: n.cont ? null : n.syl, stress: n.stress, cont: n.cont }; });
      return { notes: notes, cadence: L.cadence, plan: L.plan || null, role: L.role, full: !!L.full, bare: !!L.bare, refrain: !!L.refrain, targetClass: L.targetClass, peakIdx: L.peak ? mel[i].peakIdx : -1,
               len: rh[i].len, barStart: rh[i].barStart || 0 };                // (the fuge runs two lines together, on the tune's own bar)
    });
    var altoDie = u01(R.fork("alto"));
    var altoOn = D.altoRate != null && altoDie < D.altoRate * (H ? 0.4 + H.alto : 1);
    var split = TIMES[fr.time].den === 8 ? 1 : 0.5;
    var res = D.harmonize({ mode: mode, H: H, bounds: bounds, tess: tess, lines: lines, R: R, shortBeat: 1, split: split, alto: altoOn, amen: !!D.amen, bar: TIMES[fr.time].bar,
                            // (the round-3 dialects' own: the fuge's rate, the swipes and echoes, the tag, the drone)
                            nVerse: fr.lines.length, fugeRate: D.fugeRate, swipeRate: D.swipeRate, echoRate: D.echoRate, tag: !!D.tag,
                            droneRate: D.droneRate ? D.droneRate[fr.kind || "shaker"] : null,
                            // (a partner hymn: the first hymn's chord at every beat)
                            forced: partnerLines ? function (li, beat) { return partnerLines[li] ? partnerLines[li].nameAt(beat) : null; } : null });
    return { lines: res, bounds: bounds, alto: altoOn, amen: res.amen || null, fuge: res.fuge || null, tag: res.tag || null, drone: res.drone || null,
             swipes: res.swipes || 0, echoes: res.echoes || 0 };
  }

  function buildScore(fr, sk, rh, mel, harm, D, H, R, opts, keyMonzo) {
    var mode = fr.mode, mp = D.melodyPart, nVerse = fr.lines.length, beatAt = 0, verseOff = 0, refrainOff = 0, commas = 0;
    var lines = sk.lines.map(function (L, i) {
      var hl = harm.lines[i], lay = rh[i], parts = {};
      var off = L.refrain ? refrainOff : verseOff;
      // the melody's syllables, counted through the verse (and again through the refrain)
      var sylAtBeat = {};
      hl.parts[mp].forEach(function (n) { if (n.syl !== null && n.syl !== undefined && !n.cont) sylAtBeat[r3(n.beat)] = off + n.syl; });
      var fermata = (L.role === "home" ? D.id !== "sacredharp" : L.fermDie < (D.fermata || 0) * (H ? 0.5 + H.fermata : 1)) && !hl.elided;
      for (var p in hl.parts) {
        parts[p] = hl.parts[p].map(function (n) {
          var isMel = p === mp;
          // (a part that sings its own words at its own time — the fuge's
          // entries, the men's echo — keeps the syllable it sings)
          var syl = isMel ? (n.cont || n.syl === null || n.syl === undefined ? null : off + n.syl) : n.ownSyl != null ? off + n.ownSyl : (n.nct || n.tiedInto || sylAtBeat[r3(n.beat)] == null ? null : sylAtBeat[r3(n.beat)]);
          var o = { beat: r3(n.beat), beats: r3(n.beats), deg: n.deg, monzo: [0, 0, 0, 0], tie: !!n.tie, fermata: fermata && Math.abs(n.beat - hl.cadBeat) < EPS && !n.nct,
                    syl: syl, stress: n.stress ? 1 : 0, nct: n.nct || null, ornament: n.ornament || null };
          if (n.alt) o.alt = n.alt;
          return o;
        });
      }
      if (hl.chords.length) tuneLineParts(mode, parts, hl.chords, !!D.ring, mp);
      else if (harm.drone) parts[mp].forEach(function (n) { n.monzo = spelledMonzo(mode, n.deg, n.alt || 0); n.comma = 0; });   // (over a drone: just against home's note)
      else tuneMelodyAlone(mode, parts[mp]);
      for (p in parts) parts[p].forEach(function (n) { if (n.comma) commas++; });
      var line = {
        notes: parts,
        cadence: { kind: hl.cadenceKind, beat: r3(hl.cadBeat) },
        chords: hl.chords.map(function (c) { var o = {}; for (var k in c) if (c[k] !== undefined) o[k] = c[k]; o.beat = r3(o.beat); o.len = r3(o.len); return o; }),
        peak: !!L.peak, breathAfter: !hl.elided, fermataBeats: fermata ? [r3(hl.cadBeat)] : [],
        startBeat: r3(beatAt), barStart: hl.barStart != null ? hl.barStart : lay.barStart,
        plan: { letter: L.letter + (L.prime ? "'" : ""), role: L.role, cadence: L.cadence, via: L.plan || null, full: !!L.full, targetClass: L.targetClass, figure: L.figure, contour: L.contour,
                cell: lay.cell, copyOf: L.copyOf != null ? L.copyOf : null, refrain: L.refrain },
      };
      // (round 3, dev: a bare close, a fuge's entries, the men's echo, the swipes)
      if (L.bare) line.plan.bare = true;
      if (hl.fuge) line.plan.fuge = hl.fuge;
      if (hl.elided) line.plan.elided = true;                                // (a fuge runs on through this line's close)
      if (hl.echo) line.plan.echo = hl.echo;
      if (hl.nct && hl.nct.swipes) line.plan.swipes = hl.nct.swipes;
      // (a fuge begins before the tune does: the line is longer by the tune's delay)
      beatAt += lay.len + (hl.shift || 0);
      if (L.refrain) refrainOff += L.syl; else verseOff += L.syl;
      return line;
    });
    var verse = lines.slice(0, nVerse), refrain = lines.length > nVerse ? lines.slice(nVerse) : null;
    return { lines: verse, refrain: refrain, commas: commas };
  }

  // ==========================================================================
  // compose(stream, opts) — the whole desk, steps 1 to 7
  // ==========================================================================
  //   opts: { dialect, meter, form, mode, modeOfTime, keyMonzo, hymnist (an id
  //           or a hymnist), id ("h:<meeting>:<i>"), gestures ([[deg…]] — the
  //           day's material, the first seeds line one), others ([Hymn] —
  //           the meeting's other hymns, not to be echoed) }
  function compose(stream, opts) {
    opts = opts || {};
    var R = stream, Dl = K.Dialects, Hs = K.Hymnists;
    if (!Dl) throw new Error("kolob-composer: kolob-dialects.js is not loaded");
    // the dice for the dialect and the hymnist are thrown whether or not the caller named them
    var dDraw = pickW(R.fork("dialect"), [["tabernacle", 3], ["sacredharp", 2], ["oldway", 1]]);
    var dialect = opts.dialect && Dl.get(opts.dialect) ? Dl.get(opts.dialect).id : dDraw;
    var D = Dl.get(dialect);
    // (internal, round 3: a profile laid over the dialect's — the wandering
    // refrain's couplet in the lilt — and the first hymn a partner is written on)
    if (opts._profile) { var D0 = D; D = Object.create(D0); for (var pk in opts._profile) D[pk] = opts._profile[pk]; }
    var P1 = opts._partner || null;
    var hDraw = Hs ? Hs.draw(R.fork("hymnist"), dialect) : null;
    var H = Hs ? (opts.hymnist ? Hs.byId(opts.hymnist) : hDraw) : null;
    var keyMonzo = (opts.keyMonzo || [0, 0, 0, 0]).slice(0, 4);
    var keySemi = Math.round(mzCents(keyMonzo) / 100);
    var fr = drawFrame(R.fork("frame"), opts, D, H);
    if (P1) fr.refrain = P1.refrain ? P1.refrain.map(function (l) { return l.notes[P1.melodyPart].filter(function (n) { return n.syl !== null; }).length; }) : null;
    var sk = planSkeleton(R.fork("skeleton"), fr, D, H, keySemi);
    var rh = planRhythm(fr, sk, D, H);
    if (P1) partnerFrame(fr, sk, rh, D, P1, !!opts._partnerRhythm);
    var gesture = opts.gestures && opts.gestures[0] ? opts.gestures[0].map(function (g) { return typeof g === "number" ? g + sk.base : g.deg + sk.base; }) : null;
    var named = nameOf(R.fork("naming:" + D.id));
    // (a hymn never takes the name of another hymn of the meeting — round 3's
    // critic found the partner of CUMORAH named CUMORAH; the name is drawn
    // again, from a die of its own, and nothing else moves)
    var taken = (opts.others || []).map(function (o) { return o && o.nameEn; }).concat(opts.avoidNames || []);
    for (var nk = 1; nk < 12 && taken.indexOf(named.nameEn) >= 0; nk++) named = nameOf(R.fork("naming:" + D.id + ":again:" + nk));
    var tempoDie = R.fork("tempo").rnd(0.95, 1.05);
    var best = null, repairs = [], quoted = {};
    var mel = composeMelody(fr, sk, rh, D, H, gesture, 0);
    for (var round = 0; round < 6; round++) {
      if (round > 0) {
        var failed = best.result.checks.filter(function (c) { return c.hard && !c.ok; }).map(function (c) { return c.name; });
        repairs.push({ round: round, failed: failed });
        // (a setting that will not come right with this tune is given another tune, from round two)
        var melodyFail = failed.some(function (f) { return /peak|boring|Earth|another hymn|range|leaps|compass/.test(f) || (round >= 2 && /voice-leading|cadence|roots|lead|ringing|fuge/.test(f)); });
        var avoid = [];
        if (best.result.earthNearest && best.result.earthNearest.quote) earthMelodies().forEach(function (e) { if (e.id === best.result.earthNearest.id) avoid.push(e.degs); });
        // (round 3's dialects remember every Earth tune any round has echoed, not only the best round's)
        if (D.figureRepair) earthMelodies().forEach(function (e) { if (quoted[e.id] && avoid.indexOf(e.degs) < 0) avoid.push(e.degs); });
        (opts.others || []).forEach(function (o) { avoid.push(melodyOf(o)); });
        if (melodyFail) mel = composeMelody(fr, sk, rh, D, H, gesture, round, null, avoid);
      }
      // (the Tabernacle's slurred passing notes: the search's tune, walked)
      var sl = slurPassing(fr, sk, rh, mel, D, H);
      var harm = harmonizeTune(fr, sk, sl.rh, sl.mel, D, H, R.fork(round ? "harmony:repair:" + round : "harmony"), keySemi, sk.partner && P1 && P1.dialect === D.id ? sk.partner : null);
      var built = buildScore(fr, sk, sl.rh, sl.mel, harm, D, H, R, opts, keyMonzo);
      var T = TIMES[fr.time];
      var h = {
        id: opts.id || "h:0:1", number: named.number, nameDs: named.nameDs, provenance: "colony", source: null,
        meter: fr.meter, form: fr.form + (fr.refrain ? "R" : ""), dialect: D.id, mode: fr.mode, keyMonzo: keyMonzo, modeOfTime: fr.time,
        beatS: r3(T.beatS * D.tempo * (H ? H.tempo : 1) * tempoDie), melodyPart: D.melodyPart,
        lines: built.lines, refrain: built.refrain, verses: [],
      };
      // (round 3: what the new dialects add to a Hymn — see the handoff's requests for SCORE)
      if (D.voiceOrder) h.voiceOrder = D.voiceOrder.slice();                 // D: the parts top to bottom (the lead second)
      if (fr.kind) h.kind = fr.kind;                                        // E: shaker, gift or primary
      if (harm.drone) h.drone = harm.drone;                                 // E: the hummed drone's degrees (from the final)
      if (harm.fuge && harm.fuge.line >= 0) h.fuge = { line: harm.fuge.line, lines: harm.fuge.lines || [harm.fuge.line], gap: harm.fuge.gap, head: harm.fuge.head, headNotes: harm.fuge.headNotes, entries: harm.fuge.entries, repeatFrom: harm.fuge.line };
      if (fr.kind === "gift") { var vc = vocablesFor(R.fork("vocables"), built.lines); h.verses = [vc.ds]; h.vocablesEn = vc.en; }
      if (K.Score && K.Score.hymn) h = K.Score.hymn(h);
      // where the peak fell, as a share of the tune's syllables
      var sylTotal = 0, peakSyl = null;
      h.lines.forEach(function (l) { (l.notes[h.melodyPart] || []).forEach(function (n) { if (n.syl !== null) { if (l.peak && n.deg === sk.peak && peakSyl == null) peakSyl = sylTotal; sylTotal++; } }); });
      var result = checkHymn(h, { D: D, sk: sk, peakPos: peakSyl != null ? peakSyl / Math.max(1, sylTotal - 1) : -1, others: opts.others, harm: harm, fr: fr });
      var bad = result.checks.filter(function (c) { return c.hard && !c.ok; }).length;
      if (result.earthNearest && result.earthNearest.quote) quoted[result.earthNearest.id] = true;
      if (!best || bad < best.bad) best = { h: h, result: result, bad: bad, harm: harm, commas: built.commas, round: round, mel: mel, slurs: sl.added };
      if (!bad) break;
    }
    h = best.h;
    // dev fields: the plan, the search, the checks (never rendered in the app)
    h.nameEn = named.nameEn;
    h.hymnist = H ? { id: H.id, nameDs: H.nameDs, nameEn: H.nameEn } : null;
    h.report = {
      frame: { dialect: D.id, meter: fr.meter, form: fr.form, modeOfTime: fr.time, mode: fr.mode, refrain: !!fr.refrain, keySemi: keySemi, alto: best.harm.alto },
      peak: { line: sk.peakLine + 1, stepsOverFinal: sk.peakTo, span: sk.span, at: r3(best.result.checks.length ? (function () { var s = 0, pk = null; h.lines.forEach(function (l) { (l.notes[h.melodyPart] || []).forEach(function (n) { if (n.syl !== null) { if (l.peak && n.deg === sk.peak && pk == null) pk = s; s++; } }); }); return pk != null ? pk / Math.max(1, s - 1) : -1; })() : -1) },
      // (the plan as the KEPT round wrote it — the Score's own line plans and
      // that round's search — never a later round's that did worse)
      lines: h.lines.concat(h.refrain || []).map(function (l, i) { var P = l.plan, m = best.mel[i]; return { letter: P.letter, role: P.role, cadence: P.cadence + (P.via ? " (" + P.via + ")" : ""), full: P.full, target: P.targetClass, figure: P.figure, contour: P.contour, cell: P.cell, copyOf: P.copyOf != null ? P.copyOf + 1 : null, searchCost: m.cost, topSpread: m.topSpread }; }),
      harmony: best.harm.lines.map(function (x) { return { cadence: x.cadenceKind, nct: x.nct || {}, chordCost: x.chordCost != null ? x.chordCost : null, voiceCost: x.voiceCost != null ? x.voiceCost : null, relaxed: !!x.relaxed }; }),
      checks: best.result.checks, fingerprint: best.result.fingerprint, earthNearest: best.result.earthNearest,
      repairs: repairs.slice(0, best.round), commas: best.commas, rounds: repairs.length + 1, keptRound: best.round,
      // (every round's failures, the kept one's too: a repair that did worse is still on the record)
      attempts: repairs.map(function (x) { return x.failed; }).concat([best.result.checks.filter(function (c) { return c.hard && !c.ok; }).map(function (c) { return c.name; })]),
      // (round 3: the slurred passing notes added; the fuge; the swipes and echoes)
      slurs: best.slurs || 0, fuge: best.harm.fuge || null, swipes: best.harm.swipes || 0, echoes: best.harm.echoes || 0, kind: fr.kind || null,
    };
    // the amen, tuned and shaped as a line of its own (sung after the last verse)
    if (D.amen && best.harm.amen) {
      var am = best.harm.amen, ap = {};
      for (var p in am.parts) ap[p] = am.parts[p].map(function (n) { var o = { beat: n.beat, beats: n.beats, deg: n.deg, monzo: [0, 0, 0, 0], tie: false, fermata: n.beat > 0, syl: p === D.melodyPart ? n.syl : null, stress: 1, nct: null, ornament: null }; if (n.alt) o.alt = n.alt; return o; });
      tuneLineParts(fr.mode, ap, am.chords);
      var al = { notes: ap, cadence: { kind: "plagal", beat: am.cadBeat }, chords: am.chords, peak: false, breathAfter: false, fermataBeats: [am.cadBeat], plan: { letter: "Amen", role: "amen" } };
      h.amen = K.Score && K.Score.line ? K.Score.line(al) : al;
    }
    // the tag (dialect D), tuned and shaped as a line of its own (sung after
    // the last refrain): the lead's post, the chords turning round it, the ring
    if (D.tag && best.harm.tag) {
      var tg = best.harm.tag, tp = {}, last = tg.cadBeat;
      for (var q in tg.parts) tp[q] = tg.parts[q].map(function (n) { var o = { beat: r3(n.beat), beats: r3(n.beats), deg: n.deg, monzo: [0, 0, 0, 0], tie: false, fermata: Math.abs(n.beat - last) < EPS || (n.beat < last && n.beat + n.beats > last + EPS), syl: q === D.melodyPart ? n.syl : null, stress: n.stress ? 1 : 0, nct: null, ornament: null }; if (n.alt) o.alt = n.alt; return o; });
      tuneLineParts(fr.mode, tp, tg.chords, !!D.ring, D.melodyPart);
      var tl = { notes: tp, cadence: { kind: tg.cadenceKind, beat: r3(last) }, chords: tg.chords, peak: false, breathAfter: false, fermataBeats: [r3(last)], plan: { letter: "Tag", role: "tag", chain: tg.chain } };
      h.tag = K.Score && K.Score.line ? K.Score.line(tl) : tl;
    }
    return h;
  }
  // THE GIFT SONG'S SYLLABLES — received, not written: the Shakers sang some
  // of their dancing songs on vocables ("lo lo lo", "vol de ral"). A pair of
  // them walks each line, a closing one ends it; a strain sung again is sung
  // on its own syllables again. Deseret for the Score, English for the lab.
  var VOCABLES = [["lo", "𐑊𐐬"], ["la", "𐑊𐐪"], ["lee", "𐑊𐐨"], ["dee", "𐐼𐐨"], ["de", "𐐼𐐯"], ["vol", "𐑂𐐫𐑊"], ["hey", "𐐸𐐩"], ["loo", "𐑊𐐭"]];
  var VOCABLE_ENDS = [["lum", "𐑊𐐲𐑋"], ["dum", "𐐼𐐲𐑋"], ["lo", "𐑊𐐬"], ["day", "𐐼𐐩"]];
  function vocablesFor(R, lines) {
    var byLetter = {}, ds = [], en = [];
    lines.forEach(function (l, i) {
      var key = String(l.plan && l.plan.letter || i).replace("'", "");
      if (!byLetter[key]) {
        var r = R.fork("line:" + key), a = VOCABLES[Math.floor(u01(r.fork("a")) * VOCABLES.length)], b = VOCABLES[Math.floor(u01(r.fork("b")) * VOCABLES.length)];
        byLetter[key] = { a: a, b: b, end: VOCABLE_ENDS[Math.floor(u01(r.fork("end")) * VOCABLE_ENDS.length)] };
      }
      var v = byLetter[key], mel = l.notes.S || l.notes[Object.keys(l.notes)[0]], ons = mel.filter(function (n) { return n.syl !== null; });
      ons.forEach(function (n, k) { var x = k === ons.length - 1 ? v.end : k % 2 === 0 ? v.a : v.b; ds.push(x[1]); en.push(x[0]); });
    });
    return { ds: ds, en: en };
  }

  // ==========================================================================
  // ROUNDS — a canon over one short repeating ground (PLAN §14, item 2;
  // Tallis's Canon, 1567; Billings's "When Jesus Wept", 1770; the Primary's
  // and the Shakers' own)
  // ==========================================================================
  // A round is one tune cut into k SEGMENTS of equal length, every one of
  // them over the same short chord pattern, the GROUND. A second singer
  // starts at the top when the first reaches segment two, a third when the
  // first reaches segment three: so at any moment the ward sings several
  // segments at once, over the one ground — and the round works only if
  // every segment sounds well against every other. So the segments are
  // written one at a time, each searched against the ground and against every
  // segment already written, each in a register and a rhythm of its own (the
  // long notes, the walking crotchets, the quick run, the low figure that
  // underpins the rest: Frère Jacques is built so). The FIT CHECK then hears
  // every pair that ever sounds together and says how many entries — two,
  // three, four — the round can carry.
  var GROUNDS = {
    major: [[["I"], 0.7], [["I", "V"], 2], [["I", "IV", "V", "I"], 1.6], [["I", "vi", "IV", "V"], 0.9], [["I", "IV", "I", "V"], 1.3], [["I", "V", "vi", "V"], 0.5]],
    minor: [[["i"], 0.6], [["i", "v"], 1.5], [["i", "VII", "VI", "v"], 1], [["i", "iv", "v", "i"], 1.2], [["i", "VII", "i", "v"], 1]],
    mixolydian: [[["I", "♭VII"], 1.5], [["I", "IV", "♭VII", "I"], 1.2], [["I", "v"], 0.8]],
  };
  var ROMAN_ROOT = { I: 0, i: 0, ii: 1, iii: 2, III: 2, IV: 3, iv: 3, V: 4, v: 4, vi: 5, VI: 5, VII: 6, "♭VII": 6 };
  var ROUND_RHYTHMS = {     // per foot of a bar: the long, the walk, the run, the dotted, the low figure
    "4/4": { long: [2, 2], walk: [1, 1, 1, 1], run: [0.5, 0.5, 0.5, 0.5, 1, 1], dot: [1.5, 0.5, 1, 1], low: [1, 1, 2] },
    "3/4": { long: [3], walk: [1, 1, 1], run: [0.5, 0.5, 0.5, 0.5, 1], dot: [1.5, 0.5, 1], low: [2, 1] },
    "6/8": { long: [3, 3], walk: [2, 1, 2, 1], run: [1, 1, 1, 1, 1, 1], dot: [1.5, 0.5, 1, 3], low: [3, 2, 1] },
    "2/4": { long: [2], walk: [1, 1], run: [0.5, 0.5, 0.5, 0.5], dot: [1.5, 0.5], low: [1, 1] },
  };
  // (a round that will not carry at least three entries — or two, for a
  // round of three — is written again from other dice, a few times, and the
  // one that carries the most is kept)
  function composeRound(stream, opts) {
    opts = opts || {};
    var best = null;
    for (var t = 0; t < (opts.tries || 5); t++) {
      var h = roundOnce(t ? stream.fork("round:again:" + t) : stream, opts);
      var want = Math.min(3, h.round.segments), clash = h.round.pairs.reduce(function (a, p) { return a + p.strong * 5 + p.weak + p.parallels; }, 0);
      var score = (h.round.entries >= want ? 0 : 100 * (want - h.round.entries)) + clash + (h.report.checks.some(function (c) { return !c.ok; }) ? 50 : 0);
      if (!best || score < best.score) best = { h: h, score: score, t: t };
      if (h.round.entries >= want && !h.report.checks.some(function (c) { return !c.ok; })) break;
    }
    best.h.round.tries = best.t + 1;
    return best.h;
  }
  function roundOnce(stream, opts) {
    var R = stream, Dl = K.Dialects, D = Dl.get(opts.dialect || "shaker") || Dl.get("shaker"), Hs = K.Hymnists;
    var hDraw = Hs ? Hs.draw(R.fork("hymnist"), D.id) : null, H = Hs ? (opts.hymnist ? Hs.byId(opts.hymnist) : hDraw) : null;
    var keyMonzo = (opts.keyMonzo || [0, 0, 0, 0]).slice(0, 4), keySemi = Math.round(mzCents(keyMonzo) / 100);
    var F = R.fork("round");
    var tDraw = pickW(F.fork("time"), [["4/4", 2], ["3/4", 1.2], ["6/8", 1.4], ["2/4", 0.6]]);
    var oDraw = pickW(F.fork("mode"), D.id === "psalmody" ? [["aeolian", 2], ["ionian", 1.5], ["dorian", 0.6]] : [["ionian", 3], ["penta", 1.5], ["hexa", 1], ["mixolydian", 0.7], ["aeolian", 0.6], ["dorian", 0.4]]);
    var kDraw = pickW(F.fork("segments"), [[3, 1], [4, 2]]), gDraw = pickW(F.fork("bars"), [[1, 0.6], [2, 2]]);
    var time = opts.modeOfTime && ROUND_RHYTHMS[opts.modeOfTime] ? opts.modeOfTime : tDraw;
    var mode = opts.mode && SEMIS[opts.mode] ? opts.mode : oDraw;
    var k = opts.segments === 3 || opts.segments === 4 ? opts.segments : kDraw, G = gDraw;
    var fam = MINOR[mode] ? "minor" : mode === "mixolydian" ? "mixolydian" : "major";
    var ground = pickW(F.fork("ground"), GROUNDS[fam]);
    var T = TIMES[time], bar = T.bar, segLen = G * bar, chordLen = segLen / ground.length;
    // (round 3, second pass — the critic saw a round's IV begin in the middle
    // of a bar: a ground of four chords in two bars of three-four changes every
    // beat and a half. A ground's chords change on the bar's strong beats — the
    // downbeat and, in four-four and six-eight, the half bar — so a ground that
    // will not divide the segment so is drawn again from those that will)
    var strongStep = time === "4/4" ? 2 : time === "6/8" ? 3 : bar;
    function onBeat(g) { var cl = segLen / g.length; return Math.abs(cl / strongStep - Math.round(cl / strongStep)) < EPS && cl >= strongStep - EPS; }
    if (!onBeat(ground)) {
      var fits = GROUNDS[fam].filter(function (g) { return onBeat(g[0]); });
      if (fits.length) { ground = pickW(F.fork("ground:meter"), fits); chordLen = segLen / ground.length; }
    }
    var classes = TUNE_CLASSES[mode], RR = ROUND_RHYTHMS[time];
    // the chords of the ground, as a Score has them (so the notes are tuned by them)
    var groundChords = ground.map(function (nm, i) {
      var r = ROMAN_ROOT[nm], tones = [[r, 0], [cls(r + 2), 0], [cls(r + 4), 0]];
      var iv3 = ((SEMIS[mode][cls(r + 2)] - SEMIS[mode][r]) % 12 + 12) % 12;
      return { beat: i * chordLen, len: chordLen, roman: nm, rootDeg: r, quality: iv3 === 4 ? "maj" : "min", tones: tones };
    });
    function chordAtBeat(b) { var i = Math.min(ground.length - 1, Math.floor((b + EPS) / chordLen)); return groundChords[i]; }
    // the part's octave on this key (the tune sung by everyone: the S part's compass)
    var rng = (D.ranges.S || [-1, 16]), best = 0, bc = 1e9;
    for (var o = -2; o <= 2; o++) { var lo = keySemi + 12 * o - 5, hi = keySemi + 12 * o + 9, c = Math.max(0, rng[0] - lo) + Math.max(0, hi - rng[1]); if (c < bc) { bc = c; best = o; } }
    var base = 7 * best;
    // each segment's register and rhythm, drawn without replacement
    var regs = [["mid", 2], ["high", 5], ["low", -2], ["upper", 4]], kinds = ["walk", "long", "run", "dot", "low"];
    var order = [], regOrder = [], Dk = F.fork("kinds"), Dr = F.fork("registers");
    var kp = kinds.slice(); while (order.length < k) { var x = pickW(Dk, kp.map(function (q) { return [q, q === "walk" || q === "long" ? 1.6 : 1]; })); order.push(x); kp.splice(kp.indexOf(x), 1); }
    var rp = regs.slice(); while (regOrder.length < k) { var y = pickW(Dr, rp.map(function (q) { return [q, 1]; })); regOrder.push(y); rp.splice(rp.indexOf(y), 1); }
    // (the low figure sits low; the run up high)
    order.forEach(function (kd, i) { if (kd === "low") { var li = regOrder.findIndex(function (r) { return r[0] === "low"; }); if (li >= 0 && li !== i) { var t = regOrder[i]; regOrder[i] = regOrder[li]; regOrder[li] = t; } } });
    var segs = [];
    function rhythmOf(kind) {
      var cell = RR[kind] || RR.walk, out = [], t = 0;
      for (var b = 0; b < G; b++) cell.forEach(function (d) { out.push({ beat: t, beats: d }); t += d; });
      return out;
    }
    function strongAt(b) { var x = ((b % bar) + bar) % bar; return x < EPS || Math.abs(b / chordLen - Math.round(b / chordLen)) < EPS; }
    function sm(d) { return semi(mode, d, 0); }
    // the fit of one segment against another written one: at every onset of either
    function pairFit(a, b) {
      var beats = {}, res = { strong: 0, weak: 0, parallels: 0, unisons: 0, onsets: 0 };
      a.notes.concat(b.notes).forEach(function (n) { beats[r3(n.beat)] = true; });
      var bs = Object.keys(beats).map(Number).sort(function (x, y) { return x - y; }), prev = null;
      function at(seg, t) { for (var i = 0; i < seg.notes.length; i++) { var n = seg.notes[i]; if (n.beat <= t + EPS && t < n.beat + n.beats - EPS) return n; } return null; }
      bs.forEach(function (t) {
        var x = at(a, t), y = at(b, t); if (!x || !y) return;
        res.onsets++;
        var ic = Math.abs(sm(x.deg) - sm(y.deg)) % 12, dis = ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6;
        if (dis) { if (strongAt(t)) res.strong++; else res.weak++; }
        if (ic === 0) res.unisons++;
        if (prev) {
          var m1 = sm(x.deg) - sm(prev.x.deg), m2 = sm(y.deg) - sm(prev.y.deg), i1 = Math.abs(sm(prev.x.deg) - sm(prev.y.deg)) % 12;
          if (m1 && m2 && (m1 > 0) === (m2 > 0) && i1 === ic && (ic === 0 || ic === 7)) res.parallels++;
        }
        prev = { x: x, y: y };
      });
      return res;
    }
    var RS = F.fork("search");
    for (var si = 0; si < k; si++) {
      var rh = rhythmOf(order[si]), center = base + regOrder[si][1], Rsi = RS.fork("seg:" + si), bestSeg = null;
      for (var tr = 0; tr < 260; tr++) {
        var degs = [], ok = true;
        rh.forEach(function (n, i) {
          var ch = chordAtBeat(n.beat), strong = strongAt(n.beat), pool = [];
          for (var d = Math.max(center - 4, base - 3); d <= Math.min(center + 4, base + 7); d++) {   // (the whole round inside sol-below to do-above)
            if (classes.indexOf(cls(d)) < 0) continue;
            var inCh = ch.tones.some(function (t) { return t[0] === cls(d); });
            var w = inCh ? 1 : strong ? 0 : 0.35;
            if (!w) continue;
            if (i > 0) { var iv = Math.abs(d - degs[i - 1]); w *= iv === 0 ? 0.5 : iv === 1 ? 1.4 : iv === 2 ? 1 : iv <= 4 ? 0.35 : 0.04; if (Math.abs(sm(d) - sm(degs[i - 1])) === 6) w = 0; if (!inCh && iv !== 1) w *= 0.1; }
            w *= Math.exp(-Math.abs(d - center) / 3);
            if (w > 0) pool.push([d, w]);
          }
          if (!pool.length) { ok = false; pool.push([center, 1]); }
          degs.push(pickW(Rsi, pool));
        });
        // the cost: singability, the ground, the segments already written, the joins
        var c = ok ? 0 : 50, notes = rh.map(function (n, i) { return { beat: n.beat, beats: n.beats, deg: degs[i] }; });
        for (var i = 1; i < degs.length; i++) {
          var a = Math.abs(degs[i] - degs[i - 1]);
          if (a >= 4) c += 1.5 * (a - 3);
          if (i + 1 < degs.length && a >= 3 && Math.sign(degs[i + 1] - degs[i]) === Math.sign(degs[i] - degs[i - 1])) c += 1;
          if (a === 0 && i > 1 && degs[i - 1] === degs[i - 2]) c += 0.8;
          var ch2 = chordAtBeat(rh[i].beat), inC = ch2.tones.some(function (t) { return t[0] === cls(degs[i]); });
          if (!inC && !(Math.abs(degs[i] - degs[i - 1]) === 1 && i + 1 < degs.length && Math.abs(degs[i + 1] - degs[i]) === 1)) c += 2;
        }
        var distinct = {}; degs.forEach(function (d) { distinct[d] = 1; }); if (Object.keys(distinct).length < Math.min(3, degs.length)) c += 2;
        var me = { notes: notes };
        segs.forEach(function (o) { var f = pairFit(me, o); c += f.strong * 14 + f.weak * 1.6 + f.parallels * 2.5 + f.unisons * 1.6; });
        // the joins: this segment's first note after the last one's end; the round goes back to the top
        if (si > 0) { var pe = segs[si - 1].notes[segs[si - 1].notes.length - 1].deg, jj = Math.abs(degs[0] - pe); c += jj > 4 ? 3 * (jj - 4) : 0; if (Math.abs(sm(degs[0]) - sm(pe)) === 6) c += 8; }
        if (si === k - 1) { var f0 = segs[0].notes[0].deg, jl = Math.abs(f0 - degs[degs.length - 1]); c += jl > 4 ? 3 * (jl - 4) : 0; if (Math.abs(sm(f0) - sm(degs[degs.length - 1])) === 6) c += 8; }
        c += u01(Rsi) * 0.2;
        if (!bestSeg || c < bestSeg.c) bestSeg = { c: c, notes: notes };
      }
      segs.push(bestSeg);
    }
    // THE FIT CHECK — every pair of segments that ever sounds together
    var pairs = [];
    for (var a1 = 0; a1 < k; a1++) for (var b1 = a1 + 1; b1 < k; b1++) {
      var f = pairFit(segs[a1], segs[b1]), dist = Math.min(b1 - a1, k - (b1 - a1));
      pairs.push({ a: a1 + 1, b: b1 + 1, distance: dist, strong: f.strong, weak: f.weak, parallels: f.parallels, unisons: f.unisons, onsets: f.onsets,
                   ok: f.strong === 0 && f.weak <= 2 && f.parallels <= 1 && f.unisons <= Math.ceil(f.onsets * 0.34) });
    }
    var byEntries = {}, maxOk = 1;
    for (var nE = 2; nE <= k; nE++) {
      var need = pairs.filter(function (p) { return p.distance < nE; }), good = need.every(function (p) { return p.ok; });
      byEntries[nE] = good;
      if (good && maxOk === nE - 1) maxOk = nE;
    }
    // the Score: each segment a Line over the ground; one syllable a note
    var sylAt = 0, lines = segs.map(function (sg, i) {
      var S = sg.notes.map(function (n, j) { return { beat: n.beat, beats: n.beats, deg: n.deg, monzo: [0, 0, 0, 0], tie: false, fermata: false, syl: sylAt + j, stress: strongAt(n.beat) ? 1 : 0, nct: null, ornament: null }; });
      sylAt += S.length;
      var parts = { S: S }, chords = copy(groundChords);
      tuneLineParts(mode, parts, chords);
      var l = { notes: parts, cadence: { kind: "none", beat: S[S.length - 1].beat }, chords: chords, peak: false, breathAfter: false, fermataBeats: [], startBeat: i * segLen, barStart: 0,
                plan: { letter: String.fromCharCode(65 + i), role: "segment", rhythm: order[i], register: regOrder[i][0] } };
      return K.Score && K.Score.line ? K.Score.line(l) : l;
    });
    var top = -1e9, tl = 0; lines.forEach(function (l, i) { l.notes.S.forEach(function (n) { if (n.deg > top) { top = n.deg; tl = i; } }); }); lines[tl].peak = true;
    var named = nameOf(R.fork("naming:round"));
    var h = {
      id: opts.id || "h:0:1", number: named.number, nameDs: named.nameDs, provenance: "colony", source: null,
      meter: lines.map(function (l) { return l.notes.S.length; }).join("."), form: "round" + k, dialect: D.id, mode: mode, keyMonzo: keyMonzo, modeOfTime: time,
      beatS: r3(T.beatS * (D.tempo || 1) * (H ? H.tempo : 1) * (D.id === "psalmody" ? 1.15 : 1)), melodyPart: "S", lines: lines, refrain: null, verses: [],
    };
    if (K.Score && K.Score.hymn) h = K.Score.hymn(h);
    h.round = { segments: k, entries: maxOk, byEntries: byEntries, delayBeats: segLen, delayBars: G, ground: ground.slice(), pairs: pairs,
                fits: maxOk >= 2 };
    h.nameEn = named.nameEn;
    h.hymnist = H ? Hs.card(H) : null;
    var fp = fingerprint(h), problems = K.Score && K.Score.validateHymn ? K.Score.validateHymn(h) : [];
    var span = fp.rangeSemi.S;
    h.report = { frame: { dialect: D.id, meter: h.meter, form: h.form, modeOfTime: time, mode: mode, keySemi: keySemi, ground: ground.join("–") },
                 fingerprint: fp, checks: [
                   { name: "valid Score", ok: !problems.length, detail: problems.length ? problems.slice(0, 3).join("; ") : "kolob-score.js validates it", hard: true },
                   { name: "a round that fits", ok: maxOk >= 2, detail: "sings as a canon in " + (maxOk >= 2 ? "up to " + maxOk + " entries" : "no entries") + " over the ground " + ground.join("–") + "; " +
                       pairs.map(function (p) { return p.a + "+" + p.b + (p.ok ? " ✓" : " ✗") + " (" + p.strong + " strong clashes, " + p.weak + " passing, " + p.parallels + " parallels)"; }).join(", "), hard: true },
                   { name: "singable range", ok: span <= 17, detail: span + " semitones for the whole round", hard: true },
                 ] };
    return h;
  }

  // ==========================================================================
  // A GIVEN TUNE, SET IN A DIALECT — the wandering refrain sung after a hymn
  // in that hymn's dialect and key; a tune already written, harmonized anew
  // ==========================================================================
  // src: a Hymn (its melody part's notes and each line's plan); opts:
  // { dialect, keyMonzo, hymnist, id }. The tune keeps its notes; it moves by
  // whole octaves to lie in the new melody part's compass on the new key.
  function kindFor(D, kind, role) {
    if (D.parts.length === 1) return "none";
    var open = D.id === "sacredharp" || D.id === "psalmody";
    if (open) return role === "home" ? "openfifth" : kind === "half" ? "half" : kind === "imperfect" ? "imperfect" : "openfifth";
    if (kind === "openfifth") return role === "home" ? "authentic" : "imperfect";
    if (kind === "none") return role === "home" ? "authentic" : "half";
    return kind;
  }
  function setTune(stream, src, opts) {
    opts = opts || {};
    var R = stream, D = K.Dialects.get(opts.dialect || src.dialect), Hs = K.Hymnists;
    var H = Hs ? (opts.hymnist ? Hs.byId(opts.hymnist) : Hs.draw(R.fork("hymnist"), D.id)) : null;
    var keyMonzo = (opts.keyMonzo || src.keyMonzo || [0, 0, 0, 0]).slice(0, 4), keySemi = Math.round(mzCents(keyMonzo) / 100);
    var mode = src.mode, time = src.modeOfTime, T = TIMES[time] || TIMES["4/4"], smp = src.melodyPart;
    var all = src.lines.concat(src.refrain || []), nV = src.lines.length;
    // the octave: the tune's notes against the new melody part's compass on this key
    var degs = []; all.forEach(function (l) { l.notes[smp].forEach(function (n) { degs.push(n.deg); }); });
    var mp = D.melodyPart, rng = D.ranges[mp], shift = 0, bc = 1e9;
    for (var o = -2; o <= 2; o++) {
      var lo = keySemi + semi(mode, Math.min.apply(null, degs) + 7 * o, 0), hi = keySemi + semi(mode, Math.max.apply(null, degs) + 7 * o, 0);
      var c = Math.max(0, rng[0] - lo) * 2 + Math.max(0, hi - rng[1]) * 2 + Math.abs((lo + hi) / 2 - (D.tess[mp][0] + D.tess[mp][1]) / 2) * 0.1;
      if (c < bc) { bc = c; shift = 7 * o; }
    }
    var baseSrc = 0, top = -1e9, topLine = 0;
    all.forEach(function (l, i) { l.notes[smp].forEach(function (n) { if (n.deg > top) { top = n.deg; topLine = i; } }); });
    var foot = METERS[src.meter] ? METERS[src.meter].foot : "iamb";
    var fr = { meter: src.meter, time: time, mode: mode, form: String(src.form || "").replace(/R$/, ""), refrain: src.refrain ? src.refrain.map(function (l) { return l.notes[smp].filter(function (n) { return n.syl !== null; }).length; }) : null,
               foot: foot, lines: src.lines.map(function (l) { return l.notes[smp].filter(function (n) { return n.syl !== null; }).length; }), kind: null };
    var totalSyl = 0; fr.lines.forEach(function (x) { totalSyl += x; });
    var sylBefore = [], acc = 0;
    var sk = { base: shift, floor: Math.min.apply(null, degs) + shift, peak: top + shift, peakTo: top, span: top - Math.min.apply(null, degs), peakLine: topLine, classes: TUNE_CLASSES[mode],
               wantAt: 0.68, totalSyl: totalSyl, sylBefore: sylBefore,
               lines: all.map(function (l, i) {
                 var P = l.plan || {}, role = P.role || (i === all.length - 1 ? "home" : "open");
                 sylBefore.push(i < nV ? acc : 0); if (i < nV) acc += fr.lines[i];
                 return { i: i, refrain: i >= nV, role: role, syl: l.notes[smp].filter(function (n) { return n.syl !== null; }).length, cadence: kindFor(D, P.cadence || l.cadence.kind, role),
                          full: false, bare: false, targetClass: P.targetClass != null ? P.targetClass : 0, plan: D.id === "tabernacle" && P.via === "tonicize" ? "tonicize" : null,
                          figure: P.figure || "fall", contour: P.contour || "arch", peak: i === topLine, letter: (P.letter || "A").replace("'", ""), prime: /'/.test(P.letter || ""),
                          fermDie: 1, die: R.fork("line:" + i), copyOf: null };
               }) };
    var rh = all.map(function (l, i) {
      var mel = l.notes[smp], first = null; mel.forEach(function (n) { if (n.syl !== null && first == null) first = n.syl; });
      var next = all[i + 1], len = next && next.startBeat != null && l.startBeat != null && i + 1 !== nV ? next.startBeat - l.startBeat : (K.Score && K.Score.lineLength ? K.Score.lineLength(l) : mel[mel.length - 1].beat + mel[mel.length - 1].beats);
      var sy = -1;
      return { notes: mel.map(function (n) { if (n.syl !== null) sy = n.syl - first; return { beat: n.beat, beats: n.beats, syl: sy, stress: n.stress, cont: n.syl === null }; }),
               len: len, pickup: 0, barStart: l.barStart || 0, cell: (l.plan && l.plan.cell) || "even" };
    });
    var mel = all.map(function (l, i) {
      var d = l.notes[smp].map(function (n) { return n.deg + shift; }), pk = -1;
      if (i === topLine) d.forEach(function (x, j) { if (x === top + shift && pk < 0) pk = j; });
      return { degs: d, peakIdx: pk, cost: 0, topSpread: 0 };
    });
    var harm = harmonizeTune(fr, sk, rh, mel, D, H, R.fork("harmony"), keySemi);
    var built = buildScore(fr, sk, rh, mel, harm, D, H, R, opts, keyMonzo);
    var h = { id: opts.id || src.id || "h:0:1", number: src.number, nameDs: src.nameDs, provenance: src.provenance || "colony", source: src.source || null,
              meter: src.meter, form: src.form, dialect: D.id, mode: mode, keyMonzo: keyMonzo, modeOfTime: time,
              beatS: r3(T.beatS * D.tempo * (H ? H.tempo : 1)), melodyPart: mp, lines: built.lines, refrain: built.refrain, verses: [] };
    if (D.voiceOrder) h.voiceOrder = D.voiceOrder.slice();
    if (harm.drone) h.drone = harm.drone;
    if (K.Score && K.Score.hymn) h = K.Score.hymn(h);
    h.nameEn = src.nameEn; h.hymnist = H ? Hs.card(H) : null;
    h.setFrom = { id: src.id, dialect: src.dialect, octave: shift / 7 };
    return h;
  }

  // ==========================================================================
  // THE PARTNER HYMN — the closing hymn written on the first hymn's chords
  // and meter, so that in its last verse the organ (or a cornet) can play the
  // first hymn against it and the two turn out to be one piece (PLAN §14,
  // item 2: the quodlibet that ends Bach's Goldberg; Ives laying tunes on top
  // of each other). The new tune is searched note by note against the old
  // one's chord at each beat and against its tune; its harmony is the first
  // hymn's chords, voiced anew. Then a STRICT fit check hears the two tunes
  // together; if they do not fit, the closing hymn is composed on its own and
  // they are not combined — a loose fit is mud.
  // ==========================================================================
  function chordIn(line, beat) { var c = null; (line.chords || []).forEach(function (x) { if (x.beat <= beat + EPS) c = x; }); return c; }
  function noteIn(arr, beat) { for (var i = 0; i < arr.length; i++) { var n = arr[i]; if (n.beat <= beat + EPS && beat < n.beat + n.beats - EPS) return n; } return null; }
  // the fit of two hymns sung together, line by line: every onset of either tune
  // THE FIRST TUNE, RETUNED to the second's chords: in the combined verse the
  // organ plays the first hymn's tune over the ward's harmony of the second,
  // so each of its notes takes the pitch the chord sounding under it asks for
  // (a note the chord lacks keeps its spelling) — exact ratios, one tuning
  function retuneTo(h1, h2) {
    var L1 = h1.lines.concat(h1.refrain || []), L2 = h2.lines.concat(h2.refrain || []), mode = h1.mode;
    return L1.map(function (a, i) {
      var b = L2[i];
      return a.notes[h1.melodyPart].map(function (n) {
        var o = { beat: n.beat, beats: n.beats, deg: n.deg, syl: n.syl, stress: n.stress, tie: n.tie };
        if (n.alt) o.alt = n.alt;
        var ch = b ? chordIn(b, n.beat) : null, tt = ch && ch.tones ? (ch.ring ? tuneChordTones7(mode, ch.tones) : null) || tuneChordTones(mode, ch.tones) : null;
        var r = tuneNote(mode, { deg: n.deg, alt: n.alt || 0, nct: null }, tt);
        o.monzo = r.monzo; o.comma = r.comma;
        return o;
      });
    });
  }
  function fitTogether(h1, h2) {
    var L1 = h1.lines.concat(h1.refrain || []), L2 = h2.lines.concat(h2.refrain || []), mode = h1.mode;
    var re = retuneTo(h1, h2);
    var r = { lines: L1.length, onsets: 0, strong: 0, weak: 0, parallels: 0, unisons: 0, nonChord: 0, sour: 0, misaligned: 0, where: [] };
    if (L1.length !== L2.length || h1.modeOfTime !== h2.modeOfTime || h1.mode !== h2.mode || String(h1.keyMonzo) !== String(h2.keyMonzo)) { r.misaligned = 99; r.where.push("the two hymns are not in one meter, mode of time, mode and key"); }
    var JUSTC = { 0: 0, 3: 315.64, 4: 386.31, 5: 498.04, 7: 701.96, 8: 813.69, 9: 884.36 };
    L1.forEach(function (a, i) {
      var b = L2[i]; if (!b) return;
      var lenA = K.Score ? K.Score.lineLength(a) : 0, lenB = K.Score ? K.Score.lineLength(b) : 0;
      if (Math.abs((a.startBeat || 0) - (b.startBeat || 0)) > EPS || Math.abs(lenA - lenB) > EPS) { r.misaligned++; if (r.where.length < 6) r.where.push("line " + (i + 1) + " does not line up"); return; }
      var m1 = re[i], m2 = b.notes[h2.melodyPart], beats = {}, prev = null, bar = TIMES[h1.modeOfTime] ? TIMES[h1.modeOfTime].bar : 4;
      m1.concat(m2).forEach(function (n) { beats[r3(n.beat)] = true; });
      Object.keys(beats).map(Number).sort(function (x, y) { return x - y; }).forEach(function (t) {
        var x = noteIn(m1, t), y = noteIn(m2, t); if (!x || !y) return;
        r.onsets++;
        var cents = mzCents(y.monzo) - mzCents(x.monzo), ic = ((Math.round(cents / 100) % 12) + 12) % 12, pos = (((t + (a.barStart || 0)) % bar) + bar) % bar;
        var strong = pos < EPS || (bar === 4 && Math.abs(pos - 2) < EPS) || (bar === 6 && Math.abs(pos - 3) < EPS);
        var dis = ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6;
        if (dis) { if (strong) { r.strong++; if (r.where.length < 6) r.where.push("line " + (i + 1) + " beat " + t + ": a " + (ic === 6 ? "tritone" : ic <= 2 ? "second" : "seventh") + " on the beat"); } else r.weak++; }
        if (ic === 0) r.unisons++;
        // (each tune on the beat stands in the harmony that is sung: the second hymn's chord)
        var ch = chordIn(b, t);
        var inCh = function (z) { return ch && ch.tones && !z.nct && ch.tones.some(function (tt) { return tt[0] === cls(z.deg) && (tt[1] || 0) === (z.alt || 0); }); };
        // (two chord tones are tuned by one chord: every consonance between them just; a
        // passing note is sung as it passes, and a consonance it makes by the way is not held to that)
        var red = ((cents % 1200) + 1200) % 1200;
        if (JUSTC[ic] != null && inCh(x) && inCh(y) && Math.min(Math.abs(red - JUSTC[ic]), Math.abs(red - 1200 - JUSTC[ic])) > 6) { r.sour++; if (r.where.length < 6) r.where.push("line " + (i + 1) + " beat " + t + ": a sour " + ic + " (" + Math.round(red) + " c)"); }
        [[y, "the new tune"], [x, "the first tune"]].forEach(function (q) {
          var z = q[0];
          if (strong && ch && ch.tones && !z.nct && Math.abs(z.beat - t) < EPS && !ch.tones.some(function (tt) { return tt[0] === cls(z.deg) && (tt[1] || 0) === (z.alt || 0); })) { r.nonChord++; if (r.where.length < 6) r.where.push("line " + (i + 1) + " beat " + t + ": " + q[1] + " off the chord " + ch.roman); }
        });
        if (prev) {
          var mv1 = mzCents(x.monzo) - mzCents(prev.x.monzo), mv2 = mzCents(y.monzo) - mzCents(prev.y.monzo);
          if (Math.abs(mv1) > 1 && Math.abs(mv2) > 1 && (mv1 > 0) === (mv2 > 0) && prev.ic === ic && (ic === 0 || ic === 7)) r.parallels++;
        }
        prev = { x: x, y: y, ic: ic };
      });
    });
    r.unisonShare = r.onsets ? r3(r.unisons / r.onsets) : 0;
    r.pass = !r.misaligned && r.strong === 0 && r.nonChord === 0 && r.sour === 0 && r.parallels <= 2 && r.weak <= Math.max(3, Math.round(r.lines * 1.5)) && r.unisonShare <= 0.3;
    r.score = r.misaligned * 50 + r.strong * 10 + r.nonChord * 6 + r.sour * 4 + r.parallels * 2 + r.weak + r.unisons * 0.2;
    return r;
  }
  // the first hymn's constraints, line by line, for the partner's search and harmony
  function partnerPlan(first) {
    var L1 = first.lines.concat(first.refrain || []), mode = first.mode;
    return L1.map(function (l) {
      var m = l.notes[first.melodyPart];
      return {
        line: l, len: K.Score ? K.Score.lineLength(l) : 0, startBeat: l.startBeat || 0, barStart: l.barStart || 0,
        classesAt: function (beat) { var c = chordIn(l, beat); if (!c || !c.tones) return null; var o = {}; c.tones.forEach(function (t) { if (!t[1]) o[t[0]] = true; }); return o; },
        nameAt: function (beat) { var c = chordIn(l, beat); return c ? c.name || null : null; },
        melAt: function (beat) { var n = noteIn(m, beat); return n ? semi(mode, n.deg, n.alt || 0) : null; },
        cadence: l.cadence, cadenceTones: (function () { var c = chordIn(l, l.cadence.beat); return c && c.tones ? c.tones.filter(function (t) { return !t[1]; }).map(function (t) { return t[0]; }) : null; })(),
        tuneEnd: (function () { for (var q = m.length - 1; q >= 0; q--) if (m[q].stress && m[q].syl !== null) return cls(m[q].deg); return 0; })(),
      };
    });
  }
  function partner(stream, first, opts) {
    opts = opts || {};
    var tries = opts.tries || 6, bestTry = null, dialect = opts.dialect || first.dialect;
    if (!METERS[first.meter] || !first.lines || !first.lines.length) return { hymn: null, combined: false, fit: { pass: false, where: ["the first hymn is not a composed hymn in a known meter"] } };
    for (var t = 0; t < tries; t++) {
      // (the later tries take the first hymn's own rhythm, line for line: the
      // two tunes then move note against note, and no chord changes under a held note)
      var h2 = compose(t ? stream.fork("partner:" + t) : stream, { dialect: dialect, meter: first.meter, modeOfTime: first.modeOfTime, mode: first.mode, keyMonzo: first.keyMonzo,
                                                                     hymnist: opts.hymnist, id: opts.id, others: [first], _partner: first, _partnerRhythm: t >= Math.ceil(tries / 2) });
      var fit = fitTogether(first, h2);
      // (a partner is also a hymn: one that fails its own editor's checks is not combined either)
      var own = h2.report.checks.filter(function (c) { return c.hard && !c.ok; }).map(function (c) { return c.name; });
      if (own.length) { fit.pass = false; fit.score += 20 * own.length; fit.where = fit.where.concat(own.map(function (n) { return "the closing hymn fails its own check: " + n; })); }
      if (!bestTry || fit.score < bestTry.fit.score) bestTry = { h: h2, fit: fit, t: t };
      if (fit.pass) break;
    }
    if (bestTry.fit.pass) {
      // (the first tune as the organ or the cornet plays it against this one in the last verse)
      bestTry.h.partner = { of: first.id, combined: true, tries: bestTry.t + 1, fit: bestTry.fit, firstTune: retuneTo(first, bestTry.h) };
      return { hymn: bestTry.h, combined: true, fit: bestTry.fit };
    }
    // not combined: the closing hymn composed on its own (the meter kept, so it may still answer the first)
    var alone = compose(stream.fork("partner:alone"), { dialect: dialect, meter: first.meter, keyMonzo: first.keyMonzo, hymnist: opts.hymnist, id: opts.id, others: [first] });
    alone.partner = { of: first.id, combined: false, tries: tries, fit: bestTry.fit };
    return { hymn: alone, combined: false, fit: bestTry.fit };
  }

  // ==========================================================================
  // THE WANDERING REFRAIN — two lines in the camp-meeting lilt that belong to
  // the meeting rather than to any hymn (PLAN §15, item 4; Cane Ridge, 1801:
  // how PROMISED LAND got "I am bound for the promised land"). It will be
  // sung after the first hymn, again after a later one in that hymn's key and
  // dialect, and in the doxology — so its compass and its close must sit well
  // in EVERY key of the day's hymns. The engine places it; this writes it.
  // ==========================================================================
  var REFRAIN_PROFILE = {
    meters: { "88": 2, "86": 1.4, "77": 1.2 }, times: { "6/8": 2.4, "3/4": 1.3, "4/4": 0.8 },
    extraForms: { 2: { "AA'": 2.2 } }, forms: { AB: 1, "AA'": 1 },
    cells: { dotted: 2.6, dotS: 1.8, even: 1, long: 1.2, slurU: 0.5, slurS: 0.3 }, cellRate: 0.7,
    // (a compass that sits round its final — sol below to la above — so that
    // it lies well in every key of the day: a key a fourth up or down only
    // moves where in the singers' voices the same shape sits)
    refrains: 0, alwaysRefrain: false, tag: false, amen: false, range: [6, 6], maxSpan: 6, floorMin: -3, floorMax: -2, peakTo: { 4: 1.6, 5: 1.2, 3: 0.6 },
    fermata: 0, figureRepair: true, kinds: null, kindMeters: null, kindForms: null, droneRate: null,
    // (and it comes home from below — ti–do, la–ti–do, sol–do — the camp
    // meeting's shout, which also keeps its compass round its final)
    figures: { rise: 2, climb: 1.6, fifth: 1.6, turn: 1.4, fall: 0.8, three: 0.8, again: 0.3 },
  };
  function keyFit(h, keys) {
    var D = K.Dialects.get(h.dialect), mp = h.melodyPart, rng = D.ranges[mp], tess = D.tess[mp];
    var degs = []; h.lines.forEach(function (l) { l.notes[mp].forEach(function (n) { degs.push(n.deg); }); });
    var lo0 = semi(h.mode, Math.min.apply(null, degs), 0), hi0 = semi(h.mode, Math.max.apply(null, degs), 0), fin = semi(h.mode, h.lines[h.lines.length - 1].notes[mp].slice(-1)[0].deg, 0);
    // (the tune's notes are counted from its final; in a key, the final stands
    // on that key's own pitch — in the octave that suits the part best)
    return keys.map(function (km) {
      var ks = Math.round(mzCents(km) / 100), best = null;
      for (var o = -2; o <= 2; o++) {
        var lo = ks + lo0 + 12 * o, hi = ks + hi0 + 12 * o, f = ks + fin + 12 * o;
        var fits = lo >= rng[0] && hi <= rng[1], comfy = f >= tess[0] - 3 && f <= tess[1];
        var c = (fits ? 0 : 10) + (comfy ? 0 : 3) + Math.abs((lo + hi) / 2 - (tess[0] + tess[1]) / 2) * 0.1;
        if (!best || c < best.c) best = { c: c, keyMonzo: km.slice(), keySemi: ks, octave: o, lo: lo, hi: hi, final: f, fits: fits, closeInTess: comfy };
      }
      delete best.c; return best;
    });
  }
  // THE ROOM THE DAY'S KEYS LEAVE A REFRAIN (round 3, second pass; the
  // critic's fix). A key a fourth up and a key a fifth up put the refrain's
  // final on three different notes of the singers' voices — do, fa and sol
  // of the day — and the part that sings the tune has only so much voice: the
  // quartet's lead (dialect D) sings from sol below the keynote to do above
  // it, so a refrain in the key a fifth up can climb only a fourth over its
  // final before the lead runs out. So before a note is drawn, the compass is
  // measured against every key: how far under its final the tune may go (sol,
  // la or ti below) and how far over (mi to la), such that in each key some
  // octave puts the final where the part sings comfortably and the whole
  // tune inside the part's compass. → { pairs: [[floor, peak, weight]], all }
  // (steps from the final; `all` when the day's keys leave the lilt's whole
  // compass free, and the refrain is drawn exactly as before)
  function refrainRoom(D, keys, mode, homeSemi) {
    var mp = D.melodyPart, rng = D.ranges[mp], tess = D.tess[mp], classes = TUNE_CLASSES[mode] || TUNE_CLASSES.ionian;
    function sits(a, b) {
      return keys.every(function (km) {
        var ks = Math.round(mzCents(km) / 100) - homeSemi;
        for (var o = -3; o <= 3; o++) {
          var f = homeSemi + ks + 12 * o;
          if (f >= tess[0] - 3 && f <= tess[1] && f - a >= rng[0] && f + b <= rng[1]) return true;
        }
        return false;
      });
    }
    var pairs = [], all = true, PW = { 5: 1.2, 4: 1.6, 3: 0.6, 2: 0.4 }, FW = { "-3": 1.6, "-2": 1, "-1": 0.6 };
    for (var fl = -3; fl <= -1; fl++) for (var pk = 2; pk <= 5; pk++) {
      if (classes.indexOf(cls(fl)) < 0 || classes.indexOf(cls(pk)) < 0) continue;
      var ok = sits(-semi(mode, fl, 0), semi(mode, pk, 0));
      // (the lilt's own compass: sol or la below, fa to la above)
      if (!ok && fl <= REFRAIN_PROFILE.floorMax && fl >= REFRAIN_PROFILE.floorMin && pk >= 3) all = false;
      if (ok) pairs.push([fl, pk, PW[pk] * FW[fl]]);
    }
    return { pairs: pairs, all: all };
  }
  function wanderingRefrain(stream, opts) {
    opts = opts || {};
    var keys = opts.keys && opts.keys.length ? opts.keys : [[0, 0, 0, 0]], dialect = opts.dialect || "gospel", tries = opts.tries || 8, best = null;
    // (the compass first: where the day's keys leave the lilt its whole room,
    // the profile is the lilt's own; where they do not, each try draws a
    // compass that sits in every key — a peak and a floor — and keeps to it)
    var D0 = K.Dialects.get(dialect) || K.Dialects.get("gospel"), mode0 = opts.mode && SEMIS[opts.mode] ? opts.mode : null;
    var roomOf = {}, homeSemi = Math.round(mzCents(keys[0]) / 100);
    for (var t = 0; t < tries; t++) {
      var S = t ? stream.fork("refrain:" + t) : stream, prof = REFRAIN_PROFILE;
      // (the mode is the refrain's own draw, thrown as compose() throws it —
      // the hymnist's leaning on the dialect's table — so the room is measured
      // in the mode the refrain will be written in)
      var Hs = K.Hymnists, Hr = Hs ? (opts.hymnist ? Hs.byId(opts.hymnist) : Hs.draw(S.fork("hymnist"), D0.id)) : null;
      var mode = mode0 || pickW(S.fork("frame").fork("mode"), weightsOf(D0.modes, Hr && Hr.modes));
      var room = roomOf[mode] || (roomOf[mode] = refrainRoom(D0, keys, mode, homeSemi));
      if (!room.all) {
        var pair = room.pairs.length ? pickW(S.fork("refrain:room"), room.pairs.map(function (p) { return [p, p[2]]; })) : [-1, 2];
        var sp = pair[1] - pair[0];
        prof = {}; for (var pk in REFRAIN_PROFILE) prof[pk] = REFRAIN_PROFILE[pk];
        prof.peakTo = {}; prof.peakTo[pair[1]] = 1; prof.floorMin = pair[0]; prof.floorMax = pair[0]; prof.range = [sp, sp]; prof.maxSpan = sp;
      }
      var h = compose(S, { dialect: dialect, mode: opts.mode, keyMonzo: keys[0], hymnist: opts.hymnist, id: opts.id, _profile: prof });
      var kf = keyFit(h, keys), all = kf.every(function (x) { return x.fits && x.closeInTess; });
      var bad = h.report.checks.filter(function (c) { return c.hard && !c.ok; }).length;
      var score = bad * 10 + kf.filter(function (x) { return !x.fits; }).length * 5 + kf.filter(function (x) { return !x.closeInTess; }).length;
      if (!best || score < best.score) best = { h: h, keys: kf, fits: all && !bad, score: score, t: t };
      if (all && !bad) break;
    }
    var span = best.h.report.fingerprint.rangeSemi[best.h.melodyPart];
    best.h.wandering = { keys: best.keys, fits: best.fits, compass: span, tries: best.t + 1 };
    return { hymn: best.h, keys: best.keys, fits: best.fits, compass: span };
  }
  // the refrain in another hymn's dialect and key (the same tune, harmonized anew)
  function refrainIn(stream, refrain, opts) {
    var src = refrain && refrain.hymn ? refrain.hymn : refrain;
    return setTune(stream, src, opts || {});
  }

  // ==========================================================================
  // THE REFERENCES AND THE SPREAD — what the checks are held to, and whether
  // the search has converged on one hymn
  // ==========================================================================
  // (the cadence mix is read from the notes: the share of line closes that
  // keep their third, that come to rest on home's chord, on the dominant's)
  var FP_KEYS = ["par5", "thirdless", "crossing", "chromatic", "sevenths", "leap", "melisma", "closeThird", "closeHome", "closeDom",
                 // (round 3: the bare unison close; the fuge's and the echo's silent parts; the ringing seventh's 7-limit notes; the Old Way's ornament marks)
                 "closeUnison", "stagger", "septimal", "ornament"];
  // the Earth tunes' fingerprints per dialect: each tune's, their mean, and
  // the dialect's stated tolerance (kolob-dialects.js)
  function references() {
    var out = {};
    if (!K.Dialects || !K.Tunes) return out;
    (K.Dialects.all || K.Dialects.names).forEach(function (name) {
      var D = K.Dialects.get(name), rows = [];
      D.refs.forEach(function (id) {
        var t = K.Tunes.byId(id);
        if (!t) return;
        // a dialect that sings the tune alone (the Old Way) is measured
        // against the Earth tunes' melodies alone
        if (D.parts.length === 1) {
          var only = {}; for (var k0 in t) only[k0] = t[k0];
          only.lines = t.lines.map(function (l) { var o = {}; for (var k1 in l) o[k1] = l[k1]; o.notes = {}; o.notes[t.melodyPart] = l.notes[t.melodyPart]; o.chords = []; return o; });
          only.refrain = null;
          t = only;
        }
        var f = fingerprint(t);
        rows.push({ id: id, share: f.share, melodyRange: f.melodyRange });
      });
      var mean = {};
      FP_KEYS.concat(["melodyRange"]).forEach(function (k) {
        var v = rows.map(function (r) { return k === "melodyRange" ? r.melodyRange : r.share[k]; });
        mean[k] = v.length ? r3(sum(v) / v.length) : 0;
      });
      out[name] = { tunes: rows, mean: mean, tolerance: D.tolerance };
    });
    return out;
  }
  // n hymns from n streams: how spread are their endings, contours, peaks,
  // meters — and their fingerprints, against the tolerance
  //   streamOf(i) → a stream; opts as compose's (a dialect fixed, say)
  // THE ENDING AS SUNG — the last two or three notes of the hymn's last line
  // (a tied note counted once), named from the final as if it were do: a
  // comma marks a note below the final (ti, is the leading tone under it).
  // The figure's NAME is not enough: 'fall' and 'three' both end re–do.
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  function sungEnding(h, k) {
    var all = h.lines.concat(h.refrain || []), last = all[all.length - 1], m = last.notes[h.melodyPart] || [], d = [];
    m.forEach(function (x, i) { if (i > 0 && m[i - 1].tie && m[i - 1].deg === x.deg) return; d.push(x.deg); });
    var fin = d[d.length - 1];
    return d.slice(-k).map(function (x) { return SOLF[cls(x - fin)] + (x < fin ? "," : x >= fin + 7 ? "'" : ""); }).join("–");
  }
  function spread(streamOf, n, opts) {
    var tally = { finalFigure: {}, lastTwo: {}, lastThree: {}, lineEnd: {}, contour: {}, meter: {}, form: {}, time: {}, cadence: {}, peakLine: {}, firstLine: {} };
    var fps = [], failures = {}, peaks = [];
    for (var i = 0; i < n; i++) {
      var h = compose(streamOf(i), opts);
      var rep = h.report;
      function inc(t, k) { tally[t][k] = (tally[t][k] || 0) + 1; }
      inc("meter", rep.frame.meter); inc("form", rep.frame.form); inc("time", rep.frame.modeOfTime);
      rep.lines.forEach(function (L, j) {
        inc("contour", L.contour); inc("cadence", L.cadence.split(" ")[0]);
        inc("lineEnd", L.target + ":" + L.figure);
        if (L.role === "home") inc("finalFigure", L.figure);
      });
      inc("lastTwo", sungEnding(h, 2)); inc("lastThree", sungEnding(h, 3));
      // the first line's actual notes, as a shape: does every hymn begin alike?
      var m = h.lines[0].notes[h.melodyPart].filter(function (x) { return x.syl !== null; }).map(function (x) { return x.deg; });
      inc("firstLine", intervals(m).slice(0, 4).join(","));
      inc("peakLine", rep.peak.line + "/" + (h.lines.length + (h.refrain ? h.refrain.length : 0)));
      peaks.push(rep.peak.at);
      fps.push(rep.fingerprint);
      rep.checks.forEach(function (c) { if (!c.ok) failures[c.name] = (failures[c.name] || 0) + 1; });
    }
    function summarize(t) {
      var tot = 0, top = null, topN = 0, k, H = 0;
      for (k in t) { tot += t[k]; if (t[k] > topN) { topN = t[k]; top = k; } }
      for (k in t) { var p = t[k] / tot; H -= p * Math.log2(p); }
      return { kinds: Object.keys(t).length, top: top, topShare: tot ? r3(topN / tot) : 0, entropyBits: r3(H), counts: t };
    }
    var mean = {};
    FP_KEYS.forEach(function (k) { mean[k] = r3(sum(fps.map(function (f) { return f.share[k]; })) / Math.max(1, fps.length)); });
    mean.melodyRange = r3(sum(fps.map(function (f) { return f.melodyRange; })) / Math.max(1, fps.length));
    var out = { n: n, mean: mean, failures: failures, peakAt: { min: r3(Math.min.apply(null, peaks)), max: r3(Math.max.apply(null, peaks)), mean: r3(sum(peaks) / Math.max(1, peaks.length)) } };
    for (var t in tally) out[t] = summarize(tally[t]);
    return out;
  }

  return {
    compose: compose, fingerprint: fingerprint, references: references, spread: spread, voiceLeading: voiceLeading,
    // (round 3) the round, the partner hymn, the wandering refrain, and a given tune set anew
    round: composeRound, partner: partner, fitTogether: fitTogether, wanderingRefrain: wanderingRefrain, refrainIn: refrainIn, setTune: setTune, keyFit: keyFit,
    METERS: METERS, FORMS: FORMS, TIMES: TIMES, MODES: MODES, FIGURES: FIGURES, CELLS: CELLS,
    // for the lab and the harness (pure helpers)
    semi: semi, spelledMonzo: spelledMonzo, doOf: function (mode) { return DO_OF[mode]; }, sharedRun: sharedRun, sungEnding: sungEnding, FP_KEYS: FP_KEYS,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-composer.js"] = true;   // the load guard's roll call
