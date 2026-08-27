// ============================================================================
// Prospero's Jukebox — Generative Audio Engine
// Extracted from Prospero's Pinball, restructured for standalone mixing.
// Two aleatoric tracks: "Prospero's Library" (C Dorian) and "Sycorax's Spell"
// (Chromatic-Locrian). All audio synthesized in real time via Web Audio API.
// ============================================================================

window.ProsperoAudio = (function () {
  "use strict";

  // ==========================================================================
  // CONSTANTS — TRACK 1: PROSPERO'S LIBRARY
  // ==========================================================================

  // C Dorian scale pools
  var LIB_SCALE_4 = [262, 294, 311, 349, 392, 440, 466]; // C4–Bb4
  var LIB_SCALE_5 = [523, 587, 622, 698, 784, 880, 932]; // C5–Bb5
  var LIB_HUM_SCALE = [131, 147, 156, 175, 196]; // C3–G3

  // Markov transition matrix for hum pitch (5 notes, male range)
  var LIB_HUM_MARKOV = [
    [0.05, 0.3, 0.25, 0.15, 0.25],
    [0.25, 0.05, 0.3, 0.2, 0.2],
    [0.2, 0.2, 0.05, 0.3, 0.25],
    [0.15, 0.25, 0.25, 0.05, 0.3],
    [0.3, 0.15, 0.2, 0.3, 0.05],
  ];

  // Closed→open vowel formant pairs (F1, F2), male range.
  // Used by the Living-Voice hum: dual bandpass formants shape the
  // sawtooth into vowel-colored hum. Q=3/3.5 with F2 attenuated so each
  // band passes a cluster of harmonics rather than ringing a single one
  // (which would read as two pitches sounding at once).
  var LIB_HUM_VOWELS = {
    ng: { f1: 270, f2: 1500 },
    oo: { f1: 300, f2: 870  },
    uh: { f1: 520, f2: 1190 },
    oh: { f1: 570, f2: 840  },
    ah: { f1: 730, f2: 1090 },
  };
  // Pool order = closed→open axis. Each phrase picks a vowel via a
  // neighbor-biased Markov walk so the voice drifts between related
  // mouth shapes instead of teleporting.
  var LIB_HUM_VOWEL_POOL = ["ng", "oo", "uh", "oh", "ah"];
  var LIB_HUM_VOWEL_WALK = [
    [0.05, 0.50, 0.25, 0.12, 0.08],
    [0.30, 0.05, 0.40, 0.15, 0.10],
    [0.10, 0.35, 0.05, 0.35, 0.15],
    [0.10, 0.15, 0.40, 0.05, 0.30],
    [0.08, 0.12, 0.25, 0.50, 0.05],
  ];
  // Probability that a hum note (after the first in a phrase) shifts the vowel to
  // a neighbor via the walk above — so the mouth shape changes occasionally
  // mid-phrase instead of holding one vowel the whole time.
  var HUM_VOWEL_CHANGE_PROB = 0.3;

  // Markov transition matrix for melody (7 notes, C Dorian)
  var LIB_MELODY_MARKOV = [
    [0.05, 0.3, 0.25, 0.1, 0.2, 0.05, 0.05],
    [0.2, 0.05, 0.3, 0.15, 0.15, 0.1, 0.05],
    [0.15, 0.25, 0.05, 0.25, 0.15, 0.05, 0.1],
    [0.1, 0.1, 0.25, 0.05, 0.3, 0.1, 0.1],
    [0.2, 0.1, 0.1, 0.2, 0.05, 0.2, 0.15],
    [0.1, 0.15, 0.05, 0.15, 0.25, 0.05, 0.25],
    [0.25, 0.1, 0.15, 0.1, 0.15, 0.2, 0.05],
  ];

  // Music box Markov (7 notes, upper octave)
  var LIB_BOX_MARKOV = [
    [0.05, 0.15, 0.1, 0.2, 0.3, 0.1, 0.1],
    [0.15, 0.05, 0.2, 0.1, 0.25, 0.15, 0.1],
    [0.2, 0.15, 0.05, 0.25, 0.1, 0.1, 0.15],
    [0.1, 0.1, 0.2, 0.05, 0.25, 0.2, 0.1],
    [0.2, 0.15, 0.1, 0.15, 0.05, 0.15, 0.2],
    [0.1, 0.2, 0.1, 0.15, 0.2, 0.05, 0.2],
    [0.15, 0.1, 0.2, 0.1, 0.2, 0.2, 0.05],
  ];

  // Drone fundamental pairs — rotate through for variety
  var LIB_DRONE_PAIRS = [
    [65.41, 98], // C2, G2 — open fifth
    [58.27, 87.31], // Bb1, F2 — warm fourth
    [73.42, 110], // D2, A2 — bright fifth
    [65.41, 82.41], // C2, Eb2 — minor third
  ];

  // Ambient event pool — [type, weight]
  var LIB_AMBIENT_POOL = [
    ["page_turn", 10],
    ["quill_scratch", 20],
    ["clock_cluster", 17],
    ["book_thud", 12],
    ["spell_wheeze", 11],
    ["owl_hoot", 12],
    ["distant_waves", 10],
    ["candle_sputter", 14],
    ["ink_drip", 11],
    ["whispered_word", 9],
    ["footsteps_distant", 12],
    ["ember_pop", 14],
  ];

  // ==========================================================================
  // CONSTANTS — TRACK 4: SYCORAX'S SPELL
  // ==========================================================================

  // Chromatic-Locrian scale — tritones, minor 2nds, diminished intervals
  var SYC_GHOST_SCALE = [311, 330, 370, 392, 415, 466, 494]; // Eb4–B4
  var SYC_GHOST_SCALE_HI = [622, 660, 740, 784, 831, 932, 988]; // octave above

  // Dissonant drone clusters
  var SYC_DRONE_CLUSTERS = [
    [55, 58.5, 82.5, 117],
    [52, 55, 78, 110],
    [49, 58.5, 73.5, 104],
    [55, 62, 82.5, 123.5],
    [46.5, 55, 69.5, 98],
  ];

  // Markov matrix for ghost tones (biased toward tritone/min2 motion)
  var SYC_GHOST_MARKOV = [
    [0.05, 0.25, 0.15, 0.1, 0.2, 0.1, 0.15],
    [0.2, 0.05, 0.1, 0.15, 0.1, 0.25, 0.15],
    [0.1, 0.15, 0.05, 0.25, 0.15, 0.1, 0.2],
    [0.15, 0.1, 0.2, 0.05, 0.25, 0.15, 0.1],
    [0.25, 0.1, 0.15, 0.2, 0.05, 0.1, 0.15],
    [0.1, 0.2, 0.15, 0.1, 0.15, 0.05, 0.25],
    [0.15, 0.15, 0.2, 0.1, 0.15, 0.2, 0.05],
  ];

  // Whisper formant pairs — [F1, F2] Hz
  var SYC_WHISPER_FORMANTS = [
    [700, 2500],
    [400, 2000],
    [900, 2800],
    [500, 3200],
    [600, 1800],
    [1000, 3500],
    [350, 2200],
  ];

  // Dark ambient event pool
  var SYC_AMBIENT_POOL = [
    ["chains_rattle", 15],
    ["distant_thunder", 12],
    ["glass_shatter", 8],
    ["raven_cry", 15],
    ["wind_howl", 18],
    ["spectral_moan", 12],
    ["cauldron_bubble", 10],
    ["witch_cackle", 10],
  ];

  // ==========================================================================
  // CONSTANTS — TRACK 3: ARIEL'S DAY OFF
  // ==========================================================================

  // F Lydian scale (F G A B C D E) — dreamy, floating, fairytale quality
  var ARIEL_SCALE_5 = [698, 784, 880, 988, 1047, 1175, 1319]; // F5–E6 (chimes)
  var ARIEL_SCALE_4 = [349, 392, 440, 494, 523, 587, 659];    // F4–E5 (flutter/whistle)

  // Markov matrix for chimes (7 notes, pentatonic skip — favors F,G,A,C,D for upbeat feel)
  var ARIEL_CHIME_MARKOV = [
    [0.03, 0.22, 0.25, 0.04, 0.25, 0.18, 0.03],
    [0.22, 0.03, 0.25, 0.04, 0.22, 0.21, 0.03],
    [0.20, 0.22, 0.03, 0.04, 0.25, 0.22, 0.04],
    [0.20, 0.18, 0.20, 0.03, 0.20, 0.15, 0.04],
    [0.22, 0.20, 0.22, 0.04, 0.03, 0.25, 0.04],
    [0.20, 0.22, 0.20, 0.04, 0.25, 0.03, 0.06],
    [0.25, 0.20, 0.20, 0.05, 0.20, 0.07, 0.03],
  ];

  // Markov matrix for flutter (7 notes, biased toward leaps — curious, exploring)
  var ARIEL_FLUTTER_MARKOV = [
    [0.05, 0.10, 0.15, 0.20, 0.25, 0.10, 0.15],
    [0.10, 0.05, 0.10, 0.15, 0.20, 0.25, 0.15],
    [0.15, 0.10, 0.05, 0.10, 0.15, 0.20, 0.25],
    [0.25, 0.15, 0.10, 0.05, 0.10, 0.15, 0.20],
    [0.20, 0.25, 0.15, 0.10, 0.05, 0.10, 0.15],
    [0.15, 0.20, 0.25, 0.15, 0.10, 0.05, 0.10],
    [0.10, 0.15, 0.20, 0.25, 0.15, 0.10, 0.05],
  ];

  // Markov matrix for whistle (7 notes, stepwise, gentle)
  var ARIEL_WHISTLE_MARKOV = [
    [0.05, 0.30, 0.20, 0.10, 0.15, 0.10, 0.10],
    [0.25, 0.05, 0.30, 0.10, 0.10, 0.10, 0.10],
    [0.15, 0.25, 0.05, 0.25, 0.10, 0.10, 0.10],
    [0.10, 0.10, 0.25, 0.05, 0.25, 0.15, 0.10],
    [0.10, 0.10, 0.10, 0.25, 0.05, 0.25, 0.15],
    [0.10, 0.10, 0.10, 0.15, 0.25, 0.05, 0.25],
    [0.15, 0.10, 0.10, 0.10, 0.15, 0.30, 0.10],
  ];

  // Breeze drone pairs — rotate for variety (fifths and fourths in F Lydian)
  var ARIEL_BREEZE_PAIRS = [
    [175, 262],   // F3, C4 — open fifth
    [196, 294],   // G3, D4 — open fifth
    [220, 330],   // A3, E4 — open fifth
    [175, 247],   // F3, B3 — tritone (the Lydian character interval)
  ];

  // Ambient event pool
  var ARIEL_AMBIENT_POOL = [
    ["giggle", 12],
    ["birdsong", 18],
    ["breeze_gust", 20],
    ["sparkle", 15],
    ["leaf_rustle", 15],
    ["cricket", 10],
    ["wind_chime", 14],
    ["bumble_bee", 10],
    ["bubble_pop", 12],
  ];

  // F Lydian across six octaves (F2..A7). Used to snap pitched ambient events
  // (wind_chime, bumble_bee, bubble_pop) onto the song's key so sustained
  // tonal content aligns with the breeze drone instead of clashing with it.
  var ARIEL_F_LYDIAN_HZ = [
    87.31, 98, 110, 123.47, 130.81, 146.83, 164.81,
    174.61, 196, 220, 246.94, 261.63, 293.66, 329.63,
    349.23, 392, 440, 493.88, 523.25, 587.33, 659.26,
    698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51,
    1396.91, 1567.98, 1760, 1975.53, 2093, 2349.32, 2637.02,
    2793.83, 3135.96, 3520, 3951.07,
  ];
  function arielSnapToScale(hz) {
    var best = ARIEL_F_LYDIAN_HZ[0];
    var bestDiff = Math.abs(hz - best);
    for (var i = 1; i < ARIEL_F_LYDIAN_HZ.length; i++) {
      var d = Math.abs(hz - ARIEL_F_LYDIAN_HZ[i]);
      if (d < bestDiff) { bestDiff = d; best = ARIEL_F_LYDIAN_HZ[i]; }
    }
    return best;
  }

  // Whistle motif cluster weights — tuned in whistle-motifs-sandbox.html.
  // Renormalized internally. Phrase is the anchor; Lydian + Trill weighted
  // rare so they land as special moments rather than routine.
  var ARIEL_WHISTLE_CLUSTER_WEIGHTS = {
    phrase:   0.30,
    loneTone: 0.12,
    climb:    0.14,
    sigh:     0.14,
    lydian:   0.07,
    birdCall: 0.16,
    trill:    0.07,
  };

  // ==========================================================================
  // MOTIF MEMORY — TUNABLES
  //
  // The melody layers can capture short phrases they generate and later
  // recall them (verbatim or transformed). These knobs control the feel:
  // how often you hear a returning idea, how varied the transformations
  // are, and how much of the recent past the layer remembers.
  // ==========================================================================

  // Per-(track,layer) ring-buffer capacity. Higher = deeper memory, but
  // older motifs may feel "stale" by the time they resurface.
  var MOTIF_CAPACITY = 8;

  // Action weights per fire. Renormalized internally — they don't need
  // to sum to 1. RECALL_* are only considered once memory has motifs;
  // until then the layer falls back to GENERATE.
  var MOTIF_ACTION_WEIGHTS = {
    generate:         0.65, // build fresh motif (and capture it)
    recallTransform:  0.25, // recall stored motif + apply transformation
    recallVerbatim:   0.10, // recall stored motif exactly as captured
  };

  // Recall probability ramp: when memory is nearly empty, bias toward
  // generating so the buffer fills. Once we have >= RAMP_FULL motifs,
  // use the full weights above.
  var MOTIF_RECALL_RAMP_FULL = 4;

  // Transformation weights — applied during recallTransform.
  var MOTIF_TRANSFORM_WEIGHTS = {
    transposeDegree: 0.40,
    retrograde:      0.20,
    octaveShift:     0.20,
    stretch:         0.20,
  };

  // Transpose range in scale degrees (inclusive). 0 is skipped (no-op).
  var MOTIF_TRANSPOSE_RANGE = [-3, 3];

  // Octave-shift options (multiplied into per-note octMult).
  var MOTIF_OCTAVE_CHOICES = [0.5, 2.0];

  // Rhythmic stretch factors (multiplied into offsets and durs).
  var MOTIF_STRETCH_CHOICES = [0.75, 1.33];

  // ==========================================================================
  // DENSITY ENVELOPE — TUNABLES
  //
  // A slow, two-LFO curve that scales event firing rates over minutes. It
  // sits on TOP of the user's per-layer RATE slider — RATE is the listener's
  // average setting, density modulates around it. Coprime periods so the
  // combined wave drifts without ever realigning the same way.
  // ==========================================================================

  // LFO periods in seconds. Coprime values give an aperiodic combined curve
  // (97 and 151 are prime; ~1:37 and ~2:31).
  var DENSITY_PERIOD_A = 97;
  var DENSITY_PERIOD_B = 151;
  var DENSITY_PHASE_B  = 1.0;  // radians; offset on the B oscillator so the
                               // piece doesn't start with both LFOs at zero

  // Density multiplier range. 0.4 = events ~2.5x rarer at the low point;
  // 1.4 = events ~1.4x more frequent at the high point.
  var DENSITY_RANGE = [0.4, 1.4];

  // Which tracks respect the envelope. Tracks not listed get 1.0 (no
  // modulation), letting us roll this out incrementally.
  var DENSITY_ENABLED_TRACKS = { library: true, sycorax: true, ariel: true };

  // Per-track layer allowlist. Drones are continuous and excluded.
  var DENSITY_ENABLED_LAYERS = {
    library: { melody: true, musicBox: true, clock: true, hum: true, ambient: true },
    sycorax: { whispers: true, ghost: true, heartbeat: true, scrape: true, waterphone: true, ambient: true },
    ariel:   { chimes: true, flutter: true, bubbles: true, whistle: true, ambient: true },
  };

  // Per-track phase offset (radians) added to LFO B, so different tracks
  // don't move through the same arc shape if the user switches between them.
  var DENSITY_PHASE_OFFSETS = {
    library: 0,
    sycorax: Math.PI / 2,
    ariel:   Math.PI,
  };

  // ==========================================================================
  // HARMONIC STATE — TUNABLES
  //
  // Each drone pair implies a temporary harmonic center. Melodic layers bias
  // their Markov picks toward that center's chord tones, so the music
  // actually *moves* between tonal regions instead of meandering in parallel
  // with the drones.
  //
  // The pair index (`harmonicIdx`) tracks libraryDrone's current cycle. The
  // chord-tone tables below say which scale degrees (indices into the
  // relevant scale array) are "in chord" for each pair.
  // ==========================================================================

  // For LIB_SCALE_4 = [C, D, Eb, F, G, A, Bb] (indices 0..6). Used by the
  // harpsichord melody and music box (same scale, different octave).
  //   Pair 0 (C2-G2)  -> Cm: C(0), Eb(2), G(4)
  //   Pair 1 (Bb1-F2) -> Bb maj: Bb(6), D(1), F(3)
  //   Pair 2 (D2-A2)  -> Dm: D(1), F(3), A(5)
  //   Pair 3 (C2-Eb2) -> Cm (same chord, different drone color)
  var HARMONIC_CHORD_TONES_SCALE_4 = [
    [0, 2, 4],
    [6, 1, 3],
    [1, 3, 5],
    [0, 2, 4],
  ];

  // For LIB_HUM_SCALE = [C3, D3, Eb3, F3, G3] (indices 0..4). Hum range only
  // partially covers each chord; we list what's available.
  //   Pair 0 (Cm)     -> C(0), Eb(2), G(4)         — full triad
  //   Pair 1 (Bb maj) -> D(1), F(3)                 — root Bb absent in range
  //   Pair 2 (Dm)     -> D(1), F(3)                 — fifth A absent in range
  //   Pair 3 (Cm)     -> C(0), Eb(2), G(4)
  var HARMONIC_CHORD_TONES_HUM_SCALE = [
    [0, 2, 4],
    [1, 3],
    [1, 3],
    [0, 2, 4],
  ];

  // Human-readable labels for the viz. Per-track tables — Library uses
  // chord names; Sycorax uses thematic "spell pose" names since its drone
  // clusters aren't triadic.
  var LIB_HARMONIC_LABELS = [
    { chord: "C minor",  drone: "C2 - G2"  },
    { chord: "Bb major", drone: "Bb1 - F2" },
    { chord: "D minor",  drone: "D2 - A2"  },
    { chord: "C minor",  drone: "C2 - Eb2" },
  ];

  // Sycorax drone clusters → pose names + the cluster's notes. The note
  // names below match the SYC_DRONE_CLUSTERS frequencies.
  var SYC_HARMONIC_LABELS = [
    { chord: "Hex",   drone: "A1 Bb1 E2 A2"  },
    { chord: "Veil",  drone: "G#1 A1 D#2 A2" },
    { chord: "Bind",  drone: "G1 Bb1 D2 G#2" },
    { chord: "Knell", drone: "A1 B1 E2 B2"   },
    { chord: "Curse", drone: "F#1 A1 C#2 G2" },
  ];

  // For ARIEL_SCALE_4 (F Lydian: F G A B C D E, indices 0..6) — used by
  // chimes / flutter / whistle.
  //   Pair 0 (F3-C4)  -> F major:  F(0), A(2), C(4)
  //   Pair 1 (G3-D4)  -> G major:  G(1), B(3), D(5)
  //   Pair 2 (A3-E4)  -> A minor:  A(2), C(4), E(6)
  //   Pair 3 (F3-B3)  -> F Lydian color: just F(0) + B(3) (root + #4)
  var ARIEL_CHORD_TONES_SCALE = [
    [0, 2, 4],
    [1, 3, 5],
    [2, 4, 6],
    [0, 3],
  ];

  var ARIEL_HARMONIC_LABELS = [
    { chord: "F major",   drone: "F3 - C4" },
    { chord: "G major",   drone: "G3 - D4" },
    { chord: "A minor",   drone: "A3 - E4" },
    { chord: "F Lydian",  drone: "F3 - B3" },
  ];

  // Markov bias for walking/ornament notes — gentle pull toward chord tones.
  var HARMONIC_BIAS_BASE = 1.8;
  // Stronger bias for phrase-ending resolution notes.
  var HARMONIC_BIAS_RESOLUTION = 4.5;
  // Probability that a resolution note is force-snapped to the nearest chord
  // tone regardless of the Markov draw. 0 = pure bias; 1 = always snap.
  var HARMONIC_RESOLUTION_FORCE_PROB = 0.5;

  // Which library layers respect the harmonic state. Drones, clock, and
  // ambient are excluded (drone IS the source; clock/ambient aren't pitched
  // in a melodic sense).
  var HARMONIC_ENABLED_LAYERS = {
    library: { melody: true, musicBox: true, hum: true },
    ariel:   { chimes: true, flutter: true, whistle: true },
  };

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  function markovNext(row, rng) {
    var sum = 0;
    for (var i = 0; i < row.length; i++) {
      sum += row[i];
      if (rng < sum) return i;
    }
    return row.length - 1;
  }

  // Directional Markov step — used by Climb / Sigh-style motifs. `direction`
  // is +1 (up) or -1 (down). 60% step in direction, 20% step opposite,
  // 15% stay, 5% double-step in direction. Average drift ≈ 0.5 step per
  // call → over 4 calls, ~2 degrees of net motion in the biased direction
  // with organic wobble.
  function stepDirectional(idx, direction, len) {
    var r = Math.random();
    var delta;
    if (r < 0.60)      delta = direction;
    else if (r < 0.80) delta = -direction;
    else if (r < 0.95) delta = 0;
    else               delta = 2 * direction;
    return Math.max(0, Math.min(len - 1, idx + delta));
  }

  function weightedChoice(pool) {
    var total = 0;
    for (var i = 0; i < pool.length; i++) total += pool[i][1];
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i][1];
      if (r <= 0) return pool[i][0];
    }
    return pool[0][0];
  }

  // Variety-aware pool pick. Re-maps the pool's weights by a curve based on
  // the variety key:
  //   "uniform"  → every entry equally likely (flat distribution)
  //   "default"  → engine pool weights as-is (current behavior)
  //   "focused"  → each weight squared, so the common entries dominate even more
  function weightedChoiceVariety(pool, variety) {
    if (!variety || variety === "default") return weightedChoice(pool);
    var remap = pool.map(function (entry) {
      var w = entry[1];
      if (variety === "uniform") w = 1;
      else if (variety === "focused") w = w * w;
      return [entry[0], w];
    });
    return weightedChoice(remap);
  }

  // ==========================================================================
  // HARMONIC STATE HELPERS
  // ==========================================================================

  // Returns the chord-tone indices currently active for a given (track, layer),
  // or null if the layer doesn't respect the harmonic state.
  function getChordTonesFor(track, layer) {
    var enabled = HARMONIC_ENABLED_LAYERS[track];
    if (!enabled || !enabled[layer]) return null;
    if (layer === "melody" || layer === "musicBox") {
      return HARMONIC_CHORD_TONES_SCALE_4[harmonicIdx % HARMONIC_CHORD_TONES_SCALE_4.length];
    }
    if (layer === "hum") {
      return HARMONIC_CHORD_TONES_HUM_SCALE[harmonicIdx % HARMONIC_CHORD_TONES_HUM_SCALE.length];
    }
    if (layer === "chimes" || layer === "flutter" || layer === "whistle") {
      return ARIEL_CHORD_TONES_SCALE[harmonicIdx % ARIEL_CHORD_TONES_SCALE.length];
    }
    return null;
  }

  // Chord-aware Markov pick. Multiplies chord-tone weights by `bias` and
  // renormalizes. Passing null/undefined chordTones (or bias 1) is equivalent
  // to vanilla markovNext.
  function markovNextChordBiased(row, chordTones, bias) {
    if (!chordTones || !chordTones.length || bias === 1) {
      return markovNext(row, Math.random());
    }
    var total = 0;
    var weighted = new Array(row.length);
    for (var i = 0; i < row.length; i++) {
      var w = row[i];
      // chordTones is small (~3 entries); indexOf is fine.
      if (chordTones.indexOf(i) >= 0) w *= bias;
      weighted[i] = w;
      total += w;
    }
    var r = Math.random() * total;
    for (var k = 0; k < weighted.length; k++) {
      r -= weighted[k];
      if (r <= 0) return k;
    }
    return weighted.length - 1;
  }

  // Nearest chord-tone index to `from`. Used for force-snap on resolution.
  function nearestChordTone(from, chordTones) {
    if (!chordTones || !chordTones.length) return from;
    var best = chordTones[0];
    var bestDist = Math.abs(chordTones[0] - from);
    for (var i = 1; i < chordTones.length; i++) {
      var d = Math.abs(chordTones[i] - from);
      if (d < bestDist) { best = chordTones[i]; bestDist = d; }
    }
    return best;
  }

  // Convenience: full resolution-pick combining strong Markov bias + optional
  // force-snap. Returns the new degree index.
  function resolveDegree(currentIdx, row, chordTones) {
    var next = markovNextChordBiased(row, chordTones, HARMONIC_BIAS_RESOLUTION);
    if (chordTones && Math.random() < HARMONIC_RESOLUTION_FORCE_PROB) {
      next = nearestChordTone(next, chordTones);
    }
    return next;
  }

  function emitHarmonicChange(track) {
    if (!harmonicListener) return;
    var labels;
    if (track === "library") labels = LIB_HARMONIC_LABELS;
    else if (track === "sycorax") labels = SYC_HARMONIC_LABELS;
    else if (track === "ariel") labels = ARIEL_HARMONIC_LABELS;
    else return;
    var label = labels[harmonicIdx % labels.length] || { chord: "?", drone: "?" };
    try {
      harmonicListener({
        type: "change",
        track: track,
        harmonicIdx: harmonicIdx,
        chord: label.chord,
        drone: label.drone,
      });
    } catch (e) { console.error("harmonicListener threw:", e); }
  }

  // Pick a key from an object of {key: weight} by weighted random.
  function pickWeighted(weightMap) {
    var keys = Object.keys(weightMap);
    var total = 0;
    for (var i = 0; i < keys.length; i++) total += weightMap[keys[i]];
    var r = Math.random() * total;
    for (var j = 0; j < keys.length; j++) {
      r -= weightMap[keys[j]];
      if (r <= 0) return keys[j];
    }
    return keys[0];
  }

  // ==========================================================================
  // MOTIF MEMORY
  //
  // A motif is the captured note-data of a single cluster fire. Notes are
  // stored as scale-degree indices (not raw Hz) so transposition stays
  // in-mode. Each note carries:
  //   degree   - index into the scale array (clamped at render time)
  //   offset   - seconds from motif start
  //   dur      - seconds
  //   gain     - gainMult passed to libPluckNote
  //   octMult  - frequency multiplier baked in (e.g. 2 for octave-double)
  // ==========================================================================

  // Per-(track,layer) ring buffers. Populated layers: library/melody and
  // sycorax/ghost. Add more buckets here as motif memory rolls out to
  // additional generative pitched layers.
  var motifMemory = {
    library: { melody: [] },
    sycorax: { ghost: [], waterphone: [] },
    ariel:   { whistle: [] },
  };

  function makeMotif(sourceCluster) {
    return {
      id: 0,              // assigned by captureMotif on first capture
      sourceCluster: sourceCluster,
      notes: [],          // [{degree, offset, dur, gain, octMult}]
      endDegree: 0,       // updated by builders so Markov state stays continuous
      scaleLen: 0,        // captured at build time for safe clamping later
      lastTransform: null, // set by applyMotifTransform on the played copy
    };
  }

  function motifAddNote(motif, degree, offset, dur, gain, octMult) {
    motif.notes.push({
      degree: degree,
      offset: offset,
      dur: dur,
      gain: gain,
      octMult: octMult == null ? 1 : octMult,
    });
  }

  function captureMotif(track, layer, motif) {
    var buf = motifMemory[track] && motifMemory[track][layer];
    if (!buf) return;
    if (!motif.id) motif.id = nextMotifId++;
    buf.push(motif);
    if (buf.length > MOTIF_CAPACITY) buf.shift();
  }

  function motifBufferSize(track, layer) {
    var buf = motifMemory[track] && motifMemory[track][layer];
    return buf ? buf.length : 0;
  }

  function recallMotif(track, layer) {
    var buf = motifMemory[track] && motifMemory[track][layer];
    if (!buf || !buf.length) return null;
    return buf[Math.floor(Math.random() * buf.length)];
  }

  function clearMotifMemory(track, layer) {
    var bucket = motifMemory[track];
    if (!bucket) return;
    if (layer) {
      if (bucket[layer]) bucket[layer].length = 0;
      return;
    }
    var keys = Object.keys(bucket);
    for (var i = 0; i < keys.length; i++) bucket[keys[i]].length = 0;
  }

  // Return a deep copy of a motif (so transformations don't mutate the stored
  // original). Notes are shallow-copied object-by-object.
  function cloneMotif(motif) {
    var copy = makeMotif(motif.sourceCluster);
    copy.id = motif.id;
    copy.endDegree = motif.endDegree;
    copy.scaleLen = motif.scaleLen;
    for (var i = 0; i < motif.notes.length; i++) {
      var n = motif.notes[i];
      copy.notes.push({
        degree: n.degree,
        offset: n.offset,
        dur: n.dur,
        gain: n.gain,
        octMult: n.octMult,
      });
    }
    return copy;
  }

  // --- Transformations ---
  // All transformations operate on a fresh clone — callers should pass
  // cloneMotif(stored) before mutating.

  function transformTransposeDegree(motif) {
    var lo = MOTIF_TRANSPOSE_RANGE[0];
    var hi = MOTIF_TRANSPOSE_RANGE[1];
    var shift = 0;
    // Pick non-zero shift in range
    while (shift === 0) {
      shift = lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    for (var i = 0; i < motif.notes.length; i++) {
      motif.notes[i].degree += shift;
    }
    motif.endDegree += shift;
    return motif;
  }

  function transformRetrograde(motif) {
    var notes = motif.notes;
    if (notes.length < 2) return motif;
    // Reverse event order: event i was [offset_i, offset_i + dur_i] inside
    // total length T. In retrograde it sits at [T - offset_i - dur_i, T - offset_i].
    var T = 0;
    for (var i = 0; i < notes.length; i++) {
      var end = notes[i].offset + notes[i].dur;
      if (end > T) T = end;
    }
    for (var j = 0; j < notes.length; j++) {
      notes[j].offset = T - notes[j].offset - notes[j].dur;
    }
    // Sort by new offset so iteration order matches playback order
    notes.sort(function (a, b) { return a.offset - b.offset; });
    motif.endDegree = notes[notes.length - 1].degree;
    return motif;
  }

  function transformOctaveShift(motif) {
    var mult = MOTIF_OCTAVE_CHOICES[Math.floor(Math.random() * MOTIF_OCTAVE_CHOICES.length)];
    for (var i = 0; i < motif.notes.length; i++) {
      motif.notes[i].octMult *= mult;
    }
    return motif;
  }

  function transformStretch(motif) {
    var factor = MOTIF_STRETCH_CHOICES[Math.floor(Math.random() * MOTIF_STRETCH_CHOICES.length)];
    for (var i = 0; i < motif.notes.length; i++) {
      motif.notes[i].offset *= factor;
      motif.notes[i].dur *= factor;
    }
    return motif;
  }

  function applyMotifTransform(motif) {
    var kind = pickWeighted(MOTIF_TRANSFORM_WEIGHTS);
    if (kind === "transposeDegree") transformTransposeDegree(motif);
    else if (kind === "retrograde") transformRetrograde(motif);
    else if (kind === "octaveShift") transformOctaveShift(motif);
    else if (kind === "stretch") transformStretch(motif);
    motif.lastTransform = kind;
    return motif;
  }

  // ==========================================================================
  // PRIVATE STATE
  // ==========================================================================

  var ctx = null;
  var masterGain = null;
  var playing = false;
  // Subscribers for layer events (visualization consumers). Each listener
  // receives the underlying generative data — frequencies, timings,
  // envelope — so visuals can be grounded in real signal structure.
  // Listener channels. Each is an array (multi-cast). setXListener appends;
  // setXListener(null) clears all subscribers. Multi-cast lets the spiral
  // viz, the event log, and any future consumer all subscribe simultaneously.
  var droneListeners = [];
  // (event) => void. Event shapes:
  //   { type:'fire', track, layer, time, motifId, cluster, action, transform }
  //   { type:'fire', track, layer, time, detail }   (simple non-motif events)
  //   { type:'clear', track }
  // Single channel for every motif-bearing or note-emitting layer.
  var motifListeners = [];
  // Per-NOTE events for pitched plucks (exact freq + scheduled time), so a
  // visualization can place an effect on each note. Shape: { freq, startTime, duration }
  var noteListeners = [];
  // (event) => void. Fires whenever an ambient pool event is chosen, so a
  // visualization or debug log can see which specific event played.
  // Event shape: { type:'fire', track, layer:'ambient', event:'page_turn'|..., time }
  var ambientListeners = [];
  var harmonicListener = null;   // (event) => void; event: {type:'change', track, harmonicIdx, chord, drone}
  var nextMotifId = 1;           // monotonic id assigned by captureMotif
  var harmonicIdx = 0;           // index of the drone pair currently sounding
  var previewing = false;       // true while a single-layer preview is running
  var previewEndTimer = null;   // setTimeout handle that ends the preview
  var previewTrack = null;      // track currently being previewed (for listener)
  var previewLayer = null;      // layer currently being previewed (for listener)
  var previewListeners = [];    // (track, layer, active) => void

  // Generic multi-cast emit helper. Used by every listener fan-out point.
  function emitMulticast(channel, args) {
    for (var i = 0; i < channel.length; i++) {
      try { channel[i].apply(null, args); }
      catch (e) { console.error("listener threw:", e); }
    }
  }

  // Per-track:layer most-recent fire timestamp. Used by silent layers
  // (clock / heartbeat) to emit a single "start" log entry when they
  // re-engage after a gap, rather than flooding the log per-tick.
  var lastFireTime = {};
  function maybeEmitSessionStart(track, layer, t) {
    var key = track + ":" + layer;
    var last = lastFireTime[key] || 0;
    var gap = t - last;
    lastFireTime[key] = t;
    if (gap > 5) {
      emitMotifEvent({
        type: "fire", track: track, layer: layer, time: t,
        detail: "start",
      });
    }
  }
  var PREVIEW_DURATION_MS = 12000;
  var currentTrack = "library"; // 'library', 'sycorax', or 'ariel'
  var sharedNoiseBuf = null; // Pre-generated 30s noise buffer, reused everywhere
  var NOISE_BUF_DURATION = 30;

  // Timer tracking
  var libraryTimers = new Set();
  var sycoraxTimers = new Set();
  var arielTimers = new Set();

  // Markov state — Library
  var melodyIdx = 0;
  var boxIdx = 4;
  var humIdx = 0;
  var humVowelIdx = 0; // Position in LIB_HUM_VOWEL_POOL for the walk
  var droneIdx = 0;
  var tickState = false;

  // Markov state — Sycorax
  var sycGhostIdx = 0;
  var sycDroneIdx = 0;
  var sycHeartbeatIntensity = 1.0;
  var sycWaterphoneIdx = 0;

  // Markov state — Ariel
  var arielChimeIdx = 0;
  var arielFlutterIdx = 0;
  var arielWhistleIdx = 0;
  var arielBreezeIdx = 0;

  // Per-layer GainNodes
  var layerGains = {
    library: {
      drone: null,
      melody: null,
      musicBox: null,
      clock: null,
      hum: null,
      ambient: null,
    },
    sycorax: {
      drone: null,
      whispers: null,
      ghost: null,
      heartbeat: null,
      scrape: null,
      waterphone: null,
      ambient: null,
    },
    ariel: {
      breeze: null,
      bass: null,
      chimes: null,
      flutter: null,
      bubbles: null,
      whistle: null,
      ambient: null,
    },
  };

  // Default layer volume (75% so user has headroom to boost individual layers)
  var DEFAULT_LAYER_VOL = 0.75;

  // Per-layer volume and mute state
  var layerVolumes = {
    library: {
      drone: DEFAULT_LAYER_VOL,
      // Broadband Karplus-Strong + brief envelope means the harpsichord
      // shows up much fainter on the spiral than the drone at the same
      // slider position. Default slider sits higher to compensate.
      melody: 1.0,
      musicBox: DEFAULT_LAYER_VOL,
      clock: DEFAULT_LAYER_VOL,
      // Hum's bandpass-stack synthesis sits ~half as loud at source as the
      // other layers, and its spectral footprint is two narrow formant
      // peaks (not the note's fundamental), so a higher default slider
      // pulls it back into the mix and onto the spiral.
      hum: 1.0,
      ambient: DEFAULT_LAYER_VOL,
    },
    sycorax: {
      drone: DEFAULT_LAYER_VOL,
      whispers: DEFAULT_LAYER_VOL,
      ghost: DEFAULT_LAYER_VOL,
      heartbeat: DEFAULT_LAYER_VOL,
      scrape: DEFAULT_LAYER_VOL,
      waterphone: DEFAULT_LAYER_VOL,
      ambient: DEFAULT_LAYER_VOL,
    },
    ariel: {
      breeze: DEFAULT_LAYER_VOL,
      bass: DEFAULT_LAYER_VOL,
      chimes: DEFAULT_LAYER_VOL,
      flutter: DEFAULT_LAYER_VOL,
      bubbles: DEFAULT_LAYER_VOL,
      whistle: DEFAULT_LAYER_VOL,
      ambient: DEFAULT_LAYER_VOL,
    },
  };

  var layerMuted = {
    library: {
      drone: false,
      melody: false,
      musicBox: false,
      clock: false,
      hum: false,
      ambient: false,
    },
    sycorax: {
      drone: false,
      whispers: false,
      ghost: false,
      heartbeat: false,
      scrape: false,
      waterphone: false,
      ambient: false,
    },
    ariel: {
      breeze: false,
      bass: false,
      chimes: false,
      flutter: false,
      bubbles: false,
      whistle: false,
      ambient: false,
    },
  };

  // Per-layer event rate multiplier (1.0 = normal, 2.0 = twice as often, 0.5 = half as often)
  // Drones are continuous and don't use rate control.
  var layerRate = {
    library: { melody: 1, musicBox: 1, clock: 1, hum: 1, ambient: 1 },
    sycorax: { whispers: 1, ghost: 1, heartbeat: 1, scrape: 1, waterphone: 1, ambient: 1 },
    ariel: { bass: 1, chimes: 1, flutter: 1, bubbles: 1, whistle: 1, ambient: 1 },
  };

  // Per-layer volume trim applied on top of slider value (1.0 = no trim).
  // Drones are continuous and dominate the mix at full gain, so they start quieter
  // while keeping the VOL slider visually aligned with the other layers.
  var LAYER_VOLUME_TRIM = {
    library: { drone: 0.3 },
    sycorax: { drone: 0.3 },
    ariel: { breeze: 0.2 }, // breeze pad starts quieter (turned down from 0.3)
  };

  // Per-layer rate trim applied on top of slider-driven layerRate (1.0 = no trim).
  // Non-ambient event layers fire ~40% slower than the literal slider position
  // so the default density feels more breathable. Ambient layers are already
  // sparse (Cage-style chance events) and are left untrimmed.
  var LAYER_RATE_TRIM = {
    library: { melody: 0.6, musicBox: 0.6, clock: 0.6, hum: 0.6 },
    sycorax: { whispers: 0.6, ghost: 0.6, heartbeat: 0.6, scrape: 0.6, waterphone: 0.6 },
    ariel: { chimes: 0.6, flutter: 0.6, bubbles: 0.6, whistle: 0.6 },
  };

  var masterVolume = 0.12; // same as pinball default

  // ==========================================================================
  // EFFECTS CHAIN — NEW INFRASTRUCTURE
  //
  // Signal flow (added nodes marked with *):
  //   Sounds -> [*StereoPanner per-note] -> layerGain
  //   Drone layerGains -> *droneWaveshaper[track] -> *reverbSend
  //   Non-drone layerGains -> *reverbSend
  //   *reverbSend -> *reverbDry -> masterGain                         (dry path)
  //   *reverbSend -> *reverbPreDelay -> *reverbConv -> *reverbWet -> masterGain  (wet path)
  //   masterGain -> *compressorNode -> destination
  // ==========================================================================

  var compressorNode = null;      // DynamicsCompressorNode — glues layers, controls peaks
  var reverbConv = null;          // ConvolverNode — impulse response reverb
  var reverbWet = null;           // GainNode — reverb wet level
  var reverbDry = null;           // GainNode — dry pass-through level
  var reverbSend = null;          // GainNode — input to reverb routing
  var reverbPreDelay = null;      // DelayNode — 15-40ms pre-delay before reverb

  // WaveShaperNodes for drone layers — adds harmonic richness via tanh soft-clip
  // Library: gentle warmth (amount=12), Sycorax: gritty saturation (amount=26),
  // Ariel: subtle tube warmth (amount=7)
  var droneWaveshapers = { library: null, sycorax: null, ariel: null };

  // PeriodicWave custom waveforms — richer timbres than basic oscillator types
  // Designed from Fourier coefficients to mimic real material overtone profiles
  var bellWave = null;   // Inharmonic bell partials — used for Ariel chimes
  var glassWave = null;  // Hollow odd-harmonic shimmer — used for Sycorax ghost tones
  var fluteWave = null;  // Soft breathy fundamental — used for Ariel whistle

  // Stereo width for per-note panning (0 = mono center, 1 = full L/R spread)
  var STEREO_WIDTH = 0.7;

  // Per-track reverb impulse response parameters
  // Library: warm intimate room. Sycorax: dark cavernous cave. Ariel: open airy space.
  var REVERB_PARAMS = {
    library: { decay: 2.0, hfDamp: 4.0, preDelay: 25, wet: 0.35 },
    sycorax: { decay: 4.5, hfDamp: 1.5, preDelay: 40, wet: 0.35 },
    ariel:   { decay: 3.0, hfDamp: 6.0, preDelay: 15, wet: 0.35 },
  };

  // Which layers are continuous drones (routed through waveshaper, no stereo pan)
  var DRONE_LAYERS = { drone: true, breeze: true };

  // ==========================================================================
  // TIMER SCHEDULING HELPERS
  // ==========================================================================

  function scheduleLib(fn, ms) {
    var id = setTimeout(function () {
      libraryTimers.delete(id);
      fn();
    }, ms);
    libraryTimers.add(id);
  }

  function scheduleSyc(fn, ms) {
    var id = setTimeout(function () {
      sycoraxTimers.delete(id);
      fn();
    }, ms);
    sycoraxTimers.add(id);
  }

  function scheduleAri(fn, ms) {
    var id = setTimeout(function () {
      arielTimers.delete(id);
      fn();
    }, ms);
    arielTimers.add(id);
  }

  function clearAllTimers() {
    libraryTimers.forEach(function (id) {
      clearTimeout(id);
    });
    libraryTimers.clear();
    sycoraxTimers.forEach(function (id) {
      clearTimeout(id);
    });
    sycoraxTimers.clear();
    arielTimers.forEach(function (id) {
      clearTimeout(id);
    });
    arielTimers.clear();
    pendingLayerTimers = {};
  }

  // Helper to get the output node for a layer (respects mute + volume)
  function lg(track, layer) {
    return layerGains[track][layer];
  }

  // Helper to get event rate multiplier for a layer (slider value * default trim)
  function getRate(track, layer) {
    var base = (layerRate[track] && layerRate[track][layer]) || 1;
    var trim = (LAYER_RATE_TRIM[track] && LAYER_RATE_TRIM[track][layer]) || 1;
    return base * trim;
  }

  // Density at an arbitrary time t (seconds). Pure function of time —
  // no ctx required, callable for past or future. Returns 1.0 for any
  // (track, layer) not allowlisted in the DENSITY_ENABLED_* maps.
  function getDensityAt(t, track, layer) {
    if (!DENSITY_ENABLED_TRACKS[track]) return 1;
    var trackLayers = DENSITY_ENABLED_LAYERS[track];
    if (trackLayers && layer && !trackLayers[layer]) return 1;
    var trackOffset = DENSITY_PHASE_OFFSETS[track] || 0;
    var a = Math.sin(2 * Math.PI * t / DENSITY_PERIOD_A + trackOffset);
    var b = Math.sin(2 * Math.PI * t / DENSITY_PERIOD_B + DENSITY_PHASE_B + trackOffset);
    // Sum of two unit-amplitude sines: range [-2, 2]. Normalize to [0, 1].
    var density01 = ((a + b) / 2 + 1) / 2;
    return DENSITY_RANGE[0] + density01 * (DENSITY_RANGE[1] - DENSITY_RANGE[0]);
  }

  // Density multiplier sampled at the current audio time. Used by the
  // scheduler. Returns 1.0 when ctx isn't initialized.
  function getDensityMultiplier(track, layer) {
    if (!ctx) return 1;
    return getDensityAt(ctx.currentTime, track, layer);
  }

  // Per-layer pending timer tracking for rate-aware scheduling.
  // Maps "track:layer" -> { id, fn, remaining, startedAt, rate }
  var pendingLayerTimers = {};

  function layerTimerKey(track, layer) {
    return track + ":" + layer;
  }

  // Rate-aware scheduler: sets a single setTimeout per layer event.
  // When the rate changes, setLayerRate cancels and reschedules with
  // adjusted remaining time — no polling needed.
  //
  // minDelay (ms, optional): hard floor enforced AFTER rate scaling. Used
  // by layers where one event must finish before the next can start
  // (e.g. harpsichord motifs: no overlap regardless of how high the
  // user pushes the RATE slider).
  function scheduleWithRate(fn, baseDelay, track, layer, minDelay) {
    var timerSet = track === "library" ? libraryTimers : track === "sycorax" ? sycoraxTimers : arielTimers;
    var key = layerTimerKey(track, layer);
    var rate = getRate(track, layer);
    var density = getDensityMultiplier(track, layer);
    var adjustedDelay = baseDelay / (rate * density);
    if (minDelay && adjustedDelay < minDelay) adjustedDelay = minDelay;

    // Clear any existing pending timer for this layer
    var prev = pendingLayerTimers[key];
    if (prev) {
      clearTimeout(prev.id);
      timerSet.delete(prev.id);
      delete pendingLayerTimers[key];
    }

    var id = setTimeout(function () {
      timerSet.delete(id);
      delete pendingLayerTimers[key];
      if (playing && currentTrack === track) {
        fn();
      }
    }, adjustedDelay);
    timerSet.add(id);

    pendingLayerTimers[key] = {
      id: id,
      fn: fn,
      baseRemaining: baseDelay,
      minDelay: minDelay || 0,
      startedAt: Date.now(),
      rate: rate,
      density: density,
      track: track,
      layer: layer,
    };
  }

  // Called by setLayerRate to reschedule the pending timer at the new rate.
  function rescheduleLayer(track, layer, newRate) {
    var key = layerTimerKey(track, layer);
    var pending = pendingLayerTimers[key];
    if (!pending) return;

    var timerSet = track === "library" ? libraryTimers : track === "sycorax" ? sycoraxTimers : arielTimers;
    var elapsed = Date.now() - pending.startedAt;
    // How much base time was consumed at the old (rate * density)
    var oldDensity = pending.density || 1;
    var baseConsumed = elapsed * pending.rate * oldDensity;
    var baseRemaining = Math.max(0, pending.baseRemaining - baseConsumed);

    // Cancel old timer
    clearTimeout(pending.id);
    timerSet.delete(pending.id);

    // Resample density at reschedule time — slow LFOs barely drift, but this
    // keeps things internally consistent if the user moves RATE mid-trough.
    var newDensity = getDensityMultiplier(track, layer);
    var adjustedDelay = baseRemaining / (newRate * newDensity);
    // Remaining floor from the original schedule, minus what's already elapsed.
    var remainingMinDelay = Math.max(0, (pending.minDelay || 0) - elapsed);
    if (remainingMinDelay && adjustedDelay < remainingMinDelay) adjustedDelay = remainingMinDelay;

    var id = setTimeout(function () {
      timerSet.delete(id);
      delete pendingLayerTimers[key];
      if (playing && currentTrack === track) {
        pending.fn();
      }
    }, adjustedDelay);
    timerSet.add(id);

    pendingLayerTimers[key] = {
      id: id,
      fn: pending.fn,
      baseRemaining: baseRemaining,
      minDelay: remainingMinDelay,
      startedAt: Date.now(),
      rate: newRate,
      density: newDensity,
      track: track,
      layer: layer,
    };
  }

  // Create a BufferSourceNode from the shared noise buffer.
  // Plays a random slice of the requested duration.
  function noiseSource(duration) {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf;
    var maxOffset = Math.max(0, NOISE_BUF_DURATION - duration);
    var offset = Math.random() * maxOffset;
    n.loopStart = 0;
    n.loopEnd = NOISE_BUF_DURATION;
    n.loop = duration > NOISE_BUF_DURATION;
    n._offset = offset;
    n._duration = duration;
    return n;
  }

  // Start a noise source at the given time using its stored offset/duration.
  function startNoise(n, when) {
    n.start(when, n._offset, n._duration);
  }

  function applyLayerGain(track, layer) {
    var node = layerGains[track][layer];
    if (!node) return;
    var trim = (LAYER_VOLUME_TRIM[track] && LAYER_VOLUME_TRIM[track][layer]) || 1;
    var vol = layerMuted[track][layer] ? 0 : layerVolumes[track][layer] * trim;
    node.gain.setValueAtTime(vol, ctx.currentTime);
  }

  // Create a StereoPanner for a single note/event, randomly placed in the field.
  // Returns the panner node — connect sound sources to this instead of the layer gain.
  function stereoPan(out) {
    var pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime((Math.random() * 2 - 1) * STEREO_WIDTH, ctx.currentTime);
    pan.connect(out);
    return pan;
  }

  // Shorthand: get a panned output node for a layer (stereo per-note placement).
  // Use lgp() for melodic/event sounds, lg() for centered continuous sounds (drones).
  function lgp(track, layer) {
    return stereoPan(layerGains[track][layer]);
  }

  // Generate and apply a reverb impulse response tuned for the given track.
  // Called on init, play, and track switch to match the track's spatial character.
  function buildReverbIR(track) {
    var p = REVERB_PARAMS[track];
    var irLen = ctx.sampleRate * p.decay;
    var irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = irBuf.getChannelData(ch);
      for (var i = 0; i < irLen; i++) {
        var t = i / ctx.sampleRate;
        var env = Math.exp(-3.0 * t / p.decay);
        var hf = Math.exp(-p.hfDamp * t / p.decay);
        data[i] = (Math.random() * 2 - 1) * env * hf;
      }
    }
    reverbConv.buffer = irBuf;
    reverbPreDelay.delayTime.setValueAtTime(p.preDelay / 1000, ctx.currentTime);
    reverbWet.gain.setValueAtTime(p.wet, ctx.currentTime);
  }

  // Generate a tanh soft-clip waveshaper curve. Higher amount = more saturation.
  function buildWaveshaperCurve(amount) {
    var samples = 256;
    var curve = new Float32Array(samples);
    for (var i = 0; i < samples; i++) {
      var x = (i / (samples - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // ==========================================================================
  // TRACK 1: PROSPERO'S LIBRARY — LAYER METHODS
  // ==========================================================================

  function scheduleLibrary() {
    if (!playing || currentTrack !== "library") return;
    // Reset Markov state
    melodyIdx = Math.floor(Math.random() * LIB_SCALE_4.length);
    boxIdx = Math.floor(Math.random() * LIB_SCALE_5.length);
    droneIdx = Math.floor(Math.random() * LIB_DRONE_PAIRS.length);
    humIdx = Math.floor(Math.random() * LIB_HUM_SCALE.length);
    humVowelIdx = Math.floor(Math.random() * LIB_HUM_VOWEL_POOL.length);
    // Launch all independent generative layers
    libraryDrone();
    libraryMelody();
    libraryMusicBox();
    libraryClock();
    libraryAmbient();
    scheduleLib(function () {
      libraryHum();
    }, 20000 + Math.random() * 20000);
  }

  // --- Eno-style overlapping drone pad cycles ---
  function libraryDrone() {
    if (!playing || currentTrack !== "library") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lg("library", "drone");
    var pair = LIB_DRONE_PAIRS[droneIdx % LIB_DRONE_PAIRS.length];
    // The pair we just picked is the new harmonic center. Update before
    // any other layer reads it, then notify listeners.
    harmonicIdx = droneIdx % LIB_DRONE_PAIRS.length;
    emitHarmonicChange("library");
    droneIdx = (droneIdx + 1) % LIB_DRONE_PAIRS.length;

    // Mixer-exposed knobs. CYCLE LENGTH is a min/max range — duration is
    // picked uniformly within it. Clamp max >= min so swapping the sliders
    // can't produce negative durations.
    var cycleMin = getLayerParam("library", "drone", "cycleMin", 17);
    var cycleMax = getLayerParam("library", "drone", "cycleMax", 23);
    if (cycleMax < cycleMin) cycleMax = cycleMin;
    var duration = cycleMin + Math.random() * (cycleMax - cycleMin);
    var fadeIn = 3;
    var fadeOut = 3;
    var LIB_LP_CUTOFF = getLayerParam("library", "drone", "warmth", 240);
    var LIB_TREM_DEPTH = getLayerParam("library", "drone", "movement", 0.19);
    var LIB_TREM_RATE = getLayerParam("library", "drone", "tremoloRate", 0.7);

    // Shared tremolo bus. Base = 1 - depth/2, LFO swings ±depth/2 →
    // envelope ranges from (1 - depth) up to 1. Each partial and the
    // sub-octave route through this bus so the modulation is coherent.
    var tremBus = c.createGain();
    tremBus.gain.setValueAtTime(1 - LIB_TREM_DEPTH / 2, now);
    var tremLFO = c.createOscillator();
    tremLFO.type = "sine";
    tremLFO.frequency.setValueAtTime(LIB_TREM_RATE, now);
    var tremDepth = c.createGain();
    tremDepth.gain.setValueAtTime(LIB_TREM_DEPTH / 2, now);
    tremLFO.connect(tremDepth);
    tremDepth.connect(tremBus.gain);
    tremBus.connect(out);
    tremLFO.start(now);
    tremLFO.stop(now + duration + 0.1);

    for (var fi = 0; fi < pair.length; fi++) {
      var freq = pair[fi];
      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, now);
      f.type = "lowpass";
      f.frequency.setValueAtTime(LIB_LP_CUTOFF, now);
      o.connect(f);
      f.connect(g);
      g.connect(tremBus);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.09, now + fadeIn);
      g.gain.setValueAtTime(0.09, now + duration - fadeOut);
      g.gain.linearRampToValueAtTime(0, now + duration);
      o.start(now);
      o.stop(now + duration + 0.1);
    }

    // SUB CHANCE knob: probability that this cycle includes the sub-octave sine.
    var subChance = getLayerParam("library", "drone", "subChance", 0.3);
    var hasSub = Math.random() < subChance;
    var subFreq = hasSub ? pair[0] / 2 : null;
    if (hasSub) {
      var o2 = c.createOscillator();
      var g2 = c.createGain();
      o2.type = "sine";
      o2.frequency.setValueAtTime(subFreq, now);
      o2.connect(g2);
      g2.connect(tremBus);
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(0.03, now + fadeIn);
      g2.gain.setValueAtTime(0.03, now + duration - fadeOut);
      g2.gain.linearRampToValueAtTime(0, now + duration);
      o2.start(now);
      o2.stop(now + duration + 0.1);
    }

    // Broadcast cycle data for visualizers. Listener receives the actual
    // generative state — frequencies, envelope shape, timing — so the viz
    // can be grounded in the real signal structure rather than guessed.
    emitDroneEvent({
      track: "library",
      startTime: now,
      duration: duration,
      fadeIn: fadeIn,
      fadeOut: fadeOut,
      peakGain: 0.09,
      frequencies: pair.slice(),
      subFreq: subFreq,
      subPeakGain: hasSub ? 0.03 : 0,
    });

    var overlap = 2 + Math.random() * 3;
    scheduleLib(libraryDrone, (duration - overlap) * 1000);
  }

  // --- Karplus-Strong pluck helper (harpsichord voicing) ---
  // Used by all library melody cluster patterns.
  function libPluckNote(freq, startTime, duration, out, gainMult) {
    var c = ctx;
    if (gainMult == null) gainMult = 1.0;

    var pluckLen = 0.03;
    var buf = c.createBuffer(1, c.sampleRate * pluckLen, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
    var n = c.createBufferSource();
    n.buffer = buf;
    n.loop = true;

    // BRIGHTNESS = pluck filter freq multiplier (sparklier vs mellower).
    // RESONANCE = pluck filter Q (thumpy vs stringy).
    var pluckBright = getLayerParam("library", "melody", "brightness", 3.0);
    var pluckQ      = getLayerParam("library", "melody", "resonance", 0.5);
    var pf = c.createBiquadFilter();
    pf.type = "lowpass";
    pf.frequency.setValueAtTime(freq * pluckBright, startTime);
    pf.frequency.exponentialRampToValueAtTime(freq * 0.8, startTime + duration * 0.8);
    pf.Q.setValueAtTime(pluckQ, startTime);

    var pg = c.createGain();
    n.connect(pf);
    pf.connect(pg);
    pg.connect(out);
    // Peak bumped from 0.09 → 0.14 so the pluck transient's spread-spectrum
    // energy registers on the spiral. The harpsichord's per-bin magnitude
    // is intrinsically ~10× lower than a drone partial (broadband Karplus-
    // Strong vs single-bin triangle), and a 150 ms decay leaves it on
    // screen only a few frames. Tail decay times unchanged so the note's
    // shape and length still feel right.
    pg.gain.setValueAtTime(0.14 * gainMult, startTime);
    // Clamp the decay anchor inside the note so a sub-0.15s grace/roll can't put
    // the release ramp before it (which would exp-ramp up from ~0 → a click).
    pg.gain.exponentialRampToValueAtTime(0.045 * gainMult, startTime + Math.min(0.15, duration * 0.5));
    pg.gain.linearRampToValueAtTime(0, startTime + duration);
    n.start(startTime);
    n.stop(startTime + duration + 0.01);

    // Octave harmonic — SPARKLE knob scales its gain (0 = pure fundamental).
    var sparkle = getLayerParam("library", "melody", "sparkle", 0.03);
    var ho = c.createOscillator();
    var hg = c.createGain();
    ho.type = "sine";
    ho.frequency.setValueAtTime(freq * 2, startTime);
    ho.connect(hg);
    hg.connect(out);
    hg.gain.setValueAtTime(sparkle * gainMult, startTime);
    hg.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
    hg.gain.linearRampToValueAtTime(0, startTime + 0.4);
    ho.start(startTime);
    ho.stop(startTime + 0.5);

    emitNoteEvent({ track: currentTrack, layer: "melody", freq: freq, startTime: startTime, duration: duration });
  }

  // --- Motif renderer ---
  // Walks a motif's note list and plays each via libPluckNote. Scale-degree
  // indices are clamped to LIB_SCALE_4 bounds (transpose transforms can push
  // them out of range; clamping keeps things in the harpsichord's register).
  function playLibraryMotif(motif, out, now) {
    var notes = motif.notes;
    var len = LIB_SCALE_4.length;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var idx = n.degree;
      if (idx < 0) idx = 0;
      else if (idx >= len) idx = len - 1;
      var freq = LIB_SCALE_4[idx] * n.octMult;
      libPluckNote(freq, now + n.offset, n.dur, out, n.gain);
    }
  }

  // --- Cluster: lone Markov note (single-note fallback so things don't always stack) ---
  // The single note IS the phrase — treat it as a resolution.
  function buildLibClusterSingle() {
    var motif = makeMotif("single");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");
    melodyIdx = resolveDegree(melodyIdx, LIB_MELODY_MARKOV[melodyIdx], chordTones);
    motifAddNote(motif, melodyIdx, 0, 1.3 + Math.random() * 1.2, 0.85 + Math.random() * 0.2, 1);
    motif.endDegree = melodyIdx;
    return motif;
  }

  // --- Cluster: baroque grace note + held main note ---
  // The held main note (after the grace) is the resolution.
  function buildLibClusterGrace() {
    var motif = makeMotif("grace");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");
    melodyIdx = resolveDegree(melodyIdx, LIB_MELODY_MARKOV[melodyIdx], chordTones);
    var mainIdx = melodyIdx;

    // 10% chance: "turn" ornament — above-main-below-main (four notes)
    if (Math.random() < 0.10) {
      var above = Math.min(mainIdx + 1, LIB_SCALE_4.length - 1);
      var below = Math.max(mainIdx - 1, 0);
      var g = 0.055 + Math.random() * 0.02;
      motifAddNote(motif, above,   0,           0.14, 0.6, 1);
      motifAddNote(motif, mainIdx, g,           0.14, 0.55, 1);
      motifAddNote(motif, below,   g * 2,       0.14, 0.6, 1);
      motifAddNote(motif, mainIdx, g * 3 + 0.02, 1.5 + Math.random() * 0.8, 1.0, 1);
      motif.endDegree = mainIdx;
      return motif;
    }

    var graceRnd = Math.random();
    var graceIdx;
    if (graceRnd < 0.60) graceIdx = Math.min(mainIdx + 1, LIB_SCALE_4.length - 1);
    else if (graceRnd < 0.85) graceIdx = Math.max(mainIdx - 1, 0);
    else graceIdx = Math.min(mainIdx + 2, LIB_SCALE_4.length - 1);
    var graceGap = 0.06 + Math.random() * 0.05;

    motifAddNote(motif, graceIdx, 0,        0.2 + Math.random() * 0.1, 0.65 + Math.random() * 0.1, 1);
    motifAddNote(motif, mainIdx,  graceGap, 1.6 + Math.random() * 0.8, 1.0, 1);

    // 15% chance: octave-double the main for emphasis
    if (Math.random() < 0.15) {
      motifAddNote(motif, mainIdx, graceGap, 1.0 + Math.random() * 0.5, 0.45, 2);
    }

    if (Math.random() < 0.20) {
      var grace2Idx = Math.max(mainIdx - 1, 0);
      motifAddNote(motif, grace2Idx, graceGap * 0.5, 0.15, 0.55, 1);
    }

    motif.endDegree = mainIdx;
    return motif;
  }

  // --- Cluster: rolled chord (arpeggio) ---
  // Bias the root pick toward a chord tone so the rolled chord lines up
  // with the current harmonic center 50% of the time.
  function buildLibClusterRoll() {
    var motif = makeMotif("roll");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");
    var rootIdx;
    if (chordTones && Math.random() < 0.5) {
      rootIdx = chordTones[Math.floor(Math.random() * chordTones.length)];
      // Roll generators want a root low enough to add +4 above it. Clamp.
      if (rootIdx > 4) rootIdx = chordTones[0];
    } else {
      rootIdx = Math.floor(Math.random() * 4);
    }
    var chord = [rootIdx, rootIdx + 2, rootIdx + 4];
    var shapeRnd = Math.random();
    if (shapeRnd < 0.25) chord = [rootIdx, rootIdx + 4];
    else if (shapeRnd >= 0.55) chord.push(rootIdx + 6);
    chord = chord.map(function (i) { return i % LIB_SCALE_4.length; });

    // 15% chance: insert a non-chord passing tone in the middle
    if (Math.random() < 0.15 && chord.length >= 3) {
      var mid = Math.floor(chord.length / 2);
      var passIdx = (chord[mid] + 1) % LIB_SCALE_4.length;
      chord.splice(mid, 0, passIdx);
    }

    var dirRnd = Math.random();
    if (dirRnd >= 0.55 && dirRnd < 0.90) chord.reverse();
    else if (dirRnd >= 0.90 && chord.length >= 4) chord = [chord[0], chord[2], chord[1], chord[3]];

    // 15% chance: swap an adjacent pair so the roll feels less mechanical
    if (Math.random() < 0.15 && chord.length >= 3) {
      var swapIdx = Math.floor(Math.random() * (chord.length - 1));
      var tmp = chord[swapIdx];
      chord[swapIdx] = chord[swapIdx + 1];
      chord[swapIdx + 1] = tmp;
    }

    var spacing = 0.06 + Math.random() * 0.05;
    for (var i = 0; i < chord.length; i++) {
      var jit = (Math.random() - 0.5) * 0.025; // ±12.5ms micro-timing jitter
      motifAddNote(motif, chord[i], i * spacing + jit, 1.0 + Math.random() * 0.8, 0.82 + Math.random() * 0.18, 1);
    }
    melodyIdx = chord[chord.length - 1];
    motif.endDegree = melodyIdx;
    return motif;
  }

  // --- Cluster: baroque trill (or mordent, or wide trill) ---
  // The trill's anchor note (low / mIdx) is the resolution.
  function buildLibClusterTrill() {
    var motif = makeMotif("trill");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");
    // 20% chance: wider interval (third instead of step)
    var interval = Math.random() < 0.20 ? 2 : 1;

    // 20% chance: mordent — three-note ornament instead of a full trill
    if (Math.random() < 0.20) {
      var mIdx;
      // Pick the anchor as a chord tone when one fits in scale range
      if (chordTones && Math.random() < HARMONIC_RESOLUTION_FORCE_PROB) {
        var candidates = [];
        for (var ci = 0; ci < chordTones.length; ci++) {
          if (chordTones[ci] <= LIB_SCALE_4.length - 1 - interval) candidates.push(chordTones[ci]);
        }
        mIdx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)]
                                 : Math.floor(Math.random() * (LIB_SCALE_4.length - interval));
      } else {
        mIdx = Math.floor(Math.random() * (LIB_SCALE_4.length - interval));
      }
      var nIdx = mIdx + interval;
      var sp = 0.05 + Math.random() * 0.02;
      motifAddNote(motif, mIdx, 0,      0.18, 0.65, 1);
      motifAddNote(motif, nIdx, sp,     0.18, 0.6, 1);
      motifAddNote(motif, mIdx, sp * 2, 1.4 + Math.random() * 0.6, 0.9, 1);
      melodyIdx = mIdx;
      motif.endDegree = mIdx;
      return motif;
    }

    var noteCount = 4 + Math.floor(Math.random() * 4);
    // Bias the trill's anchor (lowIdx) toward a chord tone half the time so
    // the trill orbits a meaningful pitch in the current harmonic center.
    var lowIdx;
    if (chordTones && Math.random() < HARMONIC_RESOLUTION_FORCE_PROB) {
      var candidates = [];
      for (var ci = 0; ci < chordTones.length; ci++) {
        if (chordTones[ci] <= LIB_SCALE_4.length - 1 - interval) candidates.push(chordTones[ci]);
      }
      lowIdx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)]
                                 : Math.floor(Math.random() * (LIB_SCALE_4.length - interval));
    } else {
      lowIdx = Math.floor(Math.random() * (LIB_SCALE_4.length - interval));
    }
    var highIdx = lowIdx + interval;
    var spacing = 0.045 + Math.random() * 0.025;

    for (var i = 0; i < noteCount; i++) {
      var idx = i % 2 === 0 ? lowIdx : highIdx;
      var jt = (Math.random() - 0.5) * 0.012;
      motifAddNote(motif, idx, i * spacing + jt, 0.2 + Math.random() * 0.15, 0.55 + Math.random() * 0.15, 1);
    }
    if (Math.random() < 0.7) {
      motifAddNote(motif, lowIdx, noteCount * spacing + 0.02, 1.4 + Math.random() * 0.6, 0.85, 1);
    }
    melodyIdx = lowIdx;
    motif.endDegree = lowIdx;
    return motif;
  }

  // --- Cluster: slow lyrical air (Markov-walked melody) ---
  // 4-6 sustained notes, ~1s each, breathy spacing between starts. A
  // wandering melodic line — the lyrical counterpart to the ornamental
  // rolls/trills/grace patterns. First note "states" (longer), last note
  // "resolves" (longest), middle notes flow.
  function buildLibClusterAir() {
    var motif = makeMotif("air");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");

    var noteCount = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6
    var t = 0;

    for (var i = 0; i < noteCount; i++) {
      // Last note is the resolution; the rest take the gentle base bias.
      if (i === noteCount - 1) {
        melodyIdx = resolveDegree(melodyIdx, LIB_MELODY_MARKOV[melodyIdx], chordTones);
      } else {
        melodyIdx = markovNextChordBiased(LIB_MELODY_MARKOV[melodyIdx], chordTones, HARMONIC_BIAS_BASE);
      }

      var dur;
      if (i === 0) dur = 1.2 + Math.random() * 0.6;            // statement
      else if (i === noteCount - 1) dur = 1.5 + Math.random() * 0.8; // resolution
      else dur = 0.7 + Math.random() * 0.5;                    // middle

      // Arc-shaped gain (quieter ends, slight peak in the middle) plus jitter
      var pos = noteCount > 1 ? i / (noteCount - 1) : 0.5;
      var gain = 0.78 + 0.18 * Math.sin(pos * Math.PI) + (Math.random() - 0.5) * 0.08;

      motifAddNote(motif, melodyIdx, t, dur, gain, 1);

      // Spacing between note starts — slight overlap with previous note's
      // ring is fine and feels legato.
      t += 0.55 + Math.random() * 0.45;
    }

    motif.endDegree = melodyIdx;
    return motif;
  }

  // --- Cluster: question-answer phrase ---
  // Bias the question's anchor note (qLow) toward a chord tone so the whole
  // phrase orbits around the current harmonic center.
  function buildLibClusterQA() {
    var motif = makeMotif("qa");
    motif.scaleLen = LIB_SCALE_4.length;
    var chordTones = getChordTonesFor("library", "melody");
    var qLow;
    if (chordTones && Math.random() < HARMONIC_RESOLUTION_FORCE_PROB) {
      var lowCandidates = [];
      for (var ci = 0; ci < chordTones.length; ci++) {
        if (chordTones[ci] <= 2) lowCandidates.push(chordTones[ci]);
      }
      qLow = lowCandidates.length ? lowCandidates[Math.floor(Math.random() * lowCandidates.length)]
                                  : Math.floor(Math.random() * 3);
    } else {
      qLow = Math.floor(Math.random() * 3);
    }
    var intervalRnd = Math.random();
    var qHigh;
    if (intervalRnd < 0.5) qHigh = qLow + 2;
    else if (intervalRnd < 0.75) qHigh = qLow + 1;
    else qHigh = qLow + 3;
    if (qHigh >= LIB_SCALE_4.length) qHigh = qLow + 2;

    // 25% chance: inverted phrase — descending question, ascending answer
    var inverted = Math.random() < 0.25;
    var qGap = 0.22 + Math.random() * 0.2;
    var q1 = inverted ? qHigh : qLow;
    var q2 = inverted ? qLow : qHigh;

    motifAddNote(motif, q1, 0,    0.75 + Math.random() * 0.2, 0.9, 1);
    motifAddNote(motif, q2, qGap, 0.9 + Math.random() * 0.3, 0.9, 1);

    var ansStart = 0.7 + Math.random() * 0.8;        // wider Q->A gap variance
    var ansCount = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
    var aIdx = q2;
    var dir = inverted ? 1 : -1;
    for (var i = 0; i < ansCount; i++) {
      var step = 0.26 + Math.random() * 0.14;
      motifAddNote(motif, aIdx, ansStart + i * step, 0.7 + i * 0.35, 0.82, 1);
      aIdx = Math.max(0, Math.min(LIB_SCALE_4.length - 1, aIdx + dir));
    }
    melodyIdx = aIdx;
    motif.endDegree = aIdx;
    return motif;
  }

  function emitMotifEvent(ev) {
    if (motifListeners.length === 0) return;
    emitMulticast(motifListeners, [ev]);
  }
  function emitNoteEvent(ev) {
    if (noteListeners.length === 0) return;
    emitMulticast(noteListeners, [ev]);
  }
  function emitDroneEvent(payload)   { emitMulticast(droneListeners,   [payload]); }
  function emitAmbientEvent(payload) { emitMulticast(ambientListeners, [payload]); }
  function emitPreviewEvent(track, layer, active) {
    emitMulticast(previewListeners, [track, layer, active]);
  }

  // Convert a frequency in Hz to a scientific-pitch note name (e.g. C5).
  // Used by silent-layer log emits so each row has a humanly meaningful detail.
  var NOTE_NAMES_FLAT = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  function freqToNoteName(hz) {
    if (!hz || hz <= 0) return "";
    var midi = 69 + 12 * Math.log2(hz / 440);
    var rounded = Math.round(midi);
    var octave = Math.floor(rounded / 12) - 1;
    return NOTE_NAMES_FLAT[((rounded % 12) + 12) % 12] + octave;
  }

  // Total elapsed time of a motif: max(note.offset + note.dur) across notes.
  function motifDurationSec(motif) {
    var max = 0;
    for (var i = 0; i < motif.notes.length; i++) {
      var end = motif.notes[i].offset + motif.notes[i].dur;
      if (end > max) max = end;
    }
    return max;
  }

  // Minimum breath after a motif before the next one can start. Random so
  // back-to-back fires don't sound mechanical even at high RATE.
  var MOTIF_MIN_BREATH_MS = [200, 500]; // [floor, floor + window]

  // Per-pattern fire weights. Renormalized internally — tune freely.
  // AIR is weighted higher because it's the only sustained-line texture and
  // the others (especially roll/trill) are perceptually denser per fire.
  var LIB_MELODY_CLUSTER_WEIGHTS = {
    single: 0.15,
    grace:  0.15,
    roll:   0.15,
    trill:  0.15,
    qa:     0.15,
    air:    0.25,
  };

  // Sycorax ghost-tone cluster pattern weights. Renormalized internally.
  //   single — current default: 1 long sustained tone
  //   chord  — 2-3 simultaneous detuned tones (the current 15% case)
  //   drift  — 3-4 Markov-walked notes overlapping (AIR analog, slow procession)
  //   swell  — 1 long tone with a more dramatic intensity arc
  //   echo   — a tone + a quieter dissonant echo (tritone or min2)
  var SYC_GHOST_CLUSTER_WEIGHTS = {
    single: 0.25,
    chord:  0.15,
    drift:  0.25,
    swell:  0.15,
    echo:   0.20,
  };

  // SYC_GHOST_SCALE has 7 entries. Tritone in this scale ≈ +3 indices,
  // minor 2nd ≈ +1. Weighted random pick.
  var SYC_GHOST_ECHO_INTERVALS = {
    "3": 0.6, // tritone (favored — sharpens the dissonance most)
    "1": 0.4, // minor 2nd
  };

  // ==========================================================================
  // SYCORAX WATERPHONE — TUNABLES
  //
  // Hybrid synthesis combining additive inharmonic partials (the ringing
  // "bell" backbone that rises above the drone) with a swelling FM bloom
  // (the dense metallic wash during sustain). Defaults were dialed in via
  // waterphone-sandbox.html — adjust here if the layer needs to sit
  // differently in the Sycorax mix.
  // ==========================================================================
  var SYC_WATERPHONE_PARAMS = {
    shimmer: 1.30,        // multiplier on upper-partial tremolo depth
    bloomLevel: 0.28,     // FM carrier gain (relative to envelope peak)
    bloomIntensity: 2.4,  // FM modulator peak as × fundamental
    wail: 1.8,            // glissando: total % downward drift over the note
    wobble: 2.0,          // shared body wobble depth, % of each freq
    bodyWobbleRate: 0.6,  // Hz — slow tidal rate for the shared body wobble
  };

  // Per-motif fire weights. Multi-note motifs outnumber single-note ones so
  // the waterphone has melodic gesture rather than always sitting on a tone.
  // Tuned in waterphone-motifs-sandbox.html — adjust freely.
  var SYC_WATERPHONE_CLUSTER_WEIGHTS = {
    tone:         0.20,
    call:         0.18,
    lament:       0.16,
    reach:        0.12,
    pendulum:     0.14,
    apparition:   0.12,
    resonantPair: 0.08,
  };

  // Build a fresh motif using one of the cluster patterns.
  function buildFreshLibraryMelodyMotif() {
    var kind = pickWeighted(LIB_MELODY_CLUSTER_WEIGHTS);
    if (kind === "single") return buildLibClusterSingle();
    if (kind === "grace")  return buildLibClusterGrace();
    if (kind === "roll")   return buildLibClusterRoll();
    if (kind === "trill")  return buildLibClusterTrill();
    if (kind === "qa")     return buildLibClusterQA();
    return buildLibClusterAir();
  }

  // --- Markov-driven plucked harpsichord melody ---
  // Each fire either builds a fresh motif (single / grace / roll / trill / Q&A)
  // and captures it, or recalls a stored motif from memory — sometimes
  // verbatim, sometimes transformed. Bimodal scheduling — sometimes quick
  // succession, sometimes longer breaths — to avoid a metronomic cadence.
  function libraryMelody() {
    if (!playing || currentTrack !== "library") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("library", "melody");

    var played = null; // the motif that actually fired (used to floor the next gap)

    if (Math.random() >= 0.10) {
      // Decide action. Force "generate" until the memory has warmed up so
      // we have material worth recalling.
      var memSize = motifBufferSize("library", "melody");
      var action;
      if (memSize === 0) {
        action = "generate";
      } else {
        // Ramp: scale recall weights by min(memSize / RAMP_FULL, 1).
        var ramp = Math.min(memSize / MOTIF_RECALL_RAMP_FULL, 1);
        action = pickWeighted({
          generate:        MOTIF_ACTION_WEIGHTS.generate,
          recallTransform: MOTIF_ACTION_WEIGHTS.recallTransform * ramp,
          recallVerbatim:  MOTIF_ACTION_WEIGHTS.recallVerbatim  * ramp,
        });
      }

      if (action === "generate") {
        var fresh = buildFreshLibraryMelodyMotif();
        playLibraryMotif(fresh, out, now);
        captureMotif("library", "melody", fresh);
        played = fresh;
        emitMotifEvent({
          type: "fire", track: "library", layer: "melody",
          time: now, motifId: fresh.id,
          cluster: fresh.sourceCluster, action: "fresh", transform: null,
        });
      } else {
        var stored = recallMotif("library", "melody");
        if (stored) {
          var motif = cloneMotif(stored);
          if (action === "recallTransform") {
            motif = applyMotifTransform(motif);
          }
          playLibraryMotif(motif, out, now);
          // Update Markov state to the played motif's last degree so
          // subsequent fresh generations continue from there musically.
          melodyIdx = Math.max(0, Math.min(LIB_SCALE_4.length - 1, motif.endDegree));
          played = motif;
          emitMotifEvent({
            type: "fire", track: "library", layer: "melody",
            time: now, motifId: motif.id,
            cluster: motif.sourceCluster,
            action: action === "recallTransform" ? "transform" : "verbatim",
            transform: motif.lastTransform,
          });
        } else {
          // Memory race: fall back to fresh
          var fallback = buildFreshLibraryMelodyMotif();
          playLibraryMotif(fallback, out, now);
          captureMotif("library", "melody", fallback);
          played = fallback;
          emitMotifEvent({
            type: "fire", track: "library", layer: "melody",
            time: now, motifId: fallback.id,
            cluster: fallback.sourceCluster, action: "fresh", transform: null,
          });
        }
      }
    }

    // Bimodal gap: 30% quick impulse (2–4s), 70% breath (5–12s)
    var gap = Math.random() < 0.30 ? 2000 + Math.random() * 2000 : 5000 + Math.random() * 7000;
    // Hard floor: even at extreme RATE, the next fire can't begin until the
    // current motif has finished sounding (+ a randomized breath).
    var floor = 0;
    if (played) {
      var breath = MOTIF_MIN_BREATH_MS[0] + Math.random() * MOTIF_MIN_BREATH_MS[1];
      floor = motifDurationSec(played) * 1000 + breath;
    }
    scheduleWithRate(libraryMelody, gap, "library", "melody", floor);
  }

  // --- Markov-driven music box pings ---
  function libraryMusicBox() {
    if (!playing || currentTrack !== "library") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("library", "musicBox");

    // CLUSTER = probability of a 2-3 note quick run vs a single ping.
    // DECAY  = per-note duration scale.
    // SHIMMER = 3rd-harmonic overtone gain (sparkly metallic character).
    var clusterProb = getLayerParam("library", "musicBox", "cluster", 0.2);
    var decayScale  = getLayerParam("library", "musicBox", "decay", 1.0);
    var shimmerGain = getLayerParam("library", "musicBox", "shimmer", 0.006);
    var isRun = Math.random() < clusterProb;
    var noteCount = isRun ? 2 + Math.floor(Math.random() * 2) : 1;
    var chordTones = getChordTonesFor("library", "musicBox");
    var firstFreq = null;

    for (var ni = 0; ni < noteCount; ni++) {
      var offset = ni * 0.15;
      var t = now + offset;

      // Last note of a run is the resolution; single pings always resolve.
      if (ni === noteCount - 1) {
        boxIdx = resolveDegree(boxIdx, LIB_BOX_MARKOV[boxIdx], chordTones);
      } else {
        boxIdx = markovNextChordBiased(LIB_BOX_MARKOV[boxIdx], chordTones, HARMONIC_BIAS_BASE);
      }
      var freq = LIB_SCALE_5[boxIdx];
      if (firstFreq === null) firstFreq = freq;
      var dur = (0.6 + Math.random() * 0.4) * decayScale;
      // Per-note velocity (loudness): gives the music box dynamic variation and
      // drives the glint overlay's rise height. Normalized 0..1; applied as a
      // gain multiplier so even the softest ping (0.45) stays audible.
      var velocity = 0.45 + Math.random() * 0.55;
      var velGain = 0.4 + 0.6 * velocity;          // 0.67..1.0 audible range

      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045 * velGain, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.015 * velGain, t + 0.1);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);

      // 3rd-harmonic overtone (gain controlled by SHIMMER knob; scaled by velocity)
      var h = c.createOscillator();
      var hg = c.createGain();
      h.type = "sine";
      h.frequency.setValueAtTime(freq * 3, t);
      h.connect(hg);
      hg.connect(out);
      hg.gain.setValueAtTime(shimmerGain * velGain, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.5);
      hg.gain.linearRampToValueAtTime(0, t + dur * 0.6);
      h.start(t);
      h.stop(t + dur + 0.01);

      // Per-note event so the spiral viz can flash a sparkle at this ping's
      // exact pitch and time (drives the music-box glint overlay). velocity →
      // glint rise height.
      emitNoteEvent({ track: "library", layer: "musicBox", freq: freq, startTime: t, duration: dur, velocity: velocity });
    }

    if (firstFreq !== null) {
      emitMotifEvent({
        type: "fire", track: "library", layer: "musicBox", time: now,
        detail: freqToNoteName(firstFreq) +
                (noteCount > 1 ? " · " + noteCount + " notes" : ""),
      });
    }

    var gap = isRun
      ? 8000 + Math.random() * 8000
      : 5000 + Math.random() * 7000;
    scheduleWithRate(libraryMusicBox, gap, "library", "musicBox");
  }

  // --- Tick-tock with personality ---
  function libraryClock() {
    if (!playing || currentTrack !== "library") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lg("library", "clock");

    // Emit a "start" log entry only when the clock re-engages after a
    // gap (>5 s of silence), not every tick. Avoids flooding the log.
    maybeEmitSessionStart("library", "clock", now);

    // PITCH    = tick/tock frequency multiplier (grandfather → wristwatch).
    // WANDER   = inter-tick drift range (ms), 0 = mechanical precision.
    // MISCHIEF = combined probability of a skip or a double-tick (2/3 skip,
    //            1/3 double — matches the original 10% / 5% split when
    //            MISCHIEF = 0.15).
    var clockPitch    = getLayerParam("library", "clock", "pitch", 1.0);
    var clockWander   = getLayerParam("library", "clock", "wander", 60);
    var clockMischief = getLayerParam("library", "clock", "mischief", 0.15);
    var skipProb    = clockMischief * (2 / 3);
    var doubleProb  = clockMischief * (1 / 3);

    var rnd = Math.random();

    // Skip
    if (rnd < skipProb) {
      tickState = !tickState;
      scheduleWithRate(libraryClock,
        800 + (Math.random() * clockWander - clockWander / 2),
        "library", "clock");
      return;
    }

    // Double-tick
    var doDouble = rnd >= skipProb && rnd < skipProb + doubleProb;
    var ticks = doDouble ? 2 : 1;

    for (var i = 0; i < ticks; i++) {
      var t = now + i * 0.08;
      var isTock = tickState;
      tickState = !tickState;

      var fStart = (isTock ? 1800 : 2200) * clockPitch;
      var fEnd   = (isTock ? 1200 : 1600) * clockPitch;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(fStart, t);
      o.frequency.exponentialRampToValueAtTime(fEnd, t + 0.008);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(isTock ? 0.0096 : 0.0144, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t);
      o.stop(t + 0.05);
    }

    var drift = Math.random() * clockWander - clockWander / 2;
    scheduleWithRate(libraryClock, 800 + drift, "library", "clock");
  }

  // --- Living-voice male humming ---
  // Ported from the library-hum-preview prototype. Every per-note
  // parameter (sustain, attack, jitter depth/rate, shimmer depth/rate,
  // vibrato depth/rate, inter-note gap) is drawn fresh from a small
  // range, so phrases never repeat identically. Vowel is chosen per
  // phrase via a neighbor-biased Markov walk over {ng, oo, uh, oh, ah}.
  //
  // Tuned defaults: low instability + slight per-note variation, wide
  // phrase-length and sustain ranges. See HUM_TUNING below.
  var HUM_TUNING = {
    jitterDepth:  [3,   15],   // cents — slow-noise pitch wobble
    jitterRate:   [3,    7],   // Hz    — keyframes/sec of slow noise
    shimmerDepth: [3,   12],   // %     — tremolo wobble on amplitude
    shimmerRate:  [3,    8],   // Hz
    vibDepth:     [0.4,  1.5], // Hz of pitch modulation (sine LFO)
    vibRate:      [4.5,  5.8], // Hz
    phraseLen:    [2,   12],   // notes per phrase
    dur:          [0.3,  3.0], // sec per note
    attack:       [0.02, 0.6], // sec per note
    gap:          [0.0,  1.5], // sec between notes within a phrase
  };
  // Per-fire scheduling stays at the legacy 25-50s sparseness so the
  // hum still feels rare in the overall track mix (the RATE slider
  // scales this base via scheduleWithRate).
  // Phrase-length distribution: relative weight per length, starting at
  // HUM_TUNING.phraseLen[0] (= 2 notes). Tuned so the 3–5 range dominates and
  // 8+ are rare.
  //                          2   3   4   5   6  7  8  9  10   11   12
  var HUM_PHRASE_WEIGHTS = [  8, 21, 23, 19, 12, 9, 4, 2,  1, 0.7, 0.3];
  var HUM_PHRASE_BASE_MS = 10000;
  var HUM_PHRASE_JITTER_MS = 20000;

  function humRand(rangeKey) {
    var r = HUM_TUNING[rangeKey];
    return r[0] + Math.random() * (r[1] - r[0]);
  }

  // Weighted pick of phrase length from HUM_PHRASE_WEIGHTS.
  function pickHumPhraseLen() {
    var w = HUM_PHRASE_WEIGHTS, base = HUM_TUNING.phraseLen[0], total = 0, i;
    for (i = 0; i < w.length; i++) total += w[i];
    var r = Math.random() * total;
    for (i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return base + i; }
    return base + w.length - 1;
  }

  // Slow-noise buffer used by jitter/shimmer. Linearly interpolated
  // between random keyframes so the modulation reads as smooth wobble
  // rather than stepped noise.
  function humSlowNoiseBuffer(durationSec, changesPerSec) {
    var c = ctx;
    var samplesPerSlot = Math.max(1, Math.floor(c.sampleRate / changesPerSec));
    var totalSamples = Math.max(
      Math.floor(c.sampleRate * durationSec),
      samplesPerSlot * 4
    );
    var buf = c.createBuffer(1, totalSamples, c.sampleRate);
    var data = buf.getChannelData(0);
    var nKeys = Math.ceil(totalSamples / samplesPerSlot) + 2;
    var keys = new Float32Array(nKeys);
    for (var k = 0; k < nKeys; k++) keys[k] = Math.random() * 2 - 1;
    for (var i = 0; i < totalSamples; i++) {
      var pos = i / samplesPerSlot;
      var i0 = Math.floor(pos);
      var frac = pos - i0;
      data[i] = keys[i0] * (1 - frac) + keys[i0 + 1] * frac;
    }
    return buf;
  }

  // Play ONE hum note with a given vowel into an arbitrary output node — the
  // single-voice core of libraryHum (sawtooth → dual formants → shimmer →
  // envelope), factored out so prototypes can sound a specific vowel on demand.
  // Uses fixed, representative jitter/vibrato/shimmer values. gainMult scales
  // the (intentionally low) peak level.
  function playHumVowelNote(freq, vowelName, startTime, dur, out, gainMult) {
    var c = ctx;
    if (!c || !out) return;
    var vowel = LIB_HUM_VOWELS[vowelName] || LIB_HUM_VOWELS.uh;
    var t = startTime, noteDur = dur == null ? 1.4 : dur;
    var gm = gainMult == null ? 1 : gainMult;
    var safeAttack = Math.min(0.25, noteDur * 0.4);
    var safeRelease = Math.min(Math.max(0.05, noteDur * 0.4), Math.max(0.05, noteDur - safeAttack - 0.05));
    var plateauStart = t + safeAttack;
    var plateauEnd = t + noteDur - safeRelease;
    if (plateauEnd <= plateauStart) plateauEnd = plateauStart + 0.01;
    var noteEnd = t + noteDur;

    var voice = c.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(freq, t);

    var jitterSrc = c.createBufferSource();
    jitterSrc.buffer = humSlowNoiseBuffer(noteDur + 0.4, 6);
    var jitterGain = c.createGain();
    jitterGain.gain.setValueAtTime(8, t);
    jitterSrc.connect(jitterGain); jitterGain.connect(voice.detune);
    jitterSrc.start(t); jitterSrc.stop(t + noteDur + 0.1);

    var vib = c.createOscillator(), vibGain = c.createGain();
    vib.type = "sine"; vib.frequency.setValueAtTime(5, t);
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(3, t + 0.1);
    vib.connect(vibGain); vibGain.connect(voice.frequency);

    var f1 = c.createBiquadFilter();
    f1.type = "bandpass"; f1.frequency.setValueAtTime(vowel.f1, t); f1.Q.setValueAtTime(3, t);
    var f2 = c.createBiquadFilter();
    f2.type = "bandpass"; f2.frequency.setValueAtTime(vowel.f2, t); f2.Q.setValueAtTime(3.5, t);
    var f2Gain = c.createGain(); f2Gain.gain.setValueAtTime(0.5, t);
    var voiceMix = c.createGain();
    voice.connect(f1); voice.connect(f2);
    f1.connect(voiceMix); f2.connect(f2Gain); f2Gain.connect(voiceMix);

    var shimmerGain = c.createGain(); shimmerGain.gain.setValueAtTime(1.0, t);
    var shimmerSrc = c.createBufferSource();
    shimmerSrc.buffer = humSlowNoiseBuffer(noteDur + 0.4, 4);
    var shimmerDepthGain = c.createGain(); shimmerDepthGain.gain.setValueAtTime(0.12, t);
    shimmerSrc.connect(shimmerDepthGain); shimmerDepthGain.connect(shimmerGain.gain);
    shimmerSrc.start(t); shimmerSrc.stop(t + noteDur + 0.1);
    voiceMix.connect(shimmerGain);

    var env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.075 * gm, plateauStart);
    env.gain.setValueAtTime(0.072 * gm, plateauEnd);
    env.gain.linearRampToValueAtTime(0, noteEnd);
    shimmerGain.connect(env); env.connect(out);

    voice.start(t); voice.stop(t + noteDur + 0.05);
    vib.start(t); vib.stop(t + noteDur + 0.05);
  }

  function libraryHum() {
    if (!playing || currentTrack !== "library") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("library", "hum");

    // Vowel: start from a neighbor-walk step, then (per note) occasionally step
    // again within the phrase so the mouth shape shifts mid-hum. Steps follow
    // LIB_HUM_VOWEL_WALK, so changes stay to adjacent vowels (linguistic logic).
    humVowelIdx = markovNext(LIB_HUM_VOWEL_WALK[humVowelIdx], Math.random());
    var phraseStartVowelIdx = humVowelIdx;
    var vowel = LIB_HUM_VOWELS[LIB_HUM_VOWEL_POOL[humVowelIdx]];

    var phraseLen = pickHumPhraseLen();   // weighted toward 3–5 notes, 8+ rare
    var offset = 0;
    var chordTones = getChordTonesFor("library", "hum");
    var humFirstFreq = null, humLastFreq = null;

    for (var ni = 0; ni < phraseLen; ni++) {
      // Occasionally shift the vowel to a neighbor mid-phrase (never on note 0).
      if (ni > 0 && Math.random() < HUM_VOWEL_CHANGE_PROB) {
        humVowelIdx = markovNext(LIB_HUM_VOWEL_WALK[humVowelIdx], Math.random());
        vowel = LIB_HUM_VOWELS[LIB_HUM_VOWEL_POOL[humVowelIdx]];
      }
      // Phrase-internal notes: gentle pull toward chord tones (or vanilla
      // Markov if harmonic state is disabled for hum). Final note: full
      // resolution — strong chord-tone bias + occasional force-snap.
      if (ni === phraseLen - 1) {
        humIdx = resolveDegree(humIdx, LIB_HUM_MARKOV[humIdx], chordTones);
      } else {
        humIdx = markovNextChordBiased(LIB_HUM_MARKOV[humIdx], chordTones, HARMONIC_BIAS_BASE);
      }
      var freq = LIB_HUM_SCALE[humIdx];
      if (humFirstFreq === null) humFirstFreq = freq;
      humLastFreq = freq;
      var noteDur = humRand("dur");
      var attack = humRand("attack");
      // WAVER scales the slow-noise pitch-jitter depth.
      // VIBRATO scales the vibrato LFO depth.
      var humWaver = getLayerParam("library", "hum", "waver", 1.0);
      var humVib   = getLayerParam("library", "hum", "vibrato", 1.0);
      var jitterDepth = humRand("jitterDepth") * humWaver;
      var jitterRate = humRand("jitterRate");
      var shimmerDepth = humRand("shimmerDepth");
      var shimmerRate = humRand("shimmerRate");
      var vibDepth = humRand("vibDepth") * humVib;
      var vibRate = humRand("vibRate");
      var t = now + offset;
      // Clamp attack/release so envelope times stay monotonically
      // increasing. Without this, short notes with long attack (e.g.,
      // dur=0.3, attack=0.6) schedule envelope events out of time order
      // and linearRampToValueAtTime throws InvalidAccessError — silencing
      // the entire phrase. Attack caps at 40% of note; release fills the
      // rest with a minimum of 50ms plateau.
      var safeAttack  = Math.min(attack, noteDur * 0.4);
      var safeRelease = Math.min(Math.max(0.05, noteDur * 0.4), Math.max(0.05, noteDur - safeAttack - 0.05));
      var plateauStart = t + safeAttack;
      var plateauEnd   = t + noteDur - safeRelease;
      if (plateauEnd <= plateauStart) plateauEnd = plateauStart + 0.01;
      var noteEnd = t + noteDur;
      emitNoteEvent({ track: "library", layer: "hum", freq: freq, startTime: t, duration: noteDur,
                      vowel: LIB_HUM_VOWEL_POOL[humVowelIdx] });

      // Voice
      var voice = c.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(freq, t);

      // Jitter — slow-noise on detune
      var jitterBuf = humSlowNoiseBuffer(noteDur + 0.4, Math.max(0.5, jitterRate));
      var jitterSrc = c.createBufferSource();
      jitterSrc.buffer = jitterBuf;
      var jitterGain = c.createGain();
      jitterGain.gain.setValueAtTime(jitterDepth, t);
      jitterSrc.connect(jitterGain);
      jitterGain.connect(voice.detune);
      jitterSrc.start(t);
      jitterSrc.stop(t + noteDur + 0.1);

      // Vibrato — sine LFO on frequency
      var vib = c.createOscillator();
      var vibGain = c.createGain();
      vib.type = "sine";
      vib.frequency.setValueAtTime(vibRate, t);
      vibGain.gain.setValueAtTime(0, t);
      vibGain.gain.linearRampToValueAtTime(vibDepth, t + 0.1);
      vib.connect(vibGain);
      vibGain.connect(voice.frequency);

      // Formants — OPENNESS knob scales bandpass width by dividing Q.
      // openness=1.0 keeps the default vowel-y Q3/Q3.5; openness>1
      // widens the passbands so more of the note's harmonics survive
      // (the hum's pitch becomes visible on the spiral); openness<1
      // tightens them for a more pronounced, isolated vowel.
      var humOpenness = getLayerParam("library", "hum", "openness", 1.0);
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(vowel.f1, t);
      f1.Q.setValueAtTime(3 / humOpenness, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(vowel.f2, t);
      f2.Q.setValueAtTime(3.5 / humOpenness, t);
      var f2Gain = c.createGain();
      f2Gain.gain.setValueAtTime(0.5, t);

      var voiceMix = c.createGain();
      voice.connect(f1);
      voice.connect(f2);
      f1.connect(voiceMix);
      f2.connect(f2Gain);
      f2Gain.connect(voiceMix);

      // Shimmer — tremolo gain driven by a slow-noise source
      var shimmerGain = c.createGain();
      shimmerGain.gain.setValueAtTime(1.0, t);
      var shimmerBuf = humSlowNoiseBuffer(noteDur + 0.4, Math.max(0.5, shimmerRate));
      var shimmerSrc = c.createBufferSource();
      shimmerSrc.buffer = shimmerBuf;
      var shimmerDepthGain = c.createGain();
      shimmerDepthGain.gain.setValueAtTime(shimmerDepth / 100, t);
      shimmerSrc.connect(shimmerDepthGain);
      shimmerDepthGain.connect(shimmerGain.gain);
      shimmerSrc.start(t);
      shimmerSrc.stop(t + noteDur + 0.1);
      voiceMix.connect(shimmerGain);

      // Envelope — uses clamped safeAttack/safeRelease above.
      // Peak gain bumped from 0.045 → 0.075 so the formant-filtered hum
      // sits closer in level to drone/melody (its bandpass stack drops a
      // lot of signal energy; the source needs to be louder to compensate).
      var env = c.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.075, plateauStart);
      env.gain.setValueAtTime(0.072, plateauEnd);
      env.gain.linearRampToValueAtTime(0, noteEnd);
      shimmerGain.connect(env);
      env.connect(out);

      voice.start(t);
      voice.stop(t + noteDur + 0.05);
      vib.start(t);
      vib.stop(t + noteDur + 0.05);

      offset += noteDur + humRand("gap");
    }

    // After the loop, `offset` is the total phrase duration in seconds.
    // The base schedule interval can be shorter than a long phrase
    // (phrases can run up to ~52s with max ranges), so without a clamp
    // the next phrase fires mid-current-phrase and the user hears two
    // overlapping hums. Require at least 1.5s of silence after the
    // phrase finishes before the next one is allowed to start.
    //
    // scheduleWithRate divides baseDelay by the layer's `rate` to get the
    // actual setTimeout. If the user has moved the HUM rate slider right,
    // rate > 1 and the divided result can dip back below the phrase
    // length. Multiply our floor by rate so the *effective* delay is
    // preserved no matter where the rate slider sits.
    var phraseDurationMs = offset * 1000;
    var rate = getRate("library", "hum");
    var baseDelay = HUM_PHRASE_BASE_MS + Math.random() * HUM_PHRASE_JITTER_MS;
    var minBaseDelay = (phraseDurationMs + 1500) * rate;
    var nextDelay = Math.max(baseDelay, minBaseDelay);
    scheduleWithRate(libraryHum, nextDelay, "library", "hum");

    if (humFirstFreq !== null) {
      var vowelLabel = LIB_HUM_VOWEL_POOL[phraseStartVowelIdx] || "";
      if (humVowelIdx !== phraseStartVowelIdx) vowelLabel += "→" + (LIB_HUM_VOWEL_POOL[humVowelIdx] || "");
      var rangeLabel = freqToNoteName(humFirstFreq);
      if (humLastFreq !== humFirstFreq) {
        rangeLabel += "→" + freqToNoteName(humLastFreq);
      }
      emitMotifEvent({
        type: "fire", track: "library", layer: "hum", time: now,
        detail: (vowelLabel ? '"' + vowelLabel + '" · ' : "") +
                rangeLabel + " · " + phraseLen + " notes",
      });
    }
  }

  // --- Cage-style weighted ambient event pool ---
  function libraryAmbient() {
    if (!playing || currentTrack !== "library") return;
    var out = lgp("library", "ambient");

    // VARIETY = pool weighting mode (uniform / default / focused)
    var variety = getLayerParam("library", "ambient", "variety", "default");
    var event = weightedChoiceVariety(LIB_AMBIENT_POOL, variety);
    emitAmbientEvent({ type: "fire", track: "library", layer: "ambient", event: event, time: ctx.currentTime });
    switch (event) {
      case "page_turn":
        libPageTurn(out);
        break;
      case "quill_scratch":
        libQuillScratch(out);
        break;
      case "clock_cluster":
        libClockCluster(out);
        break;
      case "book_thud":
        libBookThud(out);
        break;
      case "spell_wheeze":
        libSpellWheeze(out);
        break;
      case "owl_hoot":
        libOwlHoot(out);
        break;
      case "distant_waves":
        libDistantWaves(out);
        break;
      case "candle_sputter":
        libCandleSputter(out);
        break;
      case "ink_drip":
        libInkDrip(out);
        break;
      case "whispered_word":
        libWhisperedWord(out);
        break;
      case "footsteps_distant":
        libFootstepsDistant(out);
        break;
      case "ember_pop":
        libEmberPop(out);
        break;
    }

    // DENSITY = inter-event interval scale. Lower = more frequent events.
    var density = getLayerParam("library", "ambient", "density", 1.0);
    if (density < 0.05) density = 0.05;
    scheduleWithRate(libraryAmbient,
      (14000 + Math.random() * 21000) / density,
      "library", "ambient");
  }

  // --- Library ambient event synthesis ---

  function libPageTurn(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.3 + Math.random() * 0.4;
    var cutoff = 3000 + Math.random() * 4000;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.setValueAtTime(cutoff, now);
    f.frequency.linearRampToValueAtTime(cutoff + 3000, now + dur);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.025, now + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function libQuillScratch(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.6 + Math.random() * 0.4;
    var scratches = 4 + Math.floor(Math.random() * 4);
    var centerFreq = 4000 + Math.random() * 3000;
    for (var s = 0; s < scratches; s++) {
      var st = now + (s / scratches) * dur;
      var sLen = 0.03 + Math.random() * 0.03;
      var n = noiseSource(sLen);
      var g = c.createGain();
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(centerFreq + Math.random() * 1000, st);
      f.Q.setValueAtTime(5, st);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.015, st);
      g.gain.linearRampToValueAtTime(0, st + sLen);
      startNoise(n, st);
    }
  }

  function libClockCluster(out) {
    var c = ctx;
    var now = c.currentTime;
    var count = 3 + Math.floor(Math.random() * 4);
    var clusterDur = 0.3 + Math.random() * 0.3;
    for (var i = 0; i < count; i++) {
      var t = now + (i / count) * clusterDur;
      var isTock = i % 2 === 1;
      var pitchVar = 0.9 + Math.random() * 0.2;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime((isTock ? 1800 : 2200) * pitchVar, t);
      o.frequency.exponentialRampToValueAtTime(
        (isTock ? 1200 : 1600) * pitchVar,
        t + 0.008
      );
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(isTock ? 0.01 : 0.015, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  function libBookThud(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.05;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(200, now);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0.10, now);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function libSpellWheeze(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.8 + Math.random() * 0.6;

    var noise = noiseSource(dur);
    var ng = c.createGain();
    var nf = c.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.setValueAtTime(600, now);
    nf.frequency.linearRampToValueAtTime(1200, now + dur * 0.4);
    nf.frequency.linearRampToValueAtTime(400, now + dur);
    nf.Q.setValueAtTime(4, now);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.018, now + dur * 0.15);
    ng.gain.setValueAtTime(0.015, now + dur * 0.5);
    ng.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(noise, now);

    var sparkleFreq = 800 + Math.random() * 600;
    var o = c.createOscillator();
    var og = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(sparkleFreq, now);
    o.frequency.linearRampToValueAtTime(sparkleFreq * 1.5, now + dur * 0.6);
    o.frequency.linearRampToValueAtTime(sparkleFreq * 0.7, now + dur);
    o.connect(og);
    og.connect(out);
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.012, now + dur * 0.2);
    og.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now);
    o.stop(now + dur + 0.01);

    var o2 = c.createOscillator();
    var og2 = c.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(sparkleFreq * 1.5 + 5, now);
    o2.frequency.linearRampToValueAtTime(sparkleFreq * 2, now + dur);
    o2.connect(og2);
    og2.connect(out);
    og2.gain.setValueAtTime(0, now);
    og2.gain.linearRampToValueAtTime(0.008, now + dur * 0.3);
    og2.gain.linearRampToValueAtTime(0, now + dur);
    o2.start(now);
    o2.stop(now + dur + 0.01);
  }

  function libOwlHoot(out) {
    var c = ctx;
    var now = c.currentTime;
    var baseFreq = 280 + Math.random() * 40;
    var hoots = Math.random() < 0.5 ? 2 : 3;
    for (var i = 0; i < hoots; i++) {
      var t = now + i * 0.45;
      var hDur = 0.25;

      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "sine";
      o.frequency.setValueAtTime(baseFreq, t);
      o.frequency.linearRampToValueAtTime(baseFreq * 0.85, t + hDur);
      f.type = "lowpass";
      f.frequency.setValueAtTime(500, t);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.03);
      g.gain.setValueAtTime(0.015, t + hDur * 0.6);
      g.gain.linearRampToValueAtTime(0, t + hDur);
      o.start(t);
      o.stop(t + hDur + 0.01);

      var h = c.createOscillator();
      var hg2 = c.createGain();
      h.type = "sine";
      h.frequency.setValueAtTime(baseFreq * 2.02, t);
      h.frequency.linearRampToValueAtTime(baseFreq * 1.7, t + hDur);
      h.connect(hg2);
      hg2.connect(out);
      hg2.gain.setValueAtTime(0, t);
      hg2.gain.linearRampToValueAtTime(0.005, t + 0.03);
      hg2.gain.linearRampToValueAtTime(0, t + hDur);
      h.start(t);
      h.stop(t + hDur + 0.01);
    }
  }

  function libDistantWaves(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 2.5 + Math.random() * 1.5;

    var n = noiseSource(dur);
    var g = c.createGain();
    var lp = c.createBiquadFilter();
    var hp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(200, now);
    lp.frequency.linearRampToValueAtTime(800, now + dur * 0.35);
    lp.frequency.linearRampToValueAtTime(150, now + dur);
    lp.Q.setValueAtTime(0.5, now);
    hp.type = "highpass";
    hp.frequency.setValueAtTime(80, now);
    n.connect(lp);
    lp.connect(hp);
    hp.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.02, now + dur * 0.3);
    g.gain.setValueAtTime(0.018, now + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  // Flickering candle flame: continuous high-pass hiss bed plus random pops
  function libCandleSputter(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 1.0 + Math.random() * 1.5;
    var vol = 0.02;

    var baseN = noiseSource(dur);
    var baseG = c.createGain();
    var baseHP = c.createBiquadFilter();
    baseHP.type = "highpass";
    baseHP.frequency.setValueAtTime(2500, now);
    baseN.connect(baseHP);
    baseHP.connect(baseG);
    baseG.connect(out);
    baseG.gain.setValueAtTime(0, now);
    baseG.gain.linearRampToValueAtTime(vol * 0.5, now + 0.08);
    baseG.gain.setValueAtTime(vol * 0.5, now + dur - 0.15);
    baseG.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(baseN, now);

    var popCount = 3 + Math.floor(Math.random() * 6);
    var popFreq = 600 + Math.random() * 600;
    for (var i = 0; i < popCount; i++) {
      var t = now + Math.random() * dur;
      var popDur = 0.02 + Math.random() * 0.04;
      var popN = noiseSource(popDur);
      var popG = c.createGain();
      var popBP = c.createBiquadFilter();
      popBP.type = "bandpass";
      popBP.frequency.setValueAtTime(popFreq + (Math.random() - 0.5) * 600, t);
      popBP.Q.setValueAtTime(3 + Math.random() * 3, t);
      popN.connect(popBP);
      popBP.connect(popG);
      popG.connect(out);
      popG.gain.setValueAtTime(vol * (1.2 + Math.random() * 1.2), t);
      popG.gain.exponentialRampToValueAtTime(0.0001, t + popDur);
      startNoise(popN, t);
    }
  }

  // Water-drop into a puddle. Real drops have two acoustic components:
  //   (a) a brief noise transient at the surface-break ("plip" click)
  //   (b) a rising-pitch cavity resonance — as the air bubble shrinks, its
  //       resonant frequency climbs. This is the psycho-acoustic signature
  //       of a drop and the reason a pure falling sine always sounds "synth."
  function libInkDrip(out) {
    var c = ctx;
    var now = c.currentTime;
    // 30% chance of a double-drop (two drips nearly at once), else a single drip
    var drops = Math.random() < 0.30 ? 2 : 1;

    function dropAt(t, pitch, vol) {
      // Surface-break transient (short bandpass noise click)
      var transDur = 0.015;
      var tn = noiseSource(transDur);
      var tg = c.createGain();
      var tbp = c.createBiquadFilter();
      tbp.type = "bandpass";
      tbp.frequency.setValueAtTime(pitch * 2.5, t);
      tbp.Q.setValueAtTime(2, t);
      tn.connect(tbp); tbp.connect(tg); tg.connect(out);
      tg.gain.setValueAtTime(vol * 0.5, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + transDur);
      startNoise(tn, t);

      // Rising-pitch cavity resonance
      var dur = 0.2 + Math.random() * 0.1;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(pitch * 0.4, t);
      o.frequency.exponentialRampToValueAtTime(pitch, t + 0.022);
      o.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + dur);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }

    // Tighter offset when two drops fire together so they read as "at once"
    var doubleSpacing = drops === 2 ? 0.05 + Math.random() * 0.08 : 0;
    for (var i = 0; i < drops; i++) {
      var t = now + i * doubleSpacing;
      var dropPitch = 245 + Math.random() * 60; // 245–305 Hz, centered near 275
      var baseVol = 0.069;
      dropAt(t, dropPitch, baseVol);
    }
  }

  // Single short whispered syllable — formant-filtered noise with gentle drift
  function libWhisperedWord(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.18 + Math.random() * 0.2;
    var vol = 0.04;
    var formants = [
      [700, 2500], [500, 2000], [400, 2800], [600, 1800], [850, 2200],
    ];
    var fm = formants[Math.floor(Math.random() * formants.length)];

    var n = noiseSource(dur);
    var g = c.createGain();
    var f1 = c.createBiquadFilter();
    var f2 = c.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(fm[0], now);
    f1.frequency.linearRampToValueAtTime(fm[0] * (0.9 + Math.random() * 0.2), now + dur);
    f1.Q.setValueAtTime(10, now);
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(fm[1], now);
    f2.frequency.linearRampToValueAtTime(fm[1] * (0.9 + Math.random() * 0.2), now + dur);
    f2.Q.setValueAtTime(8, now);
    n.connect(f1);
    n.connect(f2);
    var mix = c.createGain();
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.2);
    g.gain.setValueAtTime(vol * 0.85, now + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function libFootstepsDistant(out) {
    var c = ctx;
    var now = c.currentTime;
    var count = 5;
    var interval = 0.6;
    var cutoff = 600;
    var volume = 0.04;
    for (var i = 0; i < count; i++) {
      var t = now + i * interval * (0.9 + Math.random() * 0.2);
      var stepLen = 0.08 + Math.random() * 0.04;
      var n = noiseSource(stepLen);
      var g = c.createGain();
      var f = c.createBiquadFilter();
      f.type = "lowpass";
      var heavy = i % 2 === 0;
      f.frequency.setValueAtTime(cutoff * (heavy ? 1.0 : 1.15), t);
      f.Q.setValueAtTime(1.5, t);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      var vol = volume * (heavy ? 1.0 : 0.7);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepLen);
      startNoise(n, t);
    }
  }

  function libEmberPop(out) {
    var c = ctx;
    var now = c.currentTime;
    var count = 6;
    var duration = 0.7;
    var brightness = 3500;
    var volume = 0.025;
    for (var i = 0; i < count; i++) {
      var t = now + Math.random() * duration;
      var popLen = 0.008 + Math.random() * 0.02;
      var n = noiseSource(popLen);
      var g = c.createGain();
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(brightness + Math.random() * 1500, t);
      f.Q.setValueAtTime(3, t);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      var vol = volume * (0.5 + Math.random() * 0.5);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + popLen);
      startNoise(n, t);
    }
  }

  // ==========================================================================
  // TRACK 4: SYCORAX'S SPELL — LAYER METHODS
  // ==========================================================================

  function scheduleSycorax() {
    if (!playing || currentTrack !== "sycorax") return;
    // Reset Markov state
    sycGhostIdx = Math.floor(Math.random() * SYC_GHOST_SCALE.length);
    sycDroneIdx = Math.floor(Math.random() * SYC_DRONE_CLUSTERS.length);
    sycHeartbeatIntensity = 0.7 + Math.random() * 0.3;
    sycWaterphoneIdx = Math.floor(Math.random() * SYC_GHOST_SCALE.length);
    // Launch all independent generative layers
    sycoraxDrone();
    sycoraxWhispers();
    sycoraxGhostTones();
    sycoraxHeartbeat();
    sycoraxScrape();
    // First waterphone note delayed a bit so the listener orients to the
    // drone + ghost first; the waterphone enters as a separate "voice".
    scheduleSyc(sycoraxWaterphone, 6000 + Math.random() * 8000);
    scheduleSyc(sycoraxAmbient, 8000 + Math.random() * 12000);
  }

  // --- Rotating dissonant drone clusters ---
  function sycoraxDrone() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lg("sycorax", "drone");
    var cluster = SYC_DRONE_CLUSTERS[sycDroneIdx % SYC_DRONE_CLUSTERS.length];
    // The cluster we just picked is the new "spell pose". Update before
    // any other layer reads it, then notify listeners.
    harmonicIdx = sycDroneIdx % SYC_DRONE_CLUSTERS.length;
    emitHarmonicChange("sycorax");
    sycDroneIdx = (sycDroneIdx + 1) % SYC_DRONE_CLUSTERS.length;

    // Mixer-exposed knobs. CYCLE LENGTH is a min/max range with clamping.
    var cycleMin = getLayerParam("sycorax", "drone", "cycleMin", 20);
    var cycleMax = getLayerParam("sycorax", "drone", "cycleMax", 28);
    if (cycleMax < cycleMin) cycleMax = cycleMin;
    var duration = cycleMin + Math.random() * (cycleMax - cycleMin);
    var fadeIn = 3 + Math.random() * 2;
    var fadeOut = 3 + Math.random() * 2;
    var darknessScale = getLayerParam("sycorax", "drone", "darkness", 1.0);
    var droneDrift   = getLayerParam("sycorax", "drone", "drift", 1.0);
    var cutoffBase = (150 + Math.random() * 200) * darknessScale;

    for (var ci = 0; ci < cluster.length; ci++) {
      var freq = cluster[ci];
      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, now);
      // DRIFT knob scales the per-cluster pitch deviation. 0 = locked
      // frequencies (more rigid dissonance); 1 = engine default (±3%);
      // higher = warbling, less stable.
      var driftAmt = 1 + ((Math.random() * 0.06) - 0.03) * droneDrift;
      var driftMid = 1 + ((Math.random() * 0.04) - 0.02) * droneDrift;
      o.frequency.linearRampToValueAtTime(freq * driftMid, now + duration * 0.35);
      o.frequency.linearRampToValueAtTime(freq * driftAmt, now + duration * 0.7);
      o.frequency.linearRampToValueAtTime(freq, now + duration);
      f.type = "lowpass";
      f.frequency.setValueAtTime(cutoffBase, now);
      f.frequency.linearRampToValueAtTime(cutoffBase + 100, now + duration * 0.4);
      f.frequency.linearRampToValueAtTime(cutoffBase - 30, now + duration);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.035, now + fadeIn);
      g.gain.setValueAtTime(0.035, now + duration - fadeOut);
      g.gain.linearRampToValueAtTime(0, now + duration);
      o.start(now);
      o.stop(now + duration + 0.1);
    }

    // SUB CHANCE knob: sub-bass rumble probability.
    var subChance = getLayerParam("sycorax", "drone", "subChance", 0.25);
    var hasSub = Math.random() < subChance;
    var subFreq = cluster[0] / 2;
    if (hasSub) {
      var o2 = c.createOscillator();
      var g2 = c.createGain();
      o2.type = "sine";
      o2.frequency.setValueAtTime(subFreq, now);
      o2.frequency.linearRampToValueAtTime(
        subFreq * (0.95 + Math.random() * 0.1),
        now + duration
      );
      o2.connect(g2);
      g2.connect(out);
      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(0.025, now + fadeIn);
      g2.gain.setValueAtTime(0.025, now + duration - fadeOut);
      g2.gain.linearRampToValueAtTime(0, now + duration);
      o2.start(now);
      o2.stop(now + duration + 0.1);
    }

    // Publish to the drone viz the same way libraryDrone does.
    emitDroneEvent({
      track: "sycorax",
      startTime: now,
      duration: duration,
      fadeIn: fadeIn,
      fadeOut: fadeOut,
      peakGain: 0.035,
      frequencies: cluster.slice(),
      subFreq: hasSub ? subFreq : null,
      subPeakGain: hasSub ? 0.025 : 0,
    });

    var overlap = 3 + Math.random() * 2;
    scheduleSyc(sycoraxDrone, (duration - overlap) * 1000);
  }

  // --- Varied formant whispers ---
  function sycoraxWhispers() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("sycorax", "whispers");

    // 15% rest
    if (Math.random() < 0.15) {
      scheduleWithRate(sycoraxWhispers, 6000 + Math.random() * 10000, "sycorax", "whispers");
      return;
    }

    // HUSHED scales the formant Qs (higher = vowel-y).
    // DRIFT  scales the formant frequency morph range.
    // LENGTH scales the per-whisper duration.
    var hushed   = getLayerParam("sycorax", "whispers", "hushed", 1.0);
    var wDrift   = getLayerParam("sycorax", "whispers", "drift", 1.0);
    var wLength  = getLayerParam("sycorax", "whispers", "length", 1.0);

    var formant =
      SYC_WHISPER_FORMANTS[
        Math.floor(Math.random() * SYC_WHISPER_FORMANTS.length)
      ];
    var dur = (1.5 + Math.random() * 2) * wLength;
    var qVal = (8 + Math.random() * 6) * hushed;

    // Primary whisper voice
    var t0 = now;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f1 = c.createBiquadFilter();
    var f2 = c.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(formant[0], t0);
    // Original drift: ±15% on F1, ±10% on F2. Centered at 1.0, scaled by wDrift.
    f1.frequency.linearRampToValueAtTime(
      formant[0] * (1 + ((Math.random() * 0.3) - 0.15) * wDrift),
      t0 + dur
    );
    f1.Q.setValueAtTime(qVal, t0);
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(formant[1], t0);
    f2.frequency.linearRampToValueAtTime(
      formant[1] * (1 + ((Math.random() * 0.2) - 0.1) * wDrift),
      t0 + dur
    );
    f2.Q.setValueAtTime(qVal - 2 * hushed, t0);
    n.connect(f1);
    n.connect(f2);
    var mix = c.createGain();
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.055, t0 + dur * 0.25);
    g.gain.linearRampToValueAtTime(0.055 * 0.7, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    startNoise(n, t0);

    // 20% double-whisper
    if (Math.random() < 0.2) {
      var formant2 =
        SYC_WHISPER_FORMANTS[
          Math.floor(Math.random() * SYC_WHISPER_FORMANTS.length)
        ];
      var offset2 = 0.2 + Math.random() * 0.5;
      var dur2 = dur - offset2;
      var n2 = noiseSource(dur2);
      var g2 = c.createGain();
      var f2a = c.createBiquadFilter();
      var f2b = c.createBiquadFilter();
      f2a.type = "bandpass";
      f2a.frequency.setValueAtTime(formant2[0], now + offset2);
      f2a.Q.setValueAtTime(qVal + 2, now + offset2);
      f2b.type = "bandpass";
      f2b.frequency.setValueAtTime(formant2[1], now + offset2);
      f2b.Q.setValueAtTime(qVal, now + offset2);
      n2.connect(f2a);
      n2.connect(f2b);
      var mix2 = c.createGain();
      f2a.connect(mix2);
      f2b.connect(mix2);
      mix2.connect(g2);
      g2.connect(out);
      g2.gain.setValueAtTime(0, now + offset2);
      g2.gain.linearRampToValueAtTime(0.04, now + offset2 + dur2 * 0.3);
      g2.gain.linearRampToValueAtTime(0, now + offset2 + dur2);
      startNoise(n2, now + offset2);
    }

    emitMotifEvent({
      type: "fire", track: "sycorax", layer: "whispers", time: now,
      detail: "[" + Math.round(formant[0]) + "/" + Math.round(formant[1]) +
              "] · " + dur.toFixed(1) + "s",
    });

    scheduleWithRate(sycoraxWhispers, 6000 + Math.random() * 10000, "sycorax", "whispers");
  }

  // --- Ghost note synth ---
  // A single "ghost note" is a 3-oscillator detuned cluster with slow random
  // vibrato. The envelope shape is chosen per note ("default" = a soft swell,
  // "swell" = a more dramatic crescendo/decrescendo).
  function playSycGhostNote(out, t, freq, dur, peakGain, envelope) {
    var c = ctx;
    // DETUNE scales the 3-voice cents spread (±15 cents → wide chorus / unison).
    // VIBRATO scales the per-voice vib depth (4–10 cents at default).
    // VIB RATE scales the per-voice vib LFO rate (0.2–0.8 Hz at default).
    var ghDetune  = getLayerParam("sycorax", "ghost", "detune", 1.0);
    var ghVibDep  = getLayerParam("sycorax", "ghost", "vibrato", 1.0);
    var ghVibRate = getLayerParam("sycorax", "ghost", "vibRate", 1.0);
    var detunes = [-15 * ghDetune, 0, 15 * ghDetune];
    for (var di = 0; di < detunes.length; di++) {
      var o = c.createOscillator();
      var g = c.createGain();
      if (glassWave) o.setPeriodicWave(glassWave); else o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(detunes[di], t);
      var vib = c.createOscillator();
      var vibG = c.createGain();
      vib.type = "sine";
      vib.frequency.setValueAtTime((0.2 + Math.random() * 0.6) * ghVibRate, t);
      vibG.gain.setValueAtTime((4 + Math.random() * 6) * ghVibDep, t);
      vib.connect(vibG);
      vibG.connect(o.frequency);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      if (envelope === "swell") {
        // Slower attack, longer peak, quicker decay — a dramatic crescendo
        g.gain.linearRampToValueAtTime(peakGain * 1.2, t + dur * 0.55);
        g.gain.linearRampToValueAtTime(peakGain * 0.8, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, t + dur);
      } else {
        // Default soft swell shape
        g.gain.linearRampToValueAtTime(peakGain, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(peakGain * 0.6, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, t + dur);
      }
      o.start(t);
      o.stop(t + dur + 0.1);
      vib.start(t);
      vib.stop(t + dur + 0.1);
    }
  }

  // --- Ghost motif renderer ---
  // Walks a motif's note list and plays each via playSycGhostNote. Scale-degree
  // indices are clamped; octMult chooses between the lower and upper octave
  // scale tables.
  function playSycoraxGhostMotif(motif, out, now) {
    var notes = motif.notes;
    var len = SYC_GHOST_SCALE.length;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var idx = n.degree;
      if (idx < 0) idx = 0;
      else if (idx >= len) idx = len - 1;
      // octMult >= 2 → use the upper octave scale; else lower.
      var freq = (n.octMult && n.octMult >= 2) ? SYC_GHOST_SCALE_HI[idx] : SYC_GHOST_SCALE[idx];
      playSycGhostNote(out, now + n.offset, freq, n.dur, n.gain, n.envelope);
    }
  }

  // --- Ghost cluster builders ---
  // Each returns a motif object. Markov state (sycGhostIdx) is advanced as we go.

  function pickGhostOctMult() { return Math.random() < 0.3 ? 2 : 1; }

  function buildSycGhostSingle() {
    var motif = makeMotif("single");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycGhostIdx = markovNext(SYC_GHOST_MARKOV[sycGhostIdx], Math.random());
    motifAddNote(motif, sycGhostIdx, 0, 3 + Math.random() * 3, 0.03, pickGhostOctMult());
    motif.endDegree = sycGhostIdx;
    return motif;
  }

  function buildSycGhostChord() {
    var motif = makeMotif("chord");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycGhostIdx = markovNext(SYC_GHOST_MARKOV[sycGhostIdx], Math.random());
    var noteCount = 2 + Math.floor(Math.random() * 2);
    var indices = [sycGhostIdx];
    for (var ni = 1; ni < noteCount; ni++) {
      var extra = Math.floor(Math.random() * SYC_GHOST_SCALE.length);
      while (indices.indexOf(extra) !== -1) extra = Math.floor(Math.random() * SYC_GHOST_SCALE.length);
      indices.push(extra);
    }
    var dur = 3 + Math.random() * 3;
    for (var ii = 0; ii < indices.length; ii++) {
      motifAddNote(motif, indices[ii], 0, dur, 0.02, pickGhostOctMult());
    }
    motif.endDegree = sycGhostIdx;
    return motif;
  }

  // Drift — Sycorax's analog of the harpsichord AIR: 3-4 slowly-walked notes
  // with significant overlap (legato-into-each-other), each ~3-5s long.
  function buildSycGhostDrift() {
    var motif = makeMotif("drift");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    var noteCount = 3 + Math.floor(Math.random() * 2); // 3 or 4
    var t = 0;
    for (var i = 0; i < noteCount; i++) {
      sycGhostIdx = markovNext(SYC_GHOST_MARKOV[sycGhostIdx], Math.random());
      var dur = 3.5 + Math.random() * 2;
      var gain = 0.022 + (Math.random() - 0.5) * 0.006;
      motifAddNote(motif, sycGhostIdx, t, dur, gain, pickGhostOctMult());
      // Start-to-start spacing ~1.8-2.8s → notes overlap by ~1.5-3s
      t += 1.8 + Math.random() * 1.0;
    }
    motif.endDegree = sycGhostIdx;
    return motif;
  }

  // Swell — one long sustained tone with a dramatic crescendo/decrescendo.
  function buildSycGhostSwell() {
    var motif = makeMotif("swell");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycGhostIdx = markovNext(SYC_GHOST_MARKOV[sycGhostIdx], Math.random());
    var note = {
      degree: sycGhostIdx,
      offset: 0,
      dur: 7 + Math.random() * 3,    // longer than default
      gain: 0.028,
      octMult: pickGhostOctMult(),
      envelope: "swell",
    };
    motif.notes.push(note);
    motif.endDegree = sycGhostIdx;
    return motif;
  }

  // Echo — a tone + a quieter dissonant echo (tritone or min 2nd above,
  // wrapping in scale). The echo arrives during the first tone's fade.
  function buildSycGhostEcho() {
    var motif = makeMotif("echo");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycGhostIdx = markovNext(SYC_GHOST_MARKOV[sycGhostIdx], Math.random());
    var first = sycGhostIdx;
    var dur1 = 3 + Math.random() * 1.5;
    motifAddNote(motif, first, 0, dur1, 0.028, pickGhostOctMult());

    // Pick a dissonant interval and apply it (wrapping in the 7-note scale)
    var intervalKey = pickWeighted(SYC_GHOST_ECHO_INTERVALS);
    var interval = parseInt(intervalKey, 10);
    var echoDegree = (first + interval) % SYC_GHOST_SCALE.length;
    var echoOct = Math.random() < 0.5 ? 2 : 1; // 50% chance echo is octave up
    var dur2 = 2 + Math.random() * 1.5;
    motifAddNote(motif, echoDegree, dur1 * 0.6, dur2, 0.018, echoOct);

    sycGhostIdx = echoDegree;
    motif.endDegree = echoDegree;
    return motif;
  }

  function buildFreshSycoraxGhostMotif() {
    var kind = pickWeighted(SYC_GHOST_CLUSTER_WEIGHTS);
    if (kind === "single") return buildSycGhostSingle();
    if (kind === "chord")  return buildSycGhostChord();
    if (kind === "drift")  return buildSycGhostDrift();
    if (kind === "swell")  return buildSycGhostSwell();
    return buildSycGhostEcho();
  }

  // --- Markov-driven ethereal ghost tones, now with motif memory ---
  // Same structure as libraryMelody: roll generate vs recall-transform vs
  // recall-verbatim. Captured motifs return later, sometimes altered.
  function sycoraxGhostTones() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("sycorax", "ghost");

    var played = null;

    // 20% rest
    if (Math.random() >= 0.20) {
      var memSize = motifBufferSize("sycorax", "ghost");
      var action;
      if (memSize === 0) {
        action = "generate";
      } else {
        var ramp = Math.min(memSize / MOTIF_RECALL_RAMP_FULL, 1);
        action = pickWeighted({
          generate:        MOTIF_ACTION_WEIGHTS.generate,
          recallTransform: MOTIF_ACTION_WEIGHTS.recallTransform * ramp,
          recallVerbatim:  MOTIF_ACTION_WEIGHTS.recallVerbatim  * ramp,
        });
      }

      if (action === "generate") {
        var fresh = buildFreshSycoraxGhostMotif();
        playSycoraxGhostMotif(fresh, out, now);
        captureMotif("sycorax", "ghost", fresh);
        played = fresh;
        emitMotifEvent({
          type: "fire", track: "sycorax", layer: "ghost",
          time: now, motifId: fresh.id,
          cluster: fresh.sourceCluster, action: "fresh", transform: null,
        });
      } else {
        var stored = recallMotif("sycorax", "ghost");
        if (stored) {
          var motif = cloneMotif(stored);
          if (action === "recallTransform") motif = applyMotifTransform(motif);
          playSycoraxGhostMotif(motif, out, now);
          sycGhostIdx = Math.max(0, Math.min(SYC_GHOST_SCALE.length - 1, motif.endDegree));
          played = motif;
          emitMotifEvent({
            type: "fire", track: "sycorax", layer: "ghost",
            time: now, motifId: motif.id,
            cluster: motif.sourceCluster,
            action: action === "recallTransform" ? "transform" : "verbatim",
            transform: motif.lastTransform,
          });
        } else {
          var fallback = buildFreshSycoraxGhostMotif();
          playSycoraxGhostMotif(fallback, out, now);
          captureMotif("sycorax", "ghost", fallback);
          played = fallback;
          emitMotifEvent({
            type: "fire", track: "sycorax", layer: "ghost",
            time: now, motifId: fallback.id,
            cluster: fallback.sourceCluster, action: "fresh", transform: null,
          });
        }
      }
    }

    var gap = 8000 + Math.random() * 10000;
    // No-overlap floor: even at high RATE, the next motif can't start until
    // the current one has finished + a breath.
    var floor = 0;
    if (played) {
      var breath = MOTIF_MIN_BREATH_MS[0] + Math.random() * MOTIF_MIN_BREATH_MS[1];
      floor = motifDurationSec(played) * 1000 + breath;
    }
    scheduleWithRate(sycoraxGhostTones, gap, "sycorax", "ghost", floor);
  }

  // --- Waterphone note synth ---
  // A single "waterphone note": six inharmonic sine partials + an FM bloom
  // layered in, all riding a slow shared body-wobble LFO. Voice 3 from
  // waterphone-sandbox.html, ported to the engine's signal chain.
  // `gainScale` (default 1.0) multiplies the envelope peak — motifs like
  // Apparition use 0.55 to feel "distant"; Resonant Pair uses 0.55–0.70 on
  // each of its two simultaneous notes to keep the sum from overloading.
  function playSycWaterphoneNote(out, t, freq, dur, gainScale) {
    var c = ctx;
    var P = SYC_WATERPHONE_PARAMS;
    // WAIL    scales the FM modulator depth (the screaming bell wash).
    // BLOOM   scales the FM carrier level (how much bloom mixes in).
    // SHIMMER scales the upper-partial tremolo depth.
    // GLISS   scales the glissando downward drift (engine's "wail" param).
    var wpWail    = getLayerParam("sycorax", "waterphone", "wail", 1.0);
    var wpBloom   = getLayerParam("sycorax", "waterphone", "bloom", 1.0);
    var wpShimmer = getLayerParam("sycorax", "waterphone", "shimmer", 1.0);
    var wpGliss   = getLayerParam("sycorax", "waterphone", "gliss", 1.0);
    var env = c.createGain();
    env.connect(out);
    var peak = 0.04 * (gainScale == null ? 1 : gainScale);
    // Master envelope (slow bowed swell → sustain → slow fade)
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + Math.min(1.5, dur * 0.22));
    env.gain.setValueAtTime(peak, t + Math.max(dur - 2.2, dur * 0.6));
    env.gain.linearRampToValueAtTime(0, t + dur);

    var glissEnd  = 1 - (P.wail * wpGliss) / 100;
    var wobbleAmt = P.wobble / 100;
    var shimmer   = P.shimmer * wpShimmer;
    var stopAt    = t + dur + 0.5;

    // Shared body-wobble LFO drives every "body" component (lower three
    // partials + FM carrier) in lockstep. Per-target gains scale the depth.
    var bodyWobble = c.createOscillator();
    bodyWobble.type = "sine";
    bodyWobble.frequency.setValueAtTime(P.bodyWobbleRate, t);
    bodyWobble.start(t);
    bodyWobble.stop(stopAt);

    // Additive inharmonic partials.
    var partials = [
      { ratio: 1.00, gain: 0.42, trem: 0,    body: true  },
      { ratio: 1.41, gain: 0.30, trem: 0,    body: true  },
      { ratio: 2.07, gain: 0.22, trem: 0,    body: true  },
      { ratio: 2.95, gain: 0.20, trem: 0.55, body: false },
      { ratio: 4.13, gain: 0.16, trem: 0.65, body: false },
      { ratio: 5.62, gain: 0.12, trem: 0.75, body: false },
    ];
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = "sine";
      var startFreq = freq * p.ratio;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.linearRampToValueAtTime(startFreq * glissEnd, t + dur);
      g.gain.setValueAtTime(p.gain, t);

      // Per-partial pitch LFO — small independent shimmer.
      var lfo = c.createOscillator();
      var lfoG = c.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.25 + i * 0.08, t);
      lfoG.gain.setValueAtTime(startFreq * 0.006, t);
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);

      // Shared body wobble only on the lower partials.
      if (p.body) {
        var bw = c.createGain();
        bw.gain.setValueAtTime(startFreq * wobbleAmt, t);
        bodyWobble.connect(bw);
        bw.connect(osc.frequency);
      }

      // Upper-partial amplitude tremolo, scaled by shimmer.
      if (p.trem > 0) {
        var trem = c.createOscillator();
        var tremG = c.createGain();
        trem.type = "sine";
        trem.frequency.setValueAtTime(2.5 + Math.random() * 4, t);
        tremG.gain.setValueAtTime(p.gain * p.trem * shimmer, t);
        trem.connect(tremG);
        tremG.connect(g.gain);
        trem.start(t);
        trem.stop(stopAt);
      }

      osc.connect(g);
      g.connect(env);
      osc.start(t);
      osc.stop(stopAt);
      lfo.start(t);
      lfo.stop(stopAt);
    }

    // FM bloom layered on top. Carrier + √2-ratio modulator with a swelling
    // modulation index that blooms during the sustain.
    var carrier = c.createOscillator();
    var carrierGain = c.createGain();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(freq, t);
    carrier.frequency.linearRampToValueAtTime(freq * glissEnd, t + dur);
    carrierGain.gain.setValueAtTime(P.bloomLevel * wpBloom, t);

    var mod = c.createOscillator();
    var modG = c.createGain();
    mod.type = "sine";
    mod.frequency.setValueAtTime(freq * 1.41, t);
    mod.frequency.linearRampToValueAtTime(freq * 1.41 * glissEnd, t + dur);
    var peakIdx = freq * P.bloomIntensity * wpWail;
    modG.gain.setValueAtTime(0, t);
    modG.gain.linearRampToValueAtTime(peakIdx,        t + Math.min(1.5, dur * 0.25));
    modG.gain.linearRampToValueAtTime(peakIdx * 0.44, t + dur * 0.7);
    modG.gain.linearRampToValueAtTime(0,              t + dur);
    mod.connect(modG);
    modG.connect(carrier.frequency);

    // Carrier rides the shared body wobble too.
    var carrierBw = c.createGain();
    carrierBw.gain.setValueAtTime(freq * wobbleAmt, t);
    bodyWobble.connect(carrierBw);
    carrierBw.connect(carrier.frequency);

    carrier.connect(carrierGain);
    carrierGain.connect(env);
    carrier.start(t);
    carrier.stop(stopAt);
    mod.start(t);
    mod.stop(stopAt);
  }

  // --- Waterphone motif renderer ---
  // The motif's notes carry a degree (index into SYC_GHOST_SCALE), an offset,
  // a duration, and an octMult (×2 → upper octave). Markov picks live in
  // the cluster builder so they advance sycWaterphoneIdx in real time.
  function playSycoraxWaterphoneMotif(motif, out, now) {
    var notes = motif.notes;
    var len = SYC_GHOST_SCALE.length;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var idx = n.degree;
      if (idx < 0) idx = 0;
      else if (idx >= len) idx = len - 1;
      var freq = (n.octMult && n.octMult >= 2) ? SYC_GHOST_SCALE_HI[idx] : SYC_GHOST_SCALE[idx];
      playSycWaterphoneNote(out, now + n.offset, freq, n.dur, n.gain);
    }
  }

  // --- Waterphone motif builders ---
  // Seven patterns dialed in via waterphone-motifs-sandbox.html. Markov state
  // (sycWaterphoneIdx) advances as we go so subsequent motifs continue from
  // where the last one left off. Scale: SYC_GHOST_SCALE (shared with ghost
  // tones so the two layers feel harmonically related).

  // Tone — one long sustained note, the anchor of the layer.
  function buildSycWaterphoneTone() {
    var motif = makeMotif("tone");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var dur = 6 + Math.random() * 4;            // 6–10 s
    var oct = Math.random() < 0.25 ? 2 : 1;     // 25% upper octave
    motifAddNote(motif, sycWaterphoneIdx, 0, dur, 1.0, oct);
    motif.endDegree = sycWaterphoneIdx;
    return motif;
  }

  // Call — two notes, brief breath between, second at a dissonant interval
  // above (tritone 60% / minor 2nd 40%). Tightened to ~6.7 s total.
  function buildSycWaterphoneCall() {
    var motif = makeMotif("call");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var first = sycWaterphoneIdx;
    var interval = Math.random() < 0.6 ? 3 : 1;
    var second = (first + interval) % SYC_GHOST_SCALE.length;
    motifAddNote(motif, first,  0,           2.8, 1.0, 1);
    motifAddNote(motif, second, 2.8 + 0.3,   3.6, 1.0, 1);
    sycWaterphoneIdx = second;
    motif.endDegree = second;
    return motif;
  }

  // Lament — 3–4 descending notes, overlapping legato. Each step goes down
  // one scale degree (clamped at the bottom).
  function buildSycWaterphoneLament() {
    var motif = makeMotif("lament");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var count = 3 + Math.floor(Math.random() * 2); // 3 or 4
    var t = 0;
    var idx = sycWaterphoneIdx;
    for (var i = 0; i < count; i++) {
      var isLast = (i === count - 1);
      var dur = isLast ? 5 + Math.random() : 3.5 + Math.random();
      motifAddNote(motif, idx, t, dur, 1.0, 1);
      t += 2.6 + Math.random() * 0.7;
      idx = Math.max(0, idx - 1);
    }
    sycWaterphoneIdx = idx;
    motif.endDegree = idx;
    return motif;
  }

  // Reach — 2–3 ascending notes; last note held longest.
  function buildSycWaterphoneReach() {
    var motif = makeMotif("reach");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    var t = 0;
    var idx = sycWaterphoneIdx;
    for (var i = 0; i < count; i++) {
      var isLast = (i === count - 1);
      var dur = isLast ? 5.5 + Math.random() * 1.5 : 3 + Math.random() * 0.8;
      motifAddNote(motif, idx, t, dur, 1.0, 1);
      t += 2.5 + Math.random() * 0.8;
      idx = Math.min(SYC_GHOST_SCALE.length - 1, idx + 1);
    }
    sycWaterphoneIdx = idx;
    motif.endDegree = idx;
    return motif;
  }

  // Pendulum — zigzag motion around a center degree. 60% wide convergent
  // (+2, -2, +1, -1, 0), 40% narrow oscillation (+1, -1, +1, -1).
  function buildSycWaterphonePendulum() {
    var motif = makeMotif("pendulum");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var center = sycWaterphoneIdx;
    var wide = Math.random() < 0.6;
    var offsets = wide ? [2, -2, 1, -1, 0] : [1, -1, 1, -1];
    var t = 0;
    var lastIdx = center;
    for (var i = 0; i < offsets.length; i++) {
      var isLast = (i === offsets.length - 1);
      var dur = isLast ? 4.5 + Math.random() : 2.8 + Math.random() * 0.8;
      var idx = Math.max(0, Math.min(SYC_GHOST_SCALE.length - 1, center + offsets[i]));
      motifAddNote(motif, idx, t, dur, 1.0, 1);
      t += 2.0 + Math.random() * 0.5;
      lastIdx = idx;
    }
    sycWaterphoneIdx = lastIdx;
    motif.endDegree = lastIdx;
    return motif;
  }

  // Apparition — very long, quiet single note. envelope peak ~55% of normal.
  function buildSycWaterphoneApparition() {
    var motif = makeMotif("apparition");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var dur = 13 + Math.random() * 4;           // 13–17 s
    var oct = Math.random() < 0.25 ? 2 : 1;
    motifAddNote(motif, sycWaterphoneIdx, 0, dur, 0.55, oct);
    motif.endDegree = sycWaterphoneIdx;
    return motif;
  }

  // Resonant Pair — two simultaneous notes at a dissonant interval. Both
  // notes share offset 0; close partials produce audible beat patterns.
  // Gains are dropped so the summed signal doesn't overload.
  function buildSycWaterphoneResonantPair() {
    var motif = makeMotif("resonantPair");
    motif.scaleLen = SYC_GHOST_SCALE.length;
    sycWaterphoneIdx = markovNext(SYC_GHOST_MARKOV[sycWaterphoneIdx], Math.random());
    var first = sycWaterphoneIdx;
    var interval = Math.random() < 0.6 ? 3 : 1;
    var second = (first + interval) % SYC_GHOST_SCALE.length;
    var dur = 7 + Math.random() * 2;
    motifAddNote(motif, first,  0, dur, 0.70, 1);
    motifAddNote(motif, second, 0, dur, 0.55, 1);
    sycWaterphoneIdx = second;
    motif.endDegree = second;
    return motif;
  }

  function buildFreshSycoraxWaterphoneMotif() {
    var kind = pickWeighted(SYC_WATERPHONE_CLUSTER_WEIGHTS);
    if (kind === "tone")         return buildSycWaterphoneTone();
    if (kind === "call")         return buildSycWaterphoneCall();
    if (kind === "lament")       return buildSycWaterphoneLament();
    if (kind === "reach")        return buildSycWaterphoneReach();
    if (kind === "pendulum")     return buildSycWaterphonePendulum();
    if (kind === "apparition")   return buildSycWaterphoneApparition();
    return buildSycWaterphoneResonantPair();
  }

  // --- Sparse Markov-driven waterphone layer ---
  // Sparser than ghost (12-25s between notes) — this is meant to be the
  // lyrical voice that emerges occasionally above the drone, not a continuous
  // texture. Motif memory means evocative notes can return later, sometimes
  // transformed.
  function sycoraxWaterphone() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("sycorax", "waterphone");

    var played = null;

    // 15% rest — let the layer breathe
    if (Math.random() >= 0.15) {
      var memSize = motifBufferSize("sycorax", "waterphone");
      var action;
      if (memSize === 0) {
        action = "generate";
      } else {
        var ramp = Math.min(memSize / MOTIF_RECALL_RAMP_FULL, 1);
        action = pickWeighted({
          generate:        MOTIF_ACTION_WEIGHTS.generate,
          recallTransform: MOTIF_ACTION_WEIGHTS.recallTransform * ramp,
          recallVerbatim:  MOTIF_ACTION_WEIGHTS.recallVerbatim  * ramp,
        });
      }

      if (action === "generate") {
        var fresh = buildFreshSycoraxWaterphoneMotif();
        playSycoraxWaterphoneMotif(fresh, out, now);
        captureMotif("sycorax", "waterphone", fresh);
        played = fresh;
        emitMotifEvent({
          type: "fire", track: "sycorax", layer: "waterphone",
          time: now, motifId: fresh.id,
          cluster: fresh.sourceCluster, action: "fresh", transform: null,
        });
      } else {
        var stored = recallMotif("sycorax", "waterphone");
        if (stored) {
          var motif = cloneMotif(stored);
          if (action === "recallTransform") motif = applyMotifTransform(motif);
          playSycoraxWaterphoneMotif(motif, out, now);
          sycWaterphoneIdx = Math.max(0, Math.min(SYC_GHOST_SCALE.length - 1, motif.endDegree));
          played = motif;
          emitMotifEvent({
            type: "fire", track: "sycorax", layer: "waterphone",
            time: now, motifId: motif.id,
            cluster: motif.sourceCluster,
            action: action === "recallTransform" ? "transform" : "verbatim",
            transform: motif.lastTransform,
          });
        } else {
          var fallback = buildFreshSycoraxWaterphoneMotif();
          playSycoraxWaterphoneMotif(fallback, out, now);
          captureMotif("sycorax", "waterphone", fallback);
          played = fallback;
          emitMotifEvent({
            type: "fire", track: "sycorax", layer: "waterphone",
            time: now, motifId: fallback.id,
            cluster: fallback.sourceCluster, action: "fresh", transform: null,
          });
        }
      }
    }

    var gap = 12000 + Math.random() * 13000; // 12-25s between fires
    var floor = 0;
    if (played) {
      var breath = MOTIF_MIN_BREATH_MS[0] + Math.random() * MOTIF_MIN_BREATH_MS[1];
      floor = motifDurationSec(played) * 1000 + breath;
    }
    scheduleWithRate(sycoraxWaterphone, gap, "sycorax", "waterphone", floor);
  }

  // --- Organic double-pulse heartbeat with drift ---
  function sycoraxHeartbeat() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lg("sycorax", "heartbeat");

    // Emit one "start" log entry when the heartbeat re-engages after a
    // gap (>5 s) — per-beat logging would flood the log.
    maybeEmitSessionStart("sycorax", "heartbeat", now);

    sycHeartbeatIntensity += (Math.random() - 0.5) * 0.15;
    sycHeartbeatIntensity = Math.max(
      0.4,
      Math.min(1.3, sycHeartbeatIntensity)
    );
    var intensity = sycHeartbeatIntensity;

    // TEMPO        scales inter-beat interval (lower = faster heartbeat).
    // DEPTH        scales the freq dip range (deeper plunges).
    // IRREGULARITY split 2/3 skip + 1/3 triple-beat (matches the 0.10/0.05 default).
    var hbTempo  = getLayerParam("sycorax", "heartbeat", "tempo", 1.0);
    var hbDepth  = getLayerParam("sycorax", "heartbeat", "depth", 1.0);
    var hbIrreg  = getLayerParam("sycorax", "heartbeat", "irregularity", 0.15);
    var skipProb   = hbIrreg * (2 / 3);
    var tripleProb = hbIrreg * (1 / 3);

    var rnd = Math.random();
    if (rnd < skipProb) {
      scheduleWithRate(sycoraxHeartbeat,
        (2500 + Math.random() * 2500) * hbTempo,
        "sycorax", "heartbeat");
      return;
    }

    var beats = (rnd < skipProb + tripleProb) ? 3 : 2;

    for (var i = 0; i < beats; i++) {
      var offset = i * (0.3 + Math.random() * 0.1);
      var t = now + offset;
      var isLub = i === 0;
      // DEPTH scales the start→end frequency dip relative to a fixed midpoint.
      // Default midpoint for lub: (40 + 20) / 2 = 30; for dub: (35 + 20) / 2 = 27.5.
      var rawStart = isLub
        ? 36 + Math.random() * 8     // 36–44
        : 32 + Math.random() * 6;    // 32–38
      var rawEnd = 18 + Math.random() * 4; // 18–22
      var mid = (rawStart + rawEnd) / 2;
      var startFreq = mid + (rawStart - mid) * hbDepth;
      var endFreq   = Math.max(8, mid + (rawEnd - mid) * hbDepth);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.2);
      o.connect(g);
      g.connect(out);
      var vol = (isLub ? 0.12 : 0.08) * intensity;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t);
      o.stop(t + 0.35);
    }

    scheduleWithRate(sycoraxHeartbeat,
      (2500 + Math.random() * 2500) * hbTempo,
      "sycorax", "heartbeat");
  }

  // --- Metallic pitch sweeps ---
  function sycoraxScrape() {
    if (!playing || currentTrack !== "sycorax") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("sycorax", "scrape");

    // 15% rest
    if (Math.random() < 0.15) {
      scheduleWithRate(sycoraxScrape, 10000 + Math.random() * 12000, "sycorax", "scrape");
      return;
    }

    // METAL     scales the bandpass Q (higher = piercing / metallic).
    // RANGE     scales the starting frequency range (200–700 Hz default).
    // DIRECTION forces sweep direction (up/down/dip) or leaves it random.
    var scMetal     = getLayerParam("sycorax", "scrape", "metal", 1.0);
    var scRange     = getLayerParam("sycorax", "scrape", "range", 1.0);
    var scDirection = getLayerParam("sycorax", "scrape", "direction", "random");

    var makeScrape = function () {
      var dur = 0.8 + Math.random() * 1.2;
      var startFreq = (200 + Math.random() * 500) * scRange;
      var qVal = (10 + Math.random() * 10) * scMetal;
      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "sawtooth";
      f.type = "bandpass";
      f.frequency.setValueAtTime(startFreq, now);
      f.Q.setValueAtTime(qVal, now);

      // Pick direction: explicit value if set, otherwise uniform random
      var directionPick = scDirection;
      if (directionPick === "random") {
        var r = Math.random();
        directionPick = r < 0.33 ? "dip" : (r < 0.66 ? "down" : "up");
      }
      var sweepKind, fEnd;
      if (directionPick === "dip") {
        o.frequency.setValueAtTime(startFreq, now);
        o.frequency.linearRampToValueAtTime(startFreq * 0.5, now + dur * 0.5);
        o.frequency.linearRampToValueAtTime(startFreq * 0.9, now + dur);
        sweepKind = "dip"; fEnd = startFreq * 0.9;
      } else if (directionPick === "down") {
        o.frequency.setValueAtTime(startFreq, now);
        o.frequency.linearRampToValueAtTime(startFreq * 0.4, now + dur);
        sweepKind = "down"; fEnd = startFreq * 0.4;
      } else {
        o.frequency.setValueAtTime(startFreq * 0.5, now);
        o.frequency.linearRampToValueAtTime(startFreq, now + dur);
        sweepKind = "up"; fEnd = startFreq;
        startFreq = startFreq * 0.5;
      }

      o.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.04, now + 0.05);
      g.gain.setValueAtTime(0.035, now + dur * 0.5);
      g.gain.linearRampToValueAtTime(0, now + dur);
      o.start(now);
      o.stop(now + dur + 0.1);

      emitMotifEvent({
        type: "fire", track: "sycorax", layer: "scrape", time: now,
        detail: sweepKind + " · " + freqToNoteName(startFreq) +
                "→" + freqToNoteName(fEnd),
      });
    };

    makeScrape();
    if (Math.random() < 0.2) makeScrape();

    scheduleWithRate(sycoraxScrape, 10000 + Math.random() * 12000, "sycorax", "scrape");
  }

  // --- Dark ambient event pool ---
  function sycoraxAmbient() {
    if (!playing || currentTrack !== "sycorax") return;
    var out = lgp("sycorax", "ambient");

    var variety = getLayerParam("sycorax", "ambient", "variety", "default");
    var event = weightedChoiceVariety(SYC_AMBIENT_POOL, variety);
    emitAmbientEvent({ type: "fire", track: "sycorax", layer: "ambient", event: event, time: ctx.currentTime });
    switch (event) {
      case "chains_rattle":
        sycChainsRattle(out);
        break;
      case "distant_thunder":
        sycDistantThunder(out);
        break;
      case "glass_shatter":
        sycGlassShatter(out);
        break;
      case "raven_cry":
        sycRavenCry(out);
        break;
      case "wind_howl":
        sycWindHowl(out);
        break;
      case "spectral_moan":
        sycSpectralMoan(out);
        break;
      case "cauldron_bubble":
        sycCauldronBubble(out);
        break;
      case "witch_cackle":
        sycWitchCackle(out);
        break;
    }

    var sycDensity = getLayerParam("sycorax", "ambient", "density", 1.0);
    if (sycDensity < 0.05) sycDensity = 0.05;
    scheduleWithRate(sycoraxAmbient,
      (12000 + Math.random() * 13000) / sycDensity,
      "sycorax", "ambient");
  }

  // --- Sycorax ambient event synthesis ---

  function sycChainsRattle(out) {
    var c = ctx;
    var now = c.currentTime;
    // Sampled per-call to match the preview's defaults.
    var pings = 6 + Math.floor(Math.random() * 5);          // 6–10
    var rate = 10 + Math.random() * 6;                       // 10–16 Hz
    var spacing = 1 / rate;
    for (var i = 0; i < pings; i++) {
      var t = now + i * spacing;
      var pingDur = 0.02 + Math.random() * 0.03;
      var n = noiseSource(pingDur);
      var g = c.createGain();
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(3000 + Math.random() * 4000, t);
      f.Q.setValueAtTime(20 + Math.random() * 15, t);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.02 + Math.random() * 0.015, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + pingDur);
      startNoise(n, t);
    }
  }

  function sycDistantThunder(out) {
    var c = ctx;
    var now = c.currentTime;
    // Center around the preview-tuned defaults with light natural variation.
    var dur = 4.5 + Math.random() * 1.5;       // ~5.25 mean
    var peakFreq = 280 + Math.random() * 80;   // ~320 mean
    var peakVol = 0.04;

    // Boom — deep resonant impact: sub-bass sine "thump" + low-passed noise
    // body. Slow attack so it rolls in (not a punchy thud).
    var boomDur = 0.7 + Math.random() * 0.4;

    // Sub-bass sine — drops in pitch as it decays, giving the "settling" feel.
    var subO = c.createOscillator();
    var subG = c.createGain();
    subO.type = "sine";
    subO.frequency.setValueAtTime(55, now);
    subO.frequency.exponentialRampToValueAtTime(35, now + boomDur);
    subO.connect(subG); subG.connect(out);
    subG.gain.setValueAtTime(0, now);
    subG.gain.linearRampToValueAtTime(peakVol * 2.4, now + 0.03);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + boomDur);
    subO.start(now);
    subO.stop(now + boomDur + 0.05);

    // Noise body — focused resonant low band, dropping deeper into the sub.
    var bn = noiseSource(boomDur);
    var bg = c.createGain();
    var blp = c.createBiquadFilter();
    blp.type = "lowpass";
    blp.frequency.setValueAtTime(180, now);
    blp.frequency.exponentialRampToValueAtTime(50, now + boomDur);
    blp.Q.setValueAtTime(5, now);
    bn.connect(blp); blp.connect(bg); bg.connect(out);
    bg.gain.setValueAtTime(0, now);
    bg.gain.linearRampToValueAtTime(peakVol * 1.5, now + 0.04);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + boomDur);
    startNoise(bn, now);

    // Rolling rumble — trails the boom
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(60, now);
    f.frequency.linearRampToValueAtTime(peakFreq, now + dur * 0.35);
    f.frequency.linearRampToValueAtTime(40, now + dur);
    f.Q.setValueAtTime(1, now);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peakVol, now + 0.3);
    g.gain.setValueAtTime(peakVol * 0.9, now + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function sycGlassShatter(out) {
    var c = ctx;
    var now = c.currentTime;
    // Center matches the preview-tuned defaults: pitch 1500, ~4 pings.
    var pitch = 1500;
    var transDur = 0.03;
    var n = noiseSource(transDur);
    var tg = c.createGain();
    var hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(pitch, now);
    n.connect(hp);
    hp.connect(tg);
    tg.connect(out);
    tg.gain.setValueAtTime(0.035, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + transDur);
    startNoise(n, now);

    var pingCount = 3 + Math.floor(Math.random() * 3); // ~4 mean
    for (var i = 0; i < pingCount; i++) {
      var t = now + 0.01 + Math.random() * 0.05;
      var freq = pitch * 0.5 + Math.random() * pitch * 1.5;
      var decay = 0.2 + Math.random() * 0.3;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.015, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      o.start(t);
      o.stop(t + decay + 0.01);
    }
  }

  function sycRavenCry(out) {
    var c = ctx;
    var now = c.currentTime;
    var squawks = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < squawks; i++) {
      var t = now + i * (0.15 + Math.random() * 0.1);
      var dur = 0.12 + Math.random() * 0.08;
      var startFreq = 800 + Math.random() * 400;
      var o = c.createOscillator();
      var g = c.createGain();
      var f1 = c.createBiquadFilter();
      var f2 = c.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(startFreq * 0.4, t + dur);
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(1200, t);
      f1.Q.setValueAtTime(8, t);
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(2800, t);
      f2.Q.setValueAtTime(6, t);
      o.connect(f1);
      o.connect(f2);
      var mix = c.createGain();
      f1.connect(mix);
      f2.connect(mix);
      mix.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }
  }

  function sycWindHowl(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 3 + Math.random() * 3;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(150, now);
    f.frequency.linearRampToValueAtTime(700, now + dur * 0.4);
    f.frequency.linearRampToValueAtTime(200, now + dur);
    f.Q.setValueAtTime(5, now);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + dur * 0.2);
    g.gain.setValueAtTime(0.025, now + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function sycSpectralMoan(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 2 + Math.random() * 2;
    var baseFreq = 120 + Math.random() * 80;

    var o = c.createOscillator();
    var g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(baseFreq, now);
    o.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + dur);
    o.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + dur * 0.2);
    g.gain.setValueAtTime(0.025, now + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now);
    o.stop(now + dur + 0.1);

    var ns = noiseSource(dur);
    var ng = c.createGain();
    var nf = c.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.setValueAtTime(400, now);
    nf.frequency.linearRampToValueAtTime(250, now + dur);
    nf.Q.setValueAtTime(3, now);
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.015, now + dur * 0.25);
    ng.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(ns, now);
  }

  function sycCauldronBubble(out) {
    var c = ctx;
    var now = c.currentTime;
    var pops = 3 + Math.floor(Math.random() * 6);
    var totalDur = 1 + Math.random() * 1.5;
    for (var i = 0; i < pops; i++) {
      var t = now + (i / pops) * totalDur + Math.random() * 0.1;
      var baseFreq = 80 + Math.random() * 120;
      var popDur = 0.04 + Math.random() * 0.04;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(baseFreq, t);
      o.frequency.linearRampToValueAtTime(baseFreq * 3, t + popDur * 0.2);
      o.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + popDur);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + popDur);
      o.start(t);
      o.stop(t + popDur + 0.01);
    }
  }

  function sycWitchCackle(out) {
    var c = ctx;
    var now = c.currentTime;
    // Sampled per-call to match the preview's syllables range {min:3, max:7}.
    var syllables = 3 + Math.floor(Math.random() * 5);
    var basePitch = 220;
    var peakVol = 0.04;
    for (var i = 0; i < syllables; i++) {
      var t = now + i * (0.08 + Math.random() * 0.06);
      var sylLen = 0.06 + Math.random() * 0.05;
      var pitch = basePitch * (0.85 + Math.random() * 0.5);
      var o = c.createOscillator();
      var g = c.createGain();
      var f1 = c.createBiquadFilter();
      var f2 = c.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(pitch, t);
      o.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + sylLen);
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(700 + Math.random() * 400, t);
      f1.Q.setValueAtTime(8, t);
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(2400 + Math.random() * 600, t);
      f2.Q.setValueAtTime(6, t);
      o.connect(f1); o.connect(f2);
      var mix = c.createGain();
      f1.connect(mix); f2.connect(mix);
      mix.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peakVol * (0.7 + Math.random() * 0.5), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + sylLen);
      o.start(t);
      o.stop(t + sylLen + 0.01);
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext ||
      (window).webkitAudioContext)();

    // Pre-generate a shared noise buffer (30s of white noise)
    var noiseSamples = ctx.sampleRate * NOISE_BUF_DURATION;
    sharedNoiseBuf = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    var noiseData = sharedNoiseBuf.getChannelData(0);
    for (var ni = 0; ni < noiseSamples; ni++) {
      noiseData[ni] = Math.random() * 2 - 1;
    }

    // --- Master output chain: masterGain -> compressor -> destination ---
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-24, ctx.currentTime);
    compressorNode.knee.setValueAtTime(12, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(4, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.01, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.15, ctx.currentTime);
    masterGain.connect(compressorNode);
    compressorNode.connect(ctx.destination);

    // --- Effects chain (reverb, waveshaper, custom waveforms) ---
    // Wrapped in try-catch: if any effect fails, audio still works via dry path
    var effectsReady = false;
    try {
      // Reverb chain: reverbSend -> dry/wet split -> masterGain
      reverbSend = ctx.createGain();
      reverbSend.gain.setValueAtTime(1.0, ctx.currentTime);
      reverbDry = ctx.createGain();
      reverbDry.gain.setValueAtTime(1.0, ctx.currentTime);
      reverbWet = ctx.createGain();
      reverbConv = ctx.createConvolver();
      reverbPreDelay = ctx.createDelay(0.1);
      reverbSend.connect(reverbDry);
      reverbSend.connect(reverbPreDelay);
      reverbPreDelay.connect(reverbConv);
      reverbConv.connect(reverbWet);
      reverbDry.connect(masterGain);
      reverbWet.connect(masterGain);
      buildReverbIR(currentTrack);

      // Drone waveshapers (per-track harmonic saturation)
      var wsParams = { library: 12, sycorax: 26, ariel: 7 };
      var wsNames = ["library", "sycorax", "ariel"];
      for (var wi = 0; wi < wsNames.length; wi++) {
        var wt = wsNames[wi];
        droneWaveshapers[wt] = ctx.createWaveShaper();
        droneWaveshapers[wt].curve = buildWaveshaperCurve(wsParams[wt]);
        droneWaveshapers[wt].oversample = "2x";
        droneWaveshapers[wt].connect(reverbSend);
      }

      // Custom waveforms (PeriodicWave)
      bellWave = ctx.createPeriodicWave(
        new Float32Array([0, 1, 0.1, 0.3, 0, 0.15, 0.08, 0, 0.12, 0.05, 0, 0.06]),
        new Float32Array([0, 0, 0.05, 0, 0.08, 0, 0, 0.04, 0, 0, 0.03, 0])
      );
      glassWave = ctx.createPeriodicWave(
        new Float32Array([0, 1, 0, 0.4, 0, 0.2, 0, 0.12, 0, 0.06, 0, 0.03]),
        new Float32Array([0, 0, 0.3, 0, 0.15, 0, 0.08, 0, 0.04, 0, 0.02, 0])
      );
      fluteWave = ctx.createPeriodicWave(
        new Float32Array([0, 1, 0.25, 0.08, 0.02, 0, 0, 0, 0]),
        new Float32Array([0, 0, 0.1, 0.03, 0, 0, 0, 0, 0])
      );

      effectsReady = true;
    } catch (e) {
      // Effects chain failed — fall back to direct routing
      // Create a pass-through reverbSend so layer gains have something to connect to
      reverbSend = ctx.createGain();
      reverbSend.gain.setValueAtTime(1.0, ctx.currentTime);
      reverbSend.connect(masterGain);
      console.warn("Prospero effects chain init failed, using dry fallback:", e);
    }

    // --- Create per-layer GainNodes ---
    // Drone layers route through waveshaper (if available); all others to reverb send
    var tracks = ["library", "sycorax", "ariel"];
    for (var ti = 0; ti < tracks.length; ti++) {
      var track = tracks[ti];
      var layers = Object.keys(layerGains[track]);
      for (var li = 0; li < layers.length; li++) {
        var layer = layers[li];
        var node = ctx.createGain();
        node.gain.setValueAtTime(1, ctx.currentTime);
        if (DRONE_LAYERS[layer] && effectsReady && droneWaveshapers[track]) {
          node.connect(droneWaveshapers[track]);
        } else {
          node.connect(reverbSend);
        }
        layerGains[track][layer] = node;
      }
    }
  }

  function play(trackName) {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (previewing) endPreview();
    if (playing) return;
    playing = true;
    if (trackName) currentTrack = trackName;
    // Restore master gain (stop()/switchTrack() leave it at 0)
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }
    // Restore layer gains for the current track (stop()/switchTrack() zero them)
    var layers = Object.keys(layerGains[currentTrack]);
    for (var i = 0; i < layers.length; i++) {
      applyLayerGain(currentTrack, layers[i]);
    }
    // Rebuild reverb IR for the current track's spatial character
    if (reverbConv) buildReverbIR(currentTrack);
    if (currentTrack === "library") {
      scheduleLibrary();
    } else if (currentTrack === "sycorax") {
      scheduleSycorax();
    } else if (currentTrack === "ariel") {
      scheduleAriel();
    }
  }

  // Zero all layer gains for a given track so orphaned oscillators go silent
  function silenceTrackLayers(track) {
    if (!ctx) return;
    var layers = Object.keys(layerGains[track]);
    for (var i = 0; i < layers.length; i++) {
      var node = layerGains[track][layers[i]];
      if (node) {
        node.gain.cancelScheduledValues(ctx.currentTime);
        node.gain.setValueAtTime(0, ctx.currentTime);
      }
    }
  }

  function stop() {
    if (previewing) endPreview();
    if (!playing) {
      // Still zero master gain to match prior stop behavior even after a preview.
      if (ctx && masterGain) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
      }
      return;
    }
    playing = false;
    clearAllTimers();
    clearMotifMemory(currentTrack);
    nextMotifId = 1;
    emitMotifEvent({ type: "clear", track: currentTrack });
    if (ctx) {
      silenceTrackLayers(currentTrack);
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
      }
    }
  }

  function switchTrack(trackName) {
    if (currentTrack === trackName) return;
    if (previewing) endPreview();
    var oldTrack = currentTrack;
    playing = false;
    clearAllTimers();
    clearMotifMemory(oldTrack);
    nextMotifId = 1;
    if (ctx) {
      // Zero layer gains on the OLD track so orphaned oscillators (drones etc.) go silent
      silenceTrackLayers(oldTrack);
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
      }
    }
    currentTrack = trackName;
    // Emit clear AFTER currentTrack is updated so the viz knows which track
    // the log/indicator should re-theme to.
    emitMotifEvent({ type: "clear", track: trackName });
    if (reverbConv) buildReverbIR(trackName);
  }

  function setMasterVolume(val) {
    masterVolume = val;
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(val, ctx.currentTime);
    }
  }

  function setLayerVolume(track, layer, val) {
    layerVolumes[track][layer] = val;
    if (!layerMuted[track][layer]) {
      applyLayerGain(track, layer);
    }
  }

  // Generic per-layer tunable parameter store. Synthesis code reads via
  // getLayerParam(track, layer, key, fallback). The UI mixing desk sets
  // values via setLayerParam(track, layer, key, val). Values are scalar.
  // Per-layer defaults live in LAYER_PARAM_DEFAULTS.
  var LAYER_PARAM_DEFAULTS = {
    library: {
      drone: {
        warmth: 240,        // LP cutoff (Hz)
        movement: 0.19,     // tremolo depth (0..1)
        tremoloRate: 0.7,   // tremolo LFO rate (Hz)
        subChance: 0.3,     // sub-octave probability per cycle
        cycleMin: 17,       // shortest cycle (s)
        cycleMax: 23,       // longest cycle (s)
      },
      melody: {
        brightness: 3.0,    // pluck filter freq multiplier
        resonance: 0.5,     // pluck filter Q
        sparkle: 0.03,      // octave-harmonic gain
      },
      musicBox: {
        shimmer: 0.006,     // 3rd-harmonic overtone gain
        decay: 1.0,         // per-note duration scale
        cluster: 0.2,       // probability of a run (2-3 notes)
      },
      clock: {
        pitch: 1.0,         // tick/tock frequency multiplier
        wander: 60,         // inter-tick drift range (ms)
        mischief: 0.15,     // combined skip + double-tick probability
      },
      hum: {
        openness: 1.0,      // formant Q scale (1/Q)
        waver: 1.0,         // pitch-jitter depth scale
        vibrato: 1.0,       // vibrato depth scale
      },
      ambient: {
        density: 1.0,       // inter-event interval scale (lower = more frequent)
        variety: "default", // pool weighting mode: uniform / default / focused
      },
    },
    sycorax: {
      drone: {
        darkness: 1.0,       // LP cutoff scale
        drift: 1.0,          // per-cluster pitch deviation scale
        subChance: 0.25,     // sub-bass probability per cycle
        cycleMin: 20,        // shortest cycle (s)
        cycleMax: 28,        // longest cycle (s)
      },
      whispers: {
        hushed: 1.0,         // bandpass Q scale
        drift: 1.0,          // formant frequency morph range scale
        length: 1.0,         // per-whisper duration scale
      },
      ghost: {
        detune: 1.0,         // 3-voice cents spread scale
        vibrato: 1.0,        // vibrato depth scale
        vibRate: 1.0,        // vibrato rate scale
      },
      waterphone: {
        wail: 1.0,           // FM modulator depth scale (bloomIntensity)
        bloom: 1.0,          // FM carrier level scale (bloomLevel)
        shimmer: 1.0,        // upper-partial tremolo scale
        gliss: 1.0,          // glissando drift scale (the engine's "wail" param)
      },
      heartbeat: {
        tempo: 1.0,          // inter-beat interval scale
        depth: 1.0,          // freq dip scale
        irregularity: 0.15,  // combined skip + triple-beat probability
      },
      scrape: {
        metal: 1.0,          // bandpass Q scale
        range: 1.0,          // starting frequency range scale
        direction: "random", // up / down / dip / random
      },
      ambient: {
        density: 1.0,        // inter-event interval scale
        variety: "default",  // uniform / default / focused
      },
    },
    ariel: {
      breeze: {
        breath: 1.0,         // air-noise gain scale
        drift: 1.0,          // LFO rate scale
        subChance: 0.4,      // sub-octave triangle probability per cycle
        swell: 1.0,          // amplitude-LFO depth scale
        cycleMin: 15,        // shortest cycle (s)
        cycleMax: 20,        // longest cycle (s)
      },
      chimes: {
        decay: 1.0,          // bell-decay time scale
        detune: 1.0,         // 2-voice cents-spread scale
        burst: 1.0,          // burst-length scale
      },
      flutter: {
        speed: 1.0,          // inter-note interval scale
        detune: 1.0,         // per-note random detune scale
        rest: 0.2,           // rest-skip probability per fire
      },
      bubbles: {
        reach: 1.0,          // glissando endMult scale
        duration: 1.0,       // bubble length scale
        cluster: 0.66,       // probability of multi-bubble cluster vs single
      },
      whistle: {
        vibrato: 1.0,        // vibrato depth scale
        vibRate: 1.0,        // vibrato LFO rate scale
        breath: 1.0,         // breathy 1800 Hz noise scale
      },
      bass: {
        space: 0.6,          // gap length between fires (higher = more stretched)
        flourish: 0.2,       // probability of a remembered flourish vs a plain anchor
        reach: 0.25,         // probability of lifting a note into octave 2
      },
      ambient: {
        density: 1.0,        // inter-event interval scale
        variety: "default",  // uniform / default / focused
      },
    },
  };
  // Deep clone defaults so live edits don't mutate the canonical map.
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));
  function getLayerParam(track, layer, key, fallback) {
    if (layerParams[track] && layerParams[track][layer] &&
        layerParams[track][layer][key] != null) {
      return layerParams[track][layer][key];
    }
    return fallback;
  }
  function setLayerParam(track, layer, key, val) {
    if (!layerParams[track]) layerParams[track] = {};
    if (!layerParams[track][layer]) layerParams[track][layer] = {};
    layerParams[track][layer][key] = val;
  }
  function resetLayerParams(track, layer) {
    var d = LAYER_PARAM_DEFAULTS[track] && LAYER_PARAM_DEFAULTS[track][layer];
    if (!d) return;
    if (!layerParams[track][layer]) layerParams[track][layer] = {};
    Object.keys(d).forEach(function (k) {
      layerParams[track][layer][k] = d[k];
    });
  }

  function setLayerRate(track, layer, rate) {
    if (layerRate[track]) {
      layerRate[track][layer] = rate;
      rescheduleLayer(track, layer, getRate(track, layer));
    }
  }

  function resetLayers(track) {
    var layers = Object.keys(layerVolumes[track]);
    for (var i = 0; i < layers.length; i++) {
      layerVolumes[track][layers[i]] = DEFAULT_LAYER_VOL;
      layerMuted[track][layers[i]] = false;
      if (layerRate[track] && layerRate[track][layers[i]] !== undefined)
        layerRate[track][layers[i]] = 1;
      if (layerGains[track][layers[i]])
        applyLayerGain(track, layers[i]);
    }
  }

  function toggleLayer(track, layer) {
    layerMuted[track][layer] = !layerMuted[track][layer];
    applyLayerGain(track, layer);
    return !layerMuted[track][layer]; // returns true if now enabled
  }

  // ==========================================================================
  // TRACK 3: ARIEL'S DAY OFF — LAYER METHODS
  // ==========================================================================

  function scheduleAriel() {
    if (!playing || currentTrack !== "ariel") return;
    // Reset Markov state
    arielChimeIdx = Math.floor(Math.random() * ARIEL_SCALE_5.length);
    arielFlutterIdx = Math.floor(Math.random() * ARIEL_SCALE_4.length);
    arielWhistleIdx = Math.floor(Math.random() * ARIEL_SCALE_4.length);
    arielBreezeIdx = Math.floor(Math.random() * ARIEL_BREEZE_PAIRS.length);
    // Reset the bass narrative-arc state before the breeze sets the first
    // centre (which arms the opening arrival).
    arielBassStart = ctx.currentTime;
    arielBassDriftOffset = 0;
    arielBassPendingArrival = false;
    arielBassBuffer.length = 0;
    // Launch all independent generative layers
    arielBreeze();
    arielChimes();
    arielFlutter();
    arielBubbles();
    arielBass();
    scheduleAri(arielWhistle, 8000 + Math.random() * 12000);
    scheduleAri(arielAmbient, 6000 + Math.random() * 10000);
  }

  // ==========================================================================
  // ARIEL BASS — aleatoric low end with a narrative arc.
  //
  // Mostly long sustained roots in the bottom two octaves, with occasional
  // 2–3 note gestures and rare remembered flourishes. Every choice is a
  // weighted coin-flip biased to the breeze's current harmonic centre (read
  // from harmonicIdx) — nothing is scripted. A slow intensity arc bends the
  // odds over a long timescale (repose → rising action → settle), and each
  // breeze centre change plants the new root (an "arrival"). Ported from
  // ariel-bass-sandbox.html (Electric Bass voice + Stretched Anchor model).
  // ==========================================================================
  var arielBassPendingArrival = false; // armed by arielBreeze on each centre change
  var arielBassDriftOffset = 0;        // bounded random walk on the intensity arc
  var arielBassStart = 0;              // ctx time the layer started (arc phase origin)
  var arielBassBuffer = [];            // remembered figures for flourishes

  // Bass root for the current breeze centre, two octaves below the breeze
  // pair so it sits in octaves 1–2 (~F1 = 43.7 Hz).
  function arielBassRoot() {
    var pair = ARIEL_BREEZE_PAIRS[harmonicIdx % ARIEL_BREEZE_PAIRS.length];
    return pair[0] / 4;
  }

  // Narrative spine: slow intensity in ~0..1 — two long coprime-ish sines for
  // the ebb/flow, plus a bounded random walk so it never settles into an
  // obvious loop. Low = sparse low repose; high = busier, higher, flourishes.
  function arielBassIntensity() {
    var u = (ctx ? ctx.currentTime : 0) - arielBassStart;
    var a = Math.sin(2 * Math.PI * u / 47);
    var b = Math.sin(2 * Math.PI * u / 73 + 1.3);
    var base = ((a + b) / 2 + 1) / 2;
    return Math.max(0, Math.min(1, base * 0.82 + arielBassDriftOffset + 0.09));
  }
  function arielBassNudgeDrift() {
    arielBassDriftOffset += (Math.random() - 0.5) * 0.05;
    arielBassDriftOffset = Math.max(-0.25, Math.min(0.25, arielBassDriftOffset));
  }

  // Chance pitch within the bottom two octaves (semitone offset from root):
  // root / fifth / third, occasionally lifted an octave by REACH, clamped to 19.
  function arielBassPitch(reach) {
    var r = Math.random();
    var off = r < 0.62 ? 0 : (r < 0.85 ? 7 : 4);
    if ((harmonicIdx % ARIEL_BREEZE_PAIRS.length) === 3 && Math.random() < 0.15) off = 6; // Lydian #4
    if (Math.random() < reach) off += 12;
    return Math.min(off, 19);
  }

  function arielBassCloneFig(f) {
    return f.map(function (x) { return { off: x.off, dt: x.dt }; });
  }

  // Electric-bass voice — additive triangle partials (fundamental + 2nd + 3rd)
  // that ring out, so the low pitch is unmistakable. Note peak stays in the
  // engine's per-note range (~0.06) and the layer gain handles the rest.
  function playArielBassNote(out, t, freq, dur, vel) {
    var c = ctx;
    var tone = 0.55;
    var ring = Math.max(dur * 0.9, 0.4);
    // Bass sits forward in the mix — low frequencies read quieter (equal-
    // loudness), and the other Ariel layers peak ~0.05, so this runs hotter.
    var peak = 0.14 * vel;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    g.connect(out);
    var partials = [[1, 1.0], [2, 0.45 * tone + 0.15], [3, 0.32 * tone]];
    for (var i = 0; i < partials.length; i++) {
      var o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq * partials[i][0];
      var og = c.createGain();
      og.gain.value = partials[i][1];
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + ring + 0.05);
    }
    emitNoteEvent({ track: "ariel", layer: "bass", freq: freq, startTime: t, duration: ring });
  }

  // A rationed flourish — a short remembered figure, replayed fresh / verbatim
  // / transformed (retrograde or octave), following the harmonic drift.
  function arielBassFlourish(out, now, root, reach) {
    var roll = Math.random(), fig, tag;
    if (arielBassBuffer.length && roll < 0.30) {
      fig = arielBassCloneFig(arielBassBuffer[Math.floor(Math.random() * arielBassBuffer.length)]);
      tag = "verbatim";
    } else if (arielBassBuffer.length && roll < 0.50) {
      var base = arielBassCloneFig(arielBassBuffer[Math.floor(Math.random() * arielBassBuffer.length)]);
      if (Math.random() < 0.6) { fig = base.slice().reverse(); tag = "retrograde"; }
      else { fig = base.map(function (x) { return { off: Math.min(19, x.off + 12), dt: x.dt }; }); tag = "octave"; }
    } else {
      var n = 2 + Math.floor(Math.random() * 2); // 2–3 notes
      fig = [];
      for (var i = 0; i < n; i++) fig.push({ off: arielBassPitch(reach), dt: 0.30 + Math.random() * 0.25 });
      fig[fig.length - 1].off = Math.random() < 0.6 ? 0 : 7; // land grounded
      arielBassBuffer.push(arielBassCloneFig(fig));
      if (arielBassBuffer.length > 5) arielBassBuffer.shift();
      tag = "fresh";
    }
    var t = now, names = [];
    for (var k = 0; k < fig.length; k++) {
      var freq = root * Math.pow(2, Math.min(19, fig[k].off) / 12);
      playArielBassNote(out, t, freq, 1.0, 0.85);
      names.push(freqToNoteName(freq));
      t += fig[k].dt;
    }
    emitMotifEvent({
      type: "fire", track: "ariel", layer: "bass", time: now,
      detail: names.join(" ") + " · flourish (" + tag + ")",
    });
  }

  // The bass generator — one fire, then self-reschedules (rate-aware).
  function arielBass() {
    if (!playing || currentTrack !== "ariel") return;
    var now = ctx.currentTime;
    var out = lgp("ariel", "bass");
    var root = arielBassRoot();
    var centerIdx = harmonicIdx % ARIEL_BREEZE_PAIRS.length;
    var label = ARIEL_HARMONIC_LABELS[centerIdx] ? ARIEL_HARMONIC_LABELS[centerIdx].chord : "?";

    var space    = getLayerParam("ariel", "bass", "space", 0.6);
    var flourish = getLayerParam("ariel", "bass", "flourish", 0.2);
    var reachKnob = getLayerParam("ariel", "bass", "reach", 0.25);

    // Read the narrative arc and bend the odds around the knob baselines.
    var I = arielBassIntensity();
    var pace      = 1 - I * 0.6;                       // peak arc → up to ~2.5× faster
    var flourishP = Math.min(0.6, flourish * (0.35 + I * 1.6));
    var reachEff  = Math.min(1, reachKnob * (0.5 + I * 1.4));
    var threeP    = 0.25 + I * 0.45;                   // more 3-note gestures when intense
    var gestureP  = 0.22 + I * 0.18;

    // Arrival — the breeze just changed centre. Plant the new root firmly.
    if (arielBassPendingArrival) {
      arielBassPendingArrival = false;
      playArielBassNote(out, now, root, 4.0, 0.94);
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "bass", time: now,
        detail: freqToNoteName(root) + " · arrival · " + label,
      });
      arielBassNudgeDrift();
      scheduleWithRate(arielBass, (2600 + space * 5000 + Math.random() * 2500) * pace, "ariel", "bass", 800);
      return;
    }

    var roll = Math.random();
    if (roll < flourishP) {
      arielBassFlourish(out, now, root, reachEff);
    } else if (roll < flourishP + gestureP) {
      // sustained gesture — 2 notes, sometimes 3 — among root / fifth / octave.
      var gLen = Math.random() < threeP ? 3 : 2;
      var choices = (Math.random() < reachEff) ? [0, 7, 12] : [0, 7];
      var offs = [Math.random() < 0.5 ? 0 : 7];
      for (var gi = 1; gi < gLen; gi++) offs.push(choices[Math.floor(Math.random() * choices.length)]);
      offs[gLen - 1] = Math.random() < 0.6 ? 0 : 7; // land grounded
      var gt = now, gnames = [];
      for (var gj = 0; gj < offs.length; gj++) {
        var gf = root * Math.pow(2, offs[gj] / 12);
        playArielBassNote(out, gt, gf, 2.4 - gj * 0.2, (0.78 + I * 0.15) - gj * 0.04);
        gnames.push(freqToNoteName(gf));
        gt += 0.45 + Math.random() * 0.4;
      }
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "bass", time: now,
        detail: gnames.join(" ") + " · gesture",
      });
    } else {
      // single long sustained anchor — primarily the root
      var off = Math.random() < 0.72 ? 0 : (Math.random() < reachEff ? 12 : 7);
      var freq = root * Math.pow(2, off / 12);
      playArielBassNote(out, now, freq, 3.0 + Math.random() * 1.3, 0.72 + I * 0.16);
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "bass", time: now,
        detail: freqToNoteName(freq) + " · anchor · " + label,
      });
    }

    arielBassNudgeDrift();
    var gap = (3000 + space * 7000 + Math.random() * 4000) * pace; // arc-scaled pacing
    scheduleWithRate(arielBass, gap, "ariel", "bass", 800);
  }

  // --- Continuous airy breeze pad ---
  function arielBreeze() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lg("ariel", "breeze");
    var pair = ARIEL_BREEZE_PAIRS[arielBreezeIdx % ARIEL_BREEZE_PAIRS.length];
    // The pair we just picked is the new harmonic center for Ariel. Update
    // before any melodic layer reads it, then notify listeners.
    harmonicIdx = arielBreezeIdx % ARIEL_BREEZE_PAIRS.length;
    emitHarmonicChange("ariel");
    // Arm the bass: its next fire plants the new centre's root (an "arrival").
    arielBassPendingArrival = true;
    arielBreezeIdx = (arielBreezeIdx + 1) % ARIEL_BREEZE_PAIRS.length;

    // CYCLE MIN/MAX bounds the random cycle duration. Clamp max ≥ min.
    var bzMin = getLayerParam("ariel", "breeze", "cycleMin", 15);
    var bzMax = getLayerParam("ariel", "breeze", "cycleMax", 20);
    if (bzMax < bzMin) bzMax = bzMin;
    var duration = bzMin + Math.random() * (bzMax - bzMin);
    var fadeIn = 3;
    var fadeOut = 3;
    // BREATH = air-noise gain scale; DRIFT = LFO rate scale;
    // SWELL = amplitude-LFO depth scale; SUB CHANCE = sub-octave probability.
    var breath  = getLayerParam("ariel", "breeze", "breath", 1.0);
    var drift   = getLayerParam("ariel", "breeze", "drift", 1.0);
    var swell   = getLayerParam("ariel", "breeze", "swell", 1.0);
    var bzSubChance = getLayerParam("ariel", "breeze", "subChance", 0.4);

    // Two sine oscillators at a fifth
    for (var i = 0; i < pair.length; i++) {
      var freq = pair[i];
      var o = c.createOscillator();
      var g = c.createGain();
      // Slow amplitude LFO for breathing
      var lfo = c.createOscillator();
      var lfoG = c.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime((0.1 + Math.random() * 0.2) * drift, now);
      lfoG.gain.setValueAtTime(0.03 * swell, now);
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06, now + fadeIn);
      g.gain.setValueAtTime(0.06, now + duration - fadeOut);
      g.gain.linearRampToValueAtTime(0, now + duration);
      o.start(now);
      o.stop(now + duration + 0.1);
      lfo.start(now);
      lfo.stop(now + duration + 0.1);
    }

    // Sub-octave triangle for warmth (SUB CHANCE knob).
    var hasSub = Math.random() < bzSubChance;
    var subFreq = hasSub ? pair[0] / 2 : null;
    if (hasSub) {
      var subO = c.createOscillator();
      var subG = c.createGain();
      subO.type = "triangle";
      subO.frequency.setValueAtTime(subFreq, now);
      subO.connect(subG);
      subG.connect(out);
      subG.gain.setValueAtTime(0, now);
      subG.gain.linearRampToValueAtTime(0.025, now + fadeIn);
      subG.gain.setValueAtTime(0.025, now + duration - fadeOut);
      subG.gain.linearRampToValueAtTime(0, now + duration);
      subO.start(now);
      subO.stop(now + duration + 0.1);
    }

    // Broadcast cycle data for the drone visualizer (same shape as
    // libraryDrone / sycoraxDrone emit).
    emitDroneEvent({
      track: "ariel",
      startTime: now,
      duration: duration,
      fadeIn: fadeIn,
      fadeOut: fadeOut,
      peakGain: 0.06,
      frequencies: pair.slice(),
      subFreq: subFreq,
      subPeakGain: hasSub ? 0.025 : 0,
    });

    // Gentle air noise (scaled by BREATH knob).
    var ns = noiseSource(duration);
    var nf = c.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.setValueAtTime(6000, now);
    var ng = c.createGain();
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    var airPeak = 0.004 * breath; // high-passed "static mist" hiss — halved from 0.008
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(airPeak, now + fadeIn);
    ng.gain.setValueAtTime(airPeak, now + duration - fadeOut);
    ng.gain.linearRampToValueAtTime(0, now + duration);
    startNoise(ns, now);

    var overlap = 2 + Math.random() * 3;
    scheduleAri(arielBreeze, (duration - overlap) * 1000);
  }

  // --- Markov-driven wind chime pings ---
  // --- Burst & Breathe chimes: clusters of 2-4 quick notes, then silence ---
  function arielChimes() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("ariel", "chimes");

    // DECAY  scales the bell decay time (1.5–2.5 s default).
    // DETUNE scales the 2-voice cents spread (±2–4 cents default).
    // BURST  scales the burst length (2–4 notes default). Always ≥ 1.
    var chDecay  = getLayerParam("ariel", "chimes", "decay", 1.0);
    var chDetune = getLayerParam("ariel", "chimes", "detune", 1.0);
    var chBurst  = getLayerParam("ariel", "chimes", "burst", 1.0);

    // Burst phase: scaled by BURST. Floor at 1.
    var burstLen = Math.max(1, Math.round((2 + Math.floor(Math.random() * 3)) * chBurst));
    var offset = 0;
    var chordTones = getChordTonesFor("ariel", "chimes");
    var chimeFirstFreq = null;

    for (var ni = 0; ni < burstLen; ni++) {
      var t = now + offset;
      offset += 0.08 + Math.random() * 0.04;

      // Last note of the burst resolves toward a chord tone; mid-burst notes
      // take the gentler base bias so the line still wanders.
      if (ni === burstLen - 1) {
        arielChimeIdx = resolveDegree(arielChimeIdx, ARIEL_CHIME_MARKOV[arielChimeIdx], chordTones);
      } else {
        arielChimeIdx = markovNextChordBiased(ARIEL_CHIME_MARKOV[arielChimeIdx], chordTones, HARMONIC_BIAS_BASE);
      }
      var freq = ARIEL_SCALE_5[arielChimeIdx];
      if (chimeFirstFreq === null) chimeFirstFreq = freq;
      var decay = (1.5 + Math.random()) * chDecay;

      // Two detuned bell-wave oscillators for metallic shimmer
      var detune = (2 + Math.random() * 2) * chDetune;
      for (var di = 0; di < 2; di++) {
        var o = c.createOscillator();
        var g = c.createGain();
        if (bellWave) o.setPeriodicWave(bellWave); else o.type = "sine";
        o.frequency.setValueAtTime(freq + (di === 0 ? -detune : detune), t);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        o.start(t);
        o.stop(t + decay + 0.1);
      }
    }

    if (chimeFirstFreq !== null) {
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "chimes", time: now,
        detail: freqToNoteName(chimeFirstFreq) + " · " + burstLen + " notes",
      });
    }

    // Breathe phase: longer pause, with 25% chance of a lone ping in the silence
    var pause = 3000 + Math.random() * 3000;
    if (Math.random() < 0.25) {
      // Schedule a lone ping partway through the pause
      scheduleWithRate(arielChimePing, pause * 0.4, "ariel", "chimes");
      // Then resume with next burst after remaining pause
      // (the ping function handles scheduling the next burst)
    } else {
      scheduleWithRate(arielChimes, pause, "ariel", "chimes");
    }
  }

  // A single isolated chime ping during a breathe pause
  function arielChimePing() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("ariel", "chimes");

    // Lone ping reuses the same DECAY + DETUNE knobs as the burst.
    var pingChDecay  = getLayerParam("ariel", "chimes", "decay", 1.0);
    var pingChDetune = getLayerParam("ariel", "chimes", "detune", 1.0);
    var pingChordTones = getChordTonesFor("ariel", "chimes");
    arielChimeIdx = resolveDegree(arielChimeIdx, ARIEL_CHIME_MARKOV[arielChimeIdx], pingChordTones);
    var freq = ARIEL_SCALE_5[arielChimeIdx];
    var decay = (1.5 + Math.random()) * pingChDecay;
    var detune = (2 + Math.random() * 2) * pingChDetune;

    for (var di = 0; di < 2; di++) {
      var o = c.createOscillator();
      var g = c.createGain();
      if (bellWave) o.setPeriodicWave(bellWave); else o.type = "sine";
      o.frequency.setValueAtTime(freq + (di === 0 ? -detune : detune), now);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.03, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, now + decay);
      o.start(now);
      o.stop(now + decay + 0.1);
    }

    emitMotifEvent({
      type: "fire", track: "ariel", layer: "chimes", time: now,
      detail: freqToNoteName(freq) + " · ping",
    });

    // Resume with next burst after remaining breathe pause
    var remaining = 1800 + Math.random() * 1800;
    scheduleWithRate(arielChimes, remaining, "ariel", "chimes");
  }

  // --- Quick playful melodic fragments ---
  function arielFlutter() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("ariel", "flutter");

    // SPEED  scales inter-note interval (0.08 s default).
    // DETUNE scales per-note random detune (±2 cents default).
    // REST   probability of skipping this fire entirely.
    var flSpeed  = getLayerParam("ariel", "flutter", "speed", 1.0);
    var flDetune = getLayerParam("ariel", "flutter", "detune", 1.0);
    var flRest   = getLayerParam("ariel", "flutter", "rest", 0.2);

    if (Math.random() < flRest) {
      scheduleWithRate(arielFlutter, 3000 + Math.random() * 3000, "ariel", "flutter");
      return;
    }

    var noteCount = 2 + Math.floor(Math.random() * 3); // 2-4 notes
    var flutterChordTones = getChordTonesFor("ariel", "flutter");
    var flutterFirstFreq = null, flutterLastFreq = null;

    for (var ni = 0; ni < noteCount; ni++) {
      var t = now + ni * 0.08 * flSpeed;

      if (ni === noteCount - 1) {
        arielFlutterIdx = resolveDegree(arielFlutterIdx, ARIEL_FLUTTER_MARKOV[arielFlutterIdx], flutterChordTones);
      } else {
        arielFlutterIdx = markovNextChordBiased(ARIEL_FLUTTER_MARKOV[arielFlutterIdx], flutterChordTones, HARMONIC_BIAS_BASE);
      }
      var freq = ARIEL_SCALE_4[arielFlutterIdx];
      if (flutterFirstFreq === null) flutterFirstFreq = freq;
      flutterLastFreq = freq;
      var dur = 0.15 + Math.random() * 0.1;

      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq + (Math.random() * 4 - 2) * flDetune, t); // slight detune
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.005);
      g.gain.setValueAtTime(0.04, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }

    if (flutterFirstFreq !== null) {
      var flutterRange = freqToNoteName(flutterFirstFreq);
      if (flutterLastFreq !== flutterFirstFreq) {
        flutterRange += "→" + freqToNoteName(flutterLastFreq);
      }
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "flutter", time: now,
        detail: flutterRange + " · " + noteCount + " notes",
      });
    }

    scheduleWithRate(arielFlutter, 3000 + Math.random() * 3000, "ariel", "flutter");
  }

  // --- Ascending sine bubble glissandos ---
  function arielBubbles() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("ariel", "bubbles");

    // REACH    scales the glissando endMult (how far each bubble climbs).
    // DURATION scales the per-bubble length.
    // CLUSTER  probability of 2-3 bubbles vs single (was 1 + floor(rand×3)
    //          → 66% multi at default).
    var bbReach    = getLayerParam("ariel", "bubbles", "reach", 1.0);
    var bbDuration = getLayerParam("ariel", "bubbles", "duration", 1.0);
    var bbCluster  = getLayerParam("ariel", "bubbles", "cluster", 0.66);
    var bubbleCount = (Math.random() < bbCluster)
      ? 2 + Math.floor(Math.random() * 2)   // 2-3 when clustering
      : 1;                                  // single otherwise
    var bubbleFirstStart = null, bubbleLastEnd = null;

    for (var bi = 0; bi < bubbleCount; bi++) {
      var t = now + bi * (0.2 + Math.random() * 0.3);
      var startFreq = 400 + Math.random() * 800;
      // endMult: range centered around 2.25 (the midpoint of 1.5–3) so
      // REACH scales the *deviation*, never going below 1.0 (no down-gliss).
      var endMultRaw = 1.5 + Math.random() * 1.5;
      var endMult = Math.max(1.0, 1 + (endMultRaw - 1) * bbReach);
      var dur = (0.3 + Math.random() * 1.2) * bbDuration;
      if (bubbleFirstStart === null) bubbleFirstStart = startFreq;
      bubbleLastEnd = startFreq * endMult;

      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(startFreq * endMult, t + dur);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + dur * 0.15);
      g.gain.setValueAtTime(0.02, t + dur * 0.6);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.1);

      // Per-bubble event so the spiral viz can float a bubble that tracks this
      // note's pitch glide (start → end) and pops when it ends.
      emitNoteEvent({
        track: "ariel", layer: "bubbles",
        freq: startFreq, endFreq: startFreq * endMult,
        startTime: t, duration: dur,
      });
    }

    if (bubbleFirstStart !== null) {
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "bubbles", time: now,
        detail: freqToNoteName(bubbleFirstStart) + "→" +
                freqToNoteName(bubbleLastEnd) +
                (bubbleCount > 1 ? " · " + bubbleCount + "x" : ""),
      });
    }

    scheduleWithRate(arielBubbles, 5000 + Math.random() * 5000, "ariel", "bubbles");
  }

  // --- Whistle note synth ---
  // One flute-PeriodicWave note with 5.5 Hz vibrato + breathy 1800 Hz bandpass
  // noise + linear-ramp envelope. opts:
  //   gainScale     1 = full envelope peak (0.035), 0.5 = half, etc.
  //   vibDepth      Hz of pitch modulation from the vibrato LFO (default 2)
  //   vibRate       LFO rate in Hz (default 5.5)
  //   bend          when true, applies an expressive mid-note pitch bend
  //   bendSemitones signed semitone amount (positive = up, negative = down)
  function playArielWhistleNote(out, t, freq, noteDur, opts) {
    var c = ctx;
    opts = opts || {};
    var gainScale = opts.gainScale != null ? opts.gainScale : 1;
    // Whistle knobs apply on top of any motif-supplied vibrato params.
    // VIBRATO  scales the vibrato Hz depth.
    // VIB RATE scales the vibrato LFO rate.
    // BREATH   scales the breathy 1800 Hz bandpass noise mixed in.
    var whVibScale  = getLayerParam("ariel", "whistle", "vibrato", 1.0);
    var whVibRate   = getLayerParam("ariel", "whistle", "vibRate", 1.0);
    var whBreath    = getLayerParam("ariel", "whistle", "breath", 1.0);
    var vibDepth = (opts.vibDepth != null ? opts.vibDepth : 2)   * whVibScale;
    var vibRate  = (opts.vibRate  != null ? opts.vibRate  : 5.5) * whVibRate;
    var peak = 0.035 * gainScale;
    var held = 0.03  * gainScale;

    // Voice oscillator + optional mid-note bend. Vibrato adds on top of the
    // base frequency via vibG → voice.frequency.
    var voice = c.createOscillator();
    if (fluteWave) voice.setPeriodicWave(fluteWave); else voice.type = "sine";
    voice.frequency.setValueAtTime(freq, t);
    if (opts.bend && opts.bendSemitones) {
      var bendFactor = Math.pow(2, opts.bendSemitones / 12);
      voice.frequency.linearRampToValueAtTime(freq,              t + noteDur * 0.35);
      voice.frequency.linearRampToValueAtTime(freq * bendFactor, t + noteDur * 0.55);
      voice.frequency.linearRampToValueAtTime(freq,              t + noteDur * 0.80);
    }

    var vib = c.createOscillator();
    var vibG = c.createGain();
    vib.type = "sine";
    vib.frequency.setValueAtTime(vibRate, t);
    vibG.gain.setValueAtTime(vibDepth, t);
    vib.connect(vibG);
    vibG.connect(voice.frequency);

    var ns = noiseSource(noteDur);
    var nf = c.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.setValueAtTime(1800, t);
    nf.Q.setValueAtTime(12, t);
    // BREATH knob: gain stage between the bandpass-filtered noise and the
    // mix bus. Default 1 keeps the original level; 0 = pure flute tone.
    var breathGain = c.createGain();
    breathGain.gain.setValueAtTime(whBreath, t);

    var mix = c.createGain();
    voice.connect(mix);
    ns.connect(nf);
    nf.connect(breathGain);
    breathGain.connect(mix);
    mix.connect(out);

    // Attack-Sustain-Release envelope. The slow attack (~300ms capped) is
    // what makes the lollipop visibly grow from the row baseline. The
    // sustain phase holds the audio (and therefore the lollipop) at peak
    // through ~60% of the note so it reads as "present and holding" rather
    // than constantly in motion. The release ramps to silence over the
    // remaining ~40%, which the lollipop also tracks as a visible shrink.
    var attack = Math.min(0.35, noteDur * 0.28);
    var sustainEnd = noteDur * 0.6;
    // Guarantee at least 50ms of sustain even for very short notes so the
    // peak moment is perceivable rather than a glance.
    if (sustainEnd < attack + 0.05) sustainEnd = attack + 0.05;
    mix.gain.setValueAtTime(0, t);
    mix.gain.linearRampToValueAtTime(peak, t + attack);
    mix.gain.setValueAtTime(peak, t + sustainEnd);
    mix.gain.linearRampToValueAtTime(0, t + noteDur);
    // `held` retained for compat — no longer referenced in the envelope.
    void held;

    var stopAt = t + noteDur + 0.01;
    voice.start(t); voice.stop(stopAt);
    vib.start(t);   vib.stop(stopAt);
    startNoise(ns, t);
  }

  // --- Motif renderer ---
  function playArielWhistleMotif(motif, out, now) {
    var notes = motif.notes;
    var len = ARIEL_SCALE_4.length;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var idx = n.degree;
      if (idx < 0) idx = 0;
      else if (idx >= len) idx = len - 1;
      playArielWhistleNote(out, now + n.offset, ARIEL_SCALE_4[idx], n.dur, {
        gainScale:     n.gain,
        vibDepth:      n.vibDepth,
        bend:          n.bend,
        bendSemitones: n.bendSemitones,
      });
    }
  }

  // ----- Motif builders ---------------------------------------------------

  // Phrase — 2–8 Markov-walked notes (the original arielWhistle behavior,
  // expanded from 2–3 to 2–8 for wider variance).
  function buildArielWhistlePhrase() {
    var motif = makeMotif("phrase");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var count = 2 + Math.floor(Math.random() * 7); // 2–8
    var t = 0;
    var phraseChordTones = getChordTonesFor("ariel", "whistle");
    for (var i = 0; i < count; i++) {
      if (i === count - 1) {
        arielWhistleIdx = resolveDegree(arielWhistleIdx, ARIEL_WHISTLE_MARKOV[arielWhistleIdx], phraseChordTones);
      } else {
        arielWhistleIdx = markovNextChordBiased(ARIEL_WHISTLE_MARKOV[arielWhistleIdx], phraseChordTones, HARMONIC_BIAS_BASE);
      }
      var dur = 0.85 + Math.random() * 0.55; // was 0.6 + r*0.5
      motifAddNote(motif, arielWhistleIdx, t, dur, 1, 1);
      t += dur + 0.08;
    }
    motif.endDegree = arielWhistleIdx;
    return motif;
  }

  // Lone Tone — single 2–5 s sustained note with deeper vibrato. ~35% of
  // fires include a subtle pitch bend (±0.7–1.2 semitones) mid-note.
  function buildArielWhistleLoneTone() {
    var motif = makeMotif("loneTone");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var dur = 2.5 + Math.random() * 3; // was 2 + r*3
    var note = {
      degree: arielWhistleIdx, offset: 0, dur: dur,
      gain: 1, octMult: 1, vibDepth: 4,
    };
    if (Math.random() < 0.35) {
      note.bend = true;
      var dir = Math.random() < 0.5 ? -1 : 1;
      note.bendSemitones = dir * (0.7 + Math.random() * 0.5);
    }
    motif.notes.push(note);
    motif.endDegree = arielWhistleIdx;
    return motif;
  }

  // Climb — directional Markov walk upward, 4–5 notes. Final note held longest.
  function buildArielWhistleClimb() {
    var motif = makeMotif("climb");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var count = 4 + Math.floor(Math.random() * 2);
    var t = 0;
    var idx = arielWhistleIdx;
    for (var i = 0; i < count; i++) {
      var isLast = (i === count - 1);
      // bumped: was 1.5 + r and 0.4 + 0.18*i
      var dur = isLast ? 1.9 + Math.random() * 1.2 : 0.55 + 0.22 * i;
      motifAddNote(motif, idx, t, dur, 1, 1);
      t += dur + 0.05;
      if (!isLast) idx = stepDirectional(idx, +1, ARIEL_SCALE_4.length);
    }
    arielWhistleIdx = idx;
    motif.endDegree = idx;
    return motif;
  }

  // Sigh — directional Markov walk downward, 3–4 notes with diminuendo.
  function buildArielWhistleSigh() {
    var motif = makeMotif("sigh");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var count = 3 + Math.floor(Math.random() * 2);
    var t = 0;
    var idx = arielWhistleIdx;
    for (var i = 0; i < count; i++) {
      var isLast = (i === count - 1);
      // bumped: was 1.8 + r and 0.7 + r*0.3
      var dur = isLast ? 2.3 + Math.random() * 1.3 : 0.9 + Math.random() * 0.45;
      var gain = 1.0 - i * 0.15;
      motifAddNote(motif, idx, t, dur, gain, 1);
      t += dur + 0.05;
      if (!isLast) idx = stepDirectional(idx, -1, ARIEL_SCALE_4.length);
    }
    arielWhistleIdx = idx;
    motif.endDegree = idx;
    return motif;
  }

  // Lydian Gesture — F (degree 0) → B (degree 3) → optional resolve to F.
  // The augmented-4th is the F-Lydian character interval.
  function buildArielWhistleLydianGesture() {
    var motif = makeMotif("lydian");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var dur1 = 1.3 + Math.random() * 0.5;   // was 1.0 + r*0.4
    var gap  = 0.15;
    var dur2 = 2.0 + Math.random() * 0.6;   // was 1.5 + r*0.5
    var t = 0;
    motifAddNote(motif, 0, t, dur1, 1, 1);          // F
    t += dur1 + gap;
    motifAddNote(motif, 3, t, dur2, 1, 1);          // B (#4)
    t += dur2 + 0.1;
    var endDeg;
    if (Math.random() < 0.5) {
      var dur3 = 0.8 + Math.random() * 0.5;        // was 0.6 + r*0.4
      motifAddNote(motif, 0, t, dur3, 1, 1);        // resolve to F
      endDeg = 0;
    } else {
      endDeg = 3;
    }
    arielWhistleIdx = endDeg;
    motif.endDegree = endDeg;
    return motif;
  }

  // Bird Call — 1–3 clusters of 2–5 leaping notes (3–5 scale degrees apart).
  // Each cluster resets to the starting degree and alternates direction.
  function buildArielWhistleBirdCall() {
    var motif = makeMotif("birdCall");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var r = Math.random();
    var clusters = r < 0.60 ? 1 : (r < 0.88 ? 2 : 3);
    var t = 0;
    var startIdx = arielWhistleIdx;
    var lastIdx = startIdx;
    for (var c = 0; c < clusters; c++) {
      var count = 2 + Math.floor(Math.random() * 4); // 2–5 notes per cluster
      var dir = Math.random() < 0.5 ? 1 : -1;
      var idx = startIdx;
      for (var i = 0; i < count; i++) {
        var dur = 0.28 + Math.random() * 0.22; // was 0.2 + r*0.15; over lollipop fade threshold
        motifAddNote(motif, idx, t, dur, 1, 1);
        t += dur + 0.05;
        var leap = 3 + Math.floor(Math.random() * 3);
        idx = Math.max(0, Math.min(ARIEL_SCALE_4.length - 1, idx + dir * leap));
        dir = -dir;
      }
      lastIdx = idx;
      if (c < clusters - 1) t += 0.4 + Math.random() * 0.4;
    }
    arielWhistleIdx = lastIdx;
    motif.endDegree = lastIdx;
    return motif;
  }

  // Trill — 5–8 rapid alternations between two close notes + held resolution
  // on the lower of the two.
  function buildArielWhistleTrill() {
    var motif = makeMotif("trill");
    motif.scaleLen = ARIEL_SCALE_4.length;
    var count = 5 + Math.floor(Math.random() * 4);
    var interval = Math.random() < 0.7 ? 1 : 2;
    var idxLow = Math.min(ARIEL_SCALE_4.length - 1 - interval, arielWhistleIdx);
    var idxHigh = idxLow + interval;
    var t = 0;
    for (var i = 0; i < count; i++) {
      var dur = 0.17 + Math.random() * 0.06; // was 0.12 + r*0.04; above lollipop fade
      var idx = i % 2 === 0 ? idxLow : idxHigh;
      motifAddNote(motif, idx, t, dur, 1, 1);
      t += dur + 0.02;
    }
    var resDur = 1.3 + Math.random() * 0.6; // was 1.0 + r*0.5
    motifAddNote(motif, idxLow, t, resDur, 1, 1);
    arielWhistleIdx = idxLow;
    motif.endDegree = idxLow;
    return motif;
  }

  function buildFreshArielWhistleMotif() {
    var kind = pickWeighted(ARIEL_WHISTLE_CLUSTER_WEIGHTS);
    if (kind === "phrase")   return buildArielWhistlePhrase();
    if (kind === "loneTone") return buildArielWhistleLoneTone();
    if (kind === "climb")    return buildArielWhistleClimb();
    if (kind === "sigh")     return buildArielWhistleSigh();
    if (kind === "lydian")   return buildArielWhistleLydianGesture();
    if (kind === "birdCall") return buildArielWhistleBirdCall();
    return buildArielWhistleTrill();
  }

  // --- Whistle scheduler with motif memory ---
  // Each fire either generates a fresh motif and captures it, or recalls a
  // stored motif (verbatim or transformed). Same structure as the harpsichord
  // and ghost-tones layers.
  function arielWhistle() {
    if (!playing || currentTrack !== "ariel") return;
    var c = ctx;
    var now = c.currentTime;
    var out = lgp("ariel", "whistle");

    var played = null;

    var memSize = motifBufferSize("ariel", "whistle");
    var action;
    if (memSize === 0) {
      action = "generate";
    } else {
      var ramp = Math.min(memSize / MOTIF_RECALL_RAMP_FULL, 1);
      action = pickWeighted({
        generate:        MOTIF_ACTION_WEIGHTS.generate,
        recallTransform: MOTIF_ACTION_WEIGHTS.recallTransform * ramp,
        recallVerbatim:  MOTIF_ACTION_WEIGHTS.recallVerbatim  * ramp,
      });
    }

    if (action === "generate") {
      var fresh = buildFreshArielWhistleMotif();
      playArielWhistleMotif(fresh, out, now);
      captureMotif("ariel", "whistle", fresh);
      played = fresh;
      emitMotifEvent({
        type: "fire", track: "ariel", layer: "whistle",
        time: now, motifId: fresh.id,
        cluster: fresh.sourceCluster, action: "fresh", transform: null,
      });
    } else {
      var stored = recallMotif("ariel", "whistle");
      if (stored) {
        var motif = cloneMotif(stored);
        if (action === "recallTransform") motif = applyMotifTransform(motif);
        playArielWhistleMotif(motif, out, now);
        arielWhistleIdx = Math.max(0, Math.min(ARIEL_SCALE_4.length - 1, motif.endDegree));
        played = motif;
        emitMotifEvent({
          type: "fire", track: "ariel", layer: "whistle",
          time: now, motifId: motif.id,
          cluster: motif.sourceCluster,
          action: action === "recallTransform" ? "transform" : "verbatim",
          transform: motif.lastTransform,
        });
      } else {
        var fallback = buildFreshArielWhistleMotif();
        playArielWhistleMotif(fallback, out, now);
        captureMotif("ariel", "whistle", fallback);
        played = fallback;
        emitMotifEvent({
          type: "fire", track: "ariel", layer: "whistle",
          time: now, motifId: fallback.id,
          cluster: fallback.sourceCluster, action: "fresh", transform: null,
        });
      }
    }

    var gap = 12000 + Math.random() * 13000;
    var floor = 0;
    if (played) {
      var breath = MOTIF_MIN_BREATH_MS[0] + Math.random() * MOTIF_MIN_BREATH_MS[1];
      floor = motifDurationSec(played) * 1000 + breath;
    }
    scheduleWithRate(arielWhistle, gap, "ariel", "whistle", floor);
  }

  // --- Playful ambient event pool ---
  function arielAmbient() {
    if (!playing || currentTrack !== "ariel") return;
    var out = lgp("ariel", "ambient");

    var variety = getLayerParam("ariel", "ambient", "variety", "default");
    var event = weightedChoiceVariety(ARIEL_AMBIENT_POOL, variety);
    emitAmbientEvent({ type: "fire", track: "ariel", layer: "ambient", event: event, time: ctx.currentTime });
    switch (event) {
      case "giggle":
        arielGiggle(out);
        break;
      case "birdsong":
        arielBirdsong(out);
        break;
      case "breeze_gust":
        arielBreezeGust(out);
        break;
      case "sparkle":
        arielSparkle(out);
        break;
      case "leaf_rustle":
        arielLeafRustle(out);
        break;
      case "cricket":
        arielCricket(out);
        break;
      case "wind_chime":
        arielWindChime(out);
        break;
      case "bumble_bee":
        arielBumbleBee(out);
        break;
      case "bubble_pop":
        arielBubblePop(out);
        break;
    }

    var ariDensity = getLayerParam("ariel", "ambient", "density", 1.0);
    if (ariDensity < 0.05) ariDensity = 0.05;
    scheduleWithRate(arielAmbient,
      (10000 + Math.random() * 10000) / ariDensity,
      "ariel", "ambient");
  }

  // --- Ariel ambient event synthesis ---

  function arielGiggle(out) {
    var c = ctx;
    var now = c.currentTime;
    // Sampled per-call to match the preview defaults.
    var bursts = 2 + Math.floor(Math.random() * 7); // 2–8
    var totalDur = 0.35 + Math.random() * 0.4;      // 0.35–0.75
    var vol = 0.065;
    var formants = [[600, 2200], [800, 1200]]; // eh, ah

    for (var i = 0; i < bursts; i++) {
      var t = now + (i / bursts) * totalDur;
      var burstDur = 0.04 + Math.random() * 0.02;
      var fm = formants[i % 2];
      var qShift = 1 + i * 0.15;

      var n = noiseSource(burstDur);
      var g = c.createGain();
      var f1 = c.createBiquadFilter();
      var f2 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(fm[0] * qShift, t);
      f1.Q.setValueAtTime(10, t);
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(fm[1] * qShift, t);
      f2.Q.setValueAtTime(8, t);
      n.connect(f1);
      n.connect(f2);
      var mix = c.createGain();
      f1.connect(mix);
      f2.connect(mix);
      mix.connect(g);
      g.connect(out);
      // Volume peaks in middle of sequence (matches preview envelope shape)
      var envScale = bursts > 1 ? Math.sin(Math.PI * i / (bursts - 1)) : 1;
      var envVol = vol * (0.7 + 0.6 * envScale);
      g.gain.setValueAtTime(envVol, t);
      g.gain.linearRampToValueAtTime(0, t + burstDur);
      startNoise(n, t);
    }
  }

  function arielBirdsong(out) {
    var c = ctx;
    var now = c.currentTime;
    var chirps = 2 + Math.floor(Math.random() * 4); // 2–5
    var startFreqBase = 1050 + Math.random() * 1350; // 1050–2400
    var glide = 2.3;
    var vol = 0.025;
    for (var i = 0; i < chirps; i++) {
      var t = now + i * (0.12 + Math.random() * 0.08);
      var dur = 0.06 + Math.random() * 0.04;
      var startFreq = startFreqBase + Math.random() * 500;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(startFreq * glide, t + dur);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }
  }

  function arielBreezeGust(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 1 + Math.random() * 3;                   // 1–4
    var startFreq = 130 + Math.random() * 220;         // 130–350
    var peakFreq = 550 + Math.random() * 625;          // 550–1175
    var vol = 0.02;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(startFreq, now);
    f.frequency.linearRampToValueAtTime(peakFreq, now + dur * 0.4);
    f.frequency.linearRampToValueAtTime(startFreq * 1.5, now + dur);
    f.Q.setValueAtTime(2, now);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function arielSparkle(out) {
    var c = ctx;
    var now = c.currentTime;
    var pings = 5 + Math.floor(Math.random() * 7);   // 5–11
    var rate = 12 + Math.random() * 24;              // 12–36 Hz
    var spacing = 1 / rate;
    var minFreq = 1500 + Math.random() * 900;        // 1500–2400
    var maxFreq = 4500 + Math.random() * 2850;       // 4500–7350
    var vol = 0.012;
    for (var i = 0; i < pings; i++) {
      var t = now + i * spacing;
      var freq = minFreq + Math.random() * (maxFreq - minFreq);
      var decay = 0.15 + Math.random() * 0.2;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      o.start(t);
      o.stop(t + decay + 0.01);
    }
  }

  function arielLeafRustle(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 0.25 + Math.random() * 0.35;           // 0.25–0.6
    var centerFreq = 2500 + Math.random() * 1500;    // 2500–4000
    var vol = 0.012;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(centerFreq, now);
    f.Q.setValueAtTime(5, now);
    n.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function arielCricket(out) {
    var c = ctx;
    var now = c.currentTime;
    // Cricket cadence: event = N chirps, chirp = M short percussive pulses.
    var chirps = 3 + Math.floor(Math.random() * 4);   // 3–6
    var rate = 1.7 + Math.random() * 0.7;             // 1.7–2.4 Hz (chirp spacing)
    var pulses = 3 + Math.floor(Math.random() * 3);   // 3–5 pulses per chirp
    var chirpRate = 35;                               // fixed trill rate
    var carrierFreq = 4100 + Math.random() * 1200;    // 4100–5300
    var vol = 0.013;
    var chirpSpacing = 1 / rate;
    var pulseSpacing = 1 / chirpRate;
    for (var k = 0; k < chirps; k++) {
      var chirpStart = now + k * chirpSpacing;
      // Per-chirp carrier + pulse duration so tics within one chirp are
      // tonally identical; successive chirps vary slightly.
      var cFreq = carrierFreq * (0.97 + Math.random() * 0.06);
      var pulseDur = 0.014 + Math.random() * 0.008;
      for (var i = 0; i < pulses; i++) {
        var t = chirpStart + i * pulseSpacing;
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(cFreq, t);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, t + pulseDur);
        o.start(t);
        o.stop(t + pulseDur + 0.01);
      }
    }
  }

  function arielWindChime(out) {
    var c = ctx;
    var now = c.currentTime;
    var pings = 3 + Math.floor(Math.random() * 6); // 3–8
    var rate = 2.5 + Math.random() * 2.5; // ~2.5–5 Hz
    var spacing = 1 / rate;
    var minFreq = 800 + Math.random() * 300;
    var maxFreq = 1600 + Math.random() * 800;
    var decay = 1.8;
    var vol = 0.025;
    for (var i = 0; i < pings; i++) {
      var t = now + i * spacing * (0.85 + Math.random() * 0.3);
      var fund = arielSnapToScale(minFreq + Math.random() * (maxFreq - minFreq));
      // Glassy chime partials (inharmonic on purpose).
      var partials = [
        { ratio: 1.0, amp: 1.00, decay: decay },
        { ratio: 2.4, amp: 0.50, decay: decay * 0.7 },
        { ratio: 4.5, amp: 0.25, decay: decay * 0.45 },
      ];
      for (var j = 0; j < partials.length; j++) {
        var pt = partials[j];
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(fund * pt.ratio, t);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * pt.amp, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + pt.decay);
        o.start(t);
        o.stop(t + pt.decay + 0.05);
      }
    }
  }

  function arielBumbleBee(out) {
    var c = ctx;
    var now = c.currentTime;
    var dur = 1 + Math.random() * 1;                            // 1–2
    var basePitch = arielSnapToScale(160 + Math.random() * 85); // 160–245 → F3-B3
    var buzzRate = 22 + Math.random() * 22;                     // 22–44 Hz
    var vol = 0.03;
    var carrier = c.createOscillator();
    var modulator = c.createOscillator();
    var modG = c.createGain();
    var g = c.createGain();
    carrier.type = "sawtooth";
    // Doppler glide: low → peak → low (approach / overhead / departure)
    carrier.frequency.setValueAtTime(basePitch * 0.7, now);
    carrier.frequency.linearRampToValueAtTime(basePitch, now + dur * 0.4);
    carrier.frequency.linearRampToValueAtTime(basePitch * 0.55, now + dur);
    modulator.type = "sine";
    modulator.frequency.setValueAtTime(buzzRate, now);
    modG.gain.setValueAtTime(vol * 0.5, now);
    modulator.connect(modG);
    modG.connect(g.gain);
    var lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, now);
    lp.Q.setValueAtTime(0.7, now);
    carrier.connect(lp);
    lp.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.25);
    g.gain.linearRampToValueAtTime(vol * 0.6, now + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, now + dur);
    carrier.start(now); carrier.stop(now + dur + 0.1);
    modulator.start(now); modulator.stop(now + dur + 0.1);
  }

  function arielBubblePop(out) {
    var c = ctx;
    var now = c.currentTime;
    var pops = 1 + Math.floor(Math.random() * 4);    // 1–4
    var rate = 1 + Math.random() * 3.5;              // 1–4.5 Hz
    var spacing = 1 / rate;
    var dur = 0.08 + Math.random() * 0.16;           // 0.08–0.24
    var rawStartBase = 290 + Math.random() * 210;    // 290–500
    var glide = 2.1;
    var vol = 0.03;
    for (var k = 0; k < pops; k++) {
      var t = now + k * spacing;
      // Per-pop pitch jitter so the cluster doesn't sound xeroxed.
      var raw = rawStartBase * (0.92 + Math.random() * 0.16);
      var startFreq = arielSnapToScale(raw);
      var endFreq = arielSnapToScale(startFreq * glide);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.7);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  // ==========================================================================
  // LAYER PREVIEWS — short audible samples for each layer
  // ==========================================================================

  // Returns the real generative entry function for a given (track, layer).
  // These are the same functions invoked by scheduleLibrary/Sycorax/Ariel,
  // so previews use the actual generative logic (Markov chains, randomized
  // ambient pools, drone cluster rotation, etc.) instead of a fixed snippet.
  function getLayerFn(track, layer) {
    if (track === "library") {
      if (layer === "drone") return libraryDrone;
      if (layer === "melody") return libraryMelody;
      if (layer === "musicBox") return libraryMusicBox;
      if (layer === "clock") return libraryClock;
      if (layer === "hum") return libraryHum;
      if (layer === "ambient") return libraryAmbient;
    } else if (track === "sycorax") {
      if (layer === "drone") return sycoraxDrone;
      if (layer === "whispers") return sycoraxWhispers;
      if (layer === "ghost") return sycoraxGhostTones;
      if (layer === "heartbeat") return sycoraxHeartbeat;
      if (layer === "scrape") return sycoraxScrape;
      if (layer === "waterphone") return sycoraxWaterphone;
      if (layer === "ambient") return sycoraxAmbient;
    } else if (track === "ariel") {
      if (layer === "breeze") return arielBreeze;
      if (layer === "bass") return arielBass;
      if (layer === "chimes") return arielChimes;
      if (layer === "flutter") return arielFlutter;
      if (layer === "bubbles") return arielBubbles;
      if (layer === "whistle") return arielWhistle;
      if (layer === "ambient") return arielAmbient;
    }
    return null;
  }

  // Tear down an in-flight preview: clears the end timer, drops the
  // playing/previewing flags, kills pending generative timers, and silences
  // the current track's layer gains. Safe to call when no preview is active.
  function endPreview() {
    if (!previewing) return;
    var endedTrack = previewTrack;
    var endedLayer = previewLayer;
    previewing = false;
    playing = false;
    previewTrack = null;
    previewLayer = null;
    if (previewEndTimer) {
      clearTimeout(previewEndTimer);
      previewEndTimer = null;
    }
    clearAllTimers();
    if (ctx) silenceTrackLayers(currentTrack);
    emitPreviewEvent(endedTrack, endedLayer, false);
  }

  function preview(track, layer) {
    init();
    if (ctx.state === "suspended") ctx.resume();

    // Full transport is running — the layer is already audible. No-op.
    if (playing && !previewing) return;

    // Restart-on-repeat: tear down any in-flight preview first.
    endPreview();

    // Restore master gain (stop() zeroes it).
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }

    // Layer fns guard on `playing` and `currentTrack`; set them so the
    // real generator runs against the chosen track.
    currentTrack = track;
    playing = true;
    previewing = true;
    previewTrack = track;
    previewLayer = layer;

    // Rebuild reverb IR for the track's spatial character (matches play()).
    if (reverbConv) buildReverbIR(track);

    // Restore the gain node for the layer being previewed (stop() zeros it).
    applyLayerGain(track, layer);

    var fn = getLayerFn(track, layer);
    if (fn) {
      try { fn(); } catch (e) { console.error("preview layer threw:", e); }
    }

    previewEndTimer = setTimeout(endPreview, PREVIEW_DURATION_MS);

    emitPreviewEvent(track, layer, true);
  }

  function setPreviewListener(fn) {
    if (typeof fn === "function") previewListeners.push(fn);
    else previewListeners.length = 0;
  }

  // --- Library previews ---

  function previewLibraryDrone(c, now, out) {
    // Short 3s drone snippet using first pair
    var pair = LIB_DRONE_PAIRS[0];
    var dur = 3;
    for (var i = 0; i < pair.length; i++) {
      var freq = pair[i];
      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, now);
      f.type = "lowpass";
      f.frequency.setValueAtTime(180, now);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.8);
      g.gain.setValueAtTime(0.09, now + dur - 1);
      g.gain.linearRampToValueAtTime(0, now + dur);
      o.start(now);
      o.stop(now + dur + 0.1);
    }
  }

  function previewLibraryMelody(c, now, out) {
    // Play 3 quick plucked notes
    var notes = [262, 349, 440];
    for (var i = 0; i < notes.length; i++) {
      var freq = notes[i];
      var t = now + i * 0.6;
      var dur = 1.2;
      var pluckLen = 0.03;
      var buf = c.createBuffer(1, c.sampleRate * pluckLen, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
      var n = c.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      var pf = c.createBiquadFilter();
      pf.type = "lowpass";
      pf.frequency.setValueAtTime(freq * 3, t);
      pf.frequency.exponentialRampToValueAtTime(freq * 0.8, t + dur * 0.8);
      pf.Q.setValueAtTime(0.5, t);
      var pg = c.createGain();
      n.connect(pf);
      pf.connect(pg);
      pg.connect(out);
      pg.gain.setValueAtTime(0.09, t);
      pg.gain.exponentialRampToValueAtTime(0.03, t + 0.15);
      pg.gain.linearRampToValueAtTime(0, t + dur);
      n.start(t);
      n.stop(t + dur + 0.01);
    }
  }

  function previewLibraryMusicBox(c, now, out) {
    // 3 quick pings
    var notes = [523, 698, 880];
    for (var i = 0; i < notes.length; i++) {
      var freq = notes[i];
      var t = now + i * 0.25;
      var dur = 0.8;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.015, t + 0.1);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
      // harmonic
      var h = c.createOscillator();
      var hg = c.createGain();
      h.type = "sine";
      h.frequency.setValueAtTime(freq * 3, t);
      h.connect(hg);
      hg.connect(out);
      hg.gain.setValueAtTime(0.006, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.5);
      h.start(t);
      h.stop(t + dur + 0.01);
    }
  }

  function previewLibraryClock(c, now, out) {
    // 4 tick-tocks
    for (var i = 0; i < 4; i++) {
      var t = now + i * 0.5;
      var isTock = i % 2 === 1;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(isTock ? 1800 : 2200, t);
      o.frequency.exponentialRampToValueAtTime(isTock ? 1200 : 1600, t + 0.008);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(isTock ? 0.0096 : 0.0144, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  function previewLibraryHum(c, now, out) {
    // 2-note hum phrase
    var notes = [131, 156];
    var offset = 0;
    for (var i = 0; i < notes.length; i++) {
      var freq = notes[i];
      var t = now + offset;
      var noteDur = 0.8;
      offset += noteDur + 0.05;
      var voice = c.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(freq, t);
      var vib = c.createOscillator();
      var vibG = c.createGain();
      vib.type = "sine";
      vib.frequency.setValueAtTime(5.2, t);
      vibG.gain.setValueAtTime(1.5, t);
      vib.connect(vibG);
      vibG.connect(voice.frequency);
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(270, t);
      f1.Q.setValueAtTime(6, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(2300, t);
      f2.Q.setValueAtTime(8, t);
      var mix = c.createGain();
      voice.connect(f1);
      voice.connect(f2);
      f1.connect(mix);
      f2.connect(mix);
      mix.connect(out);
      mix.gain.setValueAtTime(0, t);
      mix.gain.linearRampToValueAtTime(0.045, t + 0.15);
      mix.gain.setValueAtTime(0.04, t + noteDur * 0.6);
      mix.gain.linearRampToValueAtTime(0, t + noteDur);
      voice.start(t);
      voice.stop(t + noteDur + 0.01);
      vib.start(t);
      vib.stop(t + noteDur + 0.01);
    }
  }

  function previewLibraryAmbient(c, now, out) {
    // Play a page turn, then a distant chime
    // Page turn
    var dur1 = 0.4;
    var cutoff = (3000 + Math.random() * 4000);
    var n1 = noiseSource(dur1);
    var g1 = c.createGain();
    var f1 = c.createBiquadFilter();
    f1.type = "highpass";
    f1.frequency.setValueAtTime(cutoff, now);
    f1.frequency.linearRampToValueAtTime(cutoff + 3000, now + dur1);
    n1.connect(f1);
    f1.connect(g1);
    g1.connect(out);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.025, now + dur1 * 0.3);
    g1.gain.linearRampToValueAtTime(0, now + dur1);
    startNoise(n1, now);
    // Distant chime at 0.6s
    var t2 = now + 0.6;
    var freq2 = 698;
    var decay = 2;
    var o1 = c.createOscillator();
    var cg1 = c.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(freq2, t2);
    o1.connect(cg1);
    cg1.connect(out);
    cg1.gain.setValueAtTime(0.025, t2);
    cg1.gain.exponentialRampToValueAtTime(0.001, t2 + decay);
    o1.start(t2);
    o1.stop(t2 + decay + 0.1);
    var o2 = c.createOscillator();
    var cg2 = c.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq2 + 3, t2);
    o2.connect(cg2);
    cg2.connect(out);
    cg2.gain.setValueAtTime(0.02, t2);
    cg2.gain.exponentialRampToValueAtTime(0.001, t2 + decay);
    o2.start(t2);
    o2.stop(t2 + decay + 0.1);
  }

  // --- Sycorax previews ---

  function previewSycoraxDrone(c, now, out) {
    // Short 3s dissonant drone cluster
    var cluster = SYC_DRONE_CLUSTERS[0];
    var dur = 3;
    for (var i = 0; i < cluster.length; i++) {
      var freq = cluster[i];
      var o = c.createOscillator();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, now);
      f.type = "lowpass";
      f.frequency.setValueAtTime(250, now);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.035, now + 0.8);
      g.gain.setValueAtTime(0.035, now + dur - 1);
      g.gain.linearRampToValueAtTime(0, now + dur);
      o.start(now);
      o.stop(now + dur + 0.1);
    }
  }

  function previewSycoraxWhispers(c, now, out) {
    // One whisper voice
    var formant = SYC_WHISPER_FORMANTS[0];
    var dur = 2;
    var n = noiseSource(dur);
    var g = c.createGain();
    var f1 = c.createBiquadFilter();
    var f2 = c.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(formant[0], now);
    f1.Q.setValueAtTime(10, now);
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(formant[1], now);
    f2.Q.setValueAtTime(8, now);
    n.connect(f1);
    n.connect(f2);
    var mix = c.createGain();
    f1.connect(mix);
    f2.connect(mix);
    mix.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + dur * 0.25);
    g.gain.linearRampToValueAtTime(0.04, now + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, now + dur);
    startNoise(n, now);
  }

  function previewSycoraxGhost(c, now, out) {
    // 2 ghost tones
    var notes = [SYC_GHOST_SCALE[0], SYC_GHOST_SCALE[3]];
    for (var ni = 0; ni < notes.length; ni++) {
      var freq = notes[ni];
      var t = now + ni * 1.5;
      var dur = 2.5;
      var detunes = [-15, 0, 15];
      for (var di = 0; di < detunes.length; di++) {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(detunes[di], t);
        var vib = c.createOscillator();
        var vibG = c.createGain();
        vib.type = "sine";
        vib.frequency.setValueAtTime(0.4, t);
        vibG.gain.setValueAtTime(5, t);
        vib.connect(vibG);
        vibG.connect(o.frequency);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.018, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.start(t);
        o.stop(t + dur + 0.1);
        vib.start(t);
        vib.stop(t + dur + 0.1);
      }
    }
  }

  function previewSycoraxHeartbeat(c, now, out) {
    // 3 heartbeats
    for (var b = 0; b < 3; b++) {
      var tBase = now + b * 1.2;
      for (var i = 0; i < 2; i++) {
        var t = tBase + i * 0.32;
        var isLub = i === 0;
        var startF = (isLub ? 40 : 34);
        var endF = 20;
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(startF, t);
        o.frequency.exponentialRampToValueAtTime(endF, t + 0.2);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(isLub ? 0.12 : 0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t);
        o.stop(t + 0.35);
      }
    }
  }

  function previewSycoraxScrape(c, now, out) {
    // One metallic sweep
    var dur = 1.5;
    var startFreq = 400;
    var o = c.createOscillator();
    var g = c.createGain();
    var f = c.createBiquadFilter();
    o.type = "sawtooth";
    f.type = "bandpass";
    f.frequency.setValueAtTime(startFreq, now);
    f.Q.setValueAtTime(15, now);
    o.frequency.setValueAtTime(startFreq, now);
    o.frequency.linearRampToValueAtTime(startFreq * 0.4, now + dur);
    o.connect(f);
    f.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.05);
    g.gain.setValueAtTime(0.035, now + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now);
    o.stop(now + dur + 0.1);
  }

  function previewSycoraxAmbient(c, now, out) {
    // Chains rattle then a water drip
    var pings = 6;
    var totalDur = 0.5;
    for (var i = 0; i < pings; i++) {
      var t = now + (i / pings) * totalDur;
      var pingDur = 0.025;
      var n = noiseSource(pingDur);
      var g = c.createGain();
      var bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.setValueAtTime(3000 + Math.random() * 4000, t);
      bf.Q.setValueAtTime(25, t);
      n.connect(bf);
      bf.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + pingDur);
      startNoise(n, t);
    }
    // Water drip at 0.8s
    var t2 = now + 0.8;
    var dropFreq = 2500;
    var o = c.createOscillator();
    var dg = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(dropFreq, t2);
    o.frequency.exponentialRampToValueAtTime(300, t2 + 0.08);
    o.connect(dg);
    dg.connect(out);
    dg.gain.setValueAtTime(0.025, t2);
    dg.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
    o.start(t2);
    o.stop(t2 + 0.1);
  }

  // --- Ariel previews ---

  function previewArielBreeze(c, now, out) {
    var dur = 3;
    var pair = ARIEL_BREEZE_PAIRS[0];
    for (var i = 0; i < pair.length; i++) {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(pair[i], now);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.8);
      g.gain.setValueAtTime(0.06, now + dur - 1);
      g.gain.linearRampToValueAtTime(0, now + dur);
      o.start(now);
      o.stop(now + dur + 0.1);
    }
  }

  function previewArielChimes(c, now, out) {
    var notes = [698, 880, 1047];
    for (var i = 0; i < notes.length; i++) {
      var t = now + i * 0.2;
      var freq = notes[i];
      var decay = 1.5;
      for (var di = 0; di < 2; di++) {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq + (di === 0 ? -3 : 3), t);
        o.connect(g);
        g.connect(out);
        g.gain.setValueAtTime(0.03, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        o.start(t);
        o.stop(t + decay + 0.1);
      }
    }
  }

  function previewArielFlutter(c, now, out) {
    var notes = [349, 494, 659, 440];
    for (var i = 0; i < notes.length; i++) {
      var t = now + i * 0.08;
      var dur = 0.18;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(notes[i], t);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.05, t);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }
  }

  function previewArielBubbles(c, now, out) {
    for (var i = 0; i < 3; i++) {
      var t = now + i * 0.3;
      var startFreq = 500 + i * 200;
      var dur = 0.6;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(startFreq, t);
      o.frequency.exponentialRampToValueAtTime(startFreq * 2, t + dur);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.1);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  function previewArielWhistle(c, now, out) {
    var notes = [440, 523];
    var offset = 0;
    for (var i = 0; i < notes.length; i++) {
      var t = now + offset;
      var noteDur = 0.6;
      offset += noteDur + 0.08;
      var voice = c.createOscillator();
      voice.type = "sine";
      voice.frequency.setValueAtTime(notes[i], t);
      var vib = c.createOscillator();
      var vibG = c.createGain();
      vib.type = "sine";
      vib.frequency.setValueAtTime(5.5, t);
      vibG.gain.setValueAtTime(2, t);
      vib.connect(vibG);
      vibG.connect(voice.frequency);
      var mix = c.createGain();
      voice.connect(mix);
      mix.connect(out);
      mix.gain.setValueAtTime(0, t);
      mix.gain.linearRampToValueAtTime(0.035, t + 0.12);
      mix.gain.linearRampToValueAtTime(0, t + noteDur);
      voice.start(t);
      voice.stop(t + noteDur + 0.01);
      vib.start(t);
      vib.stop(t + noteDur + 0.01);
    }
  }

  function previewArielAmbient(c, now, out) {
    // Birdsong chirp then a sparkle
    for (var i = 0; i < 2; i++) {
      var t = now + i * 0.15;
      var dur = 0.07;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(1800, t);
      o.frequency.exponentialRampToValueAtTime(3500, t + dur);
      o.connect(g);
      g.connect(out);
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }
    // Sparkle at 0.5s
    for (var si = 0; si < 4; si++) {
      var st = now + 0.5 + si * 0.06;
      var so = c.createOscillator();
      var sg = c.createGain();
      so.type = "sine";
      so.frequency.setValueAtTime(3000 + Math.random() * 3000, st);
      so.connect(sg);
      sg.connect(out);
      sg.gain.setValueAtTime(0.012, st);
      sg.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
      so.start(st);
      so.stop(st + 0.25);
    }
  }

  function getState() {
    return {
      playing: playing,
      currentTrack: currentTrack,
      masterVolume: masterVolume,
      layerVolumes: layerVolumes,
      layerMuted: layerMuted,
      layerRate: layerRate,
    };
  }

  return {
    init: init,
    play: play,
    stop: stop,
    switchTrack: switchTrack,
    setMasterVolume: setMasterVolume,
    setLayerVolume: setLayerVolume,
    setLayerRate: setLayerRate,
    setLayerParam: setLayerParam,
    getLayerParam: getLayerParam,
    resetLayerParams: resetLayerParams,
    LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS,
    resetLayers: resetLayers,
    toggleLayer: toggleLayer,
    DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    preview: preview,
    stopPreview: endPreview,
    setPreviewListener: setPreviewListener,
    setDroneListener: function (fn) {
      if (typeof fn === "function") droneListeners.push(fn);
      else droneListeners.length = 0;
    },
    setMotifListener: function (fn) {
      if (typeof fn === "function") motifListeners.push(fn);
      else motifListeners.length = 0;
    },
    // Backward-compat alias for the previous melody-only name.
    setMelodyListener: function (fn) {
      if (typeof fn === "function") motifListeners.push(fn);
      else motifListeners.length = 0;
    },
    setAmbientListener: function (fn) {
      if (typeof fn === "function") ambientListeners.push(fn);
      else ambientListeners.length = 0;
    },
    setHarmonicListener: function (fn) {
      harmonicListener = typeof fn === "function" ? fn : null;
      // Re-emit current state so a late subscriber gets initialized.
      if (harmonicListener) emitHarmonicChange(currentTrack);
    },
    getDensity: function (track, layer) { return getDensityMultiplier(track || "library", layer); },
    getDensityAt: function (t, track, layer) { return getDensityAt(t, track || "library", layer); },
    getDensityRange: function () { return DENSITY_RANGE.slice(); },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    getState: getState,
    // Analysis taps — return the engine's AudioContext and connect masterGain
    // to an external node so visualizations (spectrograms, scopes, etc.) can
    // observe the post-mix signal without disrupting the audio path.
    getAudioContext: function () { return ctx; },
    attachAnalyser: function (node) {
      if (!masterGain || !node) return false;
      try { masterGain.connect(node); return true; } catch (e) { return false; }
    },
    // Connect a specific layer's gain to an external node — lets a viz
    // analyze just one layer's contribution (e.g. whistle in isolation
    // for the lollipop overlay in the ridgeline prototype).
    attachLayerAnalyser: function (track, layer, node) {
      if (!layerGains[track] || !layerGains[track][layer] || !node) return false;
      try { layerGains[track][layer].connect(node); return true; }
      catch (e) { return false; }
    },
    // Trigger one authentic Library harpsichord pluck (Karplus-Strong) into a
    // caller-provided output node. libPluckNote is fully self-contained (routes
    // only to `out`), so prototypes/visualizations can sound real notes on
    // demand without touching the engine's mix or play state. Returns the
    // AudioContext (so the caller can build its output node), or null.
    pluckLibraryInto: function (freq, duration, outNode, gainMult) {
      init();
      if (!ctx || !outNode) return null;
      if (ctx.state === "suspended") ctx.resume();
      libPluckNote(freq, ctx.currentTime, duration == null ? 1.2 : duration,
                   outNode, gainMult == null ? 1 : gainMult);
      return ctx;
    },
    setNoteListener: function (fn) {
      if (typeof fn === "function") noteListeners.push(fn);
      else noteListeners.length = 0;
    },
    // Sound one hum note of a given vowel into outNode (for prototypes).
    humNoteInto: function (freq, vowel, duration, outNode, gainMult) {
      init();
      if (!ctx || !outNode) return null;
      if (ctx.state === "suspended") ctx.resume();
      playHumVowelNote(freq, vowel, ctx.currentTime, duration == null ? 1.4 : duration,
                       outNode, gainMult == null ? 1 : gainMult);
      return ctx;
    },
  };
})();
