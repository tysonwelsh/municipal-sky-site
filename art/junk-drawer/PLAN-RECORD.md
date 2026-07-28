# PLAN-RECORD — The Full Record (the specimen card, step 2)

Extends PLAN-FRONTEND §4 and PLAN-MOBILE §4 for the build that makes the
item tag's dead `FULL RECORD →` button live. Written 2026-07-27 against
the shipped Phase 1–2 page (auto-scatter pile, manila item tag on the
red elastic), which superseded parts of the older plans:

- **Step 1 is the ITEM TAG now** — the manila tag (title · model · date,
  grade + manicule meter, DOWNLOAD SVG), not mockup-3's front-edge
  scorecard slip. Whatever the record looks like, it opens FROM the tag
  and must feel continuous with it.
- **The name is undecided.** `FULL RECORD` is a placeholder the owner
  isn't sold on. Each style below carries its natural name (REPORT
  CARD · ACCESSION RECORD · CONDITION REPORT · THE PAPERWORK · CATALOG
  CARD); picking a style and tasting its name are the same act. A
  style's look can win while its name loses — G7 keeps them separable.

## 1. What the record is

The portfolio moment: one prompt, shown verbatim, with every model's
response to it graded like the model output it is. The pile shows the
art; the record shows the *eval*. Everything on it renders from the
`data.php` payload (entry + taxonomy) — zero hardcoded rubric strings,
unknown axes render generically (the taxonomy grows).

Behaviors common to every style (decided in prior plans; not re-opened):

- Opens from the item tag's button (and, later, inventory links). The
  item **lifts out of the drawer** over a ~40% scrim; card beside it
  (desktop: SVG ~55% left, card ~35–460px right) or bottom sheet
  (mobile: SVG top ~45svh, sheet peek → full detents per PLAN-MOBILE §4).
- **Alternatives flip in place**: a strip of the other responses to the
  same prompt (each style words its own caption for this — see §3);
  choosing one swaps the lifted SVG at identical scale and swaps the
  card's response fields; the prompt never changes. Mobile adds
  horizontal swipe ≥40px on the SVG zone. The pile always keeps showing
  the primary.
- **Deep links**: opening sets `#<id>` via `pushState`; `popstate`
  closes; loading with a hash opens the record directly. Item DOM keeps
  using `data-id` (never `id`) so the browser doesn't fragment-scroll.
- Esc / scrim / ✕ closes back to the tagged (picked) state; the
  selection survives. Close animates the item back down into the pile.
- `item_open` tracking event (label = item id) alongside page views.
- Download-SVG stays available on the record (it may leave the tag).

## 2. The data — what the record shows

From `entry.json` + the taxonomy block (shapes per PLAN-BACKEND §7).

**The constant (per item, shown once):**

| Field | Source | Treatment |
| --- | --- | --- |
| Title | `title` | Header, display caps |
| **The prompt, verbatim** | `prompt` | The exhibit's centerpiece. Always monospace, quoted as-received — typos, casing, everything — even inside serif styles (mono is the "verbatim" signal). Scrolls past ~8 lines. Never truncated, never "cleaned." |
| Date collected | `created` | Header chrome |
| Response count | `responses.length` | The strip's caption counts them |
| Tags | `tags` | Fine print if present (reserved; usually empty) |
| Accession no. | `id` | Fine print / style-dependent flourish (the card styles promote it) |

**Per response (swaps with the flip-through):**

| Field | Source | Treatment |
| --- | --- | --- |
| Model | `model` → taxonomy `models` | Label + vendor ("Claude Opus 5 · Anthropic") |
| Process | `generation` | `ONE-SHOT` or `REFINED ×N` — honest turn count, rendered in each style's idiom |
| Response date | `date` | Chrome beside model |
| **Overall grade** | `grade` → taxonomy `grades` | The big moment: label + rank on the 5-step scale + the taxonomy's own description line. Rendered per style register (inked mark / rubber stamp / classification line / penciled annotation). |
| Graded date | `graded` | Fine print under the grade |
| **Axis verdicts** | `annotations` × taxonomy `axes` | One entry per axis IN TAXONOMY ORDER: axis label, value label, the annotator's `note` beneath/after when present. Skipped axes render muted as `— · NOT ASSESSED`. Unknown/new axes still render. |
| Grade history | `grade_history` | If non-empty: the old grade visibly superseded (struck through / stamped over / prior-term column, per style) with its date — regrades are part of the record, not hidden. Omit entirely when empty (the common case). |
| Provenance notes | `notes` | The chain-of-custody line: "generated via clean-context subagent…", ink-check results, viewBox normalization disclosures. Shown small. |
| Download | `url` | `DOWNLOAD SVG ⤓` (byte-exact as generated) |
| Transcript | `transcript_url` | Almost always null today; when present, a `TRANSCRIPT →` affordance. Layout must not reserve visible space for the null case. |

**Not shown** (exists in data, deliberately off the card): `schema`,
`rid` (internal), `sizeClass`/`sizeScale` (curatorial mechanics, not
eval data), `model_version` (redundant with model today).

## 3. The five styles

All five are the same record — same data (§2), same behaviors (§1) —
in five period costumes. Shared ground: aged-paper palettes compatible
with the container (`--paper #f6f3ec`, `--slip-paper #efe3c2`,
`--plot-red #b22222`, warm browns), Courier Prime as the mono, no
webfont downloads (system stacks only), and the artwork itself is NEVER
restyled. Paper textures may use feTurbulence — if so,
`stitchTiles="stitch"` always (the standing Safari lesson).

### A · THE REPORT CARD — vintage school report of progress

The model is the pupil; the axes are the subjects; the curator is the
teacher. Register: a letterpress-printed public-school report card,
roughly 1900s–1930s.

- **Stock & chrome**: aged manila-cream card, double hairline border
  with squared corners, letterpress-printed form matter in a faded
  blue-black ink. Optional subtle paper grain; fold crease down the
  middle is a nice touch if cheap.
- **Masthead**: "THE JUNK DRAWER" small, over "REPORT OF PROGRESS" in
  tall condensed letterspaced serif caps (system serif + spacing), rule
  beneath. Printed fill-in lines: `PUPIL:` the model label + vendor ·
  `TERM:` the response date · `ENROLLED:` item created date ·
  `ATTENDANCE:` "1 session (one-shot)" / "N sessions (refined)".
- **THE ASSIGNMENT**: a ruled block quoting the verbatim prompt (mono,
  quoted) — the essay topic pasted into the card. This is the item-level
  constant; it sits above the subjects so it reads before the marks.
- **The subjects table**: printed rows, one per axis — SUBJECT (axis
  label, printed small caps) · MARK (the value label hand-inked in red
  pencil, slight rotation/jitter so no two marks sit identically) ·
  REMARKS (the annotator note, same hand, smaller). Skipped axis: the
  MARK cell gets a muted typed `— · NOT ASSESSED`.
- **Foot**: `GENERAL AVERAGE` row — the overall grade hand-inked LARGE
  in red pencil with a double underline, the taxonomy description
  printed in fine print beside it, graded date beneath. Then a printed
  promotion line ("Promoted to the Drawer.") and a `Curator` signature
  rule with an illegible scrawl (SVG path, not a font).
- **Grade history**: the old mark struck through in the same red pencil
  with the new mark inked beside it — teacher's correction.
- **Alternatives strip caption**: `OTHER PUPILS, SAME ASSIGNMENT`.
- **Provenance notes**: fine print along the card's bottom edge.
- **Natural name: REPORT CARD.**

### B · THE ACCESSION CARD — the museum registrar's object card

The drawer as a museum's storage; the record as the registrar's
paperwork. Distinct from E: B is a *printed form with fields filled
in*; E is *freeform bibliographic typing by convention*.

- **Stock & chrome**: buff index card, pale-blue horizontal feint
  rules, ONE red vertical margin rule at left (classic registrar
  stock), printed field labels in tiny letterpress small caps with
  dotted fill-in rules.
- **Fields, typed in Courier on the rules**: `ACCESSION NO.` the item
  id (this style's flourish — promoted to the top line) · `OBJECT`
  title · `MAKER` model + vendor · `RECEIVED` response date ·
  `METHOD` ONE-SHOT / REFINED ×N · `CONDITION` the axis verdicts as
  terse typed entries, one per line: "geometry — minor defects; small
  misalignments…" (note run-on after an em dash). Skipped: "— not
  assessed" typed muted.
- **Grade**: a red rubber stamp, slightly rotated, ink unevenness
  (the mockup-3 stamp technique with a rubber-stamp register rather
  than pencil), graded date typed beneath.
- **The flip**: the verbatim prompt is typed on the CARD'S REVERSE
  ("VERBATIM PROMPT" heading, mono) — a 3D card flip, triggered by a
  dog-eared corner / typed `OVER →` at bottom-right. Where a
  cataloguer would actually put it.
- **Grade history**: typewriter correction — the old grade struck with
  a row of `xxxx` overtypes, the new stamp beside/over it.
- **Alternatives strip caption**: `RELATED ACCESSIONS, SAME PROMPT`.
- **Provenance notes**: `REMARKS` block, small type at the foot.
- **Natural name: ACCESSION RECORD.**

### C · THE CONDITION REPORT — the auction catalogue page

A page from a 19th-century sale catalogue; the rubric recast as the
art world's own annotation taxonomy — the condition report. The
furthest costume (serif, engraved), and the most quodlibet-literal.

- **Stock & chrome**: cream laid paper (subtle horizontal laid-line
  texture), engraved double hairline border, a small fleuron centered
  at the head. Generous margins; this one is a PAGE, not a card.
- **Type**: old-style system serif stack (Iowan Old Style, Palatino,
  Georgia); mono appears ONLY in the verbatim prompt block.
- **Layout, top to bottom**: `LOT 7.` centered small caps (lot number
  derived from the item's position — mockup may hardcode) · title in
  italics · a provenance line in prose ("Drawn by Claude Opus 5, the
  27th of July 2026, at one asking; unretouched.") · the prompt as the
  quoted catalogue description (mono block inside the serif page,
  hairline-ruled above and below) · **CONDITION** section — each axis a
  run-in sentence fragment in prose: "*Geometry*: minor defects — small
  misalignments visible on inspection. *Colour*: clean." Skipped axes:
  "*Composition*: not assessed." · classification line in letterspaced
  small caps: `CLASSIFICATION — SELECT.` with the taxonomy description
  following in prose, graded date in fine italics.
- **Grade history**: "(Reclassified from CHOICE, 27 July 2026.)" in
  italics after the classification — catalogue-corrigenda voice.
- **Alternatives strip caption**: `THE SAME SUBJECT, BY OTHER HANDS`.
- **Provenance notes**: a footnote at the page foot, asterisked from
  the provenance line.
- **Natural name: CONDITION REPORT.**

### D · THE PAPERWORK — the manila evidence wrapper

The item tag's big sibling; maximum continuity with what ships. The
record IS the tag's file.

- **Stock & chrome**: a manila folder in the tag's exact palette
  (`--slip-paper #efe3c2`, `--slip-ink`, `--slip-line`), tab along the
  top edge carrying a typed pasted-on label (the title), grommet at
  the tab corner — the red elastic that tied item→tag now runs
  item→folder. A string-and-button closure (figure-eight wind) that
  visibly unwinds in the opening animation.
- **Open state**: the folder lies open across the card zone; contents
  are DISTINCT SHEETS, staggered like real folder contents:
  - the **PROMPT sheet** — near-white paper, mono, the verbatim prompt,
    held by a paperclip (CSS/SVG);
  - the **RUBRIC sheet** — ruled paper: axis rows with verdicts and
    notes, the overall grade as a big diagonal red rubber stamp across
    the sheet's lower half, taxonomy description typed beneath;
  - the **inside cover** — `RECEIVED` date stamp, typed provenance
    notes, MAKER/METHOD/dates typed as a small block.
  Sheets can be brought forward by clicking their peeking edges (or
  simply stacked with enough offset that all read at once — mockup's
  call; favor legible-at-once).
- **Grade history**: the old stamp part-visible beneath the new one,
  offset and faded — restamped paperwork.
- **Alternatives strip caption**: `ALSO IN THE FILE`.
- **Natural name: THE PAPERWORK.**

### E · THE CATALOG CARD — the Library of Congress card

Catalog cards live in drawers; this record was always going to end up
here. Model as author, prompt as title statement, alternatives as the
cards filed behind. Bibliographic conventions worn with a straight
face.

- **Stock & chrome**: cream 3×5 card (7.5×12.5 ratio), lightly foxed,
  and the **punched rod hole** at bottom center (shaded ring with an
  inner shadow — the drawer rod goes through it; do not skip this, it
  is the signature). The card sits slightly proud of a few NEIGHBORING
  CARD EDGES visible behind it (top edges peeking a few px) — the
  catalog drawer implied, never built.
- **Type**: Courier Prime throughout — the typewriter IS the site
  font. Classic layout grammar: hanging indents, the author heading's
  surname element in caps.
- **Layout**: penciled call number top-left, two stacked lines (derive
  from the id, e.g. `JD-27` / `.R38`) · **main entry heading** — the
  model as author: `CLAUDE OPUS 5, artist.` · **title statement** with
  hanging indent — the verbatim prompt as the title, wrapped, followed
  by ` / drawn by Claude Opus 5.` · imprint line: `[s.l.] : Anthropic,
  2026.` · collation: `1 art reproduction : SVG, col.` · typed notes
  paragraph: generation method ("One-shot; single prompt."), the
  provenance/ink-check note · **tracings** at the foot, numbered per
  convention: `1. Subway rats—Caricatures and cartoons. 2. One-shot
  generation. I. Anthropic. II. Series: the junk drawer.` (playful but
  correctly formatted; derive subject words from title/tags).
- **Grade**: the librarian's pencil — the grade label hand-penciled and
  circled at top-right, graded date small beneath; the taxonomy
  description typed as the last note. Axis verdicts: a typed
  `Condition:` note line — "geometry, minor; colour, clean;
  composition, clean." (E compresses the rubric hardest; that's honest
  to the genre. Skipped: "composition, not assessed.")
- **Grade history**: pencil erasure ghost — the old circled grade
  faint/smudged beneath the new one.
- **Alternatives**: the strip is THE DRAWER — each other response is
  another card filed behind (its author heading visible on the peeking
  top edge); flipping riffles the next card forward with a small
  paper-shuffle transition. Caption (typed on a guide-card tab):
  `FILED UNDER THE SAME TITLE`.
- **Natural name: CATALOG CARD.**

## 4. The mockups — five files, one per style

Five standalone siblings, built in parallel (one agent per style),
viewable from `file://` and committable for on-device review like
mockups 2/3/5/6. **This section is the build contract for each.**

**Files** (in `art/junk-drawer/mockups/`):

- `mockup-7a-report-card.html` — §3 A
- `mockup-7b-accession-card.html` — §3 B
- `mockup-7c-condition-report.html` — §3 C
- `mockup-7d-dossier.html` — §3 D
- `mockup-7e-catalog-card.html` — §3 E

**Shared spec, all five:**

- **Standalone**: inline CSS/JS/SVG only; no PHP, no fetch, no
  webfonts, no external requests; works from `file://`. Sibling
  conventions from mockup-3: `.mock-label` line top and bottom, a
  `.mock-caption` explainer block at the foot.
- **The stage (simplified — do NOT rebuild the drawer)**: a full-height
  warm dark backdrop standing in for the dimmed drawer (radial warm
  brown + vignette, ~40% dark scrim feel). Desktop (>768px): lifted
  item SVG left at ~55% width with a long soft drop shadow ("held above
  the drawer"), the record right (max-width ~420–460px; C may run
  wider, it's a page). The record's entrance animation plays on load
  and on item switch.
- **Mobile (≤768px)**: the PLAN-MOBILE bottom sheet — lifted SVG in the
  top ~45svh; sheet opens at **peek** (drag handle, title, model +
  process chips, overall grade in the style's register, alternatives
  strip) and expands to **full** (adds prompt + full rubric +
  provenance, inner scroll region `overflow-y:auto;
  overscroll-behavior:contain`). Tapping the handle toggles detents;
  drag is optional in the mockup.
- **Baked data — real entries, verbatim** from `items/` (no fetch):
  - `2026-07-27-subway-rat` — 3 responses (opus/fable/sonnet), the
    flip-through and rubric workout; primary r1;
  - `2026-07-27-hairball` — 1 response, exercises the no-alternatives
    state (the strip collapses/absents gracefully).
  A small mono item-switcher above the caption toggles the two.
  Taxonomy data baked verbatim from `taxonomy.json` (grades, axes,
  models) — every rubric string renders from it, nothing hardcoded.
- **Synthetic overlays, exactly two, disclosed in the caption** (no
  real entry has these states yet): (1) graft onto subway-rat r1 a
  `grade_history` entry `{grade:"choice", date:"2026-07-27",
  taxonomy_version:4, note:"mock — for layout"}` so supersession
  renders; (2) treat subway-rat r3's `color` axis as skipped so
  `— · NOT ASSESSED` renders. Both stated plainly in `.mock-caption`,
  never inside the record itself.
- **SVG hygiene**: the item SVGs are inlined and more than one shares
  the page — prefix every `id` and every `url(#…)`/`href` reference
  per response (`o_`, `f_`, `s_`, `h_`) exactly as the rating
  instrument does. Strip any XML prolog. Never alter the artwork.
- **Flip-through**: switching responses swaps the lifted SVG in place
  (same box, same scale) and re-renders the record's per-response
  fields; the prompt block never changes. The strip marks the shown
  response; on hairball the strip is absent.
- **Texture rules**: any feTurbulence carries
  `stitchTiles="stitch"`; no full-stage blend-mode layers; textures
  eyeballed against the Safari lessons in PLAN-FRONTEND.
- **Sibling nav**: a small mono nav row (top of the caption area)
  linking the five mockup-7 files by style letter + natural name, the
  current one marked — the owner browses the five in sequence.
- **Self-verification before done**: render with headless Chrome
  (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  `--headless --screenshot=… --window-size=…`) at 1280×900 (desktop,
  record open) and 390×844 (mobile: peek AND full — drive states via
  a `?mock-state=peek|full` query param honored by the mockup JS),
  inspect the screenshots, iterate until layout is clean. Screenshots
  go to the session scratchpad, not the repo.
- **No git operations** — files land uncommitted; the owner reviews
  first.

**What the mockups decide** (owner gates):

- **G6 — the style**: A/B/C/D/E, or a hybrid directive ("A's paper,
  D's entrance").
- **G7 — the name**: usually falls out of G6; can be overridden (a
  style can win while its name loses).
- Small calls surfaced by looking: B's card-flip yes/no, whether
  DOWNLOAD leaves the tag, whether provenance notes read at phone
  size, E's rubric compression (typed condition line vs. a second
  card).

## 5. After the mockup (production, for scale)

Not this build, sketched for continuity: the winning skin promotes into
`index.php`/`junk-drawer.css`/`junk-drawer.js` the way mockup-2 did —
record markup built by JS from the already-fetched payload (zero extra
requests on open; alternatives' SVGs fetch lazily on first flip),
`pushState`/`popstate` wiring, `item_open` events, inventory lines
become links, and the tag's button gets its real name. The mockup's
skin CSS ports nearly verbatim; the baked entries are replaced by the
live payload. Then the /art index card + OG image (the drawer itself),
per PLAN-FRONTEND Phase 3.
