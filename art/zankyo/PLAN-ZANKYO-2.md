# ZANKYŌ 2 — the station learns to be quiet, and then learns new sounds

*Analysis + plan, 2026-09-05. Not a v2 fork: `art/zankyo/` evolves in place,
the way Prospero's Jukebox v2 grew phase by phase on one substrate.*

The brief, in the owner's words: keep the random, generative, aleatoric
character and the theme — a gritty, noisy, Japanese-inflected derelict
satellite generating music nobody hears, light-years out — but make it
richer, more nuanced, more diverse in sounds, tones, textures and melodies.
It has become repetitive. Borrow what is foundational from Prospero's
Jukebox v2 and Kolob, not everything.

---

## 1. What ZANKYŌ is today (as read, `zankyo-audio.js`, 1 850 lines)

A single-file engine in the Antariksh lineage:

- **Graph:** layers → grit waveshaper (subDrone/taiko/noise) or a shamisen
  saturator or straight → one generated 6.5 s metallic reverb → master →
  tanh saturator → compressor → −1.1 dB trim → background-audio route.
  A parallel dry-grit send opens with the arc so the kyū gets close.
- **Pitch:** D3 tonic, hard-coded. Four pentatonic modes (hirajoshi,
  in-sen, kumoi, iwato) all on D; one mode per cycle, drawn from a
  lottery the meta-arc tilts dark and back. A 21-slot SCALE table is
  rebuilt per mode.
- **Form:** jo-ha-kyū as a fixed curve over a per-cycle length (300–600 s),
  a slow meta-cosine (5–8 cycles) that tilts mode weights, KIRU severity
  and density ±12%. The KIRU (cut → hush → bell → return) is the payoff.
- **Melody:** the motif engine — 6 authentic seed gestures, a working set
  of 3 per cycle (イ ロ ハ), 9 transforms with legality guards, voice- and
  phase-weighted transform grammar, genealogy with a tether every 3rd gen
  and renewal at gen 9, a dialogue ledger with deadlines, one verbatim
  reprise late in the kyū, a decomposed ghost across the cut. This is
  strong and should be kept whole.
- **Rhythm:** taiko publishes a grid (bpm 50→140 with the arc); koto and
  shamisen onsets magnetize to it above arc 0.45; the shakuhachi floats.
- **Voices:** eight layers. Sub-drone (detuned saw pairs + sub sine → LP),
  shō (saw cluster + square/5th/7th partials, one voicing, base degree 6–7),
  shakuhachi (sine + triangle + bandpassed breath noise), koto (saw +
  triangle → sweeping LP, octave sine sparkle), shamisen (saw → LP + a
  "sawari" bandpassed saw), taiko (one pitch-dropping sine + LP noise),
  noise (filtered shared-buffer noise, arc-driven), ambient (9 events, flat
  weights, ungated by phase).
- **Timing:** recursive `setTimeout` per layer (the family's original
  clock; browsers clamp it to 1 s in background tabs).

Harness baseline (`node _harness.js 1800 3042`) — 30 simulated minutes:

| measure | value |
|---|---|
| notes | 5 780 |
| shakuhachi / koto / shamisen notes | 1 197 / 1 884 / 1 994 |
| shō cluster notes | 705 |
| cycles / KIRUs | 4 / 3 |
| motif developments / answers | 384 / 176 |

That is ~3.2 melodic notes per second, all half-hour long, from the same
three bodies. The engine is never *not* busy.

## 2. Why it feels repetitive — the diagnosis

Each point below is grounded in the code, not in impression.

1. **Every voice plays all the time.** Three melodic voices run their own
   timers with no turn-taking; the ledger only *adds* obligations;
   heterophonic shadows add more. The texture is a three-voice tangle at
   nearly constant density from minute 1 to minute 30. There is no solo,
   no voice sitting a cycle out, no real *ma* except the KIRU's hush. Both
   siblings invented a courtesy protocol (Kolob's AIR, `kolob-audio.js:424`;
   PJ2.Air) precisely to fix this.
2. **One shape, every cycle.** jo→ha→kyū→release with the same curve, the
   same entrance order (drones, shakuhachi +4 s, koto +10 s, shamisen +16 s,
   taiko +22 s), every layer seated every cycle. The meta-arc changes the
   *weights*, never the *arrangement*. Kolob plans a different order of
   service each meeting (sections dropped, swapped, doubled); the Jukebox
   plans a scene list per performance. ZANKYŌ has nothing at the scene level.
3. **Five fixed timbres.** Each instrument is one recipe with no per-note
   variation beyond knob settings: no register-dependent tone, no pluck
   position, no velocity law, no breath formants, no overblowing. The ear
   learns each patch in a minute and never hears anything new from it.
4. **One tonic forever, six seeds forever.** D3 is a constant; the four
   modes are colors of one D. The seed pool is 6 gestures drawn 3 per
   cycle, so by cycle 3 every "new theme" is a rerun. The shō always
   voices the same close cluster in the same place.
5. **The taiko is thin.** 2–10 beats, ~50–95% hit chance, beat or half-beat,
   one drum sound, no pattern vocabulary, no base pulse vs. accent, no
   kakegoe. Rhythmically the engine has one idea.
6. **One static room.** A fixed synthetic reverb; no phase-dependent space,
   no delay line, no sympathetic resonance, no real impulse response.
   The Jukebox has real IRs, two-room blending per scene, a far-wall delay,
   a sympathetic halo, and a weather field that drifts timbre continuously.
7. **Ambient is ungated and flat.** Nine events at fixed weights fire in the
   jo and the kyū alike; nothing rare, nothing that belongs to a moment.
8. **Parameters jump or freeze.** Brightness, breath, grit color are knob
   constants; nothing drifts. The Jukebox's weather field replaced exactly
   this kind of per-phrase dice.

None of these is a flaw in the motif engine, which is the most developed
thing in the file. The problem is the *bodies*, the *seating* and the
*room* — everything around the composer.

## 3. What the siblings have that ZANKYŌ needs

Reviewed: `kolob-audio.js` (3 600 lines) and the PJ2 modules
(`pj2-rand/pitch/clock/voice/fx/air/conductor/harmony/motif`, plus the
Library, Sycorax and Ariel tracks).

**Foundational (borrow — these are the substrate the Jukebox was built to
share; they know nothing about any track):**

| module | what it gives ZANKYŌ | why it matters here |
|---|---|---|
| `PJ2.Air` | turn-taking with soft overlap; a claim occupies phrase + margin; limit and overlapChance are functions of the scene | fixes #1 directly: silence and solo lines become structural; the kyū tangle becomes *earned* by raising the limit there |
| `PJ2.Conductor` | seeded scene plans per performance, continuous intensity crossfaded across boundaries, exact-time joints, chaining, the tide | fixes #2: each cycle gets its own plan of scenes with its own seating; jo-ha-kyū becomes the *grammar* of plans, not one plan |
| `PJ2.Clock` | lookahead transport, lanes with rate multipliers, background-tab safety | fixes the seasick timing and lets a taiko grid actually be tight; replaces the timer Set |
| `PJ2.Rand` | forked streams per subsystem | adding an ambient event stops re-rolling every melody after it; essential for iterating on this plan without perturbing what works |
| `PJ2.Pitch` | a mutable pitch field: tonic + mode + tuning, atomic modulate(), sounding notes keep their Hz | fixes #4: the station can drift key (a sea change), and the harness's "in any mode" check becomes "in the current field" |
| `PJ2.Fx` | far-wall delay, sympathetic halo, weather field, two-room blend | fixes #6 and #8 |
| `PJ2.Voice.reverb` with `irUrl` | real impulse responses, decoded once and cached | `ir/candidates/syc-r1-reactor-hall.wav` and `syc-railway-tunnel.wav` are *already in the repo* — a nuclear reactor hall is the derelict hull |

**Borrow the idea, not the code:**

- Kolob's **meeting activities** (ordinary / fast / conference / jubilee)
  → ZANKYŌ **cycle kinds** (§4.2).
- Kolob's **Ives visitations** and the Jukebox's Phase-4 apparitions →
  ZANKYŌ **visitations** (§4.6), rare seeded guests.
- Kolob's **bagpipe chanter** recipe (detuned saw pair → reed-buzz
  waveshaper → two fixed nasal formants + breath) is, note for note, a
  **hichiriki** — the gagaku double reed ZANKYŌ is missing.
- Kolob's **choir / still small voice** (pre-attenuated saw → F1/F2/F3
  bandpasses) → the station's **broken PA** voice (§4.4).
- The Library's **harpsichord pluck** (looped noise burst through a
  frequency-tracking lowpass that dulls as the string dies) → real
  **koto / shamisen / biwa strings**.
- Sycorax's **cut** (percussion cut mid-gesture, a hush *inhabited* by one
  voice, cutGain on the landscape sum, never on master) → a better KIRU.
- The Jukebox's **motif improviser** (chord-biased Markov walk births new
  ideas; the composer works them) → new seed gestures born in-scale from
  Japanese-idiom transition tables, not just the six authentic ones.

**Do not borrow:** Kolob's four-part harmony and hymn prosody (ZANKYŌ is
heterophonic and monophonic by nature — gagaku has no chords in the
Western sense, and the shō's aitake are *not* functional harmony);
Ariel's ascending dissolution; the Library's candle-out; the Jukebox's
paper skin. The faceplate, the CRT, the VFD log and the bargraph stay.

## 4. The plan — ZANKYŌ 2 in five phases

Each phase is shippable and audible on its own. The order is chosen so the
biggest perceived change (space and seating) lands first and the substrate
that everything else needs comes with it.

### Phase 0 — substrate (dev-facing; nothing new to hear yet)

Load the PJ2 substrate into ZANKYŌ rather than re-implementing it:
`pj2-rand`, `pj2-clock`, `pj2-pitch`, `pj2-voice`, `pj2-fx`, `pj2-air`,
`pj2-conductor`. They are pure, track-agnostic, ES5, harness-loadable and
already carry three tracks. Recommendation: **reference them by path**
(`../prosperos-jukebox-v2/pj2-*.js`) so the family shares one substrate,
exactly as those modules were designed; if a Jukebox change ever bites,
the fallback is a pinned copy. Owner's call — it is the one architectural
decision in this plan.

- Re-plumb the graph onto `PJ2.Voice` buses, envelopes and the pooled
  panner rack; keep the grit bus, its makeup-down and the shamisen
  saturator exactly as tuned (they were hard-won).
- Move every timer onto `PJ2.Clock` lanes (one lane per layer; the
  console's per-layer rate knobs become `lane.rate`).
- Fork `PJ2.Rand` streams: `motif`, `form`, `taiko`, `ambient`, `weather`,
  `joints`, `visit`. `?seed=` keeps working; `mulberry32` is the same core.
- Replace `TONIC_HZ`/`CUR_OFFSETS`/`SCALE` with a `PJ2.Pitch` field carrying
  the four modes (5-note collections, 12-TET; leave the door open for a
  slightly stretched koto temperament later). `degFreq` reads the field at
  use time; `fitToRegister`/`foldDeg` use `field.size`.
- Extend `_harness.js` to load the substrate (the Jukebox harness already
  does this) and add a REPRO gate: same seed → same note stream.

### Phase 1 — the air, the seating, the rooms (the repetition breaks here)

**1a. THE AIR.** Shakuhachi, koto, shamisen (and the new biwa) claim the
air before phrasing, with a margin of silence after. Landscape voices
(sub-drone, shō, noise, ambient) never claim it. Limit and overlap by
phase: jo 1 / 0.05, ha 2 / 0.25, kyū 3 / 0.5, release 1 / 0. The
heterophonic shadow is a *granted overlap*, not a free ride. Expected
effect from the harness: melodic notes fall by roughly half, solos appear,
and the kyū's density becomes a contrast instead of the norm.

**1b. Cycle plans.** Each cycle is planned (seeded, `form` stream) as a
scene list under the jo-ha-kyū grammar, and the plan varies:

- **Seating.** Which voices are present this cycle. Draws like: shakuhachi
  alone over the drones in the jo; a koto-led *danmono* cycle with no
  shamisen; a taiko-led cycle where the shakuhachi enters only for the
  reprise; a "dead station" cycle of drones, noise and ambient only.
  Every voice is *rested* about one cycle in four.
- **Cycle kind** (Kolob's meeting activity, ZANKYŌ's way): 儀式 *rite*
  (long jo, ceremonial, shō-heavy), 漂流 *drift* (kankyō-ongaku,
  ambient-heavy, the kyū barely arrives), 嵐 *storm* (short jo, noise
  wall, taiko wall), 沈黙 *silence* (mostly ma; the KIRU cuts nothing
  because nothing was there), 放送 *broadcast* (comms-vox and PA-heavy,
  static-gated). The meta-tide tilts the lottery (storms at the dark peak,
  drift and silence at the trough).
- **Sub-scenes in the ha:** a *kakeai* duet (limit 2, imitate-biased
  ledger), a koto solo, a muraiki solo breath, a taiko *oroshi*
  (accelerating roll) into the kyū.
- **Joints** at exact audio times (Conductor): a page of static, a hull
  tick, a single fūrin, or nothing (~1/3 pass silent, the Jukebox rule).
- **Continuous intensity** replaces `getArc()`'s piecewise curve; the
  bargraph and viz keep reading a 0–1 level, so the faceplate is untouched.

**1c. Rooms.** Two real IRs from the repo's candidates: the **R1 reactor
hall** (the hull — vast, slow, metallic) and the **railway tunnel** (close,
resonant, a corridor). `Fx.roomBlend` per scene: jo deep in the hull,
kyū close and dry with the grit send open, release back to the hull for
the bell. One far-wall delay (modulated, dark, low feedback — the
corridor answering, never "echo") on the koto and the PA voice.

### Phase 2 — pitch and melody (the melodies stop sounding the same)

- **Sea change.** Once every 2–4 cycles, at a cycle boundary, the field
  modulates: tonic up a fourth or down a fifth (the traditional koto
  retuning between pieces), or the station's own gesture — a **semitone
  sink** (the reactor sagging; Sycorax's rule, rare, dark-tide only).
  Sounding notes keep their Hz (the straddle lesson); the shō's cluster
  straddles the seam by design. The mode readout on the module already
  re-renders live.
- **Mode-tonic pivots.** Some mode changes pivot on a shared degree
  instead of restarting on the tonic (hirajoshi on D → in-sen on A shares
  four pitches) — the same 4 modes yield far more than 4 colors.
- **Born seeds.** Port the Jukebox improviser: a Markov walk in degree
  space with Japanese-idiom transition tables (tendency tones: the
  semitone above the tonic falls; the fifth leaps to the octave; descents
  end on the tonic with a *meri* dip). Each cycle's working set = 1
  inherited descendant + 1 authentic gesture + 1 newborn. The authentic
  pool itself grows from 6 to ~12 (add: *netori*-style tuning gesture,
  *sugagaki* koto figure, *rokudan* opening, a Tsugaru *jongara* lick,
  a *kagura* call, the *yatai-bayashi* taiko contour rendered melodically).
- **Shō aitake.** Replace the one close voicing with the eleven named
  aitake (乙, 一, 工, 凢, 乞, 十, 下, 美, 行, 比, 言 — documented
  voicings), projected onto the current mode, with *te-utsuri* (voices
  moving one at a time across overlapping cycles, the way a shō player
  breathes through a chord change). The bed becomes harmonic weather.

### Phase 3 — bodies (new sounds, tones, textures)

- **Strings.** Koto, shamisen and biwa become plucked strings in the
  Library's manner: a noise burst through a frequency-tracking lowpass
  that dulls as the string decays, with **pluck position** (a short comb
  → different tone per note), **plectrum noise** (tsume for the koto,
  bachi slap for the shamisen and biwa), a **velocity law**, and
  register-dependent decay (low strings ring, high strings snap). The
  shamisen's sawari becomes a resonant high comb that only sings on the
  lowest string, as on the instrument. Ornaments already in the engine
  (oshide press, sukui, hammer-on) stay.
- **Koto sympathetic halo.** `Fx.sympathetic` tuned to the koto's 13
  strings in the current mode, excited by the shakuhachi and the
  shamisen at whisper level, retuned only at a scene boundary after a sea
  change. Koto strings are famously sympathetic; this is the one halo in
  the family that is historically literal.
- **Shakuhachi.** Two registers with different bodies: *otsu* (low,
  dark, sine-heavy) and *kan* (overblown, breathier, more 3rd partial);
  breath through two formant bandpasses; *yuri* vibrato that blooms
  late in a long note; meri/kari as pitch *and* timbre (meri darker);
  muraiki as a real noise-dominant tone; tongue-less *atari* re-attacks.
- **Hichiriki** (new voice): Kolob's chanter recipe re-voiced — the
  gagaku double reed, piercing, with the characteristic *enbai* slide
  into notes. It takes the shō's *rite* cycles and the kyū's cry.
- **Biwa** (promoted from ambient to a voice): satsuma-biwa tremolo
  strums, huge sawari, a narrator who has no story left. Seated in
  *drift* and *silence* cycles.
- **Taiko kit.** Three drums — ō-daiko (deep, long), shime-daiko (high,
  tight, a body resonance), *ka* rim clicks — plus a **pattern
  vocabulary**: a *ji* base pulse with accents, matsuri patterns
  (don-doko-don, the *yatai-bayashi* shape), *oroshi* rolls, and
  **kakegoe** (synthesized shouts through the broken PA: formant hits with
  static, the crew calling time to nobody). The grid persists between
  patterns so the ensemble's magnet has something steady to pull to.
- **The PA.** A formant voice in the Kolob choir manner, wordless,
  reciting-tone drift, decaying into static; the station's announcements.
  Speaks in *broadcast* cycles and once, rarely, in a KIRU's hush.
- **Weather.** A `Fx.weather` field with ZANKYŌ channels: brightness
  (string lowpass, shō cutoff), breath (shakuhachi noise/vowel, muraiki
  odds), grit color (the noise layer's filter center; the grit curve's
  crud amount via a second curve crossfaded), gapMul (±15% on phrase gaps,
  seeded), roomTilt. Knob values become *offsets* on the weather.
- **Noise layer.** Grow from one filtered-noise swell to a Japanoise
  vocabulary: feedback screech (a bandpass in a gain-budgeted feedback
  loop — the Fx delay's discipline), bit-crushed static (a waveshaper
  staircase), contact-mic rumble (the sub-drone through the grit bus with
  a slow LFO), and the existing wall. Drawn per scene and by cycle kind,
  not per event.

### Phase 4 — visitations (rare guests, seeded)

About one cycle in three carries one, drawn on independent dice with the
tide tilting the odds, seated in the scene where it belongs:

- **放送 the broadcast** — a lost gagaku recording surfaces through the
  static: shō + hichiriki + ryūteki-ish flute state an *Etenraku*-shaped
  contour (shape only, no quotation), radio-filtered, and dissolve.
- **祭 the festival** — the taiko goes to a full matsuri pattern with
  kakegoe for one ha; the melodic voices lock to it hard.
- **無 mu** — a cycle where only the reactor and the ambient breathe;
  the KIRU arrives and cuts silence.
- **回線 the line** — the PA and comms-vox trade a "conversation" over
  static; nothing else claims the air.
- **鐘 the tolling** — bonshō every ~20 s across the whole jo, the hull
  ringing in sympathy.

The KIRU itself adopts Sycorax's cut mechanics: the cut lives on a
dedicated gain over the landscape sum, never on the master; the hush is
inhabited (one bell, or the PA, or the koto halo ringing out), and its
severity still rides the tide.

### Phase 5 — surface (small, follows the sound)

- Console rows for hichiriki, biwa, PA; the mixer already enumerates
  `Z.LAYERS` with a fallback label, so new layers appear the moment the
  engine lists them — only `PARAM_META`/`LAYER_META` entries are needed.
- The VFD log gains the plan's vocabulary: cycle kind, seating, scene,
  visitation, sea change.
- A `VERSION` file with the Jukebox's readable-version rule, so the
  owner can verify which build they are hearing (recommend adopting the
  same CLAUDE.md rule for ZANKYŌ).

## 5. What must not change (the character contract)

- jo-ha-kyū remains the grammar; the KIRU remains the payoff; the meta
  journey remains.
- Grit stays: the grit bus, the master saturator, the noise layer, the
  kyū wall. Darkness and noise are spent in **spectrum, register, texture
  and ceremony** — never by getting louder (the family rule). Output trim
  and compressor settings stay as measured.
- Dark pentatonics only. No triads, no functional harmony. The shō's
  aitake are color, not chords.
- Everything musical seeded; `?seed=` shareable; texture may stay
  unseeded (noise buffers, IR generation) as before.
- The faceplate, CRT, bargraph and VFD stay; nothing skeuomorphic is
  added.
- No cheer, no resolution, no ending. The station never stops.

## 6. Risks and how they are covered

- **Coupling to the Jukebox modules.** Mitigated by the Jukebox's own
  REPRO gate and by the pinned-copy fallback; ZANKYŌ's harness gains its
  own REPRO gate so any upstream change is caught at once.
- **Grit-bus onset clicks** (the documented shamisen incident). The new
  string bodies are click-safe by construction (`PJ2.Voice.env`, ramps
  from true zero) and the shamisen stays on its own saturator.
- **Resonant filters railing the compressor** (Bardo's lesson). The
  hichiriki and PA pre-attenuate before their formants, as Kolob does.
- **CPU.** Two convolvers, one delay, a six-string halo and the polyphony
  budget are what the Library already runs on a phone.
- **The harness cannot hear timbre.** Phase 3 needs ear time; each body
  ships behind an audition (the console's ♪ sample already exists per
  layer) and a bench page like `bagpipe-lab.php` for the strings and the
  hichiriki.

## 7. Sequencing and gates

| phase | audible result | gate |
|---|---|---|
| 0 substrate | none (identical output) | harness PASS + REPRO baseline |
| 1 air / plans / rooms | silence, solos, varied cycles, a real hull | melodic notes/30 min ≈ half of baseline; ≥3 cycle kinds and ≥2 seatings seen in 1 h; both IRs decode |
| 2 pitch / melody | key drift, new themes, breathing shō | ≥1 sea change per hour; seed pool ≥12; aitake ≥8 distinct voicings heard |
| 3 bodies | new instruments, plucked strings, taiko patterns, weather | audition bench per body; harness node-budget check |
| 4 visitations | rare guests | ≥1 visitation per 3 cycles over 4 h; never two in one cycle |
| 5 surface | console rows, VFD vocabulary, VERSION | UI smoke |

Phase 1 is where the owner will first *hear* the difference; phases 2–3
are where the diversity the brief asks for actually lives. Recommend
building 0→1 as one commit series and pausing there for a listen before
the melody and body work.
