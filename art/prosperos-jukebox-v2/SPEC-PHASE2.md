# Prospero's Jukebox v2 — Phase 2 Spec: Melody & Harmony

Phase 2 replaces the placeholder melodic brains with real compositional
machinery: a hybrid improviser/composer motif engine with genealogy and a
dialogue ledger, a chord grammar with audible-but-tasteful cadences, the
"sea change" (mid-performance modulation, ~half of evenings), the ghost
(a half-remembered motif carried across the evening seam), and the hum's
dual role (bed + occasional singer, with a small voice-leading consort).

All SPEC.md and SPEC-PHASE1.md rules still bind — especially the Aesthetic
constants (continuous-ambient, subtle joints, compressed intensity, rare
overlap). Timbres/bodies DO NOT change in this phase (Phase 3 is sound).
Phase 0/1 modules may not be modified EXCEPT pj2-library.js (which is this
phase's integration site) — pj2-rand/pitch/clock/voice/air/conductor are
frozen; report suspected bugs, don't fix.

## Owner decisions (binding)

- Sea change in ~HALF of evenings (p 0.5, tide-nudged within [0.4, 0.6]).
- The ghost is IN: each evening after the first may open with a quiet
  half-remembered fragment of the previous evening's most-developed motif.
- The singing hum is IN: landscape bed most of the time, occasionally a
  third melodic speaker (this finally makes chapter overlap real).
- Cadences: A BIT MORE AUDIBLE than barely-there. A cadence is a real
  two-chord arrival voiced by drone + hum consort with the melody resolving
  onto a chord tone — but still no flourishes, no level jumps > ~1.5 dB,
  nothing percussive. Legible, not liturgical.

## New files and load order (after Phase 1's seven)

7a. `pj2-motif.js`    → `PJ2.Motif`    (improviser + composer + ledger + ghost)
7b. `pj2-harmony.js`  → `PJ2.Harmony`  (chord grammar, cadences, sea change, consort)
    then `pj2-library.js` (REWORKED in place: brains swapped, ghost + hum-sings wired)
    `_harness.js` gains a PHASE 2 section; `form-demo` monitor gains
    harmony/motif/ghost/sea-change readouts.

Load order on pages: rand, pitch, clock, voice, air, motif, harmony,
conductor, library.

---

## 7a. PJ2.Motif

```js
PJ2.Motif.create({ rng, field, harmony })
  // rng: forked stream ("motif"); field: the live PitchField (shared,
  // mutable — always read degrees/freqs at USE time, never cache Hz);
  // harmony: PJ2.Harmony instance (for chord-tone bias + resolution)
```

**Representation.** A motif is `{name, gen, chain[], notes:[{deg, durBeats}]}`.
`deg` is an ABSOLUTE scale-degree integer spanning octaves (field.degFreq
folds; e.g. deg 9 = degree 2 an octave up). `durBeats` is abstract time —
voices map beats→seconds by their own pace (intensity-scaled), so the same
motif reads slower in reverie than in a chapter. `name` is drawn from a
seeded syllable table; `gen` starts 0; `chain` lists applied transforms.

**The improviser** (v1's soul, kept): per-voice first-order Markov
transition tables over 7 scale degrees — port/adapt v1's LIB_MELODY_MARKOV
and LIB_BOX_MARKOV (prosperos-jukebox-audio.js:21-107) as starting data;
add a "hum" table (v1's LIB_HUM_MARKOV, 5-degree, projected to 7). Fresh
phrases: `fresh(voiceName, {len, register})` walks the table with
**chord-tone biasing** — multiply the row weights of degrees in
`harmony.current().chordDegs` by harmony.biasBase() (≈1.8), renormalize
(v1's markovNextChordBiased, audio.js:507-526). Phrase endings resolve:
last note snapped to a chord tone with strong bias (v1's resolveDegree
behavior). Durations: seeded from small beat cells (0.5/1/1.5/2) with
occasional held finals.

**The composer** (the ZANKYŌ/KOLOB layer):
- TRANSFORMS: invert, retrograde, transpose (scale degrees, weighted small
  intervals), augment, diminish, fragmentHead, fragmentTail, sequence,
  ornament (neighbor-tone turn). Each returns a NEW motif, chain appended,
  gen+1. Legality guards (kolob-audio.js:1397-1421 pattern): no transform
  twice running, no fragmenting below 3 notes, no retrograde of
  palindromes, no augment past ~16 beats total, ornament caps.
- WEIGHTS: transform choice = voiceWeights[voice] × sceneTilt[sceneType]
  × affinity[lastTransform] (hand-authored tables; e.g. musicbox leans
  fragment/diminish, harpsichord leans sequence/transpose, hum leans
  augment/invert; reverie tilts augment, chapters tilt sequence,
  seizure tilts diminish/fragment).
- GENEALOGY: `lineage` maps each root motif to its deepest living
  descendant; `develop()` continues from the deepest, chains 1–2 guarded
  transforms. Identity tether: every 3rd gen, graft the ancestor's first
  3–4 notes back onto the head. Renewal: at gen ≥ 9 return to the
  ancestor verbatim (gen resets).
- WORKING SET: max 1 theme + 2 subsidiaries per performance (kolob's
  discipline — an evening works ≤ 3 ideas). `newPerformance(tidePos)`
  clears and re-seeds (see ghost).

**The policy** (what a voice actually plays):
```js
.request(voiceName, {sceneType, x, tidePos}) -> {motif, kind}
  // kind: "fresh" | "develop" | "recall" | "answer" | "ghost"
  // Weighted by scene: settling favors fresh/ghost; chapters favor
  // develop/answer; seizure concentrates on the THEME (develop only,
  // tighter); reverie favors recall/augmented develop; candle-out
  // favors fragmentTail recall (the idea comes apart).
  // Checks the ledger FIRST: an overdue obligation addressed to (or
  // claimable by) voiceName MUST be answered before anything new.
```

**The ledger** (dialogue): `.post(from, kind, motif, deadlineS)` where kind
∈ imitate|invert|develop; addressed to "any" (Phase 2 keeps addressing
simple). `.claim(voiceName)` → obligation or null; overdue obligations go
to whoever asks next. Voices post with probability after a statement
(~0.35 in chapters, less elsewhere). An "answer" applies the obligation's
kind-transform to the posted motif.

**The ghost**: `.extractGhost()` at performance end → head fragment (3–5
notes, durBeats normalized) of the deepest-developed motif + its name, or
null if nothing reached gen ≥ 2. `.seedGhost(ghost)` at next
newPerformance: the ghost enters the working set as a subsidiary, and
`request` in the FIRST settling scene returns it once (kind "ghost") with
probability ~0.8, quiet statement, then it lives or dies by normal policy.

`.stats()` → {developments, answers, maxGen, transformCounts, working,
ghostCarried} for harness/UI. Emit nothing; the library narrates via its
event bus.

## 7b. PJ2.Harmony

```js
PJ2.Harmony.create({ rng, field, dramaturgyName })
```

**Grammar.** Root-motion first-order Markov over the 7 degrees of the
field, dorian-flavored authored table: gravity around i, with bVII and IV
as the main neighbors, v soft, ii as color, vi rare (author it musically;
document the table's reasoning inline). Triads built in-scale:
`chordDegs(root) = [root, root+2, root+4]` (folded). Harmonic rhythm: the
LIBRARY drives `.step(t)` from a harmony lane every 14–30s (intensity- and
scene-scaled: slower in settling/candle-out); step draws next root from
the grammar row.

```js
.current()          -> {rootDeg, chordDegs, sinceT, name}   // name like "i","IV"
.biasBase()         -> 1.8   (constant, exposed so Motif reads one source)
.resolutionDegs()   -> chordDegs of current, for phrase endings
.cadence(kind)      -> {chords: [{rootDeg, chordDegs, durS}, ...2], kind}
    // kind: "plagal" (IV->i), "half" (->v, for mid-evening boundaries),
    // "soft-authentic" (v->i but with the 7th degree NATURAL dorian —
    // no leading-tone sharpening, keep the modal color)
.voiceConsort(nParts, opts) -> [deg,...] lowest-first
    // least-motion voicing of current chord for the hum consort:
    // nParts 2–3, within a low-mid register window, no voice crossing,
    // move each part <= 2 degrees from its previous voicing when one
    // exists (state kept internally per consort id), root present.
.planSeaChange({sceneList, tidePos}) -> null | {atSceneIdx, target}
    // Called once per performance by the library after plan(). p in
    // [0.4,0.6] tide-nudged. Placement: weighted toward the boundary
    // ENTERING reverie (w3), else a mid-chapters boundary (w1).
    // target: pickW of (a) REROOT w2 — same pitch collection, new tonic
    // (C dorian -> its relative rotations, e.g. tonic to the 4th or 7th
    //  degree, mode name adjusted) — the subtlest change: no new pitches,
    //  only new gravity; (b) TRUE +P4 w2 — tonicHz*4/3, stay dorian.
.executeSeaChange(target)
    // calls field.modulate(...) atomically, re-roots the grammar to the
    // new i, resets consort voice-leading state gracefully (next voicing
    // is fresh, no crossing rule violated across the seam), returns
    // {pivotDegs} = commonTones for the melody to land on.
```

**Cadence sound (the "bit more audible" contract, implemented by the
library, defined here):** a cadence occupies the last ~8–14s before a
boundary. The drone moves through the two chords (its dyad becomes root+5th
of each), the hum consort voices them softly (even when the hum bed was
otherwise idle — the consort IS allowed to surface for a cadence), any
speaking melody ends on a resolutionDeg of the arrival chord, and the
arrival lands exactly on the boundary t (where the joint, if any, sounds).
Level lift ≤ 1.5 dB, no new attack transients. Cadence frequency: draw
cadences for ~60–75% of scene boundaries (weighted: chapter-ends and
entering reverie/candle-out almost always; after settling rarely). Kind by
context: half mid-evening, plagal into reverie/candle-out and at the
evening seam, soft-authentic sparingly at chapter ends.

## Library rework (pj2-library.js, in place)

- Wire Motif + Harmony in; fork streams "motif","harmony","seachange".
- **pluck & musicbox**: phrases now come from `motif.request`; beats→
  seconds by per-voice pace × intensity; still air-claimed, budget-claimed,
  chord-resolved endings. Post ledger obligations per the Motif section.
- **hum**: dual role. Bed as in Phase 1. SINGS with per-scene probability
  (chapters ~0.25 per opportunity, reverie ~0.15, settling/candle-out ~0.05,
  seizure 0): claims the air, states a motif.request phrase slowly in its
  vowel timbre (body unchanged — same formant patch, now pitched by the
  motif line). When a cadence fires, the hum consort (2–3 parts,
  harmony.voiceConsort) surfaces under it regardless of bed state.
- **drone**: reads harmony.current for its dyad (root+5th) instead of fixed
  {0,4}; glides/crossfades between chords on .step (slow, no retunes of
  sounding partials — new cycle voices take the new chord). Cadence motion
  per above. Sea change: drone is the seam — old-key pad fades as new-key
  pad blooms (use the chainOverlap machinery pattern).
- **ghost wiring**: at each performance end event, extractGhost →
  seedGhost into the next performance's Motif reset. Ghost statement is
  the pluck, quiet (velocity scaled ~0.6), tagged event {type:"ghost"}.
- **sea change wiring**: planSeaChange after each plan; execute at the
  planned boundary's exact t; emit {type:"seachange", target} event; ALL
  notes scheduled after execution must read the mutated field (voices
  already read at use time — verify no cached Hz survive).
- **events**: emit "cadence", "seachange", "ghost", "answer", "develop"
  (with motif name/gen) through the existing event bus so the demo +
  harness see the machinery.
- getInfo() gains {harmony: current name, motif: stats summary}.

## form-demo additions (small)

Monitor: current chord name + a one-line motif readout (theme name, gen,
developments/answers) + tide line unchanged. Log the new event types
(ghost/seachange/cadence lines). No styling ambition.

## Harness — PHASE 2 section (Phase 0/1 stay green & untouched)

Run PJ2.Library ≥ 5400s (auto-scale rules as before; < 2700s: relax
sea-change-fraction and ghost checks to "mechanism fires or is absent
without error", say so):

- MOTIF: ≥ 5 distinct transform types over the run; maxGen ≥ 3; a tether
  event/graft observed (assert via chain inspection at gen 3/6); working
  set never exceeds 3; every "answer" motif's chain ends with the
  obligation kind.
- LEDGER: obligations posted > 0; ≥ 60% answered (claimed) before expiry
  + overdue ones answered by the next speaker (no obligation outlives 2
  subsequent utterances).
- HARMONY: every root transition has nonzero grammar weight; harmonic
  rhythm within [14,30]s × scene scaling; melodic chord-tone rate: phrase-
  final notes on resolutionDegs ≥ 85%; overall chord-tone share of
  melodic notes > 45% (bias working) and < 90% (not slavish).
- CADENCE: cadence events at 50–85% of scene boundaries; arrival chord
  sounds by the boundary t; plagal share highest into reverie/candle-out;
  no cadence gain lift > 1.5 dB (inspect scheduled gain values).
- SEA CHANGE: across ≥ 5 performances, fraction of evenings with one in
  [0.25, 0.75] (expect ~0.4–0.6); never more than one per evening;
  executed exactly at a scene boundary t; melody note at/after execution
  all snap-identical to the CURRENT field (track modulate calls and check
  era by era); at least one REROOT and one TRUE target across a long run
  OR both kinds reachable by construction (inspect pickW table); drone
  has no gap through the seam.
- HUM: sings > 0 times; every sung phrase holds an air claim; consort
  voicings never cross, stay in window, land on current chordDegs; hum
  singing in seizure = 0.
- GHOST: after the first performance, whenever the previous evening
  reached gen ≥ 2, the next settling contains exactly one ghost event
  whose notes are a (transposition-tolerant) prefix-fragment of the
  extracted source; ghost statement is air-claimed and quiet.
- REPRO: same-seed full event+note stream identity still holds (this is
  the check most at risk — motif/harmony draws must all flow from forked
  seeded streams; NO Math.random outside textures).
- All Phase 0 (46) and Phase 1 (73-46=27) checks unchanged and green.

## Ground rules for Phase 2 agents

As Phase 1, plus: pj2-library.js is editable ONLY by the library-rework
agent; pj2-motif.js and pj2-harmony.js are each owned by their one agent;
the harness/demo agent owns _harness.js + form-demo.*. Interfaces above
are the parallel-work contract; as-built Phase 0/1 code is authoritative
for its own surfaces. v1 remains read-only reference. Everything musical
from forked seeded streams.
