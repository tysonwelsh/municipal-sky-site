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
