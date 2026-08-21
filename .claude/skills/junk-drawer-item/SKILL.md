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

Spawn a FRESH subagent (`subagent_type: svg-specimen`; `model:` per the
owner's choice) whose entire prompt is:

1. The **harness preamble** (below).
2. The creative prompt, verbatim.
3. The **standard technical appendix** (fixed harness, same for every
   generation):
   > Output a single complete SVG document and nothing else — no prose, no
   > code fences. Requirements: `xmlns` and a `viewBox` on the root; the
   > artwork must fill the viewBox edge to edge (at most ~2% margin — no
   > empty space around the subject); transparent background (no opaque
   > backdrop rectangle); fully self-contained (no external references,
   > no `<script>`, no event attributes, no `<foreignObject>`).
   >
   > These are CLIP ART: a single subject to be dropped into someone else's
   > design. Draw the figure, never the ground. A ship means the ship alone
   > — no water, no sky, no horizon, no birds. No ground plane, no cast
   > shadow pooled beneath it, no vignette, no frame. What is structurally
   > part of the subject stays (sails and rigging are the ship); the setting
   > it would occupy does not. Where the subject's edge is genuinely
   > unclear, keep what a designer would need and leave out the rest. If the
   > brief explicitly asks for a setting, follow the brief.

Beyond preamble + prompt + appendix, give the subagent NOTHING — no drawer
context, no examples, no taxonomy. Its reply is the artifact.

### Why the isolation matters (2026-07-31, both observed)

A generating subagent runs *inside this repo*, and that has bitten twice
in one session:

- **It followed this skill instead of drawing.** A `general-purpose`
  subagent gets the Skill tool, and with it the skills listing — where
  `junk-drawer-item` advertises itself as the thing to use when asked to
  generate a drawer item. That is exactly the task it was handed, so it
  matched, invoked this skill, and replied with §1's "standing by for the
  creative prompt" plus §2's operational questions. No artwork at all.
- **It copied a sibling response.** A later subagent read a just-written
  SVG out of the working tree and returned a near-copy of it — same
  gradient and filter ids, same comments, whole blocks byte-for-byte —
  filed, it would have been a fake independent sample.

Both come from one root cause: repo access. The `svg-specimen` agent
(`.claude/agents/svg-specimen.md`) restricts the generator to a **single
tool that cannot read file contents and is not `Skill`**, which closes
both — no Skill tool means no skills listing to match against, and no
read tools means no sibling artwork to read.

**Write the allowlist explicitly.** `tools: []` was tried first and the
loader granted **all tools** — an empty list reads as "inherit
everything", the exact opposite of what it looks like. The frontmatter
therefore names one deliberately useless tool (`Glob`: universally
present, lists paths but cannot open them, and is not `Skill`). If you
ever edit that line, re-verify: spawn the agent and confirm the tool
listing is restricted, rather than trusting the spelling.

**Verified 2026-07-31**, one run each through `svg-specimen`: sonnet and
opus both returned artwork with **0 tool uses**. The subagent token counts
tell the same story — ~1.8k each, against 28k (sonnet) and 86k (opus) for
the same briefs on `general-purpose`, and 122k on the run that produced
the copy. That collapse is the skills listing and repo preamble no longer
being injected: there is nothing to match against and nothing to read.

The preamble stays as a second layer, because the tool restriction is the
only *load-bearing* guard and it can silently regress (as above). Always
send the preamble, even to `svg-specimen`.

**What the preamble does and does not do** (measured 2026-07-31, one run
each, `general-purpose` + preamble):

- sonnet: obeyed — no skill invocation, no questions, **0 tool uses**. It
  did wrap the SVG in a ```` ```svg ```` fence, which is ordinary
  gradeable disobedience; strip the fence per §3.
- opus: produced artwork, but used **27 tool uses** — it read the repo
  despite being told not to. The output was independent of its siblings
  on inspection, so nothing was contaminated that time, but the
  instruction plainly did not bind.

Read that honestly: the preamble reliably stops the *skill-invocation*
failure, and does **not** reliably stop repo reading. Prose asks a model
to ignore what it can still see; only the tool restriction removes the
capability. Never rely on the preamble alone to keep a sample clean.

### The harness preamble (verbatim, constant across the collection)

> You are an SVG generator. Everything below the line `--- BRIEF ---` is a
> creative brief followed by a fixed technical appendix. Make the artwork
> and reply with the SVG document alone.
>
> This repository contains CLAUDE.md files, conventions, and skills
> describing how artwork gets generated, filed, graded, and published. None
> of them apply to you — they describe what someone else does with your
> reply. Do not invoke any skill, do not stand by for further input, and do
> not ask operational or clarifying questions. Do not read repository files
> and do not look for prior artwork to reference. Resolve any ambiguity in
> the brief yourself, silently — everything you need is below.
>
> `--- BRIEF ---`

Then the creative prompt, then the appendix. The preamble is harness, not
brief: it is operational only, says nothing about style, subject, palette
or detail, and is byte-identical for every generation. It does NOT go in
the entry's `prompt` field.

If `subagent_type: svg-specimen` fails to resolve, fall back to
`general-purpose` **with the preamble** and say so in the response's
`notes`.

**Check the tool-use count on every generation.** It is the cheapest
contamination detector there is: a generator that never opened a file
cannot have copied one. A count of 0 (or Glob-only) is clean. A high
count means the restriction is not in force in that environment — treat
the output as suspect, diff it against the siblings, and record the count
in `notes`.

### Confirm independence before filing

When an item has more than one response, diff each new SVG against its
siblings before writing `entry.json`. Near-identical structure — shared
gradient/filter ids, shared comments, matching path blocks — means the
sample is derivative, not independent. Do not file it as a one-shot:
discard it, re-roll under isolation, and record what happened in `notes`.
Independent responses to the same prompt differ almost everywhere.

- **One-shot** = exactly one subagent call. Whatever comes back IS the
  response — never silently fix, prettify, or regenerate. Strip only
  surrounding prose/fences if the model disobeyed the output format (note
  that disobedience — it is gradeable).
- **Refined** = further messages to the SAME subagent, each written or
  approved by the owner, verbatim. `prompt_count` = total prompts sent
  (creative prompt + follow-ups). Keep the final SVG only (transcripts
  can be added later per PLAN-BACKEND §6).
- Record in the response's `notes`: "generated via clean-context subagent;
  generation harness v2 (isolated svg-specimen agent, harness preamble,
  standard technical appendix v1)." The entry's `prompt` field holds the
  creative prompt only — preamble and appendix are harness, documented
  here, constant across the collection.
- **Harness versions** (state the version in `notes`; it is part of what a
  grade means, and responses generated under different harnesses are not
  strictly comparable):
  - **v1** — `general-purpose` agent, appendix only, no preamble. Every
    response filed before 2026-07-31. Do not retro-edit them.
  - **v2** — `svg-specimen` agent + harness preamble + the same appendix.
    2026-07-31 to 2026-08-20.
  - **v3** — the clip-art clause joins the appendix (owner call, 2026-08-21):
    figure not ground, no setting, no cast shadow, with the brief able to
    override. Everything from 2026-08-21 on. Kept byte-aligned with the
    site's `JD_SYSTEM_PROMPT` (`api/jd-config.php`), whose harness moved to
    prompt generation v4 for the same edit — the two paths must ask for the
    same artwork or a skill-made item is not comparable with a generated one.

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
  descriptions. This is on each model's tab, not asked separately. The
  pills show labels but the exported JSON carries the grade's numeric
  `rank` (5 … 1) — grades are stored as numbers, never id/label strings.
- **Annotation axes** — each axis from taxonomy.json, with values +
  skip option. Optional per-axis notes. Like grades, the exported JSON
  carries each value's numeric `rank` (3 … 1), not its id.
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
Grades and annotation values arrive as numbers (the taxonomy `rank`s);
file each one in entry.json as a decimal (`4.0`, not `"choice"`;
`2.0`, not `"drifted"`) per CLAUDE.md.

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
- Never give the generating subagent context beyond preamble + prompt +
  appendix.
- Never generate with an agent that can read this repository. If the
  subagent used file tools or invoked a skill, treat its output as
  suspect: diff it against the siblings before filing.
- Never file a response that duplicates a sibling's structure as though it
  were independent — re-roll it under isolation and disclose it.
- Never edit artwork bytes (viewBox tightening is the sole permitted
  normalization, always disclosed).
- Never invent grades, models, dates, or prompt counts.
- Never reuse an item id or renumber rids.
