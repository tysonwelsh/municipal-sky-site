# The Junk Drawer — dataset v1 archive (runbook)

The v1 data is the five `jd_*` tables described in `junk-drawer-schema.md`,
plus `art/junk-drawer/items/`. It is being replaced by a v2 dataset. v2 lives
in its own tables, uses its own instrument, and is never pooled with v1. This
file says where the v1 copy is, how to rebuild it, and what "frozen" means.
The design is `art/junk-drawer/PLAN-V2.md` §0, §1, §4, §7 and §9 Phase 1. Like
every `PLAN-*.md` here, that file is gitignored and exists only in the owner's
checkout.

## Where it is

`~/Media/junk-drawer-v1/<date>/` on the owner's machine. It is outside the
repo and never deployed, because the tables hold visitor prompt text. The
first snapshot is `~/Media/junk-drawer-v1/2026-10-01/`, and the git tag
`junk-drawer-v1-final` is on the matching commit (local and unpushed until the
owner pushes it).

| file | what |
|---|---|
| `jd-tables-<date>.sql` | `mysqldump` of exactly the five `jd_*` tables (DDL + one INSERT per row) |
| `counts.txt` | row count per table, live vs dump |
| `jd-evals-<date>.jsonl` | `scripts/export-jd-evals.py --mysql --include-svg --include-raw` |
| `summary.txt` | the same export's `--summary` (stderr) |
| `v1-current-standing.csv` | one row per ok generation, today's fold applied once (`scripts/jd-v1-standing.py`) |
| `v1-pairwise-derived.csv` | derived pairwise outcomes (`scripts/jd-v1-pairwise.py`) |
| `items/`, `taxonomy-v25.json` | copies of `art/junk-drawer/items/` and `taxonomy.json` |
| `README.md` | counts, commands, the precedence rule, caveats |

2026-10-01 snapshot: 227 submissions, 907 generations (899 ok), 3,949
ratings, 503 ranks, 118 comparisons. The dump and the export agree row for
row.

## How to regenerate

Work from a worktree, never the main checkout. The database is
`municipalsky.com:3306` with `db_name` / `db_user` / `db_pass` from
`config/secrets.php`. That file has no host key, and `database.php`'s
`localhost` is wrong from a laptop. Read the password into the environment
with `php -r`. Never print it, and never put it in argv or a file.
`mysqldump` is under `~/anaconda3/bin/` (5.7 client: no
`--column-statistics`).

```sh
D=~/Media/junk-drawer-v1/$(date +%F); mkdir -p "$D"
export MYSQL_PWD="$(php -r '$s=require "config/secrets.php"; echo $s["db_pass"];')"
U="$(php -r '$s=require "config/secrets.php"; echo $s["db_user"];')"
N="$(php -r '$s=require "config/secrets.php"; echo $s["db_name"];')"

mysqldump -h municipalsky.com -P 3306 -u "$U" --single-transaction --skip-lock-tables \
  --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 --skip-extended-insert \
  "$N" jd_submissions jd_generations jd_ratings jd_ranks jd_comparisons > "$D/jd-tables-$(date +%F).sql"
# counts: SELECT COUNT(*) per table, vs  grep -c '^INSERT INTO `<table>` VALUES'  on the dump

JD_DB_HOST=municipalsky.com JD_DB_NAME="$N" JD_DB_USER="$U" JD_DB_PASS="$MYSQL_PWD" \
  python3 scripts/export-jd-evals.py --mysql --include-svg --include-raw --summary \
  --out "$D/jd-evals-$(date +%F).jsonl" 2> "$D/summary.txt"

cp -Rp art/junk-drawer/items "$D/items"; cp -p art/junk-drawer/taxonomy.json "$D/taxonomy-v25.json"
python3 scripts/jd-v1-standing.py --jsonl "$D"/jd-evals-*.jsonl --taxonomy "$D/taxonomy-v25.json" \
  --out "$D/v1-current-standing.csv"
python3 scripts/jd-v1-pairwise.py --jsonl "$D"/jd-evals-*.jsonl --out "$D/v1-pairwise-derived.csv"
```

The two derived files read only the JSONL and the taxonomy. They can be rebuilt
from an archive folder alone, with no database. Every command above reads
only: SELECT, mysqldump, or the read-only export. Do not run
`api/setup-jd-tables.php`, `jd-backfill-curated.php` or any writing `jd-*`
endpoint as part of archiving (`jd-bench-run.php` was removed at the
cutover).

**The precedence rule** the standing CSV applies is the one in
`api/jd-config.php` (`jd_fold_ratings`, `jd_pick_rating(['bench','*'])`,
`jd_rank_by_generation`). Rows are folded per generation per client, with the
latest (rated_at, id) row winning each cell. Only live axes count. The bench
wins each cell, then the other clients in the order they first filed. For
ranks, the bench's row wins, otherwise the first read. The full statement is in
the header of `scripts/jd-v1-standing.py`. If the PHP rule ever changes, the
archive keeps the rule as of the `junk-drawer-v1-final` tag.

## What "frozen" means

- **Frozen as of 2026-10-01 (the v2 cutover, Phase 5).** Before then v1 was
  live, and a snapshot was only a snapshot. If anything was filed between the
  2026-10-01 snapshot and the freeze, take a last one and move the
  `junk-drawer-v1-final` tag.
- **Nothing writes to `jd_*`.** `JD_V1_FROZEN = true` in `api/jd-config.php`
  makes every v1 writer (`jd-generate`, `jd-rate`, `jd-item-rate`,
  `jd-curate`, `jd-title`, `jd-harvest`) answer 410 `dataset_frozen`.
  `jd-bench-run.php` was removed. The deploy still calls
  `setup-jd-tables.php` (idempotent; its one row-moving migration, the
  2026-09-05 flag fold, has nothing left to fold) and
  `jd-backfill-curated.php`, which answers `done` and files nothing while
  frozen, so the deploy step needed no change.
- **The tables stay where they are, read-only.** No `ALTER`, no rename, no
  `DROP`, no backfill into or out of v2. v2 records lineage to a v1 item id;
  it never copies v1 rows.
- **`art/junk-drawer/items/` stays on disk at its paths**, so links and social
  renders keep working. After the cutover `data.php` no longer reads it. A move
  to `archive/v1-items/` is optional housekeeping and not part of the cutover.
- The archive folder is the analysis copy. Analyses read the CSVs and the
  JSONL, not the live tables.

## Caveats carried with the data

- The owner's own blind ratings are `client = 'web'`. The owner is, in
  practice, the visitor.
- `client = 'seed'` rows were copied from `entry.json` by the curated
  backfill/sync. They are not new judgments.
- Comparisons after 2026-08-22 have NULL margins (the podium files an order).
  Only the 38 rows from 2026-08-14 → 08-22 carry `decisive`/`slight`, and most
  of those picked one winner from three or four drawings.
- Only taxonomy v17+ ratings are on the current four axes.
