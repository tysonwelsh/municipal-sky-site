// KOLOB tools — rendering dump sets through the harness.
//
// An "engine" is where the modules come from:
//   (default)        this worktree's art/kolob
//   <dir>            any directory holding kolob-core.js (or v0.30's kolob-audio.js)
//   git:<ref>        a build out of git (`git archive` of art/kolob and the
//                    substrate's scripts), unpacked into out/_builds/<sha>/
// The harness that renders it is --harness, else the engine directory's own
// _harness.js, else this worktree's. KOLOB_DIR points the harness at the
// modules; a single-file build (kolob-audio.js) is loaded with KOLOB_LEGACY.
// Nothing is ever written into an engine directory.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");

const HERE_ENGINE = path.resolve(__dirname, "..", "..");            // art/kolob
const REPO = path.resolve(HERE_ENGINE, "..", "..");                  // the worktree
const OUT_ROOT = path.resolve(__dirname, "..", "out");

function resolveEngine(spec, harnessOpt) {
  let dir, label, legacy = null, git = null;
  if (!spec || spec === true || spec === "." || spec === "worktree") { dir = HERE_ENGINE; label = "worktree"; }
  else if (String(spec).startsWith("git:")) {
    const ref = String(spec).slice(4);
    const sha = execFileSync("git", ["-C", REPO, "rev-parse", ref + "^{commit}"], { encoding: "utf8" }).trim();
    const root = path.join(OUT_ROOT, "_builds", sha.slice(0, 12));
    dir = path.join(root, "art", "kolob");
    if (!fs.existsSync(path.join(dir, "VERSION"))) {
      fs.mkdirSync(root, { recursive: true });
      // the modules and the substrate's scripts (not its rooms' impulse responses)
      const tar = execFileSync("git", ["-C", REPO, "archive", sha, "art/kolob", "art/prosperos-jukebox-v2/*.js"], { maxBuffer: 1 << 30 });
      execFileSync("tar", ["-x", "-C", root], { input: tar, maxBuffer: 1 << 30 });
    }
    label = ref; git = sha;
  } else {
    dir = path.resolve(String(spec));
    label = path.relative(process.cwd(), dir) || dir;
  }
  if (!fs.existsSync(path.join(dir, "kolob-core.js"))) {
    if (fs.existsSync(path.join(dir, "kolob-audio.js"))) legacy = path.join(dir, "kolob-audio.js");
    else throw new Error("no Kolob engine in " + dir + " (neither kolob-core.js nor kolob-audio.js)");
  }
  let harness = harnessOpt && harnessOpt !== true ? path.resolve(String(harnessOpt)) : null;
  if (!harness) harness = fs.existsSync(path.join(dir, "_harness.js")) && !git ? path.join(dir, "_harness.js") : path.join(HERE_ENGINE, "_harness.js");
  if (!fs.existsSync(harness)) throw new Error("no harness at " + harness + " (art/kolob/_harness.js is untracked: copy it in, or pass --harness)");
  let version = null;
  try { version = fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim().split("\n")[0]; } catch (e) {}
  if (!git) { try { git = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) {} }
  return { dir, label, legacy, harness, version, git, fingerprint: fingerprint(dir, legacy) };
}

// A short hash over the engine's modules, so a report says exactly which bytes it measured.
function fingerprint(dir, legacy) {
  const h = crypto.createHash("sha1");
  const files = legacy ? [legacy] : fs.readdirSync(dir).filter((f) => /^kolob-.*\.js$/.test(f)).sort().map((f) => path.join(dir, f));
  files.forEach((f) => { h.update(path.basename(f)); h.update(fs.readFileSync(f)); });
  return h.digest("hex").slice(0, 10);
}

function runOne(engine, seed, secs, flags, dumpFile, name) {
  return new Promise((resolve) => {
    const args = [engine.harness, String(secs), String(seed)].concat(flags || []).concat(["dump=" + dumpFile, "header"]);
    const env = Object.assign({}, process.env, { KOLOB_DIR: engine.dir });
    if (engine.legacy) env.KOLOB_LEGACY = engine.legacy; else delete env.KOLOB_LEGACY;
    const p = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      const logFile = dumpFile.replace(/\.jsonl$/, ".log");
      fs.writeFileSync(logFile, out + (err ? "\n--- stderr ---\n" + err : ""));
      const verdict = (/VERDICT: (.*)/.exec(out) || [])[1] || null;
      const loadErr = /LOAD [^\n]*/.exec(out);
      resolve({ seed, name: name || "seed-" + seed, dump: dumpFile, log: logFile, code, verdict, ok: fs.existsSync(dumpFile), loadError: loadErr ? loadErr[0] : null });
    });
  });
}

// Render seeds → <dir>/seed-<n>.jsonl (+ .log) and manifest.json.
async function renderSet(opts) {
  const engine = opts.engine;
  fs.mkdirSync(opts.dir, { recursive: true });
  const jobs = Math.max(1, opts.jobs || Math.min(8, Math.max(1, Math.floor(os.cpus().length / 2))));
  const todo = opts.seeds.map((s) => ({ seed: s, name: "seed-" + s }));
  (opts.extra || []).forEach((x) => todo.push(x));   // e.g. a twin for the self-test
  const results = [];
  let k = 0;
  async function worker() {
    while (k < todo.length) {
      const job = todo[k++];
      const file = path.join(opts.dir, job.name + ".jsonl");
      if (opts.reuse && fs.existsSync(file)) { results.push({ seed: job.seed, name: job.name, dump: file, ok: true, reused: true }); continue; }
      results.push(await runOne(engine, job.seed, opts.secs, opts.flags, file, job.name));
      if (!opts.quiet) process.stderr.write(".");
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker));
  if (!opts.quiet) process.stderr.write("\n");
  const failed = results.filter((r) => !r.ok || r.loadError);
  if (failed.length) {
    const r = failed[0];
    throw new Error("harness failed for " + r.name + (r.loadError ? " — " + r.loadError : " (no dump; see " + r.log + ")"));
  }
  const manifest = {
    tool: "kolob-tools render", engine: engine.label, engineDir: engine.dir, legacy: !!engine.legacy,
    harness: engine.harness, version: engine.version, git: engine.git, fingerprint: engine.fingerprint,
    secs: opts.secs, flags: opts.flags || [], seeds: opts.seeds, created: new Date().toISOString(),
    verdicts: results.reduce((a, r) => { a[r.name] = r.verdict || null; return a; }, {}),
  };
  fs.writeFileSync(path.join(opts.dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { results: results.sort((a, b) => a.seed - b.seed), manifest };
}

// One line naming what was measured, for the head of every report.
function describe(manifest) {
  if (!manifest) return "(no manifest: dumps rendered elsewhere)";
  return "engine **" + manifest.engine + "**" + (manifest.version ? " (" + manifest.version.split(" — ")[0] + ")" : "") +
    (manifest.git ? " · git " + String(manifest.git).slice(0, 10) : "") + " · modules " + manifest.fingerprint +
    (manifest.legacy ? " · single-file (legacy)" : "") + " · " + manifest.secs + " s per seed" +
    (manifest.flags && manifest.flags.length ? " · flags " + manifest.flags.join(",") : "");
}

// Either read a dump set someone already rendered (--dumps <dir>), or render
// one now into <into>. Returns { dir, manifest, files }.
async function obtainSet(o) {
  const { listDumps, readManifest } = require("./dump.js");
  if (o.dumps) {
    const dir = path.resolve(String(o.dumps));
    let files = listDumps(dir);
    if (o.seeds) {
      const want = new Set(o.seeds.map(Number));
      files = files.filter((f) => { const m = /(\d+)\.jsonl$/.exec(f); return m && want.has(+m[1]); });
    }
    if (!files.length) throw new Error("no *.jsonl dumps in " + dir);
    return { dir, manifest: readManifest(dir), files };
  }
  const engine = resolveEngine(o.engine, o.harness);
  const { results, manifest } = await renderSet({ engine, seeds: o.seeds, secs: o.secs, flags: o.flags, dir: o.into, jobs: o.jobs, extra: o.extra, quiet: o.quiet });
  return { dir: o.into, manifest, files: results.map((r) => r.dump) };
}

module.exports = { resolveEngine, renderSet, runOne, describe, obtainSet, HERE_ENGINE, REPO, OUT_ROOT };
