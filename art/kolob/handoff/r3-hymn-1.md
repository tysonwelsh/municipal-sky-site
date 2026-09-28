# r3-hymn-1: the hymn composer, first milestone

*HYMN crew, round 3. Branch `kolob-r3-hymn`. 2026-09-27.*

**What is new to hear:** for the first time, Kolob writes real hymns. Before
this, a "hymn" was a motif poured into a meter. Now a hymn has lines,
cadences, a planned high point and a composer of its own. The hymns come in
three of the six harmonic styles:

- **C · the Tabernacle:** the Latter-day Saint hymnal's voice.
- **A · the Sacred Harp:** the tune in the tenor, open fifths.
- **F · the Old Way:** lined out, slow and ornamented.

This milestone is a **lab only**. The meeting does not sing these hymns yet;
that is the next milestone. Nothing was pushed or published, and VERSION is
not bumped.

---

## How to hear it (the owner's checkpoint)

1. Serve the worktree: `php -S 127.0.0.1:8123 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-hymn`
2. Open **http://127.0.0.1:8123/art/kolob/hymn-lab.php**
3. Choose a dialect and press **Compose**, then **▶ Play**. **Compose another**
   writes the next seed.

A link can carry the settings: `hymn-lab.php?seed=4&dialect=tabernacle`
(also `mode=`, `meter=`, `hymnist=`, and `play`).

**Ten to try** (seed, dialect; the mode left on "any" unless it says):

| seed | dialect | what it is | listen for |
|---|---|---|---|
| 4 | Tabernacle | BETHEL, Common Meter, by Lovina Fife | the organ gives out the last line; a secondary dominant (V/V), the diminished seventh on the approach, the cadential six-four; then the *A-men* |
| 5 | Tabernacle | MANTI, CM, by Emmeline Vail | two 4–3 suspensions at the closes (an inner voice holds, then settles); V7/IV and V/vi colour |
| 8 | Tabernacle | COTTONWOOD, 8.7.8.7 in 3/4, by Thankful Beeson | a waltz-time Victorian hymn; three suspensions |
| 1 | Tabernacle | NAUVOO, Common Meter Double in 2/2, by Emmeline Vail | a long, stately tune in minims; eight cadences, only two of them full closes |
| 3, mode **aeolian** | Tabernacle | MORONI, 8.7.8.7 in 3/4 | a minor Tabernacle hymn: raised leading tone at the closes, one diminished seventh |
| 4 | Sacred Harp | SABBATH SPRING, CM, aeolian, by Ammon Stroud | the tune in the tenor; the first verse sung *on the notes* (fa, sol, la, mi); bare fifths at the line ends |
| 7 | Sacred Harp | WINTER QUARTERS, CM, aeolian, 2/2, by Abner Hale | the singing-school master: a minor tune that leaps; hollow endings |
| 8 | Sacred Harp | NAUVOO, Short Meter, dorian, 3/2, by Abner Hale | the slow triple "mode of time"; dorian with no raised seventh |
| 2 | Old Way | SEGO, CM, aeolian, 3/2, by Zina Carrow | the precentor lines out each line; the ward answers very slowly, each singer ornamenting at the marked places |
| 4 | Old Way | EVENING, CM, pentatonic, by Tirzah Quayle | a gapped tune from the far wards; untick "lined out" to hear the ward alone |

### What to listen for, in plain words

**Does each one sound like a real hymn in its style?** That is the whole
question. The rest is detail.

- **The Tabernacle**
  - The tune is on top and the organ sits under the ward.
  - Every line ends somewhere definite. A *half close* leaves you leaning;
    the last line comes fully home.
  - Now and then the harmony slips aside (a *deceptive* close), or leans on
    a chord borrowed from the next key for colour.
  - The highest note should come about two-thirds of the way through the
    hymn, not at the start.
  - After the last verse comes the plagal *A-men*.
- **The Sacred Harp**
  - It is loud, bright and raw.
  - The tenor (the men in the middle, doubled an octave up by some women)
    carries the tune. The treble and the bass are tunes of their own.
  - Listen for bare fifths where you expect a sweet third, and parts moving
    in parallel. Every line ends on a hollow chord.
  - There is no organ and no amen.
- **The Old Way**
  - There is one tune, never harmonized. It is slow enough to lose the
    beat, and every singer decorates it a little differently.
  - The small marks over the staff (∽ a turn, ↗ a slide, ˇ a grace) are the
    places the composer left for them.

**Also worth checking:**

- **Variety:** press "compose another" a few times. No two hymns should
  sound alike.
- **The hymnist:** the hymnist menu changes the writer. Try Abner Hale
  against Orson Tebbs in the Tabernacle. Hale's tunes leap and lean minor;
  Tebbs's are plain and four-square.

### What the page shows

- **The engraving.** Each line is engraved the way the dialect's books print
  it:
  - the Tabernacle in closed score;
  - the Sacred Harp in open score, with the tenor third from the top and
    four head shapes for fa, sol, la, mi;
  - the Old Way on one staff.

  The notes light up as they are sung.
- **The checks it passed** (left).
- **What it measured, against the Earth tunes** (right).
- **How it was planned before any note.** For every line: the cadence, the
  ending figure, the contour and the rhythm cell.
- **The spread.** It composes 24 more hymns and counts whether they all end
  alike.

**One caveat about the notation.** A hymn is engraved on the white keys of
its mode, whatever the day's key: a major hymn in C, an aeolian one on A.
The sound is in the day's key.

---

## What shipped

| commit | what |
|---|---|
| `ea77a86` | `kolob-composer.js`, `kolob-dialects.js`, `kolob-hymnists.js` |
| `92bc47e` | `hymn-lab.php`, `hymn-lab.js` |
| `6e1504d` | the second look (below): voice-leading, the approach diminished seventh, repairs, and the lab's line-by-line scheduling |
| (this) | this note |

### `KOLOB.Composer.compose(stream, opts)` → a Hymn (SCORE §5)

It is **pure**: no audio, no DOM, no `Math.random`, no clock. The caller's
stream is the only die, and every draw is a labelled fork of it.

`opts` = `{ dialect, meter, form, mode, modeOfTime, keyMonzo, hymnist, id, gestures, others }`.
Anything left out is drawn, and every die is thrown whether or not it is
used.

It follows PLAN §4, steps 1–7:

1. **The frame.** Meter (CM, LM, SM, CMD, 8.7.8.7, 8.7.8.7 D, 7.6.7.6 D,
   11s, 10.10 with refrain), form, mode, mode of time and key. Each is drawn
   from the dialect's weights times the hymnist's.
2. **The skeleton, before any note:**
   - the tune's floor and **peak**, placed at 60–75 % of the syllables.
     - The octave comes from the day's key, so the part that sings the tune
       stays in its compass.
     - An ABAC form whose repeated line is where the peak belongs becomes
       ABA′C.
   - every line's **cadence**: kind and target degree, by the line's role
     (opens, arrives, departs, comes home);
   - every line's **ending figure** (mi–re–do, re–do, ti–do, sol↑do, …), its
     **contour** and its **rhythm cell**.

   **These are drawn, not searched.** This is round 1's lesson
   (critic/enrichment-1 §2): best-of-N search converges on one ending.
3. **Rhythm first.** The syllables are poured onto the mode of time:
   - stressed syllables fall on strong beats;
   - a long note ends each line and meets the next line's pickup;
   - a Common Meter eight in 4/4 gets a held "gathering note" rather than a
     tie across the barline.
4. **The melody.** A guided search fills the notes between the fixed ones:
   the ending, the peak, and a varied line's head. It runs 130–180
   candidates per line and scores them on:
   - singability: steps, leaps recovered, no tritone or seventh, no
     see-saw;
   - the contour;
   - home's triad on the strong syllables;
   - A lines against B lines;
   - a little memorability (shared cells, sequences).

   Line one is seeded from the day's theme (the motif engine's gesture);
   the lab passes it.
5. **Harmony.** The dialect's harmonizer, planned backwards from each
   cadence, voice-led, with the non-chord tones added as a second pass.
   After that, the **tuning**:
   - every note is an exact 5-limit ratio;
   - each chord finds the root, within a syntonic comma, that makes it
     just (so ii's re is 10/9);
   - `Note.comma` records the lean;
   - a tune sung alone is tuned so that its fourths and fifths ring pure.
6. **Criticism and repair.** The checks in the table below. A failure
   rewrites the melody or re-harmonizes, for up to five rounds, and the best
   attempt is kept. A repair also steers clear of the Earth tune it
   echoed, across line joins.
7. **A name and a number.** A place-name in Deseret (BETHEL, NAUVOO,
   COTTONWOOD, WINTER QUARTERS …), hand-transliterated on the 1859 chart,
   and a number for the board.

**The Hymn it returns** carries all of SCORE §5. It also carries dev fields:
`nameEn`, `hymnist {id, nameDs, nameEn}`, `report` (the plan, the search,
the checks, the fingerprint and the repairs) and, in the Tabernacle,
`amen`.

**Also exported:** `fingerprint(hymn)` (the one ruler for Earth and colony
tunes), `references()`, `spread(streamOf, n, opts)` and `voiceLeading(hymn)`.

### `KOLOB.Dialects`: the first three dialects (PLAN Phase 2 order)

**C, the Tabernacle**
- **Chords:** a Viterbi search over the vocabulary, with the cadence's
  chords fixed first:
  - I ii iii IV V vi vii°, V7 and ii7;
  - V/V, V7/V, V7/IV and V/vi;
  - the approach diminished seventh (vii°7/V), placed only in the approach
    to the peak or to a cadence's dominant;
  - the cadential six-four;
  - in minor: the raised leading tone, VI, VII and III. Mixolydian gets
    ♭VII.
- **Voices:** a Viterbi search over SATB voicings, by Victorian rules:
  - forbidden: parallel fifths and octaves (measured from a melisma's last
    note), crossing, gaps over an octave, augmented seconds, bass tritones;
  - resolved: the leading tone, the seventh and altered notes;
  - kept: common tones;
  - first inversions for a smoother bass.
- **Then:** 4–3 suspensions at the closes, passing notes in the inner
  voices and bass, and the plagal amen.

**A, the Sacred Harp**
- The tune is in the tenor.
- The bass, the treble and, on about half the tunes, an alto are each
  searched as a line of its own against the parts already written.
- Open intervals are preferred; thirds are welcome but never required;
  parallel fifths are allowed.
- Every part keeps within an octave and a fourth.
- Minor is modal: no raised leading tone.
- Each line's last chord is bare (home's, or the dominant's), and the
  hymn's last chord has no third.
- The chords are read off the lines afterwards (`chordAt`).
- There is no amen.

**F, the Old Way**
- The tune alone.
- The composer marks the singers' ornament places: `Note.ornament` is
  `turn` on long stressed notes, `slide` into leaps, and `grace` before a
  line.
- The profile is narrow, stepwise and slurred, at about 0.4× the tempo.

### `KOLOB.Hymnists`: twelve colony hymnists

Each is a set of weights, never a template. The weights cover meters,
forms, modes of time, modes, compass, where the peak falls, the leap rate,
rhythm cells, a signature ending, and fondness for refrains, colour,
sevenths, suspensions, open fifths, ornament and tempo. Each has a Deseret
name; the English is dev-only.

| hymnist | Deseret | habits |
|---|---|---|
| Thankful Beeson | 𐐛𐐰𐑍𐐿𐑁𐐳𐑊 𐐒𐐨𐑅𐐲𐑌 | Victorian: suspensions and secondary dominants |
| Abner Hale | 𐐈𐐺𐑌𐐲𐑉 𐐐𐐩𐑊 | singing-school master: minor, leaping, bare fifths |
| Zina Carrow | 𐐞𐐨𐑌𐐲 𐐗𐐰𐑉𐐬 | leads the lined hymns: narrow and slow |
| Hosea Lund | 𐐐𐐬𐑆𐐩𐐲 𐐢𐐲𐑌𐐼 | 6/8 and 3/4, dotted figures, refrains |
| Mercy Oakes | 𐐣𐐲𐑉𐑅𐐨 𐐄𐐿𐑅 | fierce minor tenor tunes |
| Orson Tebbs | 𐐃𐑉𐑅𐐲𐑌 𐐓𐐯𐐺𐑆 | plain and four-square |
| Lovina Fife | 𐐢𐐬𐑂𐐴𐑌𐐲 𐐙𐐴𐑁 | lyrical, waltz lilt |
| Ammon Stroud | 𐐈𐑋𐐲𐑌 𐐝𐐻𐑉𐐵𐐼 | camp-meeting: major Sacred Harp, 6/8 |
| Emmeline Vail | 𐐇𐑋𐐲𐑊𐐴𐑌 𐐚𐐩𐑊 | stately minims, a late climax, the diminished seventh |
| Tirzah Quayle | 𐐓𐐮𐑉𐑆𐐲 𐐗𐐶𐐩𐑊 | gapped and pentatonic |
| Nephi Arbogast | 𐐤𐐨𐑁𐐴 𐐂𐑉𐐺𐐬𐑀𐐰𐑅𐐻 | long lines, sequences, refrains |
| Jerusha Welling | 𐐖𐐲𐑉𐐭𐑇𐐲 𐐎𐐯𐑊𐐮𐑍 | short meters, gentle steps |

### `hymn-lab.php` and `hymn-lab.js`

- **The music:** compose, engrave and play, with the checks, the
  measurements, the plan, the spread, and what to listen for.
- **The singers:** the full ward is 32 `VoicesVocal.singer`s, 8 to a part
  (voices-lab demo 2a).
  - **The Sacred Harp** doubles treble and tenor in octaves; with no alto
    part, the altos split between them.
  - **The Old Way:** everyone sings the tune, the men an octave down, each
    with their own ornament appetite. A `VoicesVocal.precentor` lines out
    each line first.
- **The organ:** the Tabernacle's organ is `VoicesOrgan`.
  - It gives out the last line, then doubles the four parts on hymn
    principal (full organ on a third verse).
  - Unaccompanied dialects grey out the organ box.
- **The mix:** everything goes through the voices lab's master chain, with
  the brick-wall limiter (−1.5 dBFS).
- **Scheduling:** each line is handed to the singers and the organ about
  three seconds before it sounds. Scheduling a whole long hymn at once made
  a headless audio clock fall far behind real time.
- **For silent checks:** `window.HymnLab = { compose, play, stop, level, hymn }`.

---

## How it was checked (all silent)

### The acceptance battery (Node)

**216 hymns:** every dialect × all six modes × each dialect's meters × 2
seeds. The meters were 8 for the Tabernacle, 6 for the Sacred Harp and 4
for the Old Way. The modes of time rotated through 4/4, 3/4, 6/8, 2/2 and
3/2, and the key through five.

| result | |
|---|---|
| valid Scores (`kolob-score.js` validates) | 216 of 216 |
| JSON round-trip | 216 of 216 |
| same stream, same hymn | every re-composed hymn identical |
| a hard check still failing after repair | 1 of 216: a Tabernacle hymn in 7.6.7.6 D whose run of 6 intervals with 2 leaps echoes ASSEMBLY (it is flagged in the lab's checks) |

**40 hymns per dialect (seeds 100–139):**

| hard check | result |
|---|---|
| a planned peak | every hymn; mean position 65 % (Tabernacle), 65 % (Sacred Harp), 63 % (Old Way); range 53–81 % |
| cadence plan met | every hymn |
| singable range (≤ 10 steps, an octave and a fourth, per part) | every hymn |
| voice-leading by its dialect | every hymn |
| not boring | every hymn |
| not an Earth tune | every hymn (40 of 40 in each dialect) |

### The Victorian editor's audit (70 Tabernacle hymns)

It found no augmented seconds, no doubled leading tones and no bass
tritones. In minor, 2 inner-voice leaps were wider than a fifth.

**The idioms (40 major-mode hymns):**

| idiom | how much |
|---|---|
| first inversions | 26 % of chords |
| V7 | in every hymn |
| the cadential six-four | 22 of 40 hymns |
| V/V | 14 hymns (V7/V in 4) |
| V7/IV | 5 hymns |
| the approach diminished seventh | 7 hymns |
| 4–3 suspensions | 0.55 per hymn |
| passing notes in the inner voices and bass | 3 per hymn |

### The fingerprints, against the Earth tunes

Each composed figure is the mean of 40 hymns (seeds 100–139). The Earth
figure is the mean of the dialect's reference tunes:

- **Tabernacle:** the 1889 Psalmody tunes plus BETHANY.
- **Sacred Harp:** ten tunes from the 1844 book.
- **Old Way:** the melodies of five plain tunes that are still lined out.

**Tabernacle**

| measure | composed | Earth | tolerance |
|---|---|---|---|
| moves with parallel fifths | 0.0 % | 0.0 % | 0–2 % |
| chords with no third | 3.8 % | 3.2 % | 0–15 % |
| crossing | 0 | 0 | 0 |
| chromatic notes | 1.6 % | 0.7 % | 0–7 % (minor 0–13 %) |
| chords with a seventh | 10.5 % | 10.9 % | 3–40 % |
| melody leaps | 26.8 % | 23.3 % | 8–45 % |
| melisma | 6.2 % | 13.3 % | 0–25 % |
| melody compass (steps) | 7.8 | 7.7 | 5–10 |

**Sacred Harp**

| measure | composed | Earth | tolerance |
|---|---|---|---|
| moves with parallel fifths | 20.1 % | 14.6 % | 3–45 % |
| chords with no third | 48.9 % | 50.7 % | 25–80 % |
| crossing | 6.7 % | 6.3 % | 0–20 % |
| chromatic notes | 0 | 0.1 % | 0–1 % |
| chords with a seventh | 0 | 0.7 % | 0–10 % |
| melody leaps | 34.8 % | 38.2 % | 12–62 % |
| melisma | 10.6 % | 14.6 % | 2–35 % |
| melody compass (steps) | 7.6 | 7.9 | 5–10 |

**The Old Way** (one tune, no harmony)

| measure | composed | Earth | tolerance |
|---|---|---|---|
| melody leaps | 27.8 % | 40.4 % | 5–42 % |
| melisma | 12.8 % | 19.7 % | 5–50 % |
| melody compass (steps) | 6.1 | 8.4 | 4–9 |

**The dialects differ clearly from one another:**
- parallel fifths are 0 against 20 %;
- chords with no third are 4 % against 49 %;
- sevenths are 10.5 % against 0;
- the Old Way has no harmony at all.

**Per hymn, "idiom" is a report, not a gate.** One short hymn can stray
where forty cannot. Across the 40, 0 Tabernacle hymns strayed, 10 Sacred
Harp hymns and 5 Old Way hymns.

### The spread: do the hymns converge?

The endings are drawn before the search, so they cannot collapse.

**How the last line ends:**

| dialect | kinds | commonest | entropy |
|---|---|---|---|
| Tabernacle | 5 | mi–re–do, 43 % | 1.8 bits |
| Sacred Harp | 7 | re–do, 46 % | 2.2 bits |
| Old Way | 5 | re–do, 48 % | 1.7 bits |

**Every line's ending:** 23–33 kinds, the commonest at 14–19 %, 4.0–4.4
bits.

**Everything else:**
- first lines: 33–34 different openings in 40;
- meters: 4–8 kinds;
- forms: 4–8 kinds;
- the top-8 candidates of a search typically differ in 1.5–3.5 notes. This
  is the search's own spread, reported per line in the lab's plan table.

### The hymnists shape what they write (16 Tabernacle hymns each)

| hymnist | leap rate | compass | beat (s) | favourite meters | favourite time | last-line ending |
|---|---|---|---|---|---|---|
| Orson Tebbs | 0.21 | 7.6 | 0.70 | LM, 8.7.8.7 | 4/4 ×10 | re–do 9 |
| Abner Hale | 0.36 | 7.6 | 0.64 | SM, LM, 11s | 4/4, 2/2 | re–do 8 |
| Hosea Lund | 0.28 | 8.3 | 0.50 | 7.6.7.6 D, 8.7.8.7, 10.10R | 6/8 ×5 | mi–re–do 6 |
| Mercy Oakes | 0.36 | 8.2 | 0.61 | 8.7.8.7, LM | 4/4 | mi–re–do 6; 6 of 16 minor |
| Zina Carrow | 0.24 | 7.3 | 0.77 | SM, CM | 4/4, 2/2 | re–do 8 |
| Emmeline Vail | 0.26 | 8.1 | 0.75 | SM, LM | 2/2 ×5 | mi–re–do 8; the most sevenths (16 %) |

**In the Sacred Harp:**
- chords with no third run from 46 % (Beeson) to 56 % (Hale, Stroud);
- the leap rate runs from 0.26 (Tebbs) to 0.45 (Oakes);
- Stroud writes 6/8 and 8.7.8.7 D;
- Hale and Oakes write aeolian; Quayle writes dorian and pentatonic.

### The lab: muted headless Chrome over CDP, at 860 and 390 px

The settings were `--headless=new --mute-audio`, port 9433, the profile
`kolob-hymn-chrome`, and PHP on :8123.

For each of the three dialects, the check composed, played, sampled the
output level and took a screenshot. It then ran "compose another" and the
spread.

- **Console errors:** 0.
- **Horizontal scroll:** none (document width = window width at 390 and at
  860).
- **Output level, RMS through the limiter:**
  - the organ's introduction: about −28 dBFS;
  - the Sacred Harp ward: −15 to −20 dBFS;
  - the precentor and the ward in the Old Way: −19 to −27 dBFS.
- **Timing:** a hymn composes in 20–300 ms (Node). In Chrome it is
  typically under 100 ms.

---

## Requests (for the integrator)

1. **Loading.** When the engine starts singing composed hymns (the next
   milestone), load `kolob-hymnists.js`, `kolob-dialects.js` and
   `kolob-composer.js` in `_engine.php`, after `kolob-harmony.js` (the pure
   composers). Nothing in the engine calls them yet.
2. **SCORE §5, adopt as used:**
   - `Line.plan` (dev), `Line.barStart`, `Line.startBeat`;
   - chord extras: `name`, `inv`, `fn`, `tones` ([class, alt] pairs), `rootAlt`, `dim7`;
   - `Note.alt` and `Note.comma` (as §9.4 has them for the Earth tunes);
   - `Note.ornament` as the Old Way's ornament slots;
   - `Hymn.amen`: a Line, sung after the last verse;
   - `Hymn.hymnist`;
   - `Hymn.report` and `Hymn.nameEn` as dev-only fields.
3. **SCORE §6.** Add `authorDs` to `hymn-announced`'s `hymn` (the hymnist's
   Deseret name). §14 says the event log names the author.
4. **Streams.** `hymn:<n>:<i>` is the stream compose takes. Its forks are
   `dialect`, `hymnist`, `frame`, `skeleton` (`line:<k>` below it),
   `naming:<dialect>`, `tempo`, `harmony` and `harmony:repair:<r>`.
5. **For the CAST crew.** Hand the full ward its hymn a line at a time, as
   the lab's pump does. Thirty-two singers scheduled for a whole verse at
   once built so large a graph that muted headless Chrome's audio clock fell
   far behind real time. Per line, it keeps pace.

## Known issues, and what is not done

- **Not done yet:**
  - dialects B (psalmody), D (gospel) and E (Shaker and Primary), next in
    the Phase 2 order;
  - rounds and the partner hymn (§14.2);
  - drift for unaccompanied hymns (§3.6).
- **No words yet.** The ward sings vowels (`verses: []`); the Sacred Harp's
  first verse is on the notes.
- **The Tabernacle's melisma** is 6 %, against the Psalmody's 13 %: within
  tolerance, but plainer than Careless and Beesley.
- **The Old Way's tunes are narrower and more stepwise** than their
  reference: a compass of 6 steps against 8, and a leap rate of 28 %
  against 40 %.
  - This is deliberate, for singing very slowly with ornaments.
  - Kolob has no Earth transcription of a lined-out hymn as sung, so the
    reference is the plain shape-note melodies.
- **The last-line ending most often chosen** is 43–48 % of hymns (mi–re–do
  or re–do). This is realistic for hymnody and far from collapsed (5–7
  kinds), but it is the most common single thing.
- **The notation** is spelled on the white keys of the mode, not in the
  day's key. The Johnston comma marks (+ and −) show where a note leans a
  comma.
- **Melodic wolf leaps under chord tuning** (a 27/20 fourth after a
  comma-lowered re) are not yet counted or avoided. The Old Way's
  unaccompanied tunes are tuned for pure leaps.
- **Rare check failures** (about 0.5 % after repair) are reported honestly
  in the lab's checks panel. In a meeting, the composer would simply be
  asked again with the next fork.
