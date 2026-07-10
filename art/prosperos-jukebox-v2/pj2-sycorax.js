// ============================================================================
// Prospero's Jukebox v2 â pj2-sycorax.js
// PJ2.Sycorax: the dark track â a rite observed from the treeline.
//
// Built per PLAN-SYCORAX.md (rev 2, all recommendations adopted: wordless
// chant drifting syllabic only in the processional; heartbeat-only
// gatherings; the bone-flute kept, rare; the downward semitone sink at
// p â 0.12, at-the-treeline evenings only; the 0.8Ã-gurdy noise ceiling
// everywhere; the far-field keen in the pool). Facade-shaped like
// pj2-library.js â create/play/stop/reseed/getInfo/listeners/
// attachAnalyser/setMasterVolume, one lazy AudioContext, a fresh seeded
// "run" per play, stop restarts the whole seeded lineage.
//
// The binding constants hold unchanged: floor 0.04, ceiling 0.65, nothing
// startles, ambient first. Darkness and noise are spent in SPECTRUM,
// REGISTER, INTERVAL, TEXTURE and CEREMONY â never in level, never in
// surprise.
//
// THE DRAMATURGY is the encirclement: gathering â (processional, p rising
// with the tide) â circling Ã1â3 â (invocation) â afterimage. It never
// resolves â the harmony's root is PINNED to i forever (pose mode on the
// PJ2.Harmony profile door), color comes from rotating authored degree-set
// poses, cadence() is never called (zero cadence events, by construction),
// and boundary arrivals DARKEN instead of closing: the pose is forced to
// "sting" ({0,1,5} â the flat second against the fifth), the gurdy sinks
// its sub-octave in, the lowpass closes ~15%, and a two-part ORGANUM pad
// ({0,5} under the keening line) breathes across the seam.
//
// THE CUT (the moment the observer is noticed) fires whenever an invocation
// exists, at the invocationâafterimage boundary, severity 0.4 + 0.6Â·tide:
// an indrawn breath 0.6 s out, percussion cut off MID-GESTURE at tB, a
// dedicated cutGain on the landscape sum ramping to 0.28 â 0.14Â·sev over
// 0.25 s (ramped, never touching master, one writer), the hush INHABITED â
// the proto-drum routes around cutGain and beats alone, one waterphone
// apparition enters ~1.2 s in â held 3 + 5Â·sev seconds, then a 2.5â4 s
// return into the afterimage. Conductor intensity remains continuous
// throughout; the cut lives entirely in gain-land.
//
// THE VOICES: the hurdy-gurdy drone (v1's sycorax cluster ~2844, voiced
// from the live pose, with a trompette partial on the grit bus whose send
// pulses with drum strokes); the CHANT (primary speaker â whisper-formant
// DNA matured into a pitched low voice, reciting-tone Markov, keening
// phrase-finals on the flat second, an unresolving after-tone body
// gesture); the REBEC (SYC_GHOST_MARKOV's tritone wander on a bowed body);
// the WATERPHONE (v1 ~3288, verbatim port â six inharmonic partials, FM
// bloom, shared body wobble, downward gliss); the BONE-FLUTE (rare, high,
// lonely â processional and invocation only, ~2â3 utterances an evening).
// Percussion is a LANDSCAPE family (never claims the air): proto-drum
// (v1's heartbeat), frame drum, log drum, bone rattle â ceremonially
// paced under the anti-groove law (breath-distributed gaps outside the
// processional; a Â±20%-jittered walk inside it; accelerating clusters in
// the invocation whose SPEED rises while their level never does).
//
// ACROSS EVENINGS the rite remembers: the standard motif ghost (intoned by
// the chant in the next gathering, quiet), and THE BRUISE â last evening's
// cut severity carried as one scalar (murkier opening, earlier heartbeat,
// a "sting" first pose past 0.5). Pose state persists across the seam
// anyway; the rite resumes mid-gesture for free.
//
// Discipline inherited whole from pj2-library.js: every pitched note reads
// the PitchField AT SCHEDULE TIME (era-aware through the rare sink â no
// cached Hz, ever); every envelope through PJ2.Voice.env or anchored ramp
// pairs; everything musical from forked seeded streams (Math.random only
// inside noise/IR texture); melodic voices claim THE AIR, landscape never
// does; refusal means silence this cycle, never a throw; when in doubt,
// quieter â and here, when in doubt about "louder?", the answer is
// "darker instead".
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  // --------------------------------------------------------------------------
  // The intensity band (owner's aesthetic constants, binding).
  // --------------------------------------------------------------------------
  var FLOOR = 0.04;
  var CEIL = 0.65;

  function clampI(v) { return v < FLOOR ? FLOOR : (v > CEIL ? CEIL : v); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function smoothstep(x) {
    x = x < 0 ? 0 : (x > 1 ? 1 : x);
    return x * x * (3 - 2 * x);
  }

  // --------------------------------------------------------------------------
  // THE MIXER SURFACE — the jukebox UI's per-layer volume/mute contract,
  // uniform with PJ2.Library/PJ2.Ariel (getLayers / setLayerVolume /
  // getLayerVolumes / toggleLayer; full design note in pj2-library.js).
  // STRICTLY GAIN-SIDE: mixer gains (tagged _pj2Mix) are inserted into — or
  // cleanly reused from — each layer's chain; no randomness, no event-time
  // effects, never a shared param with the followers or the cut (cutGain,
  // gurdyLevel, noiseLevel, breathLevel, gritBlend, gritSendTromp keep
  // their one writer; the mixer gets its OWN stage beside each).
  //
  // Layer -> params (design values in parens):
  //   gurdy       mixGurdy (1) inserted gurdyLevel -> cutGain, + mixGritGurdy
  //               (1) inserted between the gurdy/trompette grit sends and the
  //               shaper — mute the gurdy and its saturated shadow dies too
  //   noise       mixNoise (1) inserted noiseLevel -> cutGain, + mixBreath (1)
  //               inserted breathLevel -> cutGain (ember-smoke, ruin-wind and
  //               the treeline murmur are one user-facing murk), +
  //               gritSendNoise (.25) — the bed's grit share follows the bed
  //   chant       per-seat wraps (1) over the shared pool + delaySendChant (.4)
  //   rebec       per-seat wraps (1) + delaySendRebec (.35)
  //   waterphone  per-seat wraps (1) + delaySendWater (.5) + throatSendWater
  //               (.10) — the apparition rides these too (it IS a waterphone)
  //   boneflute   per-seat wraps (1) — the flute has no sends
  //   percussion  layPerc (1) + layProto (1) + throatSendPerc (.06) — skins,
  //               wood, the proto-heartbeat, and the cave's answer to them
  //   ambient     layAmb (1)
  //
  // The throat's RETURN (layThroat) stays unowned: its exciters are all
  // mixer-scaled at their sends, so a muted source stops ringing the cavern
  // without orphaning a resonance the room still owes other voices. Same
  // for the seasick delay's return. Grit note: the shaper is nonlinear, so
  // intermediate volumes change the DRIVE (texture darkens as it fades) —
  // fine for a texture bus; 0 is still exactly silent and 1 exactly stock.
  // --------------------------------------------------------------------------
  var MIX_LAYERS = [
    { key: "gurdy",      label: "Hurdy-Gurdy", kind: "landscape" },
    { key: "noise",      label: "Noise Bed",   kind: "landscape" },
    { key: "chant",      label: "Chant",       kind: "melodic" },
    { key: "rebec",      label: "Rebec",       kind: "melodic" },
    { key: "waterphone", label: "Waterphone",  kind: "melodic" },
    { key: "boneflute",  label: "Bone Flute",  kind: "melodic" },
    { key: "percussion", label: "Percussion",  kind: "percussion" },
    { key: "ambient",    label: "Ambient",     kind: "ambient" },
  ];
  var MIX_MUTE_S = 0.3;  // mute/unmute ramp — click-safe, unhurried
  var MIX_VOL_S = 0.08;  // volume moves ride the master-volume ramp length

  var DEFAULT_SEED = 1400137155; // "SYCX" as a 32-bit word, near enough

  function resolveSeed(opts) {
    if (opts && opts.seed !== undefined && opts.seed !== null) {
      return (+opts.seed) >>> 0;
    }
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
        if (m) return (+m[1]) >>> 0;
      }
    } catch (e) { /* headless harness: fall through */ }
    return DEFAULT_SEED;
  }

  // ==========================================================================
  // THE POSES â color without motion. Root pinned to i forever; these five
  // rotations of the sycorax degrees (0=Eb 1=E 2=F# 3=G 4=Ab 5=Bb 6=B) are
  // the whole harmonic vocabulary, stepped by a no-repeat pose-Markov on a
  // slow lane (22â40 s). "afterimage" ({0,5}, the bare open fifth â the
  // night's only consonance) has NO markov row and appears in no row's
  // pool: it is reachable only by setPose at the afterimage's entry, and
  // holds (drawlessly) until the next evening's opening pose replaces it.
  // The markov rows are authored with no self-weights (no consecutive
  // repeats, asserted) and a mild gravity back toward "coil" and "sting" â
  // the rite circles its two home postures the way the drum circles the
  // fire.
  // ==========================================================================
  var POSE_TABLE = {
    "coil":       [0, 2, 4],    // stacked-third default â already a cluster
    "sting":      [0, 1, 5],    // the flat second against the fifth; the keen's ground
    "hollow":     [0, 3, 6],    // augmented shell (Eb G B)
    "veil":       [0, 2, 5],    // the one near-minor-triad; the lure
    "smoke":      [0, 4, 6],    // root, Ab, B
    "afterimage": [0, 5],       // the bare fifth â residue, not resolution
  };
  var POSE_MARKOV = {
    "coil":   [["sting", 3], ["veil", 2.5], ["hollow", 2], ["smoke", 1.5]],
    "sting":  [["coil", 3], ["smoke", 2], ["hollow", 2], ["veil", 1.5]],
    "hollow": [["sting", 3], ["coil", 2.5], ["smoke", 2], ["veil", 1]],
    "veil":   [["sting", 3.5], ["coil", 2], ["hollow", 1.5], ["smoke", 1.5]],
    "smoke":  [["coil", 3], ["sting", 2.5], ["veil", 2], ["hollow", 1]],
  };

  // --------------------------------------------------------------------------
  // THE ORGANUM DOUBLING TABLE â authored per degree class of the top line,
  // lower = top + offset (offsets negative, in scale degrees). Prefer the
  // in-scale perfect fifth below, fall back to the perfect fourth where the
  // mode denies a fifth, and take the third-below shell where it denies
  // both (the historical occursus compromise). Worked from the sycorax
  // steps [0,1,3,4,5,7,8], all seven entries verified by semitone
  // arithmetic (top semis â lower semis):
  //   class 0 (Eb, 0)  â â3 (deg â3 = class 4 oct â1, semi â7)  = P5 below
  //   class 1 (E,  1)  â â2 (class 6 oct â1, semi â4)           = P4 below
  //   class 2 (F#, 3)  â â3 (class 6 oct â1, semi â4)           = P5 below
  //   class 3 (G,  4)  â â3 (class 0, semi 0)                   = M3 below (occursus)
  //   class 4 (Ab, 5)  â â4 (class 0, semi 0)                   = P4 below
  //   class 5 (Bb, 7)  â â5 (class 0, semi 0)                   = P5 below
  //   class 6 (B,  8)  â â5 (class 1, semi 1)                   = P5 below
  // This matches pj2-harmony's computed fallback exactly; passing it
  // explicitly makes the table assertable and survives any future change
  // to the computed preference order.
  // --------------------------------------------------------------------------
  var ORGANUM_DOUBLING = { 0: -3, 1: -2, 2: -3, 3: -3, 4: -4, 5: -5, 6: -5 };

  // ==========================================================================
  // THE CHANT'S MARKOV â authored, not ported (the plan's one deliberate
  // break with the family's "no self-weight" instinct). Plainchant conduct:
  // heavy stepwise gravity, a narrow ambitus, a real 0.25 self-weight on
  // degree 5 (Bb â the reciting tone a fifth above the final; recitation
  // REPETITION is the point), and row endings that fall through 1 (the
  // flat second) toward 0. Degree order: Eb E F# G Ab Bb B.
  // ==========================================================================
  var CHANT_MARKOV = [
    [0.06, 0.34, 0.14, 0.08, 0.10, 0.22, 0.06],  // Eb: up to the b2, or lift to the tone
    [0.40, 0.05, 0.22, 0.10, 0.08, 0.10, 0.05],  // E: falls home, mostly
    [0.10, 0.28, 0.05, 0.30, 0.12, 0.10, 0.05],  // F#: steps either way
    [0.06, 0.10, 0.30, 0.05, 0.30, 0.14, 0.05],  // G: a passing stone
    [0.05, 0.08, 0.12, 0.28, 0.05, 0.34, 0.08],  // Ab: leans up to the reciting tone
    [0.04, 0.08, 0.06, 0.10, 0.22, 0.25, 0.25],  // Bb: RECITES (self 0.25), or spills over
    [0.05, 0.12, 0.05, 0.06, 0.16, 0.44, 0.12],  // B: falls back onto Bb
  ];

  // The rebec inherits SYC_GHOST_MARKOV verbatim (prosperos-jukebox-audio.js
  // :121) â the tritone/minor-2nd wander that made v1's ghost tones ghosts
  // is exactly a wyrd fiddle's hand.
  var REBEC_MARKOV = [
    [0.05, 0.25, 0.15, 0.10, 0.20, 0.10, 0.15],
    [0.20, 0.05, 0.10, 0.15, 0.10, 0.25, 0.15],
    [0.10, 0.15, 0.05, 0.25, 0.15, 0.10, 0.20],
    [0.15, 0.10, 0.20, 0.05, 0.25, 0.15, 0.10],
    [0.25, 0.10, 0.15, 0.20, 0.05, 0.10, 0.15],
    [0.10, 0.20, 0.15, 0.10, 0.15, 0.05, 0.25],
    [0.15, 0.15, 0.20, 0.10, 0.15, 0.20, 0.05],
  ];

  // Transform-weight rows, PLAN-SYCORAX Â§5 verbatim: lungs favor the whole
  // line; the mordent hand ornaments; the metal dilates; the breath runs out.
  var VOICE_WEIGHTS = {
    chant: {
      augment: 3, transpose: 2, invert: 1.5, fragmentTail: 1.5, ornament: 1.2,
      sequence: 0.8, fragmentHead: 0.6, retrograde: 0.6, diminish: 0.4,
    },
    rebec: {
      ornament: 3, sequence: 2.5, transpose: 2, invert: 1.5, diminish: 1.2,
      retrograde: 1.2, fragmentHead: 1, fragmentTail: 1, augment: 0.8,
    },
    waterphone: {
      augment: 3.5, transpose: 2.5, invert: 2, fragmentTail: 1.5,
      retrograde: 1.2, fragmentHead: 0.8, sequence: 0.6, diminish: 0.5,
      ornament: 0.3,
    },
    boneflute: {
      fragmentTail: 2.5, fragmentHead: 2, ornament: 1.5, transpose: 1.5,
      augment: 1.2, diminish: 1.2, invert: 1, retrograde: 0.8, sequence: 0.6,
    },
  };

  // SCENE ALIASING (configuration, zero motif edits): every Sycorax scene
  // maps onto one of the Library's five before any motif lookup, so the
  // motif engine's kind pools / scene tilts / ghost window / focus scenes
  // all apply unmodified. This is also why the "chapter-normalization
  // gotcha" never bites here â no custom scene name is ever handed down.
  var SCENE_ALIAS = {
    "gathering": "settling",
    "processional": "chapter",
    "circling": "chapter",
    "invocation": "seizure",
    "afterimage": "candle-out",
  };

  // Chant vowel shapes â the dark end of the mouth (the whisper DNA pitched).
  // F1/F2 pairs; the walk drifts between neighbors on the closedâopen axis.
  var CHANT_VOWELS = {
    mm: { f1: 270, f2: 1200 },
    oo: { f1: 300, f2: 870 },
    oh: { f1: 570, f2: 840 },
    uh: { f1: 520, f2: 1190 },
    ah: { f1: 730, f2: 1090 },
  };
  var CHANT_VOWEL_POOL = ["mm", "oo", "oh", "uh", "ah"];
  var CHANT_VOWEL_WALK = [
    [0.05, 0.45, 0.25, 0.15, 0.10],
    [0.30, 0.05, 0.35, 0.20, 0.10],
    [0.10, 0.30, 0.05, 0.35, 0.20],
    [0.12, 0.20, 0.38, 0.05, 0.25],
    [0.08, 0.12, 0.30, 0.45, 0.05],
  ];

  // v1's whisper formant pairs (prosperos-jukebox-audio.js:132) â the
  // breath-bed keeps the ancestor's exact spectra, only quieter.
  var WHISPER_FORMANTS = [
    [700, 2500], [400, 2000], [900, 2800], [500, 3200],
    [600, 1800], [1000, 3500], [350, 2200],
  ];

  // v1's waterphone tunables (prosperos-jukebox-audio.js:1795), verbatim.
  var WATERPHONE = {
    shimmer: 1.30, bloomLevel: 0.28, bloomIntensity: 2.4,
    wail: 1.8, wobble: 2.0, bodyWobbleRate: 0.6,
  };
  // The six inharmonic partials (v1 ~3322): lower three ride the shared
  // body wobble; upper three tremolo.
  var WATERPHONE_PARTIALS = [
    { ratio: 1.00, gain: 0.42, trem: 0,    body: true  },
    { ratio: 1.41, gain: 0.30, trem: 0,    body: true  },
    { ratio: 2.07, gain: 0.22, trem: 0,    body: true  },
    { ratio: 2.95, gain: 0.20, trem: 0.55, body: false },
    { ratio: 4.13, gain: 0.16, trem: 0.65, body: false },
    { ratio: 5.62, gain: 0.12, trem: 0.75, body: false },
  ];

  // Weather channels for this track (PLAN Â§6): murk is inverse brightness
  // (cutoffs, gurdy darkness), breath opens the chant and the breath-bed,
  // gapMul is the sanctioned Â±15% gap scaler, wetTilt tilts the rooms and
  // gates the wet pool draws, gritTilt rides the grit blend. Periods are
  // primes in the 120â600 s band (pairwise coprime), depths sized per
  // channel; four seeded draws per channel at build, pure math after.
  var WEATHER_SYCORAX = {
    murk:     { period1: 337, period2: 499, depth: 0.45 },
    breath:   { period1: 199, period2: 401, depth: 0.40 },
    gapMul:   { period1: 167, period2: 431, depth: 0.35 },
    wetTilt:  { period1: 263, period2: 541, depth: 0.45 },
    gritTilt: { period1: 151, period2: 563, depth: 0.50 },
  };
  var WX_NEUTRAL = { murk: 0.5, breath: 0.5, gapMul: 0.5, wetTilt: 0.5, gritTilt: 0.5 };

  // --------------------------------------------------------------------------
  // THE GRIT CURVE â ZANKYÅ's asymmetric soft-clip (zankyo-audio.js:327) at
  // 0.75Ã its amount (0.6 â 0.45, k = 2 + 0.45Â·40 = 20): v1's sycorax
  // already saturated its drone hotter than the Library's (26 vs 12), so
  // the dose is inherited instinct, dialed to this room. Two documented
  // lessons ride with it (zankyo-audio.js:262-288):
  //   1. MAKEUP-DOWN 0.4 â this curve boosts small signals ~21Ã and rails
  //      the bus under any real drone level, clipping every onset into an
  //      audible click; the distortion timbre is baked into the waveshape
  //      and survives the attenuation, so pull the bus back down.
  //   2. TRANSIENT VOICES NEVER TOUCH THE BUS (the shamEdge lesson) â a
  //      voice needing bite gets its own near-unity tanh. Here nothing
  //      transient needs one; the bus is LANDSCAPE-ONLY by wiring (gurdy
  //      send, noise-bed send, trompette pulses â three tagged feeders,
  //      asserted by graph inspection).
  // --------------------------------------------------------------------------
  function buildGritCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = 2 + amount * 40;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = (1 + k) * x / (1 + k * Math.abs(x));  // soft-clip
      y += 0.04 * Math.sin(x * 9);                  // subtle harmonic crud
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }
  var GRIT_AMOUNT = 0.45;   // 0.75 Ã ZANKYÅ's 0.6
  var GRIT_MAKEUP = 0.4;    // the documented makeup-DOWN
  var GRIT_BLEND_CAP = 0.5; // hard cap at invocation peak
  var TROMP_BASE = 0.10;    // trompette send at rest
  var TROMP_PULSE_MAX = 0.1;// pulses add at most this (60 ms+ ramps)

  // A normalized tanh soft-ceiling (the pj2-voice saturator's shape) â
  // used as INSURANCE after the cavern's-throat bank: |output| â¤ 1 by
  // construction whatever a feedback loop does upstream, and at whisper
  // level (the bank's honest range, â¤ ~0.02) the curve is identity to
  // within 0.1% â tone-free until the day it saves the room.
  function buildSoftCeil(amount) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // ==========================================================================
  // create({ seed, volume }) â Sycorax
  // ==========================================================================
  function create(opts) {
    opts = opts || {};

    var seed = resolveSeed(opts);
    var masterVol = (opts.volume != null) ? opts.volume : 0.5;
    var noteLs = [];
    var eventLs = [];
    var analysers = [];

    var ctx = null;      // ONE lazy AudioContext, reused (and suspended) forever
    var run = null;      // the per-play world
    var playing = false;
    var stopping = false;

    function emitNote(n) {
      for (var i = 0; i < noteLs.length; i++) {
        try { noteLs[i](n); } catch (e) { /* listener's problem */ }
      }
    }
    function emitEvent(e) {
      for (var i = 0; i < eventLs.length; i++) {
        try { eventLs[i](e); } catch (err) { /* listener's problem */ }
      }
    }
    function addListener(list, fn) {
      if (typeof fn !== "function") return function () {};
      if (list.indexOf(fn) < 0) list.push(fn);
      return function () {
        var i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      };
    }

    // ----------------------------------------------------------------------
    // Live-state readers, guarded (family pattern): voices poll these every
    // cycle and must keep breathing even mid-handoff.
    // ----------------------------------------------------------------------
    function curIntensity(t) {
      if (run && run.conductor) {
        try {
          if (t != null && typeof run.conductor.intensityAt === "function") {
            return clampI(run.conductor.intensityAt(t));
          }
          return clampI(run.conductor.intensity());
        } catch (e) {}
      }
      return FLOOR;
    }
    function curSceneType() {
      if (run && run.conductor) {
        try {
          var s = run.conductor.scene();
          if (s && s.type) return s.type;
        } catch (e) {}
      }
      return "gathering";
    }
    function curSceneX() {
      if (run && run.conductor) {
        try {
          var s = run.conductor.scene();
          if (s && typeof s.x === "number") return s.x;
        } catch (e) {}
      }
      return 0;
    }
    function curTidePos() {
      if (run && run.conductor) {
        try {
          var td = run.conductor.tide();
          if (td && typeof td.pos === "number") return td.pos;
          if (typeof td === "number") return td;
        } catch (e) {}
      }
      return 0;
    }
    function curTideLabel() {
      if (run && run.conductor) {
        try {
          var td = run.conductor.tide();
          if (td && td.label) return td.label;
        } catch (e) {}
      }
      return "far-off";
    }

    // ----------------------------------------------------------------------
    // THE MIXER (see MIX_LAYERS above; mechanics identical to pj2-library —
    // the design note there is authoritative). mixState outlives runs;
    // run.mix[key] entries are {p, design, v0,t0,v1,t1} where the segment is
    // our own last write, so the anchor value at any time is arithmetic (the
    // mixer is the only writer on its params — never read .value mid-ramp).
    // ----------------------------------------------------------------------
    var mixState = {};
    for (var mxi = 0; mxi < MIX_LAYERS.length; mxi++) {
      mixState[MIX_LAYERS[mxi].key] = { volume: 1, muted: false };
    }
    function mixEff(key) {
      var st = mixState[key];
      return st ? (st.muted ? 0 : st.volume) : 1;
    }
    function mixValAt(e, t) {
      if (t >= e.t1) return e.v1;
      if (t <= e.t0) return e.v0;
      return e.v0 + (e.v1 - e.v0) * ((t - e.t0) / (e.t1 - e.t0));
    }
    function mixApply(key, rampS) {
      if (!run || !run.live || !run.mix || !run.mix[key]) return;
      var t = run.clock.now();
      var eff = mixEff(key);
      var list = run.mix[key];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var cur = mixValAt(e, t);
        var target = e.design * eff;
        try {
          var g = e.p;
          if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
          g.setValueAtTime(cur, t);     // anchor (click-safe rule)
          g.linearRampToValueAtTime(target, t + rampS);
        } catch (err) {}
        e.v0 = cur; e.t0 = t; e.v1 = target; e.t1 = t + rampS;
      }
    }
    // Melodic voices route pool seats through their layer's per-seat wrap;
    // unknown key or missing wrap falls back to the bare seat (a mixer
    // wiring gap must never silence a note).
    function mixOut(key, slotIn) {
      var w = run && run.mixWraps && run.mixWraps[key];
      if (!w) return slotIn;
      var i = w.slots.indexOf(slotIn);
      return (i >= 0) ? w.wraps[i] : slotIn;
    }

    function degClass(d) {
      var n = (run && run.field && run.field.size) || 7;
      return ((d % n) + n) % n;
    }

    // Weather reads: exact audio time of the thing being scheduled, on
    // RUN-RELATIVE time (the pj2-library determinism lesson, kept verbatim).
    function wxAt(t) {
      if (run && run.weather) {
        try { return run.weather.at(t - run.t0); } catch (e) {}
      }
      return WX_NEUTRAL;
    }
    // gapMul: the ONE channel allowed to move event times â Â±15% hard by
    // construction, neutral weather = exactly 1.0.
    function gmAt(t) {
      return 0.85 + 0.3 * wxAt(t).gapMul;
    }

    // The hush window: [tB, tB + hold] whenever a cut is planned or live.
    // Melodic bodies and non-proto percussion skip any note whose ONSET
    // falls inside it â a chant line cut off mid-word, a cluster cut off
    // unfinished: the interruption IS the gesture. The one waterphone
    // apparition (scheduled by the cut itself) bypasses this gate.
    function inHush(t) {
      var c = run && run.cut;
      if (!c) return false;
      return t > c.tB + 0.001 && t < c.end - 0.001;
    }

    // Motif request context â sceneType ALIASED to the Library five (see
    // SCENE_ALIAS), nowS = the exact audio time of the phrase.
    function reqCtx(t) {
      return {
        sceneType: SCENE_ALIAS[curSceneType()] || "chapter",
        x: curSceneX(),
        tidePos: curTidePos(),
        nowS: t,
      };
    }

    // The motif engine emits nothing; the track narrates (family pattern).
    function narrate(res, voiceName, t) {
      var m = res.motif;
      if (res.kind === "develop") {
        emitEvent({
          type: "develop", voice: voiceName, name: m.name, gen: m.gen,
          transform: (m.chain && m.chain.length) ? m.chain[m.chain.length - 1] : null, t: t,
        });
      } else if (res.kind === "answer") {
        emitEvent({ type: "answer", voice: voiceName, name: m.name, gen: m.gen, t: t });
      } else if (res.kind === "ghost") {
        emitEvent({ type: "ghost", voice: voiceName, name: m.name, t: t });
      }
    }

    // Only the CANTOR posts (responsorial, not conversational): the chant
    // opens calls across the clearing; rebec and waterphone answer late and
    // near-verbatim via the motif engine's overdue-first claim path. The
    // posting numbers live in the motif policy (postP by aliased scene,
    // postKinds imitate-heavy, deadlines 18â40 s).
    function maybePost(voiceName, res, t) {
      if (voiceName !== "chant" || res.kind === "ghost") return;
      try {
        run.motif.maybePost(voiceName, res.motif, {
          sceneType: SCENE_ALIAS[curSceneType()] || "chapter", nowS: t,
        });
      } catch (e) {}
    }

    // beats â seconds (the pj2-library mapper, kept): each voice maps a
    // motif's abstract beats through its own pace Ã intensity.
    function phraseTiming(m, spb, ringK, minD, maxD) {
      var offs = [], durs = [], span = 0;
      for (var i = 0; i < m.notes.length; i++) {
        offs.push(span);
        var b = (+m.notes[i].durBeats > 0) ? +m.notes[i].durBeats : 1;
        durs.push(clamp(b * spb * ringK, minD, maxD));
        span += b * spb;
      }
      return { offs: offs, durs: durs, spanS: offs[offs.length - 1] + durs[durs.length - 1] };
    }

    // One vowel walk state serves the chant, its organum double, and the
    // keen â it is one throat. Draws ride the "vowels" fork only.
    function walkVowel() {
      var row = CHANT_VOWEL_WALK[run.vowelIdx] || CHANT_VOWEL_WALK[0];
      var r = run.streams.vowels.next();
      var acc = 0, idx = row.length - 1;
      for (var i = 0; i < row.length; i++) {
        acc += row[i];
        if (r < acc) { idx = i; break; }
      }
      run.vowelIdx = idx;
      return CHANT_VOWELS[CHANT_VOWEL_POOL[idx]];
    }

    // Pose bookkeeping: setPose/step only narrate when the pose actually
    // changed (the no-consecutive-repeats law is held here â a forced
    // "sting" arriving onto "sting" is a held posture, not a repeat).
    function setPoseIfNew(name, t, via) {
      try {
        var cur = run.harmony.current();
        if (cur && cur.name === name) return;
        run.harmony.setPose(name, t);
        emitEvent({ type: "pose", pose: name, rootDeg: 0, via: via || "set", t: t });
      } catch (e) {}
    }

    // ========================================================================
    // THE DRAMATURGY â the encirclement (Conductor contract).
    //
    // plan(): durS = 360 + 600Â·(0.65Â·u + 0.35Â·tide) â 6â16 min (dread
    // sustains less than coziness), the tide biasing long and near.
    // gathering â processional (p = 0.45 + 0.3Â·tide) â circling Ã1â3 â
    // invocation (p = 0.5 + 0.3Â·tide) â afterimage. The circling count is
    // keyed to the drawn budget (1 / 1â2 / 2â3 as durS crosses 560/760 s)
    // so the scale factor stays gentle and no scene is ever crushed short
    // enough to break the intensity ruler (the pj2-library nCh lesson).
    // ========================================================================
    var ACTIVITY = {
      "gathering":    [["watching", 3], ["kindling", 2], ["waiting", 2]],
      "processional": [["approaching", 3], ["torch-bearing", 2]],
      "circling":     [["prowling", 3], ["rounding", 2], ["weaving", 2]],
      "invocation":   [["calling", 3], ["hollowing", 2]],
      "afterimage":   [["dispersing", 3], ["smoldering", 2]],
    };
    function pickActivity(rng, type) {
      var pool = ACTIVITY[type];
      return pool ? rng.pickW(pool) : type;
    }

    var dram = {
      name: "sycorax",
      durationRangeS: [360, 960],

      plan: function (rng, tidePos) {
        var tp = clamp(tidePos || 0, 0, 1);
        var durS = 360 + 600 * (0.65 * rng.next() + 0.35 * tp);
        var hasProc = rng.chance(0.45 + 0.3 * tp);
        var nCirc = (durS < 560) ? 1 : (durS < 760 ? rng.rint(1, 2) : rng.rint(2, 3));
        var hasInv = rng.chance(0.5 + 0.3 * tp);
        var scenes = [];
        function add(type, lo, hi) {
          scenes.push({ type: type, durS: rng.rnd(lo, hi), activity: pickActivity(rng, type) });
        }
        add("gathering", 60, 120);
        if (hasProc) add("processional", 80, 150);
        for (var i = 0; i < nCirc; i++) add("circling", 100, 220);
        if (hasInv) add("invocation", 60, 120);
        add("afterimage", 90, 170);
        var raw = 0;
        for (i = 0; i < scenes.length; i++) raw += scenes[i].durS;
        var k = durS / raw;
        for (i = 0; i < scenes.length; i++) scenes[i].durS *= k;
        return scenes;
      },

      // Intensity curves â PLAN-SYCORAX Â§2 verbatim. Invocation
      // CONCENTRATES BY HOLLOWING: peak 0.62 is density and register, not
      // loudness. The afterimage opens ~0.18 and sinks â the rite dispersed.
      scenes: {
        "gathering": {
          intensity: function (x, tp) {
            return clampI(0.04 + (0.18 + 0.05 * (tp || 0)) * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.03,
          activityWeights: ACTIVITY["gathering"],
        },
        "processional": {
          intensity: function (x, tp) {
            return clampI(0.16 + (0.16 + 0.03 * (tp || 0)) * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.08,
          activityWeights: ACTIVITY["processional"],
        },
        "circling": {
          // Slower wobble than the Library chapter's (0.75 cycles): the prowl.
          intensity: function (x, tp) {
            return clampI(0.28 + 0.10 * (tp || 0) + 0.05 * Math.sin(2 * Math.PI * 0.75 * clamp(x, 0, 1)));
          },
          airLimit: 2, overlapChance: 0.15,
          activityWeights: ACTIVITY["circling"],
        },
        "invocation": {
          intensity: function (x, tp) {
            return clampI(0.36 + 0.26 * Math.pow(Math.sin(Math.PI * clamp(x, 0, 1)), 1.3));
          },
          airLimit: 1, overlapChance: 0.10,
          activityWeights: ACTIVITY["invocation"],
        },
        "afterimage": {
          intensity: function (x, tp) {
            return clampI(0.05 + 0.13 * Math.pow(1 - clamp(x, 0, 1), 1.6));
          },
          airLimit: 1, overlapChance: 0.02,
          activityWeights: ACTIVITY["afterimage"],
        },
      },

      // ----------------------------------------------------------------
      // JOINTS â pickW nothing 36 / drone-breath 30 / deadened drum stroke
      // 16 / water-drip 10 / far-thunder 8. Far-thunder is reserved for
      // entering the invocation (anywhere else it degrades to a breath);
      // the invocationâafterimage boundary ALWAYS resolves to nothing â
      // the cut is that joint, and it needs no ornament. All draws happen
      // unconditionally (stream discipline), then the overrides apply.
      // ----------------------------------------------------------------
      joint: function (fromType, toType, t, intensity, tools) {
        if (!run || !run.live) return null;
        var draw = run.streams.joints.pickW([
          ["nothing", 36], ["breath", 30], ["drum", 16], ["drip", 10], ["far-thunder", 8],
        ]);
        if (fromType === "invocation" && toType === "afterimage") draw = "nothing";
        if (draw === "far-thunder" && toType !== "invocation") draw = "breath";
        emitEvent({ type: "joint-gesture", gesture: draw, from: fromType, to: toType, t: t });
        if (draw === "nothing") return null;
        try {
          if (draw === "breath") jointBreath(t);
          else if (draw === "drum") frameDrum(t, run.streams.joints, { deadened: true, peak: 0.028, mode: "joint", who: "joint" });
          else if (draw === "drip") waterDrip(t);
          else if (draw === "far-thunder") farThunder(t, run.streams.joints, 0.5, "joint");
        } catch (e) { return null; /* a failed joint is silence â a valid joint */ }
        return draw;
      },

      chainOverlapS: [5, 15],
      tide: {
        // "How near the menace circles." Labels partition the PHASE:
        // trough-rising / approaching-peak / just-past-peak / descent.
        periodPerfs: [4, 7],
        labels: ["far-off", "drawing-near", "at-the-treeline", "receding"],
      },
    };

    // ========================================================================
    // JOINT GESTURE BODIES â the whole vocabulary is QUIET (â¤ ambient peaks).
    // ========================================================================

    // (a) drone-breath: the gurdy bed dips ~2 dB over 4 s and re-blooms, on
    // its DEDICATED gain stage (gurdyBreath, normally 1) â one writer per
    // param, always.
    function jointBreath(t) {
      var g = run.gurdyBreath.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(0.79, t + 2);
      g.linearRampToValueAtTime(1, t + 4);
    }

    // (b) water-drip: one drop in the cavern â a tiny sine blip falling an
    // octave-ish, unpitched texture (freq null; it is water, not music).
    function waterDrip(t) {
      var tok = run.budget.claim(2, t + 0.4);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1250, t);
      o.frequency.exponentialRampToValueAtTime(430, t + 0.09);
      var g = c.createGain();
      o.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.004, 0.018], [0.08, 0.0012], [0.05, 0]]);
      o.start(t);
      o.stop(t + 0.25);
      emitNote({ voice: "joint", kind: "drip", freq: null, t: t, durS: 0.15 });
    }

    // (c) far thunder â v1's sycDistantThunder (~3863) at a dose scale
    // (0.5 for the joint, 1.0 when the ambient pool draws it). Sub thump +
    // resonant low boom (pre-attenuated 0.4 BEFORE the Q 5 filter â
    // pj2-voice lesson #2) + a rolling rumble cresting mid-way.
    function farThunder(t, rng, dose, who) {
      var durS = rng.rnd(4.5, 6);
      var peakFreq = rng.rnd(280, 360);
      var boomDur = rng.rnd(0.7, 1.1);
      var tok = run.budget.claim(9, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var P = 0.045 * dose;
      var subO = c.createOscillator();
      subO.type = "sine";
      subO.frequency.setValueAtTime(55, t);
      subO.frequency.exponentialRampToValueAtTime(35, t + boomDur);
      var subG = c.createGain();
      subO.connect(subG); subG.connect(run.layAmb);
      PJ2.Voice.env(subG.gain, t, [[0.03, P], [boomDur - 0.13, 0.0012], [0.1, 0]]);
      subO.start(t);
      subO.stop(t + boomDur + 0.15);
      var bn = PJ2.Voice.noiseBuffer.source(c, 30);
      var bPre = c.createGain();
      bPre.gain.setValueAtTime(0.4, t); // quiet INTO the resonance
      var blp = c.createBiquadFilter();
      blp.type = "lowpass";
      blp.frequency.setValueAtTime(180, t);
      blp.frequency.exponentialRampToValueAtTime(50, t + boomDur);
      blp.Q.setValueAtTime(5, t);
      var bg = c.createGain();
      bn.connect(bPre); bPre.connect(blp); blp.connect(bg); bg.connect(run.layAmb);
      PJ2.Voice.env(bg.gain, t, [[0.04, P], [boomDur - 0.14, 0.0012], [0.1, 0]]);
      bn.start(t, bn.randomOffset);
      bn.stop(t + boomDur + 0.15);
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(60, t);
      f.frequency.linearRampToValueAtTime(peakFreq, t + durS * 0.35);
      f.frequency.linearRampToValueAtTime(40, t + durS);
      f.Q.setValueAtTime(1, t);
      var g = c.createGain();
      n.connect(f); f.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.3, 0.02 * dose], [durS * 0.5 - 0.3, 0.018 * dose], [durS * 0.5, 0]]);
      n.start(t, n.randomOffset);
      n.stop(t + durS + 0.1);
      emitNote({ voice: who || "ambient", kind: "thunder", freq: null, t: t, durS: durS });
    }

    // ========================================================================
    // THE GRIT PULSE â the trompette's buzzing bridge. Drum strokes pulse
    // the trompette's grit send by â¤ +0.1 with 60 ms+ ramps (never a step:
    // a stepped send through a waveshaper is a click with a beard). One
    // writer on the param, pulses spaced â¥ 0.5 s (an overlapping pulse is
    // skipped â the bridge can only buzz so fast), always returning to
    // TROMP_BASE.
    // ========================================================================
    function pulseTrompette(t) {
      if (!run || !run.gritSendTromp) return;
      if (t - run.lastTrompPulseT < 0.5) return; // no mid-ramp re-anchoring
      run.lastTrompPulseT = t;
      var iv = curIntensity(t);
      var up = Math.min(TROMP_PULSE_MAX, 0.04 + 0.06 * iv);
      var g = run.gritSendTromp.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(TROMP_BASE, t);
      g.linearRampToValueAtTime(TROMP_BASE + up, t + 0.07);  // â¥ 60 ms up
      g.linearRampToValueAtTime(TROMP_BASE, t + 0.32);       // slow relax
    }

    // ========================================================================
    // MELODIC BODIES
    // ========================================================================

    // ---- the chant (whisper DNA matured: pitched, principal) ---------------
    // Soft saw + detuned pulse-ish square pair â dual F1/F2 vowel bandpasses
    // (set once per note â the bardo formant lesson) with a breath-noise
    // thread mixed in pre-formant, seconds-long attacks, slight sine
    // vibrato blooming late. Peak ~0.032 pre-formant-loss compensation
    // (formants eat energy; the v1 hum precedent). Returns the env gain so
    // callers can add the seasick-delay send. ~11 nodes.
    function renderChantNote(dest, freq, t, durS, peak, vowel, wx, extraSend) {
      var c = ctx;
      var open = 0.75 + 0.5 * wx.breath;
      var o1 = c.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(freq, t);
      o1.detune.setValueAtTime(-4, t);
      var o2 = c.createOscillator();
      o2.type = "square";
      o2.frequency.setValueAtTime(freq, t);
      o2.detune.setValueAtTime(5, t);
      var o2g = c.createGain();
      o2g.gain.setValueAtTime(0.35, t);      // the square is color, not body
      // breath thread â unvoiced air under the tone, pre-formant
      var br = PJ2.Voice.noiseBuffer.source(c, 30);
      var brg = c.createGain();
      brg.gain.setValueAtTime(0.010 + 0.014 * wx.breath, t);
      // vibrato â blooms in over the first third, never cold
      var vib = c.createOscillator();
      vib.type = "sine";
      vib.frequency.setValueAtTime(3.6 + 1.1 * wx.breath, t);
      var vg = c.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(0.5 + 1.4 * wx.breath, t + Math.min(1.2, durS * 0.33));
      vib.connect(vg);
      try { vg.connect(o1.frequency); } catch (e0) {}
      try { vg.connect(o2.frequency); } catch (e1) {}
      // the mouth â F1/F2, Q divided by openness, set once per note
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(vowel.f1, t);
      f1.Q.setValueAtTime(3.2 / open, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(vowel.f2, t);
      f2.Q.setValueAtTime(3.8 / open, t);
      var f2g = c.createGain();
      f2g.gain.setValueAtTime(0.5, t);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      o1.connect(f1); o1.connect(f2);
      o2.connect(o2g); o2g.connect(f1); o2g.connect(f2);
      br.connect(brg); brg.connect(f1); brg.connect(f2);
      f1.connect(mix); f2.connect(f2g); f2g.connect(mix);
      var env = c.createGain();
      mix.connect(env);
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      // seconds-long edges: the chant never attacks, it surfaces.
      var atk = Math.min(1.6, durS * 0.38);
      var rel = Math.min(1.4, durS * 0.34);
      if (atk + rel > durS - 0.05) { atk = durS * 0.42; rel = durS * 0.42; }
      PJ2.Voice.env(env.gain, t, [[atk, peak], [Math.max(0.02, durS - atk - rel), peak * 0.94], [rel, 0]]);
      o1.start(t); o1.stop(t + durS + 0.05);
      o2.start(t); o2.stop(t + durS + 0.05);
      br.start(t, br.randomOffset); br.stop(t + durS + 0.05);
      vib.start(t); vib.stop(t + durS + 0.05);
      return env;
    }

    // ---- the rebec (bowed wyrd fiddle) --------------------------------------
    // Sawtooth through two fixed body-resonance bandpasses (set ONCE per
    // note â the bardo murmur-formant lesson: automate a formant mid-note
    // and it zippers), a bow-noise thread on the attack, slow bow edges.
    var REBEC_BODY = [[285, 2.2], [610, 2.8], [1150, 3.2], [1900, 2.4]]; // [Hz, Q]
    function renderRebecNote(dest, freq, t, durS, vel, rng, extraSend) {
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(rng.rnd(-6, 6), t); // the hand, not the tuning
      var pre = c.createGain();
      pre.gain.setValueAtTime(0.5, t);            // quiet into the resonances
      o.connect(pre);
      // two of the four body resonances, drawn per note (a real box moves
      // as the bow position moves)
      var i1 = rng.rint(0, 1), i2 = rng.rint(2, 3);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      var picks = [REBEC_BODY[i1], REBEC_BODY[i2]];
      for (var i = 0; i < 2; i++) {
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(picks[i][0], t);
        bp.Q.setValueAtTime(picks[i][1], t);
        pre.connect(bp);
        bp.connect(mix);
      }
      // bow noise â a breath of rosin on the attack only
      var bn = PJ2.Voice.noiseBuffer.source(c, 30);
      var bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.setValueAtTime(freq * 2.5, t);
      bf.Q.setValueAtTime(1.2, t);
      var bg = c.createGain();
      bn.connect(bf); bf.connect(bg); bg.connect(mix);
      PJ2.Voice.env(bg.gain, t, [[0.12, 0.006 * vel], [Math.max(0.05, durS * 0.4), 0]]);
      bn.start(t, bn.randomOffset);
      bn.stop(t + durS * 0.6);
      var env = c.createGain();
      mix.connect(env);
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      var atk = Math.min(0.5, durS * 0.3);
      var rel = Math.min(0.6, durS * 0.35);
      if (atk + rel > durS - 0.04) { atk = durS * 0.4; rel = durS * 0.4; }
      PJ2.Voice.env(env.gain, t, [[atk, 0.030 * vel], [Math.max(0.02, durS - atk - rel), 0.026 * vel], [rel, 0]]);
      o.start(t);
      o.stop(t + durS + 0.05);
      return env;
    }

    // ---- the waterphone (v1 ~3288, verbatim port) ---------------------------
    // Six inharmonic partials + FM bloom, all riding one shared body-wobble
    // LFO; upper partials tremolo; everything glisses down by wail% over
    // the note. The only changes from v1: the field supplies the
    // fundamental (era-aware), the injected rng supplies the tremolo rates
    // (texture-adjacent but musical state â seeded), and the master
    // envelope goes through Voice.env for the anchor discipline. ~30 nodes.
    function renderWaterphoneNote(dest, freq, t, durS, gainScale, rng, extraSend) {
      var c = ctx;
      var env = c.createGain();
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      var peak = 0.04 * (gainScale == null ? 1 : gainScale);
      var a = Math.min(1.5, durS * 0.22);
      var sustainEnd = Math.max(durS - 2.2, durS * 0.6);
      PJ2.Voice.env(env.gain, t, [[a, peak], [Math.max(0.05, sustainEnd - a), peak], [Math.max(0.1, durS - sustainEnd), 0]]);

      var glissEnd = 1 - WATERPHONE.wail / 100;
      var wobbleAmt = WATERPHONE.wobble / 100;
      var stopAt = t + durS + 0.5;

      var bodyWobble = c.createOscillator();
      bodyWobble.type = "sine";
      bodyWobble.frequency.setValueAtTime(WATERPHONE.bodyWobbleRate, t);
      bodyWobble.start(t);
      bodyWobble.stop(stopAt);

      for (var i = 0; i < WATERPHONE_PARTIALS.length; i++) {
        var p = WATERPHONE_PARTIALS[i];
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = "sine";
        var startFreq = freq * p.ratio;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.linearRampToValueAtTime(startFreq * glissEnd, t + durS);
        g.gain.setValueAtTime(p.gain, t);
        // per-partial pitch shimmer
        var lfo = c.createOscillator();
        var lfoG = c.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.25 + i * 0.08, t);
        lfoG.gain.setValueAtTime(startFreq * 0.006, t);
        lfo.connect(lfoG);
        try { lfoG.connect(osc.frequency); } catch (e0) {}
        if (p.body) {
          var bw = c.createGain();
          bw.gain.setValueAtTime(startFreq * wobbleAmt, t);
          bodyWobble.connect(bw);
          try { bw.connect(osc.frequency); } catch (e1) {}
        }
        if (p.trem > 0) {
          var trem = c.createOscillator();
          var tremG = c.createGain();
          trem.type = "sine";
          trem.frequency.setValueAtTime(rng.rnd(2.5, 6.5), t); // v1: 2.5 + rnd*4
          tremG.gain.setValueAtTime(p.gain * p.trem * WATERPHONE.shimmer, t);
          trem.connect(tremG);
          try { tremG.connect(g.gain); } catch (e2) {}
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

      // FM bloom â carrier + â2-ratio modulator, index swelling in the sustain
      var carrier = c.createOscillator();
      var carrierGain = c.createGain();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, t);
      carrier.frequency.linearRampToValueAtTime(freq * glissEnd, t + durS);
      carrierGain.gain.setValueAtTime(WATERPHONE.bloomLevel, t);
      var mod = c.createOscillator();
      var modG = c.createGain();
      mod.type = "sine";
      mod.frequency.setValueAtTime(freq * 1.41, t);
      mod.frequency.linearRampToValueAtTime(freq * 1.41 * glissEnd, t + durS);
      var peakIdx = freq * WATERPHONE.bloomIntensity;
      modG.gain.setValueAtTime(0, t);
      modG.gain.linearRampToValueAtTime(peakIdx, t + Math.min(1.5, durS * 0.25));
      modG.gain.linearRampToValueAtTime(peakIdx * 0.44, t + durS * 0.7);
      modG.gain.linearRampToValueAtTime(0, t + durS);
      mod.connect(modG);
      try { modG.connect(carrier.frequency); } catch (e3) {}
      var carrierBw = c.createGain();
      carrierBw.gain.setValueAtTime(freq * wobbleAmt, t);
      bodyWobble.connect(carrierBw);
      try { carrierBw.connect(carrier.frequency); } catch (e4) {}
      carrier.connect(carrierGain);
      carrierGain.connect(env);
      carrier.start(t);
      carrier.stop(stopAt);
      mod.start(t);
      mod.stop(stopAt);
      return env;
    }

    // ---- the bone-flute (rare, high, lonely) --------------------------------
    // Triangle + breath noise + a whisper of overblown octave; short
    // breath-length notes, register +1 â the one color above the chest in
    // this track.
    function renderBoneFluteNote(dest, freq, t, durS, vel) {
      var c = ctx;
      var o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      var g = c.createGain();
      o.connect(g); g.connect(dest);
      var atk = Math.min(0.22, durS * 0.3);
      var rel = Math.min(0.35, durS * 0.35);
      PJ2.Voice.env(g.gain, t, [[atk, 0.028 * vel], [Math.max(0.02, durS - atk - rel), 0.024 * vel], [rel, 0]]);
      o.start(t);
      o.stop(t + durS + 0.05);
      // the breath across the embouchure
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.setValueAtTime(freq * 2, t);
      bf.Q.setValueAtTime(4, t);
      var ng = c.createGain();
      n.connect(bf); bf.connect(ng); ng.connect(dest);
      PJ2.Voice.env(ng.gain, t, [[atk, 0.006 * vel], [Math.max(0.02, durS - atk - rel), 0.005 * vel], [rel, 0]]);
      n.start(t, n.randomOffset);
      n.stop(t + durS + 0.05);
      // overblown octave, a whisper
      var h = c.createOscillator();
      h.type = "sine";
      h.frequency.setValueAtTime(freq * 2, t);
      var hg = c.createGain();
      h.connect(hg); hg.connect(dest);
      PJ2.Voice.env(hg.gain, t, [[atk + 0.05, 0.005 * vel], [Math.max(0.02, durS - atk - rel - 0.05), 0.004 * vel], [rel, 0]]);
      h.start(t);
      h.stop(t + durS + 0.05);
    }

    // ========================================================================
    // PERCUSSION BODIES â all cheap, all budget-claimed, all landscape.
    // Peaks â¤ 0.05 (the plan's ceiling); level NEVER carries intensity â
    // pacing does.
    // ========================================================================

    // ---- proto-drum (v1's heartbeat ~3648, verbatim spirit) -----------------
    // Sine lub-dub, 36â20 Hz-ish exponential dips, a random-walked
    // intensity, skip and triple irregularities. Routes to layProto â
    // AROUND cutGain â so the hush keeps its pulse.
    function protoBeat(t, rng) {
      run.hbIntensity += (rng.next() - 0.5) * 0.15;
      run.hbIntensity = clamp(run.hbIntensity, 0.4, 1.3);
      var irr = rng.next();
      if (irr < 0.10) { emitEvent({ type: "percussion", mode: "proto-skip", t: t }); return; } // the skipped beat
      var beats = (irr < 0.15) ? 3 : 2;
      var tok = run.budget.claim(2 * beats, t + beats * 0.45 + 0.4);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      for (var i = 0; i < beats; i++) {
        var bt = t + i * (0.3 + rng.rnd(0, 0.1));
        var isLub = i === 0;
        var startFreq = isLub ? rng.rnd(36, 44) : rng.rnd(32, 38);
        var endFreq = rng.rnd(18, 22);
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(startFreq, bt);
        o.frequency.exponentialRampToValueAtTime(endFreq, bt + 0.2);
        var g = c.createGain();
        o.connect(g); g.connect(run.layProto);
        var vol = (isLub ? 0.042 : 0.028) * run.hbIntensity;
        PJ2.Voice.env(g.gain, bt, [[0.006, vol], [0.24, 0.0014], [0.06, 0]]);
        o.start(bt);
        o.stop(bt + 0.38);
        emitNote({ voice: "protodrum", kind: isLub ? "lub" : "dub", freq: null, t: bt, durS: 0.3 });
      }
    }

    // ---- frame drum: dull skin stroke -----------------------------------------
    // Filtered sine burst (70â110 Hz, fast exponential decay) + a
    // band-passed skin transient â¤ 30 ms. The deadened variant is the
    // muffled palm â shorter, duller, quieter.
    function frameDrum(t, rng, o2) {
      o2 = o2 || {};
      var peak = (o2.peak != null) ? o2.peak : 0.045;
      var deadened = !!o2.deadened;
      var toneFreq = rng.rnd(70, 110);
      var skinFreq = rng.rnd(900, 1500);
      var pulses = !deadened && rng.chance(0.7); // the trompette hears most strokes
      var tok = run.budget.claim(4, t + 0.5);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(toneFreq, t);
      o.frequency.exponentialRampToValueAtTime(toneFreq * 0.72, t + 0.12);
      var g = c.createGain();
      o.connect(g); g.connect(run.layPerc);
      // the strike wakes the cavern (transient throat excitation — see the
      // throat energy law at build)
      try { g.connect(run.throatSendPerc); } catch (eThr) {}
      var bodyDur = deadened ? 0.10 : 0.18;
      PJ2.Voice.env(g.gain, t, [[0.004, peak], [bodyDur, peak * 0.05], [0.06, 0]]);
      o.start(t);
      o.stop(t + bodyDur + 0.1);
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(skinFreq, t);
      bp.Q.setValueAtTime(1.1, t);
      var sg = c.createGain();
      n.connect(bp); bp.connect(sg); sg.connect(run.layPerc);
      PJ2.Voice.env(sg.gain, t, [[0.002, peak * (deadened ? 0.25 : 0.5)], [0.022, 0]]); // â¤ 30 ms
      n.start(t, n.randomOffset);
      n.stop(t + 0.06);
      if (pulses) pulseTrompette(t);
      emitNote({
        voice: o2.who || "percussion", kind: deadened ? "frame-deadened" : "frame",
        mode: o2.mode || null, clusterId: o2.clusterId || null,
        freq: null, t: t, durS: 0.25, velocity: o2.vel != null ? o2.vel : 1,
      });
    }

    // ---- log drum: resonant wooden tone, two pitches a fourth apart ----------
    // Field degrees 0 and 4 (semitones 0 and 5 â a true fourth in this
    // mode) at oct â2. Pitched, so it keeps the key like everything else.
    function logDrum(t, rng, o2) {
      o2 = o2 || {};
      var deg = rng.chance(0.5) ? 0 : 4;
      var tok = run.budget.claim(3, t + 1.2);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var freq = run.field.degFreq(deg, -2); // read at schedule time
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      var h = c.createOscillator();
      h.type = "triangle";
      h.frequency.setValueAtTime(freq * 2.01, t); // the wooden edge, slightly off
      var hg = c.createGain();
      hg.gain.setValueAtTime(0.22, t);
      var g = c.createGain();
      o.connect(g);
      h.connect(hg); hg.connect(g);
      g.connect(run.layPerc);
      try { g.connect(run.throatSendPerc); } catch (eThr2) {} // the wooden answer rings the cave
      PJ2.Voice.env(g.gain, t, [[0.006, 0.04], [0.7, 0.0015], [0.15, 0]]);
      o.start(t); o.stop(t + 1.0);
      h.start(t); h.stop(t + 1.0);
      emitNote({
        voice: "percussion", kind: "log", mode: o2.mode || null,
        clusterId: o2.clusterId || null,
        freq: freq, deg: deg, oct: -2, t: t, durS: 0.9,
      });
    }

    // ---- bone rattle: 3â7 tiny ticks on ONE gain chain ------------------------
    // The crackle pattern â one source, one filter, however many ticks. A
    // dry shimmer OVER drum strokes, never alone in the dark.
    function boneRattle(t, rng, o2) {
      o2 = o2 || {};
      var nTicks = rng.rint(3, 7);
      var tok = run.budget.claim(3, t + 1.0);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var src = PJ2.Voice.noiseBuffer.source(c, 30);
      var hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(2600, t);
      hp.Q.setValueAtTime(0.7, t);
      var g = c.createGain();
      src.connect(hp); hp.connect(g); g.connect(run.layPerc);
      var segs = [], at = 0;
      for (var i = 0; i < nTicks; i++) {
        var gap = rng.rnd(0.03, 0.09);
        segs.push([gap, 0]);
        segs.push([0.003, 0.011]);
        segs.push([0.02, 0]);
        at += gap + 0.023;
      }
      PJ2.Voice.env(g.gain, t, segs);
      src.start(t, src.randomOffset);
      src.stop(t + at + 0.1);
      emitNote({
        voice: "percussion", kind: "rattle", mode: o2.mode || null,
        freq: null, t: t, durS: at,
      });
    }

    // ========================================================================
    // THE LANDSCAPE LANES
    // ========================================================================

    // ---- the gurdy (landscape â THE SEAM) -----------------------------------
    // v1's sycorax drone cluster (~2844) re-voiced from the LIVE POSE: each
    // 20â28 s cycle reads harmony.current() at its own start and voices the
    // pose's degrees as detuned saws at oct â2 (46â124 Hz territory, v1's
    // register) plus the root doubled at oct â1 for body, through one
    // moving lowpass (150â350 Hz band, murk- and darkening-scaled), all
    // through the shared drift ramps (Â±3%, v1's warble). A cycle keeps its
    // frequencies for its whole life; the NEXT cycle reads the pose (and
    // the field â era-aware through the sink) again. The lane is NEVER
    // cancelled by scenes, performances, or the cut: it is the seam.
    //
    // THE TROMPETTE: one extra saw at the root, oct â1, whose ONLY route is
    // the grit bus (gritSendTromp) â the buzzing bridge. Its send gain is
    // pulsed by drum strokes (pulseTrompette, 60 ms+ ramps, â¤ +0.1).
    //
    // THE SUB: sine at the root, oct â3, chance 0.3 normally â FORCED in
    // the invocation and inside a darkening window (the arrival gesture
    // "sinks the sub-octave in").
    function startGurdy() {
      var lane = run.clock.lane("gurdy");
      var rng = run.streams.gurdy;
      function cycle(t) {
        // Draw everything FIRST so a budget refusal can't shift the stream.
        var durS = rng.rnd(20, 28);
        var overlap = rng.rnd(3, 5);
        var subRoll = rng.chance(0.3);
        var driftDraws = [];
        for (var dd = 0; dd < 5; dd++) {
          driftDraws.push([1 + rng.rnd(-0.03, 0.03), 1 + rng.rnd(-0.02, 0.02)]);
        }
        var cutoffDraw = rng.rnd(150, 350);
        var st = curSceneType();
        var iv = curIntensity(t);
        var wx = wxAt(t);
        var hasSub = subRoll || st === "invocation" || t < run.forceSubUntil;
        var tok = run.budget.claim(hasSub ? 14 : 12, t + durS + 0.3);
        if (!tok) {
          lane.at(t + 2, cycle); // the seam must not open: short-leash retry
          return;
        }
        run.tokens.push(tok);
        var c = ctx;
        // Darkness: murk closes the cutoff, the tide leans on it, and a
        // darkening arrival closes it another ~15% for its window.
        var cutoff = cutoffDraw * (1 - 0.35 * wx.murk) * (1 - 0.12 * curTidePos());
        if (t < run.darkenUntil) cutoff *= 0.85;
        cutoff = Math.max(90, cutoff + 60 * iv);
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(cutoff, t);
        lp.frequency.linearRampToValueAtTime(cutoff + 80, t + durS * 0.4);
        lp.frequency.linearRampToValueAtTime(Math.max(80, cutoff - 30), t + durS);
        lp.Q.setValueAtTime(0.5, t);
        lp.connect(run.gurdyBreath);
        lp.connect(run.gritSendGurdy); // the grit bus always hears the bed
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        var degs = (ch && ch.chordDegs && ch.chordDegs.length) ? ch.chordDegs : [0, 2, 4];
        var pads = [];
        for (var di = 0; di < degs.length && di < 3; di++) {
          pads.push({ deg: degs[di], oct: -2, peak: 0.035, type: "sawtooth" });
        }
        pads.push({ deg: degs[0], oct: -1, peak: 0.028, type: "sawtooth" }); // the body course
        var fadeIn = 3 + rng.rnd(0, 2);
        var fadeOut = 3 + rng.rnd(0, 2);
        for (var i = 0; i < pads.length; i++) {
          var p = pads[i];
          var freq = run.field.degFreq(p.deg, p.oct); // read at schedule time
          var o = c.createOscillator();
          o.type = p.type;
          o.frequency.setValueAtTime(freq, t);
          // v1's drift: anchored ramps to Â±3% waypoints and home again
          o.frequency.linearRampToValueAtTime(freq * driftDraws[i][1], t + durS * 0.35);
          o.frequency.linearRampToValueAtTime(freq * driftDraws[i][0], t + durS * 0.7);
          o.frequency.linearRampToValueAtTime(freq, t + durS);
          var g = c.createGain();
          o.connect(g); g.connect(lp);
          PJ2.Voice.env(g.gain, t, [[fadeIn, p.peak], [durS - fadeIn - fadeOut, p.peak], [fadeOut, 0]]);
          o.start(t);
          o.stop(t + durS + 0.1);
          emitNote({ voice: "gurdy", freq: freq, t: t, durS: durS, deg: p.deg, oct: p.oct });
        }
        // the trompette â grit-only, always present, pulsed elsewhere
        var tf = run.field.degFreq(degs[0], -1);
        var to = c.createOscillator();
        to.type = "sawtooth";
        to.frequency.setValueAtTime(tf, t);
        var tg = c.createGain();
        to.connect(tg);
        tg.connect(run.gritSendTromp);
        PJ2.Voice.env(tg.gain, t, [[fadeIn, 0.02], [durS - fadeIn - fadeOut, 0.02], [fadeOut, 0]]);
        to.start(t);
        to.stop(t + durS + 0.1);
        if (hasSub) {
          var sf = run.field.degFreq(degs[0], -3);
          var so = c.createOscillator();
          so.type = "sine";
          so.frequency.setValueAtTime(sf, t);
          var sg = c.createGain();
          so.connect(sg); sg.connect(run.gurdyBreath);
          PJ2.Voice.env(sg.gain, t, [[fadeIn, 0.022], [durS - fadeIn - fadeOut, 0.022], [fadeOut, 0]]);
          so.start(t);
          so.stop(t + durS + 0.1);
          emitNote({ voice: "gurdy", kind: "sub", freq: sf, t: t, durS: durS, deg: degs[0], oct: -3 });
        }
        lane.at(t + (durS - overlap), cycle);
      }
      lane.at(run.t0, cycle);
    }

    // ---- the ritual noise bed (landscape â "darker and noisier") -------------
    // Two slow sources into ONE slaved level gain (noiseLevel â the
    // follower holds it â¤ 0.8Ã the gurdy's level, always; that ceiling is
    // the whole meaning of "not too noisy"):
    //   EMBER-SMOKE â band-limited noise whose center drifts over minutes
    //   (each 24â40 s cycle ramps from the last center to a newly drawn one
    //   in 200â1200 Hz; the drift is the slow burn).
    //   RUIN-WIND â bandpassed gusts with 8â20 s envelopes, the filter
    //   swooping with each gust.
    // Per-source scheduled peaks â¤ 0.030 (asserted); murk breathes Â±20%.
    function startNoiseBed() {
      var lane = run.clock.lane("noisebed");
      var rng = run.streams.noisebed;
      function emberCycle(t) {
        var durS = rng.rnd(24, 40);
        var target = rng.rnd(260, 1150);
        var murk = wxAt(t).murk;
        var peak = 0.026 * (0.8 + 0.4 * murk); // â¤ 0.0312â¦ clamp below
        peak = Math.min(0.030, peak);
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) { lane.at(t + 4, emberCycle); return; }
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(run.emberCenter, t);
        bp.frequency.linearRampToValueAtTime(target, t + durS); // minutes-slow drift
        bp.Q.setValueAtTime(0.9, t);
        run.emberCenter = target;
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.noiseLevel);
        PJ2.Voice.env(g.gain, t, [[6, peak], [durS - 12, peak], [6, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        lane.at(t + durS - 6, emberCycle); // overlapped: smoke has no edges
      }
      function windGust(t) {
        var durS = rng.rnd(8, 20);
        var f0 = rng.rnd(300, 650);
        var f1v = f0 * rng.rnd(1.2, 1.9);
        var gap = rng.rnd(4, 15);
        var murk = wxAt(t).murk;
        var peak = Math.min(0.030, 0.020 * (0.8 + 0.4 * murk));
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, windGust); return; }
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f1v, t + durS * 0.45); // the swoop
        bp.frequency.linearRampToValueAtTime(f0 * 0.9, t + durS);
        bp.Q.setValueAtTime(2.2, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.noiseLevel);
        PJ2.Voice.env(g.gain, t, [[durS * 0.4, peak], [durS * 0.35, peak * 0.5], [durS * 0.25, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        lane.at(t + durS * 0.7 + gap, windGust);
      }
      lane.at(run.t0, emberCycle);
      lane.at(run.t0 + rng.rnd(3, 9), windGust);
    }

    // ---- the breath-bed (landscape â the treeline murmur) ---------------------
    // v1's whispers (~2938) reduced: same formant pairs, much quieter,
    // slower, and in the afterimage it sinks toward the unvoiced (half
    // peak, looser Q â air, not voices).
    function startBreathBed() {
      var lane = run.clock.lane("breath");
      var rng = run.streams.breath;
      function swell(t) {
        var durS = rng.rnd(2.5, 5.5);
        var formant = rng.pick(WHISPER_FORMANTS);
        var drift1 = 1 + rng.rnd(-0.15, 0.15);
        var drift2 = 1 + rng.rnd(-0.10, 0.10);
        var gap = rng.rnd(7, 16);
        var iv = curIntensity(t);
        var st = curSceneType();
        if (iv < 0.06) { lane.at(t + gap, swell); return; }
        var wx = wxAt(t);
        var unvoiced = (st === "afterimage");
        var peak = (unvoiced ? 0.009 : 0.018) * (0.6 + 0.8 * iv) * (0.8 + 0.4 * wx.breath);
        var q = (unvoiced ? 4 : 9) + rng.rnd(0, 4);
        var tok = run.budget.claim(5, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, swell); return; }
        run.tokens.push(tok);
        var c = ctx;
        var n = PJ2.Voice.noiseBuffer.source(c, 30);
        var f1 = c.createBiquadFilter();
        f1.type = "bandpass";
        f1.frequency.setValueAtTime(formant[0], t);
        f1.frequency.linearRampToValueAtTime(formant[0] * drift1, t + durS);
        f1.Q.setValueAtTime(q, t);
        var f2 = c.createBiquadFilter();
        f2.type = "bandpass";
        f2.frequency.setValueAtTime(formant[1], t);
        f2.frequency.linearRampToValueAtTime(formant[1] * drift2, t + durS);
        f2.Q.setValueAtTime(Math.max(2, q - 2), t);
        var pre = c.createGain();
        pre.gain.setValueAtTime(0.4, t); // quiet INTO the resonances (lesson #2)
        var mix = c.createGain();
        mix.gain.setValueAtTime(1, t);
        n.connect(pre); pre.connect(f1); pre.connect(f2);
        f1.connect(mix); f2.connect(mix);
        var g = c.createGain();
        mix.connect(g); g.connect(run.breathLevel);
        PJ2.Voice.env(g.gain, t, [[durS * 0.25, peak], [durS * 0.35, peak * 0.7], [durS * 0.4, 0]]);
        n.start(t, n.randomOffset);
        n.stop(t + durS + 0.1);
        emitNote({ voice: "breath", freq: null, t: t, durS: durS });
        lane.at(t + gap * gmAt(t), swell);
      }
      lane.at(run.t0 + rng.rnd(4, 10), swell);
    }

    // ---- the proto-drum lane (the pulse before the rite) ----------------------
    // Always polling, beating only where the scene map allows: gathering
    // (after the bruise-advanced gate), the afterimage (slowing with the
    // scene's own progress), and INSIDE THE HUSH â where it quickens and
    // beats alone. Poll gaps stay â¤ 3.2 s so the hush (â¥ 5 s) can never
    // slip between two polls unheard.
    function startProtoDrum() {
      var lane = run.clock.lane("protodrum");
      var rng = run.streams.protodrum;
      function pulse(t) {
        var st = curSceneType();
        var hush = inHush(t) || (run.cut && run.cut.fired && t >= run.cut.tB && t <= run.cut.end);
        var beats = false, gap;
        if (hush) {
          beats = true;
          gap = rng.rnd(1.7, 2.4); // the heart quickens when noticed
        } else if (st === "gathering") {
          beats = t >= run.protoGateT;
          gap = rng.rnd(2.6, 4.2) * (1.05 - 0.3 * curIntensity(t));
        } else if (st === "afterimage") {
          beats = true;
          gap = rng.rnd(3.2, 5.5) * (1 + 0.8 * curSceneX()); // slowing as it disperses
        } else {
          gap = rng.rnd(2.0, 3.0); // silent poll â the pulse waits in the trees
        }
        if (beats) protoBeat(t, rng);
        lane.at(t + Math.min(gap, 3.2) * (beats ? 1 : 1) , pulse);
      }
      lane.at(run.t0 + 1.5, pulse);
    }

    // ---- the percussion lane (the anti-groove law) -----------------------------
    // ONE lane, ONE stream, strokes at exact times, coordinating with the
    // conductor by READING scene + intensity at each stroke â never by
    // being scheduled by it. Modes:
    //   circling      â loose strokes at breath gaps (3â10 s, intensity-
    //                   scaled: no grid exists to find), occasional pairs
    //                   (the lub-dub inheritance), rattle shimmer on some.
    //   processional  â the WALK (scheduled from the scene event, see
    //                   handleConductorEvent): a barely-gridded period
    //                   drawn per scene (2.4â3.4 s), Â±20% jitter per
    //                   stroke, rattle accents.
    //   invocation    â CLUSTERS (also scheduled from the scene event):
    //                   5â9 strokes whose spacing shrinks geometrically
    //                   2.0 â 0.7 s, gains flat â speed rises, level never
    //                   does. Log drum between clusters.
    //   elsewhere     â the loop idles (gathering and afterimage belong to
    //                   the proto-drum alone).
    // The cut cancels this whole lane at tB â a cluster cut off unfinished
    // is the gesture â and re-arms the idle pulse after the hush.
    function percPulse(t) {
      var lane = run.clock.lane("percussion");
      var rng = run.streams.percussion;
      var st = curSceneType();
      var iv = curIntensity(t);
      // Draws first, unconditionally (stream discipline).
      var gap = rng.rnd(3, 10) * (1.25 - 0.7 * iv);
      var pairRoll = rng.chance(0.25);
      var rattleRoll = rng.chance(0.3);
      if (st === "circling" && !inHush(t)) {
        frameDrum(t, rng, { mode: "loose" });
        if (pairRoll) {
          var dt = 0.32 + rng.rnd(0, 0.12);
          lane.at(t + dt, function (t2) {
            if (!inHush(t2)) frameDrum(t2, rng, { mode: "pair2", peak: 0.034 });
          });
        }
        if (rattleRoll) boneRattle(t + 0.02, rng, { mode: "loose" });
      } else if (st === "invocation" || st === "processional") {
        gap = rng.rnd(4, 8); // walk/clusters carry these scenes; the pulse idles
      }
      lane.at(t + Math.max(1.2, gap), percPulse);
    }
    function startPercussion() {
      run.clock.lane("percussion").at(run.t0 + 2, percPulse);
    }

    // The processional walk â armed by the scene event with its drawn
    // period; strokes re-check the scene at each fire and let the walk die
    // when the processional ends.
    function walkStroke(t) {
      var lane = run.clock.lane("percussion");
      var rng = run.streams.percussion;
      if (curSceneType() !== "processional") return; // the rite has moved on
      var jitter = rng.rnd(0.8, 1.2);                // Â±20%, per stroke
      var rattleRoll = rng.chance(0.25);
      if (!inHush(t)) {
        frameDrum(t, rng, { mode: "walk" });
        if (rattleRoll) boneRattle(t + 0.02, rng, { mode: "walk-accent" });
      }
      lane.at(t + run.walkPeriod * jitter, walkStroke);
    }

    // One accelerating cluster: n strokes, spacing shrinking geometrically
    // from ~2.0 s to ~0.7 s (strictly monotone, floor 0.65), gains FLAT.
    // Followed sometimes by a log drum tone â the wooden answer.
    function fireCluster(t) {
      var rng = run.streams.percussion;
      var lane = run.clock.lane("percussion");
      var n = rng.rint(5, 9);
      var s0 = rng.rnd(1.8, 2.1);
      var s1 = rng.rnd(0.68, 0.8);
      var logRoll = rng.chance(0.5);
      var cid = "c" + Math.round((t - run.t0) * 1000); // run-relative: same-seed runs mint identical ids
      emitEvent({ type: "percussion", mode: "cluster", n: n, t: t, clusterId: cid });
      var r = Math.pow(s1 / s0, 1 / Math.max(1, n - 2));
      var at = 0, sp = s0;
      for (var i = 0; i < n; i++) {
        (function (tt) {
          lane.at(tt, function (te) {
            if (!inHush(te)) frameDrum(te, rng, { mode: "cluster", clusterId: cid, vel: 1, peak: 0.042 });
          });
        })(t + at);
        at += sp;
        sp = Math.max(0.65, sp * r);
      }
      if (logRoll) {
        lane.at(t + at + rng.rnd(1.5, 3), function (tl) {
          if (!inHush(tl) && curSceneType() === "invocation") logDrum(tl, rng, { mode: "cluster-tail" });
        });
      }
    }

    // ========================================================================
    // THE MELODIC LANES â all claim THE AIR, all speak in motif phrases.
    // Presence order (the plan's): chant > rebec > waterphone > bone-flute.
    // Gathering is CHANT-ONLY among the speakers (the others' scene
    // chances are 0 there) â which is also what guarantees the ghost is
    // always intoned by the cantor.
    // ========================================================================
    var SPEAK_P = {
      chant:      { gathering: 0.55, processional: 0.85, circling: 0.6, invocation: 0.7, afterimage: 0.35 },
      rebec:      { gathering: 0,    processional: 0.3,  circling: 0.5, invocation: 0.4, afterimage: 0.15 },
      waterphone: { gathering: 0,    processional: 0.2,  circling: 0.35, invocation: 0.3, afterimage: 0.2 },
      boneflute:  { gathering: 0,    processional: 0.25, circling: 0,   invocation: 0.25, afterimage: 0 },
    };

    // Shared attempt scaffold: draw-first discipline, ghost-holding on a
    // denied air (a memory must not be erased by a busy moment), the hush
    // gate on note onsets, whole-octave re-registration (degree classes â
    // and therefore the keening law â survive).
    function startChant() {
      var lane = run.clock.lane("chant");
      var rng = run.streams.chant;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var sings = rng.chance(SPEAK_P.chant[st] != null ? SPEAK_P.chant[st] : 0.4);
        if (!sings || iv < 0.05) { lane.at(t + rng.rnd(7, 13) * gmAt(t), attempt); return; }
        var res = run.heldUtterance.chant;
        run.heldUtterance.chant = null;
        if (!res) {
          try { res = run.motif.request("chant", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(7, 13) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.2, 1.8) * (1.5 - 0.6 * iv); // the slowest lungs in the clearing
        var tm = phraseTiming(m, spb, 1.25, 1.5, 6);
        var margin = rng.rnd(5, 10);
        var tok = null;
        try { tok = run.air.tryClaim("chant", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.chant = res;
          lane.at(t + rng.rnd(4, 8) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "chant", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "chant", t);
        // Register: chant-fresh material is born in the chest (motif home
        // register â1); shared material recentres near 0 and drops an
        // octave to stay there. The invocation lifts the whole line one
        // octave â concentration by REGISTER, never level.
        var mean = 0;
        for (var mi = 0; mi < m.notes.length; mi++) mean += m.notes[mi].deg;
        mean /= m.notes.length;
        var off = (mean > 2.5 ? -run.field.size : 0) + (st === "invocation" ? run.field.size : 0);
        var velScale = (res.kind === "ghost") ? 0.6 : 1; // the half-remembered line, quiet
        var out = mixOut("chant", run.poolMel.at(rng.rnd(-0.4, 0.4)));
        // The clearing answers the cantor about half the time (seasick
        // delay send, per line, on the delaySend fork).
        var echoed = run.streams.delaySend.chance(0.5);
        // WORDLESS VOWELS, drifting toward syllabic articulation ONLY in
        // the processional (implied language is potent; attempted language
        // is kitsch): one mouth shape per phrase elsewhere, per-note steps
        // there. Organum doubling rides the processional lines too.
        var syllabic = (st === "processional");
        var doubled = syllabic; // organum doubles the processional statements
        var vowel = walkVowel();
        var lastVel = 1, lastAbs = null, lastEnd = t;
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.7, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (syllabic && i > 0 && run.streams.vowels.chance(0.6)) vowel = walkVowel();
          if (inHush(nt)) continue;          // the cut swallows the word â the gesture
          var btok = run.budget.claim(doubled ? 22 : 11, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg + off;
          var freq = run.field.degFreq(abs, 0); // read at schedule time, never cached
          renderChantNote(out, freq, nt, nd, 0.032 * vel, vowel, wxAt(nt),
            echoed ? run.delaySendChant : null);
          emitNote({
            voice: "chant", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
          });
          if (doubled) {
            // Parallel organum: the lower voice doubles THIS line at the
            // authored interval (P5 / P4 / occursus third â see
            // ORGANUM_DOUBLING). Drawless, stateless, exactly 2 parts.
            var duo = null;
            try { duo = run.harmony.voiceConsort(2, { top: abs }); } catch (e2) { duo = null; }
            if (duo && duo.length === 2) {
              var lowFreq = run.field.degFreq(duo[0], 0);
              renderChantNote(out, lowFreq, nt, nd, 0.032 * vel * 0.6, vowel, wxAt(nt), null);
              emitNote({
                voice: "chant", kind: "organum", freq: lowFreq, t: nt, durS: nd,
                deg: duo[0], oct: 0, velocity: vel * 0.6,
              });
              emitEvent({ type: "organum", top: duo[1], low: duo[0], parts: 2, t: nt, via: "processional" });
            }
          }
          lastVel = vel;
          lastAbs = abs;
          lastEnd = nt + nd;
        }
        // THE AFTER-TONE (~40%, never on the ghost): a quiet body gesture
        // on the final BELOW the keen â degree class 0, half the phrase's
        // last velocity, NOT a motif note. The abstract music stays
        // honestly unresolved; the ear hears the keen sag home and fail to
        // mean it.
        var aftRoll = rng.chance(0.4);
        if (aftRoll && res.kind !== "ghost" && lastAbs != null && !inHush(lastEnd + 0.25)) {
          var aft = lastAbs;
          var guard = 0;
          while (degClass(aft) !== 0 && guard++ < 8) aft--;
          var atok = run.budget.claim(11, lastEnd + 2.4);
          if (atok) {
            run.tokens.push(atok);
            var aFreq = run.field.degFreq(aft, 0);
            renderChantNote(out, aFreq, lastEnd + 0.25, rng.rnd(1.2, 2), 0.032 * lastVel * 0.5,
              vowel, wxAt(lastEnd + 0.25), null);
            emitNote({
              voice: "chant", kind: "aftertone", freq: aFreq, t: lastEnd + 0.25,
              durS: 1.6, deg: aft, oct: 0, velocity: lastVel * 0.5,
            });
          }
        }
        maybePost("chant", res, t);
        lane.at(t + tm.spanS + margin + rng.rnd(6, 14) * (1.35 - iv) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(8, 16), attempt);
    }

    function startRebec() {
      var lane = run.clock.lane("rebec");
      var rng = run.streams.rebec;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance(SPEAK_P.rebec[st] != null ? SPEAK_P.rebec[st] : 0.3);
        if (!plays || iv < 0.1) { lane.at(t + rng.rnd(8, 15) * gmAt(t), attempt); return; }
        var res = run.heldUtterance.rebec;
        run.heldUtterance.rebec = null;
        if (!res) {
          try { res = run.motif.request("rebec", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(8, 15) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.55, 0.85) * (1.4 - 0.6 * iv);
        var tm = phraseTiming(m, spb, 1.35, 0.8, 3.5);
        var margin = rng.rnd(4, 8);
        var tok = null;
        try { tok = run.air.tryClaim("rebec", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.rebec = res;
          lane.at(t + rng.rnd(3, 6) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "rebec", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "rebec", t);
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        var out = mixOut("rebec", run.poolMel.at(rng.rnd(-0.55, 0.55)));
        var echoed = run.streams.delaySend.chance(0.3);
        var dblRoll = rng.chance(0.2); // the open-fifth double stop, occasional
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.65, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue;
          var isFinal = i === m.notes.length - 1;
          var btok = run.budget.claim(isFinal && dblRoll ? 16 : 9, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;
          var freq = run.field.degFreq(abs, 0);
          renderRebecNote(out, freq, nt, nd, vel, rng, echoed ? run.delaySendRebec : null);
          emitNote({
            voice: "rebec", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: isFinal,
          });
          if (isFinal && dblRoll) {
            // double stop: the authored organum interval below the final â
            // in-scale by construction, so adherence survives.
            var duo2 = null;
            try { duo2 = run.harmony.voiceConsort(2, { top: abs }); } catch (e3) { duo2 = null; }
            if (duo2 && duo2.length === 2) {
              var lf = run.field.degFreq(duo2[0], 0);
              renderRebecNote(out, lf, nt, nd, vel * 0.7, rng, null);
              emitNote({
                voice: "rebec", kind: "doublestop", freq: lf, t: nt, durS: nd,
                deg: duo2[0], oct: 0, velocity: vel * 0.7,
              });
              emitEvent({ type: "organum", top: duo2[1], low: duo2[0], parts: 2, t: nt, via: "doublestop" });
            }
          }
        }
        lane.at(t + tm.spanS + margin + rng.rnd(5, 12) * (1.35 - iv) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(20, 40), attempt);
    }

    function startWaterphone() {
      var lane = run.clock.lane("waterphone");
      var rng = run.streams.waterphone;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance(SPEAK_P.waterphone[st] != null ? SPEAK_P.waterphone[st] : 0.25);
        if (!plays || iv < 0.1) { lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt); return; }
        var res = null;
        try { res = run.motif.request("waterphone", reqCtx(t)); } catch (e) { res = null; }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.0, 1.5) * (1.3 - 0.4 * iv); // the metal takes its time
        var tm = phraseTiming(m, spb, 1.6, 2.2, 8);
        var margin = rng.rnd(6, 12);                    // the lyrical OCCASIONAL voice
        var tok = null;
        try { tok = run.air.tryClaim("waterphone", tm.spanS, margin); } catch (e) {}
        if (!tok) { lane.at(t + rng.rnd(5, 9) * gmAt(t), attempt); return; }
        emitEvent({
          type: "air", voice: "waterphone", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "waterphone", t);
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        var out = mixOut("waterphone", run.poolMel.at(rng.rnd(-0.5, 0.5)));
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.6, 0.95) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue; // the hush belongs to the apparition alone
          var btok = run.budget.claim(30, nt + nd + 0.6);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;
          var freq = run.field.degFreq(abs, 0);
          // the metal ALWAYS reaches the clearing wall (delay), and the
          // cavern's throat hears it through a small send.
          var wEnv = renderWaterphoneNote(out, freq, nt, nd, vel, rng, run.delaySendWater);
          try { wEnv.connect(run.throatSendWater); } catch (eT) {}
          emitNote({
            voice: "waterphone", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
          });
        }
        lane.at(t + tm.spanS + margin + rng.rnd(8, 16) * (1.3 - iv) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(30, 55), attempt);
    }

    function startBoneflute() {
      var lane = run.clock.lane("boneflute");
      var rng = run.streams.boneflute;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance(SPEAK_P.boneflute[st] != null ? SPEAK_P.boneflute[st] : 0);
        // 2â3 utterances an evening, HARD (the counter resets at each
        // performance begin) â the one high lonely color stays lonely.
        if (!plays || iv < 0.12 || run.fluteCount >= run.fluteMax) {
          lane.at(t + rng.rnd(14, 24) * gmAt(t), attempt);
          return;
        }
        var res = null;
        try { res = run.motif.request("boneflute", reqCtx(t)); } catch (e) { res = null; }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(14, 24) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.45, 0.7);
        var tm = phraseTiming(m, spb, 1.3, 0.6, 2.2); // breath-length phrases
        var margin = rng.rnd(6, 10);
        var tok = null;
        try { tok = run.air.tryClaim("boneflute", tm.spanS, margin); } catch (e) {}
        if (!tok) { lane.at(t + rng.rnd(6, 10) * gmAt(t), attempt); return; }
        run.fluteCount++;
        emitEvent({
          type: "air", voice: "boneflute", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "boneflute", t);
        var out = mixOut("boneflute", run.poolMel.at(rng.rnd(-0.3, 0.3)));
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.6, 0.9);
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue;
          var btok = run.budget.claim(6, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;                  // home register +1 (motif config)
          var freq = run.field.degFreq(abs, 0);
          renderBoneFluteNote(out, freq, nt, nd, vel);
          emitNote({
            voice: "boneflute", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
          });
        }
        lane.at(t + tm.spanS + margin + rng.rnd(20, 40) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(60, 120), attempt);
    }

    // ========================================================================
    // THE AMBIENT POOL (landscape â the dark outside the circle). Weighted,
    // weather/tide-gated, at the LIBRARY's density (same gap law: 20â60 s
    // scaled by intensity and tide, gapMul Â±15%, floor 8 s â the roster is
    // strange, the room is no busier). Dropped from v1: cackle, glass,
    // cauldron (startle/comedy risks).
    // ========================================================================
    function startAmbient() {
      var lane = run.clock.lane("ambient");
      var rng = run.streams.ambient;

      // -- ruin-wind gust (a louder single gust, the bed's cousin)
      function poolGust(t) {
        var durS = rng.rnd(4, 9);
        var f0 = rng.rnd(350, 700);
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f0 * 1.6, t + durS * 0.4);
        bp.frequency.linearRampToValueAtTime(f0 * 0.85, t + durS);
        bp.Q.setValueAtTime(2.5, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[durS * 0.35, 0.024], [durS * 0.3, 0.012], [durS * 0.35, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        emitNote({ voice: "ambient", kind: "gust", freq: null, t: t, durS: durS });
      }

      // -- ember pops (the fire spitting â crackle pattern, one gain chain)
      function emberPops(t) {
        var n = rng.rint(2, 5);
        var tok = run.budget.claim(3, t + 1.4);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(1500, t);
        hp.Q.setValueAtTime(0.7, t);
        var g = c.createGain();
        src.connect(hp); hp.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var i = 0; i < n; i++) {
          var up = 0.003 + rng.rnd(0, 0.006);
          var dn = 0.02 + rng.rnd(0, 0.05);
          var rest = rng.rnd(0.06, 0.22);
          segs.push([up, 0.012 * rng.rnd(0.6, 1)]);
          segs.push([dn, 0]);
          segs.push([rest, 0]);
          at += up + dn + rest;
        }
        PJ2.Voice.env(g.gain, t, segs);
        src.start(t, src.randomOffset);
        src.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "ember", freq: null, t: t, durS: at });
      }

      // -- stone-grind (v1's scrape ~3717, demoted to the pool, at 2/3 dose)
      function stoneGrind(t) {
        var dur = 0.8 + rng.rnd(0, 1.2);
        var startFreq = 200 + rng.rnd(0, 500);
        var qVal = 10 + rng.rnd(0, 10);
        var dirRoll = rng.next();
        var tok = run.budget.claim(4, t + dur + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var o = c.createOscillator();
        var f = c.createBiquadFilter();
        o.type = "sawtooth";
        f.type = "bandpass";
        f.frequency.setValueAtTime(startFreq, t);
        f.Q.setValueAtTime(qVal, t);
        if (dirRoll < 0.33) {          // dip
          o.frequency.setValueAtTime(startFreq, t);
          o.frequency.linearRampToValueAtTime(startFreq * 0.5, t + dur * 0.5);
          o.frequency.linearRampToValueAtTime(startFreq * 0.9, t + dur);
        } else if (dirRoll < 0.66) {   // down
          o.frequency.setValueAtTime(startFreq, t);
          o.frequency.linearRampToValueAtTime(startFreq * 0.4, t + dur);
        } else {                       // up
          o.frequency.setValueAtTime(startFreq * 0.5, t);
          o.frequency.linearRampToValueAtTime(startFreq, t + dur);
        }
        var pre = c.createGain();
        pre.gain.setValueAtTime(0.5, t); // quiet INTO the Q-10+ resonance
        var g = c.createGain();
        o.connect(pre); pre.connect(f); f.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[0.06, 0.026], [dur * 0.5 - 0.06, 0.022], [dur * 0.5, 0]]);
        o.start(t);
        o.stop(t + dur + 0.1);
        emitNote({ voice: "ambient", kind: "stone", freq: null, t: t, durS: dur });
      }

      // -- chains (v1 ~3838, node-economy port: ONE noise + ONE bandpass,
      // retuned between pings at true-zero gain â the cricket lesson)
      function chains(t) {
        var pings = rng.rint(5, 9);
        var rate = rng.rnd(10, 16);
        var spacing = 1 / rate;
        var tok = run.budget.claim(3, t + pings * spacing + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(rng.rnd(3000, 7000), t);
        bp.Q.setValueAtTime(20, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var i = 0; i < pings; i++) {
          if (i > 0) bp.frequency.setValueAtTime(rng.rnd(3000, 7000), t + at); // silent retune
          var pd = 0.02 + rng.rnd(0, 0.03);
          segs.push([0.002, 0.016 * rng.rnd(0.7, 1)]);
          segs.push([pd, 0]);
          segs.push([Math.max(0.004, spacing - pd - 0.002), 0]);
          at += 0.002 + pd + Math.max(0.004, spacing - pd - 0.002);
        }
        PJ2.Voice.env(g.gain, t, segs);
        src.start(t, src.randomOffset);
        src.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "chains", freq: null, t: t, durS: at });
      }

      // -- raven (v1 ~3957: sawtooth squawks through two formant bands,
      // pitch falling â unpitched texture, far-field dose)
      function raven(t) {
        var squawks = rng.rint(1, 3);
        var tok = run.budget.claim(5 * squawks, t + squawks * 0.3 + 0.4);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        for (var i = 0; i < squawks; i++) {
          var st2 = t + i * (0.15 + rng.rnd(0, 0.1));
          var dur = 0.12 + rng.rnd(0, 0.08);
          var f0 = 800 + rng.rnd(0, 400);
          var o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(f0, st2);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.4, st2 + dur);
          var f1 = c.createBiquadFilter();
          f1.type = "bandpass";
          f1.frequency.setValueAtTime(1200, st2);
          f1.Q.setValueAtTime(8, st2);
          var f2 = c.createBiquadFilter();
          f2.type = "bandpass";
          f2.frequency.setValueAtTime(2800, st2);
          f2.Q.setValueAtTime(6, st2);
          var pre = c.createGain();
          pre.gain.setValueAtTime(0.35, st2);
          var mix = c.createGain();
          mix.gain.setValueAtTime(1, st2);
          var g = c.createGain();
          o.connect(pre); pre.connect(f1); pre.connect(f2);
          f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, st2, [[0.01, 0.016], [dur - 0.01, 0.001], [0.04, 0]]);
          o.start(st2);
          o.stop(st2 + dur + 0.06);
        }
        emitNote({ voice: "ambient", kind: "raven", freq: null, t: t, durS: squawks * 0.3 });
      }

      // -- cracked iron bell (tide-near): one struck tone + an inharmonic
      // hum partial â the fundamental SNAPS TO THE FIELD (era-aware; even
      // the derelict bell keeps the key).
      function ironBell(t) {
        var info = run.field.snapInfo(360 + rng.rnd(0, 190)); // draw, then snap
        var tok = run.budget.claim(4, t + 6.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(info.freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[0.006, 0.022], [5.2, 0.001], [0.5, 0]]);
        o.start(t);
        o.stop(t + 6.0);
        var h = c.createOscillator(); // the crack: an inharmonic upper partial
        h.type = "sine";
        h.frequency.setValueAtTime(info.freq * 2.76, t);
        var hg = c.createGain();
        h.connect(hg); hg.connect(run.layAmb);
        PJ2.Voice.env(hg.gain, t, [[0.004, 0.008], [2.2, 0.0008], [0.3, 0]]);
        h.start(t);
        h.stop(t + 2.8);
        emitNote({
          voice: "ambient", kind: "bell", freq: info.freq, t: t, durS: 5.5,
          deg: info.deg, oct: info.oct,
        });
      }

      // -- THE KEEN (weight 6, far-field): one distant wordless cry on the
      // chant's own body â the human trace that makes the rite a rite. The
      // witch_cackle's dignified descendant. Field degree 1 or 5 an octave
      // up, steady tone + vibrato (no gliss: even grief keeps the key).
      function keen(t) {
        var deg = rng.chance(0.6) ? 1 : 5;
        var durS = rng.rnd(2.5, 4.5);
        var tok = run.budget.claim(12, t + durS + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var freq = run.field.degFreq(deg, 1);
        renderChantNote(run.layAmb, freq, t, durS, 0.014, walkVowel(), wxAt(t), null);
        emitNote({
          voice: "ambient", kind: "keen", freq: freq, t: t, durS: durS,
          deg: deg, oct: 1,
        });
      }

      function oneShot(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var wx = wxAt(t);
        // Weights shape WHICH sound fires, never HOW OFTEN (one fire = one
        // event; the gap law below owns the density). Tide-near favors
        // iron and chains; tide-far favors thunder; wetTilt gates thunder up.
        var what = rng.pickW([
          ["gust", 16],
          ["ember", 14],
          ["stone", 10],
          ["chains", 10 * (0.6 + 0.8 * tide)],
          ["raven", 10],
          ["thunder", 10 * (0.5 + Math.max(0, wx.wetTilt - 0.4)) * (1.3 - 0.6 * tide)],
          ["bell", 8 * (0.25 + 1.5 * tide)],
          ["keen", 6],
        ]);
        try {
          if (what === "gust") poolGust(t);
          else if (what === "ember") emberPops(t);
          else if (what === "stone") stoneGrind(t);
          else if (what === "chains") chains(t);
          else if (what === "raven") raven(t);
          else if (what === "thunder") farThunder(t, rng, 1.0, "ambient");
          else if (what === "bell") ironBell(t);
          else if (what === "keen") keen(t);
        } catch (e) { /* a missing one-shot is just a darker treeline */ }
        // THE GAP LAW â the Library's, verbatim: density within the family
        // contract by construction.
        var next = rng.rnd(20, 60) * (1.3 - 0.6 * iv - 0.15 * tide) * gmAt(t);
        lane.at(t + Math.max(8, next), oneShot);
      }
      lane.at(run.t0 + rng.rnd(8, 20), oneShot);
    }

    // ========================================================================
    // THE HARMONY LANE â the pose rotation's pulse: 22â40 s, slower at the
    // evening's edges, quicker under concentration (band never escaped).
    // One pickW per step (pose mode's contract); a step that lands on the
    // same pose (impossible with these no-self rows, but guarded) or on
    // the row-less "afterimage" hold narrates nothing.
    // ========================================================================
    function startHarmonyLane() {
      var lane = run.clock.lane("harmony");
      var rng = run.streams.harmonyLane;
      function periodAt(t) {
        var st = curSceneType();
        var iv = curIntensity(t);
        var base = (st === "gathering" || st === "afterimage") ? 0.75
          : (st === "invocation") ? 0.3
          : 0.5;
        var pos = clamp(base + (rng.next() - 0.5) * 0.5 - 0.25 * iv, 0, 1);
        return 22 + 18 * pos;
      }
      function stepFn(t) {
        try {
          var before = run.harmony.current().name;
          run.harmony.step(t);
          var after = run.harmony.current().name;
          if (after !== before) {
            emitEvent({ type: "pose", pose: after, rootDeg: 0, via: "step", t: t });
          }
        } catch (e) { /* a stuck pose is still a pose */ }
        lane.at(t + periodAt(t), stepFn);
      }
      lane.at(run.t0 + periodAt(run.t0), stepFn);
    }

    // ========================================================================
    // DARKENING ARRIVALS â where a Library boundary would cadence, a
    // Sycorax boundary DARKENS: pose forced to "sting" at the exact tB, the
    // gurdy's sub-octave sunk in and its lowpass closed ~15% for a window,
    // and (drawn ~0.7) a two-part ORGANUM pad â the open fifth {0,5} under
    // whatever line is keening â breathing across the seam on the chant's
    // own throat, at joint level. No flourishes, no lifts: an arrival that
    // makes the room slightly worse.
    // ========================================================================
    function organumArrivalPad(tB) {
      var rng = run.streams.arrivals;
      var durS = rng.rnd(9, 13);          // draws first, unconditionally
      var padRoll = rng.chance(0.7);
      if (!padRoll) return;
      var t = tB - durS * 0.65;           // blooms before, releases after tB
      var duo = null;
      try { duo = run.harmony.voiceConsort(2, { top: 5 }); } catch (e) { duo = null; }
      if (!duo || duo.length !== 2) duo = [0, 5];
      var tok = run.budget.claim(22, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var vowel = walkVowel();
      for (var i = 0; i < 2; i++) {
        var freq = run.field.degFreq(duo[i], -1); // low: under the texture
        renderChantNote(run.layAmb, freq, t, durS, 0.014, vowel, wxAt(t), null);
        emitNote({
          voice: "chant", kind: "organum-pad", freq: freq, t: t, durS: durS,
          deg: duo[i], oct: -1,
        });
      }
      emitEvent({ type: "organum", top: duo[1], low: duo[0], parts: 2, t: t, via: "arrival" });
    }

    function scheduleArrival(tB, toType) {
      var lane = run.clock.lane("arrival");
      lane.at(tB - 9.5, function () {
        if (!run || !run.live) return;
        organumArrivalPad(tB);
      });
      lane.at(tB, function (t) {
        if (!run || !run.live) return;
        setPoseIfNew("sting", t, "arrival");
        run.darkenUntil = t + 25;   // the lowpass closes ~15% for a while
        run.forceSubUntil = t + 30; // the sub-octave sinks in
        emitEvent({ type: "arrival", to: toType, t: t });
      });
    }

    // ========================================================================
    // THE CUT â the moment the observer is noticed. Lives entirely in
    // gain-land on the DEDICATED cutGain over the landscape sum (gurdy +
    // noise bed + breath-bed + ambient + grit); never touches master; one
    // writer on the param; conductor intensity stays continuous throughout
    // (the 0.02/0.5 s ruler holds unconditionally).
    // ========================================================================

    // The indrawn breath, tB â 0.6: reverse-enveloped bandpass noise at
    // ambient level â the treeline inhaling before the eyes turn.
    function indrawnBreath(t) {
      var tok = run.budget.claim(3, t + 0.8);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.linearRampToValueAtTime(1600, t + 0.55); // rising â inhaled
      bp.Q.setValueAtTime(1.4, t);
      var g = c.createGain();
      n.connect(bp); bp.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.5, 0.022], [0.08, 0]]); // swell, then cut off
      n.start(t, n.randomOffset);
      n.stop(t + 0.7);
      emitNote({ voice: "cut", kind: "indrawn-breath", freq: null, t: t, durS: 0.58 });
    }

    // Plan the cut at invocation entry; fire it at the exact boundary tB.
    function planCut(tB, tide) {
      var rng = run.streams.cut;
      var sev = clamp(0.4 + 0.6 * tide, 0, 1);
      var hold = 3 + 5 * sev;                 // â [5, 8] at sev â¥ 0.4
      var dip = 0.28 - 0.14 * sev;            // â [0.14, 0.224]
      var ret = rng.rnd(2.5, 4);
      var appDeg = rng.pickW([[1, 3], [5, 2], [4, 1]]); // the apparition's tone: keening degrees
      run.cut = {
        tB: tB, end: tB + hold, sev: sev, dip: dip, holdS: hold, retS: ret,
        appDeg: appDeg, fired: false,
      };
      var lane = run.clock.lane("cut");
      lane.at(tB - 0.6, function (t) {
        if (!run || !run.live) return;
        indrawnBreath(t);
      });
      lane.at(tB, function (t) { fireCut(t); });
    }

    function fireCut(t) {
      if (!run || !run.live || !run.cut || run.cut.fired) return;
      var cut = run.cut;
      cut.fired = true;
      run.lastCutSeverity = cut.sev; // the bruise the next evening inherits
      // The sink, if this evening drew one, executes AT the cut â the rite
      // resumes a half-step lower on the far side of the hush.
      if (run.seaChange && !run.seaChange.done && run.seaChange.atCutT === cut.tB) {
        executeSinkAt(t);
      }
      // Percussion stops MID-GESTURE: the lane's pending strokes (a cluster
      // half-spent, a pair half-answered) die where they stand. The idle
      // pulse re-arms after the hush; the proto-drum lane is untouched â
      // the hush keeps its heart.
      try { run.clock.lane("percussion").cancelAll(); } catch (e) {}
      run.clock.lane("cut").at(cut.end + 1, percPulse);
      // The gain move: one writer, one schedule â anchored at 1, down to
      // the dip in 0.25 s, held, returned over 2.5â4 s into the afterimage.
      var g = run.cutGain.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(cut.dip, t + 0.25);
      g.setValueAtTime(cut.dip, t + cut.holdS);
      g.linearRampToValueAtTime(1, t + cut.holdS + cut.retS);
      emitEvent({
        type: "cut", t: t, severity: cut.sev, dip: cut.dip,
        holdS: cut.holdS, returnS: cut.retS,
      });
      // THE HUSH IS INHABITED: ~1.2 s in, ONE waterphone apparition (v1's
      // long 0.55-gain shape) â the only melodic sound allowed inside; it
      // bypasses the air (the cut suspends the parliament) and the hush
      // gate (it IS the exception the gate protects).
      var appT = t + 1.2;
      var appDur = Math.max(3.5, cut.holdS + cut.retS * 0.8); // rings past the return
      run.clock.lane("cut").at(appT, function (ta) {
        if (!run || !run.live) return;
        var tok = run.budget.claim(30, ta + appDur + 0.6);
        if (!tok) return;
        run.tokens.push(tok);
        var freq = run.field.degFreq(cut.appDeg, 0); // post-sink field, if any
        var env = renderWaterphoneNote(mixOut("waterphone", run.poolMel.at(0)), freq, ta, appDur, 0.55, run.streams.cut, run.delaySendWater);
        try { env.connect(run.throatSendWater); } catch (e2) {}
        emitNote({
          voice: "waterphone", kind: "apparition", freq: freq, t: ta,
          durS: appDur, deg: cut.appDeg, oct: 0, velocity: 0.55,
        });
      });
      run.clock.lane("cut").at(t + cut.holdS, function (te) {
        emitEvent({ type: "cut-return", t: te, returnS: cut.retS });
      });
    }

    // ---- the sink (the rare sea change: stasis getting worse) ----------------
    // Pure tonic multiply (Ã2^(â1/12), same mode) through the profile's
    // ratio target â the accepted reroot-ratchet quirk (pj2-harmony.js:508)
    // is never on this path. Carried degrees just sound lower; the pose
    // persists (harmony keeps it); the cavern's throat retunes HERE and
    // only here, inside the hush where its 0.3 s fade-swap-fade can never
    // be heard splicing.
    function executeSinkAt(t) {
      if (!run || !run.live || !run.seaChange || run.seaChange.done) return;
      run.seaChange.done = true;
      var res = null;
      try { res = run.harmony.executeSeaChange(run.seaChange.target); } catch (e) { res = null; }
      try { run.throat.retune(throatFreqs(run.field)); } catch (e2) {}
      emitEvent({
        type: "seachange", target: run.seaChange.target,
        name: (res && res.name) || "sink",
        pivotDegs: (res && res.pivotDegs) ? res.pivotDegs : null,
        field: { tonicHz: run.field.tonicHz, mode: run.field.mode },
        t: t,
      });
    }

    // The cavern's throat tuning: dark combs at degrees {0, 1, 5, 0+oct} â
    // the final, the flat second, the fifth, the octave: the keen's own
    // skeleton, read from the LIVE field at (re)tune time.
    function throatFreqs(field) {
      return [
        field.degFreq(0, 0), field.degFreq(1, 0),
        field.degFreq(5, 0), field.degFreq(0, 1),
      ];
    }

    // ========================================================================
    // ROOMS â balances lean wide (the cavern): gathering 0.45, processional
    // 0.55, circling 0.5, invocation 0.65, afterimage 0.75; ramped 12â20 s,
    // wetTilt nudging Â±0.05. Percussion registers close-biased (a drum is
    // HERE; everything else is THERE).
    // ========================================================================
    var ROOM_BALANCE = {
      "gathering": 0.45, "processional": 0.55, "circling": 0.5,
      "invocation": 0.65, "afterimage": 0.75,
    };
    function setSceneRoom(evt) {
      var rampS = run.streams.rooms.rnd(12, 20); // draw FIRST, unconditionally
      var wx = wxAt(evt.t);
      var base = (ROOM_BALANCE[evt.scene] != null) ? ROOM_BALANCE[evt.scene] : 0.5;
      var bal = clamp(base + 0.1 * (wx.wetTilt - 0.5), 0, 1);
      run.roomBalance = bal;
      try { run.roomBlend.setBalance(bal, rampS); } catch (e) {}
    }

    // ========================================================================
    // THE FOLLOWER â every 0.5 s, anchored short ramps, shadowed values
    // (never read .value mid-ramp):
    //   gurdyLevel  â the bed breathes with intensity (never zero: the seam)
    //   noiseLevel  â HARD-SLAVED â¤ 0.8 Ã gurdyLevel at every endpoint
    //                 (both ramp linearly over the same half-second, so the
    //                 inequality holds at every instant in between â that
    //                 is the noise ceiling, assertable);
    //                 rides murk Â±20%, intensity, and the bruise's murky
    //                 opening (fading over the gathering)
    //   breathLevel â treeline murmur above intensity 0.06
    //   gritBlend   â intensity Ã gritTilt, â¤ 0.15 in gathering/afterimage,
    //                 hard cap 0.5 at the invocation peak
    // Plus token hygiene (the family housekeeping beat).
    // ========================================================================
    function startFollower() {
      var lane = run.clock.lane("follow");
      function follow(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var wx = wxAt(t);
        var K = 0.34;
        var gTarget = 0.10 + 0.55 * iv;
        var gNext = run.gurdyCur + (gTarget - run.gurdyCur) * K;
        // the bruise opens the evening murkier, fading with the gathering
        var bruiseBump = (st === "gathering") ? run.bruise * 0.15 * (1 - curSceneX()) : 0;
        var nTarget = (0.05 + 0.5 * iv) * (0.8 + 0.4 * wx.murk) * (1 + bruiseBump);
        var nNext = run.noiseCur + (nTarget - run.noiseCur) * K;
        if (nNext > 0.8 * gNext) nNext = 0.8 * gNext; // THE CEILING, hard
        var bTarget = (iv < 0.06) ? 0 : clamp((iv - 0.06) / 0.3, 0, 1) * 0.9;
        var bNext = run.breathCur + (bTarget - run.breathCur) * K;
        var sceneCap = (st === "gathering" || st === "afterimage") ? 0.15 : GRIT_BLEND_CAP;
        var grTarget = Math.min(sceneCap, clamp(iv * (0.5 + 0.5 * wx.gritTilt), 0, GRIT_BLEND_CAP));
        var grNext = run.gritCur + (grTarget - run.gritCur) * K;
        run.gurdyLevel.gain.setValueAtTime(run.gurdyCur, t);
        run.gurdyLevel.gain.linearRampToValueAtTime(gNext, t + 0.5);
        run.noiseLevel.gain.setValueAtTime(run.noiseCur, t);
        run.noiseLevel.gain.linearRampToValueAtTime(nNext, t + 0.5);
        run.breathLevel.gain.setValueAtTime(run.breathCur, t);
        run.breathLevel.gain.linearRampToValueAtTime(bNext, t + 0.5);
        run.gritBlend.gain.setValueAtTime(run.gritCur, t);
        run.gritBlend.gain.linearRampToValueAtTime(grNext, t + 0.5);
        run.gurdyCur = gNext;
        run.noiseCur = nNext;
        run.breathCur = bNext;
        run.gritCur = grNext;
        // token hygiene (pj2-library pattern)
        if (run.tokens.length > 64) {
          var keep = [];
          for (var i = 0; i < run.tokens.length; i++) {
            var tk = run.tokens[i];
            if (tk.endTimeS != null && tk.endTimeS < t - 3) run.budget.release(tk);
            else keep.push(tk);
          }
          run.tokens = keep;
        }
        lane.at(t + 0.5, follow);
      }
      lane.at(run.t0, follow);
    }

    // ========================================================================
    // CONDUCTOR-EVENT WIRING â the seam carries the ghost AND the bruise;
    // each plan draws its rare sink; each scene entry re-aims the rooms,
    // arms the boundary it will end on (arrival darkening / the cut), and
    // starts the scene's own percussion figure (walk / clusters).
    // ========================================================================
    function onSceneEvent(evt) {
      if (!run.perfScenes) return;
      var toIdx = evt.idx + 1;
      var isSeam = toIdx >= run.perfScenes.length;
      var toType = isSeam ? "gathering" : run.perfScenes[toIdx];
      var tB = evt.t + evt.durS;

      if (evt.scene === "processional") {
        // The walk: a barely-gridded period drawn PER SCENE, Â±20% jitter
        // per stroke (the anti-groove law's one concession to pulse).
        run.walkPeriod = run.streams.percWalk.rnd(2.4, 3.4);
        emitEvent({ type: "percussion", mode: "walk", periodS: run.walkPeriod, t: evt.t });
        run.clock.lane("percussion").at(evt.t + run.streams.percWalk.rnd(1.5, 4), walkStroke);
      }
      if (evt.scene === "invocation") {
        // 1â3 accelerating clusters, placed across the scene (a cluster
        // straddling the cut is cut off unfinished â the gesture).
        var rngC = run.streams.cluster;
        var nC = rngC.rint(1, 3);
        for (var i = 0; i < nC; i++) {
          var tC = evt.t + evt.durS * ((i + rngC.rnd(0.2, 0.8)) / nC);
          run.clock.lane("percussion").at(tC, function (tc) {
            if (curSceneType() === "invocation" && !inHush(tc)) fireCluster(tc);
          });
        }
        // THE CUT fires whenever an invocation exists.
        if (run.seaChange && !run.seaChange.done && run.seaChange.atSceneIdx === toIdx) {
          run.seaChange.atCutT = tB; // the sink executes AT the cut
        }
        planCut(tB, evt.tidePos != null ? evt.tidePos : curTidePos());
      }
      if (evt.scene === "afterimage") {
        // The evening's only consonance â the bare {0,5} fifth, used
        // nowhere else. Nothing moves ONTO it: residue, not resolution.
        setPoseIfNew("afterimage", evt.t, "afterimage");
      }
      // Darkening arrivals at boundaries into the rite's active scenes.
      // Never into the afterimage (the cut â or plain dispersal â owns that
      // boundary) and never at the seam (the joint machinery owns seams).
      if (!isSeam && (toType === "processional" || toType === "circling" || toType === "invocation")) {
        scheduleArrival(tB, toType);
      }
    }

    function handleConductorEvent(evt) {
      if (!run || !run.live) return;
      try {
        if (evt.type === "performance" && evt.phase === "end") {
          try { run.pendingGhost = run.motif.extractGhost(); } catch (e) { run.pendingGhost = null; }
        } else if (evt.type === "performance" && evt.phase === "begin") {
          run.perfScenes = evt.scenes ? evt.scenes.slice() : null;
          run.perfN = evt.n;
          // THE BRUISE: last evening's cut severity, one scalar, carried.
          run.bruise = run.lastCutSeverity;
          run.lastCutSeverity = 0;
          run.cut = null;
          emitEvent({ type: "bruise", value: run.bruise, t: evt.t });
          // The proto-drum's gate: a deep cut leaves the next evening
          // warier â the heartbeat gates in bruiseÂ·0.3 earlier.
          run.protoGateT = evt.t + run.streams.protodrum.rnd(6, 14) * (1 - 0.3 * run.bruise);
          // Exit the afterimage pose (it has no markov row â it would hold
          // forever): a bruised evening opens on "sting", else on "coil".
          setPoseIfNew(run.bruise > 0.5 ? "sting" : "coil", evt.t, "opening");
          run.fluteCount = 0;
          run.fluteMax = run.streams.boneflute.rint(2, 3);
          try { run.motif.newPerformance(evt.tidePos); } catch (e) {}
          if (run.pendingGhost) {
            try { run.motif.seedGhost(run.pendingGhost); } catch (e) {}
            run.pendingGhost = null;
          }
          // THE SINK's coin: p â 0.12, "at-the-treeline" evenings only.
          // The profile's p is a function of the tidePos we pass â and we
          // pass the LABEL GATE (1 when the tide stands at the treeline,
          // else 0), so the profile reads p(1) = 0.12 or p(0) = 0. The
          // chance draw happens every evening either way â stream
          // discipline (rng.chance(0) still spends its draw).
          run.seaChange = null;
          try {
            var sceneList = [];
            if (evt.scenes) {
              for (var si = 0; si < evt.scenes.length; si++) {
                sceneList.push({ type: evt.scenes[si] });
              }
            }
            var sc = run.harmony.planSeaChange({
              sceneList: sceneList,
              tidePos: (evt.tideLabel === "at-the-treeline") ? 1 : 0,
            });
            if (sc && isFinite(sc.atSceneIdx) &&
                sc.atSceneIdx >= 1 && evt.scenes && sc.atSceneIdx < evt.scenes.length) {
              run.seaChange = { atSceneIdx: Math.floor(sc.atSceneIdx), target: sc.target, done: false, atCutT: null };
            }
          } catch (e) {}
        } else if (evt.type === "scene") {
          setSceneRoom(evt);
          onSceneEvent(evt);
        }
      } catch (e) { /* structure wiring must never stop the transport */ }
    }

    // ========================================================================
    // PLAY / STOP â the Library's semantics, verbatim: stop fades the bus
    // ~1.5 s, cancels the lanes, settles the budget's books, suspends the
    // ctx; play after stop RESTARTS THE WHOLE SEEDED RUN from evening 1
    // (reproducibility over tide continuity â the documented family choice).
    // ========================================================================
    function ensureCtx() {
      if (ctx) return ctx;
      var AC = (typeof window !== "undefined") ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) throw new Error("PJ2.Sycorax: no AudioContext available");
      ctx = new AC();
      return ctx;
    }

    var LANE_NAMES = [
      "gurdy", "noisebed", "breath", "protodrum", "percussion",
      "chant", "rebec", "waterphone", "boneflute", "ambient",
      "follow", "harmony", "arrival", "cut",
    ];

    function finalize(r) {
      if (!r || r.finalized) return;
      r.finalized = true;
      r.live = false;
      if (r.finalizeId != null) {
        try { r.clock.cancel(r.finalizeId); } catch (e) {}
        r.finalizeId = null;
      }
      try { r.conductor.stop(); } catch (e) {}
      try { r.clock.stop(); } catch (e) {}
      for (var i = 0; i < r.tokens.length; i++) {
        try { r.budget.release(r.tokens[i]); } catch (e) {}
      }
      r.tokens = [];
      try { if (r.bus && r.bus.output && r.bus.output.disconnect) r.bus.output.disconnect(); } catch (e) {}
      try { if (r.roomClose && r.roomClose.output.disconnect) r.roomClose.output.disconnect(); } catch (e) {}
      try { if (r.roomWide && r.roomWide.output.disconnect) r.roomWide.output.disconnect(); } catch (e) {}
      try { if (r.delay && r.delay.output.disconnect) r.delay.output.disconnect(); } catch (e) {}
      try { if (ctx && typeof ctx.suspend === "function") ctx.suspend(); } catch (e) {}
      stopping = false;
    }

    function play() {
      if (playing) return;
      if (run && !run.finalized) finalize(run);
      var c = ensureCtx();
      try { if (typeof c.resume === "function") c.resume(); } catch (e) {}

      // ---- one fresh world per play, all of it derived from the seed ----
      var master = PJ2.Rand.stream(seed);
      var clock = PJ2.Clock.create(c, { tickMs: 25, aheadS: 0.25 });
      var bus = PJ2.Voice.buildBus(c, { volume: masterVol, title: "Prospero's Jukebox v2 â Sycorax" });
      for (var ai = 0; ai < analysers.length; ai++) {
        try { bus.attachAnalyser(analysers[ai]); } catch (e) {}
      }
      var streams = {
        conductor: master.fork("conductor"),
        gurdy: master.fork("gurdy"),
        noisebed: master.fork("noisebed"),
        breath: master.fork("breath"),
        protodrum: master.fork("protodrum"),
        percussion: master.fork("percussion"),
        percWalk: master.fork("percussion:walk"),
        cluster: master.fork("percussion:cluster"),
        chant: master.fork("chant"),
        rebec: master.fork("rebec"),
        waterphone: master.fork("waterphone"),
        boneflute: master.fork("boneflute"),
        ambient: master.fork("ambient"),
        joints: master.fork("joints"),
        air: master.fork("air"),
        motif: master.fork("motif"),
        harmony: master.fork("harmony"),
        harmonyLane: master.fork("harmony:lane"),
        arrivals: master.fork("arrivals"),
        cut: master.fork("cut"),
        // the sound's own dice (Phase 3 discipline): nothing timbral can
        // ever re-roll a note
        weather: master.fork("weather"),
        fx: master.fork("fx"),
        vowels: master.fork("vowels"),
        delaySend: master.fork("delaySend"),
        rooms: master.fork("rooms"),
      };

      if (!PJ2.Motif || !PJ2.Motif.create || !PJ2.Harmony || !PJ2.Harmony.create) {
        throw new Error("PJ2.Sycorax: needs pj2-motif.js and pj2-harmony.js loaded first");
      }
      if (!PJ2.Fx || !PJ2.Fx.delay || !PJ2.Fx.sympathetic || !PJ2.Fx.weather || !PJ2.Fx.roomBlend) {
        throw new Error("PJ2.Sycorax: needs pj2-fx.js loaded (after pj2-voice.js, before pj2-air.js)");
      }

      // TWO ROOMS: close = the fireside stone (dark, 2.6 s); wide = THE
      // CAVERN â v1's decay 4.5 plus a breath (4.8 s), preDelay 0.04, a
      // dark brightness exponent and water-on-stone ripple (~0.08).
      var roomClose = PJ2.Voice.reverb(c, { decayS: 2.6, preDelayS: 0.02, wet: 0.3, brightness: 1.6, ripple: 0.03 });
      var roomWide = PJ2.Voice.reverb(c, { decayS: 4.8, preDelayS: 0.04, wet: 0.35, brightness: 2.1, ripple: { depth: 0.08, hz: 0.4 } });
      roomClose.output.connect(bus.input);
      roomWide.output.connect(bus.input);
      var roomBlend = PJ2.Fx.roomBlend(c, { close: roomClose, wide: roomWide, balance: 0.45 });

      var budget = PJ2.Voice.budget(36).bindClock(clock);
      var field = PJ2.Pitch.field({ tonicHz: 311, mode: "sycorax", tuning: "et" }); // v1's Eb ghost world

      // LAYERS. The landscape sum (gurdy + noise bed + breath-bed + ambient
      // + grit) flows through THE CUTGAIN â the cut's one writer-owned
      // param. The proto-drum (layProto) routes AROUND it (the hush keeps
      // its heart); percussion is silenced by scheduling, not gain, so it
      // sits beside the cut too; melody was never the landscape's to duck.
      // MIXER WIRING HELPERS (see MIX_LAYERS / pj2-library's design note):
      // mAttach registers one gain param under a user layer, tags the node,
      // and stamps design x the user's CURRENT setting as its initial value
      // (stop/play persistence; at the defaults every value is the design
      // value exactly). mSlotWraps builds a melodic voice's per-seat wraps
      // over the shared panner pool.
      var mix = {};
      for (var mki = 0; mki < MIX_LAYERS.length; mki++) mix[MIX_LAYERS[mki].key] = [];
      function mAttach(key, node, design) {
        var v0 = design * mixEff(key);
        node.gain.setValueAtTime(v0, clock.now());
        node._pj2Mix = key;
        mix[key].push({ p: node.gain, design: design, v0: v0, t0: clock.now(), v1: v0, t1: clock.now() });
        return node;
      }
      function mSlotWraps(key, pool) {
        var slots = [], wraps = [];
        for (var swi = 0; swi < pool.pans.length; swi++) {
          var seat = pool.at(pool.pans[swi]);
          var wg = mAttach(key, c.createGain(), 1);
          wg.connect(seat);
          slots.push(seat);
          wraps.push(wg);
        }
        return { slots: slots, wraps: wraps };
      }

      var cutGain = c.createGain();
      cutGain.gain.setValueAtTime(1, clock.now());
      cutGain._pj2Tag = "cutGain"; // harness handle: param inspection
      var gurdyBreath = c.createGain();
      gurdyBreath.gain.setValueAtTime(1, clock.now());
      var gurdyLevel = c.createGain();
      gurdyLevel.gain.setValueAtTime(0.10, clock.now());
      gurdyBreath.connect(gurdyLevel);
      var mixGurdy = mAttach("gurdy", c.createGain(), 1); // the mixer's own stage, beside the follower's
      gurdyLevel.connect(mixGurdy);
      mixGurdy.connect(cutGain);
      var noiseLevel = c.createGain();
      noiseLevel.gain.setValueAtTime(0, clock.now());
      noiseLevel._pj2Tag = "noiseLevel"; // harness handle: per-source peak inspection
      var mixNoise = mAttach("noise", c.createGain(), 1);
      noiseLevel.connect(mixNoise);
      mixNoise.connect(cutGain);
      var breathLevel = c.createGain();
      breathLevel.gain.setValueAtTime(0, clock.now());
      var mixBreath = mAttach("noise", c.createGain(), 1); // the murk is ONE user layer
      breathLevel.connect(mixBreath);
      mixBreath.connect(cutGain);
      var layAmb = mAttach("ambient", c.createGain(), 1);
      layAmb.connect(cutGain);
      var layPerc = mAttach("percussion", c.createGain(), 1);
      var layProto = mAttach("percussion", c.createGain(), 1); // the heartbeat is percussion to the user
      var layMel = c.createGain();
      layMel.gain.setValueAtTime(1, clock.now()); // NOT mixer-owned: the per-seat wraps split the voices upstream
      var layThroat = c.createGain();
      layThroat.gain.setValueAtTime(1, clock.now()); // unowned return — see the MIX_LAYERS note

      // THE GRIT BUS (landscape-only, tagged for graph inspection):
      //   gurdy lowpass ââ gritSendGurdy(0.10) ââ
      //   noiseLevel   ââ gritSendNoise(0.25)  ââ¼â shaper(0.75ÃzankyÅ, 4x)
      //   trompette    ââ gritSendTromp(0.10,  â   â makeup(0.4, DOWN)
      //                    pulsed â¤ +0.1)           â gritBlend(â¤ 0.5) â cutGain
      //
      // SEND-LEVEL ENERGY MATH (the rendered-audio soak's second lesson â
      // the k=20 curve saturates hard above ~0.05 input, and a RAILED
      // sustained buzz louder than the drone is "feedback noise" to any
      // honest ear): worst sustained gurdy into the shaper = cluster
      // ~0.14 Ã 2 (cycle overlap) Ã 0.10 send = 0.028 â curve â 0.38 â
      // Ã 0.4 makeup Ã blend â¤ 0.5 â â¤ 0.075 at the bus â grit sits WITH
      // the 0.06â0.13 drone bed, textural, never on top of it. The
      // trompette pulse (0.02 env Ã â¤0.2 send = 0.004) still bites: the
      // curve's small-signal slope is ~21Ã, which is the whole point.
      var gritShaper = c.createWaveShaper();
      try { gritShaper.curve = buildGritCurve(GRIT_AMOUNT); gritShaper.oversample = "4x"; } catch (eG) {}
      var gritMakeup = c.createGain();
      gritMakeup.gain.setValueAtTime(GRIT_MAKEUP, clock.now());
      gritMakeup._pj2Tag = "gritMakeup";
      var gritBlend = c.createGain();
      gritBlend.gain.setValueAtTime(0, clock.now());
      gritBlend._pj2Tag = "gritBlend";
      gritShaper.connect(gritMakeup);
      gritMakeup.connect(gritBlend);
      gritBlend.connect(cutGain);
      // The gurdy-family grit shares (bed + trompette) converge through ONE
      // mixer stage before the shaper — gritSendTromp's own param stays the
      // drum pulses' (one writer per param, ever), so the gurdy layer's
      // scaling gets its own node instead of a share of a pulsed send.
      var mixGritGurdy = mAttach("gurdy", c.createGain(), 1);
      mixGritGurdy.connect(gritShaper);
      var gritSendGurdy = c.createGain();
      gritSendGurdy.gain.setValueAtTime(0.10, clock.now());
      gritSendGurdy._pj2Grit = "gurdy";
      gritSendGurdy.connect(mixGritGurdy);
      var gritSendNoise = mAttach("noise", c.createGain(), 0.25); // static send: clean mixer reuse
      gritSendNoise._pj2Grit = "noisebed";
      gritSendNoise.connect(gritShaper);
      var gritSendTromp = c.createGain();
      gritSendTromp.gain.setValueAtTime(TROMP_BASE, clock.now());
      gritSendTromp._pj2Grit = "trompette";
      gritSendTromp.connect(mixGritGurdy);
      noiseLevel.connect(gritSendNoise); // the bed's grit share (partial)

      roomBlend.register("landscape", cutGain, 0.08);
      roomBlend.register("percussion", layPerc, -0.25); // a drum is HERE
      roomBlend.register("proto", layProto, -0.15);
      roomBlend.register("melody", layMel, -0.05);
      roomBlend.register("throat", layThroat, 0.2);     // the throat is deep

      var poolMel = PJ2.Voice.pannerPool(c, layMel, 3);
      var mixWraps = {
        chant: mSlotWraps("chant", poolMel),
        rebec: mSlotWraps("rebec", poolMel),
        waterphone: mSlotWraps("waterphone", poolMel),
        boneflute: mSlotWraps("boneflute", poolMel),
      };

      // THE WEATHER â five channels (murk / breath / gapMul / wetTilt /
      // gritTilt), primes 120â600 s, all draws at build, pure math after.
      var weather = PJ2.Fx.weather(streams.weather, WEATHER_SYCORAX);

      // THE SEASICK DELAY â the clearing answers: 0.62 s, dark (damp 900),
      // feedback 0.30, drift 0.05 Hz at depth 0.008 â NEAR THE WOBBLE CAP,
      // audibly seasick by design (all inside pj2-fx's hard caps: fb â¤
      // 0.55, wet â¤ 0.4, depth â¤ 0.01). Return feeds the CAVERN's send.
      var delay = PJ2.Fx.delay(c, {
        timeS: 0.62, feedback: 0.30, damp: 900,
        driftHz: 0.05, driftDepth: 0.008, wet: 0.22,
        rng: streams.fx,
      });
      delay.output.connect(roomWide.send);
      // Per-voice sends are mixer-owned (each voice's user layer scales its
      // own echo feed; a muted cantor stops being answered by the clearing).
      var delaySendWater = mAttach("waterphone", c.createGain(), 0.5);
      delaySendWater.connect(delay.send);
      var delaySendChant = mAttach("chant", c.createGain(), 0.4);
      delaySendChant.connect(delay.send);
      var delaySendRebec = mAttach("rebec", c.createGain(), 0.35);
      delaySendRebec.connect(delay.send);

      // THE CAVERN'S THROAT â Fx.sympathetic as a dark resonance bank: 4
      // combs at degrees {0, 1, 5, 0+oct}, lowpass 1200 (vs the Library
      // halo's 3000), retuned ONLY after the rare sink, at the cut.
      //
      // ENERGY LAW (learned from a rendered-audio soak, the hard way — the
      // first build fed this bank from the STANDING gurdy drone, and the
      // render showed a ×3-per-quarter-second runaway saturating the master
      // inside a second and NaN-silencing the whole graph at t ≈ 3.2 s.
      // Half of that was pj2-fx's since-fixed dB-Q resonance bug — WebAudio
      // reads lowpass/highpass .Q IN DECIBELS, so its old "Q 0.5" loop
      // filters PEAKED near cutoff and pushed the comb's true loop gain
      // past 1; the loop lowpass is now pinned at −6 dB and the loop gain
      // honestly equals fb. The other half is OURS to hold forever):
      //   1. A COMB AT fb 0.93 IS A ×14 AMPLIFIER FOR SUSTAINED INPUT
      //      (steady state 1/(1−fb) ≈ 14.3). Stable, but a standing drone
      //      parked on it would sit at fourteen times itself all evening.
      //      So: EXCITE TRANSIENTLY, NEVER FROM THE STANDING DRONE. The
      //      feeds are PERCUSSION STRIKES (true transients — a strike is
      //      what wakes a cavern) and the WATERPHONE (episodic notes),
      //      never the gurdy bed. Contribution math, worst case (charging
      //      the transients the full steady-state ×14.3 they never reach):
      //        waterphone 0.055 peak × send 0.10 × 14.3 = 0.079 in-bank
      //          × level 0.04 ≈ 0.0031 out — far-field, under the breath-bed;
      //        frame-drum strike 0.045 × send 0.06 × 14.3 = 0.039 in-bank
      //          × 0.04 ≈ 0.0015 out, ringing T60 ≈ 95 trips ≈ 0.6 s —
      //          the cavern answering the drum, then letting it go.
      //   2. DC-BLOCK THE SEND (highpass 55 Hz, Q −6 dB) — a comb loop
      //      integrates any DC lean into a standing offset.
      //   3. HARD CEILING AFTER THE BANK — a normalized tanh (amount 2.5)
      //      between the bank and its layer caps the throat's worst
      //      possible contribution at |1| × the 0.04 level even if some
      //      future browser regresses the loop math. Insurance, not tone:
      //      at whisper level the curve is within 0.1% of identity.
      var throat = PJ2.Fx.sympathetic(c, {
        nStrings: 4, freqs: throatFreqs(field),
        level: 0.04, feedback: 0.93, damp: 1200,
      });
      var throatDC = c.createBiquadFilter();
      throatDC.type = "highpass";
      throatDC.frequency.setValueAtTime(55, clock.now());
      throatDC.Q.setValueAtTime(-6, clock.now()); // dB — over-damped, flat
      throatDC.connect(throat.input);
      // Mixer-owned under their EXCITERS (the throat's return stays free):
      // a muted strike must not keep waking the cavern.
      var throatSendWater = mAttach("waterphone", c.createGain(), 0.10);
      throatSendWater.connect(throatDC);
      var throatSendPerc = mAttach("percussion", c.createGain(), 0.06);
      throatSendPerc.connect(throatDC);
      var throatCeil = c.createWaveShaper();
      try { throatCeil.curve = buildSoftCeil(2.5); throatCeil.oversample = "2x"; } catch (eTc) {}
      throat.output.connect(throatCeil);
      throatCeil.connect(layThroat);

      // THE BRAINS â harmony in POSE MODE (root pinned to i forever, the
      // five rotation poses + the setPose-only afterimage fifth, keening
      // resolution pinned to [1], organum consort with the authored
      // doubling table, anti-cadence hard-off, the sink as the only
      // reachable sea change, treeline-gated); motif with the four voice
      // characters and the responsorial ledger policy.
      var harmony = PJ2.Harmony.create({
        rng: streams.harmony,
        field: field,
        dramaturgyName: "sycorax",
        profile: {
          poses: { table: POSE_TABLE, markov: POSE_MARKOV, initial: "coil" },
          resolutionDegs: [1],   // THE KEENING LAW â every ending pulled to the flat second
          cadences: {},          // anti-cadence hard-off: zero events, zero draws
          consort: { mode: "organum", doubling: ORGANUM_DOUBLING },
          seaChange: {
            // p receives the LABEL GATE the track passes at plan time
            // (1 = at-the-treeline, 0 = anywhere else): the sink is rare
            // and only when the menace stands closest.
            p: function (tp) { return tp > 0.5 ? 0.12 : 0; },
            placementWeights: [[{ from: "invocation", to: "afterimage" }, 1]],
            targets: [[{ kind: "ratio", ratio: Math.pow(2, -1 / 12), name: "sink" }, 1]],
          },
        },
      });
      var motif = PJ2.Motif.create({
        rng: streams.motif,
        field: field,
        harmony: harmony,
        voices: {
          chant: { table: CHANT_MARKOV, weights: VOICE_WEIGHTS.chant, register: -1, walkStart: 5 },
          rebec: { table: REBEC_MARKOV, weights: VOICE_WEIGHTS.rebec, register: 0, walkStart: 0 },
          waterphone: { weights: VOICE_WEIGHTS.waterphone, register: 0 },
          boneflute: { weights: VOICE_WEIGHTS.boneflute, register: 1 },
        },
        policy: {
          // Responsorial, not conversational: the cantor posts (postP by
          // ALIASED scene â processional and circling are both "chapter"),
          // imitate-heavy, and the answers arrive LATE (18â40 s deadlines)
          // and near-verbatim, like a congregation across a clearing.
          postKinds: [["imitate", 6], ["invert", 2], ["develop", 2]],
          postDeadlineS: [18, 40],
          postP: { "settling": 0.08, "chapter": 0.3, "seizure": 0, "reverie": 0, "candle-out": 0.05 },
          seedVoices: { theme: "chant", subs: ["rebec"] },
        },
      });

      run = {
        live: true, finalized: false, finalizeId: null,
        clock: clock, bus: bus, budget: budget, field: field,
        poolMel: poolMel,
        streams: streams, tokens: [],
        harmony: harmony, motif: motif,
        perfScenes: null, perfN: 0,
        pendingGhost: null,
        heldUtterance: { chant: null, rebec: null },
        // levels (follower shadows â telemetry + the assertable ceiling)
        cutGain: cutGain, gurdyBreath: gurdyBreath,
        gurdyLevel: gurdyLevel, noiseLevel: noiseLevel, breathLevel: breathLevel,
        gurdyCur: 0.10, noiseCur: 0, breathCur: 0, gritCur: 0,
        layAmb: layAmb, layPerc: layPerc, layProto: layProto,
        layMel: layMel, layThroat: layThroat,
        mix: mix, mixWraps: mixWraps,
        // grit
        gritShaper: gritShaper, gritMakeup: gritMakeup, gritBlend: gritBlend,
        gritSendGurdy: gritSendGurdy, gritSendNoise: gritSendNoise,
        gritSendTromp: gritSendTromp,
        lastTrompPulseT: -10,
        // fx
        roomClose: roomClose, roomWide: roomWide, roomBlend: roomBlend,
        roomBalance: 0.45,
        weather: weather,
        delay: delay, delaySendWater: delaySendWater,
        delaySendChant: delaySendChant, delaySendRebec: delaySendRebec,
        throat: throat, throatSendWater: throatSendWater, throatSendPerc: throatSendPerc,
        // the rite's memory + machinery state
        bruise: 0, lastCutSeverity: 0,
        cut: null, seaChange: null,
        darkenUntil: -1, forceSubUntil: -1,
        protoGateT: 0, hbIntensity: 0.85,
        walkPeriod: 2.8, emberCenter: 600,
        fluteCount: 0, fluteMax: 3,
        vowelIdx: 0,
        t0: clock.now() + 0.08,
        conductor: null, air: null, airLimit: null,
      };
      run.vowelIdx = streams.vowels.rint(0, CHANT_VOWEL_POOL.length - 1);

      run.airLimit = function () {
        if (run.conductor && typeof run.conductor.airLimit === "function") {
          try { return run.conductor.airLimit(); } catch (e) {}
        }
        var sc = dram.scenes[curSceneType()];
        return sc ? sc.airLimit : 1;
      };
      var airOverlapChance = function () {
        if (run.conductor && typeof run.conductor.overlapChance === "function") {
          try { return run.conductor.overlapChance(); } catch (e) {}
        }
        var sc = dram.scenes[curSceneType()];
        return sc ? sc.overlapChance : 0.05;
      };

      run.air = PJ2.Air.create({
        clock: clock,
        rng: streams.air,
        limit: run.airLimit,
        overlapChance: airOverlapChance,
      });

      var jointTools = { ctx: c, out: layAmb, rng: streams.joints, field: field };

      run.conductor = PJ2.Conductor.create({
        clock: clock,
        rng: streams.conductor,
        dramaturgy: dram,
        onEvent: function (evt) {
          handleConductorEvent(evt);
          emitEvent(evt);
        },
        jointTools: jointTools,
        tools: jointTools,
        air: run.air,
        seed: seed,
      });

      playing = true;
      stopping = false;

      clock.start();
      run.conductor.start();
      startFollower();
      startHarmonyLane();
      startGurdy();
      startNoiseBed();
      startBreathBed();
      startProtoDrum();
      startPercussion();
      startChant();
      startRebec();
      startWaterphone();
      startBoneflute();
      startAmbient();

      emitEvent({ type: "engine", state: "play", seed: seed, t: clock.now() });
    }

    function stop() {
      if (!playing || !run) return;
      playing = false;
      stopping = true;
      var r = run;
      var t = r.clock.now();
      emitEvent({ type: "engine", state: "stop", t: t });
      try { r.conductor.stop(); } catch (e) {}
      for (var i = 0; i < LANE_NAMES.length; i++) {
        try { r.clock.lane(LANE_NAMES[i]).cancelAll(); } catch (e) {}
      }
      try { r.bus.fadeTo(0, 1.5); } catch (e) {}
      r.finalizeId = r.clock.at(t + 1.7, function () {
        r.finalizeId = null;
        finalize(r);
      });
    }

    // ========================================================================
    // THE FACADE
    // ========================================================================
    return {
      play: play,
      stop: stop,
      isPlaying: function () { return playing; },

      setMasterVolume: function (v) {
        masterVol = clamp(+v || 0, 0, 1);
        if (run && run.live && run.bus) {
          try { run.bus.fadeTo(masterVol, 0.08); } catch (e) {}
        }
      },

      // ---- the per-layer mixer (MIX_LAYERS; uniform across the tracks) ----
      // Gain-side only: none of these consume randomness or move events —
      // a run with mixer calls emits the identical note/event streams.
      getLayers: function () {
        var out = [];
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          out.push({ key: MIX_LAYERS[i].key, label: MIX_LAYERS[i].label, kind: MIX_LAYERS[i].kind });
        }
        return out;
      },
      // v multiplies the layer's design gain (1 = as-composed). Persists
      // across performances and stop/play; a muted layer keeps the setting
      // and hears it again on unmute.
      setLayerVolume: function (key, v) {
        var st = mixState[key];
        if (!st) return;
        st.volume = clamp(+v || 0, 0, 1);
        if (!st.muted) mixApply(key, MIX_VOL_S);
      },
      getLayerVolumes: function () {
        var out = {};
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          out[MIX_LAYERS[i].key] = mixState[MIX_LAYERS[i].key].volume;
        }
        return out;
      },
      // toggleLayer(key)      — flip; toggleLayer(key, on) — set (on=true
      // means AUDIBLE). Returns the muted-state boolean. Mute is a ~0.3s
      // ramp to true silence; unmute restores design x volume the same way.
      toggleLayer: function (key, on) {
        var st = mixState[key];
        if (!st) return false;
        var muted = (on == null) ? !st.muted : !on;
        if (muted !== st.muted) {
          st.muted = muted;
          mixApply(key, MIX_MUTE_S);
        }
        return st.muted;
      },

      getInfo: function () {
        var info = {};
        if (run && run.conductor) {
          try {
            var ci = run.conductor.info();
            for (var k in ci) info[k] = ci[k];
          } catch (e) {}
          try { info.airHolders = run.air.holders(); } catch (e) {}
          try { info.airOverlaps = run.air.overlapCount(); } catch (e) {}
          try { info.budget = run.budget.stats(); } catch (e) {}
          try {
            var cur = run.harmony.current();
            info.pose = cur ? cur.name : null;
            info.rootDeg = cur ? cur.rootDeg : null;
          } catch (e) {}
          try { info.motif = run.motif.stats(); } catch (e) {}
          try { info.weather = wxAt(run.clock.now()); } catch (e) {}
          try { info.roomBalance = (run.roomBlend && run.roomBlend.balance) ? run.roomBlend.balance() : run.roomBalance; } catch (e) {}
          info.bruise = run.bruise;
          info.levels = {
            gurdy: run.gurdyCur, noise: run.noiseCur,
            breath: run.breathCur, grit: run.gritCur,
            gritMakeup: GRIT_MAKEUP,
          };
          info.cut = run.cut ? {
            planned: true, fired: !!run.cut.fired,
            active: run.cut.fired && run.clock.now() >= run.cut.tB && run.clock.now() <= run.cut.end + run.cut.retS,
            severity: run.cut.sev,
          } : { planned: false, fired: false, active: false, severity: 0 };
          info.percussion = {
            mode: (info.sceneType === "processional") ? "walk"
              : (info.sceneType === "invocation") ? "clusters"
              : (info.sceneType === "gathering" || info.sceneType === "afterimage") ? "heartbeat"
              : "loose",
            walkPeriodS: run.walkPeriod,
          };
          info.sink = run.seaChange ? { planned: true, done: !!run.seaChange.done } : { planned: false, done: false };
          info.tonicHz = run.field.tonicHz;
        }
        // The mixer snapshot rides along even between runs — the UI's
        // sliders are facade state, not run state.
        info.layers = {};
        for (var li = 0; li < MIX_LAYERS.length; li++) {
          var lk = MIX_LAYERS[li].key;
          info.layers[lk] = { volume: mixState[lk].volume, muted: mixState[lk].muted };
        }
        info.playing = playing;
        info.seed = seed;
        return info;
      },

      // Multicast (family pattern). Notes: {voice, freq|null, t, durS,
      // deg?, oct?, kind?, mode?, velocity?, motif?, gen?, phraseKind?,
      // final?}. Events: conductor events + {type:"air"...} +
      // {type:"joint-gesture"...} + {type:"engine"...} + the rite's own
      // narration: pose / arrival / organum / percussion / cut /
      // cut-return / seachange (the sink) / ghost / bruise /
      // develop / answer.
      setNoteListener: function (fn) { return addListener(noteLs, fn); },
      setEventListener: function (fn) { return addListener(eventLs, fn); },

      reseed: function (s) {
        seed = (+s) >>> 0;
        var wasOn = playing || stopping;
        if (run && !run.finalized) {
          playing = false;
          finalize(run);
        }
        emitEvent({ type: "engine", state: "reseed", seed: seed });
        if (wasOn) play();
      },

      attachAnalyser: function (analyser) {
        if (!analyser) return;
        analysers.push(analyser);
        if (run && run.live && run.bus) {
          try { run.bus.attachAnalyser(analyser); } catch (e) {}
        }
      },
    };
  }

  window.PJ2.Sycorax = {
    create: create,
    // Authored data exposed read-only-by-convention for the harness: the
    // pose table (every observed pose must be one of these), the organum
    // doubling table (every observed interval must match it), and the
    // grit constants (the caps the check run inspects).
    POSES: POSE_TABLE,
    ORGANUM_DOUBLING: ORGANUM_DOUBLING,
    GRIT: { amount: GRIT_AMOUNT, makeup: GRIT_MAKEUP, blendCap: GRIT_BLEND_CAP },
  };
})();
