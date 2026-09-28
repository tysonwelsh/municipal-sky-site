// ============================================================================
// KOLOB — kolob-dialects.js: the harmonic languages of the ward
//
// American hymnody is not one sound (PLAN-COMPOSITION §3). The same tune set
// by a Salt Lake organist of 1889 and by a Georgia singing school of 1844 is
// two different worlds: one puts the tune on top and fills it with warm
// thirds, first inversions, a dominant seventh, a secondary dominant where
// the words lift and a 4–3 suspension at the close; the other puts the tune
// in the tenor, builds open fifths and octaves around it, lets the parts
// run in parallel fifths and cross, and ends every line on a bare fifth.
// And the Old Way barely harmonizes at all: one slow tune, ornamented by
// every singer in the room.
//
// This room holds the first three dialects (PLAN Phase 2 order):
//   C  TABERNACLE   soprano melody; phrase-grammar harmony planned backwards
//                   from each line's cadence; a Victorian voice-leading
//                   search (no parallels, no crossing, common tones kept,
//                   tendency tones resolved); then the non-chord tones.
//   A  SACRED HARP  tenor melody; bass, treble and (sometimes) alto written
//                   by counterpoint against it, each a line of its own;
//                   fifths and octaves preferred, thirds allowed; parallel
//                   fifths welcome; modal minor, no raised leading tone;
//                   bare-fifth endings; no amen.
//   F  THE OLD WAY  the tune alone, slow, with ornament slots for the
//                   singers who will decorate it (the performer's work).
//
// Each dialect is a PROFILE (the weights the composer draws its frame and
// skeleton from: meters, modes of time, cadences, endings, ranges, the
// melody's appetites) and a HARMONIZER. The profiles were set against the
// Earth tunes (kolob-tunes.js): the 1889 Psalmody tunes for C, the 1844
// Sacred Harp tunes for A, and their measured fingerprints are the
// tolerances the composer's checks hold a new hymn to.
//
// PURE (SCORE.md §1): no audio, no clock, no dice of its own — every draw is
// thrown from the stream the composer hands in. Loads headless.
//
// Public surface: KOLOB.Dialects = { get(name), names, tabernacle,
//   sacredharp, oldway, chordAt(mode, degs[]) (a sonority read as a chord) }
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Dialects = (function () {
  "use strict";

  // ---- the scale (as kolob-composer.js counts it: deg 0 is the final) ------
  var SEMIS = {
    ionian: [0, 2, 4, 5, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  };
  SEMIS.penta = SEMIS.hexa = SEMIS.ionian;
  var MINOR = { aeolian: true, dorian: true };
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };
  function cls(d) { return ((d % 7) + 7) % 7; }
  function semi(mode, d, alt) { return 12 * Math.floor(d / 7) + SEMIS[mode][cls(d)] + (alt || 0); }
  function u01(R) { return R.next ? R.next() : R.rnd(0, 1); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  var EPS = 1e-6;
  var ROMAN_UP = ["I", "II", "III", "IV", "V", "VI", "VII"];

  // ==========================================================================
  // CHORDS — a root, the classes above it, any chromatic alteration
  // ==========================================================================
  // tones: [{c: class, alt}], root first; q: the quality; fn: the function
  // the grammar reads (T tonic, P predominant, D dominant, A applied, C the
  // cadential six-four); roman: its name. Everything is counted from the
  // final, so the tables below serve every mode.
  function mk(name, root, fn, extra) {
    extra = extra || {};
    var tones = [{ c: root, alt: 0 }, { c: cls(root + 2), alt: extra.a3 || 0 }, { c: cls(root + 4), alt: extra.a5 || 0 }];
    if (extra.seventh) tones.push({ c: cls(root + 6), alt: extra.a7 || 0 });
    if (extra.no5) tones.splice(2, 1);
    return { name: name, root: root, tones: tones, fn: fn, sev: !!extra.seventh, cost: extra.cost || 0, only: extra.only || null,
             bassOnly: extra.bassOnly != null ? extra.bassOnly : null, inv0: extra.inv0 != null ? extra.inv0 : 0, to: extra.to || null, dim7: !!extra.dim7 };
  }
  function qualityOf(mode, ch) {
    var r = SEMIS[mode][ch.root], iv = ch.tones.map(function (t) { return ((SEMIS[mode][t.c] + t.alt - r) % 12 + 12) % 12; });
    var third = iv[1], fifth = iv.length > 2 ? iv[2] : null, sev = ch.sev ? iv[iv.length - 1] : null;
    if (ch.dim7) return "dim";
    if (sev != null) {
      if (third === 4 && fifth === 7 && sev === 10) return "dom7";
      if (third === 4 && fifth === 7 && sev === 11) return "maj7";
      if (third === 3 && fifth === 7 && sev === 10) return "min7";
      if (third === 3 && fifth === 6 && sev === 10) return "hdim7";
      return "other";
    }
    if (third === 4 && fifth === 7) return "maj";
    if (third === 3 && fifth === 7) return "min";
    if (third === 3 && fifth === 6) return "dim";
    if (third === 4 && fifth === 8) return "aug";
    return "other";
  }
  function romanOf(mode, ch) {
    if (ch.label) return ch.label;
    var q = qualityOf(mode, ch), r = ROMAN_UP[ch.root];
    var flat = (mode === "mixolydian" || MINOR[mode]) && (SEMIS.ionian[ch.root] !== SEMIS[mode][ch.root]) ? "♭" : "";
    if (q === "min" || q === "min7" || q === "dim" || q === "hdim7") r = r.toLowerCase();
    return flat + r + (q === "dim" ? "°" : "") + (ch.sev ? "7" : "");
  }

  // the Tabernacle's vocabulary, per mode family. cost: its standing price in
  // the grammar; only: where it may stand ("cad" before a cadence, "approach"
  // before the tune's peak); to: an applied chord's one resolution.
  function tabernacleVocab(mode) {
    var V = [];
    if (mode === "ionian" || mode === "penta" || mode === "hexa") {
      V.push(mk("I", 0, "T"), mk("ii", 1, "P"), mk("iii", 2, "T", { cost: 0.9 }), mk("IV", 3, "P"), mk("V", 4, "D"), mk("vi", 5, "T", { cost: 0.15 }),
             mk("vii°", 6, "D", { cost: 1.2, bassOnly: 1 }), mk("V7", 4, "D", { seventh: true, cost: 0.2 }), mk("ii7", 1, "P", { seventh: true, cost: 0.7, bassOnly: 1 }),
             mk("V/V", 1, "A", { a3: 1, cost: 0.35, to: ["V", "V7", "I64"] }), mk("V7/V", 1, "A", { a3: 1, seventh: true, cost: 0.55, to: ["V", "V7", "I64"] }),
             mk("V7/IV", 0, "A", { seventh: true, a7: -1, cost: 0.6, to: ["IV", "ii"] }), mk("V/vi", 2, "A", { a3: 1, cost: 1.0, to: ["vi"] }),
             mk("vii°7/V", 3, "A", { a3: 0, cost: 0.35, dim7: true, only: "approach", to: ["V", "V7", "I64"] }),
             mk("I64", 0, "C", { bassOnly: 2, cost: 0.2, to: ["V", "V7"] }));
      // the diminished seventh on the raised fourth: F♯ A C E♭
      var d7 = V[V.length - 2]; d7.tones = [{ c: 3, alt: 1 }, { c: 5, alt: 0 }, { c: 0, alt: 0 }, { c: 2, alt: -1 }]; d7.sev = true;
    } else if (MINOR[mode]) {
      V.push(mk("i", 0, "T"), mk("III", 2, "T", { cost: 0.3 }), mk("iv", 3, "P"), mk("v", 4, "D", { cost: 0.6 }), mk("V", 4, "D", { a3: 1 }),
             mk("V7", 4, "D", { a3: 1, seventh: true, cost: 0.2 }), mk("VI", 5, "T", { cost: 0.2 }), mk("VII", 6, "D", { cost: 0.4 }),
             mk("vii°7", 6, "A", { cost: 0.4, dim7: true, only: "approach", to: ["i", "V", "V7", "i64"] }), mk("i64", 0, "C", { bassOnly: 2, cost: 0.2, to: ["V", "V7"] }));
      var dd = V[V.length - 2]; dd.tones = [{ c: 6, alt: 1 }, { c: 1, alt: 0 }, { c: 3, alt: 0 }, { c: 5, alt: 0 }]; dd.sev = true;
      if (mode === "aeolian") V.push(mk("ii°", 1, "P", { bassOnly: 1, cost: 0.5 }));
      else V.push(mk("ii", 1, "P", { cost: 0.3 }), mk("IV", 3, "P", { cost: 0.4 }));
      if (mode === "dorian") V = V.filter(function (c) { return c.name !== "iv"; }).concat([mk("iv", 3, "P", { a3: -1, cost: 1.5 })]);
    } else {                                                     // mixolydian
      V.push(mk("I", 0, "T"), mk("ii", 1, "P", { cost: 0.3 }), mk("IV", 3, "P"), mk("v", 4, "D", { cost: 0.3 }), mk("V", 4, "D", { a3: 1, cost: 0.5 }),
             mk("V7", 4, "D", { a3: 1, seventh: true, cost: 0.6 }), mk("vi", 5, "T", { cost: 0.3 }), mk("♭VII", 6, "D", { cost: 0.2 }),
             mk("I64", 0, "C", { bassOnly: 2, cost: 0.3, to: ["V", "V7"] }));
    }
    V.forEach(function (c) { c.q = qualityOf(mode, c); c.roman = c.name; });
    return V;
  }
  function chordHas(ch, c, alt) { for (var i = 0; i < ch.tones.length; i++) if (ch.tones[i].c === c && (alt == null || ch.tones[i].alt === alt)) return true; return false; }
  function toneOf(ch, c) { for (var i = 0; i < ch.tones.length; i++) if (ch.tones[i].c === c) return ch.tones[i]; return null; }

  // ==========================================================================
  // SLOTS — the melody read as the places a chord can stand: one per
  // syllable (a melisma's second note belongs to its syllable's chord)
  // ==========================================================================
  function slotsOf(line) {
    var mel = line.notes, S = [];
    mel.forEach(function (n, i) {
      if (n.cont && S.length) { S[S.length - 1].notes.push(n); S[S.length - 1].beats = n.beat + n.beats - S[S.length - 1].beat; return; }
      S.push({ beat: n.beat, beats: n.beats, deg: n.deg, stress: n.stress, notes: [n], idx: i });
    });
    // the long note (the cadence), and a feminine ending's syllables after it
    var fin = S.length - 1;
    while (fin > 0 && !S[fin].stress) fin--;
    S.forEach(function (s, k) { s.final = k === fin; s.trail = k > fin; });
    S.fin = fin;
    return S;
  }

  // ==========================================================================
  // C. THE TABERNACLE — the chords, planned backwards from the cadence
  // ==========================================================================
  // A Viterbi search over the vocabulary, slot by slot, with the cadence's
  // chords fixed first: an authentic close is V (or V7) to I, and may be
  // approached through the cadential six-four; a half close rests on V; a
  // deceptive one turns from V to vi; the Tabernacle's second-line arrival
  // may tonicize the dominant (V/V → V) or, in minor, the relative major.
  var FN_COST = {
    T: { T: 0.6, P: 0.15, D: 0.3, A: 0.35, C: 0.45 },
    P: { T: 0.7, P: 0.6, D: 0.05, A: 0.3, C: 0.1 },
    D: { T: 0.05, P: 1.8, D: 0.6, A: 1.5, C: 2.5 },
    A: { T: 8, P: 8, D: 8, A: 8, C: 8 },
    C: { T: 8, P: 8, D: 8, A: 8, C: 8 },
  };
  var PAIR = {
    "I>vi": 0.2, "vi>I": 0.8, "IV>I": 0.35, "ii>I": 1.5, "IV>ii": 0.2, "ii>IV": 1.2, "V>vi": 0.4, "V7>vi": 0.35, "V>V7": 0.1, "V7>V": 3,
    "vi>ii": 0.05, "vi>IV": 0.1, "iii>vi": 0.1, "I>iii": 0.7, "vii°>I": 0.1, "V>IV": 1.5, "i>VI": 0.2, "VI>iv": 0.1, "VI>ii°": 0.1,
    "VII>III": 0.05, "III>iv": 0.2, "III>VI": 0.2, "v>i": 0.6, "VII>i": 0.4, "iv>i": 0.4, "♭VII>I": 0.1, "v>I": 0.5, "I>♭VII": 0.3,
    "VI>V": 0.15, "iv>V": 0.05, "i>v": 0.4, "IV>♭VII": 0.4, "III>VII": 0.5,
  };
  function chordTrans(a, b, strong) {
    if (a.to) return a.to.indexOf(b.name) >= 0 ? 0 : 8;
    if (a.name === b.name) return strong ? 0.55 : 0.1;
    if (b.fn === "C" && a.fn === "C") return 8;
    if (a.sev && a.fn === "D" && b.fn !== "T") return 4;
    var k = a.name + ">" + b.name;
    if (has(PAIR, k)) return PAIR[k];
    return (FN_COST[a.fn] || FN_COST.T)[b.fn];
  }
  // the chords a cadence allows at its last two (three) places, by kind
  function cadenceChords(kind, mode, plan, vocab) {
    var minor = !!MINOR[mode], I = minor ? "i" : "I";
    var names = function (arr) { return arr.filter(function (n) { return vocab.some(function (c) { return c.name === n; }); }); };
    switch (plan) {
      case "tonicize": return { fin: ["V"], pen: names(["V/V", "V7/V"]), ante: null };
      case "relative": return { fin: ["III"], pen: ["VII"], ante: null };
    }
    switch (kind) {
      case "authentic": return { fin: [I], pen: names(mode === "mixolydian" ? ["V", "V7", "♭VII", "v"] : minor ? ["V", "V7", "v", "VII"] : ["V", "V7"]), ante: "cad64" };
      case "half": return { fin: names(minor || mode === "mixolydian" ? ["V", "v"] : ["V"]), pen: null, ante: null };
      case "imperfect": return { fin: [I], pen: null, ante: null };
      case "deceptive": return { fin: names(minor ? ["VI"] : ["vi"]), pen: names(minor ? ["V", "V7"] : ["V", "V7"]), ante: null };
      case "plagal": return { fin: [I], pen: names(minor ? ["iv", "IV"] : ["IV"]), ante: null };
    }
    return { fin: null, pen: null, ante: null };
  }

  // one line's chords. prev: the chord the line before ended on (or null);
  // ctx: { mode, H, first (the hymn's first line), approach (slot indices
  // near the peak where the diminished seventh may stand) }
  function planChords(line, slots, vocab, prev, ctx, R) {
    var mode = ctx.mode, H = ctx.H || {}, n = slots.length, INF = 1e9;
    var cad = cadenceChords(line.cadence, mode, line.plan, vocab);
    var color = H.color != null ? H.color : 0.5, sev = H.sevenths != null ? H.sevenths : 0.5, susp = H.susp != null ? H.susp : 0.5;
    function standing(ch) {
      var c = ch.cost;
      if (ch.fn === "A") c *= 1.6 - color * 1.2;
      if (ch.sev && ch.fn !== "A") c *= 1.5 - sev;
      if (ch.fn === "C") c *= 1.5 - susp;
      return c;
    }
    // the dice: a little noise on every (slot, chord), thrown in full
    var noise = [];
    for (var k = 0; k < n; k++) { var row = []; for (var v = 0; v < vocab.length; v++) row.push(u01(R) * 0.45); noise.push(row); }
    function emit(k, ch) {
      var s = slots[k], m = cls(s.deg), t = toneOf(ch, m), c = standing(ch) + noise[k][vocab.indexOf(ch)];
      if (ch.only === "approach") {
        if (!(ctx.approach && ctx.approach.indexOf(k) >= 0)) return INF;
        if (ctx.favour && ctx.favour.indexOf(k) >= 0) c -= 0.3 + 0.45 * color;   // the organist's favourite colour, where it belongs
      }
      if (t && t.alt !== 0) return INF;                              // a cross-relation with the tune
      // every other note of a melisma must at least pass by step
      for (var j = 1; j < s.notes.length; j++) {
        var mj = cls(s.notes[j].deg), tj = toneOf(ch, mj);
        if (tj && tj.alt !== 0) return INF;
        if (!tj && Math.abs(s.notes[j].deg - s.notes[j - 1].deg) > 1) c += 1.5;
      }
      if (!t) {
        // the tune may pass through a note the chord lacks: short, weak, by step
        var pm = k > 0 ? slots[k - 1].notes[slots[k - 1].notes.length - 1].deg : null, nm = k + 1 < n ? slots[k + 1].deg : null;
        var stepIn = pm != null && Math.abs(s.deg - pm) === 1, stepOut = nm != null && Math.abs(nm - s.deg) === 1;
        if (!s.stress && s.beats <= ctx.shortBeat + EPS && stepIn && stepOut && !s.final) c += 1.3;
        else if (s.trail && stepIn) c += 1.0;                          // a feminine ending stepping off its chord
        else if (ctx.loose) c += 3;                                    // (the relaxed plan takes anything)
        else return INF;
      }
      if (ch.sev && t && t.c === ch.tones[ch.tones.length - 1].c && s.stress) c += 0.4;   // the seventh itself, on the strong beat
      if (k === 0 && ctx.first) c += (ch.name === "I" || ch.name === "i") ? 0 : (ch.fn === "D" && !s.stress ? 0.3 : 1.6);
      if (s.final && line.role === "home" && ch.fn !== "T") c += INF;
      // a line's last chords belong to its cadence
      if (s.final || s.trail) { if (cad.fin && cad.fin.indexOf(ch.name) < 0) return INF; }
      if (k === slots.fin - 1 && cad.pen) {
        if (cad.pen.indexOf(ch.name) < 0 && ch.fn !== "C") return INF;
      }
      if (k === slots.fin - 1 && ch.fn === "C") return INF;          // the six-four goes BEFORE the dominant
      if (k === slots.fin - 2 && ch.fn === "C" && !(cad.ante === "cad64" && s.stress)) return INF;
      if (k < slots.fin - 2 && ch.fn === "C") return INF;
      return c;
    }
    var cost = [], back = [];
    for (k = 0; k < n; k++) {
      cost.push([]); back.push([]);
      for (v = 0; v < vocab.length; v++) {
        var ch = vocab[v], e = emit(k, ch);
        if (slots[k].trail && k > 0) {                                // the feminine syllable keeps the long note's chord
          var bi = -1, bc = INF;
          if (cost[k - 1][v] < bc) { bc = cost[k - 1][v]; bi = v; }
          cost[k].push(e >= INF ? INF : bc + 0.01); back[k].push(bi); continue;
        }
        if (e >= INF) { cost[k].push(INF); back[k].push(-1); continue; }
        if (k === 0) { cost[k].push(e + (prev ? chordTrans(prev, ch, slots[0].stress) : 0)); back[k].push(-1); continue; }
        var best = INF, arg = -1;
        for (var u = 0; u < vocab.length; u++) {
          if (cost[k - 1][u] >= INF) continue;
          var x = cost[k - 1][u] + chordTrans(vocab[u], ch, slots[k].stress);
          if (x < best) { best = x; arg = u; }
        }
        cost[k].push(best + e); back[k].push(arg);
      }
    }
    var last = -1, lb = INF;
    for (v = 0; v < vocab.length; v++) if (cost[n - 1][v] < lb) { lb = cost[n - 1][v]; last = v; }
    if (last < 0) return null;
    var out = new Array(n);
    for (k = n - 1; k >= 0; k--) { out[k] = vocab[last]; last = back[k][last]; if (last < 0 && k > 0) last = vocab.indexOf(out[k]); }
    return { chords: out, cost: lb };
  }

  // ==========================================================================
  // C. THE TABERNACLE — the voices: a Viterbi search over voicings with the
  // Victorian rules (Stainer's and Mason's): no parallel fifths or octaves,
  // no crossing, the leading tone and the seventh resolved, common tones
  // kept, the inner voices moving as little as they can, the bass free to
  // take a first inversion for a smoother line
  // ==========================================================================
  function degsOfClass(c, b) { var o = []; for (var d = b[0]; d <= b[1]; d++) if (cls(d) === c) o.push(d); return o; }
  function isLeading(mode, ch, t) {
    if (t.alt > 0) return true;
    return ch.fn === "D" && ((semi(mode, t.c, t.alt) % 12) + 12) % 12 === 11;
  }
  function voicingsFor(slot, ch, ctx) {
    var mode = ctx.mode, B = ctx.bounds, T = ctx.tess, H = ctx.H || {}, out = [];
    var color = H.color != null ? H.color : 0.5;
    var sd = slot.deg, sS = semi(mode, sd, 0), sT = toneOf(ch, cls(sd));
    var sMax = sS; slot.notes.forEach(function (n) { sMax = Math.max(sMax, semi(mode, n.deg, 0)); });   // (a melisma may climb)
    var sOut = semi(mode, slot.notes[slot.notes.length - 1].deg, 0);   // where a melisma leaves the tune
    var bassTones = [];
    if (ch.bassOnly != null) bassTones.push([ch.bassOnly, 0]);
    else if (ch.dim7) ch.tones.forEach(function (t, i) { bassTones.push([i, 0.25]); });
    else {
      bassTones.push([0, 0]);
      bassTones.push([1, ch.fn === "D" && !ch.sev && ctx.cadenceSlot ? 1.2 : 0.62 - 0.35 * color]);
      if (ch.sev) { bassTones.push([2, 0.8]); bassTones.push([ch.tones.length - 1, 1.1]); }
    }
    function tess(p, s) { var lo = semi(mode, T[p][0], 0), hi = semi(mode, T[p][1], 0); return s < lo ? (lo - s) * 0.15 : s > hi ? (s - hi) * 0.15 : 0; }
    var classes = ch.tones.map(function (t) { return t.c; });
    bassTones.forEach(function (bt) {
      var tb = ch.tones[bt[0]];
      degsOfClass(tb.c, B.B).forEach(function (bd) {
        var sB = semi(mode, bd, tb.alt);
        ch.tones.forEach(function (ta) {
          degsOfClass(ta.c, B.A).forEach(function (ad) {
            var sA = semi(mode, ad, ta.alt);
            if (sA > sS || sMax - sA > 12) return;
            ch.tones.forEach(function (tt) {
              degsOfClass(tt.c, B.T).forEach(function (td) {
                var sTn = semi(mode, td, tt.alt);
                if (sTn > sA || sA - sTn > 12 || sTn <= sB || sTn - sB > 24) return;
                // what the four sound: every tone present? what is doubled?
                var cnt = {}, voices = [[sT ? sT.c : -1, sT], [ta.c, ta], [tt.c, tt], [tb.c, tb]];
                voices.forEach(function (x) { if (x[0] >= 0) cnt[x[0]] = (cnt[x[0]] || 0) + 1; });
                var c = bt[1];
                if (!cnt[ch.tones[0].c] && !ch.dim7) return;
                if (!cnt[ch.tones[1].c]) return;
                if (ch.sev && !cnt[ch.tones[ch.tones.length - 1].c]) c += 3;
                if (ch.tones.length > 2 && !ch.sev && !cnt[ch.tones[2].c]) c += 0.55;
                if (ch.sev && ch.tones.length > 3 && !cnt[ch.tones[2].c]) c += 0.2;
                ch.tones.forEach(function (t, i) {
                  var k = cnt[t.c] || 0;
                  if (k < 2) return;
                  if (isLeading(mode, ch, t) || t.alt !== 0 || (ch.sev && i === ch.tones.length - 1)) c += 6;
                  else if (i === 0) c += 0;
                  else if (i === 2) c += 0.3;
                  else c += bt[0] === 1 && i === 1 ? 1.0 : 0.6;
                  if (k > 2) c += 1.5;
                });
                if (sA === sS) c += 2.5;
                if (sTn === sA) c += 1.0;
                c += tess("A", sA) + tess("T", sTn) + tess("B", sB);
                out.push({ S: { d: sd, a: 0 }, A: { d: ad, a: ta.alt }, T: { d: td, a: tt.alt }, B: { d: bd, a: tb.alt }, sem: [sS, sA, sTn, sB],
                           semOut: [sOut, sA, sTn, sB], cost: c, inv: bt[0], ch: ch });
              });
            });
          });
        });
      });
    });
    return out;
  }
  // the plainest voicing there is, when the rules leave nothing: the root in
  // the bass, the third and the fifth nearest the middle of their parts
  function fallbackVoicing(slot, ch, ctx) {
    var mode = ctx.mode, B = ctx.bounds;
    function near(c, b, below) { var o = degsOfClass(c, b).filter(function (d) { return below == null || d < below; }); return o.length ? o[Math.floor(o.length / 2)] : b[0]; }
    var t0 = ch.tones[0], t1 = ch.tones[1], t2 = ch.tones[ch.tones.length > 2 ? 2 : 0];
    var ad = near(t1.c, B.A, slot.deg + 1), td = near(t2.c, B.T, ad), bd = near(t0.c, B.B, td);
    return { S: { d: slot.deg, a: 0 }, A: { d: ad, a: t1.alt }, T: { d: td, a: t2.alt }, B: { d: bd, a: t0.alt },
             sem: [semi(mode, slot.deg, 0), semi(mode, ad, t1.alt), semi(mode, td, t2.alt), semi(mode, bd, t0.alt)], cost: 50, inv: 0, ch: ch };
  }
  var PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  // the move from one voicing to the next (a, b), by the dialect's rules;
  // parW: what a parallel fifth or octave costs (the Tabernacle forbids)
  function moveCost(a, b, mode, parW) {
    // (the tune moves into the next chord from its melisma's last note)
    var c = 0, sa = a.semOut || a.sem, sb = b.sem;
    for (var i = 0; i < PAIRS.length; i++) {
      var p = PAIRS[i][0], q = PAIRS[i][1];
      var mp = sb[p] - sa[p], mq = sb[q] - sa[q];
      if (!mp || !mq) continue;
      var i1 = Math.abs(sa[p] - sa[q]) % 12, i2 = Math.abs(sb[p] - sb[q]) % 12;
      if ((mp > 0) === (mq > 0)) { if ((i1 === 7 && i2 === 7) || (i1 === 0 && i2 === 0)) c += parW; }
      else if ((i1 === 7 && i2 === 7) || (i1 === 0 && i2 === 0 && sa[p] !== sa[q])) c += 2;
    }
    // direct fifths and octaves between the outer voices, the soprano leaping
    var ms = sb[0] - sa[0], mb = sb[3] - sa[3], io = Math.abs(sb[0] - sb[3]) % 12;
    if (ms && mb && (ms > 0) === (mb > 0) && (io === 7 || io === 0) && Math.abs(ms) > 2) c += 1.5;
    if (ms && mb && (ms > 0) !== (mb > 0)) c -= 0.2;
    // the inner voices move as little as they can; the bass may walk
    for (var v = 1; v <= 3; v++) {
      var d = Math.abs(sb[v] - sa[v]);
      c += v === 3 ? d * 0.04 : d * 0.13;
      if (v < 3 && d > 7) c += 1.5;
      if (v === 3 && d > 12) c += 2;
      if (d === 6) c += v === 3 ? 10 : 3;
      if (d === 0 && a.ch !== b.ch) c -= 0.2;
    }
    // no augmented second (fa to the raised seventh, in minor), no diminished third
    var dA = [a.S, a.A, a.T, a.B], dB = [b.S, b.A, b.T, b.B];
    for (v = 1; v <= 3; v++) {
      var st = Math.abs(dB[v].d - dA[v].d), se = Math.abs(sb[v] - sa[v]);
      if ((st === 1 && se === 3) || (st === 2 && se === 2)) c += 20;
    }
    // overlapping: a voice passing where its neighbour just was
    for (v = 0; v < 3; v++) { if (sb[v + 1] > sa[v]) c += 1; if (sb[v] < sa[v + 1]) c += 1; }
    // tendency tones: the leading tone rises, the seventh falls, an altered
    // note goes the way it leans
    if (a.ch !== b.ch) {
      var voicesA = [a.S, a.A, a.T, a.B];
      for (v = 0; v < 4; v++) {
        var t = { c: cls(voicesA[v].d), alt: voicesA[v].a }, mv = sb[v] - sa[v];
        var inA = toneOf(a.ch, t.c);
        if (!inA) continue;
        var outer = v === 0 || v === 3;
        if (isLeading(mode, a.ch, t) && b.ch.fn === "T" && !(mv === 1 || mv === 2)) c += outer ? 4 : 0.8;
        else if (t.alt > 0 && !(mv === 1 || mv === 2)) c += 3;
        if (t.alt < 0 && !(mv === -1 || mv === -2)) c += 3;
        if (a.ch.sev && t.c === a.ch.tones[a.ch.tones.length - 1].c && !(mv === -1 || mv === -2 || (mv === 0 && toneOf(b.ch, t.c)))) c += 5;
      }
    }
    return c;
  }
  // the voices of one line, continuing from the voicing the line before ended on
  function voiceLine(slots, chords, prevV, ctx) {
    var n = slots.length, mode = ctx.mode, INF = 1e9, parW = ctx.parW != null ? ctx.parW : 30;
    var cands = [], cost = [], back = [];
    for (var k = 0; k < n; k++) {
      var cc = voicingsFor(slots[k], chords[k], { mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, cadenceSlot: slots[k].final });
      if (!cc.length) {                                                // widen the compass rather than fail
        var wide = {}; for (var p in ctx.bounds) wide[p] = [ctx.bounds[p][0] - 2, ctx.bounds[p][1] + 2];
        cc = voicingsFor(slots[k], chords[k], { mode: mode, bounds: wide, tess: ctx.tess, H: ctx.H });
      }
      if (!cc.length) cc = [fallbackVoicing(slots[k], chords[k], ctx)];     // never: but a line always sounds
      if (cc.length > 36) { cc.sort(function (a, b) { return a.cost - b.cost; }); cc = cc.slice(0, 36); }   // the likeliest spacings only
      cands.push(cc); cost.push([]); back.push([]);
      for (var j = 0; j < cc.length; j++) {
        if (k === 0) { cost[k].push(cc[j].cost + (prevV ? moveCost(prevV, cc[j], mode, parW) * 0.6 : 0)); back[k].push(-1); continue; }
        var best = INF, arg = -1;
        for (var i = 0; i < cands[k - 1].length; i++) {
          if (cost[k - 1][i] - 1.2 >= best) continue;                  // (a move may earn back ~1)
          var x = cost[k - 1][i] + moveCost(cands[k - 1][i], cc[j], mode, parW);
          if (x < best) { best = x; arg = i; }
        }
        cost[k].push(best + cc[j].cost); back[k].push(arg);
      }
    }
    var last = -1, lb = INF;
    for (j = 0; j < cands[n - 1].length; j++) if (cost[n - 1][j] < lb) { lb = cost[n - 1][j]; last = j; }
    var out = new Array(n);
    for (k = n - 1; k >= 0; k--) { out[k] = last >= 0 ? cands[k][last] : null; last = last >= 0 ? back[k][last] : -1; }
    return { voicings: out, cost: lb };
  }

  // ==========================================================================
  // C. THE TABERNACLE — non-chord tones, a second pass (PLAN §3.5): the 4–3
  // suspension at a close, and passing notes where an inner voice or the
  // bass leaps a third and there is time to walk it
  // ==========================================================================
  function noteAt(part, beat) { for (var i = 0; i < part.length; i++) if (part[i].beat <= beat + EPS && beat < part[i].beat + part[i].beats - EPS) return part[i]; return null; }
  function tabernacleNCT(line, parts, slots, chords, ctx, R) {
    var mode = ctx.mode, H = ctx.H || {}, report = { susp: 0, pass: 0 };
    var suspW = H.susp != null ? H.susp : 0.5, passW = H.passing != null ? H.passing : 0.5;
    var fin = slots.fin, pen = fin - 1;
    // the suspension: a voice holds the tonic over the dominant, then falls to its third
    var dS = u01(R.fork("susp")), order = u01(R.fork("susp:voice")) < 0.5 ? ["A", "T"] : ["T", "A"];
    function suspendAt(k, prevK, p) {
      var cur = parts[p][k], prv = parts[p][prevK];
      if (!cur || !prv || cur.alt || prv.alt) return false;
      if (prv.deg !== cur.deg + 1 || toneOf(chords[k], cls(prv.deg))) return false;
      if (slots[k].beats < 1 - EPS) return false;
      var half = slots[k].beats / 2;
      if (slots[k].notes.length > 1) return false;                   // the tune moves there: no room to resolve
      prv.tie = true;
      parts[p].splice(k, 1, { beat: cur.beat, beats: half, deg: prv.deg, alt: 0, nct: "susp", syl: null, stress: cur.stress, tie: false },
                      { beat: cur.beat + half, beats: cur.beats - half, deg: cur.deg, alt: cur.alt, nct: null, syl: null, stress: 0, tie: false });
      report.susp++;
      return true;
    }
    var o;
    if (pen >= 1 && chords[pen].fn === "D" && chords[fin].fn === "T" && dS < suspW * 0.85) {
      for (o = 0; o < order.length; o++) if (suspendAt(pen, pen - 1, order[o])) break;
    } else if (chords[fin].fn === "D" && pen >= 0 && slots[fin].beats >= 2 && dS < suspW * 0.5) {
      for (o = 0; o < order.length; o++) if (suspendAt(fin, pen, order[o])) break;
    }
    // passing notes: walk a leapt third in the time the chord allows
    var voices = ["B", "T", "A"], made = 0, cap = 1 + Math.round(passW * 3);
    voices.forEach(function (p) {
      for (var k = 0; k + 1 < parts[p].length; k++) {
        var die = u01(R.fork("pass:" + p + ":" + k));
        var a = parts[p][k], b = parts[p][k + 1];
        if (made >= cap || a.nct || b.nct || a.tie || a.alt || b.alt) continue;
        if (Math.abs(b.deg - a.deg) !== 2 || a.beats < 2 * ctx.split - EPS) continue;
        if (die >= passW * (p === "B" ? 0.75 : 0.5)) continue;
        var mid = (a.deg + b.deg) / 2, t = a.beat + a.beats / 2, sm = semi(mode, mid, 0);
        // not against the tune a semitone off, never a unison with it, and no
        // parallel fifth or octave walking into the next chord
        var bad = false;
        ["S", "A", "T", "B"].forEach(function (q) {
          if (q === p || bad) return;
          var w = noteAt(parts[q], t), wn = noteAt(parts[q], b.beat);
          if (!w || !wn) return;
          var sw = semi(mode, w.deg, w.alt), swn = semi(mode, wn.deg, wn.alt), sb = semi(mode, b.deg, b.alt);
          if (Math.abs(w.beat - t) < EPS) {                            // that voice moves at the half-beat too
            var wp = noteAt(parts[q], t - EPS * 10), sa0 = semi(mode, a.deg, a.alt);
            if (wp) {
              var swp = semi(mode, wp.deg, wp.alt), k1 = sm - sa0, k2 = sw - swp;
              if (k1 && k2 && (k1 > 0) === (k2 > 0)) { var j1 = Math.abs(sa0 - swp) % 12, j2 = Math.abs(sm - sw) % 12; if ((j1 === 7 && j2 === 7) || (j1 === 0 && j2 === 0)) bad = true; }
            }
          }
          var iv = Math.abs(sm - sw) % 12;
          if (iv === 0 || (q === "S" && (iv === 1 || iv === 11))) bad = true;
          // no crossing, and no gap over an octave between neighbouring upper voices
          var ORD = ["S", "A", "T", "B"], ip = ORD.indexOf(p), iq = ORD.indexOf(q);
          if ((iq < ip && sw < sm) || (iq > ip && sw > sm)) bad = true;
          if (Math.abs(iq - ip) === 1 && ip + iq < 5 && Math.abs(sw - sm) > 12) bad = true;
          var m1 = sb - sm, m2 = swn - sw;
          if (m1 && m2 && (m1 > 0) === (m2 > 0)) {
            var i1 = Math.abs(sm - sw) % 12, i2 = Math.abs(sb - swn) % 12;
            if ((i1 === 7 && i2 === 7) || (i1 === 0 && i2 === 0)) bad = true;
          }
        });
        if (bad) continue;
        var h = a.beats / 2;
        parts[p].splice(k, 1, { beat: a.beat, beats: h, deg: a.deg, alt: 0, nct: null, syl: a.syl, stress: a.stress, tie: false },
                        { beat: a.beat + h, beats: h, deg: mid, alt: 0, nct: "pass", syl: null, stress: 0, tie: false });
        made++; report.pass++; k++;
      }
    });
    return report;
  }

  // a chord's name with its inversion figured, the way a harmony book writes
  // it: I6, IV64, V65, V43/V, vii°42
  function figured(ch, inv) {
    if (ch.fn === "C" || !inv) return ch.name;
    var sl = ch.name.indexOf("/"), head = sl >= 0 ? ch.name.slice(0, sl) : ch.name, tail = sl >= 0 ? ch.name.slice(sl) : "";
    if (ch.sev) return head.replace(/7$/, "") + ["7", "65", "43", "42"][inv] + tail;
    return head + ["", "6", "64"][inv] + tail;
  }
  // the whole Tabernacle setting: every line's chords, then its voices, then
  // its non-chord tones. ctx (from the composer): { mode, H, bounds, tess,
  // lines: [{ notes (the tune), cadence, plan, role, peakIdx }], shortBeat,
  // split, R }
  function harmonizeTabernacle(ctx) {
    var mode = ctx.mode, vocab = tabernacleVocab(mode), R = ctx.R, out = [], prevCh = null, prevV = null;
    ctx.lines.forEach(function (line, li) {
      var slots = slotsOf(line), Rl = R.fork("line:" + li);
      // where the approach diminished seventh may stand: leading into the
      // tune's peak, and into the dominant of a cadence
      var approach = [], favour = [];
      if (line.peakIdx >= 0) {
        var ps = -1; slots.forEach(function (s, k) { if (s.idx <= line.peakIdx && line.peakIdx < s.idx + s.notes.length) ps = k; });
        if (ps >= 1) { approach.push(ps - 2, ps - 1, ps); favour.push(ps - 1, ps); }
      }
      if (line.cadence === "authentic" || line.cadence === "half") approach.push(slots.fin - 2, slots.fin - 3);
      if (line.role === "home") favour.push(slots.fin - 2);
      var pc = planChords(line, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: approach, favour: favour, shortBeat: ctx.shortBeat }, Rl.fork("chords"));
      var relaxed = false;
      if (!pc) { relaxed = true; pc = planChords({ cadence: "none", plan: null, role: line.role === "home" ? "home" : "open", notes: line.notes }, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: [], shortBeat: 9, loose: true }, Rl.fork("chords:relaxed")); }
      var chords = pc.chords;
      var vl = voiceLine(slots, chords, prevV, { mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, parW: 30 });
      var parts = { S: line.notes.map(function (n) { return { beat: n.beat, beats: n.beats, deg: n.deg, alt: 0, nct: null, syl: n.syl, stress: n.stress, tie: false, cont: n.cont }; }), A: [], T: [], B: [] };
      slots.forEach(function (s, k) {
        var v = vl.voicings[k];
        ["A", "T", "B"].forEach(function (p) { parts[p].push({ beat: s.beat, beats: s.beats, deg: v[p].d, alt: v[p].a, nct: null, syl: s.notes[0].syl, stress: s.stress, tie: false }); });
        // the tune's own passing notes, named
        s.notes.forEach(function (n, j) {
          var sn = parts.S[s.idx + j];
          if (!toneOf(chords[k], cls(n.deg))) sn.nct = j > 0 || (k > 0 && k + 1 < slots.length && Math.sign(slots[k + 1].deg - n.deg) === Math.sign(n.deg - slots[k - 1].deg)) ? "pass" : "nbr";
        });
      });
      var nct = tabernacleNCT(line, parts, slots, chords, { mode: mode, H: ctx.H, shortBeat: ctx.shortBeat, split: ctx.split }, Rl.fork("nct"));
      // the chord list: a chord for as long as it stands
      var list = [];
      slots.forEach(function (s, k) {
        var ch = chords[k], inv = vl.voicings[k].inv, last = list[list.length - 1];
        if (last && last.name === ch.name && last.inv === inv) { last.len = s.beat + s.beats - last.beat; return; }
        var root = ch.dim7 ? ch.tones[0] : ch.tones[0];
        list.push({ beat: s.beat, len: s.beats, roman: figured(ch, inv), rootDeg: root.c, rootAlt: root.alt || 0,
                    quality: ch.dim7 ? "dim" : ch.q, name: ch.name, inv: inv, fn: ch.fn, dim7: !!ch.dim7,
                    tones: ch.tones.map(function (t) { return [t.c, t.alt]; }) });
      });
      var kind = relaxed ? realizedKind(chords, slots, mode) : (line.plan === "tonicize" || line.plan === "relative" ? "authentic" : line.cadence);
      out.push({ parts: parts, chords: list, cadenceKind: kind, cadBeat: slots[slots.fin].beat, relaxed: relaxed, nct: nct, chordCost: Math.round(pc.cost * 100) / 100, voiceCost: Math.round(vl.cost * 100) / 100 });
      prevCh = chords[chords.length - 1]; prevV = vl.voicings[vl.voicings.length - 1];
    });
    // THE AMEN — the Tabernacle's plagal amen after the last verse: the tune
    // holds its last note while the harmony steps from the subdominant home
    if (ctx.amen && prevV) {
      var fd = ctx.lines[ctx.lines.length - 1].notes.slice(-1)[0].deg, a = ctx.bar >= 4 ? ctx.bar / 2 : ctx.bar;
      var IV = vocab.filter(function (c) { return c.name === "IV" || c.name === "iv"; })[0], I = vocab.filter(function (c) { return c.name === "I" || c.name === "i"; })[0];
      var an = [{ beat: 0, beats: a, deg: fd, stress: 1, syl: 0, cont: false }, { beat: a, beats: a, deg: fd, stress: 1, syl: 1, cont: false }];
      var as = slotsOf({ notes: an });
      if (IV && I && toneOf(IV, cls(fd)) && toneOf(I, cls(fd))) {
        var av = voiceLine(as, [IV, I], prevV, { mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, parW: 30 });
        var ap = { S: an.map(function (n) { return { beat: n.beat, beats: n.beats, deg: n.deg, alt: 0, nct: null, syl: n.syl, stress: 1, tie: false }; }), A: [], T: [], B: [] };
        as.forEach(function (sl, k) { ["A", "T", "B"].forEach(function (p) { var v = av.voicings[k][p]; ap[p].push({ beat: sl.beat, beats: sl.beats, deg: v.d, alt: v.a, nct: null, syl: k, stress: 1, tie: false }); }); });
        out.amen = { parts: ap, cadenceKind: "plagal", cadBeat: a,
                     chords: [IV, I].map(function (ch, k) { return { beat: k * a, len: a, roman: ch.name, rootDeg: ch.root, rootAlt: 0, quality: ch.q, name: ch.name, inv: av.voicings[k].inv, fn: ch.fn, dim7: false, tones: ch.tones.map(function (t) { return [t.c, t.alt]; }) }; }) };
      }
    }
    return out;
  }
  // what a relaxed line's close turned out to be
  function realizedKind(chords, slots, mode) {
    var f = chords[slots.fin], p = slots.fin > 0 ? chords[slots.fin - 1] : null;
    if (f.fn === "D") return "half";
    if (f.fn === "T" && f.root === 0) return p && p.fn === "D" ? "authentic" : p && p.fn === "P" ? "plagal" : "imperfect";
    if (f.fn === "T" && p && p.fn === "D") return "deceptive";
    return "none";
  }

  // ==========================================================================
  // A SONORITY READ AS A CHORD — for the dialects that do not plan chords
  // (the Sacred Harp writes lines, and the chords are what the lines make)
  // ==========================================================================
  // notes: [{deg, alt}] sounding together, lowest first → { root, quality,
  // roman, third (bool) }: the root is the class the others stack on in
  // thirds (the bass when it can be), a sonority with no third is "open5"
  function chordAt(mode, notes) {
    var pcs = {}, list = [];
    notes.forEach(function (n) { var c = cls(n.deg); if (!pcs[c]) { pcs[c] = n.alt || 0; list.push(c); } });
    if (list.length === 1) return { root: list[0], quality: "unison", roman: ROMAN_UP[list[0]] + "¹", third: false };
    var bass = cls(notes[0].deg), best = null, bestS = -1;
    list.forEach(function (r) {
      var score = 0;
      list.forEach(function (c) { var iv = cls(c - r); score += iv === 0 ? 3 : iv === 4 ? 2.5 : iv === 2 ? 2.2 : iv === 6 ? 1 : 0; });
      if (r === bass) score += 1.2;
      if (score > bestS) { bestS = score; best = r; }
    });
    var hasThird = list.some(function (c) { return cls(c - best) === 2; });
    var hasFifth = list.some(function (c) { return cls(c - best) === 4; });
    var q;
    if (!hasThird) q = hasFifth ? "open5" : "other";
    else {
      var ch = { root: best, tones: [{ c: best, alt: pcs[best] || 0 }, { c: cls(best + 2), alt: pcs[cls(best + 2)] || 0 }, { c: cls(best + 4), alt: pcs[cls(best + 4)] || 0 }], sev: false };
      q = qualityOf(mode, ch);
      if (!hasFifth && q === "other") q = "other";
    }
    var r = ROMAN_UP[best];
    if (q === "min" || q === "dim") r = r.toLowerCase();
    return { root: best, quality: q, roman: r + (q === "dim" ? "°" : q === "open5" ? "⁵" : ""), third: hasThird };
  }

  // ==========================================================================
  // A. THE SACRED HARP — three (or four) melodies against the tenor's tune
  // ==========================================================================
  // Each part is searched as a LINE (a Viterbi walk through its compass),
  // scored against the parts already written: the bass first, against the
  // tune; then the treble against both; then, on some tunes, an alto. The
  // intervals it likes best are the open ones — unisons, fifths, octaves —
  // thirds and sixths are welcome but never required, parallel fifths are
  // rewarded, and the last chord of every line is bare.
  var CONS = {      // cost of an interval (semitones mod 12) between two parts: [strong, weak]
    bass: { 0: [0.25, 0.2], 7: [0, 0], 3: [0.15, 0.12], 4: [0.15, 0.12], 8: [0.6, 0.4], 9: [0.45, 0.3], 5: [2.2, 1.1], 2: [5, 1.8], 10: [5, 1.8], 1: [8, 3], 11: [8, 3], 6: [8, 4] },
    upper: { 0: [0.2, 0.2], 7: [0.05, 0.05], 5: [0.12, 0.12], 3: [0.08, 0.08], 4: [0.08, 0.08], 8: [0.15, 0.12], 9: [0.12, 0.1], 2: [4, 1.2], 10: [4, 1.2], 1: [7, 2.5], 11: [7, 2.5], 6: [5, 2] },
  };
  function melodicCost(a, b, pp, bass) {
    var iv = Math.abs(b - a), c = iv === 0 ? (bass ? 0.35 : 0.4) : iv === 1 ? 0.1 : iv === 2 ? 0.15 : iv === 3 ? (bass ? 0.22 : 0.35) : iv === 4 ? (bass ? 0.22 : 0.5) : iv === 5 ? 1.3 : iv === 7 ? 0.7 : 4;
    if (pp != null) {
      var prev = a - pp;
      if (Math.abs(prev) >= 3 && iv >= 2 && (b - a > 0) === (prev > 0)) c += bass ? 0.6 : 0.9;
      if (prev === 0 && iv === 0) c += 1.0;
    }
    return c;
  }
  // one part's line through the slots, against the parts already fixed
  //   fixed: { part: [ {d, a} per slot ] }; req(k, d) → extra cost (cadences)
  function counterLine(slots, mode, bounds, fixed, isBass, req, openW, noise, crossW) {
    var n = slots.length, INF = 1e9, cands = [], cost = [], back = [];
    var names = Object.keys(fixed);
    for (var k = 0; k < n; k++) {
      var cc = [];
      for (var d = bounds[0]; d <= bounds[1]; d++) {
        var s = semi(mode, d, 0), strong = slots[k].stress || slots[k].final ? 0 : 1, c = 0, pcs = {};
        pcs[((s % 12) + 12) % 12] = 1;
        for (var i = 0; i < names.length; i++) {
          var f = fixed[names[i]][k], sf = semi(mode, f.d, f.a);
          pcs[((sf % 12) + 12) % 12] = 1;
          var lowIsBass = names[i] === "B" || isBass;
          var iv = Math.abs(s - sf) % 12, tab = lowIsBass ? CONS.bass : CONS.upper;
          c += tab[iv][strong];
          if (isBass && s > sf) c += 6;                              // the bass stays under the tune
          if (!isBass && names[i] === "B" && s <= sf) c += 6;
          if (!isBass && names[i] === "T" && s < sf) c += crossW;     // the treble may cross the tenor, now and then
          if (s === sf && names[i] !== "B") c += 0.5;
        }
        // an open sonority is the sound of the book
        var third = false, pl = Object.keys(pcs).map(Number);
        for (var x = 0; x < pl.length; x++) for (var y = 0; y < pl.length; y++) { var q = ((pl[y] - pl[x]) % 12 + 12) % 12; if (q === 3 || q === 4) third = true; }
        if (!third) c -= openW;
        c += req(k, d, third) + noise[k][d - bounds[0]];
        cc.push({ d: d, s: s, c: c });
      }
      cands.push(cc);
    }
    for (k = 0; k < n; k++) {
      cost.push([]); back.push([]);
      for (var j = 0; j < cands[k].length; j++) {
        var cj = cands[k][j];
        if (k === 0) { cost[k].push(cj.c); back[k].push(-1); continue; }
        var best = INF, arg = -1;
        for (i = 0; i < cands[k - 1].length; i++) {
          var pc = cands[k - 1][i], base = cost[k - 1][i];
          if (base >= best) continue;
          var ppd = k > 1 && back[k - 1][i] >= 0 ? cands[k - 2][back[k - 1][i]].d : null;
          var m = melodicCost(pc.d, cj.d, ppd, isBass);
          if (Math.abs(cj.s - pc.s) === 6) m += 4;
          // against each fixed part: parallel fifths welcome, octaves less so
          for (var q2 = 0; q2 < names.length; q2++) {
            var F = fixed[names[q2]], f0 = F[k - 1], f1 = F[k];
            var s0 = semi(mode, f0.d, f0.a), s1 = semi(mode, f1.d, f1.a);
            var m1 = cj.s - pc.s, m2 = s1 - s0;
            if (m1 && m2 && (m1 > 0) === (m2 > 0)) {
              var i1 = Math.abs(pc.s - s0) % 12, i2 = Math.abs(cj.s - s1) % 12;
              if (i1 === 7 && i2 === 7) m += 0.3;
              if (i1 === 0 && i2 === 0) m += pc.s === s0 && cj.s === s1 ? 0.9 : 0.35;
            }
            if (m1 && m2 && (m1 > 0) !== (m2 > 0)) m -= 0.08;
          }
          var x2 = base + m;
          if (x2 < best) { best = x2; arg = i; }
        }
        cost[k].push(best + cj.c); back[k].push(arg);
      }
    }
    var last = -1, lb = INF;
    for (j = 0; j < cands[n - 1].length; j++) if (cost[n - 1][j] < lb) { lb = cost[n - 1][j]; last = j; }
    var out = new Array(n);
    for (k = n - 1; k >= 0; k--) { out[k] = { d: cands[k][last].d, a: 0 }; last = back[k][last]; if (last < 0 && k > 0) last = 0; }
    return { line: out, cost: lb };
  }

  function noiseRows(R, n, b, amt) {
    var rows = [];
    for (var k = 0; k < n; k++) { var r = []; for (var d = b[0]; d <= b[1]; d++) r.push(u01(R) * amt); rows.push(r); }
    return rows;
  }
  // a part's slot notes → Score-shaped notes, one per slot (the tune's melismas held)
  function slotNotes(slots, line, pts) {
    return slots.map(function (s, k) { return { beat: s.beat, beats: s.beats, deg: pts[k].d, alt: pts[k].a || 0, nct: null, syl: s.notes[0].syl, stress: s.stress, tie: false }; });
  }
  // the Sacred Harp's own non-chord tones: a slurred pair where a part leaps
  // a third and the note is long enough to share (every part a melody)
  function shapeNoteSlurs(parts, mode, names, R, rate, split) {
    var made = 0;
    names.forEach(function (p) {
      for (var k = 0; k + 1 < parts[p].length; k++) {
        var die = u01(R.fork("slur:" + p + ":" + k));
        var a = parts[p][k], b = parts[p][k + 1];
        if (Math.abs(b.deg - a.deg) !== 2 || a.beats < 2 * split - EPS || die >= rate) continue;
        var mid = (a.deg + b.deg) / 2, h = a.beats / 2, t = a.beat + h, sm = semi(mode, mid, 0), bad = false;
        Object.keys(parts).forEach(function (q) {
          if (q === p || bad) return;
          var w = noteAt(parts[q], t);
          if (w && Math.abs(sm - semi(mode, w.deg, w.alt)) % 12 === 0) bad = true;   // no unison bump
        });
        if (bad) continue;
        parts[p].splice(k, 1, { beat: a.beat, beats: h, deg: a.deg, alt: 0, nct: null, syl: a.syl, stress: a.stress, tie: false },
                        { beat: t, beats: h, deg: mid, alt: 0, nct: "pass", syl: null, stress: 0, tie: false });
        k++; made++;
      }
    });
    return made;
  }
  function harmonizeSacredHarp(ctx) {
    var mode = ctx.mode, H = ctx.H || {}, R = ctx.R, out = [];
    var openW = 0.22 + 0.35 * (H.open != null ? H.open : 0.7);
    var withAlto = !!ctx.alto;
    // every part keeps to a window of an octave and a fourth, around the
    // middle of its compass (so no part is wider than a singer's reach)
    ctx.win = {};
    ["S", "A", "B"].forEach(function (p) {
      var b = ctx.bounds[p], t = ctx.tess[p], mid = Math.round((t[0] + t[1]) / 2);
      ctx.win[p] = [Math.max(b[0], mid - 5), Math.min(b[1], mid + 5)];
    });
    ctx.lines.forEach(function (line, li) {
      var slots = slotsOf(line), Rl = R.fork("line:" + li), n = slots.length, B = ctx.win;
      var tune = slots.map(function (s) { return { d: s.deg, a: 0 }; });
      var kind = line.cadence, finRoot = kind === "half" ? 4 : 0;
      var nB = noiseRows(Rl.fork("noise:B"), n, B.B, 0.35), nS = noiseRows(Rl.fork("noise:S"), n, B.S, 0.35), nA = noiseRows(Rl.fork("noise:A"), n, B.A, 0.35);
      function reqBass(k, d) {
        var c = 0, s = slots[k];
        if (s.final || s.trail) { if (cls(d) !== finRoot) c += 20; }
        else if (li === 0 && k === 0 && cls(d) !== 0) c += 1.2;
        if (k === slots.fin - 1 && finRoot === 0 && cls(d) === 4) c -= 0.35;   // sol under the approach home
        return c;
      }
      function reqUpper(k, d, third) {
        var s = slots[k], c = 0;
        if ((s.final || s.trail) && third) c += line.role === "home" ? 30 : kind === "imperfect" ? 0 : 10;
        // the last chord of a line is the chord its cadence names: home's, or the dominant's
        if (s.final || s.trail) { var r = cls(d - finRoot); if (r !== 0 && r !== 2 && r !== 4) c += 12; }
        return c;
      }
      var bass = counterLine(slots, mode, B.B, { T: tune }, true, reqBass, openW * 0.25, nB, 0);
      var treble = counterLine(slots, mode, B.S, { T: tune, B: bass.line }, false, reqUpper, openW, nS, 1.1 + 0.4 * (1 - (H.open || 0.7)));
      var alto = withAlto ? counterLine(slots, mode, B.A, { T: tune, B: bass.line, S: treble.line }, false, reqUpper, openW * 0.7, nA, 0.8) : null;
      var parts = {
        S: slotNotes(slots, line, treble.line),
        T: line.notes.map(function (x) { return { beat: x.beat, beats: x.beats, deg: x.deg, alt: 0, nct: null, syl: x.syl, stress: x.stress, tie: false, cont: x.cont }; }),
        B: slotNotes(slots, line, bass.line),
      };
      if (alto) parts.A = slotNotes(slots, line, alto.line);
      // the chords are what the lines make
      var list = [], chordsBySlot = [];
      slots.forEach(function (s, k) {
        var sounding = [bass.line[k], tune[k], treble.line[k]].concat(alto ? [alto.line[k]] : []).map(function (x) { return { deg: x.d, alt: x.a, s: semi(mode, x.d, x.a) }; });
        sounding.sort(function (a, b) { return a.s - b.s; });
        var ch = chordAt(mode, sounding);
        chordsBySlot.push(ch);
        var last = list[list.length - 1];
        if (last && last.roman === ch.roman) { last.len = s.beat + s.beats - last.beat; return; }
        var tones = []; sounding.forEach(function (x) { if (!tones.some(function (t) { return t[0] === cls(x.deg); })) tones.push([cls(x.deg), x.alt || 0]); });
        tones.sort(function (a, b) { return cls(a[0] - ch.root) - cls(b[0] - ch.root); });
        list.push({ beat: s.beat, len: s.beats, roman: ch.roman, rootDeg: ch.root, quality: ch.quality, tones: tones });
      });
      var fc = chordsBySlot[slots.fin], pc = slots.fin > 0 ? chordsBySlot[slots.fin - 1] : null, real;
      if (fc.root === 4) real = "half";
      else if (fc.root === 0 && !fc.third) real = "openfifth";
      else if (fc.root === 0) real = kind === "imperfect" ? "imperfect" : pc && pc.root === 4 ? "authentic" : "imperfect";
      else real = "none";
      var slurs = shapeNoteSlurs(parts, mode, alto ? ["B", "S", "A"] : ["B", "S"], Rl.fork("slurs"), 0.22 + 0.3 * (H.melisma != null ? H.melisma : 0.35), ctx.split);
      out.push({ parts: parts, chords: list, cadenceKind: real, cadBeat: slots[slots.fin].beat, nct: { pass: slurs }, voiceCost: Math.round((bass.cost + treble.cost + (alto ? alto.cost : 0)) * 100) / 100 });
    });
    return out;
  }

  // ==========================================================================
  // F. THE OLD WAY — the tune alone; the composer marks where the singers
  // may decorate it (a turn on a long stressed note, a slide into a leap, a
  // grace before a line's first note), and the performer does the rest
  // ==========================================================================
  function harmonizeOldWay(ctx) {
    var H = ctx.H || {}, orn = H.ornament != null ? H.ornament : 0.6, out = [];
    ctx.lines.forEach(function (line, li) {
      var Rl = ctx.R.fork("line:" + li), slots = slotsOf(line);
      var S = line.notes.map(function (x, i) {
        var d1 = u01(Rl.fork("turn:" + i)), d2 = u01(Rl.fork("slide:" + i)), d3 = u01(Rl.fork("grace:" + i));
        var prev = i > 0 ? line.notes[i - 1] : null, o = null;
        if (!x.cont && x.stress && x.beats >= 2 * ctx.split - EPS && d1 < orn * 0.85) o = "turn";
        else if (!x.cont && prev && Math.abs(x.deg - prev.deg) >= 2 && d2 < orn * 0.8) o = "slide";
        else if (i === 0 && d3 < orn * 0.6) o = "grace";
        return { beat: x.beat, beats: x.beats, deg: x.deg, alt: 0, nct: null, syl: x.syl, stress: x.stress, tie: false, cont: x.cont, ornament: o };
      });
      out.push({ parts: { S: S }, chords: [], cadenceKind: "none", cadBeat: slots[slots.fin].beat, nct: {} });
    });
    return out;
  }

  // ==========================================================================
  // THE PROFILES — what each dialect draws its hymns from
  // ==========================================================================
  // Every table is a weight. `ranges` are each part's compass and `tess` its
  // comfortable middle, in semitones from the day's keynote (about middle C).
  // `cadences` lists [kind, the tune's last degree, weight, (modes)] by the
  // line's role; `plan` names a cadence that tonicizes (V, or the relative
  // major). `weights` tune the melody search (kolob-composer.js, lineCost).
  // `tolerance` is where a hymn's fingerprint must fall, set from the Earth
  // tunes named in `refs` (their measured values are in the handoff).
  var MAJOR = ["ionian", "penta", "hexa"], MINORS = ["aeolian", "dorian"], MIXO = ["mixolydian"], ALL = MAJOR.concat(MINORS, MIXO);
  var BASE_W = { octave: 3, sixth: 1.2, fifth: 0.25, unrecovered: 1.5, threeSame: 1.6, repeat: 0.12, leapFit: 1.0, contour: 0.32, stressHome: 0.22,
                 stressTense: 0.22, leadingTone: 1.0, fewPitches: 1.2, join: 0.6, sameAsOther: 1.3, memory: 0.3, gesture: 0.8, leapAppetite: 1.0,
                 repeatW: 0.9, octaveW: 0.3, pull: 0.55 };
  function w(over) { var o = {}; for (var k in BASE_W) o[k] = BASE_W[k]; for (k in over) o[k] = over[k]; return o; }
  // a Tabernacle authentic close needs its next-to-last note in the dominant
  // (re, ti, sol, or fa as the seventh); a plagal one, in the subdominant
  function tabFits(kind, t, steps, mode, plan) {
    if (steps.length < 2) return true;
    var pen = cls(t + steps[steps.length - 2]);
    if (plan === "tonicize") return pen === 1 || pen === 5;              // under V/V: re, la (never fa, the chord sharpens it)
    if (plan === "relative") return pen === 6 || pen === 1 || pen === 3; // under VII, the relative's dominant
    if (kind === "authentic") return pen === 1 || pen === 4 || pen === 6 || pen === 3;
    if (kind === "plagal") return pen === 3 || pen === 5 || pen === 0;
    if (kind === "deceptive") return pen === 1 || pen === 4 || (pen === 6 && !MINOR[mode]) || pen === 3;
    return true;
  }
  var TABERNACLE = {
    id: "tabernacle", letter: "C", melodyPart: "S", parts: ["S", "A", "T", "B"],
    about: "the tune on top; full triads, first inversions, V7, secondary dominants, the approach diminished seventh, 4–3 suspensions, the cadential six-four; authentic cadences within, the plagal amen after",
    meters: { CM: 3, LM: 2, SM: 1.2, "87.87": 2, CMD: 0.7, "87.87D": 0.8, "76.76D": 1, "11s": 1, "10.10R": 0.5 },
    times: { "4/4": 4, "3/4": 1.6, "6/8": 0.8, "2/2": 0.7, "3/2": 0.25 },
    modes: { ionian: 5, mixolydian: 0.5, aeolian: 1, dorian: 0.5, hexa: 0.6, penta: 0.4 },
    forms: { ABCD: 1, ABAC: 1.3, AABA: 0.6, "ABA'C": 1, "AA'BA": 0.5 },
    contours: { arch: 2, descent: 1.2, climb: 1, wave: 0.8 },
    cells: { even: 2.2, dotted: 1.3, dotS: 0.5, slurS: 2, slurU: 1.5, long: 1 }, cellRate: 0.6, baseCell: "even",
    leap: 0.2, leapScale: 1, peakTo: { 7: 2, 8: 1.5, 9: 1, 5: 0.8, 4: 0.3 }, range: [7, 9], maxSpan: 10, floorMin: -4,
    figures: { fall: 3, rise: 2, three: 3, four: 1, turn: 1.2, fifth: 0.6, climb: 0.5, sigh: 0.5, again: 0.2, triad: 0.3, third: 0.3, upturn: 0.4 },
    figureFits: tabFits,
    cadences: {
      open: [["half", 1, 2.2, MAJOR], ["half", 4, 1.4, MAJOR], ["half", 6, 0.6, MAJOR], ["imperfect", 2, 2, MAJOR], ["imperfect", 4, 0.8, MAJOR],
             ["half", 4, 1.8, MINORS], ["half", 1, 1.2, MINORS], ["imperfect", 2, 1.4, MINORS], ["imperfect", 4, 0.8, MINORS],
             ["half", 4, 1.5, MIXO], ["half", 1, 1, MIXO], ["imperfect", 2, 1.5, MIXO]],
      arrive: [["half", 1, 1.2, MAJOR], ["half", 4, 1.2, MAJOR], ["authentic", 0, 0.8, MAJOR], ["imperfect", 2, 0.8, MAJOR], ["half:tonicize", 4, 1.4, MAJOR], ["half:tonicize", 1, 0.8, MAJOR],
               ["half:relative", 2, 1.6, MINORS], ["half:relative", 4, 0.6, MINORS], ["half", 4, 1.2, MINORS], ["half", 1, 0.8, MINORS],
               ["half", 4, 1, MIXO], ["plagal", 0, 0.8, MIXO], ["imperfect", 2, 1, MIXO]],
      depart: [["half", 1, 1.6, MAJOR], ["half", 4, 1.2, MAJOR], ["deceptive", 0, 0.9, MAJOR], ["deceptive", 5, 0.4, MAJOR], ["imperfect", 2, 0.8, MAJOR], ["imperfect", 4, 0.6, MAJOR],
               ["half", 4, 1.4, MINORS], ["deceptive", 0, 0.8, MINORS], ["deceptive", 2, 0.4, MINORS], ["imperfect", 2, 0.8, MINORS],
               ["half", 4, 1.2, MIXO], ["half", 1, 1, MIXO], ["imperfect", 2, 0.8, MIXO]],
      home: [["authentic", 0, 1, ALL]],
    },
    ranges: { S: [-1, 19], A: [-5, 12], T: [-12, 7], B: [-20, 0] }, tess: { S: [2, 14], A: [-3, 9], T: [-9, 4], B: [-17, -3] },
    tempo: 1.0, fermata: 0.35, amen: true, refrains: 0.6, search: 140, organ: true,
    weights: w({}),
    rules: { parallels: false, crossing: false, spacing: true },
    refs: ["earth:all-is-well", "earth:assembly", "earth:deseret", "earth:new-salem", "earth:martyr", "earth:fowler", "earth:bethany"],
    tolerance: { par5: [0, 0.02], thirdless: [0, 0.15], crossing: [0, 0], chromatic: [0, 0.07], sevenths: [0.03, 0.4], leap: [0.08, 0.45], melisma: [0, 0.25], melodyRange: [5, 10],
                 // the Psalmody's tunes are all major; a minor hymn raises its leading tone at every dominant
                 minor: { chromatic: [0, 0.13] } },
    harmonize: harmonizeTabernacle,
  };
  var SACREDHARP = {
    id: "sacredharp", letter: "A", melodyPart: "T", parts: ["S", "A", "T", "B"],
    about: "the tune in the tenor; open fifths and octaves, often no third; parallel fifths welcome; voices cross; every part a melody; modal minor; bare-fifth endings; no amen",
    meters: { CM: 3, LM: 2, SM: 1.6, "87.87": 1, "87.87D": 1.2, CMD: 0.8, "11s": 0.8, "76.76D": 0.3 },
    times: { "4/4": 2, "2/2": 1, "3/4": 1.5, "3/2": 1.2, "6/8": 0.6 },
    modes: { ionian: 2, aeolian: 2.2, dorian: 1, mixolydian: 0.6, penta: 1, hexa: 1.2 },
    forms: { ABCD: 3, ABAC: 1, "ABA'C": 0.8, AABA: 0.3, "AA'BA": 0.3 },
    contours: { arch: 1.5, descent: 1.5, climb: 1, wave: 1.2 },
    cells: { even: 1.5, long: 1.2, slurS: 2.5, slurU: 2, dotted: 0.5 }, cellRate: 0.55, baseCell: "even",
    leap: 0.36, leapScale: 1, peakTo: { 7: 2, 8: 1, 5: 1, 4: 0.6, 9: 0.5 }, range: [7, 9], maxSpan: 10, floorMin: -5,
    figures: { fifth: 2.5, fall: 2, rise: 1, three: 1.5, third: 1.2, climb: 0.6, again: 0.4, triad: 0.6, turn: 0.5, four: 0.5 },
    figureFits: null,
    cadences: {
      open: [["half", 4, 1.6, ALL], ["half", 1, 1, ALL], ["openfifth", 0, 1.2, ALL], ["openfifth", 4, 0.8, ALL], ["imperfect", 2, 0.8, ALL]],
      arrive: [["openfifth", 0, 1.5, ALL], ["half", 4, 1.5, ALL], ["half", 1, 1, ALL], ["imperfect", 2, 0.5, ALL]],
      depart: [["half", 4, 1.5, ALL], ["half", 1, 1, ALL], ["openfifth", 4, 0.8, ALL], ["imperfect", 2, 0.6, ALL]],
      home: [["openfifth", 0, 1, ALL]],
    },
    ranges: { S: [-1, 19], A: [-5, 12], T: [-12, 9], B: [-20, 2] }, tess: { S: [5, 16], A: [-2, 9], T: [-9, 5], B: [-17, -3] },
    tempo: 0.86, fermata: 0.1, amen: false, refrains: 0.3, search: 140, organ: false, altoRate: 0.55,
    weights: w({ leapAppetite: 1.3, repeat: 0.18, stressTense: 0.1, leadingTone: 0.4, octave: 1.2, sixth: 0.8, fifth: 0.1, contour: 0.28 }),
    rules: { parallels: true, crossing: true, spacing: false },
    refs: ["earth:new-britain", "earth:kedron", "earth:idumea", "earth:pisgah", "earth:holy-manna", "earth:coronation", "earth:wondrous-love", "earth:beach-spring", "earth:promised-land", "earth:foundation"],
    tolerance: { par5: [0.03, 0.45], thirdless: [0.25, 0.8], crossing: [0, 0.2], chromatic: [0, 0.01], sevenths: [0, 0.1], leap: [0.12, 0.62], melisma: [0.02, 0.35], melodyRange: [5, 10] },
    harmonize: harmonizeSacredHarp,
  };
  var OLDWAY = {
    id: "oldway", letter: "F", melodyPart: "S", parts: ["S"],
    about: "the tune alone, very slow; the ward answers the precentor's line, each singer decorating it their own way",
    meters: { CM: 3, SM: 2, LM: 1.5, "87.87": 0.4 },
    times: { "3/2": 2, "2/2": 1.2, "4/4": 1, "3/4": 0.8 },
    modes: { dorian: 2, aeolian: 2, mixolydian: 1.5, penta: 1.5, ionian: 0.8, hexa: 1 },
    forms: { ABCD: 3, ABAC: 1 },
    contours: { arch: 2, descent: 1.5, wave: 1, climb: 0.5 },
    cells: { slurS: 2.5, slurU: 2, even: 1, long: 1.5 }, cellRate: 0.8, baseCell: "long",
    leap: 0.15, leapScale: 1, peakTo: { 4: 1.2, 5: 1.5, 7: 1 }, range: [5, 7], maxSpan: 8, floorMin: -4,
    figures: { fall: 2, rise: 1, three: 2, climb: 1.2, again: 0.6, turn: 1, fifth: 0.5 },
    figureFits: null,
    cadences: {
      open: [["none", 4, 1.5, ALL], ["none", 1, 1, ALL], ["none", 2, 1, ALL]],
      arrive: [["none", 0, 1.2, ALL], ["none", 4, 1.2, ALL], ["none", 2, 0.8, ALL]],
      depart: [["none", 4, 1.2, ALL], ["none", 1, 1, ALL], ["none", 2, 1, ALL]],
      home: [["none", 0, 1, ALL]],
    },
    ranges: { S: [-3, 14] }, tess: { S: [0, 10] },
    tempo: 2.5, fermata: 0.5, amen: false, refrains: 0, search: 130, organ: false,
    weights: w({ leapAppetite: 0.7, repeat: 0.25, threeSame: 2, unrecovered: 2, octave: 6, sixth: 3, fifth: 0.6, contour: 0.4 }),
    rules: { parallels: true, crossing: true, spacing: false },
    refs: ["earth:new-britain", "earth:idumea", "earth:kedron", "earth:pisgah", "earth:coronation"],
    tolerance: { leap: [0.05, 0.42], melisma: [0.05, 0.5], melodyRange: [4, 9], par5: [0, 0], thirdless: [0, 1], crossing: [0, 0], chromatic: [0, 0], sevenths: [0, 0] },
    harmonize: harmonizeOldWay,
  };
  // the cadence entries' "kind:plan" → kind and plan
  [TABERNACLE, SACREDHARP, OLDWAY].forEach(function (D) {
    for (var role in D.cadences) D.cadences[role] = D.cadences[role].map(function (c) {
      var kp = c[0].split(":"), kind = kp[1] === "tonicize" || kp[1] === "relative" ? "authentic" : kp[0];
      return [kind, c[1], c[2], c[3], kp[1] || null];
    });
  });
  var BY = { tabernacle: TABERNACLE, sacredharp: SACREDHARP, oldway: OLDWAY, C: TABERNACLE, A: SACREDHARP, F: OLDWAY };

  return {
    get: function (name) { return BY[name] || null; },
    names: ["tabernacle", "sacredharp", "oldway"],
    tabernacle: TABERNACLE, sacredharp: SACREDHARP, oldway: OLDWAY,
    chordAt: chordAt, slotsOf: slotsOf, tabernacleVocab: tabernacleVocab, qualityOf: qualityOf, planChords: planChords,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-dialects.js"] = true;   // the load guard's roll call
