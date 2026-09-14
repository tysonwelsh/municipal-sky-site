# ZANKYŌ — the shapes of a reception (受信の形)

*Plan written 2026-09-14 at the owner's ask, against 2.1.0-rc.68, and
revised the same day with the owner's answers (§7). The observation: every
signal the set picks up is about the same length, and one signal has no
relation to the next — a clip, a long pause, another clip. The ask: keep
today's length as the floor, spread lengths widely up to the Cage reel's
maximum, add shapes (a signal that plays a few seconds, drops out, and
returns later in the same broadcast as though time passed while the carrier
was lost), let the instruments sometimes play over and between the pieces,
and make signals about 75 % more frequent than today. §1 is the audit; §2
the length rule; §3 the vocabulary; §4 the mechanism; §5 the reels; §6 the
phases and gates; §7 the owner's decisions; §8 the brief for the agent that
builds it — on the owner's Mac, because the reels' sources live there.*

---

## STATUS (2026-09-14) — R0 through R4's tooling are shipped

| | |
|---|---|
| **R0** | the reception plan object, proved by changing nothing (32/32 home nights byte-identical to main) |
| **R1** rc.69 | the budget, the frequency (1.70×), the drawn 15–90 s quiet, per-reception holds, the receiver's queue and its pair of media elements. A declared re-base. |
| **R2 + R3** rc.70 | the bodies, entries, exits, the 同 callback, the porous hold and the released gaps. A declared re-base. |
| rc.72 | the arm lead raised to 75 s — a far night's long note was committing 58.9 s ahead of a 55 s lead, breaking §12's guarantee. A declared re-base. |
| **R4** rc.71 + | `make-reel.sh --add-windows`, `tools/propose-long.py`, `tools/cut-long-batch.sh`, `tools/pool-shapes.py`, the §5 recipe in `broadcast/CURATE.md`. ONE reel re-cut as a proof; 185 of 208 reels have a proposed long window waiting. |
| **R4's batch** | NOT CUT. §5's order and §6's R4 gate both say the owner's ear decides; `tools/cut-long-batch.sh --plan N --run` is one command when it does. |
| **R5** | the owner's listen. The constants are in one block at the top of `zk-broadcast.js` and beside `BC_JO_P` in `zankyo-audio.js`; `GUIDE.md` §5–§6 are rewritten around receptions. |

**What the plan said would happen, and did.** §4.1's worst-case footprint
reservation was replaced by drawing the shape AT PLAN TIME — measured, the
worst case reserves 45 s for an 8 s budget and 92 s for a 40 s one, and a
seven-minute cycle then holds two receptions where the owner asked for nearly
three times that. §3.5's hoped-for gap release works exactly as hoped: the
footprint test means a phrase only lands in a gap if it fits, and 0 notes ran
into a relock across every seed, so the fallback is not needed.

**What the plan could not know.** The pool is the limit, not the design. With
12 s windows the degrade ladder strips about half the shapes and the median
reception is 9.3 s against an asked 21 s. Against a SIMULATED re-cut pool
(`ZK_MANIFEST=`) the ladder never runs, the median is 19 s and the achieved
distribution matches §2's table. §5 is the whole of what is left.

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

**How often, today:** 1.69 broadcasts a cycle (W4, rc.56), cycles of five to
ten minutes, so roughly 12–16 signals an hour, and about 4 % of the night
with a clip on the air.

**Where the constraints come from, so the redesign respects them:**

- **The air.** A broadcast holds the AIR from t0 − 6 to the loss + 2 + 3–6 s
  per voice; the melodic bodies commit notes up to 46 s ahead, so the hold is
  written at arm, 55 s before t0 (`BC_ARM_LEAD_S`). Today the next
  broadcast's arm calls `airHoldClear()` — a GLOBAL clear — so an ordinary
  reception owns exactly `BC_GAP_S − BC_ARM_LEAD_S = 40 s` past t0, and the
  95 s spacing exists to protect that. The receiver has ONE armed slot and
  ONE `<video>` element, so it cannot prefetch the next reel while one plays.
- **The KIRU.** A signal must end 15 s before the cut and start 20 s after.
- **The picture.** `zk-set.js` derives its phase every frame from one
  descriptor `{ t0, holdS, lossD, drops }` and knows exactly the sequence
  tuning → hold → loss → collapse → burst → dead. A reception with a gap in
  it needs a descriptor with segments.
- **The draws.** Every draw comes off the signal stream whether or not it is
  used, so the network never moves a night; new shapes must draw a fixed
  count too. Any change to the draws moves every home night — a **declared
  re-base** (`_harness-bank.js`), which the owner has accepted.
- **The harness gates** (`_harness.js`): ≤ 2 signals a cycle, none within a
  KIRU's reach, no melodic or PA note inside a hold, 2.2–3.6 signals per
  3 cycles, placement (1.68 broadcasts/cycle, pair 74 %, empty 5.8 % at
  rc.56), and per-seed melodic density ±20 % against the bank. Several of
  these are re-derived by this plan (§6).
- **The reels are immutable and the raw sources are not in the repo.** A
  re-cut reel gets a new `rev`; the sources live in `local-dev/broadcast-src/`
  on the owner's Mac (gitignored) or are re-fetched from each entry's `src`.
  So the re-cut is a step on the owner's machine, and the code must not
  depend on it having happened (§5).

---

## 2. The length rule (the owner, §7 q1 and q6)

**A reception's on-air time — the sum of the seconds you actually hear the
signal — is at least 8 s and at most the Cage reel's 40 s.** Pieces inside a
reception may be short (5 s, a gap, 3 s more: on air 8 s); a lone piece under
8 s never happens. There is no "glimpse".

**The spread is wide and today's length is uncommon, not rare.** The on-air
time is drawn from this distribution — the constant the owner tunes:

| on air | share | what it is |
|---|---|---|
| 8–12 s | 15 % | today's clip |
| 12–18 s | 25 % | |
| 18–25 s | 25 % | |
| 25–32 s | 20 % | |
| 32–40 s | 15 % | the Cage thoughts' range |

Median about 20 s. The draw is made at PLAN time, per broadcast (§4.1), so
the cycle can be laid out around it; the receiver then fills that budget with
a shape (§3). Where the pool cannot serve a budget (no reel with a window long
enough that has not played in the last three cycles), the budget degrades to
the longest the pool can serve — which, until the reels are re-cut (§5), is
12 s on every reel but Cage. **So the distribution above is only reachable
once the re-cut has happened; the code ships first and the spread appears as
the reels arrive.** A harness line reports the achieved distribution so the
gap between the two is a number.

Plain receptions (§3.1 常) take the whole budget as one hold — "two-thirds
stay plain, though of varying length" (§7 q7). Shaped ones split it.

---

## 3. The vocabulary — a grammar, not a list

A reception is composed of **a body, an entry and an exit**, each drawn from
the signal stream. The body decides what the signal *does*; the entry and exit
decide how it arrives and how it leaves. Every kanji is the log line
(「受信 · title · year · 戻」).

### 3.1 The bodies

- **常 the ordinary** — one segment, the whole budget: 8 s to 40 s of the
  reel, continuous. Two receptions in three (§7 q7). Not "today's clip" any
  more — today's clip is the 8–12 s end of it.
- **戻 the return** (the owner's example) — a piece of 3–10 s, the carrier
  lost for 6–15 s (low static, the tube rolling snow), then the SAME
  broadcast again, **later in the source**: the in-point advances by the
  gap × 1–3 (time collapsing — the transmission went on while we lost it),
  or, when the window has no room left, the reel's *next* window, a
  genuinely later moment of the same source (the windows are cut in source
  order and `srcWindows` says how far: the log can say 「戻 · 47 s later」).
  The relock is short (0.2 s), no 4 s static rise — the same frequency,
  found again. One return usually; two on a large budget. The pieces sum to
  the budget.
- **断 the broken carrier** — one piece with one or two holes of 1–3 s: not
  today's 120–370 ms dropouts but a real loss and recovery — the band
  narrows, the voice ducks under rising static, the picture tears and rolls,
  and it comes back where it *would* be (no seek; honest time). Holes do not
  count as on-air time.
- **走 the scan** — two different reels in one reception: the first is lost,
  the dial sweeps (the 掃引 static, 2–3 s), a second locks. The budget is
  split between them (each piece ≥ 4 s); both take the recent ring and the
  tide weighting. Plan §2.4 imagined this and it was never built.

### 3.2 The entries

- **即 the snap** — today's: static 4 s, tune 0.4 s.
- **探 the hunt** — the dial hunting 3–8 s: two to four glimpses of the
  picture and a syllable (0.3–0.8 s each) flickering out of the snow before
  it locks. On the tube: the vertical hold slipping, the picture resolving
  and losing again. The glimpses are not on-air time.
- **浮 the drift-in** — the signal surfaces from under the static over
  6–10 s: strength climbing, the band opening slowly (the highpass sliding
  down from 800 Hz), the picture condensing out of snow. No snap at all.

### 3.3 The exits

- **切 the cut** — today's: loss 1.6–2.8 s, collapse, burst.
- **残 the lingering loss** — the loss stretched to 6–12 s: dropouts
  thickening, flutter deepening, the voice surfacing through static two or
  three times before the cut; the tube tears and rolls the whole way.
- **絶 mid-word** — no loss ramp: a hard cut at full strength, the burst,
  dead. The rarest, and the one that makes the others feel like a loss.

### 3.4 Relations between receptions

- **同 the callback** — when a cycle carries more than one broadcast, a later
  one is the SAME reel with a later window, with probability 0.25: the
  station kept the frequency, and a minute later the same voice is back.
  One preference in `choose()`; the most direct answer to "no connection".
- **The silence between receptions is drawn, not fixed.** Today it is
  whatever ≥ 95 s the placement found. It becomes a draw of **15–90 s**
  between the end of one reception and the static rise of the next (§4.1),
  so signals sometimes come in quick succession and sometimes leave a long
  quiet — the same organic irregularity the shapes give inside a reception.

### 3.5 The air — who plays over and between the pieces (§7 q2)

- **Most receptions silence the melodic voices, as today: 70 %.**
- **30 % are porous:** one melodic voice, drawn (weighted toward the sparse
  ones — shakuhachi, biwa, hichiriki; never the intercom, which is a second
  speaker and would read as part of the broadcast), is left OUT of the hold
  and may claim the air over the signal. The log says which (「受信 … · 尺
  over it」). The harness counts its notes as *permitted*, not as intrusions.
- **The gaps inside a return are released.** The hold becomes a LIST of
  spans per voice (the air already keeps an array per voice), one span per
  piece, so the crew may come in between the pieces. `airClaimAt()` tests a
  note's whole footprint against every span, so a phrase only lands in a gap
  if it FITS in the gap — a 10 s gap takes a phrase of up to ~6 s and refuses
  a longer one. That is the "play a little in the silence and be quiet before
  it comes back" the owner described as the sophisticated version, and it
  falls out of the existing machinery; if it does not in practice (the bodies
  commit 33–46 s ahead and claim with an estimate), the fallback is a plain
  release with the return's relock allowed to land on a note.
- **Between receptions the crew plays, as today.**

### 3.6 Weights (a first setting, for the owner to tune by ear)

| part | weight | notes |
|---|---|---|
| body 常 ordinary | 0.67 | the whole budget in one hold |
| body 戻 return | 0.16 | |
| body 断 broken | 0.09 | |
| body 走 scan | 0.08 | needs room for two locks |
| entry 即 / 探 / 浮 | 0.65 / 0.20 / 0.15 | |
| exit 切 / 残 / 絶 | 0.65 / 0.25 / 0.10 | |
| porous hold | 0.30 | one voice over the signal |
| 同 callback | 0.25 of later broadcasts in a cycle | |
| silence between receptions | 15–90 s, drawn | |
| frequency | 1.75 × today (§4.1) | |

Entries and exits combine with every body, so 残 on a 戻 and 探 before a
30 s 常 both happen without being designed. Every number in this table lives
in ONE block at the top of `zk-broadcast.js` (the frequency and the silence
in `zankyo-audio.js` beside `BC_JO_P`), so the owner moves one value and it
means the same thing on every night.

---

## 4. The mechanism

### 4.1 The budget is drawn at plan, the shape at arm

Today the engine places two broadcasts a cycle at plan time and the receiver
decides the hold 55 s before t0; the engine protects itself with one global
spacing sized for a 12 s hold. That cannot carry a 40 s hold three times a
cycle. The change:

- **At plan** (`zankyo-audio.js`, the broadcast placement), each broadcast
  draws its **on-air budget** from §2's table and its **silence before it**
  (15–90 s), on the form stream's per-cycle fork as the positions are today.
  The footprint of a broadcast is then known at plan: static lead 4 s +
  entry (≤ 10) + budget + gaps (≤ 15 per return) + exit (≤ 12) + tail — the
  receiver exports the worst case per budget via `ZankyoBroadcast.limits()`
  so the two files cannot disagree. Placement walks the legal time (jo, ha,
  the sub-scenes; never kyū, oroshi, release; ≥ 55 s from the cycle start
  for the arm lead; 20 s clear of the KIRU on both sides; 90 s from a guest)
  and seats as many as fit: the target count is `round(legalS / 125)`
  clamped to 1–4, which lands about 3 a cycle on a 7-minute cycle, i.e.
  **1.75 × today's 1.69** (§7 q3). The number is tuned against the harness's
  per-hour count, not per cycle. P(jo) = 0.20 stays.
- **At arm** (55 s before t0, as today), the receiver draws the body, entry,
  exit, porous voice and callback — a fixed count of draws, always — picks a
  reel whose windows can serve the budget (the lottery's candidate set is
  filtered by longest window ≥ the budget's need; a whole reel keeps §14's
  rule: never sliced, served only when the budget covers a thought), and
  builds the **reception plan**:

  ```
  { id, reel, reel2?, budgetS, presenceS, spanS, body, entry, exit,
    segments: [ { inS, onS, lockS, reel } … ], gaps: [ … ],
    holes: [ … ], porous: voice|null, callback: bool }
  ```

  Everything downstream reads this object. **Degrade, never refuse:** if the
  pool cannot serve the budget the budget shrinks to what it can; if the room
  is short (the plan's footprint was worst-case; `fitsRoom()` re-checks the
  actual one) the shape loses its parts in order — the second return, the
  lingering exit, the hunt, the return itself — down to a plain hold.

### 4.2 Holds are per signal; the receiver keeps a queue

- **No global clear.** Each reception's air hold is written under its own
  owner id (`signal:<cycle>:<n>`) and cleared by that id at teardown or
  fallback. `airHoldClear()` without an argument is retired from the signal
  path. This removes the reason `BC_GAP_S` existed; the spacing becomes the
  drawn silence plus the footprint.
- **Two armed slots.** `armed` becomes a short queue so the next reception
  can arm (and write its hold 55 s out) while one is on the air.
- **Two media elements**, A and B, alternating, so the next reel prefetches
  while the current plays (one element cannot). The set's descriptor already
  carries `video: v`, so the tube draws whichever is live. In `?reels=buffer`
  mode the decode is independent and nothing changes.
- **The re-derivation note** in `zankyo-audio.js` (the `BC_GAP_S` block) is
  rewritten to describe the new contract; the play-time assertion against
  `ZankyoBroadcast.limits()` checks the new one (arm lead > body lookahead
  still holds: 55 > 46).

### 4.3 The graph, the seeks, the set, the log

- **`startSignal()`** builds the same graph once (band, receiver, flutter,
  gate, staircase, envelope, phasing, room tap) and walks the plan: the
  envelope and the band ramps are scheduled per piece; in a gap the gate
  ducks to a carrier-lost floor (below `DROP_FLOOR`) with the hole static
  rising and the band narrowed; a hole is the same at 1–3 s. The seek
  between pieces is `v.currentTime = inS` (a keyframe every second, so one
  keyframe) or a second `BufferSource.start(t, inS)`. 走 hands off to the
  other element for its second reel. The hunt and the drift-in are scheduled
  before the first piece on the same nodes; 残 is a longer exit envelope with
  a denser dropout schedule from `weather()`, which now draws across the
  plan's whole span.
- **The set** (`zk-set.js`) takes the plan in the descriptor: `phaseOf()`
  walks pieces, gaps and holes — *lost* (snow, the roll, the last frame
  ghosting), *relock* (0.2 s), *hunting* (glimpses at the plan's times),
  *drifting* (strength ramps over the entry's length) — and the rx lamp
  follows.
- **The VFD** gains the shape: 「受信 · title · year · 戻 47 s later · 尺
  over it」, 「消失 · signal lost · 21.4 s on air · 34 s」. The `sig` the
  harness records carries `budgetS`, `presenceS`, `spanS`, `body`, `entry`,
  `exit`, `porous`.
- **The manual paths.** The ♪ audition, the 選局 scan and the tuning dial
  all draw a budget from §2 and a shape from §3 (§7 q5) — the audition
  shows what a signal *is*, and what it is has changed. `reel-lab.php` gains
  a row of body buttons and a budget slider so a shape can be seated on
  demand for A/B.
- **Nothing in the shared substrate moves.** `pj2-*.js` is untouched; the
  air's hold API already takes arbitrary spans per voice.

### 4.4 What this costs the night, said plainly

About three receptions a cycle at a 20 s median with entries, exits and gaps
puts a clip on the air roughly **15 % of the night, against 4 % today**, and
the melodic crew silent for most of that (70 %). The re-base will show it as
a drop in melodic density on home nights; §6 declares it. This is the owner's
intent (§7 q3), stated so nobody reads the density line as a regression.

---

## 5. The reels — a re-cut on the owner's Mac

**The manifest's shape does not change.** `windows` stays `[start, end]`
(§14's rule, for the five positional readers); `srcWindows` already carries
what the return needs; `whole` / `wholeWindows` keep their meaning.

**戻, 断, 走, 同, every entry and exit, the porous hold and the frequency
work on today's reels.** Only the SPREAD of lengths (§2) waits on longer
windows — and until they exist every budget over 12 s degrades to 12 s on
every reel but Cage, so the first build sounds like today's lengths with the
new shapes and frequency, and the lengths open up as reels are re-cut.

**The recipe** (`CURATE.md` gains it; the owner ruled on tiers in §7 q4):

- Each reel keeps its 12 s windows and gains **one or two long windows**,
  contiguous, chosen for a stretch that stays interesting that long — a
  countdown, a sign-off, a chant, a lecture, a news package, a jingle
  package. Lengths spread across the reels so §2's distribution is servable:
  roughly a third at 18–25 s, a third at 25–32 s, a third at 32–40 s.
- **Tier A** (53 reels, free to use): up to **40 s**.
- **Tier B** (155 reels, copyrighted): up to **30 s**, speech or picture
  material, never a whole song, never a whole scene — the owner's ruling:
  transformative, degraded, randomly surfaced, no substitute for the
  original. The 6-window cap stays; the long windows count toward it, so a
  Tier B reel with six 12 s windows drops one to gain a long one.
- **Cost:** about +0.5 MB a reel, so the pool goes from 144 MB to roughly
  250 MB. GitHub and Bluehost are fine with it; `scripts/publish.sh` already
  skips `reels/`; the Actions deploy ships them once.
- **Tooling:** `make-reel.sh --add-windows a-b,c-d` appends long windows to
  an existing reel from its cached source (`local-dev/broadcast-src/`,
  re-fetched from `src` if absent), re-encodes, writes a new `rev`; the pitch
  pass runs on the new windows as on any. `build-manifest.sh` validates as
  today. A new `tools/pool-shapes.py` prints, per budget bucket, how many
  reels can serve it and which tiers/tones they are, so "32–40 s: 41 reels"
  is a number in the log and the harness's achieved-distribution line has a
  ceiling to be read against.
- **Order:** a first batch of 60–80 reels across tiers, tones and countries
  (so no bucket is served by one kind of material), then the rest. The
  agent proposes each reel's long windows from the source's scene changes
  and loudness (`--propose` with `--window-len 30` already does most of
  this) and the owner auditions by ear with `preview.sh` and the reel lab.

---

## 6. Phases and gates

Each phase is one commit series, one VERSION bump where the owner can hear
the difference, and the harness on the crew's seeds (3042, 17, 7, 8891 at
one hour; the forty banked seeds at 30 min for a re-base). The probe
(`_probe.js`) runs beside it as today.

**R0 — the plan object, no new behaviour.** `choose()`, `fitsRoom()`,
`arm()` / `fire()` / `startSignal()`, `weather()`, the set and the harness
read a one-piece reception plan that is today's clip exactly; holds gain an
owner id but are still cleared as today. *Gate:* home identity 36/36 and
the probe's note/event streams byte-identical — the refactor proves itself
by changing nothing. No bump if identity holds.

**R1 — the budget, the frequency, the silence between, the queue**
(rc.69). §4.1 and §4.2: the placement rewritten around budgets and drawn
silences, per-signal holds, two armed slots, two elements. Shapes still 常
only; budgets degrade to 12 s on today's reels. **A declared re-base.**
*Gates:* KIRU reach 0; §12 sweep 0 (no melodic or PA note inside any
hold) on the real pool and on a forced single-reel pool; signals per hour
= 1.75 × the same seeds on rc.68 (measured one-variable, ±15 %); no
reception overlaps another; every hold's arm lead ≥ 55 s; the harness's
"max 2 a cycle" gate becomes ≤ 4 and "2.2–3.6 per 3 cycles" is retired for
the per-hour target; **presence min ≥ 8.0 s on every seed** (the floor).

**R2 — the shapes** (rc.70). §3.1–3.4 and the set's new phases, the VFD
lines, the manual paths, the reel lab's buttons. *Gates:* as R1; a new
*shapes* line — count by body / entry / exit per hour, the achieved
on-air distribution against §2's table and against `pool-shapes.py`'s
ceiling; a return's second piece always later in the source (asserted from
`srcWindows` and the in-points); pieces within a reception never overlap;
the AudioParam load stays under the ~2 500/s cap (a hunt schedules more
ramps than a snap) and the node budget holds.

**R3 — the air** (rc.71). §3.5: porous holds and released gaps. *Gates:*
notes over a porous signal are only ever the permitted voice (the §12 sweep
learns the exemption and still reports 0 for every other voice); a note in
a return's gap never runs into the relock (the footprint test), reported as
a count so the fallback in §3.5 is a measured decision.

**R4 — the reels** (no code bump; a manifest commit per batch). The recipe,
`--add-windows`, `pool-shapes.py`, the first batch of 60–80 re-cut reels,
then the rest. *Gates:* `build-manifest.sh` clean; every long window inside
its tier's cap; the harness's achieved distribution moving toward §2 as
batches land (reported, not gated — the owner's ear is the gate).

**R5 — the owner's listen.** Seeds 3042 / 7 / 17 through the console and
the reel lab; the weights in §3.6 and the table in §2 moved to taste; the
listener-facing constants gathered into one block; `GUIDE.md` §5 and §6
rewritten ("reel / window" gains "reception", "budget", "on air").

---

## 7. The owner's decisions (2026-09-14)

1. **The floor is the reception's total.** On-air time ≥ 8 s summed over
   its pieces; pieces may be 5 s and 3 s. Widest possible spread from 8 s to
   the Cage maximum (40 s); 8 s clips uncommon, not rare. → §2.
2. **The instruments do not stay quiet in the gaps**, and sometimes play
   over the clip itself; most of the time the clip still silences them. The
   sophisticated version (play in the gap, quiet before the return) is not
   required — it is taken where the air machinery gives it for free. → §3.5.
3. **Signals 75 % more frequent than today**, independent of the shapes;
   the spacing cost is accepted. → §4.1.
4. **Long windows from every reel, both tiers.** Up to 30 s of a copyrighted
   broadcast is fine (transformative, degraded, random, no substitute for
   the original); Tier A to 40 s. The re-cut runs on the Mac. → §5.
5. **The ♪ sample button plays the new shapes.** → §4.3.
6. **8 s is the minimum. No glimpse.** → §2.
7. **Two receptions in three stay plain (of varying length); one in three
   is shaped.** The weights in §3.6 are the first setting. → §3.6.

---

## 8. Brief for the agent that builds it (on the owner's Mac)

The code phases can run anywhere; R4 needs the Mac because the raw sources
are in `local-dev/broadcast-src/` (gitignored) and `ffmpeg` / `yt-dlp` are
installed there. Work on the branch this plan was pushed on
(`claude/zankyo-clip-variation-nidfn8`) or a fresh one from `main`.

**Read first:** this file; `zk-broadcast.js` in full (the receiver; every
constraint has a comment beside it); `zankyo-audio.js` from the `BC_JO_P`
line through the placement (`pendingPlan`) and `airClaimAt` /
`airHoldClear`; `zk-set.js` (`phaseOf`, `tickSignal`, `renderSource`);
`_harness.js`'s `signalVocab` and the gate list at its end; `_harness-bank.js`;
`PLAN-ZANKYO-FAR.md` §14–15 (the whole-thought rules and what each gate
actually sees); `broadcast/CURATE.md`; `CLAUDE.md` (the VERSION rule).

**Rules that do not move:** `windows` stays `[start, end]`; a whole window
is never sliced; every draw is taken whether or not it is used; the Jukebox
substrate (`../prosperos-jukebox-v2/pj2-*.js`) is never edited from here;
no signal within a KIRU's reach; the arm lead exceeds the bodies' 46 s
lookahead; VERSION bumps in the same commit as anything the owner hears or
sees; a re-base is declared in the commit that needs it.

**Commands:**

```
cd art/zankyo
node _harness.js 3600 3042          # one seed, one hour (also 17, 7, 8891)
node _harness.js 3600 3042 --far 0.9
node _probe.js                      # the home-identity gate across the banked seeds
node _harness-bank.js               # THE RE-BASE: rewrites _harness-base.json (declare it)
broadcast/tools/make-reel.sh <src-or-url> --id <slug> --propose --window-len 30
broadcast/tools/make-reel.sh <src-or-url> --id <slug> --add-windows 83-110,201-236   # new flag, R4
broadcast/tools/preview.sh <slug>
broadcast/tools/build-manifest.sh
```

**Order:** R0 → R1 → R2 → R3 in code, each with its gates green before the
next; R4 in batches whenever the owner's ear is available; R5 last. Report
each phase with the harness lines it changed and the numbers, not a story
about them (`PLAN-ZANKYO-FAR.md` §15 is the standard for why).
