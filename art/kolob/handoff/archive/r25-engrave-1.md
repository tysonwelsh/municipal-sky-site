# r25-engrave-1: the trombones and the old tune, engraved

*Branch `kolob-r25-engrave`, from `dcab4f6` (plan addendum 2). 2026-09-27.
This implements PLAN-COMPOSITION §15 "Engraving" and the round-2 Eye's findings
1, 2 and 5. The only file changed is `kolob-viz.js`, and VERSION is not bumped
(that is the integrator's job).*

## For the owner

The staff no longer sits blank while the trombones or the old tune play.

- **The trombone choir at dawn** is engraved as a hymnal prints a hymn: the
  four parts on the two staves, soprano and alto above, tenor and bass below.
  You can see which choir is playing from the ink. The **far choir's
  phrases are pale** and the **near choir's answers are full green**, so the
  page alternates pale, dark, pale, dark as the choirs answer each other. When
  the far choir joins the last chord, the chord is printed only once.
- **The old tune** is printed as a memory. It uses **round notes**, the way
  Earth's hymnals printed it (the 1985 book among them), and not the colony's
  shapes. The ink is faint and the lines are fine. It dries twice as fast as
  the ward's ink, so the tune fades from the page as it fades from the air.
  The second, broken-off try is fainter still.
- Your rulings all hold: green ink only, no text, no drone bar, telegraph
  holes punched in the paper, no pulse, 60 px/s, and the fuller look (every
  sounded note prints).

**How to see it** (the seeds play it on their own; no switch needed):
- `?seed=1847`: the trombones from 0:06 to about 0:40.
- `?seed=48`: the trombones in the first minute.
- `?seed=27`: the old tune (MARTYR) from 0:14.
- `?seed=16`: the old tune (ASSEMBLY) from 0:18.

**Before and after, side by side** (before on top; muted headless Chrome):
`/private/tmp/claude-501/kolob-engrave/sheets/`

| sheet | what it shows |
|---|---|
| `tb1847-860-t014-before-after.png`, `tb1847-860-t030-…` | the trombones, desktop: blank before; the far choir pale at the left, the near choir full |
| `tb1847-390-t014-…`, `tb1847-390-t030-…` | the same on a phone |
| `tb48-860-t020-…`, `tb48-390-t035-…` | the trombones on seed 48 |
| `old10-860-t018-…`, `old10-390-t010-…` | the old tune (KINGSFOLD, forced on seed 10): blank before; faint round notes after |
| `old10-860-t028-…` | the old tune's second try (fainter), under the bells' full ink |
| `hymn9-860-t030-…`, `hymn9-390-t020-…`, `hymn9-390-t040-…` | a hymn (seed 9), checked for regressions. The choir is unchanged, and the strings root that printed on the bass staff with three ledgers now sits with its fifth on the treble |

The single frames are in `/private/tmp/claude-501/kolob-engrave/{before,after3}-tb1847/`,
`{before,after}-tb48/`, `{before,after}-old10/` and `{before,after}-hymn9/`.
Each folder also holds a `report.json` with frame costs and console errors.

## What shipped (`kolob-viz.js`)

1. **The trombones** (`takeTrombones`):
   - **Parts decide the staff.** S and A go on the treble and T and B on the
     bass, and a part stays on its staff for the whole chorale.
   - **Ink by choir** (`TROMBONE_INK`): far 0.42, near 1.
   - **The far choir's join** onto the near choir's last chord is detected
     (same part and pitch, 0.12 s after the near note) and dropped, so the
     chord is printed once.
   - **The written octave is chosen per staff, per chorale** (`writtenOctaves`):
     - A staff is written an octave up or down only when that saves at least
       a quarter of a ledger line per note. It is written at pitch
       otherwise. Ledgers into the gap weigh 1.5, and a fold past the plate
       adds 3.
     - This follows the TTBB convention of a treble-8 clef for low upper
       voices. The chorale sits a third to a fifth under a hymnal's voices,
       so neither staff is at pitch by default, and a uniform octave up
       (the Eye's what-if) was worse than at pitch on every dump.
     - Results on the dumps:
       - seed 1847: meeting 1 writes the treble an octave up and the bass at
         pitch; meeting 2 is at pitch;
       - seed 5: both staves an octave up;
       - seed 9 forced: the treble an octave up;
       - seeds 48 and 10 forced: at pitch.
     - The bass staff never goes above the treble's octave.
   - **The beat is the chorale's commonest length** (`choraleBeat`). A brisk
     fast-Sunday dawn (0.52 s a beat) reads in quarters and halves. Before
     this it read in flagged eighths, because the estimator pulls toward
     hymn time.
   - **Stems:** parts that move together share a stem, turned by the
     standard position rule. A part that moves alone keeps its voice's stem:
     S and T up, A and B down.
2. **The old tune** (`takeOldTune`):
   - round heads;
   - ink 0.5 for the first try and 0.3 for the second (`OLDTUNE_INK`);
   - stems and ledgers at 0.7 weight (`o.thin`);
   - the ink dries twice as fast (`grp.dry`, read in `dryA`);
   - one staff for the whole memory, whichever needs fewer ledgers;
   - the beat is read from the payload's own `beat` positions (the median of
     Δt/Δbeat within a line). The wear moves the time, not the beat, so
     KINGSFOLD reads as eighth, eighth, quarter, dotted half, and so on.
3. **Every layer is staffed by its reported part** (`staffOf`, `PART_STAFF`),
   which is the Eye's finding 5:
   - The choir and the harmonium's S/A/T/B go to their staves. A part may
     reach two ledgers into the gap; beyond that it prints on the other
     staff.
   - Parts that are not S/A/T/B (the strings' root, fifth and octave), and
     notes with no part (bagpipe, clarinet, bells), take the staff their
     pitch belongs to. This fixes the strings root at q14 that printed on
     the bass staff with three ledgers.
   - The old half-split rule for chords is gone.
   - On a staff where a call has two or more parts, a part that moves alone
     keeps its voice's stem (`voiceDir`).
4. **A stem never crosses the middle of the gap** (`layoutGroup`). A stem
   that reaches into the gap stops 0.3 sp short of the telegraph's line. If
   its head already sits too near that line to grow a 2.2 sp stem (a tenor
   high over the bass staff, an alto deep under the treble), the stem turns
   away from the gap. `drawGroup` takes the turned direction from the
   layout. This change reaches every layer. On the choir it only shortens or
   turns stems that used to cross into the other staff, and the hymn A/B
   shows no other change.

## How it was verified (all silent)

- **Muted headless Chrome over CDP** (`--headless=new --mute-audio`, port
  9432, profile `/private/tmp/claude-501/kolob-engrave-chrome`, `php -S` on
  8122). The driver is `/private/tmp/claude-501/kolob-engrave/eye.js`, the
  round-2 Eye's driver with a `--viz` switch that serves the before build to
  that browser only.
  - Forced and natural trombones: seeds 1847 and 48.
  - Forced old tune: seed 10.
  - A hymn jump on seed 9.
  - All at 860 and 390 px, CPU throttled 4×, before and after.
- **Frame cost at 4× throttling:**
  - Every run held the 16.7 ms rAF interval (60 fps), with zero long tasks.
  - After: p99 1.4–2.7 ms and worst frame 2.0–11.6 ms (the 11.6 ms was one
    frame, in the old-tune run at 860). Before: p99 1.4–3.0 ms and worst
    2.0–14.9 ms. That is well inside the ≥30 fps budget.
- **Console errors:** none in any run. Nothing scrolls sideways at either
  width.
- **Blank staff** (the page's own intake, fed from harness dumps; a group
  shows for 11 s, as at 860 px):

  | dump | first ink before → after | prelude blank before → after |
  |---|---|---|
  | seed 1847 (trombones) | 40 s → 6 s | 49 % → 8 % |
  | seed 48 (trombones) | 82 s → 8 s | 80 % → 8 % |
  | seed 9, trombones forced | 77 s → 12 s | 85 % → 13 % |
  | seed 10, trombones forced | 80 s → 7 s | 92 % → 8 % |
  | seed 27 (old tune) | 24 s → 15 s | 40 % → 29 % |
  | seed 16 (old tune) | 24 s → 19 s | 45 % → 32 % |
  | seed 10, old tune forced | 24 s → 16 s | 52 % → 31 % |

  The rest of the blank time is the invocation, where the organ plays alone
  (the Eye's finding 3). That is another crew's job.
- **Staffing** (seeds 9, 27, 1847, 900 s):
  - strings heads with two or more ledgers into the gap: 1–2 → 0;
  - choir: unchanged (the same 6–8 two-ledger heads, now from the parts);
  - trombones (seeds 5, 48, 1847, and 9 and 10 forced): no head goes three
    or more ledgers into the gap, and 0–2 heads per chorale go two ledgers
    in.

## Requests

- **ENGINE or integrator (`kolob-guests.js`, not mine):** two comments are now
  stale.
  - Lines ~437–441 say the old tune's layer is one "the page does not
    engrave".
  - Lines ~776–778 say "the staff does not engrave them (a visitor's, like
    the old tune's)".
  - Both should say the page prints them (the trombones in closed score,
    the old tune faint in round notes).
- **ENGINE (nice to have):** trombone notes could report `beat` (the
  chorale's beat in seconds, as the band's notes do) and `joins: true` on
  the far choir's joining chord. The page infers both today.
- **Owner (a look, not a blocker):** round notes for the old tune. The
  alternative is the colony's own shapes, drawn faint and fine. The round
  head is close to the sol shape (the Eye made the same point about the
  band). Alone on the page it reads as a memory; over the choir (a testimony
  seat) it is told apart by ink and weight, not by shape.
- **Integrator:** bump VERSION when this lands, for example "the trombones
  and the old tune print on the staff".

## Known issues and not done

- A tenor 2.5 ledgers over the bass staff (seed 1847 at 0:30) turns its
  chord's stem down through the bass staff. It is legible but long.
- A far-choir phrase dries from 0.42 to about 0.27 by the left edge of a wide
  page. It is still legible in the shots.
- **Not in this task** (the Eye's other requests):
  - cap the band's ink at about 0.45 and bring it into `placeColumn`;
  - print the organ when it plays alone (the invocation);
  - print the strings as an open fifth: **not done by ruling**, because
    the owner kept the fuller look (every sounded note prints).
- No beams or fermatas yet. As before, they wait for the Score.

---

## Follow-up: the stems, before v0.34

*Same branch, on top of `ac741d6`. 2026-09-27. This fixes the extra-high
critic's review of the commit above: one moderate finding, one minor and two
polish. The only code changed is `kolob-viz.js`. VERSION is not bumped (the
integrator's job, as before).*

### For the owner

- **No stem crosses the middle of the gap now.** When the bass trombone went
  below the page's ledger room, the page folded the whole chord up an octave.
  That lifted the tenor onto the telegraph's line and ran a long stem (about
  9½ staff spaces) down through the bass staff. Now only the note that runs off
  the page folds: the bass comes up an octave and the tenor stays where it
  was. A tenor that would sit on the telegraph's line anyway (it happens at
  pitch too) folds down an octave instead.
- **A lone high soprano's stem turns down** when its own stem, up, would be
  cut short by the top of the page. The same goes for a lone tenor at the top
  of the bass staff (its stem stopped at the telegraph's line) and a lone bass
  at the foot of the page. Those stems reached 2.2 to 2.9 staff spaces past
  the note; now they reach the full 3½.
- **The old tune's dotted figures print dotted.** MARTYR's figure is a dotted
  eighth and a sixteenth now, not a quarter and a sixteenth. The hymns are
  unchanged (the reason is below).
- **Quick notes get a little air.** Where a sixteenth all but touches the next
  head, the next note is set a hair to the right (0.3 of a staff space), the
  way a second voice is set.
- Your rulings all hold: green ink only, no text, no drone bar, the telegraph
  as holes punched in the paper, no pulse, 60 px/s, and the fuller look.

**Before and after, side by side** (before on top; muted headless Chrome):
`/private/tmp/claude-501/kolob-stemfix/sheets/`

| sheet | what it shows |
|---|---|
| `tb1847-860-t035-…`, `tb1847-390-t035-…` | the trombones at 0:35 (forced): before, the tenor sits on the telegraph's line with two ledgers and a stem through the bass staff; after, the bass is folded up and the stem stops short of the line |
| `tb1847-…-t020-…`, `…-t026-…` | the same chorale earlier (the far choir, pale) |
| `old27-860-t008-…`, `old27-390-t004-…` | MARTYR (seed 27, forced): the dotted eighth and its sixteenth; the sixteenth and the eighth after it no longer touch |
| `voice45-860-t088-…`, `voice45-…-t084-…` | a hymn (seed 45, about 1:25 after the jump): the tenor's lone notes at the top of the bass staff, stems up and stopped under the telegraph's holes before, down and full after |
| `hymn9-…`, `voice77-…` | hymns (seed 9 at 0:20–0:40 after the jump, seed 77 at 1:37 and 1:43), for regressions: the same ink |

### What changed (`kolob-viz.js`)

1. **The fold** (`foldFor`, `drawnHeads`). The gap belongs to the telegraph,
   so a fold never carries a head into it. Nothing is lifted over the bass
   staff's ledger-free space (q9) or sunk under the treble's (q11). A head
   more than two ledgers into the gap (past `GAP_B`/`GAP_T`, on the
   telegraph's line) folds back toward its own staff. When a whole-chord fold
   would break either rule, the chord folds head by head, each only as far as
   it needs. Folding a single head changes nothing, so the Question's phrase
   fold and a voice's fold memory work as they did. `drawnHeads` caches the
   folded heads with the fold (per staff space, so a resize re-folds them).
   Two parts that fold onto one line print one head.
2. **Voice stems** (`takeLayer`, `posDir`, `layoutGroup`). A part moving alone
   on its staff keeps its voice's stem as before. It also carries the
   position rule's direction (`grp.alt`). `layoutGroup` now works out where a
   stem ends for either direction (`stemEnd`, `reach`). If the voice's stem
   would reach less than 3 sp past its head (cut by the plate's edge or by the
   gap), and the position rule's stem reaches further, the position rule wins.
   The gap rule (turn away from the gap under 2.2 sp) still has the last word.
   A part that shares its onset with another voice on its staff keeps its
   voice's stem whatever its length, so two voices at one x never stem the
   same way.
3. **The dotted eighth** (`valueOf(beats, layer, fine)`). One flag and a dot,
   for 0.62–0.87 of a beat, only where the beat is the tune's own: the old
   tune when its notes report their beat positions (`fineBeat`). The ward's
   lines are read against an estimated beat. In 12 natural meetings, 75 of
   their notes fall in that window (choir 24, clarinet 33, harmonium 18),
   spread from 0.6 to 0.9 with no peak at ¾. They are quarters misread
   (the estimator cannot go under 0.75 s) or sung short, so printing them
   dotted would be wrong. For example, seed 27 at 2:48 is a quarter of
   0.73 s read against a beat of 1.01 s. The band's articulated quarters
   (0.9 of a beat) are untouched too.
4. **Air for quick notes** (`placeColumn`, `groupBoxes`). Head boxes are
   tagged. Where either group is flagged, two heads within 0.3 sp of each
   other (and overlapping vertically) count as touching, and the later group
   is set aside as before. Heads only: counting the flag's box too made
   ordinary upward runs of eighths (a flag tip 0.2 sp from the next head at
   60 px/s) push each other along the page, up to 1.9 sp. The page's own
   placement, simulated over 32 dumps, sets aside 17 more groups (old tune 3,
   clarinet 7, harmonium 7) by 0.1–0.6 sp. The choir and the trombones are
   not affected by the air. The turned voice stems (item 2) move 9 choir
   placements, most of them less aside than before. One lone soprano's new
   down-stem runs through a strings note held at that moment, so it is set
   2 sp aside as a second voice (old-tune dump 3, at 4:04).
5. `drawPage` takes its heads and options from `drawnHeads` and `inkOpts`, so
   a measuring tool can lay a group out exactly as the page draws it.

### Numbers

The page's own intake and layout were fed from harness dumps, at the page's
two plate sizes: 702×240 (860 px) and 316×196 (390 px). Scratch tool:
`/private/tmp/claude-501/kolob-stemfix/measure.js` (and `place.js`, which
replays the page's column placement). A **crossing** is a stem whose ink
spans the telegraph's line.

| dumps | trombone groups | crossings before → after | heads on the line | longest stem |
|---|---|---|---|---|
| the critic's 20 forced (seeds 1–8, 9, 11–14, 21, 33, 48, 77, 101, 1847, 4242) | 1272 | **6 → 0** (both widths; the critic's exact method too) | 6 → 0 | 9.5 → 8.6 sp |
| 20 new forced (seeds 15–38) | 1356 | **4 → 0** | 7 → 0 | 9.5 → 8.7 sp |
| 12 natural (seeds 9, 12, 27, 33, 77, 1847, 40–45) | 168 | **3 → 0** | 3 → 0 | 9.5 → 8.9 sp |

- **Seed 1847**, the critic's 0:17, 0:23, 0:31 and 0:33:
  - 0:17 was [11, 2] and is now [4, 2];
  - 0:31 and 0:33 were [13, 2] and are now [6, 2], stems up and stopping
    0.3 sp under the line;
  - 0:23 still folds whole, to [9, 2]. The tenor sits in the space over the
    staff with no ledger, and nothing crosses.
- **Tenors at pitch.** Some crossings came from a tenor written at pitch on
  the line, not from a fold:
  - seed 45 at 0:29: [13, 2] → [6, 2];
  - seed 31 at 0:09: [13, 2] → [6, 2];
  - seed 31 at 0:53: [13, 6] → [6], with the tenor folding onto the bass's
    note;
  - seed 31 at 0:54: [13, 9] → [6, 9].
  The first fix alone (the fold guard) left these 4.
- **The critic's through-lines** are a treble stem down meeting a bass stem
  down from a head over the bass staff at one onset. Over the 40 forced
  dumps they went from 73 to 46. The paper between the treble stem's end and
  the bass head was at least −0.02 sp before (touching) and is at least
  0.28 sp now (median 1.48).
- **Voice stems shorter than 3 sp:** 42 → 1 at 390 and 29 → 1 at 860, over
  1937 choir groups in the critic's dumps. On the 12 natural meetings it went
  36 → 1 and 20 → 1. The one left is a two-part chord whose position rule
  agrees with its voices: 2.7 sp past a chord spanning a ninth.
- **Everything else is unchanged.** Every group in 12 natural and 20 old-tune
  dumps was laid out before and after: 8 854 groups at each of the two plate
  sizes, and 8 796 of them are identical. The other 58 are:
  - 44 lone choir voices whose stems turned (item 2);
  - 10 dotted eighths in the old tune (item 3);
  - 4 trombone chords refolded (item 1).

### How it was verified (all silent)

- Muted headless Chrome over CDP (`--headless=new --mute-audio
  --autoplay-policy=no-user-gesture-required`, port 9441, profile
  `/private/tmp/claude-501/kolob-stemfix-chrome`), `php -S` on 8125. The
  driver is `/private/tmp/claude-501/kolob-stemfix/drv.js`, the critic's with
  `--abs` (audio-time offsets), `--eval` (a probe per shot) and `--record`
  (frames without screenshots). The before build is served to that browser
  only, from git (`viz-before.js`).
- Scenarios: seed 1847 with the trombones forced
  (`KolobAudio.setForceVisitation("trombones")`) at 0:20, 0:26 and 0:35; seed
  27 with the old tune forced (MARTYR) at 4, 8, 14 and 22 s after it starts;
  seed 9, the hymn at 20, 30 and 40 s after the jump; seed 45, the hymn at
  1:24 and 1:28 (found by polling the page for a turned voice stem); seed
  77, the hymn at 1:37 and 1:43. All at 860 and 390 px, before and after.
- **Console errors: none** in any run. Nothing scrolls sideways at either
  width.
- **Frame rate at 390 px, 4× CPU throttling.** Seed 1847 with the
  trombones, 20–30 s recorded with no screenshots, the after and the before
  build run alternately:

  | run | after: fps / frame cost p50, p99, worst | before: fps / frame cost p50, p99, worst |
  |---|---|---|
  | 1 | 35.3 fps / 1.2, 9.6, 23 ms | 31.8 fps / 1.2, 6.6, 11 ms |
  | 2 | 29.1 fps / 1.1, 6.0, 11 ms | 22.1 fps / 1.5, 16.5, 85 ms |
  | 3 | 15.2 fps / 1.8, 10.8, 21 ms | 13.0 fps / 1.8, 7.9, 12 ms |
  | 4 | 12.5 fps / 1.7, 9.8, 60 ms | 12.9 fps / 1.8, 7.5, 21 ms |

  - The page's own work is about 1–2 ms a frame (p99 about 10 ms, 0–1 long
    tasks in 30 s). That fits 60 fps at 4× throttling, and it matches the
    before build.
  - The delivered rate was set by the machine, not the page. In every run
    the median rAF gap was 16.7 ms, but Chrome held many frames to 10 Hz
    (p90 gap 100 ms), for both builds alike.
  - The machine was running a game and other sessions' headless Chromes
    (load 8–16). A calmer machine should confirm the ≥30 fps figure; the
    first two rounds met it (35 and 29 fps).
- **Harness:** `node _harness.js 120 1847` passes (ERRORS none, VERDICT
  PASS). The 26 dumps made for this work (420 s each, seeds 15–38 with the
  trombones forced and 40–45 natural) all passed too.
- **A capture artifact in both builds.** Now and then a headless 860 px
  capture shows the plate blank or with only the newest notes. It happened
  to the before build (seed 1847 at 0:20) and the after build (0:35 and the
  hymn) alike, and those shots were retaken.
  - In one hunt, 8 groups that were on the page just before a capture were
    gone from `groups` just after it.
  - A diagnostic run could not make it happen again. It saw no prune, no
    jump in the page clock and no resize to another size, though every
    capture does call `resize()` at the same size.
  - Not caused by this change and not chased further. Worth a look if the
    owner ever sees older ink vanish at once.

### Known issues and not done

- 46 through-lines remain (above). They cross nothing: the bass head sits at
  q9–q12, under the line, and the treble stem stops 0.3 sp above the line.
- Wide trombone chords still share one stem (up to 8.7 sp, a tenor an octave
  and more over the bass). That is the "parts that move together share a
  stem" rule. Splitting T up and B down always, as most hymnals do, would be
  a ruling for the owner.
- A lone tenor at the top of the bass staff now stems down like the bass
  when the gap cuts its stem short. That is the critic's rule, and it
  reads as the lower voice for that note.
