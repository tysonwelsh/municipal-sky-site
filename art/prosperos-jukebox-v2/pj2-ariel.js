// ============================================================================
// Prospero's Jukebox v2 — pj2-ariel.js
// PJ2.Ariel: the Ariel track — flights and songs. Built to PLAN-ARIEL.md on
// the as-built Phase 0–3 machinery (Rand/Pitch/Clock/Voice/Fx/Air/Motif/
// Harmony/Conductor — all frozen; this file only composes them).
//
// The dramaturgy, in one breath: quick alternation of brief melodic SONGS and
// fast scattering FLIGHTS — alighting → (song, flight) ×2–4 → hover (~60%) →
// swirl (~50%, tide-gated) → release — and the evening ends by ASCENDING out
// of register ("to the elements be free"): the whistle's material climbs +1
// octave by x≈0.6 and +2 by x≈0.9, development tilts fragmentHead+transpose-up
// (beginnings outlive endings — what ascends is the OPENING of the idea),
// the bass speaks last at x≈0.4 (one final root an octave above its floor),
// the breeze pad climbs by GENERATIONAL CYCLE REPLACEMENT (each new cycle an
// octave up, sub dropped — nothing sounding ever retunes), the room ramps to
// the sky reverb, and the delay's thin filter rises so the last fragments are
// mostly ascending echo.
//
// THE SEAM (owner-approved, implemented exactly): the release ends ≤0.05 with
// the HIGH pad tail still ringing (chainOverlapS [6,14]); the next evening's
// alighting atomically re-grounds the field to F 349 lydian
// (field.modulate at the performance-begin event — kolob's straddle lesson
// makes this free: the ringing tail keeps its old-world Hz, everything
// scheduled after reads home). The descent back to earth IS the next opening:
// high tail above, low pad blooming beneath, no dead air ever. This hard
// reset permanently retires the sea-change tonic ratchet for Ariel by
// construction — lifts never compound across nights.
//
// HARMONY — Lydian floating (F 349, [0,2,4,6,7,9,11]): a custom root-motion
// grammar with TWO HOMES and NO DOMINANT. I↔II oscillation (two major triads
// a whole step apart, sharing no leading-tone gravity) is the planing that IS
// the Lydian float; V is de-functionalized (low occupancy, prefers II/iii
// over I); #iv° is NEVER a sounded root (weight zero everywhere — the #4
// lives in MELODY, in the halo, and in the pad's rare tritone voicing, not in
// the chord grammar). Cadences LIFT instead of settle: lift (I→II, a door
// opening), float (II→I with the arrival voiced ABOVE the approach — falls a
// step, rises in register; enforced by construction in the consort renderer
// below), up-half ((current)→II, the mid-evening comma). Sea changes are more
// frequent (p = 0.5 + 0.25·tide) and TRUE-heavy 3:1 (tonic ×4/3 — F→Bb
// lydian, always UP); the one reroot target is degree 4 (→ ionian, the bright
// cousin — same pitches, new floor; note the as-built executor folds the new
// tonic within a tritone of the old, so a reroot's tonic NUMBER may sit below
// 349 while the collection is untouched — the "upward" character of a reroot
// is carried by the register-lifted pivot landing, per the plan's own note).
//
// THE SIGNATURE — the theme machinery exploited, not rebuilt: kind pools tilt
// hard to develop/recall after the alighting (an Ariel evening is about one
// idea flying), swirl is a focus scene (theme only, like the seizure), and
// the GHOST IS THE SIGNATURE CROSSING THE SEAM. With p = 0.5 (seeded, drawn
// only on nights a ghost was carried) the ghost is PROMOTED: the same bird
// returns as the new evening's signature.
//   AS-BUILT NOTE (deviation, documented): pj2-motif.js's working set is
//   sealed — there is no public door that seats a carried fragment as
//   working.theme (seedGhost seats subsidiaries only). Promotion is therefore
//   implemented at the seams Ariel legitimately owns: the promoted ghost is
//   (a) stated at theme prominence (velocity 0.85 vs the quiet 0.6),
//   (b) narrated ({type:"ghost", promoted:true}) and reported as the
//   signature in getInfo(), and (c) DRIVEN through the evening by the ledger:
//   the statement is posted as a "develop" obligation and every answer in the
//   promoted line is re-posted with p≈0.45 (all draws on Ariel's own "ghost"
//   fork), so the promoted line accrues the deepest lineage — and since
//   extractGhost() takes the DEEPEST descendant regardless of chair, a
//   well-worked promoted ghost crosses the NEXT seam too: the same bird, two
//   nights running, exactly the plan's intent. Gen-9 renewal remains the
//   natural forgetting. (A first-class promotion door in pj2-motif.js would
//   be a two-line change to seatGhost — reported upstream, not made here.)
//
// THE FEATHER: the release's final sounded whistle degree becomes the next
// alighting's first chime ping. One note of memory — nearly free, and a
// listener who notices has been told a secret.
//
// VOICES — v1 bodies (prosperos-jukebox-audio.js) with the v2 brains:
//   breeze  (landscape) — 2 sines at root+5th of harmony.current (v1 ~4695),
//           0.4-chance sub-octave triangle, 6 kHz hiss mist; the F–B tritone
//           pair survives as a p≈0.12 voicing flavor on I; 15–25 s cycles,
//           3 s fades, 2–3 s overlaps; the release ladder per above.
//   whistle (melodic, air) — flute PeriodicWave + 5.5 Hz vibrato + breathy
//           1800 Hz bandpass noise + mid-note bends (v1 ~5051). v1's seven
//           cluster builders (climb/sigh/loneTone/trill…) survive as RENDER
//           ARTICULATION chosen from the motif's own shape — rising contour
//           gets the climb's held final, falling gets the sigh's diminuendo,
//           a lone tone gets deep vibrato and the 0.35-chance bend — one
//           brain (PJ2.Motif), seven accents.
//   chime   (melodic, air) — paired bell-wave oscillators ±2–4 cents, 1.5 to
//           2.5 s decays, burst-and-breathe with the lone-ping-in-the-pause
//           habit (v1 ~4804); registers +1 (F5–E6, v1's shelf).
//   flutter (melodic, air) — fast triangle notes, ±2 cents, short phrases
//           only (v1 ~4915); rests more in still air; stops by x≈0.5 of the
//           release; never posts to the ledger (it decorates, it doesn't
//           argue — the one ledger law it can't escape is answering an
//           OVERDUE obligation, which outranks manners by design).
//   bass    (landscape) — v1's additive-triangle electric bass (~4564) with
//           its ARC-FOLLOWING SOUL promoted to the whole track's arc: v1's
//           private arielBassIntensity (two coprime sines + bounded drift,
//           ~4535) is replaced by conductor.intensityAt(t) plus a weather
//           wobble, and EVERYTHING downstream is verbatim — pace ×(1−I·0.6),
//           flourish/reach/three-note odds scaling with I, the 5-figure
//           remembered-flourish buffer with verbatim/retrograde/octave
//           recall, arrivals armed by every harmony step. Offsets travel in
//           DEGREES now (root/+2/+4, the #4 as a 0.15-chance color on I,
//           reach +7) so the bass keeps the key through every sea change.
//   aeolian (NEW — bowed glass / wind-harp; owner pre-approved): slow-attack
//           detuned sine pairs with a glassy breath, sounding 1–2 tones of
//           harmony.current. Dual role like the Library's singing hum:
//           landscape shimmer most of the time, occasional THIRD MELODIC
//           SPEAKER (slow theme statements — what makes song-scene overlap
//           real), and the consort body for cadence lifts. It is also who
//           hums the #4 against a I chord — the tritone as light.
//   gust    (NEW — owner pre-approved): a shaped wind swell (filtered noise,
//           4–8 s) that is simultaneously a joint gesture (Ariel's
//           drone-breath), a weather event made audible (ambient pool, gated
//           by gustiness), and the release's exhale. Landscape, never claims
//           the air, nearly free.
//   ambient pool — birdsong, breeze-gust, sparkle, leaf rustle, cricket,
//           wind chime, bumble bee, rising bubbles (v1 ~5394–5710), all
//           weather-gated and snap()ped where pitched. v1's GIGGLE IS
//           RETIRED (owner decision: a human voice startles under the v2
//           aesthetic; birdsong and the bee keep the playfulness).
//   lyre    (NEW rc.33 — landscape-chordal; Ariel's own instrument, and the
//           plan's recommendation): the Tempest's airy songs were sung to a
//           lyre and nothing else in this sky is PLUCKED. An exact-period
//           LOOPED BUFFER read at n·f/sr — not a Karplus–Strong comb, which
//           WebAudio clamps to one render quantum inside a feedback cycle
//           (~344 Hz) while the lyre sings to F5–F6 — under a lowpass
//           closing from bright×f to 1.2f over 60 % of the ring, through a
//           body at 300 Hz and 1.5 kHz. Its gesture is THE ROLLED CHORD:
//           three tones of harmony.current rolled bottom-up over 0.3 s
//           (top-down p 0.2) at vel 0.6–0.9, in the empty F3–F5 band the map
//           left between the bass and the breeze. Songs and hovers on
//           harmony steps, the alighting's first chord once a night, and
//           0.4 s after a LIFT cadence's arrival.
//   concertina (NEW rc.33 — landscape; the air made audible): a FREE REED,
//           the one spectrum Ariel entirely lacked. Two reed waves ±3 ¢
//           through a 900 Hz chamber (+6 dB) and a 3 kHz lid, every part
//           riding ONE bellows gain that wanders ±2 dB at 0.15 Hz and
//           phrases push/draw every 3–5 s. Held dyads of the current chord,
//           9 s, least-motion voiced, a second to speak and three to let go.
//           Hovers; and on p 0.4 of LIFT cadences it TAKES THE CONSORT from
//           the aeolian — the Library organist's gesture, exactly.
//   handpan (NEW rc.33 — landscape-chordal; THE ANSWER): three sines at
//           1 : 2 : 3 over a mallet thump, the upper partials decaying
//           faster. It speaks only when a WHISTLE PHRASE ENDS — 2–4 chord
//           tones 0.35 s apart, descending or in an arch. It answers; it
//           never accompanies.
//   vibraphone (NEW rc.33 — landscape-chordal; the Day Off's lounge): sine
//           plus a 4th partial under a MOTOR — one shaft for the whole
//           block, 4.5 Hz at depth 0.6, which is the one thing that makes a
//           vibraphone a vibraphone. Its gesture is a BLOCK: a dyad or triad
//           struck TOGETHER on harmony steps, in hovers and the alighting's
//           first two steps.
//
// THE FOUR ARE LANDSCAPE. None of them ever claims THE AIR — the air's
// limits, its overlap chances and its three speakers are exactly what they
// were — and none of them sounds a note whose pitch was read anywhere but at
// schedule time. In THE RELEASE the lyre climbs the whistle's own ladder
// (+1 octave from x ≥ 0.6, +2 from x ≥ 0.9) and thins as it climbs, so the
// dissolution stays upward and not louder; the concertina leaves with the
// bass at x ≥ 0.4, and the handpan and the vibraphone with the flutter at
// x ≥ 0.5. Nothing of theirs is ever killed at the seam: a ring that
// crosses the boundary crosses it as the breeze's high tail does.
//
// FLIGHTS AND THE AIR: flights are gesture-clouds — 4–10 rapid notes over
// ~1.5–4 s from flutter or a chime burst — and clouds are NOT air-exempt:
// each cloud takes ONE claim covering the whole cloud + margin ("quick
// without busy" is enforced, not hoped for). airLimit 2 in songs AND flights
// (two speakers is Ariel's norm the way it was the chapters' exception),
// 1 everywhere contemplative. Margins rnd(2,5) s — Ariel converses faster
// than the Library — and they DOUBLE across the release.
//
// FX — the delay showcase: Ariel runs its own Fx.delay near the caps (timeS
// 0.32, feedback 0.48, damp 2800 — brighter tail than the Library's 1600,
// wet 0.32, drift 0.008) with the NEW "thin" option (highpass in the
// feedback loop — every repeat lighter than the last, the delay-domain twin
// of the release; the cutoff rides UP across each release via setThin and
// re-anchors at the seam). A second parallel instance at 0.53 s (golden-ish
// ratio to 0.32 — never rhythmic) at wet 0.15 is fed from the first's
// output: two walls at different distances. Chime and flutter always send;
// whistle per-phrase p≈0.5. The sympathetic halo is tuned to lydian degrees
// {0,1,3,4} + two octave tonics — the #4 (degree 3, B) RINGS IN THE HALO
// where the pad won't voice it — excited by chime + whistle sends AND a
// small tap of the delay's wet return (echo exciting strings = the shimmer
// aura, bought honestly); its level RISES through the release (the opposite
// of the Library's candle-out halo). Rooms: close decay 1.8 bright / "sky"
// decay 5.2 with GENTLER HF damping than the Library's hall (open air, not a
// dark hall); balances alighting .25, song .3, flight .55, hover .7, swirl
// .5, release ramping → .85. Weather channels aloft: gustiness (flutter/
// ambient density, breeze LFO depth, gust gate), altitude (halo level),
// shimmer (brightness/filter cutoffs, delay wet ±0.05), thermals (gap
// scaling ±15% — the one channel allowed to move event times).
//
// THE ROSTER (rc.33) — SCENE_ROSTER below: `lab-ariel.html`'s PLAN_DEFAULT
// verbatim, the plan's §6.3 table read literally plus the two ticks the lab
// page names as its own. It gates ENTRIES only — the dice are thrown first,
// the gate comes after, and a sounding body always finishes. It only ever
// ADDS rests: the flutter's exit at release x 0.5, the bass's last word at
// x 0.4 and the whistle's intensity gate are the ENGINE's laws and are
// untouched. Rows ticked in every column (the breeze — the seam — the
// ambient sky, the halo) have no opinion. ONE VOICE MAY SOUND OUTSIDE ITS
// CELLS: the concertina, and only as the consort taking a lift cadence
// (see the note over SCENE_ROSTER).
//
//   ONE DISCLOSED DEPARTURE from the lab page's table, and only one: the
//   HANDPAN's SONG cell is ticked. The page shipped it untouched and noted
//   that this "silences the HANDPAN in songs, which is half of its own entry
//   law" — but it is all of it, because the pan's only cue is a whistle
//   phrase ENDING and the same table rests the whistle in hovers (and in the
//   flight that always precedes one), so under the literal table no phrase
//   can ever end where the pan is seated. §6.4's own words give the pan
//   "songs and hovers"; the tick gives it that law back and nothing else.
//
// GAIN STAGING (rc.33 pass — worst-case *scheduled* peaks, the family
// ledger; THE AIR and THE ROSTER are what keep the sum honest now that
// there are twelve voices instead of eight):
//
//   THE AIR caps speakers at limit+1 — 2 holders outside songs/flights, 3
//   inside them, HARD (pj2-air) — so whistle + chime + flutter + the aeolian
//   singer can never all sound at once. THE ROSTER rests the whistle in
//   flights and hovers, the chime in hovers, the flutter in the alighting,
//   hovers and the swirl, the bass and the aeolian in the alighting, flights
//   and the swirl, and it seats the concertina and the vibraphone almost
//   entirely in the hover — the quietest scene there is (intensity
//   0.12 + 0.10·(1−x)^1.3), which is exactly where a new body costs least.
//   The handpan is the one newcomer that speaks in songs, and it speaks only
//   INTO A SILENCE: its cue is the whistle's phrase ENDING, so it is never
//   summing with the voice it answers.
//
//   breeze bed     2 pads × 0.06 + sub 0.025 + hiss 0.004 = 0.149, × the
//                  breathing LFO (≤ 1.03) × the 2–3 s cycle overlap ≈ 0.31,
//                  plus a cadence pad 2 × 0.011 or a sea-change bloom
//                  2 × 0.04; all × breezeBreath (≤ 1) × breezeLevel
//                  (≤ 0.48)                                   -> ~ 0.19 worst
//   melody         whistle 0.028 (+ breath 0.5 pre-attenuated), chime
//                  2 × 0.026 × vel, flutter 0.04 × vel; at most THREE
//                  speakers ever, and only in songs and flights
//                                                             -> ~ 0.12 worst
//   bass           0.10 × vel, one note at a time by its own pacing; out of
//                  the release at x 0.4                       -> ~ 0.10
//   aeolian        bed 2 × 0.02 (+ sheen 0.22 and breath 0.18 into the same
//                  gain) + the singer 0.026 + the cadence consort 3 × 0.014
//                                                             -> ~ 0.09 worst
//   lyre    NEW    ONE roll at a time (the hold law). 3 strings × 0.03 × 0.8
//                  (the chord scale) × vel 0.6–0.9 ≈ 0.018 each; the roll
//                  spreads them 0.15 s apart into a decay to 0.32 of peak,
//                  so ~ 0.047 sums at the third onset, × the body's two
//                  peaking bells (+3 dB at 300 Hz, +2 dB at 1.5 kHz — never
//                  the same partial, so 1.41 honest / 1.78 pessimal), + the
//                  20 ms pluck scrape at 0.55 × peak       -> ~ 0.085 worst
//   concertina NEW ONE dyad at a time: 2 parts × 0.014 × the 900 Hz
//                  chamber's +6 dB (≤ ×2 in band) × bellows (≤ 1.12)
//                                                             -> ~ 0.063 worst
//                  (at a TAKEN cadence × 0.6 -> ~ 0.038, under the aeolian
//                  consort's own 3 × 0.014 it replaces — the cadence
//                  contract holds by arithmetic, not by hope)
//   handpan NEW    ONE answer at a time: per note 0.028 × the bowl's summed
//                  partial weights (1 + 0.5 + 0.25 = 1.75) ≈ 0.049, + the
//                  hand's thump at 0.5 × peak for 15 ms; the 0.35 s gap and
//                  the partials' faster decay mean about two notes are ever
//                  really summing                             -> ~ 0.085 worst
//   vibraphone NEW ONE block at a time: 3 bars × 0.025 × (1 + the 4th
//                  partial's 0.18) = 0.0885, × the motor gain (0.4–1.0 —
//                  its own tremolo is the only thing that ever raises it,
//                  and its ceiling is 1)                      -> ~ 0.089 worst
//   ambient        loudest one-shot (a release gust at 0.02, wind chime
//                  3 partials × 0.02)                         -> ~ 0.06 worst
//   halo           levelGain ≤ 0.09 (the release's maximum) on a
//                  whisper-fed ring                           -> ~ 0.02
//   walls A+B      wet 0.32 / 0.15 on sends of 0.5 (chime) 0.4 (flutter)
//                  0.35 (whistle) 0.2 (lyre) 0.18 (vib) 0.15 (pan)
//                                                             -> ~ 0.03
//   ------------------------------------------------------------------
//   WORST SCENE, roster- and air-aware (the honest sum):
//     song       0.19 + 0.12 (3 speakers) + 0.10 + 0.09 + 0.06 + 0.02
//                + 0.03 + lyre 0.085 + handpan 0.085          = 0.780
//     hover      0.19 + 0.00 (whistle and chime rest) + 0.10 + 0.09 + 0.06
//                + 0.02 + 0.03 + lyre 0.085 + concertina 0.063
//                + handpan 0.085 + vibraphone 0.089           = 0.812
//     flight     0.19 + 0.12 (chime + flutter) + 0.06 + 0.02 + 0.03 = 0.42
//   -> ~ 0.81 absolute worst into the rooms — and that hover figure is a
//   deliberate fiction: the hold laws and the rest windows (4–12 s for the
//   lyre, 6–14 for the box and the bars, 5–14 for the pan) make all four
//   newcomers sounding at one instant a thing that needs three independent
//   coins inside one 3 s window, in a scene that lasts 35–55 s and admits
//   at most one entry each. The equal-power room split conserves power and
//   each room is dry 1.0 + wet ~0.3 -> ~ 1.05 at bus input; × masterVol
//   0.5 × the saturator's small-signal gain ~1.66 (pj2-voice lesson #1)
//   ~ 0.87 into the limiter — under the ~ 0.89 (−1 dBFS) master ceiling
//   with the glue compressor still idling, and the RENDERED soak (the
//   number that actually decides it) measures the whole engine's worst
//   1 s peak at roughly −5 dBFS with the four in, one decibel over the
//   same seed with the four muted.
//
// WANDER (rc.36 — plan §11: "knobs that should wander"). Every voice is now
// PLAYED rather than set. Three classes of draw, all on PJ2.Voice.wander's
// own forks, all read at SCHEDULE TIME through one door (wv), the desk knob
// always the centre and each layer's new `vary` knob (0–2, def 1) scaling the
// half-width — at vary 0 the engine is rc.33 to the bit, which the harness
// pins with a fingerprint of the pre-change stream.
//
//   breeze   THE SEAM, and therefore character and weather ONLY, both read at
//            the CYCLE'S START and held for that cycle: breath (weather,
//            0.75–1) and hiss (character, 0.75–1). A new sway depth arrives
//            with a NEW pad, under the old one, exactly as a new chord does.
//            The 3 s fades are the "nothing startles" ruler and are not
//            ranged. Both spans stop AT the knob: the seam is the floor of
//            the whole piece and the floor never rises.
//   whistle  breath (touch, ±30 %, ONE draw per PHRASE — a singer takes one
//            breath) on top of the shimmer coupling; vibrato depth (touch,
//            ±35 % per NOTE) on top of the gustiness coupling AND the
//            articulation's own depth; the vibrato RATE (character, 4.8–6.2
//            Hz, promoted from the body's 5.5) and the breath BAND
//            (character, 1620–1980 Hz, promoted from 1800) — one flute per
//            night.
//   chime    decay (touch, ±20 % per ping, on top of the brain's 1.5–2.5 s
//            draw); detune (character, ±30 %) — a bell's beating rate is its
//            identity and holds all evening.
//   flutter  nothing. It has no knobs and it is already the most varied
//            voice in the sky; the plan's table says skip and it is right.
//   bass     attack (touch, 8–18 ms, promoted from the body's 12 — the knob
//            floors at 6 ms, far above any click-safe edge); warmth
//            (character, 0.8–1, promoted: it scales the 2nd and 3rd
//            triangle partials together). flourish stays a fixed chance.
//   aeolian  sheen (character 0.8–1); breath (touch ±30 % per note); detune
//            (character, 2–5 ¢, promoted from the body's ±3).
//   ambient  density (weather, ±30 %) — the sky speaks more freely for a
//            while, then less.
//   halo     level (character, 0.8–1). Its RELEASE ramp is untouched.
//   lyre     voices (touch, weighted 2 ·.15 / 3 ·.5 / 4 ·.35 — a bare dyad
//            some rolls, a full hand others); roll (touch 0.16–0.48) AND the
//            roll's SHAPE, taken from the draw itself with no extra dice: a
//            roll shorter than the knob is the hand gathering, longer is the
//            hand dragging; ring (touch 2.2–3.8 per STRING, dealt longest to
//            the highest course); bright (touch 4–6.5 per roll); body
//            (character 0.8–1). updown, register and presence are fixed —
//            they are entry laws and a ladder.
//   concert. hold (touch, the whole 6–14 s per dyad); bellows (touch
//            0.65–1) with the push/draw period already drawn 3–5 s per dyad
//            on its own fork; reed (character 4.5–6 dB) plus reedTouch
//            (touch, −1…0 dB per dyad — a free reed is never twice the
//            same); detune (character 4–9 ¢).
//   handpan  gap (touch 0.22–0.55 per answer) AND uneven inside it
//            (gapJitter, touch 0.75–1.25 per step: an answer is a phrase,
//            not a clock); ring (touch 1.9–3.2); thump (touch 0.6–1);
//            partials (character 0.4–0.5) — one shell per night.
//   vibra.   motor (character 3.8–5.5 Hz) and depth (character 0.5–0.75) —
//            a motor is set once and left, and one that changed per note
//            would read as a fault; ring (touch 2.3–3.8 per strike: the
//            pedal).
//
// Untouched by this round, and deliberately: the RELEASE choreography and
// its ladders, every exit x, the seam and its re-grounding, the feather, the
// ghost promotion, the Lydian grammar and every harmony table, the air's
// limits, the roster, and every `presence` and `register` knob. No ranged
// value can move a register, an entry law or a ceiling — the classes above
// are chosen so that none of them can.
//
// LEDGER (rc.36). rc.33's paper worst case already sits at ~0.87 into a 0.89
// limiter — 98 % of the master ceiling — so this round's rule is that NO
// SPAN MAY LIFT A LAYER'S WORST-CASE LINE ABOVE THE NUMBER ABOVE. Two ways
// it is kept, and both are things a real player does:
//   * BODY COMPENSATION, where plan §11.3's span is kept in full. The lyre's
//     level spreads over however many strings the hand took (never above the
//     shipped 0.8 per string), falls with the square root of a quicker
//     strum, and falls again for a longer-ringing string — so the worst
//     rolled-chord sum over the whole {voices × roll × ring} grid is exactly
//     rc.33's. The handpan's answer does the same with the gap and the ring:
//     fingers moving fast do not also strike harder.
//   * A TRIMMED `hi`, where it cannot. breeze breath/hiss, bass warmth,
//     aeolian sheen/breath, halo level, lyre body, concertina reed/reedTouch/
//     bellows and handpan partials/thump all stop at their def and wander
//     DOWNWARD only. §11.4 asked for symmetry on several of these (aeolian
//     sheen ±20 %, bass warmth ±20 %, concertina reed to 7.5 dB, handpan
//     partials to 0.65, thump to 1.4); the arithmetic said no, and the
//     engine's own closing law — when in doubt, quieter — said which way to
//     give. The variety they lose is a decibel; the variety that carries
//     this round lives in the level-NEUTRAL knobs (roll, ring, gap, voices,
//     motor, detune, vibrato, attack, hold, breath band, decay, density),
//     which keep their spans whole.
//   The two exceptions are the WHISTLE's breath (±30 %) and the BELL's decay
//   (±20 %), which keep the plan's symmetric spans: the roster rests both
//   voices in the HOVER, and the hover is where the worst case is. They cost
//   the song scene 0.780 → 0.788 (0.839 → 0.847 into the limiter).
//   -> hover 0.812 (unchanged), song 0.788 -> 0.847 into the limiter, under
//   the 0.89 ceiling. The harness re-derives both sums from the live spans
//   every run, including the two gesture grids, so a weakened compensation
//   turns a row red instead of turning up in the mix.
//
// STREAM NOTE (rc.33) — what actually moved, stated plainly:
//
//   Every NEW draw lands on a NEW label-hashed fork ("lyre", "concertina",
//   "handpan", "vibraphone"), so no pre-existing stream gains or loses a
//   single draw: the whistle, chime, flutter, bass, aeolian, breeze, joints,
//   cadence, motif, harmony, air and weather forks advance exactly as they
//   did at rc.32. THE HANDPAN'S CUE inside startWhistle is a CALL, not a
//   draw — the answer's dice are thrown on the handpan's own fork when its
//   lane fires. THE CONCERTINA'S consort take and THE LYRE'S cadence answer
//   are each ONE draw on their own fork, taken unconditionally before
//   anything is rendered, so neither depends on what the consort did.
//   What DOES change, and is the whole point, is which of those draws
//   sounds: the roster rests six of the eight old layers somewhere, so an
//   rc.33 evening is not an rc.32 evening with four voices added — it is a
//   differently populated evening. Same seed, same evening, forever; a
//   different evening from rc.32's, deliberately.
//
// STREAM NOTE (rc.36) — the same discipline, kept:
//
//   Every wander draw lands on PJ2.Voice.wander's OWN forks —
//   "wander:<layer>:touch", "wander:<layer>:weather" and
//   "wander:<layer>:dress:<evening>" — so not one of the forks in the table
//   above gains or loses a draw. Nothing existing is re-rolled: with `vary`
//   at 0 on every layer the note+event stream is rc.33's BIT FOR BIT (proved
//   two ways — a pinned fingerprint inside the harness, and a byte compare
//   of two seeds' full 1800 s dumps taken before the change). At the shipped
//   vary 1 the same seed still plays the same evening, forever.
//
//   One SECOND-ORDER consequence, stated because it is real: a wandered
//   value can change how many draws a body then takes on its OWN fork — the
//   lyre draws one velocity per string, so a four-string roll advances the
//   lyre's fork one step further than a three-string one. That is downstream
//   of the wander, not a re-roll of it, and it is exactly the sense in which
//   an rc.36 evening is a different evening from an rc.33 one: same seed,
//   same shape, a differently played instrument.
//
// Discipline inherited whole from pj2-library.js: every pitched note reads
// the field AT SCHEDULE TIME (never a cached Hz — that is what makes the sea
// change and the seam reset free); every envelope through PJ2.Voice.env or
// an anchored ramp pair; every musical draw from a forked seeded stream
// (Math.random only inside noise/IR texture); melodic voices claim THE AIR
// then the budget, and refusal means silence this cycle, never a throw;
// landscape voices never touch the air; when in doubt, quieter.
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  // --------------------------------------------------------------------------
  // The intensity band (owner's aesthetic constants, binding — same numbers
  // as every track: the floor keeps the breeze breathing, the ceiling keeps
  // the swirl a concentration, not a climax).
  // --------------------------------------------------------------------------
  var FLOOR = 0.04;
  var CEIL = 0.65;

  function clampI(v) { return v < FLOOR ? FLOOR : (v > CEIL ? CEIL : v); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function smoothstep(x) {
    x = x < 0 ? 0 : (x > 1 ? 1 : x);
    return x * x * (3 - 2 * x);
  }

  // --------------------------------------------------------------------------
  // THE MIXER SURFACE — the jukebox UI's per-layer volume/mute/rate contract,
  // uniform with PJ2.Library/PJ2.Sycorax (getLayers / setLayerVolume /
  // getLayerVolumes / toggleLayer / setLayerRate / getLayerRates, plus the
  // fine-tune knob doors getLayerParams / setLayerParam / getLayerParamValues;
  // full design note in pj2-library.js). The gain side is STRICTLY GAIN-SIDE: mixer gains
  // (tagged _pj2Mix) are inserted into — or cleanly reused from — each
  // layer's chain; no randomness, no event-time effects, and never a shared
  // param with the follower or the joints (breezeLevel/aeoLevel/breezeBreath
  // keep their one writer; the mixer gets its OWN stage beside them). The
  // rate side only re-paces the layer's own clock lanes; the form lanes
  // (harmony, cadence, seachange, follow, release) are never scaled.
  //
  // Layer -> params (design values in parens):
  //   breeze   mixBreeze (1) inserted breezeLevel -> rooms (pad, sub, hiss
  //            and the release gusts all live upstream of it)
  //   whistle  per-seat wraps (1) over the shared pool + delaySendWhistle
  //            (.35) + haloSendWhistle (1, its private feed into the string
  //            send) — mute the song and the walls and strings let it go
  //   chime    per-seat wraps (1) + delaySendChime (.5) + haloSendChime (1)
  //            (the feather rides these too — it IS a chime)
  //   flutter  per-seat wraps (1) + delaySendFlutter (.4)
  //   bass     layBass (1)
  //   aeolian  layAeo (1) — bed and singer share the layer by wiring
  //   ambient  layAmb (1)
  //   halo     layHalo (1) — the RETURN side; sends follow their exciters
  //            (haloDelayTap stays with the echo path it taps)
  //
  // The two walls' returns stay unowned: every feed into wall A is
  // mixer-scaled at its source, so muted voices stop being echoed without
  // orphaning the echo of anything still sounding.
  // --------------------------------------------------------------------------
  var MIX_LAYERS = [
    { key: "breeze",  label: "Breeze",       kind: "landscape" },
    { key: "whistle", label: "Whistle",      kind: "melodic" },
    { key: "chime",   label: "Chimes",       kind: "melodic" },
    { key: "flutter", label: "Flutter",      kind: "melodic" },
    { key: "bass",    label: "Bass",         kind: "melodic" },
    { key: "aeolian", label: "Aeolian Harp", kind: "landscape" },
    { key: "ambient", label: "Ambient",      kind: "ambient" },
    { key: "halo",    label: "Halo",         kind: "fx" },
    // rc.33 — the four auditioned voices, APPENDED after the fx return so no
    // existing row moves (row order is the owner's muscle memory). Ordered as
    // the lab page ordered them, which is the order they were auditioned in:
    // the recommendation, the reed, then the two struck bodies.
    { key: "lyre",       label: "Lyre",       kind: "landscape" },
    { key: "concertina", label: "Concertina", kind: "landscape" },
    { key: "handpan",    label: "Handpan",    kind: "landscape" },
    { key: "vibraphone", label: "Vibraphone", kind: "landscape" },
  ];
  var MIX_MUTE_S = 0.3;  // mute/unmute ramp — click-safe, unhurried
  var MIX_VOL_S = 0.08;  // volume moves ride the master-volume ramp length

  // Layer -> clock lanes the RATE control re-paces (the mixing desk). Only
  // the layer's own voice lanes; the form lanes (harmony, cadence,
  // seachange, follow, release) carry structure, not voice, and are never
  // scaled. halo has no lane (fx return layer) — it gets no rate slider.
  var MIX_RATE_LANES = {
    breeze: ["breeze"], whistle: ["whistle"], chime: ["chime"],
    flutter: ["flutter"], bass: ["bass"], aeolian: ["aeolian", "aeolianSing"],
    ambient: ["ambient"], halo: [],
    // rc.33: the lyre, concertina and vibraphone each own one lane — the
    // chord-name poll that IS their opportunity — so the rate slider re-paces
    // how often the voice looks, and nothing else. The HANDPAN gets no rate
    // lane (like the halo): its pace is the whistle's, not its own — every
    // answer is scheduled off a phrase's end, so a rate slider would only
    // drag the answer away from the song it is answering.
    lyre: ["lyre"], concertina: ["concertina"],
    handpan: [], vibraphone: ["vibraphone"],
  };
  var MIX_RATE_MIN = 0.25, MIX_RATE_MAX = 4;

  // PER-LAYER FINE-TUNE PARAMS (mixing desk II — the per-row knob strips;
  // pj2-library's design note is authoritative). Pure scalars read at
  // schedule time (or at the follower's 0.5 s poll, for halo); every def
  // equals the constant it replaces, so the default desk is bit-identical
  // to the unparametrized engine.
  //
  // rc.38 — ONE EXCEPTION, and it is the round's whole point: `presence`.
  // Every non-seam voice now carries one, and the SHIPPED DEFAULTS ARE THE
  // REDUCTION (the owner, 2026-09-03: "it's a little too cluttered now that
  // we added all the new instruments — reduce the frequency of most
  // instruments, pretty much anything that's not a drone or drone-adjacent").
  // A presence knob at 1 restores the pre-rc.38 rate EXACTLY, to the bit —
  // which is what the harness's IDENTITY row proves. Never thinned, and so
  // carrying no presence at all: the BREEZE (the seam), the aeolian BED
  // (the singer's row owns the knob, the bed does not read it), the ambient
  // sky and the halo.
  var LAYER_PARAMS = {
    breeze: [
      { key: "breath", label: "breath — how deeply the pad sways", min: 0, max: 2.5, def: 1,
        lo: 0.75, hi: 1, per: "weather" },
      { key: "hiss", label: "hiss — the high air-mist dose", min: 0, max: 3, def: 1,
        lo: 0.75, hi: 1, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    whistle: [
      // rc.38 — THE THINNING KNOB. The singer is a PRINCIPAL: it is never
      // absent and it thins only a little. It has no entry chance of its
      // own (it speaks whenever the air is free), so presence works the
      // other way the rule allows — it divides the margin it claims and the
      // gap it waits afterwards. The intensity gate is untouched.
      { key: "presence", label: "presence — how often the singer takes the air", min: 0, max: 3, def: 0.8 },
      { key: "breath", label: "breath — the airy noise under the song", min: 0, max: 2.5, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "vibrato", label: "vibrato — the singer's wobble depth", min: 0, max: 2, def: 1,
        lo: 0.65, hi: 1.35, per: "touch" },
      { key: "vibRate", label: "vibrato Hz — how fast the singer's wobble beats", min: 4, max: 7, def: 5.5,
        lo: 4.8, hi: 6.2, per: "character" },
      { key: "breathHz", label: "breath band Hz — where the breath noise sits", min: 1400, max: 2200, def: 1800,
        lo: 1620, hi: 1980, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    chime: [
      { key: "presence", label: "presence — how often the bell speaks", min: 0, max: 3, def: 0.6 },
      { key: "decay", label: "decay — how long the bell rings", min: 0.5, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "touch" },
      { key: "detune", label: "detune — how far apart the paired bells sit", min: 0, max: 3, def: 1,
        lo: 0.7, hi: 1.3, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    flutter: [
      // rc.38 — the ornament had no strip at all (every constant in its body
      // is literal, by design: a cloud is not a timbre). It gets the two the
      // desk is uniform on — the thinning knob, and `vary` so the row reads
      // like every other one.
      { key: "presence", label: "presence — how often the cloud gathers", min: 0, max: 3, def: 0.6 },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    bass: [
      { key: "presence", label: "presence — how often the ground speaks", min: 0, max: 3, def: 0.7 },
      { key: "flourish", label: "flourish — how often the bass runs", min: 0, max: 2, def: 1 },
      { key: "attack", label: "attack ms — how hard the string is taken", min: 6, max: 30, def: 12,
        lo: 8, hi: 18, per: "touch" },
      { key: "warmth", label: "warmth — how much 2nd and 3rd partial are in the note", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    aeolian: [
      // rc.38 — the SINGER's knob only. The bed is the landscape's (and the
      // cadence consort is the cadence's): neither is thinned, neither is
      // ever absent.
      { key: "presence", label: "presence — how often the glass sings (the bed plays on)", min: 0, max: 3, def: 0.6 },
      { key: "sheen", label: "sheen — the glass's high octave partial", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1, per: "character" },
      { key: "breath", label: "breath — the bow's airy thread", min: 0, max: 2.5, def: 1,
        lo: 0.7, hi: 1, per: "touch" },
      { key: "detune", label: "detune ¢ — how far apart the glass's paired strings sit", min: 0, max: 8, def: 3,
        lo: 2, hi: 5, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    ambient: [
      { key: "density", label: "density — how often the sky speaks", min: 0.5, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "weather" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    halo: [
      { key: "level", label: "level — how loud the sympathetic strings whisper", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1, per: "character" },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    // rc.33 — the four new voices. EVERY timbral constant of theirs is a knob
    // read through pVal at schedule time, and every def is the value the
    // owner left the lab page's slider on: the desk at its defaults IS the
    // audition. (rc.36 hangs plan §11.3's spans off those same defs; the
    // entry knobs — presence, register, updown — carry no span, by law.)
    lyre: [
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.6 },
      { key: "roll", label: "roll s — how long the hand takes to cross the strings", min: 0.12, max: 0.8, def: 0.3,
        lo: 0.16, hi: 0.48, per: "touch" },
      { key: "ring", label: "ring s — how long a string is left to sound", min: 1.5, max: 5, def: 3,
        lo: 2.2, hi: 3.8, per: "touch" },
      { key: "bright", label: "bright — where the lowpass starts, in multiples of the pitch", min: 3, max: 8, def: 5,
        lo: 4, hi: 6.5, per: "touch" },
      { key: "body", label: "body — the soundbox's two peaks (0 = a bare string)", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1, per: "character" },
      { key: "voices", label: "voices — strings in the roll", min: 2, max: 4, def: 3,
        per: "touch", round: true, weights: [[2, 0.15], [3, 0.5], [4, 0.35]] },
      { key: "updown", label: "updown — chance the roll comes DOWN instead of up", min: 0, max: 1, def: 0.2 },
      { key: "register", label: "register — which octave the lyre sits in", min: -1, max: 0, def: -1 },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    concertina: [
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.6 },
      { key: "reed", label: "reed dB — how hard the 900 Hz chamber bites", min: 0, max: 12, def: 6,
        lo: 4.5, hi: 6, per: "character" },
      { key: "reedTouch", label: "reed touch dB — how much the bite varies dyad to dyad", min: -3, max: 3, def: 0,
        lo: -1, hi: 0, per: "touch" },
      { key: "detune", label: "detune ¢ — how far apart the two reeds sit", min: 0, max: 15, def: 6,
        lo: 4, hi: 9, per: "character" },
      { key: "bellows", label: "bellows — the pressure wander and the push/draw", min: 0, max: 2, def: 1,
        lo: 0.65, hi: 1, per: "touch" },
      { key: "hold", label: "hold s — how long one dyad is held", min: 6, max: 14, def: 9,
        lo: 6, hi: 14, per: "touch" },
      { key: "register", label: "register — which octave the box sits in", min: -1, max: 0, def: 0 },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    handpan: [
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.6 },
      { key: "ring", label: "ring s — how long the shell rings", min: 1.5, max: 4, def: 2.5,
        lo: 1.9, hi: 3.2, per: "touch" },
      { key: "partials", label: "partials — how much 2nd and 3rd are in the bowl", min: 0, max: 1, def: 0.5,
        lo: 0.4, hi: 0.5, per: "character" },
      { key: "thump", label: "thump — the hand's own low knock", min: 0, max: 2, def: 1,
        lo: 0.6, hi: 1, per: "touch" },
      { key: "gap", label: "gap s — the space between the answer's notes", min: 0.2, max: 0.8, def: 0.35,
        lo: 0.22, hi: 0.55, per: "touch" },
      { key: "gapJitter", label: "gap jitter — how uneven the answer's steps are (1 = a clock)", min: 0.5, max: 1.5, def: 1,
        lo: 0.75, hi: 1.25, per: "touch" },
      { key: "register", label: "register — which octave the pan sits in", min: -1, max: 0, def: -1 },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
    vibraphone: [
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.6 },
      { key: "motor", label: "motor Hz — how fast the discs turn", min: 3, max: 7, def: 4.5,
        lo: 3.8, hi: 5.5, per: "character" },
      { key: "depth", label: "depth — how deep the motor's tremolo cuts", min: 0, max: 1, def: 0.6,
        lo: 0.5, hi: 0.75, per: "character" },
      { key: "ring", label: "ring s — how long the bars are left to sound", min: 2, max: 4, def: 3,
        lo: 2.3, hi: 3.8, per: "touch" },
      { key: "register", label: "register — which octave the bars sit in", min: 0, max: 1, def: 0 },
      { key: "vary", label: "vary — how far touch, character and weather may wander (0 = fixed)", min: 0, max: 2, def: 1 },
    ],
  };

  // ==========================================================================
  // THE SCENE ROSTER (rc.33) — who plays where, as an explicit table, so
  // every scene rests somebody and the six scenes finally SOUND different
  // from one another. This is `lab-ariel.html`'s PLAN_DEFAULT verbatim: the
  // plan's §6.3 roster read literally, plus the two ticks the lab page names
  // as its own — the LYRE's hover tick (§6.2a's own entry law rolls on hover
  // harmony steps at p 0.35, and a table that rested it there would fight the
  // card) and the VIBRAPHONE's alighting tick (§6.4 gives it the alighting's
  // first two steps at p 0.5).
  //
  // It gates ENTRIES only. Every opportunity's dice are thrown FIRST and the
  // gate comes after (stream discipline); a "rest" is the absence of new
  // cycles, and anything already sounding finishes and rings across the
  // boundary. A row ticked in every column has NO OPINION — which is why the
  // breeze (the seam: its lane is never cancelled), the ambient sky and the
  // halo are ticked throughout. The roster only ever ADDS rests: the engine's
  // own retirements (the flutter out by release x 0.5, the bass's last word
  // at x 0.4, the whistle's intensity gate) are the ENGINE's law and stay
  // exactly as they were, which is why both keep their release ticks.
  //
  // ONE VOICE MAY SOUND OUTSIDE ITS CELLS: the concertina, and only as the
  // consort TAKING a lift cadence. A cadence is a boundary gesture under the
  // cadence contract — the same contract that lets the aeolian consort
  // surface where the aeolian bed rests — and taking it from the consort is
  // the whole gesture (the Library's organist, exactly). Disclosed here so
  // nobody rediscovers it as a bug.
  //
  // ONE CELL DEPARTS FROM PLAN_DEFAULT, and only one: the HANDPAN's SONG.
  // The lab page shipped `handpan: [0,0,0,1,0,0]` and noted that this
  // "silences the HANDPAN in songs, which is half of its own entry law".
  // It is not half — it is all of it. The pan's only cue is a whistle
  // phrase ENDING, and the same table rests the whistle in hovers (and in
  // the flight that always precedes one), so under the literal table no
  // phrase can ever end where the pan is seated and the voice cannot sound
  // at all, on any evening, ever. §6.4's own text places it in "songs and
  // hovers"; a cell that empties the intersection is a defect in the table,
  // not a decision in it. So the row ships as [0,1,0,1,0,0] and the pan
  // keeps the law the plan wrote for it. Everything else here is
  // PLAN_DEFAULT to the tick.
  // ==========================================================================
  var ROSTER_COLS = ["alighting", "song", "flight", "hover", "swirl", "release"];
  var SCENE_ROSTER = {
    //           alight song flight hover swirl release
    breeze:     [1, 1, 1, 1, 1, 1],   // the seam — no opinion, never rests
    whistle:    [1, 1, 0, 0, 1, 1],
    chime:      [1, 1, 1, 0, 1, 1],
    flutter:    [0, 1, 1, 0, 0, 1],
    bass:       [0, 1, 0, 1, 0, 1],
    aeolian:    [0, 1, 0, 1, 0, 1],
    ambient:    [1, 1, 1, 1, 1, 1],   // the weather — no opinion
    halo:       [1, 1, 1, 1, 1, 1],   // the fx return — no opinion
    lyre:       [1, 1, 0, 1, 0, 1],
    concertina: [0, 0, 0, 1, 0, 0],
    handpan:    [0, 1, 0, 1, 0, 0],   // the SONG cell is the one departure

    vibraphone: [1, 0, 0, 1, 0, 0],
  };

  // Default seed when neither create({seed}) nor ?seed= supplies one — a
  // fixed constant ("ARIE" as a 32-bit word), never Date.now (house rule).
  var DEFAULT_SEED = 1095911749;

  function resolveSeed(opts) {
    if (opts && opts.seed !== undefined && opts.seed !== null) {
      return (+opts.seed) >>> 0;
    }
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
        if (m) return (+m[1]) >>> 0;
      }
    } catch (e) { /* headless harness: fall through */ }
    return DEFAULT_SEED;
  }

  // ==========================================================================
  // THE LYDIAN FLOAT — the harmony profile's authored tables (PLAN-ARIEL §2).
  //
  // Degree indexing (0-based over F lydian): 0 I(F) 1 II(G) 2 iii(Am)
  // 3 #iv°(B°) 4 V(C) 5 vi(Dm) 6 vii(Em).
  //
  // Row reasoning, binding per the plan:
  //   I  — home, lightly held: the big weights go to II (the float) and iii;
  //        real self-weight (planing repose); V as COLOR only; vi/vii shadow.
  //   II — the second home: back to I, up to iii, self-weight nearly as
  //        large as I's. The I↔II oscillation is the point — measured
  //        stationary occupancy puts I+II on top with II well over 20%, and
  //        I↔II moves near 40% of all motion (verified in the check run).
  //   iii— the drift chord: to II or I, occasionally vi.
  //   V  — DE-FUNCTIONALIZED: nobody sends much weight here, and its own row
  //        prefers II and iii over I, so dominant gravity cannot creep back
  //        in through tuning (the harness caps V→I share < 10%).
  //   #iv°— NO ROW, NO INBOUND WEIGHT: degree 3 never sounds as a root. The
  //        #4 lives in melody, in the halo strings, and in the breeze's rare
  //        tritone voicing.
  //   vi, vii — shadow and passing, rare, both resolving toward the homes.
  // ==========================================================================
  var ARIEL_GRAMMAR = {
    0: [[1, 3.2], [0, 1.8], [2, 1.6], [4, 0.5], [5, 0.4], [6, 0.25]],
    1: [[0, 3.2], [1, 1.6], [2, 1.4], [5, 0.4], [6, 0.3]],
    2: [[1, 2.2], [0, 2.0], [5, 0.7], [2, 0.5]],
    4: [[1, 2.2], [2, 1.6], [0, 0.8], [6, 0.4]],
    5: [[1, 1.6], [0, 1.4], [2, 1.0], [4, 0.4]],
    6: [[0, 1.6], [2, 1.2], [1, 1.2], [5, 0.4]],
  };

  // Cadence vocabulary (profile shape per pj2-harmony's contract): lift is
  // the house cadence (a door opening), float the "amen" (II→I, arrival
  // voiced ABOVE — see renderCadenceConsort), up-half the mid-evening comma.
  var ARIEL_CADENCES = {
    "lift":    { approach: 0, arrival: 1 },
    "float":   { approach: 1, arrival: 0 },
    "up-half": { approach: "current", arrival: 1, approachWhenAtArrival: 0 },
  };

  // Sea change: p = 0.5 + 0.25·tide (gale turns more), placement biased 3:1
  // toward the boundary entering swirl over a flight→song boundary, targets
  // TRUE-heavy 3:1 (the reverse of the Library — the float is Ariel's
  // identity and rerooting lydian LEAVES lydian's family: deg 4 → ionian).
  var ARIEL_SEACHANGE = {
    p: function (tp) { return 0.5 + 0.25 * tp; },
    placementWeights: [[{ to: "swirl" }, 3], [{ from: "flight", to: "song" }, 1]],
    targets: [[{ kind: "true" }, 3], [{ kind: "reroot", degs: [[4, 1]] }, 1]],
  };

  // ==========================================================================
  // THE MOTIF CONFIGURATION — v1's ear-tuned Markov DNA ported verbatim
  // (prosperos-jukebox-audio.js:163–193) + per-voice transform characters +
  // Ariel's scene policy (PLAN-ARIEL §3). Every custom scene name has a
  // kind-pool row (the documented chapter-normalization gotcha: a scene
  // absent from kindPools is silently treated as "chapter" everywhere).
  // ==========================================================================
  var ARIEL_CHIME_MARKOV = [
    [0.03, 0.22, 0.25, 0.04, 0.25, 0.18, 0.03],
    [0.22, 0.03, 0.25, 0.04, 0.22, 0.21, 0.03],
    [0.20, 0.22, 0.03, 0.04, 0.25, 0.22, 0.04],
    [0.20, 0.18, 0.20, 0.03, 0.20, 0.15, 0.04],
    [0.22, 0.20, 0.22, 0.04, 0.03, 0.25, 0.04],
    [0.20, 0.22, 0.20, 0.04, 0.25, 0.03, 0.06],
    [0.25, 0.20, 0.20, 0.05, 0.20, 0.07, 0.03],
  ];
  var ARIEL_FLUTTER_MARKOV = [
    [0.05, 0.10, 0.15, 0.20, 0.25, 0.10, 0.15],
    [0.10, 0.05, 0.10, 0.15, 0.20, 0.25, 0.15],
    [0.15, 0.10, 0.05, 0.10, 0.15, 0.20, 0.25],
    [0.25, 0.15, 0.10, 0.05, 0.10, 0.15, 0.20],
    [0.20, 0.25, 0.15, 0.10, 0.05, 0.10, 0.15],
    [0.15, 0.20, 0.25, 0.15, 0.10, 0.05, 0.10],
    [0.10, 0.15, 0.20, 0.25, 0.15, 0.10, 0.05],
  ];
  var ARIEL_WHISTLE_MARKOV = [
    [0.05, 0.30, 0.20, 0.10, 0.15, 0.10, 0.10],
    [0.25, 0.05, 0.30, 0.10, 0.10, 0.10, 0.10],
    [0.15, 0.25, 0.05, 0.25, 0.10, 0.10, 0.10],
    [0.10, 0.10, 0.25, 0.05, 0.25, 0.15, 0.10],
    [0.10, 0.10, 0.10, 0.25, 0.05, 0.25, 0.15],
    [0.10, 0.10, 0.10, 0.15, 0.25, 0.05, 0.25],
    [0.15, 0.10, 0.10, 0.10, 0.15, 0.30, 0.10],
  ];

  // Who develops how (PLAN-ARIEL §3): the whistle is the singer (sequence/
  // transpose/ornament — bends and turns are its whole v1 vocabulary — plus
  // augment, the loneTone habit); the chime is the fragmenter (a bell rings,
  // it doesn't breathe — augment near zero); flutter is pure ornament
  // (diminish/fragmentHead, everything else whispers); aeolian is the slow
  // singer (augment/invert — the hum's character, an octave up in glass).
  var ARIEL_VOICES = {
    whistle: {
      table: ARIEL_WHISTLE_MARKOV,
      weights: {
        sequence: 3, transpose: 2.5, ornament: 3, augment: 2,
        invert: 1.2, retrograde: 1, fragmentHead: 0.6, fragmentTail: 0.6,
        diminish: 0.5,
      },
      register: 0, walkStart: 0,
    },
    chime: {
      table: ARIEL_CHIME_MARKOV,
      weights: {
        fragmentHead: 3.5, fragmentTail: 2.5, diminish: 2.5, sequence: 2,
        transpose: 1.5, retrograde: 1.2, invert: 0.8, ornament: 0.5,
        augment: 0.1,
      },
      register: 1, walkStart: 0,
    },
    flutter: {
      table: ARIEL_FLUTTER_MARKOV,
      weights: {
        diminish: 4, fragmentHead: 3, sequence: 2, fragmentTail: 0.5,
        transpose: 0.5, invert: 0.4, retrograde: 0.4, ornament: 0.3,
        augment: 0.2,
      },
      register: 1, walkStart: 4,
    },
    aeolian: {
      table: ARIEL_WHISTLE_MARKOV, // stepwise and gentle — glass sings like breath
      weights: {
        augment: 3.5, invert: 2.5, transpose: 2, retrograde: 1.2,
        fragmentTail: 1, sequence: 0.6, fragmentHead: 0.4, ornament: 0.4,
        diminish: 0.3,
      },
      register: 0, walkStart: 0,
    },
  };

  // Scene policy: fresh weight is LOW everywhere after the alighting — an
  // Ariel evening is about ONE idea flying. Flights splinter the theme
  // (develop-heavy, some fresh); swirl concentrates like the seizure (focus
  // scene: theme only, single links); hover remembers; release recalls what
  // it is letting go of, fragmentHead+transpose-tilted (§1c: beginnings
  // outlive endings — the OPENING of the idea is what ascends).
  var ARIEL_POLICY = {
    kindPools: {
      "alighting": [["fresh", 5], ["recall", 2], ["develop", 2], ["answer", 1]],
      "song":      [["develop", 4], ["answer", 2], ["fresh", 1], ["recall", 1]],
      "flight":    [["develop", 3], ["fresh", 2]],
      "hover":     [["recall", 3], ["develop", 2]],
      "swirl":     [["develop", 1]],
      "release":   [["recall", 4], ["develop", 1]],
    },
    answerFallback: {
      "alighting": "fresh", "song": "develop", "flight": "develop",
      "hover": "recall", "swirl": "develop", "release": "recall",
    },
    sceneTilt: {
      "alighting": { augment: 1.4, transpose: 1.3, sequence: 0.5, ornament: 0.6,
                     diminish: 0.5, fragmentHead: 0.6, fragmentTail: 0.6 },
      "song":      { sequence: 1.5, ornament: 1.5, invert: 1.2, transpose: 1.1 },
      "flight":    { diminish: 1.8, fragmentHead: 1.6, fragmentTail: 1.3,
                     sequence: 1.3, augment: 0.3, ornament: 0.5 },
      "hover":     { augment: 1.8, invert: 1.3, fragmentTail: 1.2,
                     diminish: 0.4, sequence: 0.5 },
      "swirl":     { diminish: 1.8, fragmentHead: 1.6, sequence: 1.3, augment: 0.3 },
      "release":   { fragmentHead: 2, transpose: 1.6, augment: 1.3,
                     fragmentTail: 0.5, diminish: 0.5, sequence: 0.4 },
    },
    postP: {
      "alighting": 0.1, "song": 0.3, "flight": 0.15,
      "hover": 0.12, "swirl": 0, "release": 0.05,
    },
    postDeadlineS: [8, 18],       // Ariel converses faster than the Library
    ghostScene: "alighting",      // the ghost's one statement window
    focusScenes: ["swirl"],       // swirl concentrates like the seizure
    seedVoices: { theme: "whistle", subs: ["chime", "flutter"] },
  };

  // ==========================================================================
  // WEATHER ALOFT — Ariel's Fx.weather spec (periods prime, 120–600 s band,
  // pairwise coprime; four seeded draws per channel at build, pure math
  // after). thermals is the ONE channel allowed to move event times
  // (gap scaling, hard ±15% by the gmAt mapping below).
  // ==========================================================================
  var WEATHER_ARIEL = {
    gustiness: { period1: 137, period2: 401, depth: 0.45 }, // flutter/ambient density, breeze LFO, gust gate
    altitude:  { period1: 293, period2: 499, depth: 0.4  }, // halo level (and the sky's register mood)
    shimmer:   { period1: 181, period2: 457, depth: 0.42 }, // brightness/filter cutoffs, delay wet ±0.05
    thermals:  { period1: 229, period2: 541, depth: 0.35 }, // gapMul (±15% max)
  };

  // Room balances per scene (PLAN-ARIEL §5). Release is special-cased: its
  // entry ramps the balance toward 0.85 across most of the scene — the room
  // opening IS the ascent's fourth move.
  var ROOM_BALANCE = {
    "alighting": 0.25, "song": 0.3, "flight": 0.55,
    "hover": 0.7, "swirl": 0.5, "release": 0.55,
  };
  var ROOM_RELEASE_TARGET = 0.85;

  // The halo's tuning: lydian degrees {0,1,3,4} + TWO octave tonics — six
  // strings. Degree 3 is the #4 (B): it rings in the halo where the pad
  // won't voice it (the tritone as light). Read from the LIVE field at
  // (re)tune time — era-aware like every pitch in this file.
  var HALO_DEGS = [0, 1, 3, 4];
  function haloFreqs(field) {
    var out = [];
    for (var i = 0; i < HALO_DEGS.length; i++) out.push(field.degFreq(HALO_DEGS[i], 0));
    out.push(field.degFreq(0, 1));
    out.push(field.degFreq(0, 2));
    return out;
  }

  // Ariel's delay doses (PLAN-ARIEL §5): wall A near the caps with the thin
  // ascending-echo filter; wall B further off, fed FROM wall A's output.
  var DELAY_A = { timeS: 0.32, feedback: 0.48, damp: 2800, driftHz: 0.04,
                  driftDepth: 0.008, wet: 0.32, thin: { hz: 320, maxHz: 2400 } };
  var DELAY_B = { timeS: 0.53, feedback: 0.3, damp: 2800, driftHz: 0.03,
                  driftDepth: 0.006, wet: 0.15 };
  var THIN_HOME = 320;      // the thin cutoff's resting place
  var THIN_RELEASE = 1400;  // where the release rides it (echoes ascend)

  // ==========================================================================
  // create({ seed, volume, absences }) → Ariel  (facade mirrors PJ2.Library's
  // exactly). `absences: false` is a DEV DOOR only — it turns the rc.38 cast
  // draw off so the harness can prove the engine is pre-rc.38 to the bit at
  // presence 1; the shipped default draws.
  // ==========================================================================
  function create(opts) {
    opts = opts || {};

    var seed = resolveSeed(opts);
    var masterVol = (opts.volume != null) ? opts.volume : 0.5;
    var noteLs = [];
    var eventLs = [];
    var analysers = [];

    var ctx = null;
    var run = null;
    var playing = false;
    var stopping = false;

    function emitNote(n) {
      for (var i = 0; i < noteLs.length; i++) {
        try { noteLs[i](n); } catch (e) { /* listener's problem */ }
      }
    }
    function emitEvent(e) {
      for (var i = 0; i < eventLs.length; i++) {
        try { eventLs[i](e); } catch (err) { /* listener's problem */ }
      }
    }
    function addListener(list, fn) {
      if (typeof fn !== "function") return function () {};
      if (list.indexOf(fn) < 0) list.push(fn);
      return function () {
        var i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      };
    }

    // ----------------------------------------------------------------------
    // Live-state readers, guarded (a voice polling mid-handoff must breathe).
    // ----------------------------------------------------------------------
    function curIntensity(t) {
      if (run && run.conductor) {
        try {
          if (t != null && typeof run.conductor.intensityAt === "function") {
            return clampI(run.conductor.intensityAt(t));
          }
          return clampI(run.conductor.intensity());
        } catch (e) {}
      }
      return FLOOR;
    }
    function curSceneType() {
      if (run && run.conductor) {
        try {
          var s = run.conductor.scene();
          if (s && s.type) return s.type;
        } catch (e) {}
      }
      return "alighting";
    }
    function curSceneX() {
      if (run && run.conductor) {
        try {
          var s = run.conductor.scene();
          if (s && typeof s.x === "number") return s.x;
        } catch (e) {}
      }
      return 0;
    }
    function curTidePos() {
      if (run && run.conductor) {
        try {
          var td = run.conductor.tide();
          if (td && typeof td.pos === "number") return td.pos;
          if (typeof td === "number") return td;
        } catch (e) {}
      }
      return 0;
    }

    // ----------------------------------------------------------------------
    // THE MIXER (see MIX_LAYERS above; mechanics identical to pj2-library —
    // the design note there is authoritative). mixState outlives runs;
    // run.mix[key] entries are {p, design, v0,t0,v1,t1} where the segment is
    // our own last write, so the anchor value at any time is arithmetic (the
    // mixer is the only writer on its params — never read .value mid-ramp).
    // ----------------------------------------------------------------------
    var mixState = {};
    for (var mxi = 0; mxi < MIX_LAYERS.length; mxi++) {
      mixState[MIX_LAYERS[mxi].key] = { volume: 1, muted: false, rate: 1 };
    }
    // Fine-tune param state (LAYER_PARAMS): same lifetime as mixState;
    // voices read it live through pVal at schedule time.
    var paramState = {};
    for (var plk in LAYER_PARAMS) {
      paramState[plk] = {};
      for (var pdi = 0; pdi < LAYER_PARAMS[plk].length; pdi++) {
        paramState[plk][LAYER_PARAMS[plk][pdi].key] = LAYER_PARAMS[plk][pdi].def;
      }
    }
    function pVal(layer, key) {
      var l = paramState[layer];
      return (l && l[key] != null) ? l[key] : 1;
    }

    // ------------------------------------------------------------------
    // THE THINNING (rc.38). One rule, three faces, because Ariel's voices
    // decide to enter in three different shapes:
    //
    //   presP(layer, p)     an ENTRY / speak / consider probability —
    //                       multiplied (the rc.33 four already did this).
    //   presRest(layer, p)  a REST probability, which is the same rule read
    //                       from the other side: the SPEAK side is what
    //                       presence scales, so rest' = 1 − k·(1 − rest).
    //   presGap(layer)      the multiplier for a voice that has no entry
    //                       chance at all (the whistle, the bass): its
    //                       margins and its post-utterance wait are DIVIDED
    //                       by presence, capped at ×2 as the rule says.
    //
    // Each voice reads exactly ONE of them, at the one place that IS its
    // entry decision, so nothing is thinned twice. A knob at 1 is the
    // pre-rc.38 engine to the bit: × 1 is exact in binary floating point,
    // and presRest early-outs at exactly 1 because 1 − 1·(1 − 0.55) is not.
    // ------------------------------------------------------------------
    function presence(layer) {
      var v = pVal(layer, "presence");
      return (typeof v === "number" && isFinite(v) && v >= 0) ? v : 1;
    }
    function presP(layer, p) { return clamp(p * presence(layer), 0, 1); }
    function presRest(layer, p) {
      var k = presence(layer);
      return (k === 1) ? p : 1 - k * (1 - p);
    }
    function presGap(layer) {
      var k = presence(layer);
      if (k === 1) return 1;      // exactly as-composed, to the bit
      if (k <= 0) return 2;       // the cap: silence is the mixer's job, not this knob's
      return Math.min(2, 1 / k);
    }

    // ------------------------------------------------------------------
    // THE ABSENCES (rc.38) — "on certain playthroughs some instruments are
    // not heard at all… but not as a ban" (the owner, 2026-09-03). The draw
    // is PJ2.Voice.absences (its header carries the law: evening one full,
    // 0–3 voices, never the same voice twice running, never more than a
    // third of the cast, last evening's set the only memory, its own fork).
    // Drawn at the seam's re-grounding moment, where the evening ordinal is
    // already counted; reset by reseed, because a reseed is a new run.
    //
    // ELIGIBLE: every voice that is neither the seam nor a bed nor the
    // principal. The whistle is the singer and is never absent; the breeze,
    // the aeolian BED, the sky and the halo are landscape and never absent.
    // An absent voice makes NO NEW ENTRIES that evening — the gate sits
    // beside the roster's, draw-first and gate-after, so not one fork moves
    // because a voice sat down. Sounding notes finish; the aeolian's bed and
    // the cadence consort play on where the singer is away.
    // ------------------------------------------------------------------
    var ABSENT_ELIGIBLE = ["chime", "flutter", "bass", "aeolian",
                           "lyre", "concertina", "handpan", "vibraphone"];
    var absencesOn = (opts.absences !== false);   // the dev door; the default draws
    function isAbsent(key) {
      return !!(run && run.absent && run.absent.length && run.absent.indexOf(key) >= 0);
    }
    function layerLabel(key) {
      for (var i = 0; i < MIX_LAYERS.length; i++) {
        if (MIX_LAYERS[i].key === key) return MIX_LAYERS[i].label;
      }
      return key;
    }
    // Drawn at every performance begin; the cast line is emitted by the
    // conductor wrapper the instant AFTER the begin event, so the log reads
    // "evening N" and then "tonight: …", always before the evening's first
    // note (the Library's own order).
    function drawAbsences(n, t) {
      // The dev door turns the WHOLE gesture off — no draw, no cast line —
      // which is what makes "presence 1 + absences off" the pre-rc.38 engine
      // byte for byte, event stream included.
      if (!absencesOn) return;
      var a = { absent: [], count: 0 };
      try {
        a = PJ2.Voice.absences({
          root: run.master, evening: n,
          eligible: ABSENT_ELIGIBLE, previous: run.lastAbsent || [],
        }) || a;
      } catch (e) { a = { absent: [], count: 0 }; }
      run.absent = a.absent || [];
      run.lastAbsent = run.absent;
      var labels = [];
      for (var i = 0; i < run.absent.length; i++) labels.push(layerLabel(run.absent[i]));
      run.cast = { evening: n, plain: (n <= 1), absent: run.absent.slice(), absentLabels: labels };
      run.castPending = {
        type: "cast", evening: n, plain: (n <= 1),
        absent: run.absent.slice(), absentLabels: labels, t: t,
      };
    }

    // ------------------------------------------------------------------
    // THE WANDER (rc.36 — plan §11). Every ranged read in every render body
    // goes through wv(): it asks PJ2.Voice.wander for the layer's value of
    // that knob, dispatching on the def's own `per` — TOUCH a fresh draw
    // every sounding, CHARACTER one value for the evening, WEATHER a slow
    // drift deterministic in t — and records min/max for the harness. The
    // desk knob stays the CENTRE; the layer's `vary` knob (0–2, def 1)
    // scales the half-width, and at vary 0 the helper returns the knob
    // exactly, which is what makes this build rc.33 bit for bit.
    //
    // Every draw lands on the helper's OWN forks ("wander:<layer>:touch",
    // ":weather", ":dress:<n>"), so not one existing stream is re-rolled.
    // A def without `per` (presence, register, updown, flourish — the entry
    // laws) is fixed and wv() is simply pVal.
    // ------------------------------------------------------------------
    var WLOG_DRESS_MAX = 400;     // the dress log is telemetry, not memory

    function wrec(layer, key, v) {
      if (!run || !run.wlog || typeof v !== "number" || !isFinite(v)) return;
      var L = run.wlog.draws[layer] || (run.wlog.draws[layer] = {});
      var e = L[key];
      if (!e) { L[key] = { n: 1, min: v, max: v }; return; }
      e.n++;
      if (v < e.min) e.min = v;
      if (v > e.max) e.max = v;
    }
    // The one door every ranged body read uses. `t` is the note's SCHEDULE
    // time on the CLOCK; the weather wants SONG time, so t0 comes off here —
    // the same subtraction wxAt does, and for the same reason: a run must
    // sound the same whatever the AudioContext's clock happened to read when
    // it started. (Touch and character ignore t entirely.)
    function wv(layer, key, t) {
      var w = run && run.wander ? run.wander[layer] : null;
      var tt = (run && run.t0 != null && typeof t === "number") ? (t - run.t0) : 0;
      var v;
      if (w) { try { v = w.value(key, tt); } catch (e) { v = pVal(layer, key); } }
      else v = pVal(layer, key);
      if (typeof v !== "number" || !isFinite(v)) v = pVal(layer, key);
      wrec(layer, key, v);
      return v;
    }
    // Re-draw every character value. Ariel has no evening cast, so this is
    // called at play (evening 0) and at every performance-begin — the seam's
    // re-grounding moment, counted across the seam.
    function dressAll(n) {
      if (!run || !run.wander) return;
      for (var lk in run.wander) {
        var w = run.wander[lk];
        try { w.dress(n); } catch (e) { continue; }
        var defs = LAYER_PARAMS[lk];
        for (var i = 0; i < defs.length; i++) {
          if (defs[i].per !== "character") continue;
          var v;
          try { v = w.character(defs[i].key); } catch (e2) { continue; }
          if (run.wlog && run.wlog.dress.length < WLOG_DRESS_MAX) {
            run.wlog.dress.push({ evening: n, layer: lk, key: defs[i].key, value: v });
          }
        }
      }
    }
    function mixEff(key) {
      var st = mixState[key];
      return st ? (st.muted ? 0 : st.volume) : 1;
    }
    function mixValAt(e, t) {
      if (t >= e.t1) return e.v1;
      if (t <= e.t0) return e.v0;
      return e.v0 + (e.v1 - e.v0) * ((t - e.t0) / (e.t1 - e.t0));
    }
    function mixApply(key, rampS) {
      if (!run || !run.live || !run.mix || !run.mix[key]) return;
      var t = run.clock.now();
      var eff = mixEff(key);
      var list = run.mix[key];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var cur = mixValAt(e, t);
        var target = e.design * eff;
        try {
          var g = e.p;
          if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
          g.setValueAtTime(cur, t);     // anchor (click-safe rule)
          g.linearRampToValueAtTime(target, t + rampS);
        } catch (err) {}
        e.v0 = cur; e.t0 = t; e.v1 = target; e.t1 = t + rampS;
      }
    }
    // Melodic voices route pool seats through their layer's per-seat wrap;
    // unknown key or missing wrap falls back to the bare seat (a mixer
    // wiring gap must never silence a note).
    function mixOut(key, slotIn) {
      var w = run && run.mixWraps && run.mixWraps[key];
      if (!w) return slotIn;
      var i = w.slots.indexOf(slotIn);
      return (i >= 0) ? w.wraps[i] : slotIn;
    }
    // Rate write-through (MIX_RATE_LANES; pj2-library's note is
    // authoritative): stamps the stored rate onto the layer's live lanes;
    // a rate equal to the lane's current rate no-ops inside the clock.
    function mixRateApply(key) {
      if (!run || !run.live) return;
      var names = MIX_RATE_LANES[key];
      if (!names || !names.length) return;
      var r = mixState[key].rate;
      for (var i = 0; i < names.length; i++) {
        try { run.clock.lane(names[i]).rate = r; } catch (e) {}
      }
    }

    // Weather reads: schedule-time t, RUN-RELATIVE (the Library's hard-won
    // lesson — the absolute clock's zero is an accident of ctx birth).
    var WX_NEUTRAL = { gustiness: 0.5, altitude: 0.5, shimmer: 0.5, thermals: 0.5 };
    function wxAt(t) {
      if (run && run.weather) {
        try { return run.weather.at(t - run.t0); } catch (e) {}
      }
      return WX_NEUTRAL;
    }
    // thermals → gap multiplier, hard-bounded [0.85, 1.15] by construction.
    function gmAt(t) {
      return 0.85 + 0.3 * wxAt(t).thermals;
    }

    function degClass(d) {
      var n = (run && run.field && run.field.size) || 7;
      return ((d % n) + n) % n;
    }
    // The breeze/bass keep their roots low: roots above the mode midpoint
    // voice from below (vii sits a step under the tonic, not a seventh up).
    function foldRootLow(rootDeg) {
      var n = (run && run.field && run.field.size) || 7;
      var r = ((Math.round(rootDeg) % n) + n) % n;
      return (r > n / 2) ? r - n : r;
    }

    function reqCtx(t) {
      return { sceneType: curSceneType(), x: curSceneX(), tidePos: curTidePos(), nowS: t };
    }

    // ---- THE SCENE ROSTER (rc.33) -------------------------------------------
    // Ariel's scene types ARE the roster's columns (no ordinals to count: an
    // Ariel evening's songs and flights are peers, not numbered chapters), so
    // the column is simply the scene. Pure reads — no draws, ever.
    function rosterColumn(sceneTypeOverride) {
      return sceneTypeOverride || curSceneType();
    }
    // The gate. ALWAYS called AFTER the opportunity's unconditional roll: the
    // roster decides whether a voice ENTERS, never how the dice fall. A
    // gesture that leans into another scene is judged by where it SOUNDS —
    // pass that scene as the override.
    function rosterAllows(voiceKey, columnOverride) {
      var row = SCENE_ROSTER[voiceKey];
      if (!row) return true;
      var col = columnOverride || rosterColumn();
      for (var i = 0; i < ROSTER_COLS.length; i++) {
        if (ROSTER_COLS[i] === col) return !!row[i];
      }
      return true;
    }

    // ========================================================================
    // THE ARIEL DRAMATURGY (Conductor contract). The numbers, argued:
    //
    //   plan: durS = 240 + 360·(0.7·u + 0.3·(1−tide)) — 4–10 min, GALE
    //   SHORTENS (the reverse of the Library: rough weather aloft means a
    //   shorter errand). Pair count 2/3/4 as durS crosses 360 s/480 s. Hover
    //   present p = 0.75 − 0.35·tide (~60% average, near-certain in still
    //   air); swirl p = 0.3 + 0.4·tide (~50%, up to ~0.7 in a gale — the
    //   plan's tide-gate). Gale also lengthens the flight draws +20%·tide
    //   before the final budget scaling.
    //
    //   curves (x = progress, tp = tide):
    //     alighting 0.04 + 0.26·smoothstep(x)          bloom to ~0.30
    //     song      0.335 + 0.07·tp + 0.035·sin(2πx)   plateau 0.30–0.44
    //     flight    0.35 + 0.22·sin(πx)                peak 0.57 ≤ 0.60
    //     hover     0.12 + 0.10·(1−x)^1.3              the still scene
    //     swirl     0.42 + 0.23·sin(πx)                peak 0.65, the ceiling
    //     release   0.05 + 0.20·(1−x)^1.3              decays as it RISES
    //
    //   airLimit 2 in song AND flight, 1 elsewhere; overlapChance per plan.
    //
    //   joints: with 7–11 boundaries per evening (vs the Library's 5–8) the
    //   vocabulary leans even harder on nothing (~40%) and the breeze-dip;
    //   the gust is Ariel's third gesture; ONE chime ping is reserved for
    //   entering hover or release ("the air goes still"), degrading to a
    //   breath anywhere else.
    // ========================================================================
    var ACTIVITY = {
      "alighting": [["landing", 3], ["folding-wings", 2]],
      "song":      [["singing", 5], ["calling", 2]],
      "flight":    [["darting", 4], ["scattering", 3]],
      "hover":     [["hovering", 3], ["listening", 2]],
      "swirl":     [["swirling", 1]],
      "release":   [["ascending", 1]],
    };
    function pickActivity(rng, type) {
      var pool = ACTIVITY[type];
      return pool ? rng.pickW(pool) : type;
    }

    var dram = {
      name: "ariel",
      durationRangeS: [240, 600],

      plan: function (rng, tidePos) {
        var tp = clamp(tidePos || 0, 0, 1);
        var durS = 240 + 360 * (0.7 * rng.next() + 0.3 * (1 - tp));
        var nPairs = (durS < 360) ? 2 : (durS < 480 ? 3 : 4);
        var hasHover = rng.chance(0.75 - 0.35 * tp);
        var hasSwirl = rng.chance(0.3 + 0.4 * tp);
        // Scene durations by WEIGHTED APPORTIONMENT of the drawn budget
        // (weight × jitter, normalized below) rather than independent draws
        // scaled to fit: a crowded evening shortens every scene
        // PROPORTIONALLY, so no scene can collapse under the continuity
        // floor — a flight squeezed below ~20 s would push its half-sine's
        // edge slope past the ≤0.02-per-half-second weather ruler, and
        // "nothing startles" outranks the raw ranges. Resulting spans:
        // alighting ~30–50 s, songs ~45–75, flights ~25–45 (gale +20%),
        // hover/swirl ~35–55, release ~40–65 — the plan's shape at every
        // evening length.
        var scenes = [];
        function add(type, w, mul) {
          scenes.push({
            type: type,
            durS: w * rng.rnd(0.9, 1.15) * (mul || 1), // a weight, for now
            activity: pickActivity(rng, type),
          });
        }
        add("alighting", 1.3);
        for (var i = 0; i < nPairs; i++) {
          add("song", 1.8);
          add("flight", 1.05, 1 + 0.2 * tp); // gale stretches the darting
        }
        if (hasHover) add("hover", 1.4);
        if (hasSwirl) add("swirl", 1.4);
        add("release", 1.5);
        var raw = 0;
        for (i = 0; i < scenes.length; i++) raw += scenes[i].durS;
        var k = durS / raw; // land exactly on the drawn budget
        for (i = 0; i < scenes.length; i++) scenes[i].durS *= k;
        return scenes;
      },

      scenes: {
        "alighting": {
          intensity: function (x, tp) {
            return clampI(0.04 + 0.26 * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.05,
          activityWeights: ACTIVITY["alighting"],
        },
        "song": {
          intensity: function (x, tp) {
            return clampI(0.335 + 0.07 * (tp || 0) + 0.035 * Math.sin(2 * Math.PI * clamp(x, 0, 1)));
          },
          airLimit: 2, overlapChance: 0.2,
          activityWeights: ACTIVITY["song"],
        },
        "flight": {
          intensity: function (x, tp) {
            return clampI(0.35 + 0.22 * Math.sin(Math.PI * clamp(x, 0, 1)));
          },
          airLimit: 2, overlapChance: 0.25,
          activityWeights: ACTIVITY["flight"],
        },
        "hover": {
          intensity: function (x, tp) {
            return clampI(0.12 + 0.10 * Math.pow(1 - clamp(x, 0, 1), 1.3));
          },
          airLimit: 1, overlapChance: 0.08,
          activityWeights: ACTIVITY["hover"],
        },
        "swirl": {
          intensity: function (x, tp) {
            return clampI(0.42 + 0.23 * Math.sin(Math.PI * clamp(x, 0, 1)));
          },
          airLimit: 1, overlapChance: 0.12,
          activityWeights: ACTIVITY["swirl"],
        },
        "release": {
          intensity: function (x, tp) {
            // Intensity DECAYS while register RISES — the dissolution is
            // upward, not louder (the whole §1c contract lives in the
            // voices, not in this curve).
            return clampI(0.05 + 0.20 * Math.pow(1 - clamp(x, 0, 1), 1.3));
          },
          airLimit: 1, overlapChance: 0.04,
          activityWeights: ACTIVITY["release"],
        },
      },

      // At most ONE quiet event per boundary; ~40% of draws are nothing (more
      // boundaries than the Library, not more events). Uses Ariel's own
      // "joints" fork so the gesture sequence never depends on the room's
      // busyness. Returns the gesture label (the conductor attaches it as
      // `did`), null for a silent boundary.
      joint: function (fromType, toType, t, intensity, tools) {
        if (!run || !run.live) return null;
        var draw = run.streams.joints.pickW([
          ["nothing", 40], ["breath", 32], ["gust", 20], ["ping", 8],
        ]);
        // The lone ping means "the air goes still" — entering hover or the
        // release only; anywhere else it would read as an event.
        if (draw === "ping" && toType !== "hover" && toType !== "release") {
          draw = "breath";
        }
        emitEvent({ type: "joint-gesture", gesture: draw, from: fromType, to: toType, t: t });
        if (draw === "nothing") return null;
        try {
          if (draw === "breath") jointBreath(t);
          else if (draw === "gust") renderGust(t, run.streams.joints.rnd(3.5, 5.5), 0.014, run.streams.joints, "joint");
          else if (draw === "ping") jointPing(t);
        } catch (e) { return null; /* a failed joint is silence — a valid joint */ }
        return draw;
      },

      chainOverlapS: [6, 14],
      tide: {
        periodPerfs: [3, 6],
        labels: ["still-air", "rising-thermals", "gale", "clearing"],
      },
    };

    // ========================================================================
    // JOINT GESTURES — quiet, one per boundary at most.
    // ========================================================================

    // (a) breeze-breath: the pad dips ~2 dB over 4 s and re-blooms. Dedicated
    // gain stage (breezeBreath) so it never fights the intensity follower.
    function jointBreath(t) {
      var g = run.breezeBreath.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(0.79, t + 2);
      g.linearRampToValueAtTime(1, t + 4);
    }

    // (b) the gust — Ariel's signature joint AND ambient one-shot AND the
    // release's exhale: band-passed noise whose center sweeps low → high →
    // settles, a shaped breath of wind (v1 arielBreezeGust ~5506, stretched).
    // Landscape: no air, just budget. `who` labels the note event.
    function renderGust(t, durS, peak, rng, who) {
      var startF = rng.rnd(150, 350);
      var peakF = rng.rnd(550, 1175);
      var tok = run.budget.claim(3, t + durS + 0.2);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var src = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(startF, t);
      bp.frequency.linearRampToValueAtTime(peakF, t + durS * 0.4);
      bp.frequency.linearRampToValueAtTime(startF * 1.5, t + durS);
      bp.Q.setValueAtTime(2, t);
      var g = c.createGain();
      src.connect(bp); bp.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[durS * 0.3, peak], [durS * 0.4, peak * 0.7], [durS * 0.3, 0]]);
      src.start(t, src.randomOffset);
      src.stop(t + durS + 0.1);
      emitNote({ voice: who || "gust", kind: "gust", freq: null, t: t, durS: durS });
    }

    // (c) ONE chime ping, low in the mix — pitch from the field like
    // everything else (degree 1 or 4 an octave up: G5 or C6, hour tones aloft).
    function jointPing(t) {
      var c = ctx;
      var tok = run.budget.claim(3, t + 3.2);
      if (!tok) return;
      run.tokens.push(tok);
      var co = run.streams.joints.pick([[1, 1], [4, 1]]);
      var freq = run.field.degFreq(co[0], co[1]);
      var o = c.createOscillator();
      var wave = bellWave(c);
      if (wave && typeof o.setPeriodicWave === "function") o.setPeriodicWave(wave);
      else o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      var g = c.createGain();
      o.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.004, 0.02], [2.6, 0.0012], [0.4, 0]]);
      o.start(t);
      o.stop(t + 3.1);
      emitNote({ voice: "joint", kind: "ping", freq: freq, t: t, durS: 3, deg: co[0], oct: co[1] });
    }

    // ========================================================================
    // PERIODIC WAVES — cached per ctx, guarded to the teeth (a mock without
    // createPeriodicWave gets plain sine/triangle fallbacks). Deterministic:
    // fixed harmonic recipes, no draws.
    //   flute: strong fundamental, a breath of 2nd/3rd — v1's fluteWave.
    //   bell:  bright fan (1, .5, .22, .12, .06) — v1's bellWave stand-in.
    // ========================================================================
    function makeWave(c, key, partials) {
      try {
        if (typeof c.createPeriodicWave !== "function" || typeof Float32Array === "undefined") return null;
        var cache = c.__pj2ArielWaves = c.__pj2ArielWaves || {};
        if (cache[key]) return cache[key];
        var n = partials.length + 1;
        var real = new Float32Array(n);
        var imag = new Float32Array(n);
        for (var i = 0; i < partials.length; i++) imag[i + 1] = partials[i];
        cache[key] = c.createPeriodicWave(real, imag);
        return cache[key];
      } catch (e) { return null; }
    }
    function fluteWave(c) { return makeWave(c, "flute", [1, 0.28, 0.08, 0.02]); }
    function bellWave(c) { return makeWave(c, "bell", [1, 0.5, 0.22, 0.12, 0.06]); }

    // ---- beats → seconds (the Library's mapper, verbatim semantics) --------
    function phraseTiming(m, spb, ringK, minD, maxD) {
      var offs = [], durs = [], span = 0;
      for (var i = 0; i < m.notes.length; i++) {
        offs.push(span);
        var b = (+m.notes[i].durBeats > 0) ? +m.notes[i].durBeats : 1;
        durs.push(clamp(b * spb * ringK, minD, maxD));
        span += b * spb;
      }
      return { offs: offs, durs: durs, spanS: offs[offs.length - 1] + durs[durs.length - 1] };
    }

    // THE ASCENT RATCHET (§1c move 1, made structural): during the release
    // each melodic phrase may only enter AT OR ABOVE the register the scene
    // has already reached — a phrase whose mean degree would undercut the
    // floor is lifted by whole octaves (contour and degree classes intact,
    // so chord-tone endings survive) until it clears, and the floor then
    // rises to wherever the phrase landed (capped near deg 21, the +3-octave
    // ceiling — the sky has a top). Deterministic and drawless: the climb is
    // ENFORCED, not hoped for — register noise in the motif walks can never
    // hand the release a descending phrase.
    var RELEASE_FLOOR_CAP = 21;
    function releaseClimb(m, lift) {
      if (curSceneType() !== "release") return lift;
      var size = run.field.size;
      var mean = 0;
      for (var i = 0; i < m.notes.length; i++) mean += m.notes[i].deg;
      mean = mean / m.notes.length + lift;
      if (run.releaseDegFloor != null) {
        while (mean < run.releaseDegFloor - 0.01 && mean + size <= RELEASE_FLOOR_CAP + size) {
          lift += size; mean += size;
          if (mean >= RELEASE_FLOOR_CAP) break;
        }
      }
      // The floor rises PAST the landing (+1.5 degrees): the next phrase
      // must clear it, and since clearing happens in whole octaves the
      // release becomes a genuine staircase — each successive statement a
      // rung higher, "to the elements be free" enforced by arithmetic.
      var newFloor = Math.min(mean + 1.5, RELEASE_FLOOR_CAP);
      if (run.releaseDegFloor == null || newFloor > run.releaseDegFloor) {
        run.releaseDegFloor = newFloor;
      }
      return lift;
    }

    // ---- narration (the motif engine emits nothing; the track narrates) ----
    function narrate(res, voiceName, t) {
      var m = res.motif;
      if (res.kind === "develop") {
        emitEvent({
          type: "develop", voice: voiceName, name: m.name, gen: m.gen,
          transform: (m.chain && m.chain.length) ? m.chain[m.chain.length - 1] : null, t: t,
        });
      } else if (res.kind === "answer") {
        emitEvent({ type: "answer", voice: voiceName, name: m.name, gen: m.gen, t: t });
      } else if (res.kind === "ghost") {
        emitEvent({
          type: "ghost", voice: voiceName, name: m.name, t: t,
          promoted: !!(run.signature && run.signature.promoted && run.signature.name === m.name),
        });
      }
    }

    // Ledger supply: after a statement a voice may post (the engine owns the
    // odds); ghost statements post nothing themselves — but see driveSignature
    // for the PROMOTED ghost's ledger engine. Flutter never posts (it
    // decorates, it doesn't argue).
    function maybePost(voiceName, res, sceneType, t) {
      if (res.kind === "ghost" || voiceName === "flutter") return;
      try { run.motif.maybePost(voiceName, res.motif, { sceneType: sceneType, nowS: t }); } catch (e) {}
    }

    // THE PROMOTION ENGINE (header AS-BUILT NOTE): on promotion nights the
    // ghost line is DRIVEN — its statement is posted as a develop obligation,
    // and every subsequent utterance in the line is re-posted with p≈0.45.
    // All draws on the dedicated "ghost" fork; posts come "from" the pseudo
    // voice "seam" so every real speaker may claim them. This is what makes
    // the promoted ghost the evening's most-developed line (its deepest
    // descendant is then what extractGhost carries onward — the same bird).
    function driveSignature(res, t) {
      var sig = run.signature;
      if (!sig || !sig.promoted || !res || !res.motif) return;
      if (res.motif.name !== sig.name) return;
      var g = run.streams.ghost;
      if (res.kind === "ghost") {
        try { run.motif.post("seam", "develop", res.motif, t + g.rnd(10, 20)); } catch (e) {}
      } else if (g.chance(0.45)) {
        try { run.motif.post("seam", "develop", res.motif, t + g.rnd(8, 18)); } catch (e) {}
      }
    }

    // ========================================================================
    // THE HARMONY LANE — the grammar's pulse, 10–22 s (faster than the
    // Library's 14–30: Ariel converses quicker), scene-scaled (slower in
    // hover/release), each step arming the bass's arrival gesture (v1's
    // arielBassPendingArrival, kept: the bass plants each new center's root).
    // ========================================================================
    function startHarmonyLane() {
      var lane = run.clock.lane("harmony");
      var rng = run.streams.harmonyLane;
      function periodAt(t) {
        var st = curSceneType();
        var iv = curIntensity(t);
        var base = (st === "hover") ? 0.75
          : (st === "release") ? 0.8
          : (st === "alighting") ? 0.7
          : (st === "flight") ? 0.3
          : (st === "swirl") ? 0.25
          : 0.45;
        var pos = clamp(base + (rng.next() - 0.5) * 0.5 - 0.25 * iv, 0, 1);
        return 10 + 12 * pos;
      }
      function stepFn(t) {
        try {
          run.harmony.step(t);
          run.bassArrival = true; // the bass answers every new center
          // rc.33: the alighting's steps, counted (no draws) — the
          // vibraphone's law is "the first two steps and no more", and a
          // counter off the harmony lane is exact where a poll would guess.
          if (curSceneType() === "alighting") run.alightSteps++;
        } catch (e) { /* a stuck chord is still a chord */ }
        lane.at(t + periodAt(t), stepFn);
      }
      lane.at(run.t0 + periodAt(run.t0), stepFn);
    }

    // ========================================================================
    // CADENCES THAT LIFT. Kind-by-context pools (lift into flights, float
    // into hover/release/the seam, up-half as the mid-evening comma), drawn
    // for ~50–65% of boundaries (restraint — Ariel has many boundaries).
    //
    // THE RISING VOICING, by construction: the approach chord is voiced by
    // harmony.voiceConsort (least motion, per-id state); the ARRIVAL voicing
    // is the approach with every part climbed to the nearest arrival-chord
    // tone STRICTLY ABOVE it. For lift (I→II) and float (II→I) the chord
    // classes sit a degree apart, so the climb is a parallel step up; for
    // up-half it is at most a third. Every Ariel cadence therefore arrives
    // ABOVE its approach — "a cadence that opens a door" — and the float's
    // "falls a step, rises in register" is literal. Drawless, deterministic.
    // ========================================================================
    var CONSORT_LO = -3, CONSORT_HI = 9; // ~C4..D6 in F-lydian degrees — the air's shelf

    function climbAbove(fromDegs, chord) {
      var classes = {};
      var cds = (chord && chord.chordDegs) ? chord.chordDegs : [0, 2, 4];
      for (var i = 0; i < cds.length; i++) classes[degClass(cds[i])] = 1;
      var out = [];
      for (i = 0; i < fromDegs.length; i++) {
        var d = fromDegs[i] + 1;
        var guard = 0;
        while (guard++ < 8 && (!classes[degClass(d)] || (out.length && d <= out[out.length - 1]))) d++;
        out.push(d);
      }
      return out;
    }

    // One consort chord on the aeolian body (bowed glass — slow attacks,
    // nothing can transient), at cadence loudness. Peak 0.014/part sits under
    // the breeze's reading; the ≤1.5 dB lift contract holds by construction.
    function renderConsort(degs, t, durS, fadeIn, fadeOut) {
      if (!degs || !degs.length) return;
      var tok = run.budget.claim(2 * degs.length + 1, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (durS - fadeIn - fadeOut < 0.3) {
        fadeIn = fadeOut = Math.max(0.25, (durS - 0.3) / 2);
      }
      var g = c.createGain();
      g.connect(run.layAeo);
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], 0); // read at schedule time
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(i % 2 ? 4 : -4, t);
        var og = c.createGain();
        og.gain.setValueAtTime(0.014, t);
        o.connect(og); og.connect(g);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "aeolian", kind: "consort", freq: freq, t: t, durS: durS, deg: degs[i], oct: 0 });
      }
      PJ2.Voice.env(g.gain, t, [[fadeIn, 1], [durS - fadeIn - fadeOut, 1], [fadeOut, 0]]);
    }

    // One cadence dyad on the breeze's own body (quiet triangle root+5th into
    // the breezeBreath chain — the ground moving through the two chords).
    function cadenceBreezePad(chord, t, durS, fadeIn, fadeOut) {
      var tok = run.budget.claim(4, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (durS - fadeIn - fadeOut < 0.3) {
        fadeIn = fadeOut = Math.max(0.25, (durS - 0.3) / 2);
      }
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(300, t);
      lp.Q.setValueAtTime(0.5, t);
      lp.connect(run.breezeBreath);
      var root = foldRootLow(chord.rootDeg);
      var degs = [root, root + 4];
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], -1);
        var o = c.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(lp);
        PJ2.Voice.env(g.gain, t, [[fadeIn, 0.011], [durS - fadeIn - fadeOut, 0.011], [fadeOut, 0]]);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "breeze", kind: "cadence", freq: freq, t: t, durS: durS, deg: degs[i], oct: -1 });
      }
    }

    // ---- harmony-readout spelling (display only) -------------------------------
    // The margin readout (PLAN-HARMONY-READOUT) spells what the harmony brain
    // is doing. Pure observation of existing run state — no draws, no
    // scheduling influence; the determinism guard is kept by construction.
    // Flat-spelled pitch-class names, lowercase.
    var PC_NAMES = ["c", "d♭", "d", "e♭", "e", "f", "g♭", "g", "a♭", "a", "b♭", "b"];
    function pcNameForHz(hz) {
      var pc = ((Math.round(69 + 12 * Math.log(hz / 440) / Math.LN2) % 12) + 12) % 12;
      return PC_NAMES[pc];
    }
    // The current chord's tones, spelled: current() already carries the
    // degree set, so the harmony API grows not at all.
    function spellChordTones(chordDegs) {
      var out = [];
      for (var i = 0; i < chordDegs.length; i++) {
        out.push(pcNameForHz(run.field.degFreq(chordDegs[i], 0)));
      }
      return out.join(" ");
    }
    // The sea change's target in words. A reroot's concrete root/mode exist
    // only AFTER execution (resolved from the live field); the true change
    // (Ariel's own, 3:1) is the subdominant lift ("+P4").
    function seaChangeLabel(target, res) {
      if (res && res.to && isFinite(res.to.tonicHz)) {
        return pcNameForHz(res.to.tonicHz) + " " + res.to.mode;
      }
      if (target && target.kind === "true") return "+P4";
      if (target && target.kind === "ratio") return target.name || null;
      return null;
    }

    function cadenceChanceFor(fromType, toType, isSeam) {
      if (isSeam) return 0.7;                       // the float home under the seam
      if (toType === "hover" || toType === "release") return 0.75;
      if (toType === "flight") return 0.6;          // the lift opens the door
      if (fromType === "alighting") return 0.25;    // rarely straight out of landing
      if (toType === "song") return 0.55;
      return 0.5;
    }
    function cadenceKindPool(fromType, toType, isSeam) {
      if (isSeam || toType === "hover" || toType === "release") {
        return [["float", 7], ["lift", 2], ["up-half", 1]];
      }
      if (toType === "flight") {
        return [["lift", 8], ["up-half", 2]];
      }
      if (toType === "song") {
        return [["up-half", 5], ["lift", 4], ["float", 1]];
      }
      return [["lift", 5], ["up-half", 4], ["float", 1]];
    }

    var CADENCE_LEAD_S = 12; // scenes are short; harmony's 9–13 s act is scaled inside

    function realizeCadence(plan) {
      if (run) run.nextCadence = null; // realized or moot — the readout moves on
      if (!run || !run.live) return;
      var cad = null;
      try { cad = run.harmony.cadence(plan.kind); } catch (e) { cad = null; }
      if (!cad || !cad.chords || cad.chords.length < 2) return;
      var tB = plan.tB;
      var c1 = cad.chords[0], c2 = cad.chords[1];
      var dA = clamp((+c1.durS > 0) ? +c1.durS : 5, 3, 9);
      var dB = clamp((+c2.durS > 0) ? +c2.durS : 4, 3, 9);
      if (dA + dB > CADENCE_LEAD_S - 0.2) {
        var k = (CADENCE_LEAD_S - 0.2) / (dA + dB);
        dA *= k; dB *= k;
      }
      var X = 1.2, RING = 2.5;
      var tA = tB - (dA + dB);
      var tArr = tB - dB;
      // Approach voicing by least motion; arrival CLIMBED above it (see the
      // section note). The consort id keeps the seat across cadences.
      var vA = null;
      try {
        vA = run.harmony.voiceConsort(plan.nParts, {
          id: "cadence", lo: CONSORT_LO, hi: CONSORT_HI,
          chord: { rootDeg: c1.rootDeg, chordDegs: c1.chordDegs ? c1.chordDegs.slice() : null },
        });
      } catch (e) { vA = null; }
      if (!vA || !vA.length) vA = [c1.rootDeg, c1.rootDeg + 2, c1.rootDeg + 4].slice(0, plan.nParts);
      var vB = climbAbove(vA, c2);
      // rc.33 — THE CONCERTINA TAKES THE CONSORT. One draw, before anything
      // is rendered, so the concertina's fork never depends on what the
      // aeolian did. When it lands, the box voices BOTH chords in the
      // consort's place as a dyad taken from the consort's OWN voicing, so
      // the arrival keeps its rise; the breeze's cadence pads are untouched
      // and the arrival still lands exactly on the boundary. The box's dyad
      // sits at CONC_CADENCE_LEVEL under the consort it replaces, so the
      // cadence contract (no new attack louder than the consort's) holds by
      // arithmetic. This is also the ONE door the concertina takes at a
      // cadence: the lyre's roll is the other, 0.4 s later.
      var concTakes = concertinaTakesCadence(plan, tA);
      var concOct = Math.round(pVal("concertina", "register"));
      var pdRateA = 1 / 4, pdRateB = 1 / 3.5;  // drawless: a taken cadence
                                               // borrows the consort's clock
      cadenceBreezePad(c1, tA, dA + X, 2.2, X);
      if (concTakes) {
        concTakes = renderConcertina(consortDyad(vA), concOct, tA, dA + X, 2.0, X,
                                     CONC_CADENCE_LEVEL, pdRateA, "consort");
      }
      if (!concTakes) renderConsort(vA, tA, dA + X, 2.0, X);
      cadenceBreezePad(c2, tArr, dB + RING, X, RING);
      if (concTakes) {
        renderConcertina(consortDyad(vB), concOct, tArr, dB + RING, X, 2.0,
                         CONC_CADENCE_LEVEL, pdRateB, "consort");
        run.concHoldUntil = tArr + dB + RING + 6;
      } else {
        renderConsort(vB, tArr, dB + RING, X, 2.0);
      }
      // …and the lyre may answer the LIFT 0.4 s past the arrival's onset —
      // the second door, and never the same one the concertina took.
      lyreCadence(tArr, cad.kind || plan.kind);
      var meanA = 0, meanB = 0, i;
      for (i = 0; i < vA.length; i++) meanA += vA[i] / vA.length;
      for (i = 0; i < vB.length; i++) meanB += vB[i] / vB.length;
      emitEvent({
        type: "cadence", kind: cad.kind || plan.kind, t: tB,
        startT: tA, arriveT: tArr,
        from: plan.from, to: plan.to,
        chords: [c1.name != null ? c1.name : null, c2.name != null ? c2.name : null],
        approachMeanDeg: meanA, arrivalMeanDeg: meanB,
        arrivalAbove: meanB > meanA,
        voicedBy: concTakes ? "concertina" : "consort",   // rc.33
      });
    }

    // Called at each scene entry for the boundary the scene will END on.
    // Draws happen unconditionally (stream discipline).
    function planCadence(evt, toType, isSeam) {
      var rng = run.streams.cadence;
      var tB = evt.t + evt.durS;
      var roll = rng.next();
      var kind = rng.pickW(cadenceKindPool(evt.scene, toType, isSeam));
      var nParts = rng.rint(2, 3);
      if (roll >= cadenceChanceFor(evt.scene, toType, isSeam)) return;
      if (evt.durS < CADENCE_LEAD_S + 6) return; // too short to breathe before it
      var plan = { kind: kind, nParts: nParts, from: evt.scene, to: toType, tB: tB };
      run.clock.lane("cadence").at(tB - CADENCE_LEAD_S, function () { realizeCadence(plan); });
      // telemetry for the harmony readout: the approach, announced (the kind
      // words ARE Ariel's display labels — observation only, no draws)
      run.nextCadence = { kind: kind, label: kind, t: tB };
    }

    // ---- the sea change -----------------------------------------------------
    function scheduleSeaChange(tB) {
      run.clock.lane("seachange").at(tB, function (t) { executeSeaChangeAt(t); });
    }

    function executeSeaChangeAt(t) {
      if (!run || !run.live || !run.seaChange || run.seaChange.done) return;
      run.seaChange.done = true;
      var res = null;
      try { res = run.harmony.executeSeaChange(run.seaChange.target); } catch (e) { res = null; }
      run.seaChange.label = seaChangeLabel(run.seaChange.target, res); // the new ground, spelled
      seaChangePad(t);          // the breeze is the seam: new key blooms under the old tail
      run.haloRetuneAt = t;     // armed; the NEXT boundary retunes (never this one)
      emitEvent({
        type: "seachange", target: run.seaChange.target,
        pivotDegs: (res && res.pivotDegs) ? res.pivotDegs : null,
        field: { tonicHz: run.field.tonicHz, mode: run.field.mode },
        t: t,
      });
    }

    // One extra breeze cycle blooming the NEW key's dyad at the boundary
    // itself (chainOverlap pattern applied to a key) — the modulation arrives
    // as weather aloft, and it arrives UPWARD (oct 0, a lift over the bed).
    function seaChangePad(t) {
      var rng = run.streams.seachange;
      var durS = rng.rnd(16, 24); // drawn before the claim — stream discipline
      var tok = run.budget.claim(5, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(400, t);
      lp.Q.setValueAtTime(0.5, t);
      lp.connect(run.breezeBreath);
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var root = foldRootLow(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
      var degs = [root, root + 4];
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], 0); // the field is already the new world
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(lp);
        PJ2.Voice.env(g.gain, t, [[3.5, 0.04], [durS - 7, 0.04], [3.5, 0]]);
        o.start(t);
        o.stop(t + durS + 0.1);
        emitNote({ voice: "breeze", kind: "seachange", freq: freq, t: t, durS: durS, deg: degs[i], oct: 0 });
      }
    }

    // ---- room / thin / release choreography per scene entry ------------------
    function setSceneRoom(evt) {
      // Draw FIRST, unconditionally (stream discipline on the rooms fork).
      var rampS = run.streams.rooms.rnd(10, 16);
      var wx = wxAt(evt.t);
      var base = (ROOM_BALANCE[evt.scene] != null) ? ROOM_BALANCE[evt.scene] : 0.4;
      if (evt.scene === "release") {
        // The room opens: ramp toward the sky across most of the scene.
        run.roomBalance = ROOM_RELEASE_TARGET;
        try { run.roomBlend.setBalance(ROOM_RELEASE_TARGET, Math.max(rampS, evt.durS * 0.8)); } catch (e) {}
      } else {
        var bal = clamp(base + 0.1 * (wx.shimmer - 0.5), 0, 1);
        run.roomBalance = bal;
        try { run.roomBlend.setBalance(bal, rampS); } catch (e) {}
      }
    }

    function onSceneEvent(evt) {
      if (!run.perfScenes) return;
      var toIdx = evt.idx + 1;
      var isSeam = toIdx >= run.perfScenes.length;
      var toType = isSeam ? "alighting" : run.perfScenes[toIdx];
      var tB = evt.t + evt.durS;
      if (!isSeam && run.seaChange && !run.seaChange.done && run.seaChange.atSceneIdx === toIdx) {
        scheduleSeaChange(tB);
        return; // the modulation IS this boundary's event — no cadence on top
      }
      planCadence(evt, toType, isSeam);
    }

    function enterRelease(evt) {
      // The four coordinated moves' fixed parts (the voices carry the rest):
      // the thin cutoff rides up (echoes ascend as the music does), the delay
      // wet rises toward its cap (the last fragments mostly echo), 1–2 gust
      // exhales are planted, and the breeze's octave ladder resets to climb.
      run.breezeReleaseSteps = 0;
      run.releaseDegFloor = null; // the ratchet starts wherever the first phrase lands
      try { run.delayA.setThin(THIN_RELEASE, evt.durS * 0.7); } catch (e) {}
      try { run.delayA.setWet(0.38, evt.durS * 0.6); } catch (e) {}
      var g = run.streams.gust;
      var n = g.chance(0.6) ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var at = evt.t + evt.durS * (i === 0 ? g.rnd(0.45, 0.6) : g.rnd(0.78, 0.9));
        var durS = g.rnd(6, 8);
        (function (at2, d2) {
          run.clock.lane("release").at(at2, function (t) {
            renderGust(t, d2, 0.02, run.streams.gust, "gust");
          });
        })(at, durS);
      }
      emitEvent({ type: "release", t: evt.t, durS: evt.durS });
    }

    // ---- THE SEAM: performance-event wiring ----------------------------------
    function handleConductorEvent(evt) {
      if (!run || !run.live) return;
      try {
        if (evt.type === "performance" && evt.phase === "end") {
          try { run.pendingGhost = run.motif.extractGhost(); } catch (e) { run.pendingGhost = null; }
        } else if (evt.type === "performance" && evt.phase === "begin") {
          run.perfScenes = evt.scenes ? evt.scenes.slice() : null;

          // rc.36 — THE DRESSING. Ariel has no evening cast, so the seam's
          // re-grounding moment is where the instruments are re-drawn: a new
          // reed buzz, a new beating rate, a new motor speed, a new vibrato
          // rate. Counted across the seam, so evening n is evening n whether
          // or not the field had to come home.
          run.evening = (run.evening || 0) + 1;
          dressAll(run.evening);

          // rc.38 — …and TONIGHT'S CAST, the same seam, the same ordinal:
          // who is sitting this evening out. Evening one is always full.
          drawAbsences(run.evening, (evt.t != null) ? evt.t : run.clock.now());

          // THE RE-GROUNDING (§1c, owner-approved exactly): the field returns
          // home to F 349 lydian, atomically, at the seam — the ringing high
          // tail keeps its old-world Hz (straddle lesson), everything
          // scheduled after reads home. This is what retires the sea-change
          // tonic ratchet for Ariel. Skipped (and unnarrated) when the field
          // is already home — the first evening, and evenings that never
          // turned.
          var f = run.field;
          var wasAway = Math.abs(f.tonicHz - 349) > 0.01 || f.mode !== "lydian";
          if (wasAway) {
            var change = f.modulate({ tonicHz: 349, mode: "lydian" });
            run.haloRetuneAt = evt.t; // the strings come home at the next boundary
            emitEvent({ type: "reground", from: change.from, to: change.to, t: evt.t });
          }
          // The thin cutoff and the delay wet re-anchor low for the descent.
          try { run.delayA.setThin(THIN_HOME, 8); } catch (e) {}
          try { run.delayA.setWet(DELAY_A.wet, 8); } catch (e) {}

          // The feather: last release's final whistle degree becomes this
          // alighting's first chime ping (folded to the chime's shelf).
          run.featherPending = (run.featherDeg != null) ? run.featherDeg : null;
          run.featherDeg = null;

          // rc.33: the new evening's counters. The lyre's once-a-night door
          // reopens (the alighting's first chord is the feather's COUSIN, and
          // it belongs to every evening); the chord memories are cleared so
          // the first reading of the new world is a fresh reading, not a
          // step; the alighting's steps start over. Every hold/rest deadline
          // is left alone on purpose — a body still ringing across the seam
          // still holds its voice, which is the whole point of the seam.
          run.lyreAlightDone = false;
          run.lyreLastChord = null;
          run.concLastChord = null;
          run.vibLastChord = null;
          run.alightSteps = 0;

          // The working set, the ghost, and the promotion coin.
          try { run.motif.newPerformance(evt.tidePos); } catch (e) {}
          run.signature = { name: null, promoted: false };
          if (run.pendingGhost) {
            var gname = run.pendingGhost.name;
            try { run.motif.seedGhost(run.pendingGhost); } catch (e) {}
            // The coin is drawn ONLY on nights a ghost was carried — the
            // ghost fork's sequence stays independent of everything else.
            var promoted = run.streams.ghost.chance(0.5);
            if (promoted) run.signature = { name: gname, promoted: true };
            // Narrate the seam crossing itself (the statement, if the engine
            // wills one, comes later in the alighting): who crossed, and
            // whether tonight the same bird IS the signature.
            emitEvent({ type: "seam-ghost", name: gname, promoted: promoted, t: evt.t });
            run.pendingGhost = null;
          }

          // The sea change plan (harmony draws whether/where/what).
          run.seaChange = null;
          run.nextCadence = null;      // no approach rides across the seam
          try {
            var sceneList = [];
            if (evt.scenes) {
              for (var si = 0; si < evt.scenes.length; si++) sceneList.push({ type: evt.scenes[si] });
            }
            var sc = run.harmony.planSeaChange({ sceneList: sceneList, tidePos: evt.tidePos });
            if (sc && isFinite(sc.atSceneIdx) &&
                sc.atSceneIdx >= 1 && evt.scenes && sc.atSceneIdx < evt.scenes.length) {
              run.seaChange = { atSceneIdx: Math.floor(sc.atSceneIdx), target: sc.target, done: false,
                label: seaChangeLabel(sc.target, null) };
            }
          } catch (e) {}
        } else if (evt.type === "scene") {
          setSceneRoom(evt);
          // rc.33: an alighting is the one scene whose steps are counted (the
          // vibraphone's "first two"). Every evening has exactly one, at
          // index 0, but the reset is written against the SCENE and not the
          // performance so a future dramaturgy that alights twice would still
          // be told the truth.
          if (evt.scene === "alighting") run.alightSteps = 0;
          // Halo retune at the FIRST boundary strictly after a field change
          // (sea change or seam reground — the arming boundary itself shares
          // its t and is skipped; the old strings ring across, the straddle
          // lesson applied to resonance).
          if (run.haloRetuneAt != null && evt.t > run.haloRetuneAt + 0.5) {
            run.haloRetuneAt = null;
            try { run.halo.retune(haloFreqs(run.field)); } catch (e2) {}
          }
          if (evt.scene === "release") enterRelease(evt);
          onSceneEvent(evt);
        }
      } catch (e) { /* structure wiring must never stop the transport */ }
    }

    // ========================================================================
    // THE VOICES — all on self-rescheduling lane.at chains (pure arithmetic
    // from t0; .every's first fire would add tick-phase wobble).
    // ========================================================================

    // ---- breeze (landscape — THE SEAM) --------------------------------------
    // v1 arielBreeze ported: sine dyad + optional sub-octave triangle + 6 kHz
    // hiss mist, 15–25 s cycles, 3 s fades, 2–3 s overlaps; each cycle reads
    // harmony.current at its own start and keeps its Hz for life (chords
    // arrive as new pads under old ones — never a retuned sounding partial).
    // The F–B tritone survives as a p≈0.12 voicing flavor when the chord is I
    // (the pad itself occasionally breathing the #4). In the RELEASE each new
    // cycle voices one octave higher than the last and drops the sub — the
    // pad climbs by generational replacement, which is what the cycle
    // machinery already does. Its lane is never cancelled by boundaries.
    function startBreeze() {
      var lane = run.clock.lane("breeze");
      var rng = run.streams.breeze;
      function cycle(t) {
        // Every draw FIRST, unconditionally — a budget refusal or a scene
        // check must never shift the stream.
        var durS = rng.rnd(15, 25);
        var overlap = rng.rnd(2, 3);
        var hasSub = rng.chance(0.4);
        var tritone = rng.chance(0.12);
        var lfoR1 = rng.rnd(0.1, 0.3);
        var lfoR2 = rng.rnd(0.1, 0.3);
        var st = curSceneType();
        var inRelease = (st === "release");
        var iv = curIntensity(t);
        var wx = wxAt(t);
        // rc.36 — THE SEAM'S OWN RULE: the breeze varies by CHARACTER and
        // WEATHER only, and both are read HERE, at the cycle's start, and
        // held for the whole cycle. Nothing sounding is ever re-read: a new
        // sway depth arrives with a new pad, under the old one, exactly as a
        // new chord does. The 3 s fades are the "nothing startles" ruler and
        // are not ranged. Both spans stop AT the knob (0.75–1) on purpose —
        // the seam is the floor of the whole piece and the floor never rises.
        var breathK = wv("breeze", "breath", t);   // weather
        var hissK = wv("breeze", "hiss", t);       // character
        var tok = run.budget.claim(hasSub && !inRelease ? 10 : 8, t + durS + 0.3);
        if (!tok) {
          lane.at(t + 2, cycle); // the seam must not open: short-leash retry
          return;
        }
        run.tokens.push(tok);
        var c = ctx;
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        var rootAbs = foldRootLow(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
        var rootCls = degClass(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
        // The release ladder: -1 → 0 → 1 → 2, one rung per NEW cycle, capped
        // +2 octaves over home (fundamentals non-decreasing through the scene).
        var oct = -1;
        if (inRelease) {
          run.breezeReleaseSteps = Math.min(3, (run.breezeReleaseSteps || 0) + 1);
          oct = -1 + run.breezeReleaseSteps;
        } else {
          run.breezeReleaseSteps = 0;
        }
        // Dyad: root+5th; on I, the rare tritone breath (root + #4 — degree
        // 3 is a mode-third above... no: [0, 3] is F..B, the character pair).
        var degs = (tritone && rootCls === 0) ? [rootAbs, rootAbs + 3] : [rootAbs, rootAbs + 4];
        var lfoDepth = 0.03 * (0.6 + 0.8 * wx.gustiness) * breathK; // desk knob: def 1 = as-composed
        var rates = [lfoR1, lfoR2];
        for (var i = 0; i < degs.length; i++) {
          var freq = run.field.degFreq(degs[i], oct);
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(freq, t);
          var g = c.createGain();
          o.connect(g); g.connect(run.breezeBreath);
          PJ2.Voice.env(g.gain, t, [[3, 0.06], [durS - 6, 0.06], [3, 0]]);
          // Breathing LFO on the pad gain — born and dies with the cycle.
          try {
            var lfo = c.createOscillator();
            lfo.type = "sine";
            lfo.frequency.setValueAtTime(rates[i], t);
            var lg = c.createGain();
            lg.gain.setValueAtTime(lfoDepth, t);
            lfo.connect(lg);
            lg.connect(g.gain);
            lfo.start(t);
            lfo.stop(t + durS + 0.1);
          } catch (eL) {}
          o.start(t);
          o.stop(t + durS + 0.1);
          emitNote({ voice: "breeze", freq: freq, t: t, durS: durS, deg: degs[i], oct: oct });
        }
        if (hasSub && !inRelease) { // the ground lets go in the release
          var subF = run.field.degFreq(rootAbs, oct - 1);
          var so = c.createOscillator();
          so.type = "triangle";
          so.frequency.setValueAtTime(subF, t);
          var sg = c.createGain();
          so.connect(sg); sg.connect(run.breezeBreath);
          PJ2.Voice.env(sg.gain, t, [[3, 0.025], [durS - 6, 0.025], [3, 0]]);
          so.start(t);
          so.stop(t + durS + 0.1);
          emitNote({ voice: "breeze", kind: "sub", freq: subF, t: t, durS: durS, deg: rootAbs, oct: oct - 1 });
        }
        // The hiss mist — high-passed static, texture (no note event).
        var ns = PJ2.Voice.noiseBuffer.source(c, 30);
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(6000, t);
        hp.Q.setValueAtTime(0.7, t);
        var ng = c.createGain();
        ns.connect(hp); hp.connect(ng); ng.connect(run.breezeBreath);
        var airPeak = 0.004 * (0.5 + wx.gustiness) * hissK; // desk knob: def 1 = as-composed
        PJ2.Voice.env(ng.gain, t, [[3, airPeak], [durS - 6, airPeak], [3, 0]]);
        ns.start(t, ns.randomOffset);
        ns.stop(t + durS + 0.1);
        void iv;
        lane.at(t + (durS - overlap), cycle);
      }
      lane.at(run.t0, cycle);
    }

    // ---- whistle (melodic — the singer; claims THE AIR) ----------------------
    // v1's flute body (playArielWhistleNote ~5051): PeriodicWave + 5.5 Hz
    // vibrato + breathy 1800 Hz bandpass noise. Articulation flavor comes
    // from the MOTIF'S SHAPE (one brain, seven accents — see header).
    function renderWhistle(out, freq, t, durS, vel, art, wx) {
      var c = ctx;
      var o = c.createOscillator();
      var wave = fluteWave(c);
      if (wave && typeof o.setPeriodicWave === "function") o.setPeriodicWave(wave);
      else o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      // Expressive mid-note bend (loneTone habit): anchored linear ramps only.
      if (art && art.bendSemis) {
        var bf = Math.pow(2, art.bendSemis / 12);
        o.frequency.linearRampToValueAtTime(freq, t + durS * 0.35);
        o.frequency.linearRampToValueAtTime(freq * bf, t + durS * 0.55);
        o.frequency.linearRampToValueAtTime(freq, t + durS * 0.8);
      }
      // Vibrato — depth ramped in from zero (no cold wobble).
      var vib = c.createOscillator();
      vib.type = "sine";
      // rc.36: the RATE is the singer's own, drawn once per evening (4.8–6.2
      // Hz around v1's 5.5); the DEPTH is a fresh draw every note, on top of
      // the gustiness coupling AND the articulation's own depth — three
      // things multiplying, none of them replaced.
      vib.frequency.setValueAtTime((art && art.vibHz != null) ? art.vibHz : 5.5, t);
      var vg = c.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(
        ((art && art.vibDepth) || 2) * (0.8 + 0.6 * wx.gustiness) *
          ((art && art.vibK != null) ? art.vibK : pVal("whistle", "vibrato")),
        t + Math.min(0.35, durS * 0.3));
      vib.connect(vg);
      try { vg.connect(o.frequency); } catch (e1) {}
      // Breath — bandpass noise at 1800 Hz, Q 12 (pre-attenuated INTO the
      // resonance, pj2-voice lesson #2), dose breathing with shimmer.
      var ns = PJ2.Voice.noiseBuffer.source(c, 30);
      var pre = c.createGain();
      pre.gain.setValueAtTime(0.3, t);
      var nf = c.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.setValueAtTime((art && art.breathHz != null) ? art.breathHz : 1800, t);
      nf.Q.setValueAtTime(12, t);
      var bg = c.createGain();
      // the shimmer coupling KEPT, the phrase's own breath draw on top
      bg.gain.setValueAtTime((0.25 + 0.5 * wx.shimmer) *
        ((art && art.breathK != null) ? art.breathK : pVal("whistle", "breath")), t);
      ns.connect(pre); pre.connect(nf); nf.connect(bg);
      var mix = c.createGain();
      o.connect(mix);
      bg.connect(mix);
      mix.connect(out);
      mix.connect(run.haloSendWhistle);              // the strings hear the song (via its mixer stage)
      if (art && art.farWall) mix.connect(run.delaySendWhistle);
      // v1's A-S-R: slow attack (≤0.35 s), hold to 60%, release the rest.
      var peak = 0.028 * vel;
      var attack = Math.min(0.35, durS * 0.28);
      var susEnd = Math.max(attack + 0.05, durS * 0.6);
      PJ2.Voice.env(mix.gain, t, [[attack, peak], [susEnd - attack, peak], [durS - susEnd, 0]]);
      var stopAt = t + durS + 0.02;
      o.start(t); o.stop(stopAt);
      vib.start(t); vib.stop(stopAt);
      ns.start(t, ns.randomOffset);
      ns.stop(stopAt);
    }

    // Articulation from shape: v1's cluster builders as render accents.
    function whistleArticulation(m, rng) {
      var n = m.notes.length;
      var art = { vibDepth: 2, gains: null, holdLast: false, bendSemis: 0 };
      if (n === 1) {
        art.vibDepth = 4;                              // loneTone: deep vibrato
        if (rng.chance(0.35)) {                        // …and the 0.35 bend
          art.bendSemis = (rng.chance(0.5) ? -1 : 1) * rng.rnd(0.7, 1.2);
        }
        return art;
      }
      var rise = m.notes[n - 1].deg - m.notes[0].deg;
      if (rise >= 3) {
        art.holdLast = true;                           // climb: the final held
      } else if (rise <= -3) {
        art.gains = [];                                // sigh: diminuendo
        for (var i = 0; i < n; i++) art.gains.push(Math.max(0.5, 1 - i * 0.12));
      }
      for (i = 0; i < n; i++) {
        if (degClass(m.notes[i].deg) === 3) { art.vibDepth = 2.8; break; } // the #4 glows
      }
      return art;
    }

    function startWhistle() {
      var lane = run.clock.lane("whistle");
      var rng = run.streams.whistle;
      function phrase(t) {
        var iv = curIntensity(t);
        // rc.33: the roster rests the singer in flights and hovers (§6.3 —
        // the flight belongs to the clouds, the hover to the landscape). It
        // gates the ENTRY only: a phrase already sounding finishes, and the
        // reschedule draw is the same one the intensity gate takes, so the
        // whistle's fork is untouched by the gate itself.
        if (iv < 0.07 || !rosterAllows("whistle")) {
          lane.at(t + rng.rnd(3, 6) * gmAt(t) * presGap("whistle"), phrase);
          return;
        }
        var st = curSceneType();
        var x = curSceneX();
        // A ghost denied the air is HELD, never dropped.
        var res = run.heldUtterance.whistle;
        run.heldUtterance.whistle = null;
        if (!res) {
          try { res = run.motif.request("whistle", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(3, 6) * gmAt(t) * presGap("whistle"), phrase);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.45, 0.68) * (1.35 - 0.55 * iv);
        var tm = phraseTiming(m, spb, 1.15, 0.5, 3.2);
        // Margins rnd(2,5) — tighter than the Library (Ariel converses
        // faster) — and DOUBLING across the release (texture thinning §1c).
        // rc.38: …and divided by the singer's presence, which is the whole
        // of its thinning — the singer has no entry chance to multiply, so
        // the knob buys space instead: this margin and EVERY wait in the
        // chain above and below (the intensity rest, the empty request, the
        // denied claim, the pause after a phrase) are stretched by the same
        // factor, so the singer simply converses a little less often.
        // (× 1 at presence 1: as-composed, to the bit.)
        var marginRaw = rng.rnd(2, 5) * (st === "release" ? 1 + x : 1);
        var wPres = presGap("whistle");
        var margin = marginRaw * wPres;
        var tok = null;
        try { tok = run.air.tryClaim("whistle", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.whistle = res;
          lane.at(t + rng.rnd(2, 4) * gmAt(t) * wPres, phrase);
          return;
        }
        emitEvent({
          type: "air", voice: "whistle", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "whistle", t);
        driveSignature(res, t);
        // Register: swirl lifts one octave (concentration = height, never
        // loud); the release migrates upward with x — +1 oct by ~0.6, +2 by
        // ~0.9 (whole-octave shifts keep every degree class, so chord-tone
        // endings survive the ascent).
        var lift = 0;
        if (st === "swirl") lift = run.field.size;
        else if (st === "release") lift = run.field.size * (x >= 0.85 ? 2 : (x >= 0.55 ? 1 : 0));
        lift = releaseClimb(m, lift); // the release only ever climbs
        var art = whistleArticulation(m, rng);
        var promoted = !!(run.signature && run.signature.promoted && run.signature.name === m.name);
        var velScale = (res.kind === "ghost") ? (promoted ? 0.85 : 0.6) : 1;
        var out = mixOut("whistle", run.poolMel.at(rng.rnd(-0.6, 0.6)));
        var farWall = run.streams.delaySend.chance(0.5); // per phrase, own fork
        var wx = wxAt(t);
        // rc.36 — the phrase's breath (one draw for the whole phrase: a
        // singer takes one breath), and the evening's vibrato rate and
        // breath band (one instrument per night).
        var breathK = wv("whistle", "breath", t);
        var vibHz = wv("whistle", "vibRate", t);
        var breathHz = wv("whistle", "breathHz", t);
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.7, 1) * velScale;
          if (art.gains) vel *= art.gains[i];
          var nt = t + tm.offs[i];
          var nd = tm.durs[i];
          if (art.holdLast && i === m.notes.length - 1) nd = Math.min(4, nd * 1.5);
          var noteArt = {
            vibDepth: art.vibDepth, farWall: farWall,
            breathK: breathK, vibHz: vibHz, breathHz: breathHz,
            vibK: wv("whistle", "vibrato", nt),   // rc.36: per NOTE
            bendSemis: (m.notes.length === 1 || (art.bendSemis && nd >= 1.6 && i === m.notes.length - 1))
              ? art.bendSemis : 0,
          };
          var btok = run.budget.claim(7, nt + nd + 0.1);
          if (!btok) continue;
          run.tokens.push(btok);
          var deg = m.notes[i].deg + lift;
          var freq = run.field.degFreq(deg, 0); // read at schedule time, never cached
          renderWhistle(out, freq, nt, nd, vel, noteArt, wx);
          if (st === "release") run.featherDeg = deg; // the feather candidate
          emitNote({
            voice: "whistle", freq: freq, t: nt, durS: nd,
            deg: deg, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        maybePost("whistle", res, st, t);
        // rc.33 — THE HANDPAN'S CUE: the phrase's span ends here, and that is
        // the pan's one opportunity. A CALL, not a draw: no fork of the
        // whistle's advances by a single step because of this line (the
        // answer's dice are thrown on the handpan's own fork when its lane
        // fires 0.25 s later).
        handpanCue(t + tm.spanS);
        // rc.38: the WHOLE cycle — the phrase, its margin, the pause after —
        // stretched by 1 / presence, so the singer converses a little less
        // often without one phrase of it changing. (marginRaw × wPres IS the
        // claim margin above, so the claim and the wait agree; at presence 1
        // this sums to the pre-rc.38 expression exactly.)
        lane.at(t + (tm.spanS + marginRaw +
          (st === "song" ? rng.rnd(3, 9) : rng.rnd(2, 7)) * (1.35 - iv) * gmAt(t)) *
            wPres, phrase);
      }
      lane.at(run.t0 + rng.rnd(5, 12), phrase);
    }

    // ---- chime (melodic — the fragmenter; claims THE AIR) --------------------
    // Paired bell-wave oscillators ±2–4 cents (detune on the DETUNE param —
    // cents, so the emitted fundamental stays snap-exact), 1.5–2.5 s decays,
    // burst-and-breathe with the lone-ping habit. In flights the burst IS a
    // gesture-cloud, and the whole cloud (+ any lone ping) holds ONE claim.
    function renderChime(out, freq, t, vel, decayS, detuneCents) {
      var c = ctx;
      // the desk knobs (def 1 = as-composed): ring length and pair distance.
      // rc.36 — decay is a TOUCH draw per ping, on top of the brain's own
      // 1.5–2.5 s; the pair's distance is the bell's CHARACTER, one beating
      // rate for the whole evening.
      decayS *= wv("chime", "decay", t);
      detuneCents *= wv("chime", "detune", t);
      var wave = bellWave(c);
      for (var di = 0; di < 2; di++) {
        var o = c.createOscillator();
        if (wave && typeof o.setPeriodicWave === "function") o.setPeriodicWave(wave);
        else o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(di === 0 ? -detuneCents : detuneCents, t);
        var g = c.createGain();
        o.connect(g); g.connect(out);
        g.connect(run.delaySendChime);  // the wall ALWAYS answers the bell
        g.connect(run.haloSendChime);   // and the strings hear it (via its mixer stage)
        PJ2.Voice.env(g.gain, t, [[0.003, 0.026 * vel], [decayS, 0.001], [0.1, 0]]);
        o.start(t);
        o.stop(t + decayS + 0.15);
      }
    }

    function startChime() {
      var lane = run.clock.lane("chime");
      var rng = run.streams.chime;
      function phrase(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        // THE FEATHER: the first chime act of an alighting, when one is
        // pending, is the previous release's final whistle degree — one lone
        // ping of memory (folded to the bell's shelf; air-claimed like any
        // utterance; kept pending if denied, dropped when the window closes).
        // rc.38: the feather is a SIGNATURE — presence never touches it —
        // but it is the bell's gesture, so on an evening the bell sits out
        // there is no feather; the pending degree simply lapses when the
        // alighting closes, as it does when the window closes on any other
        // evening.
        if (run.featherPending != null && st !== "alighting") run.featherPending = null;
        if (run.featherPending != null && st === "alighting" && iv >= 0.05 && !isAbsent("chime")) {
          var fDeg = degClass(run.featherPending) + run.field.size; // the shelf
          var fTok = null;
          try { fTok = run.air.tryClaim("chime", 2.2, 2); } catch (e) {}
          if (fTok) {
            run.featherPending = null;
            emitEvent({
              type: "air", voice: "chime", t: t, durS: 2.2, marginS: 2,
              limit: run.airLimit(), overlap: !!(fTok && fTok.overlap),
            });
            var fBtok = run.budget.claim(4, t + 2.6);
            if (fBtok) {
              run.tokens.push(fBtok);
              var fFreq = run.field.degFreq(fDeg, 0);
              renderChime(mixOut("chime", run.poolMel.at(rng.rnd(-0.5, 0.5))), fFreq, t, 0.8, rng.rnd(1.8, 2.4), rng.rnd(2, 4));
              emitNote({ voice: "chime", kind: "feather", freq: fFreq, t: t, durS: 2.2, deg: fDeg, oct: 0 });
              emitEvent({ type: "feather", deg: fDeg, t: t });
            }
            lane.at(t + rng.rnd(5, 9) * gmAt(t), phrase);
            return;
          }
          // denied: ask again shortly, feather still pending
          lane.at(t + rng.rnd(2, 4) * gmAt(t), phrase);
          return;
        }
        // Rest habit (draw always — stream discipline): the bell breathes
        // long in the contemplative scenes.
        // The bell's scene manners: barely rests in flights (it is half the
        // cloud), breathes long in songs (the whistle's scene) and the
        // contemplative scenes — this asymmetry is what makes flight density
        // read as 2x song density without anything getting louder.
        // rc.38: the bell's presence is read INTO this one draw — the speak
        // side of it — so the bell breathes longer everywhere at once and
        // the scene asymmetry above survives intact.
        var rest = rng.chance(presRest("chime",
          st === "flight" ? 0.05
          : st === "song" ? 0.55
          : st === "hover" || st === "release" ? 0.5
          : st === "alighting" ? 0.35 : 0.3));
        // rc.33: …and the roster rests the bell in hovers (the rest draw is
        // taken FIRST, above — the gate never touches a roll). rc.38: and an
        // evening's absence sits beside the roster, the same way.
        if (rest || iv < 0.1 || !rosterAllows("chime") || isAbsent("chime")) {
          lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase);
          return;
        }
        var res = run.heldUtterance.chime;
        run.heldUtterance.chime = null;
        if (!res) {
          try { res = run.motif.request("chime", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase);
          return;
        }
        var m = res.motif;
        // Burst pacing: quick in flights (the cloud), a touch broader in
        // songs; ring 1.5–2.6 s regardless (bells decay on their own time).
        var spb = (st === "flight") ? rng.rnd(0.24, 0.4) : rng.rnd(0.32, 0.5);
        var tm = phraseTiming(m, spb, 6, 1.5, 2.6);
        // The lone-ping habit: drawn BEFORE the claim; the ping (when drawn)
        // lives inside this same utterance's claim — one cloud, one claim.
        var wantPing = rng.chance(0.25);
        var pingGap = rng.rnd(1.5, 3);
        var pingDecay = rng.rnd(1.5, 2.5);
        var claimSpan = tm.spanS + (wantPing ? pingGap + 1.2 : 0);
        var margin = (st === "flight" ? rng.rnd(1, 2.5) : rng.rnd(2, 5)) *
          (st === "release" ? 1 + curSceneX() : 1);
        var tok = null;
        try { tok = run.air.tryClaim("chime", claimSpan, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.chime = res;
          lane.at(t + rng.rnd(2.5, 5) * gmAt(t), phrase);
          return;
        }
        emitEvent({
          type: "air", voice: "chime", t: t, durS: claimSpan, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "chime", t);
        driveSignature(res, t);
        // Re-register to the bell's shelf (F5–E6): chime-fresh material is
        // born in octave 1; shared material recentres near the tonic octave
        // and gets lifted whole octaves (degree classes survive).
        var mean = 0, i;
        for (i = 0; i < m.notes.length; i++) mean += m.notes[i].deg;
        mean /= m.notes.length;
        var lift = (mean > 2.5 + run.field.size / 2) ? 0 : run.field.size;
        if (st === "release") {
          var x = curSceneX();
          lift += run.field.size * (x >= 0.75 ? 1 : 0); // the bell climbs too
        }
        lift = releaseClimb(m, lift);
        var promoted = !!(run.signature && run.signature.promoted && run.signature.name === m.name);
        var velScale = (res.kind === "ghost") ? (promoted ? 0.85 : 0.6) : 1;
        var out = mixOut("chime", run.poolMel.at(rng.rnd(-0.55, 0.55)));
        var lastDeg = 0;
        for (i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.65, 1) * velScale;
          var decayS = rng.rnd(1.5, 2.5);
          var detune = rng.rnd(2, 4);
          var nt = t + tm.offs[i];
          var btok = run.budget.claim(4, nt + decayS + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var deg = m.notes[i].deg + lift;
          lastDeg = deg;
          var freq = run.field.degFreq(deg, 0); // read at schedule time
          renderChime(out, freq, nt, vel, decayS, detune);
          emitNote({
            voice: "chime", freq: freq, t: nt, durS: Math.min(tm.durs[i], decayS),
            deg: deg, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        if (wantPing) { // the lone ping in the pause — same claim, same idea
          var pt = t + tm.spanS + pingGap;
          var pTok = run.budget.claim(4, pt + pingDecay + 0.2);
          if (pTok) {
            run.tokens.push(pTok);
            var pFreq = run.field.degFreq(lastDeg, 0);
            renderChime(out, pFreq, pt, 0.7 * velScale, pingDecay, 3);
            emitNote({
              voice: "chime", kind: "ping", freq: pFreq, t: pt, durS: 1.2,
              deg: lastDeg, oct: 0, motif: m.name, gen: m.gen, phraseKind: res.kind,
            });
          }
        }
        maybePost("chime", res, st, t);
        lane.at(t + claimSpan + margin +
          (st === "flight" ? rng.rnd(1.5, 4) : rng.rnd(3, 8)) * (1.3 - iv) * gmAt(t), phrase);
      }
      lane.at(run.t0 + rng.rnd(10, 20), phrase);
    }

    // ---- flutter (melodic — pure ornament; claims THE AIR) -------------------
    // Fast triangle notes ±2 cents, short phrases only (v1 ~4915). The
    // flight's main cloud voice; rests more in still air; STOPS by x≈0.5 of
    // the release (texture thinning); never posts.
    function startFlutter() {
      var lane = run.clock.lane("flutter");
      var rng = run.streams.flutter;
      function phrase(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var x = curSceneX();
        var tide = curTidePos();
        if (st === "release" && x > 0.5) {
          // Silence for the rest of the scene — check back after it.
          lane.at(t + 10, phrase);
          return;
        }
        // Rest draw, always taken: flights barely rest; still air rests more
        // (v1's REST knob, now weather): rest p grows as gustiness falls.
        var wx = wxAt(t);
        var restP = (st === "flight") ? 0.05
          : 0.65 + 0.15 * (1 - tide) + 0.1 * (0.5 - wx.gustiness);
        var rest = rng.chance(clamp(presRest("flutter", restP), 0, 0.92));
        // rc.33: the roster rests the ornament in the alighting, hovers and
        // the swirl. The release stays TICKED — the flutter's own law retires
        // it at x 0.5 and that is the ENGINE's retirement, not the roster's.
        // rc.38: an absence rests it for the whole evening, beside the roster.
        if (rest || iv < 0.12 || !rosterAllows("flutter") || isAbsent("flutter")) {
          lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase);
          return;
        }
        var res = run.heldUtterance.flutter;
        run.heldUtterance.flutter = null;
        if (!res) {
          try { res = run.motif.request("flutter", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(4, 8) * gmAt(t), phrase);
          return;
        }
        var m = res.motif;
        // The cloud: 4–10 quick notes over ~1.5–4 s (spb × durBeats does it).
        var spb = (st === "flight") ? rng.rnd(0.2, 0.35) : rng.rnd(0.25, 0.4);
        var tm = phraseTiming(m, spb, 1.2, 0.12, 0.3);
        var margin = (st === "flight") ? rng.rnd(1, 2.5) : rng.rnd(2, 5);
        var tok = null;
        try { tok = run.air.tryClaim("flutter", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.flutter = res;
          lane.at(t + rng.rnd(2, 4) * gmAt(t), phrase);
          return;
        }
        emitEvent({
          type: "air", voice: "flutter", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "flutter", t);
        driveSignature(res, t);
        var mean = 0, i;
        for (i = 0; i < m.notes.length; i++) mean += m.notes[i].deg;
        mean /= m.notes.length;
        var lift = (mean > 2.5 + run.field.size / 2) ? 0 : run.field.size;
        lift = releaseClimb(m, lift); // flutter flies only the release's first
                                      // half, but it starts the staircase the
                                      // others must then climb past
        var promoted = !!(run.signature && run.signature.promoted && run.signature.name === m.name);
        var velScale = (res.kind === "ghost") ? (promoted ? 0.85 : 0.6) : 1;
        var out = mixOut("flutter", run.poolMel.at(rng.rnd(-0.5, 0.5)));
        var c = ctx;
        for (i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.6, 1) * velScale;
          var det = rng.rnd(-2, 2);
          var nt = t + tm.offs[i], nd = tm.durs[i];
          var btok = run.budget.claim(2, nt + nd + 0.1);
          if (!btok) continue;
          run.tokens.push(btok);
          var deg = m.notes[i].deg + lift;
          var freq = run.field.degFreq(deg, 0); // read at schedule time
          var o = c.createOscillator();
          o.type = "triangle";
          o.frequency.setValueAtTime(freq, nt);
          o.detune.setValueAtTime(det, nt);
          var g = c.createGain();
          o.connect(g); g.connect(out);
          g.connect(run.delaySendFlutter); // the cloud always reaches the wall
          PJ2.Voice.env(g.gain, nt, [[0.005, 0.04 * vel], [nd * 0.4 - 0.005, 0.032 * vel], [nd * 0.6, 0]]);
          o.start(nt);
          o.stop(nt + nd + 0.02);
          emitNote({
            voice: "flutter", freq: freq, t: nt, durS: nd,
            deg: deg, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        // Flutter never posts — it decorates, it doesn't argue.
        lane.at(t + tm.spanS + margin +
          (st === "flight" ? rng.rnd(1.2, 3.5) : rng.rnd(2.5, 6)) * (1.3 - iv) * gmAt(t), phrase);
      }
      lane.at(run.t0 + rng.rnd(14, 26), phrase);
    }

    // ---- bass (landscape — the arc made audible) -----------------------------
    // v1's electric bass (playArielBassNote ~4564) with the arc-following
    // character intact: I comes from conductor.intensityAt(t) (rescaled to
    // the arc's 0..1) plus a thermals wobble in place of v1's bounded drift;
    // everything downstream is v1's own arithmetic. Offsets are DEGREES
    // (root/+2/+4/+7, #4 as deg +3 color on I) so the key survives every
    // modulation. Exits the release at x≈0.4 with one final root planted an
    // octave above its floor — the ground lets go.
    function renderBassNote(t, freq, durS, vel) {
      var c = ctx;
      var ring = Math.max(durS * 0.9, 0.4);
      var tok = run.budget.claim(4, t + ring + 0.2);
      if (!tok) return false; // graceful thinning — and the caller emits no event
      run.tokens.push(tok);
      var peak = 0.10 * vel; // v1 ran 0.14 on its hotter bus; family headroom
      var g = c.createGain();
      g.connect(run.layBass);
      // rc.36 — how hard the string is taken, per note (8–18 ms around v1's
      // 12; the knob floors at 6 ms, well above any body's click-safe edge),
      // and the evening's WARMTH: how much 2nd and 3rd partial the
      // instrument has tonight.
      var atkS = wv("bass", "attack", t) / 1000;
      var warmK = wv("bass", "warmth", t);
      PJ2.Voice.env(g.gain, t, [[atkS, peak], [0.088, peak * 0.5], [ring - 0.1, 0]]);
      var partials = [[1, 1.0], [2, 0.4 * warmK], [3, 0.18 * warmK]];
      for (var i = 0; i < partials.length; i++) {
        var o = c.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq * partials[i][0], t);
        var og = c.createGain();
        og.gain.setValueAtTime(partials[i][1], t);
        o.connect(og); og.connect(g);
        o.start(t);
        o.stop(t + ring + 0.05);
      }
      return true;
    }

    function startBass() {
      var lane = run.clock.lane("bass");
      var rng = run.streams.bass;
      var BASS_OCT = -3; // floor: F1 ≈ 43.7 (v1's pair[0]/4)

      function bassRootDeg() {
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        return foldRootLow(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0);
      }
      function bassOnI() {
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        return degClass(ch && isFinite(ch.rootDeg) ? ch.rootDeg : 0) === 0;
      }
      // Degree offset above the root (v1 arielBassPitch, in degree space).
      function bassPitchDeg(reach) {
        var r = rng.next();
        var off = r < 0.62 ? 0 : (r < 0.85 ? 4 : 2);
        if (bassOnI() && rng.chance(0.15)) off = 3; // the Lydian #4, a color
        if (rng.chance(reach)) off += 7;
        return Math.min(off, 11);
      }
      function cloneFig(f) {
        var out = [];
        for (var i = 0; i < f.length; i++) out.push({ off: f[i].off, dt: f[i].dt });
        return out;
      }
      function playFig(fig, rootDeg, t, vel) {
        var at = t;
        for (var k = 0; k < fig.length; k++) {
          var deg = rootDeg + Math.min(11, fig[k].off);
          var freq = run.field.degFreq(deg, BASS_OCT);
          if (renderBassNote(at, freq, 1.0, vel)) {
            emitNote({ voice: "bass", freq: freq, t: at, durS: 1.0, deg: deg, oct: BASS_OCT });
          }
          at += fig[k].dt;
        }
      }

      // rc.38 — the ground's wait, stretched by 1 / presence… EXCEPT inside a
      // release whose LAST WORD is still unsaid. That exit at x 0.4 is a
      // SIGNATURE and its window is a sixth of the scene wide: a ground that
      // waited a third longer between fires would step straight over it, and
      // the release would lose the moment the floor lets go. So the bass keeps
      // its composed pace from the moment a release opens until it has spoken,
      // and thins everywhere else.
      function bassGap(sceneType) {
        return (sceneType === "release" && !run.bassDone) ? 1 : presGap("bass");
      }

      function fire(t) {
        var st = curSceneType();
        var x = curSceneX();
        // THE EXIT (§1c move 2): one final root an octave above the floor
        // just before x 0.4, then silence below — never a note past x 0.5.
        if (st === "release") {
          // rc.38: the LAST WORD is a signature — presence never thins it —
          // but an absent bass has no word to say, and falls through to the
          // absence gate below like any other entry.
          if (!run.bassDone && x >= 0.25 && x < 0.42 && !isAbsent("bass")) {
            run.bassDone = true;
            var rootDeg0 = bassRootDeg();
            var fFreq = run.field.degFreq(rootDeg0, BASS_OCT + 1);
            if (renderBassNote(t, fFreq, 4.0, 0.9)) {
              emitNote({ voice: "bass", kind: "final", freq: fFreq, t: t, durS: 4, deg: rootDeg0, oct: BASS_OCT + 1 });
            }
            lane.at(t + 12, fire);
            return;
          }
          if (run.bassDone || x >= 0.42) { lane.at(t + 10, fire); return; }
        } else {
          run.bassDone = false;
        }
        var iv = curIntensity(t);
        var wx = wxAt(t);
        // v1's arc, promoted: intensity rescaled to 0..1, thermals as the
        // bounded wobble the old random walk supplied.
        var I = clamp((iv - FLOOR) / (CEIL - FLOOR) + 0.4 * (wx.thermals - 0.5), 0, 1);
        var pace = 1 - I * 0.6;
        var flourishP = Math.min(0.6, 0.2 * (0.35 + I * 1.6) * pVal("bass", "flourish")); // desk knob: def 1 = as-composed
        var reach = Math.min(1, 0.25 * (0.5 + I * 1.4));
        var threeP = 0.25 + I * 0.45;
        var gestureP = 0.22 + I * 0.18;
        var rootDeg = bassRootDeg();

        // rc.33: the roster rests the arc in the alighting, flights and the
        // swirl (§6.3). Entries only — a note already sounding finishes — and
        // the armed arrival is SPENT rather than banked: a bass that returned
        // two scenes later to plant a root the harmony has long left would be
        // answering a question nobody asked. The release stays ticked: the
        // bass's last word at x 0.4 is the ENGINE's law, above.
        // rc.38: …and an evening's absence rests it the same way, arrival
        // spent rather than banked, for exactly the same reason.
        if (!rosterAllows("bass") || isAbsent("bass")) {
          run.bassArrival = false;
          lane.at(t + rng.rnd(7.2, 11.2) * pace * gmAt(t), fire);
          return;
        }

        // Arrival — the harmony just stepped. Plant the new root firmly.
        if (run.bassArrival) {
          run.bassArrival = false;
          var aFreq = run.field.degFreq(rootDeg, BASS_OCT);
          if (renderBassNote(t, aFreq, 4.0, 0.94)) {
            emitNote({ voice: "bass", kind: "arrival", freq: aFreq, t: t, durS: 4, deg: rootDeg, oct: BASS_OCT });
          }
          lane.at(t + rng.rnd(5.6, 8.1) * pace * gmAt(t) * bassGap(st), fire);
          return;
        }

        var roll = rng.next();
        if (roll < flourishP) {
          // A rationed flourish — remembered figure, fresh / verbatim /
          // transformed (v1 arielBassFlourish, on the seeded stream).
          var r2 = rng.next(), fig, tag;
          if (run.bassFigs.length && r2 < 0.30) {
            fig = cloneFig(rng.pick(run.bassFigs));
            tag = "verbatim";
          } else if (run.bassFigs.length && r2 < 0.50) {
            var base = cloneFig(rng.pick(run.bassFigs));
            if (rng.chance(0.6)) { fig = base.slice().reverse(); tag = "retrograde"; }
            else {
              fig = [];
              for (var bi = 0; bi < base.length; bi++) {
                fig.push({ off: Math.min(11, base[bi].off + 7), dt: base[bi].dt });
              }
              tag = "octave";
            }
          } else {
            var n = rng.rint(2, 3);
            fig = [];
            for (var fi = 0; fi < n; fi++) fig.push({ off: bassPitchDeg(reach), dt: rng.rnd(0.3, 0.55) });
            fig[fig.length - 1].off = rng.chance(0.6) ? 0 : 4; // land grounded
            run.bassFigs.push(cloneFig(fig));
            if (run.bassFigs.length > 5) run.bassFigs.shift();
            tag = "fresh";
          }
          playFig(fig, rootDeg, t, 0.85);
          emitEvent({ type: "bass-flourish", tag: tag, t: t });
        } else if (roll < flourishP + gestureP) {
          // Sustained gesture — 2, sometimes 3 notes among root/fifth/octave.
          var gLen = rng.chance(threeP) ? 3 : 2;
          var choices = rng.chance(reach) ? [0, 4, 7] : [0, 4];
          var offs = [rng.chance(0.5) ? 0 : 4];
          for (var gi = 1; gi < gLen; gi++) offs.push(rng.pick(choices));
          offs[gLen - 1] = rng.chance(0.6) ? 0 : 4; // land grounded
          var gt = t;
          for (var gj = 0; gj < offs.length; gj++) {
            var gDeg = rootDeg + offs[gj];
            var gFreq = run.field.degFreq(gDeg, BASS_OCT);
            if (renderBassNote(gt, gFreq, 2.4 - gj * 0.2, (0.78 + I * 0.15) - gj * 0.04)) {
              emitNote({ voice: "bass", freq: gFreq, t: gt, durS: 2.4 - gj * 0.2, deg: gDeg, oct: BASS_OCT });
            }
            gt += rng.rnd(0.45, 0.85);
          }
        } else {
          // Single long anchor — primarily the root.
          var off = rng.chance(0.72) ? 0 : (rng.chance(reach) ? 7 : 4);
          var dDur = rng.rnd(3.0, 4.3);
          var dDeg = rootDeg + off;
          var dFreq = run.field.degFreq(dDeg, BASS_OCT);
          if (renderBassNote(t, dFreq, dDur, 0.72 + I * 0.16)) {
            emitNote({ voice: "bass", kind: "anchor", freq: dFreq, t: t, durS: dDur, deg: dDeg, oct: BASS_OCT });
          }
        }
        // rc.38: the ground has no entry chance either — it speaks whenever
        // its lane fires and the roster seats it — so its presence lengthens
        // the wait between words. (× 1 at presence 1: as-composed.)
        lane.at(t + rng.rnd(7.2, 11.2) * pace * gmAt(t) * bassGap(st), fire);
      }
      lane.at(run.t0 + rng.rnd(4, 9), fire);
    }

    // ---- aeolian (NEW — bowed glass; landscape bed + occasional singer) ------
    // The bowed-glass body: a detuned sine pair + a soft 2nd partial + a
    // glassy noise breath through a resonant bandpass (pre-attenuated,
    // lesson #2), everything on 2–4 s attacks — nothing here CAN transient.
    function renderAeolianNote(dest, freq, t, durS, peak, atkS) {
      var c = ctx;
      var g = c.createGain();
      g.connect(dest);
      var rel = Math.min(3, durS * 0.35);
      if (atkS + rel > durS - 0.2) { atkS = durS * 0.4; rel = durS * 0.4; }
      PJ2.Voice.env(g.gain, t, [[atkS, peak], [durS - atkS - rel, peak * 0.92], [rel, 0]]);
      var det0 = wv("aeolian", "detune", t);   // rc.36: the glass's own night
      var det = [-det0, det0];
      for (var i = 0; i < 2; i++) {
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        o.detune.setValueAtTime(det[i], t);
        o.connect(g);
        o.start(t);
        o.stop(t + durS + 0.1);
      }
      var h = c.createOscillator(); // the glass's high sheen
      h.type = "sine";
      h.frequency.setValueAtTime(freq * 2, t);
      var hg = c.createGain();
      hg.gain.setValueAtTime(0.22 * wv("aeolian", "sheen", t), t); // rc.36: character
      h.connect(hg); hg.connect(g);
      h.start(t);
      h.stop(t + durS + 0.1);
      var ns = PJ2.Voice.noiseBuffer.source(c, 30); // the bow's breath
      var pre = c.createGain();
      pre.gain.setValueAtTime(0.25, t);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(freq * 2, t);
      bp.Q.setValueAtTime(8, t);
      var ng = c.createGain();
      ng.gain.setValueAtTime(0.18 * wv("aeolian", "breath", t), t); // rc.36: touch, per note
      ns.connect(pre); pre.connect(bp); bp.connect(ng); ng.connect(g);
      ns.start(t, ns.randomOffset);
      ns.stop(t + durS + 0.1);
      return g;
    }

    // The bed: slow overlapping swells voicing 1–2 tones of harmony.current;
    // on I, the 0.15-chance #4 — the tritone as light. Gated by intensity
    // through the follower's aeoLevel.
    function startAeolianBed() {
      var lane = run.clock.lane("aeolian");
      var rng = run.streams.aeolian;
      function swell(t) {
        var iv = curIntensity(t);
        // Draws first, unconditionally.
        var durS = rng.rnd(10, 18);
        var gap = rng.rnd(8, 14);
        var two = rng.chance(0.35);
        var wantSharp4 = rng.chance(0.15);
        var atkS = rng.rnd(2, 4);
        // rc.33: the roster rests the glass bed in the alighting, flights and
        // the swirl — after every draw above, as the law requires. (The
        // cadence CONSORT is not gated: a cadence is a boundary gesture under
        // the cadence contract, which is exactly why the consort surfaces
        // where the bed rests.)
        if (iv < 0.15 || !rosterAllows("aeolian")) { lane.at(t + rng.rnd(4, 7), swell); return; }
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        var rootDeg = (ch && isFinite(ch.rootDeg)) ? Math.round(ch.rootDeg) : 0;
        var onI = degClass(rootDeg) === 0;
        var degs;
        if (wantSharp4 && onI) degs = [3];             // the #4 hummed as light
        else degs = two ? [degClass(rootDeg), degClass(rootDeg) + 4] : [degClass(rootDeg) + (rng.chance(0.5) ? 2 : 4)];
        var tok = run.budget.claim(7 * degs.length, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, swell); return; }
        run.tokens.push(tok);
        for (var i = 0; i < degs.length; i++) {
          var freq = run.field.degFreq(degs[i], 0);
          renderAeolianNote(run.aeoLevel, freq, t, durS, 0.02, atkS);
          emitNote({
            voice: "aeolian", kind: wantSharp4 && onI ? "sharp4" : "bed",
            freq: freq, t: t, durS: durS, deg: degs[i], oct: 0,
          });
        }
        lane.at(t + gap, swell);
      }
      lane.at(run.t0 + rng.rnd(6, 12), swell);
    }

    // The singer: the occasional THIRD melodic speaker (what makes song-scene
    // overlap real). Claims the air; routed around aeoLevel — a singer who
    // has claimed the air must be heard even where the bed is idle.
    function startAeolianSing() {
      var lane = run.clock.lane("aeolianSing");
      var rng = run.streams.aeolianSing;
      var SING_P = { "alighting": 0.05, "song": 0.2, "flight": 0.05, "hover": 0.15, "swirl": 0, "release": 0.1 };
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var p = SING_P[st] != null ? SING_P[st] : 0;
        // rc.38: presence multiplies the speak-p — and the knob is the
        // SINGER's alone: the bed above never reads it, and neither does the
        // cadence consort, which belongs to the cadence.
        var sings = rng.chance(presP("aeolian", p)); // drawn every opportunity — stream discipline
        if (!sings || iv < 0.1 || !rosterAllows("aeolian") || isAbsent("aeolian")) {   // rc.33: the roster
          lane.at(t + rng.rnd(9, 16) * gmAt(t), attempt);
          return;
        }
        var res = run.heldUtterance.aeolian;
        run.heldUtterance.aeolian = null;
        if (!res) {
          try { res = run.motif.request("aeolian", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(9, 16) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.1, 1.6) * (1.4 - 0.6 * iv); // the slowest voice aloft
        var tm = phraseTiming(m, spb, 1.15, 1.2, 4.5);
        var margin = rng.rnd(3, 7);
        var tok = null;
        try { tok = run.air.tryClaim("aeolian", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.aeolian = res;
          lane.at(t + rng.rnd(5, 9) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "aeolian", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "aeolian", t);
        driveSignature(res, t);
        var lift = (st === "release") ? run.field.size * (curSceneX() >= 0.6 ? 1 : 0) : 0;
        lift = releaseClimb(m, lift);
        var promoted = !!(run.signature && run.signature.promoted && run.signature.name === m.name);
        var velScale = (res.kind === "ghost") ? (promoted ? 0.85 : 0.6) : 1;
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.75, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          var btok = run.budget.claim(7, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var deg = m.notes[i].deg + lift;
          var freq = run.field.degFreq(deg, 0); // read at schedule time
          renderAeolianNote(run.layAeo, freq, nt, nd, 0.026 * vel, Math.min(2.5, nd * 0.35));
          emitNote({
            voice: "aeolian", kind: "sing", freq: freq, t: nt, durS: nd,
            deg: deg, oct: 0, velocity: vel,
            motif: m.name, gen: m.gen, phraseKind: res.kind,
          });
        }
        maybePost("aeolian", res, st, t);
        lane.at(t + tm.spanS + margin + rng.rnd(8, 16) * gmAt(t), attempt);
      }
      lane.at(run.t0 + rng.rnd(15, 28), attempt);
    }

    // ========================================================================
    // THE FOUR LANDSCAPE-CHORDAL VOICES (rc.33) — the lyre, the concertina,
    // the handpan and the vibraphone, ported from `lab-ariel.html` at the
    // knob defaults the owner left its sliders on (every one of those numbers
    // is a LAYER_PARAMS def above, read through pVal at schedule time).
    //
    // What they share, and what makes them a family:
    //   * They read `harmony.current()` and the FIELD at schedule time, so a
    //     sea change and the seam's re-grounding are free (nothing sounding
    //     ever retunes).
    //   * None of them ever claims THE AIR. They are landscape: they sound
    //     UNDER the whistle, the chime and the flutter at their own level,
    //     and the air's limits are untouched by rc.33.
    //   * Every gesture throws its dice FIRST, unconditionally, on its own
    //     fork; the gates — the roster, the release ladder, the hold law,
    //     the scene chance × presence — come after.
    //   * Every envelope is PJ2.Voice.env or an anchored ramp pair; no
    //     setTargetAtTime, no portamento, anywhere (decision 6).
    //   * NOTHING IS KILLED AT A BOUNDARY. The lab page clipped its bodies to
    //     end inside the release because it could not see the seam; the
    //     engine does not need to and must not — the release ends with the
    //     high pad still ringing and the next alighting blooms beneath it, so
    //     a lyre ring that crosses the seam crosses it exactly as the
    //     breeze's tail does. The only cancellation any of these lanes ever
    //     sees is stop().
    // ========================================================================

    // slowNoise — the family's smooth-wobble source (pj2-library's, verbatim
    // semantics): interpolated random keyframes, one 20 s loop cached per
    // ctx+rate, a random read offset per consumer. Math.random here is
    // TEXTURE — never music (house rule).
    function slowNoise(c, rateHz) {
      var cache = c.__pj2ArielSlowNoise = c.__pj2ArielSlowNoise || {};
      var key = "r" + rateHz;
      if (!cache[key]) {
        var sr = c.sampleRate || 44100;
        var slot = Math.max(1, Math.floor(sr / rateHz));
        var n = Math.max(slot * 4, Math.floor(sr * 20));
        var buf = c.createBuffer(1, n, sr);
        var data = buf.getChannelData(0);
        var nKeys = Math.ceil(n / slot) + 2, keys = [];
        for (var k = 0; k < nKeys; k++) keys.push(Math.random() * 2 - 1);
        for (var i = 0; i < n; i++) {
          var pos = i / slot, i0 = Math.floor(pos), fr = pos - i0;
          data[i] = keys[i0] * (1 - fr) + keys[i0 + 1] * fr;
        }
        cache[key] = buf;
      }
      var src = c.createBufferSource();
      src.buffer = cache[key];
      src.loop = true;
      src.randomOffset = Math.random() * 18;
      return src;
    }

    // The free reed's wave: every harmonic at 1/n with a bump at the 5th–7th,
    // which is what makes a concertina sound like a concertina and not like a
    // sawtooth (the lab's recipe, cached per ctx beside the flute and bell).
    function reedWave(c) {
      var p = [];
      for (var n = 1; n <= 16; n++) {
        var a = 1 / n;
        if (n >= 5 && n <= 7) a *= 2.2;
        p.push(a);
      }
      return makeWave(c, "reed", p);
    }

    // ---- the release ladder, shared by the four (the lab's law) -------------
    // "Nothing of yours may be louder or lower as the evening dissolves
    // upward." The LYRE stays to the end and stays by CLIMBING the whistle's
    // own rungs (+1 octave from x ≥ 0.6, +2 from x ≥ 0.9) while thinning;
    // the concertina leaves with the bass at x ≥ 0.4, the handpan and the
    // vibraphone with the flutter at x ≥ 0.5. (The roster already rests all
    // three through the whole release — this gate is the same law checked at
    // the body, and it is what would still hold if the table were edited.)
    var CHORD_RELEASE_GATE = { lyre: 1.01, concertina: 0.4, handpan: 0.5, vibraphone: 0.5 };
    function chordAllows(key) {
      if (curSceneType() !== "release") return true;
      var g = CHORD_RELEASE_GATE[key];
      return curSceneX() < (g == null ? 1.01 : g);
    }
    // Whole octaves, in degrees — the whistle's rungs exactly, so every degree
    // class (and every chord tone) survives the climb.
    function chordLift() {
      if (curSceneType() !== "release") return 0;
      var x = curSceneX();
      return (x >= 0.9) ? 2 : (x >= 0.6 ? 1 : 0);
    }
    // The thinning has two halves: the ENTRY chance falls as (1 − x)…
    function chordThinP() {
      return (curSceneType() === "release") ? Math.max(0, 1 - curSceneX()) : 1;
    }
    // …and the LEVEL as (1 − x)^1.2, with the lab's floor of 0.08: without a
    // floor the +2-oct rung lands under −66 dBFS, which is not a thin roll,
    // it is no roll — the top of the ladder would be a thing the engine
    // claims to play and does not.
    function chordThinLevel() {
      if (curSceneType() !== "release") return 1;
      return Math.max(0.08, Math.pow(Math.max(0, 1 - curSceneX()), 1.2));
    }

    // ---- chord tones, voiced ------------------------------------------------
    // Root, 3rd, 5th (+ octave at four voices) from harmony.current(); on I
    // the #4 (degree 3) arrives as a COLOUR with p 0.15, replacing the 5th —
    // never the root, and never anywhere but on I. (The bass and the aeolian
    // take the same 0.15 coin for the same reason: in Ariel the tritone is
    // light.) THE COIN IS DRAWN FIRST, before the chord is read, so the
    // caller's fork advances identically whether or not a chord is available.
    function chordVoices(rng, nVoices, allowSharp4) {
      var coin = rng.chance(0.15);
      var cur = null;
      try { cur = run.harmony.current(); } catch (e) {}
      if (!cur || !cur.chordDegs || !cur.chordDegs.length) return null;
      var size = run.field.size;
      var src = cur.chordDegs;
      var out = [src[0]];
      out.push((src.length > 1) ? src[1] : src[0] + 2);
      out.push((src.length > 2) ? src[2] : src[0] + 4);
      var sharp4 = false;
      if (allowSharp4 && degClass(cur.rootDeg) === 0 && coin) { out[2] = 3; sharp4 = true; }
      if (nVoices >= 4) out.push(out[0] + size);
      out = out.slice(0, Math.max(1, nVoices));
      out.sort(function (a, b) { return a - b; });
      return { degs: out, sharp4: sharp4, name: cur.name, rootDeg: cur.rootDeg, chordDegs: src };
    }

    // ========================================================================
    // THE LYRE (landscape-chordal) — Ariel's own instrument. The Tempest's
    // airy songs were sung to a lyre, and nothing else in this sky is
    // plucked. Its gesture is THE ROLLED CHORD, and its band (F3–F5 at the
    // default register) is the one the map left empty between the bass and
    // the breeze.
    // ========================================================================
    var LYRE_PEAK = 0.03;         // per string — the lab's design constant
    var LYRE_CHORD_SCALE = 0.8;   // …×0.8 when more than one string sounds
    var LYRE_SCENE = { alighting: 0.35, song: 0.45, flight: 0, hover: 0.35, swirl: 0, release: 0.45 };
    var LYRE_CADENCE_P = 0.6;     // a LIFT's second door
    var LYRE_CADENCE_OFFSET = 0.4; // …taken 0.4 s AFTER the arrival, never at it

    // ONE STRING. A plucked gut string is a period of noise ringing under a
    // closing filter, and the plan's shape implies a Karplus–Strong comb at
    // 1/f — but WebAudio clamps a DelayNode INSIDE A FEEDBACK CYCLE to one
    // render quantum (128 frames ≈ 2.9 ms at 44.1 kHz), which caps such a
    // comb at ~344 Hz. The lyre's chords reach F5 (698 Hz) and its octave
    // voice higher still, so a comb would have sounded the WRONG NOTE. The
    // string is therefore a LOOPED PERIOD BUFFER: one exact period of
    // smoothed noise read at a playbackRate that lands the pitch exactly,
    // with the closing lowpass outside the loop doing the loop filter's work.
    // Same excitation, same spectrum, same decay — exact pitch, and no
    // feedback cycle to keep safe.
    //
    // THE RATE IS n·f/sr, NOT its reciprocal (the critic's fix): a looped
    // buffer of n frames read at rate p sounds at p·sr/n, so n·f/sr lands f
    // exactly and CANCELS the rounding error of n instead of doubling it
    // (sr/(n·f) measured +11 ¢ at F4 and +39 ¢ at E6; this lands every pitch
    // F4–E6 inside ±2.3 ¢). The 20 ms burst survives as the pluck's own
    // scrape, mixed in at the onset through the same body.
    function pluckString(t, f, ringS, dest, peak, brightK, bodyK) {
      var c = ctx;
      var sr = c.sampleRate || 44100;
      var n = Math.max(8, Math.round(sr / f));
      var src = c.createBufferSource();
      try {
        var buf = c.createBuffer(1, n, sr);
        var d = buf.getChannelData(0);
        var prev = 0;
        for (var i = 0; i < n; i++) {   // texture: Math.random, never music
          var w = Math.random() * 2 - 1;
          d[i] = (w + prev) * 0.5;      // a raw period screams; smooth it
          prev = w;
        }
        src.buffer = buf;
      } catch (eB) { /* a mock without buffers plays a silent string */ }
      src.loop = true;
      // pitch, exactly: p·sr/n === f. Guarded — a mock BufferSource may carry
      // no playbackRate param, and a silent string is better than a throw.
      try {
        var pr = src.playbackRate;
        if (pr && typeof pr.setValueAtTime === "function") pr.setValueAtTime(n * f / sr, t);
        else if (pr && typeof pr === "object") pr.value = n * f / sr;
      } catch (eR) {}
      // the lowpass that closes: bright × f → 1.2 f over 60 % of the ring
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.setValueAtTime(0.7, t);
      var f0 = Math.min(18000, Math.max(f * 1.25, f * brightK));
      lp.frequency.setValueAtTime(f0, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(80, f * 1.2), t + ringS * 0.6);
      // the body: two peaking bells — the gut and the soundbox
      var b1 = c.createBiquadFilter();
      b1.type = "peaking";
      b1.frequency.setValueAtTime(300, t);
      b1.Q.setValueAtTime(1.1, t);
      b1.gain.setValueAtTime(3 * bodyK, t);
      var b2 = c.createBiquadFilter();
      b2.type = "peaking";
      b2.frequency.setValueAtTime(1500, t);
      b2.Q.setValueAtTime(1.4, t);
      b2.gain.setValueAtTime(2 * bodyK, t);
      var g = c.createGain();
      PJ2.Voice.env(g.gain, t, [[0.004, peak], [ringS * 0.3, peak * 0.32],
                                [ringS * 0.4, peak * 0.06], [ringS * 0.3, 0]]);
      src.connect(lp); lp.connect(b1); b1.connect(b2); b2.connect(g); g.connect(dest);
      if (run.delaySendLyre) g.connect(run.delaySendLyre);  // the brighter wall
      if (run.haloSendLyre) g.connect(run.haloSendLyre);    // …and the strings hear it
      src.start(t);
      src.stop(t + ringS + 0.1);        // the loop always ends — no leak
      // the pluck itself: 20 ms of noise through the same body
      var bu = PJ2.Voice.noiseBuffer.source(c, 30);
      var bg = c.createGain();
      PJ2.Voice.env(bg.gain, t, [[0.001, peak * 0.55], [0.019, 0]]);
      bu.connect(bg); bg.connect(lp);
      bu.start(t, bu.randomOffset);
      bu.stop(t + 0.05);
    }

    // The rolled chord. Draws first, every one of them, then the gates.
    function renderLyre(t, why) {
      var rng = run.streams.lyre;
      // rc.36 — how many strings the hand takes is a WEIGHTED touch draw
      // (2 in seven rolls, 3 in half, 4 in a third): a bare dyad some rolls,
      // a full hand others. Every draw on the lyre's own fork below is
      // unchanged in ORDER; only the count of velocity draws follows nV,
      // which at vary 0 is the desk's 3 and nothing moves.
      var nV = Math.round(clamp(wv("lyre", "voices", t), 2, 4));
      var v = chordVoices(rng, nV, true);          // draws the #4 coin
      var topDown = rng.chance(pVal("lyre", "updown"));
      var vels = [];
      for (var i = 0; i < nV; i++) vels.push(rng.rnd(0.6, 0.9));
      var restS = rng.rnd(4, 12);
      if (!v) return false;
      var rollS = wv("lyre", "roll", t);           // touch: per roll
      // …and the RING is drawn PER STRING, then dealt out longest to the
      // highest string: the top course of a lyre is the thinnest and rings
      // longest. Sorted, not scaled, so at vary 0 (every draw the same
      // number) the deal is a no-op.
      var rings = [];
      for (i = 0; i < nV; i++) rings.push(wv("lyre", "ring", t));
      rings.sort(function (a, b) { return a - b; });
      var ringTop = rings[rings.length - 1];
      var oct = Math.round(pVal("lyre", "register")) + chordLift();
      // THE LEVEL. Three factors, every one of them exactly 1 at the desk's
      // defaults (so vary 0 is rc.33 to the bit) and every one of them a
      // thing a real hand does:
      //   * the chord scale spreads a fixed loudness over however many
      //     strings the hand took — four strings are not louder than three;
      //   * a QUICK strum is a lighter one (the hand brushes, it does not
      //     dig), so the level follows the square root of the roll's length;
      //   * a string left ringing longer was let go more gently — the longer
      //     tail carries the same energy, not more.
      // Together they hold the rolled chord's worst-case sum AT the number
      // the rc.33 gain ledger books, which is what lets plan §11.3's spans
      // through in full: see the LEDGER note in the header.
      var vKnob = Math.round(clamp(pVal("lyre", "voices"), 2, 4));
      var rKnob = pVal("lyre", "roll"), gKnob = pVal("lyre", "ring");
      // …and it only ever THINS: LYRE_CHORD_SCALE is the shipped per-string
      // ceiling (rc.33's law that no scheduled string peak exceeds
      // 0.03 x 0.8), so a two-string roll stays at 0.8 and does not grow
      // into the room the third string vacated.
      var nScale = (nV > 1) ? clamp(LYRE_CHORD_SCALE * vKnob / nV, 0, LYRE_CHORD_SCALE) : 1;
      var rScale = (rKnob > 0) ? Math.min(1, Math.sqrt(rollS / rKnob)) : 1;
      var gScale = (ringTop > 0) ? Math.min(1, Math.sqrt(gKnob / ringTop)) : 1;
      var peak = LYRE_PEAK * nScale * rScale * gScale * chordThinLevel();
      if (!(peak > 0.00002)) return false;
      var span = rollS + ringTop;
      var tok = run.budget.claim(6 * nV, t + span + 0.3);
      if (!tok) return false;                      // graceful thinning
      run.tokens.push(tok);
      var order = v.degs.slice();
      if (topDown) order.reverse();
      var step = (order.length > 1) ? rollS / (order.length - 1) : 0;
      // THE ROLL'S SHAPE, free of any draw: a roll drawn SHORTER than the
      // knob is the hand gathering (the gaps close), one drawn LONGER is the
      // hand dragging (the gaps open). At the knob the exponent is exactly 1
      // and the old even spread is reproduced by the old arithmetic.
      var shape = (rKnob > 0) ? clamp((rollS - rKnob) / rKnob, -0.6, 0.6) : 0;
      var curve = 1 + 0.5 * shape;   // < 1 gathers, > 1 drags, exactly 1 at the knob
      var brightK = wv("lyre", "bright", t), bodyK = wv("lyre", "body", t);
      for (i = 0; i < order.length; i++) {
        var at = (curve === 1 || order.length < 2)
          ? (t + i * step)
          : (t + Math.pow(i / (order.length - 1), curve) * rollS);
        var freq = run.field.degFreq(order[i], oct);   // read AT SCHEDULE TIME
        // the highest-pitched string gets the longest of the drawn rings
        var rank = topDown ? (order.length - 1 - i) : i;
        var ringS = rings[rank];
        pluckString(at, freq, ringS, run.layLyre, peak * vels[i], brightK, bodyK);
        emitNote({
          voice: "lyre", kind: why, freq: freq, t: at, durS: ringS,
          deg: order[i], oct: oct, velocity: vels[i],
          // the scheduled envelope peak, carried so the release's THINNING is
          // assertable and not merely asserted (the lab's ledger did the same)
          peak: peak * vels[i],
          chord: v.name, sharp4: v.sharp4, down: topDown,
        });
      }
      run.lyreHoldUntil = t + span;                // a roll holds the lyre for its ring
      run.lyreRestUntil = t + span + restS;
      return true;
    }

    // The entry law, as a chance. `alighting-first` is FLAT — the evening's
    // first chord is the feather's cousin and presence does not gate it.
    function lyreChance(kind) {
      if (kind === "alighting-first") return run.lyreAlightDone ? 0 : 1;
      if (kind === "cadence") return LYRE_CADENCE_P;
      var base = LYRE_SCENE[curSceneType()];
      if (base == null) base = 0;
      if (curSceneType() === "release") base *= chordThinP();  // it thins as it climbs
      return base;
    }

    // One opportunity, one decision. The roll is drawn FIRST and
    // unconditionally; every gate comes after.
    function lyreConsider(kind, t) {
      if (!run || !run.live) return;
      var rng = run.streams.lyre;
      var roll = rng.next();                       // drawn first, unconditionally
      var base = lyreChance(kind);
      if (base <= 0) return;
      if (!rosterAllows("lyre") || isAbsent("lyre")) return;  // a cadence sounds inside the
                                                   // OUTGOING scene, so the
                                                   // current column is the one
                                                   // the roll happens in
                                                   // (rc.38: and an absent lyre
                                                   // makes no entry at all —
                                                   // signatures included)
      if (!chordAllows("lyre")) return;            // (open all the way — it climbs)
      if (t < run.lyreHoldUntil || t < run.lyreRestUntil) return;  // the hold law
      // rc.38 — the two SIGNATURES are flat: the alighting's first chord (the
      // feather's cousin) and the LIFT cadence's second door. A cadence door
      // is the cadence's gesture, not the voice's own pace, so presence does
      // not thin it; only an absence closes it.
      var p = (kind === "alighting-first" || kind === "cadence")
        ? base : base * pVal("lyre", "presence");
      if (roll >= clamp(p, 0, 1)) return;
      if (!renderLyre(t, kind)) return;
      if (kind === "alighting-first") run.lyreAlightDone = true;
    }

    // The lift cadence's SECOND door, 0.4 s past the arrival's onset — the
    // cello's own offset in the Library, and here it is load-bearing: the
    // concertina takes the consort body AT the arrival, so the lyre answering
    // 0.4 s AFTER is what keeps two doors belonging to two voices. Scheduled
    // on the FORM lane ("cadence"), which the desk's rate sliders never
    // scale: the roll is part of the cadence gesture, not of the lyre's pace.
    function lyreCadence(tArr, kind) {
      if (!run || !run.live || kind !== "lift") return;
      try {
        run.clock.lane("cadence").at(tArr + LYRE_CADENCE_OFFSET, function (t) {
          lyreConsider("cadence", t);
        });
      } catch (e) {}
    }

    // The lyre's own lane: the chord-NAME poll (the Library vessel's
    // mechanism — a step noticed is an opportunity; Ariel has no harmony-step
    // event) and, inside an alighting, the evening's first chord.
    function startLyre() {
      var lane = run.clock.lane("lyre");
      function poll(t) {
        var name = null;
        try { name = run.harmony.current().name; } catch (e) {}
        if (name != null) {
          var fresh = (run.lyreLastChord == null);
          if (!fresh && name !== run.lyreLastChord) {
            if (curSceneType() === "alighting" && !run.lyreAlightDone) lyreConsider("alighting-first", t);
            else lyreConsider("harmony", t);
          } else if (fresh && curSceneType() === "alighting" && !run.lyreAlightDone) {
            lyreConsider("alighting-first", t);    // the evening lands mid-chord
          }
          run.lyreLastChord = name;
        }
        lane.at(t + 2.5, poll);
      }
      lane.at(run.t0 + 2.5, poll);
    }

    // ========================================================================
    // THE CONCERTINA (landscape) — the air made audible, and the one spectrum
    // Ariel entirely lacked: a free reed. Held dyads, a second to speak and
    // three to let go (the landscape edge-slope rule, ≤ 0.02 per 0.5 s), and
    // on a lift cadence it may take the consort body from the aeolian.
    // ========================================================================
    var CONC_PEAK = 0.014;          // per part — the lab's design constant,
                                    // and exactly the aeolian consort's
    var CONC_SCENE = { alighting: 0, song: 0.2, flight: 0, hover: 0.4, swirl: 0, release: 0.15 };
    var CONC_TAKE_P = 0.4;          // …of LIFT cadences
    var CONC_CADENCE_LEVEL = 0.6;   // a taken cadence sits UNDER the consort it
                                    // replaces: the reed's 16 harmonics through
                                    // a +6 dB chamber carry roughly twice the
                                    // in-band power of the consort's sine pair,
                                    // so 0.6 × 0.014 × ≤2 ≈ 0.017 holds the
                                    // cadence contract's ≤ 1.5 dB by arithmetic
    var CONC_LO = -2, CONC_HI = 9;  // the box's window, in degrees

    // A least-motion dyad voicer of the concertina's own: each reed takes the
    // octave nearest where IT last stood, and the upper reed always stays
    // above the lower. Its memory is its own (run.concPrev) — the cadence
    // consort's voice-leading belongs to the consort, exactly as the
    // Library's regal keeps its book apart from the hum's.
    function voiceConcertina(classes) {
      var size = run.field.size;
      function fold(d) { return ((Math.round(d) % size) + size) % size; }
      var prev = run.concPrev, out = [];
      for (var i = 0; i < classes.length; i++) {
        var c0 = fold(classes[i]);
        var target = (prev && prev[i] != null) ? prev[i] : (i === 0 ? 0 : 4);
        var best = null, bestD = Infinity;
        for (var o = -1; o <= 2; o++) {
          var cand = c0 + o * size;
          if (cand < CONC_LO || cand > CONC_HI) continue;
          if (i > 0 && out.length && cand <= out[0]) continue;
          var dd = Math.abs(cand - target);
          if (dd < bestD) { bestD = dd; best = cand; }
        }
        out.push(best == null ? (c0 + (i > 0 ? size : 0)) : best);
      }
      run.concPrev = out;
      return out;
    }

    // THE BODY. Two reed waves `detune` cents apart per part, through the reed
    // chamber (a peaking 900 Hz at `reed` dB) and a 3 kHz lid, and every part
    // rides ONE bellows gain: a slow-noise pressure wander (±2 dB at 0.15 Hz)
    // plus the push/draw swell-and-sag every 3–5 s. Timings are given as the
    // consort's are (durS + fades) so a taken cadence can borrow the consort's
    // own seconds-long edges.
    function renderConcertina(degs, oct, t, durS, fadeIn, fadeOut, levelMul, pdRate, why) {
      if (!degs || !degs.length) return false;
      if (durS - fadeIn - fadeOut < 0.3) {
        fadeIn = fadeOut = Math.max(0.25, (durS - 0.3) / 2);
      }
      var hold = Math.max(0.05, durS - fadeIn - fadeOut);
      var tok = run.budget.claim(6 + 4 * degs.length, t + durS + 0.4);
      if (!tok) return false;
      run.tokens.push(tok);
      var c = ctx;
      var peak = CONC_PEAK * (levelMul || 1);
      // rc.36 — the bellows are a TOUCH draw per dyad (how hard this breath
      // is pushed); the reed is the box's CHARACTER for the evening plus a
      // signed per-dyad dB of its own, because a free reed is never twice
      // the same; the two reeds' distance is the instrument's own tuning and
      // holds all night. The push/draw period was already drawn per dyad on
      // the concertina's fork (3–5 s) and is untouched.
      var bellowsK = wv("concertina", "bellows", t);
      var reedDb = clamp(wv("concertina", "reed", t) + wv("concertina", "reedTouch", t), 0, 12);
      var detune = wv("concertina", "detune", t);
      // the bellows — one breath under every part
      var bell = c.createGain();
      bell.gain.setValueAtTime(0.85, t);
      var sn = slowNoise(c, 0.15);
      var sng = c.createGain();
      sng.gain.setValueAtTime(0.15 * bellowsK, t);
      sn.connect(sng);
      try { sng.connect(bell.gain); } catch (e0) {}
      sn.start(t, sn.randomOffset);
      sn.stop(t + durS + 0.3);
      var pd = c.createOscillator();
      pd.type = "sine";
      pd.frequency.setValueAtTime(pdRate, t);
      var pdg = c.createGain();
      pdg.gain.setValueAtTime(0.12 * bellowsK, t);
      pd.connect(pdg);
      try { pdg.connect(bell.gain); } catch (e1) {}
      pd.start(t);
      pd.stop(t + durS + 0.3);
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3000, t);
      lp.Q.setValueAtTime(0.7, t);
      lp.connect(bell);
      bell.connect(run.layConc);
      var wave = reedWave(c);
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], oct);   // read AT SCHEDULE TIME
        var chamber = c.createBiquadFilter();
        chamber.type = "peaking";
        chamber.frequency.setValueAtTime(900, t);
        chamber.Q.setValueAtTime(1.2, t);
        chamber.gain.setValueAtTime(reedDb, t);
        var g = c.createGain();
        PJ2.Voice.env(g.gain, t, [[fadeIn, peak], [hold, peak * 0.94], [fadeOut, 0]]);
        chamber.connect(g); g.connect(lp);
        for (var k = 0; k < 2; k++) {
          var o = c.createOscillator();
          if (wave && typeof o.setPeriodicWave === "function") o.setPeriodicWave(wave);
          else o.type = "sawtooth";
          o.frequency.setValueAtTime(freq, t);
          o.detune.setValueAtTime(k ? detune / 2 : -detune / 2, t);
          o.connect(chamber);
          o.start(t);
          o.stop(t + durS + 0.15);
        }
        emitNote({
          voice: "concertina", kind: why, freq: freq, t: t, durS: durS,
          deg: degs[i], oct: oct, attackS: fadeIn,
        });
      }
      return true;
    }

    // A free entry: one held dyad of the current chord.
    function concertinaEnter(t) {
      var rng = run.streams.concertina;
      var third = rng.chance(0.5);                 // drawn first, unconditionally
      var atk = rng.rnd(0.8, 1.5);
      var rel = rng.rnd(1.5, 3);
      var pdRate = 1 / rng.rnd(3, 5);
      var restS = rng.rnd(6, 14);
      var cur = null;
      try { cur = run.harmony.current(); } catch (e) {}
      if (!cur || !cur.chordDegs || !cur.chordDegs.length) return false;
      var src = cur.chordDegs;
      // On II the second home wants its open fifth — the I↔II planing IS the
      // Lydian float; elsewhere the box takes the 3rd or the 5th on a coin.
      var onII = (degClass(cur.rootDeg) === 1);
      var second = (onII || !third) ? 2 : 1;
      var classes = [src[0], src[Math.min(second, src.length - 1)]];
      var degs = voiceConcertina(classes);
      var hold = wv("concertina", "hold", t);   // rc.36: touch, the whole range per dyad
      var oct = Math.round(pVal("concertina", "register"));
      var durS = atk + hold + rel;
      if (!renderConcertina(degs, oct, t, durS, atk, rel, 1, pdRate, "hold")) return false;
      run.concHoldUntil = t + durS;
      run.concRestUntil = t + durS + restS;
      return true;
    }

    function concertinaConsider(t) {
      if (!run || !run.live) return;
      var rng = run.streams.concertina;
      var roll = rng.next();                       // drawn first, unconditionally
      var base = CONC_SCENE[curSceneType()];
      if (base == null) base = 0;
      if (base <= 0) return;
      if (!rosterAllows("concertina") || isAbsent("concertina")) return;   // rc.38
      if (!chordAllows("concertina")) return;      // silent from x ≥ 0.4
      if (t < run.concHoldUntil || t < run.concRestUntil) return;
      if (roll >= clamp(base * pVal("concertina", "presence"), 0, 1)) return;
      concertinaEnter(t);
    }

    // "THE CONCERTINA TAKES THE CONSORT" — drawn ONCE per cadence, before
    // anything is rendered, so the concertina's fork never depends on what the
    // aeolian did (the Library organist's contract, verbatim). When it lands,
    // the box voices BOTH cadence chords in the consort's place, as a DYAD
    // taken from the consort's own voicing — the outer two parts — so the
    // arrival is voiced ABOVE the approach by construction, which is what the
    // cadence event's `arrivalAbove` reports. The breeze's cadence pads are
    // untouched and the arrival still lands exactly on the boundary.
    //
    // NOT roster-gated: a cadence is a boundary gesture under the cadence
    // contract — the same contract that lets the aeolian consort surface
    // where the aeolian bed rests — and taking that cadence from the consort
    // IS the gesture (see the SCENE ROSTER note at the top of this file).
    function concertinaTakesCadence(plan, tA) {
      if (!run || !run.live) return false;
      var rng = run.streams.concertina;
      var roll = rng.next();                       // drawn first, unconditionally
      if (plan.kind !== "lift") return false;      // the LIFT's door, and only it
      if (isAbsent("concertina")) return false;    // rc.38: away tonight — the
                                                   // aeolian consort sounds as
                                                   // it did before the box came
      if (!chordAllows("concertina")) return false;
      if (tA < run.concHoldUntil) return false;    // the hold law
      // rc.38 — NOT thinned: a cadence door is the cadence's gesture. (The
      // presence knob was here at rc.33 and is deliberately gone; at the old
      // default of 1 the two expressions are the same number, so nothing
      // pre-rc.38 changes.)
      return roll < clamp(CONC_TAKE_P, 0, 1);
    }
    // The dyad the box takes from a consort voicing: its outer two parts (at
    // nParts 2 that is the voicing itself). vB = climbAbove(vA) is elementwise
    // above vA, so the same indices keep the rise.
    function consortDyad(v) {
      if (!v || !v.length) return null;
      return (v.length <= 2) ? v.slice() : [v[0], v[v.length - 1]];
    }

    // The concertina's own lane: the chord-name poll.
    function startConcertina() {
      var lane = run.clock.lane("concertina");
      function poll(t) {
        var name = null;
        try { name = run.harmony.current().name; } catch (e) {}
        if (name != null) {
          if (run.concLastChord != null && name !== run.concLastChord) concertinaConsider(t);
          run.concLastChord = name;
        }
        lane.at(t + 2.5, poll);
      }
      lane.at(run.t0 + 2.5, poll);
    }

    // ========================================================================
    // THE HANDPAN (landscape-chordal) — THE ANSWER. Three sines at 1 : 2 : 3
    // over a mallet thump, in the empty band between the bass and the breeze.
    // It speaks only when a WHISTLE PHRASE ENDS: it answers, it does not
    // accompany, and it is never inside the song it is answering.
    // ========================================================================
    var PAN_PEAK = 0.028;        // per note — the lab's design constant
    var PAN_ANSWER_P = 0.35;     // × presence, × the still-air preference
    var PAN_ANSWER_GAP = 0.25;   // …s after the phrase's span ends

    function panNote(t, f, ringS, dest, peak, partialsK, thumpK) {
      var c = ctx;
      var g = c.createGain();
      g.connect(dest);
      if (run.delaySendPan) g.connect(run.delaySendPan);    // the brighter wall
      PJ2.Voice.env(g.gain, t, [[0.006, peak], [ringS * 0.35, peak * 0.3], [ringS * 0.65, 0]]);
      // 1 : 2 : 3 at 1 / 0.5 / 0.25, the upper partials decaying faster than
      // the fundamental (×0.7 and ×0.5 of its ring) — a struck shell, not an
      // organ pipe.
      var ratios = [[1, 1, 1], [2, 0.5, 0.7], [3, 0.25, 0.5]];
      for (var i = 0; i < ratios.length; i++) {
        var amp = ratios[i][1] * (i === 0 ? 1 : partialsK * 2);
        if (!(amp > 0.001)) continue;
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(f * ratios[i][0], t);
        var og = c.createGain();
        var pr = ringS * ratios[i][2];
        PJ2.Voice.env(og.gain, t, [[0.006, amp], [pr * 0.4, amp * 0.28], [pr * 0.6, 0]]);
        o.connect(og); og.connect(g);
        o.start(t);
        o.stop(t + ringS + 0.1);
      }
      if (thumpK > 0) {                 // the hand's own low knock
        var ns = PJ2.Voice.noiseBuffer.source(c, 30);
        var tg = c.createGain();
        PJ2.Voice.env(tg.gain, t, [[0.002, peak * 0.5 * thumpK], [0.013, 0]]);
        var tlp = c.createBiquadFilter();
        tlp.type = "lowpass";
        tlp.frequency.setValueAtTime(500, t);
        tlp.Q.setValueAtTime(0.7, t);
        ns.connect(tg); tg.connect(tlp); tlp.connect(g);
        ns.start(t, ns.randomOffset);
        ns.stop(t + 0.05);
      }
    }

    function renderHandpan(t) {
      var rng = run.streams.handpan;
      var nN = rng.rint(2, 4);                     // draws first, all of them
      var v = chordVoices(rng, Math.max(3, nN), true);
      var arch = rng.chance(0.45);
      var restS = rng.rnd(5, 14);
      if (!v) return false;
      var degs = v.degs.slice(0, nN);
      // descending, or an arch (up then back to the top) — an answer, not a scale
      degs = degs.slice().reverse();
      if (arch && degs.length > 2) degs.push(degs[0]);
      var ringS = wv("handpan", "ring", t);     // touch: per answer
      var gap = wv("handpan", "gap", t);        // touch: per answer…
      var oct = Math.round(pVal("handpan", "register")) + chordLift();
      // …and UNEVEN inside it: an answer is a phrase, not a clock. One
      // jitter draw per step, and when every one of them is exactly 1 (vary
      // 0) the offsets are computed by the old multiplication, to the bit.
      var jit = [], even = true, i;
      for (i = 1; i < degs.length; i++) {
        var jv = wv("handpan", "gapJitter", t);
        if (jv !== 1) even = false;
        jit.push(jv);
      }
      var offs = [0], acc = 0;
      for (i = 0; i < jit.length; i++) { acc += gap * jit[i]; offs.push(even ? (i + 1) * gap : acc); }
      var span = offs[offs.length - 1];
      // A TIGHTER ANSWER IS A LIGHTER ONE — fingers moving fast do not also
      // strike harder — and a shell left ringing longer was struck no
      // harder either. Both are exactly 1 at the desk's defaults, and
      // together they hold the answer's worst-case sum at the number the
      // rc.33 ledger books (header, LEDGER).
      var gKnob = pVal("handpan", "gap"), rKnob = pVal("handpan", "ring");
      var avgStep = span / Math.max(1, degs.length - 1);   // the jitter is inside it
      var gScale = (gKnob > 0) ? Math.min(1, avgStep / gKnob) : 1;
      var rScale = (ringS > 0) ? Math.min(1, Math.sqrt(rKnob / ringS)) : 1;
      var peak = PAN_PEAK * gScale * rScale * chordThinLevel();
      var tok = run.budget.claim(5 * degs.length, t + span + ringS + 0.4);
      if (!tok) return false;
      run.tokens.push(tok);
      var partialsK = wv("handpan", "partials", t), thumpK = wv("handpan", "thump", t);
      for (i = 0; i < degs.length; i++) {
        var at = t + offs[i];
        var freq = run.field.degFreq(degs[i], oct);   // read AT SCHEDULE TIME
        panNote(at, freq, ringS, run.layPan, peak, partialsK, thumpK);
        emitNote({
          voice: "handpan", kind: arch ? "arch" : "answer", freq: freq, t: at,
          durS: ringS, deg: degs[i], oct: oct, chord: v.name, sharp4: v.sharp4,
        });
      }
      run.panHoldUntil = t + span + ringS * 0.5;
      run.panRestUntil = t + span + ringS + restS;
      return true;
    }

    // One answer's decision, taken when the lane fires at the phrase's end.
    function panConsider(t) {
      if (!run || !run.live) return;
      var rng = run.streams.handpan;
      var roll = rng.next();                       // drawn first, unconditionally
      var st = curSceneType();
      if (st !== "song" && st !== "hover") return; // never a flight or the swirl:
                                                   // they have clouds enough
      if (!rosterAllows("handpan") || isAbsent("handpan")) return;   // rc.38
      if (!chordAllows("handpan")) return;         // out from x ≥ 0.5
      if (t < run.panHoldUntil || t < run.panRestUntil) return;
      // it prefers still air (the gustiness gate — the lab's own weighting)
      var p = PAN_ANSWER_P * (1 - 0.5 * wxAt(t).gustiness) * pVal("handpan", "presence");
      if (roll >= clamp(p, 0, 1)) return;
      renderHandpan(t);
    }

    // THE CUE. Called from startWhistle the moment a phrase's span ends — a
    // CALL, not a draw: rc.33 adds NO draw to the whistle's fork. The answer's
    // dice are thrown inside panConsider, on the HANDPAN's own fork, when its
    // lane fires 0.25 s later.
    function handpanCue(tEnd) {
      if (!run || !run.live) return;
      try {
        run.clock.lane("handpan").at(tEnd + PAN_ANSWER_GAP, function (t) { panConsider(t); });
      } catch (e) {}
    }

    // ========================================================================
    // THE VIBRAPHONE (landscape-chordal) — the Day Off's lounge. Sine plus a
    // fourth partial under a MOTOR: the rotating discs' amplitude tremolo,
    // which is the one thing that makes a vibraphone a vibraphone. Its
    // gesture is a BLOCK — a dyad or triad struck TOGETHER, never rolled.
    // ========================================================================
    var VIB_PEAK = 0.025;        // per bar — the lab's design constant
    var VIB_SCENE = { alighting: 0.5, song: 0.15, flight: 0, hover: 0.4, swirl: 0, release: 0 };
    var VIB_ALIGHT_STEPS = 2;    // …the alighting's first two steps, and no more

    function renderVibraphone(t) {
      var rng = run.streams.vibraphone;
      var nN = rng.chance(0.5) ? 2 : 3;            // draws first, all of them
      var v = chordVoices(rng, Math.max(3, nN), true);
      var restS = rng.rnd(6, 14);
      if (!v) return false;
      var degs = v.degs.slice(0, nN);
      // rc.36 — the pedal is a touch (per strike); the MOTOR is set once and
      // left, so its speed and its depth are the evening's character. A motor
      // that changed per note would read as a fault, not as playing.
      var ringS = wv("vibraphone", "ring", t);
      var oct = Math.round(pVal("vibraphone", "register")) + chordLift();
      var peak = VIB_PEAK * chordThinLevel();
      var motor = wv("vibraphone", "motor", t), depth = wv("vibraphone", "depth", t);
      var tok = run.budget.claim(4 + 5 * degs.length, t + ringS + 0.4);
      if (!tok) return false;
      run.tokens.push(tok);
      var c = ctx;
      // ONE motor for the whole block — the bars share a shaft.
      var motorGain = c.createGain();
      motorGain.gain.setValueAtTime(1 - depth * 0.5, t);
      motorGain.connect(run.layVib);
      if (run.delaySendVib) motorGain.connect(run.delaySendVib);   // the brighter wall
      var lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(motor, t);
      var lg = c.createGain();
      lg.gain.setValueAtTime(depth * 0.5, t);
      lfo.connect(lg);
      try { lg.connect(motorGain.gain); } catch (e0) {}
      lfo.start(t);
      lfo.stop(t + ringS + 0.3);
      for (var i = 0; i < degs.length; i++) {
        var freq = run.field.degFreq(degs[i], oct);   // read AT SCHEDULE TIME
        var g = c.createGain();
        PJ2.Voice.env(g.gain, t, [[0.004, peak], [ringS * 0.3, peak * 0.3], [ringS * 0.7, 0]]);
        g.connect(motorGain);
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, t);
        o.connect(g);
        o.start(t);
        o.stop(t + ringS + 0.15);
        var p4 = c.createOscillator();            // the bar's 4th partial
        p4.type = "sine";
        p4.frequency.setValueAtTime(freq * 4, t);
        var p4g = c.createGain();
        PJ2.Voice.env(p4g.gain, t, [[0.003, 0.18], [ringS * 0.25, 0.02], [ringS * 0.2, 0]]);
        p4.connect(p4g); p4g.connect(g);
        p4.start(t);
        p4.stop(t + ringS + 0.15);
        emitNote({
          voice: "vibraphone", kind: "block", freq: freq, t: t, durS: ringS,
          deg: degs[i], oct: oct, chord: v.name, sharp4: v.sharp4,
        });
      }
      run.vibHoldUntil = t + ringS * 0.6;
      run.vibRestUntil = t + ringS + restS;
      return true;
    }

    function vibraphoneConsider(t) {
      if (!run || !run.live) return;
      var rng = run.streams.vibraphone;
      var roll = rng.next();                       // drawn first, unconditionally
      var st = curSceneType();
      var base = VIB_SCENE[st];
      if (base == null) base = 0;
      if (st === "alighting" && run.alightSteps > VIB_ALIGHT_STEPS) base = 0;
      if (base <= 0) return;
      if (!rosterAllows("vibraphone") || isAbsent("vibraphone")) return;   // rc.38
      if (!chordAllows("vibraphone")) return;      // out from x ≥ 0.5
      if (t < run.vibHoldUntil || t < run.vibRestUntil) return;
      // still air, like the handpan: the lounge is not for a gale
      var p = base * (1 - 0.5 * wxAt(t).gustiness) * pVal("vibraphone", "presence");
      if (roll >= clamp(p, 0, 1)) return;
      renderVibraphone(t);
    }

    function startVibraphone() {
      var lane = run.clock.lane("vibraphone");
      function poll(t) {
        var name = null;
        try { name = run.harmony.current().name; } catch (e) {}
        if (name != null) {
          if (run.vibLastChord != null && name !== run.vibLastChord) vibraphoneConsider(t);
          run.vibLastChord = name;
        }
        lane.at(t + 2.5, poll);
      }
      lane.at(run.t0 + 2.5, poll);
    }

    // ---- ambient (landscape — the sky's sparse events) -----------------------
    // v1's playful pool, weather-gated, giggle RETIRED, everything pitched
    // snapped to the live field (in this sky even the birds read along —
    // well: the birds stay texture; the CHIME, BEE and BUBBLES keep the key).
    function startAmbient() {
      var lane = run.clock.lane("ambient");
      var rng = run.streams.ambient;

      // -- birdsong (v1 ~5481): 2–5 rising chirps. Texture (freq null).
      function birdsong(t) {
        var chirps = rng.rint(2, 5);
        var baseF = rng.rnd(1050, 2400);
        var tok = run.budget.claim(2 * chirps, t + chirps * 0.2 + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var at = 0;
        for (var i = 0; i < chirps; i++) {
          var ct = t + at;
          var dur = rng.rnd(0.06, 0.1);
          var sf = baseF + rng.rnd(0, 500);
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(sf, ct);
          o.frequency.exponentialRampToValueAtTime(sf * 2.3, ct + dur);
          var g = c.createGain();
          o.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, ct, [[0.006, 0.02], [dur - 0.006, 0.001], [0.02, 0]]);
          o.start(ct);
          o.stop(ct + dur + 0.03);
          at += rng.rnd(0.12, 0.2);
        }
        emitNote({ voice: "ambient", kind: "birdsong", freq: null, t: t, durS: at });
      }

      // -- sparkle (v1 ~5530): 5–11 tiny high pings. Texture.
      function sparkle(t) {
        var pings = rng.rint(5, 11);
        var rate = rng.rnd(12, 36);
        var minF = rng.rnd(1500, 2400);
        var maxF = rng.rnd(4500, 7350);
        var tok = run.budget.claim(2, t + pings / rate + 0.5);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        // Node economy: ONE oscillator retuned at zero-gain instants under a
        // multi-hump envelope (the cricket port's trick, applied here).
        var o = c.createOscillator();
        o.type = "sine";
        var g = c.createGain();
        o.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0, spacing = 1 / rate;
        for (var i = 0; i < pings; i++) {
          o.frequency.setValueAtTime(rng.rnd(minF, maxF), t + at);
          segs.push([0.003, 0.01]);
          segs.push([Math.max(0.02, spacing * 0.6), 0.0008]);
          segs.push([Math.max(0.005, spacing * 0.4 - 0.023), 0]);
          at += 0.003 + Math.max(0.02, spacing * 0.6) + Math.max(0.005, spacing * 0.4 - 0.023);
        }
        PJ2.Voice.env(g.gain, t, segs);
        o.start(t);
        o.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "sparkle", freq: null, t: t, durS: at });
      }

      // -- leaf rustle (v1 ~5556): one short bandpassed swish. Texture.
      function leafRustle(t) {
        var dur = rng.rnd(0.25, 0.6);
        var cf = rng.rnd(2500, 4000);
        var tok = run.budget.claim(3, t + dur + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var n = PJ2.Voice.noiseBuffer.source(c, 30);
        var f = c.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.setValueAtTime(cf, t);
        f.Q.setValueAtTime(5, t);
        var g = c.createGain();
        n.connect(f); f.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[dur * 0.3, 0.012], [dur * 0.7, 0]]);
        n.start(t, n.randomOffset);
        n.stop(t + dur + 0.1);
        emitNote({ voice: "ambient", kind: "leaf", freq: null, t: t, durS: dur });
      }

      // -- cricket (v1 ~5577, node-economy port from the Library rework).
      function cricket(t) {
        var chirps = rng.rint(3, 6);
        var rate = rng.rnd(1.7, 2.4);
        var pulses = rng.rint(3, 5);
        var carrier = rng.rnd(4100, 5300);
        var spacing = 1 / rate, pulseSpacing = 1 / 35;
        var total = (chirps - 1) * spacing + pulses * pulseSpacing + 0.1;
        var tok = run.budget.claim(2, t + total + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var o = c.createOscillator();
        o.type = "sine";
        var g = c.createGain();
        o.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var k = 0; k < chirps; k++) {
          var cFreq = carrier * rng.rnd(0.97, 1.03);
          var pd = rng.rnd(0.014, 0.022);
          o.frequency.setValueAtTime(cFreq, t + k * spacing);
          if (k * spacing > at) { segs.push([k * spacing - at, 0]); at = k * spacing; }
          for (var i = 0; i < pulses; i++) {
            segs.push([0.002, 0.0085]);
            segs.push([Math.max(0.004, pd - 0.002), 0.0008]);
            segs.push([Math.max(0.002, pulseSpacing - pd - 0.002), 0]);
            at += 0.002 + Math.max(0.004, pd - 0.002) + Math.max(0.002, pulseSpacing - pd - 0.002);
          }
        }
        PJ2.Voice.env(g.gain, t, segs);
        o.start(t);
        o.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "cricket", freq: null, t: t, durS: at });
      }

      // -- wind chime (v1 ~5612): glassy inharmonic partials, fundamental
      // SNAPPED to the field (v1 did this too — arielSnapToScale).
      function windChime(t) {
        var pings = rng.rint(3, 6);
        var rate = rng.rnd(2.5, 5);
        var minF = rng.rnd(800, 1100);
        var maxF = rng.rnd(1600, 2400);
        var tok = run.budget.claim(3 * pings, t + pings / rate + 2.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var at = 0;
        for (var i = 0; i < pings; i++) {
          var pt = t + at;
          var fund = run.field.snap(rng.rnd(minF, maxF));
          var partials = [[1.0, 1.0, 1.8], [2.4, 0.5, 1.26], [4.5, 0.25, 0.81]];
          for (var j = 0; j < partials.length; j++) {
            var o = c.createOscillator();
            o.type = "sine";
            o.frequency.setValueAtTime(fund * partials[j][0], pt);
            var g = c.createGain();
            o.connect(g); g.connect(run.layAmb);
            PJ2.Voice.env(g.gain, pt, [[0.005, 0.02 * partials[j][1]], [partials[j][2], 0.0008], [0.05, 0]]);
            o.start(pt);
            o.stop(pt + partials[j][2] + 0.1);
          }
          emitNote({ voice: "ambient", kind: "windchime", freq: fund, t: pt, durS: 1.8 });
          at += (1 / rate) * rng.rnd(0.85, 1.15);
        }
      }

      // -- bumble bee (v1 ~5648): buzzing sawtooth doppler, pitch snapped.
      function bumbleBee(t) {
        var dur = rng.rnd(1, 2);
        var basePitch = run.field.snap(rng.rnd(160, 245));
        var buzzRate = rng.rnd(22, 44);
        var tok = run.budget.claim(5, t + dur + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var vol = 0.025;
        var carrier = c.createOscillator();
        carrier.type = "sawtooth";
        carrier.frequency.setValueAtTime(basePitch * 0.7, t);
        carrier.frequency.linearRampToValueAtTime(basePitch, t + dur * 0.4);
        carrier.frequency.linearRampToValueAtTime(basePitch * 0.55, t + dur);
        var mod = c.createOscillator();
        mod.type = "sine";
        mod.frequency.setValueAtTime(buzzRate, t);
        var modG = c.createGain();
        modG.gain.setValueAtTime(vol * 0.5, t);
        mod.connect(modG);
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(900, t);
        lp.Q.setValueAtTime(0.7, t);
        var g = c.createGain();
        try { modG.connect(g.gain); } catch (e) {}
        carrier.connect(lp); lp.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[dur * 0.25, vol], [dur * 0.5, vol * 0.6], [dur * 0.25, 0]]);
        carrier.start(t); carrier.stop(t + dur + 0.1);
        mod.start(t); mod.stop(t + dur + 0.1);
        emitNote({ voice: "ambient", kind: "bee", freq: basePitch, t: t, durS: dur });
      }

      // -- bubbles (v1 arielBubbles ~4979 + bubblePop folded together):
      // 1–3 rising sine glissandos, start AND end snapped to the field.
      function bubbles(t) {
        var count = rng.chance(0.66) ? rng.rint(2, 3) : 1;
        var tok = run.budget.claim(2 * count, t + count * 0.5 + 1.6);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        var at = 0;
        for (var bi = 0; bi < count; bi++) {
          var bt = t + at;
          var startF = run.field.snap(rng.rnd(400, 1200));
          var endF = run.field.snap(startF * rng.rnd(1.5, 3));
          var dur = rng.rnd(0.3, 1.5);
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(startF, bt);
          o.frequency.exponentialRampToValueAtTime(endF, bt + dur);
          var g = c.createGain();
          o.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, bt, [[dur * 0.15, 0.022], [dur * 0.45, 0.018], [dur * 0.4, 0]]);
          o.start(bt);
          o.stop(bt + dur + 0.1);
          emitNote({ voice: "ambient", kind: "bubble", freq: startF, endFreq: endF, t: bt, durS: dur });
          at += rng.rnd(0.2, 0.5);
        }
      }

      function oneShot(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var st = curSceneType();
        var wx = wxAt(t);
        var late = (st === "hover" || st === "release") ? 1 : 0;
        var still = 1 - tide;
        var gustGate = Math.max(0, wx.gustiness - 0.5);
        // Weights shape WHICH sound fires, never HOW OFTEN — one fire = one
        // event; the gap law below owns the density (family contract).
        var what = rng.pickW([
          ["birdsong", 1.0 + 1.2 * (st === "song" ? 1 : 0) + 0.8 * wx.shimmer],
          ["gust", 0.4 + 3 * gustGate],
          ["sparkle", 0.5 + 1.4 * wx.shimmer],
          ["leaf", 0.5 + 2.5 * gustGate],
          ["cricket", (0.2 + 1.2 * late) * (1 - 0.7 * iv)],
          ["windchime", 0.8 + 1.2 * wx.gustiness],
          ["bee", 0.3 + 0.9 * still * (1 - late)],
          ["bubbles", 0.6],
        ]);
        try {
          if (what === "birdsong") birdsong(t);
          else if (what === "gust") renderGust(t, rng.rnd(2.5, 4.5), 0.016, rng, "ambient");
          else if (what === "sparkle") sparkle(t);
          else if (what === "leaf") leafRustle(t);
          else if (what === "cricket") cricket(t);
          else if (what === "windchime") windChime(t);
          else if (what === "bee") bumbleBee(t);
          else if (what === "bubbles") bubbles(t);
        } catch (e) { /* a missing one-shot is just a quieter sky */ }
        // THE GAP LAW — the family density contract, thermals' sanctioned
        // ±15%, and the desk's density knob (def 1 = as-composed).
        var next = rng.rnd(18, 50) * (1.3 - 0.6 * iv - 0.15 * tide) * gmAt(t) / wv("ambient", "density", t);
        lane.at(t + Math.max(7, next), oneShot);
      }
      lane.at(run.t0 + rng.rnd(8, 18), oneShot);
    }

    // ---- the follower (landscape levels track the conductor) -----------------
    // Every 0.5 s: breezeLevel and aeoLevel converge on intensity-shaped
    // targets with anchored ramps; the halo breathes with weather.altitude
    // and RISES through the release (the opposite of the Library's
    // candle-out gutter — the strings are the last thing still shining).
    // Also the housekeeping beat: prune long-expired budget tokens.
    function startFollower() {
      var lane = run.clock.lane("follow");
      function follow(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var st = curSceneType();
        var haloV = (0.015 + 0.05 * wxAt(t).altitude) * wv("halo", "level", t); // rc.36: character
        if (st === "release") haloV = haloV + (0.09 - haloV) * curSceneX();
        run.haloLevelCur = haloV;
        try { run.halo.setLevel(haloV, 0.5); } catch (eH) {}
        var bTarget = (0.10 + 0.55 * iv) * (1.05 - 0.1 * tide);
        var aTarget = (iv < 0.15) ? 0 : clamp((iv - 0.15) / 0.3, 0, 1) * 0.9;
        var K = 0.34;
        var bNext = run.breezeCur + (bTarget - run.breezeCur) * K;
        var aNext = run.aeoCur + (aTarget - run.aeoCur) * K;
        run.breezeLevel.gain.setValueAtTime(run.breezeCur, t);
        run.breezeLevel.gain.linearRampToValueAtTime(bNext, t + 0.5);
        run.aeoLevel.gain.setValueAtTime(run.aeoCur, t);
        run.aeoLevel.gain.linearRampToValueAtTime(aNext, t + 0.5);
        run.breezeCur = bNext;
        run.aeoCur = aNext;
        if (run.tokens.length > 64) {
          var keep = [];
          for (var i = 0; i < run.tokens.length; i++) {
            var tk = run.tokens[i];
            if (tk.endTimeS != null && tk.endTimeS < t - 3) run.budget.release(tk);
            else keep.push(tk);
          }
          run.tokens = keep;
        }
        lane.at(t + 0.5, follow);
      }
      lane.at(run.t0, follow);
    }

    // ========================================================================
    // PLAY / STOP — the Library's lifecycle, verbatim semantics: stop fades
    // the bus ~1.5 s, cancels the writers, settles the budget's books and
    // suspends the ctx; play after stop RESTARTS the whole seeded run
    // (reproducibility over tide continuity — the documented family choice).
    // ========================================================================

    function ensureCtx() {
      if (ctx) return ctx;
      var AC = (typeof window !== "undefined") ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) throw new Error("PJ2.Ariel: no AudioContext available");
      ctx = new AC();
      return ctx;
    }

    var LANE_NAMES = [
      "breeze", "whistle", "chime", "flutter", "bass", "aeolian",
      "aeolianSing", "ambient", "follow", "harmony", "cadence",
      "seachange", "release",
      "lyre", "concertina", "handpan", "vibraphone",   // rc.33
    ];

    function finalize(r) {
      if (!r || r.finalized) return;
      r.finalized = true;
      r.live = false;
      if (r.finalizeId != null) {
        try { r.clock.cancel(r.finalizeId); } catch (e) {}
        r.finalizeId = null;
      }
      try { r.conductor.stop(); } catch (e) {}
      try { r.clock.stop(); } catch (e) {}
      for (var i = 0; i < r.tokens.length; i++) {
        try { r.budget.release(r.tokens[i]); } catch (e) {}
      }
      r.tokens = [];
      try { if (r.bus && r.bus.output && r.bus.output.disconnect) r.bus.output.disconnect(); } catch (e) {}
      try { if (r.roomClose && r.roomClose.output.disconnect) r.roomClose.output.disconnect(); } catch (e) {}
      try { if (r.roomSky && r.roomSky.output.disconnect) r.roomSky.output.disconnect(); } catch (e) {}
      try { if (r.delayA && r.delayA.output.disconnect) r.delayA.output.disconnect(); } catch (e) {}
      try { if (r.delayB && r.delayB.output.disconnect) r.delayB.output.disconnect(); } catch (e) {}
      try { if (ctx && typeof ctx.suspend === "function") ctx.suspend(); } catch (e) {}
      stopping = false;
    }

    function play() {
      if (playing) return;
      if (run && !run.finalized) finalize(run);
      var c = ensureCtx();
      try { if (typeof c.resume === "function") c.resume(); } catch (e) {}

      if (!PJ2.Motif || !PJ2.Motif.create || !PJ2.Harmony || !PJ2.Harmony.create) {
        throw new Error("PJ2.Ariel: needs pj2-motif.js and pj2-harmony.js loaded first");
      }
      if (!PJ2.Fx || !PJ2.Fx.delay || !PJ2.Fx.sympathetic || !PJ2.Fx.weather || !PJ2.Fx.roomBlend) {
        throw new Error("PJ2.Ariel: needs pj2-fx.js loaded (after pj2-voice.js, before pj2-air.js)");
      }

      // ---- one fresh world per play, all of it derived from the seed ----
      var master = PJ2.Rand.stream(seed);
      var clock = PJ2.Clock.create(c, { tickMs: 25, aheadS: 0.25 });
      var bus = PJ2.Voice.buildBus(c, { volume: masterVol, title: "Prospero's Jukebox v2 — Ariel" });
      for (var ai = 0; ai < analysers.length; ai++) {
        try { bus.attachAnalyser(analysers[ai]); } catch (e) {}
      }
      var streams = {
        conductor: master.fork("conductor"),
        breeze: master.fork("breeze"),
        whistle: master.fork("whistle"),
        chime: master.fork("chime"),
        flutter: master.fork("flutter"),
        bass: master.fork("bass"),
        aeolian: master.fork("aeolian"),
        aeolianSing: master.fork("aeolianSing"),
        ambient: master.fork("ambient"),
        joints: master.fork("joints"),
        air: master.fork("air"),
        motif: master.fork("motif"),
        harmony: master.fork("harmony"),
        harmonyLane: master.fork("harmony:lane"),
        cadence: master.fork("cadence"),
        seachange: master.fork("seachange"),
        ghost: master.fork("ghost"),        // the promotion coin + the drive
        gust: master.fork("gust"),          // release exhales
        weather: master.fork("weather"),    // 4 draws/channel at build, pure after
        fx: master.fork("fx"),              // wall A's drift phase (1 draw)
        fx2: master.fork("fx2"),            // wall B's drift phase (1 draw)
        delaySend: master.fork("delaySend"),
        rooms: master.fork("rooms"),
        // rc.33 — four NEW label-hashed forks. Nothing pre-existing gains a
        // draw: the four voices' dice are entirely their own.
        lyre: master.fork("lyre"),
        concertina: master.fork("concertina"),
        handpan: master.fork("handpan"),
        vibraphone: master.fork("vibraphone"),
      };

      // rc.36 — ONE WANDER PER LAYER, forked off the same master. Its draws
      // live on labels of its own ("wander:<layer>:touch|weather|dress:<n>"),
      // so the table above still advances exactly as it did at rc.33: the
      // same seed plays the same evening, and at vary 0 the same notes.
      var wanders = {};
      if (PJ2.Voice && PJ2.Voice.wander) {
        for (var wlk in LAYER_PARAMS) {
          wanders[wlk] = PJ2.Voice.wander({
            root: master,
            layer: wlk,
            params: LAYER_PARAMS[wlk],
            knob: (function (L) { return function (k) { return pVal(L, k); }; })(wlk),
            vary: (function (L) { return function () { return pVal(L, "vary"); }; })(wlk),
          });
        }
      }

      // TWO ROOMS: the close air (short, bright — v1 Ariel's decay 3.0
      // world, tightened) and THE SKY (5.2 s, GENTLER HF damping than the
      // Library's hall: open air, not a dark hall — brightness exponent 1.2
      // vs the hall's 1.9, with a slow tail swell).
      var roomClose = PJ2.Voice.reverb(c, { decayS: 1.8, preDelayS: 0.015, wet: 0.3, brightness: 0.95, ripple: 0.02 });
      // The sky is a REAL space (owner, 2026-08-04, chosen by ear in
      // room-mockup-ariel.html at wet ×1.2 — hence 0.41, not the old 0.34):
      // Tvísöngur, the tuned concrete singing-dome sound sculpture above
      // Seyðisfjörður, Iceland (OpenAIR model measurement, AudioLab
      // University of York, CC BY-SA; provenance in ir/README.md). Resonant
      // domes for a spirit of the air. The generated-noise spec below is
      // the FALLBACK pour if the measured file can't load — decayS 5.2
      // keeps that fallback sounding like the sky the scenes were voiced
      // against.
      var roomSky = PJ2.Voice.reverb(c, { decayS: 5.2, preDelayS: 0.04, wet: 0.41, brightness: 1.2, ripple: { depth: 0.04, hz: 0.3 }, irUrl: "ir/rooms/ariel-sky-tvisongur.wav" });
      roomClose.output.connect(bus.input);
      roomSky.output.connect(bus.input);
      var roomBlend = PJ2.Fx.roomBlend(c, { close: roomClose, wide: roomSky, balance: 0.25 });

      var budget = PJ2.Voice.budget(32).bindClock(clock);
      var field = PJ2.Pitch.field({ tonicHz: 349, mode: "lydian", tuning: "et" }); // v1 Ariel's world

      // MIXER WIRING HELPERS (see MIX_LAYERS / pj2-library's design note):
      // mAttach registers one gain param under a user layer, tags the node,
      // and stamps design x the user's CURRENT setting as its initial value
      // (stop/play persistence; at the defaults every value is the design
      // value exactly). mSlotWraps builds a melodic voice's per-seat wraps
      // over the shared panner pool.
      var mix = {};
      for (var mki = 0; mki < MIX_LAYERS.length; mki++) mix[MIX_LAYERS[mki].key] = [];
      function mAttach(key, node, design) {
        var v0 = design * mixEff(key);
        node.gain.setValueAtTime(v0, clock.now());
        node._pj2Mix = key;
        mix[key].push({ p: node.gain, design: design, v0: v0, t0: clock.now(), v1: v0, t1: clock.now() });
        return node;
      }
      function mSlotWraps(key, pool) {
        var slots = [], wraps = [];
        for (var swi = 0; swi < pool.pans.length; swi++) {
          var seat = pool.at(pool.pans[swi]);
          var wg = mAttach(key, c.createGain(), 1);
          wg.connect(seat);
          slots.push(seat);
          wraps.push(wg);
        }
        return { slots: slots, wraps: wraps };
      }

      // LAYER SOURCES — registered with the blender; speakers forward, the
      // ambient sky and the halo deeper, the bass nearly dry (low end in a
      // 5 s tail is mud, not air).
      var layMel = c.createGain();
      layMel.gain.setValueAtTime(1, clock.now()); // NOT mixer-owned: the per-seat wraps split the voices upstream
      var layAeo = mAttach("aeolian", c.createGain(), 1);
      var layAmb = mAttach("ambient", c.createGain(), 1);
      var layHalo = mAttach("halo", c.createGain(), 1);
      var layBass = mAttach("bass", c.createGain(), 1);
      // rc.33 — one layer gain per new voice, mixer-owned like every other.
      var layLyre = mAttach("lyre", c.createGain(), 1);
      var layConc = mAttach("concertina", c.createGain(), 1);
      var layPan = mAttach("handpan", c.createGain(), 1);
      var layVib = mAttach("vibraphone", c.createGain(), 1);

      // Landscape chain: sources → breezeBreath (joints only) → breezeLevel
      // (follower only) → mixBreeze (mixer only) → the room pair. One
      // writer per param, ever.
      var breezeBreath = c.createGain();
      breezeBreath.gain.setValueAtTime(1, clock.now());
      var breezeLevel = c.createGain();
      breezeLevel.gain.setValueAtTime(0.12, clock.now());
      breezeBreath.connect(breezeLevel);
      var mixBreeze = mAttach("breeze", c.createGain(), 1);
      breezeLevel.connect(mixBreeze);
      var aeoLevel = c.createGain();
      aeoLevel.gain.setValueAtTime(0, clock.now());
      aeoLevel.connect(layAeo); // the bed reaches the room through the singer's layer

      roomBlend.register("breeze", mixBreeze, 0.05);
      roomBlend.register("melody", layMel, -0.06);
      roomBlend.register("aeolian", layAeo, 0.0);
      roomBlend.register("ambient", layAmb, 0.12);
      roomBlend.register("halo", layHalo, 0.18);
      roomBlend.register("bass", layBass, -0.15);
      // rc.33: the three STRUCK/PLUCKED bodies lean toward the sky (they are
      // outdoor sounds and the open room flatters them); the concertina is a
      // thing in the room with you and would drown in a 5 s tail, so it sits
      // closest of anything here — the lab poured it into its own short room
      // for exactly this reason.
      roomBlend.register("lyre", layLyre, 0.10);
      roomBlend.register("concertina", layConc, -0.10);
      roomBlend.register("handpan", layPan, 0.08);
      roomBlend.register("vibraphone", layVib, 0.10);

      var poolMel = PJ2.Voice.pannerPool(c, layMel, 3);
      var mixWraps = {
        whistle: mSlotWraps("whistle", poolMel),
        chime: mSlotWraps("chime", poolMel),
        flutter: mSlotWraps("flutter", poolMel),
      };

      // THE WEATHER ALOFT — Ariel's own channels (build-time draws only).
      var weather = PJ2.Fx.weather(streams.weather, WEATHER_ARIEL);

      // THE TWO WALLS. Wall A: Ariel's near-caps dose with the NEW thin
      // option (ascending echoes — see pj2-fx.js). Wall B: further off,
      // lower, fed FROM wall A's output (two walls at different distances,
      // no new machinery). Both return into the SKY room's send.
      //
      // ENERGY AUDIT (steady-state math, the Sycorax lesson: a symbolic mock
      // cannot hear a runaway — the arithmetic must be done on paper):
      //   - Wall A loop: fb 0.48 × |HP(thin)|·|LP(damp)|, both filters
      //     pinned Q 0.5 so |H| ≤ 1 everywhere ⇒ loop gain ≤ 0.48. A
      //     SUSTAINED input reaches steady state 1/(1−0.48) ≈ 1.92× at the
      //     tap, × wet 0.32 ⇒ ≤ 0.62× of the send level. Sends are note
      //     transients only (chime 0.5×0.052, flutter 0.4×0.04, whistle
      //     0.35×0.028 ≈ 0.010 worst sustained) ⇒ wall A's wet return holds
      //     under ~0.007 sustained, ~0.02 on transient peaks.
      //   - Wall B hears only wall A's WET OUTPUT (strictly one-way — no
      //     cycle between instances): 0.15/(1−0.3) ≈ 0.21× of that ⇒ ≤ 0.005.
      //   - STRUCTURAL RULE, load-bearing: NO LANDSCAPE VOICE FEEDS A
      //     FEEDBACK LOOP. The breeze, bass, aeolian bed and gusts — the
      //     continuous signals — route only through plain gains into the
      //     convolution rooms (passive, decaying IRs). Sycorax's failure was
      //     a CONTINUOUS drone into a comb bank whose steady-state gain
      //     1/(1−fb) ≈ 14–20× multiplied a signal that never stopped;
      //     Ariel's combs and loops are excited by phrases that end.
      var delayA = PJ2.Fx.delay(c, {
        timeS: DELAY_A.timeS, feedback: DELAY_A.feedback, damp: DELAY_A.damp,
        driftHz: DELAY_A.driftHz, driftDepth: DELAY_A.driftDepth, wet: DELAY_A.wet,
        thin: DELAY_A.thin, rng: streams.fx,
      });
      var delayB = PJ2.Fx.delay(c, {
        timeS: DELAY_B.timeS, feedback: DELAY_B.feedback, damp: DELAY_B.damp,
        driftHz: DELAY_B.driftHz, driftDepth: DELAY_B.driftDepth, wet: DELAY_B.wet,
        rng: streams.fx2,
      });
      delayA.output.connect(roomSky.send);
      delayA.output.connect(delayB.send);   // the second wall hears the first
      delayB.output.connect(roomSky.send);
      // Per-voice sends are mixer-owned (each voice's user layer scales its
      // own echo feed — a muted bell stops being answered by either wall).
      var delaySendChime = mAttach("chime", c.createGain(), 0.5);   // the bell always speaks to the wall
      delaySendChime.connect(delayA.send);
      var delaySendFlutter = mAttach("flutter", c.createGain(), 0.4); // so does the cloud
      delaySendFlutter.connect(delayA.send);
      var delaySendWhistle = mAttach("whistle", c.createGain(), 0.35); // the song, when the coin says
      delaySendWhistle.connect(delayA.send);
      // rc.33 — the three STRUCK/PLUCKED newcomers speak to the BRIGHTER wall
      // (wall A, damp 2800 with the ascending thin filter), modestly: under
      // the bell's 0.5 and the cloud's 0.4, because they are landscape and
      // must stay under the speakers even in their echoes. The STRUCTURAL
      // RULE above admits them by its own terms — Ariel's loops may only be
      // excited by phrases that END, and a pluck, a struck shell and a struck
      // bar are nothing but endings. THE CONCERTINA IS NOT HERE, and that is
      // load-bearing: it is a CONTINUOUS body (a 9 s held dyad), exactly the
      // class the rule bars from a feedback line, and it stays dry.
      var delaySendLyre = mAttach("lyre", c.createGain(), 0.2);
      delaySendLyre.connect(delayA.send);
      var delaySendPan = mAttach("handpan", c.createGain(), 0.15);
      delaySendPan.connect(delayA.send);
      var delaySendVib = mAttach("vibraphone", c.createGain(), 0.18);
      delaySendVib.connect(delayA.send);

      // THE HALO — six strings on {0,1,3,4} + two octave tonics (the #4
      // rings here), excited by chime + whistle sends AND a small tap of
      // wall A's wet return: echo exciting strings = the shimmer aura.
      //
      // ENERGY AUDIT for the delay→comb chain (the riskiest path in the
      // graph — a feedback line feeding a resonator bank): each comb at
      // fb 0.95 has steady-state gain 1/(1−0.95) = 20× AT RESONANCE, so the
      // bank must only ever hear whispers that stop. Worst sustained case:
      // a held whistle (3 s ≫ the combs' 2–6 ms periods, so steady state is
      // fully reached) delivers 0.028 × haloSend 0.12 ≈ 0.0034; the wet
      // return tap adds ≤ 0.007 (audit above) × 0.1 ≈ 0.0007. With ~2
      // harmonically-aligned strings ringing at 20× and the level gain
      // capped at 0.09 (the release's maximum), the halo's worst sustained
      // output is ≈ (0.0034 + 0.0007) × 20 × 2 × 0.09 ≈ 0.015 — under the
      // room tone, and every exciter decays. The tap gain 0.1 and the send
      // 0.12 are LOAD-BEARING numbers: raising either an order of magnitude
      // recreates the Sycorax catastrophe.
      var halo = PJ2.Fx.sympathetic(c, {
        nStrings: 6, freqs: haloFreqs(field),
        out: layHalo, level: 0.04, feedback: 0.95, damp: 3200,
      });
      // REAL-BROWSER STABILITY CORRECTION (found by the render soak; no
      // symbolic mock can hear it): WebAudio interprets a lowpass/highpass
      // BiquadFilter's .Q IN DECIBELS — Fx.sympathetic pins its comb-loop
      // lowpasses at "Q 0.5" believing that is the over-damped traditional
      // q ≤ 1/√2 that keeps |H| ≤ 1, but 0.5 dB of RESONANCE is a ×1.2 peak
      // near cutoff, so the comb's true loop gain is 0.95 × 1.2 ≈ 1.14 > 1:
      // exponential runaway to NaN in ~10 s once any note grazes the bank
      // (observed in the rendered soak for BOTH Ariel and the Library).
      // Until pj2-fx.js is corrected by its owner (bug reported upstream),
      // Ariel re-pins each string's loop filter to −6 dB — the traditional
      // q ≈ 0.5 the design intended — through the documented .strings
      // telemetry surface. Loop gain returns to the printed 0.95 exactly;
      // T60 ≈ 227 passes, a sympathetic string's breath, as designed.
      for (var hsI = 0; hsI < halo.strings.length; hsI++) {
        var hsLp = halo.strings[hsI].lp;
        if (hsLp && hsLp.Q) {
          if (typeof hsLp.Q.setValueAtTime === "function") hsLp.Q.setValueAtTime(-6, clock.now());
          else hsLp.Q.value = -6;
        }
      }
      var haloSend = c.createGain();
      haloSend.gain.setValueAtTime(0.12, clock.now());
      haloSend.connect(halo.input);
      // The string send is SHARED by chime and whistle, so each exciter gets
      // its own mixer stage ahead of it — mute the song and the strings stop
      // hearing it, while the bell still rings them (and vice versa). The
      // halo layer itself owns only the RETURN (layHalo).
      var haloSendWhistle = mAttach("whistle", c.createGain(), 1);
      haloSendWhistle.connect(haloSend);
      var haloSendChime = mAttach("chime", c.createGain(), 1);
      haloSendChime.connect(haloSend);
      // rc.33 — THE LYRE'S WHISPER into the strings, and only the lyre's:
      // sympathetic strings hearing a plucked string is the oldest thing in
      // the instrument, and the halo is tuned to the lydian degrees the roll
      // is voicing. Kept small on purpose — the audit above holds because
      // this adds 0.024 × (0.35 × 0.12) ≈ 0.001 to the bank's worst
      // SUSTAINED input of ~0.0041, and a roll is a decay, not a hold. The
      // handpan and the vibraphone get no string send: two more struck
      // bodies ringing the same six strings is a chorus, not an aura.
      var haloSendLyre = mAttach("lyre", c.createGain(), 0.35);
      haloSendLyre.connect(haloSend);
      var haloDelayTap = c.createGain();
      haloDelayTap.gain.setValueAtTime(0.1, clock.now());
      delayA.output.connect(haloDelayTap);
      haloDelayTap.connect(halo.input);

      var harmony = PJ2.Harmony.create({
        rng: streams.harmony,
        field: field,
        dramaturgyName: "ariel",
        profile: {
          grammar: ARIEL_GRAMMAR,
          cadences: ARIEL_CADENCES,
          seaChange: ARIEL_SEACHANGE,
        },
      });
      var motif = PJ2.Motif.create({
        rng: streams.motif,
        field: field,
        harmony: harmony,
        voices: ARIEL_VOICES,
        policy: ARIEL_POLICY,
      });

      run = {
        live: true, finalized: false, finalizeId: null,
        clock: clock, bus: bus, budget: budget, field: field,
        poolMel: poolMel,
        breezeBreath: breezeBreath, breezeLevel: breezeLevel, aeoLevel: aeoLevel,
        breezeCur: 0.12, aeoCur: 0,
        streams: streams, tokens: [],
        // rc.38 — the master stream itself, so PJ2.Voice.absences can take
        // its own fork ("absences:<evening>") without touching any of the
        // forks above; and the evening's cast, drawn at each seam.
        master: master,
        absent: [], lastAbsent: [], cast: null, castPending: null,
        harmony: harmony, motif: motif,
        perfScenes: null,
        seaChange: null,
        nextCadence: null,             // {kind, label, t: boundary} once planned, cleared at realize
        pendingGhost: null,
        signature: { name: null, promoted: false },
        heldUtterance: { whistle: null, chime: null, flutter: null, aeolian: null },
        featherDeg: null, featherPending: null,
        bassArrival: false, bassDone: false, bassFigs: [],
        breezeReleaseSteps: 0, releaseDegFloor: null,
        roomClose: roomClose, roomSky: roomSky, roomBlend: roomBlend,
        roomBalance: 0.25,
        layMel: layMel, layAeo: layAeo, layAmb: layAmb, layHalo: layHalo, layBass: layBass,
        // rc.33 — the four new layers, their sends, and their brains' state
        layLyre: layLyre, layConc: layConc, layPan: layPan, layVib: layVib,
        delaySendLyre: delaySendLyre, delaySendPan: delaySendPan,
        delaySendVib: delaySendVib, haloSendLyre: haloSendLyre,
        lyreHoldUntil: 0, lyreRestUntil: 0, lyreLastChord: null, lyreAlightDone: false,
        concHoldUntil: 0, concRestUntil: 0, concLastChord: null, concPrev: null,
        panHoldUntil: 0, panRestUntil: 0,
        vibHoldUntil: 0, vibRestUntil: 0, vibLastChord: null,
        alightSteps: 0,
        mix: mix, mixWraps: mixWraps,
        weather: weather,
        delayA: delayA, delayB: delayB,
        delaySendChime: delaySendChime, delaySendFlutter: delaySendFlutter,
        delaySendWhistle: delaySendWhistle,
        halo: halo, haloSend: haloSend, haloDelayTap: haloDelayTap,
        haloSendWhistle: haloSendWhistle, haloSendChime: haloSendChime,
        haloRetuneAt: null,
        haloLevelCur: 0.04,
        t0: clock.now() + 0.08,
        conductor: null, air: null, airLimit: null,
        // rc.36 — the wander, its evening ordinal (counted ACROSS the seam,
        // since Ariel has no cast to draw one), and its telemetry log.
        wander: wanders, evening: 0, wlog: { draws: {}, dress: [] },
      };

      // The first dressing: evening 0 is the sliver before the conductor's
      // first performance-begin, and every begin after it re-dresses.
      dressAll(0);

      run.airLimit = function () {
        if (run.conductor && typeof run.conductor.airLimit === "function") {
          try { return run.conductor.airLimit(); } catch (e) {}
        }
        var sc = dram.scenes[curSceneType()];
        return sc ? sc.airLimit : 1;
      };
      var airOverlapChance = function () {
        if (run.conductor && typeof run.conductor.overlapChance === "function") {
          try { return run.conductor.overlapChance(); } catch (e) {}
        }
        var sc = dram.scenes[curSceneType()];
        return sc ? sc.overlapChance : 0.1;
      };

      run.air = PJ2.Air.create({
        clock: clock,
        rng: streams.air,
        limit: run.airLimit,
        overlapChance: airOverlapChance,
      });

      var jointTools = { ctx: c, out: layAmb, rng: streams.joints, field: field };

      run.conductor = PJ2.Conductor.create({
        clock: clock,
        rng: streams.conductor,
        dramaturgy: dram,
        onEvent: function (evt) {
          handleConductorEvent(evt);
          emitEvent(evt);
          // rc.38 — the CAST line, the instant after the begin event it was
          // drawn on, so the log reads "evening N" then "tonight: …" and the
          // cast is always narrated before the evening's first note.
          if (run && run.castPending) {
            var cp = run.castPending;
            run.castPending = null;
            emitEvent(cp);
          }
        },
        jointTools: jointTools,
        tools: jointTools,
        air: run.air,
        seed: seed,
      });

      playing = true;
      stopping = false;

      clock.start();
      run.conductor.start();
      startFollower();
      startHarmonyLane();
      startBreeze();
      startWhistle();
      startChime();
      startFlutter();
      startBass();
      startAeolianBed();
      startAeolianSing();
      startAmbient();
      startLyre();          // rc.33
      startConcertina();    // rc.33 (the handpan has no lane chain of its own:
      startVibraphone();    //        every answer is scheduled off a phrase)

      // Born already mixed, rate side: stamp each layer's stored rate onto
      // its lanes (no-op at the default 1 — setLaneRate early-outs).
      for (var mri = 0; mri < MIX_LAYERS.length; mri++) mixRateApply(MIX_LAYERS[mri].key);

      emitEvent({ type: "engine", state: "play", seed: seed, t: clock.now() });
    }

    function stop() {
      if (!playing || !run) return;
      playing = false;
      stopping = true;
      var r = run;
      var t = r.clock.now();
      emitEvent({ type: "engine", state: "stop", t: t });
      try { r.conductor.stop(); } catch (e) {}
      for (var i = 0; i < LANE_NAMES.length; i++) {
        try { r.clock.lane(LANE_NAMES[i]).cancelAll(); } catch (e) {}
      }
      try { r.bus.fadeTo(0, 1.5); } catch (e) {}
      r.finalizeId = r.clock.at(t + 1.7, function () {
        r.finalizeId = null;
        finalize(r);
      });
    }

    // ========================================================================
    // THE FACADE — PJ2.Library's shape, exactly.
    // ========================================================================
    return {
      play: play,
      stop: stop,
      isPlaying: function () { return playing; },

      setMasterVolume: function (v) {
        masterVol = clamp(+v || 0, 0, 1);
        if (run && run.live && run.bus) {
          try { run.bus.fadeTo(masterVol, 0.08); } catch (e) {}
        }
      },

      // ---- the per-layer mixer (MIX_LAYERS; uniform across the tracks) ----
      // Gain-side calls consume no randomness and move no events; rate calls
      // only re-pace the layer's own lanes — a run left at the defaults
      // emits the identical note/event streams.
      getLayers: function () {
        var out = [];
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          out.push({ key: MIX_LAYERS[i].key, label: MIX_LAYERS[i].label, kind: MIX_LAYERS[i].kind });
        }
        return out;
      },
      // v multiplies the layer's design gain (1 = as-composed). Persists
      // across performances and stop/play; a muted layer keeps the setting
      // and hears it again on unmute.
      setLayerVolume: function (key, v) {
        var st = mixState[key];
        if (!st) return;
        st.volume = clamp(+v || 0, 0, 1);
        if (!st.muted) mixApply(key, MIX_VOL_S);
      },
      getLayerVolumes: function () {
        var out = {};
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          out[MIX_LAYERS[i].key] = mixState[MIX_LAYERS[i].key].volume;
        }
        return out;
      },
      // toggleLayer(key)      — flip; toggleLayer(key, on) — set (on=true
      // means AUDIBLE). Returns the muted-state boolean. Mute is a ~0.3s
      // ramp to true silence; unmute restores design x volume the same way.
      toggleLayer: function (key, on) {
        var st = mixState[key];
        if (!st) return false;
        var muted = (on == null) ? !st.muted : !on;
        if (muted !== st.muted) {
          st.muted = muted;
          mixApply(key, MIX_MUTE_S);
        }
        return st.muted;
      },
      // r multiplies the layer's event pace (1 = as-composed), clamped to
      // [0.25, 4]. Persists across performances and stop/play like volume;
      // a playing run's lanes are re-stamped live. Layers with no lane keep
      // rate 1 and are absent from getLayerRates().
      setLayerRate: function (key, rate) {
        var st = mixState[key];
        if (!st) return;
        var r = +rate;
        if (!isFinite(r)) r = 1;
        st.rate = clamp(r, MIX_RATE_MIN, MIX_RATE_MAX);
        mixRateApply(key);
      },
      getLayerRates: function () {
        var out = {};
        for (var i = 0; i < MIX_LAYERS.length; i++) {
          var k = MIX_LAYERS[i].key;
          if (MIX_RATE_LANES[k] && MIX_RATE_LANES[k].length) out[k] = mixState[k].rate;
        }
        return out;
      },
      // ---- the fine-tune params (LAYER_PARAMS; pj2-library's note is
      // authoritative) — knobs are read live by the voices at schedule time.
      getLayerParams: function () {
        var out = {};
        for (var lk in LAYER_PARAMS) {
          var defs = LAYER_PARAMS[lk], list = [];
          for (var i = 0; i < defs.length; i++) {
            list.push({ key: defs[i].key, label: defs[i].label, min: defs[i].min, max: defs[i].max, def: defs[i].def });
          }
          out[lk] = list;
        }
        return out;
      },
      setLayerParam: function (layerKey, paramKey, value) {
        var defs = LAYER_PARAMS[layerKey];
        if (!defs) return;
        for (var i = 0; i < defs.length; i++) {
          if (defs[i].key === paramKey) {
            var v = +value;
            if (!isFinite(v)) v = defs[i].def;
            paramState[layerKey][paramKey] = clamp(v, defs[i].min, defs[i].max);
            return;
          }
        }
      },
      getLayerParamValues: function () {
        var out = {};
        for (var lk in paramState) {
          out[lk] = {};
          for (var pk in paramState[lk]) out[lk][pk] = paramState[lk][pk];
        }
        return out;
      },

      // ---- THE WANDER'S TELEMETRY (rc.36; dev surface, like the halo's
      // .strings — no audio effect, nothing schedules off it). getWander()
      // reports every ranged def's TRANSLATED span, what was actually drawn
      // (count, min, max, per layer and key), and the dress log: one row per
      // character def per evening. wanderAt() evaluates a weather or
      // character value at a song time PURELY — it never advances a touch
      // fork, so the harness can walk a weather channel second by second
      // without moving the music.
      getWander: function () {
        var out = { evening: run ? (run.evening || 0) : 0, spans: {}, draws: {}, dress: [] };
        for (var lk in LAYER_PARAMS) {
          var defs = LAYER_PARAMS[lk];
          out.spans[lk] = {};
          for (var i = 0; i < defs.length; i++) {
            var d = defs[i], s = null;
            if (run && run.wander && run.wander[lk]) {
              try { s = run.wander[lk].span(d.key); } catch (e) { s = null; }
            }
            if (!s && d.lo != null) s = { lo: d.lo, hi: d.hi, per: d.per || null };
            if (!s && d.weights) s = { lo: null, hi: null, per: d.per || null };
            if (!s) continue;
            out.spans[lk][d.key] = {
              lo: s.lo, hi: s.hi, per: d.per || s.per || null,
              round: !!d.round, weights: d.weights || null, def: d.def,
            };
          }
        }
        if (run && run.wlog) {
          for (var l2 in run.wlog.draws) {
            out.draws[l2] = {};
            for (var k2 in run.wlog.draws[l2]) {
              var e2 = run.wlog.draws[l2][k2];
              out.draws[l2][k2] = { n: e2.n, min: e2.min, max: e2.max };
            }
          }
          for (var j = 0; j < run.wlog.dress.length; j++) {
            var r = run.wlog.dress[j];
            out.dress.push({ evening: r.evening, layer: r.layer, key: r.key, value: r.value });
          }
        }
        return out;
      },
      wanderAt: function (layerKey, paramKey, songT) {
        if (!run || !run.wander || !run.wander[layerKey]) return null;
        var defs = LAYER_PARAMS[layerKey];
        var d = null;
        for (var i = 0; i < defs.length; i++) if (defs[i].key === paramKey) d = defs[i];
        if (!d || !d.per) return null;
        try {
          if (d.per === "weather") return run.wander[layerKey].weather(paramKey, +songT || 0);
          if (d.per === "character") return run.wander[layerKey].character(paramKey);
        } catch (e) {}
        return null;   // a touch value cannot be peeked: peeking would play it
      },

      getInfo: function () {
        var info = {};
        if (run && run.conductor) {
          try {
            var ci = run.conductor.info();
            for (var k in ci) info[k] = ci[k];
          } catch (e) {}
          try { info.airHolders = run.air.holders(); } catch (e) {}
          try { info.airOverlaps = run.air.overlapCount(); } catch (e) {}
          try { info.budget = run.budget.stats(); } catch (e) {}
          try {
            var cur = run.harmony.current();
            info.harmony = cur ? cur.name : null;
            // the chord's tones, spelled for the readout (current() already
            // carries the degree set — no harmony API growth)
            info.harmonyTones = (cur && cur.chordDegs) ? spellChordTones(cur.chordDegs) : null;
          } catch (e) {}
          // The harmony readout's approach/state lines: the planned cadence
          // (inS to its boundary, clamped ≥0) and the evening's sea change.
          try {
            info.cadence = run.nextCadence
              ? { kind: run.nextCadence.kind, label: run.nextCadence.label,
                  inS: Math.max(0, run.nextCadence.t - run.clock.now()) }
              : null;
          } catch (e) {}
          try {
            info.seaChange = run.seaChange
              ? { planned: true, done: !!run.seaChange.done, label: run.seaChange.label || null }
              : null;
          } catch (e) {}
          try { info.motif = run.motif.stats(); } catch (e) {}
          // THE SIGNATURE LINE: the promoted ghost when there is one, else
          // the working theme — plus the deepest living generation.
          try {
            var mo = info.motif;
            var themeName = mo && mo.working ? mo.working.theme : null;
            var promoted = !!(run.signature && run.signature.promoted);
            info.signature = {
              name: promoted ? run.signature.name : themeName,
              promoted: promoted,
              themeGen: mo && mo.working ? mo.working.themeGen : null,
              maxGen: mo ? mo.maxGen : null,
            };
          } catch (e) {}
          // rc.38 — TONIGHT'S CAST: the evening's ordinal and who is sitting
          // it out (evening one is `plain` and never draws). The list is the
          // same one the cast event narrated.
          try {
            info.cast = run.cast
              ? { evening: run.cast.evening, plain: !!run.cast.plain,
                  absent: run.cast.absent.slice(), absentLabels: run.cast.absentLabels.slice() }
              : null;
          } catch (e) {}
          try { info.weather = wxAt(run.clock.now()); } catch (e) {}
          try { info.roomBalance = (run.roomBlend && run.roomBlend.balance) ? run.roomBlend.balance() : run.roomBalance; } catch (e) {}
          info.haloLevel = run.haloLevelCur;
          info.tonicHz = run.field ? run.field.tonicHz : null;
          info.mode = run.field ? run.field.mode : null;
        }
        // The mixer snapshot rides along even between runs — the UI's
        // sliders are facade state, not run state.
        info.layers = {};
        for (var li = 0; li < MIX_LAYERS.length; li++) {
          var lk = MIX_LAYERS[li].key;
          info.layers[lk] = { volume: mixState[lk].volume, muted: mixState[lk].muted };
        }
        info.playing = playing;
        info.seed = seed;
        return info;
      },

      // Multicast (family pattern). Notes: {voice, freq|null, t, durS, deg?,
      // oct?, kind?, velocity?, motif?, gen?, phraseKind?, endFreq?}. Events:
      // conductor events (performance/scene/joint/tide) + {type:"air"} +
      // {type:"joint-gesture"} + {type:"engine"} + the narration:
      // cadence (kind lift|float|up-half, arrivalAbove) / seachange / ghost
      // (promoted?) / develop / answer / reground (the seam's tonic reset) /
      // release (scene choreography) / feather / bass-flourish / cast (rc.38:
      // {evening, plain, absent, absentLabels} — who is sitting tonight out,
      // emitted the instant after each performance begin).
      setNoteListener: function (fn) { return addListener(noteLs, fn); },
      setEventListener: function (fn) { return addListener(eventLs, fn); },

      reseed: function (s) {
        seed = (+s) >>> 0;
        var wasOn = playing || stopping;
        if (run && !run.finalized) {
          playing = false;
          finalize(run);
        }
        emitEvent({ type: "engine", state: "reseed", seed: seed });
        if (wasOn) play();
      },

      attachAnalyser: function (analyser) {
        if (!analyser) return;
        analysers.push(analyser);
        if (run && run.live && run.bus) {
          try { run.bus.attachAnalyser(analyser); } catch (e) {}
        }
      },
    };
  }

  window.PJ2.Ariel = {
    create: create,
    // Authored data exposed read-only-by-convention for the harness (the
    // Library exposes its GRAMMAR the same way): the float's table, the
    // cadence vocabulary, the sea-change pool, the weather spec.
    GRAMMAR: ARIEL_GRAMMAR,
    CADENCES: ARIEL_CADENCES,
    SEACHANGE: ARIEL_SEACHANGE,
    WEATHER: WEATHER_ARIEL,
    // rc.33: and the scene roster, so the harness can assert the shipped
    // table against the lab page's PLAN_DEFAULT instead of keeping a second
    // copy that can silently drift out of step with this one.
    ROSTER_COLS: ROSTER_COLS,
    ROSTER: SCENE_ROSTER,
  };
})();
