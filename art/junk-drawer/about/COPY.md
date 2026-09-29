# /about/ — the step text

Every step on the walkthrough, in page order. Edit freely here — headings are the `###` lines, everything under them is the body. Each step keeps its id (`step: …`) so the edits can be carried back into `about/index.php`; _Pane_ says what the reader is looking at while that step is on screen, and ⚠ marks a line that currently says something the page doesn't show.

This file is a working draft only: the page does not read it, and `.md` files are never deployed.

---

## Scene 1 — The drawer

`step: hook` · _Pane: the drawer (picture + live succulent)_

# About the SVG Junk Drawer

_(the page title: "About the" on one line and "SVG Junk Drawer" on the next, both in the same type, a double rule — at the head of this step, so it scrolls away with the opening paragraphs)_

### My personal SVG benchmark

This is the virtual junk drawer where I stash my collection of AI-generated vector art.

It’s also an experiment in benchmarking how well large language models generate SVG images.

Everything in the drawer is interactive. Click an item to view its details, or drag it aside to see what’s underneath.

[Visit the full drawer](/art/junk-drawer/) to try a prompt yourself, or keep scrolling to learn more.

`step: premise` · _Pane: the drawer_

### What are SVG images?

An SVG is a drawing written in code: a list of shapes, coordinates, and colors. 

Unlike most AI-generated art, SVGs are vector images. This means they can be edited in programs like Adobe Illustrator or scaled to any size without losing sharpness.

They are also a fun way to test a model’s coding skills, because mistakes in the code show up in the drawing.

`step: graded` · _Pane: the drawer; the succulent lifts and its tag opens_

### Every item has a grade

Each item in the drawer began as a prompt sent to four leading models.

When the four drawings come back, whoever wrote the prompt grades each one without knowing which model made it.

---

## Scene 2 — The instrument

`step: try` · _Pane: the rating card, blank — the reader can fill it in_

### The instrument

This is the interface I use to grade the drawings. 

Each one is rated in four categories and given an overall grade, on the same five-point scale the USDA uses for beef: Prime, Choice, Select, Standard, and Utility. After that, all four are ranked from best to worst.

Feel free to try it out!

For demonstration purposes only. Nothing entered here is saved or recorded.


`step: taxonomy` · _Pane: the rating card, blank; the four categories render under this text from taxonomy.json (each axis's one-line `summary` — edit the wording there; mirrored below)_

### The taxonomy

Images are rated in four categories, each designed to isolate a single type of failure. They are:

- **Understanding Assignment** — Did the model attempt to draw what the prompt asked for?
- **Structural Coherence** — Do the individual parts connect, with correct proportions, anatomy, and perspective?
- **Layering** — Are the parts stacked in the right order, with correct use of opacity?
- **Je ne sais quoi** — Does the image have that special spark? You know it when you see it.


---

## Scene 3 — The report card

`step: claude-fable-5` · _Pane: the report card, turned to Claude Fable 5’s drawing (grade, ratings, rank, tokens and cost where recorded)_

### A gold standard

Here’s a top-notch SVG drawn by Claude Fable 5.

It’s clearly a desktop succulent, the individual parts fit together, the layers stack correctly, and the pot has the tasteful Scandinavian style I had in mind when I wrote the prompt.

It earned top marks in every category.

`step: gemini-3-1-pro` · _Pane: the report card, turned to Gemini 3.1 Pro_

### This one has problems. But which *kind*?

This drawing from Gemini 3.1 Pro has issues in the Understanding Assignment and Structural Coherence categories.

Can you spot the Understanding Assignment problem?

`step: gemini-answer` · _Pane: the same Gemini card (no card change)_

### Problems with Understanding Assignment

The prompt asked for a _desktop_ succulent, but Gemini drew a pot on a stand with wooden legs. That’s the kind of stand you’d see holding a large floor plant, not a small pot on a desk.

This is considered an Understanding Assignment problem because the model tried to draw something other than what was asked for in the prompt.

`step: gemini-structure` · _Pane: the same Gemini card (no card change)_

### Problems with Structural Coherence

This drawing has other obvious issues: the succulent’s leaves are distorted and float in midair.

These fall under Structural Coherence because they relate to the plant’s anatomy and how the individual parts fit together.

`step: kimi-k3` · _Pane: the report card, turned to Kimi K3 (the filmstrip’s ▶ replays the drawing)_

### Problems with Layering

This drawing from Kimi K3 has a big Layering problem.

Notice how the leaves are hidden behind the pot, when they should be sprouting from its mouth.

Press ▶ under the drawing to see what I mean. The replay shows the model drawing the leaves just fine, but then covering them with the pot’s mouth. Textbook layering issue.

---

## Scene 4 — The analysis

Each visual is its own paper card, drawn by this page from the analytics endpoint (no folder), one per step; a change of card scrolls like a change of scene.

`step: stack` · _Pane: the record as a bare, wide spreadsheet on the page (no card or title), report-card width — one row per prompt drawn by the four-model cast (51): item (its title; hover or tap shows the full prompt), then each model’s grade and four category ratings, numbers only; scrolls both ways (from the full data.php)_

### A real application, front to back

The SVG Junk Drawer isn’t just a pretty interface. It also has a working back end.

Behind the drawer, a server-side pipeline sends each prompt to all four models with the same system instructions, and everything is stored in a SQL database.

The only thing missing is actual users (other than me!)


`step: grades` · _Pane: one card — “How the models compare”: the average overall grade (dots, with n) above the spread (horizontal bars by grade, coloured by the report card’s grade ramp), each with its own subtitle_

### Insights

Here’s how the four models compare on overall grade, across roughly 100 drawings each. It’s a small sample, I know, but humor me.

On average, Claude Opus 5 has a *slight* lead over Gemini 3.1 Pro. 

Kimi K3 isn’t far behind in third, with GPT-5.1 a distant fourth.

`step: distribution` · _Pane: the same card (no card change)_

### Similar averages, different distributions

Despite similar averages, Gemini generated more drawings graded Choice, while Opus had more graded Prime.

In other words, while Gemini is reliably good, Opus is slightly more likely to produce something special.

`step: multiples` · _Pane: the four category panels, two by two, each on its own scale_

### The je ne sais quoi factor

How did Opus end up with more drawings graded Prime?

Gemini and Opus are nearly tied on Structural Coherence, and Gemini even leads slightly on Understanding Assignment.

However, in the Je ne sais quoi category Opus has the advantage. This suggests that the gap between good and great comes down to that special something you can't quite put your finger on.

`step: spend` · _Pane: bars — average cost per drawing, per model, with n_

### Prime cuts ain't cheap

But that special something has a price. Opus’s drawings cost roughly twice as much as Gemini’s.

Kimi K3’s drawings are the cheapest of the four, yet it still beats GPT-5.1 on overall quality.


---

## Outro — back to the drawer

`step: outro` · _Pane: the drawer (clicking it opens the full drawer page)_

### Thanks for digging through the drawer

Of course, this is not meant to be a scientific study. 

I built it as a portfolio piece to showcase the sort of work I do in product operations for AI evaluation, including developing taxonomies, designing grading instruments, working with SQL databases, and telling stories with data.

[Visit the full drawer](/art/junk-drawer/) to explore my SVG collection or try a prompt yourself.

If you’d like to talk about evaluation and the art of data collection, email me at [tysonwelsh@gmail.com](mailto:tysonwelsh@gmail.com) or [find me on LinkedIn](https://www.linkedin.com/in/tysonwelsh). 

_(nothing below this: no colophon, build stamp or back link — the page ends on the last paragraph, then the site footer; owner, 2026-09-28)_

---

## Cut from the page (2026-09-27)

Kept here in case any of them come back.

`step: ranking` · _Pane: the ranking podium_

### Then the four get ranked

The last step is the podium. The four drawings line up from best to worst. Scoring each one on its own answers “how good is this?” The ranking answers the question the whole drawer is built on: _which of these four actually did the job?_ It is the one judgment you cannot make one drawing at a time.

> **Demo note (small print under the card):** The order shown here is derived from the filed grades, not read from a filed ranking: nobody ever ranked this specimen. Everything else on this page comes straight out of the record.

⚠ The demo note says nobody ranked this specimen — but three of the four (Kimi, Gemini, GPT) come from a rerun that WAS ranked (with Opus 5 as the fourth); Fable 5 came from a different generation run.

`step: gpt-5-1` · _Pane: the report card, turned to GPT-5.1_

### The axes describe. They do not decide.

This drawing scores _identically_ to the last one on all four axes, and I gave it a lower overall grade. That is deliberate. The grade is a judgment about the whole drawing, not a sum of the axes, and the taxonomy says so out loud: the last axis makes room for the rater’s own taste instead of pretending it isn’t there.

`step: record` · _Pane: the report card, back on Claude Fable 5_

### Every judgment becomes a record

This is the report card behind the tag from earlier. The prompt, word for word. The model and its exact version. The overall grade, the score on every axis, and where it ranked against the other three. Press an axis name and its definition unfolds, the same definition the instrument showed you.

`step: cost` · _Pane: the report card (same as above)_

### What it cost to collect

Tokens in, tokens out, and the price of the API call, recorded for every drawing. Evaluation data has a unit cost. In my day job I plan collection programs around that number, so I track it here too.

⚠ The report card on screen shows no tokens or cost (Fable 5 was generated by a different pipeline and has none recorded).

`step: populations` · _Pane: the report card (same as above)_

### Two sets of ratings, never mixed

My own ratings and visitors’ ratings are stored separately, and neither can overwrite the other. That keeps my reference set clean while the crowd’s set grows beside it. Both export as JSONL for analysis.

`step: limits` · _Pane: analytics folder: the four axis panels_

### What this does not show

One rater, mostly me. A small visitor sample. Drawing SVGs is one narrow skill, not a measure of a model. The point of this project is the method: the taxonomy, the instrument, the record, and the analysis. The leaderboard is a side effect.
