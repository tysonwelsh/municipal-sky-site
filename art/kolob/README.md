# KOLOB 𐐗𐐄𐐢𐐉𐐒 — the current state

*Read this first. It says what is live, what is shelved, which documents govern,
and how to check a change. Written 2026-10-01 at v0.36.2; keep it true when the
app changes. The long documents it points to are the record; this page is the map.*

**What it is.** A browser generative-music piece at `/art/kolob/`: an endless,
aleatoric hymn meeting of a far-future colony of Latter-day Saints "at the rim of
Kolob's light". All sound is Web Audio, all of it synthesized; the page is a
Deseret-alphabet broadside with a wheel for the order of service, a shape-note
staff engraved as the music plays, a hymn board and the clerk's minutes. A seed
plays the same meeting every time, in the browser and in the headless harness.

## The folder

| what | where |
|---|---|
| the page | `index.php` (markup, the build stamp), `kolob.css`, `kolob-ui.js` (the console, the minutes, the band's caterpillar), `kolob-viz.js` (the wheel, the organ facade, the staff), `kolob-text.js` (the broadside) |
| the engine's one list | `_engine.php` — every room the page, the labs and the harness load, in SCORE §1's order; add a module there and nowhere else |
| the tuning and the score | `kolob-pitch.js`, `kolob-score.js`, `kolob-tunes.js` (the Earth tunes, cited) |
| the composers (pure) | `kolob-melody.js`, `kolob-harmony.js` (the day's theme), `kolob-dialects.js`, `kolob-hymnists.js`, `kolob-composer.js` (the hymn composer), `kolob-organist.js`, `kolob-calendar.js` (the Sunday, the arc of light, the guest budget), `kolob-experimental.js` |
| the voices | `kolob-voices-*.js` — the pipe organ, the old additive organ (the A/B), the choir rooms, the ward's 32 throats (`vocal`), winds, ground, field, the brass (`band`), the folk instruments |
| the performers | `kolob-cast.js` (the ward and its people), `kolob-hymnal.js` (the day's hymnal and the composer's desk, a Web Worker), `kolob-guest-*.js` (every guest), `kolob-testimony.js`, `kolob-guests.js` (the set pieces), `kolob-meeting.js` (the order of service, the joints, the seating) |
| the facade | `kolob-core.js` — raises `window.KolobAudio`; the only thing the page calls |
| the version | `VERSION` — one line, `v0.36.N — what the owner would notice`; bumped in the same commit as any audible or visible change (SCORE §8); `index.php` prints it with a fingerprint of the served bytes |
| the labs | `*-lab.php` + `*-lab.js` — unlinked dev benches, one per subsystem (`hymn-lab` is the owner's listening checkpoint for the composer) |
| shelved | `shelved/` — the Question (`kolob-question.js`, its lab) and the bagpipe (`kolob-voices-bagpipe.js`, its lab): the owner's rulings of 2026-09-27 and 2026-09-13; code kept, not loaded |
| the harness | `_harness.js` — plays a meeting headless in Node (mock Web Audio, a virtual clock) and writes the dump the tools read; tracked since 2026-10-01 |
| the tools | `tools/` — `loadcheck.js`, `lends.js`, `selftest.js`, `distinctness.js`, `repetition.js`, `tally.js` (A/B), `screens.js`, `capture.js`; `tools/README.md` explains each |
| the contract | `SCORE.md` — the interface every module codes against. It is layered: §1–§8 the base, then §9 (round 2), §10 (round 3), §11 (round 3b), §12 (round 3c), §13 (housekeeping); **a later section wins where it differs from an earlier one, and the code it names is the authority** |
| the plans | `PLAN-COMPOSITION.md` (the music; §14–§15 hold the owner's rulings), `PLAN-ENGRAVING.md` (the staff), `PLAN-EXECUTION.md` (crews, critics, handoffs), `PLAN-ONE-ROOM.md` (the room), `PLAN-CATERPILLAR.md` (the band's volume control) |
| the handoffs | `handoff/` — what is current: the listening packets (`listen-*.md`), the last integration (`r3c-integrate-1.md`), the last engraving pass (`r3c-engrave-2.md`), the caterpillar (`caterpillar-1.md`, `-2.md`) and one open brief (`drone-wave-handoff.md`). Everything a later round superseded is in `handoff/archive/` |
| the critics | `critic/` — the enrichment briefs and the panel reports; `handoff-second-look.md` an independent re-review |
| mockups | `mockups/` — the engraving directions the owner chose from (Direction A shipped) |

## How a meeting works, in one breath

`KolobAudio.play()` cues `planMeeting` on the audio clock. The planner draws a
Sunday of the colony year, the keynote, the mode and the order of service
(prelude, invocation, hymns, testimony, sacrament, doxology, postlude), seats the
guests against one budget, draws the day's hymnal (a house dialect, a key per
hymn, the forms) and orders the hymns from the composer off the audio thread,
seats the ward and its organist, and enters the first section. A conductor tick
runs each section; a joint closes it; the next begins. Every decision is a draw
from a named stream forked from the visit's seed (SCORE §3), every die is thrown
whether or not its result is used, and no musical decision reads the audio clock
(§4): that is why a seed is reproducible.

## The rules that bind

- **Silent testing.** Every browser an agent launches is muted
  (`--mute-audio`); level checks render offline. `tools/lib/chrome.js` refuses an
  unmuted Chrome.
- **VERSION moves with the owner's experience.** Any change the owner could hear
  or see bumps `VERSION` in the same commit. Dev-only work (tools, labs, docs)
  does not.
- **The Hosanna is audio-only and unlogged** (owner): nothing in the minutes,
  on the board or on the staff.
- **The ward is the full 32**, and phones get no fewer voices (owner). Measure
  cost, report it, do not cut.
- **The comments carry the rules.** This code base explains itself in its
  comments, and agents read them as truth. When a rule changes (a seat, an odds,
  a switch), grep for the old rule's words and fix every comment that states it.
- **The shared bag.** Rooms lend onto `KOLOB._s` and read each other's lends;
  `tools/lends.js` checks that every read has a lend. A lend that may be absent
  (a lab without the room) is read under a guard.
- **One number, one place.** A rate the page shows is read from the engine
  (`KolobAudio.getCumulativeOdds()` for the Whole switch), never retyped.

## Check a change before you push

```sh
npm install                              # once: ESLint (package.json at the repo root)
npm run lint                             # no undefined names, no unused variables
node art/kolob/tools/loadcheck.js        # the engine loads headless; the roll call; one hymn proofread
node art/kolob/tools/lends.js            # every S.x read has a lend
node art/kolob/_harness.js 300 7         # a meeting plays headless, no errors, no late cue
node art/kolob/tools/selftest.js         # the measurement tools read true
node art/kolob/tools/tally.js --a git:main --b worktree --seeds 1-20   # did my change move the music?
node art/kolob/tools/screens.js --seed 22                               # the staff at 860 and 390 px, muted
```

CI (`.github/workflows/kolob-check.yml`) runs the first six on every push that
touches the engine. `tally.js --a git:<ref> --b worktree` is the honest answer to
"did I change the music": a housekeeping change must leave every seed byte for
byte the same; a musical change should move only what it meant to.

## Dev switches on the page

`?seed=N` · `&guest=<name>` (one of `bands handcart gulls variations changes
tongues farward hosanna socialhall testimony trombones handbells singingschool
steeples oldtune`) · `&exp=-reckoning` / `-singingSchool` · `&choir=house` ·
`&organ=house` · `&latin=1` · `&kolobPreview=1`. The Ives switch forces a guest;
the Whole switch governs the withheld tune; Latin reveals the dev labels.

## Where to hear things

`handoff/listen-r3c.md` gives a seed and a time for every guest (the band on
seed 22 at 3:21, the Social Hall at 16:01; the Hosanna on seed 37 at 17:55…);
`listen-r3b.md` the ward, the organist and the reckoning; `listen-v034.md` the
trombones and the old tune. `index.php?seed=22&guest=bands` brings the band and
its caterpillar within half a minute.

## Open threads (2026-10-01)

- Nobody has listened to rounds 3b and 3c: every level was set by measurement.
- Planned, not built: Deseret phoneme singing (words), the visions and the far
  tail, the drone as a waveform on the staff (`handoff/drone-wave-handoff.md`),
  the one-room plan's later phases.
- The house choir, the house organ and the desks remain as A/B fallbacks
  (`?choir=house`, `?organ=house`); once the owner's ear has chosen, retire the
  loser (`kolob-voices-choir.js` carries two near-twin performers).
- The fife (`twoBandsCross`) remains as the band's fallback for a page without
  `kolob-guest-bands.js`.
- The caterpillar has not been watched at full frame rate; the owner asked for
  "a few more passes".
- Cost: the Hosanna near 6,000 nodes; the far ward's 24 throats; no phone tested.
