# Handoff: instruments-1 (sound lab, the new instruments)

Branch `kolob-instruments`, 2026-09-26. This is lab and dev work only, so there is no VERSION bump. Nothing is wired into the app yet.

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
