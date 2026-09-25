# P1 — coder's handoff, round 2

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`,
served on **:8141** (`php -S 127.0.0.1:8141 router.php` from the worktree root; I used the
critic's running server and did not start or stop any).

| commit | what | VERSION |
|---|---|---|
| `14a1837` | item 1 (the lull), item 2 (the crack's run-weighted light), 伸 without an envelope, the probe's r2 checks and modes, the stable-shot fix in `tools/picture-crack-ab.js` | `2.1.0-rc.P2 — a buried picture now surfaces through the snow rather than clearing: now and then, at irregular times, and only on receptions that would stay buried without it; the crack's hairlines fade out along with their light` |
| (this file) | handoff, and the re-shot sheets, strips and crack captures in `handoff/picture-sheets/P1-*` | dev-only |

Files touched: `zk-picture.js`, `zk-set.js`, `_picture-probe.js`, `tools/picture-crack-ab.js`,
`VERSION`. `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css`, `index.php`, `picture-lab.php`
and `pj2-*.js` are untouched. Music identity: not checked, by the owner's ruling (2026-09-24).

All numbers are from my runs at load average 27–42. The final full gate run is
`node art/zankyo/_picture-probe.js p1` on `14a1837`'s tree. It is green on every check but one
perf tail, and a perf-only re-run passes it. See **Perf** below.

---

## 1. The lull: now a surfacing, irregular, and only where it is needed. GREEN

`node art/zankyo/_picture-probe.js lull` is **GREEN, 7 of 7 checks**. It is now part of `p1`.

| check | rc.P1 (critic) | r2 |
|---|---|---|
| 遠 and 嵐 at sev 1 surface | 24/24 | **24/24**, worst window 1.00 s |
| median share of hold near clean (SSIM ≥ 0.7), gate ≤ 0.15 | 0.38 | **0.07** (max 0.81, see below) |
| sensitivity: lull off | 10/24 surface | 12/24 surface: the gate is live (see "instrument" for why 10 became 12) |
| incidence over 20,000 drawn receptions, gate ≤ 35 % | 68.7 % | **31.6 %** |
| CV of successive lull gaps over one 30 s hold, gate median ≥ 0.25 | 0 (one fixed period) | **median 0.729**, p5 0.380, min 0.040, over 6,329 lulled receptions |
| start-to-start intervals, for the record | 0 | median CV 0.288, p5 0.163; 7–12 lulls per 30 s (median 9) |
| the schedule's guarantee (≥ 0.6 s of lull flat in every 5 s window of the first 30 s) | — | worst **0.70 s** over 6,329 receptions |
| sensitivity: rc.P1's fixed period | — | reads CV 0.000: caught |

Incidence by archetype: 嵐 80 %, 遠 54 %, 反 38 %, 電 32 %, 混 20 %, 過 11 %, 同 9 %, 清 0 %.

The critic's thresholds are kept as proposed: `NEAR_CLEAN_SHARE` 0.15, `LULL_SHARE` 0.35 and
`LULL_CV` 0.25. The CV gate is on the median, and the p5 and minimum are reported. A reception
whose 30 s draws only short rests reads a low CV, and the minimum of 0.040 is one such.

The max near-clean share of 0.81 is 嵐·sev1·3. It is 0.75 near-clean with the lull **off**:
two light kinds drawn at sev 1 are legible anyway.

### (a) A surfacing, not a clearing

rc.P1 pinned the carrier to 0.85 and eased every impairment by 70–88 %. Now, in `zk-set.js`
(the hold):

- **The carrier is lifted by `LULL.lift` 0.08 × the lull's height**, capped at 0.84. It is no
  longer pinned to a level, so the drawn breath keeps moving underneath.
- **Each impairment eases only as far as a target at the top of the lull**:
  - the snow's spark density (`sourcePass`'s p) to `pT` 0.065;
  - the fog's lost contrast, or a hot picture's crush, to `wT` 0.15;
  - the echoes' summed amplitude to `gT` 0.12;
  - the tear rate to `tT` 0.4.
- **An impairment already under its target is left alone.** Whatever buried a reception, a lull
  brings it up to about the same place: a face through a veil of snow. The most buried reception
  eases the most, and a lightly buried one hardly changes.
- **Dropouts inside a lull are knocked `dropEase` 0.9 less deep.**

**Why targets and not a relative depth.** I tuned a relative ease first: depth 0.36–0.62,
growing with burial, and lift 0.08–0.16. It could not pass both checks at once. The snow-bound
遠s cleared, with a near-clean share of 0.14–0.19, while the worst 嵐s barely surfaced (worst
window 0.2–0.7 s).

The targets are one monotone knob:

| pT | wT | gT | dropEase | near-clean | worst window |
|---|---|---|---|---|---|
| 0.05 | 0.12 | 0.15 | 0.7 | 0.24 | 1.0 s |
| 0.06 | 0.14 | 0.15 | 0.7 | 0.13 | 0.6 s |
| 0.07 | 0.16 | 0.15 | 0.7 | 0.06 | 0.6 s |
| **0.065** | **0.15** | **0.12** | **0.9** | **0.07** | **1.0 s** (these) |

`--lullk '{…}'` tries LULL constants in-page without an edit. It is dev only and never part of a gate.

### (b) Irregular, deterministic, and still guaranteed

`ZP.lullSchedule(L, until)`:

- **What is drawn, and from what.** Lull n's rise (0.25–0.6 s), flat (0.7–1.5 s), fall
  (0.3–0.8 s), height h (0.9–1) and the rest after it all come from `hashU(key, n, j)`.
  - `key` is one draw on the reception's fork (`set:rx:<seed>`).
  - The schedule is deterministic and unbounded, it makes no per-frame draws, and it is cached in
    a WeakMap, so the character stays plain JSON.
- **The rest is bimodal.**
  - 40 % of the time it is short, at most 0.12 of the room left: a quick second rise.
  - Otherwise it is long, at least 0.6 of the room.
  - So the lulls come in pairs and long waits, not on a beat.
- **The guarantee:**
  - fall + rest + rise ≤ `gapMax` 3.6 s, and every flat is ≥ 0.7 s. So any 5 s window holds
    ≥ 0.6 s of flat: 0.6 + 3.6 + 0.6 ≤ 5.
  - The first flat starts by 3.3 s.
  - The probe checks this from the schedule itself (worst 0.70 s).
- Lull timing is per piece: a 戻/走 piece n ≥ 1 redraws on `set:rx:<seed>:<n>`, as before.

### (c) Only where it is needed: `ZP.burial(ch) > BURY_LINE`

The estimate is made from the character alone, at the carrier's resting level (lvl = 1 − breath.base):

```
3·p  +  0.5·grain·lvl  +  1.5·Σ|echo a|  +  2·(1 − wash gain)  +  (wash gain − 1)⁺  +  tear rate·min(1.5, jump/10)·lvl
```

- **The data** (`lullcal` mode, lull forced off): 226 receptions.
  - 144 from `lullcal`: 40 drawn seeds × 3 reels, plus 遠/嵐 at sev 0.7–1.
  - The lull mode's 24.
  - 58 legibility receptions that drew no lull.
- **The fit.** The weights come from a grid: the lowest incidence that still covers every
  reception that failed to surface, or surfaced with a worst window under 0.8 s (38 receptions,
  lowest score 0.951). `BURY_LINE` is 0.856, 10 % under that.
- **What each term was added for:**
  - the tear term, for an uncommon 同 carrying a full-strength secondary snow (two of them failed
    the legibility gate on snow and tears together);
  - the echo term, for a 反 whose three echoes summed to 0.57;
  - the crush term, for a hot-washed 嵐.
- **嵐 is no longer given a lull by name.** A storm of two light kinds is legible without one.
- **VALIDATION ON FRESH SEEDS** (never used in the fit):
  `lullcal --built --seed0 2001` gives **144/144 surface, worst window 0.8 s**, with 59/144 lulled.
- **Caveat.** The legibility gate's own receptions are now partly training data, so on its own it
  no longer tests the rule independently. The fresh-seed run is that test. The fit is a linear
  score on 226 points, so a reception just under the line can still be borderline:
  john-cage·102.37 was, at 1.074 on an earlier weighting. Keep the 10 % margin if the weights move.

### The legibility gate (§6.3.3) after the change

| | r2 | rc.91 |
|---|---|---|
| median hold SSIM (registered) | **0.7194** | 0.7069 |
| the same, unregistered | 0.6972 | 0.7069 |
| below the buried line (0.2) | 0/48 | — |
| drawn receptions that surface | **48/48**, worst window 1.20 s | 48/48, worst 1.60 s |
| 遠/嵐 at sev 1 that surface | **24/24**, worst window 1.00 s | — |

**Unregistered, the tree is now below rc.91** (0.6972 against 0.7069). The critic noted in r1
that unregistered also passed; it no longer does. The gate is the registered one (decision 6,
accepted). The drop comes from spending the lull less: 33 of 48 receptions had one, and now
fewer do. By archetype, median (range): 遠 0.636 (0.222–0.824), 混 0.763, 反 0.791, 電 0.767,
同 0.772 (0.491–0.861), 嵐 0.743, 清 0.947.

### The instrument: SSIM is now registered for the set's own 伸 scale too

- **The failure.** 嵐·sev1·4 (影 0.87, 霞 0.88, 伸 1.0) never surfaced, lull or not. Its SSIM sat
  at 0.3–0.48 even inside the lull.
- **The cause.** The swell draws the raster up to ~4 % larger, and plain SSIM scores a picture
  3 % larger as buried.
  - With `--axes '{"swell":{"amt":0}}'` the same 24 went from 23/24 to 24/24.
  - With the lull off, 10/24 became 12/24. That is why the sensitivity line reads 12/24 now.
- **The fix.** A picture drawn 3 % larger is as legible as one in place ("legibility is not
  position", decision 6). So `PAGE_MULTI` now scales the clean about the centre by the set's
  **own** scale for that frame before registering position:
  - the scale is `geo.sc × geo.sy` from `_dev.buffers()`, divided by the clean's own;
  - it is read from the set, not searched;
  - rc.91 has no 伸, so its scale is always 1 and its numbers do not move.
- **Please check it.** This is a change to the instrument that made a gate pass, so the critic
  should rule on it.

### 伸 without an envelope (the critic's recommendation, taken)

In the hold, `S.env.swell` is now 1. The picture's own level, through the lag, is 伸's only
driver. `E["伸"]` is still drawn, so the fork is consumed alike.

### The strips

- `P1-strip-far-遠.jpg`, which replaces the r1 `.png`, and a new `P1-strip-far-遠-john-cage.jpg`:
  - both are 遠 at sev 1, seed 505.37, with a tile every 0.5 s of a 12 s hold;
  - each tile is captioned with its time, the lull level and the carrier;
  - they were made with the new `strip` mode.
- The face comes up through the snow at 2.8–4.3 s and 7.3–8.8 s (lull 0.73–0.93). It is buried
  at 4.8–7.0 s and 9.3–11.3 s.
- On ddr1 the surfaced frames read cleaner than on john-cage, because the ddr1 picture has more
  contrast. The near-clean gate is measured on john-cage only. Owner or critic eyes on the ddr1
  strip are welcome.

---

## 2. The crack's light follows the run weights. GREEN

- **One list for both the edges and the light.** `wandered()` now builds `WP.runs` once. It uses
  the same `runs(…, 3)`, the same `crng(900 + i)` draws in the mockup's order (swell, then lit)
  and the same tip fade. `buildCrackSVG` and `buildPaths` both read it, so the SVG output is
  byte-identical to r1.
- **The mask is drawn run by run:**
  - body `GLOW.wide·w` px at alpha `GLOW.wideA·w`;
  - core `GLOW.core·w` px at alpha `w`.
  - A deep run (w ≈ 1) is r1's 3.2 px at 0.45 and 1.1 px at 1. A hairline's last run
    (w ≈ 0.06–0.1) is a tenth of that in both width and alpha.
- **Butt caps.** Round caps overlap at every joint between two runs and bead the light.

**The gate, in `_picture-probe.js crack`** (check d, new): the mask's mean alpha is sampled every
0.5 px along each run's own centreline.

| | result |
|---|---|
| last run ÷ first run, every dead-end hairline (i ≥ 4), all 4 patterns, gate ≤ 0.3 | **worst 0.030** over 12 hairlines; ratios 0.01–0.03, e.g. A4 0.921 → 0.015, D5 0.708 → 0.007 |
| sensitivity: r1's one-weight mask put back (`_dev.maskFlat(true)`) | ratios 0.95–1.03, worst 1.031: caught |
| `crack` (a–c) | all green: 566 dark frames with glow 0 in every channel; 0 of 920 frames over the cube; bbc1 lights 150/150 hold frames (max G 245); idle canvas crack excess ≤ beside for A–D; SVG alone max 0; both sensitivities caught |

**The glow hook now reports premultiplied light** (`_dev.glow()`):

- **Why.** `getImageData` un-premultiplies. At the hairlines' faint new alphas, an 8-bit colour
  divided by an alpha of 2/255 read as up to 255, which is light that is not there. The "never
  over the cube" check failed on 15 of 920 frames for that reason alone.
- **The check now measures colour × alpha**, which is what `lighter` adds.
- **The dark-frame check is not weakened.** Any stored value of 1 or more still reads as 1 or more.

**`tools/picture-crack-ab.js`, the whole page, glow on against off:**

| pattern | idle | dead | idle again | lit hold |
|---|---|---|---|---|
| A | **0** px | **0** | **0** | bbc1 927 px (mean ΔG +3.55); john-cage 2,202 px (mean ΔG +11.49) in one run |
| D | 1 px, **−8** in all three channels | **0** | 1 px, −8 | john-cage 2,201 px, bbc1 908 px |
| A, rc.91's stroke put back | **2,943** px, up to +18 G: caught | 2,943 | — | — |

- **D's one pixel is darker in the glow-on shot, not lighter.** `lighter` cannot darken, so this
  is rasterisation or compositing. No green is added on a dark tube.
- **The tool is not fully deterministic at load 30–40.** I fixed one cause and one remains.
  - **Fixed: the compositor lag.** Before the fix, one run's D idle differed over the whole tube
    (175,917 px, the idle raster's breathing a few steps apart). The compositor handed back an
    old frame. `shoot()` now waits for two identical consecutive shots.
  - **Remaining: reel frames not decoded in time.** In one A run the glow-off side's john-cage
    frame was never drawn (dark 177,321 of 178,608 px), so "cage" differed over the whole tube.
    In the rc91 run, idle2 and bbc1 did the same. Idle and dead never depend on a reel, and they
    were 0 px in every A run. This is carried as open item 3.
- **Re-shot:** `P1-crack-lit-{A,D}-{john-cage-interview,bbc1-testcard-news-1979}.png`. The hairlines' light now thins
  out with their edges.

---

## The rest of `p1` (final run)

- **render: green, unchanged.** 雪 20.53/3.48, 影 .1047/.0015, 裂 .6665/.0735,
  霞 .2531/.0003, 伸 1.168/.0127 (moved/floor).
- **draws: green, unchanged.**
  - Archetype shares are all within ±3.5 %; the uncommon tier is 0.1666.
  - Seen-before is 18.61 %, and 今 reads 100 %.
  - The lull no longer draws four numbers, only `key` and `off`, and its draws are the last on
    the fork, so nothing else the fork draws has moved.
- **phases: green.** 即常切, 探戻残 and 即走切 are identical to rc.91. For 浮断絶, loss goes from
  84 to 9 frames.
- **Perf.** The mean is green in every run. The dpr-2 p99 is borderline, and it is load:

| run | load | mean dpr1 / dpr2 (tree; rc.91) | p99 dpr1 / dpr2, tree vs rc.91 | tail gate |
|---|---|---|---|---|
| p1 (earlier tree, same per-frame code) | 28 | 1.755 / 2.006 (1.519 / 1.467) | 5.8 vs 5.7 / 6.2 vs 6.4 | pass |
| p1 (final) | 34–42 | 1.527 / 2.345 (1.428 / 1.408) | 4.0 vs 4.6 / **6.7 vs 5.2** | **fail** |
| perfp1 re-run (final tree) | 33–38 | 1.547 / 1.975 (1.229 / 1.329) | 4.0 vs 4.2 / 5.9 vs 4.5 | pass (≤ 6) |

- **What r2 adds per frame:** in the hold, a handful of multiplies and one pass over at most four
  echoes for the lull's targets. The mask is built once per resize or pattern. Nothing new runs
  in the composite.
- The worst archetype mean was 1.70 ms in the final run. An earlier run at load ~28 read 3.19 ms
  for 遠. It was the first archetype on a freshly loaded page, and the re-run read 2.03.
- **The critic should read the tail at a quieter load.** It has passed 2 of 3 times.

## Decisions I made (the owner was not available)

1. **The lull eases to target levels, not by a relative depth** (see 1a). It is the only form I
   found that passes both surfacing and near-clean with margin.
2. **The lull goes by a fitted burial score, not by archetype.** 嵐 is not always lulled.
3. **SSIM is registered for the set's own 伸 scale**, read from the set rather than searched.
   This needs the critic's ruling.
4. **The glow hook reports premultiplied light.**
5. **I kept the critic's proposed thresholds:** 0.15, 0.35 and 0.25 (the last on the median).

## Open items

1. **Dark specks are still square** (the critic's recommendation, not taken). The snow was not
   otherwise touched this round, and a change would move every gate. It is cheap to do in P2
   with the other kinds.
2. **Seen-before still uses the five-severity vector** (JND floor 0.1, 18.61 %). P2 should
   widen it, as the critic advised. The lull adds variety that it does not count.
3. **`tools/picture-crack-ab.js`: the lit-hold rows are not reliable under load.** Sometimes the
   reel's frame is not decoded when the step draws. Idle and dead are reliable. The fix would be
   to wait for `requestVideoFrameCallback` (or step until `src` is non-black) before shooting.
4. **The perf tail at dpr 2** passes in 2 of 3 runs at load 28–42 (see above).
5. **The force hook's "consume the fork alike" comment** is still stronger than the code (critic
   r1). It is harmless; I left it for P2's force work.
6. **Carried:**
   - WebKit is unrun (QF's).
   - `zk-broadcast.js`'s "29 TUNED reel(s)" `console.error` fires on every load. It is not the
     picture's.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php                                        # if :8141 is down
node art/zankyo/_picture-probe.js p1 --out <dir>                         # ~15 min at load 30; now includes lull
node art/zankyo/_picture-probe.js lull --out <dir>                       # ~1 min
node art/zankyo/_picture-probe.js crack --out <dir>                      # includes d. the run-weight mask check
node art/zankyo/_picture-probe.js lullcal --built --seed0 2001 --out <dir>   # fresh-seed validation of the lull rule (~5 min)
node art/zankyo/_picture-probe.js lullcal --out <dir>                    # the lull-off calibration data (lullcal.json)
node art/zankyo/_picture-probe.js strip --force '{"archetype":"遠","sev":1}' --reel 2 --seed 505.37 --name P1-strip-far-遠 --out <dir>
node art/zankyo/tools/picture-crack-ab.js http://127.0.0.1:8141/art/zankyo/ <dir> 0 on     # and 3 on; 0 rc91 for the sensitivity
```
