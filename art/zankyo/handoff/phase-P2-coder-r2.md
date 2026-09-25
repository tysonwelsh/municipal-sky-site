# P2 — coder's handoff, round 2

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`,
served on **:8141** (`router.php`, the server already running; I started and stopped none).

| commit | what | VERSION |
|---|---|---|
| `7f99524` | the lull rule: 縞's burial term rides on the snow; BURY2 refitted on seeds 1001 + 3001; `lullfit --exempt` | `2.1.0-rc.P4 — a co-channel picture whose stripes ride on heavy snow no longer stays veiled: the face now rises through it now and then, like the other buried receptions` |
| (this file) | the handoff and three strips, `picture-sheets/P2-r2-*.jpg` | dev-only |

**Files touched:** `zk-picture.js` (the burial terms and their comment only), `_picture-probe.js`
(`lullfit` only), `VERSION`. Nothing in the render path changed: `burial()` is read once per
reception, by `needsLull`.

**Standing checks:**
- `git diff 2baf87e` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/` is empty.
- Music identity: not checked, by the owner's ruling (2026-09-24).
- §11: no colour, VFD or label change. Every reception surfaces (below, with two exemptions
  judged by eye).

Load average through this round: **33–42** on 11 cores.

---

## Required item 1: every reception surfaces on fresh seeds

### What changed

I took the critic's first suggested route: refit BURY2 with a herringbone term scaled by the
snow. I did not take the "雪 light" route, so the draw is unchanged. The reasons are under
Decisions.

**The term.** It is `herr · amp/10 · 3p`, where 3p is P1's own snow term: the spark density at
the carrier's resting level. `snowP(ch)` is now one function, shared by P1's term and this one.
- The cause: stripes alone leave a face, because every 縞 on a clean carrier in both sets
  surfaced. Snow at 3025's level alone scores 0.565 and also leaves a face. The two together
  veil it.
- So a 縞 on a clean carrier (p ≈ 0.02) costs about 0.03 × amp/10. It stays lull-free, as the
  critic asked.

**The fit.** `lullfit --from 1001-lull-off,3001-lull-off --exempt '1:ddr1…·3230.37,1:嵐·cal·5'`:
- 384 lull-off receptions;
- 20 need a lull: 14 fail to surface, and 6 more surface with a worst window under 0.8 s.

| weight | r1 | r2 | what it covers |
|---|---|---|---|
| herr (now × 3p) | 0 | **1** | 3025.37 (0.565 → 1.005) and ddr1·3218.37, the same shape: 混, 雪 0.81, 縞 13.4, worst window 0.6 s lull-off (0.499 → 1.088) |
| skew | 0 | **0.2** | 嵐·cal·8 (snow + 横 + 旗, worst 0.4 s): 0.866 → 0.963. It already had a lull, but it sat under the 10 % margin. |
| jit | 0 | **0.2** | john-cage·3013.37 (遠 with 揺 0.38, worst 0.7 s): 0.810 → 0.979 |
| smear | 0.05 | 0.05 | — |
| agc | 1 | 1 | — |

Every one of the 20 is at or above BURY_LINE / 0.9, except the two exemptions.

**`--exempt` (new, dev).** It names rows judged legible by eye in a strip. They are fitted as
surfacing, and the tool throws if a name matches no row. It is used only for the two 嵐s the
critic ruled an instrument limit.

### (a) Seeds 3001, as built: 190/192. The 2 misses are legible by eye, and neither is buried for the whole hold.

`lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過`: **190/192 surface**, lulled 49/192.
Before (critic r1): 189/192, lulled 46.

| reception | r1 (critic) | r2 |
|---|---|---|
| **john-cage·3025.37** 混 | ✗ med 0.266, worst 0 s, no lull | **✓ med 0.462, worst window 1.3 s, lulled** |
| ddr1·3218.37 混 | ✓ worst 0.6 s, no lull | ✓ worst 2.0 s, lulled |
| john-cage·3013.37 遠 | ✓ worst 0.7 s, no lull | ✓ worst 1.2 s, lulled |
| ddr1·3230.37 嵐 | ✗ med 0.332, worst 0 | ✗, unchanged (burial 0.174, no lull) |
| 嵐·cal·5 (ddr1, 3606.37, sev 0.8) | ✗ med 0.291, worst 0 | ✗, unchanged (burial 0.203, no lull) |

- Those are the only three receptions whose lull assignment changed.
- The worst window among the 190 that surface is 0.6 s: 遠·cal·5. It is lulled and unchanged
  since r1.
- Of the 27 receptions with 縞: 25 surface and 2 are lulled. The worst passing window is 1.3 s
  (r1: 0.6 s).

**By eye** (8 s hold, a tile every 0.33 s, seeded texture, on this tree):
- `picture-sheets/P2-r2-混-3025-john-cage-lulled.jpg`:
  - The face rises out of the snow at 0.6–1.6, 2.9–3.9 and 5.2–6.2 s. It sinks back into
    dense snow at 2.2 and 4.6 s.
  - It is a surfacing, not a clearing: the stripes and sparse snow stay in the lulls.
  - The single all-snow tile at 7.2 s is a scheduled dropout (carrier 0.15).
- `picture-sheets/P2-r2-嵐-3230-ddr1.jpg` and `P2-r2-嵐cal5-ddr1.jpg`:
  - No lull. Both faces and the "C. Sartzetakis" caption read in every tile off the dropouts
    (22 of 24 in each).
  - The only tiles without the picture are the 横 shear episodes (5.2 and 7.2 s in the first;
    1.6 and 7.2 s in the second), which relock.
  - This matches the critic's r1 ruling: 8×8 SSIM reads stripes of pitch 2.6–6.5 px as lost
    structure. Neither is buried at any point in the hold.

### (b) Seeds 4001, fresh, checked before any tuning against them: 192/192

`lullcal --built --seed0 4001 --archs 遠,嵐,混,電,同,過` ran **once**, after the weights were
committed to the working tree, and nothing was changed after it.

- **192/192 surface**, and the worst window of all 192 is **1.0 s**. Lulled 44/192.
- The 21 receptions with 縞: 21 surface and 2 are lulled. The worst window is 1.0 s.
- Median of the median hold SSIM: 0.7329. At 3001 as built it is 0.7234, and at 3001 lull-off
  0.6927.

### (c) Incidence

| | r1 | r2 | limit |
|---|---|---|---|
| 20,000 drawn (`lull` mode) | 19.5 % | **21.0 %** | ≤ 35 % |
| 混 among drawn | 0 % | **5 %** | not "every 混" |
| 3001 as built: 混 lulled | 0/31 | 2/31 | |
| 4001 as built: 混 lulled | — | 0/20 | |

By archetype (drawn): 嵐 57 %, 遠 43 %, 反 32 %, 過 29 %, 混 5 %, 電 0 %, 同 0 %, 清 0 %.

### The gates re-run (the critic asked for `legibility` and `lull`)

All were run on the r2 tree, at load 40–42.

| mode | result |
|---|---|
| `legibility` | **GATE GREEN**. Median 0.7479 against rc.91's 0.7069 (unregistered 0.7261). 0/48 buried. **48/48 surface**, worst window 0.70 s. 遠/嵐 at sev 1: 24/24, worst window 0.90 s. Identical to r1: none of these 72 receptions changed its lull. |
| `lull` | **GATE GREEN**, 7/7. As built: 24/24, worst window 0.90 s. Near-clean share: median 0.01. Lull off: 13/24, so the gate is live. Incidence 21.0 %. Gap CV: median 0.734, p5 0.380. Worst flat time in any 5 s window: 0.70 s. The metronome is caught (CV 0.000). |
| `draws` | **GATE GREEN**. Archetype shares −2.9 % to +3.5 % of §4.1. Uncommon tier 0.1666. 104 combinations. Seen-before 5.85 % (worst set 9.0 %), and 今 reads 100 %. The JND is the default 0.1, because this out dir has no render.json. r1 read 9.03 % with its render.json JND. The draw itself is byte-for-byte unchanged. |
| `lullcal --built` 3001 / 4001 | above |

**Not re-run:** `render`, `perfp1`, `crack` and `phases`.
- The diff touches nothing they measure. `burial()` runs once per reception, off the frame
  path, and only decides whether `ch.lull` is set.
- The critic r1 could not finish `p2` at load 70–95. The round-2 critic should still run the
  full battery once, as critic r1 asked.

---

## Decisions (the owner was not available)

1. **I refit the lull rule, and left the draw alone.** §4.1's table says "雪 light" for 混's
   secondary pool. §4.3's uncommon tier says "a secondary at high severity". I follow **§4.3**:
   the uncommon 混 on snow stays in the draw. Why:
   - Fringe co-channel reception, two distant stations both weak, is physically real.
   - The rule that §11.2 actually governs is the lull, and that is where the gap was.
   - Leaving the draw alone keeps every seed, strip and sheet from r1 valid.
2. **The herringbone term is multiplied by the snow, not by the carrier level**, the variant I
   rejected. With `amp/10 · lvl`, 3025 scored only 0.31 × W and the clean-carrier 嵐s scored
   0.18–0.20 × W, too close for a margin. With `× 3p` they separate by about 8×: 0.44 against
   0.08–0.10.
3. **The two 嵐 SSIM misses are exempted by name and by eye,** following critic r1's ruling.
   - I did not re-base the surfacing instrument (critic R3: a 2×2 box SSIM). That re-bases every
     legibility number and rc.91's, so it belongs to a round that does all of them.
   - Lulling these two would take a herringbone weight that lulls most clean-carrier 混, which is
     item (c)'s failure.
4. **skew 0.2 and jit 0.2 were kept.** The greedy fit added them for two thin receptions (worst
   windows 0.4 and 0.7 s), and they cost +0 % on 同 and 電 among drawn receptions (both stay at
   0 %).

## The critic's recommendations

- **R1** (飽's mint-white share): left for P5's look, as the critic proposed.
- **R2** (pepper): rc.91's dim spark left alone, per the critic's ruling on open item 1.
- **R3**: see Decision 3.
- **R4**: the items are carried as they were.

## Open items

1. **Two 3001 嵐 receptions fail the 8×8 SSIM surfacing test while legible by eye**
   (ddr1·3230.37 and 嵐·cal·5). The next surfacing instrument (R3, or the structure-only term)
   should re-base them.
2. **遠·cal·5 at 3001 surfaces at exactly 0.6 s** (worst window, lulled). It is unchanged since
   r1 and sits on the line, not under it.
3. Carried from r1:
   - the LFO lock for 帯/飽 (P4, needs `zk-broadcast.js`);
   - the memory only records reels;
   - the force hook's comment;
   - the 4,000-lull cap;
   - `picture-crack-ab.js` desyncs under load;
   - WebKit is unrun (QF's).

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
node art/zankyo/_picture-probe.js lullcal --seed0 3001 --archs 遠,嵐,混,電,同,過 --out <off3001>            # lull-off data (the fit's second set)
node art/zankyo/_picture-probe.js lullfit --from <1001 lullcal.json>,<off3001>/lullcal.json --exempt '1:ddr1-aktuelle-kamera-1986·3230.37,1:嵐·cal·5' --out <dir>   # node only: prints the r2 BURY2, 21.0 %
node art/zankyo/_picture-probe.js lullcal --built --seed0 3001 --archs 遠,嵐,混,電,同,過 --out <dir>   # 190/192, the two exempt 嵐s
node art/zankyo/_picture-probe.js lullcal --built --seed0 4001 --archs 遠,嵐,混,電,同,過 --out <dir>   # 192/192, worst window 1.0 s
node art/zankyo/_picture-probe.js legibility --out <dir>     # GREEN
node art/zankyo/_picture-probe.js lull --out <dir>           # GREEN, 21.0 %
node art/zankyo/_picture-probe.js draws --out <dir>          # GREEN
node art/zankyo/_picture-probe.js strip --reel 0 --seed 3025.37 --hold 8 --every 0.33 --name miss-3025 --out <dir>
node art/zankyo/_picture-probe.js strip --reel 2 --seed 3230.37 --hold 8 --every 0.33 --name 3230 --out <dir>
node art/zankyo/_picture-probe.js strip --reel 2 --seed 3606.37 --force '{"archetype":"嵐","sev":0.8}' --hold 8 --every 0.33 --name cal5 --out <dir>
node art/zankyo/_picture-probe.js p2 --out <dir>             # the full battery (for the critic)
```

The 1001 lull-off data used for the fit is r1's `lullcal --archs 遠,嵐,混,電,同,過` (default
seed0 1001).
