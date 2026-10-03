# The Junk Drawer — primer for a new agent

Read this first. It says what the project is for, why it was reset on
2026-10-01, what exists now, what remains, and the rules every agent works
under. It is committed (so it travels into every worktree) and never
deployed (`**/*.md` is excluded). Owner: Tyson. Repo:
`~/Sites/municipal-sky-site`, public on GitHub — nothing private goes in
files.

## 1. What this is, and why it matters

The Junk Drawer (`/art/junk-drawer/`) is a trompe-l'oeil wooden drawer full
of SVG drawings made by large language models. A visitor digs through the
pile, opens a drawing's report card (the prompt, the model, the grade, the
per-axis ratings, the other models' attempts at the same prompt), and can
take a turn: type a prompt, get four blind drawings back, rate them, rank
them, compare them head to head, and watch the names and costs unveil.

It is a **portfolio piece for data-operations work**. The point is not the
drawings; it is everything around them, done the way a professional would
do it: a defined annotation taxonomy with versioned definitions, a blind
collection instrument that owner and visitors share, a schema that records
provenance and never loses a judgment, a versioned dataset with a clean
archive, honest cost accounting, exports an analyst can use, and a public
about page that explains the method. Every design choice should be
explainable to someone who runs evaluation pipelines for a living. When in
doubt, choose the option that would look right in a data-ops interview:
explicit over clever, recorded over inferred, versioned over overwritten.

The owner is the primary rater and, for now, effectively the only visitor.

## 2. The reset, in plain words

Dataset **v1** (2026-07-26 → 2026-10-01) grew from a file-first archive
(commit an SVG from a phone) into a database-first evaluation (server-side
generation, blind rating, reruns) one feature at a time, keeping both
mechanisms alive. By the time the owner started analysing it, the data had
two sources of truth for ratings, provenance parsed out of prose notes,
reruns linked by matching prompt text, four different "hide" switches, and
a rank order with no margin: it could say which drawing was best, never by
how much. The owner wanted head-to-head comparative scores and a fresh,
consistent rating pass under the settled taxonomy.

So this is a **versioned dataset cutover**: v1 is frozen and archived,
untouched; v2 starts clean in its own tables with its own instrument; the
two are never pooled. The full reasoning and every owner decision are in
`PLAN-V2.md` (gitignored — read it from the main checkout, not a worktree).

## 3. Where everything lives

| thing | where |
|---|---|
| the drawer (v2) | `art/junk-drawer/` — `index.php`, `data.php`, seven JS modules (`jd-core/filmstrip/furniture/record/darkroom/turn/bench.js`), `junk-drawer.css` |
| the about page | `art/junk-drawer/about/` |
| the legacy exhibit (v1, frozen) | `art/junk-drawer/legacy/` — a snapshot copy; **never edit** |
| v2 endpoints | `api/jd2-generate/intake/rate/curate/gen-svg/queue/ledger/analytics.php`, shared `api/jd2-config.php`; the intake clerk's prompt, schema and call in `api/jd2-intake-prompt.php` (`--print`) |
| v2 schema runner + doc | `api/setup-jd2-tables.php`, `db/junk-drawer-v2-schema.md` |
| v1 endpoints (frozen, reads only) | `api/jd-*.php`; `JD_V1_FROZEN = true` in `api/jd-config.php` |
| v1 archive | `~/Media/junk-drawer-v1/2026-10-01/` (dump, JSONL, CSVs, items); runbook `db/junk-drawer-v1-archive.md`; git tag `junk-drawer-v1-final` |
| the rubric | `art/junk-drawer/taxonomy.json` (v37) — grades, axes, the house rule, size tiers, model registry + pool, comparison and gap scales, the intake facets, `intakeVersion` and the intake model |
| the curator's ledger | `art/junk-drawer/ledger.html` |
| the owner's bench | `index.php?bench` (`?bench&prompt=<id>` for one prompt; `?admin` for the card editor) |
| owner scripts | `scripts/jd2-batch-run.php` (CSV batch generation), `scripts/jd2-export.py` (JSONL + CSVs) |
| tests | `scripts/test-jd2-derive.php`, `test-jd2-flow.php`, `test-jd2-reads.php`, `test-jd2-card.js`, `test-jd2-bench.js` |
| operating manual | `art/junk-drawer/CLAUDE.md` (procedures, the Never list) |
| roadmap | `art/junk-drawer/ROADMAP.md` |
| plan docs (gitignored, main checkout only) | `PLAN-V2.md` (the reset, decisions, build log), `PLAN-PEDESTAL-HANDOFF.md` (the pedestal card's contract), older `PLAN-*.md` (v1 history) |
| digests | `api/onobot-cron.php` (emailed), `~/.config/onobot/*` (local) — all on v2 |

## 4. The v2 data model on one page

```
jd2_prompts      the subject: text, title, origin (owner|visitor), visibility (draft|live|hidden),
                 size, category, lineage to a v1 item, the visitor's consent/device fields
jd2_runs         one execution of a prompt against the pool: kind (initial|rerun), profile (web|bench),
                 harness, pool_version, the slot→model deal. A rerun is a NEW run.
jd2_generations  one drawing per model per run: raw response, sanitized svg, status, latency,
                 usage, cost_usd snapshotted at write time, hidden flag
jd2_sessions     one SITTING of one rater over one run: role (owner|visitor), taxonomy and
                 instrument versions, required_cells (the cells its rubric asked for),
                 blind flag, seat order, note. Append-only.
jd2_judgments    the sitting's grade and per-axis values per drawing (+ notes)
jd2_rankings     the sitting's strict 1..n order per drawing, with gap_after (0..3)
jd2_pairs        the sitting's head-to-head scores, −3..+3, source direct|derived
```

Rules every reader applies (helpers in `api/jd2-config.php`; do not
re-derive them):

- **Current session** = the latest filed session per (run, rater role).
- **Display** = the owner's current complete session, else the visitor's.
- **Complete** = a grade and every axis the sitting's own rubric required
  (`required_cells`, stamped at filing; the live axes when a row has none)
  for every shown drawing, a strict ranking when there is more than one,
  and a score for every pair. So an axis added mid-campaign asks the next
  sitting for it and leaves the filed ones complete.
- **One session, one method**: pairs sent directly are stored as `direct`
  and nothing is derived; a ranking with gaps and no pairs derives all
  pairs (`spaced-rank-v1`: sum the gaps between two places, clamp to 3).
- **Owner and visitor are separate populations.** Never average them.
  **v1 and v2 are never pooled.**
- A visitor may rate only their own turn (the browser's `client_ref` is the
  proof); the owner's bench key is the other identity. Model names are
  released only in the reveal after filing.

## 5. The instrument

Per drawing: an overall grade (Prime / Choice / Select / Standard /
Utility, filed as 5..1) and five axes (taxonomy v36, 2026-10-03) —
Understanding Assignment (4-point), Structural Coherence (4-point,
`structural-coherence-2`; the 3-point `structural-coherence` is defunct),
Layering (4-point, `layering-2`, mid-campaign; the 3-point `layering` is
defunct, and its `successor` map reads its answers onto the new scale at
read time — Small as Minor, Big as Major), Paintwork (4-point), Je ne sais
quoi (3-point). Each issue axis is named by the edit that fixes it: redraw
(Understanding Assignment, including any added thing), move on x/y
(Structural Coherence, including framing), restack or erase (Layering,
including an unrequested setting), repaint in place (Paintwork, including
every cast shadow). The four issue axes read No / Minor / Moderate /
Major problems. Since 0.18.0 they are asked ONE QUESTION A CARD: six cards
per drawing (the five axes, then the grade), each a list of radio rows — a
tap selects, NEXT moves on (0.18.1); the preview prints the house rule
(`houseRule`: what every model was told) once per sitting. Then the
podium: drag or tap the drawings into 1st..4th. Then the **pedestal card**
is live (0.12.0): one card asks each adjacent pair "how much better?"
(negligibly / slightly / better / much better, a brass shim = gap 0) and
the server derives every 7-point pair score from the gaps, the six
side-by-side cards surviving only as the bench's `?pairs=1` audit. Then
size (on the bench, the catalogue entry), and for the owner a note. Owner
and visitors use the same card; the bench just seats the backlog in it.
Since 0.11.0 the **intake clerk** (one Sonnet call, `api/jd2-intake.php`)
files each prompt's heading, size tier and faceted classification
(`taxonomy.json` `facets`) the moment it is filed: visitors are no longer
asked for a size; on the bench the closing card is the catalogue entry
(0.13.0): the clerk's heading, size tier and headings, every one correctable
there, and the owner's size (`size_by` `owner`) is never overwritten.

Labels, descriptions, scales, the model pool and the intake model are all
**data in `taxonomy.json`**; ids are permanent, labels may be reworded, a
retired axis gets `"defunct": true` (and, when the owner says how its
answers read on the new scale, a `successor` map — read time only; filed
rows never change). The four gap labels are the owner's
pedestal wording (taxonomy v32).

## 6. What is done (all live since 2026-10-02)

- v1 archived (tag, dump, export, derived standing and pairwise CSVs) and
  frozen; legacy exhibit at `/legacy/`; the `/art/` card links to it for now.
- v2 schema, endpoints, manifest, analytics (incl. a pairwise win matrix,
  Bradley-Terry strengths, margin histograms), export, CSV batch runner.
- The turn card on v2 with the side-by-side pairs step; the bench on the
  v2 queue with NEW PROMPT, rerun, scrap, hidden items, a note per sitting;
  the ledger and the card editor on v2 (append-only sessions).
- The about page on v2 analytics with honest empty states and method-only
  prose; the operating manual rewritten; v1 file-path scripts removed.
- A high-effort code review applied (visitor sittings need the turn's own
  token; the editor never relabels a visitor's answers as the owner's;
  cached drawings; set-based reads). Five test suites, all green.
- All three digests read v2.

The drawer is **empty on purpose**. It fills through the campaign below.

## 7. What remains, in the owner's order

1. **Model-pool refresh — DONE 2026-10-02** (`pool-2026-10-02b`: Opus 5.5,
   GPT-6.1 Sol, Kimi K3, Gemini 3.1 Pro; `CLAUDE.md`, "The pool is data").
   The original note: newest models from
   each vendor; verify wire ids and prices against the providers' current
   lists; edit `taxonomy.json` `models[]` (`pool`, `provider`, `api_model`)
   and `api/jd-prices.json`; bump `poolVersion`; bump the consent version
   if the provider list changes (privacy.php §4 must match). The owner's
   effort setting is decided (2026-10-02): owner runs use `bench-medium`
   (each model at its vendor's medium rung; `bench-low` and `bench-max`
   for an optional comparison); visitors use `web` (thinking turned down
   for wait time) — the owner wants that trade-off revisited later.
2. **The prompt set**: the owner curates ~100 prompts into a CSV
   (`prompt`, optional `title`, `category`, `v1_item_id`), probably reusing
   many v1 prompts. Consider categories.
3. **Batch generation** with `scripts/jd2-batch-run.php` (`--profile`,
   default `bench-medium`, one model per request, four per prompt, resumable, spend-guarded).
4. **The rating campaign** on `?bench`: grades, axes, podium, pairs, size,
   note, per prompt. Definitions get sharpened as the owner works; they
   must be solid before the piece is shared. Includes the benefit-of-the-
   doubt rule for ambiguous prompts (any reasonable reading counts — in
   Understanding Assignment's description since v35).
5. **The pedestal card** lands from the other session and is integrated
   as the podium's output (strict ranks + gaps); the side-by-side card
   stays as the alternate and the audit.
6. **Then the roadmap** (`ROADMAP.md`): the scales are settled (v35);
   naming decisions ("ratings" vs "grades"?), the one-question-at-a-time
   card (done 0.18.0), pedestal summary on the unveil (blocked on #5), darkroom and
   instructions copy, blurry instructions fix, typography, model-assigned
   size at title time, over-18 consent, visitor-chosen drawing count and
   models (default two), the moderation/approval queue, flipping the
   `/art/` card to the new drawer, re-capturing the about page's poster.

Decisions belong to the owner: wording, scales, which prompts, which
models, when to flip public links. Agents propose; the owner picks.

## 8. Rules of the road

- **Work in a worktree**, never in the main checkout:
  `scripts/worktree.sh new <branch>`; retire it with `… done <branch>`
  after merge. Copy `config/secrets.php` in by hand if an endpoint needs
  the database; gitignored `PLAN-*.md` do not travel — read them from
  `~/Sites/municipal-sky-site/art/junk-drawer/`.
- Pushing `main` deploys the site. Merging is fine; **the push is the
  owner's.** The deploy runs both schema runners and the (frozen) backfill
  after upload; a red run is read in the Actions log.
- **Never edit `legacy/`**, any `api/jd-*.php` v1 endpoint, or the `jd_*`
  tables. Never set `JD_V1_FROZEN` back. Never write ratings to files.
- **Never hard-code** a model, axis, label or scale in PHP/JS/SQL; it comes
  from `taxonomy.json`. Never rename an id.
- **Tests run one at a time** (they share `local-dev/jd-dev.sqlite`).
  Local server: `JD_DEV_MOCK=1 php -S 127.0.0.1:<port> router.php` with
  the mock provider; Playwright via
  `NODE_PATH=~/Desktop/kimi-music-generator/node_modules`.
- **Keys**: the bench key is `JD_BENCH_KEY` in the environment for scripts,
  `X-Bench-Key` on requests, remembered per device by the page. Never in
  files, never in chat, never printed. Production database reads from the
  owner's machine use `config/secrets.php` with host `municipalsky.com`.
- **Version line**: every user-visible change appends a line to
  `art/junk-drawer/VERSION` (`0.10.N — what the owner would notice`).
- Commit messages start `junk-drawer:`; stage files by name; never
  `git add -A`, never bare `git stash`. End with the session's
  Co-Authored-By line.
- No rubber stamps on the turn card (a deliberate 2026-08 reversal). No
  pixel-art or arcade styling anywhere. Visual references for the
  container are Haberle, Peto, Harnett; each drawing keeps its own style.
- Report faithfully: say what was verified, what was not, and what was
  skipped.

## 9. Glossary

**prompt** the subject · **run** one bracket of drawings for a prompt ·
**generation / drawing** one model's answer · **slot** the blind letter a
drawing was dealt · **session / sitting** one rater's atomic batch of
judgments over a run · **display session** the one the drawer shows ·
**pairs** head-to-head scores · **gaps** the margins between podium places ·
**bench** the owner's backlog mode of the turn card · **ledger** the
curator's overview table · **legacy** the frozen v1 drawer · **harness /
profile / pool version** the stamps that make runs comparable or not ·
**taxonomy** the rubric file · **defunct** a retired axis kept for history.
