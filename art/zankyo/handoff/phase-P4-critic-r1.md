# P4: critic, round 1

Branch `zankyo-picture-final`, reviewing `f2f4ddb` (rc.F1, the visible change) and `3a49c90` (the
coder's handoff and sheets). Served on **:8097** from this worktree (`php -S 127.0.0.1:8097
router.php`); :8091 serves another session's tree and was not used.

**Verdict: PASS. Signed off in round 1, with no required items.** The green commit is `f2f4ddb`
(`3a49c90` and this file are dev-only on top of it).

Owner rulings kept (2026-09-24/25): no identity, REPRO or `_probe.js` runs, and no long recordings.
Everything below is a short run, under a minute each.

## What I checked, and how

**The descriptor (`zk-broadcast.js`, +7 lines).**
- The edit is inside startSignal's `desc` literal only.
- Every field is a read of something already in scope:
  - `band`, `flutter` and `grit` are the layer params read at line 2665;
  - `lfoHz` is `a.lfoHz`, the same value the AM oscillator is set to at line 2712;
  - `d` comes from `Z.getFar()`, guarded the way line 2174 guards it;
  - `genPic` is the manifest's `picture`. All 36 audio-only reels carry it (22 line, 10 static, 4
    wave), and no video reel does.
- Nothing is drawn or written. arm(), fire() and the 受信 shapeLine are untouched.

**The forks.**
- `set:tube` is a label fork of the master seed. PJ2's `fork()` derives from the original seed
  (pj2-rand.js:55), so the crack, the idle and the burn forks are unchanged.
- On the page, `?seed=146` gave the same tube as my node draw of `Rand.stream(146).fork("set:tube")`.

**§11.3, the VFD names nothing.** No added line in zk-set.js, zk-picture.js or zk-broadcast.js
writes to the console, the VFD, `textContent` or `innerHTML`.

**`node tools/picture-p4.js draws`: PASS.**
- Home tiers are 0.1706, 0.0404 and 0.0114. At d 0.9 they are 0.2466, 0.1109 and 0.0457.
- All seven variants appear on both.
- genPic: static gives 遠 or 嵐, line gives 同, wave gives 同 with 捩.
- The 帯, 飽 and 影 locks hold on every drawn reception.
- Across 2000 nights, the ramp's hue stays within 99.5–158.6°, with green the largest channel at
  every lit step.

**`hum`: PASS.** 1.0 % off the LFO at 0.5 Hz and 0.0 % at 2.4 Hz, against a 10 % gate. The dark bars
land 0 ms and 13 ms from the audio trough.

**`tubes`: PASS.** Nine tubes, every ramp inside 100–158°.

**`_picture-probe.js perfp1 --tube-night` (the night's tube, not rc.104's): GATE GREEN.**
- Worst archetype mean 1.42 ms. Drawn means are 1.24 ms at dpr 1 and 1.47 ms at dpr 2.
- p99 is 2.7 ms at dpr 1 and 4.2 ms at dpr 2.
- Worst single frames are within what rc.91 shows under the same load (loadavg 3–5).

**By eye, at full size on the real page with the glass, crack and casing** (headless Chrome,
frame-stepped):
- `P4-critic-tube-n146.jpg`, the most-skewed night I found in seeds 1–400: tilt −0.40°, keystone
  2.2 %, pincushion 1.9 %.
  - The raster stays on the glass, and no corner or wedge of black shows.
  - The dark strip down the upper right edge is the reel's own. It is the same on rc.104's tube
    (`P4-critic-tube-base.jpg`).
- `P4-critic-tube-n132.jpg`, the deepest dim band in 400 nights (depth 0.25 at 46 %). The tint is
  yellow-green, and the band is just readable across the right half if you look for it.
- `P4-critic-tube-n196.jpg`, the softest focus (0.70 px, tint +0.75). It is soft but still a face,
  and still green.
- `P4-critic-hum-full.jpg`, 帯 at sev 1 in full frames:
  - top row: lfoHz 0.5 at 1.0, 1.5, 2.0 and 2.5 s;
  - bottom row: lfoHz 2.4 at 1.0, 1.1, 1.2 and 1.3 s.
  - The broad dark bar moves through the frame at the two speeds. It is soft, as mains hum is.
- The coder's sheets: the eight nights' tubes read as the same set aged differently, from lime to
  sea-green, never amber, white or blue (§11.1).
  - takeover: ddr1 holds clean, then the bbc1 card comes up through the stripes and locks.
  - syncbar: a clean catch rolling slowly, its blanking bar crossing.
  - otherreel: the last reel plainly under ours.
  - Each one looks like the physical failure it is named for (§2.1).

**Robustness.**
- On the first reception of a session, the takeover and otherreel draw their other station from
  `xtImage("mem")`, which falls back to the test card when there is no memory yet. So a very rare
  draw on the first reception still has something to show.
- Page errors: none from P4. The one console.error is the manifest's pre-existing "29 TUNED reel(s)
  have windows of differing length", which belongs to the broadcast session.

## The coder's open questions, ruled

1. **`_picture-probe.js` on rc.104's tube by default: accepted.**
   - Its gates measure receptions, and they were calibrated on that tube.
   - The squash reference going to 0.58 against 0.55 on a ×1.14-persistence night is the longer
     phosphor leaving more light, which is the tube behaving as §3.4 asks. It is not a fault in the
     exit.
   - The tube has its own instrument (`tools/picture-p4.js tubes`), and the perf gate above was run
     on the night's tube.
2. **The 残 afterglow colour at its limit on the night's tube: not required.** It is 2 instants of
   27, at 13 s on a dead tube, and it passes. On the frames I looked at, nothing off-green shows.
3. **The dim band is subtle: fine as is.** §3.4 says the tube's ageing is subtle. At its deepest it
   is readable if you look, and invisible if you don't, which is what a tired capacitor looks like.
4. **Small P4-hum tiles:** covered by `P4-critic-hum-full.jpg`.
5. **The ♪ audition without the reads:** correct under this stage's rule (startSignal only). An
   audition draws as rc.104 did.
6. **The manifest console.error:** not P4's. It belongs to the broadcast session and to QF's list.

## Advisory (not required; for P5 or QF if anyone wants them)

- The VERSION line is long for the footer. The orchestrator renumbers at merge anyway, and could
  trim it then to something like "the tube ages differently each night; the picture breathes with
  the sound; rare receptions".
- `tools/picture-frames.js` does not pass lfoHz. P5's owner sheets would read better if it did.
- The takeover's "other station" is the frame memory, the last reception. If the last reception was
  the same reel, the takeover is the same picture sliding over itself. That needs very rare × a
  repeat, and it still reads as a signal fault.
