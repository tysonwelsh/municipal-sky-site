# The staff — the rules of the page

*The binding rules of the shape-note staff that the page's drawing engraves under the wheel
(`kolob-viz.js` and its five pieces, `_viz.php`; THE SIX FILES in `kolob-viz.js`):
what prints and what never does, the layers and their sizes, the look, the collision rules
and the checks. Consolidated 2026-10-01 at v0.36.2 from `archive/plans/PLAN-ENGRAVING.md` (Direction A and
the owner's amendments after v0.31), `handoff/drone-wave-handoff.md` §4,
`handoff/r3c-engrave-2.md` and the header of `kolob-viz.js`. Every reference was checked
against the code that day; the names below are the code's, in whichever of the six files holds
them.*

## What it is

A grand staff on a canvas (`#kolob-viz`, the plate 240 px tall, 196 on a phone:
`kolob.css`), two staves a normal grand-staff gap (5 spaces) apart with a brace
and baked clefs. Middle C, the meeting's keynote, sits at q = 10 on a diatonic lattice; bass
rules at q = 0…8, treble at 12…20 (`kolob-viz-intake.js`, `Q_MID`). A note is engraved at
the burin near the right edge when it sounds, then travels left at **60 px/s**
(`SCROLL_PX_S`), dries and dissolves before the clefs. The drying runs 31× in the
sacrament and 6× in the postlude: in the sacrament the page dries almost blank.

## What is printed, and what is not

**Printed.** Every sounded note of the house and the ward (the owner's "fuller staff",
PLAN-COMPOSITION §15). A composed hymn prints from its Score as a hymnal prints it: barlines in its mode of time, double bars at the lines' ends and the final
bar at the end; written values, beams within the beat, rests, fermatas, ties, slurs over
melismas, accidentals; **closed-score SATB** — the two upper voices on the treble (upper
stems up, lower down), the two lower on the bass, shared stems where two voices move
together; **four shapes** by solmization (fa △, sol ○, la ▭, mi ◇; `SHAPES`);
**the tune marked** by a heavier head (`HEAVY`); the fuging as a free passage; a
unison as one line; the Old Way's ornaments. The organ alone prints (its giving-out, a
prelude, a fill, the house's chords), **never the organ under the singing** (`wardSpans`).

**Guests** print in the page's own vocabulary, the far ones paler: the dawn trombones in
closed score, the far choir pale; the old tune faint and fine in round notes; bells and
handbells as ringed heads; the far tower's peal as small ringed heads; the handcart company
in octaves; the gulls' cries as stemless heads; the far ward pale and small, a line behind;
the Social Hall's fiddle with its bars and strains and the caller's calls as spoken heads;
the testimony-bearers' speech as a cross a syllable and the reed's replies without stems;
the gift of tongues under its slurs with the ward's hum; the organist's variations as the
organ alone. The visiting band prints in round notes on its own layer,
sliding through at the band's own quicker rate (`takeBand`; `drawBand`). The telegraph is punched straight into the paper along the middle of the gap.

**Never printed.**
- **The Hosanna** — audio-only, the owner's ruling (`onNote`;
  `ENGRAVE_HYMN: false`, `kolob-guest-hosanna.js`), and any note or event that says
  `logged: false` (SCORE §6).
- **The drone** — not drawn today; the owner removed the grey bar that stood in the lowest
  bass space ("I don't care for it"). Nothing reads the `"drone"` layer (`MELODIC`).
  The drone as a *waveform* is the owner's open request (`handoff/drone-wave-handoff.md`): a
  sanctioned exception to "nothing moves", still green, still wordless.
- **Words** — no Deseret underlay, no running head.
- **Text of any kind** — no 8va/15ma, no captions, no time figures for the band
  ("Everything is green; nothing is text"). A note beyond the ledger
  room folds silently by octaves until it fits the plate.

## The layers and their sizes

One ink for everything; size and paleness say who is who (`SCALE`, and the guests'
own constants):

| who | size | ink |
|---|---|---|
| the ward, the choir, the organ, the strings, the bells, handbells, trombones, the old tune | 1 | 1 (the far trombone choir 0.42: `TROMBONE_INK`; the old tune 0.5 and a second try 0.3: `OLDTUNE_INK`) |
| the clarinet | cue-size 0.75 | 1 |
| the harmonium | grace-size 0.6 | 1 |
| the far ward | 0.6 (`FARWARD_SCALE`) | 0.42 (`FARWARD_INK`) |
| the gulls | 0.6 the lead, 0.5 the chatter | by loudness, 0.25–0.9 |
| the far tower | 0.3, the ring 1.333 (`TOWER_SCALE`) | 0.5, muffled 0.32 |
| the fiddle | 0.55 (`FIDDLE_SCALE`) | 1 |
| the variations' figures | 0.6 (`VAR_FIG_SCALE`) | 1 |
| the gift's runs | 0.55 (`TONGUES_RUN`) | 1 |
| the band | round heads on its own layer | follows its approach and recession |

## The look

- **Green ink only** (`C_INK`): hymnbook green on cream, from the moment a note
  sounds. No gilt strike, no gold-to-green cooling, no glow, no red.
- **One clean strike.** Each head is one even tone, with no ink-spread halo and no pale
  letterpress edge (v0.35.1). A note is struck whole on a proof sheet at
  full strength and laid on the page once at its paleness (`impress`/`stamp`),
  so head, stem, flags, ledgers and beam never print darker where they meet.
- **No text on the staff.** (The shelved Question's "?" and cartouche, the one glyph that
  was text, left the live tree on 2026-10-01: `shelved/kolob-question-setpiece.js`.)
- **No pulse or expanding-ring animations.** A bell is a static ringed head, its ring
  standing off the head so it is one outline . Nothing moves but the
  scroll and the drying — and the band's layer, which slides at its own rate (the owner's
  open call, r3c-engrave-2 request 1).
- **Johnston's tuning marks** (−, +, 7) exist and are off until the owner rules
  (`TUNING_MARKS: false`; `KolobViz.setTuningMarks`).

## The rules of collision

- **No bar on ink.** Every bar stands clear of the ink either side; the downbeat's notes
  make room, and a guest's note never prints before a bar placed at or before its time
  (`drawHymnBar`; `barAfter`; `barExtents`).
- **No head struck through.** A head is never under another note's stem, ledger, flag, sign
  or head (`onHead`; `clearance`); two heads a third apart stack as a
  chord's stand (`STACK: 0.2`). A flag clears its own head.
- **A note moves at most 2.4 spaces** from its time to find room (`HYMN_DX_MAX`); a
  crowded guest more (the far ward up to about 7.5).
- **Sung order.** On each staff a line's notes read left to right in the order they are
  sung, whichever part sings them (`orderAt`): the far ward, the
  gulls' cries, the far tower.
- **The far ward yields.** On a beat it shares with us our notes are set first and its step
  aside; it waits for a bar of ours just after it (`takeFarWard`, `strict:
  true`, `yields`).
- **The burin.** Nothing prints right of the engraving point: a note set past its time waits
  where it was set and is struck when the burin reaches it; a beam or a curve stops at the
  burin (`BURIN_EPS`).
- **Slurs and ties settle once.** A curve is laid out whole when its last note is set and
  then only travels with the page; on a shared staff the upper voice's curves lie above and
  the lower's below; a slur curves as deep as 2.2 spaces to clear its heads and its ends
  move at most one space (`SLUR_DEEP`, `SLUR_END`).
- **The telegraph** is never punched where a note, ledger or stem has the gap; no stem ever
  crosses the gap's middle .

**Measured guarantees** (r3c-engrave-2, every frame of every guest's passage at 860 and 390
px): 0 heads struck by a guest, 0 bars on ink, 0 notes moving once printed, 0 curves
reshaped, 0 notes right of the burin, 0 pale notes with ink laid twice, 60 fps at 390 px
under 4× CPU throttling — with the named exceptions in `r3c-engrave-2.md`'s Known issues
(one far-ward stem on one of our heads and one slur over a far-ward head, seed 10 at 860 px;
our own stacked thirds; a bar squeezed where the hymn outruns the cap; the variations
standing late where densest).

## The checks

- **`probe("ink")`** (`KolobViz.probe`) is the page's own dev view: every
  drawn note's ink boxes, each curve's `q1` and side, the beams' tally. The round-3c in-page
  checker (`crit.js`, `incheck.js`, `tone.py`) reads it to count heads struck, bars on ink,
  moved notes, curves reshaped, notes right of the burin and ink laid twice; it lives in a
  scratchpad, not yet under `tools/` (an open request).
- **`node art/kolob/tools/screens.js --seed 22`** (`tools/screens.js`): the staff at 860 px
  (DPR 2) and 390 px (a phone, DPR 3) at chosen seconds, then the frame cost under 4× CPU
  throttling against the 16.7 ms budget; the console's errors listed. Always muted
  (`tools/lib/chrome.js` refuses an unmuted Chrome).
- **The frame-exact capture** (dev; `?kolobFreeze=<secs>`, `KolobViz.freezeAt(secs)`,
  `probe("freeze")`; `screens.js --freeze`): the page held at that second of the meeting,
  counted from its downbeat, painted there once the sound has passed it, and left standing, so
  two captures of one seed are the same staff pixel for pixel (`compare -metric AE` says 0)
  and two builds compare by pixel. Exact where the ink dries at its own rate; in the
  sacrament and the postlude a shade may differ. A page that does not ask is not touched.
- **The staff traced** (`node art/kolob/_harness.js <secs> <seed> staff[=390]`): the page's
  drawing plays along with a headless meeting on canvases that record every call, and the report
  gives a digest of everything drawn, frame by frame; two builds fed the same meeting draw the same
  page exactly when the digests agree (`KOLOB_DIR=<the other build>`). The cut into six files was
  proved so, and by `tools/samecode.js --split` (every statement moved whole).

Authority: kolob-viz.js and its five pieces (`_viz.php`)
