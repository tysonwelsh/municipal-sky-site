---
name: junk-drawer-item
description: Generate a new SVG item for The Junk Drawer (art/junk-drawer/) from a prompt — clean-context one-shot generation via subagent(s), optional multi-model alternatives, ink-bounds check, eval annotation, entry authoring, validate, commit = publish. Use when the owner wants to add or generate a new drawer item, or collect an alternative model response for an existing prompt.
---

# junk-drawer-item — generate and file a drawer item

You are adding a piece to an eval-style collection: the SVG is a **specimen
of model output**, graded and annotated. Provenance integrity beats polish
at every decision point. Read `art/junk-drawer/CLAUDE.md` first — it owns
the file mechanics (directory naming, entry.json schema, taxonomy rules,
commit conventions). This skill adds the GENERATION discipline on top.

## 1. Elicit (ask only for what wasn't provided)

- **The creative prompt**, verbatim — or a subject ("a wine cork", "a AAA
  battery") from which you draft a prompt and confirm it with the owner
  BEFORE generating. The confirmed text is frozen: it goes in entry.json
  exactly as sent.
- **Which model(s)**: default is one response from this session's model
  family via subagent. The owner may request several tiers in one run
  (each becomes a response to the same prompt — the alternatives system).
  Model-id mapping for the registry (verify against the current
  environment if models have moved on):
  `fable → claude-fable-5 · opus → claude-opus-5 · sonnet → claude-sonnet-5 · haiku → claude-haiku-4-5`
  Non-Claude models: the owner runs the prompt elsewhere and pastes the
  SVG; file it byte-exact as that model's response.
- **New item or alternative?** An alternative appends a response (next
  `rid`) to an existing entry; the prompt MUST be that entry's prompt,
  re-sent verbatim.
- **sizeClass** (`s`/`m`/`l`, default `m`) and any tags.

## 2. Generate — clean context, honest counts

Spawn a FRESH subagent (general-purpose; `model:` per the owner's choice)
whose entire prompt is:

1. The creative prompt, verbatim.
2. The **standard technical appendix** (fixed harness, same for every
   generation):
   > Output a single complete SVG document and nothing else — no prose, no
   > code fences. Requirements: `xmlns` and a `viewBox` on the root; the
   > artwork must fill the viewBox edge to edge (at most ~2% margin — no
   > empty space around the subject); transparent background (no opaque
   > backdrop rectangle); fully self-contained (no external references,
   > no `<script>`, no event attributes, no `<foreignObject>`).

Give the subagent NOTHING else — no drawer context, no examples, no
taxonomy. Its reply is the artifact.

- **One-shot** = exactly one subagent call. Whatever comes back IS the
  response — never silently fix, prettify, or regenerate. Strip only
  surrounding prose/fences if the model disobeyed the output format (note
  that disobedience — it is gradeable).
- **Refined** = further messages to the SAME subagent, each written or
  approved by the owner, verbatim. `prompt_count` = total prompts sent
  (creative prompt + follow-ups). Keep the final SVG only (transcripts
  can be added later per PLAN-BACKEND §6).
- Record in the response's `notes`: "generated via clean-context subagent;
  standard technical appendix v1 appended to the prompt." The entry's
  `prompt` field holds the creative prompt only — the appendix is harness,
  documented here, constant across the collection.

## 3. Verify the artifact

1. Write the SVG byte-exact to the item directory per CLAUDE.md naming.
2. `python3 scripts/validate-junk-drawer.py` — hygiene rejections
   (script/handlers/foreignObject) go back to the owner: regenerate
   (counts as a new one-shot or a refinement turn — owner's call) or
   record as a failed sample.
3. **Ink-bounds check**: `scripts/check-svg-ink.sh <file>` (Mac + Chrome
   only). Worst-side dead margin ≤ ~6% passes. If PADDED: tighten the
   viewBox to the tool's suggestion — permitted normalization (reframes,
   never redraws) — and disclose it in the response's `notes`. Consider
   grading composition against the ORIGINAL framing first. In sandboxed
   or phone sessions the tool can't run: say so, file the item anyway,
   and flag it for an ink check at the owner's next desktop session.

## 4. Annotate

Walk the owner through the rubric from `taxonomy.json` (never hardcode):
overall grade (show the scale with descriptions), then each axis (offer
value ids + descriptions, or "skip" — skipped axes are OMITTED). Owner
remarks become `{"value": ..., "note": ...}`. If the owner defers, a
provisional self-assessment is allowed but must be labeled as such in
`notes` ("provisional self-assessment — owner to regrade").

## 5. File, validate, publish

Per CLAUDE.md: entry.json (or appended response), model registered in
`taxonomy.json` if new, validator green, then commit and push to `main`
with the conventional message — the push IS publication. A new item with
no `placement` lands centered in the drawer; the owner can arrange it
live via `?arrange=1` and paste the copied placement block into the
entry afterward.

## Never

- Never give the generating subagent context beyond prompt + appendix.
- Never edit artwork bytes (viewBox tightening is the sole permitted
  normalization, always disclosed).
- Never invent grades, models, dates, or prompt counts.
- Never reuse an item id or renumber rids.
