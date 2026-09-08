// ============================================================================
// ZANKYŌ 逸脱 — THE COVERING SET (dev tool, not shipped)
//
// A jitter gate only tests the paths the seed actually executes. My REPRO and
// fault-tally runs used home seeds and a couple of favourites, and a home night
// runs NONE of the departure code — which is why a `ctx.currentTime` read
// inside farSay survived six commits with a green jitter gate. The critic
// found the same hole on their side: their 40-seed base exercises eight of the
// twenty-four departures and is silent about the other sixteen, including 撓,
// 螺, 弛, 鏡 and 逆.
//
// So the determinism and fault gates run on a set chosen to COVER the registry
// rather than on whatever seeds we happened to be arguing about. Six cover all
// twenty-four at far 0.95 (computed greedily by the critic, verified here).
//
// THE COVERAGE ASSERTION IS THE DURABLE HALF. Adding a departure to the
// registry without extending this list makes the gate FAIL by name, instead of
// silently reducing what the gate can see. That is the difference between a
// convention and a check.
//
//   node _cover.js            coverage + REPRO under jitter on each seed
//   node _cover.js --quick    coverage only (instant, no engine)
// ============================================================================
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path"), vm = require("vm");

const SEEDS = [16, 84, 89, 13, 1047, 1];
const FAR = 0.95;
const RUN = parseFloat(process.argv[2]) || 900;

const g = { console }; g.window = g; g.globalThis = g; vm.createContext(g);
for (const f of ["../prosperos-jukebox-v2/pj2-rand.js", "zk-far.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), g, { filename: f });
}
const ZK = g.ZK_FAR, PJ = g.PJ2;
const all = ZK.REGISTRY.map((r) => r.id), seen = {};
console.log("covering set at far " + FAR + ":");
for (const s of SEEDS) {
  const n = ZK.night(PJ.Rand.stream(s).fork("far"), FAR);
  console.log("  seed " + String(s).padEnd(5) + " " + n.ids.join(" "));
  n.ids.forEach((i) => (seen[i] = 1));
}
const missed = all.filter((i) => !seen[i]);
console.log("\n" + all.length + " departures in the registry, " + Object.keys(seen).length + " covered");
if (missed.length) {
  console.error("COVERAGE FAILED — never exercised: " + missed.join(" ") +
    "\n  Extend SEEDS in _cover.js until every id appears, or the determinism and fault gates are blind to these.");
  process.exit(1);
}
console.log("  every departure is exercised ✓");
if (process.argv.indexOf("--quick") >= 0) process.exit(0);

let bad = 0;
for (let i = 0; i < SEEDS.length; i++) {
  const s = SEEDS[i], j = 300 + i;
  let out = "";
  try {
    out = execFileSync(process.execPath,
      ["_probe.js", String(RUN), String(s), "--far", String(FAR), "--jitter", String(j), "--repro", "--quiet"],
      { cwd: __dirname, encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (e) { out = String((e.stdout || "") + (e.stderr || "")); }
  const ok = /IDENTICAL/.test(out);
  if (!ok) bad++;
  console.log("  seed " + String(s).padEnd(5) + " jitter " + j + "/" + (j + 1) + "  " + (ok ? "REPRO identical ✓" : "REPRO DIVERGED ✗"));
  if (!ok) console.log(out.split("\n").filter((l) => /divergence|signature/.test(l)).slice(0, 2).join("\n"));
}
console.log(bad ? "\nDETERMINISM FAILED on " + bad + " of " + SEEDS.length : "\nall " + SEEDS.length + " reproduce under timer jitter ✓");
process.exit(bad ? 1 : 0);
