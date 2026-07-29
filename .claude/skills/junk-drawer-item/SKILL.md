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
3. **Ink-bounds check**: `scripts/check-svg-ink.sh <file>` — run it at
   ingest. The tool is cross-platform: it finds a browser via `$CHROME_BIN`,
   the macOS Chrome app, `chromium`/`google-chrome` on PATH, or a
   Playwright-managed Chromium under `/opt/pw-browsers`, so it works on a
   desktop, in CI, and in most sandboxed sessions. Worst-side dead margin
   ≤ ~6% passes; record the result in the response's `notes` (e.g.
   "ink-bounds check passed … worst dead margin N%"). If PADDED: tighten
   the viewBox to the tool's suggestion — permitted normalization
   (reframes, never redraws) — disclose it in `notes`, and consider grading
   composition against the ORIGINAL framing. Only if NO browser is
   reachable (a truly headless phone session): say so, file anyway, and
   flag it for an ink check next session.

## 5–6. Show artwork and annotate — the rating instrument

The owner must SEE the artwork AND rate it in one place. Do not use
AskUserQuestion for grades or axes — use the interactive rating
instrument instead.

### Build the instrument

Run the builder — do NOT hand-assemble the page, and do not edit the
template to inject data:

```
python3 .claude/skills/junk-drawer-item/build-instrument.py \
  --out <scratchpad>/rate.html \
  --heading "Rate — <short item name>" \
  <model-id>=<path to svg> [<model-id>=<path to svg> ...]
```

One `MODEL=SVG` pair per response, in rid order (first pair = r1). The
script reads `taxonomy.json` for the live `grades`, `axes` and
`sizeTiers`, looks each model's display label up in the registry,
namespaces every `id` and every `url(#…)`/`href="#…"` per response
(`m1_`, `m2_`, …) so three SVGs can share one page, fills the four
`__INJECT_*__` markers, and writes the populated HTML. It reads the
artwork; it never writes to it. Two things it prints to stderr are worth
acting on: a model id missing from `taxonomy.json` (register it before
filing) and an SVG referencing ids it doesn't define (a broken
reference in the artwork — gradeable, not something to fix).

Then publish the written file with the Artifact tool. Reuse the same
file path / URL for later items in the session rather than minting new
pages.

### What the instrument collects (per response)

- **Overall grade** — the full scale from taxonomy.json, with
  descriptions. This is on each model's tab, not asked separately.
- **Annotation axes** — each axis from taxonomy.json, with values +
  skip option. Optional per-axis notes.
- **Size** — the `sizeTiers` picker appears on the FIRST model's tab
  (size is per-item, not per-response).
- **Display pin** — also on the FIRST model's tab, also per-item, and
  OPTIONAL. Defaults to "Let the grade decide"; the owner may instead
  pin one response as the one the drawer shows.

### The flow

Share the artifact link and WAIT. The owner taps through the tabs,
rates each image (they can see it right there), then hits "Results →
Copy to clipboard" and pastes the JSON back into the chat. Parse the
pasted JSON to extract grades, annotations, sizeClass, and `pinned`.

If the owner defers grading entirely, a provisional self-assessment is
allowed but must be labeled in `notes` ("provisional self-assessment —
owner to regrade").

sizeClass is the owner's call every time; write `m` only on an EXPLICIT
defer, never on silence. Optionally a per-item `sizeScale` (a positive
multiplier, default 1) for sizes between or below tiers.

The pin is the ONLY thing that writes `primary`. If `pinned` names a
model, write that response's `rid` as the entry's `primary`; if it is
null, OMIT `primary` entirely — `data.php` then shows the best-graded
response (ties break to the earliest `rid`) and follows later regrades
on its own. Never write `primary` to record filing order.

### Desktop fallback

On a **desktop session with Chrome** where the owner prefers inline
previews, you may still render PNGs to the scratchpad with headless
Chrome and Read them inline — but still use the rating instrument
artifact for annotation rather than AskUserQuestion.

## 7. File, validate, publish

Per CLAUDE.md: entry.json (or appended response), model registered in
`taxonomy.json` if new, validator green, then commit and push with the
conventional message. Positions are auto-scattered at load — there is
NO `placement` to author. A new item just needs its `sizeClass`
(+ optional `sizeScale`); it scatters into the pile with everything else.

**Go live immediately.** A push to `main` auto-deploys. After the
commit, create a PR from the working branch to `main` and merge it
(squash) so the item is live on the site. Do not leave it sitting on
a feature branch — the item is not published until it reaches `main`.

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
