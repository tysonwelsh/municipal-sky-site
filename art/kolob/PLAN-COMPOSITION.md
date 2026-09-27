# KOLOB 2 — ONE MEETING, NEVER THE SAME TWICE

*The composition plan. Draft 3, 2026-09-26, for the owner's review.*
*The visual side is [`PLAN-ENGRAVING.md`](PLAN-ENGRAVING.md); its mockups are in `mockups/engraving-*.html`.*

## What changed since draft 2

- **The Living Hymnal's session-long accumulation is dropped.** Listeners
  will hear one playthrough, not three in a row, so nothing here depends on
  hearing earlier meetings.
- **Two principles replace it:**
  - **Every meeting is complete and rich on its own**, and pays off within
    itself.
  - **Every visit sounds very different**, so that a person who comes back
    finds a new meeting.
- **Returning-visitor memory is shelved** until the app has earned return
  visits.

**Kept and deepened:** the six harmonic styles; the hymn composer, now with a
concrete description of how it works; the congregation, rethought as a
*cast* of individuals; the guests, each now fully specified; the Kolob
reckoning, reworked to pay off within one meeting and to sound good in
practice; the visions, now described by what you would actually hear.

**Also new:** the Earth-tunes transcription workstream (a separate agent;
the owner reviews), the Hosanna as an audio-only, unlogged event, and
Deseret phoneme singing on the long-term roadmap.

Nothing is built yet.

---

## 0. The premise

A colony of Latter-day Saints, many generations out from Earth, meets on the
Sabbath at the rim of Kolob's light. They have the hymnal, the shape notes,
the Deseret alphabet, the organ, the brass band, the telegraph, and the habit
of singing together.

**Kolob is music made by a congregation: people, in daylight, together.**

| | ZANKYŌ | Prospero's Jukebox v2 | **Kolob** |
|---|---|---|---|
| who makes the music | a dead station's machines | a magician's books | **a ward of people, each with a voice** |
| the arc of one play | a night that cuts and forgets | an evening that turns a page | **a meeting that rises from dawn to full light** |
| variety across plays | the far tail of a station's decay | three books, many evenings | **a different Sunday, ward, style and guest every visit** |
| light | dark, cracked | theatrical | **clear, open, rising** |

### The two design laws

**1. A meeting is a complete work (about 14–15 minutes).**
- It has a shape: gathering → invocation → hymns → testimony → sacrament →
  doxology → postlude.
- It has its own themes, its own people and its own payoffs.
- Recurrence happens *inside* a meeting, where it can be heard: the theme
  returns in the doxology, the tune the drone has been spelling is finally
  sung (§7.2), and the Question is asked and left unanswered.

**2. The first three minutes carry the day's identity.**
- Many listeners won't stay for the whole meeting.
- So the prelude must already announce *which* Sunday this is: its style,
  its organist, its keynote, its light.
- Payoffs are spread through the meeting, not saved for the end.
- **Two random seeds must sound clearly different within three minutes.**
  We will measure this (§12).

---

## 1. Where Kolob is today (v0.30), in brief

Details are in draft 1's analysis, from a full read and harness runs.

**The character to keep:**
- 5-limit just intonation over a drone;
- shape notes, Deseret, the wheel;
- the motif engine (15 transforms, dialects, tether, dialogue ledger);
- lining out, fuging, the cumulative assembly;
- the Ives guests;
- the plagal amen;
- the meeting kinds.

**The ruts to fix:**
- **The Question:** one fixed phrase, asked 4–5 times, nearly always in the
  invocation, running over its section.
- **Cadences:** about 90 % plagal.
- **Line endings:** every line ends on a scale walk to a rest tone and a
  fermata.
- **Harmony:** one chord per syllable from a first-order table, with no
  cadence planning, no sevenths, no inversions and a permanent tonic pedal.
- **The choir:** four oscillators.
- **Tunes:** no object called "a hymn".
- **The band:** loops.
- **Keys:** one per meeting.
- **Randomness:** one random stream, and `setTimeout` timing.
- **Output:** no symbolic score.

**The bugs:**
- Voice crossing in 19–25 % of harmonized chords.
- The accompaniment plays a future chord.
- The Question overruns its section.
- The UI shows "two bands" during the old tune.
- Harness miscounts.
- The Question's answer doublings fall outside the tuning.

### 1.1 What stays, what grows, what is replaced (owner's question, 2026-09-26)

**The rule: build out, don't rework.** Everything a listener recognises as
Kolob today stays. Replacements happen only in the machinery underneath, or
where the current version *is* the problem.

**Stays as it is, or is extended:**

- **The six modes:** ionian, mixolydian, dorian, aeolian, pentatonic and
  hexatonic, drawn per meeting as today, tilted by brightness.
  - The dialects (§3) are a *second*, separate choice: the harmonic style,
    layered on top of the mode.
  - A mixolydian Sunday can be sung Sacred Harp or Tabernacle.
  - A few pairs are naturally favoured: Sacred Harp minor leans aeolian or
    dorian; the Shaker and Primary style leans pentatonic.
  - Keys per hymn change the *tonic*, not the mode; the doxology sunrise
    still lifts a dark mode.
- **5-limit just intonation over the drone.** The 7-limit is added only for
  dialect D and the visions.
- **The order of service:** prelude → invocation → hymns → testimony →
  sacrament → doxology → postlude, and its mutations. The wheel is
  untouched.
- **Charles Ives: everything that exists now stays and grows.** His presence
  is not demoted to a guest; it was always in the guests, and in more than
  the guests:
  - **The visitations he inspired stay:** the Unanswered Question, fixed
    per Phase 1; two bands crossing, which becomes a real march; the
    steeples; the half-remembered old tune.
  - **The cumulative form stays:** the tune withheld and assembled in the
    doxology.
  - **New Ives, added:** Variations on a hymn (*Variations on "America"*);
    the far ward (his distant choirs); the strings' oblivious chorale in the
    Question; the congregation lagging the organ; the quarter-tone and
    Putnam's Camp visions.
  - Ives becomes more central, not less.
- **The rest of the American lineage stays:** La Monte Young's drone, and
  Billings's fuging entries (which become real fuging tunes in dialect B).
- **The motif engine** (15 transforms, dialects, genealogy, tether, dialogue
  ledger, the air protocol). It moves from being the *only* source of melody
  to developing material *around* the hymns: interludes, obbligatos,
  answers and guests.
- **Existing voices and set pieces:** lining out; the still small voice;
  the telegraph; the field (wind, crickets, clock, tuning fork, rain,
  coyote, bell, beacon); the Liahona; the raspberry amen; the stillnesses;
  the sacrament's sparseness; the clarinet, harmonium, strings, bells and
  tuba.
- **Meeting kinds:** ordinary, fast, conference and jubilee. The calendar
  (§7.1) *adds* Sundays around them (Pioneer Day and the feasts are jubilee
  flavours).

**Replaced** (the listener hears these as improvements, not as a different
app):

| today | becomes | why |
|---|---|---|
| one random stream, `setTimeout` timing | forked streams, audio-clock scheduling | reproducibility, and safe iteration |
| a chord picked per syllable from a first-order table | chords planned per phrase, per dialect, toward a cadence | the "no destination" rut |
| a hymn section = motifs poured into a meter with scale-walk padding | composed hymn tunes (the motif engine works around them) | real hymns; the samey line endings |
| one fixed Question phrase ×4–5 | seven generated questions ×3 | the owner's complaint |
| the fife looping the theme | a composed march in strains | the loop |
| four choir oscillators | congregation desks plus the cast | a room of people |
| one F0 per meeting, random | the day's keynote (the reckoning's first note) and a key per hymn | keys, and a planned key plan |
| the meta-season cosine | the Sunday calendar | variety per visit |
| fixed intensity curves per section | the arc of light, with crossfades | the jump at every joint |

---

## 2. Phase 0 — Foundations

Mostly inaudible except the bug fixes. Seeds re-base once (owner-approved).

### 2.1 Modules
`kolob-audio.js` (3,909 lines) becomes a family of modules on
`window.KOLOB`, loaded in order by `index.php` (the pj2 pattern):

- `kolob-core` (context, master, rooms, and the public `KolobAudio` API,
  kept compatible);
- `kolob-pitch` (the just-intonation lattice);
- `kolob-score`;
- `kolob-harmony` (the dialects);
- `kolob-melody` (gestures, the improviser, rhythm, and today's motif engine);
- `kolob-composer`;
- `kolob-cast` (the ward, §5);
- `kolob-meeting` (planning, calendar, conductor);
- `kolob-guests`;
- `kolob-visions`;
- `kolob-voices-*` (synthesis by family).

The Jukebox v2 substrate (`pj2-rand`, `pj2-clock`, `pj2-fx`, and optionally
`pj2-air` and `pj2-conductor`) is **loaded read-only by relative path, never
modified**, as ZANKYŌ does.

### 2.2 Separate random streams and a real clock
- **Streams.** Labelled forks via `PJ2.Rand`: `meeting`, `composer:<hymn>`,
  `harmony:<hymn>`, `cast`, one per cast member, `guest:<type>`, `vision`,
  `field`, `joints`. "Draw every die unconditionally."
- **Clock.** A `PJ2.Clock` lookahead scheduler timed against the audio clock
  replaces the `setTimeout` chains. Every decision keys off *scheduled* time.
- **Result:** the same seed gives the same meeting, even under timer jitter.
  A change to one guest never alters a hymn.

### 2.3 The Score: compose first, then perform
Composition produces a **symbolic score**. The voices *perform* it, the
engraving *prints* it, and the harness *reads* it.

```
Hymn   { number, name(ds), meter, form, dialect, key(ratio), leader,
         lines: [Line], verses: n, text: [Verse(ds)] }
Line   { notes by part, cadence {kind, chord, targetDeg}, peak, breathAfter }
Note   { part, deg, oct, ratio (exact monzo), beats, tie, fermata,
         syllable(ds), stress, nonChord: pass|nbr|susp|app|ant }
Performance { hymn, verse, practice, tempo, rubato, singers, organ registration }
```

The engraving's accuracy (durations, parts, words, tuning) depends on this.
It is also what makes the "real hymn composer" possible (§4). UI events
become typed (`{type:"hymn-announced", …}`) instead of the label substrings
`kolob-ui.js` matches today.

### 2.4 An exact just-intonation lattice
- **Exact pitches.** Pitches are exact ratios (exponents of 2, 3, 5 and 7).
  That gives true comma tracking: the lattice knows that the 10/9 "re−" and
  the 9/8 re differ by 81/80.
- **Keys per hymn**, pivots and drift policy (§3.6).
- **7-limit** for the ringing chords (§3.4).
- **Johnston accidentals** in the engraving.
- **The day's keynote** replaces a random F0: it is the Kolob reckoning's
  first note (§7.2).

### 2.5 Bug fixes
- **Voice crossing:** re-voice under the pinned soprano, and report the
  voicing *after* the pin.
- **Chord timeline:** a chord timeline read from the Score, so the
  accompaniment plays what is actually being sung.
- **Visits:** they hold the section joint.
- **UI:** the `oldtune` flag and typed events.
- **Harness counting:** the sunrise/meeting count, a computed `FOLD_UNSAFE`,
  and every sounded note reported.

### 2.6 Harness and instruments (light)
Short sanity checks. Ship and listen.

- **REPRO** under jitter.
- **Repetition:** phrase shapes heard before *within* a meeting.
- **Tallies:** cadence types; dialect fingerprints (share of parallel fifths,
  share of chords without a third, chromatic share, sevenths, 7-limit); SATB
  legality from the Score.
- **Budgets:** node count and CPU.
- **Distinctness (new, and central to design law 2):** render the first
  three minutes of 20 seeds and measure how far apart they are, combining:
  - dialect;
  - keynote;
  - tempo;
  - organ registration;
  - which cast members are heard;
  - the guest, if any;
  - pitch-class and rhythm profiles.

  No two of the 20 should be near-twins.
- **An engraving smoke test:** headless-Chrome screenshots at 860 and 390 px.

### 2.7 Labs (dev pages, unlinked)
- **`hymn-lab`:** compose a hymn from a seed, choose its dialect, key and
  practice, hear it, and see it engraved. The workbench for §3 and §4.
- **`cast-lab`:** seat the ward, solo any member, and hear a quartet versus a
  congregation.
- **`engraving-lab`:** a fixed Score looping through the real engraving.
- **`guest-lab`:** trigger any guest on demand, in any section.

---

## 3. The six styles of American hymn harmony

The heart of the musical upgrade. American hymnody isn't one sound: it is
at least six distinct *harmonic languages*, with different rules about where
the tune goes, which chords are allowed, what counts as a good or bad
progression, and how a line ends.

Kolob today speaks roughly one of them (a simplified Victorian hymn style,
always ending in amen). Giving each hymn a style (a **dialect**) is the single
biggest source of both depth *and* variety across visits: the same tune in
two dialects sounds like two different worlds.

### A. Sacred Harp: the open fifth
- **Origin:** *The Sacred Harp* (Georgia, 1844), still sung today in hollow
  squares across the US and Europe.
- **Sound:** loud, bright, raw, ecstatic, and not refined. Harmony built
  from **open fifths and octaves**, often with no third.
- **Parts:** the tune is in the **tenor** (the middle), with the treble and
  alto as independent melodies around it. Men and women double the treble
  and tenor in octaves, so there are really six parts.
- **Rules that break the textbook:**
  - parallel fifths and octaves are *welcome*;
  - voices cross freely;
  - every part must be a good melody on its own.
- **Modes and cadences:** minor tunes are modal (Aeolian or Dorian, no
  raised leading tone). Lines end on a bare **fifth**, with no amen.
- **Real examples:** NEW BRITAIN, IDUMEA, PISGAH, WONDROUS LOVE.
- **In Kolob:**
  - the style of fast Sundays, brush-arbor seatings and the purest just
    intonation;
  - no organ: the ward sings unaccompanied in the hollow square (four sides
    of the stereo field);
  - the pitch floats (§3.6);
  - verse 1 is sung "on the notes" (*fa sol la mi*) before the words.
- **Implementation:**
  - the harmonizer builds three melodies against the tenor tune by
    counterpoint: interval preferences favour 5ths, octaves and unisons, and
    3rds and 6ths are allowed but not required;
  - every part is scored for its own singability;
  - final chords are bare fifths.

### B. New England psalmody: the fuging tune
- **Origin:** William Billings and the Yankee tunesmiths (Boston, 1770s–90s).
- **Sound:** homophony that suddenly *breaks into imitation*. Mid-tune, the
  bass enters alone with a phrase, then the tenor, alto and treble, each a
  bar later, overlapping ("fuging"), before they come back together.
  Rugged, sometimes deliberately rough.
- **In Kolob:** today's fuging entries become real **fuging tunes**: the
  composer writes the fuge into the form (typically line 3), with the text
  entering part by part.
- **Also:** Billings's *Jargon* (a deliberately discordant anthem) becomes
  a vision (§9).
- **Implementation:**
  - the fuge subject is the line's melody head;
  - entries alternate between tonic and dominant, with the imitation checked
    for consonance at each entry;
  - the convergence cadence is written, not improvised.

### C. The Tabernacle: the LDS hymnal voice
- **Origin:** the Latter-day Saint hymnal's own 19th-century style: Evan
  Stephens, Ebenezer Beesley and George Careless (Salt Lake City, c.
  1860–1920), the Tabernacle Choir and organ.
- **Sound:** warm, full, Victorian:
  - the **tune in the soprano**;
  - full triads;
  - **first inversions**;
  - V7 chords;
  - **secondary dominants** (V/V, V/IV) for colour;
  - a diminished seventh on the approach to a climax;
  - **4–3 suspensions** at cadences;
  - the cadential 6/4 ("the organ swells and resolves").
- **Cadences:** authentic within the hymn, and the **plagal amen** after it.
- **In Kolob:**
  - the home dialect: conference Sundays, the organ at full registration,
    the doxology;
  - **the amen lives here**, so it stays Kolob's signature while dropping
    from ~90 % of all cadences to roughly the share of meetings sung in this
    style.
- **Implementation:**
  - phrase-grammar harmony: tonic → predominant → dominant → tonic, planned
    backwards from each line's cadence;
  - a voice-leading search (the existing scorer, repaired and extended) with
    Victorian rules: contrary motion to the bass, no parallels, common
    tones kept;
  - a second pass places non-chord tones (suspensions, passing tones).

### D. Gospel and barbershop: the ringing seventh
- **Origin:** Moody and Sankey's gospel hymns (1870s–), the parlour
  quartet, and barbershop harmony (1890s–).
- **Sound:**
  - **dominant-seventh chords everywhere**;
  - chains of them moving around the circle of fifths (III7 → VI7 → II7 →
    V7 → I, the barbershop progression);
  - **refrains** after every verse;
  - **echoes**: the men answer the women's line ends;
  - close harmony, with the melody in the second voice.
- **Tuning:** tuned *justly*, the barbershop seventh is **4:5:6:7**. The
  seventh sits a bit flat of the piano's, and the chord "rings": the
  overtones lock and a phantom fifth voice appears. This is an American
  just-intonation idiom, and it is exactly Kolob's tuning, extended to
  7-limit.
- **In Kolob:** jubilee and Pioneer Day, the Social Hall guest (§8), and
  the brightest moments of the doxology. The engraving marks the 7-limit
  tones with Johnston's "7".
- **Implementation:**
  - a 7-limit chord vocabulary;
  - a circle-of-fifths chain generator;
  - "swipes" (the chord changes under a held word);
  - refrain and echo forms in the composer.

### E. Shaker and Primary: the unison song
- **Origin:** Shaker "gift songs" (1830s–: "Simple Gifts" is one), and
  children's songs (the LDS Primary, founded 1878).
- **Sound:** **one melody**, sung in unison, sometimes over a drone,
  sometimes in dance rhythm. Shaker songs could be "received" in vision,
  some in wordless syllables.
- **In Kolob:** the Primary guest (the children's choir), the gift of
  tongues (§8), and the rare "sister's song".
- **Implementation:** melody plus an optional drone, dance-rhythm cells,
  and heterophonic doubling (children slightly off each other).

### F. The Old Way: lined out, slow, ornamented
- **Origin:** lining out, the practice of reading or singing each line for
  the congregation to repeat. It survives in Old Regular Baptist churches in
  Appalachia and in Gaelic psalm singing in the Scottish Hebrides, and it
  came to America with the Puritans.
- **Sound:**
  - a precentor half-sings a line;
  - the congregation answers it **extremely slowly**, each singer
    decorating the tune in their own way;
  - the result is a slow-moving cloud of heterophony, unmetered, haunting,
    unlike anything else in Western music.
- **In Kolob:** already present in part (lining out). It becomes a full
  dialect for fast Sundays and the sacrament.
- **Implementation:**
  - melody only; each cast member ornaments independently (§5);
  - tempo about 0.4× normal;
  - the pitch floats freely (§3.6).

### How dialects are chosen, and what they buy
- **Per meeting:** a *house dialect*, from the Sunday and meeting kind.
- **Per hymn:** its own dialect, weighted toward the house dialect.
- **Per verse:** possible *re-dressing*. For example, a Sacred Harp tune's
  last verse taken up by the organ in the Tabernacle dialect, the moment the
  pipes enter under a bare-fifth hymn and fill it with thirds.
- **What it buys:**
  - the prelude's registration and the first hymn announce the dialect
    within minutes (design law 2);
  - the doxology tends toward Tabernacle and gospel brightness (the arc of
    light, §7.3).

### 3.4 Ringing chords
The 7-limit tones are available only in dialect D and in visions. They
target moments: a held chord on a swipe, the barbershop tag, the Social
Hall. A listener hears the difference as a sudden *bloom* in the chord.

### 3.5 Voice-leading engine 2 (serves every dialect)
- **Rules per dialect:** ranges and spacing, doubling rules, a
  crossing policy (forbidden in C and D, free in A and B), and a parallels
  policy (rewarded in A and B, forbidden in C and D).
- **Non-chord tones** as a second pass: passing and neighbour notes,
  suspensions, appoggiaturas, anticipations.
- **Pedal points by choice:** a dominant pedal before the last verse; the
  drone released during Tabernacle hymns (it follows the key, or rests).

### 3.6 Pitch drift: a physical truth made musical
- **The physics:** in pure intonation, harmony that moves around (I–vi–ii–V–I)
  shifts the pitch by a small interval (a comma), and real unaccompanied
  choirs drift, usually sharp as they warm up.
- **The rule:** **with the organ, the pitch is anchored. Unaccompanied
  (dialects A, B, F), it floats.**
  - It drifts on the comma path the harmony actually takes, and a little
    upward with enthusiasm.
  - When the organ re-enters, the ward is found a few cents off and comes
    back to it audibly: a small, human, *true* moment.
  - It is capped (about ±25 cents) so it is always musical.
- **In the far tail**, "the Comma Pump" lets the drift run (§9).

### 3.7 Keys and modulation
- **Keys.** Each hymn is keyed by the chorister from the day's keynote, a
  just fourth or fifth away, with a pull toward home. The organ interlude
  between hymns *modulates* through a common-tone pivot rather than jumping.
- **Last-verse moves:**
  - the gospel lift, up a semitone (16/15), on jubilee and conference days;
  - an organ reharmonization;
  - a descant.
- **The doxology sunrise** stays, as one move among several.

---

## 4. The hymn composer: how it actually works

The owner asked how this could be implemented. A hymn tune is a small,
highly conventional form, which makes it an excellent target for
**constraint-guided generation**:

1. **Choose the frame** (a few dice):
   - a **meter** (CM 8.6.8.6, LM 8.8.8.8, SM 6.6.8.6, 8.7.8.7, 7.6.7.6 D,
     11s, 10.10 with refrain);
   - a **form** (AABA, ABAC, ABCD, AA′BA, verse-refrain);
   - a **dialect**;
   - a **mode of time** (§6.3);
   - a **key**.

   The meter gives the lines, the syllables per line and the stress pattern
   (CM is iambic: da-DUM da-DUM).
2. **Plan the skeleton before any notes.** For each line:
   - a **cadence target**: typically line 1 open (a half or imperfect
     cadence), line 2 arriving somewhere (V or the relative), line 3
     departing, line 4 home;
   - the **peak**: the highest note of the tune, placed at 60–75 % of the
     way through, usually in line 3;
   - a **contour** per line (arch, descent, climb).
3. **Rhythm first.** Map the syllables onto the mode of time: long notes on
   stressed syllables, a longer note at each line end, and optional pickups.
   The rhythm cell library (§6.3) gives the dialect its feel.
4. **Melody by guided search.**
   - **Candidates:** for each line, generate many candidate melodies
     (say 200) with the improviser (§6.2). They are seeded from the day's
     gestures, so the hymns of a meeting share material with its motifs.
   - **Scoring**, with weights per dialect:
     - singability: range within an octave and a fourth, mostly steps,
       leaps recovered by a step back;
     - hitting the cadence target;
     - the peak where planned;
     - contour fit;
     - relation to the other lines (A lines match or answer A lines, B lines
       contrast);
     - a *memorability* term: some repetition of a rhythmic or melodic cell
       inside the tune.
   - **Result:** the best-scoring line wins. It costs milliseconds, done
     while the previous section plays.
5. **Harmonize** with the dialect's harmonizer (§3), backwards from each
   cadence, then voice-lead and add non-chord tones.
6. **Criticize and repair.** A final check for a boring tune (too few
   distinct pitches, no peak, predictable rhythm), for a voice-leading
   error, or for a tune too close to one of the Earth tunes or to another
   hymn in the meeting. A tune that fails regenerates that line (bounded;
   there's always a fallback).
7. **Name it.** The hymn gets a number and a Deseret name for the hymn board.

**Why this will sound like real hymns and not like wandering:** real hymn
tunes are made of exactly these constraints (lines, cadences, a peak, a
singable range, repetition), and the search keeps only candidates that obey
them. The existing motif engine keeps its role: it develops material *around*
the hymns (organ interludes, the clarinet's obbligato, harmonium answers,
the guests).

**How much the composer writes versus draws from Earth tunes:**
- Most meetings sing one or two composed hymns and one **Earth tune**
  (§10.2), in the meeting's dialect.
- The mix gives each meeting both the familiar and the new, and every visit
  gets new composed hymns.

---

## 5. The cast: a ward of individuals

Draft 2 imagined 20–40 singers at once, which would be crowded and expensive.
Instead, Kolob gets **a cast of named people**, and each visit seats a
different ward.

### 5.1 Two layers
- **The congregation:** the massed singing, rendered as 4–8 **desks**
  (small groups sharing formant filters, each slightly detuned and delayed).
  This sounds like a room full of people without being a room full of
  oscillators. **Owner ruling (2026-09-26): phones get the same congregation
  as desktop, with no fewer voices.** If a phone struggles, simplify
  elsewhere first.
- **The cast:** 8–12 **individuals per meeting**, drawn from a roster of
  about 40 archetypes. Each has a Deseret name, a voice (formant set,
  vibrato, breath, age), a pitch habit, a timing habit, confidence, a
  melodic habit (a signature gesture, a favourite ornament) and a role.
  Individuals come forward *one or two at a time*, so the texture never
  crowds.

### 5.2 The roles

| role | what they do | what you hear |
|---|---|---|
| **the chorister** | announces and keys each hymn, sets the tempo, holds the fermatas, cuts off | a hummed or sung keynote before each hymn ("fa… sol… la"); a personal tempo and rubato; how long the holds last |
| **the organist** | registration, preludes, interludes, modulations, the postlude voluntary | a *playing style*: the Victorian who adds suspensions, the plain one who plays four-square, the improviser who wanders into Ivesian territory |
| **the precentor** | lines out in dialect F and at testimony | an ornamented solo line, then the ward's slow reply |
| **the soloist** | a verse alone (the "treble verse"), the descant on the last verse | one voice over the room |
| **the old bass** | sings a little flat and a little late, with a huge low voice | the floor of the room, lagging |
| **the harmony alto** | knows every part, carries the inner voice | the alto line suddenly clear |
| **the enthusiast** | too loud, slightly sharp, joyful | one bright voice poking through |
| **the child** | sings the tune an octave up, loses the words, finds them again | a small voice riding the melody |
| **the newcomer** | doesn't know the tune; joins on the second line | a voice arriving late |
| **the testimony-bearers** (2–3) | at the testimony, each *rises and speaks* | a pitched speech-melody (the voice's natural contour, as in Steve Reich's *Different Trains*), which the harmonium then **doubles as melody**: the speaker's words become music |
| **the band** | the brass band's players (§8) | — |
| **the Primary** | the children's choir (§8) | — |

### 5.3 Why this is rich within one meeting and varied across visits
- **Within one meeting:** you *meet* people. The testimony has a person in it.
  The alto is noticeable in the second hymn, the child in the third. The
  organist's style colours every joint.
- **Across visits:** a different ward is seated every time. A plain
  organist and a fast-Sunday precentor sound nothing like a Victorian
  organist with a gospel quartet.
- **The event log names them in Deseret:** "𐐑. 𐐐𐐰𐑊 rises", "the organist
  pulls the vox humana".

### 5.4 Singing practices
Each is performed by the cast:

- **Singing the notes:** the Sacred Harp first verse on *fa sol la mi*.
- **Lining out:** the precentor's line, the ward's slow heterophonic reply.
- **Keying:** the chorister's pitch before each hymn.
- **Descant:** the soloist on the last verse of a Tabernacle hymn.
- **Echo:** gospel; the men answer.
- **Refrain:** gospel and camp meeting, with rising energy each time.
- **The hollow square:** in dialects A and B the four parts face each other,
  and the stereo field puts them on four sides.
- **The amen:** per dialect.

### 5.5 Long-term threads (after the core)
- **Characters with a life inside the meeting:** the newcomer who can't
  sing the first hymn joins confidently by the doxology.
- **The testimony as the meeting's emotional centre:** a speaker whose
  speech-melody becomes the theme the doxology quotes.
- **Deseret phoneme singing (§6.5)**, which gives the cast *words*.

---

## 6. Melody, rhythm, breath

### 6.1 The gesture book
- **Tags.** The 27 cells gain `modes` and `trad` tags: Sacred Harp plain
  tune, fuging tune, camp-meeting chorus, gospel refrain, Scots-Irish
  ballad, Old Way lined hymn, pioneer hymn, Shaker song.
- **New cells** end off the tonic, open in minor, and leap in gapped scales.
- **Draws** are weighted by the dialect's mode, and cells heard earlier in
  the same meeting are held back.

### 6.2 The improviser (from ZANKYŌ's melodic DNA, recut)
- **Step tables per mode:**
  - Ionian 7→8;
  - Sacred Harp minor without a leading tone (♭7 falls, or leaps home);
  - pentatonic la–sol–mi and the 5→1 leap.
- **Contour plans**, cadence formulas, and "three in ten don't rhyme".
- **It reads the harmony**, pulling toward chord tones on strong beats.
- **Used by** the composer, the clarinet, the harmonium, the organist's
  interludes and the precentor's ornaments.

### 6.3 Rhythm: the modes of time
Sacred Harp's *modes of time* (the slow 2/2, 4/4 and 2/4 common modes, the
3/2 and 3/4 triple modes, and compound 6/8) become rhythm cells.

- **Added to them:** the gospel dotted figure, the camp-meeting lilt, the
  Old Way's melisma, the band's march, and the Social Hall's reel.
- **Tools:** `fitCell`, which changes rhythm without changing density, and a
  `rerhythm` transform added to Kolob's set.

### 6.4 `pourIntoLine` 2 and breath
- **No more scale-walk padding.** Lines are filled by sequence, by a
  fragment of the day's theme, or by melisma.
- **Line ends follow the cadence plan.**
- **Breath** happens at the text's commas, with per-meeting breath
  patterns (ZANKYŌ's *ma*, translated), and the whole ward breathes together.

### 6.5 Deseret phoneme singing (long-term roadmap; owner: yes)
- **The idea.** The Deseret alphabet is phonemic: one letter, one sound. When
  the choir sings a hymn verse set in Deseret, each syllable can drive real
  vowel formants and consonant bursts. The choir then sings the actual sound
  sequence of the words, heard as vowel colour rather than intelligible
  English.
- **The approach:** overlapping syllable voices, each with fixed formants
  (crossfaded), which respects today's rule that biquads never chase
  automation.
- **Verses in meter.** `kolob-text.js` learns to write metered hymn verses,
  and the engraving underlays them (the mockups show this).
- **A `vowel-lab` first**, then the chorister's keying on syllables, the
  precentor, and the cast.

---

## 7. Time and form within one meeting

### 7.1 The calendar: a different Sunday each visit
Each seed draws **a Sunday of the colony year**. There is no progression
across visits; the calendar exists for variety. The draw weights:

| Sunday | share | its character |
|---|---|---|
| **Ordinary** | ~45 % | the house style varies |
| **Fast Sunday** | ~15 % | testimony-heavy and sparse; dialects A and F; the precentor |
| **General Conference** | ~12 % | three hymns, the choir, full organ, Tabernacle |
| **Pioneer Day** | ~8 % | brass band, gospel ring, the Social Hall |
| **Christmas** | ~6 % | shape-note carols, bells, the Primary |
| **Easter** | ~6 % | the brightest light, Tabernacle in full, the Hosanna possible |
| **A wedding** | ~4 % | gentle, a love song, a soloist |
| **A funeral** | ~3 % | hopeful: slow, then rising; "all is well" |
| **A dedication** | ~1 % | the Hosanna, full organ, conference forces |

The Sunday sets the house dialect, the meeting's shape, the cast's size,
the guest weights and the organ registration. The wheel of the order of
service can letter the day at its rim.

### 7.2 The Kolob reckoning, made to pay off in one meeting and sound good
- **The concept.** In the Book of Abraham, one of Kolob's days is a thousand
  of Earth's years. Kolob moves slowly.
- **In practice:**
  1. Before the meeting, the composer picks the tune the ward will sing in
     the **doxology**: a composed hymn, or an Earth tune.
  2. The first 7–9 notes of that tune become a **slow cantus**: *one note
     per section*, carried by the drone and the organ's softest pedal stop.
  3. **Each section's key is chosen so the cantus note is consonant with it**
     (the tonic, fifth or third of the section's key). The harmony is never
     fighting the drone; the key plan is shaped by the cantus.
  4. At each section joint, the drone **glides** to its next note under the
     joint's hush: a slow portamento of 4–6 s, which is the audible "turn"
     of the meeting.
  5. **The payoff.** In the doxology, the ward sings the tune *at normal
     speed*. It is the melody the drone has been spelling all meeting, one
     note per section. An attentive listener feels the recognition; a casual
     one hears a drone that moves with purpose and a doxology that feels
     inevitable.
- **Keeping it sounding good:**
  - the drone's glide happens only under hushes and joints, never under a
    hymn line;
  - if a section's dialect wants the drone silent (Tabernacle), the cantus
    note moves to the 16′ pedal pianissimo, or simply rests;
  - `hymn-lab` auditions it before it ships;
  - if it ever sounds forced, the fallback is to use the cantus only for the
    key plan, with no audible glide.

### 7.3 The arc of light: dawn to full daylight
Kolob's answer to ZANKYŌ's descent into darkness: **each meeting rises.**

- **The prelude and invocation are dawn:** plain registrations, open
  fifths, dialects A, E and F more likely, a low keynote.
- **The hymns and testimony are morning:** fuller harmony, the cast comes
  forward.
- **The sacrament is stillness:** the lowest point, before the sun clears
  the horizon.
- **The doxology is full light:** Tabernacle and gospel richness, sevenths
  and the ringing chord available, the full organ, the cantus sung.
- **The postlude is evening:** the organist's voluntary, then the drone.

The arc is a set of weights over the dialects, registrations and harmonic
vocabulary per section; it replaces today's fixed intensity curves. The
doxology "sunrise" becomes its natural climax.

### 7.4 Scenes and seatings
- **Seatings per section**, with a rule that no two sections in a row are
  empty:
  - "lined out only";
  - "brush arbor" (no organ, open fifths);
  - "organ voluntary";
  - "the choir alone";
  - "the treble verse";
  - "the men's verse";
  - "the Primary".
- **Sub-scenes inside hymns:** a single-part verse, a fuge, a refrain with
  rising energy, an organ interlude between verses.
- **Continuous intensity:** a crossfade of 8 s or more between sections,
  replacing the jump at every joint.

---

## 8. The guests, built out

A meeting carries 0–2 guests (about 55 % carry at least one). Each guest:

- has its own random stream and draws unconditionally;
- has a seat preference and a length cap;
- holds the section joint;
- has weights per Sunday;
- has its own internal variation, so a guest heard on two visits is never
  the same event.

**Guest odds per meeting are tuned so that on any visit something
surprising is likely.**

### 8.1 The Unanswered Question (Phase 1)
*After Charles Ives, 1908: a trumpet asks "the perennial question of
existence"; flutes attempt an answer, more frantically each time; the strings
play on, oblivious.*

- **The seven questions.** Seven are *generated* per seed in the old one's
  spirit, and the old phrase (sol–la–re′–ti–re′) is kept as one of them.
  One is drawn per meeting. Each generated question:
  - is five or six notes, rising and angular, with a leap of a sixth or
    seventh;
  - ends high and unresolved, on a degree outside the tonic triad, with the
    last note the highest or second highest;
  - has the long–short–short–long–held rhythm family;
  - never matches a line of any hymn in the meeting.

  A small evaluation step rejects bland candidates.
- **Three askings.** The first and last are verbatim; the middle one is
  bent (one note displaced, or the rhythm shifted).
- **The answerers.** The harmonium, and the clarinet as a second answerer
  from the second asking on. They argue in *the meeting's own material*
  (fragments of today's hymns, developed): faster, higher and more
  scattered each time. The doublings snap into the lattice.
- **The ground.**
  - **Most often:** the drone alone.
  - **One time in three:** Ives's actual device, the **strings playing a
    slow chorale from the meeting's hymns at their own tempo, oblivious**.
- **Seat:** the invocation, testimony, sacrament or interlude, or the
  postlude (a question left hanging as the room empties). It is capped at
  about 45 % of its section and never runs past the section's end.
- **In the log:** "? the question" … "? unanswered".

### 8.2 Two bands crossing (reworked)
*After Ives's memory of two marching bands passing each other in the Danbury
town square, each in its own key and tempo (as in* Putnam's Camp*).*

- **Who plays:** the **Nauvoo Brass Band** (the Saints' band that crossed the
  plains), with cornets, alto horns and tuba.
- **What it plays:** a march **composed in real strains** (AABB, with a trio)
  from one of the meeting's hymns turned into a march.
- **How it collides:** it enters from one side of the stereo field, in its
  own key (a fifth or fourth away) and its own tempo, swells, crosses and
  recedes. The meeting carries on regardless. The collision is the piece.
  The loop is gone.
- **Variation:** which hymn, which key, the march or quickstep tempo, the
  direction of travel, and whether a second band arrives (rare; the vision
  "Putnam's Camp" has three).
- **Engraving:** round notes on their own scrolling layer (in the mockups).

### 8.3 The steeples (extended)
Bells from distant steeples phasing against the home bell, as today, plus
**change ringing**:
- English method ringing (Plain Hunt or Plain Bob) on 5–6 bells;
- a centuries-old algorithmic art in which the bells swap places each row;
- beautiful, mathematical, and genuinely generative.

**Engraving:** the ringers' own "blue line" notation.

### 8.4 The old tune
- **The Earth form.** A hymn from the Earth-tunes library (§10.2), heard
  faint and far off, as if from a wax cylinder three thousand years old.
- **The answer:** the ward answers with that tune in the meeting's dialect.
- **Variation:** which tune, which dialect it's answered in, and whether it
  is only the head or a whole line.

### 8.5 Variations on a hymn (new)
*The noon organ recital, and Ives's* Variations on "America" *(1891, written
at 17, full of jokes).*

- **What happens:** the organist takes a hymn from the meeting through
  **3–5 variations**, each a character:
  - a plain chorale;
  - a trio with the melody in the pedals;
  - a minuet;
  - a polonaise;
  - a march;
  - a **bitonal interlude** (the tune in two keys at once, Ives's own joke);
  - a canon;
  - a final grand statement on full organ.
- **Seat:** the prelude or postlude (the organist's own time).
- **Variation:** which hymn, which characters, and the organist's style
  (§5.2).
- **Purpose:** the showpiece for organ registrations.

### 8.6 The gift of tongues (new)
*Early Latter-day Saint meetings (Kirtland, 1830s) recorded singing in
tongues; Shaker "vision songs" were received in wordless syllables.*

- **The singer:** a single cast member rises and sings a free, melismatic
  song in syllables no one knows: Deseret phoneme sequences outside the
  lexicon. Before §6.5 exists, this is the vowel choir.
- **The ward's answer:** it hums the song's last note as a chord, and the
  harmonium softly takes up its opening.
- **Variation:** the singer's voice, the mode, the length, and whether the
  song becomes the next hymn's melody (the composer can seed from it).
- **Seat:** the testimony, most often on fast Sundays.

### 8.7 The Primary (new)
*The children's organization of the Church (1878). Children's songs are
simple, bright and unison.*

- **What happens:** a treble choir of 6–10 children sings a short unison
  song in dialect E, with handbells.
- **Its humour:** one child is a beat late, one enthusiastically sharp, and
  the youngest sings the tune an octave down, lost.
- **Composition:** composed fresh (a short verse-and-chorus in 6/8 or 2/4).
- **Seat:** the prelude, or before the sacrament. Christmas and Easter
  weight it heavily.

### 8.8 The far ward (new)
*Ives's distant choirs; Henry Brant's spatial music, with ensembles placed
around a hall.*

- **What happens:** a second congregation elsewhere on the ship, or on
  another world, sings the *same hymn* a line late. It is heard across
  distance: filtered, delayed, in its own slightly different tuning
  (its drift, §3.6).
- **The effect:** antiphony across the colony, and the hymn doubled into a
  canon at a distance.
- **Variation:** the delay (half a line to a full line), the distance
  (filtering), the other ward's dialect (they may sing it Sacred Harp while
  we sing it Tabernacle), and the side.

### 8.9 The Social Hall (new, rare; replaces the postlude)
*Brigham Young encouraged dancing. The Saints built social halls, and pioneer
companies danced on the trail.*

- **What happens:** after the benediction the benches are pushed back.
  A **fiddle** (bowed-string synthesis with 7-limit double stops), a
  **caller's rhythm** and a reel or quadrille, made from one of the
  meeting's hymns turned into a dance tune.
- **The mood:** pure joy, and the ending you'd least expect.
- **Weights:** Pioneer Day, jubilee, weddings.

### 8.10 The gulls (new, whimsical)
*The miracle of the gulls, 1848: gulls descended on the crickets devouring the
settlers' crops.*

- **What happens:** a flock of synthesized gull cries crosses the meeting.
- **The joke:** heard closely, the cries trace the head of the meeting's
  first hymn.
- It is short, an Ivesian nature-quote.

### 8.11 The handcart company (new)
*1856–60: pioneers pulled handcarts across the plains, singing "Come, Come,
Ye Saints" (ALL IS WELL).*

- **What happens:** a company of singers passes through the field in the
  distance, walking. The cart wheels give a rhythm, and ALL IS WELL is sung
  in unison, approaching and receding.
- The pastoral cousin of the bands.

### 8.12 The Hosanna (Easter and dedication only; audio-only, unlogged)
- **The source:** the Hosanna Shout, a sacred ritual of temple dedications:
  the congregation, waving white handkerchiefs, shouts "Hosanna, Hosanna,
  Hosanna, to God and the Lamb" three times, and then sings "The Spirit of
  God" (a hymn from 1836).
- **Rendered respectfully, per the owner's wish:**
  - **a massed crowd texture:** the desks shouting in unison rhythm on
    vowel formants, three times, with the room;
  - **then the hymn:** full organ and full congregation, Tabernacle
    dialect.
- **Unlogged.** It emits **no event log entry and no direction on the hymn
  board**. It just happens, low-key.
- **Engraving:** the hymn is engraved normally; the shout is not engraved.

### 8.13 Guest budget and variety
- **Pacing:** guests are scheduled so a meeting never has two in adjacent
  sections.
- **What each Sunday leans toward:**
  - Fast Sunday: tongues, the Question, the far ward.
  - Conference: variations, the far ward, bands.
  - Pioneer Day: bands, handcart, Social Hall.
  - Christmas: Primary, steeples.
  - Easter and dedication: Hosanna, steeples.
- **A dev-only guest switch** forces any guest in `guest-lab`.

---

## 9. Visions: the far tail, described by what you'd hear

Most meetings (about 80 %) are "home": everything above, varied. About one
visit in five drifts further out, and one in fifty is a **named vision**.
The name is printed on the hymn board in Deseret. Each is a real American
experimental idea applied to a hymn meeting:

| vision | what you'd hear |
|---|---|
| **Well-Tuned** (La Monte Young, born in Bern, Idaho) | The drone slowly takes over. The ward holds one 7-limit chord that grows richer for minutes, the hymns become ornaments inside it, and the meeting ends inside a single ringing sound. |
| **The Jargon** (Billings, 1778) | A hymn composed with deliberate discord: seconds and tritones on the strong beats, sung with total conviction. Billings wrote it as a joke against his critics. |
| **Putnam's Camp** (Ives) | Three brass bands in three keys and three tempos cross the meeting at once, while the ward keeps singing. Glorious chaos. |
| **Apartment House** (Cage, 1976) | Hymns sung with notes *removed by chance*: the chords become sparse, strange constellations, and the silences between become the music. |
| **Tempo canon** (Nancarrow) | The four parts sing the same hymn at four different speeds and converge on the final chord at the same instant. |
| **The Kolob Day** | The whole meeting is one hymn, stretched so each syllable lasts a minute, a vast slow chorale. The reckoning, taken literally. |
| **Light-delay** | The congregation is spread across light-seconds: each part is heard later than the one before, and the hymn smears into an echoing canon of itself. |
| **The Comma Pump** | The unaccompanied ward drifts sharp and never comes back. Over the meeting it rises a whole tone, and the organ, when it finally enters, is shockingly low. |
| **Otonality** (Partch) | The hymns in 11-limit just intonation: strange, sweet intervals between the piano's keys. |
| **In Kolob** (Riley's *In C*) | The cast each walk through the hymn's lines as repeating modules at their own pace, a shimmering pulse of hymn fragments. |
| **The Council in Heaven** | Every hymn of the meeting sung at once, each at its own tempo (Ives's densest imaginable meeting), resolving into the doxology. |
| **Deep Listening** (Oliveros) | The ward hums the room's own resonances. The meeting becomes the sound of the tabernacle itself. |

**How it works:**
- **ZANKYŌ's far-tail machinery:** a distance per seed, with departures
  unlocking by threshold. Each vision has its own random stream, and
  incompatible visions exclude each other.
- **Named visions** are the extreme ones.
- **Home meetings are untouched.** Adding a vision never changes a home
  meeting.
- **Measured:** a light distance metric, so a vision is distinct but
  never unlistenable.

---

## 10. Sound world, and the Earth tunes

### 10.1 Sound: only what the composition needs
- **Finish PLAN-ONE-ROOM phases C–E:** shared resonators, shared slow
  modulation, early reflections.
- **Organ registrations** per dialect, Sunday and section:
  - principal, flute, vox humana with tremulant, reed, full organ with
    mixtures;
  - a swell box;
  - the organist's style (§5.2).
- **New voice families, only as needed:**
  - congregation desks;
  - individual cast voices;
  - children;
  - the precentor;
  - a brass band (cornets, alto horns, tuba);
  - a fiddle;
  - handbells;
  - gulls;
  - the change-ringing peal;
  - cart wheels.
- **Hollow-square stereo** for dialects A and B.
- The bagpipe stays shelved.

### 10.2 The Earth tunes: a transcription workstream (a separate Opus agent)
A dedicated agent, run at the right moment (before Phase 2's composer ships,
since the composer checks tunes against them). The owner reviews its output.

1. **Re-transcribe the existing seven** from authoritative public-domain
   sources: ALL IS WELL, KINGSFOLD, BETHANY, FOUNDATION, NETTLETON, SIMPLE
   GIFTS, GOD BE WITH YOU. The owner's TODO at `kolob-audio.js:2619` notes
   they are mis-transcribed.
   - Full tunes, not incipits: all lines, with rhythm, meter, mode and the
     original harmony where it exists.
   - Each is cited to its source (a hymnal edition and year).
2. **Add about 8–12 public-domain American hymn tunes** of the families
   Kolob draws on. Every candidate is to be verified as public domain, with
   its source cited, by the transcription agent:
   - shape-note: NEW BRITAIN, WONDROUS LOVE, PISGAH, IDUMEA, HOLY MANNA,
     BEACH SPRING, CONSOLATION (KEDRON), PROMISED LAND, CORONATION;
   - older pioneer-era LDS hymns whose tunes are public domain (for example
     "The Spirit of God", "Redeemer of Israel", "High on the Mountain
     Top").
3. **One data file** (`kolob-tunes.js`) that the engine, the composer and
   `tune-lab` all read: degrees, rhythm, lines, meter, dialect, source and
   notes.
4. **A `tune-lab` review page** where the owner can hear and see each tune
   engraved, and flag corrections.

---

## 11. Phases

Each phase ships with a VERSION bump and a listen.

| phase | content | you'll hear |
|---|---|---|
| **0 — Foundations** | modules, separate random streams, the clock, the Score, the lattice, typed events, bug fixes, harness (including the distinctness measure), labs, one re-base | the bug fixes |
| **1 — The Question** | seven generated questions, three askings, seats, length cap, answers from the meeting, the strings' chorale ground | a Question that is different on each visit and never overstays |
| **2 — Composer and styles** | the hymn composer; dialects C (home), A and F, then B, D and E; voice-leading 2; non-chord tones; cadence planning; keys per hymn; drift; the Earth-tunes workstream feeds in here | **the biggest change:** real hymns, in six idioms |
| **3 — The cast** | congregation desks; the 8–12 individuals and their roles; the chorister's keying; the organist's styles; singing practices; testimony speech-melody | people in the room |
| **4 — Guests** | the Question is done; bands reworked; steeples and change ringing; old tune; variations; tongues; Primary; far ward; Social Hall; gulls; handcart; Hosanna | something surprising on most visits |
| **5 — Form and light** | the Sunday calendar; the Kolob reckoning with its doxology payoff; the arc of light; seatings and sub-scenes; continuous intensity | a meeting that rises, and a different Sunday each visit |
| **6 — Visions** | the far tail and the named visions | rarely, something astonishing |
| **7 — Words** | Deseret phoneme singing, metered verses, underlay | the choir singing words |
| **E — Engraving** | PLAN-ENGRAVING, after the owner picks a direction from the mockups; runs alongside Phases 2–5 once the Score exists | the page |

**Order:** Phases 0 and 1 first. Then the composer (2) before the cast (3),
because the cast needs real hymns to sing and parts to carry. The guests (4)
can start in parallel with 3; many don't depend on the cast. After Phase 0,
the build can run as a worktree fleet, since the modules give each crew its
own files.

## 12. How we'll know (light checks, then the ear)

- **Distinctness:** 20 random seeds' first three minutes are pairwise
  distinct (dialect, keynote, tempo, registration, cast, guest, pitch and
  rhythm profiles). No near-twins.
- **The Question:** three askings; it never crosses a section boundary; it
  varies across seeds.
- **Cadences:** the plagal share tracks the dialect mix (high in Tabernacle
  meetings, zero in Sacred Harp ones), overall 30–55 %.
- **Hymns:** every composed tune has a peak, a cadence plan it meets, a
  singable range, and no line identical to an Earth tune.
- **Dialect fingerprints are distinct:**
  - A: parallel fifths and chords without a third;
  - C: sevenths, suspensions and inversions;
  - D: 7-limit chords;
  - F: heterophony.
- **Voice-leading:** 0 % voice crossing except where a dialect allows it;
  every sounded pitch in the lattice.
- **REPRO:** identical scores under jitter.
- **Budget:** CPU within budget at 4× throttling on mobile (desks scale down).
- **The owner's ear.**

## 13. Decisions

**Settled (owner, 2026-09-26):**
- **Visions:** about 1 in 5 meetings drifting and 1 in 50 named, as a
  starting point to tune by ear.
- **Guests:** about 55 % of meetings carry one, also a starting point.
- **The Social Hall** may end a meeting.
- **Build out, don't rework:** see §1.1.

**Open:**
1. **The engraving direction:** from the mockups (A, B, C).
