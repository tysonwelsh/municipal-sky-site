# ZANKYŌ — where the signal is SEEN: four layouts for the broadcast monitor

*Design plan, 2026-09-05. Four independent mockups follow; the owner picks
elements from each. Companion to PLAN-BROADCAST-SIGNAL.md (the sound and the
picture pipeline) — this document is only about WHERE the picture lives on
the faceplate and HOW it looks when it does.*

## What stays

The owner likes the current instruments: the CRT scope (spectrum + waveform,
"MSHI CRT-19"), the 段階 DEVELOPMENT segmented LED bargraph under it, the
console, the VFD activity log. None of these move or change character. The
signal is a *visitation* — rare, five to fifteen seconds — so the monitor's
**idle state** matters more than its playing state: for 99 % of the night it
is a dead or barely-alive tube. Every option must answer "what does it show
when nothing is coming in?" with something worth looking at.

## The shared style brief (all four)

- **The artist is Nam June Paik.** Television as raw material: *Magnet TV*
  (a magnet on the cabinet bends the raster into a bloom), *Zen for TV* (a
  broken set reduced to one vertical/horizontal line of light), *TV Buddha*
  (a small set watched by a statue — the intimacy of a tiny screen), *TV
  Garden* and *Electronic Superhighway* (stacks and walls of sets), *Good
  Morning, Mr. Orwell* (a satellite broadcast as performance). The picture
  should feel *bent*, not merely filtered: raster distortion, vertical
  hold slipping, the image folding into a line and unfolding from it.
- **The machine is ZANKYŌ's:** Municipal Sky Heavy Industries, 製造番号
  plates, silk-screened kanji labels (映像管, 受信, 電源), screws with
  slots, rust blooms, a thumb-smudge on the glass. Same palette
  (`--bg #050507`, neon `--red #ff2d55`, `--cyan #16e0e0`, `--magenta
  #ff3df0`, `--amber #ffb000`, steel greys), same fonts (Orbitron,
  Shippori Mincho, JetBrains Mono). New hardware must look like it was
  bolted on by the same yard, in a different decade.
- **Phosphor:** the picture is monochrome on a tube. Default P39 green;
  each option may argue for another (P4 blue-white, amber P3) but must show
  it. Scanlines, bloom, a ghost offset, snow at low signal, a frame-hold on
  dropouts (all from PLAN-BROADCAST-SIGNAL §2.5).
- **The gesture:** tuning in (0.4 s of snow resolving), holding (5–15 s),
  loss (tear, roll, collapse to a line, snow, dead) — and the 受信 SIGNAL
  lamp somewhere, plus one attribution line in the VFD ("受信 · Duck and
  Cover · 1951").
- **Real reels:** the mockups play actual reels from the pool
  (`art/zankyo/broadcast/reels/*.mp4`, manifest.json) through a canvas
  phosphor shader, so the owner judges the real thing.
- **Mobile:** the faceplate is 860 px max and stacks under 700 px; every
  option must say what happens there.

## The four options

### 1. 隣 THE SECOND SET — the owner's layout

A second, smaller, older monitor bolted to the RIGHT of the existing scope
+ bargraph stack; the stack narrows to make room (roughly 60 / 40). The
new set is a 4:3 tube with a **cracked glass**: a real crack (SVG) whose
branches refract the picture (sliced and offset a few pixels across the
crack lines), a chip missing from one corner, tape on the bezel. Brand
plate "映像管 · MSHI CRT-9 · 受信専用". Idle: the tube is dark but not
dead — a faint raster glow, an occasional flicker of a test card ghost,
Paik's single line of light appearing now and then. Playing: the picture
inside the crack, green phosphor. Mobile: the second set stacks under the
bargraph at full width.

### 2. 割込 THE INTERRUPT — no new hardware

The signal hijacks the existing scope. When a broadcast is seated, the
spectrum collapses to **one horizontal line of light** (*Zen for TV*),
the line thickens, the vertical hold catches, and the picture unfolds out
of it; on loss it folds back into the line and the scope returns. The
only additions are a 受信 tally lamp and a two-digit channel counter on
the monitor chin (nixie or seven-segment), and the VFD line. The most
Paik of the four: one television, bent. Cost: the scope is gone for the
length of the signal (the machine stops to listen). Mobile: nothing to do.

### 3. 壁 THE WALL — Paik's stacks

A **bank of small monitors** — a 4×2 strip between the bargraph and the
console (or 3×3 at the right) — each a tiny tube in its own steel cell,
different vintages, one or two dead, one with a *Magnet TV* bloom. Idle:
the cells show slices of the scope (each tube a band of the spectrum, so
the wall IS a visualizer), slow static, one cell always Paik's line.
Playing: the picture lands on one cell, or is scattered across several,
each tube distorting it its own way; the neighbors go to snow. Mobile:
the strip becomes 2×2 or a single row that scrolls. The most visually
generous; the most hardware.

### 4. 点検窓 THE INSPECTION PORT — a round scope in the chassis

Not a monitor: a small **round tube** behind a hinged inspection hatch on
the chassis — a radar/oscilloscope-style circular CRT (like the small set
in *TV Buddha*, the picture watched through a porthole), with a wire
grille and smeared glass, set into the control rail beside the pitch
module or in the plate row. Idle: a slow rotating sweep, a dot, a faint
grid — a monitoring scope. Playing: the picture appears as a circle, the
sweep revealing it clockwise like a radar paint; loss reverses it. The
smallest footprint and the most diegetic ("a maintenance port that
happens to receive"). Mobile: stays in the rail; it is small already.

## What each mockup must deliver

A standalone page `art/zankyo/mockups/monitor-N-<name>.html` (on the
`zankyo-broadcast` branch, served at http://127.0.0.1:8012/art/zankyo/mockups/)
that reproduces the current faceplate closely enough to judge the layout
(copy the real markup and CSS for marquee, monitor, bargraph, control rail,
console title, VFD block, plate), adds the option's hardware, and plays a
real reel from the pool through a canvas phosphor shader with the tuning
/ hold / loss gesture on a button or a timer. Idle state must be shown and
must move. The page states its phosphor choice, its mobile behavior, and a
one-paragraph argument for itself. No engine code; no changes to the
live files.

## After the owner picks

Elements are chosen across options (the owner's stated intent); a final
brief is written from the picks; the picture pipeline (PLAN-BROADCAST-
SIGNAL §2.5, phase B2) is then built to that brief on the engine branch.
