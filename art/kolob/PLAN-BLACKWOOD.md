# PLAN — THE OTHER HOUSES: Easley Blackwood at the rim of Kolob's light

*Draft 1, 2026-09-30, from the owner's request: "incorporating some of
Blackwood's influence … in a tasteful and deliberate fashion," true to Kolob
as it stands (v0.36.1) and to Blackwood's own ideas. Nothing here is built.
Nothing is built from this plan until the owner has read it; the tunings go
into the meeting only after the owner has heard them in the lab (§6, gate 1).*

Background: `PLAN-COMPOSITION.md` (§2.4 the lattice, §3 the dialects, §8 the
guests, §9 the visions), `SCORE.md` (§2 pitch, §5 the Score, §12 the guest
budget), `PLAN-EXECUTION.md` (crews, critics, the owner's gates).

---

## 0. Who Blackwood was, and what of his belongs here

Easley Blackwood Jr. (1933–2023), composer, pianist and theorist at the
University of Chicago. Three things of his are the material of this plan.

1. **The Twelve Microtonal Etudes for Electronic Music Media, Op. 28
   (1979–80).** On a National Endowment for the Humanities grant he set out
   to find the harmonic and modal properties of every equal tuning from 13 to
   24 notes to the octave, and wrote one study in each, on a Polyfusion
   synthesizer. He likened the set to a sequel to the *Well-Tempered
   Clavier*: one piece per tuning, each written **for** its tuning's own
   structure, never a 12-note piece squeezed into another grid. Some tunings
   held a recognizable diatonic scale and he wrote them tonally; the rest
   (13, 14, 15, 16, 18, 20, 21, 23) he had to invent scales for. Of the
   19-note tuning he wrote: "This tuning contains diatonic scales in which
   the major second spans three chromatic degrees, and the minor second two.
   Triads are smooth, but the scale sounds slightly out of tune because the
   leading tone seems low with respect to the tonic." His *Fanfare in
   19-note Equal Tuning* (1981) leans on "the characteristically superior
   consonance of 19-note major triads"; his *Suite for Guitar in 15-note
   Equal Tuning*, Op. 33, took what the 15-note étude found onto a refretted
   acoustic guitar, in four dance-like movements.
2. **The theory: *The Structure of Recognizable Diatonic Tunings* (Princeton,
   1985), and "Modes and Chord Progressions in Equal Tunings" (*Perspectives
   of New Music* 29/2, 1991).** A diatonic scale stays *recognizable*, with
   its modes, cadences and voice-leading intact, as long as the fifth that
   generates it lies strictly between four sevenths and three fifths of an
   octave (about 686 to 720 cents). Inside that range the whole tone is two
   fifths less an octave and the diatonic semitone is three octaves less
   five fifths, and the ratio of the two sets the scale's character. Which
   intervals are *consonant* is a separate question: 19 has sweet thirds and
   a low leading tone; 22 has bright fifths and two kinds of third, a comma
   apart; 17 has good steps and hard thirds. The 1991 article describes his
   methods in 15, 16, 17 and 19, including 15's five-note circle of 720-cent
   fifths, whose 240-cent step is ambiguously a tone or a minor third.
3. **The tonalist and the Ivesian.** After 1981 Blackwood turned to a
   deliberately late-nineteenth-century tonal syntax (he named Verdi, Ravel
   and Franck), and as a pianist he was a champion of Charles Ives: the
   *Concord* Sonata from memory on the same program as Boulez's Second.
   Microtonality, for him, was never strangeness for its own sake. It was a
   way of asking what tonal, singable, recognizable music each tuning
   allows. That is the spirit to import: **the tuning is a place with its
   own grammar, and you write the hymn the place allows.**

*What this section takes as read, and what the reading agent (§7, wave 0)
must verify against the sources before any of it is asserted in code or in
the minutes: the 19-note quotation, the Fanfare and Suite descriptions, the
NEH grant, the Polyfusion, the 1991 article's contents and the recognizable
range are from published sources found on 2026-09-30 (the Cedille booklet
for *Easley Blackwood: Microtonal*, the Wikipedia and Xenharmonic Wiki
articles, the Boston Musical Intelligencer's obituary); the per-tuning
characters beyond 19 are the coordinator's recollection and must be read
from Blackwood's own notes, not repeated from memory.*

---

## 1. The fit, and the one tension

**Kolob's tuning is Blackwood's opposite, on purpose.** The house sings
5-limit just intonation over a drone that never moves (La Monte Young, PLAN
§2.4); every pitch is an exact ratio and the composer's comma search leans
notes by 81/80 so that no chord is sour. Blackwood's tunings are *equal*: no
interval but the octave is pure, and the music is written to what the grid
allows. Making the house tempered would be a rework, not a build-out
(PLAN §1.1), and it would undo the clarity the owner has spent rounds on.
**So the house stays as it is.** Temperament enters Kolob the way everything
strange already does: **as a place at a distance, heard against the
drone.**

Kolob already has the frame for that. The Nauvoo band plays "in its own
key … with nothing to do with the meeting's time" (`kolob-guest-bands.js`).
The far ward sings "in its own tuning (a little sharp or a little flat of
ours, and drifting)" (`kolob-guest-farward.js`), and its header says it
outright: *the colony is many settlements.* The old tune sings "a wolf leap
pure." Ives heard two bands in two keys; Kolob can hear two houses in two
tunings. And Blackwood's own thesis is what makes it cheap to build:

- The composer writes in **degrees** and harmonizes by **dialect**
  (`kolob-composer.js`, `kolob-dialects.js`); the exact pitch is assigned
  last, by a comma search (`tuneLineParts`). In Kolob's words, "the monzo is
  the truth; the degree is the spelling" (SCORE §2).
- A *recognizable* tuning is one where those degrees, cadences and
  voice-leadings still mean what they mean. So the **same composer, the
  same dialects and the same hymnists** can write a hymn for 19, 22 or 17
  notes; only the last step changes: degree to *step* instead of degree to
  monzo, and the comma search becomes a search over the tuning's own comma
  (one step in 22; none in 19, which is a meantone; none in 17).
- The staff already places a composed note by its written degree
  (`keyedQ` in `kolob-viz.js`), so a tempered hymn prints where it should
  with no new signs, which keeps the owner's rule (v0.32: no signs on the
  staff).

**The fiction.** The colony is many settlements, and not every
meetinghouse organ came up in the same hold. At the rim of Kolob's light,
three thousand years from Earth, one settlement's organ-builder divided the
octave in nineteen, so that every third is sweet and the leading tone sighs
into the tonic; another, across the valley, in twenty-two, bright-fifthed,
with one third for the tune and another for the chord; a third house sings
unaccompanied on seventeen, its semitone a hair, its thirds neither major
nor minor, lined out the Old Way. **The other houses.** Some Sundays our
organist plays a hymn from one of their books; some Sundays the ward across
the valley is one of them. The house's own drone is the ground every one of
them is measured against, and the return to our own tuning after they have
gone is the payoff.

---

## 2. The tunings, and the marriages

Only Blackwood's **recognizable** tunings enter the meeting proper, and each
is married to the dialect whose habits make its weakness invisible and its
strength audible. The arithmetic (f the fifth in steps; L, s the whole tone
and the diatonic semitone; the comma the difference between four fifths
less two octaves and the tuning's nearest 5/4):

| notes | fifth | L · s | chromatic step | the third | comma | Blackwood's finding (to verify) | Kolob's marriage |
|---|---|---|---|---|---|---|---|
| 12 | 7 · 700 c | 2 · 1 | 1 | 400 c | 0 | the familiar | the reference in the lab only |
| 17 | 10 · 705.9 c | 3 · 1 (212 / 71 c) | 2 | 353 c neutral, or 424 c | 1 | strong steps, poor triads | **the Old Way and the Shakers**: the tune alone, lined out, ornamented; no thirds to bruise; the neutral third as an ornament |
| 19 | 11 · 694.7 c | 3 · 2 (189 / 126 c) | 1 | 379 c (7 c under 5/4); minor third 316 c, all but pure | 0 | smooth triads, the leading tone "seems low" | **the Tabernacle**: warm thirds, suspensions, the Victorian organ (19 is nearly the 1/3-comma meantone a 19th-century builder knew); the low leading tone becomes the sigh of the cadence |
| 22 | 13 · 709.1 c | 4 · 1 (218 / 55 c) | 3 | 436 c by the scale, 382 c a step under it | 1 step (55 c) | two kinds of third; bright fifths | **the Sacred Harp and the psalmody**: bare-fifth closes, parallel fifths, the tune in the tenor; the comma search picks the 382 c third for a chord and leaves the scale's 436 c to the melody, so the "two thirds" are heard as material |
| 13, 14, 15, 16, 18, 20, 21, 23, 24 | not recognizable (or 24, which contains 12) | | | | | invented scales, each its own | **visions only** (§4.C), never guests |

Gospel's ringing sevenths (4:5:6:7) survive only in 22 (18 steps, 13 c
sharp of 7/4) and are left out of the first round.

**Against the drone.** The keynote is shared: a unison is a unison in every
tuning, so the drone never has to move. A tempered fifth beats slowly
against the drone's third partial: about 7 cents flat in 19, 7 sharp in 22,
4 sharp in 17, which at the keynote's fifth is a beat of roughly one and a
half a second. That beating is *the sound of the distance* and is to be
measured and kept, not hidden; the crew gets one knob (the drone stepping
back under a tempered guest, as it does under a keyed hymn, to 0.22).

---

## 3. The rules of taste (binding)

1. **Composed for the tuning, never retuned.** A tempered hymn is written by
   the composer with `temperament` in its order, its steps chosen by the
   tuning's own comma search. No hymn is ever converted by nearest step.
   (Blackwood composed; he did not transcribe.)
2. **The house stays just.** Our organ, our ward, our drone and our joints
   never temper. Temperament is always *another house's* book or organ, and
   it arrives and leaves.
3. **It is named.** The minutes say whose book it is and how many notes;
   the programme card's mode line carries the count (Deseret capitals, the
   numeral in Latin, as the house rule has it); the direction rubric says
   it while it sounds. Nothing prints on the staff but the notes.
4. **It returns.** Every tempered event is followed, inside the meeting, by
   the same hymn (or the same house) in our own tuning: the organist's
   étude on the first hymn, then the ward sings it; the far ward's verse,
   then ours. The design laws of PLAN §0 hold: the payoff is in the meeting.
5. **Recognizable tunings only** in the meeting; **one tuning at most** in a
   meeting; **one tempered guest at most**, and it counts as the
   organist's showpiece where the organist plays it (never beside the
   variations).
6. **Rare in proportion.** About one Sunday in twenty hears another house
   at all, more at General Conference and a dedication (the organist shows
   off) and on fast Sundays (the far settlements), never at a funeral, never
   on a withheld Sunday. The band's 36 % is untouched.
7. **Behind a switch.** `KOLOB.Experimental.temperaments`, on by default,
   so the owner can retire the whole thing in one word (`?exp=-temperaments`
   for a visit).
8. **No seed shifts.** Every die on a new fork (`guest:etude:<n>`,
   `guest:farward:<n>` → `tuning`); a meeting that seats no tempered guest
   plays note for note as it does today, and the A/B tally proves it.
9. **Silent testing**, every claim measured (the fifth's cents read from
   the captured WAV; the grid check in the harness), the substrate
   untouched, crews staging named paths, VERSION bumped by the integrator
   at merge.

---

## 4. The three vehicles, in build order

### A. The organist's étude (the study, in the room)

Blackwood's own form is the étude on an instrument: a study of what one
tuning allows. Kolob's organist already has the prelude on the day's first
hymn and the variations after a hymn sung. **The étude is the organist
playing a hymn from another house's book.**

- **When.** In the prelude on the day's first hymn, as the chorale prelude
  is seated today (`preludeDraw`, `choraleSeating`): the organist plays the
  hymn through once, 40–70 s, in the house whose dialect the hymn is
  written in (19 for a Tabernacle hymn, 22 for a Sacred Harp or psalmody
  one; an Old Way or Shaker hymn takes the Seventeen only on the ward's
  side, §B, since the organ does not accompany them). Or in the postlude on
  a hymn the ward has just sung, as the variations are seated.
- **What you hear.** The organ sounds *different* for a minute: sweeter and
  sighing (19), brighter with its odd thirds (22), and the drone underneath
  says how far off it is. Then, in the prelude, the ward sings the same
  hymn in our tuning, and the house comes home (design law 2: the first
  hymn heard before it is sung, and in another house's voice). In the
  postlude the study simply ends, and the meeting closes on our tuning.
- **How.** A guest room in the round-3c pattern, `kolob-guest-etude.js`:
  `plan / decide / prepare / perform`, pure, on `guest:etude:<n>` (forks
  `seat`, `shape`, `count`, `synth`); `prepare` asks the hymnal's desk for
  the hymn *again* with `temperament` (the same seed and label, so the
  tempered hymn is the composed hymn re-tuned by the composer's own search,
  not a nearest-step copy), and hands `KOLOB.Organist.prelude` (or
  `accompany` without the ward) a plan whose `hz` reads steps. Seated by
  the meeting beside the chorale prelude and the variations, as a
  showpiece; `GUEST_ODDS.etude` row; `FORCEABLE.etude`; `?guest=etude`. The
  organist's `cast` rows: *plays it from the nineteen-note book*, *brings it
  home*. Direction rubric: IN 19 NOTES. A card in a `guests4-lab`.
- **A small second nod (optional, same crew):** a character `tempered` in
  the improviser's variations set (§8.5), one variation in the other house's
  count between two of ours, the organ retuning under the listener's ear and
  back. Blackwood as one of Ives's variations. Only if A is in hand.

### B. The far ward from another house (the distance)

The ward across the valley (§8.8) already sings our hymn a line late, in a
harmonization of its own dialect, a little sharp or flat and drifting.
**On some of its Sundays it sings from its own book: in 22 (a Sacred Harp
house), 19 (a Tabernacle one) or 17 (an Old Way one, lined out).** Two
tunings in canon at a distance: Ives's far choir and Blackwood's other
grid in one event, and the human drift kept on top of the grid so that it
is a ward singing, not a synthesizer.

- **How.** `kolob-guest-farward.js` draws `count` on a new fork `tuning`
  of `guest:farward:<n>` (about half its Sundays: the seat's own draw);
  `Composer.setTune(…, { temperament })` sets the tune in their dialect on
  their grid; their `hz` reads steps; `cents` and `drift` stay. The
  far-ward row in the minutes names the count; the `farward.verse` stage
  carries it. Its notes on the staff print by written degree as now.
- **Odds.** The far ward comes in about three meetings in a hundred. The
  crew reports what share of those the tempered far ward takes and
  proposes, in its handoff, whether the far ward's row in `GUEST_ODDS`
  should rise on fast and Conference Sundays so that the other houses are
  heard; the owner decides.

### C. The Etude Sundays (the visions, later)

PLAN §9 reserves about one visit in fifty for a named vision, printed on
the hymn board, and lists *Otonality (Partch)* and *The Comma Pump* among
them. **Blackwood gives that list its first built members:**

- **The Nineteen, the Twenty-two, the Seventeen:** a whole Sunday in one
  recognizable tuning: the hymnal's every hymn, the organ, the ward, the
  joints; the drone on the keynote; the reckoning off (its cantus is a
  chain of just intervals); named on the board. A meeting that is itself
  one of Blackwood's études.
- **The far counts (13, 15, 16, 23 …):** the visions proper, built on the
  scale structures Blackwood invented for them (the 1991 article; the
  étude notes): 15's five-note circle for the handbells and the Social
  Hall's fiddle (his own guitar suite is the precedent), 16 and 13 for the
  strings' chorale and the gulls. These need the visions' scaffolding
  (distance per seed, exclusions, the board's name) that Phase 6 has not
  built, and they come only after A and B have been heard.

---

## 5. The contract changes (SCORE.md §13, the integrator's)

- **Pitch (§2).** `KOLOB.Pitch.temperament(n)` → `{ edo, fifth, L, s,
  chromatic, comma, recognizable, stepOf(deg, alt), hzOf(keynoteHz,
  keyMonzo, step) }`, pure. `recognizable` is Blackwood's condition.
  `Hz = keynoteHz × ratio(keyMonzo) × 2^(step / edo)`: the key stays the
  day's just key (the house's), the hymn's steps stand on it.
- **The Score (§5).** `Hymn.temperament: null | { edo, house }` and
  `Note.step` (an integer, present only on a tempered hymn). `Note.monzo`
  stays the *spelling's* 5-limit monzo, so every reader that never heard
  of temperament (the staff, the harness's spelling check, the fingerprint)
  keeps working; `Note.comma` becomes the step shift the search made. The
  proofreader checks `step` against the spelling by the generator, and
  refuses a `step` on an untempered hymn.
- **The performers.** Where a Score note becomes hertz, `step` wins when
  the hymn is tempered: the cast's `hz(monzo, oct)` (`kolob-cast.js`), the
  organist's `hz(m)` (`kolob-organist.js` → `organistPlays`), the far
  ward's `base * ratio(monzo)`. Three small edits; the voices themselves
  take hertz and need nothing.
- **The composer.** `compose(opts.temperament)` and
  `setTune(opts.temperament)`: the frame, the skeleton, the search and the
  dialect's harmonizer unchanged; the tuning pass generalized so the comma
  is the temperament's (`tuneLineParts` → the step grid). The fingerprint
  reports `temperament`.
- **Events (§6).** `hymn-announced.hymn.temperament`; `guest-start
  { guest: "etude", count, house }` and stages `begins`, `returns`;
  `farward.verse` gains `count`; the organist's `cast` actions above.
- **Streams (§3).** `guest:etude:<n>` (`seat`, `shape`, `count`, `synth`);
  `guest:farward:<n>` → `tuning`; the hymnal's desk takes an order with
  `temperament` on the *same* `hymn:<n>:<i>` label (the tempered hymn is
  the hymn).
- **The calendar.** `GUEST_ODDS.etude` (a row; Conference and a dedication
  high, funerals 0), `GUEST_BUDGET.showpieces.etude`, `order` after the
  variations. `KOLOB.Experimental.temperaments`.

---

## 6. The gates

- **Gate 1, after wave 1: the owner's ear in the tuning lab.** Nothing is
  seated in the meeting until the owner has heard one hymn in JI, 12, 17,
  19 and 22, on the organ and by the ward, with and without the drone, and
  said which counts and which marriages go in. (The room and the engraving
  direction were chosen this way; the tuning should be too.)
- **Gate 2, after wave 2: the listening packet.** `handoff/listen-v037.md`:
  a seed and a minute for each house, the odds table, what it costs, what is
  left for the ear. VERSION bumps at merge; nothing publishes without the
  owner's word.
- **Wave 3 (the visions) is proposed only after gate 2**, as a brief of its
  own.

---

## 7. How the agents build it

Run as PLAN-EXECUTION §6 has it: one coordinating session as integrator; each
wave a Workflow run (the owner opts in with "use a workflow" and the
`workflow-authoring` skill writes the script); every `agent()` at
`effort: 'xhigh'`; crews in worktrees on their own ports; **at most two
critic rounds per milestone**; a handoff note per crew in `handoff/`;
muted Chrome only; named paths staged, never `git add -A`; nothing merges
to `main` before the owner has listened.

### Wave 0 — the reading and the contract (2 agents, in parallel, half a day)

| agent | reads | writes | done when |
|---|---|---|---|
| **R, the reader** (WebFetch on a machine whose network allows it; this session's could not reach the sources) | the Cedille booklet for *Easley Blackwood: Microtonal* (the composer's own notes on each étude, the Fanfare and the Suite); *The Structure of Recognizable Diatonic Tunings* (the recognizable condition, the 17/19/22 chapters); "Modes and Chord Progressions in Equal Tunings" (1991); the obituaries | `critic/blackwood-notes.md`: the condition and the arithmetic for 12–24 (checking §2's table), each tuning's character **in his words, cited**, the structures he used in the non-recognizable ones, a fit table tuning ↔ dialect with reasons, three risks | every claim in §0 and §2 is either confirmed with a citation or struck; no invented quotation |
| **I, the integrator** (the coordinating session) | this plan, R's notes, SCORE §2, §5, §12 | `SCORE.md` §13 (from §5 above), this plan's draft 2 | the owner has read both |

### Wave 1 — foundations and the ear test (1 crew serial, its critic, then the owner)

| crew | owns | builds | checked by |
|---|---|---|---|
| **TUNE** (1 builder, 1 critic) | `kolob-pitch.js`, `kolob-score.js`, `kolob-composer.js` (the tuning pass and the two opts), `tuning-lab.php/.js`, the harness's grid check | `Pitch.temperament`; the proofreader; `compose`/`setTune` with `temperament`; **the tuning lab** in the hymn-lab pattern: one seed, one dialect, the hymn played in JI, 12, 17, 19, 22 on the pipe organ and by the ward, side by side, the drone on or off, the numbers printed (the fifth and the third in cents, the beat against the drone) | the harness: every sounded pitch of a tempered hymn on its grid; REPRO; **an A/B tally of 60 seeds against `git:main` showing nothing moved** for untempered orders; the composer's checks pass on tempered hymns in every dialect × count; the critic's one round |

**Gate 1.** The owner listens in the lab and rules on the counts and the marriages.

### Wave 2 — into the meeting (3 crews in parallel with their critics, about 8 agents, two days)

| crew | owns | builds | checked by |
|---|---|---|---|
| **ETUDE** | `kolob-guest-etude.js`, `guests4-lab.*`; requests to the integrator for `kolob-meeting.js` (the seat beside the chorale prelude and the variations), `kolob-calendar.js` (the row, the showpiece), `kolob-organist.js` (`hz` by step), `kolob-ui.js` (the rows, the rubric) | §4.A: the seat, the odds, the tempered order to the desk, the organist's plan by step, the return, the minutes' rows (Deseret via the cast's `deseret()` helper), the direction rubric, `?guest=etude`, the Experimental switch | its critic: the census (how often, on which Sundays, never at a funeral, never beside the variations, the budget's rules unbroken over 1,000 first meetings); `capture.js` on a forced seed measuring the organ's fifth and third in cents and the beat rate against the drone; the page at 860 and 390 with 0 console errors; the cost against a plain chorale prelude |
| **FAR** | `kolob-guest-farward.js`; a request for `setTune`'s use with `temperament` | §4.B: the `tuning` fork, the count, the set tune on the grid, drift kept, the row and the stage; the lab card | its critic: the far ward's tempered share and its proposal on the odds; the grid check on the far ward's notes; the canon's lag unchanged; a capture with both wards sounding, the two fifths read off the spectrogram |
| **ENGRAVE** (small) | `kolob-viz.js` (the rubric only), `tools/screens.js` | the count on the mode line; a probe that names a tempered note's step; screenshots proving the heads print by written degree, no signs | the Eye: 860 and 390, the frame at 4× |
| **I, the integrator** | `kolob-meeting.js`, `kolob-calendar.js`, `kolob-ui.js`, `SCORE.md`, `VERSION`, `_engine.php` | the merge; SCORE §13 adopted as built; `handoff/listen-v037.md`; the VERSION line, for example: *v0.37 — the other houses: some Sundays the organist plays the first hymn from another settlement's book, nineteen or twenty-two notes to the octave, and the ward answers in our own tuning; the ward across the valley may sing from its book too* | the whole-meeting harness runs (`300 7`, and forced `etude` and `farward` runs), the distinctness tool over 20 seeds, the census |

**Gate 2.** The owner listens to the packet; v0.37 goes live on their word.

### Wave 3 — the Etude Sundays (a brief, not a build)

After gate 2 the enrichment critic writes a one-page brief for §4.C (the
visions' scaffolding of PLAN §9, the three recognizable Sundays, the far
counts on Blackwood's invented scales, with R's notes as its source), and
the owner rules on it before anyone builds.

### The workflow, in outline

```
phases: Read → Foundations → (gate 1: stop, report to the owner) → Crews → Integrate
Read:        parallel([ R: blackwood-notes, I: SCORE §13 draft ])
Foundations: pipeline([ TUNE builder ], b => TUNE critic, ≤2 rounds)  → tuning-lab up on its port
Crews:       parallel([ ETUDE, FAR, ENGRAVE ].map(c => pipeline(build c, review c, ≤2 rounds)))
Integrate:   I merges, runs the harness and the tools, writes the packet and VERSION; the owner listens
```

Every prompt to a crew carries: this plan, `SCORE.md`, `PLAN-EXECUTION.md`
§0, `critic/blackwood-notes.md`, the silent-testing rule, the owner's word
to the agents in PLAN-COMPOSITION §15, and the crew's own row above.

---

## 8. What not to do

- Do not temper the house: not the organ under our hymns, not the ward, not
  the drone, not the joints. (A rework, and the owner's identity for Kolob
  is the just lattice.)
- Do not retune anything by nearest step, and do not call a JI hymn played
  on a tempered grid "Blackwood."
- Do not put accidentals, Johnston marks or a tuning sign on the staff (the
  owner's rule); the count goes on the card and in the minutes.
- Do not seat two tunings in one meeting, or a tempered guest beside the
  variations, or any of it at a funeral.
- Do not build the non-recognizable counts as guests; they are visions, and
  only after the owner has heard the recognizable ones.
- Do not edit `../prosperos-jukebox-v2/*`, and do not shift a seed that
  seats no tempered guest.

## 9. Risks, named

- **"It sounds out of tune."** Blackwood said so himself of 19's leading
  tone. The marriages of §2 put each tuning's weakness where the dialect
  has no ear for it (17 under unison, 22 under bare fifths, 19's sigh under
  a Victorian cadence); the lab gate lets the owner hear it before the
  meeting does; rarity and the return do the rest.
- **The drone's beating** may read as a fault rather than a distance. It is
  measured (the capture), and the crew has the one knob (the drone stepping
  back). If the owner still hears a fault, the étude can sit where the
  drone is already ducked, or the étude's seat can move to the postlude only.
- **Cost.** None new: the organ's tempered keys are the same nodes, the far
  ward's tempered throats the same throats. The desk writes one more hymn
  on Sundays with an étude (measured, off the audio path).
- **What is heard changes on the Sundays that seat a tempered guest**, as
  it did when round 3c's guests came. Every other Sunday is note for note
  the same, and the A/B tally proves it.
