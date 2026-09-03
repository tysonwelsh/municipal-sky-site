# Prospero's Jukebox v2 — PLAN: Sound Diversity

*Status: CURATED 2026-09-02 — the owner's eight decisions are recorded in
§7 and folded into the text. Nothing here is built yet. Dev-only document —
no VERSION bump. Library first, then Sycorax, then Ariel.*

The problem, in the owner's words: the songs sometimes feel repetitive
after a while — in the SOUNDS being played, as distinct from the notes or
motifs. This document is (1) a diagnosis of why that happens in this
engine, (2) six levers that widen the range of textures, and (3) a
per-track plan — including one new instrument per book — plus the
mobile lab pages for auditioning everything by ear before any engine
file changes.

This document is committed. `.gitignore` used to ignore
`art/prosperos-jukebox-v2/PLAN-*.md`, which is why the earlier plans this
codebase cites (PLAN-UNDERVOICES, PLAN-SYCORAX, PLAN-ARIEL, PLAN-GRAPHICS,
PLAN-MIXING-DESK) exist only in their sessions' scratch space; the owner
relaxed that rule on 2026-09-02 (§7, decision 8) so this plan travels with
the code.

---

## 0. How to read this on a phone

- §2 is the diagnosis — the five findings. If you read one section, read that.
- §3 is the six levers. §4 is the Library chapter (the first to build).
- §7 records the owner's decisions (2026-09-02).
- Everything else is reference for the build sessions.

---

## 1. What the machine is (orientation)

An aleatoric ambient generator in the Cage/Eno line: three "books" from
The Tempest, each a continuous evening of generative chamber music that
never repeats, drawn as a living manuscript plate.

- **Prospero's Library** — C dorian, tonic 262. A candlelit reading room.
  Scenes are the seven alchemical operations: settling (Calcinatio) →
  chapters (Solutio / Separatio / Conjunctio) → maybe a seizure
  (Fermentatio) → reverie (Distillatio) → candle-out (Coagulatio).
  Evenings 6–18 min.
- **Sycorax's Spell** — the "sycorax" set on Eb (steps 0,1,3,4,5,7,8). A
  rite observed from the treeline: gathering → processional → circling →
  invocation → afterimage, with THE CUT (the observer noticed). Never
  resolves; harmony is five authored "poses" over a pinned root.
- **Ariel's Day Off** — F lydian, tonic 349. Flights and songs: alighting
  → (song, flight)×2–4 → hover → swirl → release, and the evening ends by
  ascending out of register.

Binding aesthetic constants (SPEC-PHASE1): continuous ambient first;
weather, not theater; nothing startles; intensity floor 0.04 / ceiling
0.65; joints subtle (a third of boundaries pass as nothing); THE AIR
turn-taking with only occasional overlap; seamless chaining between
evenings; when in doubt, quieter.

The machinery every voice rides:

| layer | module | what it gives a voice |
|---|---|---|
| seeded dice | `pj2-rand.js` forks | one label-hashed stream per subsystem; adding a fork re-rolls nothing else |
| pitch | `pj2-pitch.js` field | `degFreq(deg, oct)` read AT SCHEDULE TIME (never cached Hz — the sea change depends on it) |
| time | `pj2-clock.js` lanes | lookahead scheduler; every voice is a self-rescheduling `lane.at` chain |
| plumbing | `pj2-voice.js` | bus, click-safe `env()`, panner pool, polyphony budget (32), noise buffer |
| air | `pj2-fx.js` | far-wall delay, sympathetic halo, weather field, two-room blend |
| form | `pj2-conductor.js` | scenes, intensity curve, joints, tide across evenings |
| turn-taking | `pj2-air.js` | melodic voices claim THE AIR; landscape voices never touch it |
| melody | `pj2-motif.js` | Markov improviser + transform composer + ledger + ghost, per-voice tables |
| harmony | `pj2-harmony.js` | root-motion grammar, cadences, consort voicing, sea change; per-track profiles |
| the desk | `pj2-ui.js` | per-layer VOL / mute / solo / RATE / fine-tune knobs; COPY as JSON |

**What "a voice" is in this codebase** — the template the cello (rc.22) and
the low horn (rc.23) established, and the one every new instrument here
follows:

1. a **fork** (`master.fork("cello")`), so every pre-existing stream stays
   byte-identical;
2. a **lane** (`clock.lane("cello")`), listed in `LANE_NAMES` and
   `MIX_RATE_LANES`;
3. a **body** (`renderCello`) — every envelope through `PJ2.Voice.env`, every
   pitch from the live field, budget-claimed, `emitNote({voice})`;
4. an **entry law** — the roll drawn FIRST and unconditionally, then the
   gates (scene, intensity, hold law, hush/candle-out);
5. a **mixer row** (`MIX_LAYERS`), a layer gain (`mAttach`), a
   `roomBlend.register` bias, and **fine-tune knobs** (`LAYER_PARAMS`,
   every default equal to the constant it replaces);
6. a **sigil** in `pj2-ui.js`'s `TRACK.sigils` (or the scribal-initial
   fallback), a line in the gain ledger, a harness gate, a VERSION bump.

Both prior voices were approved BY EAR on a mockup page that ran the real
engine unmodified and poured the prototype in beside it
(`instrument-mockup-cello.html`, `-horn.html`). The singing-saw mockup for
Ariel (`instrument-mockup-saw.html`) was auditioned and REJECTED by the
owner (§7, decision 6): portamento is off the table for Ariel.

---

## 2. The diagnosis — why the SOUND repeats when the notes don't

The compositional machinery is deep (genealogies, ledgers, sea changes,
ghosts), but every idea it produces is rendered by a small fixed set of
bodies that are always all present. Six findings, from a voice-by-voice
audit of the three engines (the full maps are in Appendix A).

**F1 — Register crowding.** The Library's sustained voices all live in one
octave. Drone (root+fifth, oct −1), cello (oct −1), hum bed (oct −1), hum
singer (chest), the cadence consort and the sea-change pad: five slow
voices between ~130 and ~260 Hz, three of them sawtooth-through-filter.
Above that octave the Library is ONLY plucks (harpsichord 262–466,
music box 523–932) and above 1 kHz only ambient one-shots. There is no
sustained sound above ~300 Hz in the whole Library. Sycorax has the mirror
problem (everything below ~300 Hz except the rare bone-flute and the keen);
Ariel's is spectral rather than registral (next finding).

**F2 — Family monocultures.** Library and Sycorax bodies are overwhelmingly
"sawtooth through a filter" (cello, hum, consort, gurdy, horn, chant,
rebec, trompette) plus triangle/sine pads. Ariel is the opposite
monoculture: every body is sine, triangle or a near-sine PeriodicWave
(breeze, whistle, chime, flutter, bass, aeolian) — nothing reedy, buzzy or
grainy except the ambient bee. Inharmonic spectra exist only in the
Sycorax waterphone and in ambient one-shots. Nothing in the Library is
blown; nothing in Ariel is plucked.

**F3 — A binary envelope vocabulary.** Every voice is either a strike with
an exponential decay (harpsichord, box, chime, flutter, ticks, drums) or a
symmetric seconds-long swell-hold-swell (drone, cello, hum, gurdy, horn,
breeze, aeolian, consort). Missing morphologies: swell-then-free-ring (a
bowed bell: the bow lifts and the metal rings on); iterative/pulsed
textures (a tremolo, a whirl, a roll); a rolled chord (many attacks as one
gesture); a spectral trajectory inside a note (only the horn's blossom
does this today).

**F4 — A static ensemble.** Every voice is eligible in every scene, gated
only by intensity and a per-scene probability tilt; nothing ever SITS OUT
a scene, and no scene has a lead instrument the others don't. Sycorax's
`SPEAK_P` table is the closest thing to a roster (the flute keeps to the
processional and invocation) and it is why Sycorax reads as having
movements. The Library's chapters are distinguished by motif policy, not
by instrumentation — Solutio, Separatio and Conjunctio SOUND the same.

**F5 — One body per voice, one cast per book.** A harpsichord has stops
and manuals; a music box can be damped; a cello can be plucked; a voice can
sing in head register. None of the bodies has a second manner, so a voice's
timbre never changes with context, and every evening is played by the same
cast with the same registrations. The tide biases duration and scene
plans; it never changes who is in the room.

**F6 — The landscape breathes at one rate.** All landscape voices are
10–30 s cycles with 3–4 s fades. Nothing in the bed is textured (granular,
rustling, shimmering) except the ambient pool's one-shots every 20–60 s.

The consequence: after ten minutes the ear has heard every body the engine
owns, in every register it uses, in every envelope it knows, and the
compositional variety underneath stops registering as variety.

---

## 3. The six levers

The fix is **orchestration, not just instrumentation**. Adding one voice to
a texture that always plays everything everywhere adds one more always-on
layer. Each lever below is applied per track in §4–§6.

**L1 — One new instrument per book, chosen to fill the largest gap in that
book's timbral map** (register × excitation × envelope × spectrum), never
"more of the same". Landscape roles preferred (they can't crowd the air);
a fourth melodic speaker only where the owner wants one.

**L2 — Stops: one or two variants per existing body.** A harpsichord lute
stop, a damped music box, a pizzicato cello, a head-voice hum, a drone
registration. Cheap (a branch inside an existing render function), and the
highest yield per line of code: the same phrases arrive in new clothes.

**L3 — Scene rosters.** An explicit per-scene table of who plays, with a
LEAD per scene and at least one voice RESTING per scene (the Sycorax
`SPEAK_P` pattern, generalized). This is what makes chapters audible as
chapters.

**L4 — The evening cast.** A seeded per-performance draw (a new "cast"
fork) of how each voice is DRESSED tonight — its stop or registration —
and how forward it sits: weights, never on/off. Every instrument plays
every evening. Evening one of a run is always the full ensemble in plain
registrations, so a short listen hears everything the book owns; casts
vary from evening two on. True absences are reserved for the one or two
voices whose absence is itself a colour — rare, at most one voice per
evening, and tide-tied so they read as weather rather than a coin.
Narrated as a scribal-log line at the performance's opening ("tonight:
harpsichord, lute stop · music box, damped · the cellist plucks") and
exposed in `getInfo().cast` (owner, 2026-09-02: yes, plain words while we
tune). An EVENING is one performance of the dramaturgy — Library 6–18 min,
Sycorax 6–16, Ariel 4–10 — chained seamlessly, so an hour's listening
hears several casts; stop/play restarts the seeded chain from evening one.

**L5 — Envelope and register moves.** One new envelope morphology per
track (F3), and deliberate register migrations (a voice occasionally an
octave away from home in a named scene).

**L6 — Sound-kit touches (backburner).** A per-voice distance (a third,
far room bias), delay-time variants, a "timbre" weather channel per voice
that drifts between two sub-patches. Only after L1–L5 have landed.

Rules every lever obeys: the aesthetic constants above; stream purity (new
draws only on new forks; existing evenings byte-identical at the defaults);
a desk row and knobs for everything new so it is tunable from the phone;
peaks a notch under where they "work"; nothing new at a cadence's exact
arrival sample (the ≤1.5 dB / no-new-attack contract holds — new bodies
lean in 0.4 s after, as the cello does).

---

## 4. Prospero's Library

### 4.1 The map (short form; full table in Appendix A)

| voice | excitation | register (Hz) | envelope | spectrum | role |
|---|---|---|---|---|---|
| drone | additive | 131–235 (+ sub 65) | swell 20–30 s | triangle + sine, LP 230–320 | landscape, the seam |
| cello | bowed | 131–262 | swell 10–25 s | saw pair, body EQ, LP 2.2k | landscape, on movement |
| hum bed / singer / consort | vocal | 131–196 / chest | swell 12–20 s / 1–4.5 s | saw → F1/F2 formants | landscape / 3rd speaker / cadence |
| harpsichord | plucked (KS) | 262–466 (+1 oct in seizure) | strike, 0.9–2.6 s | noise loop → tracking LP, sparkle | principal speaker |
| music box | struck | 523–932 | strike, 0.5–1.1 s | sine + 3rd partial | 2nd speaker, chapters |
| ambient ×7 | mixed | all | one-shots, 20–60 s apart | mixed | room |
| halo | sympathetic | 262–524 | ring | comb bank, whisper | fx |

Gaps: **nothing sustained above ~300 Hz; nothing inharmonic; nothing
blown; no chords outside cadences; no free-ring or iterative envelope; the
same seven bodies every scene, every evening.**

### 4.2 The new instrument — three candidates, one recommendation

Owner (2026-09-02): all three go on ONE lab page (§4.6). Recommendation
order Vessel > Regal > Flue; the flue is approved as the rarest fourth
speaker (decision 2).

**(a) THE VESSEL — a bowed alembic** *(recommended)*
A bowed metal-and-glass vessel: the alchemical vas hermeticum, the one
object the codex is about. Landscape voice, ABOVE the texture (the cello
is the under-voice; this is the over-voice).

- *Body.* Four sine partials at inharmonic bowl ratios (1 : 2.0 : 2.71 :
  4.84), the fundamental as a detuned pair beating at 0.6–1.4 Hz (the
  beating IS the sound — nothing else in the Library beats), a friction
  thread (bandpass noise at 3×f, Q 8, very low) that exists only while the
  bow is on. Fundamental on the current chord's root or fifth at oct 0 or
  +1 (≈390–1050 Hz) — the empty register.
- *Envelope (new morphology — swell then free ring).* Bow-in 2–5 s to a
  quiet peak (0.02), hold 3–8 s with slow-noise bow pressure, then the bow
  LIFTS: the friction stops and each partial decays freely on its own
  time (fundamental 8–14 s, upper partials 2–5 s). Whole event 15–28 s.
- *Entry law (owner-confirmed 2026-09-02).* The reverie's own voice
  (Distillatio — "what rises when the heat comes off": p ≈ 0.5 per opportunity, opportunities every 20–40 s); a bow
  over cadence arrivals into reverie/candle-out (p 0.6, leaning in 0.4 s
  after the arrival); the sea change (p 0.7 — the new tonic bowed above
  the bloom); rare on harmony steps in chapters (p 0.12); never in
  settling or the seizure; candle-out: at most one early bow, then silence
  (the halo's guttering law). One at a time, rest 8–20 s.
- *Plumbing.* Registered toward the wide hall (bias +0.2 — it lives in the
  stacks); no delay send; a whisper send into the halo is worth trying
  (bell exciting strings).
- *Desk.* Row "Vessel" (landscape). Knobs: beat (Hz), ring (decay ×), bow
  (friction), partials (upper mix), register (0 / +1).
- *Fills:* F1 (sustained high register), F2 (inharmonic), F3 (free ring),
  F4 (reverie gains a signature instrument). ~13 nodes, no feedback.
- *Owner's tuning (by ear on the lab page, 2026-09-03 — the integration's
  design constants):* level ×0.75 (peak 0.015), presence ×0.85, beat
  1.0 Hz, ring ×0.9, bow ×1.2, partials ×1.45, register oct 0 (≈262–466 Hz
  fundamentals — the owner heard it best an octave under the plan's
  default), attack 3.0 s. These are now the lab page's defaults.

**(b) THE REGAL — a small reed organ**
A portable Renaissance reed organ (or a parlor harmonium): sustained
CHORDS with a bellows breathing under them.

- *Body.* Per part, two detuned reed oscillators (square + saw blend, or a
  reed PeriodicWave) → peaking body 500 Hz Q 1.5 → LP 1.8k; 0.4–0.8 s
  attack, 0.6–1 s release; all parts through ONE bellows gain (slow-noise
  pressure ±1.5 dB at 0.1–0.2 Hz). Two or three parts voiced by
  `harmony.voiceConsort` in the C3–Bb4 window, held 8–20 s. Peak 0.012 per
  part.
- *Entry law.* Chapters on harmony steps (p 0.3); "the organist takes the
  cadence" — on p 0.35 of cadences the regal voices the two chords instead
  of the hum consort (cadence variety); never in seizure or candle-out.
- *Fills:* F2 (reed spectrum — nothing in the Library is a reed), chords
  outside cadences, a breathing envelope. Risk: with the drone, cello and
  hum bed it is a fourth sustained low-mid voice — it must rest the hum
  bed when it plays (roster rule), or it deepens F1.

**(c) THE FLUE — a wooden flute (recorder)** — *approved as the rarest
fourth speaker (owner, 2026-09-02); the air limits stay exactly as they are*
Melodic, air-claiming. Triangle + sine hollow core, a 30 ms chiff (noise
burst at 2×f) at onset, low breath noise at 1.2–2 kHz, vibrato delayed
0.5 s; notes 1–4 s; oct 0..+1 (C4–C6). Speaks motif lines from a new
motif voice table leaning augment/ornament (the walk table of the hum,
re-registered up two octaves). Speak-p: chapter 0.15 / reverie 0.2 /
settling 0.05 / seizure 0 / candle-out 0. Fills F2 (blown) and F1
(sustained mid-register melody). Risk: it is a soloist by nature; keep it
the rarest speaker.

### 4.3 Stops (L2) — variants of the existing bodies

| voice | stop | what changes | where |
|---|---|---|---|
| harpsichord | **lute stop** (buff) | 15 ms burst, LP start 1.6f (duller), decay ×0.55, no sparkle, a felt tick at 400 Hz | a cast draw (whole evening, p 0.25) or reverie |
| harpsichord | **4′ coupled** | a second KS at 2f at −9 dB | seizure; stormy-tide evenings |
| harpsichord | **rolled chord** | the first phrase after a cadence is the arrival chord rolled bottom-up over 0.25–0.5 s at vel 0.7 — a gesture the pluck never makes today | chapter entries |
| music box | **damped** | 3rd partial −12 dB, decay ×0.6, peak ×0.8 | reverie; a cast draw |
| music box | **wound-down** | spb ×1.6, −8 cents drift across the phrase, register oct 0 — the mechanism running down | candle-out only (an ending gesture) |
| cello | **pizzicato** | KS body at oct −1 (40 ms burst → LP 4f→0.7f, warm EQ), 1.5–3 s ring — a plucked low note, the Library's first | harmony steps in chapters, p 0.25, cast-drawn "the cellist plucks tonight" |
| cello | **harmonics** | a flageolet: sine + faint 3rd partial at oct +1 of root/fifth, with bow noise — a high thread | reverie (the cheap high sustained sound if the vessel is not chosen) |
| hum | **head voice** | the singer an octave up (oct 0), vowels restricted to oo/ng, peak ×0.8 | reverie, p 0.3 of sung phrases |
| drone | **registrations** | flue (triangle, today) / principal (+2nd, 3rd partials at −10/−16 dB) / gedackt (sine only, sub always on) | a cast draw per evening |

Every stop is a branch inside the existing render function. Owner
(2026-09-02, decision 5): EVERY stop also gets a knob on its voice's desk
row (`LAYER_PARAMS`) — a blend where the sound allows it (buff, damper, the
4′ level, the cello's pizz share), a position switch where it doesn't
(drone registration). The cast draws the stop per evening; a knob the
owner has moved wins over the cast until it is reset. No new streams
except the cast fork.

### 4.4 Scene rosters (L3) — a default to tune by ear

Principle: every scene has a LEAD and at least one voice RESTING.

| scene | lead | present | resting |
|---|---|---|---|
| settling · Calcinatio | drone | cello (rare), hum bed (late), harpsichord (ghost / fresh, sparse) | music box, vessel, regal |
| chapter 1 · Solutio | harpsichord | music box, cello, hum bed | hum singer (rare), vessel |
| chapter 2 · Separatio | harpsichord + music box (the overlap chapter) | cello, regal (chords) | hum singer |
| chapter 3 · Conjunctio | harpsichord + hum singer (the wedding) | music box (rare) | regal, vessel |
| seizure · Fermentatio | harpsichord (lifted, 4′) | music box (fragments), halo hot | cello, hum, vessel, regal |
| reverie · Distillatio | vessel + hum singer (head voice) | harpsichord (lute stop, sparse), cello harmonics | music box (or wound-down), regal |
| candle-out · Coagulatio | drone + cello (one bow) + the coagula | box wound-down (cast), one vessel bow | harpsichord after the coagula, hum, regal |

Implementation: a `SPEAK_P`-style table per voice per scene (the Sycorax
pattern) replacing the scattered intensity-only gates; the roster is
prototyped on the lab page as a scene × layer grid driving `toggleLayer`
on scene events, so the owner can hear alternatives before anything is
coded.

### 4.5 The evening cast (L4) — dress and prominence, never presence

Drawn once per performance on a new `cast` fork at the performance-begin
event, narrated as `{type:"cast"}` + a scribal-log line, reported in
`getInfo().cast`. Evening one of a run: the full ensemble, plain
registrations, no draw. From evening two:

- harpsichord stop: 8′ 0.6 / lute 0.25 / 4′-coupled 0.15 (tide-biased stormy)
- music box: open 0.7 / damped 0.3
- cello manner: arco 0.6 / arco + pizz 0.4
- drone registration: flue 0.5 / principal 0.3 / gedackt 0.2
- vessel, regal, flue prominence: forward 0.5 / back 0.5 (back = level
  ×0.7, presence ×0.6) — all three play every evening
- the ONE absence colour: "no music box tonight", p 0.12, stormy-tide
  evenings only, never two evenings running

Any knob the owner has moved on the desk overrides the corresponding cast
draw (decision 5).

### 4.6 The Library lab page (mobile)

`lab-library.html` — plain HTML, unlinked, dev-only, the real engine
unmodified (the mockup pages' factory-wrapping capture of ctx / bus /
field / harmony), the site's `background-audio.js` loaded so it keeps
playing under a locked phone screen. Details in §8. Four tabs:

1. **INSTRUMENTS** — a card per candidate (vessel / regal / flue): enable,
   *sound one now*, presence ×, level, the candidate's knobs. Entry
   decisions logged.
2. **STOPS** — each variant auditioned by the *shadow body* technique:
   mute the engine's own layer with `toggleLayer`, listen to its note
   events (they carry `freq / t / durS / velocity / deg`, emitted at
   schedule time, ahead of the sound), and re-render every note through
   the variant body at the same `t`. The engine's phrasing, the new
   clothes — no engine change.
3. **ROSTER** — a scene × layer grid of checkboxes applied through
   `toggleLayer` at each scene event, with the current scene highlighted.
4. **MIX / COPY** — everything (candidates, knobs, stops, roster, hushes)
   serialized as JSON to the clipboard, so a tuned state can be pasted
   back into the chat and integrated with those exact numbers. Two A/B
   snapshot slots.

---

## 5. Sycorax's Spell

### 5.1 The map (short form)

| voice | excitation | register (Hz) | envelope | spectrum | role |
|---|---|---|---|---|---|
| gurdy | additive/drift | 46–124 (+ body 92–248, sub 23–62) | swell 20–28 s | saw cluster, LP 150–350, trompette → grit | landscape, the seam |
| horn | blown (saw) | 78–166 | swell 12–30 s, blossom | saw, LP 300→900 | landscape, on movement |
| noise bed + breath | noise | 260–1150 / formants | slow drift / 2.5–5.5 s | bandpassed noise | landscape murk |
| chant | vocal | chest | seconds-long edges | saw + square → F1/F2 + breath | principal speaker |
| rebec | bowed | chest–mid | 0.5 s edges | saw → body bandpasses | speaker |
| waterphone | inharmonic | mid, glissing down | 1.5 s attack, long | 6 partials + FM | speaker (the one inharmonic voice) |
| bone-flute | blown | +1 oct | 0.2 s edges | triangle + breath | rare speaker |
| percussion | struck | 20–110 + skin | strikes | sine thumps, noise skins, log drum | landscape |
| ambient ×8 | mixed | mixed | one-shots | gust, ember, stone, chains, raven, thunder, bell, keen | room |

Gaps: **almost nothing above ~300 Hz that sustains; saw-through-filter
everywhere; the only mouth is the chant's; no iterative/pulsed texture; no
plucked sound at all.** Sycorax already has the widest palette (percussion,
noise, inharmonic, formants, the grit bus) — its diversity problem is
register and the saw monoculture, not roster.

### 5.2 Candidates

**(a) THE BULLROARER** *(recommended new instrument)* — a whirled slat, the
oldest ritual instrument there is; a landscape texture and the rite's own
machine. Carrier: sawtooth at the pose root, oct −2/−3, through LP 400,
amplitude-modulated at 12–40 Hz (the slat's spin) by an LFO whose RATE
follows a 0.4–1.5 Hz swing, plus a ±2 % Doppler pitch wobble at the swing
rate and a band of air (noise 200–600 Hz) modulated the same way. Swells
8–25 s. Processional and invocation only; holds its breath before the cut
and through the hush like the horn; peak 0.025 into cutGain. Knobs: whirl,
swing, doppler, air, level, presence. Fills F3 (iterative envelope) and a
physical, whirring character nothing else in the engine has.

**(b) THE OVERTONE CHANT** *(recommended variant)* — the chant holds a low
fundamental for 6–14 s while a narrow bandpass (Q 12–20) STEPS through
harmonics 4–10, playing a melody in the harmonic series above a fixed
tone (the F1/F2 mouth replaced by one sweeping formant). Processional and
invocation; a cast draw (p 0.3 of evenings the cantor sings this way).
Fills F1 (mid-high register out of the existing voice) at almost no cost.

**(c) THE JAW HARP** — a plucked metal tongue (a short KS burst with high
sustain) at the pose root, oct −1, into a MOVING bandpass — the mouth —
sweeping 500→1800 Hz over 0.3–0.8 s per twang; 2–5 twangs per utterance
at irregular gaps; circling only; peak 0.02. Uncanny-playful, plucked,
formant-melodic: three gaps at once. Audition option.

**(d) THE BOWED BLADE** — two sines at an inharmonic 1 : 1.47 at
1.2–2.5 kHz with bow friction, 4–8 s swells at whisper level (0.008), wide
room only, invocation and afterimage. The one high sustained sound the
rite lacks. Risk: startle — keep it far and faint.

**(e) THE CAULDRON** (ambient pool) — bubbling: LP noise 80–200 Hz with
pitched pops (sine gliss 200→400 Hz over 60 ms) at 0.2–0.6 s gaps, 4–8 s.
The spell's pot; the dark cousin of Ariel's bubbles.

### 5.3 Stops, rosters, cast (sketch)

- Stops: rebec *sul ponticello* (bandpasses up an octave, rosin ×2);
  gurdy *dog off* (no trompette some evenings); horn *stopped* (LP ceiling
  600, breath ×1.5); waterphone *struck* (no bow attack: 0.05 s onset,
  shorter); frame drum *fingertips* (peak ×0.5, skin only).
- Roster: gathering (gurdy, proto-drum, chant, breath) · processional
  (+ horn, bullroarer, the walk, rebec, bone-flute) · circling (rebec,
  waterphone, jaw harp, chant; horn rests) · invocation (clusters, horn,
  bullroarer, overtone chant, blade) · afterimage (organum, the far call,
  blade, chant sinking).
- Cast (dress and prominence, never presence; evening one full): chant
  manner mouth / overtone (0.3) · rebec plain / sul ponticello (0.25) ·
  gurdy dog on / off (0.75 / 0.25) · horn open / stopped (0.3) ·
  bullroarer and blade forward / back; the one absence colour: the
  waterphone sits out p 0.12 of at-the-treeline evenings, never twice
  running.

---

## 6. Ariel's Day Off

### 6.1 The map (short form)

| voice | excitation | register (Hz) | envelope | spectrum | role |
|---|---|---|---|---|---|
| breeze | additive | 175–262 (+ sub) | swell 15–25 s | sine dyad + triangle sub + 6 kHz hiss | landscape, the seam |
| whistle | blown | 349–659 (climbs in the release) | 0.35 s attack, 0.5–3.2 s | flute wave + breath 1.8k | principal speaker |
| chime | struck | 698–1318 | strike, 1.5–2.5 s | bell-wave pairs | speaker, the fragmenter |
| flutter | struck | 698–1318 | 0.12–0.3 s blips | triangle | speaker, ornament |
| bass | plucked-ish | 44–82 | 12 ms attack, 1–4 s | 3 triangle partials | landscape, the arc |
| aeolian | bowed (glass) | 349–659 | swell 10–18 s / sung 1–4.5 s | sine pair + 2nd partial + breath | landscape + 3rd speaker |
| ambient ×8 | mixed | high | one-shots | birds, gust, sparkle, leaf, cricket, wind chime, bee, bubbles | sky |

Gaps: **every body is sine/triangle-pure (no reed, no buzz, no grain); no
plucked string; nothing between the bass (82 Hz) and the breeze (175 Hz)
or between 175 and 349 Hz except the breeze itself; no chords outside
cadences.**

### 6.2 Candidates

**(a) THE LYRE** *(recommended)* — Ariel's own instrument (the Tempest's
airy songs were sung to a lute or lyre). A plucked gut string: 20 ms noise
burst → LP starting 5f (Q 0.7) sweeping to 1.2f over 60 % of a 2–4 s
ring, a body with peaks at 300 Hz +3 dB and 1.5 kHz +2 dB. Its gesture is
the **rolled chord** (new envelope morphology): 3–4 tones of
`harmony.current` (root, 3rd, 5th, octave; the #4 as a colour on I, p
0.15) rolled bottom-up over 0.18–0.5 s at vel 0.6–0.9, register F3–F5
(oct −1..0 — the empty band). Landscape-chordal: rolls on harmony steps in
songs (p 0.45) and hovers (p 0.35), 0.4 s after a lift cadence's arrival
(p 0.6), the alighting's first chord (the feather's cousin), and in the
release the rolls climb the ladder with everything else. Peak 0.03 per
string, ×0.8 in chords. Knobs: roll (spread s), ring, bright, body, voices
(3/4). Fills F2 (plucked), the chord gap, the mid-register gap.

**(b) THE CONCERTINA** — the air made audible: a free reed. Two reed
PeriodicWaves ±6 cents → peaking 900 Hz Q 1.2 (the reed chamber) → LP 3k →
a bellows gain (slow-noise ±2 dB at 0.15 Hz with push/draw phrasing);
dyads of the current chord held 6–14 s; hovers (p 0.4) and songs (p 0.2);
the lift-cadence consort body on p 0.4 of cadences (variety against the
aeolian consort). Peak 0.014 per part. Fills F2 (the reed spectrum Ariel
entirely lacks). Second choice, or both.

**(c)** An ocarina / pan pipe would be a second wind voice — too close to
the whistle; not recommended. **The singing saw** (existing mockup) was
REJECTED by the owner (§7, decision 6): no portamento voice for Ariel.

### 6.3 Stops, rosters, cast (sketch)

- Stops: whistle *overblown* (register +1 with a thinner wave — swirl and
  release), whistle *chiff* (a 25 ms noise burst at onset), chime *muted*
  (decay ×0.5, pair detune 0), flutter *swooped* (each blip a 20-cent
  upward gliss), bass *hummed* (a sine at oct −1 of the root, 4–8 s, in
  hovers), breeze *reeded* (a 3rd partial some evenings), aeolian *rubbed*
  (more breath, less tone).
- Roster: alighting (breeze, the feather, the lyre's first chord, whistle
  late) · song (whistle lead, lyre on steps, aeolian sings) · flight
  (flutter + chime clouds; lyre and concertina rest) · hover (aeolian +
  concertina + bass; the whistle rests) · swirl (whistle lifted, chime,
  halo; lyre rests) · release (the ascension: lyre rolls climbing, flutter
  out by x 0.5, bass out by 0.4, concertina out).
- Cast (dress and prominence, never presence; evening one full): whistle
  manner plain / chiff / overblown-capable · chime open / muted · lyre and
  concertina forward / back; the one absence colour: the flutter sits out
  p 0.1 of still evenings, never twice running.

---

## 7. The curation — the owner's decisions (2026-09-02)

1. **Library candidates on the lab page:** all three — vessel, regal,
   flue — on ONE page.
2. **A fourth melodic speaker:** YES. The flue joins as the rarest
   speaker; the air limits and overlap chances stay exactly as they are.
3. **Reverie's signature instrument:** YES — the vessel is the reverie's
   own voice, rare elsewhere.
4. **Evening casts narrated in the log:** YES, plain words while tuning;
   final phrasing (alchemical register or not) decided later. The cast
   itself was softened first: dress and prominence, never presence;
   evening one is always the full ensemble; absences rare and tide-tied
   (see L4 and §4.5).
5. **Stops on the desk:** every stop gets a KNOB on its voice's existing
   row (no new rows for stops); the cast draws stops per evening, a moved
   knob wins until reset.
6. **The singing saw:** REJECTED. No portamento voice for Ariel.
7. **Already in the owner's ear:** nothing yet.
8. **Where the plan lives:** the `PLAN-*.md` ignore rule for this folder
   is RELAXED; this document is committed under its own name.

---

## 8. The lab pages — mobile-first spec

Shared shell (`lab-shell.js` + `lab.css`, dev-only), one page per book
(`lab-library.html`, `lab-sycorax.html`, `lab-ariel.html`). Design rules:

- **Phone first.** One column; 16 px base; every slider full-width with a
  44 px thumb, label above, value at the right; buttons ≥ 44 px tall;
  no hover-only affordances.
- **Sticky transport** at the top: PLAY/STOP, seed + new seed, master
  volume, an output meter, and an error line (a silent page must never be
  mute about why).
- **The engine unmodified.** Wrap `PJ2.Voice.buildBus`, `PJ2.Pitch.field`
  and `PJ2.Harmony.create` before `create()`/`play()` to capture the live
  ctx / bus / field / harmony per run (the mockup pages' trick); read
  `harmony.current()` and `field.degFreq` at schedule time; pour
  prototypes into `bus.input` through the page's own reverb.
- **Shadow bodies** for stops (§4.6): mute the layer, re-render its note
  events through the variant. Note events arrive at schedule time
  (lookahead 0.25 s), so the variant lands on the engine's own `t`.
- **Instant audition**: every candidate has *sound one now*; every stop
  has *play a phrase now* (a short seeded phrase through the body without
  waiting for a chapter). The evening opens from near-silence by design,
  so the phone must never wait minutes to hear a sound.
- **Hush chips** per existing layer, through the engine's own
  `toggleLayer`, so a candidate can be judged against the drone alone.
- **Roster grid**: scene × layer checkboxes applied at scene events.
- **COPY** serializes the whole page state as JSON; **A/B** holds two
  snapshots. The paste-back into the chat is the hand-off: integration
  uses those numbers as the design constants.
- **Background audio**: load `../background-audio.js` so the bus routes
  through the site's media-element rail and survives a locked screen
  (iOS also honours the silent switch only through that route).
- **Prototype-grade dice** (`Math.random`, a 250 ms poll) are fine on the
  page; the integration moves every draw to forks.

---

## 9. The integration recipe (per voice or stop)

From the cello/horn precedent; every item is a line in the commit:

1. `streams.<voice> = master.fork("<voice>")` — and a `cast` fork for L4.
2. `LANE_NAMES` + `MIX_RATE_LANES` entries; the lane's `lane.at` chain.
3. The body via `PJ2.Voice.env` only; draws first, then the budget claim;
   `emitNote({ voice, kind, freq, t, durS, deg, oct })`.
4. The entry law: unconditional roll, then gates; a hold law; the
   candle-out / hush rule; scene multipliers.
5. `MIX_LAYERS` row + `mAttach` layer gain + `roomBlend.register` bias +
   `LAYER_PARAMS` knobs with defaults equal to the design constants.
6. `pj2-ui.js` `TRACK.sigils` entry (an atlas cell in `pj2-skin.js`, or the
   scribal-initial fallback); a plate mark in `pj2-viz.js` is optional (the
   cello and horn have none).
7. The gain ledger in the engine file's header; the README roster note;
   a `VERSION` line (`2.0.0-rc.N — …` in the owner's terms).
8. `_harness.js`: a section like `testCello` — hold law, presence over a
   long run, register, hush/candle-out conduct — and REPRO still green
   (`node _harness.js 5400`; 163 checks green today).
9. `render-soak.html?track=library` for anything with a feedback loop
   (the vessel and lyre have none; the jaw harp's sustain does).
10. For casts and rosters: the begin-event draw, `getInfo().cast`, the
    `{type:"cast"}` event and its scribal-log line; roster tables replace
    the scattered per-scene gates.

---

## 10. Sequence and gates

**Library**
- L0 — owner curates this plan (§7). DONE 2026-09-02.
- L1 — build `lab-library.html` (+ shell): candidates, stops, roster, COPY.
- L2 — owner auditions on the phone; pastes COPY JSON + notes.
- L3 — integrate the chosen instrument → rc.31 (harness section, ledger,
  desk row, sigil, VERSION).
- L4 — integrate the chosen stops + the cast + the rosters → rc.32.
- L5 — long harness run, soak, README; then a listening evening.

**Sycorax** S1–S5 and **Ariel** A1–A5 repeat the pattern with their own lab
pages, reusing the shell and whatever the Library taught.

---

## Appendix A — the timbral maps in full

### Library (`pj2-library.js`)

| voice | body | register | timing | peak | entry |
|---|---|---|---|---|---|
| drone | triangle root+5th, sine sub p 0.3, LP 230–320 Hz, tremolo 0.7 Hz | oct −1 (sub −2) | 20–30 s cycles, 3 s fades, 2.5–5 s overlap | 0.07/pad | always (the seam) |
| cello | 2 saws ±4 c → peaking 230/400/1000 → LP 2.2k; slow-noise swell; vibrato blooms at 1.5 s; rosin 2.5 kHz | oct −1 | 10–25 s, attack 1.5–3, release 2.5–4 | 0.0225 | harmony step 0.35 · cadence 0.7 · sea change 0.85 · scene 0.4; one bow at a time; iv ≥ 0.15 |
| hum bed | saw → F1/F2 (5 vowels, neighbour walk) + jitter + vibrato + shimmer | deg 0/2/4 at oct −1 | 12–20 s swells, gap 9–16 s | 0.026 | iv ≥ 0.2 |
| hum singer | same body, motif lines | chest | 1.2–4.5 s notes | 0.032 | chapter 0.25 · reverie 0.15 · settling/candle 0.05 · seizure 0; claims the air |
| consort | 2–3 saw vowels, one mouth | −7..6 | 9–13 s cadence act | 0.016 | cadences (~60–75 % of boundaries) |
| harpsichord | 30 ms noise loop → LP 3f→0.8f (Q 0.5) + octave sine sparkle | oct 0; +1 in seizure | notes 0.9–2.6 s, phrases 3–14 notes, margin 3–8 s | 0.055 | iv ≥ 0.07; far wall p 0.3; halo send |
| music box | sine + 3rd partial (velocity law 0.4 + 0.6 v) | oct +1 | 0.5–1.1 s | 0.030 | iv ≥ 0.12; rests 70 % outside chapters; far wall always |
| ambient | page, tick-tock, crackle, owl, thunder, cricket, rain | — | every 20–60 s | ≤ 0.05 | weather-gated pool |
| halo | 6 combs on {0,2,4,5,6,+oct} | oct 0 | ring | ≤ 0.07 | fed by the pluck; gutters in candle-out |
| rooms/fx | parlor 2.0 s + St Margaret's hall; far wall 0.42 s fb 0.22 wet 0.18 | | | | scene balances 0.15–0.65 |

### Sycorax (`pj2-sycorax.js`)

| voice | body | register | timing | peak | entry |
|---|---|---|---|---|---|
| gurdy | saw cluster (pose degrees) + root body + trompette → grit; sub sine; LP 150–350 drifting; ±3 % warble | oct −2 / −1 / −3 | 20–28 s cycles | 0.035/0.028/0.022 | always (the seam) |
| horn | saw, −35 c scoop, LP blossom 300→900, 800 Hz breath, 3rd partial while open | oct −1 | 12–30 s | 0.028 | pose 0.4 · arrival 0.6; scene ×; silent 4 s before the cut and through the hush |
| noise bed | ember-smoke (bandpass 260–1150 drifting), ruin-wind gusts | — | 24–40 s / 8–20 s | ≤ 0.030 | ≤ 0.8× gurdy level |
| breath bed | whisper formants, drifting | — | 2.5–5.5 s, gap 7–16 s | 0.018 | iv ≥ 0.06 |
| chant | saw −4 c + square +5 c → F1/F2, breath pre-formant, vibrato | chest | seconds-long edges | 0.032 | gathering 0.55 · processional 0.85 · circling 0.6 · invocation 0.7 · afterimage 0.35 |
| rebec | saw → 2 of 4 body bandpasses, rosin at 2.5f | chest–mid | 0.5 s edges | 0.030 | processional 0.3 · circling 0.5 · invocation 0.4 · afterimage 0.15 |
| waterphone | 6 inharmonic partials + FM bloom, body wobble, gliss −1.8 % | mid | 1.5 s attack | 0.04 | processional 0.2 · circling 0.35 · invocation 0.3 · afterimage 0.2 |
| bone-flute | triangle + breath at 2f (Q 4) + octave whisper | +1 | 0.2–0.35 s edges | 0.028 | processional 0.25 · invocation 0.25 only |
| percussion | proto-drum (sine 36→20 Hz), frame drum (70–110 Hz + skin), log drum (deg 0/4 at oct −2), rattle | low | anti-groove | ≤ 0.045 | scene-mapped |
| ambient | gust, ember, stone, chains, raven, thunder, bell, keen | — | 20–60 s | ≤ 0.026 | tide/weather-weighted |

### Ariel (`pj2-ariel.js`)

| voice | body | register | timing | peak | entry |
|---|---|---|---|---|---|
| breeze | sine dyad root+5th (tritone p 0.12 on I), triangle sub p 0.4, 6 kHz hiss, breathing LFO | oct −1 (release ladder to +2) | 15–25 s | 0.06 | always (the seam) |
| whistle | flute PeriodicWave, 5.5 Hz vibrato, 1.8 kHz breath, bends | oct 0 (+1 swirl, +1/+2 release) | 0.5–3.2 s, margin 2–5 s | 0.028 | iv ≥ 0.07; far wall p 0.5 |
| chime | bell-wave pairs ±2–4 c | oct +1 | 1.5–2.5 s decays; clouds in flights | 0.026 | rest p by scene; far wall + halo always |
| flutter | triangle ±2 c | oct +1 | 0.12–0.3 s | 0.04 | flights; out by release x 0.5 |
| bass | 3 triangle partials, 12 ms attack | oct −3 | 1–4 s; arrivals on steps | 0.10 | arc-following; exits release at x 0.4 |
| aeolian | sine pair ±3 c + 2nd partial + breath (Q 8) | oct 0 | bed 10–18 s / sung 1–4.5 s | 0.02 / 0.026 | bed iv ≥ 0.15; sings song 0.2 · hover 0.15 · release 0.1 |
| ambient | birdsong, gust, sparkle, leaf, cricket, wind chime, bee, bubbles | high | 18–50 s | ≤ 0.025 | weather-weighted |
| fx | two walls (0.32 s thin / 0.53 s), halo on {0,1,3,4} + octaves, close 1.8 s / sky (Tvísöngur) | | | | balances 0.25 → 0.85 |
