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

- `handoff/r3c-engrave-1-sheet-860.png`
- `handoff/r3c-engrave-1-sheet-390.png` (the phone)

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
