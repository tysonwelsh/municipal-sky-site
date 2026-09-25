# HOLLER ROLLER — code review of V0.38 (2026-09-25)

Scope: everything in `art/skeeball/` (1,860 lines) plus the `art/arcade/`
core it was meant to adopt. Read in full, run locally on a PHP dev server,
and exercised headlessly (Chrome over CDP with synthetic pointer events).

## Verdict in one paragraph

The **art is good and should stay**: the procedural cabinet, the possum,
the marquee, the drums, the racked balls, the palette — all of it reads as
the place the plan describes, and the owner wants the same style. The
**physics is a prototype that stopped at the wrong abstraction**: the whole
throw is decided by a closed-form solve the instant the ball leaves the
crest, so nothing after the hop is a ball any more (no bounce, no rattle,
no rolling on the bed, no rim). The **input model defeats its own lane**:
on a phone the lane is ~125 css px tall, so any real flick carries the ball
to the crest before release and the roll phase lasts zero frames. And
there is **no game**: endless free balls, no coin door, no tickets, no
attract, no score memory, no audio, no listing. Milestones 3–5 of the
original plan never started; 38 versions were spent on camera variants and
feel constants without a way to measure either.

Recommendation: keep the renderer's static art and pixel toolbox, keep the
fixed-step loop and the event/factory shape, **rewrite physics and input
from scratch** as a real continuous 3-D sim, and build the game loop,
audio, and derangement on top. Details below.

---

## 1. Physics (`skeeball-physics.js`, 404 lines)

**P1. The flight is not simulated.** `solveFlight()` intersects a parabola
with the bed plane at takeoff and calls `resolveLanding()` on that single
point. From then on the ball plays a canned animation (`settle`, 0.55 s;
`rolloff`, 0.24 s ease; `rolldown`, a 1-D slide). Consequences:
- `rattle` is emitted on every landing and is never true — nothing can
  rattle.
- A ball can never bounce off a rim, hop from the 30 into the 40, roll up
  the bed and fall back, or skim over the ring stack into the backstop and
  drop into the 10 the way a real one does. All of that is where the
  *feel* of skee ball lives.
- The "dented 40" from the plan is drawn but cannot exist in the sim.

**P2. The ring bed is a flat 2-D target, not cups with rims.** Rings are
concentric annuli in the bed plane; a landing point inside an annulus
"sinks". Rims are modelled as 0.05-wide "dividers" a ball rolls off via a
threshold rule with seeded jitter (`ridgeMomentumK`, `ridgeJitter`). That
is an invented mechanism to patch P1, and it produces outcomes that are
correct on average but never *look* caused.

**P3. Input clamps encode the whole difficulty curve.** `vzMin 1.4`,
`vzMax 7.65`, `vxMax 1.6`, `spinMax 1.3` and the comment on `vzMax`
("max power lands a straight ball at v≈2.33, right at the 100-hole band")
show that reaching the 100s is a matter of hitting the ceiling, not of
judgement. There is no measured skill curve anywhere.

**P4. Deterministic and pure — keep this.** No `Math.random`, no `Date`,
`hash01(seed)` for jitter, `pose()` separated from `step()`, a trail for
the debug overlay. The module cannot be loaded in Node because it assigns
to `window`, which is the only reason there are no tests.

**P5. Small things.** `rollDecelAt` is a step function at `kneeZ` (the
ball's deceleration jumps discontinuously). `hopAngle` is constant
regardless of speed (fine, but the crest is a kink, not a curve). The
`rollback` phase ignores the ramp (constant `rollbackA`). `bedHalfW 1.05`
vs `R10 0.93` leaves 0.12 units of bed beside the outer ring; the drawing
has much more. Every `TUNE` constant is in machine "units" with no note of
what a unit is in inches (1 unit ≈ half a lane width ≈ 14 in).

## 2. Input (`skeeball-main.js` §swipe, ~120 lines)

**I1. The carry model collapses the roll.** `pointerdown` puts a ball
under the thumb; `endSwipe` launches from where the thumb *is*
(`laneAt(lastPt)` → `z0`). The lane occupies canvas rows 249–332 (83 rows
→ ~125 css px on a 390-wide phone). A normal flick travels further than
that, so the release point is clamped to the ramp and `z0 ≈ L`. Verified
headlessly: an ordinary 8-sample swipe produced `z0 = 4.14` of `L = 4.2`
and the `launch` event fired on the first sim step. The ball teleports to
the crest; the player never sees it roll.

**I2. Energy compensation hides I1 instead of fixing it.** `rollWork(z0)`
subtracts the roll energy the ball "would have spent" so the outcome is
release-independent — correct in principle, but it means the visible ball
position and the physical throw are two different things.

**I3. Seven feel constants, no instrument.** `SPEED_CEIL 1400`, `LEN_CEIL
100`, `LEN_SPEED_GATE 400`, `W_SPEED/W_LEN`, `POWER_GAMMA 1.2`, `SIDE_DIV
420`, `SPIN_ANG_K 1.3`. `LEN_CEIL` is 100 canvas px of upward reach — more
than the lane is tall — so full "length credit" requires swiping through
the ring bed. Nothing measures what a medium flick does.

**I4. The swipe zone is the lane only** (`p.y < lane.y0 - 16` rejects).
On a phone that is the bottom third of the canvas; the rail and front
panel below it are dead. A tap anywhere does nothing, and there is no
affordance telling the player where to swipe.

**I5. Spin ("english") is inferred from the curl of the whole gesture.**
Clever, but a thumb arcing naturally across a phone always curls; players
will get hooks they did not ask for. Spin should be a small, opt-in effect.

**I6. No `pointercancel` recovery, no multi-touch guard** (a second finger
starts a second `pointerdown` that is ignored because a swipe is in
progress, but its `pointerup` ends the first swipe).

## 3. Rendering (`skeeball-render.js`, 988 lines)

**R1. Keep:** palette, `rng`, pixel helpers, font, `makeGeo('grand')`,
`drawRoom/CabinetBody/Marquee/Possum/ScoreBar/Target/Pit/SideRails/Ramp/
Lane/FrontPanel/BaseAndStain/CobwebsAndGrime`, the static-layer approach,
`drawFrame`'s flicker/breathe/blink, `drawBall/drawBallShadow`.

**R2. Dead weight (~220 lines):** five unused camera `VARIANTS`
(`headOn/raised/longThrow/targetFace/hybrid`), the legacy branches in
`cabHalf`, `drawWindow`, `drawPrizesSign`, `labelsInside === false`, the
non-pit branches of `drawRamp`, `setVariant`, and
`ramp-perspective-sandbox.html`. Only `grand` ships.

**R3. Duplicates `art/arcade/`.** `px/rect/hline/vline/ellipse/dither/
glowRing/FONT/text/textC` and the NIGHT/BONE/PINK palette are copied
verbatim from (or rather, into) `arcade-sprites.js` / `arcade-palette.js`.
The retrofit the WORLD.md promised never happened.

**R4. The ball has no third dimension.** In flight it is a straight
screen-space lerp from crest to landing point with `- pose.y * 24` as a
"height cue, damped"; on the bed it is a fixed 3.2 px disc drawn *over*
the rings and shrunk to fake sinking. There is no projection function for
an arbitrary `(x, y, z)`, no shadow in flight, no occlusion by a rim when
the ball drops into a cup.

**R5. Nothing on the machine reacts.** Drums redraw digits with no roll;
the nine racked balls never decrement; the possum's eyes blink but do not
track; the ticket in the slot never moves; there is no score flash, no
100-hole jackpot light, no attract cycle.

**R6. Screen use.** Internal 216×384 integer-scaled: on a 390×844 phone
at dpr 2 that is 3× → 324×576 css px inside a 780 px stage, so a quarter
of the height is empty room. The site header (64 px) and the blurb below
also compete with the game for a scrolling viewport.

**R7. The dent on the 40 is three pixels** and invisible at play scale.

## 4. Game / shell (`skeeball-main.js`, `index.php`, `skeeball.css`)

**G1. No states.** Endless balls, score only ever goes up, reload to
reset. No ATTRACT / PLAY / PAYOUT, no coin door, no ball count, no
tickets, no high score, no `localStorage`, no `Arcade` core (tokens /
scrip / `holler.v1`), despite the coin pusher having adopted all of that.

**G2. Cabinet contract unmet.** The handle has `destroy()` but no
`pause()/resume()`; the loop runs while the tab is hidden; the accumulator
clamp (0.1 s) prevents a spiral but every hidden second still steps.

**G3. `window.__skeeEvents` grows forever** (debug aid left on in prod).

**G4. No audio at all** (`skeeball-audio.js` was planned, never written).

**G5. Not listed** in `/art/index.php`; version stamp is a hard-coded
`'V0.38'` in JS rather than the site's `VERSION`-file convention.

**G6. Page framing:** `.skeeball-stage` is `100dvh - 64px` but the header
is not pinned, so on iOS the game sits under a scrolling header; a swipe
that starts on the blurb scrolls the page.

## 5. Engineering

**E1. No tests, no harness, no metrics.** 38 versions of feel tuning by
hand. The physics is pure enough to run in Node in ten minutes of work —
that should have been step one.

**E2. Headless verification is possible now.** `local-dev/skeeball-lab/
cdp.js` drives headless Chrome (screenshots at phone/desktop size,
synthetic `PointerEvent` swipes, JS evaluation). Caveat from the house
memory: headless rAF runs slowly, so the game needs a harness mode with an
injectable clock to make frame captures deterministic.

**E3. Good bones to keep:** fixed-step 120 Hz accumulator, deterministic
seeds, `SkeeBall.mount(container, opts)` factory + `onEvent`, the event
vocabulary (`throw/launch/wall/stall/return/land/gutter/done`), one
namespace per file, no build step, no dependencies.

---

## What to keep / what to scrap

| Area | Decision |
|---|---|
| Static machine art, palette, pixel toolbox | **Keep**; prune dead variants; import the toolbox from `art/arcade/` |
| Fixed-step loop, seeds, factory/event shape | **Keep** |
| Physics model | **Scrap and rewrite** as a continuous 3-D sim (see PLAN-2 §3) |
| Input model | **Scrap and rewrite** (see PLAN-2 §4) |
| Ball rendering / projection | **Rewrite** on a real `(x,y,z)` projection fitted to the drawn machine |
| Game loop, economy, audio, derangement | **Build new** (PLAN-2 §5–7) |
| Camera sandbox, unused variants | **Delete** |
