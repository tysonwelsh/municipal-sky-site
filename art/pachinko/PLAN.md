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
- 2026-09-26 — **Art round 2 (orchestrator review).** No canary, no birds
  (owner ruling). The ventilation road has a moth circling its lantern
  (live, 12 fps) and a rat's tail twitching in a crack by the office door,
  sometimes withdrawn. Figurines rebuilt as old miners: peg-doll heads, soft
  caps with a carbide lamp (the flame is the signature pixel), white or grey
  gnome beards (Absalom and Tobias to the belt, Old Jory to the knees),
  stoops per knocker, leather aprons, earth-colour paint, and a cast shadow on
  the rock behind (`fig.shadow !== false`). **Pins are dressed by host rock**
  inside the one silhouette rule: rusted rail spikes in sandstone and soil,
  blued in shale, galvanised in limestone, black-blue coal knuckles, quartz
  and gold ore nuggets (both twinkle), bone condyles, end-grain props,
  bolts with bearing plates, brass tacks in the backdrop. **Shafts are
  inferred** from paired vertical columns of `prop` pins (10–32 px apart,
  ≥ 3 each): the art paints a lagged well between them, with a ladder; the
  one under the headframe opens at the collar and carries the hoist rope
  and a kibble. **Bays** show museum cards with `slot.label` (abbreviated
  to fit: STOK., SMITH, CANN., OVERBUR.) at staggered heights, and a pink
  scrip stub `+value` only where `slot.value > 0`; the 13 bay is gold.
- 2026-09-26 — **The pins are composed (rc.6, orchestrator review of the
  rc.4 still life).** The uniform offset grid is gone. The pin fields are
  mine furniture built from five figures (`line`, `arc`, `vee`, `patch`,
  tulip `pocket` in `pachinko-board.js`): the main shaft lined with timber
  sets under the headframe (drop between the posts and it rattles down to
  the ore cart), roots under the grass, sparse sandstone, a fault with
  broken rock below it, V funnels over two shafts, roof-bolt lines over
  seams A and B, the ladderway's two stiles (down to the old drift), a
  dome of bone (the ammonite), dense broken patches, bedded coal-lane
  rock beyond each gallery face, a fan of rivets by the sheave and of
  roots by the pump, the vein's seam as a sieve of ore knuckles, three
  steep ribs, and the lode's knuckles. A post-pass keeps every shaft mouth
  and pocket clear so nothing wedges. The stall watch now measures how far
  the marble actually moved (a marble wedged between two pins could keep
  a jittering velocity that the contacts cancelled every step).
- 2026-09-26 — **The route to the 13 (rc.6).** The old drift (mouth at
  the far left of seam B, reached down the ladderway) now comes out over
  the lode (190, 324), vx 13 ± 31: a marble that takes it finds the 13
  about one time in ten and the REFUSE bay most of the rest. So the 13's
  best drop is the far left (x ≈ 12–20), a route a player can learn from
  the legend ("5. The old drift"); the knockers' mouth edits open and
  close it. The cup sits behind the teetering bone (177, 352) with ore
  guards (165/189, 362): the way in is off the bone. Knobs, found by a
  random search in `local-dev/pachinko-lab/search.js` and exposed as
  `PachinkoBoard.base(knobs)`: `{deepPitch 19, knuckle 10, guard 12,
  driftX 190, driftVx 13, driftSpread 31}`.
- 2026-09-26 — **Economy, rebalanced for a trickle (rc.6; supersedes the
  earlier bay values).** Bays: GOB 0, SLATE 0, BONY 0, STEAM 1, SLACK 0,
  STOKER 1, SMITHING 1, THE MOTHER LODE 13, REFUSE 0 (was BLOCK),
  CANNEL 1, CULM 0, EGG 2, OVERBURDEN 0. Pockets: the powder box 2 (a
  tulip in the middle measures, new), the lunch pail 1 (a tulip, moved
  under the manway stream). The ore cart pays 1 when it takes a marble
  (`award`; the marble rides on). 56 % of uniform drops pay something.
  Expected scrip per token (13 marbles): **novice 12.4, uniform 11.7,
  competent 16.6** (best single spot 18.7, at the main shaft x ≈ 78);
  HOLLER ROLLER competent 14.0 → band 9.8–18.2 ✓. The novice figure is
  well above skee ball's 4.5: that is the price of "most drops pay
  something", and it was the orchestrator's call.
- 2026-09-26 — **Metrics (rc.6, sim.js all, 10 000 drops).** NaN 0,
  timeouts 0, median 3.65 s (p05 1.9, p95 5.3, max 8.0), contacts median
  18 (76 % in 12–35), moving part or tunnel 46 %. The 13: 2.1 % uniform,
  7.8 % at its best x ±2. Every bay ×≥ 2 over uniform at its best x.
  Deterministic lanes (over 55 %): REFUSE 86 % (the drift route when it
  misses the lode) and OVERBURDEN 75 % (the right wall), both 0-value.
  Unreachable: SLATE (0, under the sump fan). Drift: 50 layouts / 10
  chains, 0 with an unreachable paying bay, 8 with the 13 outside its
  bands, the 13's best x moved ≥ 6 px within 3 games in 9/10 chains; 49
  candidate edits rejected by validation.
- 2026-09-26 — **The sound's event contract (audio, wave 2; the full text
  is the header of `pachinko-audio.js`).** `PachinkoAudio.attach(handle,
  unlockEl, opts)` → `{destroy, setMuted, isUnlocked}`, HOLLER ROLLER's
  shape; main's rc.7 wiring (`attach(handle, canvas, {muted, version,
  seed})` outside the harness or with `?audio=1`, `setMuted(muted ||
  paused || hidden)`) matches it and needs no change. **Timing:** every
  event's `t` (sim seconds) is mapped onto the audio clock with a 35 ms
  lead, so the ticks inside one frame keep their true spacing (0 resyncs
  in a whole real game). **Physics, forwarded verbatim:** drop, pin, rail,
  roll, wheel, ride, clack, cart {what}, tunnel {what}, pocket, slot,
  award, teeter, knock, timeout, done. **Game (all present in main rc.7):**
  input, mode {attract|dive|play|payout|work}, coin, nocoin, found, dive
  {dir}, hopper {x, from, glide} (the carriage sets off and seats),
  ratchet {x} (one pawl tick each), queue, empty, reload {left}, feed {n},
  tally, ticket, payout (ONE scrip into the plastic bucket; a count-up is
  queued ≥ 45 ms apart), tear {n}, gameover {scrip}, whistle {value}
  (played 0.38 s after its event, behind the pocket's plink), lode {x},
  work, edit {edit} (the moved pin rings in its new place), figure {what:
  step|tap|pull|lay|set|cheer, x, y}, glasstap {n}, rare (silent).
  **For the mischief/spectacle phases (not yet emitted):** stolen {m, x,
  y}, dark {region, what: flicker|out|on}, lost {m}, cavein {region, x,
  what: telegraph|fall|clear}. Heard but silent: release, win, glide,
  workplan, mute. If the game never sends `whistle`/`lode`, pockets and
  the 13 slot set them off by themselves (a 0.12–0.26 s grace lets a
  late game event replace the automatic one).
- 2026-09-26 — **The lode's sound, on a clock the spectacle can match
  (audio).** From the `lode` event: 0–1.0 s the room and music drop to
  20 % (the held breath); **+0.30 the vein cracks** (a sub drop 54→29 Hz,
  a crack, 30 micro-fractures over 0.5 s, 22 falling stones to +1.75);
  +0.45 every lamp flares (a gas whoomp); +0.55–1.9 the cascade (every
  bay's bar up G5–G7 in 45 ms steps, tumbling back in 72 ms steps, a
  G-major chord at ≈ +1.9); +0.8–3.5 thirty scrip into the plastic bucket;
  +0.95 the shift whistle long, toot-toot at +2.4/+2.8; +1.0–3.0 the carts
  race; **+1.15–2.3 the crew cheers** (six formant toy voices, hoo-RAY,
  hey, whoops; old Jory's wobbles); +3.1–6.5 the music box plays the
  tune through with its broken tine ringing for once, and from then on
  the attract loop's high D is mended for the rest of the visit. Busy
  until +8 s (the distant train waits).
- 2026-09-26 — **The tuning (audio).** The machine is one instrument in G
  major pentatonic: every pin is a tuned nail (its note from a hash of its
  id, its register falling with depth, so a marble's descent is a
  descending run; ±14 cents of seeded mistuning, "old nails aren't
  tuned"), every bay a tuned bar, each marble colour a glass note (two
  marbles meeting ring a dyad), the train and the shift whistle an
  E-minor chord (E G B; the shift whistle an octave up: the model's
  whistle is the size of a thumb), the music box in G with the F-natural
  of the old modes. Measured levels: the next entry and
  `local-dev/pachinko-lab/reports/wave2-audio.md`.
- 2026-09-26 — **The game (integration, wave 2; rc.7–rc.10). The full text
  is the header of `pachinko-main.js`.** The states are ATTRACT → DIVE →
  PLAY → PAYOUT → WORK → ATTRACT.
  - **The start:** the coin door (its click area also takes in the pilot
    bulb, the INSERT TOKEN card and your pocket's readout), or Enter, C or
    space.
  - **The dive:** it waits COIN_T 0.55 s for the coin's mechanism, then
    runs DIVE_T 0.7 s (smootherstep, zoom interpolated in log space),
    integer scale at rest. Dived in, spare height never slices the marquee
    through its lettering: the whole marquee shows if the glass still
    fits, otherwise none of it, and the spare goes to the lower panel.
  - **The hopper:** it glides 0.09–0.24 s (full at 200 px), with a ratchet
    event every 7 px. RELOAD is 0.35 s, and one click is queued (a newer
    click replaces it).
  - **The end:** a 0.9 s beat after the 13th marble resolves.
  - **Payout:** a deliberate change from §5's order. The count happens
    *dived in* (the SCRIP counter, the ticket mouth and the strip are all
    in the play framing on every target screen): TICKET_T 0.11 s, 3.4 s in
    all, tear after 0.55 s, then the camera pulls back. Scrip is credited
    at game end.
  - **WORK:** `planDrift` draws 2–4 edits by seed and validates each on top
    of the ones accepted (300 drops, 6 per 120 Hz step). The accepted edits
    are carried out every 0.85 s while the tube refills (0.07 s a marble).
    WORK lasts at least 3.4 s and never more than 9. A coin during WORK
    sets whatever has passed validation at once and starts the game.
  - **The later phases** plug in through PARTS
    (`PachinkoKnockers/Mischief/Spectacle.attach(api)` → `work/lode/
    figures/fx/rare/step/gameStart/gameEnd`) without editing main. The
    rare tier is a `rare()` hook that nothing answers yet.
  - **Mute** is saved in localStorage `mother-lode.muted`.
- 2026-09-26 — **The machine's dials (`pachinko-art-counters.js`, integration).**
  - **Right pillar, top to bottom:**
    - the SCRIP drum counter (3 × 7 odometer figures, one tick per scrip,
      and it counts back down at payout);
    - a pencilled HI tag with your best, rewritten when you beat it;
    - the pilot bulb;
    - the typed flip card, INSERT TOKEN / MODEL IN USE;
    - the coin door (a glowing slit, the token going in, a rattle on an
      empty pocket, the found nickel dropping into the return);
    - your pocket (a brass token and 2 drums, a pink ticket and 3 drums);
    - the ticket mouth, with the pink strip at payout (folding up on the
      lip past the ledge), or a cream slip stamped NIL when nothing was won.
  - **Left pillar:** a speaker grille with a rag stuffed in it when muted.
  - **Inside the glass:**
    - a bay card lights under a work light when it pays, and its scrip stub
      flips; a worthless bay's card is knocked;
    - pockets hop and puff coal dust;
    - a pocket catch (the shift whistle) sends a chase of lit bulbs along
      each gallery, the haulage way first;
    - the 13's placeholder: all lamps up, a gold fuse running out along
      the vein, the crew cheering in stop motion, a 1–2 device px jolt.
  - Chalk on the glass says PICK A SPOT ON THE GLASS / THE BUCKET GOES
    THERE on a first game, or when you idle 9 s mid-game.
  - The room is drawn in cabinet px: the marquee's dithered spill on the
    wall, a skirting board, and screen-wide carpet with gum.
- 2026-09-26 — **Economy and bays (integration, rc.9; supersedes rc.6's).**
  - STOKER 1 → **0**. The broad centre bay was handing a random dropper
    free scrip: the left half of the board paid 1.0–1.7 a marble wherever
    you dropped.
  - The office tunnel now throws its marbles out sideways (vx 45 ± 45)
    into GOB or SLATE, so **SLATE is reachable** (3.7 % uniform; its best
    drop is the far right, x ≈ 306, across the whole mine).
  - The office exit moved from (8,330) to (9,341). The old exit dropped
    **13 % of all drops** under the legend card's bottom edge; now 3 in
    3000 graze its shadow pixel. The card's right edge was never the
    problem.
  - Legend abbreviations: HEADFRAME, SHEAVE / DINNER PAIL, TIN / TUNNEL
    TO OFFICE. Worn ink now prints faint instead of dropping pixels.
  - **Metrics (sim.js metrics, 10 000 drops):** NaN 0, timeouts 0; median
    3.68 s, max 8.00. Drops that pay something: 43 % (was 56 %). Scrip per
    token: **novice 10.3, uniform 9.8, competent 13.6** (HOLLER ROLLER
    14.0, band 9.8–18.2 ✓).
  - The novice/competent ratio is structural at about 1.4×. No value set
    tried moved it much: hitting the best spot ±2 px only lands its target
    25–55 % of the time. So value moved to what you can read (the pockets,
    the coal beside the lode, EGG, CANNEL) and off what you can't.
  - REFUSE (86 %) and OVERBURDEN (75 %) stay deterministic 0-value lanes
    on purpose: the gamble down the old drift (7–8 % the 13), and the wall.
  - **Drift, 30 layouts in 6 chains:** 0 with an unreachable paying bay;
    the 13 out of band in 4; the 13's best x moved ≥ 6 px within 3 games
    in 5 of 6 chains.
- 2026-09-26 — **Sound levels, measured (audio; silent OfflineAudioContext
  renders, BS.1770 LUFS, true peak).** Against HOLLER ROLLER's own audio
  rendered the same way: a whole game −27.5 LUFS (HR −27.1); a plain drop
  −29.9 (an HR ball −28.1; a drop into a pocket −27.9); attract −29.5 (HR
  −27.0; the music box is meant to be low); **the lode −22.0, short-term
  max −16.8** (HR's jackpot −27.2: the roar is deliberate). No clipped
  sample in any render; the loudest true peak is the lode's −7.0 dBFS.
  One tick −30…−13 dBFS peak by speed; the distant train ≈ −41 dBFS in its
  band (355–710 Hz), faint on purpose; the hum's audible part (the tube's
  buzz, 0.7–2.8 kHz) ≈ −44 in play. Density: six marbles at once +5 LU
  over one (energy would be +7.8), and the 10 ms envelope's spread rises
  with density (3.8 → 5.0 dB), so a stream stays ticks, not a wash; a
  13-marble stream: 283 ticks at up to 116/s, 3 dropped by the voice cap.
- 2026-09-27 — **The tommyknockers (wave 3, rc.12–rc.13). The contract is
  the header of `pachinko-knockers.js`.** One PARTS plug-in
  (`PachinkoKnockers.attach(api)`); main is unchanged.
  - **Stop motion.** One shared shutter at 8 fps: every pose holds and snaps
    to the next, limbs quantised to 15°, lean and head to 5°. Old Jory moves
    on every other frame. Scripts are generators (`yield n` holds a pose n
    frames). Poses per knocker live in `POSES`; each man rests his own way
    (Absalom's hands behind his back, Ezra on his pick, Pip on his shovel's
    grip, Tobias's lantern out front, Jory on his cane, Pengelly reading).
    A toy's straight legs are planted: the lower boot always touches the floor.
  - **Where they can be (`buildNav`).** Feet on a floor or a rung, always.
    Walks: the surface (y 64), every gallery floor piece over 12 px (trimmed
    3 px each end), the dry sump's floor (y 383) and the sills of their doors.
    Links: hops over openings ≤ 24 px; ladders (the main shaft and the
    ladderway as painted, plus four the knockers brought: manway A→B x 150,
    the chute B→C x 130, east B→C x 240, the sump raise C→sump x 93, all on
    pin-free columns); and the rock between their doors. **Doors:** the two
    tunnel mouths, one hairline arch in the back wall of each gallery
    (a1 118, a2 166, b1 105, b2 228, c1 114, c2 172, s1 30 in the sump)
    and six beyond the working faces where the company stopped (rA/rA2 at
    seam A's level, rB/rB2, rC/rC2). A knocker in the rock is hidden; his
    lamp is a glow moving behind it. **Stances** for a point: standing
    within reach (bent, for work at his feet), on a rope ladder hung from
    the walk above, or on a ladder stood on the walk below; they pass in
    front of the rock as toys in a model, never through it. Every drift pin
    is reachable (`kn/navtest.js`).
  - **Routes.** Dijkstra over a graph cached per layout. Speeds: walk
    step × 8/s (4 px for Absalom and Ezra, 3 for the rest, 2 on fours for
    Jory), a rung a frame, rock 80 px/s. In WORK they hurry: +1 px a step,
    two rungs a frame, 150 px/s through the rock, rope ladders unroll at
    24 px a frame.
  - **WORK.** Each accepted edit becomes a job for the free knocker with
    the lowest (route + setup) × his job factor (Ezra 0.8, Pip 0.9, Absalom
    1.0, Tobias 1.5, Pengelly 1.8 for close surface jobs only, Jory 4).
    Pins: hands on it, two tugs (it wobbles, is lifted out of the baked
    foreground), POP, a look at it; a dress swap goes over his shoulder and
    a new one comes out of the apron; held to the rock at its new place,
    tick, tick, TOCK. **The edit lands at the TOCK** (`PachinkoBoard.applyEdit`
    on the board as it stands + `api.setBoard` + an `edit` event): the crew
    finish in any order, and because the edits commute the last TOCK leaves
    the layout the planner validated. (`ctx.apply` is not used; on a coin,
    main's `finishWork` sets the planner's final board, which is the same.)
    The brace gets a plank and three blows at a point 5 px in from the end;
    a mouth is boarded up or prised open; the dinner pail is shoved. Tobias
    goes and holds his lantern up for the first job under way; Pengelly
    reads the job off his card while the planner decides it, and pencils a
    mark for every TOCK. **WORK ends 1.4 s after the last TOCK** (at least
    5.5 s in); the crew climb down and pack up in attract. Over 12 games:
    2–4 edits, WORK 7.2–10.3 s, first TOCK at 3.5–7.2 s, every accepted
    edit carried out. A coin during WORK: `finish()` snaps everyone home.
  - **Attract.** A repertoire per man, picked by seed and the shutter
    count: Absalom looks at the painted moon and takes his cap off to it,
    oils the sheave, crouches to look at the man for scale, knocks along
    the fence; Ezra picks at the haulage face, pushes the ore cart to the
    chute at its own pace, polishes a lamp hook; Tobias reads the legend
    card from behind by lantern (a rope ladder down behind it: the paper
    glows and his shadow is on it), walks the moth away from its lamp,
    times the vent door; Jory eats his lunch on the lip of the chute (a
    crumb goes down the hole), dozes against a pillar while his lamp burns
    down, knocks on a pillar; Pip digs at the sump raise, knocks on the
    rib and listens, goes down to see the pump, hops over the hole for no
    reason; Pengelly counts the fence posts.
  - **Play.** At the dive everyone is at his post and one (Ezra or Pip, by
    seed) goes into the rock on the night shift: the thief-in-waiting; the
    physics' anti-stall knock shows as his glow right there. Reactions only
    (sensed every physics step, shown on the next frame): the head and the
    face turn to the nearest marble within 95 px; a duck when one will pass
    his head within 0.12 s (his lamp gutters; Tobias keeps the lantern low);
    a hop (6 px off the floor) when one rolls at his boots or drops on them;
    a flinch at a nearby clack or a hard hit; all look up at the hopper for
    0.7 s at each release; the tallyman marks his card at a win.
  - **The lode.** Everyone freezes for the held breath (0–1.0 s after the
    `lode` event, the sound's clock), then cheers arms up, toy-stiff, with
    little hops out of step until 3.0 s, except Old Jory, who takes his cap
    off and holds it to his chest, the lamp still burning on it.
  - **Rendering (art-figures, render).** A sprite cache (every figure is
    one blit: six cost 0.04 ms, down from 3.3); a back view for ladders;
    toppling (±90°); cap off; a second hand (pencil, bread, cap, rag); the
    tally card shows his count. `view.props` in three layers (back: ladders,
    rope ladders, doors, the pail; front: pins in hand, dust, crumbs; glow:
    a lamp behind the rock, the warm inside of a door). `fx.lifted` hides a
    pulled pin from the baked foreground (a nail hole shows); every pin
    moved this visit leaves its old nail hole in the rock (baked from
    `board.edits`); a shut adit is boarded over; `fig.lampK` dims a lamp;
    `fig.hold.id` colours a held marble; `fx.moth` moves the moth;
    `fx.cardLamp` lights the legend card from behind with a shadow puppet.
  - **Performance** (headless Chrome, software canvas, 1440×900): render
    3.0 ms/frame with or without the six figures; the knockers' step 5 µs in
    attract, p99 0.2 ms in WORK; the only frames over 2 ms are the
    `R.build` re-bakes at each TOCK (37–52 ms, a hit-stop on the mallet).
  - **For the mischief phase (wave 4):** `api.knockers` / `part.canSteal(m,
    {lead, horizon, door})` (a path prediction on a copy of the marble:
    call it once per marble, not every step), `part.theft({m | plan, who,
    to, mode: set|toss|drop, v, relay})`, `part.knockListen({x, y, who, n,
    alarm})`, `part.doors()`, `part.nightShift()`, `part.perform(who, name)`
    (any attract routine), `part.busy(who)`. A stolen marble is frozen in
    the world (`phase 'pocket'`, `m.stolen`), hidden in the view, drawn in
    his hands, and its age is given back on release. Harness:
    `?force=theft`, `?force=knock`, `?force=playdead`.
  - **Events out:** `figure {what, x, y, who}` with step · climb · hop ·
    land · pull · tap · set · lay · push · toss · knock · listen · door
    {how} · rope {how} · pick · oil · eat · snore · wake · flick · mark ·
    topple · upright · release {m, how} · sweep · dig · capoff; `stolen {m,
    x, y, who}`; `edit {edit, i, who}`. The sound plays step, tap, set,
    pull, lay (and cheer, which the knockers leave to the lode's own
    voices); the rest are requested in `requests.md`.
- 2026-09-27 — **Sound, wave 4: the figurines, the choir, the lode's new
  clock (audio; supersedes the lode timing and the `figure` line above).**
  **Figures:** every verb the knockers emit has a sound, tiny and wooden.
  `step` is a carved-linden boot with each man's own note (D6 Absalom, G6
  Ezra, E6 Tobias, B5 Jory, B6 Pip, A6 Pengelly), duller on dirt, with a
  plank's body on the galleries; Jory's cane ticks after each step,
  Tobias's lantern bail jingles on alternate steps, Pip's shovel rattles
  now and then. `climb` a rung (and sometimes the ladder gives), `hop` a
  peg-knee creak, `land` two boots at once, `tap`/`set` tick-tick-**TOCK**
  (the TOCK 9.6 dB over the ticks; `edit` rings the moved pin's own note
  with it), `flick` rings the pin just set, `pull` a squeak then a pop,
  `toss` a pin tinking off to one side twice, `lay`, `push` (the cart's
  bucket or the pail's tin by position), `mark` a pencil stroke, `knock
  {n, tx, ty | soft}` knuckles on the rock's own note, `listen` (the hum
  drops to half for 1 s and, one time in two, something in the rock knocks
  back), `door {how}` latch and hinge / a plank shut, `rope {how}` rungs
  slapping down the rock / hauled in, `pick` steel into coal with chips,
  `dig`, `sweep`, `oil` (the oilcan's bottom; **the sheave stops creaking
  for 90 s**), `eat`, `snore`, `wake`, `topple` (a dropped toy, −23 dBFS,
  his own tool clattering after him), `upright` (one peg clicks home),
  `release {how}`, `stolen {who}` (his own feet), `cheer` (one voice box;
  ignored during the lode). `capoff` is silent. A step budget (22 figure
  sounds per 0.5 s) drops steps first when the crew is busy.
  **The choir:** the crew's voices are 1920s doll voice boxes, not people:
  a free reed on a leather bellows through a flap that opens "oo" into
  "ay"; the pitch rides the squeeze and ends in a wheeze; the six are tuned
  to G6/9 (Jory G4 wheezy and late, Tobias B4, Absalom D5, Pengelly E5,
  Ezra G5, Pip A5 with a rising squeeze-toy whoop). Their spectrum is a
  reed's (odd harmonics: H3 ≈ H1, H2 −13 dB), not a voice's.
  **The lode, re-timed around the crew** (from the `lode` event): 0–1.0
  the held breath; +0.30 the crack; **+0.35 the whistle as the alarm
  (0.8 s)**; +0.45 lamps flare; +0.55–1.9 the cascade (the tumble-down 3 dB
  lower); +0.55–3.55 the scrip (4 dB softer during 1.0–2.6); **+1.0–2.6
  the choir, and until +3.0 the boots of their stiff hops, on the
  knockers' own shutter frames ((f + 3i) % 4 === 0, Jory excepted)**;
  +1.0–3.0 the carts; **+2.75 and +3.05 toot-toot**; **+3.4** the music box
  with the mended tine. The choir measures +7.8 dB over everything else
  in 350–1000 Hz and +3…4 dB above it higher up.
- 2026-09-27 — **Mischief and the mother lode (wave 4, rc.17–rc.21). The
  contract is the header of `pachinko-mischief.js`.** One PARTS plug-in
  (`PachinkoMischief.attach`) with a pure core that the lab's `sim.js
  mischief` also loads; the art is `pachinko-art-mischief.js`, drawn in five
  guarded render layers (albedo, crack, emissive, over, cabinet) and baked at
  build (`A.bakeMischief`).
  - **Theft (the cheat).** Every marble gets two looks, at 0.3 s and 1.4 s
    old, each a seeded coin at **p 0.14**. On yes, the knockers'
    `canSteal` looks 0.6–1.6 s ahead for a door where the night-shift
    knocker, stepping out and a step or two along, would have the marble come
    **into his hands**. The hands' offset in the ready pose is measured from
    the rig: Ezra +19.4/−16.9, Pip +17.2/−14.1 (`HANDS`). **Max 2 a game.**
    - The telegraph is the door opening 0.55 s ahead. At the door he looks
      again: if another marble has knocked it off its line, he stays in the
      rock, and the theft is refunded against the two.
    - The catch radius is 8 px (it was 13 in wave 3, and the marble jumped).
    - He runs through the rock at 190 px/s (it was 110, which kept the marble
      4 s), so a theft takes about 3 s from the grab to the set-down.
    - Live: 6/6 and 2/2 catches, and one in a real-click game.
  - **Theft exits** (`EXITS`: door, mode, face, weight):
    - good: c1 toss → 0.26 (lobbed at the lode, the 13 ~10%); b1 set → 0.08;
      rC set ← 0.10 (the EGG chute); b2 set ← 0.12 (the dinner pail);
    - bad: s1 set ← 0.16 (GOB); rC2 set → 0.14 (OVERBURDEN); b2 set → 0.14
      (the office tunnel).
    - The weights are set so a stolen marble's 13-rate and pay match what it
      had on its own (`mis/sites.js exits`, `mis/exitcheck.js`).
  - **Lamps go out.** 80% of games. The section is picked by seed:
    haulage + measures, ventilation + barren, or workings + vein + sump.
    - It starts from marble 3–9, when a game marble is 14–48 px above the
      section, falling.
    - Two flickers (0 and 0.19 s), out at +0.55 for 2.6–3.6 s, then the
      carbide catches: a stutter, lights ×1.55 easing back over 0.7 s.
    - In the dark, everything goes: pins, the knockers' caps (render skips
      flames and coal glints where `fx.dark ≥ 0.85`) and marbles (tunnel
      lights too). The glass's own reflection streak stays: it's on the glass.
    - The mother lode's flare relights a dark `deep` section.
    - `dark {region, regions, what, section}`; the flag
      `pachinko.lights-out`.
  - **The vanish.** A vanish is planned in 25% of games (0.25 of all games,
    drawn as 0.25/0.8 within dark games) and keeps a marble in 16–22%.
    - The first game marble 0.12 s deep in the section's rock band is
      marked done with `outcome {kind: 'lost'}`, and a `done {lost: true}`
      is pushed into `world.events` so main counts it. `lost {m, x, y}` goes
      out at once.
    - When the light returns it is set in the rock where it went, under a cool
      pin spot, with a bone tag **13**. "13 MARBLE, LOST" is pencilled on the
      figures card, with a stroke for each one kept since. It lasts the
      visit (`S.lost`, max 3 drawn).
  - **Cave-in** (an event). 33% of games, from marble 3–9, never on top of the
    dark. `PachinkoBoard.caveIn(board, {slot})` roofs a bay from divider to
    divider:
    - two rock rails peaking at y 375 with a capstone, or one slope against a
      wall;
    - the pins within 12 px over it are **flagged `buried`**, not removed, so
      drift nudges still commute; physics and art skip them.
    - It is never the 13 or its two neighbours (`CAVE_BAYS`). Every site
      validates, with the 13 unchanged at 1.87% (`mis/sites.js caves`).

    The sequence:
    - The telegraph: the nearest free knocker (never the night shift) goes
      to the floor over the bay and does `knockListen` (3 knocks, an ear to
      it, alarm). `cavein telegraph` fires at his first knock, and dust
      sifts down.
    - The fall comes 1.5 s later, waiting up to 1.4 s for the bay to clear of
      marbles. `PachinkoPhysics.setBoard` rebuilds the static hash, and main
      keeps the live world. Then rocks, a dust cloud, a shake, the flag
      `pachinko.cave-in`, and a work light on the heap.
    - WORK: main plans `{type:'clear'}` first and validates the drift on the
      cleared board. The knockers' `clearWork` (pick or shovel, rock flying,
      5 blows) lands it: `cavein clear`.
  - **The shift whistle.** The steam comes from a whistle on the hoist
    house's stack (143, 40) on the sound's pattern, 0.38 s after `whistle`.
    The hoist cage takes two cap lamps down the main shaft and back up (3.5
    s), and the crew look up at the whistle.
  - **The mother lode.** `lode(ctx)` takes the 13, on the sound's re-timed
    clock. From the `lode` event:
    - 0–0.45: the held breath, lights ×0.28, the cup lamp. The fuse climbs
      the stringer (0.04–0.30).
    - +0.30: the crack runs both ways from the stringer's junction at 600
      px/s, with 7 forks. It opens over 0.4 s to 1–6 px (widest at the
      middle), and the rock either side is displaced, with gold and quartz
      inside. It narrows after +3.0 to a 1 px glowing seam that lasts until
      the next game. Shake amp 2.
    - +0.35: the whistle's steam (0.8 s), then toots at +2.75 and +3.05.
    - +0.45: the flare (lights ×1.9, easing to 1 by 4.5) and a burst of warm
      light from the vein (0.28 s).
    - +0.4–2.3: 96 nuggets, analytic, bouncing once, left lying in the bays
      until the next game. Gold dust pours from the open crack.
    - +0.55–2.1: the bay cards ring up and back on the sound's cascade
      steps.
    - +1.0–3.0: two carts race floors B and C, hop the openings, and tip off
      the end.
    - **+0.55–3.55: the 13 rolls onto the drum a tick at a time with the
      coins** (`ctx.holdTally`).
    - The marquee goes wild (`fx.wild`): the letters are picked out of the
      painted face, two bands of light run through them, and the sunburst
      flickers ray against ray. **The dead bulbs come on for the rest of the
      visit** (`fx.mended`).
    - The camera steps back to take in the marquee (`fx.camOut`, 0.5–4.2).
    - The game end waits for the spectacle (`busy` to +4.2).
    - Main's placeholder lode and its two `figure cheer` events are gone
      when a part takes the 13.
  - **The rare tier:** `rare(state)` → false and `REWARD.rare = null`. Main
    emits `rare` only if a reward exists.
  - **Fairness** (`node sim.js mischief 1500`, the same drops with and
    without):

    | | novice | competent |
    |---|---|---|
    | scrip per game | 9.78 → 10.01 | 11.10 → 10.93 (−1.5%; one marble in 13 = 7.7%) |
    | the 13 | 20.6‰ → 22.1‰ | 26.5‰ → 26.2‰ (SE ≈ 1.1‰) |
    | thefts | 1 in 9.3 marbles | 1 in 10.4 marbles |
    | a stolen marble's 13 | 1.68% → 3.26% | 2.76% → 3.08% |

    Base metrics unchanged: NaN 0, timeouts 0, median 3.67 s.
- 2026-09-28 — **Gameplay and correctness fixes (wave 5c, rc.23–rc.34;
  report: `local-dev/pachinko-lab/reports/wave5c-gameplay-fixes.md`).**
  - **Keys** belong to the machine only when the canvas has the focus or the
    pointer is over the stage, the stage is ≥ 50 % on screen, no modifier is
    held, and the target isn't a link/button/field (`keysAreOurs`, HOLLER
    ROLLER's plus the focus-or-pointer rule). The focus ring shows only after
    a Tab (`.pachinko-kbd`).
  - **Clicks and Space during the coin and the dive are queued** and fire as
    PLAY starts (a held Space from the coin isn't a drop).
  - **The camera is a tween** (`camGo`). WORK is watched **dived in** (the
    crew change the board at play scale); the pull-back comes at the end of
    WORK. A coin during WORK keeps the camera in (a 0.2 s beat, no second
    dive); an empty pocket doesn't cut the crew off. The lode's step back
    lands on a whole scale. When the integer PLAY scale would be 1 (1366 ×
    768, 1280 × 720), PLAY takes a fractional nearest-neighbour scale ≥ 1.35
    (orchestrator's ruling). The dived-in crop keeps the glass whole and the
    marquee and the lower panel whole-or-none (`playTop`); on a short screen
    it shows the marquee's bulb row rather than cut the figures card's type.
  - **A reload keeps the game.** Every win is credited to the pocket as it
    lands (the drum and the ledge still count it out); the open game is
    saved (`stats.open {v, seed, dropped, score, credited, lodes}`) at coin,
    release, win and resolve. The next page starts in ATTRACT (HOLLER
    ROLLER's owner rule), the tube shows the marbles owed, the card's side is
    `credit`, and the coin door takes the game up without a token; marbles
    still on the glass come back. Event `resume`.
  - **Mischief is occasional** (a per-game plan by seed): a theft in about
    one game in two (from a marble 2–9 on, one at most), a dark 26 % (half
    keep a marble), a cave-in 20 %; a visit's first game has no theft and no
    vanish. `sim.js mischief 1500`: **0.85–0.87 events a game**, thefts
    0.39–0.41 a game, the dark keeps a marble in 1 game in 11–15. Fairness
    (a stolen marble, left alone → after): novice 0.70 → 0.75 scrip, 13
    2.4 % → 2.6 %; competent 0.86 → 0.87, 3.3 % → 3.4 %.
  - **The theft's throw has one source of truth**: the knockers'
    `core.releasePoint(nav, exit, board, u)` (with a clearance search: never
    released inside a fixture), used by the live thief and by the lab's
    `releaseOf`. The c1 lob starts over his head (y −24; it started inside
    pillar.0) with a seeded toy's throw, 120 ± 40 across, 80 ± 40 up.
    **Live** (`?force=theft`, 76 stolen marbles): c1 finds the lode 2 in 19
    (lab 9.2 %), a stolen marble pays 0.91 with 3.9 % lodes (was 0.43 and
    0.9 %; the old PLAN table was the lab's model of a throw nobody made).
    0 of 44 releases inside a fixture (was 10 of 42).
  - **Determinism:** the lode's state ends in its sim step, not in `fx()`; a
    deep dark is relit only if it was out when the flare fired and inside
    the lode's hold; main's fallback lode clears in the sim; the glass-tap
    toppler is chosen on the shutter. `critic/det.js` seeds 32, 56, 146:
    identical with and without rendering.
  - **The drift you can see** (supersedes the nudge/dress drift): 1–2 edits
    a shift, now and then 3, each bounded around home:
    - `move` a pin carried 9–13 px (≤ 16 from home; clear of pins/rails by
      11.5, of galleries, shaft mouths, pockets, tunnels, the card; the same
      rock), 30 % with a new dressing;
    - `mouth` the old drift or the office door boarded/prised (the floor
      piece beside a shut mouth is re-laid to run away from it: the old dead
      end stalled every marble, which is why no mouth edit ever validated);
      a shut mouth is reopened first thing next shift three times in four;
    - `chute` a board under a floor opening (five places; only directions
      whose run-out is clear: A.raise L, B.winze R, B.manway R, C.chute R,
      C.chute2 L/R), set/flipped/taken up, two at most;
    - `pocket` the pail or the powder box shoved 8–10 px (±12 of home) with
      lips, base and petals together;
    - `rail` the brace, each end ±6 of home and clear of the sheave.
    The knockers carry a moved pin to a new stance, lay or prise chute
    boards from a rope ladder in the shaft mouth. Each alteration gets a
    bone-white spot (`fx.alterations`) through the dive and the next game's
    first 6 s, fading to 0.3. Lab (24 shifts): 20 moves, 7 chutes, 10 mouths,
    3 pockets, 1 brace; ~650 validation drops a WORK. `sim.js drift 30`: 0
    layouts with an unreachable paying bay, the 13 out of band 4/30, its
    best x moved ≥ 6 px within 3 games in 6/6 chains.
  - **The route to the 13:** tunnels carry a `path` through the rock (the old
    drift down behind the legend card and under the old workings to the
    lode; the office tunnel across the barren measures). Transits are 1.4 s
    (drift) and 1.5 s (office). A marble in a tunnel is a lamp and a comet of
    glow props on its route, the mouth flashes going in, the exit brightens
    in the last 0.45 s, and behind the legend card the paper glows from
    behind (`fx.cardLamp`). `nearmiss {m, slot, drift}`: a marble that rattles
    the 13's guard knobs and misses (≈ 0.74 a game for a random dropper):
    the crew turn to the cup, groan once a game, Pengelly marks it.
  - **The first ten seconds:** 2.5 s after the page opens (then 25 s of no
    input in ATTRACT) Tobias drops what he's doing, hurries through the rock
    to his door by the coin door (rB2) and holds his lantern up to it,
    pointing. A glass tap: they play dead, then every free knocker points at
    the coin door. The card flips to INSERT TOKEN at the start of WORK
    (`ui.coinOpen`, `ui.work`).
  - **Footholds:** a plank runs out of a knockers' door beyond a working face
    when it opens or someone stands there.
  - **Performance:** one physics grid per board (WeakMap); the drift plan
    starts at game over and runs through PAYOUT (2 drops a step), then 4 a
    step in WORK: WORK's first 2.5 s cost 3.3 ms a frame (was 12–27).
  - **Sim metrics after** (`sim.js metrics 6000`): NaN 0, timeouts 0, median
    3.82 s (the slower tunnels), max 8.00; the 13 2.1 % uniform, 7.8 % at its
    best x; scrip per token novice 10.3, competent 13.6 (unchanged).
- 2026-09-28 — **The light, and every visual fix (wave 5b, rc.25–rc.37;
  the visual critic's list, `local-dev/pachinko-lab/reports/wave5b-visual-fixes.md`).**
  - **One light model** (`pachinko-render.js`). A 2-px grid (160 × 208)
    is computed first each frame: ambient purple-black by depth
    (`AMB_TOP [.09,.07,.15]` under the grass → `AMB_BOT [.045,.036,.09]`),
    the case light over the painted sky (fading by y 84), every lamp's pool,
    the dark, the vignette. From it, one pass writes three canvases: the
    lightmap (posterised to `STEPS` 12 on the Bayer grid), the pins' light
    (never below `FLOOR [.40,.38,.49]` unless the section is dark) and a warm
    haze round each flame (additive, r 0.42 × the pool). `R.lightAt`,
    `R.darkAt`/`A.darkAt` and a figure's colour read the same grid, so what
    the CPU decides and what is drawn always agree. Nothing is allocated per
    frame by the grid; the falloffs are inlined.
  - **Pools:** `fall(d) = 0.82(1−d²)² + 0.6·max(0, 1−d/0.24)²` × k. Lamps hung
    in a gallery are ellipses (ry 0.62) and fill their own gallery
    (× 0.5 + 0.8 × a per-cell gallery mask): the galleries are lit slots in
    dark rock. Past 1, the light over-exposes: albedo × min(0.55, 0.8(L−1))
    is added back (a pool's hot heart). The gallery walls are worked coal
    that takes the light (`BACK #1a1418…#5e4c4a`); limestone darkened 30%.
  - **Museum pin spots:** a crisp cool disc (`#dfe6ff`, flat to 0.74 r, ramp
    to 1), sized per specimen (`SPOT`) and widened to take in its tag.
  - **Figures** are drawn after the light, each in ONE flat colour: the grid
    at his chest (× 1.08, + a hair of room), quantised to 1/16; their cast
    shadows stay in the albedo. Flames stay emissive. `A.drawFigureShadow`,
    `A.drawFigureBody(g, fig, tint)`, `A.figureChest(fig, out)`,
    `A.figureLamp(fig, out)` (the offset cached with the pose's sprite).
  - **Lamps out:** each cell's region's dark, box-blurred twice (radius 3
    cells): a ~10 px soft edge, no seams between a section's regions. The
    dark multiplies the light (and the haze) after the pools, so a
    neighbour's lamp spills over its edge; every lamp in it (the crew's and
    the extras too) is snuffed at D ≥ 0.85, scaled by 1 − D below. Glows,
    flames, glints, sparks and markers skip D ≥ 0.85.
  - **The mother lode** (the part's clock, `fx.mis.lode.u`): the held breath
    (0–0.45) takes the ambient ×0.3, the case light ×0.35, the pin floor
    ×0.5, the crew's lamps ×0.15 and every extra lamp above y 355 ×0.2 (the
    cup and the fuse stay). The flare: a warm ambient lift (0.26/0.19/0.11 ×
    lift, easing out over 2.2 s), every pool ×2 for 0.4 s easing over 1.6 s,
    a flood from the crack's origin (r 150–220, k 1.35 × lift), and every
    gallery's bulbs (every 22 px along each roof). Measured on the 1:1
    cabinet (my bands): the upper board 16.1 → 7.4 in the held breath
    (−54%; rc.22 −22%) → 74.9 at the flare (×4.6; rc.22 +27%); the deep
    22.6 → 14.4 → 105.1.
  - **The vein** (`pachinko-art-mischief.js`): after the white-hot break
    (0.16 s a column) the crack is a baked texture of quartz, dark vugs and
    faceted gold nuggets (lit facet up-left, dark down-right, a black seam
    round each), each glinting on its own phase; `wmax` 3–10 px, settling
    by +3.6 to `ws` = wmax/2 (2–5 px), painted into the albedo and lit by
    its own ember lamps (every 24 px, k 0.6) until the next game. The crack
    is drawn under the figures and the pins (no pin is ever shown displaced).
  - **Paper outside the glass** is lit by the room: `R.paperLight` 0.78 in
    attract → 0.60 dived in (lifted by the flare); the cards' overlay is a
    cached dimmed copy, the counters' paper uses `A.paperK`. The legend card
    162 → 133 (attract) → 93 (play) mean luminance; the board 39 → 31.
  - **The build is cached** (`A.paintMine`): the painted sky, strata,
    galleries, ground, vein, specimens and sills are baked once a visit
    (keyed by the floors, faces and decor); the shafts, bays and rails keyed
    by their own geometry; pins are cached sprites; the overlay and the light
    model's cells cached. `R.build` 42.5 ms → 2.3 ms (a nudge) / 3.1 ms (the
    brace). Frames (1440×900@2, `critic/perf-flush.js`): draw p50 5.1–6.4 ms,
    TOCK frames 5.4–12 ms (were 54–71), none over 16.7 ms but the first.
  - **Crispness:** 14,873 blocks at ×4 in PLAY, 0 non-uniform, 0 different
    from the 1:1 cabinet.
- 2026-09-28 — **Sound, round 3: the new events (audio; adds to the
  wave-4 sound entry; the full contract is the header of
  `pachinko-audio.js`).** Every event main, mischief and the knockers emit
  (rc.37) now either sounds or is silent on purpose.
  **`nearmiss`**: the room holds its breath (0.3 for 0.5 s, 0.8 s on the
  drift route), then the crew's voice boxes say "ohh", a falling minor
  third: four boxes the first time in a game (≈ −20 dBFS), one old box
  after that; never during a lode. **`resume`**: no coin; the door's latch
  lifts and catches, the hopper re-arms, the tube settles, the case light's
  starter ticks once. **`kept`**: Fig. 13, a bakelite switch and the
  marble's own glass note, once. **`dark {regions}`**: every region of the
  section goes dry and close. **`whistle`**: the banksman's three bell raps
  ("men riding"), the cage down the shaft from +0.3 (the winding engine's
  steam, the rope, the cage in its guides), the shift whistle at +0.38.
  **`tear {nil}`**: stamped NIL (ka-THUNK) before it tears. **`gameover
  {best}`**: the HI tag rubbed out and pencilled again. **`edit` by type**
  (at the TOCK; the hammering is the figures' own taps): mouth boarded (the
  last board over a hollow adit) / prised (boards clatter, the old drift
  breathes out); chute set (a lid on a shaft) / off (the board falls down
  the shaft, knocking the lining); pocket (the pail's tin, the powder box);
  rail (the brace groans); clear (the heap slumps into the bay); move /
  nudge / dress (the pin rings in its new place); `hurried` (a coin
  mid-WORK) is one triple click. **`figure point`** a peg arm snaps out
  (the whole crew after a glass tap is a ripple of six), **`dig {tx, ty}`**
  in rubble at the cave-in. `mischief` stays silent. Measured on the real
  page (a natural game and `force=theft,vanish,cavein`): −26.6 / −26.7
  LUFS (unchanged), true peak −6.6, no clipping; the pile-up of cave-in,
  whistle and near miss peaks −8.4, a theft in the lode −6.7.
- 2026-09-28 — **The secrets (wave 6b, rc.39–rc.42; the map is `EGGS.md`,
  the report `local-dev/pachinko-lab/reports/wave6-secrets.md`).** Nine eggs,
  each behind one switch in `EGGS` at the top of `pachinko-main.js`; the parts
  read `api.eggs` and `api.visit` (the visit's once-only state), the art
  `view.eggs`. The one real-clock read is `fullMoonTonight(Date.now())` at
  mount (HOLLER ROLLER's reckoning, ±12 h); the harness never sees it.
  - **The knock on the glass** (the headline). Main tries it in the quiet
    after a game's last marble: `knockWanted()` (EGGS on, not yet this visit,
    game ≥ 2, no lode this game, `hash01(hashSeed(seed, 1313), 7) < KNOCK_P`
    0.5), from `KNOCK_AFTER` 0.75 s, waiting up to `KNOCK_WAIT` 3 s for
    `quietNow()` (every part's `quiet(t)`: mischief has no dark, no lode, no
    falling cave-in; every marble done) and the knockers' `glassReady()`.
    `game.knock` holds `gameOver` until the knockers' `glassBusy()` is false,
    then `KNOCK_BEAT` 0.6 s. The knockers' `glassKnock()` takes Tobias (Old
    Jory if Tobias isn't at his post): 4 frames still, **turn** to the front
    (everyone else holds still: `S.hush`, `stillFor(k, t)`, which the freeze
    checks now all use), 5 frames, 12 steps in on twos growing in the room's
    perspective (`GK`: eye level glass y 228, vanishing point x 160, s = 1/z,
    z eased `1 − (1 − 1/4)(1 − (1 − u)^1.5)`, so 1 → 4), arrive 3, the lamp up
    (`liftHalf` 1, `lift` 6), three knocks 0.375 s apart (wound back 2 frames,
    the knuckles to the pane 1), the hand open on the glass 4, the stare 5 +
    head on one side 5 + 4 (a click on the glass while he `listen`s: a nod),
    the lamp down 4, turn his back, 10 steps out on ones, home. ~11 s. Events
    `glassknock {what, s, x, y, n}`; flag `pachinko.knocked-on-the-glass`;
    knuckle prints `S.glassMarks` for the visit.
  - **The close-up** (`pachinko-art-secrets.js`): painted again at every size
    by a unit-space painter rasterised at pixel centres (polygons, ellipses,
    capsules, lunes, a rotate/shift for the waddle, the head's tilt and nod),
    lit by his own lantern in 6 flat scalar bands (`AMB [.16, .13, .25]`, `KEY
    [1, .8, .5]`, falloff `1/(1 + (d/8.5)²)`, a cool rim on up-facing edges),
    the head and barrel shaded away from the lamp with lunes, an outline, a
    varnish speck in each painted eye from s 2.6. Cached per (who, view, s to
    0.02, pose, fist, tilt, nod, lamp). His shadow on the rock (albedo, thrown
    away from his lantern, bigger and softer with s), a patch of shade under
    his boots, the lantern's haze, the glass's sheen shivers a pixel on each
    knock. `fx.glassHush` (0..1 with s): the ambient ×(1 − 0.3), the case light
    ×(1 − 0.25), every lamp but his ×(1 − 0.42) (`L.own`).
  - **The other eggs:** hung the moon (a tap within 10 px of `decor moon`;
    a damped swing `ω 2π/1.15, τ 0.85`, kick 3.6 rad/s, settling at ±0.38 rad;
    Absalom fixes it in ATTRACT from 2.6 s, from the far side), two bits
    (five taps with onsets 1, ½, ½, 1 beats ±20 %/±30 %, beat 0.14–0.9 s; the
    answer at +2 and +3 beats, 6 s rest), the fortune fish (a hold of 0.8 s
    within 9 px of (193, 288); the fish is now always painted live, `A.liveFish`),
    the back of the card (crayon strokes seen mirrored where `fx.cardLamp`
    lights the paper), welcome back (the first invitation of a visit with
    `stats.games > 0`), for scale (`ui.gamesEver ≥ 13`), wave at the train
    (a tap in glass x 170–222, y 40–58; toots at +0.7/+1.1; 12 s rest), moon
    nights (Absalom's moon routine 0.22 → 0.4, and to the window). **Cut:**
    damp powder (the powder box's third marble: its gag landed on top of the
    shift whistle's own show, and it was clever rather than tender).
  - **Leftovers:** the old drift's light in the deep rock (y > 300) is r 32,
    k 1.7, with a trailing glow 0.12 of the route behind; bay 12 is out of the
    cave-in choices (filtered in mischief: its heap sat under the sticker);
    the dead troffers stutter on with the lode's wake-up (room art).
- 2026-09-28 — **Sound, round 4: the eggs (audio; the contract is the
  header of `pachinko-audio.js`).** **The knock on the glass** (`glassknock`):
  nothing announces it. On `turn` the room sinks over 1.2 s to near-silence
  (the mains hum to 3 %, the mine's air to 5 %, the music off, the case
  light's tube to 28 %: it buzzes over his boots otherwise); measured on the
  real page, the mains drop 30 dB and the room sits at the flame's hiss. His
  `step`s are the lantern man's own boot (E6), louder and drier with `s` (the
  case's room crossfades out; −40 → −20 dBFS), emerging from the quiet about
  step 8 and rising to +12 dB over it at `arrive`. `lift`: the bail creaks,
  the carbide hiss comes close (with a sputter now and then). `knock` ×3: a
  new kernel, a small linden knuckle on the case's plate glass (the pane's
  damped modes 120–1100 Hz, its short ring above, a soft onset), −23 dBFS,
  dry and near, the same buffer three times: +14 dB over the hush. `hold`:
  only the flame. `nod`: one peg. `lower`, `away` (the hiss goes), `home`:
  the room back in 0.1 s. **Knocking back** reaches the sound as `empty`
  (no marbles left): while he's out, `empty` is the player's own knuckle on
  the same pane (the same modes, a harder, brighter onset); `glasstap` is
  now that pane too. The train and the tube's flicker wait while he's out;
  if `home` never comes, 16 s. **The others:** `moon` swing (a plywood clack
  on its nail, the nail's creak, seven knocks on the backboard, settling) /
  straight (one tock); **two bits** sounds on the knockers' own `figure knock
  {twobits}` (they fire within one physics step of the beat: measured 0.40
  s apart for a 0.40 s beat), brighter and louder than a working knock so it
  cuts through the music box (+6/+7 dB); `fish` warm (24 cellophane crinkles
  as it curls, +5…10 dB over attract above 3 kHz) / cool (one); `trainwave`
  toot (the distant train's own three-chime whistle, short, 7 dB nearer than
  its call, the valley answering); `figure greet` (the lantern up twice, the
  bail jingling). `forscale` and `capoff {real}` are silent. **The lode**
  also wakes the room's dead troffers: starter ticks at +0.67 and +0.95,
  a buzz from +1.18 for half a second.
- 2026-09-28 — **The last mile (wave 8, rc.44; the final critic's six
  blockers and its polish list, `local-dev/pachinko-lab/reports/wave8-last-mile.md`).**
  - **ATTRACT's scale on ordinary screens** (orchestrator's ruling for the
    owner: readability over pixel purity at 1×). Where the whole-cabinet
    scale would be 1, ATTRACT takes a fractional nearest-neighbour scale on a
    1/16 grid, as big as fits, if that is at least `FRAC_MIN_A` 1.2: 1920 ×
    1080 → 1.8125, 1680 × 1050 and 1536 × 864 @1.25 → 1.75, 1440 × 900 → 1.5,
    1366 × 768 → 1.25; 1280 × 720 (fit 1.19) stays 1. Whole scales wherever
    they are ≥ 2. PLAY is unchanged (whole ≥ 2, else fractional ≥ 1.35).
  - **The lode's camera** (`lodeFrame()` in main): the climax scale is the
    largest whole scale ≥ 2 at which the marquee and the glass fit, else a
    fractional one ≥ 1.35, never above PLAY's; equal to PLAY's, it pans. Its
    crop keeps the dive's rules: marquee whole, glass whole, the lower panel
    whole or none. 1440 × 900 @2: s 3, y −2.7…560 (the whole cabinet; was
    −27…535, through the figures card). 1920 × 1080, 1680 × 1050, 1536 × 864
    and 1280 × 800 @2 now pan at s 2 (or 3) to show the marquee (y −18…494
    at 1080p). 1366: 1.625 → 1.5 (was → 1). Too small for both: it holds.
  - **The 13's guard is out of the drift** (`LODE_GUARD` and `lodeZone` in
    the board): knuckle.l/r, guard.top/l/r are never carried, no pin whose
    home is within 14 px of the cup's centre and y 328–384 moves, and no pin
    is set down there. A drifted knuckle over the cup had made the far-left
    route pay 60 scrip a token (the 13 at 31 %). Lab (`w8/lanes.js`, main's
    planner over 12 thirty-game visits, every 10-px lane): before, max 61.9;
    after, max 23.1 at 200 drops a lane, and the flagged lanes measured with
    1500–2000 drops are 15.6–20.2 (the highest is the powder box shoved under
    the middle). The critic's seed-303 far-left visit: 35.7 → 7.0 a token.
    Over 360 drifted boards the uniform 13 (1.38 → 1.45 %) and scrip a token
    (10.47 → 10.46) are unchanged. `sim.js drift 90`: 0 unreachable paying
    bays either way, the 13 out of band 9 → 7, its best x moved ≥ 6 px within
    3 games in 18/18 → 17/18 chains. `sim.js metrics` and `sim.js mischief
    1500` unchanged.
  - **The shift whistle's full show** (the bells, the cage, the steam, the
    bulb chase) at most once every `WHISTLE_REST` 4 s and never during a
    lode; a catch inside the window keeps its plink, light and hop. The chase
    now keys on the whistle, not the pocket, and skips a dark section.
  - **The theft's telegraph:** the door comes off its latch about 0.95 s
    ahead (an early `canSteal` look, lead 0.5, horizon 1.35), with the latch
    sound, and his lamp shows through a 3-px crack that brightens over 0.4 s
    (`doorcrack` prop and a small lamp); at 0.55 s he steps out as before. An
    abort at the last look closes the door again. The open door's glow and
    the crack are a new props layer, `lit`, drawn after the light and under
    the figures.
  - **Smaller:** the fish hold is not a glass tap (a press on the fish is a
    tap only if let go before it warms); Fig. 12's tag hangs under the fish,
    out of the needle's way; the hung moon's nail is 6 px above its centre
    and it settles at ±0.48 rad, with lopsided seas painted the same on the
    backdrop and the cut-out (`A.MOON_SEAS`); a moon repair cut short by a
    game (`S.moonFixGen`) is picked up again in the next ATTRACT; a kept
    marble's tag is placed clear of every tag, marker and specimen
    (`A.tagSpot`), and its spot takes the tag in; Jory's Z is a 4 × 4 Z off
    his face, away from the fish; the "ALT n" pencil mark is cut; the lost
    tally stands clear of LOST; the plaque's gouged name is seeded letter
    debris (no name exists anywhere in the source); every canvas read back
    more than once is `willReadFrequently`; the canvas has
    `scroll-margin-top` for the fixed banner; the room stops waiting for a
    machine that never mounted after ~12 s.
