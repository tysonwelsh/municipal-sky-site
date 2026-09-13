# ZANKYŌ — melodic DNA and rhythm DNA (road map §1)

*Written and shipped 2026-09-13 (rc.64), the owner having asked for the
road map's first item to be built. The owner's read after living with
ZANKYŌ 2: the instruments still sound like the same instruments every
night. Half of that is timbre (road map §2, the bodies); this half is what
they say, and when.*

## 1. What was there

Twelve authentic gestures in one pool, drawn uniformly two at a time for a
cycle's working set; a Markov improviser with ONE transition table for every
mode and a coin toss for direction at every note, ending on the tonic by a
weight; durations from a bag of four; the rests between phrases one flat
range per voice. Measured on the harness at one hour (seeds 3042 / 7): 488
and 557 distinct phrase signatures an hour, 5–6 % of phrases heard before by
exact signature — but the SHAPES (intervals alone, which is what a listener
recognises) repeat far more, and the pool of contours was twelve.

## 2. What ships

**The ancestor pool: forty gestures across eight traditions**, each tagged
with its tradition and, where a gesture belongs to a mode's colour, with
per-mode weights (`modes`). Honkyoku (the shakuhachi's descents and the meri
dip), sōkyoku / danmono (koto figuration, kakezume, the shan), jiuta (turns
and links), Tsugaru (hammered runs and the break), gagaku tōgaku and
komagaku (the netori, plateaux, stepping dances), min'yō (kobushi, the
haul, the oiwake melisma), kagura (the call, the circling), shōmyō
(recitation, the yuri wave, the slow ascent). Two gestures are named for
in-sen and iwato themselves: the semitone that sinks, the tritone that will
not settle. The original twelve keep their names.

**The lottery is mode-aware.** At each cycle the two authentic picks are
weighted by the cycle's mode (an in-sen gesture is 1.5–2.2× as likely on an
in-sen cycle and 0.4–0.7× on a hirajoshi one), the last two cycles' themes
are held back at 0.15×, and the second pick leans away from the first's
tradition (0.3×). A night walks the pool instead of circling twelve.

**The improviser is per mode.** Four transition tables (hirajoshi, in-sen,
kumoi, iwato) with the tendency tones written into them and into the rules:
the second falls (hardest where it is a semitone), the fifth leaps to the
octave, the sixth sinks — and kumoi's major sixth and iwato's seventh rise
to the octave, iwato's tritone drops to the fourth. A born phrase follows a
**contour plan** (arch, descent, ascent, valley, plateau) for its whole
length rather than tossing a coin per note, and closes on a **phrase-final
formula** of its mode (hirajoshi 1→0 with the meri dip, 3→0, 2→1→0;
in-sen's 1→0; kumoi's 4→octave; iwato's 3→2→0 …).

**Rhythm DNA.** Cells in beats by tradition — honkyoku's long-short-long
breaths, danmono's even eighths into a held note, Tsugaru's hammering,
gagaku's slow squares, min'yō's swing, kagura's steps, shōmyō's held
recitations — and the taiko's own cells, read at first use off the kit's
pattern strings (a hit's distance to the next; don-doko-don, sung). A born
phrase takes a cell of a tradition (the theme's own, mostly); a new
transform `rerhythm` lays a cell over a motif in development (weighted per
voice — the shamisen most, the hichiriki least — and tilted toward the ha);
half the fresh walks borrow one. **Ma patterns:** each working set draws a
small cycle of rest multipliers (short-short-long, long-short …) and the
five voices walk it phrase by phrase, so the silences differ in time as the
notes do. The VFD gains one line per cycle, 遺伝 dna: the theme's tradition,
the newborn's time and contour, the ma pattern, the mode.

## 3. The draw-count contract, and the re-base

Every new draw is on the motif stream (or, for a walk's cell, the walking
voice's own). The lottery takes two `pickW` draws where it took two `next()`
draws; the improviser takes more draws than it did. So THIS IS A DELIBERATE
RE-BASE of the home stream, declared here as PLAN-ZANKYO-FAR §12 asks:
every home night moves. `_harness-bank.js` re-derives `_harness-base.json`
(the per-seed density band the harness gates on) and the commit that ships
this re-banks in the same commit; the probe's base is re-calibrated with
`node _probe.js batch 1800 --calibrate`. `_far-identity.js` compares the
working tree against `main` and will report every home night changed until
this merges — that is the re-base, not a fault.

## 4. Measured

The harness gains a phrase vocabulary line: phrases of three or more notes
per melodic voice (a gap over 0.9 s ends one), their SHAPES (interval
sequence in semitones) and full signatures (shape plus each note's length
as a multiple of the phrase's shortest), distinct per hour, and the
heard-before rate — the share of phrases whose shape already sounded
earlier tonight. Gate at one hour on a home night: ≥ 250 distinct shapes an
hour, heard-before by shape ≤ 34 %.

The bank adds the CROSS-NIGHT measure, which is the owner's question: over
the 36 home nights of the base, the mean pairwise overlap of two nights'
shape sets, and the share of a night's phrases whose shape sounds on at
least half of the other nights.

| | before (rc.63) | after (rc.64) |
|---|---|---|
| mean pairwise overlap, 36 home nights | 2.43 % | 2.00 % |
| every-night share | 2.8 % | 1.7 % |
| union of shapes over the 36 nights | 7 350 | 7 039 |
| melodic notes / 30 min, home mean | 2 187 | 2 102 |
| seed 3042 at 1 h: shapes/h · heard-before | 447 · 13.2 % | 383 · 17.1 % |
| seed 7 at 1 h: shapes/h · heard-before | 513 · 13.2 % | 427 · 13.7 % |

Between nights the engine is a fifth less alike and the shapes every night
shares are down by two fifths, at four percent fewer notes. Within one
night the heard-before rate did not fall: a night WORKS its three ideas —
plain statements, tethers, imitations, the reprise — and `rerhythm` keeps a
shape by design, so the within-night number counts the motif work as
repetition. It is reported, and gated only against collapse.

## 5. Not done here, on purpose

Per-voice breath-length DNA beyond the ma pattern (a per-night trait would
be a large lever the owner has not asked to pull); the "family of bodies"
(road map §2) which is timbre, not phrase; the comms vox (road map §4),
which will consume this improviser and was sequenced after it for that
reason.
