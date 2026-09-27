# MOTHER LODE — technical plan (2026-09-26)

The build contract for the mine-diorama pachinko cabinet. `BRIEF.md` is
the art direction and wins on anything that's about look or feel.
`../arcade/HEART.md` says why the place exists, and `../arcade/WORLD.md`
holds the rules. This file says how to build it. Nothing here is built,
pushed or published until the owner approves this plan; the still life
(§9, phase 1) is a second owner gate before anything moves.

Folder: `art/pachinko/`. Working branch: `pachinko-1` (worktree
`municipal-sky-site-pachinko`). Local server: `http://127.0.0.1:8077/art/pachinko/`.
Lab: `local-dev/pachinko-lab/` (gitignored).

---

## 0. Non-negotiables (inherited from HOLLER ROLLER, PLAN-2 §0)

- **House pixel look.** Procedural pixel art drawn in code, no binary
  assets, `image-rendering: pixelated`, crisp integer scaling via
  `Arcade.mountCanvas`, the arcade sprite toolkit (3×5 font, Bayer dither)
  and the night palette from `../arcade/`. Machine-local colours (coal,
  strata, timber, brass, lamp amber, nicotine glass) live in the renderer.
- **Vanilla JS, no build step, no dependencies.** One `window.*` namespace
  per file, and a PHP page shell with the site header and footer (copy
  `art/skeeball/index.php`, including its VERSION + fingerprint + mtime stamp).
- **Deterministic.** No `Math.random` and no `Date.now` in the sim, board,
  knockers, mischief or render. Use seeded hashes (`Arcade.rng`, and a
  `hash01(seed, i)` helper). Same seed + same inputs = same game.
- **Pure where it can be.** Physics, the board and mischief load in Node
  (`typeof module` guard, no DOM), so the lab can simulate thousands of
  drops. The renderer is also pure over a `view` object, as in skee ball.
- **Fixed step.** A 120 Hz game loop with 240 Hz physics substeps; render on
  rAF, with the clock injectable (`?harness=1`) because headless rAF runs at ~1 fps.
- **Desktop first** (owner ruling, §2). Mouse plus keys, Pointer Events,
  no page scroll during play. It must still load and play on a phone.
- **Scale the numbers.** Pixel sizes in §3–§8 were drafted for a
  192-wide board; at 320 wide, scale them by ~1.6 (pins r ≈ 2 px, the
  marble r ≈ 4–5 px, figurines ≈ 28–32 px tall) and trust the eye.
- **VERSION.** `art/pachinko/VERSION`, one line
  `1.0.0-rc.N — what the owner would notice`, bumped in every commit that
  changes what the owner sees or hears (the CLAUDE.md rule, adopted as the
  skee-ball machine did). Docs, the lab and harness-only changes don't bump.
- **Commit narrowly** (`git add art/pachinko/...`), never `git add -A`.
  No push and no publish without the owner's word.
- **Deferred means absent.** No pit mule behaviour, no offerings, no
  rising water, and no rare-tier content (only its hook, §7).

## 1. Files

```
art/pachinko/
  index.php             page shell, VERSION stamp, script tags
  pachinko.css          stage framing (copy skeeball.css's approach)
  pachinko-main.js      boot, input, state machine, loop, economy, cabinet API
  pachinko-physics.js   2-D marble sim over a board (pure)
  pachinko-board.js     the base mine layout as data + the knockers' drift edits + validation (pure)
  pachinko-knockers.js  figurine rigs, animation, jobs (pure over time + seed)
  pachinko-mischief.js  theft, lamps out, cave-in (pure)
  pachinko-render.js    cabinet, strata, backdrop, fixtures, light, marble, figurines, dive
  pachinko-audio.js     Web Audio: clatter, chimes, whistle, house sounds
  VERSION  BRIEF.md  PLAN.md
local-dev/pachinko-lab/
  sim.js    Node CLI: batch drops → the metrics in §10
  cdp.js    headless Chrome driver (copied from skeeball-lab), with --mute-audio always
  film.js   contact sheets of a drop, for visual review
  still.js  renders the still life at every screen size
```

Nothing in `art/skeeball/` or `art/coinpusher/` changes. Additions to
`art/arcade/` (e.g. a `hash01` helper or new palette entries) are allowed
if they're additive, and HOLLER ROLLER must still load after them.

## 2. Screen, canvas and the dive (owner ruling 2026-09-26: desktop first, wider)

The owner chose **more detail over the 216 house width** and **desktop
first**: don't design for phones for now (the page must still load and
be playable on one, just not optimised).

- **The diorama (glass interior) is 320 × 416 board pixels.** That's
  about 1.8× the pixel area of the old 192-wide proposal, spent on detail.
- **The cabinet (ATTRACT)** is at most 376 × 560: marquee MOTHER LODE,
  the glass case, brass exhibit plates, the legend card, the coin slot,
  the hopper rail, and the mule's empty bracket.
- **Integer scaling in device pixels** (`Arcade.mountCanvas` does this).
  The sizes above are chosen so that the **dive** (ATTRACT → PLAY: the
  logical canvas crops from the whole cabinet to the glass) steps the
  scale up at rest on the targets, e.g. ×3 → ×4 device px on a Retina
  1440×900 viewport, ×1 → ×2 on a non-Retina 1440×900 or 1920×1080. The
  push-in is a ~0.7 s eased camera move (non-integer frames are fine *in
  motion*; rest frames are always crisp). During PLAY the glass edge, a
  smear of reflection and the legend card's corner stay visible at the
  edges, so you are still looking *into a case*. On wide screens the
  space beside the canvas is the night: dark purple-black
  (`NIGHT0`/`NIGHT1`), with a faint cabinet-glow spill.
- **Screenshot targets:** 1440×900 @1 and @2, 1512×982 @2 (MacBook), and
  1920×1080 @1. A phone at 390×844 @3 must load and play (a sanity shot only).
- **Coordinates:** physics works in **board pixels** (the 320-wide
  diorama space; y down). The renderer draws the diorama in that same
  space, so there's no projection: a flat cross-section, which the brief wants.

## 3. The board (`pachinko-board.js`)

The mine is **data**: one hand-authored base layout plus the knockers'
edits. Every fixture is also a drawable thing in the mine.

Fixture kinds (each has `{kind, x, y, …, material}`):
- `pin`: a circle, r 1–1.5 px. Drawn as a rail spike, lamp hook, pit prop
  end, ore knuckle or bone (a fossil rib as a pin is on-brief). **Every
  pin keeps one silhouette rule** (a bright top-left pixel and a dark
  bottom-right one) so the player can always read it as a pin, whatever
  it's dressed as.
- `rail`: a line segment, collidable on both faces: timbering, track,
  chutes, tunnel floors.
- `cart`: a kinematic ore cart on a rail segment, moving back and forth
  on a time function. It carries a marble that lands in it and dumps it
  at the end of the track.
- `wheel`: a rotating headframe wheel or fan with paddles (kinematic
  segments around a hub).
- `tunnel`: a pair of mouths joined by a hidden path. A marble entering
  mouth A comes out of mouth B after a delay (the transit is
  animated as a light moving behind the rock). This is also what knocker
  theft uses (§7).
- `pocket`: a mid-board catcher (a lunch pail, a cart bay). It pays a
  little and fires the **shift whistle** (the small-win tier).
- `slot`: the payout slots along the bottom. Each has a value, a legend
  number and a label. The **13 slot** is narrow, guarded by pins and
  near the centre (not the corner, so it's a read of the board, not
  a wall-hug).
- `rubble`: added by the cave-in (§7); acts as a pin cluster or blocks a slot.

The base layout is authored as a JS literal with named regions (the
headframe, main haulage way, ventilation door, the old workings, the
flooded sump [dry: the water was cut], the vein). Regions matter
because mischief and lighting address them by name.

**Drift, "a little every game."** Between games the knockers apply 2–4
**edits** drawn by seed from a legal set: nudge a pin within its cell
(±3 px), swap a pin's dressing, extend or shorten a rail by one timber,
open or close a tunnel mouth, shift a pocket along its rail. Drift
resets on page load (the owner chose per-game drift, not a mine that
persists across visits), so each visit starts from the base layout.

**Validation.** Every edited layout is simulated in the browser (the
same physics, ~300 drops spread over the hopper range, in slices during
the knockers' work animation so no frame stalls) and rejected if it
fails the fairness gates in §10: a stuck marble, an unreachable slot,
or a 13 that becomes too easy or impossible. On rejection the edit is
dropped and another is drawn. The base layout and every edit type are
also swept offline in `sim.js`.

## 4. Physics (`pachinko-physics.js`)

One glass marble on an inclined board. State `{x, y, vx, vy, spin, phase,
t, events[]}`; semi-implicit Euler, `dt = 1/240`.

- **Gravity along the board:** `g·sin(tilt)` down-screen, with the board
  tilt tuned so a drop takes **3–5 s** top to bottom (hypnotic but not
  slow). A glass-on-glass drag term stands in for the glass front:
  a small linear damping.
- **Contacts:** circle vs pin (circle), circle vs segment (rails, wheel
  paddles, cart walls), with restitution and friction **by material**:
  steel spike ~0.6 (the bright tick), timber ~0.35, rock/ore ~0.25,
  bone ~0.45. Seeded ±3 % roughness per contact. A spatial hash over
  static fixtures, so each step checks only nearby fixtures.
- **Spin:** a visual roll angle driven by tangential velocity at contacts,
  used by the renderer for the cat's-eye swirl. It has only a tiny
  physical effect (a slight english off rails).
- **Kinematic parts:** carts and wheels move as pure functions of sim time,
  and collisions use the part's surface velocity (a moving paddle *bats*
  the marble).
- **Anti-stall:** a marble whose speed stays under a threshold for 0.6 s
  gets a seeded **knock**, a small impulse. Audibly it's the tommyknockers
  knocking, so the fix is in-world. A marble unresolved at 12 s is
  force-resolved into the slot below it (`timeout` event; the target is
  zero in 10,000 drops).
- **Phases** (labels for render and audio): `drop → board → tunnel |
  cart → pocket | slot → done`; mischief adds `stolen` and `dark` (§7).
- **Exports:** `TUNE`, `createDrop(board, x, seed)`, `step(state, board,
  t, dt)`, `simulate(board, x, seed, {maxT})` → the path plus the outcome.

## 5. Input and the game loop (`pachinko-main.js`)

- **Tap the spot you want** (owner ruling). Moving the pointer over
  the glass shows a faint ghost of the hopper at that x (desktop hover).
  A click or tap sends the hopper gliding there on its rail (~0.2 s,
  mechanical, with a ratchet tick) and it releases the marble at that
  exact x. Keys: ←/→ nudge the ghost, space drops, M mutes.
- **Streams are allowed.** This is pachinko: the hopper reloads in about
  0.35 s and several marbles can be on the board at once. **Marbles collide
  with each other** (glass on glass is its own sound). Where to drop
  and *when* both become part of the skill, and the clatter builds.
- **States:** `ATTRACT → DIVE → PLAY → PAYOUT → WORK → ATTRACT`.
  - ATTRACT: the whole cabinet. The knockers potter about, the marquee
    chases, lamps breathe. The last game's drift work is visible.
  - Start: tap the coin slot to spend 1 token (`Arcade.tokens.spend(1,
    'pachinko')`); an empty pocket uses the house "found a nickel" rule
    from WORLD.md. Then the dive.
  - PLAY: **13 marbles per token** (the house number; proposal, §11).
    The marbles-left count shows as glass marbles lined up in the
    hopper's feed tube. The game ends when the 13th marble resolves.
  - PAYOUT: the dive reverses, the scrip total is counted up on the
    cabinet, then credited via `Arcade.scrip.add(n, 'pachinko')`.
  - WORK: the knockers carry out this game's drift edits in plain sight
    (§6), then ATTRACT.
- **Economy target:** scrip per token for a competent player within
  ±30 % of HOLLER ROLLER's measured value. The lab measures both.
  Slot and pocket values are tuned to hit that, not guessed.
- **Stats:** `Arcade.stats('pachinko')`: `games, best, lifetimeScrip,
  motherLodes`. **Flags:** `pachinko.struck-the-lode`,
  `pachinko.was-robbed`, `pachinko.lights-out`, `pachinko.cave-in`.
- **Cabinet API** (the arcade contract): `MotherLode.mount(container,
  opts)` → `{destroy, pause, resume, drop(x), getState, onEvent, harness}`.
  `opts`: `seed, free, tune, mischief (rates), onEvent`. Events out
  through `opts.onEvent` and `Arcade.emit('pachinko', ev)`: `coin,
  dive, drop {x}, pin {speed, material}, rail, cart, wheel, tunnel,
  pocket, slot {value, legend}, whistle, lode, stolen, dark, cavein,
  knock, gameover {scrip}, work {edits}`.
- **Harness** (`?harness=1`): `{stepTo(t), render(), state}` plus
  `?mode=attract|play|payout|work` and `?force=theft,dark,cavein,lode`
  (ignored without the harness).

## 6. The tommyknockers (`pachinko-knockers.js`)

Toy figurines of little old miners, about 20 px tall, which read as
painted models: peg joints, a painted face, a candle-lamp cap and too-long arms.

- **Rig:** each figurine is 5–7 rigid pieces (head+cap, torso+apron, two
  arms, legs as one or two pieces, a tool), drawn as small sprites and
  posed by joint angles. Their motion is **stepwise, like a toy:** poses
  hold, then snap or tick to the next, a stop-motion cadence (~8 poses
  per second), never smooth tweening. This is the "shouldn't be alive"
  quality, and it's cheap.
- **A crew of 4–6.** Each has a small, distinct silhouette (the tall one,
  the one with the lamp, the one with the pick, the old one with the
  beard to the knees) so players recognise individuals.
- **Jobs**, each a scripted sequence over the board data: walk a tunnel
  floor or rail, climb a ladder, pull a pin, carry it, tap it in with a
  mallet, lay a timber, push a cart, knock on a wall. The WORK state is
  them executing the actual drift edits (§3); pins really move under
  their hands.
- **During play** they do small things: turn to watch the marble, duck
  as it passes, sit on a timber. They never touch the marble except when
  stealing it (§7).
- **Lamps:** each figurine carries a light source that feeds the lighting
  pass (§8), so a crew at work lights its own patch of mine.

## 7. Events, mischief and jackpot tiers (`pachinko-mischief.js`)

All are telegraphed, all are pure functions of (state, seed) so the
harness can force them, and all are rate-limited per game. Mostly skill,
some visible mischief, as in skee ball.

| Event | Telegraph | What happens | Rate (start) |
|---|---|---|---|
| **Knocker theft** (a cheat) | A figurine steps out of a tunnel mouth ~0.5 s before the marble passes it | It grabs the marble (the marble is carried, visibly, in two hands), runs into the tunnel, and the marble comes out of another mouth, good or bad by seed | ~1 in 10 marbles, max 2 per game |
| **Lamps go out** | The region's lamps flicker twice | The region goes dark; the marble falls through unseen (physics continues normally, you only hear the ticks). Rarely it never comes out: no score, the marble is lost | dark ~1 per game; vanish ≤ 1 in 3 games |
| **Cave-in** (an event) | Knocking in the rock for 1.5 s, dust sifting | A region's pins shift, or rubble fills one slot, for the rest of the game. The next WORK clears it | ≤ 1 per game, ~1 in 3 games |

**Jackpot tiers:**
1. **Small win: the shift whistle.** A pocket catch or a slot of 5+
   blows the whistle; the tunnels light in sequence. (Its pitch rhymes
   with the distant train, §8.)
2. **The jackpot: the mother lode.** A marble in the 13 slot: the
   section cracks open along the vein (a pre-drawn fracture that animates
   open), every lamp flares, carts race, the knockers cheer (arms up,
   toy-stiff), and +13 scrip pours in. Its target rate is in §10.
3. **The rare tier: a hook only.** `mischief.rare` evaluates a trigger
   function that **returns false** in this build, and a `rare` event with
   an empty reward slot exists in the event vocabulary. Nothing is drawn
   for it. The adventure game fills both later.

## 8. Rendering (`pachinko-render.js`) and sound (`pachinko-audio.js`)

Layers, back to front:
1. **Painted backdrop** above ground: the ridge, the too-idealised
   sky, the moon; drawn once.
2. **Strata**, drawn once to an offscreen canvas: dithered bands with
   seams of coal that catch light; **specimens** set into the rock —
   fossils (ferns, a trilobite, big ribs deep down), lost things (keys,
   a doll's arm, a wedding ring, a lunch pail, a pocket watch that
   ticks, one pixel moving), and the company's secrets (ledgers, a
   strongbox, the plaque with its name scratched out). Small numbered
   markers tie them to the legend card.
3. **Tunnels and timbering**, cut into the strata; rails and track.
4. **Fixtures:** pins in their dressings, carts, wheels, pockets, slots.
5. **Figurines.**
6. **The marble**, a glass cat's-eye, r ≈ 3 px: a clear rim, the swirl
   rotated by `spin`, and an **inverted miniature** of the mine behind it
   (sample the pixels around the marble, flip them, mask them to the
   disc). That's the brief's "the mine upside-down inside it", done cheaply.
7. **Light:** a low-resolution lightmap (lamp pools from fixed lamps,
   figurines' lamps and the marble's own glint) multiplied over layers
   1–6. The base darkness is near black, and the purple-black night
   shows through at the glass edges. The lamps-out mischief zeroes a
   region's lights.
8. **The glass:** a nicotine-yellow tint, a streak of reflection, the
   **legend card** (typed; numbered entries, one scratched out, the
   slots listed as exhibits), **PLEASE DO NOT TAP GLASS**, and the
   **scale bar** (*1 in = 40 ft*) with a figure of a man for scale.
9. **The cabinet** (ATTRACT only): marquee MOTHER LODE, brass exhibit
   plates in the dry museum voice, the coin slot, the hopper rail, and a
   **reserved empty spot for the pit mule** (a bare mounting bracket)
   so it can arrive later without a redesign.

**Sound** (Web Audio, procedural, unlocked on first touch, muted when the
tab is hidden, modest master gain; the lab always runs with `--mute-audio`):
- The clatter: a bright glass-on-steel **tick** per pin contact (a modal
  ping, pitch and level by impact speed, colour by material: steel
  bright, timber hollow, bone dry), the marble's roll on rails, the
  cart rumble and the wheel creak.
- Slots and pockets: a chiming pachinko-parlour cascade; the **mother
  lode** gets the full cascade plus a rush of coins hitting a plastic
  bucket.
- **The house sounds** (HEART.md): the electrical hum under everything,
  scrip and coins into a plastic bucket at payout, and **a distant
  train whistle** a few times per session at random seeded moments. The
  shift whistle is voiced as that train's near cousin.
- **Knocking** for the cave-in and the anti-stall knock: three dry
  knocks in the rock.
- An attract tune: a short, slightly warped chiming loop at low level.

## 9. Build order and owner gates

Each phase ends playable or viewable, and each is committed on `pachinko-1`.

(Owner gates in this section are now held by the orchestrator, §11.6.)

0. **Scaffold.** Worktree, lab skeleton (`cdp.js` copied, `sim.js`
   stub), page shell with VERSION, an empty canvas that mounts. (No
   bump needed; nothing to see yet.)
1. **Still life (OWNER GATE).** The full cabinet and the diorama drawn
   static: backdrop, strata with specimens, tunnels, fixtures, figurines
   posed mid-job, lighting, glass, legend, plates, marquee. Screenshots
   at 390×844, 375×667, 430×932 and 1440×900, plus a crop of the play view.
   **The owner approves the look before anything moves.** This is where
   the brief lives or dies.
2. **Physics + board** (in parallel with 1, Node only): the base layout
   as data, `sim.js` metrics in §10 passing, TUNE values written into
   §12.
3. **First playable:** the physics wired to the still life, the hopper,
   the dive, 13 marbles, slots paying scrip, ATTRACT/PLAY/PAYOUT on
   Arcade. VERSION `1.0.0-rc.1`. **Owner plays it** (the direct-FTP
   push or a local link, whichever the owner prefers).
4. **Knockers and drift:** rigs, the WORK state, in-browser validation,
   and the small play behaviours.
5. **Sound.**
6. **Events and tiers:** theft, lamps out, cave-in, the whistle, the
   mother lode, the rare hook.
7. **Review:** a player critic (synthetic drag-and-drop sessions,
   answering: can I tell where to drop, does position matter, did I
   notice the board changed, did I blame the machine or myself, would I
   spend another token), a code review (determinism leaks, mobile
   pitfalls, the version rule), and screenshots at every size.

Crew, when the owner says go: one Opus builder per phase, each paired
with a critic, as in the skee-ball rebuild. Phases 1 and 2 run in
parallel on the contract in §2–§4.

## 10. Verification — how we know it's a game

**Physics and board (Node, `sim.js`):**
- 10,000 seeded drops across the hopper range on the base layout and on
  50 drifted layouts: zero NaN, zero timeouts, every drop resolves in
  < 8 s of sim time, median 3–5 s.
- **Position matters.** For each slot, the best drop x gives at least 2×
  that slot's rate under uniformly random drops.
- **Position doesn't decide.** At the best x ±2 px, the target slot hits
  25–55 % of the time; for the 13, 6–14 % at its best x and under 3 %
  from random drops.
- **Drift matters.** Across 3 consecutive games' edits, the 13's best x
  moves by ≥ 6 px at least once, and no edit takes any slot's
  reachability to zero.
- **The clatter.** 12–35 pin contacts per drop (median ~20); ≥ 30 % of
  drops touch a moving part or a tunnel.
- Economy: scrip per token for novice and competent player models, and
  the same numbers measured on HOLLER ROLLER; they must land within ±30 %.

**Visual and feel (headless Chrome, `film.js`, `still.js`):** contact
sheets of a drop, a theft, a lamps-out, a cave-in and the mother lode.
The marble never tunnels through a fixture, figurines never draw over
the marble unless holding it, and no page scroll at any size.

## 11. Owner rulings (2026-09-26)

1. **Resolution:** wider than the house 216, desktop first (§2).
2. **13 marbles per token.**
3. **Controls:** tap or click the spot you want (§5).
4. **The mule:** keep the empty mounting bracket. It should be funny: a
   bare bracket, four bolt holes, maybe a stencilled outline, maybe a
   plate that reads *EXHIBIT TEMPORARILY REMOVED*.
5. **Listing:** add it to `/art/index.php` only after the owner has
   played the full version.
6. **Gates:** the owner handed the whole build to the orchestrator
   ("let you cook"). The still-life and first-playable gates in §9 are
   held by the orchestrator and critics, not the owner; the owner sees
   the finished game.

## 12. Decisions log

(Filled in as the build goes: TUNE values, rulings, reversals.)

- 2026-09-26 — **The render contract (architect, wave 1).** The full text
  is the comment block at the top of `pachinko-main.js`; in short:
  `window.PachinkoRender = { GLASS_W 320, GLASS_H 416, CAB_W, CAB_H
  (≤ 376 × 560), GLASS_X, GLASS_Y, PLAY_RECT?, build(board), draw(ctx,
  view), toGlass?(canvasX, canvasY, view) }`. `build` pre-renders the
  static layers for a layout and is called again after drift edits.
  `draw` fills the screen canvas (device px, sized by main) with the
  camera rect: the whole cabinet at `cam.k` 0, `PLAY_RECT` at 1 (the art
  director's request, adopted); main also passes the camera it computed
  as `view.cam = {k, s, x, y, w, h}` (s an integer at rest). `view = {mode,
  t, cam, board, marbles [{x, y, r, spin, id, phase, tunnel?}], hopper
  {x, ghostX}, figures [], fx {}, hits [{id, t, speed}], score,
  marblesLeft}`. Board space = glass-interior px, 320 × 416, origin top
  left, y down. Kinematic parts: `PachinkoBoard.pose(fixture, t)`. If
  render.js is missing or throws, main draws its debug view (`?debug=1`
  forces it, `?debug=2` overlays it).
- 2026-09-26 — **Scripts.** `index.php` loads every `pachinko-art-*.js`
  (the kit first) between the pure modules and `pachinko-render.js`, and
  skips any listed script that doesn't exist yet.
- 2026-09-26 — **Who crops (art director, as built).** The contract in
  `pachinko-main.js` wins over the bullet above: `draw(ctx, view)` paints
  the whole cabinet into a CAB_W × CAB_H canvas at 1:1 and **main owns the
  camera** (it blits the crop). `PLAY_RECT`/`toGlass` are not needed.
  Geometry: CAB 376 × 560, GLASS at (28, 72). Rows: 0–20 the mule's
  shadow board, 20–66 the marquee, 72–488 the glass, 494–560 the lower
  panel (figures card, brass plates). Left pillar: the marble feed tube
  (`view.marblesLeft`, `R.tubeRect()`); right pillar: the coin door
  (`R.coinRect()`, cabinet px — the start target in ATTRACT). The legend
  card is taped over board decor `cardzone` (glass x 0–64, y 247–333).
- 2026-09-26 — **Render pipeline and budget.** Per frame: cabinet static
  + live (bulb chase in attract/work, breathing in play, blink in payout;
  two dead bulbs and a loose one), then the glass in a 320 × 416 scene:
  albedo (baked in `build(board)`) + live parts (`PachinkoBoard.pose`
  drives the sheave, door, pump wheel, cart) + figurines → × lightmap
  (ambient purple-black, dithered lamp pools posterised on the Bayer grid,
  the case light over the backdrop, cool "pin spots" on each specimen) →
  a foreground layer (pins, exhibit markers, fig tags, bay boards, the
  pail) lit with a floor so pins always read → emissive (flames, painted
  windows, coal and gold glints where lit, hit sparks, the watch's minute
  hand, the canary) → marbles → hopper → nicotine tint (multiply) + sheen.
  ~2.2 ms/frame steady in headless Chrome; `build` ~80 ms.
- 2026-09-26 — **Light API for mischief/knockers.** `view.fx.lights =
  {region: 0..1}` scales a region's lamps (0 = lamps out; flames vanish
  too), `view.fx.dark = {region: 0..1}` blacks a region out (pins
  included), `view.fx.flare = 0..1` flares every lamp (the lode),
  `view.fx.extraLamps = [{x, y, r, c, k}]` adds pools. Figures with `lamp
  !== false` light their own patch automatically (a lantern tool adds a
  bigger pool). `PachinkoRender.lightAt(x, y)` for CPU decisions.
- 2026-09-26 — **Figurines.** `PachinkoRender.drawFigure(ctx, fig)` with
  `fig = {x, y (feet), facing ±1, who, pose {lean, head, armL, armR, legL,
  legR, toolA} (radians), tool, lamp, hold}`; crew `who` ∈ tall (Absalom,
  Cornish felt hat), lamp (Tobias, lantern), pick (Ezra), old (beard to
  the knees), little (shovel twice his size), tally (spectacles, bowler).
  `R.POSES` holds a starter vocabulary (stand, swingUp/Dn, carry, push,
  walkA/B, cheer, point, sit, hold, lamp); `R.figureLamp`, `R.figureHands`
  for the lightmap and for carrying a stolen marble (`fig.hold = {x, y}`
  draws the marble there). **While `view.figures` is empty the renderer
  shows its still-life crew** (`R.stillLife()`); set `view.fx.noStillLife`
  to suppress it. Quantise angles to ~15° and hold poses (~8 fps).
- 2026-09-26 — **Tunnels and marbles.** A marble with `phase: 'tunnel'`
  is drawn as a faint light travelling behind the rock along
  `tunnel.from → to` (arched). `hidden: true` suppresses a marble. The
  marble: 9 px cat's-eye, dark rim so it reads on any rock, the lit scene
  behind it sampled, flipped and shrunk inside it, the vane turned by
  `spin`, the vane colour by `id` (five marble colours).
- 2026-09-26 — **The layout (architect, wave 1, rc.1–rc.3).** Laid on the
  art director's painted strata (drop y 16, ground y 64, seams A/B/C at
  y 142–160 / 222–240 / 292–320, deep rock 320–384, bays 384–416). Pins
  live in the rock bands (roots, spikes, roof bolts, coal and ore
  knuckles, bone); only the gallery *floors* collide (the marble rides
  the glass). **Galleries are partial**, driven part way along each seam
  to a rock face (A to x 213, B to x 263, C from x 65 to x 247); beyond
  the face the seam is coal pins. A full-width floor with shafts washed
  out drop position (every drop funnelled to the same few shafts), so the
  right-hand lane falls through rock the whole way and the left and centre
  go through the galleries. The legend-card corner (x 0–64, y 240–330) is
  walled off by a rock rib.
- 2026-09-26 — **TUNE (physics).** R 4, g 1000 px/s², drag 0.35/s, vMax
  560, dt 1/240. Restitution/friction: steel 0.45/0.06, brass 0.55/0.07,
  timber 0.34/0.12, track 0.22/0.04, plank 0.16/0.06, rock 0.26/0.16,
  ore 0.30/0.14, bone 0.42/0.09, spoke 0.12/0.35, glass 0.88/0.03.
  roughness ±3 %, jitter 3, perchKick 2.5 (a marble can't sit on a pin
  top), teeterKick 0.5, restV 10, eventV 16, stall 8 px/s for 0.6 s →
  knock 110 px/s, timeout 12 s. The drop leaves the hopper at 60 px/s.
  Cart period 2.6 s (loads only at the loading end / outbound, tips out at
  0.55 rad, a loose marble in the bucket goes out with the load; a
  marble rolling along the track passes in front of the cart). Sheave ω
  2.2, pump ω −2.6, vent door ±0.75 rad / 2.8 s. g was raised from the
  planned "slow and hypnotic" 170 because the pin fields ate ~0.2 s per
  10 px; 1000 with ~23 contacts reads as a busy, ticking fall.
- 2026-09-26 — **Bay values.** The bays are named for what comes out of a
  mine and most of it is waste: GOB, SLATE, BONY, STEAM, SLACK, STOKER 0 ·
  SMITHING 1 · THE MOTHER LODE 13 · BLOCK 1 · CANNEL, CULM, EGG,
  OVERBURDEN 0; the lunch pail 2. Tuned to the economy target: pachinko
  loses most marbles, and the 13 is the game.
- 2026-09-26 — **Metrics (sim.js all, 10 000 drops, rc.3).** NaN 0,
  timeouts 0, median 4.24 s (p95 5.98), 7 of 10 000 over 8 s (max 8.8 —
  open); contacts median 23, 88 % in 12–35; moving part or tunnel 45 %.
  The 13: 2.8 % uniform, 8.3 % at its best x ±2. Every slot's best x is
  ≥ 2× its uniform rate; best±2 in 25–55 % for GOB, STEAM, SLACK, STOKER,
  SMITHING; several narrow bays sit below 25 % (BLOCK 6.7 %, CANNEL 15 %,
  EGG 18 %) and OVERBURDEN (the right wall lane, a 0) is 64 %. Economy
  (scrip per token): competent 11.2, novice 7.1; HOLLER ROLLER estimated
  from PLAN-2 §8/§9: competent 14.0 (band 9.8–18.2 ✓), novice 4.5 (the
  pachinko novice is above its band: the 13 alone gives a random dropper
  ~4.7). Drift: 50 layouts in 10 chains of 2–4 edits per game, 0 with an
  unreachable paying bay, 7 with the 13 outside its bands, the 13's best
  x moved ≥ 6 px within 3 games in 10/10 chains; the validator rejected
  80 candidate edits (mostly slow drops and the 13 getting too easy).
- 2026-09-26 — **Unrequested physical touches.** (1) The bone over the 13
  has a worn, cupped top: a marble landing square on it stops and
  teeters for ~0.5 s before choosing a side (half go in; if it dawdles
  the knockers knock it off). Event `teeter`, ≈ once in 20 games.
  (2) The sheave's spokes are grippy: now and then (1.7 %) a marble is
  carried over the top of the wheel. Event `ride`. (3) The office tunnel,
  the one scratched off the legend, empties into the GOB bay. (4) The
  cart takes up to three and tips them out together.
