# ROADMAP.md — The Junk Drawer, the app's own to-do

Feature ideas and deferred work for the drawer and its bench. (The social
campaign has its own file, MARKETING-ROADMAP.md; per-project build plans live
in the gitignored PLAN-*.md docs.) Newest first within each section.

## Wanted

### A basic vector editor on the report card (owner, 2026-09-11)

**The idea:** let a visitor take a drawing apart on the report card — pick
a part, drag it somewhere else, rotate it, maybe scale it or hide it —
not to make art, but to make the point the drawer exists to make: these
are SVGs, vector drawings made of named parts, which is what sets them
apart from the pixel images most people think "AI images" are. Not a
tool; a demonstration. Nothing needs saving.

**Feasibility: high.** An SVG in the page is already a DOM tree, and every
part the model drew (`<path>`, `<g>`, `<circle>` …) is already an element
with its own `transform`. "Move this part" is one attribute write. The
draw-on engine (`JD_drawOn`) already walks these same elements to animate
them, and the pile's drag script already does pointer capture, slop and
settle for whole items. So the pieces exist; the work is the interaction
layer, not the vector engine.

**A plausible first cut (2–3 days):**
- EDIT toggles the plate (or the enlargement, which has the room) into
  edit mode: the artwork's top-level children (and a few levels below,
  where the model grouped sensibly) become hit targets; hover outlines
  the part under the pointer with its element name.
- Drag moves a part (a `translate` prepended to its transform); a handle
  or a two-finger twist rotates it about its own bounding-box centre;
  a scroll or pinch scales. All of it is transform maths on one element,
  in the SVG's own user units — no re-rendering, no libraries.
- RESET puts the original back (keep the untouched markup and re-inline
  it). DOWNLOAD SVG could hand back the edited copy — the one genuinely
  fun outcome, and it is free: the DOM IS the file.
- Touch: the plate already handles pointer events and swipes; edit mode
  would claim them while it is on, and give them back.

**What makes it harder than it sounds:**
- *Granularity.* Models draw a dandelion as one `<path>` or as two
  hundred; some wrap everything in one `<g>`. Which level is "a part" has
  to be decided per drawing — a heuristic (descend through single-child
  groups, stop at the first level with several siblings of real size) gets
  most of them, but some drawings will be one immovable lump and some
  will be confetti. That is honest — it shows how the model built it —
  but it should be explained on screen.
- *Transforms on parents.* A part inside a rotated or scaled group moves in
  its parent's coordinate space; the drag maths has to invert the
  ancestor transforms (`getScreenCTM` does this) or the part slides
  diagonally when the pointer moves straight. Known problem, solved
  problem, but it is where the bugs will live.
- *`<use>`, clip paths, masks, gradients with `userSpaceOnUse`* keep their
  own geometry and do not follow a moved part — a moved element can lose
  its shading or its clip. The sanitizer already limits what gets in;
  the editor should skip such parts or move them with their referents.
- *Filters and heavy drawings:* live-dragging a part with a blur or a
  turbulence filter on it can stutter; the pile already learned this
  (drop-shadow trails). Suspend filters while dragging.
- *Undo.* One level (RESET) is enough for a demonstration; a real history
  stack is where scope creep begins.

**Cost:** zero libraries, zero server. Roughly 400–600 lines in a new
`jd-edit.js` beside the record card, plus CSS for the outlines and
handles. The hard part is deciding where to stop.

### Let a model propose the size tier (owner, 2026-08-30)

The bench now closes every curation with the HOW BIG IS IT card — the
taxonomy's five tiers, chosen by eye against swatches drawn to their real
footprints. That is the owner's judgment and stays available, but at the
scale of the reassessment backlog (84 prompts and counting) it is also 84
more decisions.

**The idea:** a small fast model looks at the drawing and the prompt and
proposes a tier, the way `jd-title.php` proposes a title — the card opens
with that tier already selected and its reasoning available, and the owner
confirms or overrides in one press. The judgment stays the owner's; the model
supplies the first guess.

What makes it tractable: the tiers are about how big the object reads *in a
drawer of other objects* — a paperclip is small, an urn is large — which is
knowledge about the subject, not about the SVG. A titler-shaped endpoint
(prompt in, one token out, validated against the taxonomy's tier ids) would
do it. Worth checking the agreement rate against the tiers already on file
before trusting it: the corpus has ~40 owner-chosen sizes to test against,
which is a real eval set.

Related: `sizing-desk.html` already exists for tuning sizes in bulk against
the live pile math, and `sizeScale` is the continuous dial under the tiers.

### Promotion of turns into the drawer

`scripts/promote-turn.py` — the counterpart to `harvest-rerun.py` for prompts
that were never curated items: write the surviving SVGs, ink-check, author the
entry from the owner's bench ratings, title via `jd-title.php`, size from the
bench's size flag. Blocked on nothing; wanted for the reassessment backlog.

## Done

### Admin mode, a gated bench, and the DB read path (2026-09-05)

`?admin` on the drawer, behind the bench key (`JD_BENCH_REQUIRE_KEY = true`,
wrong keys throttled): the report card carries ADJUST RATINGS, which
re-seats the item in the turn card's curate mode, prefilled and with the
machines named, and files through `jd-item-rate.php`. `data.php` now lays
the bench's grades, axes, ranks and size over a curated entry at request
time and shows the bench's 1st place, so an adjustment is on view without a
harvest (the standing "read path for DB ratings" item, closed). Scripts
take `JD_BENCH_KEY`. See CLAUDE.md.

- **The size card** (0.9.96, 2026-08-30) — the bench's closing step.
- **Bench mode** (0.9.73 →) — the backlog runs inside the real turn card.
- **`jd-inventory.php`** (2026-08-30) — the census of everything on file.
