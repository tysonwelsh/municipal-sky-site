# The Junk Drawer — refactoring plan (2026-10-01)

A review of `art/junk-drawer/` (the page, its seven script modules, the
stylesheet, the PHP shell) and the `api/jd-*.php` backend, looking for
efficiency and maintainability work that changes **nothing** the visitor or
the owner can see or do. Every finding below cites the lines it is about;
items marked **✓** were re-verified by hand after the module reviews.

Ground rule for every change in this plan: the drawer must render
pixel-identically, every generated HTML/SVG string must be byte-identical,
every JSON payload and DB write must be unchanged, and the public
`window.JD_*` surface (members, events, the `curate` job shape) must keep
its names. Phase 0 builds the tooling that proves it.

---

## 0. The numbers

| file | lines | bytes | gzip | bytes without comments | gzip | comment share |
|---|---:|---:|---:|---:|---:|---:|
| jd-core.js | 2,533 | 132,058 | 47,307 | 56,143 | 16,277 | 57% |
| jd-filmstrip.js | 424 | 20,253 | 7,221 | 12,949 | 4,061 | 36% |
| jd-furniture.js | 1,578 | 84,244 | 28,369 | 39,141 | 10,825 | 54% |
| jd-record.js | 1,444 | 74,711 | 24,626 | 41,072 | 10,896 | 45% |
| jd-darkroom.js | 1,291 | 71,425 | 26,380 | 31,226 | 9,852 | 56% |
| jd-turn.js | 3,080 | 157,201 | 51,065 | 79,157 | 20,333 | 50% |
| jd-bench.js | 590 | 27,430 | 9,042 | 17,032 | 4,821 | 38% |
| junk-drawer.css | 5,428 | 306,444 | 96,956 | 132,780 | 24,864 | 57% |
| **total** | | **873,766** | **290,966** | **409,500** | **101,929** | **53%** |

- Over half of what ships to a visitor is prose. The design-history comments
  are a deliberate house style and are left alone by default; §6.1 is the one
  decision about them.
- Verbatim copy-paste duplication is low (a 4-line shingle scan finds 12
  runs in 10k lines of JS, 4 in the CSS). The duplication that matters is
  *semantic*: the same helper re-implemented under a different name in two
  or three files, and the same constant copied by hand (§3).
- Churn (commits touching each file): junk-drawer.css 13, about.css 12,
  jd-furniture.js 10, index.php 5, jd-record.js 4, jd-core.js 4. The
  stylesheet is where maintainability work pays back fastest.
- The server has no `mod_deflate` / `Cache-Control` directives in
  `.htaccess` for this directory; whether Bluehost gzips by default is not
  visible from the repo (§6.2).

---

## Phase 0 — the safety net (do this first, nothing else ships without it)

The whole plan rests on being able to say "identical" with evidence rather
than by inspection. Four cheap tools, all dev-only (nothing deployed):

**0.1 Deterministic screenshots.** A Node script in `scripts/` (Playwright is
available; `scripts/capture-drawer-poster.js` already drives Chrome over
CDP and can be the template) that serves the working copy with
`php -S … router.php`, pre-seeds `sessionStorage['jd-scatter-v2']` with a
fixed scatter (exactly what `about/index.php:85-96` does for the poster, so
the pile lays out the same every run), forces
`prefers-reduced-motion: reduce` (the rope settles synchronously, the
darkroom is still, draw-on is skipped), and captures:
- the drawer at 1440×900, 768×1024, 390×844; one item picked with its tag;
  the instructions sheet unfolded;
- the report card for two curated items (one multi-response) + its
  enlargement, graph and blueprint paper;
- the turn card in every `data-view` (prompt, darkroom with a fixed
  `client_ref` seed, plates, bench, said/podium, call, size, unveil,
  apology) — run under `JD_DEV_MOCK=1` so the mock provider answers;
- the analytics folder (each panel), the bench strip and admin editor (with
  a dev key), the `/about/` scenes.
Compare with a pixel diff; any non-zero diff is a stop.

**0.2 Markup snapshots.** In the same run, dump `outerHTML` of the tag, the
record card, the turn card at each view, the folder dialog and the
enlargement to files, after normalising per-copy prefixes (`jp<i>_`,
filmstrip `pfx`) and generation ids. HTML-string refactors (§3.3, §3.6)
are proven by a byte-identical diff here, which is stricter than pixels.

**0.3 Computed-style dump.** For each screenshot scene, walk every element
and write `getComputedStyle` (all properties) to JSON. This is the proof for
every stylesheet change in §4: a wrong cascade shows up as a property
change even in a state no screenshot covers.

**0.4 Payload snapshots.** Against a local SQLite (`JD_DEV_MOCK=1`, run
`api/setup-jd-tables.php` then `api/jd-backfill-curated.php`): save the
bodies of `data.php`, `data.php?slim=1`, `data.php?item=<curated>`,
`data.php?item=<turn>`, `jd-analytics.php`, `jd-bench-queue.php`,
`jd-ledger.php`, `jd-inventory.php` (keyed), plus the `ETag` header of
`data.php`. Every backend change in §2.4–§2.6 and §3.7 diffs against these.

**0.5 Surface check.** A one-liner that lists `Object.keys(window)` matching
`/^JD_/` and the member names of each object, saved before and diffed after.

Commit all of this under `scripts/` (deploy-excluded). It is also the
regression suite for every future owner request, which is the real win.

---

## Phase 1 — pure deletions (verified dead; render- and behaviour-identical)

Each is a removal of code that cannot run or markup nothing matches. Do them
as one commit per file, run Phase 0 after each.

**jd-turn.js**
- Definition tooltip subsystem: `ttInit/ttShow/ttHide` 375–425, the
  `ttInit()` call at 221 and `ttHide()` at 438. Nothing emits a
  `[data-tt-t]` anchor (grep hits only this file and `mockups/`); the
  replacement is documented at 1537–1546. Today it still binds
  `mouseover/mouseleave/focusin/focusout/scroll` on the card body and
  evaluates `matchMedia` per mouse move to hide a div that is never shown.
  Drop `.jd-tt`, `.jd-tt b` (css 4100–4113) with it.
- Plate REPLAY path: `SKETCH_ICON` 805–812, the `opts.replay` branch in
  `plate()` 879–891, `replayPlate` 1015–1020, the `.jd-turn-draw` guards at
  215 and 2228–2229. No caller passes `replay: true`; the filmstrip carries
  replay since 2026-09-16. (The enlargement's REDRAW `.rc-draw` is a
  different, live path — keep.)
- Tie keep-chooser chain: `pillRow` 1053–1068, `viewUnveil` 2059–2069, the
  radio branch in `onChange` 2137–2146 and 2175–2176, `act === 'keep'`
  2289–2292, `work.keep/kept` in `blankWork` 2348. `work.winner` has one
  writer (`podSync`, 1134) and cannot be `'tie'`; the persisted turn
  (`K_TURN`) is removed at init (2884) and never read, so no old state can
  resurrect it. Keep the harmless `|| 'tie'` in the `JD_track` string.
- Retired-state mappings in `go()` 444–455 (`'compare'`, `'consent'`
  can never arrive); the `restored` flag and `!restored` branch (48, 139,
  2887 — `restoreWon()` runs synchronously before `JD_turn` exists).
- Write-only fields: `work.placed` (2672); `pendingHead.sec` and
  `stateTitle` (553–558, 2110–2112); `scaleRow`'s unused `kind` parameter
  (1516).

**jd-core.js** ✓
- `renderCount` (957–972) targets `#jd-count` and `renderLegend`'s grades
  branch (981–996) targets `#jd-grades`; neither element exists on any
  served page since the notes were shortened (2026-09-28). Only the
  `#jd-axes` branch is live (about/index.php:246). Both return early today.
- The local `byId` inside the loader (1038–1040) duplicates file-scope
  `JD_byId`; `sizeLabel`'s tier loop (702–705) is `JD_byId(tiers, id)`.

**jd-record.js**
- Dead locals in `cardHTML`: `m` (618) and `gen` (636), recomputed by
  `notesHTML`.
- `JD_record.ready` (1416) has no caller anywhere; keep only if you want it
  as documented API.

**junk-drawer.css** (each verified against every live `.js/.php/.html/.svg`) ✓
- Dead selectors: `.jd-wall-label` 955–958, `.jd-label-dek` 964–967,
  `.jd-back` 1041–1047 and the `.jd-notes--drawer .jd-back` half of
  1035–1036, `.fx-of` 4920–4923; `.fx-track` 4857 matches nothing
  (`fx-track-bar` is a different class) — confirm, then drop.
- Dead tokens: `--tstamp` 2108, `--sp-1` 2128, `--t-lead` 2126,
  `--fmanila-lo` 4581 (defined, never read). CLAUDE.md's "Never" section
  still says `--tstamp` remains; update that line in the same commit.
- Fully overridden block: 4484–4485 (`--pbase: 76px`) is restated
  byte-identically at 4511–4512 (`56px`) later in the same media block ✓.
  `.jd-folder-card` 4617: `max-height` (4622) and `border-radius` (4628)
  are overridden by the second `.jd-folder-card` block at 4654–4658 —
  merge the two blocks.
- `--form-rule` / `--form-rule-2` remap on `.jd-turn-scrim .jd-filmstrip`
  (5252): nothing inside a filmstrip reads them.
- `will-change: left, top, filter` on `.jd-itemtag.is-dragging` (330):
  `left/top` are not compositable; `will-change: filter` is the same thing.
- `!important` on `.jd-item.jd-item--hidden { display:none }` (5086): the
  comment's premise (".jd-item sets its own display") is false; nothing
  sets `display` on items.

**Stale comments** (zero risk, worth a single sweep): "six files/scripts"
in CLAUDE.md:24, _assets.php:38, jd-core.js:3 (there are seven since
jd-filmstrip.js) ✓; jd-turn.js 938, 2719, 2792, 2917; jd-record.js 3–5,
112, 288, 330, 1037; jd-furniture.js 289, 376, 640, 844; jd-darkroom.js 7,
801–803; junk-drawer.css 2411 (indicator list) and 2973–2976 (claims JS
stops the metronomes — it does not, see 2.1); api/jd-config.php 536–539
(gate "off" is no longer the standing state); scripts/jd-cost-probe.php
14/78/227 (cites a provider function that moved files). Also: the code
cites `PLAN-FRONTEND`, `PLAN-BACKEND`, `PLAN-MOBILE`, `PLAN-PORTFOLIO` in
~25 places, and `art/junk-drawer/PLAN-*.md` is gitignored — a reader of the
repo cannot follow those references. Either commit the plans or note once in
CLAUDE.md that they are local-only.

---

## Phase 2 — efficiency fixes (behaviour-preserving; each proven by Phase 0)

Ordered by what a visitor would feel.

**2.1 Darkroom drift timers keep running after the turn card closes.** ✓
`close()` (jd-turn.js 294–318) destroys the filmstrip and empties the body
but never calls `JD_dark.stopAll()`; the only caller of `stopAll` is
`jdDriftMount` itself (jd-darkroom.js 1061), i.e. the *next* paint. After a
close during the darkroom, each column's `setInterval` (1044) keeps minting
`<i>` nodes on the detached host, starting WAAPI animations and spawning a
40 ms poll per letter (978–995) until the next open. Fix: one line in
`close()` beside the filmstrip destroy, `if (window.JD_dark) JD_dark.stopAll();`.
The DOM it feeds is already gone, so nothing visible changes. **S**

**2.2 A landed slot's drift keeps minting behind the fade.** `paintSlots`
(jd-turn.js 762–776) only flips `data-state`; the CSS at 2973–2978 believes
JS stops the metronome and tries `animation-play-state: paused`, which does
not govern `element.animate()` animations. Add a per-host `JD_dark.stop(host)`
and call it from `paintSlots` after the 0.5 s well fade (`transitionend` or
a 500 ms timeout — stopping at t=0 would drop the 1–3 letters that fall
during the fade, which is a visible change; after the fade is not). **M**

**2.3 One 40 ms interval per falling letter** (jd-darkroom.js 978–995):
typically 10–30 concurrent 25 Hz timers during a wait, still ticking while
the tab is hidden. Replace with one poll per sheet walking an in-flight list
in insertion order; same finish branch, same 0–40 ms landing jitter. **M**
Also: `jdDriftSync` (host `clientHeight`, a forced layout) runs inside
`jdDriftEmit` per letter (937); call it once per beat before the `while` at
1051 — the height cannot change between letters emitted in one callback. **S**

**2.4 Pile apply pass thrashes layout.** ✓ In the loader's apply loop
(jd-core.js 1128–1152) every item calls `avoidTurn` → `turnRect`
(856–878), which does `document.querySelector('.jd-item--turn')` plus two
`getBoundingClientRect` reads, immediately after the previous item's
`style.left/top` write — one forced layout per item (~67) on a pile of
filtered SVGs, at load. `JD_enforceTurnCorner` (863–881) has the same
read-then-write interleave. Fix: compute the turn rect once per pass and
pass it in; in `enforceTurnCorner`, read every rect first, then write.
Same positions. **S**

**2.5 Podium drag writes before it reads** (jd-turn.js 1359–1369): the
ghost's `left/top` are set, then `podHit` reads row/tray/tier rects — a
synchronous layout per `pointermove`. Reorder (hit-test first, then move
the ghost; the ghost is `position:fixed; pointer-events:none` so its
position cannot affect those rects). Cache the row/tray/tier *elements* on
`podLift` (the file's own invariant says the DOM does not change mid-drag)
while still reading rects fresh. **S**

**2.6 Other hot-path re-queries.**
- `syncAltNav` (jd-record.js 528–540) re-queries three nodes on every
  `scroll` event of the alternatives strip ✓; resolve them once in
  `wireAltScrub`. **S**
- The turn object re-parses the whole scatter map from `sessionStorage` on
  every `ResizeObserver` tick (jd-furniture.js 187–196 → 245–246) to sweep
  a legacy key that can never return once deleted; sweep once in `build()`
  and pass the host rect into `seat`. **S**
- Folder `readRow` (jd-furniture.js 1465–1473) rewrites class and text on
  every `pointerover` inside an already-selected row; early-return on
  `is-on`. **S**
- Filmstrip: `paint` (jd-filmstrip.js 294–306) writes `aria-valuenow`,
  `aria-valuetext` and toggles `is-cur` on every rAF though they change only
  at mark boundaries; the 11 hidden surplus clones keep their full DOM
  (190–192 vs 236–238) — empty `.fs-cell-art` of hidden cells; `start()`
  re-reads every animation's timing per play (340–345). **S each**
- `sizeTiers()` is recomputed up to five times per rate render (jd-turn.js
  1640, 1665, 1783, 1901, 1972); compute once in `viewRate`. **S**
- `dropIntoPile`/`freshSpot` read the same rects twice and call
  `JD_wirePile()` once per restored item (2739–2768); hoist. **S**

**2.7 PHP: the asset hasher.** ✓ `jd_v()` (_assets.php 18–22) is uncached
and every asset is hashed twice per request (once for `$jd_build`, once
for its tag), ~1.8 MB of `md5_file` per drawer view; the about page
recomputes `$jd_build` over the merged list (66) and hashes the two webp
posters again in its head, ~4 MB per view. Memoise per request
(`static $memo`) and compute the build once after merging extras. Output
strings unchanged. **S**

**2.8 PHP: data.php.** ✓
- `?item=<curated id>` (485–495) searches *after* the whole turn population
  is built (323–481: four queries, pricing per response) and the match is
  always a curated entry first. The about page calls this on every load
  (about-scenes.js:211). Search the curated list right after the overlay
  and fall through only on a miss. Same payload, same first-match. **S**
- `?slim=1` prices every turn response (442–452) and `_slim.php` then drops
  `tokens`/`cost_usd`; guard the pricing when slim and not single-item. **S**
- The ETag's curated-size scan (45–47) and the overlay's `$subByItem`
  query (194–196) read the same rows; one query, same `ORDER BY id`, same
  `$sizes` string — the ETag value must not move (prove with 0.4). **S/M**
- `jd_ranks` is read three times per request (38, 228–235, 377–388) with
  the same precedence; one read in its own `try`. Both inner queries lack
  `ORDER BY`; note that in the commit. **M**
- `jd_build_stamp()` (api/jd-build.php 69–73) re-reads and re-decodes
  `taxonomy.json` on every curator request and write though `jd_taxonomy()`
  is static-cached; memoise. **S**
- `jd_load_submission_by_ref` (api/jd-generate.php 310) selects two columns
  nobody reads, up to three times per slot request. **S**

---

## Phase 3 — one definition each (cross-file de-duplication)

The same values and helpers, hand-copied, that must stay in sync by
discipline today. Each is a mechanical substitution; Phase 0.2/0.5 proves it.

**3.1 Constants → jd-core.js, exported once**
- `'jd-scatter-v2'`: jd-core.js 537, jd-turn.js 40, jd-furniture.js 45/372/660,
  about/index.php 90 (six copies) → `JD_SCATTER_KEY`. ✓
- The grade ramp `['#8f1d12','#b0490f','#a06200','#46761a','#0b6a1f']`:
  jd-core.js 1317, jd-furniture.js 847, about-scenes.js 1755, and the CSS
  `rc-g1..5` colours 1862–1866 ✓ → `JD_GRADE_RAMP` (CSS keeps its literals
  or reads them as `--jd-g1..5` tokens, §4).
- The ✕ mark `<svg class="jd-x-mark" …>`: five copies (jd-turn 194/964,
  jd-record 791/856, jd-furniture 1449) → `JD_X_MARK`.
- `INSET = 0.012` (jd-furniture 380/673, jd-core 542, jd-turn 2770);
  `ROT_MAX = 34` (jd-turn 44) vs `SCATTER.rotMax` (jd-core 541);
  `FALLBACK_BOX` 15.5/30/22 mirror jd-core's private `BASE` — have the
  loader's catch call `ready(BASE.m/xl/l)` instead of `ready(null)`.
- `MAX_PROMPT = 500` (jd-turn 41) mirrors `JD_PROMPT_MAX_CHARS` (jd-config
  252); `'LOADING...'` lives at jd-darkroom 135 and 376. Cross-reference at
  minimum.
- The data URL: `'/art/junk-drawer/data.php'` built at jd-core 1030 and
  jd-turn 147 → `JD_DATA_URL` (keep jd-turn's deliberate non-slim fallback).

**3.2 Helpers → jd-core.js**
- UUID v4: `uuid()` (jd-turn 77–95) and `JD_deviceRef` (jd-core 82–96) →
  `JD_uuid()` (keep `crypto.randomUUID` preference).
- `JD_liveAxes(tax)`: jd-turn 117–119, jd-core 992, jd-record 377.
- `JD_tierBox(tax, id)`: jd-turn 125–129, jd-core 702–705 / 1052–1053.
- `JD_byRankDesc(list)`: jd-turn 120–124, jd-record 360.
- `JD_shuffle(a, rnd)`: jd-core 545–551, jd-darkroom 1024–1028 and
  1095–1099 (pass the seeded `rnd` so dealt orders stay byte-identical).
- `JD_reduced()` already exists; `ropeReduced` (jd-core 1402–1404) is a
  second `matchMedia` of the same query. ✓
- Draw-on engine: `jd-filmstrip.js` 42–43, 76–92, 95–102 are verbatim copies
  of jd-core's `SEL/SKIP`, element walk and `strip` (2436–2472). Export
  `JD_drawOn.walk` / `JD_drawOn.strip`. Further (M/L, verify by diffing
  every cell's `style.animation`): let `JD_drawOn` accept a pre-walked
  plan so the filmstrip stops running 13 full computed-style walks per
  mount (one per clone).
- The "restart keyframes" idiom (`remove; void offsetWidth; add`) ×3 →
  `JD_restart(el, cls)`.

**3.3 Shared markup builders** (prove with 0.2 byte-diff)
- Paper-swap button: jd-record 27–59 vs jd-turn 814–830 (`paperBtnHTML`);
  `paperCls()` written inline at jd-turn 959 → `JD_paper.cls()` and
  `JD_paperBtn(cls)`.
- Enlargement figure: jd-record `zoomHTML` 783–794 vs jd-turn 959–975,
  including the same REDRAW icon paths (record 721–726, turn 966–971).
- Kraft corners: jd-turn `darkSwatch` 705–706 and `plate()` 863/865.

**3.4 Network plumbing**
- Keyed JSON POST with the same parse-fallback: jd-record 1253–1259 and
  1323–1329, jd-bench 175–181 → `adminPost(path, body)` (keep each
  caller's own rejection handler so messages stay the same). jd-turn's
  three POSTs (2394–2418, 2425–2445, 2559–2568) share a different
  `.then(j, fn)` shape → a local `postJSON`; the two identical retry blocks
  in `fetchTitle` (2405–2415) → one `retry()`.
- Consent record (jd-turn 2243–2247 vs 2905–2909) → `recordConsent()`;
  filing-failure card and the disable pair (`onFiled` 2571–2584 vs
  `curateFile` 3038–3051; 2549–2552 vs 3036–3038; `onClick` 2288/2301) →
  `paintFileFailure(code, sentence)`, `armFiling()`, `fileNow()`.
- `registerRecord`/`placeWinner` build the same response object twice then
  patch tokens/cost (2789–2827, 2653–2660) → one `respFor()`.

**3.5 The three furniture modules share a skeleton** (jd-furniture.js):
`ready(tierBox)` 142/410/703, the `build()` prologue 149/417/711, the
role/tabindex/aria element creation, the Enter/Space keydown, the
`JD_wirePile` tail and the `onFail` warn are the same in all three. Small
local helpers (`tierOr`, `makeItem`, `onActivate`, `warnFail`) rather than
a factory, so each module's call order stays verbatim (the sheet sizes
before append; the turn object strips the svg's role; the folder pins z).
Seat math `Math.min(0.45, (r.width||40)/2/(host.width||1))` is byte-identical
in sheet seat 561–563, folder seat 750–752 and jd-turn `freshSpot`
2763–2765; the avoidTurn→left/top/--rot apply block at 591–594 and
785–788. **M**

**3.6 Folder charts** (jd-furniture.js): grade track drawing duplicated in
`gradesHTML` 1126–1150 and `gaugeSVG` 1320–1333 (each with its own
`STEPS = 5`); `<svg class="fx-chart" …>` assembled three times; row label
and tail text duplicated between `barsSVG` and `gradesHTML`; `axesHTML`
(1204–1318) runs the Wilson `axisRates()` three times per row and builds a
fresh `matchMedia` per render though `axesMQ` exists. Extract
`trackSVG`, `chartSVG`, `rowLabel`, `rowTail`, `panelSVG`, `legendHTML`.
Prove with 0.2. **M**

**3.7 PHP backend** (api/jd-config.php gains a few helpers; every call site
keeps its own message text so responses and logs are unchanged)
- Curator preamble `origin; no_store; get; bench_key` ×5 and the POST
  variant ×2 → `jd_curator_get()` / `jd_curator_post()`.
- "bench rank outranks the turn's" map hand-built ×4 (bench-queue 134–140,
  ledger 88–94, data.php 227–236 and 375–388) → `jd_rank_by_generation()`.
- "jd_ranks may not exist" try/catch ×5 readers → `jd_query_or_empty_if_missing()`.
- setup-key gate ×2, curated-item resolve+sync ×2 (item-rate 69–92, curate
  39–53; item-rate also loads the taxonomy twice), `device_ref` column
  probe ×2, dense-ranking validation ×2 (rate 416–428, item-rate 184–191),
  turn-title fallback ×2 (data.php 463–466, ledger 444–445), pricing a
  stored row ×3 (data.php 442–452, rate 491–508, analytics 172–178),
  VERSION parsing ×2 (_assets.php 50–52, jd-build.php 38–46), UUID regex ×2
  and UUID minting ×2, model id→label map ×2.
- 15 redundant `setAttribute(PDO::ATTR_ERRMODE, …)` calls after `jd_db()`
  (which already sets it): delete.
- `JD_HARNESS` and `JD_HARNESS_BY_PROFILE['web']` are two sources of truth
  for the same string (jd-config 65 vs 132–135) — derive one from the other.
- `'bench'/'web'/'seed'/'curated'`, `'rated'/'pending'/…`, `'grade'/'axis'`
  are bare literals (43/17/17/9, 15/9/6, 60/9 occurrences): constants, one
  file at a time. **M**
- data.php: use `jd_taxonomy()` (64), drop the two dead `function_exists`
  require guards (186, 325), one PDO variable, one `$liveAxes`.

---

## Phase 4 — the stylesheet (render-identical; prove with 0.3 + screenshots)

**4.1 Hoist byte-identical tokens to `:root`.** `--grain` = `--tgrain` =
`--fgrain` (the same 474-byte feTurbulence URI ×3), `--mottle` = `--tmottle`,
the Courier stack ×9, the Iowan stack ×4, the Bradley Hand stack ×2 →
`--jd-grain-url`, `--jd-mottle-url`, `--jd-font-mono/form/hand`; each scrim
aliases its scoped name to the root token so every existing `var()` keeps
working and colour scoping stays as the "no leaching" note wants. The three
big drawer URIs (`--jd-frame-url`, `--jd-floor-url`, `--jd-craq-url`) are
single-use and stay verbatim. ~2.5 KB. **S**

**4.2 Group byte-identical blocks.** The 5-layer graph-paper stack on
`.rc-plate` 1396–1408, `.jd-dark-sw` 2486–2496, `.jd-turn-art` 3229–3239 ✓
and the blueprint pair 1441–1449 / 3260–3268 → one grouped selector each
(leave the two `--gk`-scaled `.rc-zoom-fig` copies alone). Likewise the
kraft corners (1456–1466 vs 3273–3283, size per selector), the paper button
(1427–1438 vs 3248–3259, hover per scrim), the disclosure caret
pseudo-elements (1787–1794 vs 3682–3689), the three close buttons' shared
seven declarations (1242, 1608, 2216), and the `:active` ×9 /
`:focus-visible` ×11 lists per scrim. Order is safe: every later competitor
on these elements has higher specificity (checked). **S/M**

**4.3 Merge same-selector pairs** that are split across the file with no
competing rule between them: `.jd-item--turn` 525/663, `.jd-item--sheet`
554/593, `.rc-plate` 1396/1475, `.jd-record-zoom.is-on` 1546/1652,
`.jd-dark-well--bar` 2785/2830, `.jd-dark-tele .t-c .ge` 2844/2857,
`.jd-rowhead` 3620/3625, `.jd-row-ctrl` 3621/3715, `.jd-folder-scrim`
4578/4653, `.jd-folder-tab` 4669/4688, `.jd-size-tier` 5151/5183; inside
media: `.jd-stage` ≤768 1056/1123, `.jd-turn[data-view="bench"]` ≤700
4161/4173, `.jd-turn-select` ≤768 4319/4328. Re-run the collision scan
after every move. **S**

**4.4 Media queries.** 44 blocks, 18 distinct queries, eight width
breakpoints (430, 480, 560, 600, 700, 768, 900, 1000). Merge only within a
component and only *downward* into the latest occurrence (e.g. the folder's
three `≤700` blocks into 4870, never up into 4765 — `.fx-t-lab` at 4870
must stay after its base at 4811). Keep the nine `reduce` blocks
per-component; 1656–1660 (4.6) is the reason. Spell 5373 like the other
two `(max-width: 480px)`. **S/M**

**4.5 Re-home scattered rules** (no render change; collision scan after):
`.jd-item--visitor` 4517–4550 beside `.jd-item` 172; the record card's
admin editor 5053–5104 and `.rc-bar.jd-bar--empty` 3724 into the record
section; `.jd-turn[data-view="plates"]` from three places; `.jd-pod`'s
≥701 overrides 3127–3187 after `.jd-pod` 3836; `.jd-size*`/`.jd-suppress`
5138–5214 with the turn-card views; `.jd-about-cta` 5409 beside its
modifier at 1038. **M**

**4.6 Tokens for repeated literals** (maintainability): `#1b4a8a` ×12,
`#f8f3e2` ×11, `rgba(74,98,138,.17)` ×8, `rgba(214,230,255,.28)` ×6,
`#4a628a` ×8, `#37414f` ×7 (a literal copy of `--form-ink`), bench gold
`#c9a84c` ×7 / `#e5c06b` ×6, the item drop-shadows ×5 and ×4 (the four
`.jd-sheet-half` restatements 599–610 would read `--jd-shadow-rest/lift`),
the modal card shadow ×3, `var(--jd-x-w) + var(--jd-x-gap)` ×5. The podium
`--pbase` (set 10×) / `--pw` (6×) tangle, with the doubled
`.jd-pod--said, .jd-pod.jd-pod--said` selector winning a specificity race
(explained at 4047), is worth untangling only with the screenshot diff on.
`--jd-head-line` restated as literals at 2454/4264 can come from `--t-title`
with identical numbers. **S/M**

**4.7 Comment prose → `CSS-NOTES.md`.** 520 comments, 172.8 KB (56%); the
106 comments ≥500 B total 92.6 KB, 22 of them ≥1 KB. Keep a one-line *why*
per rule and every "do not regress / order is load-bearing" warning
verbatim; move the dated decision narratives out, keyed by selector. Wire
saving is modest after gzip (~20–30 KB); the point is that the cascade
becomes readable. Dev-only, no VERSION bump. Your call (§6.1).

---

## 5. Not render-identical — decisions for the owner, not refactors

- **`--t-small` is read at `.jd-pod-lost` (css 3930) but defined nowhere** ✓,
  so the "didn't survive" line on the unveil renders at the inherited body
  size (16px), not `--t-body`. `font-size: inherit` is the render-identical
  fix (makes today's behaviour explicit); defining the token changes the
  size. Same story for `.rc-axcaret` reduced-motion: the `reduce` rule at
  1656–1660 precedes its base at 1787–1791 ✓ and never applies, so reduced-
  motion users get the 0.12 s caret morph. Deleting it is render-identical;
  moving it below 1791 fixes the a11y bug and changes behaviour.
- **The persisted turn is write-only.** `persist()` (jd-turn 156–158) and
  every `turn.state/slots/title` write serialise to `K_TURN`, which is
  removed at init and never read; the comment calls it the future recovery
  path (C1.4). Keep unless C1.4 is abandoned.
- **Owner-benched code that is unreachable but kept on request:** the
  darkroom `plot`/`bar` indicators and ~2.3 KB of their CSS (DARK_POOL
  excludes them, jd-darkroom 1076–1091), jd-record's `floorSVG` /
  `checkerFloorSVG` (~150 lines), jd-furniture's `ledgerHTML`, `firstsHTML`,
  `spendHTML` (~230 shipped lines), the `.fs-read*` block, the flag/flagnote
  handlers. A `_retired.js` not listed in `_scripts.php` would drop them
  from the wire with no behaviour change — your call.
- **Two rules that disagree with each other** (not refactors; flagged):
  `data.php:232/266–270` lets *any* client's full ranking re-point the shown
  response while `jd-ledger.php:195` requires `client === 'bench'`, so a
  seed-ranked item is shown by rank in the drawer and reported as "pinned /
  best grade" in the ledger. `jd-gen-svg.php:42–43` serves a drawing when
  `status='rated' || item_id`, ignoring `suppressed` and
  `retire_requested_at`, while `jd-analytics.php:499` says it checks both.
- `jd_build_files()` (api/jd-build.php 20–34) omits `jd-ledger.php`,
  `jd-curated-sync.php`, `jd-inventory.php`, `jd-harvest.php`,
  `jd-gen-svg.php`, `ledger.html` — the tooling fingerprint does not move
  when they change. Adding them changes the stamp string (intended, but a
  change).
- `card-gallery.html` hand-lists six scripts without `jd-filmstrip.js` and
  without cache-busters (131–136) ✓; `ledger.html` and `rating-bench.html`
  carry their own `headers()` because they do not load jd-core. Mounting
  the harness pages through `_scripts.php` would end the drift but makes
  them PHP pages.

---

## 6. Two bigger options (each a real trade-off; recommend deciding before Phase 4)

**6.1 Ship comment-free bytes without a local build step.** The source
would stay exactly as it is; a step in `.github/workflows/deploy.yml`
strips comments from the seven modules and the stylesheet before upload
(`jd_v()` hashes the uploaded bytes, so cache-busting still works). Wire
cost drops from 291 KB to ~102 KB gzipped, parse time with it, and the
house "no build step" rule holds for development. The cost: production
bytes differ from the repo's, which this project has avoided on principle,
and a stripped stylesheet has no inline "why". If this is a no, §4.7 is the
in-repo alternative.

**6.2 Server caching.** `.htaccess` has no `Cache-Control` for the `?v=`
busted assets or for `items/*.svg` (67 items, 285 files, 2.7 MB; the pile
fetches one SVG per item on every cold load — 49+ requests). Long-lived
`immutable` headers on `?v=`-stamped files and on item SVGs (their URLs
change only on a viewBox tightening, which is a committed edit) would make
repeat visits near-free without touching a line of the app. Needs a check
of what Bluehost already sends.

---

## 7. Sequencing, commit discipline, what to do first

1. Phase 0 (one or two sessions). Nothing else moves until a baseline is
   captured and committed.
2. Phase 1 deletions, one commit per file, baseline re-run after each.
3. Phase 2 in this order: 2.1 (the leak, one line), 2.7, 2.8, 2.4, 2.5,
   2.6, then 2.2/2.3 (the darkroom rework, the one M-sized item that needs
   the darkroom screenshots and a hidden-tab check).
4. Phase 3: constants (3.1) first — they are find-and-replace — then helpers
   (3.2), markup builders (3.3, byte-diff), network (3.4), furniture (3.5),
   charts (3.6), backend (3.7, payload-diff).
5. Phase 4 last, in the order written; the computed-style dump after every
   commit.

Commit messages follow the existing convention
(`junk-drawer: refactor — <what>, no visible change`). Under the house
rule these are dev-only changes and need no VERSION line; the colophon's
build fingerprint still moves on its own, so the owner can confirm which
build is live. Every public name is frozen: `window.JD_*` members, the
`jd-turn-open` / `jd-turn-close` events, `html.jd-turn-open` and
`jd-admin-on` classes, the `curate` job shape, the `--rot/--w/--pick-scale/
--pick-tall` custom properties JS reads, and the PHP function names the
scripts in `scripts/` require by path (`jd_generation_cost`, `jd_secrets`,
`jd_extract_svg`, `jd_sanitize_svg`, `jd_normalize_usage`, `jd_cost`).

If only one afternoon is available: Phase 0.1–0.2, then 2.1, 2.7, 2.8 and
the Phase 1 deletions. That is the leak, the two server costs that hit
every page view, and ~400 lines of dead code, all with a screenshot and
payload diff behind them.
