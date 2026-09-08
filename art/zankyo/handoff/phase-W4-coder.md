# W4 — coder's handoff

Branch `zankyo-far`. Head at time of writing: `c8ff0c4` (2.1.0-rc.41).

## What landed

| commit | what | VERSION |
|---|---|---|
| `baf98cf` | density floor derived on this instrument; `_harness-base.json` banked | dev-only |
| `490e097` | the probe's receiver can finally receive | dev-only |
| `76d514e` | overflow placement + reject counters + the arm-lead fix | rc.39 |
| `2a255a6` | ambient 0.55 → 0.96 | rc.40 |
| `c8ff0c4` | ambient → 0.9625 (the percentage, per orchestrator) | rc.41 |

## The one thing that must be read before anything else

**`_probe-base.json` (08bcf2e) is stale, and so is every distance number taken
from it.** `_probe.js` mocked `fetch` as `{ then: () => this }` — a thenable
whose callback is never invoked — and `createElement` returned an inert stub for
every tag. The manifest never arrived and there was no element to play it, so
every broadcast fell back and *not one held the air*: seed 104 over 1800 s gave
seven 受信, seven `fallback`, zero 消失.

Three blockers, each visible only once the previous one moved the reason text.
The third was `MockCtx` missing `createMediaElementSource`, which kept the
fallback firing with "no media element" even after the pool was ready and a reel
drawn.

Cost, measured: home D roughly doubles (3042 0.76→2.86, 107 1.95→4.88,
104 3.09→5.96); several home seeds now exceed the old p95 of 4.7. The far end
moves little where departures dominate (16 16.49→16.86) but seed 89 — the sparse
沈 night — goes 21.6→34.46. **The 200-seed run that cleared 17.4 and 29.0 was
run on the old instrument.** Whether the pinned target moves is not the coder's
call.

The two instruments now agree exactly (104/132/107/3042/7/17 →
895/1186/1291/2385/1971/1587 from both). Caveat on the record: that is no longer
*independent* corroboration, because the harness's mock design was ported into
the probe and they now share it.

## rc.39 — overflow, and a guarantee that was never held

P(jo) = 0.20 stays the preference, the 95 s spacing stays the guarantee, and a
broadcast that cannot be seated in its drawn scene now overflows to the other
group instead of being lost. Six seeds (3 home, 3 far) at 4 h, 191 cycles:

| build | pair | one | NONE | rate | jo share | mel/cycle |
|---|---|---|---|---|---|---|
| da8ceb5 | 58 % | 75 | 6 (3.1 %) | 1.54 | 0.228 | 415 |
| overflow | 86 % | 23 | 3 (1.6 %) | 1.85 | 0.332 | 413 |
| overflow + arm fix | 75 % | 43 | 4 (2.1 %) | 1.73 | 0.304 | 419 |

### The reject counters refute the short-jo story

Exposed on `getPlacement().reject`. Over 6 seeds × 4 h:

```
jo { short: 0, spaceBc:  5, spaceGuest: 21, noT0: 0 }
ha { short: 0, spaceBc: 40, spaceGuest: 14, noT0: 0 }
```

**Not one attempt in either group failed for a scene too short to host.** The
losses are spacing, and they are asymmetric: the ha loses mostly to the other
broadcast, the jo mostly to a guest.

### The arm lead was never guaranteed

`arm()` is scheduled at `Math.max(t0c + 0.05, at - BC_ARM_LEAD_S)` — **clamped
to the cycle start, not rejected** — so a broadcast early in its cycle armed with
whatever lead remained. 48.1 % of broadcasts sat closer than 55 s to their cycle
start, the earliest at 8.2 s. §12's argument is `max(commitLead) < armLead`, and
the harness asserted against the engine's *constant* 55, which cannot see the
clamp: a gate that could not fail. Bound to the lead actually used, 40 seeds at
1 h:

- `da8ceb5` — **4/40** breaches, worst −3.58 s
- overflow alone — **8/40** breaches, worst −12.01 s (the change doubled it)
- with the arm fix — **0/40**, worst margin +26.83 s

No note ever landed inside a hold on any of them, so the outcome gate was green
throughout: the invariant was already broken and passing on luck. Making the
first `BC_ARM_LEAD_S` of a cycle illegal restores the lead by construction. That
costs pair rate 86 → 75 % and cycles-with-nothing 1.6 → 2.1 %, missing the
critic's 80 %/1 % gates. Reported rather than tuned around: an invariant is not
worth trading for a gate number.

## Open, and owed to the critic

1. **Re-base window.** rc.39 moves home nights by construction. rc.40/41 must
   not, and that is itself the test (note stream byte-identical on four seeds).
2. **Seed 129 peaks at 112 concurrent sources against the 110 cap** (97 before).
   With reels off it peaks at 99, so the reel path costs ~13 sources while
   playing and the new placement lands one over a dense passage the old one
   missed. 1 of 40 seeds; mean change +1.1. Cap or seating is the critic's call.
3. **Seed 13 fails `no KIRU` at far 0.95** — pre-existing at HEAD, untouched.
   0 KIRUs across only 4 cycles; may be a small-sample gate rather than a fault.
4. **回線/PA span** — priced, reverted, documented. Still a coincidence.
5. **The owner's picture-half report** (no broadcast seen on the second set)
   cannot be tested headless and needs a real browser in front of a person.

## Instrument notes the critic should carry

- **`_harness-base.json`** banks per-seed densities *with reels playing*. The
  gate binds only when run length, reel state and the absence of a `--far`
  override all match the base, and reports otherwise. ±20 % is a policy
  threshold, not an error bar — the instrument is exactly repeatable (three runs
  × three seeds, spread zero), so any deviation is reported even when it passes.
- **A 200 s window cannot see the hichiriki.** Its lane enters at 438.3 s
  (3042), 674.5 s (13), 807.1 s (1) on home nights. Three of the five melodic
  voices are seated by lottery, so any probe/browser comparison needs a window
  past the seating or it will keep finding absences that are only earliness.
- **Fallback contamination.** With no reel, every broadcast falls back to
  越天楽 Etenraku, which plays `hichirikiNote` and
  `shakuhachiNote(f2, tt + 0.12 + …)`. Those paired onsets, 0.12–0.22 s apart,
  are mechanically identifiable in any retained note dump — that is what the
  probe's "13 hichiriki at 200 s" was, on every seed. The lanes were never
  over-scheduled and no voice is missing from the live site.
- **Headless throttling reaches the scheduler, not just rAF.** A starved run
  reports a normal audio clock while committing a fraction of the notes.
  `--disable-background-timer-throttling`,
  `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`
  defeat it; `--mute-audio` on every launch is standing policy.
- **A note-count validity check cannot validate seed 89** — it has 5 notes by
  300 s *by design* (沈). The sweep's evidence is graded, not binary: strong on
  1047/16/13, weak on 84 and 89, inconclusive on 1.

---

## Closing: the listener-facing constants and where each lives

Six numbers the owner can move and hear the result of. Each is the number *in
the code* rather than something that emerges from a table, which is the property
worth keeping: moving one should mean the same thing on every night.

| what the owner hears | constant | lives at | value |
|---|---|---|---|
| a home night lifts | `HOME_LIFT_ODDS` | `zk-far.js:477` | `1/12` |
| which cycle lifts | `HOME_LIFT_LAMBDA` | `zk-far.js:477` | `5` |
| a broadcast opens a cycle | `BC_JO_P` | `zankyo-audio.js:2031` | `0.20` |
| a reel arrives with a picture | `VIDEO_WEIGHT` | `zk-broadcast.js:181` | `1.5` |
| the weather comes forward | `layerVolumes.ambient` | `zankyo-audio.js:1437` | `0.9625` |
| the reed sits back | `layerVolumes.hichiriki` | `zankyo-audio.js:1437` | `0.35` |

### What each one actually controls, including where the number is not the outcome

**`1/12` and `λ = 5`** — one home night in twelve lifts a single cycle out of
home, and which cycle is Poisson-drawn with λ = 5. The draw runs on its own
sub-fork (`R.fork("cycle")`), because Knuth's method consumes a variable number
of uniforms and would otherwise shift every later draw on the parent stream by
an amount that depends on the answer. `getFar()` carries the lifted cycle and
its d′ so the flag can never disagree with the night.

**`P(jo) = 0.20` is per BROADCAST, and the owner-facing figure is per CYCLE.**
With two broadcasts a cycle, about **39.5 %** of cycles open with one, and that
is not a tuning failure: 30.5 points of it are drawn jo seats and only 8.9 are
overflow. At this constant, over a mix of one- and two-broadcast cycles, the
drawn term lands near 31 % — `1 − 0.8² = 36 %` is its ceiling on the
two-broadcast cycles alone. Anyone reading "one in five" and expecting one cycle
in five to open with a signal will be wrong by twice, so state the cycle figure
to the owner, not the constant.

**`VIDEO_WEIGHT = 1.5` is calibrated against a pool that has since quadrupled.**
The comment at `zk-broadcast.js:172` reasons about a 32-reel pool (21 video) and
then a 52-reel pool (41 video), where 1.5× lands the 85 % target it was chosen
to serve. The manifest now holds **207 reels — 171 with a picture, 36
audio-only** — so the same weight now gives
`171×1.5 / (171×1.5 + 36) = 87.7 %`. Drifted about three points above target,
not broken, and worth re-deriving whenever the pool next grows: the target is
85 %, the weight is only the means. Two stale comments still say "3×" at `:195`
and `:552` and should be read as 1.5.

**`ambient = 0.9625` is the gain.** ambient has no entry in `LAYER_VOL_TRIM`
(`zankyo-audio.js:1477`), so the layer gain is 0.9625 rather than 0.9625 × a
trim — the move from the original 0.55 is exactly `20·log10(1.75) = 4.86 dB`.

**`hichiriki = 0.35` is NOT the gain.** `LAYER_VOL_TRIM.hichiriki = 1.4` is
deliberately unchanged, so the effective layer gain is `0.35 × 1.4 = 0.49`.
Reading the default alone understates the reed by 3 dB.

### The property that made these safe to change

Both volume changes were verified by note-stream byte-identity — every onset,
layer, frequency and duration unchanged across four seeds at 1800 s. A layer
gain reaches no musical decision. That is the test worth repeating on any future
volume move: if the note stream shifts at all, a gain is feeding back into a
decision and that is the finding, not the level.
