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
