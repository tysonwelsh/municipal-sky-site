# PLAN — GRAPHICS: the illuminated jukebox

Design plan for the v2 visual system, for owner review. A plan, not code.
The binding vision: **keep the pitch spiral**; distinctive per-track
style; the pixel-art direction of v1's menu text (VT323 — where the
old-school feel lives today) extended into the visualizations, **not too
blocky, never losing precision in conveying the music's data**; and for
Library, alchemy — *"a parchment background for the spiral… like a
diagram spinning in space."* The craft standard is KOLOB's printed-thing
visualizers and ZANKYŌ's genealogy glyph — every mark driven by real
engine data — and the family's static-HTML-mockups-first pattern is kept.

---

## 1. ART DIRECTION — one system, three codex traditions

One conceit unifies the tracks: **each track is a book, and the
visualization is its living plate.** The app is a dark reading desk (the
site's near-black), and each track's instruments render as pages and
diagram plates from a different manuscript tradition. Same layout grammar
everywhere — central plate (the spiral), margin apparatus (telemetry),
annotation column (event log) — different paper, ink, symbol vocabulary,
and type per track. This is v1's theme-token system
(`prosperos-jukebox-themes.js`) grown from "same UI, different accent
color" into "same anatomy, different tradition."

### 1a. LIBRARY — the alchemical codex

Prospero's book. Sources to draw on: Ripley Scrolls, *Splendor Solis*,
*Atalanta Fugiens*, the *Buch der heiligen Dreifaltigkeit* — diagram
plates, planetary-metal sigils, rubrication, marginalia in a later hand.

- **Procedural parchment** — generated, self-contained, zero external
  assets. Layers, all baked once into a cached texture (§4): warm base
  fill → 3–4 octaves of value noise for mottling → low-frequency
  blue-noise "stains" (2–5 large soft blotches, seeded) → horizontal
  fiber streaks (thin 1-unit runs of ±4% luminance) → radial edge
  darkening → a deckled/worn border (1–2 unit irregular dark edge).
  The parchment is a **finite plate floating on the dark site background**
  — an object in the void, which is what makes "spinning in space" read.
- **The SPIRAL as rotating alchemical diagram** (full treatment in §3):
  ink-drawn rings, degree glyphs, marginalia — the FFT coil rendered in
  iron-gall ink over the parchment, still 3D, still honest.
- **Symbol vocabulary mapped to real data** (never decorative):
  - **Seven planetary metals ↔ the seven degrees of C Dorian.** ☉ Sol/gold
    = C (tonic), ☽ Luna/silver = D, ☿ Mercury = Eb, ♀ Venus/copper = F,
    ♂ Mars/iron = G, ♃ Jupiter/tin = A, ♄ Saturn/lead = Bb. The glyphs
    stamp the spiral's degree ticks at their angles; the harmonic readout
    shows the current chord root's metal sigil beside its name; cadence
    arrivals rubricate the arrival root's sigil.
  - **The alchemical operations ↔ the evening's scene arc — ONE
    vocabulary, engine-provided.** Owner ruling: the Library engine will
    expose alchemical display labels for scenes/events, and the codex skin
    **renders those labels rather than inventing its own**. The proposed
    engine mapping is the seven operations — settling = **Calcinatio**,
    chapters = **Solutio / Separatio / Conjunctio** in sequence, seizure =
    **Fermentatio**, reverie = **Distillatio**, candle-out =
    **Coagulatio**, sea change = **Transmutatio** — plus labels for
    ghost/cadences/tide. My aesthetic judgment: **adopt the seven
    operations** over the classic four-stage nigredo/albedo/citrinitas/
    rubedo. Reasoning: the operations give every scene type its own name
    and emblem (four stages force all chapters into albedo and leave the
    seizure reaching for cauda pavonis — a connoisseur's deep cut that
    reads as murk), operation sequences are period-correct diagram
    furniture (Ripley's gates, the *Rosarium* woodcut series), and
    per-chapter labels make multi-chapter evenings legible. One mapping
    question to settle at implementation: evenings can draw more than
    three chapters, so the chapter labels should cycle
    Solutio→Separatio→Conjunctio (recommended) or repeat Conjunctio.
    Rendering: the engine's label prints as the scene heading in the
    margin (Jacquard 12, rubricated initial), an authored 16×16 operation
    emblem advances beside it, and the stage tints only ink accents and
    the emblem — never a full-screen color change (nothing startles).
    The skin keys emblems by engine label string, so a label-table change
    in the engine re-skins the margin for free.
  - **Motif genealogy as a marginal family tree** — a codex-margin
    genealogical diagram (the kolob/zankyo glyph, drawn as pen-work): theme
    at the root, develop events grow branches, generations numbered in
    roman numerals, the every-3rd-gen ancestor tether drawn as a dotted
    return line, gen-9 renewal closes the tree with a small ouroboros.
    The carried **ghost** appears as a faint branch *in an earlier hand*
    (paler ink, slightly different letterform tilt).
  - **The sea change as a transmutation emblem**: a stamped alembic/
    ouroboros emblem at the margin at the event `t`, and the plate's ink
    **re-oxidizes** — iron-gall ink shifts hue over ~10 s toward the new
    field's tint (a true reroot tints warmer; a true-tonic change tints
    cooler). The data never moves; only the ink's chemistry does.

### 1b. SYCORAX — the woodcut grimoire

The rite observed from the treeline (PLAN-SYCORAX rev 2: ritual, wyrd-folk,
neo-medieval, the cut). Tradition: **early printed herbals and grimoires**
— heavy black woodcut on rough rag paper, crude but forceful figures,
occasional dried-blood rubrication. Think *Hortus Sanitatis* plates and
Scandinavian black-book (svartebok) sigils; charcoal, bone, soot.

- Paper is darker and rougher than the Library's parchment (soot-toned rag,
  heavier grain, scorched edges). Ink is near-black woodcut with **white
  gouge-lines** (the relief cuts) instead of pen strokes — the spiral coil
  prints as a woodcut line: slightly irregular width, ink squash at
  "pressure" (amplitude) peaks.
- Symbols: authored **pose sigils** for the five harmony poses (coil,
  sting, hollow, veil, smoke) — five bind-rune-like marks; percussion
  strokes print as small stroke-tallies under the plate; the keening law
  is visible: phrase-final notes on the flat second tick a bone-white
  notch at degree 1's angle.
- **THE CUT** is the block gouged: at tB a white slash crosses the plate,
  the print "skips" (ink layer drops to ~25% for the hold, matching
  cutGain), only the proto-drum's pulse mark keeps printing, and the one
  waterphone apparition stamps its emblem in the hush. The slash heals as
  a visible scar (a pale line) through the afterimage. Severity = slash
  length.

### 1c. ARIEL — the celestial atlas

Flights and songs, weather aloft, upward dissolution (PLAN-ARIEL).
Tradition: **Renaissance celestial charts and portolan wind-roses** —
*Harmonia Macrocosmica*, Apian's *Astronomicum Caesareum* volvelles: deep
indigo plate, engraved silver linework, gilt stars, a wind-rose compass.

- The "paper" inverts: a **night-blue engraved plate** (still procedurally
  textured — plate scratches and burnish instead of stains), silver ink,
  gilt accents. Ariel is the one skin where light marks on dark survive
  from v1 — reframed as engraving, not phosphor.
- Symbols: a **wind-rose** for the tide (still-air / rising-thermals /
  gale / clearing as the rose's active point + feather streamers whose
  count = tidePos); triad roots as small **constellations** (I and II —
  the two Lydian homes — are the two fixed asterisms; the #4 rings as a
  lone gilt star that only the halo lights); flights draw as dotted
  flight-lines arcing up the spiral; the release's register migration
  visibly climbs the coil and the plate's horizon line sinks.
- Cadences: `lift` engraves a small ascending-step glyph; `float` a
  feather; the sea change (always upward) re-gilds the plate — star
  points brighten one by one over ~8 s toward the new tonic's angle.

---

## 2. THE PIXEL DISCIPLINE — "pixel art, not too blocky, never imprecise"

Precise definition, in implementation terms:

- **The logical pixel unit `U`.** One art-pixel = **2 CSS px**, rendered
  at `round(2 × devicePixelRatio)` device px so the grid always lands on
  integer device pixels (DPR 1 → 2 dev px; DPR 2 → 4; DPR 1.5 → 3). At
  2 CSS px the retro texture reads clearly at arm's length without the
  Minecraft chunk of 4–6 px units. All grid-snapped drawing uses integer
  multiples of `U`; canvases disable smoothing only for stamped sprites.
- **What snaps to the grid** (the "pixel-styled container"): all chrome
  (frame, tabs, buttons, sliders, borders — 1U strokes, stepped corners),
  all bitmap type, all stamped glyphs/sigils/emblems (authored on 8×8,
  12×12, and 16×16 art-pixel cells), the paper/parchment texture (noise
  sampled per art-pixel, so grain is chunky), dither fields, and static
  plate furniture (ring outlines, degree ticks, spokes, labels).
- **What renders at full resolution** (the data marks): the spiral FFT
  contour and fill boundary, per-layer overlays (pluck ripples, hum bar,
  lollipop heads, glints, bubbles), needle/dial angles, the density curve,
  meter fills, and event-mark positions along time/pitch axes.
  **Rule: position and magnitude of any data mark is never quantized
  coarser than 1 device pixel.** The hybrid is: pixel-styled containers
  and textures, sub-pixel-accurate data. Where a mark *wants* pixel flavor
  (e.g. the music-box glint already snaps to a 2 px grid in v1 — keep
  that), quantization is allowed only where the stated cost is below the
  data's own resolution: the spiral holds 96 samples/turn ≈ 12.5 cents of
  pitch per sample; 1 device px of angular snap at plate radius ≥ 120 px
  is < 1/750 turn ≈ 1.6 cents — acceptable; anything coarser is not.
  Pixel *flavor* on data marks comes from palette + stroke texture (stamped
  square-nib brush along an unquantized path), never from vertex snapping.
- **Dithering.** Two styles, both **static** (baked into cached textures,
  never animated — animated dither shimmers and reads as noise, not craft):
  **Bayer 4×4 ordered** dither for directional/gradient shading (edge
  darkening, ring shading, dial faces — its regular crosshatch reads as
  engraving), and a precomputed **64×64 blue-noise tile** for organic
  fields (stains, mottling, soot, plate burnish — no visible pattern).
  Event illustrations that fade (emblems, the scar) fade by re-thresholding
  their own baked dither mask, so decay looks like ink absorbing, not
  alpha-blending.
- **Palette discipline.** Each track gets a locked ramp (12–14 colors);
  canvas code may not invent colors outside it (theme-registry enforced,
  as in v1). Proposed values:
  - **Library** (parchment + iron gall + rubric + gilt):
    paper `#efe3c0 #e3d3a8 #d0bc8c #b49a68 #8a704a`;
    ink `#2e2114 #4a3620 #6e5638 #93794f`;
    rubric `#8e3b2c #b0553c`; gilt `#c9a227 #e8c95a`; void `#0b0a08`.
  - **Sycorax** (soot rag + woodcut + bone + blood + witch-light):
    paper `#241d17 #322820 #453729`; ink `#0d0b09 #1a1512`;
    bone `#d8cfc0 #b3a68e #7d715c`; blood `#6e2a22 #93392b`;
    witch-light `#9b87b8 #c4b5fd` (v1's lavender, demoted to one accent);
    void `#070605`.
  - **Ariel** (indigo plate + silver ink + gilt + rose-red):
    plate `#101a30 #16233f #22345a`; silver `#d8e4ec #a8c0d4 #6e8aa4`;
    gilt `#d4af5f #ecd28a`; rose `#a04838`; pale-sky `#bfe0f4 #8fc4e4`;
    void `#05070c`.
- **Pixel typography.** v1's pixel voice is **VT323** (all menus, labels,
  log) with Cinzel Decorative headings. Keep VT323 as the universal data/
  chrome face — it *is* the old-school text the owner likes. Replace
  Cinzel with per-track pixel display faces: **Library headers in
  Jacquard 12** (Google's pixel-blackletter — a genuine blackletter-pixel
  hybrid, same delivery path as VT323), used for the title, tab label,
  scene headings, and illuminated capitals in the log. Sycorax headers:
  Jacquard 12 as well but set in bone-on-soot with 1U rough offset
  (woodcut caps); Ariel headers: VT323 letter-spaced small caps with gilt
  star interpuncts (engraved captions, not blackletter). Numeric data
  readouts are always VT323 — blackletter numerals fail the precision
  rule.

---

## 3. THE SPIRAL — the diagram spinning in space

Everything the v1 spiral *shows* is kept: FFT → log-frequency coil, one
turn per octave (7 octaves × 96 samples), honest dB mapping, adaptive
baseline, in-key tinting, per-layer overlays, drag + auto-rotate camera.
What changes is what it *is*: a phosphor object becomes **an ink diagram
on a parchment plate, rotating in space**.

- **3D and spinning — settled by owner ruling.** The spiral keeps v1's
  full 3D projection and rotation; the design problem is specifically how
  ink-on-parchment, the pixel discipline, and 3D projection coexist.
  **Primary approach — the backdrop plate**: the parchment is a bounded
  2D page floating on the void, drawn in screen space *behind* the freely
  rotating 3D diagram. The coil renders in ink tones over it; depth is
  carried by ink weight, not alpha: near limb inked darker and slightly
  wider (ink squash), far limb a paler hairline — replacing v1's alpha
  depth-fade with a cue that survives on light paper. This keeps the
  cached-texture architecture trivial (the paper never re-renders with
  the camera) and reads as "an impossible engraving spinning in front of
  its own page" — the strongest version of the owner's image.
  **Alternative — inked-object mode**: map parchment *into* the diagram
  itself — coil and rings sampled against a world-space parchment texture
  (stroke darkness modulated by the fibers it crosses, paper tone filling
  the coil's quads): a curled parchment strip spinning in the void, no
  backdrop page. More literal magic, but costlier (per-frame texture
  resampling), shimmer-prone against the pixel grid, and losing the page
  loses the margin apparatus's home. Build the primary; show the
  alternative as a mockup variant — it's a bounded experiment on the same
  renderer.
- **Ink-drawn rings and degree glyphs**: each octave's baseline circle is
  a compass-drawn ring (1U pen line with tiny authored wobble, baked);
  the 12 degree ticks carry the planetary sigils (in-key degrees get their
  metal sigil in full ink; out-of-key ticks are bare pale ticks — this IS
  the in-key tinting, relocated from color into symbol weight). Octave
  numbers as marginalia numerals at the seam of each turn.
- **The FFT contour** strokes in dark iron-gall at full resolution; its
  fill down to the baseline is where the pixel flavor lives: a Bayer-
  shaded ink wash quantized to the U grid (the wash may be chunky; the
  contour edge may not).
- **Marginalia**: the constellation floor (drone cycles as the clock-face
  below) redraws as the plate's **lower schema** — a 12-spoke horoscope-
  style square-in-circle diagram; drone tones are inked nodes, interval
  lines weighted by consonance as single/double/dotted rules, labeled in
  tiny VT323.
- **Overlays keep their jobs, re-costumed per skin**: harpsichord plucks =
  quill flicks off the baseline; hum bar = an illuminated column whose
  vowel shape survives; music-box glints = gilt-leaf flecks (already
  pixel-snapped in v1 — the one v1 mark that was ahead of this plan);
  Ariel's whistle lollipop = a silver plumb-bob; bubbles = engraved rising
  circles; Sycorax chant = the woodcut's strongest line.

The same plate architecture serves all three skins — only paper, ink
weight, and symbol set swap.

---

## 4. SONG-SPECIFIC GRAPHICS — per-event illustrations

Per-track event vocabulary (all driven by the real v2 event stream:
`cadence / seachange / ghost / develop / answer / joint-gesture / tide /
scene`, plus Phase 4 visitations when they land). Wherever the Library
engine supplies an alchemical display label (scene operations,
Transmutatio, ghost/cadence/tide names per the shared-vocabulary ruling),
the codex prints the engine's string verbatim and stamps the matching
authored emblem — the skin never re-labels:

| event | LIBRARY (codex) | SYCORAX (grimoire) | ARIEL (atlas) |
|---|---|---|---|
| scene change | engine's operation label as folio heading (Calcinatio … Coagulatio) + its emblem advances | station-of-the-rite woodcut vignette (gathering fire → procession → circle → invocation → embers) | leg of the flight-path drawn onto the chart |
| cadence | rubricated line + arrival root's metal sigil stamped | — (no cadences by design; darkening arrivals gouge the pose sigil deeper) | `lift` step-glyph / `float` feather, engraved at the boundary |
| sea change | **Transmutatio** rubric + emblem; ink re-oxidizes over ~10 s | the rare semitone **sink**: the whole plate's print drops one visible line lower, once | plate re-gilds star by star toward the new tonic |
| ghost | faint branch in an earlier hand on the genealogy tree | the chant intones it: a worn, double-struck print of last night's line | the returning bird: prior evening's flight-line ghosted under tonight's |
| develop/answer | branch/answer-limb grows on the margin tree (gen in roman numerals) | knot added to a cord-and-bone tally | migration line extends; answers as a paired wingbeat mark |
| the cut | — | white gouge across the plate; print skips; proto-drum alone keeps its pulse mark; scar remains | — |
| storm crossing (P4) | ink lines waver, stains bloom at the leeward edge for the crossing's span | thunder tick in the margin (already in its pool) | the wind-rose swings hard; chart hatching densifies |
| cross-track bleed (P4) | **a feather in the margin, drawn in Ariel's silver** — a foreign pigment in this book | — | — |
| Full Fathom Five (P4) | a sunken emblem: pearls appear on the coil at the quotation's sounded pitches; "of his bones are coral made" as a rubricated scroll | — | — |

**Telemetry, restyled diegetically** (fed by `getInfo()`: sceneType/x,
tidePos/tideLabel, intensity, airHolders, harmony, motif stats, weather,
haloLevel):

- **Library margin**: tide as a **moon-phase volvelle** (a rotating paper
  wheel — candlelit → late-night as phases); intensity as the **athanor**
  — the alchemist's furnace with the *four degrees of fire* (the real
  alchemical scale) as its gauge, 0.04–0.65 mapped onto it; the air as
  quill icons (one per holder, `airLimit` as inked rests); chord as metal
  sigil + name; motif stats as the genealogy tree; scene as folio heading
  with progress-x as an inked-so-far line.
- **Sycorax margin**: tide as **distance to the treeline** (a strip
  woodcut where the rite's fire glow sits nearer/farther); intensity as
  the smoke column's height; pose sigil readout; percussion tally marks.
- **Ariel margin**: tide as the wind-rose; intensity as an **altitude
  quadrant** (astrolabe arm angle); chord as the lit constellation;
  signature-motif lineage as the season's migration map.
- **Event log** stays a text log (precision) restyled as **scribal
  annotation**: VT323 body, rubricated tags, illuminated capital on scene
  headings, entries "age" — older lines' ink pales in 3 palette steps.
- **Density envelope** keeps its exact axes/forecast, redrawn as the
  plate's footer rule: past = solid ink, forecast = pricked (dotted
  pounce-holes) line.

---

## 5. UI CHROME — the conjurer's cabinet

**One shared frame with track-skinned inserts** (not three whole frames —
three full chrome sets triple maintenance and dilute the jukebox identity).
The frame is the reading desk / cabinet: dark wood-and-brass drawn in
grid-snapped pixel art, constant across tracks.

- **Track tabs = three book spines on a shelf**: tooled-leather tome
  (Library, Jacquard 12 gilt title), birch-and-sinew black book (Sycorax),
  star-atlas folio (Ariel). The active book lies open — the whole plate
  region is its pages. Idle spines keep their own palettes (v1's
  multi-colored tab rule, kept).
- **Transport**: brass pushplates (PLAY ▶ / STOP ■ / RESET ↻), 1U bevels,
  pressed state = 1U inset. No glow; a lit state is a gilt fill.
- **Seed entry = the wax seal**: the seed number set in VT323 inside a
  stamped seal; reseeding re-stamps it (one 300 ms press animation).
- **Volume = the lamp**: master volume as the desk lamp's wick/aperture
  gauge; per the family's restraint it is a slider with a diegetic face,
  not a hidden control.
- **Per-layer mixer = the plate's legend**, skinned per track: each voice
  row gets its authored 12×12 sigil (voice icon), name in VT323, a
  grid-snapped slider whose **fill is dithered but whose thumb position is
  unquantized**, and the mute toggle as v1's pixel square (kept verbatim —
  it already obeys the discipline).
- v1's CSS **CRT scanline overlay is removed** (§7, Q2). The retro carrier
  is now paper and pixels, not phosphor.

---

## 6. TECH PLAN

**Canvas architecture** (per the kolob offscreen-ink pattern):

- `L0 paper` — offscreen, generated once per (track, size, seed): the full
  parchment/rag/plate texture incl. dither fields and border. Cost budget
  ~50–150 ms, off the hot path (regenerate on resize debounce + track
  switch only). A reduced-amplitude **"plate zone"** is baked where the
  spiral lives so texture never fights thin data lines.
- `L1 furniture` — offscreen: rings, sigil ticks, spokes, static margin
  apparatus. Redrawn on track/key/scene-stage change only. Sigils/type
  stamped from a pre-rendered sprite atlas (one offscreen canvas of all
  glyph cells per skin).
- `L2 data` — every frame: FFT coil, overlays, needles, meters. Same
  per-frame cost class as v1 (672 samples × 2 projections + quad sort);
  the depth-sorted quad pass is inherited unchanged.
- `L3 illustrations` — event emblems and decays; only composited while
  any emblem is alive.
- `L4 vignette/grain` — cached multiply/overlay layer; skippable.
- Composite L0..L4 into the visible canvas each frame (5 drawImage calls +
  L2 direct draw). Target 60 fps desktop; floor 30 fps mobile.

**Pixel grid × DPR**: visible canvases sized `rect × dpr` as in v1; the
art-pixel stamp size is `round(2 × dpr)` device px (integer at every
common DPR). Grid-snapped layers draw with `imageSmoothingEnabled=false`;
L2 data draws smoothed. One shared helper owns the math so no renderer
computes its own unit.

**Degradation** (small screens / weak GPUs): (1) drop L4; (2) render at
DPR 1 and upscale (texture stays crisp because it's authored in art-
pixels); (3) margin apparatus collapses into one horizontal strip of
readouts below the plate (dials become sigil + VT323 number — data
survives, illustration yields); (4) auto-rotate pauses when the tab is
hidden. Never reduce SAMPLES_PER_TURN — that would spend precision to buy
frame rate, the one forbidden trade.

**Build sequence:**

1. **Static HTML mockups** in `mockups/` (family pattern): one per skin —
   `mockup-1-codex.html`, `mockup-2-grimoire.html`, `mockup-3-atlas.html`
   — full-size stills with real parchment generation, fake frozen data,
   the margin apparatus, and a chrome strip, for the owner's eyeballs
   before any engine wiring.
2. **Shared skin engine** (`pj2-skin.js`): pixel-grid helper, paper
   generators (parchment/rag/plate), Bayer + blue-noise, palette registry
   (theme-tokens v2), sprite-atlas stamping, layer/compositor scaffold.
3. **Library skin, full build** — plate, spiral restyle, margin apparatus,
   event illustrations, log restyle.
4. **Sycorax + Ariel skins** — swap paper/ink/symbols on the same anatomy;
   their per-event tables.
5. **Chrome + mixer** — the cabinet, spines, transport, seal, legend.

**Riskiest for the precision requirement**, in order: (1) **ink-on-paper
contrast** — v1's neon-on-black gave the dB contour enormous luminance
contrast for free; iron-gall on parchment must hold ≥ 4.5:1 for every
data stroke (validate in the mockups with real values — this is the reason
mockups come first); (2) **texture under thin lines** — solved by the
baked plate zone, but it must be checked at DPR 1; (3) **pixel-flavored
stroking of the moving contour** — a stamped nib along an animated path
can scintillate; fall back to a plain 1.5 px stroke if it does; (4) the
Sycorax skin's dark-on-dark ceiling (soot paper is the least forgiving —
bone-white carries all the data there).

---

## 7. SETTLED BY OWNER RULING (recorded, not open)

- **The spiral stays 3D and spinning, as in v1.** Design approach per §3:
  parchment as a screen-space backdrop plate behind the freely rotating
  diagram (primary), world-space parchment-mapped ink as the mockup
  alternative.
- **Engine and graphics share one alchemical vocabulary.** The Library
  engine exposes the display labels; the codex renders them (§1a, §4).
  This plan endorses the seven-operations mapping over four-stage
  nigredo/albedo/citrinitas/rubedo, with the chapter-cycling detail to
  settle at implementation.

## 8. OPEN QUESTIONS (recommendations attached)

1. **CRT effects — keep any?** **Recommend: none.** Remove v1's scanline
   overlay entirely. "Nothing startles" extends to the eye; scanlines +
   dither + paper grain is one texture too many, and phosphor contradicts
   the printed-thing conceit. The pixel grid alone carries the retro.
2. **How much animation does the parchment world tolerate?**
   **Recommend: paper fully static; all motion is ink.** One exception
   worth trying in the mockup: a barely-perceptible vignette "breath" tied
   to intensity (amplitude ≤ 2% luminance, period ~20 s). If it's ever
   *noticeable*, cut it.
3. **Light plate on the dark site — how light?** **Recommend: genuinely
   parchment-light** (`#efe3c0` family) floating on the void, not a
   murky "dark-mode parchment." The floating-plate composition keeps the
   page from blowing out the room, and data contrast (risk #1) needs the
   headroom. Sycorax keeps its dark paper — the contrast inversion between
   tracks is itself song-specific identity.
4. **Library headers: Jacquard 12 or a custom bitmap textura?**
   **Recommend: Jacquard 12** — a true blackletter-pixel hybrid, zero
   authoring cost, same Google-fonts path as VT323. Custom bitmap caps
   only if its lowercase proves illegible at header sizes in the mockup.
5. **Event log: text or pictorial?** **Recommend: text, restyled as
   scribal annotation.** The log is the app's precision backstop — every
   emblem in §4 has a plain-words row here. Pictorial-only marginalia
   would trade the exact thing the owner said never to lose.
