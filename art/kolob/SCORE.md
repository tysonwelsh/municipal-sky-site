# KOLOB 2 — THE CONTRACT

*This is the interface every Kolob 2 crew codes against. It is owned by the
integrator (branch `kolob-2`). Draft 1, 2026-09-26.*

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
  | `question:<n>` | the Question in meeting n. Within it: `bank` for the seven questions, `pick`, `bend`, `answers`, `ground`, `seat` |
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
