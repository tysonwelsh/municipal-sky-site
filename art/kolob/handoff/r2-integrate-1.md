# r2-integrate-1: round 2, integrated

*Integrator, round 2. Branch `kolob-r2-engine`. 2026-09-27.*

Round 2's three branches are now one build: the engine's three milestones,
the trombone choir at dawn, and the measurement tools. The trombone choir is
wired into the engine.

- VERSION is not bumped. The integrator-of-record assigns v0.34 at publish;
  a suggested line is under Requests.
- Nothing was pushed or published.
- Every check was silent: the Node harness, and muted headless Chrome.

**The owner's listening packet is [`listen-r2.md`](listen-r2.md).**

---

## What was merged

| step | commit | what came in | conflicts |
|---|---|---|---|
| 1 | `bb2ccec` | `kolob-r2-trombones` (`774cdf9`, `55349f1`): `kolob-voices-band.js` (three trombones, a distance stage, the town's air), `kolob-guest-trombones.js`, `trombone-lab.*`, its handoff | none (the engine branch never touched `kolob-voices-band.js`) |
| 2 | `c4cde0b` | `kolob-r2-tools` (`7ee5158`, `dd108ba`): `tools/` (distinctness, repetition, tally, screens, capture, render, selftest), its handoff | none |
| 3 | — | `kolob-2` | already merged: its head `c720645` (the `lds` field, the five Psalmody tunes, KINGSFOLD's Amen) came in at `269461f` in milestone 3; `git merge kolob-2` reports it up to date, and the old tune sings all 21 tunes (the `oldtunes` battery below) |

`index.php` and the module list needed no merge: since milestone 1 the list
lives only in `_engine.php`.

## What was wired: the trombone choir at dawn

All of it is as `r2-trombones-1.md`'s integration notes describe, on the
round-2 clock and streams, with the critic's advice taken.

- **The plan** (`kolob-meeting.js`, `planMeeting`):
  - The stream is `guest:trombones:<n>`, `S.stream("guest:trombones")`.
  - `KOLOB.GuestTrombones.plan()` is asked after the bands, the steeples
    and the old tune are seated, and is told who sits where. It refuses:
    - any meeting the bands cross;
    - a prelude another guest holds.

    It seats in the prelude at 4–14 s.
  - Its dice (the odds, the moment, the exchanges) are its own. So **a
    meeting without the trombones is byte-for-byte the meeting it was**
    (see "Identity").
- **The material** (`dawnChorale`, lent as `KOLOB.Meeting.dawnChorale`).
  It is Harmony's harmonization of the day's theme in the day's mode:
  - the theme is poured into the first hymn's meter;
  - each line is set by the pure `KOLOB.Harmony.harmonize(line, moment, R)`,
    voiced on from the line before;
  - it is handed over **with the tune**, so the soprano keeps its octaves;
  - on a withheld (cumulative) Sunday a working motif stands in for the
    theme, the visiting band's precedent;
  - its dice are a fork of the guest's own stream (`material`). Nothing is
    written into the chord book and nothing is announced;
  - it is built **only when the choir is seated** (the critic's order).
    `plan()` runs first without it, then again with the prepared chorale for
    the exact length. `chorale()` is paid at plan time, never in a clock
    callback.
- **One musical choice of mine: the dawn closes on the tonic.** Harmony
  sets each note from its grammar, so a line ends where it falls. Over 199
  seated meetings, the hymn's last chord was I only 87 times, and otherwise
  IV 37, vi 40, iii 19 and V 16. The handoff's "the near choir brings the
  hymn home" wants I, and the tune's last note is always a rest tone (do,
  mi or sol). So the last chord is re-voiced by Harmony as I from the chord
  before it. It is now 199 of 199, and the harness holds it. A minor
  Sunday may still turn it major (the tierce de Picardie, the module's
  own). Undo it if the owner prefers the open endings.
- **The prelude yields.** It lasts at least `at + dur + 4 s`.
- **The cue.** A guest that keeps its own time (`CUED = {trombones}`) is
  cued on the `guests` lane when its section begins, at `sectionStart + at`.
  The conductor's poll, which waits out a section's first fifth, never
  fires it.
  - The cue checks: its own meeting, the prelude still standing (a dev jump
    may leave it), no joint, no other guest.
  - The time is the cue's scheduled `t`. The critic's "t in the past" case
    cannot happen.
- **One arrival path.** The poll and the cue both call `arrive(V, t)`. It
  sets `fired`, `logged`, `visitType`, `visitUntil` and the typed span, as
  the poll's inline code did before, unchanged for the other guests. The
  joint waits for the span.
- **The performance** (`trombonesAtDawn`, `kolob-guests.js`):
  - `perform(S.ctx, wideSend(), t, material, stream)`, so it goes through
    the meeting's guest door, which STOP closes.
  - Every note is reported on the layer `trombones`, named as the guest's,
    with `part`, `choir` and `loud`.
  - The rows are `guest` events with the stages `far`, `answer` and
    `together`. The first is told at `t`; the others are cued at their own
    phrase's start.
  - The span covers the last chord plus 2 s of the town's air. The guest
    claims the air for its length.
- **The house listens.** `S.hallListens()`: while the trombones sound, the
  organ, harmonium, strings and clarinet defer their turns, as they do for
  the shelved Question. The fixed waits draw no dice. The tines and the
  choir find the air taken. The drone and the field stay. The handoff asked
  for this ("the prelude's melodic and harmonic layers should give way").
- **The Ives switch.**
  - `setForceVisitation("trombones")` names it, and `true` draws it with
    weight 1 beside bands 2, steeples 1 and old tune 1.
  - Forced trombones keep the prelude: no band that meeting, and the steeples
    and the old tune take their other seats.
  - *The pool changed, so the pill now forces a different guest than before
    on some seeds.* Only switch-on runs move.
- **Start-up.** `KOLOB.VoicesBand.warm(ctx)` runs in `init()`, so the town's
  2.6 s tail is poured at the button press.
- **The page** (`kolob-ui.js`):
  - minute rows ♪ TROMBONES AT DAWN (𐐓𐐡𐐉𐐣𐐒𐐄𐐤𐐞 𐐈𐐓 𐐔𐐃𐐤), ♪ THE NEAR CHOIR
    ANSWERS (𐐜 𐐤𐐀𐐡 𐐗𐐎𐐌𐐊𐐡 𐐈𐐤𐐝𐐊𐐡𐐞) and ♪ THE TWO CHOIRS TOGETHER
    (𐐜 𐐓𐐅 𐐗𐐎𐐌𐐊𐐡𐐞 𐐓𐐊𐐘𐐇𐐜𐐊𐐡), in the visitation class like the other guests;
  - the direction line reads TROMBONES AT DAWN while they play;
  - `PHRASE_SKIP` includes the layer;
  - the staff does not engrave the trombones, like the old tune. The owner
    is asked.
- **The module list** (`_engine.php`): `kolob-voices-band.js` (voices) and
  `kolob-guest-trombones.js` (performers, before `kolob-guests.js`). Both now
  answer the load guard's roll call.

## Also fixed at the integration

- **The tools read the typed engine** (`tools/lib/dump.js`). Since milestone
  3 every event carries a type, and the normalizer read every typed event by
  type. So `joint`, `guest` (the stages), `chord`, `field` and
  `hymns-of-the-day` all fell to "other":
  - no joints were read, so no meeting was complete;
  - the day's material was missing from distinctness.

  Now an event is read by type where the file knows the type, and by its
  words otherwise. Its `cat` keeps the log's word, so an A/B against a
  log-only build counts the same categories. The trombones' words were
  added. `selftest.js` passes, including "every section closes on one joint
  (seed 3): 8/8".
- **The trombone crew's critic items:**
  - **Lab width:** `.ktl` now has `width: 100%`. The dawn card's check at
    390 px (the critic's 461 px table) now scrolls inside its card:
    scrollWidth 390 of 390.
  - **The "together" row:** the join's `t0` is its first chord's entry, not
    the fade.
  - **`harmonize()`:** it accepts `[deg, beats]` rows (the SAMPLES' own
    shape), which had been read as degree 0. The harness now proves it.
  - **The far choir's darkness:** the header's "12 dB poorer above 1 kHz" is
    corrected to what was measured, 3–9 dB over seeds 1–12, with a note on
    the near-end draws.
  - **The material's order and dice:** see "The material" above.
  - Not taken: the comma on re-struck notes, and four exchanges being rare.
    Both are listed under Known issues.
- **`earth-tunes-lab.js`:** a stale pointer ("the engine's table stays in
  kolob-audio.js").
- **SCORE.md §9:** the round's requests, adopted. That covers:
  - the `_engine.php` load order and roll call;
  - the pure composers and the moment;
  - the stream labels as implemented, and the musical/sound-level rule;
  - `cueAt`/`cueIn` and not `lane.in()`;
  - the chord book and the new Line, Note and Performance fields;
  - one event carrying both vocabularies, `KOLOB.Score.EVENTS` as the words,
    and the nulls;
  - `guest-start.until` and `verse-line "lined"`;
  - the note extras (`guest` and `logged` among them);
  - the `oldtune` and `trombones` layers, the trombones' stages, and
    `setForceVisitation(name)`.

## How it was checked

### The harness (`_harness.js`, untracked; see "Harness changes")

**32 of 32 pass** on the final code:

| set | runs |
|---|---|
| six seeds × 1200 s | 1847, 5, 9, 77, 4242, 12 |
| guests forced, 1500 s, ives razz cumulative | 3, 12, 1847, 21 |
| the Ives switch alone, 1500 s | 113 |
| long, 2700 s | 1847; 5 ives razz cumulative |
| unlogged | 9 oldtune unlogged=oldtune (1200 s); 5 ives unlogged=steeples (1500 s) |
| **trombones forced**, 900 s | seeds 1, 2, 3, 4, 5, 6, 10, 16 |
| **trombones unlogged** | 7 (900 s) |
| **trombones + withheld tune** | 8 cumulative; 9 cumulative razz (1500 s) |
| REPRO (twice, jittered, re-salted) | 1500 1847 ives razz cumulative; 1200 5; **900 3 force=trombones** |
| TRANSPORT | 1847, 77 |
| OLDTUNES | 20 forced old tunes over six modes, then every admitted tune × mode × lines straight through the guest: 116 rememberings, 1,777 notes, every note the book's |

- **Every trombone performance** (26 of them, in 18 of the runs above) seated
  4–14 s into the prelude, never with the bands. Its notes were all in the
  day's lattice and in their trombone's compass, and named as the guest's.
  Its far call and near answer were told. **No organ, harmonium, strings,
  clarinet or tine turn began while it played** (0 in every run).
- **Unlogged** (`unlogged=trombones`): 4 events and 128 notes said
  `logged: false`, none leaked, and the conductor's poll never named it (27
  polls while it sounded).
- **STOP in the middle of the trombones** (seed 1847, stop at 30 s, play
  after 0.3 s or 8 s): 0 of 37 and 0 of 13 written-ahead sources still reach
  the hall, and 0 of 3 of the stopped meeting's reverbs.
- **Out of the meeting** (the trombone crew's section, ported):
  - purity, with `Math.random`, `Date.now` and `performance.now` trapped;
  - **the engine's own planner** over 1,000 meetings:
    - seated 199 (19.9 %): conference 34 %, jubilee 26 %, ordinary 20 %,
      fast 7 %;
    - 0 with the bands (the bands were in 35 % of meetings);
    - 0 sharing the prelude; every seat 4–14 s;
    - the prelude yielded every time;
    - the last chord I in 199 of 199;
  - perform in six modes on the pure Harmony: nothing before `t`, no clock
    read, every pitch in the lattice, every note in its compass,
    deterministic;
  - the dawn's chorale in four modes: the tune read, phrases ≤ 24 s, the
    whole ≤ 100 s, 0 crossings, 0 parallels in 96 chord changes.

### Identity: what the integration changed, and nothing else

`tools/tally.js --a <pre-integration engine> --b worktree`, seeds 1–60 ×
1200 s:

- **36 of 60 seeds are byte-identical.** The 24 that differ are exactly the
  seeds where the trombones seat, in meeting 1 or 2.
- **The only flagged shifts are the trombones' own** (new). Guests per
  meeting went 0.69 → 0.85 and meetings with a guest 48 % → 63 %, both
  within noise. The trombones take a free prelude, so they add to the
  guests and move none.
- The pre-integration engine is `e6f3c54` (git archive, in
  `/private/tmp/claude-501/kolob-r2-integrate/pre/`).

`ab.sh` compared dumps per seed at 1200 s. Seeds 9, 77, 12, 21 and 101 are
identical. On seeds 5, 3 and 4242 the dump is identical up to the first
line that names the trombones.

### A/B against the published sound (`tools/tally.js --a git:kolob-engrave --b worktree`)

**The baseline** is `kolob-engrave` at `ed72c1c`, the **v0.33** engine:
v0.32 (live) with the Question retired, the fairest baseline because this
build shelves the Question too. It is a single-file `kolob-audio.js`, run
under `KOLOB_LEGACY`. Seeds 1–60 × 1200 s, 59 complete meetings a side.

**No seed plays identically,** as expected: milestone 1 re-based every seed.
The 21 flagged shifts are all accounted for:

| shift | A (v0.33) → B (now) | why |
|---|---|---|
| meetings with the trombones | 0 → 16.9 % | new |
| notes/min: organ ×4.8, harmonium ×4.4, strings ×2.2; harmonium note length −82 % | 2.57 → 12.3; 0.96 → 4.23; 1.95 → 4.38 | milestone 2 reports every sounded note: the organ's five voices, the harmonium's lines and inner pair, the strings' root, fifth and octave |
| old tune notes (new) | — | milestone 2 gave the old tune its own layer |
| typed events: `guest-start/-end`, `hymn-announced`, `verse-start`, `verse-line` (new) | — | milestones 2–3 (typed-only events) |
| meetings with: steeples 0 → 10.2 %; with "assembly" (new) | — | A drew no steeples in its 59 meetings (the odds are 7.5 %). "assembly" is the typed span of the withheld tune, the same meetings as "cumulative" (8.5 % both) |
| guests per meeting 0.51 → 0.85; visitation rows +47 %, guests drawn +52 % | — | the trombones (+0.17), the steeples' sampling, and "assembly" counted beside "cumulative" |
| testimony per meeting 0.66 → 0.85 | — | the plan cuts testimony one Sunday in four (0.75). Both sides are sampling it |
| stillness rows per meeting 1.56 → 2.05 (the unbidden ones 24 → 42) | — | the engine crew's 400-seed comparisons found stillnesses −7 % (v0.32 → M1) and flat since (2.33 → 2.32). This 60-seed read is sampling of the new dice |

Meeting length is 14.4 → 15.1 min. The plan's checks, A and B:
- plagal share 85.2 % and 82.3 %, both ✗ against 30–55 %, which waits for
  the dialects;
- meetings with a guest 44 % and 63 %, both ✓ against ≈ 55 %;
- the Question never seats ✓ on both sides.

### Distinctness and repetition (20 seeds)

- **Distinctness** (`tools/distinctness.js`, the first 180 s of seeds
  1–20, 190 pairs):
  - **no near-twins**;
  - median pair distance 0.585 (p10 0.476, p90 0.671); the closest pair is
    seeds 8 and 12, at 0.357;
  - the median pair is 5.5× as far apart as the planted twin (collapse
    would be 3× or less);
  - seeds 7 and 13 open with the trombones.
- **Repetition** (`tools/repetition.js`, 20 complete meetings):
  - 3.2 % of phrases repeat a shape their own voice sang earlier in the
    meeting, and 5.3 % any voice's;
  - 96 % of the 1,480 shapes belong to one meeting only;
  - the band's march loop is the rut (47 % heard before), as in round 1;
  - the trombone soprano is 25 %: the chorale's lines 1 and 3 are one
    poured theme.

### The browser (muted headless Chrome, port 9424)

- **`index.php?seed=1847`**, in Latin, in Deseret, and at 390 px:
  - trombone notes: 116 (68 far, 48 near), the first 6.20 s after the
    downbeat;
  - rows at 6.2, 14.1 and 33.4 s, which is the harness to the tenth (6.3,
    14.2 and 33.5 with the 0.1 s downbeat);
  - the direction line read "trombones at dawn" / 𐐓𐐡𐐉𐐣𐐒𐐄𐐤𐐞 𐐈𐐓 𐐔𐐃𐐤
    at every poll while they played (8–36 s; they end at 38.7 s), and
    nothing at 41 s;
  - the master's RMS 0.03–0.08 throughout;
  - clean console; no sideways scroll.
- **Forced** (`seed=9`, `setForceVisitation("trombones")`): 120 notes from
  11.89 s, and rows at 11.9 and 27.8 s, as in the harness.
- **The packet's seeds:**
  - seed 48: the trombones at 8.1 s and the answer at 27.4 s;
  - seed 16: the old tune at 17.9 s;
  - seed 27: the old tune at 14.3 s.

  Each matches its harness dump.
- **All eight labs** at 860 and 390 px (trombone, earth-tunes, instruments,
  room, tune, voices, question, bagpipe): clean consoles, scrollWidth equal
  to clientWidth. The trombone lab was also checked after its dawn check,
  through the page's own button.
- **`tools/screens.js`** (seed 1847, 20/60/120 s, 860 and 390 px):
  - frame time at 4× CPU throttle: p50 0.5/0.2 ms, p99 1.3/0.9 ms, max 2.7
    ms, 0 long tasks;
  - clean consoles.

  At 20 s the staff is empty: the trombones are playing and are not
  engraved. See the requests.

## Harness changes (`art/kolob/_harness.js`, untracked; the next integrator copies it)

- **The mock:** oscillators take `setPeriodicWave`, and the context makes
  constant sources (the trombones use both).
- **The module list:** `kolob-voices-band.js` and `kolob-guest-trombones.js`
  are engine modules now, no longer `LAB_ONLY`.
- **The guest-note watch** covers `trombonesAtDawn`.
- **LISTEN:** the trombone crew's gate, ported. The sweep after the run
  never reaches the counts or the dump.
- **`trombones at dawn:`**, a new line and verdict: every performance in the
  run, judged as described above (the seat, the bands, the lattice, the
  compass, the rows, the house listening).
- **`trombones, out of the meeting:`**, four lines. It is the crew's section
  on the new engine. It sweeps `planMeeting()` itself and reads
  `S.Meeting.guests()`, tests `KOLOB.Meeting.dawnChorale`, and adds the
  final-chord verdict. Flags: `notb` skips it; `tbn=<N>` sets the sweep
  (default 1000, about 1.4 s).
- **Spans end at a STOP.** A `stopat=` run's new meeting is no guest's. A
  span is read to the first STOP after it began, but a span shorter than its
  guest's own sound is still judged on its own `until`.
- A copy is at
  `/private/tmp/claude-501/kolob-r2-integrate/_harness.integrate.js`. The
  drivers and scripts are in the same folder: `std.sh`, `final.sh`, `ab.sh`,
  `detail.js` and `smoke.js`.

## Requests

1. **To the owner** (in the packet): whether the trombones should be
   engraved; the far choir's distance, the level, the pace and the odds;
   the tonic close.
2. **To the integrator-of-record, at publish:**
   - VERSION **v0.34**. Suggested line: `v0.34 — the trombone choir at dawn
     (some Sundays a far choir plays the first hymn's first line in the
     prelude and a near one answers); the old tune sings real Earth hymn
     tunes; the organ follows the choir; the alto stays under the tune; the
     joints wait for the singing and for the guests; STOP then PLAY starts
     clean; a seed is the same meeting every time`.
   - Copy `_harness.js` into `kolob-2` and into the main checkout's
     `local-dev/`, where the milestone-1 critic asked for a durable copy. I
     may not touch the main checkout.
3. **To the ENGRAVE crew:** trombone notes carry `choir` and `loud`, and
   the band layer already inks by nearness. Drawing them is one decision
   away.
4. **Carried from the crews** (not taken this round; each is in its crew's
   handoff):
   - **tune-lab.js:** it still restates v0.30's mode rule and seven names
     (engine-m3 request 3).
   - **engine-m2 critic:**
     - the strings' fifth over an inverted chord;
     - `open` chords that sing their third;
     - the clarinet's grace note is unreported;
     - the old meeting's voices overlap the new one's first seconds at a
       meeting change, and an organ-cycle chord sounds over about half the
       joints' amens;
     - 12.5 % fewer fugings.
   - **engine-m3 critic:** the `lined` verse-line can name the wrong hymn;
     nothing prints it.
   - **Trombone critic:** comma jumps on re-struck inner notes, 0–4 per
     chorale.
   - **Tools critic:**
     - `ensureServer` reuses a server by comparing `kolob-core.js` alone;
     - a mixed-seeds tally A/B;
     - `capture.js` temp files;
     - the mute guard is a literal;
     - a README clause.

## Known issues

- **Nobody has listened to the trombones.** Timbre, distance and levels are
  measured only.
- **The staff is blank while the trombones play.** They are not engraved.
- **The trombone chorale's lines 1 and 3 are often the same tune.** It is
  the theme poured into the meter; repetition.js counts 25 % of the
  trombone soprano's phrases as heard before. The composed hymn replaces
  it.
- **The pill draws a different guest than before on some seeds,** because
  the pool gained the trombones. Only runs with the switch on move.
- **Plagal cadences are 82 % of all cadences** (plan 30–55 %), unchanged:
  it waits for the dialects.

## Footer

This build's footer on :8114 reads `v0.32 — a cleaner page … · e508d4 ·
2026-09-27 21:35 UTC`. The version text is v0.32's, because VERSION is not
bumped; `e508d4` is this build's fingerprint.
