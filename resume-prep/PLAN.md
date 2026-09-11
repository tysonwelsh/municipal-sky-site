# Build plan — Surge AI section (Phase 3)

The point of doing this in passes instead of one shot: the two input files
overlap, one is unstructured, and a single pass reliably drops the small
claims (a one-off process fix, a metric mentioned in passing). So the first
pass is pure extraction with no writing, and every later pass points back
to it by ID.

## Pass A — Inventory (no prose)
Read `inputs/Raw Material for Master Resume.txt` and `inputs/bullets.md`
in full. Produce `master-resume/00-inventory.md`: a numbered list where each
item is ONE distinct claim — a responsibility, a project, a tool built, a
process changed, a metric, a scale figure, a stakeholder relationship, a
hat worn. Keep the owner's own wording next to each item. Tag each with its
source location. Flag duplicates across the two files (same claim, more
technical detail in bullets.md) by linking IDs rather than merging.

Chunking: read the raw file in ~150-line chunks; each chunk gets its own
inventory block before moving on. Then bullets.md. Then one reconciliation
pass over the whole inventory looking for anything in the source not yet
captured.

Deliverable check: the owner can skim the inventory and say "yes, that's
everything I do" — or spot what's missing.

## Pass B — Cluster
Group inventory IDs into themes (the `theme:` values in the README schema;
add themes if the material demands). Each theme gets a one-line "story"
(what problem, what you did, what changed). Items that fit two themes are
listed under both. Output: a theme → IDs map at the top of `01-surge-ai.md`.

## Pass C — Write bullets, one theme at a time
For each theme, write 3–8 bullets in the generic register, then targeted
variants for the 2–3 listings in `target-jobs/` where that theme is
weighted, then technical variants where tooling is involved. Rules:
- One line, ≤ 2 printed lines on a resume (~30 words max).
- Verb first, past tense, specific object, measurable result where the
  source supports it. If a number isn't in the source, mark `numbers: VERIFY`
  and write the bullet with a placeholder like `[N]` — never invent.
- Mirror ATS keywords from `target-jobs/synthesis.md` where they are true.
- Apply `FRAMING.md` to every tooling claim.
- Do the themes in separate turns so each gets full attention.

## Pass D — Coverage check
Build `04-coverage.md`: rows = top keywords/requirements from
`target-jobs/synthesis.md` and each listing's required quals; columns =
listings; cells = the bullet IDs that cover them. Empty cells are either
honest gaps (note them for cover letters) or missed material (go back to
the inventory).

## Pass E — Owner edit
The owner rewrites phrasing in place. Struck bullets stay in the file,
struck through, so the ID history holds.

## Phase 2 (parallel) — prior roles
A separate agent reads every file under `inputs/resumes/` — each version of
each resume and every cover letter — and produces `02-prior-roles.md`: per
employer, the union of every bullet ever used, deduplicated, with the best
phrasing kept and variants noted; plus a "narrative" section pulling the
career-story lines from the cover letters. Same schema, `P-` IDs.
