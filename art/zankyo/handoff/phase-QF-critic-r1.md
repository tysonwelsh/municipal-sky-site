# QF: critic, round 1

Branch `zankyo-picture-final` at `b1b32f9`. The visible commit under review is `e54c62c`
(rc.F2). This file is dev-only. It was checked on :8097, which serves this worktree.

Owner rulings kept (2026-09-24/25): no identity, REPRO or `_probe.js` runs, and no long recordings.
The whole check took a few minutes of real play in headless Chrome.

**Verdict: signed off. No required items.**

## The fix (e54c62c), read

- `cut()` stamps `sig.cutE`. From then on, `phaseOf()` maps elapsed time onto `spanS + (e − cutE)`,
  so the tube goes straight into its own collapse, burst and dead with rc.91's lengths. It then
  reaches `over`, and `tickSignal` ends the signal. A reception that has not come up yet
  (`e < 0`) is dropped outright. A second `cut()`, or one during the exit, does nothing.
- `signal()` now lets a reception in collapse, burst or dead give way to the next one. Before, that
  press sounded with no picture. By then the reception's sound is over, so this matches what the
  owner hears.
- Both `Z.stop()` sites in zankyo-ui.js are covered: STOP and the 逸脱 switch. There is no other
  stop path in the UI (grep).
- Receiver timings are untouched, and the version bump is in the same commit. The footer shows
  `2.1.0-rc.F2`.

## Re-run myself

**`qf-sweep.js play`, 60 s of natural play on each path:**
- normal path, seed 5117;
- low-power path, seed 3042 (`lowPower: true` was confirmed in the set's state).

Both came back with zero exceptions, zero unhandled rejections and nothing in `onerror`. The only
console error is the manifest's, covered below. Everything else matched the coder's report:
- STOP reads idle within 2.5 s;
- 受信 ×8 gives one reception;
- the rocker and 受信 during a reception hold;
- hiding the tab and restoring it picks up in hold;
- the seed line updates when 逸脱 hunts (5117 → 5163 and 3042 → 3144).

Mean frame cost is 0.8–1.3 ms on both paths.

**The edge trace** (a scratch script with real clicks, seed 3042):
- *STOP at hold, then PLAY and 受信 150 ms later.* The tube went to collapse at +0.4 s, then burst,
  then dead, and was idle at 12.1 s. The new reception drifted in at 14.7 s and held with its own
  picture. The switch-off happened at once, as the owner would expect from STOP.
- *STOP 200 ms after 受信, before the reception came up.* It was dropped and the tube stayed idle.
  The next PLAY and 受信 tuned in and held.

**`qf-sweep.js phone`:** at 390, 375 and 360 px, `scrollWidth` equals the viewport. The full
390 px page renders in one column with nothing clipped. The only element offscreen is the
honeypot, which is placed there on purpose.

**Captures:**
- The idle tube has a thin grey crack with no green glow, round corners and no tape.
- The low-power reception is green, with the crack dark over it.

## Open (not required here, for the orchestrator)

1. **The console.error on every load:** "ZankyoBroadcast: 29 TUNED reel(s) have windows of
   differing length". It is already on the live build: `zk-broadcast.js` at 7649279 has it, and
   this branch does not touch the manifest. It belongs to the broadcast and reels session. QF's
   zero-console-error gate stays red on it alone until that session evens out the windows. The
   owner cannot see it.
2. **The same reel can return after STOP.** This is as the coder reported. It belongs to the
   broadcast session and is minor.
3. **A 1–1.3 s gap after 受信.** The receiver reads `live` for 1–1.3 s before the set leaves idle,
   in both the sweep and the edge trace. This is the receiver's lead-in (dial noise before t0),
   not something this stage changed. I list it only so that nobody mistakes it for a picture
   delay.
4. **Not run:** WebKit, the Q0 gap detector (excluded by the ruling) and the ♪ audition path. The
   same holds for the coder's list.
