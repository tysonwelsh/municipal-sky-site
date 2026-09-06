// ============================================================================
// ZANKYŌ 逸脱 — the home-identity gate (dev tool, not shipped to users' ears).
//
// The far tail's first promise is that four nights in five are the engine as
// it shipped, note for note. This is the instrument that proves it, and it is
// meant to be run on EVERY commit of the far branch, not just at the phase
// gates: it runs the critic's probe twice over the same seeds — once against
// the working tree, once against the engine at a base ref (default `main`) —
// and compares the per-seed note and event signatures.
//
// A HOME night (d < ZK_FAR.D_HOME) must match on BOTH streams. A departed
// night is expected to differ, and the report says by how much rather than
// waving it through: at W0 the only difference is the single 逸脱 line the
// VFD gains, so a departed night differs by exactly one event and zero notes.
// From W1 the note streams of departed nights diverge too, and that is the
// point — the gate is only ever about the home ones.
//
// Usage: node _far-identity.js [seconds] [nseeds] [baseRef]
//   node _far-identity.js                  → 1800 s × 20 seeds vs main
//   node _far-identity.js 600 8            → a quick pass while iterating
//   node _far-identity.js 1800 40 16ef2fb  → against an explicit commit
//
// Exit 0 = every home night identical. Exit 1 = the gate failed.
// ============================================================================
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RUN = parseFloat(process.argv[2] || "1800") || 1800;
const NSEEDS = parseInt(process.argv[3] || "20", 10) || 20;
const BASE_REF = process.argv[4] || "main";
const DIR = __dirname;

// The base engine, straight out of git — never a file in the tree, so the
// gate cannot be fooled by a stale copy someone forgot to refresh.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zk-ident-"));
const baseEngine = path.join(tmp, "base-engine.js");
try {
  const src = execFileSync("git", ["show", BASE_REF + ":art/zankyo/zankyo-audio.js"],
    { cwd: DIR, encoding: "utf8", maxBuffer: 64 << 20 });
  fs.writeFileSync(baseEngine, src);
} catch (e) {
  console.error("could not read the base engine at " + BASE_REF + ": " + e.message);
  process.exit(1);
}

// One batch run of the critic's probe. ZK_ENGINE swaps the engine underneath
// it; zk-far.js still loads either way (the base engine simply never asks it
// anything), so the two runs differ in exactly one file.
function batch(engine) {
  const env = Object.assign({}, process.env);
  if (engine) env.ZK_ENGINE = engine; else delete env.ZK_ENGINE;
  const out = execFileSync(process.execPath,
    ["_probe.js", "batch", String(RUN), "--nseeds", String(NSEEDS), "--out", fs.mkdtempSync(path.join(tmp, "b-"))],
    { cwd: DIR, encoding: "utf8", env: env, maxBuffer: 256 << 20 });
  const rows = {};
  for (const line of out.split("\n")) {
    // "seed    D  …components…   d 0.05 home · <notes>/<events> (n/m)"
    const m = line.match(/^(\d+)\s.*?(?:d (\d\.\d+) (\S[^·]*?)\s*)?·\s*([0-9a-f]+)\/([0-9a-f]+)\s+\((\d+)\/(\d+)\)\s*$/);
    if (m) rows[m[1]] = { d: m[2] != null ? parseFloat(m[2]) : null, band: (m[3] || "").trim(),
      notes: m[4], events: m[5], nNotes: +m[6], nEvents: +m[7] };
  }
  return rows;
}

process.stdout.write("running " + NSEEDS + " seeds × " + RUN + " s against the working tree… ");
const cur = batch(null);
process.stdout.write("and against " + BASE_REF + "… ");
const base = batch(baseEngine);
console.log("done\n");

const seeds = Object.keys(cur);
let homeOk = 0, homeBad = [], departed = [];
for (const s of seeds) {
  const a = cur[s], b = base[s];
  if (!b) { homeBad.push(s + ": missing from the base run"); continue; }
  // The band word is the engine's own verdict; d is printed to two decimals,
  // so a night at 0.1499 reads "0.15" and a d-only test would call it departed.
  const home = a.band ? /home/.test(a.band) : (a.d != null && a.d < 0.15);
  const sameNotes = a.notes === b.notes, sameEvents = a.events === b.events;
  if (home) {
    if (sameNotes && sameEvents) homeOk++;
    else homeBad.push(s + " (d " + (a.d != null ? a.d.toFixed(2) : "?") + "): " +
      (sameNotes ? "" : "notes " + a.notes + " vs " + b.notes + " ") +
      (sameEvents ? "" : "events " + a.events + " vs " + b.events +
        " (" + a.nEvents + " vs " + b.nEvents + ")"));
  } else {
    departed.push("  seed " + s + "  d " + (a.d != null ? a.d.toFixed(2) : "?") + " " + a.band +
      " · notes " + (sameNotes ? "identical" : "differ") +
      " · events " + (sameEvents ? "identical" : (a.nEvents - b.nEvents >= 0 ? "+" : "") + (a.nEvents - b.nEvents)));
  }
}

if (departed.length) { console.log("departed nights (differences here are the point):"); console.log(departed.join("\n")); console.log(""); }
console.log("HOME IDENTITY: " + homeOk + "/" + (homeOk + homeBad.length) + " home nights byte-identical to " + BASE_REF +
  (homeBad.length ? " ✗" : " ✓") + "   (" + departed.length + " of " + seeds.length + " seeds departed)");
if (homeBad.length) { console.log("failures:"); homeBad.forEach((l) => console.log("  " + l)); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
process.exit(homeBad.length ? 1 : 0);
