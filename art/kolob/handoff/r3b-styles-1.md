# r3b-styles-1: every style, the forms and the new guests in the meeting

*Round 3b, step 3. Branch `kolob-r3b`. 2026-09-28.*

The meeting now sings every one of the six styles in the ways the composer
wrote them, and three new kinds of piece: a **round**, a **partner hymn**
(the closing hymn written on the first hymn's chords, the first hymn played
against it), and the meeting's **wandering refrain**. Two new guests are
seated in it: the ward's **handbell choir** and the **singing school**
(experimental, switchable). The doxology now pays off **one** of the
meeting's threads, never two. It was all built per the owner's ruling, as
though there were no phone to carry it: nothing was thinned, and the cost
was measured (below).

Nothing was pushed or published, and VERSION is not bumped. A suggested
branch-local line: `v0.35-styles.1 — rounds, the partner hymn and the
wandering refrain; gospel's quartet and the Primary's children; the handbell
choir and the singing school; the doxology's one payoff`. Every check was
silent: the Node harness, and headless Chrome launched with `--headless=new
--mute-audio`.

Commits on `kolob-r3b` (after step 2's `a2b99299`):

| commit | what |
|---|---|
| `c55abdfd` | `kolob-score.js`: the proofreader reads the ringing seventh (r3-hymn2-1's request 1); the new practices, ids and typed events |
| `fd234d65` | the styles, the forms, the payoff rule, the handbells and the singing school in the meeting |
| `0389e40c` | SCORE §11.7 |
| `bd30e7ae` | a round's groups by the sections named "the basses", not "basss" (a fix) |
| (this) | this note |

---

## For the owner, in plain words

**What is new to hear, by size (honestly):**

1. **The wandering refrain** (about one meeting in four; never on a fast
   Sunday). After the first hymn's last verse, one man, the enthusiast,
   starts two short lines in a camp-meeting lilt, alone. The ward picks them
   up and sings them together. After a later hymn the refrain comes back, in
   that hymn's key and style. In the doxology the ward sings it again, all
   at once, with nobody starting it. It is the same little tune three times,
   and it belongs to that meeting only.
2. **A round** (about one meeting in five; never the first hymn or the
   doxology). A hymn is sung as a canon. Now and then the ward sings it once
   through together first. Then one group starts, and the others come in one
   after another, each a phrase behind. The groups are the sections (trebles,
   altos, tenors, basses) or the pews, from one side of the chapel to the
   other, so the entries come from different places. Each group goes round
   two or three times and stops in the order it came in. The chorister keys
   it, and there is no organ.
3. **The handbell choir** (about one meeting in eight). Eight to twelve
   ringers stand in a line across the front and ring the day's hymn, or a
   round of their own, in the invocation, before the sacrament, or in the
   postlude. They end with a cascade down the line. They are close and dry,
   a step nearer than the ward, and the house stops playing while they ring.
   They never come on the same day as the steeples.
4. **The singing school** (about one Sunday in ten; experimental). You
   arrive while the choir is still practising the first hymn. You hear the
   fork, one part goes wrong, the chorister raps the stand, that part sings
   the passage alone on "fa sol la mi", and then everyone sings it again. It
   happens in the prelude only, never at a funeral. `?exp=-singingSchool`
   turns it off for a visit (details below).
5. **The partner hymn** (the closing hymn is written on the first hymn's
   chords in about one meeting in four; the composer's strict fit check
   lets the two be sung together in about half of those, so **roughly one
   meeting in eight has the "oh, they fit" moment**). In the doxology's last
   verse, the first hymn is played against it, either by the organist on the
   trumpet stop (in a Tabernacle doxology) or by a cornet from the ward's
   band, a man in the front pew (in a unison doxology). The two tunes meet
   on every beat.
6. **Gospel's quartet** (in about 45 % of gospel hymns). Four people of the
   ward stand and sing the verses as a parlour quartet: the tenor harmony,
   the lead, the baritone and the bass. Their own small wanderings of pitch
   and timing are taken out, so the ringing sevenths ring. The ward joins
   them on the refrain and the tag. The rest of the time the whole ward is
   the quartet, as in step 1.
7. **The Primary's children** sing the Primary song. When the day's unison
   song is a Primary song (about 2 % of hymns), six to nine of the ward's
   own children sing it at the front, and the ward joins them on the chorus
   after the first verse.
8. **One payoff per doxology** (a rule you will notice mostly as its
   absence). The doxology pays off one thread: the tune withheld and
   assembled at last, the partner hymn, the refrain, or (when none of those
   is drawn) the bands crossing it.

**What is not new (to be honest about it):** the six styles themselves were
already sung in step 1 whenever the draw landed on them. Step 1 sang fuging
tunes (with the fuge sung twice), gospel with its echo, swipes, refrain and
tag, and Shaker songs and gift songs. This step adds the quartet, the
Primary's children, the forms and the guests above. It also sets out the
weights by kind of Sunday and leaves hooks for the calendar (step 4).

### How to hear it

```
php -S 127.0.0.1:8141 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3b
```

Then `http://127.0.0.1:8141/art/kolob/index.php?seed=9` (and the seeds
below). The times are the minutes' own clock, mm:ss from pressing ▶. They
were read from the harness, and seed 9's were checked in the browser: the
practice at 0:08, the sacrament at 11:50, the bells at 11:53–54, the
doxology at 13:51, all to the second.

### The listening note

| what | seed | when | listen for |
|---|---|---|---|
| **The singing school** | **9** | **0:08–0:45** | The fork at 0:08. The choir tries the first line at 0:14, and the tenors climb where their line turns down (a sour seventh). Two raps at 0:20, and the choir stops raggedly. At 0:21 the tenors sing the passage alone, slowly, on the notes. At 0:31, two soft raps and everyone again. |
| **The refrain's three statements** | **9** | **5:10, 8:28, 15:44** | **5:10:** the enthusiast alone, after the first hymn's last verse, then the ward takes it up. **8:28:** it comes back after the second hymn (the ward, the enthusiast singing out). **15:44:** in the doxology, the whole ward at once, unprompted. That last statement is the doxology's payoff. |
| **A round** | **9** | **8:50–9:50** | A three-segment round (Tabernacle, keyed a fourth up). The chorister keys it, and the ward sings it once through together at 8:58. Then the round at **9:15:** the pews on one side, then the middle at 9:21, then the other side at 9:26. |
| **The handbells** | **9** | **11:53–12:30** | Before the sacrament: the day's first hymn, plain, each bell damped as the next rings. At 12:08 the second setting has a slow descant in the top bells. At 12:23 comes the cascade, the home chord's bells from the top of the line to the bottom. |
| **A partner hymn: the organ's trumpet** | **16** | **14:24–15:20** (the moment: **14:55**) | The doxology (№280, Tabernacle, SM, two verses) is written on the first hymn's chords (№324 at 3:05, four verses, the same meter and key). Verse 1 at 14:34 is the doxology alone. In verse 2, from **14:55**, the organist sets the first hymn on the trumpet stop against it. Hear the first hymn at 3:05 first. |
| **A partner hymn: the cornet** | **18** | **8:41–9:35** (the moment: **8:49**) | The first hymn (3:07) was an Old Way hymn, lined out slowly. The doxology is a Shaker gift song written on its tune's chords, in unison, over a hummed drone, one verse. From **8:49** a man of the ward plays the Old Way tune on a cornet against it, at the gift song's own pace. |
| **A Shaker gift song** | **18** | **8:41** | The same doxology: wordless ("hey … dum"), in two strains each sung twice, a few men humming the drone. |
| **A fuging tune** | **16** | **6:03–8:55** | FAR WATER (№236, psalmody, CM). The pitching, then verse 1 at 6:10. **The fuge at 6:31**, across the last two lines: the bass starts it alone, then the tenor, the counter and the treble. It is sung again at 6:58. The ward's own fuging on the hymn's head at 7:23. Verse 2 at 7:48. |
| **Gospel: the whole ringing chain, the echo, the tag** | **1** | **9:13–10:45** | WINTER QUARTERS (№288, gospel, keyed a fourth up). **9:19, line 1, is the whole barbershop chain**, III7 → VI7 → II7 → V7 → I, each seventh ringing (4:5:6:7). Swipes in most lines. **9:47: the men's echo** at the end of line 6. After verse 2, the refrain's second statement (10:27, in this hymn's key), then **the tag at 10:39**. |
| **Gospel's quartet** | **1** | **6:12–7:55** | ZARAHEMLA (№280). Four of the ward stand and sing the verses from **6:19** (an alto of the ward, the lead, is named leading them); the ward joins on the refrain. Compare the whole ward as the quartet in WINTER QUARTERS at 9:19. |
| **The Primary** | **20** | **5:50–7:35** | A Primary song (№159, keyed a fourth up). At **5:59** the chorister leads the Primary, and the ward's children sing it, in unison, at the front. Verse 2 at 6:48; **the ward joins the chorus at 7:19**. |
| **A round by sections, quickly** | **18** | **17:35–18:10** | A four-segment round: the trebles at 17:42, then the altos, tenors and basses, each two seconds behind. Then the refrain's second statement at 18:11. |

**Also, if you have the time:** seed 1 is a gospel Sunday. The refrain comes
at 5:24, 10:27 (a fourth up) and 16:37, and the steeples ring in the
prelude. **The switch:** `index.php?seed=9&exp=-singingSchool` is the same
Sunday without the practice. The morning wakes as it would have (checked in
the browser: the practice's rows are gone, and the tuning fork, bells, organ
and strings wake instead).

---

## The rules and their rates (measured)

**Planned over 2,000 first meetings of the calendar** (the harness's calendar
census, now tallying the forms):

| | share of meetings | by kind (ordinary · conference · fast · jubilee) |
|---|---|---|
| a round | **19.3 %** (about 1 in 5) | 22 · 25 · 0 · 19 % (a fast Sunday has one hymn: none after the first) |
| the partner hymn composed | **23.7 %** (about 1 in 4) | 23 · 23 · 21 · 28 % |
| the wandering refrain | **23.5 %** (about 1 in 4) | 27 · 27 · **0** · 28 % |
| handbells | **11.8 %** (1 in 8) | seats: postlude 56 %, before the sacrament 28 %, invocation 16 % |
| the singing school | **9.4 %** (1 in 10); **0 %** with `exp=-singingSchool` | |
| the doxology's payoff | refrain 23.5 %, partner 23.7 %, bands 11.1 %, the assembly 8.2 %, **none 33.6 %** | |
| guests a meeting | none 30 %, one 50 %, two 18 %, three 1.7 % | |

- **The partner's first hymns:** Tabernacle 290, Old Way 116, Shaker 68
  (per 2,000). The composer's fit check combines the Tabernacle on the
  Tabernacle 20 of 40, the Shakers' unison on a Shaker tune 6 of 7, and on
  an Old Way tune 7 of 12. Its Sacred Harp (0 of 36), gospel (0 of 13) and
  psalmody (0 of 12) partners never combined, in their own dialect or under
  a Tabernacle partner. So those take no partner (Requests, 1).
- **Houses**, by kind (the house dialect):
  - ordinary: Tabernacle 42, Sacred Harp 24, Old Way 11, psalmody 10,
    gospel 7, Shaker 5 %;
  - conference: Tabernacle 68, Sacred Harp 14, gospel 9, psalmody 7, Old
    Way 3 %;
  - fast: Sacred Harp 39, Old Way 35, psalmody 12, Shaker 7, Tabernacle 7 %;
  - jubilee: Tabernacle 54, gospel 30, Sacred Harp 11, Shaker 6 %.

  All six overall: Tabernacle 43, Sacred Harp 23, Old Way 12, gospel 9,
  psalmody 8, Shaker 5 %.
- **Each hymn's dialect** (6,476 singing rows): Tabernacle 39, Sacred Harp
  21, gospel 11, psalmody 10, Old Way 10, Shaker 9 %. The Shaker share
  includes the Old Way rows made rounds, and the unison partners.

**Heard, over 60 seeds × 1,200 s** (116 meetings begun, 62 doxologies
reached; the harness's new "day's forms" section):

- 27 rounds planned, 19 sung (entries: four in 15, three in 4; the others
  ran past the 1,200 s);
- 30 partners composed, **11 combined and played** (organ 2, cornet 9);
  **the first tune met the ward on the same beat 339 times of 339, within
  3 ms**;
- 18 refrains, 24 statements heard (at most three a meeting, the first
  always started by the enthusiast);
- **62 doxologies: 32 with one payoff, 30 with none, 0 with two.**
- Payoffs heard: partner 11, bands 9, refrain 7, the assembly 5.
- Gospel hymns 22: quartet verses 20, the ward's 21.
- Guests in 85 of 116 meetings (the second meeting of a run is often cut
  short): bands 37, handbells 22, oldtune 15, trombones 13, steeples 12,
  singing school 10.
- **Cadences, by the dialect of the hymn that closed them:** Tabernacle 234
  authentic, 82 plagal (26 %: the A-men); gospel 39 authentic, 18 plagal
  (32 %: the tag's IV–I); Sacred Harp 147 and psalmody 29, all open fifths
  (0 % plagal); the Old Way and the Shakers close no cadence. Over every
  cadence (the joints' amens included), 35.0 % plagal (the plan's 30–55 %).
  By the house: gospel 57 %, the Tabernacle 45 %, the psalmody 36 %, the
  Sacred Harp 2 %.

---

## What it costs (measured, not cut)

**The audio thread, in the real meeting** (muted headless Chrome on this M3
Pro, the page itself). I used step 1's method, with three readings at once:
- Chrome's trace of the render callbacks, summed per second;
- Chrome's `renderCapacity` for the page's context, once a second;
- the node counts.

**A caution first: the machine was loaded.** The one-minute load average
was 3.5–4.0 throughout (other crews' batches). At that load every
figure sits well above step 1's, which was measured at 2.2–3.1: this
machine's whole meeting read 9.5 % of the thread then, and reads 26–28 %
now, for either build. So the reading is the **A/B**:
- the same seed, the build before this step (`a2b99299`, served from an
  archive) and this one;
- traced back to back, 17 minutes each, at the same load.

The meetings are not identical: this step's dice add the practice, the
refrain, a round and the bells to seed 9, and move what follows.

**A whole meeting** (seed 9, from ▶ for 1,030 s: the singing school, three
Tabernacle hymns with the refrain after two of them and a round as the
third, the handbells before the sacrament, the doxology with the refrain,
the postlude):

| | this build | the build before (`a2b99299`) |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **26.9 % · 35.7 % · 36.8 % · 39.9 %** | 27.5 % · 35.0 % · 36.4 % · 37.8 % |
| Chrome's render capacity: median · p90 · max | 25.5 % · 43.4 % · **92.5 %** | 26.0 % · 41.8 % · 88.5 % |
| seconds over 50 % capacity · over 30 % | 50 · 355 (of 1,027) | 64 · 360 |
| one render callback (5.3 ms of audio each): median · p99 · max | 1.35 ms · 3.81 ms · **5.68 ms** | 1.38 ms · 3.74 ms · 5.85 ms |
| nodes the context holds, peak (created in 17 min) | **2,742** (48,796) | 2,579 (51,420) |
| the ward's own nodes alive by its ledger: peak · mean | 1,752 · 318 | 1,538 · 320 |
| clock cues late · the ward's lines late | 0 of 9,023 · 0 of 1,767 | 0 of 10,140 · 0 of 2,029 |

**By what sounds** (this build; Chrome's render capacity, median · max; the
most nodes held):

| window (seed 9) | capacity median · max | nodes, peak |
|---|---|---|
| the singing school (0:08–0:45) | 8.6 % · 14.9 % | 446 (the practice's 24 singers and the chorister: 250 of them) |
| the prelude after it, and the invocation | 7.8–20.4 % · 34 % | 292–304 |
| hymn 1, the Tabernacle (3:13–5:10) | 31.3 % · 87.8 % | 2,353 |
| the refrain's first statement (5:10–5:39) | 26.6 % · 69.5 % | 1,725 |
| hymn 2, with the descant (5:39–8:28) | 31.5 % · 81.6 % | 2,653 |
| the refrain's second statement (8:28–8:50) | 29.2 % · 44.2 % | 2,614 |
| **the round** (8:58–9:50: once through, then three groups going round) | 30.4 % · **92.5 %** (at 8:59, its first line joining) | 2,364 |
| **the handbells** (11:53–12:45) | 24.2 % · 40.9 % | **987** (the sacrament around them: 645–694) |
| the doxology (13:51–15:44) and **the refrain's third statement** (15:44–16:08) | 26.3 % · 67.9 % and 33.2 % · 52.3 % | 2,238 · 2,454 |

**Reading it.**

- **A whole meeting costs about what it cost before this step.** The
  median is 0.6 points lower, the p90 0.7 points higher, and the worst
  second 2 points higher. The hymn sections read 29.1 % at the median
  against 26.5 % before (+2.6 points: the round's groups going round
  together, the refrain's extra statements). The sections around the hymns
  read lower or about the same (the postlude a point higher), because
  their content moved: this build's prelude is the practice, not the
  morning the build before woke with.
- **The peaks are where many lines join at once**, as in steps 1 and 2: a
  verse's first line, and here the round's unison pass beginning, 92.5 %
  for one second at 8:59. The worst callback overran its 5.3 ms buffer
  once in each build (5.68 ms here, 5.85 ms before). On this loaded machine
  that is probably one glitch a meeting in both builds; the clock
  otherwise kept time.
- **The new guests are cheap.**
  - The handbells hold about 300 more nodes than the sacrament around them
    (11 a ring, at most 20 rings at once) and read under the hymns.
  - The singing school's 25 voices read 8.6 % at the median, about a
    quarter of a hymn sung by the ward.
  - The cornet against the partner is a handful of nodes a note.
- **The step's real weight is still the 32-voice ward** (step 1). The
  round and the refrains give it more to sing. Nothing was thinned.

**Gospel's quartet, and the partner's last verse** (the same method; a
meeting from ▶, or a jump to the doxology; the thread's share is read over a
whole run only, since the trace's per-second sums arrive at its end):

| | capacity median · max | the thread's share, median · worst second | nodes, peak | worst callback |
|---|---|---|---|---|
| seed 1, a gospel hymn sung by the ward as the quartet (2:40–5:24) | 27.7 % · 69.5 % | | 1,940 | |
| seed 1, **the quartet's verses** (6:16–7:50: four singers on the stanza, the ward on the refrain) | **24.7 % · 61.9 %** | | **1,299** | |
| seed 1, the refrain's first statement (5:24–6:12) | 26.4 % · 49.9 % | | 1,532 | |
| seed 1, the first 8 minutes whole | 26.5 % · 69.5 % | 28.1 % · 37.0 % | 1,940 | 4.82 ms |
| seed 16, the doxology with **the organ's trumpet against it** (110 s from the jump) | 24.8 % · 47.5 % | 25.0 % · 37.7 % | 2,589 | 4.86 ms |
| seed 18, the gift song with **the cornet against it** (75 s from the jump) | 25.6 % · 69.8 % | 30.5 % · 36.9 % | 1,036 | 4.85 ms |

The quartet's verses cost less than the ward's (four voices on the stanza
instead of thirty-two). The partner's trumpet is one more organ phrase and
reads like any doxology with the organ; the cornet is a few nodes a note.
None of these runs had a late cue or a console error.

---

## What shipped

| file | what |
|---|---|
| `kolob-score.js` | the septimal slack (`SEPTIMAL_C`, per factor of 7); `PRACTICES` + `quartet`, `round`; `ID` + `r:<n>:<k>`; EVENTS `round-entry`, `partner`, `refrain`, `payoff` |
| `kolob-hymnal.js` | the house draws from all six (the arbor leans to the psalmody); the calendar's hooks (`SUNDAY_LEAN`, `KIND_LEAN`, read only when step 4 names the Sunday); **`forms()`** (the round, the partner, the refrain, the one payoff; `FORM_ODDS`, `PARTNER_DIALECTS`, `REFRAIN_SET`); the desk writes them (`errand()`: `compose`, `round`, `partner` with 14 tries, `refrain`, `refrainIn`; the refrain's orders stand aside) |
| `kolob-meeting.js` | the singing school seated after the trombones (the switch read once, handed down; the morning's seating `school`); the forms and the payoff with the hymnal (`bandsLeaveTheDoxology`); the handbells seated after the forms; both cued with their material made ready at their cue (`standingMaterial`), the house listening (`LISTENED`); forcing (`handbells`, `singingschool`); the enthusiast seated on a refrain Sunday; the chorale prelude refused on the school's morning; `S.Meeting.forms()`, `payoff()`, `refrainAfter()`; the bands' `payoff` event |
| `kolob-cast.js` | the quartet (`plan.quartet`, `QUARTET_RATE` 0.45: the four at the Score's exact pitch and on the beat, near; the ward on the refrain and tag); the Primary (`ward.primary`, six to nine children on `cast:<n>` → `primary`; `plan.primary`); the round (`plan.round`, `roundGroups`, the writer's `roundVerse`); `planRefrain`; a forward voice `alone`; `Cast.clock`; the enthusiast seated on demand, last, so nobody else moves |
| `kolob-voices-choir.js` | the round's plan (unaccompanied, no fuging); **the partner's last verse** (`partnerVerse`: the organ's trumpet via the organist's desk, or the cornet via `KOLOB.VoicesBand`, on the chorister's clock); **the refrain's statements** (`singRefrain`, `tellPiece`: after the hymn's last verse, before its A-men or tag); the round's entries told; the payoff events |
| `kolob-guests.js` | the handbells and the singing school's glue (`standingGuest`: `hooks.defer` on the guests' lane, notes and stages told as they are laid out) |
| `kolob-core.js` | **`S.seatedSend(layer)`**: a guest standing in the chapel seated as a layer (`ROOM_DEPTH.handbells` −0.35, `cornet` −0.12) or into a layer's own gain (the practice into the choir's), behind the meeting's doors; `S.formStream` |
| `kolob-voices-organ.js` | a partner's notes say so (`partner`) |
| `kolob-ui.js` | the minutes' rows: the handbells (their first sound, the cascade), the singing school (the fork, the stop, on the notes, again), a round, the first hymn against the partner, the refrain, and the new ✦ actions; the direction line names the bells and the school |
| `kolob-voices-folk.js` | the roll call (one line: it is in the engine now) |
| `_engine.php` | `kolob-experimental.js`, `kolob-voices-folk.js`, `kolob-guest-handbells.js`, `kolob-guest-singingschool.js` join the load order |
| `SCORE.md` | **§11.7** |
| `_harness.js` (untracked) | the four modules out of `LAB_ONLY`; `exp=` (the experiments' switch); rounds, the quartet and the refrain in the walk and the ward's checks; the Score's own melody part for proofreading; `force=<guest>` (the switch naming its guest); a new section, **the day's forms** (every rule above, checked where it sounds; `FORMS_JSON`); the calendar census tallies the forms, the payoff, the guests and the houses (`CENSUS_JSON`); `KOLOB_STYLES=1` prints each hymn's style as written. A copy: `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/_harness.r3b-styles.js` |

### Decisions taken (each one line to change)

- **Where a partner may be written:** only where the composer's fit check
  can pass (the Tabernacle; one tune on one tune: the Shakers, and an Old
  Way tune under a Shaker doxology). `PARTNER_DIALECTS` in
  `kolob-hymnal.js`.
- **Which doxology:** the first (a jubilee's second doxology is the
  reprise). The refrain's third statement and the partner are both in it.
- **Where the refrain goes in a hymn:** after the last verse, before the
  A-men or the tag, as a chorus is sung.
- **Who plays against the partner:** the organist on the trumpet stop in 60 %
  of accompanied doxologies (`PARTNER_ORGAN`), else a cornet. A unison
  doxology always gets the cornet.
- **The singing school's choir** goes into the choir's own layer (under the
  choir slider, 0.88 of the lab's "as seated", about 1 dB quieter than the
  guest crew measured), so the slider moves it with the ward. The bells have
  a seat of their own at the still small voice's nearness, under no slider,
  as the guest crew asked.
- **The quartet's rate:** 0.45 of gospel hymns (`QUARTET_RATE`,
  `kolob-cast.js`).

---

## How it was checked (all silent)

- **The harness, 60 seeds × 1,200 s, run twice (before and after the final
  harness changes, the same tallies to the unit): 58 pass.** Seeds 17 and
  37 fail only on
  the trombone choir's compass (91.7, 97.8 and 484.1 Hz). That is the
  known GUEST issue step 1 found on HEAD as well, unchanged here.
- **REPRO passes** on seeds 9 (the singing school, the refrain, a round, the
  handbells), 16 (a fuging tune, the partner on the organ), 1 (gospel, the
  quartet, the refrain) and 40 (the refrain, the quartet). In each: the same
  seed twice, then jittered timers, then re-salted sound streams. The score
  is identical byte for byte.
- **TRANSPORT passes** on seed 9 (stopped at 330 s: 0 of 11 stale sources
  reach the hall).
- **The census** (2,000 first meetings): every planned rule holds. That
  covers no partner with the assembly, no refrain on a fast Sunday, no band
  in a doxology paid off by another, no handbells with the steeples, no
  singing school outside the prelude, and no round on the first hymn or the
  doxology. With `exp=-singingSchool`, 0 of 1,000 meetings seat the school
  (9.4 % with it on). Every other guest keeps its share: the bands, the
  steeples, the old tune and the trombones are unchanged, and so is the
  handbells' total, though a few of them take the invocation the practice's
  absence frees. Forcing the school by name seats it (seeds 3 and 21), and
  forcing it with the switch off does not.
- **The validator:** 40 gospel hymns (1,046 septimal notes) all failed
  `validateHymn` on HEAD. All 40 proofread now. In the meetings of the
  60-seed batch, 964 septimal notes were sung exactly as the Score spells
  them (15 runs) and every Score holding them proofread. The harness now
  fails a run in which the proofreader reads gospel "off" by a septimal
  comma (it used to print that as a known request). Every refrain
  statement heard proofreads.
- **The browser** (muted headless Chrome, port 9461, PHP on :8141):
  - `index.php`, `index.php?seed=9`, `?seed=9&exp=-singingSchool` and all
    twelve labs at 860 and 390 px: **0 console errors**, no horizontal
    scroll.
  - Seed 9 was played from ▶ for 30 s with the switch on and 30 s with it
    off: the practice's rows appear, then do not. Seed 12 was played for
    40 s.
  - The whole of seed 9's first meeting was played (17 min, traced): 0
    errors, 0 of 9,023 clock cues late, 0 of the ward's 1,767 lines late.
    The browser's sections and guests fall on the harness's seconds.
  - The minutes print the new rows.

---

## Requests

1. **HYMN crew (the partner):** the fit check never combines a Sacred
   Harp, gospel or psalmody first hymn with its partner (0 of 61), so those
   Sundays take no partner. If the owner wants the partner there too, the
   composer would need to write those partners on the first hymn's own
   chords and rhythm (its later tries) in a way the check can pass. A
   partner (14 tries) costs about 0.26 s in Node, off the audio path.
2. **HYMN crew (the round):** `round()` takes no `avoidNames`, so a round
   may share a name with another hymn of the meeting (rare; not seen in
   the batch).
3. **GUEST crew (the handbells):** the bells ring the day's hymn or a round
   of their own. An adapter from the composer's `Hymn.round` to
   `material.round` is still not written (r3-guests-1's known issue).
4. **GUEST crew (the singing school):** the practice sings with its own eight
   desks, not the Sunday's ward (their known issue). Seating the ward's own
   people in it is the natural next step.
5. **ENGRAVE crew:** the new notes are described in SCORE §11.7:
   - the cornet's first tune (layer `cornet`, `partner`);
   - the organ's (`part: "partner"`);
   - the bells (layer `handbells`, with `tech`);
   - a round's groups (`group`, `pass`);
   - the Primary (`primary`);
   - the refrain (`r:<n>:<k>`).

   The staff does not show the partner's first tune yet.
6. **Integrator:** VERSION at publish (the line above, or yours). Also copy
   the harness from the scratchpad path above into kolob-2.
7. **Step 4 (the calendar):** hand `sunday` to `Hymnal.plan`,
   `Hymnal.forms`, `GuestHandbells.plan` and `GuestSingingSchool.plan` (all
   four read it; `planMeeting` passes `null` today). `forms()` then refuses
   the refrain and the round at a funeral. The hooks are in.

## Known issues

- **Tuned by measurement and by rule, not by ear.** The knobs for the ear:
  - the odds: `FORM_ODDS` (`kolob-hymnal.js`);
  - `QUARTET_RATE`, `QUARTET_GAIN`, `PRIMARY_GAIN` (`kolob-cast.js`);
  - `PARTNER_ORGAN`, `CORNET_GAIN` (`kolob-voices-choir.js`);
  - `SCHOOL_AFTER_S` (`kolob-meeting.js`);
  - the guests' own `LEVEL`s.
- **The partner is heard in about one meeting in eight,** because the
  composer's fit check is strict, as the owner wanted ("a loose fit is
  mud"). When it will not fit, the doxology is a hymn in the first one's
  meter with no payoff, and the bands are not brought back.
- **The ward's own pitch habits stay on in gospel hymns the ward sings.**
  Only the quartet sings the ringing sevenths exactly. Thirty-two people
  each a few cents off make a warmer, less ringing chord.
- **The round's segments can be short:** the composer's two-bar or one-bar
  segments at a quick tempo put the entries two seconds apart (seed 18).
- **The minutes print "CHOIR SPEAKS" during the singing school** (the page's
  own phrase rows read the practice's notes on the choir layer), and the
  valley's tuning fork can sound during the practice.
- **Gift songs' vocables** can repeat one syllable ("hey hey hey …"): that
  is the composer's draw.
- **Not measured again in the meeting:** the handbells' and the practice's
  loudness. The routing is the one the guest crew measured "as seated"; the
  practice is about 1 dB under it (above).

## Where the measurements live

The scratchpad's `r3b-styles/`
(`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3b-styles/`):

- the tools:
  - `trace.js` and `trace2.js`: the audio thread, as step 1's, with the page's
    extras and another port;
  - `windows.js`: a trace by time windows;
  - `index.js`: the listening index from a dump;
  - `lines.js`: a hymn's lines and when each starts;
  - `agg.js`: sums `FORMS_JSON` over a batch;
  - `smoke.js`, `labs.js`: the browser;
  - `partners.js`, `partners2.js`: the partner's fit by dialect;
  - `val7.js`: the proofreader against 40 gospel hymns;
  - `cast1.js`: the round, the Primary, the quartet and the refrain written
    in Node;
  - `batch.sh`, `styles.sh`;
- the results:
  - `b4/` and `b5/`: 60 seeds, dumps and logs;
  - `census.log`: 2,000 meetings;
  - `tr-9-meeting.json`, `tr-9-base.json`: the A/B;
  - `tr-1-quartet.json`, `tr-16-partner.json`, `tr-18-partner.json`;
  - `repro*.log`, `transport9.log`, `labs.out`, `styles.out`.
