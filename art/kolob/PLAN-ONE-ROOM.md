# PLAN — ONE ROOM: seating Kolob's voices in a single space

2026-09-13. The owner's complaint, in their words: "sometimes it feels like
the tracks are separate … separate recordings just kinda layered on top of
each other and not integrated and intermeshed the way I would like them to
be." Their memory: Prospero's Jukebox v2 does something about this that
Kolob does not. This document is the diagnosis and the plan. Nothing in it
is built yet; the bagpipe shelving (v0.26) landed alongside it.

> **Status (v0.27):** Phase A is built — both rooms, every layer in both,
> the depth table, the section balances — and Phase B's machinery is in
> (Kolob's own pour now has early reflections; a measured file loads by
> `irUrl` with the pour as fallback). The **room lab** (`room-lab.php`,
> unlinked) auditions every candidate. Still pending: the owner's choice
> of room, then baking that file in (trimmed, with the CC BY-SA credit in
> the colophon). Phases C–E not started. The engine loads `pj2-fx.js` by
> relative path (decision 1 below, taken); decision 3 the owner accepted.

Companion: the bagpipe is SHELVED in v0.26 — `SHELVED = { bagpipe: true }`
near the top of `kolob-audio.js`. The voice, its params and its cycle are
all still there; it is never scheduled, the desk does not list it, and its
layer gain is pinned at zero. Deleting that one entry brings it back.

## 1. What the owner remembers

There is no "room noise" layer anywhere in the family — not in Kolob, not in
Jukebox v2 (room tone appears only in the skeeball and coinpusher plans,
where it is a machine hum). What Kolob already got, in the commits before
the wheel work, were three *glue* moves, all still in place:

- a **glue compressor** on the voices bus (1.7:1, knee 22, −20 dB), before
  the master — "a blend, not a level" (`kolob-audio.js` init);
- the **tabernacle's wet raised** to 0.44 — the comment on `TAB_REVERB`
  says it outright: "a fuller shared tail is the main glue that seats every
  voice in ONE room instead of side by side in the dry";
- the **pan slots pulled in** from ±0.65 to ±0.42 (`panAt`) — "voices panned
  to the far edges read as separate tracks."

Jukebox v2's bus is a copy of Kolob's ("matched to kolob's (the family's
best)", `pj2-voice.js` buildBus). So the master chain is not the
difference. The difference is everything *before* the bus: v2 has four
pieces of room machinery that Kolob never received.

## 2. Diagnosis — why Kolob reads as separate tracks

Kolob's chain today, per layer:

```
voice → pan slot (−.42 / 0 / +.42) → layerGain → ONE of three routes → voicesBus → glue → master → tanh → limiter
   tabernacle  decay 7.6 s · pre-delay 55 ms · wet 0.44 · generated noise IR   organ drone choir clarinet strings bells ambient
   parlor      decay 1.6 s · pre-delay 18 ms · wet 0.30 · dark                 harmonium telegraph
   dry + 0.3 whisper into the tabernacle                                       voice
```

### 2.1 Three acoustics playing at once (the main cause)

Every layer is hard-assigned to **one** room. The harmonium and the
telegraph live in a 1.6-second parlor; the choir, organ and strings live in
a 7.6-second tabernacle; the still small voice is nearly dry. When the
deacon's harmonium shadows the clarinet, the ear hears a pump organ in a
front room answering a clarinet in a cathedral. That is, literally, two
recordings from two rooms layered.

Jukebox v2 never does this. Both rooms exist, but **every layer feeds both**
through an equal-power pair of sends with a small per-layer *depth bias*
(`Fx.roomBlend`: cello +0.04, vessel +0.2, melody −0.06, halo +0.18 …), and
one global balance knob moves the whole ensemble deeper into the hall or
closer to the parlor as scenes turn (ramped 12–20 s). The instruments sit
at different distances in the *same* space, which is what a real ensemble
sounds like — a mix engineer would call it depth staging.

### 2.2 No early reflections — the tabernacle is a wash, not a place

`buildIR` pours exponentially decaying white noise. That is a plausible
late tail, but a room's *fusion* comes from the discrete early reflections
in the first 5–50 ms, and a noise pour has none. Worse, the 55 ms pre-delay
means the first 55 ms of every note is pure direct signal — every voice's
dry path is at unity — then a smear arrives. The ear files that as "a
close-miked track with reverb on the send," not as an instrument standing
in a hall.

Jukebox v2's wide rooms are **measured impulse responses** (St Margaret's
Church, York for the Library; the Tvísöngur dome for Ariel), served from
`../prosperos-jukebox-v2/ir/rooms/` with the generated pour as a fallback
(`Voice.reverb` `irUrl`). A real IR carries real early reflections; the
owner chose the Library's by ear in `room-mockup.html`.

### 2.3 Nothing couples the instruments physically

In a hall, when the choir sings, the building answers and the organ's
pipes ring a little in sympathy. Kolob has no shared object that responds
to more than one voice. Jukebox v2 has two:

- **the far wall** (`Fx.delay`): one shared, slowly drifting slap delay
  (0.42 s, feedback 0.22, damped 1600 Hz, wet 0.18) whose return feeds the
  *wide room's send*. Every melodic voice gets the same answer from the
  same wall, at the same distance.
- **the halo** (`Fx.sympathetic`): six Karplus-style strings tuned to the
  pitch field, never played directly, ringing at whisper level (0.04) when
  the harpsichord or the vessel grazes them. Two instruments exciting one
  resonant body is the strongest "same room" cue there is.

### 2.4 Nothing moves together

Every Kolob voice carries its own per-note LFO at its own random rate:
organ tremulant 5–6 Hz, clarinet vibrato 4.5–5.5 Hz, harmonium bellows
0.2–0.4 Hz, the strings' lowpass set once per pad. Nothing shared makes the
whole room brighten, darken or breathe at once; the only common signal is
`intensity()` (a dozen reads) and the section name.

Jukebox v2 has **weather** (`Fx.weather`): pure, seeded, slow channels
(brightness, breath, gapMul, wetTilt, haloLevel — periods 120–600 s) that
every voice reads at schedule time. When the brightness channel dips, the
cello darkens, the hum's vowel closes and the room tilts toward the hall —
together. That coherence is a large part of "one performance."

### 2.5 Secondary: every timbre owns a private spectral pocket

Sine organ (an octave down, sub pedal), sawtooth choir through three
high-Q formants, triangle clarinet, sawtooth-through-bandpass harmonium,
sawtooth-through-lowpass strings. Each has fixed filtering and no shared
tone shaping; nothing puts the *same air* in front of all of them. A real
room's high-frequency absorption does that for free — which is another
argument for a measured IR (2.2) — and a single gentle high shelf on the
voices bus would do a little of it cheaply.

### 2.6 Not a mixing problem: the independent clocks

Each cycle (`organCycle`, `stringsCycle`, `harmoniumCycle` …) runs on its
own timer with no shared pulse; THE AIR protocol makes the melodic voices
take turns. That is the piece's design (hymn phrases already share the
meter), so this plan leaves it alone. If the owner still hears "separate"
after phases A–D, the next place to look is a shared breath clock for the
*entrances*, not the mix.

## 3. The plan

Ordered by payoff per risk. A and B are the ones to listen to first.

### Phase A — one space, staged in depth  (port `Fx.roomBlend`)

- Replace the tabernacle / parlor / dry routing with the two-room blend:
  a CLOSE room (the meetinghouse, ~1.4 s, pre-delay 12 ms, brighter) and a
  WIDE room (the tabernacle, ~5.5 s down from 7.6, pre-delay 30 ms down
  from 55), and **every layer registered in both** with a depth bias.
  Suggested seats (negative = closer):

  | layer | bias | why |
  |---|---|---|
  | voice | −0.35 | the still small voice stays near the ear — but in the room now |
  | telegraph | −0.25 | the key is on the table |
  | harmonium | −0.15 | the deacon's parlor organ, in the same building |
  | clarinet | −0.08 | the line, a step forward |
  | bells | 0 | |
  | choir | +0.05 | |
  | organ | +0.10 | the case is at the back |
  | strings, drone | +0.15 | the landscape |
  | ambient (field) | +0.20 | outside the windows |

- Global balance set per section and ramped 12–20 s at the boundary:
  prelude / postlude 0.55 (the empty hall), hymn 0.40, testimony 0.30,
  sacrament 0.60 (the stillness has more room in it), doxology 0.50.
  `droneDuck` stays where it is (it sits before the sends).
- The `twoBandsCross` visitation and the whisper send both simply route
  into the new pair.
- Sizing: half a day. VERSION bump ("one room: every voice seated in the
  same hall at its own depth").

### Phase B — a real room  (port `irUrl` loading; audition)

- Load a measured IR for the WIDE room, generated pour as fallback.
  Candidates already in the repo under `../prosperos-jukebox-v2/ir/`
  (OpenAIR, University of York, CC BY-SA 3.0 — attribution line needed
  in Kolob's colophon, as `ir/README.md` specifies):
  `st-margarets-ncem` (a nave — the Library's choice), `lady-chapel-st-albans`,
  `elveden-marble-hall`, and `r1-nuclear-reactor-hall` (enormous — the
  closest thing on disk to the Salt Lake Tabernacle's famous tail).
- Build an unlinked `room-lab.php` in the bagpipe-lab pattern: Kolob's own
  organ chord, a choir verse and a clarinet line through each candidate,
  plus the old chain for A/B. The owner picks by ear, as they did for the
  Library.
- Improve the fallback pour while there: 6–10 discrete early taps at
  8–45 ms before the noise tail. Cheap, and it fixes 2.2 even offline.
- Sizing: an hour of code plus one listening session with the owner.

### Phase C — the far wall and the case  (port `Fx.delay`, `Fx.sympathetic`)

- **The far wall**: one shared delay (0.40 s, feedback 0.20, damp 1600 Hz,
  drift 0.03 Hz / 4 ms, wet 0.15) returning into the WIDE room's send.
  Sends hang off each layer's *own* gain so a muted stop stops speaking to
  the wall: clarinet 0.35, bells 0.40, choir 0.20, harmonium 0.20, voice
  0.15. Organ, drone and strings do not send (a wall answering a pad is
  just more pad).
- **The case**: six sympathetic strings tuned to the meeting's own
  harmonic series (F0 × 2, 3, 4, 5, 6, 8 — the drone's partials, so the
  case rings in just intonation with the tonic), level 0.04, feedback
  0.95, damp 3000 Hz. Excited by bells 0.12, clarinet 0.08, choir 0.06,
  organ 0.05. Retuned once per meeting in `planMeeting` (F0 changes there;
  the retune is glitch-free by construction in `pj2-fx.js`). In the fiction:
  the organ pipes humming when the choir sings.
- Sizing: half a day. Both are ports; the DSP caps and lessons in the
  `pj2-fx.js` header carry over verbatim.

### Phase D — weather  (port `Fx.weather`)

- A Kolob spec: `brightness` (strings / clarinet lowpass, organ stops mix),
  `breath` (choir vowel, harmonium bellows depth, clarinet vibrato depth),
  `gapMul` (multiplies the existing `gapMul()`), `wetTilt` (room balance
  ±0.05). Four seeded draws per channel at `planMeeting`.
- Derive the per-note LFO rates from one breath instead of `rnd()` each
  time, so the tremulant and the vibrato share a pulse (e.g. 5.2 Hz ±
  0.6 × breath).
- **Owner decision**: the extra draws shift the RNG stream, so every
  existing seed plays a different meeting afterwards. The family has
  accepted that before (v2 rc.30's registration change); flagging it.
- Sizing: half a day plus a re-listen of the section balances.

### Phase E — a shared air  (optional, minutes)

- One high shelf on `voicesBus` (−2 dB above 6 kHz) and a 40 Hz highpass
  ahead of the glue compressor so the organ's sub pedal stops driving the
  detector. Skip if Phase B's IR already darkens things enough.

### What not to do

- **No room-tone noise bed.** No sibling has one; hiss under a hymn engine
  reads as tape, not as togetherness. The owner's memory was the glue
  compressor and the wet lift, both already in.
- **No more compression.** The glue comp plus the limiter is already the
  family maximum; pumping would make the voices *feel* separate.
- **No panning changes** beyond what the room blend implies.

## 4. Decisions for the owner

1. **Port or share?** Kolob has no PJ2 dependency. ZANKYŌ loads the
   `pj2-*.js` substrate by relative path and never modifies it; Kolob
   could do the same for `pj2-fx.js` (roomBlend, delay, sympathetic,
   weather are all self-contained and mock-guarded). Recommendation: load
   `pj2-fx.js` by relative path (it needs only `window.PJ2`), and port the
   ~40-line `irUrl` loader from `pj2-voice.js` into `buildIR`, since
   Kolob's reverb is its own. Keeps one copy of the DSP lessons.
2. **Which room?** Needs the audition page (Phase B) and your ear.
3. **Weather reseeds old meetings** (Phase D). Acceptable?
4. **Order.** A then B, listen, then C and D together. E last, if at all.

## 5. Verification

- A headless soak (the mock in the family's `_harness.js` pattern —
  Kolob's is gitignored and was not in this checkout): every automation
  ramp anchored, no `bagpipe` notes, section balances ramp not step, the
  room blend's a²+b² within 0.05 dB of unity through every move.
- `room-lab.php` A/B for the owner: old chain vs. new, same seed.
- VERSION bump per phase; each phase is one listenable commit.
