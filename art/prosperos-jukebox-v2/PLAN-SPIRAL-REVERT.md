# PLAN — Spiral Revert & Rework (owner direction, 2026-07-20)

Owner reviewed the v2 graphics against v1 and gave binding direction on the
pitch spiral. This plan compares the two implementations, records the
decisions, and lays out the work. It supersedes PLAN-GRAPHICS §3's
"iron-gall ink on parchment" treatment **for the coil and its disk only** —
the codex frames, margin/footer pages, and the rest of the skin system stay.

---

## 1. Owner's brief (verbatim intent)

- The parchment background **behind the spiral** is out, for all three
  tracks (Library, Sycorax's Spell, Ariel's Day Off). The spiral area gets
  a **black backdrop**.
- The v2 changes to the spiral's **animation** are out. The preferred
  spiral is **v1's**: the colored coil on black, ported back.
- The parchment **frame** and the other visualizations that *contain* the
  spiral are liked (mostly) and **stay** — the spiral should be "the color
  it was, on a black background" *inside* the kept frame.
- The **animated disk below the spiral** must still **plot the drones**,
  and must carry **note-name labels instead of alchemy symbols**.
- Ariel's "frosted" engraved-plate frame in v2 is liked — **keep it**, but
  the area where the spiral appears goes **black**.
- Still open to an **enhanced** spiral beyond a plain v1 port — especially
  enhancements that pull it toward v2's **pixel-art style** — as long as
  it doesn't turn out like the current v2 treatment.

## 2. Comparison — where each behavior lives

Both versions share the same underlying model (7 octaves × 96 samples/turn
coil, FFT 8192, dB −75…−10, EMA adaptive baseline α=0.005, yaw/pitch camera,
auto-rotate) — v2 ported v1's data pipeline faithfully. The divergence is
entirely in **paint**.

| Concern | v1 (`../prosperos-jukebox/`) | v2 (here) |
|---|---|---|
| Renderer | One shared IIFE, `prosperos-jukebox-viz.js:531–1955`; per-track palettes only | `pj2-viz.js` `drawPlateData` (`:814`), dispatch at `:850–854` → `drawSortedCoil` (`:884`, Library/Sycorax) / `drawAtlasCoil` (`:1066`, Ariel) |
| Backdrop | Near-black per track: `#0a0805` / `#08070f` / `#06090e`, flat fill every frame (`viz.js:1386`) | Baked paper L0: parchment (`pj2-skin.js:1405`), soot-rag (`:1490`-ish), engraved plate (`:1544`); plate-zone ellipse clamps to *light* paper tones (`pj2-skin.js:1443–1444`, `:1571–1572`) |
| Coil color | Translucent colored ribbon fills + bright baseline: Library amber `[255,170,0]`/`[255,220,130]`, Sycorax lavender `[200,150,255]`/`[220,200,255]`, Ariel ice `[150,220,255]`/`[216,240,255]` (`themes.js:63–144`; draw `viz.js:1718–1790`) | Dark ink ramps on paper; depth via **ink weight** not alpha (`pj2-viz.js:955–965`, `:997–1004`, `:1099–1108`); Bayer ink-wash fills (`:946`) |
| Depth cue | Alpha fade, z-sorted quads: `depth = 0.35 + 0.65·(z+R)/2R` (`viz.js:1740–1742`) | Stroke color/width steps by z (`pen pressure`) |
| Coil animation | Rotation + live FFT bulge + adaptive-baseline settle; no wobble, no theatrics | Same data core, plus: static pen wobble (`pj2-viz.js:173–178`), ink oxidation on sea-change (`:801`), Sycorax hush/The-Cut slash (`:549`, `:1311`), Ariel re-gilding stars (`:1112–1116`) |
| Disk / drones | **Constellation floor** under the coil (`viz.js:1506–1675`): 12 chromatic spokes, outer ring, drone nodes at pitch-class angle + octave radius (`constNodeWorld` `:1055`), consonance-weighted interval lines, harmonic dots, sub-octave dot, triangle-harmonic halo ripples; **note-name ring labels** C…B in VT323, in-key/out-of-key colored (`:1878–1892`), interval labels ("P5" etc., `:1894–1915`) | **Dial ring** at coil base with **planetary/alchemy sigils** for in-key degrees (`pj2-viz.js:890–901`, `:1009–1027`; glyphs `pj2-skin.js:392–487`); drones plotted separately on the small corner "schema inferius" (`pj2-viz.js:741`, live `:1238`) |
| Frame | 2px CSS border panel (`prosperos-jukebox.css:837–850`) | Deckled parchment page edge (`pj2-skin.js:1449–1470`), pixel-cornered folio chrome (`pj2.css:226–237`), Ariel burnished/starred plate — **all kept** |

## 3. Decisions

**D1 — Revert the coil to v1, all three tracks.** v1's renderer (colored
translucent ribbon fills, bright fixed baseline, alpha depth fade, octave
notch dots, v1 palettes from `prosperos-jukebox-themes.js`) replaces both
`drawSortedCoil` and `drawAtlasCoil` at the `pj2-viz.js:850–854` dispatch.
v1 animation semantics: auto-rotate, FFT bulge, adaptive baseline —
nothing else. The v2 coil theatrics (pen wobble, ink oxidation, hush
palette-step **on the coil**, re-gild stars **on the coil**, and the Cut
slash — owner call, 2026-07-20) are removed with it.

**D2 — Black plate zone, kept frames, all three tracks.** The paper
generators keep painting the page (parchment / soot-rag / engraved plate)
and the deckle frame exactly as now; only the **plate-zone ellipse**
(already wired: `plateZones.plateZone`, `pj2-viz.js:241`, resize `:2169–2172`,
tested by `zoneTester` `pj2-skin.js:1388`) is filled **black** instead of
clamped to light paper tones. Ariel explicitly keeps its engraved
night-blue "frosted" plate ring + star field as the frame, with true black
inside the ellipse.

**D3 — The disk below the spiral is v1's constellation floor.** Port it
whole (spokes, ring, drone nodes, interval lines + labels, harmonic dots,
sub dot, halo ripples) and place it where v1 placed it — on the floor
plane under the coil. **Note-name labels (VT323, in-key/out-key colors)
replace the alchemy sigil dial**; the sigil stamps at the coil base are
removed from the spiral plate. (Sigils and alchemical vocabulary remain
legal elsewhere — margin, footer, scene labels — untouched by this plan.)

**D4 — Data plumbing stays v2.** The engines are not touched. The floor
feeds off the existing `emitNote` stream: drone-class events
(`drone`/`gurdy`/`breeze`) already carry `freq`, `deg`, `oct`, `durS`
(e.g. `pj2-sycorax.js:1343`, `pj2-ariel.js:1065`), which is everything
`constNodeWorld(freq)` needs. v1's cycle envelope (`fadeIn`/`fadeOut`/
`peakGain`) isn't in the events — approximate with fixed fade constants
first; if the floor's breathing looks flat, extend the drone events
additively (labels-only-style change, sound untouched).

**D5 — Enhancement stays on the table, pixel-art direction.** After the
revert lands and is approved, enhancements may be layered on — but they
must read as "v1 spiral, upgraded", never as re-inking. Candidates in §6;
each is a separate owner-taste gate.

## 4. Work plan

Order matters: black backdrop first (it changes every contrast judgment),
then the coil, then the floor, then taste passes.

### Step 1 — Black plate zone (small, unblocks everything)
- Add a `renderers.paper` override to `plateStack` (`pj2-viz.js:245–250`)
  that calls the default `Skin.paper(...)` then fills the
  `zones.plateZone` ellipse with black. Use `pal.void_` (`#0b0a08`) or the
  v1 per-track backdrops (`#0a0805`/`#08070f`/`#06090e`) — recommend the
  v1 values so the coil colors land on exactly the field they were tuned
  for. Alternative seam (equivalent): flip the `quiet()` clamp inside the
  three paper generators (`pj2-skin.js:1444`, soot equivalent, `:1571–1572`)
  to paint void instead of light tones. Prefer the viz-side override —
  zero changes to the shared skin toolkit.
- Feather option: 1–2 cell Bayer-dithered edge between black ellipse and
  paper so the transition reads as printed plate, not a sticker. (Cheap,
  pixel-art-native; do it in the same override.)
- Keep deckle, star field, scratches, glints outside the ellipse
  untouched. Verify all three tracks in `viz-test.html` / `skin-test.html`.

### Step 2 — Port the v1 coil renderer
- New `drawPhosphorCoil(G, M, proj, wallS)` in `pj2-viz.js`, replacing the
  branch at `:850–854` for **all three tracks**. Reference implementation:
  `../prosperos-jukebox/prosperos-jukebox-viz.js:1677–1790` (quad
  z-sort, ribbon fills α=0.28·depth, top edge 0.6px α=0.25·depth, baseline
  1.3px α=0.9·depth, octave notch dots r=2) — and the clean-room prototype
  `../prosperos-jukebox/library-drone-spiral-prototype.html`.
- Geometry: reuse v2's existing scratch arrays and projection
  (`pj2-viz.js:830–848`) — they are already v1's model. Drop `wobble[]`
  from the inner radius for the reverted coil (v1 has no pen wobble).
- Palettes: port v1's `canvas` blocks (`prosperos-jukebox-themes.js:63–74,
  98–109, 133–144`) into `PALETTES.<track>.spiral` in `pj2-skin.js` so the
  registry stays the single color source. Register them with
  `assertDataInk` against **black**, not paper.
- Rotation: keep v2's frame-rate-independent `YAW_RATE` (`:75`) but match
  v1's felt speed (v1 = 0.0015 rad/frame ≈ 0.09 rad/s at 60fps ≈ 0.86 rpm
  vs v2's 1 rpm — close; nudge to 0.09 rad/s for fidelity).
- Remove from the coil path: `washPattern` ink fills, `oxidized()` color
  substitution, hush bone-step, atlas hatch/engraving passes, re-gild
  stars, **and the roman numerals at the octave seams** (owner call,
  2026-07-20: no roman numerals for now). Octave orientation comes back
  via v1's left-edge octave axis `C1…C7` + scale-name caption
  (`viz.js:1917–1950`), ported with the floor in Step 3.

### Step 3 — Port the constellation floor (the disk)
- New `drawConstellationFloor(G, M, proj)` from `viz.js:1506–1675` +
  labels `:1878–1915`: floor at v1's `floorY` (just below the bottom
  turn), radius = coil radius; spokes α 0.13, ring α 0.20, drone nodes
  via `constNodeWorld` (`viz.js:1055–1062` — pitch class → angle, octave →
  radius), consonance lines, harmonic dots, sub-octave dot, additive halo
  ripples (`libraryTriangleHarmonics` waveform rings, `viz.js:1548–1603`).
- Labels: v1's `CONST_PITCH_LABELS` ring (**flats**: C C# D Eb E F F# G Ab
  A Bb B) in `12px VT323`, in-key vs out-of-key colors from the ported
  palettes; interval labels ("P5", "m3", …) on drone-pair midpoints with
  dark backing. In-key set derives from v2's live scale state
  (`inKeyPcOffsets()`), which tracks modulation — better than v1's static
  key tables; keep it.
- Data: extend `upsertDrone` (`pj2-viz.js:700`) to retain `freq` (and
  `oct`, `kind:"sub"`) from the events instead of collapsing to `deg`, so
  the floor plots real frequencies incl. Sycorax's sub-octave drone.
  Fixed fade-in/out constants for halo intensity first (see D3/D4).
- Remove: the sigil dial (`pj2-viz.js:890–901` dial build, `:1009–1027`
  `drawDialItem` sigil stamps). Decide at review whether the Library
  corner "schema inferius" (`:741`, `:1238`) stays as codex furniture —
  default **keep** (it's outside the spiral, it's part of the liked page
  apparatus, and redundancy with the floor is honest codex style).
- Draw order: floor before coil quads so the front of the coil occludes
  it (v1 behavior).

### Step 4 — Per-track check + event overlays in v1 language
- Library: amber coil on black inside the parchment page. v2 note marks
  (`flick`/`glint`/`column`) restyle to read against black — nearest v1
  equivalents: harpsichord baseline ripple, music-box glint stars, hum bar
  (`viz.js:1254–1349`). Port v1's forms where cheap; keep v2's event
  wiring.
- Sycorax: lavender coil on black inside the soot-rag page, and keep this
  track **minimal**: v1 had a bare spiral here, and the owner has flagged
  (2026-07-20) that a more substantial Sycorax rework is coming — so no
  Cut slash (removed per D1), and don't invest in restyling the v2
  cutline/tine marks beyond making them legible against black (or simply
  drop them to v1's bare spiral if restyling isn't trivial). Sycorax
  spiral dramaturgy gets redesigned in that future rework, not here.
- Ariel: ice-blue coil on black inside the kept engraved plate ("frosted"
  frame). Whistle mark upgrades to v1's lollipop tracker
  (`viz.js:1137–1228`) if cheap; bubbles/wings recolor to ice.

### Step 5 — Verification + gates
- `viz-smoke.js` scripts already emit drone events with `freq`/`oct` for
  all three tracks — extend assertions to cover floor nodes + labels.
- `render-soak.html` for perf: the floor's additive halos are the one new
  per-frame cost; budget against the degradation ladder
  (`pj2-skin.js:1684`) — halos drop first at rung 1.
- Owner taste pass on all three tracks before any §6 enhancement starts.

## 5. What explicitly does NOT change

- All paper generators, deckle frame, folio CSS chrome, margin + footer
  pages, sprite atlas, dither/palette toolkit (`pj2-skin.js` untouched
  except palette additions).
- All three audio engines, the conductor, harness, and every event shape
  (additions are additive-only if Step 3 needs them).
- Alchemical labels/vocabulary outside the spiral plate (scene labels,
  margin apparatus) — the owner's earlier alchemical-labels work stands.
- Camera interaction (drag, auto-rotate binding), FFT pipeline, adaptive
  baseline, plate metrics/resize logic.

## 6. Enhancement track (post-revert, each owner-gated)

Pixel-art-leaning upgrades that keep "v1 colored-on-black" as the base:

- **E1 Dithered glow**: replace flat quad alpha with 2-tone Bayer-dithered
  fills of the same hue (amber core + darker amber dither) — additive
  glow with a retro raster feel; data contour stays sub-pixel (the
  smoothing-on "data" layer rule, `pj2-skin.js:1794–1799`, is preserved).
- **E2 Stamped-nib baseline**: stroke the bright baseline with the square
  art-pixel nib along the unquantized path — chunky line, exact data.
- **E3 Phosphor floor**: floor labels/spokes stamped on an offscreen
  `kind:"art"` layer (nearest-neighbor) so the disk reads like a bitmap
  instrument dial; drone nodes stay smooth.
- **E4 Event theatrics, v1-native**: sea-change = brief hue shift of the
  whole coil (not oxidation); Ariel re-gild becomes glint stars on the
  coil seam in ice/gilt. (Sycorax theatrics excluded — deferred to the
  future Sycorax rework, see §7.)
- **E5 Halo quantization**: constellation halo ripples rendered at art-cell
  resolution — CRT-oscilloscope look, cheap perf win.

## 7. Owner decisions & open questions

Resolved (owner, 2026-07-20):

- **O5 — RESOLVED** (post-implementation review): the night window is a
  **slim rounded-square**, not the ellipse — "too much frame". Window
  inset ≈3% of the plate's short side, corner radius ≈4.5%.
- **O6 — RESOLVED** (same review): the plate's frame must **connect
  seamlessly** with the margin panel and footer — so the plate bakes the
  same calm, deckle-less, full-bleed-quiet paper the margin/footer pages
  use (no torn edge, no star field on the plate), and the folio reads as
  one continuous page. Furniture that now sits on the window moved to
  night-legible ink: the caption and Library corner schema in dim
  phosphor, Library emblems/cadence stamps in gilt.

- **O1 — RESOLVED**: no roman numerals at the octave seams for now.
  Octave orientation via v1's left-edge `C1…C7` axis + scale caption.
- **O2 — RESOLVED**: the Cut slash is out. Sycorax coil stays bare/minimal
  here because **a more substantial Sycorax track rework is planned** —
  treat every Sycorax-specific spiral flourish as deferred to that rework
  rather than ported/restyled in this one.

Still open (defaults chosen, flag to change):

- **O3** Library corner "schema inferius" drone square: keep as furniture
  (default) or remove now that the floor plots drones?
- **O4** Black backdrop shade: v1 per-track near-blacks (default) or one
  uniform `#0b0a08` void for all three?
