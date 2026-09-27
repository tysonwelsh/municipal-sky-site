# KOLOB 2 — the measurement tools

*These are the instruments the critics and the owner's listening packets read
from (PLAN-COMPOSITION §2.6 and §12; PLAN-EXECUTION §4). Round 2, crew
r2-tools, 2026-09-27.*

Five tools, one self-test and one renderer. All are plain Node with no packages
(Node 22 or later: the browser tools use Node's own WebSocket). Three of them read
only the harness's dump, so they keep working when the engine changes. Two drive
a **muted** headless Chrome.

| tool | answers | reads | time |
|---|---|---|---|
| `distinctness.js` | Do two random seeds sound clearly different within three minutes? (design law 2) | the dump | ~2 s for 20 seeds |
| `repetition.js` | How often does a meeting say the same thing twice, and which shapes turn up in every meeting? | the dump | ~2 s for 20 meetings |
| `tally.js` | What is a meeting made of (cadences, guests, sections, notes per layer)? Did a change move it (A/B)? | the dump | ~2 s per 20 seeds |
| `screens.js` | What does the staff look like at 860 and 390 px, and what does a frame cost at 4× CPU throttling? | the page, muted | real time: ~2.5 min per width |
| `capture.js` | What does a seeded meeting sound like, as a WAV, a spectrogram, loudness (LUFS) and peak? | the page, muted | real time: 4 min for a 4-min window |
| `render.js` | Renders a dump set to keep, or to hand to a critic. | the harness | ~1 s per seed |
| `selftest.js` | Do the instruments still read true? | the harness plus a synthetic dump | ~1 s |

Every report opens with what it measured: the engine, its VERSION, its git
commit, a fingerprint of the module bytes, the seconds per seed and the flags.
Reports, dumps, PNGs and WAVs go to `tools/out/<tool>-<stamp>/`, which is
gitignored, unless you pass `--out <dir>`.

```sh
cd art/kolob
node tools/selftest.js                           # the instruments, checked (seconds)
node tools/distinctness.js                       # 20 seeds, first 180 s → out/distinctness-…/report.md
node tools/repetition.js                         # 20 seeds, 1200 s, every complete meeting
node tools/tally.js                              # the same, counted
node tools/tally.js --a git:kolob-2 --b worktree # A/B: did my change move the meeting?
node tools/screens.js --seed 1847                # staff at 20/60/120 s, 860 + 390 px, frames at 4×
node tools/capture.js --seed 1847 --to 240       # the Listener's four minutes
```

## Silence: the owner's rule

**Every browser these tools launch is muted.** `lib/chrome.js` starts Chrome
with `--headless=new --mute-audio --autoplay-policy=no-user-gesture-required`,
the debugging port 9423 and the profile `/private/tmp/claude-501/kolob-r2-tools-chrome`.
`launch()` refuses to start a Chrome without `--mute-audio`. Each report
prints the flags it ran with.

- The capture tap sits inside the page, so it hears the signal while the
  speakers hear nothing.
- The page's analytics and newsletter endpoints are blocked, so test visits are
  not counted.
- The tools start their own `php -S 127.0.0.1:8113`, or reuse one already
  running, but only if its `kolob-core.js` is byte-identical to this tree's.
- Chrome and the server are killed on exit, including on Ctrl-C.

## Which build is measured

The three dump tools render through the harness (`art/kolob/_harness.js`,
untracked). They can point it at any build:

| `--engine` (or `--a` / `--b` in tally) | what is rendered |
|---|---|
| *(default)*, `worktree` | this worktree's `art/kolob` |
| `<dir>` | any directory with `kolob-core.js`, or v0.30's single-file `kolob-audio.js` |
| `git:<ref>` | a build out of git (`git archive <ref> art/kolob 'art/prosperos-jukebox-v2/*.js'`, unpacked into `out/_builds/<sha>/`), for example `git:main` (v0.32 live) or `git:kolob-2` |
| `--dumps <dir>` | a dump set already rendered (by `render.js`, or anyone's `dump=` runs) |

**The harness used** is `--harness <file>` if you give one. Otherwise it is the
engine directory's own `_harness.js`, or this worktree's for a `git:` build.
`KOLOB_DIR` points it at the engine's modules. A single-file build is loaded
with `KOLOB_LEGACY`. Nothing is ever written into an engine directory. If the
harness cannot load a build, for instance because its module list names files
the build lacks, the tool stops with the harness's `LOAD` error rather than
measuring half an engine.

## The dump format (v1)

These tools depend on the dump and nothing else. The harness writes it with
`node _harness.js <secs> <seed> [ives] [razz] [cumulative] dump=<file> [header]`:
one JSON array per line, `[kind, t, payload]`.

| kind | `t` | payload |
|---|---|---|
| `"H"` | 0 | **header**, first line, written only when the harness is given the `header` argument (the tools always give it): `{format: "kolob-dump", v: 1, seed, secs, flags: [...]}`. It is built from the arguments alone, so same-argument runs stay byte-identical. It is opt-in so a plain `dump=` stays byte-identical to older dumps. A dump without it still reads: the seed comes from the `▶ … seed N` event or the file name, and the length from the last record. |
| `"N"` | the harness clock when the note was *emitted* (scheduled) | **a note** exactly as `onNote` delivers it: `{layer, freq, startTime, duration, …extra}`. `startTime` is when it sounds, and is usually ahead of `t`. Extras today: `marks` (telegraph), `part`, `beat` and `loud` (band). SCORE §6 adds `part, hymnId, beat, syl, deg, monzo, marks`. |
| `"E"` | the harness clock at emission | **an event** exactly as `onEvent` delivers it. v0.30's log events are `{cat, label, detail, t}`; SCORE §6's typed events are `{type, t, …payload}`. |

**How the reader (`lib/dump.js`) takes it**

- **Times.** A note's time is its `startTime`. An event's time is its `t`, or
  the record's `t` when the event has none.
- **Forward compatibility.** Lines of any other kind are skipped, and so is an
  unparseable line. An event neither vocabulary knows is still counted in
  tally's "events per meeting", by its `cat` or `type`.
- **Both vocabularies at once.** During the migration one happening may be told
  twice: a log line and a typed event within a fraction of a second. The two
  are merged into one (meetings, sections, cadences, guests, hymns), and the
  merged event keeps both sets of fields.
- **Meetings** run from one meeting-start to the next. The last meeting is
  complete only if the log says it ended inside the run (`∴ joint — meeting ends`).
  **Sections** run from one section start to the next, joint included.
- **Voices** are one line per layer, or per `layer:part` when notes carry
  `part`. A chordal layer without parts (v0.30's choir prints SATB at one
  onset) is read by its top line. Unpitched notes (`freq` 0) never make a voice.

**The words the reader knows.** v0.30's log is read by its words, not its glyphs:

| v0.30 log (`cat` · label) | reads as | SCORE §6 typed |
|---|---|---|
| `meeting` · `☀ meeting N` (detail `F0 … Hz · mode · kind · season`) | meeting: mode, kind, keynote = F0×4 | `meeting-start {n, sunday, kind, mode, keynoteHz, houseDialect}` |
| `meeting` · `☀ sunrise` | mode change | — |
| `section` · `§ HYMN` (detail `[meter ·] 87s`) | section, planned length, meter | `section-start {section, index, dur?}` |
| `harmony` · `∴ plagal cadence` | cadence (plagal, authentic, half, …) | `cadence {kind}` |
| `cadence` · `∴ joint` (`meeting ends · 8s`) | section joint; the end of a meeting | `meeting-end {n, dur?}` *(requested; read already)* |
| `visitation` · `? the question`, `⇋ a band approaches`, `◎ the steeples answer`, `✧ an old tune remembered`, `∴ raspberry`, `◌ the tune is withheld` | guest start: question, bands, steeples, oldtune, raspberry, cumulative (with their end and mark lines) | `guest-start` / `guest-end {guest, section, logged}` |
| `motif` · `❁ the day's hymns` | the day's material (gestures) | `hymn-announced {hymn: {id, meter, dialect}}` |
| `verse`, `fuging`, `conductor` (`still small`), `ambient`, `telegraph`, `transport` (`seed N`) | lines, lining out, fuging, stillness, field events, telegraph, seed | `verse-start`, `telegraph`, … |
| — | — | `cast {memberId}`, `vision {name}`, `registration {name \| stops}` |

**Hooks for what the engine does not say yet.** Distinctness is ready for three
things: the organ **registration**, the **dialect** and the **cast**.

- **Dialect** is read from `meeting-start.houseDialect`, from
  `hymn-announced.hymn.dialect`, or from any event with a `dialect` string.
- **Registration** is read from any event or note with a `registration` field,
  or from an event of type `registration`.
- **Cast** is read from `cast` events and from notes with `memberId`.
- **Sunday** is read from `meeting-start.sunday`.

A dump that carries these gets them into the distance with no change to the
tools. `selftest.js` proves it on a synthetic typed dump.

## distinctness.js

*Design law 2: "Two random seeds must sound clearly different within three
minutes."*

```sh
node tools/distinctness.js [--n 20 | --seeds 1-20] [--window 180] [--engine …] [--dumps …] [--twin 0.5] [--no-sanity]
```

It renders the first `--window` seconds of each seed and describes each seed by
what a listener could notice in that window. The features fall into groups:

| group | features |
|---|---|
| identity | keynote, mode, kind of Sunday (and the Sunday, when typed) |
| style *(hook)* | dialect, registration |
| cast *(hook)* | who is heard |
| tempo | median inter-onset interval per voice, and pooled |
| density | notes per minute per layer |
| pitch | the pitch-class profile against the keynote (duration-weighted), and the melodic-interval profile |
| rhythm | the inter-onset-interval profile |
| register | the median pitch and the p10–p90 span |
| texture | the silence share (nothing but drone and field), polyphony, layers heard |
| guests | guests begun in the window |
| field | the field events |
| material | the day's gestures (typed: hymns announced) |
| form | the prelude's length, and sections entered |

**Standardising.** Each numeric feature is standardised by its spread across the
seeds. The spread is floored at a just-noticeable difference (for example
60 cents for the keynote, 7 % for a tempo, 15 s for the prelude), so an
inaudible spread never counts as separation. A difference of two spreads counts
as fully different. Profiles use the Jensen–Shannon distance, sets use the
Jaccard distance, and categories count 0 or 1. **D** is the weighted mean over
groups. A feature that one seed lacks, or a layer neither seed sounds, sits the
pair out.

**The report** gives:

- the D distribution and the **near-twins** (D < 0.5 × the median);
- the closest pairs, with what they share and what they don't;
- each seed with its nearest neighbour;
- **the features that separate seeds least**, meaning the share of pairs within
  one JND, with the range across the seeds;
- where the distance comes from;
- `distances.csv` and `features.json`.

**Sanity checks, built in.**

- The first seed is rendered twice and must be D = 0.
- A **planted twin** must be flagged. It is the first seed heard a semitone
  higher and 4 % slower: the same Sunday in another key.
- Every pair of different seeds must be D > 0.

### Sample (this worktree, v0.32 music with the Question shelved, seeds 1–20)

> - **Pair distance D:** median **0.547**, p10 0.451, p90 0.667, closest 0.283.
> - **Near-twins** (D < 0.5 × median = 0.274): **none**.
> - **Sanity:** the same seed rendered twice (seed 1) D = 0.000 ✓; a planted twin (seed 1 a semitone higher and 4 % slower) D = 0.099, flagged as a near-twin ✓ (0 of 190 real pairs are closer); every pair of different seeds D > 0 ✓.
> - **Separates least:** density: drone (100 % of pairs not separated), prelude length (87 %), density: strings (85 %), density: organ (82 %).
> - **Separates most:** identity (24 % of all distance), material (16 %), pitch (13 %), tempo (12 %).
> - **Hooks not yet fed by the engine:** cast, dialect, registration, sunday.

| feature | pairs not separated | JND | across the seeds |
|:---|---:|---:|:---|
| density: drone | 100 % of 190 | 0.25 | 1.0–1.3 /min |
| prelude length | 87 % of 190 | 15 | 68–92 s |
| density: strings | 85 % of 190 | 0.25 | 0.7–1.7 /min |
| density: organ | 82 % of 190 | 0.25 | 2.3–4.3 /min |
| guests | 72 % of 190 | Jaccard 0.5 | none in 17/20 |
| silence share | 59 % of 190 | 0.08 | 12 %–32 % |
| keynote | 33 % of 190 | 0.05 oct | B♭3+24¢ – D4+4¢ (3.8 semitones) |

Read for the Variety critic:

- No two first-three-minutes are twins.
- What every seed shares is the frame: the drone, a prelude of 68–92 s, organ
  and strings at the same slow rate, no guest in 17 of 20.
- The keynote moves within only a major third.
- The difference is carried by the mode and kind of Sunday, the day's material,
  and the pitch and tempo profiles.

## repetition.js

```sh
node tools/repetition.js [--seeds 1-20] [--secs 1200] [--first] [--min 3] [--common-min 4] [--engine …] [--dumps …]
```

**Phrases.** Every voice's line is cut into phrases. A phrase ends at a breath,
meaning more than 0.35 s of silence between a note's end and the next onset, or
after 12 notes. Phrases under `--min` notes are not counted.

**The shape** of a phrase is its melodic intervals in semitones, rounded from
the just ratios, plus its rhythm as each inter-onset time's ratio to the
phrase's own median beat. The shape is free of transposition and of tempo.

**Within each complete meeting** the report gives:

- the phrases and the distinct shapes per hour, per voice;
- the **heard-before rate**, in three readings from strict to loose: the shape,
  the pitch shape alone, and the contour;
- the rate across voices: a doubling within 1 s counts as heard *together*, not
  heard *before*.

**Across seeds** it gives the shapes of at least `--common-min` notes found in
the most meetings, each with its first hearing spelled in solfège, and the most
common rhythm-free shapes. `shapes.json` holds every shape.

### Sample (seeds 1–20, 1200 s, the 20 complete meetings)

> - **Heard before, same voice:** 5.7 % of phrases; **any voice:** 6.2 %.
> - **Most repetitive meeting:** seed 7 meeting 1, 25 % heard before (36 phrases); **least:** seed 3 meeting 1, 0 %.
> - **Across seeds:** 768 distinct shapes; 98 % belong to one meeting only. The commonest of 4+ notes, `−2 +2 +2 −2 −2 | 2 1 1 2 1` (choir/clarinet), is in 2 of 20 meetings.

| voice | phrases/meeting | distinct/hr | heard before (shape) | (pitch only) | (contour) |
|:---|---:|---:|---:|---:|---:|
| clarinet | 14.6 | 63 | 0 % | 0 % | 3 % |
| choir (top) | 11.2 | 45 | 2 % | 2 % | 5 % |
| bells | 6.0 | 24 | 2 % | 3 % | 9 % |
| organ | 4.0 | 16 | 0 % | 1 % | 10 % |
| strings | 3.5 | 15 | 0 % | 0 % | 0 % |
| **band:melody** | 9.8 | 9 | **71 %** | 71 % | 71 % |

The motif engine almost never repeats itself. The one rut the tool finds is the
**band's loop** (PLAN §1: "The band: loops"). In seeds 6, 7, 11, 14 and 20 one
short figure, repeated, fills 8–10 phrases (seed 6:
`+12 −3 −2 −7 +12 −3 −2 −7 … | 1½ 1 1 1 1½ 1 1 1 …`), and those meetings rise to
16–25 % heard before. The composed march in strains (§8.2) is the cure. This table is how its
crew will show it worked.

## tally.js

```sh
node tools/tally.js [--seeds 1-20] [--secs 1200] [--first] [--engine …] [--dumps …]
node tools/tally.js --a <spec> --b <spec> [--seeds 1-20] [--secs 1200] [--threshold 15] [--harness-a …] [--harness-b …]
```

Here `<spec>` is a dump directory, an engine directory, `git:<ref>` or
`worktree`.

**What it counts.** Over every complete meeting:

- the meeting's length and its sections;
- each section type's median length and count;
- cadences per meeting and the share of each kind;
- joints;
- guests per meeting, the share of meetings with a guest, and the share with
  each guest;
- notes per minute and median note length per layer;
- events per meeting by category;
- the mix of modes and kinds of Sunday.

It also runs the **plan checks** that a dump can answer:

- the plagal share of cadences, 30–55 % (§12);
- meetings with a guest, ≈ 55 % (§8, §13);
- meeting length, ≈ 14–15 min (§0);
- the Question never seats (§14).

**A/B.** It renders both builds from the same seeds, then does three things:

1. It says which seeds played **identically**, comparing the note and event
   streams byte for byte, header excluded.
2. For every metric it gives A, B, the shift, and the **noise**: two bootstrap
   standard errors of the difference, with meetings resampled 300× per side.
3. It **flags** a shift beyond ±15 % that is also beyond the noise, or a metric
   that appears or vanishes.

Shifts beyond ±15 % but within the noise, or seen in fewer than 5 meetings,
are listed as *worth a look, not a verdict*. With the same seeds and an
unchanged engine every difference is exactly zero. After a re-base (new streams)
the noise column is what keeps a 20-meeting sample honest.

### Sample, one build (seeds 1–20, 1200 s)

| check | plan | measured | |
|:---|:---|---:|:---:|
| plagal share of cadences | 30–55 % (§12) | 84.6 % | ✗ |
| meetings carrying a guest | ≈ 55 % (§8, §13) | 45.0 % | ✓ |
| meeting length | ≈ 14–15 min (§0 law 1) | 14.4 min (10.1–19.1) | ✓ |
| the Question never seats | 0 meetings (shelved, §14) | 0 meetings | ✓ |

The plagal share is still v0.30's rut (§1: "about 90 % plagal"). The dialects
of the HYMN crew are what bring it into the target.

### Sample, A/B: the live v0.32 (`git:main`) against this worktree

The worktree has the same music as v0.32, with the Question shelved.

> - **Same seeds, same meetings?** 10 of 20 seeds played identically (note and event streams byte-for-byte); the rest differ: 1, 2, 3, 5, 11, 13, 14, 15, 19, 20.
> - **Shifts beyond ±15 % and beyond noise:** **2**: guests · guests per meeting (−50 %); guests · meetings with: question (−100 %).
> - **Beyond ±15 % but within noise or on few meetings:** 4: share: half; meetings with a guest; per meeting: visitation; per meeting: visitation-draw.

| metric | A | B | Δ | noise ± | meetings A/B | flag |
|:---|---:|---:|---:|---:|---:|:---|
| guests per meeting | 0.90 | 0.45 | −50 % | 0.43 | 13/9 | **⚑ SHIFT** |
| meetings with a guest | 65.0 % | 45.0 % | −31 % | 30.5 pt | 13/9 | within noise |
| meetings with: question | 45.0 % | 0.0 % | −100 % | 22.4 pt | 9/0 | **⚑ gone** |
| meetings with: bands | 30.0 % | 30.0 % | 0 | 30.0 pt | 6/6 | |

This is exactly the owner's ruling, measured.

- The Question is gone.
- Every meeting it never sat in is note-for-note the same, because "its dice
  are still drawn".
- Nothing else moved beyond noise.

The same command with `--a worktree --b worktree` reports "10 of 10 seeds
played identically — nothing moved" and no flags.

## screens.js

```sh
node tools/screens.js [--seed 1847] [--times 20,60,120] [--widths 860,390] [--section hymn] [--fps-secs 20] [--throttle 4] [--full] [--ives] [--latin]
```

It loads `?seed=N` in muted headless Chrome and presses PLAY. At each time in
the meeting (the audio clock since PLAY, or since the jump with `--section`) it
captures the **staff** canvas at each width:

- 860 px at DPR 2;
- 390 px emulated as a phone at DPR 3;
- with `--full`, the whole page as well.

**Frame time.** After the shots, the CPU is throttled 4× for `--fps-secs`. Every
requestAnimationFrame callback is timed, and callbacks sharing a frame are
summed. The report gives p50/p90/p99/max per frame against the 16.7 ms budget,
the rAF interval and the long tasks. Headless Chrome may pace rAF slowly (about
10 fps here), and the report says so when it does. The cost of each frame is
what matters for the budget.

Console errors and warnings from each width are listed.

### Sample (seed 1847, default times)

> | width | frames | p50 ms | p90 ms | p99 ms | max ms | rAF interval (median) | long tasks | section |
> |:---|---:|---:|---:|---:|---:|---:|---:|---:|
> | 860 px | 218 | 1.20 | 4.20 | 5.07 | 8.6 | 116.6 ms | 0 | invocation |
> | 390 px | 300 | 1.10 | 5.30 | 13.23 | 22.6 | 99.9 ms | 0 | invocation |
>
> *Headless Chrome paced requestAnimationFrame at about 8.6 fps here, so the frame count says nothing about a real display; the per-frame cost is still what each frame would take.*
>
> | meeting time | section | staff | file |
> |:---|---:|---:|---:|
> | 20.0 s | prelude | 702×240 CSS px | `staff-860-t020.png` |
> | 60.0 s | prelude | 702×240 CSS px | `staff-860-t060.png` |
> | 120.0 s | invocation | 702×240 CSS px | `staff-860-t120.png` |
>
> Console: no errors or warnings ✓

The report embeds each PNG. At 60 s the 860 px staff carries the clarinet's
shape-note line; seed 1847's staff is empty before about 20 s, because the
engraved voices come later.

At 4× the frame cost stays well inside the 16.7 ms budget at both widths. The
phone's p99 of 13 ms, during the invocation, is the number to watch as the
Score multiplies the ink.

## capture.js

```sh
node tools/capture.js [--seed 1847 | --seeds 1847,5,9] [--from 0] [--to 240] [--meeting] [--section hymn] [--ives] [--px-per-s 8]
node tools/capture.js --wav <file.wav> [--events <file.jsonl>] [--from <s>]     # re-analyse a capture
```

It plays the meeting in muted headless Chrome and records the window between
`--from` and `--to`, in meeting seconds (from the moment the meeting is called).
`--meeting` records until meeting 1 ends.

**The tap** is injected before any page script. Every node that connects to an
output also feeds a ScriptProcessor. The output may be the destination, or the
MediaStreamDestination the page uses to survive a locked screen. What is
recorded is exactly what the speakers would get, after the master chain.

A ConstantSource ramp rides on a third channel. Its value is the audio time, so
every buffer knows its first sample exactly, and any dropout shows as a gap.

The report states three things about the recording:

- how much of the window the tap covered;
- the number of discontinuities;
- the audio clock's rate against real time.

An AudioWorklet tap was tried first and dropped. Adding one moves Chrome's
rendering of the whole graph onto the worklet thread. On this machine, under
load, that thread fell to 0.36× real time and slowed the meeting itself. The
ScriptProcessor keeps rendering where it was: measured 0.995–1.00×.

**Outputs:**

- `capture-<seed>-<from>-<to>.wav`, 16-bit stereo.
- `…-spectrogram.png`, which stacks three strips on one time axis:
  - a log-frequency spectrogram, 30 Hz–16 kHz, over an 80 dB range;
  - the short-term (3 s) loudness over the momentary (0.4 s), with the
    integrated level dashed;
  - a raster of every note the engine reported, one row per layer.

  Section starts are marked with solid lines and guests with dashed gold lines.
- `…-events.jsonl`: the page's own notes and events, **in the dump format**,
  shifted to meeting time. The dump tools can read a browser run too.
- `report.md`, which gives:
  - integrated loudness (BS.1770-4 / EBU R128, gated), LRA, and the maximum
    momentary and short-term loudness;
  - sample peak and a true-peak estimate (4× oversampled);
  - loudness and note count by minute;
  - what happened when;
  - **the browser's meeting against the harness's**: the same mode, kind,
    keynote and section plan, and note for note, the point where the two part.

Loudness is checked against BS.1770 in `selftest.js`: the 48 kHz coefficients,
a 1 kHz tone at −20 dBFS reading −20.0 LUFS in stereo and −23.0 LUFS in one
channel, and relative gating.

For the Listener's standard packet (PLAN-EXECUTION §4.2) there are two runs:

- `--seeds a,b,c,d,e,f --to 240` records one seed after another, about 25 min;
- `--seed n --meeting` records a whole meeting.

### Sample (seed 1847, 0–4:00)

> - tap: every sample of the window · no dropouts ✓ · audio clock ran at 0.997× real time · console: clean
>
> | measure | value |
> |:---|---:|
> | integrated loudness | -16.2 LUFS |
> | loudness range (LRA) | 2.5 LU |
> | max momentary (0.4 s) | -12.9 LUFS |
> | max short-term (3 s) | -14.0 LUFS |
> | sample peak | -5.40 dBFS |
> | true peak (4× oversampled, estimate) | -5.36 dBTP |
>
> | minute | median | max | min | notes |
> |:---|---:|---:|---:|---:|
> | 0:00–1:00 | -16.6 | -14.6 | -34.4 | 13 |
> | 1:00–2:00 | -16.1 | -15.0 | -17.2 | 27 |
> | 2:00–3:00 | -16.5 | -14.0 | -17.9 | 31 |
> | 3:00–4:00 | -16.3 | -14.4 | -17.9 | 52 |
>
> ✓ Same plan: harness mixolydian · ordinary · 280.8 Hz; browser mixolydian · ordinary · 280.8 Hz. (prelude 0.0/0.0 ✓, invocation 94.6/95.1 ✓, hymn 166.2/166.4 ✓)
>
> Note for note: 7 of the harness's 144 notes sound in the browser too (123 there). The two first part at 0:15 (ambient 350.8 Hz) — after that the browser's meeting keeps its plan but takes its own path. […]

What the picture shows:

- Three sections.
- A drone and organ bed under the clarinet's lines in the prelude.
- The invocation thinning to drone, the voice and field.
- The choir entering at the hymn.

What it means:

- The loudness is nearly flat: LRA 2.5 LU, because the master chain holds it
  level.
- **The browser does not play the harness's notes.** It follows the same plan
  but parts from the harness at 0:15, and two browser runs of one seed part
  from each other too. That is PLAN §2.2's REPRO problem: v0.30 draws every
  choice from one die in timer order, and reads the audio clock when a timer
  fires. Until phase 0b's streams and clock land, the harness tools describe
  the meetings a seed *would* play, and the capture shows the one it did.

`--wav` re-analysis of the same file reproduces every number above.

## selftest.js

```sh
node tools/selftest.js
```

It runs in seconds and uses no browser. It checks four things:

1. A real dump from this worktree reads as meetings and sections.
2. A synthetic dump in SCORE §6's **typed** vocabulary reads the same way:
   meetings, sections, cadences, guests, parts, and the distinctness hooks
   (sunday, dialect, cast) all come through. An echo from the v0.30 log counts
   once.
3. The same seed twice is D = 0, and two seeds are not.
4. The loudness meter reads the BS.1770 references.

Run it after any change to the engine's events or to these tools.

## Files

```
tools/
  README.md          this file
  render.js          seeds → a dump set (+ manifest.json)
  distinctness.js    design law 2
  repetition.js      phrase shapes heard before
  tally.js           counts, plan checks, A/B
  screens.js         staff screenshots + frame time (muted Chrome)
  capture.js         WAV + spectrogram + LUFS/peak (muted Chrome)
  selftest.js        the instruments, checked
  lib/dump.js        the dump reader: both event vocabularies, meetings, sections, voices, phrases
  lib/run.js         rendering through the harness: worktree, directory or git:<ref>
  lib/chrome.js      php -S + muted headless Chrome over CDP
  lib/audio.js       WAV, BS.1770 loudness, true peak, FFT, spectrogram
  lib/util.js        arguments, statistics, markdown
  out/               reports (gitignored)
```
