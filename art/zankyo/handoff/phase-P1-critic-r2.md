# P1 — critic, round 2: SIGNED OFF

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
I reviewed the code at `14a1837` (rc.P2) and the handoff and sheets at `e4849f7`. I did not
write this code. Every number below comes from my own runs on :8141 (`router.php`, this
worktree), at load average 30–37.

**Verdict: P1 passes.** Both required items from round 1 are fixed. The full gate reproduces
green, and every gate I leaned on can fail. The last green commit is this one: it adds only
this file, two critic strips, two dev-only instrument options and a comment fix in
`tools/picture-crack-ab.js`. No bump is needed.

Music identity was not checked, by the owner's ruling (2026-09-24). `git diff 2baf87e HEAD`
over `zk-broadcast.js` and `zankyo-audio.js` is empty. The P1 diff contains no `textContent`,
`innerHTML` or colour change, so the VFD still names nothing and the tint is untouched, which
means always green.

## The full gate, re-run

`node art/zankyo/_picture-probe.js p1` → **GATE GREEN**, exit 0.

| gate | coder r2 | mine |
|---|---|---|
| render (moved/floor) | 雪 20.53/3.48 · 影 .1047/.0015 · 裂 .6665/.0735 · 霞 .2531/.0003 · 伸 1.168/.0127 | identical |
| archetype shares, uncommon tier | ±3.5 %, 0.1666 | identical |
| seen-before (≤ 30 %) | 18.61 % | 18.61 % |
| median hold SSIM, registered: tree vs rc.91 | .7194 vs .7069 | .7194 vs .7069 |
| buried / surfacing, 48 drawn | 0/48 · 48/48, worst 1.20 s | identical |
| 遠/嵐 at sev 1 surface | 24/24, worst 1.00 s | identical |
| perf mean, dpr 1 / dpr 2 (rc.91) | — | 1.65 / 2.057 (1.377 / 1.537) |
| perf p99, dpr 1 / dpr 2 (rc.91) | 6.7 vs 5.2 fail, then 5.9 vs 4.5 pass | **4.5 vs 4.6 / 5.8 vs 4.8: pass** |
| crack (d), last run ÷ first run | worst 0.030; flat mask 1.031 | identical |
| crack: dark frames with any glow | 0 of 566 | 0 of 566 |
| lull: near-clean share, incidence, gap CV, worst flat | 0.07 · 31.6 % · 0.729 · 0.70 s | 0.07 (max 0.84) · 31.6 % · 0.729 · 0.70 s |
| lull off (sensitivity) | 12/24 | 12/24 |
| phases | 即常切, 探戻残 and 即走切 equal rc.91; 浮断絶 loss 84 → 9 | identical |

**Perf.** My run passed the tail gate on its absolute arm: dpr-2 p99 was 5.8 ms, against the
6 ms limit. Two of the coder's three runs passed, and so did mine: three of four in all, at
load 28–42. The dpr-2 mean costs **+34 %** over rc.91 (2.057 against 1.537 ms), but it is
inside the 2.5 ms budget. P2 adds kinds and should watch this number.

## Item 1, the lull: fixed

- **It surfaces; it does not clear.** In `zk-set.js` the carrier is lifted by 0.08 × L, not
  pinned. Each impairment eases toward a target and never below it. I checked the look on
  three reels:
  - **john-cage** (the coder's strip, `P1-strip-far-遠-john-cage.jpg`): the face comes up
    through sparse snow at 2.8–4.3 s and 7.3–8.8 s. It is buried at 4.8–7.0 s. It reads as
    rising and sinking, not as a switch to clean.
  - **ddr1, near-clean share** (my run, new `--lullreel 2`): **0.07** as built and 0.00 with
    the lull off; 24/24 surface. So the coder's gate does not depend on the reel it was tuned
    on.
  - **ddr1 by eye** (`P1-strip-far-遠.jpg`): at the lull's top (7.8–8.3 s, L 0.93) the card
    text is readable. That is the brightest moment of the rarest end, and it lasts about 1 s.
    I accept it.
  - **bbc1** (my run, `--lullreel 1`): the near-clean share reads **0.41**. That is RED against
    0.15 (0.09 with the lull off). **I rule this a limit of the threshold, not a clearing.** My
    strip `picture-sheets/P1-critic-r2-strip-far-遠-bbc1.jpg` shows the card at the lull's
    top still dark and grainy, a shape behind snow. The test card's hard geometry keeps SSIM
    above 0.7 while the picture is plainly veiled. NEAR_CLEAN 0.7 is a john-cage number, and
    the gate is right to measure it there.
- **It does not keep time.** I checked the schedule separately in node, on fresh seed sets
  5001–5040 (20,000 draws, none in the probe's sets) over a **300 s** hold, not only 30 s:
  - 31.0 % lulled;
  - the first flat starts by 3.28 s;
  - the shortest flat is 0.70 s;
  - the longest gap from one flat's end to the next flat's start is 3.60 s;
  - **the worst 5 s window holds 0.70 s of flat**, so the guarantee holds for the whole hold;
  - 7–12 lulls in the first 30 s (median 9).
- **Only where it is needed.** 嵐 is 80 %, 遠 54 %, 清 0 %.
- **Fresh-seed validation (my run, `lullcal --built --seed0 3001`, seeds the fit never saw):
  143/144 surface, 66 lulled.** The one miss:
  - **Which.** `ddr1·3222.37`, a 反 with two *negative* echoes (a −0.18 and −0.21 at 4.4–4.7 px)
    and no snow kind. Burial score 0.66, well under BURY_LINE 0.856, so this is not a
    borderline case. Median SSIM 0.47; worst window 0.2 s.
  - **By eye it is never buried.** My strip `P1-critic-r2-strip-反-3222-ddr1.jpg` shows both
    faces and the card legible in every tile off the dropouts, with the carrier at 0.77–0.94.
    The echoes darken and soften the picture, and SSIM against the clean reads that as lost
    structure.
  - **Not blocking.** §11.2's requirement is "never completely buried", and this reception
    is not. But the surfacing line (0.4) cannot tell a dim, echo-smeared picture from a buried
    one. P2 should know that before it adds kinds (see recommendation 2).

## Item 2, the crack's light: fixed

- **The mask follows the run weights.** Check (d) reproduces: worst last/first **0.030** over
  12 hairlines in 4 patterns. rc.P1's flat mask reads 0.95–1.03, so the check is live. The mask
  and the SVG both read the same `WP.runs`. The SVG loop is the same code, moved; I read
  the diff but did not byte-compare the output.
- **The owner's rule.** On a dark tube there must be no green along the crack.
  - **In-page, exact:** the glow layer is 0 in every channel on all **566** dark frames.
    rc.91's stroke put back is caught on the idle canvas (crack 9.01 vs beside 5.89).
  - **The whole page, glow on against off (`tools/picture-crack-ab.js`, my runs).** Only rows
    where the two runs stayed in sync are listed. A desynced row differs over the whole tube:
    - **Pattern A:**
      - idle **0 px**, twice;
      - dead **0 px**;
      - idle again **0 px**;
      - lit john-cage 2,202 px (mean ΔG **+11.49**);
      - lit bbc1 927 px (mean ΔG +3.55).
    - **Pattern D:**
      - idle 2 px and dead 1 px, both **neutral** (±8 in R, G and B alike). That is the SVG
        edge rasterising, not green;
      - lit john-cage 2,201 px (mean ΔG +10.2).
    - **rc91 sensitivity:** idle again 2,943 px, up to +18 G. **Caught.**
- **The look.** At dpr 1, over john-cage, I cropped the hairline right of the blow and
  enlarged it 4× (glow on against off). The light is a faint lift along the near edge. The
  hairline's tip fades out with its edges; there is no lit, blunt tip and no neon line.
  Correct for option D.
- **The tool is still not deterministic at load 33, and not only in the lit rows.**
  - **What I changed.** I made the stable-shot wait 1100 ms × 3 identical shots, because
    headless composites at ~1 fps. It did not cure the problem.
  - **Divergences seen:**
    - A: the glow-off john-cage frame was never decoded, and the dead tube that followed then
      differed over 173,114 px;
    - D: idle again differed over 175,910 px;
    - rc91: idle and dead desynced.
  - **The cause.** This is run-to-run state, not the shot. I have documented it in the tool.
    Every row read 0 px in at least one in-sync run. The in-page check is the exact one, and it
    is green.

## Ruling asked for: SSIM registered for the set's own 伸 scale. Accepted

- **Why accepted.** The scale is **read** from the set (`geo.sc × geo.sy`), not searched, so
  it cannot absorb an impairment. In the hold `sy` is 1 (it moves only in `collapse`), so the
  factor is exactly 伸's 1 + swell. A picture 3 % larger is not less legible (decision 6).
- **No gate rests on it.** I added `--noscale` (dev-only), which registers for position only,
  as r1 did:

  | gate | with the scale (as built) | `--noscale` |
  |---|---|---|
  | legibility: median, tree vs rc.91 | .7194 vs .7069 | **.7123 vs .7069: still passes** |
  | 48 drawn receptions surface | 48/48 | 48/48, worst 1.20 s |
  | 遠/嵐 at sev 1 surface | 24/24 | 24/24 |
  | lull mode, as built | 24/24 | **24/24**, near-clean 0.06 |
  | lull mode, lull off | 12/24 | 10/24 |

- **The coder's reason does not reproduce.** The coder wrote that 嵐·sev1·4 needed the
  correction. At the final constants it does not: it surfaces without the correction. The
  correction is still right to keep.
- **The margin is thin.** Without the correction the tree leads rc.91 by 0.0054. Unregistered,
  it trails, 0.6972 against 0.7069, as the coder reported. The gate is the registered one
  (decision 6, accepted in r1), so this passes. But P2's new kinds must not spend the lead.

## Recommendations (not blocking; for P2)

1. **The dark specks are still square.** One source pixel at l × 0.3 shows as 5 × 5 px at
   dpr 2. The IF smear should streak them like the sparks. They show clearly in the surfaced
   john-cage tiles and on 遠 212/220 on the ddr1 sheet. Deferred at r1 and again at r2; P2
   owns it.
2. **The surfacing line and dim receptions.** 3222.37 (above) fails the 0.4 line while plainly
   legible. Before P2 widens the kinds, either:
   - normalise SSIM for the tube's own gain (compare structure, not luminance and contrast); or
   - add a structure-only surfacing term.

   Then refit `burial()` on the wider set. Negative echoes are the gap: `1.5·Σ|a|` counts
   their amplitude but not the darkening.
3. **Near-clean is a john-cage number.** If P2 re-gates the lull, measure the share on john-cage
   and ddr1 (both read 0.07 today), not bbc1.
4. **`picture-crack-ab.js`:** make the two runs one run (toggle the glow on the *same* frame,
   e.g. a `_dev` recompose without a step), or wait for `requestVideoFrameCallback` after the
   seek. Until then, read only rows that are in sync.
5. **Carried:**
   - seen-before still uses the five-severity vector (18.61 % at JND 0.1). P2 should widen it;
   - the force hook's "consume the fork alike" comment is stronger than the code;
   - `lullSchedule` stops extending after 4,000 lulls, about 3.7 h of one hold, and then grows
     by one entry per call. It is harmless at real hold lengths;
   - WebKit is unrun (QF's job);
   - `zk-broadcast.js`'s "29 TUNED reel(s)" `console.error` belongs to the audio crew.

## Instrument changes in this commit (dev-only)

- **`_picture-probe.js`:**
  - `--noscale` registers for position only;
  - `--lullreel <i>` runs the lull mode on reel i.
  - Neither is used in a gate run, and defaults are unchanged.
- **`tools/picture-crack-ab.js`:** the stable-shot wait is 1100 ms × 3 identical shots, and the
  comment now says what it does not fix.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2
php -S 127.0.0.1:8141 router.php                                                  # if :8141 is down
node art/zankyo/_picture-probe.js p1 --out <dir>                                   # ~20 min at load 35: GREEN
node art/zankyo/_picture-probe.js legibility --noscale --out <dir>                 # .7123 vs .7069
node art/zankyo/_picture-probe.js lull --lullreel 2 --out <dir>                    # ddr1: near-clean 0.07
node art/zankyo/_picture-probe.js lull --lullreel 1 --out <dir>                    # bbc1: 0.41, RED by design (see item 1)
node art/zankyo/_picture-probe.js lullcal --built --seed0 3001 --out <dir>         # 143/144; the miss is 3222.37
node art/zankyo/_picture-probe.js strip --reel 2 --seed 3222.37 --hold 8 --every 0.33 --name s --out <dir>
node art/zankyo/tools/picture-crack-ab.js http://127.0.0.1:8141/art/zankyo/ <dir> 0 on      # and 3 on; 0 rc91
```
