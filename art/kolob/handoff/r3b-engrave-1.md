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

---

## Round 2: the critic's eight findings

*Same branch, 2026-09-28. The only file changed is `kolob-viz.js` again.
VERSION is not bumped. Several items in "Known issues" above are
superseded; see the end of this section.*

### For the owner, in plain words

What you will notice:

- **A barline no longer cuts through a note.** In round 1, a bar right after
  a quick note (an eighth with its flag) could run through the flag, and in
  the bass a stem just after the bar looked like a second bar. Now every bar
  keeps clear of the ink on both sides of it: heads, dots, stems, flags,
  sharps and rests. Where there isn't room (a flagged eighth just before a
  downbeat, at 60 px/s), the chord on the downbeat moves a little to the
  right, on both staves together. That is how a hymnal's spacing opens up at
  a barline. The page's timing bends by one or two staff spaces at that
  point, and never by more than 2.4.
- **The Sacred Harp tune stays on its own staff.** In round 1, the tenor
  (the tune, with the heavier heads) jumped to the treble whenever it sang
  high, and near middle C its stems turned down beside the bass's. Now the
  tune stays on the bass staff however high it goes, up to a step above its
  third ledger line, and its stem stays up. Where the gap is tight the stem
  is shorter, down to one staff space on the highest notes, but it never
  flips. When the two staves both reach into the gap at the same moment,
  the tune gets its share of the room first.
- **The fuging between verses is engraved like the rest of the hymn.** In
  round 1 it came out in flagged sixteenths with no bars, in the middle of an
  otherwise properly engraved hymn. Now it prints in the hymn's own note
  values (quarters and halves in the verse's beat). Each voice has its own
  stem direction, as in the verses; the tune's heads are heavier; a voice's
  eighths are beamed. The closing chords print as whole notes, with a
  fermata over the last one and a double bar after it. There are no
  barlines inside the fuging, because the voices enter a few seconds apart
  (the engine staggers them by 2.4 to 3.2 seconds), not on the bar. So it
  prints as a free passage, the way a hymnal prints an unmeasured amen.
- **Smaller fixes:** a whole or half rest that sits above or below the staff
  now hangs from (or sits on) its own short ledger line. The tune's heavier
  heads now meet their stems at their own edge. A sharp or flat keeps a
  little space from the note before it.

Nothing else has changed: green ink only, no text, 60 px/s, the telegraph's
holes, the Old Way as one line, and Johnston's marks still off.

### How to see it

The times are counted from when the hymn is announced. The replay lab can
show any of these moments directly (`lab/lab.html?dump=…&t=…`).

| what | seed | when | look for |
|---|---|---|---|
| **Bars clear of flags** (the critic's frame) | 7, Tabernacle | 0:40 at 860 px, 1:10 at 390 px | the eighth before the downbeat keeps its flag, the bar stands after it, and the half-note chord is set just past the bar |
| **The Sacred Harp tenor singing high** | 34, the second hymn (3/2) | about 0:26 (5:50 into the meeting) | heavy heads on three ledger lines above the bass staff, stems up |
| **The psalm tune's tenor at middle C** | 7, the second hymn | about 0:14 (6:06 into the meeting) | the tenor's stems up, never down beside the bass's |
| **The fuging** | 3 | 0:46 to 1:00 | the voices entering one at a time, the closing chords under a fermata, then a double bar |
| **A rest off the staff** | 7, the second hymn | about 0:34 (6:26 into the meeting) | a whole rest above the bass staff, hanging from its own ledger line |

### Before and after (muted headless Chrome)

All paths are in `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3b-engrave/`.
"Before" is round 1's committed `kolob-viz.js` (`viz-r1.js`), served to
the same browser. Offsets are seconds after the hymn was announced.

| scene | before | after |
|---|---|---|
| **The real page**, Tabernacle, seed 7 (0:40 and 1:10 are the critic's frames; 2:32 is the final bar) | `shots/r2-before-tab7/staff-{860,390}-t{040,070,152}.png` | `shots/r2-after-tab7/…` (the same names) |
| The real page, Sacred Harp, seed 3 (1:00 is the fuging) | `shots/r2-before-sh3/staff-{860,390}-t{012,024,060}.png` | `shots/r2-after-sh3/…` |
| The real page, the Old Way, seed 18 (unchanged) | `shots/r2-before-ow18/staff-{860,390}-t{024,040}.png` | `shots/r2-after-ow18/…` |
| **Side by side** (before above, after below) | `shots/cmp-tab7-860-t040.png`, `shots/cmp-tab7-390-t070.png`, `shots/cmp-sh3-860-t060.png` | |
| The replay lab, the critic's own frames, side by side: the SH 3/2 tenor (seed 34, 5:50), the psalm tune's tenor (seed 7, 6:06), the 6/8 gospel hymn (seed 37), the rest's ledger (seed 7, 6:26) | `lab-shots/r2d/cmp-h34-860-t350.png`, `cmp-h7-860-t366.png`, `cmp-h37-860-t208.png`, `cmp-h7-860-t386.png` | |
| The replay lab, after only: the critic's Tabernacle frames; SH 34 at 390; the fuging of seeds 3, 7 and 34; the A-men's final bar; the Old Way | | `lab-shots/r2d/h7-860-t214.2.png`, `h7-390-t244.2.png`, `h34-390-t350.png`, `h3-860-t212.6.png`; `lab-shots/r2e/h7-{860,390}-t410.png`, `h34-860-t236.png`, `h7-{860,390}-t327.png`, `h18-*.png` |
| A heavy head's stem (round 1 on the left, now on the right, 390 px enlarged) | | `lab-shots/r2f/heavy-compare.png` |
| A psalmody tenor under a beam, seed 5 | | `lab-shots/r2h/g5-860-t200.png` |

Every real-page run: **0 console errors, no horizontal scroll.** Frame
budget at 390 px with 4× CPU throttling, 25 s recorded during a hymn:

| run | fps | frame cost mean / p99 / worst | long tasks |
|---|---|---|---|
| Tabernacle, seed 7 (0:30–0:55), round 1 | 60 | 1.29 / 2.6 / 3.1 ms | 0 |
| Tabernacle, seed 7 (0:30–0:55), now | **60** | 0.89 / 2.0 / 2.5 ms | 0 |
| Sacred Harp, seed 3 (0:42–1:07, through the fuging), now | **60** | 0.70 / 1.7 / 2.2 ms | 0 |

(The machine's load was 3.5 to 4.7. Most of the difference between the
two seed-7 runs is load, not code.)

### The critic's findings, one by one

1. **Barline through a flag. Fixed.** A bar now measures the real ink on
   both sides of it with the same boxes the page uses to keep two voices
   apart (`groupBoxes`): heads, dots, stems and an unbeamed note's flag
   (`sx + 1.05·s`), within the staff and one space above and below it.
   After the bar it measures accidentals, heads and down-stems; the air is
   0.35 sp from ink before the bar, 0.35 sp to a head after it, and 0.5 sp to
   a stem after it. Three more things turned out to matter:
   - "Before the bar" now means every note that began in the two seconds
     before it, not only the last one. In the critic's own frame, the ink
     the bar also ran into was the soprano's up-stemmed quarter beside the
     alto's beamed eighths.
   - Rests before the bar count too.
   - So do a guest's notes on the staff (the clarinet over the psalm tune,
     seed 7 at 6:02).

   Where there is not enough room, the downbeat's notes make it
   (`barPush`): when they are first engraved, every note on that downbeat,
   on both staves, is set further right by the same amount, so the chord
   stays upright. The push is capped at 2.4 sp (`HYMN_DX_MAX`), so the page
   never drifts from the sound. A double bar now also knows the next line's
   first notes (`lastEndBar`), and a rest that falls on a downbeat stands
   after its bar. Result: in eleven replayed meetings, no bar touches a
   note's ink except in the 6/8 gospel hymn (finding 5) and two cases at
   860 px where the push hit its cap. Full table below.
2. **The tune keeps its staff and its stem. Fixed, mostly the critic's way.**
   The tune never crosses to the other staff while it stays within a step
   above its third ledger (`TUNE_B = 15`, A4 when the key is C; `TUNE_T = 5`
   for a treble tune going down). It still crosses in one case: when a note
   of the other staff lies within 1.5 sp of it at the same moment, so the
   two heads would touch across the gap. That happened 0 times in eleven
   meetings. Its stem is never turned (`o.tune` in `layoutGroup`). Its
   minimum length is 1.0 sp, and it only gets that short on its highest
   notes, where the treble's bottom line is the limit.

   I disagree with the critic on one detail. The critic suggested "as the
   trombones' strict mode does", but past the second ledger that mode folds
   a note down an octave (`foldFor`). An octave fold would break the
   melody's shape, so the tune keeps its pitch and gets the ledgers
   instead.

   The rest of the fix is in how the gap is shared. In round 1, whenever
   both staves sent a stem into the gap at once, each kept to its own half,
   and that left the tune a 1.2 sp stem, which the page then turned. Now
   those two stems divide the gap (`shareGap`). The division is at the
   telegraph's line, as round 2.5 had it, whenever both stems fit there.
   Otherwise it moves toward the voice that has room to give. The tune
   keeps at least 2.2 sp (2.6 under a beam, measured from the beam's
   nearest head), and the other voice keeps at least 1.3.

   Seed 34's second hymn: 18 tune notes crossed → 0, 12 tune stems turned →
   0. Seed 7's psalm tune: 4 turned → 0. The tune's stems that reach into
   the gap in seed 34's meeting: 16 at a full 3.5 sp, 24 at 2 to 3 sp, 7 at
   1.5 sp and 3 at 1 sp (the Sacred Harp tenor's A4s).
3. **Final bar only in the Tabernacle. Agreed: it depends on the engine.**
   Request 1 stands unchanged. The page is ready for it.
4. **The fuging. Fixed on the page, without engine data after all.** The
   verse's beat (from `verse-start`) gives every note its written value.
   The voices enter by the second, not by the bar, so there are no bars
   inside the fuging and no rests for voices that have not come in yet:
   it is a free passage (`takeFuging`). See Requests for what would let it
   print with bars.
5. **The 6/8 gospel hymn at 60 px/s. This one is for you.** Bars are now
   visible and clear in most of its bars: 36 of 37 touched ink in round 1,
   15 now at 860 px (26 → 10 at 390). What remains is density. An eighth
   is 1.6 sp at 860 px, and the treble carries two voices with flags and
   sharps. Where the offsets reach their cap, inks still come close,
   sharps included (`cmp-h37-860-t208.png`). Two ways out, if you want one:
   scroll quick hymns faster (for example, scale the rate to the hymn's
   beat), or accept it.
6. **Stems crossing the middle of the gap. Also for you, and partly
   narrowed.** When both staves reach into the gap at once, the gap is
   again divided at the telegraph's line wherever both stems fit, as round
   2.5 had it. The line moves only to keep a stem, the tune's first. When
   only one staff reaches in and the other staff has nothing there, the
   stem still runs to its normal length (round 1's relaxation, kept). The
   alto's middle C then reaches most of the way to the bass staff, and the
   telegraph skips that spot. If you want round 2.5's rule back for every
   voice but the tune, it is a small change in `gapLimit`.
7. **A heavy head's stem attached inside its edge. Fixed.** Heads are
   placed from their own scaled anchor, and the scaled size is used for
   dots, the second-interval offset, the column boxes, the knock-out and
   the accidental's lead.
8. **A whole rest hanging in the gap without a ledger. Fixed.** A whole or
   half rest off the staff gets the ledger lines a note there would have.
   Rests now also knock out the telegraph's holes, as notes do.

### Numbers: the replay lab over whole meetings

The real `kolob-viz.js` was fed eleven harness dumps (seeds 7, 34, 3, 1, 18
and 22, plus four new ones: 11, 12, 21 and 5). An instrumented copy checks
every bar against the boxes of every note drawn on its staves, and every
tune head's staff and stem. The instrumentation lives only in the lab
(`mkinstr.js`, `lab/lab3.html`, `labstats.js`). Each entry below reads
round 1 → round 2.

| meeting (its hymns) | bars touching ink, 860 px | bars touching ink, 390 px | tune notes that crossed staves | tune stems turned |
|---|---|---|---|---|
| seed 7 (Tabernacle 4/4, psalm tune 2/2) | 18 → **0** | 5 → **0** | 0 → 0 | 4 → **0** |
| seed 34 (gospel 4/4, Sacred Harp 3/2) | 24 → **0** | 6 → **0** | 18 → **0** | 12 → **0** |
| seed 3 (Sacred Harp 4/4 and 2/2) | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| seed 1 (gospel 4/4 and 3/4) | 3 → **0** | 2 → **0** | 0 → 0 | 0 → 0 |
| seed 11 (Sacred Harp 4/4, Shaker) | 27 → **1** | 0 → 0 | 0 → 0 | 0 → 0 |
| seed 12 (Sacred Harp 2/2 and 3/4) | 15 → **1** | 2 → **0** | 13 → **0** | 7 → **0** |
| seed 21 (psalm tune 3/4, Tabernacle 3/4) | 20 → **0** | 1 → **0** | 10 → **0** | 4 → **0** |
| seed 5 (two psalm tunes, 3/4) | 5 → **0** | 1 → **0** | 9 → **0** | 3 → **0** |
| seed 18 (the Old Way), seed 22 (Shaker) | 0 → 0 | 0 → 0 | none: sung in unison | none: sung in unison |
| seed 37 (gospel 6/8) | 36 → 15 of 37 | 26 → 10 | 0 → 0 | 0 → 0 |

There are 22 to 122 bars a meeting, and 0 page errors in every replay.
STOP in the middle of a verse and in the middle of the fuging lifts
everything scheduled after it, with 0 errors (`stoptest.js`,
`stoptest2.js`).

### Requests (round 2)

1. **Integrator:** Request 1 above is unchanged (`verses: P.verses` on
   `verse-start`'s `performance`).
2. **HYMN crew / integrator (a nice-to-have):** if the fuging's entries are
   ever placed by the beat instead of by the second (`hymnFuging` staggers
   them `R.rnd(2.4, 3.2)` s), put `beat` (from the fuging's start) on each
   fuging note. The page could then print its bars and the rests of the
   voices still waiting to come in.
3. **Owner:** the 6/8 hymn's density at 60 px/s (finding 5); stems across
   the gap's middle (finding 6); Johnston's marks and the organ alone
   printing (as in round 1).
4. **VERSION** (a suggestion, replacing round 1's): `v0.3x — the hymnal on
   the staff: the composed hymns print as a hymnal prints them — barlines
   (clear of every note, the downbeat making room), double and final bars,
   fermatas, rests, beams and ties from the Score; closed score SATB with
   the tune's heads heavier and the tune kept on its own staff (the Sacred
   Harp tenor on its ledgers, its stem up); the fuging in written values;
   the organ's giving-out printed, the organ under the singing not`.

### Known issues (round 2; replaces the round 1 list where they overlap)

- **The downbeat's room bends time** by up to 2.4 sp at a barline (26 px,
  about 0.4 s, at 860 px). When a bar would need more than that, it stands
  midway and can touch ink: 2 bars in 819 at 860 px outside the 6/8 hymn,
  none at 390 px.
- **The tune's highest notes have short stems:** 1.0 sp on its A4 in C,
  1.5 sp on its G4. The 5-sp gap and the treble's bottom line are the
  limit.
- **When there is no room to divide the gap**, the two stems pass side by
  side (1 case in seed 7). An alto left under 1.3 sp is turned up; a
  tune's stem never is. Seed 11 does this 4 times, an alto on middle C
  beside the high tenor, and round 1 did the same there.
- **The fuging has no bars and no waiting rests** (Request 2). Its close
  is printed as whole notes, whatever their sounding length.
- Round 1's items on bars ("as little as a third of a staff space"), the
  crossing high tenor, rests without ledgers and the fuging's old reading
  are resolved above. Its notes on gospel's voice order, a single voice's
  stems, solmization, the organ alone and the harness's gospel FAILs still
  stand.
