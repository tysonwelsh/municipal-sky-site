# KOLOB — the measurement tools

*What `art/kolob/tools/` holds, how each tool is run and how to read what it
writes. Written 2026-10-01 at v0.36.2; keep it true when the tools change.
The owner's rules that bind these tools are in `art/kolob/README.md`.*

Ten tools, all plain Node (22 or later: the browser tools use Node's own
WebSocket) with no packages, except `samecode.js`, which needs the `acorn` that
`npm install` at the repo root brings with ESLint. Three read the engine's
source and nothing else; three read only the harness's dump, so they keep
working when the engine changes; two drive a **muted** headless Chrome.

| tool | answers | reads | time |
|---|---|---|---|
| `loadcheck.js` | Does the engine load, does every room answer, does the facade carry what the page calls, does one hymn proofread? | the source, headless | ~1 s |
| `lends.js` | Does every `S.name` a room reads have a lend somewhere on the shared bag? | the source | <1 s |
| `samecode.js` | Did an edit touch only comments and whitespace? | the source, in git and in the worktree | ~1 s |
| `distinctness.js` | Do two random seeds sound clearly different within three minutes? (design law 2) | the dump | ~2 s for 20 seeds |
| `repetition.js` | How often does a meeting say the same thing twice, and which shapes turn up in every meeting? | the dump | ~2 s for 20 meetings |
| `tally.js` | What is a meeting made of (cadences, guests, sections, notes per layer)? Did a change move it (A/B)? | the dump | ~2 s per 20 seeds; A/B at 60 seeds, under a minute |
| `screens.js` | What does the staff look like at 860 and 390 px, and what does a frame cost at 4× CPU throttling? | the page, muted | real time: ~2.5 min per width |
| `capture.js` | What does a seeded meeting sound like, as a WAV, a spectrogram, loudness (LUFS) and peak? | the page, muted | real time: 4 min for a 4-min window |
| `render.js` | Renders a dump set to keep, or to read twice. | the harness | ~1 s per seed |
| `selftest.js` | Do the instruments still read true? | the harness plus synthetic dumps and signals | ~30 s |

Every report opens with what it measured: the engine, its VERSION, its git
commit, a fingerprint of the module bytes the harness was *seen* to play (see
"Which build is measured"), the seconds per seed, the flags and the harness.
Reports, dumps, PNGs and WAVs go to `tools/out/<tool>-<stamp>/` unless you pass
`--out <dir>`. **`tools/out/` is gitignored** (`tools/.gitignore`) and
`out/_builds/` holds whole unpacked git trees, so a grep over `art/kolob` must
exclude it (`grep -r --exclude-dir=out …`).

```sh
cd art/kolob
node tools/loadcheck.js                          # the engine loads; the roll call; one hymn proofread
node tools/lends.js                              # every S.x read has a lend
node tools/samecode.js                           # HEAD against the worktree: code unchanged?
node tools/selftest.js                           # the instruments, checked (seconds)
node tools/distinctness.js                       # 20 seeds, first 180 s → out/distinctness-…/report.md
node tools/repetition.js                         # 20 seeds, 1200 s, every complete meeting
node tools/tally.js                              # the same, counted
node tools/tally.js --a git:main --b worktree --seeds 1-20   # did my change move the music?
node tools/screens.js --seed 1847                # staff at 20/60/120 s, 860 + 390 px, frames at 4×
node tools/capture.js --seed 1847 --to 240       # four minutes, recorded
```

CI (`.github/workflows/kolob-check.yml`) runs lint, `loadcheck`, `lends`, the
harness and `selftest`. `tally.js --a git:main --b worktree` is the standard
"did my change move the music" check: a housekeeping change must leave every
seed byte for byte the same; a musical change should move only what it meant to.

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
node _harness.js <secs> <seed> [ives] [razz] [cumulative] [force=<guest>] [exp=<spec>]
                 [stop=<secs>,…] [play=<secs>,…] [reseed=<seed>@<secs>,…]
                 [throw=<lane>@<secs>,…] [badlistener=note|event] [desk=<secs>]
                 [dump=<file>] [header]
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
(`setForceRaspberry(true)`), `cumulative` (`setCumulativeMode("always")`),
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
methods the page and the labs call. Then one pure smoke: the composer writes a
hymn from a fixed stream and the Score's proofreader passes it. It prints
`modules: N of N loaded; rooms answering: M`, the hymn, and `ALL GREEN` or the
failures. No harness, no browser: the harness is what plays a meeting, this
only proves the doors open.

## lends.js

```sh
node tools/lends.js                 # exit 0 = no unguarded unknown read
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
room) — and the **dead** lends, lent and never read by any room. `ALL GREEN`
when nothing is unguarded. CI runs it on every push.

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
node tools/tally.js [--seeds 1-20] [--secs 1200] [--first] [--engine …] [--harness …] [--dumps …] [--out <dir>]
node tools/tally.js --a <spec> --b <spec> [--seeds 1-60] [--secs 1200] [--threshold 15] [--harness-a …] [--harness-b …]
```

Here `<spec>` is a dump directory, an engine directory, `git:<ref>` or
`worktree`.

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
node tools/screens.js [--seed 1847] [--times 20,60,120] [--widths 860,390] [--section hymn] [--fps-secs 20] [--throttle 4] [--full] [--ives] [--latin]
                      [--port 8113] [--chrome-port 9423] [--profile <dir>] [--out <dir>]
```

It loads `?seed=N` in muted headless Chrome and presses PLAY. At each time in
the meeting (the audio clock since PLAY, or since the jump with `--section`) it
captures the **staff** canvas at each width: 860 px at DPR 2; 390 px emulated
as a phone at DPR 3; with `--full`, the whole page as well.

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

About half a minute, no browser. It checks twelve things: (1) a real dump from
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
record for record. All twelve pass on `art/kolob/_harness.js`. Run it after any change to the
engine's events, to the harness or to these tools. It renders into `out/_selftest/` and, like
every tool, refuses while the engine is being edited.

## Files

```
tools/
  README.md          this file
  loadcheck.js       the engine loads headless; the roll call; one hymn proofread
  lends.js           the shared bag: every S.x read has a lend
  samecode.js        a git ref against the worktree, tokens only (needs acorn: npm install)
  render.js          seeds → a dump set (+ manifest.json)
  distinctness.js    design law 2
  repetition.js      phrase shapes heard before
  tally.js           counts, plan checks, A/B
  screens.js         staff screenshots + frame time (muted Chrome)
  capture.js         WAV + spectrogram + LUFS/peak (muted Chrome)
  selftest.js        the instruments, checked
  lib/dump.js        the dump reader: both event vocabularies, meetings, sections, voices, phrases
  lib/run.js         rendering through the harness: worktree, directory or git:<ref>; the witness's verdict
  lib/witness.js     preloaded into every harness run: which engine files it actually read
  lib/chrome.js      php -S + muted headless Chrome over CDP
  lib/audio.js       WAV, BS.1770 loudness, true peak, FFT, spectrogram
  lib/util.js        arguments, statistics, markdown
  out/               reports and unpacked git builds (out/_builds/<sha>/); gitignored
```
