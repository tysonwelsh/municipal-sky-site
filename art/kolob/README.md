# KOLOB 𐐗𐐄𐐢𐐉𐐒 — the current state

*Read this first. It says what is live, what is shelved, which documents govern,
and how to check a change. Written 2026-10-01 at v0.36.2; keep it true when the
app changes. This page is the map; `OWNER-RULINGS.md` holds every ruling the
owner has made, `OPEN-WORK.md` what is planned or asked for and not done,
`SCORE.md` the contract, `STAFF.md` the rules of the staff. `archive/` is the
build's record and governs nothing.*

**What it is.** A browser generative-music piece at `/art/kolob/`: an endless,
aleatoric hymn meeting of a far-future colony of Latter-day Saints "at the rim of
Kolob's light". All sound is Web Audio, all of it synthesized; the page is a
Deseret-alphabet broadside with a wheel for the order of service, a shape-note
staff engraved as the music plays, a hymn board and the clerk's minutes. A seed
plays the same meeting every time, in the browser and in the headless harness.

## The folder

| what | where |
|---|---|
| the page | `index.php` (markup, the build stamp), `kolob.css`, `kolob-ui.js` (the console, the minutes, the band's caterpillar), the page's drawing — the wheel, the organ facade, the staff — in six files behind one `KolobViz` (`kolob-viz-atlas.js` the glyph atlas, `kolob-viz-intake.js` the notes taken in, `kolob-viz-guests.js` the new guests on the staff, `kolob-viz-hymnal.js` the hymnal on the staff, `kolob-viz-wheel.js` the wheel and the facade, `kolob-viz.js` the page's state, the engraving and the frame, last; THE SIX FILES in `kolob-viz.js`), `kolob-text.js` (the broadside) |
| the page's list | `_viz.php` — the page's six files in the order they load; `index.php` prints their tags and fingerprints them, and the harness's `staff=`, `loadcheck` and `lends` read it; add a file of the page's drawing there and nowhere else |
| the engine's one list | `_engine.php` — every room the page, the labs and the harness load, in SCORE §1's order; add a module there and nowhere else |
| the tuning and the score | `kolob-pitch.js`, `kolob-score.js`, `kolob-tunes.js` (the Earth tunes, cited) |
| the composers (pure) | `kolob-melody.js`, `kolob-harmony.js` (the day's theme), `kolob-dialects.js`, `kolob-hymnists.js`, `kolob-composer.js` (the hymn composer), `kolob-organist.js`, `kolob-calendar.js` (the Sunday, the arc of light, the guest budget), `kolob-experimental.js` |
| the voices | `kolob-voices-*.js` — the pipe organ, the old additive organ (the A/B), the choir rooms, the ward's 32 throats (`vocal`), winds, ground, field, the brass (`band`), the folk instruments |
| the performers | `kolob-cast.js` (the ward and its people), `kolob-hymnal.js` (the day's hymnal and the composer's desk, a Web Worker), `kolob-guest-room.js` (the scaffold every guest room stands on: its stream, plan, odds and decision, its slices on the clock, its stages, its teardown), `kolob-guest-*.js` (every guest), `kolob-testimony.js`, `kolob-guests.js` (the set pieces), `kolob-plan.js` (the meeting's plan, pure: the Sunday, the order of service, the guests against the budget, the seatings, the day's hymnal and its orders), `kolob-meeting.js` (the meeting conducted: the sections entered, the conductor's tick, the joints, the chorister's book, the chord desk) |
| the facade | `kolob-core.js` — raises `window.KolobAudio`; the only thing the page calls |
| the version | `VERSION` — one line, `v0.36.N — what the owner would notice`; bumped in the same commit as any audible or visible change (SCORE §8); `index.php` prints it with a fingerprint of the served bytes |
| the labs | `*-lab.php` + `*-lab.js` — unlinked dev benches, one per subsystem (`hymn-lab` is the owner's listening checkpoint for the composer; `room-lab` the impulse responses; `voices-lab` v0.30's four voices, its own copy, against the ward) |
| shelved | `shelved/` — the Question (`kolob-question.js`, `kolob-question-setpiece.js`, its lab), the bagpipe (`kolob-voices-bagpipe.js`, its lab) and the tune lab (v0.30's old-tune incipits): the owner's rulings of 2026-09-27 and 2026-09-13; code kept, not loaded |
| the harness | `_harness.js` — plays a meeting headless in Node (mock Web Audio, a virtual clock) and writes the dump the tools read; tracked since 2026-10-01 |
| the tools | `tools/` — `loadcheck.js` (the engine loads, and the page's drawing), `lends.js` (the shared bags), `samecode.js` (an edit touched only comments; `--split`: a cut moved its code whole), `golden.js` (the pure core composes what it composed, against `tools/golden/`), `selftest.js`, `distinctness.js`, `repetition.js`, `tally.js` (A/B: did the music move), `screens.js`, `capture.js`; `tools/README.md` explains each |
| the contract | `SCORE.md` — the interface every module codes against, one layer, one section a topic (modules, pitch, streams, time, the Score, events, performance, guests, versions); **the code each section names is the authority**. The layered original it was consolidated from is `archive/SCORE-layered.md` |
| the owner's rulings | `OWNER-RULINGS.md` — every level, seat, look and shelved idea the owner has decided on, dated, each naming the code that implements it. Do not reverse one without asking |
| open work | `OPEN-WORK.md` — ideas approved and not built, the crews' requests not done, known issues, the decisions waiting on the owner's ear, cost |
| the staff's rules | `STAFF.md` — what the shape-note staff prints and never prints, the layers and their sizes, the look, the collision rules, the checks |
| the plans | `PLAN-ONE-ROOM.md` (the room; phases C–E open), `PLAN-CATERPILLAR.md` (the band's volume control) and `PLAN-REFACTOR.md` (efficiency, reliability and maintainability with nothing audible or visible changed: the faults found, the copies to fold, the page's frame, the order of work), each with a status banner. The build's plans — composition, engraving, execution — are in `archive/plans/`; what they proposed is built, declined (`OWNER-RULINGS.md`) or open (`OPEN-WORK.md`) |
| the handoffs | `handoff/` — what is current: the listening packets (`listen-*.md`), the last integration (`r3c-integrate-1.md`), the last engraving pass (`r3c-engrave-2.md`), the caterpillar (`caterpillar-1.md`, `-2.md`) and one open brief (`drone-wave-handoff.md`). Everything a later round superseded is in `archive/handoff/` |
| the archive | `archive/` — the layered contract, the build's plans, every superseded handoff and listening packet, the critics' briefs and panels, the second look, the old page mockups; `archive/README.md` says what each was. Nothing there governs |
| mockups | `mockups/` — the three engraving directions the owner chose from (A, "The Colony Tunebook", shipped) |

## How a meeting works, in one breath

`KolobAudio.play()` cues `planMeeting` on the audio clock. The plan
(`kolob-plan.js`, pure: handed the streams and what the house knows) draws a
Sunday of the colony year, the keynote, the mode and the order of service
(prelude, invocation, hymns, testimony, sacrament, doxology, postlude), seats the
guests against one budget, draws the day's hymnal (a house dialect, a key per
hymn, the forms) and seats the ward and its organist; `planMeeting` writes it
into the house, orders the hymns from the composer off the audio thread, and
enters the first section. A conductor tick
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
- **The owner's rulings stand.** `OWNER-RULINGS.md` lists them with their dates
  and the code that implements them: the Hosanna audio-only and unlogged, the
  bands never over the ward's singing, the Question and the bagpipe shelved, the
  staff's look, every level set by the owner's ear. Ask before reversing one.
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
npm run lint                             # no undefined names, no unused variables, no silent catch, a default in every switch (warnings: complexity, long functions)
node art/kolob/tools/loadcheck.js        # the engine loads headless; the roll call and the page's guard; the desk's files; one hymn proofread; every lab's list loads in its order
node art/kolob/tools/lends.js            # every S.x read has a lend; every BORROWED wrapper calls the lend it is named after
node art/kolob/tools/samecode.js         # a comment pass changed no code token (against HEAD; --ref <ref>)
node art/kolob/tools/golden.js           # the pure core (plan, hymns, guests, organist, ward) on seeds 1–40, in seconds; the plan run with the house shut
node art/kolob/_harness.js 300 7         # a meeting plays headless, no errors, no late cue
node art/kolob/tools/selftest.js         # the measurement tools read true
node art/kolob/tools/tally.js --a git:main --b worktree --seeds 1-20   # did my change move the music?
node art/kolob/tools/screens.js --seed 22                               # the staff at 860 and 390 px, muted (--freeze: frame-exact, two builds compared by pixel)
node art/kolob/_harness.js 600 22 staff                                  # everything the page draws, traced headless: a digest (KOLOB_DIR=<other build> for the other side)
```

CI (`.github/workflows/kolob-check.yml`) runs lint, loadcheck, lends, golden,
the harness and selftest on every push that touches the engine. `tally.js --a
git:<ref> --b worktree` is the honest answer to "did I change the music": a
housekeeping change must leave every seed byte for byte the same; a musical
change should move only what it meant to. `golden.js` is the same answer for
the pure core alone, in seconds; a change that moves it on purpose writes the
baseline again (`--write`) in the same commit.

## Dev switches on the page

`?seed=N` · `&guest=<name>` (one of `bands handcart gulls variations changes
tongues farward hosanna socialhall testimony trombones handbells singingschool
steeples oldtune`) · `&exp=-reckoning` / `-singingSchool` ·
`&latin=1` · `&kolobPreview=1` · `&kolobCumulative=1`. The Ives switch forces a guest;
the Whole switch governs the withheld tune; Latin reveals the dev labels.

## Where to hear things

`handoff/listen-r3c.md` gives a seed and a time for every guest (the band on
seed 22 at 0:08, in the prelude; the Social Hall at 16:01; the Hosanna on seed 37
at 17:55…); `listen-r3b.md` the ward, the organist and the reckoning (its times
were re-checked against the harness on 2026-10-01). The older packets in
`archive/handoff/` name seeds that no longer play those meetings.
`index.php?seed=22&guest=bands` brings the band and its caterpillar within half
a minute.

## Open threads

`OPEN-WORK.md` is the list. The headlines: nobody has listened to rounds 3b and
3c (every level was set by measurement); the drone as a waveform on the staff,
Deseret phoneme singing and the visions are approved and unbuilt; the house
choir and the house organ were retired on 2026-10-01; the caterpillar wants "a few more
passes"; the Hosanna and the far ward are the costly guests and no phone has
played the app.
