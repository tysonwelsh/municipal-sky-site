# r3-cast-1: the congregation and the cast

*CAST crew, round 3. Branch `kolob-r3-cast`. 2026-09-28.*

Five things, in the order the task gave them: the hiss the owner heard
between the notes, the two open voice issues (the late singer's mouth, the
honking notes), the full ward made light enough for a phone, the cast
itself (`kolob-cast.js`), and a lab to meet it (`cast-lab`). Nothing was
pushed or published, and VERSION is not bumped. Every check was silent:
Node mocks, OfflineAudioContext renders, and headless Chrome launched with
`--headless=new --mute-audio`.

Commits: `af8e190` (the voices: the hiss, the mouth, the honk, the lighter
throat), `2e41f42` (`kolob-cast.js`), `0aab504` (the voices: fixed nodes
born fixed), `47fd10f` (the cast lab), `40398f8` (the voices lab),
`6b3e629` (a lighter hand on the main thread), `fa42719` (smaller s and f),
`b369dfc` (the vibrato as a curve), and this note.

---

## For the owner, in plain words

**Honestly, by size:**

1. **The hiss between the notes is gone. (The one you asked about.)** You
   heard "a brushing s sound… like air being released out of a tire… in
   between notes when the hymns are being sung." It was a bug, and it was
   two things. Mostly the singers' breath: each of the thirty-two had a
   little stream of breath noise running on its own clock, not the
   voice's:
   - it kept blowing for a quarter of a second **after every line had
     ended**, through a mouth still standing open — thirty-two small
     exhales at every line break (the "tire");
   - it puffed an "h" at nearly three times its strength into the **start
     of every line**;
   - and it stayed at full strength in the dips **between notes**, while the
     voice fell away under it.

   And, in a Sacred Harp hymn's first verse (sung on the notes, "fa, sol,
   la, mi"), the *s* of "sol" and the *f* of "fa" from thirty-two people:
   in the spectrogram of HEAD they are the loudest thing in the high band
   at every join — very likely the "brushing s" itself.

   Now the breath is *inside* each voice: it rises and falls with the
   singer's own tone, so it can never be heard on its own. The only breath
   you can hear is a soft, low intake **where a line breathes** — and not
   from every singer at once. The *s* and *f* are about a third as strong,
   shorter, and each singer says them at their own moment, so they sit
   inside the singing instead of on top of it.
   - **Hear it in the hymn lab** (it loads this voice file; nothing else in
     it changed): `hymn-lab.php?seed=4&dialect=tabernacle` and
     `?seed=7&dialect=sacredharp` on this branch (the list below). Listen
     to the gaps between lines and the joins between notes.
   - **Measured** (the table below): at the line breaks the breath is
     11 to 12 dB quieter in the 3–12 kHz band, and what is left in the
     gap sounds like the voices' own tails, not like noise.
2. **No single note jumps out any more. (Medium.)** Some notes used to be
   up to 7–8 dB louder than the ones beside them, because one of their
   overtones landed exactly on a narrow resonance of the "mouth". Every
   note is now brought to its vowel's level: "ah" the fullest, "oo" and
   "ee" a little softer, as in real singing, with a gentle rise as a voice
   climbs. On a test scale the worst note now stands at most 0.5 dB over
   its neighbours (it was 7.4).
3. **A late singer is late all through. (Small, subtle.)** The old bass,
   the newcomer and anyone with a late habit used to say their consonants
   and vowels on the beat and move their pitch late. Now their whole mouth
   is late with them — consonant, vowel, breath and pitch together.
4. **The full ward on a phone. (Invisible, but it is what lets the ward
   into the meeting.)** The thirty-two singers now cost about half the
   audio processing they did, with no change in how they sound, and they
   held real time over a whole meeting in the phone test (the page slowed
   4×). A real phone has not played it yet — details below.
5. **The cast: meet the ward. (New — the lab is the place to hear it.)**
   Every seed seats a different Sunday's ward: thirty-two in the pews and
   eight to twelve people with names (in Deseret), faces in the seating
   chart, and habits you can hear. A hymn is sung by them: the chorister
   keys it first (hums the note, or sings "fa… sol… la…"), or — before a
   Sacred Harp tune — the keyer hums the tonic and each section finds its
   first note on top of it, a chord of thirty-two slightly different voices
   building for three or four seconds; then the verses, each in its own
   practice, with one or two people coming forward at a time (the alto's
   verse, the old bass on the last lines, a child singing the tune who
   loses the words and finds them again, the soloist's descant, the
   enthusiast's last verse, the newcomer joining on the second line).

### How to hear it

```
php -S 127.0.0.1:8133 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-cast
```

**The hiss (the hymn lab, this branch):**
- `http://127.0.0.1:8133/art/kolob/hymn-lab.php?seed=4&dialect=tabernacle` — BETHEL. Listen to
  the gaps between the lines: before, a soft hiss hung in each one and the
  next line began with a breathy "h"; now the lines end and begin clean.
- `http://127.0.0.1:8133/art/kolob/hymn-lab.php?seed=7&dialect=sacredharp` and `?seed=1&dialect=sacredharp`
  — verse 1 is sung on the notes: the *s* of "sol" and the *f* of "fa" are
  still there (they are the words), but softer and shorter; verse 2 (on
  vowels) has nothing between the notes.
- `http://127.0.0.1:8133/art/kolob/hymn-lab.php?seed=2&dialect=oldway` — the precentor's lines and
  the ward's slow replies: no hiss before either.

**The cast lab** — `http://127.0.0.1:8133/art/kolob/cast-lab.php`. Press
▶ Play; the chart lights whoever is singing and puts a halo on whoever is
forward; the log prints what happens, in Deseret.
- **`?seed=3&dialect=tabernacle`** — FAR WATER, led by 𐐊𐐺𐐮𐑌𐐲𐐼𐐴 𐐗𐑊𐐲𐑁 (a bass,
  "the retired schoolteacher"). The organ gives out the tune; verse 1: a
  child sings the tune (0:07), loses the words on a line (0:14, she hums)
  and finds them (0:21), and the newcomer joins on the third line (0:21);
  verse 2: the harmony alto comes forward (0:36), the old bass on the last
  two lines (0:51 — late, flat, huge); verse 3: the enthusiast (1:06).
  **Untick "organ"** to hear the chorister key it himself: sol–do, then the
  first note (0:00).
- **`?seed=7&dialect=sacredharp`** — GARDEN GROVE, the hollow square. **The
  pitching (0:00–0:04):** the keyer hums the tonic, the tenors find their
  note, then the basses, trebles and altos, a chord of 32 building; then
  verse 1 on the notes, the newcomer arriving on line 2 (0:09); verse 2: a
  child on the tune (octave up: the tune is the tenor's) and the old bass.
- **`?seed=2&dialect=tabernacle`** — NEW HANDCART: the soloist's
  **descant** over verse 3 (1:23), the old bass under it (1:40).
- **`?seed=4&dialect=tabernacle`** — LAMPLIGHT HILL: verse 2 is the
  soloist's **treble verse**, alone over the organ (0:37).
- **`?seed=1&dialect=tabernacle`** — NAUVOO: the chorister **hums the
  first note under the organ's last chord** (0:05); verse 2 in **unison**
  (0:57); verse 3 with the descant (1:48).
- **`?seed=2&dialect=oldway`** — MORNING STAR: the chorister hums the key
  (0:00), the precentor lines out every line, the ward answers slowly, each
  their own way; the old bass forward in the reply (1:03).

**The voices lab** — `http://127.0.0.1:8133/art/kolob/voices-lab.php`:
demo **2a** (the full ward) for the voices themselves; the bench's new
**honk test** and **join meter** buttons show the two fixes as numbers.

---

## What shipped

### `kolob-voices-vocal.js` (KOLOB.VoicesVocal) — the voices

Backward compatible: `hymn-lab.js` (the HYMN crew's) calls it unchanged
and gets every fix. New, optional: `sing(ctx, dest, t, notes, gain,
{breathBefore, breathe, pan})`, and `spec.sharedPan`, `spec.level`.

- **The breath** passes through each person's own envelope (so a desk's
  people, or one singer, can only breathe *inside* the tone); the throat's
  independent exhale tail and line-start puff are gone. The aspiration is
  quieter (0.06 × breath, was 0.10) and softer above 5.5 kHz.
- **The inhale** is its own low noise (350 Hz – 2.8 kHz, a murmur),
  only where a phrase breathes (before the line, in the rest the caller
  says it left, or a rest ≥ 0.25 s), audible from a share of the singers
  (0.25 + 0.6 × breath), and quiet (0.011 × (0.5 + breath) at its peak).
- **The fricatives** (the *s* and *f* of fa/sol): s 0.015 (was 0.055),
  f 0.008 (was 0.025), s 80 ms (was 110), f 70 ms (was 85), on the
  singer's own time, and the voice dips to a quarter under them (was
  6 %): thirty-two small s's at thirty-two moments smear into a brush a
  tenth of a second long, so each must be small.
- **No level change faster than 10 ms** (open issue 3): a point that
  cannot fit is dropped, never squeezed into 0.5 ms.
- **The late man's mouth** (open issue 1): the throat's timeline moves by
  its lateness; a lone singer's mouth follows that singer's own onsets
  exactly; a desk's people scatter around the desk.
- **The honk** (open issue 2): a make-up gain per note from the mouth's
  own response at that note's harmonics (the RBJ formulas Web Audio uses,
  weighted by the source's tilt), toward one level per vowel (ah 0, oh
  −0.5, eh −0.7, ee −1.5, oo −1.9 dB), rising ~1.8 dB an octave; the
  reference keeps each throat's average where it was. F1 is tuned whenever
  the fundamental passes it (ceil, not round).
- **Born at t ≥ 0** (open issue 5); the oscillator starts on its first
  pitch, never its 440 Hz default. Young desks get a floor under their
  wandering (open issue 6). The voices lab's child sings at pitch (open
  issue 4). The voices-1 handoff's stale bits (open issue 7) are corrected
  in the lab's own text.
- **The lighter throat** — see "The full ward on a phone".

### `kolob-cast.js` (KOLOB.Cast) — the cast (pure planning + performer glue)

Pure (no AudioContext, DOM, clock or `Math.random` — checked in Node with
those trapped), reproducible (the same seed gives byte-identical JSON),
and every die drawn on the SCORE §3 streams:

```js
var root  = PJ2.Rand.stream(seed);
var ward  = KOLOB.Cast.seat(root.fork("cast:" + n));                  // the Sunday's ward
var hymn  = KOLOB.Composer.compose(root.fork("hymn:" + n + ":" + i), { dialect, id });
var perfS = root.fork("hymn:" + n + ":" + i).fork("performance");
var plan  = KOLOB.Cast.planHymn(ward, hymn, perfS, { organ, first, verses });
var sheet = KOLOB.Cast.score(ward, hymn, plan, { stream: perfS, keynoteHz });
var perf  = KOLOB.Cast.performer(ward, { V: KOLOB.VoicesVocal, synth: root.fork("synth:vocal"), organ: fn });
perf.pump(ctx, { near, hall }, t0, sheet, now + 3, { max: 12, urgent: now + 1.2 });   // from the engine's pump
```

- **The ward** (`seat`): 32 members (`S0`…`B7`), each `member:<id>` below
  `cast:<n>`: a Deseret name (given and family names from phonemic
  spellings, set in the alphabet's own letters; families sit together), a
  pew, a voice spec for `VoicesVocal.singer` (age, confidence, brightness,
  breath, pitch and timing habits, tract), an Old Way appetite and
  lateness. Then **8–12 individuals** (`role:<role>` forks): the chorister,
  the precentor and the soloist always; three to five of the old bass, the
  harmony alto, the enthusiast, the child and the newcomer; two or three
  testimony-bearers; and the organist. Each is an archetype from a roster
  of **41** (`KOLOB.Cast.ROSTER`: five choristers, four precentors, four
  soloists, three each of old basses, altos, enthusiasts, children and
  newcomers, eight testimony-bearers, five organists) that reshapes their
  voice (the patriarch: 16–28 cents flat, 80–110 ms late, +2 to +3 dB) and
  gives them habits (a chorister's tempo, rubato, fermata hold and keying
  habit; a precentor's appetite for ornament and pace; a child's chance of
  losing the words; a testimony-bearer's speech rate, range and contour —
  for the testimony, later; an organist's style — for the organist's
  fills, later). The child sits beside a parent in the pews; the organist
  at the organ.
- **The plan** (`planHymn`): a `Performance` per verse (SCORE §5.1, via
  `KOLOB.Score.performance`, valid by `validatePerformance`) with a
  `forward` list: who comes forward, on which lines, doing what. The
  practices: Sacred Harp verse 1 **notes**, then **sung**; the Old Way
  **lined** (the precentor forward on every line); the Tabernacle **sung**,
  now and then a **hummed** middle verse (~14 %) or one in **unison**
  (~10 %), and the last of three or more verses a **descant** when the
  soloist has the appetite (or, ~22 %, the soloist's **treble verse**, the
  ward silent under her). Rules: never more than two forward on a line;
  never the same person two verses running (the precentor excepted); the
  treble verse is hers alone; the newcomer is silent in the day's first
  hymn until the line they join on. The keying: **pitching** before a
  Sacred Harp tune; the chorister's **keying** before any unaccompanied
  hymn (in her habit: a hummed do and the first note; "fa… sol… la…"; or
  sol–do), and now and then (~20 %) hummed under the organ's last chord.
- **The sheet** (`score`): every singer's line as `{at, memberId, bus
  ("hall" | "near"), pan, gain, notes: [{f, dur, vowel, …}], breathBefore}`
  in seconds from the hymn's start; the organ's lines (the giving-out of
  the last line first, then under each verse); the typed events
  (`hymn-announced` with `leaderDs`, `verse-start`, and `cast`: "keys the
  hymn", "pitches the tune", "lines out", "comes forward", "sings the
  descant", "sings the treble verse", "sings the tune", "loses the words",
  "finds them again", "joins in", "sings out", "blends back into the ward", "falls silent" — all
  valid by `KOLOB.Score.validateEvent`); and the join times (for the
  benches). The pitching: the keyer's tonic (0.8–1.1 s), then the tenors
  (~0.75 s), the basses (~1.2), the trebles (~1.55), the altos (~1.9), each
  person ±0.1–0.18 s, all held to 3.3–4.1 s, a breath, and the verse —
  3.5–4.1 s for the chord, measured over 12 seeds, all 32 voices.
- **The descant** (`descantLine`): a chord tone above the tune for each
  chord (a third or more over it, do′ to sol″), nearest the last, repeats
  tied, closing on mi′ or do′.
- **The performer** (`performer`): hands each cue to the member's singer
  (made once, `sharedPan`, dice from `synth:vocal` → `member:<id>`), the
  organ's cues to a callback. It reads no clock: the caller passes the
  horizon (and, with `pace`, at most `max` lines a call unless due before
  `urgent` — a line of the full ward is 32 graphs; built all at once, an
  early phone test showed a 174 ms task at 4× throttling).
- **Checked** (Node, 12 seeds × 3 dialects): 32 seated, 8–12 individuals,
  the four fixed roles present, 2–3 testimony-bearers, Deseret names with
  no Latin letters, every Performance and every event valid against
  `kolob-score.js`, cues sorted with finite pitches in 40–2000 Hz, never
  more than two forward, the Old Way always lined, every unaccompanied
  hymn keyed, every pitching 3–5 s with 32 voices, identical output twice.

### `cast-lab.php` + `cast-lab.js` — the lab

A seed, a dialect, a mode, verses, organ on/off, "the day's first hymn".
The hymn board (with the chorister's name and the plan: the keying or the
pitching, each verse's practice and who comes forward), the seating chart
(pews, or the hollow square for the Sacred Harp; individuals ringed and
numbered; a halo while forward), who is who (role, Deseret name, the
archetype, the voice's habits, their moments in this hymn), the log. The
bench: *Render & measure the joins* (offline, as heard and with the folds
silenced), and the *phone test*. `window.CastLab` exposes `build`, `play`,
`stop`, `measure`, `stress`, `headroom`, `summary` and `level` for
headless checks. It loads the engine (`_engine.php`) for the phone test's
meeting, then `kolob-voices-vocal.js`, `kolob-voices-pipeorgan.js`,
`kolob-cast.js`.

### `voices-lab.*`

The honk test and the join meter on the bench; the child at pitch; the
page says the desks are the documented fallback; the status line no longer
prints desk knobs for the 32-singer demos.

---

## The measurements

### 1. The hiss

**How it was measured.** The hymn lab's own full-ward code (`fullWard`,
`assignment`, `partEvents`, `toSung`, `decorate`, the lined-out precentor
and the amen — copied verbatim into a bench page, with the vocal module
passed in) rendered offline, two verses, the ward alone (no organ), dry,
through the lab's hall routing without dynamics (so stems add). **Before**
is HEAD's `kolob-voices-vocal.js` (`5b59c23`), **after** this branch's, on
the same Score. Two stems each: the full ward, and the same render with
every singer's glottal wave replaced by silence ("the folds silenced"),
which leaves exactly the breath and the consonants. The band is 3–12 kHz;
a *join* window is the 150 ms around each onset of any part (60 ms before
to 90 ms after the written onset: the singers are late); *between lines*
is a line's first onset (the breath before it); *inside held notes* is the
middle of every melody note ≥ 0.45 s, for reference. Flatness is the
band's spectral flatness (≈ 0 a chord, ≈ 1 a hiss).

**The final code** (this branch's head; seed 7 measured before the last
commit, which only replaced the vibrato's oscillator with an identical
curve), two hymns:

| hymn | where | breath and consonants alone, 3–12 kHz (dB), before → after | as heard: how noise-like (flatness), before → after | as heard, 3–12 kHz (dB), before → after |
|---|---|---|---|---|
| seed 4 Tabernacle (BETHEL) | between notes (55 joins) | −64.3 → −67.2 (**−2.9**) | 0.073 → 0.048 | −48.4 → −47.3 |
| | between lines (9) | −60.9 → −72.4 (**−11.5**) | **0.317 → 0.062** | −57.4 → −58.5 |
| | inside held notes (reference) | −64.4 → −65.9 | 0.063 → 0.042 | −47.2 → −46.1 |
| seed 7 Sacred Harp (WINTER QUARTERS) | between notes (56) | −56.0 → −65.4 (**−9.4**) | 0.128 → 0.065 | −48.1 → −47.2 |
| | between lines (8) | −54.5 → −66.8 (**−12.3**) | **0.289 → 0.144** | −53.2 → −57.6 |
| | inside held notes (reference) | −64.0 → −65.5 | 0.066 → 0.043 | −46.6 → −45.3 |

**All five hymns**, from an earlier run (`af8e190` plus the tilt trim).
Since then: CPU work, a darker tilt, and softer *s* and *f* (the final
code's Sacred Harp row above is 2–3 dB quieter again at the joins than
this table's; the Tabernacle's is within half a dB):

| hymn | where | breath and consonants alone, before → after | flatness as heard, before → after |
|---|---|---|---|
| seed 4 Tabernacle (BETHEL) | between notes / between lines | −64.3 → −66.8 (**−2.5**) / −60.9 → −72.0 (**−11.1**) | 0.073 → 0.061 / 0.317 → 0.066 |
| seed 7 Sacred Harp (WINTER QUARTERS) | " | −56.0 → −63.3 (**−7.3**) / −54.5 → −63.4 (**−8.9**) | 0.128 → 0.092 / 0.289 → 0.161 |
| seed 1 Sacred Harp (RIMLIGHT) | " | −54.4 → −62.3 (**−7.9**) / −52.1 → −60.6 (**−8.5**) | 0.135 → 0.083 / 0.228 → 0.167 |
| seed 4 Sacred Harp (SABBATH SPRING) | " | −55.9 → −63.1 (**−7.2**) / −57.7 → −66.7 (**−9.0**) | 0.129 → 0.089 / 0.245 → 0.134 |
| seed 2 Old Way (SEGO) | " | −64.8 → −67.9 (**−3.1**) / −70.5 → −68.7 (+1.8: the new inhale, below 3 kHz mostly) | 0.080 → 0.068 / **0.497 → 0.092** |
| seed 2 Old Way | before the precentor's line | −66.0 → −76.8 (**−10.8**) | 0.397 → 0.162 |

| hymn (dry, the ward alone) | loud half (dBFS), before → after | peak | clicks, before → after |
|---|---|---|---|
| seed 4 Tabernacle | −26.4 → −25.9 | −11.9 → −10.3 | 1 → **0** |
| seed 7 Sacred Harp | −25.9 → −25.9 | −10.7 → −11.8 | 1 → **0** |
| seed 1 Sacred Harp | −27.8 → −26.8 | −13.0 → −11.4 | 2 → **0** |
| seed 4 Sacred Harp | −26.4 → −26.0 | −11.1 → −11.2 | 1 → **0** |
| seed 2 Old Way | −27.6 → −28.1 | −11.6 → −12.6 | 0 → **0** |

(The loudness is unchanged within a dB. HEAD's click at 0.55 s in every
hymn was a line's birth before t = 0.45 s — open issue 5. Rows for seed 4
Tabernacle, seed 7 and the Old Way are the final code's, the other two the
earlier run's; one intermediate build showed a click in the Old Way that
the final code does not.)

**Reading it.**
- **Between lines — the hiss the owner heard — is gone.** In HEAD, the
  3–12 kHz band in the breath before a line was noise (flatness 0.29–0.50:
  the exhale tail and the "h" puff of 32 singers). Now it is the voices'
  own tails (flatness 0.06–0.16, about what held notes read) and the
  breath alone there is 11.5–12.3 dB quieter (8.5–11 in the earlier run's
  five).
- **Between notes, on vowels** (the Tabernacle, the Old Way), the breath
  alone was never loud against the voices (about 16 dB under them), but
  it did not dip with them; now it does (−2.5 to −3.1 dB at the joins,
  flatness down by a third).
- **Between notes, on the notes** (the Sacred Harp's first verse), what is
  left are the consonants of "fa" and "sol" — 9.4 dB quieter than in HEAD
  (seed 7, final code), and in the full ward's spectrogram they no longer
  stand out of the voices (they were the dark columns in HEAD's: very
  likely the "brushing s sound" itself, when the owner listened to a Sacred
  Harp hymn).
- **No new clicks.** None in any of the five, and none in the cast lab's
  renders.
- **Brighter by a little inside held notes** (+1.5 dB in 3–12 kHz as
  heard): the honk fix lifts the closed vowels (ee, eh), which carry their
  energy high; the throat's tilt was trimmed ~1.5 dB above 5 kHz to meet it
  halfway. The joins, which were the complaint, are quieter than before in
  every row.
- **Caveat:** the bench composes the hymns without the hymn lab's
  day-theme gestures, so a line may differ slightly from what the lab
  sings for the same seed; the names (BETHEL, WINTER QUARTERS, SABBATH
  SPRING, SEGO) match r3-hymn-1's.

**To re-run it:** the bench (a page and a script that copy the hymn
lab's ward code, a router for `php -S`, and a muted CDP driver) is in the
crew's scratch directory,
`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3cast/`
(`hissbench.html/.js`, `router.php`, `cdp.js`, `ev.js`, `final3.sh`;
`mouthtest.js` + `mock.js` for the mouth; `casttest.js` for the cast). In
the repo, the voices lab's *join meter* and the cast lab's *Render &
measure the joins* give the same kind of reading for their own music (the
cast lab, seed 7 Sacred Harp, first 40 s through the lab's chain: 0
clicks, loud half −17.3 dBFS, flatness 0.072 at the note joins and 0.104
at the line starts).

**Spectrograms** (0–12 kHz, linear; the top pair is the full ward before
and after, the bottom pair the breath and consonants alone; blue ticks mark
note joins, green ones line starts):
- `handoff/r3-cast-1-hiss-tabernacle-4.png` — seed 4, BETHEL, 6.2–10.6 s
  (a line break at 8.3 s).
- `handoff/r3-cast-1-hiss-sacredharp-7.png` — seed 7, WINTER QUARTERS,
  2.5–6.9 s (verse 1 on the notes: the dark columns in HEAD's are the
  ward's *s* of "sol" and *f* of "fa").

### 2. The late man's mouth

A Node mock that records every AudioParam call (the old bass on "sol fa sol
la · sol fa", timing habit 0 vs 95 ms, the same seed): **before**, his
fricatives and vowel-gate switches moved **0 ms** and his pitch 95 ms;
**after**, fricatives, gates and pitch all move **95 ms**. The same mock:
no envelope step under 10 ms (before: 6, the shortest 0.5 ms), no event at
a negative time (before: 50–71 per line), no biquad automation (0 of every
filter param).

### 3. The honk

One steady singer (confidence 0.95, no habits) sings a scale across each
part's compass on each vowel; each note's level is its steady middle
(RMS, dry).

| part | vowel | before: worst note over its neighbours · largest step between notes · mean level | after |
|---|---|---|---|
| S | ah | +7.4 dB (436 Hz) · 8.0 · −24.2 | +0.3 · 0.6 · −22.9 |
| S | ee | +7.2 (327 Hz) · 8.7 · −22.5 | +0.2 · 0.5 · −24.6 |
| S | oo | +5.2 (436 Hz) · 6.7 · −23.0 | +0.1 · 0.4 · −25.0 |
| A | ee | +7.1 (294 Hz) · 7.4 · −22.6 | +0.2 · 0.6 · −24.4 |
| A | oo | +5.8 (349 Hz) · 7.2 · −22.5 | +0.3 · 0.8 · −24.8 |
| T | oo | +6.8 (327 Hz) · 8.0 · −21.7 | +0.4 · 0.9 · −23.3 |
| T | ee | +6.9 (327 Hz) · 7.5 · −21.3 | +0.2 · 0.9 · −22.7 |
| B | eh | +4.7 (245 Hz) · 6.7 · −24.0 | +0.5 · 0.6 · −23.1 |
| **all 20** | | **worst +7.4 dB, largest step 8.7 dB** | **worst +0.5 dB, largest step 1.3 dB** |

(The rows shown are the worst eight of HEAD's twenty; every one of the
twenty is ≤ +0.5 dB after. "oo" was louder than "ah" in HEAD for the
tenor and the bass — the reverse of real voices; now ah is the fullest and
oo the softest in every part. Run it: the voices lab's bench, *the honk
test*.)

### 4. The full ward on a phone

**What was done to the throat** (every singer, every line):

| | HEAD | now |
|---|---|---|
| nodes built for a lone singer's line | ~32–48 (6 shared + 6 breath + 4 person + 4 a vowel bank) | ~24–40 (1 out, 2 filters, 2 breath, 2 person, 4 a bank; the inhale's 2 and the fricative's 2 only when used) |
| idle vowel banks | processing all line long (fed in parallel, gated after) | silent (gated before, a constant 0 until they open) — skipped |
| the breath's filters | a highpass and a bandpass per singer | none (baked once per context) |
| the vibrato | an oscillator and a gain per singer | a value curve on the detune, with the drift |
| a line's sources | running 0.45 s before and 0.4 s after | from 0.12 s before the first sound to 0.12 s after the release |
| after the line | left for the collector | unhooked from the room when its oscillator ends |
| panners | one per singer per line | shared, one per twentieth of the field (`sharedPan`) |

**The audio thread (offline, the cast lab's seed 3 Tabernacle hymn, its
first 20 s, the ward alone; best of three, on an Apple M3 Pro):**

| | ms of rendering per second of music | against a yardstick of plain voices (a sawtooth through three filters) | nodes sounding at once, peak |
|---|---|---|---|
| HEAD's voices | 324–394 | ~320–400 voices' worth | 2,276 |
| this branch | **167** | **~166 voices' worth** | 1,005 |

So the full ward now takes about **17 % of one core** of this Mac, about
half of what it took. (Under heavy load one run read seven times cheaper,
and `0aab504`'s message quotes it; the calm best-of-three is the honest
figure.)

**The phone test: real time, muted, the page's CPU throttled 4×, a whole
meeting underneath** (the cast lab's `stress`: `KolobAudio` plays seed 3's
meeting and is skipped to its hymn — the engine's own organ, choir, drone
and strings sounding — while the full ward sings the cast lab's hymn in
the same AudioContext; 60 s; load average 7–10):

| run | audio clock | underruns | lines handed | late | the tightest | main thread |
|---|---|---|---|---|---|---|
| the ward over the meeting | × 1.000 (worst 5 s × 0.988) | **0** | 258 | **0** | 3.35 s ahead | 1 long task, 60 ms |
| the meeting alone (control) | × 1.000 (worst 5 s × 0.999) | 0 | — | — | — | none |
| the ward over the meeting, again | × 1.000 (× 0.988) | **0** | 258 | **0** | 3.35 s ahead | 1 long task, 63 ms |

**Honestly, what this does and does not prove.**
- DevTools' CPU throttle slows the page's **main thread**: the pump, the
  building of each line's graph, the page. At 4× every line was handed
  over more than three seconds early and the longest task was 63 ms (the
  pump hands at most 12 singers a tick; in Node a line of one singer costs
  0.16 ms to build).
- As far as I can tell it does **not** slow the **audio thread**
  (Chromium's throttler suspends the renderer's main thread; in a calm
  moment a probe of 300 plain voices kept time both unthrottled and at 4×;
  under the afternoon's heavy load the probes were too noisy to say more).
  So the audio side is the offline figure: ~17 % of an M3 Pro core for the ward. A mid-range phone core is
  roughly 2.5–4× slower than this one, which puts the ward at roughly
  40–70 % of its audio thread before the meeting's own share. That is
  plausible, not proven: **a real mid-range phone has not played it.**
- Under the heavy load of the afternoon (load average 15–26, other crews'
  renders and my own running beside it) a first attempt fell behind (clock
  × 0.27) while the meeting alone kept time but glitched (37 s of
  underruns in 60): the ward is a real share of the audio thread, and the
  headless audio thread is not protected from the rest of the machine.
- **The next cuts, if a phone needs them** (in order of what they would
  save, none audible in the mix): share a handful of breath noises across
  the ward instead of one per singer; fold the out gain into the gates;
  two formants instead of three for the inner parts' vowel banks. The
  desks stay in the code as the owner's documented fallback only.

---

## Requests (for the integrator)

1. **Loading, when the engine sings with the cast.** Add
   `kolob-voices-vocal.js` (the voices) and `kolob-cast.js` (the
   performers) to `_engine.php` and `$kolob_assets`. Until then the cast lab
   loads them itself, after the engine.
2. **Wiring (the "later step").** Hand the cast's sheet to the voices from
   the engine's own pump with `performer.pump(ctx, buses, t0, sheet, now +
   lookahead, { max: 12, urgent: now + 1.2 })` — scheduled times only,
   never PJ2's `lane.in/every` (SCORE §9.3). `buses` is `{near, hall}`: the
   ward into the room, the forward voices drier. Lead ≥ 0.7 s.
3. **SCORE §3, streams** as implemented: `cast:<n>` → `families`,
   `member:<id>` (S0…B7), `role:<role>` (`role:testimony:<k>`); the hymn's
   `performance` fork → the plan's dice, then `vowels:<v>`,
   `precentor:<v>:<li>`, `orn:<id>:<v>:<li>`, `child:<v>`, `descant:<li>`,
   `pitching`; sound-level `synth:vocal` → `member:<id>`.
4. **SCORE §5.1, adopt as used:** `Performance.forward` (`[{memberId,
   role, action, lines, gainDb}]`); the plan's `keying` (`{kind: "keying" |
   "pitching", by, habit, under?}`); the cue sheet's shape (in
   `kolob-cast.js`'s header).
5. **SCORE §6.** `cast` events are now emitted (the actions listed above);
   `hymn-announced.leaderDs` is the chorister; `hymn.authorDs` rides along
   (the HYMN crew's request 3).
6. **SCORE §1 addendum (voices-1 request 2, updated):** `sing(ctx, dest, t,
   notes, gain, {breathBefore, breathe, pan})`; `spec.sharedPan`,
   `spec.level`. PLAN-EXECUTION: list `kolob-voices-vocal.js` under CAST.
7. **For the HYMN crew (FYI, nothing required):** the hymn lab gets the
   hiss fix by loading this file. Its pump builds all 32 singers of a line
   in one call — about 170 ms on the main thread at 4× throttling; the
   cast's paced pump spreads it.

## Known issues, and what is not done

- **Tuned by measurement, not by ear** (I cannot hear). The knobs the
  owner's ear should set: the inhale (`0.011 × (0.5 + breath)`, heard from
  a share of the singers), the breath in the tone (`0.06 × breath`), the
  *s* and *f* (`FRIC_PEAK`), the vowels' levels (`INTRINSIC`) and the rise
  up the register (0.3 in `level()`).
- **The Sacred Harp's first verse still has consonants between its notes**
  — they are the syllables fa and sol. Softer and shorter, and now each
  singer says them at their own moment; if the owner still hears them as a
  brushing, `FRIC_PEAK.s` is the knob.
- **The phone:** measured in headless Chrome on this Mac, heavily loaded
  while I worked (other crews' renders and a game; load averages 7–24).
  DevTools' 4× throttle slows the page's main thread, not the audio thread;
  the audio side is estimated from offline cost (above). A real mid-range
  phone has not heard it. The desks stay in the code as the fallback, and
  nothing switches to them.
- **Seated but not yet performing:** the testimony-bearers (their speech
  habits are drawn, for the testimony's speech-melody) and the organist
  (a style is drawn, for the fills between lines, §14.4). The organ in the
  lab is the pipe organ, played plainly.
- **Practices not yet:** echo and refrain (gospel), the Primary's and the
  Shaker unison songs — their dialects are not composed yet.
  `Performance.lines` is not used.
- **More vowel banks than before** for a high voice on "ee" or "oo" (a
  tuned bank per 60 Hz once the note passes the first formant). They cost
  nodes (built, then idle and silent), not sound or audio time.
