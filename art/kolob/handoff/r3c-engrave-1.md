# r3c-engrave-1: the new guests on the staff

*ENGRAVE crew, round 3c. Branch `kolob-r3c-engrave`, from `kolob-r3c` at
`13ac495`. 2026-09-29. The only file changed is `kolob-viz.js` (`kolob.css`
needed nothing; no engine file was touched). VERSION is not bumped.*

## For the owner, in plain words

**What is new to see: the staff no longer sits blank under round 3c's
guests.** Each one now prints in the page's own ink and shapes, the far ones
paler, as the far trombone choir and the old tune already are. Nothing is
written in words, everything is green, nothing moves but the scroll and the
drying, and every head is one clean strike.

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
  two share, ours is set first and theirs steps aside; nothing of one is
  printed over the other.
- **The Social Hall** — the fiddle's dance prints like a fiddler's tunebook:
  small heads (it runs faster than the page can print full-size ones), the
  hymn's own notes inside the tune slightly heavier (the house's way of
  marking a tune), the running eighths beamed three to a beat in a jig and
  two in 2/4, a barline at every bar, a double bar wherever a strain repeats
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
  stands out, and in the two-keys interlude the pedal's own bass line (in the
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
  guest's note never stands on a bar (or within 0.2 sp of one) nor on
  another note's head — there it goes on past** (`onBar`, `onHead`).
- `setDue` / `drawPage`: the far ward's notes (`gr.yields`) are set just
  after ours of the same beat (`YIELD_LAG`, 80 ms), and one that falls
  within 0.7 s before a bar of ours waits until that bar is placed, then
  keeps clear of it (`barWaits`).
- `probe("ink")` (dev): every drawn note's ink boxes and every placed bar's
  ink, in page px; `probe()` also gives each group's offset (`dx`) and each
  bar's placement (`rel`, `nx`).

## How it was checked (all muted)

Two instruments, both muted headless Chrome over CDP:

1. **The replay lab** (scratchpad `r3c-engrave/lab/lab.html`, from r3b's): a
   harness dump replayed into the real `kolob-viz.js` with a stand-in
   `KolobAudio` — the same notes and events the engine sends, at the same
   audio times — for before/after frames at 860 and 390 px, and for
   `barcheck.js`: every animation frame, each placed bar's ink against every
   drawn note's ink boxes on its staves (between the staff's lines and half
   a space beyond), over the whole of each guest.
2. **The page itself** (`tools/screens.js` with a `--query` option, scratch
   copy `screens3c.js`): the listening seeds with the wheel's dev jump,
   frames at 860 and 390 px, and the frame cost with the CPU throttled 4×.

Dumps (the harness, `dump=`): seeds 22 (the bands, the Social Hall), 53
(the tower), 44 and 10 (the far ward), 50 (the gulls), 41 (the company), 55
(the variations), 5 (the gift), 3 (the bearers), 37 (the Hosanna), 9 with
`force=socialhall` (a second dance). All harness runs PASS, 0 errors.

**Bars touching ink, and heads printed over heads** (`barcheck.js` and
`headcheck.js`, every frame of the whole of each guest, at 860 / 390 px; a
head over a head is two heads overlapping by more than 0.12 sp both ways):

| guest (seed) | bars touching ink | heads over heads | largest offset past a note's time |
|---|---|---|---|
| the Social Hall (22) | 0 of 66 / 0 of 66 | 0 / 0 | fiddle 3 / 2.6 sp, the caller's crosses 3 / 2.4 |
| the Social Hall (9, forced) | 0 of 98 / 0 of 98 | 0 / 0 | fiddle 4.9 / 3 sp, crosses 3.9 / 3.4 |
| the variations (55) | 0 of 72 / 0 of 72 | 0 / 0 | organ 4.9 / 2.5 sp |
| the far ward over our hymn (44) | 0 of 30 / 0 of 30 | 0 / 0 new (our hymn's own 6 stacked thirds, as before: 6) | far ward 5.5 / 6.3 sp; our hymn 2.3 (2.3 without it) |
| the far ward over our hymn (10) | 0 of 37 / 0 of 33 | 0 / 0 new (ours: 12 / 10, as before: 12 / 10) | far ward 6.6 / 6.1 sp; our hymn 3.5 (2.2 without it) |
| the band and a second band, the ward's page (22) | 0 of 34 / 0 of 34 | 0 / 0 | (the bands are on their own layer) |
| the far tower (53) | no bars | 0 / 0 | rings 2.7 / 2.2 sp; the house's harmonium 3.4 / 2.4 |
| the handcart company (41) | no bars | 0 / 0 | 1.5 / 1.2 sp |
| the gulls (50) | no bars | 0 / 0 | 2.0 / 1.8 sp |
| the testimony-bearers (3) | no bars | 0 / 0 | crosses 2.5 / 0.5 sp |
| the gift of tongues (5) | no bars | 0 / 0 | 1.9 / 1.0 sp |
| the Hosanna (37) | — | — | nothing drawn at all, 18:30–19:20 |

0 console errors in every one of these runs. (Before this round's fixes,
with full-size fiddle heads, 25 of the dance's 66 bars stood on a downbeat
head; the far ward's pale notes, pushed along by ours, crowded 6 of 30 of
our bars; and the far tower's rings, the far ward and the trio printed 14,
21 and 7 heads over other heads.)

**The frame, CPU throttled 4×, in the page** (`screens3c.js`, the dev jump,
30 s of frames after the second capture; the machine's load average 3–4):

| the busiest guests | width | frames | rAF interval | p50 | p90 | p99 | max | long tasks | console |
|---|---|---|---|---|---|---|---|---|---|
| two bands crossing (seed 22, hymn +50–80 s) | 390 px | 1,801 | 16.7 ms (60 fps) | 0.9 ms | 1.4 ms | 1.9 ms | 3.1 ms | 0 | 0 errors |
| | 860 px | 1,800 | 16.7 ms | 1.2 ms | 1.7 ms | 2.4 ms | 6.6 ms | 0 | 0 errors |
| the Social Hall's dance (seed 22, postlude +45–75 s) | 390 px | 1,800 | 16.7 ms (60 fps) | 0.9 ms | 1.4 ms | 1.9 ms | 2.6 ms | 0 | 0 errors |
| | 860 px | 1,800 | 16.7 ms | 1.2 ms | 1.9 ms | 2.5 ms | 6.2 ms | 0 | 0 errors |

A frame's cost is its requestAnimationFrame callbacks (the staff and the
wheel); the worst frame at 390 px is under a tenth of a 30 fps frame's 33 ms.

**Nothing moves once printed.** Every placement is made once, when a note
falls due (`setDue`), and kept; the new rules only choose where a note is
first set (its cap, a bar's room, a far note waiting for our bar). A beam
joined across the organist's calls takes a new member only while none of
its notes has been set. The only motion is the scroll and the drying.

**The Hosanna:** the lab replays seed 37's whole Hosanna (415 notes, all
`logged: false`, `hosanna: true`) — 0 groups printed at 18:55 and 19:15, at
both widths; `onNote` now refuses `n.hosanna` too, so it stays off the page
even if its `logged` or `ENGRAVE_HYMN` ever changed. In the page (seed 37,
the doxology jump): see the frames below.

**Console:** 0 errors or warnings in every lab frame (48 after, 16 before)
and every page run.

## Before and after (muted headless Chrome)

All under `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3c-engrave/`.
The lab frames (`shots/`) replay each seed's own dump into this branch's
starting `kolob-viz.js` (**before**, `shots/before/` and `shots/before2/`)
and into the final one (**after**, `shots/final/`), at the same audio time:
`<dump>-<width>-t<seconds>.png`. The page frames (`real/<tag>/`) are the page
itself, the listening seed, after the dev jump.

| guest (seed) | before (lab) | after (lab) | the page (after) |
|---|---|---|---|
| the far tower (53) | `shots/before/changes53-{860,390}-t{20,45}.png` | `shots/final/changes53-{860,390}-t{20,45}.png` | `real/tower53f/staff-{860,390}-t{020,045}.png` |
| the far ward (44) | `shots/before/farward44-{860,390}-t{292,312}.png` | `shots/final/farward44-{860,390}-t{292,312}.png` | `real/far44f/staff-{860,390}-t{075,095}.png` |
| the gulls (50) | `shots/before/gulls50-{860,390}-t545.png` | `shots/final/gulls50-{860,390}-t545.png` | `real/gulls50/staff-{860,390}-t088.png` |
| the Social Hall (22) | `shots/before/hall22-{860,390}-t{990,1025}.png` | `shots/final/hall22-{860,390}-t{990,1025,1050}.png` | `real/dance22f/staff-{860,390}-t{020,045}.png` |
| the handcart company (41) | `shots/before/handcart41-{860,390}-t{880,900}.png` | `shots/final/handcart41-{860,390}-t{880,900}.png` | `real/cart41/staff-{860,390}-t{030,050}.png` |
| the testimony-bearers (3) | `shots/before/testimony3-{860,390}-t{492,510}.png`, `shots/before2/testimony3-{860,390}-t545.png` | `shots/final/testimony3-{860,390}-t{492,510,545}.png` | `real/bear3/staff-{860,390}-t{020,040}.png` |
| the gift of tongues (5) | `shots/before2/tongues5-{860,390}-t{400,425,433}.png` | `shots/final/tongues5-{860,390}-t{400,425,433}.png` | `real/gift5/staff-{860,390}-t{040,062}.png` |
| the variations (55) | `shots/before2/variations55-{860,390}-t{880,910,945,960}.png` | `shots/final/variations55-{860,390}-t{880,910,945,960}.png` | `real/var55/staff-{860,390}-t{045,085}.png` |
| the Hosanna (37): nothing, before and after | `shots/before/hosanna37-{860,390}-t{1135,1155}.png` | `shots/final/hosanna37-{860,390}-t{1135,1155}.png` | `real/hos37/staff-{860,390}-t{150,175}.png` |
| the bands (22), unchanged | `shots/before/bands22-{860,390}-t{215,250}.png` | `shots/final/bands22-{860,390}-t{215,250}.png` | `real/bands22f/staff-{860,390}-t{030,050}.png` |

What to look for: the tower's stair of small pale rings (rounds at 20 s,
the changes at 45 s); the far ward's small pale chords just after ours; the
gull heads above the staff among the testimony's clarinet; the dance's
beamed threes and double bars; the company's two lines in octaves; the
bearers' crosses on the bass staff and the harmonium's small stemless heads;
the gift's line with its slurred runs and the hum's four heads (at 433 s);
the variations' bars through both staves and the trio's small beamed figure;
an empty staff under the Hosanna.

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
   `KolobViz.probe("ink")`) could join `tools/` as the staff's standing check
   for bars touching ink; `screens.js` could take a `--query` for the guest
   switch (the scratch copy `screens3c.js` does).
6. **To the drone-waveform crew (branch `kolob-drone`), for the merge:** this
   branch's hunks outside its own new section are single lines or a few:
   the atlas (`SH.x`, `ANCH.x`, `HEAD_EXT.x`), `onNote` (three lines),
   `flushIntake` (one), `takeLayer` (three), `clearance` (four), `setDue`
   and `drawPage` (one each), `probe`. Nothing draws the `"drone"` layer. (The
   Social Hall's `part: "drone"` is the fiddle's open string on the `fiddle`
   layer, printed as a note — not the meeting's drone.)

## Known issues

- **Quick guests stand a little after their time where the page is full.**
  At 60 px/s a jig's eighths are a staff space apart, and each bar needs
  about one more. Each new guest's note keeps within its own cap (the fiddle
  3 sp, the variations 2, the far ward 1.5), and only goes past it rather
  than stand on a bar: measured, the fiddle up to 3 sp at 860 px (4.9 in the
  second dance), the trio's figure up to 4.9 sp at 860 (2.5 at 390), the far
  ward up to 6.6 sp. The far ward's note may print after one of our bars
  though it sang just before it (it waits for the bar, then keeps clear).
- **A far-ward note that falls just before one of our bars appears up to
  0.7 s behind the burin** (it waits for the bar to be placed, then prints;
  it never moves after).
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
