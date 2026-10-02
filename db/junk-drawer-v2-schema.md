# The Junk Drawer — dataset v2 database schema

The `jd2_*` tables behind dataset v2 of `art/junk-drawer/` (PLAN-V2 §3). The
authoritative DDL is `api/setup-jd2-tables.php`, which is idempotent and
doubles as the migration runner; the allowed words of every enumerated column,
the instrument version and the pair derivation live in `api/jd2-config.php`.
This file explains what each table means and the rules readers rely on. It is
deploy-excluded (`**/*.md`), like every other doc in the repo.

v1's tables (`jd_*`, `db/junk-drawer-schema.md`) are a separate dataset. The
two share one database and never pool: no v2 table references a v1 table, no
row is migrated between them, and the v2 runner never alters a `jd_*` table.

Two dialects: MySQL on Bluehost (production) and SQLite for local development
(`JD_DEV_MOCK=1`, file `local-dev/jd-dev.sqlite`, shared with the v1 runner).
The SQLite DDL is the MySQL DDL with mechanical substitutions (VARCHAR/CHAR/
DATETIME/MEDIUMTEXT → TEXT, TINYINT/INT → INTEGER) plus CHECK constraints that
only the dev database enforces (the allowed words, the numeric ranges, a few
cross-column rules); production relies on the writers validating against the
same `jd2-config.php` constants.

## Runbook

**The deploy runs it.** The last step of `.github/workflows/deploy.yml` calls
`api/setup-jd-tables.php` (v1), then `api/setup-jd2-tables.php`, then the
curated backfill, after every upload to production, with the `JD_SETUP_KEY`
repo secret (= `jd_setup_key` in the server's `private_config/secrets.php`).
Anything but the runner's closing `All tables present and migrated.` fails
the workflow. If the secret is missing the step only warns and nothing ran.
Files shipped with `scripts/push-files.sh` bypass Actions; run the URL by hand
after pushing a schema change that way.

By hand:

```
https://municipalsky.com/api/setup-jd2-tables.php?key=<jd_setup_key>
```

Each line names a table, an index batch or a migration and says `ok`,
`added`, `already present`, `n/a in this dialect …` or `FAILED: …`; the last
line before the verdict counts the seven tables. Re-running is always safe.
Locally:

```
JD_DEV_MOCK=1 php api/setup-jd2-tables.php
```

**Adding an allowed word** to a `JD2_*` list in `api/jd2-config.php` needs no
migration on MySQL (the columns are `VARCHAR(16)`, never `ENUM` — widening
v1's `ENUM` slot column was the migration that sat unrun for seventeen days).
A dev SQLite file keeps the old CHECK: delete `local-dev/jd-dev.sqlite` and
re-run both runners.

**Adding a column** after a table has reached production: a guarded
`ADD COLUMN` in the runner's "additive migrations" block, in v1's
`jd_ensure_column` shape, and a line in History below.

## The shape in one paragraph

A **prompt** is the subject, filed once. Each time it is drawn against the
model pool it gets a **run** (a bracket; a rerun is a new run), and a run has
one **generation** per dealt slot (the drawings). A **session** is one
sitting of one rater over one run: the atomic rating batch, append-only. A
session files **judgments** (a grade and every live axis per drawing),
**rankings** (each drawing's place, strict 1..n, plus the gap 0..3 to the next
place) and **pairs** (a −3..+3 score for each pair of drawings, asked directly
or derived from the ranking and gaps). Facts about the prompt (title, size,
visibility, which run shows) are columns on the prompt.

Every primary key is an app-generated ULID (`CHAR(26)`, time-ordered), so
`ORDER BY id` is filing order. Times are UTC `Y-m-d H:i:s` strings. JSON is
`TEXT` holding JSON (`deal`, `params`, `usage_json`, `seat_order`). Charset
`utf8mb4`, engine InnoDB.

## Tables

### jd2_prompts — one row per prompt

| column | meaning |
| --- | --- |
| `id` | ULID |
| `text` | the prompt, verbatim |
| `title` | the object's tag title (the jd-title draft, as accepted); ≤ 80 chars |
| `origin` | who wrote it: `owner` \| `visitor` (`JD2_PROMPT_ORIGIN`) |
| `created` | filing time |
| `size_class` | a `taxonomy.json` `sizeTiers` id |
| `size_scale` | the fine dial on the tier, `DECIMAL(6,3)`; NULL = 1 |
| `visibility` | the ONE display switch: `draft` \| `live` \| `hidden` (`JD2_VISIBILITY`); default `draft` |
| `hidden_by`, `hidden_at` | who hid it (`owner` \| `visitor`, `JD2_HIDDEN_BY`) and when; NULL unless hidden |
| `approved_at`, `approved_by` | reserved for the roadmap's approval dashboard (a visitor prompt joins the public drawer after the owner approves it); nothing writes them yet, and `approved_by` has no word list yet |
| `shown_run_id` | the run the drawer shows; NULL = the latest complete run |
| `pinned_generation_id` | explicit display pin; NULL = the current session's 1st place |
| `v1_item_id` | lineage: the archived v1 item this prompt descends from |
| `visitor_hash`, `device_ref`, `consent_version`, `consent_at`, `client_ref` | the visitor fields, as in v1; NULL for owner prompts. `client_ref` is `UNIQUE`, so a retried POST cannot file twice |

Keys: `uq_jd2p_client_ref`; `idx_jd2p_visibility_created (visibility, created)`
for the drawer; `idx_jd2p_visitor_created (visitor_hash, created)` for a daily
quota; `idx_jd2p_device`; `idx_jd2p_v1_item`. Foreign keys `fk_jd2p_shown_run`
→ `jd2_runs` and `fk_jd2p_pinned_gen` → `jd2_generations`: those tables are
created after this one, so on MySQL the runner adds the two constraints after
the CREATEs (guarded by an `information_schema` probe); SQLite carries them
inline.

### jd2_runs — one row per run of a prompt against the pool

| column | meaning |
| --- | --- |
| `id` | ULID |
| `prompt_id` | FK → `jd2_prompts` |
| `kind` | `initial` \| `rerun` (`JD2_RUN_KIND`) |
| `requested_by` | `owner` \| `visitor` (`JD2_REQUESTED_BY`) |
| `profile` | the effort profile: `web` \| `bench` (`JD2_PROFILE`) |
| `harness` | the harness id stamped at the time (`JD_HARNESS_BY_PROFILE`) |
| `pool_version` | the pool snapshot the run drew from (`taxonomy.json` `poolVersion`) |
| `deal` | JSON: slot letter → model id, as dealt (replaces v1's `pair_order` arithmetic; any pool size) |
| `status` | `pending` \| `generated` \| `failed` (`JD2_RUN_STATUS`) |
| `created` | filing time |

Keys: `idx_jd2r_prompt_created (prompt_id, created)`.

### jd2_generations — one row per dealt slot of a run (the drawing)

| column | meaning |
| --- | --- |
| `id` | ULID |
| `run_id` | FK → `jd2_runs` |
| `slot` | `a`–`z`, the seat it was dealt; `UNIQUE (run_id, slot)` |
| `model_id` | `taxonomy.json` `models` id (the join key) |
| `api_model` | the exact wire model string sent |
| `provider` | the provider slug (`taxonomy.json` `models` `provider`) |
| `params` | JSON: the request parameters as sent |
| `raw_response` | the provider's body (`MEDIUMTEXT`) |
| `svg` | the sanitized artwork (`MEDIUMTEXT`); NULL unless `ok` |
| `status` | `pending` \| `ok` \| `failed` \| `rejected` (`JD2_GEN_STATUS`) |
| `reject_reason` | the sanitizer's frozen reason when `rejected` |
| `disobedience` | 1 = the SVG had to be dug out of the reply |
| `latency_ms` | wall time of the provider call |
| `usage_json` | JSON: the provider's usage object in its own key names, kept so the row can be re-priced |
| `cost_usd` | `DECIMAL(10,6)`, snapshotted at write time; NULL when unpriced |
| `priced` | 1 = `cost_usd` came from a known price row |
| `hidden` | 1 = the owner dropped this drawing from the card, without touching the run |
| `created` | filing time |

Keys: `uq_jd2g_run_slot (run_id, slot)` (also the `run_id` index),
`idx_jd2g_model`, `idx_jd2g_created`.

### jd2_sessions — one row per sitting

| column | meaning |
| --- | --- |
| `id` | ULID |
| `run_id` | FK → `jd2_runs` |
| `rater_role` | `owner` \| `visitor` (`JD2_RATER_ROLE`) |
| `rater_hash` | the visitor hash, or `jd_curator_hash()` for the owner |
| `device_ref` | the browser's kept device UUID, when sent |
| `client` | `web` \| `ios` \| `android` (`JD_CLIENTS`) |
| `taxonomy_version` | `taxonomy.json` `version`, stamped server-side |
| `instrument_version` | `JD2_INSTRUMENT_VERSION` (`v2.0`), stamped server-side |
| `blind` | 1 unless the rater could see model names |
| `seat_order` | JSON: the slot letters in the order they were dealt to this rater |
| `started_at`, `filed_at` | when the sitting opened and was filed; `filed_at` NULL while open or abandoned |
| `status` | `open` \| `filed` \| `abandoned` (`JD2_SESSION_STATUS`) |

Keys: `idx_jd2s_run_role_status (run_id, rater_role, status, filed_at)` — the
"current session" lookup.

### jd2_judgments — the per-drawing cells of a session

| column | meaning |
| --- | --- |
| `id` | ULID |
| `session_id` | FK → `jd2_sessions` |
| `generation_id` | FK → `jd2_generations` |
| `kind` | `grade` \| `axis` (`JD2_JUDGMENT_KIND`; v2 has no `flag`) |
| `axis_id` | a live `taxonomy.json` axis id for `axis`; `''` (empty, not NULL) for `grade` |
| `value` | the rank on that scale, `DECIMAL(3,1)` (grades 1.0–5.0; axes 1–3 or 1–4) |
| `note` | the rater's remark on this cell |

Keys: `uq_jd2j_cell (session_id, generation_id, kind, axis_id)` (also the
`session_id` index), `idx_jd2j_generation`. `axis_id` is `''` on a grade so
that the UNIQUE key holds for grades too: NULLs never collide in a UNIQUE
index, in either dialect.

### jd2_rankings — the per-drawing place in a session, and the gap below it

| column | meaning |
| --- | --- |
| `id` | ULID |
| `session_id` | FK → `jd2_sessions` |
| `generation_id` | FK → `jd2_generations` |
| `rank_pos` | place, 1 = best; strict 1..n, no ties |
| `gap_after` | 0..3, the margin between this place and the next (`taxonomy.json` `gaps`); NULL on the last place |

Keys: `uq_jd2rk_generation (session_id, generation_id)`,
`uq_jd2rk_place (session_id, rank_pos)` (no two drawings share a place; a tie
is a zero gap), `idx_jd2rk_generation`. The column is `rank_pos`, never
`rank` (reserved in MySQL 8.0), as in v1.

### jd2_pairs — the per-pair comparative score of a session

| column | meaning |
| --- | --- |
| `id` | ULID |
| `session_id` | FK → `jd2_sessions` |
| `gen_a`, `gen_b` | FKs → `jd2_generations`, in canonical order (below) |
| `score` | −3..+3; positive = `gen_a` preferred (`taxonomy.json` `comparison`) |
| `source` | `direct` (asked as a head-to-head) \| `derived` (computed from the ranking and gaps) (`JD2_PAIR_SOURCE`) |
| `method` | the derivation id (`JD2_DERIVE_METHOD`, `spaced-rank-v1`) when derived; NULL when direct |
| `shown_left` | FK → `jd2_generations`: for a direct ask, the drawing shown first/left; NULL when derived |

Keys: `uq_jd2pr_pair (session_id, gen_a, gen_b)` (also the `session_id`
index), `idx_jd2pr_gen_a`, `idx_jd2pr_gen_b`.

## Rules readers rely on

- **Sessions are append-only.** A re-rating is a new session; nothing is
  deleted or replaced. There is no delete-then-insert, no `seed` client and no
  per-client precedence fold.
- **Current = the latest `filed` session per (`run_id`, `rater_role`)**, by
  `filed_at` (then `id`). One helper computes it (Phase 3, `jd2_current_session`)
  and every reader calls it.
- **The owner outranks the visitor for display**: the drawer reads the
  current owner session, else the current visitor session. Both stay on file
  and are reported separately.
- **Complete** = every non-hidden `ok` generation of the run carries every
  cell `jd2_required_cells()` names for the session's taxonomy version (the
  live axes plus the grade), computed from the taxonomy, never from a constant.
- **Derived pairs are a cache.** The ranking and its gaps are the raw answer;
  `jd2_derive_pairs()` recomputes the pairs from them, and a `method` bump
  re-derives. The score between places i < j is the sum of the gaps from i to
  j−1, capped at 3, favouring place i.
- **The canonical pair order** (`jd2_pair_key()`): by slot letter when both
  slots are known, else by generation id (ULID, so filing order). One row per
  unordered pair; the score is signed against that order.
- **No pooling with v1.** No v2 query joins a `jd_*` table; `v1_item_id` is
  lineage, not a join for analysis. Owner and visitor sessions are separate
  populations.
- **The rubric is `taxonomy.json`.** No axis id, grade label, gap label or
  model name is hard-coded in SQL or PHP.

## History

- 2026-10-01 — the seven `jd2_*` tables (Phase 2 of PLAN-V2), with the
  reserved `approved_at` / `approved_by` on `jd2_prompts`; `taxonomy.json` v26
  (`instrument` `v2.0`, `comparison`, `gaps`, the pool fields, `poolVersion`);
  the deploy runs the v2 runner after the v1 runner. No rows yet; the readers
  and writers are Phase 3.
