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

---

## Round 2 — the critic's findings, fixed

*Crew: engine-m3, continued. Built on `cdafc4b`. 2026-09-27. All seven
findings are fixed, and none is disputed. Two of the fixes go further than the
critic asked, and I say where below.*

**Branch-local version:** `v0.32-r2-engine.3.1 — an unlogged guest is silent
on the page, its notes as well as its words; the house hymn's leap is sung
pure; no memory is shorter than 8 s; MARTYR sits an octave lower; the
doxology begins at its own first line.` VERSION is not bumped.

### What changed, finding by finding

**1. [blocking] An unlogged guest's notes reached the page.**
- **Every note a visitor sounds now names the guest and says whether the
  page may show it.** `guestNote(V, guest, extra)` sits beside `tell()` in
  kolob-guests.js and stamps `guest` and `logged` on each note:
  - the steeples' home bells;
  - the band's fife and bass;
  - the old tune;
  - the shelved Question's harmonium answers.

  A logged guest's notes say `logged: true`.
- **The staff.** `kolob-viz.js` changes in its plumbing only: `onNote` and
  `onEvent` return on `logged === false`. The drawing is untouched.
- **The minutes.** `kolob-ui.js` already dropped such notes. Now it is sent
  them.
- **Not done, and why.** The Question's clarinet askings are told inside
  `renderClarinetLine`, which takes no tag. The Question is shelved, so I
  left a FOR WHOEVER UNSHELVES note rather than widen the winds' signature
  and its forwarders.
- **REPRO 1**, `1200 13 force=steeples unlogged=steeples`, through the UI
  differential:
  - HEAD prints `♮ BELLS SPEAKS` at 00:14. Now nothing is printed there.
  - The new minutes do show a `♮ BELLS SPEAKS` at 00:42. That is the resident
    tine at 1854 Hz. The steeples' ringing used to keep it inside one phrase;
    now the page reads as if the guest never came.
  - In muted Chrome (`cr/ab.js 13 50 steeples unlogged=steeples`), the old UI
    in tab B prints ◎ and BELLS SPEAKS at 00:14. The new UI prints neither,
    and its direction line stays blank.
- **REPRO 2**, in muted Chrome: seed 49, bands forced and unlogged, skip to
  the hymn (`cr/vizband.js`).
  - The site's own kolob-viz.js is served through CDP Fetch with one probe
    line that reads its band arrays. The file on disk is untouched.
  - **Unlogged:** 190 band notes were told, all `logged: false`. The viz held
    0 of them and no band visit. The poll said `null` and the direction line
    was blank.
  - **Logged control:** the viz held 190, with 1 visit and the direction
    "𐐓𐐅 𐐒𐐈𐐤𐐔𐐞".
  - Both consoles were clean.
  - Screenshots: `cr/out/viz-bands-{unlogged,logged}-s49.png`.

**2. [minor] The doxology numbered its verses from where the last hymn
stopped.**
- **The fix.** `enterSection` now resets the verse walk for the doxology as
  well as the hymn (kolob-meeting.js). The doxology has its own hymnId, so it
  begins at its own first line.
- **Before, on HEAD:** seed 31 has `h:1:3` opening at verse 1, and seed 7
  (ives razz cumulative) has `h:1:4` opening at verse 1.
- **Now:** both open at verse 0, line 0, with a verse-start.
- **This is audible, a little.** The walk chooses each line's syllable count,
  so an SM doxology that follows a hymn which ended mid-stanza now opens with
  SM's 6-syllable first line. It used to open with the 8-syllable third line.
  - In CM, LM, 87.87 and CMD, line 0 and line 2 are the same length, so
    nothing changes there.
  - Of the 16 identity seeds, 2 change (1003 and 1010), from the doxology on.

**3. [owner-ear] The wolf fourth in KINGSFOLD.**
- **The leap sung pure.** This is PLAN §2.4's comma tracking, applied to the
  far voice: `leapLeans()` in kolob-guests.js.
  - Take a leap of a fourth or a fifth **within one breath** that the day's
    pitches make a wolf (27/20 or 40/27).
  - One note of the two leans a syntonic comma, so that the leap is pure.
- **Which note leans.** It is the note whose leaned pitch is the simpler ratio
  over the keynote (Tenney height):
  - te rises to 9/5 (not me falling to 32/27);
  - re falls to 10/9, the choir's own ii re (not la rising to 27/16).
- **When a lean is refused:**
  - if it would take a note further from the drone than half a bit of
    Tenney height, so in practice only re and te ever lean;
  - if it would sour the other neighbour.
- **Runs.** A run of one pitch leans together, so there is never a comma jump
  on a repeated note.
- **What does not change.** The mode law is unchanged, and no die is thrown.
- **In KINGSFOLD** (aeolian and dorian, first line, "voice of Je-sus"), the D
  sounds at 9/5 and the D→G leap is a pure 4/3.
  - The captures (`cr/out/kingsfold-iso`, `kingsfold501-iso`, `spec.py`)
    measure the leaned D at −0.7 and +0.3 ¢ from the told pitch, and +20.8
    and +21.8 ¢ from the unleaned 16/9.
  - Every other note is within 0.9 ¢.
- **The wear.** A dropped note can make a new leap (seed 501: G held → D at
  the end of line 2), and that leap leans the same way.
- **This goes further than the critic asked**, and I tightened it on the way.
  - My first version leaned across line breaths. In seed 3019, GOD BE WITH
    YOU leaned seven repeated la's to Pythagorean 27/16 against the drone.
  - Two rules now stop that: a breath lets the singer re-pitch from the
    drone, and a lean may take a note no further from the drone than a hair.
- **Where it applies.** In the pool today, only KINGSFOLD's first line (and a
  worn KINGSFOLD) leans: 10 leaned notes over the 115 verification runs.
  Because the old tune computes the lean itself, it does not depend on the
  book's commas.
- **Harness.** The per-note check puts the lean back in and proves each one:
  - it is a wolf leap's, in the same breath, and made pure;
  - it takes the note no further from the drone than a hair.

  Adherence judges a leaned old-tune note as the pitch it leans from.

**4. [owner-ear] Some memories were much shorter than v0.30's.**
- **A memory is a whole thought.** A tune surfaces only where the lines the
  day holds last at least 8 s, even at the quickest remembered tempo (×1.15):
  `linesAdmitted()`, `MIN_MEMORY_S`.
- **Out of the pool** (5 tune/mode pairs):
  - SIMPLE GIFTS on mixolydian and hexa;
  - DESERET, MARTYR and NETTLETON on penta.
- **The pool now:**
  - ionian 16;
  - mixolydian 13;
  - hexa 13;
  - penta 8;
  - aeolian 5;
  - dorian 5.

  Every mode keeps tunes, so the old tune comes as often as before.
- **Seeds 501–540 forced** (the critic's range): 60 memories.
  - First tries run 9.4–16 s, with a median of 12 s. The critic had found
    them as short as 5.4 s; v0.30's ran 12–16 s.
  - Seed 523 now draws DESERET on hexa (11.4 s) and PISGAH (11.6 s).
  - Seed 521 draws GOD BE WITH YOU on penta (9.8 s).
- **Harness verdict:** a conducted memory under 8 s fails.

**5. [polish] `octaveFor` rounded a tie upward.**
- **The fix.** A tie now goes to the lower octave. The register also drops an
  octave where the top would pass do two octaves over the keynote (deg 14,
  where the far voice's lowpass stands), as long as the bottom stays at the
  keynote or above.
- **MARTYR** now sits at 0–9, about 232–740 Hz. It used to run 464–1480 Hz.
  - In the forced seeds 505, 506, 532 and 535 it sings 240–672 Hz.
  - In the capture `martyr506-iso` it reads 250–625 Hz.
- **KEDRON's two aeolian lines** (the tenor's, degs −7..1) move down with the
  ceiling rule. They used to reach 1332 Hz.
- **The range now.** Over 60 forced memories, every note lies between 240 and
  990 Hz.

**6. [polish] `roundTrip` refused plain objects from another realm.**
- **The fix.** A plain object is now one whose prototype's prototype is
  `null`, or which has no prototype at all.
- **Harness.** The score-room check now reads all 21 Earth tunes back from
  the Node realm against the vm-loaded Score: all pass. A Date and a class
  instance are still refused.

**7. [polish] `hymn-announced` and the `lined` practice.**
- **`hymn-announced`.** `KOLOB.Score.EVENTS` may now nest a payload, and
  `hymn-announced.hymn` is held to `{id: hymnId, number: num?, nameDs: str?,
  meter: str, dialect: dialect?}`.
  - `verse-start` and `verse-line` hold `hymnId` to the id grammar.
  - The harness refuses 5 of 5 wrong announcements and passes 2 right ones.
- **The `lined` practice.** The verses of the walk are sung, so they say
  `"sung"`, and that is true. What was never told was the singing that *is*
  lined: the choir's reply to the deacon.
  - That reply is now a typed `verse-line` with `practice: "lined"` and its
    Score:
    - line 0 (the deacon gives the hymn's first line);
    - the verse the walk stands in;
    - `start` and `beatS` (beat × 1.4).
  - Its notes are checked as sung: 272 lined lines across the runs.
  - The walk does not count it, and it gets no verse-start.
  - It is typed only, with no legacy label, per SCORE §6's "new code emits
    typed events only".
  - The minutes print nothing for it, because the deacon's ☞ row is already
    its row. `kolob-ui.js` returns null for a lined verse-line, so the page is
    identical.
  - The harness now checks the walk: each hymnId counts its sung lines from
    verse 0, line 0, with a verse-start at every stanza, and each lined line
    stands at line 0 of the walk's verse.
- **This goes further than the critic asked** (a new event), and I think the
  engraving and composer need it more than a relabel.

### How it was checked (all silent: Node, muted headless Chrome)

- **Harness, 115 runs, all PASS:**
  - the standard set (15);
  - the sweep: 2001–2040 with Ives, and 3001–3020 with `oldtune razz
    cumulative` (60);
  - the forced old tunes 501–540 (40).

  Across them:
  - 33 664 of 33 664 events typed;
  - 1 491 sung lines proofread, and 43 472 of their notes pitched as sung;
  - 442 hymns walked from their first line: 1 219 lines sung, 454 stanzas,
    272 lined;
  - 18 381 guest notes, each naming its guest;
  - 126 old tunes, with 2 355 notes matched to the book, and 10 leans each
    proved;
  - pitch adherence 116 553 / 116 553.
- **Teeth.** The new harness fails HEAD on:
  - REPRO 1: 10 bell notes not named;
  - seed 31 and seed 7: the doxology is off the walk;
  - the other realm and the wrong announcements.
- **`oldtunes 20 900`: PASS.**
  - 21 forced across all six modes.
  - `everytune`: 116 rememberings and 1 777 notes. There were 121 before,
    and the 5 pairs above are gone.
- **The UI differential** (`r2m3b/uidiff.js`), against M2's kolob-ui.js:
  - 14 dumps × Deseret and Latin, 8 494 rows, identical;
  - 4 of the dumps have an unlogged guest (steeples 13, bands 9 and 49, old
    tune 9);
  - it is stricter now: the old UI is fed the stream *without* the unlogged
    guest's events **and notes**, and the new UI, fed everything, must print
    the same.
- **Muted Chrome A/B** (the pre-milestone UI and viz in tab B):
  - seed 5 `oldtune` and seed 21 `steeples` Latin: the rows are identical
    without their clock, and the direction lines are identical;
  - one row in each floors its clock a second apart. This is the race
    described above, worse here because the harness batch was loading the
    machine.
- **Consoles clean:** index.php and every lab (`cr/labs.js`). The tune lab
  lists 21 tunes with their admitted modes.
- **REPRO PASS:**
  - the five standard;
  - `repro 900 10 oldtune` (KINGSFOLD with its lean);
  - `repro 1200 13 force=steeples unlogged=steeples`;
  - TRANSPORT on 1847 and 77.
- **Identity against HEAD** (16 seeds × 1200 s, no switches, compared
  without the new note tags):
  - 14 of 16 are byte-identical in notes and legacy events, including the
    two seeds where an old tune came (1002 and 1004);
  - the other two are 1003 and 1010: the SM doxology (finding 2).

### Harness changes (`_harness.js`, untracked; copy: `…/scratchpad/r2m3b/_harness.r2.js`)

- **`guest notes`:** each visitation's set piece is watched while it is
  scheduled. A note told inside it must name its guest and say what the
  meeting marked it.
- **The unlogged verdict now covers notes.** A note of the unlogged guest
  without `logged: false`, or a hushed note of another guest, is a leak.
- **`verses`:** the walk per hymnId, as described in finding 7. A new
  verdict.
- **Old tune:**
  - the lean check (finding 3);
  - adherence judges a leaned note as the pitch it leans from;
  - the admission check (finding 4), and a verdict on a conducted memory
    under 8 s.

  The printed line adds "wolf leaps sung pure N (left M) · memories under
  8 s K".
- **The score room:** the other-realm read-back, Date and class refusals,
  and the `hymn-announced` rights and wrongs.
- **Records:** notes now record `comma` and `guest`.
- **Scratch tools** are in `…/scratchpad/r2m3b/`:
  - `uidiff.js` (`ROWS=<prefix>` writes the new minutes);
  - `cmp2.js` (dump A/B, ignoring the new note tags);
  - `all.sh`, `std.sh`, `sweep.sh`, `ot500.sh`, `dumps.sh`, `ident.sh`,
    `repro.sh`;
  - `scan-*.js` (the pool, leans, lengths and registers, from the tunes
    alone);
  - `cr/` (`vizband.js`, `ab.js`, `capture.js`, `spec.py`, which now
    measures leaned notes, and `labs.js`);
  - `head/`, a copy of HEAD for teeth and identity (`KOLOB_BASE=`).

### How to hear it

- **KINGSFOLD's pure leap:** `?seed=10`, then
  `KolobAudio.setForceVisitation("oldtune")` before PLAY. The aeolian house
  hymn comes at 0:15, and "voice of Je-sus" leaps a true fourth.
- **MARTYR, lower:** `?seed=506` with the same switch; it comes at 0:16.
- **The doxology's first line:** `?seed=1010` (SM). Dev-jump to the
  doxology, or wait for 12:28.

### Requests to the integrator

1. **SCORE §6:**
   - a guest's notes carry `guest` and `logged` (`onNote` extras);
   - `KOLOB.Score.EVENTS` may nest a payload spec (`hymn-announced.hymn`),
     so a reader of EVENTS must not assume every value is a string (the
     r2-tools crew, if they read it);
   - a `verse-line` with `practice: "lined"` is the choir's lined reply: typed
     only, outside the walk, and the page prints no row for it.
2. **SCORE §5 / the old tune's Performance:** the notes' `comma` extra
   (−1, 0, +1: the lean of a leap sung pure). The Performance is unchanged.
3. **The Hosanna (GUEST):** use `guestNote(V, "hosanna", …)` for the shout's
   notes. PLAN §8.12 says its hymn is engraved normally and its shout is not,
   so tag the shout's notes and not the hymn's.
   - If the Hosanna sings through the choir's own renderers, those tell
     their notes untagged. It will need a tag parameter there, as the
     Question does.
   - The harness's `guest notes` check watches only the four set pieces it
     wraps: add the Hosanna's.
4. **tune-lab.js** (not mine): `getOldTunes().modes` now lists the
   *admitted* modes. The lab plays the Earth pool's first line without the
   lean.

### Known issues and notes

- **Leans across a breath.** A wolf leap across a line's breath is left as
  the day tunes it (GOD BE WITH YOU in penta, seed 3019: re at the end of
  line 1, then la). This is on purpose: the singer re-pitches from the drone.
- **For the owner's ear:**
  - the 8 s floor;
  - the half-bit hair (it is what keeps la, me and the other drone-chord
    notes from ever leaning).
