# PLAN — THE MIXING DESK (v1's mixing-desk depth, ported to the cabinet)

2026-08-21. Ports the most-missed piece of v1's UI — per-layer rate control
and soloing — into v2's cabinet, as a **compact, collapsible drawer**. v1
reference: `../prosperos-jukebox/prosperos-jukebox-ui.js` (RATE slider,
log-mapped 0.1×–10×; EXTRA_KNOBS; layer preview). v2's current mixer
(`pj2-ui.js` `buildLegend`, the `#pj2-legend` strip in the cabinet) is
gain + mute only.

## Requirements (owner, 2026-08-21)

1. Per-layer controls beyond volume/mute: **rate** and **solo**.
2. Layout must be **compact and collapsible** — the owner already finds
   parts of the app too sprawling.
3. **Desktop only** — do not render the desk on mobile at all.
4. **Copy/paste the parameters** as text, so mixes can be saved, shared,
   and hand-tuned out of band.

## Non-goals (deferred, explicitly)

- Per-layer DSP fine-tune knobs (v1's EXTRA_KNOBS — brightness, wobble,
  mischief…). The engines expose no such params; adding them is a
  separate, larger project.
- Preview-while-stopped (v1's 12 s ▶ audition). Solo-while-playing covers
  the auditioning need without engine surgery.
- Persisting mixes in localStorage. Copy/paste is the save mechanism.

## Design

### The drawer

- The existing `#pj2-legend` strip **moves out of the cabinet** into a new
  collapsible drawer, `.pj2-mixdesk`, placed directly after
  `.pj2-cabinet` in `index.php` (inside `.pj2-app`, so it skins per track).
- The cabinet gains one small pushplate, `MIX ▾` (`#pj2-mixdesk-toggle`),
  next to the binding toggle. The cabinet otherwise keeps: binding, seal,
  lamp.
- Collapsed by default; open/closed state persists in
  `localStorage["pj2.mixdesk.open"]`.
- The drawer has a slim header row: caption ("the mixing desk" or
  per-track flavor), then `COPY` and `PASTE` mini-pushplates right-aligned.
- Below the header, one **row per layer** (reuses the existing
  `.pj2-legend-row` vocabulary, extended):

  `sigil · name · VOL slider · RATE slider · M · S`

  - VOL: the existing dithered-fill slider, unchanged behavior.
  - RATE: same slider component, log-mapped 0.25×–4×, default 1×
    (`r = Math.pow(4, (v-50)/50)` on a 0–100 throw, like v1's mapping but
    a saner range). Center detent: double-click resets to 1×. A tiny
    readout (`1.25×`) sits at the slider's right.
  - M: the existing pixel mute square, verbatim.
  - S: a second pixel square for solo (distinct lit treatment, e.g.
    accent-colored fill vs. mute's bone fill).
- Rows must stay on one line each at desktop widths; the whole desk for
  the widest book (Sycorax, 8 layers) should fit without scrolling at
  ≥1100 px viewport. Two-column grid of rows is acceptable if single
  column gets too tall — critic to judge.
- **Mobile:** the toggle and drawer are `display: none` at the existing
  `max-width: 700px` breakpoint, AND the JS does not build the drawer DOM
  when `matchMedia("(max-width: 700px)")` matches (no hidden cost).
- ARIA: the toggle gets `aria-expanded`/`aria-controls`; every control
  keeps an aria-label in the house style.

### Engine work — per-layer rate

The clock already supports this: `lane.rate` (get/set, ≥0.05 floor)
rescales pending events live (`pj2-clock.js:264-295`; demonstrated in
`substrate-demo.js:268-272`). What is missing is a facade door.

Add to each engine's facade, beside the existing mixer contract
(`getLayers/setLayerVolume/getLayerVolumes/toggleLayer`):

- `setLayerRate(key, rate)` — clamps to [0.25, 4], stores in
  `mixState[key].rate` (persists across performances and stop/play, same
  as volume/mute — "each fresh world is born already mixed"), and writes
  through to the run's live lane(s) when playing.
- `getLayerRates()` — `{key: rate}` map for the UI and COPY.

Lane mapping tables (one per engine, next to `MIX_LAYERS`):

- **Library**: drone→`drone`, hum→`hum`+`humSing`, harpsichord→`pluck`,
  musicbox→`musicbox`, ambient→`ambient`, halo→none (fx layer; rate
  slider hidden/disabled for layers with no lane).
- **Sycorax**: gurdy→`gurdy`, noise→`noisebed`(+`breath` if it paces with
  the bed — coder to verify), chant→`chant`, rebec→`rebec`,
  waterphone→`waterphone`, boneflute→`boneflute`,
  percussion→`protodrum`+`percussion`, ambient→`ambient`.
- **Ariel**: breeze→`breeze`, whistle→`whistle`, chime→`chime`,
  flutter→`flutter`, bass→`bass`, aeolian→`aeolian`+`aeolianSing`,
  ambient→`ambient`, halo→none.

Shared/global lanes (`harmony`, `cadence`, `seachange`, `follow`, `cut`,
`arrival`, `release`) are NEVER rate-scaled — they carry form, not voice.

At `play()`, after lanes are created, stamp each mapped lane's `.rate`
from `mixState` so a stored rate is live from the first event.

**Determinism guard:** default rate 1 must leave every engine bit-identical
(harness same-seed assertions must pass untouched). Rate writes are
user-driven wall-clock UI input, like volume — they never touch the
seeded streams.

### Solo (UI-side, no engine work)

- Soloing layer L = `toggleLayer(other, false)` for every other unmuted
  layer; unsoloing restores the exact pre-solo mute set. Multiple solos
  compose (solo A then solo B = only A+B audible). Clearing the last solo
  restores the saved mute set.
- Implementation: `pj2-ui.js` keeps `soloSet` + `savedMutes` per track,
  resets on tab switch. Uses only the existing `toggleLayer(key, on)`
  contract — works even if an engine lacks rate support.

### Copy / paste

- COPY serializes the active book's full parameter state:

  ```json
  {
    "pj2-mix": 1,
    "track": "library",
    "master": 0.6,
    "layers": {
      "drone": { "v": 1, "m": 0, "r": 1 },
      "hum":   { "v": 0.82, "m": 0, "r": 1.5 }
    }
  }
  ```

  `v` = volume 0–1 (rounded to 3 dp), `m` = muted 0/1, `r` = rate
  (omitted for lane-less layers). Written via `navigator.clipboard
  .writeText` with a `document.execCommand("copy")` textarea fallback;
  the button label flashes "COPIED" for ~1 s.
- PASTE opens a small inline popover in the drawer header: a textarea +
  APPLY / CANCEL. APPLY parses + validates (`["pj2-mix"]` marker present,
  numbers clamped); applies master (lamp), volumes, mutes, rates for
  keys that exist in the current book; unknown keys ignored. If
  `track` ≠ active book, apply matching keys anyway but note the
  mismatch in the popover ("pasted a Sycorax mix onto the Library —
  3 of 6 voices matched"). Hand-edited JSON is the intended workflow, so
  partial application must be forgiving.
- Solo state is NOT serialized (it's a transient listening mode).

## Files touched

- `art/prosperos-jukebox-v2/index.php` — drawer container + MIX toggle;
  legend div moves into the drawer.
- `art/prosperos-jukebox-v2/pj2-ui.js` — desk module (drawer build,
  collapse, rate sliders, solo, copy/paste); `buildLegend` becomes the
  drawer row builder.
- `art/prosperos-jukebox-v2/pj2.css` — drawer, rows, rate readout, solo
  square, popover, 700 px hide rule. Keep the night/parch skinning
  (palette hexes only from PJ2.Skin registry / cabinet chrome inventory).
- `art/prosperos-jukebox-v2/pj2-library.js`, `pj2-sycorax.js`,
  `pj2-ariel.js` — lane maps + `setLayerRate/getLayerRates` on the
  facades; rate stamping at play().
- `art/prosperos-jukebox-v2/VERSION` — bump per the owner rule (this is
  user-facing). Also update `README.md` if it documents the mixer
  contract.

## Verification

- `node --check` every touched JS file.
- Run the harness (`node _harness.js`, or its documented entry) — the
  same-seed stream-identity assertions must pass with the facade
  additions in place.
- Serve locally (`php -S`) and smoke-test: drawer collapse/persist, rate
  slider audibly changes a layer's pace, solo/mute interplay, copy →
  hand-edit → paste round trip, hidden at ≤700 px, nothing built on
  mobile.
- Critic pass on layout: compact, aligned, house-consistent.
