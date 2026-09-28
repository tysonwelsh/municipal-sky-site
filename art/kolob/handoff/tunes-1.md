# Handoff — crew T (Earth tunes), milestone 1

Branch `kolob-tunes`. Dev and lab work only, so no VERSION bump. Nothing in
`kolob-audio.js` was touched.

> **Round 2 (at the end of this note) supersedes milestone 1** wherever they
> disagree. In particular, BETHANY and GOD BE WITH YOU now have all four
> parts, SIMPLE GIFTS is complete, and the lab's organ has been rebuilt.

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

---

## Round 2: the critic's findings, fixed

This round merged `kolob-2` first. `handoff-second-look.md` has no section
for this track (it covers split, question and engraving), so the critic's
16 findings were the whole list. Every one is fixed. The two places where I
went beyond what was asked, or chose differently, are under "Judgment calls"
below.

### Proofing the Sacred Harp plates (findings 1–5)

All ten Sacred Harp tunes were proofed against the 1844 plate, every part,
bar by bar, by shape and staff position together. They were rendered at 600
dpi with a pitch ruler drawn at both edges of each staff. Fermatas and
repeat marks were checked on the plate, not taken from the 1991 book.

The critic's four findings were confirmed and fixed:

- **CORONATION tenor** ('of Je-sus' name, Let') is now C–A♭–B♭, B♭, as the
  critic said.
- **THE PROMISED LAND tenor** ('hap-py') is now E. Where the phrase returns
  in the chorus, the plate does print F♯, and that note is kept.
- **WONDROUS LOVE** now has a fermata over 'this!' in all three parts.
- **FOUNDATION/BELLEVUE** now repeats its second strain:
  - The repeat dots sit before the half rest, so the repeat goes back to the
    rest.
  - The tune is written out in 6 lines, 11s.
  - The 'one flat' note is corrected: every BELLEVUE staff has two flats.
    The one-flat signature on p. 72 belongs to THE WEARY SOULS, the tune
    above it.

The proof also found two new places where the 1844 plate differs from the
1991 book. Both are fixed:

- **CORONATION bass:** 'Bring forth the royal' ends on the low B♭2.
- **PISGAH tenor:** in the soft strain's first bar, both times, the last
  quaver is a fa-triangle B♭, not C.

Notes that were already correct:

- HOLY MANNA's fermata on 'down' is plainly printed. Its notes now say so.
- NEW BRITAIN, IDUMEA, KEDRON and BEACH SPRING match the plate, apart from
  the differences already listed in their notes.

Every cross-check note now names each 1991 difference. With
`r3/cmp/cmp.py`, a re-run of the critic's diff against the 1991 MusicXML now
shows only two kinds of difference: the written-out repeats, and the
documented 1844 readings.

### The other transcription findings (6, 7, 14)

**KINGSFOLD.** The alto's upbeat to line 1 is now a minim E. This removes the
spurious i7.

**BETHANY** now has all four parts from Mason 1859, p. 244. Reading them:

- Source: the 2092×3550 leaf, cross-read against the 400 dpi PDF plate, with
  a pitch ruler.
- In each 'Nearer, my God, to thee' line, tenor and bass share the first G.
- Every part slurs with the soprano at 'That raiseth me', over a held D: a
  cadential six-four, then the dominant.

**GOD BE WITH YOU** now has all four parts from Gospel Hymns No. 5, No. 74,
including the men's echoes:

- The tenor and bass rest on each 'Till we' pickup.
- While the women hold 'meet', the men answer 'Till we meet!' in quavers.
- The book prints fermatas on the second held 'meet' and on 'God' in both
  staves. They are in the data.

**SIMPLE GIFTS** is complete, AABB.

- **First strain.**
  - I re-read every letteral stroke of the WRHS page at full size.
  - Two rhythms were wrong: 'just right, 'Twill' is a dotted quaver g plus
    a semiquaver g, and the last bar is d, c–b semiquavers, then a crotchet
    c.
  - Fixed, the strain now agrees note for note with a second manuscript (Mary
    Hazzard's, as transcribed on Wikimedia Commons). The only difference is
    the pickup.
- **Second strain.**
  - The WRHS page stops after 'When true simplicity is'. The last seven
    letters it does show match the Hazzard transcription exactly.
  - From 'gained' on, the notes follow that transcription. It is cited as a
    cross-check, and a caption over those lines says so.
  - No complete facsimile or pre-1929 printing was found. Andrews's *The
    Gift to Be Simple* is 1940, and its renewal status could not be checked.
- **The repeats.** The page's `:||:` repeat signs are written out. The first
  time through, the last c is shortened to a quaver so that the pickup comes
  in on time.

**ALL IS WELL.** `source.tuneName` is now "WINTER QUARTERS", the book's own
name for the tune, and the notes no longer call it an OCR misreading.
`tuneName` is also set for BELLEVUE, HALLELUJAH and "Dancing Song".

### The module (findings 12, 13, 15)

**Cadences.**

- IV, ii or iiø7 → I is **plagal**, so KINGSFOLD's close is now plagal.
- A bare fifth, unison or octave on the final is **openfifth**.
  `chordAt` now names a unison chord as `I8`, with `quality: "unison"`.
- A cadence is read from the last *change* of harmony, not from a repeated
  tonic.
- When the parts are printed but the final sonority is ambiguous, the result
  is never "authentic".
- Chords are now read for two-part NETTLETON as well.

**Tuning (finding 13).** Each onset is re-tuned by comma. For every chord,
each note that begins there may move one syntonic comma (81/80) up or down,
never more. The chosen shift is the one that leaves the fewest sour fifths,
thirds, sixths and comma-unisons, using the fewest moves and no comma jump on
a repeated note.

- Notes already sounding are never re-tuned.
- `monzo` is now the pitch that sounds. `Note.comma` (−1, 0 or +1) records
  the move, which is exactly what `commaOf` or a Johnston mark needs.
- The dev field `Hymn.tuning` counts the effect. Examples:
  - KINGSFOLD: 42 of 82 chords were sour on the fixed degrees; after 48
    comma moves, none are.
  - PISGAH: 32 → 5. The 5 left are passing chords over a held note.
  - ALL IS WELL: 12 → 3.
- Spelling still agrees with pitch within a comma (SCORE §2).
  - I checked 3,605 notes: each `monzo` is within 23¢ of its degree.
  - Chromatic notes are within a semitone of their degree and carry `alt`.

**Contract follow-ups (finding 15).**

- **Mode.** `Hymn.mode` is now the collection that *all* parts need, so
  folding to `COLLECTIONS[mode]` loses nothing. NEW BRITAIN, HOLY MANNA,
  BEACH SPRING and FOUNDATION are `hexa`. The melody's own collection moved
  to the dev field `melodyMode`, where those four are `penta`.
- **Alterations.** `Note.alt` (+1, 0 or −1, against the key) marks chromatic
  notes.
- **Meter.** Meter strings are canonical, with the grammar in the module
  header. Examples: `CMR`, `98.89R`, `11s`, `irregular`. The dev field
  `lineSyllables` carries the per-line counts.

### The lab (findings 8–11, 16)

**Fermatas** (finding 8). The double count is gone.

- Measured in the lossless capture: 150–350 ms after 'But', the held D♭5
  from 'fear' is at 0.0002, against 0.10 for the new C5.
- The earlier smear was a minor second at equal level.

**Performance** (finding 9). The organ was rebuilt:

- Each note is one oscillator (a PeriodicWave principal) plus one gain, with
  a shared filter and pan per part.
- Notes are handed to `PJ2.Clock` 0.3 s ahead. `pj2-clock.js` is now loaded
  from the substrate, read-only.
- Each note's two nodes disconnect `onended`.
- PISGAH with all parts:
  - 19.97 s of audio clock in 20.01 s of wall clock, even with the machine at
    load average ~40.
  - It peaked at 16 live voices (32 note nodes). The old organ built about
    3,800 nodes up front.

**Stop click** (finding 10).

- STOP fades a per-play session gain over 25 ms. In the capture the signal
  goes 0.17 → 0.0005 in 24 ms, where before it dropped in 2 ms.
- The master gain is never automated, so no restore can be lost.
- Voices that were scheduled but never started are dropped immediately.

**Rests** (finding 11).

- Rests are now split at barlines.
- A full bar of silence is one centred whole-bar rest.
- Anything shorter uses the largest plain rest values that fit.

**Legato** (finding 16).

- Each note's release runs under the next note.
- A repeated pitch is lifted 45 ms early.
- Ties sound once.
- Measured: no exact-zero runs longer than 1 sample while playing.

**New in the lab:**

- a **fixed degrees** checkbox, to hear what the commas fix;
- `+`/`−` comma marks beside heads;
- a "Just intonation" line on each card;
- italic captions on lines whose notes come from somewhere other than the
  cited page (SIMPLE GIFTS' second strain, GOD BE WITH YOU's echoes);
- "printed as WINTER QUARTERS", and the like, in the source line;
- semiquaver spacing widened;
- the time signature moved clear of four-flat key signatures.

### How I checked it

- **Module.** `node` loads it with `problems: []`. A field-and-pitch check
  over all 16 tunes (3,605 notes) found 0 problems, and every tune
  round-trips through JSON.
- **Lab.** Headless Chrome with `--mute-audio`, on :9402, serving :8102:
  - All 16 cards and 146 row SVGs render, with no JS errors.
  - There is no page overflow at 900 px or at 390 px.
  - These controls were clicked and work: play, v0.30, v0.30 → new, show
    v0.30, melody only, fixed degrees, stop, and toggle-stop.
- **Captures.** Lossless AudioWorklet captures of ALL IS WELL (the fermata,
  gap and stop checks) and of PISGAH (real time).
- **Scratch.** Scripts, images and captures are in
  `/private/tmp/claude-501/kolob-tunes/r3/`:
  - `strip.py` and `ruler.py` draw the pitch rulers;
  - `rul/` holds every proof image;
  - `t/rec.js` and `t/an.py` are the capture and its analysis;
  - `cmp/` holds the 1991 diff.

### How to hear and see it

```
php -S 127.0.0.1:8102 -t <worktree>
open http://127.0.0.1:8102/art/kolob/earth-tunes-lab.php
```

There are no seeds.

- To hear the new tunes, play GOD BE WITH YOU's refrain (the echoes),
  BETHANY, and SIMPLE GIFTS' second strain.
- To hear the commas, play KINGSFOLD, then tick "fixed degrees" and play it
  again.

### Judgment calls

- **Finding 13.** I implemented the comma tuning in the module rather than
  only noting it.
  - I did this because the tunes are fixed data and the chords are known
    here.
  - If the harmony crew would rather tune at performance time, it can ignore
    `comma` and subtract it back out:
    `monzo − comma·[−4, 4, −1, 0]` is the plain degree.
- **Minor-key subtonic VII → i** is classed as "authentic", as the modal
  dominant. Otherwise every Aeolian shape-note close would count toward the
  plagal share, which the plan wants near zero for Sacred Harp. Most of those
  closes are open fifths anyway, and are classed as openfifth.
- **SIMPLE GIFTS' second strain** rests on a modern transcription, not a
  facsimile. This is the one exception to "every note from a facsimile". It
  is flagged in the tune's notes, in its cross-check, and on the engraving.

### Requests to the integrator (in addition to milestone 1's)

1. **Bless these in SCORE §5:**
   - `Note.alt` and `Note.comma`;
   - `Line.devNote` (dev);
   - `Hymn.melodyMode`, `Hymn.lineSyllables` and `Hymn.tuning` (dev);
   - `source.tuneName`;
   - the meter grammar in the kolob-tunes.js header. Or give me the
     vocabulary you want, and I will map to it.
2. **State in SCORE §2 that an Earth tune's `monzo` is already
   comma-adjusted.** A performer should play it as written and not re-fold it
   to COLLECTIONS.
3. **Load order.** `earth-tunes-lab.php` now loads
   `../prosperos-jukebox-v2/pj2-clock.js` before `kolob-tunes.js`. This
   matches SCORE §1.

### Known issues

- **Not re-proofed in round 2.** NETTLETON (Missouri Harmony), KINGSFOLD
  and ALL IS WELL got only their flagged fixes.
- **Sour chords left.** ALL IS WELL has 3 and PISGAH 5, all passing
  dissonances over a held note, which the tuner by design never moves.
- **SIMPLE GIFTS' second strain** should be replaced if a facsimile of a
  complete Shaker manuscript turns up.
- **The engraving** still uses round notes, letter clefs, and the treble clef
  for CORONATION's C-clef alto. Ties across a line break are not drawn.
