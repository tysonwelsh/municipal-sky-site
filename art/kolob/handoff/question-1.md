# Handoff — crew Q (the Question), milestone 1

*Branch `kolob-question`, 2026-09-26. Lab and dev work only, so no VERSION bump.*

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
