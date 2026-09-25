# P0 — coder's handoff, round 1

Branch `zankyo-picture-video`, based on `2baf87e` (rc.91 plus plans and mockups).
Worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`, served by the
coder on **:8141** (`php -S 127.0.0.1:8141 router.php` from the worktree root).
Note that the :8071 and :8072 servers already running on this machine are *not* this
worktree. :8071 serves a deleted scratch copy from an older session, so do not probe
it.

**No VERSION bump.** Nothing the owner sees or hears has changed. Every frame of the
tube is byte-identical to rc.91's under seeded texture (below).

## What landed

| commit | what | VERSION |
|---|---|---|
| `f73d0da` | P0: the frame split into §5.1's passes, `zk-picture.js` holding rc.91's look as the one character 今, the per-line offset map, the bench hooks, `picture-lab.php`, `_picture-probe.js`, `tools/picture-cdp.js` | none (refactor) |
| (this file) | handoff and the baseline contact sheet | dev-only |

Files: `zk-picture.js` (new), `zk-set.js`, `index.php` (script tag and `$zk_assets`
only), `reel-lab.php` (the same one script tag; without it the lab's `zk-set.js`
no-ops), `picture-lab.php` (new), `_picture-probe.js` (new), `tools/picture-cdp.js`
(new), and `handoff/picture-sheets/P0-today-12-receptions.jpg`. `zk-broadcast.js`
and `zankyo-audio.js` are untouched, and so is `zankyo.css`.

## The gates, measured

### 1. Pixel identity with rc.91: GREEN

`node art/zankyo/_picture-probe.js identity` (base `2baf87e`). Each fixture runs twice
in headless Chrome. The first run is this tree. The second is the same page with
**only** `zk-set.js` replaced by `2baf87e`'s, by request interception. That base
copy is patched with the same dev shim the tree carries natively: virtual clock,
seeded texture (its own copy of mulberry32, not borrowed from the tree), frame-step,
and the no-filter switch. The shim's markers must match exactly or the probe throws.

Every frame of the tube canvas is hashed (FNV-1a over the RGBA), at 30 virtual fps,
from t = 0. That covers 15 s of idle (the test card surfaces at 6–14 s and Paik's
line at 9–19 s), then the reception, then the dead tube.

| fixture | reel (paused at) | frames identical | phases covered |
|---|---|---|---|
| 即常切 (4 dropouts) | john-cage-interview @20 s | **870/870** | idle, tuning, hold, loss, collapse, burst, dead |
| 探戻残 (3 glimpses, 2.2 s gap) | bbc1-testcard-news-1979 @12 s | **1254/1254** | idle, hunting, hold, lost, relock, loss, collapse, burst, dead |
| 浮断絶 (2 holes) | ddr1-aktuelle-kamera-1986 @30 s | **1116/1116** | idle, drifting, hold, loss, collapse, burst, dead |
| 即走切 (sweep gap) | test card | **909/909** | idle, tuning, hold, sweeping, loss, collapse, burst, dead |
| 即走切, no canvas filter (the older-Safari bloom path) | test card | **909/909** | as above |
| 即常切, no canvas filter | john-cage-interview | **870/870** | as above |
| 探戻残 at devicePixelRatio 2 (972×728 canvas) | bbc1 | **1254/1254** | as above |

No tolerance was needed. The gate was re-run on the committed tree on 2026-09-24, and every count above repeated exactly (`GATE GREEN`, exit 0). Every phase the set knows appears in at least one fixture.

**Can this gate fail? Yes, and the probe proves it on every run.** The same 即常切
fixture runs again with the tree's ghost moved **5 → 5.25 px** through `_dev.force`.
The probe caught it in **318/870 frames**: tuning 12, hold 241, loss 65. Those are
exactly the frames where the ghost is drawn. It found no difference before the
tune-in. If the moved ghost ever goes unseen, the gate turns red ("THE GATE IS
BLIND").

### 2. Performance: no worse, GREEN

`_picture-probe.js perf --reps 3`: base and tree alternated, 2 fixtures each, 6,372
steps per side. Each step is the tick plus the five passes plus the crack, timed in
the page with `performance.now()`:

| | mean | p50 | p95 | worst |
|---|---|---|---|---|
| base (rc.91) | 1.074 ms | 0.6 | 2.6 | 11.6 |
| tree | 1.064 ms | 0.5 | 2.3 | 24.5 |

The gate is mean and p95 within max(10 %, 0.1 ms) of the base. The machine's load
average was **51–68** throughout, because other sessions were running. The single
worst frame is therefore scheduler noise, not a pass: headless timer resolution is
0.1 ms, and base and tree have the same step count. The split adds one extra
192×144 loop (luma → LUT). That costs nothing measurable.

### 3. Music identity: NOT CHECKED, by the owner's ruling (2026-09-24)

The owner ruled that the music byte-identity checks are too strict and too slow for
this work. So `_far-identity.js`, `_harness.js` REPRO and the `_probe.js`
batteries were **not run**, and this phase does not gate on them. What stands in
their place is structural:

- `zk-broadcast.js` and `zankyo-audio.js` are untouched (`git diff 2baf87e --
  art/zankyo/zk-broadcast.js art/zankyo/zankyo-audio.js` is empty).
- `zk-picture.js` touches no DOM and no engine stream. It does no work at load
  beyond building constant tables.
- The character is drawn on the set's own fork, `set:rx:<seed>`, which consumes
  nothing from the master (decision 5). At P0 nothing is drawn from it.
- The five passes consume texture (`Math.random` in production) in rc.91's exact
  order. Gate 1 proves this: a changed draw order would change the hashes.

### 4. The probe's own repeatability (§6.3 "measured first"): GREEN

`_picture-probe.js repeat`. There are two fixtures. For each one: 3 texture seeds × 3
fresh pages, plus 3 `Math.random` pages. The metrics are taken on the pre-crack
frame, box-downsampled to 192×144 (green channel), at every third hold frame, and
compared against a **clean** render of the same reel. The clean render uses the same
pipeline with `_dev.force` zeroing the snow, the tear and the ghost.

- **Seeded: bit-exact.** Each seed gave identical numbers on 3 fresh pages. They were
  also identical across two separate probe processes run 25 minutes apart (every
  seeded row diffed equal).
- **Unseeded spread** (the texture's own noise; a P1 kind must move its metric by
  more than this):

| metric | 即常切 (plain hold, dropouts) | 浮断絶 (hold with 2 holes) |
|---|---|---|
| ssim | 0.012–0.025 | **0.31–0.35** |
| snowTV | 0.98–1.16 | 0.85 |
| lineVar | 0.007–0.012 | **59.5–60.7** |
| ghostPeak | 0.019–0.026 | 0.021–0.055 |
| humPeak | 0.026–0.052 | 2.8–4.9 |
| clip | 0.0006–0.0007 | 0.0026–0.0039 |
| corrClean | 0.001–0.002 | 0.35–0.38 |

  (Each range spans the two runs, rep1 and rep2.) **Read this before calibrating any
  JND.** Once a hold contains a 断 hole, the roll kicks are texture draws, so one
  reception's SSIM and line variance swing enormously with `Math.random`. SSIM
  ranged 0.28–0.63 across six unseeded pages of the same fixture. A per-reception
  metric on a holed hold is not repeatable, and P1 has to compare distributions over
  many receptions, not single runs.
- **Today's look, typical values** (plain hold, seeded): ssim 0.570–0.574,
  snowTV 14.8–15.8, lineVar 0.069, ghostPeak 0.30–0.32 at the drawn delay.
- **The legibility floor (§6.3.3), calibrated on today's look: median hold SSIM =
  0.5695** (24 runs, both fixtures). Per §11.2, P1+'s median must be ≥ this. The
  "buried" line and the surfacing gate (≥ 0.6 s in any 5 s) are still P1's to set.
  One data point for that: on today's look the 10th-percentile hold frame is already
  at SSIM **0.04** during a 断 hole and 0.23–0.26 in a plain hold with dropouts.
- The probe's kind → metric table (`KIND_METRIC`: 雪 snowTV, 裂 lineVar, 影 ghostPeak)
  fails by name for any kind in `ZP.IMPAIRMENTS` that has no metric (the `_cover.js`
  rule). The list is empty at P0.

## The decisions, and why

1. **Where each pass actually runs (a deviation from §5.1, forced by the P0 gate).**
   - Pass 1 (source) and pass 4 (the P39 LUT) are now separate loops at 192×144, as
     §5.1 says.
   - Pass 2 builds **the per-line offset map at source resolution** (144 entries,
     `Float64Array`, one per source row). It is **applied in the full-resolution
     composite**, one `drawImage` per run of `SH / map.bands` rows. It is not
     applied during a row copy at 192×144.
   - Pass 3 builds the ghost *list*. The ghost is still *drawn* at full resolution.
   - The reason: rc.91's tear and ghost land at sub-source-pixel tube positions. At
     192×144 they would round, and the P0 gate is byte equality. The map's offsets
     are in **tube px**, for the same reason.
   - A line-accurate map (`bands = 144`) would cost 144 `drawImage` calls per copy.
     **Recommendation for P1/P2**, now that the look may move: apply the map and the
     ghosts at source resolution in one row-copy pass, as §5.1 intended. That makes
     the cost independent of how many lines differ, and it is where the perf budget
     (≤ 2.5 ms mean) will be won or lost.
2. **Two offset maps on a rolling frame.** rc.91 draws the wrapped copy of a rolling
   picture with its *own* tear draw. Physically those are the same scan lines, so
   one map is correct. P0 keeps both (`mapA`, `mapB`) because the second one
   consumes texture and identity requires it. P1 should make it one map.
3. **Which constants moved into `zk-picture.js`.** The ones that P1 has to vary moved
   into `ZP.TODAY` or `ZP.TUBE`:
   - snow curve;
   - breath partials;
   - dropout depth and frame-hold odds;
   - the tear's nine bands and their numbers;
   - the ghost;
   - the exit squash and line timings;
   - the P39 stops, gamma and per-phase persistence.

   The entry envelopes stay in `tickSignal`: the 探 glimpse shape, the 浮 curve, and
   the roll kicks in lost, sweep and loss. §3.5 entries and exits are P3, and moving
   them now would have been scope with no gate.
4. **Operand order is preserved verbatim.** For example
   `snow * snow * sq + snow * lin`, and `b * (TH / nb) * sy` rather than
   `r0 * TH / SH`. The two slice formulas round differently in the last bit.
   `zk-picture.js` warns about this at the top of the file.
5. **The character is drawn per reception on `master.fork("set:rx:" + desc.seed)`.**
   At P0 that fork is created and not drawn from, since 今 draws nothing. A fork is
   derived from the master's original seed and consumes nothing from it, so there
   are no engine draws. The idle and dead tube use a resting copy of 今.
6. **The bench clock.**
   - `window.ZK_SET_DEV = { manual, clock, texture, noFilter }`, when set *before*
     `zk-set.js` loads, freezes the set from its first line. This matters because
     `idle.nextCard` and `idle.nextLine` are read from the clock at init. The probe
     and `picture-lab.php` set it; production never does.
   - While frozen, the **signal clock is the virtual clock too**. A bench reception
     is in virtual seconds. A real receiver descriptor is in AudioContext time, so
     thaw first. `picture-lab.php` says so, and tells the viewer not to press PLAY.
   - `sweep()` and `sweepNow()` now read the set's `now()` instead of
     `performance.now()` directly. In production those are the same clock.
7. **The CDP helper is `tools/picture-cdp.js`, not `tools/cdp.js`.** The audio crew
   has its own `tools/cdp.js` on its branch, and two different files at one path
   would collide at the merge.

## The bench hooks (`ZankyoSet._dev`, §6.2)

| hook | what |
|---|---|
| `character()` | the current reception's character (a copy) |
| `force({axes})` / `force({archetype})` / `force({impairment})` / `force(null)` | axes are merged over the next draw; archetype and impairment are **refused by name** at P0 (`{ok:false, why:"no archetype '遠' yet …"}`) |
| `seedTexture(n)` / `seedTexture(null)` | mulberry32 texture, or back to `Math.random` |
| `freeze(ms)` / `step(ms)` / `thaw()` | virtual clock; one exact production frame (tick, five passes, crack; ignores the low-power half rate and visibility); back to rAF |
| `clock()`, `signalClock()`, `frozen()`, `buffers()` | for the lab and the probe |

The frame time from `getState()` is measured on the real clock even while frozen.

## `picture-lab.php` (/art/zankyo/picture-lab, unlinked)

It uses the real faceplate, sliced from `index.php` in the same way `reel-lab.php`
does it. Controls:

- **Source:** reel (216 video reels) and the frame it is paused on, or the test card.
- **Seeds:** the texture seed and the reception seed.
- **Shape:** entry, body and exit (即/探/浮 × 常/戻/断/走 × 切/残/絶), time on air,
  dropouts on or off.
- **Force:** JSON.
- **Transport:** receive, freeze, step 1 or 10, run frozen, live.
- **Captures:** **capture strip** (12 moments of one reception) and **contact sheet
  4×3** (the same reel under 12 reception seeds, at N s into the hold), both as a
  PNG download.

It was smoke-tested headless: a reception, stepping, a refused force, a strip, a
sheet and thaw all worked. The page raised no errors of its own. The one console
error is pre-existing and comes from `zk-broadcast.js` (open item 5).

`handoff/picture-sheets/P0-today-12-receptions.jpg` is that sheet on
john-cage-interview, seeds 211–222, 3 s into the hold. It is the before-picture for
P1: twelve receptions that differ only in the density of the snow.

## Open items (for P1 unless marked)

1. **Defect found: a 断 piece's holes are read as loss.** `zk-set.js` `phaseOf`
   tests `e < segs[i].atS + segs[i].onS`. The receiver's piece *occupies*
   `onS + holeS` (`planTimes`, zk-broadcast.js:346-347). So the last `holeS`
   seconds of every 断 piece show on the tube as **loss**:
   - the tear ramps from 0.5 toward 1.5;
   - the lamp flickers;
   - a hole that falls in that tail is never drawn as a hole;
   - and all of it happens while the audio is still on air.

   Evidence: 浮断絶 with `holeS` 2.5 and exit 0.3 s spends **85 frames (2.83 s)** in
   `loss`, where 0.3 s was expected. The fix is `+ (segs[i].holeS || 0)` in the
   hold test. It is visible, so it was not made in P0. P1 should declare it.
2. **The relock reads `segments[0].lockS`** (§1.10). The receiver's `MOD_RELOCK_S` is
   0.2 and the fallback is also 0.2, so **the fix changes nothing visible today**. It
   is still the right read for P1.
3. **Sweep snow while dead** is computed and never shown (§5.5). The owner's ruling
   (§11.5) is to draw it faintly. That is visible, so it belongs to P1. It is marked
   in `composite()`.
4. **One map, not two**, for a rolling frame (decision 2). Move the map and the ghosts
   to source resolution (decision 1).
5. **Not mine, reported only.** On every page load, `zk-broadcast.js:664` logs
   `console.error`: "29 TUNED reel(s) have windows of differing length —
   cccp-zastavki-1952-1991 …". This happens at the base as well (the manifest is
   untouched here). QF's zero-console-errors gate will trip on it. It belongs to the
   audio crew or the manifest.
6. **WebKit not run.** No headless WebKit is available here. The no-filter bloom path
   (the older-Safari path) is covered in Chrome by `ZK_SET_DEV.noFilter`, and it is
   pixel-identical.
7. **The probe is slow on this machine.** One page run takes 18–75 s at load 50–68,
   although a step costs about 1 ms. Identity with its sensitivity check took about
   14 min, repeat about 15 min, and perf about 10 min. `tools/picture-cdp.js` now
   waits up to 60 s for Chrome to start, and kills a half-started Chrome instead of
   leaving it running.

## How to re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php            # if :8141 is down
node art/zankyo/_picture-probe.js identity   # the P0 gate (+ the sensitivity self-check)
node art/zankyo/_picture-probe.js perf
node art/zankyo/_picture-probe.js repeat     # repeatability + the legibility floor
# --url http://127.0.0.1:<port>/art/zankyo/  --out <dir>  (PNG samples, report JSON)
```
