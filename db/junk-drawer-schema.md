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

**Since 2026-09-27 the deploy runs this for you.** The last step of
`.github/workflows/deploy.yml` calls `api/setup-jd-tables.php` and then
`api/jd-backfill-curated.php` after every upload to production, using the
`JD_SETUP_KEY` repo secret (= `jd_setup_key` in the server's
`private_config/secrets.php`; set with `gh secret set JD_SETUP_KEY`). A
`FAILED` line, a refusal, or an unreachable endpoint fails the workflow run,
which is where to look when a deploy goes red. If the secret is missing the
step only warns — and then nothing below has happened. Files shipped with
`scripts/push-files.sh` bypass Actions, so after pushing a schema or sync
change that way, run the two URLs by hand.

By hand, after any deploy that touches `api/setup-jd-tables.php`, run it once:

```
https://municipalsky.com/api/setup-jd-tables.php?key=<jd_setup_key>
```

Each line of its output names a table or migration and says `ok`, `added`,
`already present`, or `FAILED: …`. Re-running is always safe. Locally:

```
JD_DEV_MOCK=1 php api/setup-jd-tables.php
```

**2026-09-10 migration — ran on production 2026-09-27.** It widened
`jd_generations.slot` to sixteen letters and added `jd_submissions.device_ref`
(+ `idx_jds_device`). For seventeen days it had NOT run: every save on a
curated item with more than four responses died in the sync with a bare
`SQLSTATE[01000] 1265 Data truncated for column 'slot'` in `api/error_log`,
and every visitor turn was filed without a device code. The curated backfill
was run the same day: 49 of 49 live items are on file (18 filed whole, 21
appended, 6 levelled), 154 generations, 154 seed grades, 616 + 270 seed axis
and rank rows; every `data.php` payload came back identical, the analytics
charts unchanged. Backups: `~/Desktop/municipal-sky-db-backup-2026-09-27.sql`
(before) and `…-2026-09-27-1850.sql` (immediately before the first write).

**The guard, so it cannot recur silently (2026-09-27):**
`jd_slot_capacity()` in `api/jd-curated-sync.php` reads the LIVE width of the
`slot` column (information_schema on MySQL, the CHECK in `sqlite_master` on
SQLite). The sync refuses an item that would not fit with a sentence that
names this runbook, and `api/jd-backfill-curated.php` refuses up front when
the widest entry on disk exceeds the live column — before writing a row. A
dry run reports it too. The refusal says *what to run*; it does not run it.

**How to know the schema is current** (no key needed for the first two):
1. `git log -1 --format=%h -- api/setup-jd-tables.php` — the last commit that
   touched the runner. If it is newer than the last time you ran the runner
   against production, run it.
2. `api/jd-backfill-curated.php?key=…&dry-run=1` — a refusal on the first
   line means the runner is due.
3. The runner itself is the ground truth and is safe to re-run at any time.

**A dev SQLite made before 2026-09-10 is still four slots** — the runner cannot
widen a CHECK. Delete `local-dev/jd-dev.sqlite` and run
`JD_DEV_MOCK=1 php api/setup-jd-tables.php` to recreate it (the local dev
server proxies `data.php` and `/api/*` to production, so the dev database only
matters to the mock).

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
| `device_ref` | (2026-09-10) the random UUID the browser made on its first turn and keeps in localStorage (`jd-device`), sent as `device_ref`; groups one device's turns across days. `NULL` for turns before that date, for curated rows, and when the browser refused storage. Random — not derived from the IP or the device. Named in `JD_CONSENT` (jd-consent-5) and privacy.php §4 |
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
daily quota, `idx_created`, `idx_jds_item`, `idx_jds_device`.

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
- **The bench outranks the turn**; a seed is a fallback only. Since
  2026-09-10 a `client='seed'` row can be a grade, a live-axis value (the
  entry's annotation, filed by `jd-curated-sync.php`) or a `jd_ranks` row
  (the harvest's "filed rank N of M"); the queue counts them toward complete
  and ranked, `jd_pick_rating(['bench', '*'])` still lets the bench's win.
- **The rubric is `taxonomy.json`.** No axis id, grade label or model name is
  hard-coded in SQL or PHP; a taxonomy edit needs no schema change.
- **Slots are sixteen — in the code.** The sync trusts the DATABASE's word
  on how many it has (`jd_slot_capacity`) and refuses an item that would not
  fit, never truncates; none exceeds sixteen (the largest holds eight).

## History

- 2026-08-09 — the four eval tables (`jd_submissions`, `jd_generations`,
  `jd_ratings`, `jd_comparisons`); two slots.
- 2026-08-11 — `jd_comparisons.strength`.
- 2026-08-14 — slots widened to `d` (four models per turn).
- 2026-08-18 — `jd_submissions.item_id` + the curated backfill; bench ratings
  live in `jd_ratings` under `client = 'bench'`.
- 2026-08-22 — `jd_ranks`.
- 2026-09-10 — `jd_generations.slot` widened to `a`–`p` (MySQL `MODIFY`;
  a SQLite dev database is recreated) and `jd_submissions.device_ref` added.
  **Ran on production 2026-09-27** — seventeen days after the deploy; see the
  Runbook for what that cost and the guard added the same day.
- 2026-09-27 — the curated backfill brought every live item into the database
  (49/49). Ratings are edited in `?admin` from here on, never in `entry.json`.
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
