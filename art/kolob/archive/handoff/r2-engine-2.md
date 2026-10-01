> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r2-engine-2 — the bugs, and the second look's cleanups (Round 2, milestone 2)

*Crew: r2-engine. Branch `kolob-r2-engine`. 2026-09-27.*

**Branch-local version:** `v0.32-r2-engine.2 — the choir's alto stays under
the tune; the organ, harmonium, strings and the deacon's lean follow the chord
being sung, not the next couplet's; a guest holds the section open until it has
gone by; the hymn board names the old tune; every pitch that sounds is
reported, and the strings no longer bow a fifth outside the tuning.`
VERSION is not bumped; the integrator assigns v0.34.

Built on milestone 1 (`a20d993`). Everything here is silent-tested: the Node
harness, and muted headless Chrome (`--mute-audio`).

---

## What shipped

### a. The alto stays under the tune (voice crossing)

- **Before:** `Harmony.harmonize` voiced a free chord, then wrote the tune over
  its soprano. Measured on the M1 engine with a probe that announces the chord
  *as sung*: **167 of 589 chords (28.4 %) had the soprano at or below the alto**
  (six seeds, 1200 s: 1847 14.7 %, 5 31.6 %, 9 23.4 %, 77 35.5 %, 4242 28.7 %,
  12 31.4 %). The harmony row reported the voicing before the pin, so the old
  harness counted 0.
- **Now (`kolob-harmony.js`, THE PINNED SOPRANO):** the soprano is fixed first,
  and the alto, tenor and bass are seated under it.
  - Every seating of chord tones with B < T < A < S is tried and scored like any
    voicing: motion from the chord before, the third present, the root doubled,
    parallel octaves refused, parallel fifths welcome.
  - It is held to the hymnal's spacing: at most an octave from S to A and from
    A to T. *(Corrected in Round 2: that holds on the first try. Once
    spacing becomes only a cost (seat ≥ 2), a chord may open wider: 28 of
    15 293 pinned chords (0.18 %, all at seat ≥ 2) have S–A wider than an
    octave, and 2 have A–T; 154 runs.)*
  - When nothing passes, the choir reaches in a fixed order: spacing becomes a
    cost; the lower voices go a third further down (bass to E2, tenor to B2,
    alto to A3); the bass takes the chord's third or fifth (a sixth chord); a
    bare-fifth chord takes its third back; and only then are consecutive
    octaves allowed, at a cost.
  - Over 400 seeds (40 516 pinned chords) the seats were: 86 % first try,
    8.1 % lower voices a third down, 3.2 % inverted, 1.4 % both, 1.2 % a bare
    fifth given its third back, 0.1 % other, and **0** needing consecutive
    octaves.
  - The dice are unchanged: the same three per note (root, open, the inversion
    die when a chord leads). So the timing, the roots and the tune of every
    verse are what they were; only the lower voices move.
- **The harmony row now reports the chord as sung,** once per chord, with its
  time (`at`), id (`chord`), writer (`by`), `voicing`, `freqs`, `n`, `pinned`
  and `seat`.
- **Result: 0 of 596 pinned chords cross over the same six seeds; 0 in 406
  seeds.**

### b. The chord timeline

- **New `kolob-score.js`: THE CHORD BOOK.** A pure timeline:
  - `write(chord, t)`;
  - `at(t)`, the latest chord written at or before t;
  - `reset()`, a clean page.
  It is loaded after pitch (`_engine.php`).
- **THE CHORD DESK (`kolob-meeting.js`, lent as `S.Harmony`).** Every chord is
  voiced *from the chord standing at its own time*, written into the book at
  that time, and announced:
  - the choir's verse lines (each chord where it is sung);
  - the lining-out answer;
  - the whole tune at last;
  - the organ's chords;
  - every cadence (joints, the doxology amen, the fuging's convergence, the
    assembly, the raspberry's setup).

  A new meeting, or a sunrise, opens a clean page.
- **The accompaniment asks the book** for `at(onset)`:
  - the organ under the singing (`at(t + 0.1)`);
  - the harmonium's inner voices;
  - the strings' pad;
  - the clarinet's chord-tone lean and the tines' lean (both at the line's
    onset);
  - the bagpipe (shelved);
  - `KolobAudio.getHarmony()` (at the audio clock).
- **One audible consequence in the amens.** The fuging convergence and the
  assembly's amen used to hold the *final* chord in the organ under the choir's
  IV. The organ now plays IV then I with the choir, ending exactly where it did.
- **Result:** every accompanying note took the chord standing *in the book*
  at its onset, and sounds that chord's pitches:
  - 6 seeds, 1200 s: 4 356 of 4 356 notes (organ, harmonium, strings, choir,
    clarinet, tines);
  - 406 seeds: all pass.

  *(Corrected in Round 2: this measured agreement with the book, not with the
  choir. The book also holds the joint's cadence and the organ's advance, so
  the check passed while those chords sounded under a line still being sung:
  on this commit, 46 of 222 accompanying notes begun under the choir named
  another chord on seed 9 alone. Round 2 below fixes the cause and adds the
  check against the sung chord.)*

### c. A guest holds the joint

- **The conductor** (`kolob-meeting.js`) does not end a section while a guest is
  sounding: a visitation, or the whole tune at last. The section runs on
  (owner: "if the section needs to be a bit longer, that's okay").
- **The steeples are no longer cut short to fit** what was left of their
  section. v0.32 capped them at the remainder + 12 s, then turned the section
  over under them anyway. They now ring their whole 45–75 s.
- **Typed events** (SCORE §6) mark every guest's span:
  - `{type: "guest-start", guest, section, until, logged: true}`;
  - `{type: "guest-end", …}` at its end.
  The page ignores both.
- **Result:**
  - 30 seeds with the Ives switch at 1500 s: 92 guests and **0 turnovers under a
    guest**. A mutant with the hold removed has **23**, so the check has teeth.
  - 14 sections were held, all for the steeples, by 0.7–29.9 s.
  - Over 400 seeds, sections overrunning their plan by more than 12 s went from
    0.62 to 0.71 per run.

### d. The hymn board and the Question's remnants (`kolob-ui.js`, `index.php`)

- **The direction line names the old tune**: 𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤 ("AN OLD TUNE").
  - Before, `VISIT_FLAG` had no `oldtune` and fell back to "two bands".
  - An unknown guest now shows nothing, never another guest's name. The minutes
    do the same.
- **The shelved Question is gone from the UI:**
  - its strings;
  - its two minute-rows;
  - its flag;
  - the Ives-switch comments.

  The engine code for the Question, and the viz's drawing of it, stay (not
  mine).
- **Checked in muted Chrome** (seed 5, Ives on, the old tune in the prelude at
  0:14):
  - the board read 𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤, and "an old tune" in Latin mode;
  - the minutes carry the old-tune row and no raw layer name.

### e. The harness (untracked; see "Harness changes")

- **Meetings** are counted without the sunrise. The raspberry's "next meeting"
  and the withheld-tune checks also use the meeting row only.
- **FOLD_UNSAFE is computed** from the engine's own pool and mode tables: a class
  is folded when the mode maps it onto the class below.
  - It finds: penta — all is well, kingsfold, simple gifts; hexa — all is well,
    kingsfold.
  - The old hand list named "sweet hour", which is no longer in the pool, and
    missed SIMPLE GIFTS.
- **Every sounded pitched note is reported** (engine side), doublings included:
  - every voice of an organ chord, plus its pedal (tagged `part`, `chord`);
  - both of the harmonium's inner voices, and every note of its shadow and
    answer lines (v0.32 reported one held note);
  - the strings' root, fifth and octave;
  - every voice of the fuging and assembly amens;
  - the audition's three choir voices;
  - the bagpipe's octave;
  - the Question's answers and second rank (shelved);
  - the old tune, on its own layer `oldtune`, which the page does not engrave
    (and the minutes skip).

  **Exempt by design, and listed in the harness:**
  - the meetinghouse bell and the steeples (inharmonic strikes, freq 0 as
    before);
  - the still small voice;
  - the telegraph;
  - the field's clock and crickets;
  - the visiting band, which is in its own key (reported, not held to ours).

  **Reporting found a real out-of-tune pitch:** the strings bowed a *pure*
  fifth over chords whose own fifth is not pure (the diminished chord on ti; on
  re in aeolian, la in dorian, mi in mixolydian). That pitch is outside the
  day's tuning and against the choir. Such a pad is now the bare octave
  (`pureFifth`, kolob-voices-ground.js). Pitch adherence is 100 % on every run
  checked.
- **`window.performance`** has been in the mock since M1: `window` is the global.
- **New tallies:**
  - cadence types by kind and by who closes;
  - SATB legality read from the emitted voicings;
  - the chord timeline;
  - the guest hold;
  - the pure-composer check (f).

### f. Purity prep for the hymn composer

- **C has a frozen accessor interface: THE CHORISTER'S BOOK** (`S.Meeting`,
  `Object.freeze`d, documented in kolob-meeting.js):
  - `meetingNum`, `activity`, `sunday()` (the kind's MEETINGS row), `section`,
    `sectionIndex`, `sectionDur`, `plan`, `meter`, `verseLine` /
    `advanceVerse(k)` (the one write the house makes), `cumulative`,
    `assemblyFired`, `withheld`, `assemblyUntil`, `visitType`;
  - `moment()`.

  `S.C` is no longer lent: **grep finds no `S.C` in any module.**
  `KOLOB.Meeting` exposes `book` and `desk`, not C.
- **THE MOMENT** is a plain object:
  `{ now, meeting, section, activity, bright, mode, F0, seasonPos, arc, cumulative, assemblyFired, chord }`.
- **Harmony is pure** (`window.KOLOB.Harmony`):
  - `voice(root7, opts, moment, D)`, `advance(opts, moment, D)`,
    `cadence(kind, moment, D)` and `harmonize(lineNotes, moment, D)` read only
    the moment and the dice;
  - it keeps no state and emits nothing;
  - the tuning comes from the new pure `KOLOB.Pitch.tuning(mode, F0)`.
- **Melody reads only its moment:**
  - `Motif.request(voice, moment, R)`, `claim(voice, moment, R)`,
    `post(from, to, motif, type, moment, R)`, `overdueFor(voice, moment)`,
    `develop(voice, motif, maxChain, moment, R)`,
    `decompose(motif, moment, R)`, `newMeeting(moment, R)` and
    `anyWorking(moment, R)`.
  - It keeps the meeting's material as its own state (theme, lineage, ledger).
  - It reports through `Motif.setLog(fn)`, which the chorister wires to the
    minutes.
  - `Prosody` was already pure.
- **Grep:** no `KOLOB._s` and no `S.` in kolob-harmony.js, kolob-melody.js or
  kolob-score.js.
- **The harness proves purity.** It loads pj2-rand, pitch, score, melody and
  harmony alone in a bare `vm` context, and takes the house away before the
  composers load. It then runs newMeeting → request → pourIntoLine → harmonize →
  cadence twice with the same moment and seed: identical, another seed differs,
  and `KOLOB._s` stays undefined.
- **Behaviour is otherwise unchanged:** the same dice in the same order. The
  400-seed statistics below show nothing moved but (a)–(c) and the reporting.

### g. Stale pointers

- **tune-lab.js:** the error message now reads "load the engine first (the list
  in _engine.php)"; the header names kolob-guests.js and kolob-pitch.js.
- **room-lab.js:** its error message.
- **bagpipe-lab.js/.php:** the headers.
- **kolob-core.js:** the room list now includes kolob-score.js.
- **The rest are requested below:** the labs other crews are editing today.

---

## How I verified it

- **Harness, 6 seeds × 1200 s** (1847, 5, 9, 77, 4242, 12): all PASS.
  - Soprano ≤ alto: 0 of 596 pinned chords.
  - Chord timeline: 4 356/4 356 — the chord standing in the book, not the
    chord being sung (see Round 2).
  - Pitch adherence: 100 %.
  - Consecutive octaves in a sung line: 0.
- **406 seeds × 1200 s** (1847, 5, 9, 77, 4242, 12, 1001–1400): **406/406 PASS**.
  46 print the chance NOTE "no stillness", as in M1.
- **Standard runs, all PASS:** 2700/1847, 2700/5 (ives razz cumulative),
  1500/3, 1500/12 (ives razz cumulative), 1200/9 (ives), 1200/77 (razz
  cumulative), 900/9.
- **REPRO PASS:**
  - `repro 1500 1847 ives razz cumulative`: 192 late emissions, up to 1.09 s;
  - `repro 1200 77`;
  - `repro 1500 9 ives`;
  - `repro 1500 21 ives`.

  In each, the score is identical under jitter and under re-salted synth
  streams, and the sound changes only with the salt.
- **`transport 1847` and `transport 77` PASS:** pause holds, and STOP→PLAY lets
  nothing stale into the hall.
- **Muted headless Chrome (port 9421, `--mute-audio`):**
  - index.php, seed 5 with the Ives switch: the old-tune flag in both scripts,
    the minutes, the typed events and the harmony rows arrive; the console is
    clean.
  - room-lab (plays), tune-lab (7 tunes), bagpipe-, question-, voices-,
    instruments- and earth-tunes-lab: all clean consoles.
  - The M1 three-tab REPRO driver on seed 1847, 120 s:
    - tab B (all 18 stops auditioned, a layer muted, volumes moved) equals
      tab A;
    - tab C (paused 10 s at 40 s; its audio clock stood still, nothing
      sounded) equals A;
    - **Chrome equals the harness line for line** (87 lines, including the
      new harmony rows and typed events);
    - all consoles are clean.
    - The driver's normalizer must shift the new absolute-time fields `at`
      and `until` as it does `t` (fixed in the scratch copy,
      `/tmp/claude-501/m2/cr/norm.js`; the r2-tools crew's tools may need the
      same).

**Statistics, M1 (a20d993) vs M2, 400 seeds × 1200 s** (6 seeds agree):

| metric | M1 | M2 | shift | why |
|---|---|---|---|---|
| organ onsets/min (chords) | 2.74 | 2.83 | +3.2 % | the fuging and assembly amens: the organ plays IV then I with the choir, two onsets where it held one |
| organ notes/min | 2.74 | 14.13 | ×5.2 | every voice and the pedal reported |
| harmonium notes/min · onsets/min | 0.98 · 0.98 | 4.55 · 3.97 | ×4.6 · ×4 | every note of its lines reported; its turns are unchanged (shadows 6.47 → 6.48) |
| strings notes/min · onsets/min | 1.92 · 1.92 | 4.31 · 1.92 | ×2.2 · 0 % | root, fifth and octave reported; the same pads |
| choir onsets/min | 6.43 | 6.63 | +3.1 % | the fuging and assembly amens now reported |
| clarinet · bells notes/min | 8.65 · 2.33 | 8.69 · 2.32 | +0.5 % · −0.5 % | the lean reads a different chord, so a lean draws a different number of dice |
| old tune notes/min | — | 0.15 | new | its own layer |
| parallel fifths (count, per run) | 4.4 | 18.7 | ×4.3 | now counted on the chords as sung; M1 counted the voicings the pin overwrote |
| cadences/min: plagal · authentic · half | 0.479 · 0.067 · 0.036 | 0.481 · 0.066 · 0.036 | ≤ 0.4 % | — |
| guests fired · drawn | 0.892 · 1.150 | 0.887 · 1.150 | −0.6 % · 0 | — |
| sections entered · joints/min | 11.22 · 0.513 | 11.21 · 0.513 | 0 | — |
| section overrun > 12 s, per run | 0.62 | 0.71 | +13 % | the guest hold (steeples) |
| verse lines/min · linings-out · fuging · stillnesses | 0.565 · 3.94 · 1.61 · 2.33 | 0.571 · 3.85 · 1.61 · 2.32 | ≤ 2.2 % | — |
| silence share (no melodic voice) | 0.330 | 0.321 | −2.7 % | the harmonium's lines report each note's true length (v0.32 held one note for notes × beat) |
| planned section lengths | — | — | identical | — |

**Everything else is identical or within 1 %.** It is still Kolob:
- the same Sundays, sections, guests and cadence mix (plagal about 82 %);
- the same air.

## Harness changes (`art/kolob/_harness.js`, untracked, gitignored; the integrator copies it)

- **Records.** Every record keeps its emission order (`seq`) and the note's
  `part` and `chord`. Events keep all their fields, and typed events are tallied
  as `type:<t>`.
- **The r2-tools crew's port is applied:** `header` and `KOLOB_LEGACY` (their
  `engine-crew-harness.patch`, verbatim). A plain `dump=` is unchanged by it.
- **LAB_ONLY:**
  - `kolob-score.js` is removed, since it is now an engine room;
  - `kolob-guest-trombones.js` is added, for when that branch merges.
- **Adherence** reaches two more octaves down (the organ's pedal). **PITCHED**
  adds `oldtune`, `bagpipe` and `tuba`.
- **New printed lines:**
  - `SATB as sung`;
  - `consecutive octaves` (first 3);
  - `cadences`;
  - `chord timeline`;
  - `guests hold the joint`;
  - `every sounded note`;
  - `fold-unsafe old tunes`;
  - `pure composers`.
- **New verdicts:**
  - any crossing as sung;
  - consecutive octaves inside a sung line;
  - an accompanying note on the wrong chord, or off its chord's pitches;
  - chord-book page mismatch;
  - a turnover inside a guest's span;
  - an unclosed guest;
  - the pure-composer check.
- **Copies:**
  - `/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r2m2/_harness.m2.js`;
  - the scratch A/B tools in the same `r2m2/` folder: `stats2.js`, `probe/`
    (the M1 engine announcing its pinned voicings), `nohold/` (the no-hold
    mutant), and `sweep/`;
  - Chrome drivers in `/tmp/claude-501/m2/`.

## How to hear or see it

- **Serve the worktree:**
  `php -S 127.0.0.1:8111 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r2-engine`.
- **`?seed=4242` or `?seed=77`, any hymn.** The choir's inner voices now move
  under the tune, never over it. Listen for the alto no longer poking above the
  melody on a low note. About one chord in seven seats its lower voices a
  little lower or inverts to get there.
- **Any hymn with the organ under the singing.** Its swell now enters on the
  chord the congregation is singing at that moment, instead of the last chord
  of the couplet ahead. The harmonium's warm inner voices and the strings do
  the same.
- **The fuging tune's convergence (`?seed=9`, the hymn, around x 0.6–0.8).**
  The organ now moves IV→I with the choir's amen instead of holding I under
  the IV.
- **`?seed=5` with the Ives switch on.** The old tune comes in the prelude at
  0:14, and the hymn board reads 𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤.
- **The steeples** now ring their full minute, and the prelude or postlude
  waits for the last bell to be struck *(Round 2: and now for it to ring out)*. `?seed=113`, with the Ives switch armed *before*
  PLAY: the steeples come in the postlude at 9:06, and the meeting's end
  waits about 30 s for them. (`node _harness.js 1500 113 ives` prints the
  spans.)

## Requests to the integrator

1. **SCORE §5 and §6: adopt the chord book and the new fields.**
   - kolob-score.js holds `chordBook()`. The composer's `Line.chords` should be
     written into it, so the accompaniment reads the Score (PLAN §2.5).
   - The harmony row carries `at, chord, by, page, n, voicing, freqs, pinned,
     seat`, and a cadence row carries `kind, by, at`.
   - `onNote` extras: `part` (S/A/T/B, pedal, root/fifth/octave, doubling) and
     `chord` (the book's id).
   - The typed guest events are `guest-start {guest, section, until, logged}` and
     `guest-end`. Note the added `until`.
   - The layer `oldtune` exists.
2. **SCORE §1: the composers are pure** (KOLOB.Harmony and KOLOB.Melody take a
   moment and the dice); `S.Harmony` is the chord desk. Please write the moment's
   fields and the book's accessors into SCORE (the text is in
   kolob-meeting.js, THE CHORISTER'S BOOK).
3. **SCORE §3, the M1 critic's reading, now true in the code.** A reported
   note is the *written* note. How a player places it is sound-level:
   - the harmonium's loose alto entry is 0.2–0.6 s, and its release
     ×0.85–1.0;
   - the choir's stagger is 0.05–0.25 s.

   The harmonium's alto is now reported at the chord's written onset and length.
4. **The PJ2.Fx indirect clock read (the M1 critic).** `setRoomBalance` at a
   section's start begins its 15 s crossfade at the pump's `currentTime`, up to
   0.25 s early, or 1.6 s early in a hidden tab. It is sound-level, and the
   substrate is read-only. Please add it to the audit as an indirect,
   sound-level read.
5. **Stale pointers in files other crews are editing today:**
   - earth-tunes-lab.js:27 ("stays in kolob-audio.js" → kolob-guests.js);
   - instruments-lab.js:6, 40, 373, 388 (kolob-audio.js → kolob-core.js /
     kolob-voices-organ.js);
   - question-lab.js:10, 291;
   - voices-lab.js:9, 72;
   - kolob-voices-vocal.js:4 (→ kolob-voices-choir.js);
   - kolob-tunes.js:12.
6. **Merge recipe.**
   - Copy this worktree's `_harness.js` into kolob-2 and main.
   - Keep a durable copy in the main checkout's `local-dev/` (the M1 critic).
     The harness needs `_engine.php` and the new engine.
7. **The trombone guest (kolob-r2-trombones)** calls `Harmony.harmonize()` for
   its material. The return shape is unchanged (`[{chord: {voicing, freqs, …},
   dur}]`), but the call is now `KOLOB.Harmony.harmonize(line, moment, stream)`,
   with `moment.mode` / `F0` / `bright` / `section` / `chord`. Its comment that
   Harmony's "alto can stand above the melody" is no longer true.
8. **The rate slider** (M1 critic, info): retries cued on a layer's lane now
   stretch with that lane's rate. The page shows no rate sliders.

## Known issues and notes for the next milestones

- **For the HYMN crew or the owner's ear: the pinned soprano's octaves.**
  - The pin still brings each note into the soprano's compass by itself, as
    v0.32 did. So a tune that steps from mi to fa can be sung as a falling
    seventh: 7.5 % of neighbouring chords in a line leap a seventh or more (400
    seeds), almost all of them this fold.
  - I left it, because (a) asked for the lower voices re-seated, not the tune
    changed. Placing the line as a whole (one octave shift per line) is a small
    change in `harmonize` and would make the choir sing the clarinet's shape.
  - It needs the owner's ear first: it changes the tune the choir sings.
- **About 1.2 % of pinned bare-fifth chords take their third back** to avoid
  consecutive octaves, and about 4.6 % are inverted. Both are audible only as
  voicing.
- **The free voicings** (the organ's advance, the cadences) keep v0.32's
  candidate method. When every candidate is illegal it falls back to the
  default seat, which can move in consecutive octaves: 0–3 per 20-minute run
  (the harness shows them as "in a cadence", not as a failure). The HYMN
  crew's voice-leading engine replaces this.
- **The organ under the singing still holds its chord for 7–12 s** while the
  choir moves on. It now *enters* on the sung chord (the acceptance). Following
  the choir through its changes is a CAST/HYMN question.
- **The meetinghouse bell and the steeples still report freq 0** (inharmonic).
  Reporting their strike pitch would put ringed heads on the page, which the
  owner has not asked for.
- **The chord book keeps ten minutes** and the chord standing before them.

---

## Round 2 — the critic's findings, answered

*Same crew, same branch, on top of `ee88499`. The critic's eight findings,
in their order. Every one is fixed or disclosed; I disagree with none.*

### 1. The joint waits for the choir (major)

**The cause.** The choir writes its couplet up to half a minute ahead. When a
section's time ran out mid-couplet, three things sang over it:

- the joint's organ cadence (`runJoint`), written into the same book;
- the next section's organ advance;
- a couplet the choir *began* during the joint, sung into the next section.

The strings, the harmonium and the leans then read those chords under the
choir's. On the committed M2, over seeds 1001–1100 × 1200 s:

- 129 of 1 019 joints began under a sounding choir line;
- 42 couplets were begun during a joint;
- 164 sections were entered with the old section's choir still singing,
  17.9 s into the new one on average.

**The fix** (`kolob-meeting.js`, `kolob-voices-choir.js`, `kolob-guests.js`):

- **The chord desk keeps `sungUntil()`.** It is the end of the last chord the
  choir has written. `write(chord, t, by, dur)` now takes how long a sung chord
  lasts (`by` choir, fuging or assembly). `harmonize` passes each chord's own
  length, and the three amens pass theirs (×1.02, then the held last chord
  ×1.6 or ×1.7).
- **The joint waits for it.** It waits until the choir's written lines are
  sung, plus a breath of 1.0 s (`jointHeld()`). This is added to the guest
  hold.
- **No couplet begins under the joint.** `choirVerse` waits while the
  chorister's book says `jointing()` (a new accessor).
- **The fuging waits for a verse the choir is still singing** (`choirSinging()`
  in its trigger; its window x 0.6–0.8 is unchanged).
  - Why: once the joint was fixed, the new check found one more case (seed
    3007, Ives, 1500 s). The fuging's convergence amen was written between
    two lines of a couplet the choir had written ahead: two SATB chords at
    once, from the same four voices.
  - On M2, 64 of 157 fugings (per 100 runs) began while a verse was still
    being sung.
  - I tried letting the convergence alone wait instead. 31 of 148 amens then
    stood apart from their entries, by a median 10 s and up to 55 s. I chose
    the cleaner rule: the entries begin once the choir is free.
- **The cumulative assembly waits likewise** for a doxology line the choir is
  still singing. It used to begin under one in 5 of 10 assemblies (100 runs).
  The line holds the joint, so the payoff is never lost. The assembly checks
  before the joint does, in the same tick.
- **`Desk.reset()` also clears `sungUntil`.** It is called by a new meeting, a
  sunrise, and so PLAY after STOP. That STOP shuts the written-ahead lines
  outside. The harness's STOP→PLAY run and `transport` both pass.

**Result.** 154 runs:

- 54 standard runs:
  - 1847/5/9/77/4242/12 and 2001–2030 × 1200 s;
  - 3001–3012 Ives × 1500 s;
  - 3/12/1847/5/21/113 with Ives, raspberry and cumulative × 1500 s.
- 100 statistics runs: 1001–1100 × 1200 s.

What they show:

- **Every accompanying note begun under a sounding choir chord names that
  chord.**
  - 15 994 of 15 994 notes: organ 9 930, strings 4 158, harmonium 1 460,
    clarinet lean 290, tines 156.
  - The critic's `sung.js` and `sung2.js` agree: 0 mismatches.
- **0 of 1 569 joints began under the choir.** 0 couplets were begun in a
  joint, and 0 sections were entered with the old choir still singing
  (`overrun.js`).
- **Seed 9, the critic's worked example.**
  - The choir's vi at 325.46 s is now sung to its end (333.1 s).
  - The joint's IV comes at 334.90 s, not 325.90.
  - The doxology line the choir began inside the joint at 858 s is no longer
    begun.

**What it costs: the hymns run longer.** In v0.32 those couplets were sung
anyway, over the joint's amen and into the next section. Now the section
waits for them (owner: "if the section needs to be a bit longer, that's
okay").

How far past its plan a section runs before its joint (100 runs, M2 → now):

| section | median | p90 | longest | mean actual length |
|---|---|---|---|---|
| hymn | 8.4 → 14.1 s | 12.2 → 36.3 s | 14.5 → 77.9 s | 156.7 → 167.2 s |
| doxology | 8.7 → 9.5 s | 12.4 → 31.0 s | 16.6 → 42.5 s | 95.0 → 101.6 s |
| every other section | unchanged | | | |

- The longest case is seed 1083: a slow 87.87 couplet of 80 s, begun 11 s
  before the hymn's planned end.
- Meetings per 1200 s: 1.97 → 1.94.

**An option for the owner's ear, not shipped.** One more condition would stop
the choir beginning a *new* couplet in the hymn's last tenth
(`S.localArc() > 0.9` beside `jointing()` in `choirVerse`).

- Measured over the same 100 seeds: hymn p90 25.6 s, longest 47 s.
- The choir sings 3.8 % fewer notes.

I left it out. It takes singing away, and the ruling allows the length.

### 2. The harness check that can see (b) (major)

`_harness.js` has four new parts:

- **THE SUNG CHORD** (after the critic's `sung.js`, the same rule). Every
  accompanying note that names a chord and begins inside a chord-bearing
  choir note's `[start, start + dur)` must name the chord of the latest-begun
  such note. The accompaniment is organ, harmonium, strings, the clarinet's
  and the tines' leans, and the bagpipe. Choir notes are cut at a STOP (the
  stopped meeting's lines are shut outside).
  - It also fails any joint whose first chord begins under the choir.
  - The old check still runs, renamed `chord timeline (the book)`. It proves
    the notes agree with the book, which is all it ever proved.
- **Guest spans must cover their sound.** For each `guest-start`, the notes
  its own cue told must end by `until`.
- **`joints held past the plan`** is a tally: how many sections waited, the
  median and the longest.

**The checks have teeth.** Run on the committed M2 (`ee88499`, via
`KOLOB_BASE`):

- Seed 9 gives "176 of 222 … 3 joints begun under the choir's singing": FAIL,
  and the same count as `sung.js`.
- Over seeds 1001–1100 the new checks fail all 100 runs:
  - the sung chord in 92 (1 804 notes);
  - joints under the choir in 93;
  - guest spans in 53.
- The critic's i3001 is reproduced exactly: steeples 16.1–81.1 s, sounding to
  87.0 s. So is i3006: assembly 612.5–630.9 s, to 633.0 s.

**The handoff's claim is corrected in place** (under b, and in "How I verified
it"). It was "4 356 of 4 356 … matched the sung chord". It now says what was
measured: the chord standing in the book.

### 3. The page prints more than v0.32 did (minor, disclosed; a ruling is requested)

Reporting every sounded note changes what the engraving shows. `kolob-viz.js`
prints every note on its melodic layers (choir, clarinet, bells, harmonium,
strings, bagpipe), and I may not touch its drawing. What the owner will now
see:

- **A strings pad prints two or three stacked breves** (root, fifth, octave)
  where v0.32 printed one. The root often sits on ledger lines under the
  treble. The critic's screenshot, seed 5 at ~55 s:
  `/private/tmp/claude-501/kolob-r2-engine-critic/ui-seed5.png`.
- **The harmonium prints a T+A dyad** for its held inner voices, and every
  note of its shadow and answer lines. v0.32 printed one long head.
- **The fuging's and the assembly's amens print as choir chords**, every voice.
- **New in this round: the doxology amen's held last chord prints at its sung
  length** (×1.6). It was told as long as the first chord. A reported note is
  the written note.

**Request (to the integrator, or the engraving crew).** Please get the
owner's ruling.

- If he wants the old look, the notes already carry `part`. The viz can skip
  strings `fifth`/`octave`, harmonium `A` (keeping `T`) and `doubling`, and
  keep the choir amens.
- That is a drawing change, and not mine to make.

### 4. The steeples' last bell rang into the joint (minor, fixed)

- `steeplesAnswer` returns the span to the end of the **ring**. That is the
  last strike plus `BELL_RING_S` (7 s, the same length each home strike is
  told as ringing). Before, it ended at the last strike.
- The prelude or postlude now waits for the bell to ring out.
- 0 spans shorter than their sound in the 54 standard runs (critic's 12-run
  Ives set included).

### 5. The bands' and the assembly's spans were short (minor, fixed)

- **The bands** return `soundEnd − tc`. That is the later of the fade's end
  and the last told note, counted from the cue (they step off 0.4 s after it).
- **The assembly** returns the later of its held amen (cadence + 2.7 chord
  lengths) and the strings under it, counted from the cue.
  - Its `claimAir` is unchanged, so the air the other voices wait on is as
    before.
  - Only the hold and the typed span grow: about 2 s for the assembly, and
    0.4–0.6 s for the bands.
- The harness checks every span against its sound (item 2): 0 short, in all
  154 runs.

### 6. The shelved pure fifths (info, noted in the code)

A comment now stands at each place, for whoever unshelves them:

- the bagpipe's `rootF * 1.5` (kolob-voices-bagpipe.js:141);
- the Question's second rank, `n.f * 1.5` (kolob-guests.js:167).

Each names the strings' `pureFifth` guard as the remedy, and says the harness
will list the notes as off the tuning. Neither sounds while shelved.

### 7. Two exceptions, now stated (info)

- **"Held to the hymnal's spacing" has an exception**, now written into the
  claim.
  - After this round: 30 of 15 413 pinned chords (0.19 %) have S–A wider than
    an octave, all at seat ≥ 2, where spacing is only a cost. 2 have A–T
    wider.
  - 0 cross.
- **The free voicings' parallel octaves inside cadence pairs** (the
  `defaultVoicing` fallback) stay as disclosed under "Known issues". They are
  the HYMN crew's.

### 8. Polish

- **`Desk.reset()` takes no time,** and is now documented and called so.
- **For SCORE §1 (request to the integrator):** Melody's `Motif` is callable
  as `(moment, stream)` and reads nothing of the house. It is still a
  stateful singleton, though: theme, lineage and ledger. `Motif.newMeeting`
  resets the meeting's shared material, so a composer that calls it resets
  the house's too. Please write that beside the moment's fields.

### Round 2's statistics (committed M2 → now, seeds 1001–1100 × 1200 s)

| metric | M2 | now | shift | why |
|---|---|---|---|---|
| section overrun past plan, mean | 8.56 s | 11.82 s | +38 % | the choir holds the joint (item 1) |
| overrun > 12 s, per run | 0.77 | 2.21 | ×2.9 | the same |
| sections entered · joints/min | 11.14 · 0.509 | 10.93 · 0.499 | −1.9 % · −2.2 % | the hymns are longer |
| fuging entries, per run | 1.57 | 1.37 | −12.7 % | a fuging no longer begins under a verse; 64 of 157 did |
| choir notes/min · onsets/min | 16.54 · 6.59 | 15.69 · 6.19 | −5.2 % · −6.0 % | no couplet begun in a joint (0.42/run did); fewer fugings |
| verse lines/min | 0.567 | 0.542 | −4.5 % | the couplets not begun in a joint |
| plagal cadences/min | 0.472 | 0.448 | −5.2 % | fewer fuging and doxology amens, fewer joints per minute |
| harmony voicings/min | 7.09 | 6.80 | −4.1 % | fewer choir chords |
| stillnesses, per run | 2.24 | 2.11 | −5.8 % (z −0.8) | chance; the conductor's dice fall on other ticks |
| guests fired · drawn | 0.83 · 1.05 | 0.82 · 1.03 | ≈ | — |
| every other layer's notes/min, the silence share, the planned section lengths | | | within ±4.5 % | — |

- **Against M1** (a20d993, the same seeds):
  - choir notes −2.1 %;
  - fuging entries −12.7 %;
  - plagal cadences −5.1 %;
  - overrun past plan +41 %;
  - the silence share −3.5 %.

  The rest is as in the M2 table above (the reporting of every note).
- **It is still Kolob:** the same Sundays, the same guests, the same cadence
  mix (plagal ≈ 82 %), the same air. The hymns breathe out their last line
  before the organ closes them.

### Round 2's verification

- **Harness.** The 54 standard runs and the 100 statistics runs all PASS.
  - Soprano ≤ alto: 0 of 15 413 pinned chords.
  - Pitch adherence: 100 %.
- **REPRO PASS:** `1500 1847 ives razz cumulative`, `1200 77`, `1500 9 ives`,
  `1500 21 ives`, `1200 4242`. **`transport` PASS:** 1847 and 77.
- **Muted headless Chrome** (port 9421, `--mute-audio`, the worktree on :8111):
  - **The three-tab REPRO driver, seed 1847, 120 s.**
    - Tab B (all 18 stops auditioned, a layer muted, volumes moved) equals
      tab A.
    - Tab C (paused 10 s at 40 s; the audio clock stood still and nothing
      sounded) equals A.
    - Tab A equals the harness line for line (87 lines).
    - Every console is clean.
  - **index.php, seed 5, Ives on.** The board read 𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤 and, in Latin,
    "an old tune". The minutes carry the old-tune row, nothing names "two
    bands", and the console is clean.
  - **The labs** (room, tune, bagpipe, question, voices, instruments,
    earth-tunes) load with clean consoles.
  - **Seed 9 to 340 s, past the critic's example.** The tab equals the
    harness line for line (367 lines). Its third joint comes after the
    choir's vi has been sung out (5:34.6 from the downbeat). The console is
    clean.
- **Scratch tools** are in `/private/tmp/claude-501/r2m2b/`:
  - `batch.sh`, `sbatch.sh`, `stats2.js`, `holds.js`, `worst.js`,
    `overlap.js`, `fugdelay.js`, `satb.js`, `overrun.js`;
  - `cr/` (Chrome drivers);
  - `gate/` and `fugB/` (the two experiments above);
  - `_harness.r2.js` (this harness).

### Round 2's harness changes (untracked; the integrator copies it)

- **New printed lines:**
  - `the sung chord` (with `joints begun under the choir`);
  - `joints held past the plan`;
  - `spans shorter than their sound`, on the guests line.
- **Renamed:** `chord timeline (the book)`.
- **New verdicts:**
  - an accompanying note naming a chord the choir is not singing;
  - a joint begun under the choir;
  - a guest span shorter than its sound.
- **Copies:** `/private/tmp/claude-501/r2m2b/_harness.r2.js`, and
  `…/scratchpad/r2m2/_harness.r2.js`.

### How to hear it (Round 2)

- **`?seed=9`, the first hymn, near 5:25.** The choir sings its line out on
  vi. A breath, then the organ's IV–I and the next hymn. Before, the organ's
  IV came in at 5:26 under the choir's vi.
- **Any hymn's end.** The last couplet is finished before the joint. A hymn
  may run up to a minute past its plan when a slow couplet begins near the
  end.
- **`?seed=113`, with the Ives switch armed before PLAY.**
  - The steeples come in the postlude at 9:46.
  - The meeting's end waits about 36 s, until the last bell has rung out.
  - The next meeting begins at 11:12.
