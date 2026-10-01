> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# voices-1 — the vocal voices (sound lab)

*Crew S (voices), branch `kolob-voices`, 2026-09-26. Lab and dev work only:
no VERSION bump, nothing in the app changed.*

## What shipped

- **`art/kolob/kolob-voices-vocal.js`** — `KOLOB.VoicesVocal`, synthesis only (SCORE §1).
  - `singer(spec)` → `.sing(ctx, dest, t, notes, gain)` and `.hum(…)`: one person.
    - spec: `{ part: S|A|T|B|child, age: young|mid|old, vibrato: {rate, depth, onsetDelay}, breath, brightness, pitchHabitCents, timingHabitMs, confidence, pan, seed | rand }`.
    - The vibrato blooms late, and only in notes long enough to hold it.
    - Breath: aspiration in the tone, an inhale before each line and at each rest.
    - Scoops from below on the oscillator; confidence sets their depth and the timing slop.
    - Old voices get a slow, wide wobble, a drift walk and a sag on long notes.
  - `desk(spec)`: 2–4 people sharing one throat (breath, tilt, vowel banks).
    - Each person has their own glottal wave (harmonic phases), a detune slot (±8–14 cents, spread and shuffled), a drift walk, a vibrato rate and depth, and an onset lag.
  - `congregation({desks, voicesPerDesk, parts?, width, seed})`.
    - `.sing(ctx, dest, t, {S,A,T,B}, gain)` and `.hum(…)`.
    - `.lined(ctx, dest, t, melody, gain, {tonicHz, scale, amount, spread, menOctave})`: the Old Way reply. Every desk sings the tune, men an octave down. Each desk ornaments it differently (new ornaments every line, a fixed appetite for ornament per desk) and arrives in its own time.
    - **`desks` is the quality knob.**
  - `precentor(spec)` → `.line(ctx, dest, t, notes, gain, {tonicHz, scale})`: the plain line, ornamented with slides into leaps, turns and upper-neighbour sighs on long notes, passing tones through thirds, and graces.
  - `ornament(notes, rand, opts)`: pure, draws every die unconditionally.
  - `budget`: a ledger of node lifetimes, with `.report(from, to)` giving `{perSecond, peak, mean, byKind}`, `.aliveAt(t)` and `.reset()`. Also `estimateNodes(people, vowels)`.
  - **Vowels:** `ah oh oo ee eh`, the shape syllables `fa sol la mi` (consonants f/s as noise, m/l as their own fixed mouths, and the coda l of *sol*), and `hum`/`mm`.
  - **No biquad automation.** A vowel change is a 30–90 ms gain crossfade between banks of **fixed** cascade formants, all fed by the same source.
    - A bank is born with its frequencies and dies with them.
    - High notes get their own bank with F1 tuned above f0 (the soprano's jaw drop), fixed at birth.
  - **Source:** a per-person PeriodicWave, about 8 dB per octave, with the fundamental held down to the octave's level. It is not a sawtooth.
- **`art/kolob/voices-lab.php` + `voices-lab.js`**: the lab, with the Kolob paper look, a seed, a desks knob (2–8), people per desk (2–4), beat, room amount, a level-match checkbox and stop.
  - **Demos:**
    1. Today's quartet (v0.30's `choirVoiceLine`, copied).
    2. The congregation.
    3. People come forward: the harmony alto; then the old bass and the child on the tune an octave up, who hums through the words she has lost and finds them again.
    4. The precentor lines out and the ward replies slowly.
    5. On the notes (each part sings its own four-shape syllables), then on *ah*, then on *oo*.
    6. A descant.
    - Extra: the ward hums.
  - **One person at a time:** the alto, the old bass, the child, the soloist, the precentor, one desk, one desk on the notes, one desk humming.
  - **The bench:**
    - An offline render of any demo through the same master chain, reporting peak, clipping, level, clicks, band energy, nodes, render speed and a spectrogram.
    - A flanger test.
    - A node-budget table.
    - `window.VoicesLab` exposes `measure`, `flangeTest`, `budgetTable` and `selfTest` for headless runs.
  - **Master:** a copy of kolob-audio.js's chain (glue, master 0.6, tanh, compressor), followed by a brick-wall limiter. The choir layer gain is 0.88, and the room is St Margaret's (the app's tabernacle IR), with a poured fallback.

## How to hear it

`php -S 127.0.0.1:8104 -t <worktree>` → **http://127.0.0.1:8104/art/kolob/voices-lab.php**

- **Seed** 3107 (the default). Also tried with 42, 8 desks × 2.
- **A/B:** play 1 and then 2 with "level-match the quartet" on. Alone, the old quartet sits about 16 dB below the app's hymn level, so unmatched it would lose on volume.
- **Individuals:** play the "one person at a time" row. The old bass (flat, late, wobbling) and the child (small, breathy, high) are the clearest.

## Verification (headless Chrome over CDP, offline renders; short checks)

**Level.** The app itself was measured by tapping its final compressor during a hymn (seed 3107): about −18 dBFS RMS, with peaks up to −5.5.

| demo (seed 3107, 6×3) | loud-half dBFS | peak dBFS | clipped | clicks | <250 Hz % | 2–5 kHz % | peak nodes |
|---|---|---|---|---|---|---|---|
| 1 quartet (matched) | −19.3 | −6.5 | 0 | 6* | 4.5 | 0.3 | 47 |
| 2 congregation | −18.0 | −5.3 | 0 | 0 | 13.6 | 2.0 | 272 |
| 3 forward | −18.2 | −4.9 | 0 | 0 | 14.2 | 2.7 | 404 |
| 4 lined | −21.4 | −7.3 | 0 | 0 | 11.7 | 2.8 | 272 |
| 5 notes / ah / oo | −18.2 | −4.8 | 0 | 0 | 12.4 | 1.9 | 240 |
| 6 descant | −18.6 | −5.8 | 0 | 0 | 11.5 | 3.7 | 320 |
| hum | −17.5 | −4.5 | 0 | 0 | 29 | 0 | 168 |

- **Level:** every demo sits at the app's loudness, and the limiter is never reached.
- **Seed 42, 8 desks × 2 people:** all demos, 0 clicks, 0 clipping.
- **\*Quartet clicks:** the detector flags 5–6 events in the **v0.30 quartet copy** (around 1.5, 3.6 and 5.3 s). I did not investigate them. They may be real clicks in today's choir, and are worth a look by the CAST crew.
- **The click detector checks itself.** `selfTest()`: a sine with a single step reads as 1 click, the clean sine as 0.
- **No biquad automation** (a Node mock that records every AudioParam call): across 361 biquads from every entry point (congregation, hum, lined, old singer, precentor, child), each frequency, Q and gain param gets one `setValueAtTime` at most and no ramps. No non-finite values.
- **Not a flanger** (a held G3 on *ah*, dry, per-harmonic envelope autocorrelation for harmonics 1–10; 1.0 means the beating repeats like a sweeping comb):

  | what | median periodicity | AM depth |
  |---|---|---|
  | one desk | 0.30 | 8.6 dB |
  | a naive pair (fixed 3-cent detune, no drift or vibrato) | 1.00 | 16.8 dB |

- **Individuals** differ clearly on the bench:

  | person | 2–5 kHz % | below 250 Hz % | node count |
  |---|---|---|---|
  | child | 12.5 | — | 60 |
  | soloist | 12.5 | — | 48 |
  | old bass | 0.4 | 50 | 32 |
  | alto | 4 | — | 40 |
  | precentor | 2.2 | 17 | 36 |

- **Budget** (the descant scene on the notes, which opens the most mouths: congregation + 2 soloists, 3 people a desk; render speed is offline on a desktop Mac):

  | desks | 2 | 3 | 4 | 6 | 8 |
  |---|---|---|---|---|---|
  | peak nodes | 148 | 192 | 236 | **312** | 400 |
  | render speed | 18× | 17× | 13× | **11×** | 9.4× |

  - One desk costs about 44 nodes: 12 shared, 4 per person, 4 per vowel bank. A soloist costs about 36.
  - **Suggested:** 6 desks × 3 on desktop, 4 × 2 on phones.
- **Zero console errors:** every demo and person button was clicked live in headless Chrome.
- **Layout:** no horizontal scroll at 1000 or 390 px.

## Requests to the integrator

1. **Ownership and wiring.**
   - PLAN-EXECUTION gives CAST `kolob-voices-choir.js`. This module is `kolob-voices-vocal.js`, so either rename it at merge or list it under CAST.
   - It loads in SCORE §1 step 4. Add it to `$kolob_assets` in `index.php` when the app uses it.
2. **SCORE addendum** (voices signature). Synthesis objects are built from a spec, and each call takes `(ctx, dest, t, notes, gain)`.
   - Notes are `{f, dur, vowel, stress?, slur?, rest?, slide?}`.
   - `t` is the **vowel onset** of the first note. Consonants anticipate by up to 0.12 s and the inhale by 0.42 s, so callers need that much lead.
   - Please record this in SCORE §1 or a §9.
3. **Streams.** The module forks `synth:vocal` → `singer:<name>` / `desk:<name>` / `congregation` from `spec.seed`, or takes `spec.rand`. The CAST crew should pass `cast:<n>` → `member:<id>` forks as `rand`.

## Known issues / not done

- **Tuned by measurement, not by ear** (I cannot hear). The owner's A/B of demos 1 and 2 is the real test. The knobs most likely to need an ear:
  - the fricative level (`peak` in the fricative block);
  - the breath levels (`aspLvl`, and `inhale`'s 0.10);
  - the cascade gains in `bankSpec` (F1 +16, F2 +12, F3 +7…13 dB);
  - `tilt` in `personDefaults`.
- **The hum is bass-heavy** (29 % of its energy below 250 Hz), which is its nature. It may want less level under speech.
- **Consonants are limited to f, s, l and m.** Deseret phoneme singing (§6.5) needs the rest; the bank mechanism already covers it.
- **Ornaments assume a 7-note JI scale** passed as `{tonicHz, scale}`. Callers in other modes must pass their own collection.
- **The mobile CPU figure is an estimate** from desktop offline render speed; the 4× throttle test was not run.
