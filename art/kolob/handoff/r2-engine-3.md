# r2-engine-3 — the Score, the typed bus, and the old tune sings the Earth tunes (Round 2, milestone 3)

*Crew: r2-engine. Branch `kolob-r2-engine`. 2026-09-27.*

**Branch-local version:** `v0.32-r2-engine.3 — the old tune is a real Earth
tune now: the melody of its first line or two, as the owner reviewed it in
the Earth Tunes Lab, faint and far; the page reads typed events (it looks
exactly as before), and a guest marked unlogged is never named.`
VERSION is not bumped; the integrator assigns v0.34.

Built on milestone 2 (`f61cc3e`). **kolob-2 is merged in first** (`269461f`:
the tunes crew's `lds` field, five Psalmody tunes, KINGSFOLD's Amen — only
`kolob-tunes.js` and the Earth Tunes Lab, which this crew does not touch), so
the old tune is tested against the 21 tunes that exist today.

Everything is silent-tested: the Node harness, and muted headless Chrome
(`--mute-audio`, port 9421).

---

## What shipped

### a. `kolob-score.js` — the Score (SCORE §5), pure

- **The shapes:** `hymn()`, `line()`, `note()`, `chord()`, `performance()`
  make a Score object from a sketch, with every field the contract names. A
  maker's own fields ride along (the Earth tunes' `alt`, `comma`, `src`;
  `Line.startBeat`).
- **The proofreader:** `validateHymn / Line / Note / Chord / Performance /
  Event`, and `validate(obj, kind)`. Each returns the list of what is wrong,
  empty when right, every problem naming where it is. It checks:
  - parts line up by beat, one voice per part (no overlap);
  - the melody has one onset per syllable, counting on from 0 through the
    verse (and again through a refrain);
  - the spelling agrees with the pitch up to a comma (a chromatic `alt`
    note up to a semitone);
  - cadences, chords, qualities, practices, dialects, modes are the
    contract's words;
  - an Earth tune cites its source;
  - a Performance names a real hymn and real lines.
- **The clerk's copy:** `toJSON`, `fromJSON(text, kind)`, and
  `roundTrip(obj)`, which says whether an object survives JSON exactly (an
  undefined, a function, NaN, ±Infinity, a non-plain object or a cycle does
  not).
- **The reader's helps:** `chordAt(line, beat)`, `notesAt(hymn, t)`,
  `timeline(hymn)` (seconds from the Score's start, using `Line.startBeat`
  where a line names one), `syllableMap(hymn, verse)`, `lineLength(line)`.
- **The event vocabulary:** `KOLOB.Score.EVENTS`, every typed event's
  payload by field kind (below). The harness validates every event with it.
- **The chord book** (M2) is unchanged.
- **Pure:** the harness reads its code for `Math.random`, `Date.now`,
  `performance.now`, `AudioContext`, `document`, `KOLOB._s`, timers and
  `currentTime` (none), then loads it **alone** in a bare `vm` context
  (with `kolob-tunes.js` after it), proofreads all 21 Earth tunes there,
  writes them out and back, passes a right event and line and refuses a
  wrong one. `KOLOB._s` stays undefined.

**The engine now writes Scores:**

- **Every line the choir sings** is told as a Score `Line`
  (`KOLOB.Harmony.toLine`, pure, a transcription — no die is thrown): four
  parts by beat, each note spelled as a 7-space degree (the gapped scales'
  indices mapped back) and pitched as an exact monzo (the ii's re a comma
  low, 10/9, as sung), the chord at every onset with its numeral, root and
  quality (read off the pitches the chord sounds), and the cadence the line
  comes to (the Earth tunes' reading). Stress follows the meter's foot
  (87.87 trochaic, the others iambic). The chords keep their chord-book `id`.
  It rides on the `verse-line` event as `score`.
- **Every old tune** carries its `Performance` (hymnId, verse 0, practice
  `hummed`, tempoMul, and the extras `lines`, `octave`, `beatS`, `wear`,
  `detuneCents`).
- **The Earth tunes** themselves are proofread every run (the Hymns the
  engine performs from).

### b. The typed bus (SCORE §6)

- **One event, both vocabularies.** Every `emitEvent` in the engine now
  sends `{type, t, …payload}` **and** keeps its legacy `cat/label/detail` on
  the same object, so the harness's older tallies, the r2-tools dumps and
  the dev tools read on unchanged. Nothing is emitted twice.
  - Without guests, the music is **byte-identical** to M2: M2 (`269461f`)
    against now, 16 seeds × 1200 s, the same notes and the same legacy
    events in 14 of 16 seeds. The two that differ are the seeds where an
    old tune came, and they differ from its first note.
- **SCORE §6's types, emitted:**
  - `meeting-start {n, sunday: null, kind, mode, keynoteHz, houseDialect: null}`
    (+ `f0`, `season`). The calendar and the house dialect are not drawn yet.
  - `section-start {section, index}` (+ `dur`, `meter`).
  - `hymn-announced {hymn: {id, number: null, nameDs: null, meter, dialect: null}, leaderDs: null}`.
    It is emitted at each hymn and doxology. There is no composer yet, so
    there is no number, name or dialect to give.
  - `verse-start {hymnId, verse, practice: "sung"}`, when a stanza begins.
  - `cadence {kind}` (+ `by`, `at`, `hymnId`): every cadence the chord desk
    voices.
  - `guest-start / guest-end {guest, section, logged}` (+ `until`).
  - `telegraph {word, wordDs: null, marks}` (+ `reply`). The engine has no
    transliterator.
  - `question-asking {k: 0, questionId: "q:old"}` and `question-unanswered`:
    the shelved Question's code, typed for whoever unshelves it.
  - **Not emitted:** `cast` and `vision`. There is no cast and there are no
    visions yet.
- **Round 2's additions** (requested for §6), so that nothing the page
  prints is read off a label:
  - `transport {action: play|stop|sample}`
  - `sunrise`
  - `liahona {points: day|meter}`
  - `stillness`
  - `skip` (the dev jump)
  - `joint {last, toward, dur}`
  - `room-empties`
  - `verse-line {hymnId, verse, line, speechLine, practice, score}`
  - `lining-out`
  - `fuging`
  - `field {field}`: keyed by what *sounded*. The crickets keep still in a
    full hall and the wind speaks for them, and the differential test below
    caught it.
  - `chord`: the harmony row.
  - `guest {guest, stage, logged}`: bands approaches/cross/passes;
    steeples answer/last-bell; oldtune remembered/gives-out; assembly
    withheld/whole-tune; raspberry blat/amen.
  - `guests-drawn`
  - `hymns-of-the-day`
  - `motif-develop / -reprise / -answer / -disperse / -shadow`
- **`kolob-ui.js` reads types, never labels.**
  - `dsEvent` is a switch on `ev.type` that writes each row from its
    payload.
  - Each row keeps the CSS class its v0.32 category gave it (the gilt
    glyphs, the motif's ink).
  - The internal phrase rows are typed too.
  - Grep finds no `label`, `.cat` or `.detail` read left in the file. The
    ambient regex table is gone; the page uses the field keys it already
    had.
  - v0.32's quirks are kept on purpose, so the page is identical:
    - a sunrise prints as MEETING with no number;
    - the dev jump prints ◦ STILLNESS;
    - the telegraph, "clarinet lines out" and "harmonium shadows" print in
      Deseret even in Latin mode.
- **`kolob-viz.js`: event plumbing only.** It takes `question-asking` /
  `question-unanswered` and `transport {action: "stop"}` by type. Its drawing
  is untouched.
- **`logged: false` (the Hosanna, honoured now):**
  - The meeting's `UNLOGGED` table (`{hosanna: true}`, lent as
    `KOLOB._s.UNLOGGED_GUESTS` so a test can add a guest) marks a guest when
    it arrives.
  - Every event the guest sends carries `logged: false` (`tell(V, ev)` in
    kolob-guests.js), and so does its span.
  - `KolobAudio.getConductor().visit` never names it, so the direction line
    stays blank.
  - The page drops any event with `logged: false`. It keeps its own tally of
    unlogged spans from `guest-start/end` and blanks the direction flag for
    them. It writes no phrase row for a note that says `logged: false`, or
    for a layer it has no Deseret name for.
- **The Ives switch can name its guest** (dev): `setForceVisitation("oldtune" | "bands" | "steeples")`.
  - `true` still draws as before, and the die is thrown either way.
  - The harness and the critic can force the old tune.

### c. The old tune sings the corrected Earth tunes (the audible change)

- **v0.30's `OLD_TUNES` incipits are gone.** The guest draws from
  `KOLOB.Tunes.list` and reads only `list` and `byId`, never editing
  `kolob-tunes.js`. A tune the tunes crew adds joins the pool with nothing to
  change.
- **What it sings:** the melody part (`melodyPart`: S, or the Sacred Harp
  tenor) of the tune's first line, or first two, in the book's own rhythm.
  - Ties are held as one note.
  - A rest between lines (from `startBeat`) is kept.
  - A breath is taken at each line's end: the swell dips and comes back.
  - Two lines are sung when a die (½) says so or the first line alone is
    under 9 s, when the day holds the second, and when the two are at most
    26 s.
  - The tempo is the book's `beatS` × 1.15–1.45 (remembered slower).
  - The octave sets the excerpt's middle where v0.30's memories sat (a
    7-space degree 8 over the keynote): about 390–800 Hz.
  - Faint and far as before, with the same far voice, the same field edge,
    +8 ¢ worn, and the same seeded wear (never the first two notes; a note
    dropped and its neighbour held, or one held ×1.6).
  - The fainter second try of the head (v0.30's first five notes) and the
    ✧ rows are unchanged. Every die is now thrown first, whether used or
    not.
- **The mode law, made exact (computed, never hand-listed):**
  - A minor tune (`mode` aeolian/dorian) comes only on dark Sundays, a major
    one only on bright Sundays. This is v0.30's law.
  - It comes only where the day's tuning holds **every** note of the melody
    it will sing, exactly. Each note's monzo, with the comma the book's
    harmony leaned it by taken back out, must equal the day's own pitch for
    its degree (`KOLOB.Pitch.MODE_MONZOS`). So:
    - a line with ti waits for ionian (the mixolydian ti is flat);
    - a line with fa or ti never comes on a penta Sunday, nor one with ti on
      a hexa Sunday;
    - a minor line with le waits for aeolian;
    - a chromatic note keeps a line out.
  - The pool today (² = both lines held):
    - ionian 16 (all ²);
    - mixolydian 14;
    - hexa 14;
    - penta 11;
    - aeolian 5 (all ²: KEDRON, IDUMEA, WONDROUS LOVE, THE PROMISED LAND,
      KINGSFOLD);
    - dorian 5 (IDUMEA², THE PROMISED LAND², KINGSFOLD², KEDRON, WONDROUS
      LOVE).

    Every mode has tunes, so the old tune comes as often as before (its
    die is unchanged).
- **The weights (for the owner's ear):**
  - KINGSFOLD, the house hymn ("If You Could Hie to Kolob"): 6;
  - a tune in either LDS hymnal (`lds.hymns1985` / `homeAndChurch`,
    read if present): 3;
  - the tradition's other tunes: 1.5.
- **"Earth form → colony answer."** v0.30 has no ward answer: it plays the
  far first phrase, then a fainter second try at the head. I kept exactly
  that.
  - PLAN §8.4's "the ward answers with that tune in the meeting's dialect"
    is Phase 4 (GUEST).
  - It is a new creative direction, so it was not built here.
- **Its notes are told as the Score says** (layer `oldtune`, unengraved as
  before), with `part`, `hymnId`, `line`, `index`, `beat`, `deg` and `monzo`
  (as sounded, relative to the keynote) and `tryNo`.
- **`KolobAudio.getOldTunes()`** (the tune lab) now returns the Earth pool in
  v0.30's shape (name, w, minor, `[[deg, beats]]` of line 1 in the lab's
  register), plus `id` and `modes`.

### d. Pages

- **`_engine.php`:** `kolob-tunes.js` joins the one list after
  `kolob-score.js` (SCORE §1 step 2).
  - The load guard checks it by `KOLOB.Tunes`: the tunes crew's file answers
    no roll call.
  - `index.php`'s `$kolob_assets` (and so the footer fingerprint) covers it
    through the list.
- **The labs that load the engine** (room-lab, tune-lab) get it the same way.
  The others are unchanged.

---

## How I verified it

- **Harness, the standard set (15 runs), all PASS:**
  - 1847/5/9/77/4242/12 × 1200 s;
  - Ives + raspberry + cumulative × 1500 s on 3, 12, 1847 and 21;
  - 113 with Ives;
  - 2700 s on 1847, and on 5 with all three flags;
  - `oldtune unlogged=oldtune` on 9;
  - `ives unlogged=steeples` on 5.

  Across them:
  - 5 683 of 5 683 events typed, every payload the contract's (26 types
    seen; `sunrise` on seed 30; `skip` and `sample` in Chrome);
  - 215 sung lines proofread, and **6 340 of their notes pitched from the
    Score exactly as the choir sang them** (F0·4·ratio(monzo) against the
    chord row at that beat, 1e-9);
  - 21 Earth tunes proofread;
  - pitch adherence 100 %.
- **Sweep, 60 more seeds, all PASS:**
  - 2001–2040 × 1200 s with Ives;
  - 3001–3020 × 1500 s with `oldtune razz cumulative` (41 old tunes,
    726 notes matched to the book).
- **The old tune (the acceptance):** `node _harness.js oldtunes 20 900`
  gives **OLDTUNES: PASS**.
  - **21 forced old tunes through the conductor, in every mode:** ionian 5,
    mixolydian 4, hexa 4, penta 4, aeolian 3 and dorian 1 (seed 18, THE
    PROMISED LAND).
  - **Every one matched note by note to its Earth tune:**
    - the written note (line, index) in order;
    - the duration = the book's beats (ties merged, the wear the
      Performance names) × its beatS, to 1 µs;
    - the degree = written + 7 × octave;
    - the monzo = the book's (comma taken out) × 2^octave, and it is the
      day's own pitch for that degree;
    - the frequency = F0·4·ratio(monzo)·2^(8/1200), to 1e-9;
    - the mode law.
  - **`everytune`:** every admitted tune × every mode × lines held, 121
    rememberings and 1 842 notes straight through the guest, all the book's.
- **Captures (muted Chrome, a tap inside the page).** In each, the old tune's
  strongest partial sits on the told pitch: median 0.3–2.3 ¢, worst 5.9 ¢
  (the 8 ¢ wear is in the told pitch). Files are in
  `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r2m3/cr/out/`
  (`.wav`, `-spectrogram.png` with the told notes drawn over, `.json`):
  - `kingsfold-iso`: seed 10, forced; aeolian KINGSFOLD, 2 lines; every
    layer and field at 0, so only the far voice and the room;
  - `assembly-iso`: seed 16; THE SPIRIT OF GOD (ASSEMBLY), 2 lines;
  - `alliswell-mix`: seed 5, the full mix, 0–60 s; ALL IS WELL in the
    prelude at 0:14, audible over the drone and organ and not dominating
    them.
- **The page: identical minutes, the old UI against the new (the
  acceptance).**
  - **Deterministic differential test** (`scratchpad/r2m3/uidiff.js`):
    - M2's kolob-ui.js and the new one run side by side in Node, a DOM stub
      recording every row.
    - Both are fed the same recorded streams (11 harness dumps: bands,
      steeples, the old tune, raspberry, cumulative, a sunrise, 2700 s),
      in Deseret and in Latin.
    - **7 158 rows identical, row for row and class for class.**
    - In the dump with an unlogged guest, the new minutes are exactly the
      old minutes with that guest's 6 rows taken out.
    - It has teeth: it found the crickets/wind case above.
  - **Muted Chrome A/B** (`cr/ab.js`: tab B is served the pre-milestone
    kolob-ui.js and kolob-viz.js through CDP Fetch, on the same engine and
    seed):
    - seed 5 `oldtune`: minutes identical, direction line
      `["", 𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤]` in both;
    - seed 1847 `bands` in Latin, with a dev jump and an audition: identical
      rows (compared without their clock, since the tabs act at slightly
      different music times), "two bands" in both, board identical;
    - seed 21 `steeples` in Latin: identical, and the screenshots differ by
      0 pixels.

    **The live races:** two live tabs can set two neighbouring rows in
    either order, or floor one row's clock a second apart. An engine event
    is written when it is cued, a phrase row when the audio reaches it. It
    happened once each in two runs of seed 21. The third run, and a
    new-UI/new-UI control, were identical. The Node test is the authority.
  - **Unlogged, in the page:**
    - Seed 9 with the old tune marked unlogged: the new UI prints no ✧ row
      and never shows the flag, and `getConductor().visit` never named it.
    - The old UI in the other tab printed the ✧ row: the control.
    - In the harness, `force=bands|steeples|oldtune unlogged=<same>`: every
      event of the guest said `logged: false`. The conductor's poll, asked
      every 2 s while it sounded (15–73 times), never named it.
  - **Consoles clean:** index.php and every lab (room, tune — it lists the
    21 tunes and plays one — earth-tunes, bagpipe, question, voices,
    instruments). Screenshots are in `cr/out/`.
- **REPRO PASS:**
  - `1500 1847 ives razz cumulative`;
  - `1200 77`;
  - `1500 9 ives`;
  - `1500 21 oldtune`;
  - `1200 4242`.

  In each, the score is identical under jitter and the sound changes only
  with the salt.
- **`transport` PASS:** 1847 and 77.

## Harness changes (`art/kolob/_harness.js`, untracked; the integrator copies it)

- **Copy:** `…/scratchpad/r2m3/_harness.m3.js`. It needs this branch's
  engine, or `kolob-tunes.js` in the list.
- **New printed lines and verdicts:**
  - **`typed bus`:** every event typed, every payload per
    `KOLOB.Score.EVENTS`, counts by type.
  - **`scores`:** every sung line proofread, round-tripped, and its notes
    pitched as sung; old-tune performances; the Earth tunes.
  - **`old tune`:** the per-note match to the book and the law.
  - **`old-tune pool by mode`:** replaces `FOLD_UNSAFE`, which was the law's
    special case.
  - **`the score room alone`:** the purity scan and bare-context load.
  - **Verdicts:**
    - an untyped event, or a payload not the contract's;
    - a Score that does not proofread, or a note not what was sung;
    - an Earth tune that does not proofread;
    - an old-tune note not the book's, or the law broken;
    - an unlogged guest's event without `logged: false`, or the poll naming
      it.
- **New flags:** `oldtune`, `force=<guest>`, `unlogged=<guest>`,
  `everytune`.
- **New modes:** `node _harness.js oldtunes [n] [secs]`.
- **Fixes:**
  - The tuning is read from the typed `meeting-start` / `sunrise` exact
    `f0`. The legacy detail printed it to a tenth, which read a correct note
    as 0.06 % off.
  - The run ends with `process.exitCode`, not `process.exit()`. On macOS a
    pipe is written asynchronously, and `exit()` cut the child modes' long
    reads at 8 KB.
  - `kolob-tunes.js` is checked by `KOLOB.Tunes`, not the roll call, and
    is no longer LAB_ONLY.
- **Scratch tools** in `…/scratchpad/r2m3/`:
  - `uidiff.js` (the UI differential), `cmp.js` (dump A/B);
  - `std.sh`, `sweep.sh`, `repro.sh`, `ident.sh`, `dumps.sh`;
  - `cr/` (cdp.js with Fetch swap, `ab.js`, `capture.js`, `spec.py`,
    `labs.js`, `ui-pre.js`/`viz-pre.js`);
  - `base/` (M2 for A/B).

## How to hear or see it

Serve: `php -S 127.0.0.1:8111 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r2-engine`, then `/art/kolob/`.

- **`?seed=1004`, no switch:** CORONATION ("All Hail the Power of Jesus'
  Name", in the LDS book as "Jehovah, Lord of Heaven and Earth") comes out of
  the prelude at 0:17 on a hexatonic Sunday, far off, then a fainter try at
  its head.
- **`?seed=5` with the Ives pill armed before PLAY:** ALL IS WELL ("Come,
  Come, Ye Saints"), two lines, in the prelude at 0:14. The board reads
  𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤 and the minutes ✧.
- **To hear a particular Sunday's memory,** type
  `KolobAudio.setForceVisitation("oldtune")` in the console before PLAY:
  - `?seed=10`: KINGSFOLD, the house hymn, on a dark aeolian Sunday at 0:15;
  - `?seed=16`: THE SPIRIT OF GOD, two long lines at 0:18;
  - `?seed=18`: THE PROMISED LAND on a dorian Sunday, at 11:28.
- **The minutes, the board and the direction line** look exactly as they
  did.

## Requests to the integrator

1. **SCORE §6: adopt the round-2 words.** They are the table in
   `KOLOB.Score.EVENTS`, with the payloads above. Please also note:
   - one event object carries both vocabularies until the legacy fields are
     retired (the harness and the r2-tools dumps still read `cat`/`label`);
   - `meeting-start`'s `sunday` and `houseDialect` and `hymn-announced`'s
     number, name and dialect are `null` until FORM and HYMN draw them;
   - `telegraph.wordDs` is `null` (the engine has no transliterator: the
     page's to make, or the WORDS crew's);
   - `question-asking` is emitted once per Question with `k: 0` and
     `askings: N` (v0.32's shape). SCORE says one per asking; whoever
     unshelves it should choose.
2. **SCORE §5: bless these.**
   - `Line` extras: `chords[].id` (the chord book's id).
   - `Performance` extras: `lines`, `octave`, `beatS`, `wear`,
     `detuneCents`.
   - The `onNote` extras: `hymnId`, `line`, `index`, `beat`, `deg`,
     `monzo`, `tryNo`.
   - `KolobAudio.setForceVisitation(name)`.
   - The tunes crew's pending requests (`Line.startBeat`, `Note.alt`,
     `Note.comma`, `source.page` as a string) are used and relied on here.
   - The chord qualities `sus` and `other` (a gapped scale's stack that is
     no triad).
3. **tune-lab.js** (not mine): its verdict column restates v0.30's law
   (`fitsMode`), and `HYMN_NAMES` is v0.30's seven. It could read the new
   `modes` from `getOldTunes()`, or retire in favour of the Earth Tunes Lab.
   It loads and plays cleanly as it is.
4. **The r2-tools crew:**
   - their dump normalizer should carry the new absolute-time fields: the
     `verse-line`'s `start`; `joint.dur`, which is relative; `cadence.at`,
     as before;
   - the typed events add fields to events that were already there, and
     `hymn-announced` and `verse-start` are new typed-only events;
   - `capture.js` is theirs; mine in `cr/` is a small copy for the old tune.
5. **The Hosanna (GUEST, Phase 4):** add `hosanna` to the meeting's
   visitation table and it is unlogged already (`UNLOGGED`). Its own events
   must go through `tell(V, …)` (kolob-guests.js), and its notes should say
   `logged: false` if it reports them on a layer the page names.
6. **Merge recipe:** kolob-2 is already merged into this branch; copy
   `_harness.js` as before.

## Known issues and notes

- **A choice for the owner's ear:**
  - the pool's weights (KINGSFOLD 6, LDS tunes 3, the others 1.5);
  - the two-line rule (½, or when the first line is short);
  - the tempo (×1.15–1.45 of the book's).

  Over the 21 forced: 7.5–22 s for the first try (median ≈ 13 s; v0.30's
  incipits ran 12–16 s). THE SPIRIT OF GOD's two lines are the longest, at
  22 s.
- **Mixolydian loses the tunes whose opening sings ti.** ALL IS WELL,
  ASSEMBLY, and the second line of SIMPLE GIFTS and NEW SALEM are among
  them; v0.30 played them with a flat seventh. That is what "pitches in the
  lattice" and "the book's melody" require together. If the owner would
  rather hear a modal recolouring, it is one line in `holds()`, and the
  harness will list the pitches as off the book.
- **The dev jump prints ◦ STILLNESS in the minutes,** as v0.32 did; kept for
  identity. The `skip` type is there if the owner wants its own row.
- **A forced old tune can lose its seat** to a guest drawn for the same
  section (one guest at a time, as ever; seed 1 has the steeples in the
  prelude). The harness notes it, and does not fail.
- **`cast` and `vision` are not emitted** (no producers).
  `hymn-announced` has no number or name until HYMN.
- **The choir's Score Lines are transcriptions**, not a composed hymn: no
  peak, no fermata, no verse text. Each line's syllables count from 0.
- **In the isolated captures** the room's tail after the old tune is short
  (≈1 s to −60 dB). I did not dig: it is the room's (the wide IR), not the
  guest's, and the full-mix capture sounds as v0.32's memories did.
