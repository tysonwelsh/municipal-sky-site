# Prospero's Jukebox v2 — Phase 0 Substrate Spec

v1 at `../prosperos-jukebox/` is FROZEN — never modify it. It stays live as the
original. v2 is a ground-up rebuild in this folder that will eventually port
v1's three sound-worlds (Library / Sycorax / Ariel) onto a new substrate.

## House conventions (match the sibling engines: zankyo, bardo, kolob)

- Vanilla JS, no build step, no libraries. Each file is an IIFE attaching to a
  `window.PJ2` namespace object (`window.PJ2 = window.PJ2 || {}` at top).
- Web Audio API only. All envelopes click-safe: gain ramps start/end at true
  zero via `linearRampToValueAtTime`; never `setTargetAtTime` on filter
  frequencies mid-note (lesson from bardo-audio.js murmur formants).
- Heavy inline comments in the siblings' voice: explain *musical intent* and
  hard-won DSP lessons, not what the next line does.
- Files must be loadable in a headless Node harness that `eval`s the source
  with a mocked `window`, mocked Web Audio, and a virtual clock. Therefore:
  no top-level DOM access, no top-level AudioContext creation, no
  `Date.now()`/`performance.now()` outside injectable helpers. Everything
  lazy-inits inside functions.

## Phase 0 modules and load order

1. `pj2-rand.js`   → `PJ2.Rand`    (seeded RNG streams)
2. `pj2-pitch.js`  → `PJ2.Pitch`   (pitch field: tonic + mode + tuning)
3. `pj2-clock.js`  → `PJ2.Clock`   (lookahead transport scheduler)
4. `pj2-voice.js`  → `PJ2.Voice`   (bus, envelopes, panner pool, polyphony budget, reverb IR)
5. `_harness.js`   — dev-only Node harness (not shipped)

Later phases add `pj2-audio.js` (the engine), `pj2-ui.js`, `pj2-viz.js`,
`index.php`. Phase 0 ships a `substrate-demo.php` + `substrate-demo.js`
smoke-test page instead.

---

## 1. PJ2.Rand — seeded random streams

mulberry32 core (same algorithm as zankyo-audio.js:60 / kolob-audio.js:80).

```js
PJ2.Rand.stream(seed)        // → a Stream
Stream:
  .next()                    // float [0,1)
  .rnd(a, b)                 // float [a,b)
  .rint(a, b)                // int [a,b] inclusive
  .chance(p)                 // bool
  .pick(arr)
  .pickW(pool)               // pool = [[value, weight], ...]
  .shuffle(arr)              // returns new array, Fisher-Yates
  .fork(label)               // → NEW independent Stream, seed derived from
                             //   parent seed + hashed label
```

`fork` is the key feature: the engine forks one stream per subsystem
("conductor", "melody:library", "ambient", "viz", …) so adding a draw in one
subsystem never perturbs another's sequence (lesson from kolob-text.js keeping
its own RNG). Same parent seed + same label ⇒ same child sequence, always.
Hash the label with a simple FNV-1a or similar, mixed into the parent seed.

No global state. No reading `?seed=` here (the engine does that later).

## 2. PJ2.Pitch — the pitch field

Replaces v1's fixed-Hz tables (prosperos-jukebox-audio.js:16-235). A
PitchField = tonic Hz + mode + tuning system, queryable and MUTABLE via
explicit modulation.

```js
PJ2.Pitch.field({ tonicHz, mode, tuning })   // → Field
// mode: a name from PJ2.Pitch.MODES or a custom {name, steps} object
// tuning: "et" | "ji"  (default "et")

Field:
  .degFreq(deg, oct)      // degree index (0-based, folds beyond mode length), octave offset
  .snap(freq)             // nearest scale frequency (v1's arielSnapToScale generalized)
  .snapInfo(freq)         // { freq, deg, oct, cents } — cents = deviation of input
  .table(octLo, octHi)    // [{deg, oct, freq, idx}] flat ascending table
  .degOf(freq)            // inverse lookup within tolerance, or null
  .size                   // number of degrees in mode
  .tonicHz, .mode, .tuning  // readable current state
  .modulate({ tonicHz?, mode?, tuning? })
      // Explicit, atomic change. Returns {from, to} snapshot. Callers that
      // rendered notes before the change keep their already-scheduled
      // frequencies (we never retune sounding notes — kolob's straddle
      // lesson, kolob-audio.js:1037). Emits nothing; the engine narrates.
  .commonTones(otherFieldOrSpec)   // degrees (of this field) whose freqs match
                                   // within 15 cents in the other — pivot-tone
                                   // modulation support for Phase 2
```

MODES must include v1's three worlds, expressed as interval structures (derive
from v1's Hz tables — read prosperos-jukebox-audio.js:16, :108, :159-235):

- `dorian`  — v1 Library: C Dorian [0,2,3,5,7,9,10] semitones
- `sycorax` — v1's "chromatic-locrian" 7-note set, derived from
  SYC_GHOST_SCALE = [311,330,370,392,415,466,494]: steps **[0,1,3,4,5,7,8]**
  (Eb E F# G Ab Bb B — 466/311 is a perfect fifth; verified by cents
  computation, see pj2-pitch.js header)
- `lydian`  — v1 Ariel: [0,2,4,6,7,9,11]
plus `ionian`, `aeolian`, `penta_major` [0,2,4,7,9], `penta_minor` [0,3,5,7,10]
for future use.

Tuning systems: "et" computes `tonicHz * 2^(semitones/12)`. "ji" maps each
mode step to a nearby 5-limit ratio via a ratio table (document choices in a
comment; e.g. 2:16/15, 3:6/5, 4:5/4, 5:4/3, 6:45/32, 7:3/2, 8:8/5, 9:5/3,
10:9/5|16/9, 11:15/8). JI is per-degree-from-tonic (like kolob), octave-folded.

Pure module: no audio nodes, no RNG. Deterministic.

## 3. PJ2.Clock — lookahead transport (the family's missing piece)

Every sibling schedules with recursive `setTimeout` and prays. PJ2.Clock is a
proper lookahead scheduler (Chris Wilson "tale of two clocks" pattern):

```js
PJ2.Clock.create(ctx, opts?)   // ctx = AudioContext (or harness mock exposing
                               // .currentTime). opts: {tickMs=25, aheadS=0.25}
Clock:
  .start() / .stop()           // stop() cancels ALL pending events
  .now()                       // ctx.currentTime passthrough
  .at(timeS, fn)               // absolute audio-clock time → id
  .in(deltaS, fn)              // relative → id
  .cancel(id)
  .lane(name)                  // → Lane (created on demand, cached)

Lane:                          // replaces the per-layer timer Sets of v1
  .at(timeS, fn) / .in(deltaS, fn)
  .every(fn)                   // self-rescheduling loop: fn(t) is called with
                               // the event's exact audio time and MUST return
                               // the delay in seconds until its next fire
                               // (or null to end the loop)
  .rate                        // get/set multiplier ≥0.05; scales the returned
                               // delays of .every loops; changing it
                               // reschedules the lane's pending events
                               // proportionally (v1's rescheduleLayer, done right)
  .cancelAll()
  .pending()                   // count, for tests
```

Semantics:
- The tick loop (setInterval tickMs) fires every callback whose time falls
  within [now, now+aheadS), passing the EXACT scheduled audio time `t` so the
  callback schedules its nodes sample-accurately at `t`, not at "now".
- Callbacks fire in scheduled-time order within a tick.
- Background-tab resilience: on `document.visibilitychange` → hidden (guard
  with `typeof document !== "undefined"` for the harness), widen aheadS to
  1.6s; restore on visible. Timers clamp to 1s in hidden tabs; the widened
  window must cover that.
- Injectable timer functions: `opts.setInterval/clearInterval` so the harness
  can drive a virtual clock. Default to globals.
- No drift: absolute times only, everything derived from ctx.currentTime.
  A `.every` loop computes next = t + delay (from the *scheduled* t, not from
  wall-clock now).

## 4. PJ2.Voice — graph plumbing

```js
PJ2.Voice.buildBus(ctx, opts?)  // → Bus. Master chain (match kolob's, which is
                                // the family's best): voicesBus → glue
                                // DynamicsCompressor (ratio 1.7, knee 30) →
                                // masterGain → tanh saturator (gentle,
                                // buildSatCurve amount≈1.5) → limiter
                                // compressor (-18, 3:1) → out.
                                // Route through window.MskyBackgroundAudio if
                                // present (see kolob-audio.js:258-267), else
                                // ctx.destination.
Bus:
  .input                        // node: layers connect here (voicesBus)
  .masterGain                   // for volume control + analyser taps
  .setMasterVolume(v) / fadeTo(v, s)
  .attachAnalyser(analyser)

PJ2.Voice.reverb(ctx, spec)     // → {send, output} convolution reverb unit
  // spec: {decayS, preDelayS, wet, brightness (HF-damp exponent), ripple?}
  // Generated-IR convolver like buildIR in kolob-audio.js:312 /
  // bardo-audio.js:278: exponential-decay noise, separate HF-damping
  // envelope, optional slow amplitude ripple on the tail. Stereo, decorrelated
  // channels. output connects to a Bus.input. Multiple instances = multiple
  // spaces (v2 will want per-track rooms).

PJ2.Voice.pannerPool(ctx, destNode, slots=3)  // → {at(pan) → GainNode}
  // Pooled StereoPanners at fixed positions (zankyo/kolob optimization —
  // v1 allocates one panner per note). at(pan) returns the input gain of the
  // nearest slot.

PJ2.Voice.env(param, t0, segments, base=0.0001)
  // Click-safe envelope writer. segments = [[dt, value], ...] cumulative from
  // t0. Starts with setValueAtTime(0, t0) + linear ramps; use
  // exponentialRamp only when both endpoints > 0. Returns end time.

PJ2.Voice.adsr(param, t0, {a, d, s, r, peak, durS})  // convenience over env()

PJ2.Voice.budget(maxVoices)     // → PolyphonyBudget
  .claim(nNodes, endTimeS)      // → token | null if over budget (caller then
                                // SKIPS the note — graceful thinning, no steal)
  .release(token)               // auto-released after endTimeS via the clock
                                // if caller forgets; takes (clock) via .bind(clock)
  .active()                     // current count, for tests/telemetry
  // Purpose: hard ceiling so fugal/tutti moments can't balloon the graph
  // (every sibling review flagged unbounded node growth).

PJ2.Voice.noiseBuffer(ctx, seconds=30)   // shared white-noise buffer, cached
                                         // per-ctx; .source(ctx) helper with
                                         // random offset read (unseeded
                                         // Math.random is FINE here — texture,
                                         // not music: zankyo-audio.js:45 rule)
```

## 5. _harness.js — executable spec (dev-only, Node)

Follow the sibling pattern (read zankyo/_harness.js and kolob/_harness.js
first): mock `window`, mock AudioContext (params record their automation
calls), virtual setInterval/setTimeout priority queue advancing a `vnow`
clock, `eval` the real module sources unmodified, run simulated time.

Phase 0 assertions (hard-fail with nonzero exit):
- RAND: same seed ⇒ identical 1000-draw sequence; fork("a") ≠ fork("b");
  fork determinism (same parent seed + label ⇒ same sequence); pickW
  distribution sanity (10k draws, weights respected within 5%).
- PITCH: dorian/lydian degFreq matches v1's published Hz tables within 0.5
  cents at reference degrees (hard-code a few expected values from
  prosperos-jukebox-audio.js:16 and :159); snap(degFreq(d,o)) is identity;
  ji tuning: every degree within 20 cents of its ET cousin; modulate()
  changes the table atomically; commonTones symmetric.
- CLOCK: 500 events at randomized times fire exactly once each, in order,
  with their exact scheduled t values; .every loop over simulated 300s shows
  zero cumulative drift (next times form an exact arithmetic-ish series from
  returned delays); lane.rate change rescales pending events; stop() leaves
  pending()===0; hidden-tab simulation (fire visibilitychange with 1s timer
  clamp) drops zero events.
- VOICE: env/adsr never ramp from a non-anchored value (mock detects ramp
  without prior setValueAtTime/anchor); budget refuses claims past max and
  auto-releases by endTime; pannerPool allocates exactly `slots` panners
  regardless of call count.
- Zero uncaught exceptions across the whole run.

Print a verdict table like zankyo's harness. Keep it runnable as
`node _harness.js [simSeconds]`.

## 6. substrate-demo — audible smoke test

`substrate-demo.php` + `substrate-demo.js`: a bare page (no styling beyond
readability) with Play/Stop, a seed input, and a mode selector (dorian /
sycorax / lydian). On play: build Bus + one reverb space, create a PitchField,
fork RNG streams, and run TWO clock lanes — a slow drone lane (two-note dyad,
10s cycles) and a melody lane (.every loop, seeded random-walk over the field,
Karplus-Strong-ish pluck or simple filtered saw — keep the patch trivial, it's
a substrate test not music). A third button "modulate" calls field.modulate to
a new tonic a fourth up, demonstrating already-sounding notes don't retune.
Demonstrate lane.rate with a slider. Log scheduled-vs-actual timing deltas to
the console so we can see the scheduler's accuracy.

## Ground rules for all agents

- ES5-flavored style like the siblings (var, function declarations, IIFEs) —
  match the house voice. `const/let` acceptable but don't introduce classes,
  modules, or async/await.
- Every file header: a comment block stating the module's job and its place in
  the v2 architecture, in the reflective voice the siblings use.
- Do NOT touch anything in ../prosperos-jukebox/ or other sibling folders
  (read them freely).
- Keep each module dependency-light: Rand and Pitch depend on nothing; Clock
  depends on nothing but its injected ctx/timers; Voice depends on nothing;
  only the demo and harness compose them.
