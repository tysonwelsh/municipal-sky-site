> **Archived 2026-10-01.** A handoff a later round superseded; kept as the record of what was built and why. Seeds, odds, versions, file names and line numbers in this document may no longer match the code. The current map is `README.md`; the owner's rulings are `OWNER-RULINGS.md`; what is not done is `OPEN-WORK.md`; the contract is `SCORE.md`.

# r2-trombones-1: the trombone choir at dawn

*Crew: trombones (Round 2, GUEST). Branch `kolob-r2-trombones`. 2026-09-27.*

This is a new guest, approved by the owner (PLAN-COMPOSITION §14 item 3; `archive/critic/enrichment-1.md` proposal 3). Its roots are the Moravian trombone choir of Bethlehem, PA (since 1754) and the Salem Easter sunrise (since 1772).

The engine does not call it yet. This branch ships the voices, the guest module, a lab and the integration notes below. Wiring it into the engine is the integrator's step, so there is no VERSION bump (the integrator assigns v0.34).

Two commits:
- `774cdf9`: the first builder's work (voices, guest, lab).
- The continuation: the re-voicing of the engine's chords, a trombone compass for the voicer, a fermata that is never held twice, prepared chorales, lab and harness fixes, and this note.

## What shipped

| file | what it is |
|---|---|
| `kolob-voices-band.js` | **Three trombones added:** `altoTrombone`, `tenorTrombone` and `bassTrombone`, played through the band's existing `play()`.<br>**A distance stage:** `create(…, {distance, room, side, spread})`, a shared outdoor tail `KOLOB.VoicesBand.townRoom()`, and `warm(ctx)` to build that tail ahead of time.<br>**Pure level curves:** `distanceDb(d)` and `dynamicDb(dyn)`.<br>**`band.dispose()`.**<br>**The wave-1 critic's release-click fix:** the `setValueAtTime(lv, rel − 0.001)` anchor on accented saxhorn notes is gone.<br>Nothing else about the cornet, alto horns, tuba or drums changed. |
| `kolob-guest-trombones.js` (new) | `KOLOB.GuestTrombones`:<br>• **`plan()`**: pure; the seat and the odds.<br>• **`perform()`**: two choirs in one town.<br>• **`score()`**: the whole performance as data; pure.<br>• **`chorale()`**: reads, tunes, voices and places the material; pure. Its result is itself material (a *prepared* chorale).<br>• **`harmonize()`**: the fallback four-part harmonizer; pure and deterministic.<br>• **`SAMPLES`**: a short hymn tune in each of the six modes. |
| `trombone-lab.php` / `.js` (new) | The audition bench, in the Kolob paper look:<br>• each trombone alone, at a dynamic and attack you pick;<br>• the four-part choir;<br>• the organ level reference;<br>• the whole dawn exchange, plus far-only and near-only;<br>• a calibration table, an all-six-modes table and the odds.<br>Controls: seed, mode, chorale source (the sample hymn harmonized by the guest, the same hymn as v0.32's Harmony voices it, or any Earth tune with parts), keynote and room. Everything plays through the app's master chain plus a −1 dBFS guard. |
| `_harness.js` (untracked) | A trombone section, and a fix to how the harness stops listening. See Harness below. |

### The trombones

The target is a warm, round chorale tone.

- **The wave:** the forte spectrum. The formant sits near 540 Hz on the tenor, 690 on the alto and 390 on the bass. The bell's radiation rolls the wave off under about 80–150 Hz, so the bass trombone is deep without booming.
- **Brightness follows the dynamic.** A gentle lowpass sits at a multiple of the pitch, but never under a "bell" brightness that rises with the dynamic.
- **The dynamic range is wide:** a solo line measures pp −42, mp −31 and f −24 LUFS (loudest 3 s). The saxhorns' 7.7 dB range was a wave-1 complaint.
- **Attacks:** a soft tongue by default. `atk` gives a breath attack up to about 0.5 s. `legato` re-strikes under the previous note's release, as a crossfade that never leaves a gap.
- **`dynEnd`** swells or fades a note.
- **No vibrato.** The slide is placed by hand to within ±2 ¢, and long notes drift slowly by 1–2 ¢.

**Distance (0–1)** is four cues together. Beyond 0.4 an echo also comes back off the far houses: 0.19–0.31 s, dark, from the other side. A band made without `distance` is built exactly as before.

| cue | near (0.25) | far (0.85) |
|---|---|---|
| direct sound (−22·d^1.5 dB) | −3 dB | −17 dB |
| gentle lowpass | 6.4 kHz | 600 Hz |
| town air against the direct sound | 8 dB under it | 8 dB over it |
| pre-delay before the town air | 50 ms | 10 ms |

### The guest

- **The seat.** The choir sits in the **prelude only**, 4–14 s in. Its dice are drawn before any refusal.
- **The odds.** p = 0.34 × the Sunday's weight, capped at 0.9. The calendar Sundays are read from `meetingInfo.sunday` when it exists.

  | Sunday | weight | p |
  |---|---|---|
  | ordinary / wedding | 1 | 34 % |
  | fast | 0.35 | 12 % |
  | conference, jubilee | 1.5 | 51 % |
  | Easter, dedication | 2.6 | 88 % |
  | Christmas, funeral | 2.1 | 71 % |
  | Pioneer Day | 0.9 | 31 % |

- **Refusals.** The choir is refused:
  - whenever the bands are seated (**never with the bands**; `force` does not override this);
  - when another guest holds the prelude (the steeples, the old tune).

  Against the real `planMeeting`, the realized rate is **19.4 %, about one meeting in five**.
- **The exchange.** A far choir plays line 1 of the hymn and a near choir answers line 2 from the other side.
  - There are 2–4 exchanges (weights 5 : 3 : 1.2), trimmed to fit 90 s.
  - With more lines than phrases, the choirs play the opening lines, then the closing lines, so the last phrase is always the hymn's last line, by the near choir.
  - With fewer lines than phrases, the last lines come round again, softer.
- **Each phrase is an arch:** a breath attack, a swell to the middle, a fade on a fermata of 1.7–2.3.
  - **New:** a line that is written with its fermata already (the engine's `pourIntoLine` ends every line on 2.2–5 beats) is not held twice. The last sonority lasts the longer of its written length and a two-note close held by the fermata. Without this, a poured line's last chord ran past 12 s.
- **The two choirs:**
  - the far choir plays mp–mf at distance 0.74–0.88, from one point;
  - the near choir plays p–mp at distance 0.16–0.30, with width;
  - the far choir is trimmed to be heard a drawn 7–9 LU under the near one;
  - the far leader is a shade slower and 0–3 ¢ flat (cold brass).
- **The ending:**
  - one time in three, the far choir joins the near one's last chord;
  - in aeolian or dorian, slightly more often than not, the hymn ends major (the tierce de Picardie).
- **The material.** Four shapes are accepted (see the module header):
  - Harmony's own `harmonize()` output, as is;
  - chords as `[B,T,A,S]` degree arrays;
  - a melody, harmonized here;
  - a SCORE `Hymn` (the Earth tunes now; the composer's hymns later).

  A prepared chorale (the result of `chorale()`) is also material.
- **The tuning.** A per-chord comma search leans re and te by 81/80 where a chord needs it. This fixes the ii chord's 40/27 wolf and the minor modes' ♭III, v and ♭VII. Harmony's own frequencies are ignored unless `trustFreqs` is set; its degrees are used.

### The voicing (new in the continuation)

The chords are the engine's. Who plays which of their tones, and in which octave, is the choir's.

**The problem.** Harmony voices each chord for its own soprano, then pins the tune over it. Harmony also *rewards* parallel fifths: that is the Sacred Harp's dispersed harmony, right for the ward and wrong for a Moravian chorale. The first builder moved the lower parts by octaves until nothing crossed. Measured over 66 tunes of the engine's own Harmony (1,882 chords), that left:
- about **1,900** parallel fifths and octaves;
- about **650** inner-voice leaps wider than a fifth;
- about **300** octave leaps.

**The fix.** The soprano is set to the tune (or rebuilt from Harmony's steps). The lower three parts are voiced again under it by the fallback harmonizer's own voicer, in one dynamic-programming pass. `chordSpec()` reads what each chord is: from Harmony's `tones`, or against the mode's triads for a bare `[B,T,A,S]`. Then `revoice()` seats it.

**Two refinements.** The voicer now writes in the **trombones' compass**: bass from 0.22, tenor from 0.4 and alto from 0.56 of the keynote, which are RANGE's comfortable floors over a middle-C keynote. With the singers' compass it had before, one chord in eighteen had no alto under a soprano that dipped to the keynote, and fell back to a parallel-prone stack. It also prices the **low-interval limit**: a third or fourth between bass and tenor under B♭2 is mud on brass.

| same 66 tunes, 1,882 chords | parallel 5ths/8ves | inner leaps > 5th | crossings | B–T mud under B♭2 |
|---|---|---|---|---|
| engine Harmony + tune, before | 1,933 | 666 | 0 | 102 |
| engine Harmony + tune, **now** | **32** | **9** | 0 | **61** |
| engine Harmony, tune guessed, **now** | **19** | **12** | 0 | **37** |
| harmonized here, before | 57 | 150 | 0 | 103 |
| harmonized here, **now** | **0** | **0** | 0 | **9** |

The six samples have none of any of these. The remaining parallels on the engine path come where Harmony's chord and the tune leave no other seat, for example an open fifth under a soprano on the fifth.

### The players

S is on the alto trombone, A and T on tenors, and B on the bass trombone. A three-part shape-note tune plays S, T and B.

## How to hear and see it

```
php -S 127.0.0.1:8112 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r2-trombones
```

Then open http://127.0.0.1:8112/art/kolob/trombone-lab.php (seed 1847 by default).

- **"The trombones alone":** pick an instrument, a dynamic (pp–f) and an attack.
- **"The choir at mf" then "The v0.30 organ":** these should sound equally loud.
- **"The dawn exchange":** the whole guest.
  - "far only" and "near only" isolate the choirs. This is the quickest way to hear the distance treatment. They now start at that choir's first phrase, instead of after twelve seconds of the other choir's silence.
  - The list under the buttons is the plan: who plays which line, when, and from which side.
- **The chorale menu:**
  - "the engine's Harmony" plays what v0.32 would pass today, re-voiced;
  - the Earth tunes play every part they print, in their own mode.
- **Seeds to try** (sample hymn):
  - 1 (ionian): 3 exchanges;
  - 4 (aeolian): the hymn ends major, and the far choir joins the last chord;
  - 20 (ionian): 4 exchanges drawn, trimmed to 3 to fit 90 s.

## Verification

All of it was silent: muted headless Chrome (`--mute-audio`, port 9422) with OfflineAudioContext renders, plus the Node harness.

### Calibration

Setup: the tabernacle room, seed 1847, measured by the instruments lab's rule (the loudest 3 s). The reference reads exactly the instruments lab's −23.6 / −21.2 LUFS.

| phrase | LUFS | loudest 3 s | vs the organ | clicks / clipped |
|---|---|---|---|---|
| v0.30 organ (reference) | −23.6 | −21.2 | 0 | 7* / 0 |
| **the four-part choir at mf** (OLD HUNDRED, the organ's phrase) | −22.5 | −21.1 | **+0.1 LU** | 0 / 0 |
| alto / tenor / bass trombone alone at mf (one part each) | −28.6 / −28.6 / −29.2 | −27.6 / −27.3 / −27.5 | −6.1 to −6.4 (one part of four) | 0 / 0 |
| the dawn exchange (ionian) | −27.9 | −23.6 | −2.4 LU | 0 / 0 |

\* The reference's 7 "clicks" are v0.30 organChord's own tremulant clicks (request R2-2 in `instruments-1.md`), not the lab's.

**Clean everywhere.** Zero clicks and zero clipped samples on every render:
- each trombone at pp with a breath attack, mp, f tongued and f soft;
- the choir at p, mf (dry) and f;
- five Earth tunes (ALL IS WELL, IDUMEA, CORONATION, THE PROMISED LAND, GOD BE WITH YOU);
- the six modes on both sources.

### The six modes, and the antiphony

Seed 1847, the tabernacle. Each choir is also rendered alone and measured while it plays, because a phrase window of the full render also holds the other choir's reverberant tail.

| mode | loudest 3 s vs organ (sample / engine) | far LUFS | near LUFS | gap (drawn 7.2) | above 1 kHz, far / near | L/R dB, far / near |
|---|---|---|---|---|---|---|
| ionian | −2.4 / −2.9 | −31.5 | −25.3 | 6.2 | −24.1 / −11.5 | −8.8 / +4.4 |
| mixolydian | −3.4 / −3.7 | −31.7 | −25.6 | 6.1 | −24.5 / −11.4 | −8.8 / +4.6 |
| dorian | −2.3 / −3.1 | −32.2 | −25.1 | 7.1 | −24.1 / −11.5 | −8.8 / +5.6 |
| aeolian | −2.0 / −1.9 | −31.5 | −24.7 | 6.8 | −25.6 / −12.1 | −9.7 / +6.1 |
| hexa | −3.1 / −3.1 | −32.4 | −25.6 | 6.8 | −24.0 / −11.4 | −8.8 / +3.9 |
| penta | −3.4 / −3.6 | −32.1 | −25.8 | 6.3 | −24.7 / −11.6 | −8.9 / +4.1 |

The far/near columns are the sample source. The engine source is within 0.6 LU and 1 dB of them, with gaps of 5.7–6.9 LU.

**Across the six modes and both sources:**
- The far choir is 6–7 LU quieter than the near one, and **about 12.5 dB poorer above 1 kHz** (centroid about 440 Hz against about 600 Hz).
- The two choirs always stand on opposite sides.
- Peaks are −9.6 to −11.6 dBFS.
- The dawn's loudest 3 s sits 1.9–3.7 LU under the organ reference.

**Five more seeds** (1, 4, 20, 77, 3001) gave gaps of 6.9–8.7 LU against draws of 7.7–8.6, again with zero clicks and zero clipping. So the measured gap sits within about 1.5 LU of the draw.

### The page

- **At 860 and 390 px:** zero console errors or warnings, and no horizontal scroll (scrollWidth equals clientWidth).
- **Live controls, driven muted at both widths:**
  - every play button;
  - far only and near only (the meter reads −27 and −21 dBFS within 1.8 s);
  - a room change mid-phrase;
  - stop;
  - the Earth-tune menu, which locks the mode to the tune's and unlocks it again;
  - the seed and mode fields, which re-plan.
- **Fixed on the way:** "near only" once tried to start the performance before the context's birth (a RangeError). `perform()` now starts its sentinel at `max(0, t)`.
- **The reference card** now reports its real live peak (45 nodes; one chord at a time). It had copied the instruments lab's "180", which the wave-1 critic flagged.

### Harness

`node _harness.js <secs> <seed>` prints three `trombones:` lines and PASSes (seeds 1847 and 12).

- **Purity.** `decide`, `score`, `chorale` and `harmonize` run with `Math.random`, `Date.now` and `performance.now` trapped.
- **The seat, against the REAL `planMeeting`** (3,000 meetings, seed 4242):
  - seated **19.4 %**;
  - by kind: ordinary 19 %, conference 29 %, jubilee 29 %, fast 7 %;
  - **0 with the bands**, which were in 35 % of meetings;
  - 0 with another prelude guest;
  - every seat in the prelude's first minute.
- **`perform()` in all six modes, on the engine's own `Harmony.harmonize()` output,** against an instrumented mock (three modes with `tune`, three guessing):
  - no throw;
  - nothing scheduled before `t`, and `ctx.currentTime` never read;
  - every pitch in the just lattice;
  - every note in its trombone's compass;
  - deterministic;
  - 379–547 nodes per performance of 45–74 s.
- **New: the integration path, as written below.** The day's theme (`S.Motif.theme()`) is poured into Common Meter by `S.Prosody`, harmonized by `S.Harmony` and handed over with the tune, in four modes. Checked:
  - every phrase ≤ 24 s;
  - the whole ≤ 100 s;
  - the tune is read;
  - a prepared chorale plays identically;
  - `plan({material})`'s `dur` matches the performance within 3 s;
  - no voice crossings;
  - parallel fifths and octaves in under 8 % of chord changes. Measured: **0 of 96**.
- **New: the main meeting run is untouched, now truly.** `KolobAudio.setNoteListener` and `setEventListener` *add* listeners and cannot remove one. So the first builder's "detach" left the 3,000-meeting sweep appending about 14,000 events to the `dump=` stream. The listeners now sit behind a `LISTEN` gate that the trombone section closes. Checked: `dump=` for 300 s at seed 1847 is **byte-identical** with and without `kolob-guest-trombones.js` present.

## Integration notes (for the engine crew and the integrator)

Everything is written against **scheduled time and a stream**, for the PJ2.Rand / PJ2.Clock engine.

### The stream

`root.fork("guest:trombones:" + n)` (`KOLOB.GuestTrombones.LABEL + n`), where n is the meeting number.
- Pass the same stream to `plan()` and `perform()`, or two fresh forks with that label; the results are identical.
- Inside, the module forks `seat`, `shape` and `synth` (`synth` → `far` / `near`: detune and the echo's delay, the sound-level dice).
- Forks derive from the birth seed, so `plan()` and `perform()` agree on exchanges, pace and sides without passing anything between them.

### 1. Plan: in `planMeeting(n)`

The call goes **after `S.Motif.newMeeting()` and the cumulative flag, before `enterSection(0)`**. In v0.32 that is between `kolob-meeting.js:238` and `:239`. There the theme exists, the bands, steeples and old tune are drawn, and the prelude's length can still change.

```js
var tbStream = root.fork(KOLOB.GuestTrombones.LABEL + n);
// the day's first hymn, as the choir will play it (see "The material")
var tbMaterial = KOLOB.GuestTrombones.chorale(firstHymnMaterial(n));   // prepared: harmonizing is paid here, not in a callback
var tb = KOLOB.GuestTrombones.plan({
  n: n, kind: activity,                 // "ordinary" | "fast" | "conference" | "jubilee"
  sunday: C.sunday || null,             // the calendar's Sunday, when it exists
  sections: plan,                       // [{type, dur}]: needs a "prelude"
  guests: C.visitations,                // the bands must already be drawn
  material: tbMaterial,                 // → dur is exact (without it: a nominal CM estimate)
  force: forcedType === "trombones",    // the dev switch: add ["trombones", 1] to its pool
}, tbStream);
if (tb) {
  C.visitations.push({ type: "trombones", section: "prelude", at: tb.at, dur: tb.dur, stream: tbStream, material: tbMaterial, fired: false });
  plan[0].dur = Math.max(plan[0].dur, tb.holdUntil);   // the prelude yields to the choir (at + dur + 4 s)
}
```

- `tb` is `{guest, seat: "prelude", at, dur, holdUntil, exchanges, lines, estimated, odds, logged: true}`.
- **Never with the bands.** The rule is symmetric: if the bands are ever drawn after the trombones, the engine must not seat them in a trombone meeting.
- **Pacing (§8.13).** The prelude's only neighbour is the invocation, and no guest seats there today now that the Question is shelved. FORM owns the rule across all guests.
- **Cost of `chorale()`:** about 5–12 ms on Harmony's chords, and 15–65 ms if it must harmonize a bare melody (Node). Hence the recommendation to prepare it at plan time.

### The material

`firstHymnMaterial(n)`, until the composer lands. The day's theme is poured into the first hymn's meter, harmonized, and passed **with the tune** so the soprano keeps its octaves:

```js
function firstHymnMaterial(n) {
  var h1 = plan.filter(function (s) { return s.type === "hymn"; })[0];
  var meter = S.METERS[(h1 && h1.meter) || "CM"] || S.METERS.CM;
  // a WITHHELD meeting (cumulative form) must not hear the theme at dawn:
  // play a working motif instead, as the visiting band does (kolob-guests.js:184)
  var src = (C.cumulative && !C.assemblyFired) ? S.Motif.anyWorking() : S.Motif.theme();
  var tune = meter.map(function (nSyl) { return S.Prosody.pourIntoLine(src, nSyl); });
  var lines = tune.map(function (ln) { return S.Harmony.harmonize(ln.map(function (x) { return { deg: x.deg, dur: x.durBeats }; })); });
  S.Harmony.reset();                     // the organ's prelude starts from a fresh voicing, as it did
  return { mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, lines: lines,
           tune: { space: "d7", lines: tune.map(function (ln) { return ln.map(function (x) { return x.deg; }); }) } };
}
```

- **Dice.** `pourIntoLine`, `anyWorking` and `Harmony.harmonize` draw from today's global die. Until the engine crew routes them through streams, build the material from a dedicated fork (e.g. `harmony:trombones:<n>`), or at least only when seated. Otherwise every meeting's later draws shift.
- **The composer.** When the HYMN crew's composer lands, pass `{hymn: firstHymn, keynoteHz}` instead. The choir then plays the very hymn the ward will sing, every part with its own rhythm.
- **Fallback.** Empty or unreadable material plays the mode's sample hymn. The guest never throws mid-meeting.

### 2. Perform: at `preludeStart + v.at`, with the scheduled `t`

**With PJ2.Clock** (the target):

```js
clock.lane("guests").at(preludeT0 + v.at, function (t) {
  var end = KOLOB.GuestTrombones.perform(S.ctx, wideSend(), t, v.material, v.stream, {
    onNote: function (x) { emitNote("trombones", x.freq, x.t, x.dur, { part: x.part, choir: x.choir, loud: x.loud }); },
    onPhrase: function (ph) { /* the log rows, below */ },
  });
  v.fired = true;
  emitEvent({ type: "guest-start", t: t, guest: "trombones", section: "prelude", logged: true });
  clock.lane("guests").at(end, function (t2) { emitEvent({ type: "guest-end", t: t2, guest: "trombones", section: "prelude", logged: true }); });
});
```

**Interim, on v0.32's conductor poll.** The other guests fire at x > 0.2 of their section, which is too late for dawn. Give the trombones their own branch before the generic loop: when `V.type === "trombones" && !V.fired && C.section === "prelude" && S.ctx.currentTime − C.sectionStart ≥ V.at`, call `perform()` with `t = C.sectionStart + V.at`, then set `C.visitType = "trombones"` and `C.visitUntil = end`. `inVisit()` then keeps the other guests off it.

**Call once at start-up:** `KOLOB.VoicesBand.warm(ctx)`. It builds the town's 2.6 s tail (tens of ms), so the first performance does not build it inside a callback.

**What `perform()` returns and does:**
- It returns the **musical end** (absolute seconds). The town's air rings about 2.6 s beyond it.
- It releases every node it built 4.5 s after the end, through a silent sentinel's `onended` (audio clock, no timers).
- It places nothing before `t`, and it reads no clock.

**Log rows** (`hooks.onPhrase({choir, line, t0, t1, pan, repeat, joins})`). `score()` gives `farSide` and `nearSide` ("west"/"east") without playing anything. Suggested rows:
- "♪ trombones at dawn — far to the west";
- "answered from the east";
- "the two choirs together" (`joins`).

### Level, routing and air

- **Routing:** `dest = wideSend()`, outside the windows, all tabernacle (the bands' precedent).
- **Level:** the guest's bus is `KOLOB.GuestTrombones.LEVEL = 1.15`. At that level, the dawn's loudest moments (the near choir) sit **2–4 LU under the organ reference** in the lab. In the app, where the organ layer plays at 0.52 into both rooms, that is about the organ's own level at dawn, with the far choir 6–7 LU under it. This is for the owner's ear.
- **Air:** the choir's chords are not the organ's. The prelude's melodic and harmonic layers (organ, harmonium, clarinet, strings, choir) should give way for `end − t + 3` s (`claimAir`). The drone can stay: the choir's chords are the mode's own.
- **Cost:** about 380–550 nodes created per performance, about 30–40 live at once, plus one convolver (the town) while it plays.

## Requests to the integrator

1. **Load order and fingerprint.** Add `kolob-voices-band.js` (voices, step 4) and `kolob-guest-trombones.js` (performers, step 5, after `kolob-pitch.js`) to `$kolob_engine` in `index.php`. The second look found the module list in four places (`index.php`, `room-lab.php`, `tune-lab.php`, the harness `MODULES`). Add it to all four, or to the shared include if one lands first. My harness section `eval`s both, plus `pj2-rand.js`, after the run; re-loading is harmless.
2. **`kolob-meeting.js`:** the `plan()` call, the prelude yield, the forced-guest pool entry and the firing branch, as above.
3. **SCORE.md.**
   - A new note layer, `"trombones"`, with `onNote` extras `{part, choir: "far"|"near", loud}`.
   - A new guest type `"trombones"` for `guest-start` and `guest-end`.
   - The stream `guest:trombones:<n>` already fits the `guest:<type>:<n>` rule.
4. **`kolob-ui.js` / `kolob-viz.js`.**
   - Add `trombones: 1` to `PHRASE_SKIP` (as `band`).
   - Decide whether the engraving draws the trombones like the band's round notes, or not at all.
   - Add the log rows above.
5. **The saxhorns are still +7 LU over the organ** (wave 1). I only fixed their release click. Whoever adopts the cornet, alto horn and tuba for the crossing bands should calibrate them the way the trombones are calibrated here.
6. **The harness** (untracked): copy this worktree's `art/kolob/_harness.js`. It has the trombone section and the `LISTEN` gate. The gate matters to anyone whose harness section runs `planMeeting()` after the meeting run and then trusts `dump=`.
7. **Suggested line for the integrator's VERSION** (they number it): "the trombone choir at dawn: some Sundays, a far choir plays the first hymn's first line in the prelude and a near one answers".

## Known issues and notes

- **Nobody has listened.** Timbre, distance and levels are verified by measurement only. The things most likely to want the owner's ear:
  - how far the far choir sounds (its 600–1,000 Hz veil and its 6–7 LU gap);
  - `LEVEL`;
  - whether the near choir should be brighter;
  - the pace (1.0–1.28 s a note);
  - the odds.
- **The far/near gap reads 1.5 LU under the draw at seed 1847** (6.2 against 7.2). The trim's level model (`distanceDb`) was fitted on OLD HUNDRED. Across six seeds it holds within 1.5 LU.
- **Four exchanges are rare.** They are drawn about 1 time in 8, and a CM hymn at chorale pace runs past 90 s, so they are usually trimmed to 3. Short-lined hymns play all four.
- **The guess path can invert a melodic fifth.** Without `material.tune`, a true fifth in the tune comes back as the fourth the other way. Pass the tune.
- **Two Earth tunes fold down an octave.** ALL IS WELL and NETTLETON play an octave down on the trombones, because their printed soprano or tenor tops out high. That is what a trombone choir would do.
- **The captured Harmony data** in `trombone-lab.js` (`ENGINE`) is v0.32's Harmony, re-voiced at play time like any engine material. To regenerate it: load the engine in Node, `planMeeting()` once, then for each mode set `S.mode`, `S.F0 = 65`, `rebuildScale()`, `Harmony.reset()` and `harmonize()` each `SAMPLES` line. That is about ten lines; the harness's integration block is a template.
