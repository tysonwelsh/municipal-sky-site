> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r2-engine-1 — the plumbing (Round 2, milestone 1)

*Crew: r2-engine. Branch `kolob-r2-engine`. 2026-09-27.*

**Branch-local version:** `v0.32-r2-engine.1 — the same music on a new clock:
every seed is a new meeting (the one-time re-base), a meeting plays the same
however late the browser's timers run, pause holds it exactly, and PLAY after
STOP no longer lets the stopped meeting's lines (or its echo) back in.`
VERSION is not bumped; the integrator assigns v0.34.

Nothing new is added musically. The engine is v0.32's music (the Question
shelved), re-seated on the Jukebox v2 substrate's dice and clock.

---

## What shipped

### a. One module list

- **`art/kolob/_engine.php`** (new) returns the ordered list:
  - the substrate, read-only: `pj2-rand.js`, `pj2-clock.js`, `pj2-fx.js`;
  - then `kolob-pitch`, `-melody`, `-harmony`, the six voices, `-guests`,
    `-meeting` and `-core`.
- It also defines `kolob_engine_tags($list, $versionFn)`, which prints the
  `<script>` tags and the **load guard**.
  - Each kolob room answers a roll call as its last act:
    `KOLOB._rooms["kolob-organ.js"] = true`.
  - The guard names every room that did not answer, plus any missing
    `PJ2.Rand`, `PJ2.Clock` or `PJ2.Fx`, or a missing facade. The error reads
    `KOLOB AUDIO ENGINE FAILED TO LOAD: …`.
- `index.php`, `room-lab.php` and `tune-lab.php` all `require` it. Nowhere else
  writes the list.
  - `index.php`'s fingerprint (`$kolob_assets`) now covers the whole list and
    `_engine.php` itself.
  - The page's separate `pj2-fx.js` tag is gone, because it is in the list.
- **The harness reads the same file.** Its module-list check fails if any of
  these goes wrong:
  - a listed room does not answer;
  - a `kolob-*.js` engine file on disk is missing from the list (the lab
    modules are exempt by name);
  - a module borrows an `S.x` function that no room lends;
  - the rooms throw when loaded twice.
- **Accessor lends are `configurable: true`** (all eleven: `F0`, `mode`,
  `ctx`, `droneDuck`, `roomBalanceHeld`, `roomRampNext`, `playing`,
  `forceVisitation`, `forceRaspberry`, `cumulativeMode`, `seasonPos`). The
  harness re-evaluates every room twice in a fresh `vm` context to prove it.
- **Stale pointers fixed:**
  - the bagpipe's "see SHELVED, top of file" now says "see SHELVED in
    kolob-core.js";
  - the headers of `room-lab.php` and `tune-lab.php` no longer name
    `kolob-audio.js`.

### b. Random streams (SCORE §3)

The global mulberry32 and all of `S.rng`, `rnd`, `rint`, `chance`, `pick` and
`pickW` are gone. `kolob-core.js` owns the visit's root stream,
`PJ2.Rand.stream(seed)`, and lends:

| call | stream | label |
|---|---|---|
| `S.stream(label)` | this meeting's stream | `label:<n>` |
| `S.turn(voice)` | one fork per acting turn | `<voice>:<n>` → `turn:<k>` |
| `S.wait(voice)` | the refusal delays: air taken, wrong section | `<voice>:wait:<n>` |
| `S.synth(voice)` | sound-level only, the whole visit long | `synth:<voice>` |
| `S.audition()` | everything `sample()` throws | `audition` |

**The labels as implemented** (please add them to SCORE §3; see Requests):

| label | what draws from it |
|---|---|
| `meeting:<n>` | the plan: the season, F0, the kind of Sunday, the mode, every section length, every mutation, every guest's die and seat, cumulative, raspberry. Each section entered forks `section:<i>` for its fuging-planned and sunrise dice. |
| `motif:<n>` | the day's temper, gestures and their seed perturbation (`Motif.newMeeting`) |
| `conductor:<n>` | 3 dice per 0.6 s tick, **always thrown**: the stillness after a gathering, the testimony silence, the unbidden silence |
| `joints:<n>` | forked `joint:<i>` per section ended: cadence kind, chord lengths, bells, the raspberry |
| `stillness:<n>`, `fuging:<n>` | turns: hold length, the tuning fork, the entries |
| `organ`, `drone`, `choir`, `clarinet`, `harmonium`, `strings`, `bells`, `voice`, `telegraph`, `field`, `bagpipe` (`:<n>`) | each voice's turns; the Motif, Prosody and Harmony draws made in a turn come from that turn |
| `choir:wait`, `clarinet:wait`, `bells:wait`, `telegraph:wait` (`:<n>`) | how long a refused voice waits |
| `guest:bands`, `guest:steeples`, `guest:oldtune`, `guest:cumulative`, `guest:question` (`:<n>`) | each guest |
| `synth:organ`, `choir`, `clarinet`, `harmonium`, `strings`, `bells`, `voice`, `telegraph`, `field`, `bagpipe`, `steeples`, `oldtune`, `noise` | detune, envelopes, onset stagger, pan, vibrato/tremolo/bellows rates, formant and filter colour, where a hiss starts on the noise tape |

- **The musical/sound-level rule** (written into core's THE DICE comment):
  - *musical* is anything the note or event streams report, or any pitch that
    sounds (which notes, when, how long, how high, which section, which
    guest; the clarinet's grace notes and the bell's pitch count);
  - *sound-level* is how a note sounds.
- **The rule is enforced, not just stated.** The harness re-salts every
  `synth:*` stream (`salt=`): the note and event streams stay byte-identical,
  and the sound fingerprint changes (see REPRO below).
- **Draw every die unconditionally:**
  - the plan draws three hymns' dice even on a one-hymn Sunday;
  - it throws every mutation and every guest's die, the Question's included,
    and the Ives switch's pick (a pre-drawn uniform read through
    `pickWith`);
  - the conductor throws its 3 dice every tick;
  - a section forks its own dice;
  - inside a voice, the per-turn fork does the job: however many dice a turn
    throws, the next turn is unmoved, and a refusal draws from the wait
    stream, not the turn.
- **The composers take the caller's stream.** Motif, Prosody and Harmony take
  it as the last argument:
  - Motif: `request`, `claim`, `develop`, `post`, `anyWorking`,
    `newMeeting`, `decompose`, and every TRANSFORM;
  - Prosody: `pourIntoLine`;
  - Harmony: `advance`, `voice`, `cadence`, `harmonize`. Its parameter is
    `D`, because `R` has always meant the ranges in that room.

  They no longer touch a global die.
- **`sample()` never disturbs the meeting.**
  - While it runs, every stream lookup returns the audition stream.
  - The organ's and choir's audition chord is voiced `{dry: true}`: it is
    voiced from the meeting's current chord but written nowhere, with no
    fifths counted and no harmony event.
- **Seeds and reseed.**
  - The seed still comes from `?seed=` or GATHER.
  - `reseed()` gives fresh dice and, when stopped, restarts the visit
    (`S.resetVisit`: meeting count and seasons). So **GATHER 1847 calls the
    same first meeting as `?seed=1847`**. v0.32 did not: its meeting count ran
    on.
  - STOP → PLAY still calls the next meeting (n+1), and that meeting is the
    same one you would have reached by playing through.

### c. The clock (SCORE §4)

- **`PJ2.Clock.create(ctx)`** is built in `init()`. Every cycle is a cue on a
  lane named for its layer, plus lanes for `conductor` and `guests`.
- **Three calls:**
  - `S.cueAt(lane, t, fn)`: at the scheduled time;
  - `S.cueIn(lane, dtS, fn)`: measured from the music's now;
  - `S.cueLayer(layer, baseS, fn)`: the layer's rate applied.
- **Every cycle is now `fn(t)`** and places its notes at the scheduled `t`.
  The helpers deep in the house read `S.now()`, the scheduled time of the cue
  now firing: `localArc`, `intensity`, `inHush`, `inFuging`, `inVisit`, the
  air, Motif ledger deadlines, and `emitEvent`'s `t`. Outside a cue (a button
  press) `S.now()` is the audio clock.
- **The downbeat** is one cue at `currentTime + 0.1`. Every other time in the
  meeting is counted from it.
- **Rates:** layer rate = lane rate (the slider × `LAYER_RATE_TRIM`). Moving
  it rescales that lane's waiting cues around the present, which is PJ2's own
  rescale. The harness `rate=organ:2` gives 73 organ notes where 48 was
  normal, and `0.5` gives 32.
- **Pause** fades and suspends as before, and the clock stands still with the
  suspended audio clock. **Resume** pumps the clock at once, instead of
  waiting on a timer a hidden tab may have slowed.
  - v0.32 held and re-armed timers on the performance clock, which drifted
    the music by the fade.
  - Now a paused meeting is the same meeting (tested).
- **STOP:**
  - `clock.stop()` cancels every pending cue;
  - **THE DOORS:** each meeting's voices enter the hall through doors of its
    own (the per-layer panner pools, the field gains, and a tabernacle send
    for the guests). STOP closes them, disconnecting them after the fade (or
    at once if PLAY comes first);
  - **FLUSH THE HALL:** PLAY after a STOP gives both rooms fresh wet chains
    on the same impulse, so the stopped meeting's reverberation cannot come
    back either.
  - This fixes the known bug: before, PLAY within ~30 s of STOP reopened the
    bus onto the old meeting's written-ahead choir lines and drones.
- **Transport-only timers kept** (three `setTimeout`s, all in core): the
  pause fade → suspend, the IR crossfade teardown, and STOP's 800 ms belt and
  braces (which now also disconnects the closed doors).

**The `currentTime` audit.**

- Every other engine module has **0** reads of `currentTime`: pitch, melody,
  harmony, the six voices, guests and meeting. (v0.32 had 3 in melody, 3 in
  organ, 2 in choir, 6 in winds, 3 in ground, 3 in field, 2 in bagpipe, 6 in
  guests and 14 in meeting.) None of those modules has a `setTimeout` or
  `Math.random` either.
- **All 40 remaining reads are in `kolob-core.js`, and none is a musical
  decision:**

| where | why |
|---|---|
| `init` (master, glue, compressor, layer gains, droneDuck), `makeRoom`/`wetChain`/`setRoomBuffer`/`setRoom`, `wideSend`, `panAt` pool, `fieldDest` panner, `applyLayerGain`/`applyFieldGain` | graph building: a node's fixed setting, applied at once |
| `play`: downbeat = `currentTime + LEAD_S`, bus/master/duck resets | the button press; the origin every musical time counts from |
| `pause`, `resume`, `stop`, `scheduleForStop` | transport fades |
| `audit` (sample) | an audition sounds when it is touched |
| `now()` fallback | outside a cue only |
| `setMasterVolume`, `getAudioTime`, `getConductor().visit` | the mixer, and the page's display clock |

**`Math.random`:**

- It appears only in `kolob-core.js`: the noise tape and the poured room
  impulses. This is texture, the zankyo rule, and each place is labelled.
- **The seed default** is still `Date.now()` when no seed is asked for.

### d. REPRO, and the statistics

All the checks below are silent: muted Chrome, or the harness.

**Harness, `node _harness.js repro 1500 1847 ives razz cumulative`:**
- The same seed twice: identical note and event streams.
- The same seed with the timers **jittered**: late pump wakes, plus a stall of
  0.3–1.4 s about once a minute. The streams are identical: 74 emissions from
  cues that fired late, the latest by 1.09 s.
- **The sound-level streams re-salted:** the score is identical and the sound
  fingerprint changes.
- The same passes at `repro 1200 5`.
- The same check on the v0.32 engine (`KOLOB_BASE=` a HEAD copy) **fails**:
  under jitter its meeting diverges by its seventh line (560 lines against
  622). The test has teeth.

**Muted headless Chrome, seeds 1847 and 5, three minutes of audio each:**
- Tab A is left alone.
- Tab B, while playing, has every stop on the rail auditioned (18 of them), a
  drawknob muted and unmuted, and a layer's volume and the master volume
  moved.
- Tab C is paused for 10 s at 40 s.
- Results:
  - A = B (with the auditions' own notes set aside);
  - C = A over the first 70 s;
  - while C was held its audio clock stood still (39.589 → 39.589) and
    nothing sounded.
- **Chrome = harness:** the first 3 minutes of seed 1847 (63 lines) and of
  seed 5 (60 lines) are identical, line for line (relative to the downbeat),
  between the browser and the Node harness.

**Transport, `node _harness.js transport 1847`:**
- **Pause:** a 30 s pause at 100 s gives the same meeting, and nothing is
  emitted while held.
- **STOP → PLAY on the audio graph:** stop at 150 s or 330 s, then play after
  0.3, 8 or 25 s. In every case none of the stopped meeting's written-ahead
  sources, and neither of its reverbs, still reaches the destination, and the
  new meeting's sources all do.
- **v0.32 fails the same check:** stopping at 330 s and playing after 0.3 s,
  52 of 52 stale sources and 2 of 2 rooms still reach the destination.
- **Real audio** (analyser on the master, muted Chrome, stop at 60 s, play
  after 8 s):
  - on v0.32 the stopped meeting's drone harmonics are 17–27 dB *louder* than
    the new meeting's;
  - on round 2 they are 60–100 dB below the new drone (window leakage only),
    and the same after a 1 s gap.

**The statistics against v0.32** (`node stats.js`, 1200 s runs):

- **6 seeds** (1847, 5, 9, 77, 4242, 12), as asked. The shifts beyond ±15 %
  are all counts of one or two events in six runs:
  - one raspberry (tuba) in v0.32 and none in round 2;
  - steeples 1→0, old tune 1→0;
  - cadence kinds: 0.100 → 0.050 authentic cadences a minute, i.e. 12 → 6 in
    six runs;
  - fuging 8 → 10;
  - parallel-fifth count 10 → 40 (one seed has 16);
  - bells −18 %, z −1.5.

  Everything else is within ±15 %: notes per minute per layer, section
  lengths, joints, voicings, verses, linings, stillnesses, answers, and the
  silence share (0.340 → 0.331).
- **So the same comparison was run on 100 seeds (101–200) and 400 seeds
  (1001–1400) per engine.**

| metric (400 seeds, 20 min) | v0.32 | round 2 | shift |
|---|---|---|---|
| notes/min: choir · clarinet · organ · bells | 16.17 · 8.61 · 2.71 · 2.33 | 16.04 · 8.65 · 2.74 · 2.33 | −0.8 % · +0.5 % · +0.9 % · 0.0 % |
| notes/min: all layers | 41.2 | 40.6 | −1.4 % |
| meetings started per run | 1.995 | 1.988 | −0.4 % |
| guests fired per run · drawn per run | 0.995 · 1.262 | 0.892 · 1.150 | −10.3 % · −8.9 % (z −1.7, −1.8) |
| cadences/min: plagal · authentic · half | 0.484 · 0.067 · 0.034 | 0.479 · 0.067 · 0.036 | −1.1 % · −1.3 % · +7 % |
| fuging · stillnesses · linings-out per run | 1.64 · 2.50 · 4.01 | 1.61 · 2.33 · 3.94 | −2 % · −7 % · −2 % |
| silence share: no melodic voice · drone + field alone | 0.331 · 0.098 | 0.330 · 0.098 | −0.4 % · −0.7 % |
| section lengths (planned s): prelude · invocation · hymn · testimony · sacrament · doxology · postlude | 74.8 · 79.5 · 150.5 · 134.0 · 125.6 · 88.8 · 54.6 | 75.7 · 79.8 · 149.1 · 133.1 · 123.0 · 88.5 · 55.0 | all within 2 % |

- **The only metric past ±15 % is "old tune fired", −18 % (z −1.5).**
  - On 100 seeds it was +3.7 %.
  - The draw rate per meeting (995 meetings each) matches the plan's
    probabilities in both engines:

| guest | expected | v0.32 | round 2 |
|---|---|---|---|
| bands | 0.36 | 0.389 | 0.359 |
| steeples | 0.075 | 0.066 | 0.080 |
| old tune (the pool is never empty) | ≈ 0.15 | 0.159 | 0.146 |
| withheld tune | 0.08 | 0.070 | 0.081 |

  - The mode and kind-of-Sunday mixes also match. It is sampling noise.
- **Harness verdicts:**
  - 100 of 100 seeds pass at 1200 s, and all standard runs pass: 1500/1847
    with and without ives/razz/cumulative, 2700/1847, 900/5, 900/9, and
    1500/3, 5, 9, 12 forced. Three of them print a chance-event NOTE (see
    Harness changes).
  - The monzo helpers pass.
  - Pitch adherence is 100 % on every run checked (the 100 seeds and the
    standard runs).

---

## Harness changes (`art/kolob/_harness.js`, untracked, gitignored; the integrator copies it)

- **Loads `_engine.php`'s list** (or `KOLOB_BASE=<dir>` for another build: its
  `_engine.php`, or the v0.32 list).
  - `window` is now the global object, as in a browser, because the substrate
    writes the bare `PJ2`.
  - `window.performance` is set (the wave-1 quirk).
- **The mock AudioContext:**
  - it has its own **audio clock**, which stands still while suspended, and
    `suspend`/`resume` answer synchronously;
  - it keeps a record of the **graph**: `connect(param)` counts as the param's
    node, and `disconnect(dest)` cuts only that wire;
  - it keeps a **sound fingerprint**: a hash of every automation value.
- **Virtual `setInterval` for the clock's pump**, and `jitter` for late wakes
  and stalls.
- **The dump records the music's time** (`S.now()`), not the wall clock, and
  only for `mt < RUN`. The run goes until the audio clock passes RUN + 3 s.
- **New modes and flags:**
  - `repro [secs] [seed] [flags]`;
  - `transport [seed]`;
  - flags `salt=`, `jitter`, `pauseat=t:len`, `stopat=`, `playgap=`,
    `rate=layer:x[@t]`.
- **A printed line:** `timers: N emissions from cues that fired after their
  time (latest by X s) · sound fingerprint …`.
- **The module-list check** (see a).
- **Two verdicts are now long-run only:** "no parallel fifths" and "no
  stillness", like the fuging and the lining-out.
  - They are chance events. Measured over 100 seeds at 1200 s: 16 % and 7 % of
    v0.32's runs, 11 % and 8 % of round 2's. At 2700 s: 2 % and 1 % for
    v0.32, none for round 2.
  - A shorter run that misses one prints a `NOTE`. It still fails at
    ≥ 2600 s.
- **Where things are:**
  - a copy of the harness is at `/private/tmp/claude-501/…/scratchpad/r2e/`;
  - the Chrome drivers are in the same folder: `cdp.js` (port 9421, always
    `--mute-audio`), `chrome-repro.js`, `chrome-stopplay.js`, `chrome-ui.js`,
    `chrome-jump.js`, `pages.js`, `norm.js`, `stats.js`, `draws.js`.

## How to hear or see it

- Serve the worktree:
  `php -S 127.0.0.1:8111 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r2-engine`
  (I have stopped my servers).
- **What to listen for:**
  - **Seeds.** Each seed now calls a different meeting than it did in v0.32:
    - `?seed=1847`: ionian, a fast Sunday;
    - `?seed=77`: penta, ordinary. The tune is withheld; a band crosses at
      3:29; fuging at 4:29 and 7:11; the whole tune arrives at 13:02;
    - `?seed=9`: penta, conference, three hymns.
  - **STOP during a hymn, then PLAY within a few seconds.** The new meeting
    starts in a silent hall: no old choir lines, no old drone, no old echo.
  - **Pause for as long as you like.** The meeting resumes exactly where it
    stood.
  - **GATHER with `1847`** gives the same meeting as loading `?seed=1847`.
- **Dev jump** (Latin mode, click a wheel seat), the Ives switch, the Whole
  pill, volumes, drawknobs and auditions all work as before. Each was checked
  in muted Chrome with a clean console.
- **Console:** clean on `index.php`, `room-lab.php`, `tune-lab.php`,
  `bagpipe-lab`, `question-lab`, `voices-lab`, `instruments-lab` and
  `earth-tunes-lab`. Room-lab's auditions, A/B, play, skip, room slider and
  stop were exercised; so was tune-lab.

## Requests to the integrator

1. **SCORE §3: adopt the label table above.**
   - Its `field` and `joints` carry `:<n>` here, like every per-meeting
     stream.
   - Add `motif`, `conductor`, `stillness`, `fuging`, the voice turns
     (`<voice>:<n>` → `turn:<k>`), `<voice>:wait:<n>`, `audition`, and the
     `section:<i>` / `joint:<i>` sub-forks.
   - State the musical/sound-level rule as written in core's THE DICE.
2. **SCORE §4: add a line.** Never use PJ2's `lane.in()` or `lane.every()`
   in musical code; both measure from `ctx.currentTime`. Use `S.cueIn` /
   `S.cueAt`, which measure from the scheduled now.
3. **SCORE §1:** the load order is `_engine.php`. New engine modules are
   added there, and only there.
4. **`tune-lab.js:188`** (not mine) still says "load kolob-audio.js first".
   Please change it to "the engine (see _engine.php)". The headers of
   `room-lab.js` and `bagpipe-lab.js` also name `kolob-audio.js`.
5. **Merge recipe:** copy this worktree's `_harness.js` into `kolob-2` and
   main. It needs `_engine.php`, and the old harness cannot load the new
   engine.

## Known issues and notes for the next milestones

- **Headless Chrome only; the same on v0.32.** After a pause and resume, a
  *visible* headless tab's audio clock falls to about 0.12–0.18× real time
  after ~30 s.
  - v0.32 measured on :8112 does exactly the same, so it is not this branch.
  - It looks like Chrome's handling of a suspended-then-resumed context whose
    only sink is a MediaStream `<audio>` element (background-audio.js).
  - The meeting stays correct, because everything keys off the audio clock;
    only the wall time stretches.
  - Worth one real-browser pause/resume listen by the owner.
- **The composers are still not pure** (second look, "dependency graph").
  They take streams now and read the music's now instead of the audio clock,
  but they still read `S.C` and the other rooms' state. The "moment object"
  refactor and freezing `C` are for the HYMN/FORM work.
- **`commaOf`'s inverted-7 case** (second look, minor) is untouched: out of
  M1's scope, and the engine does not call it.
- **Shelved paths were exercised** in a scratch copy, not on the branch: the
  bagpipe unshelved (126 notes in 1500 s), and the Question unshelved (4
  Questions over 8 seeds, every one ending unanswered). Both run with no
  errors.
- **The per-turn forks mean** a voice's n-th turn draws the same dice whatever
  happened before it in that meeting. What it *plays* still depends on shared
  state: the section, the air, the harmony and the motif ledger.
