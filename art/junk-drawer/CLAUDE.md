# CLAUDE.md — The Junk Drawer, dataset v2 (operating manual)

The drawer at `/art/junk-drawer/` is a running eval of how language models
draw SVGs: one prompt goes to every model in the pool, the drawings are graded
blind on the taxonomy, ranked, and compared head to head. This file is written
for a Claude Code session with ZERO prior context. Read it whole before
touching anything here.

Since the cutover on **2026-10-01** this is **dataset v2**: the database is the
system of record and files are exports. Dataset v1 (2026-07-26 → 2026-10-01)
is frozen. It stays on view, read-only, at `/art/junk-drawer/legacy/`, and its
archive is described in `db/junk-drawer-v1-archive.md`. The two datasets are
never pooled.

Design and history: `PLAN-V2.md` (gitignored, owner's checkout only; the
other `PLAN-*.md` files these comments cite are gitignored too, so treat those
citations as history, not links). Tables, endpoints and reader rules:
`db/junk-drawer-v2-schema.md`. That doc is the contract; this file is the map.

## File map

**The page** (`index.php`, `_assets.php`, `_scripts.php`, `_stage.php`,
`_slim.php`, `_version.php`, `junk-drawer.css`, `VERSION`). The script is
SEVEN files, loaded in order by `_scripts.php`. They are IIFEs talking through
`window.JD_*`, with no build step:

- `jd-core.js`: constants and shared helpers, the pile loader, drag, the
  draw-on engine, `JD_admin` (the key gate), `JD_track`.
- `jd-filmstrip.js`: the replay/scrub control under a drawing.
- `jd-furniture.js`: the turn object, the instructions sheet, the analytics
  folder.
- `jd-record.js`: the report card and its admin editor.
- `jd-darkroom.js`: the wait indicators.
- `jd-turn.js`: the turn modal (visitor turns) and curate mode (the bench).
- `jd-bench.js`: the `?bench` / `?admin` strip.

`card-gallery.html` loads the same seven against mocked fetches.
`about/` is the walkthrough page (`about/COPY.md` has its copy).

**Data:**

- `data.php` reads the `jd2_*` tables and nothing else: live prompts → the
  shown run → its ok, unhidden drawings → the display session. An item's `id`
  is the prompt id (a ULID). Modes: `?item=<id>` and `?slim=1`.
- `taxonomy.json` is the rubric as data (below).

**API (`api/`):**

- `jd2-config.php`: word lists, `jd2_current_session`,
  `jd2_display_session`, `jd2_is_complete`, `jd2_derive_pairs`, the pool,
  and the set-based reads data.php and `jd2-analytics` use (a fixed number of
  queries, never one per prompt or run): `jd2_runs_for_prompts`,
  `jd2_current_sessions_for_runs`, `jd2_standings_for_sessions`,
  `jd2_display_pick`.
- `jd2-generate`, `jd2-intake`, `jd2-rate`, `jd2-curate` and `jd2-gen-svg`:
  the writers, the intake clerk and the SVG server. `jd2-intake-prompt.php`
  (include-only) holds the clerk's system prompt, schema, call and mock;
  `php api/jd2-intake-prompt.php --print` prints exactly what is sent.
- `jd2-queue` (the bench), `jd2-ledger` (the ledger) and `jd2-analytics`
  (public: the about page's charts plus `pairs` and `margins`, with
  `?origin=owner|visitor`).
- Shared with v1 and still live: `jd-config.php` (taxonomy accessors, the
  key gate, `JD_V1_FROZEN`), `jd-provider.php`, `jd-mock-provider.php`,
  `jd-svg-sanitizer.php`, `jd-usage.php`, `jd-prices.json`,
  `jd-origin.php` and `jd-admin-check.php`. The v1 `jd-*.php` writers answer
  410 (`JD_V1_FROZEN = true`). The v1 readers serve only `legacy/`.

**Runners:** `api/setup-jd2-tables.php` (v2 DDL, idempotent, both dialects)
and `api/setup-jd-tables.php` (v1). `api/jd-backfill-curated.php` answers
"done" while v1 is frozen. `api/jd2-resanitize.php` re-checks rejected
drawings after a sanitizer change (below). `api/jd2-reset.php` was the
one-shot pre-campaign reset; it ran on 2026-10-03 and is now a stub that
answers 410 (the Never list says why).

**Owner tools:**

- `ledger.html`: one row per prompt on `jd2-ledger`. Its SAVE files a new
  owner session.
- `scripts/jd2-batch-run.php`: the CSV batch runner.
- `scripts/jd2-export.py`: JSONL, plus standing and pairs CSVs.
- `scripts/jd2-intake-check.php`: the intake clerk against the owner's 67
  v1 sizes (confusion matrix, agreement, cost). Mock by default;
  `JD_INTAKE_LIVE=1` spends real money and is the owner's to run.
- `sizing-desk.html` is a v1 tool (it exports `entry.json` size edits) and
  is not re-pointed. v2 sizes are prompt columns (`size_class`,
  `size_scale`, `size_by`): the intake clerk files one the moment a prompt is
  filed (`size_by` `model`); the bench's catalogue entry card and the ledger
  file the owner's through `jd2-curate` (`owner`), which the clerk never
  overwrites; a visitor's turn shows the plain size card only when intake
  failed (`visitor`). See "The bench's closing card" below.

**v1, kept:**

- `legacy/`: the frozen exhibit, with its own `data.php`, `taxonomy.json`,
  module copies and `items/`. See `legacy/README-LEGACY.md`.
- `items/`: the v1 files, still at their old paths for links and the social
  renders (`scripts/render-jd-social*.py`). Nothing in v2 reads them.
- `scripts/export-jd-evals.py`, `scripts/jd-v1-*.py`: the v1 export and
  archive. `scripts/validate-junk-drawer.py` checks `legacy/items/` against
  the live taxonomy. `scripts/jd-spend.php` is v1-only.

## How items enter

There are two ways in. Nothing enters by file.

1. **The owner.** Use the bench's NEW PROMPT (`?bench`; `?bench&prompt=<id>`
   seats one prompt), or the CSV batch runner:
   `JD_BENCH_KEY=… php scripts/jd2-batch-run.php prompts.csv [--dry-run]
   [--resume] [--profile …]`. The CSV columns are `prompt`, `title`,
   `size`, `category`, `v1_item_id`, `rerun_of`. Owner runs use an owner
   effort profile (below), one model per request. The prompt files as
   `draft`. The owner then rates it on the bench, and the first complete
   owner session makes it `live`. A rerun is a new run of the same prompt
   (`rerun_of`). The drawer shows `shown_run_id`, else the newest run with a
   complete display session.
2. **Visitors.** TAKE A TURN (`jd-turn.js`) draws through `jd2-generate` on
   the `web` profile, behind consent (`JD_CONSENT_VERSION`). The visitor
   rates on the same card, and a complete visitor session makes the prompt
   live unless they kept it out. Visitors get one session per run; the owner
   gets unlimited sessions.

**Owner effort profiles (2026-10-02).** `bench-medium` (the default, owner's
call: medium thinking), `bench-low` and `bench-max` set every vendor's
low / medium / top thinking rung, each with a 64000-token budget (thinking
counts against it) and its own harness id; the table is in
`db/junk-drawer-v2-schema.md`. The wire word `bench` means the default, so
the bench page follows it. The batch runner takes `--profile` (state keyed
by profile and text), and a row whose text an owner prompt already has is
filed as a RERUN of that prompt, so three settings make three runs of one
prompt. `scripts/jd2-profile-probe.php` (`JD_PROFILE_LIVE=1`) checks that
every model finishes an SVG under every profile (`--prompt "…"` for a real
prompt, `--save DIR` to keep each served drawing and raw reply).

**The drawing system prompt is the owner's text (harness v5, 2026-10-03).**
`JD_SYSTEM_PROMPT` in `api/jd-config.php` is, byte for byte, the fenced block
in `PLAN-DRAWING-PROMPT.md` §2 (gitignored; main checkout), whose change log
gives the reason for every sentence. Agents propose wording there; the owner
settles it; only then do the bytes move, with the diff check in the comment
above the heredoc proving the two identical. Any byte change bumps EVERY
harness id (`v5-web.1`, `v5-benchlow.1`, `v5-benchmed.1`, `v5-bench.1`
today); runs under v4-* and v5-* are never pooled.

**The sanitizer (`api/jd-svg-sanitizer.php`; rules changed 2026-10-02,
2026-10-03).** It still rejects rather than repairs, with two named
exceptions. The first: a CDATA
section (Kimi K3 wrapped its `<style>` CSS in one, and the drawing was thrown
away as `element_not_allowed`) is unwrapped into an ordinary text node before
any rule runs, so its bytes meet the same checks as any other text, and the
drawing is then re-serialized and re-checked. The change is recorded, not
hidden: `jd2_generations.normalized` = `cdata_unwrapped`. The second
(harness v5): every `<title>` and `<desc>` is stripped from the served svg —
a model's own caption shows as a hover tooltip on the inlined drawing, a
self-caption or signature leaking to the rater — AFTER every rule has
passed on the whole document (a payload inside one still rejects as
before), recorded as `title_desc_stripped` (both words comma-joined when
both apply); `raw_response` keeps the model's text. Processing
instructions and comments inside `<style>`/`<title>` stay rejected, and the
14 reason strings are frozen. After a sanitizer change, recover the drawings
the old rules rejected with `api/jd2-resanitize.php` (`?key=<jd_setup_key>`
on production; `?dry-run=1`, or `--dry-run` on the CLI, lists first): it
re-sanitizes every rejected row's `raw_response`, flips the ones that now
pass to `ok`, and re-settles their runs. A recovered drawing is unrated, so
a sitting already filed over its run reads incomplete until it is rated.
After a NEW normalization, re-serve the drawings already filed `ok` with
`?recheck=ok` (CLI `--recheck=ok`): a dry run unless `&apply=1` (`--apply`);
it rewrites only `svg` and `normalized` where they differ, never demotes an
ok row the rules would now reject (it reports it), and leaves sittings
complete (the drawing's id does not change).

**Inlining (2026-10-02).** Drawings are inlined through DOMParser/importNode,
never innerHTML — the XML verdict and the DOM must agree (`svgParse`,
`JD_svgSlot`/`JD_svgMount` and `JD_svgNode` in `jd-core.js`; `ledger.html`
and `sizing-desk.html` keep their own copy of `svgParse`).

The bench and the visitor card are ONE instrument (`JD_turn.curate`). A
layout or behaviour change to the rating flow is made once, in the shared
card, and never forked into a bench-only copy.

**The head-to-head instrument is the pedestal card** (since 0.12.0, owner
2026-10-02; design source `mockups/mockup-50-pedestal-margins.html`). After
the podium, one card ("by how much", the `gaps` step in `jd-turn.js`) asks
each adjacent pair how much better the higher place is: the visitor ticks
one of four words or raises the pedestal. It files a `gap` 0..3 on every
place of the ranking but the last, with `pairs: null`, and `jd2-rate`
derives all the pair scores. Visitors and the bench both get it. The six
side-by-side cards survive only as the bench's **audit**: `?bench&pairs=1`
(or `?bench&prompt=<id>&pairs=1`) skips the pedestal card, runs the six
cards, and files direct pairs with a ranking that carries no gaps. One
sitting never runs both. The bench prefills the gaps from the owner's last
sitting (`jd2-queue` `prefill.gap_after`); `JD_turn.pedestal.answer()` /
`.restore(ranking)` are the card's contract hooks.

**The bench's closing card is THE CATALOGUE ENTRY** (0.13.0, owner
2026-10-02; `entryPanel` and THE CATALOGUE ENTRY in `jd-turn.js`, wired by
`jd-bench.js`). After the pedestal card the bench shows what the intake clerk
filed for the prompt and lets the owner correct every part: the HEADING (the
prompt's title, a text field; the inverted catalogue form is expected, not
enforced), the SIZE (the five-tier chooser, pre-selected on the tier on file),
and the HEADINGS per facet as chips (a tap files or unfiles one; each facet's
`min`/`max` holds — the last subject cannot come off; each heading's `scope`
note is its tooltip, its long-press text on a phone, and the line under its
facet). The clerk's two reasons are small print; the footnote is the intake
version and model, or "intake failed (code)". The "notes for the record"
textarea stays on it. Its rail station is the size's (the step id stays
`size` in the code). Only a curate job carrying `catalogue` gets it: visitors
never see it (their size card still shows only when intake failed), nor does
the /about/ walkthrough.

What files where: the card hands the job's `file()` its entry; the bench
sends `jd2-curate` ONLY the fields that differ from the record — `title`
(trimmed, when it differs; an emptied field keeps the one on file),
`size_class`, `tags` (when a chip was touched and the sets differ) — in one
body, so one transaction, and FIRST; then the sitting goes to `jd2-rate`,
which on the bench no longer carries `size` or `title`. Curate first because
it only sets columns (a retry is harmless) while a sitting is append-only (a
retry after a failed entry would file a second sitting). A failure says which
half stood: "The catalogue entry didn't file" (nothing filed), or the grades
failed with the entry on file (a refile sends only what is missing).
**`size_by` on the bench:** pressing a tier — the clerk's own pre-selected one
included — makes the size the owner's (`size_by` `owner`); filing without
pressing leaves it as it stands (the clerk's stays `model`). A reopen
(`?bench&prompt=<id>`) reads the queue, so it shows the owner's edits. The
NEW PROMPT form lost its size select (the clerk sizes every new prompt; this
card is where the owner confirms or changes it), so intake now runs on every
new prompt.

**Every sitting opens on THE PREVIEW** (0.15.0, owner 2026-10-03;
`previewPanel` and ALL FOUR in `jd-turn.js`). Before the first question one
card shows every drawing that came back, together, in the darkroom's 2×2
(the loading cards, developed): the seats in their dealt order (the bench's
blind shuffle, a visitor's darkroom slots), each print on the card's plate
with its blind letter pencilled over it the head-to-head way, and each print
the card's existing enlarge control (`plate()` with `zoom`, so click and
Enter both open `openZoom`; no second lightbox). It files nothing and asks
nothing: its step id is `preview`, its rail station the first ("all four",
"all three", "both"; the 2×2 mark), its one control the usual next. A run
short of four leaves the remaining cells empty; where a visitor's machine
failed, the empty cell says "didn't survive", the results card's words. Visitors and the
bench both get it (one instrument). A bench resume (`?bench&prompt=<id>`)
opens on it too, since it is a glance and not a question; `curateOpen` keeps
the step it would have opened as `work.resume`, and the preview's next goes
there (`previewDest`). A one-drawing turn has no rail and no preview. The
/about/ walkthrough's card opens on it as well.

**Re-rating** (0.17.0, owner 2026-10-03). The mechanism is direct
addressing: `?bench&prompt=<id>` seats one prompt in any state with the
owner's last sitting as the prefill (grades, axes, places and the pedestal's
gaps — `jd2-queue`'s `prefill`), and filing appends a NEW owner sitting,
which then becomes the display session; nothing is replaced. There are three
ways in, all landing on that same path: the bench strip's **RATED** sheet
(`?bench` only; `ratedList` in `jd-bench.js`) lists every prompt whose bench
run has a complete owner sitting (`jd2-queue?all=1`, `complete`, not
hidden), newest sitting first by the item's `filed_at`, and its RE-RATE
button calls `rerate()` (`fetchOne` + `openItem`, the address rewritten to
`?bench&prompt=<id>` so a reload comes back to it); the report card's
**"re-rate on the bench →"** (`rerateOn`/`rerateOnBench` in `jd-record.js`),
shown only on the bench page with the key verified — never on the plain
drawer, never in `?admin` (its card has the editor), never for visitors —
closes the record and calls `JD_bench.rerate`; and the ledger's RE-RATE link,
a plain `?bench&prompt=` URL. A seated prompt whose owner sitting is
complete carries `rerating` on its curate job, and the preview's
instruction line then adds "Your last sitting's answers are on the card;
change what you like — filing adds a new sitting." A first sitting reads as
before.

## How ratings work

- **What is rated is what is served.** The drawing served is the sanitized
  one (`svg`); `raw_response` is byte-exact model output; `normalized` names
  what the sanitizer changed between them (NULL: nothing, byte-identical).
- **A session is one sitting** of one rater over one run. It carries a grade
  and every live axis per drawing, a strict ranking (with optional gaps
  0..3), and pairs. Each session is stamped with its role, taxonomy version,
  instrument version, `required_cells` (the live axis ids + `grade` its
  rubric asked for, JSON, since v35), `blind`, `seat_order` and an optional
  `note`.
- **Sessions are append-only.** A re-rating, the admin editor and the ledger's
  SAVE all file a NEW session. Nothing is deleted or replaced. The admin
  editor and the ledger refuse to save over a VISITOR's sitting (data.php's
  `display_role`) and point at the bench: a visitor's ranking and pairs are
  never re-filed as the owner's.
- **Current** = the latest filed session per (run, role). **Display** = the
  owner's current session if it is complete, else the visitor's current
  session if that is complete. Owner and visitor are separate populations,
  reported separately and never averaged together.
- **Pairs** are −3..+3, positive = `gen_a` (canonical order, by slot). They
  are `derived` (`spaced-rank-v1`) from the ranking plus gaps when the
  pedestal card is the instrument (every visitor sitting, and the bench by
  default), or `direct` when the bench's `?pairs=1` audit asks them on the
  side-by-side cards. One session uses one method or the other.
- **Complete** = every ok, unhidden drawing has a grade and every axis the
  sitting's own rubric required, the ranking places them all, and every pair
  has a score. The cells are the session's `required_cells`
  (`jd2_session_cells`; the live axes when a row has none), never a constant
  and never today's taxonomy for a sitting filed under an older one: adding
  an axis asks the NEXT sitting for it and leaves every filed sitting
  complete. The runner backfilled the sittings filed before v35 with the v34
  cells (`JD2_CELLS_BEFORE_V35`, a one-off rule).
- **Hiding.** `jd2-curate` sets `visibility` to `live`, `hidden` or `draft`.
  This is the ONE switch: HIDE FROM DRAWER, the bench's scrap, and the
  ledger all set it. `hidden` on a generation drops a single drawing from
  its run.

## The taxonomy (`taxonomy.json`)

- **Ids are permanent. Labels and descriptions are data.** Grades and axis
  values are filed as numeric `rank`s, so labels can be reworded freely.
  Never rename or delete an id, grade rank or axis id: the v1 archive and
  every v2 session refer to them.
- **Retire, never delete:** set `"defunct": true` on an axis. A defunct axis
  stays for the ratings filed under it, is never asked again, and drops out
  of completeness for new sittings (an older sitting's `required_cells`
  still names it). The bench prefill drops a value on a defunct axis or off
  its axis's current scale (`prefill_pruned`) and the card says so — unless
  the defunct axis names a `successor` (below).
- **A scale change is a new id, not a wording edit** (v17, and v35's
  `structural-coherence` → `structural-coherence-2`): one id always means
  one scale. Labels, descriptions and summaries are free data edits at any
  time (bump `version`, add a changelog line); a different number of points
  is a new axis id with the old one marked defunct. Say so when an owner
  "refinement" would change a scale.
- **The successor rule (v36, owner 2026-10-03): how a scale change honours
  "never overwrite".** When the owner says how the old scale's answers read
  on the new one ("any ratings left where it was rated Small Problem can be
  adjusted to be minor problems"), that is NOT an edit to filed rows: it is
  recorded on the DEFUNCT axis as data, `"successor": {"id": <live axis>,
  "map": {"<old rank>": <new rank>, …}}` — `layering`'s is `{"id":
  "layering-2", "map": {"3": 4, "2": 3, "1": 1}}` (No → No, Small → Minor,
  Big → Major; nothing maps to Moderate). The map is applied at READ time
  only, by `jd2_axis_successors` / `jd2_map_axes` (`api/jd2-config.php`;
  `scripts/jd2-export.py` states the same rule once in Python): the bench
  prefill carries the old answer onto the successor (`jd2q_carry`,
  `prefill_mapped`, and the card's note beside the pruned one); the
  analytics folds the old axis's judgments into the successor's panel
  (`mapped`, `mapped_from` on that `axes[]` entry); data.php serves it on the
  report card under the successor at the mapped rank as `{value,
  mapped_from: {axis, value}}`, and the card marks it "mapped from the
  3-point scale" (`mappedNote` in `jd-record.js`); the export keeps the filed
  `axis_id`/`value` and adds `mapped_axis_id`/`mapped_value` (JSONL) and
  `<axis>_onescale`/`<axis>_mapped_from` (standing CSV). A value filed on the
  successor itself always wins; a rank the map does not name is not carried;
  a defunct axis without `successor` still prunes. Completeness never reads
  the map: an old sitting is complete under its own `required_cells` (which
  name the old axis), and a sitting filed now requires the successor. The
  judgment rows never change — a mapped value becomes a filed one only when
  the owner files a new sitting carrying it. Never "migrate" a scale with an
  UPDATE.
- **The live axes as of v36 (2026-10-03)**, in display order (array order):
  `understanding-assignment` (4), `structural-coherence-2` (4), `layering-2`
  (4), `paintwork` (4), `jnsq` (3). Retired under a new id: `structural-coherence`
  (3-point, v35, no successor) and `layering` (3-point, v36, successor
  `layering-2`). Each issue axis is named by the edit
  that fixes it — redraw / move on x-y / restack or erase / repaint in
  place — and the descriptions carry the boundary rulings (framing is
  Structural Coherence's; an unrequested setting is Layering's, an added
  thing Understanding Assignment's; every cast shadow is Paintwork's).
  Every issue axis is 4-point and reads No / Minor / Moderate / Major
  problems; Je ne sais quoi is the one 3-point axis. `JD_axisCls` gives
  every 4-point axis the `rc-q*` ramp. The analytics folder and the about page chart one panel
  per live axis (`JD_axisRates` + `JD_axisBuckets`, which names each
  panel's two segments from the value labels).
- **`houseRule`** is the drawing system prompt's house rules in one
  rater-facing sentence; the rating card prints it above the axes and the
  report card above its grades table. Display only: no axis reads it, and
  it is not in the intake prompt.
- **`comparison`** is the 7-point head-to-head scale (+3 = the first much
  better; "About the same" at 0), rendered by the `?pairs=1` audit cards.
  **`gaps`** is the 0..3 margin between adjacent places, rendered by the
  pedestal card: each value's `label` is its ballot word (Negligibly better
  / Slightly better / Better / Much better, the owner's) and `short` the
  word its ledger slips pencil in. Gap 0 reads "Negligibly better", never
  "About the same": the ranking already says which place is higher. The
  card renders both from the file and never hard-codes a word.
- **The pool is data.** A model with `pool: true`, `provider` and
  `api_model` is in the pool, and `poolVersion` names the snapshot that every
  run records. To refresh the pool: verify the wire ids and prices, add
  `api/jd-prices.json` rows, bump `poolVersion`, and bump the consent version
  if the provider list changes (privacy.php §4 must match). Then run
  `JD_PROFILE_LIVE=1 php scripts/jd2-profile-probe.php --web` (16 tiny
  calls, every pool model × every profile) and fix any cell that is not a
  clean SVG; a model can refuse a parameter its docs list.
- **The cast as of 2026-10-02 (`pool-2026-10-02b`, taxonomy v33)**: Claude
  Opus 5.5 (`claude-opus-5-5`), GPT-6.1 Sol (`gpt-6.1-sol`; GPT-6.1 Sol stays registered, pool: false), Kimi K3
  (`kimi-k3`) and Gemini 3.1 Pro (`gemini-3.1-pro-preview`), each its
  vendor's current flagship. Verified the same day: wire ids and prices on
  the vendors' own model and pricing pages (the URLs are in
  `jd-prices.json` `_notes`), and all 16 probe cells live (200, the
  vendor's normal stop, a sanitizer-clean SVG). Two things the probe
  taught: Opus 5.5 cannot disable thinking (a 400 at every effort), so
  every profile sends `output_config.effort` and no `thinking` key; and
  GPT-6.1 Sol on Chat Completions accepts `reasoning_effort` up to `xhigh`
  and refuses `max` (400) although its model page lists `max`, so
  `bench-max` sends `xhigh`. Those moved two harness ids: `web` →
  `v4-web.4` (Anthropic effort low instead of thinking disabled; OpenAI
  `reasoning_effort` low instead of nothing), `bench-max` → `v4-bench.5`
  (OpenAI `xhigh` instead of GPT-5.1's top, `high`). The previous cast
  (`pool-2026-08-14`: `claude-opus-5`, `gpt-5-1`, `kimi-k3`,
  `gemini-3-1-pro`) keeps its registry entries with `pool: false`; runs
  record their `pool_version`, so the two casts are never pooled. The
  vendors did not change, so neither did the consent (`jd-consent-6`).
  `JD_MODEL_POOL` in `jd-config.php` is v1 history (read only by the frozen
  `jd-generate.php`) and still names the old cast on purpose.
- **`utility`** names the helper models outside the pool, by use:
  `utility.intake` is the intake clerk `jd2-intake.php` calls
  (`jd2_utility_model`; a taxonomy without it makes intake answer 500).
  `utility.title` (the retired titler) is `defunct`, kept for the record.
- **`facets`** is the intake classification: subject / treatment / probe,
  each with a `question`, `min`, `max` and `headings` (`id`, `label`, a
  thesaurus-style `scope` note). Heading ids are permanent once a prompt is
  filed under them; `jd2_prompts.tags` holds `{facet: [heading id…]}`. A
  heading is retired with `"defunct": true`, never deleted.
- **`sizeTiers[]`** carry the intake prompt's tier words (`description`) and
  `examples` (m's `examplesPhrase` strings them as the prompt reads); both
  render into the prompt's ENTRY 2.
- **`intakeVersion`** (`intake-v1`) names the intake prompt's bytes and is
  stamped on every prompt intake answers. **Bump it whenever those bytes
  change** — the prose in `api/jd2-intake-prompt.php`, a facet, a heading, a
  scope note, a tier description or example — as harness ids are bumped:
  answers under different intake prompts are not pooled. Check with
  `--print` and diff against the owner's PLAN-INTAKE-PROMPT.md §2.
- **No example answer is ever put in the intake prompt.** The structured-
  output schema is the only statement of the answer's shape (each field
  carries a one-line description in the prompt's own words); an example
  would be a second copy that drifts and would pull the model toward its
  own values.
- Every edit adds a `changelog` line and bumps `version`. Sessions stamp the
  version; `instrument` (`v2.0`) changes only when the rules of a sitting
  change.

## Keys

- The bench key is `jd_bench_key` (falling back to `jd_setup_key`) in the
  server's `private_config/secrets.php`. Requests send it as `X-Bench-Key`.
  The page asks once per device (`JD_admin`). Wrong keys are throttled.
- Scripts read it from the environment as `JD_BENCH_KEY`. The deploy reads
  `JD_SETUP_KEY` from a repo secret.
- The intake clerk has its own Anthropic key slot, `jd_intake_key` in
  `private_config/secrets.php` (owner, 2026-10-02), read through
  `jd_provider_key_slot('anthropic', 'intake')`; until it is added the clerk
  falls back to `jd_claude_key` → `claude_key`. `intake_json.key` records
  which SLOT answered (`jd_intake_key` or `jd_claude_key (fallback)`), by
  name only. `api/health.php` reports `intake: true|false` — presence, never
  the value.
- **Keys never go in a file, a commit, argv you print, or a log.** A dev box
  with no `config/secrets.php` runs keyless.

## Deploy

A push to `main` deploys over FTPS (`.github/workflows/deploy.yml`). `**/*.md`,
`scripts/**` and `local-dev/**` are excluded; `legacy/` ships. After the
upload, the workflow runs `setup-jd-tables.php`, then `setup-jd2-tables.php`,
then the backfill (which answers `done` while frozen). Anything else fails
the job. `scripts/push-files.sh` bypasses this step, so run the runner URLs
by hand after a schema change shipped that way (`db/junk-drawer-v2-schema.md`,
Runbook). Never run `scripts/publish.sh` from a worktree.

## Local dev and tests

Set up the dev database with `JD_DEV_MOCK=1 php api/setup-jd-tables.php &&
JD_DEV_MOCK=1 php api/setup-jd2-tables.php`. This uses SQLite at
`local-dev/jd-dev.sqlite` and the mock provider. Serve with
`JD_DEV_MOCK=1 PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8000 router.php`.

The tests are hermetic and refuse production. **Run them ONE AT A TIME.** They
share `local-dev/jd-dev.sqlite`, and the flow and reads tests empty the
`jd2_*` tables first:

- `php scripts/test-jd2-derive.php`: the derivation (no database).
- `php scripts/test-jd2-flow.php`: generate, intake, rate and curate, plus
  `data.php`.
- `php scripts/test-jd2-reads.php`: queue, ledger, analytics, export, batch
  runner.
- `node scripts/test-jd2-card.js`: the turn card in Playwright, against the
  local server above.
- `node scripts/test-jd2-bench.js`: the bench in Playwright. It starts its
  own `php -S`.
- `php scripts/test-jd-sanitizer.php`: the sanitizer fixtures.
- `python3 scripts/validate-junk-drawer.py`: the v1 archive in `legacy/items/`.
- `node scripts/test-jd-legacy.js`: the legacy exhibit is byte-identical to
  `legacy/CHECKSUMS.sha256` and still answers with v1's rubric (its
  `README-LEGACY.md` lists the shared files that can bend it). Run it after
  touching `api/jd-config.php`, `api/jd-analytics.php`, `api/jd-gen-svg.php`,
  `api/jd-usage.php`, `api/page-event-tracking.php`, the site header/footer
  or `css/style.css`.

Always run `php -l` and `node --check` on what you touch.
`scripts/jd-regress/` (the 56-scene byte-for-byte harness) holds v1 captures
and must be re-captured against v2 before it is used again (its README).

## Never

- Never add an item by file. No `entry.json` and no commit-to-add: every
  drawing enters through the pipeline. (A hand-made SVG would need an import
  endpoint, which is not built.)
- Never edit `legacy/`. It is an exhibit, not a codebase (`README-LEGACY.md`).
  Never write to the v1 `jd_*` tables, and never set `JD_V1_FROZEN` back to
  false.
- Never pool v1 and v2. No query joins `jd_*` to `jd2_*`, and `v1_item_id` is
  lineage, not an analysis join.
- Never delete or overwrite a session, judgment, ranking or pair. Re-rating
  files a new session.

  **There was one sanctioned exception, and it is spent.** `api/jd2-reset.php`,
  the pre-campaign reset (owner, 2026-10-03), deleted every `jd2_*` row —
  the trial prompts, runs, drawings and sittings, the Titanic test sitting
  included — once, by the owner, before the campaign's first sitting. It
  ran on production on 2026-10-03 and deleted 310 rows of trial data; the
  record is the line in the server's `private_config/jd2-reset.log`
  (`db/junk-drawer-v2-schema.md`, "Reset"). The file is now a stub that
  answers 410 to every request (exit 1 on the CLI) and touches nothing. It
  is a stub rather than a deleted file because the FTP deploy is not
  counted on to remove server files (`scripts/publish.sh` only uploads; the
  GitHub deploy never deletes a file it has no record of uploading), so a
  file deleted from the repo could stay live; the stub overwrites it. From
  the campaign's first sitting on, the never-delete rule holds with NO
  exception. An agent asked to delete v2 rows — for a reset, a cleanup, a
  test sitting, anything — says no and points here. Never restore the old
  reset code from git history and never copy it into another endpoint.
- Never hard-code a model, axis or label in PHP, SQL or JS. They come from
  `taxonomy.json`.
- Never write servable data as `.md` (the deploy excludes it).
- Never `git add -A`. Stage files by name. Work in a worktree
  (repo `CLAUDE.md`).
- Never reintroduce a rubber stamp to the turn modal. Round 15 built it
  around "stamps are the state machine": a red seal or box stamp standing in
  for RECEIVED, ATTACHED, ACCESSIONED, OVER QUOTA / CLOSED FOR THE DAY,
  RETURNED TO SENDER and NOT FILED. The owner asked for every one removed
  (2026-08-14, `2fbeaf6`), and that is a deliberate reversal, not a
  regression to restore. Each state's meaning survives in prose that was
  already there. `--tstamp`, the plain ink-red accent that outlived them,
  went too (2026-10-01) because nothing read it. The longer note is in
  `junk-drawer.css` above the turn-modal tokens.
