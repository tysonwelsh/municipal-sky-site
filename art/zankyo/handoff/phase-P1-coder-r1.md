# P1 — coder's handoff, round 1

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`,
served on **:8141** (`php -S 127.0.0.1:8141 router.php` from the worktree root). As P0 noted,
:8071 and :8072 are not this worktree.

| commit | what | VERSION |
|---|---|---|
| `8fcd38a` | P1: the character draw, the enriched kinds, one offset map at source resolution, the three declared fixes, the owner's crack pick, the lab's archetype sheet, and the probe's P1 modes | `2.1.0-rc.P1 — every reception comes in its own way …; the crack is lit only by the picture behind it, with no green on a dark tube` |
| (this file) | handoff and the sheets in `handoff/picture-sheets/P1-*` | dev-only |

Files touched: `zk-picture.js`, `zk-set.js`, `picture-lab.php`, `_picture-probe.js`, `VERSION`.
`zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css`, `index.php` and `pj2-*.js` are untouched.
`index.php` already loads `zk-picture.js` and lists it in `$zk_assets` (P0).

## Every gate, measured

All runs: `node art/zankyo/_picture-probe.js p1` → **GATE GREEN, exit 0** (load average 28–31).
`sheets` was run separately. Full log: the run's `p1.log`. Every number below comes from
that one run.

### §6.3.2 Does each kind render: GREEN (fail by name)

Each P1 kind is forced **alone** at median axes (`force {impairment, sev}`, every drawn u = ½)
on a **plain** hold (john-cage-interview @20 s, 6 s, no dropouts; critic P0 item 2). Each runs
under 3 texture seeds, every 3rd frame, and is compared with the clean reference. The floor is
3 × max(the clean's spread over the same seeds, P0's unseeded spread for that metric).

| kind | metric | clean (spread) | sev 0.5, min of 3 | sev 1 | moved | floor |
|---|---|---|---|---|---|---|
| 雪 | snowTV | −0.0045 (0.0107) | 20.52 | 49.66 | 20.53 | 3.48 |
| 影 | ghostAmp | 0.0002 (0.0005) | 0.1049 | 0.1269 | 0.1047 | 0.0015 |
| 裂 | lineVar | 0.0037 (0.0090) | 0.6702 | 1.2621 | 0.6665 | 0.0735 |
| 霞 | washDev | 0.0001 (0.0001) | 0.2531 | 0.3694 | 0.2531 | 0.0003 |
| 伸 | scaleDev (%) | 0.0028 (0.0042) | 1.1708 | 1.6472 | 1.1680 | 0.0127 |

- `KIND_METRIC` now covers every name in `ZP.IMPAIRMENTS`. A kind with no metric fails the
  mode (the `_cover.js` rule).
- **New metric, ghostAmp.** P0's `ghostPeak` is a correlation. It saturates at about 0.77
  (sev 1 read *lower* than sev 0.5), and once a negative ghost is allowed (`|r|`) it reads 霞's
  linear residual as a ghost (0.91).
- How ghostAmp works:
  1. Regress out the residual's linear part in the clean.
  2. Search delays from −3 to +40 px, so a pre-ghost counts.
  3. Report the echo's regression amplitude at the best delay.
- The probe also prints a cross-talk table (every metric under every kind).

### §6.3.1 The character draw: GREEN

20,000 draws: 40 seed sets (3042, 17, 7, 8891, 101–136) × 500. Each reception's fork is
`set:rx:<desc.seed>`, where desc.seed is a float, as the receiver draws it.

| | 遠 | 反 | 混 | 電 | 同 | 過 | 清 | 嵐 |
|---|---|---|---|---|---|---|---|---|
| §4.1 | .22 | .18 | .12 | .13 | .15 | .08 | .07 | .05 |
| drawn | .2217 | .1747 | .1222 | .1293 | .1490 | .0828 | .0691 | .0512 |
| relative | +0.8 % | −2.9 % | +1.8 % | −0.5 % | −0.6 % | +3.5 % | −1.4 % | +2.3 % |

- **The gate is on the aggregate.** The single 500-draw sets spread widely: 同 runs
  0.110–0.178 and 嵐 0.028–0.068. A ±25 % band on one set of 500 is only about 2σ for the
  smaller archetypes, so per-set shares would fail by chance.
- **Tier uncommon:** 0.1666 (target 1/6). Rare and very-rare tiers are P4's (§7 row P4).
- **Distinct archetype·kind combinations:** 30.
- **Seen-before: 18.61 %** (worst set 23.0 %). The P1 gate is ≤ 30 %.
  - The vector is the five kind severities.
  - The JND is calibrated by the render mode: the metric's noise floor divided by its slope
    per unit of severity. The results were 雪 0.020, 影 0.012, 裂 2.99, 霞 0.0004, 伸 0.0045.
  - Each JND is floored at 0.1 of the range, because a JND the instrument can see is finer
    than one a viewer can.
  - 裂's JND of 2.99 means the per-frame tear metric cannot tell severities apart: the tears
    are texture-driven events. So tear severity counts as never distinguishing, which is
    conservative.
  - The vector ignores style, ghost count, streak length, dropout kinds and breath, so real
    variety is larger than this rate says.
- **Can it fail?** 今 drawn 200 times reads 100 % seen-before.

### §6.3.3 + §11.2 Legibility and surfacing: GREEN

- **Fixture:** 即常切 (an 8 s plain hold with 4 dropouts).
- **Reels:** john-cage-interview, bbc1-testcard-news-1979, ddr1-aktuelle-kamera-1986.
- **Receptions:** 16 per reel, each a different character (seeds 101.37…, 201.37…, 301.37…).
  That makes 48, and **rc.91 runs on the same fixtures and seeds** by interception (critic
  P0 item 1).
- **Scoring:** each side is scored against **its own pipeline's clean render**. The base shim
  gained a `window.__zkClean` switch, which zeroes rc.91's snow, ghost and tear.

| | tree | rc.91 |
|---|---|---|
| median of per-reception median hold SSIM (registered) | **0.7420** | 0.7069 |
| the same, unregistered | 0.7199 | 0.7069 |
| receptions below the buried line (0.2) | **0/48** | — |
| receptions that surface (≥ 0.6 s at SSIM ≥ 0.4 in every 5 s window) | **48/48**, worst window 1.10 s | 48/48, worst 1.60 s |
| 遠 and 嵐 forced at sev 1, 12 each | **24/24 surface**, worst window 1.00 s, medians 0.27–0.90 | — |

- **Per-archetype medians:** 遠 0.71 (0.22–0.87), 混 0.76, 反 0.77, 電 0.78, 同 0.74
  (0.47–0.88), 嵐 0.58, 清 0.95.
- **The lines (critic P0 item 3).** Buried is 0.2 and surfacing is 0.4. rc.91 passes both on
  the same fixtures: its dropout dips reach about 0.23, and its worst window has 1.6 s surfaced.
- **断 holes are excluded** from the surfacing windows. A hole is a planned loss of the
  carrier, and the audio goes with it.
- **REGISTERED SSIM (decision 6).** Before SSIM, the clean is aligned to the frame by the best
  cyclic vertical shift (the roll wraps) and a global horizontal shift of up to ±12 px. Per-line
  offsets are not registered away. Both numbers are reported, and the per-frame score is
  max(raw, registered).
- **The instrument is repeatable.** Two runs (`--n 4`, 24 traces) were bit-identical, trace
  for trace.

### §6.3.4 Performance: GREEN

Step cost, meaning tick + five passes + crack + glow, in ms:

| | mean | p95 | p99 | worst |
|---|---|---|---|---|
| tree, dpr 1, drawn | 1.41 | 3.4 | 4.1 | 7.5 |
| rc.91, dpr 1, same receptions | 1.10 | 2.7 | 3.6 | 6.6 |
| tree, dpr 2 | 1.82 | 4.1 | 6.1 | 13.8 |
| rc.91, dpr 2 | 1.44 | 3.1 | 5.6 | 24.5 |
| per archetype, dpr 1 | 1.17 (清) – 1.51 (反) | | 3.8–4.4 | |

- **Mean ≤ 2.5 ms: passes.**
- **The tail gate is not the plan's number.** The plan's "≤ 6 ms worst" is a laptop figure. On
  this machine rc.91 itself misses it (p99 5.6, worst 24.5 at dpr 2). The tail gate is
  therefore p99 ≤ 6 ms **or** ≤ 1.1 × rc.91's p99 in the same run. At dpr 2 the tree's 6.1
  passes that against rc.91's 5.6.
- **The added cost is the glow:** one downscaled read of the tube per frame, then three
  operations at CSS size. The first version read the full-resolution tube three times and ran
  2.1 ms at dpr 2.
- **Low-power:** the step is the same; it runs at half rate.

### 光 The crack's light (the owner's pick): GREEN, and the critic's check is built in

`_picture-probe.js crack`:

- **a. The glow layer against the picture it is lifted from**, over 920 frames: 20 s of idle
  (test card and Paik's line included), a reception on bbc1 and the dead tube after it.
  - Where the picture under the crack is dark (G ≤ 30/255), the glow is **0 in every channel**
    on all **569** such frames. That includes 488/600 idle frames and every dead frame that
    no longer holds the burst's afterglow.
  - The glow never exceeds the cube of its source (×1.03 + 4 for 8-bit rounding): 0 frames over.
  - A bright picture lights the break on 150/150 hold frames, max G 255.
  - The remaining idle frames carry light that is really on the tube: the test card, Paik's
    line and its afterglow. The break carries that light, by design.
- **b. The idle canvas, all four patterns.** The crack's green excess (G − max(R,B)) is 8.17 /
  7.33 / 6.97 / 5.77, against 8.12 / 8.09 / 7.74 / 6.33 beside it: no green above the tube's
  own. **Sensitivity:** rc.91's constant stroke, put back with `_dev.setGlow("rc91")`, is
  **caught**: 9.07 on the crack against 5.92 beside it.
- **c. The SVG alone** (canvas, scanlines and glass hidden, the tube black), all four patterns:
  crack excess mean −0.07 to −0.10, **max 0**. **Sensitivity:** mockup C's original
  green-white (235,250,240), put back with `_dev.crackColors`, is **caught** (max 5).
- **Pictures:** `P1-crack-idle-A.png`, `P1-crack-idle-A-rc91-stroke.png`,
  `P1-crack-lit-A-john-cage-interview.png`, `P1-crack-lit-D-bbc1-…png` and
  `P1-crack-svg-alone-A.png`.

### The phase machine: GREEN

`phases` counts the frames each phase gets, for all four fixture shapes, tree against rc.91:

- 即常切, 探戻残 and 即走切 are **identical to rc.91**.
- 浮断絶 differs only by the 断 fix: loss **84 → 9 frames** (the plan's exit is 0.3 s = 9),
  and hold gains exactly the 75 frames that loss lost.

So the receiver's timings do not move (§2.3).

### Music identity: NOT CHECKED, by the owner's ruling (2026-09-24)

`git diff 2baf87e -- art/zankyo/zk-broadcast.js art/zankyo/zankyo-audio.js` is empty.
Everything the picture draws is on `set:rx:*` forks of the set's own master stream, or on
texture.

## What changed, and why

1. **The character** (`zk-picture.js` `drawCharacter`). It draws, in this fixed order:
   - the archetype (§4.1 weights) and the severity (`SEV`: 0.28 + 0.62·u^1.1);
   - the tier (uncommon 1/6, which brings a full-strength secondary);
   - the primaries and one light secondary;
   - **every kind's axes, whether or not the kind is on**, so a forced archetype consumes the
     fork exactly as a drawn one does;
   - the breath (1–3 partials, drawn rates and depths);
   - one envelope per kind (two slow partials, plus bursts for 電's sparks and a flutter swell
     for ghosts, with an onset);
   - 16 dropout kinds, indexed by the dropout's place in the plan;
   - the lull.

   The archetypes whose true primaries are P2 kinds (混 縞/混, 電 点/帯, 同 横/旗/捩, 過 飽)
   draw the P1 kinds that share their cause. Each stand-in is commented where it is defined.
   P2 swaps in the real primaries.
2. **The per-piece character.** 戻/走 piece *n* ≥ 1 redraws on `set:rx:<seed>:<n>` at its
   relock (§4.2, §5.2).
3. **The surfacing lull (§11.2).** Only heavy receptions get one: 遠, 嵐, or any kind above
   0.55. That last condition matters because an uncommon reception's full-strength secondary
   snow is heavy. Light receptions stay legible throughout without it, and a lull on them made
   every tube pulse alike.
   - Timing: every T ∈ [3.2, 4.4] s, flat for F ∈ [0.8, 1.2] s. Any 5 s window therefore
     contains a flat ≥ 0.6 s (T − F + 1.2 ≤ 5).
   - Effect: the carrier lifts to 0.85, and every impairment eases by 0.70–0.88.
   - Dropouts, roll kicks and lock loss are eased by 0.8 × the lull. Without that, a roll kick
     inside the lull killed the surfacing.
4. **The pipeline.** Ghosts and the offset map moved to source resolution, as §5.1 intended and
   P0's recommendation asked:
   - luma → echoes (in the signal, before the noise, so the snow has no ghost) → drive → 霞 →
     雪 → a row copy with the line-accurate map → LUT → **one** raster draw;
   - rc.91's second, independent tear for the rolled copy is gone. One map (P0 item 4);
   - a displaced line shows the 14 px horizontal blanking, then wraps.
5. **Snow.** A streak's tail only ever adds light. The first version darkened bright areas with
   the streak's decaying tail, which read as black dashes. Dark specks are l × 0.3, not black.
   清 keeps the faintest snow and no specks.
6. **Why the SSIM is registered.** A roll dropout moves the whole frame by 10–30 tube px for
   about a second. Plain SSIM scores that as buried, but a legible picture that has slipped is
   not buried. Without registration, the worst-case 遠 failed surfacing *inside* its lulls,
   purely because of the roll (traced frame by frame).
7. **The crack.**
   - The SVG is option C, ported with the mockup's own wander and run seeds.
   - The shards' edges take the wandered interior points, so the canvas slices, the glow's mask
     and the SVG line up.
   - The room's light on the glass is **neutral**: `GLASS_LIT` 236,240,242, `GLASS_FROST`
     226,230,232, `GLASS_RIM` 128,132,134, with G never above B. C's strokes were a faint
     green-white, and the owner's rule is no green on a dark tube.
   - The chip's two rim strokes went neutral too. Its fill is unchanged.
   - The glow is the composed picture **cubed**, not squared. Squared, the idle raster's warm
     glow (about 18/255 at its brightest) survives as 1–2 levels. Cubed, anything under about
     16/255 rounds to zero. It is masked to the wandered cracks (a 3.2 px body at 0.45 and a
     1.1 px core), then added with `lighter` at k = 0.65.
   - The first try used k = 0.9, which read as a drawn lime line over bright areas.
8. **The declared visible fixes:**
   - the 断 `holeS` tail (P0 open item 1);
   - relock reading its own piece's `lockS` (identical today, because both are 0.2);
   - faint sweep snow on a dead tube (§11.5, alpha ≤ 0.4, only while a hand is on the dial).
9. **Dev hooks.**
   - `force` persists until `force(null)`, and the comment now says so (critic P0 item 5).
   - `force` now takes `{archetype, sev}`, `{impairment, sev}`, `{archetype:"今"}` and
     `{clean:true}`. P2 kinds are refused by name ("arrives in P2").
   - New: `_dev.glow()`, `setGlow(true|false|"rc91")`, `crackColors()` and `buffers().mask`.
10. **The lab.**
    - New "archetypes 4×2" button, at a chosen severity, with a seed per tile. With one seed,
      every archetype shares envelope and lull timing, so every tile catches the same lull.
    - The character line.
    - A refused force now stays on screen. Before, `show()` overwrote the message.
    - Smoke-tested headless with no errors. The production page (`index.php?seed=3042`, not
      frozen, `_dev.tune`) also raised no errors.

## Sheets (`handoff/picture-sheets/`)

- `P1-drawn-<reel>.jpg`: 12 drawn receptions per reel, 3 s into the hold. Compare with
  `P0-today-12-receptions.jpg`.
- `P1-archetypes.jpg`: the eight archetypes at sev 0.65. 遠 grain and fog, 反 echoes,
  同 torn lines, 過 hot and crushed, 嵐 buried.
- `P1-strip-far-遠.png`, `P1-strip-multipath-反.png`, `P1-strip-sync-同-modori.png`: 12
  moments of one reception each. 遠 shows heavy grain with clean surfacings, 反 shows the face
  doubled by a right echo, 同 shows tears and a lock-loss shear after the relock.
- The crack PNGs listed above.

## Open items

1. **The lull reads as a clearing, not a partial lift.** On 遠 the surfacing frames look almost
   clean (see the 遠 strip, tiles 2, 6 and 9). The owner asked for a face "rising out of the
   noise for a moment", and this may be too clean a rise. `LULL.lift` / `LULL.depth` are the
   knobs, but lowering them costs surfacing margin: the worst window is 1.00 s against 0.6.
2. **The critic should look at 伸.** Its does-it-render passes (1.17 % scale at median), but on
   a paused reel its only motion is with the snow and dropout level. It is hard to see in a
   still sheet.
3. **The median is more legible than rc.91** (0.742 against 0.707). The gate allows that, and
   the P2 kinds will spend the margin. If the owner wants more damage now, `SEV.lo` is the knob.
4. **Carried from P0 (not mine):** `zk-broadcast.js:664` logs the "29 TUNED reel(s)" console
   error on every load. QF's zero-errors gate will trip on it.
5. **WebKit was not run** (no headless WebKit). The no-filter bloom path was not re-run in P1.
   The glow uses only `drawImage` composite operations (`copy`, `multiply`, `destination-in`,
   `lighter`), all of which Safari has.
6. **The per-frame tear metric cannot rank tear severity** (JND 2.99). A tear-rate metric
   (events per second) would; it is worth adding in P2, alongside 横/旗/揺.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php                     # if :8141 is down
node art/zankyo/_picture-probe.js p1 --out <dir>      # render, draws, legibility, perfp1, crack, phases (~10 min at load 30)
node art/zankyo/_picture-probe.js sheets --out <dir>  # contact sheets and the lit-crack screenshots
# single modes: render | draws (node only; reads <dir>/render.json for the JND) | legibility [--n 16] | perfp1 | crack | phases
```

`identity` is P0's gate and now fails by design, because the look moved. `repeat` still runs.
