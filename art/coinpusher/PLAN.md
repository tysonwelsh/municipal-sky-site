# SCRIP CREEK — a coin pusher of dubious provenance

Plan for the second minigame in the Appalachian arcade universe: a coin
pusher (the hypnotic centerpiece of any real nickel arcade), a machine
retrofitted from equipment left behind by a coal operation that no longer
exists — if it ever did. Tokens in, tokens out, and sometimes the prize
counter's own merchandise slides off the pile into your hands. This is also
the build where the **shared arcade core** is born, because
this universe's end state is an RPG that mounts these machines as cabinets
inside one big haunted building, and two games is when patterns become
contracts.

**Working title:** SCRIP CREEK (marquee name — now a *misnomer*, since
scrip is the pink paper ticket currency and this machine deals strictly in
tokens; see §8 for rename candidates, or keep it as a lie the machine
tells). A brass plaque reads "PROPERTY OF ______ COAL & LAND CO." with the
name scratched out.

**Folder:** `/art/coinpusher/` (mechanism name, per house convention —
HOLLER ROLLER lives in `/art/skeeball/`). Moves under the venue folder later
with no internal changes; everything relative-pathed.

**Cabinet mascot:** an animatronic **raccoon**, paws pressed against the
inside of the glass, eyes following whichever coin is closest to the edge.
(The possum presides over the venue; each machine gets its own critter. A
trash panda guarding a hoard of shiny tokens is typecasting and we are
doing it anyway.)

---

## 1. What we're actually building

A single coin pusher viewed head-on through its glass, slightly from above so
the player can read the coin field — the same fake-3D one-point perspective
as the skee ball machine, one cabinet filling a portrait screen.

Inside: an oscillating steel shelf (the pusher) sweeps forward and back over
a static lower tray. The field is paved with tokens. You drop tokens from
a chute you slide along the top; they land on the pile, the pusher grinds
everything forward, coins avalanche off the shelf onto the tray, off the tray
toward the edge — and over the edge is either the **payout trough** (center:
yours) or the **side gutters** (the house's, always hungry, slightly wider
than seems fair). Prizes ride on top of the coin field waiting to be bulldozed
over: folded paper fortunes, arrowheads, a mason jar the size of a thumb, one
glass eye.

### Design pillars (in priority order)

1. **The pile has to feel real.** Coin pushers work because of avalanche
   greed — *that whole ledge is about to go*. If coins don't shove each other
   convincingly and teeter believably at edges, nothing else matters. Physics
   before personality, same as skee ball.
2. **One coin at a time, forever.** Drag to aim the chute, tap to drop.
   The whole game is where and *when* in the pusher's cycle you release.
   No meters, no multi-touch, one thumb, portrait.
3. **The economy is a push-your-luck loop.** Tokens in, tokens out —
   plus the prizes riding the pile. Winnings land in a tray in plain
   view. Sessions end themselves when greed or tokens run out.
4. **Deranged but telegraphed.** Same rule as HOLLER ROLLER: outcomes ~85%
   physics, ~15% announced mischief. Wear affects the pile, never whether
   your drop registered.

---

## 2. The shared arcade core (built here, adopted everywhere)

Skee ball's plan promised a universe API (`mount()` factory, ticket ledger,
events) but only the factory and event emitter exist in code today — there is
no localStorage, no ticket counter yet. So the shared layer gets **created in
this build** and skee ball retrofits onto it as this build's final milestone.

New folder `/art/arcade/` (the universe's engine room):

```
art/arcade/
  arcade-core.js      mount plumbing, currency ledgers (tokens, scrip),
                      inventory, save schema, RNG, events
  arcade-palette.js   the NIGHT — shared room/atmosphere colors
  arcade-sprites.js   universe actors: fauna heads, moths, fog, marquee type
  WORLD.md            the lore bible (see §6)
```

### `arcade-core.js`

- **`Arcade.mountCanvas(container, w, h, label)`** → `{canvas, ctx, refit}`.
  The integer-scaling boot extracted from `skeeball-main.js` (device-pixel
  fit, `imageSmoothingEnabled = false`, resize listener). Every machine
  renders at its own internal resolution; Scrip Creek uses **216×384** like
  skee ball, and that stays the house standard unless a game proves it can't.
- **`Arcade.save`** — one namespaced localStorage document, versioned:

  ```js
  // key: 'holler.v1'
  {
    v: 1,
    tokens: 41,                   // play money — every machine eats tokens.
                                  // (In-lore name TBD; the key stays 'tokens'.)
    scrip: 137,                   // the pink paper tickets: won at skill
                                  // games, spent at the redemption counter
    inventory: ['glass-eye', 'fortune-03', 'arrowhead'],  // real objects
    games: {
      skeeball:  { hi: 320, plays: 41, jackpots: 2 },
      coinpusher:{ hi: 22,  plays: 12 }   // hi = best single-session haul
    },
    flags: { 'coinpusher.saw-the-snake': true }   // world memory
  }
  ```

  Two things here are RPG seeds, not bookkeeping. **`flags`: minigame
  events are story hooks** — when the RPG exists, an NPC can already know
  you've seen the coin snake, because the machines have been journaling
  into the world state since day one. **`inventory`: prizes are objects,
  not point values.** The glass eye isn't worth N scrip; it's a glass
  eye, and it's in your pocket now. The pusher is where the universe's
  item system is born.
- **`Arcade.tokens` / `Arcade.scrip`** — parallel ledgers, same interface:
  `get()`, `add(n, source)`, `spend(n)`; each emits an event any page/shell
  can listen to. **`Arcade.inventory`** — `has(id)`, `grant(id)`,
  `all()`; granting an already-owned unique item falls back per-item
  (duplicate fortunes are fine; there is only one glass eye, and drawing a
  second one is the machine's problem, not the schema's).
- **`Arcade.rng(seed)`** — the seeded PRNG (mulberry32 or similar), shared so
  replays/tuning are reproducible across games.
- **Mount contract** (what the RPG will hold every cabinet to):

  ```js
  handle = Game.mount(container, opts)
  handle.destroy()        // player walks away from the cabinet
  handle.pause() / resume()  // RPG opens a menu, dialogue interrupts
  // events out: 'gameover' {score, payout}, 'jackpot' {what}, 'flag' {key}
  //   (payout: {scrip} for skee ball, {tokens, items} here)
  // opts in:    onEvent, tuning overrides, muted, save adapter
  ```

  `destroy`/`pause` are new relative to skee ball's current code and they are
  **mandatory from now on** — an RPG-embedded cabinet must be interruptible
  and disposable without leaking listeners, timers, or audio nodes.

### `arcade-palette.js`

Split skee ball's palette along the line it already implies: the **room**
belongs to the universe, the **machine** belongs to the game.

- Shared (moves here): `NIGHT0/1/2`, `PUR1/2`, `FOG`, `MOON`, `BONE`,
  `BONE_D`, `PINK`, `PINK_D`, `PINK_DK` — the swamp-night atmosphere every
  scene shares so the whole venue reads as one place.
- Local to each machine: skee ball keeps its woods/lane/cork; Scrip Creek
  gets oxidized steel blues, smudged glass, brass trim and token brass, and the
  warm interior bulb light (`LIT`-family ambers) that makes pushers glow
  like aquariums.

### `arcade-sprites.js`

Procedural sprite builders that are *universe actors*, not machine parts:
fauna heads (possum now, raccoon now, whoever's next), the moth that orbits
lights, fog drift, and the hand-painted marquee lettering routine. Each is a
pure function `(palette, params) → offscreen canvas layers`, so the RPG can
later draw the same raccoon at a different size in a different room and it's
recognizably the same animal.

**Rule of extraction:** only what the *second* game proves is shared gets
extracted. No speculative engine-building — the RPG shell will be designed
against real cabinets, not the other way around.

---

## 3. Technical approach

### The simulation (a pile of discs, honest shoving)

No physics engine, same reasoning as skee ball: the needed sim is specific
and small. Coins are discs in top-down machine space `(x, z)` with a tier
attribute; render projects to the tilted head-on view.

- **Two tiers + the void.** Tier 1: the moving shelf. Tier 0: the static
  tray. Past the tray lip: falling — into trough or gutters by `x` range.
- **Pusher:** a block oscillating in `z`, ~0.45 Hz sinusoid (speed tunable,
  and *variable* — see §5). Coins in contact with its face get displaced.
- **Position-based dynamics, not impulse physics.** Each fixed step
  (120 Hz accumulator, same loop discipline as skee ball): advance pusher,
  apply per-tier friction (shelf coins ride the shelf; tray coins only move
  when shoved), then relax circle-circle overlaps 4–6 iterations. PBD is
  stable at high density, tuning-friendly, and ~60 lines. At the target
  **~90 coins**, brute-force O(n²) pair checks are ~4k/step — nothing, even
  on a weak phone; a spatial hash is a noted fallback, not a requirement.
- **Tier transitions:** a coin whose center passes the shelf edge drops to
  the tray (short animated fall, *chak*), tray lip → payout fall (the good
  sound). A dropped coin from the chute lands where aimed with a little
  scatter and a bounce.
- **Prizes** are just big discs (jar, eye) or short rectangles (fortunes,
  arrowhead) with higher mass in the relaxation step — they ride the pile
  and get bulldozed like everything else. No special physics.
- **Determinism:** seeded RNG for scatter and mischief; a `?debug=1`
  top-down true-position overlay, same convention as skee ball.

### Rendering

- Canvas 216×384, integer-scaled, `image-rendering: pixelated`, letterboxed
  in room-darkness — all via `Arcade.mountCanvas`.
- All procedural pixel art: cabinet, glass (a faint bone-white reflection of
  a window that is *behind the player*, with fog moving in it), steel field,
  token sprites (plain brass, 3–4 rotation frames, a few tarnish variants,
  two buffalo-heads)
  raccoon head + paws, marquee. Static layers built once at boot, dynamic
  coins blitted per frame — 90 sprite blits is trivial.
- Depth sort by `z` within tier; coins overlapping the tray lip draw
  half-over it, because the teeter is the whole tension of the game.

### Audio (procedural, house style)

- The **pusher grind**: low filtered-noise loop that swells with the stroke.
  This is the machine's breath and the room tone's spine.
- Coin-on-coin *ticks* (density-triggered, so avalanches crackle), the
  trough **payout clatter** (brass, yours), the gutter *swallow* (felted,
  final, the house's), prize *thunk*.
- Fluorescent hum + swamp insects from the shared room-tone recipe; unlock
  on first touch.

### Input

- Pointer Events only, `touch-action: none`.
- **Drag anywhere on the lower half** to slide the chute (relative drag, not
  absolute touch position — thumb never covers the drop point). **Tap** to
  drop. That's the entire verb set.
- The chute is drawn as part of the machine (a swiveling brass spout),
  never a HUD element.

---

## 4. Screen layout (portrait, one screen)

```
┌──────────────────────┐
│ marquee: SCRIP CREEK │  ← flicker; scratched-out coal co. plaque below
│ ┌──────────────────┐ │
│ │ raccoon, paws on  │ │  ← eyes track the coin nearest the edge
│ │ glass, watching   │ │
│ ├──────────────────┤ │
│ │ ▓▓ pusher shelf ▓▓│ │  ← oscillating; drop chute slides above it
│ │ ○○○○○○○○○○○○○○○  │ │  ← tier 1: coin field on shelf
│ │ ○○○○ prizes ○○○○ │ │  ← tier 0: tray; jar/eye/fortunes riding pile
│ │ ○○○○○○○○○○○○○○○○ │ │  ← the teetering lip
│ │ ▁gutter▁TROUGH▁gutter │  ← center trough yours; gutters eat
│ ├──────────────────┤ │
│ │ tokens: ○×41 tray: ○×6 │ ← token pocket + winnings tray (tap to pocket)
│ └──[coin door]─────┘ │  ← first drop starts; tap door again to walk away
└──────────────────────┘
```

Drag/tap zone is the glass, lower two-thirds. Raccoon and marquee are display.

---

## 5. The economy & the derangement

### Economy (push-your-luck, self-terminating)

**The universe's money, settled here.** **Tokens** are the play money —
what every machine eats. (Their in-lore name is deliberately open; the
save key is `tokens` and stays that way regardless of what the marquee
painters eventually call them.) **Scrip** is the pink paper tickets —
won at skill games like skee ball, spent at the redemption counter. The
name is dead-on historically: company scrip was money that's only money
inside the company store, which is what arcade tickets have always been.
The pusher touches no scrip at all — it's a closed loop of tokens that
sometimes coughs up the counter's own merchandise directly.

- **One coin, both directions.** You drop tokens (plain brass, 1 per
  drop) straight from your global pocket — no buy-in, no hand; you're
  feeding it your actual play money. The field is paved with more of the
  same. Whatever you push off is tokens coming back.
- What falls off the lip lands by lane: center → the **payout tray**
  (yours), sides → gutters (gone). Winnings sit in the tray *visibly*,
  as coins, not as a number, until you tap the tray to pocket them
  (`Arcade.tokens.add()`).
- **The core decision: one more token?** The field's geometry is
  net-negative over time (as in life), so every drop is a bet that the
  teetering ledge finally goes. A session starts at your first drop and
  ends when you walk away (tap the coin door again) or your pocket hits
  zero. Greed is the game. Target session: 60–120 s.
- **Prizes fall as themselves.** A fortune that drops into the trough is a
  fortune in your `inventory` — folded paper, readable from the pause
  screen, someday tradeable in the RPG. Likewise the arrowhead, the mason
  jar (its label says 13; of what, it doesn't say), the buffalo-head
  tokens (worth 5 plain ones, only ever two in the field), and the glass
  eye — which sets a `flag`, and the raccoon watches *you* for the rest
  of the session. Prize definitions live in a shared **prize registry**
  (see WORLD.md, §6): one catalog serves both the future redemption
  counter and this machine's cargo, so a jar won here is the same jar
  sold there — the pusher is the back door to the prize counter, priced
  in nerve instead of scrip. That's exactly what a real pusher is.
- Session over → tally → attract mode. High score = biggest single-session
  *net* token haul; prizes are their own reward.
- **Where do tokens come from?** In-universe: a changer by the front door
  turns nickels into tokens (the "nickel arcade" of legend — the RPG's
  problem). Until then, a first visit to any machine seeds the save with
  a **starter pocket of 20 tokens**; the pusher is the one machine that
  can (briefly, cruelly) be a token *source*, which makes it the
  economy's pressure valve until the changer exists. Beyond that, see §8.

### Wear (always on)

- **The tilt.** Each session, the tray has a slight hidden cant, rerolled per
  game — coins drift a hair left or right on their way to the lip. Learnable
  by ball— *coin* three; the pusher-cycle timing knowledge transfers between
  games but the tilt must be re-read. (Skill-positive, same as the lane
  warp.)
- **The stutter.** Once in a while the pusher hitches mid-stroke — grind
  note drops, shelf pauses a beat, resumes. Pure timing texture; telegraphed
  by sound a half-second early.
- Cosmetic: fogged glass corner, one dead bulb in the interior light strip,
  a token welded to the tray by corrosion that never, ever moves
  (players will try; the raccoon shakes its head).

### Mischief (rare, announced, never steals a drop)

- **Something pushes back.** The room dims a shade, a low knock sounds from
  *under* the tray, and one pusher stroke, the coins near the lip slide
  *backward* an inch — against the machine's own physics. Costs the player
  nothing but position; worth everything in atmosphere.
- **The coin snake.** Rarely, after a jackpot-scale avalanche: coins on the
  tray reflow into a sinuous line for ~2 seconds, then scatter. Sets
  `flags['coinpusher.saw-the-snake']`. No mechanical effect. The RPG will
  care later.
- **Moon event** (shared universe pattern): fog crosses the glass
  reflection, room goes bruise-purple, and for ~8 seconds the gutters
  *close* — brass shutters, clearly visible — so everything off the lip is
  yours. Telegraphed jackpot window, sibling to skee ball's wide-100s.
- **The raccoon's cut.** After a big trough haul, the raccoon's paw slaps
  the glass; one coin of the payout visibly diverts to a small slot beneath
  its perch. It's *taking one*. Amount: exactly one, always. (Mischief
  costs ~nothing or pays out; this one is a 1-coin tax that buys a laugh
  and a lore fact: the animals get paid.)

---

## 6. Universe integration & the WORLD.md bible

**Game flow states:** `ATTRACT` (pusher runs empty-handed, raccoon dozes,
marquee cycles) → `PLAY` (first drop) → `PAYOUT` (walk away or broke) →
`ATTRACT`. Same skeleton as skee ball — this state shape is part of the
cabinet contract.

**Standalone today, cabinet tomorrow:** `index.php` mounts it as its own
page exactly like skee ball. Later the RPG calls `CoinPusher.mount()` inside
the big room and listens. No page assumptions, no globals beyond the
namespace, `destroy()` leaves the DOM as it found it.

**`WORLD.md`** starts in `/art/arcade/` with this build: the canon file for
everything decided *incidentally* while building machines — the possum's
name candidates, the raccoon, "always 13," the scratched-out coal company,
what the flags mean, and the **economy law**: tokens (in-lore name TBD)
are the play money every machine eats; skill games pay out **scrip** (the
pink paper tickets); scrip buys prizes at the redemption counter; the
pusher pays tokens back and also drops prizes directly. It also hosts the **prize registry** — the single catalog of
winnable objects (id, name, sprite notes, counter price in scrip, lore
line) that the redemption counter, the pusher's cargo, and eventually the
RPG's inventory UI all read from.
Minigames-first worldbuilding works only if canon is written down when it
happens; the bible is how ten cabinets stay one building.

---

## 7. Build order (each milestone playable/verifiable)

1. **Arcade core + still life.** `/art/arcade/` with `mountCanvas`, save
   schema, palette split, WORLD.md stub. Scrip Creek scaffold renders the
   full machine static — steel, glass, raccoon, a paved coin field.
   *Verify: it looks like it's been there for forty years.*
2. **The pile.** PBD coin sim + pusher + tiers + debug overlay, rectangles
   welcome. Tune until watching it run with no input is already hypnotic —
   that's the attract mode falling out of the physics for free.
   *Verify: dropping one coin somewhere smart feels consequential.*
3. **Full loop.** Chute drag/tap, hand economy, prizes, payout, attract,
   save writes. *Verify: a full pocket → drops → scoop-or-walk → payout
   session on a phone, with a prize landing in inventory.*
4. **Juice + derangement.** Audio pass, raccoon behaviors, tilt/stutter/
   knock/snake/moon/tax. *Verify: it's funny and a little wrong.*
5. **Mobile hardening + skee ball retrofit.** Real-device pass, then port
   HOLLER ROLLER onto `arcade-core` (mountCanvas, palette import, save
   document, destroy/pause) and wire it into the economy: **1 token per
   9-ball game in, scrip out** — replacing its planned-but-unbuilt
   nickel/ticket plumbing. Add both games to `/art/index.php`.
   *Verify: both machines drain the same token pocket and feed the same
   scrip balance; one wallet, one night.*

Files (house convention):

```
art/coinpusher/
  index.php            page shell, canvas mount
  coinpusher.css       framing, letterbox, vignette
  coinpusher-main.js   boot, states, fixed-step loop, cabinet contract
  coinpusher-physics.js  PBD pile, pusher, tiers, payout resolution
  coinpusher-render.js megamachine layers, coin/prize sprites, raccoon
  coinpusher-audio.js  grind, clatter, knock, room tone
  PLAN.md              this file
```

---

## 8. Open flavor decisions (not blocking)

- The raccoon's name. (Candidates: **Denver**, **Tarnish**, **Miss Penny**.)
- **What the tokens are called.** Deliberately unnamed for now — the save
  key is `tokens` and the machines just show the coin. The name can arrive
  whenever the venue gets one.
- **How players earn tokens before the changer exists.** Starter pocket of
  20 covers the first sessions; after that — daily attract-mode gift? A
  token in the coin return if you check it (always check the coin return)?
  Needs an answer by the time skee ball costs a token.
- The scratched-out coal company's name — or whether it stays scratched out
  forever (leaning: forever).
- What the glass eye is *for*. (The RPG's problem. Flag it and move on.)
- Whether the trough should ever pay a coin that isn't a token — a 1924
  Mercury dime, say — as a silent collectible. (Leaning yes, one per...
  ever?)
- **The marquee misnomer.** SCRIP CREEK names a machine that pays no
  scrip. Options: rename (TOKEN HOLLER, PUSHY, THE TILL, PENNY BRANCH),
  or keep it as a lie the machine tells — maybe it *used* to pay scrip,
  before the incident nobody names. Parked; owner will decide later.
