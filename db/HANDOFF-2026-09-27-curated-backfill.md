# Handoff — put every Junk Drawer rating in the database (2026-09-27)

**For:** a fresh Claude Code session, working in `~/Sites/municipal-sky-site`.
**From:** the session that was copy-editing `/art/junk-drawer/about/` and
tripped over this. **Owner:** Tyson. Read this whole file before touching
anything live.

## The goal, in the owner's words

> "I'd like all of the items to be getting their data from the same place."

Every rating the drawer shows should come from the MySQL database. Right now
the ratings for some drawings live only in their item's `entry.json` file,
and the database has no rows for those drawings at all. That split is why a
rating could not be saved today. The job is to finish the migration the code
was already built for, safely, and leave the system easier to maintain.

## What is already established (with evidence)

1. **The root cause is a migration that never ran on production.** On
   2026-09-10 (commit `82c0cbc`, "the report card is the editor; sixteen slots
   for rerun sets") the code began filing up to sixteen responses per curated
   item, which needs `jd_generations.slot` widened from `a–d` to `a–p`.
   `api/setup-jd-tables.php` does that (see the block commented
   "jd_generations.slot: 'd' arrived 2026-08-14 …"), and
   `db/junk-drawer-schema.md` says to run it after deploying. It was not run.
   - Live check, today: `SHOW COLUMNS FROM jd_generations LIKE 'slot'` →
     `enum('a','b','c','d')`.
   - Live `api/error_log` (fetched read-only over FTP):
     `jd-item-rate: curated sync failed — SQLSTATE[01000]: Warning: 1265 Data
     truncated for column 'slot' at row 1` on 10-Sep-2026 (twice) and
     27-Sep-2026.
2. **Consequence.** Every curated item that has been rerun (21 of 67 when the
   sixteen-slot change landed; a rerun appends four responses) has database
   rows only for its first four responses. Responses 5+ have no
   `jd_generations` row, so their ratings exist only as `annotations` in
   `entry.json`. The report card shows them from the file (data.php falls back
   to the entry when the database has nothing), and neither the admin editor
   (`?admin`) nor `api/jd-item-rate.php` can save them — both run the curated
   sync first, and the sync dies on slot `e`.
   - Example: `2026-07-28-desktop-succulent`. The ledger
     (`api/jd-ledger.php`, bench-key gated) reports: "4 response(s) in the
     entry have no database row yet — re-run the backfill" (r4–r7).
3. **The fix is the designed path, not a new one.** `api/jd-curated-sync.php`
   (a library) + `api/jd-backfill-curated.php` (the bulk runner) file missing
   responses as `jd_generations` rows and copy the entry's grade and live-axis
   annotations in as `client = 'seed'` rating rows, plus the harvest's ranks as
   seed ranks. It is incremental (appends past the rows already on file),
   idempotent, one transaction per item, and never touches existing rows. The
   bench's own answers outrank seeds everywhere (`jd_pick_rating` with
   `['bench', '*']`). Read the banner at the top of `jd-curated-sync.php`.
4. **Precedence already favors the database.** `data.php` lays the database's
   word over each curated entry at request time (read CLAUDE.md in
   `art/junk-drawer/`, section "Ratings now live in the DATABASE"). After the
   backfill, the database is the source for every response; `entry.json` stays
   as the permanent record of what each harvest filed.
5. **Analytics are turn-only, so seeds do not double-count.**
   `api/jd-analytics.php` counts grade/axis rows only for generations of real
   visitor turns (`item_id IS NULL`), from taxonomy v17 onward, all clients
   together. Curated-item seed rows are excluded from model performance.
6. **Deliberate duplication, leave it.** A rerun's drawings exist twice in the
   database: once under the rerun TURN (the owner's original blind ratings,
   `client = 'web'`, which the analytics count) and once under the CURATED item
   (what the report card shows). Merging them would change the position join
   every reader relies on. Out of scope.

## Changes already made today (so you are not surprised by them)

- `art/junk-drawer/items/2026-07-28-desktop-succulent/entry.json`: r6 (Gemini
  3.1 Pro) `understanding-assignment` 3.0 → 2.0; r4 (Kimi K3)
  `structural-coherence` 3.0 → 2.0. Owner-requested, treated as the original
  ratings. **Pushed live** with `scripts/push-files.sh` (one file) and verified
  in live `data.php`. **Not committed.** When the backfill seeds this item, it
  will copy these new values — correct.
- The rerun turn's own rows for those two drawings still hold the old values
  (they feed the analytics; ~0.01 on each average). No endpoint edits a
  visitor-client row. If the owner wants them exact, these two statements do
  it — show them to the owner and run only with a yes:
  ```sql
  UPDATE jd_ratings SET value = 2 WHERE generation_id = '01M181QE6RA56XQQ89N6SV4T4Y'
     AND kind = 'axis' AND axis_id = 'understanding-assignment' AND client = 'web';
  UPDATE jd_ratings SET value = 2 WHERE generation_id = '01M181QE6PTP5HQ09DGZM6ZT66'
     AND kind = 'axis' AND axis_id = 'structural-coherence' AND client = 'web';
  ```
  (Gemini and Kimi generations of rerun turn `01M181QE6M7FVDM8JMXAGJ2KVM`.
  Verify each matches exactly one row with a SELECT first.)

## Access you have

- **Live MySQL, remotely.** `municipalsky.com:3306` accepts connections with
  the credentials in `config/secrets.php` (`db_name`, `db_user`, `db_pass`;
  the file is gitignored). `mysql` and `mysqldump` are on the PATH (anaconda).
  Pass the password via `MYSQL_PWD` read from the secrets file with `php -r`;
  never print it.
- **A full backup already exists:**
  `~/Desktop/municipal-sky-db-backup-2026-09-27.sql` (124 MB, 77 tables,
  mysqldump `--single-transaction`, taken 18:06 local, before any change).
  Take a FRESH one immediately before your first write anyway.
- **Keys.** `jd_setup_key` is in `config/secrets.php` (gates
  `setup-jd-tables.php` and `jd-backfill-curated.php`). The local copy may be
  stale — the local file had no `jd_bench_key` at all and the owner supplied
  that one in chat. If the setup key is refused, ask the owner; do not guess
  (the endpoints throttle wrong keys per address). The owner shared the bench
  key in chat today; recommend they rotate it (it is short) — do not write it
  into any file.
- **Live FTP (read + targeted push)** via `.vscode/sftp.json`, used by
  `scripts/push-files.sh`. Server PHP errors land in `api/error_log`.
- **Local dev server** (owner's): `php -S 127.0.0.1:8047 -t . local-dev/router.php`
  proxies `data.php` and `/api/*` to production. So local pages show LIVE data.

## The plan (owner-approved in outline; confirm each live write)

1. **Read first.** `art/junk-drawer/CLAUDE.md`, `db/junk-drawer-schema.md`,
   `api/setup-jd-tables.php`, `api/jd-curated-sync.php`,
   `api/jd-backfill-curated.php`. Confirm the LIVE copies of those three PHP
   files match the repo (fetch over FTP and diff) — the live server may be
   behind or ahead of Git.
2. **Fresh backup** (mysqldump as above, new timestamped file on the Desktop).
3. **Run the setup script** on production:
   `https://municipalsky.com/api/setup-jd-tables.php?key=<jd_setup_key>`.
   It is idempotent and prints one line per migration ("already present" /
   "widened" / "FAILED"). Read every line: other migrations may also be
   pending (the README asks for a run after the 2026-09-05 consolidation too).
   Verify `slot` is now `enum('a',…,'p')`.
4. **Backfill, dry run:**
   `https://municipalsky.com/api/jd-backfill-curated.php?key=<jd_setup_key>&dry-run=1`.
   Show the owner the per-item report (items, rows to file, seeds, levels).
5. **Backfill, for real** (same URL without `dry-run`), after the owner says go.
6. **Verify.**
   - Ledger: no item reports "no database row yet".
   - `data.php?item=2026-07-28-desktop-succulent`: r4/r6 still show today's
     values (Kimi SC 2, Gemini UA 2) — now from seed rows.
   - Spot-check two other rerun items the same way (compare `data.php` before
     and after — the displayed ratings must not change).
   - `api/jd-analytics.php` totals unchanged (seeds are curated-only).
   - A save through `?admin` on a response past slot `d` now succeeds.
7. **Write it down.** Update `db/junk-drawer-schema.md` (the 2026-09-10 note
   becomes "ran on <date>") and `art/junk-drawer/CLAUDE.md` if the procedure
   changed. Add a rule so this cannot recur — e.g. a line in the deploy
   checklist, or have `jd-curated-sync.php` detect the narrow ENUM and fail
   with a message that names `setup-jd-tables.php` instead of a raw SQLSTATE.
8. **Maintainability (propose, don't just do).** Going forward, ratings are
   changed in `?admin`, not by editing `entry.json`. Discuss with the owner
   whether harvest scripts should keep writing annotations into entry files at
   all now that the sync seeds them, and whether any other code still reads
   ratings from files first.

## Rules of the road in this checkout

- **Shared checkout.** Other sessions (and the about-page work) have
  uncommitted changes in this tree: `art/junk-drawer/about/*`, `jd-core.js`,
  `jd-record.js`, `data.php`, `_slim.php`, `taxonomy.json`, `VERSION`,
  `scripts/capture-drawer-poster.js`, `art/kolob/*`. **Never `git add -A`,
  never run `/publish-site`** (it ships everyone's uncommitted work). If you
  commit, stage your own files by name.
- **Don't auto-publish.** Live writes are the owner's call, one at a time.
- **Report faithfully.** If a step fails, show the exact output; do not
  improvise schema changes by hand when a repo migration exists for them.
- `.md` files are never deployed; this file is safe where it is.

## Outcome (2026-09-27, evening — the session this was written for)

Everything above checked out; two facts were larger than written. The
database held only 38 of 49 live items (18 turn-promoted items from mid-August
on had never been filed at all), and the same unrun deploy had also left
`jd_submissions.device_ref` missing, so visitor turns carried no device code
for seventeen days.

Done, in order, each with the owner's go: fresh backup
(`~/Desktop/municipal-sky-db-backup-2026-09-27-1850.sql`, 124 MB, 77 tables);
`setup-jd-tables.php` (slot widened, `device_ref` + index added, all else
already present); the backfill (18 filed, 21 appended, 6 levelled, 10 current;
154 generations, 154 seed grades, 616 seed axes, 270 levelled rows). A second
dry run reports nothing left to do. The ledger reports no missing rows. The
`data.php` payloads for every curated item show the same response and the
same grades/annotations as before (seed ranks now ride along as `rank` on the
promoted items). The analytics charts are identical; `totals.rated_responses`
rose 342 → 506 because that counter deliberately includes curated seeds
("the owner's filing work, not a scoreboard" — see the header of
`api/jd-analytics.php`), so the handoff's "totals unchanged" was one counter
too broad.

Not done: the optional two `UPDATE`s on the rerun turn's own rows (owner's
call, each matches exactly one row, both currently 3.0); the `?admin` save
test past slot `d` (owner to try). Added the same day: `jd_slot_capacity()`
in `jd-curated-sync.php` and an up-front refusal in `jd-backfill-curated.php`,
and the Runbook in `db/junk-drawer-schema.md`.
