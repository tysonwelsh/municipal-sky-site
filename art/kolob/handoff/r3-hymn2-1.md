# r3-hymn2-1: the rest of the composer

*HYMN crew, round 3, second pass. Branch `kolob-r3-hymn2`. 2026-09-28.
Nothing pushed or published; VERSION not bumped. Lab only: the meeting
does not sing any of this yet.*

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
| 6 | **B** psalmody | JUBILEE, 8.7.8.7, ionian, by Ammon Stroud | a major fuging tune, four entries half a bar apart |
| 8 | **B** psalmody | MERIDIAN, SM, aeolian, 3/2, by Abner Hale | the slow triple time; the entries a bar apart; the counter and treble come in together |
| 3 | **D** gospel | WINTER QUARTERS, 11s, 6/8, by Ammon Stroud | the whole barbershop chain III7 → VI7 → II7 → V7 → I (33 ringing chords); 5 swipes; the tag I–I7–IV–iv–I |
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

