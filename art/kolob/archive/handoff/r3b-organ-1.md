> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r3b-organ-1: the organist in the meeting

*Round 3b, step 2. Branch `kolob-r3b`. 2026-09-28.*

Each Sunday now seats an organist, and that person plays the organ all
meeting: a plain organist, a Victorian or an improviser. It is the organist
crew's `KOLOB.Organist` on the registrable pipe organ, now in the real
meeting. Per the owner's ruling it was built as though there were no phone
to carry it. The cost was measured and is reported below as it is.

Nothing was pushed or published, and VERSION is not bumped. A suggested
branch-local line: `v0.35-organ.1 — the organist takes the bench: a plain
organist, a Victorian or an improviser plays the hymns on the pipe organ
(the giving-out, fills between the lines, interludes, the walk into a new
key, the amen), a chorale prelude on the day's first hymn some Sundays, and
one organ throughout`. Every check was silent: the Node harness, and headless
Chrome launched with `--headless=new --mute-audio`.

Commits on `kolob-r3b` (after step 1's `415ea26f`):

| commit | what |
|---|---|
| `572527f8` | the organist takes the bench: the organist seated, the pipe organ in the meeting, the hymns, the chorale prelude, one organ throughout, R1 |
| `611568d6` | SCORE §11.6: the organist adopted (R2–R4) |
| `34e010dc` | the organ under the ward lifted to where the meeting's organ sat (`UNDER_WARD_DB`) |
| `d6939311` | every piece of the organist's hymn at its style's own level (`HYMN_LIFT`), found on the restart |
| `ec1b753c` | the house's chords on the pipes set to the old organ's level in the meeting itself (`HOUSE_TRIM` 0); the amen's swell box |
| `4ee76677` | every gain a key makes is silent at birth: the one click the pipe organ made in a whole meeting (seed 32, a joint's amen), found scanning the whole meeting |
| this note | handoff r3b-organ-1 |

This step was restarted twice. The first crew's work (the first three
commits) was checked and built on; the first restart found and mended two
level faults (`d6939311`, `ec1b753c`) and measured again whatever they
could move: the hymns' levels, the house's chords in the meeting, the 40
seeds, REPRO, the lab's plans, the browser. The audio thread was traced on
that restart too, before the house's chords came down 2.2 dB (which moves no
note, and only a few of the quietest chiffs under their floor). Scanning a
whole meeting for clicks, it then found one transient from the pipe organ,
traced it and wrote the mend. The machine was restarted under it (c11) as
the mend's checks finished. The second restart committed the mend
(`4ee76677`), replayed its proof, scanned three more whole meetings on the
final build, and finished this note. The chorale preludes' levels and the
offline renders are the first crew's (nothing since has touched them).

---

## For the owner, in plain words

**What is new to hear, by size (honestly):**

1. **The hymns have an organist. (The big one.)** Until now the organ under a
   hymn doubled the four parts on the house's sine organ, the same way every
   Sunday. Now the Sunday's organist plays them on the pipe organ, in one of
   three manners:
   - **The plain organist** plays what is printed. Soft flutes, every
     repeated note struck again, a breath between verses, nothing between
     the lines.
   - **The Victorian** gives out the tune on the trumpet or the principal. He
     takes a middle verse down to the trembling vox humana and often puts the
     last verse of three on the full organ. The swell box breathes with each
     line, he plays the close again softly between verses, and now and then
     one voice holds a note over from one line into the next.
   - **The improviser** gives out the tune on a trumpet over flutes, or on
     the principal and the 4′. He
     climbs the first line's opening over a held bass between verses, and
     plays a quick figure between two lines now and then: a quote of the
     next line, a turn, a falling sequence. Once in a meeting, at most, a
     fill strays into a strange key, and the ward's next entry pulls the
     organ back.

   The organ plays the ward's hymn **note for note, on the chorister's own
   tempo** (her broadening at the close, her long fermatas). When the
   organist plays a fill between two lines, the ward waits for it.
2. **A hymn in a new key is reached by the organist.** Before a hymn keyed
   away from home, the organist walks there from the day's own key through a
   chord the two keys share, holding the common tone, then the new key's
   dominant seventh, then home in it. The Victorian leans a 4–3 on the
   dominant, and the improviser sometimes detours through a chromatic
   mediant.
3. **Some mornings are the organist's chorale prelude.** On about one Sunday
   in five (15 of 77 mornings over 40 seeds) the organist's first touch is
   the day's first hymn, 35–45 seconds of it:
   - the plain organist plays it once or twice through on soft flutes;
   - the Victorian plays it as a swell voluntary, the tune on the vox
     humana, or a trumpet tune, with a suspension at each close;
   - the improviser puts the tune deep in the pedals under running flutes,
     sometimes with the flutes in another key the whole time (Ives's *Adeste
     Fideles*).

   The drone and the valley wake around it. The strings, the harmonium and
   the deacon's clarinet wait for it to finish. It is never the fixed
   opening: it is the organist's own die, and it is refused when the
   trombones or the steeples have the dawn, when the tune is withheld, in
   the brush arbor, on a humming morning, and when the first hymn is a
   single line (the Old Way, a Shaker song).
4. **One organ throughout.** Everything else the organ played is now the
   same pipe organ too: the prelude's and the postlude's chords, the joints'
   amens, the rare soft chord in the testimony, a guest's amen. It plays the
   same chords as before, with the swell box opening as each chord speaks
   and closing before the hands lift. The old organ faded in like a pad; a
   pipe cannot. The house registration follows the organ layer's parameters
   (stops, tremulant, pedal), as the old organ's did.
5. **The minutes name the organist.** A ✦ row gives the organist's name and
   what they do, in Deseret: the chorale prelude, the walk to a new key, a
   fill between the lines, the strange key.

**What is small, or not there yet:**

- **Fills are rare** (46 in 68 accompanied hymns over 40 seeds; the plain
  organist plays none). **The strange fill is rarer still**: it came once in
  77 meetings, or once in the improviser's 17. It needs the improviser
  (about 1 Sunday in 4), a hymn late enough for him to have wandered, a fill,
  and a 0.3 die. Seed 32 has one. The organist lab's sweep found it in about
  three of the improviser's meetings in five, but that sweep gave him three
  organ hymns of three verses each. A real meeting gives him one to three,
  with as many verses as the section has room for.
- **The chorale prelude on a tune the ward sings unaccompanied.** On a
  Sacred Harp, fuging or gospel first hymn, the organist may still play the
  tune as the prelude; the class then sings it raw. That is my call, taken
  so the prelude is heard often enough. It is one line in
  `kolob-meeting.js` to refuse it.
- **Gospel stays unaccompanied**, as its dialect profile and SCORE §11.3
  say (the chorister keys it). Flip `organ: true` for gospel in
  `kolob-dialects.js` and the organist plays the gospel hymns, refrains and
  all: tried in a scratch copy on seed 1's four gospel hymns (Requests, 4).
- **The postlude** is still the house's chords on the pipes. It is not an
  organist's voluntary on a hymn.

**The level:** the organist sits within ±2 LU of the organ you have been
hearing under the hymns, a shade under it (0.2 to 1.1 LU on the loudest
3 s), with the organ layer where you set it (0.40). The knob is
`UNDER_WARD_DB` if it is too much or too little under the ward. The organ's
chords between the hymns (the voluntaries, the amens at the joints) are
within ±2 LU of the old organ's as well, measured in the meeting. They had
come out nearly 3 LU over it and were brought down; a pipe chord holds its
level where the old organ's swelled and faded, so they sound steadier.

**Clicks:** the pipe organ made none in three whole meetings scanned on
the final build. A fourth whole meeting turned up one click, a single
spike as a joint's amen spoke out of silence, and it is mended. The old
organ clicked 5–19 times under each hymn measured.

**What it costs (measured, not cut):** under a hymn the pipe organist is a
little more work for the audio thread than the old organ (about 3 points of
it at the median, some 12 % more); over twelve minutes of a meeting, no more
than the old organ. The 32-voice ward is still what costs.

### How to hear it

```
php -S 127.0.0.1:8141 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3b
```

Then `http://127.0.0.1:8141/art/kolob/index.php?seed=25` (and the seeds
below). **The A/B:** add `&organ=house` to hear the same meeting on the old
sine organ with no organist playing (`?seed=25&organ=house`). The organist
is still seated and named there, but plays nothing: no chorale prelude, no
fills, and the old giving-out.

### The listening note

The times are the minutes' own clock, mm:ss from pressing ▶. They were read
from the harness (`KOLOB_NAMES=1`, the dump) and checked in the browser
(below). The names are the page's Deseret; the English is for you.

| what | seed | when | listen for |
|---|---|---|---|
| **The Victorian: a chorale prelude, the walk to a new key, the hymn's arc** | **25** | **0:05–0:48, then 2:37–8:43** | Susannah Cluff. **0:05, the chorale prelude**: FAR WEST, the day's first hymn, as a swell voluntary on the principal, the box opening and closing with each line, a suspension at most of the closes. Nothing else of the house enters until she has finished; then the voluntary's chords go on. **2:41, the walk to the new key**: the hymn is keyed in the dominant, and she leaves the day's key by a chord the two keys share (its common tone held), the new V7, then I. **2:47** she gives out the tune on the principal. **Verse 1 at 2:54** on the principal; **verse 2 at 3:29** on the trembling vox humana over the flutes, quieter; **4:27** a link: an inner voice walks into the next line while the ward waits for it; **verse 4 at 4:57** the soloist's descant over the **full organ**. Between the verses she plays the close again, softly. Then ORCHARD (5:43): given out on the trumpet, a link at 6:04, verse 2 *hummed* with the organ silent (6:38), verse 3 on the full organ (7:43) |
| **The improviser: the tune in the pedals, in two keys; a quote between the lines** | **19** | **0:02–0:48, then 2:49–8:40** | Zebedee Leavitt. **0:02, the chorale prelude**: flutes running over the first hymn's tune deep in the pedals, and the flutes a major third up the whole time, in another key (Ives's *Adeste Fideles*). KIRTLAND at 2:49: **2:53** given out on the trumpet over flutes; **3:07** he quotes the next line, quick and high, between two lines; verse 2 hummed (3:30); verse 3 on a 16′ and a 4′ with nothing between (4:18); verse 4, the descant, on the principal and the mixture (4:50). EVENING CROSSING at 5:54 is keyed in the subdominant: **5:57** his walk into it |
| **The plain organist** | **23** | **0:06–0:44, then 3:02–5:31** | Wilford Lamoreaux. **0:06, the chorale prelude**: LIBERTY once through on the flutes, 8′ and 4′, four-square, as printed. **3:08** the walk into the subdominant on soft flutes; **3:12** the last line given out on the flutes; the verses on soft flutes, every repeated note struck again, a breath between verses and nothing between the lines; verse 2 hummed (3:50); verse 3 the descant (4:40). Then BEEHIVE (5:31), a Sacred Harp tune: no organ at all |
| **The strange fill** | **32** | **12:09–14:20** (and 2:54–5:38) | Gideon Kartchner, the improviser, in the doxology FAR WEST: given out at 12:15; **12:30** a chord and a figure **a minor third up**, in a key the hymn never visits, until the ward's next line pulls the organ home; an arabesque at 12:47. Earlier, MERIDIAN (2:54): the tune given out on the trumpet (2:58), a falling sequence between two lines (3:28), a quote (4:04), the last verse on the principal and the mixture (4:52). It is the only strange fill in the 40 seeds' 77 meetings |
| **The Victorian in step 1's hymn** | **7** | **2:54–5:52** | Hyrum Bybee, in BOUNTIFUL (step 1's listening hymn, now with the organist: its verses begin a few seconds later than in r3b-ward-1). **2:58** given out on the principal; verse 1 at 3:05; **3:22** an echo of the line's end, high on the echo flute; verse 2 at 3:42 on the vox humana over the flutes; **5:20** a held note over into the next line (a suspension that falls late). In EMIGRATION (8:35) the last verse is on the full organ (10:48), with a link at 11:08 |

**Also, if you have the time:**

- **A chorale prelude on a tune the ward will sing unaccompanied** —
  seed 3, **0:05–0:48**: Eunice Rowberry, the plain organist, plays EVENING
  twice through on soft flutes (the second time softer); the class sings it
  in the hollow square at 2:32, raw.
- **A trumpet tune** — seed 34, **0:05–0:45**: Electa Allred, the
  Victorian, sets PALMYRA ROAD (a gospel song; its first two lines and its
  last two) on the trumpet over flutes.
  The quartet in the ward then sings it unaccompanied at 2:40.
- **The pedal tune in a later meeting** — seed 13, **17:41**: Rachel
  Bushman's chorale prelude opens the second meeting (the tune in the
  pedals). Earlier, at 5:22, the plain organist Alma Nuttall walks into
  JUBILEE's key.
- **The A/B** — any of these with `&organ=house`: the same meeting on the old
  organ, with no organist playing.

---

## What shipped

| file | what |
|---|---|
| `_engine.php` | `kolob-organist.js` after the composer and `kolob-voices-pipeorgan.js` among the voices: the organist and the pipe organ are in every page that plays the engine |
| `kolob-organist.js` | **`hymnHands`**: the hymn written in pieces (the giving-out, each verse, each interlude, the amen, a modulation), each from the moment it is handed, with the same dice as the whole. `accompany` is now those pieces end to end, and the lab hears the same hymn key for key (checked below). **The chorister's clock** (`lineEvents`, `lineDur`, `breathOf`, `handsOn` take `ck = {rit, hold}`: the cast's arithmetic, operation for operation). A verse piece says how long the ward waits for each fill (`waits`). `preludeDraw` also refuses a unison first hymn, a guest's morning and a humming morning. A tenor tune (Sacred Harp, psalmody) gets its solo stop, and the Victorian's ornaments leave it alone. Reports carry the pedal. **Each piece carries the style's hymn level** (`HYMN_LIFT`: the Victorian −0.5 dB, the improviser −0.4), as the whole hymn does in the lab; the meeting's pieces had been played without it (found and mended on the restart, below) |
| `kolob-voices-organ.js` | **One organ throughout.** The meeting's pipe organ is kept as one *case* for each pair of the organ's hands: a guest's entrance hands it to a new case, and STOP shuts them all. **The organist's desk** lays each plan a few seconds ahead on a lane of its own and tells each note in the Score's terms (and the pedal's 16′ as a note). The organist's doings are told as `cast` events at their moment. **The chorale prelude** is played at the organ's first touch of a morning seated for it. **The house's chords on the pipes** (`pipeChord`): the same chords, an octave down, the bass on the pedal, the house registration from the organ layer's parameters, the swell box as the envelope, at the old organ's level, measured in the meeting (`HOUSE_TRIM`); in an amen the box opens again over each chord. **The organ under the ward** is lifted to where the meeting's organ sat (`UNDER_WARD_DB`, 5 dB; *The level*, below). **The old organ** (`houseOrganChord`, `organPartLine`) is kept whole as the A/B and fallback, with the organist crew's R1 (the tremulant after the envelope, its depth kept) |
| `kolob-voices-pipeorgan.js` | `setSwell(…, cancel)` (a house chord shapes the box chord by chord); the roll call says it is the engine's organ |
| `kolob-voices-choir.js` | **The organist at the hymn** (`singHymnWard`): the organist's walk into a keyed hymn's key, their giving-out, each verse (the ward's sheet then carries no organ, and waits for the fills), the interlude before each later verse (not after the fuging), the amen; `verse-start`'s `organ.registration` is the organist's. The walk into a new key plays at the hymn's own level. Whether a hymn has the organ now follows the dialect's own profile (today the Tabernacle alone, as before). The house organ remains for `?organ=house` and for a fuge sung twice |
| `kolob-cast.js` | `segment(…, {organist: {giveOut, waits}})` (no organ lines on the sheet; the intro waits the organist's giving-out; a line waits for a fill). `seat(…, {organist: style})`: the ward's organist is an archetype of the style seated, so the name in the minutes and the style you hear are one person. The organist's actions in Deseret (`ACTION_DS`, `actionKey`) |
| `kolob-meeting.js` | **The organist seated** with the ward (`cast:<n>` → `organist`, the Sunday's tilts), named as the ward's organist, on `prelude-seating.organist`. **The chorale prelude seating** (`choraleSeating`, the organist's own die, over the morning drawn). The house listens while it sounds, and a guest, a stillness and the joint wait for it. The prelude lasts long enough for it. `S.Meeting.organist()`, `chorale()`, `choraleBegins()` |
| `kolob-core.js` | the dev switch `?organ=house`; STOP shuts the organ's cases; `getOrganist()`, `organStats()`, `getOrgan()`, `setOrgan()` |
| `kolob-ui.js` | the organist's ✦ rows (the chorale prelude, the walk to a new key, the fills, the strange key, a line left to the ward), in Deseret |
| `kolob-score.js` | the typed event `chorale-prelude` (`{hymnId, t0, until, style, manner}`) |
| `SCORE.md` | **§11.6**, the organist adopted (R2–R4 of `r3-organist-1`) |
| `_harness.js` (untracked) | a new section, **the organist** (a hymn is accompanied where its dialect's profile says so, as the engine asks it); the pedal at its floor; the organist's note fields; the chorale prelude's notes are the prelude's, not the hymn's; `KOLOB_NAMES=1`. A copy is at `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/_harness.r3b-organ.js` |

### The decision: one organ throughout

**One organ.** The pipe organ plays everything the organ does. The old one
stays only as the A/B (`?organ=house`) and as the fallback for a page
without the pipe organ.

- **Why:** one meetinghouse has one organ, and now one person on its bench.
  The same pipes, registration and swell box sound in the prelude, under
  the hymns and at the joints. It is the organ's version of step 1's "one
  congregation".
- **The old organ's own trouble:** measured in the meeting, organ alone, the
  instruments lab's click detector finds 13 and 19 clicks under the old
  organ's hymn (seeds 7 and 25), and 0 under the pipe organist's in the same
  hymns. I did not trace the old organ's clicks to their cause; they are gone
  with it.
- **What changes in the sound:** a pipe speaks when its key goes down, so
  the prelude's and the joints' chords now *speak* rather than fade in. The
  swell box does the fading: it is shut as the keys go down, opens over the
  old organ's attack, and shuts before the release. How far it moves is the
  organist's habit: the plain organist's box barely moves, the Victorian's
  swings wide.
- **The level** of the house's chords on the pipes is set to the old organ's
  own chords, measured below.

---

## The level

**The owner's setting** is the organ layer at 0.40 (turned down 2.3 dB in
v0.34 because the organ was "pretty loud"). This step keeps the layer where
it is and holds the pipe organ to the organ the meeting had, within ±2 LU,
in each of the organ's jobs.

**How it was measured:** the real meeting in muted Chrome, the organ layer
alone (every other layer's slider at 0), through the rooms and the glue.
Loudness is K-weighted in the page on a tap at the master, in 100 ms blocks
on the audio clock. **S3** is the loudest 3 s and **I** the integrated
loudness, in LUFS. "Old organ" is `?organ=house` on the same seed: the
meeting as it was before this step. The click detector is the instruments
lab's (1 ms blocks above 4 kHz, 12× over their 30 ms neighbours).

**1. Under the hymns.** Since v0.35 the meeting's organ under a hymn has been
the old organ's part lines: each voice doubled, the giving-out at 1.7×.
That is some 5 dB over the `organChord` level the organist lab balanced
against, and step 1 set the ward level with it. Measured first at the lab's
level, the organist's hymn sat **5.3–5.7 LU under the old organ** (seeds 7
and 25, the Victorian: the giving-out 5.6–5.8, verse 1 4.9–5.3). So
everything the organist plays in a hymn is lifted by **`UNDER_WARD_DB`,
5 dB**.

*Found on the restart, and mended (commit `d6939311`):* the meeting played
the hymn's pieces without the style's own hymn level (`HYMN_LIFT`), which
the lab's whole hymn carries: the Victorian −0.5 dB, the improviser −0.4, so
that the three organists sit at one level. The Victorian and the improviser
were half a decibel louder in the meeting than the lab had centred them.
Each piece now carries it, and the table below is measured on that build.
Measured from the jump to the first hymn, 115 s (the walk into its key or
the giving-out, and about three verses); the old organ's column is the same
hymns on `?organ=house`:

| seed, organist, hymn | the organist (this build): the hymn S3 · I · the giving-out S3 | the old organ (`?organ=house`): S3 · I · the giving-out S3 | Δ S3 · Δ I | clicks (organist · old organ) |
|---|---|---|---|---|
| 7, Victorian (BOUNTIFUL) | −29.9 · −33.5 · −29.9 | −28.8 · −33.1 · −28.9 | −1.1 · −0.5 | 0 · 13 |
| 25, Victorian (FAR WEST, walked into in the dominant) | −30.1 · −33.7 · −30.1 | −29.0 · −33.2 · −29.0 | −1.1 · −0.5 | 0 · 19 |
| 23, plain (LIBERTY, walked into in the subdominant) | −29.8 · −30.9 · −29.8 | −28.9 · −32.4 · −29.1 | −0.9 · +1.5 | 0 · 5 |
| 19, improviser (KIRTLAND) | −29.1 · −32.8 · −29.4 | −28.9 · −32.9 · −28.9 | −0.2 · +0.1 | 0 · 10 |

Every organist's hymn is within ±2 LU of the organ the owner has heard under
the hymns, on the loudest 3 s, on the integrated loudness, and on the
giving-out alone; the Victorian and the plain organist sit about a decibel
under it. The plain organist's integrated loudness reads 1.5 LU over: he
plays the verses at the level he gives out the tune, on the same soft
flutes (integrated, his verses −30.7 to −30.9 LUFS and his giving-out
−31.2), where the old organ's verses sat 2–3 dB under its giving-out
(−32.4 to −33.4 against −30.2). The whole mix (every layer, seed 7's hymn,
the ward singing): −20.5 · −23.1 on this build against −20.9 · −23.3 on
the old organ (S3 · I, +0.4 · +0.2 LU), with 0 clicks in the whole mix
against the old organ's 7.

**2. The chorale prelude** replaces the old organ's first chords of the
morning (the first 75 s from ▶). The morning it replaces differs by seed,
so the fairer reference is the old organ's own voluntary chords.

| seed, organist | the chorale prelude, S3 · I | the old organ, the same 75 s (its morning) | against the old organ's voluntary (seed 25's, S3 −32.8) |
|---|---|---|---|
| 25, Victorian (swell voluntary) | −33.3 · −35.5 | −32.8 · −36.8 (a voluntary) | −0.5 LU |
| 19, improviser (the tune in the pedals, bitonal) | −33.6 · −35.0 | −36.1 · −38.3 (a valley morning: the organ late and sparse) | −0.8 LU |
| 23, plain (flutes 8′ and 4′) | −34.2 · −35.1 | −35.2 · −37.9 (a strings morning) | −1.4 LU |

**3. The house's chords on the pipes.** These are the prelude's and the
postlude's voluntaries, the joints' amens and the testimony's soft chord.
They were first set offline: the same chords rendered in the page on the old
organ (`organChord`, copied, R1 applied) and on the pipes, through the 0.40
layer, a measured room standing in for the meeting's, and the master chain.
That put `HOUSE_TRIM` at +2.2 dB:

| offline, at `HOUSE_TRIM` +2.2 | the old organ, S3 · I | the pipes, S3 · I | Δ S3 |
|---|---|---|---|
| a voluntary: four chords, 8 s each, at the prelude's middle gain (0.513) | −29.3 · −32.0 | −30.0 to −30.3 · −31.5 to −32.1 (the box moving a little → a lot) | −0.7 to −1.0 LU |
| a joint's amen: IV–I at 0.6, overlapping, the last held | −30.6 · −31.7 | −29.8 · −30.6 | +0.8 LU |
| the testimony's soft open chord (0.35, 13 s) | −33.5 · −35.0 | −34.5 · −35.1 | −1.0 LU |

**In the meeting it came out louder, and was set again there** (found on the
restart; commit `ec1b753c`). Measured in the real meeting, the organ layer
alone, against the old organ on the same Sunday, the pipes' voluntary and
its amen sat **2.8–2.9 LU over the old organ's** at +2.2. The meeting's own
rooms and glue are not the stand-in's. So `HOUSE_TRIM` is now **0**, and
these are the readings on the final build:

| in the meeting (the organ layer alone) | the pipes, S3 · I | the old organ, S3 · I | Δ S3 · Δ I | clicks (pipes · old) |
|---|---|---|---|---|
| seed 8, the first 95 s: a voluntary morning (the improviser), its closing amen, the invocation | −31.4 · −36.4 | −31.9 · −36.0 | +0.5 · −0.4 | 0 · 0 |
| seed 7, the postlude's first 70 s: its first chord (at 0:58) and the joint's amen | −33.7 · −35.5 | −34.3 · −36.3 | +0.7 · +0.8 | 0 · 0 |
| seed 25, the postlude's first 70 s: the voluntary, the joint's first chord | −35.3 · −38.0 | −33.6 · −37.5 | −1.7 · −0.4 | 0 · 0 |

(At +2.2 these read +2.9 · +1.9, +2.8 · +2.9 and +0.5 · +1.8.) A pipe chord
holds its level where the old organ's swelled and faded, so the pipes'
amens are steadier than the old organ's and the old organ's peaks are
briefer; the loudest 3 s and the integrated loudness now sit either side
of it. In an amen, the swell box now closes on one chord and opens again
over the next one's attack (the old organ's cross-fade); it had been held
open over them.

**Clicks.** In the windows above the pipe organ made none (0 in each of
the hymns, preludes, mornings and postludes). The old organ clicked under
its hymns: 13 (seed 7), 19 (25), 5 (23), 10 (19). It clicked 0 times in its
preludes.

**Scanned over whole meetings, the pipes clicked once, and that is mended**
(commit `4ee76677`). The organ layer alone was scanned through seed 32's
first 840 s. The detector found one transient: at **7:59.7**, the joint's
amen after the Old Way hymn, out of silence, a lone 1 ms spike 24.6 dB over
its neighbours. The old organ, over the same 489 s, clicked 19 times.

- **The cause.** A gain is 1 until its first event. The amen's key went
  down a hair past a sample (the float arithmetic of the joint's time,
  some 3·10⁻⁷ of a sample over a whole one). The browser started the
  pipes at that sample, where `setValueAtTime(0, t)` had not yet happened.
  For one sample the gain was 1. A pipe's own wave starts at nought and
  says nothing there, but the chiff's noise starts wherever its offset
  falls. So one sample of the pedal's chiff went out at full size, and the
  pedal has no shutters to round it.
- **The mend:** every gain a key makes (the pipes', the reeds', the pedal's,
  the chiff's) is set to nought when it is made.
- **The proof.** The meeting's own organ calls near the amen were replayed
  on a fresh pipe organ in an OfflineAudioContext. Before the mend the first
  sample is 7.3·10⁻⁴ out of silence. After it, 3.9·10⁻⁷, and the first
  millisecond's treble is 22 dB lower. In the meeting, seed 32's first 489 s
  now scan at 0 clicks, and its levels are unmoved (within 0.1 LU).

**Then three more whole meetings on the final build**, the organ layer
alone, 960 s each from ▶:

| seed, organist | what the organ plays in it | clicks |
|---|---|---|
| 25, the Victorian | the chorale prelude, three Tabernacle hymns (a walk into the dominant, three links, a held-over note in the doxology), the joints' amens, the testimony and the sacrament, into the postlude | 0 |
| 19, the improviser | the chorale prelude (the tune in the pedals, the flutes a major third up), three Tabernacle hymns (a quote between the lines, a walk into the subdominant), the doxology with a band after it, into the postlude | 0 |
| 23, the plain organist | the chorale prelude, a hymn walked into the subdominant, two hymns sung without the organ (a Sacred Harp tune, the doxology), the house's chords at the joints, the postlude; then the next meeting's chorale prelude (a Victorian's) | 0 |

There were 0 console errors and 0 late clock cues in any of them, and the
organ held at most 110 pipes alive at once. The hymns at the organ read
−29.1 to −30.0 LUFS on the loudest 3 s, as in the table above. (Seed 19's
doxology reads −21.5 over the whole span, but that is the band: a guest
has no slider to put at 0, and it crossed at 14:40–15:42. The organ's own
verse and amen, 13:52–14:38, read −30.0.)

## What it costs (measured, not cut)

**The audio thread, in the real meeting** (muted headless Chrome on this
M3 Pro, the page itself; step 1's method. Three readings at once:
Chrome's own trace of the render callbacks, summed per second; Chrome's
`renderCapacity` for the page's context; and the node counts).

**A caution first: the machine was busy, and then it slept.** Other crews'
harness batches held eight cores at 99 % through the first runs (load
average 3.7–11), and at 11:29 the Mac ran its battery flat and slept for an
hour; it woke at 12:37 on the charger into a load of 80. So each A/B pair
below was run back to back, both halves at about the same load, and the
absolute numbers differ from pair to pair with the machine. The pair is the
reading. (Runs the sleep cut short were thrown away and run again.)

**A Tabernacle hymn** (seed 7, BOUNTIFUL, 120 s from the jump to the hymn:
the giving-out and three verses; the ward sings in both; the pair run at
12:45–12:49, the one-minute load 4.4 and 3.6):

| | the organist on the pipes (this build) | the old organ (`&organ=house`) |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **29.2 % · 34.1 % · 34.6 % · 37.9 %** | 26.1 % · 30.3 % · 29.6 % · 33.6 % |
| Chrome's render capacity: median · p90 · max | 25.9 % · 41.2 % · 58.3 % | 24.8 % · 37.7 % · 51.9 % |
| one render callback (5.3 ms of audio): median · p99 · max | 1.44 ms · 2.67 ms · **4.20 ms** | 1.30 ms · 2.73 ms · 4.01 ms |
| nodes the context holds, peak (created in 120 s) | **2,486** (12,981) | 1,940 (11,310) |
| the organ's own: cases · pipes built · most alive at once | 1 · 3,360 · 115 | — |
| the audio clock against the wall: median · slowest second | 1.000 · 0.9 | 1.000 · 1.0 |
| clock cues late | 0 of 1,854 | 0 of 1,306 |

**Under a hymn the organist on the pipes costs a little more than the old
organ: about 3 points of the audio thread at the median (29.2 % against
26.1 %, some 12 % more work), 4 at the worst second, and some 550 more
nodes held.** A pipe key is 5–8 nodes, where the old organ held one
oscillator a rank for a whole line, and the organist plays more notes than
the Score's four parts (the fills, the interludes, the pedal). An earlier
pair on the busy morning read the other way (17.9 % against 20.1 %), but its
two halves ran at loads 3.7 and 11.1; this pair is the fair one. Step 1
measured the old organ's side of this hymn on a quiet machine at 16.4 %.

**The chorale prelude** (seed 25, the first 75 s from ▶; loads 10.8 and 9.8):

| | the Victorian's chorale prelude | the old organ's voluntary |
|---|---|---|
| the thread: median · p90 · worst second | 8.7 % · 10.1 % · 10.8 % | 7.9 % · 9.3 % · 9.9 % |
| one callback: median · max | 0.46 ms · 0.97 ms | 0.42 ms · 1.10 ms |
| nodes, peak (created) | 593 (918) | 359 (660) |

**The whole meeting** (seed 25, twelve minutes from ▶: the Victorian's
chorale prelude, the invocation, two Tabernacle hymns (FAR WEST, walked
into in the dominant, and ORCHARD), the testimony, into the sacrament; the
ward sings the hymns and around them; the two halves run back to back on
a quiet machine, both at load 2.8):

| | the organist on the pipes (this build) | the old organ (`&organ=house`) |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **19.1 % · 31.3 % · 35.9 % · 42.4 %** | 22.4 % · 32.5 % · 40.9 % · 58.0 % |
| Chrome's render capacity: median · p90 · max | 20.3 % · 34.5 % · 87.3 % | 21.0 % · 36.0 % · 90.4 % |
| one render callback (5.3 ms of audio): median · p99 · max | 1.11 ms · 2.93 ms · **5.42 ms** | 1.14 ms · 3.40 ms · 6.14 ms |
| nodes the context holds, peak (created in 720 s) | 3,423 (35,101) | 6,249 (30,505) |
| the organ's own: cases · pipes built · most alive at once | 1 · 6,467 · 110 | — |
| the audio clock against the wall: median · slowest second | 1.000 · 0.9 | 1.000 · 0.5 |
| clock cues late · lines the ward's desk handed late | 0 of 6,029 · 0 of 1,547 | 0 of 4,585 · 0 of 1,547 |

By section (Chrome's render capacity, median · max): the prelude 13.7 ·
45.5 against 12.9 · 35.4 (the organist's chorale prelude against the old
organ's voluntary); **the hymns 25.5 · 87.3 against 25.6 · 90.4**; the
testimony 13.3 · 34.8 against 20.9 · 47.7. The invocation reads 17.0 ·
45.9 against 11.7 · 28.4: with the chorale prelude the morning runs 14 s
longer, so the two halves are not in the same music there.

**Honestly, the peaks:** in both builds the worst render callback ran a
hair over the 5.3 ms of audio it had to make (5.42 ms here, 6.14 ms on the
old organ), and render capacity touched the high 80s once, both in the
hymns, where the ward's joins are. A callback over its budget can be a
dropout on a slower machine; this Mac's output buffering rode over them
(the audio clock kept the wall). It is the ward's cost, as step 1 found
(its worst was 4.89 ms), and the old organ's run had the worse of the two.

**Reading it.**
- **The pipe organ costs a little more than the old one under a hymn, and
  no more over twelve minutes of a meeting.** In the fair hymn pair it is
  about 3 points of the audio thread at the median (12 % more work) and
  some 550 more nodes held. Over twelve minutes of seed 25 the thread's
  share, the render capacity and the callbacks were all at or under the old
  organ's, and so was the peak of nodes held (an upper bound: a node is
  counted until the collector takes it); the pipes created 15 % more nodes
  in all (35,101 against 30,505). The ward is still what costs: step 1's
  measure (twice the old choir's work in a hymn) stands.
- **The worst callbacks.** In the hymn pairs the worst was 4.20 ms of the
  5.3 ms a callback has (the old organ's 4.01). Over the whole meeting,
  once each, both builds ran a hair over it (5.42 ms here, 6.14 ms on the
  old organ), in the hymns, where the ward's joins are (step 1's worst was
  4.89 ms).
- **The organist's desk** (one pump every 0.2 s of music, 3 s ahead) and the
  ward's desk share the main thread. In every run reported here no clock
  cue fired late (0 of 1,854 in the hymn, 0 of 6,029 over the meeting), and
  the ward's desk handed every line ahead of its time (0 late of 1,547).
- **A phone** (not tested; the owner deferred it): the organ adds a little
  to step 1's estimate. The ward is still what would crackle first.

## How it was checked (all silent)

**The harness** (`_harness.js`, untracked; 1200 s a seed):

- **40 seeds: 38 pass** (run again after the `HYMN_LIFT` mend: every
  organist figure below the same, note for note; the last change, the house
  chords' level and swell, moves no note, and seeds 7 and 8 pass on it).
  Seeds 17 and 37 fail only on the trombone choir's compass, as they did at
  HEAD and in step 1 (the GUEST crew's).
- **New section, "the organist"** (every run). Checked:
  - an organist is seated every meeting, named in Deseret;
  - every accompanied hymn is given out, with the organ under the verses,
    and its amen;
  - **every organ note under a verse is the Score's own pitch** at its line
    and beat, **and sounds with the ward's note to 3 ms**;
  - fills stay within the style's cap, with none in a hymn sung without the
    organ, and at most one strange fill a meeting;
  - when a morning is seated for the chorale prelude, it is played, on the
    day's first hymn, and the prelude never turns over inside it;
  - **the house writes no note while it sounds**;
  - every organist's event is in Deseret (the ward's check).
- **Over the 40 seeds (77 meetings, 68 hymns at the organ):**

  | | |
  |---|---|
  | organists | Victorian 33, plain 27, improviser 17 |
  | chorale preludes | 15 of 77 mornings |
  | why the rest were not | the organist's die 23, the trombones' dawn 11, the brush arbor 11, a withheld tune 7, a unison first hymn 6, the steeples 2, a humming morning 2 |
  | organ notes under the verses | 22,669, every one the Score's pitch |
  | with the ward's own note to 3 ms | 22,313; the other 356 have no ward note to meet (a treble verse: the soloist alone over the organ) |
  | giving-out | 2,330 notes |
  | interludes | 803 notes |
  | amens | 570 notes |
  | modulations | 194 notes, in 13 seeds |
  | fills | 46: links 20, held-over suspensions 13, echoes 7, sequences 2, quotes 2, an arabesque 1, the strange key 1 (0.68 a hymn; 22 seeds none, one seed 8 in four hymns) |

- **REPRO passes** (the same seed twice, then with jittered timers, then
  with the sound-level streams re-salted: the score identical, byte for
  byte). Seeds: 3 (a chorale prelude on a Sacred Harp tune), 23 (a chorale
  prelude and a modulation), 32 (the strange fill; a second meeting's
  chorale prelude), 4 (modulations), 7 (1200 s each), and 1847 (1500 s,
  ives razz cumulative); on `ec1b753c`, 25 (the chorale prelude, a walk
  into the dominant), 32 again, and 8 (a voluntary morning: the house's
  chords on the pipes); and on the final build (`4ee76677`), 32 (the
  joint's amen that clicked) and 25 again, with the harness passing on
  seeds 7, 8, 19, 23, 25 and 32.
- **TRANSPORT passes** on seeds 20, 1847 and 3 (3 again on the final
  build). Pause holds. STOP then PLAY lets none of the stopped meeting's
  sources back into the hall (the organ's cases are shut at the fade).
- **The lab's organist is unchanged.** The organist lab's own plans, before
  and after the hymn was written in pieces, over 360 Sundays (every style;
  1–4 verses; hymn index 0–2; with and without a modulation; two hymns and a
  modulation each): **360 of 360 identical**, key for key (the pedal's new
  report fields set aside). After that, one deliberate change: a tenor
  tune's prelude keeps its tune (the Victorian's solo stop was the soprano,
  and his ornaments could touch the tenor). It differs only in the
  Victorian's preludes on Sacred Harp tunes (12 of 144 in a second run),
  as it should. The `HYMN_LIFT` mend leaves the lab's plans as they were:
  360 of 360 identical against the commit before it.

**The browser** (muted headless Chrome, port 9461, PHP on :8141):

- `index.php` and all twelve labs at 860 and 390 px: **0 console errors**,
  no horizontal scroll (again on the final build).
- Every browser run reported in this note played with **0 console
  errors**, and in none of them did a clock cue fire late: the hymns,
  preludes, mornings and postludes measured for level, the traces, the
  whole meetings scanned for clicks, the smoke runs. The runs the Mac's sleep
  cut short, and one taken as it woke under a load of 80 (its audio clock at
  half speed), were thrown away and run again.
- **The organist lab's Check** still runs in the page on the final build
  (seed 1847, the Victorian, three verses): the prelude 0.2 LU and the hymn
  0.1 LU from its reference, 0 clicks in either, 0 console errors (the same
  on `ec1b753c` and on `4ee76677`).
- **The listening note's times in the browser.** Seed 25 from ▶ in muted
  Chrome, on the audio clock: the chorale prelude at 0:05.4 (to 0:48.8),
  the hymn announced at 2:37.5, the walk into the dominant at 2:41.2, the
  giving-out at 2:47.7, verse 1 at 2:54.2: the harness's times to the
  second. The hymns were written ahead by the composer's worker (3 of 3, 0
  late), and no clock cue fired late.
- **The minutes, as the page draws them.** Seed 25 again, ▶ and nothing
  else for 290 s (`&latin=1`, so the actions read in English beside the
  Deseret names): the organist's rows at **0:05** "𐐝𐐅𐐞𐐈𐐤𐐊 𐐗𐐢𐐊𐐙 PLAYS THE
  DAY'S FIRST HYMN AS A PRELUDE", **2:41** "… MODULATES TO THE NEXT HYMN'S
  KEY" and **4:27** "… LINKS THE LINES", among the ward's own ✦ rows (the
  child sings the tune, the newcomer joins in, a member comes forward);
  0 console errors, no clock cue late. (The pass above looked for these
  rows as `li` elements and found none; the minutes are `div` rows, and
  this pass reads them.)

## Requests

1. **For the integrator:**
   - **VERSION** at publish: the line above, or yours.
   - **The harness** (untracked): copy the one in the scratchpad (path above)
     into kolob-2. It carries step 1's changes too.
   - **SCORE §11.6** is written (the organist crew's R2–R4, adopted as the
     organist took the bench). `kolob-score.js` gained one typed event,
     `chorale-prelude`.
   - R1 is applied to the old organ (`houseOrganChord`). It is the A/B now,
     so the owner hears it only with `?organ=house`.
2. **For the owner's ear (the knobs):**
   - `UNDER_WARD_DB` (5 dB, `kolob-voices-organ.js`): the organist under
     the ward. At 0 the organ is the organist lab's own level, about 5 dB
     softer than the organ the meeting has played under its hymns since
     v0.35.
   - `HOUSE_TRIM` (0 dB, set in the meeting): the house's chords on the
     pipes against the old organ's.
   - The chorale prelude's odds are the organist's own
     (`STYLES.*.prelude`), and its refusals are listed in
     `kolob-meeting.js` (one line lets a Sacred Harp tune's prelude go).
   - `STRANGE_ODDS` (0.3) and `STYLES.*.fill.rate`: the fills.
3. **For the ORGANIST crew (organist-lab):** the lab's level reference is
   v0.34's `organChord`. The meeting lifts the organist under the ward by
   `UNDER_WARD_DB`, to where the old organ's part lines sat since v0.35 (the
   level the ward was balanced against in step 1). A second reference in
   the lab's Check, the old part lines at the meeting's gains, would keep the
   two in step. The lab's organist also now keeps a tenor tune on its solo
   stop and leaves it undecorated (`tuneOf`, `underTune`; `cadenceSusp`
   and `passing` skip it).
4. **For the HYMN crew (and the integrator): gospel at the organ.** The
   task named "(and later gospel)". Gospel's profile in `kolob-dialects.js`
   says `organ: false`, and SCORE §11.3's table (binding) has the chorister
   key a gospel hymn and the ward sing it without the organ, so gospel stays
   unaccompanied in this step. The meeting now asks the dialect's own flag,
   so it is one word to change, and it works: in a scratch copy with gospel's
   `organ: true`, seed 1 (a gospel house, four gospel hymns) ran with the
   organist on every one of them — the giving-out (156 notes), 1,696 notes
   under the verses and refrains, every one the Score's pitch and with the
   ward's note to 3 ms, 27 interlude notes, a walk into the subdominant, three
   fills. What would then need the HYMN and CAST crews: SCORE §11.3's gospel
   row (the organ gives out the tune instead of the chorister's keying), and
   the harness's own gospel expectations (it then reports "an unaccompanied
   hymn not keyed" and organ notes "under an unaccompanied hymn", as it
   should until the row changes). The organ does not play under the tag.
5. **For the ENGRAVE crew:** the organist's notes carry:
   - `orn` (the ornaments' kinds, SCORE §11.6) and part `fig` (the
     improviser's running figures: many short notes);
   - `prelude: true` for the chorale prelude, and `interlude` for the
     interludes;
   - a `pedal` part that may sound at its key, where the 16′ would fall
     under 38 Hz.
6. **For the CAST crew:** `cast-lab.php` loads `_engine.php`, so its phone
   and headroom tests now run the meeting with the organist and the pipe
   organ as well.
7. **For the tools crew:** `tools/lib/dump.js` and `tally.js` could read
   the organist's `cast` events (`memberId: "organist"`) and
   `chorale-prelude`.
8. **For the GUEST crew:** seeds 17 and 37 still put the trombones outside
   their compass (as at HEAD).

## Known issues

- **Tuned by measurement, not by ear.** The level under the ward
  (`UNDER_WARD_DB`) matches the organ the meeting already had there, which
  is louder than the organ the owner called "pretty loud" in v0.34. If the
  organ now sits too high under the hymns, that knob is the one to turn.
- **More of the quietest chiffs.** The pipe organ leaves out a chiff under
  an absolute floor (`chiff()`, `amt < 0.004`, `kolob-voices-pipeorgan.js`).
  With the organ lifted 5 dB under the ward, more of the quietest legato
  chiffs clear it (seed 7's meeting: 10,739 organ nodes built against
  7,832 before the lift). Each one sits as far under its own pipe's tone as
  before; there are simply more of them. If the owner hears more breath in
  the organ under the hymns, a floor relative to the key's level is the
  mend; I left it as it is for the owner's ear to decide.
- **The house's chords now speak.** On the pipes a prelude chord begins with
  the pipes' speech and the swell box opening, not a two-second fade from
  silence. The old organ's 32 Hz pedal sine is gone: a pedal note under
  38 Hz sounds at its key. Hear `?organ=house` against it.
- **The chorale prelude on a tune sung unaccompanied** (Sacred Harp, fuging,
  gospel first hymns) is my call; see *What is small*.
- **The Victorian's link suspension** still sounds a moment against the
  ward's next entry, now and then (the organist crew's known issue: a habit,
  about once a hymn at most).
- **Under the treble verse** the organ plays all four parts beneath the
  soloist, as the old organ did.
- **The strange fill is very rare** in the meeting (1 in 77 meetings). It
  needs the improviser, a late hymn, a fill, and 0.3. Raise `STRANGE_ODDS`
  if it should come more often.
- **A fuge sung twice** (psalmody's) would fall back to the old organ if a
  dialect with a repeated fuge were ever accompanied. None is today.
- **The postlude** is the house's chords on the pipes, not an organist's
  voluntary on the day's last hymn: a natural next step.
