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

## The cost, measured in the page (not cut: the owner's ruling)

Each guest played in the real page (index.php on :8175, muted headless
Chrome on this M3 Pro, load average 2.4–4.3; the dev jump to its section),
read three ways at once, after the round-3b ward critic's tracer: the audio
thread's render callbacks (Chrome's trace, `AudioDestination::Render`,
summed per second), the WebAudio domain's nodes alive, and the page's
clock (late cues) and long tasks. Beside a yardstick taken the same way:
the ward's own hymn with the organ and no guest.

| window (seed, section, seconds traced) | audio thread, % of each second: median · p90 · worst 5 s | one render callback (5.33 ms of audio), ms: median · p99 · max (over 5.33) | nodes alive, peak | errors |
|---|---|---|---|---|
| **yardstick**: the ward's hymn, organ, no guest (3, hymn, 100) | 29.5 · 35.0 · 35.4 | 1.38 · 4.08 · 5.45 (1 of 19,365) | 2,212 | 0 |
| the band, and a second band, crossing the ward's hymn (22, hymn, 100) | 32.6 · 39.7 · 41.0 | 1.68 · 3.69 · 5.01 (0) | 2,149 | 0 |
| **the Hosanna**: the doxology, then the shout and ASSEMBLY (37, doxology, 215) | 34.0 · 43.8 · 43.4 | 1.74 · 4.08 · **5.86 (18 of 40,849)** | **5,801** | 0 |
| the far ward with our first hymn (44, hymn, 150; it sings about 47 s of it) | 23.1 · **46.0 · 47.7** | 1.31 · 3.57 · **6.42 (1 of 28,798)** | 2,928 | 0 |
| the variations (55, postlude, 150) | 19.4 · 21.9 · 22.1 | 0.78 · 2.40 · 3.19 (0) | 1,044 | 0 |
| the Social Hall (22, postlude, 110) | 19.5 · 22.0 · 22.7 | 0.94 · 2.12 · 3.10 (0) | 275 | 0 |
| the gift of tongues (5, testimony, 90) | 16.8 · 25.5 · 27.8 | 0.80 · 2.63 · 3.92 (0) | 459 | 0 |
| the testimony-bearers (2, testimony, 110) | 16.4 · 18.7 · 19.4 | 0.78 · 1.92 · 2.84 (0) | 216 | 0 |
@@MORE-COSTS@@

- **The audio clock kept time in every window**: no late cue (0 of 324 to
  3,061 cues each), the audio clock's ratio to the wall at a median of 1.00
  (its lowest second 0.92–0.99, each answered by the next).
- **The heaviest are the Hosanna and the far ward.** The Hosanna runs about
  1.2× the ward's hymn at its worst five seconds (43 % against 35 %), forty
  singers and the full organ, and its longest callbacks run a little past
  the budget (18 of 40,849), as crew C measured. The far ward adds about
  ten points while it sings (46–48 % against 35 %), with twenty-four throats
  of its own; eight pews would save nodes, not audio time (crew C's critic).
- **The band** adds about five points over the ward's hymn it crosses; the
  guests of the quiet rites (the dance, the variations, the gift, the
  bearers) cost less than a hymn.
- **Where to save, if the owner wants to** (none of it done): the far ward
  in pews; the Hosanna without the Primary's children (32 voices, not 40)
  or on "hymn principal" instead of the full organ; the band's second band.

## The critics' notes (PLAN-COMPOSITION §15), and what was done

- **Crew A's critic.** (1) The second band no longer vanishes: with one
  hymn left to march it takes the section's own hymn in its stranger's key,
  or the same march in the other key at its own pace (seeds 22 and 47 play
  both cases); the band crew's handoff is corrected at its head. (2) The
  march is made a cue ahead (`PRE_MADE`), never in the wake that lays its
  first bar. (3) The harness exempts the organist under the ward when a band
  crosses a verse (the house-lets-go check, audio graph). (4) The band's 36 %
  is kept; the other guests carry the budget. (5) The warm block and the
  staff patch are applied, and the staff was looked at. (6) *Not done* (it
  was optional): the trombones borrowing the band's reverb. (7) Left for the
  ear, with the measured figure (the band crosses the doxology 3 times in
  10 in the real meeting, not 7).
- **Crew B's critic.** The variations' set is made ready off the clock (an
  idle timer once its hymn is written; its cue only holds the section).
  The plain organist's theme on a non-Tabernacle hymn (trumpet solo and soft
  flutes on the tenor tune) and the two-key proxy counting gospel's sevenths
  are left as the critic described them: neither is a fault in the meeting;
  both are corrections to the organ crew's claims.
- **Crew C's critic.** (1) Name-shaped words refused as a pattern. (2)
  Every guest a room is told of carries its rite's `index`. (3) The Hosanna
  is planned at the hook, and a band leaves its doxology (the payoff reset).
  (4) The ward is seated before the guests; the gift's singer is always a
  bearer (the voices handoff's summary corrected). (5) The Hosanna does not
  give way (`YIELD` false) — but it is asked before the other guests, so the
  budget keeps it a place. (6) The gift seeds the next hymn, the doxology
  only without a payoff. (7) `ENGRAVE_HYMN = false`. (8) The cost is
  measured again in the page (below).
- **Crew D's critic.** (1) The house lets go as the first bearer rises; the
  still small voice keeps its peace through the testimony. (2) The 7/4 stop
  stays under the fiddle's ceiling. (3) Every quadrille figure is called. (4)
  The Sunday is always handed in. (5) On Pioneer Day the band crossing the
  doxology and the dance after it may sit side by side.

## Requests

1. **ENGRAVE.** `kolob-viz.js` was patched here with the bands crew's
   block D (`takeBand`) because critic A's note required it; please own it
   from here. New layers the staff does not yet draw: `handcart`, `gulls`,
   `farward` (a faint second staff?), `tower` (the ringers' blue line can be
   drawn from `bell`, `place`, `row`), `fiddle` (AABB with repeats; the
   dance's notes name their hymn `dances`), and the testimony's speech
   (`voice`, `speech: true`) and reeds. The Hosanna stays off the staff.
2. **CAST.** `VoicesVocal.warm(ctx)` (the bands crew's request 8) would let
   the ward's first breathing line stop baking its inhale in a cue, as the
   company's warm does now.
3. **The owner** (in the packet): the band's share of the budget; where it
   crosses; `SHOUT_EFFORT` and `YIELD`; the far ward's throats or pews; the
   testimony's speech; the levels.
4. **The next integrator.** The owner's VERSION bump waits for the merge to
   `kolob-2` (the house rule for this branch was not to bump).

## Known issues

- **Rare by design.** With the band's 36 % kept and six in ten meetings
  carrying a guest, each new guest comes in one to five meetings in a
  hundred. The packet gives a seed for each.
- **The press.** The PLAY press is one long task of 110–126 ms in every
  trace (the yardstick without a guest too): the graph, the first meeting's
  plan, the composer's desk opened, and now the new guests' warm-ups (the
  company's silent line, the ringers' touches, the far ward's valley).
- **Callbacks over the budget.** The Hosanna: 18 of 40,849 render callbacks
  over 5.33 ms (the longest 5.9 ms), as crew C measured; the far ward: 1 of
  28,798 (6.4 ms). The audio clock kept time in both (no late cues, the
  clock ratio's median 1.00); nothing measured shows a dropout, but the ear
  should listen at the shout's entries and the far ward's first verse.
- **REPRO at a run's cut-off.** Seed 22 at exactly 1,250 s: the jittered
  run laid three organ chords of the next meeting a pump earlier (the
  organist's desk lays ahead by the audio clock); the scores are identical,
  and at 1,200 s all four runs are.
- **The dev jump and the far ward.** `skipToSection("hymn")` lands on the
  first hymn; a far ward seated in a later hymn is heard only by playing on.
- **The seed-37 trombone fix** (the tenor part's top C5) changes the dawn's
  voicing only where a tenor line would have stood strained above B-flat4.
