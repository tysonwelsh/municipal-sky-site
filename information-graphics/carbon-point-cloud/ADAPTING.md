# Adapting this dashboard to a new dataset

This document is the porting brief. It exists so that this folder can be
handed — to a collaborator, or to an AI assistant such as Claude — with an
instruction like *"build me a dashboard in this style for my new dataset"*,
and the result comes out a true sibling: same design language, same
interaction grammar, same honesty about the numbers, different science.

If you are the assistant doing the adaptation: read `index.html` in full
before writing anything (it is one file, ~2,000 lines, and it is the entire
application), then come back here. This file tells you which parts are load-
bearing architecture, which parts are the transferable style, and which parts
are carbon-specific and expected to be replaced.

## 1. Architecture — what to keep

**One self-contained HTML file, static precomputed data, no build step.**
The viewer is a single `index.html` using vanilla JS + D3 (vendored) and a
2D canvas for the 3D cloud. All expensive computation happens offline in
Python and ships as static per-item payloads. Keep this shape unless the new
dataset genuinely cannot be precomputed. It buys: no server, no toolchain,
works from `file://`, trivially hostable anywhere, and the whole app is
reviewable in one read.

**The JSONP data contract.** Each data file is JSON wrapped in a callback:

```js
// structures/<id>.js
window.__STRUCT_CB({ id, name, group, natoms, nbonds, lattice, pos, cn,
                     bonds, rings, ringCounts, rdf, atomRings });
// structures_bne/<id>.js  (the "extra channel" sidecar — see §6)
window.__BNE_CB({ id, natoms, nDisplay, curve, descriptor, descRange, byN });
// structures/manifest.js — the index the UI builds its selector from
window.__MANIFEST = [{ id, name, group, natoms, nbonds }, …];
```

Payloads load lazily via injected `<script>` tags (`loadStructure`/`inject`),
with `?v=Date.now()` cache-busting, a cache object per kind, and prefetching
for sequence ghost curves. This is deliberate — `fetch()` is blocked on
`file://`, script tags are not. Keep the pattern; rename the fields to your
domain.

**Field semantics of the main payload** (units are Å):
`lattice` 3×3 cell vectors (rows); `pos` flat xyz triplets, atoms wrapped
into the home cell; `cn` per-atom coordination; `bonds` flat index pairs,
intra-box only; `rings` drawable rings as atom-index cycles; `ringCounts`
{size: count} over the full periodic ring set; `rdf` {dr, rmax, g};
`atomRings` per-atom list of ring sizes through that atom.

**The generator split.** `tools/preprocess.py` = geometry that any point-cloud
dataset needs (parse → neighbor grid → per-atom classes → histograms/curves →
JSON). `tools/bne.py` = the paper-specific derived quantity, kept separate so
its heavy computation and its external dependency don't entangle the basics.
Mirror that split: one generator for geometry, one per derived analysis.

## 2. The design system — this is the style to preserve

**Every color the app uses is a CSS custom property**, defined once on
`:root` with a dark variant under `@media (prefers-color-scheme: dark)`:
surfaces (`--page --surface --ink --ink-2 --muted --grid --baseline
--border`), one categorical family per classification (`--cn0…--cn8`), one
diverging family per "distance from reference state" scale (`--ring3…--ring10`,
warm below the reference, neutral at it, cool above), and ramp endpoints for
continuous channels (`--strain-lo/mid/hi`). The canvas reads them at draw
time via `getComputedStyle`, so themes and dark mode need zero JS changes.

**Themes are data.** Files in `themes/` call
`window.__registerTheme({id, name, vars, varsDark, css, render, cnDominant})`.
`vars` override the custom properties; `render` overrides canvas parameters
(dot-size/alpha curves, line widths, fill opacities — see `FALLBACK_RENDER`);
`cnDominant` lets a theme claim one signature color for whatever class is most
populous per item. Themes contain no domain knowledge — port them untouched.

**Color rules.** Categorical classes get fixed distinguishable hues.
Diverging scales center on the domain's reference state (here: the graphitic
6-ring; find your dataset's equivalent). Continuous per-atom channels use a
3-stop ramp interpolated in Lab (`d3.interpolateLab`), with stops derived from
theme variables so every theme restyles them for free. The strain idiom:
neutral at the *median*, symmetric span, so color reads as deviation
magnitude. The entropy idiom: calm at "ordinary", hot at "rare".

**Panel anatomy.** Uppercase-tracked `h2` heading; an "i" badge whose
hover/focus tooltip carries the full explanation (explanations cost no
layout); content rows in the shared row idiom — color dot, label,
count, percentage, `tabular-nums` everywhere; a `.hint` line for live
readouts; `.meta-row` key/value pairs for facts. Charts are small inline
SVGs (~100–130px tall) rebuilt wholesale on data change, with axis captions
in the top margin so they never collide with tick labels.

## 3. The interaction grammar — the usability to preserve

- **Click a class row → isolate it in 3D. Shift-click → add to selection.
  Click again → clear.** Same gesture on every classification panel.
- **Brush a chart → select in 3D** (histogram ranges, curve intervals);
  click outside the band to clear. Throttle redraws with one rAF gate.
- **All filters AND together.** Implementation: `draw()` computes one
  `dimmed` predicate per atom from every active selection; dimmed atoms drop
  to a low-alpha neutral. Add new filters by adding one clause there.
- **Hover → tooltip** with everything known about that atom (built from a
  d3.quadtree over projected positions, rebuilt ~120 ms after motion stops).
  **Click an atom → spotlight** it plus its rings.
- **Sequences**: curated ordered series of items with ◀ ▶ / Play; the camera
  holds still across stages so change reads as change; the *other* stages
  draw as gray ghost curves in every chart; brushed ranges persist across
  stages for comparison.
- **A population strip** under each item's headline number: every item in the
  collection as a tick, this one highlighted — a number means nothing without
  its population.
- **Reset view** restores camera *and clears every selection and filter*.
- Orbit camera: drag rotate, shift-drag pan, wheel zoom (Ctrl/⌘ when
  embedded, so the host page keeps its scroll). Optional fly mode (WASD).
- Mobile: layout collapses under 760 px, heavy panels are gated off,
  pinch-zoom and tap-tooltips handled explicitly (`coarsePointer`).

## 4. Honesty features — the approach to preserve

These are the parts reviewers (and the original paper's authors) cared about:

- **The color channel decomposes the headline number exactly.** Per-atom
  surprisal −ln P averages to the entropy: the cloud coloring *is* the
  statistic, not an illustration of it. When you add a per-atom channel for
  a structure-level number, look for the decomposition that makes the mean of
  what you paint equal the number you report.
- **On-panel warnings when a number shouldn't be trusted** (here: the
  finite-size ceiling, shown in red on the panel itself — never hidden in a
  tooltip). Encode the failure modes of your statistics, not just the values.
- **Shown vs. counted distinctions are visible**: rings crossing the periodic
  boundary are counted in bars but drawn faded; anything sampled or truncated
  says so next to the number.
- **Report as computed.** Counterintuitive results stay; the copy may note
  them, never "correct" them.
- **A verification anchor**: one number reproduced against the source paper
  (here AC 2.9/8000 → 0.2399 vs Fig. 2c ≈0.24), stated in the README and
  re-checkable with one command. Give every adaptation its own anchor.

## 5. What is carbon-specific — the checklist to replace

| Where | What |
|---|---|
| `tools/preprocess.py` | `CUTOFF = 1.8` Å bond criterion; single-element assumption; `GROUPS` + `pretty_name()` naming; POSCAR parsing (swap for your format) |
| `tools/bne.py` | everything — it exists for this paper's descriptor |
| `index.html` `CN_NAMES` | sp²/sp³ chemistry labels |
| `buildMeta()` | carbon atomic mass 12.011 in the density readout |
| `buildRdf()` | graphite 1.42 / diamond 1.54 / cutoff 1.8 annotation lines |
| `SEQUENCES` | the four curated series (ids are dataset-specific) |
| `DEFAULT` | the structure shown on load |
| header/footer/tooltips | all copy, citations, and the "i"-badge explanations |
| `structures*/` payloads | regenerated, obviously |

Multi-element datasets additionally need per-species pair cutoffs in the
neighbor search and a species color channel — both are localized to
`preprocess.py` and one new "Color by" mode.

## 6. Recipe

1. **Understand the new dataset**: items, per-item geometry, the per-atom
   (or per-point) classifications, the continuous channels, the one headline
   statistic per item, and its failure modes.
2. **Design the payload**: mimic the field list in §1; keep flat typed-array-
   friendly layouts (`pos` as flat triplets, index pairs for edges).
3. **Write the generator** from `preprocess.py`'s skeleton: parse → wrapped
   positions → grid-accelerated neighbor search → classes → curves →
   JSONP-wrapped JSON + manifest merge. Substring-filter CLI for single-item
   regeneration.
4. **Derived analyses** (the equivalent of BNE) get their own generator and
   sidecar, loaded like `loadBne`, with their own panel. If a reference
   implementation exists, call it — do not reimplement it (this repo learned
   that the hard way; see the README's verification-anchor note).
5. **Gut and refill the viewer**: keep the sections in this order — themes,
   state, data loading, per-item derived data, panels, projection, draw,
   charts, tooltip, interaction, selector, sequences. Replace domain labels
   and panels; keep the grammar of §3 and the anatomy of §2.
6. **Choose palettes** by the rules in §2 (categorical / diverging-around-
   reference / Lab ramps from theme vars). Port `themes/` untouched.
7. **Curate sequences** — the ordered comparisons are where the dashboard
   earns its keep.
8. **Write the "i" explanations and the page copy** dry and instructional.
9. **Verify the anchor number** against the source of truth and state it in
   the README.
10. **Test**: open from `file://`, resize, dark mode, every theme, mobile
    width, and every filter combination you can compose.

## 7. Ground rules for the adapting assistant

- No frameworks, no bundlers, no npm. One HTML file, vendored D3, static data.
- Preserve `file://` compatibility (script-tag data loading, `try/catch`
  around `localStorage`).
- Read the whole viewer before editing; match its comment density and voice.
- Keep every number on screen attributable: where it came from, over what
  population, with what caveats — and keep the caveats on the panel.
- When the source is a published paper, cite it in the footer and verify one
  number against it before calling the port done.
