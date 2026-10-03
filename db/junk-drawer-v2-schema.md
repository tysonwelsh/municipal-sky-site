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
re-run both runners. (For `jd2_runs.profile` the runner says so itself: a
`STALE CHECK` line names the missing words — every dev file made before the
2026-10-02 profile split shows it.)

**Adding a column** after a table has reached production: a guarded
`ADD COLUMN` in the runner's "additive migrations" block, in v1's
`jd_ensure_column` shape, and a line in History below.

**After a sanitizer change** that lets more through, recover the drawings the
old rules rejected (their `raw_response` is kept byte-exact, so no model is
asked again):

```
https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>&dry-run=1   (lists)
https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>             (applies)
JD_DEV_MOCK=1 php api/jd2-resanitize.php [--dry-run]                            (dev)
```

Every `rejected` generation with a `raw_response` is re-extracted and
re-sanitized under the current rules. One that now passes gets `status` `ok`,
`svg`, `normalized`, `disobedience` (recomputed by `jd2-generate`'s rule, the
value already on file for a sanitizer rejection) and `reject_reason` NULL;
usage, latency, cost, `priced`, `params`, `hidden` and `created` stay as
filed. One that still fails is left untouched. Each touched run is
re-settled by `jd2-generate`'s rule (`jd2_run_settled_status`: once every
dealt slot has settled, `generated` if any drawing is ok), so `failed` can
become `generated`. One line per row (run, slot, model, old reason →
result). Idempotent. It never touches a `jd_*` table or a session, judgment,
ranking or pair; a recovered drawing is unrated, so a sitting filed over its
run reads incomplete until the drawing is rated (the output names those runs).

## Reset (once, before the campaign)

`api/jd2-reset.php` deletes EVERY row of the seven `jd2_*` tables. It is the
one sanctioned exception to the append-only rule (sessions, judgments,
rankings and pairs are never deleted, `art/junk-drawer/CLAUDE.md`, Never),
and it is used **once, by the owner, before the campaign's first sitting**
(owner, 2026-10-03): the trial prompts, runs, drawings and sittings — rows
101–110 under the old pool and the medium setting, the trial after it, the
owner's test sitting on the Titanic prompt — go, and the campaign starts
clean under the new pool, the new rubric and the reviewed drawing prompt. A
real run is refused outside its window, `JD2_RESET_WINDOW_FROM` …
`JD2_RESET_WINDOW_UNTIL` (2026-10-02 … 2026-10-31 UTC; moving it is the
owner's decision, made in a commit). From the campaign's first sitting on,
nothing is deleted, and the file should be removed from the repo once it has
run.

The exact two commands:

```
https://municipalsky.com/api/jd2-reset.php?key=<jd_setup_key>&dry-run=1          (1. look, and get the token)
https://municipalsky.com/api/jd2-reset.php?key=<jd_setup_key>&confirm=<token>    (2. delete)
```

Then, on the Mac, in the checkout that ran the batch:
`php scripts/jd2-batch-run.php --forget-state` (the runner's state file,
`local-dev/jd2-batch-state.json`, would otherwise still list the deleted rows
as drawn; the endpoint cannot reach it). Locally:
`JD_DEV_MOCK=1 php api/jd2-reset.php [--dry-run | --confirm=<token>]`.

- **The dry run** (`?dry-run=1`, and the default when neither flag is given)
  prints each table's row count, a one-line census (prompts by origin,
  sessions by role and status, the newest `filed_at`, the drawings' total
  `cost_usd`, the intake cost, the pool versions and harnesses present) and
  the confirmation token. Given both flags, it is a dry run.
- **The token** is the first 12 hex of a sha256 over the seven counts, each
  table's newest id and the newest `filed_at`. It names one exact state: a
  row filed after the dry run changes it, so a stale dry run cannot
  authorise a later state. A token that does not match is refused (409),
  nothing is deleted, and the refusal says to run the dry run again; it never
  prints the right token.
- **The real run** checks the token against a census taken inside ONE
  transaction, clears the prompts' two forward references
  (`shown_run_id`, `pinned_generation_id`), deletes in foreign-key order —
  `jd2_pairs`, `jd2_rankings`, `jd2_judgments`, `jd2_sessions`,
  `jd2_generations`, `jd2_runs`, `jd2_prompts` (the intake records are prompt
  columns and go with them) — checks all seven are empty, commits, and prints
  each table's count before → after. The tables stay. No `jd_*` table,
  `page_events` or other table is named by the file.
- **The record**: one JSON line (time, token, web or CLI, the census, the
  rows deleted per table, the counts after) appended to `jd2-reset.log`, and
  `jd2-reset.stamp` beside it, in a directory no web request can reach: on
  production `/home1/tdrivemy/private_config` (the out-of-webroot directory
  that holds `secrets.php`), else the system temp dir; anywhere else
  `local-dev/` (gitignored, deploy-excluded). Not `api/`: `.htaccess` denies
  only itself, so a `.log` there would be served. The directory is checked
  writable before anything is deleted; the output names the path used.
- **Refusals**: a second real run within an hour of the stamp (409); outside
  the window (409); no writable record directory (500). The gate: on
  production `?key=` (`jd_require_setup_key`), and wherever `JD_DEV_MODE` is
  false (a checkout whose `config/secrets.php` reaches the live MySQL, a
  `php -S` without `JD_DEV_MOCK=1`) the key is required as well — `?key=` on
  the web, `JD_SETUP_KEY` in the environment on the CLI — or it refuses
  before opening the database. Only the dev box is open.
- Tested by `php scripts/test-jd2-reset.php` (hermetic, dev SQLite).

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
| `size_by` | who set `size_class` last: `model` \| `owner` \| `visitor` (`JD2_SIZE_BY`); NULL = no size on file. **`owner` is never overwritten by the model**: intake writes the size only when `size_by` is not `owner` |
| `visibility` | the ONE display switch: `draft` \| `live` \| `hidden` (`JD2_VISIBILITY`); default `draft` |
| `hidden_by`, `hidden_at` | who hid it (`owner` \| `visitor`, `JD2_HIDDEN_BY`) and when; NULL unless hidden |
| `approved_at`, `approved_by` | reserved for the roadmap's approval dashboard (a visitor prompt joins the public drawer after the owner approves it); nothing writes them yet, and `approved_by` has no word list yet |
| `shown_run_id` | the run the drawer shows; NULL = the latest complete run |
| `pinned_generation_id` | explicit display pin; NULL = the current session's 1st place |
| `v1_item_id` | lineage: the archived v1 item this prompt descends from |
| `category` | the owner's prompt-set category, a free word (ROADMAP, 2026-10-01); NULL for visitor prompts |
| `tags` | the faceted classification, JSON `{"subject": [...], "treatment": [...], "probe": [...]}` — one key per `taxonomy.json` `facets` id, each a list of that facet's heading ids; NULL until intake answers. Written by intake, or by the owner through `jd2-curate` |
| `intake_version` | the intake prompt's version (`taxonomy.json` `intakeVersion`, e.g. `intake-v1`) the answer was filed under; answers under different versions are not pooled |
| `intake_model` | the wire model id that answered (`utility.intake.api_model`); `mock` in dev |
| `intake_json` | JSON: the model's structured answer verbatim, its `usage`, `stop_reason` and the key SLOT that answered (`key`: the slot name, never any part of the key); on a failed intake, the error instead (`error`, `at`), so a failure shows on the ledger |
| `intake_cost_usd` | `DECIMAL(10,6)`, the intake call priced at write time against `api/jd-prices.json`; NULL when unpriced (and for the mock) |
| `intake_at` | when intake answered; NULL until it did. A failed intake leaves it NULL, so the next call retries |
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
| `profile` | the effort profile: `web` \| `bench-medium` \| `bench-low` \| `bench-max` \| `bench` (retired) (`JD2_PROFILE`; see Effort profiles below) |
| `harness` | the harness id stamped at the time (`JD_HARNESS_BY_PROFILE`) |
| `pool_version` | the pool snapshot the run drew from (`taxonomy.json` `poolVersion`): `pool-2026-08-14` (Opus 5, GPT-5.1, Kimi K3, Gemini 3.1 Pro; every run filed before the refresh) or `pool-2026-10-02b` (Opus 5.5, GPT-6.1 Sol, Kimi K3, Gemini 3.1 Pro; current) |
| `deal` | JSON: slot letter → model id, as dealt (replaces v1's `pair_order` arithmetic; any pool size) |
| `status` | `pending` \| `generated` \| `failed` (`JD2_RUN_STATUS`) |
| `created` | filing time |

Keys: `idx_jd2r_prompt_created (prompt_id, created)`.

#### Effort profiles and harness ids (2026-10-02; pool refresh the same day)

Current, under `pool-2026-10-02b`:

| profile | who | Anthropic Opus 5.5 `output_config.effort` | OpenAI gpt-6-astra `reasoning_effort` | Kimi K3 `reasoning_effort` | Gemini 3.1 Pro `thinkingLevel` | output budget | harness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `web` | visitors | `low` | `low` | `low` | `low` | 12000 | `v4-web.4` |
| `bench-low` | owner | `low` | `low` | `low` | `low` | 64000 | `v4-benchlow.1` |
| `bench-medium` | owner, **the default** | `medium` | `medium` | `high` (K3 has no medium: its middle rung) | `medium` | 64000 | `v4-benchmed.1` |
| `bench-max` | owner | `max` | `xhigh` (Chat Completions refuses `max` on this model) | `max` | `high` | 64000 | `v4-bench.5` |

Retired harness ids, still stamped on the runs filed under them (under
`pool-2026-08-14`, with Opus 5 and GPT-5.1 in the first two columns):

| profile | harness | Anthropic | OpenAI | Kimi K3 | Gemini 3.1 Pro | budget | retired because |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `web` | `v4-web.3` | thinking disabled | (none sent: vendor default) | `low` | `low` | 12000 | Opus 5.5 answers 400 to disabled thinking; OpenAI now sends `low` |
| `bench-max` | `v4-bench.4` | `max` | `high` (GPT-5.1's top) | `max` | `high` | 64000 | GPT-6.1 Sol's top accepted rung is `xhigh` |
| `bench` | `v4-bench.3` | `max` | `high` | `high` | `high` | 12000 | the profile split (runs filed before 2026-10-02) |

Harness ids in use for new runs: `v4-web.4`, `v4-benchlow.1`,
`v4-benchmed.1`, `v4-bench.5`. `v4-benchlow.1` and `v4-benchmed.1` span both
pool versions (their parameters did not change); `pool_version` tells those
runs apart.

The values are `JD_EFFORT` in `api/jd-config.php`; every profile leaves
thinking on, web included since `v4-web.4`. The owner's default is `JD2_OWNER_DEFAULT_PROFILE`
(`bench-medium`, owner 2026-10-02). On the wire, the bare word `bench` (an
older client, the bench page) means that default; max effort is the explicit
`bench-max`. A slot of a run stored under the retired `bench` is refused
(409 `retired_profile`); the owner reruns the prompt instead. Runs under
different harness ids are never pooled: `v4-bench.3` and `v4-bench.4` differ in
budget and in Kimi's setting, `v4-bench.4` and `v4-bench.5` in OpenAI's,
`v4-web.3` and `v4-web.4` in Anthropic's and OpenAI's, and the three bench
profiles are each their own condition — comparing them is the point. Nor are
runs under different `pool_version`s.

**The budget rule.** On every provider in the pool one output cap covers
thinking AND the answer (Anthropic `max_tokens`, OpenAI `max_completion_tokens`,
Gemini `maxOutputTokens`, Kimi `max_tokens`), so a thinking model can spend the
whole budget before drawing: at the retired `bench` (12000) Opus 5 at effort
max returned `stop_reason` `max_tokens` with every token thinking, and Gemini
was cut off mid-SVG. The budget is per profile (`JD_MAX_TOKENS_BY_PROFILE`,
read with `jd_max_tokens()`; `JD_MAX_TOKENS` is the web alias): `web` 12000,
every bench profile 64000 — one number for the whole pool, under the smallest
vendor cap (Gemini 3.1 Pro's 65,536 output tokens; Opus 5 and GPT-5.1 allow
128,000). A budget change is a harness bump. `params` on every generation
records the budget, the effort fragment, `effort_profile` and `harness`.
`scripts/jd2-profile-probe.php` proves each (model, profile) cell can finish an
SVG (one tiny prompt each, no database; `JD_PROFILE_LIVE=1` to spend).

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
| `raw_response` | the provider's body (`MEDIUMTEXT`), byte-exact model output |
| `svg` | the sanitized artwork (`MEDIUMTEXT`) — the drawing served and rated; NULL unless `ok` |
| `status` | `pending` \| `ok` \| `failed` \| `rejected` (`JD2_GEN_STATUS`) |
| `reject_reason` | the sanitizer's frozen reason when `rejected` |
| `disobedience` | 1 = the SVG had to be dug out of the reply |
| `normalized` | `VARCHAR(64)`: what the sanitizer changed between `raw_response` and `svg`, a comma-joined list of `JD2_GEN_NORMALIZED` words (today only `cdata_unwrapped`: CDATA sections turned into text and the drawing re-serialized); NULL = nothing, `svg` is the extracted span byte for byte |
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
| `required_cells` | JSON list: the axis ids, then `grade`, that this sitting had to carry to be complete — `jd2_required_cells()` (the live axes of the taxonomy) at filing, stamped by `jd2-rate` since taxonomy v35. Readers judge completeness against it (`jd2_session_cells`); NULL = judged on the live axes. TEXT NULL (2026-10-02) |
| `blind` | 1 unless the rater could see model names |
| `seat_order` | JSON: the slot letters in the order they were dealt to this rater |
| `note` | the rater's free-text rationale for the sitting — the owner's taxonomy notes, kept on hand, not necessarily shown (2026-10-01) |
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
  `filed_at` (then `id`). One rule, in two helpers that state it the same
  way: `jd2_current_session` for one run, and `jd2_current_sessions_for_runs`
  for many runs in one read (the set-based readers); every reader calls one
  of them.
- **The owner outranks the visitor for display**: the drawer reads the
  current owner session, else the current visitor session. Both stay on file
  and are reported separately.
- **Complete** = every non-hidden `ok` generation of the run carries every
  cell the SESSION's rubric required — its own `required_cells`
  (`jd2_session_cells()`), else, for a row with none, `jd2_required_cells()`
  of the taxonomy handed in (the live axes plus the grade) — never a
  constant. **This is what lets an axis be added mid-campaign without
  emptying the drawer:** a new axis asks the next sitting for it, while
  every sitting already filed is still judged by the cells it was asked
  for, stays complete, and keeps its prompt in the drawer. (Taxonomy v35
  added Paintwork and the 4-point Structural Coherence while production
  held one filed sitting.)
- **The one-off backfill rule (taxonomy < 35).** Sessions filed before the
  column existed carry no stamp. From the v2 baseline (v26) through v34 the
  v2 rubric's required cells were exactly `understanding-assignment`,
  `structural-coherence`, `layering`, `jnsq` and `grade`
  (`JD2_CELLS_BEFORE_V35`), so `setup-jd2-tables.php` writes that list onto
  every session with `taxonomy_version < 35` and `required_cells` NULL
  (idempotent: a re-run has nothing to backfill). No judgment, ranking or
  pair is touched.
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

## Endpoints

Phase 3b (2026-10-01). Every endpoint includes `api/jd2-config.php`, answers
JSON (`jd_json_out`; failures in the `{ok:false, error:{code, message}}`
envelope, with `run_id`/`prompt_id`/`gen_id`/`slot` when known), sits behind
`jd-origin.php`'s allowlist (except `data.php`), and keeps no session or
cookie. **Owner** = the request presents the bench key (`X-Bench-Key` or
`?key=`) and it is right (`jd2_rater()`; a wrong key is 403, never a quiet
visitor); everyone else is a **visitor** (`msky_visitor_hash()`, daily). A box
with no key on file is open in dev, as in v1. A `submission_id` in a request
or a response is a SHIM alias of `run_id` for the unchanged v1 turn card,
removed when Phase 4 reads `run_id`.

| endpoint | gate | request → response |
| --- | --- | --- |
| `POST api/jd2-generate.php` | origin; visitor needs consent; `profile`/`rerun_of`/`run_id` need the key | `{client_ref, slot, prompt, client, consent:{version}, device_ref?, website}` (owner also `profile` — `bench-medium` (default; `bench` means it), `bench-low`, `bench-max` or `web` — `rerun_of`, `run_id`) → `{ok, svg, gen_id, slot, run_id, prompt_id, submission_id}` |
| `POST api/jd2-intake.php` | origin; visitor: the `client_ref` must be a prompt filed in the last hour (403 `no_turn`); owner: `prompt_id` with the bench key | `{client_ref, prompt}` or `{prompt_id}` → `{ok, prompt_id, title, size_class, size_by, tags, reasons, intake_version[, stored][, fallback]}` (the intake clerk, below; replaced `jd2-title.php` on 2026-10-02) |
| `POST api/jd2-rate.php` | origin; visitor: only their own turn — a run a visitor requested whose prompt's `client_ref` the request carries (missing or wrong → 403 `not_yours`) — and one filed session per run (409 `already_rated`); owner: the bench key, no `client_ref` | `{run_id, client_ref (visitor), client, device_ref?, title?, size?, suppress?, ratings:[{slot, kind, axis_id?, value, note?}], ranking:[{slot, rank, gap?}]\|null, pairs:[{slot_a, slot_b, score, shown_left?}]\|null, blind?}` → `{ok, build, session_id, run_id, prompt_id, complete, reveal:[{slot, model_id, label, vendor, status, tokens?, cost_usd?, priced?}]}` |
| `POST api/jd2-curate.php` | origin + bench key | `{prompt_id, visibility?, shown_run_id?, pinned_generation_id?, title?, size_class?, size_scale?, category?, tags?}` or `{generation_id, hidden}` → `{ok, build, prompt:{…}, runs:[{…, generations, sessions, display_session_id, complete}]}` |
| `GET api/jd2-gen-svg.php?gen=<id>` | origin; public when the prompt is `live` and the drawing not hidden, else bench key; otherwise 404 | → `image/svg+xml`, `nosniff`; a public answer (no key presented) is `private, max-age=86400` with a strong ETag (md5 of the svg) and 304 on `If-None-Match`; a keyed or non-public one is `no-store` |
| `GET art/junk-drawer/data.php` | public | → `{generated, count, taxonomy, items, errors:[]}`, ETag (taken over its own reads: the session and generation aggregates, the prompts, runs and drawings it serves); `?item=<prompt_id>` any visibility (`hidden: true` unless live); `?slim=1` via `_slim.php`; a database outage answers an empty manifest |

**jd2-generate.** The first request for a `client_ref` files the prompt
(`visibility` `draft`) and its `initial` run in one transaction; the
prompt's UNIQUE `client_ref` is where the parallel slot requests converge, so
the owner's new prompts file their `client_ref` too (the other visitor fields
stay NULL for them). The deal is drawn once there (`jd2_deal`), and each slot
fills its generation with the dealt model under the run's profile (`web` for
visitors, `bench-medium` by default for the owner) — effort, budget, harness,
timeout —
through the provider layer (the mock in dev), the sanitizer, and the price
table (`cost_usd`, `priced` at write time). A slot is checked against the
run's deal. A settled slot re-answers its stored verdict. A rerun files no
prompt and so converges on its run id: the first slot request
(`rerun_of`, no `run_id`) creates the `rerun` run and answers its `run_id`;
the other slots send `rerun_of` + `run_id`. The global breaker counts
`jd2_generations` since UTC midnight (`JD_LIMIT_GLOBAL_DAILY`).

**jd2-rate.** A visitor sitting carries the turn's `client_ref` — the UUID
the browser minted for the turn, sent with every slot request, and kept in
its `jd2-turn` record — and files only when it equals the run's
`jd2_prompts.client_ref` (403 `not_yours` otherwise, checked before
`already_rated`). A run id and its origin are public once the prompt is live
(data.php serves both), so the client_ref is what stops a stranger filing a
sitting on someone else's live item — and with it `suppress`, `title` and
`size`, which a visitor sets only under that proof. The owner's sittings
(bench key) need none. Drawings are named by slot (a v1 `gen_id` of the same run is
accepted as a shim; a `flag` rating is dropped as a shim). The ranking is
strict 1..n over every ok, non-hidden drawing (a tie is a zero gap), with a
gap 0..3 on every place but the last, or on none. One session, one method:
sent `pairs` file as `direct` (re-signed into canonical order) and nothing is
derived; otherwise a ranking with gaps derives the pairs (`derived`,
`spaced-rank-v1`); with neither, the session files without pairs and is not
complete. The session stamps role, hash, device, client, taxonomy and
instrument versions, `blind` (0 only for the owner's `blind:false`),
`seat_order` (slot → generation, as dealt), `started_at` = the run's created,
`filed_at` = now. Filing also lands `title`, `size_class` and the keep-out
(`suppress` → `hidden`, `hidden_by` = the rater's role) on the prompt, and a
complete session on a `draft` prompt makes it `live` (`approved_at` is not
written). The size lands only when the card SENT one: `size_class` with
`size_by` = the rater's role (`owner` from the bench; `visitor` from the turn
card, never over an owner's size). Since 0.13.0 the bench sends neither
`title` nor `size` here: its catalogue entry card files them, with the tags,
through `jd2-curate` before the sitting (below). An absent size never files a NULL over the
intake clerk's tier — the visitor's card no longer asks when intake sized
the turn.

**jd2-intake (the intake clerk, 2026-10-02).** One structured-output call per
filed prompt returns the catalogue heading (the tag's title), the size tier
and the faceted classification (`api/jd2-intake-prompt.php`: the system
prompt — PLAN-INTAKE-PROMPT §2's bytes with the size tiers and the facets
rendered from `taxonomy.json` — and the JSON schema built from the same
file). The wire: `POST https://api.anthropic.com/v1/messages`, model
`utility.intake.api_model` (`claude-sonnet-5-5`), `max_tokens` 1024, the
rendered `system`, one user message (a sentence, then the prompt inside
`<prompt>…</prompt>`), `output_config: {effort: "low", format: {type:
"json_schema", schema}}`; no `thinking` key (its default), no temperature.
The key is the clerk's own slot, `jd_intake_key` in `private_config/secrets.php`,
falling back to `jd_claude_key` → `claude_key`; `intake_json.key` records the
slot's NAME (`jd_intake_key` or `jd_claude_key (fallback)`), never the key.
The answer is checked even though the schema guarantees its shape (heading
2–5 words with the parenthesis, ≤ 40 characters, a capital first; a tier id;
each facet's ids its own, no repeats, within `min..max`). One UPDATE, guarded
by `intake_at IS NULL`, writes: `title` only when the row has none (an
owner's title stands); `size_class` with `size_by = 'model'` **unless
`size_by` is `owner` — the owner's size is never overwritten by the model**;
`tags` only when the row has none; `intake_version`, `intake_model`,
`intake_json` (the answer verbatim and parsed, `usage`, `stop_reason`, the key
slot), `intake_cost_usd` (priced at write time from `jd-prices.json`) and
`intake_at`. A prompt with `intake_at` answers its stored facts (`stored:
true`) with no call. On any failure of the call (transport, HTTP error, a
`refusal` or other `stop_reason`, an answer that fails the checks) it answers
200 `{ok: true, title: <jd_turn_title's 41-character fallback>, size_class:
null, tags: null, fallback: true}` and writes only `intake_json` (the error),
leaving `intake_at` NULL so a later call retries: a missing intake never
holds up a turn. In dev (`JD_DEV_MODE`) a deterministic mock answers
(`intake_model` `mock`; `JD_INTAKE_MOCK_FAIL` makes it fail). Callers: the
turn card (during the darkroom wait; a sized visitor turn skips the size
card), the bench's NEW PROMPT (unless its form gave a title and a size), the
batch runner (after a new row's first drawing, unless the CSV gave both), and
`scripts/jd2-intake-check.php` (the same call, no write).

Both writers answer `build`, the tooling fingerprint
(`jd_build_stamp()['build']`, `api/jd-build.php`, whose file list spans every
v2 surface), as v1's writers did: the bench compares it with the queue's and
says "a deploy landed" when they differ.

**Every reader applies three rules** (`jd2_current_session`,
`jd2_display_session`, `jd2_is_complete`; the set-based readers — data.php
and jd2-analytics — read every run's current sessions at once with
`jd2_current_sessions_for_runs` and `jd2_standings_for_sessions` and pick
with `jd2_display_pick`, the same rules over rows already read):

1. **Current session** — per (run, role) the latest `filed` session by
   `filed_at`, then `id`. Sessions are never edited or deleted.
2. **Owner over visitor** — where one session stands for the run, the
   owner's current session outranks the visitor's. For display it must also
   be complete: the owner's current session if complete, else the visitor's
   current session if complete (an incomplete sitting never displaces a
   complete one).
3. **Complete** — every non-hidden ok drawing has a grade and every axis the
   session's own rubric required (`required_cells`, else the live axes);
   with more than one drawing, a ranking places them all in
   distinct places and every unordered pair of them has a score (direct or
   derived).

The drawer's shown run is `shown_run_id`, else the newest run whose display
session is complete; its `primary` is the pinned drawing when it is in the
run, else 1st place. The item keeps v1's turn-item shape (rids `r1…` in place
order) plus `run_id`, `prompt_id`, `origin`, `display_role` (`owner` |
`visitor`: whose sitting the item is showing — the display session's
`rater_role`; `null` when no sitting is on file, which only `?item=` can
answer), each response's `gen_id` and `slot`, and
`pairs: [{a: rid, b: rid, score, source}]`. The drawer's admin card refuses
to save over an item whose `display_role` is `visitor` (it points at the
bench instead), so a visitor's ranking and pairs are never re-filed as an
owner session.

### The owner-side reads (Phase 3c)

| endpoint | gate | request → response |
| --- | --- | --- |
| `GET api/jd2-queue.php` | origin + bench key; `no-store` | the bench's backlog → `{build, taxonomy_version, instrument_version, axes[], grades[], size_tiers[], facets[], comparison, gaps, models{id: label}, items[], progress{prompts, complete, drawing, cells_filed, cells_total}}`; `?prompt=<id>` one prompt in any state, `?all=1` every prompt, `?reveal=1` adds `model_id`, `?count=1` only `{today:{generations, limit, remaining, since, resets_in_s}}` |
| `GET api/jd2-ledger.php` | origin + bench key; `no-store` | one row per prompt, every visibility → `{build, taxonomy_version, instrument_version, axes[], grades{}, models{}, counts{prompts, live, hidden, draft, bench_open}, items[]}`; `?prompt=<id>` one prompt |
| `GET api/jd2-analytics.php` | origin; public; `Cache-Control: no-cache`, ETag and 304 (as data.php) | v1's `jd-analytics.php` keys and shapes (`totals, models, cost, firsts, grades, axes, spend, turns`) from the jd2 tables, each `axes[]` entry also carries `values [{rank, label}]` best first (v35), plus `pairs{models, matrix, wins, bt}`, `margins[]` and `tags{facet: {heading: {label, n, by_model{model: {mean, n}}}}}`; `?origin=owner\|visitor`; `?tag=<facet>:<heading>` keeps the prompts filed under that heading (population and spend; 400 for a heading the taxonomy lacks) |

**The bench run and "open".** A prompt's bench run is `shown_run_id`, else its
newest run (`jd2_bench_view`). The prompt is OPEN on the bench when that run
has SETTLED (every dealt slot has a generation and none is pending —
`jd2_run_settled`), at least one drawing counts, the prompt is not hidden, and
the owner's current session on it is missing or incomplete; DONE when the
owner's current session is complete. A visitor's complete sitting never closes
the owner's backlog. `needs` are plain words over slots (`jd2_needs`: no grade,
axes unanswered, ranked k of n, pairs scored k of n). The bench is blind: a
queue response carries `generation_id, slot, svg_url, hidden`, the owner's
latest sitting as `prefill {grade, axes, rank_pos, gap_after}` and the
visitor's current one as `visitor {grade, axes, rank_pos}`; the item carries
`pairs_prefill [{slot_a, slot_b, score, source}]` and `prefill_pruned`. The
prefill carries only what a sitting filed now can file: a value on a defunct
axis, or off its axis's current scale (a grade off the grade scale), is
dropped, and `prefill_pruned: true` says it was (the card prints "earlier
answers on a retired or rescaled axis were not carried over"; `curateOpen`
applies the same rule). DONE and `needs` judge the owner's sitting by its
own `required_cells`, and `progress` counts each prompt's cells against
them.

**The ledger's states.** `drawer.state`: `shown` (live, and a run stands —
`shown_run_id`, else the newest run with a complete display session),
`hidden`, `draft`, `incomplete` (live, no run stands); `drawer.shows` and
`drawer.rule` name the drawing by data.php's rule (`jd2_shows`: the pin when it
is in the run, else 1st place, else first by slot). `bench.state`: `done`,
`open`, or `off` (hidden, still drawing, nothing survived). Every run lists
every generation (any status, with its `cost_usd` snapshot and latency), every
session filed on it (`current`, `required_cells` and `complete` per session —
history, not folded away; `complete` against its own cells), and `display`: the run's display session (`jd2_display_session` with its
owner-first fallback; `complete` says which) as grades, axes, notes, ranks,
gaps and pairs keyed by generation id. The ledger page's SAVE files a new
owner session through `jd2-rate.php` carrying that standing with the edited
grade and axis cells (places and pairs carried as they are: direct pairs sent
as direct, derived ones re-derived from the carried gaps), `blind: false`.
When the display standing is a visitor's, SAVE refuses and links the bench
(`index.php?bench&prompt=<id>`): a visitor's ranking and pairs are never
copied into an owner session.

**Analytics v2.** Population: every run of every LIVE prompt, and on each run
ONE session — `jd2_display_session` (the owner's current complete session,
else the visitor's) — so no drawing is ever rated by two raters averaged
together; only counting drawings (ok, not hidden). Both origins by default,
`?origin=` keeps one. `firsts` = rank-1 share over the runs with two or more
counting drawings a model survived in. `cost` averages the `cost_usd`
snapshots of surviving drawings; `spend` and `totals.cost_usd` sum every priced
drawing of the origin filter whatever its visibility or status (spend is
spend); NULL cost is never $0. `pairs.matrix[i][j]` = `[mean score of model i
over model j, n]` (antisymmetric; diagonal and unmet `[null, 0]`); `wins` from
each score's sign (0 = a tie); `bt` = Bradley–Terry log-strengths by Hunter's
MM iteration with ties as half a win each and one virtual tie per pair of
models that met, normalised to a mean log-strength of 0 (`P(i over j) =
1/(1+exp(s_j − s_i))`); `margins[]` = per pair of models that met,
`{model_a, model_b, mean, n, hist{"-3".."3"}}`, signed for `model_a`. No model
id is hard-coded; no `jd_*` table is read.

**Owner scripts.**

- `scripts/jd2-export.py` (`--sqlite PATH` | `--mysql` with `JD_DB_*`; from
  the owner's machine `JD_DB_HOST=municipalsky.com`) — JSONL, one line per
  prompt with its runs, generations (`--include-svg`, `--include-raw`) and
  every session's judgments, rankings and pairs; `--standing out.csv` one row
  per generation with its run's display session's cells; `--pairs out.csv` one
  row per pair of every display session. Its one rule is the display session
  (owner's current complete, else visitor's current complete).
- `scripts/jd2-batch-run.php prompts.csv [--profile bench-medium|bench-low|bench-max]
  [--base URL] [--dry-run] [--resume]
  [--rate-url] [--local] [--state PATH]` — the CSV batch runner (CLI only;
  `JD_BENCH_KEY` from the environment, never printed). Columns `prompt`
  (required), `title`, `size`, `category`, `v1_item_id`, `rerun_of`. Each row
  is drawn through `jd2-generate.php` under `--profile` (default
  `bench-medium`; sent explicitly on every request), ONE model per
  request, the pool's slots in sequence (curl waits `JD_BENCH_TIMEOUT` + 30
  s); title, size and category file through `jd2-curate.php`; `v1_item_id`
  rides on the first slot of a new prompt (and is filled automatically when
  the prompt text is exactly a legacy item's). A row with no `rerun_of`
  whose text is exactly an owner prompt already on file (any profile, not
  hidden; one `jd2-ledger.php` read before anything is drawn; the oldest
  wins) is filed as a RERUN of it, so one prompt under three settings is
  three runs of one prompt; `--dry-run` prints the profile and `new prompt` /
  `rerun <id>` per row. State in `local-dev/jd2-batch-state.json` (per base
  URL, keyed `[profile] prompt text`: the minted `client_ref`, the profile,
  ids, `rerun_of`, each slot's outcome; pre-split entries keyed by text alone
  are never resumed) — written before the first request and after every
  answer, so `--resume` finishes a stopped row without filing twice (a rerun
  whose first answer was lost is rejoined from the ledger, not re-made). It refuses to start when the plan needs more drawings than today's
  breaker has left (`jd2-queue.php?count=1`). `--local` runs against its own
  `php -S` with `JD_DEV_MOCK=1` (the hermetic test path).

`jd2-generate.php` takes one more owner field for the runner: `v1_item_id`
(`YYYY-MM-DD-slug`), filed on a NEW prompt only. `jd2-curate.php` takes
`category` (≤ 32 characters; null clears it), `tags` (the whole classification,
every facet present, validated with `jd2_tags_check`; null clears it) and
writes `size_by = 'owner'` with any `size_class` it files.

The intake facts ride every owner-side read: `jd2-queue` items and
`jd2-ledger` rows carry `tags`, `size_by`, `intake_version`, `intake_model`,
`intake_at`, the clerk's `reasons`, `fallback` and `intake_error` (the ledger
also `intake_cost_usd`; both payloads name `facets`, and `size_tiers`;
`jd2-queue` items also carry `title_on_file`, the heading as filed or null,
beside `title`, the heading the card prints); `data.php` items carry `tags` and `size_by`. The export
carries `tags`, `size_by` and `intake_*` on each prompt, and `size_class`,
`size_by` and one `tags_<facet>` column per facet in the standing CSV. The
batch runner calls intake after a new row's first drawing (skipped for
`rerun_of` rows and when the CSV gave a title and a size) and logs what the
clerk filed; the CSV's own title and size, filed through `jd2-curate.php`
after the drawings, stand over the clerk's.

## History

- 2026-10-01 — the seven `jd2_*` tables (Phase 2 of PLAN-V2), with the
  reserved `approved_at` / `approved_by` on `jd2_prompts`; `taxonomy.json` v26
  (`instrument` `v2.0`, `comparison`, `gaps`, the pool fields, `poolVersion`);
  the deploy runs the v2 runner after the v1 runner. No rows yet; the readers
  and writers are Phase 3.
- 2026-10-01 — Phase 3b: the jd2 endpoints (generate, title — since
  replaced by intake — rate, curate,
  gen-svg) and `data.php` on the jd2 tables; the "Endpoints" section above.
  No schema change.
- 2026-10-01 (evening) — `jd2_prompts.category` and `jd2_sessions.note` added as guarded additive migrations (the owner's notes: a categorised ~100-prompt set; a rationale per sitting).
- 2026-10-01 — Phase 3c: the owner-side reads (`jd2-queue`, `jd2-ledger`,
  `jd2-analytics` with pairwise and Bradley–Terry), `scripts/jd2-export.py`,
  `scripts/jd2-batch-run.php`, `ledger.html` on v2; `jd2-generate` takes
  `v1_item_id`, `jd2-curate` takes `category`. No schema change.
- 2026-10-02 — intake (PLAN-INTAKE): `jd2_prompts.size_by`, `tags`,
  `intake_version`, `intake_model`, `intake_json`, `intake_cost_usd`,
  `intake_at`, guarded additive migrations (in the CREATE too); the word list
  `JD2_SIZE_BY` in `jd2-config.php`. `api/jd2-intake.php` replaces
  `jd2-title.php`; `jd2-rate` files `size_by` and never a NULL size;
  `jd2-curate` takes `tags`; the readers, the export and the batch runner
  carry the intake facts; `jd2-analytics` gains `?tag=` and `tags`;
  `taxonomy.json` v28 (`facets`, `intakeVersion`, `utility.intake`).
- 2026-10-02 — the bench's catalogue entry card (VERSION 0.13.0): `jd2-queue`
  adds `facets` to its payload and `title_on_file` and `intake_error` to each
  item. The bench files the entry's changed fields (`title`, `size_class`,
  `tags`) through `jd2-curate` first, then the sitting through `jd2-rate`
  without `size`. No schema change.
- 2026-10-02 — the effort profiles split: `JD2_PROFILE` gains `bench-max`,
  `bench-medium`, `bench-low` (`bench` kept for the runs already filed under
  it, retired); `JD2_OWNER_DEFAULT_PROFILE` `bench-medium`; per-profile output
  budgets (`JD_MAX_TOKENS_BY_PROFILE`, bench 64000); harness ids
  `v4-bench.4`, `v4-benchmed.1`, `v4-benchlow.1`. No MySQL change (VARCHAR);
  dev SQLite files are recreated. The batch runner gains `--profile` and
  reruns of prompts already on file.
- 2026-10-02 — `jd2_generations.normalized` (`VARCHAR(64) NULL`), a guarded
  additive migration (in the CREATE too); the word list `JD2_GEN_NORMALIZED`
  in `jd2-config.php`. The sanitizer unwraps CDATA sections instead of
  rejecting them (`element_not_allowed` before) and reports it;
  `jd2-generate` files it. `api/jd2-resanitize.php` recovers drawings the
  old rules rejected (Runbook).
- 2026-10-02 — the model-pool refresh: `poolVersion` `pool-2026-10-02b`
  (taxonomy v33: `claude-opus-5-5` and `gpt-6.1-sol` join, `claude-opus-5` and
  `gpt-5-1` leave the pool and stay registered); harness ids `v4-web.4` and
  `v4-bench.5`; `jd-prices.json` rows for the two new wire ids. No schema
  change.
- 2026-10-02 — taxonomy v35 (Paintwork; `structural-coherence` →
  `structural-coherence-2`, 4-point): `jd2_sessions.required_cells` (TEXT
  NULL, JSON), a guarded additive migration in both dialects (in the CREATE
  too), stamped by `jd2-rate`; the runner's one-off backfill of sessions
  `< v35` (see "Rules readers rely on"); every completeness/display reader
  judges a sitting by its own cells. `jd2-analytics` axes gain `values`
  (`{rank, label}`, best first); `jd2-queue` items gain `prefill_pruned`;
  `jd2-ledger` sessions gain `required_cells`; the export carries each
  session's `required_cells` and keeps a column for every retired axis a v2
  rubric required (`structural-coherence`).
- 2026-10-03 — `api/jd2-reset.php`, the one-shot pre-campaign reset (see
  "Reset"): every `jd2_*` row deleted once, by the owner, before the
  campaign's first sitting, with a dry run, a state-bound confirmation token
  and a record outside the web root; `scripts/jd2-batch-run.php
  --forget-state`. No schema change.
