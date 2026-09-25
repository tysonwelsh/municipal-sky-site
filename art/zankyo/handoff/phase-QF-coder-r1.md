# QF: coder, round 1

Branch `zankyo-picture-final`. The visible commit is `e54c62c` (rc.F2). This file and
`tools/qf-sweep.js` are dev-only. Served on **:8097** from this worktree (`php -S 127.0.0.1:8097
router.php`). :8091 serves another session's tree.

Owner rulings kept (2026-09-24/25): no identity, REPRO or `_probe.js` runs, and no long recordings.
The whole sweep is a few minutes of real play.

## The driver

`node tools/qf-sweep.js play [--lowpower] [--secs S] --out DIR` runs one headless Chrome on the real
page with real clicks, in this order: idle → PLAY → 受信 → STOP mid-hold → PLAY → 受信 ×8 at 150 ms →
the rocker ×5 and 受信 during the reception → the tab hidden 6 s and restored → 逸脱 on and off →
S seconds of natural play with a press every 30 s.

It logs console errors and warnings, uncaught exceptions, `unhandledrejection` and `window.onerror`,
each tagged with the step it landed in. `--lowpower` forces `hardwareConcurrency` 2, which is the
set's half-rate path. `phone` checks 390, 375 and 360 px for any element past the viewport.

## Found and fixed (rc.F2)

**STOP mid-reception left a frozen picture on the tube, and the next press got no picture.**
- The receiver's `stop()` pauses the reel and cuts the sound, but nothing told the set.
- So the tube kept walking the dead plan on the audio clock. On seed 3042, STOP at 9.5 s left the
  tube in hold until 21.7 s and idle only at 35.1 s: 25 s of a paused frame.
- While it was still "on air", `signal()` refused the next descriptor (never two at once). The first
  受信 after PLAY (t0 17.05 s) sounded with no picture of its own.
- The 逸脱 switch does `Z.stop(); … Z.play()`, so it did the same.

The fix:
- `zk-set.js` gains `ZankyoSet.cut()`. It moves the plan straight to its collapse, burst and dead,
  using the character's own exit and rc.91's lengths. A reception that has not come up yet is
  dropped.
- `signal()` now lets a reception already in its exit (collapse, burst or dead, when its sound is
  over) give way to the next one.
- `zankyo-ui.js` calls `cut()` after both `Z.stop()` sites.
- Receiver timings are untouched, and `cut()` only runs when the station stops.

Re-traced: STOP at 9.52 s, collapse at 9.57 s, idle at 11.91 s, and the next press drifted in at
17.06 s. On the full sweep, STOP now reads idle within 2.5 s, and so does 逸脱 mid-reception.

## Clean

- **Errors:** across both sweeps (150 s and 90 s of natural play, plus the steps) there are zero
  exceptions and zero unhandled rejections, and nothing in `onerror`. The one console.error is below.
- **受信 ×8 at 150 ms:** one reception. It came up and held without errors.
- **The rocker and 受信 during a reception:** no errors, and the reception held.
- **Hidden 6 s and restored:** the reception carried on and the tube picked up in hold. No errors.
- **The seed line:** shows `seed 3042` and updates to `seed 3144` when 逸脱 hunts. With 逸脱 off it
  keeps 3144 until the next PLAY. That is by design (zankyo-ui.js: "the SEED goes back at the next
  PLAY, not now").
- **390 px:** the known overflow no longer reproduces. `scrollWidth` equals the viewport at 390, 375
  and 360. The only element outside is the subscribe honeypot, parked at −9975 px on purpose.
- **The dark and idle tube:** the crack is thin grey with no green glow, the corners are round and
  intact, and there is no tape. The same holds after PLAY and after STOP. On air the picture is
  green, with the crack dark over it.
- **Low power** (`lowPower: true`): mean frame 1.2–1.4 ms. The ordinary path runs at 0.9–2.0 ms.
  Both are within 2.5 ms.

## Open (not fixed here)

1. **The one console.error**, on every load: "ZankyoBroadcast: 29 TUNED reel(s) have windows of
   differing length". It comes from the manifest, which the broadcast session owns. QF's
   zero-console-error gate is red on it alone.
2. **After STOP, the same reel can come back on the next press.** On seed 3042 both receptions were
   `es-nodo-computadores-y-arte-1968`. A reception torn down by STOP seems not to enter the recent
   ring. This belongs to zk-broadcast.js outside startSignal, so the broadcast session owns it. It
   is minor.
3. **Worst single frame, headless:** 45–62 ms, once per run, at the first reception or at STOP
   (decoder start-up). Mean cost is in budget. It was not chased.
4. **Not run:** WebKit (the tools here drive Chrome only), the Q0 gap detector (a long-recording
   battery, out under the owner's ruling), and the ♪ audition path.
