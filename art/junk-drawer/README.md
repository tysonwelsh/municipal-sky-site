# The Junk Drawer

A "junk drawer" filled with a wide assortment of LLM-generated SVGs — a
portfolio piece that showcases prompt craft, benchmark/eval experience
(annotation taxonomies applied to real LLM output), and design skill, all
in one object.

## The vision

**The drawer.** A skeuomorphic, trompe-l'oeil presentation: the viewer
looks *down into* an open drawer with a wooden bottom and sides. The
effect should evoke 19th-century quodlibet / "drawer paintings" — still
lifes depicting everyday clutter crammed onto a shallow tray, board, or
drawer. The drawer itself does not need to be an SVG; use whatever
textures and techniques give the best result. Target: an oil painting of
a 3D wooden drawer, in the style of those letter-rack/quodlibet painters.

Named visual references for the drawer and ALL surrounding UI (frame,
lighting, specimen cards, tags, page furniture) — see PLAN-FRONTEND.md §0:
**John Haberle** (*A Bachelor's Drawer*, the premise itself), **John F.
Peto** (composed mess; aged paper for the cards), **William Michael
Harnett** (raking light, object-shaped cast shadows), plus others of that
trompe-l'oeil era for details. Scope boundary: these govern the
*container only* — each SVG inside keeps its own style as specified by
its generating prompt, never harmonized toward the painterly look.

**The clutter.** Inside is a jumble of LLM-generated SVGs, (dis)arranged
in a messy pile so the viewer has to dig around to sort through them.
Crucially, the SVGs are NOT in a unified style — a varied assortment of
items in many styles, the combined effect being a kind of *surrealist*
trompe-l'oeil quodlibet. New SVGs get added over time.

**The annotations.** Click/hover an SVG to select it or show a tooltip
with its eval metadata:

- the prompt that produced it
- the model that generated it
- one-shot vs. refined (and how many prompts the refinement took)
- a quality "grade" (utility grade is the lowest) — graded on multiple
  issue axes, the way LLM output is annotated in real evals
- the taxonomy will grow as more SVGs are generated
- an SVG can have multiple **alternatives**: responses from other LLMs
  to the same prompt

## Workflow requirement

New SVGs + annotations must be addable from a phone via Claude Code on
the web + GitHub — i.e., committing a new SVG and its metadata to this
repo from the subway should be the entire publishing act.

## Mobile requirement

Mobile is a first-class experience, not an adaptation — this is a
portfolio piece that must demo well on a phone. On mobile the drawer
occupies as much of the viewport as possible on load ("peering down into
a drawer"); the explanatory text lives below it, reached by scrolling
off the drawer. Some features may be desktop-only, but the core loop
(see the pile, dig, open an item's eval card, flip alternatives) must be
great on a phone. See PLAN-MOBILE.md.

## Status

**Live drawer + visitor turns (2026-08-09, v0.5.0)**: the pile, drag /
dig / pick gestures, specimen tags, and report cards shipped through
v0.4.x (PLAN-FRONTEND / PLAN-MOBILE / PLAN-RECORD). The "TAKE A TURN"
visitor-prompt feature is implemented per PLAN-USER-PROMPTS.md and the
frozen contracts in PLAN-USER-PROMPTS-CONTRACTS.md: two blind
server-side generations (Claude Sonnet 5 vs GPT-5), taxonomy-driven
rating + pairwise comparison, session-local winner in the pile, MySQL
eval tables (`api/setup-jd-tables.php`), runtime SVG sanitizer with a
fixture harness (`scripts/test-jd-sanitizer.php`), and an owner-run
JSONL exporter (`scripts/export-jd-evals.py`). Launch steps that only
the owner can do are in PLAN-USER-PROMPTS.md §7.

**Backend scaffolding built (2026-07-26)**: `taxonomy.json`,
`scripts/validate-junk-drawer.py` (repo root), `data.php`, `CLAUDE.md`
(the add-an-item procedure), and a first item
(`items/2026-07-26-skeleton-key/`, provisionally self-graded by its
generating model — owner to regrade). The CI validation workflow
(`.github/workflows/validate-junk-drawer.yml`) is NOT yet added — it
must be committed from the owner's machine (needs `workflow` scope).

(Frontend was not started at that point; see PLAN-FRONTEND.md,
PLAN-BACKEND.md, and PLAN-MOBILE.md for how it was subsequently built.)

**Plan reconciliation (binding):** where PLAN-FRONTEND.md §5 sketches a
static `data/items.json` manifest with an item/`alternatives` shape,
PLAN-BACKEND.md supersedes it: there is **no committed manifest** (it
would turn concurrent phone commits into merge conflicts); the frontend
consumes `data.php`, whose response shape is defined in PLAN-BACKEND.md
§7 (prompt-as-entity, `responses[]` array, `primary` rid). The frontend
plan's *requirements* (one fetch, stable URL, taxonomy block, placement
home, viewBox'd self-contained SVGs) are all satisfied by that contract.
