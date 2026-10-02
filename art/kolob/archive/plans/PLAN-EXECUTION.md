> **Archived 2026-10-01.** The build's plan; what it proposed is built, declined or listed in `OPEN-WORK.md`, and the rulings it recorded are in `OWNER-RULINGS.md`. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# KOLOB 2 — HOW WE BUILD IT

*The execution plan for [`archive/plans/PLAN-COMPOSITION.md`](archive/plans/PLAN-COMPOSITION.md) and
[`archive/plans/PLAN-ENGRAVING.md`](archive/plans/PLAN-ENGRAVING.md). Draft 1, 2026-09-26. Both plans
were approved by the owner that day.*

## 0. Principles (lessons from the ZANKYŌ crews)

- **One crew, one worktree, one branch, one port.** Crews never share a
  checkout. The main tree is shared with other sessions: stage named paths
  only, never `git add -A`, never amend or rebase shared `main`.
- **One integrator.** A single coordinating session owns:
  - the integration branch `kolob-2`;
  - the shared files (`index.php` load order, `kolob-core.js`, `SCORE.md`);
  - the real VERSION numbers.

  Crews bump a branch-local version (`v0.30-hymn.3`); the integrator
  renumbers at merge (`v0.3x`, then `v1.0.0` when Phases 0–3 land, if the
  owner likes).
- **Contracts before crews.** Parallel work is only safe when crews code
  against a written interface. So the very first artifact is `SCORE.md`, the
  Score and event contract (§2).
- **Short checks, capped critic rounds.** Per the owner's standing ruling:
  - no hour-long batteries or identity gates;
  - a sanity harness run and a short listen;
  - **at most 2 critic rounds per milestone**, then ship and iterate.
- **Every agent runs at extra-high effort (owner, 2026-09-26).** Scripts set
  `effort: 'xhigh'` on every `agent()` call explicitly rather than relying
  on the session setting. Wave 1 ran at medium until the owner raised it.
- **Nothing publishes without the owner asking.** Merges to `main` happen
  after the owner has listened to the integration branch.
- **Approval before creative direction changes.** Critics may *propose*
  enrichments, but new creative directions go to the owner as a short brief
  before anyone builds them.

---

## 1. The dependency map: what can run at once

```
            ┌──────────── START NOW (no dependency on Phase 0) ─────────────┐
            │ E0 engraving mockups (running)  → owner picks A/B/C           │
            │ T  Earth tunes transcription (separate Opus agent)            │
            │ S  sound labs: new voices as standalone synthesis             │
            │ Q  the Question generator as a pure module + lab              │
            └───────────────────────────────────────────────────────────────┘
 W0  ─ SCORE.md contract (integrator) ─┐
 W1  ─ 0a module split (1 agent, serial — touches everything) ─┐
 W2  ─ 0b rand streams + clock + re-base │ 0d bug fixes │ 0e harness+labs ─┐
                                                                            │
 W3  (fan out, worktrees)                                                   ▼
     ├─ HYMN crew:    composer + melody + harmony dialects (Phase 2)
     ├─ CAST crew:    desks, cast, practices (Phase 3)   ← sings Earth tunes until HYMN lands
     ├─ GUEST crew:   guests, fanned out one agent per guest (Phase 4)
     ├─ FORM crew:    calendar, reckoning, arc of light, seatings (Phase 5)
     └─ ENGRAVE crew: foundation now → Score-driven once W2 lands
 W4  ─ VISIONS crew (Phase 6), after HYMN + FORM
 W5  ─ WORDS crew (Phase 7): vowel-lab → Deseret singing
```

**Why the module split must be serial and first.** Every later crew edits
code that today lives in one 3,909-line file. Split it once, mechanically and
without changing behaviour, then fan out, so that each crew mostly owns its
own files:

| crew | owns (writes) | reads only |
|---|---|---|
| integrator | `kolob-core.js`, `index.php`, `SCORE.md`, `VERSION`, `kolob-score.js` | everything |
| HYMN | `kolob-composer.js`, `kolob-melody.js`, `kolob-harmony.js`, `kolob-pitch.js`, `hymn-lab.*` | tunes, score |
| CAST | `kolob-cast.js`, `kolob-voices-choir.js`, `kolob-voices-organ.js`, `cast-lab.*` | score, harmony |
| GUEST | `kolob-guests.js`, `kolob-guest-*.js` (one per guest), `kolob-voices-band.js` etc., `guest-lab.*` | score, composer, cast |
| FORM | `kolob-meeting.js` (planner, calendar, reckoning, arc), `kolob-visions.js` later | everything |
| ENGRAVE | `kolob-viz.js`, `engraving-lab.*`, `mockups/` | score, events |
| T (tunes) | `kolob-tunes.js`, `tune-lab.*` | score contract |
| UI changes | requested from the integrator | — |

Where a crew needs a change in a file it doesn't own, it writes a short
request in its handoff note, and the integrator applies it at merge.

---

## 2. Step one: the contract (integrator, about half a day)

`art/kolob/SCORE.md` defines:
- `Hymn`, `Line`, `Note` and `Performance` (PLAN-COMPOSITION §2.3);
- the pitch representation (exact ratios);
- the typed event bus to the UI and viz;
- the module registration pattern on `window.KOLOB`;
- the stream-naming rules for random forks;
- how a guest, a dialect or a cast member plugs in (small interfaces, for
  example `Dialect.harmonize(line, ctx) → voicedLine` and
  `Guest.plan(meeting) → {section, dur}` / `Guest.perform(t, ctx)`).

Everything that starts now (tunes, Question, labs) is written against it.

## 3. What starts immediately, in parallel

| track | who | output | done when |
|---|---|---|---|
| **E0 engraving mockups** | 3 agents (running) | `mockups/engraving-{a,b,c}-*.html` | owner picks a direction |
| **T Earth tunes** | 1 Opus agent (owner's request) | the seven re-transcribed + 8–12 public-domain tunes, cited, in `kolob-tunes.js` (Score format); a `tune-lab` review page | owner reviews in `tune-lab` |
| **Q the Question** | 1 agent | `kolob-question.js`: a pure generator (seed → seven questions), the asking/bending logic, a lab page to audition questions | owner likes the questions by ear; integrated in W2 |
| **S sound labs** | 1–2 agents | standalone synthesis prototypes with lab pages: congregation desk, cast voice (with vibrato and age), children, brass band trio, fiddle, organ stops (principal, flute, vox humana + tremulant, reed, full), handbells, gulls, cart wheels | each voice auditioned in its lab; handed to the owning crew |
| **W1 module split** | 1 agent (serial) | `kolob-*.js` modules, behaviour preserved | harness passes, and a 5-minute event log for 3 seeds matches v0.30 (a short check, run once, only because it is a pure refactor) |

---

## 4. The critic loops

Five critics, each with a narrow job and real instruments. Critics don't
write production code. They write **reports**, and the **Enrichment critic**
turns the reports into proposals.

```
      build (crew) ──► check (crew critic, ≤2 rounds) ──► merge (integrator)
            ▲                                                    │
            │                                                    ▼
   owner approves ◄── enrichment brief ◄── panel reports ◄── listening packet
   (plan addendum)     (Enrichment critic)   (Listener, Idiom,     + owner's ear
                                              Variety, Eye)
```

### 4.1 Crew critic: every milestone
- **Who:** a checker paired with each builder.
- **Reads:** the milestone's acceptance lines in the plan (for example §12
  of the composition plan), the diff, the harness output and the lab.
- **Returns:** pass, or a short fix list.
- **Limit:** 2 rounds maximum; unresolved items go to the backlog, not a
  third round.

### 4.2 The panel: after each merge to `kolob-2`
Each report is one page with concrete seeds and timestamps.

- **The Listener** (musical quality and joy)
  - *Material:* real-audio captures of 6 seeds × the first 4 minutes plus
    one full meeting, via headless Chrome and the Web Audio tap already
    built for ZANKYŌ. From these it makes spectrograms, loudness curves and
    density curves, and reads them alongside the Score and the event log.
  - *Answers:* Where does it drag? Where does it crowd? Where is it
    *joyful*? What was the best 30 seconds, and why?
  - *Limit:* Claude cannot hear. The Listener judges from Score,
    spectrogram and measurements; the owner's ear decides.
- **The Idiom critic** (the musicologist)
  - *Reads:* engraved excerpts and Score dumps per dialect.
  - *Checks:* Does the Sacred Harp sound Sacred Harp (tune in the tenor,
    open fifths, no amen)? Does the Tabernacle voice-leading follow
    Victorian practice? Does the fuge enter correctly? Is the barbershop
    seventh actually tuned 4:5:6:7?
  - *Returns:* flags on anything that betrays the tradition, and
    authenticity details worth adding.
- **The Variety critic**
  - *Runs* the distinctness measure (PLAN-COMPOSITION §2.6) over 20 seeds'
    first three minutes.
  - *Answers:* Which seeds are near-twins? What material recurs too often
    across seeds (a question, a cadence, a registration)? Is anything the
    same in every meeting?
- **The Eye** (visual)
  - *Takes* screenshots at 860 and 390 px at set times, plus 4× CPU
    throttling for fps.
  - *Checks* them against PLAN-ENGRAVING: legibility, accuracy against the
    Score, collisions, plate clipping, and whether it looks *finished*.

### 4.3 The Enrichment critic: the loop that adds richness
After the panel reports, one agent with a different brief: **what would make
this more sophisticated, richer, more varied, more joyfully novel, while
staying Kolob?** It reads:
- the plans;
- what shipped;
- the panel's reports;
- the owner's reactions (from their notes, relayed);
- the unused ideas backlog.

It writes an **enrichment brief** (at most one page, at most five proposals).
Each proposal names:
- the idea;
- the tradition it's rooted in (a real practice, composer or piece);
- what a listener would hear, and when in a meeting;
- the cost (which crew, and roughly how big);
- the risk to Kolob's character.

**The integrator brings the brief to the owner.** Approved items become a
plan addendum (§14 of PLAN-COMPOSITION onward) and enter the next wave's
milestones. Unapproved items go to `IDEAS.md`. Nothing is built from a
brief the owner hasn't seen.

### 4.4 The rubric every critic scores against
The owner's words, made into five axes, each rated 1–5 with a one-line
reason:

| axis | question |
|---|---|
| **Sophistication** | Is there real musical thought: phrase logic, voice-leading, form? |
| **Richness** | Are there enough layers, colours, people and events within one meeting? |
| **Variety** | Would a returning visitor hear a different Sunday? Are the first three minutes distinct? |
| **Joyful novelty** | Is there a moment that delights or surprises, in the clear-light, playful, Ivesian spirit? |
| **Kolob-ness** | Is it still a hopeful frontier meetinghouse in far-future light, hymn-rooted, never dark? |

The trend across releases is tracked in `archive/critic/SCORES.md`, so it's visible
whether the build is getting better on every axis.

### 4.5 The owner's listening packet (every merge)
One page (`handoff/listen-vX.md`):
- 5 seeds, each with a timestamp and what to listen for (for example "seed
  3107 at 4:10: a Sacred Harp hymn in the hollow square; the pitch drifts,
  then the organ re-enters");
- dev jump links to sections (the wheel's dev jump menu);
- the known rough edges.

The owner's reactions are the most important input to the Enrichment critic.

---

## 5. Suggested sequence (waves)

| wave | runs in parallel | critic moments |
|---|---|---|
| **Now** | E0 mockups · T tunes · Q question · S sound labs · SCORE.md → W1 split | Eye on mockups; owner picks |
| **W2** | 0b streams, clock and re-base · 0d bug fixes · 0e harness, distinctness, labs · engraving foundation (atlas, staff, telegraph tape) | crew critics; **first panel** on v0.31 (re-based foundation + Question) |
| **W3** | HYMN · CAST · GUEST (one agent per guest) · FORM · ENGRAVE (Score-driven) | crew critics per milestone; panel + enrichment brief after each merge |
| **W4** | VISIONS · second guest round · polish from enrichment briefs | panel + enrichment |
| **W5** | WORDS (vowel-lab → Deseret singing) | panel |

The first owner-audible milestone is **v0.31: the new Question, the bug
fixes, and a re-based engine**, which takes W1–W2.

## 6. How to run it

- **The coordinator.** A single coordinating session (this one, or a fresh
  one briefed with these three plans) acts as integrator.
- **Workflows.** Each wave is a **Workflow** run: builders and crew critics
  as `agent()` calls in worktrees, the panel as parallel agents after the
  merge, the enrichment critic last. The runs are resumable, and the
  coordinator reports the results to the owner.
- **Ports.** Each worktree serves on its own port (`php -S` in the worktree,
  for example `:8101`–`:8109`). They are listed in `handoff/PORTS.md` so the
  owner can listen to any branch.
- **Handoff notes.** Every crew writes one at each milestone
  (`handoff/<crew>-<n>.md`): what shipped, how to hear it, requests to the
  integrator, known issues.
- **Scale.** Waves stay within about 10 agents each (the session's default
  size guideline) unless the owner raises it.
