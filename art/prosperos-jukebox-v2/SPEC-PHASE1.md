# Prospero's Jukebox v2 — Phase 1 Spec: Form

Phase 1 gives v2 its sense of form: a conductor with per-performance
dramaturgy, THE AIR turn-taking protocol, a meta-tide across performances,
and a thin first slice of the Library track to make the form audible.

All Phase 0 ground rules and house conventions in `SPEC.md` apply (IIFEs on
`window.PJ2`, ES5 voice, harness-loadable: no top-level DOM/AudioContext,
no Date.now/Math.random in musical paths). Phase 0 modules are the
substrate — everything here rides `PJ2.Clock` lanes (never raw setTimeout),
draws from forked `PJ2.Rand` streams, and plays through `PJ2.Voice` plumbing.

## Aesthetic constants (the owner's notes — binding)

- This is a CONTINUOUS AMBIENT MUSIC GENERATOR first. The narrative arc
  must read as weather, not theater. Nothing startles.
- JOINTS ARE SUBTLE AND TASTEFUL. A joint is at most one or two quiet
  events; many boundaries pass as nothing more than a drone-breath. Joint
  gain never exceeds the ambient layer. No crescendo gestures, no rolls,
  no cuts.
- Intensity is compressed: floor ~0.04 (never true silence — the drone
  always breathes), ceiling 0.65 (the "seizure" is concentration, not
  climax — more density and a lifted register, not loudness).
- THE AIR allows OCCASIONAL OVERLAP: turn-taking is the norm, but a second
  (never a third beyond limit+1) voice may enter over a speaker with a
  scene-dependent probability. Overlap should feel like a happy accident,
  not a duet norm.
- Library evenings run 6–18 minutes (seeded; the tide may bias where in
  the range an evening lands).
- Performances chain SEAMLESSLY: the candle-out tail decays into the next
  evening's settling-in. No dead air, ever.

## New files and load order (after the four Phase 0 modules)

5. `pj2-air.js`        → `PJ2.Air`        (turn-taking token)
6. `pj2-conductor.js`  → `PJ2.Conductor`  (generic dramaturgy machine + tide)
7. `pj2-library.js`    → `PJ2.Library`    (Library dramaturgy + thin voices + engine facade)
8. `form-demo.php` + `form-demo.js`       (dev page: play/stop/seed + form monitor)
9. `_harness.js` gains a PHASE 1 section (Phase 0 checks stay intact and green)

---

## 5. PJ2.Air — the air, with occasional overlap

Adapted from kolob-audio.js:391-413, softened per the owner's note.

```js
PJ2.Air.create({ clock, rng, limit, overlapChance })
  // clock: PJ2.Clock (for .now()); rng: a forked Rand stream
  // limit: fn() -> int          (scene-dependent; conductor supplies)
  // overlapChance: fn() -> 0..1 (scene-dependent; conductor supplies)
Air:
  .tryClaim(voiceName, durS, marginS)   // -> token | null
      // Grants when holders < limit(). When holders >= limit(), grants
      // ANYWAY with probability overlapChance() — but never past
      // limit()+1 total holders (hard). marginS is enforced silence after
      // the phrase: the claim occupies [now, now+durS+marginS].
      // A voice denied the air simply skips this utterance and asks again
      // next cycle — same graceful-thinning philosophy as the budget.
  .release(token)                        // early release (rarely needed;
                                         // claims auto-expire by time)
  .holders()                             // current count (expired claims
                                         // are swept lazily on any call)
  .overlapCount()                        // total overlap grants, telemetry
```

No Web Audio, no scheduling — pure bookkeeping against `clock.now()`.
Landscape voices (drone, hum bed, room tone, joints) NEVER touch the air.

## 6. PJ2.Conductor — the dramaturgy machine

Generic: knows scenes, intensity, joints, chaining, and the tide; knows
nothing about any particular track. A track hands it a `dramaturgy` object.

```js
PJ2.Conductor.create({ clock, rng, dramaturgy, onEvent })
  // rng: forked stream (fork it again internally per performance)
  // onEvent: fn(evt) — evt: {type: "performance"|"scene"|"joint"|"tide",
  //                          ...details, t} for the demo page / future viz
Conductor:
  .start()            // plans performance #1, enters its first scene
  .stop()             // cancels its lane; no musical stop gesture (the
                      // engine facade handles fades)
  .intensity()        // current 0..1, already tide- and scene-shaped,
                      // CONTINUOUS in time (piecewise-smooth; no steps —
                      // scene handoffs interpolate over >= 8s)
  .scene()            // {type, activity, x}  x = 0..1 progress in scene
  .info()             // full telemetry snapshot: {perfN, seed, sceneType,
                      //  sceneIdx, sceneCount, x, intensity, tidePos,
                      //  tideLabel, airHolders?, elapsedS, durS}
  .tide()             // 0..1 position + label
```

**Dramaturgy object contract** (what pj2-library.js supplies):

```js
{
  name: "library",
  durationRangeS: [360, 1080],       // 6–18 min; plan() picks within,
                                     // tide may bias the draw
  plan: function(rng, tidePos) -> [ {type, durS, activity} ... ],
      // scene list for one performance; the conductor runs it in order
  scenes: {                          // per scene TYPE:
    <type>: {
      intensity: function(x, tidePos) -> 0..1,   // local curve, within
                                                 // the global floor/ceiling
      airLimit: int,                             // usually 1; chapters 2
      overlapChance: 0..1,           // e.g. settling .05, chapter .25,
                                     // reverie .12 — tune to "rare"
      activityWeights: [[name,w]..], // optional flavor draw
    }
  },
  joint: function(fromType, toType, t, intensity, tools) -> void,
      // Called ONCE at each boundary with an exact audio time t. tools =
      // {ctx, out, rng, field} handed in by the engine facade. MUST obey
      // the subtlety rules above. It may also do NOTHING (and for at
      // least ~1/3 of boundary draws, should).
  chainOverlapS: [5, 15],            // candle-out tail / next settling
                                     // overlap window (seeded draw)
  tide: {periodPerfs: [4, 7], labels: [...] }   // meta-tide config
}
```

**The tide.** One seeded cosine whose period is drawn in performances (not
seconds), advanced at each performance boundary; `tidePos` 0..1 with
human labels (library: "candlelit" trough → "stormy" peak → "late-night"
descent — labels are dramaturgy data). It biases: `plan()` (duration draw,
chapter count, activity weights), scene intensity curves, and is exposed
for voices to read (e.g. hum darker when stormy). Drift must be slow and
deterministic from the master seed.

**Chaining.** When the last scene's x reaches 1: emit "performance" end
event, advance the tide, plan the next performance from a fresh
per-performance fork, and enter its first scene AT ONCE — the outgoing
candle-out's tail (the engine keeps voices fading for chainOverlapS) lies
under the incoming settling-in. The conductor itself never stops.

**Timing.** The conductor runs on its own clock lane with a coarse pulse
(~0.5s .every loop) for scene advancement + intensity publication, but
scene boundaries and joints are placed at EXACT audio times via lane.at —
no wall-clock drift.

## 7. PJ2.Library — the first slice

The engine facade (this is what the demo page drives, and what will grow
into the full three-track engine later):

```js
PJ2.Library.create({ seed })   // or reads ?seed= itself; document which
Library:
  .play() / .stop() / .isPlaying()
  .setMasterVolume(v)
  .getInfo()                   // conductor.info() + air holders + budget stats
  .setNoteListener(fn) / .setEventListener(fn)   // multicast, family pattern
  .reseed(seed)
  .attachAnalyser(analyser)
```

Internally: one AudioContext (lazy on first play), `PJ2.Voice.buildBus`,
ONE reverb space for now (warm room, decayS ~2.2 — v1 Library's character),
pannerPool(s), budget(32) bound to the clock, a PitchField (dorian, tonic
262 — v1 Library), master rand stream forked per subsystem
("conductor","drone","pluck","musicbox","hum","ambient","joints"), Air, and
the Conductor wired to the Library dramaturgy.

**Library dramaturgy (Phase 1 draft):**
- plan(): settling (60–120s) → 2–4 chapters (90–200s each) → seizure
  (60–120s, present in ~70% of evenings — some evenings just read
  peacefully; tide-biased) → reverie (80–160s) → candle-out (45–90s).
  Durations scaled so the total lands in the drawn 6–18min budget.
- Scene intensity curves: settling smooth bloom 0.04→0.25; chapter gentle
  plateau ~0.3–0.45 with a slow within-scene wobble; seizure rises to ≤0.65
  (density/register, remember — not loudness); reverie decay to ~0.15;
  candle-out 0.15→0.05 with the tail overlap into the next evening.
- airLimit: 1 everywhere except chapters (2). overlapChance per the
  aesthetic constants.
- joint(): the whole vocabulary is QUIET — (a) drone-breath: the drone bed
  dips ~2dB over 4s and re-blooms (most common, and the "nothing" option's
  cousin); (b) a single soft page-turn (band-passed noise swish, short);
  (c) ONE clock chime (single struck tone, low in the mix) reserved for
  entering reverie or candle-out. Never more than two events per joint;
  ~1/3 of boundaries: nothing at all.

**Thin voices (Phase 1 placeholders — Phase 2 replaces the brains, keep
the bodies simple):**
- `drone` (landscape): Eno-style overlapping pads, triangle partials +
  gentle lowpass, cycles 20–30s, pitch from field degrees {0,4} (tonic +
  fifth), depth/level follows intensity and tide. Never stops, even across
  performance boundaries (it IS the seam).
- `humBed` (landscape): very soft detuned-saw + single bandpass vowel pad,
  fades in from intensity ≥ 0.2, darker when tide is stormy.
- `pluck` (melodic, claims air): placeholder harpsichord — filtered-saw or
  simple Karplus-Strong pluck; phrases of 3–9 notes from a seeded
  reflected walk over field.table(-1,1); phrase pacing from intensity;
  margins rnd(3,8)s. Registers lift slightly in the seizure.
- `musicbox` (melodic, claims air): sine + 3rd-partial plink, shorter
  phrases, mostly active in chapters (it is usually the overlap voice).
- `ambient` (landscape, sparse): weighted pool of 3 one-shots — page turn,
  clock tick-tock pair, fire-crackle cluster; gaps 20–60s scaled by
  intensity and tide.
All voices: budget-claimed, panned via pool, click-safe envelopes, notes
placed at exact lane times. Every emitted note goes through
`field.degFreq`/`snap` — the harness asserts 100% adherence.

**Stop behavior:** fade the bus over ~1.5s, stop the clock, suspend the
ctx; Play again re-enters cleanly (fresh performance, same seed lineage —
document whether stop/play resumes the tide or restarts it; PREFER
restarting the whole seeded run for reproducibility).

## 8. form-demo — the form monitor

`form-demo.php` (same dev-page shell as substrate-demo.php) + `form-demo.js`:
Play/Stop, seed input, master volume; a monitor polling `getInfo()` at
~300ms showing: performance #, tide label + position bar, scene name +
progress bar, intensity meter, current air holders, budget stats; and an
event log fed by the event listener (scene/joint/performance/tide lines,
capped ~100 rows). No styling ambition — readable dev chrome only.

## 9. Harness — PHASE 1 section

Extend `_harness.js` (keep every Phase 0 check green; same mocks). Load the
three new modules after the Phase 0 four. Simulate ≥ 3600s of PJ2.Library
with a fixed seed and assert:

- FORM: ≥ 2 performances complete; every performance's scenes run exactly
  in plan order; every performance duration within [360,1080]s; a
  "performance" event precedes each new plan; joints fire at every
  boundary that drew one (and the ~1/3 nothing-draws are observed over the
  run: joint events < boundary count).
- SEAMLESS: the drone lane is never silent across a boundary (no gap in
  scheduled drone events longer than one drone cycle + 5s).
- INTENSITY: sampled every 0.5s — always within [0.03, 0.66]; max step
  between samples ≤ 0.02 (continuity); seizure scenes reach > 0.5;
  candle-out ends < 0.08.
- AIR: reconstruct concurrent melodic speakers from claim telemetry —
  never exceeds sceneLimit+1; overlap grants > 0 over the hour but
  overlap-granted utterances < 20% of all utterances; every voice's
  consecutive claims respect its margin.
- TIDE: advances only at performance boundaries; range covered ≥ 0.3
  across the run; deterministic (two runs, same seed → identical tide
  series and identical scene plans).
- PITCH: 100% of emitted melodic/drone frequencies snap-identical to the
  field. BUDGET: returns to 0 after stop. Zero uncaught exceptions.
- REPRO: full event-stream equality for two same-seed runs (type+time
  sequence), inequality for different seeds.

Verdict table style unchanged. `node _harness.js [simSeconds]`, default 300
(Phase 1 section auto-scales: with < 1800s, relax the ≥2-performances check
to ≥ 1 and skip the tide-range check; say so in the output).

## Ground rules for Phase 1 agents

- Do NOT modify the four Phase 0 modules. If you believe one has a bug,
  report it; don't fix it.
- Do NOT touch v1 (`../prosperos-jukebox/`) or sibling engines (read
  freely — kolob-audio.js:391-413 for THE AIR, kolob's chorister and
  zankyo's meta-arc for conductor prior art, v1's library drone/harpsichord
  for timbral reference).
- Interfaces above are the contract between parallel agents; where this
  spec is silent, match the as-built Phase 0 style and APIs (read the
  modules, they are authoritative for their own surface).
- Everything musical draws from forked seeded streams. Unseeded
  Math.random only inside noise-buffer/IR texture generation.
