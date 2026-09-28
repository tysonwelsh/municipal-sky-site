# /about/ — the step text

Every step on the walkthrough, in page order. Edit freely here — headings are the `###` lines, everything under them is the body. Each step keeps its id (`step: …`) so the edits can be carried back into `about/index.php`; _Pane_ says what the reader is looking at while that step is on screen, and ⚠ marks a line that currently says something the page doesn't show.

This file is a working draft only: the page does not read it, and `.md` files are never deployed.

---

## Scene 1 — The drawer

`step: hook` · _Pane: the drawer (picture + live succulent)_

# About the SVG Junk Drawer

_(the page title: "About the" small and italic on its own line over "SVG Junk Drawer", a double rule — at the head of this step, so it scrolls away with the opening paragraphs)_

### My personal SVG benchmark

This is the virtual junk drawer where I stash my collection of AI-generated vector art.

It is also where I’m building my own personal benchmark for evaluating how well large language models generate SVG images.

Feel free to click through or rearrange the items. You can [open the full drawer](/art/junk-drawer/) to see everything it can do, or just keep scrolling to learn more.

`step: premise` · _Pane: the drawer_

### What are SVG images?

An SVG is a drawing written in code: a list of shapes, coordinates, and colors. Unlike most AI-generated art, SVGs are vector images, so they can be edited in programs like Adobe Illustrator or scaled to any size without losing sharpness.

They also make for a fun way to test the coding skills of a model, because mistakes in the code show up in the drawing.

`step: graded` · _Pane: the drawer; the succulent lifts and its tag opens_

### Every item has a grade

Every item in this drawer began as a prompt sent to four leading models.

Once the four drawings come back, the person who wrote the prompt grades each one without knowing which model made it. Those grades are stored as data, with the aim of building a running comparison of how well each model draws.

Keep scrolling to learn more, or dig around in the drawer yourself.


---

## Scene 2 — The instrument

`step: try` · _Pane: the rating card, blank — the reader can fill it in_

### The instrument

This is the interface used to collect the grades. Graders evaluate each drawing one at a time before ranking the four drawings from best to worst.

Go ahead and try it out.

> **Demo note (small print under the card):** This is a demo. Nothing you enter here is saved or recorded.


`step: taxonomy` · _Pane: the rating card, blank; the four categories render under this text from taxonomy.json (each axis's one-line `summary` — edit the wording there; mirrored below)_

### The taxonomy

Images are graded in four distinct categories, each designed to isolate a single kind of failure. They are:

- **Understanding Assignment** — Did the model attempt to draw what the prompt asked for?
- **Structural Coherence** — Do the individual parts connect, with correct proportions, anatomy, and perspective?
- **Layering** — Are the parts stacked in the right order, with correct use of opacity?
- **Je ne sais quoi** — Does the image have that ineffable spark? You know it when you see it.


---

## Scene 3 — The report card

`step: claude-fable-5` · _Pane: the report card, turned to Claude Fable 5’s drawing (grade, ratings, rank, tokens and cost where recorded)_

### This is a great SVG!

Here’s an example of a primo SVG drawn by Claude Fable 5.

The individual parts are well connected, the layers stack correctly, and the pot has the tasteful, Scandinavian influence I was hoping for when I wrote the prompt.

It earned top marks in every category.

`step: gemini-3-1-pro` · _Pane: the report card, turned to Gemini 3.1 Pro_

### This one has problems. But which *kind* of problems?

Here’s an example of an image with problems in both the Understanding Assignment and Structural Coherence categories.

Can you spot the problem with Understanding Assignment?

`step: gemini-answer` · _Pane: the same Gemini card (no card change)_

### Problems with Understanding Assignment

The prompt asked for a _desktop_ succulent, but this model drew a pot that is resting on a stand with wooden legs. That’s the sort of stand you’d see holding a large floor plant, not a smaller pot that sits on a desk.

This is an issue with Understanding Assignment because the model attempted to draw something other than what was asked for in the prompt.

`step: gemini-structure` · _Pane: the same Gemini card (no card change)_

### Problems with Structural Coherence

There are other problems with this image: the succulent’s leaves are oddly proportioned and float in midair.

These issues belong in the Structural Coherence category, because they have to do with how well the individual parts fit together.

`step: kimi-k3` · _Pane: the report card, turned to Kimi K3 (the filmstrip’s ▶ replays the drawing)_

### Problems with Layering

Here’s an example of an image with big problems in the Layering category.

Notice how the leaves of the plant are hidden on the bottom layer of the image, behind the pot, when they should be sitting on top, emerging from the mouth of the pot.

Press ▶ under the drawing to see what I mean. It shows how the model did a pretty good job drawing the leaves, but then made the mistake of drawing the mouth of the pot over them. Textbook layering issue.

---

## Scene 4 — The analysis

Each visual is its own paper card, drawn by this page from the analytics endpoint (no folder), one per step; a change of card scrolls like a change of scene.

`step: stack` · _Pane: the record as a bare, wide spreadsheet on the page (no card or title), report-card width — one row per prompt drawn by the four-model cast (51): item (its title; hover or tap shows the full prompt), then each model’s grade and four category ratings, numbers only; scrolls both ways (from the full data.php)_

### A real application, front to back

The SVG Junk Drawer is more than just a pretty interface — it also has a functional back end.

Behind the drawer, a server-side pipeline sends the user’s prompt to all four models at once, with the same system prompt and limits. The ratings are rows in a SQL database, written through authenticated endpoints into a schema for submissions, generations, ratings, and ranks.

The only thing it doesn’t have is actual users (other than myself!)

`step: grades` · _Pane: one card — “How the models compare”: the average overall grade (dots, with n) above the spread (horizontal bars by grade, coloured by the report card’s grade ramp), each with its own subtitle_

### Insights into overall quality

Let’s look at how the models compare across all of their drawings.

Besides the four category ratings, every drawing gets one overall grade on a five-point scale:

5. Prime
4. Choice
3. Select
2. Standard
1. Utility

(The same scale the USDA uses for beef!)

`step: grades-analysis` · _Pane: the same card (no card change); no heading_

### By the averages

The sample is small, about 95 drawings per model, all graded by one rater, so treat these as early results.

On average overall grade, Claude Opus 5 and Gemini 3.1 Pro finish neck and neck.

Kimi K3 is not far behind in third, with GPT-5.1 a distant fourth.

`step: distribution` · _Pane: the same card (no card change)_

### Same averages, but different distributions

The shape of the distributions tells them apart.

Despite the similar averages, Gemini generated more drawings with a Choice grade.

Meanwhile Opus had a few more Prime quality SVGs, and that tail lifted its average.

`step: multiples` · _Pane: the four category panels, two by two, each on its own scale_

### The je ne sais quoi factor

How did Opus end up with more Prime grade drawings?

Category by category, Opus and Gemini are close. Gemini even edges ahead on Understanding Assignment.

But Opus’s clearest lead is in Je ne sais quoi, which suggests it’s the spark that turns a good drawing into a great one.

(Though again ... the sample size is small!)

`step: spend` · _Pane: bars — average cost per drawing, per model, with n_

### Style doesn’t come cheap

But je ne sais quoi isn’t free! Opus’s drawings cost roughly twice as much as Gemini’s.

Notably, Kimi K3’s drawings are the cheapest of the four, even though it outperforms GPT-5.1 on overall quality.

---

## Outro — back to the drawer

`step: outro` · _Pane: the drawer (clicking it opens the full drawer page)_

### Thanks for digging through the drawer

The SVG Junk Drawer is a personal side project built to show my approach to data collection and evaluation: a clear taxonomy, an instrument people can actually use, a clean record, and analysis that doesn’t overstate what the data can show.

You can [open the full drawer](/art/junk-drawer/) to explore or take a turn yourself.

If you’d like to talk about evaluation and data work, [find me on LinkedIn](https://www.linkedin.com/in/tysonwelsh).

_(then the colophon: the drawer on its own page · the generative art series · the build stamp)_

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
