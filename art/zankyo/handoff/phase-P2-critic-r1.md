# P2 — critic, round 1: NOT SIGNED OFF (1 required item)

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the picture at `f3ffc80` (rc.P3) and the handoff and sheets at `ccc2a90`. I did not
write this code. Every number below comes from my own runs on :8141 (`router.php`, this
worktree).

**Verdict: P2 does not pass yet.** The ten kinds are there, and each one has its physical cause
and moves like it. Nothing I saw is digital. The tint stays inside the P39 ramp, and the VFD is
untouched. What fails is §11.2 on fresh seeds. The coder's own suggested check (open item 4) finds
**3 of 192 receptions that never surface** (worst window 0 s), and all three carry 縞. By eye,
one of them is truly veiled for the whole hold. Required item 1 fixes that.

**The last green commit stays `08f4fc4`** (P1 signed off). This file, five critic strips and one
dev tool (`tools/picture-frames.js`) are dev-only. They need no bump.

**Standing checks:**
- Music identity was not checked, by the owner's ruling (2026-09-24).
- `git diff 2baf87e HEAD` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `pj2-*.js` is empty. `index.php` differs only by P0's script tag.
- The P2 diff has no `textContent`, `innerHTML` or colour change. Every new kind works on luma
  before the P39 LUT (`zk-picture.js` `sourcePass`, `xtalkPass`, `smearPass`, `impulsePass`,
  `geoMap`). So the VFD still names nothing, and the tint is always the ramp's green.

## What I ran, and what I could not

**Load.** The machine sat at a **load average of 68–95 on 11 cores** through this review. An
unrelated app, `Antigravity`, was using about 800 % CPU. It is not ours and I left it alone.

**Not finished.** `node art/zankyo/_picture-probe.js p2` (the whole battery) and the `--kill`
sensitivity run each ran for **71 minutes and did not finish their first section** (render).
The probe was getting about 6 % CPU. I stopped both. They were my processes, and I also cleared
their headless Chrome instances.
- If the audio crew lost a headless Chrome at 00:20 on 09-25, a `pkill` on
  `--remote-debugging-port=0 --user-data-dir=/var…` is the likely cause. After it, `ps` showed
  no headless Chrome left.
- So I did **not** reproduce the render, draw, legibility, perf, crack or phase numbers.
- The round-2 critic must re-run the full battery, on a quieter machine if possible. Required
  item 1 blocks sign-off whatever those numbers read.

**What I did run:**

| run | result |
|---|---|
| `lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過` (seeds the BURY2 fit never saw; the coder's own suggestion) | **189/192 surface · worst window 0 s** · lulled 46/192 · RED |
| draws, node only, on fresh seed sets 5001–5008 (20,000 draws) | archetype shares 4.9–22.0 %, all within ±3 % of §4.1 · P2 kind incidence 8.2–19.4 % · negative flash on **4.61 %** of receptions (過 755, 嵐 168) · lull 18.4 % · 0 NaN · `ch.kinds` and the kind fields agree on every draw |
| strips: 帯, 飽 with the negative flash forced, 点, 過 at sev 1, and the three misses | below |
| `tools/picture-frames.js` (new, dev): full-size tube frames and what the viewer receives after the ramp | below |

## Required item 1: every reception surfaces on fresh seeds (§11.2)

**The data.** `lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過` has 192 receptions, with
the lull handed out by `needsLull`. Three of them never surface:

| reception | character | median SSIM | worst window | burial score | by eye (my strip) |
|---|---|---|---|---|---|
| `john-cage·3025.37` | 混 sev 0.60: 雪 0.80 (the uncommon-tier secondary), 縞 amp 8.5, 混 depth 0.12 from memory; carrier rests at 0.63 | 0.266 | **0 s** | 0.565 | **Veiled for the whole hold.** The face never rises: dense snow plus stripes at one level, carrier 0.36–0.79. `picture-sheets/P2-critic-r1-miss-混-3025-john-cage.jpg` |
| `ddr1·3230.37` | 嵐 sev 0.86: 縞 amp 11, 混 depth 0.25 from the card, 捩 | 0.332 | 0 s | 0.089 | Legible throughout: faces and caption read in every tile off the dropouts. `P2-critic-r1-miss-嵐-3230-ddr1.jpg` |
| `嵐·cal·5` (ddr1·3605.37) | 嵐 sev 0.8: 縞 amp 13, 混, 横, 捩 | 0.291 | 0 s | 0.079 | Legible throughout (grainy). `P2-critic-r1-miss-嵐cal5-ddr1.jpg` |

**All three carry 縞.** 27 of the 192 receptions draw 縞: 3 of those 27 fail, and the worst
window among the 24 that pass is 0.6 s, exactly the line. BURY2 gives 縞 and 混 weight 0, because
the seeds-1001 data had no co-channel reception that needed a lull ("混 0/27"). The fit had one
reception to learn from (the coder's caveat), and the first fresh set breaks it.

**My ruling on the two 嵐 misses: an instrument limit, not burial.** Stripes at a pitch of
2.6–6.5 px are high-frequency structure that the clean frame does not have, so 8×8 SSIM reads
them as lost structure even when the picture is plainly there. This is the same kind of limit
P1 r2 ruled on for 反 3222.

**3025.37 is real.** It is also the case §11.2 was written for: "never completely buried … a
face or a shape rising out of the noise for a moment and sinking back". Here nothing rises. The
snow (an uncommon-tier 雪 at 0.80 on a carrier resting at 0.63) does most of the veiling, and the
stripes finish it off. The rule gives it no lull, because BURY2 counts nothing for 縞 or 混, and
P1's terms score the snow at 0.565, under BURY_LINE 0.856.

**Required.** Make the lull rule cover co-channel receptions like 3025.37, and show it on
seeds nobody has fitted on:
- (a) `lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過` must reach **192/192**. Any
  remaining miss must be shown legible by eye in a strip, the way the two 嵐 misses are here, and
  **no** miss may be veiled for the whole hold.
- (b) The same must hold on a **second** fresh set, `--seed0 4001`, before any constant is
  tuned against it. After fitting on 1001 and 3001, 4001 is the only honest validation.
- (c) Report the incidence afterwards. It must stay ≤ `LULL_SHARE` 0.35, and 混's share must not
  jump from 0 % to "every co-channel reception", which would make every 混 tube pulse alike.

**Suggested route (the coder may choose another):**
- Refit BURY2 with `lullfit --from <1001 lullcal.json>,<3001 lull-off lullcal.json>`. The 3001
  lull-off data needs `lullcal --seed0 3001 --archs …` without `--built`.
- 縞 probably earns a small weight on `amp` when it rides on snow. A term like `herr · amp/10 ·
  lvl` would let a clean-carrier 縞, which surfaces on its own (the 同/電 data), stay lull-free.
- Alternatively, honour §4.1's "雪 light" in 混's secondary pool even in the uncommon tier. That
  removes 3025's snow at the source, but §4.3's "a secondary at high severity" argues the other
  way. If you take this, say which ruling you are following.
- Whatever is changed, re-run `legibility` and `lull`. The drawn gate's worst window, 0.70 s, is
  already thin.

## The kinds, judged by eye (§2.1, the realism rubric)

Every judgement comes from the coder's `P2-kinds.jpg` and `P2-strip-sync-同.jpg`, my strips, and
full-size frames from `tools/picture-frames.js` (486×364 tube canvas, dpr 1).

| kind | cause, and does it move like it | verdict |
|---|---|---|
| 点 | Bursts: sparks at 0.5–0.8 s and 3.3–4.0 s, clean between (my ddr1 strip, sev 0.8). One line tall, with the dark IF tail. | ✓ |
| 縞 | Fine diagonal stripes. Drift is a constant phase velocity (`herringRows`), with the zig-zag and the wander in angle. | ✓ |
| 帯 | Measured on the **displayed** green channel (bbc1, sev 0.8): the bar darkens rows by up to −30 of a 45 mean, and its centre moves 0.85 → 0.05 (wrapped) → 0.20 → 0.35 of the frame over 1→2→3→4 s, a roughly constant 0.15–0.2 frame/s. Rolls at a constant beat. Subtle on a dark card, visible on the full-size frame. | ✓ |
| 混 | The MSHI card or the memory, under the picture with drifting venetian blinds (full-size ddr1 frame, seed 211.37). Its own blanking bars show. Convincing. | ✓ |
| 横 | Episodes: the picture shears into diagonal bars with the blanking between, slides, and relocks to a whole line (`P2-strip-sync-同.jpg` 1.3, 3.9, 7.9 s). | ✓ |
| 旗 / 捩 / 揺 | Hook, S-curve and shiver, all in the per-line offset map. The shiver at sev 0.8 is strong but reads as noisy sync, not as blocks. | ✓ |
| 滲 | Edges drag right with a ringing outline (full-size ddr1, sev 1). Analogue. | ✓ |
| 飽 | My strip (john-cage, sev 0.8, `negRate` 3): it blooms mint-white at 0.3–0.6 s, settles by 0.9 s, then pumps. The negative flashes (0.7, 0.8, 1.0, 1.2, 2.3, 2.7, 3.2, 3.6 s) are whole-frame inversions of 60–200 ms that the phosphor smears. They read as a crushed sync, not as an effect. | ✓ (see R1) |

No RGB, no blocks, no datamosh: every new pass is 192×144 luma or a row offset.

## Recommendations (not required)

- **R1. 飽's whites reach the ramp's mint-white top.**
  - The measure: the share of the picture at R ≥ 190, meaning luma ≥ ~245, which the ramp paints
    (179–222, 243–255, 192–226).
  - The numbers: john-cage's clean frame reads **6 %**; 飽 alone at sev 0.8 reads **10–29 %**;
    過 at sev 1 reads 9–26 %. On ddr1 the same go from 8.5 % to 10–14 %.
  - It stays inside the P39 ramp, so §11.1 holds as written. But a third of the tube at
    (222, 255, 226) is the palest the set can go. If the owner finds it whitish, let 飽's
    shoulder approach ~240, not 255: LUT[235] is (136, 231, 159). I leave it for P5's look.
- **R2. Pepper on overload.**
  - The black single-pixel "dim sparks" from rc.91's snow (the coder's open item 1) are denser on
    a 飽 picture. The measure is the share of pixels that are lit (G ≥ 100) with snow off and
    under half as bright with it on.
  - 過 sev 1, john-cage: 1.06 / 1.66 % with 飽, against 0.92 / 1.32 % with 飽 removed.
  - rc.91's own look (今) reads 0.12–1.39 % on the same frames.
  - So P2 amplifies the pepper by about 15–30 %, but it stays inside rc.91's range. My ruling on
    open item 1 is therefore to **leave rc.91's dim spark alone** in P2.
  - The physical point stands for P4 or P5: 過 is "too close, too strong", yet its carrier dips
    to 0.55 with snow bursts. A strong station should rest near a full carrier.
- **R3. The surfacing instrument and 縞.** Two of the three misses are SSIM reading stripes as
  burial.
  - A surfacing SSIM on a 2×2 box-downsampled frame would pass stripes of pitch ≤ 6.5 px and still
    catch snow.
  - It re-bases every number, so only in a round that re-baselines rc.91 (the coder's open
    item 3).
- **R4. The coder's other open items.**
  - 5 (the LFO lock) is P4's.
  - 6 (the memory only records reels) is fine: the test card is a slide, not a reception.
  - 7 is as carried.

## Re-run (round 2)

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
node art/zankyo/_picture-probe.js lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過 --out <dir>   # item 1a: 192/192 (4 min at load 70)
node art/zankyo/_picture-probe.js lullcal --built --seed0 4001 --archs 遠,嵐,混,電,同,過 --out <dir>   # item 1b
node art/zankyo/_picture-probe.js strip --reel 0 --seed 3025.37 --hold 8 --every 0.33 --name miss-3025 --out <dir>   # item 1, by eye
node art/zankyo/_picture-probe.js p2 --out <dir>                                    # the full battery (not reproduced this round)
node art/zankyo/_picture-probe.js render --kinds 点,縞,帯,混,横,旗,揺,捩,滲,飽 --kill 点,縞,帯,混,横,旗,揺,捩,滲,飽 --out <dir>   # must be RED, 11 by name
node art/zankyo/tools/picture-frames.js --force '{"impairment":"帯","sev":0.8}' --reel 1 --ats 1,2,3,4 --out <dir> --name hum   # displayed ΔG per band, mint share
node art/zankyo/tools/picture-frames.js --seed 777.37 --force '{"archetype":"過","sev":1,"axes":{"agc":{"negRate":0},"lull":null}}' --ref '{"archetype":"過","sev":1,"axes":{"agc":{"negRate":0},"lull":null,"snow":{"gain":0}}}' --reel 0 --ats 1,2,3,4,5 --out <dir> --name pep   # R2
```

Sheets added: `picture-sheets/P2-critic-r1-miss-混-3025-john-cage.jpg`,
`P2-critic-r1-miss-嵐-3230-ddr1.jpg`, `P2-critic-r1-miss-嵐cal5-ddr1.jpg`,
`P2-critic-r1-strip-飽-negative.jpg`, `P2-critic-r1-strip-過-ddr1.jpg`.
