# r25-polish-1: the pre-v0.34 polish

*Crew: polish (round 2.5). Branch `kolob-r25`. 2026-09-27.*

The six things the owner asked for after listening to round 2
(PLAN-COMPOSITION §15), built and measured. Nothing was pushed or
published, and VERSION is not bumped (the integrator numbers v0.34). Every
check was silent: the Node harness, OfflineAudioContext renders, and muted
headless Chrome.

Commits: `50a2562` (the calendar, the prelude's seating, the house lets go,
the old tune, open dawns), `461b230` (the trombones' sound), `a57d0dd` (the
spent hands leave the hall; `TromboneLab.brass()`), and this note.

---

## For the owner: what changed, and where to hear it

Start this branch's server and open a seed, then press PLAY:

```
php -S 127.0.0.1:8121 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r25
http://127.0.0.1:8121/art/kolob/?seed=16
```

Times are the page's own clock (mm:ss from PLAY). **Every seed plays a
different Sunday than it did in round 2**: the kinds of Sunday, the keynote
and the opening all draw differently now, so round 2's seed numbers no
longer point at the same moments.

**Honestly, by size:**

1. **The trombones sound like brass now. (Big — this is the one to
   judge.)** They were a "muted, muddy organ" because the tone was cut off
   around the fourth harmonic, the far choir sat behind a heavy muffler,
   every note faded in, and one note melted into the next the way organ
   chords do. Now each note is tongued (a small "t" of breath, then the lip
   settling onto the pitch), the tone gets brighter as they play louder, the
   notes in a line are gently separated, and the far choir keeps its brass
   (it is farther away by level, side, echo and air, not by being muffled).
   The near choir is about 5 dB louder.
   - **Seed 1847, 0:06–0:50.** The far choir from the left at 0:06, the near
     one answers from the right at 0:17, both together at 0:41; the house
     (organ, then field and strings) comes in at about 0:50.
   - **Seed 7, 0:05.** A brighter, bigger Sunday: far choir 0:05, the answer
     at 0:19.
   - **Seed 17, 0:05.** Far choir 0:05, answer 0:20.
2. **The trombones end where the hymn ends. (Small, but you asked.)** The
   forced home chord is gone. **Seed 7** ends on a minor chord (vi),
   **seed 17** on IV, **seed 13** off the tonic too (its end is near 1:05).
   Of 219 dawns the planner seated in a thousand meetings, 40 % now end on
   the home chord and 60 % elsewhere (round 2: every one on the home chord).
3. **Every visit wakes differently. (Big for variety.)** Round 2 woke every
   Sunday the same way: drone, then the organ at 0:02.7, field at 0:16,
   strings at 0:24. Now each Sunday draws how its morning is seated, and
   every entrance time is drawn too:
   - **Seed 12, organ first** (an organ voluntary): organ 0:02.8, drone,
     field 0:18.
   - **Seed 3, the drone alone:** drone 0:00.7, the field 0:05, the organ
     not until 0:16.
   - **Seed 2, the valley first:** a field sound at 0:00.5, the music-box
     tines at 0:05, the drone at 0:11, the organ at 0:24.
   - **Seed 5, the parlor:** the harmonium sets the first chord at 0:03,
     the clarinet answers at 0:21.
   - **Seed 15, the brush arbor:** no organ in the prelude at all; strings
     on bare fifths at 0:07, clarinet at 0:19.
   - **Seed 1, the steeples call the valley in:** bells at 0:01.6, the house
     after them.
   - The first organ chord now has its third about 4 times in 10 (round 2:
     1 in 8), and the keynote ranges over 7 semitones instead of 4.
   - The prelude's length depends on the seating, so the first hymn starts
     anywhere from about 2:15 to 3:30 (seed 14 at 2:18, seed 2 at 3:31).
4. **Fewer fast Sundays. (Small to hear, real over many visits.)** A first
   visit was a fast Sunday 36 % of the time; now it is about 15 %, with
   ordinary Sundays about half and conference and jubilee Sundays the rest.
5. **The old tune is quieter and every note is sung. (Medium.)** It was as
   loud as a hymn; it is now 7 dB softer, a memory at the edge of the field.
   Repeated notes are struck again instead of blurring into one long note,
   and its first note starts at once.
   - **Seed 16, 0:20–0:58: "The Spirit of God" (ASSEMBLY).** Listen for the
     repeated notes in the first line, and the faint second try.
6. **The house lets go when a guest comes in. (Small, but it removes the
   worst clash.)** When a visitor enters, the organ's chord, the strings'
   pad and the harmonium's and clarinet's lines fade out over a second and
   a half instead of ringing on underneath (round 2 had an organ chord a
   comma out of tune under the far trombones).
   - **Seed 16, 0:20:** the organ lets go as the old tune comes in.
   - **Seed 2, 4:03:** the organ and strings let go as the marching bands
     arrive in the hymn.
   - **Seed 15, 3:24:** the strings and clarinet let go for the bands.

**Still true (not this round):** the trombones and the old tune are still
not engraved (that is the ENGRAVE crew's; you asked for it, and it is
requested below); the trombones' hymn is still the day's theme poured into a
hymn shape until the composer lands.

---

## What shipped (for the integrator and the critic)

| # | owner ruling | where | what |
|---|---|---|---|
| 1 | the trombones sound better | `kolob-voices-band.js`, `kolob-guest-trombones.js`, `trombone-lab.js` | a new trombone voice (below); the distance stage without the blanket lowpass; the distance table re-measured; the near choir mp–mf and the bus +2 dB; the far choir 6–8 LU under it; a 0.9 s beat floor; legato-tongued joins; `TromboneLab.brass()` |
| 2 | the trombones end open | `kolob-meeting.js` `dawnChorale` | the forced final I is reverted; the harness now fails a forced ending instead |
| 3 | fewer fast Sundays | `kolob-meeting.js` `planMeeting` | `CALENDAR` weights for every meeting (ordinary 52, fast 15, conference 19, jubilee 14); the season placed within the kind; the cosine's dice still thrown |
| 4 | vary the opening | `kolob-meeting.js` (THE PRELUDE'S SEATING), `kolob-core.js` (the waking), `kolob-voices-organ/-winds/-ground.js`, `kolob-harmony.js` | eight seatings on `prelude:<n>`; drawn entrances, first chord full/open, prelude length; the arbor's rests; the parlor's harmonium first; `F0_RANGE` 52–78 Hz |
| 5 | lower the old tune | `kolob-guests.js` `farVoice` | −7 dB; a ~50 ms dip at every onset (re-strike to 0.2 on a repeated note, a lift to 0.62 on a step); glide ≤ 60 ms; attack 0.12 s |
| 6 | the house lets go | `kolob-core.js` (THE HOUSE LETS GO), `kolob-meeting.js` `arrive`, the house voices, `kolob-score.js` | per-layer hands in the meeting's doors; a 1.5 s release at every guest's entrance; no house turn begins inside it; typed event `house-lets-go` |

### 1. The trombones

**The voice** (`kolob-voices-band.js`, THE TROMBONES):

- a richer forte wave (tilt 0.3–0.35) under a lowpass two to three times
  higher: `(lo + span·d^1.3)·f`, never under `bell·(800 + 3200·d^1.5)` Hz;
- a **brass band**: a peaking filter at 1.0–1.4 kHz whose gain runs −3 dB
  (pp) to +9 dB (ff) and whose centre climbs `×(0.85 + 0.6·d)`;
- **the tongue**: a 20 ms breath of band-limited noise near the seventh
  harmonic (a "t"; a softer "d" on legato notes), a lip scoop of 13–16
  cents settling in ~20 ms, and the partials blooming 1.3× as the note
  speaks; a breath attack (≥ 0.12 s) has no tongue;
- **legato is tongued**: the guest stops a joined note 22 ms early and
  releases it with τ 22 ms; the next speaks in 22–28 ms.

**Distance**: a high shelf above 2.5 kHz (−14·d dB) and a lowpass that
closes only to 6 kHz at 0.85 and 5 kHz at 1 (round 2: 600 Hz at 0.85). `DIST_DB`
re-measured (mean of seeds 1–3, dry, OLD HUNDRED at mf): −10.8 dB at 0.85
(was −11.4), −13.5 at 1 (was −16.9).

**The guest**: `nearDyn` 0.5–0.62 (was 0.4–0.5), `LEVEL` 1.45 (was 1.15),
`gapLu` 6–8 (was 7–9), `BEAT_FLOOR_S` 0.9, `TONGUE_S` 0.022; two exchanges
may run to 100 s, one below that; the alto trombone's extreme top is G5
(the wider keynote put a high hymn's top at 772.9 Hz once).

**Measured** — `TromboneLab.brass()` (new; dry, each trombone on one hymn
line, eight notes, first tongued, then legato-tongued):

| | pp | mp | mf | f | ff |
|---|---|---|---|---|---|
| alto trombone centroid, round 2 → now (Hz) | 619 → 911 | 710 → 1153 | 754 → 1289 | 809 → 1402 | 853 → 1488 |
| tenor trombone centroid | 451 → 721 | 540 → 933 | 574 → 1069 | 616 → 1227 | 658 → 1356 |
| bass trombone centroid | 349 → 578 | 435 → 722 | 469 → 818 | 501 → 949 | 531 → 1085 |
| tenor, energy above 1.5 kHz (dB of the whole) | −30.8 → −14.0 | −18.7 → −9.2 | −14.9 → −8.0 | −12.7 → −6.9 | −11.8 → −5.8 |
| **the organ reference** (gainMul 0.3 / 0.51 / 0.8) | | 369 Hz | 369 Hz | 369 Hz | |

- **The brightness rises with the dynamic**: the tenor's centroid climbs
  88 % from pp to ff (round 2: 46 %); the organ's does not move at all.
- **Attack**: the first note reaches 90 % of its level in 20–25 ms (round
  2: 45–50 ms; the organ 645–830 ms).
- **Articulation**: each legato join dips −9.1 to −9.7 dB (alto, tenor)
  and −14.5 to −16.8 dB (bass) for a few milliseconds (round 2: −2.5 to
  −5.5, a crossfade; the organ: none).
- **Dynamic range** (tenor line, pp → ff): 26 LU (round 2: 20.5).

**Level** (the lab's calibration, wide room, the loudest 3 s): the organ
reference −21.2 LUFS; the four-part choir at mf **−21.3 (−0.1 LU)**, round
2 −21.1 (+0.1). The choir's centroid at mf 1080 Hz (round 2 632; the
organ reference 403).

**The dawn** (`TromboneLab.check("dawn")`, five chorales; each choir also
rendered alone and measured while it plays):

| seed · mode · source | near LUFS, round 2 → now (vs the organ's loudest 3 s) | far LUFS | gap (drawn) | near / far centroid (Hz) | far energy above 1 kHz | dawn's loudest 3 s vs organ |
|---|---|---|---|---|---|---|
| 1847 · ionian · sample | −25.3 (−4.1) → **−20.3 (+0.9)** | −31.5 → −25.5 | 5.2 (6.2) | 617/411 → 1057/911 | −24.1 → −5.2 dB | −2.4 → +2.4 |
| 1847 · aeolian · engine | −25.0 (−3.8) → **−20.0 (+1.2)** | −31.8 → −26.7 | 6.7 (6.2) | 577/435 → 970/870 | −25.7 → −5.4 | −1.9 → +2.5 |
| 4 · dorian · sample | −25.5 (−4.3) → **−21.0 (+0.2)** | −32.8 → −28.0 | 7.0 (7.0) | 515/527 → 915/866 | −15.9 → −5.1 | −2.7 → +1.5 |
| 77 · mixolydian · engine | −25.3 (−4.1) → **−20.9 (+0.3)** | −34.3 → −29.2 | 8.3 (7.5) | 515/513 → 951/908 | −18.7 → −4.9 | −1.9 → +2.5 |
| 20 · penta · sample | −28.1 (−6.9) → **−23.2 (−2.0)** | −35.3 → −29.7 | 6.5 (6.9) | 574/526 → 974/907 | −19.3 → −4.9 | −4.4 → −0.2 |

- The near choir is **+4.4 to +5.0 LU** louder (the panel asked +4–6), and
  while it plays it sits **within 2 LU of the organ reference** (−2.0 to
  +1.2). The dawn's single loudest 3 s (a phrase's crest with the town's
  air) reaches +2.5 LU in three of five.
- 0 clicks, 0 clipped samples, peaks −4.0 to −7.3 dBFS.

**In the app** (`tools/capture.js`, seed 1847, 0:00–1:15, muted; the
300 Hz–4 kHz band, the Listener's measure, against the house that follows
the trombones):

| | round 2 | now |
|---|---|---|
| near choir vs the house | −7.4 dB | **−2.4 dB** |
| far choir vs the house | −13.1 dB | −8.7 dB |
| near / far centroid | 470 / 348 Hz | 795 / 696 Hz |
| near / far energy above 1 kHz | −26.9 / −35.1 dB | −11.5 / −14.5 dB |

The browser played the harness's meeting note for note (143 of 143), with a
clean console. (The machine was loaded: the audio clock ran at 0.69×, and
the tap lost four render quanta, marked in the capture's report — the
recording's, not the engine's.)

**The pace**: the harness's sweep reads seconds per written beat off every
seated dawn's score: min **0.90**, p10 0.90, median 0.94 over 5,748 steps
(round 2's fast Sundays ran 0.52–0.60).

### 2. Open endings

The harness's 1,000-meeting sweep, the dawn chorale's last chord by root:
**I 88, vi 53, IV 41, iii 20, V 16, ii 1** (of 219 seated; round 2: I 199
of 199). The harness now fails a chorale forced onto the tonic.

### 3. The calendar

- The harness (400 first meetings, the engine's planner): ordinary 50.0 %,
  fast 15.0 %, conference 22.0 %, jubilee 13.0 % (targets 52 / 15 / 19 /
  14; all within ±5).
- **Rendered, seeds 1–200** (meeting 1, `tools/render.js`, 75 s each):
  ordinary **56.0 %**, fast **14.0 %**, conference **19.5 %**, jubilee
  **10.5 %** — each within 5 points of its target (+4.0, −1.0, +0.5, −3.5).
- Round 2, the same 200 seeds: fast 36.0 %, ordinary 41.5 %, conference
  17.0 %, jubilee 5.5 %.
- The season (`seasonPos`, which leans the day's temper) now follows the
  kind: fast 0–0.35, ordinary 0.2–0.7, conference 0.5–0.9, jubilee 0.7–1,
  placed by the die that set the old cosine's phase. The period die is
  thrown and ignored, so every later die of the plan lands where it did.

### 4. The opening

Seeds 1–200, the first 75 s of meeting 1, rendered through the harness
(`opening.js`, after the round-2 Variety critic's `opening.js` and
`opentwin.js`; each layer's first sounded note, and the first organ chord's
notes relative to the keynote):

| | round 2 | now |
|---|---|---|
| most seeds sharing one entrance time (to 0.1 s) | **100 %** (drone @0.1; the organ @2.7 on every seed) | **8.5 %** (the still voice's first call in the invocation, @68.1); of the waking itself, 4.0 % (drone @0.7) |
| most seeds in one 1-second bin | 100 % | 20.0 % (drone, 3–4 s) |
| who sounds first | drone 100 % | drone 58.5 %, field 17 %, harmonium 12 %, organ 6 %, strings 5 %, tines 1.5 % |
| organ's first entrance, median | 2.7 s (all) | 17.9 s (seatings: voluntary 1.2–5 s … arbor after the prelude) |
| first organ chord with its third | 12.5 % | **44.8 %** |
| first organ chords: voicings (relative) | 18; the 4 commonest 69 % | 50; the 4 commonest 35 % |
| pairs of visits opening on the same relative chord | 12.9 % | **3.8 %** (the critic's test: < 5 %) |
| … and within 25 cents in absolute pitch | 1.34 % | 0.18 % |
| keynote window | 4.2 semitones | 6.9 semitones |

The seatings drawn: voluntary 24 %, trombones 21 %, valley 17 %, parlor
12 %, ground 12 %, arbor 5.5 %, strings 5 %, steeples 3.5 %. The harness's
own sweep (400 visits, the planned entrances) agrees: no waking entrance
shared by more than 5 % of visits.

The first hymn, on the 18 seeds scanned at 7 minutes: 2:18–3:31 (round 2,
per the Variety critic: 2:24–3:13).

**Distinctness** (`tools/distinctness.js`, seeds 1–20, round 2 `git:dcab4f6`
against this build through the same harness; "audible" is the round-2
Variety critic's `audible.js`, the same distance without the label-only
features — the kind of Sunday and the gestures' names):

| window | median D, round 2 → now | closest pair | near-twins (the tool's line) | audible median | audible pairs under half the median |
|---|---|---|---|---|---|
| first 30 s | 0.551 → **0.601** | 0.304 → 0.262 | none → 1 (seeds 8/12) | 0.502 → **0.560** | 6 → **4** |
| first 60 s | 0.579 → **0.593** | 0.370 → 0.346 | none → none | 0.533 → **0.554** | 0 → 2 |
| first 180 s | 0.585 → 0.587 | 0.357 → 0.346 | none → none | 0.547 → 0.542 | 1 → **0** |

- The first half-minute is where the seating shows: the median pair is 9 %
  farther apart (12 % by the audible measure) and fewer pairs sound alike.
  Over three minutes the tool barely moves: its features are totals over
  the window (densities, pitch and rhythm profiles, the kind of Sunday),
  and who enters when is not one of them. What it did register: "prelude
  length" is no longer among the features that separate least (round 2:
  76 % of pairs not separated by it).
- The one flagged pair at 30 s, seeds 8 and 12, is round 2's closest pair
  too (0.357 at 180 s): both ordinary pentatonic Sundays on the same
  theme, and both drew the organ voluntary.
- The timetable table above is the direct measure of the waking; the
  tool's is the indirect one.

### 5. The old tune

Offline renders in the page (OfflineAudioContext, the guest's own
`oldTuneRemembered`, F0 65, three tunes):

| tune | level, round 2 → now | a repeated note's re-strike | a step's onset | first note to 90 % |
|---|---|---|---|---|
| MARTYR | −28.4 → −35.3 dB | 0.0 → −12.6 dB | −0.8 → −4.1 dB | 350 → 105 ms |
| ASSEMBLY | −28.3 → −35.2 | −0.3 → −12.4 | −0.3 → −3.3 | 355 → 105 |
| KINGSFOLD (aeolian) | −27.8 → −34.7 | −0.2 → −12.8 | −0.5 → −4.1 | 355 → 110 |

**−6.9 dB** in all three (the ruling: 6–8). The harness's old-tune checks
all pass (every note the book's, the mode law, no memory under 8 s).

### 6. The house lets go

- **In code** (`kolob-core.js`, THE HOUSE LETS GO): each house layer
  (organ, strings, harmonium, clarinet) enters the hall through hands of
  its own in the meeting's doors. At a guest's entrance (`arrive`, the
  cued guests and the polled ones alike) the hands ramp to nothing over
  1.5 s and that door is spent: everything already written through it
  goes with it, the rooms keep the tail they were given, and the layer's
  next note comes in by new hands. No house turn begins inside the release,
  whether or not the house was playing. Reported notes stay the written
  ones (SCORE §9.2); the typed event `house-lets-go {guest, at, until,
  layers, released: [{layer, freq, startTime, duration, until}], logged}`
  names each note let go and when it was gone.
- **The harness** (new line, "the house lets go"): at every guest-start
  (the assembly excepted), every house note written to sound past
  entrance + 1.5 s must be named by that moment's release with `until` ≤
  entrance + 1.5; no house note may begin inside the release; and on the
  mock's audio graph every house source still sounding at the entrance
  must reach the hall only through the hands that let go, whose gain falls
  to 0 by entrance + 1.5 and never rises again.
- **Result**: in the short battery below, every guest entrance let go of
  every house note written past it (for example seed 113 with the Ives
  switch: 4 entrances, 18 notes let go, 66 live sources through the hands
  that let go; forced bands on seeds 2, 6, 11: 7, 3 and 7 notes), 0 rang
  on, and no house note began inside a release. Before (round 2), in 17 of
  24 forced dawns an organ chord still sounded 1.6–8.1 s into the far
  choir's entry.
- The spent hands leave the hall (are disconnected) one second after the
  last note written through them has stopped.

---

## How it was checked

All silent: the Node harness (the mock Web Audio), OfflineAudioContext
renders in muted headless Chrome (port 9431, profile
`/private/tmp/claude-501/kolob-polish-chrome`), and `tools/capture.js`
(muted). The machine was heavily loaded the whole time (load 10–14), which
slowed every run but moves no number the harness reports.

- **The harness battery** (short, per the owner's ruling): six seeds ×
  1200 s (1847, 5, 9, 77, 4242, 12); guests forced × 1500 s with ives razz
  cumulative (3, 12, 1847, 21); the Ives switch alone (113); 2700 s (1847;
  5 ives razz cumulative); unlogged (9 oldtune; 5 steeples); trombones
  forced × 900 s (1, 2, 3, 4, 5, 6, 10, 16), unlogged (7), with a withheld
  tune (8); bands, steeples and the old tune forced (2, 6, 11 each); the
  keynote pinned at 52 and 78 Hz (4 ives); and the trombones forced at
  both keynote ends (seeds 1–8 × 2). **33 of 36 passed on the first
  pass, and the 16 keynote-end runs all passed.** The three that failed:
  - 1200 s 1847: an alto-trombone note at 772.9 Hz, over its 740 Hz extreme
    (the wider keynote) — fixed (the extreme is G5), and the seed re-run:
    PASS;
  - 1200 s 9 force=oldtune unlogged=oldtune: the `house-lets-go` event did
    not say `logged: false` for an unlogged guest — fixed, re-run: PASS;
  - 2700 s 1847: no fuging entries (see Known issues: chance, not a
    regression).
  After the fixes, the six seeds × 1200 s, the unlogged old tune and 1500 s
  seed 21 ives razz cumulative were run again on the final code: **8 of 8
  PASS**.
- **REPRO** (the same seed twice, jittered timers, re-salted sound): **PASS
  ×3** — 1500 s 1847 ives razz cumulative; 1200 s 5; 900 s 3
  force=trombones. **TRANSPORT** (pause, STOP→PLAY) seed 1847: **PASS** — a
  30 s pause at 100 s plays the same meeting, silent while held; STOP at 150
  and 330 s, PLAY after 0.3, 8 and 25 s: 0 stale sources and 0 old reverbs
  reach the hall, the new meeting sounding.
- **The compass check** (the wider keynote): six seeds × 1200 s with the
  Ives switch at F0 52, 58, 74 and 78 Hz; each voice's 1st/5th/95th/99th
  percentile pitch compared. At 52 Hz the choir's basses' 5th percentile is
  D♯2 (at 58 Hz, F2); at 78 Hz the sopranos' 95th is G5 (at 74, F♯5). The
  trombones stay in their compass (one high hymn reached 772.9 Hz for the
  alto trombone at the new top; its extreme is now G5, 784 Hz).
- **Consoles**: `index.php?seed=1847` at 860 and 390 px, played 20 s: 0
  messages, no sideways scroll; `trombone-lab.php` at 860 and 390 px: 0
  messages, no sideways scroll; every lab render: 0 console errors. The
  capture of seed 1847: console clean, the browser's meeting the harness's
  note for note.
- **The lab's A/B**: round 2 served from `git archive dcab4f6` on its own
  port, the same measurement scripts against both. The scripts are kept in
  `/private/tmp/claude-501/kolob-r25-polish/` (`tbm-solo.js` is
  `TromboneLab.brass()`'s origin; `tbm-cal.js`, `tbm-dawn.js`,
  `tbm-dist.js`; `otm.js` the old tune; `opening.js` the timetable;
  `capan.py` the capture's bands; `cdp.js` the muted driver), with both
  captures.
- **Fuging** (a check the 2700 s run tripped, below): seeds 1–12 × 1500 s,
  round 2 21 fuging entries, now 20.

---

## Harness changes (`art/kolob/_harness.js`, untracked)

A copy is at `/private/tmp/claude-501/kolob-r25-polish/_harness.polish.js`
(the next integrator copies it). New or changed:

- **the house lets go** — the check above (the mock now writes down every
  gain's automation);
- **the calendar and the waking** — 400 first meetings (`caln=<N>`;
  `nocal` skips it): the kinds against `CALENDAR` (±5), the keynote inside
  `F0_RANGE`, and no waking entrance shared by more than 25 % of visits;
- **`f0=<Hz>`** pins every meeting's fundamental (the compass check);
- **trombones, out of the meeting**: the pace line (the 0.9 s floor); a
  forced tonic ending now fails (it used to be required); the seat's length
  bound is 101 s; the timing mock makes buffer sources.

## Requests

1. **SCORE.md (integrator)** — adopt, in §9:
   - **a guest rule: the house lets go.** "When any guest enters, the
     house's held notes (organ, strings, harmonium, clarinet) release over
     1.5 s (`S.HOUSE_RELEASE_S`), and no house turn begins inside the
     release. The reported notes stay the written ones; `house-lets-go`
     names what was let go."
   - **events**: `house-lets-go {guest, at, until, layers, released,
     logged}` and `prelude-seating {n, seating, at, full, spread, len,
     preludeS, sits}` (both in `KOLOB.Score.EVENTS`);
   - **streams**: `prelude:<n>` (the seating: five dice, then one per
     waker);
   - **the steeples in a prelude are cued** (`V.cued`, 1–6 s in), like the
     trombones.
2. **r2-tools** — `tools/lib/dump.js`: apply a `house-lets-go` release to
   the notes it names (heard until `until`), so the tools read what the
   hall heard; and consider an opening-timetable tool (the scratch one is
   described under "How it was checked").
3. **ENGRAVE** — the owner approved engraving the trombones and the old
   tune (PLAN §15); a released note should be drawn to its `until`.
4. **The integrator's VERSION line** (suggested): `v0.34 — the trombones
   play like brass and end where the hymn ends; every Sunday wakes its own
   way; fewer fast Sundays; the old tune softer, every note sung; the house
   lets go when a guest comes in`.
5. **Ideas for later** (not built): a "choir humming" seating needs a
   hummed practice in the prelude; the band's cornet already stood above
   its compass at the old keynote top (p95 G6) and is a semitone higher at
   the new one — its register wants folding.

## Known issues

- **Nobody has heard the new trombones.** Brightness, attack, articulation
  and level are measured, not heard. The things most likely to want the
  owner's ear: how bright (the brass band's +9 dB at ff; the near choir
  plays mp–mf, so it sits around +3 dB); whether the legato joins pulse too
  much (the bass trombone's joins dip deepest, −15 dB for a few ms); the
  tongue's "t" (−20 dB-ish of noise for 20 ms); the far choir's distance now
  that it is not muffled (it is 6–8 LU under the near one, on the other
  side, wetter, with an echo — and only a little darker).
- **The dawn's loudest 3 s can sit 2.5 LU over the organ reference** (a
  phrase's crest with the town's air, three chorales of five); the near
  choir while it plays is within 2 LU of it, and the choir at mf is −0.1.
- **The 2700 s run on seed 1847 fails "no fuging entries over a long run".**
  The calendar gave seed 1847 three different Sundays (ordinary,
  conference, jubilee — eight hymns); their section dice plan a fuging in
  only two of the eight (the dice are round 2's, unchanged), and both of
  those hymns' windows were filled by the choir's verses (round 2's
  "meadow" rule). Over seeds 1–12 × 1500 s the fuging count is unchanged
  (21 → 20). A chance outcome of the reshuffled Sundays, not a regression;
  the harness only judges it at ≥ 2600 s.
- **The house's reported notes stay the written ones**: a tool that reads
  note durations without applying `house-lets-go` over-states the house
  under a guest (request 2).
- **The still voice's first call** lands on a 7 s grid (68.1 s on 8.5 % of
  seeds), its poll cadence; it is below the 25 % line and not part of the
  waking.
- **Later meetings' preludes** use their seating's rests, first chord and
  length, but not its entrance times (their layers are already awake).
- **The trombones' hymn is still the day's theme poured into a hymn
  shape**; the composer replaces it.
- **The band's cornet** stands above its compass at a high keynote (known
  before the widening; a semitone higher now).
