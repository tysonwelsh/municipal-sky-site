# r3c-engrave-2: the staff, finished — one clean strike

*ENGRAVE crew (the follow-up), round 3c. Branch `kolob-r3c-engrave`, from
`8e3ccc21` (r3c-engrave-1, round 2, which its second critic failed).
2026-09-29. The only file changed is `kolob-viz.js`; `kolob.css` needed
nothing, no engine file was touched, VERSION is not bumped. Every check was
run muted (headless Chrome with `--mute-audio`).*

## For the owner, in plain words

**The blur you saw was real, and it had two causes. Both are gone.**

1. **Every note is now one even tone.** A note is several strokes — its
   head, its stem (which starts inside the head), its flags (a sixteenth's
   two lie one over the other), the ledger line its head sits on. The page
   laid each stroke separately at the note's paleness, so wherever two met,
   the ink went on twice and printed darker: a dark seam down the stem
   through the head, a darker band where two flags meet. On a fresh note
   you barely see it; on a pale one (the far choirs, the company, the
   organist's quiet stops) and on every note of ours as it dries, you do —
   that is the "two strokes". Now each note is struck whole, at full
   strength, on a scratch sheet, and laid on the page once at its
   paleness. Measured pixel by pixel: in a frame of the handcart company,
   27 of its 32 pale notes had a darker seam before, none after; in the
   organist's trio all 56 before, none after.
2. **The organ's giving-out at the head of every accompanied hymn was
   printed two or three times over itself.** The organist plays the line
   a chord at a time, and each chord re-engraved the whole line from the
   hymnal, a hair or a beat apart — doubled, smeared chords. Now the line
   is engraved once.

And the rest the critic found:

- **Slurs and ties don't move any more.** Each is drawn once its last note
  is struck, whole, and then only travels with the page. (Before, a slur
  over a run could be drawn above it and jump below it when the run's last
  note printed, and its tail stretched after its last note.)
- **On a staff two voices share, the upper voice's slurs and ties lie
  above, the lower's below** — each beside its own notes. The tenor's slurs
  no longer hang down among the bass's notes; a soprano's tie no longer
  dips into the alto.
- **The organist's canon is barred once**, by the voice that leads (it had
  a bar for each voice, half a bar apart, and the notes drifted up to
  fourteen spaces behind their sound). **Nothing prints ahead of the
  engraving point** any more, anywhere: a note set a little after its time
  waits and is struck when the burin gets there.
- Smaller things: every note on a bar's downbeat stands after its bar; the
  gulls' cries and the far choir's notes print in the order they're sung;
  a short stem up under the plate's top edge turns down rather than hang
  its flag beside its head.
- Two things are left as they were, each for one moment in one seed at the
  wide size: a far-choir note's stem touching one of our heads, and one of
  our slurs crossing a pale far-choir head (see Known issues). And the
  band's pale notes still slide across our page as it marches past — your
  call (below).

Still green only, no text, nothing moves but the scroll and the drying,
every sounded note prints, and the Hosanna prints nothing.

### How to see it

Open a seed and press PLAY, then the wheel's dev jump to the section, and
wait the offset.

| what to look at | seed | jump, then wait |
|---|---|---|
| the organ's giving-out, one line, clean | 57 | hymn, ~10–15 s |
| pale notes one tone (zoom in on the company's sixteenths) | 41 | postlude, ~25–40 s |
| slurs and ties beside their own voice, still once drawn | 44 | hymn, ~70–95 s |
| a singer's run under its slur, drawn once | 5 | testimony, ~20–45 s |
| the organist's canon, barred by its leader | 77 | postlude, ~55–90 s |
| our hymn drying, one tone (look at the older notes, left) | any | hymn, after ~30 s |

## What changed (`kolob-viz.js`), finding by finding

**1. Slurs and ties settled once (blocking).** `tieShape` no longer lays a
curve out each frame. A slur or a tie is laid out once (`settleCurve`),
whole, when the last of its notes is set (both ends `setNow`, both notes
`prints`), stored on the mark (`m.set`, about its first note's own time's
x) and from then on only translated with the page; `drawTieOrSlur` clips it
at the burin (`g.xE`, no longer `xE + 0.3 sp`), so the burin cuts it as far
as it has reached. Nothing of a curve is drawn before its last note is set
— so its side is read from the stems its notes actually have
(`struck`: the same `prepGroup`/`inkLayout` the page draws with), never
from a note not yet set, and its tail never follows a note set later. The
seed 5 slurs at 40.4 and 50.5 s, seed 10's ties and the organ's slur in
seed 37's doxology no longer change (checker: 0 reshaped, 0 live changes;
table below).

**2. The voice's own side, and a fit that stays beside its notes
(blocking).** Where two voices share a staff (`x.two`, set in
`takeHymnLine`), a tie's or a slur's side is its voice's (`vside`: the
upper voice's above, the lower's below). Alone on its staff, a tie goes
away from its stem, a slur under stems that all point up and over
otherwise. An end whose stem stands on the curve's side begins past that
stem (a stem up) or ends before it (a stem down); where that would leave
too short a curve (two quick notes a space apart) it is struck from the
heads, across the stem's root. `slurFit` now fits only against the heads
of the slur's own line (`m.line`: the melisma's notes, the singer's run),
once, where they stand; its ends move **at most one space** (`SLUR_END`),
its depth at most 2.2 as before. Where the own-line fit still leaves it
across another head set in its span (a far choir's pale note), it is fitted
to that head as well, and that fit is kept only if it clears every head
(`curveCross`). A note set after a curve keeps its heads out from under it
(`slurHit`, in `clearance`, as `beamHit` does for beams). Measured: every
slur's and tie's end within 0.4 sp of the nearest head at its note's
instant at 860 and 390 in seeds 44, 10 and 57 (bar two in seed 10 at 860,
refitted round a far-ward head, at 1.26 sp), and in every run 0 reshaped
(table below).

**3. The variations: the canon's bars, the downbeat's notes, the burin
(significant).**
- `takeVariations` / `lead`: in the canon (and the two keys' interlude) a
  voice follows the leader a beat or two behind, counting the tune's beats
  as its own, so its downbeats are not the bar's. Barred at both, the canon
  had a bar every half bar; each bar pushed the notes after it, and they
  drifted to 14.4 sp behind their sound. A note now names a downbeat only
  where its line's count began with the earliest voice's (the leader's).
- Every organ note on a bar's downbeat, whichever call brought it, joins
  the bar's `nx` (`onDown`; a later call's note joins a bar not yet placed),
  and `barExtents` no longer counts a downbeat note a hair early as ink
  *before* its bar. A guest's note never prints before a bar placed at or
  before its time (`barAfter`, a floor like `orderAt`'s).
- In `takeLayer`, two voices at once on one staff whose parts would stem
  them alike (the canon's two tunes, one an octave down on the bass staff)
  are set as two voices share a staff: the lower's stem down, the upper's
  up (their stems had run through each other's heads, and the page set
  them aside, note after note).
- **Nothing prints right of the burin** (`drawPage`): a note set past its
  time waits where it was set until the burin reaches it (`BURIN_EPS`),
  and is struck there; a beam growing toward a note not yet struck stops
  at the burin (`drawBeam`), and so does a curve.
Seed 77's variations: bars on ink 5 / 4 → 0 / 0, notes printed right of
the burin 393 / 283 → 0 / 0, the organ's largest offset 14.4 / 5.0 sp →
5.7 / 3.5 (the two-keys interlude, the densest passage of the set).

**4. One even tone (significant — the owner's "two strokes").** `drawPage`
gathers each frame's notes into impressions — a note, or a beam and every
note it joins — and `impress` strikes each whole at full strength on a
proof sheet (`proofLayer`, a scratch canvas the page's size), then `stamp`
lays that patch of the sheet on the page once, at the impression's alpha,
and wipes the sheet there. Head, stem, flags, ledgers, dots, signs, a
bell's ring and the beam overlap only on the sheet, at full strength, so
they print as one tone however they meet. The band's notes are stamped
the same way (`drawBand`). The telegraph still weighs each note's ink at
its own strength (`koA`). The frame budget, measured below: 60 fps at 4x
CPU throttling at 390 px in every busy passage, 1.3–3.2 ms of work a
frame.

**5. Minor.**
- The far-ward stem/flag on our head (seed 10, 860): **not fixed**, left as
  it was (one moment, one far-ward eighth's stem and flag touching one of
  our heads). The cure I tried — a far note that finds no room within its
  cap waits for every note of ours its ink would reach — made the far
  note land on our next bar and our bar on our own downbeat (measured: 2
  bars on ink, 1 head struck), so it was dropped, as round 1's two cures
  were.
- The far ward's inversion (219.87 > 220.17): fixed. The far ward's notes
  on each staff now read in the order they are sung, whichever part sings
  them (`takeFarWard` gives them one line a staff; `orderAt`, whose offset
  dies away within a few notes). Measured, seed 10: inversions 1 → 0, no
  bar on ink, the far ward's largest offset unchanged (7.5 / 6.1 sp).
- The gulls' two cries 21 ms apart now print in the order they are cried
  (`takeGulls` gives the flock a line; `orderAt`).
- A short stem up under the plate's top edge (the organ's high eighths at
  390 px) turns down where that stem is longer, else its flag is drawn a
  little shorter (`layoutGroup`, the mirror of round 2's rule for stems
  down; a closed-score voice keeps its stem).

**Found on the way, and fixed: the organ's giving-out engraved two or
three times.** `takeHymnLine` engraves a given-out line from the hymnal's
Score, its clock fitted from the chords it is handed. The organist hands
the giving-out over a chord at a time, so each chord engraved the whole
line again, its clock fitted from that one chord: two or three copies of
every chord a hair or a beat apart, one over another, at the head of every
accompanied hymn — seed 57's 253 heads struck, 18 bars on ink and 30
"moved" notes were all this, and so were seed 10's and seed 37's organ
openings. A line given out is now engraved once, from its first chord
(`givenOut`); the rest of its chords find it on the page. Seed 57's
opening: 253 / 242 heads struck → 2 / 2 (our hymn's own stacked thirds),
bars on ink 18 / 16 → 0 / 0, moved 30 / 34 → 0 / 0.

**6. The band's sliding layer (left, as asked).** In plain words: the
band that marches past (round 2's design) prints on its own layer, which
scrolls a little faster than the page — you can watch the band's pale
notes and barlines overtake our hymn's notes and slide across them as the
band goes by. It's the one thing on the page that moves against the rest.
Its notes are stamped one tone each like everything else now, but where
its layer passes under our ink, our stems and its heads, and its bars and
our notes, cross for a moment. Keeping it is keeping the band's own pace
visible; the alternative is to scroll the band with the page like every
other guest (nothing would cross, and the band would read as one more
guest). Your call.

## How it was checked (all muted)

**The in-page checker** — the critic's (`crit.js`, `incheck.js`, from
`/private/tmp/claude-501/kolob-r3c-engrave-critic/r2c/`), copied to the
scratchpad `r3c-engrave2/` and run in the page itself at 1x, muted headless
Chrome over CDP, the wheel's dev jump, every animation frame of every
passage, at 860 and 390 px. It checks heads struck (any head crossed by
another note's ink or a beam), bars on ink, notes and bars that move once
printed, a note's own flag over its own head, curves over heads, curves
that change once engraved (and, the critic's second measure, at all),
beams reversed, inversions along a guest's line, and the Hosanna. Added
this round (all in the scratch copy): **right of the burin** (a drawn
note whose x is past `xE` by more than 0.05 sp, per note, from `probe()`),
each layer's **largest offset** past its time, **a curve's ends** from the
nearest head at its notes' instants, and a **placement log** (every note
when first drawn, every bar when placed). Two changes to how it measures,
both needed to measure honestly:

- **The screenshots no longer resize the page.** The critic's driver
  captured with `captureBeyondViewport: true`, which resizes the page's
  viewport for the capture; the page re-lays itself out at the new size,
  so everything is set again once, all at once (seen as far-ward notes and
  bars "moving" at exactly the shot times, 1.7 s after each `--times`
  mark). The staff lies inside the viewport at both widths, so the capture
  is now `captureBeyondViewport: false`.
- **Two curves at one instant are two curves.** The critic's checker keys
  a slur or tie by kind, staff and start time; where two voices' ties
  start together (one above, one below, as they now are) it saw one curve
  flip. `probe("ink")` now gives each curve's `q1` (its first head) and
  `side`, and the key includes `q1`.

**The results, on the final code** (`ac68b91f`, then only this note and
the sheets), every animation frame of every passage, each passage a run of
its own at each width (the critic's job list, its "fresh" seeds included;
far10 with one more shot, at +227 s). "Guest / house": whether a guest's
ink is on either side. "Curve reshaped": the critic's two measures, once
its last note is engraved / at any time. "Curve ends": the largest gap
from a curve's end to the nearest head at its note's instant, and how many
curves. "Largest guest offset": how far a guest's note stands past its
time.

| run | width | frames | heads struck (guest / house) | bars on ink | moved | own flag over own head | curve over a head | curve reshaped (once engraved / at all) | curve ends from their heads (max, sp) | right of the burin | line inversions | largest guest offset (sp) | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tower53 | 860 | 4200 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | tower 4.57 | 0 |
| tower53 | 390 | 4197 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | tower 2.13 | 0 |
| cart41 | 860 | 3480 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | handcart 2.01 | 0 |
| cart41 | 390 | 3476 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | handcart 1.22 | 0 |
| gift5 | 860 | 3960 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 0.74 (14) | 0 | 0 | choir 2.15 | 0 |
| gift5 | 390 | 3943 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 0.67 (14) | 0 | 0 | choir 1.02 | 0 |
| var55 | 860 | 7919 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | organ 3.67 | 0 |
| var55 | 390 | 7914 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | organ 2.95 | 0 |
| dance22 | 860 | 5400 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | caller 4.23, fiddle 4.48 | 0 |
| dance22 | 390 | 5392 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | caller 2.78, fiddle 2.57 | 0 |
| bear3 | 860 | 6000 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | voice 3.82 | 0 |
| bear3 | 390 | 5996 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | voice 0.64 | 0 |
| far44 | 860 | 5999 | 0 / 18 | 9 | 0 | 0 | 0 | 0 / 0 | 0.26 (17) | 0 | 0 | farward 5.31 | 0 |
| far44 | 390 | 5997 | 0 / 12 | 6 | 0 | 0 | 0 | 0 / 0 | 0.26 (17) | 0 | 0 | farward 5.55 | 0 |
| gulls50 | 860 | 5521 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | gulls 1.32 | 0 |
| gulls50 | 390 | 5515 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | gulls 1.14 | 0 |
| bands22 | 860 | 5038 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | — | 0 |
| bands22 | 390 | 5034 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | — | 0 |
| hos37 | 860 | 11389 | 0 / 30 | 8 | 0 | 0 | 0 | 0 / 0 | 0.38 (17) | 0 | 0 | — | 0 |
| hos37 | 390 | 11395 | 0 / 8 | 2 | 0 | 0 | 0 | 0 / 0 | 0.38 (17) | 0 | 0 | — | 0 |
| far10 | 860 | 17386 | 2 / 24 | 0 | 0 | 0 | 1 | 0 / 0 | 1.26 (40) | 0 | 0 | farward 7.46 | 0 |
| far10 | 390 | 17395 | 0 / 24 | 0 | 0 | 0 | 0 | 0 / 0 | 0.38 (40) | 0 | 0 | farward 6.08 | 0 |
| fresh-dance60 | 860 | 5700 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | caller 4.18, fiddle 4.36 | 0 |
| fresh-dance60 | 390 | 5695 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | caller 2.44, fiddle 4.39 | 0 |
| fresh-gift77 | 860 | 5398 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 1.05 (13) | 0 | 0 | choir 2.43 | 0 |
| fresh-gift77 | 390 | 5396 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 0.78 (13) | 0 | 0 | choir 0.39 | 0 |
| plain2 | 860 | 7190 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 0.38 (3) | 0 | 0 | — | 0 |
| plain2 | 390 | 7192 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | 0.38 (3) | 0 | 0 | — | 0 |
| fresh-var77 | 860 | 7798 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 4 | organ 5.66 | 0 |
| fresh-var77 | 390 | 7797 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 3 | organ 3.51 | 0 |
| fresh-cart119 | 860 | 5392 | 0 / 0 | 0 | 2 | 0 | 0 | 0 / 0 | — | 0 | 2 | — | 0 |
| fresh-cart119 | 390 | 5397 | 0 / 0 | 0 | 2 | 0 | 0 | 0 / 0 | — | 0 | 2 | — | 0 |
| fresh-tower121 | 860 | 4500 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | tower 2.28 | 0 |
| fresh-tower121 | 390 | 4496 | 0 / 0 | 0 | 0 | 0 | 0 | 0 / 0 | — | 0 | 0 | tower 1.97 | 0 |
| fresh-far57 | 860 | 8995 | 0 / 2 | 0 | 0 | 0 | 0 | 0 / 0 | 0.26 (11) | 0 | 0 | — | 0 |
| fresh-far57 | 390 | 8986 | 0 / 2 | 0 | 0 | 0 | 0 | 0 / 0 | 0.26 (11) | 0 | 0 | — | 0 |

Reading it: **every guest's passage is 0 on heads struck, bars on ink,
moved notes, curves reshaped and right of the burin, at both widths**,
with these exceptions, each named:

- **seed 10, 860 px: 2 heads struck by a guest, 1 curve over a head** —
  the one far-ward eighth whose stem and flag touch one of our heads
  (counted once for its stem, once for its flag), and the one slur of ours
  across a far-ward head (Known issues).
- **house counts in the far ward's and the Hosanna's runs** (seeds 44, 10,
  37, and 57's plain hymn): our own hymn's stacked thirds (heads struck,
  "house"), and our own bars squeezed between quick notes in seed 44's
  opening and seed 37's doxology (bars on ink) — before any guest sings,
  the same on round 2's code (Known issues). Seed 37's and 57's organ
  openings, which were most of those counts, are clean now.
- **seed 119's postlude (the critic's "fresh-cart119": in fact the
  organist's variations): 2 "moved"** — two organ voices on one pitch at
  one instant, one stem up at its time and one stem down two spaces on;
  the checker's key (layer, staff, time, heads) cannot tell them apart and
  sees one note move. The same two entries, with the same values, are in
  the critic's run of round 2's code.
- **line inversions in the organist's variations (seeds 77, 119)**: the
  organ's voices are not held to one order across each other (Known
  issues). Every guest held to a line has 0.

0 console errors or warnings in every run (and 0 exceptions in the
checker). The Hosanna: the engine sent 308 Hosanna notes in seed 37's
doxology run, and none was drawn, at either width.

**One even tone, in device pixels** (`tone.py`): frozen frames (the page's
animation held for the capture, so the probe and the pixels are the same
frame), after on this code beside before on round 2's (a scratch tree of
links to this worktree with only `kolob-viz.js` put back to `8e3ccc21`,
served on its own port). For every drawn note with an alpha under 0.985,
clear of the clefs' fade, its own ink pixels (its boxes from
`probe("ink")`, less the staff lines' rows and every other ink's box): the
note's own tone is the commonest value among them; a pixel darker than
that by more than 6 levels (of 255, in green) is ink laid twice.

| frozen frame | width | notes with ink laid twice, before (round 2) | after |
|---|---|---|---|
| the handcart company (seed 41, postlude +30 s) | 860 | 27 of 32 (worst: 124 pixels darker, 137 in a 194 note) | **0** of 31 |
| | 390 | 3 of 10 | **0** of 9 |
| the organist's trio (seed 55, postlude +45 s) | 860 | 56 of 56 | **1** of 56 — two voices' stems a pixel apart (two notes, each one tone) |
| | 390 | 10 of 12 | **1** of 12 — the wheel's rim over the plate's corner (not ink) |
| our hymn given out by the organ (seed 57, hymn +13 s) | 860 | 18 of 37 | **0** of 18 |
| | 390 | 9 of 22 | **0** of 12 |
| the far tower (seed 53, +20 s from PLAY) | 860 | 1 of 2 (the organ) | **0** of 2 |
| | 390 | 0 of 6 | **0** of 6 |
| the far ward over our hymn (seed 44, hymn +75 s) | 860 | 0 of 17 | **0** of 17 |
| | 390 | 0 of 3 | **0** of 3 |

(Fewer notes after in two frames: the giving-out printed once instead of
two or three times, and a note set past its time now waits for the burin.)
The frames and their probes are under the scratchpad `r3c-engrave2/out/`,
`tone-<tag>/` and `base-tone-<tag>/`; the close pair is in the details
sheet below.

**The frame, CPU throttled 4x, 390 px** (the page, each run alone in the
browser, 30 s of frames after the dev jump; an empty page's baseline
first):

| passage | width | frames | rAF p50 / p99 / max | work a frame (round 2, the critic's run this afternoon) | long tasks | console |
|---|---|---|---|---|---|---|
| an empty page (seed 1, the prelude) | 390 | 1202 in 20 s (60 fps) | 16.7 / 16.8 / 16.8 ms | 0.82 ms (0.78) | 0 | 0 errors |
| two bands crossing (seed 22, hymn +50–80 s) | 390 | 1801 in 30 s (60 fps) | 16.7 / 16.8 / 16.8 | 2.33 ms (1.51) | 0 | 0 errors |
| the Social Hall (seed 22, postlude +45–75 s) | 390 | 1802 (60 fps) | 16.7 / 16.8 / 16.8 | 1.81 ms (1.19) | 0 | 0 errors |
| the trio (seed 55, postlude +40–70 s) | 390 | 1802 (60 fps) | 16.7 / 16.8 / 16.8 | 2.30 ms (1.35) | 0 | 0 errors |
| the far ward over our hymn (seed 44, hymn +70–100 s) | 390 | 1800 (60 fps) | 16.7 / 16.8 / 33.4 | 3.23 ms | 0 | 0 errors |
| the canon (seed 77, postlude +55–85 s) | 390 | 1801 (60 fps) | 16.7 / 16.8 / 16.8 | 1.89 ms | 0 | 0 errors |
| the gift of tongues (seed 5, testimony +30–60 s) | 390 | 1801 (60 fps) | 16.7 / 16.8 / 16.8 | 1.30 ms (1.12) | 0 | 0 errors |
| the far tower (seed 53, +15–45 s) | 390 | 1802 (60 fps) | 16.7 / 16.8 / 16.8 | 2.09 ms | 0 | 0 errors |

The page took every frame the browser gave it, at 60 fps, twice the
floor; the busiest (the far ward's pale chords over our hymn, a hundred and
more impressions a frame) dropped one frame in 30 s. Striking each note on
the proof sheet and laying it once costs about 0.4–0.9 ms a frame at 4x
(the round-2 figures beside), under a fifth of a 60 fps frame.

## Before and after (muted headless Chrome, the page itself)

**Before** is round 2's code as the critic ran it this afternoon (the same
seeds, jumps and seconds; its frames under
`/private/tmp/claude-501/kolob-r3c-engrave-critic/r2c/out/<tag>/`), and for
the organ's giving-out a frozen frame of round 2's code (scratchpad
`r3c-engrave2/out/base-tone-open57/`). **After** is this code (scratchpad
`r3c-engrave2/out/fin-<tag>/`, with each run's `result-<width>.json`: the
checks, the placement log, the console). Three sheets beside this note:

- `handoff/r3c-engrave2-sheet-860.png`: a row per guest (and our hymn's
  giving-out and slurs), before on the left, after on the right, 860 px;
- `handoff/r3c-engrave2-sheet-390.png`: the same at 390 px (the phone);
- `handoff/r3c-engrave2-details.png`: close pairs, before left and after
  right: a pale sixteenth at 4x (one tone), the giving-out, our hymn's
  slurs and ties by voice, a singer's run under its slur, the canon.

(Round 2's own sheets, `r3c-engrave-2-sheet-*.png` and
`r3c-engrave-2-details.png`, belong to `archive/r3c-engrave-1.md` and are left as
they were.)

## Requests

1. **To the owner:** the band's sliding layer (finding 6 above): keep it
   sliding at the band's own pace, or scroll it with the page?
2. **To the critic / the integrator (tools):** the in-page checker is worth
   keeping as the staff's standing check (`crit.js`, `incheck.js`,
   `summ.js`, `table.js`, `tone.py` in the scratchpad `r3c-engrave2/`). Two
   notes on reading it: capture with `captureBeyondViewport: false` (a
   capture that resizes the page re-sets every note once, at the shot's
   instant, and reads as notes "moving"); and key a curve by its `q1` as
   well as its start (two voices' ties can start together).
3. **To the organ crew (variations), still open from round 1:** the
   re-barred dances carry no `beat`, so they print with no bars.
4. **To the drone-waveform crew (`kolob-drone`), for the merge:** this
   round's hunks outside the guests' section: `takeLayer` (the two-voices
   rule after its groups), `takeHymnLine` (`givenOut`, `x.two`, `vside`,
   the curves' `vside`/`line`), `layoutGroup` (the up-stem flag rule, `fk`
   both ways), `koRect`/`koEllipse` (`koA`), `drawBeam` (no alpha of its
   own; returns its box; stops at the burin), `drawMarks` (bars and rests
   wait for the burin), `barExtents` (one line), `drawTieOrSlur`,
   `tieShape`, `settleCurve`, `setNow`, `prints`, `struck`, `slurFit`,
   `curveCross` (one block), `clearance` (`barAfter`, `slurHit`: three
   lines), `barAfter`, `slurHit` (new), `drawPage` (the impressions),
   `impress`, `stamp` (new), `drawBand` (stamped), `resize` (the proof
   sheet), `probeInk` (a curve's `q1`, `side`). Nothing draws the `"drone"`
   layer.

## Known issues

- **One far-ward note touches one of our heads, one moment (seed 10,
  860 px only, 7:05 into the meeting: 224.1 s over 225.1 s).** Finding 5's
  first part, left as round 2 left it; its cure put a bar on ink (above).
  It is the only head struck by a guest in any passage measured.
- **One slur of ours touches a pale far-ward head (seed 10, 860 px only,
  227.7 s).** The far choir's chord, a line behind, was set late just
  before our slur's last note, across the slur's path; the refit within
  a slur's bounds (a space at the ends, 2.2 of depth) couldn't clear it,
  and past those bounds a slur no longer reads as its notes'. Tried and
  dropped: every slur fitted to every head in its span, and a far note
  keeping clear of our open slurs' forecast path — both measured worse
  (more far-ward notes moved on, and one of them onto our head).
- **Our own hymn, in the guest passages' runs (the house's, unchanged, the
  same on round 2's code):** heads a third apart in one chord touching (the
  stacked third, `STACK`: the checker counts them as heads struck — seed 44
  18 / 12, seed 10 24 / 24, seed 57 2 / 2, seed 37 30 / 8); and where the
  hymn runs quicker than the page can hold at the notes' cap (2.4 spaces),
  a bar squeezed between the notes either side of it: seed 44's first 40 s,
  before the far ward sings (9 / 6 bars touching ink), and seed 37's
  doxology at 1:27–1:31 (8 / 2). The critic's run of round 2's code found
  the same bars at the same instants; the rest of seed 37's (the organ's
  opening) are gone with the doubled giving-out.
- **The organist's variations still stand late where the set is
  densest.** Seed 77: 5.7 sp at 860, 3.5 at 390 (the two keys' interlude;
  round 2's code 14.4 / 5.0); seed 55's trio 3.7 / 3.0 (round 2: 6.2 /
  3.3). Seed 119's canon, the worst found: 12.2 sp at 860, 6.5 at 390
  (round 2's code, measured beside it: 14.3 / 6.9, with 122 / 112 notes
  printed ahead of the burin and bars every half bar; now 0 ahead and the
  leader's bars) — three voices at once on the bass staff, each stepping
  aside for the others, and each bar pushed by the late notes before it.
  It catches up at the next rest. The cure I'd try next is the keyboard's
  own: at one instant, no more than two voices to a staff (the third
  joined to the one whose stem it shares). The organ's voices are not held
  to one order across each other (held so, they ran away in round 2), so
  a voice's quick note set late can stand after another voice's next note.
- **A curve is drawn whole when its last note is struck**, no longer
  stroke by stroke: a long run's slur appears in one stroke over the run
  as the run's last note prints. It then never changes.
- **A note set past its time is struck when the burin reaches it** — for
  our hymn up to 2.4 spaces (about 0.4 s) after its sound, for a crowded
  guest more (the far ward up to 7.5 spaces). Before, it was printed ahead
  of the burin the moment it sounded.
- **In the trio, a figure note under a chord note** can put their two
  stems (one up, one down) a pixel apart for a moment: two notes, each one
  tone, reading as one thicker stem.
- At 390 px the wheel's rim overlaps the plate's lower-left corner (the
  page's layout, not the staff's; noted only because the tone check sees
  it).
