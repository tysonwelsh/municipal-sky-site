# P2 — critic, round 2: SIGNED OFF

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the picture at `7f99524` (rc.P4) and the handoff and strips at `a535a48`. I did not
write this code. Every number below comes from my own runs on :8141 (`router.php`, this
worktree; I started no server and stopped none).

**Verdict: P2 passes. The last green commit is `7f99524`** (`2.1.0-rc.P4`). Critic r1's one
required item is met. The full `p2` battery, which critic r1 could not finish at load 70–95,
ran to the end and is **GATE GREEN in 7 min 01 s**. The kill run is RED with all 11 names. A
third fresh seed set that nobody has fitted on or looked at (5001) surfaces **192/192**.

This file and two critic strips are dev-only. They need no bump.

**Load.** 4.6 when I started. It was 6–12 through `p2`, and **perf ran at 9 / 14 / 23**
(`os.loadavg`, from the probe), so the perf numbers are the quietest any P2 round has had.

**Standing checks:**
- Music identity was not checked, by the owner's ruling (2026-09-24).
- `git diff 2baf87e HEAD` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/` is empty. `index.php` differs only by P0's script tag and the
  `$zk_assets` entry.
- Since critic r1 (`a4731ff..HEAD`), the only code touched is `zk-picture.js`:
  - `snowP()` is factored out of `burial()`, and the result is unchanged;
  - the `burial2` herringbone term;
  - `BURY2` and its comment.
  `_picture-probe.js` changed in `lullfit` only.
- Nothing in the render path changed, and no colour, text or VFD line changed. So the tint is
  still always the P39 ramp's green (§11.1), and the VFD still names nothing (§11.3).

## Required item 1 (r1): every reception surfaces on fresh seeds. MET.

### The fit reproduces
`lullfit --from <p2/cal1 (1001, lull off)>,<p2r2/off3001> --exempt '1:ddr1…·3230.37,1:嵐·cal·5'`
is node only, run on the coder's own data files:
- `BURY2 = {herr 1, skew 0.2, jit 0.2, smear 0.05, agc 1}`;
- incidence 21.0 %;
- by archetype: 嵐 57 %, 遠 43 %, 反 32 %, 過 29 %, 混 5 %, 電 / 同 / 清 0 %;
- the exempt pair scores 0.174 / 0.203, against BURY_LINE 0.856.

This matches the handoff and the committed constants exactly.

### The term is aimed where it should be (my node check, 20,000 drawn)

| 縞 receptions (n 2,065) | n | lulled |
|---|---|---|
| on a clean carrier (snowP < 0.05) | 1,765 | **2.6 %** |
| on snow (snowP ≥ 0.05) | 300 | **53.3 %** |
| all, with `herr` 0 (r1) | 2,065 | 76 (3.7 %) |
| all, with `herr` 1 (r2) | 2,065 | 206 (10.0 %) |

- Only 混 and 嵐 draw 縞. Lulled 縞 receptions are 120 of 2,444 混 (4.9 %) and 86 of 1,023 嵐.
- The physics is right. A co-channel beat on a strong wanted carrier leaves the face readable.
  On a weak one, the snow and the beat stack. A lull, a good moment of the fading, eases the
  beat because the wanted/unwanted ratio improves. So the lull easing the stripes toward `hbT`
  is honest.

### (a) Seeds 3001, as built: reproduced
`lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過`:
- **190/192 surface**, lulled 49/192, median-of-median 0.7234;
- john-cage·3025.37: med 0.462, worst window 1.3 s, lulled;
- the 2 misses are the exempt 嵐s (bury 0.1737 and 0.2031);
- the worst passing window is 0.6 s (遠·cal·5, lulled, on the line and unchanged since r1);
- 縞: 25/27 surface, the worst passing window is 1.3 s, 2 lulled;
- 混 lulled: 2/31.

This is identical to the coder's numbers.

**By eye**, on my own pair of strips (8 s hold, a tile every 0.33 s, texture 11):
`picture-sheets/P2-critic-r2-混-3025-lull-built.jpg` against
`P2-critic-r2-混-3025-lull-off.jpg`.
- **Lull off.** Nothing rises in the hold.
  - The carrier sits at 0.36–0.66 until the 7.2 s dropout.
  - Every tile is the face under a dense veil of snow plus stripes.
  - It sharpens only at 7.5–7.9 s, when the breath comes up to 0.76–0.79.
- **As built.** The face comes up three times: at 0.6–1.6 s, 2.9–3.9 s and 5.2–5.9 s (lull
  0.92–0.98).
  - In those windows the eyes, the brow and the collar read, and the background venetian
    blinds of 混 are plain.
  - Sparse snow and the stripes stay, so it is a surfacing, not a clearing (§11.2).
  - Between the lulls it sinks back (2.2, 2.6, 4.6 s), and the 7.2 s dropout is all snow as
    scheduled.
  - The lulls come at irregular spacing.
- **Why some between-lull tiles look snowier than the lull-off strip at the same time and
  carrier** (2.2 s, 0.55 in both):
  - **The cause: texture, not the lull.** In `zk-set.js`, every lull effect is multiplied by
    `L` or sits under `if (L > 0)`. The frames at L = 0 are the same function of the same
    inputs.
  - But the lull changes how many `rnd()` draws the snow consumes. That shifts the seeded
    texture stream: the snow's flicker, and the frame-hold that rides snow dropouts
    (`holdP`). The same would happen on `Math.random` in production.
  - The lull does not deepen the troughs. The median rises from 0.266 (off) to 0.462 (built).

**The two exempt 嵐s: I agree they are legible.** The coder's
`P2-r2-嵐-3230-ddr1.jpg` and `P2-r2-嵐cal5-ddr1.jpg` show:
- both faces and the "C. Sartzetakis" caption in 22/24 tiles each;
- the other 2 tiles in each are 横 shear episodes that relock within the hold.

This is critic r1's ruling (8×8 SSIM reads 2.6–6.5 px stripes as lost structure). The item
allowed a remaining miss if it is shown legible by eye in a strip and is not veiled for the
whole hold. Neither is veiled.

### (b) Seeds 4001, the coder's validation, and 5001, mine and fresh
- 4001: 192/192, worst window 1.0 s (the coder's, run once before any tuning; I did not re-run
  it).
- **5001: 192/192 surface**, worst window **1.0 s**, p5 1.3 s, lulled 54/192, median-of-median
  0.7053, no reception under 0.8 s.
  - 縞: 25/25 surface, worst window 1.3 s, 4 lulled.
  - 混 lulled: 0/27.
  - Nobody fitted on this set, and nobody had looked at it before this run.

### (c) Incidence
- **21.0 %** of 20,000 drawn carry a lull, against `LULL_SHARE` 0.35.
- **混 5 %**, not "every co-channel reception".
- 混 lulled in the lullcal sets: 3001 2/31, 4001 0/20, 5001 0/27.

## The full battery: `node art/zankyo/_picture-probe.js p2`, GATE GREEN (exit 0)

| section | result |
|---|---|
| render (§6.3.2) | All 15 kinds move their metric beyond the floor. P2's kinds at sev 0.5 against the floor: 点 dashes 0.58 vs 0.0003 · 縞 stripe 5.72 vs 0.067 · 帯 humPeak 8.69 vs 0.052 · 混 xtalk 0.208 vs 0.0007 · 横 lineVar 27.2 vs 0.074 · 旗 flagTop 3.47 vs 0.032 · 揺 jitterHF 0.740 vs 0.021 · 捩 waveLF 1.43 vs 0.046 · 滲 smearTail 0.753 vs 0.012 · 飽 clip 0.150 vs 0.0003 · 飽·neg negShare 0.30 vs 0.0003 |
| **kill** (`render --kinds <P2> --kill <P2>`) | **GATE RED, exit 1: all 11 fail by name** (10 kinds plus 飽·neg; each moves ≤ 0.0016 against its floor). The gate is live. |
| draws (§6.3.1) | All 8 archetype shares are within −2.9 % … +3.5 % of §4.1, against a gate of ±25 % relative. Uncommon tier 0.1666. 104 combinations. **Seen-before 9.03 %** (worst set 12.2 %), against the P2 gate of ≤ 20 %, with the JND taken from this run's own `render.json`. That supersedes the coder's 5.85 %, which used the default JND. 今 drawn 200× reads 100 %. |
| legibility (§6.3.3, §11.2) | Median 0.7479 against rc.91's 0.7069. 0/48 buried. 48/48 surface, worst window 0.70 s. 遠/嵐 at sev 1: 24/24, worst window 0.90 s. |
| perf (§6.3.4) | Worst archetype mean 1.717 ms (遠). Drawn: dpr 1 mean 1.597 / p99 4.8 (rc.91 in the same run: 1.244 / 3.7), dpr 2 1.713 / 4.3 (rc.91: 1.368 / 4.1). Budget: mean ≤ 2.5 ms. Single-frame worsts are 7.7 / 28.9 ms against rc.91's 10 / 25.3 under the same load. 遠's one 50.6 ms frame sits against its p99 of 4.5 ms: a load spike, not a cost. |
| crack | All 12 hairlines fade (worst last/first 0.03). The one-weight sensitivity is caught (1.031). A dark picture lifts no light (568 frames). Nothing exceeds the cube. The bright picture lights 150/150. None of patterns A–D is greener than the tube beside it. The green-stroke and green-white sensitivities are both caught. |
| lull | As built 24/24, worst window 0.90 s, near-clean share median 0.01. Lull off 13/24, so the gate is live. Incidence 21.0 %. Gap CV median 0.734, p5 0.380. Worst 5 s window's flat 0.70 s. rc.P1's metronome reads CV 0.000, so it is caught. |
| phases | 即常切, 探戻残 and 即走切·card are identical to rc.91. 浮断絶 differs only on the 断 tail (loss 84 → 9 frames, the P1 fix). |

## Realism (§2.1)

This round changed no pixel path, so r1's by-eye table stands. I re-checked `P2-kinds.jpg`:
- 点 is one-line dashes on a burst schedule.
- 縞 is fine diagonal stripes.
- 帯 is a rolling dark bar.
- 混 is the MSHI card behind venetian blinds. The kanji and the "MSHI" are the card's own
  content, not a label.
- 横 is the diagonal bars of lost horizontal lock.
- 旗 is the top-of-frame hook.
- 揺 is the shiver.
- 捩 is the slow S-bend.
- 滲 is the right-dragging edges with ringing.
- 飽 is the bloom to mint-white.

None of them is RGB, a block, a datamosh or a sort, and the tube stays green.

## Recommendations (not required, carried forward)

- **R1** (r1): 飽's whites reach the mint-white top of the ramp, 10–29 % of the picture at sev
  0.8. This is for P5's look.
- **R3** (r1): the next round that re-baselines legibility and rc.91 should give the surfacing
  instrument a stripe-blind SSIM (2×2 box, or structure-only). It should then drop the two
  named exemptions rather than carry them.
  - The `--exempt` list lives only in the fit's command line and the `BURY2` comment.
  - `lullcal --built` still prints the two as misses and exits 1 on 3001. That is honest, but
    it means 3001 is not a clean green validation until R3 lands.
- **R5 (new).** 遠·cal·5 on 3001 surfaces at exactly 0.6 s, with a lull. 5001's worst is 1.0 s,
  and so is 4001's. One reception on the line in 576 is acceptable. If P3's entries and exits
  shorten the effective hold, re-check it first.
- **Perf headroom.** P2 costs about +0.35 ms mean over rc.91 (1.60 against 1.24 ms, dpr 1).
  The budget still has about 0.9 ms of room for P3 and P4.
- **Carried open items:**
  - the 帯/飽 LFO lock is P4's and needs `zk-broadcast.js`;
  - the memory only records reels (fine, per r1);
  - the force hook's comment;
  - the 4,000-lull cap;
  - `picture-crack-ab.js` desyncs under load;
  - WebKit is unrun, and that is QF's.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
node art/zankyo/_picture-probe.js p2 --out <dir>                                                        # GATE GREEN, 7 min at load 6–12
node art/zankyo/_picture-probe.js render --kinds 点,縞,帯,混,横,旗,揺,捩,滲,飽 --kill 点,縞,帯,混,横,旗,揺,捩,滲,飽 --out <dir>   # GATE RED, 11 by name
node art/zankyo/_picture-probe.js lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過 --out <dir>   # 190/192, the two exempt 嵐s
node art/zankyo/_picture-probe.js lullcal --built --seed0 5001 --archs 遠,嵐,混,電,同,過 --out <dir>   # 192/192, worst 1.0 s
node art/zankyo/_picture-probe.js lullfit --from <1001 off>/lullcal.json,<3001 off>/lullcal.json --exempt '1:ddr1-aktuelle-kamera-1986·3230.37,1:嵐·cal·5' --out <dir>
node art/zankyo/_picture-probe.js strip --reel 0 --seed 3025.37 --hold 8 --every 0.33 --name c2-3025-built --out <dir>
node art/zankyo/_picture-probe.js strip --reel 0 --seed 3025.37 --force '{"axes":{"lull":null}}' --hold 8 --every 0.33 --name c2-3025-off --out <dir>
```
