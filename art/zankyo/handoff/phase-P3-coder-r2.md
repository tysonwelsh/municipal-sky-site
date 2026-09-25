# P3 — coder's handoff, round 2

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
Served on **:8141** (`php -S 127.0.0.1:8141 router.php`, cwd this worktree, checked with `lsof`).
I started and stopped no server.

| commit | what | VERSION |
|---|---|---|
| `a129d39` | both required items, the colour and walk checks in `p3render`, `--set <rev>`, the 浮同 strip | `2.1.0-rc.P6 — the afterglow a station leaves on the dead tube stays green instead of greying, and a bad-sync drift-in now arrives bent and tearing harder and settles as it locks` |
| (this file) | the handoff, `P3-exits-残.jpg` re-shot, `P3-entries-浮同.jpg` new | dev-only |

**Files touched:** `zk-set.js` (the afterglow, `geometryPass`'s env, the drift's tear),
`_picture-probe.js` (`p3render`, `p3sheets`), `VERSION`. `zk-picture.js` is unchanged since
`90526da`.

**Standing checks:**
- `git diff 2baf87e` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/` is empty. `index.php` differs only by P0's script tag and `$zk_assets`.
- Music identity was not checked, by the owner's ruling (2026-09-24).
- §11.3: no text was added. No `fillText`, VFD or log line.

**Load:** 5–9 through the gates, 13–15 through perf (`uptime`).

---

## Item 1: the 残 afterglow was grey. It is now on the P39 ramp.

**The fix (`zk-set.js`, `drawAfterglow` and the capture in `composite`).**
- While the picture lingers, the capture keeps the phosphor's **green** channel. It reads
  `pdata`, the ImageData that `tubePass` just wrote, so there is no GPU readback.
- Each afterglow frame computes `g' = green × aftA`. It looks up the least luma the LUT lights at
  that green (`G2L`, the ramp's inverse), then writes `LUT(l) − LUT(0)` into `aftCv`.
- `aftCv` is added with `lighter` at the dead tube's persistence rate, as in r1.
- The steady state is the ramp's own colour at the decayed green.
- A dimmer phosphor sits lower on the same curve. It is not a scaled copy of the ramp's
  near-white top.

### (a) Decided: the green is scaled, not the luma

The critic asked for luma × aftA through the LUT. **I built that first and measured it.** It was
on the ramp (DESAT 0–5.2 %), but the afterglow disappeared.
- The ramp is steep: gamma 1.3, over stops that stay dark until 0.45. So luma × 0.125 lands at
  about ¼ of r1's green.
- Dead-tube meanG on john-cage at 12.20 / 12.50 / 12.80 s read **26.7 / 13.9 / 9.6**. The
  squash reads 27.4 / 13.5 / 9.0 at the same instants, so the result was indistinguishable from
  no afterglow.

Scaling the green instead keeps r1's light frame by frame and removes r1's grey. The floor
LUT(0) = (2, 6, 3) is subtracted from what is added. Added every frame on a dead tube, the floor
would lift the whole black glass to the floor's colour. The lookup is offset by the floor, so the
green that gets added is exactly green × aftA.

**Measured with the critic's tool** (`tools/picture-p3-critic.js --jobs
tools/picture-p3-critic-afterglow.jobs.json`). DESAT is the share of G 30–215 pixels that fall
more than 0.2 below the ramp's saturation. The squash rows are unchanged from the critic's table.

| reel | exit | collapse 11.50 / 11.73 | burst 12.00 | dead 12.20 / 12.50 / 12.80 | dead meanG (squash) |
|---|---|---|---|---|---|
| john-cage | burn **r1** | 9.8 / 15.6 % | 6.4 % | 10.0 / 29.1 / 57.3 % | — |
| john-cage | burn **r2** | **0.0 / 0.0 %** | **0.1 %** | **0.1 / 0.5 / 0.1 %** | 40.9 / 26.3 / 18.3 (27.4 / 13.5 / 9.0) |
| bbc1 | burn r1 | 7.0 / 10.5 % | 3.0 % | 4.8 / 14.9 / 60.8 % | — |
| bbc1 | burn **r2** | **0.0 / 0.0 %** | **0.2 %** | **0.2 / 1.2 / 0.1 %** | 33.0 / 20.4 / 13.5 (23.1 / 12.7 / 8.5) |
| ddr1 | burn r1 | 15.6 / 18.0 % | 13.3 % | 15.6 / 35.5 / 85.9 % | — |
| ddr1 | burn **r2** | **0.0 / 0.0 %** | **0.1 %** | **0.1 / 0.5 / 0.0 %** | 43.4 / 26.7 / 18.4 (25.3 / 12.7 / 8.5) |

- R/G of the lit pixels over the afterglow is 0.17–0.25. The squash's dead tube reads 0.26–0.40,
  which is the Paik line's persistence.
- **By eye:** in the bottom row of `picture-sheets/P3-exits-残.jpg` (re-shot), the face stays on
  the dead tube at 12.47 s and 13.17 s, and it is green.
- My frame at ddr1 12.50 s is the critic's frame again. The same paper, face and caption now read
  green under the snow, not grey-white.

### (b) The gate now sees colour

`p3render` has a **§11.1 colour check** on the full-resolution tube canvas after compositing,
using the critic's DESAT.
- It samples every 3rd frame (0.1 s) over each variant's window. For 切, the window runs from
  the loss to the dead tube's end. For 焼, it is the hold.
- Each sample is compared with its default **at the same instant**, taking the worse of the
  default's two textures.
- Gate: the excess may be over 5 points on **at most 2 samples (0.2 s)**. A moment of the ramp's
  own mint top blown out through a dimmer shard reads as DESAT too; the critic saw 0.1 s of it on
  過's bloom. A held grey keeps going, so it fails.
- **Why per instant rather than worst against worst:** r1's burn on john-cage peaks at 57.3 %,
  and the squash's dead tube peaks at 54.6 % (the Paik line). A worst-against-worst gate would
  pass r1.

| run | result |
|---|---|
| this tree | **21/21** variants on the ramp. 残 burn: 0/27 instants over, largest excess 0.3 pts, worst DESAT 0.6 %. |
| `--set 90526da` (r1's `zk-set.js` swapped in) | **✗ 残 burn colour: 15/27 instants over, largest excess 59.8 pts at 12.9 s (dead).** Every other variant passes. |
| `--kill` | passes, as expected: killing the exit also removes the afterglow. The `--set` run is the proof that this check can fail. |

The closest pass is **即 bloom at 2/22 instants, exactly the limit** (largest excess 6.8 pts, at
0.0 s, tuning). That is the ramp's own mint top at the AGC's overshoot, the critic's observation
3. The bench runs are seeded, so it reproduces exactly. The next closest are 即 ghost at 1/22
(5.2 pts), 切 vline at 1/43 (7.7 pts, the vertical line's halo mid-collapse) and 切 freeze at
1/43 (5.2 pts).

---

## Item 2: 浮's walk-down skipped the offset map. It now reaches it.

### (a) The fix

- **The map takes `S.env` while drifting.** `geometryPass` now passes
  `ph === "hold" || ph === "drifting" ? S.env : ENV1` to `ZP.geoMap`. In every other carrier
  phase `S.env` is ENV1. With walk 1, `S.env` stays ENV1, so only a walked drift changes.
- **The drift's tear. Decided:** rc.91's search term, `TP.rate·0.4·(1 − dk)`, stays. On top of
  it goes **the character's own 裂 × (walk − 1)**. That is (walk − 1)× its own rate at the drift's
  start and 0 at the lock.
  - I considered own × walk outright. It would hand the hold its own rate continuously at the
    lock.
  - I rejected it because it adds own × 1 to **every** drift, including 今's and every walk-1
    drift. Those are rc.91's drift exactly, and the walk-off control is what proves the walk.
  - The step to the hold's rate at the lock is rc.91's, and it stays.

**Measured with the critic's tool** (`tools/picture-p3-walkgeo.js`): mean map variance in px²,
per 2 s of the 8 s drift.

| | 0–2 s | 2–4 s | 4–6 s | 6–8 s |
|---|---|---|---|---|
| 同 walk 3, **r1** | 5.54 | 5.60 | 6.55 | 5.87 |
| 同 walk 3, **r2** | **48.50** | **42.32** | **32.63** | **11.95** |
| 同 walk 1, r1 and r2 | 6.09 | 6.44 | 5.71 | 5.75 |

- Walk 1 reads the same to the digit in both rounds, because nothing changes without a walk.
- Walk 3's opening, 48.5 against 6.09, is about ×8 ≈ 2.9². That is the walked amplitude,
  `S.env.flag` = 2.90, squared.

### (b) The gate now checks the walk: `浮同` in `p3render`

The fixture is a 同 drift-in (sev 0.9, entry fade, FU8) on the test card, at walk 3 and at
walk 1. It is **the critic's reception, seed 5 and texture 5** (旗 0.87 · 捩 0.77 · 裂 0.40).
- **Walk 3:** the map variance over 0–2 s must be ≥ 2× that over 6–8 s, and ≥ 2× walk 1's over
  0–2 s.
- **Walk 1:** it must stay flat, within ×1.5.

**Why that seed.** On `p3render`'s usual seed, 77.37, the 同 draw includes 横. Its bars come in
**episodes keyed on reception time**, so walk 1 opened at 2,603 px² and fell to 25.8 by 6–8 s.
The check failed "flat" for a reason that has nothing to do with the walk. The pin follows
§6.3.2, which pins every kind's axes.

The new items go **last** in the item list. The items share one virtual clock. When I first put
them mid-list, every later item ran at different instants: the 切 squash reference read columns
0.88 = 1.6 × rows 0.55 and failed its own shape check.

| run | result |
|---|---|
| this tree | ✓ walk 3: **46.74 → 11.70 px² (×4.00)**, opening ×7.34 over walk 1's. ✓ walk 1: **6.37 → 5.60** |
| `--kill` (`walkAt → 1`) | **✗ 浮同 walk: 5.45 over 0–2 s, ×0.84 against walk 1's.** It fails by name. |
| `--set 90526da` | **✗ 浮同 walk: 5.32 → 5.71 (×0.93).** It fails by name. |

**By eye** (`picture-sheets/P3-entries-浮同.jpg`, new; card and ddr1, walk 3 above walk 1):
- The walk mostly shows in the first half, where the picture is still under the snow. It appears
  as the raster's left edge bent into black wedges at 0.63–3.43 s, which walk 1 does not have.
- From about 6 s the two rows converge, and they are the same at the lock.
- The effect is modest to the eye, because the kinds being walked are buried at that point. That
  matches the critic's reading of 反 in r1.

### (c) `bounds`: GREEN, nothing moved

48 receptions, **436 boundaries, 33,884 frames**, the same counts as r1. Every boundary is on
rc.P4's frame. Every boundary is also on rc.91's frame, except the 11 断 hold→loss boundaries
that P1 moved. Every fu·* reception's drift boundaries fall on the same frames on all three builds (the
printed row, fu·jou·setsu, reads `dr@6 ho@235`), so the drift's window is where it was. All 12 forced receptions ran their modes.

---

## The gates, re-run on `a129d39`

| gate | result |
|---|---|
| `bounds` | **GREEN** (above) |
| `p3draws` | **GREEN.** Every variant appears in each set's 500. Nothing falls outside its pool. The P3 draws come last (20,000 = rc.P4's). Sensitivity: 116 of 200. `zk-picture.js` is untouched. |
| `p3render` | **GREEN.** The 21 variant checks give the same moves and causes as r1. 浮's lines moved in the second decimal (41.22 → 41.25, 33.54 → 33.56, 52.66 → 52.71), because 遠 at sev 0.6 carries geometry kinds that now walk. 焼 r 0.989 / 0.563 (rolled with the picture: 0.330). Burn legibility 0.8828 / 0.9149. Plus the walk check (2 lines) and colour 21/21. |
| `p3render --kill` | **RED, 22 ✗ by name:** r1's 21, plus 浮同 walk. |
| `p3render --set 90526da` | **RED, exactly 2 by name:** 浮同 walk and 残 burn colour. |
| `legibility` | **GREEN**, identical to r1: median 0.7380 against rc.91's 0.7069; 0/48 buried; 48/48 surface, worst window 0.70 s; 遠/嵐 at sev 1 24/24, worst window 0.90 s. The hold is untouched. |
| critic's tools | afterglow DESAT 0.0–1.2 % (table above); walkgeo 48.50 → 11.95 at walk 3 (table above) |

**Perf, run twice back to back** (`perfp1`), as the critic asked:

| run | load | dpr 1 mean / p99 (rc.91) | dpr 2 mean / p99 (rc.91) | worst archetype | verdict |
|---|---|---|---|---|---|
| 1 | 15 / 9 / 11 | 1.313 / 3.0 (1.053 / 3.3) | 1.707 / 4.8 (1.320 / 4.6) | 1.562 | GREEN |
| 2 | 13 / 9 / 11 | 1.411 / 3.5 (1.042 / 3.4) | 1.726 / 4.7 (1.258 / 4.8) | 1.629 | GREEN |

- `p3render`'s step cost was a defaults mean of 1.211 ms (p95 2.4, worst 10.4) and a variants
  mean of 1.158 ms (p95 2.4, worst 6.1).
- The afterglow now does a 27,648-pixel loop and a `putImageData` on each frame of a burn exit's
  collapse, burst and dead tube, and nowhere else. `perfp1`'s drawn receptions do not isolate
  that cost.

**Not re-run:** P2's `render`, `draws`, `lull` and `crack`. Those gates read the hold, 滲 and the
crack, and nothing there changed: `zk-picture.js` and the hold block are untouched. `phases` also
reads `phaseOf`, and that is `bounds`' subject.

## The critic's observations (not required)

1. **Tiers:** the neg exit is 1 in 14, and freeze × burn-in is 1.6 %. These are left to P4.
2. **Walked echoes can outweigh the direct path.** Not capped. The critic let it stand, and a cap
   would be a new rule on `ghostList` for every phase.
3. **The bloom lock-in on 過 blows to the mint top for about 0.1 s.** Unchanged. It is on the
   ramp, and the colour gate allows it: 即 bloom sits exactly at 2/22.
4. **Perf:** see above.
5. **Short-echo walk-down is subtle:** unchanged.

## Open items

1. **The 浮同 walk is modest to the eye** (see 2(b)): the walked geometry is under the snow for
   the drift's first half. It is measurable (×4 over the drift), but a viewer mostly sees the
   raster's bent edge. If the owner wants it to read, the lever is `walk`'s range
   (1.8–3, `ZP.ENTRY`), not the mechanism.
2. **The colour gate's closest pass is 即 bloom, at its limit (2/22).** A longer bloom would trip
   it. That is intended: a longer mint-white would be the owner's call under §11.1.
3. **Carried from r1:** P4's tiers and `"set:burn"` against `"set:tube"`. The burn's frame memory
   records reels only.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2/art/zankyo
node _picture-probe.js bounds --out <dir>                      # GREEN
node _picture-probe.js p3draws --out <dir>                     # GREEN
node _picture-probe.js p3render --out <dir>                    # GREEN (colour 21/21, 浮同 walk ✓✓)
node _picture-probe.js p3render --kill --out <dir>             # RED, 22 by name
node _picture-probe.js p3render --set 90526da --out <dir>      # RED, 浮同 walk + 残 burn colour
node _picture-probe.js legibility --out <dir>                  # GREEN
node _picture-probe.js perfp1 --out <dir>                      # GREEN twice
node _picture-probe.js p3sheets --only P3-exits-残,P3-entries-浮同 --sheets handoff/picture-sheets --out <dir>
node tools/picture-p3-critic.js --jobs tools/picture-p3-critic-afterglow.jobs.json --out <dir>
node tools/picture-p3-walkgeo.js
```
