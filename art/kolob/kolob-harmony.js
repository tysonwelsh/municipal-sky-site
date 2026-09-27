// ============================================================================
// KOLOB — kolob-harmony.js: the four-part engine
//
// Stacked diatonic triads in 7-degree space, a weighted root grammar with
// plagal gravity, and SATB voicing that rewards the Sacred Harp's parallel
// fifths. Split from kolob-audio.js (v0.30); the house's rooms are listed in
// _engine.php.
//
// PURE (round 2, milestone 2). This room reads nothing of the house: every
// call takes a MOMENT — a plain object, the meeting at an instant, made by
// the chorister (kolob-meeting.js, THE CHORISTER'S BOOK) — and the caller's
// dice, D (a PJ2.Rand stream), as its last two arguments. The fields read
// here are:
//
//   moment.mode, moment.F0   the tuning (the day's mode and fundamental)
//   moment.bright            the Sunday's brightness (open fifths lean dark)
//   moment.section           the rite (the doxology leans home; testimony
//                            stays put)
//   moment.chord             the chord the hall stands on — voice-leading
//                            begins from it; null for a fresh seat
//
// It writes nothing down and tells no one: a chord comes back to the caller,
// who places it in time and announces it (the chorister's CHORD DESK does
// both for the meeting). So the hymn composer can call voice, advance,
// cadence and harmonize as plain functions, as many times as it likes, and
// nothing in the meeting moves. (`D` names the dice, not `R`: in this room
// R has always meant the voices' ranges.)
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Harmony = (function () {
  "use strict";

  // the tuning a moment names (kolob-pitch.js's pure spelling of it)
  function tuningOf(moment) { return window.KOLOB.Pitch.tuning(moment.mode, moment.F0); }
  function rootMult() { return window.KOLOB.Pitch.ROOT_MULT; }
  // the same moment, standing on another chord
  function standingOn(moment, chord) {
    var m = {};
    for (var k in moment) if (Object.prototype.hasOwnProperty.call(moment, k)) m[k] = moment[k];
    m.chord = chord;
    return m;
  }

  // ==========================================================================
  // HARMONY — the four-part engine. No sibling has this.
  // ==========================================================================
  // Chords are stacked diatonic triads in 7-degree space (root, +2, +4),
  // projected into the current collection — so the same machine yields major,
  // minor and modal color as the mode changes. Roots move by a weighted
  // grammar with PLAGAL GRAVITY (IV→I, the amen). Voicing keeps common tones,
  // rejects parallel octaves, and lightly REWARDS parallel fifths — dispersed
  // harmony, the Sacred Harp sound, asserted rather than forbidden.
  var ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii"];
  var CHORD_MOVES = {                 // row = current root (7-space); [nextRoot, weight]
    0: [[3, 3], [4, 2], [5, 2], [1, 1], [2, 0.5], [0, 1.5]],
    1: [[4, 4], [3, 2.5], [0, 2], [5, 1.5]],
    2: [[5, 3.5], [3, 3], [1, 2], [0, 1.5]],
    3: [[0, 4.5], [4, 2], [1, 1.5], [5, 1], [3, 1]],     // IV→I: the amen leads home
    4: [[0, 4], [5, 2.5], [3, 1.5], [4, 1], [2, 0.5]],
    5: [[3, 3], [1, 2.5], [4, 2], [0, 1.5], [2, 1]],
    6: [[0, 3], [5, 2]],
  };
  // Voice ranges as absolute collection-index windows (by the mode's size).
  function ranges(n) {
    return {
      b: [-n - 2, 1],
      t: [-Math.ceil(n * 0.6), n - 1],
      a: [0, n + 2],
      s: [Math.floor(n * 0.45), 2 * n + 1],
    };
  }

  function toneClasses(P, root7, open) {
    var set = {};
    set[P.classOf(P.projDeg(root7))] = "root";
    if (!open) set[P.classOf(P.projDeg(root7 + 2))] = "third";
    set[P.classOf(P.projDeg(root7 + 4))] = "fifth";
    return set;
  }
  // The one 5-limit wolf: over 9/8 re, the ii chord's fifth (re–la) is
  // 40/27. When the sounding chord is ii, re is played at 10/9 instead —
  // a tiny adaptive-tuning override, inaudible as a shift, pure as a fifth.
  function chordFreq(P, idx, root7) {
    var d = P.classOf(idx);
    var oct = Math.floor(idx / P.n);
    var ratio = P.ratios[d];
    if (root7 === 1 && P.n >= 6 && d === P.classOf(P.projDeg(1)) && Math.abs(ratio - 9/8) < 1e-9) ratio = 10/9;
    return P.F0 * rootMult() * ratio * Math.pow(2, oct);
  }
  function nearestOfClass(P, from, classes, lo, hi, dir) {
    // nearest absolute index whose class is a chord tone, within [lo,hi];
    // dir (optional) restricts search direction (for contrary motion).
    for (var off = 0; off <= P.n + 2; off++) {
      var cands = off === 0 ? [from] : (dir === 1 ? [from + off] : dir === -1 ? [from - off] : [from - off, from + off]);
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c < lo || c > hi) continue;
        if (classes[P.classOf(c)]) return c;
      }
    }
    return null;
  }
  function foldRatio(r) { while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; }
  function near(a, b, cents) { return Math.abs(1200 * Math.log2(a / b)) < (cents || 22); }

  // Score a candidate voicing against the previous one. Returns null = illegal.
  function scoreVoicing(P, prev, next, classes, wantThird) {
    var R = ranges(P.n), lims = [R.b, R.t, R.a, R.s];
    var i, j, score = 0, fifthsHere = 0;
    for (i = 0; i < 4; i++) {
      if (next[i] == null) return null;
      if (next[i] < lims[i][0] || next[i] > lims[i][1]) return null;
      if (i > 0 && next[i] <= next[i - 1]) return null;          // no crossing / unison stacking
      score += Math.abs(next[i] - prev[i]);                      // motion economy
    }
    var thirdSeen = false, rootCount = 0;
    for (i = 0; i < 4; i++) {
      var role = classes[P.classOf(next[i])];
      if (role === "third") thirdSeen = true;
      if (role === "root") rootCount++;
    }
    if (wantThird && !thirdSeen) score += 2.5;
    if (rootCount === 0) return null;
    score -= rootCount * 0.3;                                    // doubling: root > fifth > third
    // parallel motion checks on actual frequency ratios (mode-agnostic)
    for (i = 0; i < 4; i++) {
      for (j = i + 1; j < 4; j++) {
        var moved = next[i] !== prev[i] && next[j] !== prev[j];
        if (!moved) continue;
        var sameDir = (next[i] - prev[i]) * (next[j] - prev[j]) > 0;
        if (!sameDir) continue;
        var r0 = foldRatio(P.degFreq(prev[j]) / P.degFreq(prev[i]));
        var r1 = foldRatio(P.degFreq(next[j]) / P.degFreq(next[i]));
        if (near(r0, 1, 12) && near(r1, 1, 12)) return null;     // parallel octaves/unisons: rejected
        if (near(r0, 1.5) && near(r1, 1.5)) { score -= 1.6; fifthsHere++; }  // parallel fifths: rewarded
      }
    }
    return { score: score, fifths: fifthsHere };
  }
  function defaultVoicing(P, root7, classes) {
    // a fresh seat: bass on the root an octave down, upper voices stacked near
    var n = P.n;
    var b = P.classOf(P.projDeg(root7)) - n;
    var t = nearestOfClass(P, b + Math.round(n * 0.6), classes, b + 2, b + n + 2);
    var a = nearestOfClass(P, t + Math.round(n * 0.5), classes, t + 1, t + n);
    var s = nearestOfClass(P, a + Math.round(n * 0.5), classes, a + 1, a + n + 2);
    return [b, t, a, s];
  }
  function chordOf(P, root7, classes, open, voicing, fifths) {
    return {
      root: root7, tones: classes, voicing: voicing, open: open, fifths: fifths || 0,
      freqs: voicing.map(function (idx) { return chordFreq(P, idx, root7); }),
    };
  }

  // A chord, voiced from the one the hall stands on (moment.chord).
  // opts.open forces or forbids the third; opts.cadence keeps the root in
  // the bass. (The audition's chord is voiced the same way and simply not
  // written down — this room writes nothing down.)
  function voice(root7, opts, moment, D) {
    opts = opts || {};
    var P = tuningOf(moment);
    var bright = moment.bright != null ? moment.bright : 0.5;
    var open = opts.open != null ? opts.open : D.chance(0.25 + 0.35 * (1 - bright));
    var classes = toneClasses(P, root7, open);
    var R = ranges(P.n);
    var prev = moment.chord ? moment.chord.voicing.slice() : null;
    var next, fifths = 0;
    if (!prev) next = defaultVoicing(P, root7, classes);
    else {
      // candidates: nearest-motion / contrary soprano / open-dropped alto
      var n = P.n;
      var rootIdx = P.projDeg(root7);
      var bClasses = {}; bClasses[P.classOf(rootIdx)] = "root";
      if (!opts.cadence && D.chance(0.1)) bClasses[P.classOf(P.projDeg(root7 + 4))] = "fifth";  // inversion, never at cadence
      var b = nearestOfClass(P, prev[0], bClasses, R.b[0], R.b[1]);
      var cands = [];
      var c1 = [b,
        nearestOfClass(P, prev[1], classes, R.t[0], R.t[1]),
        nearestOfClass(P, prev[2], classes, R.a[0], R.a[1]),
        nearestOfClass(P, prev[3], classes, R.s[0], R.s[1])];
      cands.push(c1);
      var bassDir = b === prev[0] ? 0 : (b > prev[0] ? 1 : -1);
      if (bassDir !== 0) {
        var sContr = nearestOfClass(P, prev[3] - bassDir, classes, R.s[0], R.s[1], -bassDir);
        cands.push([b,
          nearestOfClass(P, prev[1], classes, R.t[0], R.t[1]),
          nearestOfClass(P, prev[2], classes, R.a[0], R.a[1]),
          sContr != null ? sContr : c1[3]]);
      }
      if (c1[2] != null && c1[2] - n >= R.a[0]) {
        cands.push([b, c1[1], c1[2] - n, c1[3]]);              // dropped alto: the dispersed spread
      }
      // a PLANING candidate: when two upper voices already stand a fifth
      // apart, offer to carry the pair along with the bass — Sacred Harp
      // parallel motion, legal here and welcome
      var bd = b - prev[0];
      if (bd !== 0) {
        for (var pi2 = 1; pi2 < 3; pi2++) {
          var r5 = foldRatio(P.degFreq(prev[pi2 + 1]) / P.degFreq(prev[pi2]));
          if (near(r5, 1.5)) {
            var cp = c1.slice();
            cp[pi2] = prev[pi2] + bd;
            cp[pi2 + 1] = prev[pi2 + 1] + bd;
            if (classes[P.classOf(cp[pi2])] && classes[P.classOf(cp[pi2 + 1])]) cands.push(cp);
            break;
          }
        }
      }
      var best = null, bestScore = 1e9, bestFifths = 0;
      for (var ci = 0; ci < cands.length; ci++) {
        var sc = scoreVoicing(P, prev, cands[ci], classes, !open);
        if (sc && sc.score < bestScore) { best = cands[ci]; bestScore = sc.score; bestFifths = sc.fifths; }
      }
      next = best || defaultVoicing(P, root7, classes);
      fifths = best ? bestFifths : 0;
    }
    return chordOf(P, root7, classes, open, next, fifths);
  }

  // THE PINNED SOPRANO (round 2). Under a melodic line the soprano is the
  // tune, so it is fixed first and the alto, tenor and bass are seated
  // beneath it: every seating of chord tones with B < T < A < S is tried
  // (they are few — the ranges are narrow and a triad has three classes),
  // scored like any voicing (motion from the chord before, the third
  // present, the root doubled, parallel octaves refused, parallel fifths
  // welcome) and held to the hymnal's SPACING: no more than an octave
  // between soprano and alto, or alto and tenor. v0.32 voiced the chord
  // first and then wrote the tune over its soprano, which left the alto at
  // or above the tune in a fifth of the chords it sang, and reported the
  // voicing it never sang.
  //
  // When nothing passes — the tune sits low, or the voices would move in
  // octaves with it — the choir reaches, in this order, for what a hymnal's
  // arranger would: the spacing becomes a cost; the lower voices go a
  // third further down (the bass to E2, the tenor to B2, the alto to A3:
  // still a singer's notes);
  // the bass takes the chord's third or fifth (a sixth chord); a BARE FIFTH
  // takes its third back (two classes among four voices can leave no way
  // out of consecutive octaves); and only then are consecutive octaves
  // allowed, at a cost. The last resort, which the harness has never seen,
  // is the fresh seat dropped an octave at a time until it stands under the
  // tune. The chord records how far the choir had to reach (seat).
  var SEAT_LADDER = [
    // [further down (0, or "low"), spacing a cost, octaves a cost, any bass, the third back]
    [0, false, false, false, false],
    [0, true, false, false, false],
    ["low", true, false, false, false],
    [0, true, false, true, false],
    ["low", true, false, true, false],
    [0, true, false, true, true],
    ["low", true, false, true, true],
    ["low", true, true, true, false],
  ];
  function seatUnder(P, root7, open, s, lead, D) {
    var n = P.n, R = ranges(n);
    var roles = toneClasses(P, root7, false);          // what each class IS in the chord
    var bRoot = {}; bRoot[P.classOf(P.projDeg(root7))] = true;
    // the free voicing's inversion die, thrown under the same condition
    if (lead && D.chance(0.1)) bRoot[P.classOf(P.projDeg(root7 + 4))] = true;
    var prev = lead ? lead.voicing : null;
    var home = prev || defaultVoicing(P, root7, toneClasses(P, root7, open));   // a fresh seat sits near the default one
    function score(v, bare, softSpacing, softParallels) {
      var sc = 0, fifths = 0, i, j;
      for (i = 0; i < 4; i++) sc += Math.abs(v[i] - home[i]);
      var thirdSeen = false, rootCount = 0;
      for (i = 0; i < 4; i++) {
        var role = roles[P.classOf(v[i])];
        if (role === "third") thirdSeen = true;
        if (role === "root") rootCount++;
      }
      if (!bare && !thirdSeen) sc += 2.5;
      if (rootCount === 0) return null;
      sc -= rootCount * 0.3;
      var wide = (v[3] - v[2] > n ? 1 : 0) + (v[2] - v[1] > n ? 1 : 0);
      if (wide) { if (!softSpacing) return null; sc += 3 * wide; }
      if (prev) {
        for (i = 0; i < 4; i++) {
          for (j = i + 1; j < 4; j++) {
            if (v[i] === prev[i] || v[j] === prev[j]) continue;
            if ((v[i] - prev[i]) * (v[j] - prev[j]) <= 0) continue;
            var r0 = foldRatio(P.degFreq(prev[j]) / P.degFreq(prev[i]));
            var r1 = foldRatio(P.degFreq(v[j]) / P.degFreq(v[i]));
            if (near(r0, 1, 12) && near(r1, 1, 12)) { if (!softParallels) return null; sc += 6; }
            else if (near(r0, 1.5) && near(r1, 1.5)) { sc -= 1.6; fifths++; }
          }
        }
      }
      return { score: sc, fifths: fifths };
    }
    function search(drop, softSpacing, softParallels, anyBass, bare) {
      var classes = toneClasses(P, root7, bare);
      var bc = anyBass ? classes : bRoot, best = null;
      for (var b = R.b[0] - drop; b <= Math.min(R.b[1], s - 3); b++) {
        if (!bc[P.classOf(b)]) continue;
        for (var t = Math.max(R.t[0] - drop, b + 1); t <= Math.min(R.t[1], s - 2); t++) {
          if (!classes[P.classOf(t)]) continue;
          for (var a = Math.max(R.a[0] - drop, t + 1); a <= Math.min(R.a[1], s - 1); a++) {
            if (!classes[P.classOf(a)]) continue;
            var v = [b, t, a, s], sc = score(v, bare, softSpacing, softParallels);
            if (sc && (!best || sc.score < best.score)) best = { v: v, score: sc.score, fifths: sc.fifths, open: bare, classes: classes };
          }
        }
      }
      return best;
    }
    var found = null, pass = 0;
    while (!found && pass < SEAT_LADDER.length) {
      var L = SEAT_LADDER[pass++];
      if (L[4] && !open) continue;                     // the third back: only a bare fifth has it to give
      var drop = L[0] === "low" ? Math.floor(n * 3 / 7) : 0;   // a third further down: E2 for the bass, B2 for the tenor
      found = search(drop, L[1], L[2], L[3], L[4] ? false : open);
    }
    var ch;
    if (found) ch = chordOf(P, root7, found.classes, found.open, found.v, found.fifths);
    else {
      var cls = toneClasses(P, root7, open);
      var d = defaultVoicing(P, root7, cls);
      var a = d[2], t = d[1], b = d[0];
      while (a >= s) a -= n;
      while (t >= a) t -= n;
      while (b >= t) b -= n;
      ch = chordOf(P, root7, cls, open, [b, t, a, s], 0);
      pass = SEAT_LADDER.length + 1;
    }
    ch.pinned = true;
    if (pass > 1) ch.seat = pass;                      // how far the choir had to reach (the harness counts it)
    return ch;
  }

  // The next chord by the root grammar, voiced from moment.chord.
  function advance(opts, moment, D) {
    opts = opts || {};
    var from = moment.chord ? moment.chord.root : 0;
    var pool = (CHORD_MOVES[from] || CHORD_MOVES[0]).map(function (m) { return m.slice(); });
    if (moment.section === "doxology") pool.forEach(function (m) { if (from === 3 && m[0] === 0) m[1] *= 2.5; });
    if (moment.section === "testimony") pool.forEach(function (m) { if (m[0] !== from) m[1] *= 0.5; });
    var root7 = opts.root != null ? opts.root : D.pickW(pool);
    return voice(root7, opts, moment, D);
  }
  // A cadence is a two-chord act. Plagal is the house style — the amen.
  // The second chord is voiced from the first.
  function cadence(kind, moment, D) {
    var seq = kind === "authentic" ? [4, 0] : kind === "half" ? [moment.chord ? moment.chord.root : 0, 4] : [3, 0];
    var out = [], m = moment;
    for (var i = 0; i < seq.length; i++) {
      var ch = voice(seq[i], { cadence: true, open: i === seq.length - 1 ? D.chance(0.55) : false }, m, D);
      out.push(ch);
      m = standingOn(moment, ch);
    }
    return out;
  }
  // Set an SATB frame under a melodic line (the lining-out answer, the
  // verse, the whole tune at last): a root for each note from the grammar,
  // then the soprano pinned to the note (brought into the soprano's compass
  // by octaves, as it always was) and the other three seated beneath it.
  // lineNotes: [{deg (7-space), dur (beats)}]. Returns [{chord, dur}], each
  // chord voiced from the one before it (the first from moment.chord).
  function harmonize(lineNotes, moment, D) {
    var P = tuningOf(moment), R = ranges(P.n);
    var out = [], lead = moment.chord || null;
    var prevRoot = lead ? lead.root : 0;
    for (var i = 0; i < lineNotes.length; i++) {
      var idx = P.projDeg(lineNotes[i].deg);
      var cls = P.classOf(idx);
      // candidate roots whose triads contain this melody class
      var roots = [];
      for (var r = 0; r < 7; r++) {
        var tc = toneClasses(P, r, false);
        if (tc[cls]) {
          var w = 1;
          var moves = CHORD_MOVES[prevRoot] || [];
          for (var mi = 0; mi < moves.length; mi++) if (moves[mi][0] === r) w = moves[mi][1];
          roots.push([r, w]);
        }
      }
      var root7 = roots.length ? D.pickW(roots) : 0;
      var open = D.chance(0.3);
      var sIdx = idx;
      while (sIdx < R.s[0]) sIdx += P.n;
      while (sIdx > R.s[1]) sIdx -= P.n;
      var ch = seatUnder(P, root7, open, sIdx, lead, D);
      out.push({ chord: ch, dur: lineNotes[i].dur });
      lead = ch;
      prevRoot = root7;
    }
    return out;
  }
  // the chord's tone classes, as a set (for the voices that lean onto it)
  function chordTones(chord) {
    if (!chord) return null;
    var out = {}; for (var k in chord.tones) out[k] = true;
    return out;
  }

  return {
    ROMAN: ROMAN, ranges: ranges,
    voice: voice, advance: advance, cadence: cadence, harmonize: harmonize,
    chordTones: chordTones, standingOn: standingOn,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-harmony.js"] = true;   // the load guard's roll call
