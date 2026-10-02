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
  `jd2_display_session`, `jd2_is_complete`, `jd2_derive_pairs`, the pool.
- `jd2-generate`, `jd2-title`, `jd2-rate`, `jd2-curate` and `jd2-gen-svg`:
  the writers, the titler and the SVG server.
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
"done" while v1 is frozen.

**Owner tools:**

- `ledger.html`: one row per prompt on `jd2-ledger`. Its SAVE files a new
  owner session.
- `scripts/jd2-batch-run.php`: the CSV batch runner.
- `scripts/jd2-export.py`: JSONL, plus standing and pairs CSVs.
- `sizing-desk.html` is a v1 tool (it exports `entry.json` size edits) and
  is not re-pointed. v2 sizes are prompt columns (`size_class`,
  `size_scale`) filed by the turn card's size card or through `jd2-curate`.

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
   [--resume]`. The CSV columns are `prompt`, `title`, `size`, `category`,
   `v1_item_id`, `rerun_of`. Owner runs use the `bench` profile: every model
   at its vendor's top setting, one model per request. The prompt files as
   `draft`. The owner then rates it on the bench, and the first complete
   owner session makes it `live`. A rerun is a new run of the same prompt
   (`rerun_of`). The drawer shows `shown_run_id`, else the newest run with a
   complete display session.
2. **Visitors.** TAKE A TURN (`jd-turn.js`) draws through `jd2-generate` on
   the `web` profile, behind consent (`JD_CONSENT_VERSION`). The visitor
   rates on the same card, and a complete visitor session makes the prompt
   live unless they kept it out. Visitors get one session per run; the owner
   gets unlimited sessions.

The bench and the visitor card are ONE instrument (`JD_turn.curate`). A
layout or behaviour change to the rating flow is made once, in the shared
card, and never forked into a bench-only copy.

## How ratings work

- **A session is one sitting** of one rater over one run. It carries a grade
  and every live axis per drawing, a strict ranking (with optional gaps
  0..3), and pairs. Each session is stamped with its role, taxonomy version,
  instrument version, `blind`, `seat_order` and an optional `note`.
- **Sessions are append-only.** A re-rating, the admin editor and the ledger's
  SAVE all file a NEW session. Nothing is deleted or replaced.
- **Current** = the latest filed session per (run, role). **Display** = the
  owner's current session if it is complete, else the visitor's current
  session if that is complete. Owner and visitor are separate populations,
  reported separately and never averaged together.
- **Pairs** are −3..+3, positive = `gen_a` (canonical order, by slot). They
  are `direct` when the card asks them (the side-by-side head-to-head cards)
  or `derived` (`spaced-rank-v1`) from the ranking plus gaps. One session
  uses one method or the other.
- **Complete** = every ok, unhidden drawing has a grade and every live axis,
  the ranking places them all, and every pair has a score. Completeness is
  computed from the taxonomy at the session's version, never from a constant.
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
  of completeness.
- **`comparison`** is the 7-point head-to-head scale (+3 = the first much
  better). **`gaps`** is the 0..3 margin between adjacent places. Every
  instrument renders both from the file.
- **The pool is data.** A model with `pool: true`, `provider` and
  `api_model` is in the pool, and `poolVersion` names the snapshot that every
  run records. To refresh the pool: verify the wire ids and prices, add
  `api/jd-prices.json` rows, bump `poolVersion`, and bump the consent version
  if the provider list changes (privacy.php §4 must match).
- Every edit adds a `changelog` line and bumps `version`. Sessions stamp the
  version; `instrument` (`v2.0`) changes only when the rules of a sitting
  change.

## Keys

- The bench key is `jd_bench_key` (falling back to `jd_setup_key`) in the
  server's `private_config/secrets.php`. Requests send it as `X-Bench-Key`.
  The page asks once per device (`JD_admin`). Wrong keys are throttled.
- Scripts read it from the environment as `JD_BENCH_KEY`. The deploy reads
  `JD_SETUP_KEY` from a repo secret.
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
- `php scripts/test-jd2-flow.php`: generate, rate and curate, plus
  `data.php`.
- `php scripts/test-jd2-reads.php`: queue, ledger, analytics, export, batch
  runner.
- `node scripts/test-jd2-card.js`: the turn card in Playwright, against the
  local server above.
- `node scripts/test-jd2-bench.js`: the bench in Playwright. It starts its
  own `php -S`.
- `php scripts/test-jd-sanitizer.php`: the sanitizer fixtures.
- `python3 scripts/validate-junk-drawer.py`: the v1 archive in `legacy/items/`.

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
