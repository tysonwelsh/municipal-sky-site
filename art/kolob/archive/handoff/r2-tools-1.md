> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r2-tools-1: the measurement tools

*Crew: r2-tools. Branch `kolob-r2-tools`. 2026-09-27. Round 2.*

## What shipped

These are the instruments of PLAN-COMPOSITION §2.6/§12 and PLAN-EXECUTION §4,
in `art/kolob/tools/`, with a README that documents their use and the dump
format. All are plain Node with no packages.

| file | what it does |
|---|---|
| `distinctness.js` | Design law 2. It renders the first 180 s of N seeds (default 20) and turns each into a feature vector: keynote, mode, kind, tempo per voice, density per layer, pitch-class, interval and IOI profiles, register, texture, guests, field, material, prelude length. Hooks are ready for dialect, registration, cast and Sunday. It standardises every feature (floored at a JND), measures pairwise D, and lists near-twins, nearest neighbours and the features that separate least. |
| `repetition.js` | Phrase shapes: transposition-free intervals plus rhythm ratios. It gives distinct shapes per hour per voice, and the heard-before rate within a meeting (same voice / any voice; shape / pitch / contour). Across seeds it lists the commonest shapes, with their first hearing in solfège. |
| `tally.js` | Cadence kinds, guests per meeting, section lengths, notes/min and note lengths per layer, events per meeting, modes and kinds, and the §12 plan checks. **A/B** (`--a` / `--b`: a dump dir, an engine dir, `git:<ref>` or `worktree`) reports per-seed stream identity, then every metric's shift against a bootstrap noise band. It flags a shift beyond ±15 % only when the shift is also beyond the noise. |
| `screens.js` | Muted headless Chrome. It captures the staff canvas at 860 px (DPR 2) and 390 px (phone, DPR 3) at chosen meeting times (optionally after a dev jump), then frame time at 4× CPU throttling (p50/p90/p99/max, rAF interval, long tasks) and console errors. |
| `capture.js` | Muted headless Chrome. It records a window of a seeded meeting into a 16-bit WAV, a spectrogram PNG (with loudness curve, a voice raster and section and guest marks) and the page's own notes and events in the dump format. It reports integrated LUFS, LRA, max momentary and short-term, sample and true peak, loudness by minute, and the browser's meeting set against the harness's. `--wav` re-analyses an existing capture. |
| `render.js` | Seeds → a dump set with `manifest.json`, for keeping or handing to a critic. |
| `selftest.js` | Seconds, no browser. It checks a real dump, a synthetic **SCORE §6 typed** dump (with a v0.30 echo that must count once), the D = 0 twin, and BS.1770 loudness references. |
| `lib/` | `dump.js` (the one reader of the dump and both event vocabularies), `run.js` (renders through the harness for the worktree, any directory or `git:<ref>`), `chrome.js` (php -S plus **muted** Chrome over CDP), `audio.js` (WAV, BS.1770, true peak, FFT, spectrogram), `util.js`. |
| `.gitignore` | `out/`, where every report, dump, PNG, WAV and `git:` build lands. |

## How to see it

```sh
cd art/kolob
node tools/selftest.js
node tools/distinctness.js            # → tools/out/distinctness-<stamp>/report.md
node tools/repetition.js
node tools/tally.js
node tools/tally.js --a git:main --b worktree
node tools/screens.js --seed 1847     # ~5 min, muted
node tools/capture.js --seed 1847 --to 240   # ~4.5 min, muted
```

`tools/README.md` carries a sample of each report, all run on this worktree's
engine (v0.32 music with the Question shelved). The full sample outputs,
including the PNGs and the 4-minute WAV, are in
`tools/out/samples/` in this worktree; they are gitignored.

## How it was verified

- **`selftest.js`: all checks pass.** The legacy dump reads as meetings and
  sections, and the typed dump reads the same. A typed `section-start` echoed
  by `§ INVOCATION` merges into one event, and a typed `cadence` echoed by
  `∴ plagal cadence` counts once. The hooks light up: sunday, dialect (house
  and hymn) and cast. A typed `meeting-end` closes the last meeting. Loudness
  matches BS.1770: the 48 kHz K-weighting coefficients equal the spec to 1e-9,
  a 1 kHz tone at −20 dBFS reads −20.0 LUFS in stereo and −23.0 in one channel,
  and relative gating drops a −40 half.
- **Distinctness sanity**, built into every run:
  - the same seed rendered twice gives D = 0.000;
  - a planted twin (seed 1 a semitone up, 4 % slower) gives D = 0.099, which is
    flagged; no real pair is closer;
  - every pair of different seeds gives D > 0.
- **Tally A/B:**
  - `worktree` against `worktree`: 10 of 10 seeds are byte-identical and
    nothing is flagged.
  - `git:main` (the live v0.32, single-file, loaded with KOLOB_LEGACY)
    against the worktree flags exactly two metrics, guests per meeting (−50 %)
    and the Question (gone). 10 of 20 seeds are byte-identical: the meetings
    the Question never sat in. That is the owner's "its dice are still drawn",
    measured.
- **Muted browsers:**
  - Every Chrome is launched with `--headless=new --mute-audio
    --autoplay-policy=no-user-gesture-required`, port 9423, and the profile
    `/private/tmp/claude-501/kolob-r2-tools-chrome`.
  - `launch()` refuses to start one without `--mute-audio`.
  - Page analytics and the newsletter endpoint are blocked.
  - After every run, `pgrep` showed no Chrome on 9423 and no php on 8113.
- **The capture keeps time.** A first version tapped with an AudioWorklet.
  That moved Chrome's graph rendering onto the worklet thread, which ran at
  **0.36× real time** under the machine's load, and the meeting itself slowed.
  (The bare page keeps 1.00×, measured.) The ScriptProcessor tap with a
  ConstantSource time ramp runs at **0.995–0.997×**, captures every sample of
  the window, and records no dropouts (4-minute sample).
- **`screens.js` bug found and fixed:** default `--times` were parsed as
  strings, so every shot was taken at about 1 s. Default lists now go through
  the same parser, and a guard refuses any shot more than 2 s off its time.
- **Plain `dump=` is unchanged:** a 1500 s dump of seed 1847 from the edited
  harness is byte-identical to one from the original harness.

## What the tools already say about the current engine (for the panel)

- **Distinctness (20 seeds, first 180 s):**
  - No near-twins. The median D is 0.547 and the closest pair is 0.283
    (seeds 4 and 17: both ionian, ordinary, at the same pulse).
  - What every seed shares is the frame: the drone, a prelude of 68–92 s,
    organ and strings at one slow rate, and no guest in 17 of 20.
  - The keynote moves only within B♭3–D4 (3.8 semitones).
  - The difference is carried by mode and kind (24 % of all distance), the
    day's material (16 %), and the pitch and tempo profiles.
- **Repetition (20 complete meetings):**
  - 5.7 % of phrases are heard before in the same voice; the motif engine
    barely repeats.
  - The one rut is the **band's loop**: 71 % heard before. The seeds with a
    band rise to 16–25 %.
- **Tally (20 complete meetings):**
  - The plagal share is **84.6 %**, against the §12 target of 30–55 %. This is
    v0.30's rut; the dialects will fix it.
  - 45 % of meetings carry a guest (plan ≈ 55 %).
  - Meetings run 14.4 min on average (10.1–19.1).
  - The Question never seats ✓.
- **Capture (seed 1847, 0–4:00):**
  - −16.2 LUFS integrated, LRA only **2.5 LU** (very flat: the master chain
    holds it level), sample peak −5.4 dBFS, true peak −5.36 dBTP.
  - The browser plays the harness's plan (mode, kind, keynote and section
    starts within 0.5 s), but note for note the two part at **0:15**: only 7
    of the harness's 144 notes sound in the browser. Two browser runs of the
    same seed also part from each other.
  - This is PLAN §2.2's REPRO problem: one die drawn in timer order, and the
    audio clock read at callback time. Until 0b lands, the harness tools
    describe the meetings a seed *would* play, statistically the same, and the
    capture shows the one it did.
- **Screens (seed 1847):**
  - Frame cost at 4× throttle is p50 1.1–1.2 ms at both widths, with p99
    5.1 ms at 860 px and 13.2 ms at 390 px (the phone, during the invocation;
    max 22.6 ms). That is inside the 16.7 ms budget, and the phone's p99 is the
    number to watch as the Score multiplies the ink.
  - Headless Chrome paced rAF at about 8.6–10 fps here, so the frame *count*
    means nothing; each frame's cost is valid.
  - No console errors at either width.

## Harness changes (`art/kolob/_harness.js`, untracked; please copy it from this worktree)

Two additions. Default behaviour and plain dumps are unchanged.

1. **`KOLOB_DIR=<dir>`** loads the modules from another engine directory: a
   `git archive` build, or another worktree. One harness can then measure two
   builds without being copied into either.

   ```js
   const ENGINE_DIR = process.env.KOLOB_DIR ? path.resolve(process.env.KOLOB_DIR) : __dirname;
   const LOAD = process.env.KOLOB_LEGACY ? [process.env.KOLOB_LEGACY] : MODULES.map((m) => path.join(ENGINE_DIR, m));
   ```
2. **`header`** (an opt-in argument) makes the dump's first line
   `["H", 0, {format: "kolob-dump", v: 1, seed, secs, flags}]`. It is built from
   the arguments only, so same-argument runs stay byte-identical. It is opt-in so
   that a plain `dump=` stays byte-identical to the dumps already on disk (for
   example the integrator's `shelf-*.jsonl`). The tools pass it, and they read
   dumps without it too.

## Requests to the integrator

1. **Copy `_harness.js`** from this worktree into kolob-2 and the live
   worktrees, and keep a durable copy (the second look suggested `local-dev/`).
   The engine crew will also be changing it (the streams and the clock); the
   two edits touch different lines. If the engine crew adds modules, `MODULES`
   must still match `index.php`, or `git:` builds will stop with a `LOAD` error
   (the tools report it rather than measure half an engine).
2. **Publishing:** `art/kolob/tools/*.js` are tracked, so `scripts/publish.sh`
   would upload them. `*.md` is already excluded. They are dev tools, like the
   gitignored harness. Consider excluding `art/kolob/tools/` in publish.sh and
   deploy.yml. That is not my file.
3. **SCORE §6 additions** would let the tools read a fully typed engine:
   - `meeting-end {n, dur?}`: without it, a typed engine's last meeting can
     only close at the next `meeting-start`. The reader already understands it.
   - a way to say the organ **registration**: a `registration {name | stops}`
     event, or a `registration` field on `verse-start` or `hymn-announced`.
     The reader already takes any of these.
   - `meeting-start.sunday` and `houseDialect`, `hymn-announced.hymn.dialect`,
     and `cast {memberId}` or `note.memberId` are already in the contract. When
     the engine emits them, they join the distinctness distance with no change
     to the tools.
4. For the **Listener's packet**, use `capture.js --seeds a,b,c,d,e,f --to 240`
   (about 25 min, sequential) and `capture.js --seed n --meeting`.

## Known issues and limits

- **Harness meetings are not browser meetings** until the 0b streams and clock
  land (see above). Every capture report shows where the two part.
- **Headless rAF pacing** (about 8.6–10 fps on this machine): screens reports
  the cost per frame, not frames per second.
- **Real time:** a capture and the screenshot times cost wall-clock time, and
  there is no parallel mode. The AudioWorklet route that would allow one slows
  the meeting.
- **Judgment calls, documented in the README:** the distinctness weights and
  JNDs, the relative near-twin threshold (0.5 × the median D), and repetition's
  phrase cut (0.35 s breath, 12 notes max). Organ and strings "phrases" are
  root motion, not melody.
- **The true peak is an estimate** (4× windowed sinc, within 0.1 dB of the
  exact value on test tones).
- tally counts the cumulative form (`◌ the tune is withheld`) as a guest, as
  the engine's log does.
- The tools need Chrome at `/Applications/Google Chrome.app` and `php` on the
  PATH. Ports default to 8113 (http) and 9423 (Chrome), and both can be
  changed with `--port` and `--chrome-port`.

---

## Round 2: the critic's twelve, fixed

*Crew: r2-tools (continuing). Branch `kolob-r2-tools`. 2026-09-27. The critic's
report is answered item by item. I disagreed with none of them. Two go further
than asked (item 1, item 6), and the reasons are given.*

### 1. MUST FIX: an A/B could say "nothing moved" about a build it never played

**What was wrong.** The critic was right, and my round-1 request 1 ("the two
edits touch different lines") was wrong. The engine crew rewrote the loader.
Their harness reads `KOLOB_BASE` and the build's `_engine.php`, and it never
saw `KOLOB_DIR`. So every `git:` side rendered the worktree's own engine, and
the identity line said "6 of 6 identical — nothing moved" while printing two
different fingerprints.

**What shipped.** The tools no longer take a harness at its word.

- **The witness** (`tools/lib/witness.js`, new). It is preloaded into every
  harness the tools run (`node -r`, env `KOLOB_WITNESS`). It stands by
  `fs.readFileSync` and records every engine file the harness actually reads,
  `kolob-*.js` and the substrate's `pj2-*.js`: its real path and the SHA-1 of
  its bytes. It writes `seed-N.witness.json` beside each dump. It needs no
  cooperation from the harness, so it works on this crew's harness, on the
  engine crew's, and on anyone's.
- **The verdict** (`lib/run.js` `verify()`). Before any number is computed,
  each render is held against the build it was meant to render, and the set
  is **refused** when:
  - a module came from another directory, or a substrate script from another
    substrate;
  - a module on the build's own list went unread, or a module off the list was
    read. The list is the build's `_engine.php`, else `index.php`'s
    `$kolob_engine`, else the single file;
  - the bytes differ from the list's, or changed mid-render, or differ between
    seeds;
  - nothing was witnessed at all;
  - the dump header's `engine` field disagrees with the witness.

  This applies to every engine, the worktree included, not only the
  non-worktree ones. The refusal names the harness, the build and each fault,
  without a stack.
- **The harness says it too**, as the critic asked. This worktree's
  `_harness.js` now writes `engine: {dir, legacy, files, fingerprint}` into the
  `H` header, and prints `engine: 12 modules from <dir> · fingerprint …` in its
  log. It reads `KOLOB_BASE` as well as `KOLOB_DIR`. `run.js` sets both, and
  `KOLOB_LEGACY` for a single-file build.
- **The fingerprint** in every report is now the witnessed one: SHA-1 over the
  files played, in name order, each its name and then its bytes. It no longer
  hashes every `kolob-*.js` in the directory, so a lab module can no longer
  move it. For that reason, the round-1 fingerprints (`99dc9a8c64` for the split)
  now read `074ee44959` for the same bytes.
- **Tally A/B** adds a line when every shared seed played identically but the
  fingerprints differ: "the modules' bytes differ … but not the music".

*Why a witness, beyond what was asked.* The critic's fix, "the harness writes
what it loaded", still trusts the harness. A harness that ignored
`KOLOB_BASE` could as easily write the wrong `dir`, or no header at all, and the
engine crew's harness writes none today. The witness sees the reads, so a
refusal never depends on the harness's cooperation. The harness's own
statement is kept, and it is cross-checked whenever it is present.

**Verified:**

- **The critic's repro, rebuilt.** I copied the critic's scratch repo (tag
  `v032` with the engine crew's snapshot over it) into my scratchpad and laid
  these tools on it. `--a git:v032 --b worktree --seeds 1-6` now reads "0 of 6
  shared seeds played identically". A is `074ee44959` (12 files, the list in
  index.php, witnessed) and B is `9f0d73ba0f` (15 files, the list in
  _engine.php, witnessed).
- **A harness that ignores both variables** (a wrapper that deletes them and
  requires the engine crew's harness) is refused: "12 of the files it played
  … came from art/kolob, not from …/_builds/90126a3dd55f/art/kolob; none of
  the 12 modules on the build's list (index.php) was read from the build".
  The critic's second repro fails the same way. It uses a copy of the kolob-2
  integration harness, which plays its own directory, on a build whose prelude
  is widened to `rnd(150, 200)`. The same build rendered by a harness that
  listens flags `length: prelude` at 181 s against 82.5 s, **⚑ SHIFT**, with
  0 of 10 seeds identical.
- **`selftest.js` §5 keeps this permanently.** A copy of the engine with one
  comment added is accepted under its own fingerprint. The same copy through
  the deaf wrapper is refused.
- **Plain `dump=` output is still byte-identical** to the round-1 harness
  (seed 1847, 200 s, `cmp`).

### 2. SHOULD FIX: a collapsed build read as mostly distinct

The near-twin rule was relative to the median, and the median shrinks with a
collapsed build. The planted twin is now a yardstick the build cannot move.

- A pair is a near-twin when D < 0.5 × the median, **or D ≤ 1.5 × the planted
  twin's D** (`--plant-floor`).
- A **spread** verdict line holds the median against the plant. At 3× or less
  (`--collapse`) it says **⚠ COLLAPSED**.
- The plant is now always built, even with `--no-sanity` or `--dumps`, because
  it anchors the floor. `--no-sanity` only skips the same-seed re-render.

On the critic's collapsed set (`mkcollapse.js`, 20 near-copies of seed 1), the
report now reads: spread **0.7×, ⚠ COLLAPSED**, and near-twins **172 of 190
pairs**, up from 41. On the real engine: spread 5.5×, near-twins none, and
every other number unchanged. The sanity line now asks what still means
something once the floor is anchored on the plant: that the plant is seen
(D > 0) and falls inside the relative line.

### 3. SHOULD FIX: tally's A/B counted the harness's start-up line

`transport` is no longer a metric at all. `metricsFor` leaves it out, and the
report's "How it is counted" says why. The critic's pair (the `set1200` tools
dumps against the engine crew's `engdumps`) no longer raises
`per meeting: transport (−100 %)`, and `selftest.js` §6 checks it.

### 4. polish: the rAF-pacing note needed > 100 ms

The threshold is now 25 ms (a display paces rAF at 16.7). The round-2 sample
paced at 50.0 ms at 860 px and 99.9 ms at 390 px, and the note now names both:
"about 20.0 and 10.0 fps".

### 5. polish: frame cost and the machine's load

- The frame table has a **load avg** column, the larger of `os.loadavg()[0]` at
  the start and end of each width's timing.
- When the load is over half the cores, a **⚠ The machine was busy** line says
  that p99, max and long tasks run high under load, and asks for a quiet re-run.
- A note says what p99 rests on: "4 of 354 at 860 px, 3 of 270 at 390 px".
- The README says both, with the critic's numbers (p99 21.1 against 5.07 at a
  load of about 11).

The round-2 sample itself ran at a load of 10.6 and 8.9 on 11 cores, and it
carries the warning.

### 6. polish: discontinuities were a count

- **Listed.** Each discontinuity has its meeting time to the millisecond, hole
  or overlap, samples and milliseconds, render quanta, and the raw reading.
  They go in a table at the top of the seed's section, and into `…-tap.json`.
- **Marked on the PNG.** Each gets a red triangle and a dashed red line
  through every strip, labelled `tap gap N smp`. Labels of close marks stack
  instead of overprinting.
- **Explained.** The report says a discontinuity is the recording's, not the
  engine's. The graph rendered those frames, since its clock ran on, but the
  tap never got them, so the WAV holds silence there.
- **Coverage is exact.** The tap line says "all but N samples" where it used to
  round to "100.0 %".

*Beyond what was asked: the blocks are laid better.* The critic's two holes (126
samples at 40.928 s, then 2 samples at 41.272 s) are one event, not two:

- 41.272 − 40.928 = 0.344 s = 16 384 + 128 samples, one buffer and one quantum
  later.
- One render quantum (128 frames) never reached the tap. The block after it was
  read 2 samples early off the float32 time ramp, and the next block's correct
  reading left a 2-sample "hole" behind it.

So `assemble()` now does two things:

- It takes a block within the ramp's reading tolerance of contiguous (at least
  ±4 samples, and more late in a long meeting, where a float32 holds the audio
  time less finely) as contiguous, since ScriptProcessor buffers are.
- It snaps a real gap to the render quanta it must be, and keeps the raw
  reading in the table.

`selftest.js` §7 plays exactly this case: a hole read as 126 comes out as one
hole of 128 at 0:40.9, with the neighbours laid contiguous.

*Also:* `--wav` re-analysis reads the capture's `-tap.json`. Without one, it
re-finds holes in the WAV itself as runs of exact digital zero in both
channels with sound on either side (`audio.zeroRuns`). On the critic's own WAV
that finds 0:40.928 (126) and 0:41.272 (2) and marks both. The sample is in
`tools/out/samples-r2/reanalysis-critic-1847/`.

*Seen live.* The round-2 sample capture (seed 1847, 0–4:00, load about 9–10)
had one hole of its own. The tap measured it at 1:34.491, exactly 128 samples,
one render quantum. The report lists it and the picture marks it. The
zero-run detector, run on the WAV alone, finds the same place and size, and a
`--wav` re-analysis reproduces every number and the mark.

### 7. polish: `∴ the room empties` counted as a joint

The engine tells it before the `∴ joint` of the same joint (`runJoint`, kolob-meeting.js:428 then :470). `dump.js`
now reads it as `joint-still`, which marks the joint that follows as `stillJoint`,
and does not count it as a joint. Across the 20-meeting set: joints per meeting
7.65 = sections per meeting 7.65, 0 mismatches, 40 still joints (2 per meeting:
into and out of the sacrament). `selftest.js` §6 checks both on seed 3 (the
critic's example): 8/8.

### 8. polish: the self-test lacked the gating check the docs claimed

`selftest.js` §4 now runs:

- EBU Tech 3341 cases 3, 4 and 5. They read −23.01, −23.01 and −22.98 LUFS,
  each −23.0 ±0.1.
- The −20/−40 half-and-half case. It reads −20.01, where an ungated meter
  would read −23.0.

### 9. polish: no `--profile`, and a second run could not start

- `screens.js` and `capture.js` take `--profile <dir>`.
- Without it the profile follows the port: `…/kolob-r2-tools-chrome` on 9423,
  `…-chrome-9424` on 9424, and so on.
- `launch()` reads the profile's `SingletonLock` and refuses, naming the
  process, when another Chrome holds it. Before, the second Chrome would have
  handed itself to the first and quit, and the run would have hung.

*Verified:* a `capture.js --wav` re-analysis on `--chrome-port 9424` came up and
finished while `screens.js` held 9423. The README says to give a parallel run
its own `--port` too.

### 10. polish: the spectrogram's margin clipped `harmonium`

The left margin is now measured: the widest row label plus 16 px, and at least
74. `harmonium` fits in the round-2 capture sample
(`tools/out/samples-r2/capture-1847/…-spectrogram.png`).

### 11. polish: `--meeting` did not read a typed `meeting-end`

The end is found by `meetingEnd()`, through the dump reader's `normEvent`, so
both vocabularies read alike: a v0.30 joint (`meeting ends · 8s`), a typed
`meeting-end {dur}`, or else the next meeting's start. `selftest.js` §7 checks
all three (815 / 711 / 900 s).

### 12. polish: A/B with unequal seed sets ran without a word

- The header prints both seed lists when they differ.
- A **⚠ A and B hold different seeds** line opens the verdict.
- The identity line counts "shared seeds".

The noise concern goes further:

- **A/B now renders 60 seeds a side by default.** Two builds took 32–43 s here.
- The noise line advises `--seeds 1-60` whenever a side has fewer than 40
  meetings.
- The README recommends 60 for every A/B after the re-base.

The 60-seed sample of `git:main` against the worktree resolves "meetings with a
guest" (−30 %, noise 18.4 pt) as a verdict. At 20 seeds it was noise (±30.5 pt).

**Also found and fixed on the way:**

- **Tally's default "meetings A/B" count** showed the union of both sides
  (118/118) for every metric without its own support count. It now counts per
  side.
- **The harness-verdict summary** repeated reasons. They are de-duplicated.
- **A harness that cannot load a single-file build** now says so and names
  `KOLOB_LEGACY`. It used to say only "no dump".

### Harness changes, round 2 (`art/kolob/_harness.js`, untracked)

These are additive, and a plain `dump=` is byte-identical:

- `KOLOB_BASE` is honoured, as well as `KOLOB_DIR`.
- The `header` line carries `engine: {dir, legacy, files, fingerprint}`.
- The log has an `engine:` line.

### Requests, round 2 (these replace round-1 request 1)

1. **Take the engine crew's harness as the one harness, and port two things
   onto it.** It already reads `_engine.php` and `KOLOB_BASE`, which the tools
   now set, so `KOLOB_DIR` does not need porting. The tools work with it as it
   stands: `selftest.js` passes everything but the two header checks. The port
   is about 17 lines, tested on a scratch copy of their harness. With it, the
   self-test passes whole, and single-file builds (`git:main`) render:

   ```diff
   -const LOAD = ENGINE.list.map((m) => path.resolve(DIR, m));
   +// KOLOB_LEGACY=<file> (r2-tools): one old single-file engine (v0.30, the live v0.32) instead of the list
   +const LOAD = process.env.KOLOB_LEGACY ? [path.resolve(process.env.KOLOB_LEGACY)] : ENGINE.list.map((m) => path.resolve(DIR, m));
   ```
   and after `const stream = [];`:
   ```js
   // `header` (r2-tools, dump format 1): the dump's first line says what was run
   // and which engine played it — where the modules were read from, and the
   // SHA-1 of their names and bytes in name order (art/kolob/tools/lib/witness.js
   // hashes the same way, and the tools refuse a dump whose engine is not the
   // one they asked for). Opt-in, so a plain dump= stays as it was.
   if (DUMP && argFlag("header")) {
     const h = require("crypto").createHash("sha1");
     LOAD.map((f) => path.basename(f)).filter((b) => SOURCES_TEXT[b] != null).sort()
       .forEach((b) => { h.update(b); h.update(Buffer.from(SOURCES_TEXT[b], "utf8")); });
     stream.push(JSON.stringify(["H", 0, {
       format: "kolob-dump", v: 1, seed: SEED, secs: RUN, flags: ["ives", "razz", "cumulative"].filter(argFlag),
       engine: { dir: DIR, legacy: process.env.KOLOB_LEGACY ? LOAD[0] : null, list: process.env.KOLOB_LEGACY ? "KOLOB_LEGACY" : ENGINE.from,
         files: LOAD.map((f) => path.basename(f)), fingerprint: h.digest("hex").slice(0, 10) },
     }]));
   }
   ```

   Until the port lands, nothing measures the wrong build. The witness guards
   every render, and a dump without `engine` is still accepted on the witness's
   word.
2. **Unchanged from round 1:**
   - exclude `art/kolob/tools/` from publishing (request 2);
   - the SCORE §6 additions `meeting-end {n, dur?}` and `registration`
     (request 3). `meeting-end` is now read by capture's `--meeting` too;
   - the Listener's packet commands (request 4).

### How to see it

```sh
cd art/kolob
node tools/selftest.js                                    # 7 sections, ~5 s, all ✓
node tools/tally.js --a git:main --b worktree             # 60 seeds a side, ~35 s
node tools/distinctness.js --dumps <a collapsed set>      # the spread line, ⚠ COLLAPSED
node tools/screens.js --seed 1847                         # load avg column, pacing and p99 notes
node tools/capture.js --seed 1847 --to 240                # discontinuities listed and marked, -tap.json
node tools/capture.js --wav <old capture.wav> --chrome-port 9424   # holes re-found in the WAV, beside another run
```

The round-2 samples are in `tools/out/samples-r2/` (gitignored), and the README's
samples are updated from them.

### Known issues, round 2

- The witness sees reads through `fs.readFileSync`. A future harness that loads
  modules some other way (`require`, `fs.promises`) is refused ("it read no
  kolob-*.js"), not trusted. Widening the witness is a few lines.
- `verify()` knows a build's list only from `_engine.php` or from `index.php`'s
  `$kolob_engine` literal. A build with neither, such as an early kolob-2
  commit that listed `<script>` tags, is checked by directory and bytes only.
- **A snapped gap is an inference.** A measured 126 becomes 128 because the
  graph cannot drop less than a quantum. The raw reading stays in the table.
- **The screens sample was taken at a load of about 10.** Its p99 and max are
  the machine's. Round 1's quieter numbers are kept beside it in the README.
