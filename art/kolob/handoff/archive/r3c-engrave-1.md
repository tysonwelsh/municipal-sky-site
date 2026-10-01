# r3c-engrave-1: the new guests on the staff

*ENGRAVE crew, round 3c. Branch `kolob-r3c-engrave`, from `kolob-r3c` at
`13ac495`. 2026-09-29. The only file changed is `kolob-viz.js` (`kolob.css`
needed nothing; no engine file was touched). VERSION is not bumped. Revised
the same afternoon after a second look (§ "The second look" below): no head
has another note's stem, flag, ledger or beam drawn across it, and every
guest was re-captured, before and after, on the final code.*

## For the owner, in plain words

**What is new to see: the staff no longer sits blank under round 3c's
guests.** Each one now prints in the page's own ink and shapes, the far ones
paler, as the far trombone choir and the old tune already are. Nothing is
written in words, everything is green, nothing moves but the scroll and the
drying, and every head is one clean strike — with nothing of another note
(a stem, a flag, a ledger, a beam) drawn across it.

- **The far tower's change ringing** — every stroke of every bell is a
  small, pale ringed head (the way the steeples' bells print). Rounds look
  like a little staircase of heads going down the scale, over and over; when
  the ringers start the changes you can see the staircase's steps swap
  places, a pair at a time. That *is* the method, readable from the heads.
- **The handcart company** — "All is well" in unison, the women (and the
  child) on the treble and the men and the captain an octave below on the
  bass staff, the same tune twice in octaves. Pale, because they are far off,
  palest at the two ends of the road. It is in the company's own key, with
  its written note values (dotted rhythms and all).
- **The gulls** — each cry is a small head with no stem (a cry keeps no
  beat). The lead gull's cries are in the first hymn's own shapes, on the
  hymn's own notes: you can see it quoting the hymn's opening. The rest of
  the flock's chatter prints as small round heads, a stranger's notes.
- **The far ward** — the other congregation across the valley prints in
  pale, small four-part notes, a line behind our own hymn. On each beat the
  two share, ours is set first and theirs steps aside, so no head of either
  has the other's stem, flag or ledger across it (one exception, found over
  every guest's whole passage at both widths: see Known issues).
- **The Social Hall** — the fiddle's dance prints like a fiddler's tunebook:
  small heads (it runs faster than the page can print full-size ones), the
  hymn's own notes inside the tune slightly heavier (the house's way of
  marking a tune), the running eighths beamed three to a beat in a jig and
  two in 2/4 (where a beam would run across one of the caller's crosses or
  the drone's note, it goes on the other side of its notes instead, the
  stems turned), a barline at every bar, a double bar wherever a strain repeats
  or the next strain begins, and the final bar after the last chord. The
  fiddler's cuts and slides are marked with the small signs the Old Way uses.
  The open string the fiddle drones on is a small whole note under the
  tune. **The caller's calls print as crosses** (spoken, not sung).
- **The testimony-bearers** — their speech-melody prints as crosses at the
  pitch they speak on, with no stems (speech has no beat); a stressed
  syllable is a slightly heavier cross. When the harmonium or the clarinet
  plays their words back, its notes are small stemless heads (it keeps the
  words' rhythm); when it then makes a tune of them, that tune prints as a
  tune, with stems and values.
- **The gift of tongues** — the singer's free song is one line on the staff
  it suits, with a slur over each melisma; the quick notes of a melisma are
  a singer's run in small beamed notes. The ward's hummed chord at the end
  prints once per part (one head however many voices hum it).
- **The organist's variations** — the organ alone, as before, but now with
  **barlines through both staves wherever the hymn's own bars fall** (the
  chorale, the trio, the two-keys interlude, the finale). The trio's running
  right-hand figure is smaller and beamed in pairs so the tune in the pedals
  stands out (its beam turned to the other side of its notes wherever it
  would have crossed a chord's head),
  and in the two-keys interlude the pedal's own bass line (in the
  other key) now prints too. The re-barred dances keep no bars rather than
  wrong ones.
- **The Hosanna prints nothing**, as you ruled. (Checked: not one note of it
  reaches the page.)

### How to see it

Open a seed and press PLAY; wait for the time, or use the wheel's dev jump
to the section and wait the offset. `&guest=<name>` asks for a guest in the
first meeting of any seed.

| guest | seed | when (from PLAY) | or: jump to, then wait |
|---|---|---|---|
| the far tower (Christmas) | 53 | 0:07 – 1:10 | — |
| the far ward | 44 | 4:39 – 5:17 | hymn, ~70 s |
| the gulls | 50 | 8:59 – 9:05 | testimony, ~85 s |
| the gift of tongues | 5 | 6:26 – 7:12 | testimony, ~20–60 s |
| the testimony-bearers | 3 | 8:02 – 9:40 | testimony, ~10–100 s |
| the handcart company | 41 | 14:23 – 15:04 | postlude, ~15–55 s |
| the organist's variations | 55 | 14:25 – 16:30 (trio ≈14:56, two keys ≈15:36, finale ≈15:51) | postlude, ~5–130 s |
| the Social Hall | 22 | 16:13 – 17:28 | postlude, ~13–88 s |
| the band and a second band (unchanged) | 22 | 3:24 – 4:32 | hymn, ~16–84 s |
| the Hosanna (prints nothing) | 37 | 18:33 – 19:19 | doxology, ~140–185 s |

## What shipped (`kolob-viz.js`)

A new section, **THE NEW GUESTS ON THE STAFF**, after the old tune and
before the hymnal, holds everything guest-specific, one function per guest:

- `takeNewGuests(byLayer)` — called once from `flushIntake`. Takes whole the
  layers of their own (`tower`, `handcart`, `gulls`, `farward`, `fiddle`, and
  `voice` notes with `speech: true`), and pulls out of the house's layers
  what the notes say is a guest's: the caller (`choir`, `guest:
  "socialhall"`), the gift's song and hum (`choir`, `guest: "tongues"`,
  `role` `tongues` / `hum`), the testimony reeds' words (`harmonium` /
  `clarinet`, `testimony: true`, `move` `echo` / `double`), the variations
  (`organ`, `variations: true`). Everything else prints as before.
- `keyedQ(freq, keyM, deg, monzo, mode)` — a note's staff place and shape in
  a key of its own, from its degree, else its interval, else its sound (the
  octave from where it sounds).
- `takeTower` (ringed heads, scale 0.45, ink 0.5 / 0.32 muffled),
  `takeGulls` (stemless, 0.6 lead in the hymn's shapes / 0.5 chatter round,
  ink by `loud`), `takeFarWard` (closed score, strict parts, grace size 0.6,
  ink 0.42, the verse's beat, placed by `deg` in the hymn's key),
  `takeHandcart` (+`companyKey`: the key read from the notes among the
  day's, the dominant's and the subdominant's; written lengths from `beat`;
  one head per unison across the throats' separate calls; ink 0.18–0.56 by
  `loud`), `takeFiddle` (+`fiddleEighth`, `fiddleBars`, `fiddleBar`,
  `fiddleBeams`: scale 0.55, `tune`/`cad` heads heavy, `cut` → the grace
  sign, `slide` → the slide sign, drones as whole notes, bars from
  `strain`/`time`/`line`/`bar`, beams by the beat), `takeSpoken` (the
  x-head, stemless, `accent` heavy; the bearers and the caller),
  `takeReedWords` (stemless reed heads; a `double` on the speaker's own
  place shares the speaker's head), `takeTongues` (one line, slurs over
  melismas, quick melisma notes at 0.55 and beamed), `takeHum` (a head a
  part, across calls), `takeVariations` (+`varFigures`: the beat read across
  the organist's one-chord calls; bars through both staves where
  `(beat + line.barStart) % bar == 0`; the pedal printed where no `B` note
  doubles it — the bitonal bass; the running figure at 0.75, beamed within
  the beat across calls, only while no member has been set).
- **The glyph atlas:** `SH.x` (the spoken cross: one filled 12-point path,
  struck once like every head), its `ANCH` and `HEAD_EXT`.

Small hooks elsewhere (each a line or two, kept apart for the drone
waveform's merge):

- `onNote`: rejects `n.hosanna` as well as `logged: false`; lets the new
  layers and speech in; lets the variations' pedal through (the doubling is
  judged in `takeVariations`).
- `flushIntake`: `takeNewGuests(byLayer)` before the house's generic loop.
- `takeLayer`: `opt.qOf` (a guest's own placement), `opt.head` (a guest's
  mark on a head), `opt.scale`.
- `clearance`: a new guest's note (`gr.cap`) keeps within its own cap as a
  hymn's does, with the hymn's close air (`gr.tight`); **past its cap a
  guest's note never stands on a bar (or within 0.2 sp of one), and no head
  of it or of another note is struck through by the other's ink — a stem, a
  ledger, a flag, a sign, a beam, a head: there it goes on past** (`onBar`;
  `onHead`, which since the second look tests any ink against any head,
  either way round, with all of the other note's ink, a hymn's ledgers
  too; `beamHit`). A guest's note also keeps its heads out from under a
  guest's beam already laid (`beamHit`, in the clearance's own passes).
- `setDue` / `drawPage`: the far ward's notes (`gr.yields`) are set just
  after ours of the same beat (`YIELD_LAG`, 80 ms); one that falls within
  0.7 s before a bar of ours waits until that bar is placed, and (second
  look) one sung up to 0.45 s before a note of ours waits until ours is
  set (never for a note of ours that will not print), then keeps clear of
  it (`barWaits`).
- `prepGroup` (one line — every path that sets a note comes through it: a
  note falling due, a note drawn, a bar making room): a guest's beam is
  looked along before it is laid; where it would cross another note's head,
  one set or one coming in its span, it is laid on the other side of its
  notes (the stems turned), and only where that side is crossed too is it
  not laid, its notes keeping their flags (`beamLay`, `beamBlocked`). The
  variations' figure joins a beam across the organist's calls only while
  the beam has not yet been looked along.
- `clearance`: a guest's note may take up to 8 passes to find its place
  (the hymn keeps its 4): beams are one more thing to clear.
- `probe("ink")` (dev): every drawn note's ink boxes (and, since the second
  look, what each box is: head, ledger, stem, sign, or a flag or dot), every
  drawn beam in half-space slices, and every placed bar's ink, in page px;
  `probe()` also gives each group's offset (`dx`), each bar's placement
  (`rel`, `nx`), and how many guest beams were laid, how many of those
  turned to the other side, and how many not laid, and for what (`beams`).

## The second look (the same afternoon)

The first pass checked heads printed over heads and bars on ink, but not
**another note's stem, ledger, flag or beam drawn across a head**. Zoomed in
on the far ward's frames, a pale far-ward stem ran straight through one of
our open diamonds, with a far head tucked between two of ours on our stem:
exactly the second stroke the owner ruled out. Neither the page's rule nor
the check could see it (the rule past a guest's cap tested heads against
heads only, and beams are in no note's ink boxes). A new check,
`strokecheck.js` (scratchpad `r3c-engrave/`): every animation frame, from
`probe("ink")`, any head of one note crossed by more than 0.1 sp both ways
by any ink of another on its staff — its head, stem, ledger, flag, sign, or
a beam (in quarter-space slices) — counted once per pair of notes, where a new
guest is on at least one side:

| guest (seed), each whole passage | heads struck through, before (860 / 390 px) | after |
|---|---|---|
| the far ward over our hymn (44) | 9 / 3 (its stems through our heads, ours through its, its parts through each other) | 0 / 0 |
| the far ward over our hymn (10) | 7 / 5 | **1** / 0 (see Known issues) |
| the far tower (53) | 5 / 0 (the harmonium's and clarinet's stems and flags through the rings) | 0 / 0 |
| the Social Hall (22) | 2 / 2 (fiddle beams across the caller's crosses) | 0 / 0 |
| the Social Hall (9, forced) | 8 / 2 (beams across crosses and the drone's note; a stem) | 0 / 0 |
| the variations (55) | 5 / 0 (the running figure's beams across the chords' heads) | 0 / 0 |
| the gulls, the company, the bearers, the gift, the bands | 0 / 0 | 0 / 0 |

("Before" is the first pass's code for stems, ledgers, flags and heads; the
beams were counted once the check could see them, on the first try at the
fix, which did not yet touch beams. Our own hymn's close voicings — its
stacked thirds, 6 and 12 — are the house's, unchanged, and not counted.)

What changed (`kolob-viz.js`, in this branch's own hunks and one line of
`prepGroup`): the rule past a guest's cap now tests any ink against any
head, either way round (`onHead`), and beams (`beamHit`); a guest's note
keeps its heads out from under a guest's laid beam; a guest's beam is
looked along before it is laid and, where it would cross a head, goes to
the other side of its notes, or, where both sides are crossed, is not laid
and its notes keep their flags (`beamLay`: in the final code every guest
beam is laid, some turned — see below — and none is left unlaid); and a
far-ward note sung up to 0.45 s before one of ours waits for ours to be set.

Tried, measured and dropped: a far note waiting for every note of ours it
might reach, and a far note keeping clear of where our notes not yet set
will stand (both pushed the far ward further from its time, to 8.6 and
12 sp, into notes the engine had not yet handed over, and put bars back on
ink); and unlaying every crossed beam rather than turning it (in the
organ's trio each unbeamed note of the running figure grew a flag into the
next, and the organ's notes were pushed as far as 14 sp from their time).

The cost, measured: the stricter rule sets some guest notes a little
further from their time — the organ's largest offset in the variations is
7.0 sp at 860 px where it was 4.9 (2.5 → 3.9 at 390), the far ward's in
seed 10 7.5 where it was 6.6 (in seed 44 5.3, where it was 5.5), and more
far-ward notes stand off their time (Known issues); the second dance's
fiddle is nearer its time than before (4.1 sp where it was 4.9), its beams
kept; everything else within a few tenths of before (the table below).

## How it was checked (all muted)

Two instruments, both muted headless Chrome over CDP:

1. **The replay lab** (scratchpad `r3c-engrave/lab/lab.html`, from r3b's): a
   harness dump replayed into the real `kolob-viz.js` with a stand-in
   `KolobAudio` — the same notes and events the engine sends, at the same
   audio times — for before/after frames at 860 and 390 px, and for
   `barcheck.js`: every animation frame, each placed bar's ink against every
   drawn note's ink boxes on its staves (between the staff's lines and half
   a space beyond), over the whole of each guest; and (second look)
   `strokecheck.js`, every head struck through by another note's ink,
   beams included. The lab runs a dump faster than life (2× for the final
   tables, 4× for the first pass's); the page runs at 1×.
2. **The page itself** (`tools/screens.js` with a `--query` option, scratch
   copy `screens3c.js`): the listening seeds with the wheel's dev jump,
   frames at 860 and 390 px, and the frame cost with the CPU throttled 4×.

Dumps (the harness, `dump=`): seeds 22 (the bands, the Social Hall), 53
(the tower), 44 and 10 (the far ward), 50 (the gulls), 41 (the company), 55
(the variations), 5 (the gift), 3 (the bearers), 37 (the Hosanna), 9 with
`force=socialhall` (a second dance). All harness runs PASS, 0 errors.

**Bars touching ink, heads struck through, and how far a note stands past
its time** — the final code, every animation frame of the whole of each
guest, at 860 / 390 px, the replay lab at 2× (`barcheck.js` for bars on
ink: a placed bar's ink against every drawn note's ink between its staff's
lines and half a space beyond; `strokecheck.js` for heads, as above):

| guest (seed) | bars touching ink | heads struck through | largest offset past a note's time |
|---|---|---|---|
| the Social Hall (22) | 0 of 66 / 0 of 66 | 0 / 0 | fiddle 3.0 / 2.6 sp, the caller's crosses 3.6 / 2.4 |
| the Social Hall (9, forced) | 0 of 98 / 0 of 98 | 0 / 0 | fiddle 4.1 / 3.0 sp, crosses 3.2 / 2.6 |
| the variations (55) | 0 of 72 / 0 of 72 | 0 / 0 | organ 7.0 / 3.9 sp |
| the far ward over our hymn (44) | 0 of 30 / 0 of 30 | 0 / 0 | far ward 5.3 / 5.6 sp; our hymn 2.4 / 2.3 |
| the far ward over our hymn (10) | 0 of 37 / 0 of 33 | 1 / 0 (Known issues) | far ward 7.5 / 6.1 sp; our hymn 3.9 / 3.4 |
| the band and a second band, the ward's page (22) | 0 of 34 / 0 of 34 | 0 / 0 | (the bands are on their own layer) |
| the far tower (53) | no bars | 0 / 0 | rings 2.7 / 2.2 sp; the house's harmonium 3.4 / 2.4 |
| the handcart company (41) | no bars | 0 / 0 | 2.0 / 1.2 sp |
| the gulls (50) | no bars | 0 / 0 | 2.0 / 1.8 sp |
| the testimony-bearers (3) | no bars | 0 / 0 | crosses 2.5 / 0.5 sp |
| the gift of tongues (5) | no bars | 0 / 0 | 2.2 / 1.0 sp |
| the Hosanna (37) | no bars | — | nothing drawn at all, 18:30–19:20 |

Guest beams laid (and of those, turned to the other side of their notes),
the final code, 860 / 390 px: the first dance 61 (5 / 4 turned), the second
176 (39 / 34), the variations' figure 72 (19 / 16), the gift's runs 14 (0);
none left unlaid.

0 console errors in every one of these runs. (Before this round's fixes,
with full-size fiddle heads, 25 of the dance's 66 bars stood on a downbeat
head; the far ward's pale notes, pushed along by ours, crowded 6 of 30 of
our bars; and the far tower's rings, the far ward and the trio printed 14,
21 and 7 heads over other heads.)

**The frame, CPU throttled 4×, in the page** — the final code
(`screens3c.js`, the dev jump, 30 s of frames after the capture; the
machine's load average 3–4; the runs' reports under the scratchpad
`r3c-engrave/v2/fps/<tag>/report.md`):

| the busiest guests | width | frames in 30 s | rAF interval | p50 | p90 | p99 | max | long tasks | console |
|---|---|---|---|---|---|---|---|---|---|
| two bands crossing (seed 22, hymn +50–80 s) | 390 px | 900 | 33.3 ms (30 fps) | 1.1 ms | 1.5 ms | 1.9 ms | 2.4 ms | 0 | 0 errors |
| | 860 px | 900 | 33.3 ms | 1.5 ms | 1.9 ms | 2.4 ms | 4.1 ms | 0 | 0 errors |
| the Social Hall's dance (seed 22, postlude +45–75 s) | 390 px | 900 | 33.3 ms (30 fps) | 1.4 ms | 1.8 ms | 2.4 ms | 3.0 ms | 0 | 0 errors |
| | 860 px | 900 | 33.3 ms | 1.4 ms | 1.8 ms | 2.3 ms | 3.5 ms | 0 | 0 errors |
| the variations (seed 55, postlude +40–70 s) | 390 px | 901 | 33.3 ms (30 fps) | 1.1 ms | 1.5 ms | 2.0 ms | 2.6 ms | 0 | 0 errors |

A frame's cost is its requestAnimationFrame callbacks (the staff and the
wheel); the worst frame at 390 px is 3 ms, under a tenth of a 30 fps
frame's 33 ms. The pace is the browser's, not the page's: this afternoon
headless Chrome gave even an empty page a frame every 33.3 ms (measured
beside these runs, `rafbase.js`: 120 frames in 4 s, median 33.3 ms), and
the page took every frame it was given; in the first pass, when the browser
paced at 16.7 ms, the same guests ran at 60 fps (1,800 frames in 30 s, p99
1.9–2.5 ms).

**Nothing moves once printed.** Every placement is made once, when a note
falls due (`setDue`), and kept; the new rules only choose where a note is
first set (its cap, a bar's room, a far note waiting for our bar or our
note). A guest's beam is looked along, and turned or left unlaid, before
any of its notes is set, and once looked along takes no new member; a beam
joined across the organist's calls takes a new member only while none of
its notes has been set. The only motion is the scroll and the drying.

**The Hosanna:** the lab replays seed 37's whole Hosanna (415 notes, all
`logged: false`, `hosanna: true`) — 0 groups printed at 18:55 and 19:15, at
both widths; `onNote` now refuses `n.hosanna` too, so it stays off the page
even if its `logged` or `ENGRAVE_HYMN` ever changed. In the page (seed 37,
the doxology jump): see the frames below.

**Console:** 0 errors or warnings in every lab frame (the first pass: 48
after, 16 before; the second look: 36) and every lab check (the final
code: 46 runs), and in every page run (the second look: 20 before/after
runs, 40 widths, and 3 frame-cost runs).

## Before and after (muted headless Chrome)

**On the page, every guest, before and after** (the final code). Each
listening seed was run in the page itself twice: once as this branch serves
it (**after**), and once from a scratch tree of links to this worktree in
which only `kolob-viz.js` is put back to the branch's start, `13ac495`
(**before**) — the same engine, seed and dev jump; only the page differs.
Two contact sheets are committed beside this note, a row per guest, before
on the left and after on the right:

- `handoff/archive/r3c-engrave-1-sheet-860.png`
- `handoff/archive/r3c-engrave-1-sheet-390.png` (the phone)

The frames themselves, each run with its `report.md` (console: no errors or
warnings, before and after, in every run), are under the scratchpad
`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3c-engrave/v2/`,
as `{before,after}/<tag>/staff-<width>-t<seconds>.png`:

| guest | tag | seed, jump | seconds after the jump (the tower: after PLAY) | before → after |
|---|---|---|---|---|
| the far tower | `tower53` | 53, none | 20, 45 | nothing above the house's notes → the rounds' stair of small pale ringed heads (20), the changes (45) |
| the testimony-bearers | `bear3` | 3, testimony | 20, 40 | no speech, the reed's echo as a false tune → the words as crosses on the bass staff, the reed's words small and stemless above; the reed's own tune (40) as before |
| the handcart company | `cart41` | 41, postlude | 30, 50 | blank → two pale lines in octaves, palest on the approach |
| the gift of tongues | `gift5` | 5, testimony | 40, 62 | a row of flagged full heads and the hum a head per throat → one line, slurred melismas, small beamed runs; the hum a head a part (62) |
| the Social Hall | `dance22` | 22, postlude | 20, 45 | nearly blank → the reel: small heads, beamed runs, bars and double bars, the caller's crosses |
| the band and a second band | `bands22` | 22, hymn | 30, 50 | the same, before and after (the bands' own layer) |
| the gulls | `gulls50` | 50, testimony | 88 | nothing → small stemless heads above the staff |
| the far ward | `far44` | 44, hymn | 75, 95 | our hymn alone → small pale chords set just after ours |
| the organist's variations | `var55` | 55, postlude | 45, 85, 110 | unbarred flagged notes, the other key's bass missing → bars through both staves, the figure small and beamed, the bitonal bass |
| the Hosanna | `hos37` | 37, doxology | 150, 175 | an empty staff, before and after |

**The second look, in the replay lab** (the first pass's code against the
final code, at the moments the second look is about; lab frames under the
same scratchpad, `shots/look2-first/` and `shots/look2-final/`,
`<dump>-<width>-t<seconds>.png`, 860 and 390 px): the far ward over our
hymn (`farward44` at 292 and 312 s, `farward10` at 428.5), the far tower
(`changes53` at 45), the dances (`hall22` at 1025, `hall9` at 936 and 991),
the variations' figure (`variations55` at 910 and 945).

**The first pass's lab frames** (every guest, its own dump replayed into
the branch's starting `kolob-viz.js` and into the first pass's) stay under
`shots/before/`, `shots/before2/` and `shots/final/`, as listed in that
pass: `changes53`, `farward44`, `gulls50`, `hall22`, `handcart41`,
`testimony3`, `tongues5`, `variations55`, `hosanna37`, `bands22`.

## Requests

1. **To the owner:** whether the speech crosses read as speech to you (the
   testimony-bearers and the Social Hall's caller). The alternative is the
   ordinary shapes, stemless; the cross is the old music way of writing a
   spoken syllable, and it is one filled mark (no second stroke).
2. **To the organ crew (variations):** the re-barred dances (the minuet in
   3/4, the march in 2/4, the polonaise) carry no `beat`, so they print with
   no bars. A `bar` and `beatInBar` on their notes (as the band's have)
   would let the page bar them too.
3. **To the handcart crew:** the company prints with no barlines (its notes
   say `beat` and `line`, but not where each line starts in the bar). A
   `barStart` per line, or `K.getHymn("earth:all-is-well")` answering with
   the tune's Score, would let it print its 3/4 bars.
4. **To the testimony (hall) crew, FYI:** the reed's `double` plays an
   octave above a bass speaker (not with him), so it prints as its own small
   heads above the speaker's crosses; a `double` on the speaker's own place
   would share his head.
5. **To the tools (the integrator):** the scratch `barcheck.js` (every frame,
   each placed bar's ink against every drawn note's ink, from
   `KolobViz.probe("ink")`) and `strokecheck.js` (every frame, any head
   crossed by another note's ink — stem, ledger, flag, sign, head or beam)
   could join `tools/` as the staff's standing checks for the owner's two
   rules; `screens.js` could take a `--query` for the guest switch (the
   scratch copy `screens3c.js` does). The replay lab runs a dump at 2–4×;
   which notes fall due in one frame changes a little with the speed, so
   counts can differ by a note between runs — the page itself runs at 1×.
6. **To the drone-waveform crew (branch `kolob-drone`), for the merge:** this
   branch's hunks outside its own new section are single lines or a few:
   the atlas (`SH.x`, `ANCH.x`, `HEAD_EXT.x`), `onNote` (three lines),
   `flushIntake` (one), `takeLayer` (three), `clearance` (its pass count
   and a few lines at its end), `setDue` and `drawPage` (one each),
   `prepGroup` (one), and, beside `onBar`, this branch's own placing helpers
   (`onHead`, `barWaits`, `beamLay`, `beamBlocked`, `beamHit`); `probe` and
   `probeInk`. Nothing draws the `"drone"` layer. (The
   Social Hall's `part: "drone"` is the fiddle's open string on the `fiddle`
   layer, printed as a note — not the meeting's drone.)

## Known issues

- **One head struck through remains, in all the passages measured.** Seed
  10, the far ward over our hymn, at 860 px only: at 7:07 (427.18 s) the
  flag of a far-ward eighth sung a second earlier (426.16 s) touches one of
  our heads. That far note had no room near its time, went on past its cap
  to just before our next note, and our note — which keeps to its own cap,
  as the hymn always has — was then set onto its flag. The two cures tried
  (the far note waiting for every note of ours it might reach; keeping
  clear of where ours will stand) each made several more, pushed the far
  ward up to 8.6 and 12 sp from its time and put bars back on ink, so they
  were dropped (see "The second look").
- **Quick guests stand a little after their time where the page is full.**
  At 60 px/s a jig's eighths are a staff space apart, and each bar needs
  about one more. Each new guest's note keeps within its own cap (the fiddle
  3 sp, the variations 2, the far ward 1.5), and goes past it only rather
  than stand on a bar or strike a head: measured, the fiddle up to 3 sp at
  860 px (4.1 in the second dance), the organ in the variations up to
  7.0 sp at 860 (3.9 at 390), the far ward up to 5.3 and 7.5 sp. Since the
  second look more far-ward notes stand off their time: set more than 3 sp
  (half a second) after it, 32 of 155 in seed 10 (21 before) and 33 of 102
  in seed 44 (21 before). The far ward's note may print after one of our
  bars though it sang just before it (it waits for the bar, then keeps
  clear).
- **A far-ward note may appear a moment behind the burin**: up to 0.7 s
  where it waits for a bar of ours, and up to 0.45 s where it waits for a
  note of ours sung just after it. It prints once, where it will stay.
- **Under the far tower the house's clarinet and harmonium step aside from
  the bells' rings** (up to 3.4 sp at 860, seed 53) rather than print over
  them; and **our hymn steps aside for a far-ward note** set just before its
  own (seed 10: our largest offset 3.5 sp against 2.2 without the far ward;
  seed 44: 2.3 either way). The alternative, each ignoring the other, printed
  heads over heads (14 in seed 44), which is the blur the owner ruled out.
- **The bands' barlines slide over the ward's ink as they cross.** A band's
  layer scrolls at its own quicker rate (round 2's design, kept), so its
  pale bars pass over the ward's page and the other band's notes; within its
  own layer each band's bars stand clear of its own notes. The bar check
  above is the ward's page (every guest this round prints there).
- **The fiddle and the gift's runs print small** (0.55 of a head): smaller
  heads are what let the bars stand clear at the page's rate. At 390 px they
  are small but distinct at the phone's resolution.
- **The Old Way's grace sign stands for the fiddler's cut** (a grace a step
  above, slashed): the nearest sign the page already has.

## Round 2 (the critic's findings answered)

*The same branch, the evening of 2026-09-29. Only `kolob-viz.js` changed
(`kolob.css` and the engine untouched); VERSION not bumped. The four
blocking findings, the significant one and the polish are fixed, most in
the house's own drawing (a flag, a slur, a beam), so the rule holds for
every note and not only the guests'. The minor one (§6) is not: its cure
put one of our bars on ink, measured, and I explain why I left it. The
band's sliding layer (§8) is left for the integrator, as the critic
proposed.*

### For the owner, in plain words

**Every new guest's note is now one clean strike, including four kinds
that weren't** (with one exception: a single far-ward note in one seed,
explained below). Here's what you'll see differently:

- **Sixteenths** (the handcart company's dotted rhythms, the pickup notes
  of the gift of tongues). The second flag used to curl back into the
  note's own head. Now the stem is a little longer for each extra flag,
  so the flags stand clear. A low note whose stem-down would be cut short
  at the plate's edge (the trio's tune in the pedals, two ledger lines
  under the bass staff) turns its stem up instead, and its flag hangs
  beside the head, not over it. The house's own harmonium had a few of
  these too; they're fixed by the same rule.
- **The gift of tongues' slurs** now curve deep enough to pass over every
  note of the run beneath them, instead of cutting through the low ones.
  Each slur is shaped for its whole run from its first stroke, so it
  doesn't jump about as the notes under it are engraved.
- **The organist's variations, the trio.** The running flute figure now
  reads left to right in the order it's played, with its short beams all
  there: no more bare stems running up to the edge of the page. It's a
  little smaller than before (the size of the fiddle's notes), because at
  the larger size it couldn't keep up with the music and drifted further
  and further behind. The treble is written as two voices sharing a
  staff, as an organ score is: the figure's stems up, the hymn's chords
  under it with stems down.
- **The far tower's bells** are now a small dot inside one ring, with
  clear air between them, instead of a hollow note hugging the ring (which
  read as two outlines, one inside the other). The peal prints in the
  order it's rung.
- Smaller things: **speech crosses** on one pitch keep a little air
  between them (they used to meet tip to tip and read as "XX"). **Guest
  beams lie level.**

Nothing else changed: no text, green only, nothing moves but the scroll
and the drying, and the Hosanna still prints nothing.

### How to see it

The same listening seeds as above (the wheel's dev jump, then wait):

| what changed | seed | jump, then wait |
|---|---|---|
| the company's sixteenths | 41 | postlude, ~30–50 s |
| the gift's slurs and sixteenths | 5 | testimony, ~20–45 s |
| the trio: the figure in order, beamed, over the chords; the pedal's flags | 55 | postlude, ~38–75 s |
| the far tower's bells | 53 | none: 0:20–1:10 after PLAY |
| the speech crosses | 3 | testimony, ~20 s |

### What changed, finding by finding

1. **A sixteenth's flag over its own head (blocking; the company, the
   gift).** Fixed in the house's own stem, so it holds for every flagged
   note on the page. `layoutGroup`: each flag past the first lengthens its
   stem by the flags' own step (0.8 sp: `sL`). A stem turned down hangs its
   flags back up over its lowest head, so where the plate's edge or the gap
   cuts it shorter than the flags need to clear that head (`flagClear`:
   2.8 sp for the first flag, 0.8 for each after it, the head's half-height
   and a hair), it turns up and its flags hang beside the head. Where
   neither way is long enough (one high note under the plate's top in the
   finale, stopped by the gap below), its flags are drawn a little shorter
   to clear the head (`fk`, at least half length; `groupBoxes` measures the
   same). The critic's same-note check (a note's own flag, dot or sign
   over its own head, by more than 0.1 sp) is now one of mine: the company
   12 → 0 at both widths, the gift 2 → 0, the variations 12 → 0, and every
   passage 0 (table below). The house's harmonium (seed 3), which the
   critic found doing the same, is 0 too (4 → 0), and so is our hymn in
   seed 10 (4 → 0).
2. **A melisma's slur through the run beneath it (blocking; the gift).**
   `drawTieOrSlur` is now the drawing only; its crescent is `tieShape`,
   shared with `probe("ink")`, so the checks measure what is drawn. A slur
   (`slurFit`) looks along its span at every head there on its staff — its
   own run's and any other's — and curves deeper, up to 2.2 sp, to pass
   them all with a quarter space of air; past that, both ends stand
   further off their heads. It is fitted from its first stroke to the
   whole melisma (every note not yet engraved that can still come under it
   stands where its time puts it; its height is already known), and once
   the burin is past its end — and past the far ward's wait, when no note
   can come under it — the fit is kept; and what is drawn of it only ever
   deepens, never relaxes (a note it made room for that then does not
   print leaves it as it was). `probe("ink")` now gives every drawn slur
   and tie in slices, and a new check tests them against every head, and
   for a change of shape once engraved: the gift, 9 slur-over-head at 860
   with the fit switched off (the same code, so the check sees the fault)
   → 0 with it on, at both widths, 14 slurs seen, 0 reshaped. Heads only: a
   slur may cross a stem, as in any score.
3. **The trio's figure out of order, its beams gone (blocking; the
   variations).** Four things, found one under the other:
   - **Order** (`orderAt`): a guest's note never prints left of an earlier
     note of its own line. Where an earlier note was set past its time,
     this one follows it by 0.6 sp (less where its time is nearer), always
     more than half the way closer than its time would put it, so an
     offset dies away within a few notes. The order lifts a note's cap only
     as far as the order asks (past that it goes on only for a bar, a
     struck head or a beam, as in round 1). Only a guest's own line asks
     it (`madeSince(…, line)`): the fiddle's tune, the organist's figure,
     the gift's song, the company's unison, the spoken words — not the
     organ's chords and pedal nor the far ward's parts, whose voices cross
     in time. (Ordering every organ voice against every other ran away:
     near-simultaneous notes passed a whole offset on, 23 sp at 860.)
   - **Level guest beams** (`beamGeo`, one line). The vanishing beams
     predate this branch: a beam's slope was laid where its notes were
     *expected* (at their time), and followed out to where they were
     *set* (several spaces later) it ran off the plate's top, leaving the
     stems bare to the edge; `inkLayout` measured a stem at the note's own
     time while it was drawn at its offset. A guest's beam now lies level,
     so it meets every stem wherever its note is set.
   - **Two voices on the treble** (`varFigures`, `varUnder`): the plan
     says the trio's flutes run *over the hymn's chords, the alto held
     under them*, so while the figure runs, the treble is set as two voices
     share a staff — the figure's stems up, the chords' down (only notes
     not yet set are turned). Before, a figure head fell on a chord's stem
     at the same beat and the two leapfrogged along the page.
   - **The figure at 0.6** (was 0.75; the fiddle's is 0.55). At 860 px a
     bar of the trio holds about 8.3 sp of time, and at cue size the
     figure's heads and air and the bar needed about 7.7: a note pushed
     once could never catch up, and the figure — and each bar placed after
     its ink — drifted up to 16–21 sp from its time (measured, with the
     order in force at 0.75). At 0.6 the trio's largest offset is 3.2 sp
     at 860 (round 1: 5.9; 1 note over 3 sp, round 1: 35) and 2.0 at 390
     (round 1: 3.9); the two-keys interlude after it 6.2 / 3.3 (round 1:
     7.0 / 3.0).

   Measured (seed 55, the whole set, both widths): beams reversed
   8 → 0 (860) and 4 → 0 (390); figure notes printed left of an earlier
   note 12 → 0 and 4 → 0; beams drawn as stubs on the plate 0 / 3 → 0.
   `probe("ink")` builds a beam from its first stem to its last, as
   `drawBeam` does (a reversed one draws nothing and says so: `rev`), so
   the check can no longer believe a reversed beam was drawn.
4. **The pedal's flags over their heads (blocking, carried over).** The
   trio's tune two ledgers under the bass staff now turns its stems up
   (finding 1's rule), its flags beside the heads: the variations' own-flag
   count 12 → 0 at both widths (see the one near-miss above, fixed by `fk`).
5. **The far tower's two outlines (significant).** Each stroke is now a
   small *filled* head (0.3) inside one ring 0.4 sp round (`TOWER_RING`,
   `drawBellRing(…, k)`, `headExt`'s ring box): about 0.17 sp of clear air
   between head and ring (1.8 px at 860, 1.4 px at 390; about 4 device
   pixels at either). One outline, the ring; the head is solid, a dot in a
   ring, not a second outline. The peal is one line (`orderAt`), printed in
   the order it is rung (the method is read from that order), and the
   house's reeds that step round it take up to 8 passes to find their place
   (as a guest's note does; the hymn keeps its 4). Every try was measured
   (seed 53, the whole passage, 860 / 390):

   | head / ring (sp) | the peal ordered? | reeds' passes | heads struck | strokes out of order | largest offset |
   |---|---|---|---|---|---|
   | round 1: hollow 0.45 / 0.44 | no | 4 | 0 / 0 | 0 / 0 | 2.7 / 2.2 |
   | 0.4 / 0.5 | no | 4 | 0 / 0 | 11 / 3 | — |
   | 0.35 / 0.46 | yes | 4 | 6 (the harmonium on rings) / — | 0 / — | — |
   | 0.35 / 0.45 (round 1's box) | no | 4 | — / 0 | — / 2 | — |
   | 0.35 / 0.45 | no | 8 | 0 / 0 | 4 / 2 (one of 1.4 sp) | 2.7 / 2.2 |
   | 0.35 / 0.45 | yes | 8 | 0 / 0 | 0 / 0 | 8.0 / 2.3 (35 of 250 strokes over 5 sp at 860) |
   | **0.3 / 0.4 (shipped)** | yes | 8 | **0 / 0** | **0 / 0** | **4.6 / 2.1** (none over 5 sp) |
6. **A far-ward stem through our head (minor; seed 10). Not fixed; I
   disagree with the cure, measured.** The class is a far note carried
   past its cap to where our next note falls, and our note, held at its own
   cap, set onto its stem. The direct cure (our hymn's note, held at its
   cap, goes on past a guest's ink as a guest's does) removed it: seed 10,
   the far ward's strikes 2 → 0 at 860. But at that same moment it put one
   of our own bars on our ink (225.7 s: bars on ink 8 → 10), and "no
   barline touching ink" is the owner's budget rule too. Round 1's two
   other cures (the far note waiting for every note of ours it might reach;
   keeping clear of where ours will stand) pushed the far ward 8.6–12 sp
   from its time and also put bars on ink. So it stays as round 1 left it,
   one moment in seed 10 at 860. The cure I'd try next: a far note that
   cannot find room within its cap waits, as it does for our bars, for
   *any* note of ours its placement would reach (not only one sung within
   0.45 s), and is then set after it.
7. **Polish.** Spoken crosses keep 0.2 sp of air (`SPOKEN_AIR`; the air is
   kept when the cross is set, not only asked), so two on one pitch no
   longer meet tip to tip. The dance's last two notes are in order (the
   fiddle's line). Turned fiddle beams are no longer steep (level). The
   pedal stem through the figure's beam is gone with the two voices (no
   stem crosses another note's beam in the trio's frames at 45, 85 and
   110 s, at either width, measured from `probe("ink")`). Our
   hymn's slur crossing a far-ward *stem* is left as it is: a slur crossing
   another voice's stem is ordinary engraving, and no head is struck. A
   far-ward note appearing up to 0.7 s behind the burin is unchanged
   (disclosed in round 1).
8. **For the integrator (not changed here).** The band's layer slides at
   its own quicker rate by round 2's design, so as it passes under the
   ward's page every one of our stems will cross some band head, and its
   bars our ink, however either is placed; only a change to that design
   (the band scrolling with the page) would end it — the owner's call. The
   house hymn's own bars on our heads in seed 44's opening and the
   doxology's organ opening are identical on the pre-branch code.
9. **Housekeeping.** The php server on 8277 (PID 96526) predates round 2
   and I did not start it; it is left for the orchestrator. Round 2 used
   its own servers on 8177 (this worktree) and 8178 (a scratch tree of
   links, for the controls), and muted Chrome on 9497, all stopped at the
   end.


### How it was checked (round 2; all muted)

The page itself, at 1×, in muted headless Chrome over CDP: the critic's
in-page checker (`crit.js`, `incheck.js`), extended this round, runs
after the page's own drawing on every animation frame through each guest's
whole passage (the listening seeds and the wheel's dev jump, as in round 1),
at 860 and 390 px. It checks, from `KolobViz.probe()` and `probe("ink")`:

- **heads struck:** any head crossed by more than 0.1 sp both ways by
  another note's ink (head, stem, ledger, flag, sign) or a drawn beam;
- **own flag:** a note's own flag, dot or sign over its own head, by more
  than 0.1 sp (the critic's same-note check);
- **slurs:** every drawn slur and tie against every head; and a slur
  that changes shape once engraved (by more than 1.5 px anywhere);
- **bars on ink**, and **moved:** a drawn note whose offset, stem, heads,
  flags or beam change after it prints, or a placed bar that moves (the
  key now tells apart two notes at one instant on one pitch, a figure's
  eighth and the alto's quarter, which the critic's key had merged into
  one note that seemed to move);
- **beams reversed** (members printed out of order) and beams **drawn
  reversed** (`probe("ink")`'s `rev`); **inversions:** a guest's one-head
  note printed left of an earlier one of its layer on its staff;
- **the Hosanna:** every Hosanna note the engine sends (a note listener)
  against every drawn note — any drawn at a Hosanna note's instant.

The results, on the final code (`1aa2aedd`), every frame of every passage:

| run | width | frames | heads struck (guest / house) | bars on ink | moved | own flag over own head (guest / all) | slur over a head | slur reshaped | beams reversed / drawn reversed | line inversions | errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tower53 | 860 | 4198 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| tower53 | 390 | 4196 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| cart41 | 860 | 3480 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| cart41 | 390 | 3477 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| gift5 | 860 | 3960 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| gift5 | 390 | 3954 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| var55 | 860 | 7916 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| var55 | 390 | 7916 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| dance22 | 860 | 5397 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| dance22 | 390 | 5379 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| bear3 | 860 | 6001 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| bear3 | 390 | 5997 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| gulls50 | 860 | 5521 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 1 | 0 |
| gulls50 | 390 | 5515 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 1 | 0 |
| far44 | 860 | 5992 | 0 / 18 | 9 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| far44 | 390 | 5997 | 0 / 12 | 6 | 0 | 0 / 0 | 3 | 0 | 0 / 0 | 0 | 0 |
| far10 | 860 | 17403 | 2 / 129 | 8 | 25 | 0 / 0 | 4 | 2 | 0 / 0 | 1 | 0 |
| far10 | 390 | 17396 | 0 / 123 | 12 | 30 | 0 / 0 | 4 | 2 | 0 / 0 | 0 | 0 |
| bands22 | 860 | 5035 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| bands22 | 390 | 5031 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | 0 |
| hos37 | 860 | 11399 | 0 / 90 | 30 | 17 | 0 / 0 | 2 | 1 | 1 / 1 | 0 | 0 |
| hos37 | 390 | 11392 | 0 / 39 | 19 | 16 | 0 / 0 | 3 | 1 | 0 / 0 | 0 | 0 |

Reading it: every guest's passage is 0 in every column, at both widths,
except the far ward's one moment in seed 10 at 860 (§6: 2 = the one
far-ward note's stem and flag on our head) and the gulls' one pair of cries
21 ms apart (Known issues). The rest is our own hymn and organ, the same
as round 1 measured it: our hymn's close voicings (seed 44 18 / 12, seed
10 129 / 123, seed 37 90 / 39; round 1 18 / 12, 127 / —, 85 / 39, which
varies by a few between runs), our bars on our own heads (seed 44 9 / 6,
seed 10's organ opening 8 / 12, seed 37's 30 / 19; round 1 9 / 6, 8 / —,
30 / 19), the organ opening's notes that move (seed 10 25 / 30, seed 37
17 / 16; round 1 25 / —, 17 / 16). The slur column's remaining counts are
our hymn's ties, whose shape this branch does not change, and a slur over
the organ's chords in seed 37. Run with the slur fit switched off (round
1's slur geometry, the same code otherwise), the same passages give 11 /
12 (seed 37), 7 / 12 (seed 44) and 23 / 24 (seed 10): the fit takes our
hymn's slurs off the heads as well as the gift's. The own-flag column
uses the critic's measure (flag over head by more than 3 px at 860,
2.3 px at 390); round 1 on it: the company 9 / 9, the gift 2, the
variations 10 / 10, our hymn and harmonium 4 (seed 3), 4 (seed 10),
2 / 2 (seed 37).

**The Hosanna prints nothing** (seed 37, the doxology's jump, to +190 s):
the engine sent 308 Hosanna notes in that time (all on the choir's layer,
`hosanna: true`), and not one note was drawn at the instant of any of
them, at either width. `onNote` still refuses them first thing.

**The frame, CPU throttled 4×, 390 px** (the page, the final code, each run
alone in the browser, 30 s of frames after the dev jump):

| the busiest guests | frames in 30 s | rAF p50 / p99 / max | work per frame (round 1) | long tasks | console |
|---|---|---|---|---|---|
| two bands crossing (seed 22, hymn +50–80 s) | 1801 (60 fps) | 16.7 / 16.8 / 16.8 ms | 1.48 ms (1.39) | 0 | 0 errors |
| the Social Hall's dance (seed 22, postlude +45–75 s) | 1802 (60 fps) | 16.7 / 16.8 / 16.8 ms | 1.14 ms (1.08) | 0 | 0 errors |
| the variations, the trio (seed 55, postlude +40–70 s) | 1801 (60 fps) | 16.7 / 16.8 / 16.8 ms | 1.32 ms (1.19) | 0 | 0 errors |
| the far tower (seed 53, +15–45 s) | 1801 (60 fps) | 16.7 / 16.8 / 16.8 ms | 1.09 ms (1.40) | 0 | 0 errors |
| the gift of tongues (seed 5, testimony +30–60 s) | 1801 (60 fps) | 16.7 / 16.8 / 16.8 ms | 1.01 ms | 0 | 0 errors |

The pace is the browser's (an empty page under the same throttle: a frame
every 16.7 ms, measured before and after the runs); the page took every
frame it was given, at a tenth of a frame's budget or less.

**How far a guest's note stands past its time** (the largest offset over
each whole passage, in staff spaces; round 1 → round 2, 860 / 390 px): the
variations 7.0 → 6.2 / 3.9 → 3.3 (the trio alone 5.9 → 3.2 / 3.9 → 2.0);
the far tower 2.7 → 4.6 / 2.2 → 2.1 (the cost of printing the peal in
order); the Social Hall's fiddle 3.0 → 4.3 / 2.6 → 2.6 and its caller
3.6 → 4.1 / 2.4 → 2.8, and the bearers' crosses 2.5 → 3.8 / 0.5 → 0.6
(the crosses' air and the tune's order); the company, the gift, the gulls
and the far ward unchanged (2.0 / 1.2, 2.1 / 1.0, 1.3 / 1.1, 5.3 / 5.5).



### Before and after (muted headless Chrome, the page itself)

**Before** is round 1's code, as the critic ran it (the same seeds, jumps
and seconds, the same muted page). **After** is this code. Three sheets
are committed beside this note:

- `handoff/archive/r3c-engrave-2-sheet-860.png`: a row per guest, round 1 on the
  left, round 2 on the right, 860 px;
- `handoff/archive/r3c-engrave-2-sheet-390.png`: the same at 390 px (the phone);
- `handoff/r3c-engrave-2-details.png`: close pairs, round 1 above round 2,
  one per finding: the company's sixteenths, the gift's slurs, the trio,
  the pedal's flag, the tower's bells and the speech crosses.

The frames themselves: round 1's under
`/private/tmp/claude-501/kolob-r3c-engrave-critic/out/<tag>/`, round 2's under
the scratchpad
`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3c-engrave/r2/out/<tag>-fin/`,
as `staff-<width>-t<seconds>.png`, with each run's `result-<width>.json`
(the checks, the console):

| guest | tag | seed, jump | seconds after the jump |
|---|---|---|---|
| the far tower | `tower53` | 53, none | 20, 45 |
| the handcart company | `cart41` | 41, postlude | 30, 50 |
| the gift of tongues | `gift5` | 5, testimony | 20, 40, 62 |
| the organist's variations | `var55` | 55, postlude | 45 (the trio), 85 (two keys), 110 |
| the Social Hall | `dance22` | 22, postlude | 20, 45, 70 |
| the testimony-bearers | `bear3` | 3, testimony | 20, 40 |
| the far ward (and our hymn) | `far44`, `far10` | 44, 10, hymn | 75, 95; 226, 236 |
| the gulls | `gulls50` | 50, testimony | 88 |
| the band and a second band | `bands22` | 22, hymn | 30, 50 |
| the Hosanna (nothing) | `hos37` | 37, doxology | 150, 175 |

### Requests (round 2)

1. **To the owner:** the far tower's bells are now a small solid head in
   one ring (◉), where they were a hollow head hugging a ring. Say if the
   ring alone (a small hollow circle, no head inside) would read better as
   a far bell. That is the other one-outline choice.
2. **To the integrator (the band's layer, finding 8):** whether the band
   should keep sliding at its own quicker rate (its pale heads and bars
   then always pass under our stems as it crosses), or scroll with the
   page like every other guest now does. It's a design call, round 2's
   (the band's own pace was the point); I've left it.
3. **To the integrator (tools):** the critic's in-page checker, extended
   this round, could join `tools/` as the staff's standing check for the
   owner's rules. It's `crit.js` plus `incheck.js` in the scratchpad
   `r3c-engrave/r2/`: heads struck by another note's ink, a note's own
   flag over its own head, slurs and ties over heads, a slur reshaped once
   engraved, bars on ink, notes moved after printing, beams reversed,
   inversions along a line, and the Hosanna. It runs in the real page at
   1×, muted, with the wheel's dev jump.
4. **To the drone-waveform crew (`kolob-drone`), for the merge:** round 2's
   hunks outside the guests' own section are small and local. In
   `layoutGroup`: `sL`, two changed lines in `stemEnd`, the flag-turn line
   and `fk`, and `fk` in its return. Then `headExt` (one line),
   `groupBoxes`' flag box (one line), `drawGroup`'s `drawFlag` call (one
   line), `flagClear` beside `drawFlag`, and `drawFlag`'s `fk`. `beamGeo`
   has one line. `drawTieOrSlur` is now three functions (`drawTieOrSlur`,
   `tieShape`, `slurFit`: one block). `clearance` has five short hunks,
   and `orderAt` is new beside `onHead`.
   `drawPage` (the `drawBellRing` call), `inkOpts` (`ringK`) and
   `drawBellRing` (`k`) change one line each; `probeInk` gets the beam
   span and slurs. Nothing draws the `"drone"` layer.

### Known issues (round 2)

- **One far-ward note on our head, one moment (seed 10, 860 px, about
  6:55 into the meeting: 225.1 s after the hymn's jump).** Finding 6, not fixed (§6):
  its cure put one of our bars on ink.
- **The trio's figure is smaller** (0.6, near the fiddle's 0.55). It's
  distinct at both widths, but small; at cue size it couldn't keep its
  time at 860 px (§3).
- **Guest beams lie level.** That's plainer than the hymn's gently sloped
  beams, and deliberate: a guest's notes may stand past their time, and a
  slope laid for where they were expected doesn't meet them where they
  stand.
- **Under the running figure the treble's chords take stems down** (two
  voices on one staff, the organ-score way). A low chord note near the gap
  may still turn its stem up where the gap is too close, as every stem
  does.
- **The far tower's heads are near-dots** (0.3) in their rings, and the
  peal stands up to 4.6 sp past its time at 860 (round 1: 2.7): the cost of
  printing it in the order it's rung, with no stroke on another (§5).
- **Some guests stand a little further past their time** (the table
  above): the fiddle 4.3 sp at 860 (was 3.0), its caller 4.1 (3.6), the
  bearers' crosses 3.8 (2.5). That's the crosses' air and the tune's
  order.
- **A slur may deepen slightly while its run is engraved**, if a note is
  set further past its time than predicted (more than half a space). It
  never relaxes, and once the burin is past its end it is fixed (0
  reshaped once engraved, measured).
- **The gulls: two cries 21 ms apart** can print in either order (one
  pair at each width in seed 50). It's a chord of cries, not a readable
  inversion. And in seed 10 at 860, one far-ward note of one part prints
  2 sp left of a slightly earlier note of the other part on its staff (the
  far ward's parts cross in time; they are not held to one line).
- **Found by the new checks, in our own hymn, not changed here (for the
  integrator):** our hymn's ties, whose shape this branch does not change,
  touch a head at a few moments (seed 10: 4 at each width; seed 44: 3 at
  390; seed 37: 1–2). A tie of the upper voice curves under its head, into
  the lower voice's; the engraver's way would curve it above (away from
  the other voice). I tried setting ties further off instead, and that
  made it worse (seed 44 at 390, 2 → 4), so it's put back. One slur over
  the organ's chords in seed 37 (its start inside the chord). And one of
  our hymn's beams in the doxology (seed 37, 860 px, at 90.7 s) prints its
  two eighths out of order, the first held at the hymn's cap and the second
  at its time. Round 1's run didn't catch that one; it's the hymn's own cap
  rule, and the order rule this round gives a guest's line could give our
  hymn's too.
- **Carried over, pre-existing, not this branch's:** our hymn against
  itself (its close voicings; its bars on its own heads in seed 44's
  opening and seed 10's and seed 37's organ openings; the organ opening's
  notes that move), all as round 1 measured them. The band's layer (§8).
