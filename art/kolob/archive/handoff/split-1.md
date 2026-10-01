> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# split-1: the module split (Phase 0a)

*Crew: split. Branch `kolob-split`. 2026-09-26.*

## What shipped

`kolob-audio.js` (3,909 lines) is gone. It is now twelve modules, loaded in
the SCORE.md §1 order:

| # | file | what moved there |
|---|---|---|
| 1 | `kolob-pitch.js` | TUNING: F0, `COLLECTIONS`, `projDeg`, `degFreq`, `colN`, SCALE, `harm`, gravity. **New:** the SCORE §2 monzo helpers `ratio`, `mul`, `div`, `fromFraction`, `cents`, `octaveReduce`, `degMonzo`, `commaOf`, and `MODE_MONZOS` (the six modes as exact fractions). All pure; nothing in the engine calls them yet. |
| 2 | `kolob-melody.js` | METERS, Prosody, the Motif engine (GESTURES, dialects, TRANSFORMS, genealogy, ledger) |
| 3 | `kolob-harmony.js` | the Harmony engine |
| 4 | `kolob-voices-organ.js` | organChord, organCycle |
| 5 | `kolob-voices-choir.js` | the choir, plus the fuging entry |
| 6 | `kolob-voices-winds.js` | clarinet, harmonium |
| 7 | `kolob-voices-ground.js` | tuba (raspberry only), drone, strings, bells and tines |
| 8 | `kolob-voices-field.js` | the still small voice, the telegraph, the valley's field events |
| 9 | `kolob-voices-bagpipe.js` | the bagpipe (SHELVED, still never scheduled) |
| 10 | `kolob-guests.js` | razzCluster, cumulative assembly, the unanswered question, two bands, the steeples, the old tune |
| 11 | `kolob-meeting.js` | MEETINGS, C, planMeeting, sections, intensity, conductorTick, stillness, runJoint |
| 12 | `kolob-core.js` | context, master chain, rooms, layers, params, field gains, listeners, timers, the air, the seeded die, sample, transport, and the `window.KolobAudio` facade |

**API.** The facade is **unchanged**. `kolob-core.js` still builds
`window.KolobAudio = (function () { … return { … }; })()`, and the return
object is byte-for-byte the v0.30 one.

**How the rooms share state.** Everything shared lives on `KOLOB._s` (`S`
in every file):
- Each module lends what others need in a **LENT** block: at the foot of the
  file, or above PUBLIC API in core.
  - Functions and never-reassigned objects are lent as plain properties.
  - Reassigned variables (`ctx`, `F0`, `mode`, `playing`, `seasonPos`, …)
    are lent as getter/setter pairs over the owner's own `var`.
- The other rooms' **functions** are borrowed as one-line forwarders in a
  **BORROWED** block at the top of each file, so the moved code keeps its
  bare names. For example:

  ```js
  function rnd(a, b) { return S.rnd(a, b); }
  ```

- The other rooms' **variables** are written `S.x` in place: `S.ctx`, `S.C`,
  `S.F0`, `S.Harmony`, `S.Motif`, …

The rule for a reader: a bare name is this room's own or a borrowed function;
`S.x` is someone else's variable. Each module also registers a small public
face: `KOLOB.Pitch`, `KOLOB.Melody`, `KOLOB.Harmony`, `KOLOB.Meeting`,
`KOLOB.Guests`.

**The split was done by a tool, not by hand.**
- An acorn + eslint-scope pass resolved every identifier that referred to the
  old IIFE's top-level scope. Only references that cross a module boundary
  were rewritten, and the only rewrite is adding an `S.` prefix.
- **Every one of v0.30's 3,909 lines appears verbatim** in the modules,
  modulo that `S.` prefix, checked as a multiset, so every comment travels
  with its code.
- Two segments moved within their new file:
  - the SECTION JOINTS banner now sits directly above `runJoint` in
    `kolob-meeting.js`;
  - `razzCluster` lives in guests.
- Comments that say "top of file" or "in this file" still read as they did
  in v0.30 (e.g. "see SHELVED, top of file" in the bagpipe module; SHELVED is
  in `kolob-core.js`).
- The tool is in `/private/tmp/claude-501/kolob-split/`
  (`analyze.js`, `split.js`, `gen.js`) and can be re-run: `node gen.js v030.js out`.

**The RNG is untouched.** It is still one global mulberry32 in core. Every
draw happens in the same order; the stream proof below shows it.

**Pages and labs.**
- `index.php`: the new `$kolob_engine` array lists the modules in order and
  drives both the `<script>` tags and `$kolob_assets`, so the footer
  fingerprint covers every module.
- `room-lab.php` and `tune-lab.php`: load the same list in place of
  `kolob-audio.js`.
- `bagpipe-lab.php`: never loaded the engine, so it is unchanged.

**No VERSION bump.** This is an invisible refactor.

## How it was verified

**1. Harness, stream sameness.** `node _harness.js <secs> <seed> [ives razz cumulative] dump=<file>`
against v0.30 (`KOLOB_LEGACY=v030.js`, taken from
`git show kolob-2:art/kolob/kolob-audio.js`). The full onNote and onEvent
streams (every field, as JSON lines) were compared.

| run | flags off | flags on (ives, razz, cumulative) |
|---|---|---|
| seeds 1847, 5, 9 at 900 s | byte-identical | byte-identical |
| seeds 1847, 5, 9 at 1500 s | byte-identical | byte-identical |

- The flags-on runs exercised bands, questions, the old tune, the raspberry
  and the cumulative assembly.
- An extra sweep of seeds 1–12 (flags on, 1500 s) was also identical,
  including four seeds with the steeples.
- Seed 1847 at 2,700 s (the fuging and lining-out checks) was identical.

**2. Harness verdicts.** All PASS, with two exceptions that are the same in
v0.30 and in the split, because the streams are identical:
- `5 @1500 s`, flags off: "no parallel fifths";
- `1 @1500 s`, flags on: "no stillness".

**3. Browser smoke test** (port 8101, headless Chrome over CDP, `smoke.js` in
the scratch dir):
- **Console:** zero errors or warnings on `index.php?seed=1847`,
  `tune-lab.php`, `room-lab.php` and `bagpipe-lab.php`.
- **PLAY on index:** the clock runs, notes are emitted (drone, organ) along
  with the events, and an analyser on the master reads a non-silent signal.
- **Transport:** pause holds the clock, resume restarts it, and stop and
  `sample('organ')` work.
- **Labs:** tune-lab renders its seven old tunes; room-lab's `getRooms()`
  answers.

To hear it, run `php -S 127.0.0.1:8101 -t <worktree>` and open
http://127.0.0.1:8101/art/kolob/?seed=1847. It should sound exactly like
v0.30 with the same seed.

## Harness changes (`_harness.js`, untracked; a copy is at `/private/tmp/claude-501/kolob-split/harness-adapted.js`)

1. **Loader.** It evals the twelve modules in SCORE order, or one legacy
   file if `KOLOB_LEGACY=<path>` is set.
2. **`dump=<file>`.** Writes the full note and event streams as JSON lines,
   `["N"|"E", vnow, payload]`.
3. **Monzo check.** A short check of the new helpers:
   - the SCORE examples;
   - `MODE_MONZOS` against the float `COLLECTIONS`;
   - `commaOf(10/9 vs 9/8)` = syntonic −1;
   - `commaOf(7/4 vs 9/5)` = septimal.

Everything else is untouched.

## Requests to the integrator

- **`commaOf(m, spelled)` semantics** are my reading of SCORE §2, which
  names the signature but not what "spelled" is:
  - "spelled" is the monzo of the unmarked (Johnston) pitch the note is
    written as;
  - the 7 mark = 36/35 down;
  - ± = 81/80;
  - any other remainder rounds to the nearest whole comma, clamped.

  Please confirm, or amend the contract.
- **Load order:** within step 4 of SCORE §1 the voices load as
  `organ, choir, winds, ground, field, bagpipe`, which the contract leaves
  open. It doesn't matter at load time, because every cross-room call binds
  late.
- **Substrate:** `pj2-rand.js` and `pj2-clock.js` are not loaded yet. That
  belongs to the next wave (0b).

## Known issues and notes for the next wave

- **Not yet pure.** `kolob-melody.js` and `kolob-harmony.js` still read
  `S.ctx`, `S.C` and `emitEvent`, and draw from the global die, just as
  they did inside the old file. Making them pure (streams, no ctx) is the
  0b wave.
- **Stale references to `kolob-audio.js`.** Comments and one error message
  still name it:
  - `tune-lab.js:188` (the message);
  - the headers of `bagpipe-lab.js` and `room-lab.js`;
  - PLAN docs and pj2 comments.

  All harmless; they can be updated when those files are next touched.
