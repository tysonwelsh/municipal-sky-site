# The Junk Drawer — database schema

The tables behind `art/junk-drawer/` (the visitor turn flow and the owner's
rating bench). The authoritative DDL is `api/setup-jd-tables.php`, which is
idempotent and doubles as the migration runner; this file explains what each
table means, who writes it, and the rules readers rely on. It is deploy-excluded
(`**/*.md`), like every other doc in the repo.

Two dialects: MySQL on Bluehost (production) and SQLite for local development
(`JD_DEV_MOCK=1`, file `local-dev/jd-dev.sqlite`). The SQLite DDL is the MySQL
DDL with mechanical substitutions only (ENUM → TEXT CHECK, DATETIME → TEXT,
TINYINT → INTEGER); nothing may rely on a dialect difference.

## Runbook

After **every** deploy that touches `api/setup-jd-tables.php`, run it once:

```
https://municipalsky.com/api/setup-jd-tables.php?key=<jd_setup_key>
```

Each line of its output names a table or migration and says `ok`, `added`,
`already present`, or `FAILED: …`. Re-running is always safe. Locally:

```
JD_DEV_MOCK=1 php api/setup-jd-tables.php
```

**2026-09-10:** the run widens `jd_generations.slot` to sixteen letters.
Until it has run, saving a rating on a curated item with more than four
responses fails (the sync cannot file slot `e`); everything else is
unaffected. Then, optionally, run `api/jd-backfill-curated.php?key=…` once so
the bench queue sees every rerun set without waiting for a save.

## The shape in one paragraph

A **submission** is one prompt, filed once. It has up to four **generations**
(slots a–d, one model each), which is what the visitor grades. Every judgment
about a generation is a **rating** row; the visitor's or curator's ordering of
a submission's generations is a set of **rank** rows plus one **comparison**
row for the historical win series. Facts about the submission itself (its
title, its size, whether it may be shown, whether the curator wants it
scrapped or rerun) are columns on the submission, not rows anywhere.

Every primary key is an app-generated ULID (`CHAR(26)`, time-ordered), so
`ORDER BY id` is filing order and no table needs AUTO_INCREMENT.

## Tables

### jd_submissions — one row per prompt filed

| column | meaning |
| --- | --- |
| `id` | ULID |
| `client_ref` | the browser's UUID for the turn; `UNIQUE`, so a retried POST cannot file twice |
| `item_id` | **the discriminator.** `NULL` = a real visitor turn. Set = the synthetic row that backs a curated item on disk (`art/junk-drawer/items/<item_id>/`), created by `api/jd-backfill-curated.php` so the bench has something to hang ratings off |
| `created` | filing time (UTC) |
| `prompt` | verbatim |
| `visitor_hash` | salted, daily-rotating visitor hash; never a raw identifier |
| `client` | who filed it: `web` (a visitor), `bench`, `seed`, `curated` |
| `pair_order` | 0–23, the permutation the four models were dealt in, drawn at filing so model identity never correlates with slot letter |
| `ai_consent_at`, `ai_consent_version` | the consent record the turn was filed under |
| `status` | `pending` → `generated` → `rated`, or `failed`. Curated rows are backfilled as `generated` |
| `title` | the object's tag title, as `jd-title.php` proposed and the visitor accepted (≤ 80 chars) |
| `size_class` | a `taxonomy.json` `sizeTiers` id (`xs`/`s`/`m`/`l`/`xl`), as filed by the visitor's size card or the bench |
| `suppressed` | 1 = the visitor ticked "keep this one out of the drawer" |
| `retire_requested_at` | **the hide switch.** Set by SCRAP at the bench or HIDE FROM DRAWER on the admin card; cleared by SHOW IN DRAWER. `NULL` = shown. Live for turns and curated items since 2026-09-10 |
| `rerun_requested_at` | curator pressed RERUN; same convention |

Indexes: `uq_client_ref`, `idx_visitor_created (visitor_hash, created)` for the
daily quota, `idx_created`, `idx_jds_item`.

**Who writes what.** `jd-generate.php` inserts the row (status `pending`,
then `generated`). `jd-rate.php` claims it (`status = 'rated'`) and in the
same statement files `title`, `size_class` and `suppressed` from the visitor's
last card. `jd-item-rate.php` files `size_class` for the bench. `jd-curate.php`
sets and clears the two `*_requested_at` intents. Nothing else writes it.

**Who reads what.** `data.php` shows a turn in the drawer only when
`item_id IS NULL AND status = 'rated' AND suppressed = 0 AND retire_requested_at IS NULL`,
and holds a curated item back from the manifest when its submission carries
`retire_requested_at` (single-item mode still answers, marked `hidden`).
`scripts/apply-scraps.py` may still carry a curated hide into its
`entry.json` (`"retired": true`) for the permanent record; that file-level
retirement needs a commit to undo. `rerun_requested_at` is consumed by the
bench's own rerun, which files a fresh turn.

### jd_generations — one row per model per submission

| column | meaning |
| --- | --- |
| `id` | ULID |
| `submission_id` | FK |
| `slot` | `a`–`p` (sixteen since 2026-09-10; `a`–`d` before); `UNIQUE (submission_id, slot)`. A visitor turn uses four; a curated item one per `entry.json` response, retired ones included, so a rerun set fits |
| `model_id`, `model_version`, `provider` | from the `taxonomy.json` model registry |
| `harness`, `params` | how it was called (`one-shot`; the request parameters as JSON text) |
| `raw_response` | the provider's body, kept for the record |
| `svg` | the sanitized artwork the drawer serves (`jd-gen-svg.php`) |
| `status` | `pending`/`ok`/`failed`/`rejected` (+ `reject_reason` from the sanitizer) |
| `disobedience` | 1 when the model ignored the format contract and the sanitizer had to dig the SVG out |
| `latency_ms`, `usage_tokens` | timing and the provider's usage object (JSON text; each provider's own key names — `jd_generation_cost()` prices it) |

Curated items backfill one row per `entry.json` response, in file order,
`status = 'ok'`, with the SVG left on disk. `api/jd-curated-sync.php` is the
one writer (the backfill's bulk run and `jd-item-rate.php`'s on-demand call
when admin mode names a curated item by entry id): it appends rows for
responses past the ones already filed and never rewrites a row that exists.

### jd_ratings — one row per judgment about a generation

| column | meaning |
| --- | --- |
| `id` | ULID |
| `generation_id` | FK |
| `kind` | `grade` (the overall grade, `axis_id NULL`) or `axis` (one rubric axis). `flag` remains in the ENUM for old dumps; **no code writes it since 2026-09-05** |
| `axis_id` | a live axis id from `taxonomy.json` for `kind = 'axis'` |
| `value` | the numeric rank on that scale (grades 1.0–5.0; axes 1–3 or 1–4) |
| `note` | free text the rater attached, if any |
| `taxonomy_version` | the rubric the judgment was made under |
| `visitor_hash`, `client` | who: `web` (the visitor), `bench` (the owner at the bench), `seed` (the `entry.json` grade carried in by the backfill), `curated` |
| `rated_at` | when |

Ratings are **append-only for visitors** and **replace-per-axis for the
bench**: `jd-item-rate.php` deletes the bench's earlier row for the same
generation and axis (or grade) before inserting, so the bench holds exactly one
current answer per cell while the visitor's original stays.

**The precedence rule** every reader applies (`jd_fold_ratings` +
`jd_pick_rating` in `api/jd-config.php`): fold rows per generation per client,
the **latest** row per client winning each cell; then the **bench's** answer
outranks the turn's own, and the `seed` grade is the fallback when nobody has
graded. A generation is *complete* under the current rubric when every live
axis and a grade are on file at `taxonomy_version ≥ 17` (the v17 rubric reset;
`JD_QUEUE_RUBRIC_SINCE`).

### jd_ranks — the full ordering of a submission's drawings

| column | meaning |
| --- | --- |
| `id` | ULID |
| `submission_id`, `generation_id` | FKs; `UNIQUE (submission_id, generation_id)` |
| `rank_pos` | 1 = best. **Dense**: the distinct positions used are exactly 1..k. Ties are legal below first place only |
| `visitor_hash`, `client`, `rated_at` | who and when |

The column is `rank_pos`, never `rank` — `RANK` is a reserved word in MySQL 8.
Ranks are filed as a set (all of a submission's ok generations at once) and a
re-rank replaces the whole set for that submission, whoever filed it.

### jd_comparisons — the historical win series

One row per submission (`UNIQUE (submission_id)`): `winner_gen_id` (NULL =
tie) and `strength` (`decisive`/`slight`). Written alongside `jd_ranks`
(winner = the rank-1 generation) so the pairwise series that predates ranks
stays one continuous table. It is derivable from `jd_ranks` for every
submission ranked since 2026-08-22; the double-write is kept deliberately (see
*Candidates*).

## Rules readers rely on

- **Curated vs turn** is `item_id IS NULL`, nowhere else. Every turn-flow
  report (`jd-analytics.php`) filters on it; the bench queue and the census
  (`jd-inventory.php`) split on it.
- **A submission's own facts are columns.** Do not file "TITLE …"/"SIZE x"/
  "RETIRE …" notes in `jd_ratings` again; the readers no longer parse them.
- **The bench outranks the turn**; a seed grade is a fallback only.
- **The rubric is `taxonomy.json`.** No axis id, grade label or model name is
  hard-coded in SQL or PHP; a taxonomy edit needs no schema change.
- **Slots are sixteen.** A curated item with more responses than that is
  refused by the sync, never truncated; none exists (the largest holds eight).

## History

- 2026-08-09 — the four eval tables (`jd_submissions`, `jd_generations`,
  `jd_ratings`, `jd_comparisons`); two slots.
- 2026-08-11 — `jd_comparisons.strength`.
- 2026-08-14 — slots widened to `d` (four models per turn).
- 2026-08-18 — `jd_submissions.item_id` + the curated backfill; bench ratings
  live in `jd_ratings` under `client = 'bench'`.
- 2026-08-22 — `jd_ranks`.
- 2026-09-10 — `jd_generations.slot` widened to `a`–`p` (MySQL `MODIFY`;
  a SQLite dev database is recreated). Run the setup script once after the
  deploy; nothing reads the new letters until a sync writes them.
- 2026-09-05 — `title`, `size_class`, `suppressed`, `retire_requested_at`,
  `rerun_requested_at` on `jd_submissions`. Before this, those five facts were
  `kind = 'flag'` rows in `jd_ratings`, hung off whichever generation was
  filed first, with the value encoded in the note. The migration parses each
  legacy row in filing order (last word wins, a note starting `UN` withdraws),
  writes the columns in one transaction, and deletes the rows. The
  `jd-item-rate.php` contract became a per-item batch at the same time
  (`{submission_id, size?, responses: [{generation_id, grade?, axes, rank?}]}`),
  and curator intents got their own endpoint, `jd-curate.php`.

## The bench gate and the read path (2026-09-05, no schema change)

- `JD_BENCH_REQUIRE_KEY` is on: every curator endpoint (`jd-bench-queue`,
  `jd-item-rate`, `jd-curate`, `jd-harvest`, `jd-inventory`,
  `jd-admin-check`, and `jd-gen-svg` for unrated turns) wants
  `X-Bench-Key` = `jd_bench_key` from the secrets file (falling back to
  `jd_setup_key`). Wrong keys are counted per `REMOTE_ADDR` in a small file
  under the system temp dir (no table): 8 misses in an hour answer 429 with
  `Retry-After`. A right key clears the count.
- `data.php` overlays the bench's rows (`client = 'bench'`) onto curated
  items at request time — grade, live axes, rank, `size_class` — and picks
  the shown response from a complete bench ranking. Nothing is written; the
  ETag now also moves with `jd_ranks` and curated `size_class`.

## Candidates (not done, on purpose)

- `jd_comparisons` is now redundant with `jd_ranks` for ranked submissions.
  Dropping the double-write would change what `export-jd-evals.py` and the
  analytics comparison series see; left for a deliberate decision.
- `jd_ratings.kind` still lists `flag`. Removing it is a `MODIFY COLUMN` on a
  live table for no functional gain.
