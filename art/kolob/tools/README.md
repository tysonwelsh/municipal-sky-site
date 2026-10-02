# KOLOB — the measurement tools

*What `art/kolob/tools/` holds, how each tool is run and how to read what it
writes. Written 2026-10-01 at v0.36.2; keep it true when the tools change.
The owner's rules that bind these tools are in `art/kolob/README.md`.*

Twelve tools, all plain Node (22 or later: the browser tools use Node's own
WebSocket) with no packages, except `samecode.js` and the wrapper check of
`lends.js`, which need the `acorn` that `npm install` at the repo root brings
with ESLint. Three read the engine's
source and nothing else; one runs its pure core headless; three read only the
harness's dump, so they keep working when the engine changes; one reads the
harness's cost sidecars; two drive a **muted** headless Chrome.

| tool | answers | reads | time |
|---|---|---|---|
| `loadcheck.js` | Does the engine load, does every room answer, does the facade carry what the page calls, does one hymn proofread? Does the page's drawing load in its order, and draw? Does every lab load its rooms in its own order? | the source, headless | ~2 s |
| `lends.js` | Does every `S.name` a room reads have a lend somewhere on the shared bag, and every `VS.name` the page's files read on theirs? Is every BORROWED wrapper exact? | the source | <1 s |
| `samecode.js` | Did an edit touch only comments and whitespace? Did a file cut into pieces move its code and change none (`--split`)? | the source, in git and in the worktree | ~1 s |
| `golden.js` | Does the pure core — the plan of meeting 1, the hymns, the guests' decisions, the organist, the ward — compose what it composed (`tools/golden/*.json`)? | the engine, headless, no audio | ~16 s for 40 seeds on 4 cores |
| `distinctness.js` | Do two random seeds sound clearly different within three minutes? (design law 2) | the dump | ~2 s for 20 seeds |
| `repetition.js` | How often does a meeting say the same thing twice, and which shapes turn up in every meeting? | the dump | ~2 s for 20 meetings |
| `tally.js` | What is a meeting made of (cadences, guests, sections, notes per layer)? Did a change move it (A/B)? | the dump | ~2 s per 20 seeds read; A/B of 20 seeds at 1200 s, rendered four at a time, ~70 s |
| `cost.js` | What does the audio graph cost, work by work (a lane, a guest, a press), and did a change move it (A/B)? | the harness's cost sidecars | ~20 s for two builds, four seeds each |
| `screens.js` | What does the staff look like at 860 and 390 px, and what does a frame cost at 4× CPU throttling? | the page, muted | real time: ~2.5 min per width |
| `capture.js` | What does a seeded meeting sound like, as a WAV, a spectrogram, loudness (LUFS) and peak? | the page, muted | real time: 4 min for a 4-min window |
| `render.js` | Renders a dump set to keep, or to read twice. | the harness | ~1 s per seed |
| `selftest.js` | Do the instruments still read true? | the harness plus synthetic dumps and signals | ~35 s |

Every report opens with what it measured: the engine, its VERSION, its git
commit, a fingerprint of the module bytes the harness was *seen* to play (see
"Which build is measured"), the seconds per seed, the flags and the harness.
Reports, dumps, PNGs and WAVs go to `tools/out/<tool>-<stamp>/` unless you pass
`--out <dir>`. **`tools/out/` is gitignored** (`tools/.gitignore`) and
`out/_builds/` holds whole unpacked git trees, so a grep over `art/kolob` must
exclude it (`grep -r --exclude-dir=out …`).

```sh
cd art/kolob
node tools/loadcheck.js                          # the engine loads; the roll call; one hymn proofread; the labs' lists load
node tools/lends.js                              # every S.x read has a lend; every BORROWED wrapper exact
node tools/samecode.js                           # HEAD against the worktree: code unchanged?
node tools/samecode.js --split kolob-viz.js --ref <ref>   # the page cut into its six files: every statement moved whole
node _harness.js 600 22 staff                    # the meeting, and everything the page draws of it, traced (a digest)
node tools/golden.js                             # the pure core composes what it composed (seeds 1–40, seconds)
node tools/selftest.js                           # the instruments, checked (seconds)
node tools/distinctness.js                       # 20 seeds, first 180 s → out/distinctness-…/report.md
node tools/repetition.js                         # 20 seeds, 1200 s, every complete meeting
node tools/tally.js                              # the same, counted
node tools/tally.js --a git:main --b worktree --seeds 1-20   # did my change move the music?
node _harness.js 1200 22 cost                    # what the audio graph cost, charged to the work that did it
node tools/cost.js --a git:HEAD --b worktree     # …before and after, work by work (seeds 3, 7, 22, 37)
node tools/screens.js --seed 1847                # staff at 20/60/120 s, 860 + 390 px, frames at 4×
node tools/screens.js --seed 22 --freeze         # the same, frame-exact: two runs compare by pixel (AE 0)
node tools/capture.js --seed 1847 --to 240       # four minutes, recorded
```

CI (`.github/workflows/kolob-check.yml`) runs lint, `loadcheck`, `lends`,
`golden`, the harness and `selftest`. `tally.js --a git:main --b worktree` is
the standard "did my change move the music" check: a housekeeping change must
leave every seed byte for byte the same; a musical change should move only what
it meant to. `golden.js` answers the same question for the pure core in
seconds, and nothing else.

## Silence: the owner's rule

**Every browser these tools launch is muted.** `lib/chrome.js` starts Chrome
with `--headless=new --mute-audio --autoplay-policy=no-user-gesture-required`,
the debugging port 9423 and a profile under `os.tmpdir()`
(`<tmp>/kolob-r2-tools-chrome`); `launch()` refuses to start a Chrome without
`--mute-audio`, and each report prints the flags it ran with. The binary is
`KOLOB_CHROME` if set, else the first found of the Mac path, a Playwright
chromium under `PLAYWRIGHT_BROWSERS_PATH`, or the distro's; running as root
(CI, a container) adds `--no-sandbox`.

- The capture tap sits inside the page, so it hears the signal while the
  speakers hear nothing. The page's analytics and newsletter endpoints are
  blocked, so test visits are not counted.
- The tools start their own `php -S 127.0.0.1:8113`, or reuse one already
  running, but only if its `kolob-core.js` is byte-identical to this tree's.
  Chrome and the server are killed on exit, including on Ctrl-C.
- **Two runs at once** need two ports: `--chrome-port 9424 --port 8114`. The
  profile follows the port (`…-9424`), or name one with `--profile <dir>`; a
  Chrome whose profile another Chrome holds would hand itself to the first
  and quit, so `launch()` refuses one and names the holder. A run that reuses
  another's `php -S` loses it when that run ends, hence the second `--port`.
  (The `--profile` line in `screens.js`'s and `capture.js`'s `--help` still
  prints an old Mac path; the code uses `os.tmpdir()`.)

## Which build is measured

The three dump tools render through the harness, `art/kolob/_harness.js`
(see "The harness"). They can point it at any build:

| `--engine` (or `--a` / `--b` in tally) | what is rendered |
|---|---|
| *(default)*, `worktree` | this worktree's `art/kolob` |
| `<dir>` | any directory with `kolob-core.js`, or the single-file `kolob-audio.js` of a build before 2026-09-26 |
| `git:<ref>` | a build out of git (`git archive <ref> art/kolob 'art/prosperos-jukebox-v2/*.js'`, unpacked into `out/_builds/<sha>/`), for example `git:main`, the live v0.36.x split build |
| `--dumps <dir>` | a dump set already rendered (by `render.js`, or anyone's `dump=` runs) |

**The harness used** is `--harness <file>` if you give one; otherwise the
engine directory's own `_harness.js`, or this worktree's for a `git:` build.
The tools point it at the build with `KOLOB_BASE` and `KOLOB_DIR` alike (two
names for one thing; the harness reads either), and load a single-file build
with `KOLOB_LEGACY` — which matters only for `git:` refs before 2026-09-26,
when `kolob-audio.js` was split into the module family. Nothing is ever
written into an engine directory.

**The harness is not taken at its word.** A harness that ignores where it is
pointed plays its own directory's engine, and an A/B then reports "nothing
moved" when everything did. So every render runs with `lib/witness.js`
preloaded (`node -r`): it stands by `fs.readFileSync` and writes down every
engine file the harness reads (`kolob-*.js`, the substrate's `pj2-*.js`), where
it lay and a hash of its bytes (`seed-N.witness.json` beside each dump). Before
a single number is computed, `lib/run.js` holds that record against the build
it meant — its list is `_engine.php` (the one list since 2026-09-29), else
`index.php`'s `$kolob_engine` (the split builds of 2026-09-26 to -29), else the
single file — and **refuses the set** when a module came from another directory
(or a substrate script from another substrate), when a listed module went
unread or an unlisted one was read, when the bytes are not the list's, changed
during the render or differ between seeds, when no engine file was seen at all,
or when the dump header's `engine` field disagrees with the witness:

```
tally.js: harness failed for seed-3 — deaf-harness.js did not play the build it was pointed at (worktree, art/kolob):
  - 12 of the files it played (kolob-pitch.js, kolob-melody.js, kolob-harmony.js and 9 more) came from art/kolob, not from …
  A harness must load from KOLOB_BASE or KOLOB_DIR (the tools set both) and play the build's own list; pass --harness <file> to use one that does.
```

"Read the build's files but not its bytes" or "changed while it was being
rendered" is what you see when someone is editing the engine while a tool
renders it: render again when the tree is still. The fingerprint in every
report is the witnessed one: SHA-1 over the files played, in name order, each
its name then its bytes, first ten hex digits; a lab module the build does not
play does not move it. If the harness cannot load a build at all, the tool
stops with the harness's `LOAD` error.

## The harness

```sh
node _harness.js <secs> <seed> [ives] [razz] [cumulative[=<mode>]] [force=<guest>] [exp=<spec>]
                 [stop=<secs>,…] [play=<secs>,…] [reseed=<seed>@<secs>,…]
                 [throw=<lane>@<secs>,…] [badlistener=note|event] [desk=<secs>]
                 [staff[=860|390]] [cost[=<file>]] [dump=<file>] [header]
```

`art/kolob/_harness.js` (tracked since 2026-10-01) mocks `window` and Web Audio
with nodes that only record what was done to them, drives a virtual clock
through a queue of fake timers, and evaluates the real engine sources
unmodified — `_engine.php`'s list, in order, the substrate first. Nothing in it
makes a sound. It plays until the clock passes `<secs>` + 3, presses STOP (so
the stop fade is exercised), prints a report (meetings, sections, notes by
layer, events by type, guests, the clock's health, the hymnal's desk, the graph
built, warnings, errors) and ends with `VERDICT: PASS ✓` or `FAIL ✗`; exit 1 on
any caught error or a late cue; a module that fails to load prints
`LOAD <file>: <error>` and no dump is written. The switches: `ives` /
`force=<guest>` (`setForceVisitation(true)` / one named guest), `razz`
(`setForceRaspberry(true)`), `cumulative` (`setCumulativeMode("always")`;
`cumulative=never`, `=natural` or `=always` sets that mode),
`exp=<spec>` (as `?exp=` takes it: `-name`, `+name`, `none`, `all`),
`dump=<file>` (the note and event streams) and `header` (with `dump=`: a first
line naming the run and the engine — the tools and CI always pass it; a plain
`dump=` stays byte-identical to a headerless one). `KOLOB_BASE` or `KOLOB_DIR`
names the engine directory (default: the harness's own); `KOLOB_LEGACY=<file>`
loads a single-file build instead, best effort. Every module is read with
`fs.readFileSync`, so the witness sees exactly which bytes were played; the
same arguments on the same build give a byte-identical dump (CI checks it).

**The accounting.** The `clock:` line counts, apart, the engine's timers still
armed after the last STOP (a `setTimeout`, `setInterval`,
`requestAnimationFrame` or `requestIdleCallback` still waiting would be a
leak; there is none today) and the sources scheduled past the run's end — the
mock's `onended` for a node whose `stop()` lies beyond it, the drone partials
and the voices written ahead (seed 7 at 300 s: 101, due 305–325 s), not a leak.
`console.warn` counts the warnings other than the refused fetch's (the harness
has no network, so a room keeps the impulse response it poured — expected) and
prints each on its own line. None of the three moves the verdict.

**A scripted transport.** `stop=<secs>` presses STOP and `play=<secs>` PLAY at
that time on the audio clock (the dump's timeline): `stop=120 play=121` is a
stop and a quick restart. Each takes a comma list or comes again
(`stop=120,400 play=121,402`); at one time a stop goes first; a time at or past
`<secs>` is not played, and the report says so. The script is printed on the
report's first line (`script stop@120 play@121`), the dump's `transport` events
fall at its times, and the run's end still presses STOP. Through `render.js`,
whose `--flags` splits on commas, give each time its own switch
(`--flags stop=120,play=121`). `reseed=<seed>@<secs>` changes the seed at that
time as GATHER does (a new visit), between a stop and a play at the same time:
`stop=90 reseed=7@90 play=90.5` is a STOP, a new seed and its first meeting; the
report prints a line for it with the drone's note before and after (seed 1:
`×1.25 third (cantus 0) → ×1 tonic`, PLAN-REFACTOR §2.2). The `meetings:` line
marks a meeting called inside a stillness's hold `hushed at its downbeat` (the
conductor begins no guest, fuging or other stillness until the hold ends). A
STOP ends the hold; a joint does not, so a stillness late in a postlude may
hold into the next meeting's first seconds (on a plain run, none of 284
meetings over 80 seeds began so).

**The presses' timers.** With a script, a `presses:` line follows the `clock:`
line: every press (the first PLAY at 0, each `stop=`, `play=` and `reseed=`,
and the run's last STOP), and what became of each `setTimeout` the engine
armed inside one — cleared (and by which press), fired, or still armed. A timer
that fired after a later press is told on a line of its own with what it did
then (the nodes it disconnected, the automation calls it made, the nodes it
built), and so is every other that touched the graph (a STOP's, disconnecting
its doors); a timer cleared by a later press is told too. A press's timer that
outlives the next press acts on that press's meeting: before PLAN-REFACTOR
§2.3, seed 22, `stop=120 play=120.3 stop=120.5` printed `stop@120's 800 ms
timer fired at 120.800 s, after play@120.3, stop@120.5: 3 node(s)
disconnected, 12 automation call(s)` — the second STOP's doors (its meeting's
drone) cut 0.3 s into its 0.6 s fade; now `stop@120's 800 ms timer cleared by
play@120.3`, and the second STOP's own timer disconnects them at 121.3 s.
With a script (or `desk=`), the `hymnal:` line also counts the hymns written
while the transport stood stopped (from a STOP of a playing meeting to the
next PLAY, or to the run's end) and the orders never written.

**A paced desk.** `desk=<secs>` paces the hymnal's idle road (the harness has
no Worker, so the hymns are written there): each slice — one hymn written on
the main thread — comes `<secs>` after the one before, as a browser's comes
after the hymn before it took that long. Without it the harness's clock stands
still while a hymn is written, so a meeting's book is written at the instant
it is ordered and no press can find the desk at work. The slices are known by
their function's name (`idleSlice`, `kolob-hymnal.js`); the `hymnal:` line
says how many were paced. Pacing moves no record (seed 7, 110 s: the plain
run's dump). Seed 7, `desk=0.5 stop=0.7`: before PLAN-REFACTOR §2.3 the desk
wrote the stopped meeting's last two hymns while stopped; now it writes none
and leaves them unwritten, a PLAY at 1 s passes them over for the next
meeting's, and a GATHER of the same seed between (`reseed=7@0.7`) writes them
for the meeting it calls again.

**A fault injection.** `throw=<lane>@<secs>` makes the first cue on that clock
lane (`conductor`, `drone`, `choir`, `organ`, `ward`, …) at or after that time
throw an `Error`, once; a comma list for several (`throw=drone@120,choir@200`).
The harness wraps `PJ2.Clock.create` after the substrate loads (the substrate
is not touched) and watches every lane's `at`/`in`/`every`; the cue throws from
inside its own callback — the moment it schedules on its own lane (a layer's
and the conductor's re-arm, the last thing they do), or, if it schedules
nothing there, as it returns — so a `try/finally` in the engine sees the throw.
The clock reports it (`console.error`), and the report files it with its
injection, not among the run's errors. The report prints the cues counted lane
by lane (which add up to the clock's own count) and, for each throw, when it
fired, who reported it, how many cues its lane ran after it and how many
sections the meeting began after it — the proof of PLAN-REFACTOR §2.1. Seed 7,
600 s: `throw=drone@120` fires at 134.6 s and the core's net re-arms the drone
5 s later (8 cues after it); `throw=conductor@300` fires at 300.5 s, the next
tick is armed 0.6 s on, and the meeting is the clean one, record for record;
`throw=choir@212.5` breaks a hymn's chain of lines, the hymn is let go, and the
meeting begins its next hymn at 349.4 s (1,643 notes where the clean run plays
2,573: the rest of that hymn is not sung; before §2.1 the hymn never ended and
the meeting stayed in it, 972 notes); `throw=ward@200` and
`throw=organist@200` fire at 200.05 s, each pump's next tick is armed at its
own pace (0.12 s, 0.2 s), and the dump and the graph are the clean run's
(before, the ward's pump stopped — the graph 19,989 nodes where the clean run
builds 29,537, its notes told all the same — and the organist's, 1,963 notes
for 2,573). Without `throw=` nothing is wrapped.

**A bad listener.** `badlistener=note` (or `event`, or `note,event`) registers,
after the harness's own, a note (event) listener with a bug in it: it throws at
every note (event) it is handed, as a fault in the staff or the minutes would.
The engine passes it over and tells its fault (`kolob-core.js`, THE FAULTS:
`console.error("Kolob: the note listener 2 threw (on a note of the organ)", err)`
the first time, then at every thousandth with its count); each `console.error`
that carries its throw is filed with it, not among the run's errors, and a line
says how many it threw and how many the engine told, with the first line told.
The dump is the clean run's. Seed 7, 300 s: 1,755 notes thrown at and 2 told
(the first and the thousandth), 91 events and 1 told; before PLAN-REFACTOR §2.4
the engine told none of them — an empty catch around every listener.

**The page's drawing (`staff=`, PLAN-REFACTOR §3.5).** `staff` (or
`staff=860`; `staff=390`, a phone) plays the page's drawing along with the
meeting: the files on `_viz.php`'s list (`kolob-viz.js` alone in a build older
than the list) evaluated after the engine, as the page's tags load them, on
canvases that record instead of painting (`lib/canvas.js`: every call on a 2D
context, a `Path2D` or a gradient and every setting, in order, folded into one
SHA-1; numbers in full; a setting reads back what was set, `measureText` 7 px a
character, `getImageData` blank). The plates are the size the page lays them out
at (860 px: the staff 687 × 240 CSS px and the wheel 687 × 200 at DPR 2; 390 px:
316 × 196 and 316 × 150 at DPR 3); `KolobViz.init` before PLAY, as the page's
load calls it; the console's poll (`setConductor` with the conductor, playing,
held) every 300 ms; a frame every 1/60 s of the virtual clock. The mock's
analyser hears nothing, so the organ facade stands at rest. The report's
`staff:` line gives the frames, the canvas calls, the canvases and paths made,
the digest of everything drawn (16 hex) and its digest minute by minute, so two
builds of the page fed the same meeting are held to the same drawing, every
stroke of every frame: `KOLOB_DIR=<the other build> node _harness.js 600 22
staff` for the other side (the engine is read from there too). Seed 22, 60 s:
3,796 frames, 5,686,403 calls, digest `8c18ec81a4ba069c`, the same twice, and
the same on the page before and after it was cut into six files; with the ink
one step bluer, another. About 20 s of the machine for a minute of meeting at
860 px.

**The cost (`cost`, PLAN-REFACTOR §4.0(b)).** `cost` charges every node the
mock builds, every automation call and every disconnect to the work that did
it, so a change to the audio graph is stated in numbers, before and after.
The work is the clock lane whose cue was running — the engine names its lanes
for its layers (`drone`, `organ`, `choir`, `strings`…), and the conductor, the
ward's pump (`ward`), the organist's (`organist`) and the guests have lanes of
their own; on the guests' lane, the guest the cue names (its notes' `guest`,
the testimony's `testimony`, a `guest-start`, `guest` or `guest-end` event),
else the guest named by the work that scheduled it (the conductor's tick that
begins the Hosanna names it as it begins it), as `guest:<name>`, else
`guests`; a press, `press:play`, `press:stop` or `press:reseed`. A source's
end (the mock's `onended`) is charged to the work that built the source, a
timer to the work that armed it, and anything else is `outside` (nothing
today). A piece one cue hands to another layer's pump is that pump's when it
is built: a hymn's lines are written and told on the `choir` lane and their
throats built by the ward's pump, so `ward` tells no note and builds the most.
The report's `cost:` section, after the `graph:` line, gives each work's cues
(presses, for a press), nodes by type, automation calls and disconnects, in
all and per minute of the run (`<secs>` / 60), its busiest minute and the
notes it told by layer; the ten builders that built the most (the engine's
function that called `create…`, by file and line, and whose work it was);
and the check: every node, call and disconnect in a work's count, the works
adding up to the graph's own, none outside, and every work that told notes
built nodes — a lane the harness failed to watch would tell its layer's
notes and build nothing. With `cost=<file>`, or with `dump=` (as
`<dump>.cost.json` beside it), the same is written as JSON: the sidecar
`cost.js` reads (`render.js` and `tally.js` write one beside each dump with
`--flags cost`). The clock's lanes are watched as for `throw=`, and nothing
the engine does moves: the dump is the plain run's, record for record (24
runs — four seeds, the scripts, the throws, the bad listener, the paced desk
and every forced guest — against the harness before the cost). The stack is
read once a node, about a third more time. Seed 22, 1200 s: 34,628 nodes, the
ward's pump 18,813 of them (11,182 BiquadFilters, 941 a minute, 5,863 in the
first hymn's minute), the band 8,148, the organist 2,666; 9,284 disconnects,
8,387 of them the ward's; `filterNode` (`kolob-voices-vocal.js`) built
11,606. Seed 37: the Hosanna 22,466 nodes, 12,867 of them in its one minute
(18), beside the ward's 25,088 over the whole meeting.

## The dump format (v1)

The tools depend on the dump and nothing else: one JSON array per line,
`[kind, t, payload]`. Records past the run's end are dropped.

| kind | `t` | payload |
|---|---|---|
| `"H"` | 0 | **header**, first line, written when the harness is given `header`: `{format: "kolob-dump", v: 1, seed, secs, flags: [...], engine: {dir, legacy, list, files, fingerprint}}`. `engine` says where the modules were loaded from and what their bytes hash to, the witness's way. A dump without it still reads: the seed comes from the `transport` event (`seed N`) or the file name, the length from the last record. |
| `"N"` | the music's own time at emission (`S.now()`: the cue's scheduled time inside a cue, the audio clock outside) | **a note** exactly as `onNote` delivers it: `{layer, freq, startTime, duration, …extra}`. `startTime` is when it sounds, usually ahead of `t`. Extras: `part`, `hymnId`, `beat`, `syl`, `deg`, `monzo`, `marks`, `memberId`, `loud` (SCORE §6). |
| `"E"` | the music's own time at emission | **an event** exactly as `onEvent` delivers it: `{type, t, …payload}`. (A dump from a build older than 2026-10-01 also carries the log words `cat`, `label`, `detail` on each event; the reader reads them only for a type it does not know.) |

**How the reader (`lib/dump.js`) takes it.** A note's time is its `startTime`;
an event's is its `t`, or the record's `t` when it has none; events are ordered
by time, emission order within a tie. An event is read by its `type` (the
reader knows every type a live build sends), and by its words (`cat` +
`label`) only for a type it does not know. The words are the only reading of a
dump from a build before 2026-09-27 (before the typed bus); such a dump may
tell one happening twice, a log line and a typed event, and the two are merged
into one. Whatever neither vocabulary knows is still counted in tally's "events
per meeting", by its `type` (its `cat`, in an old dump; all but `transport`,
the harness's start-up line); any other record kind, and an unparseable line,
is skipped. **Meetings** run from one meeting-start to the next; the last is
complete only if its last joint says it ended inside the run (`joint {last:
true, dur}`; in an old dump `∴ joint — meeting ends`, read by its words; a
typed `meeting-end {dur}` is accepted, though no engine emits one). **Sections** run
from one section start to the next, joint included. **Guests** begin and end on
`guest-start` / `guest-end {guest, section, logged}`; the typed `guest` event
is a *stage* of a guest already begun (`{guest, stage}`: the band approaches,
crosses, passes) — a mark, never a second start, so a stage label is never
counted as a guest of its own. **Voices** are one line per layer, or per
`layer:part` when notes carry `part`; a chordal layer without parts is read by
its top line; unpitched notes (`freq` 0) never make a voice.

**The words the reader knows**, in both vocabularies (the log words only in a dump older than 2026-10-01):

| log (`cat` · label) | reads as | typed |
|---|---|---|
| `meeting` · `☀ meeting N` (detail `F0 … Hz · mode · kind · season`); `☀ sunrise` | meeting: mode, kind, keynote = F0×4; mode change | `meeting-start {n, sunday, kind, mode, keynoteHz, houseDialect}`; `sunrise {mode, keynoteHz}` |
| `section` · `§ HYMN` (detail `[meter ·] 87s`) | section, planned length, meter | `section-start {section, index, dur, meter?}` |
| `harmony` · `∴ plagal cadence` | cadence (plagal, authentic, half, …); a chord written | `cadence {kind}`; `chord {at, chord, by}` |
| `cadence` · `∴ joint` (`meeting ends · 8s`); `∴ the room empties` | section joint, the end of a meeting; the joint that follows goes into stillness (marked `still`; not a joint of its own) | `joint {last, toward, dur}`; `room-empties {toward}` (`meeting-end {n, dur?}` accepted) |
| `visitation` · `⇋ a band approaches`, `◎ the steeples answer`, `✧ an old tune remembered`, `∴ raspberry`, `◌ the tune is withheld`, … | guest start, stage or end: bands, steeples, oldtune, raspberry, cumulative, …; the plan's guests | `guest-start` / `guest` / `guest-end {guest, section, logged}`; `guests-drawn {guests}` |
| `motif` · `❁ the day's hymns`; `◆ …`, `✸ …`, `⇄ …` | the day's material; a motif at work | `hymns-of-the-day {gestures, names, temper}`; `motif-develop` `-reprise` `-answer` `-disperse` `-shadow`; `hymn-announced {hymn: {id, meter, dialect}}` |
| `verse`, `fuging`, `conductor` (`still small`), `ambient`, `telegraph`, `transport` (`seed N`) | lines, lining out, fuging, stillness, field events, telegraph, seed | `verse-line` (and `round-entry`, `partner`, `refrain`), `lining-out`, `fuging`, `stillness {why, holdS}`, `skip {to}`, `field {field, name}`, `telegraph {word}`, `transport {action, seed}`, `liahona`; `verse-start`, `cast {memberId, action}`, `vision {name}` |

**What distinctness reads from the typed fields:** the **Sunday** from
`meeting-start.sunday`; the **dialect** from `meeting-start.houseDialect`,
`hymn-announced.hymn.dialect` or any event with a `dialect` string; the **cast**
from `cast` events and notes with `memberId`; the **registration** from any
event or note carrying a `registration` field (the organist's `cast` events do:
"draws the stops", `registration: "soft flutes"`; no engine emits an event of
type `registration`, though the reader would accept one). All four are fed by
the current engine; one a window does not reach (no organist in the first three
minutes) is simply absent for that seed.

## loadcheck.js

```sh
node tools/loadcheck.js                 # exit 0 = loaded, 1 = not
KOLOB_DIR=<dir> node tools/loadcheck.js # another build
```

The cheapest check there is, and the first thing CI runs: it reads
`_engine.php`'s one list, evaluates every room in that order under a bare mock
of the page (no audio, no clock, almost no DOM), and takes the roll call the
page's own load guard takes — every room answered (`KOLOB._rooms[file]`), the
substrate's globals raised, the `KolobAudio` facade standing and carrying the
methods the page and the labs call. It then runs the page's own guard
(`kolob_engine_guard()`, read from `_engine.php`) as the page does, after the
rooms: it must name in `KOLOB._broken` exactly what the roll call missed
(`kolob-ui.js` keeps PLAY disabled on it) and set nothing on a whole load. The
calendar and the plan (`kolob-plan.js`) must stand before `kolob-meeting.js`
is evaluated (the meeting requires both). The composer's desk: the files the hymnal's worker would load
on the page — found by the script tags the page prints from the list, under a
stub Worker — must be the list's own, in its order. Then one pure smoke: the
composer writes a hymn from a fixed stream and the Score's proofreader passes
it. **The page's drawing** (PLAN-REFACTOR §3.5): `_viz.php`'s list (or
`kolob-viz.js` alone in an older build; nothing in a copy without the page) is
evaluated after the engine, in its order, on recording canvases
(`lib/canvas.js`); `KolobViz` must stand with its whole surface (`init`,
`setConductor`, `setWheelLabels`, `wheelSeatAt`, `setTuningMarks`, `probe`,
`freezeAt`), every name a file reads off `KOLOB._viz` must be lent there once
all have loaded, and the page is set up and drawn for its first frames, idle,
without a throw (`page: 6 of 6 files loaded …; KolobViz's surface 7 of 7; 79
names read from KOLOB._viz across the files, every one lent; 2 frames drawn
idle (1910 canvas calls)`; the harness's `staff=` draws a whole meeting).
Last, **the labs** (PLAN-REFACTOR §3.7): every `*-lab.php`, beside the
engine and in `shelved/`, has its list of the house's files read from its page
— its `<script>` tags for `pj2-*.js` and `kolob-*.js`, resolved from the lab's
folder, and `_engine.php`'s list where it prints `kolob_engine_tags()` — and
that list is loaded headless in the page's order, each lab in a process of its
own, so each room sees only what its lab loaded before it: every room must
evaluate without a throw or a word to `console.error`, and every room of the
one list must answer the roll call. A room that comes to need another at load
(`KOLOB.Pitch`, `KOLOB.Score`) is caught on the bench that lacks it; a room that
reads another only when called is not (the lab finds that when it plays). It
prints `modules: N of N loaded; rooms answering: M`, the guard, the desk, the
hymn, the labs (`labs: 16 of 16 load the house's rooms in their own order
(cast-lab 44, …)`, each with its count of files) and `ALL GREEN` or the
failures. No harness, no browser: the harness is what plays a meeting, this
only proves the doors open. Its loader — the list, the page's mock, the rooms
evaluated in order, the roll call, a lab's list and a list loaded in a process
of its own — is `lib/engine.js`, which `golden.js` loads the engine with too.

## lends.js

```sh
node tools/lends.js                 # exit 0 = no unguarded unknown read, every wrapper exact
KOLOB_DIR=<dir> node tools/lends.js
```

Every room lends what it builds onto one bag, `KOLOB._s` (SCORE §9.1, "the
chorister's book"), as `S.name = …`, and reads the others' as `S.name(…)`. Load
order is the only type system that pattern has: a lend renamed in one room
fails in another at the first cue that reaches it, minutes into a meeting, as
"S.x is not a function". This tool reads the rooms statically (every
`kolob-*.js` on `_engine.php`'s list) and reports every `S.name` read whose
name no room lends — an **unguarded** read fails the run, with file and line; a
read under a guard (`S.x ? … : …`, `S.x && …`, `typeof S.x`, `!S.x`,
`if (S.x)`) is an **optional** lend, listed, not failed (a lab without the
room) — and the **dead** lends, lent and never read by any room.

**The BORROWED wrappers** (PLAN-REFACTOR §3.7). A room that calls another's
function keeps a one-line wrapper for it at its top — `function cueAt(lane, t,
fn) { return S.cueAt(lane, t, fn); }`, in the room's BORROWED block — as its
manifest of what it borrows, bound late through `S`. The tool parses each room
with acorn and checks every function of that shape: it must call the lend it is
named after and pass its arguments through unchanged, in order. One that
renames (`function foo() { return S.bar(); }`) or drops, adds or reorders an
argument fails the run, with file and line. It prints the count room by room
(`wrappers (…): 189 in 8 rooms — voices-organ 15, …, core 36; every one exact,
every one used in its room`) and names any wrapper its room never uses (ESLint's
`no-unused-vars` fails those). Without acorn (`npm install` not run) the
wrappers are not checked, it says so, and it exits 2. `ALL GREEN` when nothing
is unguarded and every wrapper is exact. CI runs it on every push.

**The page's bag** (PLAN-REFACTOR §3.5). The page's drawing is six files
(`_viz.php`'s list) sharing a bag of their own, `KOLOB._viz` (`VS`), the same
way: a lend `VS.name = …` (or `Object.defineProperty(VS, "name", …)` for the
page's state that is reassigned — the conductor's report, the device's pixel
ratio — lent by a getter), a read `VS.name`, a wrapper `function x(a) { return
VS.x(a); }` and a value taken at load, `var x = VS.x;`. The same checks run over
that list and that bag and are told on lines of their own (`the page: files
read: 6 (_viz.php); names lent on KOLOB._viz: 66; reads: 122` and `the page:
wrappers …: 42 in 4 files …; every one exact, every one used in its file`); an
unknown read or an inexact wrapper there fails the run as well.

## samecode.js

```sh
node tools/samecode.js                 # HEAD against the worktree, every kolob-*.js
node tools/samecode.js --ref HEAD~1    # another ref
node tools/samecode.js file.js …       # these files only
```

A comment-only cleanup must leave the code exactly as it was. This proves it:
each file is tokenized with `acorn` (the parser ESLint brought; `npm install`
at the repo root once) with comments and whitespace dropped, in the git ref and
in the worktree, and the two token streams are compared. A file whose tokens
differ is named with the first token that moved and its line; one whose tokens
agree had only its comments or layout changed; one not in the ref is skipped.
Exit 0 when every compared file's code is unchanged, 1 otherwise, 2 without
acorn. Run it beside `tally.js --a git:main --b worktree`, which proves the
music did not move, after any pass over the comments.

```sh
node tools/samecode.js --split kolob-viz.js --ref <ref> [new.js …]   # default: _viz.php's list
node tools/samecode.js --split old.js --from <file> new.js …          # the old closure from a file
```

**A file cut into pieces** (`--split`, PLAN-REFACTOR §3.5). One closure become
several, sharing state through one bag, moved its code if every statement of
the old closure stands, whole and in its old order, in exactly one new file,
and everything else in the new files is glue of the house's few shapes: the
bag (`var VS = window.KOLOB._viz = window.KOLOB._viz || {};`), `var K =
window.KolobAudio;`, a BORROWED wrapper, a value taken at load (`var x =
VS.x;`) and a lend (`VS.x = x;`, or a getter — and a setter where another file
writes it — for a name the old closure reassigned). Each file is parsed with
espree and eslint-scope (ESLint's own) and each top-level statement of its
closure tokenized; a moved statement must be an old one token for token, but
for one change: a name of the old closure that another file now owns may be
read as `VS.name`. Then every identifier is checked for what it means: a name
of the old closure is the same name in the new file — its own, a wrapper's, a
value taken once (only a name the old closure never reassigned, never written
there, from a file loaded before it) or `VS.name` (lent by the file that
declares it, by a getter where the old closure reassigned it); a local stays
local and a global global. It prints, file by file, the statements moved, the
glue, and the names read through `VS` with their counts, then `SAME CODE` or
`NOT A PURE MOVE` with each fault (exit 1). On the cut of `kolob-viz.js`
(`--ref e06bfee`): 291 of 291 statements moved whole, each once; 57 names read
through `VS`.

## golden.js

```sh
node tools/golden.js                        # seeds 1–40 against tools/golden/*.json; exit 0 = all match
node tools/golden.js --write                # write the baseline (an intended change, in the same commit)
node tools/golden.js --show hymns 17        # the canonical JSON one hash is taken of
node tools/golden.js [--seeds 1-40] [--engine <dir>|git:<ref>] [--jobs N] [--per 5]
```

The tally proves a change left the music alone by playing twenty meetings
through the harness on each build, about seventy seconds. Most of the engine's thinking is pure, and a
change there is proved here in seconds: about 16 s for 40 seeds on four cores
(the slowest seeds, 10 and 18, write a partner doxology, fourteen tries at the
fit, in 2–3 s; a doxology the reckoning writes 24 ways takes about a second).
For each seed the first meeting of a fresh visit is planned and its hymns
written, and five results are hashed, one file each in `tools/golden/`:

| kind | what is hashed |
|---|---|
| `meeting` | what `planMeeting` leaves (the plan's `day` and `seat`, `kolob-plan.js`, written into the meeting by `kolob-meeting.js`): the Sunday the calendar drew (its die and its answer), the order of service (each rite's type, length, meter and light, holds included), the guests seated and refused, the seatings, the day's hymnal and forms, the reckoning's order, the Hosanna, the testimony, the chorale prelude, and every event it emitted |
| `hymns` | the hymnal's orders (`prepare`'s rows, forms and reckoning) and every order written by `kolob-hymnal.js`'s own `write()` (through `get()`): the same others, the same dependency, the doxology's reckoning, a partner where drawn, the refrain — the Score as returned |
| `guests` | each guest room's `decide()` on the info `planMeeting` handed its `plan()`, on a fresh `guest:<name>:<n>` |
| `organist` | `Organist.seat` and `preludeDraw` as the meeting called them; the chorale prelude where drawn; for each hymn the organ plays, in the day's order with the ledger carried, `modulate` into a keyed hymn and `accompany` (the giving out, the verses, the interludes, the amen) |
| `ward` | `Cast.seat` as the meeting called it, and `Cast.planHymn` for each of the day's hymns |

**How.** Five seeds a process (`--per`; the groups do not depend on the
machine, and `--per 1` and `--per 40` give the same hashes — a visit leaves
nothing to the next). Each process loads `_engine.php`'s list with
`lib/engine.js` (no AudioContext, no clock), reseeds as GATHER does
(`KolobAudio.reseed`) and plans the meeting by the core's own entry,
`S.planMeeting(t)`, as the downbeat's cue calls it; the core's `cueAt` does
nothing without a clock. One lend is answered as the page answers it:
`S.pipeOn()` asks whether the pipe organ has an AudioContext, and without one
the planner seats no organist's variations and draws no chorale prelude — the
golden says the pipes are on. Timers are written down and never run, and
`performance.now` stands at 0 (the hymnal times each hymn, for its stats). The
pure planners the meeting calls (the calendar's draw, the hymnal's plan and
forms, each guest's plan, `Cast.seat`, the organist's seat and prelude draw)
are watched as they are called, and each is called again on a fresh stream of
the same label: it must give what it gave the meeting, or the run names it
(`FAULT … not pure on its arguments and its stream`). **The plan itself**
(`KOLOB.Plan`'s `day` and `seat`) is watched the same way and held to its own
header: the meeting's call of each runs with the house shut — every lend on
the shared bag (read or written, or one lent anew), the page (`document`,
`location`, `localStorage`, `navigator`), the audio (`AudioContext` and its
kin), the timers, `performance`, `Worker`, `KolobAudio`, `Date` and
`Math.random` throw when touched, and the touch is told with where it came
from (`FAULT … the plan: S.ctx in Plan.seat: seat (kolob-plan.js:308)`);
the streams the house deals it (`draws.stream`, the core's `S.stream`) are
let through, the plan that asks for them is not. What it was handed must be
as it was after the call (`the plan: Plan.seat wrote what it was handed`).
Both halves are then called again, with the house shut, on fresh streams of
the meeting's labels (`<label>:<n>`, one stream per label in a call, as the
core's; a fresh `cast:<n>` each time it is asked), and must give the
meeting's own day and seating; and on 21 settings of the switches (the
switch's own pick, each guest it may name, the withheld tune always and
never, the raspberry, the pipes silent, the reckoning held) twice each, the
same both times. The line `the plan: KOLOB.Plan's day() and seat() ran with
the house shut …` says so, or `— BUT NOT ALL (above)`. Planted in scratch
copies of `kolob-plan.js`, each is named: a read of `KOLOB._s.ctx`, of
`document` and of `setTimeout`, a `Math.random()`, a write to the day it was
handed, and a counter kept between calls. While a seed is computed,
`Math.random` and `Date.now` throw and the call is named with the two frames
under it (`the trap: Math.random() in hymns: compose (kolob-composer.js:1944) ←
errand (kolob-hymnal.js:466)`); nothing calls either today. The hash is SHA-1
of canonical JSON: keys sorted, numbers exactly as JSON writes them, a function
as `ƒ`, a `PJ2.Rand` stream as the first draw of its fork `golden:probe`.

**The ward's and the organist's hymns are the labs' walk**, not the
performer's: `planHymn` on the hymn's `performance` fork with the Cast's own
count of verses, the organ where the dialect's profile has it and never under
a round; `accompany` on the hymn's own beat, with the ward plan's verses. The
performer's walk — the verses the section has room for, the chorister's tempo
and clock, the interlude a fuging displaces — is `kolob-voices-choir.js`'s, a
room that keeps time, and the tally's.

**What it cannot see**: the rooms that keep time and build nodes — the voices,
the conductor past the plan (each section's turns, the tick, the joints, the
chord desk), the set pieces (`kolob-guests.js`), every guest's `prepare()`,
`score()` and `perform()`, the choir's performance, the core, the hymnal's
worker and idle roads as such — and any meeting after the first, and the
switches (`ives`, `force=`, `cumulative`, `razz`, `exp=`) but for the plan's
own two halves, run on them twice and not against a baseline. A clean golden says
the pure core did not move on these seeds, nothing more; a change to anything
else still needs the tally.

**Reading it.** One line a kind: `40 of 40 seeds match`, or the seeds that
differ and the command to look at the first. `--show <kind> <seed>` prints the
canonical JSON that seed's hash is taken of (the hash and the baseline's on
stderr); to see what moved, print it on both builds and diff:
`--show hymns 17 --engine git:HEAD > a.json`, `--show hymns 17 > b.json`. The
header names the modules' fingerprint (the witness's, as the harness prints it)
beside the baseline's: a comment moves the fingerprint and no hash. A planted
change proves it sees: the Sacred Harp's `tempo` in `kolob-dialects.js` moved
from 0.86 to 0.87 in a scratch copy — `hymns 24 of 40 seeds match — differ: 2,
3, 4, 5, 6, 8, 12, 13, 17, 18, 23, 29, 31, 34, 36, 39`, exactly the sixteen
seeds whose day has a Sacred Harp hymn, and every other kind 40 of 40; the same
copy with only a comment added, 40 of 40 on every kind.

**After a change that moves the pure core on purpose**, re-baseline in the
same commit: run the comparison first and keep its lines (the kinds and seeds
that moved), then `--write`, and put both and the reason in the commit message.
`--write` refuses when a seed faulted (a planner found impure, a sprung trap,
a word from the engine). Each file carries the fingerprint and the VERSION it
was written at and the date. CI runs the comparison on every push.

## distinctness.js

*Design law 2: "Two random seeds must sound clearly different within three
minutes."*

```sh
node tools/distinctness.js [--n 20 | --seeds 1-20] [--window 180] [--engine …] [--harness …] [--dumps …]
                           [--twin 0.5] [--plant-floor 1.5] [--collapse 3] [--no-sanity] [--out <dir>]
```

It renders the first `--window` seconds of each seed and describes each seed by
what a listener could notice in that window, in groups: **identity** (keynote,
mode, kind of Sunday, the Sunday); **style** (dialect, organ registration);
**cast** (who is heard); **tempo** (median inter-onset interval per voice, and
pooled); **density** (notes per minute per layer); **pitch** (the pitch-class
profile against the keynote, duration-weighted, and the melodic-interval
profile); **rhythm** (the inter-onset-interval profile); **register** (the
median pitch and the p10–p90 span); **texture** (the silence share — nothing
but drone and field — polyphony, layers heard); **guests** begun in the window;
**field** events; **material** (the day's hymns announced); **form** (the
prelude's length, and sections entered).

**Standardising.** Each numeric feature is standardised by its spread across
the seeds, floored at a just-noticeable difference (60 cents for the keynote,
7 % for a tempo, 15 s for the prelude), so an inaudible spread never counts as
separation; a difference of two spreads counts as fully different. Profiles use
the Jensen–Shannon distance, sets the Jaccard distance, categories count 0 or
1. **D** is the weighted mean over groups. A feature one seed lacks, or a layer
neither seed sounds, sits the pair out.

**A yardstick the build cannot move.** D is standardised by the build's own
spread, so a relative threshold alone cannot see a build whose seeds have all
collapsed into one meeting: its spread shrinks with it, and the median pair
still looks "far" (20 copies of one seed, each transposed by up to ±45 cents
and 3 % faster or slower, gave a median D of 0.106 and only 41 of 190 pairs
flagged). So the planted twin, seed 1 a semitone higher and 4 % slower,
measured on the same scales, is the yardstick: a pair is a **near-twin** when
D < 0.5 × the median *or* D ≤ 1.5 × the planted twin's D (`--plant-floor`),
whatever the median says; and the **spread** line holds the median against the
plant — at 3× or less (`--collapse`) the verdict says **COLLAPSED**: the
typical pair is barely farther apart than one meeting heard in another key. On
that collapsed set the report reads spread 0.7×, ⚠ COLLAPSED, 172 of 190 pairs
near-twins; on v0.36.2 (seeds 1–6, 180 s) spread 7.9×, no near-twins, with
identity, cast, material and style carrying most of the distance.

**The report** (`report.md`, with `distances.csv` and `features.json`):
*Verdict* (the D distribution, the spread against the plant, the near-twins,
the sanity line, what separates least and most); *The closest pairs*, each with
what the two share within an audible step and what differs; *Each seed and its
nearest neighbour* (keynote, mode, kind, pulse, notes/min, silence, guests,
material, prelude, nearest, D); *What separates seeds least* (per feature, the
share of pairs within one JND, the mean standardised distance, the JND, the
range across the seeds); *Where the distance comes from* (per group, weight
and share); *How it is measured*. **Sanity checks**, built in (skipped with
`--no-sanity`): the first seed is rendered twice and must be D = 0; the planted
twin must be seen (D > 0) and fall inside the relative twin line, and the
report says how many real pairs are closer than it (in a healthy build, none);
every pair of different seeds must be D > 0.

## repetition.js

```sh
node tools/repetition.js [--seeds 1-20] [--secs 1200] [--first] [--min 3] [--common-min 4] [--engine …] [--harness …] [--dumps …] [--out <dir>]
```

**Phrases.** Every voice's line is cut into phrases: a phrase ends at a breath
(more than 0.35 s of silence between a note's end and the next onset) or after
12 notes; phrases under `--min` notes are not counted; drone and ambient are
not melodic and are left out. **The shape** of a phrase is its melodic
intervals in semitones, rounded from the just ratios, plus its rhythm as each
inter-onset time's ratio to the phrase's own median beat — free of
transposition and of tempo. Two looser readings are reported beside it: the
pitch shape (intervals only) and the contour (up, down, same).

**The report** (`report.md`, with `shapes.json` holding every shape): *Verdict*
(the heard-before rate in the same voice and in any voice, the most and least
repetitive meetings, and across seeds the distinct shapes and the share
belonging to one meeting only); *Per voice* (meetings, phrases per meeting,
distinct shapes per hour and their share, heard before as shape, pitch only and
contour, heard before in any voice — a doubling within 1 s counts as heard
*together*, not *before*); *Per meeting* (length, phrases, distinct shapes, the
rates, the most repeated shape); *Across seeds* (the shapes of at least
`--common-min` notes found in the most meetings, each with its first hearing
spelled in solfège, and the commonest rhythm-free shapes). The one rut this
tool ever found was the fife's loop in the old `band:melody` line (71 % heard
before on v0.32); the composed march of v0.36 replaced it, and the *Per voice*
table is where a new loop would show. On v0.36.2 (seeds 1–3, 1200 s) the
same-voice rate is about 23 %, nearly all of it the choir's four parts singing
a hymn's verses to one tune (38–41 % each); every other voice is at or near
0 %.

## tally.js

```sh
node tools/tally.js [--seeds 1-20] [--secs 1200] [--first] [--engine …] [--harness …] [--dumps …] [--jobs N] [--out <dir>]
node tools/tally.js --a <spec> --b <spec> [--seeds 1-60] [--secs 1200] [--threshold 15] [--harness-a …] [--harness-b …] [--flags …] [--jobs N]
```

**Four at a time** (`--jobs N`, PLAN-REFACTOR §4.0(c)). The renders are
independent, so the tally runs `N` harness processes at once — by default
min(4, the cores) — and both builds on one pool of `N` (`lib/run.js`
`pool()`), so neither waits on the other's last seed. Each render is
witnessed on its own, as a lone one is, and a render the witness refuses
(the engine's bytes changed under it — "read the build's files but not its
bytes") stops the pool: no render still waiting begins, on either side, and
the refusal is what the tally says. At any `N` the dumps are the same files
byte for byte, and the report differs only in its timing line (`- 40 renders
in 72.6 s, 4 at a time (A and B on one pool) · <date>`). A harness keeps
about two cores busy by itself (V8's collector and compiler beside the run;
seed 22 at 1200 s: 2.7 s of the clock, 4.5 s of the cores), so four cores
fill at three or four: `--a git:HEAD --b worktree --seeds 1-20 --secs 1200`
took 149 s at 1, 85 at 2, 70 at 3, 72 at 4 and 68 at 6 — 85 s before, at
two a side with B after A. Four harnesses hold about 1 GB between them.

Here `<spec>` is a dump directory, an engine directory, `git:<ref>` or
`worktree`. `--flags` hands the harness its switches for every build the
tally renders, as `render.js` takes them (`--flags force=gulls`, `ives`,
`cumulative`): a change to one guest's room is proved on the seeds that seat
it, `node tools/tally.js --a git:HEAD --b worktree --seeds 1-3 --flags
force=gulls` (the report's A and B lines name the flags).

**What it counts**, over every complete meeting: the meeting's length and its
sections; each section type's median length and count; cadences per meeting
and the share of each kind; joints (one per section: `∴ the room empties` is
how a joint goes, not a joint of its own, so joints per meeting equal sections
per meeting); guests per meeting, the share of meetings with a guest, and with
each guest; notes per minute and median note length per layer; events per
meeting by category (not `transport`); the mix of modes and kinds of Sunday.
It also runs the **plan checks** a dump can answer: the plagal share of
cadences, 30–55 % (§12); meetings with a guest, ≈ 55 % ± 15 (§8, §13); mean
meeting length 13–16 min (§0). **The
report** (`report.md`): the plan checks as a table (check, plan, measured,
✓/✗); one table per group (sections, cadences, joints, guests, notes, events,
modes…) with each metric's value and how many meetings carry it; *Per meeting*
(seed, meeting, minutes, mode, kind, sections, cadences, guests, notes); *How
it is counted*.

**A/B.** It renders both builds from the same seeds (**60 by default**; each
build witnessed, as above), then says which seeds played **identically** (note
and event streams byte for byte, header excluded); gives, for every metric, A,
B, the shift, and the **noise** (two bootstrap standard errors of the
difference, meetings resampled 300× per side); and **flags** a shift beyond
±15 % (`--threshold`) that is also beyond the noise, or a metric that appears
or vanishes. Shifts beyond ±15 % but within the noise, or seen in fewer than 5
meetings, are listed as *worth a look, not a verdict*. With the same seeds and
an unchanged engine every difference is exactly zero: `--a worktree --b
worktree` reports every seed identical, "nothing moved", and no flags. **Use
60 seeds, not 20, for a musical change:** when the music moves, no seed plays
the same meeting on both sides, and the noise column is all that stands between
a shift and a verdict. Twenty meetings a side leave a share such as "meetings
with a guest" ±30 points wide; sixty bring it to about ±18 and render in under
a minute for two builds; the report says so when a side has fewer than 40
meetings. For a housekeeping change, 20 seeds and the identity line are enough.

The A/B report (*Verdict*; *Plan checks* for both sides; per group, `metric ·
A · B · Δ · noise ± · meetings A/B · flag`; *How it is counted*) also warns
when **A and B hold different seeds** (two dump sets rendered apart, say: both
lists are printed, and every shift then mixes the change with which Sundays
were drawn — pass `--seeds` to compare like with like); when every shared seed
played identically **but the fingerprints differ** (the modules' bytes moved
and the music did not — a comment, say — so "nothing moved" is never read as
"the same build"); and when the seeds differ but the fingerprints agree (the
difference is the harness or the flags, not the engine).

## screens.js

```sh
node tools/screens.js [--seed 1847] [--times 20,60,120] [--widths 860,390] [--section hymn] [--freeze] [--fps-secs 20] [--throttle 4] [--full] [--ives] [--latin]
                      [--port 8113] [--chrome-port 9423] [--profile <dir>] [--out <dir>]
```

It loads `?seed=N` in muted headless Chrome and presses PLAY. At each time in
the meeting (the audio clock since PLAY, or since the jump with `--section`) it
captures the **staff** canvas at each width: 860 px at DPR 2; 390 px emulated
as a phone at DPR 3; with `--full`, the whole page as well.

**Frame-exact (`--freeze`, PLAN-REFACTOR §4.0(a)).** Without it a shot is
taken whenever the audio clock passes the time, between two frames, and two
runs of one build differ by a few pixels of scroll — tens of thousands of
pixels by `compare -metric AE` (seed 22 at 20 and 60 s: 33,703 and 35,473 at
860 px, 22,641 and 10,139 at 390). With it the page holds each time and
paints there (kolob-viz.js THE FRAME-EXACT CAPTURE: `?kolobFreeze=<secs>`,
`KolobViz.freezeAt(secs)`, `probe("freeze")`), the times counted from the
meeting's downbeat — with `--section`, from the jump's `section-start` — and
two runs give the same staff: `compare -metric AE a.png b.png null:` says 0.
That is how two builds are compared by pixel (a refactor of the page must say
0 on every pair). Exact where the ink dries at its own rate (in the sacrament
and the postlude a shade may differ: the drying follows the section the
console last reported); after a `--section` jump the page still holds what was
printed before it, placed by the jump's own moment, until it has scrolled away
(about 14 s at 860 px). A frozen shot is the plate alone, where the ink is
(the staff's canvas lies over the wheel's foot, whose organ is the live
sound's spectrum, and over the console's head), shot where it stands in the
viewport (a shot beyond the viewport lays the page out again, wider by the
scrollbar at 860 px; a held page is then painted again at that width). What
the engine writes after the held moment waits until the page runs on, so the
page is made of the same notes in every run. In `--full` only the staff is
held: the wheel's organ is the live sound's spectrum and the console runs on.
The page runs free again before the frame timing.

**Frame time.** After the shots, the CPU is throttled `--throttle`× for
`--fps-secs` (0 to skip). Every requestAnimationFrame callback is timed, and
callbacks sharing a frame are summed. The report gives p50/p90/p99/max per
frame against the 16.7 ms budget, the rAF interval, the long tasks and the
**load average** while it measured. Headless Chrome may pace rAF slowly; the
report says so whenever the median interval is over 25 ms (a display paces it
at 16.7); the cost of each frame is what matters. **Read p99 and max with
care:** over 20 s at 10 fps there are only about 200–300 frames, so p99 is the
worst 2 or 3 of them — the worst moments of that window, not a steady rate —
and frame cost rises with the machine's load: p50 and p90 are where the page's
own cost shows, the tail is where the load shows. The report prints
`os.loadavg()` beside each width and warns when it was over half the cores;
re-run on a quiet machine before you read p99, max or long tasks as the page's
own. The phone's p99 is the number to watch as the staff multiplies the ink.

**The report** (`report.md`, each PNG embedded): the frame-time table (width,
frames, p50, p90, p99, max, rAF interval, long tasks, section, load avg) with
its notes on pacing and load; per width, a table of shots (meeting time,
section, staff size in CSS px, file `staff-<width>-t<secs>.png`); console
errors and warnings from each width.

## capture.js

```sh
node tools/capture.js [--seed 1847 | --seeds 1847,5,9] [--from 0] [--to 240] [--meeting] [--section hymn] [--ives] [--px-per-s 8]
                      [--no-harness-check] [--port 8113] [--chrome-port 9423] [--profile <dir>] [--out <dir>]
node tools/capture.js --wav <file.wav> [--events <file.jsonl>] [--out <dir>]     # re-analyse a capture
```

It plays the meeting in muted headless Chrome and records the window between
`--from` and `--to`, in meeting seconds (from the moment the meeting is
called). `--meeting` records until meeting 1 ends (cap `--max`, default
1500 s), read through the dump reader: the last joint's `∴ joint — meeting
ends · 8s` (the joint's length and 6 s of the bell's tail), a typed
`meeting-end {dur}`, or else the next meeting's start.

**The tap** is injected before any page script. Every node that connects to an
output also feeds a ScriptProcessor; the output may be the destination, or the
MediaStreamDestination the page uses to survive a locked screen. What is
recorded is exactly what the speakers would get, after the master chain. (An
AudioWorklet tap was tried and dropped: it moved the whole graph's rendering
onto the worklet thread, which under load fell below real time and slowed the
meeting; the ScriptProcessor keeps rendering where it was, 0.995–1.00×.) A
ConstantSource ramp rides on a third channel; its value is the audio time, so
every buffer knows its first sample exactly, and any dropout shows as a gap.
The report states how much of the window the tap covered, to the sample;
**every discontinuity**, in a table (meeting time to the millisecond, hole or
overlap, size in samples and milliseconds), each also marked on the picture
with a red triangle and a dashed red line labelled `tap gap N smp`; and the
audio clock's rate against real time. A discontinuity is the recording's, not
the engine's: the graph rendered those frames, but the tap never received them,
so the WAV holds silence there, and a click heard at a marked time is the
tap's. A block that starts within the ramp's tolerance (at least ±4 samples)
of where the last ended is laid contiguous, since ScriptProcessor buffers are;
anything farther is a discontinuity, snapped to render quanta of 128 frames (a
measured 126 is the 128 it must have been), the measured size kept beside it.
`…-tap.json` is the tap's own record; `--wav` re-analysis reads it when it lies
beside the WAV, and without it looks for runs of exact digital zero in both
channels with sound on either side, which the drone never makes.

**Outputs:** `capture-<seed>-<from>-<to>.wav` (16-bit stereo);
`…-spectrogram.png` (three strips on one time axis: a log-frequency
spectrogram, 30 Hz–16 kHz over 80 dB; the short-term (3 s) loudness over the
momentary (0.4 s), with the integrated level dashed; a raster of every note the
engine reported, one row per layer — section starts in solid lines, guests in
dashed gold, the tap's discontinuities in red); `…-events.jsonl` (the page's
own notes and events, **in the dump format**, shifted to meeting time, so the
dump tools can read a browser run too); `…-tap.json`; and `report.md`: the tap
line and the discontinuity table; integrated loudness (BS.1770-4 / EBU R128,
gated), LRA, the maximum momentary and short-term loudness, sample peak and a
true-peak estimate (4× oversampled); loudness and note count by minute; *What
happened when*; and **the browser's meeting against the harness's**.

**The browser against the harness.** Unless `--no-harness-check` (or
`--section`, which jumps), the same seed is rendered through the harness,
witnessed like any render, and the report holds the two side by side: the same
mode, kind and keynote; each section's start on both sides (✓ within 2 s); and
note for note, how many of the harness's notes sound in the browser and the
first point where the two part. The engine draws every decision from named
streams and measures it against the cue's scheduled time (SCORE §3, §4), so the
two agree, sections within a fraction of a second and note for note; a parting
is a finding — something read the wall clock or threw an unseeded die — not
jitter. (The sentence the report prints for a parting still describes the
pre-2026-09-27 engine; that text is a string in `capture.js`.) For a listening
packet: `--seeds a,b,c,d,e,f --to 240` records one seed after another, about
25 min; `--seed n --meeting` records a whole meeting.

## cost.js

```sh
node tools/cost.js <a> <b>        # two sidecars (.cost.json), or two dump sets rendered with --flags cost
node tools/cost.js <a>            # one side's table
node tools/cost.js --a git:HEAD --b worktree [--seeds 3,7,22,37] [--secs 1200] [--flags force=hosanna] [--jobs N] [--top 10]
```

What PLAN-REFACTOR §4.6 and any change to the audio graph cite: the
harness's cost (`cost`, "The harness" above) of two builds, side by side. A
`<spec>` is a sidecar, a dump set holding them, an engine directory,
`git:<ref>` or `worktree`; a build is rendered here through the harness with
`cost`, witnessed as every render is (seeds 3, 7, 22 and 37, 1200 s, by
default), into `out/cost-<stamp>/` with the table as `report.txt`. Several
seeds a side are summed work by work over the seeds both sides hold. The
table: for each work, nodes A and B and the shift, per minute, the busiest
minute (of any seed), automation calls and disconnects with their shifts;
the graph's whole; the node types; the builders that moved (matched by
function and file, not line, so a builder whose lines moved is still
itself; two anonymous functions of one file are one row); and whether each
side's every count was accounted. Plain text, to paste into a commit
message. Seeds 22 against 37 (two meetings, not two builds): the ward
18,813 → 25,088 nodes (+33 %), `guest:bands` gone and `guest:hosanna` new
(22,466, busiest minute 12,867), the graph 34,628 → 54,477, BiquadFilters
14,590 → 29,186. A sidecar against itself: every builder built on B what it
built on A.

## render.js

```sh
node tools/render.js [--seeds 1-20] [--secs 180] [--flags ives,razz,cumulative] [--engine <dir>|git:<ref>] [--harness <file>] [--out <dir>] [--jobs N]
```

Seeds → a dump set (`seed-N.jsonl`, `.log` and `.witness.json` each, and
`manifest.json` naming the engine, its fingerprint, the harness, the seconds,
the flags and each seed's verdict). The other tools call this themselves; it is
here on its own for a set you want to keep and read twice, or to hand to
`--dumps`. `--jobs` is the number of parallel harness processes (default half
the cores, at most 8).

## selftest.js

```sh
node tools/selftest.js
```

About a minute, no browser. It checks eighteen things: (1) a real dump from
this worktree reads as meetings and sections, the witness names the build's own
list, and the harness names the same engine in the header's `engine` field;
(2) a synthetic dump in SCORE §6's **typed** vocabulary reads the same way —
meetings, sections, cadences, guests, parts, and the distinctness hooks
(sunday, dialect, cast) all come through, a typed event echoed by a log line
counts once, and a typed `meeting-end` closes a meeting: the readers are proved
on a dump no harness wrote; (3) the same seed twice is D = 0, and two seeds are
not; (4) the loudness meter reads the BS.1770 references (the 48 kHz
coefficients; a 1 kHz tone at −20 dBFS reading −20.0 LUFS in stereo and −23.0
in one channel) and gates as EBU Tech 3341 says it must (its cases 3, 4 and 5,
and half at −20 / half at −40 reading −20.0, where an ungated meter would read
−23.0); (5) **the witness**: a copy of the engine with one comment added is
accepted under its own fingerprint, and the same copy rendered by a harness
that ignores `KOLOB_BASE`/`KOLOB_DIR` is refused; (6) **the count** (seed 3,
1200 s): every section of a complete meeting closes on exactly one joint, `the
room empties` marks the joint it tells of, and `transport` is not a metric;
(7) **the capture**: a tap block read a sample or two off is laid contiguous, a
hole read as 126 is sized to its 128 and placed at 0:40.9, and `--meeting`
finds meeting 1's end from a joint, a typed `meeting-end`, or the next meeting;
(8) **the harness's modes** (seed 7): `stop=40 play=41` puts the dump's
`transport` events at play 0, stop 40, play 41 and the restart calls meeting 2,
and the `clock:` line counts the timers left armed apart from the sources
scheduled past the end; `throw=drone@60` fires once, is reported by the clock
and kept out of the run's errors, and the cues it counts lane by lane add up to
the clock's own, the drone's to those before, the throw and those after;
(9) **recovery** (seed 7, PLAN-REFACTOR §2.1): `throw=drone@120` — the drone's
lane plays on, re-armed 5 s after the throw; `throw=conductor@300` — the next
tick 0.6 s on, and the dump the clean run's, record for record;
`throw=choir@212.5` — the broken hymn is let go and the meeting begins its next
section; `throw=ward@200,organist@200` — each pump ticks on at its own pace,
and the dump and the graph are the clean run's; (10) **a stillness ends at
STOP** (seed 7, PLAN-REFACTOR §2.2): `stop=626.1 play=626.6`, a second into
the testimony's stillness, calls a meeting not hushed at its downbeat, which
plays record for record as the one called by `stop=600 play=600.5` (times
taken from each downbeat); and `stop=90 reseed=7@90 play=90.5` on seed 1 lets
its drone go home (`×1.25 third → ×1 tonic`) and plays seed 7's first meeting
as a fresh run does, record for record (the chord book's numbers count on);
(11) **STOP's own race** (PLAN-REFACTOR §2.3): seed 7, `stop=120 play=120.3
stop=120.5` — the PLAY clears the first STOP's timer and the second's fires at
its own 800 ms; with `play=121` after, that PLAY clears the second's, no
press's timer fires after a later press, and meeting 3 plays record for record
as the one called by `stop=121 play=121`; seed 22, the same script — the
second STOP's doors (its meeting's drone) are disconnected by its own timer;
and the paced desk (`desk=0.5`) writes nothing while stopped (`stop=0.7`),
passes the stopped meeting's orders over for the next meeting's (`play=1`),
writes them for a GATHER of the same seed (`reseed=7@0.7`), whose meeting is
the fresh run's record for record, and the pacing moves no record;
(12) **a listener's fault is told** (seed 7, 110 s, PLAN-REFACTOR §2.4):
`badlistener=note,event` — each bad listener's fault is told the first time
and at every thousandth, naming the listener and the layer or the type it
threw on, and kept out of the run's errors, and the dump is the clean run's,
record for record; (13) **the roll call stops PLAY** (PLAN-REFACTOR §2.5):
`loadcheck.js` on scratch copies of the build — whole, the page's guard sets
nothing; `kolob-calendar.js` missing, the guard names it in `KOLOB._broken`;
the calendar left off the list, or two of the composer's rooms swapped, or a
hymnal naming a room the list lacks, each found; (14) **the pure core composes
what it composed** (PLAN-REFACTOR §3.6): `golden.js` on seeds 3, 7 and 22
against `tools/golden/` — every kind matches and the trap is never sprung; the
meeting it plans headless emits the harness's own events at the downbeat, in
order (seed 3's morning is the organist's chorale prelude, which needs the
pipes on); a scratch copy with the Sacred Harp's tempo moved differs in the
hymns of seed 3 alone, and one with a comment added in nothing; (15) **the
wrappers and the labs** (PLAN-REFACTOR §3.7): `lends.js` finds every BORROWED
wrapper exact and used, and fails a scratch copy with one wrapper that renames
(`function foo() { return S.now(); }`) and one that reorders (`cueAt`'s lane and
time swapped), naming both; `loadcheck.js` finds every lab loading its rooms in
its own order, and fails a copy with the singing school moved ahead of
`kolob-pitch.js` on `guests-lab`'s list (and so of the guest rooms' scaffold,
`kolob-guest-room.js`, which it reaches for first), naming the lab and the
room's throw; (16) **the page in pieces** (PLAN-REFACTOR §3.5): the harness's
`staff=` draws seed 7's first 30 s to the same digest twice, and a scratch copy
whose ink is one step bluer to another; `samecode.js --split` holds a little
closure cut in two to its moves (the name it reassigns read through the bag by
a getter: `SAME CODE`), and fails a cut that takes that name once at load and
one whose list changed a number, naming both; (17) **the cost** (PLAN-REFACTOR
§4.0(b)): seed 22, 240 s, rendered with `cost` — the dump is the plain
run's, record for record; the sidecar's works, summed by the selftest, come
to the graph's nodes, automation calls and disconnects and to the notes
told, none outside; every work that told notes built nodes, the band's
notes and nodes are `guest:bands`' and the hymn's throats the ward's pump's;
and `cost.js` holds the sidecar against itself and finds nothing moved;
(18) **the pool** (PLAN-REFACTOR §4.0(c)): two sets of seeds 3, 7 and 22
rendered at once on one pool of three write what one set rendered a seed at
a time writes, every dump and witness the same bytes, and a set whose
harness writes no dump, queued first on a pool of two, stops it: the set
beside it begins none of its renders and says it was stopped.
All eighteen pass on `art/kolob/_harness.js`. Run it after any change to the engine's
events, to the harness or to these tools. It renders into `out/_selftest/`
and, like every tool, refuses while the engine is being edited.

## Files

```
tools/
  README.md          this file
  loadcheck.js       the engine loads headless; the roll call; one hymn proofread; the page's drawing loads and draws; every lab's list loads
  lends.js           the shared bags (KOLOB._s, the page's KOLOB._viz): every read has a lend; every BORROWED wrapper exact (acorn)
  samecode.js        a git ref against the worktree, tokens only (needs acorn: npm install); --split: a cut file's statements, each moved whole (espree, eslint-scope)
  golden.js          the pure core's results on seeds 1–40, hashed, against golden/
  golden/            the baseline: meeting, hymns, guests, organist, ward (.json), each seed's hash
  render.js          seeds → a dump set (+ manifest.json)
  distinctness.js    design law 2
  repetition.js      phrase shapes heard before
  tally.js           counts, plan checks, A/B
  cost.js            the audio graph's cost per work (the harness's cost sidecars), A/B
  screens.js         staff screenshots + frame time (muted Chrome)
  capture.js         WAV + spectrogram + LUFS/peak (muted Chrome)
  selftest.js        the instruments, checked
  lib/dump.js        the dump reader: both event vocabularies, meetings, sections, voices, phrases
  lib/run.js         rendering through the harness: worktree, directory or git:<ref>; the witness's verdict; the pool of harness processes
  lib/engine.js      the engine loaded headless: the one list, the page's list (_viz.php), the page's mock, the roll call, a lab's list (loadcheck, golden)
  lib/canvas.js      a canvas that records instead of painting, every call folded into one digest (the harness's staff=, loadcheck)
  lib/witness.js     preloaded into every harness run: which engine files it actually read
  lib/chrome.js      php -S + muted headless Chrome over CDP
  lib/audio.js       WAV, BS.1770 loudness, true peak, FFT, spectrogram
  lib/util.js        arguments, statistics, markdown
  out/               reports and unpacked git builds (out/_builds/<sha>/); gitignored
```
