# Prospero's Jukebox v2 — Phase 3 Spec: Sound

Phase 3 is timbre and air: the voice bodies get ported to full v1 fidelity,
plus four family-firsts — the sympathetic-string halo, real delay lines,
the continuous weather field, and per-scene room morphing. NO compositional
machinery changes: pj2-motif/pj2-harmony/pj2-air/pj2-conductor are frozen;
pj2-library.js is the integration site again. All prior specs bind
(aesthetic constants above all: nothing startles, everything reads as air).

## Owner decisions (binding)

- Delay at the FAR-WALL dose: "the far wall answers," never "echo effect."
- Ambient roster: keep Phase 1's page-turn / clock / fire-crackle, add the
  v1 Library set (owls, distant thunder, crickets — port from v1's pool)
  plus NEW rain-on-glass. All far-field, sparse, weather-gated.
- Known accepted quirk (do not fix in this phase): sea-change tonic ratchet
  (pj2-harmony.js:508).

## New file: pj2-fx.js → PJ2.Fx  (load after pj2-voice.js, before pj2-air.js)

Four independent tools, all lazy (take ctx), all harness-mockable:

```js
Fx.delay(ctx, {timeS, feedback, damp, driftHz, driftDepth, wet})
  -> {send, output, setWet(v)}
  // feedback loop: delay -> lowpass(damp) -> feedbackGain -> delay.
  // Slow sine LFO (driftHz ~0.02-0.06) modulates delayTime by driftDepth
  // (a few ms) — tape-adjacent wander, never rhythmic. HARD caps enforced
  // in code: feedback <= 0.55, wet <= 0.4, driftDepth <= 0.01s.
  // Far-wall Library defaults: timeS ~0.42, feedback 0.22, damp 1600,
  // wet ~0.18 at the send (documented in-file).

Fx.sympathetic(ctx, {nStrings, out})
  -> {input, retune(freqs[]), setLevel(v), strings}
  // Karplus-style ringing bank: per string a feedback comb (DelayNode at
  // 1/freq -> lowpass ~3000 -> feedbackGain ~0.93-0.96 capped < 0.97) fed
  // from a shared input; summed to out through a level gain (very low,
  // ~0.05 default). Never excited directly — the caller routes a small
  // send from the exciter (pluck). retune() ONLY when the caller says so
  // (scene boundaries after a sea change); glitch-free: fade the bank
  // down 0.3s, swap delay times, fade back.

Fx.weather(rng, spec)
  -> {at(t) -> {name: 0..1 ...}, names}
  // PURE modulator, no audio, no clock: deterministic value field over
  // time. spec: {name: {period1, period2, depth}, ...} — each named
  // channel = 0.5 + depth*(sin(t/p1 + φ1) + sin(t/p2 + φ2))/2 with seeded
  // phases and slightly detuned coprime-ish periods (120-600s) so it
  // never loops audibly. Always in [0,1]. Channels for Library:
  // brightness, breath, gapMul, wetTilt, haloLevel. Smoothness: |Δ| per
  // second bounded by construction (document the bound).

Fx.roomBlend(ctx, {close, wide})
  -> {sendFor(layerDefaultBalance) ... simplest workable design: two
      PJ2.Voice.reverb instances owned by the caller; roomBlend owns two
      send gains per registered layer and setBalance(x, rampS) equal-power
      crossfades ALL registered pairs; register(name, srcNode, baseBias)}
  // Balance is scene-set by the library (settling/candle-out ~0.15,
  // chapters ~0.35, seizure ~0.4, reverie ~0.65, +0.08 after a sea change
  // for the rest of the evening), ramped over 12-20s, weather wetTilt
  // nudges ±0.05.
```

## pj2-library.js rework (in place, bodies only — brains untouched)

1. **Port the v1 bodies faithfully** (read v1 prosperos-jukebox-audio.js):
   harpsichord Karplus-Strong (~lines 1380-1435: looped noise buffer,
   freq-tracked Q lowpass decay, octave sine sparkle) replacing the
   placeholder pluck body; music box (~1915-1995: velocity envelopes, 3rd
   harmonic shimmer); full formant hum (~2133-2371: vowel F1/F2 pairs,
   jitter, shimmer, slow-noise vibrato) for bed, singing, AND consort;
   layered drone (~1279-1376: triangle partials, shared tremolo LFO bus,
   sub-octave sine option). Same degrees/scheduling/events — a listener
   of the note/event streams must see NO difference (harness will assert
   stream-shape identity where feasible; at minimum: same determinism,
   same adherence, same air/budget behavior).
2. **Ambient pool**: port owls, distant thunder, crickets from v1's Library
   pool (find them in v1's ambient section); add rain-on-glass (band-
   passed noise patter: sparse filtered ticks + a soft wash, far-field);
   keep page/clock/crackle. All weather-gated (rain more likely when
   wetTilt high; crickets when quiet/late; owls rare) and tide-flavored.
   Weighted pool, still sparse — the roster grew, the DENSITY must not.
3. **Halo**: pluck body gets a small send into Fx.sympathetic (6 strings
   tuned to field degrees {0,2,4,5,6} + octave tonic — document choice).
   Retune at the first scene boundary after a sea change. Level breathes
   with weather.haloLevel and drops toward 0 in candle-out.
4. **Far-wall delay**: one Fx.delay shared; music box send always, pluck
   send with per-phrase probability ~0.3. Wet stays at far-wall dose.
5. **Weather wiring**: voices read weather.at(t) at schedule time —
   brightness → filter cutoffs/harmonic mix; breath → hum vowel openness
   + vibrato depth; gapMul → phrase/ambient gap scaling (±15% max);
   wetTilt/haloLevel as above. No per-phrase parameter jumps remain where
   a weather read can replace them.
6. **Rooms**: two PJ2.Voice.reverb instances (close: decayS 2.0, bright-
   ish; wide: decayS 4.8, darker brightness exponent), roomBlend
   registered for every layer's send; scene balances per the Fx section.
7. **Gain staging pass**: with everything ported, measure peaks via an
   offline-render-style pass in the verification harness (mock param
   inspection at minimum; document measured worst-case scheduled gains
   inline in the family tradition). Master ceiling: nothing schedules the
   master chain into the limiter harder than ~-1 dB equivalent.

## Harness — PHASE 3 section (smaller; timbre is for ears)

- FX caps: inspect built delay/sympathetic nodes — feedback gains within
  hard caps, wet within caps, drift depth within caps.
- HALO: bank retunes only at permitted moments; after a sea change the
  bank's delay-time-implied freqs match the NEW field (era-aware, cents
  tolerance); level 0-bound in candle-out.
- WEATHER: sampled every 1s over the run — every channel in [0,1], max
  per-second step under the documented bound, deterministic same-seed,
  differs across seeds.
- ROOMS: balance values only in [0,1], changes always ramped (>= 8s),
  scene→balance mapping honored (sampled at scene midpoints).
- AMBIENT: all new one-shots fire over a long run; density (events/min)
  within ±25% of the Phase 2 baseline; rain gated by wetTilt as spec'd.
- REGRESSION: ALL Phase 0/1/2 checks green and unweakened; same-seed
  event+note stream identity STILL holds (weather is seeded; delay/halo
  are audio-side only and must not touch the musical streams); pitch
  adherence era-by-era; no envelope violations from any ported body;
  budget/air invariants.
- form-demo: add weather + room-balance readout lines (tiny).

## Ground rules

As before: pj2-fx.js owned by one agent; pj2-library.js rework by another;
harness+demo by a third after both land. Frozen: all other pj2 modules, v1,
siblings. Report bugs, don't fix. All musical randomness seeded; delay
drift LFO phase MAY use the seeded stream at build time (document);
noise/IR texture stays Math.random-legal.
