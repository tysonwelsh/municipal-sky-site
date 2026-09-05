# ADMIN-MODE.md — admin mode: the owner adjusts ratings from the report card

Status: **PLANNED, not built** (owner request 2026-09-05). Nothing in this
document is live. When it is built, the steps in §7 are the checklist.
(Named ADMIN-MODE.md rather than PLAN-ADMIN.md because `.gitignore` keeps
`PLAN-*.md` local; this one is meant to be read from the repo.)

## 1. What the owner asked for

1. A URL extension, like `?bench`, that puts the drawer in **admin mode**.
2. In admin mode, opening an item's **report card** offers to **change the
   ratings** that exist (write mode instead of read-only).
3. Both admin mode and the existing **workbench** (`?bench`) are **gated by
   a secret**, so nobody else can change ratings.
4. Work out how the owner proves they are the admin (how the key is entered
   and remembered).

## 2. What exists today (the parts this builds on)

- **The gate is already written; it is switched off.** `jd_bench_keyed()` in
  `api/jd-config.php` compares `X-Bench-Key` (or `?key=`) against
  `jd_bench_key` in the server's secrets file, falling back to
  `jd_setup_key`. `JD_BENCH_REQUIRE_KEY = false` (owner call, 2026-08-18)
  makes it pass unconditionally. Every bench endpoint already calls
  `jd_require_bench_key()`: bench-queue, item-rate, curate, harvest,
  inventory, and gen-svg for unrated turns. Flipping the constant is the
  whole of gating the workbench on the server side.
- **The bench strip already has a key prompt.** `jd-bench.js` `gate()` asks
  for the key when the queue answers 403, keeps it in `sessionStorage`
  (`jd-bench-key`), and sends it as `X-Bench-Key`. It has never been
  exercised in production because the gate is off.
- **The rating instrument is the turn card**, and the owner rule
  (2026-08-28) is that there is exactly one: bench mode seats an item in
  the real turn card via `JD_turn.curate(job)`. `curateOpen()` already
  **prefills** the grade, axes, rank and size that are on file, opens on
  the first unfinished step, and files the whole item as one batch through
  `jd-item-rate.php`. Adjusting an existing rating is therefore a solved
  UI problem: re-seat the item, change what you want, file.
- **Where ratings are read from differs by item kind.**
  - A *visitor turn* in the drawer is built by `data.php` from the DB, with
    the bench's answers outranking the visitor's (`jd_pick_rating(...,
    ['bench','*'])`, bench rank rows outranking the turn's). An admin edit
    filed under `client='bench'` is therefore **live immediately**.
  - A *curated item* is built from `entry.json`. Bench ratings for it live
    in `jd_ratings` but the drawer does not read them — ROADMAP.md's
    standing item "A read path for DB ratings". An admin edit on a curated
    item is invisible until someone runs `keep-legacy.py` /
    `harvest-rerun.py` and commits. **This plan builds that read path.**
- **Identity of an item across the two worlds.** The bench queue keys items
  by `item_id` (curated: the entry dir name; turns: `turn:<submission_id>`)
  and joins curated generations to `entry.json` responses by position.
  `data.php` gives a turn item `id = winning gen_id` and no submission id.

## 3. Design

### 3.1 The key, and how the owner enters it

- **Two keys, two jobs.** Keep `jd_setup_key` for the two maintenance
  scripts only. Add a separate **`jd_bench_key`** to
  `/home1/tdrivemy/private_config/secrets.php` for admin/bench. It is typed
  on a phone, so it should be a **passphrase the owner can type**, not a
  64-hex string (e.g. four words). The comparison is `hash_equals` either
  way. (If the owner never adds it, the code falls back to `jd_setup_key`,
  so nothing breaks — it is just harder to type.)
- **One gate in the front end**, `JD_admin` in `jd-core.js`, replacing the
  private one in `jd-bench.js`:
  - active when the URL carries `?admin` or `?bench` (bench implies admin);
  - remembers the key in **`localStorage`** (`jd-admin-key`), not
    `sessionStorage`: the owner's own devices, no re-typing per tab; an
    explicit **SIGN OUT** control clears it. (Decision for the owner: keep
    `sessionStorage` if a shared device is a concern.)
  - on load, **verifies** the key against a new, keyed, read-only endpoint
    `GET api/jd-admin-check.php` → `{ok:true, build}` before painting any
    write control; a 403 shows the key prompt (the existing `gate()` UI,
    moved). Every write and every keyed read sends `X-Bench-Key`.
  - never puts the key in a URL (no `?key=` from the page; the server keeps
    accepting it for curl).
- **Server side:** `JD_BENCH_REQUIRE_KEY = true`. Log refused attempts
  (`error_log`, no key material). Optional hardening, cheap: a per-IP
  failure counter in the DB or APCu that answers 429 after N misses in an
  hour; the site is HTTPS-only so the header is not exposed in transit.

### 3.2 Admin mode on the page (`?admin`)

- `jd-bench.js` loads for both `?bench` and `?admin`. `?bench` is the
  queue-driven strip exactly as today. `?admin` paints only the strip's
  tag (**ADMIN**), the key state, and SIGN OUT — no queue walk.
- With the key verified, the **report card** (`jd-record.js`) gains one
  control in its footer: **ADJUST RATINGS**. Nothing else on the card
  changes, and nothing appears for visitors without `?admin` (the visitor
  DOM is byte-identical, which is what the before/after walk will check).
- ADJUST RATINGS closes the card and calls `JD_bench.adjust(itemKey)`:
  fetch the queue (keyed; it already returns every rateable item, rated or
  not), find the item, and open it through the **same** `openItem` path
  the strip uses. Everything on file arrives prefilled; the owner changes
  one axis or a whole ranking and files. The unveil runs as usual; on
  close, the drawer **re-fetches `data.php`** (with `?t=` to defeat the
  edge cache) and reopens the report card on the same item so the change
  is visible at once.
- **Names on the slots.** Bench mode deals blind. For an adjustment the
  owner has just read the model names off the report card, so blindness is
  theatre. Recommendation: the adjust job carries `reveal: true` and the
  slot labels show the model; the first-pass bench stays blind.
  (Owner decision; either is a one-line flag.)
- Item keys: `data.php` adds `submission_id` to every turn item (the
  curated id is already the entry id), so the card can name the item the
  queue knows.

### 3.3 The read path: curated items render DB ratings

This is the ROADMAP item, and admin mode needs it or curated edits stay
invisible.

- Move the queue's curated position-join into `jd-config.php`
  (`jd_curated_generations($db, $itemIds)` → `item_id ⇒ [rid ⇒ gen_id]`),
  reading `entry.json` responses **before** the retired filter so the
  positions line up (the queue already relies on this).
- In `data.php`, after the curated loop and inside the existing
  database-outage `try`: for every curated item, fold the bench's rows
  (`jd_fold_ratings` + `jd_pick_rating(..., ['bench'])`) and **overlay**
  onto each response what the bench has filed — `grade`, each live axis's
  value into `annotations` (keeping the note from `entry.json` when the
  bench filed none), and `rank`. Anything the bench has not filed keeps
  the entry's value. Defunct-axis annotations in the entry are untouched.
- **Which response the card opens on** (`primary`), in order: the entry's
  explicit `primary` pin; else the bench's rank-1 response when a full
  rank set is on file; else the best overlaid grade (today's rule).
  (Owner decision: this makes a bench re-rank re-point the drawer without
  a harvest, which matches the 2026-08-29 "what appears is the re-rated
  set" rule.)
- A DB outage leaves curated items exactly as the files built them, as
  now.
- `harvest-rerun.py` / `keep-legacy.py` keep copying DB → `entry.json`
  for the permanent record; nothing about the files changes. The
  CLAUDE.md "transitional state" paragraph is rewritten to say the drawer
  now renders DB ratings over the entry.

### 3.4 Notes per axis

The report card renders `{value, note}` annotations; the turn card collects
`r.notes[axisId]`; but `jd-item-rate.php`'s batch carries one `note` per
response, riding the first row. Extend the batch with
`notes: {axis_id: text}` written to the axis row's `note` column (the
column exists), have `jd_fold_ratings` carry notes per axis, and overlay
them in §3.3. Without this, an admin edit silently drops the owner's
per-axis remarks.

### 3.5 Scripts that call keyed endpoints

`apply-scraps.py`, `backfill-costs.py`, `harvest-rerun.py`,
`keep-legacy.py`, `promote-turn.py` fetch the queue/harvest/inventory
endpoints from the owner's machine. With the gate on they get 403. Each
reads `JD_BENCH_KEY` from the environment and sends `X-Bench-Key`; a
missing variable exits with a one-line hint. Document in CLAUDE.md.

## 4. What this does NOT change

- The visitor flow: no key, no new controls, no payload change beyond an
  added `submission_id` field the page ignores.
- The schema: **no migration**. Everything reads and writes the tables as
  they stand after 2026-09-05.
- `rating-bench.html` (retired) stays retired.
- Editing an entry's *files* (pinning `primary`, retiring a response,
  re-tiering `sizeClass` in the entry) stays a commit; the size the admin
  files goes to `jd_submissions.size_class` as it does from the bench, and
  `data.php` overlays it the same way (§3.3: `sizeClass` = filed tier if
  any, else the entry's).

## 5. Files touched (estimate)

| file | change |
| --- | --- |
| `api/jd-config.php` | `JD_BENCH_REQUIRE_KEY = true`; `jd_curated_generations()`; notes in the fold; failure logging |
| `api/jd-admin-check.php` | new, ~20 lines |
| `api/jd-item-rate.php` | `notes` per axis |
| `api/jd-bench-queue.php` | use the shared join; nothing else |
| `art/junk-drawer/data.php` | `submission_id` on turns; the curated overlay (§3.3) |
| `art/junk-drawer/jd-core.js` | `JD_admin` (mode, key store, verify, sign-out) |
| `art/junk-drawer/jd-bench.js` | use `JD_admin`; `?admin` strip; `adjust()` |
| `art/junk-drawer/jd-record.js` | ADJUST RATINGS control (admin only); reopen after filing |
| `art/junk-drawer/jd-turn.js` | `reveal` flag on a curate job; per-axis notes in `curateFile` |
| `art/junk-drawer/junk-drawer.css` | the one control and the ADMIN tag (a few rules, bench palette) |
| `scripts/*.py` (5) | `JD_BENCH_KEY` header |
| `CLAUDE.md`, `ROADMAP.md`, `db/junk-drawer-schema.md`, `VERSION` | docs; version bump (visible: the card's new control in admin mode) |

## 6. Verification

- The existing deterministic Playwright walk (desktop + mobile) against the
  previous build: **visitor shots pixel-identical**, since nothing is
  painted without `?admin`.
- New walk scenarios: `?admin` without key → prompt; wrong key → refused;
  right key → ADMIN tag; open a turn's report card → ADJUST → change one
  axis → file → card reopens showing the change; same for a curated item
  (proves §3.3); `?bench` without key → prompt; each script with and
  without `JD_BENCH_KEY`.
- `php -l`, sanitizer fixtures, validator, card-gallery harness as before.

## 7. Rollout checklist (owner)

1. Add `'jd_bench_key' => '<passphrase>'` to
   `/home1/tdrivemy/private_config/secrets.php`. (Optional but recommended;
   without it the setup key is the bench key.)
2. Merge and let the deploy run. No setup script to run — no migration.
3. Open `/art/junk-drawer/?admin`, enter the passphrase once per device.
4. On the owner's machine: `export JD_BENCH_KEY=<passphrase>` before running
   any of the five scripts.

## 8. Decisions for the owner before building

1. `localStorage` (remembered per device, SIGN OUT to forget) vs
   `sessionStorage` (re-type per tab). Recommendation: localStorage.
2. Adjust mode shows model names on the slots (recommended) or stays blind.
3. `primary` for curated items follows the bench's rank-1 when a full
   ranking is filed (recommended) or only the entry's pin / best grade.
4. Whether to add the per-IP failure throttle now or later.
