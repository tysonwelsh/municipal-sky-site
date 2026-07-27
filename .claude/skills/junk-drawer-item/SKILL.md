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

## 1. Stand by for the prompt

On invocation, read CLAUDE.md, then STOP: reply that you're standing by
for the creative prompt, and END YOUR TURN. Do not ask the operational
questions yet, do not pull a prompt out of earlier conversation, and do
not proceed on any default. Exception: if the invocation itself carried
the prompt as arguments, treat it as entered and go straight to §2.

- **Whatever the owner sends IS the creative prompt**, FROZEN AS GIVEN,
  verbatim — typos and all. A single word ("hairball") is a complete,
  valid prompt. Never treat terse input as a mere "subject" to expand
  into a drafted prompt — there is no drafting step in this skill. Do
  not ask about style, palette, detail level, composition, realism, or
  anything else that would sharpen it. An under-specified prompt is a
  valid benchmark input: how the model resolves the ambiguity is part
  of what gets graded. Send it as-is.

## 2. The operational questions — ask, don't assume

After the prompt arrives, follow up with the operational questions in
ONE batch (AskUserQuestion works well) and WAIT for the answers before
generating. These are the only questions this skill ever asks besides
the annotation walk-through in §6 — never prompt-improvement questions.

- **Which model(s)**: offer one response from this session's model
  family via subagent as the suggested default. The owner may request
  several tiers in one run (each becomes a response to the same prompt —
  the alternatives system). Model-id mapping for the registry (verify
  against the current environment if models have moved on):
  `fable → claude-fable-5 · opus → claude-opus-5 · sonnet → claude-sonnet-5 · haiku → claude-haiku-4-5`
  Non-Claude models: the owner runs the prompt elsewhere and pastes the
  SVG; file it byte-exact as that model's response.
- **New item or alternative?** An alternative appends a response (next
  `rid`) to an existing entry; the prompt MUST be that entry's prompt,
  re-sent verbatim. (Skip this question when the answer is unambiguous —
  e.g. the prompt matches an existing entry, or plainly matches nothing.)
- **Any tags** (optional). Note: **sizeClass is NOT asked here** — it moved
  into the §6 annotation survey, because an item is sized best once you can
  see it in context. Don't ask for size upfront.

A default is a suggestion to show in the question, never a substitute
for the answer. If any of these went unanswered, ask again before
filing — do not commit an entry containing values the owner never chose.

## 3. Generate — clean context, honest counts

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

## 4. Verify the artifact

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

## 5. Show the owner the artwork — BEFORE asking for grades

The owner must be able to SEE the SVG before the annotation
walk-through. Pick the channel that fits the session:

- **Desktop session (Mac with Chrome)**: render a PNG to the scratchpad
  with headless Chrome
  (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  --headless --disable-gpu --screenshot=<out.png> --window-size=768,600
  --default-background-color=FFFFFFFF file://<abs-path>.svg`)
  and Read the PNG so it displays inline in the conversation.
- **Remote / phone / sandboxed session** (remote control, web, or
  anywhere headless Chrome isn't available): publish a preview with the
  Artifact tool so the owner can open it on their phone — a minimal
  self-contained HTML page with the SVG inlined (it's already
  self-contained by the appendix rules; no external references, so the
  CSP is satisfied). Put it on a neutral checkerboard or both-theme
  background so transparent regions read correctly. Artifacts are
  private by default; this previews, it does not publish the drawer.
  Reuse the same artifact file/URL for later items in the session
  rather than minting new pages.

Either way, share the preview and wait — grading unseen art defeats
the collection.

## 6. Annotate

Walk the owner through the rubric from `taxonomy.json` (never hardcode):
overall grade (show the scale with descriptions), then each axis (offer
value ids + descriptions, or "skip" — skipped axes are OMITTED). Owner
remarks become `{"value": ..., "note": ...}`. If the owner defers, a
provisional self-assessment is allowed but must be labeled as such in
`notes` ("provisional self-assessment — owner to regrade").

Then the **size**, in the same survey (this is where sizeClass is
elicited — not §2). Show the `sizeTiers` from `taxonomy.json`
(`xs`/`s`/`m`/`l`/`xl` with their descriptions) and have the owner pick
ONE tier. Size is **per-item**, not per-response: the one `sizeClass`
governs every response to the prompt (only the primary renders anyway).
Optionally a per-item `sizeScale` (a positive multiplier, default 1) for
sizes between or below tiers — the continuous fine dial that the coarse
tiers can't reach (e.g. the paperclip is `s` × 0.36). sizeClass is the
owner's call every time; write `m` only on an EXPLICIT defer, never on
silence. (Automating size from the artwork is the eventual goal — these
picks are the training signal, so record them faithfully.)

## 7. File, validate, publish

Per CLAUDE.md: entry.json (or appended response), model registered in
`taxonomy.json` if new, validator green, then commit and push to `main`
with the conventional message — the push IS publication. Positions are
auto-scattered at load — there is NO `placement` to author. A new item
just needs its `sizeClass` (+ optional `sizeScale`); it scatters into the
pile with everything else.

## Never

- Never ask the owner to specify style or detail beyond what they
  volunteered — prompt ambiguity is the model's problem to solve, and its
  solution is gradeable. "Helpful" prompt-sharpening biases the sample.
- Never generate before the §2 operational answers are in, and never
  file owner-choice fields (sizeClass, grade, annotations) the owner
  didn't actually choose or explicitly defer.
- Never give the generating subagent context beyond prompt + appendix.
- Never edit artwork bytes (viewBox tightening is the sole permitted
  normalization, always disclosed).
- Never invent grades, models, dates, or prompt counts.
- Never reuse an item id or renumber rids.
