> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r3b-ward-1: the ward sings the meeting

*Round 3b, step 1. Branch `kolob-r3b`. 2026-09-28.*

The Sunday's ward — thirty-two people with a throat each, and among them the
eight to twelve you come to know — now sings every hymn of the real meeting,
in all six styles the composer writes, and everything the old four-voice choir
sang around the hymns. Built, per the owner's ruling, as though there were no
phone to carry it: nothing was thinned for a device. The cost was measured and
is reported below as it is.

Nothing was pushed or published, and VERSION is not bumped. A suggested
branch-local line: `v0.35-ward.1 — the ward sings the meeting: thirty-two
voices and the people among them in every hymn, keyed and pitched, lined out
by the precentor, named in the minutes as they come forward`. Every check was
silent: the Node harness, and headless Chrome launched with `--headless=new
--mute-audio`.

Commits: `5010c106` (the ward sings the meeting), `a101f534` (the hummed and
unison verses; the Shakers' practice; the sister organist's name), `764c2c65`
(SCORE §11), and this note (`b9b58729` its draft, then its final).

---

## For the owner, in plain words

**What is new to hear, by size (honestly):**

1. **The hymns are sung by the ward. (The big one.)** Until now the meeting's
   hymns were sung by four "synth choir" voices; the thirty-two singers you
   heard in the hymn lab and the cast lab were lab-only. Now they sing every
   hymn in the meeting, in all six styles: the Tabernacle, the Sacred Harp,
   New England psalmody (the fuging tunes), the Old Way, gospel, and the
   Shaker and Primary songs. Each of the thirty-two has their own voice, their
   own small lateness and their own pitch habit, so a chord is a room of
   people, not four oscillators.
2. **People come forward, one or two at a time, and the minutes name them.**
   A new row (✦) in the minutes gives the person's name and what they do, in
   Deseret: a child who sings the tune a little high and loses the words and
   finds them again; a visitor who doesn't know the day's first hymn and
   joins on a later line; the harmony alto; the old bass (flat, late and
   enormous) on the last lines; the enthusiast singing out; the soloist's
   descant over a last verse (or, now and then, a verse of her own over the
   organ). Never more than two at once. Over 40 test meetings, 156 of 160
   hymns had at least one person come forward (three, typically).
3. **The ward finds its pitch before a hymn.** Before any hymn without the
   organ, the chorister gives the note (humming it, or "fa… sol… la…", or
   sol–do, by habit). Before a Sacred Harp or psalmody tune, the
   **pitching**: the chorister hums the tonic, and the tenors, then the basses, the
   trebles and the altos find their first notes on top of it — a chord of
   thirty-two slightly different voices building for three or four seconds.
   Now and then, before a Tabernacle hymn, the chorister hums the first note
   under the organ's last chord.
4. **The Old Way is lined out by a person.** It used to be the deacon's
   clarinet. Now the precentor — a named man of the ward — sings
   each line, ornamented, and the ward answers it slowly, each their own way.
   (The clarinet still lines out the day's material around the hymns.)
5. **One congregation throughout.** The few things the old choir sang around
   the hymns (a humming prelude, the answers to the deacon, the amens, the
   fuging) are sung by the ward too: eight people for each of the old voices.
6. **The choir is a little louder than before.** The ward sits level with the
   organ in a Tabernacle hymn: about 3.6 dB above v0.35's four voices. If you
   want it back where it was, the choir slider, or `WARD_LEVEL` in
   `kolob-core.js` (0.16; 0.1 is about v0.35's level).

**What is small, or not there yet:**

- The organ under the Tabernacle is still the house's sine organ (the pipe
  organ and the organist's styles are another step of this round).
- No words: vowels, and "fa sol la mi" on the notes.
- The testimony-bearers and the organist are seated (their names and
  habits are drawn) but do not perform yet.
- In a Sacred Harp verse sung on the notes, the soft *s* and *f* of "sol"
  and "fa" are still there at the start of each line: they are the
  syllables (measured below; the same as in the cast lab).
- **The cost.** A hymn sung by the ward takes about twice the audio work of
  v0.35's (details below). You asked to build it without the phone
  constraint; this is the number you will want when you decide how to
  scale back.

### How to hear it

```
php -S 127.0.0.1:8141 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3b
```

Then `http://127.0.0.1:8141/art/kolob/index.php?seed=7` (and the other seeds
below). **The A/B:** add `&choir=house` to hear the same meeting with
v0.35's four voices (`?seed=7&choir=house`).

### The listening note

The times are the minutes' own clock: mm:ss from pressing ▶. They were read
from the harness, and the browser keeps them: seed 7 played from ▶ in muted
Chrome announced its hymn at 2:54 and brought forward the child at 3:06, the
visitor at 3:14, the alto at 3:38, the old bass at 3:53 and the descant and
the enthusiast at 4:40 — the harness's times, to the second. The names are
the page's Deseret; the English is for you.

| what | seed | when | listen for |
|---|---|---|---|
| **A Tabernacle hymn by the ward, people coming forward, and the descant** | **7** | **2:54–5:14** | BOUNTIFUL (№263, the tune the trombones played at dawn). The organ gives out the last line alone (≈2:57). **Verse 1 at 3:06:** a child, Minnie Rigby, sings the tune, a little high, from its first note; a visitor, Phebe Rigby (a beat behind), joins on the second line at **3:14**. **Verse 2 at 3:38:** the harmony alto, Mehitable Whiting, comes forward; the old bass, Levi Farr, on the last two lines from **3:53** (flat, late, huge). Verse 3 at 4:09: the ward alone. **Verse 4 at 4:40:** the soloist Electa Zundel's **descant** above everyone, and the enthusiast Rhoda Merrill singing out. The A-men at 5:11 |
| **The Sacred Harp: the pitching, then "on the notes"** | **12** | **2:49–4:34** | MANTI SPRING (№232), sung in the hollow square. **2:54: the pitching** — the chorister, Eunice Tanner, hums the tonic, and the sections find their first notes on top of it, a chord building for three or four seconds. **Verse 1 at 2:59 on the notes** (fa, sol, la, mi); a visitor, Susannah Allred, joins on the second line at 3:07. Verse 2 at 3:31: the child, Josie Stoddard, on the tune an octave up — she loses the words at once and finds them at 3:39. Verse 3 at 4:03: the enthusiast, Martha Heap; the old bass, Mosiah Gee, on the last lines at 4:18. No organ, no amen |
| **The Old Way, lined out by the precentor** | **18** | **3:07–5:42** | ZARAHEMLA CROSSING (№258), a fast Sunday. **3:11:** the chorister, Abigail Merrill, keys it (sol–do, then the note). **3:14:** the precentor, Ezra Stoddard (a bass who lines out an octave down), sings the first line quickly, ornamented; the ward answers it slowly, everyone on the tune, each their own way. He lines out again at 3:59, 4:29 and 5:05; the old bass, Asa Skousen, comes forward in the reply from **4:29** |
| **A descant, then an Old Way, in one sitting** | **32** | **2:54–7:20** | MERIDIAN (№47): the chorister, Heber Whiting, hums the first note under the organ's last chord (**3:04**); the child, Hattie Rowberry, on the tune from 3:06; a shy newcomer, Rhoda Walser, joins on the third line (3:19); **verse 4 at 4:35: the descant** (Patience Mecham); A-men 5:04. Then ZARAHEMLA (№192) in the Old Way: keyed at 5:41, the precentor Josiah Rowberry (a clear tenor with a light turn) from **5:44**, the child beside him in the reply; she loses the words at 6:38 and finds them at 7:05 |

**Also, if you have the time:**

- **Psalmody** — seed 7, **5:52–8:00**: EVENING CROSSING (№142). The pitching
  at 5:58; the fuging tune sings its fuge twice, as the books repeat it; the
  old bass at 6:17; the section's fuging on the hymn's head at 6:48.
- **Gospel** — seed 40, **11:50–13:33**: DAWN (№330). Keyed at 11:54; the
  quartet in the ward (the lead with the altos, the tenor harmony above it),
  the refrain, the men's echo where the composer wrote it, and the tag at
  13:19.
- **A Shaker song** — seed 27, **5:13–6:04**: OLD MERIDIAN (№354). Keyed at
  5:17, then everyone on one tune, in unison, a little ragged; the old bass
  at 5:51.
- **The A/B** — any of these with `&choir=house`: the same meeting, the same
  hymns, v0.35's four voices.

---

## What shipped

| file | what |
|---|---|
| `_engine.php` | `kolob-voices-vocal.js` among the voices and `kolob-cast.js` among the performers (before the hymnal): the ward is in every page that plays the engine |
| `kolob-voices-choir.js` | **The ward sings the hymn** (`singHymnWard`): the Sunday's ward, the cast's plan for the hymn (who keys it, each verse's practice, who comes forward), written a piece at a time (the intro, each verse, the amen, the tag) and put on **the ward's desk**, one pump on the engine's clock handing the lines to the voices ahead and joining each to the room only as it is about to sound. The organ's giving-out, the lines under the verses and the A-men on the house organ, on the chorister's clock. The ward's fuging (its sections going out one by one). **A section of the ward sings a line** (`wardSectionLine`): every line the house's choir sang around the hymns. Round 3's performer and voices kept whole as the fallback (`?choir=house`, or no cast loaded) |
| `kolob-cast.js` | `segment()`: the hymn's cue sheet in pieces, the same dice and arithmetic as the whole (the cast lab's `score()` is unchanged in what it writes); each piece also writes the notes to report (once a section, and once for each person's own line) and where each line begins. Gospel's quartet seated in the ward; the fuge sung twice; the refrain; the tag; the Shakers' drone; a gift song's vocables. The desk (`enqueue`, `tick`, `clear`, `stats`). The actions in Deseret (`ACTION_DS`). One hummed or unison verse, never two running; unison only in the Tabernacle and gospel; the Shakers' verses told as `unison`; the sister at the reed organ named as a sister |
| `kolob-meeting.js` | the ward seated with the plan (`cast:<n>`), told with the prelude's seating; the hymn's plan asked for before it is announced, so the board can name the chorister and who will come forward; `S.Meeting.ward()` |
| `kolob-core.js` | the ward's two ways into the rooms (the ward, and a person come forward a step nearer), under the choir's slider, in the meeting's doors (a STOP closes them); `WARD_LEVEL`; `castStream`; the dev switch `?choir=house`; `getWard()`, `wardStats()`, `getChoir()`, `setChoir()` |
| `kolob-ui.js` | the minutes' ✦ row for a person coming forward (their name in the clerk's capitals, what they do in Deseret); the precentor's name on the ☞ row when he lines out |
| `kolob-voices-vocal.js` | the roll call (it is in the engine now), and `forget(ctx)`: a stopped meeting's waiting lines are let go |
| `SCORE.md` | **§11**, round 3b adopted |
| `_harness.js` (untracked) | out of `LAB_ONLY`; a new section, **the ward** (below), and the checks taught the ward's practices; a copy is at `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/_harness.r3b-ward.js` |

### The decision: one congregation, or the old choir outside the hymns?

**One congregation.** The ward sings everything; the old four voices remain
only as the fallback and the A/B.

- **How much is sung outside the hymns:** 4.5 % of the choir's note-time
  (40 meetings × 1200 s, 78 meetings: 3,099 of 68,890 note-seconds, almost
  all of it in the hymn sections after the hymn — the answers to the deacon —
  and a little in a humming prelude). So the cost of giving it to the ward
  is small by construction, and the whole-meeting trace below reads it.
- **Its level:** a section of eight singing a held chord against the house
  voice it replaces, at the master, the choir layer alone: the house voice
  −41.0 dBFS, the section −37.1 (+3.9 dB, as the hymns are lifted). A hum is
  gentler in the ward (−35.1 against the house's −33.3): a room of people
  humming, not a pad. (`HOUSE_SECTION_GAIN`, 0.68, is the knob.)
- **What it buys:** the same people sing the hymn and answer the deacon
  after it; the old bass is late in the amen too. Nothing in the meeting
  sounds like the old "synth choir" any more, unless you ask for it.

---

## What it costs (measured, not cut)

**The audio thread, in the real meeting** (muted headless Chrome on this
M3 Pro, the page itself, seed 7; three readings at once: Chrome's own trace
of the render callbacks, summed per second — the cast critic's method —
Chrome's `renderCapacity` for the page's context, and the node counts):

**A Tabernacle hymn** (BOUNTIFUL, 120 s from the jump to the hymn: the
organ's giving-out and four verses; load average 2.2–3.1):

| | the ward (this build) | v0.35's four voices (`&choir=house`) |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **16.4 % · 20.6 % · 24.5 % · 31.3 %** | 8.9 % · 9.4 % · 9.6 % · 10.2 % |
| Chrome's render capacity: median · p90 · max | 16.5 % · 20.9 % · 46.9 % | 9.1 % · 12.3 % · 14.1 % |
| one render callback (5.2 ms of audio each): median · p99 · max | 0.86 ms · 1.95 ms · **4.56 ms** | 0.45 ms · 0.73 ms · 0.96 ms |
| nodes the context holds, peak (created in 120 s) | 1,940 (11,310) | 275 (1,310) |
| the ward's own nodes alive by its ledger: peak · mean; mouths joined to the room: mean · max | 1,266 · 661; 50 · 99 | — |
| the audio clock against the wall | 1.000 | 1.000 |

**A whole meeting** (seed 7, a jubilee, from ▶ for 16 minutes: the dawn's
trombones, the invocation, three hymn sections — a Tabernacle hymn, a
psalmody hymn with its fuge, a Tabernacle hymn — the testimony and the
sacrament; load average 2.3–2.8):

| | the ward | v0.35's four voices |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **9.5 % · 20.2 % · 30.9 % · 34.0 %** | 6.7 % · 7.9 % · 12.3 % · 13.0 % |
| Chrome's render capacity: median · p90 · max | 9.8 % · 21.1 % · 60 % | 6.8 % · 9.5 % · 15.7 % |
| one render callback: median · p99 · max | 0.54 ms · 1.87 ms · **4.89 ms** | 0.36 ms · 0.72 ms · 1.18 ms |
| nodes the context holds, peak (created in 16 min) | 1,910 (37,171) | 425 (7,031) |
| the ward's own nodes alive: peak · mean; mouths joined: mean · max | 1,490 · 271; 20 · 99 | — |

**By section** (Chrome's render capacity, median · p90 · max, one reading a
second):

| section | the ward | v0.35's four voices |
|---|---|---|
| prelude (the trombones at dawn) | 11.1 · 16.3 · 28.6 | 9.8 · 13.1 · 15.7 |
| invocation | 6.4 · 9.8 · 18.9 | 6.1 · 8.7 · 11.2 |
| **the hymn sections** (525 s) | **16.2 · 24.6 · 60** | 7.1 · 9.4 · 12.4 |
| testimony | 6.8 · 9.1 · 10.8 | 6.0 · 8.1 · 10.2 |
| sacrament | 5.3 · 7.8 · 9.3 | 5.3 · 7.7 · 9.6 |

(The meeting's doxology and postlude fall after the sixteenth minute on this
seed and were not traced. The audio clock kept time throughout: its
one-second readings are 1.000 at the median, and the few at 0.90–0.97 are
each followed by one at 1.03–1.12 — the poll's own jitter, not the audio
falling behind; the four-voice run never dipped.)

**Reading it.**
- **In a hymn the ward about doubles the audio thread's work** (+7.5 points
  of this Mac's thread at the median, +15 in the worst five seconds). Over a
  whole meeting it is +3 points at the median, because the hymns are about
  half of it.
- **Outside the hymns it costs almost nothing** (+0.3 to +1.3 points in the
  prelude, the invocation and the testimony; the same in the sacrament):
  that is the measurement behind keeping one congregation throughout.
- **The peaks are where the most is going on at once.** Chrome's render
  capacity read over 40 % in 9 of the meeting's 957 seconds, all between
  7:07 and 7:58 — the psalmody hymn's second verse (the fuge sung twice, its
  parts entering one after another, the alto and the child forward) — and
  over 30 % in 19 (those, three seconds of the first hymn's second verse, the old bass forward, at
  3:58–4:00, and 8:08). The trace's own per-second sum never passed 34 %.
- **The worst single callback** took 4.56 ms (the hymn) and 4.89 ms (the
  whole meeting) of its 5.2 ms: on this Mac, in a moment where many lines
  join at once. Nothing was dropped (the clock kept time), but it is the
  figure that says where a slower machine would first crackle.
- **A phone** (not tested; the owner deferred it): a mid-range phone core is
  roughly 2.5–4× slower than this one, which puts a ward hymn at roughly
  40–65 % of a phone's audio thread at the median, 60–100 % in its worst five
  seconds and 80–125 % in its worst second: at the edge, or over it. The
  levers, when you decide (r3-cast §3's list, none taken): an
  AudioWorklet ward (the real answer: thirty-two voices in one node); two
  formants for the inner parts; fewer of the ward on a phone; the desks.
- **The main thread** stayed quiet: in 150 s of each of four meetings'
  hymns (seeds 12, 18, 27, 40), one long task in each run (64–93 ms), no
  clock cue fired late, and the desk handed every line ahead of its time
  (0 late; at most 12 lines in one pump).

## The hiss stays gone (measured in the meeting)

The owner's "brushing s… like air released out of a tire" was the ward's
breath and consonants in the hymn lab (r3-cast fixed it). The same voices now
sing in the meeting, through its rooms, so it was measured again there:
the meeting played muted, the choir layer alone, recorded at the master
(after the rooms and the glue), **twice**: once as heard, and once with every
singer's glottal wave replaced by silence — which leaves exactly the breath,
the inhale and the consonants (r3-cast's "folds silenced", in the meeting
itself). The same seed plays the same breaths both times. Windows as r3-cast
measured them: a **join** is 60 ms before to 90 ms after each written onset;
a **line start** the same window at a line's first onset; the **gap** the
silence between a line's last release and the next line; **held notes**
the middle of every melody note ≥ 0.45 s. The band is 3–12 kHz; "against the
ward" is the breath and consonants alone minus the ward as heard, per
window, the median; flatness is the band's spectral flatness as heard (about
0 a chord, 0.3–0.5 a hiss).

| hymn (the meeting's) | where | breath and consonants against the ward | flatness as heard | r3-cast's bench (ward alone, dry) |
|---|---|---|---|---|
| seed 7, BOUNTIFUL (Tabernacle), verses 1–2 | joins (71) | **−17.8 dB** | 0.053 | −19.9 dB · 0.048 (BETHEL) |
| | line starts (7) | −19.8 dB | 0.030 | |
| | the gap between lines (6, median 0.18 s) | **−16.4 dB** | 0.048 | −18.2 dB (BETHEL's gap) |
| | inside held notes (101) | −17.1 dB | 0.035 | |
| seed 12, MANTI SPRING (Sacred Harp), verse 1 on the notes, verse 2 | joins (69) | **−17.9 dB** | 0.059 | −18.2 dB · 0.065 (WINTER QUARTERS) |
| | line starts (7) | −7.5 dB | 0.142 | −9.2 dB · 0.144 (WINTER QUARTERS' line starts; r3-cast's first pass, whose consonants are today's) |
| | the gap between lines (6, median 0.25 s) | **−16.2 dB** | 0.046 | −18.8 dB (its gap) |
| | inside held notes (88) | −19.6 dB | 0.030 | |

Clicks: none in the ward as heard, in either hymn. The tap missed no
samples (the recording carries its own clock, so every window is where it
was sung).

**Reading it.**
- **Between the notes and between the lines, the breath sits 16–18 dB under
  the ward**, and what is heard there is tone, not noise (flatness 0.05: the
  voices' own tails and the room). That is within about 2 dB of what r3-cast
  measured in its bench, where the owner's hiss was found gone; the room and
  the glue compressor in the meeting account for the difference.
- **At a Sacred Harp line's start on the notes** the *f* and *s* of "fa" and
  "sol" are 7.5 dB under the ward, flatness 0.14: the same as the cast lab's
  own reading (9 dB, 0.14). They are the syllables. If you still hear them as
  a brushing, `FRIC_PEAK.s` in `kolob-voices-vocal.js` is the knob.
- v0.35's meeting had no breath at all (its four voices were noise-free), so
  this is new sound in the meeting — the ward's own, and quiet.

---

## How it was checked (all silent)

**The harness** (`_harness.js`, untracked; 1200 s a seed):

- **40 seeds: 38 pass.** Seeds 17 and 37 fail on the trombone choir's compass
  (5 notes and 1 note outside a trombone's range), which HEAD fails the same
  way on those seeds (`3fc476ae`, run from an export): the GUEST crew's, not
  this step's.
- **REPRO passes** (the same seed twice, then with jittered timers, then with
  the sound-level streams re-salted: the score identical, byte for byte) on
  seeds 7 (1200 s), 27 (1200 s: a Shaker song and an Old Way) and 1847 (1500 s,
  ives razz cumulative).
- **TRANSPORT passes** on seeds 20 and 1847 (pause holds; STOP then PLAY lets
  none of the stopped meeting's lines back into the hall: stopped at 330 s,
  the A-men of seed 20's first hymn, 0 of 79 stale sources).
- **New section, "the ward"** (every run): the choir is the ward; the board
  names the chorister in Deseret; every unaccompanied hymn keyed (the Old
  Way, gospel, the Shakers) and every Sacred Harp and psalmody tune pitched,
  its pitching finding all four sections' first notes; the precentor lines
  out every Old Way line and the lining-out names him; every cast event in
  Deseret; **never more than two forward at once**; everyone the board
  names comes forward; a descant verse has its descant; the desk handed every
  line before its time. The composed-hymn checks now accept the ward's
  practices (hummed, unison, descant), its tag and the fuge sung again, and a
  person's own line (the keying, the descant, the drone) is checked for its
  section and its pitch.
- **Over the 40 meetings (78 meetings, 160 hymns):** Tabernacle 68, Sacred
  Harp 45, Old Way 15, gospel 14, psalmody 11, Shaker 7. Every Sacred Harp
  and psalmody hymn pitched (56), every Old Way, gospel and Shaker hymn keyed
  (36), 7 Tabernacle hymns keyed under the organ. Verses: Tabernacle sung
  146, descant 18, hummed 8, unison 1; Sacred Harp on the notes 53, sung 67;
  lined 15; Shaker unison 13. People forward: 195 "comes forward", 112 a
  child on the tune (66 lost the words and found them), 56 the enthusiast, 50
  a newcomer joining, 17 descants, 2 treble verses; 156 of 160 hymns had
  someone forward (median 3 people a hymn).
- **Every dialect through the meeting's road, in Node** (24 seeds a dialect,
  `Cast.planHymn` → `Cast.segment` piece by piece): 32 of the ward on every
  line (33 with the child, 31 before the newcomer joins, 1 in the treble
  verse), never more than two forward, the pitching before every Sacred Harp
  and psalmody tune, the keying before every Old Way, gospel and Shaker
  hymn, 48 of 48 Old Way lines lined out by the precentor, the fuge sung
  again in 44 psalmody verses, gospel's refrain and tag in 24 of 24, the
  Shakers' drone in 18 verses.

**The browser** (muted headless Chrome, port 9461, PHP on :8141):

- `index.php` and all twelve labs at 860 and 390 px: **0 console errors**, no
  horizontal scroll.
- Four meetings' hymns in real time (seeds 12 Sacred Harp, 18 Old Way, 27
  Tabernacle then the Shakers, 40 Tabernacle; 150 s from the jump each):
  **0 console errors**, the audio clock at 1.000 of the wall, 0 of
  1,389–1,660 clock cues late, 133–573 of the ward's lines handed, 0 late;
  the minutes print the ✦ rows.
- The traces above (seed 7: the hymn and the first sixteen minutes, ward and
  house): 0 console errors.
- Seed 7 from ▶ for 5½ minutes: every person came forward at the harness's
  time (the listening note), 0 console errors.
- The ward's level, calibrated at the master (above).

**Pure and reproducible:** the ward is seated from `cast:<n>` (every member
from `member:<id>`), the hymn's plan from its performance fork, every
sound-level die from `synth:vocal`; nothing reads the audio clock to decide
when (the pump reads the music's now). REPRO above is the proof.

---

## Requests

1. **For the integrator:**
   - **VERSION** at publish: the line above, or yours.
   - **The harness** (untracked): copy the one in the scratchpad (path
     above) into kolob-2.
   - **kolob-score.js, the septimal slack** (r3-hymn2's request 1, still
     open): gospel's ringing sevenths are 7-limit and the proofreader holds
     every note to its 5-limit spelling, so a gospel hymn "does not
     proofread" — 10 of the 40 seeds here (1, 11, 17, 23, 26, 30, 34, 35, 37,
     40), on HEAD as on this branch. This build's harness counts
     them apart and prints them (`KNOWN, not this step's`) instead of failing,
     until the contract learns the slack.
2. **For the CAST crew (`cast-lab.*`):** the lab loads `_engine.php`, which
   now carries the ward — so `kolob-voices-vocal.js` and `kolob-cast.js` load
   twice there (harmless: 0 errors), and **the lab's phone and headroom
   tests now run the meeting with its own ward under the lab's ward** (two
   wards). For the old reading, call `KolobAudio.setChoir("house")` before
   the meeting plays; or drop the two script tags.
3. **For the GUEST crew:** seeds 17 and 37 (1200 s) put the trombones outside
   their compass (91.7 and 97.8 Hz on an alto trombone; 484.1 Hz on a tenor),
   on HEAD as here.
4. **For the ENGRAVE crew:** the ward's notes carry `member`, `role`, and
   `sings: "key" | "descant" | "drone"` for a person's own line, `pitching`,
   `liningOut`, `tag`, `repeat` (SCORE §11.4). The precentor's line is now
   the ward's (`liningOut`), not the clarinet's.
5. **For the ORGANIST crew / the next step:** the ward's organ lines arrive on
   the sheet (`OrganCue`: the giving-out, each line under the verse, the
   A-men, with `part`, `beat`, `deg`, `monzo`), played today by the house
   organ in `wardOrgan()` (`kolob-voices-choir.js`). The pipe organ and the
   organist's fills plug in there.
6. **For the tools crew:** `tools/lib/dump.js` and `tally.js` could read the
   `cast` events (who came forward, by role).

## Known issues

- **Tuned by measurement, not by ear.** The knobs for the owner's ear:
  `WARD_LEVEL` (the ward in the mix), `HOUSE_SECTION_GAIN` (the ward's lines
  around the hymns), and the cast lab's (`INHALE`, `FRIC_PEAK`, `INTRINSIC`).
- **The cost** (above): about twice v0.35's audio work in a hymn; a phone is
  not tested.
- **The lines the ward sings around the hymns are handed close to their
  time** (as little as 0.15 s before they sound, by the music's clock: 24 of
  444 lines in seed 12, 16 of 573 in seed 40): the house decides them the
  moment it sings them. The engine's clock fires its cues ahead of the audio
  clock, so they still arrive before they sound (0 late), but a singer's
  breath before such a line may be dropped.
- **The testimony-bearers and the organist** are seated, not performing.
- **Practices not yet:** the round, the partner hymn and the wandering
  refrain (placed by FORM); echoes are the composer's where written, not a
  practice of the performer's.
- **The meeting's timings moved** only where the ward's timing differs from
  round 3's (the chorister's tempo and holds, the keying and the pitching):
  a hymn section lasts as long as its hymn, as before.

## Where the measurements live

The scratchpad's `r3b/` (`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3b/`):
`trace.js` (the audio thread: the trace, render capacity, nodes), `hiss.js` +
`hissan.js` (the join noise, as heard and with the folds silenced),
`calib-section.js` and `level.js` (the levels), `coverage.js` (every dialect
through the meeting's road), `scan.js` (the listening times from a dump),
`outside.js` (what the choir sings outside the hymns), `labs.js`,
`smoke2.js`; the results beside them (`tr2-*`, `tr3-*`, `hiss-*`,
`levels.out`, `batch/`, `final/`).
