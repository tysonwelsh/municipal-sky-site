# Q0 — coder's handoff, round 1

Branch `zankyo-picture` (worktree `/Users/tysonwelsh/Sites/municipal-sky-site-picture`).
Starting build: rc.91 (`842e155`). Written 2026-09-24, overnight.

## Read this first: the identity pin moves

**rc.92 is a declared re-base.** One fix (planOneFit, cause 5) changes the
plan of receptions that fall back from a shaped reception to a plain hold.
That path is common: `_far-identity.js 1800 20 842e155` reads **5/18 home
nights identical** on rc.92. Isolated: with planOneFit disabled, the rest of
rc.92 is byte-identical to 842e155 on seeds 107, 110, 113, 8891 and 104 (notes
and events). Everything after rc.92 is identical to it:
`_far-identity.js 1800 20 869c855` on rc.93 reads **18/18 home, both far
nights identical**; rc.94 and rc.95 were spot-checked identical to rc.93
(`_probe.js 1800` on 3042, 107, and far 0.9 seeds 4 and 9).

**Later phases pin identity to the Q0 head (`IDENTITY_PIN` below), not to
842e155.** Against 842e155 they will read 13/18 failures that are not theirs.

    node _far-identity.js 1800 20 12f5283      # IDENTITY_PIN = rc.95, the Q0 head

## What landed

| commit | what | VERSION |
|---|---|---|
| `da1b931` | `_rx-probe.js`, `tools/cdp.js`, `tools/rxrec.js`, `tools/range-proxy.js`; decode-capable mocks | dev-only |
| `869c855` | the receiver fixes, causes 1–9 below | rc.92 |
| `8f01b73` | decoded reels are the default (`?reels=element` is the way back); four buffer-path faults fixed | rc.93 |
| `94e2d6d` | on a gliding night the reel is threaded at the rate it will run | rc.94 |
| `12f5283` | an audition never shares the air with a broadcast | rc.95 |
| _(this commit)_ | probe refinements (glide, overlaps, decoded-mode content check) + this handoff | dev-only |

## Gates (all numbers from `_rx-probe.js analyze`, final version of the probe)

| build · set | receptions + auditions | unintended | unintended silence | fallbacks |
|---|---|---|---|---|
| rc.91 · local (press 3042, force 17, natural 7) | 23 + 14 | **50** (6 conflicts, 3 wrong reels, 3 ends of file, 10 splices, 8 late starts, 13 head gaps, 7 stalls) | 28.9 s | 0 |
| rc.92 · same | 34 + 12 | 28 (0 conflicts; the rest element underruns and pre-fix-probe residue) | 7.4 s | 0 |
| rc.92 · slow 4G press 3042 | 4 + 14 | 0 | 0 | 0 |
| rc.93 · local | 36 + 9 | 0 gaps, 4 overlaps (fixed in rc.95) | 0 | 0 |
| rc.93/94 · throttled (slow 4G press 3042, slow 4G force 17, host natural 7) | 31 + 9 | 0 gaps, 2 overlaps (fixed in rc.95) | 0 | 4 (see open 2) |
| rc.94 · gliding far nights (force 9, natural 4, far 0.9) | 24 + 0 | 0 | 0 | 0 |
| rc.95 · press 3042 local, press 3042 slow 4G, press 17 local (83 presses) | 16 + 26 | **0** (0 overlaps) | 0 | 3 (slow 4G presses; open 2) |

Same machine, same load, both at once — element vs decoded (force 17, 600 s):
element 7 `waiting` underruns in the sound, decoded 0. On a gliding night the
element underran at the start of 4 of 6 receptions (readyState 2, the rate
set just before play()); decoded, 0.

Also: `_harness.js 1800 3042` and `1200 7` PASS on every commit, REPRO
identical, ERRORS none, peak concurrent sources 94 (unchanged). Console
errors across every probe run: 0 (the long-standing "29 TUNED reel(s) have
windows of differing length" console.error is excluded; it is the pool, and
pre-dates this phase).

**Gate reading.** Zero unintended gaps locally on the default path (rc.93+);
under throttling nothing stutters. The gate as written is met on the decoded
path. The element path (`?reels=element`) still underruns on this machine
under load — covered by static where the element says `waiting`, not where it
does not — which is why it is no longer the default.

## The instrument

`node tools/range-proxy.js 8063 8061` (see below), then
`node _rx-probe.js run --seed N --secs S --mode natural|force|press [--throttle none|slow4g|host] --port 8063 [--query "&far=0.9&reels=element"] --out DIR`
and `node _rx-probe.js analyze DIR [DIR…]` (exit 1 on any unintended).

- **Real playback**, headless Chrome over CDP, the receiver's own elements and
  the real reels. `tools/rxrec.js` is injected before any page script and only
  listens: the reel at each element's MediaElementSource and at every
  BufferSource started on a decoded reel, the broadcast bus, a clock channel,
  every media event, every call the receiver makes on an element, a 50 ms poll
  of each playing element, the glide (`glideMul`) on gliding nights, and every
  rx event with the descriptor the set is handed (which now carries
  `head: [{at, pos, overrunS, edgePos}]` — where the tape was threaded).
- **Serve through `tools/range-proxy.js`.** `php -S` has no Range support, so
  Chrome cannot seek into an unbuffered reel: on the plain dev server every
  reception played its file FROM THE TOP. The first run I made measured that.
  The proxy serves statics with Range and the host's own headers (measured on
  the host: 206, immutable, TTFB 140–200 ms, 1.8–2.5 MB/s) and passes `.php`
  through. **P-phases that capture the picture should serve through it too**:
  the frame on the tube at any moment depends on where the element is.
- **What is a gap.** Digital silence at the reel's head while the plan has
  the reel running AND the file is not silent there (ffmpeg decode; head
  aligned to the file by envelope correlation, typical lag ±3 ms, r ≥ 0.85;
  a weak fit is ignored). Some reels carry their own digital mutes
  (ddr-programmstart-1983: seven, 40–100 ms). In decoded mode each piece is
  also checked against its own file (r < 0.35 over ≥ 3 s = wrong reel) — this
  found cause 12.
- **Intended** = the envelope under 5 % of peak, a 断 hole, a head's declared
  late start at a file's head, a crossing the page declared and faded, the last
  0.1 s before a cut. Drops and holes are ducks after the head: counted, never
  flagged (≈ one drop per 2 s of reception — the designed stutter).
- **Caveats.** 1–2 % of ScriptProcessor callbacks missed (main-thread stalls;
  a miss is a hole in coverage, never a false gap). The machine sat at load
  average 26–35 all night (another app at ~800 % CPU). Force mode seats
  through the bench, which can seat over an armed broadcast (open 3); those
  overlaps are reported, not gated, in force mode only.

## The causes, and the trace that showed each

1. **The audition borrowed element 0** while a broadcast was armed on it (a
   受信 press in the 55 s before any broadcast): its src swap, seeks and
   pause() landed on the broadcast. → its own element (AUD). rc.92.
2. **One press, two auditions.** The audio-only retry built the first audition
   before re-drawing. rc.91 press 3042 t 555.4: ueno-station and kctv-tvdx on
   one element, src'd 8 ms apart, seeks to 48 then 36; the shorter one's
   teardown paused the element at 9.8 s while the other was on air to 19.5 s —
   ten seconds of silence under an open envelope, the reel through two chains.
   → the retry returns before building, after every draw; auditions hand over
   cleanly; the guard reads the real end. rc.92.
3. **Arm order ≠ air order** broke "n + 2 reuses n's element" (force 17:
   pl-pkf and nl-tros on one element). → freeElem(); each teardown tears down
   its own reception. rc.92.
4. **Hunt/drift ran the reel early** — natural 7, rctv-tandas 探: off the end
   of the file, 5.0 s silent at env 1.0. → headPlan() pre-rolls to reach the
   in-point at the lock. rc.92.
5. **A fallback hold kept its shape's budget** — mock nights: seed 110, 35.6 s
   on a 19.4 s window; 113, 17.3 on 12.0; 104, 24.2 on 19.9. Probe: es-nodo,
   26 s on 19 s, 7.3 s of nothing. → planOneFit. **The re-base.** rc.92.
6. **残 ran off its window** — natural 7, ddr1-aktuelle-kamera, 3.8 s silent at
   env 0.78. → shifted back where there is room, else a 0.35 s fade at the
   window's edge with the band's static to the cut. rc.92.
7. **戻 seek / 走 swap at the relock** — xew-tv 走, 955 ms late under a full
   envelope. → swap inside the sweep (reel warmed into the cache), seek 1 s
   before the relock. rc.92.
8. **Overlapping drops fought** in a lingering loss (6 ms spikes to full, early
   returns, bare steps). → their union is ducked. rc.92.
9. **Element underruns** — `waiting`, readyState 2, file wholly buffered,
   30–336 ms; element cues on main-thread timers, one 0.92 s late in a busy kyū.
   → rc.92 covers `waiting` with static; **rc.93 makes the decoded reel the
   default**, which removes the class.
10. **A decoded piece was cut at 56 % of peak** (stopped 0.05 s past its end,
    halfway down the 0.12 s carrier-lost ramp). → 0.15 s. rc.93.
11. **The harness never saw the decoded path** (bare `ZankyoAudio` threw under
    the mocks; the mock decoder never answered; `Promise` never settles in a
    synchronous run). → window.ZankyoAudio, a synchronous-when-possible
    decode, decode-capable mocks. rc.93 / da1b931.
12. **A 走's second piece played the FIRST reel** when its own decode had not
    landed (slow 4G, force 17: hk-tvc's audio from coronet's in-point, zeros
    past hk-tvc's end; the probe's content check, r 0.27). → bufFor returns
    null for a reel that is not the first; the piece starts when its decode
    lands. rc.93.
13. **Gliding nights threaded at the wrong rate** — seed 4 far 0.9, a hunt 0.6 s
    behind at the lock, over the window's splice at full level. → headGlide.
    rc.94.
14. **An audition ran into a broadcast** — press 3042: one sounding 1.4 s into
    the Cage reel, one built 0.5 s before a t0, one (slow 4G) built 1.9 s INTO
    a broadcast after its reel arrived late. → airClash: an audition that would
    reach a broadcast's static lead is not started (the press is answered by
    the broadcast about to arrive), and a late-landing one checks again. rc.95.

Measured and NOT causes: a reel not buffered when seated (readyState 4 at every
cue, local and slow 4G, 50/50 with a cue in the capture); `preservesPitch`
(nothing correlates); the A/B hand-over as such (the fault was ownership, 3).
The 0.5 s glide re-rate: element mode underran at reception starts on the
gliding night (see Gates); decoded mode steps the AudioParam and measured
clean.

## Open, and owed

1. **WebKit was not measured.** The owner's engine is Safari/WKWebView and no
   headless WebKit exists on this machine (safaridriver opens a visible window —
   not allowed tonight). The decoded path was verified in WKWebView by the
   rc.48 crew (`?bt=1`); everything else here is Chrome. The critic or QF
   should listen in Safari: press 受信 repeatedly, and run a far night.
2. **The cost of decoded reels, measured:** the whole reel (~1 MB) must arrive
   and decode before decide(). On slow 4G (180 KB/s) a 受信 press that seats a
   reception 4.9 s out falls back to the gagaku — 2 of 21 presses; and in force
   mode 2 of 18 bench seats (14 s of lead, but the picture element and the
   decode fetch the same reel at once, halving the bandwidth). Natural
   receptions (≥ 20 s of lead) never fell back on any profile. rc.95's press
   runs: 3 of 27 presses on slow 4G. On the host's
   own speed (2 MB/s) none did. A fallback is the graceful path, not a glitch.
   If the owner prefers the element's reach on bad networks over its
   behaviour on a busy machine, `?reels=element` — or flip the default in
   `ROUTE` (zankyo-audio.js) — and every rc.92 fix still applies there.
3. **The bench can seat over an armed broadcast.** reel-lab's legal seat
   (benchTry) checks `rxUp()` and the engine's deadlines, neither of which sees
   a broadcast that is armed but not yet fired; force mode put two receptions
   on the air at once 8 times in 600 s (seed 9). Since rc.92 they no longer
   share an element or kill each other, but both sound. Bench-only
   (production arms go through the placement); not fixed.
4. **Memory.** Decoded reels are ~17–23 MB each at 48 kHz mono; two are kept,
   three during a 走. Not measured on a phone.
5. **The ♪ audition while STOPPED** can still be replaced by the next press
   (a new press is a new station); it hands over in 30 ms rather than cutting,
   and nothing overlaps.
6. The `dan`/`sou`/`modori` fallback now degrades to a plain hold that fits
   one window. It is still a fallback — the harness line "shapes: body {…}"
   shows how often (as seated, before the window).

IDENTITY_PIN = 12f5283   (rc.95; identical to 869c855 rc.92 on every seed checked)
