// ============================================================================
// KOLOB — kolob-harmony.js: the four-part engine
//
// Stacked diatonic triads in 7-degree space, a weighted root grammar with
// plagal gravity, and SATB voicing that rewards the Sacred Harp's parallel
// fifths. Split from kolob-audio.js (v0.30); see the room list in
// kolob-core.js.
//
// Its dice are the caller's (round 2): advance, voice, cadence and harmonize
// take the caller's stream as D (the caller's dice), their last argument —
// not R, which in this room has always named the voices' ranges.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-pitch.js
  function COL() { return S.COL(); }
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  // from kolob-core.js
  function emitEvent(ev) { return S.emitEvent(ev); }
  // (the other rooms' state, read and written through S: S.F0, S.ROOT_MULT,
  // S.MEETINGS, S.C)

  // ==========================================================================
  // HARMONY — the four-part engine. No sibling has this.
  // ==========================================================================
  // Chords are stacked diatonic triads in 7-degree space (root, +2, +4),
  // projected into the current collection — so the same machine yields major,
  // minor and modal color as the mode changes. Roots move by a weighted
  // grammar with PLAGAL GRAVITY (IV→I, the amen). Voicing keeps common tones,
  // rejects parallel octaves, and lightly REWARDS parallel fifths — dispersed
  // harmony, the Sacred Harp sound, asserted rather than forbidden.
  var Harmony = (function () {
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
    // Voice ranges as absolute collection-index windows (rebuilt per mode).
    function ranges() {
      var n = colN();
      return {
        b: [-n - 2, 1],
        t: [-Math.ceil(n * 0.6), n - 1],
        a: [0, n + 2],
        s: [Math.floor(n * 0.45), 2 * n + 1],
      };
    }
    var cur = null;                     // { root, tones{}, voicing[b,t,a,s], freqs[], open }
    var parallelFifths = 0;             // counted, reported — they should be > 0

    function toneClasses(root7, open) {
      var n = colN(), set = {};
      set[((projDeg(root7) % n) + n) % n] = "root";
      if (!open) set[((projDeg(root7 + 2) % n) + n) % n] = "third";
      set[((projDeg(root7 + 4) % n) + n) % n] = "fifth";
      return set;
    }
    // The one 5-limit wolf: over 9/8 re, the ii chord's fifth (re–la) is
    // 40/27. When the sounding chord is ii, re is played at 10/9 instead —
    // a tiny adaptive-tuning override, inaudible as a shift, pure as a fifth.
    function chordFreq(idx, root7) {
      var n = colN();
      var d = ((idx % n) + n) % n;
      var oct = Math.floor(idx / n);
      var ratio = COL().ratios[d];
      if (root7 === 1 && n >= 6 && d === ((projDeg(1) % n) + n) % n && Math.abs(ratio - 9/8) < 1e-9) ratio = 10/9;
      return S.F0 * S.ROOT_MULT * ratio * Math.pow(2, oct);
    }
    function classOf(idx) { var n = colN(); return ((idx % n) + n) % n; }
    function nearestOfClass(from, classes, lo, hi, dir) {
      // nearest absolute index whose class is a chord tone, within [lo,hi];
      // dir (optional) restricts search direction (for contrary motion).
      for (var off = 0; off <= colN() + 2; off++) {
        var cands = off === 0 ? [from] : (dir === 1 ? [from + off] : dir === -1 ? [from - off] : [from - off, from + off]);
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          if (c < lo || c > hi) continue;
          if (classes[classOf(c)]) return c;
        }
      }
      return null;
    }
    function foldRatio(r) { while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; }
    function near(a, b, cents) { return Math.abs(1200 * Math.log2(a / b)) < (cents || 22); }

    // Score a candidate voicing against the previous one. Returns null = illegal.
    function scoreVoicing(prev, next, classes, wantThird) {
      var R = ranges(), keys = ["b", "t", "a", "s"], lims = [R.b, R.t, R.a, R.s];
      var i, j, score = 0, fifthsHere = 0;
      for (i = 0; i < 4; i++) {
        if (next[i] == null) return null;
        if (next[i] < lims[i][0] || next[i] > lims[i][1]) return null;
        if (i > 0 && next[i] <= next[i - 1]) return null;          // no crossing / unison stacking
        score += Math.abs(next[i] - prev[i]);                      // motion economy
      }
      var thirdSeen = false, rootCount = 0;
      for (i = 0; i < 4; i++) {
        var role = classes[classOf(next[i])];
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
          var r0 = foldRatio(degFreq(prev[j]) / degFreq(prev[i]));
          var r1 = foldRatio(degFreq(next[j]) / degFreq(next[i]));
          if (near(r0, 1, 12) && near(r1, 1, 12)) return null;     // parallel octaves/unisons: rejected
          if (near(r0, 1.5) && near(r1, 1.5)) { score -= 1.6; fifthsHere++; }  // parallel fifths: rewarded
        }
      }
      return { score: score, fifths: fifthsHere };
    }
    function defaultVoicing(root7, classes) {
      // a fresh seat: bass on the root an octave down, upper voices stacked near
      var n = colN();
      var rootIdx = projDeg(root7);
      var b = ((rootIdx % n) + n) % n - n;
      var t = nearestOfClass(b + Math.round(n * 0.6), classes, b + 2, b + n + 2);
      var a = nearestOfClass(t + Math.round(n * 0.5), classes, t + 1, t + n);
      var s = nearestOfClass(a + Math.round(n * 0.5), classes, a + 1, a + n + 2);
      return [b, t, a, s];
    }
    // opts.dry: voice the chord from where the harmony stands, but write
    // nothing down (the rail's audition: the meeting's harmony never moves)
    function voice(root7, opts, D) {
      opts = opts || {};
      var bright = S.C.meeting ? S.MEETINGS[S.C.meeting.activity].bright : 0.5;
      var open = opts.open != null ? opts.open : D.chance(0.25 + 0.35 * (1 - bright));
      var classes = toneClasses(root7, open);
      var R = ranges();
      var prev = cur ? cur.voicing.slice() : null;
      var next;
      if (!prev) next = defaultVoicing(root7, classes);
      else {
        // candidates: nearest-motion / contrary soprano / open-dropped alto
        var n = colN();
        var rootIdx = projDeg(root7);
        var bClasses = {}; bClasses[classOf(rootIdx)] = "root";
        if (!opts.cadence && D.chance(0.1)) bClasses[classOf(projDeg(root7 + 4))] = "fifth";  // inversion, never at cadence
        var b = nearestOfClass(prev[0], bClasses, R.b[0], R.b[1]);
        var cands = [];
        var c1 = [b,
          nearestOfClass(prev[1], classes, R.t[0], R.t[1]),
          nearestOfClass(prev[2], classes, R.a[0], R.a[1]),
          nearestOfClass(prev[3], classes, R.s[0], R.s[1])];
        cands.push(c1);
        var bassDir = b === prev[0] ? 0 : (b > prev[0] ? 1 : -1);
        if (bassDir !== 0) {
          var sContr = nearestOfClass(prev[3] - bassDir, classes, R.s[0], R.s[1], -bassDir);
          cands.push([b,
            nearestOfClass(prev[1], classes, R.t[0], R.t[1]),
            nearestOfClass(prev[2], classes, R.a[0], R.a[1]),
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
            var r5 = foldRatio(degFreq(prev[pi2 + 1]) / degFreq(prev[pi2]));
            if (near(r5, 1.5)) {
              var cp = c1.slice();
              cp[pi2] = prev[pi2] + bd;
              cp[pi2 + 1] = prev[pi2 + 1] + bd;
              if (classes[classOf(cp[pi2])] && classes[classOf(cp[pi2 + 1])]) cands.push(cp);
              break;
            }
          }
        }
        var best = null, bestScore = 1e9, bestFifths = 0;
        for (var ci = 0; ci < cands.length; ci++) {
          var sc = scoreVoicing(prev, cands[ci], classes, !open);
          if (sc && sc.score < bestScore) { best = cands[ci]; bestScore = sc.score; bestFifths = sc.fifths; }
        }
        next = best || defaultVoicing(root7, classes);
        if (bestFifths > 0 && !opts.dry) parallelFifths += bestFifths;
      }
      var freqs = next.map(function (idx) { return chordFreq(idx, root7); });
      var chord = { root: root7, tones: classes, voicing: next, freqs: freqs, open: open };
      if (opts.dry) return chord;
      cur = chord;
      emitEvent({
        cat: "harmony",
        label: "♮ " + ROMAN[root7] + (open ? " open" : ""),
        detail: "b" + next[0] + " t" + next[1] + " a" + next[2] + " s" + next[3] +
          (parallelFifths ? " · 5ths " + parallelFifths : ""),
      });
      return cur;
    }
    function advance(opts, D) {
      opts = opts || {};
      var from = cur ? cur.root : 0;
      var pool = (CHORD_MOVES[from] || CHORD_MOVES[0]).map(function (m) { return m.slice(); });
      if (S.C.section === "doxology") pool.forEach(function (m) { if (from === 3 && m[0] === 0) m[1] *= 2.5; });
      if (S.C.section === "testimony") pool.forEach(function (m) { if (m[0] !== from) m[1] *= 0.5; });
      var root7 = opts.root != null ? opts.root : D.pickW(pool);
      return voice(root7, opts, D);
    }
    // A cadence is a two-chord act. Plagal is the house style — the amen.
    function cadence(kind, D) {
      var seq = kind === "authentic" ? [4, 0] : kind === "half" ? [cur ? cur.root : 0, 4] : [3, 0];
      var out = [];
      for (var i = 0; i < seq.length; i++) out.push(voice(seq[i], { cadence: true, open: i === seq.length - 1 ? D.chance(0.55) : false }, D));
      emitEvent({ cat: "harmony", label: "∴ " + (kind || "plagal") + " cadence", detail: kind === "half" ? "resting on the dominant" : "amen" });
      return out;
    }
    // Set an SATB frame under a melodic line (the lining-out answer): the
    // soprano is pinned to the line; the machine voices beneath it.
    function harmonize(lineNotes, D) {
      var out = [], prevRoot = cur ? cur.root : 0;
      for (var i = 0; i < lineNotes.length; i++) {
        var idx = projDeg(lineNotes[i].deg);
        var cls = classOf(idx);
        // candidate roots whose triads contain this melody class
        var roots = [];
        for (var r = 0; r < 7; r++) {
          var tc = toneClasses(r, false);
          if (tc[cls]) {
            var w = 1;
            var moves = CHORD_MOVES[prevRoot] || [];
            for (var mi = 0; mi < moves.length; mi++) if (moves[mi][0] === r) w = moves[mi][1];
            roots.push([r, w]);
          }
        }
        var root7 = roots.length ? D.pickW(roots) : 0;
        var ch = voice(root7, { open: D.chance(0.3) }, D);
        // pin the soprano: replace with the melody index (kept within range by octave)
        var R = ranges();
        var sIdx = idx;
        while (sIdx < R.s[0]) sIdx += colN();
        while (sIdx > R.s[1]) sIdx -= colN();
        ch = { root: ch.root, tones: ch.tones, open: ch.open, voicing: [ch.voicing[0], ch.voicing[1], ch.voicing[2], sIdx] };
        ch.freqs = ch.voicing.map(function (ix) { return chordFreq(ix, ch.root); });
        cur = ch;
        out.push({ chord: ch, dur: lineNotes[i].dur });
        prevRoot = root7;
      }
      return out;
    }
    function chordToneClasses() {
      if (!cur) return null;
      var out = {}; for (var k in cur.tones) out[k] = true;
      return out;
    }
    function reset() { cur = null; }
    return {
      advance: advance, voice: voice, cadence: cadence, harmonize: harmonize,
      current: function () { return cur; },
      chordTones: chordToneClasses,
      fifthCount: function () { return parallelFifths; },
      reset: reset,
    };
  })();

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.Harmony = Harmony;
  // the room's public face on the KOLOB namespace
  KOLOB.Harmony = Harmony;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-harmony.js"] = true;   // the load guard's roll call
})();
