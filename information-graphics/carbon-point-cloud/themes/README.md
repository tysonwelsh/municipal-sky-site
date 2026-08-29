# Themes for the Carbon Point Cloud viewer

Each file in this folder is a self-contained theme. Themes are selectable from
the **Theme** dropdown in the viewer, and the choice persists across reloads
(`localStorage`).

## Adding a theme

1. Copy `default.js` to `mytheme.js`.
2. Change `id` (unique, used for persistence) and `name` (dropdown label).
3. Edit whatever you like — every field is optional; anything omitted falls
   back to the default rendering.
4. Add `<script src="themes/mytheme.js"></script>` to `index.html`, next to the
   other theme tags. Plain script tags, no build step, works over `file://`.

## What a theme controls

```js
window.__registerTheme({
  id: "mytheme",
  name: "My Theme",
  colorScheme: "dark",   // optional; only meaningful for pinned single-palette themes

  vars:     { "--page": "...", ... },  // applied always (or in light mode if varsDark exists)
  varsDark: { "--page": "...", ... },  // optional; applied under OS dark mode.
                                       // Omit to pin one look regardless of OS setting.
  css: "...",                          // extra CSS, injected verbatim into <style id="theme-css">
  render: { ... },                     // canvas drawing parameters (see below)
});
```

### `vars` — palette (CSS custom properties)

Applied inline to `<html>`, so they override the built-in `:root` palette.
Any valid CSS color works (hex, `rgb()`, `hsl()`, named).

| Variable | Controls |
|---|---|
| `--page`, `--surface` | page background; panel/plot/tooltip/control surfaces |
| `--ink`, `--ink-2`, `--muted` | primary text; secondary text; faint text, axis labels, dimmed atoms, RDF annotations |
| `--grid`, `--baseline` | cell-box outline + chart gridlines; chart axes and RDF ghost curves |
| `--border` | hairline borders, legend-dot outline |
| `--bond` | bond strokes in the 3D view |
| `--cn0`…`--cn8` | atom colors by coordination number (also legend dots, RDF curve = `--cn4`, pair highlight + brush tint = `--cn2`) |
| `--ring3`…`--ring10` | ring polygon colors and ring-chart bars, by ring size |

### `css` — free-form CSS

Injected after the built-in stylesheet, so equal-specificity rules win. Use it
for typography (`body { font-family: … }`), textures (background gradients on
`.plot`/`.panel`), border radii, shadows, hover effects. Note the canvas
itself is a bitmap — CSS textures show through only where the canvas is
transparent (the plot background), and canvas-drawn text ignores page fonts
(use `render.axisLabelFont`).

### `render` — canvas parameters

| Key | Default | Meaning |
|---|---|---|
| `bondWidth` | 1 | bond stroke width |
| `bondAlphaBrushed` | 0.10 | bond opacity while an RDF range is brushed |
| `dimAlpha` | 0.10 | opacity of atoms filtered out by a selection |
| `ringFillAlpha` / `ringStrokeAlpha` | 0.30 / 0.7 | ring polygon fill/outline opacity |
| `ringMutedFactor` | 0.18 | ring fade factor while an RDF range is brushed |
| `ringWidth` | 1 | ring outline width |
| `pairHighlightAlpha` / `pairHighlightWidth` | 0.55 / 1 | RDF pair-highlight line style |
| `cellBoxWidth` | 1 | simulation-box outline width |
| `axisLabelFont` | `12px system-ui, sans-serif` | canvas font for cell axis labels |
| `axisLabel(name)` | `` `${name} (Å)` `` | optional formatter for canvas axis-label text (e.g. all-caps, spelled-out units) |
| `orbitSize(t)` / `orbitAlpha(t)` | `0.72+0.55t` / `0.55+0.45t` | depth shading in orbit view; `t` = 0 (far) … 1 (near). Size is a multiplier on the point-size slider. |
| `flySize(rBase, radius, rz)` / `flyAlpha(radius, rz)` | see `default.js` | apparent point size/opacity in fly mode at camera distance `rz` |

### Advanced hooks (all optional)

| Hook | Meaning |
|---|---|
| `render.drawAtom(ctx, x, y, r, t)` | draw the atom mark yourself (`fillStyle`/`globalAlpha` are already set); `t` is orbit depth 0 (far) … 1 (near), `null` in fly mode. Omit for the default circles. |
| `render.drawHalo(ctx, x, y, rBase)` | draw the click-selection halo yourself (set your own stroke). |
| `mount({body, plot})` / `unmount()` | called when the theme is switched in/out. Inject DOM (overlays, filters, rewritten text) in `mount`, undo it in `unmount`. Every injected node **must** carry `data-theme-owned` — the engine sweeps those on switch as a safety net. |

`themes/slab.js` uses all three.

## Notes

- Structure data files in `../structures/` are untouched by theming.
- The default theme follows the OS light/dark setting via `varsDark`;
  themes without `varsDark` stay pinned and should set `colorScheme`
  accordingly so form controls render in the right mode.
