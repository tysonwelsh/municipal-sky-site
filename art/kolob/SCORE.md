# KOLOB 2 — THE CONTRACT

*This is the interface every Kolob 2 crew codes against. It is owned by the
integrator (branch `kolob-2`). Draft 1, 2026-09-26; round 2's requests
adopted 2026-09-27 (§9, which wins where it and an earlier section differ);
round 3's composed hymns adopted 2026-09-27 (§10, which wins over both);
round 3b's ward adopted 2026-09-28 (§11, which wins over all three).*

To change this contract, write a request in your handoff note. **Do not edit
this file from a crew branch.**

Background: `PLAN-COMPOSITION.md` §2 (foundations), `PLAN-EXECUTION.md`
(crews and ownership).

---

## 1. Modules and namespace

- **One namespace.** Every Kolob 2 module attaches to one global:

  ```js
  window.KOLOB = window.KOLOB || {};
  KOLOB.Question = (function () { "use strict"; /* … */ return { /* api */ }; })();
  ```

- **Pure where possible.** Pure modules (pitch, score, composer, question,
  tunes) touch **no** AudioContext, DOM, `Math.random`, `Date.now` or
  `performance.now`. They load headless in Node (the harness does
  `global.window = {}` and `require`s them). Anything random takes a
  `PJ2.Rand` stream as an argument (§3).
- **Synthesis modules** (`kolob-voices-*.js`) take the AudioContext, a
  destination node and a scheduled time. They never read `ctx.currentTime`
  to decide *when* something happens (§4).
- **The public app surface** stays `window.KolobAudio`, and it stays
  API-compatible for `kolob-ui.js` and `kolob-viz.js`. `KolobAudio` becomes a
  facade over `KOLOB.*`.
- **Load order** in `index.php`:
  1. the `../prosperos-jukebox-v2/` substrate: `pj2-rand.js`,
     `pj2-clock.js`, `pj2-fx.js`, all read-only;
  2. `kolob-pitch.js`, `kolob-score.js`, `kolob-tunes.js`;
  3. the pure composers (`kolob-melody.js`, `kolob-harmony.js`,
     `kolob-composer.js`, `kolob-question.js`);
  4. the voices (`kolob-voices-*.js`);
  5. the performers (`kolob-cast.js`, `kolob-guests.js`,
     `kolob-meeting.js`);
  6. `kolob-core.js` (the `KolobAudio` facade);
  7. `kolob-text.js`, `kolob-viz.js`, `kolob-ui.js`.

  Every served asset is added to `$kolob_assets` in `index.php`, so the
  footer fingerprint covers it.
- **The substrate is read-only.** Never edit `art/prosperos-jukebox-v2/*`
  from Kolob work.

## 2. Pitch

- **Ratios are exact.** A pitch is an **exact just-intonation ratio**
  relative to the day's keynote. It is stored as a *monzo*: the exponents of
  the primes 2, 3, 5 and 7 (`[a, b, c, d]` = 2^a · 3^b · 5^c · 7^d).
  - `1/1` is `[0,0,0,0]`;
  - `3/2` is `[-1,1,0,0]`;
  - `10/9` is `[1,-2,1,0]`;
  - `7/4` is `[-2,0,0,1]`.

  Helpers in `kolob-pitch.js`: `ratio(m) → Number`, `mul(m1, m2)`,
  `fromFraction("10/9")`, `cents(m)`, `commaOf(m, spelled) →
  {syntonic:-1|0|1, septimal:0|1}` (for Johnston marks).
- **Frequency** is `Hz = keynoteHz × ratio(keyMonzo) × ratio(noteMonzo)`.
  - The **keynote** is the day's tonic-root (today's `F0·4`; about middle C).
  - The **key** is the current hymn's key relative to the keynote (§6 of
    the composition plan: a key per hymn).
- **Modes are unchanged:** `ionian`, `mixolydian`, `dorian`, `aeolian`,
  `penta`, `hexa`, with today's 5-limit tables (`COLLECTIONS` in v0.30).
- **Degrees.** A note is also spelled as a **degree** in its mode (`deg`,
  0 = do, 7 = do an octave up, negative = below) for notation and shape
  notes. The monzo is the truth; the degree is the spelling. They must agree
  up to a comma, and the comma is what Johnston marks show.

## 3. Randomness: streams

- **Stream type.** The type is `PJ2.Rand.stream(seed)`, whose methods are
  `rnd(a,b)`, `rint(a,b)`, `chance(p)`, `pick(arr)`, `pickW([[item, w],…])`,
  `shuffle(arr)` and `fork(label)`.
- **Forks.** A fork derives from the parent's *birth* seed, so forks are
  order-independent.
- **Labels** (lowercase, `:`-separated). The integrator owns the root forks:

  | label | used for |
  |---|---|
  | `meeting:<n>` | the meeting plan (n = meeting number from 1) |
  | `question:bank` | the visit's seven questions, written **once per visit (seed)**, not per meeting (owner's intent; corrected 2026-09-26 after the second look) |
  | `question:<n>` | the Question in meeting n: `pick` (from the visit's bank; the one heard most recently steps aside), `bend`, `answers`, `ground`, `seat` |
  | `hymn:<n>:<i>` | the i-th hymn of meeting n (the composer; `harmony` and `performance` below it) |
  | `cast:<n>` | the ward seated for meeting n; `member:<id>` below it |
  | `guest:<type>:<n>` | a guest in meeting n |
  | `vision:<n>` | a vision in meeting n |
  | `field`, `joints`, `synth:<voice>` | sound-level detail: detune, envelopes and jitter live here, never in musical streams |

- **Draw every die unconditionally.** If a decision might be refused later,
  draw it anyway, so a refusal never shifts what follows.
- **Keep musical and sound-level streams apart.** Musical decisions never
  share a stream with sound-level jitter.

## 4. Time

- **The clock.** A `PJ2.Clock.create(ctx, opts)` lookahead scheduler, with
  lanes (`clock.lane(name).at(t, fn)`, `.in(dt, fn)`). Callbacks receive the
  **scheduled** time `t` and place every Web Audio event at `t`.
- **Timing rules:**
  - no musical decision reads `ctx.currentTime` at callback time;
  - no `setTimeout` chains;
  - the harness drives the clock with virtual timers.
- **Score times.** All times inside a Score are **seconds from the Score's
  own start** (`t`, `dur`). The performer adds the absolute start.

## 5. The Score

Plain JSON-able objects: no functions, no audio nodes. The composer returns
them, the performers render them, the viz engraves them, and the harness
analyses them.

```js
Hymn = {
  id: "h:3:1",                 // hymn:<meeting>:<i>, or "earth:<slug>" for Earth tunes
  number: 214,                 // hymn-board number
  nameDs: "𐑂𐐰𐑊𐐮",              // Deseret name (display); nameEn is dev-only, never rendered
  provenance: "earth" | "colony" | "gift",
  source: { book: "The Sacred Harp", year: 1844, page: 45 } | null,   // Earth tunes: required
  meter: "CM",                 // CM LM SM 87.87 76.76D 11s 10.10R irregular
  form: "ABAC",
  dialect: "sacredharp" | "psalmody" | "tabernacle" | "gospel" | "shaker" | "oldway",
  mode: "ionian",              // one of §2's modes
  keyMonzo: [0,0,0,0],         // key relative to the day's keynote
  modeOfTime: "4/4" | "3/2" | "6/8" | …,
  beatS: 0.9,                  // default beat length (performer may rubato)
  melodyPart: "S" | "T",       // Sacred Harp/psalmody: "T"
  lines: [Line],
  refrain: [Line] | null,
  verses: [[ "𐐄", "𐐿𐐲𐑋", … ]] // Deseret syllables per verse, one per melody note-onset (§5.2)
}

Line = {
  notes: { S: [Note], A: [Note], T: [Note], B: [Note] },   // parts present per dialect; unison dialects use only melodyPart
  cadence: { kind: "authentic"|"half"|"plagal"|"deceptive"|"openfifth"|"imperfect"|"none",
             beat: 7 },        // beat index of the cadence chord within the line
  chords: [{ beat: 0, len: 1, roman: "I", rootDeg: 0, quality: "maj"|"min"|"dim"|"dom7"|"open5"|… }],
  peak: false,                 // does the tune's high point fall in this line
  breathAfter: true,
  fermataBeats: [7]
}

Note = {
  beat: 0, beats: 1,           // onset and length in beats within the line
  deg: 4, monzo: [-1,1,0,0],   // spelling + exact pitch (relative to the hymn's key)
  tie: false, fermata: false,
  syl: 0,                      // index into the verse's syllables, or null for melisma continuation
  stress: 1 | 0,
  nct: null | "pass" | "nbr" | "susp" | "app" | "ant" | "esc",
  ornament: null | "grace" | "slide" | "turn"   // performers (Old Way, cast) may add their own
}
```

**Rules:**
- **Parts line up by beat.** Beat indices are shared across parts in a line,
  and chords are read off by beat.
- **The melody part has one onset per syllable** (melismas use `syl: null`
  for the continuation notes).
- **Earth tunes** (`kolob-tunes.js`) use the same `Hymn` shape, with
  `provenance: "earth"` and a cited `source`. Where the source gives only the
  tune, `notes` holds only the melody part and `dialect` names the
  tradition the source comes from.

### 5.1 Performance

`Performance` wraps a `Hymn` for one singing:

```js
{ hymnId, verse, practice: "sung"|"notes"|"lined"|"hummed"|"unison"|"descant", tempoMul, rubato, organ: { registration: [...] } | null, singers: [memberId…] }
```

### 5.2 Other score-shaped objects
- **A Question:** `{ id, degs: [..], beats: [..], fromBank: "old" | "gen" }`
- **A march strain, a dance tune, a Primary song, a gift song:** a `Hymn`
  with the matching `dialect` and `form`. Nothing new is needed.

## 6. Events: the bus to the UI and viz

- **Two kinds of event**, typed. The engine emits:
  - `onNote({ layer, freq, startTime, duration, part?, hymnId?, beat?, syl?, deg?, monzo?, marks? })`,
    where `startTime` is absolute audio time. Every sounded pitched note is
    reported, **including doublings**.
  - `onEvent({ type, t, ...payload })`.
- **Event types** (extend by request):

  | type | payload |
  |---|---|
  | `meeting-start` | `{ n, sunday, kind, mode, keynoteHz, houseDialect }` |
  | `section-start` | `{ section, index }` |
  | `hymn-announced` | `{ hymn: {id, number, nameDs, meter, dialect}, leaderDs }` |
  | `verse-start` | `{ hymnId, verse, practice }` |
  | `cadence` | `{ kind, hymnId? }` |
  | `guest-start` / `guest-end` | `{ guest, section, logged: true \| false }` |
  | `question-asking` | `{ k, questionId }` |
  | `question-unanswered` | `{}` |
  | `cast` | `{ memberId, nameDs, action }` |
  | `vision` | `{ name, nameDs, d }` |
  | `telegraph` | `{ word, wordDs, marks }` |

- **`logged: false`** means the UI must not print or flag this guest (the
  Hosanna).
- **Migration.** Existing `emitEvent({cat,label,detail})` calls stay until
  the UI moves over; new code emits typed events only.

## 7. Labs

- **Location.** Each lab is `art/kolob/<name>-lab.php` plus
  `<name>-lab.js`, unlinked, dev-only, following `tune-lab.php` and
  `room-lab.php`.
- **Loading.** A lab loads only the modules it needs, in §1 order.
- **Layout.** It shows the Kolob paper look, a seed field, and plain
  controls.
- **Audio.** Everything audible goes through a master chain with a limiter
  (copy the pattern from `kolob-audio.js`). Lab audio must never exceed the
  app's loudness.
- **Silent testing (owner rule).** Agents' browser checks must make no
  sound on the owner's speakers: launch headless Chrome with `--mute-audio`
  (taps still capture the signal), or render with an `OfflineAudioContext`.

## 8. Versions and handoffs

- **VERSION.** A crew branch bumps no VERSION for lab-only or dev-only
  work. For audible or visible work in the app itself, write a branch-local
  line in the handoff (`v0.30-<crew>.<n> — summary`); the integrator assigns
  the real version at merge.
- **Handoffs.** Every milestone writes `art/kolob/handoff/<crew>-<n>.md`:
  - what shipped;
  - how to hear or see it (port, URL, seeds);
  - requests to the integrator (contract changes, files outside ownership);
  - known issues.
- **Commits** go on the crew branch only, staging named paths.

---

## 9. Round 2, adopted (integration, 2026-09-27)

*The requests of handoffs `r2-engine-1/2/3` and `r2-trombones-1`, adopted
into the contract at the round's integration. Where this section and an
earlier one disagree, this section wins; the code named is the authority
for the details.*

### 9.1 Modules (§1)

- **The load order is `_engine.php`.** New engine modules are added there,
  and only there. `index.php`, the labs and the harness read it. A room
  answers the load guard's roll call as its last act
  (`KOLOB._rooms["kolob-x.js"] = true`); the substrate and the Earth tunes
  are checked by the globals they raise.
- **The engine now also loads** `kolob-voices-band.js` (the brass) and
  `kolob-guest-trombones.js` (the trombone choir at dawn). The lab-only
  modules are `kolob-question.js`, `kolob-voices-vocal.js`,
  `kolob-voices-pipeorgan.js` and `kolob-voices-folk.js`.
- **The composers are pure.** `KOLOB.Melody` and `KOLOB.Harmony` are handed
  a **moment** and the caller's stream and read nothing of the house:

  ```js
  moment = { now, meeting, section, activity, bright, mode, F0, seasonPos,
             arc, cumulative, assemblyFired, chord }   // chord: the chord stood on, or null
  ```

  The house reads the meeting only through `S.Meeting` (the chorister's
  book, a frozen set of accessors: `kolob-meeting.js`). `S.Harmony` is the
  **chord desk**: it voices from the chord standing at a time, writes into
  the chord book, and announces.

### 9.2 Streams (§3)

The labels as implemented (`kolob-core.js`, THE DICE):

| label | draws |
|---|---|
| `meeting:<n>` | the plan: season, F0, kind, mode, every section length and mutation, every guest's die and seat, cumulative, raspberry; `section:<i>` below it per section entered |
| `motif:<n>` | the day's temper and gestures (`Motif.newMeeting`) |
| `conductor:<n>` | three dice per 0.6 s tick, always thrown |
| `joints:<n>` | `joint:<i>` per section ended |
| `stillness:<n>`, `fuging:<n>`, `<voice>:<n>` | a turn each: `<voice>:<n>` → `turn:<k>` |
| `<voice>:wait:<n>` | how long a refused voice waits |
| `guest:<type>:<n>` | each guest (`bands`, `steeples`, `oldtune`, `cumulative`, `question`, `trombones`); the trombones fork `seat`, `shape`, `synth` and `material` (the dawn's chorale) below theirs |
| `synth:<voice>` | sound-level detail, the whole visit |
| `audition` | everything `sample()` throws |

- **Musical against sound-level.** Anything the note or event streams
  report, or any pitch that sounds, is musical. How a note sounds is
  sound-level. **A reported note is the written note**: where a player
  places it (the harmonium's loose alto, the choir's stagger) is
  sound-level.
- The substrate's `setRoomBalance` crossfade starts at the pump's
  `currentTime` (an indirect clock read); it is sound-level.

### 9.3 Time (§4)

- **Never use PJ2's `lane.in()` or `lane.every()` in musical code.** Both
  measure from `ctx.currentTime`. Use `S.cueAt(lane, t, fn)` and
  `S.cueIn(lane, dt, fn)`, which measure from the scheduled now.
- **A guest that keeps its own time** (the trombones) is cued when its
  section begins, at the moment its plan drew. The conductor's poll finds
  the others.

### 9.4 The Score (§5)

- **The chord book** (`KOLOB.Score.chordBook()`): every chord is written in
  at the time it sounds. The accompaniment reads the chord standing at its
  own onset. A composer's `Line.chords` will be written into it.
- **Line:** `chords[].id` (the chord book's id); `startBeat`.
- **Note:** `alt`, and `comma` (−1, 0, +1: a leap sung pure; the old tune).
- **Performance:** `lines`, `octave`, `beatS`, `wear`, `detuneCents` (the
  old tune).
- **Earth tunes:** `lds` (the hymnal's membership, with sources);
  `source.page` may be a string.
- **Chord qualities** add `sus` and `other` (a gapped scale's stack that is
  no triad).

### 9.5 Events (§6)

- **One event, both vocabularies.** Every event carries its `type` and
  payload **and** the legacy `cat`/`label`/`detail`, on one object, until
  the legacy fields are retired. The page reads types only. A reader of a
  type it does not know may fall back to the words (`tools/lib/dump.js`
  does).
- **The words** are `KOLOB.Score.EVENTS` (`kolob-score.js`). It is the
  machine-readable table, and a payload spec may nest (`hymn-announced.hymn`).
  Round 2 adds: `transport`, `sunrise`, `liahona`, `stillness`, `skip`,
  `joint`, `room-empties`, `verse-line`, `lining-out`, `fuging`, `field`,
  `chord`, `guest {guest, stage, logged}`, `guests-drawn`,
  `hymns-of-the-day`, and `motif-develop/-reprise/-answer/-disperse/-shadow`.
- **Nulls until their crews draw them:** `meeting-start.sunday` and
  `houseDialect`; `hymn-announced`'s `number`, `nameDs` and `dialect`;
  `telegraph.wordDs`. `cast` and `vision` are not emitted yet.
- **`guest-start` / `guest-end`** carry `until` as well: when the guest's
  sound ends. A section never turns over inside that span.
- **`verse-line` with `practice: "lined"`** is the choir's reply to the
  deacon's lined-out line: typed only, outside the verse walk. The page
  prints no row for it.
- **`question-asking`** is emitted once per Question (`k: 0`, `askings: N`).
  Whoever unshelves the Question chooses between that and one per asking.
- **Notes (`onNote`) carry, where they apply:**
  - `part` (S/A/T/B, `pedal`, `root`/`fifth`/`octave`, `doubling`);
  - `chord` (the chord book's id);
  - `hymnId`, `line`, `index`, `beat`, `deg`, `monzo`, `comma`, `tryNo`;
  - on a guest's notes: `guest` and `logged`. A note that says
    `logged: false` is neither printed in the minutes nor engraved.
- **Layers** add `oldtune` and `trombones`. Neither is engraved. A trombone
  note also carries `choir` (`far` | `near`) and `loud`.
- **The trombones' guest events:** `guest-start`/`guest-end` with
  `guest: "trombones"`, `section: "prelude"`; and `guest` with the stages
  `far` (the far choir's first call), `answer` (the near choir's first
  answer) and `together` (the far choir joins the last chord), each with
  `side` (`west` | `east`).
- **`KolobAudio.setForceVisitation(name)`** names the guest the Ives switch
  forces: `bands`, `steeples`, `oldtune` or `trombones` (`true` draws one).
  A `logged: false` guest is listed in `KOLOB._s.UNLOGGED_GUESTS`.

---

## 10. Round 3, adopted (the meeting sings composed hymns)

*The integration of the HYMN crew's composer (`handoff/r3-hymn-1.md`, its
requests to the integrator) into the meeting. Where this section and an
earlier one disagree, this section wins; the code named is the authority for
the details. Handoff: `handoff/r3-integrate-1.md`.*

### 10.1 Modules (§1, §9.1)

- **`kolob-hymnal.js` joins the engine**, among the performers, before the
  trombones (`_engine.php`). It is the day's hymnal — the house dialect and
  each hymn's dialect and key, drawn with the plan — and the composer's desk:
  it orders each hymn when the meeting is planned and brings it back, written
  **off the audio path**:
  1. in a Web Worker, where the page has one (the composer's own rooms —
     `pj2-rand`, `kolob-pitch`, `kolob-score`, `kolob-tunes`,
     `kolob-dialects`, `kolob-hymnists`, `kolob-composer` — loaded into it by
     the versioned URLs the page itself loaded);
  2. else in idle slices of the main thread (a timer, one hymn a slice,
     never a clock cue);
  3. and if a hymn is asked for before it has come back, it is written there
     and then, and counted (`KOLOB.Hymnal.stats().late`, `.lateInCue`).

  The hymn is the same by every road: the composer is pure, its stream is
  `hymn:<n>:<i>` rebuilt from the visit's seed and the label, and the
  meeting's earlier hymns are handed to it in the same order and the same
  lightened form (`KOLOB.Hymnal.lighten`: the Score whole, and of the dev
  report only `frame`, `peak`, `checks` and the fingerprint's `share`).
- **The composer's rooms** (`kolob-dialects.js`, `kolob-hymnists.js`,
  `kolob-composer.js`, loaded since the r3-hymn merge) are now called by the
  engine, through the hymnal only.
- **The performer** is the choir's room (`kolob-voices-choir.js`,
  `S.singHymn`), with the organ's part lines (`kolob-voices-organ.js`,
  `S.organPartLine`).

### 10.2 Streams (§3, §9.2)

| label | draws |
|---|---|
| `hymnal:<n>` | the day's hymnal: `house` (the house dialect); `hymn:<k>` per singing section (its dialect, its key, which way away) — thrown for every singing section of the plan, used or not |
| `hymn:<n>:<i>` | the composer's (as §3 wrote it: n the meeting, i the singing section from 1 — the doxology counts). Its forks are r3-hymn-1's (`dialect`, `hymnist`, `frame`, `skeleton`, `naming:<dialect>`, `tempo`, `harmony`, `harmony:repair:<r>`) and, below them, `performance` |
| `hymn:<n>:<i>` → `performance` | `tempo`, `verses`, `lead`, `tail`, `vowels:<v>`, `fuging`, `appetite`, `ornament:<v>:<line>:<voice>`, `precentor:<v>:<line>`, `fuging:<v>`, `assembly:<line>` |

`S.hymnStream(n, i)` is the stream; `S.visitSeed()` hands the seed to the
worker. The composer is given `dialect`, `meter` (the plan's draw; the
doxology's is the composer's own), `mode` (the section's: a dark Sunday's
doxology is written in the mode its sunrise will lift it into, read from a
fresh copy of the section's fork), `keyMonzo`, `id`, `gestures` (the first
hymn and the doxology are seeded from the day's theme, the others from the
day's other gestures; on a withheld Sunday only the doxology carries the
theme) and `others` (the meeting's earlier hymns). The hymnist is the
composer's own draw.

### 10.3 The Score (§5, §9.4)

Adopted from r3-hymn-1, as the composer writes them:

- **Hymn:** `amen` (a Line, sung after the last verse; the Tabernacle's);
  `hymnist` `{id, nameDs, nameEn}` (`nameEn` dev-only); `report` and
  `nameEn` (dev-only, never rendered).
- **Line:** `plan` (dev), `barStart`, `startBeat`.
- **Chords:** `name`, `inv`, `fn`, `tones` (`[class, alt]` pairs),
  `rootAlt`, `dim7`.
- **Note:** `alt`, `comma` (as §9.4), and `ornament` — the Old Way's
  ornament places (`turn`, `slide`, `grace`), which the performer decorates
  by each singer's appetite.
- **A composed note's `monzo` is relative to its hymn's key:**
  `Hz = keynoteHz × ratio(keyMonzo) × ratio(monzo)`.

### 10.4 Performance (§5.1)

A composed hymn is sung verse by verse in its dialect's practice:

| dialect | practice | the organ | the close |
|---|---|---|---|
| Tabernacle | `sung` every verse | modulates when the hymn is keyed away; gives out the tune (its last line, alone); doubles the four parts under every verse (full on the last of three or four) | the verse's full close; the plagal A-men after the last verse |
| Sacred Harp | verse 1 `notes` (fa sol la mi), then `sung` | none | the bare fifths the composer wrote; no A-men |
| Old Way | `lined` every verse: the deacon's clarinet gives each line, the ward answers slowly, everyone on the tune (the men an octave down), ornamenting at the marked places | none | none; no A-men |

- **Verses:** 2–4 in the Tabernacle, 2–3 in the Sacred Harp, 1–2 in the Old
  Way, 1–2 in a doxology — as many as the section has room for; a verse over
  100 s is sung once; no hymn runs past 1.5× its section's planned length.
- **`verse-start`** carries `performance`:
  `{hymnId, verse, practice, tempoMul, rubato, organ: {registration} | null, singers, beatS}`.
- **Today's choir** takes the Score's parts as the dialect asks
  (`S.hymnVoices`): the Sacred Harp's tenor is always sung.
- **Between verses:** a breath; and, where the section drew them, the
  fuging (on the hymn's own head; never in the Old Way or a doxology) and a
  guest seated in the section (in the gap after the middle verse; after the
  hymn when it has one verse).
- **A withheld Sunday's doxology is the assembly:** its first verse, the
  deacon doubling the tune above, told as the assembly's span and its
  `whole-tune` row.

### 10.5 Events (§6, §9.5)

- **`hymn-announced.hymn`** adds `authorDs` (the hymnist's Deseret name; in
  the contract, `str?`), and carries as extras `mode`, `key`
  (`home` | `sub` | `dom`), `keyMonzo`, `form`, `modeOfTime`.
- **`meeting-start.houseDialect`** is drawn (the hymnal's house).
- **New type `hymnal`:** `{house, hymns: [{id, section, dialect, key, meter}]}`,
  once a meeting, with the plan.
- **A composed hymn's events** say `composed: true`:
  - `verse-start` once a verse;
  - `verse-line` once a line, its `score` the composer's Line as written
    (in the hymn's key), with `keyMonzo`, `dialect`, and `amen` for the A-men;
  - `lining-out` once a lined line (`verse`, `line`).
- **`cadence`** (by `hymn`) at each verse's close, of the kind its last line
  ends on (`none` and `half` are not told), and at the A-men (`plagal`);
  (by `fuging`) the fuging's close — the Tabernacle's `plagal`, the Sacred
  Harp's `openfifth`. `fuging` carries `hymnId` and the `head` (degrees).
- **Notes of a composed hymn:** `part` (the singer's section), `sings` (the
  Score part sung), `hymnId`, `verse`, `line`, `beat`, `syl`, `deg`, `monzo`,
  `keyMonzo`, `comma`; `octave` (±1: a part sung an octave off); `amen`;
  `fuging` for the fuging's entries. The organ's: `part`, `hymnId`, `verse`,
  `line`, `beat`, `deg`, `monzo`, `keyMonzo`, and `givingOut`, `modulation`
  or `amen`; its pedal says `part: "pedal"`, its monzo an octave down. A
  trombone note names the dawn's hymn (`hymnId`).
- **No row for every line:** the page prints a composed hymn once a verse
  (`¶ VERSE n`), its number and name when announced (`№ HYMN n …`), and the
  deacon once a verse when he lines it out.

### 10.6 The house around a hymn (§4, §9.3)

- **A composed hymn owns its section** from its announcement to its last
  chord (`S.Meeting.hymnSounding()`): the joint waits for it and a breath;
  the house listens (`hallListens()` — the organist's own chords, the
  harmonium, the strings and the clarinet begin no turn); the guests wait
  (the hymn gives a seated guest its gap); the conductor's own fuging and
  assembly defer to the hymn's. The choir's own turns wait for the next
  section — except, once the hymn is done, to answer the deacon if he lines
  out a line of the day's material. The section lasts
  `max(planned, lead + the performance + tail)`.
- **The performer's hands on the meeting** are `S.Meeting.hands`
  (`owns`, `until`, `done`, `fugingPlanned`, `fuging`, `guestWaiting`,
  `guestInGap`, `assemblyBegins`); the book adds `house()`, `hymnal()`,
  `hymn()` and `hymnSounding()`.
- **Joints follow the house dialect** (the organ's amen is the Tabernacle's):
  a Tabernacle house as before; a Sacred Harp house closes dominant-to-home
  (`authentic`, or `half`), the meeting too; an Old Way house (whose lined
  hymns carry no harmony) keeps the organist's amens as ever.
- **Keys:** the first hymn at home (P 0.7; always when the trombones play it
  at dawn), a hymn after one sung away pulled home (0.8), the doxology home.
  A keyed hymn: the organ modulates through the day's own tonic chord (a chord
  the two keys share) to the new key's dominant seventh; the drone (the day's
  keynote) steps back to 0.22 under the hymn and returns after it.
- **The trombones at dawn** play the day's first composed hymn
  (`KOLOB.GuestTrombones.chorale({hymn})`), taken up at their cue; the prelude
  then lasts at least until the far choir's last chord has rung out. Without
  a hymnal (a lab with no composer), round 2's chorale of the poured theme.
  `KOLOB.GuestTrombones.perform(…, hooks)` takes `defer(at, fn)`: the engine
  lays the dawn out a phrase at a time on the guests' lane, 2.5 s ahead of
  each phrase (a whole composed dawn laid out in its cue was 390 ms of main
  thread), and tells each stage's row as its phrase is laid out.
- **`KolobAudio`** adds `getHymnal()`, `getHymn(id)`, `hymnalStats()` and
  `clockHealth()` (cues fired after their time; for the silent checks).

---

## 11. Round 3b, adopted (the ward sings the meeting)

*The CAST crew's requests (`handoff/r3-cast-1.md`, both halves) and the HYMN
crew's performance requests (`handoff/r3-hymn2-1.md`, 2–3), adopted as round
3b wires the ward into the meeting. Where this section and an earlier one
disagree, this section wins; the code named is the authority for the details.
Handoff: `handoff/r3b-ward-1.md`.*

### 11.1 Modules (§1, §9.1, §10.1)

- **`kolob-voices-vocal.js`** (the ward's voices: a throat each, the shared
  throat, ARMING) joins the engine among the voices, and **`kolob-cast.js`**
  (the ward and its people, the plan of each hymn, its cue sheet, the
  performer's desk) among the performers, before the hymnal
  (`_engine.php`). Neither is lab-only any more.
- **The performer of every composed hymn is the ward** (`S.singHymn` →
  `singHymnWard`, `kolob-voices-choir.js`), and so is every line the house's
  choir sang around the hymns: `S.choirVoiceLine` gives each old SATB voice's
  line to that section of the ward, its eight people each in their own voice
  (`wardSectionLine`). Round 3's four formant voices remain whole as the
  fallback (`singHymnHouse`, `houseVoiceLine`), used when the cast is not
  loaded or the dev switch `?choir=house` is set.
- **`VoicesVocal`** (voices-1 request 2, r3-cast requests 6 and 10):
  `singer(spec).sing(ctx, dest, t, notes, gain, { breathBefore, breathe, pan,
  inhale, defer })`; `spec.sharedPan`, `spec.sharedThroat`, `spec.level`;
  `arm(ctx, horizon, now)`, `joined(ctx)`, `pending(ctx)`, `parting(ctx)`,
  `forget(ctx)` (a stopped meeting's queue is let go); `budget` (the ledger of
  nodes alive).
- **`Cast`**: `seat`, `planHymn`, `score` (the whole sheet, the cast lab's),
  `segment(ward, hymn, plan, piece, opts)` (the meeting's: `"intro"`,
  `{verse: v}`, `"amen"`, `"tag"`, each from its own start, the same dice and
  arithmetic as the whole; `opts.carry` carries each singer's last note across
  pieces for the breath), `performer(ward, {V, synth, organ})` with the desk
  (`enqueue(t0, sheet)`, `tick(ctx, buses, horizon, pace)`, `clear()`,
  `pending()`, `stats()`), `ACTION_DS`, `ACTION_FORWARD`, `WARD_GAIN`.

### 11.2 Streams (§3, §9.2, §10.2)

| label | draws |
|---|---|
| `cast:<n>` | the ward seated for meeting n (with its plan): `families`, `member:<id>` (`S0`…`B7`), `roles`, `role:<role>`, `role:testimony:<k>`, `rename:<id>`. Meeting 0 is the rail's audition |
| `hymn:<n>:<i>` → `performance` | round 3's forks (§10.2), and now the cast's plan: its dice thrown on the fork's own sequence (verses, hummed, unison, descant, treble verse, the enthusiast, the child's, the alto's and the old bass's verses, the keying under the organ, every verse on the notes, the order they come forward), then `vowels:<v>`, `precentor:<v>:<li>`, `orn:<id>:<v>:<li>`, `child:<v>`, `descant:<li>`, `pitching`, and `fuging:<v>` (the ward's fuging) |
| `synth:vocal` → `meeting:<n>` → `member:<id>` | sound-level: each person's own throat, breath and jitter |

### 11.3 The Score and the Performance (§5.1, §10.3, §10.4)

- **Hymn** (r3-hymn2): `voiceOrder`, `kind`, `drone`, `fuge`
  (`{line, lines, gap, head, headNotes, entries, repeatFrom}`), `tag` (a Line,
  like `amen`), `round`, `partner` and `wandering` (dev); `Note.septimal`;
  `Chord.ring`, `Chord.swipe`. The performer sings the lines from
  `fuge.repeatFrom` a second time before any refrain, the `refrain` after
  every stanza, and the `tag` after the last verse.
- **Performance** adds `forward: [{memberId, role, action, lines, gainDb}]`;
  the plan adds `keying: {kind: "keying" | "pitching", by, habit, under?}`,
  `layout` (`pews` | `square`) and `chorister`.
- **The practices** (every built dialect):

  | dialect | before the first verse | the verses | the close |
  |---|---|---|---|
  | Tabernacle | the organ modulates (keyed away) and gives out the tune; now and then (~20 %) the chorister hums the first note under its last chord | `sung`; one middle verse now and then `hummed` (the organ rests) or in `unison`; the last of three or four the soloist's `descant`, or now and then her treble verse alone over the organ | the plagal A-men |
  | Sacred Harp | the pitching | verse 1 `notes`, then `sung` (now and then every verse on the notes); the hollow square | the bare fifths written |
  | psalmody | the pitching | `sung`, the fuge sung twice; the hollow square | the written close |
  | Old Way | the chorister keys it | `lined`: the precentor gives each line, the ward answers | none |
  | gospel | the chorister keys it | `sung` (now and then a middle verse in `unison`), the quartet in the ward, the refrain after each verse | the tag |
  | Shaker and Primary | the chorister keys it | `unison`, a few men humming the drone under it where the tune has one | none |

- **The ward's parts** (`Cast.assignment`): eight a part; the Sacred Harp and
  the psalmody double the treble and the tenor in octaves; gospel seats the
  quartet (the tenor harmony with five trebles, the lead with the altos and
  three trebles, the baritone with the tenors, the bass); unison, lined and
  the Old Way put everyone on the tune (the men an octave down); a child
  sings the tune.
- **Who comes forward**: one or two on a line, never more; never the same
  person two verses running (the precentor excepted); the treble verse is
  the soloist's alone; the newcomer is silent in the day's first hymn until
  the line they join on.

### 11.4 Events (§6, §9.5, §10.5)

- **`cast`** is emitted: `{memberId, nameDs, action, actionDs, role, hymnId,
  verse?, line?}` — `action` in English (dev), `actionDs` the minutes'
  Deseret capitals. The actions: `keys the hymn`, `hums the first note`,
  `pitches the tune`, `lines out`, `comes forward`, `sings the descant`,
  `sings the treble verse`, `sings the tune`, `loses the words`, `finds them
  again`, `joins in`, `sings out` (a person comes forward: the minutes give
  these a ✦ row, the precentor's lining-out its ☞ row), and `blends back into
  the ward`, `falls silent` (their moment ends: no row).
- **`hymn-announced`**: `leaderDs` is the chorister; `ward` (an extra) is
  `{chorister, keying: {kind, habit, under, by, byDs} | null, practices: [..],
  forward: [{memberId, nameDs, role, verse, action, actionDs}], layout}` —
  who will come forward, named before they do.
- **`lining-out`** of a composed Old Way line names the precentor: `by`,
  `nameDs`.
- **`verse-start.performance`** is the cast's Performance (with `forward`),
  plus `tempoMul` and `beatS`.
- **`prelude-seating`** carries `ward: {seated: 32, people: [{memberId,
  role, nameDs, part}]}`.
- **Notes of the ward** (`onNote`, layer `choir`): a section's written notes
  once for each section singing a Score part in an octave (not once for each
  of its eight people), as §10.5; and a person's own line once for that
  person — `member`, `role`, and `sings: "key"` (the keying or the pitching's
  tonic), `"descant"`, or `"drone"` (the Shakers'), with the section in
  `part`; `pitching` (the pitching's notes), `liningOut` (the precentor's
  line), `tag`, `repeat` (a fuge sung again).

### 11.5 Time and the house (§4, §9.3, §10.6)

- **The ward's desk.** Every piece the ward sings (a hymn's intro, each
  verse, the amen, the tag, the fuging, a section's line) is written as a cue
  sheet when the meeting decides it (a verse `PREP_S` = 4.5 s before it
  begins) and put on the desk at its start on the audio clock. One pump, a cue
  on the `ward` lane every 0.12 s of the music's time, hands the lines to the
  voices 3 s ahead (at most 12 a call unless due within 1.2 s) and joins each
  to the room 0.6 s before it sounds (ARMING). The pump reads the music's now,
  never the audio clock. STOP clears the desk and `VoicesVocal.forget`s the
  queue; a piece whose hymn no longer owns its section (a dev jump) hands
  nothing more.
- **Levels.** The ward pours into the choir layer (its slider, its seat in
  the rooms) at `WARD_LEVEL` (0.16, `kolob-core.js`); a person come forward
  into a nearer seat beside it (`ROOM_DEPTH["choir-near"]`, under the same
  slider). A section of eight standing in for a house voice sings at
  `HOUSE_SECTION_GAIN` (0.68, `kolob-voices-choir.js`).
- **`KolobAudio`** adds `getWard()` (who is seated: the people, by role, in
  Deseret; `nameEn` and the archetype dev-only), `wardStats()` (lines handed,
  tight, late, the tightest margin, the most in one pump, mouths joined),
  `getChoir()` (`"ward"` | `"house"`) and `setChoir(which)` (dev, before
  PLAY; `?choir=house` sets it).

