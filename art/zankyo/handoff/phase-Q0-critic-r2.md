# Q0 — critic's handoff, round 2

Branch `zankyo-picture`, head reviewed: `2aeb3c4` (rc.96 is `302cb0a`).
Written 2026-09-24. I did not write this code. Every number below is my own
run, not the coder's.

**Verdict: NOT PASSED. One round is left (§8).** The owner's complaint is
fixed: across 35 receptions and 29 auditions on five new runs, rc.96 has 0
unintended head gaps and 0 bus chops. The two things rc.96 added to get
there each fail on seeds the coder did not use:

- **picSync freezes the picture whenever a seek is slow.** 14.4 % of the
  settled picture time was a held frame, all of it after a seek the page
  issued. The lip-sync gate skips exactly those polls, so it cannot see this.
- **A press on the host profile can still do nothing.** 3 of 8 presses made
  with nothing on the air waited 6.1–8.7 s. The audition was accepted at the
  press and then dropped when its decode landed (`stats.audLate` 3).

Items 3–6 of round 1 are accepted, and the identity re-base is confirmed
isolated (below). Two required items follow.

## What I ran

Headless Chrome over CDP: the real page, the real reels, through the range
proxy on :8063. Each run was 600 s. rc.95 was served from
`git archive 12f5283` on :8066, behind a second range proxy on :8067. The
load average was 47–64 throughout, from the other application plus my own
identity run. Captures are in the session scratchpad (`r2c/`) and are not
committed.

| run | build | mode · seed · network | receptions + auditions |
|---|---|---|---|
| A-press-2024 | rc.96 | press 2024 · local | 16 |
| B-force-31 | rc.96 | force 31 · local (every shape) | 15 |
| C-press-777-host | rc.96 | press 777 · host profile | 14 |
| D-nat-4242-far | rc.96 | natural 4242 `&far=0.9` · local | 4 |
| F96 / F95 | rc.96 / rc.95, **at the same time** | press 2024 · local | 16 / 8 |

The slow 4G run did not start: Chrome did not announce its port within 20 s
at that load. The coder's slow 4G numbers stand as reported (their open 1).

New instrument, committed dev-only: **`tools/pic-freeze.js`**. It reads the
picture's freezes from the media events of any `_rx-probe` capture, per
settled piece:

- the page's `set:currentTime` calls;
- the seconds from a `seeking` or `waiting` event to the next `seeked` or
  `playing` event, which is the time the tube holds one frame;
- how much of that frozen time began within 60 ms of a page seek, and how
  long those seeks took to land;
- the seconds with `playbackRate` more than 15 % off the piece's rate.

The proposed gate is frozen ≤ 5 % of every settled piece and ≤ 2 page seeks
in any settled piece. The tool exits 1 when any piece breaks it.

It can fail, and it passes where it should:

| captures | pieces | seeks | frozen | pieces over the gate |
|---|---|---|---|---|
| my r2 batch (A, B, C, D), rc.96 | 58 | 128 | 101.4 s of 704 (14.4 %) | **25** |
| coder's A3 + B3 + D3, rc.96 | 49 | 1 | 0.5 s (0.1 %) | 1 |
| round 1 captures (h-*), rc.95, no picSync | 34 | 0 | 0.0 s | 0 |

## Confirmed

- **The owner's chop.** `_rx-probe.js analyze` over A–D and F96 found **0
  unintended head gaps, stalls, late starts, splices or conflicts**, and 0
  console errors. `tools/rx-critic.js` found **0 bus chops** over 53
  receptions.
- **The audition's audio-clock timers (the coder's find) are confirmed by
  the A/B.** At the same moment and on the same seed, rc.95's Chrome ran its
  audio clock at about 0.57× wall time: 2003 tap callbacks in 600 s, against
  3536 for rc.96. rc.95 then had **2 unintended head gaps**:
  - tvri-jakarta-1980, an audition, was silent for 20.0 s at envelope 1;
  - pantel-trampolin-1984 had 1.1 s at envelope 0.15.

  rc.96 had 0.
- **picSync is right in principle.** In the same A/B, rc.95's picture ran a
  median of 4.0 s off its sound, and up to 12.3 s (best-ten-jokr: 1 % of
  polls within 120 ms). rc.96 had a median of −3 ms. What fails is how it
  behaves when seeks are slow (item 1).
- **The gates can fail.** On my round 1 rc.95 captures, the coder's
  analyzer gives FAIL with 46 unintended: 32 lip sync, 4 faded and 10 dead
  presses. This matches their handoff.
- **Faded (item 4):** auditions 0.00 s on every edge. Broadcasts max 0.20 s
  over A–D and F96.
- **Identity.** I copied 302cb0a sparsely into the scratchpad, reverted only
  the two re-base rules (`exitCost` capped at 3 s for every exit, and
  `planOneFit`'s exit forced to 切), and ran
  `_far-identity.js 1800 20 12f5283`. Result: **18/18 home nights
  byte-identical, and seeds 17 and 101 identical in notes and events.**
  - The re-base is exactly the two declared rules.
  - The pin moves to `302cb0a`, as the coder wrote.
  - A round-3 fix to picSync or to the audition takes no engine draws, so it
    must keep `_far-identity.js 1800 20 302cb0a` at 18/18.
- **`_harness.js 1800 3042`:** PASS.
  - REPRO identical (2641 notes, 945 events).
  - ERRORS none.
  - Peak concurrent sources 94.
  - Exits {zan 3, setsu 7, zetsu 1}, as the coder reported.
- **Items 3, 5 and 6** are accepted, by reading the code:
  - the fallback's exit follows its label;
  - the demotion unmutes an element only at `createMediaElementSource`;
  - the pins are in PLAN §2.2, §6.3.5 and §10.

  I did not re-run the injected-decoder run.

## Required items

1. **picSync turns a slow seek into a frozen picture, and the gate cannot
   see it.**

   picSync seeks whenever the picture is more than 0.3 s off. It seeks again
   ("kick") after 1.2 s stuck, and reloads the element after 3 s. Each
   landing's residual is measured against a lead clamped to 1.5 s.

   Under load, a seek takes longer than that loop allows. Over A–D:
   - landing time p50 0.54 s, p90 2.18 s, max 6.41 s;
   - so it lands more than 0.3 s behind, and picSync seeks again.

   Trace, A-press-2024, the atc-malvinas audition, t0 591.8 (9.2 s piece):

   | seek set | landed | frozen |
   |---|---|---|
   | 592.221 | 593.301 | 1.1 s |
   | 593.448 | 595.752 | 2.3 s |
   | 596.331 | 598.805 | 2.5 s |
   | 599.696 | 600.299 | 0.6 s |

   Further seeks followed at 600.309, 601.253 and 601.867. Between them the
   rate was pushed to 1.2–1.5×.

   On the tube this is a picture that holds a frame for 1–2.5 s, jumps,
   runs in fast motion, and holds again: 8 seeks and 7.4 s frozen in 9.2 s.
   The worst piece was conet-swedish-rhapsody (host): 14 seeks and 14.7 s
   frozen in 28.6 s.

   | runs | pieces | frozen (all after a page seek) | pieces over 5 % frozen or > 2 seeks | lip-sync gate failures |
   |---|---|---|---|---|
   | A + B + C (rc.96) | 54 | 97.7 s (15.7 %) | 23 | 29 of 54 |
   | D, far 0.9 (rc.96) | 4 | 3.7 s (4.6 %) | 2 | 1 of 4 |
   | F96 (rc.96) | 18 | 4.7 s (2.0 %) | 3, all in the first 90 s of the night | 4 of 18 |

   The handoff says the picture stalls are Chrome's media pipeline starved,
   and that "nothing the page does reaches it". In my captures that is not
   so: **101.4 s of the 101.4 s frozen began within 60 ms of a seek that
   picSync issued.** The probe still marks these freezes `covered` and never
   counts them. The lip-sync gate also drops every poll with readyState < 2.
   So a picture frozen by its own controller passes both.

   The coder's own single miss was the night's first audition. F96's three
   misses all fall in the night's first 90 s. Seeks are slowest there, so
   this is the same fault.

   **Required:**
   - **The rule:** a frozen picture is worse than a late one. picSync may
     only seek when a seek can land in time to help.
   - **Suggested design (the coder decides and writes down why):**
     - never issue a seek while the last one has not landed, plus a short
       settle;
     - scale the seek threshold with the measured landing time, for example
       seek only when |off| > max(0.3 s, 2 × the last landing);
     - give each piece a seek budget, then close the rest with rate only,
       within a band that does not read as fast motion;
     - reload only on a real stall, with no seek pending and no progress
       for a long time.
   - **Fold the freeze reading into `_rx-probe.js` as a gate:**
     - frozen ≤ 5 % of every settled piece;
     - ≤ 2 page seeks per settled piece;
     - report seek landing p50/p90 on every run, because that number is the
       load.
   - **"Picture stall" loses its exemption** for any freeze that begins at a
     page seek.
   - **Lip sync stays gated** (≤ 120 ms on ≥ 95 % of each piece), with two
     changes:
     - a piece may fail it only if a seek in that piece took more than
       0.5 s to land, and it is listed with that landing time;
     - no piece may have a median offset beyond 150 ms.
   - **Show the gates failing and passing:**
     - failing on my r2c captures: `tools/pic-freeze.js r2c/A-press-2024 r2c/B-force-31 r2c/C-press-777-host r2c/D-nat-4242-far`
       gives 25 pieces over the gate;
     - passing on the final build at the machine's load, on seeds 2024
       (local press), 31 (force) and 777 (host press), plus one seed of the
       coder's choice.
   - Cold start is covered by the same gate: the night's first audition is
     where seeks are slowest.

2. **A press accepted at the press is dropped when its decode lands (host
   profile).**

   C-press-777-host had 8 presses made with nothing on the air. Three of
   them were answered "audition" and never sounded:

   | press | reel arrived | what happened |
   |---|---|---|
   | 156.4 | +6.1 s | a broadcast |
   | 279.6 | +8.7 s | see trace |
   | 470.0 | +8.2 s | a broadcast |

   `stats.audLate` was 3. Trace for 279.6:
   - the decode landed and the element was threaded at 282.83 (`seeked`
     283.42);
   - `build()` then re-fitted against the broadcast at 288.3. That left
     about 2.5 s of room, under the 3.7 s glimpse, so it returned false.
   - The dial had turned at the press. The reel never came, and the next
     sound was the broadcast 8.7 s after the hand.

   The room at the press was about 6.5 s. The decode and threading took
   3.2–3.8 s of it at 500 KB/s under load. The other answered presses on the
   host profile sounded 4.5–5.8 s after the press (median 4.6 s), against
   1.0 s at rc.91.

   **Required:**
   - No press that `dial()` answers "audition" may end with no reel. Either
     it sounds within 6 s, or the broadcast it yields to airs within 6 s of
     the press.
   - Ways to get there, for the coder to choose from:
     - fit at the press against the room that will be left once the reel
       has arrived (a measured fetch-and-decode rate, or a conservative
       one);
     - answer a late landing with whatever still fits;
     - prefer a reel already decoded when the room is tight.
   - Any change to which reel an audition draws is on the audition's own
     sample stream. Declare it; the engine streams must not move.
   - **Gate:** 0 dead presses, and `audLate` either 0 or each one counted as
     a dead press, on:
     - press 777 host (mine);
     - press 555 host (the coder's);
     - one local press seed.

## Not required, noted

- **WebKit is still unmeasured, and I cannot measure it here.** No WebKit
  automation is installed. The one on the machine, safaridriver, drives a
  visible Safari window, which the brief forbids.
  - The default path runs the picture on a muted, 1 px, off-screen,
    opacity-0 element. The sound is decoded. That path has never played in
    Safari, the owner's browser.
  - If Safari's power policy pauses that element, the tube will freeze
    while the sound plays on.
  - picSync's `play()` retry and a "snow while readyState < 2" fallback in
    the set (the coder's open 2) are the only guards.
  - **The orchestrator should tell the owner this in the morning note.**
- **Press latency on the host profile:** a median of about 4.6 s from the
  hand to the reel (500 KB/s, a quarter of the measured host), against
  1.0 s at rc.91. It is within the 6 s gate. The static turns at once, so
  the press is heard. On the real host it should be about 1.5–2.5 s. It is
  not measured there.
- The coder's opens 1 (slow 4G), 3 (the station tunes to a reel), 4 and 5
  stand. None of them blocks Q0.

## Left running

Nothing of mine. My rc.95 server (:8066) and proxy (:8067) were session
background jobs and end with this session; `base95/` is kept in the scratchpad.
Round 1's :8062/:8065 (rc.91) and the coder's :8063 proxy are untouched.

To re-run my readings:

    node _rx-probe.js run --seed 777 --secs 600 --mode press --throttle host --port 8063 --out DIR
    node _rx-probe.js analyze DIR …
    node tools/pic-freeze.js DIR … [-v]     # the picture's freezes (exit 1 over the gate)
    node tools/rx-critic.js analyze DIR …   # presses, lip sync, bus chops
