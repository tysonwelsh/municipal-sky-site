# r3-guests-1: the ward's handbell choir, and the singing school

*GUEST crew, round 3. Branch `kolob-r3-guests`. 2026-09-28.*

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
