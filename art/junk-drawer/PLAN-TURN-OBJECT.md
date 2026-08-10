# PLAN-TURN-OBJECT.md — the Take-a-Turn button becomes a drawer object

Owner direction (2026-08-09, after v0.5.0 shipped): the turn button moves
**into the drawer itself** — an object in the pile, draggable and
repositionable like every other item — and its look shifts to a
**slightly cartoonish, game-show register**. This document is the
proposal: the interaction contract the change implies, five candidate
designs, and the mockup plan. One mockup page per candidate lives in
`mockups/` (Phase 0 discipline, same as the frame kit and handle
mockups); the owner picks, then an implementation pass follows.

Why this works with the premise instead of against it: every object in
the drawer is a specimen in its own style, deliberately un-harmonized.
A glossy cartoon game-show button sitting in the painterly clutter reads
as *one more object that doesn't match* — the control disguises itself
as collection. The style break is the camouflage.

**REVISION (owner, 2026-08-10, v0.6.1): the doorbell is FIXED, not
repositionable.** After living with v0.6.0 the owner reversed §1's
"it is a pile item" clause: the doorbell now sits screwed to the
**bottom-left corner** of the well (half-plate + 3.5% inset off each wall,
constant −4° tilt, constant z 99) — same spot every session, every device.
It cannot be dragged or rotated: `grip()` never lifts it, `place()` and all
three rotation paths refuse it, `settle()` releases it unmoved, and an
attempted drag neither moves it nor counts as a press. Nothing about it is
stored any more (stale seats from the draggable era are swept from the
layout key). Junk deliberately dropped on it can still cover it for the
session; a fresh scatter never buries it. Tap/press, modal, a11y, and the
idle gleam are unchanged. In the same pass the specimen tag's elastic was
shortened to read about two-thirds its former length (ROPE.SLACK 1.25→1.17,
MIN_REST 60→40, seat gaps 26→17 / 20→13, lean floors scaled).

**STATUS — DONE (2026-08-10).** The owner picked **8e, the doorbell**, and it
is implemented and shipped in v0.6.0. The mockup's hero SVG is now the
production asset `turn-object.svg`, injected into `.jd-pile` by
`junk-drawer.js` as a `.jd-item` with the reserved id `jd-turn-object`; the
corner-chrome `.jd-turn-btn` (markup, CSS and JS wiring) is retired and the
pile object is the sole trigger. The §1 contract below is implemented as
written, with two implementation decisions worth recording: the tier is
**medium × 1.15** (the tier is "m" per §1 and the taxonomy's own fine dial
buys back the touch-target margin the mockup's measurement note asked for —
58 × 72 px on a 375 px phone, 50 × 62 px at 320 px), and the object's own
scatter seat is written back to `jd-scatter-v2` on settle, so a doorbell the
visitor deliberately moved survives a refresh where a specimen's position
(scenery, recomputed each load) does not — **position and rotation only**: the
stored `z` is written once by the first scatter and never overwritten, so the
ever-climbing `zTop` value a handled item picks up is never persisted.
**A burial therefore holds for the session but not across a reload** (measured
2026-08-10): `seat()` re-applies the stored `z` (99) on every load, while the
junk the visitor dragged on top reverts to its own scatter `z` of 1..31 —
items never write `z` back at all — so a refresh floats the doorbell back to
the top. That is the deliberate trade: persisting the live `zIndex` instead
would re-assert an *increasing* boost on every load (see the comment at
`remember()`), which is worse, and the alternative of persisting a burial
means a visitor can permanently lose the only control on the page. Two further
notes from review: the object carries an unconditional 44 px `min-width` floor
because the pile's cqmin sizing collapses on a short well (a phone in
landscape sits outside the ≤768 px size band and drew the plate at 32.5 px),
and `turn-object.svg` is listed in `index.php`'s `$jd_assets`, so an art-only
edit busts caches and moves the colophon's build stamp. The modal, its state
machine and the endpoints are untouched.

---

## 1. Interaction contract (applies to whichever design wins)

- **It is a pile item.** Rendered into `.jd-pile` alongside the
  collection, participates in the same drag/rotate gesture wiring
  (hold-to-grip on touch, transform-only drag), scatters and persists
  exactly as items do. No special drag physics.
- **Tap = press.** The existing press-release-without-drag gesture that
  `pick()`s an ordinary item instead plays the press animation (with the
  `JD_haptic` tick) and opens the turn modal. It never shows a specimen
  tag or report card — it is hardware, not collection, and it is
  excluded from the inventory, the count line, and `data.php` concerns
  entirely (a frontend-injected object, not an entry).
- **Discoverability guardrails** (a control buried in clutter is a
  failure mode the old corner placement didn't have):
  - initial scatter position is weighted toward the lower-left region
    and it enters the pile at the **top of the z-order** on first visit;
  - a subtle idle tell (a slow glint/pulse every ~8s, honoring
    `prefers-reduced-motion`) so a scanning eye catches it;
  - it can be buried by the visitor dragging junk over it — that's
    allowed (their drawer, their mess); the z-order boost applies only
    to the initial scatter, and its scatter position persists per
    session like everything else.
- **Accessibility**: it remains a real button to the accessibility tree
  (`role="button"`, focusable, Enter/Space presses) regardless of its
  pile costume; the modal flow behind it is unchanged.
- **Scale**: reads as a **medium** drawer object (~"m" tier footprint);
  exact box tuned per design in implementation.
- **Not in scope now**: no changes to the modal, endpoints, or data
  layer. This is a re-skin and re-seat of the trigger only.

## 2. The five candidates

Shared cartoon treatment: chunky proportions, saturated color, candy
gloss highlights, squash-and-stretch on press — a Saturday-morning prop,
not a flat UI widget. Each is drawn as a self-contained SVG (viewBox,
transparent background) so the winner drops straight into the pile
pipeline as production art.

**Plan view is binding (owner, 2026-08-09, mockup round 1):** the drawer
is seen from directly above, so every candidate is drawn TOP-DOWN — the
object lying flat on the floor, seen from the top. No horizon, no side
elevation, no ¾ tilt. Depth comes from concentric geometry, radial
shading, and cast shadow pooling around the footprint; a press reads as
*travel* via radius/shadow change (8b demonstrated the technique in
round 1 and is the reference). Round 1's 8a/8c/8d elevation drawings
were redrawn to plan view under this rule.

### 8a — The Face-Off Buzzer
The archetype: a fat glossy **red plunger dome on a squat brass-and-
bakelite base**, the thing two contestants slap on a quiz stand. Brass
plate on the base engraved TAKE A TURN. Press: the dome sinks with a
squash, starburst impact lines flare. Loudest game-show read of the
five; the dome is a naturally huge tap target.

### 8b — The Arcade Dome
A **jumbo candy-translucent arcade cabinet button** (cherry red) in a
chrome bezel, with a printed label ring reading TAKE A TURN around the
rim. Idle: a faint internal LED pulse (the arcade "attract mode").
Press: mechanical clunk-depress plus a bright glow flash. Ties to the
site's arcade lineage (`art/arcade/`, skeeball, coinpusher); most
"machine" of the five.

### 8c — The Service Bell
A **chrome counter bell** with its plunger, wearing a manila string tag
that reads TAKE A TURN — the same specimen-tag language the drawer
already speaks, tied to hardware instead of art. Press: the plunger
taps, the bell shivers, radiating ring-lines say *ding* visually.
Gentlest and most hotel-lobby-whimsical; the tag makes its purpose
legible without breaking the fiction.

### 8d — The Contestant Paddle
A **handheld quiz-show lockout buzzer**: bright plastic grip, big round
button on top, a coiled cord that trails off under the surrounding
clutter (the cord is part of the SVG's charm — this thing is plugged
into *something*). Sticker on the grip: TAKE A TURN. Press: the button
cap lights up and the cord jiggles. Most "prop that fell in the drawer";
strongest story, least button-shaped silhouette.

### 8e — The Doorbell
The most junk-drawer-native: an **old brass doorbell plate with a round
pearl button**, cartooned proportions, and a yellowed hand-typed paper
label taped beneath: "TAKE A TURN — PRESS." Everyone has a doorbell in a
junk drawer. Press: the pearl sinks and the whole plate gives a tiny
buzz-rattle. Quietest of the five; wins on premise-fit, spends the least
game-show energy.

## 3. Mockup plan

One agent per candidate, in parallel, each producing a self-contained
`mockups/mockup-8<x>-<slug>.html` following the existing mockup
conventions (no external assets, mobile-friendly, notes on the page):

1. **Hero view** — the object large, with the press animation working
   on click/tap (and the idle tell where the design has one).
2. **In-context view** — the object at drawer scale on a floor that
   approximates the real stage (colors cribbed from `junk-drawer.css`),
   among two or three real item SVGs inlined from `items/` (ids
   namespaced) so scale and style-contrast can be judged honestly.
3. **Variant row** where it's cheap (e.g. alternate cap colors).
4. The candidate SVG kept clean enough to be the production asset.

Review happens off published mockup pages; the pick then drives the
implementation pass (pile injection, gesture wiring, retiring the
corner-chrome button, VERSION bump).

## 4. Out of scope / later

- The button's final *label* is still the name-tasting question — the
  mockups all say TAKE A TURN as placeholder, same as production.
- Sound (a real ding/buzz) is an implementation-pass question and an
  App-Store-native-feel opportunity (pairs with `JD_haptic`), not a
  mockup question.
- If the winner's style suggests re-skinning the *modal* to match, that
  is a separate proposal — this one re-seats the trigger only.
