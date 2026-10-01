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

**Every dialect with every meter and mode of time:** 486 hymns. That is 3
dialects × all 9 meters × all 6 modes of time × 3 modes (ionian, aeolian,
pentatonic), with the hymnists taken in turn. It includes the unidiomatic
pairings the menus allow, such as an Old Way hymn in 11s or 6/8.
- 0 invalid or thrown;
- 0 hard checks failing after repair.

(It caught one bug before this note: a short varied line whose head and
ending left no room for the peak. The peak now displaces the head.)

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

---

# Round 2: the critic's twelve findings, fixed

*HYMN crew, round 3, the fixer's pass. Branch `kolob-r3-hymn`, commits
`b89b0c4` (composer and dialects) and `67fa364` (the lab). 2026-09-27.
Nothing pushed or published; VERSION not bumped.*

## What you will hear differently

- **The Tabernacle hymns now come fully home.** Every full close ends with
  the bass on the root: the bass sings *sol–do* under the last chord, and
  *fa–do* under the *A-men*. Before, about half the hymns in the lab's
  other keys ended on a tonic with its third in the bass, which sounds like
  a door left open. BETHEL (seed 4) was one of them.
- **The tune's sevenths fall.** Where the tune sings the seventh of a
  dominant-seventh chord (usually *fa* over V7), it now steps down to *mi*
  or holds into a chord that keeps it. It never rises to *sol* any more.
- **No awkward leaps beside the high note.** The tune no longer jumps a
  seventh or a tritone to or from its peak. MANTI's descending seventh and
  the *fa → mi* tritone in the tenor of SABBATH SPRING and WINTER QUARTERS
  are gone.
- **More kinds of ending.** Tabernacle tunes now come home by *ti–do*
  about as often as by *re–do*. Before, nearly all of them ended *re–do*.
- **The Sacred Harp is a little warmer.** In a major tune, about one inner
  line in three now closes on a full chord with its third, as the 1844 book
  often does. The last chord is still bare.
- **The organ's introduction is louder.** It used to be about 12 dB under
  the singers. It now plays at close to their level, and the staff lights
  up while it plays.
- **The key menu tells the truth.** "Down a fifth" and "down a fourth"
  were swapped. A link can now carry the key (`&key=down5`), and the
  address bar always holds a link that composes the same hymn again.

## Ten to try (this table replaces the one above)

Serve the worktree as before and open
`http://127.0.0.1:8123/art/kolob/hymn-lab.php?seed=<n>&dialect=<d>`. The
names, meters and hymnists are unchanged. Some lines have new notes,
because the peak and the endings are placed more carefully.

| seed | dialect | hymn | listen for |
|---|---|---|---|
| 4 | Tabernacle | BETHEL, CM, Lovina Fife | the organ gives out the last line (the notes light); line 2 turns to the dominant through V/V and settles on V in root position; the diminished seventh on the approach in line 3; the cadential six-four in the last line, V–I with the bass *sol–do*, and the *A-men* (IV–I, bass *fa–do*) |
| 5 | Tabernacle | MANTI, CM, Emmeline Vail | V7/IV twice (a flat seventh leaning to IV), the approach diminished seventh, one 4–3 suspension in the last line; it ends *do–ti–do* |
| 8 | Tabernacle | COTTONWOOD, 8.7.8.7 in 3/4, Thankful Beeson | waltz time; three 4–3 suspensions at the closes; it ends *re–ti–do* |
| 1 | Tabernacle | NAUVOO, CMD in 2/2, Emmeline Vail | long and stately; five suspensions, three V7/IV, two cadential six-fours; ends V7–I |
| 3, mode **aeolian** | Tabernacle | MORONI, 8.7.8.7 in 3/4 | a minor Tabernacle hymn: raised leading tone at the half closes, line 2 turns to the relative major; the last line rises on the unraised seventh, so it closes modally (VII–i), then *A-men* iv–i |
| 1 | Sacred Harp | RIMLIGHT, 11s in 6/8, Ammon Stroud | (new) a major camp-meeting tune; lines 2 and 3 close **full**, with their third, before a bare last chord |
| 4 | Sacred Harp | SABBATH SPRING, CM, aeolian, Ammon Stroud | the tune in the tenor, sung on the notes the first time; bare fifths at the closes |
| 7 | Sacred Harp | WINTER QUARTERS, CM, aeolian, 2/2, Abner Hale | the singing-school master's leaping minor tune; it ends *sol* up to *do*, the shape-note close |
| 2 | Old Way | SEGO, CM, aeolian, 3/2, Zina Carrow | the precentor lines out each line; the ward answers slowly, ornamenting at the 13 marked places |
| 4 | Old Way | EVENING, CM, pentatonic, Tirzah Quayle | a gapped tune; untick "lined out" to hear the ward alone |

**The one question is still the same: does each sound like a real hymn
in its style?** For the Tabernacle especially, listen to the last chord of
each verse and the *A-men*. They should sound finished, the way a hymnal
ending does.

## The twelve findings, one by one

The numbers come from the critic's own measure, rebuilt as a script. Each
run covers the same kind of sample the critic used. "Lab keys" are the four
non-home keys the lab offers.

| # | finding | what changed | before | after |
|---|---|---|---|---|
| 1 | Tabernacle closes and amens on I6 | the final chord of every authentic or plagal close, of a tonicized arrival and of whatever comes home is voiced in root position (hard rule in the voicing search). V and V7 before the last close are held to root position too; an inner authentic close's dominant leans that way. Both chords of the *A-men* are on their roots. New hard check: **"the closes stand on their roots"** | lab keys: 47.5 % end on I6, amen I6 47.5 %, last bass move *sol–do* 15 % | 0 % I6, 0 % amen I6, *sol–do* 98.3 % (240 hymns, seeds 700–759 × lab keys); inverted authentic/plagal closes 0 of 408 |
| 2 | the tune's seventh rises | `planChords` refuses a seventh chord whose seventh is in the tune unless the tune steps down, or holds into a chord that keeps the note (a transition rule). Inner voices: leaving a seventh unresolved costs more (8, was 5), and leaping off it within the same chord costs 4 | 104 of 668 unresolved, 96 in the soprano | 0 of 810 (seeds 700–759 × lab keys); 1 of 602 on seeds 2000–2199 home, in the tenor, none in the soprano |
| 3 | sevenths and tritones beside the peak | the peak goes only where the fixed notes beside it are within a fifth and not a tritone away, and where a note two away can be reached in two leaps. If the line has no such place in the band, a varied line's head gives up notes, and then **the peak line's ending is drawn again** from the endings its cadence allows. Also: a varied line's head gives way when it would run into the ending by a tritone or seventh; an ending figure that itself sings a tritone in that mode is never drawn (e.g. *sol*–*do* on the wrong degrees of aeolian). New hard check: **"singable leaps"** (no tritone, no seventh, nothing past the octave inside a line) | 44 of 450 hymns, 41 at the peak | 0 of 720 (240 per dialect); 0 of 200 on seeds 2000–2199 |
| 4 | the spread counted names, not notes; re–do everywhere | `Composer.sungEnding(h, k)` names the last two or three **sung** notes from the final (a comma marks a note below it: *ti,* is the leading tone under the final). `spread()` and the lab's spread panel now lead with them. The cause is fixed too: the floor comes down to meet the last line's ending when that ending dips below the final (*ti–do*, *la–ti–do*, *sol–do*). A figure that does not fit is **drawn again** from the same table, never replaced by the heaviest. The Tabernacle's last line leans to the leading tone (`homeFigures`) in the major modes | Tabernacle last two notes *re–do* 90 % (2 kinds); last three *mi–re–do* 68 %; Old Way *re–do* 81 % | see "the spread" below |
| 5 | key labels swapped; no `?key=` | labels fixed (2/3 is down a fifth, 3/4 down a fourth); `?key=` takes `up4`, `up5`, `down4`, `down5`, `home`, a ratio (`2/3`) or the monzo; the address bar is rewritten on every compose, so it always reproduces the hymn | — | checked in Chrome: `?key=down5` selects 2/3 and composes in it |
| 6 | the peak's position was never checked | the peak line is chosen for how many of its middle syllables fall inside 60–75 %; an ABAC form turns its repeated line into A′ when that is where the room is; the peak's slot is chosen inside the band. **"a planned peak"** now fails a hymn whose high note is outside 60–75 %, give or take one syllable (one syllable is 2–4 % of a hymn) | 13 of 108 Tabernacle, 4 of 96 Sacred Harp, 7 of 48 Old Way outside; lowest 19 % | none outside the band plus one syllable in 1,622 hymns (the batteries below); range 56–71 % |
| 7 | the cadence mix never compared; Sacred Harp closes too bare | the fingerprint reads each line's close from the notes: `closeThird`, `closeHome`, `closeDom` (in `FP_KEYS`, `references()`, the lab's table and the spread). The Sacred Harp now draws a **full close** (the third kept) for an inner line: 30 % in the major modes, 4 % in minor, less for a hymnist who loves the open fifth. See the note below | 11 % of closes with a third | 23.8 % (major 31.5 %, minor 7.7 %) against the Earth tunes' 24.6 % (major 35 %, minor 9 %) on the same ruler; the last chord is still always bare |
| 8 | range counted in steps | the check counts semitones (≤ 17, an octave and a fourth); the Sacred Harp's part windows are cut to 17 semitones; the tune's floor is never more than 17 semitones under its peak | a Sacred Harp treble of 18 semitones (seed 11061) | 0 parts wider than 17 semitones in 720 hymns |
| 9 | a tonicized arrival on V6 | covered by #1: a tonicized arrival is a full close, so V stands on its root | 5 of 25 inverted | 0 of 92 |
| 10 | direct fifths and octaves, the soprano leaping | the cost is now 12 (it was 1.5), with the parallels' own weight behind it | 18 of 108 hymns | 0 in 440 Tabernacle hymns |
| 11 | the organ's giving-out 12 dB under the ward, and unlit | the organ plays into a bus of its own at +9 dB for the giving-out, which ramps back as the ward stands to sing; the giving-out's notes are marked, so the staff lights | organ alone −29 dBFS, ward −15 to −18; lit 0 | organ alone −19 to −22 dBFS; ward with organ −16 to −23; the Sacred Harp ward −13 to −23; 4 notes lit during the giving-out, at 860 and at 390 |
| 12 | the report could describe a discarded melody | `h.report.lines` is built from the **kept** round: the Score's own line plans and that round's search. `Line.plan` gains `via` (tonicize or relative) and `full` (dev) | — | 0 mismatches between the report and the Score in 1,160 hymns |

### Where I read it differently (and why)

- **#7, how often the 1844 book keeps the third.** I built one ruler for
  both books: the sonority sounding at each line's cadence beat, read from
  the notes. On it, the ten Sacred Harp references keep the third at
  **25 %** of their closes (a mean over the tunes), not 47 %. The major
  ones are at about 35 % and the minor ones at about 9 %. Four of the ten
  do end on a full triad (NEW BRITAIN, PISGAH, HOLY MANNA, CORONATION); the
  critic is right about that.
  - I matched the colony's inner closes to this ruler rather than to 40 %.
  - I kept every **last** chord bare, because PLAN §3.A (the owner's plan)
    says "bare-fifth endings".
  - **Request to the owner:** should a major Sacred Harp tune sometimes
    end on a full chord, as four of the ten Earth tunes do? That is one
    number to change (`reqUpper` in `kolob-dialects.js`).
- **#4, whether re–do is still too common.**
  - **The Old Way** ends *re–do* in 60 % of hymns on seeds 2000–2199. That
    is exactly its references (3 of 5), and it has 5 kinds of ending.
  - **The Tabernacle** in the home key ends *re–do* in 64 % and *ti–do*
    in 31 %; in the lab's other keys it is 40 % and 40 %. In the home key
    the soprano cannot go lower than *ti* under the final, so *la–ti–do*
    and *sol–do* do not fit there. That is realistic for a hymn in C.
  - A hymnist's signature ending still weighs heavily on purpose. Thankful
    Beeson, the Tabernacle's commonest hymnist, loves *mi–re–do*.
- **#1, the 1.7–3.5 % of last bass moves that are not *sol–do*.** These
  are modal closes, on purpose:
  - ♭VII–I in mixolydian;
  - VII–i in minor, when the tune rises on the unraised seventh.
  - Before home, a modal VII only *leans* to root position. With the tune
    on the subtonic over VII's root, the tune and the bass would climb to
    the final in octaves.
  - The final chord is always on its root.
  - In minor, the Tabernacle's last line now leans *away* from that rise
    (`homeFigures.minor`), so most minor hymns close V–i with the raised
    leading tone.
- **#2, what is left.** The one unresolved seventh in 602 is in the tenor
  (V7 repeated, *fa* to *sol*). In round 1 the critic's count also
  included sevenths held as 4–3 suspensions (V7/V into V, the tenor
  holding *do* and then falling to *ti*). Those are resolved, just late,
  and the measure now follows the suspension.

## The spread, counted as sung

"Last two" and "last three" are the hymn's last sung notes, named from the
final. A comma marks a note below the final.

**Seeds 700–759, the four lab keys (240 hymns per dialect):**

| dialect | last two | last three |
|---|---|---|
| Tabernacle | 6 kinds: *ti,–do* 40 %, *re–do* 40 %, *do–do* 11 %, *mi–do* 4 %, *sol,–do* 3 % | 13 kinds; the commonest, *mi–re–do*, is 28 % |
| Sacred Harp | 6 kinds: *re–do* 47 %, *mi–do* 23 %, *ti,–do* 12 %, *sol,–do* 10 %, *do–do* 6 % | 20 kinds; *mi–re–do* 40 % |
| Old Way | 4 kinds: *re–do* 48 %, *ti,–do* 28 %, *do–do* 18 %, *sol,–do* 7 % | 19 kinds; *mi–re–do* 28 % |

**The critic's seeds, 2000–2199 in the home key:**
- **Tabernacle:** *re–do* 64 %, *ti,–do* 31 %; last three *mi–re–do* 43 %
  (it was 90 % and 68 %).
- **Old Way:** *re–do* 60 % (it was 81 %).

**The Earth references:**
- **Tabernacle:** *ti–do* 3 of 7, *re–do* 3, *mi–do* 1.
- **Sacred Harp:** *re–do* 7 of 10.
- **Old Way:** *re–do* 3 of 5.

## The fingerprints now (seeds 100–139, home key)

| measure | Tabernacle | Earth | Sacred Harp | Earth | Old Way | Earth |
|---|---|---|---|---|---|---|
| parallel fifths | 0 % | 0 % | 20.3 % | 14.6 % | — | — |
| chords with no third | 3.8 % | 3.2 % | 46.2 % | 50.7 % | — | — |
| crossing | 0 % | 0 % | 6.4 % | 6.3 % | — | — |
| chromatic | 1.7 % | 0.7 % | 0 % | 0.1 % | 0 % | 0.5 % |
| sevenths | 9.5 % | 10.9 % | 0 % | 0.7 % | — | — |
| melody leaps | 29.1 % | 23.3 % | 34.4 % | 38.2 % | 27.8 % | 40.4 % |
| melisma | 6.2 % | 13.3 % | 10.6 % | 14.6 % | 12.8 % | 19.7 % |
| closes keeping their third | 95.6 % | 98.2 % | 23.8 % | 24.6 % | — | — |
| closes on home's chord | 50.6 % | 53.0 % | 64.0 % | 56.1 % | — | — |
| closes on the dominant | 45.2 % | 29.2 % | 36.0 % | 28.1 % | — | — |
| melody compass (steps) | 8.0 | 7.7 | 7.5 | 7.9 | 6.3 | 8.4 |

The Tabernacle's other idioms are unchanged in kind (40 hymns):
- first inversions: 25.4 % of chords;
- V7 in 37 of 40 hymns (the seventh rule takes a few away);
- the cadential six-four in 21 hymns;
- V/V in 14;
- the approach diminished seventh in 10;
- V7/IV in 8;
- 4–3 suspensions: 0.57 per hymn.

## How it was checked (all silent)

**The acceptance battery:** 216 hymns, every dialect × six modes × the
dialect's meters × 2 seeds, rotating the keys and modes of time.
- 0 invalid Scores;
- 0 failing a JSON round-trip;
- 0 nondeterministic;
- 0 hard checks failing (round 1 had 1).

**Every dialect × all 9 meters × 6 modes of time × 3 modes:** 486 hymns,
with the hymnists in turn.
- 0 invalid, 0 thrown.
- 1 hard check failing: a pentatonic Long Meter hymn by Orson Tebbs in
  2/2 (seed 9029). It shares a run of six intervals with two leaps with
  NEW BRITAIN, and five repairs could not shake it. The lab shows the
  failure.

**The critic's measures, rebuilt:**
- 720 hymns: seeds 700–759 × the lab keys × three dialects;
- 200 hymns on seeds 2000–2199 in the home key, Tabernacle and Old Way;
- no hard check failing.

**Do the hymnists still shape what they write?** Yes (16 Tabernacle hymns
each):
- leap rate: Tebbs 0.21 to Oakes 0.38;
- sevenths: Carrow 3 % to Vail 13 %;
- endings: Hale, Lund and Oakes lean *ti–do*; Tebbs, Carrow and Vail lean
  *re–do*.

**The lab in muted headless Chrome over CDP**, at 860 and 390 px, all
three dialects, playing:
- 0 console errors;
- no horizontal scroll;
- `?key=down5` honoured;
- the URL rewritten;
- the spread panel counting sung endings.

**Timing** (Node, the machine otherwise idle, seeds 100–139): a hymn
composes in about 58 ms for the Tabernacle, 38 ms for the Sacred Harp and
25 ms for the Old Way. Some of the batteries above ran in parallel and
report slower times. Repair rounds are the cost, most often for "not an
Earth tune".

## New in the surface (for the integrator)

- **`KOLOB.Composer.sungEnding(hymn, k)`:** the last k sung notes, named
  from the final.
- **`KOLOB.Composer.FP_KEYS`:** the fingerprint's compared measures.
- **`fingerprint(h)`:** new fields:
  - `share.closeThird`, `share.closeHome`, `share.closeDom`;
  - `rangeSemi` (each part's compass in semitones);
  - `closes`.
- **`Line.plan` (dev):** gains `via` (tonicize or relative) and `full`.
- **`Hymn.report.lines[i].full`:** a Sacred Harp line that closes with its
  third.
- **Dialect profiles:**
  - `TABERNACLE.homeFigures.{major,minor}`: the last line's ending
    leanings;
  - `SACREDHARP.fullClose.{major,minor}`: the full-close rates;
  - `closeThird`, `closeHome` and `closeDom` tolerances in every dialect.
- **New stream forks** under `skeleton/line:<k>`:
  - `close:full`;
  - under the line's die: `figure:refit`, `figure:peak` and
    `peakAt:repair:<r>`.

  Every earlier fork is untouched, so a seed keeps its name, frame, meter,
  mode and hymnist.

## Known issues, still open

- **The Tabernacle closes on the dominant more often than the Psalmody**
  (45 % against 29 %). The Psalmody also rests on IV and on vi mid-verse
  ("none:IV", "half:iii"), and the colony's cadence tables have no such
  close yet. That would be a small addition to `TABERNACLE.cadences`.
- **The Tabernacle's melisma** is still 6 % against the book's 13 %.
- **The Old Way's tunes** are still narrower and more stepwise than their
  references, on purpose.
- **A peak can sit at 59 %.** That is one syllable under the band, which
  the check allows, so the lab can print "59 % (planned 60–75 %)" beside a
  passing check.
