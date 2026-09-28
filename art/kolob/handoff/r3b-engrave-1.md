# r3b-engrave-1: the hymnal on the staff

*ENGRAVE crew, round 3b. Branch `kolob-r3b-engrave`, from `kolob-2` at
`3fc476a`. 2026-09-28. PLAN-ENGRAVING §4.3–§4.4, under the owner's decisions
at the top of that plan. The only file changed is `kolob-viz.js`
(`kolob.css` needed nothing). VERSION is not bumped; a suggested line is
under Requests.*

## For the owner, in plain words

**What is new to see: the composed hymns now print the way a hymnal prints
them.** Until now the page guessed each hymn line's rhythm from how long its
notes sounded, so a Tabernacle hymn in quarter notes came out as flagged
eighths and sixteenths, with no bars. Now the engine hands the page each
line's written Score as it is sung, and the page engraves that:

- **Barlines** in the hymn's own time (4/4, 3/4, 2/2, 3/2, 6/8), falling
  where the Score's bars fall, pickups and all.
- **A double bar where each line of the poem ends**, and **the final bar
  where the hymn ends** (after the Tabernacle's A-men; for a hymn without an
  A-men, see Request 1).
- **Real note values**: quarters, halves, dotted notes, a Sacred Harp 3/2 in
  halves and wholes. A note held over a barline is written the engraver's
  way, as two notes **tied** across it.
- **Beams**: the quick notes of one voice are joined within each beat
  instead of flagged one by one.
- **Rests** where a part is silent (you see them most in a psalm tune's
  fuge, where the voices enter one after another).
- **Fermatas** where the Score holds: over the treble, under the bass.
- **A slur** over the tune's melismas (two notes on one syllable), and a
  sharp, flat or natural where the Score alters a degree.
- **Closed score, SATB**: soprano and alto on the treble (soprano's stems up,
  alto's down), tenor and bass on the bass staff (tenor up, bass down).
  Where the two voices on a staff move in the same rhythm through a beat
  they share stems, as tunebooks set them.
- **The tune is marked** by a slightly heavier head: the soprano in the
  Tabernacle, **the tenor in the Sacred Harp** (and the psalm tunes), the
  lead in gospel.
- **The Old Way prints as one line**, the ward's tune alone, with the
  composer's ornaments marked where they fall: a turn sign over a note, a
  slide into one, a small grace note before one.
- **The organ giving out the tune** (before a Tabernacle hymn's first verse)
  prints in four parts with its bars. **The organ under the singing does
  not print**, as in a hymnal. The organ playing alone does (see "Also").
- Still: green ink only, nothing written on the staff, no pulse, 60 px/s,
  the telegraph's holes punched in the paper (they skip any spot where a
  stem or head now reaches into the gap).

**Also:**
- **The whole ward prints as its four parts**, however many sing: when the
  32 voices join the meeting, each part is printed once, from the Score.
  (Tested by replaying a meeting with every note reported eight times over,
  some an octave off: the page was identical.)
- **Handbells print as ringed heads**, when they come.
- **The organ alone** (the house organ between sections, and the organist's
  prelude and fills when they are wired in) now prints as organ chords.
  This fills the invocation's blank staff that the round-2 Eye reported.
  Say if you would rather it stayed blank.

**One call for you: Ben Johnston's tuning marks.** The page can print his
signs before a note the colony tunes away from its spelling: a small −
or + for a comma, and a 7 for the ringing seventh. They are built, but
**off**: in a gospel hymn nearly every other chord rings, so "7+" appears
before half the notes, and the 7 reads like a number (you asked for no text
on the staff). In the Tabernacle they would be an occasional tiny dash.
Compare the two sets of frames below. To switch them on, set
`TUNING_MARKS = true` near the top of the hymnal section in `kolob-viz.js`
(or run `KolobViz.setTuningMarks(true)` in the console to preview).

### How to see it

Open the meeting with the seed and wait for the time shown (mm:ss from
PLAY), or use the wheel's dev jump to "hymn" (the hymn begins a few seconds
after the jump).

| what | seed | when | look for |
|---|---|---|---|
| **Tabernacle, the A-men and the final bar** | 7 | 2:54 announced; the organ gives out ≈2:57; verses 3:07, 3:40, 4:13, 4:46; A-men 5:18 | the organ's four parts, then the ward's; the alto hanging below the treble on ledger lines, its stems down; beamed eighths; the fermata over and under the last chord; after the A-men, the final bar |
| **Sacred Harp, the tune in the tenor** | 3 | 2:32 announced, verse 1 (on the notes) 2:35 | the tenor's heavier heads on the bass staff; double bars at the ends of lines; bars at the pickups |
| **A Sacred Harp tune in 3/2** | 34 | 5:24 | halves and wholes |
| **A psalm tune's fuge: rests** | 7 | 5:52; the fuge in the third line ≈6:14 | rests in the voices not yet entered; notes tied across barlines at the line ends |
| **Gospel** | 34 | 2:40 | the tenor and the lead on the treble, the lead's heads heavier |
| **The Old Way** | 18 | 3:07 announced; the ward's first line 3:24 | one line; a turn sign, a slide, a grace note; very slow half notes with bars |

## Before and after (muted headless Chrome)

All in `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3b-engrave/`.
The "before" is this branch's starting `kolob-viz.js` (v0.35), served to the
same browser; offsets are seconds after the hymn was announced, after a jump
to the hymn section.

| scene | before | after |
|---|---|---|
| Tabernacle, seed 7 (giving-out 8 s; verse 1 at 20 and 32 s; A-men 148 s; final bar 152 s) | `shots/before-tab7/staff-{860,390}-t{008,020,032,148}.png` | `shots/final-tab7/staff-{860,390}-t{008,020,032,148,152}.png` |
| Sacred Harp, seed 3 | `shots/before-sh3/staff-{860,390}-t{012,024}.png` | `shots/final-sh3/staff-{860,390}-t{012,024}.png` |
| Old Way, seed 18 | `shots/before-ow18/staff-{860,390}-t{024,040}.png` | `shots/final-ow18/staff-{860,390}-t{024,040,062}.png` |
| Gospel, seed 34 | — | `shots/after-gospel34/staff-{860,390}-t{012,022}.png` |
| Psalm tune, seed 21 (at 36 s the visiting band crosses between verses: its round notes, staccato oom-pahs and faint barlines are the band's own layer, unchanged) | — | `shots/after-psalm21/staff-{860,390}-t{020,036}.png` |
| A Shaker song (unison, 3/4) and a gospel hymn in 6/8 (the replay lab, seeds 22 and 37) | — | `lab-shots/t9/h22-860-t200.png`, `lab-shots/t9/h37-860-t208.png` |
| The prelude with the organ alone, seed 7 | — | `shots/after-prelude7/staff-{860,390}-t{020,060}.png` |
| **Johnston's marks, on / off** (the replay lab) | `lab-shots/marks-off/*.png` | `lab-shots/marks-on/*.png` |
| The psalm tune's fuge with its rests and ties (the replay lab, seed 7, 6:26) | — | `lab-shots/t6/h7-390-t386.png`, `lab-shots/t5/h7-860-t386.png` |
| The Old Way's grace note (the replay lab, seed 18) | — | `lab-shots/t6/h18-390-t248.png`, `lab-shots/t5/h18-860-t212.png` (the turn and the slide) |

## What shipped (`kolob-viz.js`)

A new section, **THE HYMNAL ON THE STAFF**, between the old tune and the
fold:

- **Intake.** `onEvent` takes `hymn-announced` (the hymn's mode, key, time),
  `verse-start` (the beat; and `performance.verses` when the engine sends
  it) and each composed `verse-line` (its Score, start and beat), which
  arrives in the same task as its notes. `flushIntake` routes a composed
  hymn's notes by line (`scoreRoute`, `lineKey`); the organ's notes under
  the ward only say which parts sound; the organ's giving-out is engraved
  from the hymn's Score (`KolobAudio.getHymn`), its clock fitted from its
  notes (`fitClock`). A line with no Score falls back to the old reading.
- **`takeHymnLine`**: the line's clock is the performer's own
  (`unitsOf`, kolob-hymnal.js `clockOf`: a fermata's hold moves what
  follows). Parts that sound → staves by the dialect's voice order
  (`staffPlan`); notes split at barlines (tied); per staff and per beat
  of the mode of time, the two voices share stems if they move alike
  (`together`), else each keeps its own; unisons share a head (two voices
  on one note of one length: one head, two stems); accidentals per bar;
  beams per voice within the beat (6/8 by the dotted quarter); rests per
  part, cut at the barlines and kept clear of the other voice; bars,
  double bar, final bar; fermatas; ties; the tune's slurs.
- **Placement from the Score, not the sound**: a composed note's staff step
  is its degree in the hymn's key (`keySteps`, `taggedQ`: a hymn keyed a
  fourth away no longer misspells), and its shape is the syllable the ward
  sings on the notes (the composer's `doOf`; a dorian final is sol, as
  sung). The fuging's notes use the same.
- **Drawing**: heavier heads in the atlas (`headSprite(…, heavy)`); a small
  glyph atlas for rests, fermatas, sharp/flat/natural, the turn and
  Johnston's 7 (`GLYPHS`, `glyphSprite`); `beamGeo`/`drawBeam` (slope kept
  gentle, stems at least 2.9 sp, kept on the plate and off the gap's middle
  unless the other staff leaves room; drawn to the engraving point as the
  notes arrive); `drawMarks` (bars that stand between the inks on a crowded
  page, rests, fermatas, ties and slurs clipped at the engraving point).
- **The gap, shared note by note** (`gapLimit`, `room`): a hymn's alto
  around middle C keeps its stem down into the gap as far as the bass's
  ink at that moment allows; only where both staves send a stem in at once
  does each keep to its own half (the r25 rule). A voice keeps its own stem
  direction near the gap (shortened, not turned into the other voice); an
  alto one step below its second ledger stays on the treble when the bass
  leaves room. Where two voices lie a second apart, the stem-up voice is
  moved over by one head, the engraver's way.
- **The organ alone** (`organAlone`): organ notes print unless a composed
  line of the ward or the choir's own singing is sounding at their onset;
  the pedal's 16′ is never printed (it doubles the bass).
- `KolobViz.setTuningMarks(bool)` and `KolobViz.probe()` (what is on the
  page now, for silent checks; the app never calls it).

## How it was checked (all silent)

- **The real page**, muted headless Chrome over CDP (`--headless=new
  --mute-audio`, port 9462, profile
  `/private/tmp/claude-501/kolob-r3b-engrave-chrome`, `php -S` on 8142),
  driver `scratchpad/r3b-engrave/drv.js`: seeds 7, 3, 18, 34, 21 at 860 and
  390 px, before and after. **0 console errors, no horizontal scroll** in
  every run (`shots/*/report.json`).
- **Frame budget at 390 px, 4× CPU throttling**, 25 s recorded during a
  hymn:

  | run | fps | frame cost mean / p99 / worst | long tasks |
  |---|---|---|---|
  | Tabernacle, seed 7, before | 60 | 0.56 / 1.6 / 5.1 ms | 0 |
  | Tabernacle, seed 7, after | **60** | 1.02 / 2.3 / 3.1 ms | 0 |
  | Sacred Harp, seed 3, after | **60** | 0.62 / 1.7 / 2.3 ms | 0 |
  | Sacred Harp, seed 3, the committed build | **60** | 0.75 / 2.0 / 3.3 ms | 0 |

  (`shots/fps-*/report.json`; the machine's load was 1.5–3.3.) The page's
  own work stays near a millisecond a frame against a 33 ms budget.
- **A replay lab** (`scratchpad/r3b-engrave/lab/lab.html`, not committed):
  the real `kolob-viz.js` fed harness dumps through a fake `KolobAudio`, to
  look at any moment at once. Whole dumps (7 minutes each of seeds 7, 3,
  18, 34, and 5½ minutes of 22, 1 and 37: a Shaker song, gospel in 3/4 and
  6/8) replayed at 12× through the page: **0 errors**. The 32-voice test
  above was run here (`dumps/h7x8.jsonl`). **STOP** mid-verse lifts what
  was scheduled after it (9 groups, 3 bars and rests on the probe) with
  0 errors (`stoptest.js`).
- The harness does not load the page (`kolob-viz.js` is on its lab-only
  list), and no engine file changed, so there is no engine run to report.

## Requests

1. **Integrator (`kolob-voices-choir.js`, `singHymn` → `verse(v, tv)`), one
   field:** add `verses: P.verses` to the `verse-start` event's
   `performance` object (SCORE §10.5). The page already reads it: with it,
   a hymn without an A-men (Sacred Harp, the Old Way, psalm tunes, gospel)
   ends on the final bar after its last verse. Without it the page cannot
   know which verse is the last, so those hymns end on a double bar (the
   Tabernacle's final bar, after the A-men, is right today).
2. **CAST (the ward in the meeting):** report each sung note as the house
   choir does now — `hymnId`, `verse`, `line`, `beat`, `sings` (the Score
   part) and `part` — on `choir` (the page also reads `ward` and `cast`).
   Where a singer places a note (late, early) is sound-level; the reported
   note should be the written one. The page then prints the four parts,
   whatever the number of singers. The chorister's keying and the pitching
   (no `line`/`beat`) print as plain notes.
3. **ORGANIST (when the organist is wired in):** tag the giving-out
   `givingOut: true, verse: -1` (it is then engraved from the Score, with its
   bars), the accompaniment under the ward with its `verse` (never printed),
   and leave the prelude, fills and interludes without a `verse` (printed as
   the organ alone). Pedal notes `part: "pedal"` (not printed).
4. **GUEST (handbells):** notes on the `handbells` layer (ringed heads).
   **(The trombones at dawn, a nice-to-have):** they play the day's first
   hymn but their notes carry no `beat` (r25-engrave asked for it too). With
   `beat` and `line` they could print with the hymn's bars; today they print
   by r25's reading, unchanged.
5. **Integrator, VERSION** (a suggestion): `v0.3x — the hymnal on the staff:
   the composed hymns print as a hymnal prints them — barlines, double and
   final bars, fermatas, rests, beams and ties from the Score, closed score
   SATB with the tune's heads heavier (the tenor's in the Sacred Harp), the
   Old Way's ornaments; the organ's giving-out printed, the organ under the
   singing not`.
6. **Owner:** Johnston's marks (above). And the organ-alone printing.

## Known issues and choices

- **Gospel's voice order.** The brief says S and A on the treble. In the
  gospel dialect the lead (T) sings *under* the tenor harmony (S) and over
  the baritone (A) (`GOSPEL.voiceOrder`), so the page keeps the voices in
  order: S and T on the treble, A and B on the bass, the lead's heads
  heavier. Every other dialect is S A / T B.
- **A single voice on a staff** (a Sacred Harp hymn with no alto, a gospel
  staff where only one part sounds) takes the position rule for its stems,
  as engravers do, rather than a fixed direction.
- **The 60 px/s page is tight for quick notes before a barline.** The bar
  stands midway between the inks; with an eighth right before a downbeat
  there can be as little as a third of a staff space either side.
- **The alto's stems now reach into the gap** when the bass leaves room
  (the telegraph skips those spots). Where both staves reach in at once,
  each keeps to its half and a stem can be short (1.3 sp).
- **A part more than two and a half ledgers into the gap** still crosses to
  the other staff (rare: a very low alto or high tenor).
- **A rest raised clear of the other voice** can stand just outside the
  staff, without a ledger.
- **The fuging between verses** (its entries carry no beats) still prints
  by the old estimate from its lengths; its heads are placed by their
  degrees now.
- **Solmization of composed hymns** follows the composer (the syllables the
  ward sings on the notes): a dorian final is sol, a mixolydian final sol.
  The page's older per-mode table (dorian's final as la) still serves the
  non-hymn voices.
- **The organ alone now prints** in the prelude and invocation (the house
  organ's long chords, as whole notes and breves).
- **A quick hymn is dense at 60 px/s.** A gospel hymn in 6/8 at 0.29 s an
  eighth puts a bar every 10 staff spaces; it is correct (quarter–eighth
  pairs, the eighth flagged as 6/8 writes it) but crowded, especially at
  390 px.
- **Not the page, for the HYMN crew / integrator:** short harness runs
  (330–420 s) of seeds 1, 34 and 37, each with a gospel hymn, FAIL at this
  branch's start (`kolob-2` `3fc476a`; no engine file changes here): some
  gospel Score notes do not proofread against their monzo by a septimal
  comma (27.3 ¢, 48.8 ¢), which also lowers the pitch-adherence figure.
  Seeds 3, 7, 18 and 22 pass.
