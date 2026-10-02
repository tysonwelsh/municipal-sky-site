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
| `category` | the owner's prompt-set category, a free word (ROADMAP, 2026-10-01); NULL for visitor prompts |
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
| `POST api/jd2-generate.php` | origin; visitor needs consent; `profile`/`rerun_of`/`run_id` need the key | `{client_ref, slot, prompt, client, consent:{version}, device_ref?, website}` (owner also `profile` default `bench`, `rerun_of`, `run_id`) → `{ok, svg, gen_id, slot, run_id, prompt_id, submission_id}` |
| `POST api/jd2-title.php` | origin; the `client_ref` must be a prompt filed in the last hour | `{client_ref, prompt}` → `{ok, title}` (advisory; nothing stored) |
| `POST api/jd2-rate.php` | origin; visitor: only their own turn — a run a visitor requested whose prompt's `client_ref` the request carries (missing or wrong → 403 `not_yours`) — and one filed session per run (409 `already_rated`); owner: the bench key, no `client_ref` | `{run_id, client_ref (visitor), client, device_ref?, title?, size?, suppress?, ratings:[{slot, kind, axis_id?, value, note?}], ranking:[{slot, rank, gap?}]\|null, pairs:[{slot_a, slot_b, score, shown_left?}]\|null, blind?}` → `{ok, build, session_id, run_id, prompt_id, complete, reveal:[{slot, model_id, label, vendor, status, tokens?, cost_usd?, priced?}]}` |
| `POST api/jd2-curate.php` | origin + bench key | `{prompt_id, visibility?, shown_run_id?, pinned_generation_id?, title?, size_class?, size_scale?}` or `{generation_id, hidden}` → `{ok, build, prompt:{…}, runs:[{…, generations, sessions, display_session_id, complete}]}` |
| `GET api/jd2-gen-svg.php?gen=<id>` | origin; public when the prompt is `live` and the drawing not hidden, else bench key; otherwise 404 | → `image/svg+xml`, `nosniff`; a public answer (no key presented) is `private, max-age=86400` with a strong ETag (md5 of the svg) and 304 on `If-None-Match`; a keyed or non-public one is `no-store` |
| `GET art/junk-drawer/data.php` | public | → `{generated, count, taxonomy, items, errors:[]}`, ETag (taken over its own reads: the session and generation aggregates, the prompts, runs and drawings it serves); `?item=<prompt_id>` any visibility (`hidden: true` unless live); `?slim=1` via `_slim.php`; a database outage answers an empty manifest |

**jd2-generate.** The first request for a `client_ref` files the prompt
(`visibility` `draft`) and its `initial` run in one transaction; the
prompt's UNIQUE `client_ref` is where the parallel slot requests converge, so
the owner's new prompts file their `client_ref` too (the other visitor fields
stay NULL for them). The deal is drawn once there (`jd2_deal`), and each slot
fills its generation with the dealt model under the run's profile (`web` for
visitors, `bench` by default for the owner) — effort, harness, timeout —
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
written).

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
3. **Complete** — every non-hidden ok drawing has a grade and every live axis
   of the taxonomy; with more than one drawing, a ranking places them all in
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
| `GET api/jd2-queue.php` | origin + bench key; `no-store` | the bench's backlog → `{build, taxonomy_version, instrument_version, axes[], grades[], size_tiers[], comparison, gaps, models{id: label}, items[], progress{prompts, complete, drawing, cells_filed, cells_total}}`; `?prompt=<id>` one prompt in any state, `?all=1` every prompt, `?reveal=1` adds `model_id`, `?count=1` only `{today:{generations, limit, remaining, since, resets_in_s}}` |
| `GET api/jd2-ledger.php` | origin + bench key; `no-store` | one row per prompt, every visibility → `{build, taxonomy_version, instrument_version, axes[], grades{}, models{}, counts{prompts, live, hidden, draft, bench_open}, items[]}`; `?prompt=<id>` one prompt |
| `GET api/jd2-analytics.php` | origin; public; `Cache-Control: no-cache`, ETag and 304 (as data.php) | v1's `jd-analytics.php` keys and shapes (`totals, models, cost, firsts, grades, axes, spend, turns`) from the jd2 tables, plus `pairs{models, matrix, wins, bt}` and `margins[]`; `?origin=owner\|visitor` |

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
`pairs_prefill [{slot_a, slot_b, score, source}]`.

**The ledger's states.** `drawer.state`: `shown` (live, and a run stands —
`shown_run_id`, else the newest run with a complete display session),
`hidden`, `draft`, `incomplete` (live, no run stands); `drawer.shows` and
`drawer.rule` name the drawing by data.php's rule (`jd2_shows`: the pin when it
is in the run, else 1st place, else first by slot). `bench.state`: `done`,
`open`, or `off` (hidden, still drawing, nothing survived). Every run lists
every generation (any status, with its `cost_usd` snapshot and latency), every
session filed on it (`current` and `complete` per session — history, not folded
away), and `display`: the run's display session (`jd2_display_session` with its
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
- `scripts/jd2-batch-run.php prompts.csv [--base URL] [--dry-run] [--resume]
  [--rate-url] [--local] [--state PATH]` — the CSV batch runner (CLI only;
  `JD_BENCH_KEY` from the environment, never printed). Columns `prompt`
  (required), `title`, `size`, `category`, `v1_item_id`, `rerun_of`. Each row
  is drawn through `jd2-generate.php` under the `bench` profile, ONE model per
  request, the pool's slots in sequence (curl waits `JD_BENCH_TIMEOUT` + 30
  s); title, size and category file through `jd2-curate.php`; `v1_item_id`
  rides on the first slot of a new prompt (and is filled automatically when
  the prompt text is exactly a legacy item's). State in
  `local-dev/jd2-batch-state.json` (per base URL, by prompt text: the minted
  `client_ref`, ids, each slot's outcome) — written before the first request
  and after every answer, so `--resume` finishes a stopped row without filing
  twice. It refuses to start when the plan needs more drawings than today's
  breaker has left (`jd2-queue.php?count=1`). `--local` runs against its own
  `php -S` with `JD_DEV_MOCK=1` (the hermetic test path).

`jd2-generate.php` takes one more owner field for the runner: `v1_item_id`
(`YYYY-MM-DD-slug`), filed on a NEW prompt only. `jd2-curate.php` takes
`category` (≤ 32 characters; null clears it).

## History

- 2026-10-01 — the seven `jd2_*` tables (Phase 2 of PLAN-V2), with the
  reserved `approved_at` / `approved_by` on `jd2_prompts`; `taxonomy.json` v26
  (`instrument` `v2.0`, `comparison`, `gaps`, the pool fields, `poolVersion`);
  the deploy runs the v2 runner after the v1 runner. No rows yet; the readers
  and writers are Phase 3.
- 2026-10-01 — Phase 3b: the jd2 endpoints (generate, title, rate, curate,
  gen-svg) and `data.php` on the jd2 tables; the "Endpoints" section above.
  No schema change.
- 2026-10-01 (evening) — `jd2_prompts.category` and `jd2_sessions.note` added as guarded additive migrations (the owner's notes: a categorised ~100-prompt set; a rationale per sitting).
- 2026-10-01 — Phase 3c: the owner-side reads (`jd2-queue`, `jd2-ledger`,
  `jd2-analytics` with pairwise and Bradley–Terry), `scripts/jd2-export.py`,
  `scripts/jd2-batch-run.php`, `ledger.html` on v2; `jd2-generate` takes
  `v1_item_id`, `jd2-curate` takes `category`. No schema change.
