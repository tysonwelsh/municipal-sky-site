# Handoff: the drone as a waveform on the staff

*For a new Claude instance, 2026-09-29. Written by the session coordinating the Kolob 2 build.
Read all of this before touching anything.*

## 1. What this app is

**Kolob** (`art/kolob/` in the Municipal Sky site, live at https://municipalsky.com/art/kolob/)
is a browser generative-music piece: an endless, aleatoric **hymn meeting** of a far-future colony
of Latter-day Saints at "the rim of Kolob's light".
- **Sound:** all Web Audio, all synthesized. Hopeful and in clear light; American hymnody (Sacred
  Harp, the LDS Tabernacle style, gospel, Shaker songs, lined-out Old Way); Charles Ives.
- **Shape:** one meeting (≈15 min) is one playthrough, and every visit draws a different Sunday.
  - The meeting runs prelude → invocation → hymns → testimony → sacrament → doxology →
    postlude.
  - A 32-voice congregation sings newly composed hymns, with an organist on a pipe organ.
  - **A drone sounds under everything,** start to finish.
- **The page** has two plates:
  - above, a wheel (the order of service) with an organ-pipe spectrum inside it; **leave it
    alone**;
  - below, a **scrolling grand staff** that engraves the music as it sounds. **That staff is
    where your work goes.**

The owner is the site's author. They are hands-on, listen to everything, and judge by ear and
eye.

## 2. Where the code is, and where you work

*(Rewritten 2026-10-01: the worktrees, ports and branch names this section once listed belonged
to the build's crews and are gone.)* The app is `art/kolob/` on the branch you are given;
`README.md` there is the map, `SCORE.md` the contract, `STAFF.md` the rules of the staff this
brief changes. Serve the site with `php -S 127.0.0.1:<port>` from the repo root and open
`/art/kolob/index.php?seed=17`; seeds are reproducible. Never edit `art/prosperos-jukebox-v2/*`.
Run the checks `README.md` names before pushing (lint, loadcheck, lends, the harness, and
`tools/tally.js --a git:main --b worktree` to prove the music did not move — this brief must not
move it). A visible change bumps `art/kolob/VERSION` in the same commit.

## 3. House rules (the owner's standing rulings)

The rulings are collected in `OWNER-RULINGS.md`; the ones this task meets most are: **silent
testing** (every browser muted — `tools/lib/chrome.js` and `tools/screens.js` do this for you;
headless rAF runs at about one frame a second, so judge animation by polling on the clock);
**checks, not batteries** (`node art/kolob/_harness.js 300 7` should end `VERDICT: PASS ✓`);
**plain language** to the owner; **design approval first** — show a mockup or screenshots and get
a yes before building the final version.

## 4. The staff: what it is now, and its binding rules

The staff is `art/kolob/kolob-viz.js` and its five pieces (`_viz.php`; THE SIX FILES in `kolob-viz.js`), which draw a scrolling grand staff on a canvas. The owner
chose the look ("Direction A, the Colony Tunebook") and then simplified it. These rules are
binding (see the top of `art/kolob/archive/plans/PLAN-ENGRAVING.md`):

- **Speed:** the page scrolls right to left at **60 px/s**. Notes are engraved at a point near the
  right edge when they sound, then travel left, "dry" (fade) and dissolve before the clefs.
- **Green ink only** (hymnbook green on cream paper): no gold, no red, no glow.
- **No text on the staff:** no captions, no 8va/15ma signs, no words, no running head, no
  time-signature figures for guests.
- **No pulse or ring animations.** "Nothing moves but the scroll and the drying."
- **The telegraph** is Morse holes punched straight into the paper along the middle line
  between the staves. It has no container and no decoded word.
- **The fuller look:** every sounded note prints.
- **The hymnal page (round 3b):**
  - **Hymns:** barlines, double and final bars, fermatas, rests, beams, slurs and accidentals.
  - **Closed-score SATB:** soprano and alto on the treble, tenor and bass on the bass, with
    stems by part. The tune gets a slightly heavier head.
  - **Shapes:** shape-note heads by solmization.
  - **Other voices:** the old tune in faint round notes, the dawn trombones as a chorale (the far
    choir pale), handbells as ringed heads, the organ when it plays alone.
  - **Measured guarantees:** 0 barlines touching ink and 0 head overlaps (except one dense 6/8
    gospel case), no note moving after it is printed, and 60 fps at 390 px under 4× CPU
    throttling.
- **The drone is not drawn today.** An earlier version drew it as a grey bar in the lowest bass
  space, and the owner removed it: "what's the deal with the greyish bar that occupies the bottom
  row of the staff? I don't care for it." **Your task is a new, owner-requested way to show the
  drone.** It replaces that old rule for this one feature. Because it's a moving waveform, it is
  also an owner-sanctioned exception to "nothing moves but the scroll". Keep everything else:
  green ink only, and no text.

Pitch-to-staff mapping lives in `kolob-viz-intake.js` (`degOf`, `noteQ`) and `kolob-viz.js`
(`pageGeom`'s `yT`/`yB`): the grand-staff lattice where middle C (the keynote, `F0·4`) sits at q=10. Read the existing code before adding
anything, and match its literary comment voice.

## 5. The drone, technically

- **Synthesis:** `kolob-voices-ground.js`, `droneCycle(t)` (≈ line 123).
  - Each cycle lasts 60–90 s, with a 20 s crossfade overlap between cycles.
  - Each cycle is sine partials on **harmonics 1–4 of the drone's fundamental**, plus sometimes
    a fifth an octave up.
  - The gains come from `roleGain(...)`, and the level follows the "presence" parameter and the
    section (softer in the sacrament).
- **Pitch:** the fundamental is `S.F0` (52–78 Hz, drawn per Sunday), two octaves under the
  keynote. It's very low, below the bass staff.
- **The Kolob reckoning (new in round 3b):** on about two Sundays in three the drone **moves**.
  - At each section joint it glides over 4–6 s to a new note (`droneTurn`, ≈ line 183). The notes
    spell the opening of the doxology's tune: the keynote, mi, sol, fa and so on, relative to the
    day's keynote.
  - `&exp=-reckoning` in the URL turns it off, for comparison.
- **What the page receives:** the drone reports itself through the engine's note events:
  - `emitNote("drone", S.F0 * mul, startTime, duration, tag)` at each cycle and each turn;
  - a turn carries `{ glide, from }` in its tag.
  - the page currently ignores the `"drone"` layer (it isn't in `MELODIC`, `kolob-viz-intake.js`).
- **Real signal data:** `kolob-viz-wheel.js` already builds an `AnalyserNode` on the master for the
  organ-pipe spectrum (`ensureAnalyser`, via `KolobAudio.attachAnalyser()`). To show the drone's
  actual waveform, you'll want its **own** signal, not the whole mix:
  - **Tap the drone.** Tap the drone layer's bus (see `kolob-core.js`: layer gain nodes and
    `panAt("drone", …)`) with a dedicated `AnalyserNode` and read `getFloatTimeDomainData`.
    Expose it through a small `KolobAudio` method, since `kolob-core.js`/`kolob-voices-ground.js`
    changes are allowed for this.
  - **Or compute it.** Draw the waveform from the known partials and gains at the current time.
    That's deterministic and cheap, but it's a model, not measured data. **The owner said
    "actually visualizing the data of the drone"**, so prefer a real tap.

## 6. The task (the owner's words, lightly edited)

> Add a new visualization to the staff that depicts the drone … depicted as a wavelength or a
> line, the way some audio is sometimes visualized, but actually visualizing the data of the
> drone … a wavelength line that drifts across the bottom of the staff. But it shouldn't just be
> arbitrarily at the bottom somewhere: it should be positioned where the drone should be, given
> the note that it's playing … instead of being just a note drifting across, it's a wave
> depicting the sound wave of the drone.

**Design questions to settle with the owner, with a mockup or screenshots, before finishing:**
1. **Register.** The drone's fundamental sits below the bass staff (F0 ≈ 52–78 Hz). Options:
   - draw it at its true pitch on ledger space below the bass staff (clip to the plate);
   - fold it up an octave or two onto the bass staff at its pitch class, as the page folds other
     out-of-range notes silently;
   - centre the wave on the pitch's line or space, whatever octave.
2. **What the wave shows.**
   - A true oscilloscope trace (the real time-domain shape: harmonics 1–4 beating slowly).
     Its amplitude would follow the drone's level: softer in the sacrament, swelling at each
     cycle's crossfade.
   - Or a scrolling ribbon history of the wave laid on the page, drifting left at 60 px/s with
     the ink.
   - Either way, the vertical centre follows the drone's current note. During a reckoning glide
     the line should slide smoothly from one staff position to the next over the 4–6 s.
3. **Look.** Green ink only, no text. Probably a fine line, perhaps drying like the ink.
   Performance must stay at 60 fps at 390 px under 4× throttling.

**Verify** (silently):
- muted headless screenshots at 860 and 390 px, including during a reckoning glide (seed 17: the
  drone turns at 1:16, 2:40, 5:28, 8:12, 10:43 and goes home at 15:22);
- zero console errors, frame cost within budget, and the harness passing;
- none of the owner's staff rules broken.

**When done:**
- Write `art/kolob/handoff/drone-wave-1.md`: what shipped, how to see it (URLs, seeds and times),
  measurements, and screenshot paths. Commit it on `kolob-drone`.
- Tell the owner. The coordinating session will merge it into `kolob-2` for v0.36.

## 7. Background reading (optional, but it will help)

- `art/kolob/archive/plans/PLAN-ENGRAVING.md`: the top section holds the owner's decisions.
- `art/kolob/archive/plans/PLAN-COMPOSITION.md`: the whole plan. §15 has the latest owner rulings.
- `art/kolob/SCORE.md`: the contract between the engine and the page, including the typed events.
- `art/kolob/archive/handoff/r3b-engrave-1.md`: the latest staff work, with its replay-lab tools for
  testing the page without the audio engine.
- `art/kolob/archive/handoff/r3b-form-1.md`: the Kolob reckoning (the moving drone).
- `art/kolob/handoff/listen-r3b.md`: what the current build sounds like, with seeds and times.
