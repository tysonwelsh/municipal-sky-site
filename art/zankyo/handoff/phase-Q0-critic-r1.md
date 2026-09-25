# Q0 — critic's handoff, round 1

Branch `zankyo-picture`, head reviewed: `6f86d3c` (rc.95). Written 2026-09-24.
I did not write this code. Every number below is my own run, not the coder's.

**Verdict: NOT PASSED.** The coder's head-gap gate is real: it fails on rc.91
and passes on rc.95 with my seeds. But rc.93 (decoded reels by default) and
rc.95 (auditions never share the air) each bring in a new unintended
behaviour that the gate cannot see. The owner will see or feel both on the
first evening of pressing 受信:

- the picture drifts away from its sound;
- a press of 受信 can do nothing for up to 27 s.

A third fault, 切 exits that last 11 s on the fallback path, is older than
Q0 but lives in the plan rc.92 re-based. Six numbered items follow.

## What I ran

Headless Chrome over CDP, the real page, the real reels, served through the
coder's `tools/range-proxy.js`. rc.91 was served from `git archive 842e155`
on :8062 behind a second range proxy on :8065. Each run was 600 s. The
machine's load average was 26–37 throughout. Captures are in the session
scratchpad (`critic/`) and are not committed.

| run | build | mode · seed · network | receptions + auditions |
|---|---|---|---|
| h-press-101 | 6f86d3c | press 101 · local | 5 + 8 |
| h-nat-8891 | 6f86d3c | natural 8891 · local | 5 + 0 |
| h-press-555-host | 6f86d3c | press 555 · host profile | 7 + 6 |
| b-press-101 | 842e155 (rc.91) | press 101 · local | 5 + 16 |

New instrument, committed dev-only: `tools/rx-critic.js`. It injects the
coder's `rxrec.js` unchanged, so `_rx-probe.js analyze` reads its runs too.
It also records every 受信 press (what `dial()` returned and the broadcast
state at that moment) and the set's phase. It reads three things the
head-gap gate does not:

- **press answers:** how long until a reel was audible;
- **lip sync:** in decoded mode, the picture element's position against the
  sound's position (from `desc.head`, integrated at the piece's rate), on
  settled pieces only;
- **bus chops:** places where the head is loud, the envelope is open and
  nothing is scheduled, but the bus falls below 15 % of its median
  bus/head ratio.

I checked that each reading can fail:

- **Press answers.** rc.91 gives 0 dead presses and rc.95 gives 7.
- **Lip sync.** It separates cleanly: some rc.95 broadcasts sit within
  ±40 ms, and every audition is 0.2–4.6 s off.
- **Bus chops.** I zeroed the bus for 120 ms inside a hold in a copy of
  h-nat-8891, and it reported `BUS CHOPS 1: @9.95s 123ms`.

## The coder's gates, re-measured

- **`_rx-probe.js analyze`, rc.91 b-press-101:** **FAIL, 30 unintended.**
  That breaks down as 9 head gaps, 8 conflicts, 5 wrong reels, 4 splices,
  3 late starts and 1 stall, with 71.6 s of unintended silence. The gate can
  fail.
- **`_rx-probe.js analyze` on my three 6f86d3c runs** (17 receptions + 14
  auditions, 14 shapes): **PASS, 0 unintended, 0 console errors**, 0
  fallbacks, 334 of 9894 tap callbacks missed. This matches the coder's
  claim on seeds they did not use.
- **Bus chops on 6f86d3c:** 0 over 30 receptions. Nothing downstream of the
  head chops. That part of the owner's complaint is fixed as far as the
  graph goes.
- **`_harness.js 1800 3042`:** PASS. REPRO is identical, there are no
  errors, and peak concurrent sources are 94.
- **`_far-identity.js 1800 20 869c855` on 6f86d3c:** 18/18 home nights
  byte-identical, and both departed nights (17 and 101) identical in notes
  and events. rc.93–95 do not move the music beyond rc.92.
- **rc.92 re-base:** it is declared in the commit body, with the isolation
  run. Accepted in principle, but see item 3: the same path still needs
  another fix.

## Required items

1. **Lip sync is broken on the default path (rc.93).** In decoded mode the
   sound is a BufferSource on the audio clock and the picture is a muted
   element started by a timer. Nothing ties them together afterwards.

   Measured, picture minus sound:

   | runs | receptions more than 150 ms off for over 10 % of the hold | worst median offset |
   |---|---|---|
   | 6f86d3c, local + host | 26 of 30 (13/17 broadcasts, 13/13 auditions) | −3.6 s on a broadcast (usaf-power-of-decision, t0 4.5, all 31 s of its hold); −4.6 s on an audition (host) |
   | coder's r93 force 17, local | 18 of 18 | −4.2 s (worst single point −6.4 s) |
   | coder's r93 natural 7, local | 6 of 8 | −3.0 s |

   There are two causes.

   **(a) The audition loads its element at the cue.** In decoded mode,
   `build()` sets `v.src` at `t0 + HP[0].cueAt` (zk-broadcast.js:3013),
   0.2 s before the sound starts. The load and seek take 0.2–1.1 s locally,
   and the picture never makes that time up. Trace, p95-press-3042,
   co-y2k: `set:src` at 47.200, `seeked` at 47.419, sound at t0 47.401;
   the picture runs 438 ms late for the whole audition.

   **(b) Broadcasts drift during the hold.** The element's clock ran at
   about 0.93× the audio clock with readyState 4 and no `waiting` event
   (r93-natural-7, za-cvet: 2.1 s behind after 28.9 s). The audio clock
   matches wall time to 1.0000 on every run, so the element is what slows.
   Whether Safari does the same on the owner's loaded laptop is unmeasured.
   A resync makes that question moot.

   **Required:**
   - Thread the audition's element (src and seek) while its decode runs,
     and start the sound only once both are ready.
   - Resync every decoded reception's picture to its sound. The element has
     no voice, so a `playbackRate` nudge or a seek cannot be heard. The
     glide's 0.5 s lane tick (:2612) shows the pattern.
   - Add a lip-sync gate to the probe (fold in rx-critic's reading, or use
     it). Proposed: |picture − sound| ≤ 120 ms on ≥ 95 % of every settled
     piece, local and host-throttled. Show it failing on 6f86d3c.

2. **A press of 受信 can do nothing (rc.95 against the rc.77 owner rule).**
   The owner's words at rc.77 were "play a clip 100% when pushed right when
   pushed". `airClash` now refuses an audition whenever the audition would
   run into an armed broadcast's static lead, and the press gets "live"
   (zk-broadcast.js:1984). Nothing plays, the lens stays dark and the tube
   gives one flicker.

   Measured, counting presses made while no broadcast was live: **7 of 44
   presses on 6f86d3c were followed by no reel for 6.0–26.7 s**
   (h-press-101 @188.4 wait 16.7 s, @260.7 26.5 s, @435.3 13.9 s;
   host @208.8 26.7 s, @369.2 6.0 s, @412.1 8.4 s, @539.3 26.2 s). Three of
   them returned **"audition"**: the late decode landed and `build()` then
   refused it at :2968, so the press looked answered and was not.
   rc.91 on the same seed: **0 of 25**. Every non-live press was answered
   with a reel 1.0 s later.

   **Required:** keep the fix for two stations at once, and answer the
   press.
   - Fit the audition into the room before the broadcast's static lead:
     shorten its hold and exit. The audition takes no engine draws, so
     this costs no identity.
   - Only where there is too little room (define it; I suggest < 4 s of
     hold) may the press be left to the broadcast. Then the broadcast must
     be close, with t0 − press ≤ 6 s.
   - A late decode that no longer fits is re-fitted, not dropped.
   - Gate: no press made while no broadcast is live waits more than 6 s for
     a reel, local and host (rx-critic's press reading). Show it failing on
     6f86d3c.

3. **The fallback hold keeps the 残's exit length under a 切 label.**
   `planOne()` (:538) hard-codes `exit: "setsu"` but takes whatever `exitS`
   it is given. The fallbacks pass the shape's own exit, which for 残 is
   6–12 s. `planOneFit` (:529) then fits the hold against
   `min(exitS, EXIT_MAX_COST_S)` = 3 s, so the exit runs off the window.

   Measured: the inside-tibet audition (h-press-101, t0 403.6) is labelled
   即常切, but has exitS 11.0, span 20.0 on a 12 s window and overrunS 8.0.
   That gives **8.0 s of band static in place of the reel at env 0.86**.
   The probe counts it as intended because the page declared the edge.

   **Required:**
   - A fallback that says 切 is a 切: `exitS` comes from a value already
     drawn in the 切 range.
   - Or it stays 残, and the fit counts the audible part of the exit
     (the 75 % and 44 % stretches).
   - For broadcasts this moves the plan on exactly the rc.92 re-base path.
     Declare it in the same way, and move the identity pin to Q0's final
     head.

4. **The edge fade hides seconds of lost station behind "intended".** 4 of
   31 receptions on 6f86d3c spent 5.2–8.0 s with the reel faded out and
   band static carrying an envelope at 0.81–0.86:

   | reception | kind | shape | static |
   |---|---|---|---|
   | jp-kagakueizo | audition | 即常残 | 5.2 s |
   | inside-tibet | audition | see item 3 | 8.0 s |
   | tvtupi | audition | 即常残 | 6.3 s |
   | cn-tv-set-ads | broadcast | 即常残 | 6.9 s |

   The fade beats rc.91's jump cut or end-of-file silence. But a 残 is the
   *station* lingering, and here the station is gone for its whole linger.

   **Required:**
   - The probe reports **faded seconds under env ≥ 0.5** per reception and
     per run, as a number rather than as "intended".
   - **Auditions:** 0. Their in-point and hold are free (sampleTune's
     `need` uses the exit capped at 3 s; count the audible exit instead).
   - **Broadcasts:** bounded. I propose ≤ 1.0 s per reception, or a
     declared re-base where choose() counts the linger. The coder decides
     and writes down why.

5. **The default path is unmeasured in the owner's browser, so it needs a
   way down.** rc.93 makes decoded reels the default with `route=stream`
   and `capture=on`. The only WebKit evidence is the rc.48 crew's `?bt=1`
   run, which used a different route, no capture, and the pool as it was
   then. If `decodeAudioData` rejects a reel in Safari, every reception of
   it becomes the gagaku. The owner will be listening in Safari when this
   is published.

   **Required:**
   - A decode failure demotes the page to element mode for the rest of the
     session. This is possible because in decoded mode no element has ever
     been given to `createMediaElementSource`. Count it in `stats` and write
     it to the console once.
   - Prove it with a probe run that injects a rejecting `decodeAudioData`:
     0 gagaku fallbacks after the first, and every later reception sounding
     through its element with the gate at 0 unintended.
   - As supporting evidence, run `afconvert` (AudioToolbox, the decoder
     WebKit uses on macOS) over all 252 reels and report any that fail.

6. **Docs and pins.**
   - PLAN-SIGNAL-PICTURE §10 still tells later phases to pin
     `_far-identity.js 1800 20 5de3d45`. Update it, and the coder's
     IDENTITY_PIN, to Q0's final head once items 3–4 have settled what the
     re-base is.
   - State in the handoff which Q0 commits each later phase's identity must
     match.

## Not required, noted

- **The bench can seat over an armed broadcast** (coder's open 3).
  Bench-only, and now written up. Fine to leave for QF.
- **Broadcasts at a file's head (inS 0):** the picture leads the sound by
  about 110 ms (john-cage, p95 t0 170.7). `cuePos` clamps at 0, so the
  element starts CUE_LEAD_S early. The resync in item 1 absorbs it.
- **Decoded-reel memory on a phone** (coder's open 4): still unmeasured. QF.
- **The designed drops:** 3–24 % of each reception's presence is ducked
  (median about 8 %; the worst is a 戻 at 24 %). This is by design and I am
  not asking for a change. If the owner still hears "chopping" after this
  phase, the dense-drop receptions (a 残 or 戻 with drops packed at 0.24 s
  steps) are the next place to listen.

## Left running

- `php -S 127.0.0.1:8062`, serving rc.91 (`git archive 842e155`) from the
  session scratchpad.
- `node tools/range-proxy.js 8065 8062` in front of it, for the A/B.

Kill both once they are no longer needed. The coder's proxy on :8063 is
still up.

To re-run my readings:

    node tools/rx-critic.js run --seed 101 --secs 600 --mode press --port 8063 --out DIR
    node tools/rx-critic.js analyze DIR …
    node _rx-probe.js analyze DIR …      # the same captures, the coder's gate
