# Prospero's Jukebox v2

Ground-up rebuild of Prospero's Jukebox on a new substrate. **v1 at
`../prosperos-jukebox/` is frozen and stays live untouched** — it is the
original and remains on hand as-is.

See `SPEC.md` for the Phase 0 substrate contract (seeded RNG streams, pitch
field with modulation, lookahead transport clock, voice/bus plumbing,
headless harness).

Phase roadmap (from the 2026-07-06 cross-engine review of prosperos-jukebox /
antariksh / zankyo / bardo / kolob):

- **Phase 0 — substrate**: PJ2.Rand, PJ2.Pitch, PJ2.Clock, PJ2.Voice,
  _harness.js, substrate-demo. (The lookahead clock is new to the whole
  engine family — every sibling still runs on recursive setTimeout.)
- **Phase 1 — form**: per-track performance dramaturgy + event-driven
  conductor, THE AIR turn-taking protocol (from kolob), meta-tide across
  performances. Decided 2026-07-06: performances chain **seamlessly**
  (no full stop — each track's ending gesture doubles as the transition
  into the next seeded performance: Library "candle-out", Sycorax "the
  cut", Ariel "upward dissolution"). Build order: **Library first** to
  full depth through Phase 3, then roll the machinery to Sycorax/Ariel.
  Instrumentation: port v1's signature patches faithfully, plus 1–2 new
  voices per track where the dramaturgy calls (e.g. sympathetic-string
  halo for Library). Owner's Phase-1 notes (binding, see SPEC-PHASE1.md):
  joints subtle and tasteful (~1/3 of boundaries pass with nothing);
  continuous-ambient character above all; AIR allows occasional overlap
  (soft grant, hard cap limit+1); Library evenings 6–18 minutes.
- **Phase 2 — melody & harmony**: Markov improviser + motif transform
  algebra/genealogy/dialogue ledger, chord grammar with cadences,
  mid-performance pivot modulation, small voice-leader for the hum consort.
- **Phase 3 — sound**: real delay lines (family first), sympathetic
  resonance bank, continuous "weather" parameter field, Sycorax grit bus,
  per-scene reverb morphing.
- **Phase 4 — apparitions**: visitations (storm crossing, cross-track bleed,
  Robert Johnson 1612 "Full Fathom Five" quotation).

Graphics revamp deferred until the music is in place.

## Theming (single source of truth, 2026-08-31)

**Every color lives in `pj2-skin.js`'s palette registry — nowhere else.**
`PJ2.Skin.themeCSS()` serializes the registry into every track×binding block
of CSS custom properties, and `injectTheme()` (called from index.php's head)
mounts it as `<style id="pj2-theme-vars">` before the app markup parses.
`pj2.css` only *consumes* the variables; its only remaining hexes are the
documented no-JS `var(…, #hex)` fallbacks. The cabinet chrome (`--pj2c-*`)
is per-track: one flat instrument panel re-lit per book (Library brass,
Sycorax violet iron, Ariel steel). `skin-test.html` §7 is the drift guard —
no stray hexes in pj2.css, consumed⊆emitted, no dead tokens, and a
computed-style probe of every var on all six track×binding combos.
To change a color: edit the registry, reload, and run the bench.

## Autonomous run to completion (authorized 2026-07-07)

Owner authorized unattended build-out "until the app is complete."
Remaining sequence (checkpoint-committed to git at each gate; NOT
published to the live site — publishing waits for the owner):

1. Phase 3 sound rework of Library (in flight) + Phase 3 harness/demo
   closer + gate. THEN a small additive task (owner, 2026-07-07):
   alchemical display labels in the Library engine — stable internal
   scene keys unchanged; getInfo()/events gain alchemical labels
   (proposed seven-operations mapping: settling=Calcinatio, chapters=
   Solutio/Separatio/Conjunctio in sequence, seizure=Fermentatio,
   reverie=Distillatio, candle-out=Coagulatio, seachange=Transmutatio,
   + ghost/cadence/tide labels). Labels only — the SOUND is untouched.
   Engine and PLAN-GRAPHICS.md must share one vocabulary.
   THEN (owner, 2026-07-07: "if there are good ways to integrate
   alchemical symbolism into the music, go for it — just not a complete
   rework") three additive MUSICAL alchemical touches for Library, as a
   separate task after labels + profiles both land: (a) refinement arc —
   scene-tilt tables directed dark-ops-early → luminous-ops-late so the
   theme is refined across the evening; (b) Conjunctio = chemical
   wedding — imitate-biased ledger + raised overlap in that chapter for
   a near-unison duet; (c) solve et coagula — once per evening in
   candle-out, one quiet verbatim whole-theme statement (the coagula to
   Fermentatio's solve). Config-level only; harness REPRO re-baselined
   deliberately for this change.
2. Track profiles extension (in flight) → then PARALLEL builds of
   pj2-sycorax.js (per PLAN-SYCORAX.md rev 2, all recommendations) and
   pj2-ariel.js (per PLAN-ARIEL.md, all recommendations incl. the
   Fx.delay "thin"/ascending-echo option) + per-track demo pages +
   harness sections + gates.
3. Consolidated track harness (owner, 2026-07-07: orchestrator-built,
   no agents): pj2-sycorax.js + pj2-ariel.js loaded and driven by
   _harness.js with per-track regression sections + an ALCHEMY section
   for the three Library touches.
4. The app itself: index.php + pj2-ui.js + pj2-viz.js — the three-track
   jukebox (track tabs switching engines, transport, master volume, seed,
   per-layer mixer via a small facade extension, form/harmony/motif
   monitor, canvas viz) implemented per PLAN-GRAPHICS.md (owner's vision,
   2026-07-07): keep the pitch spiral; pixel-art direction ("retro video
   game feel, not too blocky") that NEVER sacrifices data precision;
   per-track skins — Library/Prospero = alchemical codex (parchment
   background, the spiral as a rotating alchemical diagram in space,
   medieval-to-Renaissance codex vocabulary, alchemical symbols mapped to
   real music data); Sycorax and Ariel get their own codex traditions.
   Static mockups first (family pattern), then shared pixel/parchment
   engine, then skins. Final taste pass flagged for the owner's return.
5. Final consolidated harness gate + full-length listening soak
   (headless) + README/VERSION finalization.

Standing rules for the run: owner's aesthetic constants bind everywhere;
all recommendations in the two PLAN docs are pre-approved; the
tonic-ratchet quirk stays (owner's call); v1 stays frozen; commit
checkpoints per gate; never publish/deploy.

## Sound diversity (owner, 2026-09-02 — curated, Library first)

The owner's note: the songs can feel repetitive after a while in their
SOUNDS (as distinct from notes or motifs). `PLAN-SOUND-DIVERSITY.md` is
the reference: a voice-by-voice timbral audit of the three engines, six
levers (a new instrument per book, stops on the existing bodies, scene
rosters, a seeded evening cast, envelope/register moves, sound-kit
touches), per-track candidates, the mobile lab-page spec
(`lab-<track>.html`, the mockup pages' engine-unmodified pattern), the
integration recipe, and the owner's decisions of 2026-09-02 in its §7.
`lab-library.html` (+ `lab-shell.js`, `lab.css`) is the Library lab page —
L1 of the sequence: the unmodified engine plus the vessel / regal / flue
and the stops as shadow bodies, phone-first, with COPY/PASTE/A-B. Built
and verified by a coder/critic pass on 2026-09-03 (dev-only, unlinked;
open `?autoplay=1&fast=1` for the self-test).
The `PLAN-*.md` ignore rule for this folder was relaxed the same day so
the plan travels with the code (the earlier PLAN docs cited in comments
predate that and were never committed).

**Landed in the Library (rc.31, 2026-09-03 — L3 + L4 of the sequence).**
Three new voices, all tuned by ear by the owner on the lab page and
carried into `pj2-library.js` with those exact numbers as design
constants:

**Landed in Sycorax (rc.32, 2026-09-03).** The five voices the owner auditioned on `lab-sycorax.html` — the BULLROARER (a whirled slat, the rite's first iterative texture; processional and invocation), the OVERTONE CHANT (one held tone with a narrow formant stepping through its harmonics), the JAW HARP (the rite's first plucked sound; the circling only), the BOWED BLADE (the one high sustained whisper, kept far in the cavern and the delay wall) and the CAULDRON (the spell's pot, in the ambient pool with a mixer row of its own) — each on its own fork, lane, layer gain and knob strip at the owner's by-ear settings, none of them ever claiming the air, and all five silent from four seconds before the cut through its return, with anything still sounding at tB ended there. And PLAN §5.3's scene roster as adopted: the horn rests in the gathering and the circling, the rebec outside the processional and the circling, the waterphone outside the circling, the gurdy never — so the chapters of the rite sound different from one another. Stops and the parameter ranges (§11) are still to come.

**Landed in Ariel (rc.33, 2026-09-03).** Four new landscape voices from `lab-ariel.html` — the LYRE (a plucked gut string whose gesture is the rolled chord, and the one voice that stays through the release, climbing the whistle's ladder and thinning as it goes), the CONCERTINA (a free reed holding dyads, which sometimes takes a lift cadence's consort body from the aeolian harp), the HANDPAN (the answer: two to four chord tones after a whistle phrase ends) and the VIBRAPHONE (block dyads and triads under a motor tremolo). A SCENE ROSTER now says who plays where, so every scene rests somebody and the six scenes sound different from one another — the whistle sits out flights and hovers, the flutter the alighting and the swirl, the bass and the harp the flights — while the breeze, the sky and the halo keep no opinion and the release still dissolves upward rather than louder. One departure from the lab's table: the handpan is seated in songs as well as hovers, because its cue (a whistle phrase ending) never occurs in a hover. Stops and the parameter ranges (§11) are still to come.

**Landed in Prospero's Library (rc.34, 2026-09-03 — plan §11, the wander).** Every instrument is *played* now rather than set: a fresh bow pressure, plectrum position and reed voicing on each sounding (TOUCH), a character drawn once per evening (the bell's beating, the recorder's register, the organ's box and its two-to-four pipes), and a weather that drifts over minutes (the drone's sway, the room's density, the singer's mouth). Each mixer row gained one `vary` knob, 0–2: at 0 the desk is rc.33 bit for bit (the harness proves it against a stored digest), at 1 no two evenings — and no two bows — are quite alike. The knob you tune stays the centre; its span rides along when you move it. The gain ledger is now recomputed from the spans' worst cases, so a span widened past the ceiling turns a harness row red before it turns the mix loud.

- **the vessel** — a bowed alembic, the Library's over-voice: four
  inharmonic bowl partials, a fundamental that BEATS at 1 Hz, and the
  engine's first free-ring envelope (the bow lifts, the metal goes on
  sounding). Landscape. Its scene is the reverie; one bow in the
  candle-out, then silence.
- **the regal** — a small reed organ: three parts of square-and-saw reed
  under one breathing bellows. Chapter 2 and the seizure — and on p 0.45
  of the cadences it is offered, the organist TAKES the cadence and voices
  both chords in the hum consort's place.
- **the flue** — a wooden recorder, the rarest fourth speaker and a real
  motif voice (its own walk table, transform character and register). It
  claims THE AIR like the harpsichord, the box and the hum.

Plus **the stops**, each a knob on its voice's desk row: the harpsichord's
lute stop (`buff`), the music box's wound-down mechanism (`wound`), the
cello's reverie harmonics (`harmonics`) and the drone's three
registrations (`registration`: open / principal / gedackt). The music box
is simply the DAMPED box now — the open box retired.

**The scene roster** (§4.4's adopted table, with the regal in the
seizure) gates entries per scene, so every scene rests somebody: the box
sits out the settling and the reverie, the cello and the hum sit out the
seizure, the harpsichord rests through the candle-out except for the one
SOLVE ET COAGULA statement, and the drone never rests at all. The regal
is the ONE voice that may sound outside its roster cells — only as the
organist taking a cadence: both cadence chords sound inside the outgoing
scene, so a take on a chapter-one or chapter-three boundary puts the reed
organ briefly in a scene the table rests it from.

**The evening cast** draws once per evening on a new `cast` fork — dress
and prominence, never presence. Evening one of a run is always the full
ensemble in plain registrations; from evening two the harpsichord may
draw its lute stop, the box its wound-down mechanism, the drone its
registration, and the three new voices forward or back. One absence
colour only ("no music box tonight", p 0.12, stormy tides, never twice
running). A desk knob the owner has moved wins over the cast until it is
reset. Announced as a `{type:"cast"}` event, a plain-words line in the
scribal log, and `getInfo().cast`.

## TODO / future ideas (backburner — owner-deprioritized)

- **Phase 4 apparitions** (owner, 2026-07-07: "not a priority" — parked):
  per-track seeded visitations. Library: storm-crossing, cross-track
  bleed (Ariel's silver feather haunting the Library margin), gated
  Robert Johnson 1612 "Full Fathom Five" quotation (transcription would
  need an ear pass — flag unverified, KOLOB-style). Sycorax/Ariel hooks
  sketched in their PLAN docs. Rare, subtle, seeded. The graphics plan
  already reserves emblems for these (pearls on the coil, the feather).
- Library tonic-ratchet fix (fold TRUE sea-change tonic into an octave
  window around home) — owner chose to ship with the quirk.
- Ghost-promotion door in pj2-motif (seedGhost asTheme:true) so Ariel's
  signature-promotion is literal instead of ledger-emulated.
- Alchemical tide labels (kept the plain weather words for now).
