# P0 — critic, round 1: SIGNED OFF

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the code at `930e00c`: `f73d0da` is the code, `930e00c` is the coder's handoff.
I did not write this code. Every number below comes from my own runs on the coder's
:8141 server (`router.php` from this worktree). The machine's load average was 49–72
throughout.

**Verdict: P0 passes.** The last green commit for P0 is this critic commit. It adds only a
probe guard (below) and this file; the P0 code itself is `f73d0da`.

**There are no required items.** One instrument blind spot turned up, and I closed it
myself in this commit (dev-only; item A). The numbered items at the end carry forward to
P1. They do not block P0.

## The gates, re-run

### 1. Pixel identity with rc.91 (the §7 P0 gate): GREEN, reproduced exactly

`node art/zankyo/_picture-probe.js identity` → `GATE GREEN`, exit 0. The counts match the
coder's frame for frame:

| fixture | identical |
|---|---|
| 即常切 · john-cage-interview | 870/870 |
| 探戻残 · bbc1-testcard-news-1979 | 1254/1254 |
| 浮断絶 · ddr1-aktuelle-kamera-1986 | 1116/1116 |
| 即走切 · test card | 909/909 |
| 即走切 · no filter | 909/909 |
| 即常切 · no filter | 870/870 |
| 探戻残 · dpr 2 (972×728) | 1254/1254 |

The total is 7,182 frames. Every phase the set knows appears at least once. The coder's
sensitivity self-check again catches a 0.25 px ghost in 318/870 frames.

This is more than the §7 row asked for ("20 fixed timestamps × 3 reels"). Every frame at
30 virtual fps is hashed, over 3 reels plus the test card. No tolerance was needed.

### 2. Can the gate fail? Yes, on both sides (my mutation runs)

The coder's self-check moves only the **tree**. I wanted to know what happens if the
**base** is wrong, so I ran the 即常切 fixture (texture 7) against an unmutated base, with
one mutation served per run by request interception:

| mutation | frames that differ | where |
|---|---|---|
| none (tree vs base, a third browser process) | **0**/870 | — |
| **base** ghost 5 → 5.25 px (in rc.91's own zk-set.js) | **318**/870 | tuning 12, hold 241, loss 65 |
| tree persistence fill `rgba(3,5,3,…)` → `rgba(3,5,4,…)` (1/255) | **372**/870 | tuning 12, hold 238, loss 65, collapse 9, dead 48 |
| tree luma coefficient 0.299 → 0.2991 | **337**/870 | idle 6, tuning 12, hold 241, loss 65, collapse 13 |
| tree snow probability reassociated, `snow*(snow*sq+lin)` | **0**/870 | — |

- The base page was really rc.91. The interception fired once, and the page had no
  `_dev.character`.
- A change of 1/255 in the persistence fill, and a change of 1e-4 in a luma weight, are
  both seen in hundreds of frames.
- The warning at the top of zk-picture.js about the snow expression's operand order is
  stronger than the evidence. That reassociation changes no byte in 870 frames, because
  the value is only compared against `rnd()`. The warning costs nothing, so leave it.

**Item A (fixed in this commit, dev-only): the gate could have gone green for the wrong
reason.** In `runPage`, the base's `Fetch.fulfillRequest` ended in `.catch(() => {})`. If the
interception had ever failed silently, the "base" page would have loaded this tree's
zk-set.js. The gate would then have compared the tree with itself and passed. The
sensitivity check would also have passed, because it moves only the tree. It did not
happen here, but nothing stopped it from happening.

`runPage` now counts the interceptions. It turns a failed fulfil into a page error. A base
page must also prove it is the base: it was intercepted at least once, and it has no
character hook. Otherwise the run throws. I tested the guard both ways on the 即走切
fixture:
- the real base is accepted (character `null`);
- the tree's own zk-set.js served as the "base" is **refused**: "the base page is not the
  base (zk-set.js intercepted 1×, character hook PRESENT)".

### 3. Perf, no worse: GREEN

`perf --reps 2` (4,248 steps a side, base and tree alternated):

| | mean | p50 | p95 | worst |
|---|---|---|---|---|
| base | 1.034 ms | 0.6 | 2.4 | 10.2 |
| tree | 1.044 ms | 0.5 | 2.2 | 20.3 |

The mean is +1 % (the gate allows 10 %), and p95 is lower than the base's.

The tree's worst frame was about twice the base's in both the coder's run and mine, so I
checked where it lands. I listed the six slowest steps per page over 8 pages. The worst
step is the reception's **first** frame (frame 450, the first `drawImage` of the video) or
frame 0, on base and tree alike:

| | first-frame times |
|---|---|
| tree | 18.2, 9.0, 8.1, 5.7 ms |
| base | 9.1, 8.3, 7.5, 10.5 ms |

p99 ranges 2.8–4.4 ms for the tree and 3.1–4.5 ms for the base. The worst figure is
first-frame noise on a machine at load 50+. It is not a regression.

### 4. The probe's repeatability: GREEN, reproduced

`repeat` gives:
- **Seeded runs are bit-exact.** Seeds 3, 17 and 101, each on 3 fresh pages, are
  identical, and all equal the coder's values: 即常切 seed 3 ssim 0.5695, snowTV 14.8491,
  ghostPeak 0.3223.
- **The unseeded spreads fall inside the coder's ranges:**

  | fixture | ssim | lineVar | corrClean |
  |---|---|---|---|
  | 即常切 | 0.0225 | 0.0245 | 0.0027 |
  | 浮断絶 | **0.2516** | **151** | **0.50** |

- **The floor reproduces: 0.5695.**

### 5. Production path (no `ZK_SET_DEV`): GREEN

This is my own smoke test, on `index.php?seed=3042` in headless Chrome:
- The set is not frozen. The rAF loop draws at 58.5 fps, with a frame mean of 1.39 ms after
  8 s.
- `_dev.tune()` runs idle → tuning → hold → loss → collapse → burst → dead → idle.
- There are 0 exceptions. The one console error is the known one from `zk-broadcast.js`
  (the "29 TUNED reel(s)" message; coder item 5).

`kick()`/`loopOn` replaces the bare `requestAnimationFrame(loop)`. It cannot double-start,
because `start()` is guarded by `running` and `loop()` clears `loopOn` only while frozen.

### 6. Music identity: NOT CHECKED, by the owner's ruling (2026-09-24)

`git diff 2baf87e HEAD -- art/zankyo/zk-broadcast.js art/zankyo/zankyo-audio.js
art/zankyo/zankyo.css art/zankyo/VERSION art/prosperos-jukebox-v2` is empty.

The character fork is `master.fork("set:rx:" + S.seed)`, and `master` is the set's own
`PJ.Rand.stream(seed)`. `fork()` derives from the original seed (pj2-rand.js:55) and
consumes nothing.

`_harness.js` now also loads `zk-picture.js`, because it takes every `zk-*.js` from
index.php except zk-set.js. That file is pure: no DOM, no draws, and `root` is null
headless. I did not run the harness (owner ruling).

## Looking at the pictures

My captures are in `handoff/picture-sheets/`. I drove picture-lab.php headless: set the
fields, clicked, and read the download link.

- **`P0-critic-strip-fu-dan-zetsu.jpg`** (ddr1 @30 s, 浮断絶, texture 7). It shows the 浮
  drift-in resolving out of snow, then a hold with holes rolling through, then
  collapse.
  - Tile 10 is labelled **`loss` while the picture is still clean and on air.** This is
    the coder's open item 1 (the 断 `holeS` tail is read as loss), seen on the tube. The
    identity phase table agrees: `loss:85` frames = 2.83 s, against the 0.3 s exit.
  - 絶's last visible tile is a squash, not a hard cut. That is rc.91's behaviour and
    belongs to P3 (§3.5).
- **`P0-critic-today-ddr1-unseeded.jpg`** (ddr1, 12 reception seeds, `Math.random`
  texture, 4 s into the hold). The twelve tubes are the same station with different
  snow density. This is the §1 audit, visible, and it is the "before" sheet P1 has to
  beat, alongside the coder's john-cage sheet.
- **A strip with the tear forced to amp 12 and one 14 px ghost** (not saved). The loss
  tiles show the nine-band tear, so force axes reach the picture through the lab. The
  probe's 0.25 px self-check had already proved that the force hook reaches the draw.

The judging points for this phase:
- **Realism, always green, the picture surfaces, VFD silent.** Unchanged from rc.91 by
  construction. Every frame is byte-identical, so P0 adds nothing digital, no chroma and
  no words. The lab's labels are on an unlinked dev page, not the VFD.
- **VERSION.** Correctly not bumped: nothing visible changed.
- **Territory.** zk-broadcast.js, zankyo-audio.js and zankyo.css are untouched.
  index.php's diff is the script tag and `$zk_assets` only. reel-lab.php gets the same
  one script tag, which it needs, because zk-set.js now no-ops without `ZankyoPicture`.

## Carried forward to P1 (numbered; not blocking P0)

1. **The legibility floor is a method, not the number 0.5695.** That number is the median
   of 24 runs: 12 plain holds (即常切, 0.57–0.59) and 12 holed holds (浮断絶, 0.29–0.54).
   The median lands on the boundary, which is exactly 即常切 seed 3. Change the fixture mix
   and the "floor" moves.
   - P1 should compare **its** median against **rc.91 on the same fixtures and seeds**.
     The probe already serves the base by interception, so this costs one more pass.
   - It should not compare against the scalar.
   - State the fixture set with the number.
2. **Per-reception metrics on a holed hold are not repeatable under `Math.random`.** The
   ssim spread is 0.25, lineVar 151 and corrClean 0.50 on 浮断絶. Two consequences:
   - the §11.2 surfacing gate (≥ 0.6 s above the buried line in any 5 s of hold, per
     reception) must run on seeded texture, or be judged over a distribution;
   - the "does it render" checks (§6.3.2) should force each kind on a **plain** hold.
     ghostPeak reads 0.30 on john-cage but only 0.05–0.06 on the holed ddr1 fixture, so a
     ghost measured on a holed hold could "fail to render" for the wrong reason.
3. **The buried line and the surfacing gate are still undefined.** They are P1's to
   calibrate, and today's look already dips to ssimP10 0.04 in a 断 hole. Set the buried
   line so that today's look passes the surfacing gate, or say why it should not.
4. **The coder's open items 1–4 stand:**
   - the 断 `holeS` tail read as loss (confirmed above);
   - relock reading `segments[0].lockS`;
   - faint sweep snow while dead (§11.5);
   - one offset map instead of two, with map and ghosts at source resolution.

   Each is a visible change, so it is declared in P1's commit and VERSION line.
5. **`_dev.force` persists** until `force(null)`, and it applies to *every* later
   reception. The comment says "the NEXT reception", so fix the comment or the behaviour.
   The lab reapplies force on every receive, so the lab is unaffected. This is dev-only.
6. **Coverage note, no action:**
   - the identity fixtures run 輝度 step 1 only, and the other steps have been unreachable
     from the panel since rc.77;
   - WebKit was not run (no headless WebKit), and the no-filter path was covered in
     Chrome.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php             # if :8141 is down
node art/zankyo/_picture-probe.js identity    # ~15 min at load 50–70; now refuses a base that is not the base
node art/zankyo/_picture-probe.js perf --reps 2
node art/zankyo/_picture-probe.js repeat
```
