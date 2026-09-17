# ZANKYŌ — THE SET TAKES THE ROOM

*Design plan, 2026-09-14. The second set moves left, takes 60 % of the bank,
and gets a new casing with a real control bay. Four mockups follow; the owner
picks, or picks across them. Companion to PLAN-BROADCAST-MONITOR.md (which
settled WHERE the picture lives) — this document is about the set becoming the
主役, the thing the machine is for.*

---

## 0. What the monitor is, for the record

`art/zankyo/index.php` → `.zk-bank` → `.zk-bank-side` → `.zk-set2`.

It is **隣 THE SECOND SET**, 映像管 MSHI CRT-9, 受信専用 — a receive-only tube
the yard bolted on later, with a cracked glass and a piece of yellowed tape on
the bezel. `zk-set.js` (≈ 660 lines) drives it: it takes a `<video>` element
playing a reel out of `broadcast/reels/`, pushes it through a P39
long-persistence phosphor LUT, and adds vertical roll, tear bands, multipath
ghost, bloom, snow, dropouts, Paik's collapse-to-a-line, and refraction across
the crack. Its chin carries four things: the brand line, a 20 px 選局 TUNE
knob, a 20 px 受信 push switch, and a 7 px lamp.

Under it sits the **transport plate** (`.zk-rxpanel`) — PLAY, STOP, master
volume. To its left, the **scope** (`.zankyo-viz`, spectrum + waveform) and the
**段階 DEVELOPMENT bargraph** — the two "progress" visualizations.

---

## 1. The measurement that decides the storage question

The owner asked whether making the set bigger means re-downloading the reels at
a higher resolution. **It does not, and the reason is worth reading.**

| | pixels | note |
|---|---|---|
| Reel files on disk | **192 × 144**, 12 fps, grayscale, crf 30 | 252 reels, 220 MB |
| What `zk-set.js` actually renders | **96 × 72** (`SW`, `SH`, line 197) | **¼ of the pixels the files hold** |
| Tube on screen today (desktop) | 276 × 207 CSS px | ≈ 2.9 screen px per phosphor cell |

The shader throws away three quarters of the picture before it ever reaches the
tube. Here is the same frame — BBC1 test card, 1979 — at both rasters, blown up
identically:

- `96 × 72`: a green mush. You cannot read "BBC 1"; you cannot tell there is a
  girl and a blackboard in the middle.
- `192 × 144`: the test-card grid, the noughts-and-crosses board, the face, and
  the word **BBC 1** are all legible.

**Consequence.** Raising `SW, SH` from `96, 72` to `192, 144` costs **zero new
bytes and zero downloads** — the detail is already in the files. And it more
than pays for the bigger tube:

| | today | proposed |
|---|---|---|
| Tube width | 276 px | **428 px** (60/40 at the current 860 frame) |
| Raster | 96 × 72 | 192 × 144 |
| Screen px per source pixel | 2.88 | **2.23** — *finer than today* |

So the picture gets **55 % bigger and visibly sharper at the same time**, for
free. Nothing is stretched beyond its native size; on the contrary, we stop
discarding what we have.

**If we ever did want more.** The reels were cut by `broadcast/tools/make-reel.sh`
from YouTube sources that are **not cached locally** — a re-encode at 320 × 240
means re-downloading all 252 sources, at real risk (dead videos, rate limits,
an entire curation round to redo) and an estimated **450–500 MB** on the host
(≈ 2.1× at the same crf; estimate, not measured). **Recommendation: don't.**
Not now, and probably not ever at this tube size — at 428 px wide, 192 × 144 is
already 2.2 screen pixels per source pixel, which is more than the phosphor
treatment can use.

### 1.1 The cost that is real: CPU

The per-pixel phosphor loop goes from 6,912 px/frame to 27,648 px/frame — **4×**.
Measured frame cost is in the probe numbers below; if it bites on a phone, the
mitigation already exists in the file (`lowPower`) and the honest fallback is
**128 × 96** (1.8× the work, still 1.8× today's detail). One of the four
mockups turns this into a *feature* — a FOCUS control — rather than a constant.

---

## 2. The layout

### 2.1 Desktop — the set goes left and takes 60 %

`.zk-bank` is a two-column grid. Today `3fr 2fr` with `.zk-bank-main` (scope +
bargraph) first. The change is two lines:

```css
.zk-bank      { grid-template-columns: 3fr 2fr; }  /* unchanged: 60 / 40 */
.zk-bank-side { order: -1; }                        /* the set takes column 1 */
```

Numbers at the current 860 px frame (774 px of content, 14 px gap):

| | today | after |
|---|---|---|
| Set column | 304 → tube **276 × 207** | 456 → tube **428 × 321** |
| Scope column | 456 → viz **426 × 200** | 304 → viz **≈ 274 × 200** |
| Bargraph cell (56 cells) | 5.2 px | 3.0 px |

**The one cost to look at: the scope loses a third of its width.** 274 px is
still a legible spectrum, and 3.0 px bargraph cells are wider than the phone
already runs — but it is a real trade, and it is the trade the owner asked for.

**A free 100 px, if wanted.** `.zankyo-scene` self-limits to `max-width: 860px`.
The site's own wide measure (`--max-wide`) is **960 px** — the ZANKYŌ panel is
narrower than the page it sits in for no reason but history. Raising it to 960
sits the faceplate flush with the site's widest content and gives:

| at 960 | |
|---|---|
| Set column 516 → tube | **488 × 366** (77 % bigger than today) |
| Scope column 344 → viz | **≈ 314 × 200** (only −26 % instead of −36 %) |

**SETTLED (owner, 2026-09-14): take the 960.** Exact numbers at 960:

| | value |
|---|---|
| `.zankyo-scene` | `max-width: 960px`, padding `8px 16px` → 928 |
| `.zankyo-frame` | padding `30px 26px` + 1 px border → **874** of content |
| bank, `gap: 0 14px` | 860 across the two columns |
| set column (3fr) | 516 → `.zk-set2` padding 13 + border 1 → tube **488 × 366** |
| scope column (2fr) | 344 → `.zk-monitor` padding 13 + border 1 → viz **316 × 200** |
| bargraph cell (56 cells, 2 px gap) | ≈ 3.7 px |

### 2.2 Mobile — the set goes above the two visualizations

At ≤ 700 px `.zk-bank` collapses to one column and the order is fixed by the
markup: scope, bargraph, set, transport. To put the set on top without moving
anything in `index.php`:

```css
@media (max-width: 700px) {
  .zk-bank { grid-template-columns: 1fr; row-gap: 14px; }
  .zk-bank-main, .zk-bank-side { display: contents; }
  .zk-set2     { order: 1; }   /* the television */
  .zk-monitor  { order: 2; }   /* the spectrum scope — the bars that follow the sound */
  .zk-bargraph { order: 3; }   /* 段階 — the long, short bar that shows the progress */
  .zk-rxpanel  { order: 4; }   /* PLAY · STOP · master volume, at the bottom */
}
```

The tube's **size on mobile does not change** (it is already full width, ≈ 316
px at a 390 px phone) — exactly as asked. It does get sharper: 1.65 screen px
per source pixel instead of 3.3.

**SETTLED (owner, 2026-09-14):** the television, then the spectrum scope, then
the 段階 progress bar, then PLAY / STOP / volume at the bottom — the owner's own
enumeration, in those words.

---

## 3. What is wrong with the casing now

Looking at the render at full resolution:

- **The bevel is a rounded dark rectangle.** It has a nice yellowed-plastic
  gradient and a deep inner shadow, but no *moulding* — no draft angle, no
  parting line, no grille, no vent, no corner radius that varies, nothing a
  real injection-moulded cabinet has. It reads as a CSS card with a screen in it.
- **The chin is 30 px of leftovers.** Brand text, a 20 px knob, a 20 px square
  button, an 8 px label and a 7 px lamp, all crammed on one line with 7 px gaps.
  The knob is the smallest control on the whole faceplate — the console's own
  volume knobs are 44 px.
- **The two controls carry no weight.** 選局 is a plain dark circle with a
  white pointer; 受信 is a dark square with a smaller dark square in it. Next to
  the big arcade PLAY button 40 px below them, they look like placeholders.
- **There is nowhere to put anything else.** Adding a third control today means
  making the chin taller, which is the whole problem.

**The brief for all four: a control bay, not a chin.** At least **64 px tall**
across the full 456 (or 516) px of the column, or an equivalent side rail,
holding **five or six controls at console scale** (36–48 px), with room to
silk-screen them.

---

## 4. The shared style brief (all four mockups)

Unchanged from PLAN-BROADCAST-MONITOR.md, restated because it still governs:

- **The artist is Nam June Paik.** *Magnet TV* (a magnet on the cabinet bends
  the raster), *Zen for TV* (the set reduced to one line of light), *TV Buddha*
  (a small set on the floor, watched), *TV Garden*, *Good Morning, Mr. Orwell*.
  The picture is **bent**, not merely filtered. The television is **raw
  material**, a thing with a back and a chassis and a magnet you can put on it —
  not an appliance.
- **The yard is Municipal Sky Heavy Industries.** 製造番号 plates, silk-screened
  kanji (映像管, 受信, 選局, 同期, 焦点), slotted screws, rust blooms, thumb
  smudges on the glass. Palette and fonts unchanged (`--bg #050507`, `--red
  #ff2d55`, `--cyan #16e0e0`, `--amber #ffb000`, steel greys; Orbitron, Shippori
  Mincho, JetBrains Mono). New hardware looks bolted on by the same yard in a
  different decade.
- **Idle matters more than playing.** The signal is a visitation — the set is
  dark or barely alive for most of the night. Every option must show an idle
  state that moves and is worth looking at.
- **The picture is real.** Mockups play actual reels from `broadcast/reels/`
  through the phosphor shader at **192 × 144**, with the full gesture: tune-in
  (0.4 s of snow resolving), hold, dropouts, loss (tear → roll → collapse to a
  line → snow → dead).
- **The crack survives** unless an option argues otherwise on the page.
- **No skeuomorphism for its own sake.** Every moulding, screw and scuff has to
  be load-bearing — it says what the object is made of and how old it is. A
  bevel that is just a gradient is what we are replacing.

---

## 5. The four mockups

Two are **interface-first** (A, B): the control vocabulary is chosen because it
is good hardware, and what each control does is left open. Two are
**variable-first** (C, D): the interesting playback variable is chosen first and
the control is designed for it.

---

### A — 磁石 THE MAGNET SET *(interface-first)*

**The object.** A 1970s moulded-ABS portable television: yellowed cream plastic
with a visible parting line down the cabinet side, a draft angle on every face,
a moulded speaker grille of fine horizontal slots up the right edge, a **flip-up
carry bail** in chromed wire folded flat on top, and four rubber feet peeking
under the bottom edge. The tube is set deep in a thick bezel with a genuine
compound curve — the glass is proud of the plastic, and you can see the shadow
where it sits in the gasket.

**The signature.** A real **horseshoe magnet** rests on the cabinet, red-painted
with bare steel poles. **You can drag it anywhere on the set** — and wherever it
sits, the raster bends toward it: a local pincushion bloom, the scanlines
swelling and curving into the poles, the picture smearing where the field is
strongest. Park it on the top-left corner and leave it there. This is *Magnet TV*,
1965, as a control you operate with your hand. It is the one control on the
whole faceplate that is an **object rather than a widget**.

**The control bay** — a wide moulded shelf under the tube, angled ~12° toward
the viewer, with the moulding drawn in light and shadow rather than a border:

| control | form |
|---|---|
| 4 × **piano keys** | the latching kind from a portable TV — cream plastic, travel, a satisfying offset when down, a red band on the front edge of the one that is latched |
| 1 × **large rotary** | 44 px, fluted grip, brass insert, a pointer that casts a shadow on the plate |
| 1 × **slide fader** | 70 px of travel in a moulded slot, a ridged thumb pad, a scale printed beside it |
| the **magnet** | dragged; it stays where you leave it |

**Idle.** The tube is dark but alive: a faint raster glow, an occasional
horizontal line of light crossing it, and — if the magnet is on the cabinet —
a slow pulsing bloom around it, as if the field were breathing.

**Mobile.** The shelf wraps to two rows; the magnet snaps to the cabinet's edge
and stays draggable. Full tube width.

**Why it might win.** It is the most *playful* and the most literally Paik. The
magnet is a thing you fiddle with while the music plays, which is the right
relationship to a machine that makes music by itself.

---

### B — 修理台 THE SERVICE BENCH *(interface-first)*

**The object.** The set **with its cabinet off**. No bezel at all — the bare CRT
is clamped in a steel frame, and you can see behind the glass: the grey bell of
the tube narrowing away, the **deflection yoke** in copper windings with a
cable-tied harness, the neck board on its socket with a purple anode cap, and
the dusty chassis pan underneath. The picture floats on the front glass with
nothing framing it but the tube's own rolled edge and two clamp brackets top and
bottom. A hazard decal — 高電圧 — on the chassis.

**The control bay** — a **service rail**: a strip of olive-green phenolic board
bolted below the chassis, with real component furniture on it. You do not
operate this set, you service it.

| control | form |
|---|---|
| 3 × **trimmer pots** | slotted brass screws in ceramic bodies; the cursor becomes a screwdriver over them and you turn them in small increments |
| 1 × **rotary wafer switch** | 6 positions, a big black skirt with a white index line and detents you can hear, positions silk-screened on the board |
| 2 × **guarded toggles** | steel bat handles under red flip-guards you must lift first |
| 1 × **push-to-test** | a bare momentary switch with a bulb behind it |
| 4 × **test points** | brass turrets you can clip to — decorative, but the scope's trace jumps when you do |

**Idle.** A dim raster and a slow horizontal sync bar drifting up the tube; the
yoke's copper catches a specular highlight that moves with the page scroll. Now
and then one line of light — *Zen for TV* — and nothing else.

**Mobile.** The chassis-behind view flattens (the bell and yoke crop away); the
service rail becomes two rows of three.

**Why it might win.** It is the most honest to what ZANKYŌ already is — a
machine with its guts showing, 機動注意 stencilled on the console. It also
justifies a very large control area without apology, because a service rail is
*supposed* to have eleven things on it.

---

### C — 放送架 THE RACK MONITOR *(variable-first)*

**The variables, chosen first.** These are the four that change *what you
receive*, not how it looks:

1. **時代 ERA — decade bias.** The pool spans **1936 → 2024** and is wildly
   uneven: 1980s 107 reels, 1990s 45, 1970s 36, 1960s 21, 1950s 17, 1940s 8,
   2010s 8, 2020s 5, 2000s 3, 1930s 2. Biasing the lottery by year is a
   one-line change to the existing weighting in `zk-broadcast.js` and it is the
   single most *legible* thing the owner could be given: "tonight, the fifties."
2. **滞留 DWELL — how long a picture stays.** Holds are 5–15 s today out of
   windows 8–36 s. At the far end of this control the picture **never leaves** —
   the set becomes a continuous television rather than a visitation. That is a
   real mode change and should be a control the owner can feel themselves
   choosing.
3. **音色 TONE — what kind of transmission.** 199 voice, 21 music, 16 tone, 11
   sung, 4 noise, 1 drone. Already a weighted field in the code.
4. **頻度 RATE — how often the station tunes something in.**

**The object.** A **19-inch rack monitor**: rack ears left and right with
slotted screws through elongated holes, a perforated-steel face with a fine
punched pattern, a proper **broadcast tally lamp** above the tube, a two-digit
**channel readout**, and a black anodized handle on each side. The most
institutional of the four — this is the set in a master-control room, not a
living room.

**The controls, designed for those variables:**

| variable | control |
|---|---|
| **時代 ERA** | a horizontal **drum dial** — a knurled cylinder you spin, years scrolling past behind a glass window with a hairline index, exactly a shortwave receiver's logging dial. Behind the numbers, **the pool's own histogram is etched into the drum**: the 1980s band is tall, the 2000s band is a sliver. The control *teaches you what the archive is made of.* |
| **滞留 DWELL** | a **slide fader with four detents**, silk-screened 一瞬 · 短 · 長 · 常時 (instant · short · long · always). The last detent is past a small mechanical stop you have to push through. |
| **音色 TONE** | five **illuminated lozenge buttons** in a row — 声 音楽 音 歌 雑 — latching, multi-select, each lit in its own colour when armed |
| **頻度 RATE** | a **stepped thumbwheel** at the right edge with numbers in a window |
| | plus the **tally lamp** and the **channel readout** as pure output |

**Idle.** The tally is dark; the channel readout shows `--`; the tube runs a
slow monitoring pattern — a dim pulse crossing on a period that matches the
station's own cycle, so the idle set is still telling you where the night is.

**Mobile.** Rack ears crop to a hairline; the drum dial goes full width as its
own row above the rest, because it is the control worth the space.

**Why it might win.** It is the only one of the four where the controls
*mean* something the owner would actually reach for on a given night. The drum
dial with the archive's histogram on it is the best single idea in this document.

---

### D — 座 THE PEDESTAL SET *(variable-first)*

**The variables, chosen first.** These are the four knobs a real CRT actually
has, and the four that most change the picture's *character* — all of them are
already variables inside `zk-set.js`, currently hardcoded:

1. **焦点 FOCUS — the raster resolution** (`SW`/`SH`). Sweeps **192 × 144 →
   48 × 36**: from the sharpest the archive can give to a Paik mush where the
   picture is pure moving blocks of green. This is §1's finding turned into a
   knob, and it is the most *aesthetically* powerful control available.
2. **同期 HOLD — vertical hold** (`S.roll`, `S.rollV`). Detented at centre =
   locked. Off the detent the picture **rolls continuously**, faster the further
   you go, with the blanking bar sweeping up the tube. Every television ever
   made had this knob and it is the purest Paik gesture there is.
3. **残光 PERSISTENCE — phosphor decay** (`decay`). From a fast P4 wipe to a
   long P39 smear where movement leaves comet trails on the glass.
4. **輝度 BRIGHTNESS — bloom and gain.** The ordinary one, which makes the other
   three legible.

*(If a fifth is wanted: **蛍光体 PHOSPHOR**, a tube-type selector — P39 green,
P4 blue-white, P3 amber, P1 — swapping the LUT. Purely visual, instantly read.)*

**The object.** *TV Buddha*, 1974: a small set **on the floor on its own
pedestal**, not bolted into a faceplate. A spun-aluminium drum cabinet with a
turned base, a circular seam where the two halves meet, and a single bead of
weld. The tube is **round-cornered and nearly square**, deeply recessed, its
glass slightly domed and grubby with a thumbprint. The set is the smallest
object of the four and the most like a sculpture — it sits *in front of* the
faceplate rather than in it, with a soft shadow cast on the steel behind.

**The controls.** A **quarter-round control bank** cast into the pedestal,
angled up toward the viewer, carrying four **concentric dual knobs** — a large
fluted outer ring with a small knurled inner knob at its centre, like a real
service remote — each over an engraved scale plate with a pointer that casts a
real shadow. FOCUS and HOLD have a **centre detent you can feel** (a click and a
tiny snap in the pointer). One large **momentary paddle** (受信) sits alone to
the right, big enough to hit with a thumb.

**Idle.** The tube is dark. Every so often — on the station's own clock, not a
timer of its own — a single line of light opens across it, holds for a beat, and
closes. Nothing else. The most restrained idle of the four, and the most Paik.

**Mobile.** The pedestal loses its base; the quarter-round bank flattens into
two rows of two knobs plus the paddle. Tube stays full width.

**Why it might win.** It gives the owner the four controls that change the
picture the most, at a size worth touching, in an object that reads as art
rather than equipment — which is what a Paik reference is actually asking for.

---

## 6. Settled by the owner, 2026-09-14

1. **Frame width — 960.** `.zankyo-scene { max-width: 960px }`, the site's own
   `--max-wide`. Tube 488 × 366; scope 316 × 200.
2. **Mobile order — television, spectrum scope, 段階 progress bar, PLAY/STOP/volume.**
3. **Raster — 192 × 144**, the reels' native size.
4. **Nothing struck.** All four are built.

---

## 7. What each agent delivers

One standalone page per option, following the existing precedent
(`art/zankyo/mockups/monitor-1-second-set.html` … `-4-inspection-port.html`):

```
art/zankyo/mockups/set-A-magnet.html
art/zankyo/mockups/set-B-service-bench.html
art/zankyo/mockups/set-C-rack.html
art/zankyo/mockups/set-D-pedestal.html
```

Each page:

- reproduces the **real faceplate** closely enough to judge the layout — the
  bank, the scope, the bargraph, the control rail, the console title strip, the
  VFD block and the plate row, copied from `index.php` / `zankyo.css`;
- lays it out **at the agreed width, 60 / 40, the set on the left**, and shows
  the **mobile stack** too (a width toggle on the page, 390 / 860 / 960);
- plays **real reels** from `broadcast/reels/` through the phosphor shader at
  **192 × 144**, with tune-in / hold / dropouts / loss on a button and on a
  timer, and an **idle state that moves**;
- builds the **casing and the full control bay** as described, with every
  control **operable** — even where (options A and B) what it controls is left
  open, the control must move, latch, detent and light correctly under the hand,
  because that is the thing being judged;
- for options **C and D**, wires each control to its variable **for real** where
  the mockup can (FOCUS, HOLD, PERSISTENCE, BRIGHTNESS, PHOSPHOR are all local
  to the shader; ERA / TONE / DWELL / RATE are simulated against the real
  `manifest.json` so the drum dial's histogram and the tone counts are the
  archive's actual numbers);
- states on the page: its phosphor choice, its mobile behaviour, its measured
  frame cost at 192 × 144, and a one-paragraph argument for itself.

**No engine code. No changes to any live file.** Mockups only, on a branch, for
the owner to pick from — elements get chosen across options, as last time, and a
final brief is written from the picks.

---

## 8. After the pick

The chosen casing and bay are built into `zankyo.css` / `index.php`, the layout
change lands (`order: -1`, the mobile `display: contents` reorder, the frame
width), `SW`/`SH` go to 192 × 144 in `zk-set.js`, and the chosen controls are
wired to their variables. That commit bumps `art/zankyo/VERSION` — it is about
as user-facing as a change gets.

---

## 9. Found while building the four — carry these into the real build

1. **`aspect-ratio` on a shrinkable flex item is not honoured by WebKit.** Option
   C shipped `.zk-tube { aspect-ratio: 4/3 }` as a `flex: 0 1 auto` item inside a
   flex wrapper inside the grid. Blink resolved the ratio and gave 488 × 366;
   **WebKit resolved the row height first and let flex-shrink squash it to
   488 × 274** — a 4:3 raster drawn into a ≈16:9 canvas, every reel horizontally
   stretched. It looked perfect in Chrome and would have shipped broken to Safari
   and every iPhone. The tube's ratio must be **percentage padding**, which
   resolves against the element's own width in every engine and cannot be shrunk:

   ```css
   .zk-tube-wrap { position: relative; display: block; height: 0; padding-bottom: 75%; }
   .zk-tube      { position: absolute; inset: 0; box-sizing: border-box; overflow: hidden; }
   ```

2. **Verify layout in WebKit, not only in Chrome.** The above is invisible in
   Blink. `c11 --json browser open <url>` then `c11 browser <ref> eval
   "JSON.stringify(document.querySelector('.zk-tube').getBoundingClientRect())"`
   is enough. Layout measurement works in a background c11 workspace even though
   rAF is suspended there — geometry asserts are reliable, frame-cost numbers are
   not.

3. **The CPU question is settled: 192 × 144 is affordable.** Measured across the
   four, 3.0–6.9 ms mean per frame at the 488 px tube, worst 5.5–14.2 ms, inside
   the 16.7 ms budget with the GPU disabled. The cost is driven by the tube's
   size on screen (bloom blur, nine tear bands, shard compositing), **not** by
   the raster — the per-pixel LUT pass is a fixed 27,648 px either way. The 700 px
   breakpoint, where the set runs full width, is the most expensive layout, not 960.

4. **The settled layout leaves ~250–280 px of bare faceplate** under the scope
   column, because the set column is ~590 px tall against the scope column's
   ~300. Option B's answer is the right one and should be ported to whichever
   casing wins: keep `display: contents` on both bank halves at **every** width,
   not just mobile, and let column 2 carry scope → 段階 → transport.

5. **The archive's live shape** (excluding the two `takedown` reels) is 250 reels,
   1936–2024: `1930s 2 · 1940s 8 · 1950s 17 · 1960s 20 · 1970s 35 · 1980s 107 ·
   1990s 45 · 2000s 3 · 2010s 8 · 2020s 5`; tones `voice 198 · music 21 ·
   tone 15 · sung 11 · noise 4 · drone 1`. The counts in §5 C above include the
   takedowns and are superseded by these.

---

## 10. THE MAP — settled, 2026-09-16

**M1 · 標 THE TALLY wins.** M2 (region tuner) and M3 (night chart) are deleted,
locally and from the live host. They remain recoverable from commit `f1fdc50`,
and their final verified versions are kept in this session's scratchpad under
`retired-maps/`.

### The strip-down (owner: "just the map")

Not yet built — the monitor casing is settled first. When it is, from
`mockups/map-M1-tally.html` keep **only** the ribbon and remove the furniture:

| element | what it is | disposition |
|---|---|---|
| `.zk-ribbon-wrap` → `#map-canvas`, `.zk-bed`, `.zk-glass`, `.zk-ribbon-brand` | the ribbon itself: 488 × 146 at 960, aspect 3.33, holding to 326 × 98 at 390 | **KEEP** |
| `.zk-rail` (`#rail`) | the "compass" — the 経度 longitude scale above the ribbon, with its travelling mark and label | **REMOVE** (owner) |
| `.zk-bench` | six demo buttons (受信 / 国 / 遠 / 弧 / 軌 / 点呼) | **REMOVE** — mockup-only; its own comment already says "the shipped ribbon has no controls" |
| `.zk-fix` (`#fix`) | the 位置 readout plate: country code, place name, coordinates, confidence, tally | **OPEN — ask the owner.** See below. |

### The one open question: the 位置 plate

"All the other controls" and "just the map" read as removing this too, but the
plate is a **readout, not a control**, and M1's own declared weakness was that
with no interaction *the plate is the only way to learn a place name*. Strip it
and a dot glows over the Nile and the viewer never learns it is Cairo.

Three ways out, for the owner to pick when the casing is settled:
1. **Remove it.** The map becomes pure ambient indication — you see *that*
   somewhere is transmitting, never *where*. Cleanest, and consistent with the
   station's existing reticence.
2. **Keep one line.** Drop the plate to just the place name, set in the VFD
   register, under or beside the ribbon.
3. **Move it into the VFD.** The 活動 ACTIVITY log already prints a 受信 line per
   reception ("受信 · Duck and Cover · 1951"); append the place to it and the map
   needs no caption at all. **Recommended** — it costs no faceplate height and
   puts the fact where the machine already keeps its record.

### What carries forward regardless

- Confidence must stay the grammar: `CAP = { city: 1.0, region: 0.72, country: 0.46, unknown: 0 }`.
  126 of 252 reels are country-confident; a country-level reel must remain
  numerically incapable of drawing a sharp dot, and `unknown` draws nothing.
- The tally: a repeat reception brightens its cell logarithmically. This is the
  answer to reels stacking 13 deep at Pyongyang, 10 at Tokyo, 6 at London.
- 6 arcs (reels with a known receiver), 15 `dx` styled as single dots, 7 `realm`
  reels handled off-map.

---

## 11. LANDED — the casing, 2026-09-17 (rc.76)

**R2 won and was re-cut.** The owner picked `mockups/set-R2-ledge.html` for its
ledge, its rockers and its moulding detail, and rejected how it joined the
cabinet: *"it looks like the ledge is a different colour than the rest of the
frame… it's kind of clear that we just sort of tacked the ledge on… let's start
fresh on how we would do it if we started here from square one."*

So the live `.zk-set2` is now authored as one injection moulding. The rule that
makes it hold, and the one to keep if any of this is touched again: **only the
cabinet paints a colour.** The ledge, the well, the tube's aperture lip and the
blanking plate paint nothing but rgba white and rgba black over the cabinet's
own gradient, so there is no second hex value that can drift. The end-draft and
the tool's parting line are laid down once, full height, by `.zk-set2::before`,
and the ledge's ends are the same pull as the bezel's walls. One radius (11 px
out, 10 px in) top and bottom; one spark-eroded grain over the whole part.

**The ledge carries three stations and nothing else** (§2 of the owner's brief):

| | control | wired to |
|---|---|---|
| left | 輝度 BRIGHT, 4 steps | `zk-set.js` `BRI[]` — lift/gain in the LUT pass, bloom alpha and blur, idle glow |
| middle | an unlabelled rocker with a two-digit readout, 00…10 | `zk-broadcast.js` `setLocale()` |
| right | reserved blank plastic (a blanking plate with an unused boss) | nothing, on purpose |

R2's 焦点 FOCUS, 蛍光体 TUBE, 受信 RECEIVE and 常時 HOLD are **not** on the live
ledge, and neither are the old chin's 選局 knob, 受信 push-switch and lamp. The
`getElementById` lookups for those ids are all null-guarded and now find nothing.

**The number is never explained.** No label, no legend, no tooltip, no VFD line.
`aria-label` is factual only ("選局番号 · channel number, 00 to 10").

**What the number does:** 00 is the whole pool and the receiver is bit-for-bit
what it was. 01–10 narrow `choose()`'s candidate list to one locale, in one
place, before the weights are computed; the footprint check, the cooldown, the
recent ring, the callback, the pin and the tide weighting all run over the
narrowed set unchanged. If the locale is empty, holds nothing that could serve a
reception, or `broadcast/geo.json` did not load, the full set stands.

**Measured in WebKit, 2026-09-17:** 960 → scene 960, set column 516, tube
**488 × 366** (1.3333), viz 314 × 200, ledge 514 × 64, three stations 160 × 36,
four rocker ends 48 × 44. 701 (the narrowest desktop) → tube 332.6 × 249.4,
ends 44 × 44. 390 → tube 327.1 × 245.9 (4:3), ends 44.2 × 44.2, stack order
set → scope → 段階 → transport, `scrollWidth` 390, nothing past the frame.
Tube at 60 fps, 0.58 ms mean / 2.0 ms worst at 192 × 144.

**Still open:** §9.4's imbalance is now visible — the set column runs to 560 px
and the scope column stops at 328, leaving ≈ 230 px of bare faceplate under the
段階 bar. §9.4's fix (`display: contents` at every width, column 2 carrying
scope → 段階 → transport) would move PLAY/STOP/volume out from under the set,
which §4.5 settled the other way. Owner's call. §10's map ribbon is still on
ice.
