# Q0: final handoff (audio reliability)

Branch `zankyo-picture`, final build **rc.97** (`d1f3ea2`), 2026-09-24. The
owner stopped the long test cycle, so the numbers are quick checks only.

## What the chop was, and what fixed it

- **Round 1 (rc.92–95).** A reception's sound dropped out, doubled or jumped.
  Causes: an audition borrowed a broadcast's video element; one press built
  two auditions; elements were reused out of order; pre-roll and 残 ran reels
  off their windows; relock seeks landed late; drops fought each other; and
  Chrome's media elements underran under load. Fixes: separate elements,
  correct handover, a pre-roll that reaches the in-point on time, and above
  all **decoding each reel's sound ahead of time** (`reels=buffer`, the
  default since rc.93), which removes element underruns from the sound.
- **Round 2 (rc.96).** The audition's timers ran on the main thread and
  drifted from the audio clock under load (20 s silences), so they now run on
  the audio clock. `picSync` keeps the decoded picture on its sound, and a
  press can no longer do nothing.
- **Round 3 (rc.97).** Two things rc.96 added went wrong under load:
  - **Frozen picture.** `picSync` sought before its last seek had landed. It
    now never seeks while a seek is in flight, seeks only when the picture is
    off by more than 2× the measured landing time (at most twice per piece),
    and closes smaller offsets with brief speed changes of at most 20 %.
  - **Lost press.** On a slow connection, a press was accepted and then
    dropped when its reel arrived too late. The audition is now fitted to the
    room left after the reel arrives, using the measured fetch and decode
    speed. Otherwise an already-decoded reel answers the press (a stand-in,
    or a rescue at 4.5 s).

## Declared re-bases (music identity)

rc.92 (`planOneFit`) and rc.96 (the exit cost of 残, the fallback's exit
label). **IDENTITY_PIN = `302cb0a`.** rc.97 adds none: `_far-identity.js
600 8 302cb0a` gives 6/6 home nights, and both departed nights are identical.

## Quick checks on rc.97 (load average 41–84)

`node --check` passes; `_harness.js 600 3042` PASS, REPRO identical. Real
playback via :8063, press 2024 local 180 s, 777 host 180 s, 2024 local 150 s:

- unintended gaps, stalls, splices, conflicts and bus chops: **0**;
- dead presses **0**, `audLate` **0** (14 presses; the slowest answer 4.5 s);
- picture frozen: 1.1 % and 0.0 % (rc.96: 14.4 %). 2 of 12 pieces were over
  the 5 % gate, at 0.7 s each;
- lip sync: 3 of 3 pieces within 120 ms in the A/B run. In the 180 s runs (at
  a load of about 55, seeks landing at p50 0.6 s), 6 of 9 pieces missed the
  gate, with medians −240 to −430 ms.

An alternative picSync (rc.96's loop plus seek guards) did worse; dropped.

## Still open

1. **Lip sync under heavy load.** When seeks take 0.6–2 s to land, the picture
   can sit 0.25–0.4 s behind its sound for a piece. The sound is unaffected.
2. **Safari/WebKit is unmeasured.** Nobody has checked whether it keeps
   playing the muted, hidden picture element.
3. **Slow 4G (180 KB/s).** Presses can wait more than 6 s.
4. Carried over: snow for a stalled picture (zk-set.js), §11.3 reels
   overrunning on far nights, force-mode overlaps, phone memory.
