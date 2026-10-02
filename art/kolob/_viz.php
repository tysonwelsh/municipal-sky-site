<?php
// ============================================================================
// KOLOB — _viz.php: the page's drawing, in the order it is loaded.
//
// THE PAGE'S LIST. The page's drawing (KolobViz: the staff, the wheel and the
// organ facade inside it) is six files, cut from one along its seams
// (PLAN-REFACTOR §3.5; THE SIX FILES, kolob-viz.js). index.php reads this list
// and prints their tags in this order — after the engine and kolob-text.js,
// before kolob-ui.js, each cache-busted by its own bytes — and its build
// fingerprint takes in every one ($kolob_assets), so the footer moves when any
// of them does:
//
//   $kolob_viz = require __DIR__ . '/_viz.php';
//
// kolob-viz.js comes last: it raises window.KolobViz over the other five,
// which lend what it and each other read onto KOLOB._viz, in the order they
// stand here (a value is taken at load from a file before the one taking it).
// The harness's staff= mode, tools/loadcheck.js and tools/lends.js read this
// same list. It is not the engine's (_engine.php): the harness, the labs and
// the hymnal's worker load the engine with no page to draw on; add a file of
// the page's drawing here and nowhere else.
// ============================================================================

return [
    'kolob-viz-atlas.js', 'kolob-viz-intake.js', 'kolob-viz-guests.js',
    'kolob-viz-hymnal.js', 'kolob-viz-wheel.js',
    'kolob-viz.js',
];
