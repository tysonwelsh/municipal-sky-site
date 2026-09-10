# PLAN — ARIEL: flights and songs

A design plan for the Ariel track of Prospero's Jukebox v2, for owner review.
Not a spec yet — a discussion document. Everything here rides the as-built
machinery (Conductor/Air/Motif/Harmony/Clock/Voice) and the Phase 3 Fx
design; the aesthetic constants bind absolutely: continuous ambient first,
quick WITHOUT busy, nothing startles, intensity 0.04–0.65.

The dramaturgy sketch, restated: quick alternation of brief melodic SONGS
and fast scattering FLIGHTS; a signature motif returning changed all
evening; the evening ends by ascending out of register — "to the elements
be free."

---

## 1. DRAMATURGY

### Scene types

Ariel is conversational and quick where the Library is settled and long.
Six scene types, alternation as the spine:

| scene     | durS    | intensity curve                          | airLimit | overlap |
|-----------|---------|------------------------------------------|----------|---------|
| alighting | 40–80   | 0.04 → ~0.30 smoothstep bloom            | 1        | 0.05    |
| song      | 50–110  | plateau 0.30–0.44 + slow wobble          | 2        | 0.20    |
| flight    | 25–60   | 0.35 + 0.22·sin(πx) — peak ≤ 0.60        | 2        | 0.25    |
| hover     | 45–90   | 0.12 + 0.10·(1−x)^1.3 — the still scene  | 1        | 0.08    |
| swirl     | 45–90   | 0.42 + 0.23·sin(πx) — peak ≤ 0.65        | 1        | 0.12    |
| release   | 50–90   | 0.25 → 0.05 decay (register RISES, §1c)  | 1        | 0.04    |

plan(): alighting → 2–4 (song, flight) pairs → hover (~60% of evenings)
→ swirl (~50%, tide-biased) → release. The pairs are the "quick
alternation"; with scenes this short an evening has 7–11 boundaries where
the Library has 5–8, so joints must lean even harder on "nothing" (~40%
of draws) and breeze-dips — more boundaries, not more events.

**Songs vs flights, and the air.** Songs are melodic and air-held exactly
like Library phrases: the whistle claims, sings 3–9 notes, margins
rnd(2,5)s (tighter than Library's 3–8 — Ariel converses faster).
Flights are gesture-clouds: 4–10 rapid notes over 1.5–4s from flutter or
a chime burst. Recommendation: flights are NOT air-exempt — each cloud
takes ONE claim covering the whole cloud + margin. Air-exempt texture is
how "quick" becomes "busy"; one-claim-per-cloud keeps flight density
readable as a single speaker moving fast, and the harness can still rule
concurrency with limit+1. airLimit 2 in songs AND flights (two speakers
is Ariel's norm the way it was the chapters' exception), 1 everywhere
contemplative.

### Evening length

240–600s (4–10 min), shorter than Library's 6–18: durS = 240 +
360·(0.7·u + 0.3·(1−tide)) — see tide below for why gale shortens.
Pair count follows the budget (2/3/4 as durS crosses ~360s/~480s).

### The tide — "weather aloft"

periodPerfs [3, 6] (faster than Library's [4,7]; the evenings are shorter,
the weather should still move per listening session). Labels:
`["still-air", "rising-thermals", "gale", "clearing"]`.
Biases: gale → shorter evenings, flight durations +20%, swirl p up to
~0.7, sea-change p up (§2); still-air → longer, songful, hover nearly
certain, flutter rests more. The tide tilts the song:flight balance the
way the Library's tide tilts chapter count.

### The release — upward dissolution, concretely

Prior art: BARDO's decompose (bardo-audio.js:1004) drops interior notes
and stretches what remains. Ariel inverts the spatial direction: the idea
doesn't sink into the drone, it climbs out of it. Four coordinated moves
over the scene:

1. **Register migration.** Every motif.request in release gets a register
   bump that grows with x (＋1 octave by x≈0.6, +2 by x≈0.9 for the
   whistle). Transform tilt: fragmentHead + transpose(up) — beginnings
   outlive endings here (the Library's candle-out keeps tails; Ariel
   keeps heads, because what ascends is the *opening* of the idea).
2. **Texture thinning.** Margins double across the scene; flutter stops
   by x≈0.5; the bass speaks last at x≈0.4 — one final root planted an
   octave above its floor, then silence below (the ground lets go).
3. **The drone lifts.** The breeze pad's cycles are ~15–25s with 2–3s
   overlaps (v1: cycleMin 15/max 20, fades 3s); each NEW cycle in release
   voices its dyad one octave higher than the last and drops the
   sub-octave triangle. Nothing sounding retunes — the pad climbs by
   generational replacement, which is exactly what the cycle machinery
   already does.
4. **The room opens.** roomBlend balance ramps toward ~0.85 (the sky
   room, §5) and the delay send rises to its Ariel dose — the last
   fragments are mostly echo by the end.

**The seam.** Intensity ends ≤0.05 but the HIGH pad tail is still ringing
(chainOverlapS [6, 14]). The next evening's alighting starts the breeze at
the normal low register and — this is the trick — re-grounds the field:
`field.modulate({tonicHz: 349})` at the seam, atomic, never retuning the
ringing tail (kolob's straddle lesson makes this free). The descent back
to earth IS the next opening: high tail above, low pad blooming beneath,
no dead air ever. This reset also permanently retires the sea-change
tonic-ratchet quirk (pj2-harmony.js:508) for Ariel by construction.

---

## 2. HARMONY — Lydian floating

Field: lydian [0,2,4,6,7,9,11], tonic 349 (F4 coordinates; v1's world).
In-scale triads: I (F), II (G — MAJOR, the Lydian signature), iii (Am),
#iv° (B°), V (C), vi (Dm), vii (Em).

**The grammar: two homes, no dominant.** Lydian floats because two major
triads a whole step apart (I–II) share no leading-tone gravity. v1 knew
this: the breeze pairs were F–C, G–D, A–E fifths + the F–B tritone — roots
I, II, iii plus the #4 color. Authored table intent (numbers to be tuned
in the module, reasoning binding):

- **I** — home, lightly held: big weights to II (the float) and iii,
  real self-weight (planing repose), V as *color* only.
- **II** — the second home: back to I, up to iii, self-weight nearly as
  large as I's. I↔II oscillation should be ~40% of all motion — that
  oscillation IS the Lydian planing.
- **iii** — the drift chord: to II or I, occasionally vi.
- **V** — DE-FUNCTIONALIZED: low occupancy, and it prefers moving to II
  or iii over I. Harness caps V→I share (§7) so dominant gravity can
  never creep back in through tuning.
- **#iv°** — never as a sounded triad root (weight ~0); the #4 lives in
  MELODY (v1's Lydian-gesture whistle motif, the bass's 0.15-chance #4
  offset) and in the halo, not in the pad.
- **vi, vii** — shadow and passing, rare.

Harmonic rhythm faster than Library: step every 10–22s, scene-scaled
(slower in hover/release).

**Cadences lift instead of settle.** Ariel's kinds:
- `lift` (house cadence): I → II — arrives a step UP on a major chord;
  used entering flights and mid-evening. It's a cadence that opens a door
  rather than closing one.
- `float` (the "amen"): II → I, both chords voiced with the arrival's
  soprano ABOVE the approach's — falls a step, rises in register; into
  hover and release.
- `up-half`: (current) → II, the mid-evening comma answered by the next
  scene.
Same two-chord contract, ≤1.5 dB, arrival on the boundary t. Cadence draw
rate slightly lower than Library (~50–65% of boundaries — with this many
boundaries, restraint).

**Sea change: more frequent, always upward.** p = 0.5 + 0.25·tidePos
(gale turns more). Targets weighted TRUE-heavy — [["true", 3],
["reroot", 1]] (the reverse of Library) — because rerooting the lydian
collection LEAVES lydian (deg 4 → ionian, deg 1 → mixolydian), and the
float is Ariel's identity. TRUE = tonicHz × 4/3 (F→Bb lydian), still
upward-feeling via the register lift the executor already gives the
melody's pivot landing. The one reroot target: degree 4 (→ ionian, the
bright cousin; still no b7, the float only softens). Placement biased
toward entering swirl (w3) else a flight→song boundary (w1). The
alighting tonic reset (§1c) means the lift never compounds across nights.

**Module shape.** pj2-harmony's GRAMMAR/cadence kinds/TARGETS are
Library-authored module constants. Proposal: promote them to per-
dramaturgy authored tables keyed by `dramaturgyName` (which create()
already takes), Library rows byte-identical. Additive, harness-checkable.

---

## 3. MOTIF — the signature, and who works it

**The signature motif is the theme machinery, exploited.** The working
set (1 theme + 2 subsidiaries), genealogy with the every-3rd-gen ancestor
tether, and gen-9 renewal are ALREADY "one motif returning changed with a
memory of its origin." Ariel configures rather than builds:

- KIND_POOLS for Ariel scenes tilt hard to develop/recall of the theme:
  song [develop 4, answer 2, fresh 1, recall 1]; flight [develop 3,
  fresh 2] (flights splinter the theme, mostly); swirl [develop 1] (like
  seizure); hover [recall 3, develop 2]; release [recall 4, develop 1]
  with the register/fragmentHead policy of §1c. Fresh weight is LOW
  everywhere after alighting — an Ariel evening is about one idea flying.
- **Ariel's ghost IS the signature crossing the seam.** extractGhost
  already returns the deepest-developed head fragment. Proposal: at
  seedGhost, Ariel seeds it as a SUBSIDIARY (Library behavior) but with
  p≈0.5 promotes it to THE THEME of the new evening — some nights the
  same bird returns with different feathers; renewal at gen 9 is the
  natural forgetting. (Open question 1.)

**Voice weight rows** (new VOICE_WEIGHTS entries; existing table shape):

- `whistle` — the singer: sequence 3, transpose 2.5, ornament 3 (bends
  and turns are its whole v1 vocabulary — trill, sigh, climb), augment 2
  (the loneTone habit), fragments/diminish low. v1's seven whistle
  cluster builders (phrase/loneTone/climb/sigh/lydianGesture/birdCall/
  trill, audio.js:5150–5308) become RENDERING flavor — articulation
  chosen at render time from the motif's shape (rising → climb
  articulation, etc.) — not competing generators; the motif engine is
  the one brain.
- `chime` — the fragmenter: fragmentHead 3.5, fragmentTail 2.5,
  diminish 2.5, sequence 2, augment near 0 (a bell rings, it doesn't
  breathe). Registers +1 (v1's chimes lived F5–E6).
- `flutter` — pure ornament: diminish 4, fragmentHead 3, sequence 2,
  everything else ≤0.5; register +1; short phrases only. Flutter never
  posts to the ledger and answers only "imitate" — it decorates, it
  doesn't argue.
- `bass` — does NOT request motifs. It keeps its v1 soul (§4).

SCENE_TILT gains Ariel's scene keys (song ≈ chapter's tilt + ornament;
flight ≈ seizure's; hover ≈ reverie's; release = fragmentHead 2,
transpose 1.6, augment 1.3). Markov tables: port ARIEL_CHIME_MARKOV /
ARIEL_FLUTTER_MARKOV / ARIEL_WHISTLE_MARKOV (audio.js:163–193) verbatim
into VOICE_TABLES — v1's ear-tuned DNA, same as the Library port.

---

## 4. VOICES

**Ports (bodies faithful to v1):**
- `breeze` (landscape drone): 2 sines at a fifth + 0.4-chance sub-octave
  triangle + high-passed 6 kHz hiss mist (audio.js:4695–4800); now voices
  harmony.current's root+5th instead of the fixed four pairs; the
  F–B tritone pair survives as a low-probability voicing flavor when the
  chord is I (the pad itself occasionally breathing the #4).
- `whistle`: flute PeriodicWave + 5.5 Hz vibrato + breathy 1800 Hz
  bandpass noise, mid-note bends (audio.js:5051).
- `chime`: paired bell-wave oscillators ±2–4 cents, 1.5–2.5s decay,
  burst-and-breathe with the lone-ping-in-the-pause habit (:4804).
- `flutter`: fast triangle notes, ~80 ms spacing, ±2 cents (:4915).
- `bass`: the additive triangle 3-partial electric-bass voice, peak 0.14
  (:4564). **Its arc-following character is the port that matters**: v1's
  arielBassIntensity (two coprime sines + bounded drift, :4535) was the
  ONLY narrative arc in v1 — in v2 the conductor IS that arc, so the bass
  reads conductor.intensityAt(t) (plus a weather channel for the drift's
  wobble) and keeps everything downstream verbatim: pace ×(1−I·0.6),
  flourish/reach/3-note-gesture probabilities scaling with I, the
  5-figure remembered-flourish buffer with verbatim/retrograde/octave
  recall, arrivals armed by each harmony step. v1's private arc is
  promoted to the whole track's arc — honored, not discarded.
- `bubbles` + ambient pool: rising-gliss bubbles fold into the ambient
  one-shot pool alongside birdsong, breeze_gust, sparkle, leaf_rustle,
  cricket, wind_chime, bumble_bee, bubble_pop (:5394–5710) — all
  weather-gated, snap()ped where pitched. `giggle` is the one v1 sound I
  would retire: a human voice startles in the v2 aesthetic (question 5).

**New voices (owner pre-approved 1–2):**
1. `aeolian` — bowed-glass/wind-harp: noise-excited high-Q resonant
   filters (or slow-attack sine partials) sounding 1–2 tones of
   harmony.current, attack 2–4s. What Ariel lacks: any sustained voice
   between pad and whistle. Dual role like the singing hum: landscape
   shimmer most of the time, occasional third melodic speaker (slow
   augmented theme statements — makes song-scene overlap real), and the
   consort body for cadence lifts. It is also who hums the #4 against a
   I chord — the tritone as light, not tension.
2. `gust` — a shaped wind swell (filtered noise, 4–8s) that is
   simultaneously: a joint gesture (Ariel's drone-breath equivalent), a
   weather-channel event made audible, and the release scene's exhale.
   Landscape, never claims air, nearly free to build.

No grit bus — that is Sycorax's.

---

## 5. FX — the delay showcase

pj2-fx.js is not yet built (Phase 3 spec'd); Ariel's needs should shape
it rather than bend around it.

- **Second delay instance, differently configured.** The Fx.delay caps
  (feedback ≤0.55, wet ≤0.4, drift ≤0.01s) are per-instance and multiple
  instances are legal by construction. Library sips (fb 0.22, wet 0.18);
  Ariel runs its own instance near the caps: timeS ~0.32, feedback ~0.48,
  damp ~2800 (brighter tail than Library's 1600), wet ~0.32, drift 0.008.
  Chime and flutter always send; whistle per-phrase p≈0.5.
- **Multi-tap without new machinery:** a second parallel instance at
  timeS ~0.53 (non-rhythmic golden-ish ratio to 0.32), lower wet (~0.15),
  fed from the first's output — two walls at different distances.
- **One genuinely new capability worth adding: `thin`** — an optional
  highpass in the feedback loop whose cutoff climbs slightly per pass, so
  every repeat is lighter than the last. Echoes that ASCEND as they
  recede: mechanically trivial (one BiquadFilter in the loop), and it is
  the delay-domain twin of the release scene. Pitch-shimmer (true
  octave-up feedback) I recommend AGAINST: real pitch-shifting is
  granular machinery foreign to the house style; the sympathetic halo
  fed FROM the delay's wet output (below) buys the shimmer aura honestly.
- **Halo:** sympathetic bank tuned to lydian degrees {0, 1, 3, 4} + two
  octave-tonic strings — the #4 (degree 3, B) rings in the halo where the
  pad won't voice it. Excited by chime + whistle sends AND a small tap of
  the delay's wet return (echo exciting strings = the shimmer). Level
  follows a weather channel; rises through release rather than dropping
  (the opposite of Library's candle-out halo).
- **Rooms:** v1 Ariel ran decay 3.0, hfDamp 6.0, preDelay 15ms, wet 0.35.
  v2 pair: close decay ~1.8 bright; "sky" decay ~5.2 with GENTLER HF
  damping than Library's wide room (open air, not a dark hall). Balances:
  alighting 0.25, song 0.3, flight 0.55, hover 0.7, swirl 0.5, release
  ramp → 0.85.
- **Weather channels aloft:** `gustiness` (flutter/ambient density, breeze
  LFO depth, gust one-shot gate), `altitude` (register bias nudge ±, halo
  level), `shimmer` (brightness/filter cutoffs, delay wet ±0.05),
  `thermals` (gapMul). Same Fx.weather spec, Ariel-named.

---

## 6. ACROSS EVENINGS

- The **signature-as-ghost** (§3) is the main carry: fragment of the
  deepest descendant, p≈0.5 promoted to next evening's theme.
- **The feather:** the release's final sounded whistle degree becomes the
  next alighting's first chime ping. One note of memory — nearly free,
  and a listener who notices it has been told a secret.
- The tide carries by construction; the field does NOT (tonic re-grounds
  to 349 each alighting, §1c).

## 7. HARNESS — Ariel assertions

1. **ASCENT:** in every release, median emitted melodic freq in the last
   quartile ≥ 1.5× the first quartile; no bass note after x > 0.5; breeze
   cycle fundamentals non-decreasing through the scene.
2. **SEAM:** pad never gaps across release→alighting (≤ one cycle + 5s);
   alighting tonic = 349 ±1 cent every evening; notes scheduled before the
   seam keep their old-field Hz.
3. **SIGNATURE:** exactly one theme per evening; theme-lineage utterances
   ≥ 50% of develop/recall; carried ghost is a transposition-tolerant
   prefix of the prior evening's deepest descendant.
4. **FLOAT:** I+II jointly the top-visited roots with II ≥ 20% occupancy;
   V→I transitions < 10% of all motion; #iv° root count = 0.
5. **LIFT:** ≥ 60% of cadence arrivals land on II or voice the arrival
   above the approach's mean register.
6. **FLIGHTS:** flight-scene note density ≥ 2× song density while
   intensity ≤ 0.65 and air holders ≤ limit+1; every flutter/chime cloud
   maps to exactly one air claim.
7. **SEA CHANGE:** evening fraction within [0.4, 0.8]; executed tonic
   always ≥ pre-change tonic; never > one per evening.
8. **FX CAPS:** both Ariel delay instances within hard caps by node
   inspection; thin-filter cutoff monotone non-decreasing when enabled.

## 8. OPEN QUESTIONS (with recommendations)

1. **Ghost-as-theme p?** Persisting the signature across evenings (p=0.5
   promote-to-theme) vs Library's subsidiary-only ghost. *Rec: 0.5 — some
   nights the same bird, and gen-9 renewal keeps it from fossilizing.*
2. **Tonic reset at alighting** — hard re-ground to F 349 (kills the
   ratchet, enacts the descent) vs letting lifts drift home over nights?
   *Rec: hard reset; the seam story is better and the harness simpler.*
3. **Flights: one-claim-per-cloud (rec) or air-exempt texture?** *Rec:
   one claim — "quick without busy" is enforced, not hoped for.*
4. **Second new voice:** aeolian only, or aeolian + gust? *Rec: both —
   gust is nearly free and triples as joint/weather/release material.*
5. **Retire v1's `giggle`?** A human voice may startle under the v2
   aesthetic. *Rec: retire; birdsong and bumble_bee keep the playfulness.*
6. **Fx.delay `thin` option** (highpass-in-loop, ascending echoes) — the
   one new Fx capability Ariel asks for. *Rec: yes; ~10 lines, era-safe,
   and it is Ariel's whole thesis in a feedback loop.*
