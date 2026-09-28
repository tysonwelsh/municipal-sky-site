# r3-hymn2-1: the rest of the composer

*HYMN crew, round 3, second pass. Branch `kolob-r3-hymn2`. 2026-09-28.
Nothing pushed or published; VERSION not bumped. Lab only: the meeting
does not sing any of this yet.*

> **Read "Round 2" at the foot first.** The critic's round changed the
> fuging tunes (B), the gospel harmony and tuning (D) and the unison songs
> (E), so the B, D and E seeds in the table below now compose different
> hymns; Round 2 has a new table. Four claims below were wrong; each is
> corrected where it stands, marked **[corrected]**.

**What is new to hear.** The composer now writes in all six of the ward's
harmonic languages, not three. The three new ones:

- **B · New England psalmody, the fuging tune.** Billings's Boston. Four
  rough parts in plain chords, the tune in the tenor, until one line
  (usually the third) *falls apart on purpose*. The bass starts it alone.
  Then the tenor, the counter (alto) and the treble come in, each half a bar
  or a bar later, on the same words, and all four land together on one
  written chord. The fuge is then sung a second time.
- **D · Gospel and barbershop.** The tune is in the second voice (the
  *lead*). A tenor harmony floats above it; the baritone and the bass sit
  below. Dominant sevenths come in chains down the circle of fifths.
  - Every seventh chord is tuned **4:5:6:7**, on the seventh harmonic. The
    seventh sits a little flat of a piano's, and the chord *rings*.
  - **Swipes:** a chord changes under a held word.
  - **Echoes:** the men answer the women's line ends.
  - A **refrain** after every verse, and a **tag** at the end.
- **E · Shaker and Primary.** One tune in unison, bright and plain, in a
  dance time. It comes as one of three kinds:
  - a *Shaker hymn*;
  - a *gift song*, wordless, on "lo" and "dee", in two strains each sung
    twice;
  - a *Primary song* for the children: short, with a chorus, never wider
    than an octave.

  Now and then a few men hum a drone under it.

**And three new kinds of piece:**

- a **round** (a canon over one repeating ground, for 2 to 4 entries);
- a **partner hymn** (a closing hymn written on the first hymn's chords,
  so the two can be sung together; if they will not fit, it says so and
  they are not combined);
- the meeting's **wandering refrain** (two lines in the camp-meeting lilt,
  written to sit well in every key of the day).

**The critic's three idiom notes are fixed:**

- The Tabernacle closes on the dominant as often as the 1889 book does
  (45 % → 30 %; the book 29 %). It now rests on IV and vi mid-verse.
- The Sacred Harp now closes some lines on a bare unison or octave
  (1 % → 15 %; the book 15 %).
- The Tabernacle's tunes slur more (6 % → 12 %; the book 13 %): a leapt
  third is now and then walked, two notes to a syllable.

This changes hymns you have already heard. See "What changed in the hymns
you know" below.

---

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8148 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-hymn2`
   (8132 was taken on this machine by another crew's build).
2. Open **http://127.0.0.1:8148/art/kolob/hymn-lab.php**.
3. Choose a dialect and press **Compose**, then **▶ Play**.

A link can carry the settings, for example
`hymn-lab.php?seed=3&dialect=gospel`. It also takes `mode=`, `meter=`,
`hymnist=`, `key=`, `kind=` (for dialect E: `shaker`, `gift`, `primary`)
and `play`.

The **round**, the **partner hymn** and the **wandering refrain** each
have their own section further down the page. Each has a *Compose* button
and a *Play* button, and each works from the seed (and, for the partner and
the refrain, the hymn) above it.

### Seeds to try

The lab composes these with the day's theme seeded in, as it always does.
The names, meters and hymnists below are what you will see.

| seed | dialect | what it is | listen for |
|---|---|---|---|
| 2 | **B** psalmody | FAR WEST, CM, aeolian, 4/4, by Zina Carrow | the fuge in line 3: bass at beat 0, tenor at 2, counter at 4, treble at 6, all meeting on one chord; then the fuge again |
| 6 | **B** psalmody | JUBILEE, 8.7.8.7, ionian, by Ammon Stroud | a major fuging tune, four entries half a bar apart. **[corrected]** Its head was two notes, one note sung twice: the entries imitated only the rhythm and the words. Now a head of five notes (Round 2). |
| 8 | **B** psalmody | MERIDIAN, SM, aeolian, 3/2, by Abner Hale | the slow triple time; the entries a bar apart; the counter and treble come in together |
| 3 | **D** gospel | WINTER QUARTERS, 11s, 6/8, by Ammon Stroud | **[corrected]** not the whole chain: line 6 was III7 → VI7 → ii7 → V7. The ii7 is a minor seventh, so the ring broke at the third link. (In 40 hymns a chain of three dominant sevenths came in 17, the whole four-link chain in about 1.) 5 swipes; the tag I–I7–IV–iv–I. Round 2 has a seed with the whole chain. |
| 5 | **D** gospel | LEHI, 8.7.8.7, 4/4, by Jerusha Welling | the men's echo, twice; the tag IV–iv–I |
| 10 | **D** gospel | FAR KIRTLAND, 7.7.7.7, AABA, by Ephraim Cutler (the new quartet man) | III7 → VI7 chains, swipes, the tag I–I7–IV–I |
| 2 | **E** Shaker | ENSIGN, a gift song, 6/8, over a drone | wordless ("vol lo vol lo … lum"), two strains each sung twice |
| 10 | **E** Shaker | SHILOH, a gift song, 2/4, hexatonic, by Tamar Eddy (the new sister who "receives" songs) | the dance; "hey de hey de … dum" |
| 5 | **E** Shaker | MORNING STAR, a Primary song, 2/4, by Sariah Lowe (the new Primary president) | short verse and chorus, inside an octave |
| 7 | **E** Shaker | EMIGRATION, a Shaker hymn, 6/8, AABA, over a drone of do and sol | plain, dancing, the drone underneath |
| 8 | Tabernacle → **the partner** | COTTONWOOD, then LAMPLIGHT written on its chords | **combined**: the third play is LAMPLIGHT sung with COTTONWOOD on the trumpet stop against it |
| 12 | Tabernacle → **the partner** | MORNING STAR, then GARDEN GROVE | **combined** |
| 4 | Tabernacle → **the partner** | BETHEL, then LEHI | **not combined**: the fit found too many unisons (36 %); you hear the two hymns one after the other |
| 1 | **a round** | OLD SHILOH, 4 segments, pentatonic, 3/4, over I–IV–I–V | carries four entries |
| 2 | **a round** | LEHI, 4 segments, over I–V | four entries |
| 8 | **a round** | LIBERTY, 3 segments, 2/4, over I–IV–I–V | three entries |
| 8 | Tabernacle → **the refrain** | HANDCART, 8.8, AA′, 6/8 | the camp-meeting lilt; comes home *ti–do*; sits in all three keys |
| 11 | Tabernacle → **the refrain** | EVENING, 8.6, AA′ | a second one |

To hear the round, the partner or the refrain, set the seed (and, for the
partner and the refrain, the dialect) above, press **Compose**, then use
that section's own buttons.


### What to listen for, in plain words

**The one question is the same as before: does each sound like a real
hymn in its style, and would a congregation want to sing it again?**

- **The fuging tune (B).**
  - Find the line marked "the fuge" on the staff. The bass should start it
    alone. You should hear the same opening notes come back three more
    times, higher each time (tenor, counter, treble), with the words
    overlapping.
  - Then all four should arrive together on one chord.
  - Is it a joyful tangle, or a mess? Billings meant the first.
- **Gospel and barbershop (D).**
  - Listen to the chords marked ✦ under the staff. Tuned 4:5:6:7, they
    should sound unusually smooth and bright, almost buzzing, with a faint
    extra high note floating over them.
  - A swipe (marked ~) is a chord turning under one held word.
  - The tag at the very end: the melody holds one note while the chords
    move around it, and the last chord rings.
  - In some hymns the men echo the women's last words at the end of a line.
- **Shaker and Primary (E).**
  - Is it simple and singable, a tune you could hum after one hearing?
  - Does the gift song sound "received": wordless, dancing, two strains?
  - Is the drone (when there is one) a gentle floor, not a hum you notice?
- **The round.** Four groups enter one after another: sopranos, altos,
  tenors, basses. It should thicken into a pleasant tangle and never grind.
- **The partner hymn.** You hear the first hymn, then the closing hymn,
  then (when they fit) the closing hymn again with the first tune played
  against it on the organ's trumpet stop. The "oh, they fit" moment is the
  point. When the check refuses them, the page says "NOT combined" and why.
- **The wandering refrain.** One man (the enthusiast) starts it alone. The
  ward picks it up. Then you hear it a fourth higher, then a fifth lower,
  as it would come back after a later hymn and in the doxology. It should
  feel comfortable in all three keys.

### The breath or brushing sound between notes (the owner's report)

You said you hear a breath or brushing sound *between the notes* while the
hymns are sung. I could not find a burst of noise at the note changes in
the voices or the organ. Here is what I measured, all silently
(OfflineAudioContext, and the lab's own output tapped in muted headless
Chrome).

- **One singer, rendered dry:** the energy above 2.5 kHz in the 120 ms
  around each note change is the same as in the middle of the notes
  (within about 1 dB). Turning the singer's breath fully off changes
  nothing measurable during singing.
- **The breath between lines** (the singers' in-breath at each rest) is
  about 70 dB under the singing, so it cannot be heard.
- **The organ's chiff** (each pipe's "consonant" at the start of a note)
  adds about 0.6 dB above 3 kHz at the chord changes, against the steady
  chord.
- **The whole lab chain** (the ward, the room, the compressors), tapped:
  in the dips between notes, the high end is about 2 dB louder relative to
  the singing than in the steady parts. That is small but real. The likely
  cause is the room's reverberation (and the compressor lifting it) showing
  through while the ward re-articulates.

**[corrected, Round 2]** The critic's silent renders point elsewhere:
not at the breath or the room but at the eight singers of a part changing
pitch at slightly different moments, each with a short slide. Round 2
adds a third switch, **together**, for that, and it is the one to try
first. The two below stay.

**To find it by ear, I added two switches to the lab's play bar:**

- **breath** turns off the singers' breath: the aspiration in the tone and
  the in-breath between lines.
- **room** turns off the church's echo.

If the sound goes away with **room** off, it is the reverberation tail. If
it goes away with **breath** off, it is the voices. Either way the fix is
in a file I do not own; see requests 6 and 7. If you hear it in the
meeting (index.php) rather than the lab, the meeting's choir is a
different voice (`kolob-voices-choir.js`), and that is where to look.

---

## What changed in the hymns you know

Every earlier (dialect, seed) composes exactly as before, except where one
of the listed fixes applies. I checked this against the round-2 composer:
240 hymns, seeds 1–60, in the three old dialects and with no dialect named.

| change | which hymns | what you hear |
|---|---|---|
| **chordAt counts home's note once** (a bug: an all-*do* chord was never read as a unison, and home's chord was overweighted) | Sacred Harp: 18 of 60 (with the other fixes off) | nothing. Only the chord labels and cadence names printed under the Sacred Harp's staff change. The notes are identical. |
| **The Tabernacle rests mid-verse** (critic note 1) | inner lines that closed on V (42 %) or on I (5 %) | the same tune; the chord under a line's last note is now IV, vi, ii or iii |
| **The Tabernacle's slurred thirds** (critic note 3) | 35 of 40 tunes gain at least one, about two each | the same notes the search chose, with a passing note slurred in where the tune leaps a third |
| **The Sacred Harp's bare closes** (critic note 2) | inner lines closing on their root or fifth (34 %), the last line (16 %) | the treble and alto join the tune's note: an unison-and-octave close |

- **Taken together:** of the 60 hymns per dialect in the check, 54
  Tabernacle hymns and 43 Sacred Harp hymns sound somewhat different. Every
  Old Way hymn is identical.
- **What stays the same:** every name, number, meter, form, mode, hymnist,
  cadence plan, peak and ending. BETHEL (seed 4), MANTI (5) and COTTONWOOD
  (8) are still themselves.
- **Switching a fix off:** each fix is one field in `kolob-dialects.js`:
  - `TABERNACLE.restClose`
  - `TABERNACLE.melismaAdd`
  - `SACREDHARP.bareClose`

  Deleting a field brings back round 2's hymns exactly. I confirmed this
  for all three together.

---

## What shipped

| commit | what |
|---|---|
| `4e9ccffc` | the three new dialects; three new hymnists; the idiom fixes; the 7-limit helpers |
| `99246c64` | rounds, the partner hymn, the wandering refrain; hymn-lab rebuilt for all of it |
| (this) | gospel's registers and echo, the partner's own checks, the composer's header; this note |

### The files

- **`kolob-pitch.js`** (additive): the seventh harmonic.
  - `SEPTIMAL_SEVENTH` (7/4), `SEPTIMAL_COMMA` (64/63), `JOHNSTON_SEVEN`
    (36/35), `BARBERSHOP` (1/1 5/4 3/2 7/4);
  - `limitOf(m)`, `septimalOf(m)`, `harmonicSeventh(root)`;
  - `oddParts(monzos)` and `proportion(monzos)`: any chord read as
    harmonics of one fundamental. A just V7 reads `4:5:6:7` in any voicing,
    a major triad `4:5:6`, a minor one `10:12:15`.
- **`kolob-dialects.js`**: profiles and harmonizers for B, D and E.
  - Small hooks in the shared planner, whose defaults leave the old
    dialects byte-identical: the grammar, the voicer, the swipe, forced
    chords.
  - The three idiom fixes: `restClose`, `bareClose` and `melismaAdd`.
  - `chordAt` fixed (it counted home's note once per octave).
  - `names` still lists the first three; `all` lists the six.
- **`kolob-hymnists.js`**: every hymnist leans toward B, D and E as well.
  Three new hymnists, whose leans toward the first three dialects are nought
  (so no earlier draw moves):

  | hymnist | Deseret | habits |
  |---|---|---|
  | Sariah Lowe | 𐐝𐐲𐑉𐐴𐐲 𐐢𐐬 | Primary songs |
  | Ephraim Cutler | 𐐀𐑁𐑉𐐨𐐲𐑋 𐐗𐐲𐐻𐑊𐐲𐑉 | the Social Hall's quartet man |
  | Tamar Eddy | 𐐓𐐩𐑋𐐪𐑉 𐐇𐐼𐐨 | gift songs |

- **`kolob-composer.js`**:
  - E's kinds and D's refrain in the frame;
  - the new meters 66.66, 77.77, 65.65, 88.88, and the refrain's couplets
    88, 86, 77;
  - the fuge's longer line;
  - the ringing tuning (every dominant seventh in D is 4:5:6:7; a note held
    into a chord tunes that chord);
  - each dialect's own checks;
  - new rulers in the fingerprint: `closeUnison`, `stagger`, `septimal`,
    `ornament`, and crossing read in the Hymn's own voice order;
  - `round()`, `partner()`, `fitTogether()`, `wanderingRefrain()`,
    `refrainIn()`, `setTune()`, `keyFit()`.
- **`hymn-lab.php`, `hymn-lab.js`**:
  - all six dialects, and a *kind* menu for E;
  - the dialect's own engraving: the psalmody in open score; the quartet on
    two staves, with Johnston's **7** on septimal notes, ✦ on ringing
    chords and ~ on swipes;
  - the round, partner and refrain sections;
  - the staff lights with the precentor;
  - the **breath** and **room** switches;
  - a silent capture tap, `HymnLab.tap` (for tools only).

### The API, for the integrator

- **`compose(stream, {dialect: "psalmody" | "gospel" | "shaker", kind, …})`**
  - The dialect draw when none is named is unchanged (the first three), so
    every earlier seed keeps its dialect. To sing B, D or E, name it.
  - New Hymn fields, all JSON-plain:
    - `voiceOrder` (D: `["S","T","A","B"]`, the lead second);
    - `kind` (E);
    - `drone` (E: `{degs}` from the final);
    - `fuge` (B: `{line, gap, head, entries, repeatFrom}`);
    - `tag` (D: a Line, like `amen`);
    - `verses` (E's gift song: one verse of Deseret vocables), with
      `vocablesEn` (dev).
  - Notes may carry `septimal: 1`. Chords may carry `ring` and `swipe`.
- **`round(stream, {dialect, keyMonzo, segments})`** returns a Hymn:
  - `form: "round<k>"`; one Line per segment, each over the ground's
    chords;
  - `.round = {segments, entries, byEntries, delayBeats, delayBars, ground, pairs}`.
  - **To perform it:** group g starts at `g × delayBeats` and sings the
    lines in order, as many times round as wanted. The lab uses up to
    `entries` groups.
- **`partner(stream, firstHymn, opts)`** returns `{hymn, combined, fit}`.
  - When `combined`, `hymn.partner.firstTune` holds the first hymn's tune
    retuned to the partner's chords, for the organ or a cornet to play in the
    last verse.
  - When not, `hymn` is a closing hymn of its own in the same meter, and
    `fit` says why they were not combined.
- **`wanderingRefrain(stream, {keys, dialect, mode})`** returns
  `{hymn, keys: [{keyMonzo, octave, lo, hi, final, fits, closeInTess}], fits, compass}`.
- **`refrainIn(stream, refrain, {dialect, keyMonzo})`** sets the same tune
  in another hymn's dialect and key. The octave comes from `keys[i].octave`.

---

## How it was checked (all silent)

**While these ran, the machine's load average was 15–28 (other crews'
batteries).** Every time below is inflated by that; the dialects cost about
what the first three did (tens to a few hundred ms).

### Acceptance

Every mode × every meter the dialect uses × 2 seeds, rotating the keys and
the modes of time:

| dialect | hymns | invalid | thrown | not deterministic | JSON round-trip | hard checks failing |
|---|---|---|---|---|---|---|
| B psalmody | 84 | 0 | 0 | 0 | 0 | 0 |
| D gospel | 96 | 0 (see note) | 0 | 0 | 0 | 0 |
| E Shaker and Primary | 96 | 0 | 0 | 0 | 0 | 0 |

- **The note on D:** kolob-score.js's proofreader counts only the syntonic
  comma, so it flags every septimal note in all 96 hymns. It reads them
  valid once each is read through Johnston's 7, as SCORE §2's `commaOf`
  does. See request 1.
- **With the day's theme** (as the lab composes), 40 seeds each: B 0, D 0,
  E 0 failing.
- **[corrected]** Not every mode: gospel in aeolian and dorian failed
  "voice-leading" now and then (seed 4: parallel octaves in the tenor
  harmony and the baritone, in three lines), and no minor gospel hymn had
  a tag. The battery above rotated modes by meter and missed it. Fixed in
  Round 2.
- **The old dialects:** unchanged except for the listed fixes (the table
  above).

### Each new dialect keeps its own law

The hard checks, every hymn:

- **B, "the fuge":**
  - four entries in the order bass, tenor, counter, treble, each taking up
    the tenor's head;
  - every entry lands consonant (no second, seventh or tritone against what
    sounds);
  - all four begin a note on the written cadence.
  - A fuge is written in 83 % of B's hymns. The rest are plain psalm tunes,
    as Billings wrote too.
- **D, "ringing sevenths":**
  - every dominant seventh's notes are exactly harmonics 4:5:6:7 of one
    fundamental (odd parts 1, 3, 5, 7), or a subset of them with the seventh
    present; at least one sounds complete.
  - A seventh chord the voices could not sing complete is named, and tuned,
    as its triad.
- **D, "the lead in the second voice":** the tenor harmony is over the
  lead in every chord, and the baritone and bass under it.
- **D, "a refrain after the verse":** always.
- **E:**
  - "one melody", in unison;
  - a Primary song keeps "a child's compass" (an octave);
  - a gift song is sung on vocables.

### The fingerprints are distinct

40 hymns per dialect, seeds 100–139, home key; 17 measures.

- **Nearest centroid, leave-one-out:** 230 of 240 hymns (95.8 %) lie
  nearest their own dialect.
- **The only confusions** are the Sacred Harp and the psalmody (7), sister
  traditions, and psalmody into the Tabernacle (3).
- **The smallest distance between two dialects' centroids:** 3.4 spreads
  (Sacred Harp and psalmody). Gospel to Tabernacle is 3.5, Shaker to Old
  Way 3.6, and the rest 4.3–6.8.

| mean of 40 | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| parallel fifths | 20 % | 13 % | 0 | 0 | — | — |
| chords with no third | 46 % | 24 % | 4 % | 2 % | — | — |
| crossing | 7 % | 24 % | 0 | 0 | — | — |
| sevenths | 0 | 0 | 10 % | **43 %** | — | — |
| septimal notes | 0 | 0 | 0 | **10 %** | — | — |
| onsets with a part silent (the fuge) | 0 | **10 %** | 0 | 0 | — | — |
| closes on a bare unison or octave | 15 % | 3 % | 0 | 0 | — | — |
| melody leaps | 34 % | 33 % | 21 % | 25 % | 32 % | 28 % |
| slurred melody notes | 11 % | 8 % | 12 % | 7 % | 8 % | 13 % |
| ornament marks | 0 | 0 | 0 | 0 | 0 | 36 % |
| sung in unison | no | no | no | no | yes | yes |
| a crotchet lasts (s) | 0.42 | 0.48 | 0.58 | 0.53 | 0.48 | 1.09 |

**Against the Earth tunes where the book has one:**

- **E vs SIMPLE GIFTS:** leaps 32 % (SIMPLE GIFTS 15 %), compass 6.7 steps
  (7). The unison songs leap more than that one Shaker tune. Primary songs
  and gift songs skip about the triad.
- **B vs CORONATION** (Holden, a Yankee tunesmith, in the 1844 book):
  thirdless 24 % (27 %), melody leaps 33 % (29 %). CORONATION has no fuge.
  Kolob's book has no Billings fuging tune, so the fuge is held to its own
  rules.
- **D vs GOD BE WITH YOU** (Sankey, 1880s): 100 % of its closes keep their
  third (100 %). Its sevenths (43 %) are far past the Sankey tune's (11 %):
  that is the barbershop half of the dialect, which the book does not hold.

### The critic's three idiom notes, with numbers

| note | round 2 | now | Earth |
|---|---|---|---|
| Tabernacle, closes on the dominant | 45.2 % | **29.8 %** (lab keys: 27.8 %) | 29.2 % |
| Sacred Harp, closes on a bare unison or octave | ~1 % (critic); 0.0 % by the old chordAt | **14.8 %** (lab keys: 17.8 %) | 15.0 % |
| Tabernacle, slurred melody notes | 6.2 % | **11.5 %** (lab keys: 12.9 %) | 13.3 % |

- These are seeds 100–139 in the home key; "lab keys" is seeds 700–759 in
  the lab's four other keys.
- **Side effects:**
  - The Tabernacle's closes on home's chord moved from 50.6 % to 48.8 %
    (the book: 53.0 %).
  - Its melody leaps fell from 29 % to 21 % (the book: 23 %), because the
    walked thirds are now steps.
  - No new hard failures.

### The round, the partner, the refrain

- **Rounds:**
  - 40 in the Shaker dialect: all valid, all checks passed. 28 carry four
    entries and 12 carry three. None carries fewer.
  - 16 in the psalmody: 12 carry four, 4 carry three.
  - Every pair of segments that ever sounds together: 0 clashes on the beat.
- **The partner hymn** (20 Tabernacle first hymns):
  - **7 combined (35 %).** Every combined pair: 0 clashes on the beat, 0
    notes off the chord, 0 sour consonances, at most 2 parallel fifths or
    octaves, and at most 30 % unisons.
  - **13 not combined.** The reasons: a clash on the beat 5, sour
    consonances 4, parallels 3, unisons 1.
  - Every closing hymn is valid and passes its own checks.
  - In D (gospel), 0 of 6 combined. The swipes and echoes change chords
    under the other tune, and the check refuses them. That is the check
    working.
- **The wandering refrain:** 16 of 16 fit every key (the lab's key, a
  fourth up, a fifth down) in gospel, 16 of 16 in the Shaker dialect and 16
  of 16 in the Tabernacle.
  - **[corrected]** A fourth up and a fifth down are the same note an
    octave apart, so that was two keys, not three. On a real day (home, a
    fourth up, a fifth up) the gospel refrain fit only 19 of 30. Fixed in
    Round 2.
  - Compass 8–10 semitones.
  - Set anew in the Sacred Harp, the Tabernacle and the Shaker dialect:
    every setting valid.

### The lab, in muted headless Chrome

Settings: `--headless=new --mute-audio`, port 9452, the profile
`kolob-hymn2-chrome`, PHP on :8148.

- **At 860 and at 390 px:** all six dialects, then the round, the partner
  and the refrain, each composed and played.
- **Console errors:** 0.
- **Horizontal scroll:** none.
- **Notes lit** in every dialect and demo, including the precentor's lines.
- **Output level:** −13 to −27 dBFS RMS through the limiter.

---

## Requests

1. **kolob-score.js, the proofreader (integrator).**
   - Allow a note whose monzo carries a 7 one septimal comma (36/35) beyond
     its spelling, as SCORE §2's `commaOf` already reads it. Today every D
     hymn's septimal notes fail `validateHymn`.
   - One line, in `validateNote`:
     `var room = SPELL_SLACK + (n.alt ? 112 : 0) + (n.monzo && n.monzo[3] ? 48.8 * Math.abs(n.monzo[3]) : 0);`
   - The composer's own "valid Score" check reads them so meanwhile, and
     says so.
2. **SCORE §5, adopt as used:**
   - `Hymn.voiceOrder` (the parts top to bottom when not S A T B;
     D: S T A B);
   - `Hymn.kind`, `Hymn.drone`, `Hymn.fuge`, `Hymn.tag` (a Line, like
     `amen`);
   - `Hymn.round`, `Hymn.partner` (dev), `Hymn.wandering` (dev);
   - `Note.septimal`;
   - `Chord.ring` and `Chord.swipe`.

   A performer should sing the lines from `fuge.repeatFrom` a second time,
   and the `tag` after the last refrain.
3. **Seating D (CAST).** The lab seats the quartet in the ward this way,
   and the men's echo depends on it:
   - the tune (T, the lead): the altos and three sopranos;
   - the tenor harmony (S): five sopranos;
   - the baritone (A): the tenors;
   - the bass: the basses.

   The Score's part labels do not say who sings; `voiceOrder` says which is
   on top.
4. **The dialect draw (FORM, integrator).** `compose()` still draws only
   among the first three when no dialect is named, so that no seed moves.
   The meeting's house dialect should name B, D and E: the psalmody for
   fast Sundays and the arbor, gospel for jubilee and Pioneer Day and the
   Social Hall, the Shaker and Primary for the Primary's guest and
   Christmas.
5. **The round, the partner, the refrain (FORM, CAST):** place them as the
   enrichment briefs say. The round: groups entering `delayBeats` apart.
   The partner: the last verse of the closing hymn, only when `combined`.
   The refrain: after the first hymn (the enthusiast alone first), after a
   later hymn via `refrainIn`, and in the doxology. The keys come from
   `wanderingRefrain`'s `keys`.
6. **The breath or brushing sound (VOICES, kolob-voices-vocal.js).** If the
   owner hears it go with the lab's **breath** switch off: the singer's
   steady aspiration runs at the same level while the tone dips at every
   re-articulation (to 72 %), so the breath shows through for an instant.
   The fix would be to duck the aspiration with the tone.
7. **The same sound, if it is the room (integrator or VOICES):** if it goes
   with **room** off instead, the church's reverberation is showing through
   the dips, lifted by the compressor. A shorter or darker hymn room, or a
   slower glue compressor release, is the place to look.

## Known issues

- **The partner combines about one first hymn in three** (the Tabernacle),
  and almost never in gospel. The check is strict on purpose (the owner's
  "a loose fit is mud"). A future pass could write the closing hymn in the
  first hymn's own rhythm more often, which fits more easily but is less
  lively.
- **The partner's harmony is the first hymn's chords wherever the closing
  hymn's notes allow.** Where a weak beat will not take the first hymn's
  chord, the partner chooses its own there. The fit is measured against
  the chords actually sung.
- **D in minor** (aeolian, dorian) is rare by default (about 4 %). Its
  vocabulary is small: V7, VII7 and a dominant of iv; no III7–VI7 chains.
- **The Sacred Harp and the psalmody are close cousins** by the ruler
  (7 of 80 confused). The fuge, the counter and the fuller thirds are what
  tell them apart by ear.
- **B's fuge sits in one line**, not across two as Billings's often
  spanned lines 3–4. The later voices sing the same words in quicker
  notes, the earlier ones in longer.
- **Rounds are written for the unison dialects.** A round has no
  harmony parts of its own: the ground's chords are its harmony, and the
  entries make the chords.
- **The breath or brushing sound** is not fixed. I did not find it with
  the instruments I have, and the voices and the room are not mine. The two
  switches are for finding it by ear (requests 6 and 7).
- **Timing** under this machine's load was 0.1–1.5 s per hymn, with the
  partner up to about 13 s (six tries). On an idle machine, expect about a
  third of that.


---

# Round 2: the critic's ten

*Same branch, same day. Nothing pushed or published; VERSION not bumped.
The Tabernacle, the Sacred Harp and the Old Way compose exactly as they
did (160 of 160 hymns identical). What changed is in B, D and E, the
round, the partner and the refrain.*

## What is new to hear, in plain words

- **The brushing sound between notes: a third switch, "together".** The
  critic's silent measurements point at the ward itself. Eight people sing
  each part. Each changes pitch a little early or late (up to about a
  tenth of a second), and each slides into the new note. At every note
  change the high end turns briefly to hiss. **together** makes the
  singers change notes at once, with short slides. Try it first; the
  **breath** and **room** switches are still there beside it.
- **The fuging tunes (B) now fuge properly.**
  - The fuge usually runs through the last two lines, as Billings's and
    Read's do.
  - The bass starts it alone with the opening five to eight notes and their
    words. The tenor, the counter and the treble come in one after another,
    a bar or half a bar apart, each singing **those same notes**, so you
    can hear the tune being passed round. They alternate between two
    pitches, a fifth apart, where the harmony allows.
  - All four land together on the last chord of the verse, and the fuge is
    sung again.
  - Before, the "head" they passed round was two or three notes (sometimes
    one note sung twice), and it did not sound like imitation.
  - Voices that have not come in yet now show rests on the staff.
- **Gospel (D) rings more often and slides less.**
  - The chords that ring now come in longer chains more often, and the
    whole barbershop chain (III7 → VI7 → II7 → V7 → I) can be heard.
  - A singer who repeats a note into the next chord no longer slides a
    quarter-tone. Before, this happened about once a hymn (42 times in 40
    hymns); now it happens once in 40. The smaller slides that remain are
    the ringing seventh settling onto its harmonic, which is what makes it
    ring.
  - Minor-key gospel hymns now always end with a tag. The one minor hymn
    in twenty that broke a rule no longer does.
- **The Shaker hymns (E) walk.** They move by step much more, as SIMPLE
  GIFTS does. They also slur fewer notes in the dancing six-eight. Gift
  songs and Primary songs still skip about the chord a little.
- **Rounds change chord only on the bar's strong beats.** Before, a chord
  could change in the middle of a bar.
- **The wandering refrain now truly fits all three keys of a day.** Those
  keys are home, a fourth up and a fifth up. Before, it was tested in two.
- **A closing hymn never takes the first hymn's name.**

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8132 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-hymn2`
2. Open **http://127.0.0.1:8132/art/kolob/hymn-lab.php**.
3. Use the settings below.

A link now carries the three switches too, for example
`hymn-lab.php?seed=3&dialect=gospel&together=1&breath=0`. Throwing a
switch updates the link, and the switch takes effect at the next **▶ Play**.

### The brushing sound: what to try

1. Play any hymn as it is, for example
   `hymn-lab.php?seed=12&dialect=psalmody`.
2. Tick **together** and play the same hymn again.
3. Then untick **breath** as well, and play it again.

What each result means:

| if the sound… | then it is… | and the fix is in… |
|---|---|---|
| goes with **together** | the ward's staggered, sliding note changes (the likeliest) | the voices or the meeting's cast (request A below) |
| goes only with **together** *and* **breath** off | both: the smear plus the breath noise under it | request A and the old request 6 |
| goes with **room** off | the church's echo showing through | the old request 7 |
| goes with none of them | something I have not found | tell me which hymn and where |

The numbers behind this (the critic's measurement, repeated here) are in
"How it was checked" below.

### Seeds to try (the lab composes them with the day's theme, home key)

| seed | settings | what it is | listen for |
|---|---|---|---|
| 12 | **B** psalmody | ORCHARD, CM, 3/4, by Abner Hale | the fuge in lines 3–4. The bass starts on the dominant, then the tenor on home's note, then the counter on the dominant, then the treble on home's note, each **a bar apart**, each with the same seven-note head. |
| 13 | **B** psalmody | DAWN SPRING, CM, minor, 2/2, by Tirzah Quayle | the same, an eight-note head; a minor fuge |
| 20 | **B** psalmody | NAUVOO, 8.7.8.7, 3/4, by Ammon Stroud | a six-note head, a bar apart, the alternation strict |
| 6 | **B** psalmody | JUBILEE (the first pass's two-note head) | now five notes, half a bar apart, across lines 3–4 |
| 16 | **D** gospel | NEW WASATCH, 7.6.7.6 D, by Hosea Lund | line 2 is **the whole chain**, III7 → VI7 → II7 → V7 → I, every link ringing (✦). VI7 → II7 → V7 → I comes three more times. Tag I–I7–IV–I. |
| 12 | **D** gospel | WASATCH, 8.7.8.7, 3/4 | VI7 → II7 → V7 → I in lines 1, 2 and 4; 3 swipes; tag vi–II7–IV–I |
| 18 | **D** gospel | OLD MERIDIAN, 11s, 3/4 | the men's echo, three times |
| 4 | **D** gospel, mode aeolian | RIMLIGHT (the critic's failing hymn) | passes now; its minor tag i–i7–iv–i, with the tonic's own ringing seventh falling to iv |
| 9 | **D** gospel | BETHEL HILL, LM, minor (by draw) | the minor tag i–i7–iv–VI–i |
| 3 | **D** gospel | WINTER QUARTERS (the first pass's pick) | line 6: III7 → VI7 → ii → V7. The tune sings fa there, so the third link must be minor. Later in the line VI7 → II7 → V7 → I rings. Tag I–I7–IV–iv–I. |
| 12 | **E**, kind Shaker hymn | KIRTLAND, CM, 4/4, AABA | a Shaker hymn that walks: leaps one step in twelve |
| 13 | **E**, kind Shaker hymn | BETHEL, CM, 6/8, over a drone | walks, dances, a hummed floor |
| 2 | **E**, kind gift song | ENSIGN, 6/8, over a drone | wordless, two strains each sung twice |
| 5 | **E**, kind Primary song | MORNING STAR, 2/4 | short verse and chorus |
| 1 | **a round** (any dialect but psalmody) | DAWN, 4 segments over I–IV–I–V | four entries, every chord change on a strong beat |
| 5 | **a round** | WINTER QUARTERS, 6/8, I–IV–I–V | four entries in the dance time |
| 8 | Tabernacle → **the partner** | COTTONWOOD, then LAMPLIGHT | combined (unchanged) |
| 11 | Tabernacle → **the partner** | CUMORAH, then **FAR WATER** | the closing hymn used to be named CUMORAH too; not combined |
| 1 | gospel → **the refrain** | HANDCART, 7.7, AA′, 6/8 | a seven-semitone refrain that comes home ti–do and sits in all three keys |
| 8 | Tabernacle → **the refrain** | HANDCART, 8.8, AA′, 6/8 | an octave's refrain, home do–do |

## The critic's ten, one by one

**1. The wandering refrain in the real keys of a day.**

- **The lab now tests the three keys a day actually has:** its own, a
  fourth up (4/3) and a fifth up (3/2). The final lands on three different
  notes.
- **The composer measures the room before drawing.** Before any note, it
  finds which compasses sit well in every key given, for the part that
  sings the tune. A compass is how far below the final the tune may go
  (sol, la or ti) and how far above (mi to la).
  - "Sits well" means that in each key some octave puts the final where the
    part sings comfortably, with the whole tune inside the part's compass.
  - Where every key leaves the lilt its whole compass (seldom, with three
    keys), the draw is exactly as before. Otherwise each try draws a
    compass that fits.
  - Gospel's lead sings only G below the keynote to C above. In the key a
    fifth up that leaves a fourth above the final, so a gospel refrain now
    stays inside it.
- **A bug fixed along the way.** `keyFit` measured every key relative to
  the first key. It was right only when the first key was the day's
  keynote (the lab's default). It now places each key on its own pitch.
- **Measured.** 30 seeds per dialect, on each of five key sets: home, up 4,
  up 5; home, down 5, down 4; either set led by a fourth up; and the old
  lab set.
  - Every dialect fits 30 of 30 on every set, with 0 hard checks failing.
  - Before, the gospel refrain fit 19 of 30 on the real set.
  - Set anew in each of the other keys with `refrainIn`: 60 of 60 valid in
    every dialect.
  - Compass: 6–10 semitones in gospel, 6–12 in the Tabernacle.

**2. Minor gospel.**

- **The parallel octaves.** A minor tune whose lead walks down to mi below
  the keynote left the tenor harmony one note above the lead and the
  baritone one note below it, an octave apart. A chord change then moved
  both up a step together, which no voicing could avoid.
  - Now, when a line's voicing is forced into parallels, the hymn is voiced
    again with the tenor harmony's and baritone's ranges drawn round the
    lead's own compass (same dice).
  - Hymns that never met this are untouched by it.
- **The tag.** Minor gospel now has its own tag chains, all turning round
  la, the minor final: i–i7–iv–i, VI–iv–i, i–VI–iv–i, i–i7–iv–VI–i. The
  i7 is the tonic's own ringing seventh, falling to iv.
- **Measured.** Aeolian and dorian, 40 seeds each with the theme: 0 hard
  checks failing (before: 1 in 20 each), and a tag on 40 of 40 each
  (before: 0 of 24). Mixolydian and ionian: 0 failing, 40 of 40 tagged.
- **The check itself.** The check's line "swipes, echoes and the tag" had
  always said "no tag", because it read the tag before the Hymn had it.
  It now reads it from the harmony.

**3. The breath or brushing sound.**

- **The new switch.** **together** sets every singer's timing habit to none
  and their confidence to 0.95, as the critic tested. That makes the scoop
  into each new pitch short.
- **Nothing else moves.** The same dice are thrown, so the ward is
  otherwise identical. With the switch off, the lab sounds as before.
- **The handoff's framing is corrected** above.
- **What I re-measured.** One alto section of eight lab-style singers, dry,
  OfflineAudioContext in the muted lab page, the 2.5–8 kHz band. The
  spectral flatness is noise-likeness: 0 is a pure tone, 1 is hiss.

| condition | flatness at the joins | mid-note | ratio |
|---|---|---|---|
| as the lab sings | 0.155 | 0.098 | 1.59× |
| breath off | 0.142 | 0.063 | 2.27× |
| **together** on | 0.127 | 0.101 | **1.26×** |
| together on, breath off | **0.098** | 0.070 | 1.41× |
| together on, no slide at all (the voices' code, a test copy only) | 0.112 | 0.101 | 1.11× |
| every note the same pitch (control) | 0.104 | 0.091 | 1.14× |

- **Reading the table.** The smear at the joins follows the ward changing
  pitch out of step. **together** takes most of it away. With breath off
  as well, the joins are the least noisy of all. The breath does not make
  the smear, but it is the noise floor under it.
- **I cannot hear.** This is the strongest measured candidate, not a
  verdict.

**4. The four wrong claims.** Each is corrected in place above, marked
**[corrected]**:

- (a) seed 3's "whole chain";
- (b) seed 6's two-note head;
- (c) the refrain's "every key";
- (d) "every mode, 0 failing".

Separately, D's chains were made to ring more often:

- **The change.** A seventh falling a fifth into another *ringing* seventh
  is now preferred. Falling into the minor ii7 is taken only where the
  tune asks for it (where the tune sings fa, II7's fi would contradict it).
- **Measured** (40 hymns):

| | before | now |
|---|---|---|
| ringing links (a dominant seventh a fifth above the next) | 165 | 219 |
| VI7 → ii7, where the ring breaks | 40 | 3 |
| hymns with a chain of three or more | 20 | 23 |
| hymns with a chain of four | 2 | 5 |
| the whole III7 → VI7 → II7 → V7 → I, lab seeds 1–60 | — | 2 (seeds 16 and 47) |

**5. Repeated notes that slid a comma, in D.**

- **The line's chords are now tuned together.** A small search over each
  chord's three possible roots (its spelling, or a syntonic comma either
  side) weighs three things:
  - how far the chord's own notes stand off their spelling;
  - every note a voice sings again into the next chord that does not stay
    put. This is squared, and a quarter-tone is surcharged, so one
    49-cent slide costs more than two 21-cent ones. The lead counts three
    times over, being the tune;
  - a bass moving by an impure fourth or fifth.
- **The minor seventh chord** is sung as its own harmonics, 10:12:15:18
  (its seventh 9/5). So ii7 may stand on the "grave re", 10/9, with fa, la
  and do where the scale has them.
- **Swipes.** At a swipe into a ringing seventh where the lead holds the
  fifth (or the seventh), the other voices would rather move than strike
  the other of the two again. Those two notes, a 6:5 minor third in the
  chord before, are 7:6 in the ring, and the held lead cannot move. This
  was where most of the quarter-tone slides came from: I → VI7 over a held
  mi, ii7 → V7 over a held re, the tag's vi → II7 over the post.
- **Every septimal note is still spelled within one comma** under
  Johnston's 7, so V7 and II7 never stand a comma high.
- **Measured** (40 hymns):

| | before | now |
|---|---|---|
| re-struck notes that move | 189 | 145 |
| moves of 48.8 c | 42 | 1 |
| moves in the lead | 16 | 12 |
| impure bass fourths and fifths (of about 715) | 69 | 56 |

- **What remains.** 102 moves of 27.3 c. These are the prepared seventh
  settling onto the seventh partial (the septimal comma): the critic's
  suggested cap, and the ring's price. There are also 40 of 21.5 c. Ties
  still never move.

**6. The fuge.**

- **Two lines, when they fit.** The fuge now runs across the tune's last two
  lines when the words fit. Otherwise it takes one line, as before.
- **The head** is the first line's opening, to its third stress: 5–9 notes.
  The entries are a bar apart where that fits, else half a bar.
- **The heads are chosen together, first**, as a fugue's exposition is
  written.
  - Each is transposed by an octave, a fifth, a fourth or not at all. It
    must lie in its part's compass, sing no tritone, and enter consonant
    against every head already sounding.
  - The alternation is preferred: the bass at the dominant, the tenor at
    home's pitch (it is the tune), the counter at the dominant, the treble
    at home's.
  - Only then are the free parts walked against the heads. The first pass
    wrote the bass whole before the counter's head was placed, so a
    dominant entry often landed on a second and moved up a fourth.
- **Imitation past the head** is encouraged for three notes, where it sounds.
- **The bar.** The fuge's strong beats are now read on the tune's own bar.
  The first pass read them half a bar out wherever the entries were half a
  bar apart. The line's `barStart` is corrected too, so the engraving's
  barlines fall right.
- **The engraving.** Rests where a voice has not come in, and a tie drawn
  out to the edge where a note is sung across the join.
- **Measured** (60 lab seeds, with the theme):

| | before | now |
|---|---|---|
| hymns with a fuge | 49 | 54 |
| fuges across two lines | 0 | 42 |
| head, in notes | 3 in 40, 2 in 7, 4 in 2 | 6 or more in 38; 4–5 in 7; 3 in 7; 2 in 2 |
| the treble entering on its own (four entries, not three) | 5 | 39 |
| entries (bass, counter, treble) at home's pitch or the dominant | 86 of 147 (59 %) | 116 of 162 (72 %) |
| entries at the subdominant | 36 | 33 |
| the full alternation (dominant, home, dominant, home) | 1 | 6 |
| imitation running past the head | 0 | 3 |
| hard checks failing | 0 | 0 |

- **Where it falls short.**
  - The strict alternation is rare. With heads this long the entries
    overlap (a stretto), and at most distances only some intervals are
    consonant against the head already sounding; the search keeps the
    consonance.
  - The continuation past the head seldom survives the consonance costs.
  - The one-line fuges (SM, whose last two lines will not take four
    entries) keep three-note heads.

**7. Rounds on the strong beats.**

- **The rule.** A ground's chords now change only on the bar's strong
  beats: the downbeat, and in 4/4 and 6/8 the half bar.
- **How.** A ground that will not divide its segment so is drawn again from
  those that will (its own die). A round whose ground already fit is
  exactly as before.
- **Measured** (88 rounds across five dialects):
  - Chord changes off the strong beats: 28 (1.5 beats in 3/4, 13; a crotchet
    in 2/4, 11; others 4) → 0.
  - Entries carried: 51 rounds of four and 37 of three, as before.
  - Clashes on the beat between sounding segments: 0.
  - Single-chord grounds are a little commoner (17 → 21). In 3/4 only I or
    I–V can change on the downbeat within two bars.

**8. E's leaps and slurs.** Each kind now has its own leap target and its
own weights. A Shaker hymn walks most, and it draws fewer leaping endings
(sol–mi–do, sol–do). In 6/8 and 3/4, the dotted foot (which slurs a
syllable over two notes) and the slurred cells are rarer.

| 40 seeds each | before | now | SIMPLE GIFTS |
|---|---|---|---|
| Shaker hymn, melody leaps | 30.5 % | 19.6 % | 14.9 % |
| gift song | 33.1 % | 25.9 % | |
| Primary song | 30.6 % | 25.9 % | |
| slurred notes over the tolerance (Shaker / gift / Primary) | 10 / 11 / 6 | 1 / 1 / 0 | |
| idiom check missed, default draw with the theme | 8 of 40 | 0 of 40 | |

The gift and Primary songs still skip about the triad more than SIMPLE
GIFTS. I left them so: children's songs and the dancing gift songs do.

**9. The psalmody's idiom.**

- **The crossing was the counter over the treble,** mostly, where nothing
  held it under: 236 chords outside the fuge. Now:
  - the counter keeps under the treble, as a rule;
  - the treble and the counter cross the tenor less often;
  - inside the fuge a crossing costs a little, and is let stand where the
    entries need it.
- **Crossing**, as a share of chords: outside the fuge 21 % → 1 %
  (CORONATION 2 %); the whole hymn 22.5 % → 9.5 %.
- **The tolerance, loosened where the idiom is not the tunes':**
  - crossing may reach 35 %, since a fuge across two of four lines is half
    the hymn;
  - the "silent entries" measure no longer asks every tune for a fuge. A
    plain psalm tune is a psalm tune, and the fuge's own check says
    whether one was written.
- **The tenor's passing notes are slurred** now and then (the Tabernacle's
  mechanism; CORONATION slurs 13 %): the mean rose 8 % → 12 %.
- **Idiom check missed:** 26 of 40 → 6 of 40. What remains: 3 tunes with
  no slur at all, 2 with thirds just under the floor, 1 with no parallel
  fifth.

**10. The partner's name.**

- **The rule.** A hymn never takes the name of another hymn of the meeting
  (`opts.others`, which the partner already passes, or `opts.avoidNames`).
  The name alone is drawn again, from its own die.
- **Measured.** Seed 11 is now CUMORAH → FAR WATER. In 30 seeds, 0 share a
  name. Combined partners are unchanged: 7 of 20.

**And item 7 of the task** (the first pass's idiom notes), re-measured on
the critic's seeds 300–359:

- the Tabernacle closes on the dominant 26.6 % (the book 29.2 %; the
  critic's 41 %);
- the Sacred Harp closes on a bare unison or octave 15.8 % (the book 15 %;
  the critic's 1 %);
- the Tabernacle slurs 11.5 % of its tune (the book 13.3 %; the critic's
  7 %).

These three dialects are byte-identical to the first pass.

## What changed in the hymns you know

- **The Tabernacle, the Sacred Harp, the Old Way, and a compose() with no
  dialect named:** identical, 160 of 160 checked (seeds 1–40, all five
  keys).
- **B, D and E:** these are changed by the listed fixes.
  - B: all 40 checked change. The fuge, the ordered parts and the slurred
    passing notes; the tune itself changes where passing notes are
    slurred.
  - D: 37 of 40 change. The harmony changes in 32 (the chain preference,
    the swipe voicing, the minor re-voicing); the tuning alone in 4; one
    keeps a different repair round.
  - E: all change, walking more.
  - Every name, meter, form, mode, hymnist and key stays as it was.
- **Rounds:** only those whose ground broke the meter (10 of 20 checked).
- **Refrains:** nearly all. With three keys a day, the lilt's whole
  compass seldom fits every one, so the compass is now drawn to fit before
  the notes (in gospel, the lead's narrow compass shapes every refrain).
- **Partners:** only where a name collided.

## What shipped (this round), and the API

The API changes are additive:

- **`Hymn.fuge.lines`**: the Score lines the fuge runs across (one or two);
  `fuge.line` is still the first. **`Hymn.fuge.headNotes`**: the head in
  notes. `repeatFrom` is unchanged.
- **The first line of a two-line fuge:**
  - `cadence.kind` is `"none"`, and `plan.elided: true` (dev), because the
    fuge runs on through that close;
  - `breathAfter: false`;
  - no fermata;
  - `barStart` is read on the tune's own bar, moved back by the fuge's lead.
- **A note sung across the join:** `tie: true` on the first line's last note
  of that part, continued by the next line's first note (`syl: null`). A
  performer should hold it over.
- **`compose(…, {avoidNames})`**: names a hymn may not take (with
  `others`' names).
- **`wanderingRefrain`** keeps its signature; its compass now depends on
  `keys`. `keyFit` places each key on its own pitch.
- **Dialect profiles** (internal): `kindLeap`, `kindWeights`, `kindFigures`
  and `timeCells` for E; `melismaAdd` for B. A `moveExtra` hook in the
  shared voice search, used only by D.

## How it was checked (all silent)

- **Acceptance** (every mode × every meter × 2 seeds, keys and modes of
  time rotating):

  | dialect | hymns | invalid | thrown | not deterministic | round-trip fails | hard failing |
  |---|---|---|---|---|---|---|
  | B | 84 | 0 | 0 | 0 | 0 | 0 |
  | D | 96 | 0 | 0 | 0 | 0 | 0 |
  | E | 96 | 0 | 0 | 0 | 0 | 0 |

  D's septimal notes still need request 1 for kolob-score.js's own
  proofreader.
- **With the day's theme**, 40 seeds each, 0 hard checks failing in:
  - B;
  - D, in its drawn modes, in aeolian and in dorian;
  - E, in each of its three kinds;
  - the Tabernacle and the Sacred Harp.

  The Old Way failed 1 of 40, "not an Earth tune". That dialect is
  unchanged, so the failure predates this round.
- **Fingerprints** (40 per dialect, leave-one-out nearest centroid):
  - 230 of 240 (95.8 %), as before.
  - The confusions are between B and the Sacred Harp (7), B and the
    Tabernacle (2), and the Old Way and E (1).
  - The nearest pair of centroids is the Sacred Harp and B, 3.1 spreads
    apart (3.4 before). With its crossing reined in, B leans a little
    toward its sister, and the fuge keeps it apart.
- **The lab**, in muted headless Chrome (`--mute-audio`, port 9452, PHP on
  :8132):
  - Every dialect composed and played at 860 and at 390 px, with the round,
    partner and refrain demos.
  - 0 console errors, no horizontal scroll, notes lit.
  - Output −11 to −27 dBFS RMS.
  - A two-line fuge (seed 13) played through with all four rows lit.
  - The switches ride in the link.
- **Timing** under this machine's load: about 30 ms per E hymn, 55 ms per
  B, 90 ms per D, 35 ms per refrain, and about 0.8 s per partner (up to
  six tries).

## Requests (new and changed)

- **A. The brushing sound: VOICES (`kolob-voices-vocal.js`) and CAST.** If
  the owner hears it go with **together**, the smear is the section's
  staggered, sliding pitch changes. The critic's measurements:
  - a section in step with short slides: 1.26×;
  - with no slide on a re-articulated note (a test copy, not shipped):
    1.11×.

  The places to look are the slide on a re-articulated note (`port` in the
  singer's pitch schedule), and how far each singer's timing habit spreads
  a part.
  - **In the meeting**, the choir is `kolob-voices-choir.js`, and the same
    question applies there.
  - **Requests 6 and 7** above still stand for the breath and the room.
- **B. SCORE §5 (integrator).** Adopt:
  - `Hymn.fuge.lines` and `Hymn.fuge.headNotes`;
  - a tie across a line's end, held into the next line;
  - the elided first line of a two-line fuge (sung straight on, no breath,
    no fermata).
- **C. The refrain's keys (FORM).** Pass `wanderingRefrain` the keys the
  day's hymns actually take. Its compass is fitted to those keys, and
  `keys[0]` need not be the keynote any more.
- **Requests 1–5 above stand.**

## Known issues

- **D:** one quarter-tone slide in forty hymns remains, a swipe with no
  other voicing. The 27-cent settling of a prepared seventh is left on
  purpose.
- **B:**
  - the strict dominant–home alternation is rare (6 in 54);
  - imitation past the head is rare;
  - the one-line fuges keep short heads;
  - with heads this long the entries overlap, so the fuge is busier than
    the first pass's.

  Is it a joyful tangle or a mess? That is the listening question.
- **E:** gift and Primary songs leap about 26 % against SIMPLE GIFTS'
  15 %, by design (see 8). Kolob's book has no Primary or gift-song tune to
  measure against.
- **Gospel refrains are small** (6–10 semitones), because the lead's
  compass is small and the day's keys are three.
- **The brushing sound is not fixed.** It is only made findable. The fix
  lives in files I do not own.
