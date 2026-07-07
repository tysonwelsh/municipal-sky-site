// ============================================================================
// Prospero's Jukebox v2 — pj2-pitch.js
// PJ2.Pitch: the pitch field. Phase 0, module 2 of 4.
//
// v1 hard-codes its music as Hz tables — LIB_SCALE_4, SYC_GHOST_SCALE,
// ARIEL_F_LYDIAN_HZ (prosperos-jukebox-audio.js:16-235) — one array per
// octave per layer, rounded to whole Hz, frozen in C / Eb / F forever. That
// is why v1 can never modulate: the key is baked into forty integers.
//
// v2 replaces the tables with a PitchField: tonic Hz + mode (interval
// structure) + tuning system. Every layer asks the field for frequencies at
// (degree, octave) coordinates, so transposing the whole piece is one
// modulate() call and the tables of v1 become *queries*.
//
// The field is MUTABLE only through explicit modulate(), and modulation is
// atomic — validate everything, then swap. Crucially, we never retune
// sounding notes: a caller that already asked for 392 Hz keeps its 392 Hz.
// That is kolob's straddle lesson (kolob-audio.js:1037) — a note scheduled
// before a harmonic shift belongs to the OLD world, and letting it ring
// across the boundary is what makes modulation sound like music instead of
// a pitch-bend accident.
//
// This module is PURE and DETERMINISTIC: no audio nodes, no RNG, no DOM,
// no clocks. It depends on nothing.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Pitch = (function () {
  "use strict";

  // ==========================================================================
  // MODES — interval structures in semitones from the tonic.
  //
  // The first three are v1's sound-worlds, derived from its Hz tables:
  //
  // dorian — v1 Library (prosperos-jukebox-audio.js:16):
  //   LIB_SCALE_4 = [262, 294, 311, 349, 392, 440, 466]  (C4–Bb4)
  //   C D Eb F G A Bb → [0,2,3,5,7,9,10]. Plain C Dorian.
  //
  // lydian — v1 Ariel (prosperos-jukebox-audio.js:159, :219):
  //   ARIEL_F_LYDIAN_HZ starts 87.31, 98, 110, 123.47, 130.81, 146.83, 164.81
  //   F G A B C D E → [0,2,4,6,7,9,11]. F Lydian, the raised 4th (B natural)
  //   being the "fairytale" interval the breeze drones lean on.
  //
  // sycorax — v1's "chromatic-locrian" ghost set (prosperos-jukebox-audio.js:108):
  //   SYC_GHOST_SCALE = [311, 330, 370, 392, 415, 466, 494]  (Eb4 root)
  //   Derivation, cents above 311 Hz (cents = 1200·log2(f/311)):
  //     311 →    0.0 c → 0 semitones  (Eb)
  //     330 →  102.7 c → 1            (E   — E4 is 329.63, table is +1.9 c sharp)
  //     370 →  300.7 c → 3            (F#  — F#4 is 369.99)
  //     392 →  400.7 c → 4            (G   — G4 is 392.00)
  //     415 →  499.4 c → 5            (Ab  — Ab4 is 415.30)
  //     466 →  700.1 c → 7            (Bb  — Bb4 is 466.16, a perfect FIFTH)
  //     494 →  801.2 c → 8            (B   — B4  is 493.88)
  //   ⇒ steps = [0,1,3,4,5,7,8]. Note this corrects the [0,1,3,4,5,8,9]
  //   guess floated in the spec: 466/311 = 1.4984 ≈ 2^(7/12), not 2^(8/12) —
  //   the top two tones are Bb and B, not B and C. So the set is Eb E F# G
  //   Ab Bb B: half-step pairs at Eb–E, G–Ab and Bb–B (the "chromatic"),
  //   plus the E–Bb tritone (degrees 1↔5, semitones 1→7) for the locrian
  //   b5 color. Every rounded table value sits within 2 cents of ET, so ET
  //   [0,1,3,4,5,7,8] reproduces v1's ghosts to well under audibility.
  //
  // The rest are stock structures for future phases.
  // ==========================================================================
  var MODES = {
    dorian:      { name: "dorian",      steps: [0, 2, 3, 5, 7, 9, 10] },
    sycorax:     { name: "sycorax",     steps: [0, 1, 3, 4, 5, 7, 8]  },
    lydian:      { name: "lydian",      steps: [0, 2, 4, 6, 7, 9, 11] },
    ionian:      { name: "ionian",      steps: [0, 2, 4, 5, 7, 9, 11] },
    aeolian:     { name: "aeolian",     steps: [0, 2, 3, 5, 7, 8, 10] },
    penta_major: { name: "penta_major", steps: [0, 2, 4, 7, 9]        },
    penta_minor: { name: "penta_minor", steps: [0, 3, 5, 7, 10]       },
  };

  // ==========================================================================
  // JI — 5-limit just ratios, one per semitone pitch-class from the tonic.
  //
  // "ji" tuning maps each mode step to the nearby ratio below, per-degree-
  // from-tonic like kolob's COLLECTIONS (kolob-audio.js:108), octave-folded.
  // Choices, with cents and deviation from ET:
  //
  //   0 : 1/1    =    0.0 c
  //   1 : 16/15  =  111.7 c  (+11.7)  just diatonic semitone — sycorax's b2
  //   2 : 9/8    =  203.9 c  ( +3.9)  greater whole tone
  //   3 : 6/5    =  315.6 c  (+15.6)  just minor third
  //   4 : 5/4    =  386.3 c  (-13.7)  just major third
  //   5 : 4/3    =  498.0 c  ( -2.0)  perfect fourth
  //   6 : 45/32  =  590.2 c  ( -9.8)  augmented fourth — lydian's #4 as the
  //                                   5-limit tritone (3/2 · 15/16 inverted),
  //                                   chosen over 7/5 to stay 5-limit
  //   7 : 3/2    =  702.0 c  ( +2.0)  perfect fifth
  //   8 : 8/5    =  813.7 c  (+13.7)  just minor sixth
  //   9 : 5/3    =  884.4 c  (-15.6)  just major sixth
  //  10 : 16/9   =  996.1 c  ( -3.9)  Pythagorean minor seventh — chosen over
  //                                   9/5 (1017.6 c, +17.6) because dorian's
  //                                   b7 wants to sit a pure 4/3 above the
  //                                   4/3, i.e. two fourths stacked, and it
  //                                   hugs ET closer
  //  11 : 15/8   = 1088.3 c  (-11.7)  just major seventh
  //
  // Every ratio lands within 16 cents of its ET cousin, so switching tuning
  // mid-piece shades the color without dislocating the melody.
  // ==========================================================================
  var JI_RATIOS = {
    0: 1,      1: 16 / 15, 2: 9 / 8,   3: 6 / 5,
    4: 5 / 4,  5: 4 / 3,   6: 45 / 32, 7: 3 / 2,
    8: 8 / 5,  9: 5 / 3,  10: 16 / 9, 11: 15 / 8,
  };

  var LN2 = Math.LN2;

  function centsBetween(fa, fb) {
    return 1200 * Math.log(fa / fb) / LN2;
  }

  // Resolve a mode argument: a name into MODES, or a custom {name, steps}
  // object (steps copied defensively — see pj2-rand's shuffle note about
  // mutated constant tables). Throws on garbage; modulate() relies on that
  // throw happening BEFORE any state changes.
  function resolveMode(mode) {
    if (typeof mode === "string") {
      var m = MODES[mode];
      if (!m) throw new Error("PJ2.Pitch: unknown mode '" + mode + "'");
      return m;
    }
    if (mode && typeof mode === "object" && Object.prototype.toString.call(mode.steps) === "[object Array]" && mode.steps.length > 0) {
      var steps = mode.steps.slice();
      for (var i = 0; i < steps.length; i++) {
        if (typeof steps[i] !== "number" || !isFinite(steps[i])) {
          throw new Error("PJ2.Pitch: custom mode steps must be finite numbers");
        }
      }
      return { name: String(mode.name || "custom"), steps: steps };
    }
    throw new Error("PJ2.Pitch: mode must be a MODES name or {name, steps}");
  }

  function resolveTuning(tuning) {
    if (tuning === undefined || tuning === null) return "et";
    if (tuning !== "et" && tuning !== "ji") {
      throw new Error("PJ2.Pitch: tuning must be 'et' or 'ji'");
    }
    return tuning;
  }

  function resolveTonic(tonicHz) {
    if (typeof tonicHz !== "number" || !isFinite(tonicHz) || tonicHz <= 0) {
      throw new Error("PJ2.Pitch: tonicHz must be a positive number");
    }
    return tonicHz;
  }

  // ==========================================================================
  // field({tonicHz, mode, tuning}) → Field
  // ==========================================================================
  function field(opts) {
    opts = opts || {};
    var _tonicHz = resolveTonic(opts.tonicHz);
    var _mode = resolveMode(opts.mode);
    var _tuning = resolveTuning(opts.tuning);

    // Frequency of a raw semitone step at an octave offset, under the
    // current tuning. JI folds the step to a pitch-class first so custom
    // modes with steps ≥ 12 still ratio-map sensibly; a fractional step
    // (quarter-tone custom mode, someday) falls back to ET for that degree
    // rather than exploding.
    function stepFreq(semis, oct) {
      if (_tuning === "ji") {
        var fold = Math.floor(semis / 12);
        var pc = semis - fold * 12;
        var r = JI_RATIOS[pc];
        if (r === undefined) return _tonicHz * Math.pow(2, (semis + 12 * oct) / 12);
        return _tonicHz * r * Math.pow(2, oct + fold);
      }
      return _tonicHz * Math.pow(2, (semis + 12 * oct) / 12);
    }

    // Degree indices fold beyond the mode length in BOTH directions:
    // degFreq(7, 0) in a 7-note mode is degFreq(0, 1), degFreq(-1, 0) is
    // degFreq(6, -1). Melodic walks can just add and subtract.
    function degFreq(deg, oct) {
      var n = _mode.steps.length;
      var fold = Math.floor(deg / n);
      var d = deg - fold * n;
      return stepFreq(_mode.steps[d], (oct || 0) + fold);
    }

    // Nearest scale tone — v1's arielSnapToScale generalized. Two upgrades:
    // no fixed 39-entry table (we search the octave neighborhood of the
    // input analytically), and distance is measured in CENTS, not Hz.
    // v1's linear-Hz nearest quietly biased low snaps downward — 100 Hz of
    // error is a semitone at 1700 Hz but an octave at 100 Hz. Log-domain
    // nearest is what the ear means by "nearest".
    function snapInfo(freq) {
      if (typeof freq !== "number" || !isFinite(freq) || freq <= 0) {
        throw new Error("PJ2.Pitch: snap needs a positive frequency");
      }
      var n = _mode.steps.length;
      var octGuess = Math.floor(Math.log(freq / _tonicHz) / LN2);
      var best = null;
      // ±1 octave around the guess covers every case: the nearest scale tone
      // to any freq is at most half an octave away, and modes always contain
      // step 0, so the true winner is inside this window.
      for (var o = octGuess - 1; o <= octGuess + 1; o++) {
        for (var d = 0; d < n; d++) {
          var f = stepFreq(_mode.steps[d], o);
          var c = centsBetween(freq, f); // deviation of the INPUT from the tone
          if (best === null || Math.abs(c) < Math.abs(best.cents)) {
            best = { freq: f, deg: d, oct: o, cents: c };
          }
        }
      }
      return best;
    }

    function snap(freq) {
      return snapInfo(freq).freq;
    }

    // Flat ascending table across [octLo, octHi] inclusive — the shape v1's
    // ARIEL_F_LYDIAN_HZ had, but generated. idx is the running index so
    // stepwise walks over the whole table stay trivial.
    function table(octLo, octHi) {
      var out = [];
      var idx = 0;
      for (var o = octLo; o <= octHi; o++) {
        for (var d = 0; d < _mode.steps.length; d++) {
          out.push({ deg: d, oct: o, freq: stepFreq(_mode.steps[d], o), idx: idx++ });
        }
      }
      return out;
    }

    // Inverse lookup: which (deg, oct) produced this frequency? Tolerance
    // defaults to 1 cent — generous enough for float round-trips, tight
    // enough that a non-scale tone never false-positives.
    function degOf(freq, tolCents) {
      if (tolCents === undefined) tolCents = 1;
      var info = snapInfo(freq);
      if (Math.abs(info.cents) <= tolCents) return { deg: info.deg, oct: info.oct };
      return null;
    }

    function snapshot() {
      return { tonicHz: _tonicHz, mode: _mode.name, tuning: _tuning };
    }

    // Explicit, atomic modulation. Everything is resolved (and can throw)
    // before ANY assignment, so a bad patch leaves the field exactly as it
    // was — no half-modulated states where the tonic moved but the mode
    // didn't. Returns {from, to} so the engine can narrate the change.
    // Emits nothing, retunes nothing already sounding: callers keep the
    // frequencies they already rendered (kolob's straddle lesson).
    function modulate(patch) {
      patch = patch || {};
      var from = snapshot();
      var nextTonic = (patch.tonicHz !== undefined) ? resolveTonic(patch.tonicHz) : _tonicHz;
      var nextMode = (patch.mode !== undefined) ? resolveMode(patch.mode) : _mode;
      var nextTuning = (patch.tuning !== undefined) ? resolveTuning(patch.tuning) : _tuning;
      _tonicHz = nextTonic;
      _mode = nextMode;
      _tuning = nextTuning;
      return { from: from, to: snapshot() };
    }

    // Degrees of THIS field whose pitch classes land within 15 cents of some
    // pitch class in the other field — octave-agnostic, so a common tone
    // counts even when the two fields voice it in different registers.
    // This is the pivot-tone machinery Phase 2's conductor will use to pick
    // modulations that share tones with where we already are.
    function commonTones(otherFieldOrSpec) {
      var other = (otherFieldOrSpec && typeof otherFieldOrSpec.degFreq === "function")
        ? otherFieldOrSpec
        : field(otherFieldOrSpec);
      // Absolute pitch class in cents (mod 1200 of cents-above-1Hz) — a
      // key-independent coordinate both fields share.
      function pc(freq) {
        var c = (1200 * Math.log(freq) / LN2) % 1200;
        return c < 0 ? c + 1200 : c;
      }
      function circDist(a, b) {
        var d = Math.abs(a - b) % 1200;
        return d > 600 ? 1200 - d : d;
      }
      var otherPcs = [];
      for (var e = 0; e < other.size; e++) otherPcs.push(pc(other.degFreq(e, 0)));
      var out = [];
      for (var d = 0; d < _mode.steps.length; d++) {
        var mine = pc(degFreq(d, 0));
        for (var i = 0; i < otherPcs.length; i++) {
          if (circDist(mine, otherPcs[i]) <= 15) {
            out.push(d);
            break;
          }
        }
      }
      return out;
    }

    return {
      degFreq: degFreq,
      snap: snap,
      snapInfo: snapInfo,
      table: table,
      degOf: degOf,
      modulate: modulate,
      commonTones: commonTones,
      get size()    { return _mode.steps.length; },
      get tonicHz() { return _tonicHz; },
      get mode()    { return _mode.name; },
      get tuning()  { return _tuning; },
    };
  }

  return {
    field: field,
    MODES: MODES,
    JI_RATIOS: JI_RATIOS,
  };
})();
