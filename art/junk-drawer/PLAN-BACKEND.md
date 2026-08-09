# PLAN-BACKEND.md — The Junk Drawer: Data Architecture

Backend / data-layer plan for `/art/junk-drawer/`. Companion to PLAN-FRONTEND.md.
Source of truth for the vision: `art/junk-drawer/README.md`.

## Context and constraints (verified against the repo)

- Plain PHP site, no build step, no framework. Art projects live in `art/<name>/` with `index.php`, plain JS/CSS, and `PLAN-*.md` docs (see `art/kolob/`, `art/prosperos-jukebox-v2/`).
- **Publishing = pushing to `main`.** `.github/workflows/deploy.yml` FTPS-syncs the repo to Bluehost on every push to `main` (SamKirkland FTP-Deploy-Action, incremental). `scripts/publish.sh` is the local equivalent. So a commit made from Claude Code on the web IS the entire publishing act — exactly the subway requirement.
- **Deploy excludes `**/*.md`, `scripts/**`, `.github/**`, `local-dev/**`.** Consequences this plan designs around:
  - Any data that must be *served* cannot be Markdown. Metadata and transcripts must be `.json` (or `.txt`), never `.md`.
  - `CLAUDE.md`, `README.md`, and `PLAN-*.md` inside `art/junk-drawer/` stay repo-only automatically — safe to write freely.
  - The validator belongs in `scripts/` so dev tooling never ships to production.
- MySQL exists (`api/database.php`, Bluehost-side secrets) and powers interactive features (chat, feedback, tracking, O*NET). JSON-serving PHP endpoints are an established pattern (`api/health.php`, `api/work-context.php`, etc.).
- Local dev runs via `php -S localhost:8000 router.php` from the repo root.

---

## 1. Storage model: flat files in git (MySQL rejected)

### Why not MySQL

The workflow requirement decides this. A phone/Claude-Code-web session can only produce **commits**; it cannot reach the Bluehost MySQL instance. Using the DB would require either (a) an authenticated admin write endpoint callable from the phone — new auth surface, new failure modes, and the data would live outside git — or (b) a post-deploy import script that syncs committed files into MySQL, which is a build step in disguise and a second source of truth to drift. Meanwhile the dataset is tiny (hundreds of items, KB-scale metadata), read-only at serve time, and benefits enormously from what git gives for free: versioning, diff review of every grade change, trivial backup, and human-editable text. MySQL adds cost and subtracts capability here. (If a future feature needs visitor interaction — e.g., visitors voting on grades — that lives in a *separate* table and doesn't change this layer.)

### Entity model: prompt-as-entity, responses hang off it

The README is explicit that alternatives are "responses from other LLMs to **the same prompt**." The prompt is the natural grouping key, so it is the entity:

- **Prompt entry** = one directory, one `entry.json`, N SVG files.
- **Response** = an object in the entry's `responses` array + its SVG file. The *response* is the graded/annotated unit (grade, axes, generation mode are per-response). One response is the *primary* — the object that appears in the drawer; the rest are "other models' takes." Which one that is follows the grade unless the entry pins a `rid` in `primary`.

Item-as-entity with an `alternatives` array was considered and rejected: it makes one response structurally privileged, duplicates the prompt across siblings or forces cross-references, and makes "regrade the alternative" a second-class edit. Prompt-as-entity keeps the prompt verbatim in exactly one place and makes adding an alternative a pure append.

### Directory layout

```
art/junk-drawer/
├── README.md                  # vision (exists; repo-only)
├── CLAUDE.md                  # subway-workflow instructions (drafted in §5; repo-only)
├── PLAN-BACKEND.md            # this file (repo-only)
├── PLAN-FRONTEND.md           # frontend agent's plan (repo-only)
├── index.php                  # frontend page (frontend plan)
├── drawer.js / drawer.css     # frontend assets (frontend plan)
├── taxonomy.json              # the rubric as data (§2) — served
├── data.php                   # read-only JSON endpoint (§3) — served
└── items/
    ├── 2026-07-26-rubber-duck/
    │   ├── entry.json                         # prompt + all responses' metadata
    │   ├── claude-sonnet-4-5.svg              # response SVGs, named by model slug
    │   ├── gpt-5.svg
    │   └── claude-sonnet-4-5.transcript.json  # optional, added later (.json, NOT .md)
    └── 2026-07-28-astrolabe/
        ├── entry.json
        └── gemini-2-5-pro.svg
```

Also (outside the project dir, per repo conventions):

```
scripts/validate-junk-drawer.py                # validator (§4) — never deployed
.github/workflows/validate-junk-drawer.yml     # CI backstop (§4)
```

### Naming conventions

- **Item directory / id**: `YYYY-MM-DD-<slug>` — creation date + short kebab-case slug derived from the item's subject (not the full prompt). Lowercase `a-z0-9-` only. The directory name IS the item id (also stored in `entry.json`; the validator enforces the match).
- **SVG filename**: `<model-slug>.svg` (e.g., `claude-sonnet-4-5.svg`); if the same model produced two responses to one prompt, suffix `-2`, `-3`. The filename is human-friendly convenience; `entry.json`'s `file` field is the authoritative reference.
- **Response id (`rid`)**: `r1`, `r2`, … in order added. Permanent once committed (grade history and future links hang on it).
- **JSON formatting**: 2-space indent, UTF-8, LF, one key per line — keeps diffs minimal and merges legible.

### Why this merges cleanly

- The overwhelmingly common concurrent case — two sessions each adding a **new item** — touches two different directories: zero conflict, guaranteed, forever. Date-prefixed slugs make accidental name collisions essentially impossible without any counter to coordinate.
- Adding an **alternative** to an existing item appends one object to one array in one small file; a conflict requires two sessions editing the *same prompt's* entry simultaneously, which for a single owner is negligible — and if it happens, the resolution is a trivial "keep both array elements."
- Critically, there is **no committed manifest** (see §3). A single shared manifest file that every add rewrites would turn every pair of concurrent commits into a conflict, defeating the per-directory win. The manifest is assembled at request time instead.

---

## 2. Schema

### 2.1 `taxonomy.json` — the rubric as data

Everything the frontend renders about grades/axes/models comes from this file, so extending the taxonomy is a one-file edit and the frontend never hardcodes rubric strings.

```json
{
  "schema": 1,
  "version": 1,
  "updated": "2026-07-26",

  "grades": [
    { "id": "prime",    "rank": 5, "label": "Prime",    "description": "Exceptional. Faithful to the prompt, technically clean, aesthetically strong. Would ship as-is." },
    { "id": "choice",   "rank": 4, "label": "Choice",   "description": "Strong result with minor blemishes a careful eye can find." },
    { "id": "select",   "rank": 3, "label": "Select",   "description": "Competent and recognizable; noticeable flaws on one or more axes." },
    { "id": "standard", "rank": 2, "label": "Standard", "description": "Gets the idea across despite significant defects." },
    { "id": "utility",  "rank": 1, "label": "Utility Grade", "description": "The lowest tier. Barely fit for purpose; kept for the record (and the comedy)." }
  ],

  "axes": [
    {
      "id": "prompt-fidelity",
      "label": "Prompt fidelity",
      "description": "Did the model draw what was asked? Omissions, additions, misreadings.",
      "values": [
        { "id": "faithful", "rank": 3, "label": "Faithful", "description": "All requested elements present as specified." },
        { "id": "partial", "rank": 2, "label": "Partial",  "description": "Some requested elements missing, extra, or misread." },
        { "id": "off-brief", "rank": 1, "label": "Off-brief","description": "Substantially not the thing that was asked for." }
      ]
    },
    {
      "id": "geometry",
      "label": "Geometry & topology",
      "description": "Path construction: self-intersections, broken joins, misaligned shapes, impossible anatomy.",
      "values": [
        { "id": "clean", "rank": 3, "label": "Clean", "description": "No visible construction errors." },
        { "id": "minor", "rank": 2, "label": "Minor defects", "description": "Small misalignments or overlaps visible on inspection." },
        { "id": "major", "rank": 1, "label": "Major defects", "description": "Structural errors that dominate the read of the image." }
      ]
    },
    {
      "id": "color",
      "label": "Color & rendering",
      "description": "Palette coherence, gradient quality, fill/stroke errors, z-order mistakes.",
      "values": [
        { "id": "clean", "rank": 3, "label": "Clean", "description": "Palette and rendering read as intended." },
        { "id": "minor", "rank": 2, "label": "Minor defects", "description": "Off colors, banding, or stacking slips that don't break the image." },
        { "id": "major", "rank": 1, "label": "Major defects", "description": "Rendering errors that break the image." }
      ]
    },
    {
      "id": "composition",
      "label": "Composition",
      "description": "Framing, balance, use of the canvas; is the subject well-placed and scaled?",
      "values": [
        { "id": "clean", "rank": 3, "label": "Clean", "description": "Well-composed within its viewBox." },
        { "id": "minor", "rank": 2, "label": "Minor defects", "description": "Awkward margins, crowding, or scale oddities." },
        { "id": "major", "rank": 1, "label": "Major defects", "description": "Subject clipped, marooned, or scaled absurdly." }
      ]
    }
  ],

  "models": [
    { "id": "claude-sonnet-4-5", "label": "Claude Sonnet 4.5", "vendor": "Anthropic" },
    { "id": "claude-opus-4-1",   "label": "Claude Opus 4.1",   "vendor": "Anthropic" },
    { "id": "gpt-5",             "label": "GPT-5",             "vendor": "OpenAI" },
    { "id": "gemini-2-5-pro",    "label": "Gemini 2.5 Pro",    "vendor": "Google" }
  ],

  "changelog": [
    { "date": "2026-07-26", "version": 1, "note": "Initial taxonomy: 5-tier grade scale, 4 axes." }
  ]
}
```

Rules baked into the design:

- **Adding an axis, value, grade, or model = append to this file** (+ a changelog line, bump `version`). Old entries simply lack the new axis key — that is the sparse representation, not an error.
- **Ids are permanent.** Labels and descriptions may be reworded; ids may never be renamed or deleted while any entry references them (the validator enforces referential integrity, so a violation is caught immediately). Exception since taxonomy v8/v9: entries reference **grades and axis values by numeric `rank`** (see §2.2), not by id, so those ids/labels may be reworded freely — the `rank` numbers are the permanent part of both scales. Axis ids themselves are still referenced (as annotation keys) and stay permanent.
- The starter grade scale and axes above are seed content, not law — they're data the owner edits.
- The `models` registry is what makes "grades by model" stats trivial later: every response's `model` field must match a registry id, so model naming can't drift ("GPT-5" vs "gpt5" vs "OpenAI GPT-5"). Registering a new model is one appended object.

### 2.2 `items/<id>/entry.json` — one per prompt

```json
{
  "schema": 2,
  "id": "2026-07-26-rubber-duck",
  "title": "Rubber duck",
  "prompt": "Draw a classic yellow rubber duck, three-quarter view, floating on two stylized water ripples. Flat vector style, warm palette.",
  "created": "2026-07-26",
  "tags": ["toy", "animal"],
  "primary": "r1",
  "placement": { "x": 0.42, "y": 0.63, "rotation": -14, "scale": 1.0, "z": 3 },
  "retired": false,
  "responses": [
    {
      "rid": "r1",
      "file": "claude-sonnet-4-5.svg",
      "model": "claude-sonnet-4-5",
      "model_version": "claude-sonnet-4-5-20250929",
      "date": "2026-07-26",
      "generation": { "mode": "one-shot", "prompt_count": 1 },
      "grade": 4.0,
      "graded": "2026-07-26",
      "grade_history": [],
      "annotations": {
        "prompt-fidelity": 3.0,
        "geometry": 3.0,
        "color": { "value": 2.0, "note": "Gradient banding on the beak highlight." }
      },
      "transcript": null,
      "notes": "First one-shot attempt; kept as primary."
    },
    {
      "rid": "r2",
      "file": "gpt-5.svg",
      "model": "gpt-5",
      "date": "2026-07-26",
      "generation": { "mode": "refined", "prompt_count": 3 },
      "grade": 2.0,
      "annotations": {
        "prompt-fidelity": 2.0,
        "geometry": { "value": 1.0, "note": "Wing path self-intersects; ripple 2 detached from the duck." }
      }
    }
  ]
}
```

**Field reference** (R = required, O = optional):

| Field | R/O | Notes |
|---|---|---|
| `schema` | R | Entry-schema version, currently `2` (numeric grades; `1` stored grades as id strings). Lets a future migration script target old shapes. |
| `id` | R | Must equal the directory name. |
| `title` | R | Short display name for tooltips/captions. |
| `prompt` | R | **Verbatim**, whitespace preserved. The one canonical copy. |
| `created` | R | `YYYY-MM-DD`. |
| `tags` | O | Free-form kebab-case strings; future browsing facet. |
| `primary` | O | Pins the `rid` shown in the drawer, overriding grade. Absent (the norm) = server resolves to the best-graded response. |
| `placement` | O | Drawer coordinates — see §7. Absent = frontend computes deterministically. |
| `retired` | O | `true` hides the item from the drawer without deleting history. Default `false`. |
| `responses[]` | R | ≥ 1 response. |
| — `rid` | R | `r1`, `r2`, … unique within the entry, permanent. |
| — `file` | R | SVG filename in the same directory. |
| — `model` | R | Must match a `taxonomy.json` models id. |
| — `model_version` | O | Exact dated/model-string when known. |
| — `date` | R | Generation date, `YYYY-MM-DD`. |
| — `generation` | R | `mode`: `"one-shot"` or `"refined"`. `prompt_count`: R when refined (≥ 2); omit or `1` when one-shot. |
| — `grade` | R | Current grade **as a number**: the `rank` of a taxonomy grade, written as a decimal (`5.0` … `1.0`). Never the id/label string — display strings resolve through the taxonomy at render time, so the scale can be relabeled without touching entries. |
| — `graded` | O | Date of current grade. |
| — `grade_history` | O | Array of `{ "grade", "date", "taxonomy_version", "note" }` — prior grades (numeric, same rule as `grade`), oldest first (see §6). |
| — `annotations` | O | Object keyed by **axis id**. Each value is **a number**: the `rank` of one of that axis's values written as a decimal (best = `3.0` … worst = `1.0`), either bare or as `{ "value": <rank>, "note": "<free text>" }` — never the value id/label string. **A missing axis key means "not annotated on this axis"** — the normal state for entries older than an axis. An explicit top-rank value means "examined and found clean," which is different from absent; the frontend should render absent axes as "not assessed." |
| — `transcript` | O | Filename of a refinement transcript in the same directory (see §6), or `null`. |
| — `notes` | O | Free-form curator commentary. |

Unknown extra fields are permitted (the validator warns, doesn't fail) so the schema can grow without breaking old validators — forward compatibility in both directions.

---

## 3. Serving: a small read-only PHP endpoint, no committed manifest

Three options weighed:

1. **Committed manifest built by a script** — rejected. It's a build step (violates the site's convention), a merge-conflict magnet (every add rewrites one shared file — destroys the §1 merge property), and a phone-session foot-gun (forget to rebuild → silently stale site).
2. **Direct per-item fetch of `entry.json` files** — rejected as the primary path. The frontend can't discover directories without a listing, so this needs an index anyway; and N+1 requests for hundreds of items is slow on mobile.
3. **PHP endpoint that globs + concatenates** ✅ — one request, zero staleness (a pushed commit is live as soon as FTPS sync lands, no rebuild), zero build step, and consistent with the site's existing JSON-over-PHP pattern (`api/health.php` et al.). Cost is a server-side glob + `json_decode` of a few hundred small files per request — trivial for Bluehost, and ETag/304 handling makes repeat visits nearly free.

### `art/junk-drawer/data.php` behavior

- Reads `taxonomy.json` and every `items/*/entry.json`; emits one JSON document (shape in §7).
- **Defensive**: an unparseable or grossly invalid `entry.json` is *skipped* and reported in an `errors` array — one bad subway commit degrades to "that item is missing," never "the drawer is broken."
- Enriches each response with a ready-to-use `url` (`/art/junk-drawer/items/<id>/<file>`) and `transcript_url` when present, so the frontend never assembles paths.
- Sorts items by `created` descending (newest junk on top of the pile, fittingly).
- **Caching**: `ETag` = md5 over (path + mtime) of taxonomy + all entry files; honor `If-None-Match` → `304`. `Cache-Control: no-cache` so clients revalidate cheaply and a fresh push appears immediately. (The site's `bust-cache.py` only versions CSS/JS refs, so runtime-fetched JSON must self-manage caching — this does.)
- Optional niceties, cheap to include: `?item=<id>` returns a single entry; anything else is out of scope for v1.
- The **SVGs themselves are static files**, fetched directly by the browser with normal HTTP caching; `data.php` does not inline them (a future `?inline=1` could, if the frontend wants a single round-trip — see §6).

Works identically under `php -S localhost:8000 router.php` for local dev.

---

## 4. Validation & integrity

### `scripts/validate-junk-drawer.py`

Python 3, **stdlib only** (`json`, `pathlib`, `re`, `xml.etree`), so it runs on the owner's Mac and inside a Claude Code web sandbox with no installs. Lives in `scripts/` so it never deploys. Run: `python3 scripts/validate-junk-drawer.py` (add `--strict` to promote warnings to failures). Exit 0 = clean; nonzero with a readable per-file error list otherwise.

**Taxonomy checks**: parses; unique ids across grades/axes/axis-values/models; every axis value has a description; `rank` values present and unique (across grades, and within each axis's values).

**Entry checks (every `items/*/entry.json`)**:
- parses as JSON; required fields present with correct types; `id` == directory name
- dates are `YYYY-MM-DD`; `rid`s unique within entry; `primary` (if set) refers to an existing `rid`
- `grade` is a number matching a taxonomy grade `rank`; every `annotations` key ∈ taxonomy axes; every annotation value is a number matching one of that axis's value `rank`s; `model` ∈ taxonomy models
- `generation.mode` valid; `prompt_count` consistent with mode
- every `file` and `transcript` exists on disk; **warn** on orphan `.svg` files no response references
- `placement` values in range (`x`,`y` ∈ [0,1]) when present

**SVG hygiene checks (every referenced `.svg`)**:
- parses as XML; root is `<svg>` with `xmlns`
- **`viewBox` required** (this is what lets the drawer scale items freely; fixed `width`/`height` attrs alongside it are fine, but warn if present without `viewBox`)
- **reject**: `<script>` elements, any `on*` event attributes, `javascript:` URLs, `<foreignObject>` — these matter because the frontend will likely inline SVG source into the DOM for styling/interaction, so sanitization happens **at commit time, by the validator**, not at runtime
- **warn**: external `http(s)` `href`/`xlink:href` (privacy + offline-breakage; `#fragment` refs allowed), embedded raster `data:` URIs (a base64 PNG in an "SVG" defeats the premise), file size > 200 KB

Threat model note: only the owner commits, so this is hygiene against *accidental* LLM output hazards, not hostile upload defense — which is why validator-time sanitization is sufficient.

### `.github/workflows/validate-junk-drawer.yml`

A tiny workflow: on `push`/`pull_request` touching `art/junk-drawer/**` or `scripts/validate-junk-drawer.py`, checkout + `python3 scripts/validate-junk-drawer.py`. This is the backstop for phone sessions — if a web session somehow commits without validating, the red X on GitHub (visible from the phone) says exactly what to fix. It does **not** gate the deploy workflow (keeping them decoupled is simpler, and `data.php`'s defensiveness means a bad entry can't break the live page). One caveat, already documented in `scripts/publish.sh`: pushing a new file under `.github/workflows/` requires the git credential to have GitHub's `workflow` scope (`gh auth refresh -h github.com -s workflow`) — do this commit from the owner's machine.

---

## 5. The subway workflow

### The flow, end to end

1. On the phone, the owner opens a Claude Code web session on `tysonwelsh/municipal-sky-site` and says, e.g., *"New junk drawer item"* — pasting or dictating the prompt, the SVG source(s), and whatever metadata they have.
2. The session reads `art/junk-drawer/CLAUDE.md` (below), which tells it everything: where files go, what to elicit, how to validate, how to commit.
3. The session writes `items/<id>/entry.json` + SVG file(s), runs the validator, fixes anything it flags, commits with the conventional message, pushes.
4. Push to `main` → `deploy.yml` FTPS-syncs → item is live. `data.php` picks it up on the next request. **No other step exists.**

### Draft contents of `art/junk-drawer/CLAUDE.md`

The following is the actual proposed file content, ready to commit (it will never deploy — `*.md` is excluded):

````markdown
# CLAUDE.md — How to add items to The Junk Drawer

This directory is a curated collection of LLM-generated SVGs with eval-style
annotations. This file is the complete procedure for adding or editing
entries. It is written for a Claude Code session with ZERO prior context
(including web sessions started from a phone). Follow it exactly.

## The one rule

**Committing files to this repo is the entire publishing act.** A push to
`main` auto-deploys to production (`.github/workflows/deploy.yml`). Do not
look for a database, an upload endpoint, or a build step — none exists for
this feature. Never write servable data as `.md` (deploy excludes it);
data files are `.json`, art is `.svg`.

## File map

- `taxonomy.json` — grade scale, annotation axes, model registry. The rubric
  IS this file; the frontend renders it as data.
- `items/<YYYY-MM-DD>-<slug>/entry.json` — one directory per PROMPT. All
  responses (from different models) to that prompt live in this one entry.
- `items/<...>/<model-slug>.svg` — one file per response.
- `data.php` — read-only serving endpoint. Do not modify during content adds.
- `scripts/validate-junk-drawer.py` (repo root `scripts/`) — the validator.

## Procedure: add a NEW item

1. **Elicit from the owner** (ask only for what wasn't provided; never invent):
   - The prompt, VERBATIM. Do not trim, fix typos, or reformat it.
   - The SVG source (pasted), or a request for you to generate it.
   - Model + version for each response (must exist in `taxonomy.json`
     `models`; if new, append `{id, label, vendor}` there first — kebab-case id).
   - One-shot or refined? If refined, how many prompts total?
   - Generation date (default: today).
   - A grade (read the scale from `taxonomy.json` `grades` and show the
     owner the label + description list to pick from; filed as the grade's
     numeric `rank`, e.g. `4.0`).
   - Annotations: read `taxonomy.json` `axes`; for each axis, ask for a
     value (offer the value labels + descriptions) OR "skip"; filed as the
     value's numeric `rank`, e.g. `2.0`. Skipped axes are OMITTED from the
     annotations object — never write null/empty for them. Attach the
     owner's remarks as `{"value": <rank>, "note": ...}`.
2. **Create the directory**: `items/<YYYY-MM-DD>-<slug>/` where slug is a
   short kebab-case name for the subject (e.g. `rubber-duck`), NOT the full
   prompt. Check it doesn't already exist.
3. **Write the SVG** as `<model-slug>.svg`, byte-exact as provided. Do not
   "clean it up" — imperfections are the point of this collection. Exception:
   if the validator rejects it (script/event-handler/foreignObject), report
   that to the owner rather than silently editing the art.
4. **Write `entry.json`** following the schema in `PLAN-BACKEND.md` §2.2
   (or copy an existing entry as a template). Required: schema, id, title,
   prompt, created, responses[{rid, file, model, date, generation, grade}].
   2-space indent, UTF-8, LF. `rid`s are `r1`, `r2`, … and are permanent.
5. **Validate**: `python3 scripts/validate-junk-drawer.py` — fix every error
   it reports before committing. If python3 is unavailable, at minimum
   verify the JSON parses and the file references are correct, and say so
   in the commit message.
6. **Commit and push** to `main`:
   `junk-drawer: add "<title>" (<model>[, <model>...])`
   Include ONLY this item's files (plus taxonomy.json if you registered a
   model). Do not run publish.sh; the push triggers deployment.

## Procedure: add an ALTERNATIVE to an existing item

Find the item's directory, add the new `<model-slug>.svg`, APPEND one
response object (next `rid`) to the existing `responses` array. Never
reorder, renumber, or rewrite existing responses. Elicit grade/annotations
as above. Validate, then commit:
`junk-drawer: add <model> alternative to "<title>"`.

## Procedure: regrade / annotate an existing response

Push the old grade into `grade_history` as
`{"grade": <old rank number>, "date": <old graded date>, "taxonomy_version": <n>, "note": <why>}`,
then set the new `grade` (a rank number) and `graded`. Adding annotations on new axes to old
entries is just adding keys. Commit: `junk-drawer: regrade "<title>" <rid> <old>→<new>`.

## Procedure: extend the taxonomy

Append the new axis/value/grade/model to `taxonomy.json` with a real
human-readable description (the frontend displays it), add a `changelog`
line, bump `version`. NEVER rename or delete an id that any entry
references — the validator will fail if you do. Commit:
`junk-drawer: taxonomy — add axis "<label>"`.

## Never

- Never modify `data.php`, `index.php`, or `drawer.*` during a content add.
- Never rename ids (`items/` dirs, `rid`s, taxonomy ids) once committed.
- Never create or commit a manifest/index of items — `data.php` assembles
  it at request time.
- Never store transcripts or notes as `.md` inside `items/` — use `.json`.
````

---

## 6. Evolution paths (the shape must not preclude these)

- **Regrading when the taxonomy changes**: `grade_history` (already in schema) records prior grades with the `taxonomy_version` they were issued under; `taxonomy.json`'s `version` + `changelog` give the timeline. A future "regrade sweep" is a mechanical script: for each response where `graded` predates a taxonomy version bump, prompt the owner. Nothing to migrate — history is append-only.
- **Refinement transcripts**: the `transcript` field already exists; drop `<model-slug>.transcript.json` (array of `{"role": "user"|"assistant", "content": "..."}` turns) into the item directory and set the field. `data.php` exposes `transcript_url`; the frontend can lazy-fetch it. `.json` extension is mandatory (deploy excludes `.md`).
- **Stats/aggregates** ("grades by model", grade distribution, one-shot vs refined success rates): already enabled by canonical keys — `model` is a foreign key into the taxonomy and `grade` is the numeric rank itself (averages come free), so group-bys are trivial. V1: the frontend computes from the full `data.php` payload (hundreds of items — client-side is fine). Later: a `?stats=1` mode on `data.php` if payloads grow.
- **Retiring items**: `retired: true` — history preserved, drawer decluttered. Never delete directories.
- **Payload growth**: if the drawer someday holds thousands of items, `data.php` can add `?since=` / pagination, or `?inline=1` to embed SVG source and collapse round-trips, without any storage change. If interactivity ever arrives (visitor reactions), that's a MySQL table keyed by item `id`/`rid` — the flat-file layer is unaffected.
- **Schema migration**: per-entry `schema` field means a migration script can find and upgrade old shapes precisely.

---

## 7. Frontend interface (the data contract)

The frontend gets everything from **one request**; SVGs are plain static files.

### `GET /art/junk-drawer/data.php`

`200 OK`, `Content-Type: application/json; charset=utf-8`, `ETag` supported (`304` on `If-None-Match` match).

```json
{
  "generated": "2026-07-26T21:14:03Z",
  "count": 2,
  "taxonomy": { /* taxonomy.json verbatim — grades (with rank + descriptions), axes, models, version */ },
  "items": [
    {
      "id": "2026-07-26-rubber-duck",
      "title": "Rubber duck",
      "prompt": "…verbatim…",
      "created": "2026-07-26",
      "tags": ["toy", "animal"],
      "primary": "r1",
      "placement": { "x": 0.42, "y": 0.63, "rotation": -14, "scale": 1.0, "z": 3 },
      "responses": [
        {
          "rid": "r1",
          "file": "claude-sonnet-4-5.svg",
          "url": "/art/junk-drawer/items/2026-07-26-rubber-duck/claude-sonnet-4-5.svg",
          "model": "claude-sonnet-4-5",
          "model_version": "claude-sonnet-4-5-20250929",
          "date": "2026-07-26",
          "generation": { "mode": "one-shot", "prompt_count": 1 },
          "grade": 4.0,
          "graded": "2026-07-26",
          "grade_history": [],
          "annotations": { "geometry": 3.0, "color": { "value": 2.0, "note": "…" } },
          "transcript_url": null,
          "notes": "…"
        }
      ]
    }
  ],
  "errors": []
}
```

**Contract guarantees** (what the frontend may rely on):

1. `taxonomy` is always present and is the *only* source for grade/axis/model display strings, descriptions, and grade ordering (`rank`, higher = better; rank 1 is the floor). A response's `grade` is a **number equal to a taxonomy grade's `rank`** — resolve it to its grade object by rank to display anything. Render the rubric from data; hardcode nothing.
2. `items` is sorted `created` descending and excludes `retired` items. Every item has ≥ 1 response; `primary` always resolves. An entry MAY pin one response by setting `primary`, which wins outright; with no pin the server resolves to the **best-graded** response (highest numeric grade, ties breaking to the earliest `rid`, falling back to the first response when no numeric grade is present) — so a regrade re-points the drawer with no entry edit. The primary response is the object in the drawer; other responses are the "other models' takes."
3. Every response has a ready `url` (same-origin static SVG, safe to `fetch` and inline — commit-time validation guarantees `viewBox` present, no scripts/handlers/foreignObject) and `transcript_url` (string or `null`).
4. **`placement` is the designated home for coordinates** and is optional: `x`,`y` ∈ [0,1] (fraction of drawer floor, item center), `rotation` in degrees, `scale` relative multiplier (1.0 = default sizing), `z` integer stacking hint (higher = nearer the viewer). **When absent, the frontend computes a deterministic placement seeded by the item `id` hash** — same layout every visit, no coordination needed. If the frontend later wants to persist a hand-arranged layout, it writes `placement` back into `entry.json` via a normal commit (it has a home; nothing changes shape).
5. **Sparseness rule**: `annotations` may be missing keys for any axis (esp. axes added after the entry). Absent axis = "not assessed" — render differently from an explicit clean/defect value. An annotation value is a **number equal to one of that axis's value `rank`s**, either bare or as `{value, note}`; handle both, and resolve display strings by rank off the taxonomy. Ignore unknown fields anywhere (forward compatibility).
6. `errors` lists any skipped/malformed entries (path + reason) — log to console, never render.
7. Optional: `GET /art/junk-drawer/data.php?item=<id>` returns `{ "taxonomy": …, "item": {…} }` for a single entry.

---

## Implementation sequencing

1. **`taxonomy.json`** — seed grades/axes/models (content above; owner adjusts wording). No dependencies.
2. **`scripts/validate-junk-drawer.py`** — depends on schema (§2). Build second so everything after is checkable.
3. **First real item** under `items/` — validates the schema against reality; needed before `data.php` can be smoke-tested.
4. **`data.php`** — glob, decode, enrich, ETag; defensive skipping. Test locally via `php -S localhost:8000 router.php`.
5. **`art/junk-drawer/CLAUDE.md`** — commit the §5 draft.
6. **`.github/workflows/validate-junk-drawer.yml`** — last, from the owner's machine (needs `workflow` scope on the git credential, per the note in `scripts/publish.sh`).
7. Update `art/junk-drawer/README.md` status line; the frontend plan (`PLAN-FRONTEND.md`) consumes §7 as its input contract.

**Anticipated pitfalls, pre-answered**: Markdown deploy-exclusion (all servable data is `.json` — enforced by convention *and* the CLAUDE.md "Never" list); manifest merge conflicts (no manifest exists); rubric drift (taxonomy ids permanent, validator enforces referential integrity); phone sessions committing junk (validator + CI + defensive `data.php` = three layers, none load-bearing alone).

### Critical Files for Implementation
- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/taxonomy.json (new — the rubric as data; everything references it)
- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/data.php (new — the serving endpoint / frontend contract)
- /Users/tysonwelsh/Sites/municipal-sky-site/scripts/validate-junk-drawer.py (new — schema + SVG-hygiene validator)
- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/CLAUDE.md (new — the subway-workflow instructions, drafted in §5)
- /Users/tysonwelsh/Sites/municipal-sky-site/.github/workflows/deploy.yml (existing — defines the deploy exclusions the data layer must respect)
