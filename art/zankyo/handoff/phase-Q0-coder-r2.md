# Q0 — coder's handoff, round 2

Branch `zankyo-picture` (worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture`).
Answers `handoff/phase-Q0-critic-r1.md` item by item. Written 2026-09-24.
The machine sat at a load average of 43–54 for the whole round (another
application at ~830 % CPU, not ours, left alone). All playback numbers below
were taken under that load.

## Read this first: the identity pin moves again

**rc.96 is a second declared re-base**, on top of rc.92's. Two rules move
plans: a 残 now costs its window the audible part of its linger (item 4), and
a fallback hold's exit is the exit it says it is (item 3).

- `_far-identity.js 1800 20 12f5283` (rc.95) on rc.96: **4/18** home nights
  identical. Seed 17 (departed) differs; seed 101 is identical.
- Isolation: with only those two rules reverted (`exitCost()` capped at 3 s
  as before, and `planOneFit`'s exit forced to 切 as before), the rest of the
  build is **18/18 home nights, plus both departed nights, byte-identical to
  12f5283 in notes and events**. Measured twice: once before the last
  picSync, timer and prefetch edits, and again on the committed `302cb0a`
  with the two rules patched out and then restored from git.

    IDENTITY_PIN = 302cb0a   (rc.96, Q0's final head)
    node _far-identity.js 1800 20 302cb0a

Every P-phase must be byte-identical to `302cb0a`. PLAN §2.2, §6.3.5 and §10
now say so. Against `842e155` or `5de3d45`, a later phase would read about
14/18 failures that are not its own.

## What landed

| commit | what | VERSION |
|---|---|---|
| `302cb0a` | picSync; audition threading, fitting and audio-clock timers; exit cost of 残; fallback exit; decode demotion; prefetch at loadedmetadata; a press in a dead tube | **rc.96** |
| _(this commit)_ | `_rx-probe.js`: lip sync, faded, dead press and picture stall readings, `--reject-decode`, the NaN capture-end fix; `tools/presshook.js`; `tools/rxrec.js` reads the head mode per reception; PLAN pins; this handoff | dev-only |

## Gates (final build, `_rx-probe.js analyze`, 600 s runs through the range proxy :8063)

| set | runs | receptions + auditions | unintended | lip sync (decoded pieces under the 120 ms / 95 % gate) | faded s at env ≥ 0.5 | presses with nothing on air, waiting > 6 s | fallbacks |
|---|---|---|---|---|---|---|---|
| **local** | press 101, natural 8891, force 17, force 9 `&far=0.9` (gliding) | 43 + 14 | **1** (the lip-sync piece) | **1 of 70** (91 %) | auditions 0 · broadcasts max 0.2, plus 1.58 declared | 0 of 1 | 0 |
| **host** | press 555 `--throttle host` | 6 + 12 | **0** | 0 of 19 | 0 · max 0.2 | 0 of 2 (max 5.5 s) | 0 |
| slow 4G | press 3042 `--throttle slow4g` | 5 + 10 | 8 (dead presses) | 0 of 18 | 0 · max 0.19 | **8 of 12** (open 1) | 3 |
| decoder refused | press 7 `--reject-decode` | 7 + 12 | **0** | (element mode) | 0 | 0 of 2 | **0** |

The same gates on the critic's rc.95 captures (h-press-101, h-nat-8891,
h-press-555-host): **46 unintended**. That breaks down as 32 lip-sync pieces
(median −472 ms, worst −4.59 s), 4 faded edges (11.5 s on auditions, 4.1 s on
a broadcast) and 10 presses waiting more than 6 s (median 18.4 s, max 43.7 s).
The new gates can fail.

The critic's own instrument, `tools/rx-critic.js analyze` on the final local
and host runs (A3, B3, C3):
- presses that did nothing: **0 of 48**;
- lip sync: **0 of 42** receptions with more than 10 % of the hold over 150 ms
  off (median −3 ms, range −10 … 4);
- bus chops: **0** over 42 receptions.

Also:
- `_harness.js 1800 3042` and `1200 7`: PASS. REPRO identical, ERRORS none,
  peak concurrent sources 94 and 91.
- Console errors on every run: 0. The long-standing TUNED-windows
  console.error is excluded as before. The demotion's one `console.warn`
  appears only on the injected run.

## The critic's items

**1. Lip sync on the decoded path. Done.**
- `picSync()` runs every 150 ms on each decoded reception. It compares the
  muted element with the head (headPlan's `pos`, at the piece's rate, stepped
  with the glide exactly as the BufferSource automation is), and then:
  - nudges `playbackRate` (P gain 1.5, ±50 %) with an integral trim of up to
    ±35 % that learns a steadily slow clock;
  - seeks when more than 0.3 s off, with a seek lead learned from each
    landing;
  - re-seeks when stuck (seeking, or readyState < 2) for 1.2 s, and reloads
    once at 3 s.
  - The glide lane no longer sets a decoded element's rate; picSync owns it.
- The audition's element is threaded to its cue point before its sound
  starts. This happens after the decode's fetch, so the element reads the
  file from the HTTP cache; with both fetching at once on the host profile, a
  press was answered 9.1 s late. The audition starts when both are ready, or
  1.5 s after the sound is ready.
- The prefetch seeks at `loadedmetadata`. It used to wait for a `canplay`,
  which a suspended player never sent: two captures showed loadedmetadata,
  then `suspend`, then nothing for 20 s, and the first seek at the cue never
  landed.
- Why ±25 % was not enough: in round-2 run 1 (load average 45–54) the
  elements' clocks ran at **0.78–0.95** of their set rate. After the change,
  0.96–1.00.
- **Gate as proposed:** |picture − sound| ≤ 120 ms on ≥ 95 % of each settled
  piece, polled at 50 ms, counted only where the element has a frame
  (readyState ≥ 2).
  - Final build: 106 of 107 pieces pass (local, host, slow 4G, a gliding far
    night).
  - The miss was 91 %: the night's first audition (a cold page), where the
    element raised one `waiting` and the picture spent about 0.9 s of 9.8 s
    beyond 120 ms before the re-seek landed.
  - rc.95's captures: 32 of 34 pieces fail.
- **A new reading, not gated: picture stall.** These are seconds where the
  element had no frame at all.
  - In round-2 run 2 (A2), one broadcast's element sat at readyState 1 for
    7.1 s and then 3.2 s. The whole file was buffered, and seeks, a reload and
    play() all went unanswered, until the next piece's seek brought it back
    after 19 s.
  - That is Chrome's media pipeline starved at a load of ~50, and nothing
    the page does reaches it. The sound, from the buffer, was untouched; the
    tube held its last frame. (In element mode, rc.91, the same stall was
    silence.)
  - Final build: 0 pieces with ≥ 1 s of stall, 0.5 s in all.

**2. A press of 受信 is answered. Done.**
- `airClash` is gone. `audRoom()` measures the room from the audition's t0
  to the latest cut that leaves its collapse and burst over 0.5 s before the
  next broadcast's t0 (`AUD_CLEAR_S`). That overlaps only the broadcast's own
  static rise: one station, then the dial, then the next.
- `audFit()` fits the audition into that room:
  - unchanged if it fits;
  - else its pieces give up seconds, the last first, down to 3 s for the
    first and 2 s for the rest, keeping the shape;
  - else a plain hold with the 切 it drew;
  - else null, which is the only "live" answer. It happens only when not even
    a 0.4 + 2.5 + 0.8 s glimpse fits, which means the broadcast is under
    about 5.9 s away.
- The fit takes no draws. The drops are drawn on the unfitted plan and
  filtered, so the sample stream does not move.
- **The room I defined:** a 2.5 s hold (`AUD_MIN_HOLD_S`), not the critic's
  suggested 4 s. With 4 s, presses 6–7.4 s before a broadcast would have
  waited for it: longer than 6 s, and the gate would fail by construction.
- A late decode is re-fitted at build and never dropped for being late.
  `stats.audLate` counts the ones that no longer fit: 0 on every final run.
- **Also found:** a press in a broadcast's dead tube (after its burst, before
  its teardown) was answered "live" with nothing sounding. It now gets an
  audition (`onAirNow()`).
- **Also found, a real chop: the audition's end was on the wall clock.** Its
  timers were `setTimeout`s computed from audio-clock deltas.
  - On C2 (host profile), the context clock ran at about 0.6× wall time for
    several seconds (picSync had to slow the picture to 0.6 to match it).
  - The audition's `audCancel` fired 2.55 s early in audio time, cutting a
    reel mid-word at full envelope: 1.6 s of silence on head and bus
    (tvtupi, audition at t0 14.7).
  - `at()` now re-arms until the audio clock has actually reached its moment.
  - A Bluetooth route, whose clock the context follows (the owner's setup,
    per the rc.48 notes), can drift the same way. This is my best candidate
    for "chopping" that an earlier graph tap could not see.
- **Gate:** no press with nothing on the air waits more than 6 s. Final
  build: 0 on local, 0 on host, 0 on the demoted run. rc.95's captures: 10.

**3. The fallback's exit. Done.**
- `planOneFit(reel, o, onS, exitS, exit)` now keeps the shape's exit.
  - A 絶 keeps its label (exitS 0.02, same timeline).
  - A 残 is kept only where the window carries its audible part and a hold of
    min(onS, 8 s).
  - Otherwise the fallback becomes 切 at `o.lossD`: choose()'s `rLoss`, a
    draw already taken, 1.6–2.8 s. The audition passes its own drawn loss
    (`lossD0`).
- This is part of the declared re-base.

**4. Faded seconds. Done, with two declared exceptions.**
- The probe reports a **faded** reading per reception: seconds from 0.175 s
  before the window's edge (where the edge gain drops under half) to the cut,
  where the envelope is ≥ 0.5.
- **残 costs its audible part.** `exitCost("zan", s)` = max(min(s, 3),
  0.7 · s). 0.7 is where the exit envelope crosses half of peak
  (0.5 + 0.25 × 0.25 / 0.31). It is applied to window selection, the ladder,
  planShaped's piece caps, the fallback, the in-point `need` and the
  audition.
  - What the owner will notice: a 残 now lands on a window that can carry its
    linger (224 of 252 reels have a window of 16 s or more). Where none can,
    the ladder gives up the linger, its own second rung.
  - So there are somewhat fewer 残 on reels with only 12 s windows, and no
    more lingers that are static. I did not measure the share over many
    nights. Harness tallies: 3042 exit {zan 3, setsu 7, zetsu 1} of 11;
    7 {zan 1, setsu 7, zetsu 1} of 9.
- **Auditions: 0.** `audEdge()` shortens the last piece, then the exit, until
  the edge falls after the envelope drops under half. Final build: 0.00 s on
  every audition edge.
- **Broadcasts: at most 0.2 s** on every final run, with two declared
  exceptions, reported by name and not gated:
  - A **whole thought** (§14 never slices one). Not met this round.
  - **A reel the station tuned to (§11.3, "reel unbent").** This one is
    pre-existing, and I found it. choose() places the in-point for the bend
    it drew (rate 0.82 here); at air the station takes the pitch and the reel
    runs at 1.0, so the run outlasts its window.
    - cn-dongfanghong, a bench-forced 浮断切 at far 0.9: overrun 4.3 s, faded
      1.58–1.84 s.
    - Fixing it needs the sea decision at arm time, which the engine makes at
      t0. Open 3.

**5. Demotion. Done.**
- A `decodeAudioData` refusal (the decoder's, never the network's; tagged
  `zkDecode`) sets `demoted`.
  - `reelsBuffered()` then answers false for the rest of the session.
  - `stats.demoted = {id, why, t}`; one `console.warn`; nothing on the VFD.
  - An element is unmuted only when it is handed to createMediaElementSource,
    since before that its sound would go straight to the speakers.
  - The hush listeners stop hushing once demoted.
  - An audition whose decode was the refusal is answered through its element.
  - An armed broadcast whose decode was the refusal is decided in element
    mode (its element was threaded at prefetch).
- Descriptors now carry `reels: "buffer" | "element"`, and the probe reads the
  head mode per reception.
- **Proof** (`--reject-decode`, press 7, 600 s): demoted at 9.6 s on the
  first reel; **0 fallbacks**; all 19 receptions and auditions after it went
  through their elements with their heads tapped; **gate 0 unintended**.
- **afconvert** (AudioToolbox, the decoder WebKit uses) over all 252 reels:
  **252 decode, 0 fail.**
  - 33 reels' audio is about 2 s shorter than their video. No window reaches
    past the audio on those.
  - 13 reels' last window ends about 80 ms past the audio stream's end, inside
    the loss tail. Harmless.

**6. Docs and pins. Done.** PLAN §2.2, §6.3.5 and §10 now pin `302cb0a`.

## Also fixed in the probe (dev-only)

- **`lastT` was NaN on every run.** The rows are pulled after the clock, so
  `rowT(last row)` indexed past `clk`. Every "not fully captured" guard, and
  the press window, passed everything. Found when it counted a press 2 s
  before the end of C3's capture as dead. Every number in this handoff is
  from the fixed analyzer.
- `tools/presshook.js`: the critic's press log, now recorded by
  `_rx-probe.js run` too (written to `crit.json`).
- New readings: lip sync, picture stall, faded, dead press; stats per run
  (`demoted`, `picSeeks`, `audBlocked`, `audLate`).

## Open

1. **Slow 4G (180 KB/s): 8 of 12 presses made with nothing on the air waited
   more than 6 s**, and 3 locked presses fell back to the gagaku with "reel not
   decoded". A ~1 MB reel must arrive and decode before it can sound.
   - Not in the critic's gate (local and host), and the host profile
     (500 KB/s, already a quarter of the measured host) passes.
   - The fix, if wanted: a per-reception element fallback. Decide() or the
     audition would use the element, already threaded and streaming, when the
     decode is late. It is feasible because an element routed into the graph
     and then hushed carries silence, but it is a larger change. Proposed for
     QF.
2. **The picture holds its last frame while the element's pipeline is
   starved** (picture stall, above). The set could show snow when
   `video.readyState < 2` during a hold instead of a frozen frame. That is
   zk-set.js work; suggested for P0 or P1, where the frame passes are being
   rebuilt anyway.
3. **§11.3 sea-tuned reels run past their window** (item 4). A pre-existing
   plan/air mismatch, far nights at d ≥ 0.5 only.
4. **WebKit is still unmeasured** (round 1's open 1). The demotion is the
   safety net if its decoder refuses a reel. Whether WebKit keeps a muted,
   1 px, opacity-0 element decoding frames (power policy) is untested. If the
   owner's tube freezes in Safari, look there first.
5. Round 1's opens 3 (the bench seats over an armed broadcast: 16 overlaps in
   force mode, reported as intended there) and 4 (decoded-reel memory on a
   phone) stand.

## Servers

- Left running: `php -S :8061` (the worktree) and the coder's range proxy
  `:8063` → 8061.
- The critic's `:8062` (rc.91) and `:8065` proxy are still up; I did not
  touch them.
- Captures are in the session scratchpad (`r2/`), not committed.
