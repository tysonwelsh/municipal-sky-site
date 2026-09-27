// ============================================================================
// KOLOB — kolob-question.js
// KOLOB.Question: THE UNANSWERED QUESTION, composed. Pure. (PLAN-COMPOSITION
// §8.1; the contract is SCORE.md.)
//
// After Charles Ives, 1908: a trumpet asks "the perennial question of
// existence"; the flutes try to answer, more frantically each time; the
// strings play on, oblivious. In v0.30 the colony had only ONE question —
// sol–la–re′–ti–re′ — asked four or five times, nearly always in the
// invocation, and it ran over its section. A congregation that asks the same
// thing every Sunday has stopped asking. So now each VISIT writes a bank of
// seven — the old phrase, kept whole as the ancestor, and six new ones
// composed in its spirit — and every meeting of that visit draws one of
// them, the one heard most recently stepping aside. Over an afternoon the
// visitor comes to know the colony's seven questions the way a ward knows
// its hymnbook, and hears them come round in other modes and other rooms.
//
// What "its spirit" means, made into rules a critic can check:
//   · five or six notes, RISING and ANGULAR (leaps, and at least one turn back);
//   · one leap of a SIXTH or SEVENTH — the stretch that makes it a question
//     and not a tune — and never a bugle's, from one tone of the tonic triad
//     to another: the old one's angularity lives on la and re′ and ti, the
//     tones that are not home;
//   · it ENDS HIGH and UNRESOLVED: on re, fa, la or ti (never do, mi or sol),
//     at la or above, the last note the highest or second-highest, and
//     never reached by a fall wider than a third;
//   · its rhythm is of the family LONG – short – short – LONG – held.
// And then a small EVALUATOR, the critic in the loft, turns away the bland:
// too stepwise, too few pitches, an arpeggio, a zigzag of great leaps, too
// like a sister in the bank or the old one — and, when a meeting draws,
// anything matching a line of that meeting's hymns (excludeLines).
//
// THE BANK IS WRITTEN ONCE, MODE-FREE. Its questions are written in the
// seven degrees (0 = do, 7 = do an octave up), lawful as written in all four
// diatonic modes. Each meeting has its own mode (§1.1), so at the draw each
// question is SPELLED into that mode and judged again there: the gapped
// scales (penta, hexa) have no fa or no ti, and a question that leans on the
// missing tone must find a lawful way round it — folding down, as v0.30's
// projDeg did, or stepping up — or sit this meeting out. Three of the six
// are written in the pentatonic itself and a fourth in the hexatonic, so
// they sing as written everywhere, and a Shaker Sunday still has questions
// to ask.
//
// THE ENDINGS ARE DRAWN FIRST. The last note is the one left hanging in the
// air, so the bank chooses its six endings before it composes anything —
// weighted by how unanswered each sounds over the drone (re′ the ninth
// most, then fa′ and ti, la′ and la least), no more than two sharing a
// class — and then writes toward them, every lawful way there equally
// likely. What the dice say is what is heard.
//
// Everything here is PURE: no AudioContext, no DOM, no Math.random, no clock.
// Every die comes from a PJ2.Rand stream the caller forks (SCORE §3):
//   question:bank                       — the visit's seven, once per seed
//   question:<n>:pick (:pace below it) · :bend · :answers · :ground · :seat
// Degrees are 7-degree spellings relative to the hymn's do, exactly as the
// old QDEGS were written; the performer seats them an octave above the
// choir root, as v0.30 did. Every note also carries its exact MONZO (SCORE
// §2), so nothing need be tuned by multiplication — v0.30's answer
// doublings were f × 1.5, and a fifth above ti or re is not in the scale.
// Here a doubling is a PURE interval taken inside the scale.
//
// Public surface: KOLOB.Question
//   bank(stream)                           → { questions:[Question ×7], stats }  (per visit; old one first)
//   eligible(bank, mode, {excludeLines})   → { pool:[Question spelled], out:[{index,id,why}] }
//   pick(bank, stream, {mode, recent, excludeLines}) → Question spelled in the mode, or null
//   askings(q, stream)                     → [Asking ×3]    (2nd bent, still lawful)
//   answers(q, k, material, stream, mode)  → Answer        (k = 0, 1, …)
//   ground(stream)                         → "drone" | "chorale"
//   chorale(material, stream, mode)        → { beatS, loopGapBeats, chords }  (the strings)
//   seat(stream, sections, {needS, naturalS}) → { section, index, capS, sectionS, … } | null
//   timeline(parts, {beatS, capS, tailS})  → { items, total, answers, pressure, fits, … }
//   compose(qStream, opts)                 → the whole meeting's event, every fork taken
//   rules(q) · evaluate(q, others, excludeLines) · spellIn · spell · monzo · cents · …
// ============================================================================

window.KOLOB = window.KOLOB || {};

window.KOLOB.Question = (function () {
  "use strict";

  // ==========================================================================
  // THE LATTICE — the six modes as monzos per 7-degree class (SCORE §2).
  // [a,b,c,d] = 2^a · 3^b · 5^c · 7^d. null = the class the gapped scale
  // lacks; SPELL folds it where v0.30's projDeg folds it (fa→mi, ti→la in
  // penta; ti→la in hexa), so a spelled degree names what actually sounds.
  // ==========================================================================
  var M = {
    "1":    [0, 0, 0, 0],
    "9/8":  [-3, 2, 0, 0],
    "5/4":  [-2, 0, 1, 0],
    "6/5":  [1, 1, -1, 0],
    "4/3":  [2, -1, 0, 0],
    "3/2":  [-1, 1, 0, 0],
    "5/3":  [0, -1, 1, 0],
    "8/5":  [3, 0, -1, 0],
    "15/8": [-3, 1, 1, 0],
    "16/9": [4, -2, 0, 0],
  };
  var LATTICE = {
    ionian:     [M["1"], M["9/8"], M["5/4"], M["4/3"], M["3/2"], M["5/3"], M["15/8"]],
    mixolydian: [M["1"], M["9/8"], M["5/4"], M["4/3"], M["3/2"], M["5/3"], M["16/9"]],
    dorian:     [M["1"], M["9/8"], M["6/5"], M["4/3"], M["3/2"], M["5/3"], M["16/9"]],
    aeolian:    [M["1"], M["9/8"], M["6/5"], M["4/3"], M["3/2"], M["8/5"], M["16/9"]],
    penta:      [M["1"], M["9/8"], M["5/4"], null,     M["3/2"], M["5/3"], null],
    hexa:       [M["1"], M["9/8"], M["5/4"], M["4/3"], M["3/2"], M["5/3"], null],
  };
  var SPELL = {
    ionian: [0, 1, 2, 3, 4, 5, 6], mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian: [0, 1, 2, 3, 4, 5, 6], aeolian: [0, 1, 2, 3, 4, 5, 6],
    penta: [0, 1, 2, 2, 4, 5, 5],  hexa: [0, 1, 2, 3, 4, 5, 5],
  };
  var MODES = ["ionian", "mixolydian", "dorian", "aeolian", "penta", "hexa"];
  var DIATONIC = ["ionian", "mixolydian", "dorian", "aeolian"];
  var TRIAD = { 0: true, 2: true, 4: true };                 // do, mi (or me), sol
  var LEAP_CENTS = [790, 1130];                              // a minor sixth … a major seventh
  var RANGE = { lo: -2, hi: 12, span: 11 };                  // laˌ … la′, a twelfth at most

  function modeOf(x) {
    var m = typeof x === "string" ? x : (x && x.mode) || "ionian";
    return LATTICE[m] ? m : "ionian";
  }
  function cls(d) { return ((d % 7) + 7) % 7; }
  function oct(d) { return Math.floor(d / 7); }
  // the degree as the mode actually sounds it
  function spell(d, mode) { return oct(d) * 7 + SPELL[modeOf(mode)][cls(d)]; }
  function inScale(d, mode) { return LATTICE[modeOf(mode)][cls(d)] !== null; }
  function monzo(d, mode) {
    var m = LATTICE[modeOf(mode)][SPELL[modeOf(mode)][cls(d)]];
    return [m[0] + oct(d), m[1], m[2], m[3]];
  }
  function ratioOf(mz) { return Math.pow(2, mz[0]) * Math.pow(3, mz[1]) * Math.pow(5, mz[2]) * Math.pow(7, mz[3]); }
  function ratio(d, mode) { return ratioOf(monzo(d, mode)); }
  function cents(d, mode) { return 1200 * Math.log(ratio(d, mode)) / Math.LN2; }
  function degsOf(line) {
    if (!line || typeof line.map !== "function") return [];
    return line.map(function (x) { return typeof x === "number" ? x : (x && typeof x.deg === "number" ? x.deg : null); })
               .filter(function (x) { return typeof x === "number" && isFinite(x); });
  }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  // ==========================================================================
  // THE DOUBLING — the second harmonium rank argues a PURE interval above the
  // first, inside the scale. A just fifth where the scale has one; where it
  // doesn't (above re the fifth is the 40/27 wolf, above ti the 64/45
  // tritone, and v0.30's f × 1.5 put ti's on a pitch no one had tuned) the
  // rank takes the nearest pure consonance the scale does hold: a third, a
  // sixth, a fourth. A sustained reed rank beating on a wolf is the one
  // colour Ives would have wanted on purpose, and we don't.
  // ==========================================================================
  var PURE_ABOVE = [                                          // in order of preference
    [[-1, 1, 0, 0], "fifth"], [[-2, 0, 1, 0], "third"], [[1, 1, -1, 0], "third"],
    [[0, -1, 1, 0], "sixth"], [[3, 0, -1, 0], "sixth"], [[2, -1, 0, 0], "fourth"],
  ];
  function doublingOf(d, mode) {
    var m0 = monzo(d, mode);
    for (var p = 0; p < PURE_ABOVE.length; p++) {
      for (var up = 1; up <= 6; up++) {
        var e = d + up;
        if (!inScale(e, mode)) continue;
        var m1 = monzo(e, mode), same = true;
        for (var i = 0; i < 4; i++) if (m1[i] - m0[i] !== PURE_ABOVE[p][0][i]) { same = false; break; }
        if (same) return { deg: e, interval: PURE_ABOVE[p][1] };
      }
    }
    // never reached in the six modes (every degree has a pure third, sixth or
    // fourth above it inside the scale) — kept so the rank can't fall silent
    return { deg: spell(d + 4, mode), interval: "fifth-ish" };
  }

  // ==========================================================================
  // THE OLD QUESTION — v0.30's QDEGS, sol–la–re′–ti–re′, the ancestor. Its
  // beats are kept exactly as they were played (1.3, 0.9, 1.0, 0.8, 2.8).
  // In a gapped scale it is spelled the way projDeg always sounded it
  // (ti folds to la: sol–la–re′–la–re′). It is exempt from the rules — its
  // widest leap is a fourth — as an ancestor is exempt from its descendants'
  // manners.
  // ==========================================================================
  var OLD = { degs: [4, 5, 8, 6, 8], beats: [1.3, 0.9, 1.0, 0.8, 2.8] };

  // a WRITTEN question, as the bank keeps it: mode-free, its id the same in
  // every mode and every meeting, so "the one just heard" can step aside
  function written(degs, beats, fromBank) {
    return {
      id: fromBank === "old" ? "q:old" : "q:g:" + degs.join(".") + "/" + beats.join("."),
      degs: degs.slice(), beats: beats.slice(), fromBank: fromBank,
    };
  }
  function oldQuestion() { return written(OLD.degs, OLD.beats, "old"); }
  // a question as a meeting sings it: spelled, with its monzos
  function sung(w, degs, mode) {
    return {
      id: w.id, index: w.index, fromBank: w.fromBank, mode: mode,
      degs: degs.slice(), beats: w.beats.slice(), written: w.degs.slice(),
      monzos: degs.map(function (d) { return monzo(d, mode); }),
    };
  }

  // ==========================================================================
  // THE RHYTHM FAMILY — LONG – short – short – LONG – held, in beats. Written
  // so the engraver has plain values (dotted quarters, eighths, a held note).
  // A six-note question lets the shorts run on, or puts a pickup before the
  // held note.
  // ==========================================================================
  var RHY = {
    5: [[1.5, 0.5, 0.5, 1.5, 3], [1, 0.5, 0.5, 1, 3], [2, 1, 1, 2, 4], [1.5, 0.5, 0.5, 1, 3], [2, 0.5, 0.5, 1.5, 3]],
    6: [[1.5, 0.5, 0.5, 0.5, 1.5, 3], [1.5, 0.5, 0.5, 1.5, 0.5, 3], [1, 0.5, 0.5, 0.5, 1, 3], [2, 1, 1, 1, 2, 4], [1.5, 0.5, 0.5, 1, 1, 3]],
  };
  function rhythmInFamily(b) {
    var n = b.length;
    if (n < 5) return false;
    var last = b[n - 1];
    if (!(b[0] >= 1 && b[0] > b[1] && b[0] > b[2])) return false;       // LONG – short – short
    for (var i = 0; i < n - 1; i++) if (last < 1.5 * b[i]) return false;
    if (last < 2.5) return false;                                          // … held
    var second = Math.max(b[n - 2], b[n - 3]);
    return second >= b[0] * 0.66 && second > b[1];                        // … LONG
  }

  // ==========================================================================
  // THE HARD RULES — one checker, used by the generator, the draw and the
  // bend, and reported to the lab. Measured on sounding pitch (cents in the
  // mode), not on paper steps, so a gapped scale can't smuggle a fifth in as
  // a "sixth". q = { degs (spelled in q.mode), beats, mode }.
  // ==========================================================================
  function rules(q) {
    var mode = modeOf(q.mode), d = q.degs, n = d.length, fails = [];
    var c = d.map(function (x) { return cents(x, mode); });
    if (n < 5 || n > 6) fails.push("length");
    for (var i = 0; i < n; i++) if (!inScale(d[i], mode) || spell(d[i], mode) !== d[i]) { fails.push("spelling"); break; }
    // rising: it sets out upward from its lowest note, somewhere between do
    // and la, and ends at least a fourth above where it began
    if (c[n - 1] - c[0] < 480 || c[1] <= c[0]) fails.push("rising");
    for (i = 1; i < n; i++) if (c[i] <= c[0] + 1e-6) { fails.push("dips-below-start"); break; }
    if (d[0] < 0 || d[0] > 5) fails.push("starts-out-of-place");
    // angular: two or more leaps (a third or wider), at least one turn back,
    // no repeated notes
    var leaps = 0, turns = 0, big = false;
    for (i = 1; i < n; i++) {
      var iv = c[i] - c[i - 1];
      if (Math.abs(iv) < 1) fails.push("repeat");
      if (Math.abs(iv) >= 250) leaps++;
      if (Math.abs(iv) >= LEAP_CENTS[0] && Math.abs(iv) <= LEAP_CENTS[1]) big = true;
      if (Math.abs(iv) > 1150) fails.push("leap-too-wide");
      if (i > 1 && (iv > 0) !== (c[i - 1] - c[i - 2] > 0)) turns++;
    }
    if (leaps < 2 || turns < 1) fails.push("angular");
    if (!big) fails.push("no-sixth-or-seventh");
    // ends high and unresolved
    if (TRIAD[cls(d[n - 1])]) fails.push("resolves");
    if (d[n - 1] < 5) fails.push("ends-low");
    var above = {};
    for (i = 0; i < n - 1; i++) if (c[i] > c[n - 1] + 1e-6) above[Math.round(c[i])] = true;
    if (Object.keys(above).length > 1) fails.push("not-high");
    // … and it lifts at the end, or at most sinks a third onto it: a fall of
    // a fourth or more into the last note sounds like an answer
    if (c[n - 1] - c[n - 2] < -400) fails.push("falls-at-the-end");
    // a clarinet's reach: laˌ … la′, never more than a twelfth from end to end
    var lo = Math.min.apply(null, d), hi = Math.max.apply(null, d);
    if (lo < RANGE.lo || hi > RANGE.hi || hi - lo > RANGE.span) fails.push("range");
    if (!rhythmInFamily(q.beats)) fails.push("rhythm");
    if (q.beats.length !== n) fails.push("beats");
    return { ok: fails.length === 0, fails: fails };
  }

  // ==========================================================================
  // THE EVALUATOR — the critic in the loft. A candidate can pass every rule
  // and still be dull, or a bugle call, or a near-twin of a sister.
  //   selfTests(q)                     — the question on its own
  //   evaluate(q, others, excludeLines) — and against its sisters and the hymns
  // Both return {ok, why}.
  // ==========================================================================
  function intervals(d, mode) {
    var out = [];
    for (var i = 1; i < d.length; i++) out.push(Math.round((cents(d[i], mode) - cents(d[i - 1], mode)) / 100));
    return out;                                                  // in semitones, near enough to compare
  }
  // a spelled degree's place in the mode's own scale (the pentatonic counts
  // five to the octave), so "moved up two steps" means the same in every mode
  function scaleIndex(d, mode) {
    var L = LATTICE[modeOf(mode)], c = cls(d), size = 0, pos = 0;
    for (var i = 0; i < 7; i++) if (L[i]) { if (i < c) pos++; size++; }
    return oct(d) * size + pos;
  }
  function steps(d, mode) {
    var out = [];
    for (var i = 1; i < d.length; i++) out.push(scaleIndex(d[i], mode) - scaleIndex(d[i - 1], mode));
    return out;                                                  // in steps of the mode's scale
  }
  function contour(iv) { return iv.map(function (x) { return x > 0 ? "u" : "d"; }).join(""); }
  function selfTests(q) {
    var mode = modeOf(q.mode), d = q.degs, n = d.length, i;
    var iv = intervals(d, mode), c = d.map(function (x) { return cents(x, mode); });
    var stepwise = 0;
    for (i = 0; i < iv.length; i++) if (Math.abs(iv[i]) <= 2) stepwise++;
    if (stepwise / iv.length > 0.5) return { ok: false, why: "too-stepwise" };
    var pcs = {}, count = {};
    for (i = 0; i < n; i++) { pcs[cls(d[i])] = true; count[d[i]] = (count[d[i]] || 0) + 1; }
    if (Object.keys(pcs).length < 4) return { ok: false, why: "too-few-pitches" };
    for (var key in count) if (count[key] > 2) return { ok: false, why: "circling" };
    for (i = 3; i < n; i++) if (d[i] === d[i - 2] && d[i - 1] === d[i - 3]) return { ok: false, why: "circling" };
    // a bugle call is not a question: the great leap never joins two tones of
    // the tonic triad (mi–do′, sol–mi′), and no three triad tones run in a row
    for (i = 1; i < n; i++) {
      var w = Math.abs(c[i] - c[i - 1]);
      if (w >= LEAP_CENTS[0] && w <= LEAP_CENTS[1] && TRIAD[cls(d[i])] && TRIAD[cls(d[i - 1])]) return { ok: false, why: "triad-leap" };
    }
    for (i = 2; i < n; i++) if (TRIAD[cls(d[i])] && TRIAD[cls(d[i - 1])] && TRIAD[cls(d[i - 2])]) return { ok: false, why: "arpeggio" };
    // "a leap of a sixth or seventh": one great stretch, not a zigzag of them
    var greats = 0;
    for (i = 1; i < n; i++) if (Math.abs(c[i] - c[i - 1]) >= LEAP_CENTS[0]) greats++;
    if (greats > 1) return { ok: false, why: "two-great-leaps" };
    return { ok: true, why: null };
  }
  // two questions compared as written, in the reference spelling (ionian)
  function similar(a, b) {
    var mode = "ionian";
    var ia = intervals(a.degs, mode), ib = intervals(b.degs, mode);
    if (ia.length === ib.length) {
      var diff = 0;
      for (var i = 0; i < ia.length; i++) diff += Math.abs(ia[i] - ib[i]);
      if (diff <= 4) return "near-twin";                        // a transposition, or one note nudged
      if (contour(ia) === contour(ib) && a.degs[a.degs.length - 1] === b.degs[b.degs.length - 1]
          && a.beats.join() === b.beats.join()) return "same-shape";
    }
    var ta = a.degs.slice(-3).join(), tb = b.degs.slice(-3).join();
    if (ta === tb) return "same-ending";
    // four notes in a row in common — the same pitches, or the same
    // intervals anywhere else — is one question wearing another's coat
    var jb = ib.join();
    for (var s = 0; s + 4 <= a.degs.length; s++) {
      var run = a.degs.slice(s, s + 4).join();
      for (var u = 0; u + 4 <= b.degs.length; u++) if (b.degs.slice(u, u + 4).join() === run) return "shared-run";
    }
    for (s = 0; s + 3 <= ia.length; s++) {
      if (("," + jb + ",").indexOf("," + ia.slice(s, s + 3).join() + ",") >= 0) return "shared-shape";
    }
    return null;
  }
  // does any window of a hymn line sing this question? Compared in the
  // meeting's mode two ways: by semitones (the same tune at any octave) and
  // by scale steps (the same tune moved up or down the scale — a diatonic
  // transposition changes a third's quality, not what the ear recognises)
  function matchesLine(q, excludeLines) {
    var mode = modeOf(q.mode), n = q.degs.length;
    var qi = intervals(q.degs, mode).join(), qs = steps(q.degs, mode).join();
    for (var L = 0; L < (excludeLines || []).length; L++) {
      var ld = degsOf(excludeLines[L]).map(function (x) { return spell(x, mode); });
      for (var w = 0; w + n <= ld.length; w++) {
        var win = ld.slice(w, w + n);
        if (intervals(win, mode).join() === qi || steps(win, mode).join() === qs) return true;
      }
    }
    return false;
  }
  function evaluate(q, others, excludeLines) {
    var st = selfTests(q);
    if (!st.ok) return st;
    for (var i = 0; i < (others || []).length; i++) {
      var s = similar(q, others[i]);
      if (s) return { ok: false, why: (others[i].fromBank === "old" ? "like-the-old-one:" : "like-a-sister:") + s };
    }
    if (matchesLine(q, excludeLines)) return { ok: false, why: "matches-a-hymn-line" };
    return { ok: true, why: null };
  }

  // ==========================================================================
  // SPELLING INTO A MODE — a written question as this meeting's scale can
  // sing it. In the four diatonic modes it is sung as written. In a gapped
  // mode each note on a missing degree (fa, ti) must go somewhere: down, as
  // projDeg folds it, or up to the next tone the scale has. The first way
  // round, folds first, that keeps every rule and the critic's own tests is
  // the one sung; if there is none, the question sits this meeting out.
  // No dice: the same question always comes out the same in the same mode.
  // ==========================================================================
  function stepUp(d, mode) { var e = d + 1; while (!inScale(e, mode)) e++; return e; }
  function spellIn(w, mode) {
    mode = modeOf(mode);
    if (w.fromBank === "old") {
      return sung(w, w.degs.map(function (d) { return spell(d, mode); }), mode);
    }
    var miss = [];
    for (var i = 0; i < w.degs.length; i++) if (!inScale(w.degs[i], mode)) miss.push(i);
    for (var c = 0; c < (1 << miss.length); c++) {
      var d = w.degs.slice();
      for (var j = 0; j < miss.length; j++) {
        var x = w.degs[miss[j]];
        d[miss[j]] = (c >> j) & 1 ? stepUp(x, mode) : spell(x, mode);
      }
      var trial = { degs: d, beats: w.beats, mode: mode };
      if (rules(trial).ok && selfTests(trial).ok) return sung(w, d, mode);
    }
    return null;
  }

  // ==========================================================================
  // THE GENERATOR.
  //
  // planBank — the bank's shape before a note is written: which six endings
  // (drawn by weight, the pentatonic slots' first, no class more than twice,
  // so three classes at least), and which scale each slot is WRITTEN in:
  // three in the pentatonic, one in the hexatonic, two in the full seven.
  // A question written in the pentatonic is sung as written in every mode
  // (the five tones are in them all); the Shaker Sunday is never short of
  // questions. Every die drawn whatever it decides.
  //
  // slotShape — its length, its rhythm and where it starts. A start is
  // drawn by its weight (sol most of all, as the old one began) and by the
  // room it leaves below the ending, counted in the slot's own scale tones:
  // a start with only a tone or two between it and its end has few lawful
  // ways up, and would say the same few things visit after visit.
  //
  // candidate — one attempt: the inner notes drawn EVENLY from the slot's
  // scale between the start and the ceiling, the ending already fixed. The
  // rules and the critic then keep only what is lawful, so every lawful
  // question of the slot's shape is equally likely — no favourite shape,
  // and nothing heard more often for being easier to find.
  // ==========================================================================
  var END_W = { 5: 14, 6: 20, 8: 30, 10: 22, 12: 14 };       // la · ti · re′ · fa′ · la′
  var FAMILY_ENDS = { penta: [8, 12], hexa: [8, 10, 12, 5], any: [8, 10, 6, 12, 5] };
  var FAMILY_SCALE = { penta: "penta", hexa: "hexa", any: "ionian" };
  var FAMILIES = ["penta", "penta", "penta", "hexa", "any", "any"];   // drawn in this order
  var STARTS = [[0, 1], [1, 0.8], [2, 2], [3, 0.8], [4, 4.5], [5, 2]];
  var SIX_NOTES = { penta: 0.8, hexa: 0.5, any: 0.5 };           // the pentatonic needs the sixth note for room
  function planBank(s) {
    var order = s.shuffle([0, 1, 2, 3, 4, 5]);                   // which slot each family lands in
    var byClass = {}, slots = [];
    for (var f = 0; f < FAMILIES.length; f++) {
      var r = s.rnd(0, 1);                                        // one die per slot, always
      var pool = FAMILY_ENDS[FAMILIES[f]].filter(function (e) { return (byClass[cls(e)] || 0) < 2; });
      var total = 0, p;
      for (p = 0; p < pool.length; p++) total += END_W[pool[p]];
      var x = r * total, end = pool[pool.length - 1];
      for (p = 0; p < pool.length; p++) { x -= END_W[pool[p]]; if (x < 0) { end = pool[p]; break; } }
      byClass[cls(end)] = (byClass[cls(end)] || 0) + 1;
      slots[order[f]] = { family: FAMILIES[f], end: end };
    }
    return slots;
  }
  function slotShape(s, end, family) {
    var scale = FAMILY_SCALE[family], d;
    var n = s.chance(SIX_NOTES[family]) ? 6 : 5;
    var beats = s.pick(RHY[n]);
    var st = STARTS.filter(function (w) { return inScale(w[0], scale) && end - w[0] >= 3 && end - w[0] <= RANGE.span; })
      .map(function (w) {
        var between = 0;                                          // the scale's tones between start and end
        for (var d = w[0] + 1; d < end; d++) if (inScale(d, scale)) between++;
        return [w[0], w[1] * Math.min(1, Math.max(0.1, (between - 1) / 4))];
      });
    var start = s.pickW(st.length ? st : STARTS);
    var tones = [];                                               // the scale's tones it may pass through
    for (d = start + 1; d <= Math.min(RANGE.hi, start + RANGE.span); d++) if (inScale(d, scale)) tones.push(d);
    return { n: n, beats: beats, start: start, tones: tones };
  }
  function candidate(t, shape, end) {
    var d = [shape.start];
    for (var i = 1; i < shape.n - 1; i++) d.push(shape.tones[t.rint(0, shape.tones.length - 1)]);
    d.push(end);
    return d;
  }
  // is this written question lawful, and worthy of its slot?
  function judge(w, family) {
    for (var m = 0; m < DIATONIC.length; m++) {
      var q = { degs: w.degs, beats: w.beats, mode: DIATONIC[m] };
      var r = rules(q);
      if (!r.ok) return { ok: false, stage: "rules", why: r.fails[0] };
    }
    var st = selfTests({ degs: w.degs, beats: w.beats, mode: "ionian" });
    if (!st.ok) return { ok: false, stage: "critic", why: st.why };
    if (family === "penta" && !spellIn(w, "penta")) return { ok: false, stage: "family", why: "not-pentatonic" };
    if ((family === "penta" || family === "hexa") && !spellIn(w, "hexa")) return { ok: false, stage: "family", why: "not-hexatonic" };
    return { ok: true };
  }

  // ==========================================================================
  // bank(stream) → { questions: [the old one, six generated], stats }.
  // Written ONCE PER VISIT from question:bank (SCORE §3). Each slot draws
  // its shape from its own fork, and each attempt at it from "try:<j>"
  // below that, so a candidate turned away never shifts another. A slot that
  // can't be filled with its first shape tries a fresh one ("again:<r>").
  // Plain JSON: the stats travel with the questions.
  // ==========================================================================
  var TRIES_PER_SHAPE = 500, SHAPES_PER_SLOT = 8;
  function bank(stream) {
    var plan = planBank(stream.fork("plan"));
    var out = [oldQuestion()];
    var stats = { tries: 0, ruleRejects: 0, familyRejects: 0, evalRejects: 0, why: {}, reshapes: 0, reserves: 0, short: 0, plan: plan };
    for (var i = 0; i < plan.length; i++) {
      var slot = stream.fork("slot:" + (i + 1)), got = null, reserve = null;
      for (var r = 0; r < SHAPES_PER_SLOT && !got; r++) {
        var ss = r === 0 ? slot : slot.fork("again:" + r);
        var shape = slotShape(ss, plan[i].end, plan[i].family);
        if (r > 0) stats.reshapes++;
        for (var j = 0; j < TRIES_PER_SHAPE && !got; j++) {
          stats.tries++;
          var w = written(candidate(ss.fork("try:" + j), shape, plan[i].end), shape.beats, "gen");
          var jd = judge(w, plan[i].family);
          if (!jd.ok) {
            if (jd.stage === "critic") { stats.evalRejects++; stats.why[jd.why] = (stats.why[jd.why] || 0) + 1; }
            else if (jd.stage === "family") stats.familyRejects++;
            else stats.ruleRejects++;
            continue;
          }
          var ev = evaluate({ degs: w.degs, beats: w.beats, mode: "ionian" }, out, null);
          if (!ev.ok) {
            stats.evalRejects++; stats.why[ev.why] = (stats.why[ev.why] || 0) + 1;
            if (!reserve && !out.some(function (o) { return o.degs.join() === w.degs.join(); })) reserve = w;
            continue;
          }
          got = w;
        }
      }
      // a safety net never needed in thousands of seeds: a lawful question
      // the critic found too like a sister is better than an empty slot
      if (!got && reserve) { got = reserve; stats.reserves++; }
      if (got) { got.family = plan[i].family; out.push(got); } else stats.short++;
    }
    for (var k = 0; k < out.length; k++) out[k].index = k;
    return { questions: out, stats: stats };
  }
  function questionsOf(bk) { return Array.isArray(bk) ? bk : (bk && bk.questions) || []; }

  // ==========================================================================
  // eligible(bank, mode, {excludeLines}) — the questions this meeting can
  // ask: each spelled into the mode and judged there; none that matches a
  // line of the meeting's hymns (§8.1: "never matches a line of any hymn in
  // the meeting" — tested here, at the draw, since the visit's bank is
  // written before later meetings' hymns exist); none that has folded into
  // the same notes as an earlier sister. The rest, with the reason, in out.
  // ==========================================================================
  function eligible(bk, mode, opts) {
    mode = modeOf(mode);
    var lines = (opts && opts.excludeLines) || [];
    var pool = [], out = [], seen = {};
    questionsOf(bk).forEach(function (w) {
      var q = spellIn(w, mode);
      var why = !q ? "no lawful way to sing it in " + mode
        : matchesLine(q, lines) ? "matches a line of the meeting's hymns"
        : seen[q.degs.join()] ? "sounds the same as a sister in " + mode
        : null;
      if (why) { out.push({ index: w.index, id: w.id, why: why }); return; }
      seen[q.degs.join()] = true;
      pool.push(q);
    });
    return { pool: pool, out: out };
  }

  // pick(bank, stream, {mode, recent, excludeLines}) — one question for the
  // meeting, spelled in its mode. `recent` lists the ids already heard this
  // visit, oldest first. The most recently heard step aside — always the
  // last one, and as many before it as still leave two to choose between —
  // so a visit goes round its questions without ever settling into an
  // order. One die. null only if nothing in the bank can be sung in this
  // meeting at all (never seen).
  function pick(bk, stream, opts) {
    opts = opts || {};
    var r = stream.rnd(0, 1);
    var el = eligible(bk, opts.mode, opts).pool;
    var aside = stepAside(el, opts.recent);
    var pool = el.filter(function (q) { return aside.indexOf(q.id) < 0; });
    if (!pool.length) return null;
    return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
  }
  // which of the ids heard this visit stand aside from this pool
  function stepAside(pool, recent) {
    var ids = pool.map(function (q) { return q.id; }), latest = [];
    for (var i = (recent || []).length - 1; i >= 0; i--) {         // most recent first, each once
      if (ids.indexOf(recent[i]) >= 0 && latest.indexOf(recent[i]) < 0) latest.push(recent[i]);
    }
    return latest.slice(0, Math.max(pool.length > 1 ? 1 : 0, pool.length - 2));
  }

  // ==========================================================================
  // askings(q, stream) → three askings. The first and last verbatim; the
  // middle one BENT — one note displaced a step or two, or the rhythm
  // shifted (a long and a short trade places, or the phrase comes in late
  // and clipped). Ives's trumpet never quite repeats itself; nor does ours.
  // But a bent question is still a question: a displacement is taken only if
  // it keeps every rule the question kept (a softened sixth is a fair bend)
  // and the critic's own tests. The drawn note is tried first, then its
  // neighbours in turn; if every way is shut, the rhythm bends instead. The
  // dice are the same whichever wins.
  // ==========================================================================
  function newFails(after, before) {
    return after.filter(function (f) { return before.indexOf(f) < 0 && f !== "no-sixth-or-seventh"; });
  }
  function askings(q, stream) {
    var mode = modeOf(q.mode), n = q.degs.length;
    var kind = stream.chance(0.55) ? "note" : "rhythm";
    var at = stream.rint(1, n - 2);                                // an interior note
    var dir = stream.chance(0.5) ? 1 : -1;
    var far = stream.chance(0.3);
    var rv = stream.pickW([["swap-head", 2], ["swap-tail", 1.5], ["late", 1.5]]);
    var degs = q.degs.slice(), beats = q.beats.slice(), offset = 0, bend = null;
    if (kind === "note") {
      var before = rules(q).fails, selfBefore = selfTests(q).ok;
      var tries = far ? [2 * dir, dir, -dir, -2 * dir, 3 * dir, -3 * dir] : [dir, 2 * dir, -dir, -2 * dir, 3 * dir, -3 * dir];
      for (var s = 0; s < n - 2 && !bend; s++) {
        var idx = 1 + ((at - 1 + s) % (n - 2));                    // the drawn note, then on round
        for (var t = 0; t < tries.length && !bend; t++) {
          var nd = spell(q.degs[idx] + tries[t], mode);
          if (nd === q.degs[idx] || nd === q.degs[idx - 1] || nd === q.degs[idx + 1]) continue;
          var trial = q.degs.slice(); trial[idx] = nd;
          var tq = { degs: trial, beats: q.beats, mode: mode };
          if (newFails(rules(tq).fails, before).length) continue;
          if (selfBefore && !selfTests(tq).ok) continue;
          degs = trial;
          bend = { kind: "note", index: idx, from: q.degs[idx], to: nd };
        }
      }
    }
    if (!bend && rv === "late") {
      offset = Math.min(1, beats[0] / 2);                          // comes in late …
      beats[0] -= offset;                                          // … and the first long is clipped
      bend = { kind: "rhythm", variant: "late", offsetBeats: offset };
    } else if (!bend) {
      var i0 = rv === "swap-head" ? 0 : n - 3;
      if (beats[i0] === beats[i0 + 1]) i0 = i0 === 0 ? n - 3 : 0;
      var tmp = beats[i0]; beats[i0] = beats[i0 + 1]; beats[i0 + 1] = tmp;
      bend = { kind: "rhythm", variant: "swap", index: i0 };
    }
    if (kind === "note" && bend.kind === "rhythm") bend.hemmedIn = true;   // every note way was shut
    function asking(k, dg, bt, off, b) {
      return {
        k: k, questionId: q.id, degs: dg, beats: bt, offsetBeats: off, bent: b || null,
        monzos: dg.map(function (d) { return monzo(d, mode); }),
      };
    }
    return [
      asking(0, q.degs.slice(), q.beats.slice(), 0, null),
      asking(1, degs, beats, offset, bend),
      asking(2, q.degs.slice(), q.beats.slice(), 0, null),
    ];
  }

  // ==========================================================================
  // answers(q, k, material, stream, mode) → the k-th answer (k from 0: the
  // answer to the first asking; the last asking gets none).
  //
  // The answerers argue in the MEETING'S OWN MATERIAL: fragments of today's
  // hymns, passed in as degree arrays (or Note arrays). One is developed —
  // sequenced upward, inverted, turned back, broken off — and each answer is
  // faster, higher and more scattered than the last. With no material they
  // fall back on the question's own intervals, turned about.
  //
  // Voices: the harmonium answers every time; from the second answer on it
  // plays with a second rank a pure interval above (a fifth where the scale
  // has one), and the clarinet joins as a second answerer, higher and
  // quicker still. Every note carries its exact monzo. However many answers
  // are asked for, they stay on the instrument: the ceiling stops at la′′.
  // ==========================================================================
  var DEVELOP = [["sequence", 3], ["invert", 2], ["retro", 2], ["break", 2], ["scatter", 1]];
  var ANSWER_TOP = 19;                                             // la′′, the clarinet's last good note here
  var INVERSION = { fifth: "fourth", fourth: "fifth", third: "sixth", sixth: "third", "fifth-ish": "fourth-ish" };
  function fragmentFrom(material, s, q) {
    var pool = (material || []).map(degsOf).filter(function (m) { return m.length >= 3; });
    var ix = s.rnd(0, 1), len = s.rint(3, 5), off = s.rnd(0, 1);
    if (!pool.length) {
      // the question's own intervals, turned about: its body without the held end
      return { degs: q.degs.slice(0, q.degs.length - 1), from: "question" };
    }
    var line = pool[Math.floor(ix * pool.length)];
    len = Math.min(len, line.length);
    var st = Math.floor(off * (line.length - len + 1));
    return { degs: line.slice(st, st + len), from: "material" };
  }
  function develop(frag, op) {
    var iv = [];
    for (var i = 1; i < frag.length; i++) iv.push(frag[i] - frag[i - 1]);
    if (!iv.length) iv = [2, -1];
    if (op === "invert") iv = iv.map(function (x) { return -x; });
    else if (op === "retro") iv = iv.slice().reverse().map(function (x) { return -x; });
    else if (op === "break") iv = iv.slice(0, Math.max(1, iv.length - 1));
    else if (op === "scatter") iv = iv.map(function (x) { return x * 2 || 2; });
    // no interval of zero: an answer that stands still isn't arguing
    return iv.map(function (x) { return x === 0 ? 1 : x; });
  }
  function endHold(k) { return k === 0 ? 1.5 : k === 1 ? 1 : 0.75; }
  function walk(s, mode, startDeg, iv, count, k, beatSet, lo, hi) {
    var notes = [], deg = startDeg, lift = 0, step = 0;
    var scatterP = 0.04 + 0.3 * k;
    for (var i = 0; i < count; i++) {
      // four dice for every note: whether it is flung, which way, how long,
      // and which way it steps off a repeat
      var r1 = s.rnd(0, 1), r2 = s.rnd(0, 1), r3 = s.rnd(0, 1), r4 = s.rnd(0, 1);
      if (i > 0) {
        deg += iv[step % iv.length];
        step++;
        if (step % iv.length === 0) lift += 1 + (r3 < 0.35 * k ? 1 : 0);   // each pass sequenced higher
        if (r1 < scatterP) deg += r2 < 0.5 ? 7 : -5;               // scattered: flung up an octave, or dropped
      }
      var d = deg + lift;
      while (d > hi) d -= 7;
      while (d < lo) d += 7;
      if (d > hi) d -= 7;                                          // a window under an octave: the ceiling wins
      d = spell(d, mode);
      var prev = notes.length ? notes[notes.length - 1].deg : null;
      if (d === prev) {
        var way = r4 < 0.5 ? 1 : -1;
        d = spell(d + way, mode);
        if (d === prev) d = spell(d + 2 * way, mode);              // a gapped scale folds the step back
      }
      if (d > hi) d = spell(d - 7, mode);
      var b = beatSet[Math.floor(r4 * beatSet.length)];
      notes.push({ deg: d, beats: b, monzo: monzo(d, mode) });
    }
    // the answer never ends still — its last note is the longest it has
    notes[notes.length - 1].beats = Math.max(notes[notes.length - 1].beats, endHold(k));
    return notes;
  }
  function answers(q, k, material, stream, mode) {
    mode = modeOf(mode || q.mode);
    var s = stream.fork("k:" + k);
    var frag = fragmentFrom(material, s, q);
    var op = s.pickW(DEVELOP);
    var iv = develop(frag.degs, op);
    var count = 4 + 3 * k + s.rint(0, 2);
    // each answer sits higher: its floor, first note and ceiling climb with
    // k — until the ceiling meets the top of the instrument
    var hi = Math.min(9 + 3 * k, ANSWER_TOP - 1);
    var lo = Math.min(Math.min.apply(null, q.degs) - 2 + 3 * k, hi - 7);
    var start = Math.max(lo, Math.min(hi, q.degs[0] + 3 * k + s.rint(-1, 1)));
    var beatSet = k === 0 ? [1, 0.75, 1, 1] : k === 1 ? [0.5, 0.5, 0.75, 0.5] : [0.25, 0.5, 0.25, 0.25];
    var delay = Math.round(s.rnd(1.25, 2.25) * 4) / 4;              // the room's breath before anyone answers
    var rest = Math.round(s.rnd(2.5, 4.5) * Math.pow(0.85, k) * 4) / 4;
    var cStart = s.rint(2, 4), cCount = s.rint(3, 5) + k, cEntry = s.rint(1, 3) * 0.5;
    var main = walk(s.fork("harmonium"), mode, start, iv, count, k, beatSet, lo, hi);
    var voices = [{ voice: "harmonium", role: "answer", entryBeats: 0, notes: main }];
    if (k >= 1) {
      // the answerers argue among themselves: a second rank a pure interval
      // up, a half-beat behind, every pitch in the scale
      voices.push({
        voice: "harmonium", role: "doubling", entryBeats: 0.5,
        notes: main.map(function (nn) {
          var db = doublingOf(nn.deg, mode), dd = db.deg, iv = db.interval;
          // at the top of the instrument the rank drops an octave: the same
          // pure interval, turned under the answer instead of over it
          if (dd > ANSWER_TOP) { dd -= 7; iv = INVERSION[iv] + " below"; }
          return { deg: dd, beats: nn.beats, monzo: monzo(dd, mode), interval: iv };
        }),
      });
      // … and the clarinet, the second answerer: the same fragment turned
      // back on itself, higher, faster
      var civ = develop(frag.degs, op === "retro" ? "invert" : "retro");
      var cSet = beatSet.map(function (b) { return Math.max(0.25, b * 0.75); });
      voices.push({
        voice: "clarinet", role: "answer", entryBeats: cEntry,
        notes: walk(s.fork("clarinet"), mode, Math.min(start + cStart, hi + 1), civ, cCount, k + 1, cSet, lo + 2, Math.min(hi + 1, ANSWER_TOP)),
      });
    }
    return finishAnswer({
      k: k, questionId: q.id, mode: mode, from: frag.from, develop: op,
      delayBeats: delay, restBeats: rest, durBeats: 0, voices: voices,
    });
  }
  function finishAnswer(an) {
    var dur = 0;
    for (var v = 0; v < an.voices.length; v++) {
      var sum = an.voices[v].entryBeats;
      for (var i = 0; i < an.voices[v].notes.length; i++) sum += an.voices[v].notes[i].beats;
      dur = Math.max(dur, sum);
    }
    an.durBeats = dur;
    return an;
  }
  // an answer broken off early — the first thing given up when a room is
  // short of time. Answer k keeps at least 3 + 2k notes (so the second
  // still says more than the first), the clarinet at least three, and the
  // note it breaks off on is held as the last one was.
  function trimAnswer(an, keep) {
    if (keep >= 1) return an;
    var out = { k: an.k, questionId: an.questionId, mode: an.mode, from: an.from, develop: an.develop,
                delayBeats: an.delayBeats, restBeats: an.restBeats, durBeats: 0, voices: [] };
    var mainKept = null;
    an.voices.forEach(function (v) {
      var total = v.notes.length;
      var floor = v.voice === "clarinet" ? 3 : 3 + 2 * an.k;
      var kept = v.role === "doubling" && mainKept != null ? mainKept : Math.min(total, Math.max(floor, Math.ceil(keep * total)));
      if (v.role === "answer" && v.voice === "harmonium") mainKept = kept;
      var notes = v.notes.slice(0, kept).map(function (x) { return Object.assign({}, x); });
      if (kept < total && notes.length) notes[notes.length - 1].beats = Math.max(notes[notes.length - 1].beats, endHold(v.voice === "clarinet" ? an.k + 1 : an.k));
      out.voices.push({ voice: v.voice, role: v.role, entryBeats: v.entryBeats, notes: notes, kept: kept, of: total });
    });
    return finishAnswer(out);
  }

  // ==========================================================================
  // ground(stream) — what lies beneath. Most often the drone alone; one time
  // in three, Ives's own device: the strings, playing a slow chorale from
  // the meeting's hymns at their own tempo, oblivious to the argument.
  // ==========================================================================
  function ground(stream) { return stream.rnd(0, 1) < 1 / 3 ? "chorale" : "drone"; }

  // chorale(material, stream, mode) → { beatS, loopGapBeats, chords:[{beats, degs:[B,T,A,S], monzos}] }
  // The longest hymn fragment on hand, harmonized plainly in block chords,
  // slow. Chord tones a gapped scale lacks are left out (an open sonority —
  // the brush-arbor sound); where that leaves too few tones between the bass
  // and the tune, the basses drop an octave rather than double anyone at the
  // unison. The performer loops it, with a rest of loopGapBeats between
  // passes — the strings drawing breath, still not listening.
  var PLAIN_TUNE = [4, 4, 5, 4, 2, 3, 2, 1, 0];                   // when the meeting has no line to lend
  function chorale(material, stream, mode) {
    mode = modeOf(mode);
    var pool = (material || []).map(degsOf).filter(function (m) { return m.length >= 4; });
    var ix = stream.rnd(0, 1);
    var mel = pool.length ? pool[Math.floor(ix * pool.length)] : PLAIN_TUNE;
    var beatS = Math.round(stream.rnd(1.7, 2.5) * 100) / 100;    // its own tempo, slower than anyone
    var chords = [];
    for (var i = 0; i < mel.length; i++) {
      var sd = spell(mel[i], mode);
      while (sd < 4) sd += 7;
      while (sd > 10) sd -= 7;
      var c = cls(sd);
      var last = i === mel.length - 1;
      // roots that hold the melody note, weighted toward I, IV, V and vi
      var roots = [[c, 1], [cls(c - 2), 1], [cls(c - 4), 1]].map(function (r) {
        var w = { 0: 4, 3: 2.5, 4: 2.5, 5: 1.5, 1: 1, 2: 0.6, 6: 0.3 }[r[0]];
        if (last && r[0] === 0) w *= 6;
        return [r[0], inScale(r[0], mode) ? w : 0];
      });
      var root = stream.pickW(roots);
      var tones = [root, root + 2, root + 4].filter(function (x) { return inScale(x, mode); }).map(cls);
      var bass = root - 7;
      if (!inScale(bass, mode)) bass = spell(bass, mode);
      while (bass > -3) bass -= 7;
      var below = innerVoices(sd, bass, tones, mode);
      if (below.length < 2) { bass -= 7; below = innerVoices(sd, bass, tones, mode); }
      var degs = [bass].concat(below.reverse(), [sd]);
      var beats = last ? 4 : (i === 0 || stream.chance(0.25) ? 3 : 2);
      chords.push({ beats: beats, degs: degs, monzos: degs.map(function (x) { return monzo(x, mode); }) });
    }
    return { beatS: beatS, loopGapBeats: 2, chords: chords };
  }
  // the alto and tenor: the two chord tones nearest under the tune, above the bass
  function innerVoices(sd, bass, tones, mode) {
    var below = [];
    for (var d = sd - 1; d > bass && below.length < 2; d--) if (tones.indexOf(cls(d)) >= 0 && inScale(d, mode)) below.push(d);
    return below;
  }

  // ==========================================================================
  // seat(stream, sections, {needS, naturalS}) — where the Question sits.
  // The invocation and the testimony are its homes; the sacrament and an
  // interlude are quieter rooms; the postlude sometimes, a question left
  // hanging as the room empties. Capped at 45 % of the section; a section
  // too short for even the Question's most hurried form is passed over.
  //
  // A room that would make it hurry is chosen less often, in proportion:
  // full weight where the Question fits at its own pace, a quarter of it
  // where it would have to be squeezed all the way. And FORM can make room:
  // a section may carry `stretchTo`, the longest FORM will let it grow if
  // the Question sits there — the seat then asks for what it needs
  // (sectionS), no more. One die.
  //
  // sections: [{type|section, dur, stretchTo?}, …] in plan order. Bare
  // names are accepted, but with no durations there is no cap: the result
  // says capS null, and the timeline's fits is null (unknown), not true.
  // ==========================================================================
  var SEAT_W = { invocation: 3, testimony: 3, sacrament: 2, interlude: 2, postlude: 1.5 };
  var CAP = 0.45;
  function seat(stream, sections, opts) {
    opts = opts || {};
    var need = opts.needS || 0, natural = Math.max(need, opts.naturalS || need);
    var r = stream.rnd(0, 1);
    var pool = [], total = 0;
    (sections || []).forEach(function (sx, i) {
      var name = typeof sx === "string" ? sx : sx && (sx.section || sx.type);
      if (!SEAT_W[name]) return;
      var dur = typeof sx === "string" || sx.dur == null ? null : sx.dur;
      var grant = dur == null ? null : Math.max(dur, Math.min(sx.stretchTo || dur, natural / CAP));
      var fit = 1;
      if (grant != null) {
        var cap = grant * CAP;
        if (cap < need) return;
        var room = natural > need ? (cap - need) / (natural - need) : 1;
        fit = cap >= natural ? 1 : 0.08 + 0.92 * room * room;
      }
      var w = SEAT_W[name] * fit;
      pool.push({ section: name, index: i, dur: dur, grant: grant, w: w, fit: fit });
      total += w;
    });
    if (!pool.length) return null;
    var x = r * total, ch = pool[pool.length - 1];
    for (var p = 0; p < pool.length; p++) { x -= pool[p].w; if (x < 0) { ch = pool[p]; break; } }
    return {
      section: ch.section, index: ch.index, capFrac: CAP,
      capS: ch.grant != null ? ch.grant * CAP : null,
      sectionS: ch.grant, plannedS: ch.dur, stretched: ch.grant != null && ch.grant > ch.dur + 1e-9,
      fit: ch.fit,
    };
  }

  // ==========================================================================
  // timeline(parts, opts) — seconds from the event's start (SCORE §4), for
  // three askings and their answers, then the drone alone (the tail, where
  // "unanswered" is logged). Returns the answers as they will be played.
  //
  // If the natural pace would overrun the cap, the event gives things up in
  // this order, along one PRESSURE from 0 to 1 (the least that fits):
  //   0.0–0.4  the answers break off early (to about half their notes);
  //   0.3–0.6  the tail shortens, 8 s toward 5 s;
  //   0.4–0.8  the breaths shorten, to 0.6 of themselves;
  //   0.6–1.0  and only last does the asker hurry, by a fifth at most.
  // The silences are where the question hangs; the answers are the part
  // Ives let be frantic. fits:false means even the most hurried form is too
  // long for the seat; fits:null means there was no cap to keep.
  // ==========================================================================
  var MIN_GAP = 0.6, MIN_TAIL = 5, HURRY = 0.8, MIN_BEAT = 0.6;
  function lay(parts, beat, gapMul, tail, keep) {
    var items = [], t = 0, played = [];
    for (var k = 0; k < parts.askings.length; k++) {
      var a = parts.askings[k], ab = a.offsetBeats || 0;
      for (var i = 0; i < a.beats.length; i++) ab += a.beats[i];
      items.push({ kind: "asking", k: k, t: t, dur: ab * beat });
      t += ab * beat;
      var an = parts.answers[k] && k < parts.askings.length - 1 ? trimAnswer(parts.answers[k], keep) : null;
      if (an) {
        played.push(an);
        t += an.delayBeats * gapMul * beat;
        items.push({ kind: "answer", k: k, t: t, dur: an.durBeats * beat });
        t += an.durBeats * beat + an.restBeats * gapMul * beat;
      } else if (k < parts.askings.length - 1) {
        t += 2 * gapMul * beat;
      }
    }
    items.push({ kind: "unanswered", t: t, dur: tail });
    return { items: items, total: t + tail, answers: played };
  }
  function atPressure(p, beat0, tail0) {
    var minTail = Math.min(tail0, MIN_TAIL), minBeat = Math.max(MIN_BEAT, beat0 * HURRY);
    return {
      keep: 1 - 0.5 * clamp01(p / 0.4),
      tail: tail0 - (tail0 - minTail) * clamp01((p - 0.3) / 0.3),
      gap: 1 - (1 - MIN_GAP) * clamp01((p - 0.4) / 0.4),
      beat: beat0 - (beat0 - Math.min(beat0, minBeat)) * clamp01((p - 0.6) / 0.4),
    };
  }
  function timeline(parts, opts) {
    opts = opts || {};
    var beat0 = opts.beatS || 0.85, tail0 = opts.tailS != null ? opts.tailS : 8, cap = opts.capS;
    var p = 0, x = atPressure(0, beat0, tail0), L = lay(parts, x.beat, x.gap, x.tail, x.keep);
    if (cap != null && L.total > cap) {
      var top = atPressure(1, beat0, tail0), Lt = lay(parts, top.beat, top.gap, top.tail, top.keep);
      if (Lt.total > cap) { p = 1; x = top; L = Lt; }
      else {
        var a = 0, b = 1;                                          // the least pressure that fits
        for (var it = 0; it < 30; it++) {
          var mid = (a + b) / 2, xm = atPressure(mid, beat0, tail0);
          if (lay(parts, xm.beat, xm.gap, xm.tail, xm.keep).total > cap) a = mid; else b = mid;
        }
        p = b; x = atPressure(b, beat0, tail0); L = lay(parts, x.beat, x.gap, x.tail, x.keep);
      }
    }
    return {
      items: L.items, total: L.total, answers: L.answers,
      beatS: x.beat, naturalBeatS: beat0, gapMul: x.gap, tailS: x.tail, keep: x.keep, pressure: p,
      capS: cap == null ? null : cap, fits: cap == null ? null : L.total <= cap + 1e-6,
    };
  }
  function naturalS(parts, opts) { return timeline(parts, { beatS: opts && opts.beatS, tailS: opts && opts.tailS }).total; }
  function minimumS(parts, opts) {
    var beat0 = (opts && opts.beatS) || 0.85, tail0 = opts && opts.tailS != null ? opts.tailS : 8;
    var x = atPressure(1, beat0, tail0);
    return lay(parts, x.beat, x.gap, x.tail, x.keep).total;
  }

  // ==========================================================================
  // compose(qStream, opts) — one meeting's Question, from question:<n>,
  // every fork taken in the contract's names. The visit's bank is written
  // once, elsewhere, and handed in:
  //   opts = { bank, mode, n, recent, material, excludeLines, sections,
  //            beatS?, tailS?, questionId? }
  // Returns plain JSON, or null if nothing in the bank can be asked here.
  // ==========================================================================
  function compose(qs, opts) {
    opts = opts || {};
    if (!opts.bank) throw new Error("KOLOB.Question.compose: opts.bank is required — write it once per visit with bank(root.fork(\"question:bank\"))");
    var mode = modeOf(opts.mode);
    var el = eligible(opts.bank, mode, opts);
    var ps = qs.fork("pick");
    var q = pick(opts.bank, ps, { mode: mode, recent: opts.recent, excludeLines: opts.excludeLines });
    // a bench (the lab, a dev jump) may name the question to perform; the
    // pick's die has been drawn all the same, so nothing after it moves
    if (opts.questionId != null) q = el.pool.filter(function (x) { return x.id === opts.questionId; })[0] || q;
    if (!q) return null;
    var beatS = Math.round(ps.fork("pace").rnd(0.8, 0.95) * 100) / 100;   // the asker's pace (v0.30's range)
    if (opts.beatS) beatS = opts.beatS;
    var ask = askings(q, qs.fork("bend"));
    var as = qs.fork("answers");
    var ans = [answers(q, 0, opts.material, as, mode), answers(q, 1, opts.material, as, mode)];
    var gs = qs.fork("ground");
    var gr = ground(gs);
    var ch = chorale(opts.material, gs.fork("chorale"), mode);      // drawn always; used one time in three
    var parts = { askings: ask, answers: ans };
    var tOpts = { beatS: beatS, tailS: opts.tailS };
    var nat = naturalS(parts, tOpts), need = minimumS(parts, tOpts);
    var st = seat(qs.fork("seat"), opts.sections || ["invocation", "testimony", "sacrament", "interlude", "postlude"], { needS: need, naturalS: nat });
    var tl = timeline(parts, { beatS: beatS, tailS: opts.tailS, capS: st ? st.capS : null });
    var played = tl.answers;
    delete tl.answers;
    return {
      n: opts.n != null ? opts.n : null, mode: mode, question: q,
      pool: el.pool.map(function (x) { return x.id; }),
      stepAside: stepAside(el.pool, opts.recent),
      askings: ask, answers: played, answersFull: tl.keep < 1 ? ans : null, ground: gr,
      chorale: gr === "chorale" ? ch : null, seat: st, naturalS: nat, needS: need, timeline: tl,
    };
  }

  return {
    MODES: MODES, OLD: OLD, RHYTHMS: RHY, SEAT_WEIGHTS: SEAT_W, CAP: CAP, LEAP_CENTS: LEAP_CENTS, RANGE: RANGE,
    END_WEIGHTS: END_W, FAMILY_ENDS: FAMILY_ENDS,
    bank: bank, eligible: eligible, pick: pick, spellIn: spellIn, askings: askings, answers: answers,
    ground: ground, chorale: chorale, seat: seat, timeline: timeline, naturalS: naturalS, minimumS: minimumS,
    compose: compose, trimAnswer: trimAnswer,
    rules: rules, selfTests: selfTests, evaluate: evaluate, matchesLine: matchesLine, rhythmInFamily: rhythmInFamily,
    scaleIndex: scaleIndex,
    spell: spell, inScale: inScale, monzo: monzo, ratio: ratio, ratioOf: ratioOf, cents: cents,
    doublingOf: doublingOf, oldQuestion: oldQuestion,
  };
})();
