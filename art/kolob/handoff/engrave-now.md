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

---

# Kolob v0.32 — a cleaner page, and it keeps time

*Branch `kolob-engrave`, on top of v0.31 (`c54aca0`). 2026-09-27.*

This section supersedes parts of the v0.31 description above. There is no gilt strike, no 8va, no captions, no tape ribbon and no spreading bell rings any more; see "The owner's changes".

It does two things:

- It fixes what the independent review found in the v0.31 engraving. The review is the section "## engraving" in `art/kolob/handoff-second-look.md`, in the `kolob2` worktree.
- It folds in four binding changes the owner asked for after seeing v0.31 live.

The wheel and the organ facade are untouched. The owner's rules still hold: 60 px/s, no red or rubrics, no words, no decoded word on the telegraph, no drone on the page, and the telegraph centred in a normal grand-staff gap.

## The owner's changes (binding)

1. **One ink.**
   - Notes are hymnbook green from the moment they sound.
   - There is no gilt strike, no gold-to-green cooling, and no glow under a sounding note.
   - The band's round notes and barlines are green too (they were brass).
   - The Question's cartouche and its "?" are green.
   - Only the drying fades the ink.
2. **Just the notes.** Removed:
   - the 8va, 8vb and 15ma signs, both the figure and the dashed line;
   - the captions ("clarinet, asking", "asking again", "harmonium", "Band — not one of ours" and "no answer");
   - the band's 2/4.

   I also removed the gilt ⁂ that marked a fuging entry. It was a text glyph printed over the staff, so it falls under "anything similar". It is easy to restore in green if it is wanted.

   A note uses real ledger lines as far as the plate allows. That is two ledgers above the treble (q24) and two below the bass (q−4), at both 860 and 390 px. Beyond that it folds silently by octaves until it fits (`foldFor`). The Question's asking folds as one phrase, so it keeps its shape.

   The Question keeps its double-ruled cartouche and "?". The frame could also go if the owner wants: it is one block in `drawQuestions`. The empty measure's dotted barlines stay, because they are notation, not text.
3. **The telegraph is punched straight into the paper.**
   - A dit is a round hole and a dah is a slot. Each shows the plate beneath, with the same inner shadow under its upper lip.
   - They run along the middle of the gap, with no ribbon, edge, background or feed track, and no decoded word.
   - A hole is punched at the engraving point when its key lifts, then travels with the page. So the message is laid out at the page's own 60 px/s: a Morse unit is 4.2 px, and a hole is about 3.8 px across.
   - The ribbon used to be fed out faster than the page, which was a second motion. That is gone.
   - No hole is punched where a note head, ledger, stem, dot or bell ring holds the gap (`KO` clearances, `koCovers`). Each hole dries from the moment it was punched.
4. **Nothing moves but the scroll and the drying.**
   - The bells' spreading, fading rings are gone. A bell is a ringed head, one thin green ring drawn with the head, and it dries like every note.
   - The strike glow is gone with the gilt.

## The review's findings

1. **[major] Tab hidden (or any re-anchor) replayed ink late.** Fixed with one time base.
   - Every engraved item now carries the **audio** time it sounds at. PT is the audio clock as the page reads it: smoothed with a 0.25 s time constant, never more than 0.1 s ahead of the sound, and snapping to the present when it is more than 0.5 s off.
   - x and the drying are worked out from PT at draw time. `toPage` and `PT_OFF` are gone.
   - The clock takes the real frame time, uncapped. After a hidden spell the first frame lands exactly on the present, and all the ink moves at once. The wheel still gets the capped dt.
   - DRY advances with PT, so the drying catches up too. An item first drawn late is credited its age.
2. **[minor] STOP kept printing notes that no longer sound.**
   - `silence(cut)` runs on the "■" transport event, at its exact audio time. The conductor's transition to stopped is a fallback.
   - It lifts everything scheduled after the stop: groups, band notes and visits, the Question's askings and empty measure, and telegraph holes. It cuts what was sounding to the voices' 0.6 s fade.
   - PAUSE is unchanged: it holds pixel-still and resumes in place.
3. **[minor] `dryA()` NaN.** `dryA` anchors at `tp`, or at `tp0` for spans, so these now dry like everything else:
   - the cartouche;
   - the empty measure;
   - the band's visit.

   The band's barlines each dry from their own onset.
4. **[minor] Telegraph against alto/tenor ledger heads.** The tape itself is gone (owner's change 3). The holes are never punched where a head, ledger or stem holds the gap, and the telegraph stays centred.
5. **[minor] Ottava line through unfolded ledger notes, and 15ma for three- or four-octave folds.** Both are moot: the signs are gone (owner's change 2), and folding is silent, to the plate's ledger room.
6. **[minor] Fuging entries printed as one whole note.**
   - `kolob-audio.js` `fugingEntry` now emits each head note it sings (freq, start, length) in place of the single whole-entry emit. The loop draws no dice and changes no timing.
   - The page prints each voice's head in shapes, stems and dots.
7. **[minor] Two voices at one x shared a column.**
   - `takeLayer` sets two lengths at once on one staff the way a hymnal sets two voices: the lower first with its stem down, the upper with its stem up. v0.31 went by duration order.
   - At draw time `placeColumn` places each group once, the first time it is drawn. If its ink would run into a group already placed close by on the same staff (a stem through a head, heads, dots, ledgers or bell rings touching), it is set to the right, clear of that ink, as a second voice.
   - The offset is kept, and worked out again on a resize. This covers a clarinet doubling the choir 0.1 s later, harmonium under clarinet, the E4-dotted-half-under-G4-whole case, and the fuging voices.
8. **Polish.**
   - Done:
     - `devicePixelRatio` cap raised to 3.
     - `rrect()` falls back to `arcTo` where `roundRect` is missing.
     - `paintLayer` runs its drawing in `try/finally`, so one bad frame can't leave the plate clipped.
     - The stale geometry comment in `kolob.css` is corrected (numbers measured in the browser).
   - **Mixolydian solmization is unchanged, on purpose.** Shape-note rudiments fix the key note as fa (major) or la (minor): a tune's last bass note is its key, and it is always fa or la. So a mixolydian tune is a major tune whose lowered seventh keeps the mi shape (with an accidental). That is the same practice the review accepts for dorian's raised sixth staying fa. The review's `sol la mi fa sol la fa` would put the key note on sol, which the rudiments never do. A comment in `SHAPES` now says why.
   - The phone's "4.8 s visible" note is unchanged (60 px/s is the owner's rate).
   - Not done: `noteQ` still reads the 300 ms-polled `cond.f0`/`mode`, not the note's own tuning (listed in the review, not in this brief).

## Engine change (view-only) and proof that the music is unchanged

- `fugingEntry`: `emitNote("choir", notes[0].f, at, tot)` became a loop that emits each head note at its start (`at + Σ previous lengths`) with its length. That is exactly how `choirVoiceLine` walks it.
- The A/B used `harness-dump.js`, the full note and event stream on the virtual clock. It compared v0.31 (`c54aca0`) with v0.32 over 1500 s, for seeds 1847, 7, 2026 and 99 with the Ives switch on, and 1847 and 314 without it. Results:
  - **event streams byte-identical** in all six runs;
  - **every non-fuging note byte-identical** in all six;
  - each of the 37 old entry emits is replaced by its head notes: same start, same first pitch, contiguous, lengths summing to the old total (169 head notes in all).
- `node _harness.js 600 1847` and `node _harness.js 900 2026 ives` both PASS.
- The minutes' phrase rows are unchanged. The first head note starts where the old emit did, and the phrase's end is the same.

## Verification (muted headless Chrome, CDP; `--mute-audio` on every launch)

The runs were driven by `run.js`, `lab.js` and `cdp.js`. Screenshots and data are in
`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/v032/shots/`.
The v0.31 comparisons ran against a `git archive` of `c54aca0`, served on its own port.

- **Tab hidden (finding 1).**
  - The test used a real background tab: a second tab brought to the front over CDP, so `visibilityState` is "hidden" and rAF pauses. It ran seed 1847 with the Ives switch on, in the hymn, hidden for 45 s across the band's arrival.
  - **Page clock, final build** (a temporary debug trace, since removed):
    - the first frame back (dt 45.13 s) lands exactly on the audio clock;
    - all 125 later frames stay within −0.010 to +0.100 s of it, bounded by the 0.1 s lead clamp.
  - **Where the struck ink was.** This was measured on this branch before the owner's green-ink change; the clock code is unchanged since. The probe required every struck-gilt pixel to sit at the head of a note sounding at that audio time.
    - Before hiding: 0 % unexplained in both builds.
    - After return, v0.31: 57.0 % of the struck ink was unexplained, in 89 of 118 probes, through all 41 s probed.
    - After return, v0.32: 0.2 %, in two probes. Both were a chord's antialiased edge over its own fading glow, 0.2–0.3 s after it ended.
  - **Screenshots, final build:** `hide-old-w-092.png` (v0.31) against `hide-new-w-092.png` (v0.32), both 7 s after return.
    - In v0.31 the band has already passed on but is still crossing the page, struck gilt, with the hymn's chords replayed late.
    - In v0.32 the page shows the present.

    The gilt-era pair is `hide-old-082.png` / `hide-new-082.png`.
- **STOP (finding 2).** STOP was pressed mid-verse, with 39 engraved notes already scheduled (the latest starting 31 s later).
  - v0.31 printed fresh ink at the engraving point 3.1, 5.3, 7.4 and 9.6 s after STOP, exactly at the choir's scheduled onsets, on a silent page.
  - v0.32 (final build) printed nothing after the note that was sounding at STOP.
  - Gilt era: v0.31's last strike came 15.1 s after STOP (it was still striking when the window closed); v0.32's came 0.4 s after.
  - Screenshots: `tr-old-z-030.png` / `tr-new-z-030.png`, 6 s after STOP.
  - A lab STOP during a long telegraph message cuts the message where the key fell silent.
- **PAUSE and PLAY.**
  - The plate hash is identical 3 s apart while held (both builds), and the page resumes in place.
  - PLAY after STOP starts on a clean page.
- **Resize.** 860 → 390 @3× → 1280 → 860 @1× → 390 @3× → 860 re-measures and re-folds, with 0 errors.
- **Lab** (`kolob-viz.js` driven by a fake engine; shots `labt*`, `labo*`, `labv*`, `labq*`, `labrr*`):
  - The telegraph among alto A3/B3 and tenor D4–F4 ledger notes, at 860 and 390 @3×: no hole under a head, ledger or stem.
  - The Question's frame, the empty measure and the band's barlines in the sacrament: v0.31 kept them at full ink (pure `C_INK`); v0.32 dries them below the staff lines' 0.52.
  - Silent folds of C7 and D7 bells and of a B7 clarinet.
  - Two voices at one x: the E4 dotted half under a G4 whole, a clarinet doubling 0.1 s later, and harmonium with clarinet.
  - `roundRect` deleted from the canvas prototype: v0.31 throws "c.roundRect is not a function" every frame (162 times in 3 s); v0.32 draws the cartouche through `arcTo`, with 0 errors.
- **Console.** There were zero errors in every v0.32 run, at 860 and at 390 @3×: hymn, Question, band, telegraph, bells, resize, 4× throttle, hidden tab and stop/pause. The only entry was my own probe's `getImageData` readback warning.
- **Performance.**
  - At 390 px @3× with 4× CPU throttling, in the same session: v0.32 takes 0.93 ms mean script per frame (p99 1.9); v0.31 takes 1.18 ms (p99 3.1), and that is at v0.31's own DPR-2 cap.
  - At 860 px: 0.4–0.7 ms mean, p99 ≤ 1.4.
  - Headless Chrome ran both builds at a steady 30 fps under 4× throttling in that session. Earlier the same day both held 60 fps, so the rate is the environment, not the page.
- **Screenshots of the final page** (normal, Question, band, telegraph, bell):
  - 860 px: `n860-042.png` (hymn), `n860-057.png` (telegraph), `n860-081.png` (bells), `q860-027.png` (Question), `b860-055.png` (band);
  - 390 px @3×: `n390-045.png`, `n390-057.png`, `n390-078.png`, `q390-024.png`, `b390-055.png`.

## Observations for the owner (not changed here)

- **STOP then PLAY within about 30 s re-sounds the old meeting's scheduled voices.** STOP fades the voices' bus to zero, but it does not cancel oscillators already scheduled; choir lines run up to about 36 s ahead. `play()` reopens the bus, so those old lines sound under the new meeting's prelude. The page does not print them (they were lifted at STOP).

  This predates v0.31 and is in the engine. A fix would stop or disconnect scheduled sources on STOP. It was not made here because it changes what is heard.
- The page no longer shows *which* notes are sounding: that was the gilt strike, now removed. The engraving point at the right of the page is where each note appears as it sounds.
- The band's round notes lie on their own layer under the ward's ink. So a band note and a ward note can touch at one x; the column check only sets the ward's own voices aside. They are told apart by head shape (round against shapes) and by the band's fainter ink.
- The reviewer's scratch tools are still useful for the Score rounds. In addition to them, this round's are in the scratch directory above: `run.js` (with a real background-tab hide and several pixel probes), `lab/lab.html` (with `?old` and `&norr` switches), `analyze-*.js`, and `ab/compare.js` for the engine A/B.

## Files changed

- `art/kolob/kolob-viz.js`: the page (everything above).
- `art/kolob/kolob-audio.js`: the fuging entry's per-note emits (view-only).
- `art/kolob/kolob.css`: the geometry comment only.
- `art/kolob/VERSION`: v0.32.
- `art/kolob/handoff/engrave-now.md`: this section.

`index.php`'s fingerprint list already covers every changed asset (`kolob-audio.js`, `kolob-viz.js`, `kolob.css`, plus `index.php` itself), and it reads `VERSION` for the footer.
