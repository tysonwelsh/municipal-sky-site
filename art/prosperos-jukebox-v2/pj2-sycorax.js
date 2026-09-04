// ============================================================================
// Prospero's Jukebox v2 — pj2-sycorax.js
// PJ2.Sycorax: the dark track — a rite observed from the treeline.
//
// Built per PLAN-SYCORAX.md (rev 2, all recommendations adopted: wordless
// chant drifting syllabic only in the processional; heartbeat-only
// gatherings; the bone-flute kept, rare; the downward semitone sink at
// p â 0.12, at-the-treeline evenings only; the 0.8Ã-gurdy noise ceiling
// everywhere; the far-field keen in the pool). Facade-shaped like
// pj2-library.js — create/play/stop/reseed/getInfo/listeners/
// attachAnalyser/setMasterVolume, one lazy AudioContext, a fresh seeded
// "run" per play, stop restarts the whole seeded lineage.
//
// The binding constants hold unchanged: floor 0.04, ceiling 0.65, nothing
// startles, ambient first. Darkness and noise are spent in SPECTRUM,
// REGISTER, INTERVAL, TEXTURE and CEREMONY — never in level, never in
// surprise.
//
// THE DRAMATURGY is the encirclement: gathering â (processional, p rising
// with the tide) â circling Ã1â3 â (invocation) â afterimage. It never
// resolves — the harmony's root is PINNED to i forever (pose mode on the
// PJ2.Harmony profile door), color comes from rotating authored degree-set
// poses, cadence() is never called (zero cadence events, by construction),
// and boundary arrivals DARKEN instead of closing: the pose is forced to
// "sting" ({0,1,5} — the flat second against the fifth), the gurdy sinks
// its sub-octave in, the lowpass closes ~15%, and a two-part ORGANUM pad
// ({0,5} under the keening line) breathes across the seam.
//
// THE CUT (the moment the observer is noticed) fires whenever an invocation
// exists, at the invocationâafterimage boundary, severity 0.4 + 0.6Â·tide:
// an indrawn breath 0.6 s out, percussion cut off MID-GESTURE at tB, a
// dedicated cutGain on the landscape sum ramping to 0.28 â 0.14Â·sev over
// 0.25 s (ramped, never touching master, one writer), the hush INHABITED —
// the proto-drum routes around cutGain and beats alone, one waterphone
// apparition enters ~1.2 s in — held 3 + 5Â·sev seconds, then a 2.5â4 s
// return into the afterimage. Conductor intensity remains continuous
// throughout; the cut lives entirely in gain-land.
//
// THE VOICES: the hurdy-gurdy drone (v1's sycorax cluster ~2844, voiced
// from the live pose, with a trompette partial on the grit bus whose send
// pulses with drum strokes); the CHANT (primary speaker — whisper-formant
// DNA matured into a pitched low voice, reciting-tone Markov, keening
// phrase-finals on the flat second, an unresolving after-tone body
// gesture); the REBEC (SYC_GHOST_MARKOV's tritone wander on a bowed body);
// the WATERPHONE (v1 ~3288, verbatim port — six inharmonic partials, FM
// bloom, shared body wobble, downward gliss); the BONE-FLUTE (rare, high,
// lonely — processional and invocation only, ~2â3 utterances an evening).
// Percussion is a LANDSCAPE family (never claims the air): proto-drum
// (v1's heartbeat), frame drum, log drum, bone rattle — ceremonially
// paced under the anti-groove law (breath-distributed gaps outside the
// processional; a Â±20%-jittered walk inside it; accelerating clusters in
// the invocation whose SPEED rises while their level never does).
//
// rc.23 — THE LOW HORN, the rite's under-voice (PLAN-UNDERVOICES §2b,
// owner-approved by ear in instrument-mockup-horn.html): an aurochs horn
// heard from the treeline — a LANDSCAPE voice that never claims the air
// and never speaks a melody. One sawtooth finding its partial (a −35¢
// scoop settling over 0.4 s) through a lowpass whose cutoff BLOSSOMS
// 300 → ~900 Hz and back (the brass crescendo that is the instrument),
// 800 Hz breath riding the same shape, a whisper of 3rd partial while
// the bell is open; 3–6 s swells, 12–30 s tones on the POSE's root or
// fifth at oct −1, peak 0.028 (rc.25: ~30% under the launch level,
// owner's ear) — and rarely (p ≈ 0.15) the two-note call,
// the fifth FALLING to the root; the treeline does not fanfare. It
// enters only on the rite's movement: pose changes (weighted toward
// sting and hollow), the darkening arrivals (the organum gains its
// fundament), weighted to the processional and invocation, HOLDS ITS
// BREATH from 4 s before the cut through the hush, and may sound one far
// final call in the afterimage once the return completes. One call at a
// time (the hold law), a drawn rest after each; every draw on the NEW
// "horn" fork, so every pre-existing stream is byte-identical to rc.22.
// It sums into cutGain like all landscape (the cut ducks it with the
// rest of the night) and taps the grit bus at 0.08 off its own layer.
//
// rc.32 — THE SOUND-DIVERSITY PASS (PLAN-SOUND-DIVERSITY §5; every number
// below is the owner's own tuning, made BY EAR on lab-sycorax.html,
// 2026-09-03). Five voices and a scene roster. No stops, no evening cast:
// the owner is holding the stops back, and the cast is a later phase.
//
//   THE BULLROARER — a whirled slat on a cord, the oldest ritual instrument
//   there is and the rite's own machine. A sawtooth at the pose root two
//   octaves down through a lowpass the DARKNESS knob closes, chopped at the
//   WHIRL rate (24 Hz) by an LFO whose rate a slower SWING (0.8 Hz) bends
//   ±40 %, with a ±2 % Doppler wobble on the same circle and a band of air
//   dragged along with it. 10 s in, 10 s out. It is the one ITERATIVE
//   texture Sycorax has never owned. Processional and invocation; peak
//   0.025 into cutGain.
//
//   THE OVERTONE CHANT — the cantor's second manner, built as its own
//   layer: a held fundamental at the pose root (oct −1) while ONE narrow
//   bandpass (Q 16) STEPS through harmonics 4–10 in anchored jumps — a
//   melody made of overtones above a tone that never moves. The mid-high
//   register the rite has nothing sustained in, at almost no cost.
//   Processional and invocation, on pose turns only; peak 0.03.
//
//   THE JAW HARP — nothing in Sycorax was plucked. A noise burst into a
//   feedback comb at the pose root (oct −1, under the 340 Hz render-quantum
//   clamp a comb inside a cycle is pinned to) read through a MOUTH: a
//   bandpass swept 500 → 1800 Hz on every twang, so the melody is made of
//   formants rather than pitches. Three twangs an utterance at 0.8 s ±40 %.
//   The circling is its scene; peak 0.02 × a ×6 formant-loss makeup that
//   goes THROUGH the accounting, not around it.
//
//   THE BOWED BLADE — two sines at an inharmonic 1 : 1.47 near 1.7 kHz with
//   a slow wobble and a band of bow friction, 6 s each way at a whisper
//   (0.008). The one high sustained sound the rite lacks, and the only
//   voice here that could startle — so it is kept far: the CAVERN's send
//   and the seasick delay wall, and nothing else. It is the one layer NOT
//   registered with roomBlend. Invocation, and the afterimage once the
//   cut's return has fully passed.
//
//   THE CAULDRON — the spell's pot, back in the ambient pool that dropped
//   it in Phase 3 as a comedy risk: a low simmer (noise 80–200 Hz) with
//   pitched pops glissing 200 → 400 Hz over 60 ms, 6 s at a time, on its
//   own 40–120 s clock in the gathering, the circling and the invocation.
//   Its own mixer row, so the pot can be mixed apart from the sky.
//
//   THE CUT LAW they all obey — the horn's held breath, extended. None of
//   the five may have an ONSET inside [tB − 4, cut.end + returnS], and
//   anything of theirs still sounding at tB is ended THERE on its own gate,
//   anchored, over 0.25 s (a {type:"cut-kill"} event narrates it). The
//   bullroarer, the overtone and the pot also SUM into cutGain, so the cut
//   ducks them with the rest of the night on the way out.
//
//   THE ROSTER (L3) — SCENE_ROSTER below, §5.3's table exactly as the owner
//   adopted it on the lab page: five columns, fourteen rows. It gates
//   ENTRIES only — the rolls are still drawn first, the gate comes after,
//   and a cycle or an utterance already sounding always finishes. The gurdy
//   never rests: it is the seam.
//
// ROSTER NOTE (rc.32): the rows ticked in every column — the gurdy, the
// murk, the chant, the percussion family, the ambient pool — have no
// opinion and therefore carry no gate at all; the four with opinions (horn,
// rebec, waterphone, bone flute) and the five new voices consult
// rosterAllows after their roll. Two gestures are judged by where they LAND
// rather than where they stand, because they are boundary gestures: the
// horn's and the five's answers to a darkening ARRIVAL are gated by the
// scene the arrival walks INTO (the Library's rc.31 rule, kept). And the
// cut's own waterphone apparition is the CUT's gesture, not an entry: it
// bypasses the roster exactly as it bypasses the hush gate.
//
// PRESENCE AND ABSENCE (rc.37) — the owner, 2026-09-03, after the wander
// round: "it's a little too cluttered now that we added all the new
// instruments. Reduce the frequency of most instruments — pretty much
// anything that's not a drone or drone-adjacent … And bring back the idea
// that on certain playthroughs some instruments are not heard at all — one,
// two, even three sometimes. But not as a ban." Two mechanisms, both RATES
// and never laws, and both sitting AFTER the roll like the roster does:
//
//   PRESENCE — one knob per non-seam layer (LAYER_PARAMS), multiplying
//   every entry chance the voice rolls and dividing the rest (and the air
//   margin) it leaves after speaking, capped at twice as long. The shipped
//   defaults ARE the reduction: the cantor 0.9 — the principal is thinned
//   least — the percussion STROKES 0.85, and the horn, the rebec, the
//   waterphone, the bone flute and the five rc.32 voices 0.8 each. The knob
//   back at 1 is the rc.36 engine byte for byte, which the harness pins.
//   A poll is not a rest: the lanes' "try again in a few seconds" gaps are
//   untouched, so the knob is spent once per decision, never twice. Nothing
//   is thinned that holds the floor — the gurdy, the murk and breath beds,
//   the ambient sky, the proto-drum heartbeat carry no knob at all — and
//   two SIGNATURES ignore it: the cut's waterphone apparition and the
//   afterimage's far final call.
//
//   THOSE DEFAULTS ARE rc.40's, not rc.37's. The owner, 2026-09-04, after
//   living with the first cut: "we may have overcorrected a bit by thinning.
//   Turn the knob back a little — somewhere in between where we were before
//   the thinning and where we are now. I do like how only some instruments
//   play on a given playthrough; keep that." So every default moved to the
//   MIDPOINT of its pre-thinning value and rc.37's — the cantor 0.8 -> 0.9,
//   the strokes 0.7 -> 0.85, the other nine 0.6 -> 0.8 — and nothing else
//   about the round moved: not the knob's meaning (1 still replays rc.36
//   exactly), not the cut, not the hush, not the heartbeat, and not the
//   absences, which are the part the owner asked to keep.
//
//   ABSENCES — at every performance begin, PJ2.Voice.absences draws the
//   evening's cast on its own fork: evening one is full, and from evening
//   two nought to three of the NINE eligible voices (horn, rebec,
//   waterphone, bone flute, and the five) sit the evening out, never the
//   same voice twice running, never more than a third at once, the only
//   memory last evening's set. An absent voice makes no NEW entries — the
//   gate sits beside the roster's — while anything already sounding
//   finishes, and the cut's apparition still inhabits the hush because it
//   is the cut's gesture and not the waterphone's entry. A {type:"cast"}
//   event names the sitters the instant after the begin, getInfo().cast
//   carries them, and a reseed opens a new run at evening one, full.
//
// STREAM NOTE (rc.32) — what actually moved, stated plainly:
//
//   Every NEW draw lands on a NEW label-hashed fork ("bullroarer",
//   "overtone", "jawharp", "blade", "cauldron"), so the five re-roll
//   nothing by existing — no pre-existing fork gained a draw.
//
//   THE ROSTER DOES MOVE STREAMS, deliberately. It gates entries AFTER the
//   roll and BEFORE the render, and every render draws its own shape, so a
//   gated entry skips those draws and its fork's position shifts for the
//   rest of the run — the feature, not a leak. And because the gated voices
//   share THE AIR and the MOTIF engine with the ungated ones, resting one
//   speaker changes what the others get to say. Measured at 2600 s on the
//   harness's own Sycorax seed (20260709): horn 25 → 11 notes (it rests in
//   the gathering and the circling now), waterphone 154 → 92 (circling
//   only), rebec 296 → 276 (processional and circling), and with that air
//   freed, chant 384 → 420 and bone flute 7 → 14. The gurdy (545), the
//   percussion family (455 + 403), the breath bed (217), the ambient pool
//   (65) and the joints (4) are UNCHANGED to the note: their forks are
//   untouched and their roster rows have no opinion. Total 2556 → 2564, of
//   which 61 are the five's own — so the nine older voices between them
//   speak 2556 → 2503 times: fewer notes, more kinds of note. That is the
//   trade the roster is FOR.
//
//   Same-seed reproducibility is exact, and the harness proves it every run
//   (SYC32 REPRO-SYC, plus the pre-existing SYC stream-identity check).
//
// GAIN STAGING (rc.32 pass — worst-case *scheduled* peaks, the family
// ledger; "darker, not louder" is the law every number here answers to):
//
//   gurdy bed     cluster (3 pose degrees × 0.035 + body 0.028 + sub 0.022
//                 = 0.155) × gurdyLevel 0.10 × 2 (cycle overlap)  -> ~0.031
//   horn          0.028 + breath 0.0056 + 3rd partial 0.0028 = 0.036, one
//                 call at a time, ≤ 2 tones in the two-note call -> ~0.072
//   noise + breath ember 0.030 + gust 0.030 through noiseLevel (≤ 0.8 ×
//                 gurdyLevel = 0.08) + the breath bed 0.018     -> ~0.010
//   grit bus      documented in play(): ≤ 0.075 at the bus       -> ~0.075
//   melody        chant 0.032 (pre-formant, ~×0.3 after) + rebec 0.030 +
//                 waterphone 0.04 + bone flute 0.028, capped by THE AIR at
//                 limit+1 speakers                               -> ~0.09
//   percussion    proto lub 0.042 × hbIntensity ≤ 1.3 = 0.0546, frame
//                 stroke 0.045, log/rattle under both            -> ~0.10
//   ambient pool  loudest one-shot (far thunder)                 -> ~0.05
//   throat        bank level 0.04 behind a normalized tanh       -> ~0.04
//   ------------------------------------------------------------------
//   rc.32's additions, per voice (all one-gesture-at-a-time by the hold law):
//   bullroarer    body 0.025 + air 0.0125, × the spin gain (0.55 ± 0.45,
//                 so ≤ 1)                                        -> ~0.0375
//   overtone      0.03 at the envelope, which sits AFTER the mouth (the
//                 body and sweep paths are balanced under unity) -> ~0.030
//   jaw harp      0.02 × 6 makeup = 0.12 ASKED of the chain; a Q-4 band a
//                 decade wide gives back ~28 dB of it, so what the meter
//                 sees is the quietest of the five               -> ~0.020
//   blade         0.008 + friction 0.004, into the cavern only   -> ~0.012
//   cauldron      one pop 0.02 (60 ms) + wash 0.009              -> ~0.029
//   ------------------------------------------------------------------
//   ------------------------------------------------------------------
//   rc.35's wander, per line, at EACH SPAN'S WORST CASE (its `hi` — the
//   ledger's own pessimism, kept). Only these lines move; every other
//   ranged knob is a pitch, a mouth, a filter or a timing:
//     horn         breath hi 1.3 -> 0.028 + 0.00728 + 0.0028 = 0.03808, ×2
//                                                        0.072 -> 0.0762
//     melody       bone flute breath hi 1.35 × chiff hi 1.35 on the onset
//                  stage: 0.006 -> 0.0109                0.09  -> 0.0949
//     percussion   stroke hi 1.2 on the skin: 0.045 -> 0.054
//                                                        0.10  -> 0.1086
//     bullroarer   air hi 1.3: 0.0125 -> 0.01625         0.0375 -> 0.0413
//     overtone     body hi 1.25 raises the fundamental's share of a mix
//                  balanced under unity by ~7.5 %        0.030 -> 0.0323
//     jaw harp     sustain hi 0.96 lengthens the ring ×1.52 (T60 goes as
//                  1/log g), so a tail may overlap       0.020 -> 0.0303
//     blade        friction hi 1.4: 0.004 -> 0.0056      0.012 -> 0.0136
//     cauldron     wash hi 1.3: 0.009 -> 0.0117          0.029 -> 0.0317
//     gurdy/grit   UNCHANGED: brightness is a cutoff, warble a pitch drift,
//                  and the dog's dose (0.02 -> 0.024) meets a curve that
//                  already saturates hard above ~0.05 at the bus.
//   ------------------------------------------------------------------
//   WORST SCENE, roster-aware (the roster is what keeps this honest — the
//   five are spent in scenes where old voices are resting; rc.32's numbers
//   in brackets):
//     invocation   0.031 + 0.0762 + 0.010 + 0.075 + 0.0949 + 0.1086 + 0.05
//                  + 0.04  = 0.4857  + bullroarer 0.0413 + overtone 0.0323
//                  + blade 0.0136 + cauldron 0.0317 = 0.6045  [0.577]
//     circling     0.4857 − horn 0.0762 = 0.4095 + jaw harp 0.0303
//                  + cauldron 0.0317               = 0.4715  [0.445]
//     processional 0.4857 + bullroarer 0.0413 + overtone 0.0323 = 0.5593
//   -> ~0.60 absolute worst into the rooms (0.58 before rc.35, 0.47 before
//   rc.32); the
//   equal-power room split conserves power and each room is dry 1.0 + wet
//   ~0.3 -> ~0.79 at bus input; × masterGain 0.6 × the saturator's
//   small-signal gain ~1.66 (pj2-voice lesson #1) ~0.78 into the limiter —
//   still under the ~0.89 (~−1 dB) master ceiling (1.12 dB under, where
//   rc.32 was 1.5 dB under) with the glue compressor still idling. The
//   harness recomputes this whole sum from the engine's OWN reported spans
//   every run (SYC35 WANDER-LEDGER), so a widened span cannot breach the
//   ceiling quietly: if one would, the span narrows, never the ceiling.
//   Concurrence is far rarer than this ledger's pessimism, and the
//   rendered audio says so. MEASURED at 900 s on two seeds through
//   render-soak.html: worst peak −13.78 dBFS (seed 20260713) and −14.24 dBFS
//   (seed 777), zero non-finite samples, no silent window outside a hush.
//   And the "darker, not louder" test itself — the same evening rendered
//   twice, once with the five layers muted through toggleLayer and once with
//   them on, at presence 1:
//     seed 20260713   long-run RMS −34.59 → −34.20 dB   (+0.39 dB)
//                     hush RMS     −36.33 → −36.48 dB   (−0.15 dB)
//     seed 777        long-run RMS −33.92 → −33.78 dB   (+0.15 dB)
//                     hush RMS     −36.04 → −35.97 dB   (+0.07 dB)
//   Both well inside the law's +3 dB ceiling, and the hush moves by less
//   than the ±0.2–0.6 dB run-to-run variance of the freshly poured reverb
//   IRs (unseeded by design — at seed 777 the MUTED render even peaks
//   0.6 dB HIGHER than the unmuted one, which is that variance showing its
//   size). The hush is not louder than it was.
//
// rc.44 - THE STOPS, AND WHAT THEY COST. Seven manners, four register laws
//   and one body swap, each declared here the way the family declares
//   everything: the SCHEDULED peak, the chain it feeds, and the MEASURED
//   number that says whether the arithmetic was honest. Every "measured"
//   below is a 900 s render through render-soak.html at seed 20260713 with
//   the layer SOLOED, the manner off and then on, so the number is the
//   voice's own and not the mix's.
//
//   gurdy bed    THE ARMONICA. Pads (3 x 0.035 + 0.028) x 0.480 = 0.0638 and
//                the sub 0.022 x 0.480 = 0.0106 of envelope, into five sine
//                partials whose weights sum to 2.75 and whose COMPOSITE is
//                2.415 (measured over 30 s, the 4 / 4.02 beat included; the
//                sub keeps partials 1 and 2 only, 0.85). The rub band adds
//                0.28 x rub (<= 0.336 at the span's hi) of NOISE, incoherent
//                with the sines, so it sums in quadrature:
//                sqrt(0.1632^2 + 0.0215^2) = 0.1646, x gurdyLevel 0.10 x 2
//                (cycle overlap)                     0.031 -> 0.033
//                and NO grit at all: a glass cycle has no lowpass to send
//                from and no trompette to buzz, so the gurdy family's whole
//                share of the grit bus is silent for its life.
//                MEASURED: -0.14 dB against the cluster (and that is what
//                the 0.81 correction on the lab's constant bought - see the
//                constant's own note).
//   horn         THE REGISTER LAW. The scheduled peak does not move (0.028 +
//                breath 0.00728 + 3rd partial 0.0028 = 0.0381, x2 for the
//                two-note call = 0.0762). What moves is what the bell's
//                FIXED 300->900 Hz lid lets through: a band-limited saw's
//                peak through it is 1.34-1.46 at the old placement, 1.47-1.57
//                at -2 and 1.58-1.63 at -3, so the rendered body is up to
//                x1.21 where the ledger read it as x1.0
//                                                    0.0762 -> 0.0922
//                THE CONCH rides inside that: 0.028 x 1.044 = 0.0292 through
//                two peaking cavities and a 3200 Hz lid, measured peak 1.57
//                (shell 9) to 1.82 (shell at its span's hi) - the same peak
//                as the horn's own body, a very different spectrum (centroid
//                203-474 Hz where the horn at -3 is 90-152 Hz). So the conch
//                does not raise the line the register law already raised.
//                MEASURED: -1.39 dB against the horn (presence 3, for a
//                sample worth reading).
//   melody       THE THROAT halves the cantor's scheduled peak: 0.032 x vel
//                x MATCH 0.500 = 0.016. Its source is a saw at 0.55 plus a
//                square an octave down at `growl`, x 0.5, into tanh(3.2x) -
//                measured, the clip's output peaks at 0.990 and carries RMS
//                0.888 where the sung pair carried 0.675, and the 420 Hz
//                chest sits beside the mouth at 0.55. Net, against the rc.43
//                engine file with the layer soloed: +0.83 dB of RMS and 4.4
//                dB LESS peak (0.0383 vs 0.0634) - a clip is a limiter.
//                THE GLASS VIOLIN: 0.030 x vel x 0.224 = 0.0067 into
//                1 + 0.3 + 0.12 (composite 1.256) plus a rub band at 0.30 x
//                rub, incoherent: 0.0088, well UNDER the fiddle's own 0.030.
//                MEASURED +0.32 dB (the match is what makes those two
//                sentences agree).
//                THE CRYSTAL: 0.04 x vel x 1.012 = 0.0405 into three pairs
//                summing to 1.5 (composite 1.236) plus the finger at 0.2,
//                incoherent: 0.0507, beside the metal's own ~0.048.
//                MEASURED -0.21 dB.               0.0949 -> 0.0949 (held)
//   percussion   THE BONES. One clack is amt = 0.054 (frame 0.045 at the
//                stroke span's hi) x MATCH 1.200 = 0.0648, into a bar at 1,
//                its 2.71 mode at 0.35 and a body at 0.2 (composite 1.491)
//                plus the stick's 0.5 of noise, incoherent:
//                sqrt(0.0966^2 + 0.0324^2) = 0.102 for one clack - AND IT
//                LASTS ABOUT TWO MILLISECONDS, after which the bar rings at
//                6 % of that. Measured, layer-soloed: the RMS is -0.63 dB
//                against the drums and the worst PEAK is x1.59. So the
//                LAYER's line does not move - over any window longer than a
//                clave's contact the bones are the quieter manner - and the
//                2 ms onset is named here rather than hidden, exactly as
//                Ariel's marimba names its 4 ms one:
//                                                    0.1086 sustained, with
//                                                    a 2 ms onset of 0.17
//   ambient pool THE CAVE. The loudest of its eight bodies is the thunder
//                taken underground, 0.045 x 0.893 x 0.9 = 0.0362, under the
//                fen's own far thunder (0.045); the rumble, the next
//                loudest, is 0.026 x 0.893 = 0.0232. The sky's line does not
//                move.                              0.05 -> 0.05
//                MEASURED +0.81 dB (after the 0.75 correction on the lab's
//                constant - see it).
//   blade        THE WHALE: 0.008 x 0.891 = 0.0071 into three partials
//                summing to 1.55 (composite 1.236) plus the water at 0.2,
//                incoherent: 0.0089, under the blade's own 0.0136.
//                MEASURED -0.26 dB (presence 3).    0.0136 -> 0.0136 (held)
//   jaw harp     THE WIDER RANGE costs the chain nothing: the comb's delay
//                LENGTHENS (9.1 ms at the old placement, 18.2 at -1, 25.6 at
//                -2), which is further from the 2.9 ms render-quantum clamp
//                the body already asserts against, and the Q-4 mouth and the
//                x6 makeup do not move at all.      0.0303 -> 0.0303
//   ------------------------------------------------------------------
//   WORST SCENE, rc.44 (rc.35's numbers in brackets):
//     invocation   0.033 + 0.0922 + 0.010 + 0.075 + 0.0949 + 0.1086 + 0.05
//                  + 0.04 = 0.5037 + bullroarer 0.0413 + overtone 0.0323
//                  + blade 0.0136 + cauldron 0.0317 = 0.6226   [0.6045]
//   -> ~0.62 absolute worst into the rooms; x the equal-power split's dry
//   1.0 + wet ~0.3 -> ~0.81 at bus input, x masterGain 0.6 x the saturator's
//   small-signal ~1.66 -> ~0.806 into the limiter, still under the ~0.89
//   (-1 dB) master ceiling. For the two milliseconds of a bones onset add
//   0.065 and read 0.87 - which is the transient the limiter is there for,
//   and which no scene actually assembles.
//   MEASURED, 900 s through render-soak.html at seed 20260713, the cast shut
//   so only the knob differs (the shipped reference is -34.288 dB RMS, worst
//   peak 0.1943):
//     gurdy glass 1     -34.482 dB (-0.19)   peak 0.1935
//     horn conch 1      -34.501 dB (-0.21)   peak 0.1990
//     rebec glass 1     -34.343 dB (-0.06)   peak 0.2150
//     water crystal 1   -34.439 dB (-0.15)   peak 0.1814
//     perc bones 1      -34.360 dB (-0.07)   peak 0.2330
//     sky cave 1        -34.492 dB (-0.20)   peak 0.2071
//     blade whale 1     -34.279 dB (+0.01)   peak 0.2042
//     ALL SEVEN at 1    -34.752 dB (-0.46)   peak 0.2351  (-12.58 dBFS)
//   and at seed 20260709: reference -34.631, glass 1 -34.426 (+0.21). Zero
//   non-finite samples, zero silent windows outside a hush, zero page errors
//   in every one of them. The stops are darker, not louder - which is the
//   only thing this ledger has ever been for.
//
// rc.35 — THE WANDER (PLAN-SOUND-DIVERSITY §11.2 and §11.4). Until now a
// voice varied in WHAT it played and WHEN; its SOUND was set once — the
// bullroarer's ten-second swell, the jaw harp's three twangs, the blade's
// 1700 Hz. This pass makes every instrument PLAYED rather than set. Three
// classes of draw, through PJ2.Voice.wander (the shared helper, whose
// contract is documented at the end of pj2-voice.js): TOUCH, a fresh draw
// every sounding; CHARACTER, drawn once per evening at the performance
// begin; WEATHER, a slow drift over minutes, deterministic in RUN-RELATIVE
// time. The owner's knob stays the CENTRE and the span translates with it;
// each layer's strip ends in ONE `vary` knob (0–2, def 1) scaling all of
// that layer's spans — 0 is fixed at the knob, 2 is twice the reach,
// always clamped to each knob's own [min, max].
//
//   gurdy       THE SEAM, and so character and weather ONLY, both read at
//               the cycle's start and held for the whole cycle: brightness
//               (character ±12 %), warble (weather ±30 %), dog (character
//               ±20 %, the trompette's dose — promoted, def 1 = the body's
//               own 0.02). Nothing about this drone may move while it
//               sounds, or the floor moves under the listener.
//   horn        blossom, breath (touch ±30 %), scoop (touch ±40 %). The
//               attack is NOT ranged: rnd(3, 6) s already draws it per tone.
//   chant       openness (character ±10 %) × openDrift (weather ±15 %, the
//               plan's two classes on one mouth, promoted), vibrato (touch
//               ±35 %), breath (touch ±30 %, promoted — the thread's dose).
//   rebec       rosin (touch ±30 %), body (character ±12 %), attack (touch
//               84–156 ms, promoted — the rosin's grip, def 0.12 s).
//   waterphone  wail (touch ±40 %), bloom (touch ±35 %).
//   boneflute   breath (touch ±35 %), chiff (touch ±35 %, promoted — the
//               tongued onset, def 1 = the body's own 0.006).
//   percussion  irregularity (weather ±30 %), adorn (character ±25 %),
//               stroke (touch ±20 %, promoted — the hand's spread).
//   ambient     density (weather ±30 %) — timing only, never level.
//   bullroarer  swell 6–14 s, whirl 18–30 Hz, swing 0.55–1.1 Hz, air ±30 %
//               (touch); darkness 0.4–0.6, doppler 1.5–2.5 %, register
//               −2 (.7) / −3 (.3) (character).
//   overtone    lo 3–5, hi 8–12, step 0.9–1.9 s PER STEP, hold 7–14 s,
//               body ±25 % (touch); q 12–20 (character).
//   jawharp     twangs 1 (.1) 2 (.3) 3 (.35) 4 (.2) 5 (.05), mouth lo
//               400–620 Hz and hi 1450–2150 Hz and sweep 0.3–0.7 s PER
//               TWANG, sustain 0.92–0.96 per utterance (touch). The gap was
//               already ±40 % and stays the body's.
//   blade       pitch 1500–1900 Hz, friction ±40 %, swell 4–8 s (touch);
//               ratio 1.4–1.55 and pitchNight ±15 % (character — one blade
//               per night, shifting the centre the sounding is drawn around).
//   cauldron    plo 150–250 Hz, phi 300–500 Hz and poplen 40–90 ms PER POP;
//               pops 1.2–3 /s, length 4–8 s, wash ±30 % per simmer (touch).
//
// NEVER RANGED, on purpose: presence (an entry law), every level, the
// ceilings, the loop-gain cap, the registers per note, the jaw harp's gap
// (already ±40 %), and THE CUT — planCut's arithmetic, the hush, the dip
// and the horn's held breath are untouched by this round, as is every
// roster cell.
//
// THE BODY RULES the plan asks for alongside the spans — the slat GATHERING
// (×0.7 → 1 over its rise), the overtone's steps LONGER ON THE HIGHER
// HARMONICS (+35 % across the walk), the jaw harp's ONE IN THREE SWEEPS
// DOWNWARD, the pot's BUILD-THEN-SETTLE contour, the bullroarer's DARKER
// INVOCATION (+0.15), the blade's PRESSURE MOVING INSIDE ITS SWELL — are
// each scaled by their layer's own `vary`, so vary 0 is today's build in
// SOUND as well as in stream, and vary 1 is the shape §11.2 describes.
//
// STREAM NOTE (rc.35): the helper draws on its own forks —
// "wander:<layer>:touch", ":weather", ":dress:<n>" — and the one body-rule
// coin (the jaw harp's direction) on "wander:body:jawharp". All are made
// from the BIRTH seed, so not one pre-existing fork gained or lost a draw:
// at vary 0 the note+event stream is byte-identical to rc.33 (pinned in the
// harness as SYC35 VARY-ZERO, two seeds, 900 s, digest and length). At vary
// 1 a voice legitimately plays different things — a bullroarer whose swell
// is 12 s occupies its lane differently — so its OWN fork advances
// differently from there; that is the wander working, not a leak.
//
// ACROSS EVENINGS the rite remembers: the standard motif ghost (intoned by
// the chant in the next gathering, quiet), and THE BRUISE — last evening's
// cut severity carried as one scalar (murkier opening, earlier heartbeat,
// a "sting" first pose past 0.5). Pose state persists across the seam
// anyway; the rite resumes mid-gesture for free.
//
// Discipline inherited whole from pj2-library.js: every pitched note reads
// the PitchField AT SCHEDULE TIME (era-aware through the rare sink — no
// cached Hz, ever); every envelope through PJ2.Voice.env or anchored ramp
// pairs; everything musical from forked seeded streams (Math.random only
// inside noise/IR texture); melodic voices claim THE AIR, landscape never
// does; refusal means silence this cycle, never a throw; when in doubt,
// quieter — and here, when in doubt about "louder?", the answer is
// "darker instead".
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  // --------------------------------------------------------------------------
  // The intensity band (owner's aesthetic constants, binding).
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
  // uniform with PJ2.Library/PJ2.Ariel (getLayers / setLayerVolume /
  // getLayerVolumes / toggleLayer / setLayerRate / getLayerRates, plus the
  // fine-tune knob doors getLayerParams / setLayerParam / getLayerParamValues;
  // full design note in pj2-library.js). The gain side is STRICTLY GAIN-SIDE: mixer gains
  // (tagged _pj2Mix) are inserted into — or cleanly reused from — each
  // layer's chain; no randomness, no event-time effects, never a shared param
  // with the followers or the cut (cutGain, gurdyLevel, noiseLevel,
  // breathLevel, gritBlend, gritSendTromp keep their one writer; the mixer
  // gets its OWN stage beside each). The rate side only re-paces the layer's
  // own clock lanes; the form lanes (harmony, arrival, cut, follow) are
  // never scaled.
  //
  // Layer -> params (design values in parens):
  //   gurdy       mixGurdy (1) inserted gurdyLevel -> cutGain, + mixGritGurdy
  //               (1) inserted between the gurdy/trompette grit sends and the
  //               shaper — mute the gurdy and its saturated shadow dies too
  //   horn        layHorn (1) -> cutGain (rc.23, the under-voice); its fixed
  //               0.08 grit tap hangs off layHorn itself, so a muted horn
  //               sheds its saturated shadow with the same fader
  //   noise       mixNoise (1) inserted noiseLevel -> cutGain, + mixBreath (1)
  //               inserted breathLevel -> cutGain (ember-smoke, ruin-wind and
  //               the treeline murmur are one user-facing murk), +
  //               gritSendNoise (.25) — the bed's grit share follows the bed
  //   chant       per-seat wraps (1) over the shared pool + delaySendChant (.4)
  //   rebec       per-seat wraps (1) + delaySendRebec (.35)
  //   waterphone  per-seat wraps (1) + delaySendWater (.5) + throatSendWater
  //               (.10) — the apparition rides these too (it IS a waterphone)
  //   boneflute   per-seat wraps (1) — the flute has no sends
  //   percussion  layPerc (1) + layProto (1) + throatSendPerc (.06) — skins,
  //               wood, the proto-heartbeat, and the cave's answer to them
  //   ambient     layAmb (1)
  //
  // The throat's RETURN (layThroat) stays unowned: its exciters are all
  // mixer-scaled at their sends, so a muted source stops ringing the cavern
  // without orphaning a resonance the room still owes other voices. Same
  // for the seasick delay's return. Grit note: the shaper is nonlinear, so
  // intermediate volumes change the DRIVE (texture darkens as it fades) —
  // fine for a texture bus; 0 is still exactly silent and 1 exactly stock.
  // --------------------------------------------------------------------------
  var MIX_LAYERS = [
    { key: "gurdy",      label: "Hurdy-Gurdy", kind: "landscape" },
    { key: "horn",       label: "Low Horn",    kind: "landscape" },
    { key: "noise",      label: "Noise Bed",   kind: "landscape" },
    { key: "chant",      label: "Chant",       kind: "melodic" },
    { key: "rebec",      label: "Rebec",       kind: "melodic" },
    { key: "waterphone", label: "Waterphone",  kind: "melodic" },
    { key: "boneflute",  label: "Bone Flute",  kind: "melodic" },
    { key: "percussion", label: "Percussion",  kind: "percussion" },
    { key: "ambient",    label: "Ambient",     kind: "ambient" },
    // rc.32 — APPENDED, never inserted: a desk row that moves is a knob the
    // owner has to find again. The bullroarer and the overtone chant are
    // landscape (they sum into cutGain with the rest of the night); the jaw
    // harp is melodic but claims no air and takes no panner seat (its own
    // room registration); the blade is landscape by conduct but takes the
    // CAVERN and the delay wall only — "wide room only", the plan's phrase;
    // the cauldron is a pool member with its own row, so the pot can be
    // mixed apart from the sky.
    { key: "bullroarer", label: "Bullroarer",  kind: "landscape" },
    { key: "overtone",   label: "Overtone",    kind: "landscape" },
    { key: "jawharp",    label: "Jaw Harp",    kind: "melodic" },
    { key: "blade",      label: "Blade",       kind: "landscape" },
    { key: "cauldron",   label: "Cauldron",    kind: "ambient" },
  ];
  // key -> display name, for the cast event's plain words (rc.37)
  var MIX_LABELS = {};
  for (var mlbi = 0; mlbi < MIX_LAYERS.length; mlbi++) {
    MIX_LABELS[MIX_LAYERS[mlbi].key] = MIX_LAYERS[mlbi].label;
  }
  var MIX_MUTE_S = 0.3;  // mute/unmute ramp — click-safe, unhurried
  var MIX_VOL_S = 0.08;  // volume moves ride the master-volume ramp length

  // Layer -> clock lanes the RATE control re-paces (the mixing desk). The
  // breath bed rides with the noise layer — the mixer's "noise" already owns
  // its gain (mixBreath), and both are the same user-facing murk. The form
  // lanes (harmony, arrival, cut, follow) are never scaled.
  var MIX_RATE_LANES = {
    gurdy: ["gurdy"], horn: ["horn"], noise: ["noisebed", "breath"],
    chant: ["chant"], rebec: ["rebec"], waterphone: ["waterphone"],
    boneflute: ["boneflute"], percussion: ["protodrum", "percussion"],
    ambient: ["ambient"],
    // rc.32 — only the two voices with clocks of their own get a rate
    // slider. The bullroarer, the overtone chant and the jaw harp answer the
    // rite's POSE turns and its darkening ARRIVALS, and those are form lanes:
    // they carry structure, not voice, and are never re-paced (the same
    // reason the Library's halo has no rate). A slider that moves nothing is
    // worse than no slider.
    bullroarer: [], overtone: [], jawharp: [],
    blade: ["blade"], cauldron: ["cauldron"],
  };
  var MIX_RATE_MIN = 0.25, MIX_RATE_MAX = 4;

  // THE VARY KNOB (rc.35) — one per layer, always the LAST row of its strip.
  // It scales every span on that layer about the owner's own setting: 0 =
  // fixed at the knob (today's build, bit for bit), 1 = the authored span,
  // 2 = twice as wide, still clamped to each knob's [min, max]. A fresh
  // object per layer, so nothing on the desk can ever be shared by accident.
  function varyDef() {
    return {
      key: "vary",
      label: "vary — how far touch, character and weather may wander (0 = fixed)",
      min: 0, max: 2, def: 1,
    };
  }

  // PER-LAYER FINE-TUNE PARAMS (mixing desk II — the per-row knob strips;
  // pj2-library's design note is authoritative). Pure scalars read at
  // schedule time; every def equals the constant it replaces, so the
  // default desk is bit-identical to the unparametrized engine.
  //
  // rc.35 — THE SPANS (PLAN-SOUND-DIVERSITY §11.2 and §11.4). A def may now
  // carry `lo`, `hi` and `per` ("touch" | "character" | "weather"), plus
  // `round` for integers and `weights` for a weighted categorical draw. The
  // span is authored AROUND `def` and translates with the knob; PJ2.Voice.
  // wander does the arithmetic and draws on its own forks. NEW knobs are
  // APPENDED to a strip, never inserted — a knob that moves is a knob the
  // owner has to find again — so the promoted body constants sit after the
  // rc.32 rows and before `vary`.
  // ==========================================================================
  // THE STOPS (rc.44) — six of lab-sycorax.html's STOPS cards promoted into
  // the rite. Five of them are MANNERS: an option the evening may put on,
  // never a replacement. One of them — the chant's THROAT — is a body SWAP,
  // because the owner asked for it that way ("replace the chant we currently
  // have with the throat, so that only the throat occurs"), which is rc.31's
  // music-box precedent: a stop the owner chooses to live in stops being a
  // stop and becomes the instrument.
  //
  // Every manner is built the same way, and the next one will be too
  // (pj2-ariel's rc.42 is the family's precedent, inherited whole):
  //   * a SHARE knob on its layer's desk row (0–1, def 0) — the chance ONE
  //     sounding is played the other way, drawn on the stop's OWN fork;
  //   * the body's own knob, wandering like every other body knob;
  //   * a manner the EVENING CAST may draw from evening two (0.6 plain /
  //     0.4 the stop), which sets the effective share to 1 for that evening,
  //     and A MOVED KNOB WINS over the cast until it is put back;
  //   * a faithful port of the lab's shadow body, the lab's MEASURED
  //     level-match constant included, routed exactly as the engine's own
  //     body is routed (so the cut still ducks it, the mixer still faders it
  //     and the layer's absence still silences it).
  //
  // THE CONTRACT, in one line: A MANNER CHANGES THE SOUND AND NEVER THE
  // COMPOSITION. Every draw a stop makes is on a NEW label-hashed fork —
  // "cast", "gurdy:glass", "horn:conch", "rebec:glass",
  // "waterphone:crystal", "percussion:bones", "ambient:cave" — and every
  // body's own dice (a rattle's clacks, a rockfall's stones) come off the
  // stop's fork too, never off the voice's. So the same seed plays the same
  // evening, note for note and event for event, whichever way it is played.
  //
  // WHERE THE MANNER IS DRAWN is the one thing that differs per voice, and
  // it follows the voice's own grain:
  //   gurdy        per CYCLE (the seam: nothing may change while it sounds)
  //   horn         per TONE          rebec        per NOTE
  //   waterphone   per NOTE          percussion   per STROKE (never the
  //                                               heartbeat: it is the
  //                                               hush's heart)
  //   ambient      per ONE-SHOT (never the organum pad, never the cut's
  //                indrawn breath: those are the rite's own gestures
  //                rendered into the sky's layer, not sky one-shots)
  //
  // THE LEVEL MATCH is what lets a radical stop be radical without being
  // louder: the same envelope peak through two different spectra can differ
  // by many decibels, so each body carries the lab's MEASURED scale factor.
  // These are lab-sycorax.html's own MATCH constants, copied verbatim.
  // ==========================================================================
  // THE ONE RE-MEASURED CONSTANT. The lab's is 0.593, measured on its shadow
  // bus against a gurdy reference that carried the page's own approximation
  // of the trompette. On the ENGINE's bus a glass cycle carries no trompette
  // and no grit AT ALL (see armonicaPad), and five sine partials at RMS 0.93
  // sit where four saws under a 200 Hz lid sat at RMS ~0.35 — so 0.593 landed
  // the armonica 1.8 dB OVER the cluster, measured layer-soloed at 900 s
  // through render-soak.html. The engine's own correction is beside the lab's
  // number rather than instead of it: 0.593 x 0.81. Re-measured after the
  // trim: +0.1 dB. (The family has done this before — the jaw harp's mbira
  // constant was re-measured the day its body changed underneath it.)
  var MATCH_GURDY_ARMONICA = 0.593 * 0.81;  // = 0.480, five glass partials where the cluster had one saw under a 200 Hz lid
  var MATCH_HORN_CONCH = 1.044;      // two bright formants carry more power than a 300→900 Hz lowpass
  var MATCH_CHANT_THROAT = 0.500;    // a square an octave down through a clip is 6 dB the cantor's saw never had
  var MATCH_REBEC_GLASS = 0.224;     // three partials and a wide sustained rub against a saw through four bandpasses
  var MATCH_WATER_CRYSTAL = 1.012;   // three pure partials against six inharmonic ones plus FM
  var MATCH_PERC_BONES = 1.200;      // a bar rings 0.14 s where the frame's body runs 0.18
  // THE SECOND RE-MEASURED CONSTANT, for the same reason as the armonica's.
  // The lab's is 1.191 (a one-shot-to-one-shot correction: animals and drips
  // are shorter events than a six-second gust). On the engine's own sky it
  // landed the cave 2.5 dB over the fen, layer-soloed at 900 s — the cave's
  // bodies are not only shorter, they are BUSIER (a rockfall is eight clacks
  // and a thud where a stone-grind is one swept saw). 1.191 x 0.75.
  var MATCH_AMB_CAVE = 1.191 * 0.75;  // = 0.893, drips and bats against a 6-second gust
  var MATCH_BLADE_WHALE = 0.891;     // two octaves down, under a 900 Hz lid
  // The whale's three partials, and the sea's own wow on each of them.
  var WHALE_PARTIALS = [[1, 1], [2, 0.4], [3, 0.15]];

  // The armonica's five partials, WEIGHT ON THE FOURTH — glass radiates from
  // its upper modes, and that is the whole reason this is not "a quieter
  // cluster". The fourth is split into a beating pair (4 and 4.02).
  var ARM_PARTIALS = [[1, 0.35], [2, 0.5], [4, 0.8], [4.02, 0.8], [5.4, 0.3]];
  // The glass violin's three, the third INHARMONIC (2.76 — a rim mode, not a
  // twelfth: a 1:2:3 set reads as an organ pip, which is what the lab's fix
  // round re-cut this body to escape).
  var REBEC_GLASS_PARTIALS = [[1, 1], [2, 0.3], [2.76, 0.12]];
  // The crystal rim's three harmonic pairs.
  var CRYSTAL_PARTIALS = [[1, 1], [2, 0.35], [3, 0.15]];
  // The evening cast's coin, per stop.
  var CAST_STOP_P = 0.4;
  // …and the seven stops it may draw, in the ONE FIXED ORDER the coins are
  // tossed in. The order is load-bearing: an eighth stop appended here one
  // day costs the seven above it not a single draw, so tonight's gurdy is
  // still tonight's gurdy on the same seed.
  var CAST_STOPS = [
    { layer: "gurdy", share: "glass", manner: "glass", plain: "wheel",
      dress: "gurdy, glass armonica" },
    { layer: "horn", share: "conch", manner: "conch", plain: "horn",
      dress: "horn, conch shell" },
    { layer: "rebec", share: "glassviolin", manner: "glass", plain: "rebec",
      dress: "rebec, glass violin" },
    { layer: "waterphone", share: "crystal", manner: "crystal", plain: "waterphone",
      dress: "waterphone, crystal" },
    { layer: "percussion", share: "bones", manner: "bones", plain: "drums",
      dress: "percussion, bones" },
    { layer: "ambient", share: "cave", manner: "cave", plain: "fen",
      dress: "sky, the cave" },
    { layer: "blade", share: "whale", manner: "whale", plain: "blade",
      dress: "blade, the whale" },
  ];
  // The bones sound ONE OCTAVE BELOW the lab's placement — the owner's own
  // setting, baked into the body the way Ariel's marimba bakes its +1: a
  // transposition of the instrument, not a knob for the desk.
  var BONES_OCT = 0.5;

  var LAYER_PARAMS = {
    gurdy: [
      { key: "brightness", label: "brightness — how open the cluster's lowpass sits", min: 0.5, max: 1.6, def: 1,
        lo: 0.88, hi: 1.12, per: "character" },
      { key: "warble", label: "warble — the pitch drift's reach", min: 0, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "weather" },
      // promoted rc.35: the trompette's env dose, the body's own 0.02
      { key: "dog", label: "dog — the trompette's buzzing dose into the grit bus", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "character" },
      // rc.44 — THE ARMONICA (see THE STOPS above). `glass` is a SHARE, not
      // a switch: the chance one CYCLE is bowed glass instead of the
      // wheel-and-string cluster, drawn at the cycle's own start on the
      // stop's own fork and held for the cycle's whole life (the seam's
      // rule — nothing about this drone may move while it is sounding). A
      // share carries no span: it is an entry law, like presence.
      { key: "glass", label: "glass — the share of cycles bowed as a GLASS ARMONICA instead of the wheel", min: 0, max: 1, def: 0 },
      // …and the body's own knob. CHARACTER, because the seam varies by
      // character and weather only, both read at the cycle's start.
      { key: "rub", label: "rub — the wet finger's friction on the glass", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "character" },
      varyDef(),
    ],
    horn: [
      // rc.37 — PRESENCE. The owner, 2026-09-03: "it's a little too cluttered
      // now that we added all the new instruments. Reduce the frequency of
      // most instruments." One uniform knob per non-seam layer: it
      // MULTIPLIES every entry chance and DIVIDES every rest and margin
      // (capped at twice as long). The shipped default IS the reduction;
      // 1 is the pre-rc.37 rate, exactly (the harness pins that identity).
      // rc.40 walked every default here HALFWAY BACK — 0.6 -> 0.8 on this
      // strip — because rc.37's first cut was thinner than the owner's ear
      // wanted. Only the numbers moved; the law above is untouched.
      { key: "presence", label: "presence — how often the treeline answers (entry chance × this, rests ÷ it)", min: 0, max: 3, def: 0.8 },
      { key: "blossom", label: "blossom — how far the bell opens", min: 0, max: 1.5, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "breath", label: "breath — the air in the bore", min: 0, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "scoop", label: "scoop — the attack's pitch dip", min: 0, max: 2, def: 1,
        lo: 0.6, hi: 1.4, per: "touch" },
      // rc.44 — THE REGISTER LAW. The owner, 2026-09-04: "drop it down
      // either one or two octaves — a −2 or a −1 from where it's at now —
      // and no longer played at the zero point where it's at now." So every
      // horn tone (the conch's included, and the afterimage's far call and
      // the arrival's answer, which are horn tones) is drawn ONE or TWO
      // octaves below the treeline's rc.23 placement, per tone, on the
      // wander's own touch fork. The knob is that offset in OCTAVES: at its
      // default the weighted draw plays the law, and a MOVED knob (0 for
      // today's placement, −1 or −2 to pin one) is the owner's word and
      // wins — a weighted def costs the fork no draw when it is moved,
      // which is what lets the identity row ask for today's stream back.
      { key: "register", label: "register — octaves below the treeline's old placement (−1 or −2, drawn per tone)", min: -2, max: 0, def: -1.5,
        per: "touch", round: true, weights: [[-1, 0.5], [-2, 0.5]] },
      // rc.44 — THE CONCH (a manner; see THE STOPS above).
      { key: "conch", label: "conch — the share of calls blown on a SHELL instead of the horn", min: 0, max: 1, def: 0 },
      { key: "shell", label: "shell dB — how hard the conch's two cavity peaks bite", min: 0, max: 16, def: 9,
        lo: 7, hi: 11, per: "touch" },
      varyDef(),
    ],
    chant: [
      // rc.37 — the PRINCIPAL's presence: the cantor is thinned least (0.9
      // since rc.40, 0.8 before it), and is never absent. See the horn
      // strip's note for the rule and for rc.40's midpoint.
      { key: "presence", label: "presence — how often the cantor speaks (phrase chance × this, rests ÷ it)", min: 0, max: 3, def: 0.9 },
      { key: "openness", label: "openness — how wide the vowel mouth opens", min: 0.5, max: 1.6, def: 1,
        lo: 0.9, hi: 1.1, per: "character" },
      { key: "vibrato", label: "vibrato — the cantor's wobble depth", min: 0, max: 2, def: 1,
        lo: 0.65, hi: 1.35, per: "touch" },
      // promoted rc.35: the mouth's slow breathing, and the breath thread's
      // own dose (the body's 0.010 + 0.014·breath, scaled)
      { key: "openDrift", label: "open drift — how the vowel's width breathes over minutes", min: 0.5, max: 1.5, def: 1,
        lo: 0.85, hi: 1.15, per: "weather" },
      { key: "breath", label: "breath — the unvoiced air threaded under the tone", min: 0, max: 3, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      // rc.44 — THE THROAT is the cantor's body now (a SWAP, not a manner:
      // the owner asked that only the throat occur). `growl` is the weight
      // of the kargyraa sub-octave square under the vowel. CHARACTER, like
      // the mouth's own openness: a voice does not change its throat
      // mid-evening.
      { key: "growl", label: "growl — the kargyraa sub-octave's weight under the vowel", min: 0, max: 1.5, def: 1,
        lo: 0.85, hi: 1.15, per: "character" },
      varyDef(),
    ],
    rebec: [
      { key: "presence", label: "presence — how often the fiddle plays (phrase chance × this, rests ÷ it)", min: 0, max: 3, def: 0.8 },
      { key: "rosin", label: "rosin — the bow-noise thread on the attack", min: 0, max: 3, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "body", label: "body — how hard the box resonances ring", min: 0.4, max: 2, def: 1,
        lo: 0.88, hi: 1.12, per: "character" },
      // promoted rc.35: how long the rosin grips (the body's 0.12 s)
      { key: "attack", label: "attack s — how long the rosin grips before the tone takes over", min: 0.03, max: 0.3, def: 0.12,
        lo: 0.084, hi: 0.156, per: "touch" },
      // rc.44 — THE GLASS VIOLIN (a manner; see THE STOPS above). The rebec
      // keeps its own body; this is the other way the same phrase may be
      // bowed, drawn per NOTE on the stop's own fork.
      { key: "glassviolin", label: "glass violin — the share of notes bowed on GLASS instead of gut", min: 0, max: 1, def: 0 },
      { key: "rub", label: "rub — how hard the finger sticks and slips on the glass", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "touch" },
      varyDef(),
    ],
    waterphone: [
      // the CUT's apparition is the cut's gesture, not the waterphone's
      // entry: presence never touches it (and neither does an absence).
      { key: "presence", label: "presence — how often the metal speaks (phrase chance × this, rests ÷ it)", min: 0, max: 3, def: 0.8 },
      { key: "wail", label: "wail — how far each note glisses down (%)", min: 0, max: 6, def: 1.8,
        lo: 1.08, hi: 2.52, per: "touch" },
      { key: "bloom", label: "bloom — the FM swell inside the sustain", min: 0, max: 2, def: 1,
        lo: 0.65, hi: 1.35, per: "touch" },
      // rc.44 — THE METAL'S RANGE WIDENS. Every waterphone note is drawn at
      // today's placement or one octave below it, per note, equal odds. The
      // CUT's apparition is the cut's own gesture, not the waterphone's
      // entry, and it keeps its placement (as presence and the absences
      // already leave it alone).
      { key: "register", label: "register — octaves below the metal's old placement (0 or −1, drawn per note)", min: -1, max: 0, def: -0.5,
        per: "touch", round: true, weights: [[0, 0.5], [-1, 0.5]] },
      // rc.44 — THE CRYSTAL (a manner; see THE STOPS above), with a register
      // law of its OWN: a rubbed rim is a bigger, slower thing than a struck
      // rod, and it never sounds at today's placement.
      { key: "crystal", label: "crystal — the share of notes rung as a CRYSTAL rim instead of the metal", min: 0, max: 1, def: 0 },
      { key: "beat", label: "beat Hz — how fast the crystal rim's pairs beat", min: 0.2, max: 6, def: 2.5,
        lo: 1.8, hi: 3.2, per: "touch" },
      { key: "crystalRegister", label: "crystal register — octaves below the old placement for a crystal note (−1 or −2)", min: -2, max: -1, def: -1.5,
        per: "touch", round: true, weights: [[-1, 0.5], [-2, 0.5]] },
      varyDef(),
    ],
    boneflute: [
      { key: "presence", label: "presence — how often the flute is heard (phrase chance × this, rests ÷ it)", min: 0, max: 3, def: 0.8 },
      { key: "breath", label: "breath — the air across the embouchure", min: 0, max: 3, def: 1,
        lo: 0.65, hi: 1.35, per: "touch" },
      // promoted rc.35: the tongued edge — the breath's onset stage (0.006)
      { key: "chiff", label: "chiff — the tongued edge on the note's onset", min: 0, max: 3, def: 1,
        lo: 0.65, hi: 1.35, per: "touch" },
      varyDef(),
    ],
    percussion: [
      // the STROKES only — frame, log and rattle. The proto-drum heartbeat
      // is the hush's heart and is never thinned (nor ever absent).
      { key: "presence", label: "presence — how often the strokes fall (the heartbeat is never thinned)", min: 0, max: 3, def: 0.85 },
      { key: "irregularity", label: "irregularity — how loosely the walk keeps its grid", min: 0, max: 2.5, def: 1,
        lo: 0.7, hi: 1.3, per: "weather" },
      { key: "adorn", label: "adorn — how often pairs and rattles answer", min: 0, max: 2.5, def: 1,
        lo: 0.75, hi: 1.25, per: "character" },
      // promoted rc.35: the hand's velocity spread on the skin strokes
      { key: "stroke", label: "stroke — the hand's velocity spread, one skin stroke to the next", min: 0, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "touch" },
      // rc.44 — THE BONES (a manner; see THE STOPS above). The share is over
      // the STROKES only — frame, log and rattle. The proto-drum heartbeat
      // is never re-voiced and never even draws: it is the hush's heart, and
      // it beats the same in every manner.
      { key: "bones", label: "bones — the share of STROKES played on dry wood (never the heartbeat)", min: 0, max: 1, def: 0 },
      // The owner's own setting, and so the shipped default: 0.5, half the
      // lab's ring. A drier bone is a bone.
      { key: "dryness", label: "dryness — how long the bones' wood rings (lower is deader)", min: 0.2, max: 2, def: 0.5,
        lo: 0.4, hi: 0.6, per: "touch" },
      varyDef(),
    ],
    ambient: [
      { key: "density", label: "density — how often the dark speaks", min: 0.5, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "weather" },
      // rc.44 — THE CAVE (a manner; see THE STOPS above). Not new members in
      // the pool, as Ariel's seaside was: the same eight one-shots, at the
      // same moments, in the cave's voice. So the pool's weighted draw, its
      // gap law and its weather gating are untouched by construction — the
      // sky says the same things, underground.
      { key: "cave", label: "cave — the share of sky one-shots voiced as THE CAVE instead of the fen", min: 0, max: 1, def: 0 },
      // the lab's own `cave` size knob, renamed on the desk so the share can
      // keep the name the owner used for it
      { key: "depth", label: "depth — how deep the cave runs (the drips' ring, the knock's echo)", min: 0.2, max: 2, def: 1,
        lo: 0.8, hi: 1.2, per: "touch" },
      varyDef(),
    ],
    // rc.32 — the five auditioned voices. EVERY default is the knob the
    // owner left on lab-sycorax.html (2026-09-03), so the desk at rest is
    // exactly the instrument they heard. Every timbral constant of the five
    // is read through pVal at schedule time — nothing is hard-coded in a
    // body — which is also the hook the per-evening parameter SPANS of a
    // later phase will hang on (this phase builds no spans).
    // "presence" multiplies every entry chance (the cauldron's divides its
    // clock instead — presence rides the timer there, not the draw). rc.37
    // lowered all five defaults 1 -> 0.6, and rc.40 walked them back to the
    // midpoint, 0.8: the knob's meaning is unchanged either time, only the
    // rate the engine ships with.
    bullroarer: [
      { key: "whirl", label: "whirl Hz — how fast the slat spins (the chop)", min: 8, max: 60, def: 24,
        lo: 18, hi: 30, per: "touch" },
      { key: "swing", label: "swing Hz — the arm's slower circle (bends the whirl ±40 %)", min: 0.2, max: 2, def: 0.8,
        lo: 0.55, hi: 1.1, per: "touch" },
      { key: "doppler", label: "doppler % — the pitch wobble as it comes and goes", min: 0, max: 5, def: 2,
        lo: 1.5, hi: 2.5, per: "character" },
      { key: "air", label: "air — the band of wind the slat drags with it", min: 0, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "darkness", label: "darkness — closes the lowpass (400 Hz at the default)", min: 0, max: 1, def: 0.5,
        lo: 0.4, hi: 0.6, per: "character" },
      { key: "swell", label: "swell s — the rise, and the fall, each", min: 4, max: 20, def: 10,
        lo: 6, hi: 14, per: "touch" },
      { key: "register", label: "register — which octave the slat sits in (−3/−2, rounded)", min: -3, max: -2, def: -2,
        per: "character", round: true, weights: [[-2, 0.7], [-3, 0.3]] },
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.8 },
      varyDef(),
    ],
    overtone: [
      { key: "q", label: "Q — how narrow the singing formant is", min: 6, max: 30, def: 16,
        lo: 12, hi: 20, per: "character" },
      { key: "lo", label: "lowest harmonic in the walk (rounded)", min: 3, max: 6, def: 4,
        lo: 3, hi: 5, per: "touch", round: true },
      { key: "hi", label: "highest harmonic in the walk (rounded)", min: 6, max: 12, def: 10,
        lo: 8, hi: 12, per: "touch", round: true },
      { key: "step", label: "step s — how long each overtone is held", min: 0.6, max: 3, def: 1.4,
        lo: 0.9, hi: 1.9, per: "touch" },
      { key: "body", label: "body — the fundamental's own level under the sweep", min: 0, max: 2, def: 1,
        lo: 0.75, hi: 1.25, per: "touch" },
      { key: "hold", label: "hold s — how long the tone is held", min: 6, max: 20, def: 10,
        lo: 7, hi: 14, per: "touch" },
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.8 },
      varyDef(),
    ],
    jawharp: [
      { key: "sustain", label: "sustain — how long the tongue rings (this IS the loop gain)", min: 0.85, max: 0.97, def: 0.94,
        lo: 0.92, hi: 0.96, per: "touch" },
      { key: "mlo", label: "mouth lo Hz — where the sweep starts", min: 300, max: 900, def: 500,
        lo: 400, hi: 620, per: "touch" },
      { key: "mhi", label: "mouth hi Hz — where the sweep ends", min: 900, max: 2500, def: 1800,
        lo: 1450, hi: 2150, per: "touch" },
      { key: "sweep", label: "sweep s — how fast the mouth opens per twang", min: 0.2, max: 1.2, def: 0.5,
        lo: 0.3, hi: 0.7, per: "touch" },
      { key: "twangs", label: "twangs — how many in one utterance (rounded)", min: 1, max: 6, def: 3,
        per: "touch", round: true,
        weights: [[1, 0.1], [2, 0.3], [3, 0.35], [4, 0.2], [5, 0.05]] },
      { key: "gap", label: "gap s — the average space between twangs (±40 %)", min: 0.3, max: 2, def: 0.8 },
      // rc.44 — THE WIDER RANGE. The owner: "expand the octave range so it
      // can go from the zero all the way down to negative two." One draw per
      // UTTERANCE (every twang of it at one placement — a player does not
      // change instrument mid-phrase), equal odds over the three. Downward
      // is the safe direction for the comb: a lower pitch is a LONGER delay,
      // further from the render-quantum clamp the body already asserts.
      { key: "register", label: "register — octaves below the harp's old placement (0, −1 or −2, per utterance)", min: -2, max: 0, def: -1,
        per: "touch", round: true, weights: [[0, 1], [-1, 1], [-2, 1]] },
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.8 },
      varyDef(),
    ],
    blade: [
      { key: "pitch", label: "pitch Hz — where the blade sings (snapped to the field)", min: 1200, max: 2500, def: 1700,
        lo: 1500, hi: 1900, per: "touch" },
      { key: "ratio", label: "ratio — the second sine, inharmonic against the first", min: 1.2, max: 1.8, def: 1.47,
        lo: 1.4, hi: 1.55, per: "character" },
      { key: "friction", label: "friction — the bow's grip on the edge", min: 0, max: 2, def: 1,
        lo: 0.6, hi: 1.4, per: "touch" },
      { key: "swell", label: "swell s — the rise, and the fall, each", min: 4, max: 8, def: 6,
        lo: 4, hi: 8, per: "touch" },
      { key: "presence", label: "presence — multiplies every entry chance", min: 0, max: 3, def: 0.8 },
      // promoted rc.35: the evening's own blade — a nightly shift of the
      // pitch centre, multiplying the per-sounding draw
      { key: "pitchNight", label: "pitch night — the evening's own blade, shifting the pitch centre", min: 0.8, max: 1.25, def: 1,
        lo: 0.85, hi: 1.15, per: "character" },
      // rc.44 — THE WHALE (a manner; see THE STOPS above). The two-octave
      // drop is INSIDE the body, as the lab cut it: that transposition is
      // the class change — whales do not sing in the treble — so it is not a
      // knob. `glide` is how far the song bends, in semitones.
      { key: "whale", label: "whale — the share of soundings sung as a WHALE instead of bowed", min: 0, max: 1, def: 0 },
      { key: "glide", label: "glide — how far the whale's song bends, in semitones", min: 0, max: 14, def: 5,
        lo: 3.5, hi: 7, per: "touch" },
      varyDef(),
    ],
    cauldron: [
      { key: "plo", label: "pitch lo Hz — where a pop starts", min: 150, max: 400, def: 200,
        lo: 150, hi: 250, per: "touch" },
      { key: "phi", label: "pitch hi Hz — where a pop lands, one pop-length later", min: 250, max: 800, def: 400,
        lo: 300, hi: 500, per: "touch" },
      { key: "pops", label: "pops/s — how busy the pot is (±50 % jitter)", min: 0.5, max: 5, def: 2,
        lo: 1.2, hi: 3, per: "touch" },
      { key: "length", label: "length s — how long one simmer lasts", min: 4, max: 8, def: 6,
        lo: 4, hi: 8, per: "touch" },
      { key: "wash", label: "wash — the low simmer under the pops", min: 0, max: 2, def: 1,
        lo: 0.7, hi: 1.3, per: "touch" },
      { key: "presence", label: "presence — shortens the gap between firings", min: 0, max: 3, def: 0.8 },
      // promoted rc.35: every bubble its own size — the body's 60 ms rise
      { key: "poplen", label: "pop s — how long one bubble takes to rise", min: 0.02, max: 0.15, def: 0.06,
        lo: 0.04, hi: 0.09, per: "touch" },
      varyDef(),
    ],
  };

  // --------------------------------------------------------------------------
  // THE SCENE ROSTER (L3, rc.32) — PLAN-SOUND-DIVERSITY §5.3's table as the
  // owner adopted it on lab-sycorax.html (its PLAN_DEFAULT, verbatim, in
  // SCENE_COLS order). 1 = this voice may ENTER in this column; 0 = it rests.
  //
  // Resting is the absence of NEW entries only: a cycle or an utterance begun
  // where it was welcome finishes across the boundary, and the roster never
  // touches a roll — every opportunity's dice are thrown first and the gate
  // comes after (stream discipline, the Library's rc.31 rule).
  //
  // A row ticked in EVERY column has no opinion, so it carries no gate at all:
  // the gurdy (THE SEAM — its lane is never cancelled, not even by the cut),
  // the murk, the chant (the principal speaker, in every scene, sinking
  // through the afterimage), the percussion family and the ambient pool are
  // ticked everywhere. The plan rests players, not the cave. If a future
  // edit gives one of those rows an opinion it must also give it a gate.
  //
  // Two ticks are the lab page's own, and are named there as such:
  //   - the BONE FLUTE's invocation tick (SPEAK_P.boneflute is 0.25 in the
  //     processional AND the invocation, so the table follows the engine);
  //   - the OVERTONE's processional tick (its entry law is processional +
  //     invocation, so the table follows the entry law).
  // The afterimage's "percussion = proto only" is a STOP move, not a roster
  // move, and is out of scope here: percussion stays ticked everywhere.
  // --------------------------------------------------------------------------
  var ROSTER_COLS = ["gathering", "processional", "circling", "invocation",
                     "afterimage"];
  var SCENE_ROSTER = {
    //            gather  proc  circle  invoc  after
    gurdy:      [1, 1, 1, 1, 1],   // the seam — never rests
    horn:       [0, 1, 0, 1, 1],   // rests in the gathering and the circling; the far call stays
    noise:      [1, 1, 1, 1, 1],
    chant:      [1, 1, 1, 1, 1],
    rebec:      [0, 1, 1, 0, 0],
    waterphone: [0, 0, 1, 0, 0],   // the cut's apparition is the cut's, not an entry
    boneflute:  [0, 1, 0, 1, 0],
    percussion: [1, 1, 1, 1, 1],
    ambient:    [1, 1, 1, 1, 1],
    bullroarer: [0, 1, 0, 1, 0],
    overtone:   [0, 1, 0, 1, 0],
    jawharp:    [0, 0, 1, 0, 0],
    blade:      [0, 0, 0, 1, 1],
    cauldron:   [1, 0, 1, 1, 0],
  };

  // ---- WHO MAY SIT AN EVENING OUT (rc.37) ---------------------------------
  // The owner, 2026-09-03: "bring back the idea that on certain playthroughs
  // some instruments are not heard at all — one, two, even three sometimes.
  // But not as a ban." PJ2.Voice.absences owns the law; this list is the
  // engine's opinion about who may be drawn. NOT eligible, and named here so
  // the omissions are deliberate rather than forgotten:
  //   gurdy       THE SEAM — the night has no other floor
  //   noise       the murk bed, the seam's own weather
  //   ambient     the dark outside the circle is not an instrument
  //   percussion  the rite's walk and the proto-drum's heart (the hush's
  //               heartbeat beats even inside the cut)
  //   chant       the PRINCIPAL speaker — the ghost is intoned by the cantor,
  //               so an evening without one would be an evening without a
  //               memory. It is thinned (0.8), never absent.
  // Nine eligible, so a third of the cast is three: the helper's own cap.
  var ABSENCE_ELIGIBLE = ["horn", "rebec", "waterphone", "boneflute",
                          "bullroarer", "overtone", "jawharp", "blade", "cauldron"];

  var DEFAULT_SEED = 1400137155; // "SYCX" as a 32-bit word, near enough

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
  // THE POSES — color without motion. Root pinned to i forever; these five
  // rotations of the sycorax degrees (0=Eb 1=E 2=F# 3=G 4=Ab 5=Bb 6=B) are
  // the whole harmonic vocabulary, stepped by a no-repeat pose-Markov on a
  // slow lane (22â40 s). "afterimage" ({0,5}, the bare open fifth — the
  // night's only consonance) has NO markov row and appears in no row's
  // pool: it is reachable only by setPose at the afterimage's entry, and
  // holds (drawlessly) until the next evening's opening pose replaces it.
  // The markov rows are authored with no self-weights (no consecutive
  // repeats, asserted) and a mild gravity back toward "coil" and "sting" —
  // the rite circles its two home postures the way the drum circles the
  // fire.
  // ==========================================================================
  var POSE_TABLE = {
    "coil":       [0, 2, 4],    // stacked-third default — already a cluster
    "sting":      [0, 1, 5],    // the flat second against the fifth; the keen's ground
    "hollow":     [0, 3, 6],    // augmented shell (Eb G B)
    "veil":       [0, 2, 5],    // the one near-minor-triad; the lure
    "smoke":      [0, 4, 6],    // root, Ab, B
    "afterimage": [0, 5],       // the bare fifth — residue, not resolution
  };
  var POSE_MARKOV = {
    "coil":   [["sting", 3], ["veil", 2.5], ["hollow", 2], ["smoke", 1.5]],
    "sting":  [["coil", 3], ["smoke", 2], ["hollow", 2], ["veil", 1.5]],
    "hollow": [["sting", 3], ["coil", 2.5], ["smoke", 2], ["veil", 1]],
    "veil":   [["sting", 3.5], ["coil", 2], ["hollow", 1.5], ["smoke", 1.5]],
    "smoke":  [["coil", 3], ["sting", 2.5], ["veil", 2], ["hollow", 1]],
  };

  // --------------------------------------------------------------------------
  // THE ORGANUM DOUBLING TABLE — authored per degree class of the top line,
  // lower = top + offset (offsets negative, in scale degrees). Prefer the
  // in-scale perfect fifth below, fall back to the perfect fourth where the
  // mode denies a fifth, and take the third-below shell where it denies
  // both (the historical occursus compromise). Worked from the sycorax
  // steps [0,1,3,4,5,7,8], all seven entries verified by semitone
  // arithmetic (top semis â lower semis):
  //   class 0 (Eb, 0)  â â3 (deg â3 = class 4 oct â1, semi â7)  = P5 below
  //   class 1 (E,  1)  â â2 (class 6 oct â1, semi â4)           = P4 below
  //   class 2 (F#, 3)  â â3 (class 6 oct â1, semi â4)           = P5 below
  //   class 3 (G,  4)  â â3 (class 0, semi 0)                   = M3 below (occursus)
  //   class 4 (Ab, 5)  â â4 (class 0, semi 0)                   = P4 below
  //   class 5 (Bb, 7)  â â5 (class 0, semi 0)                   = P5 below
  //   class 6 (B,  8)  â â5 (class 1, semi 1)                   = P5 below
  // This matches pj2-harmony's computed fallback exactly; passing it
  // explicitly makes the table assertable and survives any future change
  // to the computed preference order.
  // --------------------------------------------------------------------------
  var ORGANUM_DOUBLING = { 0: -3, 1: -2, 2: -3, 3: -3, 4: -4, 5: -5, 6: -5 };

  // ==========================================================================
  // THE CHANT'S MARKOV — authored, not ported (the plan's one deliberate
  // break with the family's "no self-weight" instinct). Plainchant conduct:
  // heavy stepwise gravity, a narrow ambitus, a real 0.25 self-weight on
  // degree 5 (Bb — the reciting tone a fifth above the final; recitation
  // REPETITION is the point), and row endings that fall through 1 (the
  // flat second) toward 0. Degree order: Eb E F# G Ab Bb B.
  // ==========================================================================
  var CHANT_MARKOV = [
    [0.06, 0.34, 0.14, 0.08, 0.10, 0.22, 0.06],  // Eb: up to the b2, or lift to the tone
    [0.40, 0.05, 0.22, 0.10, 0.08, 0.10, 0.05],  // E: falls home, mostly
    [0.10, 0.28, 0.05, 0.30, 0.12, 0.10, 0.05],  // F#: steps either way
    [0.06, 0.10, 0.30, 0.05, 0.30, 0.14, 0.05],  // G: a passing stone
    [0.05, 0.08, 0.12, 0.28, 0.05, 0.34, 0.08],  // Ab: leans up to the reciting tone
    [0.04, 0.08, 0.06, 0.10, 0.22, 0.25, 0.25],  // Bb: RECITES (self 0.25), or spills over
    [0.05, 0.12, 0.05, 0.06, 0.16, 0.44, 0.12],  // B: falls back onto Bb
  ];

  // The rebec inherits SYC_GHOST_MARKOV verbatim (prosperos-jukebox-audio.js
  // :121) — the tritone/minor-2nd wander that made v1's ghost tones ghosts
  // is exactly a wyrd fiddle's hand.
  var REBEC_MARKOV = [
    [0.05, 0.25, 0.15, 0.10, 0.20, 0.10, 0.15],
    [0.20, 0.05, 0.10, 0.15, 0.10, 0.25, 0.15],
    [0.10, 0.15, 0.05, 0.25, 0.15, 0.10, 0.20],
    [0.15, 0.10, 0.20, 0.05, 0.25, 0.15, 0.10],
    [0.25, 0.10, 0.15, 0.20, 0.05, 0.10, 0.15],
    [0.10, 0.20, 0.15, 0.10, 0.15, 0.05, 0.25],
    [0.15, 0.15, 0.20, 0.10, 0.15, 0.20, 0.05],
  ];

  // Transform-weight rows, PLAN-SYCORAX Â§5 verbatim: lungs favor the whole
  // line; the mordent hand ornaments; the metal dilates; the breath runs out.
  var VOICE_WEIGHTS = {
    chant: {
      augment: 3, transpose: 2, invert: 1.5, fragmentTail: 1.5, ornament: 1.2,
      sequence: 0.8, fragmentHead: 0.6, retrograde: 0.6, diminish: 0.4,
    },
    rebec: {
      ornament: 3, sequence: 2.5, transpose: 2, invert: 1.5, diminish: 1.2,
      retrograde: 1.2, fragmentHead: 1, fragmentTail: 1, augment: 0.8,
    },
    waterphone: {
      augment: 3.5, transpose: 2.5, invert: 2, fragmentTail: 1.5,
      retrograde: 1.2, fragmentHead: 0.8, sequence: 0.6, diminish: 0.5,
      ornament: 0.3,
    },
    boneflute: {
      fragmentTail: 2.5, fragmentHead: 2, ornament: 1.5, transpose: 1.5,
      augment: 1.2, diminish: 1.2, invert: 1, retrograde: 0.8, sequence: 0.6,
    },
  };

  // SCENE ALIASING (configuration, zero motif edits): every Sycorax scene
  // maps onto one of the Library's five before any motif lookup, so the
  // motif engine's kind pools / scene tilts / ghost window / focus scenes
  // all apply unmodified. This is also why the "chapter-normalization
  // gotcha" never bites here — no custom scene name is ever handed down.
  var SCENE_ALIAS = {
    "gathering": "settling",
    "processional": "chapter",
    "circling": "chapter",
    "invocation": "seizure",
    "afterimage": "candle-out",
  };

  // Chant vowel shapes — the dark end of the mouth (the whisper DNA pitched).
  // F1/F2 pairs; the walk drifts between neighbors on the closedâopen axis.
  var CHANT_VOWELS = {
    mm: { f1: 270, f2: 1200 },
    oo: { f1: 300, f2: 870 },
    oh: { f1: 570, f2: 840 },
    uh: { f1: 520, f2: 1190 },
    ah: { f1: 730, f2: 1090 },
  };
  var CHANT_VOWEL_POOL = ["mm", "oo", "oh", "uh", "ah"];
  var CHANT_VOWEL_WALK = [
    [0.05, 0.45, 0.25, 0.15, 0.10],
    [0.30, 0.05, 0.35, 0.20, 0.10],
    [0.10, 0.30, 0.05, 0.35, 0.20],
    [0.12, 0.20, 0.38, 0.05, 0.25],
    [0.08, 0.12, 0.30, 0.45, 0.05],
  ];

  // v1's whisper formant pairs (prosperos-jukebox-audio.js:132) — the
  // breath-bed keeps the ancestor's exact spectra, only quieter.
  var WHISPER_FORMANTS = [
    [700, 2500], [400, 2000], [900, 2800], [500, 3200],
    [600, 1800], [1000, 3500], [350, 2200],
  ];

  // v1's waterphone tunables (prosperos-jukebox-audio.js:1795), verbatim.
  var WATERPHONE = {
    shimmer: 1.30, bloomLevel: 0.28, bloomIntensity: 2.4,
    wail: 1.8, wobble: 2.0, bodyWobbleRate: 0.6,
  };
  // The six inharmonic partials (v1 ~3322): lower three ride the shared
  // body wobble; upper three tremolo.
  var WATERPHONE_PARTIALS = [
    { ratio: 1.00, gain: 0.42, trem: 0,    body: true  },
    { ratio: 1.41, gain: 0.30, trem: 0,    body: true  },
    { ratio: 2.07, gain: 0.22, trem: 0,    body: true  },
    { ratio: 2.95, gain: 0.20, trem: 0.55, body: false },
    { ratio: 4.13, gain: 0.16, trem: 0.65, body: false },
    { ratio: 5.62, gain: 0.12, trem: 0.75, body: false },
  ];

  // Weather channels for this track (PLAN Â§6): murk is inverse brightness
  // (cutoffs, gurdy darkness), breath opens the chant and the breath-bed,
  // gapMul is the sanctioned Â±15% gap scaler, wetTilt tilts the rooms and
  // gates the wet pool draws, gritTilt rides the grit blend. Periods are
  // primes in the 120â600 s band (pairwise coprime), depths sized per
  // channel; four seeded draws per channel at build, pure math after.
  var WEATHER_SYCORAX = {
    murk:     { period1: 337, period2: 499, depth: 0.45 },
    breath:   { period1: 199, period2: 401, depth: 0.40 },
    gapMul:   { period1: 167, period2: 431, depth: 0.35 },
    wetTilt:  { period1: 263, period2: 541, depth: 0.45 },
    gritTilt: { period1: 151, period2: 563, depth: 0.50 },
  };
  var WX_NEUTRAL = { murk: 0.5, breath: 0.5, gapMul: 0.5, wetTilt: 0.5, gritTilt: 0.5 };

  // --------------------------------------------------------------------------
  // THE GRIT CURVE — ZANKYÅ's asymmetric soft-clip (zankyo-audio.js:327) at
  // 0.75Ã its amount (0.6 â 0.45, k = 2 + 0.45Â·40 = 20): v1's sycorax
  // already saturated its drone hotter than the Library's (26 vs 12), so
  // the dose is inherited instinct, dialed to this room. Two documented
  // lessons ride with it (zankyo-audio.js:262-288):
  //   1. MAKEUP-DOWN 0.4 — this curve boosts small signals ~21Ã and rails
  //      the bus under any real drone level, clipping every onset into an
  //      audible click; the distortion timbre is baked into the waveshape
  //      and survives the attenuation, so pull the bus back down.
  //   2. TRANSIENT VOICES NEVER TOUCH THE BUS (the shamEdge lesson) — a
  //      voice needing bite gets its own near-unity tanh. Here nothing
  //      transient needs one; the bus is LANDSCAPE-ONLY by wiring (gurdy
  //      send, noise-bed send, trompette pulses — three tagged feeders,
  //      asserted by graph inspection).
  // --------------------------------------------------------------------------
  function buildGritCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = 2 + amount * 40;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var y = (1 + k) * x / (1 + k * Math.abs(x));  // soft-clip
      y += 0.04 * Math.sin(x * 9);                  // subtle harmonic crud
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }
  var GRIT_AMOUNT = 0.45;   // 0.75 Ã ZANKYÅ's 0.6
  var GRIT_MAKEUP = 0.4;    // the documented makeup-DOWN
  var GRIT_BLEND_CAP = 0.5; // hard cap at invocation peak
  var TROMP_BASE = 0.10;    // trompette send at rest
  var TROMP_PULSE_MAX = 0.1;// pulses add at most this (60 ms+ ramps)

  // A PLAIN tanh curve, cached by drive — lab-sycorax.html's shaperNode,
  // ported for the chant's throat (rc.44). Deliberately NOT normalised: the
  // kargyraa's clip is a saturator, and dividing by tanh(drive) would give
  // back the 3.2x small-signal gain that IS the growl.
  var SHAPE_CURVES = {};
  function shapeCurve(drive) {
    var key = "d" + Math.round(drive * 10);
    if (!SHAPE_CURVES[key]) {
      var n = 1024, curve = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * drive);
      }
      SHAPE_CURVES[key] = curve;
    }
    return SHAPE_CURVES[key];
  }

  // A normalized tanh soft-ceiling (the pj2-voice saturator's shape) —
  // used as INSURANCE after the cavern's-throat bank: |output| â¤ 1 by
  // construction whatever a feedback loop does upstream, and at whisper
  // level (the bank's honest range, â¤ ~0.02) the curve is identity to
  // within 0.1% — tone-free until the day it saves the room.
  function buildSoftCeil(amount) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // ==========================================================================
  // create({ seed, volume }) â Sycorax
  // ==========================================================================
  function create(opts) {
    opts = opts || {};

    var seed = resolveSeed(opts);
    var masterVol = (opts.volume != null) ? opts.volume : 0.5;
    // rc.37 — the dev door the identity check drives: with absences off no
    // draw is made and no cast is narrated, so the engine at presence 1 is
    // the rc.36 build, note for note and event for event. The shipped
    // default draws.
    // rc.44 — ONE dev door for the WHOLE evening cast now: `cast: false`
    // turns off the absence draw AND the seven manner coins, which is what
    // makes "every share at 0 + the cast shut" the rc.43 engine byte for
    // byte, event stream included. `absences: false` is kept as its alias
    // (it is what the rc.37 rows and the thin round's dumps ask for, and it
    // meant exactly this when the cast held nothing but absences). Both
    // default OPEN — the shipped engine dresses itself.
    var castOn = (opts.cast !== false && opts.absences !== false);
    var absencesOn = castOn;
    var noteLs = [];
    var eventLs = [];
    var analysers = [];

    var ctx = null;      // ONE lazy AudioContext, reused (and suspended) forever
    var run = null;      // the per-play world
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
    // Live-state readers, guarded (family pattern): voices poll these every
    // cycle and must keep breathing even mid-handoff.
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
      return "gathering";
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
    function curTideLabel() {
      if (run && run.conductor) {
        try {
          var td = run.conductor.tide();
          if (td && td.label) return td.label;
        } catch (e) {}
      }
      return "far-off";
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

    // rc.44 — "A MOVED KNOB WINS OVER THE CAST UNTIL IT IS RESET" (the
    // Library's decision 5, inherited whole through Ariel's rc.42). A knob
    // still sitting on its authored default is the evening cast's to set;
    // the moment the owner moves it the desk is the authority until it is
    // put back. Drawless, read at schedule time.
    function pDefOf(layer, key) {
      var defs = LAYER_PARAMS[layer];
      if (!defs) return null;
      for (var i = 0; i < defs.length; i++) if (defs[i].key === key) return defs[i].def;
      return null;
    }
    function knobOrCast(layer, key, castVal) {
      var d = pDefOf(layer, key);
      var v = pVal(layer, key);
      if (d == null) return v;
      return (v !== d) ? v : castVal;
    }
    // THE MANNERS (rc.44). One reader for all seven: the effective SHARE is
    // the cast's (1 when tonight's manner is the stop, 0 otherwise) unless
    // the desk knob has been moved off its default, in which case the desk
    // wins. Read at schedule time; the coin itself is drawn on the stop's
    // own fork, so at share 0 with the cast shut the whole engine is rc.43
    // to the bit.
    // rc.44 - ONE PLACE SAYS WHAT A SOUNDING ACTUALLY SOUNDED. A body that
    // may be played two ways records which way it went the instant it
    // renders, and the caller that emits the note reads it back. The
    // alternative - drawing the coin in the caller and passing it down -
    // puts one decision in five callers and lets them disagree.
    var lastManner = {};
    function tookManner(layer, m) { lastManner[layer] = m; return m; }
    function mannerOf(layer, dflt) { return lastManner[layer] || dflt || null; }

    function plainCast() {
      var c = { evening: 0, plain: true, dress: [], absent: [], absentLabels: [] };
      for (var i = 0; i < CAST_STOPS.length; i++) c[CAST_STOPS[i].layer] = CAST_STOPS[i].plain;
      return c;
    }
    function castIs(layer, manner) {
      return !!(run && run.cast && run.cast[layer] === manner);
    }
    function shareOf(layer, key, manner) {
      return clamp(knobOrCast(layer, key, castIs(layer, manner) ? 1 : 0), 0, 1);
    }

    // ---- PRESENCE (rc.37) — how often a voice enters -----------------------
    // The owner, 2026-09-03: "it's a little too cluttered now that we added
    // all the new instruments. Reduce the frequency of most instruments —
    // pretty much anything that's not a drone or drone-adjacent."
    //
    // ONE rule, uniform across the three books: a non-seam layer's `presence`
    // knob MULTIPLIES every entry chance the voice rolls, and DIVIDES every
    // rest and margin it leaves behind (capped at twice as long, so a knob at
    // zero silences rather than stalls). Both readers return exactly 1 at
    // presence 1, and multiplying a float by 1 is exact — which is what makes
    // "the old knob replays the old build byte for byte" a fact and not a
    // hope. NOTHING here is a law: presence moves rates only. The seam (the
    // gurdy), the beds (murk, breath), the ambient sky and the proto-drum
    // heartbeat carry no presence knob at all, and the two SIGNATURES — the
    // cut's waterphone apparition and the afterimage's far final call —
    // ignore it (they are the song, not the clutter).
    function presK(layer) {
      var p = pVal(layer, "presence");
      return p > 0 ? p : 0;
    }
    function restK(layer) {
      var p = pVal(layer, "presence");
      if (!(p > 0)) return 2;
      var k = 1 / p;
      return k > 2 ? 2 : (k < 0.34 ? 0.34 : k);
    }

    // ---- ABSENCES (rc.37) — some evenings a voice sits it out --------------
    // Drawn once per evening by PJ2.Voice.absences on its own fork (see the
    // helper's header for the law: evening one full, 0–3 voices, never the
    // same voice twice running, never more than a third of the eligible).
    // An absent voice makes NO NEW ENTRIES that evening — the gate sits
    // beside the roster's, always AFTER the opportunity's own roll, so an
    // absence changes what is heard and never what is drawn. Sounding notes
    // finish naturally, and the cut's apparition is the CUT's gesture: the
    // waterphone can sit the evening out and the hush is still inhabited.
    function isAbsent(key) {
      return !!(run && run.absentMap && run.absentMap[key]);
    }

    // ----------------------------------------------------------------------
    // THE WANDER (rc.35) — PJ2.Voice.wander, one per layer, built at play
    // into run.wander and re-dressed at every performance begin. The desk
    // knob stays the CENTRE; the span in LAYER_PARAMS is the reach; the
    // layer's `vary` knob scales it. Every draw lands on the helper's own
    // forks ("wander:<layer>:…"), so no pre-existing stream is re-rolled.
    //
    // wTouch/wChar/wWx are the ONLY doors the bodies use (the class is
    // named at the read, so a body says out loud whether it is drawing per
    // sounding, per evening or per weather), and each falls back to the bare
    // knob if a wander is missing — a wiring gap must never silence or
    // detune a note. WEATHER READS ARE RUN-RELATIVE: the
    // pj2-library determinism lesson — absolute audio time differs between
    // runs of the same seed, run-relative time does not.
    var wanderTap = null;   // dev/harness door, see setWanderListener
    function wOf(layer) { return (run && run.wander && run.wander[layer]) || null; }
    function wRep(layer, key, v) {
      if (wanderTap) { try { wanderTap(layer, key, v); } catch (e) {} }
      return v;
    }
    function wTouch(layer, key) {
      var w = wOf(layer);
      return wRep(layer, key, w ? w.touch(key) : pVal(layer, key));
    }
    function wChar(layer, key) {
      var w = wOf(layer);
      return wRep(layer, key, w ? w.character(key) : pVal(layer, key));
    }
    function wWx(layer, key, t) {
      var w = wOf(layer);
      return wRep(layer, key, w ? w.weather(key, t - run.t0) : pVal(layer, key));
    }
    function wBody(layer) {
      return (run && run.wbody && run.wbody[layer]) || null;
    }
    // Every BODY RULE this round adds (the plan's §11.2 shapes: the slat
    // gathering over its rise, the overtone's longer steps on the higher
    // harmonics, the jaw harp's downward sweeps, the pot's build-then-settle
    // contour, the bullroarer's darker invocation, the blade's pressure
    // moving inside its swell) is scaled by the layer's own `vary`, so
    // vary 0 is TODAY'S BUILD in sound as well as in stream, and vary 1 is
    // the shape the plan asks for.
    function varyK(layer) {
      var v = pVal(layer, "vary");
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    }
    // The evening's character draws. Sycorax has no cast to draw with, so
    // this IS the dressing: called at play (evening one) and at every
    // performance begin with the conductor's own ordinal, which makes the
    // draws reproducible per evening and per seed, in any order.
    function dressWander(n) {
      if (!run || !run.wander) return;
      for (var lk in run.wander) {
        try { run.wander[lk].dress(n); } catch (e) {}
      }
    }
    // ---- THE EVENING'S CAST (rc.37; rc.44 gave it its dress) --------------
    // Called at every performance begin with the conductor's own ordinal —
    // the same place, and the same number, the wander dresses itself with.
    // The absence draw lands on PJ2.Voice.absences' own fork ("absences:<n>"
    // off the birth seed) and the manner coins on the cast's own, so not one
    // pre-existing stream is re-rolled and the same seed tells the same
    // evenings. The only memory is last evening's absent set, carried across
    // the seam and reset by a reseed (a reseed is a new run).
    //
    // rc.44 — TONIGHT'S MANNERS. Seven coins in the fixed order of
    // CAST_STOPS, each 0.6 plain / 0.4 the stop. A stop drawn sets that
    // layer's effective share to 1 for the whole evening ("tonight the gurdy
    // is a glass armonica"); the desk still wins, by knobOrCast, the moment
    // the owner moves the share. EVENING ONE IS ALWAYS PLAIN: a short listen
    // must hear the instruments the rite is made of before it hears their
    // doubles.
    function drawCast(evt) {
      var n = (evt && evt.n != null) ? evt.n : 1;
      var si;
      // DRAWS FIRST, unconditionally and in order, then the gates. The dev
      // door turns the WHOLE gesture off — no coin, no absence draw, no cast
      // line — which is what makes "every share 0 + the cast shut" the rc.43
      // engine byte for byte.
      var worn = {};
      for (si = 0; si < CAST_STOPS.length; si++) worn[CAST_STOPS[si].layer] = false;
      if (castOn) {
        var crng = run.streams.cast;
        for (si = 0; si < CAST_STOPS.length; si++) {
          worn[CAST_STOPS[si].layer] = crng.chance(CAST_STOP_P);
        }
        if (n <= 1) {
          for (si = 0; si < CAST_STOPS.length; si++) worn[CAST_STOPS[si].layer] = false;
        }
      }
      var absent = [];
      if (absencesOn && PJ2.Voice && typeof PJ2.Voice.absences === "function") {
        try {
          var a = PJ2.Voice.absences({
            root: run.master, evening: n,
            eligible: ABSENCE_ELIGIBLE, previous: run.lastAbsent || [],
          });
          absent = (a && a.absent) ? a.absent : [];
        } catch (e) { absent = []; }
      }
      run.absent = absent;
      run.lastAbsent = absent;
      run.absentMap = {};
      var labels = [], i;
      for (i = 0; i < absent.length; i++) {
        run.absentMap[absent[i]] = 1;
        labels.push(MIX_LABELS[absent[i]] || absent[i]);
      }
      run.castEvening = n;
      run.castPlain = (n <= 1);
      // The dress, in plain words — an array, empty when nothing was drawn,
      // which is exactly what pj2-ui's generic cast case already prints.
      var dress = [], cast = { evening: n, plain: (n <= 1) };
      for (si = 0; si < CAST_STOPS.length; si++) {
        var S = CAST_STOPS[si];
        cast[S.layer] = worn[S.layer] ? S.manner : S.plain;
        if (worn[S.layer]) dress.push(S.dress);
      }
      cast.dress = dress;
      cast.absent = absent.slice();
      cast.absentLabels = labels.slice();
      run.cast = cast;
      if (!castOn) return;                     // no draw, no narration
      // Emitted by the conductor wrapper the instant AFTER the performance's
      // begin event (pj2-library's rc.31 pattern), so the log reads
      // "evening N" then "tonight: …" — always before the evening's first
      // note.
      var pending = {
        type: "cast", evening: n, plain: (n <= 1),
        dress: dress.slice(),
        absent: absent.slice(), absentLabels: labels,
        t: (evt && evt.t != null) ? evt.t : run.clock.now(),
      };
      for (si = 0; si < CAST_STOPS.length; si++) {
        pending[CAST_STOPS[si].layer] = cast[CAST_STOPS[si].layer];
      }
      run.castPending = pending;
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

    function degClass(d) {
      var n = (run && run.field && run.field.size) || 7;
      return ((d % n) + n) % n;
    }

    // Weather reads: exact audio time of the thing being scheduled, on
    // RUN-RELATIVE time (the pj2-library determinism lesson, kept verbatim).
    function wxAt(t) {
      if (run && run.weather) {
        try { return run.weather.at(t - run.t0); } catch (e) {}
      }
      return WX_NEUTRAL;
    }
    // gapMul: the ONE channel allowed to move event times — Â±15% hard by
    // construction, neutral weather = exactly 1.0.
    function gmAt(t) {
      return 0.85 + 0.3 * wxAt(t).gapMul;
    }

    // The hush window: [tB, tB + hold] whenever a cut is planned or live.
    // Melodic bodies and non-proto percussion skip any note whose ONSET
    // falls inside it — a chant line cut off mid-word, a cluster cut off
    // unfinished: the interruption IS the gesture. The one waterphone
    // apparition (scheduled by the cut itself) bypasses this gate.
    function inHush(t) {
      var c = run && run.cut;
      if (!c) return false;
      return t > c.tB + 0.001 && t < c.end - 0.001;
    }

    // ---- THE SCENE ROSTER (L3, rc.32) ---------------------------------------
    // Which column of SCENE_ROSTER the rite is standing in. Sycorax's scenes
    // ARE the columns (no chapter ordinals to count), so this is a pure read
    // of the conductor — no draws, ever. The gate is ALWAYS called AFTER the
    // opportunity's unconditional roll: the roster decides whether a voice
    // ENTERS, never how the dice fall.
    function rosterColumn() { return curSceneType(); }
    function rosterAllows(voiceKey, columnOverride) {
      var row = SCENE_ROSTER[voiceKey];
      if (!row) return true;
      var col = columnOverride || rosterColumn();
      for (var i = 0; i < ROSTER_COLS.length; i++) {
        if (ROSTER_COLS[i] === col) return !!row[i];
      }
      return true;
    }

    // ---- THE CUT LAW, extended to the five new voices (rc.32) ---------------
    // The horn holds its breath from 4 s before the cut and through the hush;
    // the five auditioned voices hold theirs from tB − 4 all the way through
    // the RETURN, and anything of theirs still sounding at tB is ended THERE
    // with an anchored 0.25 s fade. The engine plans its cut a whole scene
    // early (planCut at the invocation's scene event), so tB is known long
    // before it arrives — which is the only way "silent from 4 s BEFORE"
    // can be a law rather than a wish.
    //
    // Checked at the brain (each consider) AND at the body (each render): a
    // law checked twice is a law.
    var CUT_LEAD = 4;        // the horn's number
    var CUT_KILL_S = 0.25;   // the cut's own dip length
    function cutBlocks(t) {
      var c = run && run.cut;
      if (!c) return false;
      return t >= c.tB - CUT_LEAD && t <= c.end + c.retS;
    }
    // "the cut's return has fully passed" — the blade's afterimage condition
    function cutPast(t) {
      var c = run && run.cut;
      return !c || t > c.end + c.retS;
    }
    // Every note of the five hangs on ONE unity gate gain between its chain
    // and its layer, registered here. The cut ends a sounding gesture by
    // riding that gate to zero — never by cancelling the note's own envelope
    // (the bullroarer's spin LFO is CONNECTED to its amplitude gain, and an
    // a-rate connection sums with the intrinsic value: zeroing the intrinsic
    // there would leave the whir running).
    function nvRegister(key, gate, endT) {
      var list = run.nvActive, t = run.clock.now();
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].endT < t - 1) list.splice(i, 1);
      }
      list.push({ key: key, gate: gate, endT: endT });
    }
    function killNewVoicesAt(tB) {
      if (!run || !run.live) return;
      var list = run.nvActive, n = 0, who = {};
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.endT <= tB + 0.001) continue;      // its tail is already over
        var p = r.gate.gain;
        try {
          // Anchor at whatever the gate would have reached by tB, then ride
          // it down (lesson #3: a bare cancel clicks). cancelAndHoldAtTime
          // is the honest anchor for a FUTURE instant; where it is missing
          // the read-and-re-anchor pair is exact enough for a unity gate.
          if (typeof p.cancelAndHoldAtTime === "function") {
            p.cancelAndHoldAtTime(tB);
          } else {
            var v = (typeof p.value === "number") ? p.value : 1;
            p.cancelScheduledValues(tB);
            p.setValueAtTime(v, tB);
          }
          p.linearRampToValueAtTime(0, tB + CUT_KILL_S);
        } catch (e) {}
        n++;
        who[r.key] = (who[r.key] || 0) + 1;
        r.endT = tB + CUT_KILL_S;
      }
      emitEvent({ type: "cut-kill", t: tB, fadeS: CUT_KILL_S, n: n, voices: who });
    }

    // ---- slow noise (the family's smooth-wobble source) ----------------------
    // Linear-interpolated random keyframes: smooth wobble, not stepped noise.
    // One 20 s loop cached per (ctx, rate), handed out with random read
    // offsets so simultaneous notes wobble independently. Math.random
    // throughout: texture, not music (the zankyo rule). Ported verbatim from
    // pj2-library.js — the bowed blade is the first Sycorax voice to need it.
    function slowNoise(c, rateHz) {
      var cache = c.__pj2SlowNoise = c.__pj2SlowNoise || {};
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

    // Motif request context — sceneType ALIASED to the Library five (see
    // SCENE_ALIAS), nowS = the exact audio time of the phrase.
    function reqCtx(t) {
      return {
        sceneType: SCENE_ALIAS[curSceneType()] || "chapter",
        x: curSceneX(),
        tidePos: curTidePos(),
        nowS: t,
      };
    }

    // The motif engine emits nothing; the track narrates (family pattern).
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
        emitEvent({ type: "ghost", voice: voiceName, name: m.name, t: t });
      }
    }

    // Only the CANTOR posts (responsorial, not conversational): the chant
    // opens calls across the clearing; rebec and waterphone answer late and
    // near-verbatim via the motif engine's overdue-first claim path. The
    // posting numbers live in the motif policy (postP by aliased scene,
    // postKinds imitate-heavy, deadlines 18â40 s).
    function maybePost(voiceName, res, t) {
      if (voiceName !== "chant" || res.kind === "ghost") return;
      try {
        run.motif.maybePost(voiceName, res.motif, {
          sceneType: SCENE_ALIAS[curSceneType()] || "chapter", nowS: t,
        });
      } catch (e) {}
    }

    // beats â seconds (the pj2-library mapper, kept): each voice maps a
    // motif's abstract beats through its own pace Ã intensity.
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

    // One vowel walk state serves the chant, its organum double, and the
    // keen — it is one throat. Draws ride the "vowels" fork only.
    function walkVowel() {
      var row = CHANT_VOWEL_WALK[run.vowelIdx] || CHANT_VOWEL_WALK[0];
      var r = run.streams.vowels.next();
      var acc = 0, idx = row.length - 1;
      for (var i = 0; i < row.length; i++) {
        acc += row[i];
        if (r < acc) { idx = i; break; }
      }
      run.vowelIdx = idx;
      return CHANT_VOWELS[CHANT_VOWEL_POOL[idx]];
    }

    // Pose bookkeeping: setPose/step only narrate when the pose actually
    // changed (the no-consecutive-repeats law is held here — a forced
    // "sting" arriving onto "sting" is a held posture, not a repeat).
    function setPoseIfNew(name, t, via) {
      try {
        var cur = run.harmony.current();
        if (cur && cur.name === name) return;
        run.harmony.setPose(name, t);
        emitEvent({ type: "pose", pose: name, rootDeg: 0, via: via || "set", t: t });
      } catch (e) {}
    }

    // ========================================================================
    // THE DRAMATURGY — the encirclement (Conductor contract).
    //
    // plan(): durS = 360 + 600Â·(0.65Â·u + 0.35Â·tide) — 6â16 min (dread
    // sustains less than coziness), the tide biasing long and near.
    // gathering â processional (p = 0.45 + 0.3Â·tide) â circling Ã1â3 â
    // invocation (p = 0.5 + 0.3Â·tide) â afterimage. The circling count is
    // keyed to the drawn budget (1 / 1â2 / 2â3 as durS crosses 560/760 s)
    // so the scale factor stays gentle and no scene is ever crushed short
    // enough to break the intensity ruler (the pj2-library nCh lesson).
    // ========================================================================
    var ACTIVITY = {
      "gathering":    [["watching", 3], ["kindling", 2], ["waiting", 2]],
      "processional": [["approaching", 3], ["torch-bearing", 2]],
      "circling":     [["prowling", 3], ["rounding", 2], ["weaving", 2]],
      "invocation":   [["calling", 3], ["hollowing", 2]],
      "afterimage":   [["dispersing", 3], ["smoldering", 2]],
    };
    function pickActivity(rng, type) {
      var pool = ACTIVITY[type];
      return pool ? rng.pickW(pool) : type;
    }

    var dram = {
      name: "sycorax",
      durationRangeS: [360, 960],

      plan: function (rng, tidePos) {
        var tp = clamp(tidePos || 0, 0, 1);
        var durS = 360 + 600 * (0.65 * rng.next() + 0.35 * tp);
        var hasProc = rng.chance(0.45 + 0.3 * tp);
        var nCirc = (durS < 560) ? 1 : (durS < 760 ? rng.rint(1, 2) : rng.rint(2, 3));
        var hasInv = rng.chance(0.5 + 0.3 * tp);
        var scenes = [];
        function add(type, lo, hi) {
          scenes.push({ type: type, durS: rng.rnd(lo, hi), activity: pickActivity(rng, type) });
        }
        add("gathering", 60, 120);
        if (hasProc) add("processional", 80, 150);
        for (var i = 0; i < nCirc; i++) add("circling", 100, 220);
        if (hasInv) add("invocation", 60, 120);
        add("afterimage", 90, 170);
        var raw = 0;
        for (i = 0; i < scenes.length; i++) raw += scenes[i].durS;
        var k = durS / raw;
        for (i = 0; i < scenes.length; i++) scenes[i].durS *= k;
        return scenes;
      },

      // Intensity curves — PLAN-SYCORAX Â§2 verbatim. Invocation
      // CONCENTRATES BY HOLLOWING: peak 0.62 is density and register, not
      // loudness. The afterimage opens ~0.18 and sinks — the rite dispersed.
      scenes: {
        "gathering": {
          intensity: function (x, tp) {
            return clampI(0.04 + (0.18 + 0.05 * (tp || 0)) * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.03,
          activityWeights: ACTIVITY["gathering"],
        },
        "processional": {
          intensity: function (x, tp) {
            return clampI(0.16 + (0.16 + 0.03 * (tp || 0)) * smoothstep(x));
          },
          airLimit: 1, overlapChance: 0.08,
          activityWeights: ACTIVITY["processional"],
        },
        "circling": {
          // Slower wobble than the Library chapter's (0.75 cycles): the prowl.
          intensity: function (x, tp) {
            return clampI(0.28 + 0.10 * (tp || 0) + 0.05 * Math.sin(2 * Math.PI * 0.75 * clamp(x, 0, 1)));
          },
          airLimit: 2, overlapChance: 0.15,
          activityWeights: ACTIVITY["circling"],
        },
        "invocation": {
          intensity: function (x, tp) {
            return clampI(0.36 + 0.26 * Math.pow(Math.sin(Math.PI * clamp(x, 0, 1)), 1.3));
          },
          airLimit: 1, overlapChance: 0.10,
          activityWeights: ACTIVITY["invocation"],
        },
        "afterimage": {
          intensity: function (x, tp) {
            return clampI(0.05 + 0.13 * Math.pow(1 - clamp(x, 0, 1), 1.6));
          },
          airLimit: 1, overlapChance: 0.02,
          activityWeights: ACTIVITY["afterimage"],
        },
      },

      // ----------------------------------------------------------------
      // JOINTS — pickW nothing 36 / drone-breath 30 / deadened drum stroke
      // 16 / water-drip 10 / far-thunder 8. Far-thunder is reserved for
      // entering the invocation (anywhere else it degrades to a breath);
      // the invocationâafterimage boundary ALWAYS resolves to nothing —
      // the cut is that joint, and it needs no ornament. All draws happen
      // unconditionally (stream discipline), then the overrides apply.
      // ----------------------------------------------------------------
      joint: function (fromType, toType, t, intensity, tools) {
        if (!run || !run.live) return null;
        var draw = run.streams.joints.pickW([
          ["nothing", 36], ["breath", 30], ["drum", 16], ["drip", 10], ["far-thunder", 8],
        ]);
        if (fromType === "invocation" && toType === "afterimage") draw = "nothing";
        if (draw === "far-thunder" && toType !== "invocation") draw = "breath";
        emitEvent({ type: "joint-gesture", gesture: draw, from: fromType, to: toType, t: t });
        if (draw === "nothing") return null;
        try {
          if (draw === "breath") jointBreath(t);
          else if (draw === "drum") frameDrum(t, run.streams.joints, { deadened: true, peak: 0.028, mode: "joint", who: "joint" });
          else if (draw === "drip") waterDrip(t);
          else if (draw === "far-thunder") farThunder(t, run.streams.joints, 0.5, "joint");
        } catch (e) { return null; /* a failed joint is silence — a valid joint */ }
        return draw;
      },

      chainOverlapS: [5, 15],
      tide: {
        // "How near the menace circles." Labels partition the PHASE:
        // trough-rising / approaching-peak / just-past-peak / descent.
        periodPerfs: [4, 7],
        labels: ["far-off", "drawing-near", "at-the-treeline", "receding"],
      },
    };

    // ========================================================================
    // JOINT GESTURE BODIES — the whole vocabulary is QUIET (â¤ ambient peaks).
    // ========================================================================

    // (a) drone-breath: the gurdy bed dips ~2 dB over 4 s and re-blooms, on
    // its DEDICATED gain stage (gurdyBreath, normally 1) — one writer per
    // param, always.
    function jointBreath(t) {
      var g = run.gurdyBreath.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(0.79, t + 2);
      g.linearRampToValueAtTime(1, t + 4);
    }

    // (b) water-drip: one drop in the cavern — a tiny sine blip falling an
    // octave-ish, unpitched texture (freq null; it is water, not music).
    function waterDrip(t) {
      var tok = run.budget.claim(2, t + 0.4);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1250, t);
      o.frequency.exponentialRampToValueAtTime(430, t + 0.09);
      var g = c.createGain();
      o.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.004, 0.018], [0.08, 0.0012], [0.05, 0]]);
      o.start(t);
      o.stop(t + 0.25);
      emitNote({ voice: "joint", kind: "drip", freq: null, t: t, durS: 0.15 });
    }

    // (c) far thunder — v1's sycDistantThunder (~3863) at a dose scale
    // (0.5 for the joint, 1.0 when the ambient pool draws it). Sub thump +
    // resonant low boom (pre-attenuated 0.4 BEFORE the Q 5 filter —
    // pj2-voice lesson #2) + a rolling rumble cresting mid-way.
    function farThunder(t, rng, dose, who, cave) {
      var durS = rng.rnd(4.5, 6);
      var peakFreq = rng.rnd(280, 360);
      var boomDur = rng.rnd(0.7, 1.1);
      var tok = run.budget.claim(9, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (cave) {
        // the same thunder, underground. The JOINTS' far thunder never comes
        // here: a joint is the rite's own seam-sound, not a sky one-shot.
        caveShot("thunder", t, { durS: durS, dose: dose });
        emitNote({ voice: who || "ambient", kind: "thunder", freq: null, t: t,
                   durS: durS, manner: "cave" });
        return;
      }
      var P = 0.045 * dose;
      var subO = c.createOscillator();
      subO.type = "sine";
      subO.frequency.setValueAtTime(55, t);
      subO.frequency.exponentialRampToValueAtTime(35, t + boomDur);
      var subG = c.createGain();
      subO.connect(subG); subG.connect(run.layAmb);
      PJ2.Voice.env(subG.gain, t, [[0.03, P], [boomDur - 0.13, 0.0012], [0.1, 0]]);
      subO.start(t);
      subO.stop(t + boomDur + 0.15);
      var bn = PJ2.Voice.noiseBuffer.source(c, 30);
      var bPre = c.createGain();
      bPre.gain.setValueAtTime(0.4, t); // quiet INTO the resonance
      var blp = c.createBiquadFilter();
      blp.type = "lowpass";
      blp.frequency.setValueAtTime(180, t);
      blp.frequency.exponentialRampToValueAtTime(50, t + boomDur);
      blp.Q.setValueAtTime(5, t);
      var bg = c.createGain();
      bn.connect(bPre); bPre.connect(blp); blp.connect(bg); bg.connect(run.layAmb);
      PJ2.Voice.env(bg.gain, t, [[0.04, P], [boomDur - 0.14, 0.0012], [0.1, 0]]);
      bn.start(t, bn.randomOffset);
      bn.stop(t + boomDur + 0.15);
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(60, t);
      f.frequency.linearRampToValueAtTime(peakFreq, t + durS * 0.35);
      f.frequency.linearRampToValueAtTime(40, t + durS);
      f.Q.setValueAtTime(1, t);
      var g = c.createGain();
      n.connect(f); f.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.3, 0.02 * dose], [durS * 0.5 - 0.3, 0.018 * dose], [durS * 0.5, 0]]);
      n.start(t, n.randomOffset);
      n.stop(t + durS + 0.1);
      emitNote({ voice: who || "ambient", kind: "thunder", freq: null, t: t, durS: durS,
                 manner: (who === "ambient") ? "fen" : undefined });
    }

    // ========================================================================
    // THE GRIT PULSE — the trompette's buzzing bridge. Drum strokes pulse
    // the trompette's grit send by â¤ +0.1 with 60 ms+ ramps (never a step:
    // a stepped send through a waveshaper is a click with a beard). One
    // writer on the param, pulses spaced â¥ 0.5 s (an overlapping pulse is
    // skipped — the bridge can only buzz so fast), always returning to
    // TROMP_BASE.
    // ========================================================================
    function pulseTrompette(t) {
      if (!run || !run.gritSendTromp) return;
      if (t - run.lastTrompPulseT < 0.5) return; // no mid-ramp re-anchoring
      run.lastTrompPulseT = t;
      var iv = curIntensity(t);
      var up = Math.min(TROMP_PULSE_MAX, 0.04 + 0.06 * iv);
      var g = run.gritSendTromp.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(TROMP_BASE, t);
      g.linearRampToValueAtTime(TROMP_BASE + up, t + 0.07);  // â¥ 60 ms up
      g.linearRampToValueAtTime(TROMP_BASE, t + 0.32);       // slow relax
    }

    // ========================================================================
    // MELODIC BODIES
    // ========================================================================

    // A TREMBLE, IN SERIES (rc.44 — lab-sycorax.html's sTrem, ported). A gain
    // of 1 with an LFO summed into its param, placed AFTER the envelope in
    // the chain. A source connected to an AudioParam SUMS with that param's
    // intrinsic value, so an LFO hung on a note's ENVELOPE gain is audible
    // before the note opens and after it closes: a thread of un-enveloped
    // signal under the whole sounding, and one the cut cannot duck. In
    // series it can do neither.
    function seriesTrem(rate, depth, t, stopAt, slow) {
      var c = ctx;
      var g = c.createGain();
      g.gain.setValueAtTime(1, t);
      var dg = c.createGain();
      dg.gain.setValueAtTime(depth, t);
      if (slow) {
        // a random walk rather than a sine: a player's breath does not beat
        var src = slowNoise(c, rate);
        src.connect(dg);
        src.start(t, src.randomOffset); src.stop(stopAt);
      } else {
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(rate, t);
        o.connect(dg);
        o.start(t); o.stop(stopAt);
      }
      try { dg.connect(g.gain); } catch (e) {}
      return g;
    }
    // An ENVELOPE GAIN, shut at birth (rc.44). A GainNode is born at 1 and
    // PJ2.Voice.env anchors it with setValueAtTime(0, t0) — but an
    // AudioParam's value is computed once per RENDER QUANTUM from the
    // timeline as it stood at the quantum's start, while a source's start(t)
    // is sample-accurate. So when t0 falls inside a quantum rather than on
    // its boundary, the source is already running while the param still
    // holds the value it had before the anchor — 1 — and up to 128 samples
    // (2.9 ms) of the body go through AT FULL SCALE. On a noise band that is
    // a click about 30 dB over the note, and because it depends on where t0
    // lands inside a quantum it fires on some soundings and not others. One
    // scheduled event at creation closes it. (The lab's fix round found this
    // under every enveloped body on its page; the audit note in the header
    // says where the same shape still lives in this engine.)
    function envGain() {
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      return g;
    }

    // ---- the chant (whisper DNA matured: pitched, principal) ---------------
    // Soft saw + detuned pulse-ish square pair â dual F1/F2 vowel bandpasses
    // (set once per note — the bardo formant lesson) with a breath-noise
    // thread mixed in pre-formant, seconds-long attacks, slight sine
    // vibrato blooming late. Peak ~0.032 pre-formant-loss compensation
    // (formants eat energy; the v1 hum precedent). Returns the env gain so
    // callers can add the seasick-delay send. ~11 nodes.
    //
    // rc.44 - THE CANTOR IS THROAT-SUNG NOW. The owner, 2026-09-04: "replace
    // the chant we currently have - the default engine one - with the
    // throat, so that only the throat occurs." So this is a body SWAP, not a
    // manner: no share knob, no cast draw, no way back from the desk - the
    // rc.31 music-box precedent, where the stop the owner chose to live in
    // became the instrument. The stream does not move a millisecond: the
    // same notes at the same times, sung from a foot lower in the body.
    //
    // KARGYRAA (lab-sycorax.html's chant variant A): a square an OCTAVE
    // BELOW the note - the ventricular folds beating at half the pitch -
    // added under the saw, both driven into a soft clip, and a 420 Hz chest
    // resonance mixed in beside the vowel. `growl` is the sub's weight.
    //
    // WHAT STAYS, exactly as it was: the cantor's own mouth (F1/F2 set once
    // per note, Q divided by `openness` x `openDrift`), the vibrato blooming
    // over the first third, the unvoiced breath thread pre-formant (it goes
    // straight to the mouth, not through the clip: air is not made by the
    // folds), the seconds-long edges, the delay send, the roster, presence,
    // the absences and the cut.
    // WHAT GOES: the engine's own square AT the note (detune +5, x0.35). The
    // throat already carries a square, an octave down; two of them in one
    // clip is mud, and the lab's body - which is what the level match was
    // measured on - has one.
    // WHO IS NOT THROAT-SUNG: the ambient pool's KEEN, which borrows this
    // body with layerKey "ambient". It is the sky's voice, not the cantor's,
    // it is mixed on the ambient row, and its knobs come off a strip that
    // has no `growl` at all. The arrival's ORGANUM PAD is the cantor's
    // throat by the engine's own account (it reads the chant's knobs), so it
    // IS throat-sung, and it is rendered into the ambient layer as before.
    function renderChantNote(dest, freq, t, durS, peak, vowel, wx, extraSend, layerKey) {
      var c = ctx;
      // The desk knobs bind to the layer that owns the sound: the ambient
      // pool's keen borrows this body but passes its own layer, so the
      // chant's knobs never leak across the desk's rows.
      var pLayer = layerKey || "chant";
      // rc.35: the mouth is the EVENING's (character) breathing slowly over
      // minutes (weather) — the plan's two classes on one knob. The pool's
      // keen borrows this body with layerKey "ambient", whose strip carries
      // neither def, so both doors hand back its bare knob: 1, as before.
      var open = (0.75 + 0.5 * wx.breath) *
                 wChar(pLayer, "openness") * wWx(pLayer, "openDrift", t);
      var throat = (pLayer === "chant");    // rc.44: the cantor, not the sky's keen
      var stopAt = t + durS + 0.05;
      var o1 = c.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(freq, t);
      o1.detune.setValueAtTime(-4, t);
      // the throat's own pair: the saw held back, and the fold an octave
      // under it. The keen keeps the old square AT the note.
      var o1g = null, sub = null, subg = null, o2 = null, o2g = null;
      if (throat) {
        o1g = c.createGain();
        o1g.gain.setValueAtTime(0.55, t);
        sub = c.createOscillator();
        sub.type = "square";
        sub.frequency.setValueAtTime(freq * 0.5, t);
        subg = c.createGain();
        subg.gain.setValueAtTime(clamp(wChar("chant", "growl"), 0, 1.5), t);
      } else {
        o2 = c.createOscillator();
        o2.type = "square";
        o2.frequency.setValueAtTime(freq, t);
        o2.detune.setValueAtTime(5, t);
        o2g = c.createGain();
        o2g.gain.setValueAtTime(0.35, t);    // the square is color, not body
      }
      // breath thread — unvoiced air under the tone, pre-formant
      var br = PJ2.Voice.noiseBuffer.source(c, 30);
      var brg = c.createGain();
      // rc.35: the breath thread's dose, drawn per note (promoted `breath`,
      // def 1 = the body's own 0.010 + 0.014·breath)
      brg.gain.setValueAtTime((0.010 + 0.014 * wx.breath) * wTouch(pLayer, "breath"), t);
      // vibrato — blooms in over the first third, never cold
      var vib = c.createOscillator();
      vib.type = "sine";
      vib.frequency.setValueAtTime(3.6 + 1.1 * wx.breath, t);
      var vg = c.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime((0.5 + 1.4 * wx.breath) * wTouch(pLayer, "vibrato"), t + Math.min(1.2, durS * 0.33));
      vib.connect(vg);
      try { vg.connect(o1.frequency); } catch (e0) {}
      if (throat) {
        // the fold is locked at half the pitch, so it takes half the
        // deviation: the same wobble in cents, one octave down
        var vgHalf = c.createGain();
        vgHalf.gain.setValueAtTime(0.5, t);
        vg.connect(vgHalf);
        try { vgHalf.connect(sub.frequency); } catch (e1) {}
      } else {
        try { vg.connect(o2.frequency); } catch (e1b) {}
      }
      // the mouth — F1/F2, Q divided by openness, set once per note
      var f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(vowel.f1, t);
      f1.Q.setValueAtTime(3.2 / open, t);
      var f2 = c.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(vowel.f2, t);
      f2.Q.setValueAtTime(3.8 / open, t);
      var f2g = c.createGain();
      f2g.gain.setValueAtTime(0.5, t);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      if (throat) {
        // THE FOLDS, THE CLIP, THE MOUTH, THE CHEST.
        var pre = c.createGain();
        pre.gain.setValueAtTime(0.5, t);
        o1.connect(o1g); o1g.connect(pre);
        sub.connect(subg); subg.connect(pre);
        var ws = c.createWaveShaper();
        try { ws.curve = shapeCurve(3.2); ws.oversample = "2x"; } catch (eWs) {}
        pre.connect(ws);
        ws.connect(f1); ws.connect(f2);
        var chest = c.createBiquadFilter();
        chest.type = "lowpass";
        chest.frequency.setValueAtTime(420, t);
        chest.Q.setValueAtTime(0.9, t);
        var chg = c.createGain();
        chg.gain.setValueAtTime(0.55, t);
        ws.connect(chest); chest.connect(chg); chg.connect(mix);
      } else {
        o1.connect(f1); o1.connect(f2);
        o2.connect(o2g); o2g.connect(f1); o2g.connect(f2);
      }
      br.connect(brg); brg.connect(f1); brg.connect(f2);
      f1.connect(mix); f2.connect(f2g); f2g.connect(mix);
      var env = envGain();
      mix.connect(env);
      // the growl is not steady: the folds beat unevenly. In SERIES after
      // the envelope, so there is nothing of it before the word starts and
      // nothing left of it when the cut arrives.
      var tail = env;
      if (throat) {
        var rough = seriesTrem(5.4 + 1.4 * wx.breath, 0.12, t, stopAt);
        env.connect(rough);
        tail = rough;
      }
      tail.connect(dest);
      if (extraSend) tail.connect(extraSend);
      // seconds-long edges: the chant never attacks, it surfaces.
      var atk = Math.min(1.6, durS * 0.38);
      var rel = Math.min(1.4, durS * 0.34);
      if (atk + rel > durS - 0.05) { atk = durS * 0.42; rel = durS * 0.42; }
      // THE LEVEL MATCH: a square an octave down through a clip is 6 dB of
      // energy the cantor's saw never had, so the throat schedules HALF the
      // old peak to sit at the old loudness (the lab's measured
      // MATCH.chantThroat).
      var pk = throat ? peak * MATCH_CHANT_THROAT : peak;
      PJ2.Voice.env(env.gain, t, [[atk, pk], [Math.max(0.02, durS - atk - rel), pk * 0.94], [rel, 0]]);
      o1.start(t); o1.stop(stopAt);
      if (throat) { sub.start(t); sub.stop(stopAt); }
      else { o2.start(t); o2.stop(stopAt); }
      br.start(t, br.randomOffset); br.stop(stopAt);
      vib.start(t); vib.stop(stopAt);
      return tail;
    }

    // ---- the rebec (bowed wyrd fiddle) --------------------------------------
    // Sawtooth through two fixed body-resonance bandpasses (set ONCE per
    // note — the bardo murmur-formant lesson: automate a formant mid-note
    // and it zippers), a bow-noise thread on the attack, slow bow edges.
    var REBEC_BODY = [[285, 2.2], [610, 2.8], [1150, 3.2], [1900, 2.4]]; // [Hz, Q]
    // ---- THE GLASS VIOLIN (rc.44, lab-sycorax.html's rebec variant A) -------
    // A bow drawn on a glass rim. Three things make it an instrument rather
    // than an organ pip (the Ariel critic's word for a 1:2:3 partial set, and
    // the first cut of this body was exactly that):
    //   1. the third partial is INHARMONIC - 2.76, a rim mode, not a twelfth;
    //   2. the rub is SUSTAINED at about a third of the mix for the whole
    //      note and pulses at 5.6 Hz - STICK-SLIP, the wet finger catching
    //      and letting go. A rub that fades out is rosin; a rub that never
    //      stops is friction, and friction is what a listener names glass by;
    //   3. the onset SCOOPS - a fifth of the peak through the first 62 % of
    //      the attack, the rest in the last 38 % - because glass under a bow
    //      does not bite, it swells.
    // It keeps the rebec's own everything else: the phrase, the double
    // stops, the delay send, the air claim, presence, the absences, the cut.
    // Of the fiddle's wanders it inherits none but its own `rub` - `body`
    // shapes four wooden resonances this body throws away, and `rosin` and
    // `attack` shape a bow-noise thread the stick-slip replaces - which is
    // why both are still DRAWN in renderRebecNote before the branch.
    function renderRebecGlass(dest, freq, t, durS, vel, extraSend) {
      var c = ctx;
      var stopAt = t + durS + 0.06;
      var rub = clamp(wTouch("rebec", "rub"), 0, 2);
      var env = envGain();
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      var atk = Math.min(0.78, durS * 0.55), rel = Math.min(0.5, durS * 0.3);
      if (atk + rel > durS - 0.04) { atk = durS * 0.55; rel = durS * 0.35; }
      // THE LEVEL MATCH: three partials and a wide sustained rub against a
      // saw through four bandpasses, on an attack twice as long.
      var pk = 0.030 * vel * MATCH_REBEC_GLASS;
      PJ2.Voice.env(env.gain, t, [[atk * 0.62, pk * 0.22], [atk * 0.38, pk],
                                  [Math.max(0.02, durS - atk - rel), pk * 0.867], [rel, 0]]);
      for (var i = 0; i < REBEC_GLASS_PARTIALS.length; i++) {
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(freq * REBEC_GLASS_PARTIALS[i][0], t);
        // the second partial beats a hair against its own harmonic: glass
        if (i === 1) o.detune.setValueAtTime(9, t);
        var g = c.createGain();
        g.gain.setValueAtTime(REBEC_GLASS_PARTIALS[i][1], t);
        o.connect(g); g.connect(env);
        o.start(t); o.stop(stopAt);
      }
      if (rub > 0) {
        var nz = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(freq * 4.4, t);
        bp.Q.setValueAtTime(3.5, t);
        var ng = envGain();
        // STICK-SLIP, in series: the pulse is the finger's, and it must go
        // to nothing when the note does.
        var slip = seriesTrem(5.6, 0.5, t, stopAt);
        nz.connect(bp); bp.connect(ng); ng.connect(slip); slip.connect(env);
        // held, not fading: a bowed rim rubs for as long as it sounds
        PJ2.Voice.env(ng.gain, t, [[atk, 0.30 * rub],
                                   [Math.max(0.02, durS - atk - rel), 0.28 * rub],
                                   [rel, 0]]);
        nz.start(t, nz.randomOffset); nz.stop(stopAt);
      }
      return env;
    }

    function renderRebecNote(dest, freq, t, durS, vel, rng, extraSend) {
      var c = ctx;
      // rc.44 - DRAWS FIRST, in the plain body's own order, WHICHEVER manner
      // sounds: the hand's detune and the two body resonances come off the
      // fiddle's own stream, so a glass note must spend them too or the
      // fiddle's next phrase would land somewhere else. A manner changes the
      // sound and never the composition.
      var det = rng.rnd(-6, 6);
      var i1 = rng.rint(0, 1), i2 = rng.rint(2, 3);
      var glassRoll = run.streams.rebecGlass.next();
      if (glassRoll < shareOf("rebec", "glassviolin", "glass")) {
        tookManner("rebec", "glass");
        return renderRebecGlass(dest, freq, t, durS, vel, extraSend);
      }
      tookManner("rebec", "rebec");
      var o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(det, t);            // the hand, not the tuning
      var pre = c.createGain();
      pre.gain.setValueAtTime(0.5, t);            // quiet into the resonances
      o.connect(pre);
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      var picks = [REBEC_BODY[i1], REBEC_BODY[i2]];
      var bodyQ = wChar("rebec", "body"); // the desk knob, shaded per evening (def 1 = as-composed)
      for (var i = 0; i < 2; i++) {
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(picks[i][0], t);
        bp.Q.setValueAtTime(picks[i][1] * bodyQ, t);
        pre.connect(bp);
        bp.connect(mix);
      }
      // bow noise — a breath of rosin on the attack only
      var bn = PJ2.Voice.noiseBuffer.source(c, 30);
      var bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.setValueAtTime(freq * 2.5, t);
      bf.Q.setValueAtTime(1.2, t);
      var bg = c.createGain();
      bn.connect(bf); bf.connect(bg); bg.connect(mix);
      // rc.35: rosin dose and grip length both drawn per BOW — no two
      // strokes alike. The grip (promoted `attack`, def 0.12 s) is the one
      // single millisecond literal in this body; the note's own attack is
      // min(0.5, dur·0.3), a proportion, and stays one.
      PJ2.Voice.env(bg.gain, t, [[wTouch("rebec", "attack"), 0.006 * vel * wTouch("rebec", "rosin")],
                                 [Math.max(0.05, durS * 0.4), 0]]);
      bn.start(t, bn.randomOffset);
      bn.stop(t + durS * 0.6);
      var env = c.createGain();
      mix.connect(env);
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      var atk = Math.min(0.5, durS * 0.3);
      var rel = Math.min(0.6, durS * 0.35);
      if (atk + rel > durS - 0.04) { atk = durS * 0.4; rel = durS * 0.4; }
      PJ2.Voice.env(env.gain, t, [[atk, 0.030 * vel], [Math.max(0.02, durS - atk - rel), 0.026 * vel], [rel, 0]]);
      o.start(t);
      o.stop(t + durS + 0.05);
      return env;
    }

    // ---- the waterphone (v1 ~3288, verbatim port) ---------------------------
    // Six inharmonic partials + FM bloom, all riding one shared body-wobble
    // LFO; upper partials tremolo; everything glisses down by wail% over
    // the note. The only changes from v1: the field supplies the
    // fundamental (era-aware), the injected rng supplies the tremolo rates
    // (texture-adjacent but musical state — seeded), and the master
    // envelope goes through Voice.env for the anchor discipline. ~30 nodes.
    // ---- THE CRYSTAL (rc.44, lab-sycorax.html's waterphone variant B) -------
    // A rubbed rim singing: three HARMONIC partials in beating pairs, an
    // onset measured in SECONDS, and the finger's friction at the third.
    // Where the waterphone wails downward, crystal does not move at all -
    // no gliss, no FM bloom, nothing inharmonic. It has a register law of
    // its own (one or two octaves below the metal's old placement, never
    // today's): a rubbed rim is a bigger, slower thing than a struck rod.
    function renderCrystalNote(dest, freq, t, durS, gainScale, rng, extraSend) {
      var c = ctx;
      // A CRYSTAL SPENDS THE METAL'S OWN DICE. The shimmer rates come off
      // the waterphone's stream, one per tremolo partial; a manner may not
      // move the voice's stream by a single draw, so they are spent here
      // even though nothing in this body shimmers.
      for (var q = 0; q < WATERPHONE_PARTIALS.length; q++) {
        if (WATERPHONE_PARTIALS[q].trem > 0) rng.rnd(2.5, 6.5);
      }
      var d = Math.max(0.6, durS);
      var stopAt = t + d + 0.3;
      var gs = (gainScale == null) ? 1 : gainScale;
      var beat = clamp(wTouch("waterphone", "beat"), 0.2, 6);
      var env = envGain();
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      // THE LEVEL MATCH: three pure partials against six inharmonic ones
      // plus FM.
      var pk = 0.04 * gs * MATCH_WATER_CRYSTAL;
      var a = Math.min(2.4, d * 0.42);
      PJ2.Voice.env(env.gain, t, [[a, pk],
                                  [Math.max(0.1, d - a - d * 0.3), pk * 0.95],
                                  [Math.max(0.1, d * 0.3), 0]]);
      for (var i = 0; i < CRYSTAL_PARTIALS.length; i++) {
        var hz = freq * CRYSTAL_PARTIALS[i][0];
        // the pair beats at `beat` Hz, whatever the partial's own pitch
        var cents = 1200 * Math.log(1 + beat / Math.max(20, hz)) / Math.LN2;
        for (var k = 0; k < 2; k++) {
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(hz, t);
          o.detune.setValueAtTime(k ? cents : 0, t);
          var g = c.createGain();
          g.gain.setValueAtTime(CRYSTAL_PARTIALS[i][1] * 0.5, t);
          o.connect(g); g.connect(env);
          o.start(t); o.stop(stopAt);
        }
      }
      // the finger on the rim - narrow, wet, and it never quite settles.
      // The unsettling rides its OWN gain, in series: summed into the
      // envelope it would leave friction under a note that has ended.
      var nz = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(freq * 3, t);
      bp.Q.setValueAtTime(12, t);
      var ng = envGain();
      var fw = seriesTrem(0.7, 0.35, t, stopAt);
      nz.connect(bp); bp.connect(ng); ng.connect(fw); fw.connect(env);
      PJ2.Voice.env(ng.gain, t, [[a, 0.2], [Math.max(0.1, d - a), 0]]);
      nz.start(t, nz.randomOffset); nz.stop(stopAt);
      return env;
    }

    function renderWaterphoneNote(dest, freq, t, durS, gainScale, rng, extraSend, crystal) {
      if (crystal) {
        tookManner("waterphone", "crystal");
        return renderCrystalNote(dest, freq, t, durS, gainScale, rng, extraSend);
      }
      tookManner("waterphone", "waterphone");
      var c = ctx;
      var env = c.createGain();
      env.connect(dest);
      if (extraSend) env.connect(extraSend);
      var peak = 0.04 * (gainScale == null ? 1 : gainScale);
      var a = Math.min(1.5, durS * 0.22);
      var sustainEnd = Math.max(durS - 2.2, durS * 0.6);
      PJ2.Voice.env(env.gain, t, [[a, peak], [Math.max(0.05, sustainEnd - a), peak], [Math.max(0.1, durS - sustainEnd), 0]]);

      var glissEnd = 1 - wTouch("waterphone", "wail") / 100; // 1.8 at the default, drawn per note (rc.35)
      var wobbleAmt = WATERPHONE.wobble / 100;
      var stopAt = t + durS + 0.5;

      var bodyWobble = c.createOscillator();
      bodyWobble.type = "sine";
      bodyWobble.frequency.setValueAtTime(WATERPHONE.bodyWobbleRate, t);
      bodyWobble.start(t);
      bodyWobble.stop(stopAt);

      for (var i = 0; i < WATERPHONE_PARTIALS.length; i++) {
        var p = WATERPHONE_PARTIALS[i];
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = "sine";
        var startFreq = freq * p.ratio;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.linearRampToValueAtTime(startFreq * glissEnd, t + durS);
        g.gain.setValueAtTime(p.gain, t);
        // per-partial pitch shimmer
        var lfo = c.createOscillator();
        var lfoG = c.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.25 + i * 0.08, t);
        lfoG.gain.setValueAtTime(startFreq * 0.006, t);
        lfo.connect(lfoG);
        try { lfoG.connect(osc.frequency); } catch (e0) {}
        if (p.body) {
          var bw = c.createGain();
          bw.gain.setValueAtTime(startFreq * wobbleAmt, t);
          bodyWobble.connect(bw);
          try { bw.connect(osc.frequency); } catch (e1) {}
        }
        if (p.trem > 0) {
          var trem = c.createOscillator();
          var tremG = c.createGain();
          trem.type = "sine";
          trem.frequency.setValueAtTime(rng.rnd(2.5, 6.5), t); // v1: 2.5 + rnd*4
          tremG.gain.setValueAtTime(p.gain * p.trem * WATERPHONE.shimmer, t);
          trem.connect(tremG);
          try { tremG.connect(g.gain); } catch (e2) {}
          trem.start(t);
          trem.stop(stopAt);
        }
        osc.connect(g);
        g.connect(env);
        osc.start(t);
        osc.stop(stopAt);
        lfo.start(t);
        lfo.stop(stopAt);
      }

      // FM bloom — carrier + â2-ratio modulator, index swelling in the sustain
      var carrier = c.createOscillator();
      var carrierGain = c.createGain();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, t);
      carrier.frequency.linearRampToValueAtTime(freq * glissEnd, t + durS);
      carrierGain.gain.setValueAtTime(WATERPHONE.bloomLevel, t);
      var mod = c.createOscillator();
      var modG = c.createGain();
      mod.type = "sine";
      mod.frequency.setValueAtTime(freq * 1.41, t);
      mod.frequency.linearRampToValueAtTime(freq * 1.41 * glissEnd, t + durS);
      var peakIdx = freq * WATERPHONE.bloomIntensity * wTouch("waterphone", "bloom"); // per note (rc.35)
      modG.gain.setValueAtTime(0, t);
      modG.gain.linearRampToValueAtTime(peakIdx, t + Math.min(1.5, durS * 0.25));
      modG.gain.linearRampToValueAtTime(peakIdx * 0.44, t + durS * 0.7);
      modG.gain.linearRampToValueAtTime(0, t + durS);
      mod.connect(modG);
      try { modG.connect(carrier.frequency); } catch (e3) {}
      var carrierBw = c.createGain();
      carrierBw.gain.setValueAtTime(freq * wobbleAmt, t);
      bodyWobble.connect(carrierBw);
      try { carrierBw.connect(carrier.frequency); } catch (e4) {}
      carrier.connect(carrierGain);
      carrierGain.connect(env);
      carrier.start(t);
      carrier.stop(stopAt);
      mod.start(t);
      mod.stop(stopAt);
      return env;
    }

    // ---- the bone-flute (rare, high, lonely) --------------------------------
    // Triangle + breath noise + a whisper of overblown octave; short
    // breath-length notes, register +1 — the one color above the chest in
    // this track.
    function renderBoneFluteNote(dest, freq, t, durS, vel) {
      var c = ctx;
      var o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      var g = c.createGain();
      o.connect(g); g.connect(dest);
      var atk = Math.min(0.22, durS * 0.3);
      var rel = Math.min(0.35, durS * 0.35);
      PJ2.Voice.env(g.gain, t, [[atk, 0.028 * vel], [Math.max(0.02, durS - atk - rel), 0.024 * vel], [rel, 0]]);
      o.start(t);
      o.stop(t + durS + 0.05);
      // the breath across the embouchure
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bf = c.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.setValueAtTime(freq * 2, t);
      bf.Q.setValueAtTime(4, t);
      var ng = c.createGain();
      n.connect(bf); bf.connect(ng); ng.connect(dest);
      // rc.35: the air across the embouchure, drawn per note, and the CHIFF
      // — the tongued edge — scaling the onset stage alone (promoted, def 1
      // = the body's own 0.006). Tonguing differs every note; the column of
      // air behind it does not differ as fast.
      var flBreath = wTouch("boneflute", "breath");
      var flChiff = wTouch("boneflute", "chiff");
      PJ2.Voice.env(ng.gain, t, [[atk, 0.006 * vel * flBreath * flChiff], [Math.max(0.02, durS - atk - rel), 0.005 * vel * flBreath], [rel, 0]]);
      n.start(t, n.randomOffset);
      n.stop(t + durS + 0.05);
      // overblown octave, a whisper
      var h = c.createOscillator();
      h.type = "sine";
      h.frequency.setValueAtTime(freq * 2, t);
      var hg = c.createGain();
      h.connect(hg); hg.connect(dest);
      PJ2.Voice.env(hg.gain, t, [[atk + 0.05, 0.005 * vel], [Math.max(0.02, durS - atk - rel - 0.05), 0.004 * vel], [rel, 0]]);
      h.start(t);
      h.stop(t + durS + 0.05);
    }

    // ========================================================================
    // PERCUSSION BODIES — all cheap, all budget-claimed, all landscape.
    // Peaks â¤ 0.05 (the plan's ceiling); level NEVER carries intensity —
    // pacing does.
    // ========================================================================

    // ---- proto-drum (v1's heartbeat ~3648, verbatim spirit) -----------------
    // Sine lub-dub, 36â20 Hz-ish exponential dips, a random-walked
    // intensity, skip and triple irregularities. Routes to layProto —
    // AROUND cutGain — so the hush keeps its pulse.
    function protoBeat(t, rng) {
      run.hbIntensity += (rng.next() - 0.5) * 0.15;
      run.hbIntensity = clamp(run.hbIntensity, 0.4, 1.3);
      var irr = rng.next();
      if (irr < 0.10) { emitEvent({ type: "percussion", mode: "proto-skip", t: t }); return; } // the skipped beat
      var beats = (irr < 0.15) ? 3 : 2;
      var tok = run.budget.claim(2 * beats, t + beats * 0.45 + 0.4);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      for (var i = 0; i < beats; i++) {
        var bt = t + i * (0.3 + rng.rnd(0, 0.1));
        var isLub = i === 0;
        var startFreq = isLub ? rng.rnd(36, 44) : rng.rnd(32, 38);
        var endFreq = rng.rnd(18, 22);
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(startFreq, bt);
        o.frequency.exponentialRampToValueAtTime(endFreq, bt + 0.2);
        var g = c.createGain();
        o.connect(g); g.connect(run.layProto);
        var vol = (isLub ? 0.042 : 0.028) * run.hbIntensity;
        PJ2.Voice.env(g.gain, bt, [[0.006, vol], [0.24, 0.0014], [0.06, 0]]);
        o.start(bt);
        o.stop(bt + 0.38);
        emitNote({ voice: "protodrum", kind: isLub ? "lub" : "dub", freq: null, t: bt, durS: 0.3 });
      }
    }

    // ---- frame drum: dull skin stroke -----------------------------------------
    // Filtered sine burst (70â110 Hz, fast exponential decay) + a
    // band-passed skin transient â¤ 30 ms. The deadened variant is the
    // muffled palm — shorter, duller, quieter.
    // ---- THE BONES (rc.44, lab-sycorax.html's percussion variant B) --------
    // Dry wood: no skin at all. Every stroke is a tuned bar - two modes at
    // hz and hz x 2.71 - with a hint of body under it and the stick on top;
    // the log becomes a hollow woodblock and the rattle a clatter of them.
    // TWO OWNER SETTINGS ARE BAKED IN: `dryness` ships at 0.5 (half the
    // lab's ring - a drier bone is a bone), and the whole instrument sounds
    // ONE OCTAVE BELOW the lab's placement, a transposition of the
    // instrument rather than a knob (Ariel's marimba bakes its +1 the same
    // way). The heartbeat is not here and never will be: it is the hush's
    // heart, and it beats the same in every manner.
    function bonesClack(at, hz, amt, len, dry, thru) {
      var c = ctx;
      var mix = c.createGain();
      mix.gain.setValueAtTime(1, at);
      var g = envGain();
      mix.connect(g); g.connect(run.layPerc);
      // the strike still wakes the cavern, as the skin's did
      if (thru) { try { g.connect(run.throatSendPerc); } catch (eT) {} }
      PJ2.Voice.env(g.gain, at, [[0.001, amt], [len * dry, amt * 0.06], [0.02, 0]]);
      var m1 = c.createOscillator();
      m1.type = "sine";
      m1.frequency.setValueAtTime(hz, at);
      var m1g = c.createGain();
      m1g.gain.setValueAtTime(1, at);
      m1.connect(m1g); m1g.connect(mix);
      m1.start(at); m1.stop(at + len * dry + 0.08);
      var m2 = c.createOscillator();
      m2.type = "sine";
      m2.frequency.setValueAtTime(hz * 2.71, at);
      var m2g = envGain();
      m2.connect(m2g); m2g.connect(mix);
      PJ2.Voice.env(m2g.gain, at, [[0.001, 0.35], [len * dry * 0.45, 0]]);
      m2.start(at); m2.stop(at + len * dry * 0.5 + 0.05);
      var wo = c.createOscillator();
      wo.type = "sine";
      wo.frequency.setValueAtTime(hz * 0.25, at);
      var wg = envGain();
      wo.connect(wg); wg.connect(mix);
      PJ2.Voice.env(wg.gain, at, [[0.002, 0.2], [0.04, 0]]);
      wo.start(at); wo.stop(at + 0.06);
      var nz = PJ2.Voice.noiseBuffer.source(c, 30);
      var bq = c.createBiquadFilter();
      bq.type = "bandpass";
      bq.frequency.setValueAtTime(hz * 1.6, at);
      bq.Q.setValueAtTime(3, at);
      var ng = envGain();
      nz.connect(bq); bq.connect(ng); ng.connect(mix);
      PJ2.Voice.env(ng.gain, at, [[0.001, 0.5], [0.012, 0]]);
      nz.start(at, nz.randomOffset); nz.stop(at + 0.03);
    }
    // the stroke's manner, drawn on the stop's own fork, one coin per stroke
    function strokeIsBones() {
      return run.streams.percBones.next() < shareOf("percussion", "bones", "bones");
    }
    function bonesDry() { return clamp(wTouch("percussion", "dryness"), 0.2, 2); }

    function frameDrum(t, rng, o2) {
      o2 = o2 || {};
      // rc.35: the hand's own spread, drawn per STROKE (promoted `stroke`,
      // def 1). It is a spread, not a swell: the anti-groove law's "speed
      // rises, level never does" is about the CONTOUR of a cluster, and a
      // symmetric ±20 % scatter carries no contour at all.
      var peak = ((o2.peak != null) ? o2.peak : 0.045) * wTouch("percussion", "stroke");
      var deadened = !!o2.deadened;
      var toneFreq = rng.rnd(70, 110);
      var skinFreq = rng.rnd(900, 1500);
      var pulses = !deadened && rng.chance(0.7); // the trompette hears most strokes
      var isBones = strokeIsBones();            // rc.44, drawn with the rest
      var tok = run.budget.claim(4, t + 0.5);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      if (isBones) {
        // a clave rings for about an eighth of a second, and half of the
        // bones' level lives in that ring rather than in its peak - which is
        // what keeps the stop under the engine's own loudest beat
        var bp2 = run.streams.percBones;
        bonesClack(t, bp2.rnd(1450, 1850) * BONES_OCT, peak * MATCH_PERC_BONES,
                   deadened ? 0.06 : 0.14, bonesDry(), true);
        if (pulses) pulseTrompette(t);
        emitNote({
          voice: o2.who || "percussion", kind: deadened ? "frame-deadened" : "frame",
          mode: o2.mode || null, clusterId: o2.clusterId || null,
          freq: null, t: t, durS: 0.25, velocity: o2.vel != null ? o2.vel : 1,
          manner: "bones",
        });
        return;
      }
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(toneFreq, t);
      o.frequency.exponentialRampToValueAtTime(toneFreq * 0.72, t + 0.12);
      var g = c.createGain();
      o.connect(g); g.connect(run.layPerc);
      // the strike wakes the cavern (transient throat excitation — see the
      // throat energy law at build)
      try { g.connect(run.throatSendPerc); } catch (eThr) {}
      var bodyDur = deadened ? 0.10 : 0.18;
      PJ2.Voice.env(g.gain, t, [[0.004, peak], [bodyDur, peak * 0.05], [0.06, 0]]);
      o.start(t);
      o.stop(t + bodyDur + 0.1);
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(skinFreq, t);
      bp.Q.setValueAtTime(1.1, t);
      var sg = c.createGain();
      n.connect(bp); bp.connect(sg); sg.connect(run.layPerc);
      PJ2.Voice.env(sg.gain, t, [[0.002, peak * (deadened ? 0.25 : 0.5)], [0.022, 0]]); // â¤ 30 ms
      n.start(t, n.randomOffset);
      n.stop(t + 0.06);
      if (pulses) pulseTrompette(t);
      emitNote({
        voice: o2.who || "percussion", kind: deadened ? "frame-deadened" : "frame",
        mode: o2.mode || null, clusterId: o2.clusterId || null,
        freq: null, t: t, durS: 0.25, velocity: o2.vel != null ? o2.vel : 1,
        manner: "drums",
      });
    }

    // ---- log drum: resonant wooden tone, two pitches a fourth apart ----------
    // Field degrees 0 and 4 (semitones 0 and 5 — a true fourth in this
    // mode) at oct â2. Pitched, so it keeps the key like everything else.
    function logDrum(t, rng, o2) {
      o2 = o2 || {};
      var deg = rng.chance(0.5) ? 0 : 4;
      var isBones = strokeIsBones();            // rc.44, drawn with the rest
      var tok = run.budget.claim(3, t + 1.2);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var freq = run.field.degFreq(deg, -2); // read at schedule time
      if (isBones) {
        // a WOODBLOCK, hollow, and its knock behind it. The bar has no
        // pitch to keep - the field's degree is drawn and emitted exactly as
        // before, so the stream cannot tell the two apart, but a struck bar
        // is not a tuned log and the lab did not pretend otherwise.
        var dry = bonesDry();
        bonesClack(t, 780 * BONES_OCT, 0.04 * MATCH_PERC_BONES, 0.11, dry, true);
        bonesClack(t + 0.055, 1300 * BONES_OCT, 0.04 * MATCH_PERC_BONES * 0.4, 0.05, dry, false);
        emitNote({
          voice: "percussion", kind: "log", mode: o2.mode || null,
          clusterId: o2.clusterId || null,
          freq: freq, deg: deg, oct: -2, t: t, durS: 0.9, manner: "bones",
        });
        return;
      }
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      var h = c.createOscillator();
      h.type = "triangle";
      h.frequency.setValueAtTime(freq * 2.01, t); // the wooden edge, slightly off
      var hg = c.createGain();
      hg.gain.setValueAtTime(0.22, t);
      var g = c.createGain();
      o.connect(g);
      h.connect(hg); hg.connect(g);
      g.connect(run.layPerc);
      try { g.connect(run.throatSendPerc); } catch (eThr2) {} // the wooden answer rings the cave
      PJ2.Voice.env(g.gain, t, [[0.006, 0.04], [0.7, 0.0015], [0.15, 0]]);
      o.start(t); o.stop(t + 1.0);
      h.start(t); h.stop(t + 1.0);
      emitNote({
        voice: "percussion", kind: "log", mode: o2.mode || null,
        clusterId: o2.clusterId || null,
        freq: freq, deg: deg, oct: -2, t: t, durS: 0.9, manner: "drums",
      });
    }

    // ---- bone rattle: 3â7 tiny ticks on ONE gain chain ------------------------
    // The crackle pattern — one source, one filter, however many ticks. A
    // dry shimmer OVER drum strokes, never alone in the dark.
    function boneRattle(t, rng, o2) {
      o2 = o2 || {};
      var nTicks = rng.rint(3, 7);
      var isBones = strokeIsBones();
      var tok = run.budget.claim(3, t + 1.0);
      if (!tok) return;
      run.tokens.push(tok);
      // EVERY gap the plain rattle would have drawn is drawn here, whichever
      // manner sounds, so a clatter cannot move the next stroke by a
      // millisecond. (After the claim, where the rattle has always drawn
      // them: a refused stroke draws nothing.)
      var gaps = [];
      for (var q = 0; q < nTicks; q++) gaps.push(rng.rnd(0.03, 0.09));
      var c = ctx;
      if (isBones) {
        // A CLATTER of little bars, five to ten of them.
        var brng = run.streams.percBones;
        var nT = brng.rint(5, 10), atB = 0, dryB = bonesDry();
        for (var b = 0; b < nT; b++) {
          bonesClack(t + atB, brng.rnd(1300, 2100) * BONES_OCT,
                     0.011 * MATCH_PERC_BONES * brng.rnd(0.7, 1), 0.075, dryB, false);
          atB += brng.rnd(0.035, 0.1);
        }
        emitNote({
          voice: "percussion", kind: "rattle", mode: o2.mode || null,
          freq: null, t: t, durS: atB, manner: "bones",
        });
        return;
      }
      var src = PJ2.Voice.noiseBuffer.source(c, 30);
      var hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(2600, t);
      hp.Q.setValueAtTime(0.7, t);
      var g = c.createGain();
      src.connect(hp); hp.connect(g); g.connect(run.layPerc);
      var segs = [], at = 0;
      for (var i = 0; i < nTicks; i++) {
        var gap = gaps[i];
        segs.push([gap, 0]);
        segs.push([0.003, 0.011]);
        segs.push([0.02, 0]);
        at += gap + 0.023;
      }
      PJ2.Voice.env(g.gain, t, segs);
      src.start(t, src.randomOffset);
      src.stop(t + at + 0.1);
      emitNote({
        voice: "percussion", kind: "rattle", mode: o2.mode || null,
        freq: null, t: t, durS: at, manner: "drums",
      });
    }

    // ========================================================================
    // THE LANDSCAPE LANES
    // ========================================================================

    // ---- the gurdy (landscape — THE SEAM) -----------------------------------
    // v1's sycorax drone cluster (~2844) re-voiced from the LIVE POSE: each
    // 20â28 s cycle reads harmony.current() at its own start and voices the
    // pose's degrees as detuned saws at oct â2 (46â124 Hz territory, v1's
    // register) plus the root doubled at oct â1 for body, through one
    // moving lowpass (150â350 Hz band, murk- and darkening-scaled), all
    // through the shared drift ramps (Â±3%, v1's warble). A cycle keeps its
    // frequencies for its whole life; the NEXT cycle reads the pose (and
    // the field — era-aware through the sink) again. The lane is NEVER
    // cancelled by scenes, performances, or the cut: it is the seam.
    //
    // THE TROMPETTE: one extra saw at the root, oct â1, whose ONLY route is
    // the grit bus (gritSendTromp) — the buzzing bridge. Its send gain is
    // pulsed by drum strokes (pulseTrompette, 60 ms+ ramps, â¤ +0.1).
    //
    // THE SUB: sine at the root, oct â3, chance 0.3 normally — FORCED in
    // the invocation and inside a darkening window (the arrival gesture
    // "sinks the sub-octave in").
    function startGurdy() {
      var lane = run.clock.lane("gurdy");
      var rng = run.streams.gurdy;

      // ---- THE ARMONICA (rc.44, lab-sycorax.html's gurdy variant B) --------
      // Bowed glass on the same tones: no sawtooth anywhere, five partials
      // with the WEIGHT ON THE FOURTH (glass radiates from its upper modes,
      // which is what stops this being "a quieter cluster"), that fourth
      // split into a beating pair at 4 / 4.02, and a wet finger's rub band
      // above it. One pad of the cycle, rendered the glass way.
      //
      // What a glass cycle does NOT have: the LOWPASS (there is no saw to
      // shade), the TROMPETTE (a bowed glass has no buzzing bridge and no
      // dog), and therefore NO GRIT AT ALL — the bed's own grit send hangs
      // off the lowpass, so on a glass cycle the grit bus hears nothing from
      // the gurdy family. The neighbouring cycle it crossfades with still
      // feeds it, which is why the bus never falls silent at a seam.
      // What it keeps: the sub (as the lab keeps it — partials 1 and 2 only,
      // "the sub stays a floor"), the cycle's own 3–5 s fades, the pose's
      // degrees from the live field at schedule time, and the route through
      // gurdyBreath -> gurdyLevel -> mixGurdy -> cutGain, so the cut ducks it
      // exactly as it ducks the wheel.
      function armonicaPad(mix, t, freq, durS, peak, isSub, rub, fadeIn, fadeOut) {
        var c = ctx;
        var stopAt = t + durS + 0.1;
        var g = envGain();
        // THE LEVEL MATCH: five glass partials where the cluster had one saw
        // under a 200 Hz lid, measured on the lab's hushed bus.
        var pk = peak * MATCH_GURDY_ARMONICA;
        PJ2.Voice.env(g.gain, t, [[fadeIn, pk],
                                  [Math.max(0.05, durS - fadeIn - fadeOut), pk * 0.94],
                                  [fadeOut, 0]]);
        g.connect(mix);
        for (var i = 0; i < ARM_PARTIALS.length; i++) {
          var pr = ARM_PARTIALS[i];
          if (isSub && pr[0] > 2) continue;          // the sub stays a floor
          var o = c.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(freq * pr[0], t);
          var og = c.createGain();
          og.gain.setValueAtTime(pr[1], t);
          o.connect(og); og.connect(g);
          o.start(t);
          o.stop(stopAt);
        }
        // the finger — a narrow band of friction at the fourth partial. Its
        // wobble rides its OWN gain, in series after the envelope: hung on
        // ng.gain it would sum with the envelope and put a thread of
        // un-enveloped friction under the whole cycle.
        if (rub > 0 && !isSub) {
          var nz = PJ2.Voice.noiseBuffer.source(c, 30);
          var bp = c.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.setValueAtTime(freq * 4, t);
          bp.Q.setValueAtTime(9, t);
          var ng = envGain();
          var rw = seriesTrem(3.1, 0.36, t, stopAt);
          nz.connect(bp); bp.connect(ng); ng.connect(rw); rw.connect(g);
          PJ2.Voice.env(ng.gain, t, [[fadeIn, 0.28 * rub],
                                     [Math.max(0.05, durS - fadeIn - fadeOut), 0.22 * rub],
                                     [fadeOut, 0]]);
          nz.start(t, nz.randomOffset);
          nz.stop(stopAt);
        }
      }

      function cycle(t) {
        // Draw everything FIRST so a budget refusal can't shift the stream.
        var durS = rng.rnd(20, 28);
        var overlap = rng.rnd(3, 5);
        var subRoll = rng.chance(0.3);
        var driftDraws = [];
        // rc.35 — THE SEAM'S RULE: the gurdy varies by CHARACTER and WEATHER
        // only, and both are read HERE, at the cycle's own start, and held
        // for the whole cycle. Nothing about this drone may move while it is
        // sounding, or the floor moves under the listener.
        var warble = wWx("gurdy", "warble", t); // the drift's reach (def 1 = v1's ±3%)
        var bright = wChar("gurdy", "brightness");
        var dog = wChar("gurdy", "dog");        // the trompette's dose, this evening's
        for (var dd = 0; dd < 5; dd++) {
          driftDraws.push([1 + rng.rnd(-0.03, 0.03) * warble, 1 + rng.rnd(-0.02, 0.02) * warble]);
        }
        var cutoffDraw = rng.rnd(150, 350);
        // rc.44 — THE MANNER, drawn HERE, at the cycle's own start, on the
        // stop's own fork, and held for the cycle's whole life. That is the
        // seam's rule applied to a stop: a drone that changed instrument
        // halfway would move the floor under the listener. Two consecutive
        // cycles of different manners simply crossfade over their normal
        // 3–5 s fades, which is the same crossfade the wheel has always
        // made with itself. The coin is tossed unconditionally, whatever the
        // share says, so moving the knob mid-run cannot shift this fork.
        var glassRoll = run.streams.gurdyGlass.next();
        var isGlass = glassRoll < shareOf("gurdy", "glass", "glass");
        var st = curSceneType();
        var iv = curIntensity(t);
        var wx = wxAt(t);
        var hasSub = subRoll || st === "invocation" || t < run.forceSubUntil;
        // The claim counts VOICES, not nodes (pj2-voice: nNodes is telemetry),
        // so the glass declares its real node cost — five sines and a rub
        // chain per pad — without changing what else fits in the room.
        var tok = run.budget.claim(isGlass ? (hasSub ? 74 : 62) : (hasSub ? 14 : 12),
                                   t + durS + 0.3);
        if (!tok) {
          lane.at(t + 2, cycle); // the seam must not open: short-leash retry
          return;
        }
        run.tokens.push(tok);
        var c = ctx;
        // Darkness: murk closes the cutoff, the tide leans on it, and a
        // darkening arrival closes it another ~15% for its window.
        var cutoff = cutoffDraw * (1 - 0.35 * wx.murk) * (1 - 0.12 * curTidePos());
        if (t < run.darkenUntil) cutoff *= 0.85;
        cutoff = Math.max(90, cutoff + 60 * iv);
        cutoff *= bright;                      // read at cycle start, held (rc.35)
        // THE CYCLE'S HEAD. The wheel's is a moving lowpass into the bed and
        // the grit bus; the glass's is a plain mixing stage into the bed
        // alone (see armonicaPad's note on the grit).
        var lp = null, mix = null, rub = 0;
        if (isGlass) {
          mix = c.createGain();
          mix.gain.setValueAtTime(1, t);
          mix.connect(run.gurdyBreath);
          rub = clamp(wChar("gurdy", "rub"), 0, 2);   // character, at cycle start (the seam's rule)
        } else {
          lp = c.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.setValueAtTime(cutoff, t);
          lp.frequency.linearRampToValueAtTime(cutoff + 80, t + durS * 0.4);
          lp.frequency.linearRampToValueAtTime(Math.max(80, cutoff - 30), t + durS);
          lp.Q.setValueAtTime(0.5, t);
          lp.connect(run.gurdyBreath);
          lp.connect(run.gritSendGurdy); // the grit bus always hears the bed
        }
        var ch = null;
        try { ch = run.harmony.current(); } catch (e) {}
        var degs = (ch && ch.chordDegs && ch.chordDegs.length) ? ch.chordDegs : [0, 2, 4];
        var pads = [];
        for (var di = 0; di < degs.length && di < 3; di++) {
          pads.push({ deg: degs[di], oct: -2, peak: 0.035, type: "sawtooth" });
        }
        pads.push({ deg: degs[0], oct: -1, peak: 0.028, type: "sawtooth" }); // the body course
        var fadeIn = 3 + rng.rnd(0, 2);
        var fadeOut = 3 + rng.rnd(0, 2);
        // The glass's edges are the cycle's own 3–5 s, floored at the lab's
        // 1.5 s: a bowed rim must never arrive faster than a finger can
        // start it, and no crossfade this slow can be heard as an event.
        var gFadeIn = Math.max(1.5, fadeIn), gFadeOut = fadeOut;
        for (var i = 0; i < pads.length; i++) {
          var p = pads[i];
          var freq = run.field.degFreq(p.deg, p.oct); // read at schedule time
          if (isGlass) {
            armonicaPad(mix, t, freq, durS, p.peak, false, rub, gFadeIn, gFadeOut);
          } else {
            var o = c.createOscillator();
            o.type = p.type;
            o.frequency.setValueAtTime(freq, t);
            // v1's drift: anchored ramps to Â±3% waypoints and home again
            o.frequency.linearRampToValueAtTime(freq * driftDraws[i][1], t + durS * 0.35);
            o.frequency.linearRampToValueAtTime(freq * driftDraws[i][0], t + durS * 0.7);
            o.frequency.linearRampToValueAtTime(freq, t + durS);
            var g = c.createGain();
            o.connect(g); g.connect(lp);
            PJ2.Voice.env(g.gain, t, [[fadeIn, p.peak], [durS - fadeIn - fadeOut, p.peak], [fadeOut, 0]]);
            o.start(t);
            o.stop(t + durS + 0.1);
          }
          emitNote({ voice: "gurdy", freq: freq, t: t, durS: durS, deg: p.deg, oct: p.oct,
                     manner: isGlass ? "glass" : "wheel" });
        }
        // the trompette — grit-only, always present, pulsed elsewhere. A
        // glass cycle has none: a bowed rim has no buzzing bridge, so the
        // dog's dose is read (it is the evening's, drawn either way) and
        // spent on nothing.
        if (!isGlass) {
          var tf = run.field.degFreq(degs[0], -1);
          var to = c.createOscillator();
          to.type = "sawtooth";
          to.frequency.setValueAtTime(tf, t);
          var tg = c.createGain();
          to.connect(tg);
          tg.connect(run.gritSendTromp);
          PJ2.Voice.env(tg.gain, t, [[fadeIn, 0.02 * dog], [durS - fadeIn - fadeOut, 0.02 * dog], [fadeOut, 0]]);
          to.start(t);
          to.stop(t + durS + 0.1);
        }
        if (hasSub) {
          var sf = run.field.degFreq(degs[0], -3);
          if (isGlass) {
            armonicaPad(mix, t, sf, durS, 0.022, true, rub, gFadeIn, gFadeOut);
          } else {
            var so = c.createOscillator();
            so.type = "sine";
            so.frequency.setValueAtTime(sf, t);
            var sg = c.createGain();
            so.connect(sg); sg.connect(run.gurdyBreath);
            PJ2.Voice.env(sg.gain, t, [[fadeIn, 0.022], [durS - fadeIn - fadeOut, 0.022], [fadeOut, 0]]);
            so.start(t);
            so.stop(t + durS + 0.1);
          }
          emitNote({ voice: "gurdy", kind: "sub", freq: sf, t: t, durS: durS, deg: degs[0], oct: -3,
                     manner: isGlass ? "glass" : "wheel" });
        }
        lane.at(t + (durS - overlap), cycle);
      }
      lane.at(run.t0, cycle);
    }

    // ---- the low horn (landscape — THE UNDER-VOICE, rc.23) -------------------
    // See the header paragraph. Ported from the owner-approved prototype
    // (instrument-mockup-horn.html) onto the engine's discipline: draws on
    // the dedicated "horn" fork only (chance roll FIRST, unconditionally,
    // at every opportunity — stream discipline); pitch from the LIVE field
    // + pose at schedule time (era-aware through the sink); envelopes
    // through env(); budget-claimed; routed layHorn -> cutGain so the cut
    // ducks it with the rest of the landscape. Filter cutoff and detune
    // are pitch/timbre motions, not amplitude, so they use anchored
    // setValue/ramp pairs directly (env() anchors at 0, which is no
    // frequency at all).
    var HORN_CHANCE = { pose: 0.4, arrival: 0.6 };
    var HORN_SCENE_MUL = {
      "gathering": 0.5, "processional": 1.2, "circling": 0.85,
      "invocation": 1.25, "afterimage": 0, // the afterimage keeps its own far call
    };

    // One horn tone. Returns true if it sounded (budget willing).
    //
    // rc.44 — THE REGISTER LAW and THE CONCH both live here, because every
    // horn tone in this engine comes through this one door: the held call,
    // the two-note call's pair, the arrival's answer and the afterimage's
    // far final call are all horn tones, and the owner's "no longer played
    // at the zero point where it's at now" is a law about the instrument,
    // not about one gesture.
    function renderHornTone(deg, t, durS, vel, kind) {
      var rng = run.streams.horn;
      // Draw everything FIRST so a budget refusal can't shift the stream.
      var atk = rng.rnd(3, 6);
      var rel = rng.rnd(4, 8);
      // …the manner among them, on the stop's own fork, one coin per tone.
      var conchRoll = run.streams.hornConch.next();
      var isConch = conchRoll < shareOf("horn", "conch", "conch");
      if (atk + rel > durS - 1) { atk = durS * 0.35; rel = durS * 0.45; }
      var hold = durS - atk - rel;
      var tok = run.budget.claim(8, t + durS + 0.4);
      if (!tok) return false;
      run.tokens.push(tok);
      var c = ctx;
      var wx = wxAt(t);
      // THE REGISTER, drawn per TONE on the wander's own touch fork: −1 or
      // −2 octaves below the treeline's rc.23 placement, equal odds, and
      // never today's. Rounded like the bullroarer's (a weighted def hands
      // back the KNOB at vary 0, and a knob sitting between two octaves is
      // no octave at all); clamped to the strip so a hand-typed value cannot
      // put the horn somewhere the ledger has not been asked about.
      var regOct = Math.round(clamp(wTouch("horn", "register"), -2, 0));
      var oct = -1 + regOct;                 // −2 or −3 (0 on the knob = today's −1)
      var freq = run.field.degFreq(deg, oct); // read at schedule time, never cached
      // 0.028: ~30% under the rc.23 launch level (owner, 2026-08-23, by
      // ear on the live mix). Breath, 3rd partial and the grit tap all
      // scale from here; the mixer's horn fader scales from here too.
      var peak = 0.028 * (vel || 1);
      if (isConch) {
        // ---- THE CONCH (rc.44, lab-sycorax.html's horn variant A) --------
        // A shell trumpet. The horn's whole tell is its three-to-six-second
        // swell; a conch is simply THERE in sixty milliseconds, and its two
        // cavity peaks (520 Hz and 1450 Hz) sit far above the horn's
        // 300→900 Hz lid — which is the point of a shell, and the reason the
        // conch survives the register law intact: the fundamental drops two
        // or three octaves and the CAVITY does not move, so what the ear
        // gets is a brighter, thinner voice on a lower note, exactly as a
        // real shell would sound over a longer air column.
        var stopAtC = t + durS + 0.3;
        var atkC = 0.06, relC = Math.min(2.5, durS * 0.25);
        var holdC = Math.max(0.1, durS - atkC - relC);
        var pkC = peak * MATCH_HORN_CONCH;
        var oC = c.createOscillator();
        oC.type = "sawtooth";
        oC.frequency.setValueAtTime(freq, t);
        oC.detune.setValueAtTime(-18, t);
        oC.detune.linearRampToValueAtTime(0, t + 0.18);   // the lips finding the shell
        var preC = c.createGain();
        preC.gain.setValueAtTime(0.55, t);
        var shell = clamp(wTouch("horn", "shell"), 0, 16);
        var p1C = c.createBiquadFilter();
        p1C.type = "peaking";
        p1C.frequency.setValueAtTime(520, t);
        p1C.Q.setValueAtTime(1.6, t);
        p1C.gain.setValueAtTime(shell, t);
        var p2C = c.createBiquadFilter();
        p2C.type = "peaking";
        p2C.frequency.setValueAtTime(1450, t);
        p2C.Q.setValueAtTime(2.2, t);
        p2C.gain.setValueAtTime(shell * 0.7, t);
        var lpC = c.createBiquadFilter();
        lpC.type = "lowpass";
        lpC.frequency.setValueAtTime(3200, t);
        lpC.Q.setValueAtTime(0.7, t);
        var gC = envGain();
        // the shell wavers: a player's breath, in series so it cannot sound
        // before the note opens or survive the cut
        var wavC = seriesTrem(0.5, 0.06, t, stopAtC, true);
        oC.connect(preC); preC.connect(p1C); p1C.connect(p2C); p2C.connect(lpC); lpC.connect(gC);
        gC.connect(wavC); wavC.connect(run.layHorn);
        PJ2.Voice.env(gC.gain, t, [[atkC, pkC], [holdC, pkC * 0.86], [relC, 0]]);
        oC.start(t); oC.stop(stopAtC);
        // the blown air at the lip, loudest in the first breath
        var nzC = PJ2.Voice.noiseBuffer.source(c, 30);
        var bpC = c.createBiquadFilter();
        bpC.type = "bandpass";
        bpC.frequency.setValueAtTime(1600, t);
        bpC.Q.setValueAtTime(1.1, t);
        var ngC = envGain();
        nzC.connect(bpC); bpC.connect(ngC); ngC.connect(run.layHorn);
        PJ2.Voice.env(ngC.gain, t, [[0.04, pkC * 0.45], [0.4, pkC * 0.16],
                                    [Math.max(0.1, durS - 0.44), 0]]);
        nzC.start(t, nzC.randomOffset); nzC.stop(stopAtC);
        emitNote({ voice: "horn", kind: kind, freq: freq, t: t, durS: durS, deg: deg,
                   oct: oct, manner: "conch" });
        return true;
      }
      // rc.35: blossom, breath and scoop are all TOUCH — a fresh draw every
      // tone. The horn's own attack is NOT promoted: rng.rnd(3, 6) already
      // draws it per tone, so there is no single literal to range (the
      // table's own condition), and a swell that long can never click.
      var blossom = wTouch("horn", "blossom");
      // the body: one sawtooth finding its partial
      var o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(-35 * wTouch("horn", "scoop"), t);
      o.detune.linearRampToValueAtTime(0, t + 0.4);
      // the bell: the blossom is the crescendo. Murk leans on how far it
      // opens, and a darkening arrival's window closes it ~15% like the
      // gurdy's — the horn darkens with the night it stands in.
      var open = (300 + 600 * blossom) * (1 - 0.2 * wx.murk);
      if (t < run.darkenUntil) open *= 0.85;
      open = Math.max(320, open);
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.setValueAtTime(0.7, t);
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(open, t + durS * 0.45);
      lp.frequency.setValueAtTime(open, t + durS * 0.55);
      lp.frequency.exponentialRampToValueAtTime(300, t + durS);
      var g = c.createGain();
      PJ2.Voice.env(g.gain, t, [[atk, peak], [hold, peak * 0.92], [rel, 0]]);
      o.connect(lp); lp.connect(g); g.connect(run.layHorn);
      o.start(t);
      o.stop(t + durS + 0.3);
      // the breath: 800 Hz band of air riding the same shape, quieter;
      // the weather's breath channel breathes the dose around the knob
      var bPeak = peak * 0.20 * wTouch("horn", "breath") * (0.8 + 0.4 * wx.breath);
      if (bPeak > 0) {
        var nz = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(800, t);
        bp.Q.setValueAtTime(1.2, t);
        var bg = c.createGain();
        PJ2.Voice.env(bg.gain, t, [[atk, bPeak], [hold, bPeak * 0.8], [rel, 0]]);
        nz.connect(bp); bp.connect(bg); bg.connect(run.layHorn);
        nz.start(t, nz.randomOffset);
        nz.stop(t + durS + 0.3);
      }
      // the whisper of brightness: a 3rd partial that exists only while
      // the bell is open — it rises out of nothing mid-note and sinks back
      var wPeak = peak * 0.10 * Math.min(1, blossom);   // the SAME draw as the bell's
      if (wPeak > 0) {
        var p3 = c.createOscillator();
        p3.type = "sine";
        p3.frequency.setValueAtTime(freq * 3, t);
        var pg = c.createGain();
        PJ2.Voice.env(pg.gain, t, [[durS * 0.32, 0], [durS * 0.18, wPeak],
                                   [durS * 0.22, wPeak * 0.5], [durS * 0.28, 0]]);
        p3.connect(pg); pg.connect(run.layHorn);
        p3.start(t);
        p3.stop(t + durS + 0.3);
      }
      emitNote({ voice: "horn", kind: kind, freq: freq, t: t, durS: durS, deg: deg,
                 oct: oct, manner: "horn" });
      return true;
    }

    // One entry = one call: usually a single held tone on the pose's root
    // or fifth (the fifth favored when the pose actually holds it); rarely
    // the two-note call — the fifth FALLING to the root, overlapped like a
    // breath re-taken. Never the other way; the treeline does not fanfare.
    function hornCall(t) {
      var rng = run.streams.horn;
      if (rng.chance(0.15)) {
        var d1 = rng.rnd(10, 14);
        var d2 = rng.rnd(14, 22);
        var rest2 = rng.rnd(6, 14);
        renderHornTone(5, t, d1, 1, "call");
        run.clock.lane("horn").at(t + d1 * 0.55, function (tt) {
          if (!run || !run.live || inHush(tt)) return;
          renderHornTone(0, tt, d2, 1, "call");
        });
        run.hornHoldUntil = t + d1 * 0.55 + d2 + rest2 * restK("horn");
        return;
      }
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var hasFifth = false;
      var cds = (ch && ch.chordDegs) ? ch.chordDegs : [0];
      for (var i = 0; i < cds.length; i++) if (cds[i] === 5) hasFifth = true;
      var deg = rng.chance(hasFifth ? 0.45 : 0.25) ? 5 : 0;
      var durS = rng.rnd(12, 30);
      var rest = rng.rnd(6, 14);
      renderHornTone(deg, t, durS, 1, "held");
      run.hornHoldUntil = t + durS + rest * restK("horn");
    }

    // One opportunity, one decision. Gates AFTER the unconditional roll:
    // the afterimage keeps its own far call; the hush is never entered and
    // the horn holds its breath from 4 s before the cut (a swell chopped
    // mid-bloom would read as an event, and the cut must own that moment);
    // the gathering stays bare below intensity 0.12; one call at a time.
    function hornConsider(kind, t, poseName, col) {
      if (!run || !run.live) return;
      var rng = run.streams.horn;
      var roll = rng.next();                    // drawn first, unconditionally
      var mul = HORN_SCENE_MUL[curSceneType()];
      if (mul == null) mul = 1;
      if (mul <= 0) return;
      // rc.32: the roster rests the horn in the gathering and the circling.
      // A boundary answer is judged by the scene it LANDS in — an arrival
      // into the circling must not put the treeline in a scene that rests it.
      if (!rosterAllows("horn", col) || isAbsent("horn")) return;
      if (inHush(t)) return;
      if (run.cut && !run.cut.fired && t > run.cut.tB - 4) return;
      var iv = curIntensity(t);
      if (iv < 0.12) return;
      if (t < run.hornHoldUntil) return;
      var poseMul = (poseName === "sting" || poseName === "hollow") ? 1.3 : 1;
      var x = clamp((iv - 0.12) / 0.3, 0, 1);
      // rc.37: presence multiplies the chance — the treeline answers less
      // often, and the rests it leaves are longer (see hornCall).
      if (roll >= Math.min(1, (HORN_CHANCE[kind] || 0.3) * mul * poseMul *
                              (0.25 + 0.75 * x) * presK("horn"))) return;
      hornCall(t);
    }

    // The afterimage's far final call — at most one per evening, drawn at
    // the scene's entry, sounded only after the cut's hush AND return have
    // fully passed (the residue answers the noticing, it never interrupts
    // it), quiet (vel 0.7) and on the root: residue, not resolution.
    function hornFinalCall(evt) {
      if (!run || !run.live) return;
      var rng = run.streams.horn;
      var roll = rng.next();                    // drawn first, unconditionally
      var wait = rng.rnd(8, 20);
      var durS = rng.rnd(16, 26);
      var rest = rng.rnd(6, 14);
      if (run.hornFinalDone) return;
      // rc.32 (ticked today); rc.37: the far call is a SIGNATURE — the
      // evening's last word — so presence never thins it, but an absent horn
      // is absent all evening, this call included.
      if (!rosterAllows("horn", "afterimage") || isAbsent("horn")) return;
      if (roll >= 0.6) return;
      run.hornFinalDone = true;
      var t0 = evt.t + wait;
      if (run.cut) t0 = Math.max(t0, run.cut.end + run.cut.retS + 2);
      run.clock.lane("horn").at(t0, function (t) {
        if (!run || !run.live || inHush(t)) return;
        if (isAbsent("horn")) return;      // rc.37: the seam may have moved
        if (t < run.hornHoldUntil) return;
        renderHornTone(0, t, durS, 0.7, "far-call");
        run.hornHoldUntil = t + durS + rest;
      });
    }

    // ========================================================================
    // rc.32 — THE FIVE AUDITIONED VOICES (PLAN-SOUND-DIVERSITY §5.2)
    //
    // Ported faithfully from the owner-approved prototypes on
    // lab-sycorax.html (2026-09-03) onto the engine's discipline. Every one
    // of them:
    //   - draws on its OWN label-hashed fork, so no pre-existing stream
    //     gains or loses a draw;
    //   - rolls FIRST and unconditionally at every opportunity, then gates
    //     (the roster, the cut law, the hold law, the scene multiplier);
    //   - reads the POSE and the FIELD at schedule time (era-aware through
    //     the sink) — no cached Hz, ever;
    //   - envelopes through PJ2.Voice.env or an anchored setValue/ramp pair,
    //     never setTargetAtTime;
    //   - claims the budget AFTER its draws, so a refusal is silence and
    //     never a shifted stream;
    //   - hangs on ONE unity gate gain the cut can ride to zero at tB;
    //   - NEVER claims the air. Not one of them is a speaker.
    // Every timbral constant is a desk knob read through pVal, with the
    // knob's default equal to the constant the owner left on the page.
    // ========================================================================

    // ---- the bullroarer (landscape — THE RITE'S OWN MACHINE) ----------------
    // A whirled slat on a cord: a sawtooth at the pose root two or three
    // octaves down, through a lowpass the DARKNESS knob closes, amplitude-
    // modulated at the WHIRL rate by an LFO whose own rate is bent ±40 % by a
    // slower SWING — the arm's circle — which also dopplers the pitch and
    // rides a band of air along with it. Swells in and out over tens of
    // seconds. Peak 0.025 (+ 0.0125 of air) into cutGain, so the cut ducks it
    // with the rest of the landscape AND ends it at tB. Nothing else in this
    // engine is iterative like this; it is the plan's F3 gap, filled.
    var BULL_SCENE = {
      "gathering": 0, "processional": 1.2, "circling": 0,
      "invocation": 1.25, "afterimage": 0,
    };
    var BULL_CHANCE = { pose: 0.4, arrival: 0.6 };
    var BULL_PEAK = 0.025;

    function renderBullroarer(t, why) {
      var rng = run.streams.bullroarer;
      // Draw everything FIRST so a budget refusal can't shift the stream.
      var hold = rng.rnd(1, 4);
      var restS = rng.rnd(8, 20);
      // rc.35: every throw its own. swell/whirl/swing/air are TOUCH;
      // darkness, doppler and the register are the evening's (CHARACTER) —
      // landscape follows the rite, not the dice.
      var swell = wTouch("bullroarer", "swell");
      var durS = swell * 2 + hold;
      var airK = wTouch("bullroarer", "air");
      if (cutBlocks(t)) return false;          // the law, checked again at the body
      // 10 nodes for the machine (gate, spin gain, whirl osc + depth, swing
      // osc + its bend, the saw, its doppler, the lowpass, the envelope),
      // 3 more for the band of air.
      var tok = run.budget.claim(airK > 0 ? 13 : 10, t + durS + 0.5);
      if (!tok) return false;
      run.tokens.push(tok);
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var deg = (ch && ch.chordDegs && ch.chordDegs.length) ? ch.chordDegs[0] : 0;
      var oct = Math.round(wChar("bullroarer", "register")); // −3 or −2, weighted .7/.3
      var freq = run.field.degFreq(deg, oct);                 // AT SCHEDULE TIME
      var whirlHz = wTouch("bullroarer", "whirl");
      var swingHz = wTouch("bullroarer", "swing");
      var vk = varyK("bullroarer");
      var c = ctx;

      // the gate the cut rides to zero (unity, one per gesture)
      var gate = c.createGain();
      gate.gain.setValueAtTime(1, t);
      gate.connect(run.layBull);

      // THE SPIN: one amplitude-modulating gain everything rides. Base 0.55,
      // the whirl LFO ±0.45 — deep enough to be a whir, never a hard zero.
      var am = c.createGain();
      am.gain.setValueAtTime(0.55, t);
      am.connect(gate);
      var whirl = c.createOscillator();
      whirl.type = "sine";
      // BODY RULE (rc.35, plan §11.2): THE SLAT GATHERS. The spin starts at
      // ×0.7 and reaches the drawn rate over the rise — a thing on a cord
      // does not begin at speed. Scaled by `vary`, so vary 0 starts where it
      // always did; an anchored setValue/ramp pair, never a bare ramp.
      whirl.frequency.setValueAtTime(whirlHz * (1 - 0.3 * vk), t);
      whirl.frequency.linearRampToValueAtTime(whirlHz, t + swell);
      var whirlD = c.createGain();
      whirlD.gain.setValueAtTime(0.45, t);
      whirl.connect(whirlD);
      try { whirlD.connect(am.gain); } catch (e0) {}
      whirl.start(t); whirl.stop(t + durS + 0.3);

      // THE SWING: the arm's slower circle. It bends the whirl RATE ±40 %,
      // which is the difference between a tremolo and a thing on a cord.
      var swing = c.createOscillator();
      swing.type = "sine";
      swing.frequency.setValueAtTime(swingHz, t);
      var sw2wh = c.createGain();
      sw2wh.gain.setValueAtTime(whirlHz * 0.4, t);
      swing.connect(sw2wh);
      try { sw2wh.connect(whirl.frequency); } catch (e1) {}
      swing.start(t); swing.stop(t + durS + 0.3);

      var o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      var dop = wChar("bullroarer", "doppler");   // physical; a nightly shade
      if (dop > 0) {
        var dg = c.createGain();
        dg.gain.setValueAtTime(freq * dop / 100, t);   // the knob is a percentage
        swing.connect(dg);
        try { dg.connect(o.frequency); } catch (e2) {}
      }
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      // 400 Hz at the default darkness 0.5; darker closes it, brighter opens.
      // BODY RULE (rc.35, plan §11.2): the INVOCATION is darker by 0.15 —
      // a scene rule, not a draw — scaled by `vary` and clamped to the
      // knob's own [0, 1] so the lowpass can never invert.
      var dark = clamp(wChar("bullroarer", "darkness") +
                       (curSceneType() === "invocation" ? 0.15 * vk : 0), 0, 1);
      lp.frequency.setValueAtTime(Math.max(90, 400 * (1.5 - dark)), t);
      lp.Q.setValueAtTime(0.6, t);
      var g = c.createGain();
      PJ2.Voice.env(g.gain, t, [[swell, BULL_PEAK], [hold, BULL_PEAK], [swell, 0]]);
      o.connect(lp); lp.connect(g); g.connect(am);
      o.start(t); o.stop(t + durS + 0.3);

      // the band of air the slat drags with it — modulated the same way
      if (airK > 0) {
        var nz = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(350, t);           // the plan's 200–600 Hz band
        bp.Q.setValueAtTime(1.2, t);
        var ag = c.createGain();
        var aPeak = BULL_PEAK * 0.5 * airK;
        PJ2.Voice.env(ag.gain, t, [[swell, aPeak], [hold, aPeak], [swell, 0]]);
        nz.connect(bp); bp.connect(ag); ag.connect(am);
        nz.start(t, nz.randomOffset); nz.stop(t + durS + 0.3);
      }

      nvRegister("bullroarer", gate, t + durS + 0.3);
      run.bullHoldUntil = t + durS + restS * restK("bullroarer");  // the hold law: one slat at a time
      emitNote({
        voice: "bullroarer", kind: why, freq: freq, t: t, durS: durS,
        deg: deg, oct: oct, whirlHz: whirlHz,
      });
      return true;
    }

    // One opportunity, one decision. The roll is drawn FIRST and
    // unconditionally; every gate comes after.
    function bullConsider(kind, t, col) {
      if (!run || !run.live) return;
      var roll = run.streams.bullroarer.next();
      var sc = col || curSceneType();          // an arrival is judged by where it LANDS
      var mul = BULL_SCENE[sc];
      if (!mul) return;
      if (!rosterAllows("bullroarer", sc) || isAbsent("bullroarer")) return;
      if (inHush(t) || cutBlocks(t)) return;             // the cut law, at the brain
      if (t < run.bullHoldUntil) return;                 // the hold law
      var base = (BULL_CHANCE[kind] || 0) * mul * pVal("bullroarer", "presence");
      if (roll >= clamp(base, 0, 1)) return;
      renderBullroarer(t, kind);
    }

    // ---- the overtone chant (landscape — THE CANTOR'S SECOND MANNER) --------
    // A held fundamental at the pose root, oct −1 (the chant's own pair: a
    // sawtooth at −4 cents and a little square at +5, with its breath
    // thread), while ONE narrow bandpass STEPS through the harmonic series —
    // a melody made of overtones above a tone that never moves. The steps are
    // anchored setValueAtTime jumps, never a glide: an overtone singer's
    // mouth JUMPS between harmonics.
    //
    // DEPARTURE FROM §5.2, disclosed: the plan imagined folding this into the
    // chant as a cast-drawn manner. It is built here as its OWN layer, fork
    // and mixer row instead — mixable and tunable beside the chant, and free
    // of the chant's air claim (this manner is landscape: it never speaks a
    // motif and never takes a seat in the parliament). Folding it into the
    // cantor is a later phase's move, and the cast that would draw it is not
    // in this round's scope at all.
    var OVER_SCENE = {
      "gathering": 0, "processional": 1, "circling": 0,
      "invocation": 1, "afterimage": 0,
    };
    var OVER_CHANCE = 0.4;    // pose turns only — never on an arrival
    var OVER_PEAK = 0.03;     // pre-formant, where the engine's chant puts its own

    function renderOvertone(t, why) {
      var rng = run.streams.overtone;
      // Draws FIRST: the harmonic walk is the whole melody, so it is drawn
      // in full before a single node is asked for.
      // rc.35: the utterance draws its own floor and ceiling (some stay low,
      // some climb), its own breath, and a fresh STEP for every step. At
      // vary 1 the spans keep hi > lo + 2 by construction (hi ≥ 8, lo ≤ 5);
      // past that the body's own hi ≥ lo + 1 guard, below, is the floor.
      var lo = Math.round(wTouch("overtone", "lo"));
      var hi = Math.round(wTouch("overtone", "hi"));
      if (hi < lo + 1) hi = lo + 1;
      var durS = wTouch("overtone", "hold");
      var vk = varyK("overtone");
      var n = rng.rint(lo, hi);
      var path = [], tS = 0, guard = 0;
      while (tS < durS && guard++ < 200) {
        path.push({ n: n, dt: tS });
        var jump = rng.chance(0.75) ? 1 : 2;             // mostly a neighbour
        var dir = rng.chance(0.5) ? -1 : 1;
        var next = n + dir * jump;
        if (next > hi) next = n - jump;                  // reflect off the ceiling
        if (next < lo) next = n + jump;                  // and off the floor
        // BODY RULE (rc.35, plan §11.2): LONGER ON THE HIGHER HARMONICS. The
        // mouth has further to travel and less to hold onto up there, so the
        // step stretches up to +35 % across the walk's own range. Scaled by
        // `vary`; at vary 0 the drawn step IS the knob and the factor is 1.
        var climb = (n - lo) / Math.max(1, hi - lo);
        tS += wTouch("overtone", "step") * (1 + 0.35 * climb * vk);
        n = clamp(next, lo, hi);
      }
      var restS = rng.rnd(8, 18);
      if (cutBlocks(t)) return false;          // the law, checked again at the body
      // 12 nodes: gate, the saw + square + its trim, the breath + its trim,
      // the pre-mix, the body share, the mouth, its makeup, the mix and the
      // envelope.
      var tok = run.budget.claim(12, t + durS + 0.5);
      if (!tok) return false;
      run.tokens.push(tok);
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var deg = (ch && ch.chordDegs && ch.chordDegs.length) ? ch.chordDegs[0] : 0;
      var freq = run.field.degFreq(deg, -1);             // AT SCHEDULE TIME
      var wx = wxAt(t);
      var c = ctx;

      var gate = c.createGain();
      gate.gain.setValueAtTime(1, t);
      gate.connect(run.layOver);

      var pre = c.createGain();
      pre.gain.setValueAtTime(1, t);
      var o1 = c.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(freq, t);
      o1.detune.setValueAtTime(-4, t);
      o1.connect(pre);
      var o2 = c.createOscillator();
      o2.type = "square";
      o2.frequency.setValueAtTime(freq, t);
      o2.detune.setValueAtTime(5, t);
      var o2g = c.createGain();
      o2g.gain.setValueAtTime(0.35, t);                  // the square is colour, not body
      o2.connect(o2g); o2g.connect(pre);
      var br = PJ2.Voice.noiseBuffer.source(c, 30);
      var brg = c.createGain();
      brg.gain.setValueAtTime(0.010 + 0.014 * wx.breath, t);  // the chant's own breath
      br.connect(brg); brg.connect(pre);

      var mix = c.createGain();
      mix.gain.setValueAtTime(1, t);
      var bodyG = c.createGain();
      bodyG.gain.setValueAtTime(0.30 * wTouch("overtone", "body"), t);
      pre.connect(bodyG); bodyG.connect(mix);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.setValueAtTime(wChar("overtone", "q"), t);   // a narrower mouth some nights
      var sweepG = c.createGain();
      sweepG.gain.setValueAtTime(2.5, t);                // makeup for a narrow band
      pre.connect(bp); bp.connect(sweepG); sweepG.connect(mix);

      var env = c.createGain();
      mix.connect(env); env.connect(gate);
      var atk = Math.min(1.6, durS * 0.38);
      var rel = Math.min(1.4, durS * 0.34);
      if (atk + rel > durS - 0.05) { atk = durS * 0.42; rel = durS * 0.42; }
      PJ2.Voice.env(env.gain, t, [[atk, OVER_PEAK],
                                  [Math.max(0.02, durS - atk - rel), OVER_PEAK * 0.94],
                                  [rel, 0]]);
      // the walk, written as anchored jumps (never a glide, never a target)
      var shown = [];
      for (var i = 0; i < path.length; i++) {
        bp.frequency.setValueAtTime(freq * path[i].n, t + path[i].dt);
        if (i < 10) shown.push(path[i].n);
      }
      o1.start(t); o1.stop(t + durS + 0.1);
      o2.start(t); o2.stop(t + durS + 0.1);
      br.start(t, br.randomOffset); br.stop(t + durS + 0.1);

      nvRegister("overtone", gate, t + durS + 0.1);
      run.overHoldUntil = t + durS + restS * restK("overtone");   // the hold law
      emitNote({
        voice: "overtone", kind: "overtone", freq: freq, t: t, durS: durS,
        deg: deg, oct: -1, via: why,
        path: shown.join("→") + (path.length > 10 ? "→…" : ""),
      });
      return true;
    }

    function overConsider(kind, t, col) {
      if (!run || !run.live) return;
      var roll = run.streams.overtone.next();
      if (kind !== "pose") return;                       // the plan's law: pose turns only
      var sc = col || curSceneType();
      var mul = OVER_SCENE[sc];
      if (!mul) return;
      if (!rosterAllows("overtone", sc) || isAbsent("overtone")) return;
      if (inHush(t) || cutBlocks(t)) return;
      if (t < run.overHoldUntil) return;
      if (roll >= clamp(OVER_CHANCE * mul * pVal("overtone", "presence"), 0, 1)) return;
      renderOvertone(t, kind);
    }

    // ---- the jaw harp (plucked — A MOUTH THAT MOVES) ------------------------
    // Nothing in Sycorax is plucked. A short noise burst into a feedback comb
    // (delay 1/f → lowpass → feedback) gives the tongue; the MOUTH — a
    // bandpass swept lo → hi on every twang with an anchored ramp pair —
    // gives the melody, which is made of FORMANTS, not pitches. Three gaps at
    // once (plucked, iterative, formant-melodic); the circling is its scene.
    //
    // THE LOOP-GAIN LESSON (pj2-fx.js's first law): the worst-case loop gain
    // is feedback × max|H(f)| of the filter inside the loop, and a WebAudio
    // lowpass's Q is in DECIBELS — at Q = −6 dB the response has no peak at
    // all, so the printed "sustain" IS the loop gain and 0.97 means 0.97. The
    // feedback gain is also ramped to zero at the twang's own T60, so no comb
    // can outlive its note, and every node in the cycle is disconnected when
    // the note is swept.
    //
    // THE DELAY CLAMP: WebAudio pins a DelayNode inside a cycle to at least
    // one render quantum (128 frames ≈ 2.9 ms ≈ 344 Hz at 44.1 kHz), so the
    // comb's pitch must stay BELOW ~340 Hz or the twang loses it. The pose
    // root at oct −1 is 155–295 Hz — comfortably under — and the assert below
    // drops another octave if a field ever pushed it over 330.
    var JAW_CHANCE = 0.35;    // circling only, on pose turns
    var JAW_PEAK = 0.02;
    var JAW_MAKEUP = 6;       // the formant-loss makeup, INSIDE the accounting

    function jawTwang(t, freq, gate, mouthLo, mouthHi, sweepS, sus) {
      var c = ctx;
      var sr = c.sampleRate || 44100;
      var tok = run.budget.claim(8, t + 4.2);
      if (!tok) return 0;                                // graceful thinning: no twang
      run.tokens.push(tok);
      var dt = Math.max(128 / sr, 1 / freq);
      var dl = c.createDelay(0.25);
      dl.delayTime.setValueAtTime(dt, t);
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3000, t);
      lp.Q.setValueAtTime(-6, t);                        // dB — flat, so fb IS the loop gain
      var fb = c.createGain();
      fb.gain.setValueAtTime(sus, t);
      dl.connect(lp); lp.connect(fb); fb.connect(dl);

      // the tongue: 8 ms of noise, enveloped so the burst itself never clicks
      var n = Math.max(2, Math.round(sr * 0.008));
      var buf = c.createBuffer(1, n, sr);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;   // texture, not music
      var src = c.createBufferSource();
      src.buffer = buf;
      var burst = c.createGain();
      PJ2.Voice.env(burst.gain, t, [[0.001, 1], [0.007, 0]]);
      src.connect(burst); burst.connect(dl);
      src.start(t); src.stop(t + 0.03);

      // the mouth — the whole point of a jaw harp
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(mouthLo, t);
      bp.frequency.linearRampToValueAtTime(mouthHi, t + sweepS);   // anchored pair
      bp.Q.setValueAtTime(4, t);
      // the comb's own T60, so the twang is FINITE
      var t60 = dt * 60 / Math.max(0.5, -20 * Math.log(Math.max(0.05, sus)) / Math.LN10);
      var ring = clamp(t60, 0.35, 3.5);
      // THE MAKEUP goes through the accounting, not around it: a Q-4 band a
      // decade wide throws ~28 dB away, so the chain ASKS for 6 × 0.02 =
      // 0.12 even though the measured output is the quietest of the five.
      // The family's own practice (the engine's chant carries "peak 0.032
      // pre-formant-loss compensation" for the same reason). It sits OUTSIDE
      // the feedback loop, so it cannot touch the loop gain.
      var makeup = c.createGain();
      makeup.gain.setValueAtTime(JAW_MAKEUP, t);
      var g = c.createGain();
      PJ2.Voice.env(g.gain, t, [[0.006, JAW_PEAK], [ring * 0.7, JAW_PEAK * 0.25], [ring * 0.3, 0]]);
      dl.connect(bp); bp.connect(makeup); makeup.connect(g); g.connect(gate);
      // and the loop is closed off after the note, an anchored pair, never a
      // bare cancel: nothing may still be circulating when the note is over
      fb.gain.setValueAtTime(sus, t + ring);
      fb.gain.linearRampToValueAtTime(0, t + ring + 0.25);
      // THE TEARDOWN. Every other body in this engine is left to the
      // collector: its sources stop, nothing is reachable, it goes. A
      // FEEDBACK CYCLE does not go — a DelayNode feeding its own input keeps
      // the whole ring alive whatever its gain has been ramped to, and the
      // ring still has a path to the destination through the mouth. So this
      // one voice is disconnected by hand, on its own lane, once the twang
      // has finished ringing (the lab page's rule, brought over intact).
      run.clock.lane("jawharp").at(t + ring + 0.6, function () {
        var n = [dl, lp, fb, bp, makeup, g, burst, src];
        for (var i = 0; i < n.length; i++) { try { n[i].disconnect(); } catch (e) {} }
      });
      return t + ring + 0.35;
    }

    function renderJawharp(t, why) {
      var rng = run.streams.jawharp;
      // Draws FIRST: how many twangs, and every gap between them.
      // rc.35: how many twangs is a WEIGHTED draw (1 .1 · 2 .3 · 3 .35 ·
      // 4 .2 · 5 .05) — three every time was the tic. A moved knob is the
      // owner's word and wins, exactly as the helper promises.
      // rc.44 - THE PLACEMENT, ONE DRAW FOR THE UTTERANCE. The owner:
      // "expand the octave range so it can go from the zero all the way down
      // to negative two." Every twang of an utterance sounds at the one
      // placement (a player does not change instrument mid-phrase), and the
      // three are equally likely. Rounded and clamped like the bullroarer's:
      // a weighted def hands back the KNOB at vary 0, and a knob sitting
      // between two octaves is no octave at all.
      var jawReg = Math.round(clamp(wTouch("jawharp", "register"), -2, 0));
      var nT = Math.max(1, Math.round(wTouch("jawharp", "twangs")));
      var jit = [];
      for (var j = 0; j < nT; j++) jit.push(rng.rnd(0.6, 1.4));   // the ±40 %
      var restS = rng.rnd(6, 16);
      if (cutBlocks(t)) return false;          // the law, checked again at the body
      var gapS = pVal("jawharp", "gap");
      var ch = null;
      try { ch = run.harmony.current(); } catch (e) {}
      var deg = (ch && ch.chordDegs && ch.chordDegs.length) ? ch.chordDegs[0] : 0;
      var oct = -1 + jawReg;                             // -1, -2 or -3
      var freq = run.field.degFreq(deg, oct);            // AT SCHEDULE TIME
      // THE ASSERT: a comb above the render quantum's clamp is a comb with no
      // pitch. The rite's root is pinned to i and the sink only ever lowers
      // the field, so this can never fire today — which is exactly when an
      // assert is cheap. rc.44 widened the range DOWNWARD, which is the safe
      // direction for a comb (a lower pitch is a longer delay, further from
      // the clamp), so the assert can only get easier; it still lowers by one
      // octave from wherever the draw put the harp.
      if (freq > 330) { oct -= 1; freq = run.field.degFreq(deg, oct); }
      var c = ctx;
      var gate = c.createGain();
      gate.gain.setValueAtTime(1, t);
      gate.connect(run.layJaw);
      // the tongue's ring, one draw for the utterance (the plan's "per
      // sounding"); the mouth is drawn PER TWANG below — ee, oo, ah.
      var sus = clamp(wTouch("jawharp", "sustain"), 0, 0.97);
      var vk = varyK("jawharp");
      var tw = t, last = t, sounded = 0;
      for (j = 0; j < nT; j++) {
        var mlo = wTouch("jawharp", "mlo"), mhi = wTouch("jawharp", "mhi");
        var sweepS = wTouch("jawharp", "sweep");
        // BODY RULE (rc.35, plan §11.2): ONE IN THREE SWEEPS DOWNWARD — the
        // mouth closing instead of opening, a different vowel each time. The
        // coin is on the wander's OWN body fork, so no pre-existing stream
        // moves; the chance is scaled by `vary`, so vary 0 never turns.
        var jb = wBody("jawharp");
        var down = jb ? jb.chance(vk / 3) : false;
        var e = down ? jawTwang(tw, freq, gate, mhi, mlo, sweepS, sus)
                     : jawTwang(tw, freq, gate, mlo, mhi, sweepS, sus);
        if (e > 0) { sounded++; if (e > last) last = e; }
        tw += gapS * jit[j];
      }
      if (!sounded) return false;                        // the budget said no
      var durS = Math.max(last, tw) - t;
      run.clock.lane("jawharp").at(t + durS + 0.8, function () {
        try { gate.disconnect(); } catch (e) {}          // …and the gate with it
      });
      nvRegister("jawharp", gate, t + durS + 0.2);
      run.jawHoldUntil = t + durS + restS * restK("jawharp");     // the hold law
      emitNote({
        voice: "jawharp", kind: "twang", freq: freq, t: t, durS: durS,
        deg: deg, oct: oct, twangs: sounded, via: why,
      });
      return true;
    }

    function jawConsider(kind, t, col) {
      if (!run || !run.live) return;
      var roll = run.streams.jawharp.next();
      if (kind !== "pose") return;
      var sc = col || curSceneType();
      if (sc !== "circling") return;                     // circling only
      if (!rosterAllows("jawharp", sc) || isAbsent("jawharp")) return;
      if (inHush(t) || cutBlocks(t)) return;
      if (t < run.jawHoldUntil) return;
      if (roll >= clamp(JAW_CHANCE * pVal("jawharp", "presence"), 0, 1)) return;
      renderJawharp(t, kind);
    }

    // ---- the bowed blade (landscape — THE ONE HIGH SUSTAINED SOUND) ---------
    // Two sines at an inharmonic ratio, a slow wobble on each, and a band of
    // bow friction at the fundamental. Whisper level (0.008) and the CAVERN
    // only: far and faint is the whole design, because the risk this voice
    // carries is startle. It takes the wide room's send and the seasick delay
    // wall — and nothing else. It is the ONE voice in this engine not
    // registered with roomBlend: the close fireside stone would put it in the
    // room with the listener, which is exactly what it must never be.
    //
    // Its pitch knob is in Hz (the plan's design: 1.2–2.5 kHz, no degree
    // means "a bowed blade"), but the knob is SNAPPED to the live field at
    // schedule time, so the blade sinks with the rite like everything else
    // and the engine's 100 %-adherence law still reads it.
    var BLADE_CHANCE = 0.3;
    var BLADE_PEAK = 0.008;

    function renderBlade(t, why) {
      var rng = run.streams.blade;
      // Draws FIRST.
      var hold = rng.rnd(2, 6);
      var restS = rng.rnd(20, 45);
      // …the manner among them, on the stop's own fork, one coin per sounding.
      var whaleRoll = run.streams.bladeWhale.next();
      var isWhale = whaleRoll < shareOf("blade", "whale", "whale");
      // rc.35: the swell and the pitch are drawn per SOUNDING; the pitch's
      // centre is shifted per EVENING by pitchNight, and the blade's own
      // inharmonicity (ratio) is the evening's too — one blade per night.
      var sw = wTouch("blade", "swell");
      var durS = sw * 2 + hold;
      var friction = wTouch("blade", "friction");
      var ratio = wChar("blade", "ratio");
      if (cutBlocks(t)) return false;          // the law, checked again at the body
      var tok = run.budget.claim(friction > 0 ? 13 : 10, t + durS + 0.5);
      if (!tok) return false;
      run.tokens.push(tok);
      var snap = null;
      try {
        snap = run.field.snapInfo(wTouch("blade", "pitch") * wChar("blade", "pitchNight"));
      } catch (e) { snap = null; }
      var deg = snap ? snap.deg : 0, oct = snap ? snap.oct : 2;
      var f1 = run.field.degFreq(deg, oct);              // AT SCHEDULE TIME
      var f2 = f1 * ratio;
      var c = ctx;
      var gate = c.createGain();
      gate.gain.setValueAtTime(1, t);
      gate.connect(run.layBlade);
      if (isWhale) {
        // ---- THE WHALE (rc.44, lab-sycorax.html's blade variant B) --------
        // A far, slow song under the water. TWO OCTAVES below the blade's
        // 1.2-2.5 kHz - that transposition IS the class change, whales do
        // not sing in the treble - gliding up over the first third and
        // sagging back through a 900 Hz lid, with the sea's own slow wow on
        // every partial and the water itself underneath.
        //
        // It hangs off the SAME gate as the blade, so the cut's kill at tB
        // takes the whale's long sag exactly as it takes the blade's swell,
        // and it takes the wide room and the delay wall and nothing else.
        // Of the blade's wanders it inherits the SWELL (its own edges) and
        // the PITCH and PITCHNIGHT that chose f1; `ratio` shapes a second
        // inharmonic sine this body does not have and `friction` a bow band
        // the water replaces, so both are drawn above and spent on nothing.
        var stopAtW = t + durS + 0.3;
        var glide = clamp(wTouch("blade", "glide"), 0, 14);   // semitones
        var base = f1 * 0.25;
        var up = base * Math.pow(2, glide / 12);
        var gW = envGain();
        var lid = c.createBiquadFilter();
        lid.type = "lowpass";
        lid.frequency.setValueAtTime(900, t);
        lid.Q.setValueAtTime(1.1, t);
        gW.connect(lid); lid.connect(gate);
        var pkW = BLADE_PEAK * MATCH_BLADE_WHALE;
        PJ2.Voice.env(gW.gain, t, [[sw, pkW], [hold, pkW * 0.95], [sw, 0]]);
        for (var wi = 0; wi < WHALE_PARTIALS.length; wi++) {
          var wr = WHALE_PARTIALS[wi][0];
          var ow = c.createOscillator();
          ow.type = "sine";
          ow.frequency.setValueAtTime(base * wr, t);
          ow.frequency.exponentialRampToValueAtTime(up * wr, t + durS * 0.32);
          ow.frequency.exponentialRampToValueAtTime(up * wr * 0.97, t + durS * 0.62);
          ow.frequency.exponentialRampToValueAtTime(base * wr * 0.87, t + durS);
          var owg = c.createGain();
          owg.gain.setValueAtTime(WHALE_PARTIALS[wi][1], t);
          ow.connect(owg); owg.connect(gW);
          ow.start(t); ow.stop(stopAtW);
          var wn = slowNoise(c, 0.18);
          var wng = c.createGain();
          wng.gain.setValueAtTime(base * wr * 0.006, t);
          wn.connect(wng);
          try { wng.connect(ow.frequency); } catch (eW0) {}
          wn.start(t, wn.randomOffset); wn.stop(stopAtW);
        }
        // the water itself
        var nzW = PJ2.Voice.noiseBuffer.source(c, 30);
        var bqW = c.createBiquadFilter();
        bqW.type = "lowpass";
        bqW.frequency.setValueAtTime(300, t);
        bqW.Q.setValueAtTime(0.7, t);
        var ngW = envGain();
        nzW.connect(bqW); bqW.connect(ngW); ngW.connect(lid);
        PJ2.Voice.env(ngW.gain, t, [[sw, pkW * 0.2], [hold, pkW * 0.16], [sw, 0]]);
        nzW.start(t, nzW.randomOffset); nzW.stop(stopAtW);
        nvRegister("blade", gate, t + durS + 0.3);
        run.bladeHoldUntil = t + durS + restS * restK("blade");   // the hold law
        emitNote({
          voice: "blade", kind: why, freq: f1, t: t, durS: durS,
          deg: deg, oct: oct, ratio: ratio, manner: "whale",
        });
        return true;
      }
      var g = c.createGain();
      PJ2.Voice.env(g.gain, t, [[sw, BLADE_PEAK], [hold, BLADE_PEAK * 0.95], [sw, 0]]);
      g.connect(gate);
      var pair = [f1, f2];
      for (var i = 0; i < 2; i++) {
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(pair[i], t);
        var og = c.createGain();
        og.gain.setValueAtTime(i ? 0.6 : 1, t);
        o.connect(og); og.connect(g);
        o.start(t); o.stop(t + durS + 0.3);
        // the wobble: a bowed blade never holds still
        var wn = slowNoise(c, 0.35);
        var wg = c.createGain();
        wg.gain.setValueAtTime(pair[i] * 0.004, t);
        wn.connect(wg);
        try { wg.connect(o.frequency); } catch (e0) {}
        wn.start(t, wn.randomOffset); wn.stop(t + durS + 0.3);
      }
      if (friction > 0) {
        var nz = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(f1, t);
        bp.Q.setValueAtTime(12, t);
        var fg = c.createGain();
        // BODY RULE (rc.35, plan §11.2): THE PRESSURE WANDERS INSIDE THE
        // SWELL. Two more grips are drawn — one at the half-rise, one
        // through the hold — and the envelope is split at the halfway
        // waypoint so the bow leans and eases as it crosses. At vary 0 all
        // three draws are the knob and the waypoint sits exactly on the old
        // straight line (0.5·peak at sw/2), so the shape is unchanged.
        var fMid = BLADE_PEAK * 0.5 * wTouch("blade", "friction");
        var fTop = BLADE_PEAK * 0.5 * wTouch("blade", "friction");
        var fPeak = BLADE_PEAK * 0.5 * friction;
        PJ2.Voice.env(fg.gain, t, [[sw * 0.5, fMid * 0.5], [sw * 0.5, fTop],
                                   [hold, fPeak], [sw, 0]]);
        nz.connect(bp); bp.connect(fg); fg.connect(gate);
        nz.start(t, nz.randomOffset); nz.stop(t + durS + 0.3);
      }
      nvRegister("blade", gate, t + durS + 0.3);
      run.bladeHoldUntil = t + durS + restS * restK("blade");     // the hold law
      emitNote({
        voice: "blade", kind: why, freq: f1, t: t, durS: durS,
        deg: deg, oct: oct, ratio: ratio, manner: "blade",
      });
      return true;
    }

    function bladeConsider(kind, t, col) {
      if (!run || !run.live) return;
      var roll = run.streams.blade.next();
      var st = col || curSceneType();
      if (st !== "invocation" && st !== "afterimage") return;
      // In the afterimage the blade may only answer once the cut's return has
      // FULLY passed — the residue does not interrupt the noticing.
      if (st === "afterimage" && !cutPast(t)) return;
      if (!rosterAllows("blade", st) || isAbsent("blade")) return;
      if (inHush(t) || cutBlocks(t)) return;
      if (t < run.bladeHoldUntil) return;
      if (roll >= clamp(BLADE_CHANCE * pVal("blade", "presence"), 0, 1)) return;
      renderBlade(t, kind);
    }

    // The blade's own clock inside its scenes: an opportunity every 25–45 s,
    // so it can speak in an invocation where the ground never turns.
    function startBlade() {
      var lane = run.clock.lane("blade");
      var rng = run.streams.blade;
      function timer(t) {
        var wait = rng.rnd(25, 45);                      // drawn first, always
        bladeConsider("timer", t);                       // …and the roll too: the
        lane.at(t + wait, timer);                        // scene gate comes after
      }
      lane.at(run.t0 + rng.rnd(25, 45), timer);
    }

    // ---- the cauldron (ambient — THE SPELL'S POT) ---------------------------
    // A one-shot for the pool, not a speaker: a soft low wash (noise between
    // 80 and 200 Hz, × wash) with pitched pops rising out of it — sine
    // glisses plo → phi over 60 ms at pops/s with half the gap jittered away.
    // v1 had a cauldron and Phase 3 dropped it as a comedy risk; this one is
    // the dark version — a simmer, not a bubble-bath — and it earns its own
    // mixer row so the owner can mix the pot apart from the sky.
    //
    // It fires on its OWN clock (40–120 s ÷ presence: presence rides the
    // timer here, not the draw) in the gathering, the circling and the
    // invocation, and never in the hush.
    var CAULD_SCENES = { "gathering": 1, "circling": 1, "invocation": 1 };
    var CAULD_PEAK = 0.02;
    var CAULD_MAX_POPS = 12;   // one simmer may never eat the budget

    function renderCauldron(t, why) {
      var rng = run.streams.cauldron;
      // Draws FIRST — every pop's placement, before a node is asked for.
      // rc.35: length, busyness and wash are drawn per SIMMER; the pops'
      // pitches and lengths per POP, below.
      var len = wTouch("cauldron", "length");
      var gap = 1 / Math.max(0.1, wTouch("cauldron", "pops"));
      var vk = varyK("cauldron");
      var pops = [], tp = t + rng.rnd(0.05, gap), guard = 0;
      while (tp < t + len && guard++ < 120) {
        pops.push(tp);
        // BODY RULE (rc.35, plan §11.2): BUILD, THEN SETTLE. The gaps close
        // by up to 30 % toward the middle of the simmer and open again — a
        // pot coming to the boil and easing off, not a metronome of bubbles.
        // The ±50 % per-pop jitter stays exactly as it was; the contour is
        // scaled by `vary`, so vary 0 places every pop where it always did.
        var u = clamp((tp - t) / Math.max(0.1, len), 0, 1);
        tp += gap * rng.rnd(0.5, 1.5) * (1 - 0.3 * vk * Math.sin(Math.PI * u));
      }
      var restS = rng.rnd(4, 10);
      var nPop = Math.min(pops.length, CAULD_MAX_POPS);
      if (cutBlocks(t)) return false;          // the law, checked again at the body
      var wash = wTouch("cauldron", "wash");
      var tok = run.budget.claim(1 + (wash > 0 ? 4 : 0) + 2 * nPop, t + len + 0.6);
      if (!tok) return false;
      run.tokens.push(tok);
      var c = ctx;
      var gate = c.createGain();
      gate.gain.setValueAtTime(1, t);
      gate.connect(run.layCauldron);
      if (wash > 0) {
        var nz = PJ2.Voice.noiseBuffer.source(c, 30);
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(80, t);
        hp.Q.setValueAtTime(0.7, t);
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(200, t);
        lp.Q.setValueAtTime(0.7, t);
        var wg = c.createGain();
        var wPeak = CAULD_PEAK * 0.45 * wash;
        var edge = Math.min(1.2, len * 0.25);
        PJ2.Voice.env(wg.gain, t, [[edge, wPeak],
                                   [Math.max(0.05, len - edge * 2), wPeak], [edge, 0]]);
        nz.connect(hp); hp.connect(lp); lp.connect(wg); wg.connect(gate);
        nz.start(t, nz.randomOffset); nz.stop(t + len + 0.3);
      }
      for (var i = 0; i < nPop; i++) {
        var pt = pops[i];
        // EVERY BUBBLE ITS OWN SIZE (rc.35): pitch floor, pitch ceiling and
        // the rise's length all drawn PER POP. `poplen` is the promoted 60 ms
        // literal; the pop's decay, release and stop are carried with it by
        // the ratio pk = poplen / 0.06, which is exactly 1 at the default, so
        // the default pot's arithmetic is untouched to the last bit. The
        // 4 ms onset is NOT scaled: it is the click-safe floor, and it stays.
        var plo = wTouch("cauldron", "plo"), phi = wTouch("cauldron", "phi");
        var pl = wTouch("cauldron", "poplen"), pk = pl / 0.06;
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(plo, pt);                      // positive → positive
        o.frequency.exponentialRampToValueAtTime(phi, pt + pl);   // the pop's rise
        var pg = c.createGain();
        PJ2.Voice.env(pg.gain, pt, [[0.004, CAULD_PEAK], [0.05 * pk, CAULD_PEAK * 0.15], [0.03 * pk, 0]]);
        o.connect(pg); pg.connect(gate);
        o.start(pt); o.stop(pt + 0.12 * pk);
      }
      nvRegister("cauldron", gate, t + len + 0.3);
      run.cauldHoldUntil = t + len + restS;
      emitNote({
        voice: "cauldron", kind: "simmer", freq: null, t: t, durS: len,
        pops: nPop, via: why,
      });
      return true;
    }

    // The pot's clock: the timer IS the draw (presence divides the gap), so
    // the consider below carries no dice of its own — only the gates.
    function cauldronConsider(t) {
      if (!run || !run.live) return;
      if (!CAULD_SCENES[curSceneType()]) return;
      if (!rosterAllows("cauldron") || isAbsent("cauldron")) return;
      if (inHush(t) || cutBlocks(t)) return;
      if (t < run.cauldHoldUntil) return;
      renderCauldron(t, "timer");
    }

    function startCauldron() {
      var lane = run.clock.lane("cauldron");
      var rng = run.streams.cauldron;
      function timer(t) {
        var wait = rng.rnd(40, 120) / Math.max(0.05, pVal("cauldron", "presence"));
        cauldronConsider(t);
        lane.at(t + wait, timer);
      }
      lane.at(run.t0 + rng.rnd(10, 30), timer);
    }

    // One call for the two shared opportunities the rite offers — a POSE turn
    // and a DARKENING ARRIVAL. Every voice rolls, in a fixed order, on its own
    // fork; a voice with no chance in this scene still spends its draw.
    // `col` is the scene a BOUNDARY gesture lands in: the arrival at tB
    // darkens the room the rite is walking INTO, and its answer must be
    // judged by that scene's roster cell and scene multiplier, never by the
    // one it is leaving (the Library's rc.31 rule, kept). Pose turns pass
    // nothing and are judged where they stand.
    function newVoicesConsider(kind, t, col) {
      bullConsider(kind, t, col);
      overConsider(kind, t, col);
      jawConsider(kind, t, col);
      bladeConsider(kind, t, col);
    }

    // ---- the ritual noise bed (landscape — "darker and noisier") -------------
    // Two slow sources into ONE slaved level gain (noiseLevel — the
    // follower holds it â¤ 0.8Ã the gurdy's level, always; that ceiling is
    // the whole meaning of "not too noisy"):
    //   EMBER-SMOKE — band-limited noise whose center drifts over minutes
    //   (each 24â40 s cycle ramps from the last center to a newly drawn one
    //   in 200â1200 Hz; the drift is the slow burn).
    //   RUIN-WIND — bandpassed gusts with 8â20 s envelopes, the filter
    //   swooping with each gust.
    // Per-source scheduled peaks â¤ 0.030 (asserted); murk breathes Â±20%.
    function startNoiseBed() {
      var lane = run.clock.lane("noisebed");
      var rng = run.streams.noisebed;
      function emberCycle(t) {
        var durS = rng.rnd(24, 40);
        var target = rng.rnd(260, 1150);
        var murk = wxAt(t).murk;
        var peak = 0.026 * (0.8 + 0.4 * murk); // â¤ 0.0312â¦ clamp below
        peak = Math.min(0.030, peak);
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) { lane.at(t + 4, emberCycle); return; }
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(run.emberCenter, t);
        bp.frequency.linearRampToValueAtTime(target, t + durS); // minutes-slow drift
        bp.Q.setValueAtTime(0.9, t);
        run.emberCenter = target;
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.noiseLevel);
        PJ2.Voice.env(g.gain, t, [[6, peak], [durS - 12, peak], [6, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        lane.at(t + durS - 6, emberCycle); // overlapped: smoke has no edges
      }
      function windGust(t) {
        var durS = rng.rnd(8, 20);
        var f0 = rng.rnd(300, 650);
        var f1v = f0 * rng.rnd(1.2, 1.9);
        var gap = rng.rnd(4, 15);
        var murk = wxAt(t).murk;
        var peak = Math.min(0.030, 0.020 * (0.8 + 0.4 * murk));
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, windGust); return; }
        run.tokens.push(tok);
        var c = ctx;
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f1v, t + durS * 0.45); // the swoop
        bp.frequency.linearRampToValueAtTime(f0 * 0.9, t + durS);
        bp.Q.setValueAtTime(2.2, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.noiseLevel);
        PJ2.Voice.env(g.gain, t, [[durS * 0.4, peak], [durS * 0.35, peak * 0.5], [durS * 0.25, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        lane.at(t + durS * 0.7 + gap, windGust);
      }
      lane.at(run.t0, emberCycle);
      lane.at(run.t0 + rng.rnd(3, 9), windGust);
    }

    // ---- the breath-bed (landscape — the treeline murmur) ---------------------
    // v1's whispers (~2938) reduced: same formant pairs, much quieter,
    // slower, and in the afterimage it sinks toward the unvoiced (half
    // peak, looser Q — air, not voices).
    function startBreathBed() {
      var lane = run.clock.lane("breath");
      var rng = run.streams.breath;
      function swell(t) {
        var durS = rng.rnd(2.5, 5.5);
        var formant = rng.pick(WHISPER_FORMANTS);
        var drift1 = 1 + rng.rnd(-0.15, 0.15);
        var drift2 = 1 + rng.rnd(-0.10, 0.10);
        var gap = rng.rnd(7, 16);
        var iv = curIntensity(t);
        var st = curSceneType();
        if (iv < 0.06) { lane.at(t + gap, swell); return; }
        var wx = wxAt(t);
        var unvoiced = (st === "afterimage");
        var peak = (unvoiced ? 0.009 : 0.018) * (0.6 + 0.8 * iv) * (0.8 + 0.4 * wx.breath);
        var q = (unvoiced ? 4 : 9) + rng.rnd(0, 4);
        var tok = run.budget.claim(5, t + durS + 0.3);
        if (!tok) { lane.at(t + gap, swell); return; }
        run.tokens.push(tok);
        var c = ctx;
        var n = PJ2.Voice.noiseBuffer.source(c, 30);
        var f1 = c.createBiquadFilter();
        f1.type = "bandpass";
        f1.frequency.setValueAtTime(formant[0], t);
        f1.frequency.linearRampToValueAtTime(formant[0] * drift1, t + durS);
        f1.Q.setValueAtTime(q, t);
        var f2 = c.createBiquadFilter();
        f2.type = "bandpass";
        f2.frequency.setValueAtTime(formant[1], t);
        f2.frequency.linearRampToValueAtTime(formant[1] * drift2, t + durS);
        f2.Q.setValueAtTime(Math.max(2, q - 2), t);
        var pre = c.createGain();
        pre.gain.setValueAtTime(0.4, t); // quiet INTO the resonances (lesson #2)
        var mix = c.createGain();
        mix.gain.setValueAtTime(1, t);
        n.connect(pre); pre.connect(f1); pre.connect(f2);
        f1.connect(mix); f2.connect(mix);
        var g = c.createGain();
        mix.connect(g); g.connect(run.breathLevel);
        PJ2.Voice.env(g.gain, t, [[durS * 0.25, peak], [durS * 0.35, peak * 0.7], [durS * 0.4, 0]]);
        n.start(t, n.randomOffset);
        n.stop(t + durS + 0.1);
        emitNote({ voice: "breath", freq: null, t: t, durS: durS });
        lane.at(t + gap * gmAt(t), swell);
      }
      lane.at(run.t0 + rng.rnd(4, 10), swell);
    }

    // ---- the proto-drum lane (the pulse before the rite) ----------------------
    // Always polling, beating only where the scene map allows: gathering
    // (after the bruise-advanced gate), the afterimage (slowing with the
    // scene's own progress), and INSIDE THE HUSH — where it quickens and
    // beats alone. Poll gaps stay â¤ 3.2 s so the hush (â¥ 5 s) can never
    // slip between two polls unheard.
    function startProtoDrum() {
      var lane = run.clock.lane("protodrum");
      var rng = run.streams.protodrum;
      function pulse(t) {
        var st = curSceneType();
        var hush = inHush(t) || (run.cut && run.cut.fired && t >= run.cut.tB && t <= run.cut.end);
        var beats = false, gap;
        if (hush) {
          beats = true;
          gap = rng.rnd(1.7, 2.4); // the heart quickens when noticed
        } else if (st === "gathering") {
          beats = t >= run.protoGateT;
          gap = rng.rnd(2.6, 4.2) * (1.05 - 0.3 * curIntensity(t));
        } else if (st === "afterimage") {
          beats = true;
          gap = rng.rnd(3.2, 5.5) * (1 + 0.8 * curSceneX()); // slowing as it disperses
        } else {
          gap = rng.rnd(2.0, 3.0); // silent poll — the pulse waits in the trees
        }
        if (beats) protoBeat(t, rng);
        lane.at(t + Math.min(gap, 3.2) * (beats ? 1 : 1) , pulse);
      }
      lane.at(run.t0 + 1.5, pulse);
    }

    // ---- the percussion lane (the anti-groove law) -----------------------------
    // ONE lane, ONE stream, strokes at exact times, coordinating with the
    // conductor by READING scene + intensity at each stroke — never by
    // being scheduled by it. Modes:
    //   circling      — loose strokes at breath gaps (3â10 s, intensity-
    //                   scaled: no grid exists to find), occasional pairs
    //                   (the lub-dub inheritance), rattle shimmer on some.
    //   processional  — the WALK (scheduled from the scene event, see
    //                   handleConductorEvent): a barely-gridded period
    //                   drawn per scene (2.4â3.4 s), Â±20% jitter per
    //                   stroke, rattle accents.
    //   invocation    — CLUSTERS (also scheduled from the scene event):
    //                   5â9 strokes whose spacing shrinks geometrically
    //                   2.0 â 0.7 s, gains flat — speed rises, level never
    //                   does. Log drum between clusters.
    //   elsewhere     — the loop idles (gathering and afterimage belong to
    //                   the proto-drum alone).
    // The cut cancels this whole lane at tB — a cluster cut off unfinished
    // is the gesture — and re-arms the idle pulse after the hush.
    function percPulse(t) {
      var lane = run.clock.lane("percussion");
      var rng = run.streams.percussion;
      var st = curSceneType();
      var iv = curIntensity(t);
      // Draws first, unconditionally (stream discipline). The desk's adorn
      // knob scales the pair/rattle chances (def 1 = as-composed).
      // rc.37: presence spaces the loose strokes out and thins the answers.
      // The idle poll below keeps its own pace — it sounds nothing.
      var gap = rng.rnd(3, 10) * (1.25 - 0.7 * iv) * restK("percussion");
      var adorn = wChar("percussion", "adorn");   // rc.35: the evening's manners
      var pairRoll = rng.chance(0.25 * adorn * presK("percussion"));
      var rattleRoll = rng.chance(0.3 * adorn * presK("percussion"));
      if (st === "circling" && !inHush(t)) {
        frameDrum(t, rng, { mode: "loose" });
        if (pairRoll) {
          var dt = 0.32 + rng.rnd(0, 0.12);
          lane.at(t + dt, function (t2) {
            if (!inHush(t2)) frameDrum(t2, rng, { mode: "pair2", peak: 0.034 });
          });
        }
        if (rattleRoll) boneRattle(t + 0.02, rng, { mode: "loose" });
      } else if (st === "invocation" || st === "processional") {
        gap = rng.rnd(4, 8); // walk/clusters carry these scenes; the pulse idles
      }
      lane.at(t + Math.max(1.2, gap), percPulse);
    }
    function startPercussion() {
      run.clock.lane("percussion").at(run.t0 + 2, percPulse);
    }

    // The processional walk — armed by the scene event with its drawn
    // period; strokes re-check the scene at each fire and let the walk die
    // when the processional ends.
    function walkStroke(t) {
      var lane = run.clock.lane("percussion");
      var rng = run.streams.percussion;
      if (curSceneType() !== "processional") return; // the rite has moved on
      // the desk knobs: irregularity widens/narrows the walk jitter, adorn
      // scales the rattle-accent chance (def 1 = as-composed)
      // rc.35: irregularity is WEATHER — the walk loosens and tightens over
      // minutes; adorn is the evening's manner.
      var jitter = 1 + (rng.rnd(0.8, 1.2) - 1) * wWx("percussion", "irregularity", t);
      var rattleRoll = rng.chance(0.25 * wChar("percussion", "adorn") * presK("percussion"));
      if (!inHush(t)) {
        frameDrum(t, rng, { mode: "walk" });
        if (rattleRoll) boneRattle(t + 0.02, rng, { mode: "walk-accent" });
      }
      // rc.37: the walk is the rite's own step and is never absent, but it
      // falls less often — the period stretches by 1 / presence.
      lane.at(t + run.walkPeriod * jitter * restK("percussion"), walkStroke);
    }

    // One accelerating cluster: n strokes, spacing shrinking geometrically
    // from ~2.0 s to ~0.7 s (strictly monotone, floor 0.65), gains FLAT.
    // Followed sometimes by a log drum tone — the wooden answer.
    function fireCluster(t) {
      var rng = run.streams.percussion;
      var lane = run.clock.lane("percussion");
      var n = rng.rint(5, 9);
      var s0 = rng.rnd(1.8, 2.1);
      var s1 = rng.rnd(0.68, 0.8);
      var logRoll = rng.chance(0.5 * presK("percussion"));
      var cid = "c" + Math.round((t - run.t0) * 1000); // run-relative: same-seed runs mint identical ids
      emitEvent({ type: "percussion", mode: "cluster", n: n, t: t, clusterId: cid });
      var r = Math.pow(s1 / s0, 1 / Math.max(1, n - 2));
      var at = 0, sp = s0;
      for (var i = 0; i < n; i++) {
        (function (tt) {
          lane.at(tt, function (te) {
            if (!inHush(te)) frameDrum(te, rng, { mode: "cluster", clusterId: cid, vel: 1, peak: 0.042 });
          });
        })(t + at);
        at += sp;
        sp = Math.max(0.65, sp * r);
      }
      if (logRoll) {
        lane.at(t + at + rng.rnd(1.5, 3), function (tl) {
          if (!inHush(tl) && curSceneType() === "invocation") logDrum(tl, rng, { mode: "cluster-tail" });
        });
      }
    }

    // ========================================================================
    // THE MELODIC LANES — all claim THE AIR, all speak in motif phrases.
    // Presence order (the plan's): chant > rebec > waterphone > bone-flute.
    // Gathering is CHANT-ONLY among the speakers (the others' scene
    // chances are 0 there) — which is also what guarantees the ghost is
    // always intoned by the cantor.
    // ========================================================================
    var SPEAK_P = {
      chant:      { gathering: 0.55, processional: 0.85, circling: 0.6, invocation: 0.7, afterimage: 0.35 },
      rebec:      { gathering: 0,    processional: 0.3,  circling: 0.5, invocation: 0.4, afterimage: 0.15 },
      waterphone: { gathering: 0,    processional: 0.2,  circling: 0.35, invocation: 0.3, afterimage: 0.2 },
      boneflute:  { gathering: 0,    processional: 0.25, circling: 0,   invocation: 0.25, afterimage: 0 },
    };

    // Shared attempt scaffold: draw-first discipline, ghost-holding on a
    // denied air (a memory must not be erased by a busy moment), the hush
    // gate on note onsets, whole-octave re-registration (degree classes —
    // and therefore the keening law — survive).
    function startChant() {
      var lane = run.clock.lane("chant");
      var rng = run.streams.chant;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        // rc.37: presence multiplies the phrase chance, and lengthens the
        // REST the cantor takes after a phrase (and the air margin it holds
        // with it). The lane's own retry polls are not rests and are left
        // alone — a poll sounds nothing, and thinning it would spend the
        // same knob twice on one decision. The cantor is the principal
        // speaker and is thinned least of all.
        var sings = rng.chance((SPEAK_P.chant[st] != null ? SPEAK_P.chant[st] : 0.4) * presK("chant"));
        if (!sings || iv < 0.05) { lane.at(t + rng.rnd(7, 13) * gmAt(t), attempt); return; }
        var res = run.heldUtterance.chant;
        run.heldUtterance.chant = null;
        if (!res) {
          try { res = run.motif.request("chant", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(7, 13) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.2, 1.8) * (1.5 - 0.6 * iv); // the slowest lungs in the clearing
        var tm = phraseTiming(m, spb, 1.25, 1.5, 6);
        var margin = rng.rnd(5, 10) * restK("chant");
        var tok = null;
        try { tok = run.air.tryClaim("chant", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.chant = res;
          lane.at(t + rng.rnd(4, 8) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "chant", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "chant", t);
        // Register: chant-fresh material is born in the chest (motif home
        // register â1); shared material recentres near 0 and drops an
        // octave to stay there. The invocation lifts the whole line one
        // octave — concentration by REGISTER, never level.
        var mean = 0;
        for (var mi = 0; mi < m.notes.length; mi++) mean += m.notes[mi].deg;
        mean /= m.notes.length;
        var off = (mean > 2.5 ? -run.field.size : 0) + (st === "invocation" ? run.field.size : 0);
        var velScale = (res.kind === "ghost") ? 0.6 : 1; // the half-remembered line, quiet
        var out = mixOut("chant", run.poolMel.at(rng.rnd(-0.4, 0.4)));
        // The clearing answers the cantor about half the time (seasick
        // delay send, per line, on the delaySend fork).
        var echoed = run.streams.delaySend.chance(0.5);
        // WORDLESS VOWELS, drifting toward syllabic articulation ONLY in
        // the processional (implied language is potent; attempted language
        // is kitsch): one mouth shape per phrase elsewhere, per-note steps
        // there. Organum doubling rides the processional lines too.
        var syllabic = (st === "processional");
        var doubled = syllabic; // organum doubles the processional statements
        var vowel = walkVowel();
        var lastVel = 1, lastAbs = null, lastEnd = t;
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.7, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (syllabic && i > 0 && run.streams.vowels.chance(0.6)) vowel = walkVowel();
          if (inHush(nt)) continue;          // the cut swallows the word — the gesture
          var btok = run.budget.claim(doubled ? 22 : 11, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg + off;
          var freq = run.field.degFreq(abs, 0); // read at schedule time, never cached
          renderChantNote(out, freq, nt, nd, 0.032 * vel, vowel, wxAt(nt),
            echoed ? run.delaySendChant : null);
          emitNote({
            voice: "chant", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
          });
          if (doubled) {
            // Parallel organum: the lower voice doubles THIS line at the
            // authored interval (P5 / P4 / occursus third — see
            // ORGANUM_DOUBLING). Drawless, stateless, exactly 2 parts.
            var duo = null;
            try { duo = run.harmony.voiceConsort(2, { top: abs }); } catch (e2) { duo = null; }
            if (duo && duo.length === 2) {
              var lowFreq = run.field.degFreq(duo[0], 0);
              renderChantNote(out, lowFreq, nt, nd, 0.032 * vel * 0.6, vowel, wxAt(nt), null);
              emitNote({
                voice: "chant", kind: "organum", freq: lowFreq, t: nt, durS: nd,
                deg: duo[0], oct: 0, velocity: vel * 0.6,
              });
              emitEvent({ type: "organum", top: duo[1], low: duo[0], parts: 2, t: nt, via: "processional" });
            }
          }
          lastVel = vel;
          lastAbs = abs;
          lastEnd = nt + nd;
        }
        // THE AFTER-TONE (~40%, never on the ghost): a quiet body gesture
        // on the final BELOW the keen — degree class 0, half the phrase's
        // last velocity, NOT a motif note. The abstract music stays
        // honestly unresolved; the ear hears the keen sag home and fail to
        // mean it.
        var aftRoll = rng.chance(0.4);
        if (aftRoll && res.kind !== "ghost" && lastAbs != null && !inHush(lastEnd + 0.25)) {
          var aft = lastAbs;
          var guard = 0;
          while (degClass(aft) !== 0 && guard++ < 8) aft--;
          var atok = run.budget.claim(11, lastEnd + 2.4);
          if (atok) {
            run.tokens.push(atok);
            var aFreq = run.field.degFreq(aft, 0);
            renderChantNote(out, aFreq, lastEnd + 0.25, rng.rnd(1.2, 2), 0.032 * lastVel * 0.5,
              vowel, wxAt(lastEnd + 0.25), null);
            emitNote({
              voice: "chant", kind: "aftertone", freq: aFreq, t: lastEnd + 0.25,
              durS: 1.6, deg: aft, oct: 0, velocity: lastVel * 0.5,
            });
          }
        }
        maybePost("chant", res, t);
        lane.at(t + tm.spanS + margin + rng.rnd(6, 14) * (1.35 - iv) * gmAt(t) * restK("chant"), attempt);
      }
      lane.at(run.t0 + rng.rnd(8, 16), attempt);
    }

    function startRebec() {
      var lane = run.clock.lane("rebec");
      var rng = run.streams.rebec;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance((SPEAK_P.rebec[st] != null ? SPEAK_P.rebec[st] : 0.3) * presK("rebec"));
        // rc.32: the roster gates the ENTRY, after the roll — the fiddle
        // plays the processional and the circling and rests elsewhere.
        // rc.37: and on some evenings it sits the whole night out.
        if (!plays || iv < 0.1 || !rosterAllows("rebec") || isAbsent("rebec")) {
          lane.at(t + rng.rnd(8, 15) * gmAt(t), attempt); return;
        }
        var res = run.heldUtterance.rebec;
        run.heldUtterance.rebec = null;
        if (!res) {
          try { res = run.motif.request("rebec", reqCtx(t)); } catch (e) { res = null; }
        }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(8, 15) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.55, 0.85) * (1.4 - 0.6 * iv);
        var tm = phraseTiming(m, spb, 1.35, 0.8, 3.5);
        var margin = rng.rnd(4, 8) * restK("rebec");
        var tok = null;
        try { tok = run.air.tryClaim("rebec", tm.spanS, margin); } catch (e) {}
        if (!tok) {
          if (res.kind === "ghost") run.heldUtterance.rebec = res;
          lane.at(t + rng.rnd(3, 6) * gmAt(t), attempt);
          return;
        }
        emitEvent({
          type: "air", voice: "rebec", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "rebec", t);
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        var out = mixOut("rebec", run.poolMel.at(rng.rnd(-0.55, 0.55)));
        var echoed = run.streams.delaySend.chance(0.3);
        var dblRoll = rng.chance(0.2); // the open-fifth double stop, occasional
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.65, 1) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue;
          var isFinal = i === m.notes.length - 1;
          var btok = run.budget.claim(isFinal && dblRoll ? 16 : 9, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;
          var freq = run.field.degFreq(abs, 0);
          renderRebecNote(out, freq, nt, nd, vel, rng, echoed ? run.delaySendRebec : null);
          emitNote({
            voice: "rebec", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: isFinal, manner: mannerOf("rebec", "rebec"),
          });
          if (isFinal && dblRoll) {
            // double stop: the authored organum interval below the final —
            // in-scale by construction, so adherence survives.
            var duo2 = null;
            try { duo2 = run.harmony.voiceConsort(2, { top: abs }); } catch (e3) { duo2 = null; }
            if (duo2 && duo2.length === 2) {
              var lf = run.field.degFreq(duo2[0], 0);
              renderRebecNote(out, lf, nt, nd, vel * 0.7, rng, null);
              emitNote({
                voice: "rebec", kind: "doublestop", freq: lf, t: nt, durS: nd,
                deg: duo2[0], oct: 0, velocity: vel * 0.7,
                manner: mannerOf("rebec", "rebec"),
              });
              emitEvent({ type: "organum", top: duo2[1], low: duo2[0], parts: 2, t: nt, via: "doublestop" });
            }
          }
        }
        lane.at(t + tm.spanS + margin + rng.rnd(5, 12) * (1.35 - iv) * gmAt(t) * restK("rebec"), attempt);
      }
      lane.at(run.t0 + rng.rnd(20, 40), attempt);
    }

    function startWaterphone() {
      var lane = run.clock.lane("waterphone");
      var rng = run.streams.waterphone;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance((SPEAK_P.waterphone[st] != null ? SPEAK_P.waterphone[st] : 0.25) * presK("waterphone"));
        // rc.32: the roster keeps the metal to the circling. The CUT's own
        // apparition is not an entry and is not gated here — it is the cut's
        // (rc.37: nor by an absence — the hush is inhabited every evening).
        if (!plays || iv < 0.1 || !rosterAllows("waterphone") || isAbsent("waterphone")) {
          lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt); return;
        }
        var res = null;
        try { res = run.motif.request("waterphone", reqCtx(t)); } catch (e) { res = null; }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(10, 18) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(1.0, 1.5) * (1.3 - 0.4 * iv); // the metal takes its time
        var tm = phraseTiming(m, spb, 1.6, 2.2, 8);
        var margin = rng.rnd(6, 12) * restK("waterphone"); // the lyrical OCCASIONAL voice
        var tok = null;
        try { tok = run.air.tryClaim("waterphone", tm.spanS, margin); } catch (e) {}
        if (!tok) { lane.at(t + rng.rnd(5, 9) * gmAt(t), attempt); return; }
        emitEvent({
          type: "air", voice: "waterphone", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "waterphone", t);
        var velScale = (res.kind === "ghost") ? 0.6 : 1;
        var out = mixOut("waterphone", run.poolMel.at(rng.rnd(-0.5, 0.5)));
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.6, 0.95) * velScale;
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue; // the hush belongs to the apparition alone
          var btok = run.budget.claim(30, nt + nd + 0.6);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;
          // rc.44 - THE MANNER, drawn per note on the stop's own fork, and
          // THEN the register: which body is playing decides which register
          // law applies. The metal's own range widened this round (today's
          // placement or one octave below, equal odds); the crystal's is a
          // law of its own (one or two below, never today's).
          var crystalRoll = run.streams.waterCrystal.next();
          var isCrystal = crystalRoll < shareOf("waterphone", "crystal", "crystal");
          var wOct = isCrystal
            ? Math.round(clamp(wTouch("waterphone", "crystalRegister"), -2, -1))
            : Math.round(clamp(wTouch("waterphone", "register"), -1, 0));
          var freq = run.field.degFreq(abs, wOct);
          // the metal ALWAYS reaches the clearing wall (delay), and the
          // cavern's throat hears it through a small send.
          var wEnv = renderWaterphoneNote(out, freq, nt, nd, vel, rng, run.delaySendWater, isCrystal);
          try { wEnv.connect(run.throatSendWater); } catch (eT) {}
          emitNote({
            voice: "waterphone", freq: freq, t: nt, durS: nd, deg: abs, oct: wOct,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
            manner: mannerOf("waterphone", "waterphone"),
          });
        }
        lane.at(t + tm.spanS + margin + rng.rnd(8, 16) * (1.3 - iv) * gmAt(t) * restK("waterphone"), attempt);
      }
      lane.at(run.t0 + rng.rnd(30, 55), attempt);
    }

    function startBoneflute() {
      var lane = run.clock.lane("boneflute");
      var rng = run.streams.boneflute;
      function attempt(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var plays = rng.chance((SPEAK_P.boneflute[st] != null ? SPEAK_P.boneflute[st] : 0) * presK("boneflute"));
        // 2â3 utterances an evening, HARD (the counter resets at each
        // performance begin) — the one high lonely color stays lonely.
        // rc.32: the roster's boneflute row is the engine's own SPEAK_P map
        // read as a table — processional and invocation, nothing else.
        if (!plays || iv < 0.12 || run.fluteCount >= run.fluteMax ||
            !rosterAllows("boneflute") || isAbsent("boneflute")) {
          lane.at(t + rng.rnd(14, 24) * gmAt(t), attempt);
          return;
        }
        var res = null;
        try { res = run.motif.request("boneflute", reqCtx(t)); } catch (e) { res = null; }
        if (!res || !res.motif || !res.motif.notes || !res.motif.notes.length) {
          lane.at(t + rng.rnd(14, 24) * gmAt(t), attempt);
          return;
        }
        var m = res.motif;
        var spb = rng.rnd(0.45, 0.7);
        var tm = phraseTiming(m, spb, 1.3, 0.6, 2.2); // breath-length phrases
        var margin = rng.rnd(6, 10) * restK("boneflute");
        var tok = null;
        try { tok = run.air.tryClaim("boneflute", tm.spanS, margin); } catch (e) {}
        if (!tok) { lane.at(t + rng.rnd(6, 10) * gmAt(t), attempt); return; }
        run.fluteCount++;
        emitEvent({
          type: "air", voice: "boneflute", t: t, durS: tm.spanS, marginS: margin,
          limit: run.airLimit(), overlap: !!(tok && tok.overlap),
        });
        narrate(res, "boneflute", t);
        var out = mixOut("boneflute", run.poolMel.at(rng.rnd(-0.3, 0.3)));
        for (var i = 0; i < m.notes.length; i++) {
          var vel = rng.rnd(0.6, 0.9);
          var nt = t + tm.offs[i], nd = tm.durs[i];
          if (inHush(nt)) continue;
          var btok = run.budget.claim(6, nt + nd + 0.2);
          if (!btok) continue;
          run.tokens.push(btok);
          var abs = m.notes[i].deg;                  // home register +1 (motif config)
          var freq = run.field.degFreq(abs, 0);
          renderBoneFluteNote(out, freq, nt, nd, vel);
          emitNote({
            voice: "boneflute", freq: freq, t: nt, durS: nd, deg: abs, oct: 0,
            velocity: vel, motif: m.name, gen: m.gen, phraseKind: res.kind,
            final: i === m.notes.length - 1,
          });
        }
        lane.at(t + tm.spanS + margin + rng.rnd(20, 40) * gmAt(t) * restK("boneflute"), attempt);
      }
      lane.at(run.t0 + rng.rnd(60, 120), attempt);
    }

    // ========================================================================
    // THE AMBIENT POOL (landscape — the dark outside the circle). Weighted,
    // weather/tide-gated, at the LIBRARY's density (same gap law: 20â60 s
    // scaled by intensity and tide, gapMul Â±15%, floor 8 s — the roster is
    // strange, the room is no busier). Dropped from v1: cackle, glass,
    // cauldron (startle/comedy risks).
    // ========================================================================
    // ========================================================================
    // THE CAVE (rc.44, lab-sycorax.html's ambient variant B) - a MANNER, not
    // a wider pool. Ariel's rc.43 seaside added members to a weighted pool
    // and moved every draw after the first; this does the opposite. The
    // pool's weighted draw, its gap law, its weather gating and its budget
    // claims are untouched, and every one-shot the sky speaks with is
    // answered by the cave's own version of the same thing at the same
    // instant: gust becomes a deep rumble, ember becomes drips, stone a
    // rockfall, chains bats, the raven a knock and its echo, the bell water
    // into a pool (on the bell's own pitch - the field is kept), the keen
    // the cave's own breath, and the far thunder itself taken underground
    // beneath a 260 Hz lid. The sky says the same things at the same
    // moments, in a different room.
    //
    // NOT sky one-shots, and so never re-voiced: the arrival's ORGANUM PAD
    // and the cut's INDRAWN BREATH. Both are the rite's own gestures that
    // happen to be rendered into the ambient layer, and the lab's card says
    // so too.
    //
    // Every die this manner throws comes off its OWN fork, so a cave evening
    // and a fen evening fire the same one-shots at the same times.
    function caveBand(t, opt) {
      var c = ctx;
      var len = opt.len || 1;
      var stopAt = t + len + 0.1;
      var nz = PJ2.Voice.noiseBuffer.source(c, 30);
      var f = c.createBiquadFilter();
      f.type = opt.type || "bandpass";
      f.frequency.setValueAtTime(opt.f0 || 800, t);
      f.Q.setValueAtTime(opt.q == null ? 2 : opt.q, t);
      var sweep = opt.sweep || [];
      for (var i = 0; i < sweep.length; i++) {
        f.frequency.linearRampToValueAtTime(sweep[i][1], t + sweep[i][0]);
      }
      var pre = c.createGain();
      pre.gain.setValueAtTime(opt.pre == null ? 1 : opt.pre, t);
      var g = envGain();
      nz.connect(pre); pre.connect(f); f.connect(g);
      if (opt.trem) {
        var tr = seriesTrem(opt.trem[0], opt.trem[1], t, stopAt);
        g.connect(tr); tr.connect(run.layAmb);
      } else {
        g.connect(run.layAmb);
      }
      PJ2.Voice.env(g.gain, t, opt.segs);
      nz.start(t, nz.randomOffset); nz.stop(stopAt);
      return g;
    }
    // a drip: a fast fall into a high-Q plink - the cave's signature
    function caveDrip(at, hz, amt, ring, size) {
      var c = ctx;
      var o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(hz * 3.2, at);
      o.frequency.exponentialRampToValueAtTime(hz, at + 0.035);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(hz, at);
      bp.Q.setValueAtTime(14 * size, at);
      var g = envGain();
      o.connect(bp); bp.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, at, [[0.002, amt], [0.02, amt * 0.5], [ring, 0]]);
      o.start(at); o.stop(at + ring + 0.1);
    }
    // one cave one-shot. `o` carries whatever the fen's own body already
    // drew and emitted (its length, its pitch), so the two manners are the
    // same event in the stream.
    function caveShot(kind, t, o) {
      var c = ctx, rng = run.streams.ambCave;
      o = o || {};
      var size = clamp(wTouch("ambient", "depth"), 0.2, 2);   // how deep it runs
      var L = MATCH_AMB_CAVE;
      var i, at;
      if (kind === "gust") {
        // THE DEEP RUMBLE - something very large, very far, underneath.
        var durS = Math.max(2, o.durS || 6);
        var pkG = 0.026 * L;
        caveBand(t, { len: durS, f0: 70, q: 1.2, type: "lowpass", pre: 0.5,
                      sweep: [[durS * 0.5, 130 * size], [durS, 55]],
                      segs: [[durS * 0.4, pkG], [durS * 0.3, pkG * 0.6], [durS * 0.3, 0]] });
      } else if (kind === "ember") {
        // DRIPS - where the fire spat, water falls.
        var nd = rng.rint(3, 6), pkD = 0.017 * L;
        at = 0;
        for (i = 0; i < nd; i++) {
          caveDrip(t + at, 900 + rng.rnd(0, 900), pkD * rng.rnd(0.6, 1), 0.28 * size, size);
          at += rng.rnd(0.16, 0.55);
        }
      } else if (kind === "stone") {
        // A ROCKFALL - clacks, unequal, with a thud under the last of them.
        var nc = rng.rint(4, 8), pkS = 0.022 * L;
        at = 0;
        for (i = 0; i < nc; i++) {
          var nz = PJ2.Voice.noiseBuffer.source(c, 30);
          var bq = c.createBiquadFilter();
          bq.type = "bandpass";
          bq.frequency.setValueAtTime(rng.rnd(700, 2200), t + at);
          bq.Q.setValueAtTime(6, t + at);
          var g2 = envGain();
          nz.connect(bq); bq.connect(g2); g2.connect(run.layAmb);
          PJ2.Voice.env(g2.gain, t + at, [[0.002, pkS * rng.rnd(0.5, 1)], [rng.rnd(0.03, 0.08), 0]]);
          nz.start(t + at, nz.randomOffset); nz.stop(t + at + 0.1);
          at += rng.rnd(0.05, 0.19);
        }
        var th = c.createOscillator();
        th.type = "sine";
        th.frequency.setValueAtTime(78, t + at * 0.6);
        th.frequency.exponentialRampToValueAtTime(42, t + at * 0.6 + 0.22);
        var tg = envGain();
        th.connect(tg); tg.connect(run.layAmb);
        PJ2.Voice.env(tg.gain, t + at * 0.6, [[0.006, pkS * 0.9], [0.3, 0.001], [0.1, 0]]);
        th.start(t + at * 0.6); th.stop(t + at * 0.6 + 0.5);
      } else if (kind === "chains") {
        // BATS - very short, very high, falling; six to ten of them. The
        // lab's fix round found this body the most exposed of all to the
        // late-anchor click (a 2 ms attack on a 7-10 kHz tone), which is
        // why every gain here is born shut, envGain's whole reason.
        var nbt = rng.rint(6, 10), pkBt = 0.010 * L;
        at = 0;
        for (i = 0; i < nbt; i++) {
          var hf = 7000 + rng.rnd(0, 3000);
          var ob = c.createOscillator();
          ob.type = "sine";
          ob.frequency.setValueAtTime(hf, t + at);
          ob.frequency.exponentialRampToValueAtTime(hf * 0.45, t + at + 0.022);
          var gb = envGain();
          ob.connect(gb); gb.connect(run.layAmb);
          PJ2.Voice.env(gb.gain, t + at, [[0.002, pkBt * rng.rnd(0.6, 1)], [0.02, 0]]);
          ob.start(t + at); ob.stop(t + at + 0.05);
          at += rng.rnd(0.03, 0.13);
        }
      } else if (kind === "raven") {
        // A KNOCK, and the cave answering it a beat later.
        var pkK = 0.018 * L;
        for (i = 0; i < 2; i++) {
          var at2 = t + i * (0.36 * size), amt = pkK * (i ? 0.45 : 1);
          var nz2 = PJ2.Voice.noiseBuffer.source(c, 30);
          var bq2 = c.createBiquadFilter();
          bq2.type = "bandpass";
          bq2.frequency.setValueAtTime(420 - i * 90, at2);
          bq2.Q.setValueAtTime(5, at2);
          var g3 = envGain();
          nz2.connect(bq2); bq2.connect(g3); g3.connect(run.layAmb);
          PJ2.Voice.env(g3.gain, at2, [[0.003, amt], [0.13, 0]]);
          nz2.start(at2, nz2.randomOffset); nz2.stop(at2 + 0.2);
          var wo = c.createOscillator();
          wo.type = "sine";
          wo.frequency.setValueAtTime(150 - i * 30, at2);
          var wg = envGain();
          wo.connect(wg); wg.connect(run.layAmb);
          PJ2.Voice.env(wg.gain, at2, [[0.004, amt * 0.6], [0.2, 0]]);
          wo.start(at2); wo.stop(at2 + 0.3);
        }
      } else if (kind === "bell") {
        // WATER INTO A POOL, on the bell's own pitch: the field is kept.
        var bf = o.freq || 400;
        caveDrip(t, bf * 2, 0.019 * L, 1.1 * size, size);
        caveDrip(t + 0.9 * size, bf * 3, 0.011 * L, 0.8 * size, size);
      } else if (kind === "keen") {
        // THE CAVE'S OWN BREATH - air moving through a long throat, on the
        // keen's own two formants, and not a voice at all.
        var kd = Math.max(2, o.durS || 3.5), pkB = 0.013 * L;
        caveBand(t, { len: kd, f0: 150, q: 5,
                      sweep: [[kd * 0.5, 300 * size], [kd, 130]], trem: [0.24, 0.25],
                      segs: [[kd * 0.35, pkB], [kd * 0.3, pkB * 0.8], [kd * 0.35, 0]] });
        caveBand(t, { len: kd, f0: 640, q: 8,
                      sweep: [[kd * 0.6, 480]],
                      segs: [[kd * 0.35, pkB * 0.4], [kd * 0.3, pkB * 0.3], [kd * 0.35, 0]] });
      } else if (kind === "thunder") {
        // the engine's own far thunder, taken underground: a 260 Hz lid and
        // the sub alone. A transposition, and the card says so.
        var td = Math.max(1, o.durS || 4);
        var P = 0.045 * (o.dose == null ? 1 : o.dose) * L * 0.9;
        var so = c.createOscillator();
        so.type = "sine";
        so.frequency.setValueAtTime(46, t);
        so.frequency.exponentialRampToValueAtTime(30, t + td);
        var sg = envGain();
        so.connect(sg); sg.connect(run.layAmb);
        PJ2.Voice.env(sg.gain, t, [[0.3, P], [td - 0.4, 0.0012], [0.1, 0]]);
        so.start(t); so.stop(t + td + 0.15);
        var bn = PJ2.Voice.noiseBuffer.source(c, 30);
        var bpre = c.createGain();
        bpre.gain.setValueAtTime(0.4, t);
        var blp = c.createBiquadFilter();
        blp.type = "lowpass";
        blp.frequency.setValueAtTime(260, t);
        blp.frequency.exponentialRampToValueAtTime(45, t + td);
        blp.Q.setValueAtTime(4, t);
        var bg = envGain();
        bn.connect(bpre); bpre.connect(blp); blp.connect(bg); bg.connect(run.layAmb);
        PJ2.Voice.env(bg.gain, t, [[0.35, P * 0.8], [td - 0.45, 0.0012], [0.1, 0]]);
        bn.start(t, bn.randomOffset); bn.stop(t + td + 0.15);
      }
    }

    function startAmbient() {
      var lane = run.clock.lane("ambient");
      var rng = run.streams.ambient;
      // rc.44 - tonight's room, drawn per one-shot in oneShot() and read by
      // the eight bodies below. One coin per one-shot, on the stop's own
      // fork; the pool's own draw above it never moves.
      var caveNow = false;

      // -- ruin-wind gust (a louder single gust, the bed's cousin)
      function poolGust(t) {
        var durS = rng.rnd(4, 9);
        var f0 = rng.rnd(350, 700);
        var tok = run.budget.claim(3, t + durS + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        if (caveNow) {
          caveShot("gust", t, { durS: durS });
          emitNote({ voice: "ambient", kind: "gust", freq: null, t: t, durS: durS, manner: "cave" });
          return;
        }
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f0 * 1.6, t + durS * 0.4);
        bp.frequency.linearRampToValueAtTime(f0 * 0.85, t + durS);
        bp.Q.setValueAtTime(2.5, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[durS * 0.35, 0.024], [durS * 0.3, 0.012], [durS * 0.35, 0]]);
        src.start(t, src.randomOffset);
        src.stop(t + durS + 0.1);
        emitNote({ voice: "ambient", kind: "gust", freq: null, t: t, durS: durS, manner: "fen" });
      }

      // -- ember pops (the fire spitting — crackle pattern, one gain chain)
      function emberPops(t) {
        var n = rng.rint(2, 5);
        var tok = run.budget.claim(3, t + 1.4);
        if (!tok) return;
        run.tokens.push(tok);
        // The pops' shapes, drawn here as they always were (AFTER the claim -
        // a refused one-shot draws nothing) but drawn WHICHEVER room they
        // land in, so the cave's drips cost the pool not one die.
        var pops = [];
        for (var pi = 0; pi < n; pi++) {
          pops.push([0.003 + rng.rnd(0, 0.006), 0.02 + rng.rnd(0, 0.05),
                     rng.rnd(0.06, 0.22), rng.rnd(0.6, 1)]);
        }
        var c = ctx;
        var atE = 0;
        for (var pj = 0; pj < pops.length; pj++) atE += pops[pj][0] + pops[pj][1] + pops[pj][2];
        if (caveNow) {
          caveShot("ember", t, { durS: atE });
          emitNote({ voice: "ambient", kind: "ember", freq: null, t: t, durS: atE, manner: "cave" });
          return;
        }
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(1500, t);
        hp.Q.setValueAtTime(0.7, t);
        var g = c.createGain();
        src.connect(hp); hp.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var i = 0; i < n; i++) {
          var up = pops[i][0], dn = pops[i][1], rest = pops[i][2];
          segs.push([up, 0.012 * pops[i][3]]);
          segs.push([dn, 0]);
          segs.push([rest, 0]);
          at += up + dn + rest;
        }
        PJ2.Voice.env(g.gain, t, segs);
        src.start(t, src.randomOffset);
        src.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "ember", freq: null, t: t, durS: at, manner: "fen" });
      }

      // -- stone-grind (v1's scrape ~3717, demoted to the pool, at 2/3 dose)
      function stoneGrind(t) {
        var dur = 0.8 + rng.rnd(0, 1.2);
        var startFreq = 200 + rng.rnd(0, 500);
        var qVal = 10 + rng.rnd(0, 10);
        var dirRoll = rng.next();
        var tok = run.budget.claim(4, t + dur + 0.2);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        if (caveNow) {
          caveShot("stone", t, { durS: dur });
          emitNote({ voice: "ambient", kind: "stone", freq: null, t: t, durS: dur, manner: "cave" });
          return;
        }
        var o = c.createOscillator();
        var f = c.createBiquadFilter();
        o.type = "sawtooth";
        f.type = "bandpass";
        f.frequency.setValueAtTime(startFreq, t);
        f.Q.setValueAtTime(qVal, t);
        if (dirRoll < 0.33) {          // dip
          o.frequency.setValueAtTime(startFreq, t);
          o.frequency.linearRampToValueAtTime(startFreq * 0.5, t + dur * 0.5);
          o.frequency.linearRampToValueAtTime(startFreq * 0.9, t + dur);
        } else if (dirRoll < 0.66) {   // down
          o.frequency.setValueAtTime(startFreq, t);
          o.frequency.linearRampToValueAtTime(startFreq * 0.4, t + dur);
        } else {                       // up
          o.frequency.setValueAtTime(startFreq * 0.5, t);
          o.frequency.linearRampToValueAtTime(startFreq, t + dur);
        }
        var pre = c.createGain();
        pre.gain.setValueAtTime(0.5, t); // quiet INTO the Q-10+ resonance
        var g = c.createGain();
        o.connect(pre); pre.connect(f); f.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[0.06, 0.026], [dur * 0.5 - 0.06, 0.022], [dur * 0.5, 0]]);
        o.start(t);
        o.stop(t + dur + 0.1);
        emitNote({ voice: "ambient", kind: "stone", freq: null, t: t, durS: dur, manner: "fen" });
      }

      // -- chains (v1 ~3838, node-economy port: ONE noise + ONE bandpass,
      // retuned between pings at true-zero gain — the cricket lesson)
      function chains(t) {
        var pings = rng.rint(5, 9);
        var rate = rng.rnd(10, 16);
        var spacing = 1 / rate;
        var tok = run.budget.claim(3, t + pings * spacing + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        // the pings' pitches, lengths and levels are the sky's, whichever
        // room hears them (see emberPops on where these are drawn)
        var pl = [];
        for (var qi = 0; qi < pings; qi++) {
          pl.push([rng.rnd(3000, 7000), 0.02 + rng.rnd(0, 0.03), rng.rnd(0.7, 1)]);
        }
        var c = ctx;
        var atC = 0;
        for (var qj = 0; qj < pl.length; qj++) {
          atC += 0.002 + pl[qj][1] + Math.max(0.004, spacing - pl[qj][1] - 0.002);
        }
        if (caveNow) {
          caveShot("chains", t, { durS: atC });
          emitNote({ voice: "ambient", kind: "chains", freq: null, t: t, durS: atC, manner: "cave" });
          return;
        }
        var src = PJ2.Voice.noiseBuffer.source(c, 30);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(pl[0][0], t);
        bp.Q.setValueAtTime(20, t);
        var g = c.createGain();
        src.connect(bp); bp.connect(g); g.connect(run.layAmb);
        var segs = [], at = 0;
        for (var i = 0; i < pings; i++) {
          if (i > 0) bp.frequency.setValueAtTime(pl[i][0], t + at); // silent retune
          var pd = pl[i][1];
          segs.push([0.002, 0.016 * pl[i][2]]);
          segs.push([pd, 0]);
          segs.push([Math.max(0.004, spacing - pd - 0.002), 0]);
          at += 0.002 + pd + Math.max(0.004, spacing - pd - 0.002);
        }
        PJ2.Voice.env(g.gain, t, segs);
        src.start(t, src.randomOffset);
        src.stop(t + at + 0.1);
        emitNote({ voice: "ambient", kind: "chains", freq: null, t: t, durS: at, manner: "fen" });
      }

      // -- raven (v1 ~3957: sawtooth squawks through two formant bands,
      // pitch falling — unpitched texture, far-field dose)
      function raven(t) {
        var squawks = rng.rint(1, 3);
        var tok = run.budget.claim(5 * squawks, t + squawks * 0.3 + 0.4);
        if (!tok) return;
        run.tokens.push(tok);
        // the squawks' own numbers (see emberPops on where these are drawn)
        var sq = [];
        for (var ri = 0; ri < squawks; ri++) {
          sq.push([0.15 + rng.rnd(0, 0.1), 0.12 + rng.rnd(0, 0.08), 800 + rng.rnd(0, 400)]);
        }
        var c = ctx;
        if (caveNow) {
          caveShot("raven", t, { durS: squawks * 0.3 });
          emitNote({ voice: "ambient", kind: "raven", freq: null, t: t,
                     durS: squawks * 0.3, manner: "cave" });
          return;
        }
        for (var i = 0; i < squawks; i++) {
          var st2 = t + i * sq[i][0];
          var dur = sq[i][1];
          var f0 = sq[i][2];
          var o = c.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(f0, st2);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.4, st2 + dur);
          var f1 = c.createBiquadFilter();
          f1.type = "bandpass";
          f1.frequency.setValueAtTime(1200, st2);
          f1.Q.setValueAtTime(8, st2);
          var f2 = c.createBiquadFilter();
          f2.type = "bandpass";
          f2.frequency.setValueAtTime(2800, st2);
          f2.Q.setValueAtTime(6, st2);
          var pre = c.createGain();
          pre.gain.setValueAtTime(0.35, st2);
          var mix = c.createGain();
          mix.gain.setValueAtTime(1, st2);
          var g = c.createGain();
          o.connect(pre); pre.connect(f1); pre.connect(f2);
          f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(run.layAmb);
          PJ2.Voice.env(g.gain, st2, [[0.01, 0.016], [dur - 0.01, 0.001], [0.04, 0]]);
          o.start(st2);
          o.stop(st2 + dur + 0.06);
        }
        emitNote({ voice: "ambient", kind: "raven", freq: null, t: t, durS: squawks * 0.3, manner: "fen" });
      }

      // -- cracked iron bell (tide-near): one struck tone + an inharmonic
      // hum partial — the fundamental SNAPS TO THE FIELD (era-aware; even
      // the derelict bell keeps the key).
      function ironBell(t) {
        var info = run.field.snapInfo(360 + rng.rnd(0, 190)); // draw, then snap
        var tok = run.budget.claim(4, t + 6.3);
        if (!tok) return;
        run.tokens.push(tok);
        var c = ctx;
        if (caveNow) {
          caveShot("bell", t, { freq: info.freq });
          emitNote({
            voice: "ambient", kind: "bell", freq: info.freq, t: t, durS: 5.5,
            deg: info.deg, oct: info.oct, manner: "cave",
          });
          return;
        }
        var o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(info.freq, t);
        var g = c.createGain();
        o.connect(g); g.connect(run.layAmb);
        PJ2.Voice.env(g.gain, t, [[0.006, 0.022], [5.2, 0.001], [0.5, 0]]);
        o.start(t);
        o.stop(t + 6.0);
        var h = c.createOscillator(); // the crack: an inharmonic upper partial
        h.type = "sine";
        h.frequency.setValueAtTime(info.freq * 2.76, t);
        var hg = c.createGain();
        h.connect(hg); hg.connect(run.layAmb);
        PJ2.Voice.env(hg.gain, t, [[0.004, 0.008], [2.2, 0.0008], [0.3, 0]]);
        h.start(t);
        h.stop(t + 2.8);
        emitNote({
          voice: "ambient", kind: "bell", freq: info.freq, t: t, durS: 5.5,
          deg: info.deg, oct: info.oct, manner: "fen",
        });
      }

      // -- THE KEEN (weight 6, far-field): one distant wordless cry on the
      // chant's own body — the human trace that makes the rite a rite. The
      // witch_cackle's dignified descendant. Field degree 1 or 5 an octave
      // up, steady tone + vibrato (no gliss: even grief keeps the key).
      function keen(t) {
        var deg = rng.chance(0.6) ? 1 : 5;
        var durS = rng.rnd(2.5, 4.5);
        var tok = run.budget.claim(12, t + durS + 0.3);
        if (!tok) return;
        run.tokens.push(tok);
        var freq = run.field.degFreq(deg, 1);
        if (caveNow) caveShot("keen", t, { durS: durS });
        else renderChantNote(run.layAmb, freq, t, durS, 0.014, walkVowel(), wxAt(t), null, "ambient");
        emitNote({
          voice: "ambient", kind: "keen", freq: freq, t: t, durS: durS,
          deg: deg, oct: 1, manner: caveNow ? "cave" : "fen",
        });
      }

      function oneShot(t) {
        var iv = curIntensity(t);
        var tide = curTidePos();
        var wx = wxAt(t);
        // Weights shape WHICH sound fires, never HOW OFTEN (one fire = one
        // event; the gap law below owns the density). Tide-near favors
        // iron and chains; tide-far favors thunder; wetTilt gates thunder up.
        var what = rng.pickW([
          ["gust", 16],
          ["ember", 14],
          ["stone", 10],
          ["chains", 10 * (0.6 + 0.8 * tide)],
          ["raven", 10],
          ["thunder", 10 * (0.5 + Math.max(0, wx.wetTilt - 0.4)) * (1.3 - 0.6 * tide)],
          ["bell", 8 * (0.25 + 1.5 * tide)],
          ["keen", 6],
        ]);
        // rc.44 - TONIGHT'S ROOM, drawn per one-shot on the stop's own fork
        // AFTER the pool's own weighted draw, so the sky says the same thing
        // at the same moment whichever room it says it in.
        caveNow = run.streams.ambCave.next() < shareOf("ambient", "cave", "cave");
        try {
          if (what === "gust") poolGust(t);
          else if (what === "ember") emberPops(t);
          else if (what === "stone") stoneGrind(t);
          else if (what === "chains") chains(t);
          else if (what === "raven") raven(t);
          else if (what === "thunder") farThunder(t, rng, 1.0, "ambient", caveNow);
          else if (what === "bell") ironBell(t);
          else if (what === "keen") keen(t);
        } catch (e) { /* a missing one-shot is just a darker treeline */ }
        caveNow = false;
        // THE GAP LAW — the Library's, verbatim (plus the desk's density
        // knob, def 1 = as-composed): density within the family contract by
        // construction.
        // rc.35: density is WEATHER — the dark speaks more freely for a
        // while, then less. Timing only; no level moves.
        var next = rng.rnd(20, 60) * (1.3 - 0.6 * iv - 0.15 * tide) * gmAt(t) / wWx("ambient", "density", t);
        lane.at(t + Math.max(8, next), oneShot);
      }
      lane.at(run.t0 + rng.rnd(8, 20), oneShot);
    }

    // ========================================================================
    // THE HARMONY LANE — the pose rotation's pulse: 22â40 s, slower at the
    // evening's edges, quicker under concentration (band never escaped).
    // One pickW per step (pose mode's contract); a step that lands on the
    // same pose (impossible with these no-self rows, but guarded) or on
    // the row-less "afterimage" hold narrates nothing.
    // ========================================================================
    function startHarmonyLane() {
      var lane = run.clock.lane("harmony");
      var rng = run.streams.harmonyLane;
      function periodAt(t) {
        var st = curSceneType();
        var iv = curIntensity(t);
        var base = (st === "gathering" || st === "afterimage") ? 0.75
          : (st === "invocation") ? 0.3
          : 0.5;
        var pos = clamp(base + (rng.next() - 0.5) * 0.5 - 0.25 * iv, 0, 1);
        return 22 + 18 * pos;
      }
      function stepFn(t) {
        try {
          var before = run.harmony.current().name;
          run.harmony.step(t);
          var after = run.harmony.current().name;
          if (after !== before) {
            emitEvent({ type: "pose", pose: after, rootDeg: 0, via: "step", t: t });
            hornConsider("pose", t, after); // rc.23: the treeline may answer the turn
            newVoicesConsider("pose", t);   // rc.32: and so may the five
          }
        } catch (e) { /* a stuck pose is still a pose */ }
        lane.at(t + periodAt(t), stepFn);
      }
      lane.at(run.t0 + periodAt(run.t0), stepFn);
    }

    // ========================================================================
    // DARKENING ARRIVALS — where a Library boundary would cadence, a
    // Sycorax boundary DARKENS: pose forced to "sting" at the exact tB, the
    // gurdy's sub-octave sunk in and its lowpass closed ~15% for a window,
    // and (drawn ~0.7) a two-part ORGANUM pad — the open fifth {0,5} under
    // whatever line is keening — breathing across the seam on the chant's
    // own throat, at joint level. No flourishes, no lifts: an arrival that
    // makes the room slightly worse.
    // ========================================================================
    function organumArrivalPad(tB) {
      var rng = run.streams.arrivals;
      var durS = rng.rnd(9, 13);          // draws first, unconditionally
      var padRoll = rng.chance(0.7);
      if (!padRoll) return;
      var t = tB - durS * 0.65;           // blooms before, releases after tB
      var duo = null;
      try { duo = run.harmony.voiceConsort(2, { top: 5 }); } catch (e) { duo = null; }
      if (!duo || duo.length !== 2) duo = [0, 5];
      var tok = run.budget.claim(22, t + durS + 0.3);
      if (!tok) return;
      run.tokens.push(tok);
      var vowel = walkVowel();
      for (var i = 0; i < 2; i++) {
        var freq = run.field.degFreq(duo[i], -1); // low: under the texture
        renderChantNote(run.layAmb, freq, t, durS, 0.014, vowel, wxAt(t), null);
        emitNote({
          voice: "chant", kind: "organum-pad", freq: freq, t: t, durS: durS,
          deg: duo[i], oct: -1,
        });
      }
      emitEvent({ type: "organum", top: duo[1], low: duo[0], parts: 2, t: t, via: "arrival" });
    }

    function scheduleArrival(tB, toType) {
      var lane = run.clock.lane("arrival");
      lane.at(tB - 9.5, function () {
        if (!run || !run.live) return;
        organumArrivalPad(tB);
      });
      lane.at(tB, function (t) {
        if (!run || !run.live) return;
        setPoseIfNew("sting", t, "arrival");
        run.darkenUntil = t + 25;   // the lowpass closes ~15% for a while
        run.forceSubUntil = t + 30; // the sub-octave sinks in
        emitEvent({ type: "arrival", to: toType, t: t });
        hornConsider("arrival", t, "sting", toType); // rc.23/rc.32: the darkening
        newVoicesConsider("arrival", t, toType);     // may gain its fundament
      });
    }

    // ========================================================================
    // THE CUT — the moment the observer is noticed. Lives entirely in
    // gain-land on the DEDICATED cutGain over the landscape sum (gurdy +
    // noise bed + breath-bed + ambient + grit); never touches master; one
    // writer on the param; conductor intensity stays continuous throughout
    // (the 0.02/0.5 s ruler holds unconditionally).
    // ========================================================================

    // The indrawn breath, tB â 0.6: reverse-enveloped bandpass noise at
    // ambient level — the treeline inhaling before the eyes turn.
    function indrawnBreath(t) {
      var tok = run.budget.claim(3, t + 0.8);
      if (!tok) return;
      run.tokens.push(tok);
      var c = ctx;
      var n = PJ2.Voice.noiseBuffer.source(c, 30);
      var bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.linearRampToValueAtTime(1600, t + 0.55); // rising — inhaled
      bp.Q.setValueAtTime(1.4, t);
      var g = c.createGain();
      n.connect(bp); bp.connect(g); g.connect(run.layAmb);
      PJ2.Voice.env(g.gain, t, [[0.5, 0.022], [0.08, 0]]); // swell, then cut off
      n.start(t, n.randomOffset);
      n.stop(t + 0.7);
      emitNote({ voice: "cut", kind: "indrawn-breath", freq: null, t: t, durS: 0.58 });
    }

    // Plan the cut at invocation entry; fire it at the exact boundary tB.
    function planCut(tB, tide) {
      var rng = run.streams.cut;
      var sev = clamp(0.4 + 0.6 * tide, 0, 1);
      var hold = 3 + 5 * sev;                 // â [5, 8] at sev â¥ 0.4
      var dip = 0.28 - 0.14 * sev;            // â [0.14, 0.224]
      var ret = rng.rnd(2.5, 4);
      var appDeg = rng.pickW([[1, 3], [5, 2], [4, 1]]); // the apparition's tone: keening degrees
      run.cut = {
        tB: tB, end: tB + hold, sev: sev, dip: dip, holdS: hold, retS: ret,
        appDeg: appDeg, fired: false,
      };
      var lane = run.clock.lane("cut");
      lane.at(tB - 0.6, function (t) {
        if (!run || !run.live) return;
        indrawnBreath(t);
      });
      // rc.32 — the five auditioned voices END at tB. Their entry gate has
      // refused every onset since tB − 4, so nothing can be registered inside
      // this last second; the ride down is written a whole second early so
      // there is lookahead left to write it with.
      lane.at(tB - 1, function () { killNewVoicesAt(tB); });
      lane.at(tB, function (t) { fireCut(t); });
    }

    function fireCut(t) {
      if (!run || !run.live || !run.cut || run.cut.fired) return;
      var cut = run.cut;
      cut.fired = true;
      run.lastCutSeverity = cut.sev; // the bruise the next evening inherits
      // The sink, if this evening drew one, executes AT the cut — the rite
      // resumes a half-step lower on the far side of the hush.
      if (run.seaChange && !run.seaChange.done && run.seaChange.atCutT === cut.tB) {
        executeSinkAt(t);
      }
      // Percussion stops MID-GESTURE: the lane's pending strokes (a cluster
      // half-spent, a pair half-answered) die where they stand. The idle
      // pulse re-arms after the hush; the proto-drum lane is untouched —
      // the hush keeps its heart.
      try { run.clock.lane("percussion").cancelAll(); } catch (e) {}
      run.clock.lane("cut").at(cut.end + 1, percPulse);
      // The gain move: one writer, one schedule — anchored at 1, down to
      // the dip in 0.25 s, held, returned over 2.5â4 s into the afterimage.
      var g = run.cutGain.gain;
      if (typeof g.cancelScheduledValues === "function") g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(cut.dip, t + 0.25);
      g.setValueAtTime(cut.dip, t + cut.holdS);
      g.linearRampToValueAtTime(1, t + cut.holdS + cut.retS);
      emitEvent({
        type: "cut", t: t, severity: cut.sev, dip: cut.dip,
        holdS: cut.holdS, returnS: cut.retS,
      });
      // THE HUSH IS INHABITED: ~1.2 s in, ONE waterphone apparition (v1's
      // long 0.55-gain shape) — the only melodic sound allowed inside; it
      // bypasses the air (the cut suspends the parliament) and the hush
      // gate (it IS the exception the gate protects).
      var appT = t + 1.2;
      var appDur = Math.max(3.5, cut.holdS + cut.retS * 0.8); // rings past the return
      run.clock.lane("cut").at(appT, function (ta) {
        if (!run || !run.live) return;
        var tok = run.budget.claim(30, ta + appDur + 0.6);
        if (!tok) return;
        run.tokens.push(tok);
        var freq = run.field.degFreq(cut.appDeg, 0); // post-sink field, if any
        var env = renderWaterphoneNote(mixOut("waterphone", run.poolMel.at(0)), freq, ta, appDur, 0.55, run.streams.cut, run.delaySendWater);
        try { env.connect(run.throatSendWater); } catch (e2) {}
        emitNote({
          voice: "waterphone", kind: "apparition", freq: freq, t: ta,
          durS: appDur, deg: cut.appDeg, oct: 0, velocity: 0.55,
        });
      });
      run.clock.lane("cut").at(t + cut.holdS, function (te) {
        emitEvent({ type: "cut-return", t: te, returnS: cut.retS });
      });
    }

    // ---- the sink (the rare sea change: stasis getting worse) ----------------
    // Pure tonic multiply (Ã2^(â1/12), same mode) through the profile's
    // ratio target — the accepted reroot-ratchet quirk (pj2-harmony.js:508)
    // is never on this path. Carried degrees just sound lower; the pose
    // persists (harmony keeps it); the cavern's throat retunes HERE and
    // only here, inside the hush where its 0.3 s fade-swap-fade can never
    // be heard splicing.
    function executeSinkAt(t) {
      if (!run || !run.live || !run.seaChange || run.seaChange.done) return;
      run.seaChange.done = true;
      var res = null;
      try { res = run.harmony.executeSeaChange(run.seaChange.target); } catch (e) { res = null; }
      try { run.throat.retune(throatFreqs(run.field)); } catch (e2) {}
      emitEvent({
        type: "seachange", target: run.seaChange.target,
        name: (res && res.name) || "sink",
        pivotDegs: (res && res.pivotDegs) ? res.pivotDegs : null,
        field: { tonicHz: run.field.tonicHz, mode: run.field.mode },
        t: t,
      });
    }

    // The cavern's throat tuning: dark combs at degrees {0, 1, 5, 0+oct} —
    // the final, the flat second, the fifth, the octave: the keen's own
    // skeleton, read from the LIVE field at (re)tune time.
    function throatFreqs(field) {
      return [
        field.degFreq(0, 0), field.degFreq(1, 0),
        field.degFreq(5, 0), field.degFreq(0, 1),
      ];
    }

    // ========================================================================
    // ROOMS — balances lean wide (the cavern): gathering 0.45, processional
    // 0.55, circling 0.5, invocation 0.65, afterimage 0.75; ramped 12â20 s,
    // wetTilt nudging Â±0.05. Percussion registers close-biased (a drum is
    // HERE; everything else is THERE).
    // ========================================================================
    var ROOM_BALANCE = {
      "gathering": 0.45, "processional": 0.55, "circling": 0.5,
      "invocation": 0.65, "afterimage": 0.75,
    };
    function setSceneRoom(evt) {
      var rampS = run.streams.rooms.rnd(12, 20); // draw FIRST, unconditionally
      var wx = wxAt(evt.t);
      var base = (ROOM_BALANCE[evt.scene] != null) ? ROOM_BALANCE[evt.scene] : 0.5;
      var bal = clamp(base + 0.1 * (wx.wetTilt - 0.5), 0, 1);
      run.roomBalance = bal;
      try { run.roomBlend.setBalance(bal, rampS); } catch (e) {}
    }

    // ========================================================================
    // THE FOLLOWER — every 0.5 s, anchored short ramps, shadowed values
    // (never read .value mid-ramp):
    //   gurdyLevel  — the bed breathes with intensity (never zero: the seam)
    //   noiseLevel  — HARD-SLAVED â¤ 0.8 Ã gurdyLevel at every endpoint
    //                 (both ramp linearly over the same half-second, so the
    //                 inequality holds at every instant in between — that
    //                 is the noise ceiling, assertable);
    //                 rides murk Â±20%, intensity, and the bruise's murky
    //                 opening (fading over the gathering)
    //   breathLevel — treeline murmur above intensity 0.06
    //   gritBlend   — intensity Ã gritTilt, â¤ 0.15 in gathering/afterimage,
    //                 hard cap 0.5 at the invocation peak
    // Plus token hygiene (the family housekeeping beat).
    // ========================================================================
    function startFollower() {
      var lane = run.clock.lane("follow");
      function follow(t) {
        var iv = curIntensity(t);
        var st = curSceneType();
        var wx = wxAt(t);
        var K = 0.34;
        var gTarget = 0.10 + 0.55 * iv;
        var gNext = run.gurdyCur + (gTarget - run.gurdyCur) * K;
        // the bruise opens the evening murkier, fading with the gathering
        var bruiseBump = (st === "gathering") ? run.bruise * 0.15 * (1 - curSceneX()) : 0;
        var nTarget = (0.05 + 0.5 * iv) * (0.8 + 0.4 * wx.murk) * (1 + bruiseBump);
        var nNext = run.noiseCur + (nTarget - run.noiseCur) * K;
        if (nNext > 0.8 * gNext) nNext = 0.8 * gNext; // THE CEILING, hard
        var bTarget = (iv < 0.06) ? 0 : clamp((iv - 0.06) / 0.3, 0, 1) * 0.9;
        var bNext = run.breathCur + (bTarget - run.breathCur) * K;
        var sceneCap = (st === "gathering" || st === "afterimage") ? 0.15 : GRIT_BLEND_CAP;
        var grTarget = Math.min(sceneCap, clamp(iv * (0.5 + 0.5 * wx.gritTilt), 0, GRIT_BLEND_CAP));
        var grNext = run.gritCur + (grTarget - run.gritCur) * K;
        run.gurdyLevel.gain.setValueAtTime(run.gurdyCur, t);
        run.gurdyLevel.gain.linearRampToValueAtTime(gNext, t + 0.5);
        run.noiseLevel.gain.setValueAtTime(run.noiseCur, t);
        run.noiseLevel.gain.linearRampToValueAtTime(nNext, t + 0.5);
        run.breathLevel.gain.setValueAtTime(run.breathCur, t);
        run.breathLevel.gain.linearRampToValueAtTime(bNext, t + 0.5);
        run.gritBlend.gain.setValueAtTime(run.gritCur, t);
        run.gritBlend.gain.linearRampToValueAtTime(grNext, t + 0.5);
        run.gurdyCur = gNext;
        run.noiseCur = nNext;
        run.breathCur = bNext;
        run.gritCur = grNext;
        // token hygiene (pj2-library pattern)
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
    // CONDUCTOR-EVENT WIRING — the seam carries the ghost AND the bruise;
    // each plan draws its rare sink; each scene entry re-aims the rooms,
    // arms the boundary it will end on (arrival darkening / the cut), and
    // starts the scene's own percussion figure (walk / clusters).
    // ========================================================================
    function onSceneEvent(evt) {
      if (!run.perfScenes) return;
      var toIdx = evt.idx + 1;
      var isSeam = toIdx >= run.perfScenes.length;
      var toType = isSeam ? "gathering" : run.perfScenes[toIdx];
      var tB = evt.t + evt.durS;

      if (evt.scene === "processional") {
        // The walk: a barely-gridded period drawn PER SCENE, Â±20% jitter
        // per stroke (the anti-groove law's one concession to pulse).
        run.walkPeriod = run.streams.percWalk.rnd(2.4, 3.4);
        emitEvent({ type: "percussion", mode: "walk", periodS: run.walkPeriod, t: evt.t });
        run.clock.lane("percussion").at(evt.t + run.streams.percWalk.rnd(1.5, 4), walkStroke);
      }
      if (evt.scene === "invocation") {
        // 1â3 accelerating clusters, placed across the scene (a cluster
        // straddling the cut is cut off unfinished — the gesture).
        var rngC = run.streams.cluster;
        var nC = rngC.rint(1, 3);
        // rc.37: fewer clusters in a thinned invocation — never fewer than
        // one (the scene's gesture stands), and exactly nC at presence 1.
        // At rc.40's 0.85 the rounding lands back on nC for all three counts,
        // so the invocation keeps its clusters and the thinning of the
        // strokes is carried by the walk and the answers alone.
        nC = Math.max(1, Math.round(nC * presK("percussion")));
        for (var i = 0; i < nC; i++) {
          var tC = evt.t + evt.durS * ((i + rngC.rnd(0.2, 0.8)) / nC);
          run.clock.lane("percussion").at(tC, function (tc) {
            if (curSceneType() === "invocation" && !inHush(tc)) fireCluster(tc);
          });
        }
        // THE CUT fires whenever an invocation exists.
        if (run.seaChange && !run.seaChange.done && run.seaChange.atSceneIdx === toIdx) {
          run.seaChange.atCutT = tB; // the sink executes AT the cut
        }
        planCut(tB, evt.tidePos != null ? evt.tidePos : curTidePos());
      }
      if (evt.scene === "afterimage") {
        // The evening's only consonance — the bare {0,5} fifth, used
        // nowhere else. Nothing moves ONTO it: residue, not resolution.
        setPoseIfNew("afterimage", evt.t, "afterimage");
        hornFinalCall(evt); // rc.23: one far call may answer, after the hush
      }
      // Darkening arrivals at boundaries into the rite's active scenes.
      // Never into the afterimage (the cut — or plain dispersal — owns that
      // boundary) and never at the seam (the joint machinery owns seams).
      if (!isSeam && (toType === "processional" || toType === "circling" || toType === "invocation")) {
        scheduleArrival(tB, toType);
      }
    }

    function handleConductorEvent(evt) {
      if (!run || !run.live) return;
      try {
        if (evt.type === "performance" && evt.phase === "end") {
          try { run.pendingGhost = run.motif.extractGhost(); } catch (e) { run.pendingGhost = null; }
        } else if (evt.type === "performance" && evt.phase === "begin") {
          run.perfScenes = evt.scenes ? evt.scenes.slice() : null;
          run.perfN = evt.n;
          dressWander(evt.n);   // rc.35: a new evening, a slightly different instrument
          drawCast(evt);        // rc.37/rc.44: who sits out, and what tonight wears
          // THE BRUISE: last evening's cut severity, one scalar, carried.
          run.bruise = run.lastCutSeverity;
          run.lastCutSeverity = 0;
          run.cut = null;
          emitEvent({ type: "bruise", value: run.bruise, t: evt.t });
          // The proto-drum's gate: a deep cut leaves the next evening
          // warier — the heartbeat gates in bruiseÂ·0.3 earlier.
          run.protoGateT = evt.t + run.streams.protodrum.rnd(6, 14) * (1 - 0.3 * run.bruise);
          // Exit the afterimage pose (it has no markov row — it would hold
          // forever): a bruised evening opens on "sting", else on "coil".
          setPoseIfNew(run.bruise > 0.5 ? "sting" : "coil", evt.t, "opening");
          run.fluteCount = 0;
          // "2-3 utterances an evening, HARD" — and the cap, not the chance,
          // is what the flute actually meets, so presence thins the CAP:
          // exactly 2 at the shipped 0.8 (it was 1-2 at rc.37's 0.6), and
          // 2-3 at presence 1. Never zero — an absence is how the flute goes
          // silent, not a rate.
          run.fluteMax = Math.max(1, Math.round(
            run.streams.boneflute.rint(2, 3) * presK("boneflute")));
          run.hornFinalDone = false; // each evening earns its own far call (rc.23)
          try { run.motif.newPerformance(evt.tidePos); } catch (e) {}
          if (run.pendingGhost) {
            try { run.motif.seedGhost(run.pendingGhost); } catch (e) {}
            run.pendingGhost = null;
          }
          // THE SINK's coin: p â 0.12, "at-the-treeline" evenings only.
          // The profile's p is a function of the tidePos we pass — and we
          // pass the LABEL GATE (1 when the tide stands at the treeline,
          // else 0), so the profile reads p(1) = 0.12 or p(0) = 0. The
          // chance draw happens every evening either way — stream
          // discipline (rng.chance(0) still spends its draw).
          run.seaChange = null;
          try {
            var sceneList = [];
            if (evt.scenes) {
              for (var si = 0; si < evt.scenes.length; si++) {
                sceneList.push({ type: evt.scenes[si] });
              }
            }
            var sc = run.harmony.planSeaChange({
              sceneList: sceneList,
              tidePos: (evt.tideLabel === "at-the-treeline") ? 1 : 0,
            });
            if (sc && isFinite(sc.atSceneIdx) &&
                sc.atSceneIdx >= 1 && evt.scenes && sc.atSceneIdx < evt.scenes.length) {
              run.seaChange = { atSceneIdx: Math.floor(sc.atSceneIdx), target: sc.target, done: false, atCutT: null };
            }
          } catch (e) {}
        } else if (evt.type === "scene") {
          setSceneRoom(evt);
          onSceneEvent(evt);
        }
      } catch (e) { /* structure wiring must never stop the transport */ }
    }

    // ========================================================================
    // PLAY / STOP — the Library's semantics, verbatim: stop fades the bus
    // ~1.5 s, cancels the lanes, settles the budget's books, suspends the
    // ctx; play after stop RESTARTS THE WHOLE SEEDED RUN from evening 1
    // (reproducibility over tide continuity — the documented family choice).
    // ========================================================================
    function ensureCtx() {
      if (ctx) return ctx;
      var AC = (typeof window !== "undefined") ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) throw new Error("PJ2.Sycorax: no AudioContext available");
      ctx = new AC();
      return ctx;
    }

    var LANE_NAMES = [
      "gurdy", "horn", "noisebed", "breath", "protodrum", "percussion",
      "chant", "rebec", "waterphone", "boneflute", "ambient",
      // rc.32 — the blade's and the pot's opportunity clocks, plus the jaw
      // harp's TEARDOWN lane (it schedules no sound: it disconnects the comb
      // once the twang has rung out, which is why it carries no rate).
      "blade", "cauldron", "jawharp",
      "follow", "harmony", "arrival", "cut",
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
      try { if (r.roomWide && r.roomWide.output.disconnect) r.roomWide.output.disconnect(); } catch (e) {}
      try { if (r.delay && r.delay.output.disconnect) r.delay.output.disconnect(); } catch (e) {}
      try { if (ctx && typeof ctx.suspend === "function") ctx.suspend(); } catch (e) {}
      stopping = false;
    }

    function play() {
      if (playing) return;
      if (run && !run.finalized) finalize(run);
      var c = ensureCtx();
      try { if (typeof c.resume === "function") c.resume(); } catch (e) {}

      // ---- one fresh world per play, all of it derived from the seed ----
      var master = PJ2.Rand.stream(seed);
      var clock = PJ2.Clock.create(c, { tickMs: 25, aheadS: 0.25 });
      var bus = PJ2.Voice.buildBus(c, { volume: masterVol, title: "Prospero's Jukebox v2 — Sycorax" });
      for (var ai = 0; ai < analysers.length; ai++) {
        try { bus.attachAnalyser(analysers[ai]); } catch (e) {}
      }
      var streams = {
        conductor: master.fork("conductor"),
        gurdy: master.fork("gurdy"),
        noisebed: master.fork("noisebed"),
        breath: master.fork("breath"),
        protodrum: master.fork("protodrum"),
        percussion: master.fork("percussion"),
        percWalk: master.fork("percussion:walk"),
        cluster: master.fork("percussion:cluster"),
        chant: master.fork("chant"),
        rebec: master.fork("rebec"),
        waterphone: master.fork("waterphone"),
        boneflute: master.fork("boneflute"),
        ambient: master.fork("ambient"),
        joints: master.fork("joints"),
        air: master.fork("air"),
        motif: master.fork("motif"),
        harmony: master.fork("harmony"),
        harmonyLane: master.fork("harmony:lane"),
        arrivals: master.fork("arrivals"),
        cut: master.fork("cut"),
        // the sound's own dice (Phase 3 discipline): nothing timbral can
        // ever re-roll a note
        weather: master.fork("weather"),
        fx: master.fork("fx"),
        vowels: master.fork("vowels"),
        // rc.23: the under-voice's own dice. A label-hashed fork re-rolls
        // nothing — every stream above is byte-identical to the horn-less
        // engine (the stream-purity contract, as the Library's cello).
        horn: master.fork("horn"),
        delaySend: master.fork("delaySend"),
        rooms: master.fork("rooms"),
        // rc.44 — THE STOPS' EIGHT NEW label-hashed forks: the evening's
        // manners (one coin per stop per seam, in a fixed order) and one
        // share draw per sounding, per stop — plus each body's OWN dice (a
        // rattle's clacks, a rockfall's stones), which come off the stop's
        // fork too so a manner cannot move the voice's own stream. Nothing
        // pre-existing gains a draw, which is the whole reason the identity
        // rows can be asked for at all.
        cast: master.fork("cast"),
        gurdyGlass: master.fork("gurdy:glass"),
        hornConch: master.fork("horn:conch"),
        rebecGlass: master.fork("rebec:glass"),
        waterCrystal: master.fork("waterphone:crystal"),
        percBones: master.fork("percussion:bones"),
        ambCave: master.fork("ambient:cave"),
        bladeWhale: master.fork("blade:whale"),
        // rc.32: five more label-hashed forks. A fork made from the birth
        // seed is independent of everything already drawn, so adding these
        // re-rolls nothing above — the sound-diversity pass buys its dice
        // rather than borrowing them.
        bullroarer: master.fork("bullroarer"),
        overtone: master.fork("overtone"),
        jawharp: master.fork("jawharp"),
        blade: master.fork("blade"),
        cauldron: master.fork("cauldron"),
      };

      if (!PJ2.Motif || !PJ2.Motif.create || !PJ2.Harmony || !PJ2.Harmony.create) {
        throw new Error("PJ2.Sycorax: needs pj2-motif.js and pj2-harmony.js loaded first");
      }
      if (!PJ2.Fx || !PJ2.Fx.delay || !PJ2.Fx.sympathetic || !PJ2.Fx.weather || !PJ2.Fx.roomBlend) {
        throw new Error("PJ2.Sycorax: needs pj2-fx.js loaded (after pj2-voice.js, before pj2-air.js)");
      }

      // TWO ROOMS: close = the fireside stone (dark, 2.6 s); wide = THE
      // CAVERN — v1's decay 4.5 plus a breath (4.8 s), preDelay 0.04, a
      // dark brightness exponent and water-on-stone ripple (~0.08).
      var roomClose = PJ2.Voice.reverb(c, { decayS: 2.6, preDelayS: 0.02, wet: 0.3, brightness: 1.6, ripple: 0.03 });
      var roomWide = PJ2.Voice.reverb(c, { decayS: 4.8, preDelayS: 0.04, wet: 0.35, brightness: 2.1, ripple: { depth: 0.08, hz: 0.4 } });
      roomClose.output.connect(bus.input);
      roomWide.output.connect(bus.input);
      var roomBlend = PJ2.Fx.roomBlend(c, { close: roomClose, wide: roomWide, balance: 0.45 });

      var budget = PJ2.Voice.budget(36).bindClock(clock);
      var field = PJ2.Pitch.field({ tonicHz: 311, mode: "sycorax", tuning: "et" }); // v1's Eb ghost world

      // LAYERS. The landscape sum (gurdy + noise bed + breath-bed + ambient
      // + grit) flows through THE CUTGAIN — the cut's one writer-owned
      // param. The proto-drum (layProto) routes AROUND it (the hush keeps
      // its heart); percussion is silenced by scheduling, not gain, so it
      // sits beside the cut too; melody was never the landscape's to duck.
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

      var cutGain = c.createGain();
      cutGain.gain.setValueAtTime(1, clock.now());
      cutGain._pj2Tag = "cutGain"; // harness handle: param inspection
      var gurdyBreath = c.createGain();
      gurdyBreath.gain.setValueAtTime(1, clock.now());
      gurdyBreath._pj2Tag = "gurdyBreath"; // harness handle: the seam's own bus
      var gurdyLevel = c.createGain();
      gurdyLevel.gain.setValueAtTime(0.10, clock.now());
      gurdyBreath.connect(gurdyLevel);
      var mixGurdy = mAttach("gurdy", c.createGain(), 1); // the mixer's own stage, beside the follower's
      gurdyLevel.connect(mixGurdy);
      mixGurdy.connect(cutGain);
      // rc.23: the horn sums into cutGain like all landscape — the cut
      // ducks it with the rest of the night. Per-note envelopes carry its
      // level (no follower stage); the mixer layer is the whole chain.
      var layHorn = mAttach("horn", c.createGain(), 1);
      layHorn.connect(cutGain);
      var noiseLevel = c.createGain();
      noiseLevel.gain.setValueAtTime(0, clock.now());
      noiseLevel._pj2Tag = "noiseLevel"; // harness handle: per-source peak inspection
      var mixNoise = mAttach("noise", c.createGain(), 1);
      noiseLevel.connect(mixNoise);
      mixNoise.connect(cutGain);
      var breathLevel = c.createGain();
      breathLevel.gain.setValueAtTime(0, clock.now());
      var mixBreath = mAttach("noise", c.createGain(), 1); // the murk is ONE user layer
      breathLevel.connect(mixBreath);
      mixBreath.connect(cutGain);
      var layAmb = mAttach("ambient", c.createGain(), 1);
      layAmb.connect(cutGain);
      // rc.32 — the five. The bullroarer, the overtone chant and the pot are
      // landscape and the ambient pool's own kin: they sum into cutGain, so
      // the cut ducks them with the night before it ends them at tB. The jaw
      // harp is melodic (never ducked — melody was never the landscape's to
      // duck) but takes no panner seat: it has its own room registration
      // instead. The blade is wired further down, into the CAVERN alone.
      var layBull = mAttach("bullroarer", c.createGain(), 1);
      layBull.connect(cutGain);
      var layOver = mAttach("overtone", c.createGain(), 1);
      layOver.connect(cutGain);
      var layCauldron = mAttach("cauldron", c.createGain(), 1);
      layCauldron.connect(cutGain);
      var layJaw = mAttach("jawharp", c.createGain(), 1);
      var layBlade = mAttach("blade", c.createGain(), 1);
      var layPerc = mAttach("percussion", c.createGain(), 1);
      var layProto = mAttach("percussion", c.createGain(), 1); // the heartbeat is percussion to the user
      var layMel = c.createGain();
      layMel.gain.setValueAtTime(1, clock.now()); // NOT mixer-owned: the per-seat wraps split the voices upstream
      var layThroat = c.createGain();
      layThroat.gain.setValueAtTime(1, clock.now()); // unowned return — see the MIX_LAYERS note

      // THE GRIT BUS (landscape-only, tagged for graph inspection):
      //   gurdy lowpass ââ gritSendGurdy(0.10) ââ
      //   noiseLevel   ââ gritSendNoise(0.25)  ââ¼â shaper(0.75ÃzankyÅ, 4x)
      //   trompette    ââ gritSendTromp(0.10,  â   â makeup(0.4, DOWN)
      //                    pulsed â¤ +0.1)           â gritBlend(â¤ 0.5) â cutGain
      //
      // SEND-LEVEL ENERGY MATH (the rendered-audio soak's second lesson —
      // the k=20 curve saturates hard above ~0.05 input, and a RAILED
      // sustained buzz louder than the drone is "feedback noise" to any
      // honest ear): worst sustained gurdy into the shaper = cluster
      // ~0.14 Ã 2 (cycle overlap) Ã 0.10 send = 0.028 â curve â 0.38 â
      // Ã 0.4 makeup Ã blend â¤ 0.5 â â¤ 0.075 at the bus — grit sits WITH
      // the 0.06â0.13 drone bed, textural, never on top of it. The
      // trompette pulse (0.02 env Ã â¤0.2 send = 0.004) still bites: the
      // curve's small-signal slope is ~21Ã, which is the whole point.
      var gritShaper = c.createWaveShaper();
      try { gritShaper.curve = buildGritCurve(GRIT_AMOUNT); gritShaper.oversample = "4x"; } catch (eG) {}
      var gritMakeup = c.createGain();
      gritMakeup.gain.setValueAtTime(GRIT_MAKEUP, clock.now());
      gritMakeup._pj2Tag = "gritMakeup";
      var gritBlend = c.createGain();
      gritBlend.gain.setValueAtTime(0, clock.now());
      gritBlend._pj2Tag = "gritBlend";
      gritShaper.connect(gritMakeup);
      gritMakeup.connect(gritBlend);
      gritBlend.connect(cutGain);
      // The gurdy-family grit shares (bed + trompette) converge through ONE
      // mixer stage before the shaper — gritSendTromp's own param stays the
      // drum pulses' (one writer per param, ever), so the gurdy layer's
      // scaling gets its own node instead of a share of a pulsed send.
      var mixGritGurdy = mAttach("gurdy", c.createGain(), 1);
      mixGritGurdy.connect(gritShaper);
      var gritSendGurdy = c.createGain();
      gritSendGurdy.gain.setValueAtTime(0.10, clock.now());
      gritSendGurdy._pj2Grit = "gurdy";
      gritSendGurdy.connect(mixGritGurdy);
      var gritSendNoise = mAttach("noise", c.createGain(), 0.25); // static send: clean mixer reuse
      gritSendNoise._pj2Grit = "noisebed";
      gritSendNoise.connect(gritShaper);
      var gritSendTromp = c.createGain();
      gritSendTromp.gain.setValueAtTime(TROMP_BASE, clock.now());
      gritSendTromp._pj2Grit = "trompette";
      gritSendTromp.connect(mixGritGurdy);
      noiseLevel.connect(gritSendNoise); // the bed's grit share (partial)
      // rc.23: the horn's grit tap hangs off layHorn ITSELF (post-mixer),
      // so the layer fader scales voice and shadow together. Energy math
      // (rc.25 level): 0.028 peak x 0.08 send = 0.0022 into the shaper —
      // small-signal territory, where the curve's ~21x slope gives the
      // far horn its bronze edge without rivaling the bed's grit share.
      var gritSendHorn = c.createGain();
      gritSendHorn.gain.setValueAtTime(0.08, clock.now());
      gritSendHorn._pj2Grit = "horn";
      layHorn.connect(gritSendHorn);
      gritSendHorn.connect(gritShaper);

      roomBlend.register("landscape", cutGain, 0.08);
      roomBlend.register("percussion", layPerc, -0.25); // a drum is HERE
      roomBlend.register("proto", layProto, -0.15);
      roomBlend.register("melody", layMel, -0.05);
      roomBlend.register("throat", layThroat, 0.2);     // the throat is deep
      // rc.32: the jaw harp sits where the melodic voices sit (it is played
      // in the circle, close), one step nearer than the landscape.
      roomBlend.register("jawharp", layJaw, -0.05);
      // THE BLADE IS NOT REGISTERED HERE, and that is the design: "wide room
      // only" (PLAN §5.2d). It goes straight to the CAVERN's send — the
      // engine's most distant room, decay 4.8 s — and, below, to the seasick
      // delay wall, whose own return also lands in the cavern. The close
      // fireside stone would put a 1.7 kHz sine in the room with the
      // listener, which is exactly the startle this voice must never carry.
      layBlade.connect(roomWide.send);

      var poolMel = PJ2.Voice.pannerPool(c, layMel, 3);
      var mixWraps = {
        chant: mSlotWraps("chant", poolMel),
        rebec: mSlotWraps("rebec", poolMel),
        waterphone: mSlotWraps("waterphone", poolMel),
        boneflute: mSlotWraps("boneflute", poolMel),
      };

      // THE WEATHER — five channels (murk / breath / gapMul / wetTilt /
      // gritTilt), primes 120â600 s, all draws at build, pure math after.
      var weather = PJ2.Fx.weather(streams.weather, WEATHER_SYCORAX);

      // THE SEASICK DELAY — the clearing answers: 0.62 s, dark (damp 900),
      // feedback 0.30, drift 0.05 Hz at depth 0.008 — NEAR THE WOBBLE CAP,
      // audibly seasick by design (all inside pj2-fx's hard caps: fb â¤
      // 0.55, wet â¤ 0.4, depth â¤ 0.01). Return feeds the CAVERN's send.
      var delay = PJ2.Fx.delay(c, {
        timeS: 0.62, feedback: 0.30, damp: 900,
        driftHz: 0.05, driftDepth: 0.008, wet: 0.22,
        rng: streams.fx,
      });
      delay.output.connect(roomWide.send);
      // Per-voice sends are mixer-owned (each voice's user layer scales its
      // own echo feed; a muted cantor stops being answered by the clearing).
      var delaySendWater = mAttach("waterphone", c.createGain(), 0.5);
      delaySendWater.connect(delay.send);
      var delaySendChant = mAttach("chant", c.createGain(), 0.4);
      delaySendChant.connect(delay.send);
      var delaySendRebec = mAttach("rebec", c.createGain(), 0.35);
      delaySendRebec.connect(delay.send);
      // rc.32: the blade's half of "far and faint" — the clearing answers a
      // sound it can barely hear. Mixer-owned like the rest, so muting the
      // blade stops its echo too.
      var delaySendBlade = mAttach("blade", c.createGain(), 0.5);
      layBlade.connect(delaySendBlade);
      delaySendBlade.connect(delay.send);

      // THE CAVERN'S THROAT — Fx.sympathetic as a dark resonance bank: 4
      // combs at degrees {0, 1, 5, 0+oct}, lowpass 1200 (vs the Library
      // halo's 3000), retuned ONLY after the rare sink, at the cut.
      //
      // ENERGY LAW (learned from a rendered-audio soak, the hard way — the
      // first build fed this bank from the STANDING gurdy drone, and the
      // render showed a ×3-per-quarter-second runaway saturating the master
      // inside a second and NaN-silencing the whole graph at t ≈ 3.2 s.
      // Half of that was pj2-fx's since-fixed dB-Q resonance bug — WebAudio
      // reads lowpass/highpass .Q IN DECIBELS, so its old "Q 0.5" loop
      // filters PEAKED near cutoff and pushed the comb's true loop gain
      // past 1; the loop lowpass is now pinned at −6 dB and the loop gain
      // honestly equals fb. The other half is OURS to hold forever):
      //   1. A COMB AT fb 0.93 IS A ×14 AMPLIFIER FOR SUSTAINED INPUT
      //      (steady state 1/(1−fb) ≈ 14.3). Stable, but a standing drone
      //      parked on it would sit at fourteen times itself all evening.
      //      So: EXCITE TRANSIENTLY, NEVER FROM THE STANDING DRONE. The
      //      feeds are PERCUSSION STRIKES (true transients — a strike is
      //      what wakes a cavern) and the WATERPHONE (episodic notes),
      //      never the gurdy bed. Contribution math, worst case (charging
      //      the transients the full steady-state ×14.3 they never reach):
      //        waterphone 0.055 peak × send 0.10 × 14.3 = 0.079 in-bank
      //          × level 0.04 ≈ 0.0031 out — far-field, under the breath-bed;
      //        frame-drum strike 0.045 × send 0.06 × 14.3 = 0.039 in-bank
      //          × 0.04 ≈ 0.0015 out, ringing T60 ≈ 95 trips ≈ 0.6 s —
      //          the cavern answering the drum, then letting it go.
      //   2. DC-BLOCK THE SEND (highpass 55 Hz, Q −6 dB) — a comb loop
      //      integrates any DC lean into a standing offset.
      //   3. HARD CEILING AFTER THE BANK — a normalized tanh (amount 2.5)
      //      between the bank and its layer caps the throat's worst
      //      possible contribution at |1| × the 0.04 level even if some
      //      future browser regresses the loop math. Insurance, not tone:
      //      at whisper level the curve is within 0.1% of identity.
      var throat = PJ2.Fx.sympathetic(c, {
        nStrings: 4, freqs: throatFreqs(field),
        level: 0.04, feedback: 0.93, damp: 1200,
      });
      var throatDC = c.createBiquadFilter();
      throatDC.type = "highpass";
      throatDC.frequency.setValueAtTime(55, clock.now());
      throatDC.Q.setValueAtTime(-6, clock.now()); // dB — over-damped, flat
      throatDC.connect(throat.input);
      // Mixer-owned under their EXCITERS (the throat's return stays free):
      // a muted strike must not keep waking the cavern.
      var throatSendWater = mAttach("waterphone", c.createGain(), 0.10);
      throatSendWater.connect(throatDC);
      var throatSendPerc = mAttach("percussion", c.createGain(), 0.06);
      throatSendPerc.connect(throatDC);
      var throatCeil = c.createWaveShaper();
      try { throatCeil.curve = buildSoftCeil(2.5); throatCeil.oversample = "2x"; } catch (eTc) {}
      throat.output.connect(throatCeil);
      throatCeil.connect(layThroat);

      // THE BRAINS — harmony in POSE MODE (root pinned to i forever, the
      // five rotation poses + the setPose-only afterimage fifth, keening
      // resolution pinned to [1], organum consort with the authored
      // doubling table, anti-cadence hard-off, the sink as the only
      // reachable sea change, treeline-gated); motif with the four voice
      // characters and the responsorial ledger policy.
      var harmony = PJ2.Harmony.create({
        rng: streams.harmony,
        field: field,
        dramaturgyName: "sycorax",
        profile: {
          poses: { table: POSE_TABLE, markov: POSE_MARKOV, initial: "coil" },
          resolutionDegs: [1],   // THE KEENING LAW — every ending pulled to the flat second
          cadences: {},          // anti-cadence hard-off: zero events, zero draws
          consort: { mode: "organum", doubling: ORGANUM_DOUBLING },
          seaChange: {
            // p receives the LABEL GATE the track passes at plan time
            // (1 = at-the-treeline, 0 = anywhere else): the sink is rare
            // and only when the menace stands closest.
            p: function (tp) { return tp > 0.5 ? 0.12 : 0; },
            placementWeights: [[{ from: "invocation", to: "afterimage" }, 1]],
            targets: [[{ kind: "ratio", ratio: Math.pow(2, -1 / 12), name: "sink" }, 1]],
          },
        },
      });
      var motif = PJ2.Motif.create({
        rng: streams.motif,
        field: field,
        harmony: harmony,
        voices: {
          chant: { table: CHANT_MARKOV, weights: VOICE_WEIGHTS.chant, register: -1, walkStart: 5 },
          rebec: { table: REBEC_MARKOV, weights: VOICE_WEIGHTS.rebec, register: 0, walkStart: 0 },
          waterphone: { weights: VOICE_WEIGHTS.waterphone, register: 0 },
          boneflute: { weights: VOICE_WEIGHTS.boneflute, register: 1 },
        },
        policy: {
          // Responsorial, not conversational: the cantor posts (postP by
          // ALIASED scene — processional and circling are both "chapter"),
          // imitate-heavy, and the answers arrive LATE (18â40 s deadlines)
          // and near-verbatim, like a congregation across a clearing.
          postKinds: [["imitate", 6], ["invert", 2], ["develop", 2]],
          postDeadlineS: [18, 40],
          postP: { "settling": 0.08, "chapter": 0.3, "seizure": 0, "reverie": 0, "candle-out": 0.05 },
          seedVoices: { theme: "chant", subs: ["rebec"] },
        },
      });

      run = {
        live: true, finalized: false, finalizeId: null,
        clock: clock, bus: bus, budget: budget, field: field,
        // rc.37 — the birth seed itself, so the absences helper can make its
        // own fork off it; and the evening's cast (empty until the
        // conductor's first begin, which arrives before any lane fires).
        master: master,
        absent: [], absentMap: {}, lastAbsent: [],
        castPending: null, castEvening: 0, castPlain: true,
        // rc.44 — the evening's manners. Plain until the conductor's first
        // begin (which arrives before any lane fires), so a body reading
        // castIs() before the cast exists reads "plain", never undefined.
        cast: plainCast(),
        poolMel: poolMel,
        streams: streams, tokens: [],
        harmony: harmony, motif: motif,
        perfScenes: null, perfN: 0,
        pendingGhost: null,
        heldUtterance: { chant: null, rebec: null },
        // levels (follower shadows — telemetry + the assertable ceiling)
        cutGain: cutGain, gurdyBreath: gurdyBreath,
        gurdyLevel: gurdyLevel, noiseLevel: noiseLevel, breathLevel: breathLevel,
        gurdyCur: 0.10, noiseCur: 0, breathCur: 0, gritCur: 0,
        layAmb: layAmb, layPerc: layPerc, layProto: layProto,
        layMel: layMel, layThroat: layThroat,
        layHorn: layHorn, gritSendHorn: gritSendHorn,
        hornHoldUntil: 0,     // the hold law: one call at a time (rc.23)
        hornFinalDone: false, // one far call per evening's afterimage
        // rc.32 — the five auditioned voices: their layers, their hold laws,
        // and the register of live gates the cut ends at tB.
        layBull: layBull, layOver: layOver, layJaw: layJaw,
        layBlade: layBlade, layCauldron: layCauldron,
        delaySendBlade: delaySendBlade,
        bullHoldUntil: 0, overHoldUntil: 0, jawHoldUntil: 0,
        bladeHoldUntil: 0, cauldHoldUntil: 0,
        nvActive: [],
        mix: mix, mixWraps: mixWraps,
        // grit
        gritShaper: gritShaper, gritMakeup: gritMakeup, gritBlend: gritBlend,
        gritSendGurdy: gritSendGurdy, gritSendNoise: gritSendNoise,
        gritSendTromp: gritSendTromp,
        lastTrompPulseT: -10,
        // fx
        roomClose: roomClose, roomWide: roomWide, roomBlend: roomBlend,
        roomBalance: 0.45,
        weather: weather,
        delay: delay, delaySendWater: delaySendWater,
        delaySendChant: delaySendChant, delaySendRebec: delaySendRebec,
        throat: throat, throatSendWater: throatSendWater, throatSendPerc: throatSendPerc,
        // the rite's memory + machinery state
        bruise: 0, lastCutSeverity: 0,
        cut: null, seaChange: null,
        darkenUntil: -1, forceSubUntil: -1,
        protoGateT: 0, hbIntensity: 0.85,
        walkPeriod: 2.8, emberCenter: 600,
        fluteCount: 0, fluteMax: 3,
        vowelIdx: 0,
        t0: clock.now() + 0.08,
        conductor: null, air: null, airLimit: null,
      };
      run.vowelIdx = streams.vowels.rint(0, CHANT_VOWEL_POOL.length - 1);

      // ---- THE WANDER (rc.35) — one per layer, forked off the birth seed.
      // PJ2.Voice.wander makes its OWN forks ("wander:<layer>:touch",
      // ":weather", ":dress:<n>"), so not one draw above is re-rolled and
      // the same seed still plays the same evening. run.wbody carries the
      // few BODY-RULE dice (the jaw harp's downward sweeps) on their own
      // label-hashed fork, for the same reason.
      run.wander = {};
      for (var wlk in LAYER_PARAMS) {
        (function (lk) {
          run.wander[lk] = PJ2.Voice.wander({
            root: master,
            layer: lk,
            params: LAYER_PARAMS[lk],
            knob: function (k) { return pVal(lk, k); },
            vary: function () { return pVal(lk, "vary"); },
          });
        })(wlk);
      }
      run.wbody = { jawharp: master.fork("wander:body:jawharp") };
      dressWander(1);   // evening one, before the conductor says so

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
        return sc ? sc.overlapChance : 0.05;
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
          // rc.37: the cast rides out AFTER the begin event it belongs to.
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
      startGurdy();
      startNoiseBed();
      startBreathBed();
      startProtoDrum();
      startPercussion();
      startChant();
      startRebec();
      startWaterphone();
      startBoneflute();
      startAmbient();
      // rc.32: the bullroarer, the overtone chant and the jaw harp answer the
      // rite's own turns (the pose lane and the darkening arrivals call them);
      // only the blade and the pot carry clocks of their own.
      startBlade();
      startCauldron();

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
    // THE FACADE
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

      // ---- the wander (rc.35) — two read-only doors.
      // getWanderSpans reports, per layer and key, the span a draw may land
      // in RIGHT NOW: translated with the owner's knob and scaled by that
      // layer's `vary` (so vary 0 reports a zero-width span at the knob and
      // vary 2 reports twice the authored reach, clamped to [min, max]).
      // The lab page can draw two-thumb sliders from it; the harness checks
      // every drawn value against it.
      getWanderSpans: function () {
        var out = {};
        for (var lk in LAYER_PARAMS) {
          var defs = LAYER_PARAMS[lk], row = {};
          for (var i = 0; i < defs.length; i++) {
            var d = defs[i];
            if (!d.per) continue;
            var knob = pVal(lk, d.key), vy = pVal(lk, "vary");
            var sp = { per: d.per, knob: knob, vary: vy,
                       round: !!d.round, weights: d.weights || null };
            if (d.weights) {
              sp.lo = null; sp.hi = null;
              sp.values = [];
              for (var wi = 0; wi < d.weights.length; wi++) sp.values.push(d.weights[wi][0]);
              sp.moved = Math.abs(knob - d.def) > 1e-9;
            } else {
              var shift = knob - d.def;
              var lo = knob + vy * (d.lo + shift - knob);
              var hi = knob + vy * (d.hi + shift - knob);
              sp.lo = clamp(Math.min(lo, hi), d.min, d.max);
              sp.hi = clamp(Math.max(lo, hi), d.min, d.max);
            }
            row[d.key] = sp;
          }
          out[lk] = row;
        }
        return out;
      },
      // setWanderListener installs a tap called with (layer, key, value) at
      // every wander read — a dev/harness door (the desk never sets it), so
      // the cost when unset is one null check per read. Pass null to remove.
      setWanderListener: function (fn) {
        wanderTap = (typeof fn === "function") ? fn : null;
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
            info.pose = cur ? cur.name : null;
            info.rootDeg = cur ? cur.rootDeg : null;
          } catch (e) {}
          try { info.motif = run.motif.stats(); } catch (e) {}
          try { info.weather = wxAt(run.clock.now()); } catch (e) {}
          try { info.roomBalance = (run.roomBlend && run.roomBlend.balance) ? run.roomBlend.balance() : run.roomBalance; } catch (e) {}
          info.bruise = run.bruise;
          info.levels = {
            gurdy: run.gurdyCur, noise: run.noiseCur,
            breath: run.breathCur, grit: run.gritCur,
            gritMakeup: GRIT_MAKEUP,
          };
          info.cut = run.cut ? {
            planned: true, fired: !!run.cut.fired,
            active: run.cut.fired && run.clock.now() >= run.cut.tB && run.clock.now() <= run.cut.end + run.cut.retS,
            severity: run.cut.sev,
          } : { planned: false, fired: false, active: false, severity: 0 };
          info.percussion = {
            mode: (info.sceneType === "processional") ? "walk"
              : (info.sceneType === "invocation") ? "clusters"
              : (info.sceneType === "gathering" || info.sceneType === "afterimage") ? "heartbeat"
              : "loose",
            walkPeriodS: run.walkPeriod,
          };
          // rc.37 — tonight's cast: who is sitting this evening out.
          var absLabels = [];
          for (var abi = 0; abi < run.absent.length; abi++) {
            absLabels.push(MIX_LABELS[run.absent[abi]] || run.absent[abi]);
          }
          info.cast = {
            evening: run.castEvening || run.perfN || 0,
            plain: !!run.castPlain,
            absent: run.absent.slice(), absentLabels: absLabels,
            eligible: ABSENCE_ELIGIBLE.slice(),
            // rc.44 — …and what tonight is WEARING: one field per stop, plus
            // the dress in plain words (the same array the cast event and
            // the UI's log line carry).
            dress: (run.cast && run.cast.dress) ? run.cast.dress.slice() : [],
          };
          for (var csi = 0; csi < CAST_STOPS.length; csi++) {
            var csk = CAST_STOPS[csi].layer;
            info.cast[csk] = (run.cast && run.cast[csk]) ? run.cast[csk] : CAST_STOPS[csi].plain;
          }
          info.sink = run.seaChange ? { planned: true, done: !!run.seaChange.done } : { planned: false, done: false };
          info.tonicHz = run.field.tonicHz;
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

      // Multicast (family pattern). Notes: {voice, freq|null, t, durS,
      // deg?, oct?, kind?, mode?, velocity?, motif?, gen?, phraseKind?,
      // final?}. Events: conductor events + {type:"air"...} +
      // {type:"joint-gesture"...} + {type:"engine"...} + the rite's own
      // narration: pose / arrival / organum / percussion / cut /
      // cut-return / seachange (the sink) / ghost / bruise /
      // develop / answer.
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

  window.PJ2.Sycorax = {
    create: create,
    // Authored data exposed read-only-by-convention for the harness: the
    // pose table (every observed pose must be one of these), the organum
    // doubling table (every observed interval must match it), and the
    // grit constants (the caps the check run inspects).
    POSES: POSE_TABLE,
    ORGANUM_DOUBLING: ORGANUM_DOUBLING,
    GRIT: { amount: GRIT_AMOUNT, makeup: GRIT_MAKEUP, blendCap: GRIT_BLEND_CAP },
  };
})();
