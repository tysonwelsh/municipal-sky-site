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
// This room holds all six (PLAN Phase 2 order: C, A, F in round 1; B, D, E
// in round 3):
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
//   B  PSALMODY     the tune in the tenor; rugged four-part homophony that
//                   breaks into a FUGE — the bass leads off with the line's
//                   head, the tenor, the counter and the treble follow a
//                   half-bar or a bar apart, and all four meet on a written
//                   cadence; open fifths and passing clashes let stand.
//   D  GOSPEL       close harmony with the tune in the second voice (the
//                   lead); dominant sevenths in circle-of-fifths chains, sung
//                   4:5:6:7 so they ring; swipes under held words; the men's
//                   echo; a refrain after every verse; a tag.
//   E  SHAKER AND   one melody in unison, in dance time, now and then over a
//      PRIMARY      hummed drone: a Shaker hymn, a gift song on vocables, a
//                   Primary song with its chorus.
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
// Public surface: KOLOB.Dialects = { get(name), names (the first three),
//   all (the six), tabernacle, sacredharp, oldway, psalmody, gospel, shaker,
//   chordAt(mode, degs[]) (a sonority read as a chord), readChords(parts,
//   mode), gospelVocab(mode), … }
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
  function chordTransC(a, b, strong) {
    if (a.to) return a.to.indexOf(b.name) >= 0 ? 0 : 8;
    if (a.name === b.name) return strong ? 0.55 : 0.1;
    if (b.fn === "C" && a.fn === "C") return 8;
    if (a.sev && a.fn === "D" && b.fn !== "T") return 4;
    var k = a.name + ">" + b.name;
    if (has(PAIR, k)) return PAIR[k];
    return (FN_COST[a.fn] || FN_COST.T)[b.fn];
  }
  // the chords a cadence allows at its last two (three) places, by kind
  function cadenceChords(kind, mode, plan, vocab, line) {
    var minor = !!MINOR[mode], I = minor ? "i" : "I";
    var names = function (arr) { return arr.filter(function (n) { return vocab.some(function (c) { return c.name === n; }); }); };
    switch (plan) {
      case "tonicize": return { fin: ["V"], pen: names(["V/V", "V7/V"]), ante: null };
      case "relative": return { fin: ["III"], pen: ["VII"], ante: null };
      // (round 3) A REST mid-verse on a chord that is neither home's nor the
      // dominant's — the Psalmody's lines that settle on IV, on vi, on the
      // mediant — with the tune's own note in it: the tune is the tune it was
      case "rest": {
        var t = line ? cls(line.targetClass) : 0;
        var pool = names(minor ? ["iv", "VI", "III"] : mode === "mixolydian" ? ["IV", "vi", "ii"] : ["IV", "vi", "iii", "ii"]);
        return { fin: pool.filter(function (nm) { var c = vocab.filter(function (x) { return x.name === nm; })[0]; return toneOf(c, t) && toneOf(c, t).alt === 0; }), pen: null, ante: null };
      }
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
    // (a dialect may bring its own grammar: its transitions, its cadences,
    // its standing prices — dialect D does; the Tabernacle uses these)
    var chordTrans = ctx.trans || chordTransC;
    var cad = (ctx.cadenceChords || cadenceChords)(line.cadence, mode, line.plan, vocab, line);
    var color = H.color != null ? H.color : 0.5, sev = H.sevenths != null ? H.sevenths : 0.5, susp = H.susp != null ? H.susp : 0.5;
    function standing(ch) {
      if (ctx.standing) return ctx.standing(ch, H);
      var c = ch.cost;
      if (ch.fn === "A") c *= 1.6 - color * 1.2;
      if (ch.sev && ch.fn !== "A") c *= 1.5 - sev;
      if (ch.fn === "C") c *= 1.5 - susp;
      return c;
    }
    // the dice: a little noise on every (slot, chord), thrown in full
    var noise = [];
    for (var k = 0; k < n; k++) { var row = []; for (var v = 0; v < vocab.length; v++) row.push(u01(R) * 0.45); noise.push(row); }
    // THE TUNE'S SEVENTH FALLS. A chord whose seventh the tune is singing may
    // stand only where the tune steps down from it, or holds it into a chord
    // that keeps the note (the Victorian rule: the seventh is prepared or
    // passed, and it resolves downward — never up, never by leap).
    //   → false (forbidden here), "hold" (allowed if the next chord keeps it), true
    var holdAt = [];                                               // [k][v]: the next chord must keep the tune's note
    function seventhOk(k, ch) {
      if (!ch.sev) return true;
      var s = slots[k], sc = ch.tones[ch.tones.length - 1], res = true;
      for (var j = 0; j < s.notes.length; j++) {
        var nd = s.notes[j];
        if (cls(nd.deg) !== sc.c || sc.alt !== 0) continue;
        var nx = j + 1 < s.notes.length ? s.notes[j + 1].deg : k + 1 < n ? slots[k + 1].deg : null;
        if (nx === nd.deg - 1) continue;                            // it steps down: resolved
        if (nx === nd.deg && j === s.notes.length - 1 && k + 1 < n) { res = "hold"; continue; }   // held over: the next chord decides
        return false;                                              // up, by leap, or at the line's end
      }
      return res;
    }
    function emit(k, ch) {
      var s = slots[k], m = cls(s.deg), t = toneOf(ch, m), c = standing(ch) + noise[k][vocab.indexOf(ch)];
      // (a partner hymn stands on the first hymn's chords: the one there, or none)
      var forced = ctx.forcedAt ? ctx.forcedAt(k) : null;
      if (forced && vocab.some(function (x) { return x.name === forced; }) && ch.name !== forced) return INF;
      if (ch.only === "approach" && !forced) {
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
      var sOk = seventhOk(k, ch);
      if (!sOk) return INF;
      holdAt[k][vocab.indexOf(ch)] = sOk === "hold";
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
    for (k = 0; k < n; k++) holdAt.push([]);
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
          if (holdAt[k - 1][u] && !toneOf(ch, cls(slots[k].deg))) continue;   // a held seventh needs a chord that keeps it
          if (slots[k].swipe && u === v) continue;                     // (a swipe: the chord changes under the held word)
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
    else if (ctx.rootOnly) bassTones.push([0, 0]);                // a close stands on its root (the bass sings sol–do, fa–do)
    else {
      bassTones.push([0, 0]);
      bassTones.push([1, (ch.fn === "D" && !ch.sev && ctx.cadenceSlot ? 1.2 : 0.62 - 0.35 * color) + (ctx.rootPref || 0)]);
      if (ch.sev) { bassTones.push([2, 0.8 + (ctx.rootPref || 0)]); bassTones.push([ch.tones.length - 1, 1.1 + (ctx.rootPref || 0)]); }
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
    // into them: the Victorian editors strike them out with the parallels
    var ms = sb[0] - sa[0], mb = sb[3] - sa[3], io = Math.abs(sb[0] - sb[3]) % 12;
    if (ms && mb && (ms > 0) === (mb > 0) && (io === 7 || io === 0) && Math.abs(ms) > 2) c += parW * 0.4;
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
        if (a.ch.sev && t.c === a.ch.tones[a.ch.tones.length - 1].c && !(mv === -1 || mv === -2 || (mv === 0 && toneOf(b.ch, t.c)))) c += 8;
      }
    } else if (a.ch.sev) {
      // the same seventh chord again: the voice on the seventh holds it or
      // lets it fall; it does not leap off to another of the chord's notes
      var sc = a.ch.tones[a.ch.tones.length - 1], vA = [a.S, a.A, a.T, a.B];
      for (v = 1; v < 4; v++) if (cls(vA[v].d) === sc.c && vA[v].a === sc.alt) { var mv2 = sb[v] - sa[v]; if (mv2 && mv2 !== -1 && mv2 !== -2) c += 4; }
    }
    return c;
  }
  // the voices of one line, continuing from the voicing the line before ended on
  function voiceLine(slots, chords, prevV, ctx) {
    var n = slots.length, mode = ctx.mode, INF = 1e9, parW = ctx.parW != null ? ctx.parW : 30;
    var cands = [], cost = [], back = [];
    for (var k = 0; k < n; k++) {
      var root = !!(ctx.rootAt && ctx.rootAt[k]), pref = ctx.rootPref ? ctx.rootPref[k] || 0 : 0;
      // (a dialect may voice its own way: dialect D sets the lead second from the top)
      var voicer = ctx.voicer || voicingsFor, extra = ctx.voicerCtx || {};
      var vx = function (o) { for (var q in extra) o[q] = extra[q]; return o; };
      var cc = voicer(slots[k], chords[k], vx({ mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, cadenceSlot: slots[k].final, rootOnly: root, rootPref: pref, k: k }));
      if (!cc.length) {                                                // widen the compass rather than fail
        var wide = {}; for (var p in ctx.bounds) wide[p] = [ctx.bounds[p][0] - 2, ctx.bounds[p][1] + 2];
        cc = voicer(slots[k], chords[k], vx({ mode: mode, bounds: wide, tess: ctx.tess, H: ctx.H, rootOnly: root, rootPref: pref, k: k }));
        if (!cc.length && root) cc = voicer(slots[k], chords[k], vx({ mode: mode, bounds: wide, tess: ctx.tess, H: ctx.H, k: k }));
      }
      if (!cc.length) cc = [(ctx.fallback || fallbackVoicing)(slots[k], chords[k], ctx)];     // never: but a line always sounds
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
      var forcedAt = ctx.forced ? function (k) { return ctx.forced(li, slots[k].beat); } : null;
      var pc = planChords(line, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: approach, favour: favour, shortBeat: ctx.shortBeat, forcedAt: forcedAt }, Rl.fork("chords"));
      var relaxed = false;
      // (a partner whose weak notes will not sit on every one of the first
      // hymn's chords keeps those chords on the beats, and chooses between them)
      if (!pc && forcedAt) pc = planChords(line, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: approach, favour: favour, shortBeat: ctx.shortBeat,
                                                                         forcedAt: function (k) { return slots[k].stress || slots[k].final ? forcedAt(k) : null; } }, Rl.fork("chords"));
      if (!pc) { relaxed = true; pc = planChords({ cadence: "none", plan: null, role: line.role === "home" ? "home" : "open", notes: line.notes }, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: [], shortBeat: 9, loose: true, forcedAt: forcedAt ? function (k) { return slots[k].stress ? forcedAt(k) : null; } : null }, Rl.fork("chords:relaxed")); }
      if (!pc) pc = planChords({ cadence: "none", plan: null, role: line.role === "home" ? "home" : "open", notes: line.notes }, slots, vocab, prevCh, { mode: mode, H: ctx.H, first: li === 0, approach: [], shortBeat: 9, loose: true }, Rl.fork("chords:relaxed"));
      var chords = pc.chords;
      // THE CLOSE STANDS ON ITS ROOT. A full close (authentic or plagal, the
      // tonicized arrival in the dominant or the relative, and whatever
      // comes home) ends with the root in the bass — the hymnal's bass sings
      // sol–do (or fa–do) under every full close; a first-inversion tonic is
      // an open door, not an arrival. Under the last line the dominant before
      // it is in root position too; under an inner authentic close the bass
      // leans that way.
      var kindNow = relaxed ? realizedKind(chords, slots, mode) : line.cadence;
      var full = line.role === "home" || line.plan === "tonicize" || line.plan === "relative" || line.plan === "rest" || kindNow === "authentic" || kindNow === "plagal";
      var rootAt = [], rootPref = [];
      slots.forEach(function (s, k) {
        var dom = k === slots.fin - 1 && chords[k].fn === "D";
        // (the dominant proper — V, V7 — is held to it; a modal VII or v before
        // home only leans, since a tune on the subtonic over VII's root would
        // walk up to the final in octaves with the bass)
        var trueV = dom && (chords[k].name === "V" || chords[k].name === "V7");
        rootAt.push(full && (s.final || s.trail) || (line.role === "home" && trueV));
        rootPref.push(dom && full ? 1.2 : 0);
      });
      var vl = voiceLine(slots, chords, prevV, { mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, parW: 30, rootAt: rootAt, rootPref: rootPref });
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
        // (both chords of the amen on their roots: the bass sings fa–do)
        var av = voiceLine(as, [IV, I], prevV, { mode: mode, bounds: ctx.bounds, tess: ctx.tess, H: ctx.H, parW: 30, rootAt: [true, true] });
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
    // (round 3: a class is counted once — `!pcs[c]` let home's own note, whose
    // alteration is 0, in again at every octave, so an all-do close never
    // read as the unison it is, and home's chord was overweighted)
    notes.forEach(function (n) { var c = cls(n.deg); if (!has(pcs, c)) { pcs[c] = n.alt || 0; list.push(c); } });
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
  function counterLine(slots, mode, bounds, fixed, isBass, req, openW, noise, crossW, cons) {
    var n = slots.length, INF = 1e9, cands = [], cost = [], back = [], CONS_ = cons || CONS;
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
          var iv = Math.abs(s - sf) % 12, tab = lowIsBass ? CONS_.bass : CONS_.upper;
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
      var lo = Math.max(b[0], mid - 5), hi = Math.min(b[1], mid + 5);
      // counted in semitones, not steps: ten steps can be eighteen semitones
      while (semi(mode, hi, 0) - semi(mode, lo, 0) > 17) { if (hi - mid >= mid - lo) hi--; else lo++; }
      ctx.win[p] = [lo, hi];
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
        // most closes are bare; a line the plan closes FULL (line.full: in
        // the major modes about one inner close in four, as the book has it)
        // keeps its third, and the hymn's last chord never does
        if (s.final || s.trail) {
          if (line.role === "home") c += third ? 30 : 0;
          else if (line.full) c += third ? 0 : 6;
          else if (third) c += kind === "imperfect" ? 0 : 10;
        }
        // the last chord of a line is the chord its cadence names: home's, or the dominant's
        if (s.final || s.trail) { var r = cls(d - finRoot); if (r !== 0 && r !== 2 && r !== 4) c += 12; }
        // (round 3: now and then a line closes on a bare unison or octave, every
        // part on the tune's own note — one close in seven in the 1844 book)
        if (line.bare && (s.final || s.trail) && cls(d) !== cls(s.deg)) c += 9;
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
  // B. NEW ENGLAND PSALMODY — the fuging tune (Billings, Read, Morgan,
  // Holden: Boston and the Connecticut valley, 1770–1800)
  // ==========================================================================
  // Most of a fuging tune is plain four-part homophony, rougher than the
  // Tabernacle's and a little fuller than the Sacred Harp's: the tune in the
  // tenor, the treble and the counter (the alto) each a line of its own, open
  // fifths and parallels where they fall, and a passing clash left standing
  // when it passes. Then, usually at the third line, the parts FALL OUT: the
  // bass leads off alone with the head of the line and its words; half a bar
  // or a bar later the tenor comes in with the same head (it is the tune), then
  // the counter, then the treble — the words overlapping, "a musical
  // conversation" (Billings, 1770) — and all four fall together on a cadence
  // that is written, not happened upon. Each entry is checked for consonance
  // where it lands; the heads alternate between home's pitch and the
  // dominant's. The later voices sing the same words in quicker notes, the
  // earlier ones stretch theirs, so that everyone arrives at once.
  var CONS_B = {    // the square's table with its passing clashes loosened on the weak beats
    bass: { 0: [0.25, 0.2], 7: [0, 0], 3: [0.15, 0.1], 4: [0.15, 0.1], 8: [0.6, 0.35], 9: [0.45, 0.25], 5: [2.2, 0.9], 2: [5, 1.0], 10: [5, 1.0], 1: [8, 2.4], 11: [8, 2.4], 6: [8, 3] },
    upper: { 0: [0.2, 0.2], 7: [0.05, 0.05], 5: [0.12, 0.1], 3: [0.06, 0.06], 4: [0.06, 0.06], 8: [0.12, 0.1], 9: [0.1, 0.08], 2: [4, 0.7], 10: [4, 0.7], 1: [7, 2], 11: [7, 2], 6: [5, 1.5] },
  };
  // the entry distance: half a bar in common time, a bar in the short and the triple ones
  function fugeGap(bar) { return bar === 4 ? 2 : bar === 6 ? 3 : bar; }
  function partWindows(ctx, names) {
    var mode = ctx.mode, win = {};
    names.forEach(function (p) {
      var b = ctx.bounds[p], t = ctx.tess[p], mid = Math.round((t[0] + t[1]) / 2);
      var lo = Math.max(b[0], mid - 5), hi = Math.min(b[1], mid + 5);
      while (semi(mode, hi, 0) - semi(mode, lo, 0) > 17) { if (hi - mid >= mid - lo) hi--; else lo++; }
      win[p] = [lo, hi];
    });
    return win;
  }
  // one homophonic line of a psalm tune: the square's counterpoint, the
  // counter always present, the weak beats' clashes let stand
  function psalmodyLine(line, li, ctx, openW) {
    var mode = ctx.mode, H = ctx.H || {}, R = ctx.R, B = ctx.win;
    var slots = slotsOf(line), Rl = R.fork("line:" + li), n = slots.length;
    var tune = slots.map(function (s) { return { d: s.deg, a: 0 }; });
    var kind = line.cadence, finRoot = kind === "half" ? 4 : 0;
    var nB = noiseRows(Rl.fork("noise:B"), n, B.B, 0.35), nS = noiseRows(Rl.fork("noise:S"), n, B.S, 0.35), nA = noiseRows(Rl.fork("noise:A"), n, B.A, 0.35);
    function reqBass(k, d) {
      var c = 0, s = slots[k];
      if (s.final || s.trail) { if (cls(d) !== finRoot) c += 20; }
      else if (li === 0 && k === 0 && cls(d) !== 0) c += 1.2;
      if (k === slots.fin - 1 && finRoot === 0 && cls(d) === 4) c -= 0.45;   // sol under the approach home
      return c;
    }
    function reqUpper(k, d, third) {
      var s = slots[k], c = 0;
      if (s.final || s.trail) {
        if (line.role === "home") c += third ? 30 : 0;               // the last chord is bare
        else if (line.full) c += third ? 0 : 5;
        else if (third) c += kind === "imperfect" ? 0 : 8;
        var r = cls(d - finRoot); if (r !== 0 && r !== 2 && r !== 4) c += 12;
        if (line.bare && cls(d) !== cls(s.deg)) c += 9;
      }
      return c;
    }
    var bass = counterLine(slots, mode, B.B, { T: tune }, true, reqBass, openW * 0.25, nB, 0, CONS_B);
    var treble = counterLine(slots, mode, B.S, { T: tune, B: bass.line }, false, reqUpper, openW, nS, 0.9 + 0.4 * (1 - (H.open != null ? H.open : 0.6)), CONS_B);
    var alto = counterLine(slots, mode, B.A, { T: tune, B: bass.line, S: treble.line }, false, reqUpper, openW * 0.6, nA, 0.7, CONS_B);
    var parts = {
      S: slotNotes(slots, line, treble.line), A: slotNotes(slots, line, alto.line),
      T: line.notes.map(function (x) { return { beat: x.beat, beats: x.beats, deg: x.deg, alt: 0, nct: null, syl: x.syl, stress: x.stress, tie: false, cont: x.cont }; }),
      B: slotNotes(slots, line, bass.line),
    };
    var read = readChords(parts, mode);
    var slurs = shapeNoteSlurs(parts, mode, ["B", "S", "A"], Rl.fork("slurs"), 0.25 + 0.3 * (H.melisma != null ? H.melisma : 0.35), ctx.split);
    return { parts: parts, chords: read.list, cadenceKind: realOpenKind(read, slots[slots.fin].beat, kind), cadBeat: slots[slots.fin].beat, nct: { pass: slurs },
             voiceCost: Math.round((bass.cost + treble.cost + alto.cost) * 100) / 100 };
  }
  // the chords the lines make, onset by onset (every part's onsets), as the
  // Sacred Harp reads its own: chordAt of what sounds
  function readChords(parts, mode) {
    var names = Object.keys(parts), beats = {};
    names.forEach(function (p) { parts[p].forEach(function (n) { beats[Math.round(n.beat * 1000) / 1000] = true; }); });
    var bs = Object.keys(beats).map(Number).sort(function (a, b) { return a - b; }), list = [], at = {};
    bs.forEach(function (b) {
      var sounding = [];
      names.forEach(function (p) { var n = noteAt(parts[p], b); if (n) sounding.push({ deg: n.deg, alt: n.alt || 0, s: semi(mode, n.deg, n.alt || 0) }); });
      if (sounding.length < 2) return;
      sounding.sort(function (x, y) { return x.s - y.s; });
      var ch = chordAt(mode, sounding);
      at[b] = ch;
      var last = list[list.length - 1];
      var end = 0; names.forEach(function (p) { parts[p].forEach(function (n) { end = Math.max(end, n.beat + n.beats); }); });
      if (last && last.roman === ch.roman) { last.len = Math.max(last.len, 0); return; }
      if (last) last.len = b - last.beat;
      var tones = []; sounding.forEach(function (x) { if (!tones.some(function (t) { return t[0] === cls(x.deg); })) tones.push([cls(x.deg), x.alt || 0]); });
      tones.sort(function (a, b2) { return cls(a[0] - ch.root) - cls(b2[0] - ch.root); });
      list.push({ beat: b, len: Math.max(0.001, end - b), roman: ch.roman, rootDeg: ch.root, quality: ch.quality, tones: tones });
    });
    // each chord stands until the next one begins; the last, to the line's end
    var end2 = 0; names.forEach(function (p) { parts[p].forEach(function (n) { end2 = Math.max(end2, n.beat + n.beats); }); });
    for (var i = 0; i < list.length; i++) list[i].len = Math.round(((i + 1 < list.length ? list[i + 1].beat : end2) - list[i].beat) * 1000) / 1000;
    return { list: list, at: at };
  }
  function realOpenKind(read, cadBeat, planned) {
    var fc = read.at[Math.round(cadBeat * 1000) / 1000];
    if (!fc) return planned;
    if (fc.root === 4) return "half";
    if (fc.root === 0 && !fc.third) return "openfifth";
    if (fc.root === 0) return planned === "imperfect" ? "imperfect" : "authentic";
    return "none";
  }

  // ---- THE FUGE ------------------------------------------------------------
  // line: the tune's line (the tenor), with its notes, cadence and plan;
  // returns the line with four staggered entries, or null (the line stays
  // homophonic) when the words cannot be fitted to the entries
  function fugeLine(line, li, ctx, openW) {
    var mode = ctx.mode, H = ctx.H || {}, R = ctx.R.fork("fuge:" + li), W = ctx.win, u = ctx.split, bar = ctx.bar;
    var E = fugeGap(bar), ten = line.notes;
    // the syllables, and where each begins in the tune
    var sylStart = [], sylNotes = [];
    ten.forEach(function (x, i) { if (!x.cont) { sylStart.push(x.beat); sylNotes.push([i]); } else sylNotes[sylNotes.length - 1].push(i); });
    var nS = sylStart.length;
    var cs = nS - 1; while (cs > 0 && !ten[sylNotes[cs][0]].stress) cs--;        // the cadence syllable (the long note)
    var firstStress = 0; while (firstStress < nS && !ten[sylNotes[firstStress][0]].stress) firstStress++;
    var C = E + sylStart[cs];                                                // where everyone meets
    var lenT = ten[ten.length - 1].beat + ten[ten.length - 1].beats;
    var entries = [["B", 0], ["A", 2 * E], ["S", 3 * E]];
    // the rhythm of one entering voice: the head in the tune's own rhythm,
    // the words between spread over the time left (stressed syllables longer),
    // the cadence and a feminine ending's syllables with everyone else's
    function rhythmFor(o, hs) {
      var HL = sylStart[hs], m = cs - hs, Dv = C - o - HL;
      var U = Math.floor(Dv / u + 1e-9);
      if (m < 1 || U < m) return null;
      var w = [], tot = 0;
      for (var j = hs; j < cs; j++) { var st = ten[sylNotes[j][0]].stress ? 2 : 1; w.push(st); tot += st; }
      var alloc = w.map(function (x) { return Math.max(1, Math.floor(x * U / tot)); }), left = U - alloc.reduce(function (a, b) { return a + b; }, 0);
      for (var q = 0; left > 0; q = (q + 1) % alloc.length) { if (w[q] === 2 || alloc.every(function (a, i) { return w[i] !== 2; })) { alloc[q]++; left--; } }
      while (left < 0) { var big = alloc.indexOf(Math.max.apply(null, alloc)); alloc[big]--; left++; }
      var notes = [];
      // the head: the tune's own notes (a melisma of the head sung as the tune sings it)
      for (var h = 0; h < hs; h++) sylNotes[h].forEach(function (i, q) { var x = ten[i]; notes.push({ beat: o + x.beat, beats: x.beats, syl: h, stress: x.stress, cont: q > 0, head: true, src: i }); });
      var t = o + HL;
      for (j = 0; j < m; j++) { notes.push({ beat: t, beats: alloc[j] * u, syl: hs + j, stress: ten[sylNotes[hs + j][0]].stress, cont: false }); t += alloc[j] * u; }
      // the cadence syllable and what follows it, in step with the tune
      for (j = cs; j < nS; j++) {
        var i0 = sylNotes[j][0], last = sylNotes[j][sylNotes[j].length - 1];
        notes.push({ beat: E + ten[i0].beat, beats: ten[last].beat + ten[last].beats - ten[i0].beat, syl: j, stress: ten[i0].stress, cont: false, cad: j === cs });
      }
      return notes;
    }
    // the head is the line's opening words: to the second stress, and a syllable more
    // (four entries apart, with the longest head the words allow; failing that,
    // the treble comes in with the counter)
    var hs0 = clamp(firstStress + 3, 2, cs - 1), plan = null;
    [3 * E, 2 * E].forEach(function (sAt) {
      for (var hs = hs0; hs >= 2 && !plan; hs--) {
        var rB = rhythmFor(0, hs), rA = rhythmFor(2 * E, hs), rS = rhythmFor(sAt, hs);
        if (rB && rA && rS) plan = { hs: hs, B: rB, A: rA, S: rS, sAt: sAt };
      }
    });
    if (!plan) return null;
    entries[2][1] = plan.sAt;
    // the tenor: the tune, a gap late
    var T = ten.map(function (x) { return { beat: x.beat + E, beats: x.beats, deg: x.deg, alt: 0, nct: null, syl: x.syl, stress: x.stress, tie: false, cont: x.cont }; });
    var parts = { T: T };
    var kind = line.cadence, finRoot = kind === "half" ? 4 : 0, tuneFin = ten[sylNotes[cs][0]].deg;
    // what a written part sounds at a beat (or null)
    function soundAt(p, b) { var n = noteAt(parts[p], b); return n ? semi(mode, n.deg, n.alt || 0) : null; }
    function strongAt(b) { var inBar = ((b % bar) + bar) % bar; return inBar < EPS || (bar === 4 && Math.abs(inBar - 2) < EPS) || (bar === 6 && Math.abs(inBar - 3) < EPS); }
    function vert(s, b, isBass, written) {
      var c = 0;
      written.forEach(function (p) {
        var sf = soundAt(p, b); if (sf == null) return;
        var tab = isBass || p === "B" ? CONS_B.bass : CONS_B.upper, iv = Math.abs(s - sf) % 12;
        c += tab[iv][strongAt(b) ? 0 : 1];
        if (isBass && s > sf) c += 6;
        if (!isBass && p === "B" && s <= sf) c += 6;
        if (s === sf) c += 0.5;
      });
      return c;
    }
    // what the others start while this note is held: a passing clash, let stand (half price)
    function heldClash(s, b0, b1, isBass, written) {
      var c = 0;
      written.forEach(function (p) {
        parts[p].forEach(function (n, ni) {
          if (n.beat < b0 - EPS || n.beat >= b1 - EPS || (n.beat <= b0 + EPS && ni > 0)) return;
          var sf = semi(mode, n.deg, n.alt || 0), tab = isBass || p === "B" ? CONS_B.bass : CONS_B.upper, ic = Math.abs(s - sf) % 12;
          if (n.beat > b0 + EPS) c += 0.5 * tab[ic][strongAt(n.beat) ? 0 : 1];
          // (another part's ENTRY, landing on this note: it must land consonant)
          if (ni === 0 && (ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6)) c += 20;
        });
      });
      return c;
    }
    var report = [];
    // one voice: the head at a drawn transposition, the rest by a Viterbi
    // through its compass against the parts already written
    function writeVoice(p, rhythm, written, prefer, entryNo) {
      var win = W[p], isBass = p === "B", headIdx = [], restIdx = [];
      rhythm.forEach(function (x, i) { (x.head ? headIdx : restIdx).push(i); });
      var die = u01(R.fork("head:" + p));
      // the head's transposition, in steps: an octave, a fifth or a fourth
      // away (or at the unison), the one that lies in the compass, sounds
      // with what is already singing, and keeps the tonic–dominant alternation
      var best = null, together = written.some(function (q) { return parts[q][0] && Math.abs(parts[q][0].beat - rhythm[0].beat) < EPS; });
      // (a voice that enters WITH another may take the head a third or a tenth above it instead)
      [-14, -11, -10, -7, -4, -3, 0, 3, 4, 7, 8, 11].concat(together ? [2, 9] : []).forEach(function (t) {
        var degs = headIdx.map(function (i) { return ten[rhythm[i].src].deg + t; }), c = 0;
        if (degs.some(function (d) { return d < win[0] || d > win[1]; })) return;
        // (the entry itself lands consonant: no second, seventh or tritone against what sounds)
        var s0 = semi(mode, degs[0], 0), clash = written.some(function (q) { var o = soundAt(q, rhythm[headIdx[0]].beat); if (o == null) return false; var ic = Math.abs(s0 - o) % 12; return ic === 1 || ic === 2 || ic === 10 || ic === 11 || ic === 6; });
        if (clash) return;
        for (var q = 1; q < degs.length; q++) if (Math.abs(semi(mode, degs[q], 0) - semi(mode, degs[q - 1], 0)) % 12 === 6) return;   // the head sings no tritone
        var klass = ((t % 7) + 7) % 7;
        c += klass === prefer ? 0 : (klass === 0 || klass === 4 || klass === 3) ? 0.7 : together && klass === 2 ? 0.4 : 2;
        headIdx.forEach(function (i, q) { c += vert(semi(mode, degs[q], 0), rhythm[i].beat, isBass, written) + heldClash(semi(mode, degs[q], 0), rhythm[i].beat, rhythm[i].beat + rhythm[i].beats, isBass, written); });
        // (a head that shadows a voice already singing — in octaves, in fifths — is no entry at all)
        written.forEach(function (q2) {
          var same = 0;
          headIdx.forEach(function (i, q) { var o = soundAt(q2, rhythm[i].beat); if (o != null) { var ic = Math.abs(semi(mode, degs[q], 0) - o) % 12; if (ic === 0 || ic === 7) same++; } });
          if (same >= 2) c += 2.5 * (same - 1);
        });
        var mean = degs.reduce(function (a, b) { return a + b; }, 0) / degs.length;
        c += Math.abs(mean - (win[0] + win[1]) / 2) * 0.25 + die * 0.3;
        if (!best || c < best.c) best = { t: t, c: c, degs: degs };
      });
      if (!best) return false;
      // the rest: a walk through the compass
      var INF = 1e9, noise = [], prevHead = best.degs[best.degs.length - 1], prevHead2 = best.degs.length > 1 ? best.degs[best.degs.length - 2] : null;
      var Rn = R.fork("walk:" + p);
      restIdx.forEach(function () { var row = []; for (var d = win[0]; d <= win[1]; d++) row.push(u01(Rn) * 0.3); noise.push(row); });
      var cost = [], back = [];
      restIdx.forEach(function (i, k) {
        var x = rhythm[i], row = [], brow = [];
        for (var d = win[0]; d <= win[1]; d++) {
          var s = semi(mode, d, 0), c = vert(s, x.beat, isBass, written) + heldClash(s, x.beat, x.beat + x.beats, isBass, written) + noise[k][d - win[0]];
          if (x.cad || i > restIdx[0] && rhythm[i - 1] && rhythm[i - 1].cad) {
            // the written cadence: the bass on its root, the others on its chord (bare unless the plan keeps the third)
            if (isBass) { if (cls(d) !== finRoot) c += 25; }
            else {
              var r = cls(d - finRoot); if (r !== 0 && r !== 4 && !(r === 2 && (line.full || kind === "imperfect"))) c += 14;
              if (line.role === "home" && r === 2) c += 30;
            }
          }
          if (k === 0) { c += melodicCost(prevHead, d, prevHead2, isBass); row.push(c); brow.push(-1); continue; }
          var bst = INF, arg = -1;
          for (var e = win[0]; e <= win[1]; e++) {
            var pc = cost[k - 1][e - win[0]]; if (pc >= INF || pc >= bst) continue;
            var pp = k > 1 ? win[0] + back[k - 1][e - win[0]] : prevHead;
            var mv = melodicCost(e, d, pp, isBass);
            if (Math.abs(semi(mode, d, 0) - semi(mode, e, 0)) === 6) mv += 4;
            // parallels against each written part, from this voice's last onset to this one
            written.forEach(function (q) {
              var a0 = soundAt(q, rhythm[restIdx[k - 1]].beat), a1 = soundAt(q, x.beat);
              if (a0 == null || a1 == null) return;
              var m1 = s - semi(mode, e, 0), m2 = a1 - a0;
              if (m1 && m2 && (m1 > 0) === (m2 > 0)) {
                var i1 = Math.abs(semi(mode, e, 0) - a0) % 12, i2 = Math.abs(s - a1) % 12;
                if (i1 === 7 && i2 === 7) mv += 0.3;
                if (i1 === 0 && i2 === 0) mv += 1.2;
              }
            });
            if (pc + mv < bst) { bst = pc + mv; arg = e - win[0]; }
          }
          row.push(bst + c); brow.push(arg);
        }
        cost.push(row); back.push(brow);
      });
      var degsRest = new Array(restIdx.length);
      if (restIdx.length) {
        var lastRow = cost[restIdx.length - 1], at = 0;
        for (var z = 1; z < lastRow.length; z++) if (lastRow[z] < lastRow[at]) at = z;
        for (var k2 = restIdx.length - 1; k2 >= 0; k2--) { degsRest[k2] = win[0] + at; at = back[k2][at]; }
      }
      var hq = 0, rq = 0;
      parts[p] = rhythm.map(function (x) {
        var d = x.head ? best.degs[hq++] : degsRest[rq++];
        return { beat: Math.round(x.beat * 1000) / 1000, beats: Math.round(x.beats * 1000) / 1000, deg: d, alt: 0, nct: null, syl: x.cont ? null : x.syl, ownSyl: x.cont ? null : x.syl, stress: x.stress, tie: false };
      });
      report.push({ part: p, at: rhythm[0].beat, transpose: best.t, entry: entryNo });
      return true;
    }
    // the bass leads (at home's pitch or the dominant's), the counter answers
    // at the other, the treble at the first again — the tenor, the tune,
    // stands between at its own pitch
    var tonicFirst = u01(R.fork("order")) < 0.55;
    var ok = writeVoice("B", plan.B, ["T"], tonicFirst ? 0 : 4, 1) &&
             writeVoice("A", plan.A, ["T", "B"], tonicFirst ? 4 : 0, 3) &&
             writeVoice("S", plan.S, ["T", "B", "A"], tonicFirst ? 0 : 4, 4);
    if (!ok) return null;
    report.splice(1, 0, { part: "T", at: E, transpose: 0, entry: 2 });
    var read = readChords(parts, mode);
    var kindReal = realOpenKind(read, C, kind);
    return { parts: parts, chords: read.list, cadenceKind: kindReal, cadBeat: C, shift: E, nct: {}, fuge: { gap: E, head: plan.hs, entries: report } };
  }
  function harmonizePsalmody(ctx) {
    var H = ctx.H || {}, out = [];
    var openW = 0.1 + 0.3 * (H.open != null ? H.open : 0.6);      // the counter often sings the third
    ctx.win = partWindows(ctx, ["S", "A", "B"]);
    // the fuge's line: drawn from the harmony's own dice (the tune is the
    // tune either way) — usually the third, now and then the last
    var nV = ctx.nVerse || ctx.lines.length, fd = u01(ctx.R.fork("fuge:where")), fr = u01(ctx.R.fork("fuge:rate"));
    var want = fr < (ctx.fugeRate != null ? ctx.fugeRate : 0.9) * (0.85 + 0.3 * (H.fuge != null ? H.fuge : 0.4));
    // the third line first (or the last); if the words will not go into the
    // entries there, the other
    var order = nV >= 4 ? (fd < 0.68 ? [nV - 2, nV - 1] : [nV - 1, nV - 2]) : [nV - 1];
    var fugue = null, tried = [], lines = [];
    if (want) for (var oi = 0; oi < order.length && !fugue; oi++) {
      var li0 = order[oi], line0 = ctx.lines[li0];
      if (!line0 || line0.notes.length < 5) { tried.push(li0); continue; }
      var f0 = fugeLine(line0, li0, ctx, openW);
      if (f0) { lines[li0] = f0; fugue = { line: li0, entries: f0.fuge.entries, gap: f0.fuge.gap, head: f0.fuge.head }; } else tried.push(li0);
    }
    ctx.lines.forEach(function (line, li) { out.push(lines[li] || psalmodyLine(line, li, ctx, openW)); });
    out.fuge = fugue || { line: -1, wanted: want, tried: tried };
    return out;
  }

  // ==========================================================================
  // D. GOSPEL AND BARBERSHOP — the ringing seventh (Sankey's gospel hymns,
  // the parlour quartet, the barbershop, 1870–1910)
  // ==========================================================================
  // Dominant sevenths everywhere, and in chains: a secondary dominant falls a
  // fifth into the next (III7 → VI7 → II7 → V7 → I, the barbershop's own
  // progression). The tune is the LEAD, the second voice from the top: a
  // tenor harmony floats above it, the baritone fills below it, the bass
  // walks the roots. The harmony is close — the upper three inside an octave
  // or so — and a seventh chord is sung COMPLETE, four different notes, which
  // is what lets it ring: tuned 4:5:6:7 (kolob-composer.js tunes it; SCORE
  // §2, the seventh partial) the overtones lock and a fifth voice seems to
  // sing over the four. SWIPES: under a held word the chord changes while the
  // lead holds. ECHOES: the men answer the women's line ends. A REFRAIN after
  // every verse, and after the last one a TAG — the lead holds a post while
  // the chords swipe round it, and the last chord rings.
  //
  // In the Score the lead is part T (a melody part may be S or T), the tenor
  // harmony above it S, the baritone A and the bass B; Hymn.voiceOrder says
  // so top to bottom (S, T, A, B). Inside this harmonizer the four are kept
  // in their vertical order — S, lead, baritone, bass — under the voice
  // search's field names S, A, T, B, so the shared voice-leading rules read
  // the right neighbours; they are handed back under their Score names.
  function gospelVocab(mode) {
    var V = [], minor = !!MINOR[mode], mixo = mode === "mixolydian";
    if (!minor) {
      V.push(mk("I", 0, "T"), mk("ii", 1, "P", { cost: 0.3 }), mk("iii", 2, "T", { cost: 1.0 }), mk("IV", 3, "P"), mk("vi", 5, "T", { cost: 0.3 }),
             mk("V", 4, "D", { a3: mixo ? 1 : 0, cost: 0.3 }), mk("V7", 4, "D", { a3: mixo ? 1 : 0, seventh: true, cost: 0 }),
             mk("ii7", 1, "P", { seventh: true, cost: 0.45 }),
             mk("I7", 0, "A", { seventh: true, a7: mixo ? 0 : -1, cost: 0.4, to: ["IV", "ii", "ii7", "iv"] }),
             mk("II7", 1, "A", { a3: 1, seventh: true, cost: 0.12, to: ["V", "V7"] }),
             mk("VI7", 5, "A", { a3: 1, seventh: true, cost: 0.2, to: ["II7", "ii", "ii7"] }),
             mk("III7", 2, "A", { a3: 1, seventh: true, cost: 0.32, to: ["VI7", "vi"] }),
             mk("iv", 3, "P", { a3: -1, cost: 1.1 }));
      if (mixo) V.push(mk("♭VII", 6, "D", { cost: 0.4 }));
    } else {
      V.push(mk("i", 0, "T"), mk("iv", 3, "P"), mk("VI", 5, "T", { cost: 0.2 }), mk("III", 2, "T", { cost: 0.3 }), mk("VII", 6, "D", { cost: 0.5 }),
             mk("V", 4, "D", { a3: 1, cost: 0.2 }), mk("V7", 4, "D", { a3: 1, seventh: true, cost: 0 }),
             mk("VII7", 6, "A", { seventh: true, cost: 0.45, to: ["III"] }), mk("i7", 0, "A", { a3: 1, seventh: true, cost: 0.6, to: ["iv"] }));
      if (mode === "dorian") V.push(mk("IV", 3, "P", { cost: 0.4 }));
    }
    V.forEach(function (c) { c.q = qualityOf(mode, c); c.roman = c.name; });
    return V;
  }
  var GOSPEL_PAIR = {
    "V7>I": -0.2, "V7>i": -0.2, "V7>vi": 0.3, "V7>VI": 0.3, "V>V7": 0, "V7>V": 3, "I>I7": 0.1, "IV>iv": 0.15, "iv>I": 0, "iv>i": 0,
    "ii7>V7": -0.1, "ii>V7": 0, "IV>V7": 0.1, "vi>II7": 0.1, "I>VI7": 0.15, "iii>VI7": 0.1, "I>III7": 0.3, "IV>I": 0.25, "vi>ii7": 0.05,
    "I>IV": 0.1, "I>vi": 0.2, "ii>V": 0.1, "vi>IV": 0.15, "iv>V7": 0.3, "VII>III": 0.1, "VI>iv": 0.1, "i>VI": 0.2, "III>iv": 0.3,
  };
  function gospelTrans(a, b, strong) {
    if (a.to) {
      if (a.to.indexOf(b.name) < 0) return 8;
      // the chain: a seventh falling a fifth into another seventh
      return b.sev && cls(a.root - 4) === b.root ? -0.3 : 0;
    }
    if (a.name === b.name) return strong ? 0.5 : 0.1;
    var k = a.name + ">" + b.name;
    if (has(GOSPEL_PAIR, k)) return GOSPEL_PAIR[k];
    if (a.sev && a.fn === "D") return 4;                             // V7 goes home (or to vi)
    return (FN_COST[a.fn] || FN_COST.T)[b.fn];
  }
  function gospelStanding(ch, H) {
    var color = H.color != null ? H.color : 0.5, sev = H.sevenths != null ? H.sevenths : 0.5, c = ch.cost;
    if (ch.fn === "A") c *= 1.5 - color * 0.9 - sev * 0.4;
    else if (ch.sev) c *= 1.3 - sev * 0.8;
    return Math.max(0, c);
  }
  function gospelCadence(kind, mode, plan, vocab) {
    var minor = !!MINOR[mode], I = minor ? "i" : "I";
    var names = function (arr) { return arr.filter(function (n) { return vocab.some(function (c) { return c.name === n; }); }); };
    if (plan === "tonicize") return { fin: ["V"], pen: names(["II7"]), ante: null };
    switch (kind) {
      case "authentic": return { fin: [I], pen: names(["V7", "V"]), ante: null };
      case "half": return { fin: names(["V", "V7"]), pen: null, ante: null };
      case "imperfect": return { fin: [I], pen: null, ante: null };
      case "deceptive": return { fin: names(minor ? ["VI"] : ["vi"]), pen: names(["V7"]), ante: null };
      case "plagal": return { fin: [I], pen: names(minor ? ["iv"] : ["IV", "iv"]), ante: null };
    }
    return { fin: null, pen: null, ante: null };
  }
  // close-harmony voicings around the lead (vertical: S · lead · baritone · bass)
  function voicingsGospel(slot, ch, ctx) {
    var mode = ctx.mode, B = ctx.bounds, T = ctx.tess, out = [];
    var sd = slot.deg, sL = semi(mode, sd, 0), tL = toneOf(ch, cls(sd));
    var sMax = sL, sMin = sL; slot.notes.forEach(function (n) { var x = semi(mode, n.deg, 0); sMax = Math.max(sMax, x); sMin = Math.min(sMin, x); });
    var sOut = semi(mode, slot.notes[slot.notes.length - 1].deg, 0);
    function tess(p, s) { var lo = semi(mode, T[p][0], 0), hi = semi(mode, T[p][1], 0); return s < lo ? (lo - s) * 0.15 : s > hi ? (s - hi) * 0.15 : 0; }
    var bassPref = ch.dim7 ? null : ctx.rootOnly ? [[0, 0]] : [[0, 0], [2, 0.7], [1, ch.sev ? 2.5 : 1.6]];
    (bassPref || ch.tones.map(function (t, i) { return [i, 0.4]; })).forEach(function (bp) {
      var tb = ch.tones[bp[0]]; if (!tb) return;
      degsOfClass(tb.c, B.B).forEach(function (bd) {
        var sB = semi(mode, bd, tb.alt);
        ch.tones.forEach(function (tr) {                                  // the baritone: under the lead
          degsOfClass(tr.c, B.A).forEach(function (rd) {
            var sR = semi(mode, rd, tr.alt);
            if (sR >= sMin || sMin - sR > 10 || sR <= sB) return;
            ch.tones.forEach(function (ts) {                              // the tenor harmony: over it
              degsOfClass(ts.c, B.S).forEach(function (td) {
                var sS = semi(mode, td, ts.alt);
                if (sS <= sMax || sS - sL > 10) return;
                var cnt = {}, c = bp[1];
                [[tL ? tL.c : -1], [tr.c], [ts.c], [tb.c]].forEach(function (x) { if (x[0] >= 0) cnt[x[0]] = (cnt[x[0]] || 0) + 1; });
                var distinct = Object.keys(cnt).length;
                if (!cnt[ch.tones[0].c] && !ch.dim7) return;
                if (!cnt[ch.tones[1].c]) return;
                // a seventh chord rings only when it is complete: four notes, none doubled
                if (ch.sev) { if (!cnt[ch.tones[ch.tones.length - 1].c]) c += 16; c += (4 - distinct) * 2.2; }
                else if (!cnt[ch.tones[2].c]) c += 0.6;
                ch.tones.forEach(function (t, i) {
                  var k2 = cnt[t.c] || 0; if (k2 < 2) return;
                  if (t.alt !== 0 || (ch.fn === "D" && ((semi(mode, t.c, t.alt) % 12) + 12) % 12 === 11) || (ch.sev && i === ch.tones.length - 1)) c += 6;
                  else if (i !== 0) c += 0.8;
                });
                if (sB > sR - 3) c += 0.8;                                   // the bass a little apart from the baritone
                if (sR - sB > 14) c += (sR - sB - 14) * 0.2;
                c += (sS - sR > 12 ? (sS - sR - 12) * 0.5 : 0);                 // close: the three upper voices inside an octave
                c += tess("S", sS) + tess("A", sR) + tess("B", sB);
                out.push({ S: { d: td, a: ts.alt }, A: { d: sd, a: 0 }, T: { d: rd, a: tr.alt }, B: { d: bd, a: tb.alt },
                           sem: [sS, sL, sR, sB], semOut: [sS, sOut, sR, sB], cost: c, inv: bp[0], ch: ch });
              });
            });
          });
        });
      });
    });
    return out;
  }
  function fallbackGospel(slot, ch, ctx) {
    var mode = ctx.mode, B = ctx.bounds, sd = slot.deg;
    function near(c, b, test) { var o = degsOfClass(c, b).filter(test); return o.length ? o[Math.floor(o.length / 2)] : null; }
    var t0 = ch.tones[0], t1 = ch.tones[1], t2 = ch.tones[ch.tones.length > 2 ? 2 : 0];
    var td = near(t1.c, B.S, function (d) { return d > sd; }); if (td == null) td = sd + 2;
    var rd = near(t2.c, B.A, function (d) { return d < sd; }); if (rd == null) rd = sd - 2;
    var bd = near(t0.c, B.B, function (d) { return d < rd; }); if (bd == null) bd = rd - 4;
    return { S: { d: td, a: t1.alt }, A: { d: sd, a: 0 }, T: { d: rd, a: t2.alt }, B: { d: bd, a: t0.alt },
             sem: [semi(mode, td, t1.alt), semi(mode, sd, 0), semi(mode, rd, t2.alt), semi(mode, bd, t0.alt)], cost: 50, inv: 0, ch: ch };
  }
  // the tag's swipe chains: the lead holds home's note (do) as the POST while
  // the chords turn round it — every chord here keeps do
  var TAGS = [["I", "I7", "IV", "iv", "I"], ["IV", "iv", "I"], ["vi", "II7", "IV", "I"], ["I", "II7", "iv", "I"], ["I", "I7", "IV", "I"]];
  function harmonizeGospel(ctx) {
    var mode = ctx.mode, H = ctx.H || {}, R = ctx.R, vocab = gospelVocab(mode), out = [], prevCh = null, prevV = null;
    var bounds = ctx.bounds, sev = H.sevenths != null ? H.sevenths : 0.5, u = ctx.split;
    // (the voice search's own fields; each harmony part kept inside an octave and a fourth)
    var PW = partWindows({ mode: mode, bounds: bounds, tess: ctx.tess }, ["S", "A", "B"]);
    var VB = { S: PW.S, A: PW.A, B: PW.B };
    var swipes = 0, echoes = 0;
    ctx.lines.forEach(function (line, li) {
      var Rl = R.fork("line:" + li), base = slotsOf(line), slots = [];
      // SWIPES: a held note (two beats or more) may carry two chords, the lead holding
      // (one to a line, two in a long one: a swipe is an event, not a habit)
      var cap = base.length > 10 ? 2 : 1, made = 0;
      base.forEach(function (s, k) {
        var long = s.beats >= (u === 1 ? 3 : 2) - EPS && s.notes.length === 1 && !s.trail;
        var inner = k < base.fin || (k === base.fin && line.cadence === "half");
        var die = u01(Rl.fork("swipe:" + k));
        if (long && inner && made < cap && die < (ctx.swipeRate != null ? ctx.swipeRate : 0.4) * (0.6 + 0.8 * sev)) {
          made++;
          var h = Math.round(s.beats / 2 / u) * u;
          slots.push({ beat: s.beat, beats: h, deg: s.deg, stress: s.stress, notes: s.notes, idx: s.idx });
          slots.push({ beat: s.beat + h, beats: s.beats - h, deg: s.deg, stress: 0, notes: s.notes, idx: s.idx, swipe: true });
        } else slots.push(s);
      });
      // the cadence: the slot of the line's long note (a swiped long note's
      // second half — its first half is the approach); the syllables after it trail
      var finIdx = base[base.fin].idx, fin = -1;
      slots.forEach(function (s, k) { if (s.idx === finIdx) fin = k; });
      slots.forEach(function (s, k) { s.final = k === fin; s.trail = s.idx > finIdx; });
      slots.fin = fin;
      var gctx = { mode: mode, H: H, first: li === 0, approach: [], shortBeat: ctx.shortBeat, trans: gospelTrans, cadenceChords: gospelCadence, standing: gospelStanding,
                   forcedAt: ctx.forced ? function (k) { return ctx.forced(li, slots[k].beat); } : null };
      var pc = planChords(line, slots, vocab, prevCh, gctx, Rl.fork("chords"));
      var relaxed = false;
      if (!pc && slots.length !== base.length) {                        // (no chords will turn under those held words: sing them plain)
        slots = base; slots.fin = base.fin; fin = base.fin;
        base.forEach(function (s, k) { s.final = k === fin; s.trail = k > fin; });
        pc = planChords(line, slots, vocab, prevCh, gctx, Rl.fork("chords"));
      }
      if (!pc) {
        relaxed = true;
        slots = base; slots.fin = base.fin; fin = base.fin;
        pc = planChords({ cadence: "none", plan: null, role: line.role === "home" ? "home" : "open", notes: line.notes }, slots, vocab, prevCh,
                        { mode: mode, H: H, first: li === 0, approach: [], shortBeat: 9, loose: true, trans: gospelTrans, cadenceChords: gospelCadence, standing: gospelStanding }, Rl.fork("chords:relaxed"));
      }
      var chords = pc.chords;
      var full = line.role === "home" || line.cadence === "authentic";
      var rootAt = slots.map(function (s) { return full && (s.final || s.trail); });
      var vl = voiceLine(slots, chords, prevV, { mode: mode, bounds: VB, tess: { S: ctx.tess.S, A: ctx.tess.A, B: ctx.tess.B }, H: H, parW: 30, rootAt: rootAt,
                                                 voicer: voicingsGospel, fallback: fallbackGospel });
      // (a seventh chord the voices could not sing complete is sung — and so
      // named — as its triad: a chord is only called ringing when it rings)
      chords = chords.map(function (ch, k) {
        if (!ch.sev) return ch;
        var v = vl.voicings[k], sc = ch.tones[ch.tones.length - 1];
        var has7 = [v.S, v.A, v.T, v.B].some(function (x) { return cls(x.d) === sc.c && x.a === sc.alt; });
        if (has7) return ch;
        var tri = { name: ch.name.replace("7", ""), root: ch.root, tones: ch.tones.slice(0, 3), fn: ch.fn, sev: false, cost: ch.cost, to: null, dim7: false };
        tri.q = qualityOf(mode, tri); tri.roman = tri.name;
        return tri;
      });
      // the Score's parts: the lead is the tune itself; the others one note a slot
      var parts = { T: line.notes.map(function (n) { return { beat: n.beat, beats: n.beats, deg: n.deg, alt: 0, nct: null, syl: n.syl, stress: n.stress, tie: false, cont: n.cont }; }), S: [], A: [], B: [] };
      slots.forEach(function (s, k) {
        var v = vl.voicings[k];
        parts.S.push({ beat: s.beat, beats: s.beats, deg: v.S.d, alt: v.S.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
        parts.A.push({ beat: s.beat, beats: s.beats, deg: v.T.d, alt: v.T.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
        parts.B.push({ beat: s.beat, beats: s.beats, deg: v.B.d, alt: v.B.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
        if (s.swipe) swipes++;
        if (!s.swipe) s.notes.forEach(function (n, j) {
          var sn = parts.T[s.idx + j];
          if (!toneOf(chords[k], cls(n.deg))) sn.nct = j > 0 || (k > 0 && k + 1 < slots.length && Math.sign(slots[k + 1].deg - n.deg) === Math.sign(n.deg - slots[k - 1].deg)) ? "pass" : "nbr";
        });
      });
      // ECHOES: at a held line end the women (the tenor harmony and the lead)
      // hold, and the men (the baritone and the bass) sing the last words
      // back to them on home's chord — the tune an octave down, the bass on
      // the chord's root
      var echo = null, ed = u01(Rl.fork("echo")), fs = slots[fin];
      var trailing = slots.some(function (s) { return s.trail; });
      var echoP = (line.refrain ? 0.75 : 0.3) * (ctx.echoRate != null ? ctx.echoRate : 1);
      if (ed < echoP && fs && fin === slots.length - 1 && !trailing && !relaxed && fs.beats >= (u === 1 ? 3 : 2) - EPS && !fs.swipe) {
        var k3 = fs.beats >= (u === 1 ? 5 : 3) - EPS ? 3 : 2, mel = [];
        for (var q = base.fin; q >= 0 && mel.length < k3; q--) mel.unshift(base[q]);
        var finCh = chords[fin], gap = u, room = fs.beats - gap, each = Math.max(u, Math.floor(room / mel.length / u) * u);
        var okE = mel.length === k3 && each * mel.length <= room + EPS;
        // the echo's strong notes are chord tones of the held chord; the others step
        mel.forEach(function (s, j) { var inCh = toneOf(finCh, cls(s.deg)); if (!inCh && (j === 0 || j === mel.length - 1)) okE = false; if (inCh && inCh.alt) okE = false; });
        if (okE) {
          var aBase = parts.A.pop(), bBase = parts.B.pop(), t0 = fs.beat;
          var aRoot = degsOfClass(finCh.tones[0].c, VB.B).filter(function (d) { return d <= bBase.deg + 4 && d >= bBase.deg - 4; });
          var bd = aRoot.length ? aRoot[0] : bBase.deg;
          parts.A.push({ beat: t0, beats: gap, deg: aBase.deg, alt: aBase.alt, nct: null, syl: aBase.syl, stress: 1, tie: false });
          parts.B.push({ beat: t0, beats: gap, deg: bBase.deg, alt: bBase.alt, nct: null, syl: bBase.syl, stress: 1, tie: false });
          // (the echo an octave down — or two — whichever sits under the held note, within an octave of it)
          var sHeld = semi(mode, fs.deg, 0), shiftE = -7;
          if (mel.some(function (s) { return sHeld - semi(mode, s.deg - 7, 0) > 12; })) shiftE = mel.every(function (s) { return semi(mode, s.deg, 0) < sHeld; }) ? 0 : -7;
          var okR = true, en = [];
          mel.forEach(function (s, j) {
            var d = s.deg + shiftE; if (d < VB.A[0] || d > VB.A[1] || sHeld - semi(mode, d, 0) > 12) okR = false;
            var last = j === mel.length - 1, bt = t0 + gap + j * each, bl = last ? fs.beat + fs.beats - bt : each;
            en.push([{ beat: bt, beats: bl, deg: d, alt: 0, nct: toneOf(finCh, cls(s.deg)) ? null : "pass", syl: null, ownSyl: s.notes[0].syl, stress: j === 0 || last ? 1 : 0, tie: false },
                     { beat: bt, beats: bl, deg: bd, alt: 0, nct: null, syl: null, ownSyl: s.notes[0].syl, stress: j === 0 || last ? 1 : 0, tie: false }]);
          });
          // (the baritone's echo must stay under the lead's held note)
          if (okR && en.every(function (x) { return semi(mode, x[0].deg, 0) < semi(mode, fs.deg, 0) && x[0].deg > bd; })) {
            en.forEach(function (x) { parts.A.push(x[0]); parts.B.push(x[1]); });
            echo = { syllables: mel.length, at: t0 + gap }; echoes++;
          } else { parts.A.pop(); parts.B.pop(); parts.A.push(aBase); parts.B.push(bBase); }
        }
      }
      // the chord list: every chord a slot, a swipe marked; every dominant seventh RINGS (4:5:6:7)
      var list = [];
      slots.forEach(function (s, k) {
        var ch = chords[k], inv = vl.voicings[k].inv, last = list[list.length - 1];
        if (last && last.name === ch.name && last.inv === inv && !s.swipe) { last.len = s.beat + s.beats - last.beat; return; }
        var c = { beat: s.beat, len: s.beats, roman: figured(ch, inv), rootDeg: ch.tones[0].c, rootAlt: ch.tones[0].alt || 0, quality: ch.dim7 ? "dim" : ch.q, name: ch.name,
                  inv: inv, fn: ch.fn, dim7: !!ch.dim7, tones: ch.tones.map(function (t) { return [t.c, t.alt]; }) };
        if (ch.q === "dom7") c.ring = true;
        if (s.swipe) c.swipe = true;
        list.push(c);
      });
      var kind = relaxed ? realizedKind(chords, slots, mode) : (line.plan === "tonicize" ? "authentic" : line.cadence);
      out.push({ parts: parts, chords: list, cadenceKind: kind, cadBeat: base[base.fin].beat, relaxed: relaxed,
                 nct: { swipes: slots.filter(function (s) { return s.swipe; }).length }, echo: echo, chordCost: Math.round(pc.cost * 100) / 100, voiceCost: Math.round(vl.cost * 100) / 100 });
      prevCh = chords[chords.length - 1]; prevV = vl.voicings[vl.voicings.length - 1];
    });
    // THE TAG — after the last refrain: the last words again, the lead
    // holding home's note as the post while the others swipe round it, and a
    // last chord that rings
    if (ctx.tag && prevV) {
      var lastLine = ctx.lines[ctx.lines.length - 1], ls = slotsOf(lastLine), fd = ls[ls.fin].deg;
      var chain = TAGS[Math.floor(u01(R.fork("tag")) * TAGS.length)].filter(function (nm) { return vocab.some(function (c) { return c.name === nm && toneOf(c, cls(fd)) && !toneOf(c, cls(fd)).alt; }); });
      if (chain.length >= 3 && cls(fd) === 0) {
        var beat = ctx.bar >= 4 ? ctx.bar / 2 : ctx.bar, pre = ls.slice(Math.max(0, ls.fin - 2), ls.fin), tn = [], t = 0;
        pre.forEach(function (s, j) { tn.push({ beat: t, beats: s.beats, deg: s.deg, stress: s.stress, syl: j, cont: false }); t += s.beats; });
        var postAt = t, postLen = beat * (chain.length - 1) + 2 * beat;
        tn.push({ beat: t, beats: postLen, deg: fd, stress: 1, syl: pre.length, cont: false });
        var tslots = slotsOf({ notes: tn }), sl2 = [];
        tslots.forEach(function (s, k) {
          if (k < tslots.length - 1) { sl2.push(s); return; }
          chain.forEach(function (nm, j) { sl2.push({ beat: postAt + j * beat, beats: j === chain.length - 1 ? postLen - j * beat : beat, deg: fd, stress: j === 0 ? 1 : 0, notes: s.notes, idx: s.idx, swipe: j > 0 }); });
        });
        sl2.forEach(function (s, k) { s.final = k === sl2.length - 1; s.trail = false; });
        sl2.fin = sl2.length - 1;
        var byName = function (nm) { return vocab.filter(function (c) { return c.name === nm; })[0]; };
        var preCh = planChords({ cadence: "none", plan: null, role: "open", notes: tn }, sl2.slice(0, pre.length).concat([]), vocab, prevCh,
                               { mode: mode, H: H, first: false, approach: [], shortBeat: 9, loose: true, trans: gospelTrans, cadenceChords: gospelCadence, standing: gospelStanding }, R.fork("tag:pre"));
        var tch = (preCh ? preCh.chords : pre.map(function () { return byName(chain[0]); })).concat(chain.map(byName));
        var tv = voiceLine(sl2, tch, prevV, { mode: mode, bounds: VB, tess: { S: ctx.tess.S, A: ctx.tess.A, B: ctx.tess.B }, H: H, parW: 30, rootAt: sl2.map(function (s) { return s.final; }),
                                              voicer: voicingsGospel, fallback: fallbackGospel });
        var tp = { T: tn.map(function (n) { return { beat: n.beat, beats: n.beats, deg: n.deg, alt: 0, nct: null, syl: n.syl, stress: n.stress, tie: false }; }), S: [], A: [], B: [] };
        sl2.forEach(function (s, k) {
          var v = tv.voicings[k];
          tp.S.push({ beat: s.beat, beats: s.beats, deg: v.S.d, alt: v.S.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
          tp.A.push({ beat: s.beat, beats: s.beats, deg: v.T.d, alt: v.T.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
          tp.B.push({ beat: s.beat, beats: s.beats, deg: v.B.d, alt: v.B.a, nct: null, syl: s.swipe ? null : s.notes[0].syl, stress: s.stress, tie: false });
        });
        out.tag = { parts: tp, cadenceKind: tch[tch.length - 2] && (tch[tch.length - 2].name === "iv" || tch[tch.length - 2].name === "IV") ? "plagal" : "authentic", cadBeat: sl2[sl2.length - 1].beat,
                    chords: sl2.map(function (s, k) { var ch = tch[k], c = { beat: s.beat, len: s.beats, roman: figured(ch, tv.voicings[k].inv), rootDeg: ch.tones[0].c, rootAlt: ch.tones[0].alt || 0, quality: ch.q, name: ch.name, inv: tv.voicings[k].inv, fn: ch.fn, dim7: false, tones: ch.tones.map(function (x) { return [x.c, x.alt]; }) }; if (ch.q === "dom7") c.ring = true; if (s.swipe) c.swipe = true; return c; }),
                    chain: chain };
      }
    }
    out.swipes = swipes; out.echoes = echoes;
    return out;
  }

  // ==========================================================================
  // E. SHAKER AND PRIMARY — the unison song
  // ==========================================================================
  // One melody, sung by everyone together, bright and plain: the Shakers'
  // dancing songs (1830s–: SIMPLE GIFTS is one), some "received" in vision
  // and sung on wordless syllables — the gift songs; and the children's songs
  // of the Primary (1878–), a short verse and its chorus. No harmony is
  // written. Sometimes a DRONE: a few voices humming home's note (and its
  // fifth) under the tune, the way a dancing meeting's elders held the
  // floor. The children's heterophony — thirty small voices never quite on
  // one another — is the performer's.
  function harmonizeShaker(ctx) {
    var out = [];
    ctx.lines.forEach(function (line) {
      var slots = slotsOf(line);
      var S = line.notes.map(function (x) { return { beat: x.beat, beats: x.beats, deg: x.deg, alt: 0, nct: null, syl: x.syl, stress: x.stress, tie: false, cont: x.cont, ornament: null }; });
      out.push({ parts: { S: S }, chords: [], cadenceKind: "none", cadBeat: slots[slots.fin].beat, nct: {} });
    });
    var dd = u01(ctx.R.fork("drone")), df = u01(ctx.R.fork("drone:fifth"));
    var rate = ctx.droneRate != null ? ctx.droneRate : 0.35;
    out.drone = dd < rate ? { degs: df < 0.6 ? [-7, -3] : [-7] } : null;   // home's note an octave down, and its fifth
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
    // the last line's ending leans to the leading tone more than an inner
    // line's: the Psalmody's tunes come home ti–do as often as re–do. (Not in
    // minor: a tune there rises on the unraised subtonic, which only VII can
    // carry — a modal close; the Victorian minor hymn comes home re–do over
    // V with the leading tone raised in an inner voice.)
    homeFigures: { major: { rise: 1.7, turn: 1.3, climb: 1.4, fifth: 1.2, three: 0.75, fall: 0.9, sigh: 0.6 },
                   minor: { rise: 0.6, turn: 0.7, climb: 0.6, fall: 1.1 } },
    tempo: 1.0, fermata: 0.35, amen: true, refrains: 0.6, search: 140, organ: true,
    // (round 3, the critic's idiom notes: an inner line that would have closed
    // on V — or now and then on I — rests instead on IV, vi or the mediant;
    // and a leapt third from a note long enough to share is walked, slurred)
    restClose: { half: 0.42, imperfect: 0.05 }, melismaAdd: 0.62,
    // (a rest close only where one of the rest chords has the tune's note)
    restFits: function (mode, t) {
      var pool = MINOR[mode] ? [[3, 5, 0], [5, 0, 2], [2, 4, 6]] : mode === "mixolydian" ? [[3, 5, 0], [5, 0, 2], [1, 3, 5]] : [[3, 5, 0], [5, 0, 2], [2, 4, 6], [1, 3, 5]];
      return pool.some(function (c) { return c.indexOf(cls(t)) >= 0; });
    },
    weights: w({}),
    rules: { parallels: false, crossing: false, spacing: true },
    refs: ["earth:all-is-well", "earth:assembly", "earth:deseret", "earth:new-salem", "earth:martyr", "earth:fowler", "earth:bethany"],
    tolerance: { par5: [0, 0.02], thirdless: [0, 0.15], crossing: [0, 0], chromatic: [0, 0.07], sevenths: [0.03, 0.4], leap: [0.08, 0.45], melisma: [0, 0.25], melodyRange: [5, 10],
                 // the cadence mix, read from the notes (Earth: 98 % of closes keep their third, 53 % home, 29 % dominant)
                 closeThird: [0.75, 1], closeHome: [0.25, 0.8], closeDom: [0, 0.67],
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
    // (round 3, the critic's idiom note: a line closing on its root or its
    // fifth may close BARE — every part on that one note, in octaves and
    // unisons — as one close in seven does in the 1844 book)
    bareClose: { inner: 0.34, home: 0.16 },
    // an inner line that closes FULL, its third kept (the 1844 tunes: about
    // a quarter of the inner closes in the major modes, one in eight in minor)
    fullClose: { major: 0.3, minor: 0.04 },
    weights: w({ leapAppetite: 1.3, repeat: 0.18, stressTense: 0.1, leadingTone: 0.4, octave: 1.2, sixth: 0.8, fifth: 0.1, contour: 0.28 }),
    rules: { parallels: true, crossing: true, spacing: false },
    refs: ["earth:new-britain", "earth:kedron", "earth:idumea", "earth:pisgah", "earth:holy-manna", "earth:coronation", "earth:wondrous-love", "earth:beach-spring", "earth:promised-land", "earth:foundation"],
    tolerance: { par5: [0.03, 0.45], thirdless: [0.25, 0.8], crossing: [0, 0.2], chromatic: [0, 0.01], sevenths: [0, 0.1], leap: [0.12, 0.62], melisma: [0.02, 0.35], melodyRange: [5, 10],
                 // (Earth: a quarter of the closes keep their third, 56 % home, 28 % dominant)
                 closeThird: [0, 0.5], closeHome: [0.25, 0.85], closeDom: [0, 0.6] },
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
    tolerance: { leap: [0.05, 0.42], melisma: [0.05, 0.5], melodyRange: [4, 9], par5: [0, 0], thirdless: [0, 1], crossing: [0, 0], chromatic: [0, 0], sevenths: [0, 0], closeThird: [0, 0], closeHome: [0, 0], closeDom: [0, 0] },
    harmonize: harmonizeOldWay,
  };
  // a gospel authentic close needs its next-to-last note in V7 (re, ti, sol,
  // or fa, the seventh itself); a turn to the dominant, in II7 (re, la, do)
  function gospelFits(kind, t, steps, mode, plan) {
    if (steps.length < 2) return true;
    var pen = cls(t + steps[steps.length - 2]);
    // (never the seventh itself: a tune on the seventh must fall, and these rise or leap)
    if (plan === "tonicize") return pen === 1 || pen === 5;
    if (kind === "authentic") return pen === 1 || pen === 4 || pen === 6;
    if (kind === "deceptive") return pen === 1 || pen === 4 || pen === 3 || (pen === 6 && !MINOR[mode]);
    return true;
  }
  var PSALMODY = {
    figureRepair: true,
    id: "psalmody", letter: "B", melodyPart: "T", parts: ["S", "A", "T", "B"],
    about: "the tune in the tenor; rugged four-part homophony that breaks into a fuge — the bass leads off with the line's head and its words, then the tenor, the counter and the treble, a half-bar or a bar apart, until all four meet on a written cadence; open fifths, parallels and passing clashes let stand; no organ, no amen",
    meters: { CM: 3, LM: 2, SM: 1.6, "87.87": 0.7, CMD: 0.6, "11s": 0.4, "66.66": 0.3 },
    times: { "4/4": 2, "2/2": 2, "3/2": 0.9, "3/4": 1.2, "6/8": 0.3 },
    modes: { ionian: 2.5, aeolian: 2, dorian: 0.6, mixolydian: 0.5, penta: 0.4, hexa: 0.8 },
    forms: { ABCD: 3, ABAC: 1, "ABA'C": 0.8, AABA: 0.3 },
    contours: { arch: 1.5, climb: 1.2, descent: 1.2, wave: 1 },
    cells: { dotted: 1.8, even: 1.4, long: 1, slurS: 1.8, slurU: 1.5, dotS: 1 }, cellRate: 0.55, baseCell: "even",
    leap: 0.32, leapScale: 1, peakTo: { 7: 2, 8: 1.2, 5: 1, 9: 0.5, 4: 0.4 }, range: [7, 9], maxSpan: 10, floorMin: -5,
    figures: { fall: 2, fifth: 2, three: 1.5, rise: 1, triad: 1, third: 0.8, turn: 0.6, again: 0.4, climb: 0.4 },
    figureFits: null,
    cadences: {
      open: [["half", 4, 1.6, ALL], ["half", 1, 1, ALL], ["openfifth", 0, 1.2, ALL], ["imperfect", 2, 1, ALL], ["openfifth", 4, 0.6, ALL]],
      arrive: [["openfifth", 0, 1.4, ALL], ["half", 4, 1.5, ALL], ["half", 1, 0.8, ALL], ["imperfect", 2, 0.8, ALL]],
      depart: [["half", 4, 1.4, ALL], ["half", 1, 1, ALL], ["openfifth", 4, 0.7, ALL], ["imperfect", 2, 0.8, ALL]],
      home: [["openfifth", 0, 1, ALL]],
    },
    ranges: { S: [-1, 19], A: [-5, 12], T: [-12, 9], B: [-20, 2] }, tess: { S: [4, 15], A: [-2, 9], T: [-9, 5], B: [-17, -3] },
    tempo: 0.95, fermata: 0.25, amen: false, refrains: 0.15, search: 140, organ: false, altoRate: 1,
    fullClose: { major: 0.45, minor: 0.12 }, fugeRate: 1, bareClose: { inner: 0.12, home: 0.08 },
    weights: w({ leapAppetite: 1.2, repeat: 0.15, stressTense: 0.12, leadingTone: 0.5, octave: 1.4, sixth: 0.9, fifth: 0.15, contour: 0.3 }),
    rules: { parallels: true, crossing: true, spacing: false },
    // (Kolob's tune book holds no Yankee fuging tune; CORONATION — Oliver
    // Holden, Charlestown 1793, in the 1844 book — is the New England
    // psalmody it has. The fuge is measured against its own rules.)
    refs: ["earth:coronation"],
    tolerance: { par5: [0.02, 0.4], thirdless: [0.12, 0.6], crossing: [0, 0.25], chromatic: [0, 0.01], sevenths: [0, 0.1], leap: [0.12, 0.55], melisma: [0.02, 0.3], melodyRange: [5, 10],
                 closeThird: [0, 0.8], closeHome: [0.25, 0.85], closeDom: [0, 0.6], stagger: [0.03, 0.5] },
    harmonize: harmonizePsalmody,
  };
  var GOSPEL = {
    figureRepair: true,
    id: "gospel", letter: "D", melodyPart: "T", parts: ["S", "A", "T", "B"], voiceOrder: ["S", "T", "A", "B"],
    about: "close harmony with the tune in the second voice (the lead), a tenor harmony above it, the baritone and the bass below; dominant sevenths everywhere, falling round the circle of fifths, sung justly 4:5:6:7 so they ring; swipes under a held word; the men echo the women's line ends; a refrain after every verse and a tag at the end",
    meters: { "87.87": 2.5, CM: 1.5, "11s": 1.5, "10.10R": 1.2, "76.76D": 1, LM: 0.8, SM: 0.5, "77.77": 0.8 },
    times: { "4/4": 2.5, "6/8": 2, "3/4": 1.4, "2/4": 0.4 },
    modes: { ionian: 6, mixolydian: 0.5, hexa: 0.5, penta: 0.4, aeolian: 0.25, dorian: 0.1 },
    forms: { ABAC: 2, AABA: 1.2, ABCD: 1, "ABA'C": 1, "AA'BA": 0.6 },
    contours: { arch: 1.6, wave: 1.2, climb: 1.2, descent: 1 },
    cells: { dotted: 2.6, dotS: 1.6, even: 1.2, long: 0.8, slurU: 0.6, slurS: 0.5 }, cellRate: 0.6, baseCell: "even",
    leap: 0.24, leapScale: 1, peakTo: { 7: 2, 8: 1.5, 5: 1, 9: 0.8 }, range: [7, 9], maxSpan: 10, floorMin: -4,
    figures: { fall: 2.5, three: 2.5, rise: 1.2, turn: 1, again: 0.8, triad: 0.8, four: 0.6, climb: 0.4 },
    figureFits: gospelFits,
    cadences: {
      open: [["half", 1, 1.6, ALL], ["half", 4, 1.2, ALL], ["half", 6, 0.5, ALL], ["imperfect", 2, 1.2, ALL], ["imperfect", 4, 0.6, ALL]],
      arrive: [["half:tonicize", 4, 1.4, MAJOR.concat(MIXO)], ["half:tonicize", 1, 0.8, MAJOR.concat(MIXO)], ["half", 4, 1.2, MINORS], ["authentic", 0, 1, ALL], ["imperfect", 2, 0.8, ALL], ["half", 1, 0.6, ALL]],
      depart: [["deceptive", 0, 0.9, ALL], ["half", 1, 1.2, ALL], ["half", 4, 1, ALL], ["imperfect", 2, 0.8, ALL]],
      home: [["authentic", 0, 1, ALL]],
    },
    // S the tenor harmony (over the lead), T the lead (the tune), A the baritone (under it), B the bass
    ranges: { S: [-2, 17], T: [-8, 12], A: [-12, 5], B: [-20, -1] }, tess: { S: [3, 14], T: [-3, 8], A: [-8, 2], B: [-17, -5] },
    tempo: 0.95, fermata: 0.3, amen: false, refrains: 1, alwaysRefrain: true, search: 140, organ: false,
    swipeRate: 0.42, echoRate: 1, tag: true, ring: true,
    weights: w({ leapAppetite: 0.9, repeat: 0.08, threeSame: 1.2, stressTense: 0.15, sameAsOther: 1.1 }),
    rules: { parallels: false, crossing: false, spacing: true },
    // (GOD BE WITH YOU — Tomer and Sankey, 1880s, with its echoing refrain —
    // is the gospel hymn Kolob's tune book holds; no barbershop is written
    // down in it, so the ringing sevenths are measured against their own rules)
    refs: ["earth:god-be-with-you"],
    tolerance: { par5: [0, 0.03], thirdless: [0, 0.15], crossing: [0, 0], chromatic: [0.01, 0.2], sevenths: [0.25, 0.8], leap: [0.08, 0.45], melisma: [0, 0.2], melodyRange: [5, 10],
                 closeThird: [0.6, 1], closeHome: [0.2, 0.8], closeDom: [0, 0.6], septimal: [0.03, 0.4], stagger: [0, 0.4] },
    harmonize: harmonizeGospel,
  };
  var SHAKER = {
    figureRepair: true,
    id: "shaker", letter: "E", melodyPart: "S", parts: ["S"],
    about: "one melody sung in unison, bright and plain, in dance time; sometimes over a hummed drone; a gift song on wordless syllables in two strains, each sung twice; or a Primary song, short, with its chorus",
    kinds: { shaker: 1.2, gift: 1, primary: 1.2 },
    meters: { "88.88": 1.6, "77.77": 1.4, "66.66": 1.4, "65.65": 1, CM: 1.2, SM: 0.8, "87.87": 1, LM: 0.6 },
    kindMeters: { shaker: { CM: 2, LM: 1, "87.87": 1.2, "88.88": 1.4, SM: 0.6, "77.77": 0.6 }, gift: { "88.88": 2, "77.77": 1.5, "66.66": 0.8 }, primary: { "66.66": 2, "65.65": 1.5, "77.77": 1.2, SM: 0.8, CM: 0.6 } },
    times: { "2/4": 2, "6/8": 2, "3/4": 1, "4/4": 1 },
    modes: { ionian: 3, penta: 2, hexa: 1.5, mixolydian: 1, dorian: 0.8, aeolian: 0.5 },
    forms: { AABA: 1.5, ABAC: 1.5, "AA'BA": 1, ABCD: 0.6 }, extraForms: { 4: { "AA'BB'": 2 } },
    kindForms: { gift: { "AA'BB'": 6 }, primary: { ABAC: 2, AABA: 1.5 }, shaker: {} },
    contours: { arch: 1.6, wave: 1.4, climb: 1, descent: 1 },
    cells: { even: 1.6, dotted: 1.8, dotS: 1.2, long: 0.6, slurS: 0.1, slurU: 0.1 }, cellRate: 0.55, baseCell: "even",
    leap: 0.2, leapScale: 1, peakTo: { 7: 2, 5: 1.5, 4: 0.8, 8: 0.8 }, range: [6, 8], maxSpan: 9, floorMin: -3,
    figures: { fall: 2, three: 2, triad: 1.5, fifth: 1.2, again: 1, turn: 0.8, rise: 1, third: 0.8 },
    figureFits: null,
    cadences: {
      open: [["none", 4, 1.5, ALL], ["none", 1, 1, ALL], ["none", 2, 1.2, ALL]],
      arrive: [["none", 0, 1.4, ALL], ["none", 4, 1.2, ALL], ["none", 2, 0.8, ALL]],
      depart: [["none", 4, 1.2, ALL], ["none", 1, 1, ALL], ["none", 2, 1, ALL]],
      home: [["none", 0, 1, ALL]],
    },
    ranges: { S: [-1, 16] }, tess: { S: [2, 12] },
    tempo: 0.92, fermata: 0.05, amen: false, refrains: 0.2, search: 130, organ: false,
    droneRate: { shaker: 0.45, gift: 0.55, primary: 0.1 },
    weights: w({ leapAppetite: 1.0, repeat: 0.06, threeSame: 1.4, contour: 0.3, memory: 0.5 }),
    rules: { parallels: true, crossing: true, spacing: false },
    refs: ["earth:simple-gifts"],
    tolerance: { leap: [0.08, 0.45], melisma: [0, 0.15], melodyRange: [4, 9], par5: [0, 0], thirdless: [0, 1], crossing: [0, 0], chromatic: [0, 0], sevenths: [0, 0], closeThird: [0, 0], closeHome: [0, 0], closeDom: [0, 0] },
    harmonize: harmonizeShaker,
  };
  // the cadence entries' "kind:plan" → kind and plan
  [TABERNACLE, SACREDHARP, OLDWAY, PSALMODY, GOSPEL, SHAKER].forEach(function (D) {
    for (var role in D.cadences) D.cadences[role] = D.cadences[role].map(function (c) {
      var kp = c[0].split(":"), kind = kp[1] === "tonicize" || kp[1] === "relative" ? "authentic" : kp[0];
      return [kind, c[1], c[2], c[3], kp[1] || null];
    });
  });
  var BY = { tabernacle: TABERNACLE, sacredharp: SACREDHARP, oldway: OLDWAY, psalmody: PSALMODY, gospel: GOSPEL, shaker: SHAKER,
             C: TABERNACLE, A: SACREDHARP, F: OLDWAY, B: PSALMODY, D: GOSPEL, E: SHAKER };

  return {
    get: function (name) { return BY[name] || null; },
    // (the first three, as round 1 listed them — compose()'s own draw keeps to
    // these; `all` is the six, in the plan's letter order)
    names: ["tabernacle", "sacredharp", "oldway"],
    all: ["sacredharp", "psalmody", "tabernacle", "gospel", "shaker", "oldway"],
    tabernacle: TABERNACLE, sacredharp: SACREDHARP, oldway: OLDWAY, psalmody: PSALMODY, gospel: GOSPEL, shaker: SHAKER,
    chordAt: chordAt, slotsOf: slotsOf, tabernacleVocab: tabernacleVocab, gospelVocab: gospelVocab, qualityOf: qualityOf, planChords: planChords, readChords: readChords,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-dialects.js"] = true;   // the load guard's roll call
