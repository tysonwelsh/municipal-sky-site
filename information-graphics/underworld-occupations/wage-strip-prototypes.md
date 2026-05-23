# Wage Strip Prototype Notes

Working notes for the wage strip-plot iterations on `information-graphics/`. Hand-off doc for a fresh Claude session.

## Context

The main deck is **`underworld-labor-market.html`** — a 13-slide infographic about classifying the figures in Rabelais's underworld (Book 2, Ch. 30) by BLS SOC code. The deck is embedded into `underworld-occupations.php` via PHP body extraction.

Tyson noticed that the wage strip plot in the deck (slides 3, 4, 11) collapses figures onto **one dot per SOC code** rather than one per figure. Multiple Rabelais figures who share a SOC (e.g., all "pompous lords" → `11-1011`) become a single dot. The prototype files below explore per-figure renderings.

## Data source

All prototype files fetch the **production API** at `https://municipalsky.com/api/rabelais-annotations.php`. The local site (Local by Flywheel) is reachable, but the DB credentials wired into `api/database.php` only resolve on production, so local PHP calls 500. The deck does the same thing — see `underworld-labor-market.html:6213`.

Relevant payload fields:
- `data.characters` — one row per Rabelais figure (~90). Includes `name`, `occ_code`, `occ_title`, `labor`, `lot_in_life`, `major_group_title`.
- `data.hierarchical_data` — BLS OEWS rows by `OCC_CODE`. Wage fields (`A_MEDIAN`, `A_PCT10/25/75/90`), employment, and pre-joined `major_a_*` aggregates on every row.
- `data.national_stats` — total-US wage distribution.

## Prototype files

### `underworld-labor-market-all-figures.html` — diagnostic workbench
Standalone debug page (not embedded into the PHP wrapper). Open directly under `/information-graphics/`.

Contains:
1. **Big strip plot** at full page width. Major-group wheat plot + box-and-whiskers + half-beeswarm of all 90 figures. Toggleable "show suppressed" and "label every ghost" controls.
2. **"All Figures, by Wage" table** — three-column table: Figure / Detailed Occupation (with SOC code) / Median Wage. **Tyson likes the styling of this table** (`.figure-table` CSS in that file). Worth reusing for any future "figures listing" view.
3. **"At Slide Size" chart** — same chart again at the deck's exact dimensions (margins 10/20/65/24, major 115, box 28, gap 10, ghost 270, ghost scale 0.95). Wrapped in a `.slide-strip-card` (max-width 1100) to mimic the deck's parchment frame. Currently configured with the **deterministic column-pack** half-beeswarm (see below).

Important things baked into this file:
- "Half-beeswarm" algorithm: ghosts are pre-sorted by x, then each is placed at the shallowest y where it doesn't collide with already-placed ghosts. Flat top edge, columns grow downward. We tried d3-force first — it kept clustering near the top no matter how we tuned strength — so the deterministic column-pack is what works. Search for `// Half-beeswarm arrangement` in the file.
- US median label uses the deck's two-line treatment: small-caps "U.S. MEDIAN (2024)" + value below, with a leader line.
- Suppressed-wage figures park in the negative-x margin as dashed circles. The toggle hides them.

### `underworld-ghost-strip-slide.html` — single-slide preview
A self-contained "what would this look like as a real slide" preview. Designed to be opened directly in a browser.

Layout:
- Outer slide-card sized **720 × 680** (max-width 720, fixed height 680) to match the deck's slide viewer.
- Header (title + subtitle), body (chart), footer (inert prev/next buttons + indicator) — chrome lifted verbatim from `underworld-labor-market.html`.
- **No major-group wheat plot.** Just box-and-whiskers at the top of the chart area + half-beeswarm of all 90 ghosts below.
- Chart body uses flex sizing so the SVG fills whatever vertical space the header/footer leave.
- Ghost scale 0.95, deterministic column-pack from the top edge, same suppressed-figure parking logic as the workbench file.

This is the candidate replacement (or addition) for the deck's wage-distribution slide.

## Deck file changes (Diogenes slides 12 & 13)

Quick summary of the in-deck edits that landed during this session, in case a future Claude needs to re-find them:

- **Slide 12 ("Who Was Diogenes? (An Outlier IRL)")**: Bullet list rewritten. First bullet now: *"Sent into exile after a scandal over the debasement of the currency."* An explainer card below the bio-slide-card reads: *"Diogenes was a philosopher who flouted social convention. In life, he could reasonably be described as a low-life, a deadbeat, a bum."*
- **Slide 13 ("Classifying Diogenes")**: Three sections — "How He Appears in the Underworld" (quote), "What Claude Extracted" ("Pompous lord"), **"Best Classified As…"** (indented SOC tree, no codes). New `.classify-tree` / `.classify-tree-row` CSS renders the hierarchy with circle markers; leaf row is bold + filled circle. Explainer below the card quotes Bakhtin: *"…All who are highest are debased, all who are lowest are crowned."*
- `bio-slide-card` height was reduced (460 → 380px, image max-height 360 → 280px) to make room for the explainer blocks below it on both slides.

## Conventions observed

- Cormorant Garamond / Cormorant SC for all text; small caps via the SC face, not `text-transform`.
- Use `-webkit-text-stroke: 0.4px currentColor` for "true bold" headers since Cormorant's 700 weight is too thin on its own.
- All chart styling lives inside `.umlm-context` in the deck file so it doesn't leak into the surrounding PHP page.
- Don't rotate axis labels — Tyson's standing rule. Wrap or shorten instead.

## Things explicitly tried and abandoned

- **d3-force for half-beeswarm**: clustering near the top even with collide strength 1 and forceY strength tuned across orders of magnitude. Replaced with the deterministic column-pack. Don't try to bring it back without a clear reason.
- **Local-PHP fetch fallbacks** (`/api/...` then `../api/...`): both 500 because local DB creds aren't set. All prototypes call production directly.
- **Slide-13 elaborate "Figures with Suppressed Wages" breakdown** in the workbench file: scrapped in favor of just adding the DO column to the main table.
