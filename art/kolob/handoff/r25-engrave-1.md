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
