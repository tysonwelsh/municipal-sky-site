# P2 — coder's handoff, round 1

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`,
served on **:8141** (`php -S 127.0.0.1:8141 router.php` from the worktree root). I used the
server that was already running and did not start or stop any.

| commit | what | VERSION |
|---|---|---|
| `f3ffc80` | P2: the ten new kinds, the archetypes on their real primaries, streaked dark specks, the lull's P2 targets and the refitted burial weights, the probe's P2 gates | `2.1.0-rc.P3 — ten new ways a picture comes in damaged: ignition sparks in bursts, drifting herringbone stripes, rolling hum bars, a second station faintly underneath behind venetian blinds, the picture shearing into diagonal bars and relocking, a hooked top, shivering lines, wavy verticals, smeared ringing edges, and an overloaded set that blooms, pumps and now and then flashes negative; the black specks in weak snow now streak like the white ones` |
| (this file) | the handoff, and the sheets in `handoff/picture-sheets/P2-*` | dev-only |

**Files touched:** `zk-picture.js`, `zk-set.js`, `_picture-probe.js`, `picture-lab.php` (text
only: the header comment, the subtitle and the force placeholder), and `VERSION`.

**Not touched:**
- `git diff 2baf87e` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and `pj2-*.js`
  is empty.
- `index.php` still differs only by P0's script tag.

**Music identity:** not checked, by the owner's ruling (2026-09-24).

**The owner's §11 rules:**
- No VFD or label text changed, so the VFD still names nothing.
- No colour path changed: everything new is luma before the P39 LUT, so the tint is always
  green.
- Every reception still surfaces (below).

All numbers are from `node art/zankyo/_picture-probe.js p2` on `f3ffc80`'s tree, at load
average 29–37. The run printed **GATE GREEN, exit 0**. The sensitivity run and the
calibration runs are named where they are used.

---

## The ten kinds: cause, motion, and where each sits

Each kind is a pure function in `zk-picture.js`, over the 192×144 buffers or the per-line
offset map. There is no RGB and no block (§2.1). All of them run only while there is a
carrier (the set's `CARRIER_PH`). In the hold each follows its own envelope; outside the hold
it runs at its drawn level (P3 owns entries and exits).

| kind | physical cause | how it moves | where in the frame |
|---|---|---|---|
| 点 impulse | ignition and switch arcs | **Bursts** on a hashed episode schedule (a car passing): each rises and dies away as sin^½. 39 % of 点 receptions are **pulsed** instead: an idling engine puts K sparks a field on heights that crawl slowly. Each spark is one line tall and 6–40 px long, with a 3 px dark tail (the IF's ring). | after the snow |
| 縞 herringbone | a co-channel carrier's beat | Fine diagonal stripes, pitch 2.6–6.5 px, drifting at the beat. 60 % have a zig-zag (the sound carrier's FM); 60 % wander slowly in angle. | after 飽, before the snow (added at RF) |
| 帯 hum bars | mains ripple | One or two raised-cosine bars, 72 % darkening, rolling at a **constant** 0.04–0.35 cycles/s. The speed is drawn per character for now; P4 locks it to the LFO. | last, as a per-row gain and offset |
| 混 crosstalk | a second station on the channel | The other picture (§5.4) at depth 0.1–0.29, on its own unlocked sync: it slides and rolls slowly, and its own H and V blanking show as dark bars. Venetian-blind stripes drift over it. | in the signal, after the echoes |
| 横 horizontal skew | H-sync lost | Episodes: the lines shear into 0.8–3 diagonal bars, whole lines with their blanking, that slide. Then the AFC pulls in: the shear and the phase die to the nearest whole line, the shear swinging at 2–6 Hz. | offset map |
| 旗 flagging | a timebase error after V-sync | The top 12–30 rows hook sideways, (1 − y/rows)^1.6–3, fluttering at 0.5–5 Hz. The hook rides with the field top when the picture rolls. | offset map |
| 揺 line jitter | noisy sync | Every line is offset by Gaussian noise each frame (texture), with neighbouring lines correlated 0–0.85. | offset map |
| 捩 wavy verticals | hum on the sync, or the AFC hunting | A slow S-curve down the frame (0.5–1.6 frame heights, a touch of 2nd harmonic), crawling at 0.05–0.5 cycles/s. | offset map |
| 滲 smear and ringing | narrow IF bandwidth, mistuning | A two-pole resonant low-pass along each line, unity at DC and causal, so edges drag **right** and ring (period 3–8 px, pole radius 0.45–0.86). It has no envelope: the bandwidth belongs to the tuner. | in the signal, after 混 |
| 飽 AGC and overload | a station too strong | Gain `hot` 1.15–1.66 into a soft shoulder and the clip; blacks crushed by `blk`. The AGC follows the picture's level with a lag of 0.15–1.2 s, so it **blooms when a station or scene arrives** and settles. It pumps at 0.2–1.2 Hz; P4 locks this to the LFO. On 5.0 % of all receptions, the sync crushes into a **negative picture** for 60–200 ms at 0.04–0.25/s, and the line oscillator takes one impulse. | the drive, after 霞 |

**The frame memory (§5.4, `zk-set.js`).**
- Every tenth hold frame of a reel keeps the clean source luma.
- When the next reception arrives, that becomes the memory.
- 69 % of 混 receptions draw it. The rest, and any reception with no memory yet (the night's
  first), get the test card, rendered once into its own canvas.
- There is no new media element and no new bytes.

**Also done:**
- **Dark specks streak** (critic P1 r1/r2 recommendation, owned by P2). A dark speck now runs
  on for ~streak px, its darkening decaying like a spark's light. It starts at ×0.4, not ×0.3,
  with a tail of 0.72 per px: at ×0.3 with a 0.82 tail, they read as black marks on ddr1's white
  paper.
- **The remaining square dark dots are not dark specks.** They are rc.91's dim sparks: `l·keep
  + spark` darkens a bright pixel when the spark is dim. That is rc.91's look, which P1
  accepted, so I left it (open item 1).

**The archetypes (§4.1) now draw their real primaries.** The P1 stand-ins are gone.

| archetype | primaries | secondary pool |
|---|---|---|
| 遠 | 雪 霞 | 点 揺 滲 |
| 反 | 影 | 滲 裂 |
| 混 | **one or two** of 縞 混 | 帯 雪 |
| 電 | 点 帯 | 裂 揺 |
| 同 | **one or two** of 横 旗 捩 | 揺 裂 |
| 過 | 飽 | 伸 影 |
| 清 | none | at most one light secondary from 影 伸 滲 |
| 嵐 | each of its two archetypes' primaries, under the same pick rule | — |

- `pickPrims` gives every primary one ordering draw, so the fork's consumption depends only on
  the archetype.
- The P2 axes are all drawn, on or off, in a fixed order after the P1 axes.
- 霞's "hot" corner (P1's stand-in for overload) is removed; 飽 owns it.

**Per reception**, over 20,000 draws:

| kinds | share |
|---|---|
| 0 | 2.7 % |
| 1 | 18.8 % |
| 2 | 43.9 % |
| 3 | 33.6 % |
| 4 | 1.0 % |

**Each P2 kind's incidence:**

| 点 | 縞 | 帯 | 混 | 横 | 旗 | 揺 | 捩 | 滲 | 飽 |
|---|---|---|---|---|---|---|---|---|---|
| 19.6 % | 10.3 % | 18.5 % | 10.5 % | 8.3 % | 8.4 % | 13.1 % | 8.2 % | 11.4 % | 10.2 % |

---

## The gates (`p2` on `f3ffc80`): GREEN

### §6.3.2 Every kind renders, and fails by name if it does not: GREEN

- **The method.** Each kind is forced **alone** at median axes on the plain hold (john-cage
  @20 s, 6 s), with 3 texture seeds and every 3rd frame. The floor is 3 × max(the clean's
  spread, P0's unseeded spread).
- **Coverage.** `KIND_METRIC` now names all fifteen kinds. A kind with no metric, or a metric
  with no function, fails the mode.

| kind | metric (its own) | clean | sev 0.5 (min of 3) | sev 1 | floor |
|---|---|---|---|---|---|
| 点 | `dashes`: thin bright runs ≥ 6 px a frame | 0 | 0.58 | 1.00 | 0.0003 |
| 縞 | `stripe`: the largest diagonal 2-D DFT amplitude, pitch ≤ 10 px (levels) | 0.011 | 5.73 | 8.33 | 0.067 |
| 帯 | `humPeak`: row-mean DFT, bins 1–6 | 0.009 | 8.70 | 11.23 | 0.052 |
| 混 | `xtalk`: the other picture's regression amplitude in the residual | 0.0001 | 0.208 | 0.302 | 0.0007 |
| 横 | `lineVar` | 0.004 | 27.24 | 68.91 | 0.074 |
| 旗 | `flagTop`: top 12 rows' mean \|shift\| − the body's | −0.005 | 3.47 | 4.63 | 0.032 |
| 揺 | `jitterHF`: RMS second difference of the row-shift profile | 0.004 | 0.743 | 0.945 | 0.021 |
| 捩 | `waveLF`: std of the profile's 15-row moving average | 0.007 | 1.44 | 2.02 | 0.046 |
| 滲 | `smearTail`: Σ\|h_k\|, k ≥ 1, of a fitted horizontal FIR | 0.272 | 1.025 | 1.271 | 0.012 |
| 飽 | `clip`: share ≥ 250, over the clean's | 0 | 0.150 | 0.239 | 0.0003 |
| 飽·neg (`negRate` 3) | `negShare`: frames anti-correlated with the clean | 0 | 0.300 / 0.367 / 0.300 | — | 0.0003 |

- **The P1 kinds are unchanged.** For example 雪 moved 20.60 against a floor of 3.48, and 影
  moved 0.1047 against 0.0015.
- **The cross-talk table** is in the log. It is reported, not gated. Notable entries:
  - 飽 moves `lineVar` to 11.4: clipped areas lose the texture that the shift search needs;
  - 影 moves `dashes` to 5.2: an echo's edges;
  - 帯 moves `lineVar` to 2.3.
- **Sensitivity** (`render --kinds <the ten> --kill <the ten>`, which nulls each kind's axes so
  that it is "on" but draws nothing): **all 10 kinds and 飽·neg fail by name**, 11/11, GATE
  RED. Every killed metric reads within its clean floor. For example 点 0/0, 縞 0.0036 against
  0.0114, and 飽·neg 0/0/0.

### §6.3.1 The draw: GREEN

- **Archetype shares** are within −2.9 % to +3.5 % of §4.1. They are identical to P1's,
  because the archetype is still the first draw. The uncommon tier is 0.1666.
- **Distinct archetype·kind combinations:** 104 (P1: 30).
- **Seen-before: 9.03 %** (worst set 12.2 %), against the P2 gate of ≤ 20 %.
  - The vector is now **all fifteen severities**, as the critic advised.
  - The JND comes from this run's render.json, floored at 0.1: 混 0.1495, 裂 2.99, all others
    0.1.
  - For the record, the same rate on P1's five-kind vector would read 63.5 %: 混, 電, 同 and 過
    now carry no P1 kinds, so on that vector they all look alike. The widening is the
    measurement, not a way around it.
  - 今 drawn 200 times still reads 100 %, so the check can fail.

### §6.3.3 + §11.2 Legibility and surfacing: GREEN

| | P2 (`f3ffc80`) | rc.P2 (P1 r2) | rc.91 |
|---|---|---|---|
| median of per-reception median hold SSIM, registered | **0.7479** | 0.7194 | 0.7069 |
| the same, unregistered | 0.7261 | 0.6972 | 0.7069 |
| below the buried line (0.2) | 0/48 | 0/48 | — |
| drawn receptions that surface | **48/48**, worst window **0.70 s** | 48/48, 1.20 s | 48/48, 1.60 s |
| 遠 and 嵐 at sev 1 | **24/24**, worst window 0.90 s | 24/24, 1.00 s | — |

- **By archetype**, median (range):

  | 遠 | 混 | 反 | 電 | 同 | 嵐 | 清 |
  |---|---|---|---|---|---|---|
  | 0.571 (0.388–0.790) | 0.714 | 0.748 | 0.880 | 0.789 | 0.632 | 0.934 |

- **The median rose.** The new 電 (点 and 帯) is far more legible than P1's stand-in, which was
  spark-corner snow plus 裂. 同 (skew episodes between clean spells) holds about level.
- **Unregistered also passes now:** 0.7261 against 0.7069. It failed at P1 r2.
- **Two margins are thinner, and the new streaked dark specks cause both:**
  - 遠's own median fell from 0.636 to 0.571;
  - the worst surfacing window of the 48 fell from 1.20 s to 0.70 s, against a line of 0.6 s.

### The lull (§11.2): GREEN, and its rule refitted

- **As built**, 遠 and 嵐 at sev 1: 24/24 surface, worst window 0.90 s.
- **A surfacing, not a clearing.** The near-clean share (SSIM ≥ 0.7) has a median of **0.01**
  (P1 r2: 0.07) and a max of 0.56.
- **Lull off (sensitivity):** 13/24 surface. The gate is live.
- **Irregular.** The gap CV has a median of 0.734 and a p5 of 0.379, with 7–13 lulls per 30 s.
  The worst 5 s window holds 0.70 s of flat. rc.P1's metronome reads a CV of 0: caught.
- **The new kinds ease to targets** in a lull, as P1's do (`LULL`):

  | 点 | 縞 | 帯 | 混 | 旗 | 揺 | 捩 | 飽 |
  |---|---|---|---|---|---|---|---|
  | iT 0.8 sparks/frame | hbT 4 levels | humT 0.08 | xtT 0.07 | flagT 2.5 px | jitT 0.5 px | waveT 1 px | agT 0.15 of excess gain |

  - 横 is knocked down by `dropEase` like a dropout. Both its shear and its slide are scaled,
    so a lull never makes the picture slide sideways.
  - 滲 does not ease.
  - A negative flash never fires inside a lull.
- **Who gets a lull: `ZP.BURY2`, fitted.**
  - **The data:** `lullcal --archs 遠,嵐,混,電,同,過` (seeds from 1001), 192 lull-OFF receptions.
  - **Only 5 failed to surface**, and 3 more had a worst window under 0.8 s. P1's terms covered
    all but one: 嵐 at sev 1, drawn as 捩 + 飽 (hot 1.57, crush 17). It is an overexposed,
    rippling picture with a median SSIM of 0.30, and it scored 0.08 on P1's terms.
  - **The fit:** `lullfit` (greedy, P1's terms and BURY_LINE held) gives 飽 weight **1** and
    滲 **0.05**; every other P2 weight is 0.
  - **What the rest needed:** 同 0/32, 混 0/27 and 電 0/23 needed a lull. Those kinds leave a
    picture that surfaces on its own.
  - **Incidence is 19.5 %** (P1: 31.6 %). By archetype: 嵐 54 %, 遠 39 %, 反 32 %, 過 29 %,
    and 0 % for 電, 同, 混 and 清.
- **Caveat.** This fit rests on one reception, the 飽 one, and the rule was not re-validated on
  fresh seeds this round (P1 r2 did that with `lullcal --built --seed0 2001`). The legibility
  gate's 48 receptions and the lull mode's 24 all surface under it. The critic may want the
  fresh-seed run: `lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過`.

### §6.3.4 Performance: GREEN

| | mean | p95 | p99 | worst |
|---|---|---|---|---|
| tree, drawn, dpr 1 | **1.468** | 2.8 | 3.9 | 9.1 |
| rc.91, same receptions | 1.249 | 2.4 | 4.2 | 9.6 |
| tree, dpr 2 | **1.700** | 3.4 | 5.0 | 13.8 |
| rc.91, dpr 2 | 1.383 | 2.7 | 5.3 | 23.7 |
| per archetype, dpr 1 | 1.32 (清) – 1.65 (遠) | | 3.5–4.7 | |

- Both gates pass: the mean is ≤ 2.5 ms, and the p99 is ≤ 6 ms or ≤ 1.1 × rc.91's in the same
  run.
- An earlier run at load 27–31 read 1.48 / 1.69, and 2.00 for 遠 measured first on a fresh page.
- The dpr-2 mean costs **+23 %** over rc.91 (P1 r2's critic run: +34 %).
- **Why it is cheap:**
  - every new pass is at 192×144;
  - an off kind costs one test per pixel;
  - 混 walks its offsets incrementally, with no modulo per pixel;
  - 縞 reads a 1024-entry sine table;
  - 帯 is per row.
- Nothing new runs in the full-resolution composite. The low-power path is the same step at
  half rate.

### Crack and phases: GREEN, unchanged

- **crack:** all checks green, with their sensitivities caught. The glow is 0 in every channel
  on 568 dark frames, 0 of 920 frames are over the cube, and the worst hairline run ratio is
  0.030.
- **phases:** 即常切, 探戻残 and 即走切 are identical to rc.91. 浮断絶 differs only by P1's 断 fix
  (loss 84 → 9).

---

## Sheets (`handoff/picture-sheets/`)

- `P2-kinds.jpg`: each P2 kind alone at sev 0.8, three moments of a 6 s hold (0.6, 1.0 and
  3.4 s, chosen to fall inside 点's bursts), with the clean reference first.
- `P2-archetypes.jpg`: the eight archetypes at sev 0.65.
  - 混 is herringbone.
  - 電 is sparks.
  - 同 is the hooked top and the ripple.
  - 過 is crushed hot whites.
  - 嵐 is buried in grain.
- `P2-drawn-{john-cage,bbc1,ddr1}.jpg`: 12 drawn receptions each, 3 s into the hold. On ddr1,
  seed 211.37 is a 混 with the MSHI card sliding behind blinds.
- `P2-strip-sync-同.jpg`: 同 at sev 0.9 on ddr1, a tile every 0.33 s of an 8 s hold. 横 loses
  lock at about 1.3, 3.9 and 7.9 s, shears into bars and relocks. Between the losses the top
  hooks and the verticals ripple.

## Decisions I made (the owner was not available)

1. **Each P2 kind is measured by a metric of its own** (table above), not by one shared "line
   variance". The geometry kinds each read a different signature of the same row-shift profile:
   the top, the roughness and the slow part. Cross-talk is reported, not gated.
2. **混's render check uses the test card as the other picture**, and the metric is held against
   the picture the set actually placed that frame (`_dev.buffers().xt`). In production 69 % of
   混 receptions use the memory.
3. **飽's negative flash is a feature with its own check** (`negRate` forced to 3). At median
   axes it is off. It occurs on 5.0 % of drawn receptions, close to §4.3's "rare: a
   negative-flash overload", about 1 in 25.
4. **同 and 混 pick one or two of their primaries.** Otherwise every bad-sync night would carry
   the same three faults.
5. **The P2 kinds run in every carrier phase, at their drawn level outside the hold.** Only in
   the hold do they follow envelopes and the lull. P3 designs the entries and exits.
6. **Seen-before is gated on the fifteen-severity vector**, and the five-kind figure is printed
   for the record.
7. **The dim-spark dark dots (rc.91's formula) are left alone** (see open item 1).

## Open items

1. **Square dark dots are still visible on bright areas** (ddr1's paper). They are rc.91's dim
   sparks (`l·keep + spark` < l), not dark specks. Making a spark's first pixel only ever add
   light would remove them, but it would change rc.91's snow on every bright picture. The critic
   or owner should decide.
2. **The surfacing margin is thinner:** the worst window of the 48 drawn is 0.70 s, against the
   0.6 s line, and 遠's median is 0.571. If the critic wants margin back, soften the streaked
   dark specks further (`dv`/`dark`), or lower the snow-bound 遠's `pT`.
3. **SSIM reads a hot (飽) or hum-darkened picture as less legible**, because of its luminance
   and contrast terms (critic P1 r2 recommendation 2, not taken). BURY2 now hands 飽 lulls
   because of it.
   - The structure-only SSIM term is still the better instrument.
   - Taking it would re-base every legibility number, so I left it for a round that can
     re-baseline rc.91 too.
4. **The BURY2 fit rests on one reception** (see the lull caveat), and was not re-run on fresh
   seeds this round.
5. **帯's roll and 飽's pump are drawn from the character.** P4 locks them to the audio's LFO
   (§5.3). The descriptor fields need `zk-broadcast.js`, which is not ours.
6. **The frame memory only records reels** (`sig.video`). A bench reception on the test card
   leaves the memory as it was.
7. **Carried:**
   - the force hook's "consume the fork alike" comment;
   - `lullSchedule`'s 4,000-lull cap (the P2 episode schedules share the same cap and are
     equally harmless);
   - `tools/picture-crack-ab.js` desyncs under load;
   - WebKit is unrun (QF's);
   - `zk-broadcast.js`'s "29 TUNED reel(s)" `console.error` belongs to the audio crew.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php                                   # if :8141 is down
node art/zankyo/_picture-probe.js p2 --out <dir>                     # the whole battery, ~60 min at load 30: GREEN
node art/zankyo/_picture-probe.js render --kinds 点,縞,帯,混,横,旗,揺,捩,滲,飽 --kill 点,縞,帯,混,横,旗,揺,捩,滲,飽 --out <dir>   # sensitivity: must be RED, 11 by name
node art/zankyo/_picture-probe.js kinds --ats 0.6,1.0,3.4 --out <dir>          # P2-kinds.jpg
node art/zankyo/_picture-probe.js sheets --phase P2 --out <dir>
node art/zankyo/_picture-probe.js lullcal --archs 遠,嵐,混,電,同,過 --out <dir>   # lull-off data (~15 min)
node art/zankyo/_picture-probe.js lullfit --from <dir>/lullcal.json --out <dir>   # node only: prints BURY2
node art/zankyo/_picture-probe.js strip --force '{"archetype":"同","sev":0.9}' --reel 2 --seed 505.37 --hold 8 --every 0.33 --name s --out <dir>
```
