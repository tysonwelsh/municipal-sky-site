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
    A to T.
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
- **Result:** every accompanying note took the chord standing at its onset, and
  sounds that chord's pitches:
  - 6 seeds, 1200 s: 4 356 of 4 356 notes (organ, harmonium, strings, choir,
    clarinet, tines);
  - 406 seeds: all pass.

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
  - Chord timeline: 4 356/4 356.
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
  waits for the last bell. `?seed=113`, with the Ives switch armed *before*
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
