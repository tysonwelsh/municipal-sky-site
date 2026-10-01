> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r3c-organ-1: variations on a hymn, and change ringing from a far tower

*Round 3c, guests B (PLAN-COMPOSITION §8.5, §8.3). Branch `kolob-r3c-organ`.
2026-09-29.*

**What is new to hear:** two new guests, each a module the engine can seat,
and a lab to hear them in. **Neither plays in a meeting yet**; the round-3c
integration step wires them in (the recipe is below, exact). Nothing was
pushed or published, and VERSION is not bumped.

- **Variations on a hymn.** The Sunday's organist takes one of the meeting's
  composed hymns through three to five characters on the pipe organ: a plain
  chorale (the theme), a trio with the tune in the pedals, a canon, a minuet,
  a polonaise in the minor, a march, an **interlude in two keys at once**
  (Ives's joke), and a grand final statement on the full organ. The
  organist's style chooses them and plays them: the plain organist a short
  set, straight-faced; the Victorian a long one, the minuet on the vox humana
  and the march on the trumpet, to the full organ and the amen; the
  improviser always plays the tune in two keys at once, runs flutes over the
  pedal tune, sets his canon at the fifth, and ends on a chord with a tone
  added high. About two minutes (1–3); in the prelude (on the day's first hymn)
  or the postlude (on a hymn the ward has sung); about one meeting in ten.
- **Change ringing from a far tower.** A variant of the steeples: the
  meetinghouse bell has the first word, then across the valley a band rings
  rounds, "Go", Plain Hunt or Plain Bob on five or six tower bells (a plain
  course, or a touch with bobs) until the bells come round, "That's all",
  rounds, "Stand" — and the meetinghouse bell has the last word. Every row is
  generated from the method's place notation and verified. Tower bells, not
  handbells: the hum an octave down and the minor-third tierce. At a funeral,
  half-muffled. Thirty seconds to two minutes; about half the Sundays the
  steeples ring.

**Nobody has listened.** Every check below is a measurement made with the
sound muted (headless Chrome with `--mute-audio`, offline renders, and Node).

---

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8172 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3c-organ`
2. Open **http://127.0.0.1:8172/art/kolob/guests3b-lab.php**
3. Pick a **seed** and a **dialect** (Tabernacle, Sacred Harp, gospel,
   psalmody — the organist needs a hymn in parts). The composer writes the
   hymn; its name shows under the controls.
   - **Variations:** choose the **organist** (or leave it to the seed), and
     **characters** (as the organist draws them; all eight as a
     demonstration; or the theme and one character alone). Press
     **▶ play the variations**; the plan lights the character sounding.
   - **Change ringing:** choose the **bells** (six: Minor; five: Doubles; six
     with the tenor covering), the **ring** (Plain Hunt, a plain course, a
     touch), **muffled**, and which bell's **blue line** to draw. Press
     **▶ ring** (with the meetinghouse bell first and last) or **▶ the tower
     alone**. The rows are drawn as ringers draw them: a lead to a column,
     the treble's path in red, one working bell's in blue.

A link can carry the settings: `guests3b-lab.php?seed=2&dialect=tabernacle&style=improviser`
(keys `seed`, `dialect`, `key`, `room`, `style`, `chars`, `stage`, `piece`,
`muffle`, `blue`).

### What to listen for (times from ▶, as the lab plays them)

| link | what it is | listen for |
|---|---|---|
| `?seed=2&dialect=tabernacle&style=improviser` | Orrin Vance, the improviser, on NEW HANDCART (2:38) | **0:00** flutes running on the first chord; **0:03** the theme on the principal and the 4′; **0:39** a canon *at the fourth below*, the answer on the trumpet one beat behind; **1:13 the interlude in two keys**: the hymn on the mixture alone (bright, glassy) and, a beat behind, the tune again a minor third away on the principal with its own bass in the pedal — two keys at once, each whole, then both last chords held together; **1:31** a march, off-beats on a 4′ flute with an added sixth (a country band's harmony); **1:48** the finale on the full organ, the tune doubled an octave up, ending on a chord with a tone added high |
| `?seed=7&dialect=sacredharp&style=victorian` | Adelia Thorne, the Victorian, on a Sacred Harp tune, GARDEN GROVE (2:00) | **0:02** the theme: the tune in the tenor on the trumpet over soft flutes; **0:26 the minuet** on the trembling vox humana; **0:48** the interlude in two keys (a major third down, Ives's own relation), the other key on the trumpet three beats behind; **1:01 the polonaise in the minor**, the left hand in the dance's rhythm (an eighth, two sixteenths, four eighths), each line closing on the second beat; **1:29** the finale, building from the principal and mixture to the full organ |
| `?seed=11&dialect=gospel&style=victorian` | the Victorian on a gospel song, MANTI (2:32) | **0:30 the trio**: the tune down in the pedals (principal and a whisper of trumpet over the 16′), two lines above it on two manuals; **0:53** the minuet on the vox humana; **1:30** a march on the trumpet |
| `?seed=11&dialect=gospel&style=plain` | Hyrum Tanner, the plain organist (1:58) | a short set, straight-faced: the theme; **0:26** a canon at the octave, three beats behind, over a tonic in the pedal; **0:50** the polonaise in the minor on the principal; **1:22** the finale |
| `?seed=2&chars=bitonal&style=victorian` | the theme, then the interlude alone | the quickest way to the joke |
| `?seed=1&stage=minor&piece=touch`, **▶ ring** | Plain Bob Minor, a touch of 36 with three bobs | rounds; "Go"; the bells changing places a pair at a time; a bob (at the lead end a bell makes fourths place instead of seconds, and the order the bells come round in is turned); rounds come back of their own accord; the meetinghouse bell last |
| `?seed=2&stage=doubles&piece=course` | Plain Bob Doubles, the plain course (40 changes) | five bells, a lighter ring |
| `?seed=3&stage=covered&piece=hunt` | Plain Hunt on five with the tenor covering | the deep sixth bell last in every row, the beat under the changes |
| `?seed=5&stage=minor&piece=hunt&muffle=on` | half-muffled, as rung for a funeral | every other row (the backstrokes) a soft, dull echo of the one before |

**The one-bell check** (the ringing card's **one bell, its partials**) strikes
the tenor once open and once muffled, dry, and reads the partials off the
spectrum: the difference between a tower bell and a handbell is right there
in the table.

**The main questions for the owner's ear:**
- Do the variations sound like an organist showing off, charmingly, or like a
  machine? Is the interlude's two-keys joke funny, or merely wrong?
- Is a set (about two minutes) too long for a prelude or a postlude?
- Does the far tower sound like a tower across a valley — too near, too far,
  too loud? Is the minute or two of ringing welcome, or should it be shorter?

---

## What shipped

| file | what |
|---|---|
| `kolob-organist.js` (additive) | **`Organist.variations(organist, hymn, stream, opts)`** — the organist's variations, pure: the characters (`VAR_CHARS`), drawn and ordered by the style (`VAR_POOL`), each fitted to its share of the set's length by trying fewer lines on a scratch plan with the same dice, laid end to end; the dances re-barred from the tune's own stresses (`rebar`); the polonaise's minor; the interlude's two-key search; the level (`VAR_LIFT`, `VAR_DYN`, `VAR_DYN_STYLE`). Nothing that existed was changed: the organist lab's prelude, hymn and modulation are as they were (the lab loads clean). |
| `kolob-guest-variations.js` (new) | **`KOLOB.GuestVariations`**: `plan`, `decide`, `prepare`, `score`, `perform`, `harmonized`; `ODDS`, `SEATS`, `HARMONIZED`, `ACTIONS`, `ACTION_DS` (the organist's new doings, in the ward's Deseret) |
| `kolob-guest-changes.js` (new) | **`KOLOB.GuestChanges`**: place notation (`parse`, `apply`), `METHODS` (Plain Hunt, Plain Bob; Doubles and Minor), `rows`, `verify`, `touches`; `plan`, `decide`, `prepare`, `score`, `perform`; the tower bell (`tower`, `PARTIALS`, `MUFFLE`); `ODDS`, `LEVEL` |
| `guests3b-lab.php`, `guests3b-lab.js` (new) | the bench: both guests live and offline, checks against their references, the plan read character by character, the ringers' rows with the red and blue lines, one bell's partials, purity, the odds |
| `kolob-voices-pipeorgan.js` | **unchanged** — the organ's seven stops and the organist's eighteen registrations were enough for every character |
| `archive/handoff/r3c-organ-1.md` | this note |

Commits on `kolob-r3c-organ` (after `39c9b3b9`): `d8944d95` the variations
planner · `2087b7ac` the interlude made audible · `eb9048a1` the variations
guest · `dad145bb` the ringing's rows and verifier · `75f7bf0e` the ringing
guest and the tower bell · `50f137e6` the lab · `df730ceb` the tower's voice
its own, one bell measured · `feb77635` levels set by measurement, the
ringing's end click mended · `8d57757c` the plain organist's theme and finale ·
and this note.

---

## Variations on a hymn

### The characters, and how each organist plays them

| character | what it is | the plain organist | the Victorian | the improviser |
|---|---|---|---|---|
| **the theme** (always first) | the hymn as written, a plain chorale | the principal, four-square | the principal; suspensions at the closes, passing notes, the swell breathing with the lines | the principal and the 4′ |
| **trio** | the tune in the pedals (principal and a whisper of trumpet at 8′, the 16′ under it); two lines above on two manuals | the Score's own inner parts, on the flutes and one quiet flute | the inner parts with passing notes | running flutes (in twos or threes to the beat) over the hymn's chords, the alto held under them |
| **canon** | the tune chasing itself over a tonic held in the pedal; the lag chosen (1–4 beats) as the one that grates least | at the octave below | at the octave below, the answer on the flutes | at the fifth or the fourth below, the answer on the trumpet; now and then the second-best lag |
| **minuet** | in three: the bass on the downbeat, two soft chords after it, detached | the flutes | the tune on the vox humana over trembling flutes | the mixture alone, glassy and high |
| **polonaise** | in three, stately, **in the minor** (a major hymn's mi, la and ti lowered 25/24; the dominant keeps its leading tone); the left hand in the dance's rhythm; each line closing on the second beat, the step above leaning on the first | the principal | the trumpet over the principal and 4′ | the principal and mixture |
| **march** | in two, brisk: the pedal's oom-pah (root, then fifth), chords on the off-beats; one or two bars to step off | the principal | the trumpet | the trumpet; the off-beats on a 4′ flute with an added sixth |
| **interlude in two keys** | the hymn in its own key in three parts above; below, a beat or three behind, the tune in **another key** with that key's middle part and its own bass in the pedal; both keys' last chords held together | now and then (weight 0.35); Ives's relation, a major third down, two beats behind, as printed | about half his sets; a major third down most often | **always**; his own stray key (a tritone, a third, a whole or half step) |
| **the finale** (always last) | the hymn again, broad, on the full organ | the full organ | from the principal and mixture to the full organ, the tune doubled an octave up, the swell opening, and the plagal amen (7 in 10) | the full organ, the tune doubled, a tone added high over the last chord |

The organist's **way in**: the Victorian's first chord with the swell opening
on it (6 in 10), the improviser's flutes running on the first chord (half the
time), the plain organist none. The set is drawn to a length of 105–165 s;
each character takes the lines that fit its share (the whole tune; its head
and home; the first two lines; the first). A dance's tune is **re-barred from
its own stresses**: each stressed syllable (the Score's `Note.stress`) opens a
bar; the notes of its foot share the bar by the dance's cells; unstressed
notes before the first stress are its pickup; the harmony under each new beat
is the hymn's own chord at that point of the tune. So the minuet, the
polonaise and the march are the hymn's own tune and harmony, re-danced.

### Distinct, measured (pure, over 180 sets: 4 dialects × 15 seeds × 3 organists)

- **Characters per set:** 3 in 32 sets, 4 in 76, 5 in 72.
- **Stops:** 3–10 different registrations in a set (median 7).
- **Every pair of characters in a set, by six marks** (metre; beat, ±15 %;
  stops; key or mode; keys a second, ±30 %; register, ±300 c): 1,272 pairs —
  differing in 1 mark: 58; 2: 184; 3: 387; 4: 324; 5: 280; 6: 39. The pairs
  differing in one mark are almost all **the theme against the finale**, by
  design (the finale is the theme restated on the full organ, broader, the
  tune doubled, the amen — louder and brighter, which these marks do not
  count). One kind was a real weakness and is mended: the plain organist's
  theme could draw the same flutes as his minuet (his theme is now always
  the principal).
- **The interlude is heard in two keys.** Over 60 interludes (4 dialects × 5
  seeds × 3 organists), the share of the sounding moments (sampled every
  50 ms, two or more tones sounding) whose pitches fit **no single just major
  scale**: **32–91 %, median 71 %**. The other characters: the theme 0–4 %,
  the minuet 0–2 %, the march 0–1 %, the finale 0–3 %. The planner itself
  searches for this: the style's second key and lag are kept if they are
  heard in two keys at least 30 % of the time, else the other keys (4/5, 5/4,
  16/15, 45/32, 6/5) are tried and the most bitonal kept; the lag is the one
  that grates *most* (the canon's search, turned round). Each key's last chord
  is sounded whole (two bare fifths a third apart had been heard as one key).
  The lab's **read the plan** prints this share for each character.
- **The polonaise is minor:** over 72 polonaises on major hymns, no major
  third above the tonic sounds (0 s); minor thirds 11.7–18.5 s each.
- **Every pitch in compass:** 0 keys outside −3,700…+2,800 c of the keynote
  (the interlude's lower strand and bass had fallen too low in the first
  build: found by this check, mended).

### The level, measured

The organ layer at the owner's 0.40, through the app's chain, as seated (the
organ in both rooms at the prelude's balance). Two references, each rendered
alone in the same room: **the organist's own chorale prelude on the same
hymn** (the level the meeting already plays the organist at, measured there
in r3b-organ-1) and **the engine's organ** (organChord as the prelude plays
it). Nine sets, the three organists × a Tabernacle, a Sacred Harp and a
gospel hymn; the loudest 3 s (S3) and integrated (I), in LU against each:

| organist, seed, dialect | characters | S3 − prelude | S3 − engine organ | I − prelude's I | the characters' S3 against the prelude |
|---|---|---|---|---|---|
| plain 2 Tabernacle | theme, trio, finale | +1.6 | +1.2 | +0.5 | theme −0.3 · trio +1.6 · finale +1.5 |
| plain 7 Sacred Harp | theme, trio, finale | +1.5 | +0.1 | +1.3 | +0.8 · +1.5 · +1.1 |
| plain 11 gospel | theme, canon, polonaise, finale | +1.7 | +0.6 | +0.4 | +1.0 · −0.3 · −0.8 · +1.7 |
| victorian 2 Tabernacle | theme, bitonal, march, finale | +1.2 | +1.4 | −0.7 | theme −0.6 · bitonal −1.5 · march −2.9 · finale +1.2 |
| victorian 7 Sacred Harp | theme, minuet, bitonal, polonaise, finale | +1.2 | −0.4 | −0.4 | +1.2 · −2.1 · −0.4 · −2.3 · +0.9 |
| victorian 11 gospel | theme, trio, minuet, march, finale | +1.4 | +1.4 | −0.4 | 0.0 · −0.3 · −3.1 · −2.7 · +1.4 |
| improviser 2 Tabernacle | theme, canon, bitonal, march, finale | +1.3 | +1.7 | +0.2 | −1.1 · −0.2 · −0.1 · −1.2 · +1.2 |
| improviser 7 Sacred Harp | theme, canon, bitonal, polonaise, finale | +0.7 | +0.7 | −0.4 | 0.0 · +0.1 · −0.1 · −1.5 · +0.7 |
| improviser 11 gospel | theme, trio, canon, bitonal, finale | +2.1 | +1.7 | +1.1 | +1.1 · +1.7 · +0.1 · +1.3 · +2.1 |

**0 clicks and 0 clipped samples in every render** (the house's detector: 1 ms
blocks above 4 kHz standing 21.6 dB clear of the 30 ms either side). The
first build's finale on the full organ had stood 2.6–5.1 LU over the prelude
(up to 4.7 over the engine's organ): it is held back 3 dB (`VAR_DYN`), the
plain organist's 1.5 (`VAR_DYN_STYLE`, so his finale stays his set's climax),
and the Victorian's vox-humana minuet, 3.6–4.6 under, brought forward 1.5.
**The knobs:** `VAR_LIFT` (the whole set, by style), `VAR_DYN` (a character).

### The seat and the odds

- **The prelude** (on the day's first hymn, which the ward will then sing) or
  **the postlude** (on a hymn the ward has sung; the doxology's, or the last,
  twice as likely as each other). Weights 0.45 and 0.55; the moment 3–9 s
  into the prelude, 2–6 s into the postlude.
- **Odds:** `base 0.13 × the Sunday × the organist`, capped at 0.6. Sundays:
  ordinary 1, fast 0.35, General Conference 1.8, Pioneer Day 1.7 (Ives played
  his on a Fourth of July), Christmas 1.2, Easter 1.3, a wedding 1.1, a
  dedication 1.8, **a funeral 0**. Organists: plain 0.55, Victorian 1.1,
  improviser 1.4.
- **Refused:** at a funeral; when neither seat is free (§8.13: a seat is free
  only when neither it nor the section beside it holds a guest — the
  prelude's neighbour is the invocation, the postlude's the doxology); in the
  prelude, on a morning the tune is withheld (the cumulative form), when the
  organ sits out the morning (`organSits`), and when the day's first hymn is
  sung in unison; when every hymn today is in unison (the Old Way's lined
  tunes, the Shakers' songs — the variations need the Score's harmony); and
  never a round or a statement of the refrain. Every die is thrown first.
- **Measured** (the lab's odds, 20,000 meetings of a stand-in for the
  engine's planner): seated in **10.8 %** of meetings — the prelude 36 %, the
  postlude 64 %. By Sunday: ordinary 10.3 %, fast 3.7, Conference 17.6,
  Pioneer Day 16.3, Christmas 12.5, Easter 13.5, a wedding 10.3, a
  dedication 17.9, a funeral 0. By organist: plain 5.8 %, Victorian 12.5,
  improviser 15.4. Not seated: the dice 13,374; no seat free 2,787; every
  hymn in unison 1,089; a funeral 586. (The stand-in approximates the
  trombones', the singing school's and the handbells' dice; the harness
  should re-measure once the engine seats it.)

### What it costs (measured, not cut)

- **Planning** (`prepare`, pure; Node, 180 sets): 2 ms at the median, 11 ms at
  worst. In the meeting it is made ready at its cue, as the handbells are.
- **Laying out** (the lab's live context, muted Chrome, the improviser's
  2:38 set): 9.9 ms of main thread at the press, then a slice a second laid
  2.5 s ahead, the largest 2.5 ms. In the meeting the plan goes to the
  organist's own desk (`organistPlays`), which already lays every organ plan
  a few seconds ahead a pump at a time.
- **The organ:** 1,700–5,100 pipes built over a set, **at most 69–119 alive
  at once** (5–8 nodes a key) — about what the organist's hymn holds (r3b-
  organ-1: 110–115). One organ case, 13 standing nodes, or none of its own in
  the meeting (the organist's case).
- **Offline:** a 2½-minute set renders in about 45 s in muted headless
  Chrome on this Mac (the tabernacle's convolver included), some 3× realtime.

---

## Change ringing from a far tower

### The rows (the art, verified)

- **Methods** in place notation: **Plain Hunt** (Doubles `5.1.5.1.5.1.5.1.5.1`,
  Minor `x16x16x16x16x16x16`) and **Plain Bob** (Doubles
  `5.1.5.1.5.1.5.1.5.125`, Minor `x16x16x16x16x16x12`); a bob is `145`
  (Doubles) or `14` (Minor) at the lead end. The rows are generated by
  applying the notation, change by change, from rounds.
- **Checked against the published rows:** Plain Bob Minor's first lead is
  123456 214365 241635 426153 462513 645231 654321 563412 536142 351624
  315264 132546, lead head **135264**; Plain Bob Doubles' is 12345 21435 24153
  42513 45231 54321 53412 35142 31524 13254, lead head **13524**; the plain
  courses are **60** and **40** changes; Plain Hunt comes round after 2n rows.
  (The first build's Minor lead lacked its last `x` and rang 11-change leads;
  this check found it.)
- **`verify(rows)`** checks the rules on the rows themselves: every row a
  permutation of the bells; from row to row every bell stays or changes
  places with a neighbour (no jumps, no swap without its partner); the touch
  **true** (no row rung twice) and **coming round** only at its end; the
  treble **hunting** (2, 3 … n, n, … 1, 1 in every lead). A tampered row is
  caught (Node: one row reversed mid-touch fails on the jumps and the
  truth); the lab's purity card verifies three styles.
- **Touches** are found by ringing them: every pattern of plain leads and bobs
  up to six leads that comes round at its last lead end, and is true —
  Minor: 36 (bob, bob, bob), 60 (the plain course), 72 (two bobs, three
  ways; not rung);
  Doubles: 20 (two bobs), 40, 60 (two ways). The band rings touches no
  longer than the plain course.
- **400 ringings** (seeds 1–400), every one verified; lengths **31–132 s**
  (median 81; p10 39, p90 117). The pieces: Plain Hunt 16 %, a plain course
  48 %, a touch 36 %; the stages: Minor 45 %, Doubles on five 25 %, Doubles on
  six with the tenor covering 30 %.
- **On the clock:** a stroke every 0.20–0.26 s (a lighter ring rings
  quicker), each row a stroke a bell, and before each handstroke row the open
  handstroke lead (a stroke's silence), as English ringers ring; rounds
  (4–8 rows) before "Go" (called at the handstroke before the method's first
  change), "Bob" two rows before a called lead end, "That's all" as rounds
  come up, 4–6 rows of rounds, "Stand". A steady band strikes within ±7 ms,
  a fair one ±16 ms, now and then a bell a shade late (sound-level: the
  reported strokes are the written ones).

### The tower bell (not a handbell), measured

The ring is a major scale down from the treble (six: la sol fa mi re do;
five: sol fa mi re do), **justly tuned** (5/3, 3/2, 4/3, 5/4, 9/8, 1) on a
tenor at the day's keynote, a fifth or a fourth from it (or a third, rarely),
between 196 and 330 Hz. Each bell is the English true-harmonic bell's
partials — hum ½, prime, **tierce 1.2 (the minor third)**, quint 1.5,
nominal 2, deciem 2.5, superquint 3, upper octave 4 — the hum, tierce and
nominal doubled a fraction of a hertz apart so the bell shimmers; each rings
at its own rate (the hum longest), and a stroke adds a short knock of the
clapper. **One bell alone** (the lab: the tenor, 196.5 Hz, dry, 0.25 s after
the stroke; dB under the loudest):

| partial | × the note | open | 2.5 s on | muffled |
|---|---|---|---|---|
| hum | 0.5 | −4.3 | −5.7 | −15.3 |
| prime | 1 | 0.0 | −5.6 | −8.3 |
| **tierce** | 1.2 | **−3.5** | −8.2 | −23.1 |
| quint | 1.5 | −10.9 | −22.2 | −26.7 |
| nominal | 2 | −0.3 | −12.1 | −25.7 |
| deciem | 2.5 | −14.3 | −34.1 | −45.3 |
| superquint | 3 | −10.1 | −32.7 | −41.5 |
| upper octave | 4 | −19.0 | −54.1 | −54.8 |

The handbell (kolob-voices-folk.js) is a fundamental and its exact twelfth;
the tower bell has the minor-third tierce 3.5 dB under its prime and a hum an
octave down that is the loudest thing left after 2.5 s. Muffled, the nominal
falls 25 dB and the upper partials go.

**Far off:** the tower's own bus down a lowpass (1.4–2.7 kHz by the drawn
distance), the wind moving its level ±1.2 dB every few seconds, an echo off
the far hillside (0.22–0.47 s, darker, from the other side), the tower at a
field edge (pan ±0.45–0.85, its bells spread ±0.08 across the frame), into
the tabernacle's wide send (the steeples' visitors' way). **Half-muffled at a
funeral:** every backstroke row muffled (a funeral seats the ringing at 1.3×
its ordinary odds, so it is heard).

### The level, measured

As seated: the tower into the tabernacle's wide send alone; the steeples as
the meeting rings them now (a copy of `steeplesAnswer`: the meetinghouse bell
into the bells layer at 0.6 × ring 0.55, two far steeples at 0.42 of it down
a 2.4 kHz lowpass); the engine's organ as above. The loudest 3 s:

| ringing | against the steeples | against the engine's organ | clicks | clipped |
|---|---|---|---|---|
| Plain Bob Minor, a touch of 36 | −7.4 LU | +2.3 LU | 0 | 0 |
| Plain Bob Doubles, the plain course | −8.9 | +0.8 | 0 | 0 |
| Plain Hunt, Doubles with the tenor covering | −8.6 | +1.1 | 0 | 0 |
| Plain Hunt Minor, half-muffled | −10.3 | −0.6 | 0 | 0 |

The first build (`LEVEL` 0.2) stood **5 LU over the steeples and 15 over the
engine's organ**: far too loud for a far tower. It is now 0.03 — about the
organ's level, 7–10 LU under the meetinghouse bell, where the handbells and
the trombones sit. **The knob:** `LEVEL` in `kolob-guest-changes.js`.
**Clicks:** the first build clicked 2–3 times at the end of every ringing (the
oscillators stopped while the tenor's hum, τ ≈ 7 s, still sang); every
partial is now faded out over its last 2 s before its oscillators stop: 0.

### What it costs

- **Nodes:** 113–134 standing for the whole ringing (some 21 a bell: its
  partials and their gains, its own gain and place; and the tower's air), and
  3 short-lived nodes a stroke (the clapper's knock, gone in 50 ms), however
  long it rings — against the steeples' 20–22 new nodes a strike, each
  living 10 s.
- **Planning** (`prepare`, pure; Node, 400 ringings): 0.10 ms at the
  median, 0.96 at worst — once the touches are found. The search (126
  patterns a stage, both stages) takes **15 ms once a page**; it ran 68 ms
  over eight leads in the first build, and it would fall in a clock cue at
  the plan: so it is six leads now, and the engine should call
  `KOLOB.GuestChanges.warm()` at the PLAY press (Requests).
- **Laying out** (live, muted Chrome): 2.4 ms at the press (the tower's nodes
  built), then a slice a second, the largest 0.4 ms.
- **Offline:** 30–80 s of ringing renders in 2.5–6.3 s (≈13× realtime).

### The seat, as a variant of the steeples

The steeples keep their own dice and seat (kolob-meeting.js: about 7.5 % of
meetings × the Sunday's welcome, the prelude 55 % or the postlude). When they
ring, the **changes' die** (its own stream, `guest:changes:<n>`, thrown every
meeting) makes the far bells a band ringing changes: `base 0.5 × the Sunday`,
capped 0.85 — ordinary 1, fast 0.6, Conference 1.1, Pioneer Day 1.1,
Christmas 1.5, Easter 1.4, **a wedding 1.7** (ringing for a wedding is the
English ringers' oldest custom), a funeral 1.3 (half-muffled), a dedication
1.5. The ringing begins 3–6 s after the meetinghouse bell's first word.
Measured (the lab's odds): **56 % of the meetings the steeples ring, 4.5 % of
all meetings**; a wedding 87 %, Christmas 75 %, a fast Sunday 27 %.

---

## The integration recipe (for the round-3c integration step)

Both guests keep their own time (`cued`), take their material at their cue,
lay themselves out through `hooks.defer`, and the house listens while they
sound. **The variations replace** the prelude's morning (it is re-timed
after them, as the chorale prelude re-times it) or the postlude's house
voluntary, and they **exclude the chorale prelude** that morning. **The
change ringing replaces the far steeples** in `steeplesAnswer` when its die
says so; the meetinghouse bell keeps the first and the last word.

### 1. Loading (`_engine.php`)

After `kolob-guest-singingschool.js` (beside the trombones and the handbells):

```
kolob-guest-variations.js
kolob-guest-changes.js
```

`kolob-organist.js` (with `variations`) and `kolob-voices-pipeorgan.js` are
already in the engine. Both new files answer the load guard's roll call.

### 2. Planning (`kolob-meeting.js`, `planMeeting`)

**(a) Seat the organist earlier.** Move this one line up from the ward's
block to just after the hymnal block (after `emitEvent({ type: "hymnal", … })`
and the `C.payoff` line, before THE WARD'S HANDBELL CHOIR). It is pure, on
`cast:<n>`'s fork `organist`, so no die anywhere moves; `A`, `activity`,
`sunday`, `SUN` and `C.house` are all known there:

```js
var OR = KOLOB.Organist && S.castStream ? KOLOB.Organist : null;
if (OR) C.organist = OR.seat(S.castStream(C.meetingNum), { kind: activity, sunday: sunday, lean: SUN ? SUN.organist : null, houseDialect: C.house, bright: A ? A.bright : 0.5, ives: !!S.forceVisitation });
```

(and in the ward's block keep `C.organist = null`'s reset out of the way:
reset `C.chorale = null` there, not `C.organist`).

**(b) The variations**, after the handbells block, before THE HOSANNA:

```js
// VARIATIONS ON A HYMN (round 3c; PLAN §8.5): the Sunday's organist takes one
// of the meeting's hymns through three to five characters, in the prelude
// (the day's first hymn) or the postlude (one the ward has sung) — about one
// meeting in ten (kolob-guest-variations.js decides, on
// guest:variations:<n>, told who is already seated)
var GVg = KOLOB.GuestVariations || null;
if (GVg && C.organist && S.pipeOn && S.pipeOn()) {
  var gvStream = stream("guest:variations");
  var gvSeat = GVg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                          hymns: C.hymnal.map(function (r) { return { id: r.id, section: r.section, dialect: r.dialect, piece: r.piece }; }),
                          organist: { style: C.organist.style }, withheld: !!C.cumulative,
                          organSits: !!(C.seating && (C.seating.sits.organ || C.seating.hum)),
                          force: forcedType === "variations" }, gvStream);
  if (gvSeat) {
    var gvV = { type: "variations", section: gvSeat.seat, at: gvSeat.at, dur: gvSeat.dur, fired: false, cued: true, stream: gvStream, hymnId: gvSeat.hymnId };
    C.visitations.push(gvV);
    if (gvSeat.seat === "prelude") C.seating = variationsSeating(C.seating, gvV);
  }
}
```

(The die must be thrown whether or not the organ is the pipes: move the
`GVg.plan` call outside the `pipeOn` test if the owner's A/B `?organ=house`
should keep every other die in place — it does, since the stream is its own.)

**(c) The prelude re-timed** — beside `choraleSeating`, the same pattern:
the drone and the valley wake around the organist; the house (the organ's
own chords too) waits for the end of the set.

```js
function variationsSeating(seat, V) {
  var spec = SEATINGS.chorale, U = seat._u.U, at = {}, after = V.at + V.dur + 2;
  WAKERS.concat(["choir"]).forEach(function (l) { var r = spec.at[l] || CHOIR_CALL; at[l] = r[0] + (r[1] - r[0]) * U[l]; });
  Object.keys(spec.anchored).concat(["organ"]).forEach(function (l) { if (at[l] != null) at[l] += after; });
  Object.keys(at).forEach(function (l) { at[l] = +at[l].toFixed(2); });
  at.voice = seat.at.voice;
  var out = {}; for (var k in seat) out[k] = seat[k];
  out.name = "variations"; out.at = at; out.full = seat._u.fullU < spec.full; out.sits = {}; out.fifths = false; out.hum = null;
  return out;
}
```

with `SEATINGS.variations = SEATINGS.chorale;` beside the table (anything
that looks the morning's seating up by its name finds one), and in THE
CHORALE PRELUDE's `preludeDraw` info:
`guest: C.seating.name === "steeples" ? "the steeples" : C.seating.name === "school" ? "the singing school" : C.seating.name === "variations" ? "the organist's variations" : null`.
(`preludeDraw` then refuses: one recital a morning.)

**(d) The change ringing**, right after (b) — its own stream, thrown every
meeting; it only ever changes what the steeples ring:

```js
// CHANGE RINGING (round 3c; PLAN §8.3): when the steeples ring, some Sundays
// the far bells are a band ringing changes (kolob-guest-changes.js)
var GCg = KOLOB.GuestChanges || null;
if (GCg) {
  var gcStream = stream("guest:changes");
  var gcSeat = GCg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                          keynoteHz: S.F0 * S.ROOT_MULT, force: forcedType === "changes" }, gcStream);
  var stV = visitationOf("steeples");
  if (gcSeat && stV) { stV.stream = gcStream; stV.changes = { at: gcSeat.at, dur: gcSeat.dur, method: gcSeat.method }; }
}
```

and let the forced "changes" seat the steeples: in the steeples' block,
`if (forcedType === "steeples" || forcedType === "changes" || stDie)` (and
`forcedType === "changes"` seats them in the prelude, as a forced steeples
does). The section already yields to the steeples' span; the ringing's span
is returned by the set piece (below), so the prelude or postlude lasts as
long as the band rings (up to about 2¼ minutes with the bells' last word).

**(e) Forcing:** `FORCEABLE.variations = true; FORCEABLE.changes = true;`
(and add them to `setForceVisitation`'s names). **The house listens:**
`LISTENED.variations = true` (the steeples are landscape: not listened, as
now).

### 3. The cue (`kolob-meeting.js`)

In `cuedArrival`, beside the handbells': `if (V.type === "variations" && !V.material) variationsMaterial(V);`

```js
// THE VARIATIONS' MATERIAL: the hymn as the composer wrote it (waiting since
// the plan, or written now and counted), the Sunday's organist's set made
// ready (pure, on its own stream), and the section held for it exactly
function variationsMaterial(V) {
  var G = KOLOB.GuestVariations, h = V.hymnId && Hymnal() ? Hymnal().get(V.hymnId) : null;
  if (!G || !h || !C.organist) return;
  try { V.material = G.prepare({ hymn: h, organist: C.organist, keynoteHz: S.F0 * S.ROOT_MULT, seat: V.section }, V.stream); }
  catch (e) { V.material = null; if (window.console) console.warn("Kolob: the variations could not be made ready:", e); return; }
  V.dur = V.material.dur;
  var hold = (V.at || 0) + V.dur + 3;
  if (C.section === V.section) C.sectionDur = C.plan[C.si].dur = Math.max(C.sectionDur, hold);
}
```

### 4. The set pieces (`kolob-guests.js`)

`VISIT_FN.variations = organistVariations` (in `kolob-meeting.js`), and:

```js
// VARIATIONS ON A HYMN: the set on the organist's own desk — one organ
// throughout (organistPlays: the organ's case, the organ layer, its notes
// told in the Score's terms), at the prelude's level (no lift under a ward:
// nobody sings); a hymn keyed away from home steps the drone back under it,
// as the chorale prelude does
function organistVariations(V, tc) {
  V.meetingNum = S.Meeting.meetingNum();
  var G = KOLOB.GuestVariations, org = S.Meeting.organist();
  if (!G || !V.material || !org || !S.organistPlays) return 4;
  var t0 = tc + 0.1, M = V.material, until = t0 + M.dur;
  var home = !M.keyMonzo || (M.keyMonzo[0] === 0 && M.keyMonzo[1] === 0 && M.keyMonzo[2] === 0 && !(M.keyMonzo[3] || 0));
  if (!home && S.droneDuck) {
    S.droneDuck.gain.cancelScheduledValues(t0); S.droneDuck.gain.setValueAtTime(1, t0); S.droneDuck.gain.linearRampToValueAtTime(0.22, t0 + 3);
    S.droneDuck.gain.setValueAtTime(0.22, until); S.droneDuck.gain.linearRampToValueAtTime(1, until + 6);
  }
  var end = G.perform(S.ctx, null, t0, M, V.stream, {
    organist: function (plan, at) {
      S.organistPlays(plan, at, { hymnId: M.hymnId, key: M.keyMonzo, variations: true, style: org.style,
                                  alive: function () { return !!S.playing && S.Meeting.meetingNum() === V.meetingNum && S.Meeting.section() === V.section; } });
    },
    onStage: function (st) {
      var ev = { type: "guest", guest: "variations", stage: st.stage, section: S.Meeting.section(), hymnId: M.hymnId, keys: st.keys, regs: st.regs,
                 cat: "visitation", label: "♪ the organist's variations" + (st.stage === "chorale" ? "" : " · " + st.stage), detail: st.label };
      if (st.t0 <= S.now() + 1e-6) tell(V, ev); else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
    },
  });
  claimAir(end - tc, 3);
  return end - tc + 2;
}
```

In `kolob-voices-organ.js`, two small changes so the set is told as itself
and played at the prelude's level: in `organistPlays`, the lift under the
ward only for a hymn's pieces — `if (tag.hymnId && !tag.prelude && !tag.variations && !plan._underWard)`;
and in `tellOrganNote`, add `"variations"` to the tag keys copied onto each
note (`["givingOut", "modulation", "interlude", "amen", "prelude", "partner", "variations"]`).

**The steeples' variant** — at the top of `steeplesAnswer(V, tc)`:
`if (V.changes && KOLOB.GuestChanges) return changesRing(V, tc);` and:

```js
// CHANGE RINGING FROM A FAR TOWER: the meetinghouse bell's first word (the
// steeples' own die, drawn in the steeples' own order: the span, then the
// bell), a band across the valley ringing changes into the wide send, and
// the meetinghouse bell's last word as the tower stands
function changesRing(V, tc) {
  V.meetingNum = S.Meeting.meetingNum();
  var G = KOLOB.GuestChanges, R = stream("guest:steeples"), Y = synth("steeples"), t = tc + 0.3;
  R.rnd(45, 75);                                            // (the steeples' span, drawn as ever)
  var homeBase = harm(R.pick([4, 5, 6]));
  while (homeBase > 700) homeBase /= 2; while (homeBase < 300) homeBase *= 2;
  var hg = 0.6 * getLayerParam("bells", "ring", 0.55);
  bellStrike(t, hg, homeBase, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
  emitNote("bells", 0, t, BELL_RING_S, guestNote(V, "steeples"));
  var day = S.Meeting.day ? S.Meeting.day() : null;
  var mat = G.prepare({ keynoteHz: S.F0 * S.ROOT_MULT, sunday: day ? day.id : null }, V.stream), t1 = t + V.changes.at;
  var end = G.perform(S.ctx, wideSend(), t1, mat, V.stream, {
    defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
    onNote: function (x) {
      emitNote("tower", x.freq, x.t, x.dur, guestNote(V, "steeples", { part: "tower", bell: x.bell, place: x.place, row: x.row, hand: x.hand, muffled: x.muffled, monzo: x.monzo, changes: true }));
    },
    onStage: function (st) {
      var ev = { type: "guest", guest: "steeples", stage: "changes:" + st.stage, method: mat.methodName, touch: mat.touch, muffled: mat.muffled,
                 cat: "visitation", label: st.stage === "rounds" ? "◎ a far tower rings" : "◎ " + st.label, detail: mat.methodName };
      if (st.t0 <= S.now() + 1e-6) tell(V, ev); else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
    },
  });
  var tl = G.score(mat, V.stream, t1).lastStrike + 3;
  cueAt("guests", tl - 2.5, function () {
    if (!S.playing || !C_live(V)) return;
    bellStrike(tl, hg * 0.9, homeBase, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
    emitNote("bells", 0, tl, BELL_RING_S, guestNote(V, "steeples"));
  });
  return Math.max(end, tl + BELL_RING_S) - tc;
}
```

(`C_live` needs `V.stream`: the planner sets it on the steeples' record when
they ring changes, above.)

**At the PLAY press** (`kolob-core.js`, beside `KOLOB.Hymnal.warm()`):
`if (KOLOB.GuestChanges && KOLOB.GuestChanges.warm) KOLOB.GuestChanges.warm();`
— the touch search (15 ms, once) is then never run inside a clock cue.

### 5. The minutes and the Deseret (`kolob-cast.js`, `kolob-ui.js`)

- **The organist's new doings** are said by the plan (`cast` events through
  `tellOrganist`): append these to `kolob-cast.js`'s `ACTION_DS` list (the
  phonemes are `KOLOB.GuestVariations.ACTIONS`, spelled as the others are):
  *plays variations on the hymn; plays the hymn as a plain chorale; turns the
  tune into a minuet; turns the tune into a polonaise; turns the tune into a
  march; sets the tune in canon; plays the tune in two keys at once; gives
  the hymn on the full organ; closes with the amen.* ("puts the tune in the
  pedals" and the stops' words are already there.) Until then
  `KOLOB.GuestVariations.ACTION_DS` holds them in Deseret capitals.
- **Rows:** a ✦ row for "plays variations on the hymn" and one for each
  character (its `guest` stage); a ◎ row "a far tower rings" with the method
  (`changes:rounds`), and "that's all" (`changes:round`). The direction line
  names them while they sound ("the organist's variations"; "a far tower").

### 6. SCORE.md, to adopt

- **Streams:** `guest:variations:<n>` (forks `seat` — the odds, the seat, the
  moment, the hymn; `shape` — the set, which `Organist.variations` draws from
  as `variations:<style>` → `var:<character>`, `hands:<tag>:<line>`,
  `pass:<line>`, `fig:<k>`, `intro`; `organist` — only when no organist is
  handed in; `synth` — a lab's own organ); `guest:changes:<n>` (forks `seat`
  — the variant's die, the moment; `shape` — the stage, the piece, the touch,
  the rounds, the pace, the ring's key, the tower's side and distance, the
  band; `synth` — each bell's partials and shimmer, each stroke's placing
  and weight, the wind).
- **A Plan kind:** `"variations"` (`plan.variations`, `plan.characters`).
- **Notes** (organ layer, through `organistPlays`): `variations: true`; the
  ornament kinds (`orn`) add `acc` (a dance's bass and chords), `canon` (the
  canon's answer), `bitonal` (the interlude's other key: its tune, its middle
  part and its bass), `octave` (the finale's doubling); `app` (the
  polonaise's lean), `pedalpoint`, `added`, `intro`, `amen` as the organist
  already uses them. The written notes of the theme, the trio's pedal tune,
  the canon's leader and the finale carry `line`, `beat`, `deg` as the Score
  has them; a dance's tune carries `line` and `deg` but no `beat` (it is
  re-barred). **A new layer `tower`** for the far tower's strokes: `bell`,
  `place`, `row`, `hand` (`H` | `B`), `muffled`, `monzo` (from the keynote),
  `changes: true` — the ENGRAVE crew's "blue line" (PLAN §8.3) can be drawn
  from `bell`/`place`/`row`.
- **Events:** `guest` with `guest: "variations"` and a stage per character
  (`chorale`, `trio`, `canon`, `minuet`, `bitonal`, `polonaise`, `march`,
  `finale`; with `keys` and `regs`); `guest` with `guest: "steeples"` and
  the stages `changes:rounds`, `changes:go`, `changes:round`, `changes:stand`
  (with `method`, `touch`, `muffled`); the organist's `cast` actions above.
  `KolobAudio.setForceVisitation` names `variations` and `changes`.

## Requests

1. **To the integrator:** the recipe above (loading, planning, the cue, the
   set pieces, `organistPlays`' two small changes, `warm()` at the press,
   SCORE).
2. **To the CAST crew (or the integrator):** the nine new organist actions in
   `ACTION_DS` (§5 above).
3. **To the UI (the integrator):** the minutes' rows and the direction line
   (§5 above).
4. **To the ENGRAVE crew:** the far tower's strokes on layer `tower`, if the
   staff should show the ringers' blue line (the lab draws it); the
   variations' dances are re-barred (3/4, 2/4) and carry no `beat`.
5. **To the harness (the integrator):** until the recipe is applied, the
   module-list check fails on the two new files (they are on disk, not in
   `_engine.php`); a scratch copy listing them as lab-only passes (below).
   Once seated, the harness might check: at most one recital a morning (the
   variations never with the chorale prelude), the variations never beside
   another guest, every ringing's rows `verify()`d, the tower's span held by
   its section.

---

## How it was checked (all silent)

Muted headless Chrome over CDP (`--headless=new --mute-audio`, port 9492,
profile `kolob-r3c-organ-chrome`), PHP on :8172, and Node for the pure parts.

| check | result |
|---|---|
| the lab at 860 and 390 px | **0 console errors** after reading the plan, purity, the characters menu, the bells menus, one bell's partials, the odds, ▶ play and stop for both guests, compose another; no sideways scroll (scroll width = viewport) |
| purity (the lab's card, and Node) | every set, seat, ringing and ringing seat made twice on the same stream identical; **0 `Math.random` calls**; three styles of ringing verified |
| the variations, musically (Node) | 180 sets: 3–5 characters, 3–10 registrations; the six marks per pair; the interlude in two keys 32–91 % of its moments (the rest 0–4 %); the polonaise minor; every pitch in compass (see above) |
| the variations' level (the lab's check, offline, as seated) | nine sets, the three organists × three dialects: the loudest 3 s −0.4 to +1.7 LU against the engine's organ, +0.7 to +2.1 against the organist's own chorale prelude; **0 clicks, 0 clipped** |
| the rows (Node) | the first leads match the published rows; plain courses 40 and 60; the touches true and round; 400 ringings verified; a tampered row caught |
| the tower bell (the lab) | the partials read off the spectrum (the table above) |
| the ringing's level (the lab's check) | four ringings (Minor touch, Doubles course, covered Plain Hunt, half-muffled Plain Hunt): −0.6 to +2.3 LU against the engine's organ, 7–10 under the steeples; **0 clicks** (after the mend), 0 clipped |
| the main thread, live (muted Chrome) | the variations 9.9 ms at the press, slices ≤ 2.5 ms; the ringing 2.4 ms, slices ≤ 0.4 ms |
| the organist lab (it shares `kolob-organist.js`) | loads with 0 console errors; its prelude and hymn plans as before |
| the harness (`_harness.js`, 600 s) | seed 25: every check passes but the module list (the two new files are not in `_engine.php` yet — the integration's); seed 7, on a scratch copy listing them as lab-only: **VERDICT: PASS** |

## Known issues

- **Nobody has listened.** Everything here is measured, not heard. The
  interlude's "two keys" is measured by a proxy (the moments whose pitches no
  single just major scale holds); whether it is *heard* as a joke, and
  whether the dances sound like dances, is the owner's ear.
- **Length.** A set of variations is 57–168 s over 180 sets (median 122;
  p10 96, p90 152), a ringing 31–132 s (median 81). Both guests hold their section while they sound. If
  that is too long: `prepare`'s `lo`/`hi` (the set's window, 105–165 s) and
  the band's rounds and touches (`shapeOf`, `touches`' 60-change cap).
- **The theme and the finale are near relatives by design** (the finale is
  the theme on the full organ, broader, doubled); the mark count above calls
  58 of 1,272 pairs close, nearly all of them these two.
- **The dances are re-barred by rule, not by ear.** A tune with long
  melismas, or a fuging tune's irregular line, can make a crowded bar (a
  foot of more than six notes is split in two). Not auditioned across every
  hymnist.
- **The polonaise's minor** lowers the 5-limit mi, la and ti; a gospel
  tune's 7-limit tones pass through unchanged, and a hymn already in dorian
  or aeolian stays in its own mode.
- **The tremulant is one per organ.** A character's phrases share it; the
  Victorian's minuet on the vox humana draws it, and the next character's
  first phrase draws it back off.
- **The improviser's stray key** is kept in the interlude only if it is
  heard in two keys (at least 30 % of the time); otherwise the search takes
  another key, so the interlude's key is not always his own.
- **The prelude's morning** with the variations is re-timed by the recipe's
  `variationsSeating`, written here but not run in the meeting.
- **Levels were set in the lab's stand-in of the meeting's rooms** (as
  seated), against the organ and the steeples as the lab copies them; they
  should be read again in the meeting once seated.
- **The odds are a stand-in's** (the trombones', the singing school's and
  the handbells' approximated); re-measure with the harness after seating.
- **The band rings two methods.** No call changes (Queens, Tittums), no
  Grandsire or Stedman, no ringing up or down; `METHODS` takes any place
  notation, so more are a table entry each.
- **Making the variations ready at the cue** costs 2–11 ms of main thread
  (pure planning), as the handbells' `prepare` does at theirs.

## An honest listening note

- **What is truly new to hear:** two guests, both in the lab only. Neither
  plays in a meeting until the integration step.
- **The one worth the owner's first five minutes:** the improviser's set,
  `guests3b-lab.php?seed=2&dialect=tabernacle&style=improviser` — the canon
  at 0:39 and **the interlude in two keys at 1:13** (the joke Ives's father
  would not let him play in church), then the march and the finale. Then the
  Victorian's minuet on the vox humana (`?seed=7&dialect=sacredharp&style=victorian`,
  0:26) and polonaise (1:01).
- **Then two minutes of bells:** `?seed=1&stage=minor&piece=touch`,
  **▶ ring** — rounds, the changes, the bobs, rounds again; and
  `?seed=5&stage=minor&piece=hunt&muffle=on` for the half-muffled funeral
  ringing.
- **Small, and possibly wrong by ear:** the far tower's level (set to about
  the organ's, well under the meetinghouse bell), the bells' timbre (the
  tierce and the hum), and the sets' lengths.
