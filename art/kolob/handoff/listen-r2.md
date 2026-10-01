# Listening packet: round 2

*For the owner. This is the build that will become v0.34 when it is
published. It is waiting on your ear, and nothing has been published.*

## How to listen

The local server is already running. Open a seed like this and press PLAY:

> http://127.0.0.1:8114/art/kolob/?seed=1847

- Change the number after `seed=` for another Sunday.
- Times below (mm:ss) are the page's own clock, which you can see beside
  each line of the clerk's minutes. They count from when you press PLAY,
  and match the minutes to the second.
- The footer still reads **v0.32**, because the number v0.34 is given when
  the build is published. You can tell this build by the six letters after
  the version (see the end of this page).
- **Every seed plays a different meeting than it does on the live site.**
  This round gave each seed new dice once, on purpose. From now on a seed
  plays the same meeting every time.

## What is new, and what to listen for

1. **The trombone choir at dawn** (new, approved in the first enrichment
   brief).
   - On about one Sunday in five, a few seconds into the prelude, a
     trombone choir far across the settlement plays the first line of the
     day's first hymn. A second choir, nearer and on the other side,
     answers with the next line.
   - They trade lines two or three times. The near choir brings the hymn
     home on its last chord, and sometimes the far choir joins that chord.
     In a minor key the last chord may turn major.
   - While they play, the organ, the harmonium, the strings and the clarinet
     stop to listen. The drone and the outdoor sounds carry on.
   - The minutes print ♪ TROMBONES AT DAWN, ♪ THE NEAR CHOIR ANSWERS and
     sometimes ♪ THE TWO CHOIRS TOGETHER. The programme card reads
     "trombones at dawn" while they play.
   - They never come on a Sunday when the marching bands cross. They are
     rarer on fast Sundays and more likely on conference and jubilee
     Sundays.
2. **The old tune plays real hymn tunes now**, from the corrected
   transcriptions. Among them are LDS hymns: "The Spirit of God",
   "Praise to the Man", "Come, Come, Ye Saints", "Redeemer of Israel",
   "High on the Mountain Top", "If You Could Hie to Kolob" (KINGSFOLD) and
   others. It plays the first line or two, faint and far off, and sometimes
   tries the opening again, fainter.
   - A tune only comes on a Sunday whose tuning holds every one of its
     notes. A minor tune only comes on a dark Sunday.
   - KINGSFOLD's leap at "voice of Je-sus" is now tuned pure.
3. **The accompaniment follows the choir.** The organ, harmonium and strings
   now play the chord the choir is singing at that moment. Before, they
   often played a chord from the line the choir would sing half a minute
   later.
4. **The alto no longer climbs above the tune.** Before, it did in about a
   quarter of the choir's chords.
5. **Smoother joints between sections.** The organ's amen waits until the
   choir has finished its line and taken a breath. A visitor (a band, the
   bells, a trombone choir) keeps the section open until it has gone by,
   instead of being cut off.
6. **No more replay after STOP.** Press STOP during a hymn, then PLAY at
   once. The new meeting starts in a clean hall: no leftover choir lines,
   drone or echo from the one you stopped.
7. **Pause holds exactly.** A meeting resumes where it stood, however long
   you pause. Typing a number into GATHER gives the same meeting as the
   same `?seed=`.

## Five Sundays to hear

1. **Seed 1847, at 0:06: the trombones at dawn (a bright, major Sunday).**
   http://127.0.0.1:8114/art/kolob/?seed=1847
   - At 0:06 the far choir plays from the left.
   - At 0:14 the near choir answers from the right. It is closer and fuller.
   - They trade lines twice, and at 0:33 the far choir joins the last chord.
     That chord is the home chord.
   - Around 0:40 the organ, strings and clarinet come back.
2. **Seed 48, at 0:08: the trombones on a minor Sunday (a jubilee).**
   http://127.0.0.1:8114/art/kolob/?seed=48
   - The chorale is slower and darker, and runs to about 1:15.
   - The far choir starts on the right. The near choir answers from the left
     at 0:27.
   - Listen to the very last chord, near 1:13: this minor hymn ends on a
     bright major chord.
3. **Seed 16, at 0:17: an old tune, "The Spirit of God" (Hymns 2, the tune
   ASSEMBLY).**
   http://127.0.0.1:8114/art/kolob/?seed=16
   - Two lines, faint and far off to one side.
   - Then a fainter try at the opening, and at 0:55 the memory gives out.
4. **Seed 27, at 0:14: an old tune, "Praise to the Man" (Hymns 27, the tune
   MARTYR).**
   http://127.0.0.1:8114/art/kolob/?seed=27
   - Two lines, sung low and warm, done by 0:30.
   - Later, at 13:17, a marching band crosses the doxology.
5. **Seed 9, at 5:25: the choir finishes before the organ's amen.**
   http://127.0.0.1:8114/art/kolob/?seed=9
   - The first hymn's last line ends on a long held chord, from 5:25 to 5:33.
   - Then a breath, and at 5:34 the organ's amen and the next hymn.
     Before, the organ's amen came in under the singing.
   - During the hymn (3:14 to 5:33), the organ's swells sit on the chord the
     choir is singing.
   - While you are here, try STOP during the hymn and PLAY at once. The new
     meeting starts clean.

### To hear a particular guest on any seed

- **The Ives pill** (𐐌𐐚𐐞, at the foot of the page) guarantees one visitor
  every meeting. It now draws from four: the bands, the bells, an old tune,
  or the trombones.
- **For the trombones only:** open the browser's console, type
  `KolobAudio.setForceVisitation("trombones")`, then press PLAY. For
  example, on seed 9 they come at 0:11.
- **KINGSFOLD** ("If You Could Hie to Kolob") on its dark Sunday: seed 10.
  Type `KolobAudio.setForceVisitation("oldtune")` in the console, then press
  PLAY. It comes at 0:14.

## Rough edges we know about

- **Nobody has heard the trombones yet.** Their loudness, distance and pace
  were set by measurement. These are the things most likely to want your
  ear:
  - how far away the far choir sounds (on some Sundays the two choirs sound
    alike, and "far" comes mostly from level and side);
  - their overall level;
  - their pace;
  - how often they come.
- **The staff stays blank while the trombones play.** They are not engraved,
  like the old tune, so the staff can sit empty for a minute or more at the
  start of those Sundays. Should they be engraved (for example, faint for
  the far choir and darker for the near)? That is your call.
- **The trombones' hymn is the day's theme poured into a hymn shape.** Its
  first and third lines are often the same tune. The real composed hymn
  comes with the hymn-composer work.
- **A trombone re-striking the same note can move by a hair of pitch** (a
  comma), a few times per chorale. A keen ear may catch it.
- **The trombones almost never trade four times, only two or three.**
- **Fewer fuging entries** (the voices going their separate ways). There are
  about an eighth fewer, because a fuging now waits for the choir to finish
  its verse. Some hymns run 15 to 30 seconds longer for the same reason.
- **The organ's own chord can still ring over the organ's amen** at a joint,
  at about half the joints. This was already true on the live site.
- **The strings sometimes hold a note outside the chord** when the chord is
  upside down (about one held chord in thirty). This was also true before.
- **The staff draws more notes than on the live site.** Every note that
  sounds is now reported, so a strings chord prints as two or three
  stacked notes and the harmonium as a pair. Say if you want the old,
  sparer look back.
- **The amen (IV–I) is still most of the cadences**, about four in five.
  The plan wants more variety. That comes with the hymn-style work, not
  this round.

## This build

- Engine branch `kolob-r2-engine`.
- The footer on this build reads `v0.32 — … · e508d4 · 2026-09-27 21:35
  UTC`. The letters **e508d4** are this build's.
- The integrator's notes, with every measurement, are in
  `handoff/archive/r2-integrate-1.md`.
- Every check behind this page was silent: the Node harness, and a muted
  headless browser.
