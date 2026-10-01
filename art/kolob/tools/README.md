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
| `tally.js` | What is a meeting made of (cadences, guests, sections, notes per layer)? Did a change move it (A/B)? | the dump | ~2 s per 20 seeds; A/B of two builds at 60 seeds, ~45 s |
| `screens.js` | What does the staff look like at 860 and 390 px, and what does a frame cost at 4× CPU throttling? | the page, muted | real time: ~2.5 min per width |
| `capture.js` | What does a seeded meeting sound like, as a WAV, a spectrogram, loudness (LUFS) and peak? | the page, muted | real time: 4 min for a 4-min window |
| `render.js` | Renders a dump set to keep, or to hand to a critic. | the harness | ~1 s per seed |
| `selftest.js` | Do the instruments still read true? | the harness plus synthetic dumps and signals | ~5 s |

Every report opens with what it measured: the engine, its VERSION, its git
commit, a fingerprint of the module bytes the harness was *seen* to play (see
"Which build is measured"), the seconds per seed, the flags and the harness.
Reports, dumps, PNGs and WAVs go to `tools/out/<tool>-<stamp>/`, which is
gitignored, unless you pass `--out <dir>`.

```sh
cd art/kolob
node tools/selftest.js                           # the instruments, checked (seconds)
node tools/distinctness.js                       # 20 seeds, first 180 s → out/distinctness-…/report.md
node tools/repetition.js                         # 20 seeds, 1200 s, every complete meeting
node tools/tally.js                              # the same, counted
node tools/tally.js --a git:kolob-2 --b worktree # A/B: did my change move the meeting? (60 seeds a side)
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
- **Two runs at once** need two ports: `--chrome-port 9424 --port 8114`.
  The Chrome profile follows the port (`…/kolob-r2-tools-chrome-9424`), or
  name one with `--profile <dir>`. A Chrome on a profile that another Chrome
  holds would hand itself to the first and quit, so `launch()` refuses one
  and names the process holding it. Give the second run its own `--port`
  too: a run that reuses another's `php -S` loses it when that run ends.

## Which build is measured

The three dump tools render through the harness (`art/kolob/_harness.js`;
rebuilt and tracked on 2026-10-01 — the original was never committed). They can point it at any build:

| `--engine` (or `--a` / `--b` in tally) | what is rendered |
|---|---|
| *(default)*, `worktree` | this worktree's `art/kolob` |
| `<dir>` | any directory with `kolob-core.js`, or v0.30's single-file `kolob-audio.js` |
| `git:<ref>` | a build out of git (`git archive <ref> art/kolob 'art/prosperos-jukebox-v2/*.js'`, unpacked into `out/_builds/<sha>/`), for example `git:main` (v0.32 live) or `git:kolob-2` |
| `--dumps <dir>` | a dump set already rendered (by `render.js`, or anyone's `dump=` runs) |

**The harness used** is `--harness <file>` if you give one. Otherwise it is the
engine directory's own `_harness.js`, or this worktree's for a `git:` build.
The tools point it at the build with `KOLOB_BASE` (the engine crew's name) and
`KOLOB_DIR` (this crew's) alike, and load a single-file build with
`KOLOB_LEGACY`. Nothing is ever written into an engine directory.

**The harness is not taken at its word.** A harness that ignores where it is
pointed plays its own directory's engine, and an A/B then reports "nothing
moved" when everything did (round 2's critic caught exactly that). So every
render runs with `lib/witness.js` preloaded (`node -r`). The witness stands by
`fs.readFileSync` and writes down every engine file the harness reads
(`kolob-*.js`, the substrate's `pj2-*.js`): where it lay and a hash of its
bytes (`seed-N.witness.json` beside each dump). Before a single number is
computed, `lib/run.js` holds that record against the build it meant, and
**refuses the set** when:

- any module came from another directory than the build's (or a substrate
  script from another substrate than the build's own `../prosperos-jukebox-v2`);
- a module on the build's own list went unread, or a module off it was read.
  The list is the build's `_engine.php` (round 2 on), else `index.php`'s
  `$kolob_engine` (the split), else the single file;
- the bytes it read are not the list's bytes, or changed during the render, or
  differ between seeds;
- the harness read no engine file the witness could see;
- the harness says, in the dump header's `engine` field, that it loaded
  something else than the witness saw.

The refusal names the harness, the build and what went wrong, for example:

```
tally.js: harness failed for seed-3 — deaf-harness.js did not play the build it was pointed at (v032, art/kolob/tools/out/_builds/90126a3dd55f/art/kolob):
  - 12 of the files it played (kolob-pitch.js, kolob-melody.js, kolob-harmony.js and 9 more) came from art/kolob, not from art/kolob/tools/out/_builds/90126a3dd55f/art/kolob
  - none of the 12 modules on the build's list (index.php) was read from the build
  A harness must load from KOLOB_BASE or KOLOB_DIR (the tools set both) and play the build's own list; pass --harness <file> to use one that does.
```

The fingerprint in every report is the witnessed one: SHA-1 over the files
played, in name order, each its name and then its bytes. A module the build
does not play (a lab module) no longer moves it. If the harness cannot load a
build at all, the tool stops with the harness's `LOAD` error.

## The dump format (v1)

These tools depend on the dump and nothing else. The harness writes it with
`node _harness.js <secs> <seed> [ives] [razz] [cumulative] dump=<file> [header]`:
one JSON array per line, `[kind, t, payload]`.

| kind | `t` | payload |
|---|---|---|
| `"H"` | 0 | **header**, first line, written only when the harness is given the `header` argument (the tools always give it): `{format: "kolob-dump", v: 1, seed, secs, flags: [...], engine: {dir, legacy, files, fingerprint}}`. `engine` (added in round 2; the engine crew's harness may also give `list`) says where the modules were loaded from and what their bytes hash to, the witness's way; the tools hold it against their witness. It is built from the arguments and the engine alone, so same-argument runs on one build stay byte-identical. It is opt-in so a plain `dump=` stays byte-identical to older dumps. A dump without it still reads: the seed comes from the `▶ … seed N` event or the file name, and the length from the last record. |
| `"N"` | the harness clock when the note was *emitted* (scheduled) | **a note** exactly as `onNote` delivers it: `{layer, freq, startTime, duration, …extra}`. `startTime` is when it sounds, and is usually ahead of `t`. Extras today: `marks` (telegraph), `part`, `beat` and `loud` (band). SCORE §6 adds `part, hymnId, beat, syl, deg, monzo, marks`. |
| `"E"` | the harness clock at emission | **an event** exactly as `onEvent` delivers it. v0.30's log events are `{cat, label, detail, t}`; SCORE §6's typed events are `{type, t, …payload}`. |

**How the reader (`lib/dump.js`) takes it**

- **Times.** A note's time is its `startTime`. An event's time is its `t`, or
  the record's `t` when the event has none.
- **Forward compatibility.** Lines of any other kind are skipped, and so is an
  unparseable line. An event neither vocabulary knows is still counted in
  tally's "events per meeting", by its `cat` or `type` (all but `transport`,
  the harness's own start-up line, which one harness tells and another does
  not).
- **Two harnesses stamp differently.** This crew's harness gives each record
  the harness clock at emission; the engine crew's gives the music's own
  time and drops records past the run's end (and the engine crew's engine
  calls the meeting at 0.1 s, not 0).
  The reader takes both. Only tally's byte-for-byte identity line cares, and
  it says so when A and B were rendered by different harnesses.
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
| `cadence` · `∴ the room empties` | not a joint of its own: it says the joint that follows goes into stillness (around the sacrament), and marks that joint `still` | — |
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
node tools/distinctness.js [--n 20 | --seeds 1-20] [--window 180] [--engine …] [--dumps …] [--twin 0.5] [--plant-floor 1.5] [--collapse 3] [--no-sanity]
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

**A yardstick the build cannot move.** D is standardised by the build's own
spread, so a relative threshold alone cannot see a build whose seeds have all
collapsed into one meeting: its spread shrinks with it, and the median pair
still looks "far". (Round 2's critic proved it: 20 copies of seed 1, each
transposed by up to ±45 cents and 3 % faster or slower, gave a median D of
0.106 and only 41 of 190 pairs flagged.) So the planted twin, seed 1 a
semitone higher and 4 % slower, measured on the same scales, is the yardstick:

- a pair is a **near-twin** when D < 0.5 × the median *or* D ≤ 1.5 × the
  planted twin's D (`--plant-floor`), whatever the median says;
- the **spread** line holds the median against the plant, and at 3× or less
  (`--collapse`) the verdict says **COLLAPSED**: the typical pair is barely
  farther apart than one meeting heard in another key.

On the critic's collapsed set the report now reads: spread 0.7×, ⚠ COLLAPSED,
172 of 190 pairs near-twins. On this worktree: spread 5.5×, none.

**The report** gives:

- the D distribution, the spread against the plant, and the **near-twins**;
- the closest pairs, with what they share and what they don't;
- each seed with its nearest neighbour;
- **the features that separate seeds least**, meaning the share of pairs within
  one JND, with the range across the seeds;
- where the distance comes from;
- `distances.csv` and `features.json`.

**Sanity checks, built in.**

- The first seed is rendered twice and must be D = 0.
- The **planted twin** must be seen (D > 0) and fall inside the relative twin
  line (0.5 × the median). The report also says how many real pairs are closer
  than it; in a healthy build, none.
- Every pair of different seeds must be D > 0.

### Sample (this worktree, v0.32 music with the Question shelved, seeds 1–20)

> - **Pair distance D:** median **0.547**, p10 0.451, p90 0.667, closest 0.283.
> - **Spread:** the median pair is **5.5×** as far apart as seed 1 is from itself a semitone higher and 4 % slower (the planted twin, D = 0.099) (collapse at 3× or less).
> - **Near-twins** (D < 0.5 × median = 0.274, or D ≤ 1.5 × the planted twin = 0.148): **none**.
> - **Sanity:** the same seed rendered twice (seed 1) D = 0.000 ✓; the planted twin is seen (D > 0 ✓) and is closer than the median's twin line (0.099 < 0.274 ✓); 0 of 190 real pairs are closer than it; every pair of different seeds D > 0 ✓.
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
node tools/tally.js --a <spec> --b <spec> [--seeds 1-60] [--secs 1200] [--threshold 15] [--harness-a …] [--harness-b …]
```

Here `<spec>` is a dump directory, an engine directory, `git:<ref>` or
`worktree`.

**What it counts.** Over every complete meeting:

- the meeting's length and its sections;
- each section type's median length and count;
- cadences per meeting and the share of each kind;
- joints (one per section; `∴ the room empties` is how a joint goes, not a
  joint of its own, so joints per meeting equal sections per meeting);
- guests per meeting, the share of meetings with a guest, and the share with
  each guest;
- notes per minute and median note length per layer;
- events per meeting by category (not `transport`: that is the harness's
  start-up line, not the music);
- the mix of modes and kinds of Sunday.

It also runs the **plan checks** that a dump can answer:

- the plagal share of cadences, 30–55 % (§12);
- meetings with a guest, ≈ 55 % (§8, §13);
- meeting length, ≈ 14–15 min (§0);
- the Question never seats (§14).

**A/B.** It renders both builds from the same seeds (**60 by default**; each
build witnessed, as above), then does three things:

1. It says which seeds played **identically**, comparing the note and event
   streams byte for byte, header excluded.
2. For every metric it gives A, B, the shift, and the **noise**: two bootstrap
   standard errors of the difference, with meetings resampled 300× per side.
3. It **flags** a shift beyond ±15 % that is also beyond the noise, or a metric
   that appears or vanishes.

Shifts beyond ±15 % but within the noise, or seen in fewer than 5 meetings,
are listed as *worth a look, not a verdict*. With the same seeds and an
unchanged engine every difference is exactly zero.

**Use 60 seeds, not 20, after the re-base.** Once the engine crew's streams
land, no seed will play the same meeting on both sides, and the noise column is
all that stands between a shift and a verdict. Twenty meetings a side leave a
share such as "meetings with a guest" ±30 points wide; sixty bring it to about
±18. Sixty seeds of 1200 s render in 30–45 s for two builds. That is why
A/B defaults to `1-60`; the report says so when a side has fewer than 40
meetings.

The report also warns:

- when **A and B hold different seeds** (two dump sets rendered apart, say).
  Both seed lists are printed, and a warning says every shift then mixes the
  change with which Sundays were drawn. Pass `--seeds` to compare like with
  like.
- when **two harnesses** rendered the two sides. Each stamps its records its
  own way, so the byte-for-byte identity line then compares the harnesses as
  well as the engines. The metrics do not depend on it.
- when every shared seed played identically **but the fingerprints differ**:
  the modules' bytes moved and the music did not (a comment, say). It says so,
  so that "nothing moved" is never read as "the same build".

### Sample, one build (seeds 1–20, 1200 s)

| check | plan | measured | |
|:---|:---|---:|:---:|
| plagal share of cadences | 30–55 % (§12) | 84.6 % | ✗ |
| meetings carrying a guest | ≈ 55 % (§8, §13) | 45.0 % | ✓ |
| meeting length | ≈ 14–15 min (§0 law 1) | 14.4 min (10.1–19.1) | ✓ |
| the Question never seats | 0 meetings (shelved, §14) | 0 meetings | ✓ |

The plagal share is still v0.30's rut (§1: "about 90 % plagal"). The dialects
of the HYMN crew are what bring it into the target.

### Sample, A/B: the live v0.32 (`git:main`) against this worktree, 60 seeds

The worktree has the same music as v0.32, with the Question shelved. `git:main`
is the single-file build, loaded with `KOLOB_LEGACY` and witnessed like any
other.

> - **A:** engine **main** (v0.32) · git 682ca189f5 · modules 1a641dfcb0 (single-file kolob-audio.js, witnessed) · 1200 s per seed · harness `art/kolob/_harness.js`
> - **B:** engine **worktree** (v0.32) · git 7ee515881b · modules 074ee44959 (12 files, the list in index.php, witnessed) · 1200 s per seed · harness `art/kolob/_harness.js`
> - **Same seeds, same meetings?** 33 of 60 shared seeds played identically (note and event streams byte-for-byte); the rest differ: 1–3, 5, 11, 13–15, 19, 20, 24, 28, 32, 33, 35–37, 39, 41, 44, 45, 48, 49, 51, 56, 57, 60.
> - **Shifts beyond ±15 % and beyond noise:** **5** — guests · guests per meeting (−39 %); guests · meetings with a guest (−30 %); guests · meetings with: question (−100 %); events · per meeting: visitation (−34 %); events · per meeting: visitation-draw (−34 %).

| metric | A | B | Δ | noise ± | meetings A/B | flag |
|:---|---:|---:|---:|---:|---:|:---|
| guests per meeting | 0.83 | 0.51 | −39 % | 0.27 | 37/26 | **⚑ SHIFT** |
| meetings with a guest | 62.7 % | 44.1 % | −30 % | 18.4 pt | 37/26 | **⚑ SHIFT** |
| meetings with: question | 32.2 % | 0.0 % | −100 % | 12.1 pt | 19/0 | **⚑ gone** |
| meetings with: bands | 27.1 % | 27.1 % | 0 | 16.7 pt | 16/16 | |
| joints per meeting | 7.64 | 7.64 | 0 | 0.33 | 59/59 | |

This is exactly the owner's ruling, measured.

- The Question is gone.
- Every meeting it never sat in is note-for-note the same, because "its dice
  are still drawn".
- Nothing else moved beyond noise.

At 20 seeds the same comparison left "meetings with a guest" (−31 %) inside a
±30.5-point noise band. At 60 it is a verdict. Two builds of 60 seeds took 32 s.

The same command with `--a worktree --b worktree` reports that every seed played
identically, "nothing moved", and no flags.

### Sample, A/B the critic's way: a build the harness would not have played

This is round 2's critic's repro, in a scratch repo: v0.32's split committed as
tag `v032`, and the engine crew's working snapshot laid over it (its modules,
`_engine.php` and its `_harness.js`, which reads `KOLOB_BASE`, not
`KOLOB_DIR`). Before the fix, `--a git:v032 --b worktree --seeds 1-6` said "6 of
6 seeds played identically — nothing moved". Now it reads:

> - **A:** engine **v032** (v0.32) · git 90126a3dd5 · modules 074ee44959 (12 files, the list in index.php, witnessed) · 1200 s per seed · harness `art/kolob/_harness.js`
> - **B:** engine **worktree** (v0.32) · git 90126a3dd5 · modules 9f0d73ba0f (15 files, the list in _engine.php, witnessed) · 1200 s per seed · harness `art/kolob/_harness.js`
> - **Same seeds, same meetings?** 0 of 6 shared seeds played identically (note and event streams byte-for-byte).

The same run, with the v032 side forced through a harness that ignores both
variables, is refused. The message is the one quoted under "Which build is
measured".

## screens.js

```sh
node tools/screens.js [--seed 1847] [--times 20,60,120] [--widths 860,390] [--section hymn] [--fps-secs 20] [--throttle 4] [--full] [--ives] [--latin]
                      [--port 8113] [--chrome-port 9423] [--profile <dir>]
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
the rAF interval, the long tasks and the **load average** while it measured.
Headless Chrome may pace rAF slowly (about 10 fps here); the report says so
whenever the median interval is over 25 ms (a display paces it at 16.7). The
cost of each frame is what matters for the budget.

**Read p99 and max with care:**

- **p99 rests on a handful of frames.** Over 20 s at 10 fps there are only
  about 200–300 frames, so p99 is the worst 2 or 3 of them. It tells you the
  worst moments of that window, not a steady rate.
- **Frame cost rises with the machine's load.** On the same seed and widths
  the round-2 critic measured p99 21.1 ms, max 60.6 ms and one 80 ms long task
  at 860 px, against the builder's 5.07, 8.6 and 0, with a load average near
  11 and other crews' Chromes running. The report prints `os.loadavg()` beside
  each width and warns when it was over half the cores. Re-run on a quiet
  machine before you read p99, max or long tasks as the page's own.

Console errors and warnings from each width are listed.

### Sample (seed 1847, default times)

Round 2, on a busy machine, which is the point of the new columns and notes:

> | width | frames | p50 ms | p90 ms | p99 ms | max ms | rAF interval (median) | long tasks | section | load avg |
> |:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
> | 860 px | 354 | 1.30 | 4.50 | 9.38 | 14.4 | 50.0 ms | 1 (93 ms) | invocation | 10.6 |
> | 390 px | 270 | 1.20 | 4.41 | 9.16 | 21.1 | 99.9 ms | 0 | invocation | 8.9 |
>
> *Headless Chrome paced requestAnimationFrame at about 20.0 and 10.0 fps here (860 px, 390 px), so the frame count says nothing about a real display; the per-frame cost is still what each frame would take.*
>
> *p99 rests on the worst hundredth of the frames — 4 of 354 at 860 px, 3 of 270 at 390 px: read it, and max, as the worst moments of this window, not as a steady rate.*
>
> **⚠ The machine was busy** (load average 10.6 / 8.9 on 11 cores during 860 px, 390 px): other processes took the throttled CPU's time, and p99, max and the long tasks run high under load. Re-run on a quiet machine before reading them as the page's.
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

Round 1's builder measured the same seed on a quieter machine: p99 5.07 ms and
max 8.6 at 860 px, p99 13.23 and max 22.6 at 390 px, no long tasks. The two
runs agree on p50 (1.1–1.3 ms) and p90 (4.2–5.3 ms), which is where the page's
own cost shows. They part at the tail, which is where the machine's load
shows. At 4×, even on a busy machine, the frame cost stays inside the 16.7 ms
budget at p99. The phone's p99 is the number to watch as the Score multiplies
the ink, and it should be read from a quiet run.

## capture.js

```sh
node tools/capture.js [--seed 1847 | --seeds 1847,5,9] [--from 0] [--to 240] [--meeting] [--section hymn] [--ives] [--px-per-s 8]
                      [--port 8113] [--chrome-port 9423] [--profile <dir>]
node tools/capture.js --wav <file.wav> [--events <file.jsonl>] [--from <s>]     # re-analyse a capture
```

It plays the meeting in muted headless Chrome and records the window between
`--from` and `--to`, in meeting seconds (from the moment the meeting is called).
`--meeting` records until meeting 1 ends. It reads the end through the dump
reader, in either vocabulary: v0.30's `∴ joint — meeting ends · 8s`, a typed
`meeting-end {dur}`, or else the next meeting's start.

**The tap** is injected before any page script. Every node that connects to an
output also feeds a ScriptProcessor. The output may be the destination, or the
MediaStreamDestination the page uses to survive a locked screen. What is
recorded is exactly what the speakers would get, after the master chain.

A ConstantSource ramp rides on a third channel. Its value is the audio time, so
every buffer knows its first sample exactly, and any dropout shows as a gap.

The report states three things about the recording:

- how much of the window the tap covered, to the sample;
- **every discontinuity**, in a table: its meeting time to the millisecond,
  hole or overlap, and its size in samples and milliseconds. Each is also
  marked on the picture: a red triangle and a dashed red line through every
  strip, labelled `tap gap N smp`;
- the audio clock's rate against real time.

A discontinuity is the recording's, not the engine's. The graph rendered those
frames, since its clock ran on, but the tap never received them, so the WAV
holds silence there. A Listener who hears a click at a marked time should put
it down to the tap. The round-2 critic's 75 s capture had a 126-sample hole at
0:40.928, and its spectrogram shows a broadband line there that reads like an
engine click.

**How the tap's blocks are laid.** Each block's first frame is read off the
ConstantSource ramp. That ramp is a float32 holding the audio time, so it is
good to within a sample or two, and to a few samples late in a long meeting.
The rule for laying blocks:

- A block that starts within that tolerance (at least ±4 samples) of where the
  last one ended is contiguous, since ScriptProcessor buffers are, and is laid
  there.
- Anything farther is a discontinuity. The graph works in render quanta of 128
  frames, so a measured 126 is snapped to the 128 it must have been.
- The table keeps what was measured beside the snapped size.

(The critic's "2-sample hole" 0.344 s after the 126 was this reading error
correcting itself, one block later.)

Each capture also writes `…-tap.json`, the tap's own record of coverage and
gaps. `--wav` re-analysis reads it when it lies beside the WAV. Without it, the
re-analysis looks for holes in the WAV itself: runs of exact digital zero in
both channels with sound on either side, which the drone never makes. Re-found
this way, the critic's WAV shows its two holes at 0:40.928 (126 samples) and
0:41.272 (2 samples).

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

  Section starts are marked with solid lines, guests with dashed gold lines,
  and the tap's discontinuities in red. The left margin widens to fit the
  longest row label (`harmonium`, `telegraph`).
- `…-events.jsonl`: the page's own notes and events, **in the dump format**,
  shifted to meeting time. The dump tools can read a browser run too.
- `…-tap.json`: the tap's record: samples covered, block starts taken as
  contiguous, and every discontinuity.
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
channel, and the gating, with EBU Tech 3341's cases 3, 4 and 5 (−36/−23/−36,
−72/−36/−23/−36/−72 and −26/−20/−26 dBFS, each −23.0 ±0.1 LUFS) and half at
−20 and half at −40 (−20.0, where an ungated meter would read −23.0).

For the Listener's standard packet (PLAN-EXECUTION §4.2) there are two runs:

- `--seeds a,b,c,d,e,f --to 240` records one seed after another, about 25 min;
- `--seed n --meeting` records a whole meeting.

### Sample (seed 1847, 0–4:00), round 2

> - tap: all but 128 samples of the window (99.999 %) · 1 discontinuity ✗ (listed below, marked red on the picture) · audio clock ran at 0.997× real time · console: clean
>
> | at (meeting time) | what | size | measured |
> |---:|:---|---:|---:|
> | 1:34.491 | hole | 128 samples (2.7 ms) = 1 render quantum | exact |
>
> | measure | value |
> |:---|---:|
> | integrated loudness | -16.2 LUFS |
> | loudness range (LRA) | 2.7 LU |
> | max momentary (0.4 s) | -11.8 LUFS |
> | max short-term (3 s) | -12.9 LUFS |
> | sample peak | -4.92 dBFS |
> | true peak (4× oversampled, estimate) | -4.85 dBTP |
>
> | minute | median | max | min | notes |
> |:---|---:|---:|---:|---:|
> | 0:00–1:00 | -16.4 | -14.4 | -34.6 | 23 |
> | 1:00–2:00 | -16.5 | -14.8 | -18.0 | 11 |
> | 2:00–3:00 | -16.5 | -12.9 | -17.0 | 21 |
> | 3:00–4:00 | -15.5 | -14.6 | -18.5 | 53 |
>
> ✗ Different: harness mixolydian · ordinary · 280.8 Hz; browser mixolydian · ordinary · 280.8 Hz. (prelude 0.0/0.0 ✓, invocation 94.6/98.8 ✗ 4.2 s, hymn 166.2/170.8 ✗ 4.7 s)
>
> Note for note: 7 of the harness's 144 notes sound in the browser too (108 there). The two first part at 0:16 (ambient 561.2 Hz) — after that the browser's meeting keeps its plan but takes its own path. […]

This run was taken on a busy machine, and it shows the round-2 listing
working. One render quantum (128 samples, exact) never reached the tap at
1:34.491. The report lists it, and the picture marks it with a red triangle and
a dashed red line labelled `tap gap 128 smp`, just before the invocation. The
`harmonium` row label now fits its margin.

What the picture shows:

- Three sections.
- A drone and organ bed under the clarinet's lines in the prelude.
- The invocation thinning to drone, the voice and field.
- The choir entering at the hymn.

What it means:

- The loudness is nearly flat, LRA 2.5–2.7 LU across two runs, because the
  master chain holds it level.
- **The browser does not play the harness's notes.** It follows the same
  Sunday (mode, kind, keynote) but parts from the harness within the first
  20 s. Two browser runs of one seed part from each other too: round 1's
  sections landed within 0.5 s of the harness's, and this run's invocation
  came 4.2 s late. That is PLAN §2.2's REPRO problem: v0.30 draws every choice
  from one die in timer order, and reads the audio clock when a timer fires.
  Until phase 0b's streams and clock land, the harness tools describe the
  meetings a seed *would* play, and the capture shows the one it did.

`--wav` re-analysis of the same file reproduces every number above.

## selftest.js

```sh
node tools/selftest.js
```

It runs in about five seconds and uses no browser. It checks seven things:

1. A real dump from this worktree reads as meetings and sections. The witness
   names the build's own list, and the harness names the same engine in the
   header's `engine` field.
2. A synthetic dump in SCORE §6's **typed** vocabulary reads the same way:
   meetings, sections, cadences, guests, parts, and the distinctness hooks
   (sunday, dialect, cast) all come through. An echo from the v0.30 log counts
   once.
3. The same seed twice is D = 0, and two seeds are not.
4. The loudness meter reads the BS.1770 references and gates as EBU Tech 3341
   says it must.
5. **The witness.** A copy of the engine with one comment added is accepted
   under its own fingerprint. The same copy rendered by a harness that ignores
   `KOLOB_BASE`/`KOLOB_DIR` is refused.
6. **The count** (seed 3, 1200 s). Every section of a complete meeting closes
   on exactly one joint, `the room empties` marks the joint it tells of, and
   `transport` is not a metric.
7. **The capture.** A tap block read a sample or two off is laid contiguous. A
   hole read as 126 is sized to its 128 and placed at 0:40.9. `--meeting`
   finds meeting 1's end from a v0.30 joint, a typed `meeting-end`, or the next
   meeting.

Under the engine crew's harness as it stands, only the two header checks fail
(it writes no header yet; see the handoff's request).

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
  lib/run.js         rendering through the harness: worktree, directory or git:<ref>; the witness's verdict
  lib/witness.js     preloaded into every harness run: which engine files it actually read
  lib/chrome.js      php -S + muted headless Chrome over CDP
  lib/audio.js       WAV, BS.1770 loudness, true peak, FFT, spectrogram
  lib/util.js        arguments, statistics, markdown
  out/               reports (gitignored)
```
