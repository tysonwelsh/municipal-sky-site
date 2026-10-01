# r3-organist-1: the organist

*CAST crew (the organist), round 3. Branch `kolob-r3-organist`. 2026-09-28.*

**What is new to hear:** for the first time the organ is played by *someone*.
Each Sunday seats an organist of one of three kinds, and each plays the same
hymn differently: a chorale prelude on the day's first hymn, the tune given
out, the verses under the ward, fills between the lines (sparingly),
interludes between the verses, and a walk to the next hymn's key.

This milestone is a **lab** (`organist-lab.php`). The meeting does not seat
the organist yet; that is the integration's (requests below). Nothing was
pushed or published, and VERSION is not bumped.

**Also, for the owner's "breath, or brushing sound, in between the notes when
the hymns are being sung":** *(corrected in round 2 — see* **Round 2**, *"The
breath between the notes, again", at the end.)* In this lab and in hymn-lab
the larger breath at the joins is **the ward's own** — the singers' voices
(VoicesVocal), which the CAST crew has mended on `kolob-r3-cast` (af8e190c,
"the hiss between the notes is gone"); until that merges it is still heard
here. The organ's chiff was a smaller part of it, and is mended here. The
engine organ's chord-end click (R1) is real but faint, and is not the cause.

---

## How to hear it

Serve the worktree (`php -S 127.0.0.1:8134 -t <worktree>`) and open
`http://127.0.0.1:8134/art/kolob/organist-lab.php`. Choose a seed and an
organist (or let the Sunday draw one), then press **▶ The prelude** or
**▶ The hymn**. **▶ The engine's organ** plays the organ the meeting has
now, at the level it has now, for comparison.

| to hear | open | listen for |
|---|---|---|
| the Victorian | `?seed=1847&style=victorian` | prelude: the tune on the vox humana (it trembles) over flutes, a suspension at each line's close; hymn: the tune given out broadly, the swell breathing with each line |
| the plain organist, same hymn | `?seed=1847&style=plain` | the same hymn straight through on soft flutes; nothing between the lines; a single breath between verses |
| the improviser, same hymn | `?seed=1847&style=improviser` | prelude: flutes running, then the tune deep in the pedals in long notes; hymn: the interlude climbs the first line's opening over a held bass |
| the strange fill | `?seed=1849&style=improviser&verses=3&index=2` | ▶ The hymn, at about **1:54**: a chord and a quick figure in the wrong key (a half step up), then the ward comes in and the organ is back with them |
| a sung-alone dialect | `?seed=1847&dialect=sacredharp` | no organ at all: no giving out, no fills; the ward alone |

**Find a strange fill** (on the page) jumps to the next seed where the
improviser strays. **Compare** plays nothing: it renders all three organists
on the current hymn and sets their numbers side by side.

### What to listen for, in plain words

- **The plain organist** plays what is printed. The prelude is the hymn once
  through on soft flutes (a short hymn twice, the second time softer). In the
  hymn, the last line is given out on the flutes, then the four parts go
  under the ward exactly as written, every repeated note struck again.
  Nothing happens between the lines; between verses there is one breath.
- **The Victorian** decorates. In the prelude the tune sits on the vox humana
  (the trembling stop) over flutes, or on the trumpet, or the swell box opens
  and closes on the principal; at each line's close an inner voice hangs over
  the new chord and falls a step late (a *suspension*), and passing notes walk
  the tenor. In the hymn the swell breathes with each line, a middle verse is
  quiet (vox and flutes), and the last verse of three is on the full organ.
  About once a hymn, between two lines, the tenor walks into the next line,
  holds over into it, or the line's end echoes high on the echo flute.
  Between verses the close is played again, softly.
- **The improviser** wanders. The prelude runs flutes in steady notes and puts
  the hymn tune in the pedals, in long notes, under them (on about one Sunday
  in five of his, the flutes run in a different key the whole time: Ives's
  *Adeste Fideles*), and ends on an open chord with an added note. In the hymn
  the interludes take the first line's opening and climb it in steps over a
  held bass; between lines, now and then, a quick quote of the next line or a
  little turn; and once a meeting at most, a fill lands in a strange key
  until the ward's entry drags the organ back.

---

## What shipped

| file | what |
|---|---|
| `kolob-organist.js` (new) | `KOLOB.Organist`: pure planning (no audio, no clock, no `Math.random`; every die the caller's stream) and a small performer |
| `kolob-voices-pipeorgan.js` | the touch, the quieter legato chiff, the reed release, `dispose()`, stats kept as they go, the misspelt-stop warning, `play(…, {texture})`, the load-guard roll call |
| `organist-lab.php`, `organist-lab.js` (new) | the bench: compose, seat, play, Check, Compare, a meeting's worth |
| this note | |

### `KOLOB.Organist`

- `seat(stream, info)`: the Sunday's organist.
  - Style weights: plain 0.36, Victorian 0.38, improviser 0.26.
  - Tilts: conference and jubilee toward the Victorian, fast Sundays and the
    Sacred Harp or Old Way houses toward the plain organist, the Ives switch
    toward the improviser.
  - Habits: tempo, how much the swell moves, fill appetite, the key the
    improviser wanders to (a tritone, a major third either way, a minor
    third, a whole or a half step), the bitonal chance, prelude odds.
  - A Deseret name from a roster of six. The English is dev-only.
  - The meeting's **ledger** (hymns, fills, strange fills).
- `preludeDraw(organist, stream, info)`: the prelude is the organist's on
  36–54 % of Sundays by style (about 45 % overall; the brief asked for about
  40 %). It is refused when the trombones play the first hymn at dawn, when
  the tune is withheld for the doxology, or when the brush arbor seats no
  organ. Every die is thrown first.
- `prelude(organist, hymn, stream)`: **30–50 s** (120 preludes over 40 seeds:
  30.9–49.4 s).
  - The fit: the tune once; twice (plain); with an echo; or its head and
    home (four, three or two lines). The beat is solved for a drawn length,
    and it is never quicker than the ward sings the hymn.
  - The plain organist: four parts on flutes.
  - The Victorian: an optional intonation (the first chord, with the swell
    opening); vox solo, trumpet tune or swell voluntary; cadence suspensions;
    passing notes; a rit.
  - The improviser: the tune in augmentation in the pedals (bourdon 16′ plus
    a principal 8′ line, so it reads); running figures from the hymn's own
    chords at that beat, from a book of five cells; rarely bitonal; an open
    added-note close.
- `accompany(organist, hymn, stream, {verses, beatS, hymnIndex, next})`:
  - Giving out: the last line, the organ alone.
  - The verses: the Score's own S, A, T and B, the bass also in the pedal,
    in the style's touch and in registrations per verse.
  - Fills between the lines. The ward waits for the fill.
  - Interludes between verses.
  - The amen.
  - The modulation, when `next.keyMonzo` differs.
  - `plan.ward` says when the ward sings each line. **The ward must sing by
    it**, using `Organist.lineEvents`, the same clock the organ plays by.
    The lab does exactly that.
- `modulate(organist, from, to, stream)`: the pivot alone, for a joint.
  - From the organ's last chord: a chord of the new key sharing a common
    tone (held where it is exact; re-struck where it lies a comma off),
    then V7, then I.
  - The Victorian leans a 4–3 on the dominant. The improviser sometimes
    detours through a chromatic mediant.
- `measure(plan)`, `describe(plan)`: the counts a critic reads, and the plan
  in words.
- `perform(organ, plan, t0, {keynoteHz, onNote, onEvent})` → `{pump(now, ahead), until}`.
  - It lays phrases, swell moves and log lines about 3 s ahead. It reads no
    audio clock.
  - It reports every **written** note (SCORE §9.2) with `part`, `hymnId`,
    `line`, `beat`, `deg`, `monzo`, and `orn` for the ornaments.
  - It emits `cast` events (`memberId: "organist"`, `nameDs`, `action`:
    "pulls the vox humana, with the tremulant", "gives out the tune",
    "strays into a strange key (a half step up)" …).

### The pipe organ (`kolob-voices-pipeorgan.js`)

- **The touch: one pipe per key.** A note landing on a key already down (a
  unison between parts, a note written twice, a repeat not lifted) holds that
  key on. It never sounds a second pipe over the first, which used to cause a
  flutter and a second chiff at every such join. To strike again, lift first.
- **The chiff** is 5 dB quieter (level 0.55). A pipe that speaks legato keeps
  a fifth of it (−14 dB); only a chord out of real silence (more than 0.25 s)
  chiffs in full.
- **The reed release.** The anchor that snapped a blooming trumpet or vox
  down in one sample is gone (the wave-1 open issue). The release now starts
  from wherever the gain stands.
- `dispose(t)`: the tremulant's motor and the wind stop at t, and the case
  leaves the graph (wave-1 open issue).
- `stats()` is kept as it goes, so it no longer sorts an ever-growing
  history.
- A misspelt stop in an object warns once.
- `play(…, {texture})` fixes the level law for a call, so an inner voice
  moving alone is no louder than its chord.
- `create(…, {chiff, legatoChiff})` is for a lab's A/B.
- Its dice are thrown unconditionally, so renders with and without the chiff
  are sample-aligned.

---

## How it was checked (all silent: muted headless Chrome over CDP, and Node)

### Level against the engine's organ (organ layer 0.40), the loudest 3 s, LUFS

The engine's organ is `organChord`, copied line for line into the lab. It
plays at the gains the meeting uses in the prelude (gainMul 0.513) and under
the singing (0.41), into the same 0.40 layer and room. The organist's plays
at `ORGAN_GAIN` 1.15, with a per-registration balance (`REG_TRIM`, read from
`OrganistLab.registrations(true)`) and the prelude 1.3 dB forward.

The engine's organ measures −29.0 LUFS in the prelude and −30.3 LUFS under
the singing.

| organist | prelude, seed 1847 / 12 | against the engine | hymn, seed 1847 / 12 | against the engine |
|---|---|---|---|---|
| plain | −29.6 / −30.0 | −0.6 / −1.0 LU | −30.7 / −31.1 | −0.4 / −0.8 LU |
| Victorian | −28.0 / −28.9 | +1.0 / +0.1 LU | −29.4 / −30.9 | +0.9 / −0.6 LU |
| improviser | −30.1 / −29.5 | −1.1 / −0.5 LU | −29.8 / −30.0 | +0.5 / +0.3 LU |

- Seed 1847 had two verses; seed 12 three verses, the third hymn of the day.
- The Victorian and improviser rows were measured just before a final
  +0.5 dB on "flutes 8 & 4" (10–14 % of their hymn keys). Their hymns may
  read up to about +0.5 LU louder now, still inside the band.

**All within ±2 LU**, with no clicks in any organist render.

### Three styles, measured (Node, 60 seeds × 3 verses per style; lab Compare)

| | fills per join | fills per hymn | decoration per key (hymn) | per line | stops drawn most (hymn) |
|---|---|---|---|---|---|
| plain | 0 | 0 | 0 % | 0 | soft flutes 84 %, hymn principal 10 % |
| Victorian | 0.101 | 1.2 | 1.4 % | 0.44 | hymn principal 39 %, vox & flutes 24 %, full organ 23 % |
| improviser | 0.105 | 1.25 | 6.9 % | 2.2 | principal & 4 26 %, hymn principal 21 %, flutes 8 & 4 14 %, sixteen & four 13 % |

- **Preludes.** Decoration is 0 % of keys for the plain organist, about 8 %
  for the Victorian (suspensions, appoggiaturas, passing notes), and about
  87 % for the improviser (running figures).
- **Spectra.** The registration spectra differ, as the check tables above show:
  - plain: centroids 230–270 Hz (flutes: the darkest organ);
  - Victorian: 290–365 Hz (the vox, the trumpet, the principal and the full
    organ);
  - improviser: the hymns are the brightest, 335–400 Hz (the mixture, the
    4′ over a 16′ with nothing between);
  - the improviser's prelude puts about half its power under 120 Hz (the
    tune in the pedals), against about a quarter for the other two.

### Following the Score

- 180 hymns, 3 verses each: **83,005 written notes under the singing, and all
  83,005 are reported at the Score's own time and exact pitch** (0 wrong, 0
  missing; 13 lines deliberately left tacet by the improviser).
- Giving out comes first in 180 of 180. Between every pair of verses there
  is something (360 of 360): **240 played interludes** (the Victorian's and
  the improviser's) and **120 breaths** (the plain organist's one-beat lift,
  which is not an interlude; corrected in round 2).
- Modulations: 180 of 180, 179 through a common tone. The one exception, a
  semitone lift, goes straight to the new dominant.

### Fills capped; none unaccompanied

- **200 improviser meetings** of five hymns, two of them sung without the
  organ: at most **one** strange fill in any meeting. 162 of the 200 had one.
- The unaccompanied hymns: **0 organ keys, 0 fills.**

### The lab, at 860 and 390 px

- Zero console errors.
- No horizontal scroll at 390; the wide tables scroll inside their cards.
- A muted live play of a hymn with the ward: the organ gives out at about
  −32.5 dBFS RMS, and the ward and organ then sing at about −20 dBFS RMS
  (the ward was then set back a little: see *Known issues*).
- Check, Compare, a meeting's worth and Find a strange fill all run.

---

## The breath between the notes (the owner's report)

*Round 2 corrects this section: the ward's own breath is the larger sound at
the joins in the labs, and item 2 below overclaims. See* **Round 2**, *"The
breath between the notes, again".*

The owner: *"the breath sound, or the brushing sound that I described, it
happens in between notes when the hymns are being sung."* Two things make a
sound like that, and both were measured.

1. **The pipe organ's chiff: fixed here.**
   - What was wrong: every key of every chord coughed at full strength on
     every beat, and a note written twice spoke two pipes. That is the organ
     under the hymns in hymn-lab (the round-3 hymn checkpoint) and in this
     lab.
   - The measure: the hymn rendered dry three ways — as it plays now, with
     the chiff as round 2 spoke it, and with no chiff (sample-aligned). The
     chiff's energy against the tone:

   | the hymn, dry | chiff against tone, now | as round 2 spoke it | above 1.5 kHz, now | as round 2 |
   |---|---|---|---|---|
   | plain (seeds 1847 / 12) | −43.4 / −41.8 dB | −30.5 / −26.3 dB | −23.1 / −21.7 dB | −9.6 / −6.5 dB |
   | Victorian | −48.6 / −46.9 dB | −35.9 / −29.6 dB | −35.4 / −36.8 dB | −22.7 / −19.2 dB |
   | improviser | −49.6 / −48.6 dB | −36.4 / −31.9 dB | −40.5 / −39.7 dB | −26.6 / −24.0 dB |

   That is **13–17 dB less breath**. It is most in the high band, where a
   flute's tone is thin and the brushing was most exposed.

   - It is still there as the pipe's consonant at the first chord out of
     silence; it is gone as a brush between notes.
   - hymn-lab gets this too: it plays the same organ.
2. **The live engine's organ: the tremulant click, waiting on request R1.**
   *(Round 2: real, but faint — −81 and −93 dBFS, at chord ends in the
   prelude reference, none under the singing — and not a credible cause of
   a brushing between sung notes. The "tss … every 12–24 s under the hymns"
   below was not measured, and is withdrawn.)*
   - What is wrong: in `kolob-voices-organ.js`, `organChord`'s tremulant
     LFO is added straight to the chord's `master.gain`. When the envelope
     reaches zero, the chord keeps sounding at ±1.5 % for 0.3 s, then every
     oscillator stops dead.
   - Through the tabernacle's reverb, that step is a short "tss" at the end
     of every organ chord. Under the hymns that is every 12–24 s.
   - The measure: the lab's faithful copy clicks at exactly each chord's end
     + 0.3 s (12.92 s and 25.72 s in the prelude reference). With the
     one-line fix it has **0 clicks at the same loudness** (Check shows both).
3. **Not measured:** the live choir's scoop, a sawtooth gliding through
   narrow formant filters between notes. It could be heard as a swish. A
   real-time capture of seed 1847's first hymn was attempted twice and
   stalled in the muted headless browser under the machine's load (load
   average ~16), so there is no live spectrogram behind this note. If the
   brush remains after R1, the choir's glide is the next suspect.

---

## Requests (for the integrator)

- **R1 (the engine organ's faint chord-end click — round 2: NOT the owner's
  brushing sound, and now with the tremulant's depth kept).**
  `kolob-voices-organ.js`, `organChord`: put the tremulant on a gain of its
  own after the envelope, its depth scaled to the chord's level so the
  tremulant sounds as deep as it does now.

  ```js
  var peak = (gainMul || 1) * 0.7;                                    // moved up from below the tremulant
  var master = S.ctx.createGain(), tremG = S.ctx.createGain();
  tremG.gain.value = 1; master.connect(tremG); tremG.connect(dest);   // was: master.connect(dest)
  …
  var lg = S.ctx.createGain();
  lg.gain.setValueAtTime(Math.min(0.3, trem * 0.1 / (0.92 * peak)), t);   // was: trem * 0.1
  lfo.connect(lg); lg.connect(tremG.gain);                            // was: lg.connect(master.gain)
  …
  var atk = Math.min(2.2, dur * 0.3);                                 // (peak is already defined)
  ```

  Verified in organist-lab (Check): 0 clicks; the loudest 3 s unchanged
  (−29.0 LUFS); the tremulant ±0.39 dB (4.6 %) against ±0.38 dB (4.4 %) as
  it is. (Round 1's patch, without the scaling, left it at ±1.5 %: three
  times shallower, effectively gone — the critic caught it.) It is a small
  audible change at chord ends, so it takes a version line (for example
  `v0.3x — the organ's chords end cleanly`).
- **R2 (seating the organist in the meeting).**
  - `_engine.php`: load `kolob-voices-pipeorgan.js` with the voices, and
    `kolob-organist.js` after `kolob-composer.js` and before the performers.
    Both answer the roll call.
  - Seat once per meeting: `Organist.seat(cast:<n> stream, {kind,
    houseDialect, bright, ives})`.
  - In the prelude: `preludeDraw(…, {hymn: the day's first composed hymn,
    trombones, withheld: cumulative, organSits: seat.sits.organ})`. On yes,
    `perform(organ, prelude(…), t, …)` in place of the organ cycle's chords
    for about 30–50 s.
  - For each composed hymn with the organ: `accompany(…, {verses,
    hymnIndex, next})`. The singers take the line times from `plan.ward`.
  - At joints between hymns: `modulate(…)`.
  - Build one `VoicesOrgan` per meeting, into the organ layer, with
    `gain: Organist.ORGAN_GAIN`. `dispose()` it at the meeting's end.
- **R3 (SCORE).**
  - Adopt `cast` events from the organist: `memberId: "organist"`,
    `nameDs`, `action`, and optional `registration` or `manner`.
  - Adopt `orn` on organ notes: `susp`, `app`, `pass`, `link`, `echo`,
    `fig`, `seq`, `quote`, `arabesque`, `strange`, `intro`, `close`,
    `added`, `mod`, `pedalpoint`.
  - `Performance.organ` may carry the organist's plan.
  - `organ.registration` names may be the organist's (`Organist.REG`).
- **R4 (streams).** Below the caller's stream the organist forks:
  - `organist`: the seat;
  - `organist:prelude`: the draw;
  - `prelude:<style>`, with `line:<k>`, `echo` and `fig:<s>` below it;
  - `organist:<style>`, with `regs`, `giveout`, `join:<v>:<i>`,
    `interlude:<v>`, `amen` and `modulation` below it;
  - `organist:modulation`.

  Suggested roots: `cast:<n>` for the seat and the prelude, and
  `hymn:<n>:<i>` for a hymn.
- **R5 (hymn-lab, the HYMN crew's).** It already benefits: its organ is this
  one. It could hand its accompaniment to `Organist.accompany` for giving
  out, interludes and fills. ~~Its repeated notes now hold rather than
  re-speak, because of the touch.~~ *(Round 2: that was the bug the critic
  found — they are re-struck again now; see Round 2.)*
- **R6 (the balance, CAST).** At the engine's organ level, hymn-lab's ward
  (layer 0.88) sits about 12 dB over the organ. This lab sets the ward at
  0.5 so the organist is heard. The engine's balance between the 32-voice
  ward and the organ is still to be set by ear.

## Known issues, and what is not done

- **Not in the meeting yet** (R2). The live app's organ is still
  `organChord`.
- **The strange fill turns up in about four improviser meetings in five**
  that have three or more organ hymns. The cap (one) holds. If it should be
  rarer, lower the 0.55 in `accompany` (`strRoll`). *(Round 2: lowered to
  0.3, `STRANGE_ODDS`; see Round 2.)*
- **Fills run about 1.2 per hymn** for the Victorian and the improviser.
  That is sparing by the brief, but not yet ruled on by the owner's ear. The
  rates are `STYLES.*.fill.rate`.
- **The Victorian's suspensions sound over the ward** in the links and the
  amen: brief organ dissonances against the singers, by design (the
  Victorian habit). Under the verses the organ plays the Score exactly.
  *(Round 2: not in the amen any more — it was every amen; the links
  remain, about once a hymn.)*
- **The reed-release fix is by construction.** Neither the lab's click
  detector nor an 8 ms high-frequency jump measure resolved the old snap
  from the new release under the trumpet's own brightness (both read about
  7.7 dB). The automation step itself (about 11 % in one sample at 50 ms on
  the trumpet) is gone from the code.
- **The tremulant is the whole organ's.** A solo registration and its
  accompaniment are drawn with the same tremulant depth.
- **Deseret names** (six organists) are hand-transliterated. Worth a glance
  from whoever keeps the chart.
- **The live capture** of the choir's glide did not complete (see above).

---

## Round 2 — the critic's eleven

*CAST crew (the organist), round 2. Branch `kolob-r3-organist`, 2026-09-28.
All eleven fixed. On item 1 I took a different road from the one the critic
suggested; the reason is given there. Nothing pushed or published; VERSION
not bumped. All checks silent: muted headless Chrome over CDP (a port of my
own, 9464, because another crew's Chrome held 9454), and Node.*

### What you will hear differently, in plain words

- **The Victorian's hymn now has a shape.** With three verses, he begins a
  little held back on the principal. The middle verse is quieter, on the vox
  humana over the flutes (or the flutes alone). On seven Sundays in ten the
  last verse is on the full organ with the shutters open, and it is plainly
  louder than the first verse as well as brighter. Before, it was only
  brighter: 0.4 dB *quieter* than the first verse.
- **The amen is the ward's.** The Victorian no longer holds a clashing note
  over the singers' amen. Before, he did it in every amen.
- **The improviser's wrong-key fill is a surprise again.** It comes in about
  three of his longer meetings in five (it was four in five). In a late hymn
  it is now about one of his fills in four; before, it was nearly half.
- **Repeated notes are struck again** on this organ wherever a caller hands
  it notes end to end. That is hymn-lab's organ, the owner's checkpoint.
  About a tenth of the tune's notes, and more than a quarter of the alto's
  and tenor's, had quietly lost their re-attack in round 1.
- **The breath, or brushing, between the sung notes:** in the labs it is the
  **ward's own breath**, not the organ's (see below). Tick off *the ward's
  breath* in organist-lab and play the hymn again to hear it go.
- **Levels are even across Sundays.** 33 renders over 11 seeds and all three
  organists now sit within ±2 LU of the engine's organ. Round 1's balance
  let a few Sundays fall outside it (see *Levels*).

### How to hear it

Serve the worktree (`php -S 127.0.0.1:8134 -t <worktree>`), then open
`/art/kolob/organist-lab.php` with:

| to hear | open | listen for |
|---|---|---|
| the Victorian's arc | `?seed=1840&style=victorian&verses=3` | ▶ The hymn. Verse 2 (≈0:20) drops to the trembling vox. Verse 3 (≈0:37) opens on the full organ, louder and bright. **Check** prints "the verses", one level each. |
| the breath between the notes | `?seed=1847&style=plain` | ▶ The hymn with *the ward's breath* ticked, then again with it unticked. The brushing at the joins goes with the singers' breath. The organ is unchanged. |
| the amen | `?seed=1847&style=victorian&verses=2` | the amen at the end: the organ plays the chord the ward sings, with no note held against it |
| the strange fill | `?seed=1849&style=improviser&verses=3&index=2` | still at **1:54**; **Find a strange fill** finds more (1847, 1850 and 1851 have one) |
| repeated notes | `hymn-lab.php`, any seed | the alto and tenor re-strike their repeated notes under the ward |

### The breath between the notes, again (the owner's report, corrected)

The owner: *"the breath sound, or the brushing sound that I described, it
happens in between notes when the hymns are being sung."* Round 1 put it
down to the organ. **That was wrong about which sound is the larger.** This
is the critic's measure, rebuilt in the lab as `OrganistLab.joins()` and
reproduced here. It renders the first 26 s of the hymn (the giving out and
verse 1), with the organ dry at its layer's gain and the lab's 32-voice ward
at 0.5. Each part is rendered twice, so the breath is an exact difference.
The reading is the energy above 1.5 kHz in the 60 ms after each of the 27
onsets:

| seed 1847 | the ward's breath | the organ's chiff, now | its chiff before round 3 | the organ's own tone (HF) | the ward's voice (HF) |
|---|---|---|---|---|---|
| plain | **−58.8 dBFS** | −76.0 | −62.8 | −64.5 | −44.8 |
| Victorian | **−58.8 dBFS** | −84.2 | −70.4 | −58.8 | −44.8 |

- **The ward's breath is the larger sound, by far.** It is 17–25 dB over
  the organ's chiff now. It was 4–12 dB over the chiff even before round 3
  mended the chiff. It comes from VoicesVocal (`kolob-voices-vocal.js`):
  each singer's aspiration as a line ends, and an "h" puffed into the next
  line.
- **The fix is the CAST crew's, and it is done.** It is on `kolob-r3-cast`,
  commit `af8e190c`, "the hiss between the notes is gone": the breath rides
  each voice, with no exhale after a line and no "h" into the next.
  `r3-guests-1` traced it too. **Until that merges, the owner will still hear
  it in organist-lab and hymn-lab.** The *the ward's breath* box (and
  `?breath=0`) is a diagnostic. It sets every singer's breath to 0, which
  also takes the breathiness out of the tone.
- **The organ's part was real, and is mended.** Its chiff had stood 1.7 dB
  over the flutes' own treble at the joins. It is now 11.5 dB under it
  (plain). That fix stands, but it was never the main sound.
- **The live meeting** sings with a different choir
  (`kolob-voices-choir.js`, the formant choir, not VoicesVocal). I did not
  measure it. Round 1's third suspect, its scoops between pitches, is still
  unmeasured.
- **R1 (the engine organ's click) is not the cause.** The critic is right,
  and Check now says so: 2 faint clicks, at −81.4 and −92.9 dBFS, at chord
  ends in the prelude reference, and 0 under the singing. R1 is still worth
  doing (below), but the "tss … every 12–24 s under the hymns" in round 1 was
  never measured, and is withdrawn above.

### The eleven, one by one

1. **The Victorian's verse plan was flat.** *Fixed, by a different road.*
   - The critic's suggestion was to loosen `REG_TRIM` to close about 40 %.
     That would also have taken the plain organist's flutes 2–3 LU under
     the engine, and they have nothing louder to reach for.
   - So the balance stays where it was. It says only where each registration
     *sits*. The arc is the organist's own, on top of it: `VERSE_DYN` per
     style and registration.
     - The Victorian: vox & flutes −3.5 dB, flutes 8 & 4 −3, full organ +1.2.
     - The improviser: sixteen & four −2.5, flutes 8 & 4 −2, principal &
       mixture +0.8, full organ +1.2.
     - A first verse that will end full is held back 0.8 dB
       (`VERSE_RESERVE`).
   - The full organ's swell now stands at 0.64, open, not 0.56. On the full
     organ he leans on the swell half as much.
   - A fill plays as softly as its verse, never louder. The amen takes the
     last verse's dynamic.
   - Measured (Check, "the verses": organ alone, loudest 3 s of each verse):

   | | verse 1 | verse 2 | verse 3 | the arc |
   |---|---|---|---|---|
   | seed 1840, Victorian — round 1 (critic) | −31.4 principal | −31.6 vox & flutes | −31.8 full organ | flat; the full organ 0.4 dB *quieter* |
   | seed 1840, Victorian — now | −32.7 principal, held back | −35.5 vox & flutes | −31.0 full organ | −2.8 LU, then +1.7 LU, and brighter (the critic read the full organ's centroid at 467 Hz against the principal's 334; its shutters are wider open now) |
   | seed 104 (third hymn), Victorian — now | −32.3 | −34.2 flutes 8 & 4 | −28.8 full organ | −1.9, then +3.5 LU |

   - The loudest verse is held within +2 LU of the engine's organ under the
     singing: +1.5 LU at most over the 11 seeds (seed 104).
   - The listening note (`LISTEN.victorian`) now says what is measured.
2. **The breath — honesty.** *Fixed.* The note is corrected in place (the
   top of this file, *The breath between the notes*, R1). The lab's header,
   its Check paragraph and its listening note now name the ward's breath as
   the larger sound and cross-reference `af8e190c`. The measure is a lab
   handle (`OrganistLab.joins()`), and a box lets you hear the difference.
3. **R1 overclaimed.** *Fixed.* R1 is renamed as the engine organ's faint
   chord-end click, "NOT the owner's brushing sound". Round 1's unmeasured
   "tss" is withdrawn.
4. **R1's side effect on the tremulant.** *Fixed, in the request and in the
   lab's copy.*
   - `lg = min(0.3, trem·0.1 / (0.92·peak))`, with `peak` computed first.
   - Check measures the tremulant's depth in the first chord's sustain (the
     envelope at 5.5 Hz): **±0.38 dB (4.4 %) as it is, ±0.39 dB (4.6 %)
     with R1**. Round 1's patch would have given ±1.5 %. Still 0 clicks.
   - The corrected patch is in R1 above.
5. **The touch tied repeated notes in hymn-lab.** *Fixed in
   `kolob-voices-pipeorgan.js`.*
   - A key counts as held only if it stays down more than 20 ms past the new
     note (`OVERLAP_S`), or was struck at the same instant (a unison).
   - A repeat that merely abuts is **lifted 50 ms early** (`AUTO_LIFT`, never
     more than a third of the note) and struck again. Its release quickens
     (τ 18 ms), so the new pipe speaks into near-silence, not over its own
     tail.
   - Measured on the page, 12 composed Tabernacle hymns handed over the way
     hymn-lab does it (onset to onset):
     - **re-struck: S 55/55, A 174/175, T 152/152, B 87/87 repeats**;
     - held: 16 true unisons (one pipe per key, as before), plus the one A
       repeat, whose key another part was still truly holding.
   - Unit cases: abutting 2 keys; overlapping 1; unison 1; lifted 2.
   - The organist's own planner (which ties by style in `handsOn`) loses
     nothing.
6. **Suspensions over the ward's amen.** *Fixed.* No cadence suspension in
   the amen. The Victorian keeps them for the organ alone: the prelude, the
   giving out, the interlude, and the modulation's 4–3.
   - 180 amens (60 seeds × 3 styles): 0 ornaments.
   - The Victorian's decoration under the hymn went from 1.4 % of keys
     (0.44 a line) to 1.2 % (0.37 a line).
   - The link fill's held note over the next line's first chord remains,
     about once a hymn at most. That is a habit, not every time.
7. **The strange fill was near-certain.** *Fixed, owner's call.*
   - `STRANGE_ODDS` is 0.3, as the critic suggested. It was 0.55.
   - Round 1's own sweep (200 improviser meetings of five hymns, two
     unaccompanied, three verses each, the same seeds): **123 of 200 now
     have one, against 162 before**. My second sweep, on other seeds: 112 of
     200.
   - In a third hymn of three verses, **59 of 240** of the improviser's fills
     are strange (25 %), against 45 %.
   - The cap holds (at most 1 a meeting). The unaccompanied hymns have 0
     keys and 0 fills.
   - Rarer still would be a smaller `STRANGE_ODDS`.
8. **"360 of 360 interludes".** *Corrected in place.* There are 240 played
   interludes and 120 breaths (the plain organist's one-beat lift),
   re-counted in the same sweep.
9. **The improviser's prelude listed out of order.** *Fixed.* `finish()`
   sorts the sections by time (a stable sort). 0 out of order over 360
   plans. At 390 px, seed 1850 now reads 0:00 running figures … 0:36 the
   coda.
10. **The V7-pivot wording.** *Fixed.*
    - The words now follow the chords as they sound, each named once, in
      order. For example: "the new key's V7, as the pivot, its common tone
      held in the soprano, then I". With the improviser's detour: "the pivot
      ii …, then a chromatic mediant (♮III), then V7, then I".
    - Found on the way, and fixed: "its common tone held" sometimes named a
      tone two *later* chords shared. It also sometimes named a tone the
      organ in fact re-struck, because `layChords` held keys per part and a
      pivot often hands its common tone to another voice.
      - Now a key stays down while its pitch goes on in any voice, as a
        finger would. A bass that takes one over gets its pedal note beside
        it, and the bass's own key is never handed up.
      - The pivot's voicing prizes the held tone.
      - Over 540 modulations (3 styles × 30 hymns × 6 key changes), 537
        hold their common tone. The 3 that do not are the improviser's
        semitone lift through V7.
11. **One pump laid a whole phrase.** *Fixed.*
    - `perform()` now lays each phrase in pieces: only the keys that speak
      before the horizon, on each pump. A phrase's first piece draws its
      stops and tremulant, at its own time. `play(…, {trem: false})` keeps
      the later pieces off the tremulant.
    - The improviser's prelude, pumped as the lab does (every 120 ms, 3 s
      ahead): **19 keys in the first pump and at most 4 in any later one**,
      against 359 keys (well over a thousand nodes) in round 1's first pump.
    - Checked against laying whole, on a mock organ, over 72 plans (3
      styles × 12 seeds, prelude and hymn): identical keys, gains, reports,
      tremulant calls and swell moves.
    - The offline renders (`pump(0, 1e9)`) lay exactly as before.

### Levels, re-measured (and one thing round 1 did not catch)

Measuring the arc across more Sundays showed the round-1 balance to be less
even than its two seeds suggested:

- the Victorian's swell-voluntary prelude reached **+2.2 LU**;
- the improviser's preludes (running flutes over a pedal tune) sat about
  1.3 LU under the engine, down to **−2.6**;
- the Victorian's and the improviser's giving out, at swell 0.82, was often
  the loudest moment of a hymn.

Each is now centred:

- `PRELUDE_LIFT` by style: plain 1.3, Victorian 0.5, improviser 2.4 dB;
- `HYMN_LIFT`: Victorian −0.5, improviser −0.4 dB;
- the giving out at swell 0.74–0.76.

Organ alone through the 0.40 layer and the room, loudest 3 s against the
engine's organ (−29.0 LUFS in the prelude, −30.3 under the singing), over 11
seeds (104, 105, 107–110, 1840, 1842, 1844, 1847, 12), with three verses and
the hymn of the day by seed:

| | prelude: min / mean / max | hymn: min / mean / max | outside ±2 LU | clicks |
|---|---|---|---|---|
| plain | −0.8 / −0.1 / +0.8 | −0.9 / 0.0 / +0.7 | 0 of 22 | 0 |
| Victorian | −0.5 / +0.1 / +1.4 | −0.8 / −0.3 / +1.5 | 0 of 22 | 0 |
| improviser | −1.5 / +0.1 / +1.2 | −0.4 / +0.3 / +0.8 | 0 of 22 | 0 |

- **The Score is still followed exactly.** 180 hymns of 3 verses: all
  83,005 written notes under the singing are reported at the Score's time
  and pitch. The giving out comes first in 180 of 180.
- **The lab, at 860 and 390 px:**
  - zero console errors;
  - no horizontal scroll at 390;
  - Check, Compare, a meeting's worth, and a muted live play of the hymn
    with the ward's breath off (about −34 dBFS RMS in the giving out) all
    run.

### Requests, revised

- **R1** is revised in place above: the depth scaling, and not the owner's
  brushing.
- **R7 (the integrator: merge CAST's VoicesVocal).** Merge `kolob-r3-cast`'s
  `af8e190c` before the owner next listens for the brushing sound in
  hymn-lab or organist-lab. The organist cannot fix it: it is the singers'
  breath.
- **R8 (the HYMN crew: nothing to do).** hymn-lab's organ re-strikes
  repeated notes again with no change on their side. If they want a longer
  or shorter lift than 50 ms, `AUTO_LIFT` is the knob. It is in
  `kolob-voices-pipeorgan.js`, which is mine, so ask.

### Known issues after round 2

- **The level is balanced by measurement, not governed.** A plan cannot
  hear itself. Hymn-to-hymn differences (register, the Victorian's swell
  habit) still spread one style's hymns over about 2 LU. The worst seen is
  +1.5 LU (a Victorian's full-organ verse). A new registration or dynamic
  wants a fresh sweep: `OrganistLab.analysePlan` over a dozen seeds; my
  driver is `s_spread.js` in the scratchpad.
- **Two-verse hymns have no arc for the Victorian.** He plays both verses on
  the principal; the full organ is for the last verse of three, as planned
  in round 1. The improviser's two-verse hymns can still end full.
- **The strange-fill rate is the owner's to rule on** (`STRANGE_ODDS`).
- **The Victorian's link suspension** still sounds a moment against the
  ward's next entry, now and then (item 6).
- **`joins()` is slow.** It renders the 32-voice ward twice: about 30–40 s
  on this machine. It is a handle for critics, not a button.
