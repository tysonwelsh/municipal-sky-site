# Handoff — crew Q (the Question), milestone 1

*Branch `kolob-question`, 2026-09-26. Lab and dev work only, so no VERSION bump.*

> **Round 2 (2026-09-27, at the end of this note) supersedes round 1's API, hard rules, integration notes and requests.** The bank is now written once per visit. Round 1 is kept below as history.

## What shipped

| file | what |
|---|---|
| `art/kolob/kolob-question.js` | `KOLOB.Question`, a pure module that follows SCORE §1 and §3. It uses no AudioContext, DOM, `Math.random` or clock. It loads headless in Node with either `window = {}` or `window = global`. |
| `art/kolob/question-lab.php` + `question-lab.js` | The audition bench. It is unlinked and dev-only. |
| `art/kolob/handoff/question-1.md` | This note. |

### The API

Every function takes the stream named for it under `question:<n>`.

- **`bank(stream, {mode, excludeLines, n})`** returns 7 questions.
  - Index 0 is the old one (sol–la–re′–ti–re′ with v0.30's beats), spelled in the mode. In penta and hexa it is sol–la–re′–la–re′, exactly as `projDeg` always sounded it.
  - Indices 1–6 are generated.
  - Each candidate attempt draws from its own fork, `try:<j>`, so a rejection never shifts the other candidates.
  - The array carries `.stats` (tries, rule rejects, evaluator rejects and why).
  - There is a reserve safety net, so the bank always holds 7. It has never been needed.
- **`pick(bank, stream, {recent})`** makes one draw. Question ids listed in `recent` step aside.
- **`askings(q, stream)`** returns 3 askings. The 1st and 3rd are verbatim. The 2nd is bent in one of two ways:
  - **one note displaced** by a step or two within the scale;
  - **rhythm shifted**: a long and a short trade places, or the phrase comes in late with the first long clipped.

  `bent` records which, so the viz and log can show it.
- **`answers(q, k, material, stream, lattice)`** returns the k-th answer.
  - **Material:** it builds from `material` (hymn lines as degree arrays or Note arrays). The fragment is developed by sequence, invert, retro, break or scatter. With no material it falls back on the question's own intervals.
  - **Growth with k:** each answer is higher, faster and more scattered. The floor and ceiling rise with k, the beat set shrinks, and octave-flings become more likely.
  - **From k=1:** a second harmonium rank a fifth up, **snapped into the scale** (`fifthIn`), and the clarinet as a second answerer.
  - **Pitch:** every note carries its exact monzo.
- **`ground(stream)`** returns `"drone"` (≈2/3) or `"chorale"` (≈1/3).
- **`chorale(material, stream, lattice)`** returns the strings' slow block chorale from a hymn line, `{beatS 1.7–2.5, chords:[{beats, degs:[B,T,A,S], monzos}]}`. Chord tones a gapped scale lacks are left out.
- **`seat(stream, sections, {needS})`** makes one draw from these weights: invocation 3, testimony 3, sacrament 2, interlude 2, postlude 1.5.
  - It returns `{section, index, capS = 0.45 × dur}`.
  - It passes over a section whose cap is shorter than `needS`, and returns `null` if nothing fits.
- **`timeline(parts, {beatS, capS, tailS})`** returns item times in seconds from the event start (SCORE §4).
  - If the event would overrun the cap, it first shortens the breaths (to ×0.5), then quickens the beat (down to 0.6 s), then shrinks the tail (down to 3 s).
  - `fits` reports whether it made it.
- **`compose(qStream, opts)`** returns the whole event in one call, taking every fork under its contract name.
- **Helpers:** `rules`, `evaluate`, `spell`, `monzo`, `ratio`, `ratioOf`, `cents`, `fifthIn` and `minimumS`.

### The hard rules

Checked on sounding pitch, meaning cents in the mode:

- 5 or 6 notes, spelled only in degrees the mode has.
- It starts between do and la, moves up first, never dips to or below its first note, and ends at least a fourth higher.
- At least one leap of a sixth or seventh (790–1130 ¢), at least two leaps of a third or more, at least one change of direction, no repeated notes, and no leap over 1150 ¢.
- It ends on re, fa, la or ti (outside the tonic triad), at la or above.
- The last note is the highest or second-highest, and is never reached by a fall wider than a third.
- Range: from ti below to fa′ above, spanning an eleventh at most.
- The rhythm is in the long–short–short–long–held family: five plain templates each for 5 and 6 notes.

### The evaluator

It rejects a candidate that is:

- too stepwise;
- built on fewer than 4 pitch classes;
- circling (a pitch used three times, or an a-b-a-b pattern);
- too close to a sister or to the old one: a near-twin or transposition, the same shape, the same last three notes, a shared run of 4 notes, or a shared 3-interval shape;
- a match for a window of any `excludeLines` line (transposition-invariant).

## How to hear and see it

1. Start the server: `php -S 127.0.0.1:8103 -t <worktree>`.
2. Open **http://127.0.0.1:8103/art/kolob/question-lab.php**.

The page has:

- a seed field with ‹ › and a mode selector covering all six modes;
- a material selector: stand-in hymn lines, or none;
- a ground selector: as drawn, drone, or chorale;
- the seven questions engraved (do = C, written an octave below sounding), each with **▶ play** and **perform this one**;
- **▶ play full question**, with a playhead on the timeline strip and a live log ("? the question — asking 2 (bent)" … "? unanswered");
- the event panel: the bend, the seat and cap, and every answer voice engraved;
- the 200-seed stats panel. It runs for the current mode on load; "measure all six modes" runs the rest.

Good seeds:

| seed | mode | ground | what you hear |
|---|---|---|---|
| 1 | ionian | as drawn, or forced chorale | question 3, mi–sol–ti–la–fa′–re′, fitted to a 35 s invocation cap |
| 12 | aeolian | as drawn | a 47 s event |
| 7 | penta | drone | |
| 3 | mixolydian | | |

## How it was verified (short checks, per house rules)

**Node, 200 seeds × 6 modes, via `compose`:**

| check | result |
|---|---|
| rule compliance | 100 % in every mode, both by `Q.rules` and by the lab's independent restatement from plain ratios |
| distinct generated questions across seeds | ionian 1084/1200, mixolydian 1080, dorian 1082, aeolian 1081, hexa 982, penta 597 |
| inside one bank | all six are always distinct |
| evaluator rejection rate (of lawful candidates) | 30–36 % (penta 54 %) |
| raw draws refused by the rules | ≈95 %; cheap, ≈2.5 ms per compose in penta |
| answer notes in the lattice | 100 % (0 of 5189 out of scale) |
| 2nd answer higher than the 1st (mean degree) | 96 % |
| 2nd answer faster | 100 % |
| 2nd answer more scattered (mean leap) | 2.25 → 2.5 steps |
| askings | 1st and 3rd verbatim 200/200; 2nd bent 200/200 |
| chorale share | 32.9 % over 3000 seeds (26 % on seeds 1–200 by luck) |
| fits its seat's cap | 200/200 |
| reproducibility | same stream, same JSON |

**Headless Chrome over CDP.** A ScriptProcessor tapped the limiter output, with per-layer analysers:

- **Recordings:** seed 1 ionian with the chorale forced, seed 7 penta drone, and seed 12 aeolian as drawn.
- **Levels:** peak ≤ 0.50 and 0 clipped samples. The 2 ms second-difference click detector (checked against a synthetic step first) found 0 clicks.
- **Console:** clean, at 1100 px and 390 px. There is no horizontal scroll at 390 px.

## Integration notes for the next wave (GUEST / FORM, via kolob-guests.js / kolob-meeting.js)

- **Plan (at meeting time).**

  ```js
  var ev = KOLOB.Question.compose(root.fork("question:" + n), {
    mode: meeting.mode, n: n,
    material: todaysHymnLines,     // melody-part degs of each Line of the meeting's hymns
    excludeLines: todaysHymnLines, // the same lines: a question never matches one
    sections: plan,                // [{type, dur}] in plan order
    recent: []                     // ids, if the facade ever remembers visits
  });
  ```

  If `ev.seat` is null, there is no Question this meeting. Otherwise `Guest.plan` returns `{section: ev.seat.section, dur: ev.timeline.total}`. Start it early enough that `start + total ≤ section end`. `timeline.total` already respects the 45 % cap.
- **Perform.** Each `timeline.items[i]` sits at `start + item.t`:
  - `asking` k: play `ev.askings[k]` from `+ offsetBeats × beatS`, and emit `question-asking {k, questionId}`.
  - `answer` k: play each `ev.answers[k].voices[v]` from `+ entryBeats × beatS`. The roles are harmonium answer, harmonium doubling and clarinet answer.
  - `unanswered`: emit `question-unanswered {}`, then the drone alone, or the strings playing on.
  - Note lengths are `beats × timeline.beatS`.
- **Pitch.** `Hz = keynoteHz × ratio(keyMonzo) × KOLOB.Question.ratioOf(note.monzo) × 2`, which is the octave above the choir's do, as v0.30 did. The chorale sits at the do octave (no ×2). Every sounded note, doublings included, goes to `onNote` with its `deg` and `monzo`.
- **Ground.** For `ground === "chorale"`, loop `ev.chorale.chords` at `ev.chorale.beatS` under the whole event, quietly (ppp, offstage). The drone stays in both cases, as it always does.
- **Voices.** The lab's copies are in `question-lab.js`. They are v0.30's voices with two click fixes and one level fix, all worth carrying into `kolob-voices-*`:
  - the harmonium's bellows LFO modulates its own gain stage instead of adding to the envelope, because a stopped LFO left a step;
  - oscillators stop only after their envelope reaches 0;
  - the harmonium gets a dark parallel "body" path, because the formant alone left answers at about −45 dB under the drone.

## Requests to the integrator

1. **SCORE §5.2.** Please extend the Question shape to what the module returns: `{id, degs, beats, fromBank, mode, monzos, index, meeting?}`. Please also add the `Asking` shape (`{k, questionId, degs, beats, offsetBeats, bent, monzos}`) and the `Answer` shape (`{k, questionId, mode, from, develop, delayBeats, restBeats, durBeats, voices:[{voice, role, entryBeats, notes:[{deg, beats, monzo}]}]}`).
2. **Who asks.** §8.1 makes the clarinet a second *answerer*, but v0.30's asker is also the clarinet. The lab keeps the clarinet as the asker (central, louder) and uses a quieter, panned clarinet as the second answerer. An owner decision is needed on a distinct asking voice, such as a cornet or trumpet from the S sound labs, which Ives would want.
3. **Section lengths (FORM).** The shortest possible Question is 21–34 s (median 25 s), so a postlude of 40–55 s (cap 18–25 s) is usually skipped by `seat()`. If the owner wants "a question left hanging as the room empties" more often, the postlude needs about 55 s or more when it hosts the Question.
4. **Load order.** When wiring, add `kolob-question.js` to `$kolob_assets` in `index.php` (SCORE §1, step 3).

## Known issues

- **Penta has a small space.** Only re and la are outside the tonic triad, and the top of the range is fa′. Across seeds about half the penta questions recur (597 distinct of 1200). Within a bank they are always distinct.
- **Few contour shapes.** There are about 16 sign-patterns of contour in total; the rising rules leave few. Variety comes from pitch, leap placement and rhythm.
- **The old one is exempt.** It breaks the generated-question rules: its widest leap is a fourth. It is kept verbatim as the ancestor, and its beats (1.3/0.9/1.0/0.8/2.8) engrave only approximately.
- **Stand-in material.** The lab's material and `excludeLines` are six stand-in hymn lines until the composer lands.

---

# Round 2 — the critic's fixes (2026-09-27)

*Merged `kolob-2` (corrected SCORE §3 and the second-look report) first. Still lab and dev work only: no VERSION bump. Files: `kolob-question.js`, `question-lab.js`, `question-lab.php`, this note.*

## What changed, finding by finding

| # | finding | what I did |
|---|---|---|
| 1 | **Blocker.** The bank was per meeting, so `recent` was inert. | **(a)** `bank(stream)` is written once per visit from `question:bank` (SCORE §3 as corrected). It returns plain JSON: `{questions, stats}`. **(b)** Ids are mode-free: `q:old`, or `q:g:<written degs>/<beats>`. **(c)** The bank is written mode-free and spelled into each meeting's mode when the meeting draws; `rules()` and the critic's self-tests run again there (see *Spelling into a mode*). **(d)** `excludeLines` is tested at the draw, against that meeting's hymns. **Measured:** the same question twice running happened in 0 of 10 800 meetings (6 modes × 300 visits × 6 meetings). |
| 2 | The bent 2nd asking broke the rules. | `askings()` takes the drawn note and displacement first. It then walks the other displacements and the other inner notes in drawn order. It accepts the first bend that adds no rule failure (a softened sixth is allowed) and passes the critic's self-tests. Otherwise it falls back to the rhythm bend that was already drawn. No new dice. **Measured:** 0 lawless bends in 10 800 meetings. The note bend was shut every way (so the rhythm bent instead) in 4 of 1800 ionian meetings and 68 of 1800 penta. |
| 3 | Survivors clustered on fa′ endings and bugle calls; sol starts were under-drawn. | **(i)** New critic self-tests: `triad-leap` (the great leap joins two tonic-triad tones), `arpeggio` (three triad tones in a row) and `two-great-leaps` (the spec says *a* leap of a sixth or seventh). **(ii)** The six **endings are drawn first**, by weight: re′ 30, fa′ 22, ti 20, la′ 14, la 14. No ending class is used more than twice, so every bank has at least three classes. **(iii)** Each slot also draws its start and length first. Its inner notes are then drawn *evenly* from the slot's scale and filtered by the rules, so every lawful question of that shape is equally likely: no survivor bias, no favourite shape. **Measured (lab, 200 visits, ionian):** endings re′ 33 %, la′ 26 %, fa′ 21 %, ti 14 %, la 5 %. Starts sol 30 %, mi 24 %, do 19 %, re 14 %, la 8 %, fa 4 %. 0 triad leaps and 0 arpeggios (the lab counts these independently of the module). |
| 4 | The invocation nearly always hurried the Question. | **Squeeze order** is now one pressure from 0 to 1, taking the least that fits: first the answers break off early (to about half their notes; answer k keeps at least 3 + 2k), then the tail (8 → 5 s; MIN_TAIL is now 5), then the breaths (to ×0.6), and **only last** the asker's pace (by a fifth at most). **seat()** weights each room by how well the Question fits it: full weight at its own pace, falling to 0.08 of it when it would be squeezed all the way. **FORM can make room:** a section may carry `stretchTo`, and the seat then asks for `sectionS` (at most what it needs). See request 3. |
| 5 | Penta had too little room. | The ceiling is now la′ (degree 12), so la′ is an ending. Three of the six are *written in the pentatonic* (and one in the hexatonic), each drawn evenly over its own scale. Starts are weighted by how many scale tones lie between start and ending. **Measured, penta (lab, 200 visits):** 332 distinct pitch sequences of 724 (was 276/1200). The commonest is mi–re′–la–sol–la at 1.7 % (was sol–mi′–do′–mi′–re′ at 4.6 %). Endings re′ 50 %, la′ 39 %, la 10 %. |
| 6 | ▶ play let the drone die under the held note, and played at the squeezed beat. | The drone swells, **holds for its whole duration**, then releases. ▶ play gives it 1.5 s of drone first, plays the question at the asker's own pace (`timeline.naturalBeatS`), and holds the drone 3.5 s past the question. **Measured offline:** the drone sits at −34.5 dB(A) from 1 s until 3 s after the held note ends. |
| 7 | The answers were too quiet; Ives's crescendo stopped short. | The answer levels live in one table, `ANSWER_MIX` in `question-lab.js`. **Measured (four offline renders, A-weighted per segment):** askings −21.8 to −23.0 dB(A); answer 1 −27.0 to −27.8 (about 5 dB under the asker, still attempting); answer 2 −19.8 to −20.3 (about 2 dB over the asker, the outburst that is the climax); then the drone or strings alone at −33 to −35. |
| 8 | 31 % of "fifth" doublings were wolves or tritones. | `doublingOf()`: the second rank takes a **pure** interval above, inside the scale. That is a just fifth where the scale has one; otherwise the nearest pure third, sixth or fourth. In ionian, re takes ti (a 5/3 sixth) and ti takes re′ (a 6/5 third). **Measured independently in the lab from the monzos:** ionian fifth 70 %, m3 16 %, M6 14 %; penta fifth 62 %, m3 22 %, fourth 16 %. Nothing impure in any mode. The lab card names the intervals it used. *On the critic's alternative:* a fourth below is the fifth's own inversion, so it is exactly as impure as the fifth it replaces. That is why I went to the third or sixth instead. |
| 9 | `excludeLines` wasn't transposition-invariant and never fired. | A hymn window now matches by semitones (any octave) **or** by steps of the mode's own scale (`scaleIndex`: the pentatonic counts five to the octave). So the same tune moved up or down the scale is refused too. **Lab self-test, 200 visits × 6 modes:** refused 200/200 each for verbatim, inside a longer line, moved up two scale steps, and an octave down. The six stand-in lines refuse nothing, and the lab says so. |
| 10 | The handoff's range text was wrong. | Corrected below. The range is laˌ … la′ (degrees −2 … 12), at most a twelfth end to end. Generated questions start between do and la. |
| 11 | The chorale doubled the bass at the unison in gapped modes. | The inner voices are searched only above the bass. If fewer than two chord tones lie between bass and tune, the basses drop an octave: an open, four-part voicing with no unisons. **Measured:** 0 of 1511 chords are not four distinct rising parts, in every mode. |
| 12 | The answer ceiling grew without limit; `degsOf` threw on null. | Every answer voice, the second rank included, stays at or under la′′ (degree 19) for any k. The walk's ceiling now wins over its floor, and a rank that would pass the top drops an octave (the same pure interval, below). **Measured:** 752 760 answer notes for k up to 8, 0 out of scale, 0 over la′′, 0 repeated notes in a line. `degsOf` skips null and non-numeric elements. |
| 13 | The integration notes left gaps. | Covered in the new integration notes below: claiming the air, the key, sections that must carry durations (bare names now give `fits: null`, not `true`), and the chorale's rest between passes (`chorale.loopGapBeats`, 2). |
| 14 | Polish: JSON-able stats, `next()`, a second die on the pick fork. | `bank()` returns `{questions, stats}`, and the stats survive `JSON.stringify`. There is no `stream.next()` any more: `rnd(0, 1)` returns the identical value and is in SCORE §3's list. The asker's pace comes from its own fork, `question:<n>:pick:pace`. `answers(q, k, material, stream, mode)` takes `mode`, not `lattice`. `walk()` draws four dice per note, so the fling direction, the length and the step off a repeat no longer share one die. |
| 15 | The lab's stats hid the clustering; 390 px layout; crowded flats. | The stats are now one card per mode, stacked on a phone (no scroller). Each card shows: pitch-only distinct next to with-rhythm distinct; the three commonest phrases with counts; endings and starts as percentages; triad-leap and arpeggio counts; the bend's lawfulness; repeats across the visit; the second rank's intervals; the chorale's voicing; the hymn-line self-test; and seats with their squeeze (own pace / answers cut / breaths / hurried). A flatted note gets 9 px of its own before it, so the ♭ no longer crowds the previous flag. |

## The API now

```
bank(stream)                                   → { questions: [7], stats }   once per visit, from question:bank
eligible(bank, mode, {excludeLines})           → { pool: [sung questions], out: [{index, id, why}] }
pick(bank, stream, {mode, recent, excludeLines}) → a sung question, or null (never seen)
spellIn(writtenQuestion, mode)                 → a sung question, or null
askings(q, stream) · answers(q, k, material, stream, mode) · ground(stream) · chorale(material, stream, mode)
seat(stream, sections, {needS, naturalS})      → { section, index, capS, sectionS, plannedS, stretched, fit } | null
timeline(parts, {beatS, capS, tailS})          → { items, total, answers, beatS, naturalBeatS, gapMul, tailS, keep, pressure, capS, fits }
naturalS(parts, opts) · minimumS(parts, opts) · trimAnswer(answer, keep)
compose(question:<n> stream, { bank, mode, n, recent, material, excludeLines, sections, beatS?, tailS?, questionId? })
rules · selfTests · evaluate · matchesLine · scaleIndex · spell · monzo · ratio · ratioOf · cents · doublingOf · oldQuestion
```

- **The bank's streams:** `question:bank` forks `plan` (the shuffle of families and the six endings), `slot:<i>` (a slot's length, rhythm and start), `slot:<i>:again:<r>` (a fresh shape if 500 tries fail; 89 reshapes in 1000 visits) and `…:try:<j>` (one attempt each).
- **Bank cost:** 3.5 ms per visit on this Mac (Node). The median is 295 attempts per bank and the most in 1000 visits was 1750. No bank was ever short, and the reserve was never used.
- **The written question:** `{id, degs, beats, fromBank: "old"|"gen", index, family: "penta"|"hexa"|"any"}`.
- **The sung question:** `{id, index, fromBank, mode, degs (spelled), written (degs as written), beats, monzos}`.
- **Answers:** a trimmed answer's voices carry `kept`/`of`, and `compose` also returns the untrimmed `answersFull` when anything was cut. Second-rank notes carry `interval`.
- **`compose()` breaking change from round 1:** it **requires `opts.bank`** and throws a clear error without it. It returns `{n, mode, question, pool, stepAside, askings, answers, answersFull, ground, chorale, seat, naturalS, needS, timeline}`. `questionId` lets a bench name the question to perform; the pick's die is drawn all the same.

## Spelling into a mode

- **The diatonic modes** sing a question as written. The bank only keeps questions lawful as written in all four.
- **The gapped modes:** each note on a missing degree (penta has no fa or ti; hexa has no ti) either folds down, as v0.30's `projDeg` did, or steps up to the next tone the scale has. The first combination that keeps every rule and the self-tests is sung, trying folds first. If none does, the question sits the meeting out.
- **Two questions that spell into the same notes:** only the first stays in the pool.
- **What each mode can ask, per visit** (the old one included; the old one is always spelled as `projDeg` sounded it):

  | mode | questions it can ask |
  |---|---|
  | ionian, mixolydian, dorian, aeolian | 7 of 7, always |
  | hexa | 5–7, mean 6.3 |
  | penta | 4–7, mean 4.6 |

## The hard rules (corrected)

- **Notes and scale:** 5 or 6 notes, spelled only in degrees the mode has.
- **Start and rise:** it starts between do and la and moves up first. It never dips to or below its first note, and ends at least a fourth higher.
- **Leaps:**
  - at least one leap of a sixth or seventh (790–1130 ¢), and at least two leaps of a third or more;
  - at least one change of direction;
  - no repeated notes, and no leap over 1150 ¢.
- **Ending:** on re, fa, la or ti (outside the tonic triad), at la or above.
- **The last note:** it is the highest or second-highest, and is never reached by a fall wider than a third.
- **Range:** laˌ … la′ (degrees −2 … 12), at most a twelfth from lowest to highest. Generated questions start do…la, so in practice they span do…la′.
- **Rhythm:** in the long–short–short–long–held family.
- **The critic's self-tests (not rules):** too stepwise; fewer than 4 pitch classes; circling; a triad leap; an arpeggio; two great leaps. Then, against the bank, similarity to a sister or the old one; and at the draw, a match with a hymn line.

## Measured (short checks, per house rules)

- **The lab's stats panel:** 200 visits, all six modes. Its rule check is its own restatement from plain ratios.
- **Node:** 300–1000 visits.
- **Offline renders** in muted headless Chrome.

| check | result |
|---|---|
| rule compliance of every new question as sung, all six modes | 100 % (ionian 1200/1200 … penta 724/724) |
| distinct by pitch, 200 visits (lab) | ionian 770/1200 · penta 332/724 · hexa 619/1064 |
| commonest phrase, 300 visits | ionian 0.72 % (round 1: 0.89 %) · penta 1.75 % (round 1: 4.5 %) |
| perplexity (effective vocabulary), 300 visits | ionian 778 (round 1: 892) · penta 287 (round 1: 149) |
| chance two visits' first-meeting questions coincide, 300 visits | ionian 0.13 % (round 1: 0.10 %) · penta 0.28 % (round 1: 1.39 %) |
| two visits share any question at all | 4.4 % (ionian) · 4.7 % (penta) |
| askings | 1st and 3rd verbatim 200/200; 2nd bent and still lawful 200/200 |
| answers | in the scale 100 %; the 2nd higher 193–197/200 and faster 200/200 |
| chorale ground | 32.9 % over 3000 seeds |
| fits its cap | 200/200; 1800/1800 in Node |
| determinism | same streams give the same JSON; the bank survives a JSON round trip; loads under `window = {}` |
| lab | 0 console messages at 1100 and 390 px; no horizontal overflow; the live controls work (play, stop, ▶ play, ask this one, meeting chips, mode, room, reseed stops playback) |
| audio (4 offline renders) | peak ≤ 0.645, 0 clipped samples, 0 clicks; levels as in row 7 above |

**A trade, stated plainly:** the diatonic vocabulary is a little smaller than round 1's, and the pentatonic's has doubled.

- **Diatonic:** raw distinct 770 vs 844 per 1200; effective vocabulary 778 vs 892. Two things cost it:
  - half the bank is now written in the smaller pentatonic, so Shaker Sundays have questions of their own;
  - the critic's taste tests (no triad leaps, no arpeggios, one great leap) remove much of what round 1 counted, which was often bugle calls.
- **Pentatonic** (the Shaker/Primary lean, often heard): effective vocabulary 149 → 287, and the commonest phrase 4.5 % → 1.75 %.
- **The practical measure, two visits hearing the same first question:** 0.10 % → 0.13 % diatonic and 1.39 % → 0.28 % pentatonic. Diatonic stays near one pair of visits in a thousand.
- **If the owner wants the diatonic tail back,** writing only two slots in the pentatonic trades some of the pentatonic's gain for it. It is a one-line change: `FAMILIES`.

**Seats and squeeze (lab plan, ionian meeting 1, 600 visits).** The Question's own length is 41 / 45 / 53 s at p10 / p50 / p90; its most hurried form is 27 / 29 / 36 s.

| | sections as planned (v0.30 lengths) | FORM grants `stretchTo: 125` on invocation, interlude, postlude |
|---|---|---|
| where it sits | sacrament 44 %, testimony 39 %, invocation 16 %, postlude 1 %, interlude under 1 % | invocation 31 %, testimony 25 %, sacrament 23 %, postlude 19 %, interlude 2 % |
| invocation | squeezed in 88 % of its seats: the answers cut in 88 %, the breaths shortened in 58 %, the asker hurried in 29 % (round 1: 70 %) | at its own pace in 182 of 187 seats; the other 5 lose only a few answer notes |
| all seats | the asker hurried in 5.7 % of all Questions | never hurried; the host section asks FORM for 85 / 101 / 125 s (min / median / max) |

## How to hear and see it

1. Start the server: `php -S 127.0.0.1:8103 -t <worktree>`.
2. Open **http://127.0.0.1:8103/art/kolob/question-lab.php**.

Controls:

- **seed** (a visit), with ‹ ›;
- **mode** (all six);
- **meeting** 1–6;
- **material** (stand-in hymn lines, or none);
- **ground** (as drawn, drone, chorale);
- **room** (sections as planned, or FORM may stretch the host to 125 s).

The page shows:

- **The visit:** which question meetings 1–6 ask, the last heard stepping aside. Click a meeting to see it.
- **The seven questions** as this meeting's mode sings them. A note the gapped scale moves is shown in the warm colour. A question that can't be sung here is drawn dashed, with the reason.
- **▶ play:** one question over the drone, at the asker's own pace.
- **ask this one:** perform any of them.
- **▶ play full question:** the whole event, with the playhead.

| seed | mode | meeting | what you hear |
|---|---|---|---|
| 1 | ionian | 1 → 2 → 3 | new·3, new·2, then the old one: the visit's questions coming round, each at its own pace (testimony, testimony, sacrament) |
| 5 | ionian | 1 | an invocation seat squeezed hard (pressure 0.86: answers broken off, breaths shortened), with the strings' chorale. Switch **room** to FORM and the same meeting runs at its own pace. |
| 3 | penta | 1 | a pentatonic question under the chorale, in the invocation |
| 7 | penta | 1 | new·3 over the drone alone |
| 14 | ionian | 1 | the old one under the chorale, in the sacrament; with FORM's room it moves to the postlude, as the room empties |
| 12 | aeolian | 1 | the flats' spacing on the staff; the chorale ground |

**Silent measurement** for the next crew: `QuestionLab.renderOffline({seed, mode, n, ground, room, question?, solo?})` renders to an `OfflineAudioContext` and resolves to `{buffer, segments}`. My muted CDP driver (A-weighted per-segment levels, peaks, clicks, spectrogram) is at `/private/tmp/claude-501/kolob-question/r2/drive.js`.

## Integration notes for the next wave (these replace round 1's)

```js
// ONCE PER VISIT (the facade): the bank, and the ids heard so far
var qBank = KOLOB.Question.bank(root.fork("question:bank"));
var qHeard = [];                                   // oldest first

// PER MEETING n, when GUEST/FORM plan a Question — AFTER the meeting's hymns are composed
var ev = KOLOB.Question.compose(root.fork("question:" + n), {
  bank: qBank, mode: meeting.mode, n: n, recent: qHeard.slice(),
  material: hymnLines,          // melody-part lines of the meeting's hymns (Note arrays or degree arrays)
  excludeLines: hymnLines,      // a question never matches one (tested here, in this meeting's mode)
  sections: plan.map(function (s) { return { type: s.type, dur: s.dur, stretchTo: s.stretchTo }; })
});
if (ev && ev.seat) {
  qHeard.push(ev.question.id);
  if (ev.seat.stretched) plan[ev.seat.index].dur = ev.seat.sectionS;   // FORM's grant, taken
  // Guest.plan → { section: ev.seat.section, dur: ev.timeline.total }
}
```

- **Order:** compose the meeting's hymns (at least their melodies) before the Question. `excludeLines` is tested at the draw. The composers are pure and forked, so the order costs nothing.
- **Durations:** always pass `{type, dur}`. With bare names there is no cap (`capS: null`, `timeline.fits: null`), and so no overrun protection.
- **When nothing can be asked:** if `compose` returns null (nothing in the bank can be sung this meeting; never seen) or `ev.seat` is null (no room), this meeting has no Question, and `qHeard` is unchanged.
- **Timing:** start it so that `start + ev.timeline.total ≤` the section's end.
- **Claim the air for the whole event,** as v0.30 did (`claimAir(total − 4, 6)` at kolob-audio.js:2408). The meeting then holds back and the drone is left alone with the last asking.
- **Perform:** each `timeline.items[i]` sits at `start + item.t`, with note lengths `beats × timeline.beatS`.
  - **`asking` k:** play `ev.askings[k]` from `+ offsetBeats × beatS`, and emit `question-asking {k, questionId}`.
  - **`answer` k:** play each `ev.answers[k].voices[v]` from `+ entryBeats × beatS`. The roles are the harmonium answer, the second rank (the doubling) and the clarinet answer. Levels: see `ANSWER_MIX` in the lab (answer 1 about 5 dB under the asker, answer 2 about 2 dB over).
  - **`unanswered`:** emit `question-unanswered {}` at `item.t + 1.5 s` (v0.30's timing), then the drone alone or the strings playing on.
- **Key and pitch:** the Question sounds in the **day's keynote** (`keyMonzo [0,0,0,0]`) unless FORM chooses otherwise. The invocation may have no current hymn. The answers use hymn material only as degree shapes, so they work in any key, and the chorale is spelled in the same do.
  - The asker and the answers sound at `Hz = keynoteHz × ratio(keyMonzo) × ratioOf(note.monzo) × 2`, an octave above the choir's do, as v0.30 did.
  - The chorale sounds at the do octave (no ×2).
  - Every sounded note goes to `onNote` with its `deg` and `monzo`, doublings included.
- **Ground:** the drone stays in both cases.
  - For `ground === "chorale"`, loop `ev.chorale.chords` at `ev.chorale.beatS` under the whole event, quietly.
  - Rest `ev.chorale.loopGapBeats` (2) beats between passes.
- **Voices to carry into `kolob-voices-*`:**
  - the harmonium's bellows in their own gain;
  - oscillators stopped only after their envelope reaches 0;
  - the harmonium's dark body path;
  - the drone that holds for its whole duration.

## Requests to the integrator (these replace round 1's)

1. **SCORE §3.**
   - Please list `pace` under `question:<n>:pick`. It is the asker's pace, forked so that `pick` may grow dice without changing every meeting's tempo.
   - For information, `question:bank`'s own sub-labels are `plan`, `slot:<i>`, `again:<r>` and `try:<j>`.
2. **SCORE §5.2.** Please extend the shapes to what the module returns:
   - the **written question** `{id, degs, beats, fromBank, index, family}`;
   - the **sung question** `{id, index, fromBank, mode, degs, written, beats, monzos}`;
   - the **Bank** `{questions, stats}`;
   - the **Asking** `{k, questionId, degs, beats, offsetBeats, bent, monzos}`;
   - the **Answer** `{k, questionId, mode, from, develop, delayBeats, restBeats, durBeats, voices: [{voice, role, entryBeats, notes: [{deg, beats, monzo, interval?}], kept?, of?}]}`;
   - the **Chorale** `{beatS, loopGapBeats, chords: [{beats, degs, monzos}]}`.
3. **FORM (kolob-meeting.js): room for the Question.** With v0.30's section lengths the Question now avoids rooms where it would hurry. It sits mostly in the sacrament and testimony, rarely in the invocation, and almost never in the postlude.
   - **To make the invocation its home again, or to hear "a question left hanging as the room empties",** pass `stretchTo: 125` on the invocation, any interlude and the postlude. The seat then asks for exactly what it needs (`seat.sectionS`: 101 s median, never more than the grant), and FORM sets that section's duration. With that grant the Question never hurries.
   - **Owner decision:** grant the room, or leave the Question to the testimony and sacrament.
4. **Who asks** (carried over from round 1). v0.30's asker is the clarinet, and §8.1 makes the clarinet a second *answerer* too. The lab keeps the clarinet as the asker (central, louder) and a quieter panned clarinet as the second answerer. An owner decision is needed on a distinct asking voice (a cornet or trumpet from the S sound labs, as Ives would want).
5. **Load order.** Add `kolob-question.js` to `$kolob_assets` in `index.php` when wiring it in (SCORE §1, step 3).
6. **Memory across meetings.** The facade must hold `qBank` and `qHeard` for the whole visit. The facade owns them; the module keeps no state.
   - **What `recent` does:** the most recently heard questions step aside. That is always the last one, plus as many before it as still leave two to choose between.
   - **Example:** a pentatonic visit with five askable questions goes round all five before any repeats, and never settles into an order.

## Known issues

- **The invocation without FORM's grant.** When it does host the Question (16 %), the event is squeezed in most seats and the asker hurried in 29 % of them. This is the design tension request 3 asks FORM to settle.
- **Penta is still the smallest vocabulary.** It is 4–7 askable questions per visit (the old one, the three written in the pentatonic, and any other whose fold works), with an effective vocabulary of 287. The commonest phrase is 1.7 % of pentatonic questions.
- **Rhythm is still ten templates** (the second look's polish item). The rhythm-inclusive distinct count is higher than pitch-only (ionian 1057 vs 770), but a cheap place for more variety remains: a fermata multiplier on the held note, or an optional pickup, drawn from the bank.
- **The old one is exempt from the rules,** as before; its widest leap is a fourth. In aeolian it sounds sol–le–re′–te–re′, with a 590 ¢ tritone from le to re′.
- **Stand-in material.** The answers' material and the `excludeLines` are six stand-in lines until the composer lands. The self-test proves the exclusion works; the stand-ins exclude nothing.
- **Answers for k ≥ 2 are latent.** `compose` asks for k = 0 and 1 only. Higher k stays on the instrument (at or under la′′) and in the scale.
