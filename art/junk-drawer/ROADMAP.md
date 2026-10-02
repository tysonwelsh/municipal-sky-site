# ROADMAP.md — The Junk Drawer, the app's own to-do

Feature ideas and deferred work for the drawer and its bench. (The social
campaign has its own file, MARKETING-ROADMAP.md; per-project build plans live
in the gitignored PLAN-*.md docs.) Newest first within each section.

## Wanted

### Owner's v2 notes, triaged (2026-10-01, evening)

**Being built now (Phase 3c/4a):** head-to-head comparative scores on the
7-point scale, both as six side-by-side questions and (from the owner's
pedestal session) derived from the podium's gaps — one `jd2_pairs` table.

**Before the rating campaign starts** (each is a data edit or a small
back-end change; the owner decides the wording):

- **Settle the scales.** Consider a 4-point scale for the three issue axes
  (structural coherence, layering, jnsq) and a 3-point scale for
  understanding-assignment. Ranks are data in `taxonomy.json`; the gauges
  (`JD_axisCls`, `rc-r*`/`rc-q*`) already handle 3- and 4-point.
- **Settle the names.** "Subjects / categories / axes", and "ratings vs
  grades" — the owner leans to calling the per-axis answers *ratings* so
  *overall grade* keeps its name, or renaming it (overall quality /
  usefulness). Labels only; ids stay.
- **Solid definitions for every axis**, written as the owner works the new
  prompt set; must be solid before sharing. Including the
  benefit-of-the-doubt rule for understanding-assignment: an ambiguous
  prompt read in a reasonable way is NOT penalised, even if it is not the
  reading the owner had in mind. Suggested sentence for the description:
  "If the prompt is ambiguous, any reasonable reading counts as
  understanding it; do not penalise a drawing for choosing a different
  reasonable reading than you had in mind."
- **Rationale notes.** A free-text comment per sitting (and per cell where
  wanted), kept on hand for taxonomy tweaks, not necessarily shown on the
  card. Schema: add `jd2_sessions.note` (additive; judgments already carry
  a per-cell `note`).
- **The prompt set: ~100 prompts, categorised.** Schema: add
  `jd2_prompts.category` (additive); the CSV batch runner takes a
  `category` column.
- **Model-assigned size — DONE 2026-10-02 as the intake step** (`api/jd2-intake.php`: heading, size tier and faceted tags from Sonnet 5.5 the moment a prompt is filed; the agreement check is `scripts/jd2-intake-check.php`). Original note: At the moment the titler drafts the title it
  also proposes the size tier, given the tier descriptions and a few
  examples per tier (a titler-shaped call: prompt in, one tier out,
  validated against `sizeTiers`). The size card then disappears for
  visitors; the owner can still override on the ledger. Check the
  agreement rate against the ~64 owner-chosen sizes in the v1 archive
  first.
- **Newest models** in the pool (newest Opus, newest OpenAI, etc.) —
  already decided: refresh before regenerating; pool is data + `poolVersion`.

**Instrument / UI (Phase 4b and after):**

- **One question at a time.** A rating card that asks understanding, then
  structural coherence, then layering, then jnsq, then the overall grade,
  per drawing (or per question across drawings) — instead of the full panel
  of selects. Same card for visitors and the bench.
- **The unveil pedestals carry a compact summary**: model, cost, and every
  rating for that drawing in a small well-designed table; the overall
  spark line leaves the plate and moves into the pedestal. **BLOCKED on the
  pedestal redesign** (owner, 2026-10-01): the owner is reworking the
  pedestal card in another session so the degree of "betterness" between
  places yields the Likert scores; how the pedestals look at the end of the
  survey depends on that outcome, so nothing touches the podium or the
  unveil pedestals here until it lands.
- **Darkroom copy**: rewrite the text under the loading cards, including
  the "taking longer than usual" line.
- **Instructions**: rewrite, and fix the blurry text when the sheet
  expands (likely a transform/scale on a rasterised layer — check
  `will-change`/`transform` on the sheet and its filter).
- **Typography**: a non-monospace face for the axis descriptions.

**Before the drawer opens to the public:**

- **Consent**: a checkbox that includes confirming the visitor is over 18,
  and a fuller disclaimer than "sent to Anthropic etc." New consent
  version; privacy.php §4 must match.
- **Visitor chooses how many drawings and from which models.** Default
  two, with controls on the prompt screen to ask for more (up to the
  pool) and to pick the models. Back end: the v2 `deal` already allows any
  size; `jd2-generate` gains a visitor `models: [ids]` field (min 2),
  the breaker counts drawings not turns, the pairs step scales with the
  count (1 pair for two drawings). Owner runs stay at the full pool.
- **Moderation / approval queue** (see the follow-ons above).

### Dataset v2 follow-ons (owner, 2026-10-01)

Decided alongside the v2 cutover (PLAN-V2.md, gitignored); none of these is
part of the cutover build itself.

- **Moderation before the public drawer.** A visitor's rated turn should
  appear at once only on their own device (the YOURS tag, as today) and join
  the public drawer only when the owner approves it from a dashboard; the
  morning email digest (`onobot-digest`) lists the new submissions. The v2
  schema reserves `jd2_prompts.approved_at` / `approved_by` for this. Until
  it exists, fully rated turns join the drawer as they do now (the owner is
  effectively the only visitor).
- **The CSV batch runner.** The owner curates the prompt set into a CSV;
  an owner-only runner reads it and generates every prompt's responses in
  the background under the `bench` effort profile — one model per request,
  four requests per prompt, never two drawings in one call — so the owner
  never waits between prompts, then rates the backlog on the bench with the
  side-by-side pairs card. Matching prompt text records `v1_item_id`
  lineage automatically.
- **Reassess the visitor thinking level.** Visitor turns run the `web`
  profile (thinking turned down so the darkroom wait stays short); the
  bench runs at each vendor's top setting. Once the pool is settled, decide
  what visitors get and what it costs in wait time and spend.
- **Model pool refresh** before the rating campaign: verify wire ids and
  prices against the providers' lists, add `jd-prices.json` rows, bump
  `poolVersion` in `taxonomy.json`, bump the consent version if the
  provider list changes (privacy.php §4 must match).

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

### Retired with dataset v1 (2026-10-01)

Two v1 items closed by the v2 cutover rather than built; their v1 text is in
git history before this commit.

- **Promotion of turns into the drawer** (`scripts/promote-turn.py`, the
  counterpart to `harvest-rerun.py`). In v2 a visitor's turn joins the drawer
  when its session is complete; there is no file to promote into, and both
  scripts were removed with the file path.
- **Placings on the curated originals** (2026-09-17: 0 of 216 curated
  drawings ranked, rank them on the bench or carry ranks through harvest). v2
  has no curated items: every drawing belongs to a run, and every complete
  session ranks the run's drawings, so every drawing in the drawer has a
  place.


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
