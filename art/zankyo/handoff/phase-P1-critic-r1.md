# P1 — critic, round 1: NOT SIGNED OFF (2 required items)

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the code at `8fcd38a` and the handoff and sheets at `082c5e8`. I did not write this
code. Every number below comes from my own runs on the coder's :8141 (`router.php`, this
worktree), at load average 28–32.

**Verdict: P1 does not pass yet.** The instruments reproduce exactly, and every gate the coder
built is live. Two things the owner will see are off-brief, and both are small:

1. The §11.2 lull is a metronomic **clearing** on 69 % of receptions, not a face surfacing
   now and then.
2. The crack's light ignores the run weights, so the dead-end hairlines end in a lit,
   blunt tip that the approved option D does not have.

The last green commit is still P0's, `e50d399`. This commit adds only this file, a `lull`
mode in `_picture-probe.js` and `tools/picture-crack-ab.js` (all dev-only).

Music identity was not checked, by the owner's ruling (2026-09-24). `git diff 2baf87e 082c5e8`
over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and `pj2-*` is empty. `index.php`
differs only by P0's script tag.

## The coder's gates, re-run: all reproduce

`node art/zankyo/_picture-probe.js p1` → **GATE GREEN**, exit 0. The numbers are identical to
the coder's, digit for digit:

| gate | coder | mine |
|---|---|---|
| each kind renders (moved vs floor) | 雪 20.53/3.48 · 影 .1047/.0015 · 裂 .6665/.0735 · 霞 .2531/.0003 · 伸 1.168/.0127 | same |
| archetype shares, 20,000 draws | all within ±3.5 % | same |
| seen-before (the gate is ≤ 30 %) | 18.61 % | 18.61 % |
| median hold SSIM, tree vs rc.91 | .7420 vs .7069 (unregistered .7199) | same |
| buried / surfacing, 48 drawn | 0/48 · 48/48, worst 1.10 s | same |
| 遠/嵐 at sev 1 surface | 24/24, worst 1.00 s | same |
| perf mean, dpr 1 / dpr 2 | 1.41 / 1.82 ms | 1.53 / 1.87 ms (rc.91 1.23 / 1.32) |
| perf p99, dpr 1 / dpr 2 | 4.1 / 6.1 | 4.7 / 5.1 (rc.91 4.3 / 4.5) |
| crack: dark frames lit | 0 of 569 | 0 of 569 |
| phases | 即常切, 探戻残 and 即走切 equal rc.91; 浮断絶 loss 84 → 9 | same |

- **Perf:** I accept the tail gate as rewritten (p99 ≤ 6 ms or ≤ 1.1 × rc.91 in the same run).
  On this machine rc.91 misses the plan's 6 ms worst on its own, and the mean is inside 2.5 ms.
- **Registered SSIM:** I accept it (decision 6). Unregistered also passes: .7199 against .7069.
- **The buried and surfacing lines:** I accept 0.2 and 0.4. rc.91 passes both on the same
  fixtures.

### Can each gate fail? Yes

- **Surfacing (my run).** 遠 and 嵐 at sev 1 with the lull removed (force axes
  `{ lull: null }`): **10/24 surface, worst window 0.00 s**. The gate sees the lull.
- **The crack, whole DOM (my run, new `tools/picture-crack-ab.js`).**
  - **Method.** Two identical deterministic runs of the page, glow on and glow off. Each takes
    screenshots of `#zankyo-tube` with the canvas, SVG, scanlines and glass all present. The
    difference between the two runs is exactly what the glow adds.
  - **Pattern A:**

    | moment | pixels that differ | largest difference |
    |---|---|---|
    | idle | **0** of 178,608 | — |
    | dead | **0** | — |
    | idle again | **0** | — |
    | lit hold, john-cage | 2,474 | mean ΔRGB +1.4 / **+12.1** / +2.9 |
    | lit hold, bbc1 | 1,034 | mean ΔRGB +0.2 / +4.4 / +0.6 |

  - **Pattern D:**
    - Idle differs in 0 pixels.
    - Dead and idle-again each differ in **1 pixel, by −1 in blue**. That is compositor
      rounding: it is not an addition, and it is not green.
    - The lit holds differ in 2,430 and 1,012 pixels.
  - **Dark pixels next to bright ones.** Glow-off pixels with G ≤ 30 that the glow touches:
    88 of 56,069, all at most +3 (john-cage); 143 of 107,767, all at most +4 (bbc1, pattern D).
    This is a bright neighbour's light, resampled along the 3.2 px body. It is not light on a
    dark tube.
  - **Sensitivity.** rc.91's stroke put back (`rc91`) makes the idle tube differ in 2,943 pixels,
    by up to +18 in G. The check is live.
  - **Verdict on the owner's rule:** on a dark, idle or dead tube the crack carries **no green
    at all**, and on a bright picture it does.
- **The idle test card and Paik's line** light the crack on 112 of 600 idle frames (the coder's
  run). I rule that correct. They are a picture on the tube, and the owner's objection was
  light over a *dark* tube.

## Required items

### 1. The lull is a clearing on a metronome, on two receptions in three

The owner asked (§11.2) that even the most buried reception "lets the video come to the
surface now and then, as a face or a shape rising out of the noise for a moment and sinking
back", with heavily buried receptions "welcome as the rare end". What was built:

- **It clears rather than surfaces.** In the lull the carrier is **pinned flat at 0.85**. My
  trace of 遠 at sev 1 reads strength 0.47–0.68 outside the lull, then exactly 0.85 for
  ~1.4 s, with no breath. Every impairment also eases by 70–88 %.
  - Across the probe's 24 worst receptions, the median share of hold at SSIM ≥ 0.7 is
    **0.38** (max 0.90). With the lull off it is 0.00.
  - The 遠 strip (`P1-strip-far-遠.png`, tiles 1, 4 and 7) shows it: the worst 遠 is a clean
    picture a third of the time. The rare buried end the owner welcomed no longer exists.
- **It keeps time.** Each reception's lull has one fixed period (T 3.2–4.4 s) and one fixed
  flat (F 0.8–1.2 s). Rise + flat + fall is ~1.7 s of every ~3.8 s, the same every cycle.
  Real fading is irregular (§2.1: an impairment moves the way its cause moves; §4.2: a
  seeded random walk). A 30 s hold shows seven or eight identical clearings.
- **It is on most receptions, not only heavy ones.** `heavySev` 0.55 is below most
  primaries' severity. The lull is on:
  - **68.7 % of 20,000 drawn receptions**, and 33 of the probe's 48;
  - by archetype: 遠 100 %, 嵐 100 %, 過 66 %, 混 65 %, 電 64 %, 同 62 %, 反 60 %.

  So most 反, 同 and 電 tubes also pulse clean on the same rhythm. That is §1's "every
  reception looks the same", moved into time. The coder's own comment warns against it ("a
  lull there would only make every tube pulse alike").
- **Depth is not the knob. Lift is.** With `depth` 0.45 the near-clean share only moves from
  0.38 to 0.33, because `LULL.lift` 0.85 holds the carrier near clean on its own.

**Asked:**
- **(a) A surfacing, not a clearing.** Lower `lift`, keep the breath moving inside the lull,
  and ease the impairments less, so the face comes up *through* the snow.
- **(b) Irregular timing.** Draw each lull's gap and length per occurrence, deterministically
  (a hash of the reception's seed and the lull's index, or a list drawn on the fork). Keep the
  guarantee of ≥ 0.6 s surfaced in any 5 s window.
- **(c) Only where it is needed.** Give the lull only to receptions that do not surface
  without it. Calibrate `heavySev`, or the rule that replaces it, with the probe's lull-off run.

**Gate:**
- `node art/zankyo/_picture-probe.js lull` is GREEN. **It is RED today**, 2 of 4:

  ```
  ✓ 遠 and 嵐 at sev 1 all surface (24/24)
  ✗ a surfacing, not a clearing: median share of hold near clean (SSIM ≥ 0.7) 0.38 (≤ 0.15)
  ✓ sensitivity: with the lull off the surfacing gate fails (10/24 surface) — the gate is live
  ✗ incidence: 68.7 % of 20000 drawn receptions carry a lull (≤ 35 %)
  ```

- Fold `lull` into `p1`.
- `legibility` stays green, 48/48 and 24/24.
- Report the coefficient of variation of successive lull gaps over one 30 s hold (≥ 0.25),
  and remake the 遠 strip.
- `NEAR_CLEAN_SHARE` 0.15 and `LULL_SHARE` 0.35 are my proposals. If a better-argued number
  lands, change them in the probe and say why in the handoff.

### 2. The crack's light must follow the run weights, as the approved D does

- **What the mockup does.** In `mockups/crack-1-options.html`, D's lit layer (`svgLitLayer`)
  strokes every run at **width 1.2·w + 0.4 and alpha 0.55·w**. w is the run's
  `tip × swell`, so a dead-end hairline's light dies out toward its tip, together with its
  edges.
- **What the port does.** `buildPaths()` strokes the whole `crackPath` into the mask at one
  width and one alpha (3.2 px at 0.45, plus a 1.1 px core).
- **What that looks like.** Over a bright picture, every hairline is lit at full strength to its
  very end, with a round cap. Past the point where the SVG's edges have faded, the tip reads
  as a **drawn neon line**:
  - green over mid-bright picture;
  - pure white over the brightest picture, with a faint grey-lilac halo from the neutral edge
    stroke.

  I cropped this at dpr 2 from the pattern A hairline right of the blow (tube x 600–760,
  y 150–260). It shows under 裂 alone and under 影 alone on john-cage @20 s.
- **Asked.** Build the mask run by run from `wandered()`, with the same `runs(…, 3)`, the same
  `crng(900 + i)` weights and the same tip fade as `buildCrackSVG`. The light and the edges
  should agree in *weight* as well as in position. Keep the body/core structure if you like,
  but scale both by w.
- **Gate:**
  - For every non-deep crack (i ≥ 4), the mask's mean alpha along its last run is ≤ 0.3 × that
    along its first run. Measure it from `_dev.buffers().mask`.
  - `crack` is still green.
  - `tools/picture-crack-ab.js` still shows 0 pixels differing on idle and dead, for patterns
    A and D.
  - Re-shoot `P1-crack-lit-*`.

## Recommendations (not blocking)

- **伸 has an envelope it should not have.** Its cause is the beam current (§3.2 "swells
  slightly on bright scenes"), so its only driver should be picture level through the lag. In
  drawn receptions `S.env.swell` also multiplies it: 1 + Σ, with partials of 0.12–0.4 and
  0.05–0.25 at 0.025–0.45 Hz. The raster therefore breathes on a still picture.
  - This is subtle, about ±0.7 % in scale, but it is not the physical cause (§2.1). Drop the
    envelope from 伸, or state why the regulation drifts on its own.
  - Measured: 伸 alone at sev 1 (no envelope) settles to scale 1.0168 in about 1 s, then holds
    flat on a still. That is right.
  - The coder asked me to look at 伸 live. On a paused reel it cannot show more than that. It
    will read on moving reels, and the owner's lab look should use one.
- **The dark specks are square.** A dark speck is one source pixel at l × 0.3, which is 5 × 5
  screen px at dpr 2. The IF smear that streaks the white sparks should smear the black ones
  too; see 遠 at sev 1, which is peppered with crisp squares. rc.91 had square dark pixels too,
  so this is not a regression. It is cheap to fix while the snow is open.
- **Seen-before depends on the JND floor.** Recomputed from the same 20,000 draws:

  | JND floor | tear ignored | tear counted |
  |---|---|---|
  | 0.10 | **18.6 %** | 8.1 % |
  | 0.15 | 27.7 % | 14.3 % |
  | 0.20 | 38.9 % | 23.9 % |
  | 0.25 | 48.8 % | 33.3 % |

  The floor of 0.1 is a decision: it passes the gate here, and P2 has to reach ≤ 20 %. The
  vector counts only the five kind severities. It ignores style, ghost count and polarity,
  dropout kinds, the lull, and the archetype itself. P2 should widen the vector before it
  argues about the floor.
- **The force hook's "consume the fork alike" comment is stronger than the code.** `drawSnow`
  and `drawGhosts` consume different numbers of draws by style. So a *forced* archetype
  matches the drawn one only when it is the archetype the fork would have drawn anyway. That
  is harmless, because every reception has its own fork, but the comment should say so.
- **Carried:**
  - WebKit is unrun (§2.7; QF's).
  - `zk-broadcast.js`'s "29 TUNED reel(s)" `console.error` fires on every page load. I saw it
    again on `index.php?seed=3042`, the only console error or exception in my runs. It is not
    the picture's.

## What I looked at

- **The sheets.**
  - The drawn sheets for 3 reels, against P0's. The looks now clearly differ: 遠's grain and
    fog, 過's hot crush, 同's line tears with the blanking, and 電's dashes.
  - The archetype sheet: 反, 混 and 清 at sev 0.65 are close to one another on a still, which
    P2's kinds should separate.
  - The three strips.
  - The crack screenshots.
- **My own dpr-2 close-ups:** 影 alone, 裂 alone, 遠 at sev 1, and the crack.
- **Realism.** Nothing digital: no RGB split, no blocks, no datamosh. Every kind has its cause.
  The tear shows the horizontal blanking and wraps as a real line does. The negative and
  fluttering ghosts are in the signal, so they carry no snow of their own. The hlock dropout
  shears into diagonal bars.
- **The owner's other rules.** The tint is unchanged in P1, so it is always green. No VFD text
  names anything; the only `textContent` in zk-set.js is 輝度's step.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php                                      # if :8141 is down
node art/zankyo/_picture-probe.js p1 --out <dir>                       # ~13 min at load 30
node art/zankyo/_picture-probe.js lull --out <dir>                     # ~3 min; RED today (item 1)
node art/zankyo/tools/picture-crack-ab.js http://127.0.0.1:8141/art/zankyo/ <dir> 0 on    # idle/dead must differ in 0 px
node art/zankyo/tools/picture-crack-ab.js http://127.0.0.1:8141/art/zankyo/ <dir> 0 rc91  # sensitivity: idle must differ
```
