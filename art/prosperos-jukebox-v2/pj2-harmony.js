// ============================================================================
// Prospero's Jukebox v2 — pj2-harmony.js
// PJ2.Harmony: chord grammar, cadences, the hum consort, the sea change.
// Phase 2, module 7b.
//
// Phase 1's Library had no harmony to speak of — the drone sat on {0,4} and
// the melodies wandered the mode with nobody underneath them. This module is
// the underneath: a root-motion Markov grammar over the field's degrees, a
// two-chord cadence vocabulary ("a bit more audible" per the owner — legible,
// not liturgical), a 2–3 part least-motion consort for the singing hum, and
// the sea change: the once-an-evening modulation that about half of evenings
// get, planned against the scene list and executed atomically at a boundary.
//
// Ancestry: the grammar and cadence shapes are KOLOB's Harmony
// (kolob-audio.js:424-657) scaled way down — kolob voices four-part Sacred
// Harp with a candidate/scoring machine; the Library needs two or three hum
// parts drifting by step, so the consort here is a tiny exhaustive search
// over "each part moves at most two degrees", nothing grander. The harmonic
// ROTATION idea (chords as weather the melodies read) is v1's
// HARMONIC_CHORD_TONES tables (prosperos-jukebox-audio.js:340-370) grown a
// grammar.
//
// Everything in DEGREES, never cached Hz. The field mutates under this
// module (executeSeaChange is the one who mutates it), and the whole reason
// consumers survive is that every voice reads field.degFreq at USE time —
// this module keeps that discipline itself: no frequency is stored anywhere.
//
// Pure module: no audio nodes, no clock, no DOM, no Math.random/Date.now.
// All randomness through the injected rng stream; given the same seed and
// the same call sequence it answers identically, forever.
//
// PHASE 3 ADDITION — the per-track PROFILE (see the profile doc block above
// create()): Sycorax and Ariel ride this same machinery with their own
// grammars, pose rotations, cadence vocabularies, organum consorts and
// sea-change pools. With no profile passed, behavior is BIT-IDENTICAL to
// the Phase 2 build — same tables, same draws, same order.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Harmony = (function () {
  "use strict";

  // ==========================================================================
  // THE GRAMMAR — root-motion first-order Markov over the 7 mode degrees.
  //
  // Authored for the Library's C dorian, degree-indexed (0-based), so the
  // in-scale triads come out: 0 i (Cm), 1 ii (Dm), 2 bIII (Eb), 3 IV (F),
  // 4 v (Gm), 5 vi° (Adim), 6 bVII (Bb). The same table survives a sea
  // change unchanged — after a re-root the FUNCTIONS travel with the
  // degrees (the new i inherits the gravity), which is exactly what "re-root
  // the grammar" means.
  //
  // The musical reasoning, row by row:
  //
  //   i    — home, and home is heavy. Its two great neighbors get the big
  //          weights: bVII (the modal back-door, a whole step below — dorian
  //          breathes through Bb the way ionian breathes through V) and IV
  //          (the dorian brightness: the major chord on the 4th is the mode's
  //          signature color, F major over a C minor world). A real weight on
  //          staying put (harmonic rhythm here is slow; a chord that holds
  //          through two steps reads as repose, not stasis). v and ii as
  //          lesser exits, bIII as shading, vi° almost never — a diminished
  //          triad is a raised eyebrow in a candlelit room.
  //   ii   — the color chord. It exists to lean: onto v (the classic 2→5
  //          softened to minor) or back home, sometimes sideways to IV
  //          (relative-triad slide, shares two tones).
  //   bIII — the relative major's tonic in disguise; it drifts forward to IV
  //          or down to bVII (major chords passing major chords, the modal
  //          plateau), or resolves home.
  //   IV   — plagal gravity: overwhelmingly home to i (the amen lives here,
  //          which is why "plagal" is the house cadence), else the IV→bVII
  //          fifth-fall or a lean on v.
  //   v    — the SOFT dominant. Degree 6 is NATURAL (Bb, dorian's b7), so
  //          this triad is G MINOR: no leading tone, no F#, no pull that
  //          demands. It still mostly resolves to i — root motion down a
  //          fifth is gravity in any mode — but as a sigh, not a cadence
  //          machine. That naturalness is the whole modal color and the
  //          reason the "soft-authentic" cadence below stays in-scale.
  //   vi°  — the rare bird. When it does sound it is a passing shadow: it
  //          resolves immediately (home, or down a half-step... rather, up
  //          to bVII whose triad absorbs two of its tones). Nobody lingers
  //          on a diminished chord in this library.
  //   bVII — the other pole. Strong pull home (bVII→i is dorian's plagal-
  //          from-above), else back to IV (fifth-fall) or shading through
  //          bIII/v. A little self-weight: two bars of Bb major is a
  //          perfectly good place to read.
  //
  // Stationary behavior (verified in the phase check): i clearly the most
  // visited, bVII and IV the next two, vi° around 2% — gravity around i
  // with bVII/IV as the main neighbors, as ordered.
  // ==========================================================================
  var GRAMMAR = {
    0: [[6, 3],   [3, 3],   [0, 1.6], [4, 1.4],  [1, 1],    [2, 0.8], [5, 0.2]],
    1: [[4, 2.5], [0, 2.5], [3, 2],   [6, 1],    [2, 0.5]],
    2: [[3, 2.5], [6, 2],   [0, 2],   [1, 1],    [5, 0.25]],
    3: [[0, 3.5], [6, 2],   [4, 1.5], [2, 1],    [1, 0.75]],
    4: [[0, 3.5], [3, 1.5], [6, 1.5], [2, 0.75], [1, 0.5]],
    5: [[0, 2.5], [6, 2],   [3, 1]],
    6: [[0, 3.5], [3, 1.5], [2, 1],   [4, 1],    [6, 0.8],  [1, 0.5]],
  };

  // Chord-tone bias multiplier for the Motif improviser — one constant, one
  // source of truth (Motif reads it via .biasBase(), never hard-codes it).
  // 1.8 ≈ v1's markovNextChordBiased feel: chord tones win noticeably more
  // often than not, without the melody turning into an arpeggio exercise.
  var BIAS_BASE = 1.8;

  // Sea-change target pools — module-level constants so the harness can
  // "inspect the pickW table" and prove both kinds reachable by construction.
  var TARGETS = [["reroot", 2], ["true", 2]];
  // REROOT destination degrees (of the current field): the 4th degree
  // (0-based 3 — C dorian → F, its subdominant, the gentlest new gravity)
  // and the 7th degree (0-based 6 — C dorian → Bb, the relative major's
  // world). Both keep every pitch; only the floor tilts.
  var REROOT_DEGS = [[3, 1], [6, 1]];

  // Roman-numeral spelling support. MAJOR_STEPS is the ionian yardstick:
  // a degree sitting below its ionian position gets a "b" prefix (that is
  // how "bIII"/"bVII" fall out of dorian, and how the names stay honest
  // after a sea change re-roots us into mixolydian or ionian).
  var MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

  // The seven rotations of the diatonic set, by interval signature — so a
  // re-rooted mode gets its true name. Worked from dorian [0,2,3,5,7,9,10]:
  // re-root on degree k by subtracting steps[k] mod 12. Dorian's rotations:
  // deg 1 → phrygian, 2 → lydian, 3 → MIXOLYDIAN, 4 → aeolian, 5 → locrian,
  // 6 → IONIAN. (PJ2.Pitch.MODES lacks mixolydian/phrygian/locrian, so we
  // pass a custom {name, steps} object — the field API accepts it.)
  var DIATONIC_NAMES = {
    "0,2,4,5,7,9,11": "ionian",
    "0,2,3,5,7,9,10": "dorian",
    "0,1,3,5,7,8,10": "phrygian",
    "0,2,4,6,7,9,11": "lydian",
    "0,2,4,5,7,9,10": "mixolydian",
    "0,2,3,5,7,8,10": "aeolian",
    "0,1,3,5,6,8,10": "locrian",
  };

  // Consort register window, in ABSOLUTE degrees of the field (0 = tonic
  // octave 0; the Library's field puts that at C4 ≈ 262). Default −7..6 is
  // C3..Bb4 — the low-mid shelf where the hum already lives. Callers may
  // override per-call via opts.lo/opts.hi.
  var DEFAULT_LO = -7;
  var DEFAULT_HI = 6;

  var LN2 = Math.LN2;

  // ==========================================================================
  // THE PROFILE — the per-track door. (Phase 3 addition; the CONTRACT for
  // track builders. Sycorax and Ariel are the first two customers; the
  // Library passes nothing and gets the authored dorian world above,
  // BIT-IDENTICALLY — same draws from the same stream in the same order.)
  //
  // create({rng, field, dramaturgyName, profile}) — profile is OPTIONAL and
  // every key inside it is optional. Omitted keys fall back to the Library
  // behavior documented at each site. Shape:
  //
  //   profile = {
  //
  //     // ---- ROOT PARADIGM — grammar and poses are MUTUALLY EXCLUSIVE ----
  //     // A track thinks about harmonic color in exactly one of two ways:
  //     //
  //     //   ROOT-MOTION MODE (the Library, Ariel): chords are triads stacked
  //     //   on MOVING roots; step() walks a root-motion Markov table.
  //     //
  //     //   POSE MODE (Sycorax): the root is PINNED to i forever; color
  //     //   comes from rotating between authored degree-set "poses"; step()
  //     //   walks a pose-Markov instead. current().rootDeg is always 0.
  //     //
  //     // Passing both `grammar` and `poses` throws at create() — they are
  //     // different paradigms, not composable options.
  //
  //     grammar: { rootDeg: [[nextRootDeg, weight], ...], ... },
  //       // Root-motion mode with a REPLACEMENT table (same shape as the
  //       // module's GRAMMAR; row 0 required — unknown rows fall back to
  //       // row 0's gravity at run time, exactly like the Library). Ariel
  //       // passes its I↔II floating lydian table here.
  //
  //     poses: {
  //       table:  { poseName: [degClass, ...], ... },
  //         // Every pose is its own chord shape — the degree classes it
  //         // voices (this subsumes any separate "chordShapesByPose": a
  //         // pose IS its shape). Poses may exist here WITHOUT a markov row
  //         // (reachable only via setPose — Sycorax's "afterimage" {0,5}).
  //       markov: { poseName: [[poseName, weight], ...], ... },
  //         // The rotation. step() draws the next pose from the current
  //         // pose's row (one rng draw, same cost as a grammar step). A
  //         // no-repeat rotation is authored by leaving self-weights out.
  //         // step() from a pose with NO row holds the pose (no draw).
  //       initial: poseName,
  //         // Starting pose; default = the markov's first declared key.
  //     },
  //       // Pose mode also unlocks .setPose(name) — deterministic, drawless,
  //       // for boundary "arrival poses" (Sycorax forces "sting" where a
  //       // cadence would have been). Calling setPose outside pose mode
  //       // throws. current() gains .pose (= .name) in pose mode.
  //
  //     // ---- endings ----
  //     resolutionDegs: [degClass, ...]  OR  function(current) -> [deg, ...],
  //       // Where phrase endings land (Motif reads this at use time).
  //       // A static array pins it — Sycorax's keening law is `[1]`: every
  //       // ending pulled to the flat second regardless of pose. A function
  //       // receives current() and returns the set. Default: the chord
  //       // tones of the current chord/pose.
  //
  //     // ---- cadences ----
  //     cadences: { kindName: { approach: deg | "current",
  //                             arrival: deg,
  //                             approachWhenAtArrival: deg /*optional*/ }, ... },
  //       // REPLACES the Library's plagal/half/soft-authentic vocabulary.
  //       // approach "current" = cadence from wherever the grammar stands
  //       // (the Library's half cadence does this); approachWhenAtArrival
  //       // covers the degenerate case (already standing on the arrival).
  //       // cadence(kind) with an unknown kind falls back to the FIRST
  //       // declared kind. An EMPTY object ({}) is the anti-cadence hard-off:
  //       // cadence() returns null and consumes NO draws. Ariel's kinds:
  //       //   lift    {approach: 0, arrival: 1}            I -> II
  //       //   float   {approach: 1, arrival: 0}            II -> I
  //       //   up-half {approach: "current", arrival: 1, approachWhenAtArrival: 0}
  //       // Cadences are a ROOT-MOTION concept: pose mode + a non-empty
  //       // cadences table throws at create (pose tracks voice arrivals via
  //       // setPose instead). Pose mode WITHOUT the key: cadence() → null.
  //
  //     // ---- the consort ----
  //     consort: {
  //       mode: "organum",
  //         // Replaces the least-motion voice-led search with ORGANUM:
  //         // exactly 2 parts, the lower doubling the TOP LINE in parallel
  //         // at an authored interval per degree class — open fifths where
  //         // the mode has them, fourths where it denies them (the
  //         // historical occursus fallback). voiceConsort(nParts, opts)
  //         // then reads opts.top (an ABSOLUTE degree — the melody note or
  //         // arrival tone being doubled; default = the current chord's
  //         // highest listed deg) and returns [lower, top]: parallel by
  //         // construction (the offset is a function of top's class alone),
  //         // never crossing, drawless, stateless (parallel organum has no
  //         // voice-leading memory to keep).
  //       doubling: { topDegClass: negativeDegreeOffset, ... },
  //         // Optional authored table: lower = top + offset. Classes left
  //         // out are computed from the LIVE mode steps at call time —
  //         // prefer the offset landing a perfect fifth (7 semitones)
  //         // below, else a perfect fourth (5), else -3 (a third below —
  //         // the shell when the mode denies both). In the sycorax mode
  //         // the computed table is {0:-3 P5, 1:-2 P4, 2:-3 P5, 3:-3 M3,
  //         // 4:-4 P4, 5:-5 P5, 6:-5 P5}.
  //     },
  //
  //     // ---- the sea change ----
  //     seaChange: {
  //       p: number  OR  function(tidePos) -> number,
  //         // The evening's coin. Default: 0.4 + 0.2·tidePos (the Library
  //         // owner rule). Sycorax passes ~0.12 (rare sink); Ariel passes
  //         // function(tp){ return 0.5 + 0.25*tp; }.
  //       placementWeights: [[{from: sceneType?, to: sceneType?}, weight], ...],
  //         // Declarative boundary matchers, tried IN ORDER per boundary;
  //         // the first rule matching a boundary (scene i-1 → scene i)
  //         // contributes its weight for atSceneIdx = i. Omitted from/to
  //         // match anything. No matching boundary in the plan → decline
  //         // (return null), same as the Library. Defaults to the Library
  //         // rule: [[{to:"reverie"}, 3], [{from:"chapter", to:"chapter"}, 1]].
  //         // Ariel: [[{to:"swirl"}, 3], [{from:"flight", to:"song"}, 1]].
  //         // Sycorax: [[{from:"invocation", to:"afterimage"}, 1]] (the cut).
  //       targets: [[targetSpec, weight], ...],
  //         // Replacement pickW pool. targetSpec is one of:
  //         //   {kind: "reroot", degs: [[toDeg, w], ...] /*optional*/}
  //         //     — same collection, new floor; degs defaults to the
  //         //       module's REROOT_DEGS. Ariel: degs [[4, 1]] (lydian
  //         //       re-rooted on its 5th degree → ionian... degree 4).
  //         //   {kind: "true"}
  //         //     — tonicHz × 4/3 exactly, same mode (the subdominant lift).
  //         //   {kind: "ratio", ratio: r, name: "sink" /*optional label*/}
  //         //     — tonicHz × r, same mode: the generalized transposition.
  //         //       Sycorax's downward sink is {kind: "ratio",
  //         //       ratio: Math.pow(2, -1/12), name: "sink"} — the rite
  //         //       resumes a half-step lower. r must be finite and > 0.
  //         // Default pool: the module TARGETS ([["reroot",2],["true",2]]).
  //     },
  //   }
  //
  // Draw discipline: a profile changes WHICH tables the draws consult, never
  // how many draws an operation costs — step() is one pickW in either
  // paradigm, cadence() is two rnds, planSeaChange() is chance + pickW +
  // pickW (+ one more for reroot), organum voiceConsort is zero. Per-track
  // determinism therefore behaves exactly like the Library's.
  //
  // After executeSeaChange: root-motion mode re-roots the grammar to the new
  // i (rootDeg 0) exactly as before; POSE mode keeps its current pose (the
  // rite resumes mid-gesture — Sycorax's sink changes the floor, not the
  // posture). Consort voice-leading state is cleared in both (organum keeps
  // none anyway).
  // ==========================================================================
  function validateProfile(profile) {
    if (!profile) return;
    if (profile.grammar && profile.poses) {
      throw new Error("PJ2.Harmony: profile.grammar and profile.poses are " +
        "mutually exclusive paradigms — pass exactly one (or neither)");
    }
    if (profile.grammar) {
      if (!profile.grammar[0]) {
        throw new Error("PJ2.Harmony: profile.grammar needs a row for root 0 " +
          "(the fallback gravity)");
      }
    }
    if (profile.poses) {
      var tb = profile.poses.table, mk = profile.poses.markov, name, i;
      if (!tb || typeof tb !== "object") {
        throw new Error("PJ2.Harmony: profile.poses needs a table of {name: [degs]}");
      }
      var count = 0;
      for (name in tb) {
        count++;
        if (Object.prototype.toString.call(tb[name]) !== "[object Array]" || !tb[name].length) {
          throw new Error("PJ2.Harmony: pose '" + name + "' needs a non-empty degree array");
        }
      }
      if (!count) throw new Error("PJ2.Harmony: profile.poses.table is empty");
      if (!mk || typeof mk !== "object") {
        throw new Error("PJ2.Harmony: profile.poses needs a markov of {name: [[name, w]]}");
      }
      for (name in mk) {
        if (!tb[name]) {
          throw new Error("PJ2.Harmony: pose markov row '" + name + "' has no pose in the table");
        }
        var row = mk[name];
        if (Object.prototype.toString.call(row) !== "[object Array]" || !row.length) {
          throw new Error("PJ2.Harmony: pose markov row '" + name + "' must be a non-empty pool");
        }
        for (i = 0; i < row.length; i++) {
          if (!tb[row[i][0]]) {
            throw new Error("PJ2.Harmony: pose markov row '" + name +
              "' points at unknown pose '" + row[i][0] + "'");
          }
        }
      }
      var init = profile.poses.initial;
      if (init != null && !tb[init]) {
        throw new Error("PJ2.Harmony: profile.poses.initial '" + init + "' is not in the table");
      }
      if (profile.cadences) {
        for (name in profile.cadences) {
          throw new Error("PJ2.Harmony: pose mode has no root-motion cadences — " +
            "voice arrivals with setPose instead (or pass cadences: {})");
        }
      }
    }
    if (profile.cadences) {
      for (var ck in profile.cadences) {
        var sh = profile.cadences[ck];
        if (!sh || typeof sh.arrival !== "number" ||
            (sh.approach !== "current" && typeof sh.approach !== "number")) {
          throw new Error("PJ2.Harmony: cadence kind '" + ck +
            "' needs {approach: deg|\"current\", arrival: deg}");
        }
      }
    }
    if (profile.consort && profile.consort.mode !== "organum") {
      throw new Error("PJ2.Harmony: unknown consort mode '" +
        profile.consort.mode + "' (only \"organum\" is defined)");
    }
    if (profile.seaChange && profile.seaChange.targets) {
      var tg = profile.seaChange.targets;
      for (var ti = 0; ti < tg.length; ti++) {
        var spec = tg[ti][0];
        if (!spec || (spec.kind !== "reroot" && spec.kind !== "true" && spec.kind !== "ratio")) {
          throw new Error("PJ2.Harmony: sea-change target kind must be reroot|true|ratio");
        }
        if (spec.kind === "ratio" && !(typeof spec.ratio === "number" &&
            isFinite(spec.ratio) && spec.ratio > 0)) {
          throw new Error("PJ2.Harmony: ratio sea-change target needs a finite ratio > 0");
        }
      }
    }
  }

  // ==========================================================================
  // create({rng, field, dramaturgyName, profile?}) → Harmony
  // ==========================================================================
  function create(opts) {
    opts = opts || {};
    var rng = opts.rng;
    var field = opts.field;
    var dramaturgyName = opts.dramaturgyName || "library";
    if (!rng || typeof rng.pickW !== "function") {
      throw new Error("PJ2.Harmony: create needs a forked rng stream");
    }
    if (!field || typeof field.degFreq !== "function") {
      throw new Error("PJ2.Harmony: create needs a PitchField");
    }
    var profile = opts.profile || null;
    validateProfile(profile);
    var grammar = (profile && profile.grammar) || GRAMMAR;
    var poses = (profile && profile.poses) || null;
    var poseMode = !!poses;
    var organum = !!(profile && profile.consort && profile.consort.mode === "organum");

    var _rootDeg = 0;        // current chord root, degree index (0 = i)
    var _sinceT = 0;         // audio time the current chord started (library-fed)
    var _consorts = {};      // consort id → previous voicing [absDeg,...] asc
    var _pose = null;        // pose mode: the current pose name
    if (poseMode) {
      _pose = poses.initial;
      if (_pose == null) {
        for (var _pk in poses.markov) { _pose = _pk; break; }
      }
      if (_pose == null) {
        for (var _tk in poses.table) { _pose = _tk; break; }
      }
    }

    // ---- degree helpers ----------------------------------------------------
    function fold(d) {
      var n = field.size;
      return ((d % n) + n) % n;
    }

    // In-scale triad on a root: stacked mode-thirds, folded to canonical
    // degree classes 0..size-1 (degFreq folds anyway; folding here means
    // Motif can compare against its 7-degree Markov rows directly).
    function chordDegsOf(root) {
      return [fold(root), fold(root + 2), fold(root + 4)];
    }

    // Recover the LIVE field's step structure in semitones by measuring it.
    // The field exposes mode NAME but not steps, and after a sea change the
    // mode may be a custom rotation object — measuring degFreq against the
    // tonic and rounding cents to the nearest semitone is exact under ET and
    // still rounds correctly under JI (all ratios sit within 16 cents of ET).
    function currentSteps() {
      var n = field.size, t = field.tonicHz, out = [], d;
      for (d = 0; d < n; d++) {
        out.push(Math.round(1200 * Math.log(field.degFreq(d, 0) / t) / LN2 / 100));
      }
      return out;
    }

    // Spell the chord from the live mode: quality from the stacked third and
    // fifth (minor third → lowercase, diminished fifth → °), flat prefix
    // when the degree sits below its ionian position. In dorian this yields
    // exactly i, ii, bIII, IV, v, vi°, bVII — and it keeps telling the truth
    // after the field rotates under us.
    function chordName(root) {
      var steps = currentSteps();
      var n = steps.length;
      var r = fold(root);
      var t3 = (steps[(r + 2) % n] - steps[r] + 12) % 12;
      var t5 = (steps[(r + 4) % n] - steps[r] + 12) % 12;
      var base = ROMAN[r] || String(r + 1);
      var flat = (MAJOR_STEPS[r] !== undefined && steps[r] < MAJOR_STEPS[r]) ? "b" : "";
      if (t5 === 6) return flat + base.toLowerCase() + "°";
      if (t3 === 3) return flat + base.toLowerCase();
      return flat + base;
    }

    // ---- grammar / poses ---------------------------------------------------
    function current() {
      if (poseMode) {
        // Pose mode: the root is PINNED to i. Color is the pose's own degree
        // set; .name (and .pose) carry the pose so events/telemetry read
        // "sting" rather than a roman numeral that never changes.
        return {
          rootDeg: 0,
          chordDegs: poses.table[_pose].slice(),
          sinceT: _sinceT,
          name: _pose,
          pose: _pose,
        };
      }
      return {
        rootDeg: _rootDeg,
        chordDegs: chordDegsOf(_rootDeg),
        sinceT: _sinceT,
        name: chordName(_rootDeg),
      };
    }

    // One grammar move. The LIBRARY owns the harmonic rhythm (a lane firing
    // every 14–30s, scene-scaled) and hands us the exact audio time t so
    // current().sinceT means something. The table assumes a 7-degree mode
    // (the Library's worlds all are); a smaller custom field would fall back
    // to row 0's gravity rather than crash. In pose mode the same call walks
    // the pose-Markov instead — one draw either way; a pose with no row
    // holds (drawless), so "reachable only by setPose" poses stay put until
    // the track moves on.
    function step(t) {
      if (poseMode) {
        var prow = poses.markov[_pose];
        if (prow) _pose = rng.pickW(prow);
      } else {
        var row = grammar[_rootDeg] || grammar[0];
        _rootDeg = rng.pickW(row);
      }
      if (t !== undefined && t !== null) _sinceT = t;
      return current();
    }

    // setPose(name) — pose mode only: the deterministic, drawless arrival
    // move (Sycorax darkens boundaries by forcing "sting"; the afterimage
    // holds its bare fifth this way). Throws outside pose mode — a
    // root-motion track reaching for poses is a paradigm confusion, caught
    // loudly at integration time.
    function setPose(name, t) {
      if (!poseMode) {
        throw new Error("PJ2.Harmony: setPose is pose-mode only (pass profile.poses)");
      }
      if (!poses.table[name]) {
        throw new Error("PJ2.Harmony: unknown pose '" + name + "'");
      }
      _pose = name;
      if (t !== undefined && t !== null) _sinceT = t;
      return current();
    }

    function biasBase() {
      return BIAS_BASE;
    }

    // Chord tones of the current chord — where phrase endings land. The
    // profile may pin the set (Sycorax's keening law: [1], every ending
    // pulled onto the flat second) or compute it (a function receiving
    // current()); default is the live chord/pose tones.
    function resolutionDegs() {
      if (profile && profile.resolutionDegs != null) {
        var rd = profile.resolutionDegs;
        if (typeof rd === "function") {
          var got = rd(current());
          return (got && got.length) ? got.slice() : chordDegsOf(_rootDeg);
        }
        return rd.slice();
      }
      if (poseMode) return poses.table[_pose].slice();
      return chordDegsOf(_rootDeg);
    }

    // ---- cadence -----------------------------------------------------------
    // A cadence is a two-chord act (kolob's phrase) occupying the last ~8–14s
    // before a boundary; the ARRIVAL lands exactly on the boundary t, so the
    // library schedules chords[0] at (t − durS0 − durS1) and chords[1] at
    // (t − durS1). Shapes:
    //   plagal          IV → i   the amen, the house cadence — into reverie,
    //                            candle-out, and the evening seam
    //   half            (cur) → v  mid-evening comma: we rest on the soft
    //                            dominant and the next scene answers it
    //   soft-authentic  v → i    sparing, chapter-end. The v is G MINOR —
    //                            degree 6 stays NATURAL dorian (Bb, never
    //                            A-sharpened-to-B-natural... i.e. no F# third
    //                            on G): triads are built in-scale by degree,
    //                            so there is no leading tone to sharpen and
    //                            the modal color survives the arrival.
    // Approach chord slightly longer than the arrival (the lean is the
    // point; the landing just has to be there). Mutates the grammar state to
    // the arrival root, so resolutionDegs() read after cadence() gives the
    // arrival tones the melody must end on.
    function cadence(kind) {
      var approach, arrival;
      if (poseMode) return null;   // anti-cadence by paradigm (see profile doc)
      if (profile && profile.cadences) {
        // Profile vocabulary. Empty object = the anti-cadence hard-off:
        // null, and NO draws consumed (a track that never cadences must not
        // pay stream position for saying so).
        var kinds = profile.cadences;
        var shape = kinds[kind];
        if (!shape) {
          for (var fk in kinds) { kind = fk; shape = kinds[fk]; break; }
        }
        if (!shape) return null;
        arrival = shape.arrival;
        approach = (shape.approach === "current") ? _rootDeg : shape.approach;
        if (approach === arrival && shape.approachWhenAtArrival != null) {
          approach = shape.approachWhenAtArrival;
        }
        var totalS2 = rng.rnd(9, 13);
        var lean2 = rng.rnd(0.52, 0.58);
        var durA2 = totalS2 * lean2;
        _rootDeg = arrival;
        return {
          kind: kind,
          chords: [
            { rootDeg: approach, chordDegs: chordDegsOf(approach), durS: durA2, name: chordName(approach) },
            { rootDeg: arrival,  chordDegs: chordDegsOf(arrival),  durS: totalS2 - durA2, name: chordName(arrival) },
          ],
        };
      }
      if (kind === "half") {
        arrival = 4;
        // Half cadence FROM wherever we stand; if we already stand on v,
        // approach from home — i → v is the plainest possible comma.
        approach = (_rootDeg === 4) ? 0 : _rootDeg;
      } else if (kind === "soft-authentic") {
        approach = 4;
        arrival = 0;
      } else {
        kind = "plagal";
        approach = 3;
        arrival = 0;
      }
      var totalS = rng.rnd(9, 13);            // inside the ~8–14s contract
      var lean = rng.rnd(0.52, 0.58);         // approach takes slightly more
      var durA = totalS * lean;
      var durB = totalS - durA;
      _rootDeg = arrival;
      return {
        kind: kind,
        chords: [
          { rootDeg: approach, chordDegs: chordDegsOf(approach), durS: durA, name: chordName(approach) },
          { rootDeg: arrival,  chordDegs: chordDegsOf(arrival),  durS: durB, name: chordName(arrival)  },
        ],
      };
    }

    // ---- the consort -------------------------------------------------------
    // 2–3 hum parts voicing the current chord by least motion. Kolob's
    // scorer, miniaturized: each part may move at most TWO degrees from its
    // previous seat, parts never cross (strictly ascending), everything stays
    // in the register window, and the chord ROOT class is always present.
    // Candidate sets are tiny (chord tones within ±2 of each part: at most
    // three each), so we just try every combination and keep the least total
    // motion — no need for kolob's candidate-generation heuristics at this
    // scale.

    function classesOf(chordDegs) {
      var set = {}, i;
      for (i = 0; i < chordDegs.length; i++) set[fold(chordDegs[i])] = true;
      return set;
    }

    // Chord-tone degrees within [prevDeg−maxMove, prevDeg+maxMove] ∩ window,
    // ascending. Chord classes sit at gaps of 2,2,3 around the mode, so ±2
    // always finds at least one — usually two.
    function candidatesFor(prevDeg, classes, lo, hi, maxMove) {
      var out = [], m, d;
      for (m = -maxMove; m <= maxMove; m++) {
        d = prevDeg + m;
        if (d < lo || d > hi) continue;
        if (classes[fold(d)]) out.push(d);
      }
      return out;
    }

    // Exhaustive least-motion search. minGap: 2-part consorts keep at least
    // two degrees between parts (a hum dyad a second apart is mud, and the
    // spread guarantees the pair's ±2 windows always span a full octave —
    // which is what makes "root present" satisfiable forever); 3-part
    // consorts only forbid crossing/unison. Deterministic: no rng, ties go
    // to the first combination in enumeration order.
    function searchVoicing(prev, classes, rootClass, lo, hi, maxMove, minGap) {
      var lists = [], i;
      for (i = 0; i < prev.length; i++) {
        lists.push(candidatesFor(prev[i], classes, lo, hi, maxMove));
        if (!lists[i].length) return null;
      }
      var best = null, bestScore = Infinity;
      function walk(idx, picked, motion) {
        if (idx === lists.length) {
          var hasRoot = false, j, score = motion;
          for (j = 0; j < picked.length; j++) {
            if (fold(picked[j]) === rootClass) { hasRoot = true; break; }
          }
          if (!hasRoot) return;                          // root present: hard
          if (fold(picked[0]) !== rootClass) score += 0.3; // prefer root in bass
          for (j = 1; j < picked.length; j++) {
            if (picked[j] - picked[j - 1] > 5) score += 0.5; // discourage sprawl
          }
          if (score < bestScore) { bestScore = score; best = picked.slice(); }
          return;
        }
        var list = lists[idx];
        for (var c = 0; c < list.length; c++) {
          var d = list[c];
          if (idx > 0 && d - picked[idx - 1] < minGap) continue; // no crossing
          picked.push(d);
          walk(idx + 1, picked, motion + Math.abs(d - prev[idx]));
          picked.pop();
        }
      }
      walk(0, [], 0);
      return best;
    }

    // A fresh seat (no state, or state reset after the sea change): bass on
    // the lowest root-class degree comfortably inside the window, then
    // stacked mode-thirds — 3 parts sit root/third/fifth (spacing 2), 2
    // parts sit root/fifth (spacing 4, the open hum dyad).
    function freshVoicing(nParts, rootClass, lo, hi) {
      var b = null, d;
      for (d = lo + 1; d <= hi; d++) {
        if (fold(d) === rootClass) { b = d; break; }
      }
      if (b === null) b = lo; // degenerate window; never in practice
      var spacing = (nParts === 2) ? 4 : 2;
      var out = [b], i;
      for (i = 1; i < nParts; i++) out.push(out[i - 1] + spacing);
      // If a narrow custom window clips the top, drop the whole stack an
      // octave rather than deform the chord.
      while (out[out.length - 1] > hi && out[0] - field.size >= lo) {
        for (i = 0; i < out.length; i++) out[i] -= field.size;
      }
      return out;
    }

    // ---- organum (profile.consort.mode === "organum") ----------------------
    // Semitone height of an ABSOLUTE degree, from the live mode steps.
    // Math.floor handles negatives correctly (deg -3 in a 7-mode = class 4,
    // octave -1), so interval arithmetic below is exact in either direction.
    function semiOfDeg(d, steps) {
      var n = steps.length;
      return 12 * Math.floor(d / n) + steps[((d % n) + n) % n];
    }
    // The doubling offset under a top-line degree class: the authored table
    // first, else computed from the LIVE mode (survives modulation) — the
    // nearest lower degree a perfect fifth (7 semitones) below, else a
    // perfect fourth (5), else -3 (the third-below shell — the occursus
    // compromise where the mode denies both perfect intervals).
    function organumOffset(topDeg) {
      var authored = profile.consort.doubling;
      var cls = fold(topDeg);
      if (authored && authored[cls] != null) return authored[cls];
      var steps = currentSteps();
      var n = steps.length;
      var topS = semiOfDeg(topDeg, steps), o;
      for (o = -1; o >= -n; o--) {
        if (topS - semiOfDeg(topDeg + o, steps) === 7) return o;
      }
      for (o = -1; o >= -n; o--) {
        if (topS - semiOfDeg(topDeg + o, steps) === 5) return o;
      }
      return -3;
    }

    // voiceConsort(nParts, opts) → [absDeg, ...] lowest-first.
    // opts: { id="hum", lo, hi, chord } — chord ({rootDeg, chordDegs?})
    // overrides current(), which is how the library voices BOTH chords of a
    // cadence through one continuous consort line (state still advances, so
    // the cadence itself is voice-led). Per-id state means the hum consort
    // and any future second consort never contaminate each other's motion.
    //
    // ORGANUM MODE (profile.consort.mode === "organum"): the contract changes
    // — opts.top is the ABSOLUTE degree of the line being doubled (default:
    // the current chord/pose's highest listed deg) and the return is always
    // the 2-part parallel [top + doubling(class(top)), top]. Drawless,
    // stateless, never crossing; nParts beyond 2 is clamped (organum never
    // grows a third part — the plan's hard rule).
    function voiceConsort(nParts, opts) {
      opts = opts || {};
      if (organum) {
        var topDeg;
        if (opts.top != null && isFinite(opts.top)) {
          topDeg = Math.round(opts.top);
        } else {
          var oc = opts.chord || current();
          var ocd = oc.chordDegs || chordDegsOf(oc.rootDeg);
          topDeg = ocd[0];
          for (var oi = 1; oi < ocd.length; oi++) {
            if (ocd[oi] > topDeg) topDeg = ocd[oi];
          }
        }
        return [topDeg + organumOffset(topDeg), topDeg];
      }
      nParts = Math.max(2, Math.min(3, nParts || 3));
      var id = (opts.id !== undefined && opts.id !== null) ? String(opts.id) : "hum";
      var lo = (opts.lo !== undefined && opts.lo !== null) ? opts.lo : DEFAULT_LO;
      var hi = (opts.hi !== undefined && opts.hi !== null) ? opts.hi : DEFAULT_HI;
      var chord = opts.chord || current();
      var rootClass = fold(chord.rootDeg);
      var cds = chord.chordDegs || chordDegsOf(chord.rootDeg);
      var classes = classesOf(cds);

      var prev = _consorts[id];
      if (prev && prev.length !== nParts) prev = null; // part count changed: reseat
      var minGap = (nParts === 2) ? 2 : 1;
      var next = null;
      if (prev) {
        next = searchVoicing(prev, classes, rootClass, lo, hi, 2, minGap);
      }
      if (!next) next = freshVoicing(nParts, rootClass, lo, hi);
      _consorts[id] = next.slice();
      return next.slice();
    }

    // ---- the sea change ----------------------------------------------------
    // planSeaChange({sceneList, tidePos}) → null | {atSceneIdx, target}
    //
    // Called ONCE per performance by the library, right after plan(). One
    // call yields at most one plan — that is the "never more than one per
    // evening" guarantee, held by construction rather than bookkeeping.
    //
    // p is the owner's coin: 0.5 nudged by the tide within [0.4, 0.6] —
    // p = 0.4 + 0.2·tidePos, so stormy evenings turn a little more often
    // than candlelit ones (the sea changes when the sea is up).
    //
    // Placement: a sea change happens AT a scene boundary — atSceneIdx is
    // the index of the scene being ENTERED. Weighted 3:1 toward the boundary
    // entering reverie (the modulation as the moment the reading dissolves
    // into remembering) over any chapter→chapter boundary. Evenings whose
    // plan offers neither (shouldn't exist — plans always have a reverie)
    // decline the change rather than force an awkward seam.
    function planSeaChange(args) {
      args = args || {};
      var sceneList = args.sceneList || [];
      var tidePos = (args.tidePos !== undefined && args.tidePos !== null) ? args.tidePos : 0.5;
      if (tidePos < 0) tidePos = 0; else if (tidePos > 1) tidePos = 1;
      var sc = profile && profile.seaChange;

      // PROFILE PATH — same draw ORDER as the Library path below (chance →
      // placement pickW → target pickW → optional reroot-degree pickW), only
      // the tables consulted differ. See the profile doc block for shapes.
      if (sc) {
        var p2 = (typeof sc.p === "function") ? sc.p(tidePos)
               : (sc.p != null) ? sc.p
               : 0.4 + 0.2 * tidePos;
        if (!rng.chance(p2)) return null;

        var rules = sc.placementWeights ||
          [[{ to: "reverie" }, 3], [{ from: "chapter", to: "chapter" }, 1]];
        var pool2 = [], i2, ri;
        for (i2 = 1; i2 < sceneList.length; i2++) {
          var toT = sceneList[i2] && sceneList[i2].type;
          var frT = sceneList[i2 - 1] && sceneList[i2 - 1].type;
          for (ri = 0; ri < rules.length; ri++) {
            var m = rules[ri][0] || {};
            if ((m.to == null || m.to === toT) && (m.from == null || m.from === frT)) {
              pool2.push([i2, rules[ri][1]]);
              break;                    // first matching rule wins the boundary
            }
          }
        }
        if (!pool2.length) return null;
        var at2 = rng.pickW(pool2);

        var specs = sc.targets || [[{ kind: "reroot" }, 2], [{ kind: "true" }, 2]];
        var spec = rng.pickW(specs);
        var target2;
        if (spec.kind === "reroot") {
          target2 = { kind: "reroot", toDeg: rng.pickW(spec.degs || REROOT_DEGS) };
        } else if (spec.kind === "ratio") {
          target2 = { kind: "ratio", ratio: spec.ratio };
          if (spec.name != null) target2.name = spec.name;
        } else {
          target2 = { kind: "true" };
        }
        return { atSceneIdx: at2, target: target2 };
      }

      var p = 0.4 + 0.2 * tidePos;
      if (!rng.chance(p)) return null;

      var pool = [], i;
      for (i = 1; i < sceneList.length; i++) {
        var toType = sceneList[i] && sceneList[i].type;
        var fromType = sceneList[i - 1] && sceneList[i - 1].type;
        if (toType === "reverie") pool.push([i, 3]);
        else if (toType === "chapter" && fromType === "chapter") pool.push([i, 1]);
      }
      if (!pool.length) return null;
      var atSceneIdx = rng.pickW(pool);

      var kind = rng.pickW(TARGETS);
      var target;
      if (kind === "reroot") {
        // Choose the destination degree NOW (it is a musical decision and
        // must be seeded); resolve the concrete tonic/mode at EXECUTE time
        // from the live field, since the plan precedes the seam by minutes.
        target = { kind: "reroot", toDeg: rng.pickW(REROOT_DEGS) };
      } else {
        target = { kind: "true" };
      }
      return { atSceneIdx: atSceneIdx, target: target };
    }

    // executeSeaChange(target) → {pivotDegs, from, to, kind} | null
    //
    // The one place in v2 that mutates the field. Atomic by inheritance:
    // field.modulate validates everything before assigning, so a bad target
    // throws and leaves the world intact. Already-sounding notes keep their
    // Hz (the field never retunes what it already answered — kolob's
    // straddle lesson); every note scheduled after this call reads the new
    // world because everyone reads degrees at use time.
    //
    //   REROOT — same pitch collection, new gravity. New tonic = the live
    //   frequency of target.toDeg (octave-folded to sit within a tritone of
    //   the old tonic, so the drone doesn't leap registers); new mode = the
    //   rotation of the current steps starting at that degree, named from
    //   DIATONIC_NAMES (C dorian re-rooted on its 4th degree is F
    //   MIXOLYDIAN; on its 7th, Bb IONIAN). Under ET the pitch-class set is
    //   IDENTICAL before and after — not one new pitch, only a new floor.
    //   (Under "ji" tuning the ratios re-anchor to the new tonic and the
    //   collection shifts by a comma here and there; the Library runs ET, so
    //   this stays theoretical — noted for whoever re-tunes the room later.)
    //
    //   TRUE — tonicHz × 4/3 exactly (up a perfect fourth), same mode. The
    //   subdominant lift: real new pitches, but sharing 6 of 7 with home.
    //
    // Afterwards: grammar re-rooted to the new i (degree 0 — the table's
    // gravity travels with the degrees), consort state cleared (the next
    // voicing is a fresh seat, so the no-crossing/least-motion rules are
    // never judged across the seam against stale degrees that mean different
    // pitches now), and pivotDegs returned: degrees OF THE NEW FIELD whose
    // pitch classes also lived in the old one — the melody lands on these to
    // stitch the two worlds together.
    function executeSeaChange(target) {
      if (!target || !target.kind) return null;

      // Snapshot the old world (spec form, not a field reference — the whole
      // point is that `field` is about to stop being the old world).
      var oldTonic = field.tonicHz;
      var oldSteps = currentSteps();
      var oldModeName = field.mode;
      var oldTuning = field.tuning;

      var change;
      if (target.kind === "reroot") {
        var n = oldSteps.length;
        var k = fold(target.toDeg);
        var rot = [], i;
        for (i = 0; i < n; i++) rot.push((oldSteps[(i + k) % n] - oldSteps[k] + 12) % 12);
        var newName = DIATONIC_NAMES[rot.join(",")] || (oldModeName + "-rot" + k);
        // New tonic = an actual pitch of the current field (collection
        // preservation is literal), folded near the old tonic's register.
        var newTonic = field.degFreq(k, 0);
        while (newTonic / oldTonic >= Math.SQRT2) newTonic /= 2;
        while (newTonic / oldTonic < 1 / Math.SQRT2) newTonic *= 2;
        change = field.modulate({ tonicHz: newTonic, mode: { name: newName, steps: rot } });
      } else if (target.kind === "true") {
        change = field.modulate({ tonicHz: oldTonic * 4 / 3 });
      } else if (target.kind === "ratio") {
        // The generalized transposition (profile targets only): tonic × r,
        // same mode. Sycorax's sink is r = 2^(-1/12) — stasis getting worse.
        if (!(typeof target.ratio === "number" && isFinite(target.ratio) && target.ratio > 0)) {
          throw new Error("PJ2.Harmony: ratio sea-change needs a finite ratio > 0");
        }
        change = field.modulate({ tonicHz: oldTonic * target.ratio });
      } else {
        throw new Error("PJ2.Harmony: unknown sea-change kind '" + target.kind + "'");
      }

      _rootDeg = 0;      // the grammar re-roots: new tonic, same gravity
      // (pose mode keeps its pose — the root was never anything but 0, and
      // the rite resumes mid-gesture across its own seam.)
      _consorts = {};    // consort seats are meaningless in the new world

      var pivotDegs = field.commonTones({
        tonicHz: oldTonic,
        mode: { name: oldModeName, steps: oldSteps },
        tuning: oldTuning,
      });

      var result = { pivotDegs: pivotDegs, from: change.from, to: change.to, kind: target.kind };
      if (target.name != null) result.name = target.name;  // e.g. "sink"
      return result;
    }

    return {
      step: step,
      setPose: setPose,
      current: current,
      biasBase: biasBase,
      resolutionDegs: resolutionDegs,
      cadence: cadence,
      voiceConsort: voiceConsort,
      planSeaChange: planSeaChange,
      executeSeaChange: executeSeaChange,
      get dramaturgyName() { return dramaturgyName; },
    };
  }

  return {
    create: create,
    // Authored data exposed read-only-by-convention for the harness: it
    // asserts every observed root transition has nonzero weight here, and
    // that both sea-change kinds are reachable by construction.
    GRAMMAR: GRAMMAR,
    BIAS_BASE: BIAS_BASE,
    TARGETS: TARGETS,
    REROOT_DEGS: REROOT_DEGS,
  };
})();
