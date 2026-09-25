# HOLLER ROLLER 1.0 — the plan (2026-09-25)

Companion to `REVIEW.md` (what is wrong with V0.38) and `PLAN.md` (the
original design: pillars, flavour, derangement — still canon). This
document is the build contract for taking the prototype to a playable
game. Where it disagrees with `PLAN.md` on mechanism, this wins; on
flavour, `PLAN.md` and `../arcade/WORLD.md` win.

Working branch: `skeeball-2` (worktree `municipal-sky-site-skeeball`).
Local server: `http://127.0.0.1:8073/art/skeeball/`. Harness:
`local-dev/skeeball-lab/` (gitignored). Nothing is pushed or published
from this plan; the owner reviews locally first.

## 0. Non-negotiables

- **Same look.** The static machine art, palette and pixel toolbox stay.
  216 px wide, `image-rendering: pixelated`, procedural, no binary assets.
  New art (ball in flight, rim occlusion, drum roll, tickets, attract)
  must be drawn in the same hand: 3×5 font, Bayer dither, the PAL colours.
- **Vanilla JS, no build step, no dependencies**, one `window.*` namespace
  per file, PHP page shell with the site header/footer. Physics and
  render stay pure and Node-loadable (a `typeof module` guard, no DOM).
- **Deterministic.** No `Math.random`, no `Date.now` in sim or render.
  Seeded hashes only. Same seed + same inputs = same throw, forever.
- **Mobile first.** Portrait phone, one thumb, Pointer Events,
  `touch-action: none`, no page scroll during play. Desktop mouse works.
- **Fixed-step sim** (120 Hz loop, 240 Hz physics substeps), render on
  rAF, clock injectable for the harness.
- **Version file.** `art/skeeball/VERSION`, one line
  `1.0.0-rc.N — what the owner would notice`, bumped in every commit that
  changes what the owner sees or hears (same rule as Jukebox / ZANKYŌ in
  CLAUDE.md). `index.php` renders it in the blurb with an asset
  fingerprint. The canvas corner stamp shows the same string.
- **Commit narrowly** (`git add art/skeeball/... art/index.php`), never
  `git add -A`. Commit early and often on `skeeball-2`.

## 1. Files after the rebuild

```
art/skeeball/
  index.php             page shell (unchanged shape) + VERSION render
  skeeball.css          framing; stage fills the viewport under the header
  skeeball-main.js      boot, input, game state machine, loop, cabinet API
  skeeball-physics.js   NEW: continuous 3-D ball sim (§3)
  skeeball-render.js    static art (kept) + 3-D projection + live layers (§5)
  skeeball-audio.js     NEW: Web Audio SFX + room tone (§6)
  skeeball-mischief.js  NEW: derangement events (§7)
  VERSION
  PLAN.md  PLAN-2.md  REVIEW.md
local-dev/skeeball-lab/  (gitignored)
  cdp.js        headless Chrome driver (screenshots, scripts, swipes)
  sim.js        Node CLI over skeeball-physics.js: batch throws → metrics
  film.js       capture a throw as a contact-sheet PNG for visual review
  ...           whatever the critics need
```

`ramp-perspective-sandbox.html` and the unused camera variants are
deleted. The pixel toolbox is imported from `../arcade/arcade-sprites.js`
and `../arcade/arcade-palette.js` (script tags in `index.php`); the
renderer keeps only the machine-local colours (wood, lane, cork, brass).

## 2. Machine geometry (shared truth)

One coordinate system for physics **and** render, in *units*:
1 unit = half the lane width ≈ 14 in; ball radius 0.11 (a 3 in ball).

```
                z →
  y ↑
        ╭─ backstop wall (z = zTop)
        │   ○100          ○100         bed plane: rises at β from the lip
        │        ◎◎◎◎◎ rings           centre C = (0, ·, zC), rims are
        │      ◎◎◎◎◎◎◎◎◎               raised hoops of height rimH
        ╰──────────────── lip (z = zLip, y = yLip)
   ______/‾‾\  ▒▒▒ pit (floor y = -pitDepth) between crest and lip
  lane y=0    hop: z ∈ [zHop, L], a smooth ramp to the crest at (L, hCrest)
  z=0 throw line
  x ∈ [-1, 1] between the side rails
```

Physics owns the numbers (`TUNE`) and exposes `surfaceAt(x, z)` for the
lane/hop, `bed` plane parameters, ring radii, hole positions, wall
extents. The renderer's `project(x, y, z)` is fitted to the **existing
drawn art** (lane rows via the current `laneRowAt`, bed points via the
current `bedPoint`, height above surface scaled by the local perspective
scale), so the picture does not change while the math underneath does.
`R.project` must be continuous across lane → hop → pit → bed.

The physics module exports `GEO` (derived from `TUNE`) and the renderer
asserts at boot that the drawn ring radii / hole positions match it
(`syncGeometry` survives as a one-way check in the other direction: the
drawn `GEO.rings[0]` defines the on-screen scale of the bed).

## 3. Physics rewrite — a real ball (`skeeball-physics.js`)

State: `{x, y, z, vx, vy, vz, w (spin about the vertical axis), phase,
t, seed, events[], trail[]}`. Semi-implicit Euler, `dt = 1/240`, two
substeps per 120 Hz tick. Phases are *labels* for the renderer, not
separate physics: `roll → hop → flight → bed → captured | gutter → done`.

Contacts and forces:
- **Lane (z < zHop):** rolling on `y = 0`. Rolling resistance
  `a = -μr·g` (μr ≈ 0.02–0.04), no incline. Spin `w` adds a small lateral
  acceleration that *grows* as the ball slows (the late hook), capped.
  Side rails at `|x| = 1 - r`: reflect `vx` with restitution 0.5, damp `w`.
- **Hop (zHop ≤ z ≤ L):** the ball follows a smooth ramp `y = ramp(z)`
  (a quarter-cosine or circular arc rising to `hCrest` at `z = L`, tangent
  angle at the crest = launch angle ≈ 35–45°). Velocity is projected onto
  the surface tangent; gravity along the slope decelerates it. A ball
  that stalls on the hop rolls back down the lane to the player
  (`return` event) — real skee ball humiliation, keep it.
- **Flight:** ballistic with `g`; spin gives a small lateral drift
  (Magnus-ish, tiny). Ends at contact with the bed plane, the backstop,
  a side wall, a rim, or the pit floor.
- **Bed:** an inclined plane at angle β. Contact resolution: decompose
  velocity into the plane normal and tangent; normal restitution
  `e ≈ 0.35` (cork is dead), tangential friction; the ball then *rolls*
  on the plane under `g·sinβ` down-slope plus rolling resistance. Side
  walls at `|x| = bedHalfW`. Backstop wall at `zTop` (restitution 0.3).
  A ball rolling off the bottom lip (z < zLip on the plane) falls into the
  pit → `gutter` → done, score 0.
- **Rings as hoops with holes.** Concentric rims at radii `R_k` around C
  in the bed plane, each a raised hoop of height `rimH ≈ 0.08` and
  thickness `rimW ≈ 0.05`. Between rims the bed is *open* (a cup). Rules:
  - A ball whose height above the plane is < `rimH + r` and whose
    distance from a rim circle is < `r + rimW/2` collides with the rim:
    reflect the radial velocity component (restitution 0.45) and lose a
    little tangential speed. This is the rattle and it is *physical*.
  - A ball resting on the plane (normal speed ~0) inside band k, not
    touching a rim, drops into cup k: `captured` event with the band's
    score, then a 0.35 s sink animation, then `done`.
  - A fast ball can clear a rim entirely if it is high enough — that is
    how a 20 becomes a 40 on the bounce, and how a hot ball skips the
    whole stack into the backstop and drops into the 10 on the way back.
  - The **dented 40**: the 40's rim (`R_3`) has a flat spot on its upper
    right octant where `rimH` is 40 % lower. Balls arriving there from
    up-bed tend to skip out into the 30. Visible in the art (§5).
- **The 100 holes:** two circular holes (radius ≈ 0.14) in the bed above
  the ring stack, each with a raised lip (`rimH` hoop). Capture rule as
  for a cup. They are reachable only with near-full power *and* lateral
  aim; the metric target is in §8.
- **Pit:** a ball that does not clear the gap lands on the pit floor and
  is swallowed (`gutter`).
- **Safety:** any ball not resolved 8 s after launch is force-captured
  into the band it is over (or `gutter` if outside the stack), with a
  `timeout` event so the harness can count them. Target: zero timeouts in
  10,000 random throws.
- **Determinism:** the only randomness is `hash01(seed, stepIndex)` used
  for ±3 % roughness on rim restitution and a tiny bed-texture lateral
  nudge. Everything else is arithmetic.

Exports: `TUNE`, `GEO`, `createThrow(x0, v, aim, spin, seed)`,
`step(ball, dt)`, `pose(ball)` → `{x, y, z, r, phase, sinking, cup}`,
`simulate(throwArgs, {maxT})` → full trail + final event (for the CLI),
`surfaceAt`, `project`-independent helpers. Guarded for Node
(`if (typeof module !== 'undefined') module.exports = ...`).

## 4. Input rewrite — the throw (`skeeball-main.js`)

The rule from `PLAN.md` still holds: **the ball leaves at the angle you
swiped, at a speed you can feel.** New model:

- **Swipe zone = the whole lower half of the canvas** (lane + rail +
  front panel + the room floor beside them). A pointerdown there rests the
  ball at the throw line under a chalk aim-ghost; the ball does *not*
  ride the thumb up the lane beyond a short cosmetic wind-up (≤ 15 % of
  the lane). The throw launches from the throw line with the thumb's
  release velocity. No energy compensation; what you see is what happens.
- **Power = release speed of the last ~90 ms of the gesture**, in css px/s
  normalised by the canvas's displayed height (so a phone and a desktop
  swipe feel the same). Mapped through one curve `v = vMin + (vMax -
  vMin) · smoothstep(p)`. Exactly three constants: `SPEED_FLOOR` (below
  it, a dead roll), `SPEED_CEIL` (saturates), `GAMMA`.
- **Aim = direction of the same window**, clamped to ±25°. The chalk
  ghost rotates live during the drag so the player sees the aim before
  release.
- **English is opt-in and small:** a deliberate sideways hook at the very
  end of the gesture (last 40 ms heading vs. the prior 90 ms), thresholded
  so a natural thumb arc gives none. Cap it so a full hook moves the
  landing by about one ring.
- **Feedback while dragging:** the ghost arrow's length = power, its
  angle = aim, a pixel "wind-up" of the ball behind the throw line. On
  release the ghost snaps to chalk dust (3 frames) and the ball goes.
- **Tap** (no motion) does nothing except, in ATTRACT, on the coin door.
  A second pointer while one is down is ignored entirely (`pointerId`
  guard); `pointercancel` clears cleanly.
- **Desktop:** mouse drag identical; keyboard space = medium straight
  throw, arrows nudge aim (accessibility + harness convenience).

## 5. Rendering (`skeeball-render.js`)

- **Prune** to the `grand` layout only; delete variants, sandbox,
  window/sign code, legacy branches. Import toolbox + night palette from
  `../arcade/`.
- **`project(x, y, z)`** (§2), plus `shadowAt(x, z)` (the ball's contact
  shadow on whichever surface is under it: lane, hop, bed; none over the
  pit).
- **Ball sprite by depth:** radius from `project().scale`
  (≈ 6.8 px at the throw line → ≈ 3.2 px at the ring centre); glint and
  scuff as today; a 1-px motion streak only above a speed threshold.
- **Occlusion:** when a ball is inside a cup and sinking, draw it, then
  redraw the *near* arc of that cup's inner rim over it (the ring
  ellipses already exist; keep them as small pre-rendered sprites per
  ring). The ball visibly drops *behind* the hoop. Same for the 100
  holes (the pink glow brightens as it swallows the ball).
- **Bed roll:** a ball rolling on the bed is drawn at its projected point
  with the perspective radius; the trail dots only while airborne.
- **Machine reacts:** drum counter rolls (each digit slides vertically
  over ~150 ms, tens digit sticks and catches up late, as the plan says);
  racked balls: 9 → 0 as balls are thrown, one lit "next ball" lifting
  into the lane at ball start; ticket window cranks tickets out
  (a pink strip extending pixel by pixel with a ratchet); score toast as
  today; a pink flash of the 100 hole on a jackpot; possum eyes track the
  ball's projected x (±2 px pupils) and widen on a 100.
- **Attract mode:** marquee chase (the neon tube pulses along its
  length), possum blinks, the ball rack full, a "5¢ — SWIPE" chalk note
  on the lane fading in and out, the drums showing the high score every
  8 s. **Payout:** drums hold, tickets crank, a "13" if a 100 was hit.
- **Dent on the 40** redrawn as a readable 6–7 px flat with a chipped
  cork highlight so the player can see why balls skip out there.
- **Screen use:** keep 216 wide; let internal height be chosen at boot
  between 384 and 448 (the room above the marquee and the floor below the
  plinth extend; the machine itself never moves) so a tall phone fills at
  the largest integer scale. `.skeeball-stage` becomes `100dvh` minus
  the header, the blurb moves *below* the fold, and `overscroll-behavior:
  none` on the page during play.

## 6. Audio (`skeeball-audio.js`)

Web Audio, procedural, unlocked on the first pointerdown, muted when the
tab is hidden. Master gain modest (the site's other engines are louder).
Events → sounds:
- `roll` (continuous): filtered noise, cutoff and gain follow speed,
  cross-fades to a hollow tone on the hop.
- `launch`: wooden *clack*. `rim`: cork *tok* with pitch by impact
  speed. `bed`: a soft thud. `captured`: cup *thunk* + the solenoid bell
  (sine + short decay, pitch by score; the bell goes 30 cents flat when
  the machine is sulking). `100`: bell ×3 + a pink neon buzz swell.
  `gutter`: a hollow drop and a rattle down the return. `return`: a long
  wooden rumble back to the rail.
- `coin`: nickel drop + mechanism. `ticket`: ratchet clicks per ticket.
  `drum`: a mechanical tick per digit step.
- Room tone in ATTRACT and PLAY: 60 Hz hum with a 120 Hz partial and a
  slow flutter, distant insects (sparse filtered clicks), and the attract
  waltz — a 3/4 chiptune loop of ~12 bars, one voice detuned +9 cents,
  played at -20 dB only in ATTRACT.

## 7. Derangement (`skeeball-mischief.js`) — after the core is fun

All from `PLAN.md` §4, all *telegraphed*, none steals a throw. Each is
a pure function of (game state, seed) so the harness can force them.
- **The lean:** per-game lateral bias field on the lane
  (`TUNE.lean = ±0.06..0.14 units/s²`, sign and magnitude from the game
  seed). Ball one teaches it; the chalk ghost is honest (it shows aim,
  not the drift).
- **Dented 40:** physical (§3); the art shows it (§5).
- **Moon event:** once per ~4 games, for one ball, the room goes bruise
  purple, the 100 holes breathe brighter and their capture radius is
  1.5×. Announced 1.5 s before the ball is thrown (colour shift + hum
  change).
- **The sulk:** after a 100, the next ball's bell is flat and the ball
  rolls back down the hop as if refused; the ball is *not* consumed (the
  rack does not decrement) and the possum's eyes narrow.
- **Ticket jam:** ~1 in 6 payouts jams mid-crank; tap the slot to whack
  it loose. Purely cosmetic and always completes.
- **Possum interest:** eyes track every ball; on three scores of 40+ in
  a row the head tilts 1 px and stays tilted for the game.
Flags written to `Arcade.flags`: `skeeball.saw-the-moon`,
`skeeball.hit-100`, `skeeball.made-it-sulk`, `skeeball.jammed`.

## 8. Game loop and economy (`skeeball-main.js`)

States `ATTRACT → PLAY → PAYOUT → ATTRACT`. Coin door tap (or any swipe
in ATTRACT, which is read as "feed it a nickel and throw") spends 1
token via `Arcade.tokens.spend(1, 'skeeball')`; if the pocket is empty
the door rattles and the marquee shows `NO TOKENS` for a beat (the
starter pocket is 20; the changer does not exist yet, so an empty pocket
refills to 5 after the machine "finds a nickel in the return" — one line
in WORLD.md). Nine balls. After the ninth ball resolves: PAYOUT. Tickets
= `floor(score / 50) + (score ≥ 300 ? 5 : 0) + 13 × (number of 100s)`,
credited via `Arcade.scrip.add(n, 'skeeball')`. Per-game stats in
`Arcade.stats('skeeball')`: `games, best, lifetimeScore, hundreds,
tickets`. High score shown in ATTRACT.

Cabinet API: `SkeeBall.mount(container, opts)` → `{destroy, pause,
resume, throwBall(power, aim, spin), getState, onEvent, harness}`.
`opts.seed`, `opts.tune` (partial TUNE override), `opts.mischief`
(rates), `opts.free` (no tokens). Events out through `opts.onEvent` and
`Arcade.emit('skeeball', ev)`: `coin, ballstart {n}, throw, launch,
rim, captured {score, cup}, gutter, return, gameover {score, tickets},
jackpot, moon, sulk, jam`.

`harness` (only with `?harness=1`): `{stepTo(t), render(), state, tune}`
— the loop stops running on rAF and the harness owns the clock, so a
headless screenshot at t = 0.8 s is the same pixels every run.

## 9. Verification — how we know it is a game

**Physics metrics (Node, `sim.js`, run on every physics commit):**
- 10,000 seeded throws over a grid of power × aim × spin: zero NaN, zero
  timeouts, every throw resolves in < 6 s of sim time.
- Landing distance is monotone in power for straight throws (no folds).
- A "competent player" model (power noise ±4 %, aim noise ±2°, aiming for
  a ring) scores: 10 ≥ 90 % when aiming 10; 30 ≥ 55 %; 40 ≥ 40 %;
  50 ≥ 20 %; 100 between 4 % and 12 % when aiming for a 100 with the best
  power. A "novice" (±12 %, ±6°) averages 150–260 per nine balls;
  competent averages 260–380. Anything outside these bands is a tuning
  bug, not a feature.
- At least 15 % of ring landings involve a rim contact (a rattle you can
  hear) and at most 45 % (or it feels random).
- Dead rolls (return to player) happen for power < floor and never above
  0.35 of the range.

**Visual/feel (headless Chrome, `film.js` contact sheets, then the
critic's eyes):** a filmstrip of a soft, a medium and a full throw, and
of a rim rattle; the ball never pops, never draws over a rim it is inside
of, shadows stay on the surface, the drum rolls, the rack decrements, the
ticket cranks. Screenshots at 390×844 @2, 375×667 @2, 430×932 @3,
1440×900 @1: no dead-space regressions, nothing clipped, the page does
not scroll.

**Usability (the player critic):** drives 27 throws by synthetic pointer
gestures of realistic length (60–220 css px, 80–260 ms), reads the events
and the filmstrips, and answers in writing: can I tell where to swipe,
does a bigger swipe go further, can I aim, did the machine react to my
score, did I ever lose a ball to the UI, would I put in another nickel.
Any "no" is a ticket for the builder.

**Code review (the last critic):** a full pass over the diff for
correctness, determinism leaks, dead code, mobile pitfalls
(`pointercancel`, `visibilitychange`, dvh, dpr), and the version-bump
rule.

## 10. Build order and crew

Phase 0 (orchestrator): review, plan, worktree, harness skeleton. Done.

Phase 1 — **physics** (builder + physics critic loop). Deliverables:
new `skeeball-physics.js`, `local-dev/skeeball-lab/sim.js`, metrics in
§9 passing, a written note in `PLAN-2.md` §11 of the final TUNE values
and why. The old render/main keep working against the old physics until
phase 3 (the new module is written alongside and swapped in when green).

Phase 2 — **render** (builder + visual critic loop), in parallel with 1
on the contract in §2/§5: prune, projection, ball sprite/occlusion, the
reacting machine, attract/payout art, screen use. Verified with the
filmstrip harness against a scripted ball path until the real physics
arrives.

Phase 3 — **integration + input + game loop + economy** (builder + player
critic loop). Swap in the new physics, new input model, states, Arcade
core, VERSION plumbing, `art/index.php` listing.

Phase 4 — **audio** (builder), can start once the event vocabulary in §8
is final (end of phase 3's first pass). Phase 5 — **mischief** (builder +
player critic). Phase 6 — **final code review + fix** loop, screenshots
at all sizes, `VERSION` at `1.0.0-rc.N`, one summary for the owner.

## 11. Decisions log (filled in as we go)

- 2026-09-25 — plan written; V0.38 tagged as the "before" reference on
  `main` (port 8031) for A/B.
- 2026-09-25 — **Physics — final TUNE and rationale** (`skeeball-physics.js`,
  lab: `node local-dev/skeeball-lab/sim.js metrics`). Every §9 band passes
  (competent 359 / novice 246 per nine balls; aiming 10 98 %, 30 88 %,
  40 67 %, 50 27 %, 100 6 %; ring-capture rattle 27 %; 10k sweep: 0 NaN,
  0 timeouts, max 5.2 s; landing distance monotone in power). Player noise
  is Gaussian with σ = the ± figure; both players pick their EV-best
  nominal throw (the novice's is a bank shot off the right rail).
  - World: `g 5` (flight 0.37 s mid-power), input `v ∈ [2.6, 9]`, aim clamp
    ±0.44 rad. Dead rolls only below `vMin` (the swipe floor); the lane has
    an undrawn lean (`laneLean 0.55`) and the stalled ball is walked home
    at ≥ 2.5 u/s, so every dead roll resolves in < 6 s.
  - Ball: rigid sphere with spin; Coulomb friction couples slip and spin
    (`muImpact 0.3`), so rolling (5/7 of a slope's pull) and pivoting over
    rim edges come out of the contacts. Rims `e 0.25`, `mu 0.12`; bed
    `e 0.25`; padded backstop `e 0.3, mu 0.04` (a topspun ball must not
    climb it); varnished rails `mu 0.05`.
  - Cups: the pinned cups (clear gap 0.14–0.16) are narrower than the ball
    (0.22), so a ball can only nest on two rim tops. Standing in for the
    cup depth: capture when the ball comes down into the open part of a
    cup with its bottom at the rim tops (`capHDrop 0.2`, `capVDrop 4.2`),
    or sits low and slow (`capH 0.2`, `capV 1.6`), plus `cupDrag 8/s`
    while it is down between rims. A ball that meets a rim top bounces —
    the rattle. The landing contact is one `bed` event (`surface: 'rim'`
    when it came down on a rim); later rim impacts are `rim` events.
  - Geometry added beyond §2 (in `GEO`, the renderer may want to show it):
    the outer rim's top arc (35°–145°) is 80 % lower — nearly flush with the
    bed, so a backstop rebound drops into the 10 instead of ski-jumping
    the stack (`GEO.flush`, `GEO.rimTop(k, angle)`); pit side walls splay
    1.0 → 1.2; an invisible cage roof 0.9 above the bed. The dented 40
    measurably turns 40/10 outcomes into 30s near the dent.
  - 100 holes: a ball drops in when it sinks into the well, or on a direct
    hit with its centre within `holeDirectR 0.085` of the hole's centre
    while coming down through lip height; best competent line is near-full
    power (8.65) from x0 0.6 with 5° of aim.
  - Known limitation: precise throws land clean (competent rattle ≈ 10 %);
    rattles come mostly from off-target throws.
- 2026-09-25 — **Physics round 2** (after critic round 1; `sim.js metrics`,
  noise contract = **Gaussian σ = the ± figure**, the bound reading is
  reported alongside).
  - **Real cups, no capture rule.** Each band and the 50 is a depression
    0.12 deep with the rims as walls; a ball is captured only once it has
    settled (< 0.25 u/s for 80 ms). The touchdown speed cliff and the cup
    drag are gone; fast balls bounce off rim walls or skip over.
    *Geometry reconciliation:* the pinned cups (clear gap 0.14–0.16) are
    narrower than the ball (0.22), and a ball nested on two rim tops of the
    41° bed escapes at < 0.1 u/s. So the rims collide as thin blades and the
    ball meets them with `rimBallR 0.06` (full radius against everything
    else). On screen the ball overlaps a drawn rim by a few px, only while
    it is below the bed, where the near hoop is drawn over it. If that
    doesn't read right, the fix is geometric (wider cups or a smaller ball),
    not a rule.
  - Cork cups are dead: rims `e 0.05, mu 0.6`, floor `e 0.05`, cup rolling
    resistance `crrCup 1.2`. An audible `rim` tok is ≥ 0.95 u/s; softer
    touches are part of the cup's thunk.
  - Dent: the 40's rim is 75 % lower over 20°–70°. 16 % of balls that are
    down in the 40 there climb out into the 30 (5 % without the dent);
    0.2 % elsewhere. `captured.dent` marks them.
  - Feel: g 3.2, speeds × 0.8 (vMin 2.08, vMax 7.2); mid-power flight 0.51 s.
    Lane lean 0.16 (≈ 2.9°, a soft throw loses 10.5 % to it); a dead ball
    trickles home at ≤ min(1.5, 0.7 × thrown) u/s. Cage roof at 2.4 (0 % of
    the sweep touches it), event `cage`. Soft aim clamp: linear to ±0.35,
    compressing (tanh) toward ±0.44. Rails: `e 0.5`, `railScrub 0.35`, so a
    bank lands 18 % shorter.
  - Engine: step() integrates exact 1/240 substeps from an accumulator
    (identical outcome at 60/120/144 Hz); no contact can add energy (0
    gains > 1e-3 with the motors off); per-throw tuning
    `createThrow(…, tuneOverride)`; `configure()` only sets defaults.
  - Events: `stall` (lane), `bounceback` (came back from the bed onto the
    lane), `rest` (at rest on the open bed), `cage`; landing = `bed` or
    `backstop` with `landing: true`; `captured {score, cup, band|null,
    hole|null, rattled, rims, dent?}`. `pose().cup` is null until captured;
    `pose().hole` is 0|1 for the 100s.
  - **Still out of band (σ):** competent aiming 50 = 17.5 %, and that's via
    a bank line; the straight 50 is ≈ 5 %. With physical cups the 50's
    catch spot is about 0.1 across against a σ ≈ 0.2 landing spread, so
    ≥ 20 % needs a wider 50, a smaller ball, or the bound reading (24.8 %).
    Novice EV-best = 272: a side/bank approach where the ring bands run
    along the throw. The straight-from-centre novice scores 180. Sweep max
    resolve = 7.4 s: bouncebacks and vMin dead rolls under the ≤ 1.5 u/s
    return cap.
- 2026-09-25 — **Physics round 3.** The 50's inner rim is 0.126 (was 0.116): straight-from-centre 50 = 6.3 %, best line 19.5 % (σ). The novice now throws from x0 ∈ ±0.3, aims within ±0.12 rad, at the 40's straight power, σ 12 %/6°: 156 per nine balls; competent 324. A ball rolling home (`return` or `bounceback`) is done at z < 0.6 heading in, at ≤ min(2.2, thrown) u/s. Cup rolling resistance is 2.0; audible `rim` ≥ 1.05 u/s.
  Still out: sweep resolve p95 5.2 s / max 6.9 s (target 4.5 / 6). At g 3.2 a ball that rolls up the bed and back takes that long; a similarity rescale to g 4.0 only reaches p95 4.7 s and puts the flight at the 0.45 s floor. Competent rattle-after-landing is 46 % (≤ 45 %), within the model's selection noise.
