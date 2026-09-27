#!/usr/bin/env node
// KOLOB tools — render.js: seeds → a dump set (one harness dump per seed).
//
//   node tools/render.js [--seeds 1-20] [--secs 180] [--flags ives,razz]
//                        [--engine <dir>|git:<ref>] [--harness <file>] [--out <dir>]
//
// The other tools call this themselves; it is here on its own for a set you
// want to keep and read twice (distinctness and repetition over one render),
// or to hand a critic.
"use strict";
const U = require("./lib/util.js");
const R = require("./lib/run.js");

const HELP = `render.js — render seeds through the harness into a dump set
  --seeds  1-20 | 1847,5,9   (default 1-20)
  --secs   simulated seconds per seed (default 180)
  --flags  ives,razz,cumulative (harness switches; default none)
  --engine <dir> | git:<ref>  (default: this worktree)
  --harness <file>            (default: the engine's own _harness.js, else this worktree's)
  --out    <dir>              (default: tools/out/render-<stamp>)
  --jobs   parallel harness processes (default: half the cores, at most 8)`;

(async () => {
  const a = U.parseArgs(process.argv.slice(2), ["help"]);
  if (a.help) { console.log(HELP); return; }
  const seeds = U.parseSeeds(a.seeds, U.parseSeeds("1-20"));
  const dir = U.outDir(a, "render");
  const engine = R.resolveEngine(a.engine, a.harness);
  const t0 = Date.now();
  const { results, manifest } = await R.renderSet({
    engine, seeds, secs: +a.secs || 180, flags: U.parseList(a.flags, []), dir, jobs: +a.jobs || 0,
  });
  const pass = results.filter((r) => /PASS/.test(r.verdict || "")).length;
  console.log("rendered " + results.length + " seeds in " + ((Date.now() - t0) / 1000).toFixed(1) + " s → " + dir);
  console.log(R.describe(manifest).replace(/\*\*/g, ""));
  console.log("harness verdicts: " + pass + "/" + results.length + " PASS");
})().catch((e) => { console.error("render.js: " + e.message); process.exit(1); });
