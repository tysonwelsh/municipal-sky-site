# jd-regress — the Junk Drawer's regression harness

Phase 0 of `art/junk-drawer/REFACTOR-PLAN.md`: the evidence that a refactor
changed **nothing** a visitor or the owner can see or do. `capture.js` drives
the real app (the drawer page, the report card, the turn card at every
`data-view`, the analytics folder, `?admin`, `?bench`, `/about/`) in headless
Chromium against a local dev server and writes screenshots, normalised
markup, computed styles, API payloads, the `window.JD_*` surface and the
console. `compare.js` diffs two such captures and exits 0 only when every
artifact is identical.

Dev-only. `scripts/**` and `local-dev/**` are deploy-excluded; nothing here
ships, and nothing here modifies the app under test (`art/junk-drawer/`,
`api/`, `includes/`, `css/`, `router.php`).

## Quick start

```sh
# 1. baseline, BEFORE your first edit (in your own checkout / worktree)
mkdir -p <checkout>/local-dev
node scripts/jd-regress/capture.js --root <checkout> --out <checkout>/local-dev/jd-regress/base

# 2. after each change
node scripts/jd-regress/capture.js --root <checkout> --out <checkout>/local-dev/jd-regress/run-1
node scripts/jd-regress/compare.js <checkout>/local-dev/jd-regress/base <checkout>/local-dev/jd-regress/run-1 \
     --report <checkout>/local-dev/jd-regress/report-1
echo $?        # 0 = identical in every artifact; 1 = look at the report
```

- `capture.js --list` prints the scene catalogue (no lock, no server).
- `--scenes a,b,c` captures a subset (scene names, group names, `*` globs —
  e.g. `--scenes 'record-*,folder'`). Groups a selected scene depends on
  still run (see "Subsets"); the pre-write payloads are always captured.
- `--keep-server` leaves `php -S` up on :8000 afterwards, serving the
  post-capture database (frozen clock still on), and **keeps holding the
  lock** until you press Ctrl-C.
- One capture takes **~175 s** on this machine (plus any wait for the lock)
  and writes **~60 MB** (`shots/` ~35 MB). Delete old runs when done.
- Commit nothing under `local-dev/`. The capture directories are evidence
  for your report, not repo content.

Requirements (all present on this machine): PHP 8.3 CLI with pdo_sqlite,
Node 22, Playwright 1.56 resolvable as `playwright` (it is, via
`NODE_PATH`; `lib.js` also searches `/opt/node-tools/node_modules`), its
Chromium under `PLAYWRIGHT_BROWSERS_PATH` (never run `playwright install`),
`flock(1)`, a C compiler (`cc`) for the clock shim, `diff(1)` for text diffs.
Pixel diffs use the PNG codec bundled inside `playwright-core`; without it
compare.js falls back to byte equality of the PNGs (headless Chromium
screenshots are byte-stable under these settings) and says so.

## What one capture does

1. **Lock.** Re-executes itself under
   `flock -w 2700 /tmp/claude-0/-home-user-municipal-sky-site/73afab42-72a9-574d-bf62-24b22cdb37f2/scratchpad/jd-regress.lock`
   (override with `JD_REGRESS_LOCK`). Port 8000 is the only port
   `api/jd-origin.php` admits, so every checkout and worktree on this machine
   shares it; the lock spans start-server → capture → stop-server. A run that
   waits 45 min exits 75. If something outside the lock already listens on
   8000, the run stops with the `ss`/`lsof`/`fuser` line naming it (it is not
   ours to kill). Each group's `php -S` is stopped (SIGTERM, then SIGKILL)
   when the group ends, and whatever is still running is SIGKILLed on exit,
   on an error and on Ctrl-C.
2. **Database.** Copies the pristine DB
   `/home/user/municipal-sky-site/local-dev/jd-regress/pristine.sqlite` over
   `<root>/local-dev/jd-dev.sqlite` (creating `<root>/local-dev/`, so a fresh
   worktree works). The pristine copy is made once, on the first run, from
   the main checkout's `local-dev/jd-dev.sqlite` (49 live items filed, no
   visitor turns). Every capture therefore starts from the same rows and
   serves the same ULIDs, and the turn flow's writes never leak into the next
   run. To refresh it deliberately: delete `pristine.sqlite` (then **every**
   existing baseline is stale — recapture them).
3. **Mock fixtures.** Copies `fixtures/jd-mock/*.svg` into
   `<root>/local-dev/jd-mock/` — `api/jd-mock-provider.php` reads its four
   canned drawings from there and nothing in git carries them (without them
   every mock generation throws "missing dev fixture"). Four small distinct
   drawings (cup, key, leaf, lamp) that pass the real sanitizer, plus the
   sanitizer-rejection fixture.
4. **Server.** `JD_DEV_MOCK=1 JD_DEV_LATENCY_MS=1 php -S 127.0.0.1:8000
   router.php` from `<root>`, **one server per scene group**, each with
   `LD_PRELOAD=faketime.c` (compiled on first use into
   `/home/user/municipal-sky-site/local-dev/jd-regress/bin/`). See
   "Determinism".
5. **Payloads** (Node `fetch`, `Referer: http://127.0.0.1:8000/…` so the
   origin gate admits it), then the **browser groups** in a fixed order:
   `drawer, motion, pick, record, folder, admin, bench, about` (read-only),
   then `turn, turn-phone, apology, turn-api` (these write turns to the DB),
   then `after` (the same surfaces again, now with rated turns in the data).
   Every page is a fresh browser context (a fresh visitor: empty storage).

## Output layout

```
<out>/manifest.json   scene list (name, group, viewport, page, surfaces, files,
                      ms + split settle/markup/styles/shot, resize events),
                      group timings, git HEAD/branch/dirty files of --root,
                      determinism settings, raw build stamps, warnings,
                      skipped scenes, the normalisation list
<out>/shots/<scene>.png        (paged dialogs: <scene>.png, <scene>@2.png, …)
<out>/markup/<scene>.html      normalised outerHTML of each surface
<out>/styles/<scene>.json      computed styles of every element of each surface
<out>/payloads/<name>.json     RAW response bodies, byte for byte
<out>/payloads/headers.json    status + content-type of each; data.php's ETag,
                               Cache-Control, and whether a conditional GET
                               with that ETag answers 304
<out>/surface.json    window.JD_* keys, typeof each, own enumerable member
                      names of each object/function, <script src> basenames
                      in load order, <html> classes — for the drawer page
                      (drawer-desktop), the ?bench page and /about/
<out>/console.json    every console error/warning and page error, per page
<out>/server.log      php -S output (not compared)
```

**styles/** format: one JSON object per line, in document order:
`{"at":"<surface>:<match>:<index path>","el":"tag#id.classes","style":{…}}`.
The surface root carries its **full** computed style; every other element
carries only the properties whose computed value **differs from its
parent's** (`null` = the parent has it, the element does not). Since
full(el) = full(parent) + delta(el), the file pins every property of every
element; a cascade change shows up exactly where it bites, as a property on
a line. Pseudo-elements ride on their element under `"pseudo"`: `::before`
/ `::after` when generated (content not none/normal), `::marker` on list
items, `::placeholder` on fields — each as a delta from its element. Keys
are sorted (Chromium enumerates custom properties in a run-dependent order).
Custom properties (`--rot`, `--w`, tokens…) are included, so a token hoisted
to `:root` (plan §4.1) **will** show up as new `--…` properties on every
element below it; compare.js counts "standard" vs "custom-only" changes
separately so you can tell that apart from a real cascade change.

Two deliberate limits, both covered elsewhere:
- the `d` property (SVG path data) is omitted — it mirrors the `d`
  attribute, which `markup/` captures byte for byte;
- **artwork** (an inlined `<svg>` with ≥ 25 descendant elements) is walked in
  full only in `drawer-desktop` and `won-pile-desktop` (every drawing in the
  pile); in every other scene only the FIRST drawing per holder context
  (parent's class list) is walked, later ones record their root `<svg>` plus
  `"art": <n descendants not walked>`. This keeps the 12 filmstrip clones and
  the about page's hidden pile from costing ~25 s per scene, while every
  context's rules that reach inside artwork (e.g. `.jd-item svg *
  { pointer-events: visiblePainted }`) are still pinned once.

## Scenes

`node scripts/jd-regress/capture.js --list` is authoritative. Viewports:
**desktop** 1440×900, **tablet** 768×1024, **phone** 390×844 with
`isMobile` + `hasTouch` (so `(hover: none)` / `(any-pointer: coarse)` rules
apply and pile presses are real taps). deviceScaleFactor 1 everywhere.
`prefers-reduced-motion: reduce` unless a scene says otherwise.

| scene | what it shows (surfaces = markup + styles) |
|---|---|
| `payloads` | `data.php`, `data.php?slim=1`, `data.php?item=2026-07-28-desktop-succulent`, `api/jd-analytics.php`, `jd-bench-queue.php`, `jd-ledger.php`, `jd-inventory.php`, `jd-admin-check.php`, `headers.json` — pristine DB, before any write. Always captured. |
| `drawer-desktop` / `-tablet` / `-phone` | the drawer page after the pile settles (`.jd-pile` item count stable, PUSH button, sheet and folder injected), full page; `.jd-pile`. Desktop also writes `surface.json`. |
| `notes-desktop` / `-phone` | the field notes `#notes` (title, divider, intro, CTA, blanked build stamp), element shot |
| `drawer-desktop-motion` | the drawer with `prefers-reduced-motion: no-preference`, after every finite animation finished; the PUSH button's infinite pulse is cancelled for the capture (as Playwright's `animations:'disabled'` does) |
| `pick-desktop` / `pick-phone` | `2026-07-27-crystal-ball` picked by a real click/tap on its painted ink: `.jd-itemtag`, `.jd-rope`, the lifted item; viewport shot |
| `sheet-desktop` / `sheet-phone` | the instructions sheet pressed and unfolded; `.jd-item--sheet` |
| `record-single-desktop` | report card of the crystal ball (`JD_record.open`), paged through the card's scroller; `.jd-record-scrim` |
| `record-multi-desktop` | report card of the desktop succulent (5 responses): alternatives strip, graph paper, filmstrip |
| `record-multi-alt-desktop` | after pressing the second thumbnail (`.rc-alt[data-resp="1"]`) |
| `record-multi-blueprint-desktop` | after the paper button `.rc-paper` (blueprint) |
| `record-multi-zoom-desktop` | the enlargement `.jd-record-zoom.is-on`, opened by pressing the plate's ink |
| `record-multi-phone` | the succulent's card at 390, paged |
| `folder-desktop` / `-phone` | `JD_folder.open()` on the pristine DB (no visitor turns: cost chart only) |
| `admin-strip-desktop` | `?admin`, key verified keyless (`html.jd-admin-on`): the strip |
| `admin-card-desktop` | `?admin` + the succulent's card in edit mode (`select.rc-edit`, SAVE RATINGS, HIDE FROM DRAWER), paged; `.jd-record-scrim` + `.jd-bench-bar` |
| `bench-strip-desktop`, `bench-curate-desktop` | `?bench`: the queue's first workable item (today the Ionic column, which resumes on its ranking card) seated in curate mode on the turn card; the strip; paged |
| `about-desktop` / `-phone` | `/art/junk-drawer/about/`, initial view, full page; `.jd-about-pane` + `.jd-about-notes` |
| `turn-form-desktop` | the turn card opened by clicking the PUSH button (`data-view=form`) |
| `turn-form-filled-desktop` | prompt typed |
| `turn-darkroom-desktop` | `data-view=darkroom` with all four `jd-generate.php` calls **held** at the network layer |
| `turn-darkroom-landed-desktop` | after slot A (and the title) were released |
| `turn-plates-desktop` | `data-view=plates`, the four mock drawings |
| `turn-bench-a-desktop`, `-a-def-`, `-a-rated-`, `-b-`, `-c-`, `-d-` | `data-view=bench` per drawing: unrated, with the first row's definition unfolded, fully rated, then B/C/D unrated |
| `turn-call-desktop`, `turn-call-ranked-desktop` | `data-view=call`: empty podium; C, A, D, B placed (tier then print) |
| `turn-size-desktop`, `turn-size-chosen-desktop` | `data-view=size`: nothing chosen; Medium chosen |
| `turn-said-desktop` | `data-view=said`, the unveil after `jd-rate.php` filed |
| `won-pile-desktop` | card closed: the won drawing dropped into the pile (full page; every artwork walked) |
| `won-tag-desktop` | the won item clicked: its specimen tag |
| `won-card-desktop` | `JD_record.open(<won generation id>)`: the visitor item's card (`data-card` path) |
| `turn-*-phone` | a second turn at 390: form, darkroom (held), plates, bench A rated, podium ranked, size chosen, unveil — all paged |
| `turn-apology-desktop` | a turn whose four slots fail (`[fail]` mock token): "Nothing came back" (`data-view=form`) |
| `drawer-after-desktop` | a fresh visitor after the turns: data.php now serves the rated turns as items |
| `folder-after-desktop` | the folder with three rated turns: cost, overall grade, the four category panels, the turns table, paged |
| `folder-after-row-desktop` | after pressing the first category row (`.fx-row`): its readout |
| `payloads-after` | `after-data.json`, `after-data-item-turn.json` (`data.php?item=<won generation>` — the turn branch), `after-jd-analytics/-bench-queue/-ledger/-inventory.json` |

The groups `turn`, `turn-phone`, `apology` and `turn-api` write to the DB.
`turn-api` files a third rated turn straight through `jd-generate.php` ×4
and `jd-rate.php` (the shape `submitRatings()` posts; no artifacts) because
the folder only plots a model's grades and categories once it has three
ratings on visitor turns.

## Determinism — what is pinned, and how

Two back-to-back captures of the untouched checkout are identical in every
artifact (see "Acceptance record" at the end). What makes them so:

**Server**
- `faketime.c` (LD_PRELOAD into `php -S` only): `time()`, `gettimeofday()`,
  `clock_gettime(CLOCK_REALTIME*)` frozen at **2026-10-01T12:00:00Z**; the
  CSPRNG (`getrandom`, `getentropy`, `syscall(SYS_getrandom)` — what PHP 8's
  `random_bytes`/`random_int` use) replaced by a splitmix64 stream. So
  `jd_now()`, `generated`, the ULIDs `jd_ulid()` mints, the visitor hash's
  date, `latency_ms` (0) and every per-day window in jd-analytics are the
  same on every run and every calendar day.
- One `php -S` per group, its stream seeded from the **group name**: the ids
  a group mints never depend on which groups ran before it (a `--scenes`
  subset mints exactly what a full run mints), and no two groups collide.
- One PHP worker (`PHP_CLI_SERVER_WORKERS` unset): requests are served in
  arrival order. The turn's four `jd-generate.php` calls and its
  `jd-title.php` call are **held** by the page's route handler and released
  one at a time, each after the previous answered: A, title, B, C, D (the
  apology turn: A–D, then the title). A title *retry* (jd-turn.js re-asks
  after 4 s when no submission row exists yet) stays held until the page
  closes, so no timer can reach the server at a run-dependent moment.
- `JD_DEV_LATENCY_MS=1` (the mock provider's sleep).

**Browser** (Chromium 141 headless shell, Playwright 1.56)
- An init script in every frame, before any page script: `Math.random` →
  xorshift32; `crypto.getRandomValues` / `crypto.randomUUID` → a second fixed
  stream (so the device code, the turn's `client_ref` and hence the
  darkroom's indicator deal are fixed); `Date` → 2026-10-01T12:00:00Z plus
  real elapsed time (timers and `performance.now` untouched). Seeds are
  derived from the **page label**, so each context is a distinct, repeatable
  visitor (two turns must not share a `client_ref` — the server would fold
  the second into the first). Consequence: each page has its own (fixed)
  pile scatter; the pile in `pick-desktop` is not the pile in
  `drawer-desktop`. `sessionStorage['jd-scatter-v2']` is not pre-seeded.
- Arrival order: `data.php` is answered only after DOMContentLoaded and
  after the furniture artwork already requested has arrived (the sheet's and
  folder's seats draw from `Math.random` after the scatter); on `?bench`,
  `jd-bench-queue.php` is answered only once the pile and its furniture are
  laid (curate mode shuffles the seated responses with `Math.random`).
- Every request whose host is not 127.0.0.1:8000 is aborted — Google Fonts
  included — so **text renders in fallback fonts**, identically every run.
  Font-stack changes are guarded by the computed `font-family` strings in
  `styles/`, not by pixels. The two aborted font CSS requests appear as
  `Failed to load resource: net::ERR_FAILED` in every page's console, and the
  apology turn's four failed generations as `… status of 502 (Bad Gateway)`
  for `jd-generate.php`; they are part of the baseline (44 messages, no page
  errors).
- Chromium flags: `--disable-partial-raster` (essential: with partial raster
  a tile re-rastered piecemeal while the report card's filmstrip animated kept
  history-dependent anti-aliasing — two runs of the same card differed by
  1–15 levels along filtered strokes), `--num-raster-threads=1`,
  `--disable-gpu`, `--disable-gpu-rasterization`,
  `--run-all-compositor-stages-before-draw`, `--disable-threaded-animation`,
  `--hide-scrollbars`, `--force-color-profile=srgb`,
  `--font-render-hinting=none`, `--disable-lcd-text`.
- Context: `reducedMotion: 'reduce'` (the rope settles synchronously, draw-on
  is skipped, the darkroom is still), light colour scheme, `en-US`, UTC,
  service workers blocked.
- **Settling** before every capture: no request in flight (held ones
  excepted) for 300 ms; `document.fonts.ready`; no running finite animation;
  no DOM mutation for 400 ms (600 for the darkroom); two frames. A settle
  that times out (30 s) is recorded in `manifest.warnings`.
- **Order inside a scene**: markup and styles are read **before** the
  screenshot, because a full-page (or taller-than-viewport) screenshot fires
  a window `resize` and the drawer answers resize (it drops the specimen
  tag). Pick/tag scenes use viewport shots for the same reason;
  `manifest.scenes[].resize_events_from_shot` records what each shot fired.
  Infinite animations are cancelled for the duration of the capture and
  restarted afterwards. Screenshots use `animations: 'disabled'`,
  `caret: 'hide'`, `scale: 'css'`; the mouse is parked at (1,1) before each.
- Dialogs that scroll internally (report card, turn card, folder) are shot
  page by page through their scroller (`<scene>.png`, `@2`, … up to 8) and
  scrolled back.

## Normalisations (the complete list)

Applied at capture time to `markup/`, `styles/`, `console.json` (the stored
files are already normalised):
1. `?v=<8 hex>` cache tokens → `?v=~v~`.
2. `?t=<epoch ms>` cache busters → `?t=~t~` (console URLs).
3. ISO-8601 date-times (`YYYY-MM-DDThh:mm:ss…`) → `~iso-time~`.
4. The checkout path → `<ROOT>`.
5. ULIDs (`[0-9A-HJKMNP-TV-Z]{26}`, alphanumeric-bounded) **not** present
   in this capture's pristine payloads → `~ulid-N~`, numbered by first
   appearance within each file. Pristine ULIDs (curated submissions and
   generations) are left alone. (With the clock and CSPRNG pinned the
   run-minted ids repeat anyway; this is a second line of defence.)
6. Counter-minted id prefixes renumbered by first appearance within each
   file: the filmstrips' `fsr<n>_` / `fst<n>_` / `fsp<n>_` / `fs<x><n>_`,
   the turn plates' `ju<slot><n>_`, won items' `juw<n>_`, the about page's
   card clones `rc<n>-` → `fsr~1~_` etc. How many mounts preceded a capture
   is an implementation detail (on /about/ it is timing). Per-copy prefixes
   (`jp<i>_`, `jt<i>_`, `jr<i>_`, `jz<i>_`, `jto_`, `jio_`, `jaf_` …) are
   deterministic and kept.
7. In the DOM, before every capture (so also in the pixels): the text of
   `.jd-build` (the drawer colophon: version · fingerprint) and
   `.jd-bench-build` (the strip: version · build · tax vN) → `■■■` runs. The
   raw values are kept in `manifest.stamps`; compare.js prints a note when
   they move (they must, whenever a fingerprinted asset changes).

Applied by compare.js to `payloads/` only (stored raw, normalised when
compared, then pretty-printed with sorted keys):
8. top-level `"generated"` → `~generated~`;
9. the tooling build stamp (`api/jd-build.php`): `build.{version,build,deployed}`
   in jd-bench-queue / jd-ledger, and `build` + `version` strings in
   jd-admin-check / jd-inventory → placeholders. It hashes the bytes and
   mtimes of `jd_build_files()`, so it moves with any edit to those files;
   compare.js prints the old → new value as a **note**, not a failure;
10. rule 5 (run-minted ULIDs) and rule 4. Nothing else in a payload is
    touched. A payload is identical only if its RAW bytes are equal once
    those exact values are blanked in place; a body that parses to the same
    JSON value but differs in bytes (key order, `\/` escaping, `5.0` vs `5`,
    whitespace) is reported as **different** ("the same JSON value, but the
    bytes differ") with a raw diff; any other change gets a diff of the
    sorted, pretty-printed, normalised JSON.

`headers.json` is compared exactly. **data.php's ETag hashes absolute file
paths + mtimes** (plus DB stamps), so it is stable within one checkout and
different between two checkouts: always compare a candidate against a
baseline captured from the **same checkout**. `--cross-checkout` blanks the
ETag (with a note) for the rare cross-checkout comparison.

## compare.js

```
node scripts/jd-regress/compare.js <baseline-dir> <candidate-dir> [--report <dir>] [--cross-checkout] [--lines N]
```

Per artifact: `identical`, `different` (one-line reason), `missing-in-
baseline` / `missing-in-candidate`, or `not-captured` (the other side was a
`--scenes` subset; neutral). Reasons:
- PNG: byte-equal → identical; else decoded and compared pixel by pixel
  with **zero tolerance**: "N of M px differ (x%), bbox …"; different
  dimensions are reported as such. `--report` writes `<name>.diff.png`
  (differing pixels red over a faded copy).
- markup: unified diff with one tag per line; styles: unified diff, one
  element per line, plus a summary (elements differing in standard
  properties / only in custom properties / present on one side, the
  most-changed properties); payloads and surface.json: unified diff of the
  normalised pretty JSON. Diffs are truncated to 40 lines on screen
  (`--lines N`); `--report` writes them whole as `<artifact>.diff`.
- console.json: multiset per page; any **new** error/warning fails the run
  and is listed; messages that disappeared are listed too (also a
  difference — behaviour changed).
- manifest: the scene lists must match (unless a subset is involved); the
  notes report differing pristine DBs, Chromium/Playwright versions, build
  stamps, capture errors and the candidate's warnings.

Ends with a summary table and `RESULT: IDENTICAL` or `RESULT: N artifact(s)
NOT identical.` Exit 0 only when identical; 1 otherwise; 2 on bad usage.
`--report <dir>` also writes `report.txt` and `report.json`.

### Subsets

`--scenes` runs only the groups the selected scenes live in, plus the groups
they depend on (`after` needs `turn`, `turn-phone`, `apology`, `turn-api`;
those run without writing artifacts if not selected). Because each group's
server is seeded from its own name and every page from its own label, a
subset produces byte-identical artifacts to a full run for the scenes it
covers. Compare a subset against a full baseline freely: the uncaptured
artifacts are reported `not-captured`, console messages are compared only
for pages both runs opened. Before a commit, run the full capture.

## Reading a difference

- One pixel region differs but markup and styles are identical → a paint
  difference (raster, a filter, an animation end state). Look at the
  `.diff.png`; rerun once to rule out flake (none has been seen since the
  flags above).
- Styles differ only in custom properties → a token was added/moved (§4.1);
  check the standard-property count is 0 and the pixels are identical.
- A payload differs → `--report` has the full diff of the normalised JSON.
- `surface.json` differs → a `window.JD_*` name or member changed; the
  plan's Wave-1 additive exports are expected here, nothing else is.
- A new console error → always a failure; it names the page.

## Known gaps (not covered — say so if your change touches them)

- **/about/ steps.** `about-scenes.js` exposes no way to step the
  walkthrough (it is driven by scroll position and its own timers), so only
  the initial view at desktop and phone is captured. Its first ~5 s after
  load re-render the hidden record pane repeatedly (settle waits that out).
- **No-preference motion** is captured only for the pile at rest
  (`drawer-desktop-motion`). The rope's swing, the darkroom's drift and
  draw-on are time-based and not captured with motion allowed.
- **Not driven:** dragging/rotating pile items and the tag; Escape/scrim
  dismissal paths; the turn's rate-limited and sanitizer-rejected notices
  and the filing-failure card; `?admin` SAVE / HIDE / hidden-items list;
  `?bench` filing, skip, scrap, rerun; `?bench&item=` (only used as a
  fallback when the queue seats nothing); `ledger.html`, `sizing-desk.html`,
  `card-gallery.html`, `rating-bench.html`; the definition tooltip
  (`.jd-tt`, which nothing in the app triggers).
- **Phone podium.** On the phone the podium is driven with mouse clicks,
  not taps. With Playwright's emulated tap, placing the last print empties
  the row, the card shrinks, and the tap's trailing compatibility click lands
  on "← back", which has slid under the finger — the card went back to
  drawing D. That may be a real touch-device bug (unverified on hardware);
  it is reported, not worked around in the app.
- `data.php?item=<turn>` before any write: the pristine DB holds no rated
  turn, so the turn branch is captured after the turns
  (`after-data-item-turn.json`) instead (noted in `manifest.skipped`).
- The tablet viewport is a narrow desktop window (no touch emulation).
- Pixels are this machine's headless Chromium with fallback fonts — they
  prove "unchanged", not "looks like production".

## Files

- `capture.js` — the capture (lock, DB, fixtures, shim, server, scenes).
- `compare.js` — the comparison and report.
- `lib.js` — normalisation rules, stable JSON, Playwright/PNG resolution.
- `faketime.c` — the LD_PRELOAD clock + CSPRNG shim for `php -S`.
- `fixtures/jd-mock/` — the mock provider's canned drawings.

State outside the repo: `/home/user/municipal-sky-site/local-dev/jd-regress/`
(`pristine.sqlite`, `bin/jd-faketime-<hash>.so`, the saved baseline
`baseline-<sha>/`) and the lock file above. `JD_REGRESS_HOME` /
`JD_REGRESS_LOCK` override the two locations.

## Acceptance record (2026-10-01)

On the untouched `junk-drawer/refactor-plan` checkout (app at `94105d9`):
two full captures, 170.7 s and 172.5 s, compared **identical** — 56 shots,
54 markup, 54 styles, 15 payloads, surface, console, manifest; no warnings,
no settle time-outs. Earlier pairs during development were identical too
once the measures above were in. Also checked:
- a `--scenes` subset captured in a **fresh git worktree** (no `local-dev/`)
  compared identical to the full main-checkout capture with
  `--cross-checkout` (only the tooling stamp's `deployed` mtime moved, as a
  note);
- sensitivity, in that throwaway worktree: `letter-spacing: 0` → `0.01px`
  on the notes title, one `title=` attribute in jd-record.js, and
  `JSON_UNESCAPED_SLASHES` in data.php were reported as a styles difference
  (+ 472 px in three shots), a markup difference, and "the same JSON value,
  but the bytes differ" respectively; exit 1;
- a listener already on :8000 stops the run with the `lsof` line;
  `--keep-server` serves, holds the lock, and Ctrl-C frees the port.

The saved baseline for the branch is
`/home/user/municipal-sky-site/local-dev/jd-regress/baseline-<sha>/` (sha =
the commit that added this harness; the app files are those of `94105d9`).
It is a capture of the MAIN checkout — use it for comparisons of the main
checkout; a worktree captures its own baseline (its ETag differs).


## Known flake (found during the refactor, 2026-10-01)

`turn-darkroom-phone` deals the **words** indicator into one swatch: an
iframe of `/art/kimis-take/mini.php`, whose word streams are placed from
`performance.now()` inside the iframe, which the harness does not pin. Its
shot differed by a few hundred px in roughly one run in three; markup and
styles for the scene (including the iframe element itself) were identical
every time. When that one shot differs, re-run `--scenes turn-darkroom-phone`
and confirm the diff lies inside the iframe; a subset run also renders the
page behind the card at a different scroll, so compare subset against
subset. Everything else in 20+ full captures across six worktrees was
byte-stable.
