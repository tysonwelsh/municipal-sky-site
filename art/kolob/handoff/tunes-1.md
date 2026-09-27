# Handoff — crew T (Earth tunes), milestone 1

Branch `kolob-tunes`. Dev and lab work only, so no VERSION bump. Nothing in
`kolob-audio.js` was touched.

## What shipped

- **`art/kolob/kolob-tunes.js`**: `KOLOB.Tunes = { list, byId(id), old, problems, ratio }`.
  - It is a pure module (no audio, DOM, clock or randomness). It loads under
    Node with `global.window = {}; require(...)`.
  - It holds 16 tunes as SCORE §5 `Hymn`s:
    - `provenance: "earth"`, `keyMonzo [0,0,0,0]`, `verses: []`;
    - exact 5-limit monzos;
    - cadences, and chords read off the parts wherever three or more parts
      are printed.
  - Each tune is written in the source's own spelling:
    - a token string per part (`G4:1 _A4:.5 D5:3^ | … /`), in the book's key
      and clefs;
    - the builder checks every barline, that line starts agree across parts,
      and the syllable counts against the meter.
  - `KOLOB.Tunes.problems` is empty.
- **`art/kolob/earth-tunes-lab.php` + `.js`**: the review bench. Each tune card
  has:
  - the source citation with a link to the facsimile, plus the cross-checks;
  - an SVG engraving of every part the book prints, in the book's key and
    clefs;
  - a JI organ player (all parts or melody only, tempo control, limiter,
    notes light up as they sound);
  - the transcriber's notes.
  - The seven v0.30 tunes also have **v0.30**, **v0.30 → new** and **show v0.30**
    buttons. These use a frozen snapshot of `OLD_TUNES`, played in the same key.
  - The page works at phone width. Wide rows scroll inside the card, never
    the page.

### The seven, re-transcribed

| tune | source | parts |
|---|---|---|
| ALL IS WELL | LDS Psalmody 1889, No. 327 (the scan heads it WINTER QUARTERS) | SATB |
| KINGSFOLD | English Hymnal 1906, No. 574 (Vaughan Williams) | SATB |
| BETHANY | Mason, Sabbath Hymn and Tune Book 1859, p. 244 | melody only |
| FOUNDATION | Sacred Harp 1844, p. 72 (as BELLEVUE, with "How firm a foundation") | treble, tenor, bass |
| NETTLETON | Missouri Harmony 1820, p. 72 (HALLELUJAH; cross-checked with Wyeth 1813/1820, p. 112) | tenor, bass |
| SIMPLE GIFTS | Shaker manuscript, "Dancing Song" (WRHS; facsimile via American Music Preservation) | melody, first strain only |
| GOD BE WITH YOU | Gospel Hymns No. 5 (1888 printing), No. 74 (cross-check: Gospel Bells 1880, No. 50) | melody only |

### Added: nine PD tunes, all from The Sacred Harp, 1844 (B. F. White & E. J. King)

| tune | page | parts |
|---|---|---|
| NEW BRITAIN | 45 | 3 parts |
| IDUMEA | 47 | 3 parts |
| KEDRON | 48 | 3 parts |
| PISGAH | 58 | 4 parts, with a "Second Treble" |
| HOLY MANNA | 59 | 3 parts |
| CORONATION | 63 | 4 parts |
| BEACH SPRING | 81 | 3 parts |
| THE PROMISED LAND | 128 | 3 parts |
| WONDROUS LOVE | 159 | 3 parts |

- Where 1844 has no alto, the later (1911+) alto is left out.
- Every page is linked as `archive.org/details/sacred-harp-1844-ki/page/nN`.

## How I checked it

- **Facsimiles.** Every tune was read from its facsimile, at 400–600 dpi:
  - page by page, bar by bar;
  - with pitch-ruler overlays and a notehead detector, both built for the job;
  - by eye at every doubtful spot.
- **Sacred Harp tunes.** These were also aligned automatically against the
  1991-edition MusicXML on shapenote.net (transposed to the 1844 key).
  - Every detector-vs-transcription mismatch was looked at.
  - Most were detector misreads.
  - The real differences between the 1991 book and the 1844 plate were
    resolved in favour of 1844, and each is noted in its tune:
    - CORONATION's treble, in four places;
    - KEDRON's tenor dots, and its C natural where the 1991 book prints C
      sharp;
    - IDUMEA's divided treble.
- **The builder.** `node` with `global.window = {}` loads the module. All 16
  tunes build with no barline, line-alignment or syllable-count problems.
- **The lab, in headless Chrome over CDP.**
  - It renders all 16 cards: 132 SVG rows and no JS errors.
  - There is no horizontal page scroll at 900 px or at 390 px.
  - Playing KINGSFOLD records through the limiter at peak 0.41 and RMS 0.13
    (no clipping), and the notes light up.
  - v0.30 → new works on BETHANY.
  - Melody-only re-engraves.

## How to hear and see it

```
php -S 127.0.0.1:8102 -t <worktree>
open http://127.0.0.1:8102/art/kolob/earth-tunes-lab.php
```

There are no seeds, because the tunes are fixed data. A tune card's **play**
button plays the whole tune as written out, repeats included. **v0.30 → new**
plays the old incipit, then the new first two lines.

## Requests to the integrator

1. **Wire it in.**
   - Load `kolob-tunes.js` in `index.php` (SCORE §1 step 2) and add it to
     `$kolob_assets`.
   - Replace `OLD_TUNES` with `KOLOB.Tunes.list`. The old-tune guest can take
     `lines[0]`, or a whole line, of the melody part.
   - `KOLOB.Tunes.old` maps v0.30's names to the new ids.
   - The mode law can read `hymn.mode`, which is computed from the melody:
     `penta` and `hexa` when the melody avoids fa and ti.
2. **Contract additions for SCORE §5.** Please bless these fields (the lab uses
   them; engine code can ignore them):
   - `Line.startBeat`: rests between lines are not Notes, so a performer needs
     the line's start;
   - `Line.barStart`;
   - `Note.src` (the written pitch);
   - dev-only `Hymn.nameEn`, `Hymn.notes`, `Hymn.crossCheck`, `Hymn.engrave`.
   - Also allow `source.page` to be a string (`"No. 327"`), because hymnals
     number tunes rather than pages.
3. **Dialects.**
   - KINGSFOLD and BETHANY are marked `tabernacle`, and NETTLETON
     `sacredharp` (it comes from a four-shape two-part book).
   - Change them if the composer wants them elsewhere.
4. **`number`** is the source's page or tune number, as a placeholder. The
   hymn-board numbering belongs to the integrator.

## Known issues and follow-ups

- **Harmony not yet taken down for BETHANY and GOD BE WITH YOU.** Only the
  melody is stored, although both books print four parts.
  - BETHANY's scan is soft in the inner voices.
  - GOD BE WITH YOU's refrain has the men's echoes.
  - Both are straightforward next jobs.
- **SIMPLE GIFTS is incomplete and its rhythm is uncertain.**
  - The only PD facsimile found (a Shaker letteral-notation manuscript) is cut
    off after "When true simplicity is". The second strain is missing.
  - Letteral notation's time strokes had to be interpreted.
  - A complete manuscript, or a pre-1929 printing, would fix both.
- **NETTLETON's bass.** In one place the bass's printed shape (mi) contradicts
  its staff position (sol). I read it as G; see the tune's notes.
- **ALL IS WELL.** The alto rhythm in the chorus follows the soprano where the
  scan shows shared stems, and the scan's OCR mislabels the tune.
- **Not included, but sourced and ready.**
  - "The Spirit of God" appears as ASSEMBLY (12s & 11s, B-flat, SATB) in the
    LDS Psalmody 1889, No. 274, pp. 227–228 of the archive.org scan
    (`latterdaysaintsp1889chur`). The engraving is crisp, so it is a good next
    addition in the pioneer LDS family.
  - "High on the Mountain Top" is No. 192 (DESERET, E. Beesley) in the same
    book.
  - CONSOLATION (SH1844 p. 64) was not done.
- **Chords.** Chords are only computed for three- and four-part tunes. Two-part
  NETTLETON and the melody-only tunes have `chords: []`. Their cadences are
  read from where the melody comes to rest.
- **The lab.**
  - The engraving uses round notes, not shape notes.
  - Its highlight follows the audio clock through a visual-only interval
    timer. All audio is scheduled up front.
