// ============================================================================
// ZANKYŌ 残響 — Japanese aleatoric noise-engine (audio)
//
// A generative jukebox in the lineage of Prospero's Jukebox and Antariksh, but
// Japanese: beautiful kankyō-ongaku (environmental/ambient) textures eroded by
// Japanoise grit, on a haunting HIRAJOSHI pentatonic, structured by JO-HA-KYŪ
// (the classical slow → accelerate → burst form). A derelict orbital station,
// year 3042 — a punk noise band's idea of gagaku.
//
// Layers: subDrone, sho (cluster drone), shakuhachi (lead), koto, shamisen,
// taiko, noise (japanoise), ambient (event pool). Multiple melodic voices work
// a per-cycle motif genealogy (a theme + two subsidiaries, transform chains,
// an identity tether) and talk through a dialogue ledger with deadlines;
// everything musical is seeded (mulberry32, ?seed=) so a night is shareable.
// Above the cycles, a META-ARC: each jo-ha-kyū draws its own length and a slow
// meta-curve (~5–8 cycles per swing) drifts the mode lottery dark and back,
// scales the KIRU's severity, and tilts global density — the loop is a
// journey. Within a cycle, an ELASTIC PULSE: the taiko publishes its grid and
// koto/shamisen onsets magnetize to it as the kyū builds (shakuhachi floats).
//
// Architecture mirrors the proven Antariksh engine: ctx → grit waveshaper →
// reverb → master → compressor → destination; per-layer GainNodes; a rate-aware
// scheduler; per-layer params for the console; a jo-ha-kyū arc; an event-log
// feed. Public surface: window.ZankyoAudio
//
// ZANKYŌ 2 (Phase 0, 2026-09): the engine stands on the Prospero's Jukebox v2
// SUBSTRATE, loaded by relative path from ../prosperos-jukebox-v2/ and never
// modified here — PJ2.Rand (forked seeded streams: one per subsystem, so a
// new ambient draw can never re-roll a melody), PJ2.Clock (the lookahead
// transport: one lane per layer, the console's rate knobs are lane.rate,
// background tabs keep time), PJ2.Pitch (a mutable pitch field carrying the
// four modes — the door to sea changes), PJ2.Voice (click-safe envelopes, the
// pooled panner rack, the shared noise buffer). The grit bus, its makeup-down,
// the shamisen saturator, the master saturator/compressor/trim and the
// metallic reverb are kept exactly as tuned. Every callback receives its
// exact scheduled audio time `t` and places audio at `t`, never at "now".
// ============================================================================

window.ZankyoAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null;
  var reverbSend = null;           // the dry sum: everything that goes to the rooms, at unity, to the master
  var roomHull = null, roomCorridor = null, roomBlend = null, farWall = null;   // Phase 1: two real rooms + the corridor's answer
  var sumVoices = null, sumSho = null, sumAmb = null;                           // group sums registered with the room blend
  var halo = null, haloSend = null, layHalo = null, haloRetuneAt = null;         // Phase 3: the koto's sympathetic strings
  var weather = null;                                                            // Phase 3: PJ2.Fx.weather — the continuous modulator field
  var gritShaperB = null, gritBlendA = null, gritBlendB = null;                   // Phase 3: the second grit curve, crossfaded by the weather
  var screechBus = null;                                                         // Phase 3: the feedback-screech bodies' sum (tapped)
  var cutGrit = null, cutSho = null, cutAmb = null, cutTaiko = null;              // Phase 4: THE CUT — gains over the landscape groups (never the master); Phase M r3: the kit has its own
  var radioBus = null;                                                           // Phase 4: the lost broadcast's radio filter
  var duckGrit = null, duckSho = null, carveGrit = null, carveSho = null, carveGrit2 = null, carveSho2 = null, shelfGrit = null, shelfSho = null, pickGrit = null, pickSho = null;   // Phase M: THE CREW LOWERS ITS VOICE — one writer's gains and notches over the landscape
  var landscapeTap = null, outTrim = null;                                        // Phase M: dev taps — the landscape sum (grit bus + shō, as cut) and the output
  var layerIn = {}, presenceOf = {};                                              // Phase M: per-layer entry node → presence stage → the layer gain (so the tap hears it)
  var gritShaper = null;           // distortion bus (gritty instruments route here)
  var taikoShaper = null, taikoMakeup = null;   // Phase M (orchestrator Q4): the kit's own grit curve — it no longer shares the drone's clip
  var shamEdge = null;             // shamisen's own gentle saturator (bite without the grit-bus onset spike)
  var dryGritGain = null;          // parallel dry grit send, opened up toward the kyū climax
  var gritMakeup = null;           // the grit bus's makeup-DOWN stage (tapped by attachBusAnalyser)
  var masterSat = null;
  var bg = null;                   // background-audio handle (lock-screen survival)
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // The substrate (see header). Hard requirement: index.php loads the pj2-*
  // modules before this file; the harness evals them first.
  var PJ = window.PJ2;
  if (!PJ || !PJ.Rand || !PJ.Clock || !PJ.Pitch || !PJ.Voice) {
    throw new Error("ZankyoAudio: the PJ2 substrate (pj2-rand/pitch/clock/voice) must load first");
  }
  var clock = null;                // PJ2.Clock — created with the ctx, started per play

  // ==========================================================================
  // SEEDED STREAMS — every musical choice flows through a forked PJ2.Rand
  // stream; a performance is reproducible and shareable (?seed=). Each
  // subsystem owns its stream (the kolob-text lesson: adding a draw to the
  // ambient pool must not re-roll every melody after it). Streams are
  // re-forked from the master seed at every play(), so stop → play replays
  // the same performance. Math.random survives only in noise-buffer /
  // reverb-IR generation, where it shapes texture, not music.
  // ==========================================================================
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 3042;
      }
    } catch (e) {}
    return (Date.now() % 0xffffffff) >>> 0;
  })();
  // 逸脱 W0 — the dev override for the night's distance. `?far=0.95` forces a
  // far night, `?far=0` forces home. The draw is still TAKEN either way (see
  // farDraw below): only the value is replaced, so a forced night leaves the
  // far stream exactly where an unforced one would.
  var farForced = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]far=([0-9.]+)/);
        if (m) { var v = parseFloat(m[1]); if (isFinite(v)) return v < 0 ? 0 : v > 1 ? 1 : v; }
      }
    } catch (e) {}
    return null;
  })();
  // form: cycle lengths, the meta-swing, the mode lottery, the KIRU's dice.
  // motif: the working set, transforms, the ledger. One per voice body. The
  // last four are reserved for later phases (weather field, joints,
  // visitations) and the console's ♪ audition, which must never perturb a
  // performance in progress.
  var STREAM_LABELS = ["form", "motif", "shakuhachi", "koto", "shamisen", "sho", "subDrone",
    "taiko", "noise", "ambient", "weather", "joints", "visit", "sample",
    "conductor", "air", "rooms", "fx",                                    // Phase 1: the form, the air, the rooms
    "hichiriki", "biwa", "pa", "halo",                                    // Phase 3: the new bodies
    "signal",                                                              // S1: the receiver — reel choice, window, in-point, the dropouts (zk-broadcast.js)
    "far"];                                                                // W0: 逸脱 — the night's distance from home, its departures, their parameters (zk-far.js)
  var S = null;                                // the streams, forked per play
  function forkStreams() {
    var master = PJ.Rand.stream(seed);
    S = {};
    for (var i = 0; i < STREAM_LABELS.length; i++) S[STREAM_LABELS[i]] = master.fork(STREAM_LABELS[i]);
    // THE WEATHER (Phase 3): PJ2.Fx.weather — slow deterministic drift the
    // whole engine reads at schedule time; built here, four draws per channel
    // at build and NONE after (the determinism contract). Knob values are
    // offsets on it: brightness (string lowpass, shō cutoff), breath
    // (shakuhachi noise / vowel, muraiki odds), gritColor (the noise layer's
    // filter centre; the grit curve's crud via the second curve's crossfade),
    // gapMul (±15 % on phrase gaps), roomTilt (±0.05 on the room balance).
    weather = PJ.Fx.weather(S.weather, ZK_WEATHER);
  }
  var ZK_WEATHER = {
    brightness: { period1: 331, period2: 487, depth: 0.42 },
    breath:     { period1: 211, period2: 389, depth: 0.38 },
    gritColor:  { period1: 293, period2: 557, depth: 0.45 },
    gapMul:     { period1: 173, period2: 443, depth: 0.35 },
    roomTilt:   { period1: 257, period2: 521, depth: 0.45 },
  };
  var WX_STILL = { brightness: 0.5, breath: 0.5, gritColor: 0.5, gapMul: 0.5, roomTilt: 0.5 };
  function wxAt(t) { return weather ? weather.at(t) : WX_STILL; }

  // ==========================================================================
  // 逸脱 ITSUDATSU — THE FAR TAIL (W0)
  // ==========================================================================
  // One draw at PLAY, on its own fork, sets the night's DISTANCE FROM HOME.
  // Four nights in five come out home and are the engine as it shipped at
  // 2.1.0-rc.1, note for note; the rest depart. The law, the registry of
  // departures and the naming all live in zk-far.js (pure, no audio) — this
  // is only the engine's window onto tonight's answer.
  //
  // THE CONTRACT, and the reason home nights stay byte-identical:
  //   · every far draw happens at exactly two moments — the night draw here,
  //     and the per-cycle lift at plan time (W4). Nothing else ever draws.
  //   · FAR.on/amt/p are pure LOOKUPS. A hook asked ten thousand times costs
  //     nothing and cannot move any stream.
  //   · at d < ZK_FAR.D_HOME the night is `home` and every accessor answers
  //     false / identity, so the only reachable code is the code that was
  //     already there.
  var farNight = null;                         // the CYCLE's view — what all 31 read sites see
  var farNightDrawn = null;                    // the night as drawn at play(), which never changes
  var farCycleD = 0;                           // W4: this cycle's own distance after the meta-tide's lift
  var FAR_NONE = { d: 0, home: true, ids: [], dep: {}, kana: "家", name: "home", label: "家 home" };
  function farDraw() {
    var M = window.ZK_FAR;
    if (!M || !S || !S.far) { farNight = FAR_NONE; return farNight; }
    try { farNightDrawn = M.night(S.far, farForced); } catch (e) { farNightDrawn = FAR_NONE; }
    farNight = farNightDrawn; farCycleD = farNight.d;
    return farNight;
  }
  var FAR = {
    night: function () { return farNight || FAR_NONE; },
    d:     function () { return (farNight || FAR_NONE).d; },
    home:  function () { return !farNight || farNight.home; },
    // is this departure live tonight?
    on:    function (id) { return !!(farNight && farNight.dep[id]); },
    // how far it goes tonight, 0 when it is not live
    amt:   function (id) { var p = farNight && farNight.dep[id]; return p ? p.amt : 0; },
    // its drawn parameters, or null
    p:     function (id) { return (farNight && farNight.dep[id]) || null; },
    // THE PITCH CHOKE POINT (W1). Every body's note function passes its
    // frequency through here before it becomes an oscillator, so the tuning
    // departures have ONE seam instead of nine. `voice` is the layer name,
    // `t` the scheduled audio time — the gliding departures are functions of
    // time, never of "now". Identity on every home night, which is what the
    // byte-identity gate measures.
    //
    // THE ORDER IS A MUSICAL CLAIM, not an implementation detail:
    //   unwarp → 耳 ear → 双 bito → warp → × glide
    // 撓 sag is the FIELD's own tuning, so the per-voice disagreements (耳 a
    // plucked body tuned by ear against tempered winds, 双 a voice in another
    // mode entirely) happen INSIDE the field, in field space, and the night's
    // octave is applied over the top of them. 螺 and 弛 move everything
    // together — they are transposition, not tuning — so they multiply last.
    pitch: function (voice, f, t) {
      var x = FAR.mapped(voice, f);
      return farGlideOn ? x * farGlideMul(t) : x;
    },
    // The choke point WITHOUT the glide: where a voice's pitch sits in the
    // night's own field before the world starts moving under it. Everything
    // sustained works from this, because a partial and a ramp chain both need
    // a base the glide has NOT yet been applied to.
    mapped: function (voice, f) {
      if (!farPitchOn) return f;
      var x = f;
      if (farWarpK !== 1) {
        x = farUnwarp(f);
        if (farEar && FAR_PLUCKED[voice]) x = farEarSnap(x);
        if (farBito && farBito.camp[voice]) x = farBitoSnap(x);
        return farWarp(x);
      }
      if (farEar && FAR_PLUCKED[voice]) x = farEarSnap(x);
      if (farBito && farBito.camp[voice]) x = farBitoSnap(x);
      return x;
    },
    // THE SUSTAINED SEAM (W1, promised to the critic in W0 r1). The sub-drone
    // and the shō hold one oscillator for 14–36 s; under 螺 or 弛 the field
    // moves underneath them, and a drone that did not move is exactly the
    // beating the critic's listening brief names as the pitch family's failure
    // mode. So a sustained voice writes an ANCHORED RAMP CHAIN across its own
    // life from THE SAME multiplier the choke point uses — a voice and a drone
    // scheduled for the same instant cannot disagree by construction.
    //
    // ONE CONVENTION, and it is the whole point: the base handed in is ALWAYS
    // UNGLIDED — the pitch this thing would sound at if the world were still —
    // and this function owns both the onset value and the chain. The first
    // version had two conventions (a fundamental ramping from f0/glideMul, a
    // partial ramping from f) and the critic traced what that ambiguity cost:
    // the sub-drone, handed an unglided subRoot(), started every re-fire at
    // the HOME pitch and slid the whole glide depth — −592 ¢ in 0.3 s — while
    // the shō partials, handed an already-glided value, had the glide applied
    // twice and ran away from their own fundamental. Both wrong, in opposite
    // directions, from the same ambiguity. Now there is nothing to get wrong.
    //
    // A body's own overtones are physics — a sawtooth's partials are exact
    // integers — so the field's stretched octave and the per-voice tunings do
    // NOT apply inside one note's spectrum, only the glide does, which is why
    // partials pass `base × k` and never go through mapped() themselves.
    // (撓's claim is that nothing is out of tune WITH ITSELF; snapping a shō
    // pipe's fifth partial to a scale degree would be the opposite of that.)
    // A MELODIC NOTE rides the glide on DETUNE (critic W1 r1, item 2). Its
    // frequency was already placed at the glide's value at its onset, but a
    // note of two or three seconds under 螺 or 弛 would then hold still while
    // the drones kept sinking — and the critic measured what that costs: a
    // spiral night came out ROUGHER than its own home (rn p99 0.205 vs 0.151),
    // which is beating, which is the exact failure mode the listening brief
    // names for this family. Detune is additive cents and nothing else writes
    // it here, so it composes with the bends, the yuri vibrato and the
    // glideFrom portamento instead of fighting them for `frequency`.
    glideDetune: function (param, t, durS, baseCents) {
      var c0 = baseCents || 0;
      param.setValueAtTime(c0, t);
      if (!farGlideOn || !(durS > 0)) return;
      var m0 = farGlideMul(t), step = 0.05, last = 0, lastX = 0, n = 0, x;
      for (x = step; x < durS; x += step) {
        var rel = 1200 * Math.log(farGlideMul(t + x) / m0) / Math.LN2;
        if (Math.abs(rel - last) < FAR_GLIDE_EPS && x - lastX < FAR_GLIDE_MAX_DT) continue;
        param.linearRampToValueAtTime(c0 + rel, t + x);
        last = rel; lastX = x;
        if (++n >= FAR_GLIDE_MAX) break;
      }
      param.linearRampToValueAtTime(c0 + 1200 * Math.log(farGlideMul(t + durS) / m0) / Math.LN2, t + durS);
    },
    glidePartial: function (param, base, t, durS) {
      var f0 = farGlideOn ? base * farGlideMul(t) : base;
      param.setValueAtTime(f0, t);
      if (farGlideOn && durS > 0) farGlideRamps(param, base, t, durS);
      return f0;
    },
  };

  // ---- the time departures (all identity while farTimeOn is false) ----
  // 遅 dilation, 弛 varispeed's time half and 影 tempo canons are ONE function
  // of the scheduled time, and deliberately NOT clock.lane(x).rate: setLaneRate
  // rescales pending events around ctx.currentTime — a "now" read — so a
  // departure that breathed through the lane rates would move the note stream
  // by however late the pump happened to fire, and REPRO under the critic's
  // timer jitter would fail. (The console's RATE knobs get away with it
  // because a human turns them once.) Here everything is a pure function of
  // the time an event was SCHEDULED for, so two runs of a seed are identical
  // however sloppy the timers are.
  //
  // It multiplies exactly two things — the reschedule delay inside after() /
  // afterRaw(), which every body already routes its "ask again later"
  // through, and the `beat` local in the five phrase functions, so notes
  // stretch WITH the gaps instead of gaps opening around unchanged notes.
  var farTimeOn = false, farDilate = null, farCanon = null;
  var farCycleRate = 1;                          // 遅: this cycle's own tempo (a TIME factor: >1 slower), fixed at plan time
  var farPlanN = 0;                              // which performance the plan is for — the dilation draw's index
  function farTimeMul(layer, t) {
    if (!farTimeOn) return 1;
    var m = farDilate ? farCycleRate : 1;
    // 弛: a tape that sags in pitch sags in time by the SAME ratio — it is one
    // motor. So the time factor is the reciprocal of the pitch multiplier: as
    // the pitch falls the seconds get longer.
    if (farVari) m /= farGlideMul(t);
    return m;                                    // 影 is NOT here: it owns the plucked voices' beat outright (see farCanonTake)
  }
  // 影 — a CANON, not merely three tempos (critic W1 r1 item 12, confirmed by
  // the orchestrator): the koto, shamisen and biwa take THE SAME MATERIAL,
  // enter one after another `spreadS` apart, and each runs it at its own
  // duration ratio (3:4:5). They converge, pass and diverge — which only means
  // anything if they are demonstrably the same phrase. The first version
  // scaled the three voices' tempi and let them play whatever they liked,
  // which is a tempo relationship with nothing in it to hear.
  //
  // The SUBJECT is whichever of the three phrases first in a cycle; the other
  // two read it back (fitted to their own register) for as long as the entry
  // window lasts, then it is spent and the next subject is taken. Nothing is
  // drawn here — the subject is a memory, not a decision — so the canon costs
  // no randomness and cannot perturb a stream.
  var FAR_CANON_VOICES = ["koto", "shamisen", "biwa"];
  var FAR_CANON_HOME = { koto: 0.4, shamisen: 0.28, biwa: 0.9 };   // their own beats, for the density-preserving base above
  // the phrase functions, by name, so the canon's leader can call the others in
  // (they are declared far below; a var reference is resolved at call time)
  var FAR_CANON_START = { koto: function (t) { kotoPhrase(t); }, shamisen: function (t) { shamisenPhrase(t); }, biwa: function (t) { biwaPhrase(t); },
    shakuhachi: function (t) { shakuhachiPhrase(t); }, hichiriki: function (t) { hichirikiPhrase(t); } };
  // ==========================================================================
  // THE SHARED SUBJECT — one engine, four departures (W1 影, W2 重 継 群)
  // ==========================================================================
  // A leader announces a phrase, cancels the other voices' pending phrases and
  // schedules their entries at anchors it chooses; each taker renders the same
  // material its own way. W1 built this for 影 and it turned out not to be
  // canon-specific at all — four of the plan's departures are this shape with
  // different answers to three questions: WHO takes it, WHEN, and WHAT they do
  // with it.
  //
  //   影 canon   the 3 plucked   at i·spreadS      same notes, beat × the ratio
  //   重 hetero  all 5 melodic   at 0…lagS jittered same notes, own ornaments
  //   継 hocket  all present     the subject's own note times, ONE NOTE EACH
  //   群 swarm   6–10 entries    at i·gapS, short   same notes, own register
  //
  // So there is one `farTakePlan` and one taker path, and adding a departure
  // means answering the three questions, not copying the function. (If I ever
  // find myself copying it, the abstraction is wrong.)
  //
  // Determinism: the subject is a MEMORY, not a decision. Nothing here draws.
  var farSubject = null;   // { notes, at, lead, taken, n, mode, plan }
  var farHetero = null, farHocket = null, farSwarm = null, farPoly = null, farMirror = null, farClouds = null;
  var farRev = null, farMetal = null, farNlead = null;

  // Which departure owns the ensemble right now, and its voice list. Only one
  // can: they are all "everybody plays this phrase" and two at once is mud, so
  // the order below is the precedence — the rarer (higher-threshold) departure
  // wins, which is also the one the night is named for.
  var FAR_MELODIC = ["shakuhachi", "hichiriki", "koto", "shamisen", "biwa"];
  var FAR_MEL_SET = { shakuhachi: 1, hichiriki: 1, koto: 1, shamisen: 1, biwa: 1 };
  function farEnsemble() {
    if (farSwarm) return { kind: "swarm", voices: FAR_MELODIC, p: farSwarm };
    if (farHocket) return { kind: "hocket", voices: FAR_MELODIC, p: farHocket };
    if (farCanon) return { kind: "canon", voices: FAR_CANON_VOICES, p: farCanon };
    if (farHetero) return { kind: "hetero", voices: FAR_MELODIC, p: farHetero };
    return null;
  }
  // How many entries the gesture wants, and where each one falls after the
  // subject's onset.
  function farEntryAt(E, i) {
    if (E.kind === "canon") return i * E.p.spreadS;
    if (E.kind === "swarm") return i * E.p.gapS;
    if (E.kind === "hetero") return (i / Math.max(1, E.voices.length - 1)) * E.p.lagS;
    return 0;                                   // hocket: everyone is inside one phrase's own times
  }
  function farHocketLine(phrase, reps) {
    var out = [];
    for (var r = 0; r < reps; r++) for (var i = 0; i < phrase.length; i++) out.push(phrase[i]);
    return out;
  }
  function farEntryCount(E) {
    // 群: only the first three entries are real bodies — the rest are the
    // swarm's own shadows on the cheap body, which is where the concurrency
    // budget is actually won.
    return E.kind === "swarm" ? 3 : E.voices.length;
  }

  // ==========================================================================
  // 金 METAL (W3) — ring modulation and FM, inharmonic but still pitched
  // ==========================================================================
  // The plan: "ring modulation of the shō by the sub-drone; the bells and the
  // koto through FM — inharmonic, gong-like, still pitched."
  //
  // THE FLOOR AND THE CEILING ARE ONE NUMBER, which is what makes this the
  // most interesting departure to build: the critic's floor is roughness over
  // brightness, rn ÷ (centroid/100), home median 0.099–0.11 — and the harshness
  // cap is on brightness alone. So 金 must raise the RATIO without raising its
  // denominator. Inharmonic, not merely bright.
  //
  // Ring modulation is exactly that instrument and it is not a coincidence:
  // multiplying a pipe at f by the drone at m yields the pair f−m and f+m and
  // NO carrier. The sidebands sit symmetrically about f in frequency, so the
  // power-weighted centroid barely moves, while f−m and f+m beat against the
  // cluster's other pipes — roughness up, brightness flat. FM by contrast adds
  // partials UPWARD with the index, so the koto's modulator sits at an
  // inharmonic ratio BELOW its carrier and the string's own lowpass (~4f)
  // stays where it is: sidebands on both sides rather than a bright stack.
  //
  // Cost, counted before wiring rather than after (peakSources ≤ 110 with four
  // sources of margin at the tightest): the shō's ring is ONE modulator shared
  // by a whole cluster — 1 source and 3 gains per cluster, not per pipe. The
  // koto's FM is 1 source per plucked note, short-lived; measured below.
  // ONE modulator for the whole night, not one per cluster. The first version
  // built a modulator per shō cluster, and because clusters overlap that cost
  // two concurrent sources and took a 群 night to 111 against the hard 110.
  // It is also the truer object: the thing doing the modulating is the
  // reactor's drone, and there is one of those — so it is created once, tracks
  // the tonic through a sea change, and stops with the clock.
  var farMetalMod = null, farMetalAmp = null;
  function farMetalModulator(t) {
    if (farMetalMod) return farMetalAmp;
    var c = ctx;
    farMetalMod = c.createOscillator(); farMetalAmp = c.createGain();
    farMetalMod.type = "sine";
    farMetalMod.frequency.setValueAtTime(subRoot(), t);
    farMetalAmp.gain.setValueAtTime(farMetal.ringMix, t);
    farMetalMod.connect(farMetalAmp);
    farMetalMod.start(t);
    return farMetalAmp;
  }
  function farMetalRing(dryIn, out, t, durS) {
    var p = farMetal;
    if (!p || !ctx) return false;
    var c = ctx, dry = c.createGain(), ring = c.createGain();
    dry.gain.setValueAtTime(1 - p.ringMix, t);
    ring.gain.setValueAtTime(0, t);              // the carrier is multiplied away: DC zero, the modulator swings it
    farMetalModulator(t).connect(ring.gain);
    dryIn.connect(dry); dry.connect(out);
    dryIn.connect(ring); ring.connect(out);
    return true;
  }
  // FM on a body whose source is a buffer: an oscillator into `detune` at audio
  // rate IS frequency modulation, and detune is free on these bodies (the W1
  // glide uses it only under 螺/弛, and the two compose additively).
  function farMetalFM(param, carrierHz, t, durS) {
    var p = farMetal;
    if (!p || !ctx || !(carrierHz > 0)) return;
    var c = ctx, mod = c.createOscillator(), amp = c.createGain();
    mod.type = "sine";
    mod.frequency.setValueAtTime(carrierHz * FAR_METAL_RATIO, t);   // inharmonic, and below the carrier
    amp.gain.setValueAtTime(p.fmIndex * 55, t);                     // cents of deviation
    mod.connect(amp); amp.connect(param);
    mod.start(t); mod.stop(t + durS + 0.05);
  }
  var FAR_METAL_RATIO = 0.7071;                  // √½ — irrational to the carrier, so the sidebands are inharmonic

  // ==========================================================================
  // 逆 REVERSE (W3) — envelopes played backwards
  // ==========================================================================
  // "Plucks that swell, breaths that end in the attack." PJ.Voice.env takes
  // cumulative [dt, value] segments from true zero, so the time-reverse of an
  // envelope is the same durations in reverse order carrying the PREVIOUS
  // value at each step — the last segment lands back at zero, which keeps the
  // writer's from-zero-to-zero contract and its click-safety with it.
  //
  // Which notes reverse is a deterministic function of the note's own start
  // time, NOT a draw: a departure that changes timbre should not also shift
  // every later pitch by consuming a number from the voice's stream.
  // Forward the path is 0 → v1 → v2 → … → vn over d1, d2, … dn. Reversed it is
  // the same values backwards over the same durations backwards, and because a
  // note's forward envelope ends at zero the reversal STARTS at zero too — so
  // env's from-true-zero anchor is honoured rather than worked around.
  function farRevEnv(segs) {
    var n = segs.length, out = [], i;
    for (i = 0; i < n; i++) out.push([segs[n - 1 - i][0], i === n - 1 ? 0 : segs[n - 2 - i][1]]);
    return out;
  }
  function farRevPick(t) {
    if (!farRev) return false;
    var h = Math.imul((t * 1000) | 0, 0x9e3779b1) >>> 0;      // one hash, no stream draw
    return (h / 4294967296) < farRev.share;
  }
  // The engine's bodies all write their amplitude through PJ.Voice.env, so 逆
  // is one wrapper at that seam rather than a change in every body.
  function farEnv(param, t0, segs, base) {
    return PJ.Voice.env(param, t0, (farRev && farRevPick(t0)) ? farRevEnv(segs) : segs, base);
  }

  // ==========================================================================
  // 凍 FREEZE (W3) — a note held into a drone
  // ==========================================================================
  // "A shakuhachi note held into a drone for a minute (jittered sustained
  // partials), the ensemble re-tuning around it." The engine's longest melodic
  // note today is 2.4–4.0 s at p99 with one 11.1 s outlier and ZERO over 20 s
  // (the critic's floor), so a 20–80 s hold is not a long note — it is a
  // different kind of event, and it needs the air for its whole length.
  function farFreeze(f, t0) {
    var p = farNight && farNight.dep.freeze;
    if (!p || !ctx) return 0;
    var c = ctx, holdS = p.holdS, out = panAt("shakuhachi", 0), R = S.far.fork("freeze:" + Math.round(t0));
    var bus = c.createGain();
    bus.connect(out);
    // the body: the fundamental and three partials, each drifting a few cents
    // against the others so the tone breathes instead of sitting still
    var parts = [[1, 0.055], [2, 0.016], [3, 0.010], [4.02, 0.006]];
    for (var i = 0; i < parts.length; i++) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.setValueAtTime(f * parts[i][0], t0);
      var lfo = c.createOscillator(), lg0 = c.createGain();
      lfo.type = "sine"; lfo.frequency.setValueAtTime(0.03 + R.next() * 0.09, t0);
      lg0.gain.setValueAtTime(p.jitterC * (0.5 + R.next()), t0);   // cents of drift
      lfo.connect(lg0); lg0.connect(o.detune);
      lfo.start(t0); lfo.stop(t0 + holdS + 3);
      o.connect(g); g.connect(bus);
      PJ.Voice.env(g.gain, t0, [[6, parts[i][1]], [holdS - 9, parts[i][1]], [3, 0]]);
      o.start(t0); o.stop(t0 + holdS + 0.3);
    }
    emitNote("shakuhachi", f, t0, holdS);
    // it holds the air: nobody talks over a minute-long held tone
    airHoldAdd("shakuhachi", t0 - 0.2, t0 + holdS, "freeze");
    emitEvent({ cat: "far", label: "凍 the note freezes", detail: Math.round(holdS) + "s · " + noteName(f) + " · ±" + p.jitterC.toFixed(1) + " cents" }, t0);
    return holdS;
  }

  // ==========================================================================
  // A CHEAP BODY for the dense departures (W2: 群 and 雲)
  // ==========================================================================
  // 群 is 6–10 overlapping entries and 雲 is hundreds of short notes, and the
  // hard constraint of this phase is CONCURRENT SOURCES: the base peaks at 104
  // and the ceiling is 110, so there are six to spend. A plucked note costs
  // about three sources (buffer, pick burst, sparkle) and its own filter and
  // panner; at a swarm's density that is thirty.
  //
  // So these two get one oscillator and one gain per event, into a bus built
  // ONCE per gesture — filter, panner, layer gain amortised across the whole
  // burst. One source per event instead of three, and the node count roughly
  // halved. That is not a compromise dressed as a design: micropolyphony and a
  // stochastic cloud are about DENSITY AND BLUR, not about the individual
  // timbre of the two hundredth note, and the simpler body is what makes the
  // mass audible as a mass. (The critic reached the same conclusion from the
  // other side — Ligeti's entries are close, not many-bodied.)
  function farCheapBus(layer, t, cutoff, pan, peak) {
    var c = ctx, lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, t); lp.Q.setValueAtTime(0.6, t);
    g.gain.setValueAtTime(peak, t);
    lp.connect(g); g.connect(panAt(layer, pan));
    return { input: lp, gain: g };
  }
  function farCheapNote(bus, f, t, dur, peak, glideTo, layer) {
    var c = ctx, o = c.createOscillator(), g = c.createGain();
    // A cheap body is still a note: it goes through emitNote like every other,
    // so the viz strikes for it, the crew lowers its voice for it, and every
    // instrument that reads the note stream can see it. A departure invisible
    // to the note stream would be invisible to every gate in this program.
    if (layer) emitNote(layer, f, t, dur);
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t);
    if (glideTo > 0 && glideTo !== f) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    o.connect(g); g.connect(bus.input);
    var atk = Math.min(0.012, dur * 0.25);
    // 逆 reaches the cheap body too: a cloud of swelling grains is as much the
    // departure as a pluck that swells, and leaving it out meant a cloud night
    // diluted 逆's share with thousands of un-reversed events.
    farEnv(g.gain, t, [[atk, peak], [Math.max(0.01, dur - atk - 0.015), peak * 0.35], [0.015, 0]]);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ==========================================================================
  // 群 SWARM (W2) — a canon of 6–10 entries at short delays
  // ==========================================================================
  // The plan: "the air's limit is lifted and the motif engine runs a canon of
  // 6–10 entries at short delays — micropolyphony on a Japanese pentatonic."
  // The first three entries are the station's own voices, through the shared
  // subject engine; the rest are the swarm proper, on the cheap body, each an
  // octave-displaced copy entering a gap later. Three bodies you can pick out
  // and a cloud of their own shadows behind them, which is what the texture is.
  function farSwarmTail(phrase, now, beat, center) {
    if (!farSwarm || !phrase || phrase.length < 2) return;
    var n = Math.max(2, Math.round(farSwarm.entries) - 3);
    var R = S.far.fork("swarm:" + Math.round(now * 4));
    for (var e = 0; e < n; e++) {
      // Each shadow entry belongs to a DIFFERENT body, and its own bus. They
      // all went out under one layer name at first, which made a swarm of eight
      // entries read as one voice everywhere downstream — to the polyphony
      // measure, to the viz, and to the crew's duck. A shadow of the koto is
      // still the koto's shadow; a swarm is the whole band's.
      var lay = FAR_MELODIC[(3 + e) % FAR_MELODIC.length];
      var bus = farCheapBus(lay, now, 2600, R.rnd(-0.55, 0.55), 1);
      var t = now + (3 + e) * farSwarm.gapS, oct = (e % 3) - 1;
      var notes = fitToRegister(phrase, center + oct * field.size);
      for (var i = 0; i < notes.length; i++) {
        var d = Math.max(0.1, notes[i].durBeats * beat);
        farCheapNote(bus, SCALE[notes[i].deg].freq, t, d, 0.030 + 0.012 * R.next(), 0, lay);
        t += d;
      }
    }
    emitEvent({ cat: "far", label: "群 the swarm", detail: n + " shadow entries at " + farSwarm.gapS.toFixed(2) + "s · " + phrase.length + " notes each" }, now);
  }

  // ==========================================================================
  // 雲 CLOUDS (W2) — the plucked bodies as stochastic glissando clouds
  // ==========================================================================
  // "Hundreds of short notes on distributions, not phrases." The voice stops
  // phrasing and becomes a distribution: `rateHz` events a second across
  // `spanOct` octaves around its own centre, each a short glide. The plan's own
  // compatibility rule (no clouds under a glacial dilation) is enforced in the
  // registry, where it belongs.
  // The whole of a plucked voice's turn, under 雲: a burst instead of a phrase,
  // its own claim on the air, and its own rest afterwards. Kept in one place so
  // the three voices share it rather than each growing a copy.
  function farCloudSpan(layer, R, now, center, tok, margin, arc, again) {
    var durS = 2.5 + R.next() * 5;
    var t = farCloudBurst(layer, R, now + 0.05, center, durS);
    if (tok) tok.until = t + margin;
    var rest = (2 + R.next() * 5) * (1 - arc * 0.4) * metaRestMul() * gapMulAt(t) / trimOf(layer);
    afterSpan(layer, now, (t - now) + rest * farTimeMul(layer, now), again);
  }
  var FAR_CLOUD_VOICES = 5;                      // notes in the air at once, per clouding voice
  function farCloudBurst(layer, R, now, center, durS) {
    var rate = farClouds.rateHz, n = Math.max(4, Math.round(rate * durS));
    if (n > 220) n = 220;                        // a burst is a burst, not a night
    var bus = farCheapBus(layer, now, 3200, R.rnd(-0.5, 0.5), 1);
    var lo = center - farClouds.spanOct * field.size, hi = center + farClouds.spanOct * field.size, t = now;
    for (var i = 0; i < n; i++) {
      var a = foldDeg(Math.round(lo + R.next() * (hi - lo)));
      var b = foldDeg(a + Math.round((R.next() * 2 - 1) * 4));
      // A cloud's concurrency is its event RATE times its note LENGTH, and
      // nothing was tying those two together: at 15 events a second with notes
      // up to 2.2 s long, three plucked voices clouding at once peaked at 143
      // concurrent sources against a ceiling of 110. So the note length is
      // capped so that a cloud holds about FAR_CLOUD_VOICES notes in the air at
      // a time whatever its rate — a denser cloud is made of shorter notes,
      // which is also what a denser cloud sounds like.
      var d = Math.max(0.06, Math.min(farClouds.glissS * (0.4 + R.next()), FAR_CLOUD_VOICES / rate));
      farCheapNote(bus, SCALE[a].freq, t, d, 0.020 + 0.014 * R.next(), SCALE[b].freq, layer);
      t += (durS / n) * (0.5 + R.next());
      if (t > now + durS) break;
    }
    emitEvent({ cat: "far", label: "雲 a cloud", detail: layer + " · " + n + " events over " + durS.toFixed(1) + "s · " + farClouds.spanOct.toFixed(1) + " oct" }, now);
    return t;
  }

  // ==========================================================================
  // 鏡 STRICT MIRROR (W2) — every phrase answered by its retrograde-inversion
  // ==========================================================================
  // The plan: "every phrase answered by its exact retrograde-inversion; the
  // ledger enforces it." The engine already has both transforms and a real
  // obligation ledger, but the ledger CHOOSES its answer; 鏡 removes the
  // choice. The answer is rendered directly on the answering voice — the same
  // way the sankyoku shadow already works — so it is exact by construction
  // rather than exact by hope, and it lands at lagBeats rather than at
  // whenever that voice next happened to wake (the critic measured 10–17 s
  // between accidental mirrors at home; this one answers inside a phrase).
  //
  // The axis is where the inversion pivots: the tonic, the fifth, or the
  // phrase's own last note — the third being the one that keeps the answer in
  // the same register as the call.
  // 鏡 also stands the loose sankyoku shadows down (the koto shadowing the
  // shakuhachi, the shamisen shadowing the koto): they inject notes into
  // exactly the voice that is about to answer, and a night whose rule is
  // "every phrase answered EXACTLY" cannot also have voices half-echoing each
  // other by the dice. Same reasoning as the idioms standing aside under 影.
  var FAR_MIRROR_ANSWER = { shakuhachi: "koto", koto: "shamisen", shamisen: "koto", biwa: "koto", hichiriki: "shakuhachi" };
  // The inversion is computed in UNFOLDED degree space and then transposed by
  // whole octaves to fit the register. Folding each note as it was made — which
  // is what foldDeg does, one octave at a time — silently changed the intervals
  // of any note that landed outside the table, so the "exact" retrograde-
  // inversion was exact only for phrases that happened to stay in range. An
  // octave transposition of the whole answer preserves every interval.
  function farMirrorOf(phrase, axisDeg) {
    var out = [], i, lo = 1e9, hi = -1e9, d;
    for (i = phrase.length - 1; i >= 0; i--) {
      d = 2 * axisDeg - phrase[i].deg;
      out.push({ deg: d, durBeats: phrase[i].durBeats });
      if (d < lo) lo = d; if (d > hi) hi = d;
    }
    var n = field.size, shift = 0;
    while (lo + shift < 0) shift += n;
    while (hi + shift > SCALE.length - 1) shift -= n;
    for (i = 0; i < out.length; i++) out[i].deg = Math.max(0, Math.min(SCALE.length - 1, out[i].deg + shift));
    return out;
  }
  // Answer a phrase that has just been scheduled. `sched` is what the caller
  // rendered: [{ f, t, dur }]. Nothing is drawn — the answer is determined by
  // the call — so 鏡 costs no randomness and cannot perturb a stream.
  function farMirrorAnswer(voice, phrase, sched, now, beat) {
    if (!farMirror || !phrase || phrase.length < 3 || !sched || !sched.length) return;
    var ans = FAR_MIRROR_ANSWER[voice];
    if (!ans || !seated(ans, now)) return;
    // 鏡 DOES NOT ANSWER INSIDE AN ENSEMBLE GESTURE. Under 重 all five voices
    // play the same phrase, so every one of them called for its own answer and
    // five answers landed on a gesture that was already five voices deep. Seed
    // 19 at d 0.90 (崩 重 多 鏡) peaked at 113 concurrent sources against the
    // cap of 110 that §10 kept hard — 94 at d 0.85, where the same night draws
    // no 鏡. It is the right musical answer as well as the affordable one: an
    // answer is a SHAPE, and a shape inside a five-voice heterophony is not
    // audible as one. That is the same reason this function holds the
    // answerer's air at all. Between gestures 鏡 answers exactly as before.
    if (farSubject && farEnsemble() && now < farSubject.at + (FAR_ENS_GAP[farSubject.mode] || 4)) return;
    var axisDeg = farMirror.axis === "tonic" ? scaleIndexOf(0)
                : farMirror.axis === "fifth" ? scaleIndexOf(3)
                : phrase[phrase.length - 1].deg;
    // The answer FOLLOWS the call — lagBeats after the phrase ends, not after
    // it begins. Measuring from the first note put the answer 0.2 s in, which
    // is not an answer, it is a doubling.
    var last = sched[sched.length - 1];
    var m = farMirrorOf(phrase, axisDeg), lag = farMirror.lagBeats * beat, t = last.t + last.dur + lag;
    var note = ans === "koto" ? kotoNote : ans === "shamisen" ? shamisenNote : ans === "shakuhachi" ? shakuhachiNote : kotoNote;
    var t0 = t;
    for (var i = 0; i < m.length; i++) {
      var d = Math.max(0.12, m[i].durBeats * beat);
      // 鏡 DOES NOT ANSWER OVER THE BROADCAST. The answer renders directly and
      // never claims the air — that is deliberate, since it is the answering
      // voice's own utterance rather than a new turn — but "never claims" also
      // meant "never denied", so a mirror answer played straight through a
      // signal's hold. Measured at two per cycle: seed 7 at far 0.9 put four
      // consecutive koto notes 3.7 to 10.5 s inside a hold, on a 鏡 night.
      // Skipped, not rescheduled, exactly as 崩's groove is (rc.24): an answer
      // is a shape and a shape with a hole in it is still recognisable, where
      // an answer that arrives late is a different gesture.
      if (!signalUp(t)) note(SCALE[m[i].deg].freq, t, d, { gain: 0.7 });
      t += d;
    }
    // The answer is that voice's utterance: hold its air across the span so it
    // does not play its own phrase over its own answer. Without this the answer
    // was there in the stream and inaudible as a shape, because the answering
    // voice was talking across it.
    airHoldAdd(ans, t0 - 0.2, t + 0.3, "mirror");
    emitEvent({ cat: "far", label: "鏡 answered", detail: voice + " → " + ans + " · " + m.length + " notes · axis " + farMirror.axis + " · lag " + lag.toFixed(2) + "s after the phrase" }, last.t + last.dur);
  }

  // Is this voice's entry in the current gesture still ahead of it? The same
  // test the taker path makes, factored out so `seated` can ask it too.
  function farDueToEnter(voice, now) {
    var E = farEnsemble();
    if (!E || !farSubject || farSubject.mode !== E.kind) return false;
    if (E.voices.indexOf(voice) < 0 || farSubject.taken[voice]) return false;
    var maxN = farEntryCount(E);
    if (farSubject.n >= maxN) return false;
    return now <= farSubject.at + farEntryAt(E, farSubject.n) + 0.6;
  }

  // A voice asks whether it is playing the ensemble's phrase, and on what terms.
  // Returns { phrase, t0, cs, take, kind, slot } — the material, WHEN it enters,
  // the scale its whole rendering runs at, and (for 継) which notes are its.
  //
  // 影's rendering rule, kept from W1 because the critic proved it load-bearing:
  // a take renders at the SUBJECT's beat scaled by the drawn ratio, `cs`
  // multiplies every duration in the phrase (floors, ornament steps, strum
  // span), and a take is unhooked from the taiko's magnet — quantizing three
  // ratios to one grid is precisely how a ratio disappears.
  function farCanonTake(voice, phrase, now, center, ownBeat) {
    var plain = { phrase: phrase, t0: now + 0.05, cs: 1, take: false, kind: null, slot: 0, of: 1, sharp: 1 };
    var E = farEnsemble();
    if (!E || !phrase || !phrase.length) return plain;
    var mine = E.voices.indexOf(voice) >= 0;
    if (!mine) return plain;
    plain.kind = E.kind;
    // 影 alone changes the tempo of every phrase these voices play, take or not
    // — the between-voice ratio IS the canon, so it cannot be only occasional.
    if (E.kind === "canon" && farCanon.of[voice]) {
      var canonBeat = farCanon.base * farCanon.of[voice] * farTimeMul(voice, now);
      plain.cs = ownBeat > 0 ? canonBeat / ownBeat : 1;
    }
    var maxN = farEntryCount(E);
    if (farSubject && farSubject.mode === E.kind && !farSubject.taken[voice] && farSubject.n < maxN) {
      var t0 = farSubject.at + farEntryAt(E, farSubject.n);
      if (now <= t0 + 0.6) {                                  // it is still this voice's entry to make
        var slot = farSubject.n;
        farSubject.taken[voice] = 1; farSubject.n++;
        // A TAKE IS `plain` WITH THE TAKE'S TERMS WRITTEN OVER IT, never a
        // fresh literal. It used to be a literal, and it silently dropped
        // `sharp` — 重's detune, which every melodic body multiplies its
        // frequency by. A take of any other kind (継, 群, 影) therefore
        // computed `freq * undefined` = NaN, which reached an oscillator as a
        // non-finite float in the winds and, through N = round(sr / freq), a
        // non-finite frame count in createBuffer for the strings. Four melodic
        // bodies threw on every ensemble entry from W2 (rc.15) to rc.21, and
        // every gate passed, because the symbolic mock tolerates NaN where the
        // browser throws. Building the take from `plain` makes the two paths
        // share ONE declaration of the contract, so a field added to it later
        // cannot go missing from a take. The fault is fixed at its source; the
        // source is now also watched (see the fault tally at emitNote).
        var out = plain;
        out.phrase = fitToRegister(farSubject.notes, center);
        out.t0 = Math.max(now + 0.05, t0);
        out.take = true; out.slot = slot; out.of = maxN;
        if (E.kind === "hocket") {
          // one timeline for everyone, and this voice's own beat is irrelevant
          out.t0 = farSubject.at;
          out.cs = (ownBeat > 0 && farSubject.beat > 0) ? farSubject.beat / ownBeat : 1;
          out.of = Math.min(maxN, E.voices.length);
        } else if (E.kind === "hetero") {
          // 重: the same line, each voice a hair sharp and a breath behind —
          // the engine's own sankyoku shadow, made the rule instead of a
          // 22 % chance and taken to all five.
          out.sharp = Math.pow(2, ((slot % 2) ? 1 : -1) * (1.5 + slot * 0.8) / 1200);
        }
        return out;
      }
      if (now > farSubject.at + farEntryAt(E, maxN - 1) + 4) farSubject = null;   // the gesture is over
    }
    // THE GESTURE'S OWN PACE. A leader announces on every phrase it plays, and
    // each announcement calls the other voices in — so without a floor between
    // gestures 重 was starting one every five seconds and spawning four entries
    // each time, which took the node budget to 3314/min against a ceiling of
    // 1500 and pushed the concurrent sources past theirs. The floor is the
    // gesture's own note count over the density the engine can afford: five
    // voices on one six-note line is thirty notes, and thirty notes want ten
    // seconds. Between gestures the voices play their own phrases, which is
    // also the difference between an ensemble that GATHERS and one that never
    // lets anybody speak alone. (The critic's W1 carried note (2) is the same
    // observation about 影, and this answers it for all four at once.)
    if (farSubject && now < farSubject.at + (FAR_ENS_GAP[E.kind] || 4)) return plain;
    // This voice announces the next subject — and CALLS THE OTHERS IN. A
    // gesture with staggered entries is one gesture, not several voices that
    // happen to agree; leaving each to notice the subject on its own next
    // phrase gave take latencies of 0.5–9.8 s (the critic's instrumented count)
    // when they should be exactly the anchor. So the leader cancels the others'
    // pending phrase and schedules their entry. Their own phrase functions
    // reschedule themselves as usual, so the loop is unbroken — the same
    // cancel-and-re-arm the KIRU already does to these lanes.
    farSubject = { notes: phrase.slice(), at: now + 0.05, beat: ownBeat, lead: voice, taken: {}, n: 1, mode: E.kind };
    farSubject.taken[voice] = 1;
    // 継: the leader is slot 0 of its own hocket, and everyone shares one
    // timeline — the melody exists only in the sum, so the notes must fall
    // where the subject put them, not where each voice would have put them.
    if (E.kind === "hocket") {
      plain.slot = 0; plain.t0 = farSubject.at; plain.of = Math.min(maxN, E.voices.length);
      // A three-note phrase split five ways is one note each and then silence.
      // The subject goes round the voices 2–3 times, so the hocket is a LINE
      // you can follow being handed along — which is what the technique is.
      farSubject.notes = farHocketLine(phrase, E.p.strict ? 3 : 2);
      plain.phrase = farSubject.notes.slice();
    }
    for (var ci = 0, k = 1; ci < E.voices.length && k < maxN; ci++) {
      var v = E.voices[ci];
      if (v === voice || !FAR_CANON_START[v]) continue;
      try {
        lane(v).cancelAll();
        lane(v).at(farSubject.at + farEntryAt(E, k), guarded(FAR_CANON_START[v]));
      } catch (e) {}
      k++;
    }
    return plain;
  }

  // ==========================================================================
  // 逸脱 W4 — THE META-TIDE'S PER-CYCLE LIFT
  //
  // One cycle may sit further out than the rest of its night, or closer in.
  // The night's MEMBERSHIP never changes — a 崩 night that stopped being one
  // for a cycle would be two nights — only how far out those departures are
  // pushed, and whether the ones with the highest thresholds are in reach at
  // all. A cycle that falls below D_HOME has every departure stand down, which
  // is the plan's calm cycle, and it costs nothing to express because
  // farTimeSetup already returns early on a home view.
  //
  // farNight IS THE CYCLE'S VIEW and farNightDrawn is the night. That is
  // deliberate: thirty-one places read farNight.dep, and threading a second
  // object through all of them is the shape of fault this crew has now been
  // caught by five times. Re-pointing one variable is immune to it.
  //
  // The naming travels from the drawn night — the VFD names what tonight IS,
  // not what this cycle is doing — and the lift is announced as its own line
  // when it happens.
  function farLiftCycle(cycleN, t) {
    if (!farNightDrawn || !window.ZK_FAR || !S || !S.far) return;
    if (farNightDrawn.home && !farNightDrawn.homeLift) return;    // the eleven nights in twelve: nothing to do, nothing touched
    var M = window.ZK_FAR, dp;
    try { dp = M.lift(S.far, cycleN, farNightDrawn.d); } catch (e) { return; }
    if (!(dp >= 0)) return;
    farCycleD = dp;
    if (Math.abs(dp - farNightDrawn.d) < 1e-9) { farNight = farNightDrawn; return; }
    var v;
    try {
      // A HOME night has no drawn departures, so there is nothing to re-derive:
      // its one strange cycle draws a night of its own at d′, on its own fork,
      // and that draw is what the cycle plays. A FAR night re-derives, because
      // its membership is its identity and must not change.
      v = farNightDrawn.home ? M.night(S.far.fork("homelift-draw"), dp)
                             : M.relift(S.far, farNightDrawn, dp);
    } catch (e) { return; }
    // the night's identity rides along; only the distance and the parameters move
    v.kana = farNightDrawn.kana; v.name = farNightDrawn.name; v.band = farNightDrawn.band;
    v.label = farNightDrawn.label; v.detail = farNightDrawn.detail; v.u = farNightDrawn.u;
    farNight = v;
    var away = dp > farNightDrawn.d;
    emitEvent({ cat: "far", label: away ? "潮 further out" : "潮 closer in",
      detail: "cycle " + cycleN + " · d " + farNightDrawn.d.toFixed(2) + " → " + dp.toFixed(2) +
        (v.home ? " · the departures stand down for this cycle" :
          " · " + (v.ids.length ? v.ids.map(function (x) { return v.dep[x].kana; }).join(" ") : "—")) }, t);
  }

  function farTimeSetup(setupT) {
    farTimeOn = false; farDilate = null; farCanon = null; farCycleRate = 1;
    farHetero = null; farHocket = null; farSwarm = null; farSubject = null; farPoly = null; farMirror = null; farClouds = null; farRev = null; farMetal = null; farNlead = null; farMetalMod = null; farMetalAmp = null;
    if (!farNight || farNight.home) return;
    var p;
    if ((p = farNight.dep.dilate)) farDilate = p;
    if ((p = farNight.dep.canon)) {
      var r = p.ratios, of = {}, mid = r[1], i, sumHome = 0, sumCanon = 0;
      for (i = 0; i < FAR_CANON_VOICES.length; i++) of[FAR_CANON_VOICES[i]] = r[i % r.length] / mid;
      // THE COMMON BEAT. The three voices' own beats are 0.4 / 0.28 / 0.9 —
      // a large pre-existing inequality that swallowed the drawn ratio whole
      // (the critic measured 1.66 : 1.00 : 0.64 on a 4:5:6 night, identical to
      // its home). Under 影 they abandon their own tempi and run at
      // base × ratio, so the between-voice relationship IS the drawn ratio and
      // nothing else. `base` equalises the sum of the three BEATS, before and
      // after, so the canon cannot make the trio louder by making it faster.
      // The realised note count still falls to 61–74 % of a home night (the
      // critic measured it), because the idioms that stand aside for a canon —
      // the gliss, the hammer-on, the tremolo — were contributing many of those
      // onsets. That thinner night is the better music and it is intended: a
      // canon is three lines you can follow, not three lines plus their
      // ornaments.
      for (i = 0; i < FAR_CANON_VOICES.length; i++) { sumHome += 1 / FAR_CANON_HOME[FAR_CANON_VOICES[i]]; sumCanon += 1 / of[FAR_CANON_VOICES[i]]; }
      farCanon = { of: of, ratios: r, spreadS: p.spreadS, base: sumCanon / sumHome };
      farSubject = null;
    }
    // W2 合奏 — the other three that ride the shared subject
    if ((p = farNight.dep.hetero)) farHetero = p;
    if ((p = farNight.dep.hocket)) farHocket = p;
    if ((p = farNight.dep.swarm)) farSwarm = p;
    if ((p = farNight.dep.clouds)) farClouds = p;
    if ((p = farNight.dep.poly)) { farPoly = p; farPolyN = 0; }
    if ((p = farNight.dep.mirror)) farMirror = p;
    if ((p = farNight.dep.rev)) farRev = p;
    if ((p = farNight.dep.metal)) farMetal = p;
    if ((p = farNight.dep.nlead)) farNlead = p;
    farTimeOn = !!(farDilate || farCanon || farVari);
    // THE SCHEDULED TIME, NEVER ctx.currentTime. These lines carry a timestamp
    // and a "now" read makes it depend on when the tick happened to run — which
    // is exactly what the REPRO-under-jitter gate exists to catch, and did:
    // 386.327 against 386.301 for the same 重 line on two jitter seeds. Latent
    // since rc.31, and invisible to a jitter run on a HOME seed because a home
    // night has no departures to announce.
    var tt = (setupT != null) ? setupT : (ctx ? ctx.currentTime : 0);
    farSay("canon", tt); farSay("hetero", tt); farSay("poly", tt); farSay("hocket", tt);
    farSay("erode", tt); farSay("mainv", tt); farSay("metal", tt); farSay("rev", tt);
  }
  // 遅 — one cycle glacial (a forty-minute jo made of single notes) or frantic,
  // drawn per cycle from the night's own band on the cycle's own sub-fork, so
  // the draw count never depends on how many cycles a listener sits through.
  function farCycleTime(n) {
    farCycleRate = 1;
    if (!farDilate) return 1;
    var R = S.far.fork("dilate:" + n);
    var slow = R.chance(farDilate.slow ? 0.62 : 0.38), lean = R.next();
    var always = (n <= 0);                       // 逸脱 遅: the FIRST cycle of a dilating night always departs
    // Seven cycles in ten depart; the other three keep the ordinary pace,
    // which is the plan's "a far night can have one calm cycle". √lean is how
    // far toward the edge of the night's band a departing cycle goes, and it
    // leans toward the EDGE — a glacial cycle should be glacial. (Measured
    // twice, both times wrong first: one-in-three left two of three test seeds
    // untouched across a whole 30-minute run, and lean² pulled the survivors
    // back to 1.00 at the median, so 68 % of cycles "departed" to nowhere. A
    // departure the owner never hears is not a departure.)
    // The factor is TIME: > 1 is a longer cycle (glacial), < 1 a shorter one
    // (frantic). slowMul ≥ 1, fastMul ≤ 1 — named so the sides cannot be
    // swapped by accident again.
    var k = Math.sqrt(lean), fire = always || R.chance(0.7);
    if (fire) farCycleRate = slow ? 1 + (farDilate.slowMul - 1) * k : 1 - (1 - farDilate.fastMul) * k;
    return farCycleRate;
  }

  // ---- the form departures ----
  // 蝕 — the jo-ha-kyū arc erodes. The Conductor validates only that each
  // scene type exists and each duration is positive (pj2-conductor.js:182),
  // so the order is free: it walks a reversed arc without complaint and
  // crossfades its curves as usual, which is what makes a decomposing cycle
  // sound like weather rather than like a bug.
  //
  //   reversed   kyū-ha-jo: the cycle opens AT THE WALL and comes apart
  //   nojo       the opening never happens — it is already underway
  //   doublekyu  two walls with a trough between them
  //   stalled    the ha eats the cycle; nothing ever climaxes
  //
  // A cycle without a kyū→release seam has no KIRU, by construction. That is
  // the point of an eroded arc, and it is why _harness.js's "no KIRU in
  // 1500 s" gate stays a HOME-night gate (it runs seed 3042, d 0.05).
  function farErode(scenes, durS) {
    var p = farNight && farNight.dep.erode;
    if (!p || !scenes.length) return scenes;
    var i, out = [];
    if (p.shape === "reversed") {
      for (i = scenes.length - 1; i >= 0; i--) out.push(scenes[i]);
      return out;
    }
    if (p.shape === "nojo") {
      for (i = 0; i < scenes.length; i++) if (scenes[i].type !== "jo") out.push(scenes[i]);
      if (!out.length) return scenes;
      out[0] = { type: out[0].type, durS: out[0].durS + durS * 0.2, activity: out[0].activity };
      return out;
    }
    if (p.shape === "doublekyu") {
      for (i = 0; i < scenes.length; i++) {
        out.push(scenes[i]);
        if (scenes[i].type === "kyu") {
          out.push({ type: "ha", durS: durS * 0.10, activity: null });      // the trough between the walls
          out.push({ type: "kyu", durS: scenes[i].durS * 0.8, activity: null });
        }
      }
      return out;
    }
    // stalled: the ha swallows the cycle and the wall never comes
    for (i = 0; i < scenes.length; i++) {
      var sc = scenes[i];
      if (sc.type === "ha") out.push({ type: "ha", durS: sc.durS * 2.2, activity: sc.activity });
      else if (sc.type === "kyu") out.push({ type: "ha", durS: sc.durS * 0.9, activity: null });
      else out.push(sc);
    }
    return out;
  }
  // 未斬 — the cut does not come. Nothing needs re-arming: kiru() is the only
  // thing that cancels the melodic lanes, so skipping it lets the wall run
  // straight into the next cycle's jo, which is born inside it. `every` says
  // whether the cut fails always or every other cycle; the decision is per
  // cycle on its own sub-fork, so it is stable however long the night runs.
  function farKiruFails(t) {
    var p = farNight && farNight.dep.nokiru;
    if (!p) return false;
    if (p.every === 1) return true;
    return S.far.fork("nokiru:" + Math.max(0, cyc.n)).chance(0.55);
  }
  // 間 — silence is the material and sound is the interruption. It multiplies
  // every body's rest arithmetic (they all read metaRestMul) and the air's
  // margins, and truncates phrases to one or two events.
  function farRestMul() { var p = farNight && farNight.dep.mainv; return p ? p.restMul : 1; }
  function farSingleton() { var p = farNight && farNight.dep.mainv; return !!(p && p.singleton); }

  // 崩 DISINTEGRATION — the station gets stuck.
  //
  // One fragment of the cycle's theme loops like a locked groove and decays:
  // each pass loses notes (they never come back), drifts flat, loses level and
  // gains grit, until only the room is left — then the next cycle begins from
  // the residue. Basinski's tape, on a koto.
  //
  // Two things make it a departure rather than an effect. The other voices are
  // held OFF THE AIR for its whole length through airHold — the mechanism the
  // receiver already uses (airClaimAt reads it), so the station really is
  // stuck, not merely repetitive over a working band. And the loss is
  // CUMULATIVE and seeded per pass: the same night always disintegrates the
  // same way, and the fragment that survives to the last pass is the one the
  // dice kept, not the one at the front.
  //
  // It schedules itself on the form lane, one pass at a time, so it can be
  // cut off cleanly by a stop() and never holds a timer of its own.
  var farGroove = null, farStuck = false;
  function farDisintegrate(t0) {
    var p = farNight && farNight.dep.disint;
    if (!p || !playing) return;
    var th = Motif.theme();
    if (!th || !th.notes || th.notes.length < 3) return;
    var R = S.far.fork("disint:" + Math.max(0, cyc.n));
    var frag = fitToRegister(th.notes.slice(0, Math.min(5, th.notes.length)), scaleIndexOf(4));
    if (!frag.length) return;
    var voice = R.pick(["koto", "shamisen", "biwa"]);
    // 影 + 崩: the groove is played BY one of the canon's voices, so on a canon
    // night it must run at that voice's canon beat — otherwise a stuck cycle
    // quietly reintroduces a third tempo the canon does not have.
    var beat = (farCanon && farCanon.of[voice] ? farCanon.base * farCanon.of[voice] : 0.42) * farTimeMul(voice, t0);
    var span = 0;
    for (var i = 0; i < frag.length; i++) span += Math.max(0.14, frag[i].durBeats * beat);
    span += beat * 0.8;                                   // the groove's own gap: the click of the loop
    var totalS = span * p.passes;
    farGroove = { alive: [], pass: 0 };
    for (i = 0; i < frag.length; i++) farGroove.alive.push(true);
    // the crew stops playing for the duration — the station is stuck, not busy
    var holdUntil = t0 + totalS + 2;
    for (var vi = 0; vi < MELODIC_LANES.length; vi++) airHoldAdd(MELODIC_LANES[vi], t0, holdUntil, "disint");
    airHoldAdd("pa", t0, holdUntil, "disint");
    emitEvent({ cat: "far", label: "崩 the station sticks", detail: th.name + " · " + frag.length + " notes · " + p.passes + " passes · " + Math.round(totalS) + "s · " + voice }, t0);
    var note = voice === "koto" ? kotoNote : voice === "shamisen" ? shamisenNote : function (f, tt, d, o) { stringNote("biwa", f, tt, d, o); };
    function pass(t) {
      if (!playing || !farGroove || farGroove.pass >= p.passes) { farGroove = null; return null; }
      var k = farGroove.pass, decay = 1 - k / p.passes;
      var cents = -p.driftCents * (k / p.passes);         // the loop drifts flat as the tape stretches
      var mul = Math.pow(2, cents / 1200), tt = t, any = false;
      for (var j = 0; j < frag.length; j++) {
        if (!farGroove.alive[j]) { tt += Math.max(0.14, frag[j].durBeats * beat); continue; }
        if (k > 0 && R.chance(p.lossPer)) { farGroove.alive[j] = false; continue; }   // gone for good
        var d = Math.max(0.14, frag[j].durBeats * beat);
        var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, frag[j].deg))].freq * mul;
        // 崩 DOES NOT PLAY OVER THE BROADCAST. The stuck groove holds the air
        // against the other five voices and then played straight through a
        // signal's hold itself — measured on seven far seeds, 7 to 59 melodic
        // notes inside a hold, and every one of them was this loop: one voice,
        // perfectly regular spacing, spanning the whole hold. The hold exists
        // so that nothing talks over the broadcast, and "nothing" has to
        // include the departure that set the hold.
        //
        // The note is SKIPPED, not rescheduled: a stuck tape does not wait its
        // turn, and the loop keeps its own timing so it comes back exactly
        // where it would have been. It also keeps ageing — the pass counter and
        // the loss draws are untouched — so the disintegration is the same
        // length whether a broadcast crossed it or not, which is what keeps a
        // 崩 night reproducible.
        if (!signalUp(tt)) { note(f, tt, d, { gain: 0.35 + 0.5 * decay, vel: 0.35 + 0.45 * decay }); }
        tt += d; any = true;
      }
      // the grit rises as the music leaves: what is left is the room. formPulse
      // owns dryGritGain, so the groove publishes a level and the pulse reads
      // it — one writer, as the mix pass established.
      farGroove.grit = 0.35 + 0.55 * (k / p.passes);
      farGroove.pass++;
      if (!any) { farGroove = null; return null; }        // nothing survived: only the room
      lane("groove").at(t + span, guarded(pass));         // its own lane: stop() takes it, formPulse never does
      return null;
    }
    lane("groove").at(t0, guarded(pass));
  }

  // ---- the pitch departures' machinery (all identity while farPitchOn is false) ----
  var FAR_PLUCKED = { koto: 1, shamisen: 1, biwa: 1 };
  var farPitchOn = false, farGlideOn = false;
  var farWarpK = 1;                              // 撓 the octave, as an exponent on the ratio to the tonic
  var farEar = null, farBito = null, farBitoField = null;
  var farSpiral = null, farVari = null, farT0 = 0;
  // 撓 — one monotone map about the tonic. Every interval scales by the same
  // exponent, so the field stays perfectly consistent with itself: nothing is
  // "out of tune", the whole world is somewhere else. Invertible, which is
  // what lets the per-voice departures work in field space.
  function farWarp(f) { var T = field.tonicHz; return farWarpK === 1 ? f : T * Math.pow(f / T, farWarpK); }
  function farUnwarp(f) { var T = field.tonicHz; return farWarpK === 1 ? f : T * Math.pow(f / T, 1 / farWarpK); }
  // 耳 — the plucked bodies tuned by ear while the winds stay tempered. The
  // ratios are PJ2.Pitch's own 5-limit table (16/9 at the minor seventh is
  // Pythagorean, two pure fourths stacked — a koto's tuning, not a blues
  // one). `depth` blends toward the just pitch in the log domain.
  function farEarSnap(f) {
    var T = field.tonicHz, r = f / T;
    if (!(r > 0)) return f;
    var oct = Math.floor(Math.log(r) / Math.LN2), pc = r / Math.pow(2, oct);
    var semi = Math.round(12 * Math.log(pc) / Math.LN2);
    if (semi >= 12) { semi -= 12; oct += 1; }
    var ratio = PJ.Pitch.JI_RATIOS[semi];
    if (ratio === undefined) return f;
    var just = T * ratio * Math.pow(2, oct);
    return f * Math.pow(just / f, farEar.depth);
  }
  // 双 — the second field: another dark pentatonic, a fourth, a fifth or (at
  // the far end) a tritone away. A crossed voice keeps its contour and its
  // register; only its pitch content moves, by snapping to the nearest degree
  // of the other world.
  // A crossed voice plays THE SAME SCALE DEGREE in the other world — not the
  // nearest pitch in it. Snapping by frequency was the first thing I wrote and
  // the probe caught it: two different degrees of hirajoshi can fall nearest
  // the same degree of iwato, so the melody flattens (seed 24's pitch-class
  // entropy went DOWN, 3.01 → 2.61, which is the opposite of bitonality).
  // Mapping by degree index preserves the contour exactly — the voice plays
  // its part, in another mode, on another tonic, which is what two players
  // reading the same page in different keys actually sounds like — and the
  // octave fold keeps it in the register it chose, so the second field's
  // tonic being a fifth away moves its pitch classes, not its tessitura.
  function farBitoSnap(f) {
    if (!farBitoField) return f;
    var info = field.snapInfo(f), g = farBitoField.degFreq(info.deg + info.oct * field.size, 0);
    while (g / f > 1.4142) g /= 2;
    while (f / g > 1.4142) g *= 2;
    return g;
  }
  // Build (or rebuild) the second field for the mode now in force. The night
  // drew the interval it LEANS toward and an ordering of the candidates; the
  // choice among them is the pairing that shares fewest pitch classes with
  // what the rest of the ensemble is playing, because a second field that
  // agrees with the first is not bitonality — a fifth-transposed in-sen has
  // exactly hirajoshi's pitch classes, measured on the probe. Deterministic:
  // it draws nothing, it re-reads the night's ordering against the mode.
  // Called at setup and again at every mode change.
  function farBitoBuild() {
    if (!farBito) { farBitoField = null; return; }
    var cur = pcSet(MODES[currentMode].offsets, field.tonicHz);
    var ivs = farBito.intervals || [farBito.interval], ms = farBito.modes || [farBito.mode];
    var best = null, i, j;
    for (i = 0; i < ivs.length; i++) for (j = 0; j < ms.length; j++) {
      var iv = ivs[i], md = ms[j];
      if (!MODES[md]) continue;
      var th = field.tonicHz * Math.pow(2, iv / 12);
      var n = sharedPcs(pcSet(MODES[md].offsets, th), cur);
      // the drawn interval breaks ties in its own favour; otherwise the
      // ordering the night drew does, which is why both lists are shuffled.
      var score = n * 10 - (iv === farBito.interval ? 1 : 0);
      if (!best || score < best.score) best = { score: score, iv: iv, md: md, th: th, shared: n };
    }
    if (!best) { farBitoField = null; return; }
    try {
      farBitoField = PJ.Pitch.field({ tonicHz: best.th, mode: { name: best.md, steps: farMeriSteps(MODES[best.md].offsets) }, tuning: "et" });
      farBito.chosen = best;
    } catch (e) { farBitoField = null; }
  }
  // 螺 and 弛 — the two glides, as one multiplier and a pure function of the
  // scheduled time. 螺 sinks and returns on a raised cosine: always moving,
  // never settling, no octave wrap to jump on (a literal Shepard needs
  // per-partial amplitude crossfading, which the drones do not have), and
  // downward-biased because this station sinks, it does not rise. 弛 is the
  // tape: down over minutes, then a snap or a crawl back.
  function farGlideMul(t) {
    var c = 0, x = t - farT0;
    if (farSpiral) c += -farSpiral.amp * (1 - Math.cos(2 * Math.PI * x / farSpiral.periodS)) / 2;
    if (farVari) {
      // SMOOTHSTEP BOTH WAYS, and it matters: a linear return leaves a CORNER
      // in the envelope, and no ramp chain placed on travel can find a corner —
      // the drone ran 45 ¢ away from the voices for half a second while the
      // tape snapped back (measured). Smoothstep has zero slope at both ends,
      // so the sag is C¹ everywhere and the chain's error is pure curvature.
      // It also sounds better: a tape does not change speed instantaneously.
      var u = (x % farVari.cycleS) / farVari.cycleS, v;
      if (u < farVari.downFrac) v = smooth(u / farVari.downFrac);
      else { var b = (u - farVari.downFrac) / farVari.retFrac; v = b >= 1 ? 0 : 1 - smooth(b); }
      c += farVari.cents * v;
    }
    return Math.pow(2, c / 1200);
  }
  // The ramp chain that carries a sustained voice along the glide. Anchors are
  // placed BY PITCH MOVEMENT, not on a fixed grid — an even grid was the first
  // thing I wrote and it fails on 弛's snap: the tape's return is a CORNER in
  // the envelope, so a one-second chord cuts it and the drone ran up to 45 ¢
  // away from the voices for half a second (measured, not guessed). Placing an
  // anchor every FAR_GLIDE_EPS cents of actual travel bounds the error at half
  // that everywhere — a few anchors across a slow spiral, a dense burst only
  // while the tape is snapping back. Nothing is written at all when nothing
  // glides, which is every home night.
  var FAR_GLIDE_EPS = 0.6, FAR_GLIDE_MAX = 800, FAR_GLIDE_MAX_DT = 0.5;   // 0.6 ¢ per anchor holds the worst drawable glide (弛 at overS 60, snapping back) to 0.72 ¢ against the voices; below 0.6 the 50 ms sampling floor binds and nothing more is bought
  function farGlideRamps(param, base, t, durS) {
    var step = 0.05, last = farGlideMul(t), n = 0, x, lastX = 0;
    for (x = step; x < durS; x += step) {
      var m = farGlideMul(t + x);
      if (Math.abs(1200 * Math.log(m / last) / Math.LN2) < FAR_GLIDE_EPS && x - lastX < FAR_GLIDE_MAX_DT) continue;
      param.linearRampToValueAtTime(base * m, t + x);
      last = m; lastX = x;
      if (++n >= FAR_GLIDE_MAX) break;
    }
    param.linearRampToValueAtTime(base * farGlideMul(t + durS), t + durS);
  }
  // Read tonight's pitch departures into the machinery above. Called once at
  // play(), after the night is drawn; every value here is already seeded.
  // THE STORY, TOLD AS IT HAPPENS (W4). The plan asks that "the VFD tells the
  // story as it happens", and until this commit fourteen of the twenty-four
  // departures never said a word: all six pitch departures, all four ensemble
  // ones, 金 and 逆. Seed 61 draws 螺 蝕 金 and produced a night name, two lift
  // lines, and silence from its three departures for a full hour.
  //
  // The ones that ACT AT MOMENTS already speak each time (崩, 騒, 群, 相, 室,
  // 凍, 雲, 鏡, 遅, 未斬). The ones that TRANSFORM THE WHOLE WORLD cannot speak
  // per note without drowning the log, so they speak when they TAKE HOLD —
  // once at the start of a night, and again whenever a lifted cycle changes
  // what they are doing, which is exactly when a listener wants to be told.
  // Deduplicated on the rendered line, so a lift that leaves a departure
  // unchanged says nothing about it.
  // null = "not announcing yet". play() runs the setups BEFORE the night names
  // itself, and a departure introducing itself above the night it belongs to
  // reads backwards; so the setups stay quiet until play() opens the story.
  var farSaid = null;
  var FAR_SAY = {
    sag:    function (p) { return "the octave is " + Math.round(p.cents) + " cents, not 1200 — the whole field is somewhere else"; },
    ear:    function (p) { return "the plucked bodies tuned by ear, the winds left tempered · depth " + p.depth.toFixed(2); },
    meri:   function (p) { return "the semitone pairs narrow toward a quarter-tone · " + p.which; },
    bito:   function (p) { return "two modes at once · " + (p.modes || []).slice(0, 2).join(" against ") + " · share " + p.share.toFixed(2); },
    spiral: function (p) { return "the tonic glides " + p.centsPerS.toFixed(1) + " cents a second — a key that never arrives"; },
    vari:   function (p) { return "the tape sags " + Math.round(-p.semis * 100) + " cents over " + Math.round(p.overS) + "s, then " + (p.snap ? "snaps" : "crawls") + " back"; },
    canon:  function (p) { return "the plucked trio in a tempo canon · " + (p.ratios || []).join(":"); },
    hetero: function (p) { return "all five melodic voices on one line, each a hair sharp and a breath behind · lag " + p.lagS.toFixed(2) + "s"; },
    poly:   function (p) { return "each voice keeps its own meter · " + (p.meters || []).join(" / "); },
    hocket: function (p) { return "one melody split note by note across the voices" + (p.strict ? ", strictly" : ""); },
    erode:  function (p) { return "the arc erodes · " + p.shape; },
    mainv:  function (p) { return "間 inverted: the rests are the music · rest ×" + p.restMul.toFixed(1) + (p.singleton ? " · one voice at a time" : ""); },
    metal:  function (p) { return "ring modulation on " + (p.targets || []).join(" and ") + " · mix " + p.ringMix.toFixed(2) + " · FM index " + p.fmIndex.toFixed(1); },
    rev:    function (p) { return "envelopes played backwards · " + Math.round(p.share * 100) + "% of them · swell " + p.swellS.toFixed(1) + "s"; },
  };
  function farSay(id, t) {
    if (!farSaid) return;
    var p = farNight && farNight.dep && farNight.dep[id];
    if (!p || !FAR_SAY[id]) return;
    var line;
    try { line = FAR_SAY[id](p); } catch (e) { return; }
    if (farSaid[id] === line) return;                 // unchanged by this cycle: nothing to tell
    farSaid[id] = line;
    emitEvent({ cat: "far", label: p.kana + " " + p.name, detail: line }, t);
  }

  // `keepOrigin` — a lifted cycle rebuilds the pitch departures at its own
  // distance, but must NOT move farT0. That is the glide's phase origin, and
  // resetting it every cycle would make 螺 restart from zero each time instead
  // of being the slow continuous drift it is named for. Found while wiring the
  // announcements: the lift was rebuilding the TIME departures and leaving the
  // pitch ones on the night's values entirely.
  function farPitchSetup(t0, keepOrigin) {
    if (!keepOrigin) farT0 = t0;
    farWarpK = 1; farEar = null; farBito = null; farBitoField = null; farSpiral = null; farVari = null;
    farPitchOn = false; farGlideOn = false;
    if (!farNight || farNight.home) return;
    var p;
    if ((p = farNight.dep.sag)) farWarpK = p.cents / 1200;
    if ((p = farNight.dep.ear)) farEar = p;
    if ((p = farNight.dep.bito)) { farBito = p; farBitoBuild(); }
    if ((p = farNight.dep.spiral)) {
      // the drawn cents/s is the cosine's MAX slope: πA/P. Amplitude first,
      // then the period that gives that slope.
      var amp = 200 + 500 * p.amt;
      farSpiral = { amp: amp, periodS: Math.PI * amp / Math.abs(p.centsPerS) };
    }
    if ((p = farNight.dep.vari)) {
      // the snap comes back in ~3 % of the cycle (4–9 s), the crawl in ~25 %
      farVari = { cents: p.semis * 100, cycleS: p.overS * 2.2, downFrac: 0.72, retFrac: p.snap ? 0.03 : 0.25, snap: p.snap };
    }
    farPitchOn = !!(farWarpK !== 1 || farEar || farBito || farSpiral || farVari);
    farGlideOn = !!(farSpiral || farVari);
    var pt = t0 != null ? t0 : (ctx ? ctx.currentTime : 0);
    farSay("sag", pt); farSay("ear", pt); farSay("meri", pt); farSay("bito", pt);
    farSay("spiral", pt); farSay("vari", pt);
  }
  // 減 — the semitone pairs narrow toward a quarter-tone. Applied to a mode's
  // steps as setMode builds its custom-mode object, so field.size never
  // changes and every degree index in the engine keeps meaning what it meant.
  // PJ2.Pitch's equal-tempered path already takes fractional steps.
  function farMeriSteps(steps) {
    var p = farNight && farNight.dep.meri;
    if (!p) return steps;
    var out = steps.slice();
    for (var i = 1; i < out.length; i++) if (Math.abs(steps[i] - steps[i - 1] - 1) < 1e-9) out[i] = steps[i] - 0.5 * p.walk;
    return out;
  }

  // ==========================================================================
  // SCALE — HIRAJOSHI (平調子)
  // ==========================================================================
  // A dark koto pentatonic with two semitone steps (the haunting Japanese
  // sound). Offsets in semitones from the tonic: 0, 2, 3, 7, 8.
  // Tonic low and a little detuned-feeling for grit. Just-ish via equal temper.
  var TONIC_HZ = 146.83;                       // D3
  // Related dark Japanese pentatonic modes — each jo-ha-kyū cycle modulates
  // between them for long-form variety (beyond a single fixed scale).
  var MODES = {
    hirajoshi: { offsets: [0, 2, 3, 7, 8],  name: "Hirajoshi", kana: ["一", "二", "三", "四", "五"] },
    insen:     { offsets: [0, 1, 5, 7, 8],  name: "In-sen",    kana: ["陰", "二", "三", "四", "五"] },
    kumoi:     { offsets: [0, 2, 3, 7, 9],  name: "Kumoi",     kana: ["雲", "二", "三", "四", "五"] },
    iwato:     { offsets: [0, 1, 5, 6, 10], name: "Iwato",     kana: ["岩", "二", "三", "四", "五"] },
  };
  // (mode-lottery weights live in metaModePool() below — they drift with the
  // meta-arc: home-leaning at the trough, in-sen/iwato-leaning at the peak)
  var currentMode = "hirajoshi";
  // THE PITCH FIELD (PJ2.Pitch): tonic + mode + tuning, mutable only through
  // modulate(). Every frequency is a query on the field at use time; the
  // SCALE table below is a cached register-spanning view of it, rebuilt on
  // every modulation. Sounding notes keep their Hz across a change (the
  // kolob straddle lesson) — the field never retunes what already rang.
  var field = PJ.Pitch.field({ tonicHz: TONIC_HZ, mode: { name: "hirajoshi", steps: MODES.hirajoshi.offsets }, tuning: "et" });
  function degFreq(i, octShift) {              // i = scale-degree index (folds by field.size), octShift in octaves
    return farWarp(field.degFreq(i, octShift || 0));   // 逸脱 撓: the night's own octave (identity at home)
  }

  // Ascending frequency table across registers (degree index -5 .. 15 ≈ 4 oct).
  var SCALE_LO = -5, SCALE_HI = 15;
  var SCALE = (function () {
    var arr = [];
    for (var i = SCALE_LO; i <= SCALE_HI; i++) arr.push({ deg: ((i % 5) + 5) % 5, freq: degFreq(i, 0), idx: i });
    return arr;
  })();
  function rebuildScale() {
    var n = field.size;
    for (var k = 0; k < SCALE.length; k++) { SCALE[k].freq = degFreq(SCALE[k].idx, 0); SCALE[k].deg = ((SCALE[k].idx % n) + n) % n; }
  }
  // 12-TET note name for a tonic (flats: the station sinks, it does not rise)
  var NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  function noteName(hz) { var n = Math.round(12 * Math.log(hz / 440) / Math.LN2) + 69; return NOTE_NAMES[((n % 12) + 12) % 12]; }
  // The tonic keeps to one register band (G2 … G3): a fourth up that would
  // leave it becomes a fifth down (the koto's retuning between pieces —
  // same pitch class, the strings loosened instead of tightened).
  var TONIC_LO = 100, TONIC_HI = 200;         // not on a scale-tone edge (G3 = 195.998 would wobble across 196)
  function foldTonic(hz) { while (hz >= TONIC_HI) hz /= 2; while (hz < TONIC_LO) hz *= 2; return hz; }
  // THE SUB REGISTER folds on its own: the drone's saw roots live in 64–128 Hz
  // whatever the tonic (73.4 at D3, 98 at G2 and G3, 103.8 at A♭2), the fifth
  // folds into the same band, the sub sine is root/2 (never below 32 Hz —
  // at the low tonics degFreq(0, −2) went subsonic and ate the compressor's
  // headroom; critic, Phase 2). Geiger hum, bonshō and the audition drone
  // read the same helper.
  function foldInto(hz, lo, hi) { while (hz >= hi) hz /= 2; while (hz < lo) hz *= 2; return hz; }
  // 逸脱 撓: warped AFTER the fold, so the drone's root is the tonic dropped
  // by the NIGHT's octaves, not by true ones — the drone agrees with the
  // field. Residual: at 1230 ¢ a two-octave fold lands ~1 Hz under the band,
  // which is consistency bought at the price of the band, deliberately.
  function subRoot() { return farWarp(foldInto(field.tonicHz, 64, 128)); }
  function subFifth() { return farWarp(foldInto(foldInto(field.tonicHz, 64, 128) * Math.pow(2, 7 / 12), 64, 128)); }
  // setMode(name, extra, t, tonicHz): one atomic modulate() of mode and
  // (optionally) tonic — sounding notes keep their Hz (the straddle lesson).
  function setMode(name, extra, t, tonicHz) {
    if (!MODES[name]) return;
    currentMode = name;
    var patch = { mode: { name: name, steps: farMeriSteps(MODES[name].offsets) } };   // 逸脱 減: the semitone pairs narrow toward a quarter-tone
    if (tonicHz) patch.tonicHz = tonicHz;
    field.modulate(patch);
    rebuildScale();
    if (farBito) farBitoBuild();                 // 逸脱 双: the other world moves with this one
    if (farMetalMod && ctx) { try { farMetalMod.frequency.setValueAtTime(subRoot(), t != null ? t : ctx.currentTime); } catch (e) {} }   // 金: the ring follows the reactor
    SCALE_INFO.name = MODES[name].name; SCALE_INFO.kana = MODES[name].kana.slice(); SCALE_INFO.tonic = noteName(field.tonicHz);
    emitEvent({ cat: "mode", label: "⟳ mode", detail: MODES[name].name + " on " + SCALE_INFO.tonic + (extra ? " · " + extra : "") }, t);
  }
  // Pitch classes (cents mod 1200) of a (mode, tonic) — for the pivots.
  function pcSet(steps, tonicHz) {
    var out = [], base = 1200 * Math.log(tonicHz) / Math.LN2;
    for (var i = 0; i < steps.length; i++) { var c = (base + 100 * steps[i]) % 1200; out.push(c < 0 ? c + 1200 : c); }
    return out;
  }
  function sharedPcs(a, b) {
    var n = 0;
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) { var d = Math.abs(a[i] - b[j]) % 1200; if (d > 600) d = 1200 - d; if (d <= 15) { n++; break; } }
    return n;
  }
  function scaleIndexOf(i) {                    // map a degree index i to SCALE array index
    var k = i - SCALE_LO;
    return k < 0 ? 0 : k > SCALE.length - 1 ? SCALE.length - 1 : k;
  }
  function nearestScaleIndex(freq) {
    var best = 0, bd = 1e9;
    for (var k = 0; k < SCALE.length; k++) {
      var d = Math.abs(Math.log2(SCALE[k].freq / freq));
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // Tonic (degree 0) and the fifth-ish (degree 3 = +7 semis) are the gravity notes.
  var IMPORTANT_DEG = { 0: true, 3: true };
  var REST_DEG = { 0: true, 3: true, 1: true };

  var SCALE_INFO = {
    name: "Hirajoshi",
    tonic: "D",
    degrees: ["Sa", "—", "—", "—", "—"],       // (filled below as kana labels)
    kana: ["一", "二", "三", "四", "五"],
    mood: "haunted · derelict · neon-rust",
  };

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  var LAYERS = ["subDrone", "sho", "shakuhachi", "hichiriki", "koto", "shamisen", "biwa", "taiko", "noise", "ambient", "pa", "broadcast"];   // broadcast (S1): the receiver — a real reel from the past, heard in the hull
  // Shamisen is deliberately NOT routed through the grit bus: the grit curve's
  // ~27x small-signal makeup spikes its plucked onset into an audible click.
  // Its own sawari buzz + the master saturator keep it abrasive without that.
  var GRIT_LAYERS = { subDrone: true, taiko: true, noise: true }; // route through distortion

  var layerGains = {};
  // hichiriki 0.35 — HALVED from 0.7 at the owner's ask (2026-09-07). The
  // console DEFAULT only: the slider now opens at half of what it did and the
  // owner can raise it again from the faceplate. Its body, its trims and the
  // mix pass's presence work are deliberately untouched — this is a level
  // decision about how loud the reed sits in the ensemble, not a voicing one.
  var layerVolumes = { subDrone: 0.6, sho: 0.62, shakuhachi: 0.85, hichiriki: 0.35, koto: 0.6, shamisen: 0.75, biwa: 0.7, taiko: 0.62, noise: 0.5, ambient: 0.55, pa: 0.6, broadcast: 0.7 };
  var layerMuted   = { subDrone: false, sho: false, shakuhachi: false, hichiriki: false, koto: false, shamisen: false, biwa: false, taiko: false, noise: false, ambient: false, pa: false, broadcast: false };
  var layerRate    = { subDrone: 1, sho: 1, shakuhachi: 1, hichiriki: 1, koto: 1, shamisen: 1, biwa: 1, taiko: 1, noise: 1, ambient: 1, pa: 1, broadcast: 1 };
  var DEFAULT_LAYER_VOL = 0.7;

  var LAYER_PARAM_DEFAULTS = {
    subDrone:   { cutoff: 220, drive: 0.5, sub: 0.6, movement: 0.18 },
    sho:        { cutoff: 1400, voices: 5, shimmer: 0.4, drift: 0.5 },
    shakuhachi: { breath: 0.55, muraiki: 0.4, pace: 1.0, glide: 0.6, ornament: 0.5 },
    hichiriki:  { reed: 0.5, enbai: 0.6, breath: 0.35, pace: 1.0 },
    koto:       { brightness: 7, pace: 1.0, gliss: 0.4, sustain: 1.0, pluck: 0.5 },
    shamisen:   { sawari: 0.6, drive: 0.5, pace: 1.0, attack: 0.5 },
    biwa:       { sawari: 0.8, tremolo: 0.6, pace: 1.0 },
    taiko:      { punch: 0.6, drive: 0.5, lowTune: 1.0, kakegoe: 0.5 },
    noise:      { density: 0.4, color: 0.5, crush: 0.4 },
    ambient:    {},
    pa:         { presence: 0.5, static: 0.5 },
    broadcast:  { band: 0.5, flutter: 0.5, grit: 0.5 },   // S1: how narrow the radio band, how deep the fading, how much the receiver distorts
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));

  // Dark, long, slightly metallic reverb.
  var REVERB = { decay: 6.5, preDelay: 60, wet: 0.34, hfDamp: 1.1 };

  // Per-layer hidden trims (slider reads clean, effective value differs).
  // 0.9 on the main instruments: ~10% more air between phrases by default —
  // ambient and noise keep their pace (they're the weather, not the band).
  var LAYER_RATE_TRIM = { shakuhachi: 0.9, koto: 0.9, shamisen: 0.9, taiko: 0.9, hichiriki: 0.9, biwa: 0.9 };
  // Volume trim: shakuhachi + koto sit ~10% louder than their slider implies, so
  // they read more clearly in the mix without changing the displayed values.
  // shamisen 2.2: makes up the level it lost coming off the grit bus (which was
  // boosting it ~5-10x via the grit curve's makeup) so it sits in the mix again.
  // koto 1.25 / shamisen 2.5 (ZANKYŌ 2, Phase 1): +1.1 dB each — with the air
  // they are often the only line for 20–40 s and read under the drone bed
  // at the old trims (critic's real-audio measurement; owner may revert).
  // Phase M (the mix pass, the last lever, within the +3 dB budget): koto 1.25 → 1.6 (+2.1; the
  // pick burst rides its peak rows, the two together land at +3),
  // shamisen 2.5 → 3.0 (+1.6),
  // biwa 2.0 → 2.8, hichiriki and PA 1 → 1.4 (+2.9 dB each) — the bodies the owner
  // heard buried; the shakuhachi and the shamisen already read.
  var LAYER_VOL_TRIM = { shakuhachi: 1.1, koto: 1.6, shamisen: 3.0, biwa: 2.55, hichiriki: 1.4, pa: 1.4 };   // biwa 2.8 → 2.55 (round 2): its strums' picks summed per row pushed the peak to +3.4
  // PRESENCE (Phase M): a peaking boost on each body's defining band, chosen
  // from the masker map — the band where the landscape is weakest against the
  // voice — pre-attenuated (pre) so the compressor sees no new peak. Measured:
  // the koto's harmonics at 1–1.6 kHz come within 2–3 dB of the landscape
  // (its 2–4 kHz holds nothing: the string's lowpass sits at ~4 f); the biwa's
  // sawari lives at 1–2 kHz; the PA's F1 at 500–800 Hz; the hichiriki's
  // formants at 1.9–3.9 kHz over the landscape's flat crud.
  var PRESENCE = {
    // koto and shamisen: NO presence stage — measured, their bodies hold almost
    // nothing at 1.5–4 kHz (koto −73 dBFS in-band vs −47 at the fundamental; the
    // string's lowpass sits at ~4 f), so a boost there lifts nothing and only
    // spends the +3 dB peak budget; the budget goes to the trim instead. The
    // biwa's sawari does live at 1–3 kHz and keeps its boost.
    biwa:      { f: 2500, db: 3.0, q: 0.8, pre: 0.95 },
    hichiriki: { f: 2400, db: 2.5, q: 1.2, pre: 0.92 },
    pa:        { f: 1500, db: 3.0, q: 1.0, pre: 0.92 },   // the PA's band as measured, 0.8–3.2 kHz (F2 and the static), where the shō masks it
  };

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  // THE FAULT TALLY (rc.21). Two classes the gates could not see: a lane that
  // threw, and a note scheduled with a non-finite frequency, time or duration.
  // Counting only — no behaviour changes, no RNG is touched, so home nights
  // stay byte-identical. _harness.js reads it and fails on any.
  var faults = { lanes: 0, notes: 0, lane: [], note: [] };
  // EVERY SCHEDULED NOTE IS FINITE. The companion tripwire to the lane tally:
  // a non-finite frequency reaches an oscillator as "non-finite float" and, via
  // N = round(sr / freq), a non-finite frame count in createBuffer — both throw
  // — but a non-finite DURATION mostly does not throw, it just renders nothing,
  // and nothing in the gates would have said so. Counted here, never thrown:
  // the owner's night must not break because a gate wants to be loud. The
  // harness fails on a single one.
  function emitNote(layer, freq, startTime, duration) {
    if (!(isFinite(freq) && isFinite(startTime) && isFinite(duration || 0))) {
      faults.notes++;
      if (faults.note.length < 12) faults.note.push({ layer: layer, freq: freq, t: startTime, dur: duration });
    }
    roomSpeak(layer, startTime, duration, freq);   // Phase M: the crew hears who is about to speak
    for (var i = 0; i < noteListeners.length; i++) {
      try { noteListeners[i]({ layer: layer, freq: freq, startTime: startTime, duration: duration || 0 }); } catch (e) {}
    }
  }
  function emitEvent(ev, t) {                   // t: the scheduled audio time the event belongs to
    if (eventListeners.length === 0) return;
    ev.t = t != null ? t : (ctx ? ctx.currentTime : 0);
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT
  // ==========================================================================
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    sharedNoiseBuf = PJ.Voice.noiseBuffer(ctx, NOISE_BUF_DURATION);          // texture, not music — stays unseeded
    if (!S) forkStreams();                                                    // the ♪ audition may run before play()
    // The transport: one lookahead clock, one lane per layer (+ "form" for
    // the cycle watch). Lane rates are the console's RATE knobs.
    clock = PJ.Clock.create(ctx, { tickMs: 25, aheadS: 0.25, onError: function (err, where) {
      // A lane that throws loses the rest of its phrase and is silent until
      // something re-arms it. That is invisible to a listener as anything but
      // a voice going quiet, and it was invisible to the gates too: the hook
      // only wrote to console, and neither _harness.js nor _probe.js reads
      // the console. 継's takes threw on four melodic bodies from rc.15 to
      // rc.21 and every gate passed. Now the throws are COUNTED, and the
      // harness fails on any.
      faults.lanes++;
      if (faults.lane.length < 12) faults.lane.push({ lane: (where && where.lane) || "?", t: +((where && where.t) || 0).toFixed(2),
        msg: String((err && err.message) || err).slice(0, 120) });
      if (typeof console !== "undefined" && console.error) console.error("ZankyoAudio lane " + (where && where.lane) + " threw at t=" + (where && where.t), err && err.stack ? err.stack : err);
    } });
    for (var lni = 0; lni < LAYERS.length; lni++) clock.lane(LAYERS[lni]).rate = layerRate[LAYERS[lni]] || 1;

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-20, ctx.currentTime);
    compressorNode.knee.setValueAtTime(14, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(5, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.012, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.2, ctx.currentTime);
    // Master saturator — glues the escalating wall into one cohesive distorted
    // mass and protects against clipping when grit + noise stack in the kyū.
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.25) / Math.tanh(1.25); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    // Output safety trim — measured (offline render): the kyū wall drives the
    // compressor's auto-makeup to 1.05–1.10 peak (79 clipped samples / 450 s).
    // −1.1 dB post-compressor keeps the DAC clean; the mix itself is untouched.
    outTrim = ctx.createGain();
    outTrim.gain.setValueAtTime(0.88, ctx.currentTime);
    compressorNode.connect(outTrim);
    // Final hop: prefer the background-audio route (a MediaStreamDestination
    // feeding a real <audio> element — survives screen lock / backgrounding
    // and carries lock-screen controls). Identical signal either way.
    bg = window.MskyBackgroundAudio ? window.MskyBackgroundAudio.create({
      context: ctx,
      source: outTrim,
      title: "ZANKYŌ 残響",
      artist: "Municipal Sky",
      artwork: "/images/zankyo-share.png",
      onPlay: play,
      onPause: stop,
    }) : null;
    if (!bg || !bg.routed) outTrim.connect(ctx.destination);

    var effectsReady = false;
    try {
      // THE DRY SUM: every room-bound source also reaches the master dry at
      // unity, exactly as the old single reverb's dry path did.
      reverbSend = ctx.createGain();
      reverbSend.gain.setValueAtTime(1, ctx.currentTime);
      reverbSend.connect(masterGain);
      // THE ROOMS (Phase 1): two real impulse responses, WET-ONLY, crossfaded
      // per scene by PJ2.Fx.roomBlend. The hull (R1 reactor hall — vast,
      // slow, metallic) and the corridor (a railway tunnel — close, resonant).
      // Wet-only on purpose: PJ2.Voice.reverb sums its own dry inside, and
      // two of those crossfaded equal-power add the SAME dry signal
      // coherently — a +3 dB dry bump at mid-balance. With the dry summed
      // once above and only the tails blended, the cos/sin law is exactly
      // right (uncorrelated tails), and the mix stays put as scenes turn.
      roomHull = zkRoom({ irUrl: "ir/hull-r1-reactor-hall.wav", preDelayS: 0.05, wet: REVERB.wet, fallback: "metal" });
      roomCorridor = zkRoom({ irUrl: "ir/corridor-railway-tunnel.wav", preDelayS: 0.01, wet: 0.30, fallback: "plain" });
      roomBlend = PJ.Fx.roomBlend(ctx, { close: roomCorridor, wide: roomHull, balance: 0.85 });
      // Group sums: registered with the blend at their own depth bias, and
      // all of them into the dry sum. Voices (shakuhachi, koto, the far
      // wall's answer) at 0; ambient a step deeper in the hull; grit closer.
      sumVoices = ctx.createGain(); sumVoices.gain.setValueAtTime(1, ctx.currentTime);
      sumSho = ctx.createGain(); sumSho.gain.setValueAtTime(1, ctx.currentTime);
      sumAmb = ctx.createGain(); sumAmb.gain.setValueAtTime(1, ctx.currentTime);
      sumVoices.connect(reverbSend); roomBlend.register("voices", sumVoices, 0);
      // THE CUT (Phase 4, Sycorax's mechanics): the KIRU lives on dedicated
      // gains over the LANDSCAPE groups — shō, ambient, and the grit bus below
      // — never on the master. Three nodes, one schedule (kiru writes the same
      // envelope to each); the melodic voices are silenced by scheduling, not
      // gain, and their tails and the rooms ring into the hush. Tap "cut".
      cutSho = ctx.createGain(); cutSho.gain.setValueAtTime(1, ctx.currentTime);
      cutAmb = ctx.createGain(); cutAmb.gain.setValueAtTime(1, ctx.currentTime);
      cutGrit = ctx.createGain(); cutGrit.gain.setValueAtTime(1, ctx.currentTime);
      duckSho = ctx.createGain(); duckSho.gain.setValueAtTime(1, ctx.currentTime);
      carveSho = ctx.createBiquadFilter(); carveSho.type = "peaking"; carveSho.frequency.setValueAtTime(400, ctx.currentTime); carveSho.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveSho.gain.setValueAtTime(0, ctx.currentTime);
      shelfSho = ctx.createBiquadFilter(); shelfSho.type = "highshelf"; shelfSho.frequency.setValueAtTime(1500, ctx.currentTime); shelfSho.gain.setValueAtTime(LAND_SHELF_DB, ctx.currentTime);
      pickSho = ctx.createBiquadFilter(); pickSho.type = "peaking"; pickSho.frequency.setValueAtTime(2500, ctx.currentTime); pickSho.Q.setValueAtTime(0.8, ctx.currentTime); pickSho.gain.setValueAtTime(0, ctx.currentTime);
      carveSho2 = ctx.createBiquadFilter(); carveSho2.type = "peaking"; carveSho2.frequency.setValueAtTime(400, ctx.currentTime); carveSho2.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveSho2.gain.setValueAtTime(0, ctx.currentTime);
      sumSho.connect(duckSho); duckSho.connect(carveSho); carveSho.connect(carveSho2); carveSho2.connect(shelfSho); shelfSho.connect(pickSho); pickSho.connect(cutSho);   // the same duck, notches, shelf and pick dip as the grit bus (Phase M)
      cutSho.connect(reverbSend); roomBlend.register("sho", cutSho, 0.1);
      sumAmb.connect(cutAmb); cutAmb.connect(reverbSend); roomBlend.register("ambient", cutAmb, 0.15);
      // THE RADIO (Phase 4): the lost broadcast surfaces through this — a
      // bandpass the width of an old receiver, into the ambient sum.
      radioBus = ctx.createGain(); radioBus.gain.setValueAtTime(1, ctx.currentTime);
      var radioBp = ctx.createBiquadFilter(); radioBp.type = "bandpass"; radioBp.frequency.setValueAtTime(1300, ctx.currentTime); radioBp.Q.setValueAtTime(0.9, ctx.currentTime);
      radioBus.connect(radioBp); radioBp.connect(sumAmb);
      // THE FAR WALL: the corridor answering the koto — modulated, dark, low
      // feedback; the answer goes into the rooms like any voice. One seeded
      // draw at build (the drift LFO's phase) on the fx stream.
      farWall = PJ.Fx.delay(ctx, { timeS: 0.37, feedback: 0.28, damp: 1400, driftHz: 0.03, driftDepth: 0.004, wet: 0.28, rng: S.fx });   // wet 0.28 (critic P1 r2: 0.16 measured ~20 dB under the koto)
      farWall.output.connect(sumVoices);
      // THE KOTO'S SYMPATHETIC HALO (Phase 3): PJ2.Fx.sympathetic — eight
      // strings tuned to the field in the koto's register, never excited
      // directly: they hear the shakuhachi and the shamisen through a whisper
      // send and hum. Retuned ONLY at the first scene boundary after a sea
      // change (the straddle lesson applied to resonance). Loop gain: each
      // comb's lowpass is Q −6 dB (|H| ≤ 1), feedback 0.95 → the loop gain IS
      // 0.95 < 1; T60 ≈ ln(0.001)/ln(0.95) ≈ 135 round trips ≈ 0.9 s at 147 Hz.
      layHalo = ctx.createGain(); layHalo.gain.setValueAtTime(1, ctx.currentTime);
      layHalo.connect(sumVoices);
      halo = PJ.Fx.sympathetic(ctx, { nStrings: 8, freqs: haloFreqs(), out: layHalo, level: 0.08, feedback: 0.95, damp: 3000 });
      haloSend = ctx.createGain(); haloSend.gain.setValueAtTime(0.25, ctx.currentTime);   // a whisper that exists: target ≈ −27 dB rel master
      haloSend.connect(halo.input);
      // THE SCREECH BUS: the noise layer's feedback bodies sum here (tapped
      // for the critic) before the noise layer gain, so the layer's mute and
      // volume still own them.
      screechBus = ctx.createGain(); screechBus.gain.setValueAtTime(1, ctx.currentTime);

      gritShaper = ctx.createWaveShaper();
      gritShaper.curve = buildGritCurve(0.6);
      gritShaper.oversample = "4x";
      // THE SECOND GRIT CURVE (Phase 3): a cruddier shape, crossfaded with
      // the first by the weather's gritColor (equal-power chords on the
      // form pulse) — the grit's colour drifts, its level does not. Both
      // curves feed the SAME makeup-down stage.
      gritShaperB = ctx.createWaveShaper();
      gritShaperB.curve = buildGritCurve(0.9);
      gritShaperB.oversample = "4x";
      gritBlendA = ctx.createGain(); gritBlendA.gain.setValueAtTime(1, ctx.currentTime);
      gritBlendB = ctx.createGain(); gritBlendB.gain.setValueAtTime(0, ctx.currentTime);
      gritShaper.connect(gritBlendA); gritShaperB.connect(gritBlendB);
      // Makeup-DOWN: the grit curve boosts small signals ~27x and rails the bus
      // to full-scale under any real drone level, leaving the master zero
      // headroom — so every new note onset (koto, taiko) clips into an audible
      // click. Pull the gritty bus back to a sane level; the distortion timbre
      // is baked into the waveshape and survives the attenuation.
      // Phase M (the mix pass) — A FAULT FIXED AND A RE-BASE: since Phase 3 the
      // second curve (gritShaperB) had no input, so the weather's crossfade faded
      // the WHOLE grit bus by cos θ — down 15 dB at gritColor 0.9 — and every
      // "master ha −25" in the reports was that accident, not the mix. With the
      // input connected the bus holds its level; the makeup is re-based from 0.4
      // to 0.29 (−2.8 dB) so the fixed bus sits at rc.10's measured TIME-AVERAGE
      // (grit bus −17.9 dBFS mean vs −15.0 unfaded, both captures, both seeds):
      // the integrated loudness compares like with like, and the voices gain
      // ~2.8 dB of separation wherever the drone used to be full.
      gritMakeup = ctx.createGain();
      gritMakeup.gain.setValueAtTime(0.29, ctx.currentTime);
      gritBlendA.connect(gritMakeup); gritBlendB.connect(gritMakeup);
      // THE CREW LOWERS ITS VOICE (Phase M): between the makeup-down and the
      // KIRU's cut gain, a duck gain and a peaking notch that one writer
      // (roomPulse) drives while a melodic voice or the PA speaks — the
      // landscape steps back a few dB and opens at the speaking register.
      // Idle they are unity and flat: the grit is untouched when nobody plays.
      duckGrit = ctx.createGain(); duckGrit.gain.setValueAtTime(1, ctx.currentTime);
      carveGrit = ctx.createBiquadFilter(); carveGrit.type = "peaking"; carveGrit.frequency.setValueAtTime(400, ctx.currentTime); carveGrit.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveGrit.gain.setValueAtTime(0, ctx.currentTime);
      // THE PICK BAND KEPT CLEAR (Phase M, lever 2): a static high shelf, −3 dB
      // above 1.5 kHz, on the grit bus and the shō — the plucked bodies' 1.5–4 kHz
      // is where the drone's crud and the shō's shimmer sat 5–15 dB over the
      // koto's pick; the band holds ~0.1 % of the landscape's power, so the
      // loudness does not move and the hull's body below is untouched.
      shelfGrit = ctx.createBiquadFilter(); shelfGrit.type = "highshelf"; shelfGrit.frequency.setValueAtTime(1500, ctx.currentTime); shelfGrit.gain.setValueAtTime(LAND_SHELF_DB, ctx.currentTime);
      // and a DYNAMIC dip in the pick band (peaking 2.5 kHz, Q 0.8 → 1.4–4.5 kHz), opened only while a plucked voice speaks (the writer below), so the wall keeps its top when nobody plucks
      pickGrit = ctx.createBiquadFilter(); pickGrit.type = "peaking"; pickGrit.frequency.setValueAtTime(2500, ctx.currentTime); pickGrit.Q.setValueAtTime(0.8, ctx.currentTime); pickGrit.gain.setValueAtTime(0, ctx.currentTime);
      // r3: a SECOND notch per bus — notch 1 follows the plucked / reed / PA spans, notch 2 the shakuhachi's, so a koto under a flute has its own band cleared (one notch at the mean pitch cleared neither)
      carveGrit2 = ctx.createBiquadFilter(); carveGrit2.type = "peaking"; carveGrit2.frequency.setValueAtTime(400, ctx.currentTime); carveGrit2.Q.setValueAtTime(ROOM_Q, ctx.currentTime); carveGrit2.gain.setValueAtTime(0, ctx.currentTime);
      gritMakeup.connect(duckGrit); duckGrit.connect(carveGrit); carveGrit.connect(carveGrit2); carveGrit2.connect(shelfGrit); shelfGrit.connect(pickGrit); pickGrit.connect(cutGrit);
      cutGrit.connect(reverbSend); roomBlend.register("grit", cutGrit, -0.12);
      // dev tap: the LANDSCAPE as the critic measures it — the grit bus and the
      // shō after their cut gains (ambient events keep their own depth and are
      // not part of the sum the crew ducks)
      landscapeTap = ctx.createGain(); landscapeTap.gain.setValueAtTime(1, ctx.currentTime);
      cutGrit.connect(landscapeTap); cutSho.connect(landscapeTap); cutAmb.connect(landscapeTap);   // grit-cut + shō-cut + ambient-cut: the landscape exactly as it reaches the dry sum
      // THE KIT'S OWN CLIP (Phase M, the orchestrator's Q4): the taiko used to
      // ride the drone's shaper and lose the clip to it — a hit on a railed
      // drone gets ~14 dB less of the curve's gain than the drone does, so the
      // kit read 18 dB under the bus it was in. Now it has its own copy of the
      // grit curve (the same 0.6 shape, 4× oversampled) and its own makeup-down,
      // first set so a LOUD hit left the shaper at the level it entered (the curve
      // gives ~+17 dB at the rail; 0.13 took it back), then doubled by ruling —
      // see the makeup line below.
      // Into the KIRU's cut gain after the crew's chain: the cut still hushes the
      // kit; the crew does not duck or notch it (it is a voice, not the floor).
      taikoShaper = ctx.createWaveShaper(); taikoShaper.curve = buildGritCurve(0.6); taikoShaper.oversample = "4x";
      taikoMakeup = ctx.createGain(); taikoMakeup.gain.setValueAtTime(0.26, ctx.currentTime);   // r3 (orchestrator Q6): 0.13 → 0.26 — the one deliberate level move of the pass: a kit 17–19 dB under the drone is not audible; +6 dB puts its hits near the koto's level (~+0.15 dB integrated while it drums)
      // r3: the kit's own CUT gain (the KIRU hushes it with the landscape) into the
      // dry sum and the rooms like the grit, and into the dry-grit send it always
      // had — but NOT into the landscape tap: the kit is a voice, measured against
      // the landscape, not part of it.
      cutTaiko = ctx.createGain(); cutTaiko.gain.setValueAtTime(1, ctx.currentTime);
      taikoShaper.connect(taikoMakeup); taikoMakeup.connect(cutTaiko);
      cutTaiko.connect(reverbSend); roomBlend.register("taiko", cutTaiko, -0.12);
      // parallel dry path — crossfaded up by the arc so the kyū gets close + abrasive
      dryGritGain = ctx.createGain();
      dryGritGain.gain.setValueAtTime(0, ctx.currentTime);
      cutGrit.connect(dryGritGain); if (cutTaiko) cutTaiko.connect(dryGritGain);
      dryGritGain.connect(masterGain);

      // Shamisen's own saturator: a near-unity-makeup tanh that gives the
      // shamisen back its abrasive bite (and the presence it lost when taken off
      // the main grit bus) WITHOUT that bus's ~27x onset spike. Soft attack
      // transient, not a click.
      shamEdge = ctx.createWaveShaper();
      var sec = new Float32Array(1024);
      for (var si = 0; si < 1024; si++) { var sx = (si / 1023) * 2 - 1; sec[si] = Math.tanh(sx * 2.5) / Math.tanh(2.5); }
      shamEdge.curve = sec; shamEdge.oversample = "2x";
      shamEdge.connect(reverbSend); roomBlend.register("shamisen", shamEdge, -0.05);

      effectsReady = true;
    } catch (e) {
      reverbSend = ctx.createGain();
      reverbSend.connect(masterGain);
      if (window.console) console.warn("Zankyo effects init failed, dry fallback:", e);
    }

    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      // PRESENCE, NOT GAIN (Phase M): every source of a layer enters through
      // layerIn; the named bodies pass a small peaking boost on their defining
      // band — pre-attenuated so the compressor sees no new peak — before the
      // layer gain, so the layer tap (the critic's) hears exactly what the mix does.
      var entry = ctx.createGain(), pr = PRESENCE[layer];
      entry.gain.setValueAtTime(pr ? pr.pre : 1, ctx.currentTime);
      if (pr) {
        var pk = ctx.createBiquadFilter(); pk.type = "peaking";
        pk.frequency.setValueAtTime(pr.f, ctx.currentTime); pk.Q.setValueAtTime(pr.q, ctx.currentTime); pk.gain.setValueAtTime(pr.db, ctx.currentTime);
        entry.connect(pk); pk.connect(node); presenceOf[layer] = pk;
      } else entry.connect(node);
      layerIn[layer] = entry;
      if (layer === "taiko" && effectsReady && taikoShaper) node.connect(taikoShaper);                                            // Phase M: the kit's own clip (Q4)
      else if (GRIT_LAYERS[layer] && effectsReady && gritShaper) { node.connect(gritShaper); if (gritShaperB) node.connect(gritShaperB); }   // Phase M: the second curve finally HAS an input (see the makeup note)
      else if (layer === "shamisen" && effectsReady && shamEdge) node.connect(shamEdge);
      else if (layer === "sho" && effectsReady && sumSho) node.connect(sumSho);
      else if (layer === "ambient" && effectsReady && sumAmb) node.connect(sumAmb);
      else if (layer === "broadcast" && effectsReady && roomBlend) {
        // THE RECEIVER (S1): the reel is heard IN the reactor hall — registered
        // with the blend a step deeper than the ambient (+0.3), into the dry
        // sum like every room-bound source, and a low send to the far wall (the
        // corridor repeats a syllable). Not through the KIRU's cut: a signal is
        // never seated where the KIRU falls.
        node.connect(reverbSend); roomBlend.register("broadcast", node, 0.3);
        if (farWall) { var bcFw = ctx.createGain(); bcFw.gain.setValueAtTime(0.35, ctx.currentTime); node.connect(bcFw); bcFw.connect(farWall.send); }
      }
      else if (layer === "biwa" && effectsReady && shamEdge) node.connect(shamEdge);      // the biwa shares the shamisen's saturator (stateless)
      else if (effectsReady && sumVoices) {
        node.connect(sumVoices);
        if ((layer === "koto" || layer === "pa") && farWall) node.connect(farWall.send);   // the corridor answers the koto and the PA
        if ((layer === "shakuhachi" || layer === "shamisen") && haloSend) node.connect(haloSend);   // the koto's strings hear them
      }
      else node.connect(reverbSend);
      layerGains[layer] = node;
    }
    if (screechBus && layerIn.noise) screechBus.connect(layerIn.noise);
  }
  // The halo's strings: the field's degrees across the koto's two octaves
  // (D3–D5 at home), eight of them.
  function haloFreqs() {
    var out = [];
    for (var i = 0; i < 8; i++) out.push(degFreq(i, 0));   // 逸脱 撓: the sympathetic strings are tuned to the night's own field
    return out;
  }

  // A WET-ONLY convolution room: send → preDelay → convolver → wet → master.
  // The measured impulse response is fetched and decoded once per URL (cached
  // on the ctx); the graph stands immediately with an empty convolver and the
  // real room arrives when decode lands (under the near-silent jo opening).
  // On ANY failure — no fetch/decode (the harness mock), a missing file,
  // undecodable bytes — a generated pour fills the convolver: "metal" is
  // ZANKYŌ's original 6.5 s plate-like hull, "plain" a short dry corridor.
  // Unseeded Math.random is permitted here only: texture, not music.
  function zkRoom(spec) {
    var send = ctx.createGain(), pre = ctx.createDelay(0.25), conv = ctx.createConvolver(), wet = ctx.createGain();
    send.gain.setValueAtTime(1, ctx.currentTime);
    pre.delayTime.setValueAtTime(spec.preDelayS, ctx.currentTime);
    wet.gain.setValueAtTime(spec.wet, ctx.currentTime);
    send.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(masterGain);
    var poured = false;
    function pour() {
      if (poured) return;
      poured = true;
      var decay = spec.fallback === "metal" ? REVERB.decay : 1.6;
      var len = Math.floor(ctx.sampleRate * decay), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var data = buf.getChannelData(ch);
        var ph1 = Math.random() * Math.PI * 2, ph2 = Math.random() * Math.PI * 2;  // per-channel phase → no comb
        for (var i = 0; i < len; i++) {
          var t = i / ctx.sampleRate;
          var env = Math.exp(-2.0 * t / decay), hf = Math.exp(-3.5 * t / decay);
          var color = spec.fallback === "metal" ? 1 + 0.10 * Math.sin(2 * Math.PI * 1700 * t + ph1) + 0.06 * Math.sin(2 * Math.PI * 3300 * t + ph2) : 1;
          var edge = i >= len * 0.95 ? (len - i) / (len * 0.05) : 1;
          data[i] = (Math.random() * 2 - 1) * env * hf * color * edge;
        }
      }
      conv.buffer = buf;
    }
    var room = { send: send, output: wet, conv: conv, irUrl: spec.irUrl, real: false, setWet: function (v) { wet.gain.setValueAtTime(v, ctx.currentTime); } };
    if (spec.irUrl && typeof fetch === "function" && typeof ctx.decodeAudioData === "function") {
      var store = ctx.__zkIrBufs || (ctx.__zkIrBufs = {});
      if (!store[spec.irUrl]) {
        store[spec.irUrl] = fetch(spec.irUrl).then(function (r) { if (!r || !r.ok) throw new Error("HTTP " + (r && r.status)); return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (res, rej) {
            var done = false;
            function ok(b) { if (!done) { done = true; res(b); } }
            function bad(x) { if (!done) { done = true; rej(x || new Error("decode failed")); } }
            try { var p = ctx.decodeAudioData(ab.slice(0), ok, bad); if (p && p.then) p.then(ok, bad); } catch (x) { bad(x); }
          }); })
          .catch(function (x) { delete store[spec.irUrl]; throw x; });
      }
      store[spec.irUrl].then(function (b) { if (!poured) { poured = true; conv.buffer = b; room.real = true; } }).catch(function () { pour(); });
    } else pour();
    return room;
  }

  // Asymmetric soft-clip with a hint of crossover grit — harsher than a plain tanh.
  function buildGritCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = 2 + amount * 40;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = (1 + k) * x / (1 + k * Math.abs(x));     // soft-clip
      y += 0.04 * Math.sin(x * 9);                      // subtle harmonic crud
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }

  // ==========================================================================
  // SCHEDULING + HELPERS
  // ==========================================================================
  // Every layer loop lives on its own PJ2.Clock lane. `t` is always the
  // SCHEDULED audio time handed to the caller (never ctx.currentTime, which
  // the lookahead clock runs up to 0.25 s behind): the next fire is placed at
  // an absolute audio time, so a thousand phrases later the loop is exactly
  // where arithmetic says it is. The console's RATE knob is lane.rate — the
  // Clock divides the delay by it and bends already-pending events when it
  // turns. The hidden per-layer trim stays a divisor on the delay itself.
  function lane(name) { return clock.lane(name); }
  function trimOf(layer) { return LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1; }
  function after(layer, t, delayS, fn) {        // trimmed: the whole delay is "rest"
    var L = lane(layer);
    return L.at(t + farTimeMul(layer, t) * delayS / trimOf(layer) / L.rate, guarded(fn));   // 逸脱 遅/弛/影
  }
  function afterRaw(layer, t, delayS, fn) {     // untrimmed: caller already trimmed the rest part
    var L = lane(layer);
    return L.at(t + farTimeMul(layer, t) * delayS / L.rate, guarded(fn));                   // 逸脱 遅/弛/影
  }
  // 逸脱: for a caller whose delay ALREADY contains time it scaled itself — a
  // phrase's rendered span (its notes came out of a scaled `beat`) or a
  // drone's envelope. Scaling it again would square the dilation and open a
  // hole between the fade-out and the next cycle. Identical to afterRaw at
  // home, where farTimeMul is 1.
  function afterSpan(layer, t, delayS, fn) {
    var L = lane(layer);
    return L.at(t + delayS / L.rate, guarded(fn));
  }
  function guarded(fn) { return function (t) { if (playing) fn(t); }; }

  function lg(layer) { return layerIn[layer] || layerGains[layer]; }   // the layer's ENTRY (Phase M: through the presence stage into the layer gain)
  // The panner rack: three persistent seats per layer (L / C / R at ±0.5)
  // instead of one panner per note — stereo width with a constant node
  // count. ZANKYŌ's own seat rule (|pan| > 0.2 goes to a side) is kept over
  // PJ2.Voice.pannerPool's ±0.66 nearest-seat: the lead draws pans within
  // ±0.25 and would otherwise collapse to mono-centre (critic, Phase 0).
  var panPool = {};
  function panAt(layer, p) {
    var pool = panPool[layer];
    if (!pool) {
      pool = panPool[layer] = [-0.5, 0, 0.5].map(function (pp) {
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(lg(layer)); return sp;
      });
    }
    var cl = p < -1 ? -1 : (p > 1 ? 1 : p);
    return pool[cl < -0.2 ? 0 : cl > 0.2 ? 2 : 1];
  }
  function getLayerParam(layer, key, fallback) {
    if (layerParams[layer] && layerParams[layer][key] != null) return layerParams[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    node.gain.setValueAtTime(layerMuted[layer] ? 0 : layerVolumes[layer] * trim, ctx.currentTime);
  }
  function noiseSource() {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf; n.loop = true;
    return n;
  }

  // ==========================================================================
  // THE FORM — cycle plans on PJ2.Conductor (ZANKYŌ 2, Phase 1)
  // ==========================================================================
  // jo-ha-kyū (序破急) is the GRAMMAR; each cycle is a PLAN written in it.
  // A "performance" of the Conductor is one cycle: a seeded scene list under
  // the grammar — jo → ha (with an optional sub-scene: a kakeai duet, a koto
  // solo, a muraiki solo breath; an optional taiko oroshi rolling into the
  // kyū) → kyū → release — whose proportions come from the cycle's KIND
  // (Kolob's meeting activity, ZANKYŌ's way):
  //   常 ordinary · 儀式 rite (long ceremonial jo, shō-heavy) · 漂流 drift
  //   (kankyō-ongaku, ambient-heavy, the kyū barely arrives) · 嵐 storm (short
  //   jo, noise wall, taiko wall) · 沈黙 silence (mostly ma; the KIRU cuts
  //   nothing) · 放送 broadcast (comms-vox and static-gated ambient).
  // And a SEATING: which voices are present this cycle — every voice is
  // rested about one cycle in four; named seatings (shakuhachi alone over
  // the drones in the jo; a koto-led danmono with no shamisen; a taiko-led
  // cycle where the shakuhachi enters only for the reprise; a dead station
  // of drones, noise and ambient) are drawn on top.
  // The TIDE is the old meta-arc generalized: one seeded cosine over 5–8
  // cycles tilting the kind lottery (storms at the dark peak, drift and
  // silence at the trough), the mode lottery, the KIRU's severity and the
  // global density. INTENSITY is continuous (the Conductor crossfades scene
  // curves at every boundary); the bargraph and viz keep reading a 0–1
  // level, so the faceplate is untouched. JOINTS land at exact audio times.
  var conductor = null;
  var air = null;
  // THE AIR'S CLOCK reads the CLAIMANT'S scheduled time, never the wall
  // clock: the lookahead pump fires a callback anywhere in [t − 0.25, t]
  // (1.6 s early in a hidden tab), so an Air sweeping expiries against
  // ctx.currentTime would grant or deny by how early the pump ran and the
  // seeded performance would diverge under timer jitter (critic, Phase 1
  // round 1 — measured at 5 ms). Every claim sets airT to its own t first.
  var airT = 0, airClock = { now: function () { return airT; } };
  // THE HOLD (S1): while a signal is up the melodic voices may not claim the
  // air at all — pj2-air's limit floor is 1, so the hold lives here as a
  // per-voice window {from, until}; a claim inside it is denied (counted).
  // The drones, shō, noise and ambient never ask, so they continue.
  // THE AIR HOLD IS A LIST PER LAYER, NOT A SLOT. It has five writers — the
  // broadcast through the tools, 凍 on the shakuhachi, 鏡's answer, 崩's stuck
  // groove and 騒's wall — and it used to be one object per layer written by
  // assignment, so the last writer silently erased everyone else's claim. That
  // is the same shape as 継's dropped field and arm()'s dropped fields: a
  // shared structure one writer overwrites instead of composing with.
  //
  // Entries carry WHO set them, which is what makes signalUp answerable: "is a
  // BROADCAST holding the air" is a different question from "is anything
  // holding it", and 崩 has to be able to ask the first while itself holding
  // the second.
  var airHold = {}, airHoldDenials = 0;
  function airHoldAdd(layer, from, until, who) {
    var a = airHold[layer] || (airHold[layer] = []);
    for (var i = a.length - 1; i >= 0; i--) if (a[i].until < from - 30) a.splice(i, 1);   // long expired
    a.push({ from: from, until: until, who: who || "?" });
  }
  function airHoldDrop(who) {
    for (var k in airHold) {
      var a = airHold[k]; if (!a) continue;
      for (var i = a.length - 1; i >= 0; i--) if (!who || a[i].who === who) a.splice(i, 1);
    }
  }
  var kiruAt = -1e9, kiruHushUntil = -1e9;       // §11.3: when the last KIRU cut, and when its hush is over
  // THE ARM LEAD MUST EXCEED THE LONGEST BODY LOOKAHEAD, not merely the
  // prefetch. The hold is written at arm, and plan §12 measured the long-note
  // bodies committing 33 to 46 s ahead of the audio clock — so an arm 20 s
  // before t0 leaves a claim made at t0−40 uncaught, which is the §12 defect
  // reintroduced. It showed immediately: seed 7 put an 11.2 s hichiriki note
  // 3.5 s inside a hold on the first measured run.
  //
  // 55 s clears the 46 s lookahead. The minimum spacing between two broadcasts
  // must then clear lead + footprint — 55 + 29.2 = 84.2 — so BC_GAP_S is 95,
  // and the receiver's single armed slot is never asked to hold two at once.
  // The two constants are related and the relation is written here because
  // changing one alone silently breaks the other.
  var BC_ARM_LEAD_S = 55;
  var AIR_HOLD_PAD = 4;                          // seconds of slack on an estimated span, before a signal's hold
  function airClaimAt(t, voice, span, margin) {
    airT = t;
    var a = airHold[voice] || [];
    // The claim's whole FOOTPRINT must clear the hold, not just its start. A
    // phrase claiming a moment before a signal's hold and running into it was
    // always able to talk over the broadcast; at one signal in three cycles it
    // almost never happened, and §8.1's one per cycle made it show — six
    // melodic notes inside a hold over two hours (the harness caught it).
    // …and conservatively, because `span` is an ESTIMATE — a voice claims with
    // its LAST phrase's length and then renders whatever this one turns out to
    // be. Testing the estimate alone took the intrusions from six to one over
    // two hours; the pad takes the last one. Better to let a voice miss a turn
    // than to talk over the broadcast, which is the whole point of the hold.
    for (var hi = 0; hi < a.length; hi++) {
      var h = a[hi];
      if (t < h.until && (t + (span > 0 ? span : 0) + AIR_HOLD_PAD) > h.from) { airHoldDenials++; return null; }
    }
    return air.tryClaim(voice, span, margin);
  }
  var signalProvider = null;                     // zk-broadcast.js installs itself here (S1)
  // "A SIGNAL holds the air at t" — the broadcast only. 崩 and 騒 hold the air
  // too, and answering yes for them made every caller think a broadcast was up
  // whenever the station was merely stuck.
  function signalUp(t) {
    for (var k in airHold) { var a = airHold[k] || [];
      for (var i = 0; i < a.length; i++) if (a[i].who === "signal" && t >= a[i].from && t < a[i].until) return true; }
    return false;
  }
  var cyc = { n: -1, kind: "ordinary", seating: null, seatingLabel: "", durS: 420, startT: 0, mode: "hirajoshi", visit: null, visit2: null };
  var scn = { type: null, activity: null, startT: 0, durS: 1 };
  var pendingPlan = null;                        // written by DRAM.plan(), consumed at performance-begin

  // kind → proportions of the cycle, the kyū's ceiling, and the tilts every
  // body reads (rest multiplier, ambient gap, noise amount, sub-scene and
  // oroshi odds, the air's margin multiplier)
  var KINDS = {
    ordinary:  { kana: "常",   jo: 0.45, ha: 0.37, kyu: 0.13, rel: 0.05, peak: 1.0,  restMul: 1.0,  ambGap: 1.0,  noiseMul: 1.0, sub: 0.55, oroshi: 0.30, marginMul: 1.0 },
    rite:      { kana: "儀式", jo: 0.55, ha: 0.28, kyu: 0.10, rel: 0.07, peak: 0.9,  restMul: 1.15, ambGap: 1.1,  noiseMul: 0.8, sub: 0.40, oroshi: 0.35, marginMul: 1.3 },
    drift:     { kana: "漂流", jo: 0.45, ha: 0.40, kyu: 0.07, rel: 0.08, peak: 0.62, restMul: 1.4,  ambGap: 0.55, noiseMul: 0.6, sub: 0.35, oroshi: 0.10, marginMul: 1.5 },
    storm:     { kana: "嵐",   jo: 0.20, ha: 0.50, kyu: 0.22, rel: 0.08, peak: 1.0,  restMul: 0.85, ambGap: 1.2,  noiseMul: 1.6, sub: 0.50, oroshi: 0.60, marginMul: 0.7 },
    silence:   { kana: "沈黙", jo: 0.50, ha: 0.30, kyu: 0.08, rel: 0.12, peak: 0.7,  restMul: 2.2,  ambGap: 1.4,  noiseMul: 0.5, sub: 0.30, oroshi: 0.0,  marginMul: 2.5 },
    broadcast: { kana: "放送", jo: 0.40, ha: 0.40, kyu: 0.12, rel: 0.08, peak: 0.9,  restMul: 1.1,  ambGap: 0.7,  noiseMul: 1.1, sub: 0.45, oroshi: 0.20, marginMul: 1.1 },
  };
  function K() { return KINDS[cyc.kind] || KINDS.ordinary; }
  // scene type → jo-ha-kyū phase name (the bodies and the Motif grammar
  // speak in phases; the plan speaks in scenes)
  var PHASE_OF = { jo: "jo", ha: "ha", kakeai: "ha", solo: "ha", oroshi: "ha", kyu: "kyū", release: "release" };
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // The grammar's curves, scaled by the kind's ceiling: jo 0→0.25, ha
  // 0.25→0.8, kyū 0.8→1, release 0.8→0 (the old piecewise arc, now one
  // scene each and crossfaded); the ha's sub-scenes hold their own level.
  var CURVES = {
    jo:      function (x) { return 0.25 * x * x; },
    ha:      function (x) { return 0.25 + 0.55 * smooth(x); },
    kakeai:  function (x) { return 0.5 + 0.1 * smooth(x); },
    solo:    function (x) { return 0.38 + 0.05 * Math.sin(Math.PI * x); },
    oroshi:  function (x) { return 0.6 + 0.2 * x; },
    kyu:     function (x) { return 0.8 + 0.2 * Math.sqrt(x); },
    release: function (x) { return 0.8 * Math.pow(1 - x, 3); },
  };
  function sceneDef(type, limit, overlap) {
    return { intensity: function (x) { return clamp01(CURVES[type](x) * K().peak); }, airLimit: limit, overlapChance: overlap };
  }
  // The mode lottery, tilted by the tide: the trough leans home
  // (hirajoshi/kumoi); the peak leans to the two darkest modes (in-sen's
  // flat 2nd, iwato's tritone). Flat-ish: every mode stays in play.
  function modePool(d) {
    return [["hirajoshi", 4 - 2 * d], ["insen", 2 + 2 * d], ["kumoi", 3 - 1.5 * d], ["iwato", 1.5 + 2.5 * d]];
  }
  var MELODIC = ["shakuhachi", "koto", "shamisen", "hichiriki", "biwa"];
  // SEATING — every draw is taken unconditionally (stream discipline), the
  // named seating then overrides, the kind tilts, and a guarantee keeps at
  // least one melodic voice unless the station is dead.
  function drawSeating(rng, kind) {
    var named = rng.pickW([["free", 6.5], ["shakuhachi alone", 1.2], ["danmono", 1.0], ["taiko-led", 0.8],
      ["dead station", (kind === "drift" || kind === "silence") ? 1.1 : 0.45]]);
    if (cyc.n < 0 && named === "dead station") named = "free";   // the first cycle must show the bodies before their absence can mean anything
    if (lastCycleEmpty && named === "dead station") named = "free";   // never two empty cycles in a row (critic, Phase 4)
    var s = { shakuhachi: rng.chance(0.78), koto: rng.chance(0.75), shamisen: rng.chance(0.72), taiko: rng.chance(0.75), sho: rng.chance(0.8), entry: {}, named: named,
      // Phase 3: the hichiriki lives in the rite (always) and visits elsewhere; the biwa belongs to drift and silence
      hichiriki: rng.chance(kind === "rite" ? 1 : 0.3), biwa: rng.chance(kind === "drift" || kind === "silence" ? 0.65 : 0.15) };
    if (named === "shakuhachi alone") { s.shakuhachi = true; s.entry.koto = "ha"; s.entry.shamisen = "ha"; }
    else if (named === "danmono") { s.koto = true; s.shamisen = false; }
    else if (named === "taiko-led") { s.taiko = true; s.shakuhachi = true; s.entry.shakuhachi = "reprise"; if (!s.koto && !s.shamisen) s.koto = true; }   // the plucked voices carry a taiko-led cycle
    else if (named === "dead station") { s.shakuhachi = s.koto = s.shamisen = s.taiko = s.hichiriki = s.biwa = false; s.sho = true; }   // dead, not switched off: the shō is a drone here
    if (kind === "rite") s.sho = true;
    if (kind === "storm") s.taiko = true;
    if (kind === "silence" && s.shakuhachi && s.koto && s.shamisen) s.shamisen = false;
    if (kind === "rite") s.hichiriki = true;
    if (named !== "dead station" && !s.shakuhachi && !s.koto && !s.shamisen) s.shakuhachi = true;
    var present = [];
    for (var i = 0; i < MELODIC.length; i++) if (s[MELODIC[i]]) present.push(MELODIC[i] + (s.entry[MELODIC[i]] ? "(" + s.entry[MELODIC[i]] + ")" : ""));
    if (s.taiko) present.push("taiko");
    if (s.sho) present.push("sho");
    s.label = named === "dead station" ? "dead station" : present.join("+") + (named !== "free" ? " · named: " + named : "");
    return s;
  }
  function planCycle(rng, tidePos) {
    var tp = clamp01(tidePos || 0);
    var durS = rng.rnd(300, 600);                // this cycle's own breadth
    var kind = rng.pickW([["ordinary", 3], ["rite", 1.5], ["drift", 1 + 2 * (1 - tp)], ["storm", 0.5 + 3 * tp], ["silence", 0.6 + 1.6 * (1 - tp)], ["broadcast", 1]]);
    var Kd = KINDS[kind];
    var mode = rng.pickW(modePool(tp));
    var pitch = drawPitchMove(rng, mode, tp);   // 海 the sea change, or a mode-tonic pivot, or nothing
    var seating = drawSeating(rng, kind);
    var visit = drawVisitation(rng, kind, tp, seating);   // 客 at most one guest per cycle, on its own dice
    if (visit && visit.name === "mu") { seating.shakuhachi = seating.koto = seating.shamisen = seating.taiko = seating.hichiriki = seating.biwa = seating.sho = false; seating.named = "dead station"; seating.label = "mu (dead station)"; }
    if (visit && visit.name === "the festival") seating.taiko = true;
    var subDraw = rng.chance(Kd.sub), subKind = rng.pickW([["kakeai", 3], ["koto", 2], ["breath", 2]]);
    var oroDraw = rng.chance(Kd.oroshi);
    var melodicSeated = 0;
    for (var i = 0; i < 3; i++) if (seating[MELODIC[i]] && seating.entry[MELODIC[i]] !== "reprise") melodicSeated++;   // the kakeai is the sankyoku trio's
    var sub = null;
    if (subDraw) {
      if (subKind === "kakeai" && melodicSeated >= 2) sub = "kakeai";
      else if (subKind === "koto" && seating.koto) sub = "koto";
      else if (subKind === "breath" && seating.shakuhachi && seating.entry.shakuhachi !== "reprise") sub = "breath";
    }
    var oroshi = oroDraw && seating.taiko;
    var scenes = [{ type: "jo", durS: durS * Kd.jo, activity: null }];
    var haDur = durS * Kd.ha, oroDur = oroshi ? haDur * 0.15 : 0, haRemain = haDur - oroDur;
    if (sub) {
      scenes.push({ type: "ha", durS: haRemain * 0.5, activity: null });
      scenes.push({ type: sub === "kakeai" ? "kakeai" : "solo", durS: haRemain * 0.28, activity: sub });
      scenes.push({ type: "ha", durS: haRemain * 0.22, activity: null });
    } else scenes.push({ type: "ha", durS: haRemain, activity: null });
    if (oroshi) scenes.push({ type: "oroshi", durS: oroDur, activity: null });
    scenes.push({ type: "kyu", durS: durS * Kd.kyu, activity: null });
    scenes.push({ type: "release", durS: durS * Kd.rel, activity: null });
    function seatVisit(v, want, avoid) {            // the scene where this guest belongs
      var idx = -1, vi;
      for (vi = 0; vi < scenes.length; vi++) if (scenes[vi].type === want && vi !== avoid) { idx = vi; break; }
      if (idx < 0) for (vi = 0; vi < scenes.length; vi++) if (vi !== avoid) { idx = vi; break; }
      if (idx < 0) idx = 0;
      v.sceneIdx = idx; v.scene = scenes[idx].type;
      return idx;
    }
    var WANT = { "the festival": "ha", "the tolling": "jo", "mu": "jo", "the line": "jo", "the broadcast": "ha" };
    if (visit) {
      var gi = seatVisit(visit, WANT[visit.name] || "ha", -1);
      // §8.1 follow-up: a broadcast rides along in ANOTHER scene of the same
      // cycle. Two seats, one plan — the scene event fires whichever guest is
      // seated there, so nothing downstream needs a second seating path, and
      // the two can never overlap because they are never in the same scene.
      if (visit.alsoBroadcast) {
        visit.second = { name: "the broadcast" };
        seatVisit(visit.second, "ha", gi);
      }
    }
    scenes = farErode(scenes, durS);              // 逸脱 蝕: the arc decomposes
    // 逸脱 遅/弛 (critic W1 r1, items 10 & 11): the cycle's own tempo is decided
    // HERE, at plan time, not at the performance's begin — because the length
    // of the cycle and of every scene in it is part of the plan the Conductor
    // is about to walk, and a cycle that plays half as fast must LAST twice as
    // long or the dilation is only a change of note density inside an
    // unchanged frame. planCycle is called once per performance, in order, so
    // farPlanN is a stable index for the draw's own sub-fork.
    var crate = farCycleTime(farPlanN++);
    if (crate !== 1) {
      durS *= crate;
      for (var si = 0; si < scenes.length; si++) scenes[si] = { type: scenes[si].type, durS: scenes[si].durS * crate, activity: scenes[si].activity };
    }
    if (visit) {                                   // the guest may have moved with its scene
      var vi2 = -1;
      for (var vj = 0; vj < scenes.length; vj++) if (scenes[vj].type === visit.scene) { vi2 = vj; break; }
      visit.sceneIdx = vi2 < 0 ? 0 : vi2;
      visit.scene = scenes[visit.sceneIdx].type;
    }
    // ==========================================================================
    // THE BROADCASTS' OWN TIMES (owner, 2 per cycle) — drawn HERE, at plan
    // ==========================================================================
    // Two changes in one, and they depend on each other. The owner asked for
    // two broadcasts a cycle instead of one; the orchestrator asked that the
    // planned air hold EQUAL the real one. The second is only possible if t0
    // is known when the receiver arms — so t0 stops being `sceneStart +
    // rnd(8, 25)` drawn at the scene event and becomes an absolute time drawn
    // here, carried on the plan, and used unchanged at fire().
    //
    // With t0 known at arm the plan and the hold are the same object: 18.0 to
    // 29.2 s instead of 41.0 to 46.2, and the over-denial is not reduced but
    // ELIMINATED. At two a cycle that is 11 % of the night occupied rather
    // than 20 %, and none of the 11 % is air the broadcast does not use.
    //
    // PLACEMENT IS FREE ACROSS ALL LEGAL TIME (the orchestrator's ruling, after
    // "one in each half" turned out to force a jo broadcast the description
    // never promised). Legal is jo, ha and the sub-scenes; never kyū, never
    // oroshi, never release — the kyū→release joint is where the KIRU lives,
    // and that is the one place a broadcast must never be. Minimum 90 s between
    // the two and from any guest. Under 180 s of legal time, one broadcast.
    //
    // Everything the receiver commits against is fixed before it commits: the
    // scene list above, the KIRU's position at the kyū→release joint, and the
    // guest's seat. Nothing that can collide with a broadcast is drawn later.
    var LEGAL = { jo: 1, ha: 1, kakeai: 1, solo: 1 };
    var BC_GAP_S = 95, BC_EDGE_S = 8;   // 95 > BC_ARM_LEAD_S + the longest footprint (55 + 29.2)
    var legal = [], acc = 0, li;
    for (li = 0; li < scenes.length; li++) {
      var sc0 = scenes[li];
      if (LEGAL[sc0.type] && sc0.durS > BC_EDGE_S * 2) legal.push([acc + BC_EDGE_S, acc + sc0.durS - BC_EDGE_S]);
      acc += sc0.durS;
    }
    var legalS = 0; for (li = 0; li < legal.length; li++) legalS += legal[li][1] - legal[li][0];
    var guestT = null;
    if (visit && visit.name !== "the broadcast") {
      guestT = 0; for (li = 0; li < visit.sceneIdx; li++) guestT += scenes[li].durS;
      guestT += 16;                                  // the guest fires 8–25 s into its scene; take the middle
    }
    // The draw is on the form stream's own per-cycle fork, so however many
    // times it is taken it cannot move anything else in the plan.
    var BR = rng.fork("bc:" + Math.max(0, cyc.n + 1));
    var want = legalS >= 180 ? 2 : 1, picks = [], tries;
    for (var pk = 0; pk < want; pk++) {
      for (tries = 0; tries < 24; tries++) {
        var u = BR.next() * legalS, seg = 0, off = 0;
        for (li = 0; li < legal.length; li++) {
          var w = legal[li][1] - legal[li][0];
          if (u <= seg + w) { off = legal[li][0] + (u - seg); break; }
          seg += w;
        }
        var ok = true;
        if (guestT != null && Math.abs(off - guestT) < BC_GAP_S) ok = false;
        for (var qi = 0; qi < picks.length; qi++) if (Math.abs(off - picks[qi]) < BC_GAP_S) ok = false;
        if (ok) { picks.push(off); break; }
      }
    }
    picks.sort(function (a, b) { return a - b; });
    pendingPlan = { kind: kind, mode: mode, seating: seating, durS: durS, pitch: pitch, visit: visit, cycleRate: crate,
      sceneDurS: scenes.map(function (sc) { return sc.durS; }), bcAt: picks, legalS: legalS };
    return scenes;
  }
  // 客 VISITATIONS (Phase 4) — rare seeded guests. Each rolls its OWN die every
  // cycle (unconditionally; the tide tilts the odds, the kind doubles them
  // where they belong); if more than one is drawn, one is picked — never two
  // in one cycle. Cycle 0 never hosts one.
  //   放送 the broadcast — a lost gagaku recording surfaces through the static
  //   祭 the festival   — the taiko goes to a full matsuri pattern with kakegoe for one ha
  //   無 mu             — a cycle where only the reactor and the ambient breathe; the KIRU cuts silence
  //   回線 the line     — the PA and the comms-vox trade a conversation over static; nothing else claims the air
  //   鐘 the tolling    — the bonshō every ~20 s across the whole jo, the hull ringing in sympathy
  var VISITATIONS = ["the broadcast", "the festival", "mu", "the line", "the tolling"];
  var VISIT_KANA = { "the broadcast": "放送", "the festival": "祭", "mu": "無", "the line": "回線", "the tolling": "鐘" };
  function drawVisitation(rng, kind, tp, seating) {
    var p = {
      // §8.1 (the owner, after the rc.9 listen): the station picks something up
      // about once a CYCLE now, not once in three. This is a deliberate change
      // to ORDINARY nights — it is not a far-tail feature — so it is the one
      // engine edit outside the far tail's own files, and the identity baseline
      // is re-based on it rather than the change being hidden from the gate.
      // Measured before: 0.34 / 0.35 / 0.35 planned per cycle over 97 cycles.
      // The other guards are untouched: never two in a cycle, never in a KIRU
      // or a hush, and the recent ring still keeps a reel out for three cycles.
      "the broadcast": 1,

      "the festival":  (0.10 + 0.10 * tp) * (kind === "storm" ? 2 : 1),
      "mu":            (0.03 + 0.03 * (1 - tp)) * (kind === "drift" || kind === "silence" ? 1.5 : 1),   // rare: a dead night is one cycle, not a third of them
      "the line":      0.07 * (kind === "broadcast" ? 1.8 : 1),
      "the tolling":   (0.09 + 0.05 * tp) * (kind === "rite" ? 2 : 1),
    };
    // §8.1 follow-up (the orchestrator, and the owner's own direction): the
    // broadcast is becoming its OWN KIND of visitation, so it stops competing
    // with the guests for the cycle. A cycle may host one broadcast AND one of
    // 祭 無 回線 鐘, seated in different scenes and never overlapping. The old
    // shape forced a choice, and at one broadcast a cycle that choice was
    // deleting the other four: measured, two non-broadcast guests in two hours.
    // Still never two broadcasts in a cycle, never in a KIRU or a hush.
    var drawn = [], bc = false;
    for (var i = 0; i < VISITATIONS.length; i++) {
      var hit = rng.chance(p[VISITATIONS[i]]);                 // every draw taken, unconditionally
      if (!hit) continue;
      if (VISITATIONS[i] === "the broadcast") bc = true; else drawn.push([VISITATIONS[i], 1]);
    }
    var pick = rng.pickW(drawn.length ? drawn : [["none", 1]]);   // one pickW draw either way
    if (cyc.n < 0) return null;
    if (pick === "the festival" && seating.named === "dead station") pick = "none";
    if (pick === "mu" && (lastCycleEmpty || seating.named === "dead station")) pick = "none";   // never two empty cycles in a row
    if (pick === "none") return bc ? { name: "the broadcast" } : null;
    // both drawn: the guest takes its scene and the broadcast takes another.
    // `guest` rides along on the same object so nothing else has to learn a
    // second seating path — one plan, two seats.
    return bc ? { name: pick, alsoBroadcast: true } : { name: pick };
  }
  var visitActive = null;                          // the guest in progress: { name, until }
  var lastCycleEmpty = false;                      // the previous cycle was mu or a dead station
  function fireVisitation(v, t) {
    var name = v.name;
    emitEvent({ cat: "form", label: "客 " + VISIT_KANA[name] + " " + name, detail: "begins · " + scn.type + " · " + Math.round(scn.durS) + "s" }, t);
    if (name === "the broadcast") {
      // The broadcast is no longer fired from the visitation seam: it has its
      // own drawn times on the form lane (see the cycle handler). Firing here
      // as well would seat a third.
      return;
    }
    else if (name === "the festival") visitActive = { name: name, until: scn.startT + scn.durS };
    else if (name === "the line") visitLine(t);
    else if (name === "the tolling") visitTolling(t);
    // mu is the seating itself; the KIRU cuts silence
  }
  // 放送 THE BROADCAST — an Etenraku-SHAPED contour (shape only, no quotation):
  // hichiriki + a flute (the shakuhachi's kan register an octave up, a breath
  // behind) over a shō aitake, all through the radio bandpass and a bed of
  // static; fades in from the static and dissolves back into it. Takes the
  // air if it can; a radio does not ask twice.
  var ETENRAKU_SHAPE = [[3, 2], [4, 1], [3, 2], [2, 1], [0, 3], [2, 1], [3, 1], [4, 2], [5, 1], [4, 1], [3, 3], [2, 1], [0, 4]];
  function visitBroadcast(t0) {
    var R = S.visit, t = t0 + 2, beat = 1.35 + R.rnd(0, 0.4), total = 0, i;
    for (i = 0; i < ETENRAKU_SHAPE.length; i++) total += ETENRAKU_SHAPE[i][1] * beat;
    var dur = total + 6;
    airClaimAt(t0, "broadcast", dur, 4);
    // the static bed: rises, holds under, swallows the end
    var nz = noiseSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(1800, t0);
    nz.connect(hp); hp.connect(ng); ng.connect(radioBus);
    PJ.Voice.env(ng.gain, t0, [[2, 0.05], [dur - 6, 0.025], [3, 0.06], [1.5, 0]]);
    nz.start(t0, R.next() * 10); nz.stop(t0 + dur + 2);
    var fade = ctx.createGain(); fade.connect(radioBus);
    PJ.Voice.env(fade.gain, t0, [[3, 0.9], [dur - 7, 0.9], [4, 0]]);
    var base = scaleIndexOf(6), prev = null;
    // the shō under it: one aitake for the whole recording, through the radio
    var ait = chooseAitake(R, 5), c = ctx;
    for (i = 0; i < ait.freqs.length; i++) {
      var so = c.createOscillator(), sg = c.createGain(); so.type = "sawtooth"; so.frequency.setValueAtTime(ait.freqs[i], t);
      var slp = c.createBiquadFilter(); slp.type = "lowpass"; slp.frequency.setValueAtTime(1400, t);
      so.connect(slp); slp.connect(sg); sg.connect(fade);
      PJ.Voice.env(sg.gain, t, [[3, 0.03], [total - 3, 0.03], [3, 0]]);
      so.start(t); so.stop(t + total + 3.2);
      emitNote("sho", ait.freqs[i], t);
    }
    var tt = t;
    for (i = 0; i < ETENRAKU_SHAPE.length; i++) {
      var deg = base + ETENRAKU_SHAPE[i][0], d = ETENRAKU_SHAPE[i][1] * beat;
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, deg))].freq;
      hichirikiNote(f, tt, d * 0.95, { glideFrom: prev, gain: 0.7, out: fade });
      var f2 = SCALE[Math.max(0, Math.min(SCALE.length - 1, deg + 5))].freq;   // the flute an octave up, a breath behind
      shakuhachiNote(f2, tt + 0.12 + R.rnd(0, 0.1), d * 0.85, { glideFrom: prev ? prev * 2 : null, breath: 0.7, out: fade });
      prev = f; tt += d;
    }
    emitEvent({ cat: "form", label: "客 放送 the recording dissolves", detail: Math.round(dur) + "s" }, t0 + dur);
  }
  // 回線 THE LINE — the PA and the comms-vox trade a conversation over static
  // for 40–90 s; nothing else claims the air (the line holds it).
  function visitLine(t0) {
    var R = S.visit, dur = 40 + R.rnd(0, 50), t = t0 + 1;
    var tok = airClaimAt(t0, "line", dur, 5);
    var nz = noiseSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2500, t0);
    nz.connect(hp); hp.connect(ng); ng.connect(lg("pa"));
    PJ.Voice.env(ng.gain, t0, [[1, 0.02], [dur - 2, 0.02], [1, 0]]);
    nz.start(t0, R.next() * 10); nz.stop(t0 + dur + 0.2);
    var who = 0;
    while (t < t0 + dur - 4) {
      if (who === 0) { var d = 1.5 + R.rnd(0, 2); paSpeak(t, d, { gain: 0.8 }); t += d + 0.6 + R.rnd(0, 1.2); }
      else { ambCommsVox(t); t += 1.2 + R.rnd(0, 1.5); }
      who = 1 - who;
      if (R.next() < 0.15) t += 2 + R.rnd(0, 3);   // a long pause on the line
    }
    if (tok) tok.until = t0 + dur + 5;
    emitEvent({ cat: "form", label: "客 回線 the line goes dead", detail: Math.round(dur) + "s" }, t0 + dur);
  }
  // 鐘 THE TOLLING — the bonshō every ~20 s across the whole jo; the room goes
  // all the way into the hull and the koto's strings ring with every stroke.
  function visitTolling(t0) {
    var R = S.visit, t = t0 + 3, end = scn.startT + scn.durS - 5, n = 0;
    if (roomBlend) { try { roomBlend.setBalance(1, 6); } catch (e) {} }
    while (t < end) { ambBonsho(t, { halo: true }); n++; t += 18 + R.rnd(0, 6); }
    emitEvent({ cat: "form", label: "客 鐘 the tolling", detail: n + " strokes across the jo" }, t0);
  }
  // 海 THE SEA CHANGE — once every 2–4 cycles, at a cycle boundary, the
  // field's tonic moves: up a fourth or down a fifth (the traditional koto
  // retuning between pieces; a home pull keeps the wander on the circle of
  // fourths from drifting forever), or — rare, dark-tide only — the
  // station's own gesture, a SEMITONE SINK (the reactor sagging; Sycorax's
  // rule). Otherwise, when the mode changes, about half the time it PIVOTS on
  // shared tones instead of restarting on the tonic (hirajoshi on D → in-sen
  // on A shares four pitches): the same four modes yield far more colors.
  // Every draw is taken unconditionally (stream discipline).
  var cyclesSinceSea = 0;
  function drawPitchMove(rng, mode, tp) {
    var seaDraw = rng.next(), sinkDraw = rng.next(), pivotDraw = rng.next(), dirDraw = rng.next(), pivotPick = rng.next();
    var cur = field.tonicHz, curPcs = pcSet(MODES[currentMode].offsets, cur);
    var due = cyclesSinceSea >= 4 || (cyclesSinceSea >= 2 && seaDraw < 0.45);
    if (cyc.n >= 0 && due) {
      if (tp > 0.7 && sinkDraw < 0.22) {
        return { kind: "sink", tonicHz: foldTonic(cur * Math.pow(2, -1 / 12)), label: "semitone sink" };
      }
      // distance from home (D) on the circle of fourths: k up-fourths mod 12
      var off = ((Math.round(12 * Math.log(cur / TONIC_HZ) / Math.LN2) % 12) + 12) % 12;
      var k = (off * 5) % 12, dist = Math.min(k, 12 - k);
      var homeward = k !== 0 && dirDraw < 0.3 + 0.2 * dist;
      var up = homeward ? (k <= 6 ? -5 : 5) : (k <= 6 ? 5 : -5);   // +5 = up a fourth, −5 = down a fourth (= up a fifth, folded)
      var raw = cur * Math.pow(2, up / 12), folded = foldTonic(raw);
      var label = up > 0 ? (folded < raw ? "down a fifth" : "up a fourth") : (folded > raw ? "up a fifth" : "down a fourth");
      return { kind: "sea", tonicHz: folded, label: label };
    }
    if (mode !== currentMode && pivotDraw < 0.5) {
      // candidate tonics: the current field's own pitches; keep those where
      // the new mode shares ≥ 4 pitch classes with what is sounding now
      var cands = [], steps = MODES[mode].offsets;
      for (var d = 0; d < field.size; d++) {
        var th = foldTonic(field.degFreq(d, 0));
        if (Math.abs(th - cur) < 1) continue;
        var n = sharedPcs(pcSet(steps, th), curPcs);
        if (n >= 4) cands.push([th, n]);
      }
      if (cands.length) {
        var pick = cands[Math.floor(pivotPick * cands.length)];
        return { kind: "pivot", tonicHz: pick[0], label: "pivot · " + pick[1] + " shared" };
      }
    }
    return null;
  }
  // JOINTS — a page of static, a hull tick, a single fūrin, or nothing
  // (about one in three pass silent). The kyū → release joint IS the KIRU.
  function jointBody(kind, t) {
    var out = panAt("ambient", S.joints.rnd(-0.5, 0.5));
    if (kind === "static") {
      var nz = noiseSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = "highpass"; hp.frequency.setValueAtTime(1500 + S.joints.rnd(0, 2500), t);
      nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.25 + S.joints.rnd(0, 0.4);
      PJ.Voice.env(g.gain, t, [[0.01, 0.045], [d - 0.03, 0.03], [0.02, 0]]);
      nz.start(t, S.joints.rnd(0, 10)); nz.stop(t + d + 0.05);
    } else if (kind === "hull tick") {
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1400 + S.joints.rnd(0, 1600), t);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
      o.connect(og); og.connect(out);
      PJ.Voice.env(og.gain, t, [[0.003, 0.06], [0.11, 0.002], [0.03, 0]]);
      o.start(t); o.stop(t + 0.2);
    } else if (kind === "furin") {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(S.joints.rnd(0, 4)));
      var fo = ctx.createOscillator(), fg = ctx.createGain();
      fo.type = "triangle"; fo.frequency.setValueAtTime(SCALE[idx].freq * 2, t);
      fo.connect(fg); fg.connect(out);
      PJ.Voice.env(fg.gain, t, [[0.004, 0.035], [1.3, 0.0005], [0.1, 0]]);
      fo.start(t); fo.stop(t + 1.5);
    }
  }
  var DRAM = {
    name: "zankyo",
    durationRangeS: [120, 1500],                 // 逸脱 遅: a dilated cycle can run to 2.5× the drawn 300–600 s, or down to 0.4×
    plan: planCycle,
    scenes: {
      jo:      sceneDef("jo", 1, 0.05),
      ha:      sceneDef("ha", 2, 0.25),
      kakeai:  sceneDef("kakeai", 2, 0.35),
      solo:    sceneDef("solo", 1, 0),
      oroshi:  sceneDef("oroshi", 2, 0.2),
      kyu:     sceneDef("kyu", 2, 0.45),        // five melodic voices now: two hold the kyū, a third by the dice — the tangle earned, not the norm
      release: sceneDef("release", 1, 0),
    },
    joint: function (fromType, toType, t) {
      if (!playing) return null;
      if (fromType === "kyu" && toType === "release") {
        if (farKiruFails(t)) {                     // 逸脱 未斬: the wall runs into the next jo
          emitEvent({ cat: "far", label: "未斬 the cut does not come", detail: "the wall runs on · cycle " + cyc.n }, t);
          return "no-kiru";
        }
        kiru(t); return "kiru";
      }
      var draw = S.joints.pickW([["silent", 34], ["static", 22], ["hull tick", 22], ["furin", 22]]);   // unconditional
      emitEvent({ cat: "form", label: "⌁ joint", detail: "joint: " + draw + " · " + fromType + "→" + toType }, t);
      if (draw === "silent") return null;
      try { jointBody(draw, t); } catch (e) { return null; }
      return draw;
    },
    chainOverlapS: [0, 0],
    tide: { periodPerfs: [5, 8], labels: ["drifting dark", "the dark peak", "returning light", "home"] },
  };
  function onConductorEvent(evt) {
    if (evt.type === "performance" && evt.phase === "begin") {
      var p = pendingPlan || { kind: "ordinary", mode: "hirajoshi", seating: drawSeating(S.form, "ordinary"), durS: evt.durS };
      pendingPlan = null;
      cyc.n = evt.n - 1; cyc.kind = p.kind; cyc.seating = p.seating; cyc.durS = evt.durS; cyc.startT = evt.t; cyc.mode = p.mode;
      // 逸脱 W4 — the meta-tide lifts this cycle before anything in it reads
      // how far out the night is, and the time departures are rebuilt on the
      // new view. FIRST, deliberately: farTimeSetup caches sixteen departures'
      // parameters, so a lift applied after it would be read by nothing.
      farLiftCycle(cyc.n, evt.t);
      farTimeSetup(evt.t);
      farPitchSetup(evt.t, true);            // …and the tuning departures, without moving the glide's origin
      arcStartTime = evt.t; ARC_PERIOD = evt.durS;
      var pm = p.pitch, fromName = noteName(field.tonicHz);
      cyclesSinceSea++;
      setMode(p.mode, "cycle " + cyc.n + " · " + Math.round(evt.durS) + "s · kind: " + p.kind + " · meta " + evt.tidePos.toFixed(2) + " (" + evt.tideLabel + ")" + (pm && pm.kind === "pivot" ? " · " + pm.label : ""), evt.t, pm ? pm.tonicHz : null);
      if (pm) haloRetuneAt = evt.t;                 // the strings ring on in the old world until the next boundary
      if (pm && pm.kind !== "pivot") {
        cyclesSinceSea = 0;
        emitEvent({ cat: "mode", label: "海 sea change", detail: fromName + " → " + noteName(field.tonicHz) + " · " + pm.label + " · " + MODES[p.mode].name + " · cycle " + cyc.n }, evt.t);
      }
      emitEvent({ cat: "form", label: "❁ cycle plan", detail: KINDS[p.kind].kana + " kind: " + p.kind + " · seating: " + p.seating.label + " · scenes: " + evt.scenes.join(">") }, evt.t);
      farCycleRate = p.cycleRate != null ? p.cycleRate : 1;   // 逸脱 遅: decided at plan time with the scene lengths
      farStuck = false;                           // 逸脱 崩: one locked groove per cycle at most
      // Say it. A departure the VFD never mentions is a departure nobody can
      // tell from a bug — and this one shipped silent once already (the critic
      // found a 遅 night that played thirty minutes of home and announced 遅).
      if (farCycleRate !== 1) emitEvent({ cat: "far", label: "遅 " + (farCycleRate > 1 ? "the cycle slows" : "the cycle races"), detail: "×" + (1 / farCycleRate).toFixed(2) + " speed · " + Math.round(evt.durS) + "s" }, evt.t);
      cyc.visit = p.visit || null; cyc.visit2 = (p.visit && p.visit.second) || null; visitActive = null;
      lastCycleEmpty = !!(p.seating && p.seating.named === "dead station");
      if (p.visit) emitEvent({ cat: "form", label: "客 " + VISIT_KANA[p.visit.name] + " " + p.visit.name, detail: "visitation: " + p.visit.name + " · seated in " + p.visit.scene + " (" + (p.visit.sceneIdx + 1) + "/" + evt.scenes.length + ")" }, evt.t);
      // …and the broadcast riding along in its own scene is announced in its
      // own right. It was seated and it fired, but nothing downstream could see
      // it — not the log, not the analyzer — because only the first seat was
      // ever announced. A guest nobody can see is a guest nobody can gate.
      if (cyc.visit2) emitEvent({ cat: "form", label: "客 " + VISIT_KANA[cyc.visit2.name] + " " + cyc.visit2.name, detail: "visitation: " + cyc.visit2.name + " · seated in " + cyc.visit2.scene + " (" + (cyc.visit2.sceneIdx + 1) + "/" + evt.scenes.length + ")" }, evt.t);
      // S1: the receiver is ARMED at plan time — it draws the reel and schedules
      // its prefetch from the hosting scene's start (≥ 20 s before any t0)
      // The broadcasts no longer ride a scene seat: each has an absolute time
      // drawn at plan, and each arms ARM_LEAD_S before it so the receiver can
      // prefetch. arm() is given the exact t0, which is what lets the planned
      // hold BE the real hold instead of covering the guess.
      if (signalProvider && p.bcAt && p.bcAt.length) {
        (function (times, kind, tide, cyN, t0c) {
          for (var bi = 0; bi < times.length; bi++) {
            (function (off) {
              var at = t0c + off;
              lane("form").at(Math.max(t0c + 0.05, at - BC_ARM_LEAD_S), function () {
                try { signalProvider.arm({ cycle: cyN, kind: kind, t0: at, hostStartT: at - 8, hostDurS: 60, tidePos: tide }); } catch (e) {}
              });
              lane("form").at(at, function (t) {
                var took = false;
                try { took = !!signalProvider.fire(at); } catch (e) { took = false; }
                if (!took) { try { visitBroadcast(at); } catch (e2) {} }   // abandoned to the fallback rather than forced
              });
            })(times[bi]);
          }
        })(p.bcAt.slice(), p.kind, evt.tidePos, cyc.n, evt.t);
      }
      Motif.newCycle(evt.t);
    } else if (evt.type === "scene") {
      scn.type = evt.scene; scn.activity = evt.activity; scn.startT = evt.t; scn.durS = evt.durS;
      Motif.setDialogue(evt.scene === "kakeai" ? { postMul: 1.6, types: [["imitate", 6], ["invert", 1], ["develop", 1]] } : null);
      emitEvent({ cat: "form", label: "▸ scene", detail: "scene: " + evt.scene + (evt.activity ? " (" + evt.activity + ")" : "") + " · " + Math.round(evt.durS) + "s · " + (evt.idx + 1) + "/" + evt.count }, evt.t);
      setSceneRoom(evt);
      if (visitActive && evt.t >= visitActive.until) visitActive = null;
      if (signalProvider && signalProvider.scene) { try { signalProvider.scene({ type: evt.scene, startT: evt.t, durS: evt.durS, idx: evt.idx, count: evt.count, cycle: cyc.n, kind: cyc.kind, planned: !!(cyc.visit && cyc.visit.name === "the broadcast") }); } catch (e) {} }   // S2: the 選局 scan seats at the next legal scene
      // 逸脱 崩: about half the cycles of a disintegrating night stick, at the
      // first ha — decided on the cycle's own sub-fork, so it is the same
      // every time this seed is played however long anyone listens.
      if (farNight && farNight.dep.disint && evt.scene === "ha" && !farStuck &&
          S.far.fork("disint-when:" + Math.max(0, cyc.n)).chance(0.5)) {
        farStuck = true;
        try { farDisintegrate(evt.t + 2); } catch (e) {}
      }
      if (cyc.visit && cyc.visit.sceneIdx === evt.idx && !cyc.visit.fired) { cyc.visit.fired = true; try { fireVisitation(cyc.visit, evt.t + (cyc.visit.name === "the tolling" ? 0 : S.visit.rnd(8, 25))); } catch (e) {} }
      if (cyc.visit2 && cyc.visit2.sceneIdx === evt.idx && !cyc.visit2.fired) { cyc.visit2.fired = true; try { fireVisitation(cyc.visit2, evt.t + S.visit.rnd(8, 25)); } catch (e) {} }   // §8.1: the broadcast riding along in its own scene
    }
  }
  // Room balance per scene (0 = the corridor, close; 1 = the hull, vast):
  // jo deep in the hull, kyū close and dry with the grit send open, release
  // back to the hull for the bell. Ramped 8–16 s on the rooms stream.
  var ROOM_BALANCE = { jo: 0.85, ha: 0.5, kakeai: 0.45, solo: 0.65, oroshi: 0.3, kyu: 0.12, release: 0.9 };
  function setSceneRoom(evt) {
    var rampS = Math.min(S.rooms.rnd(8, 16), 0.6 * evt.durS);   // draw first, unconditionally; short scenes arrive in their room
    if (!roomBlend) return;
    var bal = clamp01((ROOM_BALANCE[evt.scene] != null ? ROOM_BALANCE[evt.scene] : 0.5) + 0.1 * (wxAt(evt.t).roomTilt - 0.5));   // the weather's ±0.05
    try { roomBlend.setBalance(bal, rampS); } catch (e) {}
    // the koto's halo retunes at the first scene boundary AFTER a sea change
    if (haloRetuneAt != null && evt.t > haloRetuneAt + 0.5 && halo) { haloRetuneAt = null; try { halo.retune(haloFreqs()); } catch (e2) {} }
  }

  // ---- what the bodies read ----
  var ARC_PERIOD = 420;                          // the CURRENT cycle's length (telemetry; the Conductor owns the clock)
  var arcStartTime = 0;
  function getArc(t) {                          // continuous intensity at the scheduled time (defaults to now)
    if (!ctx || !playing || !conductor) return 0;
    return conductor.intensityAt(t != null ? t : ctx.currentTime);
  }
  function arcPos(t) {                           // raw 0..1 position within the cycle
    if (!ctx || !playing || cyc.n < 0) return 0;
    var at = t != null ? t : ctx.currentTime;
    return clamp01((at - cyc.startT) / cyc.durS);
  }
  function sceneX(t) { var at = t != null ? t : ctx.currentTime; return scn.durS > 0 ? clamp01((at - scn.startT) / scn.durS) : 0; }
  function arcPhase(t) {
    if (!ctx || !playing || !scn.type) return "—";
    return PHASE_OF[scn.type] || "ha";
  }
  function sceneType() { return scn.type; }
  // The one verbatim reprise's window: late in the kyū (Motif asks this).
  function repriseWindow(t) { return scn.type === "kyu" && sceneX(t) > 0.55; }
  function arcInfo() {
    if (!ctx || !playing) return { level: 0, phase: "—" };
    return { level: getArc(), phase: arcPhase() };
  }
  // The tide (the meta-arc): 0 = trough (home, light) … 1 = peak (dark).
  function tidePos() { return conductor ? conductor.tide().pos : 0; }
  function metaSeverity() { return tidePos() * (cyc.kind === "drift" ? 0.5 : 1); }
  // Global density tilt (±12% on melodic rest multipliers with the tide) ×
  // the kind's own rest multiplier (silence rests most, storm least).
  function metaRestMul() { return (1 + 0.12 * (1 - 2 * tidePos())) * K().restMul * farRestMul() * farEnsembleRest(); }   // 逸脱 間 + 重/継/群
  // 逸脱 — THE ENSEMBLE'S DENSITY BRAKE. An ensemble departure seats all five
  // melodic voices and lifts the air, and five bodies where the air normally
  // allows two is two and a half times the notes: measured, 重 took the node
  // budget from ~1100/min to 3314 and the peak concurrent sources past their
  // ceiling. But five voices sharing ONE LINE should cost about what the line
  // costs — that is the whole idea of heterophony, and a version of it that is
  // simply louder and busier is not the departure, it is a mistake with a
  // Japanese name. So each departure carries the factor its own arithmetic
  // implies: 重 copies the line five ways (5/2 against the air's usual two),
  // 継 splits it rather than copying it and only pays for its 2–3 passes, and
  // 影 already equalises its own beats and needs nothing.
  var FAR_ENS_REST = { hetero: 7.5, hocket: 4.6, canon: 1, swarm: 7 };
  var FAR_ENS_GAP = { hetero: 10, hocket: 7, canon: 6, swarm: 12 };   // seconds between gestures
  function farEnsembleRest() {
    var E = farEnsemble(), m = E ? (FAR_ENS_REST[E.kind] || 1) : 1;
    if (farMirror) m *= 1.8;                     // 鏡: an answered phrase is two phrases
    return m;
  }
  function gapMulAt(t) { return 0.85 + 0.3 * wxAt(t).gapMul; }   // the weather's ±15 % on phrase gaps
  // Is this voice seated right now? The cycle's seating, its entry rule
  // (koto/shamisen "from the ha"; the shakuhachi "for the reprise only"),
  // and the ha's solo sub-scenes (one voice alone).
  function seated(voice, t) {
    var s = cyc.seating;
    if (!s) return true;
    // 逸脱 重/継/群: an ensemble departure IS the scene, FOR THE LENGTH OF ITS
    // GESTURE. "All five melodic voices read the same phrase" cannot be true
    // while the cycle's seating lottery has rested two of them, so a voice due
    // to enter is seated whatever the lottery said — but only then. Seating all
    // five for the whole night instead cost 74 % more nodes than the same
    // seed's home and made the departure a constant medium density rather than
    // an ensemble that GATHERS: between gestures the ordinary seating stands,
    // and voices speak alone or not at all, which is what makes the gathering
    // audible when it comes.
    if (FAR_MEL_SET[voice] && farDueToEnter(voice, t)) return true;
    if (s[voice] === false) return false;
    var e = s.entry[voice];
    if (e === "ha" && arcPhase(t) === "jo") return false;
    if (e === "reprise" && !Motif.wantsReprise(t)) return false;
    if (scn.type === "solo") {
      if (scn.activity === "koto" && voice !== "koto") return false;
      if (scn.activity === "breath" && voice !== "shakuhachi") return false;
    }
    if (scn.type === "kakeai" && (voice === "hichiriki" || voice === "biwa")) return false;   // the duet is the trio's
    if (voice === "biwa" && arcPhase(t) === "kyū") return false;                             // the narrator falls silent when the storm comes
    return true;
  }
  // THE AIR's manners: the scene's declared limit and overlap chance, the
  // silence kind capping the air at one voice.
  function airLimitNow() {
    var l = conductor ? conductor.airLimit() : 1;
    if (cyc.kind === "silence") return 1;
    // 逸脱 重/継: an ensemble departure is five voices on one line, which the
    // air's ordinary manners (one or two holders) would deny four of. The air
    // is the station's courtesy protocol, not a polyphony budget, and on these
    // nights the courtesy is suspended — that IS the departure.
    var E = farEnsemble();
    if (E) return Math.max(l, E.voices.length);
    return l;
  }
  function airOverlapNow() { return conductor ? conductor.overlapChance() : 0; }
  // A claim's margin of silence after the phrase, by phase and kind.
  function airMargin(R, t) {
    var ph = arcPhase(t), m;
    if (ph === "jo") m = R.rnd(3, 7); else if (ph === "ha") m = R.rnd(1.5, 4); else if (ph === "kyū") m = R.rnd(0.4, 1.5); else m = R.rnd(3, 6);
    return m * K().marginMul * farRestMul();      // 逸脱 間
  }
  function getMetaInfo() {                       // read-only console/harness surface
    var td = conductor ? conductor.tide() : { pos: 0, periodPerfs: 0, label: "—" };
    return { cycle: cyc.n, metaPos: td.pos, period: cyc.durS, severity: metaSeverity(), metaPeriod: td.periodPerfs,
      kind: cyc.kind, seating: cyc.seatingLabel || (cyc.seating && cyc.seating.label) || "", scene: scn.type, activity: scn.activity, tideLabel: td.label };
  }

  // ==========================================================================
  // ELASTIC SHARED PULSE — the ensemble locks as the climax builds
  // ==========================================================================
  // The taiko publishes its grid (bpm + anchor beat) whenever it schedules a
  // pattern; koto and shamisen phrase-onsets MAGNETIZE toward the nearest
  // upcoming beat with strength that rises with the arc — free-floating in the
  // jo, audibly locked and DRIVING through the kyū, and free again the moment
  // the KIRU gates the drums. The shakuhachi never locks: the soloist floats
  // over the tightening ensemble.
  var pulse = { bpm: 0, beat: 0, anchor: 0, active: false };
  function pulseStrength(arc) {
    if (visitActive && visitActive.name === "the festival" && pulse.active && pulse.beat > 0) return 0.95;   // 祭 the ensemble locks hard
    if (!pulse.active || pulse.beat <= 0 || arc < 0.45) return 0;
    var s = (arc - 0.45) / 0.5;                  // 0 at arc 0.45 → 1 at 0.95
    if (s > 1) s = 1;
    return s * 0.85;                             // never a hard snap — elastic, not sequenced
  }
  // Blend a freely-chosen onset toward the nearest UPCOMING taiko beat.
  // Only ever delays (audio can't rewind), and never by more than one beat.
  // 逸脱 多: under polymeter each magnetized voice is pulled to a DIFFERENT
  // drum's meter, which is the half of the departure that makes it music
  // rather than a drum exercise — the koto hears the 3, the shamisen the 4,
  // the biwa the 7, and their phrases fall apart from one another accordingly.
  var FAR_POLY_VOICE = { koto: 0, shamisen: 1, biwa: 2 };
  function pulseBeatFor(voice) {
    if (!farPoly || !pulse.active || voice == null || FAR_POLY_VOICE[voice] == null) return pulse.beat;
    var m = farPoly.meters;
    return pulse.beat * m[FAR_POLY_VOICE[voice] % m.length] * 0.5;   // the drum's own cycle, in the shared tatum
  }
  function pulseSnap(t, arc, voice) {
    var s = pulseStrength(arc);
    if (s <= 0) return t;
    var b = pulseBeatFor(voice);
    if (!(b > 0)) return t;
    var grid = pulse.anchor + Math.ceil((t - pulse.anchor) / b) * b;
    if (grid - t > b + 1e-6) return t;           // degenerate-grid guard
    return t + (grid - t) * s;
  }
  // Light duration quantization above arc 0.7 — note lengths lean ~30% toward
  // the nearest half-beat, so the locked phrases also SPEAK in the meter.
  function pulseQuantDur(dur, arc) {
    if (!pulse.active || pulse.beat <= 0 || arc < 0.7) return dur;
    var half = pulse.beat * 0.5;
    var q = Math.max(half * 0.5, Math.round(dur / half) * half);
    return dur + (q - dur) * 0.3;
  }

  // ==========================================================================
  // MOTIF ENGINE — working set, transform algebra, genealogy, dialogue ledger
  // ==========================================================================
  // Replaces the old 24-slot motif soup + single lastCall. Each jo-ha-kyū
  // cycle works THREE ideas deeply — a theme and two subsidiaries, named by
  // katakana iroha (イ ロ ハ), drawn from the six authentic seed gestures
  // below (the cultural DNA). A motif carries identity + genealogy:
  //   { name, gen, chain[], notes: [{ deg (SCALE index), durBeats }] }.
  // Development ACCUMULATES: it continues from the most-developed living
  // descendant instead of restarting from the seed; an identity tether grafts
  // the ancestor's opening back every 3rd generation; the shakuhachi restates
  // the theme verbatim once, late in the kyū — the last word before the KIRU;
  // and a decomposed ghost of each cycle's deepest development opens the next
  // cycle's jo, so the 7-minute cycles chain into a journey, not a loop.
  // Call-and-response is a real obligation LEDGER with deadlines, not a
  // fixed-probability echo of whoever spoke last.

  // Register FOLDING, not clamping: out-of-range degrees fold back by octaves
  // (5 scale steps), so a transposed motif keeps its contour instead of
  // flattening against the rails.
  function foldDeg(i) {
    var n = field.size;
    i = Math.round(i);
    while (i < 0) i += n;
    while (i > SCALE.length - 1) i -= n;
    return i;
  }
  // Shift a motif into a voice's register by whole octaves (mean toward the
  // voice's center), then fold stragglers — the intervals survive intact.
  function fitToRegister(notes, center) {
    if (!notes.length) return [];
    var sum = 0, i;
    for (i = 0; i < notes.length; i++) sum += notes[i].deg;
    var n = field.size, shift = Math.round((center - sum / notes.length) / n) * n;
    var out = [];
    for (i = 0; i < notes.length; i++) out.push({ deg: foldDeg(notes[i].deg + shift), durBeats: notes[i].durBeats });
    return farTruncate(out);
  }
  // 逸脱 間: when silence is the material, a phrase is one event or two — the
  // sound is the interruption. Applied at the two places a phrase is born
  // (here and in walk()), so every body inherits it and none had to be told.
  function farTruncate(notes) {
    if (!farSingleton() || notes.length < 2) return notes;
    return notes.slice(0, 1 + (notes.length > 3 ? 1 : 0));
  }

  var Motif = (function () {
    var NAMES = ["イ", "ロ", "ハ"];                // katakana iroha — the working set's names
    var SEED_PHRASES = [                           // the twelve authentic gestures — the ancestor pool
      { name: "honkyoku descent", degs: [3, 2, 1, 0], durs: [1, 1, 1, 2] },            // → tonic (shakuhachi, jo)
      { name: "sakura sigh",      degs: [1, 2, 1],    durs: [1, 1.5, 2] },             // the most recognizably-Japanese turn
      { name: "kumoi cadence",    degs: [4, 3, 0],    durs: [1, 1, 2] },
      { name: "tsugaru run",      degs: [0, 1, 2, 3, 4], durs: [0.5, 0.5, 0.5, 0.5, 1.5] },  // hammer run
      { name: "midare leaps",     degs: [0, 4, 1, 3, 0], durs: [1, 0.5, 1, 0.5, 2] },  // scattered (kyū)
      { name: "kakegoe answer",   degs: [0, 1, 2],    durs: [0.5, 0.5, 1.5] },         // retrograde-pairs with the sigh
      // ZANKYŌ 2 (Phase 2): the pool grows — each a real idiom's contour, none a quotation
      { name: "netori tuning",    degs: [0, 1, 0, 3, 3], durs: [3, 1, 2, 1, 4] },       // the gagaku tuning-in: tonic tried, the fifth held
      { name: "sugagaki figure",  degs: [3, 3, 2, 3, 0], durs: [0.5, 0.5, 1, 0.5, 2] }, // koto: the repeated-note strum figure
      { name: "rokudan opening",  degs: [0, 0, 4, 3, 5, 3], durs: [1, 1, 1, 0.5, 2, 2] }, // danmono: the tonic twice, then the rise
      { name: "jongara lick",     degs: [5, 4, 3, 4, 3, 2, 0], durs: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5] }, // Tsugaru: the fast fall
      { name: "kagura call",      degs: [0, 3, 3, 5, 3], durs: [1, 1.5, 0.5, 2, 2] },   // the shrine flute's rising call
      { name: "yatai-bayashi",    degs: [0, 0, 1, 0, 3, 0], durs: [0.5, 0.25, 0.25, 0.5, 0.5, 1] }, // the festival drum's don-doko-don, sung
    ];
    // ---- THE IMPROVISER (ported in spirit from the Jukebox's motif improviser):
    // a first-order Markov walk in degree-class space with JAPANESE-IDIOM
    // transition tables and tendency rules — the semitone above the tonic
    // FALLS (in-sen / iwato's second), the fifth LEAPS to the octave, the sixth
    // sinks back onto the fifth, and descents end on the tonic with a MERI dip
    // (the final note carries a meri tag the shakuhachi honours as a bend).
    // Each cycle's working set gains one NEWBORN from here; the pool of names
    // grows all night. All draws on the motif stream.
    var BORN_ROWS = [
      [1,   3,   2,   3,   1  ],   // from the tonic: to the 2nd or the 5th
      [4,   0.5, 2.5, 1,   0.5],   // from the 2nd: falls to the tonic
      [2,   3,   1,   3,   1  ],   // from the 3rd
      [3,   1,   2.5, 1,   3  ],   // from the 5th: to the tonic (the leap), the 6th, the 3rd
      [1,   0.5, 2,   4,   1  ],   // from the 6th: back to the fifth
    ];
    var BORN_DURS = [[0.5, 3], [1, 5], [1.5, 3], [2, 1.5]];
    var SYL_A = ["ka", "shi", "to", "mi", "yu", "ha", "ne", "sa", "ku", "ri"];
    var SYL_B = ["ge", "ro", "n", "ki", "ma", "zu", "te", "yo", "ru", "e"];
    var bornSerial = 0, bornNames = {};
    function birth() {
      var R = S.motif, n = R.rint(4, 7), notes = [], cls = R.pickW([[0, 3], [3, 2], [1, 1], [2, 1], [4, 1]]);
      var N = field.size, deg = scaleIndexOf(cls) + N * R.rint(0, 1);   // absolute degree index in the mid band
      for (var i = 0; i < n; i++) {
        var last = i === n - 1;
        var row = BORN_ROWS[((cls % N) + N) % N] || BORN_ROWS[0];
        var pool = [];
        for (var c = 0; c < N; c++) pool.push([c, (row[c] || 1) * (last && c === 0 ? 3 : 1)]);   // descents end on the tonic
        var next = R.pickW(pool);
        var up = R.next() < 0.5, dirDraw = R.next();
        // tendency rules
        if (cls === 1 && next === 0) up = false;                                   // the second falls
        else if (cls === 3 && next === 0) up = dirDraw < 0.6;                      // the fifth leaps to the octave
        else if (cls === 4 && next === 3) up = false;                              // the sixth sinks
        var cur = ((deg % N) + N) % N, delta = ((next - cur) % N + N) % N;         // steps up to reach `next`
        deg = up ? deg + delta : deg - (N - delta) % N;
        if (delta === 0) deg += up ? N : -N;                                       // same class → the octave
        deg = foldDeg(deg);
        cls = next;
        var dur = R.pickW(BORN_DURS) * (last ? 1.6 : 1);
        notes.push({ deg: deg, durBeats: dur, meri: !!(last && cls === 0) });
      }
      var nm = R.pick(SYL_A) + R.pick(SYL_B);
      if (bornNames[nm]) nm = nm + "·" + (++bornSerial);
      bornNames[nm] = 1;
      return { name: "born: " + nm, degs: null, notes: notes };
    }
    var working = { theme: null, subs: [] };       // the whole cycle works ≤3 ideas
    var ledger = [];                               // [{from, to, motif, type, deadline}]
    var lineage = {};                              // most-developed living descendant per name
    var ghost = null;                              // decomposed memory carried across the KIRU
    var reprised = false;                          // the one verbatim kyū statement, per cycle
    var plainCounts = {};                          // plain statements per motif per cycle (≤3 — learn it, then work it)
    var stats = { developments: 0, answers: 0, transformsUsed: {} };

    function clone(m) { return JSON.parse(JSON.stringify(m)); }
    function fromSeed(i, name) {
      var s = SEED_PHRASES[i], notes = [];
      for (var k = 0; k < s.degs.length; k++) notes.push({ deg: scaleIndexOf(s.degs[k]), durBeats: s.durs[k] });
      return { name: name, gen: 0, chain: [], notes: notes, src: s.name };   // src: the gesture this line descends from
    }

    // ---- the transform algebra (each mutates a clone; chain appended by develop) ----
    var TRANSFORMS = {
      invert: function (m) {                       // mirror on the first degree
        var axis = m.notes[0].deg;
        m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        return m;
      },
      transpose: function (m) {                    // ±1–3 scale DEGREES — real pitch-content change, not octaves
        var by = S.motif.pickW([[1, 3], [2, 3], [-1, 3], [-2, 3], [3, 1], [-3, 1]]);
        m.notes.forEach(function (n) { n.deg += by; });
        return m;
      },
      fragmentHead: function (m) { m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      fragmentTail: function (m) { m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2))); return m; },
      augment: function (m) {
        var f = S.motif.rnd(1.35, 1.9);
        m.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * f); });
        return m;
      },
      diminish: function (m) {
        var f = S.motif.rnd(0.5, 0.72);
        m.notes.forEach(function (n) { n.durBeats = Math.max(0.3, n.durBeats * f); });
        return m;
      },
      retrograde: function (m) { m.notes.reverse(); return m; },
      sequence: function (m) {                     // restate at a transposition — real sequencing
        var step = S.motif.pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = m.notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
        m.notes = m.notes.concat(rep).slice(0, 12);            // runaway guard
        return m;
      },
      ornament: function (m) {                     // neighbor-tone turns — koto kazashi / shakuhachi ornaments
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && S.motif.chance(0.6)) {
            res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
            res.push({ deg: n.deg + (nx.deg > n.deg ? 1 : -1), durBeats: Math.max(0.35, n.durBeats * 0.35) });
          } else res.push({ deg: n.deg, durBeats: n.durBeats });
        }
        m.notes = res;
        return m;
      },
    };

    // ---- chain grammar: which transform, given VOICE + jo-ha-kyū phase ----
    // Sophistication = context-sensitivity: the same motif is worked
    // differently by each instrument, and differently in jo than in kyū.
    var VOICE_WEIGHTS = {
      // the shakuhachi works contour: ornament, augmentation, mirrors
      shakuhachi: { ornament: 3.5, augment: 3, invert: 2.5, transpose: 2.5, fragmentTail: 1.5, fragmentHead: 1.5, retrograde: 1.5, sequence: 1, diminish: 1 },
      // the koto sequences and fragments — danmono figuration
      koto: { sequence: 3.5, fragmentHead: 2.5, fragmentTail: 2.5, transpose: 2.5, invert: 2, ornament: 2, diminish: 1.5, augment: 1.5, retrograde: 1.5 },
      // the shamisen diminishes and splinters — fast Tsugaru fragmentation
      shamisen: { diminish: 3.5, fragmentHead: 3, fragmentTail: 2.5, sequence: 2.5, transpose: 2, retrograde: 1.5, invert: 1.5, ornament: 1, augment: 0.5 },
      // the hichiriki stretches and mirrors (the reed holds a line); the biwa splinters and reverses (the narrator's fragments)
      hichiriki: { augment: 3.5, invert: 2.5, transpose: 2.5, fragmentHead: 2, fragmentTail: 1.5, retrograde: 1, ornament: 0.5, sequence: 0.5, diminish: 0.3 },
      biwa: { fragmentHead: 3, fragmentTail: 3, retrograde: 2, augment: 2, transpose: 2, invert: 1.5, diminish: 1, sequence: 0.5, ornament: 0.3 },
    };
    var PHASE_TILT = {
      jo:      { augment: 1.7, transpose: 1.4, ornament: 0.6, sequence: 0.4, fragmentHead: 0.5, fragmentTail: 0.5, diminish: 0.4 },   // state plainly, stretch
      ha:      { invert: 1.4, sequence: 1.3, ornament: 1.4, transpose: 1.1 },                                                          // explore widely
      "kyū":   { diminish: 1.8, fragmentHead: 1.5, fragmentTail: 1.4, sequence: 1.6, retrograde: 1.2, augment: 0.4 },                  // drive — stretto
      release: { augment: 1.6, fragmentTail: 1.4, ornament: 0.4, sequence: 0.3, diminish: 0.4 },                                       // the ma decomposes
    };
    var AFFINITY = {                               // pairs that compose well lean into each other
      fragmentHead: { sequence: 2.4, ornament: 1.6 },
      fragmentTail: { sequence: 2.4, ornament: 1.6 },
      invert:       { augment: 1.7, transpose: 1.5 },
      sequence:     { diminish: 1.6 },
      ornament:     { augment: 1.4 },
    };
    function beatsOf(m) { var b = 0; m.notes.forEach(function (n) { b += n.durBeats; }); return b; }
    function isPalindromic(m) {
      var s = m.notes.map(function (n) { return n.deg; });
      for (var i = 0; i < s.length; i++) if (s[i] !== s[s.length - 1 - i]) return false;
      return true;
    }
    function lastRealLink(chain) {
      for (var i = chain.length - 1; i >= 0; i--)
        if (chain[i] !== "tether" && chain[i] !== "dissolve" && chain[i] !== "ghost") return chain[i];
      return null;
    }
    function allowedTransform(name, m, chain) {
      var len = m.notes.length;
      if (name === lastRealLink(chain)) return false;              // never twice running (invert∘invert is a no-op)
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;                                // fragmenting a fragment leaves 2 notes of nothing
        var frags = 0;
        for (var i = 0; i < chain.length; i++) if (chain[i].indexOf("fragment") === 0) frags++;
        if (frags >= 1 && len <= 6) return false;
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false; // no-op on palindromes (the sakura sigh!)
      if (name === "augment" && beatsOf(m) > 18) return false;
      if (name === "diminish" && beatsOf(m) < 2.5) return false;
      return true;
    }
    function pickTransform(voice, m, chain, t) {
      var w = VOICE_WEIGHTS[voice] || VOICE_WEIGHTS.koto;
      var tilt = PHASE_TILT[arcPhase(t)] || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1);
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        pool.push([name, wt]);
      }
      return pool.length ? S.motif.pickW(pool) : null;
    }
    // Keep the motif's centre of mass in the singable mid-band by whole
    // octaves — internal intervals untouched; voices re-register per phrase.
    function recentre(m) {
      if (!m.notes.length) return m;
      var sum = 0; m.notes.forEach(function (n) { sum += n.deg; });
      var mean = sum / m.notes.length;
      while (mean > 13) { m.notes.forEach(function (n) { n.deg -= 5; }); mean -= 5; }
      while (mean < 5) { m.notes.forEach(function (n) { n.deg += 5; }); mean += 5; }
      return m;
    }

    // ---- genealogy: lineage, tether, development ----
    function ancestorOf(name) {
      if (working.theme && working.theme.name === name) return working.theme;
      for (var i = 0; i < working.subs.length; i++) if (working.subs[i] && working.subs[i].name === name) return working.subs[i];
      return working.theme;
    }
    function remember(m) {
      var cur = lineage[m.name];
      if (!cur || m.gen >= cur.gen) lineage[m.name] = clone(m);
    }
    // Identity tether: every 3rd generation, graft the ancestor's opening back
    // onto the descendant — development may wander; the head-motive returns.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc) return m;
      var src = clone(anc).notes;
      var shift = Math.round((m.notes[0].deg - src[0].deg) / 5) * 5;   // meet the descendant's register
      for (var i = 0; i < src.length; i++) src[i].deg += shift;
      var k = Math.min(3, src.length, Math.max(1, m.notes.length - 1));
      m.notes = src.slice(0, k).concat(m.notes.slice(k));
      m.chain = m.chain.concat(["tether"]);
      stats.transformsUsed.tether = (stats.transformsUsed.tether || 0) + 1;
      return m;
    }
    function develop(voice, m, maxChain, t) {
      // Renewal: after long development the line returns to its source —
      // identity over archaeology (ledger ping-pong otherwise compounds
      // generations into the twenties).
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = anc; }
      var out = clone(m);
      var links = S.motif.rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voice, out, out.chain.concat(used), t);
        if (!name) break;
        out = TRANSFORMS[name](out);
        used.push(name);
        stats.transformsUsed[name] = (stats.transformsUsed[name] || 0) + 1;
      }
      if (!used.length) {                          // grammar cornered — a transposition always speaks
        out = TRANSFORMS.transpose(out);
        used.push("transpose");
        stats.transformsUsed.transpose = (stats.transformsUsed.transpose || 0) + 1;
      }
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(used);
      if (out.gen >= 3 && out.gen % 3 === 0) out = tether(out);
      recentre(out);
      stats.developments++;
      remember(out);
      emitEvent({ cat: voice, label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") + " · " + arcPhase(t) }, t);
      return out;
    }
    // The ma decomposing a motif: notes released, time stretched.
    function decompose(m, voice, t) {
      var out = clone(m);
      var keep = Math.max(2, Math.round(out.notes.length * S.motif.rnd(0.4, 0.7)));
      while (out.notes.length > keep) out.notes.splice(S.motif.rint(1, out.notes.length - 1), 1);
      out.notes.forEach(function (n) { n.durBeats = Math.min(6, n.durBeats * S.motif.rnd(1.4, 2)); });
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: voice, label: "散 " + out.name + " decomposes", detail: "releasing notes into the ma" }, t);
      return out;
    }
    function makeGhost(m) {
      var g = clone(m);
      var keep = Math.max(2, Math.round(g.notes.length * 0.5));
      while (g.notes.length > keep) g.notes.splice(S.motif.rint(1, g.notes.length - 1), 1);
      g.notes.forEach(function (n) { n.durBeats = Math.min(8, n.durBeats * S.motif.rnd(2, 3)); });
      g.chain = g.chain.concat(["ghost"]);
      return g;
    }

    // ---- what should a voice play right now? ----
    function request(voice, t) {
      if (!working.theme) return null;
      var phase = arcPhase(t);
      // After the KIRU hush, the new jo opens with a decomposed ghost of the
      // previous cycle's deepest development — the journey across the cut.
      if (ghost && phase === "jo") {
        var g = ghost; ghost = null;
        emitEvent({ cat: voice, label: "残 ghost of " + g.name + "·g" + g.gen, detail: "the last cycle, decomposed — notes dropped, time stretched" }, t);
        return g;
      }
      // ONE guaranteed verbatim theme statement, late in the kyū — the last
      // word before the cut. The shakuhachi speaks it.
      if (voice === "shakuhachi" && !reprised && repriseWindow(t)) {
        reprised = true;
        emitEvent({ cat: "shakuhachi", label: "✸ reprise " + working.theme.name, detail: "the theme verbatim — the last word before the cut" }, t);
        return clone(working.theme);
      }
      var m;
      if (phase === "jo") m = S.motif.chance(0.7) ? working.theme : S.motif.pick(working.subs);
      else if (phase === "ha") m = S.motif.pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]);
      else m = S.motif.chance(0.6) ? working.theme : S.motif.pick(working.subs);   // kyū/release: the theme drives
      if (!m) m = working.theme;
      // Work what the cycle has BUILT: continue from the most-developed living
      // descendant about half the time in ha/kyū (the tether keeps it honest).
      if (phase === "ha" || phase === "kyū") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && S.motif.chance(0.45)) m = line;
      }
      // jo states plainly first — an idea must be LEARNED before it is worked,
      // but only a few times: after that, even the jo varies it
      if (phase === "jo" && m.gen === 0 && (plainCounts[m.name] || 0) < 3 && S.motif.chance(0.5)) {
        plainCounts[m.name] = (plainCounts[m.name] || 0) + 1;
        emitEvent({ cat: voice, label: "○ " + m.name + " stated plain", detail: m.notes.length + " notes · jo" }, t);
        return clone(m);
      }
      if (phase === "release") return decompose(m, voice, t);       // the ma after the cut
      return develop(voice, m, phase === "kyū" ? 3 : 2, t);
    }

    // ---- dialogue ledger: real obligations between voices, with deadlines ----
    var POST_P = { shakuhachi: 0.45, koto: 0.4, shamisen: 0.35, hichiriki: 0.3, biwa: 0.25 };   // ≈ the old per-voice answer densities
    var POST_TO = {
      shakuhachi: [["koto", 3], ["shamisen", 2], ["hichiriki", 1]],
      koto: [["shakuhachi", 3], ["shamisen", 2], ["biwa", 1]],
      shamisen: [["koto", 3], ["shakuhachi", 2]],
      hichiriki: [["shakuhachi", 3], ["koto", 1]],
      biwa: [["koto", 2], ["shakuhachi", 1]],
    };
    function post(fromVoice, toVoice, motif, type, t) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: t + S.motif.rnd(6, 16) });
      if (ledger.length > 6) ledger.shift();
    }
    function postFrom(voice, motif, t) {
      if (!working.theme || !S.motif.chance((POST_P[voice] || 0.4) * dialogue.postMul)) return;
      post(voice, S.motif.pickW(POST_TO[voice]), motif, S.motif.pickW(dialogue.types), t);
    }
    // The dialogue's manners, set by the scene: a kakeai duet posts more and
    // imitates; the default is the ledger's old balance.
    var DIALOGUE_DEFAULT = { postMul: 1, types: [["imitate", 3], ["invert", 2], ["develop", 2]] };
    var dialogue = DIALOGUE_DEFAULT;
    function setDialogue(d) { dialogue = d || DIALOGUE_DEFAULT; }
    function claim(voice, t) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      if (!ob) {
        // Call-and-response must be AUDIBLE: an obligation past its deadline
        // is taken up by whichever voice speaks next (never the caller itself).
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && t > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) { var anc = ancestorOf(m.name); if (anc) m = clone(anc); }   // renewal applies to answers too
      var ans;
      if (ob.type === "imitate") ans = develop(voice, m, 1, t);
      else if (ob.type === "invert") {
        // mirror the call — unless the call was itself a mirror (invert∘invert
        // is a no-op): then answer with the crab, or a transposition.
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(voice, m, 2, t);
      stats.answers++;
      emitEvent({ cat: voice, label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen }, t);
      return ans;
    }
    function overdueFor(voice, t) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && t > ledger[i].deadline) return true;
      }
      return false;
    }

    // ---- cycle boundaries (called at each mode change) ----
    function newCycle(t) {
      // carry a decomposed memory of the deepest development across the cut
      ghost = null;
      var deepest = null, second = null, k;
      for (k in lineage) if (lineage[k] && (!deepest || lineage[k].gen > deepest.gen)) deepest = lineage[k];
      for (k in lineage) if (lineage[k] && lineage[k] !== deepest && (!second || lineage[k].gen > second.gen)) second = lineage[k];
      if (deepest && deepest.gen > 0) ghost = makeGhost(deepest);
      // THE WORKING SET (Phase 2): イ one authentic gesture (the theme — learnable,
      // reprised verbatim), ロ one INHERITED descendant (last cycle's second-deepest
      // living line, or its deepest, carried with its generation and chain — the
      // work continues), ハ one NEWBORN from the improviser. Cycle 0, with nothing
      // to inherit, draws two authentics.
      var order = [], i; for (i = 0; i < SEED_PHRASES.length; i++) order.push(i);
      var picks = [];
      while (picks.length < 2) picks.push(order.splice(Math.floor(S.motif.next() * order.length), 1)[0]);
      working.theme = fromSeed(picks[0], NAMES[0]);
      var inherit = second || deepest, names = [SEED_PHRASES[picks[0]].name];
      var sub1;
      if (inherit && inherit.gen > 0) {
        sub1 = clone(inherit); sub1.name = NAMES[1]; sub1.chain = inherit.chain.concat(["inherit"]);
        sub1.gen = Math.min(inherit.gen, 3);            // room to develop: at its old g8–9 the line renewed to itself and froze
        names.push("inherited: " + (inherit.src || inherit.name) + "·g" + inherit.gen);
      } else { sub1 = fromSeed(picks[1], NAMES[1]); names.push(SEED_PHRASES[picks[1]].name); }
      var born = birth(), bornMotif = { name: NAMES[2], gen: 0, chain: [], notes: born.notes, src: born.name };
      names.push(born.name);
      working.subs = [sub1, bornMotif];
      // the authentic subsidiary may enter pre-transposed — pitch variety, not novelty churn
      if (S.motif.chance(0.5) && !(inherit && inherit.gen > 0)) { TRANSFORMS.transpose(sub1); sub1.chain = ["transpose"]; recentre(sub1); }
      recentre(bornMotif);
      ledger.length = 0;
      lineage = {};
      reprised = false;
      plainCounts = {};
      emitEvent({
        cat: "mode", label: "❁ working set",
        detail: NAMES[0] + " " + names[0] + " · " + NAMES[1] + " " + names[1] + " · " + NAMES[2] + " " + names[2],
      }, t);
    }
    function reset() {
      working.theme = null; working.subs = [];
      ledger.length = 0; lineage = {}; ghost = null; reprised = false; plainCounts = {};
    }

    // The guaranteed kyū reprise outranks even ledger obligations — the voice
    // asks this first so the theme's last word can never be talked over.
    function wantsReprise(t) {
      return !!working.theme && !reprised && repriseWindow(t);
    }

    return {
      reset: reset, newCycle: newCycle, wantsReprise: wantsReprise, setDialogue: setDialogue,
      request: request, claim: claim, overdueFor: overdueFor, postFrom: postFrom,
      theme: function () { return working.theme || null; },   // 逸脱 崩: what the locked groove locks onto
      stats: function () {
        return {
          developments: stats.developments, answers: stats.answers,
          transforms: Object.keys(stats.transformsUsed),
          working: { theme: working.theme && working.theme.name, themeGen: working.theme && working.theme.gen },
        };
      },
    };
  })();

  // A biased hirajoshi walk. state = { idx, dir, center }; returns phrase of
  // { deg, durBeats }. window widens / steps loosen with arc.
  function walk(R, state, len, windowR, arc) {  // R: the walking voice's own stream
    var notes = [];
    if (R.next() < 0.4) state.dir = -state.dir;
    for (var i = 0; i < len; i++) {
      var step = R.next() < (0.62 - arc * 0.18) ? 1 : R.next() < 0.8 ? 2 : 3;
      state.idx += state.dir * step;
      if (state.idx < state.center - windowR) { state.idx = state.center - windowR; state.dir = 1; }
      if (state.idx > state.center + windowR) { state.idx = state.center + windowR; state.dir = -1; }
      if (state.idx < 0) state.idx = 0; else if (state.idx >= SCALE.length) state.idx = SCALE.length - 1;
      if (R.next() < 0.34) state.idx = pullTo(state.idx, IMPORTANT_DEG);
      notes.push({ deg: state.idx, durBeats: 0.6 + R.next() * 0.9 });
    }
    state.idx = pullTo(state.idx, REST_DEG);
    notes.push({ deg: state.idx, durBeats: 1.4 + R.next() * 1.2 });
    return farTruncate(notes);                   // 逸脱 間
  }
  function pullTo(idx, flags) {
    for (var r = 0; r <= 2; r++) {
      if (SCALE[idx + r] && flags[SCALE[idx + r].deg]) return idx + r;
      if (SCALE[idx - r] && flags[SCALE[idx - r].deg]) return idx - r;
    }
    return idx;
  }

  // ==========================================================================
  // SUB-DRONE — deep distorted ground (the derelict's hull resonance)
  // ==========================================================================
  function subDroneCycle(t) {
    if (!playing) return;
    var c = ctx, now = t, out = lg("subDrone");
    var cutoff = getLayerParam("subDrone", "cutoff", 220);
    var movement = getLayerParam("subDrone", "movement", 0.18);
    var subAmt = getLayerParam("subDrone", "sub", 0.6);
    var tmul = farTimeMul("subDrone", t);        // 逸脱 遅/弛: the floor breathes with the night
    var dur = (26 + S.subDrone.next() * 10) * tmul, fadeIn = 7 * tmul, fadeOut = 8 * tmul;

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.8, now);
    var mlfo = c.createOscillator(), mg = c.createGain();
    mlfo.type = "sine"; mlfo.frequency.setValueAtTime(0.02 + S.subDrone.next() * 0.03, now);
    mg.gain.setValueAtTime(cutoff * movement, now); mlfo.connect(mg); mg.connect(lp.frequency);
    mlfo.start(now); mlfo.stop(now + dur + 0.3);
    var bus = c.createGain();
    PJ.Voice.env(bus.gain, now, [[fadeIn, 1], [dur - fadeIn - fadeOut, 1], [fadeOut, 0]]);
    lp.connect(bus); bus.connect(out);

    // tonic + fifth, detuned sawtooth pairs (grit comes from the distortion bus)
    var roots = [subRoot(), subFifth()];
    for (var k = 0; k < roots.length; k++) {
      [-7, 7].forEach(function (det) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = "sawtooth"; FAR.glidePartial(o.frequency, roots[k], now, dur + 0.3); o.detune.setValueAtTime(det, now);   // 逸脱 螺/弛: the floor follows the glide (subRoot/subFifth are already in the night's octave)
        o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.05, now);
        o.start(now); o.stop(now + dur + 0.3);
      });
    }
    if (subAmt > 0.01) {
      var so = c.createOscillator(), sg = c.createGain();
      so.type = "sine"; FAR.glidePartial(so.frequency, subRoot() / 2, now, dur + 0.3);   // a true octave below its own root: the body's spectrum, not the field's
      so.connect(sg); sg.connect(lp); sg.gain.setValueAtTime(0.08 * subAmt, now);
      so.start(now); so.stop(now + dur + 0.3);
    }
    var overlap = (7 + S.subDrone.next() * 3) * tmul;
    afterSpan("subDrone", now, dur - overlap, subDroneCycle);   // dur is already dilated
  }

  // ==========================================================================
  // SHŌ 笙 — gagaku mouth-organ cluster drone (shimmering tone-clusters)
  // ==========================================================================
  // THE ELEVEN AITAKE (合竹) as interval shapes — semitones above the lowest
  // sounding pipe, after the documented chart (the shō's fixed chords: each
  // a stack of 4ths/5ths with a 2nd rubbing inside and an octave on top).
  // The shapes are approximations of the traditional voicings; the station
  // PROJECTS each onto the current field (every offset to its nearest scale
  // tone), so in a five-note mode two pipes may fold onto one pitch and the
  // cluster reads as 4–6 voices. Color, never harmony.
  var AITAKE = [
    { kana: "乙", name: "otsu",  semis: [0, 2, 7, 9, 12, 14] },
    { kana: "一", name: "ichi",  semis: [0, 5, 7, 12, 14, 19] },
    { kana: "工", name: "kō",    semis: [0, 2, 5, 7, 12, 14] },
    { kana: "凢", name: "bō",    semis: [0, 3, 5, 10, 12, 15] },
    { kana: "乞", name: "kotsu", semis: [0, 2, 4, 9, 11, 14] },
    { kana: "十", name: "jū",    semis: [0, 5, 7, 9, 12, 17] },
    { kana: "下", name: "ge",    semis: [0, 2, 7, 9, 14, 16] },
    { kana: "美", name: "bi",    semis: [0, 3, 7, 10, 12, 15] },
    { kana: "行", name: "gyō",   semis: [0, 2, 5, 7, 9, 14] },
    { kana: "比", name: "hi",    semis: [0, 5, 7, 12, 14, 17] },
    { kana: "言", name: "gon",   semis: [0, 2, 7, 12, 14, 19] },
  ];
  var lastAitake = null;                         // the cluster still sounding (te-utsuri reads it)
  // 逸脱 双: the shō straddles both fields — its odd pipes answer to "sho2",
  // which bitonality's camp may hold on its own. At home, and on any night
  // without 双, both names are the same voice and nothing changes.
  function shoVoice(v) { return (v & 1) ? "sho2" : "sho"; }
  function projectAitake(a, baseHz, maxVoices) {
    var out = [], seen = {};
    for (var i = 0; i < a.semis.length && out.length < maxVoices; i++) {
      // 逸脱 撓: baseHz arrives already warped (it is a SCALE tone), so the
      // snap happens in field space and the result comes back out warped.
      var f = farWarp(field.snap(farUnwarp(baseHz) * Math.pow(2, a.semis[i] / 12))), key = f.toFixed(3);
      if (!seen[key]) { seen[key] = 1; out.push(f); }
    }
    out.sort(function (x, y) { return x - y; });
    return out;
  }
  function sharedFreqs(a, b) {
    if (!a || !b) return 0;
    var n = 0;
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) if (Math.abs(1200 * Math.log(a[i] / b[j]) / Math.LN2) < 15) { n++; break; }
    return n;
  }
  // Draw the next aitake: the base pipe sits high (~A4–B4, degree 6–7 of the
  // field's mid octave); candidates are weighted by tones shared with the
  // cluster still sounding (te-utsuri: the player moves one pipe at a time).
  function chooseAitake(R, maxVoices) {
    var base = SCALE[scaleIndexOf(6 + R.rint(0, 1))].freq;
    var pool = [];
    for (var i = 0; i < AITAKE.length; i++) {
      var fr = projectAitake(AITAKE[i], base, maxVoices), sh = sharedFreqs(fr, lastAitake);
      pool.push([{ a: AITAKE[i], freqs: fr, shared: sh }, 1 + (lastAitake ? sh * 1.5 : 0)]);
    }
    var pick = R.pickW(pool);
    return { kana: pick.a.kana, name: pick.a.name, freqs: pick.freqs, shared: pick.shared };
  }
  // Sustained 5–6 note clusters (aitake) built from in-scale degrees, breathing
  // slowly, with a high digital shimmer. The shimmering harmonic bed.
  function shoCycle(t) {
    if (!playing) return;
    if (!seated("sho", t)) { afterRaw("sho", t, 12, shoCycle); return; }   // rested this cycle — ask again later
    var c = ctx, now = t, out = lg("sho");
    var cutoff = getLayerParam("sho", "cutoff", 1400) * (0.8 + 0.4 * wxAt(t).brightness);   // the weather breathes the shō's cutoff
    var voices = Math.round(getLayerParam("sho", "voices", 5));
    var shimmer = getLayerParam("sho", "shimmer", 0.4);
    var drift = getLayerParam("sho", "drift", 0.5);
    var stmul = farTimeMul("sho", t);            // 逸脱 遅/弛
    var dur = (14 + S.sho.next() * 8) * (cyc.kind === "rite" ? 1.4 : 1) * stmul, fadeIn = 5 * stmul, fadeOut = 6 * stmul;   // the rite's clusters breathe longer

    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(cutoff, now); lp.Q.setValueAtTime(0.5, now);
    var bus = c.createGain();
    PJ.Voice.env(bus.gain, now, [[fadeIn, 0.5], [dur - fadeIn - fadeOut, 0.5], [fadeOut, 0]]);
    // 金: the whole cluster through one ring modulator at the drone's root —
    // the seam is here, at lp → bus, so a cluster of five or six pipes costs
    // ONE extra source between them rather than one each.
    if (!(farMetal && farMetal.targets.indexOf("sho") >= 0 && farMetalRing(lp, bus, now, dur))) lp.connect(bus);
    bus.connect(out);

    // THE AITAKE (Phase 2): one of the eleven named voicings, projected onto
    // the current mode; TE-UTSURI — the next cluster is drawn to share tones
    // with the one still sounding, and its voices enter one at a time.
    var ait = chooseAitake(S.sho, voices);
    var freqs = ait.freqs, shared = ait.shared, shoSounding = [];
    emitEvent({ cat: "sho", label: "笙 " + ait.kana + " " + ait.name, detail: "aitake · " + freqs.length + " voices · base " + noteName(freqs[0]) + (shared ? " · te-utsuri " + shared + " shared" : "") }, now);
    for (var v = 0; v < freqs.length; v++) {
      var f = freqs[v];
      var vIn = now + v * S.sho.rnd(0.4, 1.1);           // te-utsuri: the voices enter one at a time
      var o = c.createOscillator(), g = c.createGain();
      // 逸脱: mapped ONCE, unglided (the pipe may have crossed to 双's second
      // field); the pipe and its partials then all ride that one base.
      var fBase = FAR.mapped(shoVoice(v), f);
      // 双 straddles the cluster across two fields AFTER projectAitake has
      // deduplicated it, so two pipes can land on the same pitch — and a
      // doubled pipe is +6 dB, which is how seed 34's master peak rose 1.5 dB
      // through the corridor (critic W1 r1, item 15). The same 20-cent rule
      // projectAitake applies before the crossing, applied again after it.
      if (farBito) {
        var dup = false;
        for (var q = 0; q < shoSounding.length; q++) if (Math.abs(1200 * Math.log(fBase / shoSounding[q]) / Math.LN2) < 20) { dup = true; break; }
        if (dup) continue;
        shoSounding.push(fBase);
      }
      o.type = "sawtooth"; var fSound = FAR.glidePartial(o.frequency, fBase, now, dur + 0.2);
      o.detune.setValueAtTime((S.sho.next() * 2 - 1) * 6 * drift, now);
      var dl = c.createOscillator(), dlg = c.createGain();
      dl.type = "sine"; dl.frequency.setValueAtTime(0.05 + S.sho.next() * 0.08, now);
      dlg.gain.setValueAtTime(5 * drift, now); dl.connect(dlg); dlg.connect(o.detune);
      dl.start(now); dl.stop(now + dur + 0.2);
      o.connect(g); g.connect(lp); PJ.Voice.env(g.gain, vIn, [[2.5, 0.045], [Math.max(0.1, now + dur - vIn - 2.5), 0.045]]);
      o.start(vIn); o.stop(now + dur + 0.2);
      // nasal free-reed character: square reed sub + 5th/7th partials
      [[1, "square", 0.018], [5, "sine", 0.014], [7, "sine", 0.008]].forEach(function (pr) {
        var po = c.createOscillator(), pg = c.createGain();
        po.type = pr[1]; FAR.glidePartial(po.frequency, fBase * pr[0], vIn, now + dur + 0.2 - vIn);
        po.connect(pg); pg.connect(lp); PJ.Voice.env(pg.gain, vIn, [[2.5, pr[2]], [Math.max(0.1, now + dur - vIn - 2.5), pr[2]]]);
        po.start(vIn); po.stop(now + dur + 0.2);
      });
      if (shimmer > 0.01) {
        var ho = c.createOscillator(), hg = c.createGain();
        ho.type = "triangle"; FAR.glidePartial(ho.frequency, fBase * 4, vIn, now + dur + 0.2 - vIn);
        ho.connect(hg); hg.connect(bus); PJ.Voice.env(hg.gain, vIn, [[2.5, 0.009 * shimmer], [Math.max(0.1, now + dur - vIn - 2.5), 0.009 * shimmer]]);
        ho.start(vIn); ho.stop(now + dur + 0.2);
      }
      emitNote("sho", fSound, now);                      // one shared t per cluster, so voicings group — and the pitch the pipe actually sounds
    }
    lastAitake = freqs;
    var overlap = (4 + S.sho.next() * 2) * stmul;
    afterSpan("sho", now, dur - overlap, shoCycle);              // dur is already dilated
  }

  // ==========================================================================
  // SHAKUHACHI 尺八 — breathy bamboo flute lead (the voice)
  // ==========================================================================
  // The primary melodic line: long, spacious phrases full of MA (silence),
  // breath, meri-kari pitch bends, and occasional MURAIKI (explosive breath
  // noise — the gritty cry). Motif memory + answers other voices.
  var shakuState = { idx: 10, dir: 1, center: 10 };
  function startShakuhachi(t) {
    if (!playing) return;
    shakuState.center = scaleIndexOf(5);         // mid-high register, above the drones
    shakuState.idx = shakuState.center; shakuState.dir = 1;
    shakuhachiPhrase(t);
  }
  function shakuhachiPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("shakuhachi", now)) { afterRaw("shakuhachi", now, S.shakuhachi.rnd(5, 9), shakuhachiPhrase); return; }
    // THE AIR: claim before speaking (phrase + a margin of silence after);
    // denied → let the moment pass and ask again shortly.
    var margin = airMargin(S.shakuhachi, now);
    var tok = airClaimAt(now, "shakuhachi", shakuState.lastSpan || 3.5, margin);
    if (!tok) { afterRaw("shakuhachi", now, S.shakuhachi.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), shakuhachiPhrase); return; }
    var breathSolo = scn.type === "solo" && scn.activity === "breath";   // the muraiki solo breath
    var pace = getLayerParam("shakuhachi", "pace", 1.0) * (1 + arc * 0.6) * (breathSolo ? 0.7 : 1);
    var glideAmt = getLayerParam("shakuhachi", "glide", 0.6);
    var ornament = getLayerParam("shakuhachi", "ornament", 0.5);
    var muraiki = getLayerParam("shakuhachi", "muraiki", 0.4);
    var breath = getLayerParam("shakuhachi", "breath", 0.55);

    shakuState.center = Math.round(scaleIndexOf(5) + arc * 4);

    // motif work — ledger obligations first, then the working set; free walks
    // remain as the improvisatory glue between statements
    var phrase, motif = null;
    if (Motif.wantsReprise(now)) motif = Motif.request("shakuhachi", now);
    if (!motif && Motif.overdueFor("shakuhachi", now)) motif = Motif.claim("shakuhachi", now);
    if (!motif && S.shakuhachi.chance(0.6)) motif = Motif.request("shakuhachi", now);
    if (motif) {
      phrase = fitToRegister(motif.notes, shakuState.center);
      Motif.postFrom("shakuhachi", motif, now);
    } else {
      phrase = walk(S.shakuhachi, shakuState, 2 + Math.floor(S.shakuhachi.next() * 3) + Math.floor(arc * 2), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shakuhachi", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    if (breathSolo && phrase.length > 2) phrase = phrase.slice(0, 2);        // one or two long breaths
    if (phrase.length) shakuState.idx = phrase[phrase.length - 1].deg;   // melodic continuity for the next walk

    var ownBeat = 0.62 / pace * farTimeMul("shakuhachi", now);
    var cn = farCanonTake("shakuhachi", phrase, now, shakuState.center, ownBeat);   // 重 継: the winds join the ensemble departures (影 is the plucked trio's)
    phrase = cn.phrase;
    var beat = ownBeat * cn.cs, t = cn.t0, prev = null, sched = [];   // 逸脱 遅/弛
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.25 * cn.cs, n.durBeats * beat);
      if (cn.kind === "hocket" && (i % cn.of) !== cn.slot) { t += dur; continue; }   // 継
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq * cn.sharp;   // 重
      var glideFrom = (prev && S.shakuhachi.next() < glideAmt) ? prev : null;
      var mur = (i === 0 && S.shakuhachi.next() < muraiki * (0.4 + arc * 0.6) * (breathSolo ? 3 : 1) * (0.6 + 0.8 * wxAt(t).breath));
      shakuhachiNote(f, t, dur, { glideFrom: glideFrom, breath: breath, muraiki: mur ? muraiki : 0, bend: S.shakuhachi.next() < ornament || !!n.meri, atari: prev === f });   // a born descent ends in a meri dip; a repeated pitch is an atari
      sched.push({ f: f, t: t, dur: dur });
      prev = f;
      t += dur + S.shakuhachi.next() * 0.05;
    }
    farMirrorAnswer("shakuhachi", phrase, sched, now, beat);   // 鏡
    // 凍: now and then the last breath does not end — it is held into a drone
    // and the ensemble re-tunes around it. Decided per phrase on the far
    // stream's own fork, so it costs the shakuhachi's stream nothing.
    if (farNight && farNight.dep.freeze && sched.length && !signalUp(t) &&
        S.far.fork("freeze-when:" + Math.round(now)).chance(0.22)) {
      var held = farFreeze(sched[sched.length - 1].f, t + 0.1);
      if (held > 0) {
        t += 0.1 + held;
        tok.until = t + margin;
        shakuState.lastSpan = t - now;
        afterSpan("shakuhachi", now, (t - now) + S.shakuhachi.rnd(2, 6) * farTimeMul("shakuhachi", now), shakuhachiPhrase);
        return;
      }
    }
    shakuState.lastSpan = t - now;
    tok.until = t + margin;                      // the claim's true footprint: the phrase as rendered + the margin
    // 〰 SANKYOKU HETEROPHONY — in the ha especially, the koto sometimes reads
    // the same phrase a breath behind (jiuta ensemble texture): the same note
    // list, its own ornament choices, a hair sharp. The shadow is a GRANTED
    // overlap: it asks the air (a second holder needs the scene's limit or
    // the overlap dice) and the koto must be seated.
    if (!farMirror && sched.length >= 3 && S.shakuhachi.chance(arcPhase(now) === "ha" ? 0.22 : 0.08) && seated("koto", now) && airClaimAt(now, "koto", t - now, 0)) {
      var lag = S.shakuhachi.rnd(0.15, 0.4), sharp = Math.pow(2, S.shakuhachi.rnd(2, 3.5) / 1200), sprev = null;
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        kotoNote(sn.f * sharp, sn.t + lag + S.shakuhachi.rnd(0, 0.05), Math.max(0.12, sn.dur * 0.8),
          { gain: 0.65, glideFrom: (sprev && S.shakuhachi.chance(0.3)) ? sprev * sharp : null, bend: S.shakuhachi.chance(0.2) });
        sprev = sn.f;
      }
      emitEvent({ cat: "koto", label: "〰 koto shadows shakuhachi", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" }, now);
    }
    // MA — breathing space between phrases (more in jo, less in kyū; the meta
    // journey tilts overall density ±12% — the shakuhachi stays UNLOCKED from
    // the pulse but still breathes with the long form)
    var ma = (1.8 + S.shakuhachi.next() * 4) * (1 - arc * 0.55) * metaRestMul() * gapMulAt(t) / trimOf("shakuhachi");
    afterSpan("shakuhachi", now, (t - now) + ma * farTimeMul("shakuhachi", now), shakuhachiPhrase);   // 逸脱: the phrase is already dilated, the ma is not
  }
  // The shakuhachi body (Phase 3): two REGISTERS with different bodies —
  // otsu (low, dark, sine-heavy) below A4, kan (overblown: breathier, more
  // 3rd partial, brighter) above; breath through TWO formant bandpasses (the
  // bore's own, and a vowel around 2.8 kHz); YURI vibrato that blooms late in
  // a long note (an LFO on the oscillators — an audio-rate input, never an
  // automation writer); meri/kari as pitch AND timbre (the meri dip darkens
  // the tone through the note's own lowpass); MURAIKI as a real
  // noise-dominant tone (the breath outweighs the tone for the attack);
  // tongue-less ATARI re-attacks on repeated pitches (a dip, not a strike).
  // The weather's breath channel breathes the noise and the vowel.
  function shakuhachiNote(freq, t, dur, opts) {
    // NOTHING MELODIC SOUNDS INSIDE A BROADCAST'S HOLD. The air claim is made
    // with an ESTIMATE of the phrase's length — the last phrase's — and a
    // 4 s pad; a phrase that turns out far longer runs into a hold its claim
    // legitimately cleared. Raising the pad does not close it (measured: 4 s
    // gives 4 intrusions, 12 s gives 3, and costs 4 % of the melodic density),
    // because the shortfall is tens of seconds, not units.
    //
    // This works now and did NOT before rc.37: the hold is written at arm,
    // 55 s ahead of t0, so by the time a note is scheduled the hold it would
    // land in already exists. That is the difference between this and plan
    // §12, where no render-time test could help because the hold did not yet
    // exist. Same one-line shape 崩's groove and 鏡's answer already use.
    if (signalUp(t)) return;

    var c = ctx; opts = opts || {};
    freq = FAR.pitch("shakuhachi", freq, t);   // 逸脱 the pitch choke point (identity at home)
    var R = S.shakuhachi, wx = wxAt(t);
    var kan = freq >= 440;
    var out = opts.out || panAt("shakuhachi", (R.next() * 2 - 1) * 0.25);
    var o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "sine"; o2.type = kan ? "sine" : "triangle";
    var f2mul = kan ? 3 : 1;                                   // kan: the 3rd partial rides along; otsu: the triangle body
    if (opts.glideFrom) {                          // meri-kari slide
      var gt = Math.min(dur * 0.5, 0.4);
      o.frequency.setValueAtTime(opts.glideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + gt);
      o2.frequency.setValueAtTime(opts.glideFrom * f2mul, t); o2.frequency.exponentialRampToValueAtTime(freq * f2mul, t + gt);
    } else { o.frequency.setValueAtTime(freq, t); o2.frequency.setValueAtTime(freq * f2mul, t); }
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.setValueAtTime(0.7, t);
    var cut = Math.min(16000, freq * (kan ? 10 : 6));
    lp.frequency.setValueAtTime(cut, t);
    if (opts.bend) {                               // meri: the pitch dips AND the tone darkens
      // 逸脱 減: the mode's semitone pairs have already narrowed; here the
      // ORNAMENT walks the new interval — the dip goes as deep as the mode
      // moved, and comes back only most of the way, so the quarter-tone is a
      // place the line can stand rather than a place it passes through.
      var mp = farNight && farNight.dep.meri;
      var dip = mp ? Math.pow(2, -0.5 * mp.walk / 12) : 0.97;
      var back = mp ? 1 - (1 - dip) * 0.35 : 1;
      o.frequency.exponentialRampToValueAtTime(freq * dip, t + dur * 0.6);
      o.frequency.exponentialRampToValueAtTime(freq * back, t + dur * 0.85);
      lp.frequency.linearRampToValueAtTime(cut * 0.45, t + dur * 0.6);
      lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.9);
    }
    var g = c.createGain(), g2 = c.createGain(), mix = c.createGain();
    o.connect(g); g.connect(mix); o2.connect(g2); g2.connect(mix); mix.connect(lp); lp.connect(out);
    mix.gain.setValueAtTime(1, t);
    var peak = 0.16 * (opts.muraiki ? 0.7 : 1);                  // the lead's presence; muraiki lets the breath lead
    var atk = opts.atari ? 0.06 : 0.09;
    if (opts.atari) {                              // a dip and a swell, no new strike
      farEnv(g.gain, t, [[0.004, peak * 0.35], [atk, peak], [Math.max(0.1, dur - atk - 0.22), peak], [0.22, 0]]);   // 逆: a breath that ends in its attack
    } else {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + atk);
      g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.22));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    var p2 = peak * (kan ? 0.18 : 0.25);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(p2, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    FAR.glideDetune(o.detune, t, dur + 0.05, 0); FAR.glideDetune(o2.detune, t, dur + 0.05, 0);   // 逸脱 螺/弛: the breath sags with the room
    o.start(t); o.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
    // YURI — vibrato that blooms late in a long note
    if (dur > 1.2) {
      var lfo = c.createOscillator(), lg0 = c.createGain();
      lfo.type = "sine"; lfo.frequency.setValueAtTime(4.8 + R.next() * 1.2, t);
      var depth = freq * 0.007;                                 // ≈ ±12 cents at full bloom
      PJ.Voice.env(lg0.gain, t, [[dur * 0.45, 0], [dur * 0.4, depth], [dur * 0.15, 0]]);
      lfo.connect(lg0); lg0.connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    // breath noise through two formants + muraiki (the gritty explosive attack)
    var br = (opts.breath == null ? 0.5 : opts.breath) * (0.7 + 0.6 * wx.breath) * (kan ? 1.6 : 1);
    if (br > 0.01 && sharedNoiseBuf) {
      var nz = noiseSource(), ng = c.createGain();
      var bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.setValueAtTime(freq * 2.4, t); bpf.Q.setValueAtTime(1.4, t);
      var vow = c.createBiquadFilter(); vow.type = "bandpass"; vow.frequency.setValueAtTime(2200 + 1200 * wx.breath, t); vow.Q.setValueAtTime(3, t);
      var vg = c.createGain(); vg.gain.setValueAtTime(0.5, t);
      nz.connect(bpf); bpf.connect(ng); nz.connect(vow); vow.connect(vg); vg.connect(ng); ng.connect(out);
      var bpeak = 0.02 * br + 0.14 * (opts.muraiki || 0);      // muraiki: the breath leads
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(bpeak, t + (opts.muraiki ? 0.015 : 0.09));
      ng.gain.exponentialRampToValueAtTime(0.0001, t + (opts.muraiki ? Math.min(dur, 0.5) : dur));
      nz.start(t, R.next() * 20); nz.stop(t + dur + 0.1);
    }
    emitNote("shakuhachi", freq, t, dur);
  }

  // ==========================================================================
  // HICHIRIKI 篳篥 — the gagaku double reed (Phase 3; Kolob's chanter recipe
  // re-voiced): a detuned sawtooth pair, PRE-ATTENUATED, through a reed-buzz
  // waveshaper, coloured by two fixed nasal formants and a breath of air;
  // the characteristic ENBAI slide into every note. Piercing, so it sits at
  // whisper gain before the formants (the Bardo lesson). A melodic voice:
  // claims the air; seated always in a rite, sometimes elsewhere; in the kyū
  // it takes the cry — long high notes.
  // ==========================================================================
  var reedCurveCache = {};
  function reedCurve(amount) {
    var key = amount.toFixed(2);
    if (reedCurveCache[key]) return reedCurveCache[key];
    var n = 1024, cv = new Float32Array(n), k = 3 + amount * 12;
    for (var i = 0; i < n; i++) { var x = (i / (n - 1)) * 2 - 1; cv[i] = (1 - amount) * x + amount * (Math.tanh(k * x) / Math.tanh(k)); }
    reedCurveCache[key] = cv;
    return cv;
  }
  function hichirikiNote(freq, t, dur, opts) {
    // NOTHING MELODIC SOUNDS INSIDE A BROADCAST'S HOLD. The air claim is made
    // with an ESTIMATE of the phrase's length — the last phrase's — and a
    // 4 s pad; a phrase that turns out far longer runs into a hold its claim
    // legitimately cleared. Raising the pad does not close it (measured: 4 s
    // gives 4 intrusions, 12 s gives 3, and costs 4 % of the melodic density),
    // because the shortfall is tens of seconds, not units.
    //
    // This works now and did NOT before rc.37: the hold is written at arm,
    // 55 s ahead of t0, so by the time a note is scheduled the hold it would
    // land in already exists. That is the difference between this and plan
    // §12, where no render-time test could help because the hold did not yet
    // exist. Same one-line shape 崩's groove and 鏡's answer already use.
    if (signalUp(t)) return;

    var c = ctx; opts = opts || {};
    freq = FAR.pitch("hichiriki", freq, t);    // 逸脱 the pitch choke point (identity at home)
    var R = S.hichiriki, wx = wxAt(t);
    var reed = getLayerParam("hichiriki", "reed", 0.5), enbai = getLayerParam("hichiriki", "enbai", 0.6), breathAmt = getLayerParam("hichiriki", "breath", 0.35) * (0.7 + 0.6 * wx.breath);
    var out = opts.out || panAt("hichiriki", (R.next() * 2 - 1) * 0.3);
    var mix = c.createGain(); mix.gain.setValueAtTime(0.5, t);
    var slideFrom = opts.glideFrom || freq * Math.pow(2, -(0.4 + enbai * 0.6) / 12);   // the enbai: from below, always
    var slideT = 0.1 + enbai * 0.15;
    for (var d = 0; d < 2; d++) {
      var o = c.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(slideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + Math.min(slideT, dur * 0.4));
      if (opts.bend) { o.frequency.exponentialRampToValueAtTime(freq * 0.975, t + dur * 0.6); o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.85); }
      FAR.glideDetune(o.detune, t, dur + 0.5, d ? 4 : -4);   // 逸脱 螺/弛, on top of the reed's own ±4 ¢
      o.connect(mix); o.start(t); o.stop(t + dur + 0.5);
    }
    var pre = c.createGain(); pre.gain.setValueAtTime(0.22, t);     // pre-attenuate before the buzz + the formants
    var shaper = c.createWaveShaper(); shaper.curve = reedCurve(0.45);
    mix.connect(pre); pre.connect(shaper);
    var fmix = c.createGain(); fmix.gain.setValueAtTime(1, t);
    var dry = c.createGain(); dry.gain.setValueAtTime(0.5, t); shaper.connect(dry); dry.connect(fmix);
    var bp1 = c.createBiquadFilter(); bp1.type = "bandpass"; bp1.frequency.setValueAtTime(1900 + reed * 700, t); bp1.Q.setValueAtTime(6, t);
    var g1 = c.createGain(); g1.gain.setValueAtTime(0.8, t); shaper.connect(bp1); bp1.connect(g1); g1.connect(fmix);
    var bp2 = c.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.setValueAtTime(3100 + reed * 800, t); bp2.Q.setValueAtTime(7, t);
    var g2 = c.createGain(); g2.gain.setValueAtTime(0.5, t); shaper.connect(bp2); bp2.connect(g2); g2.connect(fmix);
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3600 + reed * 2000, t);
    var og = c.createGain(); fmix.connect(lp); lp.connect(og); og.connect(out);
    if (breathAmt > 0.02 && sharedNoiseBuf) {
      var nz = noiseSource(), nbp = c.createBiquadFilter(), ng = c.createGain();
      nbp.type = "bandpass"; nbp.frequency.setValueAtTime(3200, t); nbp.Q.setValueAtTime(1.4, t);
      nz.connect(nbp); nbp.connect(ng); ng.connect(out);
      var npk = breathAmt * 0.06;
      PJ.Voice.env(ng.gain, t, [[0.06, npk], [Math.max(0.1, dur - 0.26), npk * 0.8], [0.2, 0]]);
      nz.start(t, R.next() * 20); nz.stop(t + dur + 0.3);
    }
    var peak = 0.50 * (opts.gain == null ? 1 : opts.gain);     // target −9 ± 2 dB rel master (critic r1)
    var atk = opts.swell ? Math.min(1.2, dur * 0.3) : 0.05, rel = Math.min(0.6, 0.2 + dur * 0.06);
    farEnv(og.gain, t, [[atk, peak], [Math.max(0.06, dur - atk - rel), peak * 0.9], [rel, 0]]);   // 逆
    emitNote("hichiriki", freq, t, dur);
  }
  var hichiState = { idx: 11, dir: 1, center: 11, lastSpan: 0 };
  function startHichiriki(t) {
    if (!playing) return;
    hichiState.center = scaleIndexOf(6); hichiState.idx = hichiState.center; hichiState.dir = 1;
    hichirikiPhrase(t);
  }
  function hichirikiPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.hichiriki;
    if (!seated("hichiriki", now)) { afterRaw("hichiriki", now, R.rnd(6, 10), hichirikiPhrase); return; }
    var margin = airMargin(R, now) * 1.2;
    var tok = airClaimAt(now, "hichiriki", hichiState.lastSpan || 5, margin);
    if (!tok) { afterRaw("hichiriki", now, R.rnd(5, 9), hichirikiPhrase); return; }   // a sparse voice does not hammer a full air
    var pace = getLayerParam("hichiriki", "pace", 1.0) * (1 + arc * 0.3);
    var cry = arcPhase(now) === "kyū";
    hichiState.center = Math.round(scaleIndexOf(6) + arc * 3 + (cry ? 2 : 0));
    var phrase, motif = null;
    if (Motif.overdueFor("hichiriki", now)) motif = Motif.claim("hichiriki", now);
    if (!motif && R.chance(0.5)) motif = Motif.request("hichiriki", now);
    if (motif) { phrase = fitToRegister(motif.notes, hichiState.center).slice(0, cry ? 2 : 4); Motif.postFrom("hichiriki", motif, now); }
    else {
      phrase = walk(R, hichiState, 1 + Math.floor(R.next() * 2), 4, arc);
      emitEvent({ cat: "hichiriki", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    if (phrase.length) hichiState.idx = phrase[phrase.length - 1].deg;
    var ownBeat = (cry ? 2.2 : 1.4) / pace * farTimeMul("hichiriki", now);
    var cn = farCanonTake("hichiriki", phrase, now, hichiState.center, ownBeat);   // 重 継
    phrase = cn.phrase;
    var beat = ownBeat * cn.cs, t = cn.t0, prev = null;   // 逸脱 遅/弛
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.8, n.durBeats * beat);
      if (cn.kind === "hocket" && (i % cn.of) !== cn.slot) { t += dur; continue; }   // 継
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq * cn.sharp;   // 重
      hichirikiNote(f, t, dur, { glideFrom: (prev && R.next() < 0.6) ? prev : null, bend: R.next() < 0.35 || !!n.meri, swell: i === 0 && !cry });
      prev = f; t += dur + R.next() * 0.1;
    }
    hichiState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (5 + R.next() * 8) * (1 - arc * 0.5) * metaRestMul() * gapMulAt(t) / trimOf("hichiriki");
    afterSpan("hichiriki", now, (t - now) + rest * farTimeMul("hichiriki", now), hichirikiPhrase);
  }

  // ==========================================================================
  // BIWA 琵琶 — promoted from the ambient pool to a VOICE (Phase 3): the
  // satsuma-biwa's tremolo strums, a huge sawari, a narrator who has no story
  // left. Seated in drift and silence cycles above all; claims the air; long
  // silences between utterances; the lowest register of the plucked family.
  // ==========================================================================
  var biwaState = { idx: 6, dir: 1, center: 6, lastSpan: 0 };
  function biwaStrum(freq, t, opts) {                       // a tremolo strum: 3–7 restrikes at 45–80 ms, velocity decaying
    var R = S.biwa, n = 3 + Math.floor(R.next() * 5), tt = t, tremolo = getLayerParam("biwa", "tremolo", 0.6);
    // 影 opts.scale: the strum is part of the phrase, so under a canon take it
    // runs in the canon's time like everything else. It read no beat at all
    // before, which is one of the three reasons the ratios never arrived.
    var cs = (opts && opts.scale > 0) ? opts.scale : 1;
    for (var i = 0; i < n; i++) {
      stringNote("biwa", freq, tt, (0.9 + (i === n - 1 ? 1.2 : 0)) * cs, { vel: 0.9 - i * 0.08, gain: opts && opts.gain != null ? opts.gain : 1 });
      tt += (0.045 + (1 - tremolo) * 0.035 + R.next() * 0.02) * cs;
    }
    return tt - t;
  }
  function startBiwa(t) {
    if (!playing) return;
    biwaState.center = scaleIndexOf(2); biwaState.idx = biwaState.center; biwaState.dir = -1;
    biwaPhrase(t);
  }
  function biwaPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.biwa;
    if (!seated("biwa", now)) { afterRaw("biwa", now, R.rnd(8, 14), biwaPhrase); return; }
    var margin = airMargin(R, now) * 1.5;
    var tok = airClaimAt(now, "biwa", biwaState.lastSpan || 4, margin);
    if (!tok) { afterRaw("biwa", now, R.rnd(8, 14), biwaPhrase); return; }
    biwaState.center = Math.round(scaleIndexOf(2) + arc * 2);
    var phrase, motif = null;
    if (Motif.overdueFor("biwa", now)) motif = Motif.claim("biwa", now);
    if (!motif && R.chance(0.4)) motif = Motif.request("biwa", now);
    if (motif) { phrase = fitToRegister(motif.notes, biwaState.center).slice(0, 4); Motif.postFrom("biwa", motif, now); }
    else { phrase = walk(R, biwaState, 1 + Math.floor(R.next() * 3), 4, arc); emitEvent({ cat: "biwa", label: "fresh", detail: phrase.length + " notes" }, now); }
    var ownBeat = 0.9 * farTimeMul("biwa", now);   // the narrator has no `pace`; 0.9 was its inline factor
    var cn = farCanonTake("biwa", phrase, now, biwaState.center, ownBeat);   // 影
    phrase = cn.phrase;
    if (farClouds) { farCloudSpan("biwa", R, now, biwaState.center, tok, margin, arc, biwaPhrase); return; }   // 雲
    if (cn.kind === "swarm" && !cn.take) farSwarmTail(phrase, cn.t0, ownBeat * cn.cs, biwaState.center);   // 群
    if (phrase.length) biwaState.idx = phrase[phrase.length - 1].deg;
    var beat = ownBeat * cn.cs, t = cn.t0, strummed = false;   // 逸脱 遅/弛/影
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq;
      // 影: a canon voice STATES the subject — it does not tremolo through it.
      // The strum is the narrator's own gesture and it belongs to the narrator's
      // own phrases, not to a canon entry.
      if (!farCanon && (i === 0 || i === phrase.length - 1) && R.next() < 0.6) { t += biwaStrum(f, t, { scale: cn.cs }) + 0.3 * cn.cs; strummed = true; }
      // the gap between notes is the narrator's breath at home and a fraction
      // of the beat under a canon, where every voice must differ by the ratio
      // and by nothing else (a flat 0.3 s gap put the biwa 17 % wide)
      else { var bd = Math.max(0.6 * beat / 0.9, n.durBeats * beat); stringNote("biwa", f, t, bd, { vel: 0.6 + R.next() * 0.35 }); t += bd + R.next() * (farCanon ? 0.09 * beat : 0.3); }
    }
    if (strummed) emitEvent({ cat: "biwa", label: "琵琶 strum", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") }, now);
    biwaState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (8 + R.next() * 12) * (1 - arc * 0.3) * metaRestMul() * gapMulAt(t) / trimOf("biwa");
    afterSpan("biwa", now, (t - now) + rest * farTimeMul("biwa", now), biwaPhrase);
  }

  // ==========================================================================
  // THE PLUCKED STRING (Phase 3) — koto, shamisen and biwa share one body
  // ==========================================================================
  // In the Library's manner, made a real string: a ONE-PERIOD noise burst
  // looped (a noise-excited wavetable — harmonic at the note, every note a
  // different random timbre: texture, unseeded) through a frequency-tracking
  // lowpass that dulls as the string dies. PLUCK POSITION is baked into the
  // burst as a comb (y[n] = x[n] − x[n − pos·N]): a different tone per note.
  // PLECTRUM NOISE — the koto's tsume tick, the shamisen's and biwa's bachi
  // slap — is a separate short burst. A VELOCITY LAW scales level, starting
  // brightness and decay; REGISTER-DEPENDENT DECAY: low strings ring, high
  // strings snap. playbackRate corrects the period quantization exactly and
  // carries the glides and the oshide press-bend. The old envelope shapes
  // (linear from true zero, exponential knee, linear to zero) are kept.
  var STRING_KIT = {
    // peaks 0.16 / 0.16 / 0.14 (critic, Phase 3 r2): with the brown burst the body
    // carries a sawtooth's power through its lowpass; target −16 ± 2 dB rel master
    koto:     { plectrum: "tsume", peak: 0.16, decay: 1.0,  brightK: 0.35, brightBase: 1.5, sawari: 0,   sparkle: 0.015 },
    shamisen: { plectrum: "bachi", peak: 0.16, decay: 0.75, brightK: 0.45, brightBase: 1.6, sawari: 1,   sparkle: 0 },
    biwa:     { plectrum: "bachi", peak: 0.14, decay: 1.3,  brightK: 0.3,  brightBase: 1.3, sawari: 1.6, sparkle: 0 },
  };
  function stringNote(layer, freq, t, dur, opts) {
    // NOTHING MELODIC SOUNDS INSIDE A BROADCAST'S HOLD. The air claim is made
    // with an ESTIMATE of the phrase's length — the last phrase's — and a
    // 4 s pad; a phrase that turns out far longer runs into a hold its claim
    // legitimately cleared. Raising the pad does not close it (measured: 4 s
    // gives 4 intrusions, 12 s gives 3, and costs 4 % of the melodic density),
    // because the shortfall is tens of seconds, not units.
    //
    // This works now and did NOT before rc.37: the hold is written at arm,
    // 55 s ahead of t0, so by the time a note is scheduled the hold it would
    // land in already exists. That is the difference between this and plan
    // §12, where no render-time test could help because the hold did not yet
    // exist. Same one-line shape 崩's groove and 鏡's answer already use.
    if (signalUp(t)) return;

    var c = ctx, K = STRING_KIT[layer], R = S[layer]; opts = opts || {};
    freq = FAR.pitch(layer, freq, t);          // 逸脱 the pitch choke point — koto, shamisen, biwa (identity at home)
    var wx = wxAt(t);
    var vel = opts.vel != null ? opts.vel : (0.55 + R.next() * 0.45);
    var out = panAt(layer, (R.next() * 2 - 1) * (layer === "koto" ? 0.35 : 0.3));
    var sr = c.sampleRate || 48000;
    var N = Math.max(8, Math.round(sr / freq)), rate = freq * N / sr;
    var pos = 0.12 + R.next() * 0.25;                          // pluck position, as a fraction of the string
    if (layer === "koto") pos = 0.1 + getLayerParam("koto", "pluck", 0.5) * 0.3 + (R.next() - 0.5) * 0.08;
    var buf = c.createBuffer(1, N, sr), d = buf.getChannelData(0), k = Math.max(1, Math.round(pos * N));
    var raw = new Float32Array(N);
    for (var i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;                 // texture, not music
    for (i = 0; i < N; i++) d[i] = raw[i] - raw[(i - k + N) % N];             // the pluck-position comb
    // A BROWN burst (critic, Phase 3 r2): a white one-period burst loses
    // ~23 dB through the note's lowpass at ~4 f whatever its level; a leaky
    // integrator run twice around the loop tilts it to ~1/n² — a plucked
    // string's real initial displacement (a triangle) — and it then keeps
    // within 1 dB of a sawtooth through the same lowpass. DC removed after.
    var acc = 0, pass, m = 0;
    for (pass = 0; pass < 2; pass++) for (i = 0; i < N; i++) { acc = 0.995 * acc + d[i]; if (pass) d[i] = acc; }
    for (i = 0; i < N; i++) m += d[i]; m /= N; for (i = 0; i < N; i++) d[i] -= m;
    // then normalise to a fixed RMS (0.5; a sawtooth's is 0.58) so the level
    // lives in the peak below and does not scatter per pluck
    var en = 0; for (i = 0; i < N; i++) en += d[i] * d[i];
    var sc = 0.5 / Math.sqrt(Math.max(1e-9, en / N)); for (i = 0; i < N; i++) d[i] *= sc;
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    src.playbackRate.setValueAtTime(rate, t);
    if (opts.glideFrom) { var gt = Math.min(dur * 0.35, 0.18); src.playbackRate.setValueAtTime(rate * opts.glideFrom / freq, t); src.playbackRate.exponentialRampToValueAtTime(rate, t + gt); }
    if (opts.bend) { src.playbackRate.linearRampToValueAtTime(rate * 1.03, t + dur * 0.5); src.playbackRate.linearRampToValueAtTime(rate, t + dur * 0.8); }   // oshide press-bend
    // register-dependent decay: low strings ring, high strings snap
    var regMul = freq < 200 ? 1.6 : freq < 400 ? 1.2 : freq < 800 ? 0.9 : 0.65;
    var sustain = layer === "koto" ? getLayerParam("koto", "sustain", 1.0) : 1;
    var dec = Math.max(0.12, dur * sustain * K.decay * regMul * (0.9 + 0.2 * vel));
    var brightKnob = layer === "koto" ? getLayerParam("koto", "brightness", 7) : 6;
    var bright = (K.brightBase + brightKnob * K.brightK) * (0.8 + 0.4 * wx.brightness) * (0.8 + 0.4 * vel);
    var lp = c.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(16000, freq * bright), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.8, 120), t + dec * 0.8);   // the string dulls
    lp.Q.setValueAtTime(0.7, t);
    var g = c.createGain(); src.connect(lp); lp.connect(g); g.connect(out);
    var peak = K.peak * (opts.gain == null ? 1 : opts.gain) * (0.4 + 0.6 * vel);
    var atk = Math.max(0.004, Math.min(0.006, dec * 0.3)), knee = Math.min(0.15, dec * 0.6);
    if (atk >= knee) atk = knee * 0.5;
    farEnv(g.gain, t, [[atk, peak], [knee - atk, peak * 0.3], [dec - knee, 0]]);   // 逆: a pluck that swells
    FAR.glideDetune(src.detune, t, dec + 0.05, 0);   // 逸脱 螺/弛: the string sags with the room (detune is free here; playbackRate carries the pluck's own bends)
    if (farMetal && farMetal.targets.indexOf(layer) >= 0) farMetalFM(src.detune, freq, t, dec);   // 金: and the same param carries the FM, additively
    src.start(t); src.stop(t + dec + 0.05);
    // THE PICK (Phase M — the mix pass, the orchestrator's ruling): the plan's
    // plectrum noise made a real transient. Measured, the string bodies hold
    // almost nothing at 1.5–4 kHz (the lowpass sits at ~4 f), so the koto's
    // tsume tick and the bachi's slap were the only pick there — and 25–30 dB
    // under the landscape's crud. Now: a 2–4 kHz BANDPASS burst, ≤ 15 ms,
    // click-safe (1.5 ms from true zero, 3 ms to zero), pre-attenuated (the
    // bandpass peaks at unity; the level lives in pp), per-note varied in
    // centre and length from the TEXTURE stream (Math.random, never the
    // voice's seeded stream, so the note stream is byte-identical). The bachi
    // keeps its low slap beside the click. The seeded draw for the noise
    // offset is kept in place (stream discipline).
    if (sharedNoiseBuf) {
      var tsume = K.plectrum === "tsume", gmul = (0.7 + 0.3 * vel) * Math.max(0.75, opts.gain == null ? 1 : opts.gain);   // a gentler law than the body's (critic r1): the softest plucks and the shadow notes still show their pick; the loud end is unchanged (floor 0.75, not 0.85: a gliss run's picks summed in one row pushed the koto's peak to +3.6)
      var pn = noiseSource(), pf = c.createBiquadFilter(), pg = c.createGain();
      pf.type = "bandpass"; pf.frequency.setValueAtTime((tsume ? 3000 : 2500) * Math.pow(2, (Math.random() - 0.5) * 0.7), t); pf.Q.setValueAtTime(1.0, t);   // 2.4–3.8 kHz tsume, 2.0–3.2 kHz bachi
      pn.connect(pf); pf.connect(pg); pg.connect(out);
      var pd = 0.007 + Math.random() * 0.0035, pp = (tsume ? 0.17 : 0.12) * gmul;                                       // 7–10.5 ms body of the burst; ≤ 15 ms in all (measured: 0.11 read +4.8 at the koto's onset in the jo, −0.6 in the ha — the noise bodies own that band there)
      PJ.Voice.env(pg.gain, t, [[0.0015, pp], [pd, pp * 0.3], [0.003, 0]]);
      pn.start(t, R.next() * 10); pn.stop(t + pd + 0.02);
      if (!tsume) {                                                                                                 // the bachi's slap: the old lowpassed thud, as it was
        var sn2 = noiseSource(), sf2 = c.createBiquadFilter(), sg2 = c.createGain();
        sf2.type = "lowpass"; sf2.frequency.setValueAtTime(900, t);
        sn2.connect(sf2); sf2.connect(sg2); sg2.connect(out);
        var sp2 = 0.05 * gmul;
        PJ.Voice.env(sg2.gain, t, [[0.0015, sp2], [0.012, sp2 * 0.3], [0.006, 0]]);
        sn2.start(t, (pos * 7) % 10); sn2.stop(t + 0.04);                                                       // offset from a value already drawn — no new seeded draw
      }
    }
    // sawari — the bridge buzz: a resonant high comb that sings on the
    // lowest strings only (shamisen: the lowest string; biwa: always, huge)
    var sawAmt = layer === "shamisen" ? getLayerParam("shamisen", "sawari", 0.6) * (freq < 220 ? 1 : 0.15) : layer === "biwa" ? getLayerParam("biwa", "sawari", 0.8) : 0;
    if (sawAmt > 0.02) {
      var bo = c.createOscillator(); bo.type = "sawtooth"; bo.frequency.setValueAtTime(freq * 1.005, t);
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(Math.min(12000, freq * 7), t); bp.Q.setValueAtTime(6, t);
      var bg = c.createGain(); bo.connect(bp); bp.connect(bg); bg.connect(out);   // a bandpass peaks at unity: the pre-attenuation lives in sp
      var sawIn = Math.min(0.014, dec * 0.4), sp = 0.05 * sawAmt * K.sawari * vel;
      PJ.Voice.env(bg.gain, t, [[sawIn, sp], [dec * 0.7 - sawIn, sp * 0.1], [dec * 0.4, 0]]);
      bo.start(t); bo.stop(t + dec * 1.2 + 0.05);
    }
    if (K.sparkle > 0) {                                     // the koto's octave sparkle
      var sh = c.createOscillator(), shg = c.createGain(); sh.type = "sine"; sh.frequency.setValueAtTime(freq * 2, t); sh.connect(shg); shg.connect(out);
      PJ.Voice.env(shg.gain, t, [[0.04, K.sparkle * (0.7 + 0.6 * wx.brightness) * vel], [Math.max(0.05, dec - 0.04), 0.001], [0.05, 0]]);
      sh.start(t); sh.stop(t + dec + 0.15);
    }
    emitNote(layer, freq, t, dur);
  }

  // ==========================================================================
  // KOTO 箏 — plucked zither (bright melodic voice + glissando flourishes)
  // ==========================================================================
  var kotoState = { idx: 8, dir: 1, center: 8 };
  function startKoto(t) {
    if (!playing) return;
    kotoState.center = scaleIndexOf(4); kotoState.idx = kotoState.center; kotoState.dir = 1;
    kotoPhrase(t);
  }
  function kotoPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("koto", now)) { afterRaw("koto", now, S.koto.rnd(5, 9), kotoPhrase); return; }
    var margin = airMargin(S.koto, now);
    var tok = airClaimAt(now, "koto", kotoState.lastSpan || 2.5, margin);
    if (!tok) { afterRaw("koto", now, S.koto.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), kotoPhrase); return; }
    var kotoSolo = scn.type === "solo" && scn.activity === "koto";
    var pace = getLayerParam("koto", "pace", 1.0) * (1 + arc * 0.7) * (kotoSolo ? 0.9 : 1);
    var glissAmt = getLayerParam("koto", "gliss", 0.4) * (kotoSolo ? 1.6 : 1);
    kotoState.center = Math.round(scaleIndexOf(4) + arc * 3);
    var phrase, motif = null;
    if (Motif.overdueFor("koto", now)) motif = Motif.claim("koto", now);
    if (!motif && S.koto.chance(0.55)) motif = Motif.request("koto", now);
    if (motif) { phrase = fitToRegister(motif.notes, kotoState.center); Motif.postFrom("koto", motif, now); }
    else {
      phrase = walk(S.koto, kotoState, 3 + Math.floor(S.koto.next() * 3) + Math.floor(arc * 2), 7 + Math.round(arc * 2), arc);
      emitEvent({ cat: "koto", label: "fresh", detail: phrase.length + " notes" }, now);
    }
    var ownBeat = 0.4 / pace * farTimeMul("koto", now);
    var cn = farCanonTake("koto", phrase, now, kotoState.center, ownBeat);   // 影: the same page, in the drawn ratio
    phrase = cn.phrase;
    if (farClouds) { farCloudSpan("koto", S.koto, now, kotoState.center, tok, margin, arc, kotoPhrase); return; }   // 雲
    if (cn.kind === "swarm" && !cn.take) farSwarmTail(phrase, cn.t0, ownBeat * cn.cs, kotoState.center);   // 群
    if (phrase.length) kotoState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic
    // pulse) — but never on a canon take: a canon keeps its own time.
    var beat = ownBeat * cn.cs, t = cn.take ? cn.t0 : pulseSnap(cn.t0, arc, "koto"), prev = null, sched = [];   // 逸脱 遅/弛/影/多
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], dur = Math.max(0.12 * cn.cs, n.durBeats * beat);
      if (!cn.take) dur = pulseQuantDur(dur, arc);
      if (cn.kind === "hocket" && (i % cn.of) !== cn.slot) { t += dur; continue; }   // 継: the melody exists only in the sum
      var f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq * cn.sharp;   // 重: a hair sharp
      kotoNote(f, t, dur, { glideFrom: (prev && S.koto.next() < 0.3) ? prev : null, bend: S.koto.next() < 0.2 });
      sched.push({ f: f, t: t, dur: dur });
      prev = f; t += dur + S.koto.next() * 0.03;
    }
    // 〰 sankyoku heterophony downward: the shamisen sometimes shadows the koto
    // a breath behind — same page, its own accents, a hair sharp (a granted
    // overlap, as above).
    if (!farMirror && sched.length >= 3 && S.koto.chance(arcPhase(now) === "ha" ? 0.2 : 0.07) && seated("shamisen", now) && airClaimAt(now, "shamisen", t - now, 0)) {
      var lag = S.koto.rnd(0.15, 0.4), sharp = Math.pow(2, S.koto.rnd(2, 3.5) / 1200);
      for (var sh = 0; sh < sched.length; sh++) {
        var sn = sched[sh];
        shamisenNote(sn.f * sharp, sn.t + lag + S.koto.rnd(0, 0.04), Math.max(0.1, Math.min(sn.dur, 0.3)), { gain: sh % 2 === 0 ? 0.6 : 0.4 });
      }
      emitEvent({ cat: "shamisen", label: "〰 shamisen shadows koto", detail: (motif ? motif.name + "·g" + motif.gen : "fresh") + " · " + sched.length + " notes" }, now);
    }
    // glissando flourish — a rapid run up/down the scale (more in ha/kyū)
    if (!farCanon && S.koto.next() < glissAmt * (0.3 + arc)) {   // 影: a canon voice states the subject, it does not flourish
      var up = S.koto.next() < 0.5, start = kotoState.idx, gn = 4 + Math.floor(S.koto.next() * 5), gt = t;
      for (var k = 0; k < gn; k++) {
        var gi = Math.max(0, Math.min(SCALE.length - 1, start + (up ? k : -k)));
        kotoNote(SCALE[gi].freq, gt, 0.14 * cn.cs, { gain: 0.7 }); gt += (0.05 + S.koto.next() * 0.03) * cn.cs;   // 影: the ornament runs in the canon's time too
      }
      t = gt; emitEvent({ cat: "koto", label: "gliss", detail: (up ? "↑" : "↓") + gn }, now);
    }
    farMirrorAnswer("koto", phrase, sched, now, beat);         // 鏡
    kotoState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (1.6 + S.koto.next() * 3.2) * (1 - arc * 0.5) * (arc < 0.15 ? 4 : 1) * metaRestMul() * gapMulAt(t) / trimOf("koto");  // sparse in jo; meta tilts density ±12%
    afterSpan("koto", now, (t - now) + rest * farTimeMul("koto", now), kotoPhrase);
  }
  function kotoNote(freq, t, dur, opts) { stringNote("koto", freq, t, dur, opts); }

  // ==========================================================================
  // SHAMISEN 三味線 — gritty plucked lute with SAWARI buzz (tsugaru/punk edge)
  // ==========================================================================
  var shamiState = { idx: 7, dir: 1, center: 7 };
  function startShamisen(t) {
    if (!playing) return;
    shamiState.center = scaleIndexOf(3); shamiState.idx = shamiState.center; shamiState.dir = 1;
    shamisenPhrase(t);
  }
  function shamisenPhrase(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now);
    if (!seated("shamisen", now)) { afterRaw("shamisen", now, S.shamisen.rnd(5, 9), shamisenPhrase); return; }
    var margin = airMargin(S.shamisen, now);
    var tok = airClaimAt(now, "shamisen", shamiState.lastSpan || 1.8, margin);
    if (!tok) { afterRaw("shamisen", now, S.shamisen.rnd(2, 5) * (arcPhase(now) === "jo" ? 1.5 : 1), shamisenPhrase); return; }
    var pace = getLayerParam("shamisen", "pace", 1.0) * (1 + arc * 1.0);   // comes alive in ha/kyū
    shamiState.center = Math.round(scaleIndexOf(3) + arc * 3);
    var phrase, motif = null;
    if (Motif.overdueFor("shamisen", now)) motif = Motif.claim("shamisen", now);
    if (!motif && S.shamisen.chance(0.45)) motif = Motif.request("shamisen", now);
    if (motif) { phrase = fitToRegister(motif.notes, shamiState.center); Motif.postFrom("shamisen", motif, now); }
    else {
      phrase = walk(S.shamisen, shamiState, 3 + Math.floor(S.shamisen.next() * 4) + Math.floor(arc * 3), 6 + Math.round(arc * 2), arc);
      emitEvent({ cat: "shamisen", label: "fresh", detail: phrase.length + " notes · " + arcPhase(now) }, now);
    }
    var ownBeat = 0.28 / pace * farTimeMul("shamisen", now);
    var cn = farCanonTake("shamisen", phrase, now, shamiState.center, ownBeat);   // 影
    phrase = cn.phrase;
    if (farClouds) { farCloudSpan("shamisen", S.shamisen, now, shamiState.center, tok, margin, arc, shamisenPhrase); return; }   // 雲
    if (cn.kind === "swarm" && !cn.take) farSwarmTail(phrase, cn.t0, ownBeat * cn.cs, shamiState.center);   // 群
    if (phrase.length) shamiState.idx = phrase[phrase.length - 1].deg;
    // phrase ONSET magnetizes toward the taiko grid as the kyū builds (elastic
    // pulse) — never on a canon take.
    var beat = ownBeat * cn.cs, t = cn.take ? cn.t0 : pulseSnap(cn.t0, arc, "shamisen");   // 逸脱 遅/弛/影/多
    for (var i = 0; i < phrase.length; i++) {
      var n = phrase[i], f = SCALE[Math.max(0, Math.min(SCALE.length - 1, n.deg))].freq * cn.sharp;   // 重
      // 影: no cap on the note's length — the shamisen alone clipped durBeats at
      // one beat, so on a shared subject its long notes were short and the
      // drawn ratio came apart at the wide spreads (2:3:5 read 0.95 : 1.00).
      var dur = Math.max(0.1 * cn.cs, (farCanon ? n.durBeats : Math.min(n.durBeats, 1)) * beat);
      if (!cn.take) dur = pulseQuantDur(dur, arc);
      if (cn.kind === "hocket" && (i % cn.of) !== cn.slot) { t += dur; continue; }   // 継
      // tsugaru hammer-on: a quick lower-neighbor grace before the beat — the
      // shamisen's own idiom, and not part of a canon entry (see the biwa's strum)
      if (!farCanon && S.shamisen.next() < 0.25 + arc * 0.3) {
        shamisenNote(SCALE[Math.max(0, n.deg - 1)].freq, t, 0.05 * cn.cs, { gain: 0.55 });
        t += 0.05 * cn.cs;
      }
      shamisenNote(f, t, dur, { gain: (i % 2 === 0 ? 1.0 : 0.6) });
      t += dur + 0.01 * cn.cs;
    }
    shamiState.lastSpan = t - now;
    tok.until = t + margin;
    var rest = (2.2 + S.shamisen.next() * 3.5) * (1 - arc * 0.6) * (arc < 0.3 ? 5 : 1) * metaRestMul() * gapMulAt(t) / trimOf("shamisen");  // mostly absent in jo; meta tilts density ±12%
    afterSpan("shamisen", now, (t - now) + rest * farTimeMul("shamisen", now), shamisenPhrase);
  }
  function shamisenNote(freq, t, dur, opts) { stringNote("shamisen", freq, t, dur, opts); }

  // ==========================================================================
  // TAIKO 太鼓 — drums (silent in jo; drives the ha → kyū climb)
  // ==========================================================================
  function startTaiko(t) { if (playing) taikoPulse(t); }
  // THE KIT (Phase 3): three drums —
  //   ō-daiko  (don): the deep long hit, 95→45 Hz sine + a lowpassed skin burst
  //   shime    (ka? no — "tsu"/"ko"): the high tight drum, 240→180 Hz, a body
  //            resonance around 1.2 kHz, short
  //   ka:      the rim click — a 15 ms highpassed tick
  function taikoHit(t, accent, drum) {
    var c = ctx, R = S.taiko, out = panAt("taiko", (R.next() * 2 - 1) * 0.2);
    var lowTune = getLayerParam("taiko", "lowTune", 1.0), punch = getLayerParam("taiko", "punch", 0.6);
    drum = drum || "odaiko";
    if (drum === "ka") {
      if (!sharedNoiseBuf) return;
      var kn = noiseSource(), kh = c.createBiquadFilter(), kg = c.createGain();
      kh.type = "highpass"; kh.frequency.setValueAtTime(3500, t);
      kn.connect(kh); kh.connect(kg); kg.connect(out);
      var kp = (0.05 + punch * 0.04) * (accent ? 1.2 : 0.8);
      PJ.Voice.env(kg.gain, t, [[0.001, kp], [0.012, kp * 0.2], [0.008, 0]]);
      kn.start(t, R.next() * 10); kn.stop(t + 0.05);
      var ko = c.createOscillator(), kog = c.createGain(); ko.type = "sine"; ko.frequency.setValueAtTime(2100, t);
      ko.connect(kog); kog.connect(out); PJ.Voice.env(kog.gain, t, [[0.001, kp * 0.5], [0.02, 0.001], [0.01, 0]]); ko.start(t); ko.stop(t + 0.05);
      return;
    }
    var o = c.createOscillator(), g = c.createGain(); o.type = "sine";
    if (drum === "shime") {
      o.frequency.setValueAtTime(240 * lowTune, t); o.frequency.exponentialRampToValueAtTime(180 * lowTune, t + 0.06);
      o.connect(g); g.connect(out);
      var sp = (0.10 + punch * 0.06) * (accent ? 1.2 : 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(sp, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.start(t); o.stop(t + 0.2);
      if (sharedNoiseBuf) {                                  // the body resonance
        var sn = noiseSource(), sb = c.createBiquadFilter(), sg = c.createGain();
        sb.type = "bandpass"; sb.frequency.setValueAtTime(1200, t); sb.Q.setValueAtTime(5, t);
        sn.connect(sb); sb.connect(sg); sg.connect(out);                          // bandpass peaks at unity: attenuation in the envelope
        PJ.Voice.env(sg.gain, t, [[0.002, 0.028 * (accent ? 1.2 : 0.8)], [0.05, 0.0016], [0.02, 0]]);
        sn.start(t, R.next() * 10); sn.stop(t + 0.1);
      }
      return;
    }
    o.frequency.setValueAtTime(95 * lowTune, t); o.frequency.exponentialRampToValueAtTime(45 * lowTune, t + 0.16);
    o.connect(g); g.connect(out);
    var peak = (0.14 + punch * 0.1) * (accent ? 1.2 : 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.55 : 0.4));
    o.start(t); o.stop(t + 0.6);
    if (sharedNoiseBuf) {
      var nz = noiseSource(); var bp = c.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.setValueAtTime(800, t);
      var ng = c.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.06 * (accent ? 1.2 : 0.8), t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      nz.start(t, R.next() * 10); nz.stop(t + 0.2);
    }
  }
  // THE PATTERN VOCABULARY — strings over a half-beat grid: D ō-daiko accent,
  // d ō-daiko soft, s shime, S shime accent, k ka, . rest. The ji is the base
  // pulse (the ha); the matsuri patterns are the kyū's (and the festival's).
  var TAIKO_PATTERNS = {
    ji:      [["D.d.d.d.", 3], ["D.d.D.d.", 2], ["D...d...", 2], ["D.d.d.k.", 1]],
    matsuri: [["D.ssD.s.", 3], ["DsdsD.k.", 2], ["D.D.ss.k", 2], ["dsdsdsDk", 2], ["D..sD.sk", 1.5]],   // don-doko-don, the yatai-bayashi shape
  };
  // ==========================================================================
  // 多 POLYMETER (W2) — three drums, three meters, one tatum
  // ==========================================================================
  // The plan: "3 against 4 against 7 across its three drums; the pulse magnet
  // pulls each voice to a different drum." At home the three drums read one
  // shared pattern string, so they are one instrument with three timbres — the
  // critic measured it: the share of a drum's inter-onsets near its own median
  // is 8–17 % for the shime and 9–10 % for the ō-daiko, i.e. no periodicity of
  // its own at all. Under 多 each drum keeps ITS OWN cycle against a common
  // tatum, and the phase carries across calls (farPolyN), so the three really
  // do converge, pass and diverge over minutes rather than re-aligning at every
  // pattern boundary. The figures are the drums' own: the ō-daiko marks the
  // downbeat and one interior stroke, the shime fills, the ka chatters.
  var farPolyN = 0;
  // Offsets in TATUMS within each drum's own meter — not fractions of it, which
  // was the first version and meant the ka (meter 7) never matched a quarter
  // and struck exactly zero times in half an hour. Every drum marks its own
  // downbeat, so its median inter-onset IS its meter and the three periods
  // stand in the drawn ratio; the interior strokes are occasional, so they
  // colour the figure without moving that median.
  function farPolyFig(drum, m) {
    if (drum === "odaiko") return [0];
    if (drum === "shime") return [0, Math.ceil(m / 2)];
    return [1, m - 1];                           // the ka chatters off the beat
  }
  var FAR_POLY_CH = { odaiko: ["D", "d"], shime: ["S", "s"], ka: ["k", "k"] };
  function farPolyPattern(t0, beat, hitP) {
    var R = S.taiko, half = beat * 0.5, span = 32;
    var m = farPoly.meters, drums = ["odaiko", "shime", "ka"], rows = {};
    for (var d = 0; d < drums.length; d++) rows[drums[d]] = new Array(span);
    for (var i = 0; i < span; i++) {
      var n = farPolyN + i;
      for (d = 0; d < drums.length; d++) {
        var dr = drums[d], mm = m[d % m.length], pos = n % mm, fig = farPolyFig(dr, mm), hit = null;
        for (var f = 0; f < fig.length; f++) {
          if (pos !== fig[f]) continue;
          // the downbeat is the meter; the interior strokes are occasional so
          // they do not move the drum's median inter-onset off its own period
          var interior = f > 0;
          // 0.62 overall: three drums each on their own downbeat is about twice
          // the strike rate of the one shared pattern they read at home, and
          // that took the peak concurrent sources to 112 against a hard 110 on
          // a night that also carried 重 (the critic's number, and the one with
          // 群 and 雲 still to come). Thinning the strikes keeps all three
          // meters — the periodicity is in WHERE they fall, not how many.
          if (R.next() >= hitP * 0.62 * (interior ? 0.15 : 1) * (dr === "ka" ? 0.55 : 1)) break;
          var accent = !interior && dr !== "ka";
          taikoHit(t0 + i * half, accent, dr);
          hit = FAR_POLY_CH[dr][accent ? 0 : 1];
          break;
        }
        rows[dr][i] = hit || ".";
      }
    }
    farPolyN += span;
    // ONE PATTERN STRING PER DRUM, in the engine's own "地 <string>" shape.
    // The kit is not in the note stream — it is in the taiko event stream as a
    // pattern at half-beat resolution — so a polymetric kit that emitted one
    // merged string would be unreadable to anything downstream (and would hide
    // exactly the periodicity that IS the departure). Three drums, three rows.
    return { end: t0 + span * half, pat: rows.odaiko.join(""), rows: rows, meters: m.join(":") };
  }
  function taikoPattern(t0, kind, beat, hitP) {
    if (farPoly) return farPolyPattern(t0, beat, hitP);   // 逸脱 多
    var R = S.taiko, pat = R.pickW(TAIKO_PATTERNS[kind]), t = t0, half = beat * 0.5;
    for (var i = 0; i < pat.length; i++) {
      var ch = pat.charAt(i);
      if (ch !== "." && R.next() < hitP) {
        if (ch === "D") taikoHit(t, true, "odaiko"); else if (ch === "d") taikoHit(t, false, "odaiko");
        else if (ch === "S") taikoHit(t, true, "shime"); else if (ch === "s") taikoHit(t, false, "shime");
        else if (ch === "k") taikoHit(t, false, "ka");
      }
      t += half;
    }
    return { end: t, pat: pat };
  }
  function taikoPulse(t0) {
    if (!playing) return;
    var now = t0, arc = getArc(now), R = S.taiko;
    if (!seated("taiko", now)) { pulse.active = false; afterRaw("taiko", now, 8, taikoPulse); return; }   // rested this cycle
    if (scn.type === "oroshi") { taikoOroshi(now); return; }
    if (arc < 0.3) { pulse.active = false; afterRaw("taiko", now, 3 + R.next() * 3, taikoPulse); return; }   // silent in jo — no grid to lock to
    // 逸脱 遅/弛 (critic W1 r1, item 1): the kit dilates with the cycle, and so
    // does the GRID it publishes — otherwise the strings magnetize to a pulse
    // that never left home and a glacial cycle keeps a brisk heartbeat.
    var tmul = farTimeMul("taiko", now);
    // 逸脱 多: a polymetric kit does NOT ride the arc. Three meters are only
    // audible against a tatum that holds still — measured, letting the tempo
    // climb from 50 to 140 bpm across a cycle blurred each drum's own period
    // into the next and the periodicity share barely left its floor. So under
    // 多 the kit is a machine at a fixed pulse (it still dilates with 遅 and
    // 弛, which move the whole world), and the arc is spent on density instead.
    var beat = (farPoly ? 60 / 74 : 60 / (50 + arc * 90)) * tmul, bpm = 60 / beat, t = now + 0.05;
    pulse.bpm = bpm; pulse.beat = beat; pulse.anchor = t; pulse.active = true;   // publish the grid — the ensemble magnetizes to this
    var kyu = arcPhase(now) === "kyū";
    var festival = !!(visitActive && visitActive.name === "the festival" && now < visitActive.until);
    if (festival) { beat = Math.min(beat, 60 / 96 * tmul); bpm = 60 / beat; pulse.bpm = bpm; pulse.beat = beat; }   // 祭 drives, but still inside the cycle's own time
    var kind = kyu || festival || (arc > 0.62 && R.next() < 0.5) ? "matsuri" : "ji";
    var res = taikoPattern(t, kind, beat, festival ? 1 : 0.55 + arc * 0.45);
    // KAKEGOE — the crew calling time to nobody, through the broken PA
    var kk = getLayerParam("taiko", "kakegoe", 0.5);
    if (kind === "matsuri" && R.next() < kk * (festival ? 0.6 : kyu ? 0.35 : 0.15) && !signalUp(t)) { paKakegoe(t - 0.12); emitEvent({ cat: "pa", label: "掛け声 kakegoe", detail: festival ? "祭" : arcPhase(now) }, now); }
    t = res.end;
    if (res.rows) {                              // 逸脱 多: one line per drum, each in its own meter
      for (var dn in res.rows) emitEvent({ cat: "taiko", label: "地 " + res.rows[dn].join(""), detail: Math.round(bpm) + "bpm · " + dn + " · 多 " + res.meters }, now);
    } else emitEvent({ cat: "taiko", label: kind === "matsuri" ? "祭 " + res.pat : "地 " + res.pat, detail: Math.round(bpm) + "bpm" }, now);
    var rest = (2 + R.next() * 4) * (1 - arc * 0.7) * (festival ? 0.25 : 1) / trimOf("taiko");
    afterSpan("taiko", now, (t - now) + rest * farTimeMul("taiko", now), taikoPulse);
  }

  // 颪 OROSHI — the accelerating roll into the kyū (the ha's last sub-scene):
  // a run of strokes whose interval shrinks across the roll, the grid
  // published at the roll's last interval so the ensemble's magnet keeps
  // something steady to pull to.
  function taikoOroshi(now) {
    // ONE roll spanning the rest of the scene: strokes whose interval shrinks
    // linearly from `from` to `to` so the sum of intervals fills the time.
    var remain = Math.max(4, scn.startT + scn.durS - now - 0.3);
    var otm = farTimeMul("taiko", now);           // 逸脱 遅/弛: the roll accelerates in the cycle's own time
    var from = (0.5 + S.taiko.rnd(-0.06, 0.06)) * otm, to = (0.085 + S.taiko.rnd(-0.01, 0.01)) * otm;
    var n = Math.max(8, Math.round(remain / ((from + to) / 2))), t = now + 0.05;
    for (var i = 0; i < n; i++) {
      taikoHit(t, i % 4 === 0 || i >= n - 3, (i % 4 === 0 || i >= n - 3) ? "odaiko" : "shime");   // the roll on the shime, the accents on the ō-daiko
      t += from + (to - from) * (i / (n - 1));
    }
    pulse.bpm = 60 / to; pulse.beat = to; pulse.anchor = t; pulse.active = true;
    emitEvent({ cat: "taiko", label: "颪 oroshi", detail: n + " strokes over " + Math.round(t - now) + "s · " + Math.round(1000 * from) + "→" + Math.round(1000 * to) + " ms" }, now);
    afterSpan("taiko", now, (t - now) + S.taiko.rnd(0.6, 1.6) * farTimeMul("taiko", now), taikoPulse);
  }

  // ==========================================================================
  // NOISE 雑音 — japanoise texture (arc-driven walls of grit)
  // ==========================================================================
  // Sparse, swelling beds of filtered/crushed noise that grow with the arc —
  // gentle hiss in jo, scraping walls in kyū. Routed through the distortion bus.
  // A JAPANOISE VOCABULARY (Phase 3), drawn per scene and by cycle kind:
  //   wall     — the existing filtered-noise swell (the kyū's wall)
  //   screech  — a bandpass in a GAIN-BUDGETED feedback loop (delay 4–8 ms →
  //              bandpass → 0.9 → back): a bandpass biquad's peak gain is 1 at
  //              its centre for any Q, so 0.9 IS the loop gain; the centre
  //              sweeps and the loop rings — feedback squeal, never runaway
  //   static   — bit-crushed: noise through a 12-step waveshaper staircase
  //   rumble   — contact-mic: a low saw at half the sub root through the grit
  //              bus with a slow amplitude LFO
  // The colour of the wall's filter follows the weather's gritColor.
  var NOISE_KIND_W = {
    ordinary:  [["wall", 4], ["screech", 1], ["static", 1.5], ["rumble", 1.5]],
    storm:     [["wall", 4], ["screech", 3], ["static", 1.5], ["rumble", 1]],
    broadcast: [["wall", 2], ["screech", 0.5], ["static", 4], ["rumble", 1]],
    drift:     [["wall", 1.5], ["screech", 0.3], ["static", 0.5], ["rumble", 3]],
    silence:   [["wall", 1], ["screech", 0.2], ["static", 0.5], ["rumble", 2]],
    rite:      [["wall", 3], ["screech", 0.6], ["static", 1], ["rumble", 2]],
  };
  var noiseBodyForScene = null, noiseBodyScene = null;
  function noiseBody() {
    var key = cyc.n + ":" + scn.type + ":" + scn.startT;
    if (noiseBodyScene !== key) { noiseBodyScene = key; noiseBodyForScene = S.noise.pickW(NOISE_KIND_W[cyc.kind] || NOISE_KIND_W.ordinary); }
    return noiseBodyForScene;
  }
  var crushCurve = null;
  var liveRings = [];                              // screech loops in flight — torn down by their lane event, or by stop()
  function ringDown(nodes) { for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} } var k = liveRings.indexOf(nodes); if (k >= 0) liveRings.splice(k, 1); }
  function noiseEvent(t) {
    if (!playing) return;
    var c = ctx, now = t, out = lg("noise");
    var arc = getArc(now);
    var density = getLayerParam("noise", "density", 0.4);
    var color = getLayerParam("noise", "color", 0.5);
    var crush = getLayerParam("noise", "crush", 0.4);
    var wx = wxAt(now), body = noiseBody();
    var dur = 2 + S.noise.next() * 5 + arc * 4;
    var peak = (0.05 + arc * 0.22) * (0.4 + density) * K().noiseMul;   // the storm's wall, the drift's hiss
    // ------------------------------------------------------------------
    // 騒 NOISE LEADS (W3). "The japanoise vocabulary becomes the soloist,
    // claims the air, and the melodic voices become the texture behind it."
    //
    // The soloist is made by TAKING THE AIR, not by turning the noise up. The
    // master loudness ceiling stayed hard in §10 while the roughness gate was
    // tiered, so a departure that leads by getting louder is a departure that
    // fails a gate the owner deliberately did not move. The melodic voices
    // standing down is what frees the room, and it is the same seam the
    // broadcast uses to hold the air — proven, and already watched by the
    // harness's "melodic notes inside a hold" count.
    //
    // ONE VOICE IS LEFT PLAYING, drawn on the departure's own sub-fork. "The
    // melodic voices become the texture behind it" is not "the melodic voices
    // stop": a single body murmuring under a fifty-second wall is the texture,
    // and five bodies silent is just a noise track.
    //
    // The decision is a time-keyed sub-fork of the far stream, the same idiom
    // 凍 uses, so it costs the far stream nothing and no draw moves.
    var nlead = null;
    if (farNlead) {
      var NR = S.far.fork("nlead:" + Math.round(now));
      var takes = NR.chance(farNlead.share);                       // drawn unconditionally: the fork's position never depends on the outcome
      var spare = MELODIC_LANES[Math.floor(NR.next() * MELODIC_LANES.length) % MELODIC_LANES.length];
      var stretch = NR.rnd(0.7, 1.3);
      if (takes) nlead = { spare: spare, holdS: farNlead.holdS * stretch, bite: farNlead.bite || 0 };
    }
    if (nlead) {
      dur = nlead.holdS;
      // THE LEVEL LIFT IS ENTIRELY THE TIER'S. At and below 0.70 — the band
      // §10 left on the tripwire as ruled — this is ×1 exactly: 騒 leads there
      // by taking the air and by nothing else, which is a change in who is
      // speaking rather than in how loud the room is. The lift arrives only
      // across the loosened band and is full where there is no roughness gate
      // at all. The master ceiling is unmoved either way; the headroom comes
      // from the four voices that stood down.
      peak *= 1 + 0.5 * nlead.bite;
      for (var nli = 0; nli < MELODIC_LANES.length; nli++) {
        if (MELODIC_LANES[nli] === nlead.spare) continue;
        airHoldAdd(MELODIC_LANES[nli], now - 0.2, now + dur + 0.4, "nlead");
      }
      emitEvent({ cat: "far", label: "騒 the noise takes the lead", detail: body + " · " + dur.toFixed(0) + "s · " + nlead.spare + " left behind it" }, now);
    }
    if (body === "screech" && arc > 0.3) {
      // excite a short burst into the loop; the centre sweeps up then down
      var nz0 = noiseSource(), exg = c.createGain(), dl = c.createDelay(0.05), bpq = c.createBiquadFilter(), fb = c.createGain(), og = c.createGain();
      dl.delayTime.setValueAtTime(0.004 + S.noise.next() * 0.004, now);
      bpq.type = "bandpass"; bpq.Q.setValueAtTime(4, now);
      var f0 = 700 + S.noise.next() * 600, f1 = f0 * (2 + S.noise.next() * 2);
      bpq.frequency.setValueAtTime(f0, now); bpq.frequency.linearRampToValueAtTime(f1, now + dur * 0.6); bpq.frequency.linearRampToValueAtTime(f0 * 0.8, now + dur);
      fb.gain.setValueAtTime(0.9, now);                                  // the loop gain, exactly
      nz0.connect(exg); exg.connect(dl); dl.connect(bpq); bpq.connect(fb); fb.connect(dl); bpq.connect(og); og.connect(screechBus || out);
      PJ.Voice.env(exg.gain, now, [[0.02, 0.4], [Math.max(0.05, dur * 0.5), 0.15], [0.05, 0]]);   // the excitation, then the loop rings
      PJ.Voice.env(og.gain, now, [[dur * 0.3, peak * 0.7], [dur * 0.4, peak * 0.5], [dur * 0.3, 0]]);
      nz0.start(now, S.noise.next() * 10); nz0.stop(now + dur + 0.1);
      // TEAR THE LOOP DOWN: a node in a live cycle is never collected — the
      // delay and biquad would render forever. Close the feedback, then
      // disconnect the whole ring on the noise lane once it has rung out
      // (0.9^n: −60 dB in ~65 trips ≈ 0.5 s).
      var tEnd = now + dur + 1.5;
      fb.gain.setValueAtTime(0.9, tEnd - 0.3); fb.gain.linearRampToValueAtTime(0, tEnd);
      var ring = [nz0, exg, dl, bpq, fb, og]; liveRings.push(ring);
      lane("noise").at(tEnd + 0.2, function () { ringDown(ring); });
      if (arc > 0.4) emitEvent({ cat: "noise", label: "screech", detail: arcPhase(now) + " · " + Math.round(f0) + "→" + Math.round(f1) + " Hz" }, now);
    } else if (body === "static") {
      if (!crushCurve) { crushCurve = new Float32Array(1024); for (var ci = 0; ci < 1024; ci++) { var cx = (ci / 1023) * 2 - 1; crushCurve[ci] = Math.round(cx * 6) / 6; } }
      var nz1 = noiseSource(), ws = c.createWaveShaper(), bp1 = c.createBiquadFilter(), g1 = c.createGain();
      ws.curve = crushCurve;
      bp1.type = "bandpass"; bp1.frequency.setValueAtTime(1200 + wx.gritColor * 2500, now); bp1.Q.setValueAtTime(0.8, now);
      nz1.connect(ws); ws.connect(bp1); bp1.connect(g1); g1.connect(out);
      var sd = Math.min(dur, 1.5 + S.noise.next() * 2), sp = peak * 0.6;
      // gated bursts: the carrier drops in and out
      var segs = [], tt = 0, on = true;
      while (tt < sd - 0.1) { var seg = 0.05 + S.noise.next() * 0.25; segs.push([seg, on ? sp : 0]); tt += seg; on = !on; }
      segs.push([0.05, 0]);
      PJ.Voice.env(g1.gain, now, segs);
      nz1.start(now, S.noise.next() * 10); nz1.stop(now + sd + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "static", detail: arcPhase(now) }, now);
    } else if (body === "rumble") {
      var ro = c.createOscillator(), rg = c.createGain(), rl = c.createBiquadFilter(), lfo = c.createOscillator(), lg2 = c.createGain();
      ro.type = "sawtooth"; ro.frequency.setValueAtTime(subRoot() / 2, now);
      rl.type = "lowpass"; rl.frequency.setValueAtTime(140, now); rl.Q.setValueAtTime(0.7, now);
      lfo.type = "sine"; lfo.frequency.setValueAtTime(0.3 + S.noise.next() * 0.7, now);
      lg2.gain.setValueAtTime(0.5, now); lfo.connect(lg2);
      var rv = c.createGain(); rv.gain.setValueAtTime(0.5, now); lg2.connect(rv.gain);   // amplitude LFO (0..1 around 0.5)
      ro.connect(rl); rl.connect(rv); rv.connect(rg); rg.connect(out);
      var rp = peak * 0.5;
      PJ.Voice.env(rg.gain, now, [[dur * 0.4, rp], [dur * 0.3, rp], [dur * 0.3, 0]]);
      ro.start(now); ro.stop(now + dur + 0.1); lfo.start(now); lfo.stop(now + dur + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "rumble", detail: arcPhase(now) }, now);
    } else {
      var nz = noiseSource();
      var bp = c.createBiquadFilter();
      bp.type = arc > 0.6 ? "bandpass" : "lowpass";
      var fc = (200 + color * 3000 + arc * 2500) * (0.7 + 0.6 * wx.gritColor);
      bp.frequency.setValueAtTime(fc, now); bp.Q.setValueAtTime(0.5 + crush * 8 + arc * 6, now);
      // sweep the filter for a scraping motion
      bp.frequency.linearRampToValueAtTime(fc * (0.5 + S.noise.next()), now + dur);
      var g = c.createGain(); nz.connect(bp); bp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      nz.start(now, S.noise.next() * 10); nz.stop(now + dur + 0.1);
      if (arc > 0.4) emitEvent({ cat: "noise", label: "wall", detail: arcPhase(now) }, now);
    }

    var gap = (6 + S.noise.next() * 10) * (1 - arc * 0.6) / (0.4 + density) / K().noiseMul;
    // 騒: a set, not an interjection — the next wall begins before this one has
    // finished. Keyed to the gesture rather than the ordinary gap, because a
    // 6–16 s gap under a fifty-second wall would stack walls without bound.
    if (nlead) gap = Math.max(2, dur * 0.8);
    after("noise", now, gap, noiseEvent);
  }

  // ==========================================================================
  // THE PA 放送 (Phase 3) — the station's announcements. A formant voice in
  // the Kolob still-small-voice manner: a sawtooth, PRE-ATTENUATED, through
  // F1/F2 bandpasses, gated into wordless syllables with a reciting-tone
  // drift, decaying into static (the carrier drops out; hiss takes over).
  // Speaks in broadcast cycles, and once, rarely, in a KIRU's hush. Never
  // claims the air — it is the station, not a player. Kakegoe shouts ride
  // the same body, short and hard. Through the far wall like the koto.
  // ==========================================================================
  var PA_VOWELS = [[320, 850], [430, 1100], [540, 1450], [660, 1800], [790, 2050]];
  function paSpeak(t, dur, opts) {
    var c = ctx, R = S.pa; opts = opts || {};
    var presence = getLayerParam("pa", "presence", 0.5), staticAmt = getLayerParam("pa", "static", 0.5);
    var out = panAt("pa", opts.pan != null ? opts.pan : (R.next() * 2 - 1) * 0.3);
    var f0 = farWarp(field.snap(foldInto(field.tonicHz * 1.5, 150, 300)));   // the reciting tone: a scale tone near the tonic's fifth (逸脱 撓: the input is the raw tonic, so warp on the way out only)
    var o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.985 + R.next() * 0.035), t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(f0 * 0.985, t + dur);
    var pre = c.createGain(); pre.gain.setValueAtTime(0.6, t);         // −4.4 dB into unity-peak formants (they pass little of a 150–300 Hz saw)
    o.connect(pre);
    var f1 = c.createBiquadFilter(); f1.type = "bandpass"; f1.Q.setValueAtTime(5, t);
    var f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.Q.setValueAtTime(6, t);
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(1400, t);
    var f1g = c.createGain(); f1g.gain.setValueAtTime(1, t);
    var f2g = c.createGain(); f2g.gain.setValueAtTime(0.6, t);
    var gate = c.createGain(), og = c.createGain();
    pre.connect(f1); f1.connect(f1g); f1g.connect(gate);
    pre.connect(f2); f2.connect(f2g); f2g.connect(gate);
    // a dry BODY beside the formants (critic, Phase 3 r2): the formants pass
    // little of a 150–300 Hz saw; a lowpassed dry path gives the voice a chest
    var body = c.createBiquadFilter(); body.type = "lowpass"; body.frequency.setValueAtTime(900, t); body.Q.setValueAtTime(0.7, t);
    var bodyG = c.createGain(); bodyG.gain.setValueAtTime(0.2, t);
    pre.connect(body); body.connect(bodyG); bodyG.connect(gate);
    gate.connect(og); og.connect(out);
    gate.gain.setValueAtTime(0, t);
    var sylRate = opts.shout ? 4 : 2 + R.next() * 1.5, st = t + 0.03, end = t + dur - (opts.shout ? 0.02 : 0.4);
    var pv1 = 500, pv2 = 1400;
    while (st < end) {
      var syl = 1 / (sylRate * (0.8 + R.next() * 0.45));
      var v = PA_VOWELS[Math.floor(R.next() * PA_VOWELS.length)];
      f1.frequency.setValueAtTime(pv1, st); f1.frequency.linearRampToValueAtTime(v[0], st + 0.035);   // short anchored ramps, never setTarget on a biquad
      f2.frequency.setValueAtTime(pv2, st); f2.frequency.linearRampToValueAtTime(v[1], st + 0.035);
      pv1 = v[0]; pv2 = v[1];
      var on = Math.max(0.03, syl * 0.24), hold = syl * (0.4 + R.next() * 0.22);
      gate.gain.setValueAtTime(0, st);
      gate.gain.linearRampToValueAtTime(1, st + on);
      gate.gain.linearRampToValueAtTime(0, st + on + hold);
      st += syl + (!opts.shout && R.next() < 0.2 ? 0.3 + R.next() * 0.8 : 0);    // long breath commas
    }
    var peak = (opts.shout ? 0.8 : 0.90) * presence * (opts.gain || 1);   // target −18 ± 3 dB rel master while speaking; the shout capped at 0.8
    if (opts.shout) PJ.Voice.env(og.gain, t, [[0.02, peak], [Math.max(0.05, dur - 0.1), peak * 0.8], [0.08, 0]]);
    else PJ.Voice.env(og.gain, t, [[0.5, peak], [Math.max(0.4, dur * 0.55 - 0.5), peak * 0.9], [dur * 0.45, 0]]);   // decays into the static below
    o.start(t); o.stop(t + dur + 0.3);
    // the carrier fails: static rises as the voice fades
    if (sharedNoiseBuf && staticAmt > 0.02) {
      var nz = noiseSource(), hp = c.createBiquadFilter(), ng = c.createGain();
      hp.type = "highpass"; hp.frequency.setValueAtTime(2000 + R.next() * 1500, t);
      nz.connect(hp); hp.connect(ng); ng.connect(out);
      var sp = 0.03 * staticAmt;
      if (opts.shout) PJ.Voice.env(ng.gain, t, [[0.01, sp], [dur, sp * 0.5], [0.05, 0]]);
      else PJ.Voice.env(ng.gain, t, [[dur * 0.5, sp * 0.3], [dur * 0.3, sp], [dur * 0.2 + 0.4, 0]]);
      nz.start(t, R.next() * 10); nz.stop(t + dur + 0.5);
    }
    emitNote("pa", f0, t, dur);
  }
  function paKakegoe(t) { paSpeak(t, 0.28 + S.pa.next() * 0.16, { shout: true, pan: 0.25 }); }
  function startPA(t) { if (playing) paCycle(t); }
  function paCycle(t0) {
    if (!playing) return;
    var now = t0, R = S.pa;
    if (cyc.kind !== "broadcast") { afterRaw("pa", now, 15 + R.next() * 10, paCycle); return; }   // only a broadcast cycle announces
    if (signalUp(now + 0.05)) { afterRaw("pa", now, 8, paCycle); return; }                          // S1 (critic r1): the tannoy does not talk over a signal — try again after the hold (no draw)
    var dur = 4 + R.next() * 5;
    paSpeak(now + 0.05, dur, {});
    emitEvent({ cat: "pa", label: "放送 announcement", detail: dur.toFixed(1) + "s · " + arcPhase(now) }, now);
    afterSpan("pa", now, dur + (30 + R.next() * 50) * farTimeMul("pa", now), paCycle);
  }

  // ==========================================================================
  // AMBIENT — quirky events (derelict orbital station incidentals)
  // ==========================================================================
  function ambBonsho(t, opts) {                    // temple bell (bonshō) — deep, long, inharmonic
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3);
    if (opts && opts.halo && haloSend) {             // the hull (the koto's strings) ringing in sympathy
      var hs = ctx.createGain(); hs.gain.setValueAtTime(0.5, t); hs.connect(haloSend); out = (function (dest, tap) { var g = ctx.createGain(); g.gain.setValueAtTime(1, t); g.connect(dest); g.connect(tap); return g; })(out, hs);
    }
    var base = S.ambient.next() < 0.5 ? subRoot() : subFifth();
    var partials = [{ m: 1, a: 0.08, d: 6 }, { m: 2.7, a: 0.04, d: 4 }, { m: 5.2, a: 0.02, d: 2.4 }, { m: 8.1, a: 0.012, d: 1.5 }];
    partials.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(base * p.m, t); o.detune.setValueAtTime((S.ambient.next() * 2 - 1) * 5, t);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p.a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      o.start(t); o.stop(t + p.d + 0.1);
    });
  }
  function ambFurin(t) {                            // wind-chime (fūrin) — a few tiny high pings
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.6);
    var n = 2 + Math.floor(S.ambient.next() * 3), tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, scaleIndexOf(8) + Math.floor(S.ambient.next() * 4));
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq * 2, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.start(tt); o.stop(tt + 1.5); tt += 0.12 + S.ambient.next() * 0.2;
    }
  }
  function ambSuikinkutsu(t) {                      // water drip resonance (suikinkutsu)
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.5);
    var f = SCALE[Math.min(SCALE.length - 1, scaleIndexOf(7) + Math.floor(S.ambient.next() * 5))].freq * 2;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
  }
  function ambGlitch(t) {                           // digital glitch / static burst (the 3042 grit)
    if (!sharedNoiseBuf) return;
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.8);
    var n = 3 + Math.floor(S.ambient.next() * 6), tt = t;
    for (var i = 0; i < n; i++) {
      var nz = noiseSource();
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(800 + S.ambient.next() * 4000, tt);
      var g = ctx.createGain(); nz.connect(hp); hp.connect(g); g.connect(out);
      var d = 0.02 + S.ambient.next() * 0.05;
      g.gain.setValueAtTime(0.05, tt); g.gain.setValueAtTime(0.0001, tt + d);
      nz.start(tt, S.ambient.next() * 10); nz.stop(tt + d + 0.02); tt += d + S.ambient.next() * 0.06;
    }
  }
  function ambDistantTaiko(t) {                     // a lone distant drum hit
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.4);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.6);
    if (sharedNoiseBuf) {
      var nz = noiseSource(); var bp = ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.setValueAtTime(400, t);
      var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(out);
      ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      nz.start(t, S.ambient.next() * 10); nz.stop(t + 0.2);
    }
  }
  function ambKotoSweep(t) {                        // a fast koto-ish glissando flourish
    var out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.5);
    var start = scaleIndexOf(3), n = 6, tt = t;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(SCALE.length - 1, start + i);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(SCALE[idx].freq, tt);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.045, tt + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
      o.start(tt); o.stop(tt + 0.65); tt += 0.06;
    }
  }
  function ambCommsVox(t) {                         // malfunctioning comms — stuttered vowel-formant glitch
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.6);
    var carrier = c.createOscillator(); carrier.type = "sawtooth"; carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(2)].freq * 2, t);
    var vca = c.createGain(); vca.connect(out); vca.gain.setValueAtTime(0.0001, t);
    [700, 1100, 2600].forEach(function (ff) { var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(ff, t); bp.Q.setValueAtTime(8, t); carrier.connect(bp); bp.connect(vca); });
    var syl = 3 + Math.floor(S.ambient.next() * 4), tt = t;
    for (var i = 0; i < syl; i++) {
      var d = 0.05 + S.ambient.next() * 0.12;
      carrier.frequency.setValueAtTime(SCALE[scaleIndexOf(Math.floor(S.ambient.next() * 5))].freq * 2, tt);
      vca.gain.setValueAtTime(0.05, tt); vca.gain.setValueAtTime(0.0001, tt + d);
      tt += d + 0.04 + S.ambient.next() * 0.08;
    }
    carrier.start(t); carrier.stop(tt + 0.1);
    if (sharedNoiseBuf) { var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(2000, t); var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out); ng.gain.setValueAtTime(0.02, t); ng.gain.exponentialRampToValueAtTime(0.0001, tt); nz.start(t, S.ambient.next() * 10); nz.stop(tt + 0.1); }
  }
  function ambGeigerHum(t) {                        // dying machinery — sagging drone + thinning radiation clicks
    var c = ctx, out = panAt("ambient", (S.ambient.next() * 2 - 1) * 0.3), dur = 3 + S.ambient.next() * 3, base = subRoot() / 2;
    [-8, 8].forEach(function (det) {
      var o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(base, t); o.detune.setValueAtTime(det, t); o.frequency.exponentialRampToValueAtTime(base * 0.94, t + dur);
      var g = c.createGain(); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.1);
    });
    if (sharedNoiseBuf) {
      var tt = t + 0.2;
      while (tt < t + dur) {
        var nz = noiseSource(); var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(3000, tt);
        var ng = c.createGain(); nz.connect(hp); hp.connect(ng); ng.connect(out);
        ng.gain.setValueAtTime(0.04, tt); ng.gain.setValueAtTime(0.0001, tt + 0.01);
        nz.start(tt, S.ambient.next() * 10); nz.stop(tt + 0.03);
        tt += 0.05 + S.ambient.next() * 0.3 * (1 + ((tt - t) / dur) * 3);   // clicks thin out as it dies
      }
    }
  }
  var AMBIENT_POOL = [
    { fn: ambBonsho,       w: 4, name: "Temple bell" },
    { fn: ambFurin,        w: 4, name: "Wind chime" },
    { fn: ambGlitch,       w: 4, name: "Static glitch" },
    { fn: ambSuikinkutsu,  w: 3, name: "Water drip" },
    { fn: ambDistantTaiko, w: 3, name: "Distant taiko" },
    { fn: ambKotoSweep,    w: 2, name: "Koto sweep" },
    { fn: ambCommsVox,     w: 2, name: "Comms vox" },
    { fn: ambGeigerHum,    w: 3, name: "Geiger hum" },
  ];
  // The kind gates the pool: a broadcast cycle is static and comms; drift is
  // water, bells and chimes; silence keeps the bell and little else; the
  // storm crackles. (Multipliers on the flat weights above.)
  var AMBIENT_KIND_W = {
    broadcast: { "Static glitch": 3, "Comms vox": 5, "Geiger hum": 2, "Koto sweep": 0.5 },
    drift:     { "Water drip": 2, "Temple bell": 1.5, "Wind chime": 2, "Static glitch": 0.5 },
    silence:   { "Temple bell": 2, "Wind chime": 0.6, "Static glitch": 0.4, "Distant taiko": 0.4, "Koto sweep": 0.3, "Comms vox": 0.5, "Geiger hum": 0.6 },
    storm:     { "Static glitch": 2, "Distant taiko": 2, "Geiger hum": 1.5, "Water drip": 0.5 },
    rite:      { "Temple bell": 2 },
  };
  function startAmbient(t) { if (playing) ambientEvent(t); }
  function ambientEvent(t) {
    if (!playing) return;
    var now = t, total = 0, i, kw = AMBIENT_KIND_W[cyc.kind] || {};
    function w(en) { return en.w * (kw[en.name] != null ? kw[en.name] : 1); }
    for (i = 0; i < AMBIENT_POOL.length; i++) total += w(AMBIENT_POOL[i]);
    var r = S.ambient.next() * total, entry = AMBIENT_POOL[0];
    for (i = 0; i < AMBIENT_POOL.length; i++) { r -= w(AMBIENT_POOL[i]); if (r <= 0) { entry = AMBIENT_POOL[i]; break; } }
    try { entry.fn(now + 0.05); } catch (e) {}
    emitEvent({ cat: "ambient", label: entry.name }, now);
    var gap = (12 + S.ambient.next() * 22) * (1 - getArc(now) * 0.35) * K().ambGap;
    after("ambient", now, gap, ambientEvent);
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (playing) return;
    playing = true;
    if (bg) bg.started();
    // one fresh world per play, all of it derived from the seed
    forkStreams();
    clock.start();
    var t0 = clock.now();
    arcStartTime = t0;
    cyc.n = -1; cyc.seating = null; scn.type = null; pendingPlan = null; cyclesSinceSea = 0;
    field.modulate({ tonicHz: TONIC_HZ, mode: { name: "hirajoshi", steps: MODES.hirajoshi.offsets } }); currentMode = "hirajoshi"; rebuildScale();   // every play opens at home
    pulse.active = false;                        // no grid until the taiko speaks
    lastAitake = null; visitActive = null; cyc.visit = null; cyc.visit2 = null; airHold = {}; airHoldDenials = 0;
    Motif.reset();                               // the Conductor's first performance builds cycle 0's working set
    farSaid = null;                              // quiet until the night has named itself
    farDraw();                                   // 逸脱 tonight's distance from home — one draw, before any body sounds
    farPitchSetup(t0);                           // …and what its tuning departures do; every value already seeded
    farTimeSetup(t0); farPlanN = 0; farCycleRate = 1;   // …and what its time departures do
    // The opening field, re-read through tonight's tuning: 減 narrows the
    // semitone pairs (the opening modulate above goes straight to MODES, not
    // through setMode, so it needs saying here), 撓 restretches the octave.
    // Cycle 0's own setMode does both again a moment later; this is only so
    // the drones that start before it are already in the night's world.
    if (farNight.dep.meri) field.modulate({ mode: { name: currentMode, steps: farMeriSteps(MODES[currentMode].offsets) } });
    if (farWarpK !== 1 || farNight.dep.meri) rebuildScale();
    emitEvent({ cat: "mode", label: "▶ play", detail: "seed " + seed }, t0);
    if (!farNight.home) {
      // The night names itself FIRST and its departures introduce themselves
      // after — the setups run before this line, so without holding their
      // lines back the log opened with three departures explaining themselves
      // and only then said what night it was. The story has an order.
      emitEvent({ cat: "far", label: farNight.kana + " " + farNight.name, detail: farNight.detail }, t0);   // the VFD tag already says 逸脱
      farSaid = {};
      var sayIds = ["sag", "ear", "meri", "bito", "spiral", "vari", "canon", "hetero",
                    "poly", "hocket", "erode", "mainv", "metal", "rev"];
      for (var syi = 0; syi < sayIds.length; syi++) farSay(sayIds[syi], t0);
    }
    masterGain.gain.cancelScheduledValues(t0);
    masterGain.gain.setValueAtTime(masterVolume, t0);
    for (var i = 0; i < LAYERS.length; i++) { applyLayerGain(LAYERS[i]); lane(LAYERS[i]).rate = layerRate[LAYERS[i]] || 1; }
    // THE AIR and THE CONDUCTOR — fresh per play, on their own streams. The
    // conductor starts FIRST so cycle 0's mode, kind and seating are drawn
    // before any body sounds (the shō's opening cluster is in the cycle's mode).
    airT = t0;
    air = PJ.Air.create({ clock: airClock, rng: S.air, limit: airLimitNow, overlapChance: airOverlapNow });
    conductor = PJ.Conductor.create({ clock: clock, rng: S.conductor, dramaturgy: DRAM, onEvent: onConductorEvent,
      jointTools: function () { return { ctx: ctx, rng: S.joints, field: field }; }, air: air, seed: seed });
    conductor.start();
    // drones first; voices and grit enter in turn (jo opening)
    subDroneCycle(t0);
    shoCycle(t0);
    after("shakuhachi", t0, 4, startShakuhachi);
    after("koto", t0, 10, startKoto);
    after("shamisen", t0, 16, startShamisen);
    after("taiko", t0, 22, startTaiko);
    after("hichiriki", t0, 30, startHichiriki);
    after("pa", t0, 40, startPA);
    after("biwa", t0, 26, startBiwa);
    after("noise", t0, 8, noiseEvent);
    after("ambient", t0, 7, startAmbient);
    lane("form").every(formPulse);
    roomReset(t0);
    lane("room").every(roomPulse);               // Phase M: the crew listens for who speaks
  }
  // The form pulse (0.7 s, on its own lane): crossfades the dry-grit send up
  // as the intensity rises — the kyū gets close + abrasive. Cycle boundaries
  // and the KIRU are the Conductor's now (exact audio times).
  function formPulse(t) {
    if (!playing) return null;
    if (dryGritGain) dryGritGain.gain.setTargetAtTime(farGroove && farGroove.grit != null ? farGroove.grit : getArc(t) * 0.7, t, 0.5);   // 逸脱 崩: while the station is stuck, the groove sets the crud
    // the grit's colour: equal-power crossfade of the two curves by the
    // weather's gritColor (anchored ramps every pulse — the weather moves
    // ≤ 0.026/s, so each chord is a hair)
    if (gritBlendA && gritBlendB) {
      // Phase M: complementary AMPLITUDE law (1 − x, x), not cos/sin — the two
      // curves shape the same signal, so their outputs are correlated and an
      // equal-power law would bump the bus +3 dB at mid-blend; with linear
      // weights the sum's level holds and only the colour moves.
      var gc = wxAt(t + 0.7).gritColor;
      gritBlendA.gain.setValueAtTime(gritBlendA.gain.value, t); gritBlendA.gain.linearRampToValueAtTime(1 - gc, t + 0.7);
      gritBlendB.gain.setValueAtTime(gritBlendB.gain.value, t); gritBlendB.gain.linearRampToValueAtTime(gc, t + 0.7);
    }
    return 0.7;
  }
  // 斬 KIRU — a final taiko roll + noise swell, then a sudden cut to a hush; a
  // lone temple bell rings in the silence (ma); the voices return as a new jo.
  // Severity rides the meta-curve: at the trough a passing hush (shallow dip,
  // ~3 s of ma, one bell); at the peak a devastating cut (down to 0.08 of
  // master, up to ~9 s of held silence, the bell tolling twice).
  // 斬 KIRU — the cut (Phase 4: Sycorax's mechanics). A final taiko roll +
  // noise swell, then the LANDSCAPE (grit bus, shō, ambient) drops on its own
  // cut gains — never the master — to a hush; the melodic voices stop MID-
  // GESTURE by scheduling (their lanes' pending phrases die where they stand,
  // their sounding tails and the rooms ring into the silence) and re-arm
  // after the hush; the hush is INHABITED: a lone bonshō always, the broken
  // PA rarely, and the koto's halo (never cut) ringing out. Severity rides
  // the tide: at the trough a passing hush, at the peak a devastating cut,
  // the bell tolling twice. In a silence or dead-station cycle the KIRU cuts
  // nothing: no roll, no swell — the hush deepens and the bell speaks.
  var MELODIC_LANES = ["shakuhachi", "koto", "shamisen", "hichiriki", "biwa"];
  var MELODIC_RESTART = { shakuhachi: function (t) { shakuhachiPhrase(t); }, koto: function (t) { kotoPhrase(t); }, shamisen: function (t) { shamisenPhrase(t); },
    hichiriki: function (t) { hichirikiPhrase(t); }, biwa: function (t) { biwaPhrase(t); } };
  function cutEnvelope(g, t, dip, hold) {
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t + 0.52);
    g.linearRampToValueAtTime(dip, t + 0.58);
    g.setValueAtTime(dip, t + 0.6 + hold);
    g.linearRampToValueAtTime(1, t + 0.6 + hold + 1.5);
  }
  function kiru(t) {
    if (!ctx || !playing) return;
    var sev = metaSeverity();
    var dip = 0.3 - 0.22 * sev;                                           // hush depth: 0.3 → 0.08 of the landscape
    var hold = 3 + 6 * sev;                                               // held silence: ~3 s → ~9 s
    // §11.3's hush gate needs the hush to be a FACT and not an inference.
    // Signals already never fire in a KIRU or its hush — the visitation
    // planner refuses them and the harness counts it as "near a KIRU 0" — so
    // a sea change riding a signal's tune-in inherits that guard. But
    // inheriting a guard is not the same as having one, and the owner named
    // this gate explicitly, so the moment is recorded and seaToward tests it.
    kiruAt = t; kiruHushUntil = t + hold + 2;
    var twice = sev > 0.45 && S.form.chance(0.4 + sev * 0.5);            // the bell tolls again near the peak
    var paHush = S.form.chance(0.2);                                      // unconditional draws
    var cutsSomething = cyc.kind !== "silence" && cyc.seating && cyc.seating.named !== "dead station";
    if (cutsSomething) {
      for (var i = 0; i < 6; i++) taikoHit(t + i * 0.08, i === 5, i === 5 ? "odaiko" : "shime");   // final roll
      var nz = noiseSource(), bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.setValueAtTime(1200, t); bp.frequency.linearRampToValueAtTime(4500, t + 0.5); bp.Q.setValueAtTime(2, t);
      var ng = ctx.createGain(); nz.connect(bp); bp.connect(ng); ng.connect(lg("noise"));
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28, t + 0.5); ng.gain.setValueAtTime(0.0001, t + 0.56);
      nz.start(t); nz.stop(t + 0.6);
    }
    // the cut: the landscape's three gains, one schedule each — the master is untouched
    if (cutGrit) { cutEnvelope(cutGrit.gain, t, dip, hold); cutEnvelope(cutSho.gain, t, dip, hold); cutEnvelope(cutAmb.gain, t, dip, hold); if (cutTaiko) cutEnvelope(cutTaiko.gain, t, dip, hold); }
    // the melodic voices stop mid-gesture and re-arm after the hush
    var tBack = t + 0.6 + hold + 1.0;
    for (var li = 0; li < MELODIC_LANES.length; li++) {
      var L = MELODIC_LANES[li];
      try { lane(L).cancelAll(); } catch (e) {}
      lane(L).at(tBack + li * 0.7, guarded(MELODIC_RESTART[L]));
    }
    ambBonsho(t + 0.78, { halo: true });                                  // a lone bell in the ma — the koto's strings hear it
    if (twice) ambBonsho(t + 0.78 + hold * S.form.rnd(0.4, 0.6), { halo: true });   // … and again, deeper into the silence
    if (paHush && cyc.kind !== "silence") { paSpeak(t + 1.6, Math.min(hold - 0.5, 3 + S.pa.next() * 2), { gain: 0.6 }); emitEvent({ cat: "pa", label: "放送 in the hush", detail: "the PA speaks into the ma" }, t + 1.6); }
    emitEvent({ cat: "noise", label: "斬 KIRU", detail: "the cut · severity " + sev.toFixed(2) + " · hush " + dip.toFixed(2) + " · ma " + hold.toFixed(1) + "s" + (twice ? " · the bell twice" : "") + (cutsSomething ? "" : " · cuts nothing") + " · landscape only" }, t);
  }
  // ==========================================================================
  // THE CREW LOWERS ITS VOICE (Phase M — the mix pass, 2026-09)
  // ==========================================================================
  // The owner heard the newer bodies buried. Measured (real audio, per note):
  // the grit bus — the sub-drone through the grit shaper — is ~78 % of the
  // master's power and masks every fundamental below ~400 Hz by 10–25 dB; the
  // shō sits flat from 315 Hz to 1 kHz and is the koto's second masker. So the
  // landscape MAKES ROOM instead of the voices getting louder: while a melodic
  // voice or the PA speaks, the grit bus and the shō (never the ambient
  // events) step back — a duck whose depth belongs to the VOICE (the rare
  // ones, PA / biwa / hichiriki, get the crew's full silence; the koto and the
  // shakuhachi, who speak most of the ha and kyū, a smaller step, so the
  // master's integrated loudness holds within the brief's ±0.7 dB) and to the
  // SCENE (the whole floor in the jo, a hair in the kyū where the wall is the
  // point) — and a shallow peaking notch opens at the speaking register on
  // both. ONE WRITER: emitNote hands roomSpeak the span and pitch of every
  // note the moment it is scheduled (whole phrases arrive seconds ahead);
  // roomPulse, on its own lane every 0.25 s, renders the envelope for the
  // coming window from those spans in five anchored 50 ms chords — attack
  // ~150 ms, release ~600 ms, the notch's centre gliding in log-frequency —
  // and remembers exactly what it wrote, so every anchor is the true value
  // (no .value reads, no setTarget). The pulse draws no randomness and emits
  // nothing: the note stream is untouched; only the envelope's timing can
  // differ by a lookahead between runs.
  var ROOM_VOICES = { shakuhachi: 1.5, koto: 2, shamisen: 2, hichiriki: 2, biwa: 2, pa: 2, broadcast: 2 };   // broadcast (S1): the grit steps back 2 dB (+ the 2 dB notch = the mix pass's 4 dB cap, orchestrator ruling; the reel reads +11–14 dB over the landscape in its band, so no more is needed)          // the grit bus: duck + notch ≤ 4 dB in 150–1200 Hz (orchestrator's cap)
  var ROOM_VOICES_SHO = { shakuhachi: 1.5, koto: 3.5, shamisen: 2.5, hichiriki: 3, biwa: 3, pa: 4, broadcast: 4 };   // the shō: the PA's masker at 0.8–3.2 kHz, so it steps back further for the PA   // the crew's step for each speaker, dB, in the jo (measured: the landscape is 78 % of the master's power, so every dB of duck while a voice speaks is ~0.8 dB of loudness for that time — the budget caps the frequent speakers)
  var ROOM_SCENE = { jo: 1.0, ha: 0.9, "kyū": 0.8, release: 0.8 };                          // jo deepest, kyū shallowest (the ruling); the ha is where the strings live                          // × by phase (the loudness budget: voices speak ~45 % of the jo, ~80 % of the ha, ~95 % of the kyū)
  var ROOM_CARVE_DB = -2, ROOM_Q = 2.0;
  var ROOM_CARVE_KOTO_DB = -4, ROOM_KOTO_DEEP = { jo: 1, ha: 1 };                           // r3 (orchestrator Q5): the koto's notch −4 in the jo and ha (duck 2 + notch 4 = the 6 dB cap for the koto there); kyū and release stay at 4                                                       // the notch at the speaking register: narrow (a critical band) and deeper — it clears the fundamental's band for a fraction of the power a broad duck would spend
  var ROOM_F_LO = 150, ROOM_F_HI = 1200;                                                    // the dip stays inside 150–1200 Hz (the orchestrator's cap)
  var LAND_SHELF_DB = -3;                                                                  // the static shelf above 1.5 kHz on the grit bus and the shō
  var ROOM_PICK = { koto: -4, shamisen: -4, biwa: -4, pa: -6, broadcast: -4 };   // the signal's speech band is the pick band                            // the pick-band dip (1.4–4.5 kHz, above the cap) while a plucked voice or the PA speaks, dB × scene; the PA deeper (critic r2)
  var ROOM_F_HI_SHO = 1600;                                                                // the shō's notch may follow the PA's band centre; the grit's stays inside 150–1200
  var ROOM_GROUP = { koto: 1, shamisen: 1, biwa: 1, hichiriki: 1, pa: 1, shakuhachi: 2, broadcast: 1 };  // notch 1: the plucked / reed / PA; notch 2: the flute (critic r2 §3.1)
  var ROOM_PA_SHO_F = 1100, ROOM_PA_SHO_Q = 1.0;                                          // the PA's shō notch: 1.1 kHz at Q 1 clears 0.8–1.6 kHz, where the shō's A5 partials cover the tannoy (critic r2 §3.2)
  var room = { spans: [], g: 1, gs: 1, pg: 0, cg: [0, 0], lf: [Math.log(400), Math.log(400)], lfs: [Math.log(400), Math.log(400)], qs: ROOM_Q };
  function roomSpeak(layer, t, dur, f) {
    if (!ROOM_VOICES[layer] || !(dur > 0) || !(f > 0)) return;
    room.spans.push({ a: t, b: t + dur, f: f, fs: layer === "pa" ? ROOM_PA_SHO_F : f, qs: layer === "pa" ? ROOM_PA_SHO_Q : ROOM_Q, db: ROOM_VOICES[layer], dbs: ROOM_VOICES_SHO[layer] || ROOM_VOICES[layer], pk: ROOM_PICK[layer] || 0, grp: ROOM_GROUP[layer] || 1, koto: layer === "koto" });   // the PA: the grit notch at its reciting tone, the shō's at 1.1 kHz
  }
  function roomReset(t) {
    room.spans.length = 0; room.g = 1; room.gs = 1; room.pg = 0; room.cg = [0, 0]; room.lf = [Math.log(400), Math.log(400)]; room.lfs = [Math.log(400), Math.log(400)]; room.qs = ROOM_Q;
    if (!duckGrit) return;
    [duckGrit.gain, duckSho.gain].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(1, t); });
    [carveGrit.gain, carveSho.gain, carveGrit2.gain, carveSho2.gain, pickGrit.gain, pickSho.gain].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(0, t); });
    [carveGrit.frequency, carveSho.frequency, carveGrit2.frequency, carveSho2.frequency].forEach(function (p) { p.cancelScheduledValues(t); p.setValueAtTime(400, t); });
    carveSho.Q.cancelScheduledValues(t); carveSho.Q.setValueAtTime(ROOM_Q, t);
  }
  function roomPulse(t) {
    if (!playing || !duckGrit) return null;
    var P = 0.25, N = 5, dt = P / N, sp = room.spans, keep = [], i;
    for (i = 0; i < sp.length; i++) if (sp[i].b > t - 1) keep.push(sp[i]);      // spans older than the release are forgotten
    room.spans = sp = keep;
    var scene = ROOM_SCENE[arcPhase(t)] != null ? ROOM_SCENE[arcPhase(t)] : 0.7, deepPhase = !!ROOM_KOTO_DEEP[arcPhase(t)];
    var g = room.g, gs = room.gs, pg = room.pg, cg = room.cg.slice(), lf = room.lf.slice(), lfs = room.lfs.slice(), qs = room.qs;
    var CG = [carveGrit, carveGrit2], CS = [carveSho, carveSho2];
    duckGrit.gain.setValueAtTime(g, t); duckSho.gain.setValueAtTime(gs, t);              // anchors: this writer's own last values, which the previous window's ramps reached at t
    pickGrit.gain.setValueAtTime(pg, t); pickSho.gain.setValueAtTime(pg, t);
    for (var n = 0; n < 2; n++) { CG[n].gain.setValueAtTime(cg[n], t); CS[n].gain.setValueAtTime(cg[n], t); CG[n].frequency.setValueAtTime(Math.exp(lf[n]), t); CS[n].frequency.setValueAtTime(Math.exp(lfs[n]), t); }
    carveSho.Q.setValueAtTime(qs, t);
    for (var k = 1; k <= N; k++) {
      var tau = t + k * dt, step = 0, steps = 0, pk = 0, sp1 = [0, 0], fsum = [0, 0], fssum = [0, 0], fn = [0, 0], qmin = ROOM_Q, kotoDeep = false;
      for (i = 0; i < sp.length; i++) if (sp[i].a <= tau && tau <= sp[i].b) {
        var x = sp[i], gi = x.grp === 2 ? 1 : 0;
        if (x.koto && deepPhase) kotoDeep = true;
        if (x.db > step) step = x.db; if (x.dbs > steps) steps = x.dbs; if (x.pk < pk) pk = x.pk;
        sp1[gi] = 1; fsum[gi] += Math.log(x.f); fssum[gi] += Math.log(x.fs); fn[gi]++; if (gi === 0 && x.qs < qmin) qmin = x.qs;
      }
      var target = step > 0 ? Math.pow(10, -step * scene / 20) : 1, targetS = steps > 0 ? Math.pow(10, -steps * scene / 20) : 1;
      var a = 1 - Math.exp(-dt / (target < g ? 0.05 : 0.2));                   // attack ≈ 150 ms (3 τ), release ≈ 600 ms
      g += (target - g) * a;
      gs += (targetS - gs) * (1 - Math.exp(-dt / (targetS < gs ? 0.05 : 0.2)));
      pg += (pk * scene - pg) * a;
      for (n = 0; n < 2; n++) {
        cg[n] += ((sp1[n] ? (n === 0 && kotoDeep ? ROOM_CARVE_KOTO_DB : ROOM_CARVE_DB) * scene : 0) - cg[n]) * a;
        if (fn[n]) {
          var lt = Math.max(Math.log(ROOM_F_LO), Math.min(Math.log(ROOM_F_HI), fsum[n] / fn[n])); lf[n] += (lt - lf[n]) * (1 - Math.exp(-dt / 0.04));
          var lts = Math.max(Math.log(ROOM_F_LO), Math.min(Math.log(ROOM_F_HI_SHO), fssum[n] / fn[n])); lfs[n] += (lts - lfs[n]) * (1 - Math.exp(-dt / 0.04));
        }
        CG[n].gain.linearRampToValueAtTime(cg[n], tau); CS[n].gain.linearRampToValueAtTime(cg[n], tau);
        CG[n].frequency.linearRampToValueAtTime(Math.exp(lf[n]), tau); CS[n].frequency.linearRampToValueAtTime(Math.exp(lfs[n]), tau);
      }
      qs += (qmin - qs) * (1 - Math.exp(-dt / 0.04)); carveSho.Q.linearRampToValueAtTime(qs, tau);   // the PA's shō notch is wider (Q 1); the strings' stays a critical band (Q 2)
      duckGrit.gain.linearRampToValueAtTime(g, tau); duckSho.gain.linearRampToValueAtTime(gs, tau);
      pickGrit.gain.linearRampToValueAtTime(pg, tau); pickSho.gain.linearRampToValueAtTime(pg, tau);
    }
    room.g = g; room.gs = gs; room.pg = pg; room.cg = cg; room.lf = lf; room.lfs = lfs; room.qs = qs;
    return P;
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (bg) bg.stopped();
    if (conductor) { try { conductor.stop(); } catch (e) {} }
    if (signalProvider) { try { signalProvider.stop(); } catch (e) {} }
    farGroove = null; farStuck = false;          // 逸脱 崩: the groove dies with the clock; the grit goes back to the arc
    if (farMetalMod) { try { farMetalMod.stop(ctx ? ctx.currentTime : 0); } catch (e) {} farMetalMod = null; farMetalAmp = null; }   // 金: one modulator, and it stops here
    if (clock) clock.stop();                     // every lane's pending events die here
    while (liveRings.length) ringDown(liveRings[0]);   // screech loops in flight lose their lane teardown with the clock — tear them down here
    if (ctx) {
      for (var i = 0; i < LAYERS.length; i++) {
        var node = layerGains[LAYERS[i]];
        if (node) { node.gain.cancelScheduledValues(ctx.currentTime); node.gain.setValueAtTime(0, ctx.currentTime); }
      }
    }
  }

  // ==========================================================================
  // SAMPLE — audition one instrument in isolation (works while stopped)
  // ==========================================================================
  function samplePhrase(noteFn, t, degs, dur) {
    var prev = null;
    for (var i = 0; i < degs.length; i++) {
      var f = SCALE[scaleIndexOf(degs[i])].freq;
      noteFn(f, t, dur, { glideFrom: prev, gain: 1, breath: 0.5, bend: i === degs.length - 1 });
      prev = f; t += dur * 0.9;
    }
  }
  function sampleDrone(t) {
    var dur = 3, lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(getLayerParam("subDrone", "cutoff", 220), t);
    var bus = ctx.createGain(); lp.connect(bus); bus.connect(lg("subDrone"));
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 0.8); bus.gain.setValueAtTime(1, t + dur - 1); bus.gain.linearRampToValueAtTime(0, t + dur);
    [subRoot(), subFifth()].forEach(function (rf) {
      [-7, 7].forEach(function (det) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(rf, t); o.detune.setValueAtTime(det, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.05, t); o.start(t); o.stop(t + dur + 0.1); });
    });
    var so = ctx.createOscillator(), sg = ctx.createGain(); so.type = "sine"; so.frequency.setValueAtTime(subRoot() / 2, t); so.connect(sg); sg.connect(lp); sg.gain.setValueAtTime(0.08, t); so.start(t); so.stop(t + dur + 0.1);
  }
  function sampleSho(t) {
    var dur = 3, lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(getLayerParam("sho", "cutoff", 1400), t);
    var bus = ctx.createGain(); lp.connect(bus); bus.connect(lg("sho"));
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(0.5, t + 0.8); bus.gain.setValueAtTime(0.5, t + dur - 1); bus.gain.linearRampToValueAtTime(0, t + dur);
    chooseAitake(S.sample, 6).freqs.forEach(function (f) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.045, t); o.start(t); o.stop(t + dur + 0.1); });
  }
  function sampleNoise(t, kind) {
    if (kind && kind !== "wall") {
      // audition one vocabulary body through the real noiseEvent (the bench's
      // instrument): force the scene's body, a mid intensity, one event
      var savedBody = noiseBodyForScene, savedScene = noiseBodyScene, savedPlaying = playing, savedArc = getArc;
      noiseBodyForScene = kind; noiseBodyScene = cyc.n + ":" + scn.type + ":" + scn.startT;
      playing = true; getArc = function () { return 0.7; };
      var savedAfter = after; after = function () {};                 // one event, no loop
      try { noiseEvent(t); } catch (e) {}
      after = savedAfter; getArc = savedArc; playing = savedPlaying;
      noiseBodyForScene = savedBody; noiseBodyScene = savedScene;
      return;
    }
    var dur = 2.5, nz = noiseSource(), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(800, t); bp.frequency.linearRampToValueAtTime(3000, t + dur); bp.Q.setValueAtTime(4, t);
    var g = ctx.createGain(); nz.connect(bp); bp.connect(g); g.connect(lg("noise"));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); nz.start(t, S.sample.next() * 5); nz.stop(t + dur + 0.1);
  }
  // Everything an audition needs before it can be HEARD while the station is
  // stopped. It was inline in sample() and the 受信 button's path did not have
  // it, so the button showed a picture and played silence (measured on the
  // master: −999 dB from a fresh load, −75.9 dB after a stop, against 選局's
  // −18.9 dB by either route). Two of the four steps are the ones that bite:
  // stop() sets EVERY layer gain to zero, so the broadcast layer is muted
  // until something re-arms it; and the <audio> route has to be poked or the
  // context is running with nowhere to go. Now there is one function and both
  // controls call it, so a third control cannot be added silent.
  function auditionPrep(layer) {
    init();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (bg) bg.poke();               // audition while stopped: the <audio> route must be live
    // Re-armed with a 12 ms ramp from wherever the gain actually is, not a step
    // to the target. A step is inaudible on a silent bus and a click on a live
    // one — and this runs while a previous audition may still be ringing out.
    // Anchored at the current value, so it is a legal ramp either way.
    var now = ctx.currentTime;
    reArm(masterGain.gain, masterVolume, now);
    var node = layerGains[layer];
    if (node) {
      var vt = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
      reArm(node.gain, (layerVolumes[layer] != null ? layerVolumes[layer] : DEFAULT_LAYER_VOL) * vt, now);
    }
  }
  function reArm(param, target, now) {
    var cur = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(cur, now);
    param.linearRampToValueAtTime(target, now + 0.012);
  }
  function sample(layer, variant) {
    auditionPrep(layer);
    // The audition draws from its own stream: while it plays, every body
    // borrows S.sample so a ♪ press mid-performance re-rolls nothing.
    var borrowed = ["shakuhachi", "koto", "shamisen", "taiko", "ambient", "noise", "sho", "subDrone", "hichiriki", "biwa", "pa"], saved = {}, bi;
    for (bi = 0; bi < borrowed.length; bi++) { saved[borrowed[bi]] = S[borrowed[bi]]; S[borrowed[bi]] = S.sample; }
    var t = ctx.currentTime + 0.05;
    switch (layer) {
      case "subDrone": sampleDrone(t); break;
      case "sho": sampleSho(t); break;
      case "shakuhachi": samplePhrase(shakuhachiNote, t, [4, 2, 3, 0], 0.7); break;
      case "koto": samplePhrase(kotoNote, t, [0, 2, 3, 4, 2, 0], 0.4); break;
      case "shamisen": samplePhrase(shamisenNote, t, [0, 2, 0, 3, 0], 0.3); break;
      case "hichiriki": samplePhrase(hichirikiNote, t, [3, 4, 3, 0], 1.4); break;
      case "pa": paSpeak(t, 4, {}); break;
      case "biwa": biwaStrum(SCALE[scaleIndexOf(0)].freq, t, {}); stringNote("biwa", SCALE[scaleIndexOf(3)].freq, t + 1.2, 1.4, { vel: 0.8 }); stringNote("biwa", SCALE[scaleIndexOf(0)].freq, t + 2.4, 2, { vel: 0.7 }); break;
      case "taiko": taikoPattern(t, "matsuri", 0.5, 1); taikoHit(t + 2.2, true, "odaiko"); taikoHit(t + 2.6, false, "shime"); taikoHit(t + 2.8, false, "ka"); break;
      case "noise": sampleNoise(t, variant); break;
      case "ambient": var e = AMBIENT_POOL[Math.floor(S.sample.next() * AMBIENT_POOL.length)]; try { e.fn(t); } catch (x) {} break;
      case "broadcast": if (signalProvider && signalProvider.sample) { try { signalProvider.sample(t); } catch (x2) {} } break;
    }
    for (bi = 0; bi < borrowed.length; bi++) S[borrowed[bi]] = saved[borrowed[bi]];
    emitEvent({ cat: "mode", label: "♪ sample", detail: layer + (variant ? " · " + variant : "") });
  }

  // ==========================================================================
  // MIXER API
  // ==========================================================================
  function setMasterVolume(val) {
    masterVolume = Math.max(0, Math.min(1, val));
    if (ctx && masterGain && playing) { masterGain.gain.cancelScheduledValues(ctx.currentTime); masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime); }
  }
  function setLayerVolume(layer, val) { if (layerVolumes[layer] != null) { layerVolumes[layer] = Math.max(0, Math.min(1, val)); if (ctx) applyLayerGain(layer); } }
  function setLayerRate(layer, rate) {
    if (layerRate[layer] == null) return;
    layerRate[layer] = Math.max(0.05, rate);
    if (clock) lane(layer).rate = layerRate[layer];   // bends the lane's pending events in place
  }
  function toggleLayer(layer) { if (layerMuted[layer] == null) return false; layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return layerMuted[layer]; }
  function setLayerParam(layer, key, val) { if (layerParams[layer]) layerParams[layer][key] = val; }
  function resetLayerParams(layer) { if (LAYER_PARAM_DEFAULTS[layer]) layerParams[layer] = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS[layer])); }
  function getState() { return { playing: playing, masterVolume: masterVolume, layerVolumes: layerVolumes, layerMuted: layerMuted, layerRate: layerRate }; }

  // ==========================================================================
  // PUBLIC SURFACE
  // ==========================================================================
  return {
    init: init, play: play, stop: stop,
    setMasterVolume: setMasterVolume, setLayerVolume: setLayerVolume, setLayerRate: setLayerRate,
    setLayerParam: setLayerParam, getLayerParam: getLayerParam, resetLayerParams: resetLayerParams,
    toggleLayer: toggleLayer, getState: getState, sample: sample,
    // 選局 TUNE (S2): playing → ask the receiver to seat a signal at the next legal moment (one per cycle); stopped → the layer's ♪ tune-in
    tune: function () { if (!signalProvider) return false; if (playing) return !!(signalProvider.scan && signalProvider.scan()); sample("broadcast"); return true; },
    // 掃引 THE TUNING DIAL (plan §7). The page hands over how hard the hand is
    // moving (0..1) and whether the fidget has passed the threshold; the
    // receiver makes the noise either way and only locks when asked to. The
    // KIRU's hush is the engine's to know about, so it is refused here rather
    // than in the receiver: during the cut the dial makes snow and nothing else.
    dial: function (amt, wantLock) {
      if (!signalProvider) return "snow";
      // Stopped and never played: there is no context yet, the master may be
      // where stop() left it and the broadcast layer is muted. The button's
      // audition has to be as audible as the knob's, so it takes the same
      // preparation rather than a subset of it.
      auditionPrep("broadcast");
      try { if (signalProvider.dialNoise) signalProvider.dialNoise(Math.max(0, Math.min(1, +amt || 0))); } catch (e) {}
      if (!wantLock || !signalProvider.dialLock) return "snow";
      if (playing && ctx && cutGrit) {                        // inside the KIRU's hush the station is listening to itself
        try { if (cutGrit.gain.value < 0.9) return "snow"; } catch (e2) {}
      }
      try { return signalProvider.dialLock() || "snow"; } catch (e3) { return "snow"; }
    },
    // §8.2: is the button's lens lit? Read every frame by the page.
    dialReady: function () {
      if (!signalProvider || !signalProvider.dialReady) return true;
      try { return !!signalProvider.dialReady(); } catch (e) { return true; }
    },
    LAYERS: LAYERS.slice(), LAYER_PARAM_DEFAULTS: LAYER_PARAM_DEFAULTS, DEFAULT_LAYER_VOL: DEFAULT_LAYER_VOL,
    SCALE_INFO: SCALE_INFO,
    getArc: getArc, getArcInfo: arcInfo, getMetaInfo: getMetaInfo,
    getAirInfo: function () { if (!air) return null; var ai = air.info(); ai.holdDenials = airHoldDenials; return ai; },
    // THE SIGNAL SEAM (S1): zk-broadcast.js installs a provider {arm, fire, stop,
    // sample?}; the engine hands it its tools. Nothing here is for the page.
    _signal: {
      install: function (p) { signalProvider = p || null; },
      tools: function () {
        return {
          ctx: ctx, PJ: PJ, S: S, lane: lane, playing: function () { return playing; },
          emitEvent: emitEvent, lg: lg, roomSpeak: roomSpeak, noiseSource: noiseSource, panAt: panAt,
          getArc: getArc, arcPhase: arcPhase, scene: function () { return { type: scn.type, activity: scn.activity, startT: scn.startT, durS: scn.durS }; },
          cycle: function () { return { n: cyc.n, kind: cyc.kind, startT: cyc.startT, durS: cyc.durS, visit: cyc.visit ? cyc.visit.name : null }; },
          getLayerParam: getLayerParam, bonsho: function (t) { ambBonsho(t, { halo: true }); },
          // `who` lets the receiver declare an INTENDED hold at arm time and
          // replace it with the exact one at fire (W4 §12).
          airHold: function (map, who) { for (var k in map) airHoldAdd(k, map[k].from, map[k].until, who || "signal"); },
          airHoldClear: function (who) { airHoldDrop(who === undefined ? "signal" : who); },
          fallback: visitBroadcast, fieldTonic: function () { return field.tonicHz; },
          // §11.2 asks for "the window nearest the current tonic or fifth", and
          // CURRENT has to mean tonight's. 撓 warps every interval about the
          // tonic — farWarp(f) = T·(f/T)^k with k = the drawn octave over 1200
          // — so on a sagging night the fifth the station actually sounds is
          // 700·k cents, measured across 370 撓 nights as 690.4 to 716.8. The
          // receiver was aiming at the tempered 700.0, which is up to 16.8
          // cents adrift: 1.7× the ±10 cent gate the whole feature is held to.
          // The TONIC is exact for any k, since farWarp(T) = T, so only reels
          // that land on the fifth were affected.
          //
          // Identity at home (k = 1) and on every night that does not draw 撓,
          // so this moves nothing the re-base did not already move. It covers
          // the FIELD-level warp only; 減 and 螺 do their own work on the mode
          // steps and I have not measured whether the fifth moves under them.
          degreeHz: function (cents) { return farWarp(field.tonicHz * Math.pow(2, (+cents || 0) / 1200)); },
          // 螺 AND 弛 ARE TRANSPOSITION, NOT TUNING — the engine's own rule, and
          // the reason `degreeHz` above deliberately does NOT carry them: they
          // multiply last, over everything, and they are a function of TIME.
          // A reel is part of the station's world, so it rides them like every
          // other voice; the receiver multiplies its playback rate by this
          // across the hold. 1 at home and on any night without 螺 or 弛, so
          // the receiver schedules nothing at all on those nights.
          glideMul: function (t) { return farGlideOn ? farGlideMul(t) : 1; },
          gliding: function () { return !!farGlideOn; },
          // §11.3 TUNED SIGNALS — the station tunes to the REEL. On a far
          // night (d ≥ 0.5) a reel that holds a pitch may pull the field to it
          // as it tunes in, and then plays unbent: the tape is not warped, the
          // station moves. The tonic is folded into the field's own register,
          // so a 587 Hz time signal becomes a tonic near D3 rather than a
          // tonic three octaves up. Refused in a KIRU's hush, which is the
          // owner's gate, and refused at home and below 0.5, which are §11.3's
          // own two conditions — all three tested HERE so the receiver cannot
          // forget one of them.
          seaToward: function (hz, t) {
            if (!playing || !(hz > 0)) return null;
            if (FAR.home() || FAR.d() < 0.5) return null;
            var now = t != null ? t : (ctx ? ctx.currentTime : 0);
            if (now < kiruHushUntil) return null;
            var target = foldTonic(hz);
            if (Math.abs(1200 * Math.log(target / field.tonicHz) / Math.LN2) < 15) return target;  // already there
            setMode(currentMode, "同調 · the station tunes to the signal", now, target);
            return target;
          },
          fieldMode: function () { return currentMode; },
          // 室 (W3): the reel becomes the room. The receiver needs the station's
          // dry sum to feed a convolver and the master to return it to; both are
          // the engine's, so the engine hands them over rather than the receiver
          // reaching into the graph.
          dryBus: function () { return reverbSend; },
          masterIn: function () { return masterGain; },
        };
      },
    },
    getRooms: function () { return { hull: roomHull, corridor: roomCorridor, blend: roomBlend, farWall: farWall, halo: halo }; },
    getWeather: function () { return weather; },
    getSeed: function () { return seed; },
    // the gates' handle on the two fault classes (rc.21)
    getFaults: function () { return { lanes: faults.lanes, notes: faults.notes, lane: faults.lane.slice(), note: faults.note.slice() }; },
    reseed: function (s) { seed = (s >>> 0) || 3042; if (S) forkStreams(); },
    // 逸脱 W0 — the far tail's surface. setFar(d) is ?far= by another door
    // (the probe uses it); pass null to return to the lottery.
    setFar: function (d) { farForced = (d == null || !isFinite(d)) ? null : (d < 0 ? 0 : d > 1 ? 1 : +d); },
    // the night as drawn — the probe's handle on what it is measuring. Before
    // play() this is the home sentinel, not null: a caller never has to guard.
    getFar: function () {
      var n = FAR.night();
      var dn = farNightDrawn || n;
      // `d` and `home` are THE NIGHT'S, not this cycle's. rc.29 made farNight
      // the cycle view, which silently changed what this field meant for every
      // caller — the critic's dist-json reads far.d, and seed 1024 started
      // reporting 0.56 for a night drawn at 0.73 purely because the last cycle
      // had leaned in. A field whose MEANING changes under a reader is worse
      // than one that changes value, which is the lesson engineSig taught an
      // hour ago. The cycle's own distance is cycleD, next to it.
      return { d: dn.d, home: !!dn.home, kana: n.kana, name: n.name, label: n.label, detail: n.detail || "",
        // §13 — enough to RE-DERIVE, not just lifted:true. "Byte-identical to
        // its own baseline" only says that SOMETHING moved; with the cycle and
        // d′ visible, a lift that shifted from cycle 3 to cycle 5, one that
        // changed d′, and one that stopped firing are three different faults
        // instead of one bisect.
        nightD: dn.d, cycleD: farCycleD, lifted: Math.abs(farCycleD - dn.d) > 1e-9,
        homeLift: dn.homeLift ? { cycle: dn.homeLift.cycle, d: dn.homeLift.d } : null,
        band: n.band ? n.band.label : "home", ids: n.ids.slice(), dep: n.dep, forced: farForced };
    },
    far: {
      night: function () { return FAR.night(); },
      d: function () { return FAR.d(); },
      forced: function () { return farForced; },
      // the hidden switch's hunt: the first seed at or past minD, walking up
      // from the current one. d is a pure function of the seed (zk-far.js), so
      // this is ~29 hashes, not 29 performances. The page rewrites ?seed= with
      // what comes back, and that night is then shareable like any other.
      seek: function (minD, from) {
        var M = window.ZK_FAR;
        if (!M) return null;
        return M.seek(from != null ? (from >>> 0) : seed, minD != null ? minD : 0.8);
      },
    },
    getField: function () { return field; },
    getClock: function () { return clock; },
    getMotifStats: function () { return Motif.stats(); },
    getMode: function () { return { key: currentMode, name: MODES[currentMode].name, kana: MODES[currentMode].kana.slice(), tonicHz: field.tonicHz, tonic: noteName(field.tonicHz), offsets: MODES[currentMode].offsets.slice() }; },
    setNoteListener: function (fn) { if (typeof fn === "function") { if (noteListeners.indexOf(fn) < 0) noteListeners.push(fn); } else noteListeners.length = 0; },
    setEventListener: function (fn) { if (typeof fn === "function") { if (eventListeners.indexOf(fn) < 0) eventListeners.push(fn); } else eventListeners.length = 0; },
    getAudioContext: function () { return ctx; },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    attachAnalyser: function (node) { if (!masterGain || !node) return false; try { masterGain.connect(node); return true; } catch (e) { return false; } },
    attachLayerAnalyser: function (layer, node) { if (!layerGains[layer] || !node) return false; try { layerGains[layer].connect(node); return true; } catch (e) { return false; } },
    // dev tap on the buses (critic's instrument): dry (the room-bound sum),
    // grit (post makeup-down), hull / corridor (each room's wet return), farWall
    attachBusAnalyser: function (name, node) {
      var src = { dry: reverbSend, grit: gritMakeup, hull: roomHull && roomHull.output, corridor: roomCorridor && roomCorridor.output, farWall: farWall && farWall.output,
        halo: layHalo, screech: screechBus, cut: cutGrit, radio: radioBus,
        landscape: landscapeTap, duck: duckGrit, out: outTrim, taiko: cutTaiko }[name];           // taiko: the kit after its own clip and cut, as it reaches the dry sum                  // Phase M: the landscape sum, the duck gain, the output
      if (!src || !node) return false;
      try { src.connect(node); return true; } catch (e) { return false; }
    },
  };
})();
