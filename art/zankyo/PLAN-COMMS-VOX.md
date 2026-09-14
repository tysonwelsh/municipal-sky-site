# ZANKYŌ — the comms vox as a voice (road map §4)

*Plan written 2026-09-14 at the owner's ask, after the fūrin (rc.63) and
the melodic DNA (rc.64) shipped. Nothing here is built yet; the owner sees
the plan first, as the road map says. The bodies family (road map §2) is
not built either — the vox does not need it, and its body knobs fold into
that family when it comes.*

## 1. Where we are

Two ambient one-shots were named for promotion. The **fūrin** is a voice
since rc.63. The **comms vox** is still the one-shot: `ambCommsVox`, three
to six stuttered syllables — a sawtooth through three fixed formants
(700 / 1100 / 2600 Hz) on scale degrees 0–4, a 2 kHz hiss under it — in
the ambient pool at weight 2 (×5 on broadcast cycles), and the second
speaker in the 回線 line visitation, where it trades a 40–90 s conversation
with the PA over static. It was sequenced after the DNA because the road
map asks it to follow the motif engine's contours, and that engine has
now changed shape. It is ready to start.

## 2. What it becomes

The road map's words: *a second speaker beside the PA: stuttered formant
syllables that follow the motif engine's contours, seated in the air and
the ledger like a melodic voice, as sophisticated in what it plays as the
others; knobs for band, stutter, how much of a word survives; a natural
carrier for 相 phasing and 騒 noise-leads on far nights.*

Name on the console: **内線 · Intercom** (naisen, the station's internal
line; the PA is 放送, the broadcast). Log tag 内線 VOX.

### 2.1 The body — the broken intercom

- **Pitched speech.** Unlike the PA, which speaks wordlessly, the vox SINGS:
  its carrier sits on the phrase's note (a sawtooth, 110–330 Hz — the
  speaking range, register `scaleIndexOf(3)` plus a little arc), with two
  formants per syllable drawn from a vowel table (the six vowels the
  numbers-station candidate already carries) and a fixed third at 2.6 kHz
  for the intercom's presence.
- **The channel.** A band by the `band` knob (0: 200 Hz–5 kHz, open;
  1: 400 Hz–2.4 kHz, a telephone), a staircase waveshaper like the
  receiver's codec, and a squelched noise floor that opens with the voice
  — the carrier keys with the mic.
- **`stutter`.** A syllable re-triggers two to four times at 60–140 ms
  with the knob's chance — the relay chattering the key. Same pitch, fresh
  attacks. This is the vox's ornament, where the shakuhachi has its bends.
- **`survive`** — how much of a word survives. Each syllable is dropped
  with chance (1 − survive); the hole KEEPS ITS TIME so the phrase's rhythm
  still reads, and the static rises in the hole rather than the line going
  dead (the receiver's lesson from rc.61: never a bare mute). Default 0.65.
- **What it says.** A born motif's syllables (the improviser names them —
  ka·ge, shi·ro …) give the vowels; an authentic gesture gets vowels drawn
  on the vox stream. So the intercom is heard saying the newborn's name.

### 2.2 The voice — the plumbing, on the fūrin's checklist plus the melodic parts

- **Layer `vox`**: `LAYERS`, volumes, rate, trim, `LAYER_PARAM_DEFAULTS`
  `{ band: 0.5, stutter: 0.5, survive: 0.65, pace: 1 }`, a presence stage
  like the PA's (1.5 kHz, +3 dB), routed into the voices' sum with a far-wall
  send (the corridor answers it as it answers the PA). Stream `vox`, forked
  by label.
- **Seating.** `drawSeating` gains `vox: chance(kind === "broadcast" ? 0.7 :
  0.25)` — it belongs to the broadcast cycles and visits elsewhere; silent on
  a dead station; in the `MELODIC` list so the seating label names it.
- **The air.** It claims like the hichiriki (sparse, a wider margin); the
  broadcast hold covers it automatically (the hold is derived from
  `weather().rel`, which gains `vox` with the largest return offset — the
  intercom is the last to speak again after a signal); the render-time
  refusal inside a hold, as every melodic note function has.
- **The ledger.** `POST_P.vox 0.3`; it posts to the shakuhachi and the
  koto; they post to it now and then. `VOICE_WEIGHTS.vox`: it splinters —
  fragmentHead 3, fragmentTail 3, rerhythm 2.5, diminish 2, retrograde 1.5,
  transpose 1.5, the rest low; ornament near zero (the stutter is its
  ornament).
- **`voxPhrase(t)`** on the hichiriki's pattern: seated → air → ledger claim
  → request (chance 0.5) → else a short walk (two to four notes) →
  `farCanonTake` → syllables → the rest walking `Motif.maMul("vox")`.
  `ownBeat` 0.5 / pace. In `MELODIC_LANES` and `MELODIC_RESTART` (the KIRU
  stops it mid-word and re-arms it after the hush). `play()` starts it at
  t0 + 34 s.
- **The line.** 回線 keeps its shape but the second speaker is the new body
  singing fragments of the cycle's theme (`Motif.request("vox")`) — a
  conversation about the music, not noises. The ambient one-shot leaves
  the pool, as the fūrin's and the biwa's did at their promotions.
- **Far nights.** Added to 相 phasing's targets (two copies of the
  intercom drifting apart is exactly what a bad line does) and to the
  bodies 騒 may leave behind or lead with; `FAR.glidePartial` on the
  carrier; `farTimeMul("vox")` on its time.
- **Surface.** Console row 内線 with band / stutter / survive / pace; the ♪
  button and the Bodies Lab audition a stuttered fragment; log tag and CSS;
  GUIDE §1 and §8; VERSION.

### 2.3 The re-base, declared

A sixth melodic voice claims the air, so the other five's grants move and
every home night's density moves with them — a deliberate re-base,
`_harness-bank.js` and `node _probe.js batch 1800 --calibrate` in the
shipping commit, as rc.64 did. The harness's `MELODIC` list and its
"every new body heard in an hour" list gain `vox`; the probe counts it as
melodic on its own (it is not in `LANDSCAPE`).

## 3. Gates

- Heard in an hour on seeds 3042 and 7; present on most broadcast cycles,
  rare elsewhere; never on a dead station.
- Node budget ≤ 1500/min and peak sources ≤ 110 on the canon seeds — the
  stutter multiplies sources, so it is scoped: one carrier per syllable
  run, re-keyed by gain, not re-created.
- Melodic density inside the new bank; phrase shapes/h ≥ 250 and
  heard-before ≤ 34 % still hold; the line visitation still 40–90 s.
- Nothing melodic inside a broadcast hold (the harness's existing count).
- The owner's listen: the body on the lab first, then a pinned night.

## 4. Sequence

1. **The body, bench-only** (dev, no bump): `voxSyllables()` and a 内線
   button on the Bodies Lab, beside the candidates. The owner hears the
   intercom before it is seated — band, stutter and survive audible from
   the lab's knobs is the acceptance.
2. **The voice** (one commit, VERSION bump, the re-base): layer, stream,
   seating, air, ledger, renderer, console row, the line, far targets,
   harness and probe lists, docs.
3. **Later, with road map §2:** its body knobs join the bodies family.

Size: about 350 lines in the engine, 30 in the UI, a dozen in the harness
and probe, plus docs. Two commits. The first is an afternoon; the second
is the larger day, most of it the plumbing above.

## 5. Questions for the owner

1. The name — 内線 Intercom, or keep "comms vox" on the plate?
2. Should it sing the newborn's name (§2.1)? Recommended yes.
3. Home in the broadcast cycles at 0.7, elsewhere 0.25 — or rarer?
