// ============================================================================
// Prospero's Jukebox — THEME REGISTRY (single source of truth)
//
// One JS object per song with palette + type + canvas tokens organized by
// category. `applyJukeboxTheme(track)` flattens the active theme's tokens
// onto the .jukebox-frame element as CSS custom properties (and also sets
// per-tab vars for every track so the tabs can show in their own colors
// regardless of which track is selected).
//
// Adding a new song = one new entry. Adding a new visual dimension (e.g.,
// `motion`, `texture`, `line`) = one new category — every theme can opt in
// at its own pace.
//
// Naming convention for resulting CSS vars:
//   color.primary       → --color-primary
//   color.glowRgb       → --color-glow-rgb     (raw RGB triple, used in
//                                              rgba(var(--color-glow-rgb), N))
//   type.heading        → --type-heading
//   canvas.ribbonStroke → not flattened to CSS; read directly by canvas
//                         renderers via JUKEBOX_THEMES[track].canvas
//
// `canvas.*` lives in the same theme object as the CSS tokens so the spiral
// and constellation can never drift out of sync with the rest of the UI.
// ============================================================================

(function () {
  "use strict";

  var THEMES = {
    library: {
      name: "Prospero's Library",
      color: {
        // Main accent system — used everywhere from button text to slider
        // fills to canvas strokes.
        primary:        "#ffaa00",
        primaryBright:  "#ffcc66",
        primaryDim:     "#554422",
        glowRgb:        "255, 170, 0",
        // Text colors. `ink` = body, `inkDim` = secondary, `inkLabel` =
        // small caps section labels.
        ink:            "#bb9966",
        inkDim:         "#776644",
        inkLabel:       "#997733",
        // Surfaces — panel backgrounds + borders + faint themed tints.
        surface:        "#0d0d14",
        surfaceBorder:  "#1a1a2a",
        surfaceTint:    "#1a1820",
        // Tab "off" state. Each tab also reads sibling tracks' vars (set
        // below) so the three tabs are multi-colored at once.
        tabIdle:        "#553a18",
        tabHover:       "#cc8800",
        // Genuinely non-themed gray for off-state indicator dots (switch
        // thumbs when unchecked, etc.). Same on every theme.
        neutralOff:     "#3a3a4a",
      },
      type: {
        heading:        "'Cinzel Decorative', serif",
        body:           "'VT323', monospace",
      },
      // Canvas palette consumed by the spiral + constellation viz IIFEs.
      // Numeric values stay as JS arrays / RGB strings so canvas code can
      // build its own rgba() strings without parsing.
      canvas: {
        bg:             "#0a0805",
        ribbonStroke:   [255, 220, 130],
        ribbonFill:     [255, 170, 0],
        baseStroke:     [180, 130, 60],
        inKeyLabel:     [255, 220, 140],
        outKeyLabel:    [120, 95, 50],
        octaveLabel:    [255, 200, 120],
        constFg:        "255, 170, 0",
        constSub:       "255, 130, 40",
        lollipopHead:   "rgba(255, 220, 130, 1)",
      },
    },

    sycorax: {
      name: "Sycorax's Spell",
      color: {
        primary:        "#c896ff",
        primaryBright:  "#d8b8ff",
        primaryDim:     "#4a3d62",
        glowRgb:        "200, 150, 255",
        ink:            "#b0a0d8",
        inkDim:         "#6a5980",
        inkLabel:       "#7c6ec1",
        surface:        "#0d0d14",
        surfaceBorder:  "#1a1a2a",
        surfaceTint:    "#1f1a30",
        tabIdle:        "#3a3055",
        tabHover:       "#9b87d8",
        neutralOff:     "#3a3a4a",
      },
      type: {
        heading:        "'Cinzel Decorative', serif",
        body:           "'VT323', monospace",
      },
      canvas: {
        bg:             "#08070f",
        ribbonStroke:   [220, 200, 255],
        ribbonFill:     [200, 150, 255],
        baseStroke:     [140, 100, 200],
        inKeyLabel:     [220, 200, 255],
        outKeyLabel:    [95, 80, 130],
        octaveLabel:    [200, 170, 240],
        constFg:        "196, 181, 253",
        constSub:       "155, 135, 216",
        lollipopHead:   "rgba(220, 200, 255, 1)",
      },
    },

    ariel: {
      name: "Ariel's Day Off",
      color: {
        primary:        "#55ccff",
        primaryBright:  "#99e0ff",
        primaryDim:     "#2e556a",
        glowRgb:        "150, 220, 255",
        ink:            "#99c8de",
        inkDim:         "#4a7a8c",
        inkLabel:       "#66a6c4",
        surface:        "#0d0d14",
        surfaceBorder:  "#1a1a2a",
        surfaceTint:    "#102530",
        tabIdle:        "#224a5c",
        tabHover:       "#66bbe0",
        neutralOff:     "#3a3a4a",
      },
      type: {
        heading:        "'Cinzel Decorative', serif",
        body:           "'VT323', monospace",
      },
      canvas: {
        bg:             "#06090e",
        ribbonStroke:   [216, 240, 255],
        ribbonFill:     [150, 220, 255],
        baseStroke:     [100, 160, 200],
        inKeyLabel:     [216, 240, 255],
        outKeyLabel:    [85, 110, 130],
        octaveLabel:    [170, 220, 240],
        constFg:        "150, 220, 255",
        constSub:       "100, 200, 220",
        lollipopHead:   "rgba(216, 240, 255, 1)",
      },
    },
  };

  // camelCase → kebab-case for CSS variable names.
  function kebab(s) {
    return s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }

  // Flatten one category onto an element. `prefix` becomes the CSS var
  // namespace ("color" → "--color-foo").
  function setCategory(el, prefix, dict) {
    Object.keys(dict).forEach(function (k) {
      var val = dict[k];
      // Only string/number values become CSS vars; arrays/objects belong
      // to the canvas-palette branch and are read directly from JS.
      if (typeof val === "string" || typeof val === "number") {
        el.style.setProperty("--" + prefix + "-" + kebab(k), val);
      }
    });
  }

  // Public: apply a track's theme. Sets CSS vars on every .jukebox-frame
  // and .jukebox-scene under document. Also sets per-tab vars for ALL
  // tracks so the tabs can stay multi-colored regardless of selection.
  function applyJukeboxTheme(track) {
    var theme = THEMES[track] || THEMES.library;
    var frames = document.querySelectorAll(".jukebox-frame, .jukebox-scene");
    frames.forEach(function (frame) {
      setCategory(frame, "color", theme.color);
      setCategory(frame, "type",  theme.type);

      // Per-tab vars: every tab gets its own primary + idle so the row
      // is always multi-colored.
      Object.keys(THEMES).forEach(function (tk) {
        var c = THEMES[tk].color;
        frame.style.setProperty("--tab-" + tk + "-primary", c.primary);
        frame.style.setProperty("--tab-" + tk + "-idle",    c.tabIdle);
        frame.style.setProperty("--tab-" + tk + "-hover",   c.tabHover);
        frame.style.setProperty("--tab-" + tk + "-glow",    c.glowRgb);
      });

      // --- Back-compat aliases ----------------------------------------
      // The existing CSS already uses --accent / --accent-bright /
      // --accent-dim / --accent-glow / --neutral-off from an earlier
      // partial migration. Keep those names alive so unmigrated rules
      // don't break, but treat them as deprecated — new rules should
      // use --color-primary / --color-primary-bright / etc.
      frame.style.setProperty("--accent",        theme.color.primary);
      frame.style.setProperty("--accent-bright", theme.color.primaryBright);
      frame.style.setProperty("--accent-dim",    theme.color.primaryDim);
      frame.style.setProperty("--accent-glow",   theme.color.glowRgb);
      frame.style.setProperty("--neutral-off",   theme.color.neutralOff);
    });
  }

  // Expose to other modules (UI controller, viz IIFEs).
  window.JUKEBOX_THEMES = THEMES;
  window.applyJukeboxTheme = applyJukeboxTheme;
})();
