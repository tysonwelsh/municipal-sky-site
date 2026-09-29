# r3c-integrate-1: the new guests in the meeting, under one guest budget

*Integrator, round 3c. Branch `kolob-r3c` (cut from `kolob-2`), worktree
`municipal-sky-site-kolob-r3c`, served on :8175. 2026-09-29. Not pushed,
not published; VERSION unchanged. The owner's packet is
[`listen-r3c.md`](listen-r3c.md).*

## What shipped

The four guest branches are merged (`kolob-r3c-bands`, `-organ`, `-voices`,
`-hall`; one conflict, `kolob-voices-vocal.js`'s timeline, where both the
voices crew's spelled syllables and the hall's spoken glide were kept), and
every new guest is seated in the real meeting by its own plan, under one
guest budget, and performs there:

| guest | where it sits | how it comes |
|---|---|---|
| **the Nauvoo band** (replaces the looping fife) | the doxology 7 in 10, else a hymn | cued: it strikes up while the ward sings and crosses the verse; a second band now and then (14 % of the bands) |
| **the handcart company** | a quiet rite (prelude, testimony, interlude, postlude…) | cued; ALL IS WELL far across the fields, the carts' wheels |
| **the gulls** | a quiet rite | cued; the flock's cries trace the first hymn's head |
| **variations on a hymn** | the prelude (the day's first hymn) or the postlude | cued; the Sunday's organist on the pipes, three to five characters |
| **change ringing** | the steeples' seat (prelude or postlude) | a variant of the steeples: a far tower rings Plain Hunt or Plain Bob |
| **the gift of tongues** | the testimony | cued; one of the day's testimony-bearers sings; the ward hums, the harmonium answers |
| **the far ward** | one of our hymns (never the doxology, a round, a lined hymn or the Primary's) | inside our hymn, a line behind, verse by verse |
| **the Hosanna** | the last doxology's close, Easter and a dedication only | after the doxology's hymn; **unlogged**, audio-only |
| **the Social Hall** | **replaces the postlude** | cued after the benediction; fiddle, caller, the dancers' floor |
| **the testimony-bearers** (not a guest) | the testimony, most Sundays | cued as the testimony begins; speech the reed plays back and makes a tune of |

Commits, oldest first: the four merges (`…` to `2ac7fb5d`); `235a9870` the
modules loaded and the odds made one table; `633a4d39` the planner and the
budget; `9f884a8b` the performances, the minutes, the staff patch, the
switch; `0e334b4b` the budget calibrated; `2507c0ad`, `…` what the whole
meetings found; `530e1790` SCORE §12; and this handoff.

### Files

- **kolob-meeting.js** — the guest budget; the planning of every new guest
  in the recipes' order (the organist and the ward seated before the
  guests); the band's, company's and gulls' material made a cue ahead
  (`PRE_MADE`, `outsideMaterial`, with the second band's fix); the
  variations made ready in idle time (`readyAhead`, `variationsMaterial`,
  `variationsSeating`); the Social Hall's material; the testimony-bearers
  (`testimonyBegins`, `testimonySounding`, `testimonyHolds`); the far ward's
  manager (`farWardFor`); the Hosanna (`hosannaBegins`); `LISTENED`,
  `VISIT_FN`, the Book's `budget()`, `testimony()`, the guests' `index`.
- **kolob-guests.js** — the glue: `outdoorGuest`, `nauvooBand`,
  `handcartCompany`, `gullsOver`, `organistVariations`, `changesRing` (the
  steeples' variant), `tonguesGift` (through `standingGuest`, which now reads
  a guest's `ROWS` and `ROW_LABEL`), `socialHall`.
- **kolob-calendar.js** — `GUEST_ODDS` (the one table), `GUEST_BUDGET`,
  `guestOdds()`, `neighboursMay()`; the Sundays' old `guests` factors gone.
- **kolob-core.js** — the new guests warmed at the press; the seats'
  depths (`fiddle`, `floor`, `speaker`, `reed`).
- **kolob-voices-choir.js** — the far ward's three hooks in `singHymnWard`.
- **kolob-voices-organ.js** — the recipe's two changes (a recital at the
  prelude's level; `variations` on its notes and its `cast` events).
- **kolob-voices-field.js** — the still small voice keeps its peace through
  the testimony-bearers and the gift (critic D).
- **kolob-cast.js** — `ACTION_DS` for the variations and the gift.
- **kolob-ui.js** — the minutes' rows and the direction line for the new
  guests (Deseret by `deseretCaps`), `?guest=<name>`.
- **kolob-score.js** — the `testimony` event (SCORE §12.5).
- **kolob-viz.js** — the bands crew's block D, `takeBand`, as given (critic
  A's note 5 asked for it; it is ENGRAVE's file — see Requests).
- **the guest modules** — the `info.odds` hook in every room; the gift's
  name-shaped words refused (critic C); the dance's 7/4 stop under its
  ceiling and every quadrille figure called (critic D); the dance's phrase
  notes reported on the clock (they were reported from 0: the lab never saw
  it); the tenor trombone part's top to C5 (seed 37's dawn, pre-existing on
  kolob-2); `ENGRAVE_HYMN = false` (the owner's ruling); a local `var S`
  renamed where it fooled the harness's lend check.
- **SCORE.md §12**, **_engine.php**, and the harness (`_harness.js`,
  gitignored: the census, the checks' exemptions, `soundlog=`, TRANSPORT's
  `pause=`/`stops=`, the mock's `playbackRate`).

## The guest budget

The round-3b tally found a guest in 75 % of meetings against PLAN §8's
≈55 %, and this round adds nine. The budget:

- **One table of odds** (`kolob-calendar.js` `GUEST_ODDS`): a row a guest,
  a column a Sunday, each cell the chance that guest is asked to that
  Sunday's meeting. The meeting reads it for its own dice (the steeples, the
  old tune) and hands it to every guest's room as `info.odds`. Change one
  number and that guest comes more or less often on that Sunday, and
  nothing else moves (each chance is one draw of its die whatever it is
  read against, so no other die of the meeting shifts).
- **Where the numbers came from.** The band's row is the owner's 36 % and
  the Sundays' old welcome, untouched (critic A: "leave the band's 36 % as
  the owner set it"). Every other row is its crew's own starting odds, by
  Sunday, at about a third; the four guests heard since rounds 2 and 3b (the
  old tune, the trombones, the singing school, the handbells) a fifth lower
  again, leaving their share to this round's. The Hosanna keeps its own
  (Easter 0.5, a dedication 0.95): the rite of its Sundays.
- **The rules** (`GUEST_BUDGET`, enforced in `planMeeting`): two guests at
  most, the Hosanna counted; one showpiece at most (the variations, the
  Social Hall, the Hosanna); never two guests in the same rite or in
  neighbouring rites, except the band crossing the doxology beside the
  Social Hall on Pioneer Day (critic D's note 5); each guest's own rules
  first (its exclusions and Sundays, as its recipe has them); the doxology's
  one payoff (a band in the doxology leaves it when the payoff is another's,
  or when the Hosanna comes). The guests are asked in a fixed order — the
  band first, the gulls last — and the last asked yields when the budget is
  full; the Hosanna is asked before all of them and keeps its place.
- **The testimony-bearers are not guests** (they are the testimony's own
  people): outside the budget, never a neighbour, and a guest seated in the
  testimony (the gift, the old tune) keeps it for itself.

**Measured** — the harness's census plans 1,000 first meetings, the real
planner (`node _harness.js 2 1 caln=1000 calbase=0 notb`), and checks every
rule on every one (the count, the showpiece, neighbours by the rite's place
in the plan, the Hosanna only at Easter or a dedication and never among
the visitations, the Social Hall only in the postlude and never at a
funeral or on a fast Sunday, the gift only in the testimony, no bearers
beside a guest in the testimony, no band in the Hosanna's doxology, no band
with the trombones or the handcarts). Two independent samples:

| guest | seeds 1–1,000 | seeds 90,001–91,000 | first seeds (1–1,000) |
|---|---|---|---|
| the Nauvoo band | 34.8 % (348) | 36.3 % (363) | 7, 11, 14, 22 |
| the steeples | 3.1 % (31) | 2.5 % (25) | 49, 53, 121, 132 |
| … ringing changes | 2.1 % (21) | 0.7 % (7) | 53, 121, 270, 291 |
| the old tune | 4.0 % (40) | 3.8 % (38) | 91, 113, 125, 129 |
| the trombones at dawn | 5.1 % (51) | 4.4 % (44) | 27, 37, 120, 155 |
| the singing school | 2.9 % (29) | 3.3 % (33) | 8, 12, 30, 108 |
| the handbells | 4.8 % (48) | 4.8 % (48) | 9, 15, 23, 27 |
| variations on a hymn | 3.7 % (37) | 4.0 % (40) | 55, 77, 78, 80 |
| the gift of tongues | 2.4 % (24) | 2.5 % (25) | 5, 25, 77, 107 |
| the far ward | 2.7 % (27) | 2.8 % (28) | 10, 44, 57, 65 |
| the Social Hall | 3.9 % (39) | 2.7 % (27) | 22, 60, 70, 110 |
| the handcart company | 1.5 % (15) | 1.6 % (16) | 41, 119, 223, 326 |
| the gulls | 2.1 % (21) | 2.3 % (23) | 50, 109, 173, 244 |
| the Hosanna | 4.5 % (45) | 2.9 % (29) | 37, 69, 98, 128 |
| (the testimony-bearers) | 62.8 % (628) | 63.6 % (636) | 1, 2, 3, 6 |
| **with at least one guest** | **60.5 %** | **59.3 %** | |
| none · one · two · three | 395 · 455 · 150 · 0 | 407 · 447 · 146 · 0 | |
| rules broken | 0 | 0 | |

| Sunday (seeds 1–1,000) | meetings | with a guest | the most seated |
|---|---|---|---|
| ordinary | 450 | 59.3 % | the Nauvoo band 36.7 %, the handbells 5.6 %, the singing school 4.2 %, the trombones at dawn 3.6 % |
| fast | 137 | 39.4 % | the Nauvoo band 16.1 %, the old tune 7.3 %, the gift of tongues 5.8 %, the far ward 4.4 % |
| conference | 141 | 66.7 % | the Nauvoo band 44.0 %, variations on a hymn 7.8 %, the trombones at dawn 7.8 %, the handbells 5.0 % |
| pioneer | 72 | 88.9 % | the Nauvoo band 73.6 %, the Social Hall 18.1 %, variations on a hymn 8.3 %, the old tune 6.9 % |
| christmas | 63 | 54.0 % | the Nauvoo band 17.5 %, the steeples 11.1 %, the trombones at dawn 11.1 %, ringing changes 7.9 % |
| easter | 59 | 81.4 % | the Hosanna 57.6 %, the Nauvoo band 33.9 %, the trombones at dawn 13.6 %, the handbells 8.5 % |
| wedding | 37 | 62.2 % | the Nauvoo band 32.4 %, the Social Hall 21.6 %, the trombones at dawn 5.4 %, variations on a hymn 5.4 % |
| funeral | 30 | 33.3 % | the trombones at dawn 13.3 %, the gift of tongues 6.7 %, the handcart company 6.7 %, the steeples 3.3 % |
| dedication | 11 | 100.0 % | the Hosanna 100.0 %, the Nauvoo band 18.2 % |

(A guest's column counts the meetings it is seated in; the steeples'
change ringing is counted inside the steeples too.) Refused by the budget,
seeds 1–1,000: 24 invitations in all — the variations 8 (7 full, 1
showpiece), the Social Hall 5, the old tune 3, the gulls and the far ward 2
each, the gift, the handbells, the steeples and the handcarts 1 each. Of
the bands, 50 of 348 bring a second band. The gift's song seeded the next
hymn twice in 24 (it seeds only a hymn after the testimony, or a doxology
with no payoff — critic C's note 6 — and the doxology nearly always has
one).

## How it was checked (all silent)

The harness (Node, the mocked audio graph and the engine's own clock) and
muted headless Chrome over CDP (`--headless=new --mute-audio`, port 9495,
profile `kolob-r3c-integrate-chrome`), the page on :8175.

| check | result |
|---|---|
| the census, 1,000 first meetings × 2 samples | 60.5 % and 59.3 % with a guest; 0, 1, 2 guests: 395 · 455 · 150 and 407 · 447 · 146; **no third guest; 0 rules broken**; every guest seated (the rarest, the handcart company, 15 and 16 times; change ringing 21 and 7) — the tables above |
| whole first meetings, seeds 1–24 (1,050 s each) | **24 of 24 PASS**, 0 runtime errors |
| each new guest where it falls naturally (1,100–1,250 s) | the band and a second band, then the Social Hall (seed 22); the Hosanna (37, Easter); the far ward (10, 44, 65, 130); the gift (5); the variations (55); the company (41); the gulls (50); change ringing (53); the bearers (1, 2, 3); a lone hymn marched by two bands (47): **all PASS**, 0 runtime errors |
| the switch, every new guest forced (seeds 9, 69, 3, 5) | each seated where its plan puts it, PASS (a switch cannot add a rite: seed 9's meeting has no testimony, so the gift and the bearers were forced on seeds 3 and 5) |
| the Hosanna, unlogged (seed 37, `unlogged=hosanna`) | 415 notes and its span all `logged: false`, 0 leaks, no `hymn-announced`, never in `guests-drawn`; the conductor polled 58 times while it sounded and never named it; in the page the direction line stayed empty and nothing reached the minutes |
| **REPRO** (the same seed twice, jittered timers, re-salted sound) | **PASS** on seeds 55, 37, 10, 5, 41, 50, 53, 1, 1847, 7 (1,100–1,250 s) and 22 at 1,200 s: the score identical every time, the sound identical under jittered timers (the variations, made ready in idle time, included). At 1,250 s seed 22's jittered run wrote three organ chords of meeting 2 a pump earlier at the run's cut-off (the organist's desk lays its next pump by the audio clock); the scores were identical, and at 1,200 s all four runs are |
| **TRANSPORT**, paused and stopped *inside* each new guest (`pause=`, `stops=`) | **PASS** in the band (22, 230/240 s), the Social Hall (22, 990 s), the Hosanna (37, 1,100–1,160 s), the far ward (10, 420/430 s), the variations (55, 880/900 s), the gift (5, 395/405 s), the bearers (1, 530/540 s), the company (41, 870/880 s), the gulls (50, 540/542 s) and the far tower (53, 30/40 s): the same meeting after a 30 s hold, silent while held; after every stop 0 stale sources and 0 rooms still ringing reach the hall |
| the page, muted Chrome, 860 and 390 px | 0 console errors or warnings in every trace (below); no sideways scroll (scroll width = the viewport); the direction line names the band, the Social Hall, the gift, the company… and never the Hosanna |
| the staff (critic A, note 5) | the band's march drawn over the ward's hymn with the tuba's oom and its barlines (screenshot, seed 22, 860 px) |
| the gift's words (critic C, note 1) | 400 tongues, 3,200 words: 0 name-shaped (Lila, Lola, Lana, Mila, Nola, Leah, Noah), 0 fallbacks |
