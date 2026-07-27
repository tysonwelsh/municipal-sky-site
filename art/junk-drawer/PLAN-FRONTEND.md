# PLAN-FRONTEND — The Junk Drawer

Frontend plan for `/art/junk-drawer/`: the drawer painting, the pile, the digging, the specimen card, and the data contract the backend must honor. Companion to PLAN-BACKEND.md. Conventions follow the sibling projects (kolob, prosperos-jukebox-v2): plain PHP entry page inheriting site chrome from `includes/header.php`/`footer.php`, vanilla JS modules on a `window.JD` namespace, one project CSS file, standalone HTML mockups in `mockups/`, a `VERSION` file + md5 cache-busting in `index.php`, no build step, published by FTP.

---

## 0. Visual references

Three painters anchor the look of the **drawer and every UI element around
it** — the frame, the well, the lighting, the specimen card, tooltips/tags,
and the below-the-fold page furniture:

- **John Haberle — *A Bachelor's Drawer* (1890–94)**: the primary reference
  for the drawer itself. A shallow drawer face crammed with tickets,
  currency, photographs, and ephemera — this painting *is* the project's
  premise. Use it to art-direct the frame-kit painting (wood tone, wear,
  the way clutter meets the drawer edges) and the overall density feel of
  the pile.
- **John F. Peto**: the reference for *composed mess* and for paper.
  His letter-rack and office-board paintings show how worn tapes, tacked
  cards, and scuffed ephemera read as arranged-by-life rather than random —
  the target for the scatter/density rules (§2). His surfaces also drive
  the specimen card and manila-tag styling: aged paper, soft edge wear,
  things that have been handled.
- **William Michael Harnett** (*Mr. Hulings' Rack Picture*, *The Old
  Violin*): the reference for **light**. One raking source, crisp
  object-shaped cast shadows, varnish depth — this is exactly what the
  global upper-left light + silhouette `drop-shadow` treatment (§1) is
  imitating. When tuning shadow offset/blur/opacity, tune against Harnett.

Others from the same trompe-l'oeil era (Gijsbrechts, van Hoogstraten,
Collier) may inform details, but these three are the brief. Practical use:
when generating/retouching the drawer frame painting and card textures,
prompt in these terms ("Haberle drawer, Peto paper, Harnett lighting")
rather than generic "19th-century trompe-l'oeil."

**Hard scope boundary**: these references govern the *container only*.
The SVGs inside the drawer are the exhibit and each keeps its own style
as specified by its generating prompt — deliberately varied, never
harmonized toward the painterly look. The only global treatments that
touch the items are light-like (§1: cast shadows, varnish sheen,
vignette); the craquelure belongs to the drawer's wood surface, below
the items, never over them (owner decision 2026-07-26). Nothing about
an item's own fills, strokes, or palette is ever adjusted to match the
era. The surrealist collision between the painted container and the
mixed-style vector contents is the point.

The specimen card (§4) sits at the boundary: it is UI, so it takes the
era's *materials* (Peto's aged paper, tacked corners, handled surfaces)
while keeping the site's Courier-Prime/`--plot-red` annotation voice —
an eval sheet that looks like it has lived in this drawer.

---

## 1. Rendering the drawer

### Candidate techniques, compared

| Technique | Oil-painting look | Bytes / hosting | Responsive | Verdict |
|---|---|---|---|---|
| **(a) Layered raster wall textures + CSS 3D perspective** (each wall a `transform: rotateX/Y` plane) | Geometrically "correct" but reads as a video-game box, not a painting; seams at the corners; perspective shifts on resize fight the flat-painting conceit | Medium (4–5 textures) | Fussy — wall planes must be re-derived per viewport | Rejected. The brief is *a painting of a drawer*, not a 3D drawer. Quodlibet paintings are already flat objects depicting depth; CSS 3D over-solves the wrong problem. |
| **(b) CSS-painted wood** (gradients, `repeating-linear-gradient` grain) | Reads as "web gradient wood." Craquelure and brushwork are exactly what gradients can't do | Zero requests | Trivial | Rejected as the primary surface (kept for cheap accents). |
| **(c) Canvas-procedural painting** (brushstroke simulation) | Could get there with serious effort; re-renders on resize; a second rendering world under the DOM items | Zero image bytes, lots of JS | Good | Rejected — highest effort for a result no better than a baked image, and this project's JS budget belongs to the pile, not the frame. |
| **(d) Pre-rendered painted image as the frame + a DOM "well" inside** | The actual target look, baked at leisure (image-model generation and/or hand paint-over), craquelure and brushwork included for free | One WebP/JPEG + one tiling texture, ~200–400 KB total | Excellent via `border-image` slicing (below) | **Recommended.** |

### Recommendation: the "frame kit" — one painted drawer image, sliced with `border-image`

Paint (generate + retouch) **one high-res top-down drawer image** — four inner walls with mitered corners, viewed straight down, lit from the **upper-left**, in the letter-rack/quodlibet oil manner. Then use it two ways:

1. **The walls** become a CSS `border-image`: slice the painting so the four corners are fixed slices and the four wall bands stretch (or `round`-repeat, if the grain tiles) along their axes. `border-image-slice` with `fill` off is purpose-built for this. Result: the drawer renders at **any aspect ratio** — landscape on desktop, tall portrait on a phone (a deep drawer is still a drawer) — with zero letterboxing and no JS.
2. **The well (drawer bottom)** is a plain DOM element (`.jd-well`) inside the border, carrying:
   - a tileable painted wood-bottom texture (`background-size` tuned so grain scale matches the walls);
   - baked-in-CSS **contact shading**: soft inset gradient bands along the **top and left** inner edges (the walls nearest the light shade the bottom beneath them — this is what makes "down into" read), lighter falloff on the bottom/right;
   - this element is the positioning context for every item.

**Painterly layers** (all `pointer-events: none`) — **amended 2026-07-26, owner decision resolving gate G2**:

- **Craquelure**: a small tileable crack-pattern at ~6–10% opacity, plain alpha — **drawer surfaces only (frame bands + well floor), stacked BELOW the items, never over them.** The owner's reading: the craquelure is aging of the drawer's wood, not varnish over a unified painting. The SVG items stay crisp — objects sitting *in* an aged drawer, not painted into it. (The original plan ran the cracks over the items as a unification trick; that direction is dead — do not resurrect it.)
- **Varnish sheen**: one large, very soft diagonal `linear-gradient` highlight (upper-left biased), ~4–6% effective opacity, spanning the whole stage **above the items** (it reads as ambient light, not surface texture).
- **Vignette**: `radial-gradient` darkening at the composition edges, above everything.
- **No `mix-blend-mode` on any full-stage layer (hard rule, 2026-07-26)**: blended layers spanning per-item `filter` layers produce rasterization-seam lines in Safari — faint horizontal/vertical breaks at item layer bounds that blink during hover re-compositing. At these low opacities, plain alpha gradients are visually identical; use them. (Found live on the owner's machine; invisible to headless Chrome verification.)
- **Stacking rule (bug-derived, binding)**: the items live in their own stacking context (a `.jd-pile` wrapper with `isolation: isolate`) so pile-internal z shuffling from digging can never climb above the varnish/vignette — and equally can never dip under the craquelure. Unification of the mixed-style items is carried by the **shared light/shadow system** (below), the sheen, and the vignette — not by texturing the items.

**Item lighting is the other half of trompe-l'oeil.** One global light source (upper-left) drives everything:

- Every item gets `filter: drop-shadow(...)` offset **down-right** — `drop-shadow` follows the SVG's alpha silhouette (unlike `box-shadow`), so a scissors-shaped SVG casts a scissors-shaped shadow onto the wood. This works on SVGs loaded via `<img>`, no inlining needed.
- Shadow parameters are a function of "lift": settled items get a tight dark contact shadow (`~3px 4px 3px`); hovered/held items get a longer, softer, lighter one (mockup-tuned: `16px 22px 8px`) — the shadow animating away from the item is what sells picking it up. **Hard rule, learned from a real artifact (2026-07-26): the blur radius must stay well inside the offset magnitude** (~±blur ≤ ~half the offset). A 14px blur against a 27px offset let the penumbra swamp the displacement on a steeply-rotated item's short axis — the shadow detached into a casterless blot on the floor. 8px blur at the same offset keeps every lifted shadow attached.
- Items near the top/left walls sit inside the well's baked shadow bands, which darkens them slightly for free — correct behavior, no code.

**Asset budget**: drawer frame WebP (with JPEG fallback if needed) target ≤ 250 KB at ~2000 px on the long side; well tile ≤ 80 KB; craquelure tile ≤ 40 KB. All fine for shared hosting; committed like any other asset (the phone→GitHub→FTP workflow is unaffected).

**Safari rendering lesson (Phase 0, 2026-07-26)**: any procedural SVG texture built on `feTurbulence` MUST set `stitchTiles="stitch"`, and the stage should sit on its own compositing layer (`transform: translateZ(0)`). WebKit rasterizes large turbulence regions in chunks; with the default `noStitch`, chunk boundaries show as faint straight seam lines that appear/move as regions re-rasterize (hover, drag, resize). Chrome — including headless verification renders — never shows them; only live Safari does, so test there. Also avoid long straight drawn strokes in floor/frame textures (grain streaks, scuff lines): at background scale they read as artifact lines, and they band the item shadows that cross them. The production **baked raster textures** (the painted frame WebP, tiled floor) are immune to the whole feTurbulence class — one more reason the procedural look is placeholder-only.

**Mockup question to settle (owner gate G1)**: fixed-aspect hero painting (letterboxed like a real framed painting, brass-plaque vibes) vs. the responsive frame kit. The frame kit is the recommendation, but the fixed painting is worth one mockup because it permits richer corner detail (a real painting can put a keyhole or a pull-handle shadow in a specific spot). Phase 0 builds both; the frame kit is the default unless the fixed version clearly wins.

---

## 2. The pile

### Arrangement: computed client-side, deterministic per item, with hand-tuned overrides

**Placement is a pure function of the item's `id`** (a string hash seeds a small deterministic RNG per item — a mulberry32-class PRNG, ~10 lines). No stored coordinates required for the common case; the manifest alone determines the pile. This means:

- Adding item N+1 does **not** move items 1..N's *base* placements — an item's scatter comes from its own id, not from array order or a shared RNG stream.
- A short **deterministic settle pass** then resolves worst overlaps: circle-approximated footprints, 3–4 relaxation iterations, displacement capped at ~½ footprint radius, processed in `dateAdded` order. Old items re-settle identically every load *until a new item lands beside them* — at which point the neighbors shift slightly. **Position taken: this is correct, not a bug.** Tossing something new into a junk drawer jostles what's already there; a pile that never moves reads as a museum case. What must stay stable is the *overall composition*, and it does, because base placements are id-derived and settle displacement is capped.
- **Hand-tuning wins**: any item may carry an optional `placement` block in its metadata (normalized x/y, rotation, z, scale, `pinned`). Pinned items skip the settle pass entirely. This is how hero items get art-directed.
- **Arrange mode** (`?arrange=1`, dev-only affordance): the owner drags items into position and a button copies the resulting `placement` JSON for all moved items to the clipboard, ready to paste into the metadata files from Claude Code. Art direction stays a two-minute act, phone-compatible. Rotation control ships with it (mockup-proven, 2026-07-26): mouse wheel or `[`/`]` while holding an item, and on touch a second finger twists the gripped item around the gripping finger.

Coordinates are **normalized well-space** (0..1 × 0..1); item size is relative to the well's min-dimension. Desktop and phone thus show the *same* pile re-poured into differently proportioned drawers — stable per device, plausibly different across devices.

### Messiness that stays art-directed

Scatter rules (all deterministic from the id hash):

- **Density field, not uniform random.** Sample positions by rejection against a weight map: heavy toward the back-right corner (junk migrates), moderate along walls, and a deliberately **sparse patch near front-center** — the "already dug-through" spot that shows wood grain and invites the visitor to start pushing things around. Uniform random reads as random-ugly; the density field is the composition. (Owner preference, 2026-07-26: the bare patch is negative space ONLY — no scuff-stroke/shavings/debris decoration marking it. A decorated patch was tried in Phase 0 and removed; do not re-add.)
- **Size bands, not normalization.** Each item declares a `sizeClass` (`s`/`m`/`l`); classes map to footprint-diagonal ranges (~7–11% / 11–17% / 17–24% of well min-dimension) with per-item jitter inside the band. Deliberate size variety — a drawer with all-same-size objects looks like a catalog. `l` items are rare and anchor the composition.
- **Rotation bias.** Most items within ±30° of upright with a center-weighted distribution; ~1 in 6 gets a wild rotation (anything); rotations within ±4° of 0°/90° get nudged off-axis so nothing looks machine-placed.
- **Overlap + z-order.** Overlap allowed up to ~40% of the smaller footprint. Base z from the hash, **biased by `dateAdded` — newer items tend toward the top of the pile**, which is both true to the object and quietly showcases fresh work.

---

## 3. Digging interaction

### The minimal set that sells the drawer (Phases 1–2)

Built entirely on the **Pointer Events API** (one code path for mouse/touch/pen):

1. **Hover lift** (mouse only): item scales ~1.04, rotation eases ~2° toward upright, drop-shadow lengthens/softens, `cursor: grab`, 120–160 ms ease-out. The shadow change does most of the work.
2. **Drag aside**: pointer-down + move beyond an ~8 px slop → the item is "held" (max z-index, full lift shadow, slight scale, `cursor: grabbing`), tracks the pointer, and **stays where dropped** with a short settle animation (drop to contact shadow, a small rotation impulse of a few degrees). No physics needed for this to feel like rummaging.
3. **Tap/click** (release within slop): select → item pops to top of pile and the inspection card opens (Section 4).
4. **Touch**: no hover exists; tap = select + inspect (with the card as a bottom sheet so the drawer stays visible behind it); drag = drag, distinguished by the same slop threshold. `touch-action: none` on items only, so the page still scrolls from the frame/margins.
5. **Session persistence**: disturbed positions saved to `sessionStorage` keyed by item id. Within a visit, the mess you made stays made; a **fresh visit resets to the art-directed pile** (position taken: the composition is the artwork; visitors get the curated mess, not the last stranger's).
6. **Keyboard/a11y**: each item is a `<button>` wrapping the SVG `<img alt="title">`; Tab order = z-order top-down; Enter opens the card; Escape closes; `prefers-reduced-motion` collapses lifts/settles to instant state changes.

### Hit-testing: silhouette, not bounding box (decided 2026-07-26, owner-reported bug)

An item's interactive area must be its **painted silhouette**, never its
bounding box. With box hit-testing, the transparent corners of an upper
item steal clicks aimed at an item visibly beneath them — the fastest way
to make the pile feel broken (found immediately in the Phase 0 mockup).
Two implementation paths:

- **Inline SVG + `pointer-events`** (mockup-proven): wrapper and `<svg>`
  root get `pointer-events: none`; shapes get `visiblePainted`. Events
  bubble to the per-item listeners unchanged; `:hover` chains correctly;
  hit areas follow *rotated* geometry for free. Known caveat: SVG masks
  aren't consulted (masked-out holes still hit) — acceptable. Cost: items
  must be inlined into the DOM, which trades against §6's `<img>`
  performance backbone at high item counts.
- **`<img>` + cached alpha-mask hit test** (scales): keep `<img>`
  rendering; on pointerdown, walk items top-down at the point and test
  opacity against a small offscreen-canvas raster of each SVG (cached,
  ~64px is plenty). Integrates naturally with mobile tap-forgiveness
  (nearest-opaque-pixel search is the same machinery).

**Decision**: start Phase 1 with inline SVG + `pointer-events` (dozens of
items — DOM weight is a non-issue at current scale); revisit at the Phase
4 performance pass, where the alpha-mask path is the escape hatch that
preserves silhouette behavior if rendering moves to `<img>`/canvas.

### Deferred fancy (Phase 4, explicitly optional)

- **Neighbor nudge**: while dragging, items within a disturb radius get pushed by position-based dynamics — circle footprints, 2–3 relax iterations, wake-on-contact, sleep within ~0.5 s. Hand-roll it (~100 lines); do not import a physics engine. Only awakened items simulate, so cost stays flat.
- **Shake to tidy/mess**: a small control that re-settles the pile with a brief jostle animation (re-runs settle with a new session-only jitter). Fun, cheap, but strictly after everything else.

Do **not** attempt: continuous gravity, stacking simulation, item-on-item occlusion physics. The drawer is a painting that tolerates being touched, not a physics toy.

---

## 4. Inspection UI — the specimen card

This is the portfolio payload; it gets a real design object: **the annotator's grading slip**. When an item is selected it **lifts out of the drawer** — rendered large over a dimmed, vignetted drawer (scrim ~40%) — with a paper card beside it, styled as an eval annotation sheet in the Municipal Sky voice (Courier Prime mono chrome, hairline rules, `--plot-red` editorial pen marks; see `css/style.css` tokens — the site's whole visual system is already an annotation aesthetic).

**Card anatomy** (top to bottom):

- **Header**: item title; model name + date as mono chips; process chip — `ONE-SHOT` or `REFINED ×N` (N = prompt turns).
- **The prompt**: the full prompt text, blockquote-styled in mono, scrollable past ~8 lines. Displayed verbatim — the prompt craft *is* the exhibit.
- **The rubric**: a small table, one row per graded axis — axis label (left, mono caps) and the grade rendered as a **red-pencil stamped mark** (grade letter/word in a hand-drawn-feeling circle, `--plot-red`), with an optional one-line annotator note under the row. The **overall grade** gets a larger stamp at the table foot. Axes render in the order the manifest's taxonomy block declares; unknown axes still render (the taxonomy grows — the frontend must not hard-code it).
- **Alternatives strip**: a horizontal row of thumbnails — "OTHER MODELS, SAME PROMPT" — with the currently shown response marked. Clicking a thumbnail **swaps the lifted item in place** at full size and swaps the card's model/process/rubric fields; the prompt stays fixed (it's the constant). Flip-through-in-place beats side-by-side for actual comparison because both renders occupy the same pixels at the same scale; a true side-by-side compare toggle is a Phase 4 nicety, not MVP. The drawer's pile item always remains the *primary* response; viewing alternatives never changes the pile.

**Placement per form factor**:

- **Desktop**: centered overlay — lifted SVG left (~55% width, on a subtle "held above the drawer" long soft shadow), card right (~35%, max-width ~420 px). Escape / click-scrim closes; the item animates back down into its pile position (shadow tightening on the way).
- **Mobile**: lifted SVG in the top ~45vh over the dimmed drawer; the card is a **bottom sheet** opening to a peek state (header + overall grade + alternatives strip), drag-up for the full prompt and rubric.
- **Hover micro-tag** (desktop, pre-click, Phase 3+): a small delayed (~300 ms) tooltip near the cursor with model + overall grade — styled later as a manila evidence tag (string and all; very junk-drawer, pure CSS). The tag is a teaser; the card is the exhibit.
- **Deep links**: selecting an item sets `#<id>`; loading with a hash opens that item's card. This is how individual pieces get shared.

---

## 5. Data contract (frontend requirements — interface, not implementation)

The frontend needs exactly two things from the backend: **one manifest** at a stable same-origin URL (proposed: `/art/junk-drawer/data/items.json`) and **one self-contained SVG file per response**, at paths the manifest gives relative to itself. How the backend produces/validates these (phone workflow, storage layout, generation pipeline) is PLAN-BACKEND's business.

```jsonc
{
  "schemaVersion": 1,
  "taxonomy": {                          // optional but wanted: display order + labels
    "gradeScale": ["A", "B", "C", "D", "U"],   // ordered best→worst; "U"tility = lowest
    "axes": [
      { "id": "prompt-fidelity", "label": "Prompt fidelity", "description": "…" },
      { "id": "composition",     "label": "Composition" }
      // grows over time; frontend renders unknown axes generically
    ]
  },
  "items": [
    {
      "id": "whisk-01",                  // REQUIRED, stable forever (placement derives from it)
      "title": "Balloon whisk",          // REQUIRED, short; doubles as alt text
      "dateAdded": "2026-07-26",         // REQUIRED (z-bias + settle order)
      "sizeClass": "m",                  // REQUIRED: "s" | "m" | "l"
      "svg": "items/whisk-01/main.svg",  // REQUIRED, relative to the manifest
      "placement": {                     // OPTIONAL art-direction override (else computed)
        "x": 0.62, "y": 0.31,            // normalized well-space
        "rot": -14,                      // degrees
        "z": 40,                         // optional pile height
        "scale": 1.1,                    // optional, relative to sizeClass baseline
        "pinned": true                   // skip the settle pass
      },
      "eval": {                          // REQUIRED
        "prompt": "full prompt text …",  // REQUIRED, verbatim
        "model": "claude-fable-5",       // REQUIRED, display string
        "process": { "mode": "refined", "turns": 4 },   // or { "mode": "one-shot" }
        "grades": {
          "overall": "B",
          "axes": [ { "axis": "prompt-fidelity", "grade": "A", "note": "…" } ]  // note optional
        }
      },
      "alternatives": [                  // OPTIONAL, same prompt implied
        {
          "model": "other-model-x",
          "svg": "items/whisk-01/other-model-x.svg",
          "process": { "mode": "one-shot" },
          "grades": { "overall": "U", "axes": [ /* … */ ] },   // grades optional per-alt
          "note": "one-line curator remark"                     // optional
        }
      ],
      "tags": ["kitchen"]                // OPTIONAL, reserved for future filtering
    }
  ]
}
```

**Hard requirements on the SVGs** (the frontend loads them via `<img>` — see performance rationale in §6 — so):

- every SVG **must have a `viewBox`** (footprint normalization depends on it; `width`/`height` attributes optional);
- the viewBox must be **tight to the ink** (worst-side dead margin ≤ ~6%): drag clamping and size math trust the box rectangle, so transparent padding makes items bump invisible walls before their visible edges reach the drawer sides (found live 2026-07-26 — the scissors carried 14–16% dead margin; five of the first ten items needed normalizing). Measure with `scripts/check-svg-ink.sh` (canvas alpha-scan, counts stroke widths); tightening the viewBox is framing metadata, not an artwork edit;
- SVGs must be **fully self-contained**: no external references (fonts, images, CSS, `<use href>` to other files) — `<img>` will silently drop them;
- scripts inside SVGs never execute in `<img>` (free sanitization), but the backend should still strip them;
- transparent backgrounds (no opaque white rects) — items must silhouette against the wood for the drop-shadows to work. If a piece *needs* a background (a "painting within the painting"), that's fine — it just casts a rectangular shadow, honestly.

**Stability rules**: `id` values and existing `svg` paths never change or get reused; new items append; the manifest is a full snapshot (no pagination — see §6 for the scaling story). A `bytes` or item count is not needed; the frontend fetches once, no-cache-busting handled by the site's `?v=` convention or a `Cache-Control` the backend chooses.

---

## 6. Phasing

### Phase 0 — Mockups (in `mockups/`, standalone HTML, no PHP, curator's `.mock-label` caption like the siblings)

- `mockup-1-quodlibet.html` — fixed-aspect hero drawer painting, ~8 placeholder SVGs hand-placed, the full lighting stack (baked wall shade, item drop-shadows, craquelure, varnish, vignette). Placeholder drawer art generated for the mockup; final art is its own task.
- `mockup-2-frame-kit.html` — the `border-image` responsive drawer, same items, exercised at desktop and phone-portrait sizes.
- `mockup-3-specimen-card.html` — the inspection card with fake data: rubric stamps, prompt block, alternatives flip-through; desktop overlay + mobile bottom-sheet variants.
- **Owner gates**: **G1** ~~fixed-aspect vs frame kit~~ — RESOLVED: frame kit (mobile requirement decides it, see PLAN-MOBILE §1) · **G2** ~~craquelure over items~~ — RESOLVED 2026-07-26: craquelure is drawer-surface aging only (frame + floor, below the items), never over the items; any strength toggle governs the wood only · **G3** card register: red-pencil stamps vs typed grades (default: stamps) · **G4** fresh-visit reset vs cross-visit mess persistence (default: reset).

### Phase 1 — Walkable drawer (the milestone that must demo)

- `index.php` (kolob's shell copied: `$page_title/description/image`, `jd_v()` md5 cache-buster, `VERSION` + build stamp, colophon links, page-view tracking POST to `../../api/page-event-tracking.php`).
- `junk-drawer.css` — drawer frame kit, well, unification layers, item base styles.
- `jd-data.js` — manifest fetch + validation (fail soft: skip malformed items, `console.warn`).
- `jd-pile.js` — id-hash RNG, density-field scatter, settle pass, normalized→px mapping, resize handling.
- `jd-main.js` — boot, item DOM construction (`<button><img loading="lazy" alt></button>`), hover lift, tap-to-front.
- `data/items.json` + 8–10 placeholder SVGs (hand-written manifest; becomes the backend's contract fixture).
- **Deliverable**: the page loads under site chrome, the drawer looks like a painting, items lift on hover and pop to front on tap, works on a phone. No card, no drag yet.

### Phase 2 — Digging

- `jd-dig.js` — pointer capture, slop threshold, drag + settle-on-release, z management, `sessionStorage` persistence, `touch-action` discipline.
- Arrange mode (`?arrange=1`) with copy-placement-JSON button.
- Keyboard traversal + reduced-motion pass.

### Phase 3 — The specimen card (the portfolio moment)

- `jd-card.js` — overlay/bottom-sheet, lift-out/return animations, rubric renderer driven by the taxonomy block, alternatives flip-through, hash deep-links, Escape/scrim close.
- Hover micro-tag (plain tooltip form).
- Track `item_open` events (label = item id) alongside page views.
- Add the project card to `/art/index.php` and an OG share image (`$page_image`) — screenshot of the drawer.

### Phase 4 — Polish & scale

- Neighbor-nudge PBD (hand-rolled, ~100 lines), manila-tag tooltip styling, varnish/vignette tuning against the final drawer painting, side-by-side compare toggle in the card, optional shake-to-settle.
- **Performance program for growth** (dozens now → maybe hundreds):
  - `<img>`-per-item is the scaling backbone: browser-managed decode/cache, no DOM-inlined SVG bloat, no per-item parse cost; dozens of small requests are fine, and at low hundreds the manifest stays a single fetch while images trickle with `loading="lazy"` beneath the fold of the pile (z-order top items first via manual priority). Caveat (see §3 hit-testing): `<img>` cannot do silhouette hit-testing natively — moving to `<img>` requires the cached alpha-mask hit test. Phase 1 ships inline SVG instead; migrate only if measurement demands it.
  - `filter: drop-shadow` promotes layers; keep it **static** on settled items (computed once) and animate it only on the single hovered/held item (`will-change` applied on interaction start, removed on settle).
  - All motion via `transform` only; the well's px geometry computed once per resize; zero layout reads in the interaction path.
  - Escape hatch if hundreds of filtered layers strain low-end phones: composite the *undisturbed* pile into one canvas snapshot and overlay live DOM only for items the visitor has touched (measure first; do not build speculatively).
- Publish via the site's publish-site workflow.

---

### Critical Files for Implementation

- /Users/tysonwelsh/Sites/municipal-sky-site/art/junk-drawer/README.md — the owner's vision; source of truth for every decision above
- /Users/tysonwelsh/Sites/municipal-sky-site/art/kolob/index.php — the page-shell conventions to copy verbatim (cache-buster, VERSION/build stamp, header/footer includes, tracking snippet)
- /Users/tysonwelsh/Sites/municipal-sky-site/css/style.css — site design tokens (Courier Prime chrome, `--plot-red`, hairline rules) that the specimen card is built from
- /Users/tysonwelsh/Sites/municipal-sky-site/includes/header.php — chrome inheritance and the `$page_title/$page_description/$page_image` contract `index.php` must satisfy
