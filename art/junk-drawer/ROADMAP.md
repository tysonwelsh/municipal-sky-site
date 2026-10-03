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

- **Settle the scales — A HARD GATE before the first bench sitting (owner,
  2026-10-02, re-raised).** The owner is reconsidering: possibly NOT a
  4-point scale for understanding-assignment, and possibly 4-point scales
  for layering and structural coherence (jnsq undecided). Why it is a gate:
  no v2 rating session exists in production yet, so a scale change today
  is a free taxonomy edit (new value ranks, no new axis id); after the
  first filed sitting, the v17 precedent applies — a changed scale is a
  NEW axis id with the old one marked defunct, and every earlier sitting
  stays on the old axis. Decide, edit `taxonomy.json` (ranks are data; the
  gauges `JD_axisCls`, `rc-r*`/`rc-q*` already handle 3- and 4-point),
  bump the version, THEN rate. Claude's earlier view, for the record: keep
  understanding-assignment at 4 points (it is the axis most reworded and
  the mostly/somewhat distinction has carried weight) and bring the issue
  axes up to 4 to match, rather than go to 3 anywhere.
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
- **Newest models** in the pool — **DONE 2026-10-02** (`pool-2026-10-02`;
  the "Model pool refresh" item below).

**Instrument / UI (Phase 4b and after):**

- **About page: the "spread-lead" highlight hard-codes the OLD pool's model
  ids** (`about.css` ~L1254–1256 and ~L1929–1931: `gpt-5-1`,
  `claude-opus-5`…). On new-pool data it dims Opus 5.5 and never fades GPT-6
  Astra. Make it read the pool from the taxonomy (or drop the per-model
  colour rules). Also the three v1 specimen steps name "Claude Fable 5",
  "Gemini 3.1 Pro" and "Kimi K3" by design (they describe the v1 specimen).

- **Bounding boxes on the drawing for a rated issue (owner, 2026-10-02 —
  consider before launch).** When filing a structural-coherence or layering
  problem, let the rater draw a box (or circle) on the drawing marking
  where the issue is, stored with the judgment (e.g. `jd2_judgments.marks`
  as JSON: `[{axis, x, y, w, h}]` in the SVG's viewBox units), shown on the
  report card as an annotation layer. Makes the ratings legible to a
  reader and gives the analysis a locus per defect. Fits the draw-on
  engine's existing walk of the SVG; a drawn box is a transform-free
  overlay. Not now.

- **One question at a time.** A rating card that asks understanding, then
  structural coherence, then layering, then jnsq, then the overall grade,
  per drawing (or per question across drawings) — instead of the full panel
  of selects. Same card for visitors and the bench.
- **Scope notes as app copy (the owner's pin, PLAN-INTAKE-PROMPT §5) —
  partly closed 0.13.0.** The taxonomy's `scope` notes now serve as app copy
  on the bench's catalogue entry card: each heading chip's tooltip, its
  long-press text on a phone, and the line under its facet. Still open: the
  same words introducing each heading on the about page, and on the tags
  wherever the report card shows them to visitors.
- **The unveil pedestals carry a compact summary**: model, cost, and every
  rating for that drawing in a small well-designed table; the overall
  spark line leaves the plate and moves into the pedestal. **Unblocked**
  (2026-10-02): the pedestal card ("by how much", 0.12.0) is live and is
  the instrument, and the unveil was left as it was on purpose, so the
  summary can be designed now — on the pedestals as the card leaves them
  (rank order, the margins as courses and the brass shim), and saying
  "negligibly", never "about the same", for a gap of 0.
- **Darkroom copy**: rewrite the text under the loading cards, including
  the "taking longer than usual" line.
- **Instructions**: rewrite, and fix the blurry text when the sheet
  expands (likely a transform/scale on a rasterised layer — check
  `will-change`/`transform` on the sheet and its filter).
- **Typography**: a non-monospace face for the axis descriptions.

**Before the drawer opens to the public:**

- **Visitors wait less for a slow model (owner, 2026-10-02).** Today every
  slot on a visitor turn gets `JD_PROVIDER_TIMEOUT` = 150 s; a model that
  misses it is marked failed, the card says it did not come back, and the
  visitor rates the survivors. Kimi K3 has missed or crawled past that
  repeatedly (284 s at max, ~90 s at medium, two bare 503s in the medium
  trial). The owner's standard: the BENCHMARK waits and retries until all
  four are in (the batch runner's resume and the stranded-slot rule do
  this); a VISITOR should not sit several minutes for one machine. Design:
  (1) a shorter web-profile wire timeout (~75–90 s); (2) a "go on without
  it" affordance in the darkroom once two or more drawings are in and the
  laggard has passed ~45 s, which marks the slot `abandoned` for THIS
  sitting; (3) a late drawing that lands afterwards is still stored (it is
  data) but the sitting's completeness is judged against the drawings it
  was dealt (`jd2_sessions.seat_order`), not every ok drawing of the run,
  so the item still goes live; the owner can rate the late one on the
  bench. Needs: a word in the generation status list, a completeness
  tweak in `jd2_is_complete`, darkroom copy ("Kimi K3 did not come back
  in time"), and the ledger showing the laggard.

- **Sanitizer and DOM must agree on namespace prefixes (2026-10-02).** A
  drawing that uses `xlink:href` without declaring `xmlns:xlink` passes the
  sanitizer but fails the browser's XML parse, so since the DOMParser
  change it is left out of the pile. None of the 570 filed SVGs do this.
  Make the sanitizer reject an undeclared prefix (reason string to add to
  the frozen list deliberately), so the verdict and the DOM agree.

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
  the background under an owner effort profile (`--profile`, default
  `bench-medium`) — one model per request,
  four requests per prompt, never two drawings in one call — so the owner
  never waits between prompts, then rates the backlog on the bench with the
  side-by-side pairs card. Matching prompt text records `v1_item_id`
  lineage automatically.
- **The thinking level — DECIDED: medium (owner, 2026-10-02).** Visitor
  turns run the `web` profile (thinking turned down so the darkroom wait
  stays short). Owner runs now default to `bench-medium` — "not all the
  way to the bottom, but we don't need high either — goldilocks". The
  finding that forced it: the first live batch (rows 101–110, old pool) ran
  at the pre-split `bench` profile, every model at its top setting inside
  ONE 12000-token budget shared by thinking and output, and two of four
  could not finish — Opus 5 at effort max stopped at `max_tokens` with all
  12000 tokens spent thinking and no text; Gemini 3.1 Pro at thinkingLevel
  high was cut off ~1.3 KB into its SVG (`no_svg_found`). Built: three
  owner profiles, `bench-low` / `bench-medium` / `bench-max` (harness
  `v4-benchlow.1` / `v4-benchmed.1` / `v4-bench.4`), each with a 64000
  budget (under Gemini 3.1 Pro's 65,536 cap); the wire word `bench` means
  the default; the batch runner's `--profile`, with a second profile's run
  of the same prompt filed as a RERUN of it. `scripts/jd2-profile-probe.php`
  (one "a plain red circle" per model × profile, no database) ran live
  2026-10-02: all 12 cells answered 200 and returned a sanitizer-clean SVG
  (stop end_turn / STOP / stop everywhere; $0.053 for the 12; Opus thinking
  0 / 0–9 / 65–109 tokens low/medium/max, Gemini 376 / 443 / 818, GPT-5.1
  40 / 55 / 146, Kimi 9 / 13 / 96). Kimi K3 has no `medium`
  (low|high|max), so `bench-medium` sends its middle rung, `high`.
  OPTIONAL, the owner's call: a low/medium/max comparison on a handful of
  real prompts (`--profile bench-low` and `--profile bench-max` on the same
  CSV) before or during the campaign; the decision does not wait on it.
- **Model pool refresh — DONE 2026-10-02** (branch
  `junk-drawer-pool-2026-10`). `poolVersion` `pool-2026-10-02`, taxonomy
  v33: Claude Opus 5.5 (`claude-opus-5-5`) and GPT-6 Astra (`gpt-6-astra`)
  replace Opus 5 and GPT-5.1; Kimi K3 and Gemini 3.1 Pro stay (still each
  vendor's newest). Wire ids and prices checked on the vendors' own pages
  (`jd-prices.json` `_notes`). Same four vendors, so no consent bump.
  Harness ids moved where parameters did: `web` → `v4-web.4` (Opus 5.5
  refuses disabled thinking, so Anthropic sends effort `low`; OpenAI now
  sends `reasoning_effort` `low`), `bench-max` → `v4-bench.5` (Astra
  refuses `max` on Chat Completions; `xhigh` is its top accepted rung).
  `scripts/jd2-profile-probe.php --web` ran live: all 16 cells (4 models ×
  bench-low/medium/max + web) 200 with a clean SVG, $0.088. The batch
  should be run under the new pool; the 39/40 medium trial stays under
  `pool-2026-08-14` and is not pooled with it.

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

- **The catalogue entry** (0.13.0, 2026-10-02) — the bench's closing step
  shows the intake clerk's heading, size and headings, every one correctable
  (title field, five-tier chooser, chips per facet with scope-note tooltips),
  filed through `jd2-curate` before the sitting; replaces the size card on
  the bench.
- **The size card** (0.9.96, 2026-08-30) — the bench's closing step.
- **Bench mode** (0.9.73 →) — the backlog runs inside the real turn card.
- **`jd-inventory.php`** (2026-08-30) — the census of everything on file.
