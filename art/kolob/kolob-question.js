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
// thing every Sunday has stopped asking. So now each seed writes a BANK of
// seven: the old phrase, kept whole as the ancestor, and six new ones
// composed in its spirit. One is drawn per meeting.
//
// What "its spirit" means, made into rules a critic can check:
//   · five or six notes, RISING and ANGULAR (leaps, and at least one turn back);
//   · at least one leap of a SIXTH or SEVENTH — the stretch that makes it a
//     question and not a tune;
//   · it ENDS HIGH and UNRESOLVED: on re, fa, la or ti (never do, mi or sol),
//     at la or above, the last note the highest or second-highest, and
//     never reached by a fall wider than a third;
//   · its rhythm is of the family LONG – short – short – LONG – held;
//   · it is spelled in the day's mode: in the gapped scales (penta, hexa) a
//     generated question uses only the degrees the scale has, so the page and
//     the ear agree.
// And then a small EVALUATOR, the critic in the loft, turns away the bland:
// too stepwise, too few pitches, too like a sister in the bank or the old
// one, or matching a hymn line the meeting will sing (excludeLines).
//
// Everything here is PURE: no AudioContext, no DOM, no Math.random, no clock.
// Every die comes from a PJ2.Rand stream the caller forks (SCORE §3):
//   question:<n>:bank · :pick · :bend · :answers · :ground · :seat
// Degrees are 7-degree spellings relative to the hymn's do (0 = do, 7 = do
// an octave up), exactly as the old QDEGS were written; the performer seats
// them an octave above the choir root, as v0.30 did. Every note also carries
// its exact MONZO (SCORE §2), so nothing need be tuned by multiplication —
// v0.30's answer doublings were f × 1.5, and a fifth above ti or re is not
// in the scale. Here the doublings are snapped INTO it.
//
// Public surface: KOLOB.Question
//   bank(stream, {mode, excludeLines, n}) → [Question ×7]   (old one first)
//   pick(bank, stream, {recent})           → Question
//   askings(q, stream)                     → [Asking ×3]    (2nd bent)
//   answers(q, k, material, stream, lattice) → Answer        (k = 0, 1, …)
//   ground(stream)                         → "drone" | "chorale"
//   chorale(material, stream, lattice)     → { beatS, chords }  (the strings)
//   seat(stream, sections, {needS})        → { section, index, capS, … }
//   timeline(parts, {beatS, capS, tailS})  → { items, total, beatS, fits }
//   compose(qStream, opts)                 → the whole event, every fork taken
//   rules(q) · evaluate(q, bank, excludeLines) · spell · monzo · cents · …
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
  var TRIAD = { 0: true, 2: true, 4: true };                 // do, mi (or me), sol
  var LEAP_CENTS = [790, 1130];                              // a minor sixth … a major seventh

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
  // the in-scale degree nearest a target pitch (in cents above do)
  function nearest(targetCents, mode, around) {
    var best = around, bestD = Infinity;
    for (var d = around - 9; d <= around + 9; d++) {
      if (!inScale(d, mode)) continue;
      var dd = Math.abs(cents(d, mode) - targetCents);
      if (dd < bestD - 1e-6) { bestD = dd; best = d; }
    }
    return best;
  }
  // a doubling a just fifth above, SNAPPED into the scale (the v0.30 bug:
  // f × 1.5 put ti's fifth on F♯ and re's on a pitch no one had tuned)
  function fifthIn(d, mode) { return nearest(cents(d, mode) + 701.955, mode, d + 4); }
  function degsOf(line) {
    if (!line) return [];
    return line.map(function (x) { return typeof x === "number" ? x : x.deg; })
               .filter(function (x) { return typeof x === "number" && isFinite(x); });
  }

  // ==========================================================================
  // THE OLD QUESTION — v0.30's QDEGS, sol–la–re′–ti–re′, the ancestor. Its
  // beats are kept exactly as they were played (1.3, 0.9, 1.0, 0.8, 2.8).
  // In a gapped scale it is spelled the way projDeg always sounded it
  // (ti folds to la: sol–la–re′–la–re′).
  // ==========================================================================
  var OLD = { degs: [4, 5, 8, 6, 8], beats: [1.3, 0.9, 1.0, 0.8, 2.8] };

  function build(degs, beats, fromBank, mode) {
    var sp = degs.map(function (d) { return spell(d, mode); });
    return {
      id: "q:" + (fromBank === "old" ? "old" : "g:" + sp.join(".") + "/" + beats.join(".")),
      degs: sp,
      beats: beats.slice(),
      fromBank: fromBank,
      mode: modeOf(mode),
      monzos: sp.map(function (d) { return monzo(d, mode); }),
    };
  }
  function oldQuestion(mode) { return build(OLD.degs, OLD.beats, "old", mode); }

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
  // THE HARD RULES — one checker, used by the generator and reported to the
  // lab. Measured on sounding pitch (cents in the mode), not on paper steps,
  // so a gapped scale can't smuggle a fifth in as a "sixth".
  // ==========================================================================
  function rules(q) {
    var mode = q.mode, d = q.degs, n = d.length, fails = [];
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
    var leaps = 0, turns = 0, big = false, down = 0;
    for (i = 1; i < n; i++) {
      var iv = c[i] - c[i - 1];
      if (Math.abs(iv) < 1) fails.push("repeat");
      if (Math.abs(iv) >= 250) leaps++;
      if (Math.abs(iv) >= LEAP_CENTS[0] && Math.abs(iv) <= LEAP_CENTS[1]) big = true;
      if (Math.abs(iv) > 1150) fails.push("leap-too-wide");
      if (iv < 0) down++;
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
    // a clarinet's reach
    var lo = Math.min.apply(null, d), hi = Math.max.apply(null, d);
    if (lo < -2 || hi > 11 || hi - lo > 11) fails.push("range");
    if (!rhythmInFamily(q.beats)) fails.push("rhythm");
    if (q.beats.length !== n) fails.push("beats");
    return { ok: fails.length === 0, fails: fails };
  }

  // ==========================================================================
  // THE EVALUATOR — the critic in the loft. A candidate can pass every rule
  // and still be dull, or a near-twin of a sister. Returns {ok, why}.
  // ==========================================================================
  function intervals(d, mode) {
    var out = [];
    for (var i = 1; i < d.length; i++) out.push(Math.round((cents(d[i], mode) - cents(d[i - 1], mode)) / 100));
    return out;                                                  // in semitones, near enough to compare
  }
  function contour(iv) { return iv.map(function (x) { return x > 0 ? "u" : "d"; }).join(""); }
  function similar(a, b, mode) {
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
    var ja = ia.join(), jb = ib.join();
    for (var s = 0; s + 4 <= a.degs.length; s++) {
      var run = a.degs.slice(s, s + 4).join();
      for (var u = 0; u + 4 <= b.degs.length; u++) if (b.degs.slice(u, u + 4).join() === run) return "shared-run";
    }
    for (s = 0; s + 3 <= ia.length; s++) {
      if (("," + jb + ",").indexOf("," + ia.slice(s, s + 3).join() + ",") >= 0) return "shared-shape";
    }
    return null;
  }
  function evaluate(q, others, excludeLines) {
    var mode = q.mode, d = q.degs, n = d.length, i;
    var iv = intervals(d, mode);
    var steps = 0;
    for (i = 0; i < iv.length; i++) if (Math.abs(iv[i]) <= 2) steps++;
    if (steps / iv.length > 0.5) return { ok: false, why: "too-stepwise" };
    var pcs = {}, count = {};
    for (i = 0; i < n; i++) { pcs[cls(d[i])] = true; count[d[i]] = (count[d[i]] || 0) + 1; }
    if (Object.keys(pcs).length < 4) return { ok: false, why: "too-few-pitches" };
    for (var key in count) if (count[key] > 2) return { ok: false, why: "circling" };
    for (i = 3; i < n; i++) if (d[i] === d[i - 2] && d[i - 1] === d[i - 3]) return { ok: false, why: "circling" };
    for (i = 0; i < (others || []).length; i++) {
      var s = similar(q, others[i], mode);
      if (s) return { ok: false, why: (others[i].fromBank === "old" ? "like-the-old-one:" : "like-a-sister:") + s };
    }
    // never a line the meeting will sing: no window of any hymn line has the
    // question's interval sequence (transposition-invariant)
    var qi = iv.join();
    for (var L = 0; L < (excludeLines || []).length; L++) {
      var ld = degsOf(excludeLines[L]).map(function (x) { return spell(x, mode); });
      for (var w = 0; w + n <= ld.length; w++) {
        if (intervals(ld.slice(w, w + n), mode).join() === qi) return { ok: false, why: "matches-a-hymn-line" };
      }
    }
    return { ok: true, why: null };
  }

  // ==========================================================================
  // THE GENERATOR — one candidate from one stream. It sets out from a
  // mid-register degree (sol most of all, as the old one did), lays a sixth
  // or seventh at a drawn position, fills the rest with a rising, angular
  // walk, and spells it into the mode; the rules then judge where it landed.
  // Every die is drawn whether or not the candidate survives.
  // ==========================================================================
  var STARTS = [[0, 1], [1, 0.8], [2, 2], [3, 0.8], [4, 4.5], [5, 2]];
  var FILL = [[1, 3], [2, 4], [3, 3], [4, 1.5], [-1, 2], [-2, 2.5], [-3, 1]];
  function candidate(s, mode) {
    var n = s.chance(0.45) ? 6 : 5;
    var beats = s.pick(RHY[n]);
    var start = s.pickW(STARTS);
    var leapAt = s.rint(0, n - 2);
    var leapUp = s.chance(0.8);
    var leapSize = s.chance(0.6) ? 5 : 6;                         // a sixth or a seventh, in steps
    var iv = [];
    for (var i = 0; i < n - 1; i++) {
      var f = s.pickW(FILL);                                      // drawn for every slot
      if (i === 0 && f < 0) f = -f;                               // it sets out upward
      iv.push(i === leapAt ? (leapUp ? leapSize : -leapSize) : f);
    }
    var sp = [spell(start, mode)], raw = start;
    for (i = 0; i < iv.length; i++) {
      raw += iv[i];
      var d = spell(raw, mode);
      // a fold that would repeat a note steps on in the direction of travel
      if (d === sp[i]) d = spell(raw + (iv[i] > 0 ? 1 : -1), mode);
      sp.push(d);
    }
    return build(sp, beats, "gen", mode);
  }

  // ==========================================================================
  // bank(stream, opts) → seven questions: the old one, then six generated.
  // Each attempt j draws from its own fork "try:<j>", so a candidate turned
  // away (by the evaluator, or by a hymn line) never shifts the others.
  // The returned array carries .stats for the lab.
  // ==========================================================================
  var MAX_TRIES = 6000;
  function bank(stream, opts) {
    opts = opts || {};
    var mode = modeOf(opts.mode);
    var exclude = opts.excludeLines || [];
    var out = [oldQuestion(mode)];
    var stats = { tries: 0, ruleRejects: 0, evalRejects: 0, why: {}, reserves: 0 };
    var reserve = [];
    for (var j = 0; out.length < 7 && j < MAX_TRIES; j++) {
      stats.tries++;
      var c = candidate(stream.fork("try:" + j), mode);
      if (!rules(c).ok) { stats.ruleRejects++; continue; }
      var ev = evaluate(c, out, exclude);
      if (!ev.ok) {
        stats.evalRejects++; stats.why[ev.why] = (stats.why[ev.why] || 0) + 1;
        if (ev.why !== "matches-a-hymn-line") reserve.push(c);
        continue;
      }
      out.push(c);
    }
    // a safety net never seen in 200 seeds × six modes: if the critic was too
    // strict for this seed, the lawful-but-plain candidates it set aside fill
    // the bank, so it always holds seven, and every one keeps the hard rules
    while (out.length < 7 && reserve.length) {
      var rc = reserve.shift();
      var dup = out.some(function (o) { return o.degs.join() === rc.degs.join(); });
      if (!dup) { out.push(rc); stats.reserves++; }
    }
    stats.short = 7 - out.length;                                 // 0, always, in practice
    for (var k = 0; k < out.length; k++) {
      out[k].index = k;
      if (opts.n != null) out[k].meeting = opts.n;
    }
    out.stats = stats;
    return out;
  }

  // pick(bank, stream, {recent}) — one question per meeting; a question
  // recently asked (by id) steps aside unless every one has been. One draw.
  function pick(bk, stream, opts) {
    var recent = (opts && opts.recent) || [];
    var r = stream.next();
    var pool = bk.filter(function (q) { return recent.indexOf(q.id) < 0; });
    if (!pool.length) pool = bk;
    return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
  }

  // ==========================================================================
  // askings(q, stream) → three askings. The first and last verbatim; the
  // middle one BENT — one note displaced a step or two, or the rhythm
  // shifted (a long and a short trade places, or the phrase comes in late
  // and clipped). Ives's trumpet never quite repeats itself; nor does ours.
  // ==========================================================================
  function askings(q, stream) {
    var mode = q.mode, n = q.degs.length;
    var kind = stream.chance(0.55) ? "note" : "rhythm";
    var at = stream.rint(1, n - 2);                                // an interior note
    var dir = stream.chance(0.5) ? 1 : -1;
    var far = stream.chance(0.3);
    var rv = stream.pickW([["swap-head", 2], ["swap-tail", 1.5], ["late", 1.5]]);
    var degs = q.degs.slice(), beats = q.beats.slice(), offset = 0, bend;
    if (kind === "note") {
      var tries = far ? [2 * dir, dir, -dir, -2 * dir, 3 * dir, -3 * dir] : [dir, 2 * dir, -dir, -2 * dir, 3 * dir, -3 * dir];
      for (var t = 0; t < tries.length; t++) {
        var nd = spell(q.degs[at] + tries[t], mode);
        if (nd !== q.degs[at] && nd !== q.degs[at - 1] && nd !== q.degs[at + 1]) { degs[at] = nd; break; }
      }
      if (degs[at] !== q.degs[at]) bend = { kind: "note", index: at, from: q.degs[at], to: degs[at] };
      else kind = "rhythm";                                        // hemmed in on every side: bend the time instead
    }
    if (bend) {
      // bent already
    } else if (rv === "late") {
      offset = Math.min(1, beats[0] / 2);                          // comes in late …
      beats[0] -= offset;                                          // … and the first long is clipped
      bend = { kind: "rhythm", variant: "late", offsetBeats: offset };
    } else {
      var i0 = rv === "swap-head" ? 0 : n - 3;
      if (beats[i0] === beats[i0 + 1]) i0 = i0 === 0 ? n - 3 : 0;
      var tmp = beats[i0]; beats[i0] = beats[i0 + 1]; beats[i0 + 1] = tmp;
      bend = { kind: "rhythm", variant: "swap", index: i0 };
    }
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
  // answers(q, k, material, stream, lattice) → the k-th answer (k from 0:
  // the answer to the first asking; the last asking gets none).
  //
  // The answerers argue in the MEETING'S OWN MATERIAL: fragments of today's
  // hymns, passed in as degree arrays (or Note arrays). One is developed —
  // sequenced upward, inverted, turned back, broken off — and each answer is
  // faster, higher and more scattered than the last. With no material they
  // fall back on the question's own intervals, turned about.
  //
  // Voices: the harmonium answers every time; from the second answer on it
  // plays with a second rank a fifth above (snapped into the scale), and the
  // clarinet joins as a second answerer, higher and quicker still. Every
  // note carries its exact monzo.
  // ==========================================================================
  var DEVELOP = [["sequence", 3], ["invert", 2], ["retro", 2], ["break", 2], ["scatter", 1]];
  function fragmentFrom(material, s, q) {
    var pool = (material || []).map(degsOf).filter(function (m) { return m.length >= 3; });
    var ix = s.next(), len = s.rint(3, 5), off = s.next();
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
  function walk(s, mode, startDeg, iv, count, k, beatSet, lo, hi) {
    var notes = [], deg = startDeg, lift = 0, step = 0;
    var scatterP = 0.04 + 0.3 * k;
    for (var i = 0; i < count; i++) {
      var r1 = s.next(), r2 = s.next(), r3 = s.next();           // drawn for every note
      if (i > 0) {
        deg += iv[step % iv.length];
        step++;
        if (step % iv.length === 0) lift += 1 + (r3 < 0.35 * k ? 1 : 0);   // each pass sequenced higher
        if (r1 < scatterP) deg += r2 < 0.5 ? 7 : -5;               // scattered: flung up an octave, or dropped
      }
      var d = deg + lift;
      while (d > hi) d -= 7;
      while (d < lo) d += 7;
      d = spell(d, mode);
      if (notes.length && d === notes[notes.length - 1].deg) d = spell(d + (r2 < 0.5 ? 1 : -1), mode);
      if (notes.length && d === notes[notes.length - 1].deg) d = spell(d + 2, mode);
      var b = beatSet[Math.floor(r2 * beatSet.length)];
      notes.push({ deg: d, beats: b, monzo: monzo(d, mode) });
    }
    // the answer never ends still — its last note is the longest it has
    notes[notes.length - 1].beats = Math.max(notes[notes.length - 1].beats, k === 0 ? 1.5 : k === 1 ? 1 : 0.75);
    return notes;
  }
  function answers(q, k, material, stream, lattice) {
    var mode = modeOf(lattice || q.mode);
    var s = stream.fork("k:" + k);
    var frag = fragmentFrom(material, s, q);
    var op = s.pickW(DEVELOP);
    var iv = develop(frag.degs, op);
    var count = 4 + 3 * k + s.rint(0, 2);
    // each answer sits higher: its floor and its first note climb with k
    var lo = Math.min.apply(null, q.degs) - 2 + 3 * k;
    var start = q.degs[0] + 3 * k + s.rint(-1, 1);
    var hi = 9 + 3 * k;                                           // and its ceiling
    var beatSet = k === 0 ? [1, 0.75, 1, 1] : k === 1 ? [0.5, 0.5, 0.75, 0.5] : [0.25, 0.5, 0.25, 0.25];
    var delay = Math.round(s.rnd(1.25, 2.25) * 4) / 4;              // the room's breath before anyone answers
    var rest = Math.round(s.rnd(2.5, 4.5) * Math.pow(0.85, k) * 4) / 4;
    var cStart = s.rint(2, 4), cCount = s.rint(3, 5) + k, cEntry = s.rint(1, 3) * 0.5;
    var main = walk(s.fork("harmonium"), mode, start, iv, count, k, beatSet, lo, hi);
    var voices = [{ voice: "harmonium", role: "answer", entryBeats: 0, notes: main }];
    if (k >= 1) {
      // the answerers argue among themselves: a second rank a fifth up, a
      // half-beat behind, every pitch snapped into the scale
      voices.push({
        voice: "harmonium", role: "doubling", entryBeats: 0.5,
        notes: main.map(function (nn) { var dd = fifthIn(nn.deg, mode); return { deg: dd, beats: nn.beats, monzo: monzo(dd, mode) }; }),
      });
      // … and the clarinet, the second answerer: the same fragment turned
      // back on itself, higher, faster
      var civ = develop(frag.degs, op === "retro" ? "invert" : "retro");
      var cSet = beatSet.map(function (b) { return Math.max(0.25, b * 0.75); });
      voices.push({
        voice: "clarinet", role: "answer", entryBeats: cEntry,
        notes: walk(s.fork("clarinet"), mode, start + cStart, civ, cCount, k + 1, cSet, lo + 2, hi + 1),
      });
    }
    var dur = 0;
    for (var v = 0; v < voices.length; v++) {
      var sum = voices[v].entryBeats;
      for (var i = 0; i < voices[v].notes.length; i++) sum += voices[v].notes[i].beats;
      dur = Math.max(dur, sum);
    }
    return {
      k: k, questionId: q.id, mode: mode, from: frag.from, develop: op,
      delayBeats: delay, restBeats: rest, durBeats: dur, voices: voices,
    };
  }

  // ==========================================================================
  // ground(stream) — what lies beneath. Most often the drone alone; one time
  // in three, Ives's own device: the strings, playing a slow chorale from
  // the meeting's hymns at their own tempo, oblivious to the argument.
  // ==========================================================================
  function ground(stream) { return stream.next() < 1 / 3 ? "chorale" : "drone"; }

  // chorale(material, stream, lattice) → { beatS, chords:[{beats, degs:[B,T,A,S], monzos}] }
  // The longest hymn fragment on hand, harmonized plainly in close block
  // chords, slow. Chord tones a gapped scale lacks are simply left out (an
  // open sonority — the brush-arbor sound). The performer loops it.
  var PLAIN_TUNE = [4, 4, 5, 4, 2, 3, 2, 1, 0];                   // when the meeting has no line to lend
  function chorale(material, stream, lattice) {
    var mode = modeOf(lattice);
    var pool = (material || []).map(degsOf).filter(function (m) { return m.length >= 4; });
    var ix = stream.next();
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
      var below = [];
      for (var d = sd - 1; d >= sd - 9 && below.length < 2; d--) if (tones.indexOf(cls(d)) >= 0 && inScale(d, mode)) below.push(d);
      var bass = root - 7;
      if (!inScale(bass, mode)) bass = spell(bass, mode);
      while (bass > -3) bass -= 7;
      var degs = [bass].concat(below.reverse(), [sd]);
      var beats = last ? 4 : (i === 0 || stream.chance(0.25) ? 3 : 2);
      chords.push({ beats: beats, degs: degs, monzos: degs.map(function (x) { return monzo(x, mode); }) });
    }
    return { beatS: beatS, chords: chords };
  }

  // ==========================================================================
  // seat(stream, sections, {needS}) — where the Question sits. The invocation
  // and the testimony are its homes; the sacrament and an interlude are
  // quieter rooms; the postlude sometimes, a question left hanging as the
  // room empties. Capped at 45 % of the section. A section whose cap is
  // shorter than the Question needs (needS) is passed over. One draw.
  // sections: ["invocation", …] or [{type|section, dur}, …] (plan order).
  // ==========================================================================
  var SEAT_W = { invocation: 3, testimony: 3, sacrament: 2, interlude: 2, postlude: 1.5 };
  var CAP = 0.45;
  function seat(stream, sections, opts) {
    var need = (opts && opts.needS) || 0;
    var r = stream.next();
    var pool = [], total = 0;
    (sections || []).forEach(function (sx, i) {
      var name = typeof sx === "string" ? sx : (sx.section || sx.type);
      var dur = typeof sx === "string" ? null : (sx.dur != null ? sx.dur : null);
      if (!SEAT_W[name]) return;
      if (dur != null && dur * CAP < need) return;
      pool.push({ section: name, index: i, dur: dur, w: SEAT_W[name] });
      total += SEAT_W[name];
    });
    if (!pool.length) return null;
    var x = r * total, ch = pool[pool.length - 1];
    for (var p = 0; p < pool.length; p++) { x -= pool[p].w; if (x <= 0) { ch = pool[p]; break; } }
    return { section: ch.section, index: ch.index, capFrac: CAP, capS: ch.dur != null ? ch.dur * CAP : null, sectionS: ch.dur };
  }

  // ==========================================================================
  // timeline(parts, opts) — seconds from the event's start (SCORE §4), for
  // three askings and their answers, then the drone alone (the tail, where
  // "unanswered" is logged). If the natural pace would overrun the cap the
  // breaths shorten first, then the beat quickens (never below 0.6 s), then
  // the tail shrinks (never below 3 s). fits:false means the seat is too
  // small — the caller should seat it elsewhere.
  // ==========================================================================
  var MIN_BEAT = 0.6, MIN_TAIL = 3, MIN_GAP = 0.5;
  function lay(parts, beat, gapMul, tail) {
    var items = [], t = 0;
    for (var k = 0; k < parts.askings.length; k++) {
      var a = parts.askings[k], ab = a.offsetBeats || 0;
      for (var i = 0; i < a.beats.length; i++) ab += a.beats[i];
      items.push({ kind: "asking", k: k, t: t, dur: ab * beat });
      t += ab * beat;
      var an = parts.answers[k];
      if (an && k < parts.askings.length - 1) {
        t += an.delayBeats * gapMul * beat;
        items.push({ kind: "answer", k: k, t: t, dur: an.durBeats * beat });
        t += an.durBeats * beat + an.restBeats * gapMul * beat;
      } else if (k < parts.askings.length - 1) {
        t += 2 * gapMul * beat;
      }
    }
    items.push({ kind: "unanswered", t: t, dur: tail });
    return { items: items, total: t + tail };
  }
  function timeline(parts, opts) {
    opts = opts || {};
    var beat = opts.beatS || 0.85, tail = opts.tailS != null ? opts.tailS : 8, cap = opts.capS;
    var g = 1, L = lay(parts, beat, g, tail);
    if (cap != null) {
      while (L.total > cap && g > MIN_GAP + 1e-9) { g = Math.max(MIN_GAP, g - 0.1); L = lay(parts, beat, g, tail); }
      while (L.total > cap && beat > MIN_BEAT + 1e-9) { beat = Math.max(MIN_BEAT, beat - 0.02); L = lay(parts, beat, g, tail); }
      while (L.total > cap && tail > MIN_TAIL) { tail = Math.max(MIN_TAIL, tail - 0.5); L = lay(parts, beat, g, tail); }
    }
    return { items: L.items, total: L.total, beatS: beat, gapMul: g, tailS: tail, capS: cap == null ? null : cap, fits: cap == null || L.total <= cap + 1e-6 };
  }
  function minimumS(parts) { return timeline(parts, { beatS: MIN_BEAT, tailS: MIN_TAIL, capS: 0 }).total; }

  // ==========================================================================
  // compose(qStream, opts) — the whole event from question:<n>, every fork
  // taken in the contract's names. opts: { mode, n, material, excludeLines,
  // sections, recent, beatS, tailS }. Returns plain JSON.
  // ==========================================================================
  function compose(qs, opts) {
    opts = opts || {};
    var mode = modeOf(opts.mode);
    var bk = bank(qs.fork("bank"), { mode: mode, excludeLines: opts.excludeLines, n: opts.n });
    var ps = qs.fork("pick");
    var q = pick(bk, ps, { recent: opts.recent });
    var beatS = Math.round(ps.rnd(0.8, 0.95) * 100) / 100;         // the asker's pace (v0.30's range)
    var ask = askings(q, qs.fork("bend"));
    var as = qs.fork("answers");
    var ans = [answers(q, 0, opts.material, as, mode), answers(q, 1, opts.material, as, mode)];
    var gs = qs.fork("ground");
    var gr = ground(gs);
    var ch = chorale(opts.material, gs.fork("chorale"), mode);      // drawn always; used one time in three
    var parts = { askings: ask, answers: ans };
    var need = minimumS(parts);
    var st = seat(qs.fork("seat"), opts.sections || ["invocation", "testimony", "sacrament", "interlude", "postlude"], { needS: need });
    var tl = timeline(parts, { beatS: opts.beatS || beatS, tailS: opts.tailS, capS: st ? st.capS : null });
    return {
      question: q, bank: bk, askings: ask, answers: ans, ground: gr,
      chorale: gr === "chorale" ? ch : null, seat: st, needS: need, timeline: tl,
    };
  }

  return {
    MODES: MODES, OLD: OLD, RHYTHMS: RHY, SEAT_WEIGHTS: SEAT_W, CAP: CAP, LEAP_CENTS: LEAP_CENTS,
    bank: bank, pick: pick, askings: askings, answers: answers, ground: ground, chorale: chorale,
    seat: seat, timeline: timeline, minimumS: minimumS, compose: compose,
    rules: rules, evaluate: evaluate, rhythmInFamily: rhythmInFamily,
    spell: spell, inScale: inScale, monzo: monzo, ratio: ratio, ratioOf: ratioOf, cents: cents, fifthIn: fifthIn,
    oldQuestion: oldQuestion,
  };
})();
