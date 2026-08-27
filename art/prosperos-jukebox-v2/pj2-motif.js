// ============================================================================
// Prospero's Jukebox v2 — pj2-motif.js
// PJ2.Motif: the motif engine — improviser + composer + dialogue ledger +
// ghost. Phase 2, module 7a.
//
// v1's melodic soul was the Markov walk: three hand-tuned transition tables
// (prosperos-jukebox-audio.js:21-107) that made the harpsichord wander C
// Dorian like a reader's eye wanders a page. What v1 never had was MEMORY —
// every phrase was new weather, nothing returned, nothing was worked. The
// sibling engines grew that second faculty: ZANKYŌ's motif algebra
// (zankyo-audio.js:553) and KOLOB's genealogy with its tether and renewal
// (kolob-audio.js:1177). This module marries the two: the IMPROVISER births
// ideas by chord-biased Markov walk (v1's tables, ported into degree space),
// and the COMPOSER works them all evening — transforms with legality guards,
// a lineage per idea, an identity tether every third generation, renewal at
// the ninth, a dialogue ledger with real deadlines, and a ghost carried
// across the evening seam.
//
// The whole engine deals in ABSTRACT MUSIC ONLY:
//   - a motif is {name, gen, chain[], notes:[{deg, durBeats}]} — deg is an
//     absolute scale-degree integer that folds across octaves (deg 9 = degree
//     2 an octave up, per pj2-pitch's degFreq folding). durBeats is abstract
//     time; voices map beats→seconds at their own pace, so the same motif
//     reads slower in reverie than in a chapter.
//   - NO frequencies are ever computed or cached here. The pitch field
//     mutates mid-evening (the sea change) and a cached Hz would be a lie;
//     degrees stay true across any modulation. In fact this module needs the
//     field for exactly ONE number — field.size, the fold modulus of degree
//     space — read lazily at use time so even a mode change to a different
//     degree count is honored. Pass field if you have it; we default to 7.
//   - NO audio nodes, NO clock, NO DOM. Time enters only as caller-supplied
//     nowS / deadlineS numbers (the ledger's bookkeeping). ALL randomness
//     flows through the injected rng stream — the repro harness depends on
//     identical call sequences producing identical output, forever.
//
// Dependencies: an rng Stream (PJ2.Rand fork "motif"), optionally the live
// PitchField (for .size only, see above), and a PJ2.Harmony instance built
// against the SPEC-PHASE2 §7b contract — we consume only .current().chordDegs,
// .biasBase(), and .resolutionDegs(), each read defensively at use time so
// the two Phase 2 modules can be built (and can fail) independently.
//
// PHASE 3 ADDITION — per-track VOICES and POLICY (see the contract doc block
// above create()): Sycorax's chant/rebec/waterphone/bone-flute and Ariel's
// whistle/chime/flutter ride this same engine with their own walk tables,
// transform-weight rows, kind pools and posting habits. With neither option
// passed, behavior is BIT-IDENTICAL to the Phase 2 build — same tables,
// same draws, same order.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Motif = (function () {
  "use strict";

  // ==========================================================================
  // THE PORTED TABLES — v1's melodic DNA, verbatim.
  //
  // First-order Markov transition matrices over the 7 degrees of the mode.
  // Row = current degree, column = next. These are v1's exact numbers
  // (prosperos-jukebox-audio.js:58-77): decades of tuning-by-ear compressed
  // into 49 floats each. The melody table favors stepwise motion with the
  // occasional fourth; the music-box table leaps more (a mechanism has no
  // breath to carry a line). Rows needn't sum to 1 — the weighted draw
  // normalizes — but v1's do, and we keep them untouched.
  // ==========================================================================
  var MELODY_MARKOV = [
    [0.05, 0.30, 0.25, 0.10, 0.20, 0.05, 0.05],
    [0.20, 0.05, 0.30, 0.15, 0.15, 0.10, 0.05],
    [0.15, 0.25, 0.05, 0.25, 0.15, 0.05, 0.10],
    [0.10, 0.10, 0.25, 0.05, 0.30, 0.10, 0.10],
    [0.20, 0.10, 0.10, 0.20, 0.05, 0.20, 0.15],
    [0.10, 0.15, 0.05, 0.15, 0.25, 0.05, 0.25],
    [0.25, 0.10, 0.15, 0.10, 0.15, 0.20, 0.05],
  ];
  var BOX_MARKOV = [
    [0.05, 0.15, 0.10, 0.20, 0.30, 0.10, 0.10],
    [0.15, 0.05, 0.20, 0.10, 0.25, 0.15, 0.10],
    [0.20, 0.15, 0.05, 0.25, 0.10, 0.10, 0.15],
    [0.10, 0.10, 0.20, 0.05, 0.25, 0.20, 0.10],
    [0.20, 0.15, 0.10, 0.15, 0.05, 0.15, 0.20],
    [0.10, 0.20, 0.10, 0.15, 0.20, 0.05, 0.20],
    [0.15, 0.10, 0.20, 0.10, 0.20, 0.20, 0.05],
  ];
  // v1's hum table was 5×5 — the hum lived on C3–G3, degrees 0–4 only
  // (audio.js:21-27). Projected to 7: rows 0–4 are v1's values × 0.88 with
  // the reclaimed 12% granted to the new columns — 0.07 to degree 5 (dorian's
  // raised sixth, the mode's one warm surprise, worth an occasional lift) and
  // 0.05 to degree 6 (the soft bVII, a passing shade). Rows 5 and 6 are
  // authored to LEAVE quickly the way a low voice does: from the sixth it
  // settles onto the fifth; from the seventh it resolves home or falls to
  // the fifth. Tiny self-weights everywhere — a hum that repeats its note
  // reads as a stuck sample, not a singer.
  var HUM_MARKOV = [
    [0.044, 0.264, 0.220, 0.132, 0.220, 0.070, 0.050],
    [0.220, 0.044, 0.264, 0.176, 0.176, 0.070, 0.050],
    [0.176, 0.176, 0.044, 0.264, 0.220, 0.070, 0.050],
    [0.132, 0.220, 0.220, 0.044, 0.264, 0.070, 0.050],
    [0.264, 0.132, 0.176, 0.264, 0.044, 0.070, 0.050],
    [0.100, 0.080, 0.120, 0.180, 0.300, 0.050, 0.170],
    [0.300, 0.100, 0.100, 0.100, 0.200, 0.150, 0.050],
  ];

  var VOICE_TABLES = { pluck: MELODY_MARKOV, musicbox: BOX_MARKOV, hum: HUM_MARKOV };

  // Home registers, in OCTAVES of the field (offset = register × field.size).
  // The pluck reads at the table's own level, the box plinks upstairs, the
  // hum sings from the chest. Voices may re-register at render; this only
  // places fresh material where the character lives.
  var VOICE_REGISTER = { pluck: 0, musicbox: 1, hum: -1 };

  // ==========================================================================
  // CONSTANTS — biases and the runaway-proofing caps.
  // ==========================================================================
  // v1's harmonic feel, ported faithfully (audio.js:413-418): walking notes
  // lean gently toward chord tones (the harmony's biasBase, ≈1.8, is read
  // live); phrase-final notes lean HARD (×4.5) and half the time are simply
  // snapped to the nearest chord tone. Legible resolution, not slavish.
  var BIAS_RESOLUTION = 4.5;
  var RESOLUTION_FORCE_P = 0.5;
  // Every non-ghost motif leaving request() gets one more chance to land its
  // last note on the current chord — this is what buys the ≥85% phrase-final
  // resolution the spec demands even for material mangled by transforms.
  var OUTGOING_SNAP_P = 0.85;

  var AUGMENT_BEAT_CEIL = 16;  // augment refuses past this total (spec's ~16)
  var HARD_BEAT_CEIL = 20;     // absolute net: sanitize() rescales past this
  var HARD_NOTE_CEIL = 14;     // absolute net: sanitize() truncates past this
  var NOTE_BEAT_CEIL = 6;      // no single tone longer than 6 beats
  var NOTE_BEAT_FLOOR = 0.25;  // no tone shorter than a demisemi-ish flicker
  var LEDGER_CAP = 6;          // obligations beyond this: oldest is forgiven
  var RENEWAL_GEN = 9;         // at gen ≥ 9 the line returns to its source
  var TETHER_EVERY = 3;        // every 3rd generation the ancestor's head returns
  var GHOST_STATE_P = 0.8;     // p(an armed ghost actually opens the evening)

  // Duration vocabulary for fresh phrases: small beat cells, mostly quarters,
  // with the possibility of a held final (drawn separately). v1's phrases
  // were all even eighths at layer tempo; the cells give the walk a gait.
  var BEAT_CELLS = [[0.5, 2], [1, 3], [1.5, 2], [2, 1]];
  var HELD_FINAL_P = 0.35;     // a held last tone — the breath at the line's end

  // ==========================================================================
  // THE TRANSFORM GRAMMAR — voice × scene × affinity.
  //
  // Sophistication here is context-sensitivity (the ZANKYŌ lesson): the SAME
  // motif is worked differently by each speaker and differently in each
  // weather. These are only probability tilts over the same aleatoric
  // development — the piece stays dice, the players just have characters.
  //
  // VOICE_WEIGHTS — who develops how:
  //   pluck (the harpsichord — the principal reader, a practiced quill hand):
  //     leans SEQUENCE and TRANSPOSE — it restates lines a step away, the
  //     figuration habit of every keyboard tradition; ornament close behind
  //     (a turn costs a harpsichordist nothing); it rarely stretches time —
  //     plucked tone has no sustain to stretch INTO.
  //   musicbox (the mechanism): leans FRAGMENT and DIMINISH — a comb of pins
  //     can only splinter and quicken; augment is nearly forbidden (a music
  //     box cannot hold its breath) and ornament low (no fingers, only pins).
  //   hum (the slow singer): leans AUGMENT and INVERT — long tones and
  //     mirrors are what a voice without consonants can actually do; almost
  //     no filigree, almost no splintering — lungs favor the whole line.
  // ==========================================================================
  var VOICE_WEIGHTS = {
    pluck: {
      sequence: 3.5, transpose: 3, ornament: 2.5, invert: 2,
      fragmentHead: 1.5, fragmentTail: 1.5, retrograde: 1.5,
      diminish: 1, augment: 1,
    },
    musicbox: {
      fragmentHead: 3.5, diminish: 3, fragmentTail: 2.5, sequence: 2,
      transpose: 2, retrograde: 1.5, invert: 1, ornament: 0.8, augment: 0.4,
    },
    hum: {
      augment: 3.5, invert: 3, transpose: 2, retrograde: 1.5,
      fragmentTail: 1.2, sequence: 0.8, ornament: 0.5, diminish: 0.4,
      fragmentHead: 0.4,
    },
  };

  // SCENE_TILT — what the weather does to development:
  //   settling: ideas are STATED and stretched, not yet worked — augment and
  //     plain transposition up, all the busy operations (sequence, ornament,
  //     fragmentation) held back; the evening must learn its material first.
  //   chapter: the working weather — sequence leads (the reading gathers
  //     momentum by restatement), ornament and inversion open out.
  //   seizure: concentration — diminish and fragment surge (the idea turns
  //     faster and splinters, stretto without loudness); augment nearly off.
  //   reverie: memory — augment dominates (time dilates), inversion as the
  //     half-remembered mirror; nothing quickens in a reverie.
  //   candle-out: the idea comes apart — fragmentTail above all (endings
  //     outlive beginnings in a fading mind), augmented into the dark.
  var SCENE_TILT = {
    "settling": {
      augment: 1.4, transpose: 1.3, sequence: 0.5, ornament: 0.6,
      diminish: 0.5, fragmentHead: 0.6, fragmentTail: 0.6,
    },
    "chapter": { sequence: 1.5, ornament: 1.3, invert: 1.2, transpose: 1.1 },
    "seizure": {
      diminish: 1.8, fragmentHead: 1.6, fragmentTail: 1.4, sequence: 1.3,
      augment: 0.3, ornament: 0.5,
    },
    "reverie": {
      augment: 1.8, invert: 1.3, fragmentTail: 1.2, diminish: 0.4,
      sequence: 0.5,
    },
    "candle-out": {
      fragmentTail: 1.8, augment: 1.5, fragmentHead: 0.8, diminish: 0.5,
      sequence: 0.3, ornament: 0.3,
    },
  };

  // AFFINITY — pairs that compose well lean into each other (the sibling-
  // proven set, zankyo:640 / kolob:1379, plus one addition): a fragment
  // invites sequencing (a cell is FOR sequencing); an inversion wants to be
  // dwelt on (augment) or carried elsewhere (transpose); a sequence, having
  // doubled the material, wants to quicken it; an ornament wants room to
  // breathe after; and — new — a transposition invites a sequence, since a
  // line already moved once moves gracefully again.
  var AFFINITY = {
    fragmentHead: { sequence: 2.4, ornament: 1.6 },
    fragmentTail: { sequence: 2.4, ornament: 1.6 },
    invert:       { augment: 1.7, transpose: 1.5 },
    sequence:     { diminish: 1.6 },
    ornament:     { augment: 1.4 },
    transpose:    { sequence: 1.3 },
  };

  // THE REQUEST POLICY — which KIND of utterance each weather favors.
  // settling favors fresh (and the ghost, handled separately); chapters favor
  // develop/answer (the conversation); the seizure is develop-only on the
  // theme; reverie favors recall and (augment-tilted, via SCENE_TILT)
  // develop; candle-out favors recall-that-comes-apart.
  var KIND_POOLS = {
    "settling":   [["fresh", 5], ["recall", 2], ["develop", 2], ["answer", 1]],
    "chapter":    [["develop", 4], ["answer", 3], ["fresh", 2], ["recall", 1]],
    "seizure":    [["develop", 1]],
    "reverie":    [["recall", 3], ["develop", 3], ["fresh", 1], ["answer", 1]],
    "candle-out": [["recall", 4], ["develop", 1], ["answer", 1]],
  };
  // If "answer" is drawn but the ledger has nothing claimable, fall back to
  // the scene's second nature rather than re-rolling (one draw, one outcome —
  // keeps the stream honest).
  var ANSWER_FALLBACK = {
    "settling": "fresh", "chapter": "develop", "seizure": "develop",
    "reverie": "recall", "candle-out": "recall",
  };

  // Posting probabilities for the maybePost convenience (spec: ~0.35 in
  // chapters, less elsewhere; the seizure converses with no one).
  var POST_P = {
    "settling": 0.12, "chapter": 0.35, "seizure": 0,
    "reverie": 0.18, "candle-out": 0.08,
  };
  var POST_KINDS = [["imitate", 3], ["invert", 2], ["develop", 2]];

  // ==========================================================================
  // NAMES — a seeded syllable table. Recombinant Tempest: sometimes the dice
  // spell Miranda herself, mostly they spell her cousins ("Calorax",
  // "Sebella", "Trinis"). Names are dramaturgy for the event log and the
  // ghost's continuity — a listener can watch "Ferdina" survive the night.
  // ==========================================================================
  var SYL_HEAD = ["Mir", "Fer", "Ari", "Cal", "Ban", "Pro", "Syc", "Ste",
                  "Gon", "Seb", "Ant", "Alo", "Trin", "Ir"];
  var SYL_TAIL = ["anda", "dina", "el", "iban", "spera", "orax", "phano",
                  "zalo", "ella", "onio", "ina", "is", "ula", "eto"];

  var TRANSFORM_NAMES = ["invert", "retrograde", "transpose", "augment",
                         "diminish", "fragmentHead", "fragmentTail",
                         "sequence", "ornament"];

  // Chain links that are dialogue/genealogy MARKERS, not transforms — the
  // grammar's "never twice running" rule and the affinity lookup skip them.
  var MARKER_LINKS = {
    tether: 1, renewal: 1, ghost: 1, seed: 1, imitate: 1, develop: 1,
  };

  // ==========================================================================
  // SMALL PURE HELPERS
  // ==========================================================================
  function clone(m) { return JSON.parse(JSON.stringify(m)); }
  function clampN(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function beatsOf(m) {
    var b = 0;
    for (var i = 0; i < m.notes.length; i++) b += m.notes[i].durBeats;
    return b;
  }
  function isPalindromic(m) {
    var s = m.notes;
    for (var i = 0; i < s.length; i++) {
      if (s[i].deg !== s[s.length - 1 - i].deg) return false;
    }
    return true;
  }
  function lastRealLink(chain) {
    for (var i = chain.length - 1; i >= 0; i--) {
      if (!MARKER_LINKS[chain[i]]) return chain[i];
    }
    return null;
  }
  // Fold an absolute degree to its degree-class in [0, size).
  function foldDeg(deg, size) {
    var d = deg % size;
    return d < 0 ? d + size : d;
  }

  // The Library's improviser walk state seeds (v1 lineage: the box starts on
  // the fifth). Custom voices default to 0 unless their config says otherwise.
  var DEFAULT_WALK_START = { pluck: 0, musicbox: 4, hum: 0 };

  // ==========================================================================
  // create({ rng, field, harmony, voices?, policy? }) → Motif
  //
  // PHASE 3 ADDITION — the per-track door. voices and policy are OPTIONAL
  // and every key inside them is optional; this comment is the CONTRACT for
  // track builders (Sycorax and Ariel are the first two customers). With
  // neither passed, the engine is the Phase 2 Library, bit for bit.
  //
  //   voices = {
  //     <voiceName>: {
  //       table: [[w,...] x nRows],
  //         // First-order Markov walk table over degree classes (rows over
  //         // the mode's degrees, same shape as MELODY_MARKOV above; rows
  //         // needn't sum to 1 — the weighted draw normalizes). This is
  //         // where Sycorax authors the chant's reciting-tone self-weight
  //         // and Ariel ports ARIEL_WHISTLE_MARKOV et al.
  //       weights: { transformName: weight, ... },
  //         // Transform-choice row (composed with sceneTilt × affinity at
  //         // pick time, exactly like the built-in voices). Transform names
  //         // are TRANSFORM_NAMES; unknown names are simply never drawn.
  //       register: int,     // home octave offset for fresh() (default 0)
  //       walkStart: int,    // improviser walk seed class (default 0)
  //     }, ...
  //   }
  //
  //   Merge semantics: per-voice, per-key overlay over the built-ins — a
  //   `voices.pluck = {register: 1}` re-registers the pluck but keeps its
  //   table and weights. UNKNOWN voice names (not built-in, not in voices)
  //   work end-to-end by documented fallback: walk table MELODY_MARKOV,
  //   transform weights VOICE_WEIGHTS.pluck, register 0, walk seed 0 — every
  //   name is a legal speaker, configured or not (the waterphone needs no
  //   entry to talk; it only needs one to have a CHARACTER).
  //
  //   policy = {
  //     kindPools: { <sceneType>: [["fresh"|"develop"|"recall"|"answer", w], ...] },
  //       // Per-scene overlay over KIND_POOLS. Scenes NOT in the effective
  //       // map (neither built-in nor supplied) fall back to "chapter"'s
  //       // pool, as always. Ariel keys these by its own scene names
  //       // (song/flight/hover/swirl/release/alighting); Sycorax instead
  //       // aliases its scenes to the Library's five at the call site —
  //       // both are supported spellings of the same mechanism.
  //     answerFallback: { <sceneType>: kind },
  //       // What an unclaimable "answer" draw becomes (overlay; unknown
  //       // scenes default "develop").
  //     sceneTilt: { <sceneType>: { transformName: multiplier, ... } },
  //       // Development-weather overlay over SCENE_TILT (unknown scenes:
  //       // no tilt), so custom scene names shape transforms too.
  //     transformTilt: fn(ropts) -> { transformName: multiplier, ... } | null,
  //       // DYNAMIC transform weather, composed multiplicatively AFTER
  //       // sceneTilt × affinity. Called once per request() with the raw
  //       // request opts (whatever extra fields the caller passed — e.g.
  //       // the Library hands opusPos, its 0..1 evening progress, so the
  //       // alchemical refinement arc can bias dark operations early and
  //       // luminous ones late). MUST be pure (no rng, no clock): it runs
  //       // inside the seeded stream and consumes NO draws — pickW costs
  //       // one draw regardless of weights, so determinism is untouched.
  //     postP: { <sceneType>: p },
  //       // maybePost probability overlay over POST_P (unknown scenes 0.15).
  //     postKinds: [["imitate"|"invert"|"develop", w], ...],
  //       // Replaces POST_KINDS. Sycorax's responsorial cantor:
  //       // [["imitate", 6], ["invert", 2], ["develop", 2]].
  //     postDeadlineS: [loS, hiS],
  //       // maybePost deadline draw range. Default [10, 24]; Sycorax posts
  //       // long ([18, 40]) — answers arrive late, across the clearing.
  //     seedVoices: { theme: voiceName, subs: [voiceName, ...] },
  //       // Who improvises the working set at newPerformance. Default
  //       // {theme: "pluck", subs: ["musicbox", "hum"]} keeps the Library's
  //       // exact branch (when a ghost is pending, the LAST default sub is
  //       // never drawn — the ghost takes that chair; bit-identity). With a
  //       // CUSTOM seedVoices, ALL listed subs are drawn fresh and a
  //       // pending ghost then takes one more chair (or displaces the last
  //       // if the set is full) — so Sycorax's {theme: "chant",
  //       // subs: ["rebec"]} yields chant + rebec + ghost on ghost nights
  //       // and chant + rebec otherwise. Length draws: theme rint(5, 6|7
  //       // by tide) as ever; subs rint(4,6) for the first, rint(3,5) after.
  //     ghostScene: sceneType,
  //       // The scene type that is the ghost's one statement window
  //       // (default "settling"; Ariel passes "alighting"). Any request
  //       // with a DIFFERENT sceneType permanently closes the window for
  //       // the performance, exactly like leaving settling does today.
  //     focusScenes: [sceneType, ...],
  //       // Scenes that CONCENTRATE like the seizure: develop works the
  //       // THEME only, single transform links (REPLACES the default
  //       // ["seizure"] — include "seizure" yourself if you still want it;
  //       // Ariel passes ["swirl"]). Note the candle-out recall-comes-apart
  //       // behavior stays keyed to the literal "candle-out" scene name —
  //       // tracks that want it (Sycorax's afterimage) alias to
  //       // "candle-out" at the call site.
  //   }
  //
  //   SCENE-NAME RECOGNITION (binding, easy to trip on): a request's
  //   sceneType is normalized FIRST — any type absent from the effective
  //   kindPools map becomes "chapter" before EVERY downstream lookup
  //   (kind pool, sceneTilt, focusScenes, ghostScene window). maybePost is
  //   the one exception: it is not request-driven, so postP reads the RAW
  //   sceneType you hand it (unknown -> 0.15). A scene name you use in sceneTilt /
  //   focusScenes / ghostScene MUST also have a kind-pool row (built-in or
  //   yours), or it is never seen. This is the Library's existing unknown-
  //   scene fallback, kept bit-identical; it is also why Sycorax can alias
  //   its scenes to the Library's five at the call site and pass no
  //   kindPools at all.
  //
  // Draw discipline: voices/policy change WHICH tables the draws consult,
  // never how many draws an operation costs — so per-track determinism
  // behaves exactly like the Library's.
  // ==========================================================================
  function create(opts) {
    opts = opts || {};
    var rng = opts.rng;
    if (!rng || typeof rng.next !== "function") {
      // Misuse at build time is a programmer error and may throw (the Pitch
      // convention). Runtime — request() and friends — never throws.
      throw new Error("PJ2.Motif: create needs an rng stream");
    }
    var field = opts.field || null;      // used ONLY for .size (fold modulus)
    var harmony = opts.harmony || null;  // §7b contract, read defensively

    // ------------------------------------------------------------------
    // Per-track configuration (see the contract doc block above). All the
    // effective-lookup helpers below are DRAWLESS — configuration must
    // never cost stream position.
    // ------------------------------------------------------------------
    var voices = opts.voices || null;
    var policy = opts.policy || null;
    if (voices) {
      for (var vn in voices) {
        var vc = voices[vn];
        if (vc && vc.table != null) {
          if (Object.prototype.toString.call(vc.table) !== "[object Array]" ||
              !vc.table.length ||
              Object.prototype.toString.call(vc.table[0]) !== "[object Array]") {
            throw new Error("PJ2.Motif: voices." + vn + ".table must be an array of weight rows");
          }
        }
      }
    }
    function overlay(base, over) {
      if (!over) return base;
      var out = {}, k;
      for (k in base) out[k] = base[k];
      for (k in over) out[k] = over[k];
      return out;
    }
    var effPools    = overlay(KIND_POOLS, policy && policy.kindPools);
    var effTilt     = overlay(SCENE_TILT, policy && policy.sceneTilt);
    var effFallback = overlay(ANSWER_FALLBACK, policy && policy.answerFallback);
    var effPostP    = overlay(POST_P, policy && policy.postP);
    var effPostKinds = (policy && policy.postKinds) || POST_KINDS;
    var effDeadlineS = (policy && policy.postDeadlineS) || [10, 24];
    var ghostScene  = (policy && policy.ghostScene) || "settling";
    var seedVoices  = (policy && policy.seedVoices) || null;
    var focusScenes = { seizure: true };
    if (policy && policy.focusScenes) {
      focusScenes = {};
      for (var fi = 0; fi < policy.focusScenes.length; fi++) {
        focusScenes[policy.focusScenes[fi]] = true;
      }
    }
    function isFocus(sceneType) { return !!focusScenes[sceneType]; }
    function voiceCfg(v) { return (voices && voices[v]) || null; }
    function tableOf(v) {
      var c = voiceCfg(v);
      return (c && c.table) || VOICE_TABLES[v] || MELODY_MARKOV;
    }
    function weightsOf(v) {
      var c = voiceCfg(v);
      return (c && c.weights) || VOICE_WEIGHTS[v] || VOICE_WEIGHTS.pluck;
    }
    function registerOf(v) {
      var c = voiceCfg(v);
      if (c && c.register != null && isFinite(c.register)) return Math.round(c.register);
      return VOICE_REGISTER[v] || 0;
    }
    function walkStartOf(v) {
      var c = voiceCfg(v);
      if (c && c.walkStart != null && isFinite(c.walkStart)) return Math.round(c.walkStart);
      return DEFAULT_WALK_START[v] || 0;
    }
    // The improviser walk seeds — the Library's exact object when no voices
    // are configured; configured voices join it with their own seeds.
    function freshWalkState() {
      var w = { pluck: 0, musicbox: 4, hum: 0 };
      if (voices) { for (var v in voices) w[v] = walkStartOf(v); }
      return w;
    }

    // ------------------------------------------------------------------
    // STATE — one performance's mind.
    // ------------------------------------------------------------------
    var working = { theme: null, subs: [] };  // ≤ 3 ideas, always (kolob's discipline)
    var lineage = {};       // name → deepest living descendant (a clone)
    var reqTilt = null;     // per-request dynamic transform weather (policy.transformTilt)
    var ledger = [];        // [{from, to:"any", kind, motif, deadlineS}]
    var walkCls = freshWalkState();           // improviser walk state
    var usedNames = {};     // per-performance name uniqueness
    var nameSerial = 0;

    // Ghost machinery: pendingGhost waits for the next newPerformance;
    // ghostArmed/-Will govern the one settling statement.
    var pendingGhost = null;
    var ghostArmed = false;
    var ghostWill = false;
    var ghostName = null;
    var leftSettling = false;  // true once the performance's first settling has passed

    var stats = {
      developments: 0, answers: 0, renewals: 0, maxGen: 0,
      transformCounts: {}, kindCounts: {}, ghostCarried: false,
    };

    // ------------------------------------------------------------------
    // Defensive reads of the parallel-built neighbors. Everything falls
    // back to a sane dorian-tonic world so this module keeps composing
    // even if harmony is absent, half-built, or mid-sea-change.
    // ------------------------------------------------------------------
    function fieldSize() {
      try {
        if (field && typeof field.size === "number" && field.size >= 1) {
          return field.size;
        }
      } catch (e) {}
      return 7;
    }
    function chordClasses() {
      var size = fieldSize();
      try {
        var cur = harmony.current();
        if (cur && cur.chordDegs && cur.chordDegs.length) {
          var out = [];
          for (var i = 0; i < cur.chordDegs.length; i++) {
            out.push(foldDeg(cur.chordDegs[i], size));
          }
          return out;
        }
      } catch (e) {}
      return [0, foldDeg(2, size), foldDeg(4, size)];  // the tonic triad
    }
    function resolutionClasses() {
      var size = fieldSize();
      try {
        var degs = harmony.resolutionDegs();
        if (degs && degs.length) {
          var out = [];
          for (var i = 0; i < degs.length; i++) out.push(foldDeg(degs[i], size));
          return out;
        }
      } catch (e) {}
      return chordClasses();
    }
    function biasBase() {
      try {
        var b = harmony.biasBase();
        if (typeof b === "number" && isFinite(b) && b > 0) return b;
      } catch (e) {}
      return 1.8;  // v1's HARMONIC_BIAS_BASE — the documented default
    }

    // ------------------------------------------------------------------
    // THE IMPROVISER — chord-biased Markov walk (v1's markovNextChordBiased,
    // audio.js:507-526, on the injected stream instead of raw dice).
    // ------------------------------------------------------------------
    function markovBiased(row, chordSet, bias) {
      var total = 0, i, w;
      var weighted = [];
      for (i = 0; i < row.length; i++) {
        w = row[i];
        if (chordSet && chordSet.indexOf(i) >= 0) w *= bias;
        weighted.push(w);
        total += w;
      }
      if (total <= 0) return 0;
      var r = rng.next() * total;
      for (i = 0; i < weighted.length; i++) {
        r -= weighted[i];
        if (r <= 0) return i;
      }
      return weighted.length - 1;
    }
    // Nearest member of `classes` to `cls` in table-index space (v1's
    // nearestChordTone). Ties break downward — resolution falls, mostly.
    function nearestClass(cls, classes) {
      if (!classes || !classes.length) return cls;
      var best = classes[0], bestD = Math.abs(classes[0] - cls);
      for (var i = 1; i < classes.length; i++) {
        var d = Math.abs(classes[i] - cls);
        if (d < bestD || (d === bestD && classes[i] < best)) {
          best = classes[i]; bestD = d;
        }
      }
      return best;
    }
    // Phrase-ending draw: strong chord bias + coin-flip force-snap — v1's
    // resolveDegree behavior, verbatim in spirit.
    function resolveClass(cls, row, resSet) {
      var next = markovBiased(row, resSet, BIAS_RESOLUTION);
      if (resSet && resSet.length && rng.chance(RESOLUTION_FORCE_P)) {
        next = nearestClass(next, resSet);
      }
      return next;
    }

    function drawName() {
      for (var tries = 0; tries < 4; tries++) {
        var nm = rng.pick(SYL_HEAD) + rng.pick(SYL_TAIL);
        if (!usedNames[nm]) { usedNames[nm] = 1; return nm; }
      }
      nameSerial++;
      var nm2 = rng.pick(SYL_HEAD) + rng.pick(SYL_TAIL) + "·" + nameSerial;
      usedNames[nm2] = 1;
      return nm2;
    }

    // fresh(voiceName, {len, register}) → a NEW gen-0 motif from the voice's
    // table. register is an octave offset (integer); default is the voice's
    // home register. The walk state persists across calls — v1's melodies
    // continued where they left off, and that continuity is part of the sound.
    function fresh(voiceName, fopts) {
      fopts = fopts || {};
      var table = tableOf(voiceName);
      var size = fieldSize();
      var len = (typeof fopts.len === "number" && isFinite(fopts.len))
        ? Math.round(fopts.len) : rng.rint(4, 7);
      len = clampN(len, 3, 12);
      var regOct = (fopts.register != null && isFinite(fopts.register))
        ? Math.round(fopts.register)
        : registerOf(voiceName);
      var offset = regOct * size;

      var chord = chordClasses();
      var bias = biasBase();
      var resSet = resolutionClasses();
      var cls = walkCls[voiceName];
      if (typeof cls !== "number" || cls < 0 || cls >= table.length) {
        cls = walkStartOf(voiceName);
        if (cls < 0 || cls >= table.length) cls = 0;
      }

      var notes = [];
      for (var i = 0; i < len; i++) {
        cls = (i === len - 1)
          ? resolveClass(cls, table[cls], resSet)   // the ending resolves
          : markovBiased(table[cls], chord, bias);  // the walk leans gently
        var dur = rng.pickW(BEAT_CELLS);
        notes.push({ deg: cls + offset, durBeats: dur });
      }
      // The held final — a singer's instinct even in a mechanism.
      if (rng.chance(HELD_FINAL_P)) {
        var f = notes[notes.length - 1];
        f.durBeats = Math.min(4, f.durBeats * rng.pick([1.5, 2]));
      }
      walkCls[voiceName] = cls;
      return { name: drawName(), gen: 0, chain: [], notes: notes };
    }

    // ------------------------------------------------------------------
    // THE TRANSFORM ALGEBRA. Each function mutates a motif the CALLER has
    // already cloned (develop/applyTransform own the clone-and-chain
    // ceremony). All numeric draws come from the stream.
    // ------------------------------------------------------------------
    var TRANSFORMS = {
      invert: function (m) {              // mirror on the first degree
        var axis = m.notes[0].deg;
        for (var i = 0; i < m.notes.length; i++) {
          m.notes[i].deg = axis - (m.notes[i].deg - axis);
        }
        return m;
      },
      retrograde: function (m) {          // the crab
        m.notes.reverse();
        return m;
      },
      transpose: function (m) {           // ±1–3 scale DEGREES — pitch content
        var by = rng.pickW([[1, 3], [2, 3], [-1, 3], [-2, 2], [3, 1], [-3, 1]]);
        for (var i = 0; i < m.notes.length; i++) m.notes[i].deg += by;
        return m;
      },
      augment: function (m) {             // time dilates
        var f = rng.rnd(1.35, 1.9);
        for (var i = 0; i < m.notes.length; i++) {
          m.notes[i].durBeats = Math.min(NOTE_BEAT_CEIL, m.notes[i].durBeats * f);
        }
        return m;
      },
      diminish: function (m) {            // time quickens
        var f = rng.rnd(0.5, 0.72);
        for (var i = 0; i < m.notes.length; i++) {
          m.notes[i].durBeats = Math.max(0.3, m.notes[i].durBeats * f);
        }
        return m;
      },
      fragmentHead: function (m) {        // keep the opening
        m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      fragmentTail: function (m) {        // keep the ending
        m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      sequence: function (m) {            // restate at a transposition
        var step = rng.pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = [];
        for (var i = 0; i < m.notes.length; i++) {
          rep.push({ deg: m.notes[i].deg + step, durBeats: m.notes[i].durBeats });
        }
        m.notes = m.notes.concat(rep).slice(0, 12);  // runaway guard
        return m;
      },
      ornament: function (m) {            // neighbor-tone turn between leaps
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 &&
              n.durBeats >= 1 && rng.chance(0.6)) {
            res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
            res.push({
              deg: n.deg + (nx.deg > n.deg ? 1 : -1),
              durBeats: Math.max(0.35, n.durBeats * 0.35),
            });
          } else {
            res.push({ deg: n.deg, durBeats: n.durBeats });
          }
        }
        m.notes = res;
        return m;
      },
    };

    // Legality guards (the kolob:1397 pattern) — these are what make a
    // thousand-generation evening structurally IMPOSSIBLE to break:
    //   no transform twice running (invert∘invert is a no-op, and even
    //   augment∘augment is just a slower augment); no fragmenting below the
    //   floor; sequence/ornament refuse already-long material; retrograde
    //   refuses palindromes (another no-op); augment refuses past the beat
    //   ceiling; diminish refuses what is already a flicker.
    function allowedTransform(name, m, chain) {
      var len = m.notes.length;
      if (name === lastRealLink(chain)) return false;
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;
        var frags = 0;
        for (var i = 0; i < chain.length; i++) {
          if (chain[i].indexOf("fragment") === 0) frags++;
        }
        if (frags >= 1 && len <= 6) return false;  // a fragment of a fragment is dust
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false;
      if (name === "augment" && beatsOf(m) > AUGMENT_BEAT_CEIL) return false;
      if (name === "diminish" && beatsOf(m) < 2.5) return false;
      return true;
    }

    function pickTransform(voiceName, m, chain, sceneType) {
      var w = weightsOf(voiceName);
      var tilt = effTilt[sceneType] || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1);
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        // Dynamic weather from policy.transformTilt (set per-request) — the
        // refinement arc: the same idea is worked with heavier hands early
        // in the evening and lighter ones late. Zero extra draws.
        if (reqTilt && reqTilt[name]) wt *= reqTilt[name];
        pool.push([name, wt]);
      }
      return pool.length ? rng.pickW(pool) : null;
    }

    function countTransform(name) {
      stats.transformCounts[name] = (stats.transformCounts[name] || 0) + 1;
    }

    // Keep the centre of mass near the home octave by WHOLE octaves —
    // internal intervals untouched, the contour survives; voices re-register
    // at render. Uses the LIVE fold modulus, so a sea change into a mode of
    // another size still recentres correctly.
    function recentre(m) {
      if (!m.notes.length) return m;
      var size = fieldSize();
      var sum = 0;
      for (var i = 0; i < m.notes.length; i++) sum += m.notes[i].deg;
      var mean = sum / m.notes.length;
      while (mean > size + 2) {
        for (i = 0; i < m.notes.length; i++) m.notes[i].deg -= size;
        mean -= size;
      }
      while (mean < -2) {
        for (i = 0; i < m.notes.length; i++) m.notes[i].deg += size;
        mean += size;
      }
      return m;
    }

    // ------------------------------------------------------------------
    // GENEALOGY — ancestors, the lineage, the tether, renewal.
    // ------------------------------------------------------------------
    function ancestorOf(name) {
      if (working.theme && working.theme.name === name) return working.theme;
      for (var i = 0; i < working.subs.length; i++) {
        if (working.subs[i] && working.subs[i].name === name) return working.subs[i];
      }
      return working.theme;  // orphans adopt the theme (sibling precedent)
    }
    // remember() is called by request() AFTER the outgoing resolution nudge,
    // so the lineage holds motifs AS HEARD — the ghost extracted later is a
    // memory of what actually sounded, not of a draft.
    function remember(m) {
      var cur = lineage[m.name];
      if (!cur || m.gen >= cur.gen) lineage[m.name] = clone(m);
      if (m.gen > stats.maxGen) stats.maxGen = m.gen;
    }
    // Identity tether: every 3rd generation, graft the ancestor's first 3–4
    // notes back onto the head. Development may wander the whole evening;
    // the head-motive keeps returning, and that is why a listener can still
    // name the idea at gen 8. The graft meets the descendant's register by
    // whole octaves.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc || !anc.notes.length || !m.notes.length) return m;
      var size = fieldSize();
      var src = clone(anc).notes;
      var shift = Math.round((m.notes[0].deg - src[0].deg) / size) * size;
      for (var i = 0; i < src.length; i++) src[i].deg += shift;
      var k = Math.min(rng.rint(3, 4), src.length, Math.max(1, m.notes.length - 1));
      m.notes = src.slice(0, k).concat(m.notes.slice(k));
      m.chain = m.chain.concat(["tether"]);
      countTransform("tether");
      return m;
    }
    // develop: continue the line from its deepest living descendant with 1–2
    // guarded transforms. Renewal first: a line at gen ≥ 9 returns to its
    // ancestor VERBATIM (gen resets) — identity over archaeology; ledger
    // ping-pong otherwise compounds generations into the twenties.
    function develop(voiceName, base, maxLinks, sceneType) {
      if (base.gen >= RENEWAL_GEN) {
        var anc = ancestorOf(base.name);
        if (anc) {
          var re = clone(anc);
          re.gen = 0;
          re.chain = anc.chain.concat(["renewal"]);
          lineage[base.name] = clone(re);   // the lineage starts over too
          stats.renewals++;
          countTransform("renewal");
          return re;
        }
      }
      var out = clone(base);
      var links = (maxLinks && maxLinks < 2) ? 1 : rng.rint(1, maxLinks || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voiceName, out, out.chain.concat(used), sceneType);
        if (!name) break;
        out = TRANSFORMS[name](out);
        used.push(name);
        countTransform(name);
      }
      if (!used.length) {                  // grammar cornered — transposition always speaks
        out = TRANSFORMS.transpose(out);
        used.push("transpose");
        countTransform("transpose");
      }
      out.gen = base.gen + 1;
      out.chain = base.chain.concat(used);
      if (out.gen >= TETHER_EVERY && out.gen % TETHER_EVERY === 0) out = tether(out);
      recentre(out);
      stats.developments++;
      return out;
    }

    // Which working idea to develop/recall: the seizure concentrates on the
    // THEME (spec, binding); elsewhere the theme leads but the subsidiaries
    // get real airtime. Continues from the deepest living descendant.
    function pickWorking(sceneType) {
      var m;
      if (isFocus(sceneType) || !working.subs.length) {
        m = working.theme;
      } else {
        var pool = [[working.theme, 3]];
        if (working.subs[0]) pool.push([working.subs[0], 2]);
        if (working.subs[1]) pool.push([working.subs[1], 2]);
        m = rng.pickW(pool);
      }
      if (!m) m = working.theme;
      var line = m && lineage[m.name];
      return (line && line.gen > 0) ? line : m;
    }

    // recall: the idea near-verbatim — sometimes the ancestor (reminiscence),
    // sometimes the deepest descendant (what the evening has made of it). In
    // candle-out the recalled idea COMES APART: its tail fragment, honestly
    // chained, is what remains.
    function recallOf(sceneType) {
      var anc = ancestorOf(pickWorking(sceneType).name);
      var line = anc && lineage[anc.name];
      var base = (line && line.gen > 0 && rng.chance(0.5)) ? line : anc;
      var out = clone(base || fallbackMotif());
      if (sceneType === "candle-out" && out.notes.length > 3) {
        out = TRANSFORMS.fragmentTail(out);
        out.gen = out.gen + 1;
        out.chain = out.chain.concat(["fragmentTail"]);
        countTransform("fragmentTail");
      }
      return out;
    }

    // ------------------------------------------------------------------
    // THE LEDGER — dialogue with deadlines. Phase 2 keeps addressing simple:
    // everything is posted "to any", claimable by any voice but the poster.
    // An obligation past its deadline MUST be taken by the next requester —
    // call-and-response has to be audible, not theoretical.
    // ------------------------------------------------------------------
    function post(from, kind, motif, deadlineS) {
      if (!motif || !motif.notes || !motif.notes.length) return;
      if (kind !== "imitate" && kind !== "invert" && kind !== "develop") kind = "imitate";
      ledger.push({
        from: String(from), to: "any", kind: kind,
        motif: clone(motif),
        deadlineS: (typeof deadlineS === "number" && isFinite(deadlineS)) ? deadlineS : 0,
      });
      if (ledger.length > LEDGER_CAP) ledger.shift();  // the oldest is forgiven
    }
    // maybePost — the spec's "voices post with probability after a statement"
    // in one call, so the library needn't own the numbers. Returns true if
    // an obligation was posted.
    function maybePost(from, motif, o) {
      o = o || {};
      var p = effPostP[o.sceneType];
      if (p == null) p = 0.15;
      if (!rng.chance(p)) return false;
      var nowS = (typeof o.nowS === "number") ? o.nowS : 0;
      post(from, rng.pickW(effPostKinds), motif,
           nowS + rng.rnd(effDeadlineS[0], effDeadlineS[1]));
      return true;
    }
    // takeObligation: overdue first (oldest deadline), else — when allowed —
    // the oldest claimable. Never the caller's own posting.
    function takeObligation(voiceName, nowS, overdueOnly) {
      var idx = -1, i;
      for (i = 0; i < ledger.length; i++) {
        if (ledger[i].from === voiceName) continue;
        if (nowS > ledger[i].deadlineS) {
          if (idx < 0 || ledger[i].deadlineS < ledger[idx].deadlineS) idx = i;
        }
      }
      if (idx < 0 && !overdueOnly) {
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voiceName) { idx = i; break; }
        }
      }
      if (idx < 0) return null;
      var ob = ledger.splice(idx, 1)[0];
      ob.overdue = nowS > ob.deadlineS;
      return ob;
    }
    function claim(voiceName, nowS) {
      return takeObligation(String(voiceName), (typeof nowS === "number") ? nowS : 0, false);
    }
    function overdueFor(voiceName, nowS) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].from !== voiceName && nowS > ledger[i].deadlineS) return true;
      }
      return false;
    }
    // An answer applies the obligation's kind to the posted motif. The chain
    // records the DIALOGUE ACT as its final link (the harness asserts this):
    //   imitate — the echo: notes verbatim, one generation on;
    //   invert  — the mirror: literally TRANSFORMS.invert (if the call was
    //             itself a mirror, mirroring back reads as recognition — a
    //             no-op relative to the grand-ancestor is fine in dialogue);
    //   develop — one guarded transform, chained as "develop" (the act, not
    //             the mechanism, is what the conversation logged).
    function answerObligation(voiceName, ob, sceneType) {
      var base = ob.motif;
      if (base.gen >= RENEWAL_GEN) {           // renewal applies to answers too
        var anc = ancestorOf(base.name);
        if (anc) base = clone(anc);
      }
      var ans = clone(base);
      if (ob.kind === "invert") {
        ans = TRANSFORMS.invert(ans);
        countTransform("invert");
      } else if (ob.kind === "develop") {
        var name = pickTransform(voiceName, ans, ans.chain, sceneType);
        if (!name) name = "transpose";
        ans = TRANSFORMS[name](ans);
        countTransform(name);
      }
      // imitate: notes untouched — the echo.
      ans.gen = base.gen + 1;
      ans.chain = base.chain.concat([ob.kind]);
      recentre(ans);
      stats.answers++;
      return ans;
    }

    // ------------------------------------------------------------------
    // OUTGOING RESOLUTION — the last note of every spoken motif leans onto
    // the current chord (reads resolutionDegs at USE time, so a sea change
    // between two requests is automatically honored). Ghosts are exempt: a
    // half-remembered thing does not resolve, it just stops.
    // ------------------------------------------------------------------
    function nearestDegOfClasses(deg, classes, size) {
      var best = deg, bestD = Infinity;
      for (var k = deg - size; k <= deg + size; k++) {
        if (classes.indexOf(foldDeg(k, size)) < 0) continue;
        var d = Math.abs(k - deg);
        if (d < bestD || (d === bestD && k < best)) { best = k; bestD = d; }
      }
      return best;
    }
    function resolveOutgoing(m) {
      if (!m.notes.length) return m;
      var size = fieldSize();
      var res = resolutionClasses();
      var last = m.notes[m.notes.length - 1];
      if (res.indexOf(foldDeg(last.deg, size)) >= 0) return m;
      if (!rng.chance(OUTGOING_SNAP_P)) return m;   // sometimes it hangs — human
      last.deg = nearestDegOfClasses(last.deg, res, size);
      return m;
    }

    // ------------------------------------------------------------------
    // THE SAFETY NET — sanitize() makes "request always returns a playable
    // motif" a structural fact, not a hope. Degrees become finite integers,
    // durations live in [0.25, 6] beats, note count ≤ 14, total ≤ 20 beats
    // (rescaled, never truncated mid-phrase), and an empty husk becomes the
    // tonic-triad fallback. Idempotent on anything already legal.
    // ------------------------------------------------------------------
    function fallbackMotif() {
      return {
        name: "anon", gen: 0, chain: [],
        notes: [{ deg: 0, durBeats: 1 }, { deg: 2, durBeats: 1 }, { deg: 4, durBeats: 2 }],
      };
    }
    function sanitize(m) {
      if (!m || Object.prototype.toString.call(m.notes) !== "[object Array]" || !m.notes.length) {
        m = fallbackMotif();
      }
      if (typeof m.name !== "string") m.name = "anon";
      if (typeof m.gen !== "number" || !isFinite(m.gen) || m.gen < 0) m.gen = 0;
      m.gen = Math.round(m.gen);
      if (Object.prototype.toString.call(m.chain) !== "[object Array]") m.chain = [];
      if (m.notes.length > HARD_NOTE_CEIL) m.notes = m.notes.slice(0, HARD_NOTE_CEIL);
      var total = 0, i, n;
      for (i = 0; i < m.notes.length; i++) {
        n = m.notes[i];
        n.deg = (typeof n.deg === "number" && isFinite(n.deg)) ? Math.round(n.deg) : 0;
        n.durBeats = (typeof n.durBeats === "number" && isFinite(n.durBeats))
          ? clampN(n.durBeats, NOTE_BEAT_FLOOR, NOTE_BEAT_CEIL) : 1;
        total += n.durBeats;
      }
      if (total > HARD_BEAT_CEIL) {
        var k = HARD_BEAT_CEIL / total;
        for (i = 0; i < m.notes.length; i++) {
          m.notes[i].durBeats = Math.max(NOTE_BEAT_FLOOR, m.notes[i].durBeats * k);
        }
      }
      return m;
    }

    // ------------------------------------------------------------------
    // THE WORKING SET — newPerformance seeds ≤ 3 ideas. The seeds themselves
    // are IMPROVISED (fresh Markov walks, one per character) — v2's evenings
    // have no fixed gesture pool; the improviser births what the composer
    // works, one fabric. The ghost, when one is carried, takes a subsidiary's
    // chair instead of a fresh draw.
    // ------------------------------------------------------------------
    function seatGhost() {
      if (!pendingGhost) return false;
      var g = {
        name: pendingGhost.name, gen: 0, chain: ["ghost"],
        notes: clone(pendingGhost.notes),
      };
      if (working.subs.length >= 2) working.subs[working.subs.length - 1] = g;
      else working.subs.push(g);
      usedNames[g.name] = 1;
      ghostArmed = true;
      ghostWill = rng.chance(GHOST_STATE_P);
      ghostName = g.name;
      stats.ghostCarried = true;
      pendingGhost = null;
      return true;
    }

    function newPerformance(tidePos) {
      var tp = (typeof tidePos === "number" && isFinite(tidePos)) ? clampN(tidePos, 0, 1) : 0;
      ledger.length = 0;
      lineage = {};
      usedNames = {};
      nameSerial = 0;
      walkCls = freshWalkState();
      ghostArmed = false;
      ghostWill = false;
      ghostName = null;
      leftSettling = false;
      stats.ghostCarried = false;

      if (seedVoices) {
        // Per-track working set (see the contract doc block): the theme from
        // the track's principal speaker, then EVERY listed subsidiary drawn
        // fresh; a pending ghost takes one more chair afterward (seatGhost
        // pushes if a chair is free, else displaces the last). Length draws
        // mirror the Library's so the set has the same proportions.
        working.theme = sanitize(fresh(seedVoices.theme || "pluck",
          { len: rng.rint(5, tp > 0.5 ? 7 : 6) }));
        working.subs = [];
        var sv = seedVoices.subs || [];
        for (var svi = 0; svi < sv.length && working.subs.length < 2; svi++) {
          working.subs.push(sanitize(fresh(sv[svi],
            { len: (svi === 0) ? rng.rint(4, 6) : rng.rint(3, 5) })));
        }
        if (pendingGhost) seatGhost();
      } else {
        // The theme is the pluck's idea (the principal reader speaks first);
        // stormy tides draw slightly longer themes — more to say, more night
        // to say it in. Subsidiaries come from the other two characters, so
        // the working set spans the registers from birth.
        working.theme = sanitize(fresh("pluck", { len: rng.rint(5, tp > 0.5 ? 7 : 6) }));
        working.subs = [sanitize(fresh("musicbox", { len: rng.rint(4, 6) }))];
        if (pendingGhost) {
          seatGhost();
        } else {
          working.subs.push(sanitize(fresh("hum", { len: rng.rint(3, 5) })));
        }
      }
      return {
        theme: clone(working.theme),
        subs: clone(working.subs),
        ghostSeated: !!ghostName,
      };
    }
    function ensureWorking() {
      if (!working.theme) newPerformance(0);
    }

    // ------------------------------------------------------------------
    // THE GHOST — extract at performance end, seed into the next. The
    // extract is the HEAD (3–5 notes) of the deepest-developed motif, its
    // durations normalized to mean 1 beat (a memory keeps the contour, not
    // the pacing), or null if nothing reached gen ≥ 2 — a shallow evening
    // leaves nothing behind. NOTE: extract BEFORE newPerformance; the reset
    // clears the lineage the ghost is drawn from.
    // ------------------------------------------------------------------
    function extractGhost() {
      var deepest = null;
      for (var k in lineage) {
        if (lineage[k] && lineage[k].gen >= 2 &&
            (!deepest || lineage[k].gen > deepest.gen)) {
          deepest = lineage[k];
        }
      }
      if (!deepest || !deepest.notes.length) return null;
      var take = Math.min(deepest.notes.length, rng.rint(3, 5));
      var notes = clone(deepest).notes.slice(0, take);
      var sum = 0, i;
      for (i = 0; i < notes.length; i++) sum += notes[i].durBeats;
      var mean = sum / notes.length || 1;
      for (i = 0; i < notes.length; i++) {
        notes[i].durBeats = clampN(notes[i].durBeats / mean, 0.5, 3);
      }
      return { name: deepest.name, sourceGen: deepest.gen, notes: notes };
    }
    function seedGhost(ghost) {
      if (!ghost || !ghost.notes || !ghost.notes.length) return false;
      pendingGhost = {
        name: String(ghost.name || "ghost"),
        notes: clone(ghost.notes),
        sourceGen: ghost.sourceGen || 0,
      };
      // Called after newPerformance? Seat it now. Called before? It waits.
      if (working.theme) return seatGhost();
      return true;
    }
    function findGhostSub() {
      for (var i = 0; i < working.subs.length; i++) {
        if (working.subs[i] && working.subs[i].name === ghostName) return working.subs[i];
      }
      return null;
    }

    // ------------------------------------------------------------------
    // request(voiceName, {sceneType, x, tidePos, nowS}) → {motif, kind}
    //
    // The policy, in priority order:
    //   1. the ghost — once, in the first settling, if armed and willing;
    //   2. an OVERDUE ledger obligation — MUST be answered before anything
    //      new (the next speaker takes it, whoever that is);
    //   3. a scene-weighted kind: fresh / develop / recall / answer.
    // Always returns a playable motif — a deep clone, sanitized, its ending
    // resolved onto the current chord (ghost excepted). Never null, never
    // throws in normal operation.
    // ------------------------------------------------------------------
    function request(voiceName, ropts) {
      voiceName = String(voiceName || "pluck");
      ropts = ropts || {};
      // Dynamic transform weather for this request (see policy doc). Pure
      // function of the caller's opts; never draws. Cleared implicitly by
      // being recomputed at every request.
      reqTilt = null;
      if (policy && typeof policy.transformTilt === "function") {
        try { reqTilt = policy.transformTilt(ropts) || null; } catch (eT) { reqTilt = null; }
      }
      var sceneType = effPools[ropts.sceneType] ? ropts.sceneType : "chapter";
      var nowS = (typeof ropts.nowS === "number" && isFinite(ropts.nowS)) ? ropts.nowS : 0;
      var out, kind;
      try {
        ensureWorking();

        // The ghost's window is the performance's FIRST ghost-scene
        // (Library: settling; tracks may rename it via policy.ghostScene).
        if (sceneType !== ghostScene) {
          leftSettling = true;
          ghostArmed = false;
        }
        if (ghostArmed && ghostWill && !leftSettling && sceneType === ghostScene) {
          var gm = findGhostSub();
          ghostArmed = false;             // once — then it lives or dies by policy
          if (gm) {
            kind = "ghost";
            out = sanitize(clone(gm));    // NOT chord-resolved: memories don't cadence
            stats.kindCounts.ghost = (stats.kindCounts.ghost || 0) + 1;
            return { motif: out, kind: kind };
          }
        }

        // The ledger outranks everything else once a deadline has passed.
        var ob = takeObligation(voiceName, nowS, true);
        if (ob) {
          kind = "answer";
          out = answerObligation(voiceName, ob, sceneType);
        } else {
          kind = rng.pickW(effPools[sceneType]);
          if (kind === "answer") {
            ob = takeObligation(voiceName, nowS, false);
            if (ob) out = answerObligation(voiceName, ob, sceneType);
            else kind = effFallback[sceneType] || "develop";
          }
          if (!out) {
            if (kind === "fresh") {
              // Fresh utterances are ephemeral — the evening's IDEAS stay the
              // seeded ≤3; noodling doesn't crowd the working set.
              out = fresh(voiceName, {});
            } else if (kind === "recall") {
              out = recallOf(sceneType);
            } else {  // develop
              out = develop(voiceName, pickWorking(sceneType),
                            isFocus(sceneType) ? 1 : 2, sceneType);
            }
          }
        }

        out = sanitize(resolveOutgoing(sanitize(out)));
        if (kind === "develop" || kind === "answer") remember(out);
        stats.kindCounts[kind] = (stats.kindCounts[kind] || 0) + 1;
        return { motif: clone(out), kind: kind };
      } catch (e) {
        // Normal operation never lands here; if integration surprises us,
        // the show goes on with the theme (or the tonic triad) verbatim.
        var fb = working.theme ? clone(working.theme) : fallbackMotif();
        stats.kindCounts.recall = (stats.kindCounts.recall || 0) + 1;
        return { motif: sanitize(fb), kind: "recall" };
      }
    }

    // applyTransform(motif, name) → NEW motif (chain appended, gen+1), or
    // null if the guards refuse. For the harness and any library corner that
    // wants one explicit operation (the candle-out's dissolutions, say).
    function applyTransform(m, name) {
      if (!m || !TRANSFORMS[name]) return null;
      var src = sanitize(clone(m));
      if (!allowedTransform(name, src, src.chain)) return null;
      var out = TRANSFORMS[name](src);
      out.gen = (m.gen || 0) + 1;
      out.chain = (m.chain || []).concat([name]);
      countTransform(name);
      return sanitize(out);
    }

    function getStats() {
      var tc = {};
      for (var k in stats.transformCounts) tc[k] = stats.transformCounts[k];
      var kc = {};
      for (k in stats.kindCounts) kc[k] = stats.kindCounts[k];
      var subs = [];
      for (var i = 0; i < working.subs.length; i++) {
        if (working.subs[i]) subs.push(working.subs[i].name);
      }
      var themeLine = working.theme && lineage[working.theme.name];
      return {
        developments: stats.developments,
        answers: stats.answers,
        renewals: stats.renewals,
        maxGen: stats.maxGen,
        transformCounts: tc,
        kindCounts: kc,
        working: {
          theme: working.theme ? working.theme.name : null,
          themeGen: themeLine ? themeLine.gen : (working.theme ? 0 : null),
          // the deepest living variant's actual notes (degree/beat pairs) —
          // additive telemetry for the viz's theme staff (owner 2026-07-20).
          // Degrees, not Hz: the staff survives the sea change like the
          // motifs themselves do.
          themeNotes: themeLine ? themeLine.notes.slice()
            : (working.theme ? working.theme.notes.slice() : null),
          subs: subs,
          count: (working.theme ? 1 : 0) + subs.length,
        },
        ledgerOpen: ledger.length,
        ghostCarried: stats.ghostCarried,
      };
    }

    return {
      // the improviser
      fresh: fresh,
      // the policy
      request: request,
      // the ledger
      post: post,
      maybePost: maybePost,
      claim: claim,
      overdueFor: overdueFor,
      // the composer, à la carte
      applyTransform: applyTransform,
      // performance boundaries + the ghost
      newPerformance: newPerformance,
      extractGhost: extractGhost,
      seedGhost: seedGhost,
      // The theme, whole. ancestor:true (default) returns the gen-0 seed as
      // improvised at newPerformance — the "prima materia"; ancestor:false
      // returns the deepest living descendant from the lineage instead.
      // Always a sanitized deep clone; null before the first performance.
      // Added for solve et coagula: the candle-out's one quiet verbatim
      // statement of the theme in its original form. Consumes NO draws.
      theme: function (topts) {
        if (!working.theme) return null;
        var anc = !topts || topts.ancestor !== false;
        var src = anc ? working.theme
                      : (lineage[working.theme.name] || working.theme);
        return sanitize(clone(src));
      },
      // telemetry
      stats: getStats,
    };
  }

  return {
    create: create,
    TRANSFORM_NAMES: TRANSFORM_NAMES.slice(),
  };
})();
