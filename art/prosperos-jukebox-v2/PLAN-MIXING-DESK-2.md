# PLAN — MIXING DESK II: per-voice fine-tune knobs + integrated collapse

2026-08-21, follow-up to PLAN-MIXING-DESK.md after the owner's first look at
the live build (rc.15). Three rulings:

1. **Each instrument row is itself collapsible**, revealing per-voice
   fine-tune knobs (this ports v1's expand chevron + EXTRA_KNOBS pattern —
   `../prosperos-jukebox/prosperos-jukebox-ui.js` `EXTRA_KNOBS` ~126-332 —
   deferred from the first desk plan).
2. **More customization** — real per-voice DSP/behavior params, not just
   vol/rate/mute/solo.
3. **The collapse control must be part of the desk** — the detached MIX
   pushplate in the cabinet is awkward. Remove it; the desk's own header
   bar is always visible (desktop only) and IS the toggle.

## UI changes (pj2-ui.js, pj2.css, index.php)

### The integrated header toggle
- Remove `#pj2-mixdesk-toggle` from the cabinet (index.php + all JS/CSS
  references). The cabinet returns to binding · seal · lamp only.
- The `.pj2-mixdesk` drawer is **always rendered** (still desktop-only:
  nothing built ≤700px, same matchMedia guard). Its header bar is always
  visible and acts as the collapse toggle: caret glyph (▾/▴) + the
  "the mixing desk" caption; clicking anywhere on the header toggles.
  `role="button"`, `aria-expanded`, `aria-controls` on the header;
  keyboard operable (Enter/Space).
- COPY/PASTE mini-pushplates stay in the header's right side, shown only
  when the desk is open (they must not trigger the toggle — stop
  propagation on their clicks).
- The drawer's body (rows) is what collapses. Same localStorage key
  `pj2.mixdesk.open`, still collapsed by default.
- The lit-state treatment moves to the header (or caret) instead of the
  removed pushplate.

### Per-row expansion
- Each row gains a small expand chevron at its left (before the sigil),
  `aria-expanded`, `aria-label` "fine-tune ‹layer›". Clicking it reveals
  a **knob strip** directly beneath that row: 2–4 compact sliders in the
  existing dithered-fill idiom, each with name + tiny readout, laid out
  in one horizontal line inside the same 720px centered column (wrap to
  two lines only if a layer has 4 knobs and space demands).
- Multiple rows may be expanded at once; expansion state is per-track
  and resets on tab switch (rows are rebuilt anyway).
- Rows for layers with no exposed params get no chevron (or a disabled
  placeholder to keep columns true — coder's call, keep alignment).
- Solo/mute/rate/vol behavior unchanged.

### Copy/paste extension
- The JSON blob gains an optional per-layer `"p"` object of
  `{paramKey: value}` — include only non-default values to keep blobs
  short:
  `{"pj2-mix":1,"track":"library","master":0.6,"layers":{"drone":{"v":1,"m":0,"r":1,"p":{"warmth":0.7}}}}`
- Paste: apply `p` entries forgivingly (clamp to the param's min/max,
  ignore unknown param keys, count them in the match report). Old blobs
  without `p` must still apply cleanly.

## Engine work — per-voice params (the bulk of the effort)

Add to each engine facade, beside the mixer/rate contract:

- `getLayerParams()` → `{layerKey: [{key, label, min, max, def}]}` — the
  exposed knobs for that book, in display order.
- `setLayerParam(layerKey, paramKey, value)` — clamp to [min,max],
  store in a persistent param state (same lifetime as `mixState`:
  survives reseed/stop/play), voices read it LIVE.
- `getLayerParamValues()` → `{layerKey: {paramKey: value}}` for the UI
  and COPY.

Rules:

- **Curated, honest knobs only.** Audit each voice for tunables it
  already reads at schedule time (or can cheaply be made to). 2–4 knobs
  per layer is the target; fewer is fine. If a candidate tunable is
  cached once at play() and rewiring it is risky, SKIP that knob —
  every exposed knob must actually work live. Label each knob with what
  it audibly does.
- Good candidates (verify per engine; v1's EXTRA_KNOBS is the spirit
  guide): drone warmth/cycle, hum openness/waver, harpsichord
  brightness/resonance, waterphone wail/bloom, percussion
  tempo/irregularity, bass space/flourish, ambient density, chime
  decay, halo level.
- **Determinism guard (unchanged):** every param's default MUST equal
  the constant it replaces, so default state is bit-identical; params
  are pure scalars, never draws from seeded streams, never consumed at
  plan time in a way that changes seeded call ORDER. Harness same-seed
  assertions must stay green untouched.
- Params that duplicate RATE (pure pacing) are pointless — expose only
  character/timbral/behavioral knobs.

## Files touched

- `index.php` — remove the MIX pushplate; the desk header becomes the
  toggle (update the stale cabinet comment again).
- `pj2-ui.js` — header toggle, row chevrons + knob strips, param wiring,
  copy/paste `p` extension, header-comment update.
- `pj2.css` — header-as-toggle styling, chevron, knob strip; remove
  dead toggle rules. Palette discipline unchanged (registry/chrome vars
  only).
- `pj2-library.js`, `pj2-sycorax.js`, `pj2-ariel.js` — param state +
  facade doors + live reads in the voices.
- `VERSION` — bump per the owner rule (`2.0.0-rc.16 — …`).

## Verification

- `node --check` all touched files.
- `node _harness.js` — ALL GREEN (same-seed identity intact at default
  params).
- A headless probe (harness mock pattern): set each exposed param to
  min/max on a simulated run — no exceptions, and defaults produce the
  identical event stream (already covered by the harness, but confirm
  the param doors don't disturb it).
- `php -S` + curl smoke; note what needs a real-browser pass.
