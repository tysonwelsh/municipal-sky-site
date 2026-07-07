# Prospero's Jukebox v2 — SYCORAX Track Plan (discussion draft, rev 2)

Sycorax is the dark track, and this revision gives it the owner's requested
character: **a rite observed from the treeline**. Ritual / tribal-ambient
bones (slow ceremonial percussion, a low noise bed of smoke and ruin-wind,
more grit), wyrd-folk and neo-medieval blood (low chant as the principal
voice, a hurdy-gurdy-hearted drone with a buzzing trompette edge, a bowed
rebec-like string, open-fifth organum, keening phrase-ends that fall to the
flat second). Generic ancestors: ritual Nordic folk, dark early-music drone.
The dramaturgy is still **the encirclement** — gathering → (processional) →
circling → invocation → the cut → afterimage — and it still never resolves.

Binding constants hold unchanged: floor 0.04, ceiling 0.65, nothing
startles, ambient first. Darkness and noise are spent in **spectrum, register,
interval, texture, and ceremony** — never in level, never in surprise. The
mode already carries the folk: [0,1,3,4,5,7,8] on Eb (E natural = the flat
second, phrygian-adjacent) is a keening scale before we write a note.

## 1. What ports from v1 (and what each body becomes)

From `../prosperos-jukebox/prosperos-jukebox-audio.js`:

- **Drone cluster** (~2844) → **the gurdy**. v1's detuned saw clusters
  (46–123 Hz, ±3% drift, moving lowpass 150–350, sub chance 0.25, 20–28 s
  overlapped cycles) are already a hurdy-gurdy's ancestor: continuous,
  reedy, low. v2 voices it from the current pose's degrees and adds the
  **trompette** — one saw partial routed to the grit bus whose send gain is
  *pulsed* (60 ms+ ramps, +≤0.1) loosely in sympathy with frame-drum strokes:
  the buzzing bridge that makes a gurdy percussive. v1 already saturated
  this drone hotter than Library's (26 vs 12) — the instinct was there.
- **Waterphone** (~3288) → ports verbatim; it **is** ritual metal. Six
  inharmonic partials + FM bloom + body wobble + downward gliss; the
  apparition shape (long, 0.55 gain) keeps its memory job (§7).
- **Whispers** (~2938) → two descendants: a reduced **breath-bed**
  (landscape treeline murmur), and the formant DNA matures into **the
  chant** (§5) — pitched now, the principal speaker.
- **Heartbeat** (~3648) → the **proto-drum**, founding member of the new
  percussion family (§4). Lub-dub irregularity survives as ceremonial
  looseness.
- **Scrape** (~3717) → "stone-grind", demoted into the ambient pool.
- **Ghost-tone glass voice** (~3038): **dropped as a voice** — its spectral
  jobs are absorbed by the waterphone (metal shimmer) and chant organum
  (parallel hollowness). Its SYC_GHOST_MARKOV table survives as the rebec's
  melodic DNA. Rev-1's buoy-bell shrinks to a pool one-shot ("cracked iron
  bell", tide-gated). Rev-1's sibyl matured into the chant.
- **Ambient pool** (~143): reworked in §5. Room: v1's cavern (decay 4.5,
  wet 0.35) carries into the wide room (§6).

Note on the 1–2-new-voices allowance: this direction supersedes it by owner
request (chant, rebec, bone-flute, percussion are new bodies). Discipline
moves to where it belongs — the AIR protocol, sparse attempt rates, and the
polyphony budget. The room never gets busier, only stranger.

## 2. Dramaturgy — the encirclement, with a processional

New file `pj2-sycorax.js` → `PJ2.Sycorax`, facade-shaped like pj2-library.js.

**plan()**: gathering → **processional** (p = 0.45 + 0.3·tide) → circling
×1–3 → invocation (p = 0.5 + 0.3·tide) → afterimage. Raw draws: gathering
60–120 s, processional 80–150 s, circling 100–220 s each, invocation
60–120 s, afterimage 90–170 s; scaled to budget. **durationRangeS
[360, 960]** (6–16 min; dread sustains less than coziness), tide biasing
long and near: `durS = 360 + 600·(0.65·u + 0.35·tide)`.

| scene        | intensity                                 | airLimit | overlap | motif alias |
|--------------|-------------------------------------------|----------|---------|-------------|
| gathering    | 0.04 + (0.18 + 0.05·tide)·smoothstep(x)   | 1        | 0.03    | settling    |
| processional | 0.16 + (0.16 + 0.03·tide)·smoothstep(x)   | 1        | 0.08    | chapter     |
| circling     | 0.28 + 0.10·tide + 0.05·sin(2π·0.75·x)    | 2        | 0.15    | chapter     |
| invocation   | 0.36 + 0.26·sin(π·x)^1.3  (peak 0.62)     | 1        | 0.10    | seizure     |
| afterimage   | 0.05 + 0.13·(1−x)^1.6     (opens ~0.18)   | 1        | 0.02    | candle-out  |

The **processional** is the rite approaching: the frame drum settles into
its barely-gridded walk, the chant intones its first full line, the gurdy
thickens. It is the one scene with any pulse regularity, and even there the
pulse breathes (§4). Circling is the prowl (slower wobble than Library's
chapter — 0.75 cycles). **Invocation concentrates by hollowing**: chant
lifts to its top register, the gurdy adds its sub-octave, percussion
clusters accelerate, the middle empties — density and register, not loudness.
Overlap ceilings sit below Library's: this track responds, it does not duet.

**Joints**: pickW nothing 36 / drone-breath 30 / **deadened drum stroke** 16
(one muffled frame-drum touch, ≤ ambient level) / water-drip 10 /
far-thunder 8 (reserved for entering invocation, else degrades to breath).
The invocation→afterimage boundary always draws "nothing" — the cut is that
joint.

**THE CUT** (kept from rev 1 — it fits the rite even better: the moment the
observer is *noticed*). Fires whenever an invocation exists; severity =
0.4 + 0.6·tide:
- tB − 0.6 s: an indrawn breath (reverse-enveloped bandpass noise, ambient
  level). Percussion stops **mid-gesture** at tB — a cluster cut off
  unfinished is the gesture.
- tB: dedicated **cutGain** on the landscape sum (gurdy + noise bed +
  breath-bed + ambient + grit) ramps to `0.28 − 0.14·sev` over 0.25 s.
  Ramped; never touches master; one writer per param.
- **The hush is inhabited**: the proto-drum heartbeat routes around cutGain
  and beats alone; ~1.2 s in, ONE waterphone apparition enters. Held
  3 + 5·sev s. Never true silence.
- Return over 2.5–4 s into afterimage. Conductor intensity remains
  continuous throughout (the cut lives in gain-land; the 0.02/0.5 s ruler
  holds unconditionally).

**The afterimage sounds like the rite dispersed**: heartbeat slowing, chant
recalls come apart (fragmentTail via the candle-out alias), breath-bed sinks
to unvoiced, and the gurdy holds the evening's only consonance — a bare
{0,5} "afterimage pose" open fifth used nowhere else. The night's purest
sound arrives only after the violence; nothing moves onto it, so it reads
as residue, not resolution.

**Tide** — "how near the menace circles": periodPerfs [4,7], labels
`["far-off", "drawing-near", "at-the-treeline", "receding"]`. Biases:
processional and invocation probability, cut severity, evening length,
percussion density, gurdy darkness (lowpass), grit dose, pool tilt (iron
bell / chains when near; distant thunder when far).

## 3. Harmony — the pinned rite (never resolves)

**Root pinned to i forever** (kept from rev 1). Color comes from **pose
rotation** over sycorax degrees (0=Eb 1=E 2=F# 3=G 4=Ab 5=Bb 6=B), stepped
by a no-repeat pose-Markov on a slow harmony lane (22–40 s):

- "coil"   {0,2,4} — stacked-third default, already a cluster
- "sting"  {0,1,5} — the flat second against the fifth; the keen's ground
- "hollow" {0,3,6} — augmented shell (Eb G B)
- "veil"   {0,2,5} — the one near-minor-triad; the lure
- "smoke"  {0,4,6} — root, Ab, B

**Anti-cadences, now medieval.** No cadence() calls ever (harness: zero
cadence events). Boundary arrivals **darken instead of close**: pose forced
to "sting", the gurdy sinks its sub-octave in, lowpass closes ~15% — and
when the chant is speaking near a boundary, the arrival is voiced as
**organum**: an open fifth {0,5} intoned under a melodic line that falls to
the flat second over it. Dissonance carried by the line against the open
fifth — drone-and-keen, the wyrd-folk cadence that isn't one.

**The keening law.** `resolutionDegs()` returns **{1}** — pj2-motif's
unmodified resolution machinery (BIAS_RESOLUTION 4.5, OUTGOING_SNAP 0.85)
then pulls ≥ ~85% of phrase endings onto the flat second. "…before
settling": the chant *body* renders, ~40% of the time, a quiet after-tone
on degree 0 at half velocity — a body gesture, not a motif note, so the
abstract music stays honestly unresolved while the ear hears the keen sag
home and fail to mean it.

**Organum profile.** pj2-harmony's consort serves organum with a profile:
2-part, parallel-preferring, doubling table authored per degree — prefer the
in-scale perfect fifth (deg 0→5 and 1→6 are true P5s in this mode), fall
back to the fourth where the mode denies a fifth (the historical *occursus*
move; document the 7-entry table inline). Used at darkening arrivals and
under processional chant statements; never more than 2 parts.

**Sea change: essentially none.** Stasis is the identity. Proposed rare
exception (open question 4): p ≈ 0.12, "at-the-treeline" only, a
**downward-only semitone sink** (tonicHz × 2^(−1/12), same mode) executed at
the cut — the rite resumes a half-step lower; carried degrees just sound
lower. Pure tonic multiply: the accepted reroot ratchet quirk
(pj2-harmony.js:508) is never on the path.

**New code vs configuration.** pj2-harmony hard-codes the dorian grammar,
stacked-third chords, cadence shapes, reroot pools. Recommendation
(unchanged from rev 1, now with one more customer): extend
`PJ2.Harmony.create` with an optional **profile** `{grammar, chordShapeFn,
consortMode, cadences?, seaChangeTargets?}` defaulting to current Library
behavior — Phase 0/1/2 harness untouched, Ariel gets the same door. Sycorax
passes a one-row grammar (0→0), the pose chordShapeFn, `consortMode:
"organum"` with the doubling table, no cadences, the sink target.

## 4. Ritual percussion — landscape, never claims the air

One family, one lane, one stream; strokes placed at exact lane times. It
coordinates with the conductor by **reading** scene type + intensity at each
stroke (never by being scheduled by it), so it stays weather among weather,
not a click track. Bodies (all cheap, all budget-claimed):

- **proto-drum** — v1's heartbeat verbatim (sine lub-dub, 36→20 Hz dips,
  skips and triples). The rite's pulse before the rite.
- **frame drum** — dull skin stroke: filtered sine burst (~70–110 Hz, fast
  exponential decay) + a skin-noise transient (bandpassed, ≤ 30 ms), peak
  ≤ 0.05. Occasional deadened (muffled) variant.
- **log drum** — resonant wooden tone, two pitches a fourth apart (field
  degrees, oct −2), longer decay, rarer.
- **bone rattle** — 3–7 tiny noise ticks on one gain chain (the crackle
  pattern), a dry shimmer over drum strokes, never alone in the dark.

**Ceremonial pacing (the anti-groove law):** outside the processional,
every gap is drawn from a breath distribution (3–10 s, intensity-scaled) —
no grid exists to find. In the **processional** the frame drum walks at a
*barely*-gridded period (2.4–3.4 s drawn per scene, ±20% jitter per stroke)
— a pace you feel, not a beat you could count along to. In **invocation**,
1–3 **accelerating clusters** per scene: 5–9 strokes whose spacing shrinks
2.0 → 0.7 s, then a held gap (the accelerando is the ritual intensifier;
gains stay flat — speed rises, level never does). Scene map: gathering =
proto-drum only; processional = frame drum + rattle accents; circling =
loose strokes, occasional pairs (the lub-dub inheritance); invocation =
clusters + log drum; afterimage = proto-drum alone, slowing. The cut
silences everything mid-gesture except the proto-drum (§2).

## 5. The voice roster

**Landscape** (never touch the air): gurdy-drone (THE SEAM — never gaps,
trompette grit pulses), **ritual noise bed** (below), breath-bed, percussion
family, ambient pool.

**Melodic** (claim THE AIR), in order of presence:

1. **The chant** (new body; PRIMARY speaker). Low pitched voice built from
   the whisper formant DNA: two vowel bandpasses over a soft saw/pulse pair,
   slow noise-breath mixed in, seconds-long attacks. Plainchant-adjacent
   conduct: long modal lines, **narrow ambitus** (within a fifth), stepwise,
   melisma sparingly. Its Markov table is authored, not ported: heavy
   gravity to stepwise moves, a deliberate moderate self-weight (~0.25) on
   **degree 5 (Bb — the reciting tone a fifth above the final)** —
   recitation repetition is the point here, the one place the family's
   "no self-weight" instinct is wrong — and row endings that fall through
   1 toward 0. Register −1 (chest). Organum doubling at arrivals and in
   the processional (§3).
2. **The rebec** (new body): sawtooth through 2–3 fixed body-resonance
   bandpasses (set once per note — the bardo formant lesson), slow bow-noise
   attacks, occasional open-fifth double stop. Inherits SYC_GHOST_MARKOV
   (tritone/min-2 wander = the wyrd fiddle). The ornament transform is its
   mordent.
3. **The waterphone** (ported): the ritual metal, sparse (margins 6–12 s,
   the lyrical *occasional* voice, as in v1).
4. **The bone-flute** (new body; RARE): dark blown tone — triangle + breath
   noise + a whisper of overblown octave, register +1, short breath-length
   phrases. Active only in processional and invocation, ~2–3 utterances an
   evening. (Open question 3: keep or cut as roster fat.)

**Motif tables** (needs the `Motif.create opts.voices` merge — the one
motif-side code change, carried over from rev 1). Weights:

- chant: augment 3, transpose 2, invert 1.5, fragmentTail 1.5, ornament 1.2
  (melisma, capped), sequence 0.8, fragmentHead 0.6, retrograde 0.6,
  diminish 0.4 — lungs favor the whole line.
- rebec: ornament 3 (the mordent hand), sequence 2.5, transpose 2, invert
  1.5, diminish 1.2, retrograde 1.2, fragmentHead 1, fragmentTail 1,
  augment 0.8.
- waterphone: augment 3.5, transpose 2.5, invert 2, fragmentTail 1.5,
  retrograde 1.2, fragmentHead 0.8, sequence 0.6, diminish 0.5, ornament 0.3.
- boneflute: fragmentTail 2.5 (the breath runs out), fragmentHead 2,
  ornament 1.5, transpose 1.5, augment 1.2, diminish 1.2, invert 1,
  retrograde 0.8, sequence 0.6.

**Scene aliasing** (configuration, zero motif edits): gathering→settling,
processional/circling→chapter, invocation→seizure, afterimage→candle-out.

**Ledger: responsorial, not conversational.** The chant is the cantor: it
posts most (circling/processional 0.3, gathering 0.08, afterimage 0.05,
invocation 0), kind pool **[imitate 6, invert 2, develop 2]**, **long
deadlines (18–40 s)** — answers arrive late and near-verbatim, rebec or
waterphone responding like a congregation across a clearing. The track
calls `motif.post` directly from its own stream (no motif edits). Working
set seeds: theme from chant, subsidiaries from rebec (+ the carried ghost).

**The ritual noise bed** (new landscape — the "darker and noisier"): two
slow sources — **ember-smoke** (band-limited noise 200–1200 Hz, center
drifting over minutes) and **ruin-wind** (comb-filtered noise gusts, gust
envelopes 8–20 s). **The noise ceiling, precisely**: the bed's level gain is
slaved to ≤ **0.8× the gurdy bed's level gain** at all times (assertable),
per-source scheduled peaks ≤ 0.030, riding murk weather (±20%) and
intensity. Noise lives *under* the pitched drone, always — that is the
whole meaning of "not too noisy".

**The grit bus** (dosed up from rev 1): waveshaper at ~**0.75× ZANKYŌ's
curve** (v1 sycorax already ran hot), oversample 4x, then the documented
**makeup-DOWN gain ~0.4** (zankyo-audio.js:262 — the curve boosts small
signals ~27×, rails the bus, and clips every onset if you skip this). Feeds:
gurdy send (always), noise-bed send (partial), trompette pulses (+≤0.1,
60 ms+ ramps). Blend rides intensity × gritTilt weather: ≤ 0.15 in
gathering/afterimage, up to a **hard cap 0.5** at invocation peak. Transient
voices never touch the bus; a voice needing bite gets its own near-unity
tanh (the shamEdge lesson, zankyo-audio.js:279).

**Ambient pool** (weather/tide-gated, density ≤ Library baseline ±25%):
ruin-wind gust 16, ember pops 14, stone-grind 10 (v1 scrape), chains 10,
raven 10, distant thunder 10, cracked iron bell 8 (tide-near), the **keen**
6 (one distant wordless cry on the chant body, very rare, far-field — the
witch_cackle's dignified descendant). Dropped: cackle, glass_shatter,
cauldron (startle/comedy risks).

## 6. FX (against the Phase-3 pj2-fx contracts)

- **Delay — the clearing answers**: timeS ~0.62, feedback 0.30, damp ~900
  (dark), driftHz 0.05, driftDepth 0.008 (near the wobble cap — audibly
  seasick, by design), wet ≤ 0.22. Sends: waterphone always, chant p ≈ 0.5
  per line (the cantor echoed off stone), rebec p ≈ 0.3.
- **Rooms**: close = decayS 2.6, dark; wide = **the cavern, decayS 4.8**
  (v1's 4.5 + a breath), preDelay 0.04, dark brightness exponent, ripple
  ~0.08 (water on stone). Balances lean wide: gathering 0.45, processional
  0.55, circling 0.5, invocation 0.65, afterimage 0.75. Percussion sends
  mostly close (a drum is *here*; everything else is *there*).
- **Weather channels**: murk (inverse brightness → cutoffs, gurdy darkness),
  breath (chant/breath-bed openness), gapMul (±15% phrase/percussion gaps),
  wetTilt, gritTilt.
- **Halo-equivalent — the cavern's throat**: reuse `Fx.sympathetic`'s comb
  bodies as a dark resonance bank — 4 combs at degrees {0, 1, 5, 0+oct},
  lowpass ~1200 (vs the Library halo's 3000), feedback ~0.93, fed by small
  sends from waterphone and gurdy. Needs one damp-cutoff option on
  Fx.sympathetic. Retune only after the rare sink, at the cut.

## 7. Across evenings — the rite remembers

- **Motif ghost**: standard extract/seed across the seam. The Sycorax ghost
  statement is **intoned by the chant** in the next gathering (velocity
  ~0.6) — the cantor half-remembering last night's line.
- **The bruise** (kept from rev 1): carry last evening's cut severity as one
  scalar. The next gathering opens with murk + bruise·0.15, the proto-drum
  gates in bruise·0.3 earlier, and the first pose is "sting" when
  bruise > 0.5. A deep cut leaves the next evening opening warier. Seeded,
  deterministic, one number.
- Pose state persists across the seam anyway (harmony isn't reset per
  performance) — the rite resumes mid-gesture for free.

## 8. Harness — Sycorax-specific assertions

1. **STATIC-i / NO CADENCE**: every harmony step has rootDeg 0; zero cadence
   events over the run; every pose ∈ the authored table; no consecutive
   pose repeats.
2. **KEENING**: phrase-final notes on degree 1 ≥ 70%; tonic-final < 15%;
   chant after-tone gestures ≤ 50% of chant phrases and always ≤ half
   velocity.
3. **ANTI-GROOVE**: outside processional, stroke-gap coefficient of
   variation ≥ 0.25 per scene (no countable grid); processional jitter
   within ±20% of its drawn period; clusters only in invocation, ≤ 9
   strokes, spacing monotonically shrinking to ≥ 0.6 s, stroke gains flat.
4. **THE CUT**: ≤ 1 per evening, only invocation→afterimage; cutGain dip in
   [0.14, 0.28], hold in [3, 8] s, return ramp ≥ 2 s; proto-drum events
   occur inside the hold; exactly one waterphone note inside the hold;
   non-proto percussion schedules nothing in the hold; conductor intensity
   continuity (0.02/0.5 s) holds unconditionally, cut evenings included.
5. **NOISE CEILING**: sampled every 1 s — noise-bed level ≤ 0.8× gurdy
   level, always; grit makeup ≤ 0.45, blend ≤ 0.5, trompette pulse ramps
   ≥ 60 ms; graph inspection: only landscape sources feed the shaper.
6. **ORGANUM**: every organum interval ∈ the authored doubling table (P5
   where the mode allows, P4 fallback); never more than 2 parts.
7. **SEAM + CUT SEAMLESS**: gurdy scheduled-event gaps never exceed one
   cycle + 5 s across performance seams AND across the cut window; dark-pool
   density within ±25% of the Library baseline.
8. **CARRY + ADHERENCE**: bruise ∈ [0,1], same-seed deterministic; ghost
   statement voice === "chant", velocity ≤ 0.65; 100% of pitched notes
   snap-identical to the sycorax field era-by-era (sink evenings included).

## 9. Open questions (recommendations attached)

1. **Chant mouth**: wordless vowels only, or pseudo-syllabic formant
   sequences that imply speech? Recommend wordless vowels, drifting toward
   syllabic articulation only in the processional — implied language is
   potent; attempted language is kitsch.
2. **Percussion in gathering**: proto-drum heartbeat only (recommended), or
   total percussion silence until the processional? Heartbeat-only gives
   the treeline a pulse before the rite is visible; full silence makes the
   processional's entrance bigger but risks two minutes of drumless dark.
3. **Bone-flute — keep or cut?** Recommend keep, rare (2–3 utterances,
   processional/invocation only). It is the one high lonely color in a
   chest-register track; it is also the roster's most cuttable line if four
   speakers proves crowded in listening.
4. **Sea change**: pure stasis, or the rare downward semitone sink at the
   cut (p ≈ 0.12, at-the-treeline only)? Recommend the sink — stasis
   getting *worse* is very Sycorax; pure none is the safe alternative.
5. **Noise dose**: is the 0.8×-gurdy ceiling right, or should
   "at-the-treeline" evenings be allowed 1.0× (noise momentarily as present
   as the drone)? Recommend 0.8 everywhere for the first build; revisit by
   ear — under these constants the answer to "louder?" is usually "darker
   instead".
6. **The keen** (distant wordless cry in the pool): in or out? Recommend
   in, at weight 6 and far-field — the human trace that makes the rite a
   rite. Out if it ever reads as a jump-scare in listening.
