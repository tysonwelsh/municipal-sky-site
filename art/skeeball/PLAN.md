# HOLLER ROLLER — a deranged skee ball machine

Plan for the first minigame in the (as-yet-unnamed) Appalachian arcade universe:
a moonlit Chuck-E-Cheese-esque entertainment complex in the fog of a swampy
holler, presided over by an animatronic possum. This document covers the design
and build plan for a playable, mobile-first skee ball game that can later be
slotted into the larger RPG as one of its nickel-arcade minigames.

**Working title:** HOLLER ROLLER (the machine's marquee name — the "S" bulb on
whatever it used to say burnt out decades ago). Working name only; easy to
change.

**Folder:** `/art/skeeball/` for now. When the universe gets a name, the whole
folder can move under it (e.g. `/art/<venue-name>/skeeball/`) with no internal
changes — everything is relative-pathed.

---

## 1. What we're actually building

A single skee ball machine, viewed head-on in one-point perspective, as if the
player just walked up to it. You swipe to roll. Nine balls per nickel. Rings
score 10/20/30/40/50, two impossible little 100-point holes in the top
corners glow electric pink. Tickets crank out of a brass slot at the end. The
machine is old, wooden, waterlogged at the base, and it is not entirely honest.

### Design pillars (in priority order)

1. **It has to feel good to throw a ball.** Swipe → roll → ramp → arc → *thok*
   into a ring. If that loop isn't satisfying in isolation, nothing else
   matters. Physics gets tuned before any derangement goes in.
2. **Skeuomorphic and wooden.** It should read as an actual machine: lane wax,
   cork rings, ball-return rail, coin door, a hand-painted score placard. The
   dark-blue/purple/fog palette lives *around* the machine (the room, the
   night), not on it. The wood is aged amber-grey, lit by one buzzing
   fluorescent tube and the pink neon of the 100 holes.
3. **Deranged like a 90s Nicktoon, not unfair like a broken toy.** The machine
   cheats occasionally, visibly, and with personality. The player should
   *blame the machine and keep playing* — never feel the input was ignored.
   Rule of thumb: outcomes are ~85% deterministic skill, ~15% telegraphed
   mischief.
4. **Mobile-first.** Portrait, one thumb, sessions of 60–90 seconds. Desktop
   (mouse-drag) works too but the phone is the design target.

---

## 2. Technical approach

### Why not a physics engine or game framework

Matter.js/Planck are 2D and skee ball is fundamentally a 3D problem (a ball
leaves a ramp and lands *into* a plane). Three.js is overkill and fights the
pixel aesthetic. The right tool is a **tiny bespoke simulation** — one ball,
three phases, maybe 120 lines — which also keeps the project consistent with
the rest of the Art section: vanilla JS, no dependencies, no build step.

### The simulation (fake 3D, honest math)

Ball state lives in machine-space coordinates: `x` (lateral), `z` (distance
down the lane), `y` (height). Fixed-timestep integrator (120 Hz accumulator
inside `requestAnimationFrame`) so physics is identical on a 60 Hz phone and a
144 Hz desktop. Three phases:

1. **Lane roll** — swipe sets initial `vz` (speed) and `vx` (aim). Rolling
   friction decays speed; the lane's *warp field* (see §4) adds a small
   position-dependent lateral force. If `vz` dies before the ramp, the ball
   rolls back to the player (a real skee ball humiliation, and free comedy).
2. **Ramp launch** — at the ramp, `vz` converts to launch velocity at the
   ramp's angle: ball becomes ballistic (`vy` from ramp angle × speed,
   gravity pulls it down). Faster roll = longer, flatter arc; the skill is
   matching speed to the ring you want.
3. **Landing** — ballistic ball crosses the target plane; landing `(x, z)` is
   tested against ring geometry (concentric circles + the two 100 holes).
   Rim hits get one juicy bounce-and-rattle before settling (rattle-out
   chance on the dented 40 ring, §4). Misses drain to the gutter and return.

Perspective rendering is a pure projection of `(x, y, z)` → screen with scale
falloff — the ball sprite shrinks as it travels away. No 3D library needed;
this is exactly how the 1989 games we're imitating did it.

### Pixel rendering

- One `<canvas>`, internal resolution **216×384** (9:16). Big enough that
  rings and type are readable, small enough to be honestly low-bit.
- Integer-scaled up to the viewport (`image-rendering: pixelated`),
  letterboxed with room-darkness on whatever doesn't divide evenly.
- All art is **procedural pixel art**: the machine is drawn once at boot into
  offscreen canvas layers (cabinet, lane, backstop, rings) with code —
  dithered wood grain, wear marks, water stain at the base — then blitted
  per frame. The ball, possum head, flags, and ticket are small sprites also
  built in code. Zero binary assets, consistent with the rest of the site,
  and every stain is tweakable in one palette file. (If we later want
  hand-drawn PNG sprites, the renderer's layer interface won't change.)
- **Palette:** one exported constant, ~24 colors. Aged wood ambers/greys for
  the machine; deep blue-black and bruised purple for the surrounding room
  and the window behind the machine (fog, moon); electric pink for neon,
  100-holes, and score flashes; bone white for the balls and hand-lettering.

### Audio

Web Audio, procedural, following the house style (this site already ships
four synthesis engines — the skee ball SFX are trivial by comparison):

- Ball rumble on wood (filtered noise, pitch follows speed), ramp *clack*,
  cork *thok* on landing, rim rattle.
- Score bell: a real skee ball solenoid bell, but slightly flat, and flatter
  the more the machine dislikes you.
- Ticket dispenser: ratchet clicks.
- Room tone: 60 Hz fluorescent hum, distant swamp insects, and an
  attract-mode chiptune waltz that is just barely out of tune with itself.
- Audio unlocks on first touch (standard mobile gesture requirement).

### Input

- Pointer Events only (covers touch + mouse). `touch-action: none` on the
  canvas; no page scroll or double-tap zoom during play.
- **Swipe = throw.** Sample the pointer path over the last ~120 ms before
  release; release velocity → ball speed, path angle → lateral aim. Clamp,
  then show the result honestly — the ball leaves at the angle you swiped.
- A faint chalk arrow ghosts under the ball during the swipe as an aim
  preview (drawn as wear in the lane wax, not a HUD element).

---

## 3. Screen layout (portrait, one screen, no scrolling)

```
┌──────────────────────┐
│  window: fog, moon   │  ← room, dark blue/purple; machine sits in it
│ ┌──────────────────┐ │
│ │ POSSUM ANIMATRONIC│ │  ← mascot head above marquee; eyes track ball
│ │ [HOLLER ROLLER]  │ │  ← marquee, flickering tube
│ │  (100)      (100)│ │  ← pink-glow corner holes
│ │    ((50 40 30))  │ │  ← cork ring stack, one-point perspective
│ │     ((20 10))    │ │
│ │ ╔══ score ══╗    │ │  ← electromechanical drum counter, sticky digit
│ └──┤   lane   ├────┘ │
│    │  (ramp)  │      │  ← warped wood, wax sheen, chalk aim-ghost
│    │          │      │
│  ○ ○ ○ ○ ○ ○ ○ ○ ○   │  ← ball return rail: your 9 balls, bone white
│  [coin door] [tickets]│  ← tap coin door to start; tickets crank out here
└──────────────────────┘
```

Swipe zone is the lower half (lane + rail). Everything above is display.

---

## 4. The derangement (worn, dirty, unbalanced — but telegraphed)

Baseline wear (always on, cosmetic + one mechanical):

- **The lean.** Each game rolls a hidden lane warp — a gentle lateral drift,
  different every nickel. It's *learnable within a game*: ball one teaches
  you, balls two through nine let you compensate. This is the "unbalanced"
  core mechanic and it's skill-positive.
- **The dented 40.** The 40 ring's rim has a flat spot; balls that catch it
  can rattle out into the 30. Visible dent in the sprite.
- Flickering marquee, moths at the fluorescent tube, water-stained cabinet
  base, score drum whose tens digit sticks and catches up late.

Mischief events (rare, random, always announced by sound/light *before* they
matter — the player must be able to say "I saw it do that"):

- **Possum's interest.** The animatronic head's eyes track your ball. On a
  hot streak, it leans in. Purely cosmetic — but unnerving.
- **Moon event.** Fog crosses the window, the room goes bruise-purple, the
  100 holes breathe pink, and for one ball they're 1.5× wider. Jackpot
  window, clearly telegraphed.
- **The machine sulks.** After a 100, the bell goes flat and one ball rolls
  back down the ramp as if the machine refused it (ball is returned, not
  consumed — mischief never steals a throw).
- **Ticket jam.** Payout sometimes jams mid-crank; tap the slot to whack it
  loose. Free tactile comedy, zero cost to the player.

Tuning philosophy: every event either costs nothing or pays out. Wear affects
*aim*, never *whether input registered*.

---

## 5. Game flow & universe interface

**States:** `ATTRACT` (machine idles, marquee cycles, possum breathes) →
`PLAY` (9 balls) → `PAYOUT` (score → tickets, dispenser cranks) → back to
`ATTRACT`. Tap the coin door to feed it a nickel and start.

**Scoring → tickets:** classic redemption curve — roughly score/50, +5 bonus
past 300, +13 (always 13) for any 100-hole. High score and lifetime tickets
persist in `localStorage`.

**Slotting into the universe later:** the game boots via one factory,
`SkeeBall.mount(container, opts)`, and emits plain events
(`gameover {score}`, `tickets {n}`, `jackpot`). Today `index.php` calls it
standalone; later the RPG calls the same factory inside a cabinet in the big
building and listens for tickets. No globals beyond the one namespace, no
assumptions about page context. Config (`opts`) exposes the tuning table —
warp strength, mischief rates — so the RPG can install a *particularly*
dishonest machine in a back room somewhere.

**Files** (house naming convention):

```
art/skeeball/
  index.php            page shell: header/footer includes, meta, canvas mount
  skeeball.css         page framing, letterbox, room vignette
  skeeball-main.js     boot, state machine, fixed-step loop, universe API
  skeeball-physics.js  ball sim: lane / ramp / flight / ring resolution
  skeeball-render.js   palette, procedural sprite builders, per-frame draw
  skeeball-audio.js    SFX + room tone + attract music
  PLAN.md              this file
```

---

## 6. Build order (each milestone is playable/verifiable)

1. **Scaffold + still life.** Folder, `index.php`, canvas with integer
   scaling, and the full machine rendered as a static scene — palette, wood
   grain, rings, marquee. *Verify: it already looks like the place.*
2. **Physics core.** Swipe input, three-phase sim, debug overlay (top-down
   minimap of the true `(x,z)` ball path). Tune until hitting the 40 on
   purpose is possible and hitting the 100 is rare-but-real.
   *Verify: throwing is fun with rectangles for graphics.*
3. **Full game loop.** Nine balls, score drum, payout, attract state,
   localStorage. *Verify: complete nickel-to-tickets session on a phone.*
4. **Juice + derangement.** Audio pass, possum head, lean/dent/moon/sulk/jam
   events, score-flash, ball-return clunk. *Verify: it's funny.*
5. **Mobile hardening + listing.** Real-device pass (iOS Safari + Android
   Chrome), audio-unlock edge cases, resize/rotate, perf (should be trivial
   at 216×384). Add the entry to `/art/index.php`.

Steps 1–3 are the "actually playable and fun" contract; 4 is where the
personality lives; nothing in 4 is allowed to compromise 1–3.

---

## 7. Open flavor decisions (not blocking the build)

- **Possum's name.** Placeholder candidates: **Pawpaw** (the fruit *and* the
  grandfather — very Appalachian), **Burl**, **Ezekiel "Zeke"**. The marquee
  and attract screen will reference whichever wins.
- **Venue name** for the universe/folder, when it comes.
- **Machine marquee text** — HOLLER ROLLER is the working title; alternates
  welcome.
- Prize catalog, other minigames, RPG framing: out of scope here, but the
  ticket counter this game writes to `localStorage` is the seed of it.
