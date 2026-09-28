// ============================================================================
// KOLOB engraving mockups — the shared passage (dev only; not loaded by the app)
//
// One fixed ~48-second passage that all three engraving mockups (A, B, C) print,
// so the owner compares notation, not music. It stands in for the future Score
// (PLAN-COMPOSITION §2.3): every event carries what the real Score will carry.
//
// Pitch: `deg` is a diatonic degree in the day's collection (ionian here),
// 0 = do = the tonic-root at middle C (the app's q=10), 7 = the octave above,
// -7 the octave below. `ratio` is the exact just-intonation ratio to do
// (as a string "n/d"; octaves folded in by `deg`). `comma` is a Johnston
// syntonic-comma mark (-1 = "−": the adaptive re 10/9 under the ii chord);
// `septimal` marks a 7-limit tone (Johnston "7").
// Time: `t` (onset) and `dur` in SECONDS from the passage start.
// ============================================================================
window.KOLOB_PASSAGE = (function () {
  "use strict";
  var BEAT = 0.9;            // the hymn's beat, seconds (♩ = 67)
  var T0 = 2.0;              // the pickup's onset
  var RATIO = ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"];
  function ratioOf(deg) { return RATIO[((deg % 7) + 7) % 7]; }

  // ---- the hymn: a C.M. (8.6.8.6) tune, lines 1–2, plus the amen ------------
  // Tabernacle dialect: melody in the soprano. Each chord = [S, A, T, B] degrees.
  // beats: onset (in beats from T0) and length. Words: "O come, ye Saints, to
  // Kolob's light / and sing the morning home" — set in Deseret, one per chord.
  var CHORDS = [
    // beat, len, S,  A,  T,  B,  roman,  syllable,  flags
    [0,  1,  4,  2,  0, -7, "I",   "𐐄",     {}],
    [1,  1,  7,  4,  2, -7, "I",   "𐐿𐐲𐑋",  { hyphen: false }],
    [2,  1,  7,  5,  2, -2, "vi",  "𐐷𐐨",   {}],
    [3,  1,  8,  5,  3, -6, "ii",  "𐑅𐐩𐑌𐐻𐑅", { commaS: -1 }],       // re sung as 10/9 (re−) over ii
    [4,  1,  9,  4,  0, -7, "I",   "𐐻𐐭",   {}],
    [5,  1,  8,  4, -1, -3, "V",   "𐐗𐐬",   { hyphenAfter: true }],   // Ko-
    [6,  1,  7,  5,  3, -4, "IV",  "𐑊𐐱𐐺𐑆", {}],                     // -lob's
    [7,  2,  8,  4,  1, -3, "V",   "𐑊𐐴𐐻",  { lineEnd: "half", breath: true }],
    [9,  1,  9,  4,  0, -7, "I",   "𐐰𐑌𐐼",  {}],
    [10, 1, 11,  7,  2, -7, "I",   "𐑅𐐮𐑍",  { peak: true }],
    [11, 1, 10,  7,  3, -4, "IV",  "𐑄𐐲",   {}],
    [12, 1,  9,  7,  4, -5, "I6",  "𐑋𐐫𐑉",  { hyphenAfter: true }],   // first inversion
    [13, 1,  8,  6,  3, -3, "V7",  "𐑌𐐮𐑍",  { septimalT: true }],      // the ringing seventh (7/4 over sol)
    [14, 3,  7,  4,  2, -7, "I",   "𐐸𐐬𐑋",  { lineEnd: "authentic", fermata: true }],
    [18, 2,  7,  5,  3, -4, "IV",  "𐐂",    { amen: true, hyphenAfter: true }],
    [20, 3,  7,  4,  2, -7, "I",   "𐑋𐐯𐑌",  { amen: true, fermata: true, final: true }],
  ];
  var PARTS = ["S", "A", "T", "B"];
  var notes = [];
  var syllables = [];
  CHORDS.forEach(function (c, ci) {
    var t = T0 + c[0] * BEAT, dur = c[1] * BEAT, fl = c[8];
    for (var p = 0; p < 4; p++) {
      var deg = c[2 + p];
      var n = { voice: "choir", part: PARTS[p], melody: p === 0, deg: deg, ratio: ratioOf(deg),
                t: t, dur: dur, beats: c[1], chord: ci, roman: c[6] };
      if (p === 0 && fl.commaS) { n.comma = fl.commaS; n.ratio = "10/9"; }
      if (p === 2 && fl.septimalT) { n.septimal = true; n.ratio = "7/4 of sol"; }
      if (fl.fermata) n.fermata = true;
      if (fl.lineEnd) n.lineEnd = fl.lineEnd;
      if (fl.amen) n.amen = true;
      notes.push(n);
    }
    syllables.push({ t: t, dur: dur, text: c[7], hyphenAfter: !!fl.hyphenAfter, amen: !!fl.amen, verse: ci === 0 ? 1 : null });
  });
  // barlines: 4/4 with a one-beat pickup → bars fall on beats 1, 5, 9, 13, 17(=rest), 18(amen)
  var bars = [1, 5, 9, 13].map(function (b) { return { t: T0 + b * BEAT, kind: "single" }; });
  bars.push({ t: T0 + 17 * BEAT, kind: "double" });            // end of the hymn lines
  bars.push({ t: T0 + 23 * BEAT, kind: "final" });              // after the amen
  var breaths = [{ t: T0 + 9 * BEAT - 0.12 }];                  // the comma between line 1 and 2
  var hymnHeader = { t: T0 - 0.4, number: "214", nameDs: "𐐗𐐄𐐢𐐉𐐒 𐐢𐐌𐐓", meter: "C.M.", dialect: "Tabernacle",
                     leaderDs: "𐐑. 𐐐𐐰𐑊", key: "do = C", time: "4/4" };

  // ---- the drone: the longa under everything --------------------------------
  var drone = { voice: "drone", deg: -14, ratio: "1/1", t: 0, dur: 48 };

  // ---- the telegraph: "ZION" keyed during the hymn's first line --------------
  var MORSE = { Z: "--..", I: "..", O: "---", N: "-." };
  var U = 0.07, tel = [], tt = 6.2;
  "ZION".split("").forEach(function (ch, li, arr) {
    var code = MORSE[ch];
    for (var k = 0; k < code.length; k++) {
      var dah = code[k] === "-";
      var last = k === code.length - 1;
      var gap = last ? (li === arr.length - 1 ? "e" : "l") : "i";
      tel.push({ dah: dah, at: tt - 6.2, len: (dah ? 3 : 1) * U, gap: gap, letter: ch, letterIndex: li });
      tt += (dah ? 3 : 1) * U + (gap === "i" ? 1 : gap === "l" ? 3 : 0) * U;
    }
  });
  var telegraph = { t: 6.2, marks: tel, word: "ZION", wordDs: "𐐞𐐴𐐲𐑌", dur: tt - 6.2 };

  // ---- the two bands: a visiting brass band crosses, in ITS OWN key and tempo --
  // Key: sol (a just fifth up, 3/2), march 2/4, beat 0.44 s. Degrees are in the
  // BAND's own key (0 = its do = G4). Engraved in ROUND notes on its own layer,
  // scrolling at its own rate. Loudness envelope: enters faint, crosses, recedes.
  var BAND_BEAT = 0.44, B0 = 9.0, band = [];
  var STRAIN = [ // [beat, len, deg]  — a sixteen-bar-ish strain fragment
    [0, 0.5, 0], [0.5, 0.5, 2], [1, 0.5, 4], [1.5, 0.5, 7], [2, 1, 6], [3, 0.5, 4], [3.5, 0.5, 5],
    [4, 0.5, 4], [4.5, 0.5, 2], [5, 0.5, 0], [5.5, 0.5, 2], [6, 1.5, 1], [7.5, 0.5, -1],
    [8, 0.5, 0], [8.5, 0.5, 2], [9, 0.5, 4], [9.5, 0.5, 7], [10, 1, 9], [11, 0.5, 7], [11.5, 0.5, 6],
    [12, 0.5, 5], [12.5, 0.5, 3], [13, 0.5, 1], [13.5, 0.5, 6], [14, 2, 7],
    [16, 0.5, 4], [16.5, 0.5, 4], [17, 1, 7], [18, 0.5, 6], [18.5, 0.5, 5], [19, 1, 4], [20, 0.5, 2], [20.5, 0.5, 3],
    [21, 1, 4], [22, 1, 0], [23, 1, 4], [24, 2, 0],
  ];
  STRAIN.forEach(function (s) {
    var t = B0 + s[0] * BAND_BEAT;
    var x = s[0] / 26;                                  // 0..1 through the crossing
    var loud = Math.sin(Math.PI * Math.min(1, Math.max(0, x)));  // swell and recede
    band.push({ voice: "band", deg: s[2], keyRatio: "3/2", t: t, dur: s[1] * BAND_BEAT, beats: s[1], loud: +loud.toFixed(2) });
  });
  // the band's bass: oom-pah on its own do and sol, an octave+ down
  for (var bb = 0; bb < 26; bb += 1) {
    band.push({ voice: "band", part: "bass", deg: (bb % 2 === 0) ? -7 : -3, keyRatio: "3/2",
                t: B0 + bb * BAND_BEAT, dur: 0.5 * BAND_BEAT, beats: 0.5,
                loud: +Math.sin(Math.PI * (bb / 26)).toFixed(2) });
  }
  var bandInfo = { t0: B0, t1: B0 + 26 * BAND_BEAT, beat: BAND_BEAT, time: "2/4", keyDs: "sol", tempoRatio: BEAT / BAND_BEAT };
  // ?band=0 in the page URL removes the visiting band (it fires in a minority
  // of meetings), so the owner can judge the page without it.
  var noBand = /[?&]band=0\b/.test((typeof location !== "undefined" && location.search) || "");
  if (noBand) { band = []; bandInfo.t0 = bandInfo.t1 = 1e6; bandInfo.off = true; }

  // ---- the Question: clarinet asks, harmonium answers, asks again (bent), silence
  var QB = 0.88, question = [], Q0 = 25.5;
  var ASK = [[4, 1.3], [5, 0.9], [8, 1.0], [6, 0.8], [8, 2.8]];     // sol la re' ti re'
  var BENT = [[4, 1.3], [5, 0.9], [8, 0.7], [7, 0.4], [6, 0.8], [8, 2.8]]; // the middle asking, bent
  function ask(t, figure, k) {
    figure.forEach(function (q) {
      question.push({ voice: "clarinet", role: "ask", asking: k, deg: q[0], ratio: ratioOf(q[0]), t: t, dur: q[1] * QB });
      t += q[1] * QB;
    });
    return t;
  }
  var qt = ask(Q0, ASK, 1);
  var ans = [[2, 0.5], [3, 0.45], [1, 0.4], [4, 0.6]];              // the answer: quick, low, restless
  var at = qt + 0.9;
  ans.forEach(function (a) { question.push({ voice: "harmonium", role: "answer", deg: a[0], ratio: ratioOf(a[0]), t: at, dur: a[1] }); at += a[1]; });
  qt = ask(at + 1.2, BENT, 2);
  var noAnswer = { t: qt, dur: 4.0 };                                // the empty measure: no answer comes

  // ---- a bell: one strike near the end --------------------------------------
  var bells = [{ voice: "bells", deg: 14, ratio: "1/1", t: 23.0, dur: 6.0 }];

  return {
    duration: 48,
    beat: BEAT,
    hymnHeader: hymnHeader,
    notes: notes,                // choir SATB, with part/melody/fermata/lineEnd/amen/comma/septimal
    syllables: syllables,        // Deseret, one per chord; hyphenAfter joins to the next
    bars: bars,
    breaths: breaths,
    drone: drone,
    telegraph: telegraph,        // marks: {dah, at (s from telegraph.t), len, gap i|l|e, letter}
    band: band,                  // round notes, own layer, own key (keyRatio 3/2) and tempo
    bandInfo: bandInfo,
    question: question,          // clarinet asks (asking 1 and 2) + harmonium answers
    noAnswer: noAnswer,
    bells: bells,
    // app constants the mockups should respect
    app: { scrollPxPerSec: 11, qMid: 10, ink: "#1e4d3b", paper: "#f5f0e4", gilt: "#8a7a45",
           rule: "rgba(30, 77, 59, 0.42)", plateWidth: 860 },
  };
})();
