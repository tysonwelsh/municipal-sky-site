# /about/ — the step text

Every step on the walkthrough, in page order. Edit freely here — headings are the `###` lines, everything under them is the body. Each step keeps its id (`step: …`) so the edits can be carried back into `about/index.php`; _Pane_ says what the reader is looking at while that step is on screen, and ⚠ marks a line that currently says something the page doesn't show.

This file is a working draft only: the page does not read it, and `.md` files are never deployed.

---

## Scene 1 — The drawer

`step: hook` · _Pane: the drawer (picture + live succulent)_

### A junk drawer, and a benchmark

This is the virtual junk drawer where I stash my collection of AI-generated vector art.

It is also where I’m building my own personal benchmark for evaluating how well large language models generate SVG images.

`step: premise` · _Pane: the drawer_

### One prompt, four models, one shot each

Here is how it works. I write a prompt and send it, word for word, to four frontier models from four different companies. Each one gets a single try. Whatever comes back goes into the drawer exactly as the model wrote it, imperfections and all, and I grade it without knowing which model drew it.

⚠ "four frontier models from four different companies" — 20 of the 67 items are Claude-only (early era), and the report card later shows two Claude models among five.

`step: graded` · _Pane: the drawer; the succulent lifts and its tag opens_

### Every object has a grade

Tap anything in the pile and it comes with a tag that tells you what it is and how it scored. Behind the tag is a full record: the prompt, the model, the score on every axis, and what the drawing cost to generate. I’ll open one of those records a little further down.

⚠ "Tap anything in the pile" — on this page only the succulent responds.

---

## Scene 2 — The instrument

`step: try` · _Pane: the rating card, blank — the reader can fill it in_

### This is the grading instrument. Try it.

These are four drawings of the same prompt. The models’ names are hidden until the grades are filed, so nothing gets scored on reputation. Rate each drawing on each axis, then rank the four. This is the real instrument, wired exactly the way a visitor to the drawer gets it.

> **Demo note (small print under the card):** This is a demo. Nothing you enter here is recorded. Every rating you file stays in your browser.

`step: taxonomy` · _Pane: the rating card, blank; the legend (grades + axes) renders under this text from taxonomy.json_

### The taxonomy

I grade on five overall tiers and four axes. The tiers say how good a drawing is; the axes say _where_ it went wrong. I designed each axis to isolate one kind of failure from every other kind, so a low score always means something specific. The legend below renders from the same file the grades are recorded in, so this page and the instrument can never disagree.

[ the taxonomy legend renders here — edit it in taxonomy.json, not here ]

`step: claude-fable-5` · _Pane: rating card, specimen 1: Claude Fable 5, filed ratings shown_

### What “no problems” looks like

Start with the best of the four. The parts attach where they should, the layers stack the way the artist intended, and it has some style. Top marks on every axis. That is what makes it useful here: it sets the standard the other three get measured against.

`step: kimi-k3` · _Pane: rating card, specimen 2: Kimi K3 (has the REPLAY / ▶ control)_

### A failure you cannot see. Press REPLAY.

This one looks thin and a little bare, and it would be easy to call it simply worse. Press **REPLAY** and watch it draw. The leaves are rendered _correctly_ and in full, and then the pot is drawn on top of them. Nothing is malformed. The parts are just stacked in the wrong order.

That is one axis, Layering, doing exactly the job I built it for: naming a defect the still image hides. The structure is sound and the model understood the brief, and it still fails on one specific thing.

⚠ "Press REPLAY" — the control is an unlabeled ▶ on the filmstrip.

`step: gemini-3-1-pro` · _Pane: rating card, specimen 3: Gemini 3.1 Pro_

### A different axis, a different diagnosis

Here the stacking is fine and the problem is the object itself. The leaves float free of the pot, attached to nothing. You could not fix this by reordering the layers; the parts themselves would have to move. Same taxonomy, different axis, and the score lands in a different place.

`step: gpt-5-1` · _Pane: rating card, specimen 4: GPT-5.1_

### The axes describe. They do not decide.

This drawing scores _identically_ to the last one on all four axes, and I gave it a lower overall grade. That is deliberate. The grade is a judgment about the whole drawing, not a sum of the axes, and the taxonomy says so out loud: the last axis makes room for the rater’s own taste instead of pretending it isn’t there.

`step: ranking` · _Pane: the ranking podium_

### Then the four get ranked

The last step is the podium. The four drawings line up from best to worst. Scoring each one on its own answers “how good is this?” The ranking answers the question the whole drawer is built on: _which of these four actually did the job?_ It is the one judgment you cannot make one drawing at a time.

> **Demo note (small print under the card):** The order shown here is derived from the filed grades, not read from a filed ranking: nobody ever ranked this specimen. Everything else on this page comes straight out of the record.

⚠ The demo note says nobody ranked this specimen — but three of the four (Kimi, Gemini, GPT) come from a rerun that WAS ranked (with Opus 5 as the fourth); Fable 5 came from a different generation run.

---

## Scene 3 — The record

`step: record` · _Pane: the report card for the succulent (Claude Fable 5)_

### Every judgment becomes a record

This is the report card behind the tag from earlier. The prompt, word for word. The model and its exact version. The overall grade, the score on every axis, and where it ranked against the other three. Press an axis name and its definition unfolds, the same definition the instrument showed you.

`step: cost` · _Pane: the report card (same as above)_

### What it cost to collect

Tokens in, tokens out, and the price of the API call, recorded for every drawing. Evaluation data has a unit cost. In my day job I plan collection programs around that number, so I track it here too.

⚠ The report card on screen shows no tokens or cost (Fable 5 was generated by a different pipeline and has none recorded).

`step: stack` · _Pane: the report card (same as above)_

### It is a real application, front to back

The ratings are rows in a SQL database, not files. There is a schema for submissions, generations, ratings, and ranks, written through authenticated endpoints and read back by the pages you are scrolling through now. I built the front end, the back end, the schema, and the taxonomy myself, working with Claude Code.

`step: populations` · _Pane: the report card (same as above)_

### Two sets of ratings, never mixed

My own ratings and visitors’ ratings are stored separately, and neither can overwrite the other. That keeps my reference set clean while the crowd’s set grows beside it. Both export as JSONL for analysis.

---

## Scene 4 — The analysis

`step: grades` · _Pane: analytics folder: the grades card_

### Now all of it at once: where the grades fall

Every drawing and every model, counted live from the same records you just looked at. This is the distribution of overall grades across the whole collection and for each model, which is the first thing the data has to say. None of these numbers are typed in by hand.

⚠ "the distribution of overall grades" — the chart shows per-model averages, not a distribution. The analytics also leave out Claude Fable 5.

`step: spend` · _Pane: analytics folder: the cost card_

### What the drawings cost

Spend per model, priced from each call’s own token counts rather than estimated. Some models draw better than others, and some cost a good deal more per drawing. Both facts belong in the same chart.

⚠ "Both facts belong in the same chart" — the chart shows cost only.

`step: multiples` · _Pane: analytics folder: the four axis panels_

### Four axes, four rulers

The axis panels are small multiples: the same shape, so your eye can compare them directly. What they deliberately do _not_ do is share a scale. A three-point axis and a four-point axis are different rulers, and stretching them onto one would invent a comparison the data cannot support.

`step: limits` · _Pane: analytics folder: the four axis panels_

### What this does not show

One rater, mostly me. A small visitor sample. Drawing SVGs is one narrow skill, not a measure of a model. The point of this project is the method: the taxonomy, the instrument, the record, and the analysis. The leaderboard is a side effect.

---

## Outro (after the last step)

the drawer on its own page · the generative art series

_(then the build stamp, e.g. `0.9.159 · 1a2b3c · 2026-09-26 22:00 UTC`, and the site's newsletter box)_

⚠ No name, contact, or call to action anywhere on the page yet.
