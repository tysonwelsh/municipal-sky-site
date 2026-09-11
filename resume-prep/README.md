# Resume prep — master resume project

Working folder for a **modular master resume**: a repository of tight,
tagged bullet points that get selected and plugged into a resume per
application. Later phases add modular cover-letter blocks and, eventually,
agent-assisted job search.

Owner: Tyson Welsh. Current role: Data Operations, Surge AI (manages
large-scale data collection and labeling projects on the DataAnnotation
platform; startup, many hats).

## Folder layout

```
resume-prep/
  README.md              ← this file: roadmap + build plan
  PLAN.md                ← the chunked build process for the Surge AI section
  FRAMING.md             ← how to describe AI-assisted (vibe-coded) tooling honestly
  inputs/                ← DROP SOURCE MATERIAL HERE (not yet present in the repo)
    Raw Material for Master Resume.txt   (stream-of-consciousness notes, current job)
    bullets.md                           (Claude-written bullets from the Hex/SQL code)
    resumes/                             (past resumes + cover letters, one folder per job)
  target-jobs/           ← real listings the resume is anchored to (agent output)
    job-listings.md        one structured section per listing
    listings/              verbatim posting text, one file each
    synthesis.md           recurring keywords, salary bands, themes to cover
  master-resume/         ← the deliverable
    00-inventory.md        every distinct claim from the inputs, numbered (Pass A)
    01-surge-ai.md         current-role bullets, grouped by theme, tagged (Pass C)
    02-prior-roles.md      bullets for pre-Surge positions (Phase 4)
    03-skills.md           skills/tools section, with honesty tiers
    04-coverage.md         keyword coverage matrix vs target-jobs (Pass D)
```

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Source material lands in `inputs/` | **blocked — files not in repo** |
| 1 | Job anchors: 6–8 real listings + synthesis in `target-jobs/` | agent running |
| 2 | Extract prior-role bullets from `inputs/resumes/` (separate agent) | blocked on Phase 0 |
| 3 | Surge AI master bullets, built in passes (see `PLAN.md`) | blocked on Phase 0 |
| 4 | Prior-role section + overarching career narrative | after 2 and 3 |
| 5 | Skills section with honesty tiers (see `FRAMING.md`) | after 3 |
| 6 | Modular cover-letter blocks (mine cover letters in `inputs/resumes/`) | later |
| 7 | Agent-assisted search: listing intake → bullet selection → draft | later |

## Bullet schema

Every bullet in `master-resume/*.md` carries this metadata so selection can
be done by tag, not by rereading:

```
- [S-014] Led ... (the bullet text, one line, past tense, starts with a verb)
  theme: quality-qa | program-mgmt | workforce | tooling-analytics | client-delivery | process-design | hiring-training | cross-functional
  register: generic | targeted:<company-short> | technical
  keywords: data quality, QA sampling, inter-annotator agreement
  source: raw §3, bullets.md L42        ← where the claim came from
  numbers: VERIFY                        ← any metric the owner must confirm before use
  fits: scale-ai, labelbox               ← target-jobs this bullet was written for
```

IDs: `S-` Surge AI, `P-<job>-` prior roles. Never renumber; retire with `~~struck~~`.

Three registers per theme, because the same experience needs different
phrasing depending on the posting:
- **generic** — works for any data-ops / program-management posting.
- **targeted** — mirrors a specific listing's language (from `target-jobs/`).
- **technical** — foregrounds the SQL / Hex / dashboard work, phrased per `FRAMING.md`.
