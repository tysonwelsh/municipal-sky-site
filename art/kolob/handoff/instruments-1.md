# Handoff: instruments-1 (sound lab, the new instruments)

Branch `kolob-instruments`, 2026-09-26. This is lab and dev work only, so there is no VERSION bump. Nothing is wired into the app yet.

> **Round 2 (below) supersedes Round 1's level and click claims.** Round 1's reference was about 6 LU hot, so "hymn principal sits where the old organ sat" was wrong. Its click detector also missed the handbell cuts. Both are fixed and re-measured in Round 2.

## What shipped

| file | what it is |
|---|---|
| `kolob-voices-organ.js` | `KOLOB.VoicesOrgan`: a registrable pipe organ. Stops: Principal 8′, Flute 8′, Flute 4′, Vox Humana 8′ + Tremulant, Trumpet 8′, Mixture II–III (breaks back in the treble), Bourdon 16′ pedal. It has a swell box (lowpass + gain), chiff on flue attacks, wind sag on big registrations, C/C♯ chest sides, and exact frequencies passed in (just intonation). |
| `kolob-voices-band.js` | `KOLOB.VoicesBand`: saxhorn band with cornet, alto horn, tuba, plus light snare and bass drum (`flam`, `roll`). Brightness follows the dynamic, each note scoops a few cents up to pitch, and there is a soft edge at forte. |
| `kolob-voices-folk.js` | `KOLOB.VoicesFolk`:<br>• **fiddle**: one bowed voice per line, with bow changes, slurs, cuts, delayed vibrato, rosin noise, 7-limit double stops and open-string drones through a shared body filter<br>• **handbells**: a sung twelfth over the fundamental, a clapper knock, damped or left to ring<br>• **gulls**: "kee-ow" cries; in a flock the lead bird traces the given notes<br>• **cart wheels**: stick-slip axle creak once a turn, gravel crunch, knocks and bed rattle, crossing the stereo field |
| `instruments-lab.php` / `.js` | Audition bench on the Kolob paper look. Has a seed field, room (tabernacle IR / meetinghouse / dry), stop and a live meter. **check** renders a phrase offline and reports peak, RMS, pre-chain peak, clipped samples, stray transients, five-band spectrum, centroid and a spectrogram. |

APIs follow SCORE §1: every call takes `(ctx, destination)` at `create` and scheduled `t` at play. No voice reads `ctx.currentTime`. Sound-level randomness comes from `opts.rand` (a `PJ2.Rand` stream, label `synth:<voice>`). Without one, a voice forks its own stream from `opts.seed`. The main calls:

- `organ.play(t, [{f, dur, at, v, pedal}], registration)`
- `organ.chord(t, freqs, dur, reg, {pedal})`
- `organ.setSwell(e, t, rampS)`
- `band.play(t, notes, "cornet"|"alto"|"tuba", "pp"…"ff"|0–1)`
- `band.drum(t, kind, dyn)`
- `folk.fiddle(t, notes, {drone:[f], droneLevel, dyn})`
- `folk.handbells(t, notes)`
- `folk.gulls(t, {notes, beat, birds, from, to, dist})`
- `folk.wheels(t, dur, {beat, carts, from, to, creak})`

Each instance also has `.out` (fade and pan it from outside) and `.stats()`.

Registrations are passed by name: `quiet flute`, `flutes 8 & 4`, `hymn principal`, `vox humana`, `trumpet`, `full organ`. A registration can also be an array of stop names (so SCORE §5.1 `organ.registration: [...]` works as-is) or a `{stop: level, trem}` object.

## How to hear and see it

`php -S 127.0.0.1:8105 -t <worktree>` → http://127.0.0.1:8105/art/kolob/instruments-lab.php (seed 1847 by default; the seed moves only sound-level detail).

| phrase | what plays |
|---|---|
| organ | OLD HUNDRED (1551), two lines, SATB + pedal, in JI. Has a registration switcher, a live swell slider and a "swell sweep" (shut → open → half). |
| band | Eight-bar quickstep strain in F, played mf then f, with a final chord. |
| fiddle | Reel in D over the open D drone. The tag is a 7/6 → 5/4 double stop, then 7/4 over D. A "no drone" variant is included. |
| handbells | Primary-style song in 6/8. |
| gulls | A flock crossing left to right; the lead bird traces OLD HUNDRED's head. |
| handcart | Two carts under a walking unison line. The singers are a lab stand-in, not the choir crew's voice. The line is invented, **not** ALL IS WELL (that is the Earth-tunes agent's job). |
| level reference | The v0.30 `organChord`, rebuilt line for line. |

## Verification (offline renders through the app's chain, headless Chrome)

Every instrument was rendered in the tabernacle room, dry, meetinghouse and at other seeds. Results:

- **0 clipped samples** and **0 stray transients** everywhere.
- The transient detector was checked against controls: it catches a hard start, a hard stop and a gain step, and passes a proper envelope.
- The console had zero errors on desktop (1100 px) and phone (390 px, no horizontal scroll).
- Live playback of every button was clean.

| phrase (tabernacle) | peak dBFS | RMS dBFS | pre-chain peak | centroid (200 Hz–8 kHz) | nodes created / live at peak |
|---|---|---|---|---|---|
| **reference (v0.30 organ)** | −7.1 | −18.9 | −12.2 | 461 | 180 / 180 |
| organ: quiet flute | −11.4 | −22.8 | −17.8 | 452 | 320 / 55 |
| organ: flutes 8 & 4 | −9.2 | −21.3 | −14.3 | 532 | 384 / 63 |
| organ: hymn principal | −5.1 | −16.6 | −9.0 | 599 | 464 / 73 |
| organ: vox humana | −6.8 | −21.3 | −10.7 | 679 | 448 / 71 |
| organ: trumpet | −5.0 | −20.6 | −8.6 | 1139 | 336 / 57 |
| organ: full organ | −2.5 | −14.9 | −3.5 | 834 | 592 / 89 |
| band | −4.0 | −17.9 | −6.1 | 794 | 698 / 44 |
| fiddle | −5.8 | −19.7 | −9.3 | 990 | 15 / 22 |
| handbells | −5.9 | −20.2 | −9.5 | 614 | 456 / 85 |
| gulls | −3.6 | −22.2 | −6.0 | 2268 | 279 / 46 |
| handcart | −4.2 | −24.2 | −6.5 | 1058 | 145 / 52 |

- **Low end:** the sub band (<120 Hz) is 6–21 % across the organ registrations and 27 % for the band (the tuba). The reference is at 28 %.
- **Node cost per event:**
  - organ: ~15 standing nodes; 3–9 per key, depending on the registration (full organ with pedal ≈ 37 per four-part chord);
  - band: 3 per brass note, 5 per drum stroke;
  - fiddle: ~4 per bowed string for a whole line (not per note);
  - handbell: ~12 per strike;
  - gull cry: 9;
  - cart: ~13 for the whole roll, plus 2–5 per knock.
- **Mobile:** no phrase goes above 89 live nodes.

## Requests to the integrator

1. **Ownership.** PLAN-EXECUTION puts `kolob-voices-organ.js` with CAST and `kolob-voices-band.js` with GUEST. These are the prototypes for those crews to adopt. Their APIs are meant to be final unless those crews say otherwise.
2. **A shared helper file.** Each voice file carries a private copy of about 25 lines: a mulberry fallback stream, a per-context noise buffer, and a node-span counter for `stats()`. Consider a `kolob-synthkit.js` loaded before the voices (SCORE §1 load order, step 4). I did not create one because it is outside my ownership.
3. **Contract note for SCORE §5.1.** `organ.registration` may be a name, a stop-name array (with `"tremulant"`), or a `{stop: level}` object. `KOLOB.VoicesOrgan.resolve()` normalises all three.
4. **Room depth.** Suggested `ROOM_DEPTH` seats for new layers:
   - organ 0.10 (as today);
   - band 0.25 (outside the windows: the band already enters from `wideSend` today);
   - fiddle −0.10;
   - handbells 0;
   - gulls 0.3;
   - cart wheels 0.3.

## Known issues / unfinished

- **Owner ear pass needed.** All verification was by measurement and spectrogram. Whether the band reads as brass and the fiddle as a fiddle needs the owner's ear. The things most likely to need tuning by ear:
  - the fiddle body EQ;
  - the gulls' formant (+6 dB near 2.2 kHz; the gulls are deliberately the brightest thing, 60 % of their energy is in 2–6 kHz);
  - the creak rate range.
- **Handcart level.** The handcart runs about 5 dB under the reference by design: it is distant and passes by. Raise it with `v` if it feels too far.
- **Full organ level.** Full organ is about 4 dB louder in RMS than the v0.30 organ. That is the climax, and it stays under the limiter (peak −2.5 dBFS). The Hosanna and the variations' finale may want it.
- **Not built here:** change-ringing, congregation desks, children, the precentor and cast voices. They are other crews' work, or later.

---

# Round 2: the critic's fixes (2026-09-27)

Merged `kolob-2` first (the corrected SCORE.md and the second-look report). The second look has no section for this track (only split, question, engraving), so this round covers the critic's 14 findings. There is no VERSION bump: this is lab work, and the voices are not wired into the app.

All testing was silent: headless Chrome with `--mute-audio` plus OfflineAudioContext renders.

## What changed, finding by finding

**1. Level calibration (major).**
- **The reference is now faithful.** `P.reference` is organChord line for line:
  - the organ layer's default params;
  - SATB voiced the way the app's Harmony spreads it;
  - `peak = gainMul × 0.7`, with `gainMul = 0.75 × (0.6 + 0.4 × 0.21)` = 0.513 (mid-prelude);
  - env()'s linear ramps, 6 s chords (the prelude's shortest).
- **Measured (tabernacle):** −23.6 LUFS integrated (the critic got −23.4), and −21.2 LUFS for the loudest 3 s.
- **The organ is rebalanced** so that at `opts.gain` 1, hymn principal matches it: KEY_LEVEL 0.2 → 0.0695, and trumpet8 level 0.50 → 0.60 so the chorus reed is not the quietest loud stop.
- **For CAST:** use `opts.gain` 1 in the organ layer. Its volume (0.52) then applies to the new organ just as it did to the old one.

| (tabernacle, seed 1847) | LUFS | loudest 3 s | vs reference (3 s) | peak dBFS | clicks |
|---|---|---|---|---|---|
| v0.30 organChord (reference) | −23.6 | −21.2 | 0 | −10.4 | 7 (see note)¹ |
| quiet flute | −29.4 | −28.0 | −6.8 | −20.5 | 0 |
| flutes 8 & 4 | −27.7 | −26.4 | −5.2 | −17.9 | 0 |
| hymn principal | −22.4 | −21.1 | **+0.1** | −12.5 | 0 |
| vox humana | −27.3 | −26.5 | −5.3 | −15.3 | 0 |
| trumpet | −24.5 | −23.8 | −2.6 | −11.9 | 0 |
| full organ | −18.9 | −18.0 | +3.2 | −7.9 | 0 |

- **Before this round:** hymn principal was −13.9 and full organ −11.8 (my meter reads about 0.5 dB above the critic's in absolute terms, but the gaps match).
- **Every phrase is now under the app's −12.4 LUFS 3-second maximum.** Full organ's loudest 3 s is −18.0.

¹ **A v0.30 bug the faithful reference exposed.** The clicks are in the app itself (see request R2-2), not the lab.

**2. Handbell cuts (acceptance).**
- **The fix:** an undamped bell rings until its fundamental is 40 dB under the strike (`ring × 2.1`), fades with τ 70 ms, and is let go 0.5 s later. A damped bell is let go 0.45 s after the damp (65 dB down). The clapper's noise now runs 0.1 s (it was 0.06).
- **Single bells:** the old ones stopped 33–39 dB under the strike, at −52 to −57 dBFS. The new ones reach −74 dB under the strike, where Chrome snaps the gain to zero (see the note under 6).
- **The lab phrase itself was too short.** It stopped at the tune's end (`at + 3`), before the last bells had rung out, so the dry check could never see the last cut. Every voice's `stats()` now reports `until` (its last stop time), and every lab phrase lasts until then.
- **The old phrase at full length** shows the critic's cuts at 16.588 and 18.860 s: they read 16.608 and 18.880 here, because the chain's compressors add 20 ms. The new phrase has 0.

**3. Chiff.**
- **Louder, broader, and at the right harmonic.** The level is ×10 (CHIFF_LEVEL), Q goes from 4 to 1.4, and it is levelled across the compass by √(780/fc). Open pipes (the principal) now chiff at the octave and stopped flutes at the twelfth; Round 1 had these reversed.
- **Isolated by rendering with and without chiff** (tone identical), then compared as RMS over the first 60 ms against the steady tone:

| registration | chiff re tone | how long it lasts |
|---|---|---|
| quiet flute, C3–C6 | −18.3 to −18.6 dB (was −44.5) | 34–40 ms |
| flutes 8 & 4 | −16.3 dB | — |
| hymn principal | −21.6 / −22.8 dB | 31 ms |
| full organ (masked by the reed, by design) | −28.2 dB | — |

- **The critic's onset test** (inter-harmonic share of the 5–55 ms onset, mean of G3, C4, G4), was → now: quiet flute −38.0 → −21.4 dB, hymn principal −38.2 → −26.5, trumpet −40.4 → −36.2.

**4. Gulls.**
- **The fix:** one octave shift for the whole head, chosen so that the geometric middle of its range lands nearest 954 Hz. The chatter still folds note by note; it is only pitches drawn from the tune.
- **The lead bird alone** (`birds: 0`), tracked f0: 1040 1040 975 867 780 1040 1170 **1300**, exactly the expected contour. It was …1061 593 650.

**5. Fiddle rests.**
- **The fix:** a rest lifts the bow from every string, including the drones and the double-stop string. The note after a rest lands from silence, with its pitch already set. A leading rest takes the first sounded pitch.
- **The test line (D E rest F♯ G, unslurred), rest window:**

| string | before (re note) | now (re note) |
|---|---|---|
| melody | +0.2 dB | −64.6 dB |
| with a drone | +0.3 dB | −63.7 dB |
| with double stops | −1.5 dB | −64.2 dB |

**6. Lab bugs.**
- **Room change:** phrases play into a persistent `labIn`, and a room change builds the new chain and crossfades over 0.25 s. The analyser is built once. Muted live test: the band read −8.4 dBFS before the change and −8.7 dBFS 0.7 s after (it used to read "out —").
- **check()** now renders the seed field and, for the organ, the swell slider. The report prints them, e.g. "seed 12 · hymn principal · swell 0.2 · −28.1 LUFS".
- **Offline renders no longer take over the swell slider.** Found while fixing this: after a check, the slider moved the offline organ, not the one playing. Now only the live context's instruments are kept.
- **The click detector is rebuilt** to measure what the critic measured:
  - 1 ms blocks of the signal above 4 kHz (4th-order high-pass);
  - a click must be 21.6 dB over the **loudest** block of the 30 ms on each side;
  - floor −100 dBFS.
- **Checked against controls:**
  - hard start, hard stop and a gain step are caught;
  - a soft envelope and bright sawtooths at 87 and 349 Hz are clean. (The old detector flagged the brighter cornet's once-per-period edge.)
- **Chrome's zero-snap.** Chrome snaps any `setTargetAtTime(0, …)` to exactly zero once the gain falls under about 4.5e-5. That is a step of at most −87 dBFS, and every release in every file has one. The −100 dBFS floor sits above it and 21 dB under the audible cut the critic found.
- **LUFS readouts.** check reports integrated LUFS and the loudest 3 s. `InstrumentsLab.render(id, o)` returns the four-channel buffer.

**7. The fiddle tag** is now a slide on one string: a new `orn: "slide", from: D·7/6` into 5/4 over the D drone. SCORE §5 already lists `"slide"` among the ornaments. Tracked f0 goes 341 → 344 → 352 → 361 → 366 Hz over 20–170 ms. The close is D with 7/4·D (on the A string), then D with A.

**8. Edge cases.**
- `folk.fiddle(t, [])` and an all-rest line return 0.
- `gulls({birds: 0})` is the lead alone: 64 nodes for the 8-note head, where it was 315.
- `resolve()` returns a fresh object. REGISTRATIONS is frozen.
- An unknown registration or stop name gives a single `console.warn`, then draws hymn principal (or ignores the unknown stop).

**9. Drums never reach before t.** Every stroke of `band.drum(t, kind)` sounds at or after t, and the accent lands `KOLOB.VoicesBand.LEAD[kind]` after t (flam 0.028, roll 0.2). To put a roll's accent on beat b, call `drum(b − LEAD.roll, "roll")`. The lab does this, so it sounds as before.

**10. Cost.** Pitch automation is now k-rate everywhere: pipe detune (wind, tremulant), band pitch and per-note lowpass, fiddle glides and vibrato, gull contours, axle rate. Amplitude stays sample-accurate.
- **Measured interleaved against Round 1's modules** (the machine was under load ≈ 6–7, so absolute ms are unreliable): organ 0.72–0.86×, band 0.88× (a-rate would be 1.25× today's), fiddle 0.76×, cart 0.92×, gulls 0.95×.
- **For the phone budget, per second of audio against the v0.30 reference organ** (interleaved, reference ≈ 8 ms/s here):

| phrase | × reference |
|---|---|
| hymn principal | 2.2 |
| vox humana | 2.0 |
| full organ | 2.8 |
| band | 3.2 |
| handbells | 1.4 |
| handcart | 1.7 |
| gulls | 0.9 |
| fiddle | 0.5 |

- **Where the band's cost goes:** a third of it is the per-note lowpasses (no filters would be 0.66×). The saturators cost 4%. If a phone can't keep up, the fallback is one shared lowpass per section; I have not built it.

**11. Cost comments are exact.** All three headers were rewritten, and stats() now counts the nodes actually built. In-page create* counting matches stats() for every phrase: organ 333 = 320 + 13, band 706, fiddle 22, handbells 457, gulls 249, handcart 144. The organ has 13 standing nodes (it said 15); a gull cry is 8 (it said 9); the lab's handcart singers are 8 + 2 per voice.

**12. Axle jitter is now heard.**
- **The new depth:** `r0 × rnd(1.0, 1.4)` on the 22 Hz lowpassed noise, which measures 0.025 RMS. That is 2.5–3.5% RMS jitter.
- **Measured on the axle oscillator itself** (first-peak autocorrelation, residual against a 70 ms median): the fast wander went from 7–17 cents RMS (p95 15–18 cents) to 34–40 cents RMS (p95 80–94 cents). That is a stumble of about a semitone, not a buzz.

**13. The reference's stepped envelope is gone** (it is env()'s linear ramps now, per 1).

**14. Ear items.** Changed where it was cheap and measurable; the rest is left to the owner's ear:
- **Wind sag.** It now draws only on keys newly put down (held common tones draw nothing), and the reservoir recovers over 1.5 s.
  - Full organ, OLD HUNDRED line 1: the first chord sags 7.8 cents, then 1.7–3.3 cents per chord (it was 7.3 on every chord).
  - `opts.wind` (0 = steady wind) scales it all.
  - Only registrations that can sag are wired to the wind, which also saves cost.
- **Cornet.**
  - Its wave is now the ff spectrum (tilt 0.7, a wider formant), and the lowpass makes the softer dynamics out of it. A tongued note flares for about 15 ms.
  - At ff: H10 is −20/−22 dB re H1 at F4/C5 (it was −34/−37), and H5 is −8/−14.
  - Band loudness is unchanged (−15.2 LUFS). The centroid rose from 794 to 890 Hz.
  - The attack bloom (centroid 5–25 ms against the sustain) is +6–11% at mf–f (it was 0–5%). The alto horns and tuba are untouched.
- **Fiddle body EQ and gull brightness:** unchanged, still for the owner's ear.

## How to hear and see it

URL: http://127.0.0.1:8105/art/kolob/instruments-lab.php. Seed 1847 is the default; seed 12 was also run, in all three rooms. A server was already listening on 8105 from this worktree when I started; I used it and left it running.

- **The organ and the level reference are now next to each other.** Play hymn principal and then the v0.30 organ: they should sound equally loud.
- **The check report** starts with the seed, registration, swell and LUFS.
- **Results in every room (tabernacle, meetinghouse, dry) and at seed 12:**
  - 0 clipped samples and 0 clicks in every phrase;
  - zero console errors at 1100 px and 390 px (no horizontal scroll at 390).

## Requests to the integrator (Round 2)

- **R2-1: file-name collision with `kolob-split`.**
  - **The collision:** `kolob-split` puts v0.30's organ room (organChord/organCycle, lent onto `KOLOB._s`) in `art/kolob/kolob-voices-organ.js`, the same path as this branch's `KOLOB.VoicesOrgan`. Merging both branches is an add/add conflict on that file.
  - **Verified safe to concatenate:** the two IIFEs share no globals. With my file first and the split's room after it, the result loads cleanly in Node, and both `KOLOB.VoicesOrgan` and `KOLOB._s.organChord` / `organCycle` are present.
  - **Two ways to resolve:**
    - (a) concatenate them in that order, keeping the split's position in `$kolob_engine` (my module has no load-order needs);
    - (b) rename the split's room (e.g. `kolob-organ-room.js`), since PLAN-EXECUTION gives `kolob-voices-organ.js` to CAST for this module.
- **R2-2: a v0.30 organChord bug, reproduced by the faithful reference.**
  - **The bug:** the tremulant LFO (`lg`, depth trem × 0.1 = 0.015) is added straight to `master.gain`. After the envelope reaches 0 at `t + dur`, the chord keeps sounding at ±0.015 (≈ −28 dB re peak) for 0.3 s, then the oscillators stop hard. That is a click at every organ chord's end: −67 dBFS above 4 kHz, 50 dB over its surroundings, at 6.42, 12.82, … s in the lab.
  - **Also:** a small tick at each chord's start.
  - **Where:** `kolob-audio.js` ~2039, and `kolob-split:art/kolob/kolob-voices-organ.js:83`.
  - **Fix:** put the tremulant on its own gain after `master` (1 ± 0.015), or scale `lg` by the same envelope. That is not my file. CAST retiring organChord for `KOLOB.VoicesOrgan` also removes it.
- **R2-3: `stats().until`** (the last scheduled stop) is new on all three voices. It is useful to a performer for knowing when a guest has finished.
- **R2-4:** Round 1's requests still stand (the shared `kolob-synthkit.js` helper, SCORE §5.1 registration forms, room-depth seats).

## Known issues / not done

- **Owner ear pass still needed:** the new chiff level, the cornet's bite, the gentler wind, the slide, and the rest of the Round 1 list.
- **Longer handbell lifetimes.** An undamped low bell now lives ~2.1 × ring + 0.5 s (≈ 11.6 s for G3, was ≈ 8.7 s). In the lab this costs no more at peak (85 live nodes), but a dense peal would hold more nodes.
- **The band is still the most expensive voice** (3.2× the old organ per second). A shared per-section lowpass is the fallback if a phone needs it.
- **The lab's tabernacle is the wide room alone** (dry 1 + wet 0.4). The app blends both rooms, and at balance 0.45 the organ layer's dry path sums to about 1.41. So the lab reads about 3 dB under the app in absolute terms. Relative comparisons, and the calibration above, are unaffected.
