# PLAN — THE HARMONY READOUT (resurrecting v1's dead indicator on v2's engine)

2026-08-21. v1 shipped a harmonic/spell-pose indicator wired to its engine
but its DOM ids were removed from `index.php`, so it never rendered
(`../prosperos-jukebox/prosperos-jukebox-viz.js:286-325`). v2's harmony
brain is far richer — chord grammar with cadences and the sea change
(`pj2-harmony.js`), Sycorax's pose wheel — yet the listener can only learn
about it after the fact, as prose in the scribal log. The margin apparatus
shows the motif brain (theme staff, genealogy) and the weather (tide,
intensity); nothing shows the harmony brain live.

This plan adds a compact **harmony readout to the margin canvas**, fed by
the existing ~300 ms `getInfo()` poll, plus the small engine telemetry
additions that poll needs.

## What the readout shows (per track)

- **Library**: the current chord (e.g. `iv · f a♭ c`), and when a cadence
  is planned for the coming boundary, its approach — using the engine's
  alchemical display labels (Ablutio / Suspensio / Resolutio). When the
  evening's sea change has fired, the new root/mode until the next
  performance.
- **Sycorax**: the current pose name (coil / sting / hollow / veil /
  smoke / afterimage) — there are no cadences by construction, so instead:
  the sink (the rare downward-semitone sea change) when planned/done.
  During THE CUT's boundary the forced "sting" pose is already the pose —
  nothing extra needed.
- **Ariel**: the current chord plus mode/tonic (Ariel modulates often and
  re-grounds each evening, so the tonic is live information), and its
  rising cadence labels (lift / float / up-half) on approach.

## Engine telemetry additions (small, contained)

All three engines already expose the current chord/pose through
`getInfo()` (`info.harmony` chord name in pj2-library.js:2782 and
pj2-ariel.js:3006; `info.pose` + `info.rootDeg` + `info.sink` in
pj2-sycorax.js:3169-3195). Missing pieces:

1. **Library & Ariel — next cadence.** When a boundary's cadence is
   planned (pj2-library.js:1308-1348 plans via `lane("cadence").at(tB -
   CADENCE_LEAD_S, …)`; Ariel has the same pattern at
   pj2-ariel.js:1147), record `run.nextCadence = { kind, label, t: tB }`;
   clear it when the cadence realizes. Expose in `getInfo()` as
   `info.cadence = { kind, label, inS }` (`inS = t - clock.now()`,
   clamped ≥0), `null` when none is planned. `label` is the existing
   alchemical/rising display label.
2. **Library & Ariel — sea change state.** Where the evening's sea change
   is planned and executed (`planSeaChange`/`executeSeaChange`,
   pj2-harmony.js:798/:901; the Library's boundary hook around
   pj2-library.js:1435), keep `run.seaChange = { planned, done, label }`
   where `label` describes the target (e.g. `f mixolydian` / `+P4`), and
   expose it as `info.seaChange`. Sycorax already exposes `info.sink` —
  leave it.
3. **Chord tone names (nice-to-have, cheap).** If `harmony.current()`
   already carries the chord's degree set, expose pitch-class names in
   the readout string (`iv · f a♭ c`); if it doesn't, the chord name
   alone is acceptable — do NOT grow the harmony API for this.

**Determinism guard:** telemetry is read-only observation of existing run
state — no new draws from any seeded stream, no influence on scheduling.
The harness's same-seed stream-identity assertions must pass untouched.

## Viz rendering (pj2-viz.js)

- The margin already polls `getInfo()` (~300 ms, pj2-viz.js:2567) and
  draws per-track readout lines under its dials (`readoutLine`,
  pj2-viz.js:2254/:2401/:2493). Add the harmony readout in this same
  idiom: compact text in VT323, ink per `PJ2.Skin.dataInk(track)`
  contrast rules, correct in both NIGHT and PARCH bindings.
- Placement: the agent chooses the least-disruptive spot consistent with
  the margin's existing composition — either (a) one more readout line
  group beside the existing dial readouts, or (b) a short line directly
  under the scene label near the top of the margin. It must NOT collide
  with the theme staff, the genealogy tree, or the dials, and must not
  grow the canvas. Keep it to 1–2 short lines; this is an instrument
  reading, not a paragraph.
- Content by track (compose from `info.harmony` / `info.pose` /
  `info.cadence` / `info.seaChange` / `info.sink` / `info.tonicHz` /
  `info.mode`):
  - Library: `iv · f a♭ c` and, when `info.cadence`, `ablutio in 12s`
    (label lowercase as it appears in LABELS); after the sea change,
    `sea change → f mixolydian` persists until the next performance.
  - Sycorax: `pose · sting`; `the sink · done` when applicable.
  - Ariel: `II · ionian 349` style (chord · mode · tonic Hz); cadence
    approach as per Library.
- When the engine is stopped/idle, the readout shows nothing (or an em
  dash) — no stale chord frozen on the plate.
- If pj2-viz.js is absent the page already degrades to the placeholder;
  nothing extra needed.

## UI touch (pj2-ui.js, tiny)

The mobile telemetry strip already prints `info.harmony`
(pj2-ui.js:999) but not Sycorax's `info.pose` — extend that one line to
use `info.harmony || info.pose`, and append the cadence label when
`info.cadence` is non-null. This is the only mobile surface; the margin
canvas itself is desktop apparatus per §6.

## Files touched

- `pj2-library.js`, `pj2-ariel.js` — `nextCadence` / `seaChange` run
  state + `getInfo()` exposure (Sycorax: likely untouched).
- `pj2-viz.js` — the margin readout rendering + poll consumption.
- `pj2-ui.js` — the one-line telemetry strip extension.
- `VERSION` — bump per the owner rule (user-facing). Update the file
  header comments of touched files where they enumerate what the file
  owns.

## Verification

- `node --check` on every touched file.
- `node _harness.js` — ALL GREEN, same-seed identity intact.
- `php -S` + curl smoke: page renders; no new console-visible errors
  checkable statically. Note in the report what needs a real-browser
  pass (visual placement, both bindings, all three tracks).
