# P3 — coder's handoff, round 1

Branch `zankyo-picture-video`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture2`.
Served on **:8141** (`router.php`; the probe's default). I started and stopped no server.

**Note on the ports:** the orchestrator named :8071. It answers 200 but fails every request with
"Failed opening required 'router.php'", because its working directory has no router. I left it
alone.

| commit | what | VERSION |
|---|---|---|
| `90526da` | P3: lock-ins, glimpses, losses, 焼, the no-carrier snow fix, the P3 probe modes | `2.1.0-rc.P5 — each reception now arrives and leaves its own way (…), each hunt's glimpses differ, on some nights the tube keeps a faint imprint of the last station, and the burst and the gaps are full snow again` |
| (this file) | the handoff and six strips, `picture-sheets/P3-*.jpg` | dev-only |

**Files touched:**
- `zk-picture.js`: ENTRY/EXIT/BURN constants, the draws, `lockLevels`, `glimpseLevels`,
  `walkAt`, `exitMode`, `burnDepth`, `burnImage`, a `direct` argument to `ghostPass`, and a
  burn argument to `tubePass`.
- `zk-set.js`: the phase blocks, the source, geometry, tube and composite passes, and
  `_dev.buffers`.
- `_picture-probe.js`: the `bounds`, `p3draws`, `p3render [--kill]` and `p3sheets` modes, plus
  multi-file interception.
- `picture-lab.php`: comments and the placeholder only.
- `VERSION`.

**Standing checks:**
- `git diff 2baf87e` over `zk-broadcast.js`, `zankyo-audio.js`, `zankyo.css` and
  `prosperos-jukebox-v2/` is empty.
- `index.php` is unchanged since P0; no new file was added.
- Music identity was not checked, by the owner's ruling (2026-09-24).
- §11: everything drawn is on the P39 ramp, so it is always green. The only literal colours are
  the vertical Paik line's, which reuse the horizontal line's greens. The VFD and labels are
  untouched.

Load while measuring: 5–11, except the full P2 battery, which ran at 22–68 (see perf).

---

## What was built (§3.5)

Every variant is drawn per reception on `set:rx:<seed>[:<piece>]`, from the pool its shape
allows (`ZP.ENTRY.pools` / `ZP.EXIT.pools`). **All P3 draws come last** on the fork, so every
earlier axis of every seed is what rc.P4 drew.

**Lock-in** (`ch.entry.mode`), per the shape (`soku` / `tan` / `fu`), and `relock` for piece > 0:

| mode | cause | what the tube does |
|---|---|---|
| snap | rc.91 | the carrier comes up over the window |
| roll | vertical hold loose on arrival | rolls in with its blanking bar, slows, and slides into place the way it was rolling |
| bars | line oscillator off frequency | diagonal bars slide, straighten as the AFC pulls in, relock on the nearest whole line, and give a last swing |
| fade | clean carrier rising | no kicks; the picture comes up from 0.3 of its contrast out of full-gain snow; for 即 it runs 0.8–1.6 s past the window |
| bloom | AGC wide open on an empty channel | blown out (gain up to 1 + 0.5–1.1), pulled down with a small undershoot |
| ghost | reflected path locks first | the echo arrives first (5–18 px, level 0.45–0.8), with the direct path from 0.25 |

- **浮 walk-down.** Every impairment is × `walk` (1.8–3) at the start of the drift and × 1 at
  the lock, on (1 − dk²). The echoes now arrive during the drift too; `ghostList` includes
  `drifting`.
- **Archetypes lean toward their own cause.** 反 ghost ×3, 過 bloom ×4, 同 roll ×2 and bars
  ×2.5, 遠 fade ×2 and roll ×1.5, 電 bars ×1.5, 混 ghost and fade ×1.5, 清 snap ×2.
- **With no window of its own** (探's catch after the hunt, a 走 swap with lockS 0), the lock
  plays over the first 0.6–1.6 s of the hold.

**探 glimpses** (`ch.glimpses`, four slots; glimpse i takes slot i). Each has its own mode
(roll, bars, ghost or fade), peak (0.55–0.9), sense and amount. 今 (null) is rc.91's glimpse
exactly.

**Loss** (`ch.exit.mode`), per the shape (`setsu` / `zan` / `zetsu`). This decides what the
loss, collapse and burst windows show:

| mode | loss | collapse |
|---|---|---|
| squash | rc.91's | the squash to Paik's line |
| roll | rolling away, at 0.3 + (2.5–6)·k^1.6 frame heights a second | still rolling as it squashes |
| snow | sinks smoothly: no stutter, the picture's contrast going, snow up to full gain | all snow |
| bars | the shear grows to 2–5 wraps, sliding faster | black |
| freeze | the frame store holds its last frame; the snow eats it | the frozen frame squashes |
| neg | rc.91's | the head (0.1–0.22 s) is the negative picture, then black |
| vline | rc.91's | the horizontal deflection fails: a squash sideways to a line down the middle |
| burn (残 only) | lingers, dimming to 0.45; no tears or slips | black, and the last lit image stays as an afterglow (0.35–0.6, τ 0.6–1.3 s) under the burst's snow and on the dead tube |

The burst is snow for every mode.

**焼 burn-in.** One draw per night on the set's own fork `"set:burn"` (the night burns with
p 0.5). On a burning night, a reception shows the imprint with p 1/3, at depth k 0.06–0.18.
- The imprint is the previous reception's picture (the frame memory). On the night's first
  reception it is the test card.
- The phosphor is dimmed before the ramp, `l·(1 − k·level^1.3)`, at **glass** coordinates: row
  and column maps follow the roll (and its wrapped copy), the squash and the swell, so the
  imprint holds still while the picture moves.
- A relock keeps it, because it belongs to the tube.

**Fixed along the way (visible, declared in the commit).** Since P1, the burst, the 戻 and 走
gaps, and the arrival drew snow at the **station's** gain. On a clean station (清: 0.26–0.4 of
rc.91's density) the burst was a sprinkle, and the hunt showed the picture plainly between its
glimpses. Now, as the carrier weakens outside the hold, the snow rises toward the tuner's own
at full gain (`snowUp`), as in rc.91. The hold keeps the station's own snow, so no legibility
calibration moves.

---

## The gates, by my own measurement

### Timing (§2.3, §7 row P3): `bounds`, GATE GREEN

- **Setup:** 48 bench descriptors.
  - Every entry × body × exit: 36, with drawn characters and lengths inside the receiver's own
    ranges.
  - 12 with a forced lock-in, glimpse and loss, so every variant runs through the machine.
- **Each ran three times:** on this tree; on **rc.P4** (`e5b49f2`'s `zk-set.js` and
  `zk-picture.js`, both swapped in by interception); and on **rc.91** (`2baf87e` with the dev
  shim).
- **Recorded:** every frame's phase (the set's `phaseOf`, via `_dev.step`), as transitions.
  Frame k sits at start + k·1000/30 ms, multiplied rather than accumulated, so it is the same
  instant on every page.
- **Result:** **436 phase boundaries over 33,884 frames.** Every one is on rc.P4's frame. Every
  one is on rc.91's frame too, except the **11 断 hold→loss boundaries** P1 moved (each by the
  hole's length, ±1 frame).
- All 12 forced receptions ran their forced modes.
- The swapped pages must prove what they are:
  - rc.P4: every file intercepted, the character hook present, no `lockLevels`.
  - rc.91: the existing check.
- The existing `phases` gate is GREEN too: 即常切, 探戻残 and 即走切 are identical to rc.91; 浮断絶
  differs only on P1's 断 tail.

### Every variant appears in 500 draws (§7 row P3): `p3draws`, GATE GREEN (node only)

**Setup:** 20,000 receptions (the 40 §6.3.1 seed sets × 500). Shapes were drawn at the
receiver's `ENTRY_W` / `EXIT_W` / `BODY_W`, **parsed from zk-broadcast.js** so they cannot
drift. The night's `set:burn` draw was included, and a relock piece was drawn where the body
has one.

**The gates:**
- Every lock-in (6), loss (8) and glimpse (4) variant appears in **each** set's 500.
- No variant appears outside its shape's pool.
- Every member of every pool appears.
- **The P3 draws come last.** Every other field of all 20,000 characters equals rc.P4's
  `zk-picture.js` draw, seed by seed (loaded from git in a vm).
- Sensitivity: 200 切 draws judged as 絶 put 116 outside 絶's pool, so the consistency check is
  live.

**Shares:**

| | |
|---|---|
| 即 | snap 30.3 · ghost 13.9 · fade 15.1 · roll 14.3 · bloom 11.8 · bars 14.5 % |
| 探 (catch) | snap 26.6 · roll 20.0 · bars 20.5 · bloom 14.4 · ghost 18.4 % |
| 浮 | fade 39.6 · ghost 21.5 · bars 19.9 · roll 19.1 % |
| relock | snap 36.7 · bars 19.6 · ghost 17.3 · roll 16.0 · bloom 10.4 % |
| glimpses | roll 29.5 · fade 25.3 · bars 25.1 · ghost 20.2 % |
| 切 | squash 36.1 · snow 16.7 · roll 16.5 · bars 15.5 · freeze 7.4 · neg 6.9 · vline 0.8 % |
| 残 | snow 37.0 · freeze 22.6 · burn 22.4 · squash 16.7 · vline 1.3 % |
| 絶 | squash 69.2 · neg 27.9 · vline 2.9 % |
| all losses | vline **1 in 86** (§4.3 very rare: ≤ 1 in 80) |
| 焼 | 18/40 nights burn · **15.0 %** of receptions (§4.3 uncommon ≈ 16.7 %) |

### Does each variant render, and as its cause: `p3render`, GATE GREEN; `--kill`, GATE RED on all 21

Each variant is run against its shape's default on the same seed and texture. The image must
move beyond 3× the default's own texture spread (the same reception on texture 1021), measured
as 8×8 block means averaged over 6-frame groups. **And** its cause must show in the set's state.
- The lock-ins run on 清, so the lock-in is seen alone.
- The losses run on the test card, which drifts, so a frozen frame shows.

| variant | image | cause (state) |
|---|---|---|
| 即 roll / bars / fade / bloom / ghost | 14.70 / 9.99 / 26.11 / 6.85 / 7.21 vs 3× floor 2.15 | roll 363 px, caught to 0.0 · shear 5.44 px/row → 0 · strength 0.490 vs 0.756 · gain 1.65 → 1.000 · echo 0.61, direct 0.25 |
| 浮 roll / bars / ghost | 41.22 / 33.54 / 52.66 vs 9.98 | rolled 364 px, caught · 1.89 → 0 · echo 0.59, direct 0.25 |
| 浮 walk-down | echo level (P1's ghostAmp) through the drift, one echo pinned at 12 px: walk 0.084 (twin 0.088) vs walk off 0.058 | — |
| 探 glimpses roll / bars / ghost / fade | 30.03 / 27.68 / 26.43 / 23.22 vs 9.73 (against 今's) | rollV 4.2 · shear 3.89 → 0.35 · echo 0.59 · rollV 0.00 |
| 切 roll | image rows of vertical travel per frame, second half of the loss: 14.74 vs the squash's ≤ 2.65 | rollV 35.8 px/frame, rising |
| 切 freeze | the card's horizontal drift over the loss: 0 px vs the squash's ≥ 4 | frozen 66/66 frames |
| 切 snow | the light at the collapse's end: rows 1.00, columns 1.00 | no squash, strength 0 |
| 切 bars | each row steps 5 px from the one above (squash 0), then black | shear 5.73, 13/13 blank |
| 切 neg | the collapse opens inverted, r −0.48 against the loss's last frame, then black | 6 negative frames, then 7 black |
| 切 vline | the light's extent, rows 0.94 against columns 0.15 (a line down) | sx 0.075, sy 1 |
| (squash, the reference, both textures) | rows 0.55/0.55, columns 0.99/0.88 (a line across); first collapse frame r 0.54/0.29 | — |
| 残 burn | the dead tube still carries the last picture: r 0.99 (squash −0.01) | afterglow 0.198 |
| 焼 | (off − on) against imprint × picture, glass coordinates: median r **0.989** (54 still frames), **0.563** on 37 frames rolled ≥ 12 px, against **0.330** for an imprint rolled with the picture | depth max 0.173 |
| 焼 legibility | at its deepest (k 0.18), median hold SSIM 0.8828 burned vs 0.9149 not (gate ≥ 0.9×) | — |

**The kill run.** `--kill` swaps in a `zk-picture.js` whose `lockLevels`, `glimpseLevels`,
`exitMode`, `burnDepth` and `walkAt` render everything as the default. **All 21 variant checks
fail by name**, each on its image and, where it has one, on its cause. The only ✓ in that run
is the burn-legibility guard, which trivially holds with no burn.

### The P2 battery, re-run

| gate | result |
|---|---|
| render | GREEN: all 15 kinds move their metric |
| draws | GREEN: archetypes −2.9 % … +3.5 %, uncommon 0.1666, seen-before **9.03 %** (unchanged: the P3 draws are last) |
| legibility | GREEN: median **0.7380** vs rc.91 0.7069 (P2 read 0.7479); 0/48 buried; **48/48** surface, worst window 0.70 s; 遠/嵐 at sev 1 **24/24**, worst window 0.90 s |
| perfp1 | GREEN at load 11. Drawn dpr 1 mean **1.563** ms (rc.91 1.252 in the same run; P2's critic read 1.597), dpr 2 **1.948** (rc.91 1.346); p99 4.5 / 5.1 against rc.91's 4.4 / 5.2; worst archetype 1.577. The first run, at load 30–37, read 2.616 on dpr 2 (rc.91 1.78 in the same run) and was re-run. |
| crack | GREEN |
| lull | GREEN, 7/7: 24/24; lull off 13/24; incidence 21.0 %; gap CV 0.734 |
| phases | GREEN (above) |

`p3render`'s own step costs: defaults 1.317 mean / p95 3.5 ms; variants 1.276 / 3.5 ms, burn
included. The legibility dropped 0.01 from P2 (0.7479 → 0.7380): the 即 lock-ins that settle
into the head of the hold (fade, roll, bars, bloom, ghost, 0.3–1.6 s) and the extra texture
draws they take.

---

## Decisions (the owner was not available)

1. **Entry effects may settle into the head of the hold.** The windows are the receiver's (0.4 s
   for 即). A lock-in that settles for 0.3–1.6 s after the audio opens is drawing inside the
   hold window, not moving it; `bounds` shows no boundary moved. Without it, a 0.4 s window is 12
   frames, and every lock-in reads as a snap.
2. **The fade dims the picture as well as snowing it.** A carrier that weak is a weak video
   signal too. With snow alone, a clean station's fade was invisible: the image moved 1.97
   against a floor of 3.44.
3. **No-carrier snow is the tuner's, at full gain.** This is a P1 regression, found through the
   dissolve exit and the hunt, and fixed and declared under §11.4. The hold is untouched, so no
   legibility calibration moves.
4. **Burn-in is wear (darkening), not light.** Worn phosphor gives less light where it was
   bright, and that is what burn-in physically is. It sits on the glass. Depth was capped at 0.18
   after 0.28 cost a tenth of the hold SSIM.
5. **The afterglow is added at the dead tube's persistence rate.** Added at full level every
   frame, it piled toward ×9 (glowA / 0.11) and put the whole picture back on a dead tube. The
   first strips showed this; it is fixed.
6. **A night burns on its own fork, `"set:burn"`.** "On some nights" (§3.4) is a property of the
   set, like the crack. P4's `"set:tube"` may absorb it; forks consume nothing from the master,
   so moving it changes no other stream.
7. **Rarities are set by the pools' weights, not tiers.** Tiers proper are P4's. Today: vline
   1 in 86; burn exit 5.6 %; freeze 10.5 %; burn-in 15 %.
   - §4.3's "freeze with the burn-in of the previous reel" (very rare) happens today at about
     freeze × burn-in ≈ 1.6 %. That is more common than §4.3's 1 in 80.
   - P4's tier draw should thin it.
8. **The 切 image checks use signatures, not block distances.** rc.91's loss slips its hold and
   tears at random, so two textures of the squash differ by whole rolls at the head of the
   collapse, and a block metric's floor swallowed every variant. Each loss is instead read off
   the frames by its own shape: image-derived roll and drift over the loss, the light's extent
   at the collapse's end, the negative's inversion, and the rows' shear step. The squash, on
   both textures, must read as a line across and must fail every other signature.

## Open items

1. **The drawn 反 echoes sit mostly under 2 px** (the first echo is 1.5–5 px). The walk-down
   check had to pin one echo at 12 px to see it (as §6.3.2 pins every kind). By eye, a
   multipath drift-in's walk-down is subtle on short-delay echoes.
2. **P4.**
   - The tiers (see Decision 7).
   - Whether `"set:burn"` folds into `"set:tube"`.
   - An LFO-locked hum and AGC could lock the bloom's pump too.
3. **The burn's frame memory only records reels**, as at P2, so on the bench card-only nights
   the first imprint is always the card.
4. **Carried from P2:**
   - the two exempt 嵐s;
   - 遠·cal·5 on the 0.6 s line;
   - the force hook's comment;
   - the 4,000-lull cap;
   - `picture-crack-ab.js` desyncs under load;
   - WebKit is unrun (QF's).
5. **One probe run hung** (`p3render --kill`, 20 minutes at zero CPU, cause unknown). I stopped
   only my own two processes and their Chromes. I ran everything after that under a `perl alarm`
   time limit.

## Re-run

```
cd /Users/tysonwelsh/Sites/municipal-sky-site-picture2/art/zankyo
node _picture-probe.js bounds --out <dir>             # GREEN: 436 boundaries = rc.P4, = rc.91 but P1's 11 断
node _picture-probe.js p3draws --out <dir>            # GREEN (node only, ~20 s)
node _picture-probe.js p3render --out <dir>           # GREEN
node _picture-probe.js p3render --kill --out <dir>    # RED, all 21 by name (the gate can fail)
node _picture-probe.js p3sheets --sheets handoff/picture-sheets --out <dir>
node _picture-probe.js p2 --out <dir>                 # the P2 battery (run lull/phases alone under load)
```

Bench: `picture-lab.php` force field, for example `{"entry":"roll","exit":"vline","glimpse":"bars","burn":0.18}`.

## The strips (`picture-sheets/`, texture 21, each row one variant forced)

- `P3-entries-即.jpg`: the six lock-ins on bbc1, 0.05–1.5 s.
- `P3-entries-浮.jpg`: fade, roll, bars and ghost drifting in on a 遠 (sev 0.6), 0.6–8.9 s.
- `P3-glimpses-探.jpg`: 今's glimpses and the four modes, through three glimpses.
- `P3-exits-切.jpg`: the seven 切 losses on bbc1, from the loss to the dead tube.
- `P3-exits-残.jpg`: squash, snow, freeze and the afterglow on john-cage.
- `P3-burn-焼.jpg`: no burn and k 0.18 (the last reception's imprint) with roll dropouts.

By eye, every row reads as its cause, and every picture is on the green ramp.
