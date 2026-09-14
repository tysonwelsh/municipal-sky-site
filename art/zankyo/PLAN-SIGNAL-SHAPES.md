# ZANKYŌ — the shapes of a reception (受信の形)

*Plan written 2026-09-14 at the owner's ask, against 2.1.0-rc.68. The owner's
observation: every signal the set picks up is about the same length, and one
signal has no relation to the next — a clip, a long pause, another clip. The
ask: confirm that, keep today's length as the floor, and add variety — some
longer, some shaped differently (a signal that plays a few seconds, drops
out, and returns later in the same broadcast as though time passed while the
carrier was lost), so that receptions feel organic and unpredictable. This
document is the audit (§1), the vocabulary proposed (§3), the mechanism (§4),
the storage question (§5), the phases and gates (§6), and the decisions the
owner has to make before an agent builds it (§7).*

---

## 1. The audit — the observation is correct, and here is exactly why

Read against `zk-broadcast.js`, `zankyo-audio.js`, `zk-set.js`, the cutter
(`broadcast/tools/make-reel.sh`) and the manifest of 208 reels.

**Every reception has one shape.** The receiver's `choose()` draws six numbers
per signal and the hold is `holdS = 8 + r × 4` — **8 to 12 s, uniform**, on
every broadcast, every night. Around it: 4 s of static rising before t0, a
0.4 s tune-in, the hold, a loss ramp of 1.6–2.8 s, a 0.42 s collapse, a
0.32 s burst, 1.6 s dead. So the signal is audible for **10.4 to 15.2 s** and
the whole event, static to dead tube, spans **17 to 22 s**. The same numbers
govern the ♪ audition, the 選局 scan and the tuning dial. There is no other
gesture: one tune-in, one hold, one loss, never a return.

**The reels cannot hold more than 12 s anyway.** A reel is a concatenation of
non-contiguous windows cut from one source (plan §5.1), and the pool is:

| window length | windows | note |
|---|---|---|
| 12 s | 1 164 | the default `--window-len 12` |
| 10 s | 170 | music windows (Tier B rule: ≤ 10 s) |
| 8–9 s | 11 | |
| 32–40 s | 3 | `john-cage-interview`, the one `whole: true` reel (§14) |

A hold longer than a window would run across a window boundary — a hard cut
to another moment of the source — so `choose()` clamps it
(`holdS = wl − TUNE_S − lossD` when the draw does not fit). With a 12 s window
and 10.4–15.2 s needed, the in-point is pinned to the window's head most of
the time, so a signal is almost always "the first 8–12 s of a 12 s window".

**The one exception proves the rest.** The Cage reel's three whole thoughts
(40.0 / 32.4 / 33.0 s) play from start to end, and §14 (rc.56–57) built the
footprint-aware seating that lets a 30–40 s hold be refused where it does not
fit and allowed where it does. It is drawn about **1 signal in 121–136**. So
the machinery for a long reception exists, and the pool has three windows
that can use it.

**One signal has no relation to the next, by design.** Two broadcasts a cycle
are placed at plan time ≥ 95 s apart (`BC_GAP_S`), each draws its reel
independently (the only memory is the three-cycle rest), and nothing in the
receiver knows what the previous one was. The owner's "one clip, a long pause,
another clip, no connection" is precisely what the code does.

**Where the constraints come from, so the redesign respects them:**

- **The air.** A broadcast holds the AIR from t0 − 6 to the loss + 2 + 3–6 s
  per voice; the melodic bodies commit notes up to 46 s ahead, so the hold is
  written at arm, 55 s before t0 (`BC_ARM_LEAD_S`). The next broadcast's arm
  calls `airHoldClear()`, so an *ordinary* reception owns exactly
  `BC_GAP_S − BC_ARM_LEAD_S = 40 s` past t0; today it reaches 23.2 s. Anything
  longer must go through `fitsRoom()` (the KIRU, the guest, the next arm, the
  cycle end), which is what whole thoughts already do.
- **The KIRU.** A signal must end 15 s before the cut and start 20 s after.
- **The picture.** `zk-set.js` derives its phase every frame from one
  descriptor `{ t0, holdS, lossD, drops }` and knows exactly the sequence
  tuning → hold → loss → collapse → burst → dead. A reception with a gap in
  it needs a descriptor with segments.
- **The draws.** Every draw comes off the signal stream whether or not it is
  used, so the network never moves a night; a new shape must draw a fixed
  count too. Any change to the draws moves every home night — that is a
  **declared re-base** (`_harness-bank.js`), which the owner has accepted.
- **The harness gates** (`_harness.js`): ≤ 2 signals a cycle, none within a
  KIRU's reach, no melodic or PA note inside a hold, 2.2–3.6 signals per
  3 cycles, placement (1.68 broadcasts/cycle, pair 74 %, empty 5.8 % at
  rc.56), and per-seed melodic density ±20 % against the bank.
- **The reels are immutable and the raw sources are not in the repo.** A
  re-cut reel gets a new `rev`; the sources live in `local-dev/broadcast-src/`
  on the owner's Mac (gitignored) or are re-fetched from each entry's `src`.
  So any change to what is *stored* is a step for the owner's machine, and the
  code must not depend on it having happened.

---

## 2. The floor, as this plan reads it

"Today's length is the minimum." Read as: **a reception is never shorter than
today's** — the signal's total on-air time (the sum of its audible segments)
is at least 8 s, and a single-segment reception is exactly today's 8–12 s.
Segments *inside* a longer reception may be short (the owner's own example:
5 s, a 10 s gap, 5 s more), because the reception as a whole is longer than
anything today. Nothing in this plan proposes a lone 3 s glimpse; if the
owner wants one, it is one more body in §3 with its own weight, and it is
marked there as *below the floor, opt-in*.

---

## 3. The vocabulary — a grammar, not a list

A reception is composed of **a body, an entry and an exit**, each drawn from
the signal stream. The body decides what the signal *does*; the entry and exit
decide how it arrives and how it leaves. A grammar gives 4 × 3 × 3 shapes from
ten parts, and the ear hears a different reception every time without any one
part being rare enough to feel like a set piece. Every kanji below is the log
line (「受信 · title · year · 戻」).

### 3.1 The bodies

- **常 the ordinary** — today's: one segment, hold 8–12 s. The floor, and
  still the most common thing the set does.
- **戻 the return** (the owner's example) — a segment of 4–8 s, the carrier
  lost for 6–15 s (low static, the tube rolling snow, the crew still
  listening), then the SAME broadcast again for 4–10 s, **later in the
  source**: the in-point advances by the gap × 1–3 (time collapsing — the
  transmission went on while we lost it), or, when the window has no room
  left, the reel's *next* window, which is a genuinely later moment of the
  same source (the windows are cut in source order and `srcWindows` says how
  far apart: the log can say 「戻 · 47 s later」). Return lock is short
  (0.2 s), no 4 s static rise — it is the same frequency, found again. One
  return usually; two with a small probability. Total on air 8–18 s, total
  span 18–35 s.
- **断 the broken carrier** — one segment of 10–16 s with one or two holes of
  1–3 s in it — not the 120–370 ms dropouts of today but a real loss and
  recovery: the band narrows, the voice ducks under rising static, the
  picture tears and rolls, and it comes back where it *would* be (no seek —
  honest time; the element keeps running). Total on air 10–16 s.
- **長 the long hold** — 15–30 s continuous, on a window long enough to carry
  it (§5). Until long windows exist this body is only ever satisfied by the
  Cage reel, so it degrades to 常 on any reel without one — which is exactly
  today's behaviour, so nothing is lost while the pool catches up.
- *(opt-in, below the floor)* **瞬 the glimpse** — 2–4 s, gone. Not proposed;
  listed because the owner asked for "some shorter". Weight 0 unless chosen.

### 3.2 The entries

- **即 the snap** — today's: static 4 s, tune 0.4 s.
- **探 the hunt** — the dial hunting 3–8 s: two to four glimpses of the
  picture and a syllable (0.3–0.8 s each) flickering out of the snow before
  it locks. On the tube: the vertical hold slipping, the picture resolving
  and losing again.
- **浮 the drift-in** — the signal surfaces from under the static over
  6–10 s: strength climbing, the band opening slowly (the highpass sliding
  down from 800 Hz), the picture condensing out of snow. No snap at all.

### 3.3 The exits

- **切 the cut** — today's: loss 1.6–2.8 s, collapse, burst.
- **残 the lingering loss** — the loss stretched to 6–12 s: dropouts
  thickening, flutter deepening, the voice surfacing through static two or
  three times before the cut. The tube tears and rolls the whole way.
- **絶 mid-word** — no loss ramp: a hard cut at full strength, the burst,
  dead. The rarest, and the one that makes the others feel like a loss
  rather than a fade.

### 3.4 Relations between receptions (the "no connection" part)

- **同 the callback** — when a cycle carries two broadcasts, the second is
  the SAME reel with a later window, with probability ~0.25: the station kept
  the frequency, and a minute or two later the same voice is back. This is
  the cheapest change in the plan (one preference in `choose()`), and it is
  the one that most directly answers "one clip, a pause, another clip".
- **走 the scan** — two different reels back to back in one reception: the
  first is lost, the dial sweeps (the 掃引 static, 2–3 s), a second locks for
  its own hold. Both take the recent ring and the tide weighting. Plan §2.4
  imagined this ("放送 cycles may chain two signals") and it was never built.
  Its footprint is two ordinary holds plus the sweep, so it seats only where
  there is room.

### 3.5 Weights (a first proposal, for the owner to tune by ear)

| part | weight | on-air time it adds |
|---|---|---|
| body 常 ordinary | 0.42 | — |
| body 戻 return | 0.22 | +4–10 s on air, +6–15 s of gap |
| body 断 broken | 0.14 | +2–4 s |
| body 長 long | 0.12 (degrades to 常 until §5) | +5–18 s |
| body 走 scan | 0.06 | +8–12 s and a sweep |
| body 瞬 glimpse | 0 (opt-in) | below the floor |
| entry 即 / 探 / 浮 | 0.65 / 0.20 / 0.15 | 0 / +3–8 / +6–10 |
| exit 切 / 残 / 絶 | 0.65 / 0.25 / 0.10 | 0 / +4–9 / −2 |
| relation 同 callback | 0.25 of second broadcasts | — |

Rough result: on-air time from the 8 s floor to ~35 s, median about 13 s;
the whole event from today's 17 s to about 55 s; about **one reception in
three** something other than today's snap-hold-cut. The entries and exits
combine with every body, so 残 on a 戻 (a return that then lingers) and 探
before a 長 both happen without being designed.

---

## 4. The mechanism — one object, the reception plan

The change that makes all of §3 one implementation instead of ten: replace
the receiver's `{ holdS, lossD }` with a **reception plan**,

```
{ reel, segments: [ { inS, onS, lockS }, … ], gaps: [ … ],
  entry: { kind, durS }, exit: { kind, lossD },
  body: "常"|"戻"|"断"|"長"|"走", presenceS, spanS }
```

where `presenceS` is the sum of on-air seconds (the thing the floor is about)
and `spanS` runs from the first lock to the last cut. Everything downstream
reads the plan instead of two numbers:

- **`choose()`** draws the body, entry and exit AFTER the six draws it takes
  today (a fixed count — twelve draws, always, so the stream never moves for
  the network), then builds the plan against the window it landed on:
  segments that fit inside the window, or across the reel's windows for a
  return. **Degrade, never refuse:** a shape that does not fit the room
  (`fitsRoom()`, extended to take `spanS` and the exit's reach) loses its
  parts in order — the second return, the lingering exit, the hunt, the
  return itself — down to 常, which always fits where the plan seated it
  because the global spacing is still sized for it. A whole reel keeps §14's
  rule (a thought is never sliced) and simply takes body 長.
- **`fitsRoom()` and the reach.** `maxReachPastT0()` and the ordinary reach
  stay as they are for 常; every other body is footprint-checked per position
  the way whole thoughts are. `BC_GAP_S` does not move. The re-derivation
  note in `zankyo-audio.js` gains one line: "shaped receptions are checked
  by fitsRoom, like whole thoughts."
- **The air** is held across the whole span, gaps included (the crew stays
  quiet while the set hunts for the carrier — §7 asks the owner whether a
  long gap should let the shakuhachi comment). The planned hold at arm and
  the real hold at fire read `spanS + exit reach`, so they stay one object.
- **`startSignal()`** schedules the same graph once (band, receiver, flutter,
  gate, staircase, envelope, phasing, room tap) and walks the segments: the
  envelope `sg` and the band ramps are scheduled per segment; between
  segments the gate ducks to a carrier-lost floor (below `DROP_FLOOR`) with
  the hole static rising, the band narrowed. The **seek** between segments is
  `v.currentTime = inS` in element mode (a keyframe every second, so it
  costs one) and a second `BufferSource.start(t, inS)` in `?reels=buffer`
  mode. The hunt and the drift-in are entries scheduled before the first
  segment on the same nodes; the lingering loss is a longer exit envelope
  with a denser dropout schedule from `weather()`.
- **`weather()`** draws its dropouts across the plan's span, denser in the
  gaps and in a lingering loss, exactly as it densifies through today's loss.
- **The set** (`zk-set.js`) takes the plan in the descriptor: `phaseOf()`
  walks segments and gaps — a gap is a new phase, *lost* (snow, the roll,
  the last frame ghosting), a return is a short *relock*, the hunt is
  *hunting* (glimpses at the plan's times), the drift-in ramps `strength`
  over its length instead of 0.4 s. The rx lamp follows.
- **The VFD** line gains the shape: 「受信 · title · year · 戻 47 s later」,
  「消失 · signal lost · 21.4 s on air · 34 s」. The `sig` the harness records
  carries `presenceS`, `spanS` and `body`.
- **The manual paths.** The 選局 scan and the tuning dial draw from the full
  vocabulary (a listener turning the dial should get the station's whole
  range). The ♪ audition stays 常 — the owner's rule is that an audition
  shows what a signal *is*, and the short form is the one to demonstrate —
  unless §7 decides otherwise. `reel-lab.php` gains one button row per body
  so a shape can be seated on demand for A/B.
- **Nothing in the shared substrate moves.** `pj2-*.js` is untouched; the
  air's `hold` API already takes arbitrary spans.

---

## 5. Storage — what needs to change in the reels, and what does not

**Nothing in the manifest's shape changes.** `windows` stays `[start, end]`
(§14's rule, for the five positional readers), `srcWindows` already carries
what the return needs, and `whole` / `wholeWindows` keep their meaning. The
receiver reads window lengths it already reads.

**戻, 断, 走, 同 and every entry and exit work on today's reels.** A return
inside a 12 s window is 4–5 s + a gap + 4–5 s further in; a return across
windows is the next window. The broken carrier and the lingering loss are
envelope changes. Nothing in §3 waits on a re-cut except 長.

**長 needs long windows, and that is a re-cut on the owner's Mac.**
`make-reel.sh` already takes explicit ranges (`--windows 83-110`) and
`--window-len`, and reuses the source in `local-dev/broadcast-src/`. The
proposal:

- A **long-window recipe** in `CURATE.md`: each chosen reel keeps its 12 s
  windows and gains **one or two windows of 20–30 s** (contiguous, a scene
  that stays interesting for that long — a countdown, a sign-off, a chant, a
  lecture), so the reel serves 常 and 長 both. About +0.4 MB per reel.
- **Tier A first.** The 53 free-to-use reels (PD, CC, US government: the
  Apollo audio, the COI and Bureau of Mines films, Coronet and Centron, the
  Bell System, the Conet numbers stations, the Voyager greetings) have no
  fair-use ceiling. Twenty to thirty of them with long windows lights 長 up
  at its full weight. Tier B stays as it is: a 20 s fragment of a copyrighted
  broadcast is a bigger fragment than the posture was written for; if the
  owner wants any, at most one 20 s speech window per reel, never music,
  never a whole scene — the owner's call, one reel at a time.
- `make-reel.sh --long-windows a-b,c-d` as a convenience that appends to an
  existing reel's windows and re-encodes (a new `rev`, so the cache is
  busted); `build-manifest.sh` validates as it does. A `pool-shapes.py` tool
  prints how many reels can serve each body, so "長 available on 27 reels"
  is a number in the log rather than a guess.
- **The code does not wait for this.** 長 is weighted 0.12 from day one and
  degrades to 常 on every reel without a long window; as reels are re-cut the
  body appears on its own.

---

## 6. Phases and gates

Each phase is one agent, one commit series, one VERSION bump where the owner
can hear the difference, and the harness run on the crew's seeds (3042, 17,
7, 8891 at one hour; the forty banked seeds at 30 min for a re-base).

**R0 — the plan object, no new shapes** (dev-visible). `choose()`,
`fitsRoom()`, `arm()` / `fire()` / `startSignal()`, `weather()`, the set and
the harness read a one-segment plan that is today's 常 exactly. *Gate:* home
identity 36/36 and the probe's note/event streams byte-identical on every
seed — the refactor proves itself by changing nothing. No bump if identity
holds (nothing the owner hears moved); bumps with R1 otherwise.

**R1 — 戻 the return and 同 the callback** (rc.69). The shape draws (twelve,
always), the return body inside and across windows, the callback preference
for the second broadcast, the set's *lost* / *relock* phases, the VFD lines,
`reel-lab.php`'s body buttons. **A declared re-base** in the same commit.
*Gates:* KIRU reach 0 and §12 sweep 0 on the real pool and on a forced
single-reel pool (the fall-through trap §14 documented); no melodic or PA
note inside any segment or gap; placement within the accepted cost (§7);
a new harness line — *shapes:* count by body / entry / exit per hour,
presence min / median / max, share ≥ 20 s — with **presence min ≥ 8.0 s on
every seed** as the floor gate; the return's second segment always lands
later in the source (asserted from `srcWindows` and the in-points).

**R2 — the entries, the exits and 断** (rc.70). Hunt, drift-in, lingering
loss, mid-word, the broken carrier. *Gates:* as R1; plus the AudioParam load
line stays under the owner's ~2 500/s cap (a hunt schedules more ramps than
a snap; measure it) and the node budget holds.

**R3 — 長 and the long windows.** Code: the long body, the degrade path
tested on a forced pool of reels that have no long window. Reels: the
recipe, the tool flags, and the owner's re-cut of the first Tier A batch on
the Mac — the one step no agent can do from here (the sources are not in the
repo). *Gates:* as R1; density on a forced long-window pool may fail the
±20 % band and that is accepted by the same ruling as §14 (long holds silence
the crew); the real pool is the gate.

**R4 — 走 the scan, the weights, the owner's listen.** The two-reel body,
then a listening pass on seeds 3042 / 7 / 17 and the weights moved to taste;
`GUIDE.md` §5 and its table of levers rewritten (the "reel / window" gloss
gains "reception" and "presence"). The listener-facing constants — every
weight in §3.5, the callback probability, the long-window lengths — live in
one table at the top of `zk-broadcast.js` so the owner moves one number and
it means the same thing on every night.

---

## 7. Decisions for the owner before R1 starts

1. **The floor.** §2's reading — presence ≥ 8 s per reception, short
   segments allowed inside a longer one — or a stricter one where every
   segment is ≥ 8 s (which makes the return 8 + gap + 8, a 30 s event at the
   least, and rarer).
2. **The air in a return's gap.** Held throughout (proposed: the crew stays
   quiet, the reception is one event), or released in gaps over ~8 s so the
   shakuhachi may comment between the two halves (more alive, more risk of a
   note landing on the relock — it would need the §12 lead re-derived).
3. **The placement cost.** Longer footprints will lower the pair rate a
   little (74 % today). Proposed acceptance: pair ≥ 65 %, empty ≤ 8 %,
   broadcasts/cycle ≥ 1.55. Or hold today's numbers and let the shapes
   degrade more often.
4. **Long windows.** Tier A only at first (proposed), 20–30 s, one or two per
   reel, twenty to thirty reels in the first batch. Any Tier B at all?
5. **The ♪ audition.** Stays 常 (proposed) or draws the full vocabulary.
6. **The glimpse.** Off (proposed) or a small weight.
7. **The weights** in §3.5 — a first setting to listen to, not a final one.

With 1–3 answered, R0 and R1 can be launched as one agent; R2 follows on the
same branch; R3's code half can run in parallel with the owner's re-cut.
