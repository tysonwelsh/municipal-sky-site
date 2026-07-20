# PLAN — The Night Folio (owner direction, 2026-07-20, post-launch review)

The spiral revert (PLAN-SPIRAL-REVERT) shipped and the owner reviewed it
live. Verdict: the coil is right, but the page around it is not. This
plan supersedes the "window in a page" composition. PLAN-SPIRAL-REVERT's
coil, floor, and palette decisions all stand unchanged.

## 1. What the owner saw (and what's actually wrong)

- **The coil overhangs the frame.** Confirmed and diagnosable: the coil
  spans −3…+4 octave-steps around the plate center (`(frac −
  (OCTAVES−1)/2) · oct` with frac ∈ [0,7] — top-heavy by one turn), and
  the FFT contour extrudes a further `peak` above the top turn. On the
  live 660-px plate, `R = min(0.21h, 0.27w)` with v1's `oct = 0.55R`
  gives a worst-case top of ≈ `(4·0.55 + 0.825)·R·cos(pitch)` ≈ 400 px
  above center — past the window's top edge and past the canvas itself.
  Nothing clips the L2 data pass to the night area, so loud top-octave
  content paints across the paper frame. (v1 never hit this: its canvas
  was 720 px tall, black edge-to-edge, so overflow just cropped
  invisibly.)
- **Still not seamless.** Three different surfaces meet: the plate's
  baked paper, the margin/footer's baked paper (different random field),
  and the folio's flat CSS paper in the gaps between canvases. Calm as
  they all are, the texture boundaries and the window-in-a-page
  composition still read as parts, not one instrument.
- **Direction miss.** The design is still v2's codex page with a black
  window cut into it — an iteration on the old skin. What we're going
  for now: **the night ground is the interface**; the spiral is the
  hero; the codex voice survives in the ink (type, stamps, dither,
  gilt), not in parchment fields.

## 2. The rework: invert figure and ground

**One night surface, one thin frame.** The entire folio interior —
plate, margin apparatus, footer, scribal log — sits on the track's
night ground (the v1 near-blacks already confirmed as O4). The paper
frame shrinks to a single slim rounded-square outline around the WHOLE
folio (the shape the owner chose in O5), drawn once at the folio level —
not per canvas. Seams become impossible because there is nothing to
seam: every panel shares the same flat night field.

The codex/pixel-art direction is not abandoned — it moves into the ink:
VT323/Jacquard typography, the sprite stamps, Bayer/blue-noise dithers,
gilt illumination, rubricated accents where contrast allows. Parchment
survives only as the thin frame (and optionally the track tabs — owner
gate G3).

## 3. Workstreams

### A — Geometry & clipping (bug-grade; land first, independently)

1. **Size the coil from the vertical budget.** Derive `R` in
   `plateMetrics` from what must fit: `topNeed = (4·oct + peak)·cos(p)`,
   `botNeed = (3·oct + floorDrop + labelRing)·cos(p) + R·sin(p)` — solve
   `R` so `max(topNeed, botNeed) ≤ h/2 − inset` at the default camera
   pitch, capping by width as before. Also recenter: because the coil is
   top-heavy by one turn, drop the plate center to `CY ≈ 0.53h` so the
   +4/−3 span sits visually centered.
2. **Hard clip.** Wrap the L2 data renderer in `ctx.save() +
   rounded-rect clip` to the night area regardless of camera drag, FFT
   extremes, or future marks. The frame can never be painted over again,
   by construction. (After workstream B the clip region is the whole
   canvas minus nothing — keep the clip anyway as the invariant.)

### B — One night surface

1. **Papers become night.** `paperPlate` / `paperMargin` / `paperFooter`
   → a single shared generator: flat fill of `spiral.bg` plus an
   ultra-low-contrast blue-noise grain (±1 tone step at ~3% visibility,
   art-pixel sized — the pixel-art texture kept, but nearly subliminal).
   No parchment, no soot rag, no engraved plate on the panels. Delete
   the plate-zone window entirely — the whole canvas is night.
2. **The frame moves to the folio chrome.** `.pj2-folio` gets the thin
   rounded-square paper frame: `border: ~10px` in the track's paper
   tone, rounded corners (keep the stepped pixel-corner clip-path
   flavor if it survives the rounding — G2), night interior
   (`background` = night ground). Folio padding tightens (~18/20 →
   ~10/12). Canvas gaps stay but become invisible (night on night).
3. **Ariel's frost.** The engraved-plate texture the owner liked lives
   on in the thin frame itself (burnish + a few gilt star flecks in the
   border band only), not inside the panels.

### C — The ink flip (the big recolor)

1. **Library** is the only track whose apparatus is dark-ink-on-light:
   margin dials, genealogy tree, footer envelope, scribal log, cabinet
   chrome all flip to the amber phosphor ramp on night. Mapping:
   `ink[0..3]` → amber ramp (`#ffdc82 #ffc878 #b4823c #785f32`;
   measured on `#0a0805`: 15.1 / — / 5.9 / 3.3 — the last is a
   depth-cue-only step, same rule as today). Rubric: measured `#b0553c`
   = 4.0:1, `#8e3b2c` = 2.7:1 on night — **neither is data-legal**, so
   rubric demotes to display-size accent duty only and gilt (8.3:1)
   takes rubric's data-adjacent jobs. Gilt unchanged.
2. **Sycorax / Ariel** apparatus is already light-on-dark (bone on
   soot, silver on plate) — only their paper vars change to the night
   grounds, plus a contrast re-measure.
3. **The registry is the contract**: PALETTES gets per-track
   `night` groups (ground + data-legal ramps + worstBg = the night
   ground); `assertDataInk` and `checkContrast` re-pointed so the
   tripwire and the skin-test page stay honest. CSS `[data-track]`
   variable blocks regenerated from the same values (folio bg, tab
   colors, log ink ramps, cabinet chrome).
4. **DOM surfaces**: scribal log, cabinet, folio head, legend — same
   flip via the CSS vars; Jacquard display type in phosphor with gilt
   initials.

### D — Layout tightening

1. Plate / margin / footer sit flush on the shared ground; the eye
   should read one instrument with a spiral at center-left, apparatus
   right, envelope below.
2. Tabs: restyle to sit on the night frame (G3 decides parchment-tab vs
   night-tab treatment).
3. Re-derive the margin/footer furniture spacing that assumed paper
   headings (rules, underlines) — keep the diagram-furniture voice,
   recolored.

### E — Verification

1. `viz-smoke.js`: all existing checks + re-pointed ink assertions
   green.
2. `Skin.checkContrast()` rows all pass against the night worstBg
   (skin-test.html updated).
3. Chromium screenshots of the FULL page (not just the folio) per
   track, at 1560- and ~1000-px widths, with live engines; explicit
   check: no coil pixel outside the night area at default camera AND
   at dragged pitch extremes.
4. Soak: `render-soak.html` — papers get cheaper (flat fills), expect
   composite times to drop.

Order: A (ship-worthy alone, fixes the live overhang fast) → B → C →
D → E. B–D land together as the rework proper; A can go out the moment
it's ready.

## 4. What does NOT change

- The coil renderer, constellation floor, octave axis, note marks —
  all of PLAN-SPIRAL-REVERT's spiral work is untouched by this plan.
- The three audio engines, conductor, events, harness.
- v1 at `../prosperos-jukebox/` stays frozen.

## 5. Owner gates

- **G1** Frame thickness: ~10 px paper outline (default) — or hairline
  (2–4 px), or none at all (pure night, frame implied by the page
  background behind the folio)?
- **G2** Corners: CSS rounded corners on the frame (default, matches
  the O5 window ruling) — or keep the stepped pixel corners instead of
  rounding?
- **G3** Track tabs: parchment tabs on the night book (default — the
  one place paper keeps a foothold, reads as physical index tabs) — or
  fully night tabs with phosphor lettering?
- **G4** Scribal log density: keep the full DOM log column (default) or
  slim it now that the dark field makes it more prominent?
