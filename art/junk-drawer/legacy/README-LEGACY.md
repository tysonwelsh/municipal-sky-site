# The legacy drawer — a frozen copy

`art/junk-drawer/legacy/` is a snapshot COPY of the v1 drawer as it stood on
2026-10-01 (Junk Drawer v2, Phase 3a; `PLAN-V2.md` §11, "Cutover mechanics").
The v2 drawer takes over `/art/junk-drawer/` itself; this folder keeps
today's pile and report cards on view at `/art/junk-drawer/legacy/`.

**Never refactor this folder.** It is an exhibit, not a codebase: no
cleanups, no shared-helper migrations, no style passes, no taxonomy bumps.
Fixes go into the live drawer; this copy stays as it was. Delete the whole
folder when the owner says so (nothing outside it depends on it, apart from
the `/art/` index card that links here for now).

## What was changed from the copied files

Every edit is marked `LEGACY (2026-10-01)` or `<!-- LEGACY -->` in place.

- `index.php` — title suffix " (legacy)" (`<title>` and the `h1`); includes
  one level deeper (`../../../includes/`); `<meta name="robots"
  content="noindex">` injected into the shared header's `<head>` (plus an
  `X-Robots-Tag: noindex` header); the intro sentence about the blue button
  commented out; a one-line notice above the build stamp.
- `_assets.php` — `turn-object.svg` and `instructions-object.svg` dropped from
  the asset list (not copied).
- `_scripts.php` — their two `data-jd-*` hash attributes dropped.
- `data.php` — `api/jd-config.php` and `api/jd-usage.php` required one level
  deeper; artwork URLs under `/art/junk-drawer/legacy/items/`; reads its OWN
  `taxonomy.json`, not the live drawer's. Still reads the v1 `jd_*` tables (so
  rated v1 turns show, their SVGs from `/api/jd-gen-svg.php`), and still
  serves files-only when the database cannot answer.
- `jd-core.js` — `JD_DATA_URL` is this folder's `data.php`; `?admin` /
  `?bench` ignored (`JD_admin` never turns on); `?rerun=` ignored. At the
  cutover (2026-10-01, Phase 5) `JD_track` logs under its own page key,
  `junk-drawer-legacy` (allowlisted in `api/page-event-tracking.php`), so the
  exhibit's traffic no longer counts as the v2 drawer's `junk-drawer`.
- `jd-furniture.js` — the turn object and the instructions sheet are not
  mounted (each IIFE returns first); the analytics folder stays, its artwork
  from this folder, its numbers from the public `/api/jd-analytics.php`.

Copied unchanged: `_stage.php`, `_slim.php`, `_version.php`, `VERSION`,
`junk-drawer.css`, `jd-filmstrip.js`, `jd-record.js`, `jd-darkroom.js`,
`jd-turn.js`, `jd-bench.js` (inert: `JD_admin.on` is false), `taxonomy.json`
(as it was at copy time, v26 — additive over v25; the axes v1 rated on are
unchanged), `analytics-folder.svg`, `items/` (whole, real files, no symlink).

The v1 write endpoints are frozen separately by `JD_V1_FROZEN` in
`api/jd-config.php`, on since the cutover (2026-10-01).

## What the exhibit still shares, and the guard (2026-10-03)

Nothing in this folder is edited, but the page still leans on a few files
outside it: `includes/header.php` and `footer.php`, `css/style.css`,
`api/jd-config.php` (constants and helpers; `legacy/data.php` requires it),
`api/jd-analytics.php` (the folder's numbers — since 2026-10-03 it reads THIS
folder's `taxonomy.json`, not the live one: the v35 and v36 rubric changes had
emptied two of its panels), `api/jd-gen-svg.php` (rated v1 turns' drawings),
`api/jd-usage.php` and `api/page-event-tracking.php`. An edit to any of those
can bend the exhibit without touching this folder.

`CHECKSUMS.sha256` fingerprints every file here. `scripts/test-jd-legacy.js`
(one of the one-at-a-time suites; Playwright) fails if any file differs from
the manifest, if a file appears that the manifest does not know, if the page
throws, if `?bench` turns the key gate on, or if `data.php` or
`jd-analytics.php` answer with anything but v1's rubric. Run it after
touching any shared file above. If a change to this folder is ever
deliberate (the owner's call), regenerate the manifest in the same commit:

    cd art/junk-drawer/legacy && find . -type f ! -name CHECKSUMS.sha256 -print0 | sort -z | xargs -0 shasum -a 256 > CHECKSUMS.sha256

