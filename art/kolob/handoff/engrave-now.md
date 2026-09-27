# Kolob v0.31 — the page is engraved (Direction A, now)

*Branch `kolob-engrave`, from `main` at v0.30. 2026-09-26.*

This ships the owner's chosen staff engraving, **Direction A, "The Colony
Tunebook"** (`PLAN-ENGRAVING.md`, the owner's decision at the top), inside
the current Kolob engine. It is ahead of the Score (Kolob 2), so the
engraving does everything the engine's note stream allows now and leaves
the rest to the Score. The wheel and the organ facade (`drawWheel`,
`drawFacade`) are untouched.

## What shipped

All of it is in `kolob-viz.js` (the page section, from "pitch → staff
position" through `frame`), apart from the small changes listed at the end.

- **The owner's settings.**
  - The page turns at **60 px/s** (it was 11).
  - There are no rubrics and no vermilion anywhere: directions, captions and
    the Question's cartouche are in green and gilt.
  - There are no words between the staves.
  - The staves stand a normal grand-staff gap apart (5 sp). Middle C keeps
    its ledger in the gap, and the telegraph tape is centred in it.
  - Nothing engraves the drone.
- **The finished engraving**, drawn with A's code:
  - A's four shape-note heads per mode (today's `SHAPES`).
  - Stems grow from each glyph's own anchor point, and their direction
    follows the staff's middle line.
  - Open and filled heads, flags (8ths and 16ths) and augmentation dots all
    come from the note's length.
  - Broad-nib contrast on the open heads, and a letterpress impression and
    a hair of ink spread on every head.
  - Every head is pre-rendered once per size and colour at devicePixelRatio
    (the sprite atlas). Lines are snapped to device pixels.
  - The sounding note is struck gilt with a soft glow, then cools to
    hymnbook green over 1.5 s.
  - The ink dries at about 3 %/s of page time, 31× faster in the sacrament
    and 6× faster in the postlude. It fades out before it reaches the clefs.
- **Durations.** The engine emits a line's notes in one call, so the page
  takes each call in as a batch. For each batch it estimates the beat: the
  length between 0.75 and 1.65 s that turns the batch's lengths into the
  simplest values, with a gentle pull toward 1.15 s. Batches of one or two
  notes use that layer's last beat. So a hymn line reads in quarters,
  halves and dots, and the Question's clarinet reads as dotted quarter,
  quarter, quarter, quarter, dotted half.
- **Layers.**
  - The choir is full-size.
  - A chord of three or more choir notes is stacked in closed score: the
    upper half on the treble with stems up, the lower half on the bass with
    stems down. Heads of equal length share a stem, and unisons share a
    head. This is sensible stacking only; real SATB part identity waits for
    the Score.
  - The clarinet is cue-size (0.75).
  - The harmonium is grace-size (0.6).
  - Bells are ringed heads: gilt rings spread and fade as the bell decays.
  - Long strings print as breves, and other long notes as whole notes.
  - The bagpipe is full-size.
- **The plate is clipped.**
  - Nothing prints above the wheel's horizon rule or into the console.
  - A note beyond the ledger room folds an octave (or two) in and carries
    **8va / 15ma** (or 8vb below).
  - Close notes of one voice share one sign: the figure, a dashed line and
    a hook.
- **The telegraph** is A's punched paper tape, centred in the gap. It is
  fed out of the engraving point while the message is keyed, then cut and
  carried with the page. Dits are round holes and dahs are slots, with a
  feed track. No decoded word is printed.
- **The Question.** When "? the question" fires:
  - Each run of the clarinet's askings is framed in A's double-ruled gilt
    cartouche, with a "?" at its head and the captions *clarinet, asking*
    and *asking again*.
  - Each asking is set under one 8va.
  - The harmonium's answers print as slashed grace notes, with a
    *harmonium* caption on the first.
  - When "? unanswered" arrives, an empty measure is printed between dotted
    barlines, with *no answer* set in gilt in the gap.
  - It stays robust when events are missing. With no "? the question", the
    notes print plainly. A lone "? unanswered" still draws its measure.
- **The band.** Its notes are now reported (see the engine change below)
  and engraved as round notes in brass ink on their own layer, under the
  ward's ink.
  - The layer scrolls at the band's own rate (1.1 s ÷ its beat, clamped to
    1.6–2.6× the page).
  - The ink follows its approach, crossing and recession.
  - It enters with a faint 2/4 and the caption *Band — not one of ours*.
    Barlines fall every two of its beats.
  - The fife is written an octave under its sound, as a fife part is. The
    oom-pah is written as staccato quarters.
- **The fuging entry** keeps a small gilt ⁂ above the staff.
- **Plate size.** `.kolob-viz-wrap` goes from 220 to 240 px, and from 184 to
  196 px on phones, to hold the grand-staff gap and the ledger room. The
  staff space follows the height (about 10.9 px on desktop, 8.6 px on a
  phone).
- **Robustness.**
  - A `ResizeObserver` re-measures both plates if they are laid out after
    `init`.
  - The wheel is not drawn until its band has a real width. This fixes a
    rare negative-radius exception on the first frame. `drawWheel` itself is
    unchanged.

## Engine and UI changes (tiny, behaviour-neutral)

- `kolob-audio.js` `twoBandsCross`: two `emitNote("band", …)` calls, one per
  fife note and one per oom/pah.
  - They carry `{ part, beat, loud }`, where `loud` comes from a small
    deterministic `nearness(at)` that mirrors the bus gain's
    approach/cross/recede.
  - They draw no dice and change no timing.
  - `node art/kolob/_harness.js 600 1847` still passes.
- `kolob-ui.js`: `band` added to `PHRASE_SKIP`, so the minutes do not gain
  a new "band" phrase row. The visitation events already log the band.
- `index.php`: EB Garamond italic 500 added to the font request. The asset
  fingerprint list already covers every changed file (`kolob-audio.js`,
  `kolob-ui.js`, `kolob-viz.js`, `kolob.css`, `index.php`).
- `VERSION`: `v0.31 — the page is engraved: …`. The line now carries a
  summary, as the brief asked, where earlier lines were the bare number.

## Deferred to the Score (Kolob 2)

These need the Score:

- barlines and measures for the hymns, time signatures and the hymn running
  head;
- beams, across beats or within them;
- fermatas and the breath comma;
- rests;
- ties;
- Johnston comma signs (− and 7);
- SATB part identity (closed score by part rather than by rank, and the
  melody marked);
- fuging entries lettered by part;
- words.

The harmonium's answers print as one grace note each, because the engine
reports only an answer's first pitch.

## How to see it

- Serve with
  `php -S 127.0.0.1:8106 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-engrave`
  and open http://127.0.0.1:8106/art/kolob/, then press PLAY.
- A guest is guaranteed each meeting when the 𐐌𐐚𐐞 switch in the colophon is
  on (`localStorage.kolobIves = "1"`). The question or the band fires in its
  drawn section; `KolobAudio.skipToSection()` gets there faster.
- The reference is
  http://127.0.0.1:8106/art/kolob/mockups/engraving-a-tunebook.html
  (mockups are not committed).

## Screenshots (muted headless Chrome, not committed)

They are in `/private/tmp/claude-501/kolob-engrave/shots/`.

- **Before (v0.30):**
  - `before-860-hymn-040.png`
  - `before-390-hymn-040.png`
- **After, 860 px:**
  - `final-860-hymn-020.png` (hymn, closed score, gilt strike)
  - `final-860-question-029.png` (a cartouche and the harmonium's answer)
  - `final-860-question-091.png` (no answer)
  - `final-860-band-055.png` (the band crossing the hymn, with the tape)
- **After, 390 px:**
  - `final-390-hymn-020.png`
  - `final-390-question-064.png`
  - `final-390-band-048.png`

The whole runs are `final-*-{hymn,question,band}-NNN.png`, where NNN is the
number of seconds since PLAY.

## Performance

The page is re-engraved from data each frame: sprites, snapped rects, and
three layer composites.

- Headless Chrome at 4× CPU throttling held 60 fps at 860 px and at least
  54 fps at 390 px, with about 40–46 ms/s of script time (roughly 0.7 ms a
  frame).
- Pausing holds the page pixel-still, and it resumes where it stopped.
- Every run finished with zero console errors.
