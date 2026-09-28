# KOLOB 2 — THE CONTRACT

*This is the interface every Kolob 2 crew codes against. It is owned by the
integrator (branch `kolob-2`). Draft 1, 2026-09-26; round 2's requests
adopted 2026-09-27 (§9, which wins where it and an earlier section differ).*

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
