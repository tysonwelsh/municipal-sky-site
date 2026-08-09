# PLAN-USER-PROMPTS.md — visitor-submitted prompts ("Take a Turn")

Plan for the first *interactive* junk-drawer feature: a button on the
bottom-left of the drawer that lets a **visitor** describe an object,
receive two SVG responses from two different LLMs via API, rate each on
the taxonomy axes (the same instrument discipline the owner uses), and
pick a preferred one — the winner landing in their drawer. Companion to
PLAN-BACKEND.md / PLAN-FRONTEND.md / PLAN-MOBILE.md; where those cover
the curated collection, this covers the visitor loop.

Two goals beyond the feature itself, both owner-stated:

1. **Eval-grade data collection.** Ratings + pairwise preferences,
   captured with enough provenance (model, params, harness version,
   taxonomy version, display order) to be genuinely useful as
   LLM-evaluation / preference data — a novel, creative data collection
   instrument, not just a toy.
2. **App Store trajectory.** No dramatic refactor now, but every
   architectural decision made from this point on must not foreclose
   shipping this page as an iOS app later (§5).

---

## 1. Findings from the code review (what exists, what transfers, what doesn't)

### 1.1 The two trust models — the central design fact

The entire existing junk-drawer stack is built on **commit-time trust**:
only the owner commits; the validator (`scripts/validate-junk-drawer.py`)
sanitizes SVGs *before* they enter the repo; `data.php` and the frontend
then treat every SVG as safe to inline into the DOM. PLAN-BACKEND §4 says
this explicitly: "hygiene against accidental LLM output hazards, not
hostile upload defense."

Visitor submissions break that assumption. LLM output triggered by an
untrusted prompt, inlined into the live page, is a **runtime** trust
problem: sanitization must move server-side, into the request path, and
must be strict (reject, never repair-and-hope). This is the single
biggest piece of new backend work, and the reason "copy the Onomatopoeia
Machine" is a starting point, not the whole answer.

### 1.2 What the Onomatopoeia Machine gives us (`api/chat.php`)

The transferable pattern: one PHP endpoint, cURL to Anthropic
(`/v1/messages`, `x-api-key`, `anthropic-version` header) and OpenAI
(`/v1/chat/completions`, bearer token), keys from the Bluehost
private-config `secrets.php` (outside webroot), both results returned in
one JSON response, conversation logged to MySQL via `api/database.php`
(PDO, prepared statements). MySQL + PDO + the `secrets.php` pattern all
work and are proven on this host. `api/onobot-cron.php` proves Bluehost
cron exists if we ever need async jobs.

What does **not** transfer:

| chat.php trait | Why it doesn't fit here |
|---|---|
| `max_tokens: 150`, 30 s cURL timeout | An SVG is 2–40 KB of markup; needs `max_tokens` ~8–16k and 60–120 s of latency headroom per model. |
| Both models called **sequentially** in one request | Doubles wall-clock; a shared-host PHP request will brush `max_execution_time`. Fix: the **client fires two parallel fetches**, one endpoint call per model (§2.2). |
| `Access-Control-Allow-Origin: *` | Don't replicate. Same-origin only; an open CORS endpoint that burns API budget is an invitation. |
| `$debug_mode = true`, raw `error_log` of full responses | Don't replicate. |
| `session_id = REMOTE_ADDR` stored raw | Use the site's existing salted daily-rotating `visitor-hash.php` instead — no raw PII, matches `page_events` precedent. |
| Output trusted as plain text | SVG output must pass the runtime sanitizer (§2.4) before the client ever sees it. |

### 1.3 What the `/junk-drawer-item` skill does, and what the web version keeps

The skill's generation discipline, mapped to a streamlined server-side
equivalent ("**harness v3-web**" — versioned in the generation record,
because responses generated under different harnesses aren't strictly
comparable, per the skill's own rule):

| Skill step | Web version |
|---|---|
| Prompt frozen verbatim, no sharpening | **Keep.** The visitor's text is the prompt, stored byte-exact. Length cap (~500 chars) is the only constraint. |
| Clean-context isolation (svg-specimen agent, no repo access) | **Free.** A raw API call has no repo, no tools, no skills — isolation is inherent. |
| Harness preamble + standard technical appendix | **Keep, adapted.** The system prompt = a fixed constant embedding the technical appendix (single SVG document, `xmlns` + `viewBox`, edge-to-edge ≤2% margin, transparent background, self-contained, no script/handlers/foreignObject). Byte-identical across all calls; the constant IS harness v3-web. |
| Fence/prose stripping (gradeable disobedience) | **Keep.** Server extracts the `<svg>…</svg>` document; records whether stripping was needed (`disobedience` flag — it's data). |
| Validator hygiene check | **Keep, moved to runtime PHP** (§2.4). Reject on failure; a rejected generation is itself recorded (failure is signal). |
| Ink-bounds check (`check-svg-ink.sh`, headless Chrome) | **Drop.** No browser on Bluehost. Mitigate in-prompt (edge-to-edge instruction already in the appendix) and accept padded viewBoxes; composition is one of the things visitors grade anyway. |
| Independence diff between siblings | **Free.** Two separate API calls to two different models share no context. |
| Tool-use-count contamination check | **N/A** — no tools exist. |
| Owner rating instrument (build-instrument.py → artifact) | **Reimplemented as the in-page survey** (§4.3), rendering grades/axes from the same `data.php` taxonomy payload the page already holds — zero hardcoded rubric strings, same rule as everything else. |
| entry.json + commit = publish | **Replaced by MySQL** (§3). The server cannot commit to git, and PLAN-BACKEND §1 already reserved exactly this: "if a future feature needs visitor interaction… that lives in a separate table and doesn't change this layer." |

### 1.4 Other findings

- **`page-event-tracking.php` allowlist gap**: `junk-drawer` is not in
  `$ALLOWED_PAGES`, so the page-view `track()` call shipped in
  `index.php` has been silently 400-ing. Fix in passing (backend pair).
- **Frontend integration points are clean**: the pile loader keeps the
  full `data.php` payload (`payloadRef`), exposes `JD_svgInst` (id
  namespacing for inlined copies), `JD_byRank`/`JD_gradeOf` (numeric
  rank → taxonomy object), and `JD_sizeLabel`. A user item can be
  namespaced and dropped into `.jd-pile` with the same machinery the
  loader uses. The report-card module (`JD_record`) shows the dialog
  pattern (scrim + card + Esc/scrim-close layering) the submission modal
  should match.
- **Taxonomy discipline carries over**: ratings are filed as numeric
  `rank`s (grades 5.0…1.0, axis values 3.0…1.0), never id/label strings;
  **defunct axes are never surveyed**; every stored rating must carry
  the `taxonomy.version` (currently 9) it was collected under.
- **The stage is a container query context** (`cqmin` sizing) with
  layered chrome (`jd-pull`, vignette, varnish) — the new button lives
  in this stack, bottom-left, styled as drawer hardware (a second brass
  fitting / a paper slip wedged in the corner), `pointer-events: auto`
  unlike its decorative neighbors.

---

> **Superseded in detail (2026-08-09):** §§2–4 below are the planning
> sketch that ARCH consumed. The frozen, binding versions of everything
> here — endpoint shapes, DDL, sanitizer rules, harness text, modal
> states — live in **PLAN-USER-PROMPTS-CONTRACTS.md**, and where the two
> differ the contracts win (e.g. no `temperature` is sent at all, the
> sanitizer's exact allowlist/reason enum, the consent columns). Kept
> unrewritten as the record of how the design was reached.

## 2. Backend design

### 2.1 Placement and files

New endpoints live in `api/` (reusing `database.php`, `visitor-hash.php`
includes, matching site convention):

```
api/jd-generate.php        # POST: one model's SVG for a prompt
api/jd-rate.php            # POST: ratings + comparison for a submission
api/setup-jd-tables.php    # one-time table creation (pattern: setup-page-events-table.php)
```

`art/junk-drawer/data.php` is **not modified** — the curated collection
and the visitor layer stay separate (and CLAUDE.md's "never modify
data.php during a content add" stays true).

### 2.2 The generation flow (client-parallel, two requests)

1. Client POSTs the prompt to `jd-generate.php` — **twice, in parallel**
   (`slot=a`, `slot=b`). The server owns the model routing: it creates a
   `submission` row on the first call, randomizes which model is slot A
   vs slot B (recorded — §3), and returns `{submission_id, slot,
   svg, gen_id}` per call. The client never learns which model is which
   until after rating (§4.4, blind rating).
2. Each request makes **one** provider call (Anthropic or the second
   provider), so per-request wall-clock = one model's latency. cURL
   timeout 90 s; `max_tokens` ~12k; temperature fixed (1.0) and recorded.
3. On provider failure or sanitizer rejection: the generation row is
   still written (status `failed`/`rejected`, raw response kept), and the
   client gets a graceful error for that slot. One surviving slot
   degrades to "rate this one" (no comparison); zero survivors shows a
   painterly apology and costs the visitor nothing.
4. **Fallback if 90 s proves too tight on Bluehost** (QA phase will
   measure): flip to async — `jd-generate.php` inserts a `pending` row
   and returns immediately; a cron worker (precedent: `onobot-cron.php`)
   makes the provider calls; the client polls. Schema (§3) already
   carries `status` so this is a code change, not a migration.

### 2.3 Cost and abuse controls (before any of this goes live)

- **Separate API key** for this feature (owner adds `jd_claude_key` etc.
  to the Bluehost `secrets.php`; code falls back to the existing keys
  until then) with provider-side spend caps.
- **Rate limits, enforced server-side in MySQL** (count rows per
  `visitor_hash` and per IP): e.g. 3 submissions/hour, 10/day per
  visitor; global daily cap (e.g. 100 generations/day) that closes the
  feature with an honest "the drawer is resting" message when spent.
- Prompt length ≤ 500 chars; same-origin check (`Origin`/`Referer`);
  no CORS wildcard; honeypot field in the form.
- Providers' own safety filtering covers prompt content for generation;
  what WE display publicly is a separate question — deferred by the
  session-local display decision (§4.5).

### 2.4 The runtime SVG sanitizer (the load-bearing new piece)

PHP, on every generation before storage-as-displayable and before any
client sees it. **Reject** (never silently repair): fails XML parse
(DOMDocument, entity loading disabled — XXE), root not `svg`, any
`<script>`/`<foreignObject>`/`<use>` of external refs, any `on*`
attribute, any `javascript:` or external `http(s)`/protocol-relative
URL in any attribute or `<style>` block, embedded `data:` raster URIs,
document > 300 KB, missing `viewBox`. Allowlist-of-elements approach
(SVG shape/paint/gradient/filter/text vocabulary) rather than
blocklist. The sanitizer is a pure function with a test file — the
backend critic's primary review target. The frontend *additionally*
inlines user SVGs only after `JD_svgInst` id-namespacing, same as
curated items.

---

## 3. Data model — collecting eval-grade preference data

Design principle: **capture everything at generation time, resolve
nothing early**. Every layer that could bias or contextualize a rating
is a column. Tables (MySQL, InnoDB, utf8mb4):

```
jd_submissions
  id              CHAR(26) PK          -- server-generated
  created         DATETIME
  prompt          TEXT                 -- verbatim, byte-exact
  visitor_hash    CHAR(64)             -- salted daily hash (no PII)
  client          VARCHAR(16)          -- 'web' now; 'ios' later (§5)
  status          ENUM(pending, generated, rated, failed)

jd_generations
  id              CHAR(26) PK
  submission_id   FK
  slot            ENUM(a, b)           -- display slot, randomized server-side
  model_id        VARCHAR(64)          -- taxonomy models registry id (join key)
  model_version   VARCHAR(64)          -- exact API model string
  provider        VARCHAR(32)
  harness         VARCHAR(16)          -- 'v3-web' + rev
  params          JSON                 -- temperature, max_tokens
  raw_response    MEDIUMTEXT           -- pre-extraction, always kept
  svg             MEDIUMTEXT NULL      -- post-extraction, post-sanitize
  status          ENUM(ok, failed, rejected)
  reject_reason   VARCHAR(255) NULL
  disobedience    TINYINT              -- fences/prose stripped?
  latency_ms      INT
  usage_tokens    JSON                 -- prompt/completion counts from provider

jd_ratings                             -- one row per (generation × axis) + one grade row
  id, generation_id FK
  kind            ENUM(grade, axis)
  axis_id         VARCHAR(64) NULL     -- taxonomy axis id (kind=axis)
  value           DECIMAL(3,1)         -- the numeric rank, same rule as entries
  note            VARCHAR(500) NULL
  taxonomy_version INT                 -- version 9 today; REQUIRED
  rated_at        DATETIME

jd_comparisons                         -- the pairwise preference — the RLHF-shaped prize
  id, submission_id FK (unique)
  winner_gen_id   FK NULL              -- NULL = explicit tie
  rated_at        DATETIME
```

Why this shape earns "training data":

- **Pairwise preference with position recorded** — `slot` randomization
  + the comparison row is exactly the (prompt, response A, response B,
  preference) tuple preference-tuning and eval work consume; storing
  slot lets position bias be measured instead of silently absorbed.
- **Blind at rating time** (§4.4) — model identity is not shown until
  after ratings + comparison are submitted, so ratings measure the
  artifact, not the brand.
- **Multi-axis + overall grade per response** — richer than bare
  preference: per-axis scores on a stable published rubric, versioned
  by `taxonomy_version` so a future taxonomy change doesn't corrupt
  old rows' meaning.
- **Failures kept** — refusals, malformed output, sanitizer rejections
  are all rows with raw output attached; failure rates per model are
  first-class results.
- **Rater identity as visitor_hash** — enables per-rater agreement /
  dedup analysis without storing PII. (Known limitation: the hash
  rotates daily by design, so cross-day rater identity doesn't exist.
  Fine for v1; an app account would fix it later.)
- **Export**: `scripts/export-jd-evals.py` (repo-only) dumps joined
  JSONL — one object per submission with generations, ratings,
  comparison — the format eval harnesses actually ingest. Owner-run
  from a machine with DB access; no public endpoint.

The curated git collection is untouched; the two datasets share only
the taxonomy (axes/grades by rank) and the model registry ids, which is
precisely what makes them comparable later.

---

## 4. Frontend design

### 4.1 The button

Bottom-left of the drawer stage, inside the trompe-l'oeil: a small
period-correct affordance (paper slip / brass plate — final art at the
frontend pair's discretion, consistent with mockup-5 hardware). Must not
collide with pile drag: it sits on the stage chrome layer above the
well, is comfortably tappable (≥44 px), and respects PLAN-MOBILE's
bottom-edge rules (safe-area padding; don't graze the iOS bar-reveal
zone).

### 4.2 The flow (states, all in one modal matching `JD_record` conventions)

1. **Prompt entry** — "describe an object for the drawer"; char counter;
   submit disabled while empty; honest rate-limit messaging.
2. **Generating** — the two parallel fetches run; painterly progress
   ("two machines are drawing…"), per-slot completion. 60–120 s is long:
   the modal must survive backgrounding, and show per-slot arrival.
3. **Reveal** — both SVGs side by side (mobile: stacked/tabbed), labeled
   only "A" and "B".
4. **Rate** — the survey instrument (§4.3), one panel per response.
5. **Compare** — "which belongs in the drawer?" A / B / tie.
6. **Unveil + place** — models revealed ("A was Claude Sonnet 5; B was
   GPT-5"), winner drops into the pile with a little scatter animation.

### 4.3 The survey instrument

A streamlined re-derivation of the skill's rating instrument, rendered
**from the taxonomy in the already-fetched `data.php` payload**: overall
grade (5 pills with labels + descriptions), then each **non-defunct**
axis (3 value pills + skip; optional short note). Exported values are
numeric ranks. No size picker, no pin (those are curatorial, not
visitor, concerns). Skippable-but-nudged: the comparison (step 5) is
required, axes are optional — a visitor who rates nothing but picks a
winner still produced the core preference datum.

### 4.4 Blind rating (decision, recommended)

Model identities are withheld until ratings and comparison are
submitted. This is what makes the data credible and it's also the better
theater — the unveil is the payoff moment.

### 4.5 Where the winner lives (decision, recommended: session-local)

The winner is inlined into **this visitor's** pile (sessionStorage,
alongside the scatter state) and marked visually as a visitor
contribution (e.g. a paper tag). It does **not** enter the shared
drawer: public display of user-prompted content would demand a
moderation pipeline (and complicates App Store review — UGC rules,
§5) that v1 shouldn't carry. The upgrade path is curation, not
automation: everything is in MySQL, so the owner can review standout
submissions and re-run the best prompts through the full
`/junk-drawer-item` skill to accession them into the permanent
collection properly — visitor prompts become a scouting pipeline.

---

## 5. App Store posture (decisions binding now; deep-dive delegated to Agent APP, §6)

Decisions that cost nothing today and keep the iOS door open:

1. **Everything interactive goes through JSON APIs** — no new
   PHP-rendered HTML in the core loop. (Already true of the pile; the
   new endpoints follow.) A future native or hybrid app consumes
   `data.php` + `jd-*.php` unchanged.
2. **API base URL becomes a single constant** in `junk-drawer.js`
   (relative paths today, one `JD_API` var) so a packaged app can point
   at `https://municipalsky.com`.
3. **No secrets client-side, ever** — already the pattern (server-proxy
   keys); this is also the App Store-compliant architecture.
4. **`client` column from day one** (§3) distinguishes web from app
   traffic later without migration.
5. **Keep the frontend vanilla and self-contained** — no framework, no
   build step means the whole page can be packaged in a Capacitor /
   WKWebView shell with minimal surgery, which is the realistic v1 app
   route; a SwiftUI rewrite would be a separate product decision.
6. Known review-guideline pressure the analysis agent must scope:
   4.2 minimum functionality (web-wrapper apps get rejected — the app
   needs *something* native: haptics on dig, share sheet, widget?),
   1.2 UGC (if user content ever becomes publicly visible: report/block/
   moderate machinery), 5.1 privacy labels (visitor hash, prompt
   storage), plus offline behavior for a network-dependent toy.

---

## 6. The agent team — roster, models, effort, order

*(Executed as planned, 2026-08-09 — all nine stages ran; both critic
rounds converged with zero blocking findings; accepted advisories are
recorded in PLAN-USER-PROMPTS-CONTRACTS.md's Amendments section.)*

Ground rules for every pair: the **coder** implements against this
plan's contracts; the **critic** reviews the actual diff (not the
coder's summary), files findings as blocking/non-blocking, and the
coder iterates until the critic passes it or three rounds elapse
(remaining disputes escalate to the owner). Coders work on this
feature branch; backend and frontend touch disjoint files (`api/*` vs
`art/junk-drawer/*`) except `index.php`, which is **frontend-owned**
for this feature. Nothing merges to `main` (= production) until the
owner reviews.

### The roster

| # | Agent | Role | Model | Effort | Key deliverables |
|---|---|---|---|---|---|
| 1 | **APP** — App Store analyst | Analysis only | Opus | high | `PLAN-APPSTORE.md`: packaging route recommendation (Capacitor/WKWebView vs native), guideline-risk register (4.2, 1.2, 5.1), the "decisions that bind now" list — delivered BEFORE contracts freeze. |
| 2 | **ARCH** — systems architect | Contracts | **Fable** | high | Freezes the binding contracts from this plan + APP's constraints: exact endpoint request/response shapes, final DDL, sanitizer spec (allowlist), harness v3-web system-prompt text, modal state machine. Small documents, no code. |
| 3 | **BE-C** — backend coder | Code | Opus | high | `jd-generate.php`, `jd-rate.php`, `setup-jd-tables.php`, sanitizer + its test file, rate limiting, tracking-allowlist fix. |
| 4 | **BE-K** — backend critic | Review | Opus | **high** | Security-first review: sanitizer bypasses, XXE, SQL injection, cost-control gaps, secrets handling, data-shape fidelity to §3. The sanitizer gets an adversarial pass (hand-crafted hostile SVGs). |
| 5 | **FE-C** — frontend coder | Code | Opus | high | Button, modal + state machine, survey instrument, blind reveal, winner-into-pile, sessionStorage persistence; `index.php` markup; CSS in the painterly system. |
| 6 | **FE-K** — frontend critic | Review | Opus | medium | Mobile-first UX review (PLAN-MOBILE compliance, gesture non-interference, safe areas), a11y (focus trap, labels), taxonomy-driven rendering (zero hardcoded rubric strings), style coherence. |
| 7 | **DATA** — eval-data auditor | Review | Opus | high | Audits the *implemented* schema + write paths against §3's promises: blindness actually blind, slot randomization real and logged, taxonomy_version stamped, failures recorded; writes `scripts/export-jd-evals.py` and validates a sample JSONL end-to-end. |
| 8 | **QA** — integration | Test + fix | Opus | medium | `php -S localhost:8000 router.php` + Playwright (Chromium is pre-installed in web sessions): full loop with a mocked provider layer, latency simulation (does the 90 s budget hold?), failure-path UX, mobile viewports, validator still green, no regression to pile/record interactions. |
| 9 | **FINAL** — systems review | Review | **Fable** | medium | Whole-diff coherence pass: contracts honored, plans/README/CLAUDE.md updated, deployment runbook (§7) complete and correct, nothing violates the "no dramatic refactor" constraint. |

Why these tiers: Fable where the job is cross-cutting judgment over the
whole system (contract-setting, final coherence); Opus-high where the
work is deep but scoped (generation path, security review, the two
coders, data audit); Opus-medium where the checklist is well-defined
(frontend critique, QA execution). Nothing here needs less than Opus —
the codebase's conventions are dense and the critics only earn their
seat if they actually catch things.

### Launch order and why

```
Stage 0:  APP  ──┐            (parallel: APP is read-only analysis,
          [this plan] ─┴─►  ARCH   and ARCH consumes its output)
Stage 1:  ARCH freezes contracts
Stage 2:  BE-C ↔ BE-K   ∥   FE-C ↔ FE-K     (parallel pairs; FE codes
                                             against ARCH's contracts +
                                             a stub/mated mock of the API)
Stage 3:  DATA          (needs BE's real write paths)
Stage 4:  QA            (needs both pairs converged; loops fixes back
                         through the responsible coder)
Stage 5:  FINAL         (whole branch, docs, runbook)
```

The information flow the owner asked for: APP's constraints land before
ARCH freezes anything (so app-store thinking shapes the contracts, not
retrofits them); the contracts let the two pairs run genuinely in
parallel; DATA runs after backend converges because auditing promises
against real write paths is the only audit that counts; QA runs against
the integrated whole; FINAL reviews everything including the documents.

### Critic protocol (both pairs)

- Critic receives: this plan, ARCH's contracts, and the full diff.
- Findings format: file:line, severity (blocking / advisory), concrete
  failure scenario — no style-only nitpicks unless they violate a
  stated convention.
- BE-K specifically must attempt sanitizer bypasses (nested CDATA,
  entity tricks, `xlink:href` obfuscation, style-block `url()`s,
  case/namespace games) and document each attempt's outcome.

---

## 7. Owner runbook — the parts agents cannot do

1. Add the dedicated API keys to the Bluehost `private_config/secrets.php`
   (`jd_claude_key`, `jd_openai_key` or second provider of choice) and
   set provider-side spend caps. Until then code falls back to the
   existing keys.
2. Add `jd_setup_key` (any long random string) to the same
   `secrets.php`, then run
   `https://municipalsky.com/api/setup-jd-tables.php?key=<that value>`
   once — the script refuses production requests without a matching
   key. Delete the script after it reports all four tables ok (its
   header says so too).
3. Decide the §8 open questions.
4. Merge to `main` when satisfied — push is deploy.
5. After launch: watch the provider spend dashboard for the first days;
   the global daily cap (§2.3) is the circuit breaker.
6. **Clearing a wedged day.** A generation that dies mid-flight (PHP
   fatal, OOM, the host killing a long request) leaves its
   `jd_generations` row at `status='pending'` forever — nothing reaps it
   in v1, by design. Two visible symptoms: the row keeps counting against
   the day's global budget until UTC midnight rolls the window, and its
   slot answers `409 slot_in_progress` to every retry, so that one
   visitor's turn can never finish. If the drawer is "resting" with no
   spend to show for it, settle the stragglers by hand — anything older
   than the 90 s provider budget is dead, so a generous cutoff is safe:

   ```sql
   UPDATE jd_generations SET status = 'failed'
    WHERE status = 'pending' AND created < '2026-08-09 00:00:00';  -- UTC cutoff, e.g. now − 1h
   ```

   (Settle to `failed`, never delete: the row is the audit trail, and
   C1.2 step 8 then re-returns the stored failure instead of the 409.)

## 8. Owner decisions — DECIDED (2026-08-09, pre-launch)

These are settled constraints now, not open questions; agents build to
them without re-asking.

1. **The model pair: Claude Sonnet 5 vs GPT-5** (cross-vendor). Both
   ids exist in the taxonomy model registry. The pairing lives in
   server-side config (`jd-generate.php`) so it can change without a
   frontend edit; the schema (§3) is pair-agnostic regardless.
2. **Winner display: session-local only** (§4.5 as recommended).
   Visitor items never enter the shared drawer in v1; no moderation
   pipeline, no owner admin UI this round — curation happens later via
   the MySQL records.
3. **Rate limits: the §2.3 defaults** — 3 submissions/hour and 10/day
   per visitor hash; global circuit breaker at 100 generations/day
   ("the drawer is resting"). Constants in one place, tunable
   post-launch.
4. **Button name: deferred to name-tasting.** FE-C ships a placeholder
   label behind one constant and produces 2–3 in-situ candidates
   (e.g. TAKE A TURN · COMMISSION AN OBJECT · FEED THE DRAWER) for the
   owner to taste on-device, PLAN-RECORD style. Not a launch blocker.
5. Whether visitor items ever earn a path to the permanent collection
   (the §4.5 curation loop) stays open — no code depends on it.
