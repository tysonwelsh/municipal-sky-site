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
the hymns are being sung":** two causes were found and measured, one fixed
here and one waiting on a one-line request (see *The breath between the
notes*, below).

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
- Giving out comes first in 180 of 180. There is an interlude between every
  pair of verses (360 of 360).
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

- **R1 (the owner's brushing sound, live).** `kolob-voices-organ.js`,
  `organChord`: put the tremulant on a gain of its own after the envelope.

  ```js
  var master = S.ctx.createGain(), tremG = S.ctx.createGain();
  tremG.gain.value = 1; master.connect(tremG); tremG.connect(dest);   // was: master.connect(dest)
  …
  lfo.connect(lg); lg.connect(tremG.gain);                            // was: lg.connect(master.gain)
  ```

  It is verified in organist-lab (Check: "the engine's organ, prelude, its
  tremulant fixed"): 0 clicks, and the loudest 3 s unchanged (−29.0 LUFS).
  This is audible, so it takes a version line (for example
  `v0.30-organist.1 — the organ no longer clicks at the end of its chords`).
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
  out, interludes and fills. Its repeated notes now hold rather than
  re-speak, because of the touch.
- **R6 (the balance, CAST).** At the engine's organ level, hymn-lab's ward
  (layer 0.88) sits about 12 dB over the organ. This lab sets the ward at
  0.5 so the organist is heard. The engine's balance between the 32-voice
  ward and the organ is still to be set by ear.

## Known issues, and what is not done

- **Not in the meeting yet** (R2). The live app's organ is still
  `organChord`.
- **The strange fill turns up in about four improviser meetings in five**
  that have three or more organ hymns. The cap (one) holds. If it should be
  rarer, lower the 0.55 in `accompany` (`strRoll`).
- **Fills run about 1.2 per hymn** for the Victorian and the improviser.
  That is sparing by the brief, but not yet ruled on by the owner's ear. The
  rates are `STYLES.*.fill.rate`.
- **The Victorian's suspensions sound over the ward** in the links and the
  amen: brief organ dissonances against the singers, by design (the
  Victorian habit). Under the verses the organ plays the Score exactly.
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
