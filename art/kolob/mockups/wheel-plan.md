# KOLOB — the order of service as a WHEEL

*A plan for replacing the printed seven-row program (and its straight
progress rule) with a turning wheel seen low on the horizon.*

## The idea, restated

The seven sections of a meeting are seated around the rim of one wheel.
The page shows only the crown of that wheel — a sun just above a distant
horizon, not even the top half. The section now playing sits at the crown,
upright and fully legible; its neighbours to the left and right are
visible only in part, their labels dipping beneath the horizon. Above the
crown label, hugging the rim, an **arc** fills from left to right as the
section plays — the bar graph bent to the wheel. When the arc completes,
the wheel turns **anticlockwise** by one seat: the finished section slides
down to the left, the section that was waiting on the right rises to the
crown, and its arc begins.

Because it is a wheel, the program never "starts over at the top": postlude
turns into the next meeting's prelude the same way any other section turns
into the next. The cycle is the picture.

## Where it lives

Today: `#kolob-order` (seven `.kolob-order-row` divs) in the left column of
`.kolob-columns`, next to the hymn board.

Proposed: the wheel wants width — the horizon metaphor is horizontal — so it
becomes its own full-width band under the console, keeping the
`𐐃𐐡𐐔𐐊𐐡 𐐊𐐚 𐐝𐐊𐐡𐐚𐐆𐐝` section head. The hymn board and broadside then take
the columns row alone (or the board goes full width; either is a small CSS
change). The band is ~200–240px tall on desktop, ~150px on phones.

Markup change in `index.php`:

```html
<div class="kolob-order-block">
  <div class="kolob-sec-head">𐐃𐐡𐐔𐐊𐐡 𐐊𐐚 𐐝𐐊𐐡𐐚𐐆𐐝</div>
  <div class="kolob-wheel-wrap">
    <canvas id="kolob-wheel" class="kolob-wheel" aria-label="the order of service, a wheel"></canvas>
    <div id="kolob-wheel-live" class="visually-hidden" aria-live="polite"></div>
  </div>
</div>
```

## Geometry

All in one canvas (2D context, DPR-aware like the other three Kolob
canvases). Let `N` = number of seats (7, see *data* below),
`STEP = 2π / N`.

- **Radius** `R` is derived from the band width: `R ≈ 0.5 × width` gives the
  "distant sun" look (crown at the top of the band, wheel centre far below
  it); the mockups vary this. Clamp to a minimum (~280px) so on phones the
  wheel simply runs off the band's edges rather than shrinking into a coin.
- **Centre** `(cx, cy) = (width / 2, crownY + R)`.
- **Seat angle** for section `i`: `θᵢ = −π/2 + (i − offset) × STEP`, where
  `offset` is the wheel's rotation expressed in seats. At rest
  `offset = currentSectionIndex`, so the current section is at −π/2 (the
  crown). Increasing `offset` turns the wheel anticlockwise: the crown
  seat moves toward 9 o'clock, the seat at ~1 o'clock rises to the crown.
- **The horizon** is a hairline rule at `crownY + h`, with `h` chosen so the
  crown label is fully visible and the neighbouring labels straddle the
  rule. With `R = 0.5 × width` and `N = 7`, the neighbours sit
  `R(1 − cos STEP) ≈ 0.35R` below the crown, so `h ≈ 0.4R` shows the tops
  of their labels — exactly the "parts of the labels on the left and right".
  Everything below the rule is clipped (`ctx.clip()` on a rect).
- **Labels** are printed on the wheel: tangent to the rim (rotated by
  `θᵢ + π/2`), seated just inside it. The current seat prints in `--ink`,
  neighbours in `--ink-soft`, finished seats in `--ink-faint` (the existing
  row colour states). *Alternative (mockup 2): upright labels that ride the
  rotation but never tilt, like the numerals on a dial.*
- **The arc.** ONE arc, fixed to the page at the crown; it does not turn
  with the wheel. Its span is set once from the widest label plus padding
  (`span = (widestLabel + 1.6·fontPx) / R`), so every section reads inside
  the same bar. The track is the dotted hairline the rows use now, with
  hairline end-stops; the fill is a 3px gilt arc from the left end to
  `progress × span`. When a section completes the fill holds through the
  turn and fades as the next seat rises, then the same arc fills again from
  the left. While the hymn seat is at the crown, ticks divide the arc one
  hymn to a part. Finished labels go faint on the rim (the rows' *done*
  colour) and recover as the next meeting's prelude rises.
- **Labels** are lettered round the rim glyph by glyph, each rotated to its
  own tangent (the mockup's `curvedText`), at a size that scales with the
  wheel: ~24px at full width, 14px on a phone.

## Data — what the engine already gives us

`KolobAudio.getConductor()` returns `section`, `local` (0–1 within the
section), `sectionIndex`, `planLength`, `meeting`. That is nearly enough.

The plan is not always seven sections long: a meeting holds 1–3 hymns, may
insert an `interlude` after a hymn, and a cumulative meeting may seat a
second `doxology`. The printed program already folds these
(`interlude → hymn` row, all hymns share one row). The wheel should keep
**seven fixed seats** (the wheel's geometry must not change mid-meeting)
and fold the same way. To fill the hymn seat's arc smoothly across two or
three hymns (with a tick between them) the wheel needs to know the plan's
shape, so add one field to `getConductor()` in `kolob-audio.js`:

```js
plan: C.plan.map(function (s) { return s.type; }),   // e.g. ["prelude","invocation","hymn","interlude","hymn",…]
```

From that, per seat: `count = plan entries folding to this seat`,
`k = index of the current entry among them`, and
`seatProgress = (k + local) / count`. Everything else (`section`, `local`,
`sectionIndex`) is unchanged. No engine behaviour changes.

## Motion

- **Filling** — `local` is polled every 300ms today; the arc should be drawn
  every frame with a short linear tween toward the polled value (the rows'
  900ms width transition does this in CSS now).
- **The turn** — when the folded seat index changes, animate `offset` from
  the old seat to the new over ~1.6s with an ease-in-out. The engine's
  section *joint* (organ cadence + bell, 2–4s) happens between sections
  while `local` sits at 1, so the picture is: arc completes → cadence and
  bell → the wheel turns as the new section enters. No extra timing needed;
  the poll already delivers this order.
- **The wrap** — postlude → prelude is an ordinary one-seat turn
  (`offset` keeps increasing; angles are periodic). When `meeting`
  increments, the finished-seat arcs fade out during that turn. Keep
  `offset` reduced mod `N` after each turn so it never grows unbounded.
- **Skip / stop** — `skipToSection()` (dev) can jump several seats; animate
  the shortest anticlockwise turn to it. On stop, the wheel stays where it
  is with the arc emptied (the rows go blank today).
- `prefers-reduced-motion`: snap instead of turning.

## Rendering home

Put the wheel in `kolob-viz.js` as a fourth canvas: it already owns the
`requestAnimationFrame` loop, DPR/resize handling, the font stack, and
receives `setConductor(c, playing)` every poll. `updateOrder()` in
`kolob-ui.js` shrinks to a no-op (or is removed with the row CSS). The
dev "jump menu" (click a row → `skipToSection`) becomes a hit-test on the
seats' angular ranges (`atan2` from the wheel centre); keep it Latin-mode
only as now. The Latin/Deseret toggle just re-reads the label table on the
next frame.

Deseret glyphs on canvas: draw only after `document.fonts.ready`
(fallback: draw once, redraw on `fonts.loadingdone`) — the other canvases
should already be doing this for the Liahona dial.

## Accessibility

The canvas has an `aria-label`; a visually-hidden `aria-live="polite"`
element receives "HYMN · 2 of 2 · 40%" style text, updated only on section
change and at quarter marks (not every frame).

## Steps

1. `kolob-audio.js` — add `plan` to `getConductor()` (one line).
2. `index.php` — replace `#kolob-order` with the wheel canvas + live
   region; move the order block out of the columns grid into a full-width
   band.
3. `kolob-viz.js` — `initWheel(canvas)`, `drawWheel(dt)`: geometry, seat
   folding, arc, turn tween, wrap fade, reduced-motion, font readiness,
   hit-testing for the dev jump.
4. `kolob-ui.js` — retire `updateOrder()` DOM building; route the dev
   click to the viz hit-test; keep `applyScript()` heading swap.
5. `kolob.css` — `.kolob-wheel-wrap` / `.kolob-wheel` sizing, band layout,
   phone breakpoint at 700px; delete the `.kolob-order-row` rules.
6. `VERSION` → `v0.11` (the footer stamp is how the owner checks the build).
7. Test: `?latin=1` jump menu skips; a conference meeting (3 hymns) fills
   the hymn seat in thirds; a cumulative meeting's second doxology folds;
   stop/play; phone width; reduced-motion.

## What the three mockups vary

| | 1 · the horizon | 2 · the dial | 3 · the sunrise |
|---|---|---|---|
| how much wheel shows | a shallow cap, sun on a far horizon | a broader cap with spokes and a hub | a disc behind a valley silhouette |
| labels | printed on the rim, tilt with the wheel | upright, ride the wheel like dial numerals | printed on the rim, tilt with the wheel |
| the arc | one gilt bar fixed at the crown, refilled each section | ink fill between the rim's double rule | a corona of engraved rays growing round the crown |
| the fixed mark | none — the crown is the mark | a gilt index at the crown | none |
| finished seats | labels go faint on the rim | faint fills between the rules | faint rays remain |

Open each mockup; the demo runs a shortened meeting (about 5s a section,
1.6s a turn) and rolls into the next meeting so the wrap can be seen.
`TURN` advances a seat at once; `Latin` swaps the labels.
