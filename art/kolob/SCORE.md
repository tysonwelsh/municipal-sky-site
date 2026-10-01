# KOLOB — THE CONTRACT

## 0. What this document is

This is the interface every Kolob module codes against: the namespace, the
tuning, the dice, the clock, the Score, the event bus, the ward and its
organist, the guests, and the version rule. It states only what is true now.
The code named at the end of each section is the authority where this page
and the code differ; fix the page, not the code. It was consolidated from the
layered contract (a base and five "later section wins" layers) on 2026-10-01,
which is kept at `archive/SCORE-layered.md`. `README.md` is the map of the
folder; `OWNER-RULINGS.md` holds every ruling the owner has made, `OPEN-WORK.md`
what is planned or asked for and not done, `STAFF.md` the rules of the page's
staff; the build's plans are in `archive/plans/`.

---

## 1. Modules and namespace

**One namespace.** Every room attaches to `window.KOLOB` as an IIFE
(`KOLOB.Score = (function  { "use strict"; … });`) and, as its last act,
answers the load guard's roll call: `KOLOB._rooms["kolob-x.js"] = true`. The
substrate (`PJ2.Rand`, `PJ2.Clock`, `PJ2.Fx`) and the Earth tunes
(`KOLOB.Tunes`) are checked by the globals they raise; `kolob_engine_tags`
(`_engine.php`) prints the guard, which names every room that did not answer.

**The shared bag.** Rooms lend what others need onto `KOLOB._s` (written `S`
inside a room: `S.name = …`) and read each other's lends as `S.name(…)`; a
name written `S.x` belongs to another room. `tools/lends.js` fails any
unguarded `S.x` read that no room lends; a lend that may be absent (a lab
without the room) is read under a guard (`S.x ? … :`, `S.x && …`, `typeof`).

**Purity.** A pure module touches no `AudioContext`, no DOM, no
`Math.random`, no `Date.now`, no `performance.now`; anything random takes a
`PJ2.Rand` stream as an argument (§3). Pure modules load headless in Node
under a bare mock of the page (`global.window = global`, each file run with
`vm.runInThisContext`: `tools/loadcheck.js`, `_harness.js`). Pure today:
pitch, score, tunes, melody, harmony, dialects, hymnists, composer, organist,
calendar, the hymnal's `plan`/`forms`, every guest's `plan`/`prepare`/`score`.
**Synthesis modules** (`kolob-voices-*.js`) take the AudioContext, a
destination and a scheduled time, and never read `ctx.currentTime` to decide
*when* something happens (§4).

**The facade.** `window.KolobAudio` (`kolob-core.js`) is the only thing the
page, the labs and the harness call: transport (`init play pause resume stop
sample isPlaying isPaused`), the desk (`setMasterVolume setLayerVolume
toggleLayer getLayerParam
getLayers getVolumes`, the field keys, `setBandVolume getBandVolume
getBandHeardUntil`), the visit (`getSeed reseed getConductor getHarmony
getAudioTime skipToSection getMotifStats getCumulativeOdds getCumulativeMode
setCumulativeMode setForceVisitation isForceVisitation setForceRaspberry
getOldTunes`), the hymnal (`getHymnal getHymn hymnalStats clockHealth`), the
ward (`getWard wardStats`), the organ (`getOrganist
organStats`), the bus (`setNoteListener setEventListener`), the faults
(`confess`: the page's own, told the house's way, §6),
the rooms (`getRooms setRoom preloadRoomIR setRoomBalance setLayerDepth
attachAnalyser`). One number lives in one place: a rate the page shows is
read from the engine (`getCumulativeOdds` → `kolob-meeting.js`
`CUMULATIVE_ODDS`, 0.08), never retyped.

**THE ONE LIST is `_engine.php`.** Every page that plays the engine
(`index.php`, the labs that load it whole, the harness, the tools) reads the
room list from it; a module is added there and nowhere else. Today, in order:

| role | rooms |
|---|---|
| the substrate (read-only) | `../prosperos-jukebox-v2/pj2-rand.js`, `pj2-clock.js`, `pj2-fx.js` |
| the tuning, the score, the Earth tunes | `kolob-pitch.js`, `kolob-score.js`, `kolob-tunes.js` |
| the composers (pure) | `kolob-melody.js`, `kolob-harmony.js`, `kolob-dialects.js`, `kolob-hymnists.js`, `kolob-composer.js`, `kolob-organist.js`, `kolob-experimental.js`, `kolob-calendar.js` |
| the voices | `kolob-voices-pipeorgan.js`, `kolob-voices-organ.js`, `kolob-voices-choir.js`, `kolob-voices-winds.js`, `kolob-voices-ground.js`, `kolob-voices-field.js`, `kolob-voices-band.js`, `kolob-voices-folk.js`, `kolob-voices-vocal.js` |
| the performers | `kolob-cast.js`, `kolob-hymnal.js`, `kolob-guest-trombones.js`, `kolob-guest-handbells.js`, `kolob-guest-singingschool.js`, `kolob-guest-bands.js`, `kolob-guest-handcart.js`, `kolob-guest-gulls.js`, `kolob-guest-variations.js`, `kolob-guest-changes.js`, `kolob-guest-tongues.js`, `kolob-guest-farward.js`, `kolob-guest-hosanna.js`, `kolob-guest-socialhall.js`, `kolob-testimony.js`, `kolob-guests.js`, `kolob-meeting.js` |
| the facade | `kolob-core.js` |

The page then loads `kolob-text.js`, `kolob-viz.js`, `kolob-ui.js`, which are
not engine rooms. Every served asset is in `index.php`'s fingerprint. **The
substrate is read-only**: `art/prosperos-jukebox-v2/*` is shared by relative
path and never edited from Kolob work.

**At the PLAY press** (`kolob-core.js play`), never in a clock cue: the
composer's desk is opened (`KOLOB.Hymnal.warm`), the town's air poured
(`VoicesBand.warm`), the handcart company's throat sung once silently
(`GuestHandcart.warm`), change ringing's touches searched (`GuestChanges.warm`),
the far ward's valley poured (`GuestFarWard.warm`).

**Shelved.** `shelved/` holds the Question (`kolob-question.js`, the
generator; `kolob-question-setpiece.js`, the set piece, the seating and the
staff's cartouche as they stood until 2026-10-01; `question-lab.*`; the
owner's ruling of 2026-09-27) and the bagpipe (`kolob-voices-bagpipe.js`,
`bagpipe-lab.*`; 2026-09-13): code kept, not loaded. The Question's dice are
still drawn so no later draw moves: `qDie = R.chance(0.29)` and `qSeatDie =
R.chance(0.7)` on `meeting:<n>` (`kolob-meeting.js` planMeeting, `void`ed;
the switch never names it). The bagpipe left no die behind: it is no layer,
and `SHELVED` in `kolob-core.js` (the mechanism for a muted layer) is empty.

**Labs.** Each is `<name>-lab.php` + `<name>-lab.js`, unlinked, dev-only:
`cast earth-tunes guests guests3a guests3b guests3c guests3d hymn instruments
organist room trombone voices` (`hymn-lab` is the owner's listening
checkpoint for the composer; the tune lab, v0.30's old-tune incipits, is in
`shelved/`). A lab loads the one list (`cast-lab`, `room-lab`) or only the modules it needs, in the list's order; it shows the
paper look and a seed field; everything audible goes through a master chain
with a limiter after it (`voices-lab.js` THE MASTER CHAIN is the pattern), never
louder than the app; level checks render with an `OfflineAudioContext`.

**Silent testing (owner rule).** Every browser an agent launches is muted:
`tools/lib/chrome.js` passes `--mute-audio` and refuses to launch Chrome
without it; taps still capture the signal.

**Dev switches** on the page: `?seed=N`, `&guest=<name>` (§8),
`&exp=-reckoning` / `-singingSchool` (`KOLOB.Experimental`), `&latin=1`,
`&kolobPreview=1`. The harness takes `ives`,
`razz`, `cumulative` and `force=<name>`.

Authority: `_engine.php`, `kolob-core.js`, `tools/loadcheck.js`,
`tools/lends.js`, `tools/lib/chrome.js`, `_harness.js`.

---

## 2. Pitch

**Ratios are exact.** A pitch is a just-intonation ratio relative to a tonic,
stored as a *monzo*: the exponents of 2, 3, 5 and 7, `[a, b, c, d]` =
2^a · 3^b · 5^c · 7^d.

| ratio | monzo |
|---|---|
| 1/1 | `[0, 0, 0, 0]` |
| 3/2 | `[-1, 1, 0, 0]` |
| 10/9 | `[1, -2, 1, 0]` |
| 7/4 | `[-2, 0, 0, 1]` |

**Helpers** (`KOLOB.Pitch`): `ratio(m) → Number`, `mul(m1, m2)`, `div(m1,
m2)`, `fromFraction("10/9")` (throws past the 7-limit), `cents(m)`,
`octaveReduce(m)`, `degMonzo(mode, i)` (a collection-degree index → its exact
monzo), `MODE_MONZOS`, `commaOf(m, spelled) → {syntonic: -1|0|1, septimal:
0|1}` (Johnston's marks: `+`/`−` the syntonic comma 81/80, `7` lowers by
36/35). The 7-limit: `SEPTIMAL_SEVENTH` 7/4, `SEPTIMAL_COMMA` 64/63,
`JOHNSTON_SEVEN` 36/35, `BARBERSHOP` (1/1 5/4 3/2 7/4), `harmonicSeventh(root)`,
`limitOf`, `septimalOf`, `proportion(monzos)` ("4:5:6:7"), `oddParts`. The
float side: `COLLECTIONS`, `tuning(mode, f0)`, `projDeg`, `degFreq`, `colN`.

**Frequency.** `Hz = keynoteHz × ratio(keyMonzo) × ratio(monzo)`.
- The **keynote** is `F0 × ROOT_MULT` (4). `F0` is drawn once a meeting on
  `meeting:<n>`: `R.rnd(52, 78)` Hz (`F0_RANGE`, `kolob-meeting.js`), so the
  keynote is about 208–312 Hz. `S.F0`, `S.ROOT_MULT`, `S.mode` are lent.
- The **key** is the hymn's, relative to the keynote (`kolob-hymnal.js`
  `KEYS`): `home [0,0,0,0]`, `sub [2,-1,0,0]` (4/3 up), `dom [-2,1,0,0]` (3/4
  down). The first hymn is home with P 0.7 (always when the trombones play it
  at dawn), a hymn after one sung away is pulled home at 0.8, else 0.45; away
  is `dom` at 0.55 else `sub`; the doxology is home.
- A composed note's `monzo` is relative to its hymn's key.

**Modes.** `ionian`, `mixolydian`, `dorian`, `aeolian`, `penta`, `hexa`, with
the 5-limit tables in `COLLECTIONS` / `MODE_FRACTIONS` (ionian 1 9/8 5/4 4/3
3/2 5/3 15/8; mixolydian's seventh 16/9; dorian's third 6/5; aeolian's sixth
8/5; penta 1 9/8 5/4 3/2 5/3; hexa drops the seventh). The 7-limit reaches
past them only where a dialect asks (gospel's 4:5:6:7).

**Degree against monzo.** A note is also spelled as a degree in its mode:
`deg` is an index into the mode's parent seven-note scale, 0 the tonic, 7 the
tonic an octave up, negative below. The monzo is the truth; the degree is the
spelling; they agree up to a comma, and the comma is what Johnston's marks
show. The proofreader (`kolob-score.js validateNote`) compares the monzo's
cents with `PARENT_CENTS[mode][deg mod 7]` plus octaves and allows
`SPELL_SLACK` = 21.506 + 1.5 c, plus 112 c for a chromatic note (`alt`), plus
`SEPTIMAL_C` = 48.770 c (one Johnston "7") for every factor of 7 in the monzo
(`|monzo[3]|`). Shape names (fa sol la mi) are read off the degree through the
mode's own "do" (`KOLOB.Composer.doOf(mode)`: ionian/penta/hexa 0,
mixolydian 3, dorian 6, aeolian 2).

Authority: `kolob-pitch.js`, `kolob-score.js` (the proofreader),
`kolob-hymnal.js` (`KEYS`), `kolob-meeting.js` (`F0_RANGE`).

---

## 3. Randomness: streams

**The stream type** is `PJ2.Rand.stream(seed)`: `next` (a float in
[0, 1)), `rnd(a, b)`, `rint(a, b)`, `chance(p)`, `pick(arr)`,
`pickW([[item, w], …])`, `shuffle(arr)`, `fork(label)`.

**Forks are order-independent.** `fork(label)` derives the child from the
parent's *birth* seed and the hashed label, never from the parent's current
state: the same parent seed and label give the same child whatever was drawn
before.

**The visit's root.** `kolob-core.js` holds one root stream per seed
(`visitRoot`) and lends the forks every room draws on:

| call | stream |
|---|---|
| `S.stream(label)` | `<label>:<n>` (n the meeting number), cached per meeting |
| `S.turn(label)` | `<label>:<n>` → `turn:<k>`, k counting up per meeting: every turn a voice takes is its own fork, so a turn that throws more dice or fewer never shifts the next |
| `S.wait(label)` | `<label>:wait:<n>` (how long a refused voice waits) |
| `S.hymnStream(n, i)` | `hymn:<n>:<i>` |
| `S.castStream(n)` | `cast:<n>` |
| `S.formStream(label)` | the root's `<label>` as given (`refrain:<n>:<k>`) |
| `S.synth(voice)` | `synth:<voice>`, one for the whole visit |
| `sample` | everything an audition throws comes from `audition` |

`S.visitSeed` hands the seed to the composer's worker, which rebuilds
`hymn:<n>:<i>` from it (§4).

**Draw every die unconditionally.** If a decision might be refused later,
draw it anyway, so a refusal never shifts what follows. The plan and the
conductor throw theirs whether or not they are used; a guest's room plans on
its own stream every meeting; `Cast.planHymn` throws every die of every
practice for every hymn; the choir throws vowels for four verses always.
Known sites that keep a die thrown but unread: `qDie`, `qSeatDie` (the
shelved Question), `bDie`, `bSeatDie` (`void bDie; void bSeatDie;`, the plan's
old band dice) in `kolob-meeting.js` planMeeting; `void regDie` in
`kolob-organist.js` (`VAR_PLAY.chorale`); the hymnal's `hymn:<k>` thrown for
every singing section of the plan; the organist's `preludeDraw` roll thrown
before its refusals are read.

**Keep musical and sound-level streams apart.** Musical is anything the note
or event streams report, or any pitch that sounds: which notes, when, how
long, how high, which section, which guest. Sound-level is how a note sounds:
detune, envelopes, onset stagger, pan, vibrato and tremolo rates, breath. A
reported note is the written note; where a player places it (the harmonium's
loose alto, the choir's stagger, a throat's jitter) is sound-level and lives
under `synth:<voice>`, never under a musical stream; sound-level streams never
move the music. The substrate's `setRoomBalance` crossfade starts at the
pump's `currentTime`; it is sound-level.

**Every stream label in use**, below the root:

| label | who draws it, and the forks below |
|---|---|
| `meeting:<n>` | the plan (`kolob-meeting.js` planMeeting): the Sunday, season, F0, mode, every section's length, the plan's own guest dice (the Question's, the old band's, the steeples', the old tune's, `cumDie`, `razzDie`, `forcedDie`); `section:<i>` per section entered (its fuging, sunrise and the doxology's rise, read again from a fresh copy for the hymnal) |
| `motif:<n>` | the day's temper and gestures (`Motif.newMeeting`) |
| `conductor:<n>` | the conductor's dice each 0.6 s tick, always thrown |
| `joints:<n>` | `joint:<i>` per section ended (`runJoint`) |
| `stillness:<n>` | the still small voice's turns (`turn:<k>`) |
| `prelude:<n>` | the prelude's seating (`seatPrelude`) |
| `scenes:<n>` | the other rites' seatings; `hum:<i>` where a scene hums |
| `reckoning:<n>` | the drone's walk: `pedal:<i>`, `glide:<next>` |
| `hymnal:<n>` | the day's hymnal: `house`; `hymn:<k>` per singing section (dialect, key, away; `hymnist:light`), thrown used or not |
| `forms:<n>` | `round`, `round:which`, `payoff`, `refrain:later` (`Hymnal.forms`) |
| `hymn:<n>:<i>` | the composer (`dialect`, `hymnist`, `frame`, `skeleton`, `naming:<dialect>`, `tempo`, `harmony`, `harmony:repair:<r>`, `vocables`, `alto`, `line:<i>` and its cells, `round`, `partner:<t>`, `partner:alone`, …); `reckoning:<k>` (the doxology rewritten for the drone); then `performance` (the choir's `tempo`, `verses`, `lead`, `tail`, `vowels:<v>`, `fuging`, `appetite`, `fuging:<v>`, `assembly:<li>`, `partner`; the cast's plan dice in the fork's own sequence, then `round`, `quartet`, `onepart`, `precentor:<v>:<li>`, `orn:<id>:<v>:<li>`, `child:<v>`, `descant:<li>`, `pitching`); `organist:<style>` (`regs`, `giveout`, `join:<v>:<i>`, `interlude:<v>`, `modulation`) and `organist:modulation` |
| `refrain:<n>`, `refrain:<n>:<k>` | the wandering refrain as written, and each statement k (the composer, in the worker); `refrain:<n>:<k>` → `performance` the ward's singing of it |
| `cast:<n>` | the ward seated (`families`, `member:<id>` for `S0`…`B7`, `roles`, `role:<role>`, `role:testimony:<k>`, `rename:<id>`, `primary`, `primary:<k>`); the organist (`organist`, `organist:prelude`, `prelude:<style>` → `line:<i>`, `echo`). Meeting 0 is the rail's audition |
| `guest:bands:<n>` | `seat`, `shape`, `synth` → `band:<k>` |
| `guest:steeples:<n>` | the steeples' set piece (the plan's own `stDie`/`stSeatDie` are `meeting:<n>`'s) |
| `guest:changes:<n>` | `seat`, `shape`, `synth`; when changes ring it becomes the steeples' stream |
| `guest:oldtune:<n>` | the old tune's performance (`oDie`, `oSeatDie`, `oTuneDie` are `meeting:<n>`'s) |
| `guest:trombones:<n>` | `seat`, `shape`, `material` (the dawn chorale, only without a hymnal), `synth` → `far`, `near` |
| `guest:singingschool:<n>` | `seat`, `material` → `hymn`, `lesson`, `vowels`, `synth` → `react`, `desk:<id>`, `chorister` |
| `guest:handbells:<n>` | `seat`, `shape`, `round:<mode>:<meter>:<voices>` → `phrase:<k>`, `material` → `hymn`, `synth` → `folk`, `hands` |
| `guest:variations:<n>` | `seat`, `organist`, `shape` (→ `variations:<style>` → `var:<character>`, `hands:<tag>:<i>`, `pass:<i>`, `fig:<k>`, `intro`), `synth` → `organ` |
| `guest:tongues:<n>` | `seat`, `shape` → `phrase:<k>`, `tongue` → `word:<w>:<a>`, `ward`, `melody`, `words`, `figures`, `hum`, `synth` → `singer`, `hum:<id>`, `reed` → `line`, `drone` |
| `guest:farward:<n>` | `seat`, `shape`, `material` → `setTune`, `pews`; `vowels` → `verse:<v>`; `synth` → `desk:<k>`, `desk:<k>:<i>` |
| `guest:hosanna:<n>` | `seat`, `shape`, `ward`, `crowd` → `person:<id>`, `synth` → `shout:<id>`, `organ`, `sing:<id>` |
| `guest:socialhall:<n>` | `seat`, `shape`, `tune`, `people`, `material` → `hymn`, `arrange`, `room`, `calls`, `synth` → `folk`, `hands`, `voice:<key>` |
| `guest:handcart:<n>` | `seat`, `shape`, `synth` → `carts`, `company` → one per voice, `leader`, `child` |
| `guest:gulls:<n>` | `seat`, `shape`, `flock`, `synth` |
| `guest:testimony:<n>` | `seat`, `shape`, `speech:<k>`, `reed:<k>`, `answer:<memberId>`, `synth` → `reeds`, `room`, `voice:<key>`, `line:<i>` |
| `guest:cumulative:<n>` | the conductor's own assembly (a Sunday without a composed doxology) |
| `guest:question:<n>` | the shelved Question's set piece (`shelved/kolob-question-setpiece.js`); no live room forks it |
| `<voice>:<n>` → `turn:<k>` | a turn each of `organ`, `drone`, `choir`, `clarinet`, `harmonium`, `strings`, `bells`, `voice`, `telegraph`, `field`, `fuging`, `hum` |
| `<voice>:wait:<n>` | `choir`, `clarinet`, `bells`, `telegraph` |
| `synth:<voice>` | sound-level, the whole visit: `organ` (→ `case:<k>`, each pipe organ built), `vocal` (→ `meeting:<n>` → `member:<id>`, each throat), `band` (→ `partner:<id>`, the cornet), `choir`, `clarinet`, `harmonium`, `strings`, `bells`, `voice`, `telegraph`, `field`, `noise`, `steeples`, `oldtune` |
| `audition` | everything `sample` throws |

(A voice room created outside the engine seeds itself: `synth:band`,
`synth:organ`, `synth:folk`, `synth:vocal` from a fixed seed; the handcart's
warm-up sings on a fixed seed's `handcart:warm`.)

Authority: `../prosperos-jukebox-v2/pj2-rand.js`, `kolob-core.js` (THE
DICE), each room's own `fork` calls.

---

## 4. Time

**The clock** is `PJ2.Clock.create(ctx, opts)`, a lookahead scheduler with
lanes. The engine cues only through `S.cueAt(lane, t, fn)` and
`S.cueIn(lane, dtS, fn)` (`kolob-core.js`); `cueIn` measures from the music's
now (`S.now`) at the clock's own speed. **Never use PJ2's `lane.in` or
`lane.every` in musical code**: both measure from `ctx.currentTime`.
Callbacks receive the scheduled time `t` and place every Web Audio event at
`t`. No musical decision reads `ctx.currentTime` at callback time; no
`setTimeout` chains; the harness drives the clock with virtual timers.
`S.inCue` says whether the music's now is a cue's; `KolobAudio.clockHealth`
counts cues fired after their time. Each layer's turn, the conductor's tick
and the ward's and the organist's pumps re-arm their own lane as their last
act, and the clock runs each through `S.cycle(lane, self, turn, t,
fallbackS)`: a turn that throws before it has re-armed is reported and armed
again `CYCLE_FALLBACK_S` = 5 s later (the tick and the pumps at their own
pace, 0.6 s, `WARD_PUMP_S`, `ORGANIST_PUMP_S`, a pump's flag set by the net's
word), and a link of a composed hymn's chain that throws before it has handed
on lets the hymn go (`hands.done`). **Score times**
inside a Score are seconds from the Score's own start (`t`, `dur`;
`Score.timeline`); the performer adds the absolute start.

**Who holds a section.**
- A composed hymn owns its section from its announcement to its last chord:
  `S.Meeting.hymnSounding` is true while `C.hymn` is active or the music's
  now is before its `until`. The performer's hands on the meeting are
  `S.Meeting.hands`: `owns(id)`, `until(id, t)`, `done(id, t)` (the last chord
  is written: the joint waits for it and a breath), `fugingPlanned`,
  `fuging(t, dur)`, `guestWaiting`, `guestInGap(t)` (a guest seated in the
  section arrives in the gap the hymn leaves it), `assemblyBegins(t, dur)`.
  The section lasts `max(planned, lead + performance + tail)`.
- A guest's span: `guest-start` carries `until`, when its sound ends; a
  section never turns over inside it. A guest whose record says `cued: true`
  is cued when its section begins, at the moment its plan drew; the
  conductor's poll finds the others between 0.2 and 0.55 of the section,
  never over a hush, a fuging, a joint, a hymn, a chorale prelude or another
  guest. The band, the company, the gulls and the dance are made ready by a
  cue of their own a second before (`PRE_MADE`); the variations' set is made
  ready in idle time by a timer once its hymn is written (`readyAhead`), and
  its cue holds the section. A section is held at plan time for a cued guest
  (`holdSection`).
- The house listens — the organist's own chords, the harmonium, the strings
  and the clarinet begin no turn — while `hallListens`: a listened guest
  sounds (`LISTENED`), a hymn sounds, the chorale prelude sounds, or a
  testimony-bearer speaks. The joint (`runJoint`) waits for all of these.
- The conductor ticks every 0.6 s on lane `conductor`; a joint closes a
  section and the next begins.

**The ward's desk pump** (`kolob-voices-choir.js`). Every piece the ward
sings (a hymn's intro, each verse, the amen, the tag, the fuging, a refrain
statement, a section's line) is written as a cue sheet when the meeting
decides it (a verse `PREP_S` = 4.5 s before it begins) and put on the desk at
its start. One pump, a cue on lane `ward` every `WARD_PUMP_S` = 0.12 s of the
music's time, hands lines to the voices `WARD_REACH_S` = 3 s ahead (at most
`WARD_MAX` = 12 a call unless due within `WARD_URGENT_S` = 1.2 s) and joins
each mouth to the room `WARD_ARM_S` = 0.6 s before it sounds
(`VoicesVocal.arm`, ARMING). The pump reads the music's now, never the audio
clock. STOP clears the desk and `VoicesVocal.forget`s the queue; a piece whose
hymn no longer owns its section (a dev jump) hands nothing more. **The
organist's pump** (`kolob-voices-organ.js`): a plan is pumped
`ORGANIST_REACH_S` = 3 s ahead on lane `organist` every `ORGANIST_PUMP_S` =
0.2 s while any plan is on the desk.

**The hymnal is off the audio path** (`kolob-hymnal.js`). The desk orders
each hymn when the meeting is planned (`prepare(seed, n, rows, forms, rk)`)
and brings it back: (1) in a Web Worker where the page has one, loading the
composer's rooms (`DESK_FILES`: `pj2-rand`, `kolob-pitch`, `kolob-score`,
`kolob-tunes`, `kolob-dialects`, `kolob-hymnists`, `kolob-composer`;
`kolob-calendar` optional) by the versioned URLs the page itself loaded;
(2) else in idle slices of the main thread (a `setTimeout`, one hymn a slice,
never a clock cue); (3) and if a hymn is asked for before it has come back,
it is written there and then and counted (`KOLOB.Hymnal.stats.late`,
`.lateInCue`). The hymn is the same by every road: the composer is pure, its
stream `hymn:<n>:<i>` is rebuilt from the visit's seed and the label, and the
meeting's earlier hymns are handed to it in the same order and the same
lightened form (`Hymnal.lighten`: the Score whole, of the dev report only
`frame`, `peak`, `checks` and the fingerprint's `share`). The worker forgets
`h:<n>:*` and `r:<n>:*` together.

Authority: `../prosperos-jukebox-v2/pj2-clock.js`, `kolob-core.js`
(`cueAt`/`cueIn`, `cycle`), `kolob-meeting.js` (`HymnHands`, `hallListens`,
`conductorTick`, `enterSection`), `kolob-voices-choir.js` (THE WARD),
`kolob-voices-organ.js`, `kolob-hymnal.js`.

---

## 5. The Score

Plain JSON-able objects: no functions, no audio nodes (`Score.roundTrip` says
whether one survives JSON). The composer writes them, the performers render
them, the staff engraves them, the harness reads them. `KOLOB.Score` makes
them from a sketch (`hymn`, `line`, `note`, `chord`, `performance`: every
contract field filled in, a maker's own field carried over untouched) and
proofreads them (`validate(obj, kind)`, `validateHymn` …: a list of what is
wrong, empty when right).

```js
Hymn = {
  id,                       // ID: h:<meeting>:<i> | r:<meeting>:<k> | earth:<slug> | gift:<…>
  number: 214 | null,       // the hymn-board number
  nameDs,                   // the Deseret name (display); nameEn is dev-only, never rendered
  provenance: "earth" | "colony" | "gift",
  source: { book, year, page: num | str } | null,   // required for an Earth tune
  meter,                    // "CM" "LM" "SM" "87.87" "CMD" … (a string)
  form,                     // "ABAC" …
  dialect: "sacredharp" | "psalmody" | "tabernacle" | "gospel" | "shaker" | "oldway",
  mode,                     // one of §2's six
  keyMonzo,                 // relative to the day's keynote
  modeOfTime: "4/4" | "3/2" | "6/8" | …,
  beatS,                    // the default beat length in seconds (> 0)
  melodyPart: "S" | "T",
  lines: [Line],            // at least one
  refrain: [Line] | null,
  verses: [[syllable, …]],  // one syllable per melody onset of the verse
}
Line = {
  notes: { S: [Note], A: [Note], T: [Note], B: [Note] },   // the parts present; a part never overlaps itself
  cadence: { kind: "authentic" | "half" | "plagal" | "deceptive" | "openfifth" | "imperfect" | "none", beat },
  chords: [Chord], peak: bool, breathAfter: bool, fermataBeats: [beat],
}
Chord = { beat, len, roman, rootDeg: 0..6,
          quality: "maj" | "min" | "dim" | "aug" | "dom7" | "maj7" | "min7" | "hdim7" | "open5" | "unison" | "sus" | "other" }
Note = { beat, beats, deg, monzo, tie, fermata, syl: int | null, stress: 1 | 0,
         nct: null | "pass" | "nbr" | "susp" | "app" | "ant" | "esc",
         ornament: null | "grace" | "slide" | "turn" }
Performance = { hymnId, verse, practice, tempoMul, rubato, organ: { registration: [...] } | null, singers: [memberId] }
PRACTICES = ["sung", "notes", "lined", "hummed", "unison", "descant", "quartet", "round"]
```

**Extras the makers add** (carried by the shapes, not validated):

| on | fields | who |
|---|---|---|
| Hymn | `hymnist {id, nameDs, nameEn}`, `nameEn`, `report` (dev), `amen` (a Line, sung after the last verse), `tag` (a Line, gospel's close), `fuge {line, lines, gap, head, headNotes, entries, repeatFrom}`, `drone`, `voiceOrder`, `kind` (the unison song's: `primary` seats the Primary, `gift` gives vocables), `round`, `partner {combined, firstTune, …}`, `wandering`, `vocablesEn` | the composer |
| Hymn | `lds` (the hymnal's membership), `source.url` | the Earth tunes |
| Line | `plan` (dev), `barStart`, `startBeat` (a rest between lines is no Note) | the composer, the Earth tunes |
| Chord | `id` (the chord book's), `name`, `inv`, `fn`, `tones` (`[class, alt]`), `rootAlt`, `dim7`, `ring`, `swipe` | the chord book, the dialects |
| Note | `alt` (a chromatic note), `comma` (−1, 0, +1: a leap sung pure), `septimal`, `src` (the Earth tunes' spelling) | the composer, the Earth tunes |
| Performance | `forward: [{memberId, role, action, lines, gainDb, alone?}]`, `part` (`men` \| `women`, a verse given to one side); the old tune's `lines`, `octave`, `beatS`, `wear`, `detuneCents` | the cast, the old tune |

**Rules** (the proofreader enforces them):
- **Parts line up by beat.** Beat indices are shared across the parts of a
  line; chords are read off by beat (`Score.chordAt(line, beat)`).
- **One onset per syllable.** The melody part's `syl` counts on by one from 0
  through the verse, and again through the refrain; a melisma's continuation
  and a note tied into are `syl: null`; a verse's length must equal the
  melody's onsets.
- **Earth tunes** (`kolob-tunes.js`) use the same shape with `provenance:
  "earth"` and a cited `source` (`book`, `year`, `page`); where the source
  gives only the tune, `notes` holds only the melody part and `dialect` names
  the tradition.
- **Words are unbuilt.** The composer writes `verses: []` and the Earth tunes
  carry `verses: []` (Kolob sings no English); the one text written today is
  the gift song's vocables (`vocablesFor`: `h.verses = [vc.ds]`). The ward
  sings vowels drawn per verse until it has words.

**The chord book** (`Score.chordBook`): `write(chord, t, by) → id` (set on
the chord too), `at(t)` (the latest chord written at or before t, or null),
`reset` (a new meeting, a sunrise), `page`, `size`; only the last ten
minutes are kept and the chord standing at their edge. The house keeps one
book per tuning (`S.Harmony`, THE CHORD DESK in `kolob-meeting.js`: `at`,
`chordTones`, `write`, `voice`, `advance`, `harmonize`, `cadence`,
`sungUntil`, `fifthCount`, `reset`); the accompaniment reads the chord
standing at its own onset, never the last chord voiced; a composer's
`Line.chords` are written into it as they sound. **Reader's helps**:
`lineLength`, `chordAt`, `timeline(h, {beatS})`, `notesAt(h, t)`,
`syllableMap(h, verse)`, `monzoCents`, `toJSON`, `fromJSON(text, kind)`.

Authority: `kolob-score.js`; `kolob-composer.js`, `kolob-dialects.js`,
`kolob-tunes.js`, `kolob-cast.js` for the extras.

---

## 6. Events

**Two kinds, typed.** The engine emits notes and events; the page reads the
type and the payload, never a label.

**`onNote(n)`** — every sounded pitched note is reported, doublings included:
`{ layer, freq, startTime, duration, …extra }` (`startTime` absolute audio
time). The extras, by layer:

| layer | fields a note may carry |
|---|---|
| any house voice | `part` (S/A/T/B, `pedal`, `root`/`fifth`/`octave`, `doubling`), `chord` (the chord book's id), `hymnId`, `line`, `index`, `beat`, `deg`, `monzo`, `comma`, `tryNo`; `telegraph`: `marks` |
| `choir` (the ward) | a section's written notes once per section singing a Score part in an octave (not once per person): `part` (the singer's section), `sings` (the Score part), `hymnId`, `verse`, `line`, `beat`, `syl`, `deg`, `monzo`, `keyMonzo`, `comma`, `octave` (±1), `amen`, `fuging`, `tag`, `repeat` (a fuge or a round's pass sung again), `group`, `pass` (a round), `primary`, `refrain`; a person's own line once for that person: `member`, `role`, `sings: "key" \| "descant" \| "drone"`, `pitching`, `liningOut` |
| `organ` | the organist's: `part` (S/A/T/B, `fig`, `pedal`), `organist` (the style), `orn` (`susp` `app` `pass` `link` `echo` `fig` `seq` `quote` `arabesque` `strange` `intro` `close` `added` `mod` `pedalpoint`; the variations' `acc` `canon` `bitonal` `octave`), `hymnId`, `verse`, `line`, `beat`, `deg`, `monzo`, `keyMonzo`, and one of `givingOut`, `interlude`, `amen`, `modulation` (`keyMonzo` the keynote's), `prelude`, `variations: true`, `partner`; the house's chords: each voice an octave down, the chord's id, the pedal where the 16′ sounds |
| `cornet` | the partner's first tune: `part: "partner"`, `partner`, `of`, `line`, `beat`, `deg`, `monzo`, `octave`, `keyMonzo` |
| `trombones` | `part`, `choir` (`far` \| `near`), `line`, `loud`, `hymnId` |
| `oldtune` | the Earth tune's notes, `comma` |
| `band` | `part` (`melody` `cornet2` `alto` `bass`), `inst`, `band` (0, 1), `strain`, `bar`, `beat`, `beatInBar`, `downbeat`, `doubling`, `beatS`, `meter`, `loud`, `hymnId` |
| `handbells` | `part`, `role`, `ringer`, `bell`, `tech`, `pan`, `loud`, `reached`, `rings` |
| `choir` (the singing school) | `stage`, `wrong`, `rehearses` (the hymn rehearsed) |
| `handcart` | `part: "tune"`, `voice`, `verse`, `line`, `beat`, `syl`, `octave`, `loud`, `hymnId: "earth:all-is-well"` |
| `gulls` | `part`, `index`, `deg`, `monzo`, `loud`, `hymnId` |
| `tower` | the far tower's strokes: `bell`, `place`, `row`, `hand`, `muffled`, `monzo`, `changes: true` |
| `choir` (the gift) | `role: "tongues"` (`syl`, `wordDs` on a word's first syllable, `slur`) or `role: "hum"`, `member`; its reed on `harmonium` (`role: "tongues-reed"`) |
| `farward` | `part`, `deg`, `cents`, `verse`, `line`, `hymnId` |
| `choir` (the Hosanna) | `hosanna: true`, `logged: false`, `engrave: false`, `hymnId: "earth:assembly"`, `part`, `line`, `beat`, `deg`, `monzo` |
| `fiddle`, `choir` (the Social Hall) | `part` (`tune` `fig` `pick` `cad` `stop` `drone` `final`; the caller's `caller` \| `whoop`), `strain`, `time`, `line`, `bar`, `deg`, `monzo`, `septimal`, `orn`, `member`, `call`, `dances` (the hymn danced: a `hymnId` on the choir's layer is the ward singing that hymn) |
| `voice`, `harmonium`, `clarinet` (the bearers) | `testimony: true`, `speech`, `member`, `part`, `accent`; the reed's `move` (`echo` `double` `tune`), `deg`, `monzo`, `keyMonzo` |
| every guest's note | `guest` (its name) and `logged` (`guestNote`, `kolob-guests.js`) |

**`onEvent(ev)`** — `{ type, t, …payload }`, `t` the moment it happens in the
music. `KOLOB.Score.EVENTS` is the machine table: every typed event's payload
by field kind (`int num str bool obj arr mode cadence practice dialect
hymnId`, `?` nullable; a nested object is a payload of its own);
`validateEvent` holds an event to it. The types:

| type | what it says |
|---|---|
| `meeting-start` | `{n, sunday, kind, mode, keynoteHz, houseDialect}` — the meeting is called |
| `calendar` | `{n, sunday, kind, lights, rites}` — the Sunday's shape, once a meeting (typed only) |
| `transport` | `{action: "play" \| "stop" \| "sample"}` |
| `section-start` | `{section, index}` |
| `scene` | `{section, index, scene}` — a rite's seating as it begins (not the plain house) |
| `prelude-seating` | `{n, seating, under, style, at, …, ward: {seated, people}, organist: {style, nameDs, prelude}}` — who wakes the Sunday |
| `hymnal` | `{house, hymns: [{id, section, dialect, key, meter, piece}], forms: {round, partner, refrain: {id, dialect, after}, payoff, why}}` — once a meeting, with the plan |
| `hymns-of-the-day` | `{gestures}` |
| `hymn-announced` | `{hymn: {id, number, nameDs, meter, dialect, authorDs, mode, key, keyMonzo, form, modeOfTime}, leaderDs, ward: {chorister, keying, practices, forward, layout}}` — the board's announcement; `leaderDs` is the chorister |
| `verse-start` | `{hymnId, verse, practice, composed, performance}` — `performance` is the cast's Performance with `forward`, `tempoMul`, `beatS`, `organ: {registration, organist}` |
| `verse-line` | `{hymnId, verse, line, speechLine, practice, score, …}` — a composed line told with its Score (`keyMonzo`, `dialect`, `amen`, `refrain`, `group`, `pass`); `practice: "lined"` is the ward's reply to a lined line |
| `lining-out` | `{meter, syllables, hymnId, verse, line, composed, by, nameDs}` — the precentor gives a line |
| `cadence` | `{kind, hymnId, by}` — a verse's close (not `none`/`half`), the A-men (`plagal`), a fuging's close |
| `fuging` | `{entries, hymnId, head, by, …}` |
| `chord` | `{at, chord, by, voicing, freqs}` — a chord written into the book |
| `round-entry` | `{hymnId, entry, group, verse, singers}` |
| `partner` | `{hymnId, of, by: "organ" \| "cornet" \| "none", combined, verse, player}` |
| `refrain` | `{refrainId, statement, after, dox, by, key, dialect}` |
| `payoff` | `{kind: "assembly" \| "partner" \| "refrain", section, hymnId}` — once, as the doxology's payoff sounds |
| `chorale-prelude` | `{hymnId, t0, until, style, manner}` |
| `cast` | `{memberId, nameDs, action, actionDs, role, hymnId, verse?, line?}`; the organist's add `style`, `registration`, `manner`, `variations` |
| `guests-drawn` | `{guests: [{guest, section, index}]}` — the guests seated (never the Hosanna) |
| `guest-start` / `guest-end` | `{guest, section, logged, until}` |
| `guest` | `{guest, stage, logged, …}` — a stage of a guest already begun (§8 lists the stages) |
| `house-lets-go` | `{guest, at, until, layers, released, logged}` |
| `testimony` | `{stage, memberId, label, section}` — `rise` `bearer` `speaks` `echo` `double` `tune` `stillness` (not a guest's stage) |
| `sunrise`, `reckoning`, `drone-turn` | `{mode, keynoteHz}` a dark Sunday's doxology rises; `{ok, doxId}` the Kolob reckoning read once; `{index, to, glide}` the drone's step at a joint |
| `joint`, `room-empties`, `stillness`, `liahona`, `field`, `skip`, `telegraph` | `{last, toward, dur}`, `{toward}`, `{why, holdS}`, `{points}`, `{field}`, `{to}` (a dev jump), `{word, wordDs, marks}` |
| `motif-develop` `-reprise` `-answer` `-disperse` `-shadow` | the day's gestures at work |
| `vision` | in the table; nothing emits it today (the shelved Question's two rows left the table on 2026-10-01) |

**`logged: false`** on a note or an event means the page must neither print
it in the minutes nor engrave it on the staff nor name it on the board; the
staff (`kolob-viz.js onNote/onEvent`) and the console (`kolob-ui.js`) drop
such a note or event at the door. The Hosanna sends `guest-start`,
`guest-end` and `house-lets-go` with `logged: false` and nothing else (no
`guest` stage, no `hymn-announced`, no `verse-start`, never in
`guests-drawn`); every note of its hymn says `logged: false` and `engrave:
false` (`GuestHosanna.ENGRAVE_HYMN` is false: the owner's ruling, audio-only);
the conductor's `visit` is null while it sounds. The table of unlogged guests
is `UNLOGGED` in `kolob-meeting.js` (`{hosanna: true}`), read as a guest
arrives.

**A listener that throws** is passed over for that note or event — the music
and the other listeners go on — and its fault is told:
`console.error("Kolob: the note listener 2 threw (on a note of the organ)", err)`,
the first time and then at every thousandth, with its count (`kolob-core.js`,
THE FAULTS: `confess`, lent as `S.confess` and on the facade). Every fault the
house lives through is told so — a guest's material fallen back, a voice that
would not join the room, a context that would not resume, a hymn the worker
could not write (a worker that fails altogether says so once, by
`console.warn`, and its hymns take the idle road) — and only the cleanup after
a node that may already be gone, and a feature test's fallback, stay quiet.
The harness fails a run on any `console.error`, so a fault told on a clean run
fails CI.

**The staff's intake** (`kolob-viz.js onNote`): a note on `band`, `telegraph`
(with marks), a spoken `voice`, the new guest layers (`fiddle`, `handcart`,
`gulls`, `tower`, `farward`) and the melodic layers (`clarinet`, `choir`,
`bells`, `harmonium`, `strings`, `trombones`, `oldtune`, `organ`,
`handbells`); never the organ's pedal (except the variations'), never a note
under 20 Hz, never `logged: false` or `hosanna`.

**The log words are retired** (2026-10-01). Until then every event carried
`cat`, `label` and `detail` beside its `type` and payload; an event is now
its type and payload and nothing else, and new code adds no words. The one
reading the words had on the page, the bands' `cross` stage ("the band goes
by" or "the bands cross"), is the stage's typed `both`. `tools/lib/dump.js`
reads every live type by its fields (`typedEvent`) and keeps `legacyEvent`
for dumps of builds older than 2026-09-27; `tools/capture.js` prints a type
and its fields where it printed a label; `_harness.js` keeps its no-`type`
fallbacks for those old builds. `kolob-viz.js` never read them.

Authority: `kolob-score.js` (`EVENTS`), `kolob-core.js` (`emitNote`,
`emitEvent`), `kolob-meeting.js` (`UNLOGGED`), `kolob-guests.js`
(`guestNote`), `kolob-viz.js`, `kolob-ui.js`, `tools/lib/dump.js`.

---

## 7. Performance

**The ward** (`kolob-cast.js Cast.seat(stream, opts)`, pure on `cast:<n>`):
thirty-two singers, eight a part (`S0`…`S7`, `A0`…, `T0`…, `B0`…`B7`), each
with a throat of their own (`kolob-voices-vocal.js`), seated in families
across the pews. Phones get no fewer voices (owner): measure the cost, report
it, do not cut. Among them the people you come to know: the chorister, the
precentor and the soloist always; three to five of the optional roles (the
old bass, the harmony alto, the enthusiast, the child, the newcomer) as the
Sunday sizes it (`opts.size`: a dedication every one, a funeral fewer); two or
three testimony-bearers (drawn without replacement); the enthusiast seated if
the day's refrain needs him; the organist (an archetype of the style the
Sunday drew). The child and the organist have no seat among the 32; the
Primary's children (`ward.primary`) sit with families. Each person has habits
(tempo, rubato, holds, keying, descant appetite) that every plan reads.

**Who comes forward** (`Cast.planHymn`): one or two on a line, never more;
never the same person two verses running (the precentor excepted); the
treble verse is the soloist's alone; the newcomer is silent in the day's
first hymn until the line they join on; the enthusiast sings out on the last
verse about three times in four; the alto, the child and the old bass take
middle verses in an order the dice choose; nobody comes forward in a round, a
Primary song or a quartet's verses (the enthusiast on the gospel refrain
excepted). The plan's own verse count is 3–4 in the Tabernacle, 2 in the Old
Way, 2–3 otherwise, before the section's room is read.

**The practices, by dialect** (as `Cast.planHymn` plans and
`kolob-voices-choir.js singHymnWard` performs them):

| dialect (organ) | before the first verse | the verses | the close |
|---|---|---|---|
| tabernacle (yes) | the organist walks into a keyed hymn's key and gives out the tune; about one hymn in five the chorister hums the first note under its last chord (`keying.under`) | `sung`, the organ's four parts under each verse; one middle verse now and then `hummed` (14 %, the organ rests) or in `unison` (10 %); the last of three or four the soloist's `descant` (her habit), or now and then (22 %) her treble verse alone over the organ; fills between lines and an interlude before each later verse (the organist's) | the plagal A-men |
| sacredharp (no) | the chorister pitches the tune (`pitching`) | verse 1 `notes` (fa sol la mi), then `sung`; one class in ten sings every verse on the notes; the hollow square (`layout: "square"`); the treble and tenor doubled in octaves | the bare fifths written; no A-men |
| psalmody (no) | the pitching | `sung`, the lines from `fuge.repeatFrom` sung a second time; the hollow square | the written close |
| oldway (no) | the chorister keys it | `lined`: the precentor gives each line (the clarinet's line, `lining-out`), the ward answers slowly, everyone on the tune, the men an octave down, ornamenting at the marked places | none |
| gospel (no) | the chorister keys it | `sung` (now and then a middle verse in `unison`), the quartet seated inside the ward (the tenor harmony with five trebles, the lead with the altos and three trebles, the baritone with the tenors, the bass); about 45 % of gospel hymns (`QUARTET_RATE`) the verses are `quartet`: four of the ward on the near bus at the Score's exact pitch, the ward on the refrain; the refrain after each verse rises a little each time | the tag |
| shaker (no) | the chorister keys it | `unison`, everyone on the tune, a few men humming the drone where the tune has one | none |

Further: about 30 % of accompanied or gospel hymns of two verses or more give
one plain middle verse to the men or the women alone (`ONE_PART_RATE`; the
chorister `gives the verse to the men/women`). A Primary song (`hymn.kind:
"primary"`): the Primary sings every line at the front in `unison`, the ward
joins the chorus after the first verse, the chorister `leads the Primary`. A
round (`hymn.round`): unaccompanied, keyed; `["unison", "round"]` or
`["round"]`; the groups go in by the parts or by the pews, each `delayBeats`
behind the last, round two or three times; no A-men. A refrain statement
(`Cast.planRefrain`): no keying, no organ; the first by the enthusiast alone
then the ward's, later the ward's with the enthusiast singing out, in the
doxology the ward's; sung after the hymn's last verse, before its A-men or
tag. The partner's last verse, when `partner.combined`: the first tune played
against it on the chorister's clock, by the organist on `trumpet solo`
(`PARTNER_ORGAN`, 60 % where there is an organ) or by a cornet of the ward's
band (`seatedSend("cornet")`). Between verses: a breath; the fuging on the
hymn's own head where the section drew it (never in the Old Way or a
doxology); a seated guest in the gap after the middle verse. **How many
verses the section allows** (`performancePlan`): a round 2; a doxology 1 (2
unless lined); the Tabernacle 2–4, the Sacred Harp 2–3, the rest 1–2; a verse
over 100 s is sung once, over 55 s at most twice; no hymn runs past 1.5× its
section's planned length; `lead` 2.5–6 s, `tail` 5–12 s.

**The cast's actions** are the English keys of `ACTION_DS` (`kolob-cast.js`;
the Deseret values are the minutes'; a misspelt phoneme warns and prints "?",
never throws at load): a person coming forward (`comes forward`, `sings the
descant`, `joins in`, `sings out`, `starts the refrain`, `leads the quartet`,
`rises to bear testimony`, `calls the dance` … — `ACTION_FORWARD`, a ✦ row
each; the precentor's `lines out` its ☞ row), the chorister's keying and
pitching, and the organist's (the chorale prelude, the walk to a new key, a
fill, `strays into a strange key`, `plays variations on the hymn` …).

**The organist** (`kolob-organist.js`, pure; played on the pipe organ,
`kolob-voices-pipeorgan.js` through `kolob-voices-organ.js`). Three styles
(`STYLES`): `plain` (four-square, as printed, soft flutes, no fills), the
`victorian` (suspensions, passing notes, the swell; a fill at 13 % of joins,
at most two a hymn, never two joins running), the `improviser` (running
figures, the tune in the pedals, bitonal; a fill at 12 %, at most two, and
once a meeting a fill in a strange key). The Sunday leans the bench; the style
is seated with the ward (`Organist.seat` on `cast:<n>` → `organist`;
`S.Meeting.organist`). Every accompanied hymn (the dialect's `organ` flag:
the Tabernacle alone today) is the organist's: the modulation through the
day's own tonic chord into a keyed hymn's key, the giving-out (the tune's last
line, in the style's manner), the Score's four parts under each verse on the
chorister's clock (`lineEvents`/`lineDur`/`breathOf` with `ck = {rit, hold}`:
the cast's arithmetic, operation for operation; a hummed verse rests), fills
between lines (the ward waits: `piece.waits[i]`), the interlude before each
later verse (not after a fuging), the amen. `hymnHands(organist, h, stream,
opts)` writes the hymn in pieces from the time each is handed, with the same
dice as `accompany`'s whole: `giveOut`, `verse`, `interlude`, `amen`,
`modulation`. The chorale prelude (`Organist.prelude`; `preludeDraw` on
`cast:<n>` → `organist:prelude`) is a seating over the drawn one
(`prelude-seating.seating: "chorale"`) at the style's odds (plain 0.36,
Victorian 0.46, improviser 0.42), refused when the trombones play the first
hymn, the tune is withheld, the organ sits out (the arbor), the first hymn is
one line in unison, another guest wakes the morning, or the ward hums the
morning in. One `VoicesOrgan` case per pair of hands; a case is disposed after
its last pipe; STOP disposes them all (`S.organStop`). `S.organChord` plays the
house's own chords (the voluntaries, the joints' amens, a soft chord in the
testimony) on the same pipes; the old additive organ (`houseOrganChord`,
the A/B `?organ=house`) was retired on 2026-10-01 — its level stays the
pipes' reference (`HOUSE_REF`), and its part line (`organPartLine`) remains
only as the ward's fallback for a hymn without the organist's hands on it
(`wardOrgan`), which no live page reaches.

**The forms** (`Hymnal.forms(info, rows, R)` on `forms:<n>`, `FORM_ODDS`):
- *A round* (22 %): a hymn row after the first, never the doxology, written by
  the composer's `round` (`row.piece: "round"`; an Old Way row takes the
  Shakers' dialect).
- *The partner hymn*: the doxology written by `partner` on the first hymn
  (`row.partnerOf`), 14 tries, in a dialect the fit check can pass
  (`PARTNER_DIALECTS`: Tabernacle on Tabernacle; the Shakers' unison on a
  Shaker or an Old Way tune); only when the first hymn is at home and the
  doxology keeps the day's mode; never with the cumulative assembly.
- *The wandering refrain*: `wanderingRefrain` fitted to the keys of the
  hymns it follows, a statement after the first hymn, after one later hymn and
  in the doxology (`refrainIn` into each one's key and dialect,
  `REFRAIN_SET`): at most three; never on a fast Sunday or at a funeral.
- *The doxology's one payoff*: the cumulative assembly, else the partner hymn
  (the payoff die under 0.68), else the refrain (the die's top 0.32), never
  both; a Sunday may have none. The band is never seated in a doxology.
- The desk writes them as hymns; an order carries `piece` (`compose`,
  `round`, `partner`, `refrain`, `refrainIn`); the refrain's orders stand
  aside (no hymn is written knowing them, no board number).

**The house dialect** is drawn from `HOUSE_ODDS` per kind (`kolob-hymnal.js`),
leaned by the Sunday (`SUNDAY_LEAN`) and the arbor (`ARBOR_LEAN`); `KIND_LEAN`
leans the unison song's kind; each hymn's dialect leans to the house's
(`NEIGHBOURS`, `HOUSE_W` 6), the doxology to the Tabernacle's brightness and
the gospel ring.

**The choir.** The ward is the performer of every composed hymn
(`S.singHymn` → `singHymnWard`) and of every line the choir sings around
them (`S.choirVoiceLine` → `wardSectionLine`: eight people each in their
own voice). The four formant voices that sang before it (`singHymnHouse`,
`houseVoiceLine`, the `?choir=house` A/B) were retired on 2026-10-01; a page
without the cast sings no hymn (`hymnPlan` returns null, `singHymnWard`
nothing).

**Levels and seats.** The ward pours into the `choir` layer (its slider, its
seat in the rooms) at `WARD_LEVEL` = 0.16 (`kolob-core.js`); a person come
forward into a nearer seat beside it (`ROOM_DEPTH["choir-near"]` −0.2, under
the same slider); a section of eight standing in for a house voice sings at
`HOUSE_SECTION_GAIN` = 0.68 (`kolob-voices-choir.js`); each singer at
`WARD_GAIN` = 1/√8 (`kolob-cast.js`). `ROOM_DEPTH` (a depth bias before the
equal-power law, negative nearer): `voice` −0.35, `telegraph` −0.25,
`harmonium` −0.15, `clarinet` −0.08, `bells` 0, `tuba` 0, `choir` 0.05,
`organ` 0.10, `strings` 0.15, `drone` 0.15, `ambient` 0.20; the guests'
unity-gain seats `handbells` −0.35, `cornet` −0.12, `fiddle` −0.2, `floor`
−0.25, `speaker` −0.35, `reed` −0.15. `S.seatedSend(layer)` seats a guest who
stands in the chapel as a layer of its own, or into the layer's gain where one
exists (the practice into `choir`), through the meeting's doors (`doors.seats`;
STOP closes them). The layers with sliders are `LAYERS` in `kolob-core.js`:
`organ drone choir clarinet harmonium strings bells voice telegraph tuba
ambient` (`tuba` is the raspberry's alone).

Authority: `kolob-cast.js`, `kolob-voices-choir.js`, `kolob-voices-vocal.js`,
`kolob-organist.js`, `kolob-voices-organ.js`, `kolob-hymnal.js`,
`kolob-dialects.js` (each dialect's profile), `kolob-core.js` (levels, seats).

---

## 8. Guests

**The common contract.** Each guest is a room `kolob-guest-<name>.js`
(`KOLOB.Guest<Name>`) that plans purely on its own stream and performs through
hooks: `plan(info, stream)` → a seat (`{section, at, dur, holdUntil, …}`) or
null; `decide`; `prepare(material, stream)`; `score(material, stream, t)`
(every note and stage, pure); `perform(ctx, dest, t, material, stream,
hooks)`; `oddsFor(info)`; `warm` where it has one; its `NAME`, `LABEL`
(`guest:<name>:`), `SEATS`, `ODDS`, `LEVEL`. `info` carries `n`, `kind`,
`sunday`, `sections` (the plan), `guests` (those already seated, each with its
rite's `index`), `odds`, `force`. **Odds** come from one table,
`KOLOB.Calendar.GUEST_ODDS[guest][column]`, the columns the nine Sundays of
`ORDER` (`ordinary fast conference pioneer christmas easter wedding funeral
dedication`), read by `Calendar.guestOdds(guest, sunday)` and handed to every
room as `info.odds`; every room's `oddsFor` reads `info.odds` first and its
own `ODDS` only in a lab without it. The variations keep the organist's lean
on top; the Hosanna comes only on its two Sundays; `changes` is the chance, of
the Sundays the steeples ring, that they ring changes; `testimony` is not in
the table. **Hooks** the meeting passes: `defer(at, fn)` (lay the piece out on
the `guests` lane a slice at a time: the engine's cues, never the room's),
`onNote`, `onStage`, `onCast`, `onEvent`, and where a room needs them
`organ`/`organist`/`harmonium`/`dests`/`arm`/`still`/`only`. The meeting tags
each note with `guest` and `logged`.

**The budget** (`Calendar.GUEST_BUDGET`, enforced in `planMeeting` by
`budgetRefuses`): `max` 2 guests a meeting, the Hosanna counted; one of the
`showpieces` (the variations, the Social Hall, the Hosanna) at most; never two
guests in the same rite, nor in neighbouring rites unless the Sunday's
`neighbours` allow the pair (Pioneer Day: the band and the Social Hall). A
guest's rite is its `index` (the far ward's hymn), else the first rite of its
`section`. Each room's own rules come first; the budget is asked last, and a
guest it refuses is not seated (its dice were thrown); `C.budget.refused`
keeps who and why (`S.Meeting.budget`, dev and harness). **Who asks first**
(`GUEST_BUDGET.order`): the band, the steeples, the old tune, the trombones,
the singing school, the handbells, the variations, the gift, the far ward, the
Social Hall, the handcarts, the gulls; the last asked yields when the budget
is full. **The Hosanna is asked before all of them** (its plan is pure: asked
with no guests, planned again at its hook with them) and keeps its place and
the showpiece (`GuestHosanna.YIELD` false). **The switch's guest**
(`forcedType`) is seated past the budget; the others leave it its place and
its showpiece; a guest the switch names that keeps a seat keeps the band away
(one procession a Sunday), as do the trombones and the handcarts asked for by
name. The testimony-bearers are not guests: never in `C.visitations`, never
counted, never a neighbour; a guest seated in the testimony keeps it.

**The guests.**

| guest | seats | material | how it comes; its `guest` stages |
|---|---|---|---|
| `bands` (the Nauvoo band) | the prelude or the postlude, never while the ward sings | one of the day's hymns as a march in strains; a second band some days | cued; made ready a second ahead; the house takes no air. `approaches` `second` `cross` `passes` |
| `steeples` | the prelude or the postlude (the meeting's own dice) | the valley's bells | the poll. `answer`, `last-bell`; ringing changes: `changes:rounds` `:go` `:round` `:stand` (`method`, `touch`, `muffled`), layer `tower` |
| `oldtune` | the prelude, the testimony (an interlude; a hymn when forced) | an Earth tune of the day's colour whose notes the tuning holds (`oldTuneCandidates`) | the poll. `remembered`, `gives-out`; layer `oldtune` |
| `trombones` | the prelude's first minute | the day's first composed hymn (`GuestTrombones.chorale({hymn})`); without a hymnal, the day's theme poured into a chorale (`dawnChorale`) | cued, laid out a phrase at a time 2.5 s ahead; the prelude lasts until the far choir's last chord. `far` `answer` `together`, with `side` |
| `singingschool` | the prelude (experimental: `KOLOB.Experimental.singingSchool`; never at a funeral) | the day's first hymn, rehearsed (`rehearses`) | cued; the morning seated around it (`school`). `fork` `pitch` `try` `cut` `alone` `again`; layer `choir`, seated into the choir's gain |
| `handbells` | the invocation, the sacrament, the postlude | the day's first hymn (the doxology's in the postlude; a round of their own) | cued; layer `handbells`, seated −0.35. `intro` `round-entry` `cascade` `final` (the page's table also lists `ring`, which nothing sends) |
| `variations` | the prelude (the first hymn; then no chorale prelude) or the postlude (a hymn sung) | three to five characters on a hymn (`Organist.variations`; needs the pipes) | cued; the set made ready in idle time. a stage per character (`chorale` `trio` `canon` `minuet` `bitonal` `polonaise` `march` `finale`, with `keys`, `regs`); the organist's `cast` rows say `variations: true` |
| `changes` | the steeples' seat (a variant of the steeples, not a guest of its own) | Plain Hunt or Plain Bob from a far tower | with the steeples |
| `tongues` | the testimony (most on a fast Sunday and at a dedication) | a free song by one of the day's bearers; the ward hums its last note; the harmonium takes up its opening; the opening may seed the next hymn | cued. `rises` `sings` `the height` `the ward hums` `the harmonium` (the page prints the last two; the rise is the singer's ✦ row) |
| `farward` | a hymn (its `index`; never the doxology, a round, a lined hymn or the Primary's) | the same hymn, a half to a whole line behind, in its own tuning | hooked to the ward's own singing (`S.farWardFor`), never cued nor polled; told each verse as the desk writes it; the hymn held for its last verse. `verse` once |
| `hosanna` | the last doxology's close, Easter and a dedication only | "The Spirit of God" (`earth:assembly`) by the full ward and organ after the shout | after its hymn and any guest; holds the section; audio-only and unlogged (§6) |
| `socialhall` | the postlude, which it replaces (Pioneer Day, a wedding, a jubilee; never a funeral or a fast Sunday) | a reel or a jig made of one of the day's hymns (`dances`), a fiddle and a caller | cued; the room's sounds baked in idle time once seated; the drone steps back to 0.18 until the applause. `benches` `honour` `tuning` `A` `B` `potatoes` `tag` `final` `applause`; layers `fiddle`, `choir` |
| `handcart` | the prelude, the testimony, an interlude, the postlude (never with the band) | "All Is Well" (`earth:all-is-well`) far across the fields | cued; made ready a second ahead. `approaches` `sings` `passes` `gone`; layer `handcart` |
| `gulls` | the prelude, the invocation, the testimony, an interlude, the postlude (never at a funeral) | cries on the hymn's head | cued; made ready a second ahead; the house takes no air. `gulls`, `head`; layer `gulls` |
| the testimony-bearers (`kolob-testimony.js`) | the testimony's start plus their `at` | two or three of the ward speak in turn, no words; the harmonium or the clarinet plays the phrases back | not guests; the house lets go as the first rises and listens until the last sits (`testimonySounding`); the still small voice keeps its peace (`S.testimonyHolds`); `testimony` events |

The page's own list of the stages it prints is `GUEST_ROWS` in `kolob-ui.js`;
a stage it does not know prints no row.

**The Ives switch.** `KolobAudio.setForceVisitation(on)`: `true` draws one of
the Ivesian guests (`forcedPick` on `meeting:<n>`: the band at weight 2, the
steeples, the old tune, the trombones, the handbells, the handcarts, the
gulls, the variations, change ringing, the far ward at 1); a name (dev) seats
that guest: `FORCEABLE` is `bands steeples oldtune trombones handbells
singingschool handcart gulls variations changes tongues farward hosanna
socialhall testimony` (the Hosanna on its Sundays only; `changes` seats the
steeples in the prelude; the Question is not offered). The page takes
`?guest=<name>` (`kolob-ui.js`), the harness `force=<name>`. The trombones or
the singing school asked for by name keep the prelude for themselves.

**The fife is gone.** `VISIT_FN.bands` is the Nauvoo band (`S.nauvooBand`,
`kolob-guest-bands.js`) and nothing else: a page without the band's room seats
no band.

**The house lets go.** As a guest arrives (`arrive`) the house releases its
held notes (`S.houseLetsGo(t, guest, logged)`, told as `house-lets-go`) and,
for the guests in `LISTENED` (`trombones handbells singingschool handcart
variations tongues socialhall hosanna`), listens until the guest's span ends
(`hallListens`); the band and the gulls take no air and the house carries on.
The conductor's `visit` names the guest while it sounds unless it is unlogged.

Authority: `kolob-calendar.js` (`GUEST_ODDS`, `GUEST_BUDGET`),
`kolob-meeting.js` (planMeeting, `FORCEABLE`, `VISIT_FN`, `PRE_MADE`,
`LISTENED`, `arrive`), `kolob-guests.js` (the set pieces, `guestNote`), each
`kolob-guest-*.js`, `kolob-testimony.js`, `kolob-ui.js` (`GUEST_ROWS`).

---

## 9. Versions and handoffs

**VERSION** (`art/kolob/VERSION`, one line: `v0.36.N — what the owner would
notice`). Every commit that changes what the owner hears or sees in
`art/kolob/` bumps it in the same commit, semver-style, with a summary of what
the owner would *notice*, not the refactor. `index.php` prints it under the
page with a fingerprint of the served bytes and the newest asset's mtime, so
the owner can verify the build they are hearing. Dev-only changes (tools,
labs, docs, the harness) do not bump. (`README.md` and the repo's `CLAUDE.md`
state the same rule.)

**Before pushing** (CI runs the same): `npm run lint`, `node
art/kolob/tools/loadcheck.js`, `node art/kolob/tools/lends.js`, `node
art/kolob/_harness.js 300 7`, `node art/kolob/tools/selftest.js`; for anything
that could move the music, `node art/kolob/tools/tally.js --a git:main --b
worktree --seeds 1-20` (a housekeeping change leaves every seed byte for byte
the same). The comments carry the rules: when a rule changes, grep for the old
rule's words and fix every comment that states it.

**Handoffs** (`handoff/<name>-<n>.md`, one per milestone): what shipped; how
to hear or see it (URL, seeds, timestamps); requests to the integrator; known
issues. What a later pass superseded moves to `archive/handoff/`. **Listening
packets** (`handoff/listen-<tag>.md`, for the owner, at every merge): one page
— what is new and how big it is, honestly; a handful of seeds, each with a
timestamp and what to listen for; the dev jump links; the known rough edges.
Nobody but the owner can hear; every level before a packet was measured.

Authority: `VERSION`, `index.php`, `README.md`, `CLAUDE.md`,
`.github/workflows/kolob-check.yml`, `archive/plans/PLAN-EXECUTION.md` §4.5.

---

## 10. Housekeeping notes

Kept from the 2026-10-01 housekeeping (nothing musical moved):

- `_harness.js` is tracked and excluded from deploy; CI parses every file,
  lints, loads the engine headless, checks the bag, plays a meeting twice byte
  for byte and runs `tools/selftest.js`.
- The bagpipe and the Question are in `shelved/`; `SHELVED` in `kolob-core.js`
  remains the mechanism for a muted layer, empty.
- One number for the Whole switch: `kolob-meeting.js CUMULATIVE_ODDS` (0.08),
  lent as `S.CUMULATIVE_ODDS`, read by the page through
  `KolobAudio.getCumulativeOdds`.
- Load-time throws are gone from the cast: a misspelt phoneme in `ACTION_DS`
  warns and prints "?". The hymnal's worker forgets refrains with their
  meeting's hymns.
- ESLint (`eslint.config.js` at the repo root) is the baseline: no undefined
  names, no unused variables; `no-use-before-define` is off because the rooms
  declare their constants at the foot and read them at call time, which `var`
  hoisting makes safe.
- The fife (`twoBandsCross`), the `CUED` table, the `CALENDAR` fallback in the
  meeting and the harness-only lends (`S.setSynthSalt`, `S.audition`,
  `S.handsLog`, `S.HOUSE`, `S.HOUSE_RELEASE_S`, `S.MEETINGS`,
  `S.UNLOGGED_GUESTS`, `S.testimonySounding`) were removed; the calendar and
  the band's room are required, and a guest's record says `cued: true` for
  itself.
