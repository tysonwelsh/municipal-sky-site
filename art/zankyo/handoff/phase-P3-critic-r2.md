# P3 — critic, round 2: SIGNED OFF

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the fix at `a129d39` (`2.1.0-rc.P6`) and the handoff and strips at `1ea60e1`. I did
not write this code. Every number below comes from my own runs on :8141. `lsof` shows its cwd is
this worktree, and the served `zk-set.js` has the same sha1 as the file on disk. I started no
server and stopped none.

**Verdict: P3 passes. The last green commit is `a129d39`** (`2.1.0-rc.P6`).
- Both round-1 items are fixed, and I checked each fix in the code, the numbers and the frames.
- Each fix now has a gate, and each gate fails by name on round 1's `zk-set.js`.
- The kill run is RED, with 22 failures by name.
- There are no required items. The observations below are not blocking.

This file, three critic frames and one job file are dev-only, so they need no bump.

**Load.** 3.6 when I started, and 5–14 through the runs (`uptime`).

**Standing checks:**
- Music identity was not checked, by the owner's ruling (2026-09-24).
- `git diff 2baf87e HEAD` is empty over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/`. `index.php` differs only by P0's `zk-picture.js` script tag and the
  `$zk_assets` entry.
- The diff from `90526da` to HEAD on `zk-set.js` adds no `fillText` and no log line. The VFD still
  names nothing (§11.3).
- `zk-picture.js` has not changed since `90526da`.
- `a129d39` bumps `VERSION`, as the rule requires.

---

## The gates, re-run on `a129d39`

| gate | my run | coder |
|---|---|---|
| `bounds` (§2.3, timing) | **GREEN.** 48 receptions, **436 boundaries, 33,884 frames**. Every boundary is on rc.P4's frame. Every boundary is also on rc.91's frame, except the 11 断 hold→loss boundaries that P1 moved. All 12 forced receptions ran their modes. | same |
| `p3draws` | **GREEN.** Every variant appears in every set's 500 draws, and none falls outside its pool. The P3 draws come last (20,000 = rc.P4's). Sensitivity: 116 of 200. | same |
| `p3render` | **GREEN.** The 21 variant checks give the same moves and causes as r1. **浮同 walk 3: 46.74 → 11.70 px² (×4.00), opening ×7.34 over walk 1. Walk 1: 6.37 → 5.60.** **Colour: 21/21.** | same, to the digit |
| `p3render --kill` | **RED, 22 ✗ by name:** r1's 21, plus **浮同 walk** (5.45 → 5.75). | same |
| `p3render --set 90526da` (r1's `zk-set.js` swapped in, 92,495 bytes) | **RED, exactly 2 by name:** **浮同 walk** (5.32 → 5.71, ×0.93; ×0.84 against walk 1) and **残 burn colour** (15 of 27 instants over, largest excess 59.8 pts at 12.9 s dead). | same |
| `legibility` | **GREEN.** Median 0.7380 against rc.91's 0.7069. 0 of 48 buried. 48 of 48 surface, worst window 0.70 s (rc.91 1.60 s). 遠 and 嵐 at sev 1 surface 24 of 24, worst window 0.90 s. | same |
| `perfp1`, twice back to back | **GREEN both.** Run 1 (load 5/8/9): dpr 1 1.295 / p99 3.2 (rc.91 0.994 / 3.1); dpr 2 1.729 / p99 5.4 (rc.91 1.127 / 4.4, under the 6 ms line). Run 2 (load 5/7/9): dpr 1 1.279 / 3.4 (0.986 / 2.9); dpr 2 1.459 / 3.9 (1.211 / 4.4). Worst archetype 1.421 / 1.563. | GREEN twice |
| `p3render` step cost | Defaults mean 1.33 ms, variants mean 1.275 ms (p95 2.6). The kill run's worst defaults frame was 149.6 ms, a single stall in the defaults group under load 8. | 1.211 / 1.158 |

**Can the new gates fail? Yes, and each one failed when I ran it:**
- **The colour check.** The `--set 90526da` run fails it on 残 burn by name. The kill run cannot
  prove it, because killing the exit also removes the afterglow, and the coder said so. The
  swap is sound: `zk-picture.js` is unchanged since `90526da`, so the swapped tree *is* r1's
  picture.
- **The walk check.** It fails by name in the kill run (`walkAt → 1`) and in the `--set` run (the
  ENV1 map). Its walk-1 control is on the same seed and texture, so it is a like-for-like
  comparison.
- **`bounds`** still tells rc.91's 断 tail from the tree's by one boundary per shape.

## Item 1 (r1): the 残 afterglow. FIXED.

**The code (`zk-set.js` 1092, 1169–1190).**
- The capture copies the green channel of `pdata`. `tubePass` writes `pdata` at 1055, before
  `composite` (1077) reads it at 1092, so the capture is this frame's phosphor.
- Each frame computes `green × aftA + LUT.G[0]`. `G2L` is the ramp's inverse, the least luma that
  lights that green. The result is written as `LUT(l) − LUT(0)`, and it is added with `lighter` at
  `dd`.
- A dimmer glow therefore moves **down the P39 ramp**, not toward grey.
- **Physically this is right:** a decaying phosphor keeps its emission spectrum and only gives
  less light. That is exactly "the ramp's own colour at the lower green".

**My run of the critic tool** (`tools/picture-p3-critic.js --jobs
tools/picture-p3-critic-afterglow.jobs.json`) reproduces the coder's table to the digit.
- **DESAT over collapse, burst and dead:**
  - john-cage 0.0 / 0.0 / 0.1 / 0.1 / 0.5 / 0.1 %;
  - bbc1 0.0 / 0.0 / 0.2 / 0.2 / 1.2 / 0.1 %;
  - ddr1 0.0 / 0.0 / 0.1 / 0.1 / 0.5 / 0.0 %.
  - The squash reads up to 6.7 %.
- **R/G of the lit pixels:** 0.17–0.25 on the burn, against the squash's 0.26–0.40.
- **Dead-tube meanG against the squash:**
  - john-cage 40.9 / 26.3 / 18.3 (27.4 / 13.5 / 9.0);
  - ddr1 43.4 / 26.7 / 18.4 (25.3 / 12.7 / 8.5).
  - The afterglow is still clearly there.

**By eye** (`picture-sheets/P3-critic-r2-残-burn-afterglow-ddr1-12.50s.png`):
- This is r1's frame (`P3-critic-r1-残-burn-afterglow-ddr1-12.50s.png`) again.
- The portrait, the newsreader, his paper and the caption sit under the snow in **dark green**. In
  r1 they were grey-white.
- The re-shot `P3-exits-残.jpg` bottom row reads green from 11.50 s to 13.17 s.
- There is no white anywhere in the row.

**I accept the coder's decision against my literal "luma × aftA through the LUT".**
- Its measured result (dead meanG 26.7 / 13.9 against the squash's 27.4 / 13.5) would have
  removed the 残 burn's whole reason to exist.
- The chosen form keeps r1's green frame by frame, which was what the ask intended.

## Item 2 (r1): the walk-down now reaches the offset map. FIXED.

**The code.**
- `geometryPass` hands `ZP.geoMap` `S.env` in the hold **and** while drifting.
- `S.env` is reset to ENV1 every frame (588). It becomes `WALK` only when `walkAt ≠ 1` (629).
- So only a walked drift changes, and a walk-1 drift and 今 are rc.91's frame for frame.

**The drift's tear: I accept the decision.**
- The code keeps rc.91's search term and adds `ch.tear.rate × (S.env.tear − 1)`.
- That equals (walk − 1)× the character's own rate at the drift's start and 0 at the lock.
- For characters without 裂, `ch.tear` is the drawn fallback (`zk-picture.js` 667), so the term
  is always defined.
- The reason given (the walk-off control must stay rc.91's drift) is correct.

**`tools/picture-p3-walkgeo.js`, my run:** 同 walk 3 reads **48.50 / 42.32 / 32.63 / 11.95**
px², and walk 1 reads 6.09 / 6.44 / 5.71 / 5.75. That is the coder's result exactly. `S.env`
reads 2.90, then 2.55.

**By eye** (`P3-entries-浮同.jpg`, plus my full-size frames `P3-critic-r2-浮同-walk3-ddr1-5.00s.png`
and `…-walk1-…`):
- At 5.0 s the walk-3 raster is bent and torn at its right edge. The snow is heavier, with
  horizontal streaks, and the portrait is further under. The walk-1 frame at the same instant
  shows the portrait and the paper clearly.
- By 7.6 s the two rows converge, and they are the same at the lock.
- This is a weak carrier whose sync is not yet holding, which is the physical cause.
- I saw nothing digital: no RGB split, no blocks, no datamosh.
- The frame job is in `tools/picture-p3-critic-fudou.jobs.json`.

## Realism, §2 and §11 over the round

- **§11.1 (always green):** colour is 21/21 at full resolution after compositing. The DESAT of
  every lock-in, glimpse and drift variant stays within its default's by ≤ 5 points except on
  ≤ 2 samples.
- **§11.2 (the picture surfaces):** 48 of 48 receptions surface. The worst window is 0.70 s,
  which is better than rc.91's 1.60 s.
- **§11.3:** no words were added.
- **Timing:** `bounds` shows nothing moved.
- **Nothing digital** in the new frames.

## Observations (not required)

1. **Every 切 variant reads 43–54 % DESAT at the dead tube's last sample (9.9 s) on the test
   card, and the squash reference reads it too.** The excess is ≤ 4.2 pts, so this is not P3's.
   It is most likely a thin denominator: few pixels are still in G 30–215 at the tube's end. I
   could not confirm that. My test-card capture of it stalled, and I stopped it and its Chrome.
   This is for QF to look at if it wants §11.1 over rc.91's own squash.
2. **The handoff says the afterglow's loop runs "nowhere else".** In fact the capture's
   27,648-byte copy also runs on every **hold** frame of a burn-exit reception. It costs little:
   the p3render variants mean is 1.275 ms, and `perfp1` was green twice. This is an accuracy
   note only.
3. **I agree with the coder's open items:**
   - 浮同 reads modestly to the eye (the lever is `walk`'s range in `ZP.ENTRY`).
   - 即 bloom sits at the colour gate's limit (2 of 22). A longer mint top is the owner's call
     under §11.1.
   - The tiers are P4's: neg is 1 in 14, and freeze × burn-in is 1.6 %.
   - `set:burn` against `set:tube` is for P4.
   - The burn's frame memory records reels only.
   - Walked echoes are uncapped.

## Re-run (mine)

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2/art/zankyo
node _picture-probe.js bounds --out <dir>                    # GREEN
node _picture-probe.js p3draws --out <dir>                   # GREEN
node _picture-probe.js p3render --out <dir>                  # GREEN (colour 21/21, 浮同 walk ✓✓)
node _picture-probe.js p3render --kill --out <dir>           # RED, 22 by name
node _picture-probe.js p3render --set 90526da --out <dir>    # RED, 浮同 walk + 残 burn colour
node _picture-probe.js legibility --out <dir>                # GREEN
node _picture-probe.js perfp1 --out <dir>                    # GREEN, twice
node tools/picture-p3-critic.js --jobs tools/picture-p3-critic-afterglow.jobs.json --out <dir>
node tools/picture-p3-critic.js --jobs tools/picture-p3-critic-fudou.jobs.json --out <dir>
node tools/picture-p3-walkgeo.js
```
