# CLAUDE.md — How to add items to The Junk Drawer

This directory is a curated collection of LLM-generated SVGs with eval-style
annotations. This file is the complete procedure for adding or editing
entries. It is written for a Claude Code session with ZERO prior context
(including web sessions started from a phone). Follow it exactly.

## The one rule

**Committing files to this repo is the entire publishing act.** A push to
`main` auto-deploys to production (`.github/workflows/deploy.yml`). Do not
look for a database, an upload endpoint, or a build step — none exists for
this feature. Never write servable data as `.md` (deploy excludes it);
data files are `.json`, art is `.svg`.

## File map

- `taxonomy.json` — grade scale, annotation axes, model registry. The rubric
  IS this file; the frontend renders it as data.
- `items/<YYYY-MM-DD>-<slug>/entry.json` — one directory per PROMPT. All
  responses (from different models) to that prompt live in this one entry.
- `items/<...>/<model-slug>.svg` — one file per response.
- `data.php` — read-only serving endpoint. Do not modify during content adds.
- `scripts/validate-junk-drawer.py` (repo root `scripts/`) — the validator.
- `sizing-desk.html` — owner-only curatorial harness (unlinked, noindex):it
  steps through the items previewing size tiers with the live pile math and
  exports decisions as JSON (`{sizingDesk: 1, changes: {id: {sizeClass,
  sizeScale?}}}`). When the owner hands you such an export ("apply this
  sizing-desk export"), edit each listed entry.json to the given sizeClass,
  set/remove sizeScale accordingly (omit the key when absent or 1), validate,
  and commit: `junk-drawer: re-tier sizes (sizing desk, N items)`. The desk
  writes nothing itself.

## Procedure: add a NEW item

> To GENERATE the SVG (rather than file one the owner pastes), use the
> **`/junk-drawer-item` skill** (`.claude/skills/junk-drawer-item/`) — it
> owns the generation discipline: clean-context subagent generation, the
> standard technical appendix, honest one-shot/refined counting, and
> multi-model alternatives. The steps below remain the file-mechanics
> ground truth either way.

1. **Elicit from the owner** (ask only for what wasn't provided; never invent):
   - The prompt, VERBATIM. Do not trim, fix typos, or reformat it.
   - The SVG source (pasted), or a request for you to generate it.
   - Model + version for each response (must exist in `taxonomy.json`
     `models`; if new, append `{id, label, vendor}` there first — kebab-case id).
   - One-shot or refined? If refined, how many prompts total?
   - Generation date (default: today).
   - A grade (read the scale from `taxonomy.json` `grades` and show the
     owner the id + description list to pick from).
   - Annotations: read `taxonomy.json` `axes`; for each axis, ask for a
     value (offer the value ids + descriptions) OR "skip". Skipped axes are
     OMITTED from the annotations object — never write null/empty for them.
     Attach the owner's remarks as `{"value": ..., "note": ...}`.
   - A `sizeClass` — how big the item reads in the drawer. Read the tiers
     from `taxonomy.json` `sizeTiers` (`"xs"`/`"s"`/`"m"`/`"l"`/`"xl"`,
     each with a description). This is the owner's call: ask, and write
     `"m"` only if they EXPLICITLY defer ("default"/"whatever"). Silence
     is not a shrug — never file a size the owner didn't choose.
   - Whether to PIN a response for display (optional). The drawer shows one
     response per item, and by default that is the **best-graded** one —
     `data.php` resolves it at request time, ties breaking to the earliest
     `rid`, so a regrade re-points the drawer on its own. Write the entry's
     `primary` ONLY when the owner explicitly pins a response; it is an
     override flag, not a record of filing order. No pin ⇒ omit `primary`.
   - Optional `sizeScale` — a positive multiplier on the tier (default 1)
     for sizes between or below tiers; the continuous fine dial the coarse
     tiers can't reach (e.g. paperclip = `"s"` × 0.686). Tiers are AREA
     classes (owner decision, 2026-08-09): the drawer renders every item at
     footprint `w·h = (sizeTiers[sizeClass].box × sizeScale)²` whatever the
     artwork's proportions, with the long side capped at 1.8 × the box
     (before sizeScale) and a small id-hashed jitter (±9% linear) for
     natural variation. sizeScale therefore scales the whole footprint
     evenly at any aspect — NEVER use it to compensate for a tall or wide
     viewBox; the normalization already does that. Omit it (or 1) unless a
     tier alone doesn't land the size the owner wants. Sanity-check a new
     filing with `python3 scripts/validate-junk-drawer.py --sizes`, which
     prints every item's rendered footprint next to its tier-mates.
2. **Create the directory**: `items/<YYYY-MM-DD>-<slug>/` where slug is a
   short kebab-case name for the subject (e.g. `rubber-duck`), NOT the full
   prompt. Check it doesn't already exist.
3. **Write the SVG** as `<model-slug>.svg`, byte-exact as provided. Do not
   "clean it up" — imperfections are the point of this collection. Exception:
   if the validator rejects it (script/event-handler/foreignObject), report
   that to the owner rather than silently editing the art.
   **Tight viewBox check**: the drawer's drag-clamping and size math trust
   the viewBox rectangle, so dead transparent margin makes an item bump
   invisible walls. Run `scripts/check-svg-ink.sh <file>` (cross-platform —
   finds Chrome/Chromium via `$CHROME_BIN`, macOS, PATH, or Playwright) —
   the worst-side dead margin should be ≤ ~6%. If it's padded, TIGHTENING THE
   VIEWBOX IS PERMITTED normalization (it reframes; it never redraws a
   path) — apply the tool's suggested viewBox and record the change in the
   response's `notes` (e.g. `viewBox normalized: tightened from "..." to
   ink bounds`). Grade composition against the ORIGINAL framing if it was
   meaningfully off. Prevention beats repair: when a prompt is being
   written, ask the generating model for artwork that "fills the viewBox
   edge to edge, ≤2% margin, no surrounding empty space."
4. **Write `entry.json`** following the schema in `PLAN-BACKEND.md` §2.2
   (or copy `items/2026-07-26-skeleton-key/entry.json` as a template).
   Required: schema, id, title, prompt, created,
   responses[{rid, file, model, date, generation, grade}].
   2-space indent, UTF-8, LF. `rid`s are `r1`, `r2`, … and are permanent.
5. **Validate**: `python3 scripts/validate-junk-drawer.py` — fix every error
   it reports before committing. If python3 is unavailable, at minimum
   verify the JSON parses and the file references are correct, and say so
   in the commit message.
6. **Commit and push** to `main`:
   `junk-drawer: add "<title>" (<model>[, <model>...])`
   Include ONLY this item's files (plus taxonomy.json if you registered a
   model). Do not run publish.sh; the push triggers deployment.

## Procedure: add an ALTERNATIVE to an existing item

Find the item's directory, add the new `<model-slug>.svg`, APPEND one
response object (next `rid`) to the existing `responses` array. Never
reorder, renumber, or rewrite existing responses. Elicit grade/annotations
as above. Validate, then commit:
`junk-drawer: add <model> alternative to "<title>"`.

## Procedure: regrade / annotate an existing response

Push the old grade into `grade_history` as
`{"grade": <old>, "date": <old graded date>, "taxonomy_version": <n>, "note": <why>}`,
then set the new `grade` and `graded`. Adding annotations on new axes to old
entries is just adding keys. Commit: `junk-drawer: regrade "<title>" <rid> <old>→<new>`.

A regrade can change which response the drawer shows — that is intended, and
needs no edit: `primary` is absent on unpinned entries and the best grade
wins at request time. Mention it in the commit body when the displayed
response changes. Do not add a `primary` to "lock in" the old artwork unless
the owner asks to pin it.

## Procedure: extend the taxonomy

Append the new axis/value/grade/model to `taxonomy.json` with a real
human-readable description (the frontend displays it), add a `changelog`
line, bump `version`. NEVER rename or delete an id that any entry
references — the validator will fail if you do. To RETIRE an axis, set
`"defunct": true` on it instead (v6 precedent, 2026-07-29): defunct axes
stay for the responses already graded under them, render dimmed/tagged,
and are never surveyed again — annotate new responses ONLY on axes
without the flag. Commit: `junk-drawer: taxonomy — add axis "<label>"`.

## Never

- Never modify `data.php`, `index.php`, or `drawer.*` during a content add.
- Never rename ids (`items/` dirs, `rid`s, taxonomy ids) once committed.
- Never create or commit a manifest/index of items — `data.php` assembles
  it at request time.
- Never store transcripts or notes as `.md` inside `items/` — use `.json`.
