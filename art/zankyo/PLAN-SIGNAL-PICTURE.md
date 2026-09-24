# ZANKYŌ — 映り: how a picture comes in

*Plan written 2026-09-24 at the owner's request, against 2.1.0-rc.91. The
owner answered §9 the same night (§11) and asked for the overnight
critic/coder loop (§8) to run, with two bug-hunting passes added (Q0, QF),
and for the result to be merged and published when it finishes.*

The owner's request: the second set's picture should come in with much more
variety. There should be more kinds of damage, and each existing kind should
be richer, so that no two receptions look alike. It should stay realistic,
meaning actual distorted analogue video. The target is a viewer who keeps
pressing 受信 to see what the next one looks like, and who notices the
craftsmanship.

This is the same move the audio already made. PLAN-ZANKYO-2 and
PLAN-ZANKYO-FAR gave the music a seeded character per night. The picture
has not had that yet.

---

## 1. The audit: why every reception looks the same

The observation is correct, and the code shows exactly why. All line numbers
are at rc.91.

1. **One scalar drives everything.** `strength` (zk-set.js:365-415) sets the
   snow, the tear, the bloom, the ghost and the lit level together. Every
   reception follows the same curves on a different timeline. The picture
   never damages itself in more than one way at a time; it only has more or
   less of the one damage.
2. **There is one kind of snow.** It is uncorrelated white per-pixel sparks
   from a fixed formula (`snow²·0.85 + snow·0.08`, :480-487). There are no
   streaks, no clustered grain, no impulse bursts, no interference patterns
   and no hum.
3. **There is one ghost.** It is always a single right-shifted echo,
   `5 + 3·sin(t/900)` px, with a fixed alpha formula (:551-556).
4. **There is one tear.** Always 9 equal bands, the same `sin(t/170 + 1.9b)`
   and the same ±13 px jump (:513-522). The picture tears in bands, never
   line by line, and it never skews, bends or flags.
5. **The hold breathes identically every time.** The frequencies are always
   1.1 and 4.3 rad/s; only the phase is seeded (:396).
6. **There is one ending.** It is always squash (exponent 1.6), then a Paik
   line, a 0.32 s burst and 1.6 s dead (:540-588). 65 % of receptions are
   即/切, so most of them read the same way: a 0.4 s snap, a breathing hold
   with dropout stutters, loss, collapse.
7. **The tube never changes.** There is one P39 LUT (:215-225) and fixed
   persistence (:527). The brightness is stuck at step 1, because its
   control left the panel at rc.77.
8. **The picture ignores the signal it belongs to.** The audio chain has a
   band, flutter, grit, an AM LFO and a codec staircase (zk-broadcast.js:2074,
   2121, 2202). None of them reach the picture. A far night's tube looks
   exactly like a home night's; nothing in zk-set.js reads `d`.
9. **Nothing is per reel or per reception.** There is no seeded "reception
   character" of any kind. The only seeded picture variety is the crack
   pattern (4 patterns, one per night), the idle timings, the drop schedule
   and the breath phase.
10. **Two defects fall inside this work.**
    - The relock ramp reads `sig.rx.segments[0].lockS`, which is always 0,
      so every relock uses the 0.2 s fallback (zk-set.js:394).
    - Sweep snow is computed but never drawn while the phase is `dead`
      (:529).

    The header comments at :7 and :418 still say 96×72; the raster has been
    192×144 since rc.76.

**The instrument gap.** No harness or probe looks at the picture.
`_harness.js` excludes zk-set.js (214-219), and in `_probe.js` the set is a
no-op. Every picture decision so far has been judged by eye on
`reel-lab.php`. This plan needs an instrument before it needs more effects
(§6).

---

## 2. The rules that do not move

1. **Every impairment is a real analogue failure with a physical cause.**
   The plan names the cause (§3), and the effect moves the way that cause
   moves. For example:
   - hum bars roll at a slow, constant beat;
   - a ghost is a copy of the picture at a fixed delay, so it moves with the
     content, not with the clock;
   - co-channel stripes drift at the beat of two carriers.

   **Refused as digital:** RGB split, datamosh, pixel sorting, macroblocking,
   JPEG ringing and "glitch-art" clichés. This is a monochrome tube fed by
   an analogue signal, and nothing on it can have a chroma channel or a
   compression block. The codec staircase is an *audio* texture and stays
   there.
2. **The music does not move.** The picture reads from the engine; it never
   writes to it and never consumes an engine draw.
   - All picture choices go on the set's own forks (`set:rx:*`, `set:tube`),
     alongside `set:idle` and `set:crack`.
   - Texture may stay on `Math.random` (the character contract).
   - The gate is byte-identity of home and far nights against rc.91
     (`_far-identity.js`, plus `_harness.js` REPRO). Any field added to the
     `rx` descriptor is a read of values the receiver has already drawn.
3. **The timings do not move.** Entry, hold, loss, collapse, burst and dead
   durations belong to the receiver's plan, and the audio is cut to them.
   The picture may do anything *inside* those windows, and nothing that
   changes their length.
4. **The picture stays a picture.** The reels are the point: faces, idents,
   clocks, sign-offs. Damage frames the image rather than burying it (§6.3
   has the legibility floor). A reception that is almost all snow is a rare
   event, not a mode.
5. **It is never explained.** There is no label, no legend and no VFD line
   naming an impairment (owner, MONITOR-2 §11). The kanji names in §3 are
   for code, commits and the dev bench only. §9 Q6 asks whether that should
   change.
6. **Performance.** The tube currently runs at 0.58 ms mean / 2.0 ms worst
   at 192×144 (MONITOR-2 §9).
   - Budget: ≤ 2.5 ms mean and ≤ 6 ms worst on the laptop.
   - The low-power half rate still holds, and `document.hidden` still means
     no video.
   - Cost is driven by full-resolution compositing, not by the raster
     (MONITOR-2 §9), so new work goes into the 192×144 source pass wherever
     it can.
7. **Other standing rules.**
   - The Jukebox v2 substrate (`pj2-*.js`) is never modified.
   - Verify in WebKit as well as Chrome.
   - VERSION is bumped on every commit the owner can see.
   - The crack, the tape and the casing are out of scope.

---

## 3. The vocabulary

This is the catalogue of impairments. The kanji is the code and bench name.
**Axes** are the parameters drawn per reception. Each axis is a range to
draw from, not a constant, and that range is what makes an effect "richer".

### 3.1 雪 Noise: what the air adds

| name | physical cause | look | axes drawn per reception |
|---|---|---|---|
| 雪 snow (enriched) | thermal noise at a weak signal | grain | grain size (1–3 px clusters), horizontal correlation (weak-signal snow streaks sideways because the IF bandwidth smears it), bias (dark-leaning vs light-leaning), temporal flicker |
| 点 impulse | ignition, motors, switch arcs | short white horizontal dashes, arriving in bursts | burst rate (Poisson), dash length, clustering, whether bursts pulse at a steady rate like an engine idling |
| 縞 herringbone | co-channel or adjacent-channel carrier beat | fine diagonal stripes drifting through the picture | angle, pitch, drift speed and direction, strength, whether it wanders |
| 帯 hum bars | 50/60 Hz ripple, ground loop | one or two broad soft horizontal bands rolling slowly up or down | count, width, depth (darken vs lighten), speed; optionally tied to the audio AM LFO (§5.3) |
| 混 crosstalk | a second station on the same channel | another picture faintly underneath, behind venetian-blind stripes | depth, stripe pitch, which image (§5.4) |

### 3.2 同期 Sync and geometry: where the lines land

Today there are nine bands. This moves to **a per-line offset map at source
resolution**, 144 rows each with its own horizontal shift, so the damage can
be line-accurate.

| name | cause | look | axes |
|---|---|---|---|
| 縦 vertical roll (enriched) | vertical sync lost | picture rolls with the blanking bar visible | roll physics (overshoot, lock strength, drift), bar thickness, whether the sync pulse shows as a lighter strip inside the bar |
| 横 horizontal skew | horizontal sync lost | the picture shears into diagonal bars, then straightens as it locks | slope, number of bars, lock speed, wobble |
| 旗 flagging | timebase error at the top of the field | the top 10–25 rows bend sideways like a hook | depth, rows, flutter |
| 揺 line jitter | noisy sync | each line shivers by ±1–3 px | amount, correlation between neighbouring lines |
| 捩 wavy verticals | hum on the sync or AFC hunting | vertical edges ripple as a slow S-curve down the frame | amplitude, wavelength, speed |
| 裂 tear (enriched) | impulse on the sync | a few lines jump sideways at a random height | frequency, height, jump size, recovery; replaces the fixed nine bands |
| 伸 raster breathing | poor high-voltage regulation | the picture swells slightly on bright scenes | amount, lag |

### 3.3 路 The signal path: what the tuner and the air do to tone

| name | cause | look | axes |
|---|---|---|---|
| 影 ghosts (enriched) | multipath reflection | one to three delayed copies | per echo: delay (3–30 px), strength, polarity (a negative ghost is common and very convincing), leading echo (pre-ghost), and **flutter**: an aircraft reflection makes a ghost's strength swing at 1–4 Hz |
| 滲 smear and ringing | narrow bandwidth, mistuning | edges drag to the right, with a bright or dark outline echoing just after them | bandwidth, ringing amplitude and period |
| 飽 AGC and overload | too strong, or a slow AGC | whites crush, the contrast pumps on scene changes, and at the extreme the sync crushes into a brief **negative picture** | AGC speed, overshoot, clip level; negative-flash probability |
| 霞 wash | weak signal with the contrast up | lifted blacks, low contrast, fog | lift, gain |

### 3.4 管 The tube: one set, drawn per night

These are drawn once per night on `set:tube` and are subtle. It is the same
set every night, aged differently. Kept within the green family unless §9
Q4 says otherwise.

- **Phosphor ramp:** a small drift in the P39 curve (gamma 1.2–1.45, a
  tint shift within yellow-green) and in persistence (±20 %).
- **Focus:** slightly soft or slightly sharp.
- **Geometry:** a touch of pincushion or trapezoid, and a tiny tilt.
- **Faults:** occasionally a dim line or band (a tired capacitor), or burn-in
  (below).
- **焼 burn-in:** a faint ghost of the *previous* reception's last frame
  persists into the next one on some nights. It is the tube remembering.

### 3.5 出入 Entries and exits: the transitions

The timings are fixed by the receiver (§2.3). The *images* inside them vary.

**Lock-in (entry),** drawn per reception and consistent with the entry shape:
- a snap to picture (today's look);
- rolling in, then catching vertical lock;
- diagonal bars straightening (horizontal lock);
- a fade up from snow;
- an AGC overshoot bloom that settles;
- ghost first, then picture.

For 探 (hunting), each glimpse draws its own mix. For 浮 (drifting), the
impairment severities walk down as the picture drifts in.

**Loss (exit),** drawn per reception and consistent with the exit shape:
- today's squash to a Paik line;
- the roll accelerating away;
- dissolving into snow;
- tearing apart into diagonal bars, then black;
- freezing on a frame that snow eats;
- a negative flash, then gone;
- a vertical collapse (a line down the middle instead of across).

絶 keeps its hard cut. 残 lingers, so a fade, a freeze or burn-in suit it.

The collapse, burst and dead windows keep their lengths. Only what is drawn
in them varies.

---

## 4. 映り The reception character

Choosing effects at random gives noise. What makes a reception feel real is
that its damage is *coherent*: it has a cause. So each reception draws a
**character** first, and the impairments follow from it.

### 4.1 Archetypes: the conditions a signal arrives in

The weights are starting values and live in one constants block (§6.5).

| archetype | the story | primary impairments | secondary pool | weight |
|---|---|---|---|---|
| 遠 fringe | a distant station at the edge of range | 雪 heavy, 霞, 縦 slips | 点, 揺, 滲 | 0.22 |
| 反 multipath | city or mountain reflections | 影 two or three echoes, some fluttering | 滲, 裂 | 0.18 |
| 混 co-channel | two stations on one channel | 縞, 混 crosstalk | 帯, 雪 light | 0.12 |
| 電 local noise | machinery or a car nearby | 点 bursts, 帯 | 裂, 揺 | 0.13 |
| 同 bad sync | a tired set, an unstable transmitter | 横, 旗, 縦, 捩 | 揺, 裂 | 0.15 |
| 過 overload | too close, too strong | 飽 crush and pump, negative flashes | 伸, 影 light | 0.08 |
| 清 clean | a rare perfect catch | almost nothing: breath and faint snow | at most one light secondary | 0.07 |
| 嵐 storm | everything at once, briefly | two primaries from different archetypes | — | 0.05 |

### 4.2 Richness inside a reception

A reception is not stationary.

- **Every impairment has its own life.** Each one has an envelope (onset,
  swells, lulls) on its own seeded timeline, not glued to `strength`. Ghosts
  flutter, hum bars drift, impulse noise arrives in bursts, and the
  herringbone wanders in angle.
- **Conditions drift.** A slow seeded random walk (fading) moves severities
  within their drawn ranges, so the second half of a 30 s hold is not the
  first half.
- **The breath is drawn.** Its frequencies, amplitudes and number of
  partials are drawn instead of fixed at 1.1/4.3.
- **Dropouts differ.** Each dropout draws what it *does*: snow burst, roll
  kick, tear, frame hold, or a brief loss of horizontal lock. Today every
  dropout is the same −0.45.
- **Each piece of a shape is a new reception.** 戻 relocks and 走 swaps draw
  a *new* character: a new station means a new path.

### 4.3 Rarity tiers: the replay hook

A replay hook needs things to discover. Drawn on the same forks, so a seed
reproduces them.

- **Common** (most receptions): one archetype, and one to three impairments
  at modest severity.
- **Uncommon** (about 1 in 6): a secondary at high severity, a fluttering
  ghost, a full roll-in, burn-in.
- **Rare** (about 1 in 25): 嵐 storm, a negative-flash overload, a
  crosstalk picture that is recognisably another reel, a perfect slow roll
  that shows the sync bar.
- **Very rare** (about 1 in 80 or less): the picture holds perfectly and
  then the other station takes over through the stripes; a freeze with the
  burn-in of the previous reel; a vertical-collapse exit.

**Far nights** (§5.3) shift the tiers toward the rare end.

---

## 5. Mechanism

### 5.1 Code shape

A new file, `art/zankyo/zk-picture.js`, is loaded before zk-set.js. It holds:
- the impairment library (pure functions over the 192×144 buffer and the
  per-line offset map);
- the character draw: `drawCharacter(forkRng, ctx)`, returning
  `{archetype, tier, impairments[{kind, axes, envelope}], breath, entry, exit}`;
- the constants block.

zk-set.js keeps the phase machine, the canvases and the compositing. Its
frame becomes five ordered passes:
1. **Source, at 192×144 on ImageData.** Luma → AGC/overload/wash → smear and
   ringing (a 1-D filter per row) → noise (snow kinds, impulse, herringbone,
   hum) → crosstalk mix.
2. **Geometry, at 192×144.** The per-line offset map (skew, flagging, jitter,
   wavy verticals, tears), then roll and squash. It is applied while
   copying rows, so it costs one pass.
3. **Ghosts, at 192×144.** One to three shifted, scaled and possibly
   inverted adds from the same buffer, cheaper than today's full-resolution
   ghost.
4. **Tube LUT.** The per-night phosphor ramp.
5. **Full-resolution composite.** Persistence, bloom, focus, geometry warp
   (§3.4), the Paik and exit drawings, then the shards and the crack as
   today.

### 5.2 Seeds

The character forks off the master seed as `set:rx:<desc.seed>`, and 戻/走
pieces add the piece index. `desc.seed` is already a receiver draw, so the
same seed gives the same characters. The tube uses `set:tube`. There are
**no new draws on any engine stream.**

### 5.3 Coherence with the sound (reads only)

`startSignal` adds read-only fields to the `rx` descriptor: the layer's
`band`, `flutter`, `grit`, `lfoHz`, and the night's `d`. These are values
already drawn, so identity is gated. The character uses them:

- **Narrow band** → more smear and ringing, softer focus.
- **Audio flutter** → ghost flutter rate and depth.
- **Grit** → the impulse-burst rate.
- **The AM LFO** → the hum-bar speed and the AGC pump rate. The picture
  breathes with the sound you hear, which is the single strongest realism
  cue available.
- **Far distance `d`** → the tier weights shift toward rare, and 嵐/同/混
  become more likely.

The audio-only reels' generated pictures (`picture: line/static/wave` in
the manifest, currently ignored by the JS) choose a matching character: a
`static` reel draws 遠 or 嵐, a `line` reel draws 同.

### 5.4 Crosstalk needs a second image, and it is free

The set keeps the last full frame of the previous reception in a small
192×144 offscreen memory. That same buffer gives 焼 burn-in its image. The
crosstalk picture is either that memory, or a frame from the idle test card
(a station's slide). There is no new media element, no new bytes and no
extra decode. The "other station takes over" rarity crossfades within the
same buffer.

### 5.5 Defects fixed along the way

- Relock reads the segment's own `lockS` (zk-set.js:394). This is visible,
  so it is declared in the commit.
- Sweep snow is drawn while dead (:529), or the dead-phase early return is
  documented as intended. §9 Q7.
- The 96×72 comments are corrected.

---

## 6. The instrument (before the effects)

This lesson comes from the audio work: a gate that cannot fail is worse than
none (handoff/phase-W4-coder.md, the arm-lead clamp). So the picture gets
its instrument first, and every effect must show up in it.

### 6.1 The bench: `picture-lab.php` (dev-only, unlinked)

This bench is how the owner reviews the work, as well as how the critic
checks it. Built on the reel-lab pattern:
- Pick a reel (or the test card) and a seed.
- Choose the character three ways: **drawn** (reroll), **forced archetype**,
  or **forced single impairment** with sliders for its axes.
- Choose a shape: 即/探/浮 × 常/戻/断/走 × 切/残/絶.
- **Contact-sheet mode:** a 4×3 grid of tubes, the same reel under 12 drawn
  characters, side by side. This is the fastest way to see variety.
- **Freeze and step:** pause the virtual clock and step frame by frame.
- **Capture:** export a PNG strip for the critic.

### 6.2 Dev hooks

- `ZankyoSet._dev.character()` returns the current reception's drawn
  character.
- `_dev.force({archetype | impairment, axes})` overrides the draw.
- `_dev.seedTexture(n)` swaps `Math.random` texture for a seeded stream, so
  captures are pixel-reproducible. It is dev only and never on in
  production.

### 6.3 The picture probe: `_picture-probe.js`

Headless Chrome over CDP. This is the method already proven for ZANKYŌ; use
the background-throttling flags and `--mute-audio`, and poll on the clock
rather than trusting rAF. It drives picture-lab with seeded texture and
reports:

1. **The character distribution over 500 draws per seed set** (seeds 3042,
   17, 7, 8891, 101–136):
   - archetype and tier shares against §4 (±25 % relative);
   - distinct impairment combinations;
   - **the seen-before rate**: the share of receptions whose character
     vector falls within one just-noticeable difference of any of the
     previous 10. This is the picture's version of melodic DNA's
     heard-before gate. The JND is calibrated from the image metrics in 3.
2. **Does it render?** For each impairment kind, forced alone at median
   axes against the clean frame of the same reel, image metrics must move
   beyond their seeded-texture repeatability:
   - snow energy;
   - line-offset variance;
   - ghost autocorrelation peak at the drawn delay;
   - diagonal spectral energy (herringbone);
   - row-mean periodicity (hum bars);
   - edge overshoot (ringing);
   - histogram clip (AGC);
   - mean inversion (negative flash).

   **An impairment whose metric does not move fails by name.** This is the
   `_cover.js` rule: adding a kind without extending the list fails.
3. **The legibility floor.** Across drawn characters, SSIM between the
   impaired and clean frames during the hold:
   - the median is at least the floor;
   - no more than 1 in 8 receptions sit below the "buried" line.

   The floor is calibrated at P0 on today's look. Today's median hold is
   the reference: variety may go below it only in the tiers that are meant
   to.
4. **Performance.** `getState().frameMs` mean and worst, per archetype, at
   192×144 on the full-size tube, with the low-power path checked
   separately.
5. **Identity.** `_far-identity.js` and `_harness.js` REPRO against rc.91:
   byte-identical note and event signatures on home and far seeds.

The probe's own repeatability is measured first: three runs × three seeds.
Any spread is reported alongside every number, as W1 did.

---

## 7. Phases

One commit series per phase, and one VERSION bump where the owner can see
the difference. The work runs on branch `zankyo-picture` in a worktree at
`/Users/tysonwelsh/Sites/municipal-sky-site-picture`, served on its own port.
**Agents never merge, push or publish.** The orchestrator does that once, at the end, on the owner's instruction (§11.6).

| phase | what | gate | bump |
|---|---|---|---|
| **Q0** | **Reception reliability, before any picture work** (§11.4). Reproduce the owner's report — a video reception whose *audio chopped in and out*, not by design. Instrument real playback in headless Chrome (real media elements, real network, not the probe's mocks): media events (`waiting`, `stalled`, `seeking`, `ratechange`, `emptied`), `readyState` at decide time, and a ScriptProcessor tap on the broadcast bus that finds gaps. Classify every gap as **intended** (a scheduled drop, hole, 戻 gap, loss) or **not**, by lining it up against the plan the receiver wired. Run many receptions over several seeds and every shape, locally and under `Network.emulateNetworkConditions` (a slow 4G / shared-host profile, since production is a Bluehost host). Find the causes (candidates: a reel that is not buffered when it is seated, a relock seek or 走 `src` swap that stalls, the `playbackRate` glide re-set every 0.5 s, the A/B element hand-over, `preservesPitch`, a drop that is shorter than its ramp), fix them. | Zero unintended gaps in the local run; under throttling, any stall is covered (the audio degrades the way a lost signal does, never a stutter); every fix explained with the event trace that shows it; identity: home and far note signatures unchanged unless a fix needs a declared re-base, stated in its commit | rc.N if audible |
| **P0** | Split the frame into the §5.1 passes; per-line offset map; `zk-picture.js` with today's look as one hard-coded character; seeded texture; picture-lab (all but contact sheets); `_picture-probe.js` with its repeatability measured | With seeded texture, captures are **pixel-identical to rc.91's pipeline** at 20 fixed timestamps × 3 reels (a tolerance only if the canvas filter forces one, stated). Perf no worse. Identity byte-identical. | none (refactor) |
| **P1** | The character draw (§4.1–4.2), with the *existing* effects enriched: snow kinds, multi and negative ghosts, the line-accurate tear, drawn breath, dropout variety, 霞, 伸. Relock fix. Contact sheets. | §6.3 items 1–5 pass for the P1 kinds; seen-before ≤ 30 % (proposed; the probe calibrates it at P0 and the critic confirms); the legibility floor holds; perf within budget | rc.N |
| **P2** | New impairments: 点, 縞, 帯, 横, 旗, 揺, 捩, 滲, 飽 with the negative flash, and 混 crosstalk with the frame memory | Every new kind fails-by-name if it does not render; archetype shares within ±25 %; seen-before ≤ 20 %; perf | rc.N+1 |
| **P3** | Entries and exits (§3.5); per-glimpse and per-piece characters; 焼 burn-in | Receiver timings unchanged (the probe records phase boundaries and they must match rc.91 to the frame); every entry and exit variant appears in 500 draws; perf | rc.N+2 |
| **P4** | Coherence (§5.3): descriptor fields, the LFO-locked hum and AGC, flutter → ghost, grit → impulse, band → smear; far-`d` tier shift; the per-night tube (§3.4); rarity tiers (§4.3) | Identity byte-identical (the descriptor gains fields and nothing else); tier shares within tolerance on home and on `?far=0.9`; the hum bars' measured period matches `lfoHz` within 10 % | rc.N+3 |
| **QF** | **Final bug hunt** (§11.4): the whole app, not only the picture — console errors and unhandled rejections over long runs; the receiver, the set and the new picture across every shape, entry and exit; STOP/PLAY mid-reception; the button spammed; the dial swept during a reception; tab hidden and restored; phone width (the known 390 px overflow is out of scope unless trivial); WebKit where the tools allow; perf on the low-power path; the Q0 gap detector re-run on the final build. Everything found is fixed or written up. | zero console errors; the Q0 gap gate still green; all earlier gates re-run green on the final commit | rc.N if visible |
| **P5** | The owner's look: a handoff with contact sheets per archetype, per tier and per night; the constants block documented; ROADMAP updated | the owner | — |

---

## 8. The overnight loop

The loop is modelled on the far tail's (PLAN-ZANKYO-FAR §4), inside the
session's size guideline.

- **Orchestrator:** this session, or one lead agent. It creates the
  worktree, runs the phases in order, and hands each phase to a coder and
  then a critic. It keeps a running `handoff/picture-log.md`.
- **Coder** (one per phase, fresh context): reads this plan, the phase row
  and the previous phase's handoff. Builds, commits on the branch, and
  writes `handoff/phase-Pn-coder.md` with the probe output. It reports
  numbers, not a story (the FAR §15 standard).
- **Critic** (one per phase, fresh context, and it did not write the code):
  - re-runs the probe itself;
  - opens picture-lab in headless Chrome and captures contact sheets;
  - judges them against §2 and a realism rubric: does each impairment have
    its cause, and does it move like its cause; nothing digital; the picture
    stays a picture; no two tubes on a sheet read as the same station;
  - writes **numbered required items** in `handoff/phase-Pn-critic.md`.
- **Rounds:** up to three per phase. The coder answers the critic item by
  item, with measurements.
  - A phase passes when the critic signs off with the gates green.
  - If it has not passed after three rounds, the phase stops: the branch
    keeps the last green commit and the handoff says what is open. The loop
    goes on to the next phase only if that phase does not depend on the open
    item. P1 → P2 → P3 depend on P0; P4 depends on P1.
- **Scale:** at most two agents at once (the coder or the critic, plus the
  orchestrator); about 10 agent sessions if every phase needs its three
  rounds.
- **In the morning:** the branch, the handoffs, contact sheets in
  `handoff/picture-sheets/`, and picture-lab running on the worktree's port.
  The owner looks, and nothing reaches main until the owner says so.

---

## 9. The owner's decisions (a proposed default for each)

1. **Monochrome stays.** No colour, no chroma artefacts; the tube is green
   P39. *Default: yes.*
2. **The picture follows the sound** (§5.3). This touches
   `zk-broadcast.js` only to add read-only descriptor fields, gated by
   byte-identity. *Default: yes.*
3. **Far nights look stranger** (the tier shift). *Default: yes.*
4. **The tube ages per night** (§3.4): a small phosphor drift within green,
   geometry, burn-in. *Default: yes, subtle.* The alternative is to keep
   P39 exact and draw only focus and geometry.
5. **The legibility floor** (§6.3.3). Proposed: the median reception is at
   least as legible as today; no more than 1 in 8 is "barely there".
   *Default: as proposed.*
6. **The VFD stays silent** about impairments (mystery). *Default: silent.*
   The alternative is a single archetype word per reception in the log
   (`映 遠`), which would help people notice the variety but explains it.
7. **Sweep snow while dead** (§5.5): draw it, or keep the dead tube truly
   black. *Default: draw it faintly.* A dead tube that answers the dial
   hand is more alive.
8. **Autonomy overnight:** commit on the `zankyo-picture` branch in its own
   worktree; no merge, no push, no publish. *Default: as stated.*
9. **Archetype weights and rarity rates** (§4.1, §4.3) are starting values.
   They end up in one constants block for the owner to move after looking.
   *Default: accept as starting values.*

---

## 10. Brief for the agents

**Read first:**
- this plan;
- `zk-set.js` whole;
- `zk-broadcast.js` 60-180 (shape tables), 266-600 (plans), 1480-1500
  (weather) and 2071-2410 (`startSignal`);
- `reel-lab.php`;
- `PLAN-SIGNAL-INTEGRATION.md` §0 and §4;
- `PLAN-MONITOR-2.md` §9 and §11;
- `PLAN-SIGNAL-SHAPES.md` §7;
- `handoff/phase-W4-coder.md` (how instruments lie);
- `GUIDE.md`;
- the repo CLAUDE.md.

**Rules that do not move:** §2, and especially these:
- nothing on an engine stream;
- the receiver's timings are untouched;
- `pj2-*.js` is never modified;
- no digital artefacts;
- VERSION is bumped on visible commits, in the same commit;
- stage files by name, never `git add -A`: the checkout is shared
  (repo memory);
- no publish, no push, no merge to main (the orchestrator does that at the end, §11.6).

**Commands:**
- `php -S 127.0.0.1:<port>` from the worktree root;
- `node _harness.js 1800 3042` and REPRO;
- `node _far-identity.js 1800 20 5de3d45` (pinned to rc.91, not `main`, which may move overnight);
- `node _picture-probe.js` (built in P0).

**Order:** Q0 → P0 → P1 → P2 → P3 → P4 → QF → P5, as in §7, §8 and §11.

---

## 11. The owner's answers (2026-09-24, the night of writing)

1. **§9.4, the tube's tint drifts per night, but it is always green.** The
   drift stays inside the green family (yellow-green to blue-green, never
   amber, white or blue). Gamma, persistence, focus and geometry drift as
   §3.4 says.
2. **§9.5, the picture shows through in most receptions.** Heavily buried
   receptions are welcome as the rare end, but **never completely buried**:
   even the most buried reception lets the video come to the surface now and
   then, as a face or a shape rising out of the noise for a moment and
   sinking back. So the legibility floor has two parts:
   - the median reception is at least as legible as today;
   - **every** reception, including 遠 at its worst and 嵐, has moments
     where SSIM against the clean frame rises well above the buried line.
     Proposed: at least one surfacing of ≥ 0.6 s in any 5 s of hold. The
     probe measures it per reception, and a reception with no surfacing
     fails.
3. **§9.6, the VFD names nothing. Keep the mystery.**
4. **Bug-hunting passes are part of the build.** The owner heard one video
   reception whose audio chopped in and out in a way that was clearly not
   intended and distracted from the experience. So:
   - **Q0** runs first and finds and fixes that fault (§7);
   - **QF** runs last and hunts for anything else that is not working as
     intended (§7);
   - every coder also fixes, or writes up, any unintended behaviour it
     meets along the way.
5. **The rest of §9 takes its defaults:** monochrome; picture follows
   sound; far nights stranger; faint sweep snow while dead; the autonomy of
   §9.8; starting weights.
6. **When the run finishes: merge and publish.** The owner wants to see the
   result live in the morning, along with the session's earlier changes
   (rc.88–91: the title card, the transport in the scope's casing, the lamp
   off, the speaker). The orchestrator merges the branch's green commits to
   `main`, pushes (which deploys through Actions), and checks the live site.
   A phase that did not pass does not ship: the merge takes the last green
   commit.
