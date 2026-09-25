# P4: coder's handoff, round 1

Branch `zankyo-picture-final`, worktree `/Users/tysonwelsh/Sites/municipal-sky-site-final`.

| commit | what | VERSION |
|---|---|---|
| `f2f4ddb` | P4: coherence, tiers, the night's tube; probe on rc.104's tube by default; `tools/picture-p4.js` | `2.1.0-rc.F1 — the tube is aged differently every night …` |
| (this file) | the handoff and six sheets | dev-only |

**Server.** :8091 was up, but its cwd is another session's scratchpad (`…-far/…/pin-before`), so it
serves that session's tree, not this one. I left it alone and served this worktree on
**:8097** (`php -S 127.0.0.1:8097 router.php`). `tools/picture-p4.js` defaults to :8097.

**Owner rulings kept.**
- No identity, REPRO or `_probe.js` runs, and no long recordings.
- `zk-broadcast.js` changes only inside startSignal's `desc` literal (+7 lines, reads only).
- §11.3: no text was added. No VFD line or log line names anything.

## What landed

**和 coherence (§5.3, `zk-picture.js` `coherence`/`cohere`).** The descriptor now carries
`band`, `flutter`, `grit`, `lfoHz`, `d` (`getFar().d`, 0 at home) and `genPic` (the manifest
`picture` of an audio-only reel).
- 帯 rolls at lfoHz. A row darkens once per LFO period, and the dark bar crosses mid-frame at the
  audio gain's trough, because both run from t0 on the reception clock `S.re`. Above 1.2 Hz the
  hum draws two bars a field, so the roll is halved.
- 飽's pump runs at lfoHz, in phase with the audio. A fluttering echo swings at lfoHz; a
  co-channel echo swings at lfoHz / 3.
- **Decided: the carrier also breathes at lfoHz** (±0.02–0.05 strength, scaled by flutter). 帯 and
  飽 are on only ~20 % of receptions. Without this, "the picture breathes with the sound" (§5.3)
  would reach almost nobody.
- flutter scales echo-flutter depth (×0.6–1.4). Above ½ it also gives still echoes a flutter.
- grit scales 点's burst rate ×0.4–1.6.
- A narrow band (above ½) lengthens 滲's ringing and softens the beam up to 0.9 px. Above 0.65 it
  adds a light 滲.
- At the knobs' rest (0.5), only lfoHz and d move anything.
- **A descriptor without the reads draws byte-for-byte as rc.104.** This covers the bench, the ♪
  audition and every fixture.

**稀 tiers (§4.3).**
- Rare and very rare come off the **top** of rc.104's tier draw, so every uncommon reception is
  still uncommon.
- Where the draw lands in its band picks the variant, so no draw is added.
- rare = storm (嵐) · negflash (過, sync crushing 0.35–0.65/s, neg exit where the shape allows) ·
  otherreel (混, the last reel at depth 0.3–0.4, sliding slowly) · syncbar (a clean catch rolling
  0.12–0.32 frames/s with its blanking bar)
- very rare = takeover · freezeburn (freeze exit over a 0.16 burn) · vline
- Far d widens the bands (unc ×(1+0.5d), rare ×(1+2d), vrare ×(1+3d)) and lifts 嵐, 同 and 混 by
  ×(1+d).
- genPic picks the archetype: static → 遠/嵐 (3:1), line → 同, wave → 同 with 捩.
- A forced archetype on the bench stays rc.104's unless the bench also forces `{rarity}`.

**管 the tube (§3.4, owner §11.1).** Drawn once a night on `set:tube`.
- gamma 1.2–1.45.
- Tint: red and blue scaled by ±0.45·tint, each capped under green, and **each stop's hue clamped to
  100–158°**. The near-white top otherwise leaned to 69°, a yellow.
- persistence ±20 %, re-deriving every decay.
- focus −0.35…0.7 px. A soft tube blurs the sharp raster; a sharp tube tightens the bloom.
- Keystone ±2.5 % and pincushion ≤ 2 % are applied per glass row at 192×144, so the shape stays on
  the glass while the picture rolls. Tilt is ±0.45° with just enough overscan.
- A dim band appears on 30 % of nights.
- `_dev.tube()` returns tonight's tube, `_dev.tube(n)` gives night n's, `"base"` gives rc.104's.
  `ZK_SET_DEV.tube = "base"` does the same from the start.

**The takeover (very rare).** The picture holds perfectly (清, no echoes, smear, swell or lull) until
40–60 % of the piece.
- The other station rises under ours at 0.3, through the carriers' beat stripes.
- It then takes the picture over 3–5.5 s: ours sinks to nothing and its sliding sync slows into
  lock.
- It stays taken through the loss.

## Measured (`tools/picture-p4.js`, all PASS)

- **draws** (20 000 per night kind):
  - home: uncommon 0.1706 (want 0.1667), rare 0.0404 (0.04), very rare 0.0114 (0.0125).
  - d 0.9: 0.2466 / 0.1109 / 0.0457 (want 0.2417 / 0.112 / 0.0463).
  - All 7 variants appear on both.
  - Home archetype shares stay within ±25 % of §4.1: 清 0.084 (+20 %), 嵐 0.058 (+16 %).
  - The locks are exact on every drawn reception (帯 735/735, 飽 397/397, 影 854/854).
  - 2000 nights' ramps: hue 99.5–158.6°, with green the largest channel at every lit step.
- **hum** (the gate: "the measured period matches lfoHz within 10 %"), measured off the picture's
  mid-frame luma:
  - lfoHz 0.5: 1.980 s against 2.000 s (1.0 %). Dark bars land on the audio trough (0 ms).
  - lfoHz 2.4: 0.417 s against 0.417 s (0.0 %). 20 bars, worst 13 ms from the trough (a frame is
    33 ms).
- **perf** (dpr 2, 8 s holds, load ~4.5): mean frame cost 1.40–1.71 ms against the 2.5 ms budget.
  Soft focus costs about +0.15 ms. Worst-frame spikes of 6–20 ms hit the base tube too, so they
  are machine load.
- **live page** (`?far=0.9`, PLAY then 受信): the reception's character carried
  `fade.hz = 2.383`, the receiver's lfoHz. No P4 errors. The one console.error is the manifest's
  "29 TUNED reel(s) have windows of differing length", which is pre-existing and belongs to the
  broadcast session.
- **`_picture-probe.js p3render`:**
  - rc.104's tube: **GREEN**.
  - The night's tube (seed 3042, persistence ×1.14): **RED on the 切 squash reference only**. Its
    lit rows read 0.58 where the check's edge is 0.55 (C ≥ 1.6 R). The check already sits exactly
    on its edge on rc.104's tube (0.88 vs 0.88).
  - Decided: the probe now runs rc.104's tube by default and `--tube-night` opts in. Its gates
    measure receptions; the tube has its own instrument.
- On the night's tube, 残 burn's colour check passes at its limit (2/27 instants, excess 19 pts at
  13 s on the dead tube). Worth a look by eye.

## Sheets (`handoff/picture-sheets/`)

- `P4-tubes.jpg`: rc.104's tube and eight nights' tubes on one clean frame. The tint drifts from
  yellow-green (nights 1, 8, 21) to sea-green (nights 2, 3, 13), always green.
- `P4-hum-lfo-0.5.jpg` and `P4-hum-lfo-2.4.jpg`: the same 1.2 s at both rates, each tile captioned
  with the audio gain. The slow bar drifts; the fast one passes about 2.4 times a second.
- `P4-rare-takeover.jpg`, `P4-rare-syncbar.jpg` and `P4-rare-otherreel.jpg`: the takeover goes
  from ddr1 to the last reception's bbc1 card between 4.3 s and 7.3 s.

## Open for the critic

- The dim band is subtle (depth 0.1–0.26). None of the eight sheet nights shows it clearly; night
  13 has one at 14 %, under the caption.
- The `P4-hum` strips are small tiles. The bar reads better at full size, e.g.
  `tools/picture-frames.js` with `--force '{"impairment":"帯","sev":1}'` (though that tool does not
  pass lfoHz).
- The ♪ audition does not carry the reads, by the stage rule (startSignal only), so it draws
  exactly as rc.104.
