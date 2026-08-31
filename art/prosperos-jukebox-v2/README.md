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
