# P3 — critic, round 1: NOT SIGNED OFF (2 required items)

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the picture at `90526da` (rc.P5) and the handoff and strips at `6330335`. I did not
write this code. Every number below comes from my own runs on :8141 (`router.php`, this
worktree). I started no server and stopped none.

**Verdict: P3 does not pass yet. The last green commit stays `7f99524`** (`2.1.0-rc.P4`).
Every gate the coder reported reproduces to the digit. The kill run is RED with all 21 names.
Two findings sit outside what the gates look at:
1. the 残 afterglow is **grey**, off the P39 ramp (§11.1: always green, never white);
2. 浮's walk-down never reaches the offset-map kinds, so a 同 drift-in does not walk down at all
   (§3.5).

Both fixes are small. Neither touches a receiver window.

This file, two tools and four critic frames are dev-only, so they need no bump.

**Load.** 5.7 when I started, and 6–12 through the runs (`uptime`).

**Standing checks:**
- Music identity was not checked, by the owner's ruling (2026-09-24).
- `git diff 2baf87e HEAD` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/` is empty. `index.php` differs only by P0's script tag and the
  `$zk_assets` entry.
- The `zk-set.js` diff (`e5b49f2..90526da`) adds no text: no `fillText`, no VFD or log line. The
  VFD still names nothing (§11.3).
- **Port 8071** serves another session's scratch directory
  (`/private/tmp/…-far/…/serve-76d514e`), not this worktree. I agree with the coder's note and
  left it alone.

---

## The gates, re-run

| gate | my run | coder |
|---|---|---|
| `bounds` (timing, §2.3) | **GREEN.** 48 receptions, **436 boundaries, 33,884 frames**. All on rc.P4's frame, and on rc.91's except the **11 断 hold→loss boundaries** P1 moved. The 12 forced receptions ran their modes. | same |
| `p3draws` (node) | **GREEN.** Every lock-in (6), loss (8) and glimpse (4) appears in each of the 40 sets' 500. No variant falls outside its pool. The P3 draws come last: all 20,000 characters equal rc.P4's apart from P3's fields. Sensitivity: 116 of 200. vline 1 in 86. 焼 18/40 nights, 15.0 %. | same, share for share |
| `p3render` | **GREEN**, 21/21, with the same moves and causes as the handoff's table. Examples: 即 roll 14.70 against 3× the floor at 2.15; 焼 r 0.989 / 0.563 (rolled with the picture: 0.330); burn legibility 0.8828 against 0.9149. | same |
| `p3render --kill` | **RED, 21 ✗ by name.** Each fails on its image and, where it has a cause, on the cause. The only ✓ is the burn-legibility guard, which holds trivially. | same |
| `legibility` | **GREEN.** Median **0.7380** against rc.91's 0.7069; 0/48 buried; **48/48** surface, worst window 0.70 s; 遠/嵐 at sev 1 **24/24**, worst window 0.90 s. | same |
| perf | `p3render` step cost at load 6/12/24: defaults mean 1.648 ms, **variants mean 1.518 ms**, p95 4.4 ms. `perfp1` gave RED, then GREEN; see "Perf, run twice" below. | 1.563 / 1.948 ms |

**Can `bounds` fail? Yes.** It already tells rc.91's 断 tail from the tree's, one boundary per 断
shape, so it sees a boundary move by the length of a hole. The phases come from `phaseOf`, which
P3 does not touch, so this gate is the right instrument and it is green.

## What I looked at

- **The coder's six strips.**
- **Full-size tube frames of my own** (`tools/picture-p3-critic.js`, new). This tool captures
  any bench reception at any moment of any phase, and reads each frame's colours against the
  P39 ramp **after** compositing. The probe reads the 192×144 luma before the ramp, so it
  cannot see colour.

**Realism by eye, variant by variant. Each reads as its cause:**
- **即 roll:** the picture comes in rolling, with its blanking bar, and slides into place.
- **即 bars:** diagonal streaks, then a sheared parallelogram that straightens.
- **即 fade:** snow, then a dim picture that firms up.
- **即 ghost:** the doubled picture first.
- **浮 bars:** the horizontal blanking crosses the picture as a black diagonal band, which is
  exactly how lost horizontal hold looks.
- **切 vline:** the raster is squeezed into a column with a bright vertical line.
- **切 neg:** a negative flash, then black.
- **切 freeze:** the frozen card is eaten by snow and then squashes.
- **焼 k 0.18 (`P3-critic-r1-焼-k0.18-cage-2.00s.png`):** the test card's circle and its 試験
  panel sit faintly dark behind the face, and they hold still on the glass. This is the
  canonical burn-in.

**Nothing digital.** I saw no RGB split, no blocks and no datamosh. Every variant is geometry,
gain or the frame store.

---

## Required item 1: the 残 afterglow is grey, off the P39 ramp (§11.1)

**Measure: DESAT.** Of the full-resolution pixels with green 30–215, DESAT is the share whose
saturation, (G − max(R,B)) / G, falls more than 0.2 below the ramp's own saturation at that
green. The job file is `tools/picture-p3-critic-afterglow.jobs.json`: the 残 fixture of
`p3render`, 清, texture 21, on all three reels, with `burn` and `squash` at the same instants.

| reel | exit | collapse (11.50 / 11.73) | burst 12.00 | dead 12.20 / 12.50 / 12.80 |
|---|---|---|---|---|
| john-cage | burn | 9.8 / **15.6 %** | 6.4 % | 10.0 / **29.1 / 57.3 %** |
| john-cage | squash | 0.1 / 1.8 % | 0.7 % | 0.9 / 6.7 / 0.0 % |
| bbc1 | burn | 7.0 / 10.5 % | 3.0 % | 4.8 / 14.9 / **60.8 %** |
| bbc1 | squash | 0.7 / 4.2 % | 0.8 % | 1.1 / 6.6 / 0.0 % |
| ddr1 | burn | 15.6 / **18.0 %** | 13.3 % | 15.6 / **35.5 / 85.9 %** |
| ddr1 | squash | 1.2 / 2.7 % | 0.8 % | 0.9 / 6.6 / 0.0 % |

rc.91's own squash reaches 6.7 % at most, which is the Paik line's persistence. Every P3
lock-in I measured also reads within its default's range:
- snap 0.1 s: 2.8 %;
- bloom on 清: 5.4 %;
- bloom on 過: 14.4 % in its first 0.1 s only, which is the ramp's own mint top blown out;
- all of them 0–0.7 % from 0.2 s on.

**By eye**, compare `picture-sheets/P3-critic-r1-残-burn-afterglow-ddr1-12.50s.png` with
`…-squash-ddr1-12.50s.png`:
- On the dead tube the newsreader's paper, his face and the "G. Sarrazens" caption glow
  **neutral grey-white** under the snow.
- The cage frame at 12.20 s shows the window panes grey.
- The coder's own `P3-exits-残.jpg` bottom row shows it too, at 11.50–12.47 s.

**Cause.** `drawAfterglow` adds `aftCv`, which is a copy of `phos`, the P39 **RGBA** image,
with `lighter` at `globalAlpha = aftA × dd` (0.02–0.5). The ramp's top is (222, 255, 226).
Scaling that by α keeps R ≈ G ≈ B, which gives a grey. At the same green the ramp itself is
saturated: at G 128 the ramp's R is about 30. rc.91's persistence scales RGB the same way, but
it is gone in 2–3 frames, so it never shows. The afterglow holds for a second or more, so its
grey is on screen. A phosphor that gives less light is further **down the same P39 curve**,
not a scaled copy of its top. The handoff's statement that "everything drawn is on the P39
ramp" does not hold for this layer.

**Asked:**
- **(a) Put the afterglow on the ramp.** Keep the last lit frame as luma (192×144), not as
  RGBA. Each frame, map luma × aftA through the tube's LUT into a small canvas, and add that
  canvas at the dead tube's persistence rate as now. The steady state is then the ramp's own
  colour at the decayed level.
- **(b) Make the gate see colour.** Give `p3render` a colour check on the full-resolution
  frame, variant against its default at the same instants, over every variant's window. DESAT
  is one way to do it, and the metric is in `tools/picture-p3-critic.js`.
  - It must fail today's `burn` exit by name.
  - It must pass after (a).
  - `--kill` cannot prove this one, because killing the exit removes the afterglow. So also
    show that it fails on `90526da`'s `drawAfterglow`.

## Required item 2: 浮's walk-down skips the offset-map kinds, so 同 never walks (§3.5)

`geometryPass` calls `ZP.geoMap(map, ch, S.re, t/1000, ph === "hold" ? S.env : ENV1, rnd)`.
During `drifting`, `tickSignal` sets `S.env = WALK`, but the offset map is handed `ENV1`. So
旗, 揺, 捩 and 横 run at ×1 through the whole drift, whatever `walk` was drawn. The tear
during the drift also runs at rc.91's `TP.rate · 0.4 · (1 − dk)`, not the character's.
- 同's primaries are all offset-map kinds (横 旗 縦 捩, plus 揺 and 裂).
- So a 同 drift-in, the "tired set" arriving, **does not walk down at all**.
- The handoff says "Every impairment is × walk", and that is not so.

**Measured** with `tools/picture-p3-walkgeo.js` (new): an 8 s drift on the test card, texture
5, entry fade, sev 0.9, recording the offset map's variance in px², averaged per 2 s of the
drift.

| | 0–2 s | 2–4 s | 4–6 s | 6–8 s | S.env.snow at 2 s / 4 s |
|---|---|---|---|---|---|
| 同 (旗 0.87, 捩 0.77, 裂 0.40), walk 3 | 5.54 | 5.60 | 6.55 | 5.87 | 2.90 / 2.55 |
| 同, walk 1 | 6.09 | 6.44 | 5.71 | 5.75 | 1 / 1 |

The walk is live in `S.env`: snow reads 2.90 and then 2.55. The map does not follow it, and the
two rows differ by texture only.

The gate could not catch this. `p3render`'s one walk check is 反's pinned echo, which is a
source kind.

**Asked:**
- **(a)** Hand the offset map `S.env` while drifting as well, the way the source pass already
  takes it (`hold = ph === "hold" || ph === "drifting"`). Also decide whether the drift's tear
  should be the character's own 裂 × walk; if you keep rc.91's, write down why.
- **(b)** Add a 同 drift-in to `p3render`. The map variance over the drift's first quarter
  against its last must fall with walk and stay flat with walk 1. The kill run's `walkAt → 1`
  must fail it by name.
- **(c)** Re-run `bounds`. The drift's window must not move, and nothing in this change should
  move it.

---

## Perf, run twice

`perfp1` ran twice, alone, back to back.

| run | loadavg | dpr 1 mean / p99 (rc.91) | dpr 2 mean / p99 (rc.91) | worst archetype | verdict |
|---|---|---|---|---|---|
| 1 | 7 / 8 / 17 | 1.852 / **6.3** (1.259 / 4.6) | 2.130 / 6.9 (1.689 / 8.0) | 同 1.965 | **RED** on the dpr 1 p99 (6.3 against 6, and against 1.1 × 4.6) |
| 2 | 6 / 8 / 16 | **1.249 / 3.3** (1.001 / 3.1) | **1.531 / 4.5** (1.187 / 4.7) | 1.410 | **GREEN** |

The tree/rc.91 ratio moved from 1.47 to 1.25 between two runs of the same code. That spread
is the machine's, not P3's. The coder's run read 1.25, and P2's critic 1.597 against 1.25.

**I count perf as green.** For round 2, run perf twice and report both runs, because a single
run at this load can land on either side of the p99 line.

## Observations (not required)

1. **Tier pressure for P4.** The neg exit is **7.2 % of all losses (1 in 14)**. §4.3 lists "a
   negative-flash overload" as rare (about 1 in 25). The coder's 1.6 % freeze × burn-in against
   "very rare" is the same kind of excess. Both are P4's to thin, as the coder says.
2. **Walked echoes can outweigh the direct path.** `ghostList` scales each echo by
   `envG × (0.85 + 0.8(1 − strength))`. With walk 3 at the drift's start, that is ×~5, so a
   sev 1 反 first echo of −0.37 reaches about −1.8.
   - My frame of that case (walk 3 pinned, a −0.37 echo at 4 px) reads as an edge relief of the
     face under full snow, meanG 37 against 83 at walk 1.
   - That is a physical extreme: the reflected path is stronger than a weak direct one.
   - It is buried under the snow at that point, and the picture is out by 6 s. I let it stand.
     If the coder caps |a| at, say, 1.2 while fixing item 2, that is fine too.
3. **The bloom lock-in on 過 blows about 70 % of the frame to the ramp's mint top for about
   0.1 s.** It stays on the ramp, but it is the palest thing P3 draws. The owner may want it
   shorter.
4. **Perf.** One `p3render` defaults frame took 61.8 ms (the kill run's worst was 15.7). It is
   in the defaults group, so it is not a P3 cost, and the budget gate is `perfp1`'s p99 (see
   "Perf, run twice").
5. **Walk-down on short echoes is subtle** (the coder's open item 1). I agree: by eye it barely
   reads on 1.5–5 px echoes. It is not required.

## For round 2

- Items 1 and 2.
- Re-run `bounds`, `p3render`, `p3render --kill` and `legibility`, plus the new colour and walk
  checks.
- Re-shoot `P3-exits-残.jpg` and a 同 drift-in strip.
- The VERSION bump for the fixes is the coder's (rc.P6: "the afterglow stays green, a bad-sync
  drift-in settles as it arrives").

## Re-run (mine)

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2/art/zankyo
node _picture-probe.js bounds --out <dir>              # GREEN
node _picture-probe.js p3draws --out <dir>             # GREEN
node _picture-probe.js p3render --out <dir>            # GREEN
node _picture-probe.js p3render --kill --out <dir>     # RED, 21 by name
node _picture-probe.js legibility --out <dir>          # GREEN
node _picture-probe.js perfp1 --out <dir>              # RED at load 7/8/17, GREEN at 6/8/16 (run it twice)
node tools/picture-p3-critic.js --jobs tools/picture-p3-critic-afterglow.jobs.json --out <dir>   # item 1
node tools/picture-p3-walkgeo.js                        # item 2
```
