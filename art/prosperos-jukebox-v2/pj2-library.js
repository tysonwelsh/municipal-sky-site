// ============================================================================
// Prospero's Jukebox v2 — pj2-library.js
// PJ2.Library: the Library track + the engine facade.
// Phase 1 gave this file its form (dramaturgy, THE AIR, thin voices); Phase 2
// swapped the melodic BRAINS in place (PJ2.Motif composes what the voices
// say, PJ2.Harmony decides what ground they stand on); Phase 3 swapped the
// BODIES: every timbre is now a faithful port of its v1 ancestor
// (prosperos-jukebox-audio.js), and the room itself learned to breathe —
// PJ2.Fx gives us the far-wall delay, the sympathetic-string halo, the
// continuous weather field, and the two-room blend. NOTHING compositional
// changed in Phase 3: same brains, same call patterns, same degrees, same
// phrase timing logic, same events. A listener of the note/event streams
// hears the identical evening (modulo the one sanctioned exception below);
// only the air it travels through is new.
//
// PHASE 3, in one paragraph: the pluck is v1's harpsichord again (looped
// noise burst through a freq-tracked lowpass that dulls as the string dies,
// octave sine sparkle — libPluckNote ~1380); the music box got its velocity
// law and 3rd-harmonic shimmer back (~1915); the hum — bed, singer, AND
// cadence consort — speaks through v1's full formant body (one sawtooth,
// dual F1/F2 vowel bandpasses walked by a neighbor-Markov mouth, slow-noise
// jitter, sine vibrato, slow-noise shimmer — ~2133); the drone recovered
// its shared tremolo bus (~1279). Around them, the four Phase 3 firsts:
//   - ONE far-wall delay (music box always, pluck p~0.3 per phrase). "The
//     far wall answers", never "echo effect" — wet 0.18, feedback 0.22.
//   - A six-string sympathetic halo excited only by the pluck's small send,
//     retuned ONLY at the first scene boundary after a sea change, breathing
//     with weather.haloLevel, guttering to zero through candle-out.
//   - The weather field, read at schedule time: brightness → filter cutoffs
//     and harmonic mix; breath → vowel openness, vibrato, tremolo depth;
//     gapMul → phrase/ambient gap scaling (±15% HARD max — the one place
//     weather may touch event TIMES, seeded and deterministic like all the
//     rest); wetTilt → room tilt and the rain/thunder gate; haloLevel as
//     above. It replaces the per-phrase parameter dice the bodies used to
//     roll (vowel-from-tide, fixed cutoffs) — parameters now drift like
//     weather instead of jumping at phrase edges.
//   - Two rooms (close parlor decayS 2.0 / wide hall decayS 4.8, darker),
//     every layer registered with Fx.roomBlend, scene-set balances
//     (settling/candle-out 0.15, chapters 0.35, seizure 0.4, reverie 0.65,
//     +0.08 for the rest of an evening after a sea change) ramped 12–20s,
//     wetTilt nudging ±0.05.
// The ambient pool grew the v1 night sounds (owls ~2568, distant thunder
// ~3863, crickets ~5577) plus NEW rain-on-glass — weather-gated,
// tide-flavored, and at the SAME overall density as before (the roster
// grew; the room did not get busier — the gap law is unchanged apart from
// gapMul's ±15%).
//
// GAIN STAGING (Phase 3 pass — worst-case *scheduled* peaks, the family
// ledger; verified by mock-param inspection in the Phase 3 check run):
//
//   drone bed      2 pads x 0.07 + sub 0.025 = 0.165 -> x tremolo (<= 1)
//                  x droneBreath (<= 1) x droneLevel (<= 0.48) ~ 0.079;
//                  cycle overlap doubles it briefly ~ 0.158; + cadence pads
//                  2 x 0.012 or a sea-change bloom 2 x 0.05   -> ~ 0.21 worst
//   melody         pluck 0.055 + sparkle <= 0.012, box <= 0.030 + shimmer
//                  <= 0.009; two speakers + a rare third (limit+1)
//                                                             -> ~ 0.16 worst
//   hum            bed swells overlap x2 (env 0.026, post-formant energy
//                  ~ x0.3) + singer 0.032 + consort 3 x 0.018 x 0.3 pre
//                                                             -> ~ 0.09 worst
//   ambient        loudest one-shot (thunder: sub 0.05 + boom 0.05 x 0.4
//                  pre + rumble 0.024)                        -> ~ 0.10 worst
//   halo           levelGain <= 0.07 on a whisper-fed ring    -> ~ 0.02
//   far-wall delay wet 0.18 x sends (0.5 box / 0.35 pluck)    -> ~ 0.02
//   ------------------------------------------------------------------
//   sum into the rooms ~ 0.60 absolute worst; the equal-power room split
//   conserves power and each room is dry 1.0 + wet ~0.3 -> ~ 0.78 at bus
//   input; x masterGain default 0.6 x saturator small-signal gain ~1.66
//   (pj2-voice lesson #1) ~ 0.78 into the limiter — under the ~0.89
//   (~ -1 dB) master ceiling with the glue compressor still idling. The
//   MEASURED worst case (time-varying mock-param inspection, 2600 s run,
//   pj2-phase3-check.js): 0.360 at the bus input -> 0.298 into the limiter
//   (~ -10.5 dB) at volume 0.5, ~ -8.9 dB at the default 0.6 — concurrence
//   is rarer than this ledger's pessimism, exactly as it should be.
//
// This file is four things braided together:
//
//   1. THE FACADE — what a page drives: play/stop/reseed, listeners, volume,
//      analyser taps, telemetry. It owns the one lazy AudioContext and builds
//      a fresh "run" (bus, room, field, streams, brains, conductor, air,
//      voices) on every play.
//
//   2. THE LIBRARY DRAMATURGY — the data object handed to PJ2.Conductor:
//      the evening's plan (settling → chapters → maybe a seizure → reverie →
//      candle-out), one intensity curve per scene type, air limits and
//      overlap chances, and the joint vocabulary. The owner's notes are
//      binding here: this is WEATHER, not theater. Intensity lives in a
//      compressed band (floor 0.04 — the drone always breathes; ceiling
//      0.65 — the seizure is concentration, not climax). Joints are at most
//      ONE quiet gesture, and about a third of boundaries pass as nothing
//      at all.
//
//   3. FIVE VOICES — v1's bodies (Phase 3), Phase 2's minds. The pluck and
//      the musicbox speak in PJ2.Motif phrases (fresh / develop / recall /
//      answer / ghost — abstract beats mapped to seconds by each voice's own
//      pace × intensity, endings already resolved onto chord tones by the
//      motif engine). The drone reads PJ2.Harmony's current chord for its
//      dyad, one chord per cycle, never retuning a sounding partial. The hum
//      keeps its DUAL ROLE: landscape bed plus an occasional third melodic
//      speaker that claims the air and sings a motif line — bed, singer and
//      cadence consort all share the one formant body now.
//
//   4. THE PHASE 2 MACHINERY — a harmony lane stepping the chord grammar
//      every 14–30s (scene- and intensity-scaled, slower at the evening's
//      edges); cadences drawn for ~60–75% of scene boundaries (two soft
//      chords voiced by drone + hum consort, the arrival landing exactly on
//      the boundary t, level lift ≤ 1.5 dB, no new attack transients); the
//      sea change (~half of evenings, tide-nudged: one modulation executed
//      at an exact scene boundary, the drone blooming the new key under the
//      old key's fading tail); and the ghost (a quiet fragment of the
//      previous evening's most-developed motif, restated by the pluck in the
//      next settling).
//
// Discipline inherited from the whole family:
//   - Every pitched note asks the PitchField (dorian, tonic 262 — v1's
//     Library) via degFreq AT THE MOMENT IT SCHEDULES THE NOTE; nothing
//     invents a frequency and nothing caches one across callbacks. That
//     no-cached-Hz rule is what lets the sea change land mid-evening
//     without a single retuned partial: notes scheduled before the
//     modulation belong to the old world (kolob's straddle lesson), notes
//     scheduled after read the mutated field, and the harness asserts 100%
//     snap-identity era by era.
//   - Every gain envelope goes through PJ2.Voice.env/adsr or an explicitly
//     anchored ramp pair — click-safe by construction.
//   - Everything musical draws from forked seeded streams; Math.random only
//     inside noise/IR texture (the zankyo rule).
//   - PHASE 3 STREAM PURITY: the sound rework may not perturb the musical
//     streams. Every new draw lives on a NEW fork ("weather", "vowels",
//     "fx", "delaySend", "rooms") — forks are label-hashed off the birth
//     seed, so adding them re-rolls nothing. Weather is pure math after
//     build. The ONE sanctioned stream effect is gapMul (event times move
//     within ±15% on gaps, deterministically); with weather held neutral
//     the Phase 3 melodic/drone streams are byte-identical to Phase 2's —
//     the check run proves it. (Two sanctioned re-rolls beyond that: the
//     AMBIENT stream, necessarily — the pool has a new roster — and the
//     JOINTS stream's page-band draws, because Phase 2's ambient page-turn
//     leaked draws from the joints fork; the ambient pool now spends its
//     OWN draws for pages, so from Phase 3 on the joint vocabulary is
//     finally independent of how busy the room is.)
//   - Melodic voices claim THE AIR before speaking and the polyphony budget
//     before each note; refusal means silence this cycle, never a throw.
//   - Landscape voices (drone, hum, ambient, joints) never touch the air.
//   - When in doubt, quieter. This family's documented failure mode is hot
//     buses; every peak below was chosen a notch under where it "worked".
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  // --------------------------------------------------------------------------
  // The intensity band (owner's aesthetic constants, binding). Floor is not
  // zero because the drone never truly sleeps; ceiling is well under 1 because
  // the loudest this piece ever gets is "the reader leaned closer".
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
  // THE ALCHEMICAL DISPLAY LABELS — the ONE shared vocabulary between the
  // engine and the graphics layer (PLAN-GRAPHICS.md §1a: the codex skin
  // "renders those labels rather than inventing its own", keying its emblems
  // by these exact strings — change a string here and the margin re-skins
  // for free). Exposed as PJ2.Library.LABELS.
  //
  // These are DISPLAY LABELS ONLY. The stable internal keys ("settling",
  // "chapter", "seachange", "plagal", …) remain the identity everywhere —
  // every event's type/scene/kind field, every dramaturgy table, every
  // harness assertion. The labels ride along as an extra `label` field on
  // emitted events (and getInfo().sceneLabel); attaching them draws no
  // randomness and moves no times, so the note/event streams are
  // byte-identical to the unlabeled engine modulo the new fields (the
  // label-gate capture in the Phase 3 verification proves it).
  //
  // The mapping (owner-approved): the seven operations over the evening —
  //   settling    = Calcinatio   (the burning-down to ash: arrival, dust)
  //   chapter     = Solutio / Separatio / Conjunctio, IN CHAPTER ORDER —
  //                 a 4th chapter (plans draw up to four) CYCLES back to
  //                 Solutio (PLAN-GRAPHICS' recommended handling; cycling
  //                 keeps the emblem set at the seven operations, where a
  //                 Sublimatio would demand an eighth woodcut)
  //   seizure     = Fermentatio  (the working — concentration, not climax)
  //   reverie     = Distillatio  (what rises when the heat comes off)
  //   candle-out  = Coagulatio   (the fixing; the evening sets)
  // Event labels:
  //   seachange   = Transmutatio (the one true change of substance)
  //   ghost       = Caput Mortuum (the residue left in the vessel from the
  //                 previous working — a half-remembered head, exactly)
  // Cadence kinds (tasteful Latin, one word each, in the operations' register):
  //   plagal         = Ablutio    (the washing — the gentle IV->i descent)
  //   half           = Suspensio  (left hanging on v, unresolved)
  //   soft-authentic = Resolutio  (the modal v->i arrival)
  // Tide labels stay the human weather-words ("candlelit"…"late-night"):
  // they are already display strings the volvelle renders, and renaming
  // them would mutate an EXISTING event field, which the stream gate
  // forbids.
  // --------------------------------------------------------------------------
  var LABELS = {
    scenes: {
      "settling": "Calcinatio",
      "chapter": ["Solutio", "Separatio", "Conjunctio"], // by chapter ordinal, cycling
      "seizure": "Fermentatio",
      "reverie": "Distillatio",
      "candle-out": "Coagulatio",
    },
    events: {
      "seachange": "Transmutatio",
      "ghost": "Caput Mortuum",
      "coagula": "Solve et Coagula",  // the candle-out's one whole-theme settling
    },
    cadences: {
      "plagal": "Ablutio",
      "half": "Suspensio",
      "soft-authentic": "Resolutio",
    },
  };

  // Scene label lookup. Chapters need their ordinal within the CURRENT
  // performance's plan (sceneTypes = the begin event's scene-type list) so
  // Solutio/Separatio/Conjunctio land in chapter order; everything else is
  // a straight string. Pure function of existing data — no draws, no state.
  function sceneLabelFor(type, idx, sceneTypes) {
    var entry = LABELS.scenes[type];
    if (entry == null) return null;
    if (typeof entry === "string") return entry;
    var ord = 0;
    if (sceneTypes && typeof idx === "number") {
      for (var i = 0; i < idx && i < sceneTypes.length; i++) {
        if (sceneTypes[i] === type) ord++;
      }
    }
    return entry[ord % entry.length];
  }

  // --------------------------------------------------------------------------
  // THE MIXER SURFACE — the jukebox UI's per-layer volume/mute/rate contract
  // (getLayers / setLayerVolume / getLayerVolumes / toggleLayer /
  // setLayerRate / getLayerRates, uniform across the three tracks). The gain
  // side owns one small set of user gain nodes (tagged _pj2Mix, the _pj2Tag
  // convention) inserted into — or cleanly reused from — each layer's
  // existing chain, draws NO randomness, and never shares a param with
  // another writer (the followers keep droneLevel/humLevel; the mixer gets
  // its own stage beside them). The RATE side only re-paces the layer's own
  // clock lanes (lane.rate, spec §3) — user-driven wall-clock input, like
  // volume; it never touches the seeded streams. With every layer at volume
  // 1 unmuted and rate 1, every mixer gain sits at its design value and no
  // lane is ever rescaled, so the engine stays bit-identical to the unmixed
  // one.
  //
  // Layer -> params (design values in parens):
  //   drone       mixDrone (1) inserted droneLevel -> rooms
  //   hum         mixHumBed (1) inserted humLevel -> rooms, + layHum (1)
  //               (bed, singer AND cadence consort — one reader's voice)
  //   harpsichord per-seat wraps (1) ahead of the shared panner pool, +
  //               delaySendPluck (.35) + haloSend (.12) — mute the pluck and
  //               the far wall and the strings stop hearing it too
  //   musicbox    per-seat wraps (1) + delaySendBox (.5)
  //   ambient     layAmb (1) — one-shots and the joint gestures alike
  //   halo        layHalo (1) — the RETURN side; the send follows its exciter
  //
  // The pool problem, solved without restructuring: both melodic voices
  // share the 3-seat panner pool, so a single post-pool gain can't split
  // them. Instead each voice gets one whisper-thin wrap gain per SEAT
  // (3 nodes, constant forever), inserted between the note's gain and the
  // seat it chose — the seat quantization, the pans, the pool node count
  // and the note graphs are all untouched.
  // --------------------------------------------------------------------------
  var MIX_LAYERS = [
    { key: "drone",       label: "Drone",       kind: "landscape" },
    { key: "hum",         label: "Hum",         kind: "landscape" },
    { key: "harpsichord", label: "Harpsichord", kind: "melodic" },
    { key: "musicbox",    label: "Music Box",   kind: "melodic" },
    { key: "ambient",     label: "Ambient",     kind: "ambient" },
    { key: "halo",        label: "Halo",        kind: "fx" },
  ];
  var MIX_MUTE_S = 0.3;  // mute/unmute ramp — click-safe, unhurried
  var MIX_VOL_S = 0.08;  // volume moves ride the master-volume ramp length

  // Layer -> clock lanes the RATE control re-paces (the mixing desk). Only
  // the layer's own voice lanes; the form lanes (harmony, cadence,
  // seachange, follow) carry structure, not voice, and are never scaled.
  // halo has no lane (fx return layer) — it gets no rate slider.
  var MIX_RATE_LANES = {
    drone: ["drone"], hum: ["hum", "humSing"], harpsichord: ["pluck"],
    musicbox: ["musicbox"], ambient: ["ambient"], halo: [],
  };
  var MIX_RATE_MIN = 0.25, MIX_RATE_MAX = 4;

  // PER-LAYER FINE-TUNE PARAMS (mixing desk II — the per-row knob strips).
  // Curated, honest knobs only: every one is a pure scalar a voice reads at
  // schedule time (or, for halo, at the follower's 0.5 s poll) — never a
  // seeded-stream draw, and every def equals the constant it replaces, so
  // the default desk is bit-identical to the unparametrized engine.
  // {key, label, min, max, def} — the label says what it audibly does.
  var LAYER_PARAMS = {
    drone: [
      { key: "warmth", label: "warmth — how open the bed's lowpass sits", min: 0.6, max: 1.5, def: 1 },
      { key: "sway", label: "sway — the tremolo's breath rate (Hz)", min: 0.2, max: 1.6, def: 0.7 },
    ],
    hum: [
      { key: "openness", label: "openness — how wide the vowel mouth opens", min: 0.5, max: 1.6, def: 1 },
      { key: "waver", label: "waver — vibrato depth", min: 0, max: 2, def: 1 },
    ],
    harpsichord: [
      { key: "brightness", label: "brightness — the string filter's starting bite", min: 1.8, max: 4.6, def: 3.0 },
      { key: "resonance", label: "resonance — the string filter's Q", min: 0.2, max: 3, def: 0.5 },
    ],
    musicbox: [
      { key: "shimmer", label: "shimmer — the metallic 3rd-partial glint", min: 0, max: 2, def: 1 },
    ],
    ambient: [
      { key: "density", label: "density — how often the room speaks", min: 0.5, max: 2, def: 1 },
    ],
    halo: [
      { key: "level", label: "level — how loud the sympathetic strings whisper", min: 0, max: 2, def: 1 },
    ],
  };

  // Default seed when neither create({seed}) nor ?seed= supplies one. A fixed
  // constant, NOT Date.now() — house rule: no wall-clock in musical paths.
  // Pages that want a different evening per visit pass their own seed.
  var DEFAULT_SEED = 1347571539; // "PROS" as a 32-bit word

  function resolveSeed(opts) {
    if (opts && opts.seed !== undefined && opts.seed !== null) {
      return (+opts.seed) >>> 0;
    }
    // Read ?seed= ourselves (documented choice per spec §7): the facade is
    // the engine's front door, so the page shouldn't have to plumb the URL.
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
        if (m) return (+m[1]) >>> 0;
      }
    } catch (e) { /* headless harness: fall through */ }
    return DEFAULT_SEED;
  }

  // ==========================================================================
  // create({ seed, volume }) → Library
  // ==========================================================================
  function create(opts) {
    opts = opts || {};

    var seed = resolveSeed(opts);
    var masterVol = (opts.volume != null) ? opts.volume : 0.5; // conservative
    var noteLs = [];   // multicast note listeners (family pattern)
    var eventLs = [];  // multicast event listeners
    var analysers = []; // attached analysers, re-tapped on every fresh bus

    var ctx = null;     // ONE lazy AudioContext, reused (and suspended) forever
    var run = null;     // the per-play world; null until first play
    var playing = false;
    var stopping = false; // true during the stop fade, before finalize

    // ----------------------------------------------------------------------
    // Multicast emitters. Listener exceptions are swallowed per-listener so a
    // broken viz can't silence the music (v1 learned this with its spiral).
    // ----------------------------------------------------------------------
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
    // Live-state readers, guarded: voices poll these every cycle and must
    // keep breathing even if the conductor is mid-handoff (or, during
    // integration, a contract edge we didn't foresee).
    // ----------------------------------------------------------------------
    // Voices pass the exact audio time their phrase SOUNDS (everything here
    // runs on a lookahead clock, so "now" is always a beat behind the note);
    // the as-built conductor exposes intensityAt(t) for exactly this.
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
      return "settling";
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

    // ----------------------------------------------------------------------
    // THE MIXER (see MIX_LAYERS above). mixState outlives runs — settings
    // persist across performances AND across stop/play; each fresh world is
    // born already mixed (mAttach in play() stamps design x current setting
    // as every mixer gain's initial value). run.mix[key] is the live param
    // list: {p, design, v0,t0,v1,t1} — the (v0,t0)->(v1,t1) segment is our
    // own last write, so the anchor value at any time is pure arithmetic
    // (the mixer is the ONLY writer on these params; reading .value mid-ramp
    // is exactly the browser-lazy trap the follower's shadows avoid).
    // ----------------------------------------------------------------------
    var mixState = {};
    for (var mxi = 0; mxi < MIX_LAYERS.length; mxi++) {
      mixState[MIX_LAYERS[mxi].key] = { volume: 1, muted: false, rate: 1 };
    }
    // Fine-tune param state (LAYER_PARAMS): same lifetime as mixState —
    // survives reseed/stop/play. Voices read these through pVal at schedule
    // time, so a knob turn is live from the next scheduled note/cycle.
    var paramState = {};
    for (var plk in LAYER_PARAMS) {
      paramState[plk] = {};
      for (var pdi = 0; pdi < LAYER_PARAMS[plk].length; pdi++) {
        paramState[plk][LAYER_PARAMS[plk][pdi].key] = LAYER_PARAMS[plk][pdi].def;
      }
    }
    function pVal(layer, key) {
      var l = paramState[layer];
      return (l && l[key] != null) ? l[key] : 1;
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
        var cur = mixValAt(e, t);       // where our own last ramp has it NOW
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
    // Voices route pool seats through their layer's per-seat wrap (the pool
    // problem, see the MIX_LAYERS note). Unknown key or missing wrap falls
    // back to the bare seat — a mixer wiring gap must never silence a note.
    function mixOut(key, slotIn) {
      var w = run && run.mixWraps && run.mixWraps[key];
      if (!w) return slotIn;
      var i = w.slots.indexOf(slotIn);
      return (i >= 0) ? w.wraps[i] : slotIn;
    }
    // Rate write-through (MIX_RATE_LANES): stamps the stored rate onto the
    // layer's live lanes. The clock's setLaneRate rescales pending events in
    // place; a rate equal to the lane's current rate is a no-op there, so
    // stamping the default 1 at play() disturbs nothing.
    function mixRateApply(key) {
      if (!run || !run.live) return;
      var names = MIX_RATE_LANES[key];
      if (!names || !names.length) return;
      var r = mixState[key].rate;
      for (var i = 0; i < names.length; i++) {
        try { run.clock.lane(names[i]).rate = r; } catch (e) {}
      }
    }

    // ========================================================================
    // THE LIBRARY DRAMATURGY (Conductor contract, spec §6)
    //
    // Numbers chosen for Phase 1 (documented here so the harness and future
    // phases can argue with them):
    //
    //   plan: durS = 360 + 720·(0.7·u + 0.3·tide) — evenings run 6–18 min,
    //         stormy tides bias long. Chapter count follows the budget
    //         (2 / 2–3 / 3–4 as durS crosses 560s / 780s) so the final
    //         scale factor stays gentle. Seizure present with
    //         p = 0.55 + 0.3·tide (≈70% of evenings on average — some
    //         evenings just read peacefully). Raw scene draws:
    //         settling 60–120, chapter 90–200 each, seizure 60–120,
    //         reverie 80–160, candle-out 45–90; all scaled so the total
    //         lands exactly on durS.
    //
    //   curves (x = scene progress, tide = 0..1):
    //     settling   0.04 + (0.21 + 0.04·tide)·smoothstep(x)     bloom to ~.25
    //     chapter    (0.315 + 0.09·tide) + 0.045·sin(2π·1.25·x)  plateau+wobble
    //     seizure    0.40 + 0.24·sin(π·x)                        peak 0.64
    //     reverie    0.15 + 0.21·(1-x)^1.4                       decay to .15
    //     candle-out 0.05 + 0.10·(1-x)^1.2                       gutter to .05
    //
    //   airLimit: 1 everywhere, 2 in chapters. overlapChance: settling .05,
    //   chapter .25, seizure .15, reverie .12, candle-out .03 — overlap as a
    //   happy accident, never a duet norm.
    //
    //   joints: pickW nothing 34 / drone-breath 40 / page-turn 18 / chime 8,
    //   and the chime degrades to a breath unless we are entering reverie or
    //   candle-out (it is the "the hour is late" gesture, nothing else).
    // ========================================================================
    var ACTIVITY = {
      "settling":   [["arriving", 3], ["dusting", 2], ["lamplighting", 2]],
      "chapter":    [["reading", 5], ["annotating", 2], ["browsing", 2]],
      "seizure":    [["seizure", 1]],
      "reverie":    [["remembering", 3], ["gazing", 2]],
      "candle-out": [["banking-the-fire", 1]],
    };
    function pickActivity(rng, type) {
      var pool = ACTIVITY[type];
      return pool ? rng.pickW(pool) : type;
    }

    var dram = {
      name: "library",
      durationRangeS: [360, 1080],

      plan: function (rng, tidePos) {
        var tp = clamp(tidePos || 0, 0, 1);
        var durS = 360 + 720 * (0.7 * rng.next() + 0.3 * tp);
        var nCh = (durS < 560) ? 2 : (durS < 780 ? rng.rint(2, 3) : rng.rint(3, 4));
        var hasSeizure = rng.chance(0.55 + 0.3 * tp);
        var scenes = [];
        function add(type, lo, hi) {
          scenes.push({ type: type, durS: rng.rnd(lo, hi), activity: pickActivity(rng, type) });
        }
        add("settling", 60, 120);
        for (var i = 0; i < nCh; i++) add("chapter", 90, 200);
        if (hasSeizure) add("seizure", 60, 120);
        add("reverie", 80, 160);
        add("candle-out", 45, 90);
        var raw = 0;
        for (i = 0; i < scenes.length; i++) raw += scenes[i].durS;
        var k = durS / raw; // exact landing on the drawn budget
        for (i = 0; i < scenes.length; i++) scenes[i].durS *= k;
        return scenes;
      },

      scenes: {
        "settling": {
          intensity: function (x, tp) {
            return clampI(0.04 + (0.21 + 0.04 * (tp || 0)) * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.05,
          activityWeights: ACTIVITY["settling"],
        },
        "chapter": {
          intensity: function (x, tp) {
            // Gentle plateau with a slow within-scene wobble — the reader
            // shifting in the chair, not a phrase shape.
            return clampI(0.315 + 0.09 * (tp || 0) + 0.045 * Math.sin(2 * Math.PI * 1.25 * x));
          },
          airLimit: 2, overlapChance: 0.25,
          activityWeights: ACTIVITY["chapter"],
        },
        "seizure": {
          intensity: function (x, tp) {
            // The "seizure" is concentration: density and a lifted register
            // (the pluck's walk floor rises), NOT loudness. Plain half-sine
            // keeps the per-half-second step small enough to read as weather.
            return clampI(0.40 + 0.24 * Math.sin(Math.PI * clamp(x, 0, 1)));
          },
          airLimit: 1, overlapChance: 0.15,
          activityWeights: ACTIVITY["seizure"],
        },
        "reverie": {
          intensity: function (x, tp) {
            return clampI(0.15 + 0.21 * Math.pow(1 - clamp(x, 0, 1), 1.4));
          },
          airLimit: 1, overlapChance: 0.12,
          activityWeights: ACTIVITY["reverie"],
        },
        "candle-out": {
          intensity: function (x, tp) {
            return clampI(0.05 + 0.10 * Math.pow(1 - clamp(x, 0, 1), 1.2));
          },
          airLimit: 1, overlapChance: 0.03,
          activityWeights: ACTIVITY["candle-out"],
        },
      },

      // ----------------------------------------------------------------
      // joint(fromType, toType, t, intensity, tools) — called ONCE per
      // boundary at an exact audio time. We use our own "joints" stream
      // (not tools.rng) so the gesture sequence is deterministic no matter
      // how many draws the conductor spends internally; tools is accepted
      // per contract but the closure over `run` is authoritative (we built
      // both ends). At most ONE quiet event; ~1/3 of draws are nothing.
      // Returns the gesture's label when it sounded, null for a silent
      // boundary — the conductor attaches it to the joint event as `did`.
      // ----------------------------------------------------------------
      joint: function (fromType, toType, t, intensity, tools) {
        if (!run || !run.live) return null;
        var draw = run.streams.joints.pickW([
          ["nothing", 34], ["breath", 40], ["page", 18], ["chime", 8],
        ]);
        // The single clock chime is reserved for entering reverie or
        // candle-out — anywhere else it would read as an event, and joints
        // must never read as events.
        if (draw === "chime" && toType !== "reverie" && toType !== "candle-out") {
          draw = "breath";
        }
        emitEvent({ type: "joint-gesture", gesture: draw, from: fromType, to: toType, t: t });
        if (draw === "nothing") return null;
        try {
          if (draw === "breath") jointBreath(t);
          else if (draw === "page") pageTurn(t, 0.012, "joint", run.streams.joints);
          else if (draw === "chime") jointChime(t);
        } catch (e) { return null; /* a failed joint is silence — a valid joint */ }
        return draw;
      },

      chainOverlapS: [5, 15],
      tide: {
        periodPerfs: [4, 7],
        labels: ["candlelit", "settling-wind", "stormy", "late-night"],
      },
    };

    // ========================================================================
    // JOINT GESTURES — the whole vocabulary is QUIET. Joint gain never
    // exceeds the ambient layer (peaks here are all ≤ the ambient pool's).
    // ========================================================================

    // (a) drone-breath: the bed dips ~2 dB over 4s and re-blooms. It touches
    // a DEDICATED gain stage (droneBreath, normally 1.0) so it can never
    // fight the intensity follower's ramps on droneLevel — two writers on
    // one param is where clicks come from.
    function jointBreath(t) {
      var g = run.droneBreath.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);                      // anchor (click-safe rule)
      g.linearRampToValueAtTime(0.79, t + 2);      // ≈ -2 dB
      g.linearRampToValueAtTime(1, t + 4);
    }

    // (b) a single soft page-turn: band-passed noise swish, short. Shared by
    // the joint vocabulary and the ambient pool (the ambient one is a touch
    // louder). `who` labels the note event. Phase 3: the caller passes its
    // OWN rng, so ambient traffic no longer spends joint-stream draws — the
    // joint vocabulary's sequence is independent of how busy the room is.
    function pageTurn(t, peak, who, rng) {
      var c = ctx;
      var tok = run.budget.claim(3, t + 0.7);
      if (!tok) return; // graceful thinning
      run.tokens.push(tok);
      var src = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(850 + rng.rnd(-120, 220), t);
      bp.Q.setValueAtTime(1.3, t);
      var g = c.createGain();
      src.connect(bp); bp.connect(g); g.connect(run.layAmb);
      // swish: quick rise, exponential settle, land at true zero
      PJ2.Voice.env(g.gain, t, [[0.07, peak], [0.28, peak * 0.22], [0.15, 0]]);
      src.start(t, src.randomOffset);
      src.stop(t + 0.6);
      emitNote({ voice: who, kind: "page", freq: null, t: t, durS: 0.5 });
    }

    // (c) ONE clock chime: a single struck tone, low in the mix, 4s decay
    // into the warm room. Pitch comes from the field like everything else.
    function jointChime(t) {
      var c = ctx;
      var tok = run.budget.claim(2, t + 4.3);
      if (!tok) return;
      run.tokens.push(tok);
      var co = run.streams.joints.pick([[4, 0], [0, 1]]); // G4-ish or C5 — hour tones
      var freq = run.field.degFreq(co[0], co[1]);
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      var g = c.createGain();
      o.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.008, 0.028], [3.4, 0.0012], [0.5, 0]]);
      o.start(t);
      o.stop(t + 4.1);
      emitNote({ voice: "joint", kind: "chime", freq: freq, t: t, durS: 4, deg: co[0], oct: co[1] });
    }

    // ========================================================================
    // THE PHASE 3 SOUND KIT — weather reads, the formant mouth, the halo's
    // tuning, and the room table. No draws from any musical stream in here:
    // weather is pure math after build; the vowel walk lives on its own
    // "vowels" fork; slow-noise is texture (Math.random-legal, cached).
    // ========================================================================

    // ---- weather reads --------------------------------------------------------
    // Voices read weather AT SCHEDULE TIME (the exact audio t of the thing
    // being scheduled), never at wall time — and on RUN-RELATIVE time
    // (t − t0), never the absolute audio clock. The absolute clock's zero is
    // an accident of when the ctx was born; a same-seed run started a minute
    // later must hear the same weather at the same point IN THE PIECE, or
    // gapMul shifts every gap and the determinism gate shatters (found the
    // hard way: the Phase 3 check's first run diverged by exactly this).
    // Guarded so a voice polling mid-teardown gets calm neutral air.
    var WX_NEUTRAL = { brightness: 0.5, breath: 0.5, gapMul: 0.5, wetTilt: 0.5, haloLevel: 0.5 };
    function wxAt(t) {
      if (run && run.weather) {
        try { return run.weather.at(t - run.t0); } catch (e) {}
      }
      return WX_NEUTRAL;
    }
    // gapMul: the ONE weather channel allowed to move event times. Mapped to
    // [0.85, 1.15] — the spec's ±15% is a hard bound by construction, and
    // neutral weather (0.5) maps to exactly 1.0 (the Phase 2 timing).
    function gmAt(t) {
      return 0.85 + 0.3 * wxAt(t).gapMul;
    }

    // ---- the vowel mouth (v1 lines 34-55, verbatim tables) --------------------
    // Dual bandpass formants shape one sawtooth into a vowel-colored hum.
    // Pool order = closed→open axis; the walk is neighbor-biased so the
    // mouth drifts between related shapes instead of teleporting. One walk
    // STATE serves bed, singer and consort — it is one reader's mouth.
    var HUM_VOWELS = {
      ng: { f1: 270, f2: 1500 },
      oo: { f1: 300, f2: 870 },
      uh: { f1: 520, f2: 1190 },
      oh: { f1: 570, f2: 840 },
      ah: { f1: 730, f2: 1090 },
    };
    var HUM_VOWEL_POOL = ["ng", "oo", "uh", "oh", "ah"];
    var HUM_VOWEL_WALK = [
      [0.05, 0.50, 0.25, 0.12, 0.08],
      [0.30, 0.05, 0.40, 0.15, 0.10],
      [0.10, 0.35, 0.05, 0.35, 0.15],
      [0.10, 0.15, 0.40, 0.05, 0.30],
      [0.08, 0.12, 0.25, 0.50, 0.05],
    ];
    function walkVowel() {
      // One draw from the "vowels" fork per step — the mouth's own dice,
      // invisible to every musical stream.
      var row = HUM_VOWEL_WALK[run.vowelIdx] || HUM_VOWEL_WALK[0];
      var r = run.streams.vowels.next();
      var acc = 0, idx = row.length - 1;
      for (var i = 0; i < row.length; i++) {
        acc += row[i];
        if (r < acc) { idx = i; break; }
      }
      run.vowelIdx = idx;
      return HUM_VOWELS[HUM_VOWEL_POOL[idx]];
    }

    // ---- slow noise (v1 humSlowNoiseBuffer, ~2107, made shareable) ------------
    // Linear-interpolated random keyframes — smooth wobble, not stepped
    // noise. v1 poured a fresh buffer PER NOTE; we cache one 20s loop per
    // (ctx, rate) and hand out sources with random read offsets, so
    // simultaneous notes wobble independently and the node graph stays flat.
    // Math.random throughout: texture, not music (zankyo rule).
    function slowNoise(c, rateHz) {
      var cache = c.__pj2SlowNoise = c.__pj2SlowNoise || {};
      var key = "r" + rateHz;
      if (!cache[key]) {
        var sr = c.sampleRate || 44100;
        var secs = 20;
        var slot = Math.max(1, Math.floor(sr / rateHz));
        var n = Math.max(slot * 4, Math.floor(sr * secs));
        var buf = c.createBuffer(1, n, sr);
        var data = buf.getChannelData(0);
        var nKeys = Math.ceil(n / slot) + 2;
        var keys = [];
        for (var k = 0; k < nKeys; k++) keys.push(Math.random() * 2 - 1);
        for (var i = 0; i < n; i++) {
          var pos = i / slot, i0 = Math.floor(pos), fr = pos - i0;
          data[i] = keys[i0] * (1 - fr) + keys[i0 + 1] * fr;
        }
        cache[key] = buf;
      }
      var src = c.createBufferSource();
      src.buffer = cache[key];
      src.loop = true;
      src.randomOffset = Math.random() * 18;
      return src;
    }

    // ---- the formant body (v1 libraryHum ~2133-2371, faithful port) -----------
    // ONE sawtooth (v1's life comes from jitter, not a detuned pair) →
    // slow-noise jitter on detune → dual F1/F2 bandpasses (F2 at half gain,
    // Q divided by "openness") mixed → slow-noise shimmer tremolo → env.
    // Weather replaces v1's per-note dice (item 5 of the Phase 3 contract):
    // breath opens the vowel, deepens jitter and vibrato — the reader
    // breathing, not a parameter jumping at a phrase edge.
    //   dest   — where the enveloped voice goes (bed → humLevel, sing → layHum)
    //   peak   — env peak (formants eat ~10 dB of a saw's energy; peaks here
    //            are ~3x what the note should read at, v1's own compensation
    //            — it ran 0.075 against a 0.09 drone partial)
    //   vowel  — {f1, f2} from walkVowel()
    //   wx     — weather at schedule time
    //   atkS/relS — optional envelope edges (the bed passes its long 4s
    //            fades; the singer defaults to v1's clamped note edges)
    // Returns the env gain so callers can add sends. ~13 nodes.
    function renderHumNote(dest, freq, t, durS, peak, vowel, wx, atkS, relS) {
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);

      // Jitter — slow-noise on detune (cents). v1 drew 3-15c per note; the
      // weather breathes 4-13c instead.
      var jit = slowNoise(c, 6);
      var jg = c.createGain();
      jg.gain.setValueAtTime(4 + 9 * wx.breath, t);
      jit.connect(jg);
      try { jg.connect(o.detune); } catch (e0) {}
      jit.start(t, jit.randomOffset);
      jit.stop(t + durS + 0.1);

      // Vibrato — sine LFO on frequency, depth ramped in from zero (v1's
      // own anchored ramp; never a click, never a cold wobble). The desk's
      // waver knob scales the depth (def 1 = as-composed).
      var vib = c.createOscillator();
      vib.type = "sine";
      vib.frequency.setValueAtTime(4.6 + 1.2 * wx.breath, t);
      var vg = c.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime((0.4 + 1.3 * wx.breath) * pVal("hum", "waver"), t + Math.min(0.4, durS * 0.25));
      vib.connect(vg);
      try { vg.connect(o.frequency); } catch (e1) {}
      vib.start(t);
      vib.stop(t + durS + 0.05);

      // Formants — openness (breath) widens the passbands by dividing Q
      // (v1's OPENNESS knob). Set once per note, never automated mid-note
      // (pj2-voice lesson #4). The desk's openness knob scales it further.
      var open = (0.75 + 0.5 * wx.breath) * pVal("hum", "openness");
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(vowel.f1, t);
      f1.Q.setValueAtTime(3 / open, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(vowel.f2, t);
      f2.Q.setValueAtTime(3.5 / open, t);
      var f2g = c.createGain();
      f2g.gain.setValueAtTime(0.5, t);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      o.connect(f1); o.connect(f2);
      f1.connect(mix); f2.connect(f2g); f2g.connect(mix);

      // Shimmer — tremolo driven by slow noise (fixed 0.10 depth, v1's
      // representative value from playHumVowelNote).
      var sh = c.createGain();
      sh.gain.setValueAtTime(1, t);
      var shN = slowNoise(c, 4);
      var shD = c.createGain();
      shD.gain.setValueAtTime(0.1, t);
      shN.connect(shD);
      try { shD.connect(sh.gain); } catch (e2) {}
      shN.start(t, shN.randomOffset);
      shN.stop(t + durS + 0.1);
      mix.connect(sh);

      // Envelope — v1's clamped attack/plateau/release, via env() so the
      // anchor discipline is automatic.
      var env = c.createGain();
      sh.connect(env);
      env.connect(dest);
      var atk = (atkS != null) ? atkS : Math.min(0.5, durS * 0.3);
      var rel = (relS != null) ? relS : Math.min(0.6, durS * 0.3);
      if (atk + rel > durS - 0.05) { atk = durS * 0.4; rel = durS * 0.4; }
      PJ2.Voice.env(env.gain, t, [[atk, peak], [durS - atk - rel, peak * 0.96], [rel, 0]]);

      o.start(t);
      o.stop(t + durS + 0.05);
      return env;
    }

    // ---- the halo's tuning ----------------------------------------------------
    // Six strings on field degrees {0, 2, 4, 5, 6} + the octave tonic —
    // the dorian body's RESONANT frame: tonic, third, fifth, sixth, seventh
    // and the octave. Degrees 1 and 3 are omitted deliberately: they are the
    // mode's passing tones, and a halo that answered passing tones would
    // shimmer at everything instead of at arrivals. Read from the LIVE field
    // at (re)tune time — era-aware like every other pitch in this file.
    var HALO_DEGS = [0, 2, 4, 5, 6];
    function haloFreqs(field) {
      var out = [];
      for (var i = 0; i < HALO_DEGS.length; i++) out.push(field.degFreq(HALO_DEGS[i], 0));
      out.push(field.degFreq(0, 1));
      return out;
    }

    // ---- the room table (Fx.roomBlend contract, owner-tuned) -------------------
    // Balance 0 = all close parlor, 1 = all wide hall. Scene-set, ramped
    // 12-20s (drawn from the "rooms" fork), +0.08 for the rest of the
    // evening after a sea change (the room remembers the modulation),
    // wetTilt nudging ±0.05 at each scene entry.
    var ROOM_BALANCE = {
      "settling": 0.15, "chapter": 0.35, "seizure": 0.4,
      "reverie": 0.65, "candle-out": 0.15,
    };
    function setSceneRoom(evt) {
      // Draw FIRST, unconditionally, so the rooms stream advances the same
      // way whatever the wiring below does (stream discipline).
      var rampS = run.streams.rooms.rnd(12, 20);
      var wx = wxAt(evt.t);
      var base = (ROOM_BALANCE[evt.scene] != null) ? ROOM_BALANCE[evt.scene] : 0.35;
      var bal = clamp(base + run.roomSeaBonus + 0.1 * (wx.wetTilt - 0.5), 0, 1);
      run.roomBalance = bal;
      try { run.roomBlend.setBalance(bal, rampS); } catch (e) {}
    }

    // ========================================================================
    // THE PHASE 2 MACHINERY — wiring for the two new brains.
    //
    // PJ2.Motif and PJ2.Harmony are pure composers: no clocks, no audio, no
    // events. Everything below is the LIBRARY's side of their contracts —
    // when the grammar steps, when a cadence sounds and how quietly, when
    // the sea change executes, when the ghost crosses the evening seam, and
    // how a motif's abstract beats become this voice's seconds. All of it
    // stays on clock lanes and forked streams; all of it narrates through
    // the existing event bus.
    // ========================================================================

    // Degree-class arithmetic folds through the CURRENT mode length (7 for
    // dorian and for every rotation the sea change can produce) — never a
    // hard-coded 7, so a future pentatonic track inherits this file safely.
    function degClass(d) {
      var n = (run && run.field && run.field.size) || 7;
      return ((d % n) + n) % n;
    }

    // The drone keeps its dyad in a low window around the tonic: a chord
    // root above the mode's midpoint is voiced from below (bVII sits a step
    // under the tonic, not a seventh above it), so the bed never wanders out
    // of its register just because the grammar walked upstairs.
    function foldRootLow(rootDeg) {
      var n = (run && run.field && run.field.size) || 7;
      var r = ((Math.round(rootDeg) % n) + n) % n;
      return (r > n / 2) ? r - n : r;
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

    // ---- the opus position --------------------------------------------------
    // 0..1 progress through the CURRENT evening — the refinement arc's clock.
    // Pure read of conductor telemetry; no draws, no state.
    function curOpusPos() {
      if (run && run.conductor) {
        try {
          var i = run.conductor.info();
          if (i && typeof i.elapsedS === "number" && i.durS > 0) {
            return Math.max(0, Math.min(1, i.elapsedS / i.durS));
          }
        } catch (e) {}
      }
      return 0;
    }
    // The alchemical operation underway (display label of the current scene),
    // and the one that matters musically: Conjunctio, the chemical wedding —
    // the third chapter, when an evening has one.
    function curOperation() {
      if (!run || !run.conductor) return null;
      try {
        var i = run.conductor.info();
        return sceneLabelFor(i.sceneType, i.sceneIdx, run.perfScenes);
      } catch (e) { return null; }
    }
    function inConjunctio() { return curOperation() === "Conjunctio"; }

    // The context object every motif.request receives. The motif engine has
    // no clock of its own (pure module); nowS is how time reaches its ledger
    // — the exact audio time of the phrase, so obligation deadlines mean
    // real seconds on the honest clock.
    function reqCtx(t) {
      return { sceneType: curSceneType(), x: curSceneX(), tidePos: curTidePos(),
               nowS: t, opusPos: curOpusPos() };
    }

    // ---- THE REFINEMENT ARC (alchemical touch a) ------------------------------
    // The magnum opus enacted on the theme itself: early in the evening the
    // idea is broken down — the coming-apart operations (fragments,
    // retrograde) run heavy — and late it is burnished and raised — ornament,
    // sequence, transpose run light-fingered and bright. A pure multiplier
    // handed to the motif engine per request (policy.transformTilt): no
    // draws, gentle slopes (1.6× → 0.4× across the evening), composed ON TOP
    // of the scene tilts, so reverie still dilates and the seizure still
    // splinters — the arc is weather over their climate, not a replacement.
    // Augment/diminish/invert are deliberately NOT in either set: augment
    // belongs to Distillatio's own tilt, and the mirror is neither base nor
    // noble — it is just the other side of the glass.
    function refinementTilt(ropts) {
      var p = (ropts && typeof ropts.opusPos === "number") ? ropts.opusPos : 0.5;
      var dark = 1.6 - 1.2 * p;   // 1.6 at the calcining, 0.4 by the coagula
      var lum  = 0.4 + 1.2 * p;   // and the mirror image
      return {
        fragmentHead: dark, fragmentTail: dark, retrograde: dark,
        ornament: lum, sequence: lum, transpose: lum,
      };
    }

    // ---- narration ----------------------------------------------------------
    // The motif engine emits nothing (its contract); the library narrates.
    // develop/answer/ghost become first-class events so the demo monitor and
    // the harness can watch the machinery think.
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
        emitEvent({
          type: "ghost", voice: voiceName, name: m.name, t: t,
          label: LABELS.events.ghost, // Caput Mortuum — display only
        });
      } else if (res.kind === "coagula") {
        emitEvent({
          type: "coagula", voice: voiceName, name: m.name, t: t,
          label: LABELS.events.coagula, // Solve et Coagula — display only
        });
      }
    }

    // ---- the ledger's supply side --------------------------------------------
    // After a statement, a voice may post an obligation (imitate / invert /
    // develop) addressed to whoever asks next — most often in chapters, where
    // the conversation actually converses. The motif engine owns the numbers
    // (its maybePost carries the spec's per-scene probabilities and deadline
    // draws); the library's share is the WHEN — the phrase's exact audio
    // time, so deadlines live on the honest clock — and one manner: ghost
    // statements post nothing. A memory is not an opening bid.
    function maybePost(voiceName, res, sceneType, t) {
      if (res.kind === "ghost") return;
      if (res.kind === "coagula") return; // the settling closes the work; it asks nothing
      // Conjunctio, the chemical wedding (alchemical touch b): during the
      // third chapter a statement is likelier to DEMAND its echo — an
      // explicit imitate obligation on a short fuse, so the answer lands
      // while the two voices still share the air (the raised overlap in
      // airOverlapChance is the other half of the rite). Drawn on the
      // dedicated "alchemy" fork so the motif stream never feels the coin.
      if (inConjunctio() && run.streams.alchemy.chance(0.5)) {
        try {
          run.motif.post(voiceName, "imitate", res.motif,
                         t + run.streams.alchemy.rnd(8, 16));
        } catch (e) {}
        return;
      }
      try { run.motif.maybePost(voiceName, res.motif, { sceneType: sceneType, nowS: t }); } catch (e) {}
    }

    // ---- beats → seconds ------------------------------------------------------
    // A motif's durBeats are abstract; each voice maps them through its own
    // seconds-per-beat (pace × intensity, drawn per phrase). Sounding
    // durations ring a little past the onset grid (ringK) and clamp to the
    // body's comfortable range — the same phrase reads slower in reverie
    // than in a chapter, which is the whole point of abstract time.
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

    // ---- the harmony lane -----------------------------------------------------
    // The grammar's pulse. Periods stay strictly inside [14, 30]s; the scene
    // and the intensity pick WHERE in that band an interval lands (slower at
    // the evening's quiet edges, quicker under concentration) rather than
    // stretching past it — "scaled", not "escaped".
    function startHarmonyLane() {
      var lane = run.clock.lane("harmony");
      var rng = run.streams.harmonyLane;
      function periodAt(t) {
        var st = curSceneType();
        var iv = curIntensity(t);
        var base = (st === "settling" || st === "candle-out") ? 0.75
          : (st === "reverie") ? 0.6
          : (st === "seizure") ? 0.28
          : 0.45;
        var pos = clamp(base + (rng.next() - 0.5) * 0.55 - 0.28 * iv, 0, 1);
        return 14 + 16 * pos;
      }
      function stepFn(t) {
        try { run.harmony.step(t); } catch (e) { /* a stuck chord is still a chord */ }
        lane.at(t + periodAt(t), stepFn);
      }
      // The opening chord (i) holds for one drawn period before the grammar
      // takes its first step — the evening settles before the ground moves.
      lane.at(run.t0 + periodAt(run.t0), stepFn);
    }

    // ---- the hum consort ------------------------------------------------------
    // 2–3 soft vowel parts voicing a cadence chord — the hum surfacing under
    // the arrival even when its bed is idle (the one landscape gesture
    // allowed to appear from nothing, per the cadence contract). Voicings
    // come from harmony.voiceConsort (least motion, per-id state); the
    // validator below is the library's seatbelt: whatever comes back must be
    // ascending, uncrossed, inside the low-mid window, all chord tones, root
    // present — or we voice it ourselves with a least-motion fallback and
    // keep the cadence honest. The window matches the as-built harmony's
    // default (−7..6 absolute degrees ≈ C3..Bb4) and is passed explicitly so
    // the two ends can never drift apart.
    var CONSORT_LO = -7, CONSORT_HI = 6;

    function chordClasses(chord) {
      var out = [], seen = {};
      var degs = (chord && chord.chordDegs) ? chord.chordDegs : [0, 2, 4];
      for (var i = 0; i < degs.length; i++) {
        var c = degClass(degs[i]);
        if (!seen[c]) { seen[c] = 1; out.push(c); }
      }
      return out;
    }

    function validVoicing(degs, chord) {
      if (Object.prototype.toString.call(degs) !== "[object Array]" || degs.length < 2) return false;
      var cl = chordClasses(chord), classes = {}, i;
      for (i = 0; i < cl.length; i++) classes[cl[i]] = 1;
      var rootCls = degClass(chord.rootDeg), rootSeen = false;
      for (i = 0; i < degs.length; i++) {
        var d = degs[i];
        if (typeof d !== "number" || !isFinite(d)) return false;
        if (i > 0 && d <= degs[i - 1]) return false;          // crossed / unison
        if (d < CONSORT_LO || d > CONSORT_HI) return false;   // out the window
        if (!classes[degClass(d)]) return false;              // not a chord tone
        if (degClass(d) === rootCls) rootSeen = true;
      }
      return rootSeen;
    }

    function localVoicing(chord, nParts) {
      var cl = chordClasses(chord); // class 0 is the root — part 0 always takes it
      var set = {}, i;
      for (i = 0; i < cl.length; i++) set[cl[i]] = 1;
      var prev = run.consortPrev;
      var out = [];
      for (i = 0; i < nParts; i++) {
        var cls = cl[i % cl.length];
        var target = (prev && typeof prev[i] === "number") ? prev[i] : (-2 + i * 3);
        var best = null, bestD = Infinity;
        for (var d = CONSORT_LO; d <= CONSORT_HI; d++) {
          if (degClass(d) !== cls) continue;
          var dist = Math.abs(d - target);
          if (dist < bestD) { bestD = dist; best = d; }
        }
        if (best != null) out.push(best);
      }
      out.sort(function (a, b) { return a - b; });
      // De-cross: any part sitting on or under its lower neighbor climbs to
      // the next chord tone above (a doubling beats a crossing).
      var asc = [];
      for (i = 0; i < out.length; i++) {
        var v = out[i];
        if (asc.length && v <= asc[asc.length - 1]) {
          v = asc[asc.length - 1] + 1;
          while (v <= CONSORT_HI && !set[degClass(v)]) v++;
        }
        if (v <= CONSORT_HI) asc.push(v);
      }
      return asc;
    }

    function consortVoicing(chord, nParts) {
      var degs = null;
      try {
        degs = run.harmony.voiceConsort(nParts, {
          id: "cadence",
          lo: CONSORT_LO,
          hi: CONSORT_HI,
          chord: {
            rootDeg: chord.rootDeg,
            chordDegs: chord.chordDegs ? chord.chordDegs.slice() : null,
          },
        });
      } catch (e) { degs = null; }
      if (!validVoicing(degs, chord)) degs = localVoicing(chord, nParts);
      if (degs && degs.length) run.consortPrev = degs.slice();
      return degs;
    }

    // One consort chord gesture: nParts saw vowels through ONE shared formant
    // pair — the hum's own mouth (Phase 3: the full F1/F2 body replaced the
    // single bandpass), at cadence loudness (very little). The whole chord
    // shares one vowel — three readers humming the same syllable — and one
    // slow shimmer, so it moves as a single surface. No jitter or vibrato
    // here: a consort that wobbled per-part would read as three voices, and
    // the cadence contract says it surfaces UNDER the texture, not in it.
    // Attacks are seconds long; nothing here can transient. Env peak 0.016
    // (pre 0.3 ahead of it) sits below the hum bed's own reading — the lift
    // contract (≤ 1.5 dB, no new attacks) is honored by construction.
    function renderConsort(chord, t, durS, fadeIn, fadeOut, nParts) {
      var degs = consortVoicing(chord, nParts);
      if (!degs || !degs.length) return;
      var tok = run.budget.claim(6 + degs.length, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (durS - fadeIn - fadeOut < 0.3) {
        fadeIn = fadeOut = Math.max(0.25, (durS - 0.3) / 2);
      }
      var wx = wxAt(t);
      var vowel = walkVowel();                  // one mouth shape per gesture
      var open = 0.75 + 0.5 * wx.breath;        // breath opens the vowel, as the bed
      var pre = c.createGain();
      pre.gain.setValueAtTime(0.3, t);          // pre-attenuate before resonance
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(vowel.f1, t); // set once, never automated mid-note
      f1.Q.setValueAtTime(3 / open, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(vowel.f2, t);
      f2.Q.setValueAtTime(3.5 / open, t);
      var f2g = c.createGain();
      f2g.gain.setValueAtTime(0.5, t);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      pre.connect(f1); pre.connect(f2);
      f1.connect(mix); f2.connect(f2g); f2g.connect(mix);
      var sh = c.createGain();                  // shared shimmer (constant-anchored
      sh.gain.setValueAtTime(1, t);             // gain — no envelope, no transient)
      var shN = slowNoise(c, 4);
      var shD = c.createGain();
      shD.gain.setValueAtTime(0.08, t);
      shN.connect(shD);
      try { shD.connect(sh.gain); } catch (e0) {}
      shN.start(t, shN.randomOffset);
      shN.stop(t + durS + 0.1);
      mix.connect(sh);
      var g = c.createGain();
      sh.connect(g); g.connect(run.layHum);
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], 0); // read at schedule time
        var o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(i % 2 ? 5 : -5, t);
        o.connect(pre);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "hum", kind: "consort", freq: freq, t: t, durS: durS, deg: degs[i], oct: 0 });
      }
      PJ2.Voice.env(g.gain, t, [[fadeIn, 0.016], [durS - fadeIn - fadeOut, 0.016], [fadeOut, 0]]);
    }

    // One cadence dyad on the drone's own body (triangle root+fifth through
    // a warm lowpass into the droneBreath chain, so it scales with the bed's
    // level machinery). Peaks 0.012/osc against the bed's 0.07+0.07: the sum
    // lifts the drone ≈ 1.37 dB at most — inside the ≤ 1.5 dB contract.
    function cadenceDronePad(chord, t, durS, fadeIn, fadeOut) {
      var tok = run.budget.claim(4, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (durS - fadeIn - fadeOut < 0.3) {
        fadeIn = fadeOut = Math.max(0.25, (durS - 0.3) / 2);
      }
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(250, t);
      lp.Q.setValueAtTime(0.5, t);
      lp.connect(run.droneBreath);
      var root = foldRootLow(chord.rootDeg);
      var degs = [root, root + 4];
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], -1); // read at schedule time
        var o = c.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(lp);
        PJ2.Voice.env(g.gain, t, [[fadeIn, 0.012], [durS - fadeIn - fadeOut, 0.012], [fadeOut, 0]]);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "drone", kind: "cadence", freq: freq, t: t, durS: durS, deg: degs[i], oct: -1 });
      }
    }

    // ---- harmony-readout spelling (display only) -------------------------------
    // The margin readout (PLAN-HARMONY-READOUT) spells what the harmony brain
    // is doing. Pure observation of existing run state — no draws, no
    // scheduling influence; the determinism guard is kept by construction.
    // Flat-spelled pitch-class names, lowercase (the Library's world is
    // flat-leaning dorian; the readout's "iv · f a♭ c" wants a♭, not g♯).
    var PC_NAMES = ["c", "d♭", "d", "e♭", "e", "f", "g♭", "g", "a♭", "a", "b♭", "b"];
    function pcNameForHz(hz) {
      var pc = ((Math.round(69 + 12 * Math.log(hz / 440) / Math.LN2) % 12) + 12) % 12;
      return PC_NAMES[pc];
    }
    // The current chord's tones, spelled: ["f","a♭","c"] → "f a♭ c".
    // current() already carries the degree set, so the harmony API grows not at all.
    function spellChordTones(chordDegs) {
      var out = [];
      for (var i = 0; i < chordDegs.length; i++) {
        out.push(pcNameForHz(run.field.degFreq(chordDegs[i], 0)));
      }
      return out.join(" ");
    }
    // The sea change's target in words. A reroot's concrete root/mode exist
    // only AFTER execution (resolved from the live field), so pre-execution
    // it wears its interval name and post-execution its new ground ("f
    // mixolydian"); the true change is always the subdominant lift ("+P4").
    function seaChangeLabel(target, res) {
      if (res && res.to && isFinite(res.to.tonicHz)) {
        return pcNameForHz(res.to.tonicHz) + " " + res.to.mode;
      }
      if (target && target.kind === "true") return "+P4";
      if (target && target.kind === "ratio") return target.name || null;
      return null;
    }

    // ---- cadences --------------------------------------------------------------
    // Drawn per boundary with the spec's kind-by-context weighting. The
    // schedule follows the as-built harmony's own contract: cadence() draws
    // a 9–13s two-chord act; the approach chord blooms at tB − (durA+durB),
    // the ARRIVAL starts at tB − durB, is at full voice well before the
    // boundary, HOLDS through tB exactly (where the joint, if any, sounds),
    // and releases a couple of seconds into the new scene. harmony.cadence
    // also re-roots the grammar to the arrival at call time — deliberately
    // called only when the window opens (LEAD seconds out, not at scene
    // entry), so any melody speaking during the window already resolves onto
    // the arrival's tones, per the cadence-sound contract. Two dyads on the
    // drone, two consort voicings under them, no new attacks, ≤ 1.5 dB.
    function cadenceChanceFor(fromType, toType, isSeam) {
      if (isSeam) return 0.8;                                        // the evening seam: nearly always
      if (toType === "reverie" || toType === "candle-out") return 0.9; // "the hour is late" arrivals
      if (fromType === "settling") return 0.2;                       // after settling: rarely
      if (fromType === "chapter") return 0.7;                        // chapter ends: usually
      return 0.6;
    }
    function cadenceKindPool(fromType, toType, isSeam) {
      if (isSeam || toType === "reverie" || toType === "candle-out") {
        return [["plagal", 8], ["half", 1], ["soft-authentic", 1]];  // plagal owns the descents
      }
      if (fromType === "chapter") {
        return [["half", 6], ["soft-authentic", 2], ["plagal", 2]];  // soft-authentic sparingly
      }
      return [["half", 8], ["plagal", 2]];                           // mid-evening: half
    }

    var CADENCE_LEAD_S = 14; // the window-opening callback fires this far out;
                             // harmony's own total (9–13s) always fits inside

    function realizeCadence(plan) {
      if (run) run.nextCadence = null; // realized or moot — the readout moves on
      if (!run || !run.live) return;
      var cad = null;
      try { cad = run.harmony.cadence(plan.kind); } catch (e) { cad = null; }
      if (!cad || !cad.chords || cad.chords.length < 2) return;
      var tB = plan.tB;
      var c1 = cad.chords[0], c2 = cad.chords[1];
      var dA = clamp((+c1.durS > 0) ? +c1.durS : 5, 3, 10);
      var dB = clamp((+c2.durS > 0) ? +c2.durS : 4, 3, 10);
      if (dA + dB > CADENCE_LEAD_S - 0.2) {           // never earlier than the callback itself
        var k = (CADENCE_LEAD_S - 0.2) / (dA + dB);
        dA *= k; dB *= k;
      }
      var X = 1.2;    // approach→arrival crossfade width
      var RING = 2.5; // the arrival's release into the new scene
      var tA = tB - (dA + dB);   // approach chord onset
      var tArr = tB - dB;        // arrival chord onset — sounding well BY tB
      cadenceDronePad(c1, tA, dA + X, 2.5, X);
      renderConsort(c1, tA, dA + X, 2.0, X, plan.nParts);
      cadenceDronePad(c2, tArr, dB + RING, X, RING);  // holds through tB, releases after
      renderConsort(c2, tArr, dB + RING, X, 2.0, plan.nParts);
      emitEvent({
        type: "cadence", kind: cad.kind || plan.kind, t: tB,
        label: LABELS.cadences[cad.kind || plan.kind] || null, // display only
        startT: tA, arriveT: tArr,
        from: plan.from, to: plan.to,
        chords: [c1.name != null ? c1.name : null, c2.name != null ? c2.name : null],
      });
    }

    // Called at every scene entry for the boundary this scene will END on.
    // Every draw happens unconditionally (roll, kind, parts) so the cadence
    // stream advances identically whether or not this boundary draws one —
    // stream discipline, the family rule.
    function planCadence(evt, toType, isSeam) {
      var rng = run.streams.cadence;
      var tB = evt.t + evt.durS;
      var roll = rng.next();
      var kind = rng.pickW(cadenceKindPool(evt.scene, toType, isSeam));
      var nParts = rng.rint(2, 3);
      if (roll >= cadenceChanceFor(evt.scene, toType, isSeam)) return;
      if (evt.durS < CADENCE_LEAD_S + 6) return; // a scene too short to breathe before it
      var plan = { kind: kind, nParts: nParts, from: evt.scene, to: toType, tB: tB };
      run.clock.lane("cadence").at(tB - CADENCE_LEAD_S, function () { realizeCadence(plan); });
      // telemetry for the harmony readout: the approach, announced (the
      // label is the alchemical display word — observation only, no draws)
      run.nextCadence = { kind: kind, label: LABELS.cadences[kind] || null, t: tB };
    }

    // ---- the sea change ---------------------------------------------------------
    // Planned once per performance (harmony draws whether/where/what); the
    // library's job is the WHEN: the planned boundary's exact audio time,
    // placed with lane.at from the scene entry that precedes it. Our
    // callback lands a hair before the conductor's own boundary work at the
    // same t (scheduled earlier, same time, stable clock order), so the
    // joint, the next scene, and everything after reads the mutated field.
    function scheduleSeaChange(tB) {
      run.clock.lane("seachange").at(tB, function (t) { executeSeaChangeAt(t); });
    }

    function executeSeaChangeAt(t) {
      if (!run || !run.live || !run.seaChange || run.seaChange.done) return;
      run.seaChange.done = true;
      var res = null;
      try { res = run.harmony.executeSeaChange(run.seaChange.target); } catch (e) { res = null; }
      run.seaChange.label = seaChangeLabel(run.seaChange.target, res); // the new ground, spelled
      run.consortPrev = null; // fresh voice-leading on the far shore
      seaChangePad(t);        // the drone is the seam: new key blooms under the old tail
      // Phase 3: the room remembers the modulation (+0.08 for the rest of
      // the evening, applied at each scene entry), and the halo is ARMED to
      // retune — but not yet. Retuning DURING the modulation would splice
      // the bank's ring under the seam itself; the contract says the FIRST
      // SCENE BOUNDARY AFTER the sea change, and the boundary the sea change
      // lands on shares this exact t, so the scene handler skips it (> t
      // guard) and the next boundary does the deed. Until then the old-world
      // strings ring on — the straddle lesson, applied to resonance.
      run.roomSeaBonus = 0.08;
      run.haloRetuneAt = t;
      emitEvent({
        type: "seachange", target: run.seaChange.target,
        label: LABELS.events.seachange, // Transmutatio — display only
        pivotDegs: (res && res.pivotDegs) ? res.pivotDegs : null,
        field: { tonicHz: run.field.tonicHz, mode: run.field.mode },
        t: t,
      });
    }

    // The chainOverlap pattern applied to a key instead of a performance:
    // pads already sounding keep their old-world frequencies and fade on
    // their own schedule; this one extra cycle blooms the NEW key's dyad at
    // the boundary itself, so the modulation arrives as weather.
    function seaChangePad(t) {
      var rng = run.streams.seachange;
      var durS = rng.rnd(18, 26); // drawn before the claim — stream discipline
      var tok = run.budget.claim(5, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(250, t);
      lp.Q.setValueAtTime(0.5, t);
      lp.connect(run.droneBreath);
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var root = foldRootLow(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
      var degs = [root, root + 4];
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], -1); // the field is already the new world here
        var o = c.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(lp);
        PJ2.Voice.env(g.gain, t, [[3.5, 0.05], [durS - 7, 0.05], [3.5, 0]]);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "drone", kind: "seachange", freq: freq, t: t, durS: durS, deg: degs[i], oct: -1 });
      }
    }

    // ---- conductor-event wiring ---------------------------------------------
    // The library rides its own conductor's event stream for structure: the
    // performance seam carries the ghost across (extract at end, seed after
    // the next reset), each new plan gets a sea-change draw, and each scene
    // entry plans the machinery for the boundary it will end on.
    function onSceneEvent(evt) {
      if (!run.perfScenes) return;
      var toIdx = evt.idx + 1;
      var isSeam = toIdx >= run.perfScenes.length;
      var toType = isSeam ? "settling" : run.perfScenes[toIdx];
      var tB = evt.t + evt.durS;
      if (!isSeam && run.seaChange && !run.seaChange.done && run.seaChange.atSceneIdx === toIdx) {
        scheduleSeaChange(tB);
        return; // the modulation IS this boundary's event — no cadence on top of it
      }
      planCadence(evt, toType, isSeam);
    }

    function handleConductorEvent(evt) {
      if (!run || !run.live) return;
      try {
        if (evt.type === "performance" && evt.phase === "end") {
          // The seam: remember the evening's most-developed idea (or null —
          // some evenings never develop past gen 2, and carry nothing).
          try { run.pendingGhost = run.motif.extractGhost(); } catch (e) { run.pendingGhost = null; }
        } else if (evt.type === "performance" && evt.phase === "begin") {
          run.perfScenes = evt.scenes ? evt.scenes.slice() : null;
          run.roomSeaBonus = 0; // the room's sea-change memory lasts one evening
          run.coagulaDone = false; // each evening earns its own settling
          try { run.motif.newPerformance(evt.tidePos); } catch (e) {}
          if (run.pendingGhost) {
            try { run.motif.seedGhost(run.pendingGhost); } catch (e) {}
            run.pendingGhost = null;
          }
          run.seaChange = null;
          run.nextCadence = null;      // no approach rides across the seam
          try {
            // harmony reads sceneList entries as {type} objects (the shape
            // of a dramaturgy plan); the conductor's begin event carries
            // bare type strings, so wrap them.
            var sceneList = [];
            if (evt.scenes) {
              for (var si = 0; si < evt.scenes.length; si++) {
                sceneList.push({ type: evt.scenes[si] });
              }
            }
            var sc = run.harmony.planSeaChange({
              sceneList: sceneList,
              tidePos: evt.tidePos,
            });
            // Accept only a boundary strictly inside the performance: the
            // seam belongs to the chain-overlap, not to a modulation.
            if (sc && isFinite(sc.atSceneIdx) &&
                sc.atSceneIdx >= 1 && evt.scenes && sc.atSceneIdx < evt.scenes.length) {
              run.seaChange = { atSceneIdx: Math.floor(sc.atSceneIdx), target: sc.target, done: false,
                label: seaChangeLabel(sc.target, null) };
            }
          } catch (e) {}
        } else if (evt.type === "scene") {
          // Phase 3 room morph: every scene entry re-aims the balance (ramped
          // 12-20s inside setSceneRoom). Audio-side only — no events emitted.
          setSceneRoom(evt);
          // Halo retune at the FIRST scene boundary strictly after a sea
          // change (the modulation's own boundary shares its t and is
          // skipped). Freqs read from the LIVE (already-mutated) field.
          if (run.haloRetuneAt != null && evt.t > run.haloRetuneAt + 0.5) {
            run.haloRetuneAt = null;
            try { run.halo.retune(haloFreqs(run.field)); } catch (e2) {}
          }
          onSceneEvent(evt);
        }
      } catch (e) { /* structure wiring must never stop the transport */ }
    }

    // ========================================================================
    // THE FIVE VOICES
    //
    // All of them ride self-rescheduling lane.at chains: fn(t) does its work
    // at the EXACT scheduled t and re-arms at t + delta. (We use lane.at
    // chains rather than lane.every so every fire time is pure arithmetic
    // from t0 — .every's first fire reads ctx.currentTime and would put a
    // tick-phase wobble into an otherwise fully deterministic stream.)
    // ========================================================================

    // ---- drone (landscape — THE SEAM) --------------------------------------
    // Eno-style overlapping pad cycles ported from v1's libraryDrone (~1279):
    // triangle dyad through a warm lowpass, 20–30s cycles, each new cycle
    // starting 2.5–5s before the old one finishes fading. Its lane is NEVER
    // cancelled by scenes or performance boundaries — the candle-out tail
    // and the next evening's settling-in are the same unbroken bed. Level
    // follows conductor.intensity() via the follower's slow ramps.
    //
    // Phase 2: the dyad is no longer the fixed {0,4} — each cycle reads
    // harmony.current() at its own start and voices that chord's root+fifth
    // (folded low, see foldRootLow). A cycle keeps its frequencies for its
    // whole life; the NEXT cycle reads again. Chord changes therefore arrive
    // as new pads blooming under old ones — glides without glissandi, and
    // never a retuned sounding partial (the straddle lesson, kept).
    function startDrone() {
      var lane = run.clock.lane("drone");
      var rng = run.streams.drone;
      function cycle(t) {
        // Draw everything FIRST so a budget refusal can't shift the stream.
        var durS = rng.rnd(20, 30);
        var overlap = rng.rnd(2.5, 5);
        var hasSub = rng.chance(0.3);
        var iv = curIntensity(t);
        var tok = run.budget.claim(hasSub ? 11 : 9, t + durS + 0.3); // +3: the tremolo bus
        if (!tok) {
          // The seam must not open: retry on a short leash instead of
          // waiting a whole cycle. (Budget 32 makes this near-impossible,
          // but the drone is the one voice we refuse to let gap.)
          lane.at(t + 2, cycle);
          return;
        }
        run.tokens.push(tok);
        var c = ctx;
        var wx = wxAt(t);
        // Warmth opens slightly with intensity, and the weather's brightness
        // tilts it ±40 Hz on top — the fire burning higher or lower. The
        // desk's warmth knob multiplies the whole cutoff (def 1 = as-composed).
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime((230 + 90 * iv + 80 * (wx.brightness - 0.5)) * pVal("drone", "warmth"), t);
        lp.Q.setValueAtTime(0.5, t);
        // The shared tremolo bus, back from v1 (~1307): base = 1 - depth/2,
        // LFO swings ±depth/2, so the envelope breathes between (1 - depth)
        // and 1. Every partial and the sub route through this ONE bus, so
        // the modulation is coherent — the whole bed sways together instead
        // of three partials beating independently. Depth follows breath
        // (v1's "movement" knob, 0.19 default → 0.10..0.24 by weather);
        // rate is v1's 0.7 Hz. The LFO is born and dies with the cycle, so
        // its phase is deterministic from t.
        var tremDepth = 0.10 + 0.14 * wx.breath;
        var trem = c.createGain();
        trem.gain.setValueAtTime(1 - tremDepth / 2, t);
        var tremLFO = c.createOscillator();
        tremLFO.type = "sine";
        tremLFO.frequency.setValueAtTime(pVal("drone", "sway"), t); // v1's 0.7 Hz at the default
        var tremG = c.createGain();
        tremG.gain.setValueAtTime(tremDepth / 2, t);
        tremLFO.connect(tremG);
        try { tremG.connect(trem.gain); } catch (eT) {}
        lp.connect(trem);
        trem.connect(run.droneBreath);
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        var rootAbs = foldRootLow(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
        var pads = [
          { deg: rootAbs, oct: -1, peak: 0.07, type: "triangle" },
          { deg: rootAbs + 4, oct: -1, peak: 0.07, type: "triangle" },
        ];
        if (hasSub) pads.push({ deg: rootAbs, oct: -2, peak: 0.025, type: "sine" });
        for (var i = 0; i < pads.length; i++) {
          var p = pads[i];
          var freq = run.field.degFreq(p.deg, p.oct);
          var o = c.createOscillator();
          o.type = p.type;
          o.frequency.setValueAtTime(freq, t);
          var g = c.createGain();
          o.connect(g); g.connect(lp);
          // 3s fades both ends, flat middle — v1's envelope, via env() so
          // the anchor discipline is automatic.
          PJ2.Voice.env(g.gain, t, [[3, p.peak], [durS - 6, p.peak], [3, 0]]);
          o.start(t);
          o.stop(t + durS + 0.1);
          emitNote({ voice: "drone", freq: freq, t: t, durS: durS, deg: p.deg, oct: p.oct });
        }
        tremLFO.start(t);
        tremLFO.stop(t + durS + 0.1);
        lane.at(t + (durS - overlap), cycle); // overlap: the next pad blooms under this one
      }
      lane.at(run.t0, cycle);
    }

    // ---- humBed (landscape) -------------------------------------------------
    // v1's libraryHum, the full formant body now (Phase 3): one sawtooth
    // through the walked F1/F2 vowel mouth, jitter, vibrato, shimmer —
    // realized as slow overlapping swells so it reads as a bed, not phrases.
    // Fades in from intensity ≥ 0.2 (via level gain AND swell gating). The
    // old vowel-from-tide jump is gone: the mouth walks its own Markov and
    // the weather's breath opens it (contract item 5 — a weather read where
    // a per-phrase parameter jump used to be). Env peak 0.026: one saw
    // through formants lands where the old detuned pair through its single
    // bandpass did (v1 ran 0.075 for the same reason — formants eat energy).
    function startHum() {
      var lane = run.clock.lane("hum");
      var rng = run.streams.hum;
      function swell(t) {
        var iv = curIntensity(t);
        if (iv < 0.2) { lane.at(t + rng.rnd(4, 7), swell); return; }
        var durS = rng.rnd(12, 20);
        var deg = rng.pick([0, 2, 4]);          // tonic / minor third / fifth
        var gap = rng.rnd(9, 16);               // < durS: swells overlap into a bed
        var tok = run.budget.claim(13, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, swell); return; }
        run.tokens.push(tok);
        var freq = run.field.degFreq(deg, -1);
        renderHumNote(run.humLevel, freq, t, durS, 0.026, walkVowel(), wxAt(t), 4, 4);
        emitNote({ voice: "humBed", freq: freq, t: t, durS: durS, deg: deg, oct: -1 });
        lane.at(t + gap, swell);
      }
      lane.at(run.t0 + rng.rnd(2, 5), swell);
    }

    // ---- humSing (melodic — the hum's SECOND role, and it claims THE AIR) ---
    // The bed above never touches the air; this lane is the same voice
    // deciding, now and then, to actually SING: a motif line stated slowly
    // through the identical formant body (detuned saw pair, one bandpass
    // vowel — the patch is the bed's, note for note, just pitched by the
    // motif instead of droning). Per-scene chances per the owner's decision:
    // chapters .25 per opportunity, reverie .15, settling/candle-out .05,
    // seizure 0 (the reader does not sing while seized). This is what makes
    // chapter overlap REAL — a third speaker the air can let in. Routed
    // around humLevel: the intensity gate belongs to the bed, and a singer
    // who has claimed the air must be heard even where the bed is idle.
    function startHumSing() {
      var lane = run.clock.lane("humSing");
      var rng = run.streams.humSing;
      var SING_P = { "settling": 0.05, "chapter": 0.25, "seizure": 0, "reverie": 0.15, "candle-out": 0.05 };
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var p = SING_P[st] != null ? SING_P[st] : 0;
        var sings = rng.chance(p); // drawn every opportunity — stream discipline
        if (!sings || iv < 0.08) { lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt); return; }
        var res = run.heldUtterance.hum;
        run.heldUtterance.hum = null;
        if (!res) {
          try { res = run.motif.request("hum", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.1, 1.6) * (1.4 - 0.6 * iv); // the slowest reader in the room
        var tm = phraseTiming(m, spb, 1.15, 1.2, 4.5);
        var margin = rng.rnd(4, 9);
        var tok = null;
        try { tok = run.air.tryClaim("hum", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.hum = res;
          lane.at(t + rng.rnd(6, 10) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "hum", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "hum", t);
        // Phase 3: the mouth walks a vowel per phrase and occasionally steps
        // to a neighbor mid-phrase (v1's HUM_VOWEL_CHANGE_PROB 0.3) — all on
        // the "vowels" fork, invisible to the musical streams. The old
        // vowel-from-tide jump is gone (weather item 5).
        var vowel = walkVowel();
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        // Re-register at render (the motif contract allows it): hum-fresh
        // material already sits in the chest (the motif engine's home
        // register for "hum" is an octave down); shared/developed material
        // recentres near the tonic octave, so drop it one octave to keep the
        // singer where the character lives. Degree classes survive whole-
        // octave shifts, so chord-tone endings are untouched.
        var mean = 0;
        for (var mi = 0; mi < m.notes.length; mi++) mean += m.notes[mi].deg;
        mean /= m.notes.length;
        var humOff = (mean > 2.5) ? -run.field.size : 0;
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.75, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (i > 0 && run.streams.vowels.chance(0.3)) vowel = walkVowel(); // mid-phrase mouth shift (v1)
          var btok = run.budget.claim(13, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var freq = run.field.degFreq(m.notes[i].deg + humOff, 0); // read at schedule time, never cached
          renderHumNote(run.layHum, freq, nt, nd, 0.032 * vel, vowel, wxAt(nt));
          emitNote({
            voice: "hum", kind: "sing", freq: freq, t: nt, durS: nd,
            deg: m.notes[i].deg + humOff, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        maybePost("hum", res, st, t);
        lane.at(t + tm.spanS + margin + rng.rnd(8, 16) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(12, 24), attempt);
    }

    // ---- pluck (melodic — claims THE AIR) -----------------------------------
    // The harpsichord body, v1's libPluckNote (~1380-1435) ported faithfully
    // (Phase 3): a 30 ms looped noise burst — Karplus-Strong by filtered
    // recirculation — through a freq-tracked lowpass that dulls exponentially
    // to 0.8f as the string dies (v1's exact sweep), Q 0.5, plus the octave
    // sine sparkle at v1's fundamental-relative dose (~0.21 of the peak).
    // Weather's brightness breathes the filter's starting multiplier
    // (2.4..3.6 around v1's 3.0 knob) and the sparkle mix — the harmonic-mix
    // half of contract item 5. v1 ran peak 0.14 against its own hotter bus;
    // here 0.055·vel holds the family's headroom (see the gain ledger).
    // Every pluck feeds the sympathetic halo's whisper send; phrases that
    // drew the far wall (p~0.3, decided per phrase in startPluck) also feed
    // the shared delay.
    function renderPluck(out, freq, t, durS, vel, farWall) {
      var c = ctx;
      var wx = wxAt(t);
      var n = Math.max(2, Math.round((c.sampleRate || 44100) * 0.03)); // v1's 30 ms burst
      var buf = c.createBuffer(1, n, c.sampleRate || 44100);
      var data = buf.getChannelData(0);
      for (var j = 0; j < n; j++) data[j] = Math.random() * 2 - 1; // texture, not music
      var src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var bright = (pVal("harpsichord", "brightness") - 0.6) + 1.2 * wx.brightness; // v1 "brightness" 3.0 at the default, breathed ±0.6
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(freq * bright, t);           // anchored, then
      lp.frequency.exponentialRampToValueAtTime(freq * 0.8, t + durS * 0.8); // the string dulls
      lp.Q.setValueAtTime(pVal("harpsichord", "resonance"), t); // v1 "resonance" 0.5 at the default
      var g = c.createGain();
      src.connect(lp); lp.connect(g); g.connect(out);
      g.connect(run.haloSend);                                 // the strings hear every pluck
      if (farWall) g.connect(run.delaySendPluck);              // some phrases reach the far wall
      // v1's envelope shape (instant strike, exp decay to ~1/3 by 150 ms,
      // linear tail to true zero) with a 4 ms click-guard attack.
      var knee = Math.min(0.15, durS * 0.5);
      PJ2.Voice.env(g.gain, t, [[0.004, 0.055 * vel], [knee - 0.004, 0.018 * vel], [durS - knee, 0]]);
      src.start(t);
      src.stop(t + durS + 0.02);
      // octave sparkle — a partial, not a note; no note event for it.
      // v1 sparkle/peak = 0.03/0.14 ≈ 0.21; brightness breathes it here.
      var ho = c.createOscillator();
      ho.type = "sine";
      ho.frequency.setValueAtTime(freq * 2, t);
      var hg = c.createGain();
      ho.connect(hg); hg.connect(out);
      PJ2.Voice.env(hg.gain, t, [[0.003, (0.006 + 0.006 * wx.brightness) * vel], [0.297, 0.0008], [0.1, 0]]);
      ho.start(t);
      ho.stop(t + 0.42);
    }

    // Phase 2 brain: every phrase is a motif.request statement. The motif
    // arrives with chord-resolved endings already in it (PJ2.Motif snaps
    // phrase finals onto harmony.resolutionDegs — the harness verifies at
    // integration); the library's share is pacing, air, budget, narration,
    // and the occasional ledger post.
    function startPluck() {
      var lane = run.clock.lane("pluck");
      var rng = run.streams.pluck;
      function phrase(t) {
        var iv = curIntensity(t);
        if (iv < 0.07) { lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase); return; }
        var st = curSceneType();
        // A ghost denied the air is HELD, never dropped: the motif engine
        // offers it exactly once per evening, so the library must not let a
        // busy moment erase the memory. Anything else denied simply passes.
        var res = run.heldUtterance.pluck;
        run.heldUtterance.pluck = null;
        // SOLVE ET COAGULA (alchemical touch c): Fermentatio splintered the
        // theme — that was the solve. Once per evening, a little way into
        // Coagulatio, the pluck states the theme WHOLE and in its original
        // form (the prima materia, not the deepest descendant), quietly —
        // the work settling into what it was always becoming. Once only;
        // denied the air, it is held like a ghost, never dropped.
        if (!res && st === "candle-out" && !run.coagulaDone && curSceneX() >= 0.2) {
          var th = null;
          try { th = run.motif.theme({ ancestor: true }); } catch (e) {}
          if (th && th.notes && th.notes.length) {
            run.coagulaDone = true;
            res = { motif: th, kind: "coagula" };
          }
        }
        if (!res) {
          try { res = run.motif.request("pluck", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase);
          return;
        }
        var m = res.motif;
        // beats → seconds: the pluck reads faster as the room leans in.
        var spb = rng.rnd(0.42, 0.6) * (1.45 - 0.75 * iv);
        var tm = phraseTiming(m, spb, 1.6, 0.9, 2.6);
        var margin = rng.rnd(3, 8); // enforced silence after the phrase
        var tok = null;
        try { tok = run.air.tryClaim("pluck", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost" || res.kind === "coagula") run.heldUtterance.pluck = res;
          lane.at(t + rng.rnd(2.5, 5) * gmAt(t), phrase); // ask again later
          return;
        }
        emitEvent({
          type: "air", voice: "pluck", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "pluck", t);
        // The seizure lifts the register one whole OCTAVE (a mode-length
        // degree shift keeps every degree class, so chord-tone endings
        // survive the lift). Concentration = height + density, never loud.
        var lift = (st === "seizure") ? run.field.size : 0;
        var velScale = (res.kind === "ghost") ? 0.6
                     : (res.kind === "coagula") ? 0.6 : 1; // memories and settlings speak quietly
        var out = mixOut("harpsichord", run.poolMel.at(rng.rnd(-0.6, 0.6)));
        // The far-wall draw, ONCE per phrase (spec: p ~0.3) — on its own
        // "delaySend" fork so the pluck's musical stream never feels it.
        var farWall = run.streams.delaySend.chance(0.3);
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.7, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          var btok = run.budget.claim(5, nt + nd + 0.1);
          if (!btok) continue; // skip the note, keep the phrase's timing
          run.tokens.push(btok);
          var freq = run.field.degFreq(m.notes[i].deg + lift, 0); // read at schedule time, never cached
          renderPluck(out, freq, nt, nd, vel, farWall);
          emitNote({
            voice: "pluck", freq: freq, t: nt, durS: nd,
            deg: m.notes[i].deg + lift, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        maybePost("pluck", res, st, t);
        // Respect our own margin, then breathe: pacing tightens with
        // intensity, and the weather's gapMul stretches or squeezes the
        // breath ±15% (never the margin — that belongs to the air).
        lane.at(t + tm.spanS + margin + rng.rnd(2, 9) * (1.35 - iv) * gmAt(t), phrase);
      }
      lane.at(run.t0 + rng.rnd(6, 14), phrase);
    }

    // ---- musicbox (melodic — claims THE AIR; usually the overlap voice) -----
    // v1's libraryMusicBox (~1915-1995), full-bodied again (Phase 3): sine +
    // 3rd-partial plink with v1's VELOCITY LAW (velGain = 0.4 + 0.6·vel — the
    // softest ping stays audible, the strong ones glint) and its envelope
    // proportions (strike, exp to a third by 100 ms, linear tail). Weather's
    // brightness breathes the shimmer dose. Every plink feeds the far-wall
    // delay — the box is the far wall's favorite voice (spec item 4). Short
    // phrases, high register, mostly chapters (airLimit 2 — when it speaks
    // over the pluck, that's the happy accident the owner asked for).
    function startMusicbox() {
      var lane = run.clock.lane("musicbox");
      var rng = run.streams.musicbox;
      function phrase(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        if (iv < 0.12 || (st !== "chapter" && rng.chance(0.7))) {
          lane.at(t + rng.rnd(6, 12) * gmAt(t), phrase);
          return;
        }
        var res = run.heldUtterance.musicbox;
        run.heldUtterance.musicbox = null;
        if (!res) {
          try { res = run.motif.request("musicbox", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(6, 12) * gmAt(t), phrase);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.26, 0.38) * (1.3 - 0.5 * iv); // the plink's quicker tongue
        var tm = phraseTiming(m, spb, 1.9, 0.5, 1.1);
        var margin = rng.rnd(3, 8);
        var tok = null;
        try { tok = run.air.tryClaim("musicbox", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.musicbox = res;
          lane.at(t + rng.rnd(3, 6) * gmAt(t), phrase);
          return;
        }
        emitEvent({
          type: "air", voice: "musicbox", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "musicbox", t);
        // Re-register at render: the plink lives upstairs. Musicbox-fresh
        // material is already born in octave 1 (the motif engine's home
        // register); shared/developed material recentres near the tonic
        // octave and gets lifted a whole octave to reach the mechanism's
        // shelf. Whole-octave shifts preserve degree classes.
        var bxMean = 0;
        for (var bi = 0; bi < m.notes.length; bi++) bxMean += m.notes[bi].deg;
        bxMean /= m.notes.length;
        var lift = (bxMean > 2.5 + run.field.size / 2) ? 0 : run.field.size;
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        var out = mixOut("musicbox", run.poolMel.at(rng.rnd(-0.55, 0.55)));
        var c = ctx;
        // Weather read once per phrase (schedule time): brightness breathes
        // v1's SHIMMER knob instead of a fixed constant (contract item 5);
        // the desk's shimmer knob scales the dose (def 1 = as-composed).
        var shimmerG = (0.005 + 0.006 * wxAt(t).brightness) * pVal("musicbox", "shimmer");
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.65, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          var btok = run.budget.claim(4, nt + nd + 0.1);
          if (!btok) continue;
          run.tokens.push(btok);
          var freq = run.field.degFreq(m.notes[i].deg + lift, 0); // read at schedule time, never cached
          var velG = 0.4 + 0.6 * vel; // v1's velocity law (~1949)
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(freq, nt);
          var g = c.createGain();
          o.connect(g); g.connect(out);
          g.connect(run.delaySendBox); // the far wall ALWAYS answers the box
          PJ2.Voice.env(g.gain, nt, [[0.003, 0.030 * velG], [0.097, 0.010 * velG], [nd - 0.1, 0]]);
          o.start(nt);
          o.stop(nt + nd + 0.02);
          // 3rd-partial shimmer — the metallic glint, well under the note
          // (v1 ~1965: velocity-scaled, gone by 60% of the note)
          var h = c.createOscillator();
          h.type = "sine";
          h.frequency.setValueAtTime(freq * 3, nt);
          var hg = c.createGain();
          h.connect(hg); hg.connect(out);
          hg.connect(run.delaySendBox);
          PJ2.Voice.env(hg.gain, nt, [[0.003, shimmerG * velG], [nd * 0.5, 0.0008], [0.06, 0]]);
          h.start(nt);
          h.stop(nt + nd + 0.02);
          emitNote({
            voice: "musicbox", freq: freq, t: nt, durS: nd,
            deg: m.notes[i].deg + lift, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        maybePost("musicbox", res, st, t);
        lane.at(t + tm.spanS + margin + rng.rnd(6, 18) * (1.3 - iv) * gmAt(t), phrase);
      }
      lane.at(run.t0 + rng.rnd(15, 30), phrase);
    }

    // ---- ambient (landscape — the sparse room) ------------------------------
    // Weighted pool of three one-shots: a page turn, a tick-tock pair (pitched
    // from the field so even the clock keeps the key), and a fire-crackle
    // cluster — PLUS, since Phase 3, the v1 Library's night outside the
    // window: owls (v1 libOwlHoot ~2568), distant thunder (sycDistantThunder
    // ~3863, at far-field dose), crickets (arielCricket ~5577, on ONE
    // oscillator — the node-economy port), and NEW rain-on-glass. The new
    // roster is weather-gated and tide-flavored (rain and thunder only when
    // wetTilt runs high; crickets when the room is quiet and the hour late;
    // owls rare, rarer still while the reader is absorbed) — but the GAP LAW
    // IS UNCHANGED (20–60s, intensity/tide-tightened, gapMul ±15%): the
    // roster grew, the density did not. One fire = one event, always.
    //
    // v1 rolled Math.random for these; here every musical draw rides the
    // ambient fork, and — unlike v1 — the owl clears its throat to the KEY
    // (field.snap on its fundamental): in this room even the birds read
    // along. Thunder, crickets and rain are unpitched textures (freq null).
    function startAmbient() {
      var lane = run.clock.lane("ambient");
      var rng = run.streams.ambient;

      function tickTock(t) {
        var tok = run.budget.claim(4, t + 0.8);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var pair = [
          { co: [4, 1], at: 0,    kind: "tick" }, // the fifth, upstairs
          { co: [0, 1], at: 0.45, kind: "tock" }, // answered by the tonic
        ];
        for (var i = 0; i < pair.length; i++) {
          var freq = run.field.degFreq(pair[i].co[0], pair[i].co[1]);
          var nt = t + pair[i].at;
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(freq, nt);
          var g = c.createGain();
          o.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, nt, [[0.002, 0.014], [0.05, 0.002], [0.03, 0]]);
          o.start(nt);
          o.stop(nt + 0.12);
          emitNote({ voice: "ambient", kind: pair[i].kind, freq: freq, t: nt, durS: 0.09, deg: pair[i].co[0], oct: pair[i].co[1] });
        }
      }

      function crackle(t) {
        var tok = run.budget.claim(3, t + 1.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(1800, t);
        hp.Q.setValueAtTime(0.7, t);
        var g = c.createGain();
        src.connect(hp); hp.connect(g); g.connect(run.layAmb);
        // A cluster of tiny humps on ONE gain chain — one source, one filter,
        // however many pops (unbounded node growth is the family sin).
        var n = rng.rint(3, 6);
        var segs = [], at = 0;
        for (var i = 0; i < n; i++) {
          var up = 0.004 + rng.rnd(0, 0.008);
          var dn = 0.02 + rng.rnd(0, 0.05);
          var rest = rng.rnd(0.05, 0.18);
          segs.push([up, 0.01 * rng.rnd(0.6, 1)]);
          segs.push([dn, 0]);
          segs.push([rest, 0]);
          at += up + dn + rest;
        }
        PJ2.Voice.env(g.gain, t, segs);
        src.start(t, src.randomOffset);
        src.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "crackle", freq: null, t: t, durS: at });
      }

      // -- owl (v1 libOwlHoot ~2568): two or three descending hoots, sine
      // through a 500 Hz lowpass, a whisper of second harmonic. The
      // fundamental SNAPS TO THE FIELD (era-aware) — v1's owl sat at 280-320
      // Hz regardless of key; ours keeps the room's pitch discipline.
      function owlHoot(t) {
        var baseFreq = run.field.snap(262 + rng.rnd(0, 60)); // draw, then snap
        var hoots = rng.chance(0.5) ? 2 : 3;
        var tok = run.budget.claim(4 * hoots, t + hoots * 0.45 + 0.4);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        for (var i = 0; i < hoots; i++) {
          var ht = t + i * 0.45, hDur = 0.25;
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(baseFreq, ht);           // anchored, then the
          o.frequency.linearRampToValueAtTime(baseFreq * 0.85, ht + hDur); // hoot droops
          var f = c.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.setValueAtTime(500, ht);
          f.Q.setValueAtTime(0.7, ht);
          var g = c.createGain();
          o.connect(f); f.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, ht, [[0.03, 0.012], [hDur * 0.6 - 0.03, 0.010], [hDur * 0.4, 0]]);
          o.start(ht);
          o.stop(ht + hDur + 0.01);
          var h = c.createOscillator(); // the hollow second harmonic, slightly sharp
          h.type = "sine";
          h.frequency.setValueAtTime(baseFreq * 2.02, ht);
          h.frequency.linearRampToValueAtTime(baseFreq * 1.7, ht + hDur);
          var hg = c.createGain();
          h.connect(hg); hg.connect(run.layAmb);
          PJ2.Voice.env(hg.gain, ht, [[0.03, 0.0035], [hDur - 0.03, 0]]);
          h.start(ht);
          h.stop(ht + hDur + 0.01);
        }
        emitNote({ voice: "ambient", kind: "owl", freq: baseFreq, t: t, durS: hoots * 0.45 });
      }

      // -- distant thunder (v1 sycDistantThunder ~3863, at far-field dose —
      // roughly half v1's peaks; this is weather beyond the window, not the
      // Sycorax storm). Three bodies: a sub sine that settles 55→35 Hz, a
      // resonant low noise boom (pre-attenuated 0.4 BEFORE the Q 5 filter —
      // pj2-voice lesson #2), and a long rolling rumble that crests mid-way.
      function distantThunder(t) {
        var durS = rng.rnd(4.5, 6);
        var peakFreq = rng.rnd(280, 360);
        var boomDur = rng.rnd(0.7, 1.1);
        var tok = run.budget.claim(9, t + durS + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var subO = c.createOscillator();
        subO.type = "sine";
        subO.frequency.setValueAtTime(55, t);
        subO.frequency.exponentialRampToValueAtTime(35, t + boomDur);
        var subG = c.createGain();
        subO.connect(subG); subG.connect(run.layAmb);
        PJ2.Voice.env(subG.gain, t, [[0.03, 0.05], [boomDur - 0.13, 0.0012], [0.1, 0]]);
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
        PJ2.Voice.env(bg.gain, t, [[0.04, 0.05], [boomDur - 0.14, 0.0012], [0.1, 0]]);
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
        PJ2.Voice.env(g.gain, t, [[0.3, 0.022], [durS * 0.5 - 0.3, 0.02], [durS * 0.5, 0]]);
        n.start(t, n.randomOffset);
        n.stop(t + durS + 0.1);
        emitNote({ voice: "ambient", kind: "thunder", freq: null, t: t, durS: durS });
      }

      // -- cricket (v1 arielCricket ~5577, node-economy port): v1 spent one
      // oscillator PER PULSE (up to 30 nodes a chirp-train); here the whole
      // train is ONE oscillator retuned between chirps (the gain sits at
      // true zero there — a silent retune can't click) under ONE multi-hump
      // envelope, crackle-style. Same cadence: 3-6 chirps at 1.7-2.4 Hz,
      // 3-5 pulses per chirp at the fixed 35 Hz trill.
      function cricket(t) {
        var chirps = rng.rint(3, 6);
        var rate = rng.rnd(1.7, 2.4);
        var pulses = rng.rint(3, 5);
        var carrier = rng.rnd(4100, 5300);
        var spacing = 1 / rate, pulseSpacing = 1 / 35;
        var total = (chirps - 1) * spacing + pulses * pulseSpacing + 0.1;
        var tok = run.budget.claim(2, t + total + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var o = c.createOscillator();
        o.type = "sine";
        var g = c.createGain();
        o.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var k = 0; k < chirps; k++) {
          var cFreq = carrier * rng.rnd(0.97, 1.03); // per-chirp color (v1)
          var pd = rng.rnd(0.014, 0.022);
          o.frequency.setValueAtTime(cFreq, t + k * spacing);
          if (k * spacing > at) { segs.push([k * spacing - at, 0]); at = k * spacing; }
          for (var i = 0; i < pulses; i++) {
            segs.push([0.002, 0.0085]);
            segs.push([Math.max(0.004, pd - 0.002), 0.0008]);
            segs.push([Math.max(0.002, pulseSpacing - pd - 0.002), 0]);
            at += 0.002 + Math.max(0.004, pd - 0.002) + Math.max(0.002, pulseSpacing - pd - 0.002);
          }
        }
        PJ2.Voice.env(g.gain, t, segs);
        o.start(t);
        o.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "cricket", freq: null, t: t, durS: at });
      }

      // -- rain-on-glass (NEW, Phase 3): band-passed noise patter — sparse
      // filtered ticks (one noise source, one high bandpass, a multi-hump
      // envelope — each hump a droplet on the pane) over a soft wash (a
      // second, wider band swelling underneath). Far-field: this is weather
      // heard THROUGH the window, gated by wetTilt at the pool draw. The
      // wetter the weather, the denser and fuller the patter.
      function rainOnGlass(t, wet) {
        var durS = rng.rnd(5, 9);
        var nTicks = rng.rint(10, 22);
        var tok = run.budget.claim(6, t + durS + 0.4);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        // the wash — a distant hiss that swells and recedes
        var wn = PJ2.Voice.noiseBuffer.source(c, 30);
        var wbp = c.createBiquadFilter();
        wbp.type = "bandpass";
        wbp.frequency.setValueAtTime(1600, t);
        wbp.Q.setValueAtTime(0.8, t);
        var wg = c.createGain();
        wn.connect(wbp); wbp.connect(wg); wg.connect(run.layAmb);
        var washPeak = 0.005 + 0.007 * wet;
        PJ2.Voice.env(wg.gain, t, [[1.8, washPeak], [durS - 3.6, washPeak * 0.9], [1.8, 0]]);
        wn.start(t, wn.randomOffset);
        wn.stop(t + durS + 0.1);
        // the ticks — droplets, each a 3 ms hump through a high narrow band
        var tn = PJ2.Voice.noiseBuffer.source(c, 30);
        var tbp = c.createBiquadFilter();
        tbp.type = "bandpass";
        tbp.frequency.setValueAtTime(3400 + rng.rnd(-400, 400), t);
        tbp.Q.setValueAtTime(5, t); // bandpass peaks at unity — no ring boost
        var tg = c.createGain();
        tn.connect(tbp); tbp.connect(tg); tg.connect(run.layAmb);
        var segs = [], at = 0;
        var meanGap = (durS - 1) / nTicks;
        for (var i = 0; i < nTicks; i++) {
          var gap = rng.rnd(meanGap * 0.4, meanGap * 1.6);
          var p = 0.008 + rng.rnd(0, 0.006);
          segs.push([gap, 0]);
          segs.push([0.003, p]);
          segs.push([0.045, 0]);
          at += gap + 0.048;
        }
        PJ2.Voice.env(tg.gain, t, segs);
        tn.start(t, tn.randomOffset);
        tn.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "rain", freq: null, t: t, durS: durS });
      }

      function oneShot(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var st = curSceneType();
        var wx = wxAt(t);
        // The weighted pool, weather-gated and tide-flavored. The BASE trio
        // keeps its Phase 1 weights; the night sounds ride on top with small,
        // gated weights (weights shape WHICH sound fires, never HOW OFTEN —
        // one fire = one event, and the gap law below is unchanged, so the
        // roster's growth cannot raise the density). late = the evening's
        // winding-down scenes; wetTilt ≥ 0.55 opens the rain/thunder gate.
        var late = (st === "reverie" || st === "candle-out") ? 1 : 0;
        var wetGate = Math.max(0, wx.wetTilt - 0.55);
        var what = rng.pickW([
          ["page", 4], ["ticktock", 3.5], ["crackle", 2.5],
          ["owl", 0.35 + 0.55 * (1 - iv) + 0.4 * late],           // rare; rarer when absorbed
          ["thunder", 0.1 + 2.2 * wetGate * (0.6 + 0.8 * tide)],  // stormy tides thunder more
          ["cricket", (0.15 + 1.1 * late) * (1 - 0.7 * iv)],      // quiet, late
          ["rain", 6 * wetGate],                                  // only when the glass is wet
        ]);
        try {
          if (what === "page") {
            pageTurn(t, 0.016, "ambient", rng); // ambient spends its OWN draws now
          } else if (what === "ticktock") {
            tickTock(t);
          } else if (what === "crackle") {
            crackle(t);
          } else if (what === "owl") {
            owlHoot(t);
          } else if (what === "thunder") {
            distantThunder(t);
          } else if (what === "cricket") {
            cricket(t);
          } else if (what === "rain") {
            rainOnGlass(t, wx.wetTilt);
          }
        } catch (e) { /* a missing one-shot is just a quieter room */ }
        // THE GAP LAW — unchanged from Phase 1 but for weather's sanctioned
        // ±15% (gapMul) and the desk's density knob (def 1 = as-composed):
        // density stays within the family contract.
        var next = rng.rnd(20, 60) * (1.3 - 0.6 * iv - 0.15 * tide) * gmAt(t) / pVal("ambient", "density");
        lane.at(t + Math.max(8, next), oneShot);
      }
      lane.at(run.t0 + rng.rnd(8, 20), oneShot);
    }

    // ---- the follower (landscape levels track the conductor) ----------------
    // Every 0.5s: nudge droneLevel and humLevel toward their intensity-shaped
    // targets with short anchored linear ramps. We shadow the current value
    // ourselves (run.droneCur/humCur) instead of reading .value mid-ramp —
    // deterministic, and it sidesteps browsers that report ramps lazily.
    // Phase 3: also the halo's breath — its level tracks weather.haloLevel
    // (0.015..0.07, always a whisper) and gutters toward zero through
    // candle-out with the scene's own progress (the strings sleep before
    // the reader does). Fx.sympathetic.setLevel ramps over the same 0.5s
    // pulse, so the halo never steps. Also the housekeeping beat: prune
    // long-expired budget tokens.
    function startFollower() {
      var lane = run.clock.lane("follow");
      function follow(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var haloV = (0.015 + 0.055 * wxAt(t).haloLevel) * pVal("halo", "level");
        if (curSceneType() === "candle-out") haloV *= Math.max(0, 1 - curSceneX());
        run.haloLevelCur = haloV;
        try { run.halo.setLevel(haloV, 0.5); } catch (eH) {}
        // Drone: never zero (floor keeps the seam warm even at 0.04);
        // slightly reined-in when stormy — the storm is the hum's register.
        var dTarget = (0.10 + 0.55 * iv) * (1.05 - 0.15 * tide);
        // Hum: silent below intensity 0.2, blooming over the next 0.25.
        var hTarget = (iv < 0.2) ? 0 : clamp((iv - 0.2) / 0.25, 0, 1);
        var K = 0.34; // one-pole-ish convergence per half-second pulse
        var dNext = run.droneCur + (dTarget - run.droneCur) * K;
        var hNext = run.humCur + (hTarget - run.humCur) * K;
        run.droneLevel.gain.setValueAtTime(run.droneCur, t);   // anchor
        run.droneLevel.gain.linearRampToValueAtTime(dNext, t + 0.5);
        run.humLevel.gain.setValueAtTime(run.humCur, t);
        run.humLevel.gain.linearRampToValueAtTime(hNext, t + 0.5);
        run.droneCur = dNext;
        run.humCur = hNext;
        // Token hygiene: anything whose end passed a while ago has been
        // auto-released by the budget's clock hook; drop our references so
        // an overnight run doesn't hoard ten thousand dead tokens.
        if (run.tokens.length > 64) {
          var keep = [];
          for (var i = 0; i < run.tokens.length; i++) {
            var tk = run.tokens[i];
            if (tk.endTimeS != null && tk.endTimeS < t - 3) run.budget.release(tk); // idempotent
            else keep.push(tk);
          }
          run.tokens = keep;
        }
        lane.at(t + 0.5, follow);
      }
      lane.at(run.t0, follow);
    }

    // ========================================================================
    // PLAY / STOP
    //
    // Stop: fade the bus ~1.5s → stop the clock → suspend the ctx. Play after
    // stop RESTARTS THE WHOLE SEEDED RUN from performance 1 (documented
    // choice per spec §7: we prefer reproducibility over tide continuity —
    // the same seed always gives the same evening from its first breath,
    // which is what makes bug reports, harness runs, and shared seeds mean
    // anything. The tide does not survive stop; it is part of the run).
    // ========================================================================

    function ensureCtx() {
      if (ctx) return ctx;
      var AC = (typeof window !== "undefined") ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) throw new Error("PJ2.Library: no AudioContext available");
      ctx = new AC();
      return ctx;
    }

    var LANE_NAMES = [
      "drone", "hum", "humSing", "pluck", "musicbox", "ambient", "follow",
      "harmony", "cadence", "seachange",
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
      try { r.clock.stop(); } catch (e) {} // cancels everything, incl. budget auto-releases…
      // …so we settle the books by hand: release every token we ever held
      // (release is idempotent; most are long since auto-released). The
      // budget MUST read zero after stop — the harness checks.
      for (var i = 0; i < r.tokens.length; i++) {
        try { r.budget.release(r.tokens[i]); } catch (e) {}
      }
      r.tokens = [];
      try { if (r.bus && r.bus.output && r.bus.output.disconnect) r.bus.output.disconnect(); } catch (e) {}
      // Detach the Phase 3 room/fx returns too: the delay's feedback loop
      // and the halo's combs otherwise keep circulating into a dead bus
      // (silent but not free) until the ctx suspends.
      try { if (r.roomClose && r.roomClose.output.disconnect) r.roomClose.output.disconnect(); } catch (e) {}
      try { if (r.roomWide && r.roomWide.output.disconnect) r.roomWide.output.disconnect(); } catch (e) {}
      try { if (r.delay && r.delay.output.disconnect) r.delay.output.disconnect(); } catch (e) {}
      try { if (ctx && typeof ctx.suspend === "function") ctx.suspend(); } catch (e) {}
      stopping = false;
    }

    function play() {
      if (playing) return;
      if (run && !run.finalized) finalize(run); // play during a stop-fade: cut clean, start fresh
      var c = ensureCtx();
      try { if (typeof c.resume === "function") c.resume(); } catch (e) {}

      // ---- one fresh world per play, all of it derived from the seed ----
      var master = PJ2.Rand.stream(seed);
      var clock = PJ2.Clock.create(c, { tickMs: 25, aheadS: 0.25 });
      var bus = PJ2.Voice.buildBus(c, { volume: masterVol, title: "Prospero's Jukebox v2" });
      for (var ai = 0; ai < analysers.length; ai++) {
        try { bus.attachAnalyser(analysers[ai]); } catch (e) {}
      }
      var streams = {
        conductor: master.fork("conductor"),
        drone: master.fork("drone"),
        pluck: master.fork("pluck"),
        musicbox: master.fork("musicbox"),
        hum: master.fork("hum"),
        ambient: master.fork("ambient"),
        joints: master.fork("joints"),
        air: master.fork("air"),
        // Phase 2 forks. "motif" and "harmony" feed the brains themselves;
        // the rest are the library's own wiring draws, kept on separate
        // streams so the brains' internal draw counts can evolve without
        // perturbing the library's gestures (and vice versa).
        motif: master.fork("motif"),
        harmony: master.fork("harmony"),
        harmonyLane: master.fork("harmony:lane"),
        cadence: master.fork("cadence"),
        seachange: master.fork("seachange"),
        humSing: master.fork("humSing"),
        // Phase 3 forks — the SOUND's own dice, so nothing timbral can ever
        // re-roll a note: "weather" is consumed at build (four draws per
        // channel), "fx" seeds the delay-drift phase (one draw at build),
        // "vowels" walks the hum's mouth, "delaySend" rolls the pluck's
        // far-wall coin per phrase, "rooms" draws the 12-20s balance ramps.
        weather: master.fork("weather"),
        fx: master.fork("fx"),
        // Phase "solve et coagula": the wedding coin and the settling's
        // placement jitter live here so no existing stream feels them.
        alchemy: master.fork("alchemy"),
        vowels: master.fork("vowels"),
        delaySend: master.fork("delaySend"),
        rooms: master.fork("rooms"),
      };

      // The Phase 2 brains and the Phase 3 sound tools. Harmony first (Motif
      // consumes it for chord-tone bias and phrase resolution); all pure or
      // lazy, all living and dying with the run. REQUIRED — fail loudly, not
      // quietly (page load order: rand, pitch, clock, voice, FX, air, motif,
      // harmony, conductor, library).
      if (!PJ2.Motif || !PJ2.Motif.create || !PJ2.Harmony || !PJ2.Harmony.create) {
        throw new Error("PJ2.Library: Phase 2 needs pj2-motif.js and pj2-harmony.js loaded first");
      }
      if (!PJ2.Fx || !PJ2.Fx.delay || !PJ2.Fx.sympathetic || !PJ2.Fx.weather || !PJ2.Fx.roomBlend) {
        throw new Error("PJ2.Library: Phase 3 needs pj2-fx.js loaded (after pj2-voice.js, before pj2-air.js)");
      }

      // TWO ROOMS (Phase 3): the close parlor is v1 Library's character —
      // short decay, a little dark; the wide hall is the same library heard
      // from the stacks — long, darker still (higher damping exponent), a
      // slower breath in its tail. Every layer is registered with the
      // roomBlend crossfader below; scenes set the balance (see ROOM_BALANCE)
      // and the equal-power law keeps total power flat through every morph.
      var roomClose = PJ2.Voice.reverb(c, { decayS: 2.0, preDelayS: 0.02, wet: 0.3, brightness: 1.15, ripple: 0.03 });
      // The wide hall is a REAL room (owner, 2026-08-03, chosen by ear in
      // room-mockup.html): St Margaret's Church, York — the National Centre
      // for Early Music's hall, measured 11 m back in the nave (OpenAIR,
      // AudioLab University of York, CC BY-SA 3.0; provenance in
      // ir/README.md). The generated-noise spec below is the FALLBACK pour
      // if the measured file can't load — decayS 4.8 keeps that fallback
      // sounding like the hall the scenes were voiced against.
      var roomWide = PJ2.Voice.reverb(c, { decayS: 4.8, preDelayS: 0.045, wet: 0.34, brightness: 1.9, ripple: { depth: 0.04, hz: 0.4 }, irUrl: "ir/rooms/library-wide-st-margarets.wav" });
      roomClose.output.connect(bus.input);
      roomWide.output.connect(bus.input);
      var roomBlend = PJ2.Fx.roomBlend(c, { close: roomClose, wide: roomWide, balance: 0.15 });

      var budget = PJ2.Voice.budget(32).bindClock(clock);
      var field = PJ2.Pitch.field({ tonicHz: 262, mode: "dorian", tuning: "et" }); // v1 Library

      // MIXER WIRING HELPERS (see MIX_LAYERS): mAttach registers one gain
      // param under a user layer, tags the node for param inspection, and
      // stamps design x the user's CURRENT setting as its initial value —
      // stop/play persistence by construction, and with everything at the
      // default (1, unmuted) every value below is exactly the design value.
      // mSlotWraps builds a melodic voice's per-seat wraps over the shared
      // panner pool (the pool problem, documented at MIX_LAYERS).
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

      // LAYER SOURCES — one gain per layer, registered with the blender
      // (which owns a close/wide send pair for each). baseBias places a
      // layer a step deeper or nearer than the scene balance: the speakers
      // sit forward, the ambient room and the halo live toward the stacks.
      var layMel = c.createGain();
      layMel.gain.setValueAtTime(1, clock.now()); // NOT mixer-owned: the per-seat wraps split pluck/box upstream
      var layHum = mAttach("hum", c.createGain(), 1);
      var layAmb = mAttach("ambient", c.createGain(), 1);
      var layHalo = mAttach("halo", c.createGain(), 1);

      // Landscape chain: cycles → droneBreath (joints only) → droneLevel
      // (intensity follower only) → mixDrone (mixer only) → the drone's
      // room pair. One writer per param, ever — the mixer gets its OWN
      // stage rather than a share of the follower's.
      var droneBreath = c.createGain();
      droneBreath.gain.setValueAtTime(1, clock.now());
      var droneLevel = c.createGain();
      droneLevel.gain.setValueAtTime(0.12, clock.now());
      droneBreath.connect(droneLevel);
      var mixDrone = mAttach("drone", c.createGain(), 1);
      droneLevel.connect(mixDrone);
      var humLevel = c.createGain();
      humLevel.gain.setValueAtTime(0, clock.now());
      var mixHumBed = mAttach("hum", c.createGain(), 1); // same stage-beside-the-follower move
      humLevel.connect(mixHumBed);

      roomBlend.register("drone", mixDrone, 0.05);
      roomBlend.register("humBed", mixHumBed, 0.0);
      roomBlend.register("hum", layHum, 0.0);
      roomBlend.register("melody", layMel, -0.06);
      roomBlend.register("ambient", layAmb, 0.12);
      roomBlend.register("halo", layHalo, 0.18);

      var poolMel = PJ2.Voice.pannerPool(c, layMel, 3);
      var mixWraps = {
        harpsichord: mSlotWraps("harpsichord", poolMel),
        musicbox: mSlotWraps("musicbox", poolMel),
      };

      // THE WEATHER — built from its own fork (all draws at build time; at()
      // is pure math), spec'd by Fx.WEATHER_LIBRARY (primes 120-600s, depths
      // sized per channel). Read at schedule time everywhere.
      var weather = PJ2.Fx.weather(streams.weather, PJ2.Fx.WEATHER_LIBRARY);

      // THE FAR WALL — one shared delay at the owner's dose (timeS 0.42,
      // feedback 0.22, damp 1600, wet 0.18: "the far wall answers", never
      // "echo effect"). Its return feeds the WIDE room's send — the answer
      // comes from the stacks, where the far wall is. The drift LFO's phase
      // is the one seeded draw ("fx" fork, documented in pj2-fx.js).
      var delay = PJ2.Fx.delay(c, {
        timeS: 0.42, feedback: 0.22, damp: 1600,
        driftHz: 0.03, driftDepth: 0.004, wet: 0.18,
        rng: streams.fx,
      });
      delay.output.connect(roomWide.send);
      // The per-voice sends are mixer-owned (each voice's user layer scales
      // its OWN echo feed): mute the music box and the far wall stops
      // answering it, rather than answering a silence forever.
      var delaySendBox = mAttach("musicbox", c.createGain(), 0.5);  // the box always speaks to the wall
      delaySendBox.connect(delay.send);
      var delaySendPluck = mAttach("harpsichord", c.createGain(), 0.35); // the pluck, only when the coin says
      delaySendPluck.connect(delay.send);

      // THE HALO — six sympathetic strings on the field's resonant frame
      // (see haloFreqs), never excited directly: they hear the pluck through
      // a whisper send (0.12) and ring what grazes them. Level breathes with
      // the weather via the follower; retunes only at the first scene
      // boundary after a sea change.
      var halo = PJ2.Fx.sympathetic(c, {
        nStrings: 6, freqs: haloFreqs(field),
        out: layHalo, level: 0.04, feedback: 0.95, damp: 3000,
      });
      // Mixer-owned under HARPSICHORD (the exciter, not the halo): a muted
      // pluck must not keep ringing the strings from beyond the grave. The
      // halo layer itself owns the RETURN (layHalo).
      var haloSend = mAttach("harpsichord", c.createGain(), 0.12);
      haloSend.connect(halo.input);

      var harmony = PJ2.Harmony.create({
        rng: streams.harmony,
        field: field,
        dramaturgyName: "library",
      });
      var motif = PJ2.Motif.create({
        rng: streams.motif,
        field: field,
        harmony: harmony,
        // The refinement arc rides the dynamic-tilt hook. This is the ONLY
        // policy key passed: kind pools, posting, seeding all stay on the
        // default (bit-identical) path — the tilt changes which transform
        // pickW favors, never how many draws anything costs.
        policy: { transformTilt: refinementTilt },
      });

      run = {
        live: true, finalized: false, finalizeId: null,
        clock: clock, bus: bus, budget: budget, field: field,
        poolMel: poolMel,
        droneBreath: droneBreath, droneLevel: droneLevel, humLevel: humLevel,
        droneCur: 0.12, humCur: 0,
        streams: streams, tokens: [],
        harmony: harmony, motif: motif,
        consortPrev: null,                 // the consort's last voicing (fallback voice-leading state)
        perfScenes: null,                  // current performance's scene-type list
        seaChange: null,                   // {atSceneIdx, target, done, label} or null
        nextCadence: null,                 // {kind, label, t: boundary} once planned, cleared at realize
        pendingGhost: null,                // extracted at performance end, seeded at the next begin
        heldUtterance: { pluck: null, musicbox: null, hum: null }, // ghosts denied the air wait here
        coagulaDone: false,                // one whole-theme settling per evening (touch c)
        // ---- Phase 3 sound state ----
        roomClose: roomClose, roomWide: roomWide, roomBlend: roomBlend,
        roomBalance: 0.15,                 // telemetry shadow of the blend's aim
        roomSeaBonus: 0,                   // +0.08 after a sea change, reset each evening
        layMel: layMel, layHum: layHum, layAmb: layAmb, layHalo: layHalo,
        mix: mix, mixWraps: mixWraps,
        weather: weather,
        delay: delay, delaySendBox: delaySendBox, delaySendPluck: delaySendPluck,
        halo: halo, haloSend: haloSend,
        haloRetuneAt: null,                // armed by the sea change, fired at the next boundary
        haloLevelCur: 0.04,
        vowelIdx: 0,                       // the mouth's walk state (set just below)
        t0: clock.now() + 0.08,
        conductor: null, air: null, airLimit: null,
      };
      // The mouth opens somewhere: v1 randomized its first vowel per track;
      // we draw it from the vowels fork so the walk is seeded end to end.
      run.vowelIdx = streams.vowels.rint(0, HUM_VOWEL_POOL.length - 1);

      // Scene-dependent air knobs ("conductor supplies", per the §5 contract):
      // the as-built conductor exposes airLimit()/overlapChance() conveniences
      // for exactly this wiring; the dramaturgy tables are the fallback so
      // the air keeps its manners even mid-handoff.
      run.airLimit = function () {
        if (run.conductor && typeof run.conductor.airLimit === "function") {
          try { return run.conductor.airLimit(); } catch (e) {}
        }
        var sc = dram.scenes[curSceneType()];
        return sc ? sc.airLimit : 1;
      };
      var airOverlapChance = function () {
        var base;
        if (run.conductor && typeof run.conductor.overlapChance === "function") {
          try { base = run.conductor.overlapChance(); } catch (e) {}
        }
        if (base == null) {
          var sc = dram.scenes[curSceneType()];
          base = sc ? sc.overlapChance : 0.1;
        }
        // Conjunctio, the chemical wedding (alchemical touch b): in the third
        // chapter the voices are MEANT to join — overlap runs twice as
        // willing, capped well below "duet as norm" (the aesthetic constants
        // still bind; this is one chapter of some evenings, not a new law).
        if (inConjunctio()) base = Math.min(0.5, base * 2);
        return base;
      };

      // The air first (the conductor takes it as opts.air for telemetry).
      // Its limit fns consult run.conductor, which is assigned just below —
      // no voice can claim before both exist.
      run.air = PJ2.Air.create({
        clock: clock,
        rng: streams.air,
        limit: run.airLimit,
        overlapChance: airOverlapChance,
      });

      // Joint tools per the §6 contract. Our dramaturgy's joint() closes over
      // `run` and prefers that, but we hand the tools object in under BOTH
      // plausible option names so any contract-faithful conductor can also
      // pass it through positionally (defensive parallel-build wiring).
      var jointTools = { ctx: c, out: layAmb, rng: streams.joints, field: field };

      run.conductor = PJ2.Conductor.create({
        clock: clock,
        rng: streams.conductor,
        dramaturgy: dram,
        // The library listens to its own conductor before the page does:
        // performance seams carry the ghost, new plans draw a sea change,
        // scene entries plan cadences for the boundary they will end on.
        onEvent: function (evt) {
          handleConductorEvent(evt);
          // Alchemical display label (shared vocabulary, see LABELS): scene
          // events carry their operation name. Attached AFTER the handler so
          // run.perfScenes (set by the begin event) is current for chapter
          // ordinals. A label is a field, never a draw — stream-invisible.
          if (evt.type === "scene") {
            evt.label = sceneLabelFor(evt.scene, evt.idx, run.perfScenes);
          }
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
      startDrone();
      startHum();
      startHumSing();
      startPluck();
      startMusicbox();
      startAmbient();

      // Born already mixed, rate side: stamp each layer's stored rate onto
      // its lanes (no-op at the default 1 — setLaneRate early-outs).
      for (var mri = 0; mri < MIX_LAYERS.length; mri++) mixRateApply(MIX_LAYERS[mri].key);

      emitEvent({ type: "engine", state: "play", seed: seed, t: clock.now() });
    }

    function stop() {
      if (!playing || !run) return;
      playing = false;
      stopping = true;
      var r = run;
      var t = r.clock.now();
      emitEvent({ type: "engine", state: "stop", t: t });
      // Silence the writers first (no new notes), let scheduled tails ring
      // under the fade, then take the whole world down at once.
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
          try { run.bus.fadeTo(masterVol, 0.08); } catch (e) {} // short ramp: click-safe
        }
      },

      // ---- the per-layer mixer (MIX_LAYERS; uniform across the tracks) ----
      // Gain-side calls consume no randomness and move no events; rate calls
      // only re-pace the layer's own lanes — a run left at the defaults
      // emits the identical note/event streams.
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
      // r multiplies the layer's event pace (1 = as-composed), clamped to
      // [0.25, 4]. Persists across performances and stop/play like volume;
      // a playing run's lanes are re-stamped live (setLaneRate rescales
      // pending events around now). Layers with no lane keep rate 1 and
      // are absent from getLayerRates().
      setLayerRate: function (key, rate) {
        var st = mixState[key];
        if (!st) return;
        var r = +rate;
        if (!isFinite(r)) r = 1;
        st.rate = clamp(r, MIX_RATE_MIN, MIX_RATE_MAX);
        mixRateApply(key);
      },
      getLayerRates: function () {
        var out = {};
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          var k = MIX_LAYERS[i].key;
          if (MIX_RATE_LANES[k] && MIX_RATE_LANES[k].length) out[k] = mixState[k].rate;
        }
        return out;
      },

      // conductor.info() + air holders + budget stats + the Phase 2 brains'
      // telemetry (current chord name + spelled tones, the planned cadence,
      // the sea-change state, motif stats summary), one flat snapshot.
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
            info.harmony = cur ? cur.name : null;
            // the chord's tones, spelled for the readout (current() already
            // carries the degree set — no harmony API growth)
            info.harmonyTones = (cur && cur.chordDegs) ? spellChordTones(cur.chordDegs) : null;
          } catch (e) {}
          // The harmony readout's approach/state lines: the planned cadence
          // (inS to its boundary, clamped ≥0) and the evening's sea change.
          try {
            info.cadence = run.nextCadence
              ? { kind: run.nextCadence.kind, label: run.nextCadence.label,
                  inS: Math.max(0, run.nextCadence.t - run.clock.now()) }
              : null;
          } catch (e) {}
          try {
            info.seaChange = run.seaChange
              ? { planned: true, done: !!run.seaChange.done, label: run.seaChange.label || null }
              : null;
          } catch (e) {}
          try { info.motif = run.motif.stats(); } catch (e) {}
          // Phase 3 telemetry for the form-demo monitor: the live weather
          // channels, the room balance the blend is aiming for, and the
          // halo's current whisper level.
          try { info.weather = wxAt(run.clock.now()); } catch (e) {}
          try { info.roomBalance = (run.roomBlend && run.roomBlend.balance) ? run.roomBlend.balance() : run.roomBalance; } catch (e) {}
          info.haloLevel = run.haloLevelCur;
          // The scene's alchemical display label (shared vocabulary — see
          // LABELS). tideLabel stays the conductor's human weather-word.
          try { info.sceneLabel = sceneLabelFor(info.sceneType, info.sceneIdx, run.perfScenes); } catch (e) {}
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

      // Multicast (family pattern): each call ADDS a listener; the returned
      // function removes it. Notes: {voice, freq|null, t, durS, deg?, oct?,
      // kind?, velocity?, motif?, gen?, phraseKind?}. Events: conductor
      // events (performance/scene/joint/tide) + {type:"air"...} claims +
      // {type:"joint-gesture"...} + {type:"engine"...} + the Phase 2
      // narration: {type:"cadence", kind, t: boundary, startT, chords} /
      // {type:"seachange", target, field, t} / {type:"ghost", voice, name,
      // t} / {type:"develop"|"answer", voice, name, gen, t}. Scene, cadence,
      // seachange and ghost events also carry `label` — the alchemical
      // display vocabulary (PJ2.Library.LABELS; shared with PLAN-GRAPHICS).
      setNoteListener: function (fn) { return addListener(noteLs, fn); },
      setEventListener: function (fn) { return addListener(eventLs, fn); },

      // Reseed is a dev control: it hard-cuts (no stop fade) so the new run
      // starts from a clean, reproducible zero. Takes effect immediately if
      // playing, else on the next play.
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

  // LABELS rides on the facade: the graphics layer (and the harness) read
  // the shared alchemical vocabulary here — one table, two consumers.
  window.PJ2.Library = { create: create, LABELS: LABELS };
})();
