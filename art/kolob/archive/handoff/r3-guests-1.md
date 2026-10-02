> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r3-guests-1: the ward's handbell choir, and the singing school

*GUEST crew, round 3. Branch `kolob-r3-guests`. 2026-09-28.*

> **Read "Round 2" at the end first.** It corrects this note in three
> places: where the brushing sound between the notes comes from (the *f*
> and *s* of "fa" and "sol", not the tick this note ranked first); how
> loud the bells were (louder than this note said; they are now 2 dB
> quieter); and how the engine should seat the two guests (the practice
> first, and the bells through a near send).

**What is new to hear:** two new guests, both built as modules the engine
can seat, and a lab to hear them in. Neither plays in a meeting yet; the
integrator wires them in a later step (the requests below say how).
Nothing was pushed or published, and VERSION is not bumped.

- **The ward's handbell choir.** Eight to twelve ringers stand in a line
  across the front of the chapel, low bells at one end and high bells at the
  other. As the tune moves up and down, it hops across the stereo field
  from ringer to ringer. They ring the day's hymn, or a round of their own,
  with real handbell technique, and finish with a cascade down the line.
  It is the first guest that stands **in** the room: close, bright and dry.
- **The singing school (experimental).** On some Sundays you arrive while
  the choir is still practising. The chorister strikes a tuning fork, the
  choir sings the first line of the day's first hymn, and one section goes
  plainly wrong. She raps the stand and they stop. That section sings the
  passage alone, slowly, on the shape-note syllables (fa, sol, la, mi), and
  then everyone sings it again, right.
- **A switch for experiments.** `KOLOB.Experimental` is a small registry
  that the engine asks before seating any experimental feature. It has one
  entry, the singing school, on by default. It can be turned off for one
  visit from the address bar, or for this browser from the console.

Nobody has listened to any of this yet. Every check below is a measurement
made with the sound muted. The ear is still to come.

---

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8145 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-guests`
   (Port 8135 was assigned to this crew, but the organist crew's server
   took it halfway through the round, so this note uses 8145.)
2. Open **http://127.0.0.1:8145/art/kolob/guests-lab.php**
3. Pick a **dialect** and a **seed**. The composer writes a hymn from them,
   and its name appears under the controls. Then:
   - press **▶ ring** for the handbells;
   - press **▶ the practice** for the singing school.

   **compose another** moves on to the next seed.

A link can carry the settings:
`guests-lab.php?seed=2&dialect=tabernacle&piece=hymn&seat=postlude`. The
keys are `seed`, `dialect`, `mode`, `key`, `piece` (`hymn` / `round`), `seat`
(`invocation` / `sacrament` / `postlude`) and `exp`.

### The handbells: what to listen for

| seed | dialect | what it is | listen for |
|---|---|---|---|
| 2 | Tabernacle | NEW HANDCART, rung twice | Verse one is plain: each bell is stopped as the next one rings. In verse two the low bells are struck down on the padded table (martellato: a bright knock with a thump, stopped at once) under the ringing tune. The tune's long notes are **shaken** (a trembling, sustained bell). Then a cascade of every bell, top to bottom. |
| 7 | Tabernacle | BOUNTIFUL | In verse two the tune moves down into the big bells, and the harmony above it rings as chords, each let ring until the next. The cascade is only the home chord's bells. |
| 4 | Tabernacle | LAMPLIGHT HILL (dorian) | It opens with **rounds**: six bells rung in order twice, the way tower bells start. Handbells were made so tower ringers could practise indoors. Verse two has a slow descant in the top bells. |
| 6 | Tabernacle | a round | A three-voice round in 3/4. The first voice is in the middle of the line, the second enters from the top and the third from the bottom, so the voices arrive from different places. The long notes ring on, the walking notes are stopped, and the running notes are thumb-damped (short plinks). Then the whole line rings the home chord, and the cascade follows. |
| 8 | Sacred Harp, **ring: a round** | a four-voice round in aeolian | The fourth voice is a low "ding-dong" struck on the table. |
| 3 | the Old Way | MORNING STAR | A tune sung in unison has no harmony to ring. The bells ring it in octaves over their own open fifth (do and sol, low in the line) and shake its long notes. |
| 1 | Tabernacle, **seat: before the sacrament** | NAUVOO | The reverent version: softer, never on the table, with the tune in the bass bells or a descant. |

**The main question:** does it sound like a handbell choir? That means:

- bright, bell-like strokes;
- chords that ring and then stop together at each breath;
- the tune walking across the stereo field.

**Also worth trying:**
- **one bell, every technique.** One bell is rung six ways in a row:
  1. let ring;
  2. damped at the shoulder;
  3. martellato;
  4. thumb damp;
  5. shaken, then damped;
  6. struck again while it still rings.
- **down the line.** Every bell in the set, rung from low to high: you hear
  where each ringer stands.
- **the comma bells.** A note the hymn sings at two slightly different
  pitches, a comma apart (21.5 cents). The colony's set has a bell for each,
  held by the same ringer. You hear them alone, then together.
- **a phone's cap.** With the box ticked, at most 12 bells ring at once
  instead of 20. Listen for bells being stopped early in the thick
  passages.

### The singing school: what to listen for

| seed | dialect | the lesson |
|---|---|---|
| 4 | Tabernacle | The tenors climb where their line turns down: a major second against the sopranos. |
| 7 | Tabernacle | The altos come in a beat late: a seventh against the sopranos, twice. |
| 3 | Sacred Harp | The tenors carry the tune here, so this is literally "the tenors climb where the tune turns down": a seventh against the trebles. |
| 8 | the Old Way | The women come in a beat late, against the men singing the tune an octave down. |
| 1 | the Old Way | The men hold on where the tune turns down: a second against the women. |

**The practice, in order (30–46 s):**

1. **The fork.** A small "tink" and a pure tone. The chorister sets its stem
   on the stand and it grows louder, because the wood sings it.
2. **The pitch.** She hums the fork's note and sings the home note on its
   shape syllable. The sections hum their first notes together: the chord
   the hymn starts on.
3. **The first try.** The choir sings, and one section goes wrong. Listen
   for a real sour clash, not a slight mistuning.
4. **The stop.** Two raps on the music stand. The choir stops raggedly, and
   the section that went wrong stops last.
5. **The section alone.** She gives that section its note (for a quick tune,
   she sings them the whole passage first). They sing it alone, slowly, on
   fa-sol-la-mi.
6. **Again.** Two soft raps set the beat, and everyone sings from the top
   (or the pickup) through the cadence, correctly. For a short line they
   carry on through line 2.

**The question:** does it read as a charming rehearsal rather than a glitch?

**The switch.** The card has a checkbox, "seated in meetings". It is what
the engine will obey. The lab plays the practice either way.

---

## What shipped

| commit | what |
|---|---|
| `95f4af76` | `kolob-guest-handbells.js`, `kolob-guest-singingschool.js`, `kolob-experimental.js`, the handbell voice in `kolob-voices-folk.js`, `guests-lab.php` and `guests-lab.js` |
| `d3e7e0ce` | Every hymn the bells ring now uses more than one setting. A broader pace. The practice's second pass is sung in one breath group, which halves its nodes. Levels are set against the organ reference. |
| `cf9d3212` | A "door" on each sung line of the practice (see the breath/brushing section below). A bell is silent from its birth. The tune in the bass bells is kept whole. A legato re-strike stays one ring. The round's last chord is softer. |
| (this) | this note |

### `KOLOB.GuestHandbells` (`kolob-guest-handbells.js`)

It uses the trombones' interface: `plan(meetingInfo, stream)` → a seat or
null; `perform(ctx, dest, t, material, stream, hooks)` → the end time. It
also has `decide`, `prepare`, `score` and `round`. Streams are
`guest:handbells:<n>`, with forks `seat`, `shape`, `material` and `synth`.

**The seat.**
- About one meeting in eight.
- It sits in the invocation, at the opening of the sacrament ("before the
  sacrament"), or in the postlude.
- It is weighted toward:
  - jubilee Sundays (18 %);
  - Christmas, Easter and weddings, once the calendar names them (×2.4–2.8).
- It is weighted away from fast Sundays (5 %).
- It is never seated:
  - with the steeples;
  - with another bell guest (the steeples, the Primary);
  - in a section that holds a guest, or next to one (PLAN §8.13).
- Every die is thrown before any refusal.

**The music.**
- **Material:** the day's hymn (any SCORE §5 Hymn), or a round it composes
  itself. HYMN has not written rounds yet; the module takes theirs when it
  exists, as `material.round`.
- **The hymn:** an optional introduction, then two settings chosen from:
  - plain;
  - martellato with shakes;
  - the tune in the bass bells;
  - a descant;
  - the tune in octaves (for a unison tune).

  When the hymn is rung twice it gets one setting per verse; when it is rung
  once, the setting changes halfway. Then the last chord and the cascade.
- **The round:** a two-chord ground chosen so that every tone is just in the
  mode (the bells are fixed pitches), with three or four two-bar phrases and
  voices in different octaves.
- **Length:** 35–75 s.

**The bells.**
- The set holds every pitch the Score names, including the comma bells and
  accidentals, and fills in every scale step between its ends. That comes to
  16–35 bells, from E3 to E7.
- They are laid out on 8–12 ringers, the bass at the audience's right three
  times in four.

**The live cap.** At most 20 rings sound at once (12 when
`material.phone` is set). Beyond that, the oldest ringing bell is damped
when a new one strikes.

### The handbell voice (`kolob-voices-folk.js`, the handbell section only)

- **`folk.ring(t, {f, v, tech, hits, damp, until, shake, dest})`.** A ring
  is one bell sounding. It can be struck again while it rings, and each new
  stroke adds to the ring rather than starting a second copy of the bell.
- **Techniques:** `ring` (let vibrate), `damp`, `mart` (martellato, a pad
  thump), `thumb` and `shake` (a clapper roll that can start on a later
  stroke).
- **Partials:**
  - the fundamental and the twelfth, both exact: 3:1, so every bell carries
    a pure fifth;
  - a faint doublet;
  - two untuned upper partials, fixed per bell by its pitch.
- **Cost:** 11 nodes a ring, however many strokes; 12 if it makes its own
  panner.
- **Compatibility:** `handbell()` and `handbells()` keep their round-2
  calls. The instruments lab's Primary song now plays through the new
  voice, which sounds a little different.
- `KOLOB.VoicesFolk.bell.{tau, life, casting}` are exported as pure
  functions.

### `KOLOB.GuestSingingSchool` (`kolob-guest-singingschool.js`)

**The interface** is the same: `plan`, `decide`, `prepare`, `lesson`,
`score` and `perform`. Streams are `guest:singingschool:<n>`, with forks
`seat`, `lesson`, `vowels`, `material` and `synth`.

**The seat.**
- The prelude only, about one Sunday in ten.
- Never at a funeral.
- Never when another guest holds the prelude.
- Refused when `KOLOB.Experimental` says it is off.
- The engine may pass `meetingInfo.experimental`, and should, so that the
  planner stays pure.

**The lesson.** The planner tries each place where the part turns down,
picks the one whose wrong note clashes (a second, a seventh or a tritone
against another part), and prefers a clash against the tune or the bass.
A late entry must make at least two clashes. A fallback finds a clashing
wrong note if neither kind works.

**The voices.** Eight `VoicesVocal` desks of three people each, plus one
chorister. The fork and the raps on the stand are synthesized in the
module itself.

### `KOLOB.Experimental` (`kolob-experimental.js`)

**What it holds.** `DEFAULTS = { singingSchool: true }`. The owner can
retire the feature for everyone by changing that one word in the file.

**How to switch it:**
- in the address:
  - `?exp=-singingSchool` turns it off for the visit;
  - `?exp=+singingSchool` turns it on;
  - `?exp=none` and `?exp=all` turn every feature off or on;
- in the console: `KOLOB.Experimental.off("singingSchool")` / `.on(...)` /
  `.set(name, on)`. This is remembered by the browser until
  `KOLOB.Experimental.reset()`.

**Reading it.** `list()` and `snapshot()` show the current state. In Node,
every feature stands at its default.

### `guests-lab.php` and `guests-lab.js`

- **Audition:** both guests, with hymns composed in all three dialects.
  There are menus for the piece, the seat and the phone cap, the bells'
  demonstrations, and the experimental switch. The ringer who strikes
  lights up in the line diagram as the bells play.
- **Check:** renders offline through the app's chain and measures the
  things listed in the table below.
- **Odds:** runs `plan()` over 20,000 meetings of a stand-in planner.
- **Purity:** plans and scores everything twice on the same stream and
  compares the results.

---

## How it was checked (all silent)

Muted headless Chrome over CDP on port 9455 (profile
`kolob-guests-chrome`), and Node for the pure parts.

| check | result |
|---|---|
| lab at 860 and 390 px | 0 console errors after clicking every play, check, menu, the switch and the odds; no sideways scroll |
| purity | every plan, score and lesson is identical when run twice on the same stream; 0 `Math.random` calls; the voice's decay law agrees with the score's copy of it |
| the twelfth, measured on a rendered bell | ×3.0001 (+0.04 cents from a pure 3:1) |
| the stereo line (every bell of a 35-bell set, low to high) | from +15.9 dB right to −15.5 dB left, in order (rank correlation of pitch against side −0.995) |
| handbell loudness against the v0.30 organ reference | a hymn: integrated −20.6 to −21.8 LUFS, loudest 3 s +1.5 to +2.5 LU; the sacrament seat −3.6 LU; a round +3.5 LU at its loudest 3 s (last chord and cascade; since softened) |
| clicks (bursts nothing scheduled) | bells: 0 in every render (four hymns, three rounds, the technique and line demonstrations, the phone cap). The practice: 0 after the door (it was 3 in one Old Way render; see below) |
| nodes | ≤ 11 a ring in performance (12 in the demonstrations, which give each ring its own panner); 111–254 live at the peak with the cap at 20; the phone cap holds 12 rings. The practice: about 360–420 singer nodes at its peak, about 200 on average |
| the bells' technique envelopes (one bell, dry) | let ring: −20 dB at 2.3 s (C5); damped: at the damp; martellato: −20 dB in 0.19 s; thumb damp: 0.32 s; the shake builds for its whole length, then stops |
| the odds (stand-in planner, 20,000 meetings) | handbells 12.7 % (ordinary 12.6, fast 4.8, conference 15.4, jubilee 17.7); seats: invocation 38 %, sacrament 26 %, postlude 36 %; hymn 57 %, round 43 %. Singing school 10.1 %; 0 % with the switch off |
| the singing school's length and lesson (60 hymns in each of the three dialects) | 30.2–45.6 s; every lesson has a real clash (a second, seventh or tritone, checked against the sounding parts); 0 fallbacks |
| the handbells' length (270 performances across the three dialects × three seats) | 35–75 s; 8–12 ringers; the live cap reached in dense passages |

---

## The owner's note: "the breath or brushing sound between notes"

This is not in my files, but I looked, because the singing school sings
through the same voices. I measured three things, from most to least
likely to be the sound the owner means.

1. **VoicesVocal has a click at the start of every sung line (confirmed).**

   Every call to `sing()` builds a "throat" 0.45 s before the line's first
   vowel. Its breath-noise source starts on the same sample as its gains'
   first automation, and for that one sample the gains still stand at their
   default of 1. One sample of white noise gets through: −37 dBFS from a
   single desk.

   hymn-lab hands each of its 32 singers each line separately. So in every
   breath between lines, 32 of these ticks fire at the same instant, and
   the tabernacle reverb turns them into a small "tss".

   Starting the noise 3 ms later removes the tick entirely (tested: one
   nonzero sample becomes zero).

   **The fix is one line in `kolob-voices-vocal.js`, `renderLine`:** either
   `noise.start(born + 0.003, …)`, or create the gains at `gain.value = 0`
   before they are automated. It belongs to the voice's owner (CAST); I did
   not touch it. The singing school works around it with a per-line gain
   "door", shut for the throat's first 4 ms.

2. **The organ's chiff.**

   Every organ key speaks with a 20–50 ms breath of noise.

   | registration | extra energy above 1.5 kHz at each onset |
   |---|---|
   | hymn principal | +0.5 to +1.5 dB |
   | quiet flute | +11 dB (4–9 kHz) |

   hymn-lab's organ doubles every sung note, so a chiff falls on every
   chord change. That is a breath "between notes" whenever the organ plays
   flutes.

   The level is one number: `CHIFF_LEVEL` in `kolob-voices-pipeorgan.js`.
   Another option is to chiff only after a rest. That is the organ owner's
   call.

3. **The singers' own breath is not the cause.**

   | measurement | result |
   |---|---|
   | above 3 kHz, at note joins against the middles of notes | the same (±0.2 dB) for a singer and for a desk, with breath at 0.35 or 0 |
   | the exhale after each line | 0.25 s, about 35 dB under the singing |
   | the practice's own joins | −46.3 dB against −46.4 dB mid-note |

   The practice sings with breath 0.12–0.22 anyway.

**The owner's A/B test:** in hymn-lab, compare a Sacred Harp hymn (no organ;
item 1 only) with a Tabernacle hymn on the same seed (items 1 and 2). If
the brushing is in both, it is the tick; if it is only in the Tabernacle,
it is the chiff.

---

## Requests (for the integrator)

1. **Loading (`_engine.php`).**
   - Add `kolob-experimental.js` early: after the composers, before the
     voices.
   - Add `kolob-voices-folk.js` and `kolob-voices-vocal.js` to the voices
     (both are lab-only today).
   - Add `kolob-guest-handbells.js` and `kolob-guest-singingschool.js`
     beside `kolob-guest-trombones.js`.
   - Each file answers the load guard's roll call.
2. **Seating, in `planMeeting`, after the trombones.**

   ```js
   var X = KOLOB.Experimental ? KOLOB.Experimental.snapshot() : {};
   var ssInfo = { n, kind, sunday, sections: plan, guests: C.visitations, experimental: X, force: forcedType === "singingschool" };
   var ssSeat = KOLOB.GuestSingingSchool.plan(ssInfo, stream("guest:singingschool"));   // prelude only; refused if the trombones or another guest hold it
   var hbInfo = { n, kind, sunday, sections: plan, guests: C.visitations, force: forcedType === "handbells" };
   var hbSeat = KOLOB.GuestHandbells.plan(hbInfo, stream("guest:handbells"));            // after the steeples, the bands, the old tune
   ```

   - **Prepare the material at plan time**, as the trombones do. Then plan
     again with it, so the length is exact:
     - `GuestHandbells.prepare({ hymn: <the day's first hymn, or the last for the postlude>, keynoteHz: S.F0 * S.ROOT_MULT, seat: hbSeat.seat, phone }, stream)`;
     - `GuestSingingSchool.prepare({ hymn: <the day's first hymn>, keynoteHz }, stream)`.

     Until the engine sings composed hymns, both modules compose a
     Tabernacle hymn of their own when handed none. The integrator may
     prefer to hand them the same one the meeting will sing.
   - **Cue each guest** at its section's start plus `seat.at`, with its
     own clock (`CUED`, like the trombones). The section yields: hold it at
     least `holdUntil`.
   - **The house lets go** under both (the handbells stand in the room;
     the practice replaces the prelude's music for 30–46 s). Add them to
     `LISTENED`.
   - **Phones:** pass `phone: true` in the handbells' material. That caps
     them at 12 rings at once.
3. **SCORE.md, to adopt.**
   - **Streams:** `guest:handbells:<n>` (forks `seat`, `shape`,
     `material`, `synth`) and `guest:singingschool:<n>` (forks `seat`,
     `lesson`, `vowels`, `material`, `synth`).
   - **Layers:**
     - `handbells`: each note carries `ringer`, `bell`, `tech`, `role` and
       `pan`;
     - the practice's notes go on `choir`, with `stage` and `wrong`; the
       fork's note goes on `ambient`.
   - **`guest` event stages** (from the modules' `stages`):
     - handbells: `intro`, `verse`, `verse2`, `round-entry`, `final`,
       `cascade`;
     - singing school: `fork`, `try`, `cut`, `alone`, `again`.
   - **Forcing:** add `handbells` and `singingschool` to
     `setForceVisitation` / `FORCEABLE`. Forcing the school should bypass
     its roll but not its switch.
4. **ENGRAVE.** The handbells engrave as ringed heads (enrichment-2 §5).
   `tech` is on every note, if the engraver wants LV, mart and Sk marks.
5. **CAST.** Please take item 1 of the breath section above. The one-sample
   tick at every sung line's birth is in every `VoicesVocal` line,
   hymn-lab's included.

## Known issues

- **Nobody has listened.** The bells' colour needs the owner's ear:
  - the knock of the clapper;
  - how strong the twelfth is;
  - how often a hymn arrangement lets bells ring on.

  So does the practice's feel: whether the clash is charming or merely
  wrong, and how long the pauses are.
- **The comma bells.** A Tabernacle hymn can need 5–7 comma bells, making a
  set of 30–35. The colony's tuning makes that honest, but a real set has
  one bell per note. If the owner would rather hear one bell per note, that
  is a small change in `bellSet` (one pitch per letter; it would mistune
  some chords by a comma).
- **The rounds are the guest's own.** HYMN's rounds (§14.2) are not written
  yet. When they are, an adapter to `material.round` (phrases of
  `{bar, beat, beats, deg}` over a two-chord ground) is needed.
- **The live cap is reached in most hymn performances.** The oldest ringing
  bell is then damped early, a 50 ms fade. It sounds like a ringer's hand,
  but a phone (cap 12) damps noticeably more of the let-ring passages.
- **The click ruler cannot see a bell's stroke.** Strokes never stand
  21.6 dB clear of their surroundings, so the ruler shows only that nothing
  else does.
- **The singing school sings vowels,** drawn one per syllable, the same on
  both passes. Deseret words are for later. The chorister is always a
  woman's voice. Tabernacle lessons fall most often on the tenors (43 % of
  60 hymns; the altos 35 %, the basses 22 %), and a climb is more common
  than a late entry (60 % to 40 %).
- **The odds are measured on a stand-in planner.** It uses the engine's
  guests' dice as `kolob-meeting.js` throws them, and assumes the old
  tune's pool is non-empty 80 % of the time. The harness should re-measure
  once the engine seats these guests.
- **"Before the sacrament"** is read as the opening of the sacrament
  section. The integrator may prefer the tail of the section before it.

---

## Round 2 — the critic's ten findings

*The same crew, the same day. Everything below was measured with the
sound muted; nobody has listened yet.*

### For the owner, in plain words

**1. The brushing sound between the notes: what it is. (The one you
asked about; this corrects round 1.)**

You told us the breath or brushing sound "happens in between notes when
the hymns are being sung". Round 1 of this note said the likeliest cause
was a click in the singers' voice, and that the singers' own breath was
not the cause. The first half was wrong:

- **The click falls between lines, not between notes.** It is real (one
  sample of noise as each line's voice is built, 32 at once in the hymn
  lab), but it is not what you described. The cast crew's new voice
  (`kolob-r3-cast`, commit `af8e190c`) is born silent and has no click.
- **Between notes, the sound is the *f* and *s* of "fa" and "sol".** When
  the ward sings a verse *on the notes* (fa, sol, la, mi: the Sacred Harp's
  first verse in the hymn lab), all thirty-two singers say an *s* or an *f* at every note
  change. Each says it at a slightly different moment, so together they
  smear into a hiss about a tenth of a second long: your "air being
  released out of a tire". (The meeting's own choir does not use this
  voice yet, so this is a hymn-lab sound today; it arrives in the meeting
  with the ward's voice.)
- **On vowels it was a smaller thing.** The breath noise stayed at full
  strength while the voices dipped between notes, so each join was about
  1.5 dB breathier than the middle of a note. The cast crew's voice now
  lets the breath fall and rise with the voice.
- **In Tabernacle hymns in the hymn lab there is also the organ's chiff:**
  a short breath at every chord change, when the organ doubles the
  voices. That belongs to the organ crew (`CHIFF_LEVEL` in
  `kolob-voices-pipeorgan.js`); I have not touched it.

Measured: thirty-two singers (a throat each, as the full ward sings) sing
one line, dry. The table shows the noise against the tone: at the joins
between notes, and in the middle of the notes. The bigger the gap between
the two columns, the louder the burst at each note change.

| the voice | on the notes: joins (worst) | on the notes: mid-note | on vowels: joins (worst) | on vowels: mid-note |
|---|---|---|---|---|
| this branch (round 2 as it stands) | **−22.2 dB** (−12.6) | −35.4 dB | −33.9 (−32.7) | −35.4 |
| the cast crew's `af8e190c` | −29.7 (−23.9) | −35.0 | −36.3 (−33.6) | −35.5 |
| the cast crew's latest (`fa427196`) | **−32.6 (−29.2)** | −34.7 | −36.3 (−33.6) | −35.7 |

So, with the cast crew's latest voice, the burst at each note change is
down from 13 dB to about 2 dB, and the joins on vowels are quieter than
the middle of the notes. That voice is the fix for the hymns. It is not in
the meeting yet.

**2. The singing school no longer makes that sound.**

The heart of the practice is the section singing its passage alone *on
the notes*. That was the same sound: a burst of *f* and *s* 19–27 dB over
the middle of the notes with this branch's voice, and still 8–12 dB over
it (2–17 across seven practices) with the cast crew's softer consonants.
So now:

- **The section sings the shapes without the *f* and the *s*.** "La" and
  "mi" keep their *l* and *m*. "Fa" and "sol" are sung on their vowels,
  "ah" and "oh".
- **The chorister says all four syllables whole**, one clear voice, when
  she gives the note or sings the passage to them first. With this
  branch's older voice, whose single *s* is still loud, she leaves them
  out too. This choice is automatic.
- **A menu in the lab** ("the shapes' consonants") puts every consonant
  back, or takes them all out, so you can compare.

Measured in seven practices, dry: every stage the choir sings now sits at
its joins within about 3 dB of the middle of its notes, with either voice
(the table under "How it was checked"). The one exception is the
chorister's own *f* and *s* with the cast crew's voice, about 8 dB over
her notes. That is one person's diction, and it happens only when she
sings a quick tune's passage to them first (3 Sacred Harp hymns in 30).

The practice is therefore safe to seat with either voice. It will sound
best with the cast crew's, which sings more like people.

**3. The bells are 2 dB quieter, and much quieter before the sacrament.**

Round 1 said a hymn's loudest moment sat 1.5–2.5 loudness units (LU) over
the organ reference, and the sacrament's seat 3.6 under. The critic
measured +3.7 and +3.9 for hymns, and the sacrament's seat level with the
organ. The "3.6" was the gap between two seats, not the gap to the organ.
The critic was right.

Now:

- the choir's level is 2.1 dB lower;
- before the sacrament, every stroke is softer (0.62 of the ringers'
  normal strength, down from 0.78), which also makes each bell darker, as
  a softly rung bell is.

The loudest 3 seconds against the organ reference (the v0.30 organ; the
meeting's organ now plays 2.3 dB under it):

| | as the engine will seat them (mostly the meetinghouse) | in the tabernacle |
|---|---|---|
| a hymn in the invocation or postlude (4) | **−1.3 to +1.0 LU** (was +0.7 to +2.8) | +0.5 to +1.7 (was +2.5 to +3.6) |
| a hymn before the sacrament (4) | **−5.3 to −4.5 LU** (was −1.0 to −0.3) | −4.8 to −4.1 (was −0.4 to +0.2) |
| a round (2) | −1.8 and +0.3 (was +0.2 and +2.2) | −0.1 and +1.0 (was +1.9 and +3.0) |

By the trombones' own figures, they ended roughly 2 LU under the
reference after you turned them down 4 dB, so the bells now start near
where the trombones ended. If the
sacrament's bells feel too faint, the knob is `SACRAMENT` in
`kolob-guest-handbells.js`.

**4. The bells stand in the room.** The lab's room menu now defaults to
**as seated**. That plays each guest the way the meeting mixes every
voice: into both of its rooms at once, the meetinghouse and the
tabernacle, blended by the section and by how near the voice stands. The
bells stand a step nearer than the choir, so they sound mostly in the
short meetinghouse room: close, bright and dry, as the brief asked. The
practice sits where the choir sits in the prelude. I have asked the
integrator for exactly this send. Without it, the bells would copy the
trombones' send and ring in the full tabernacle.

**5. The ringers are more believable.** Each ringer now covers a stretch
of the scale: two notes as a rule, with their sharps and comma bells
waiting on the pad. No ringer holds more than four bells, which is how
real choirs assign a set. Where a close chord would need three hands, the
neighbour reaches over and rings it (four strokes in 360 performances).
When the tune goes down into the big bells, it is now always the lowest
thing sounding.

**6. On a phone, the practice has half the singers.** One desk a part:
twelve singers, not twenty-four. Its peak falls from 288–400 singer nodes
to 144–196 (four practices).

### How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8135 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3-guests`
2. Open **http://127.0.0.1:8135/art/kolob/guests-lab.php**. The room menu
   starts at **as seated**.
3. Try these:

| where | what to listen for |
|---|---|
| `?seed=7&dialect=sacredharp`, **▶ the practice** | The basses come in a beat late. The chorister sings them their passage first ("fa sol la sol la"), and the basses sing it back as "ah oh la oh la". This lab loads this branch's voice, so she leaves out the *f* and *s* too; with the cast crew's voice she says them. Switch the consonants menu to **every consonant** and play it again to hear the brushing this round removed. |
| `?seed=4&dialect=tabernacle`, **▶ the practice** | The tenors climb where their line turns down. Listen to the joins in the passage alone: no hiss between the notes. |
| `?seed=1&dialect=oldway`, **▶ the practice** | The third kind of mistake: the men *hold on* where the tune turns down. |
| `?seed=2&dialect=tabernacle&seat=invocation`, **▶ ring** | The bells as seated, 2 dB down. Then set the room to *tabernacle* to hear how far away they would be in the big room. |
| `?seed=1&dialect=tabernacle&seat=sacrament`, **▶ ring** | The reverent bells: softer strokes, and darker bells. |
| the hymn lab, `hymn-lab.php?seed=7&dialect=sacredharp`, on the cast crew's branch | Verse 1 on the notes, with the cast crew's voice. This is where the brushing between the notes was, and where it is fixed for the hymns. |

Under each **▶** a line now reports how the guest was laid out: a few
milliseconds at the press, then slice by slice, a little ahead of the
sound, as the engine's clock will lay it out.

### The ten findings, and what was done

| # | finding | done |
|---|---|---|
| 1 | The breath section ranked the wrong cause; the tick is between lines; the fricatives are the between-notes sound; request 5 superseded | **Agreed; corrected** above (item 1, with a table measured on three voices). Request 5 is withdrawn: the cast crew's `af8e190c` removed the tick. |
| 2 | The practice's passage alone and the chorister's demonstration are sung on shape syllables and reproduce the sound | **Fixed in the guest, not only requested.** `CONSONANTS`: the section sings the shapes without *f* and *s*; the chorister says them whole only with the cast crew's voice. Joins are now −35.8 to −41 dB with this branch's voice and −39.1 to −43.7 with the cast crew's, against −38 to −43.8 mid-note. Round 1 measured −15 to −21. The cast crew is also asked for a lighter-consonant option (Requests). Because the guest no longer depends on it, I do not ask that the school wait for the cast voice. |
| 3 | The loudness claims do not reproduce | **Agreed.** `LEVEL` 0.47 → 0.37, the sacrament's stroke 0.78 → 0.62 (`SACRAMENT`). The numbers are restated in item 3, measured in both rooms, with 0 clicks and 0 clipped samples in all 20 renders. |
| 4 | "Close, bright and dry" is not carried into integration; the lab auditions in the tabernacle | **Agreed.** A send is requested (below). The lab defaults to *as seated*: both rooms blended, the bells at the section's balance − 0.35, as `PJ2.Fx.roomBlend` seats a layer. The organ reference is measured in the same room as the guest. |
| 5 | `perform()` runs in one call inside a clock callback: 207–533 ms (bells), 122–248 ms (school) | **Done:** both guests take the trombones' round-3 `hooks.defer(at, fn)`. The bells lay out their rings a second at a time, 2.5 s ahead. The practice lays out each sung line 2.5 s before its voice is built, and desks that start together go 0.2 s apart, each in its own clock tick. **I could not reproduce the critic's figures:** on this Mac (load average about 7, muted headless Chrome, a live context with the tabernacle's convolver and a performance already sounding), the whole performance at once cost 13–28 ms for the bells and 8–21 ms for the practice, and round 1's code cost the same. Sliced, the press costs 1–8 ms and the largest slice 1–5 ms (18–42 slices). Whatever machine the 200–500 ms came from, the slicing divides it the same way. |
| 6 | The singing school's seat must reach the guests before the bells plan; the lab's odds decided the two independently | **Agreed, and made order-proof:** the corrected snippet is below. The practice's own planner now also refuses when the section after the prelude holds a guest (PLAN §8.13), whichever the engine plans first. The lab's stand-in plans the practice first: 201 meetings of 20,000 seat both, and 0 of them seat the bells beside the practice. |
| 7 | A funeral passed as `kind` was seated | **Fixed** (`info.kind === "funeral"`). The lab's purity check now tries both spellings: nothing is seated. |
| 8 | Ringers held 4–6 bells; three bells at once; the tune in the bass bells not always the bass | **Fixed.** Bells are split among the ringers with no hand over four (more ringers, up to twelve, when needed), and two places a ringer where the set allows. Over 360 performances, ringers held 1/2/3/4 bells: 78/2162/1066/110 (round 1: 97/2233/889/153, plus 30 ringers with five and 4 with six). The two-hands rule gives a stroke that would be a ringer's third to a neighbour: 4 strokes in 360 performances, and 0 performances with a third hand (round 1: 4). In the bass setting every chord tone goes above the highest tune note under its chord, or is left out past the top of the set: 0 of 1,689 tune strokes have a tone under them (round 1: 273). The header now describes real practice, not "two or three bells". |
| 9 | The lesson's third kind (the part holds on) is outside the brief | **Owned as designed.** A section that does not yet know its line most often keeps the note it had. In a tune sung in unison, it is the only wrong note a step from the tune that clashes. The header lists three kinds. Over 60 hymns per dialect: Tabernacle 37 climb / 8 hold / 15 late; Sacred Harp 41 / 4 / 15; the Old Way 12 / 33 / 15. |
| 10 | The door becomes redundant with the cast voice; the practice has no phone cap | **Done.** The door is built only with the older voice (`!VoicesVocal._mouth`; the cast voice exports its mouth and is born silent), so nothing needs removing later. The phone gets one desk a part (`material.phone`): peak 144–196 singer nodes instead of 288–400 (four practices, measured). |

### How it was checked (all silent)

| check | result |
|---|---|
| the lab at 860 and 390 px, every play, check, menu, switch, the odds and purity | 0 console errors; no sideways scroll (scroll width = viewport) |
| purity | plan and score repeat exactly on the same stream (the lab, and 360 bell scores and 360 practice scores in Node); 0 `Math.random` calls; switched off or at a funeral, the practice is never seated |
| the practice's joins, dry, seven practices (seeds 4, 7 Tabernacle; 3, 7, 13 Sacred Harp; 8, 1 the Old Way) | see item 2 and finding 2. Method: render twice, once with the voices' looped noise sources silenced, and subtract; joins are −60 to +50 ms around each note after a line's first; mid-note is 30–70 % of each note of 0.3 s or longer |
| the ward's joins (32 singers, one line, three voices) | item 1's table (same method) |
| the bells' loudness | item 3's table: 10 performances × 2 rooms, the lab's own `check` (BS.1770, the loudest 3 s, against the v0.30 organ reference in the same room); 0 clicks, 0 clipped |
| the main thread | finding 5: a live AudioContext in muted Chrome, four hymns × both guests, at once and sliced; in the lab, the bells cost 5.5–7.8 ms at the press and ≤ 2.2 ms a slice, the practice 8 ms and ≤ 1.7 ms |
| the odds (the stand-in planner, 20,000 meetings) | the bells 12.3 %, the practice 10.1 % (0 % switched off); both 201, the bells beside the practice 0 |
| the bells' structure (360 performances, the three dialects × the three seats × 40 seeds) | finding 8; 35–75 s long; 8–12 ringers; peak ≤ 20 rings at once |

### Requests (these replace round 1's requests 2 and 5)

1. **To the integrator: plan the practice first, and let the bells see
   it.** The corrected snippet is below. The practice now refuses on its
   own when the invocation holds a guest, so the order is belt and
   braces.

   ```js
   // in planMeeting, after the trombones (kolob-meeting.js, ~line 321)
   var X = KOLOB.Experimental ? KOLOB.Experimental.snapshot() : {};
   var SSg = KOLOB.GuestSingingSchool, HBg = KOLOB.GuestHandbells;
   if (SSg) {
     var ssStream = stream("guest:singingschool");
     var ssSeat = SSg.plan({ n: C.meetingNum, kind: activity, sunday: null, sections: plan, guests: C.visitations, experimental: X, force: forcedType === "singingschool" }, ssStream);
     if (ssSeat) C.visitations.push({ type: "singingschool", section: "prelude", at: ssSeat.at, dur: ssSeat.dur, fired: false, stream: ssStream });
   }
   if (HBg) {                                     // AFTER the practice is among the guests
     var hbStream = stream("guest:handbells");
     var hbSeat = HBg.plan({ n: C.meetingNum, kind: activity, sunday: null, sections: plan, guests: C.visitations, force: forcedType === "handbells" }, hbStream);
     if (hbSeat) C.visitations.push({ type: "handbells", section: hbSeat.seat, at: hbSeat.at, dur: hbSeat.dur, fired: false, stream: hbStream });
   }
   ```

   Prepare each guest's material at plan time and plan again with it, as
   round 1 said and as the trombones do.

2. **To the integrator: a near send for the bells** (finding 4). Do not
   copy the trombones' `wideSend()`: that puts the first guest in the room
   into the full tabernacle. Seat the bells like a layer instead: a door
   of the meeting's own, registered with the room blend at a depth bias,
   so they follow the section's balance a step nearer than the choir.

   ```js
   // kolob-core.js: ROOM_DEPTH.handbells = -0.35  (the still small voice's nearness)
   // One blended send per standing guest's layer, registered once (the room
   // blend has no unregister), and the meeting's own door in front of it,
   // so STOP closes the door as it closes wideSend's.
   var guestSeats = {};
   function seatedSend(layer) {            // a guest that stands in the room
     if (!guestSeats[layer]) { guestSeats[layer] = ctx.createGain(); seatLayer(layer, guestSeats[layer]); }
     var d = liveDoors(), key = "seat:" + layer;
     if (!d[key]) {
       d[key] = ctx.createGain(); d[key].gain.setValueAtTime(1, ctx.currentTime);
       d[key].connect(guestSeats[layer]);
     }
     return d[key];
   }
   ```

   Perform the bells into `seatedSend("handbells")` and the practice into
   `seatedSend("choir")`. The practice is the ward choir, so it sits where
   the choir sits. The lab's *as seated* room is this, and it is what the
   loudness table in item 3 measured.

3. **To the integrator: the clock.** Pass both guests
   `hooks.defer(at, fn)` exactly as the trombones get it: `cueAt("guests",
   at, …)` guarded by the meeting still standing (`C_live`). Both report
   their notes (`onNote`) as each slice or line is laid out, and their
   stages (`onStage`) at once.

4. **To the integrator: phones.** Pass `phone: true` in both guests'
   material. That caps the bells at 12 rings at once and gives the
   practice one desk a part.

5. **To the cast crew:**
   - **A lighter hand on a line's consonants:** an option to `sing()`,
     for example `opts.fricatives` (0–1, scaling `FRIC_PEAK` for that
     line). The practice would then let the section say "fa" and "sol"
     whole, at about a third of the ward's strength, which is the better
     sound. Until then it leaves them out.
   - **A plain revision mark** on `KOLOB.VoicesVocal` (for example
     `REVISION: 3`, or `caps: { bornSilent, fricatives }`). The practice
     currently tells the two voices apart by `VoicesVocal._mouth`, which
     is a private export.
   - Round 1's request 5 (the tick) is withdrawn: `af8e190c` fixed it.

6. **To the organ crew, FYI:** in Tabernacle hymns in the hymn lab, the
   organ doubles the voices and chiffs at every chord change (the
   integrator measured −25.5 dB at the joins). With the ward's *f* and *s*
   fixed by the cast voice, that is what is left between the notes of a
   Tabernacle hymn in the hymn lab.

### Known issues (round 2)

- **Nobody has listened.** In particular:
  - does the section's "ah, oh, la, mi" still read as singing *on the
    notes*, with the chorister saying them whole in front?
  - are the sacrament's bells too faint at −4.5 to −5.3 LU?
- **The critic's main-thread figures did not reproduce here** (finding 5).
  The slicing stands either way. The phone test under 4× throttling (the
  tools' `screens.js`) should re-measure once the engine plays these
  guests.
- **The Old Way's lessons are mostly "hold on"** (33 of 60). In a unison
  tune a wrong note has to be a step from the tune to clash, and holding
  on is the commonest way to be a step away. The practice's lesson
  variety leans on the other two dialects.
- **The chorister's *f* and *s*, with the cast voice, stand about 8 dB
  over her notes** in the three quick Sacred Harp tunes in thirty where
  she sings the passage first. Set
  `KOLOB.GuestSingingSchool.CONSONANTS = { chorister: "voiced" }` if that
  is still too much.
- **The Old Way's bells can be quiet.** A unison tune is rung in octaves
  over an open fifth, and that is few bells. Two Old Way hymns in the
  invocation measured −1.3 and −5.4 LU (as seated), against −1.3 to +1.0
  for the others.
- **The practice's level was not a finding and is unchanged**
  (`LEVEL = 0.55`). As seated, its loudest 3 s measured −0.9 to +2.2 LU
  against the reference, in four practices. If the bells come down, the
  practice may want to follow.
- **The practice's choir is its own eight desks**, not the Sunday's cast
  (the cast crew's 32 named members). Seating the cast's choir members in
  the practice is a possible later step.
- Round 1's known issues otherwise stand. The claim about "two or three
  bells a ringer" is corrected by finding 8.
