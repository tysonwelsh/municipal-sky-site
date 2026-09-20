# SPEC — how a control is built

*The contract every file in `controls/` follows. Read this whole page before
building. The two reference builds are `controls/knob-chicken-head-bakelite.html`
(an input) and `controls/meter-weston-panel.html` (an output); copy their
structure exactly and put your own craft inside the element.*

## 1. One file, one control

`controls/<slug>.html` — a complete, standalone page. The slug is lowercase
kebab-case, `<type>-<source>` (`knob-tektronix-collet`, `vu-weston-862`,
`toggle-bat-guarded-red`). Nothing else is written anywhere for that control.

Inside the file, in this order:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chicken-head knob, brown Bakelite — CONTROLS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Orbitron:wght@500;700&family=Shippori+Mincho:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../stage.css">
<script type="application/json" id="sk-meta">
{ ...see §2... }
</script>
</head>
<body>
<header class="sk-head"></header>                 <!-- left empty: stage.js fills it from the meta -->
<div class="sk-stage-wrap">
  <main class="sk-stage" data-panel="bakelite-black">
    <sk-knob-chicken-head value="6.5" label="GAIN"></sk-knob-chicken-head>
    <sk-knob-chicken-head value="3" label="TONE" scale="0.8"></sk-knob-chicken-head>   <!-- optional: a second instance in another state/size -->
  </main>
</div>
<aside class="sk-bench"></aside>                  <!-- left empty: stage.js builds the bench -->
<section class="sk-notes">
  <h2>THE SOURCE</h2>
  <p>...two or three short paragraphs: what the real thing is, the tells you reproduced, what you left out...</p>
</section>
<script id="sk-element">
/* ==== <sk-knob-chicken-head> — the element, self-contained: paste this block into any page ==== */
(function () { ... customElements.define("sk-knob-chicken-head", ...); })();
</script>
<script src="../stage.js"></script>
</body>
</html>
```

Rules:
- **No external resources** except Google Fonts (`fonts.googleapis.com`) and
  the two shared files `../stage.css` and `../stage.js`. No CDN scripts, no
  images, no fetches. Everything visual is CSS, inline SVG, canvas, or text.
- **The element is the deliverable.** Everything the control needs — its CSS,
  its markup, its behaviour, its fonts' `font-family` fallbacks — lives inside
  the `<script id="sk-element">` block, in a shadow root. A host page that
  pastes that one block and writes `<sk-…>` gets the whole control. Do not
  rely on `stage.css` for anything inside the element.
- **stage.js is the harness, not part of the control.** It only talks to the
  element through `value` and events, like a host app would.
- **The page must be valid without JS layout hacks**: the stage is a flex
  row; place one to three instances of the element in it and nothing else
  (a `<div data-sk-ignore>` may hold small decoration such as a bracket or a
  legend that is part of the demo but not the element).

## 2. The meta block

```json
{
  "id": "knob-chicken-head-bakelite",
  "element": "sk-knob-chicken-head",
  "name": "Chicken-head knob, brown Bakelite",
  "kind": "input",
  "code": "A2",
  "type": "Chicken-head knob",
  "source": "The Daka-Ware pointer knob on a 1950s Fender tweed amp (also Hammond, Ampex)",
  "era": "1950s",
  "origin": "USA",
  "materials": ["bakelite", "brass"],
  "tags": ["amplifier", "audio", "wedge pointer", "set-screw"],
  "value": { "model": "range", "min": 1, "max": 10, "step": 0.1, "unit": "" },
  "attributes": ["value", "min", "max", "step", "label", "scale", "disabled"],
  "events": ["input", "change"],
  "size": { "w": 96, "h": 120 },
  "notes": "one sentence on what the demo shows"
}
```

- `id` = the file's slug. `element` = the custom element tag, always `sk-…`
  and unique across the library (put the source in it: `sk-knob-tek-collet`,
  not `sk-knob`).
- `kind`: `input` | `output` | `both`.
- `code` + `type`: from `PLAN.md`'s taxonomy. `source`: the specific machine
  or style from `PLAN-3-STYLES.md`, in one line. `era`: a decade or `pre-1900`.
- `value.model` is one of: `range` (number, min/max/step, unit) · `steps`
  (either numeric min/max/step or `options: [...]` strings) · `boolean` ·
  `momentary` (no value; emits `press` / `release` / `activate`) · `delta`
  (endless: value accumulates, events carry `delta`) · `digits` (integer) ·
  `text` (string) · `time` (seconds) · `bits` (`count`, array of booleans) ·
  `waveform` (`count`, array of numbers 0…1) · `xy` (`{x, y}` in 0…1).
- `size`: the element's natural size in CSS px at `scale="1"`.
- `demoWords` (optional, for text outputs): an array stage.js cycles through.

## 3. The element's contract

```js
class extends HTMLElement {
  static get observedAttributes() { return ["value", "min", "max", "step", "label", "scale", "disabled", ...]; }
  // property `value` (get/set) mirrors the attribute; setting it re-renders and does NOT emit events
  // property `scale` (number, default 1) — the element renders at scale × its natural size
  // for inputs: user changes dispatch
  //   new CustomEvent("input",  { bubbles: true, composed: true, detail: { value } })   during the gesture
  //   new CustomEvent("change", { bubbles: true, composed: true, detail: { value } })   when the gesture settles
  //   momentary: "press", "release", "activate";  delta: detail { value, delta }
  // optional: demo(t) → value   (a source-specific idle animation for outputs; return undefined if you animate yourself)
}
```

- **Attributes reflect.** `value="6.5"` in the markup is the initial state; the
  `value` property is authoritative afterwards; the element reflects it back
  to the attribute on change so the DOM inspector shows the truth.
- **Inputs must be usable four ways:** pointer drag (mouse *and* touch —
  `pointer` events, `setPointerCapture`, `touch-action: none` on the grab
  area), mouse wheel (with `preventDefault` only while the pointer is over the
  control and the control changes), keyboard (`tabindex="0"` on the host or a
  focusable part; arrows step, Shift+arrows step ×10, Home/End to the ends,
  Space/Enter for buttons and switches), and click (a switch toggles on
  click; a selector goes to the clicked position).
- **Rotary drag is vertical by default** (up = clockwise = more), with the
  angle-follow style allowed where the source demands (a big tuning dial). A
  knob does not spin past its end stops. Faders and sliders follow the pointer
  exactly along their axis.
- **Focus is visible.** Draw a focus ring in the shadow root on
  `:host(:focus-visible)` or on the focusable part — not the browser default
  square unless it suits.
- **Accessible name and role.** `role="slider"` with `aria-valuemin/max/now`
  and `aria-label` from the `label` attribute for ranges; `role="switch"` and
  `aria-checked` for toggles; `role="button"` for buttons; `role="meter"` or
  `role="img"` with `aria-label` for outputs. Legends and scales carry
  `aria-hidden` unless they are the label.
- **`disabled`** greys nothing out unrealistically: a real panel just does
  not respond. Set `aria-disabled` and ignore input.
- **Sizing:** render at the natural `size` at `scale="1"`. Prefer building
  the visual as inline SVG with a `viewBox`, or as CSS with every dimension
  in a `--u` unit, so `scale` is a single multiplier. `scale` must work in
  0.5…3 without anything falling apart. Do not use CSS `zoom`; use the
  multiplier or `transform` on a wrapper with the host sized to match.
- **Outputs update cheaply.** Setting `value` twice a frame must not
  re-create the DOM; move a transform, change a text node, set a CSS
  variable. Needle-type outputs should have *ballistics*: an eased approach
  (a VU meter's ~300 ms rise, a heavy Bourdon needle's overshoot), done with
  `requestAnimationFrame` or a CSS transition, and stopped when the element
  is disconnected (`disconnectedCallback` cancels timers and RAF).
- **No globals** except the `customElements.define`. Wrap in an IIFE. Do
  not define anything if the tag is already defined.
- **Defensive sizes:** everything is in CSS px; `font-size` inside the shadow
  root is set explicitly (never inherit the page's).
- **Typefaces:** legends use the era's face from Google Fonts where one is
  close — `"Share Tech Mono"`, `"Oswald"` (a DIN-like), `"Barlow"`,
  `"Archivo Narrow"`, `"Big Shoulders"`, `"Michroma"` / `"Orbitron"`
  (Eurostile-like), `"Josefin Sans"` (Futura-like), `"Courier Prime"`,
  `"Special Elite"` (typewriter), `"Rubik Mono One"`, `"Bebas Neue"`,
  `"Anton"`, `"Roboto Condensed"`, `"IBM Plex Mono"`, `"VT323"`,
  `"Press Start 2P"`, `"DSEG"` is not on Google Fonts — draw seven-segment
  digits as SVG paths instead. Always give a system fallback. Load the face
  in the page's `<link>` **and** name it in the shadow CSS with the fallback.

## 4. What "good" looks like

The owner's brief: *"skeuomorphic that would look good in the ZANKYŌ web,
but also a bunch of others."* The look bar is the live ZANKYŌ panel
(`../zankyo.css`, `.zk-knob`, `.zk-switch`, `.zk-roller`) and the mock-ups in
`../mockups/` — layered gradients, honest shadows, wear where hands go, the
cylinder-projection note at the top of `../mockups/volume-2-options.html`.

1. **One light, above-left.** Highlights top-left, shadows bottom-right,
   reflected light on the underside of round things. Recessed things get
   `inset` shadow; proud things get a drop shadow with a tight dark contact
   shadow *and* a soft ambient one.
2. **Material is specific.** Bakelite has depth and a soft swirl, not flat
   brown. Brushed aluminium has directional grain and a broad soft highlight.
   Chrome has a hard horizon line. Painted steel has a chip at a corner.
   Glass has a reflection that is *not* the same shape as the thing under it.
3. **Cylinders project.** Ribs, numerals and knurls on a wheel or drum are
   placed by angle and foreshortened (`x = R·sin θ`, width `∝ cos θ`), so they
   crowd toward the edges. A flat repeating gradient reads as a strip, not a
   wheel.
4. **Legends are set in the right face, at the right size, in the right
   process.** Silk-screen is crisp and slightly matte; engraving is filled
   and has a shadow edge; hot-stamp is metallic and thin; Dymo tape is white
   on black embossed with a shadow; a decal has a visible edge.
5. **Wear, sparingly and where hands go.** Grime around a knob (off-centre,
   from below-right), polish on a bat handle's tip, a scuff on the most-used
   key, the print worn on the loudest number. Not everywhere.
6. **Motion is physical.** A toggle snaps (a fast ease-out with a tiny
   overshoot); a needle has mass; a split-flap falls; a Nixie cross-fades with
   a ghost; a relay-driven lamp comes on instantly but an incandescent one
   warms up over ~120 ms and cools over ~250 ms.
7. **It reads at thumbnail size.** The gallery shows the control at roughly
   360 × 240 px. The silhouette and the material must survive that.

## 5. Verify before you finish

From the repo root:

```
node art/zankyo/controls/tools/snap.js <slug>       # screenshots + console check for one control
node art/zankyo/controls/tools/snap.js --all        # everything
```

It writes `shots/<slug>.png` (the embed view, 720 × 480 at 2×) and
`shots/<slug>.bench.png` (the full page), and prints any console error, any
missing element definition, and any zero-size control. **Open the PNG and look
at it** (the Read tool renders images). Iterate at least once on what you
see: the first render is never the best one. A control is done when the
screenshot would pass for the real thing at a glance, the console is clean,
and the keyboard drives it.

## 6. Don'ts

- Don't edit `stage.css`, `stage.js`, `index.php`, `tools/`, or any other
  control's file. Don't touch anything outside `art/zankyo/controls/`.
- Don't commit. The orchestrator commits.
- Don't use `zoom`, `filter: url()` to external files, `@import`, images, or
  anything network-bound beyond Google Fonts.
- Don't write a generic knob and call it a Tektronix. If the source is named,
  the specific tells listed for it in `PLAN-3-STYLES.md` must be there.
