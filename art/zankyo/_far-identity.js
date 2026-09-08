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

// THE WHOLE BUILD, straight out of git — never a file in the tree, so the gate
// cannot be fooled by a stale copy someone forgot to refresh.
//
// It used to be one file. ZK_ENGINE swapped zankyo-audio.js and zk-broadcast.js
// stayed the working tree's IN BOTH RUNS, so this compared two engines across
// one shared receiver — and §11's tuned signals, the planned hold, degreeHz and
// the tone tables are all receiver work that went through a gate structurally
// unable to see them. It is a BUILD identity gate now: every zankyo-audio.js
// and zk-*.js the page loads is taken from the base ref. The PJ2 substrate is
// not swapped, deliberately — it is frozen and never modified from ZANKYŌ, so
// both sides share it.
//
// The other half of the old blindness is NOT fixed here and must not be
// forgotten: _probe.js mocks fetch with a thenable that never settles, so the
// reel pool never loads and no signal ever fires under this gate. A receiver
// change that only shows when a broadcast is on the air still needs the
// harness, which serves a real manifest. This gate now sees the receiver's
// CODE; it still does not see the receiver's AIR.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zk-ident-"));
const baseDir = path.join(tmp, "base");
fs.mkdirSync(baseDir, { recursive: true });
const SWAPPED = [];
try {
  // ANCHORED AT THE REPO ROOT. `git show <ref>:art/zankyo/f` works from this
  // directory, but `git ls-tree <ref>:art/zankyo` does NOT — ls-tree applies
  // the cwd prefix to a tree-ish path, so from in here it resolves to
  // art/zankyo/art/zankyo and returns an empty list with exit code 0. An empty
  // list read as "no files" is exactly the silent-wrong-answer shape, so the
  // listing is taken from the top level where the path means what it says.
  const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"],
    { cwd: DIR, encoding: "utf8" }).trim();
  const listed = execFileSync("git", ["ls-tree", "--name-only", BASE_REF + ":art/zankyo"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 16 << 20 }).split("\n").map((x) => x.trim());
  const want = listed.filter((f) => /^(zankyo-audio|zk-[a-z0-9-]+)\.js$/.test(f));
  if (!want.length) throw new Error("no engine or zk-*.js at that ref");
  for (const f of want) {
    const src = execFileSync("git", ["show", BASE_REF + ":art/zankyo/" + f],
      { cwd: DIR, encoding: "utf8", maxBuffer: 64 << 20 });
    fs.writeFileSync(path.join(baseDir, f), src);
    SWAPPED.push(f);
  }
} catch (e) {
  console.error("could not read the base build at " + BASE_REF + ": " + e.message);
  process.exit(1);
}
const baseEngine = baseDir;

// One batch run of the critic's probe. ZK_SRCDIR swaps the whole ZANKYŌ script
// set underneath it, so the two runs differ in every file that differs between
// the base ref and the tree — and in nothing else.
function batch(dir) {
  const env = Object.assign({}, process.env);
  delete env.ZK_ENGINE;
  if (dir) env.ZK_SRCDIR = dir; else delete env.ZK_SRCDIR;
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

// Name the build being compared, and name what this gate can and cannot see.
// A reader who takes "18/18 identical" for a whole-build guarantee is the
// person this line exists for.
console.log("base " + BASE_REF + " — swapping " + SWAPPED.length + " file(s): " + SWAPPED.join(", "));
console.log("  (code only: _probe.js mocks fetch, so no reel loads and no signal fires under this gate —");
console.log("   a receiver change that only shows on the air still needs _harness.js, which serves a manifest)");
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
