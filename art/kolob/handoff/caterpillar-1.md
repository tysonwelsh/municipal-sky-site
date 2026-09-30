# caterpillar-1: the band's caterpillar

*Caterpillar crew, 2026-09-29. Branch `kolob-caterpillar`. Built to
PLAN-CATERPILLAR.md, the owner's request. Nothing pushed or published.
VERSION is not bumped: that is the integrator's to do, in the commit that
lands this.*

## For the owner, in plain words

When the Nauvoo band strikes up, a small volume control for the band alone
now crawls onto the console. It is a row of little ink segments with a small
ink beehive for its head, the master slider's hexagon in miniature. It comes
in from the left edge of the paper, passing behind the PLAY, PAUSE and STOP
dots the way an inchworm goes: the back half bunches up behind the head, then
the head reaches forward and the body stretches after it. After about three
and a half seconds it lies down in the empty space between STOP and VOL, and
there it is a slider. Its body is the track and its head is the handle.

- **Drag the head** (or tab to it and use the arrow keys) and the band gets
  quieter or louder: from silent up to half again its own level. The middle
  of the travel is where the band normally sits (100 %), and the faint line
  beyond the head shows the room left to turn it up. Turn the band down and
  the caterpillar bunches up, its middle arching a little. Turn it up and
  it stretches out.
- **It only changes the band.** Both bands (when two come) and their drums
  answer it. The ward, the organ and everything else stay exactly where they
  were. The band still keeps its time, its notes still print on the staff,
  and the minutes still name it.
- **When the band has gone**, and that means after its drums have faded down
  the road, not when the march ends, the caterpillar lets go, turns round,
  and crawls back off the left edge of the paper. The row is as it was.
- **It remembers** for as long as the page is open. If you turned the band
  down, the next band arrives already turned down. A fresh page starts at
  100 %.
- **Pause** holds it where it is, mid-crawl or lying down. **Stop** or a jump
  sends it off in a quick crawl, and a new seed (the gather button) simply
  clears it away.
- **On a phone** the master slider fills the whole row, so there is no free
  space beside it. There the caterpillar walks along the console's thin rule
  beneath the three dots and lies down on it, still to the left of the
  master slider and still pushing nothing.
- **It looks like the page.** It is green ink on the cream paper, with no
  face, no legs, no colour and no shadow, and it prints no words.

**How much is new, honestly:** one control, and the motion that brings it.
No sound in the meeting changes unless you move it.

## How to see it

1. Serve the worktree:
   `php -S 127.0.0.1:8181 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-caterpillar`
2. Open **http://127.0.0.1:8181/art/kolob/index.php?seed=22&guest=bands** and
   press PLAY. (`?guest=bands` puts the band in the prelude of every meeting.)
3. What happens, on seed 22:

| when (meeting clock) | what you see and hear |
|---|---|
| about 0:08 | the band strikes up far off; the caterpillar crawls in (about 3.4 s) and lies down at 100 % |
| 0:08 to 1:09 | the march; try dragging the head to about 40 %, then to 0 %, then back |
| about 1:09 | the stinger; the caterpillar stays, because the drums play on down the road |
| about 1:26 | the last drum is out of hearing |
| about 1:28 | the caterpillar lets go, turns, and crawls off (about 3.9 s) |

Other ways to look at it:
- `&catfeet=1` shows the variant with tiny paired feet (see "Choices").
- The system's "reduce motion" setting (macOS: Accessibility, Display, Reduce
  motion) makes it fade in and out where it lies instead of crawling.
- Any seed: the band comes in the prelude or the postlude on about one Sunday
  in three (three Pioneer Days in four), and the caterpillar comes with it.
  No other guest ever brings it.

## Contact sheets

- `handoff/caterpillar-1-sheet-860.png`: the row before the band, the crawl
  in (five frames), lain down at 100 %, dragged to 40 % (a real mouse drag),
  focused from the keyboard (the head turns gilt), the crawl off (five
  frames, from letting go, through the turn, to the edge), and the row after.
- `handoff/caterpillar-1-sheet-390.png`: the same at 390 px (touch emulated):
  it walks the console's rule beneath the dots.
- `handoff/caterpillar-1-variants-860.png` and `…-variants-390.png`: without
  feet (chosen) and with feet, lying down at 100 % and 40 %; reduced motion
  (fading in, lain down, fading out on STOP); STOP's quick crawl off.

The frames are real page renders, taken muted in headless Chrome. The crawl
was frozen and stepped through its own animation time, because headless
Chrome draws about one frame a second.

## What shipped

| file | what |
|---|---|
| `kolob-voices-band.js` | THE LISTENER'S HAND: every band made into a road (the Nauvoo band; `road()` marks its input) sends its out through a gain of its own, ahead of the road. `setHand(v)` glides every live hand to v (0 … 1.5) over 50 ms, `hand()` reads it, and `heardUntil(ctx)` is when the last note or stroke yet laid out by a marching band ends (each band keeps a running maximum in its node count). The hand is released in the band's `dispose()` and counted in its standing nodes. |
| `kolob-core.js` | the facade: `KolobAudio.setBandVolume(v)`, `getBandVolume()`, `getBandHeardUntil()` |
| `index.php` | the console markup: the caterpillar's lane after the spacer (a real `<input type="range">` with `aria-label="band volume"`, the track, the body, the ink beehive head), `hidden inert` until the band comes |
| `kolob.css` | the console only: the look (segments, head, feet variant, the faint track, the invisible native thumb, a bigger head and a 44 px hit area on touch). The transport becomes the lane's positioning box, and the dots stand in front of it (`position: relative; z-index: 1`). |
| `kolob-ui.js` | `wireCaterpillar()`: the measured lane, the pose and the gait, the Web Animations crawl, the states, the audio-clock reading, the engine's events, the slider, resize and visibility. `poll()` ticks it. |
| `handoff/caterpillar-1*.{md,png}` | this note and its sheets |

## How it works

**When it comes.** On the band's `guest-start` (guest `bands`, and never a
guest with `logged: false`), the page notes the band's start `t` and its
`until` on the audio clock. The caterpillar comes when the audio clock
(`KolobAudio.getAudioTime()`, the clock the staff's smoothed page clock
follows) reaches `t`: that is when the band is heard, not when it was
scheduled, which is up to a quarter-second earlier.

**When it goes.** The band's `guest-start.until` is only the stinger plus a
second (`GuestBands` returns the march's end: "the meeting waits for no
drum"). The drums carry the band out of hearing 16 to 21 s later. So the page
also reads `getBandHeardUntil()`: the end of the last note or drum stroke any
marching band has laid out, straight from the band's own voice. That value
runs a couple of bars ahead of the sound while the band plays, and settles
on the last stroke. The caterpillar goes at the later of the two, plus
`LINGER_S` (1.5 s) for the town's air. Seed 22: stinger 68.9 s, drums gone
86.5 s, last stroke 86.2 s, and it starts to leave at 87.7 s. With two bands
it stays until the later one has gone: one hand, one caterpillar.

**Everything is read off the audio clock**, so:
- **Pause** holds the clock, and the crawl is held with it (every animation
  paused). It goes on when the meeting does.
- **A hidden tab.** A change that falls due while the tab is hidden is made
  at once, with no crawl. A crawl already under way runs on the page's own
  animation timeline, which keeps time, so on return it is simply where it
  would be by now. A page that opens, or comes back, part-way through
  starts its crawl part-way, and nothing is replayed late.
- **STOP** or a dev jump (`skip`): a quick crawl off (0.35 of the time,
  about 1.3 s). A new seed (the gather button): simply gone. The Ives and
  Whole switches restart through STOP, so they give a quick crawl off.

**Only a lain-down caterpillar is a control.** While it arrives, leaves or is
away, the lane is `inert`, the range is disabled and out of the tab order
(`tabIndex -1`), and it takes no pointer. If it had the focus as it leaves,
the focus is let go.

**The gait.** A crawl is a list of moves of the tail and the head, each with
a cosine ease, plus one turn. The inchworm's pulse: the rear draws up
(`BUNCH` = 42 % of the pulse), then the head reaches on. The stride is
fitted so the last pulse lands it exactly. It never bunches tighter than
0 % does, and never takes fewer than five pulses. The whole crawl covers its
distance at `SPEED` (130 px a second), held to 2.5 to 3.6 s (3.4 s at 860,
2.5 s at 390). Arriving, it then lies down at the listener's setting
(`SETTLE_S`, 0.4 s). Leaving, it lets go (the head draws back to the tail,
0.3 s), turns round (0.36 s: the body seen side-on turning, foreshortened
about its middle and back, which is simply cos θ), reaches away, and
crawls off. The body's middle arches (up to 7 px in the row, 5 px on the
rule) in proportion to how bunched it is, so it never reaches the staff.

**The Web Animations API, on the compositor.** Within a move every segment
goes straight from one place to the next with the same ease (the arch rises
in step), so a move is two keyframes and `cubic-bezier(0.37, 0, 0.63, 1)`
between them. Only the turn, and a letting-go that passes the band's own
length, are sampled (every 20 ms). There are 13 transform animations, one
per segment and one for the head. All 13 run on the compositor (the trace
shows no `compositeFailed` for any of them).

**The slider.** The tail stays at the start of the track. The head's centre
travels from `Lmin` past the tail (0 %: the fully bunched body) to the end
of the track (150 %), and the band's own length (100 %) is two-thirds of the
way. The real range is laid under the head's travel with its native thumb
invisible, the master lever's way. So a drag, a click on the track, the
arrow keys, Page Up/Down and Home/End all work natively. `aria-valuetext` is
"N percent".

**Where it lies** is measured from the row every time it comes, and on a
change of width (only the width, so a phone's address bar coming and going
never cuts a crawl short).
- **Row:** when the free space between STOP and VOL leaves at least 96 px
  after a 22 px gap each side (at 860 there are 314 px; at 720, 174),
  the track is up to 170 px long, ends 22 px before VOL, and sits mid-row.
- **Rule:** otherwise, and on every phone layout, it lies on the console's
  rule, from the paper's content edge to 12 px before the master slider.
- **The lane** begins at the paper's left edge and clips there, so the
  caterpillar comes from beyond it and never shows on the green cover.

## The sound side

- **The gain stage.** The band's `out` (where the conductor's dynamics are
  automated: the trio softer, the fall over the rise) goes into the hand,
  then into the road. So the direct sound, the town's air and the echo off
  the houses all follow it, and both bands and their drums with them. The
  stage multiplies. It overwrites nothing, and the band's `LEVEL` and the
  two-band trim are untouched.
- **The instruments drawer** has no band stop: the band is a guest and feeds
  the wide send, not a layer. So the caterpillar is the only band volume,
  and the master volume multiplies it as it does everything else.
- **Only the marching band.** A band made into a road is a band that
  marches. The dawn trombones (a distance stage of their own) and the choir's
  partner cornet (in the house) are made with `VoicesBand.create` too, but
  never into a road, so they get no hand. The handcart company walks a road
  but is not a `VoicesBand`, so it gets none either. (See request 1.)
- **At 0 the band is silent but still in the meeting:** its timing, its
  notes on the staff, the minutes and `guest-start`/`guest-end` are all
  unchanged. The town's air rings out naturally after the hand closes
  (2.6 s), as a hall would. It is not cut.

## Knobs

| knob | where | value | what it does |
|---|---|---|---|
| `FEET` | kolob-ui.js (`?catfeet=1`) | off | tiny paired ink feet under every other segment |
| `N` | kolob-ui.js | 12 | body segments (the head is the 13th) |
| `SPEED`, `CRAWL_MIN_S`, `CRAWL_MAX_S` | kolob-ui.js | 130 px/s, 2.5, 3.6 | how fast it crawls, and how long a crawl may take |
| `BUNCH` | kolob-ui.js | 0.42 | the share of each pulse the rear takes to bunch up |
| `SETTLE_S`, `LETGO_S`, `TURN_S`, `QUICK` | kolob-ui.js | 0.4, 0.3, 0.36, 0.35 | lying down, letting go, turning, and STOP's speed-up |
| `LINGER_S` | kolob-ui.js | 1.5 s | how long after the last drum it waits before leaving |
| `HUMP` | kolob-ui.js | row 7, rule 5 px | how high the fully bunched body arches |
| `TRACK_MAX`, `TRACK_MIN`, `GAP` | kolob-ui.js | 170, 96, 22 px | the slider's length, the least that stays mid-row, the room each side |
| `--seg`, `--seg-h`, `--head` | kolob.css | 11 × 9 px, 13 px (15 on touch) | segment and head sizes |
| `HAND_GLIDE_S` | kolob-voices-band.js | 0.05 s | the glide to a new setting (three time constants) |
| the range's `max` | index.php | 150 | the top of the travel, in percent |

## Choices

- **No feet (chosen).** With feet (the variants sheet) the segments read as
  a drawn creature, closer to illustration than to ink on a console. Without
  them the body still reads as a caterpillar from its segments and its
  motion alone, and lying down it reads first as a slider. `?catfeet=1`
  shows the other way.
- **The head is an ink beehive, not brass.** It has the same pointy-top
  hexagon as the master's thumb, smaller, in the page's green ink with the
  master's pale inner line, so the two controls read as siblings. The
  master's brass stays the one bit of brass on the page. On focus the head
  turns gilt, the page's colour for what moves.
- **The segments are the dots' rings, small** (paper-filled, 1.2 px ink
  line), overlapping a little at 100 %, so the body reads as one segmented
  thing and not a string of beads. They taper toward the tail, so which end
  is the head is clear.
- **Its length is the setting.** A body that bunches as the band is turned
  down made the owner's picture of a caterpillar into the slider itself,
  where a fixed track would only have been decorated.
- **Crawl timing:** about 3.4 s in at 860 (seven pulses) and 2.5 s at 390
  (five). About 3.9 s off at 860 and 3.5 s at 390, including letting go
  and the turn.
- **"The visit"** is the page's life: the setting lives in memory, not
  storage, so a reload starts at 100 %. It survives a new seed (the gather
  button): it is the listener's hand, not the meeting's dice.

## How it was checked (all silent)

Muted headless Chrome over CDP (`--headless=new --mute-audio`, port 9501,
profile `kolob-caterpillar-chrome`), OfflineAudioContext renders, and the
harness. Scripts are in the crew's scratchpad.

| check | result |
|---|---|
| **the band's level follows the control** (offline: the real `GuestBands.perform` with two bands, standing in the street; seed 2, Tabernacle; the hand moved at exact times with `suspend()`; the renders compared sample for sample) | 100 %: ×1.000 (0.00 dB). Dragged to 40 % in 0.4 s: ×0.400 (−7.96 dB), exact to 1.3e-8 against a peak of 0.16. 0 %: exactly 0 (peak 0) once the town's air has rung out (the first 2.9 s after the move: the air dying away). Both bands follow the one hand (the second enters at 19.1 s, inside the 40 % window). |
| **no clicks, no zipper** (the hand itself: a DC probe through a marching band's out and hand, tapped at the road's input) | 1.000 → 0.400 as a smooth ramp while dragged (setTarget every 16 ms); 0.4 → 0: 90 % → 10 % in 36.6 ms, 95 % of the way in 50.3 ms; the largest step between two samples is 5.4e-4. The band's sharpest sample-to-sample jump around each move is smaller than the unmoved render's (drag 0.0189 against 0.0225; to zero 0.0066 against 0.0182). |
| **nothing else in the mix changes** (a band voice in a distance of its own and one in the house, the dawn trombones' and the partner cornet's ways, and a road with no band on it, the handcart's way, rendered with and without the hand's moves) | the largest difference is 1.5e-8 (float rounding, against a peak of 0.14). The mix with the hand moved equals the others unmoved plus the band moved, to 3.4e-8. |
| **the harness** | `300 7`: PASS, and `1250 22 force=bands`: PASS. Both logs are identical to the pre-change baselines apart from one planner-timing line each (0.5 → 0.6 s, 0.6 → 0.7 s). |
| **the visit, 860 and 390** (`?seed=22&guest=bands`) | arrives at 8.2 to 8.5 s (the band's start); a real mouse drag from 100 % to 40 %, and the arrow keys (right, right, left, left: back to 40); `getBandVolume()` 0.4; leaves at 87.7 to 87.9 s (the last stroke 86.1 to 86.2 s plus the linger); the row after is as before; the scroll width equals the viewport throughout; **0 console errors** at both widths |
| **transport** | PAUSE mid-crawl: all 13 animations paused, the crawl's time and the audio clock unmoved over 2 s (909 ms and 9.38 s, then 909 ms and 9.38 s); it resumes and lies down. PAUSE while lying down: still there. STOP: a quick crawl off (1.36 s at 860), the focus let go, then hidden. The gather button: gone at once. The dev jump (`skipToSection`): a quick crawl off, then gone. |
| **a hidden tab** (`document.hidden` faked, and for real: a page left in a background window) | arriving while hidden: lain down, with no animation; on return, still lying there and nothing replayed. The band leaving while hidden: gone, with no animation; on return, gone. |
| **it remembers** | set to 40 %, STOP, PLAY: the next meeting's band arrives at 40 % (value 40, `getBandVolume()` 0.4, the head at the same place, `aria-valuetext` "40 percent") |
| **reduced motion** (emulated) | one 600 ms opacity fade in, and one out on STOP; no crawl |
| **other widths** | 720: mid-row (range 264 to 369, STOP ends at 217, VOL starts at 391). 600 and 320: on the rule (the range ends at 181, the master starts at 193). No overlap, and no sideways scroll. |
| **never otherwise** | `?seed=7&guest=trombones` at 390 for 150 s: the dawn trombones came (6.2 to 62.9 s; they are the other guest built on `VoicesBand`), and the caterpillar stayed away and hidden at every one of 150 readings, with `getBandHeardUntil()` at 0 throughout. (A 240 s run with `?guest=handcart` saw no guest at all in that time, so it proves nothing either way.) The page code reads only `guest-start` with `guest === "bands"`. |
| **what it costs** (860, 4× CPU throttle, a trace across the arrival) | the arrival is one 14.4 ms task at 4× (about 3.5 ms at 1×: the poll's usual 3 to 4 ms, 4.4 ms for the 13 `animate()` calls, 1.9 ms of layout reads). The lying-down task is 5.2 ms. During the crawl the busiest task is 5.2 ms against 4.6 ms lying still; while any animation runs, Blink's lifecycle adds 93 style passes over the 3.35 s (38 ms in all, 0.4 ms each, at 4×). No per-frame script. |

## Requests

1. **GuestBands owner (`kolob-guest-bands.js`).** The hand finds the band by
   what it is: a `VoicesBand` made into a `road()`. That is exact today. If
   another guest ever walks a `VoicesBand` down a road, it would be governed
   by the band's caterpillar too. A one-line opt-in would make it explicit:
   `VB.create(ctx, rd.input, { …, marching: true })`, read in
   `create()` in place of the road test. Not needed now.
2. **The integrator: SCORE.md.** Add beside `setForceVisitation` (about line 358):
   `KolobAudio.setBandVolume(v)` (0 … 1.5, the marching band only, 50 ms
   glide), `getBandVolume()` and `getBandHeardUntil()` (the audio time the
   last note or drum of the band in the street stops, 0 if none). Note also
   that a band's `guest-start.until` is its stinger plus a second, and its
   drums sound for 16 to 21 s past it.
3. **The integrator: VERSION.** This is user-facing (the owner will see it
   and can hear the difference when he moves it). Suggested line:
   `… — the band's caterpillar: a volume for the band alone crawls onto the
   console when the band comes, and off when it has gone`.

## Known issues and limits

- **On a phone it lies on the rule, not between STOP and VOL**, because
  there is no space between them there: the master slider takes the whole
  row. That is the only honest fit that pushes nothing. If the owner would
  rather it share the row on a phone, the master slider would have to give
  up some of its width while the band is in the street. That would be a
  small change, but it breaks the plan's "don't push the master".
- **Nobody has watched it move at full frame rate.** Headless Chrome draws
  about one frame a second, so every frame here was stepped. The gait's
  speed, its bunching and the turn want the owner's eye in a real browser.
- **The turn** is the body foreshortening to a small bunch and opening the
  other way: right for a side view, but brief (0.36 s) and the least
  caterpillar-like moment. `TURN_S` sets it.
- **The town's air after 0.** Turning the band to 0 closes the hand, and the
  last 2.6 s of the town's reverberation dies away naturally. This is by
  design, since the hand sits ahead of the road.
- **`heardUntil` runs a bar or two ahead of the sound** while the band plays
  (its bars are laid 2.5 s ahead). It matters only at the very end, where
  it settles on the last stroke.
