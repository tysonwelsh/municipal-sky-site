// KOLOB tools — rendering dump sets through the harness.
//
// An "engine" is where the modules come from:
//   (default)        this worktree's art/kolob
//   <dir>            any directory holding kolob-core.js (or kolob-audio.js,
//                    the single file of a build before 2026-09-26)
//   git:<ref>        a build out of git (`git archive` of art/kolob and the
//                    substrate's scripts), unpacked into out/_builds/<sha>/
// The harness that renders it is --harness, else the engine directory's own
// _harness.js, else this worktree's. The harness is pointed at the build with
// KOLOB_BASE and KOLOB_DIR alike (two names for one thing; a harness reads
// either); a single-file build is loaded with KOLOB_LEGACY. Nothing is ever
// written into an engine directory.
//
// A harness is not taken at its word. Each render runs with lib/witness.js
// preloaded, which writes down every engine file the harness actually read;
// verify() below refuses the set — before a single number is computed — when
// the harness played anything but the build it was pointed at: a module from
// another directory, a module of the build's list left unread, a stray module
// read, or bytes that changed mid-render. When the harness also says what it
// loaded (the dump header's `engine` field), its word must agree with the
// witness's.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const W = require("./witness.js");

const HERE_ENGINE = path.resolve(__dirname, "..", "..");            // art/kolob
const REPO = path.resolve(HERE_ENGINE, "..", "..");                  // the worktree
const OUT_ROOT = path.resolve(__dirname, "..", "out");
const WITNESS = path.join(__dirname, "witness.js");

function real(p) { try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); } }
function names2(a) { return a.length <= 4 ? a.join(", ") : a.slice(0, 3).join(", ") + " and " + (a.length - 3) + " more"; }
// An error that is the tools' judgement, not a crash: printed without a stack.
function refusal(msg) { const e = new Error(msg); e.refusal = true; return e; }

// The build's own list of what it plays, where it says so: _engine.php (the
// one list, since 2026-09-29), else index.php's $kolob_engine (the split
// builds between 2026-09-26 and 2026-09-29), else the single file (before
// 2026-09-26). Null when the build does not say.
function engineList(dir, legacy) {
  if (legacy) return { from: "the single file", files: [legacy] };
  const php = path.join(dir, "_engine.php");
  if (fs.existsSync(php)) {
    const src = fs.readFileSync(php, "utf8");
    const ret = src.slice(src.lastIndexOf("return ["));
    const files = [...ret.matchAll(/'([^']+\.js)'/g)].map((m) => path.resolve(dir, m[1]));
    if (files.length) return { from: "_engine.php", files };
  }
  const idx = path.join(dir, "index.php");
  if (fs.existsSync(idx)) {
    const m = /\$kolob_engine\s*=\s*\[([\s\S]*?)\];/.exec(fs.readFileSync(idx, "utf8"));
    const files = m ? [...m[1].matchAll(/'([^']+\.js)'/g)].map((x) => path.resolve(dir, x[1])) : [];
    if (files.length) return { from: "index.php", files };
  }
  return { from: null, files: null };
}

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
    label = shortPath(dir);
  }
  if (!fs.existsSync(path.join(dir, "kolob-core.js"))) {
    if (fs.existsSync(path.join(dir, "kolob-audio.js"))) legacy = path.join(dir, "kolob-audio.js");
    else throw refusal("no Kolob engine in " + dir + " (neither kolob-core.js nor kolob-audio.js)");
  }
  let harness = harnessOpt && harnessOpt !== true ? path.resolve(String(harnessOpt)) : null;
  if (!harness) harness = fs.existsSync(path.join(dir, "_harness.js")) && !git ? path.join(dir, "_harness.js") : path.join(HERE_ENGINE, "_harness.js");
  if (!fs.existsSync(harness)) throw refusal("no harness at " + harness + " (art/kolob/_harness.js is tracked since 2026-10-01: check it out, or pass --harness)");
  let version = null;
  try { version = fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim().split("\n")[0]; } catch (e) {}
  if (!git) { try { git = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) {} }
  const list = engineList(dir, legacy);
  const missing = list.files ? list.files.filter((f) => !fs.existsSync(f)) : [];
  if (missing.length) throw refusal("the build in " + dir + " lists " + missing.map((f) => path.relative(dir, f)).join(", ") + " (" + list.from + "), which it does not hold");
  return {
    dir, label, legacy, harness, version, git, list,
    // what the build's own list adds up to; the witness's record must come to the same
    fingerprint: list.files ? W.fingerprintPaths(list.files) : null,
  };
}

// Hold what the harness read (the witness) and what it said (the header)
// against the build it was pointed at. Returns the witnessed build, or throws.
function verify(engine, witnessFile, header, harness) {
  const why = [];
  let w = null;
  try { w = JSON.parse(fs.readFileSync(witnessFile, "utf8")); } catch (e) {}
  const H = shortPath(harness);
  if (!w || !w.files || !w.files.length) {
    throw refusal("could not see which engine " + H + " played: it read no kolob-*.js through fs.readFileSync. The tools will not measure an engine they cannot name.");
  }
  const dirR = real(engine.dir), subR = real(path.resolve(engine.dir, "..", "prosperos-jukebox-v2"));
  const astray = new Map();          // where the harness really read from → the files
  w.files.forEach((f) => {
    const sub = /^pj2-/.test(f.name), where = sub ? subR : dirR;
    const ok = sub ? path.dirname(f.path) === subR : engine.legacy ? f.path === real(engine.legacy) : path.dirname(f.path) === dirR;
    if (!ok) { const k = path.dirname(f.path) + "\u0000" + where; astray.set(k, (astray.get(k) || []).concat(f.name)); }
    if (f.changed) why.push(f.name + " changed while the harness was reading it");
  });
  astray.forEach((names, k) => { const [from, where] = k.split("\u0000"); why.push(names.length + " of the files it played (" + names2(names) + ") came from " + shortPath(from) + ", not from " + shortPath(where)); });
  if (engine.list.files) {
    const want = new Set(engine.list.files.map(real)), got = new Set(w.files.map((f) => f.path));
    const unread = [...want].filter((p) => !got.has(p));
    const stray = w.files.filter((f) => /^kolob-/.test(f.name) && !want.has(f.path) && path.dirname(f.path) === dirR);
    if (unread.length) why.push((unread.length === want.size ? "none of the " + want.size + " modules on the build's list (" + engine.list.from + ") was read from the build" : "the build's list (" + engine.list.from + ") has " + names2(unread.map((p) => path.basename(p))) + ", which the harness never read — its module list is not this build's"));
    if (stray.length) why.push("the harness read " + names2(stray.map((f) => f.name)) + ", which the build's list (" + engine.list.from + ") does not play");
    if (!unread.length && !stray.length && !why.length && engine.fingerprint && w.fingerprint !== engine.fingerprint) {
      // the same files, but not the same bytes (pj2 extras the list leaves out would land here too)
      const extras = w.files.filter((f) => !want.has(f.path)).map((f) => f.name);
      if (!extras.length) why.push("the harness read the build's files but not its bytes (fingerprint " + w.fingerprint + ", the build " + engine.fingerprint + ")");
    }
  }
  if (header && header.engine) {
    const said = header.engine;
    if (said.dir && real(said.dir) !== dirR) why.push("the harness says it loaded the engine in " + shortPath(said.dir));
    if (said.fingerprint && said.fingerprint !== w.fingerprint) why.push("the harness says fingerprint " + said.fingerprint + "; the witness saw " + w.fingerprint);
  }
  if (why.length) {
    throw refusal(H + " did not play the build it was pointed at (" + (engine.label === shortPath(engine.dir) ? engine.label : engine.label + ", " + shortPath(engine.dir)) + "):\n  - " + why.join("\n  - ") +
      "\n  A harness must load from KOLOB_BASE or KOLOB_DIR (the tools set both) and play the build's own list; pass --harness <file> to use one that does.");
  }
  return { fingerprint: w.fingerprint, files: w.files.map((f) => path.relative(dirR, f.path)), saidBy: header && header.engine ? "header and witness" : "witness" };
}

function runOne(engine, seed, secs, flags, dumpFile, name) {
  return new Promise((resolve) => {
    const witness = dumpFile.replace(/\.jsonl$/, ".witness.json");
    [dumpFile, witness].forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });   // never read a stale one
    const args = ["-r", WITNESS, engine.harness, String(secs), String(seed)].concat(flags || []).concat(["dump=" + dumpFile, "header"]);
    const env = Object.assign({}, process.env, { KOLOB_BASE: engine.dir, KOLOB_DIR: engine.dir, KOLOB_WITNESS: witness });
    if (engine.legacy) env.KOLOB_LEGACY = engine.legacy; else delete env.KOLOB_LEGACY;
    const p = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      const logFile = dumpFile.replace(/\.jsonl$/, ".log");
      fs.writeFileSync(logFile, out + (err ? "\n--- stderr ---\n" + err : ""));
      const verdict = (/VERDICT: (.*)/.exec(out) || [])[1] || null;
      const loadErr = /LOAD [^\n]*/.exec(out) || /FAIL: KolobAudio not defined[^\n]*/.exec(err);
      const ok = fs.existsSync(dumpFile);
      let header = null, loaded = null, verifyError = null;
      if (ok) { try { const first = fs.readFileSync(dumpFile, "utf8").split("\n", 1)[0]; if (first.startsWith('["H"')) header = JSON.parse(first)[2]; } catch (e) {} }
      if (ok && !loadErr) { try { loaded = verify(engine, witness, header, engine.harness); } catch (e) { verifyError = e.message; } }
      resolve({ seed, name: name || "seed-" + seed, dump: dumpFile, log: logFile, code, verdict, ok, loadError: loadErr ? loadErr[0] : null, verifyError, loaded });
    });
  });
}

// Render seeds → <dir>/seed-<n>.jsonl (+ .log, + .witness.json) and manifest.json.
async function renderSet(opts) {
  const engine = opts.engine;
  fs.mkdirSync(opts.dir, { recursive: true });
  const jobs = Math.max(1, opts.jobs || Math.min(8, Math.max(1, Math.floor(os.cpus().length / 2))));
  const todo = opts.seeds.map((s) => ({ seed: s, name: "seed-" + s }));
  (opts.extra || []).forEach((x) => todo.push(x));   // e.g. a twin for the self-test
  const results = [];
  let k = 0, stop = false;
  async function worker() {
    while (k < todo.length && !stop) {
      const job = todo[k++];
      const r = await runOne(engine, job.seed, opts.secs, opts.flags, path.join(opts.dir, job.name + ".jsonl"), job.name);
      results.push(r);
      if (!r.ok || r.loadError || r.verifyError) stop = true;   // the next seed would fail the same way
      if (!opts.quiet) process.stderr.write(".");
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker));
  if (!opts.quiet) process.stderr.write("\n");
  const failed = results.filter((r) => !r.ok || r.loadError || r.verifyError);
  if (failed.length) {
    const r = failed[0];
    const hint = r.loadError && engine.legacy ? " (a single-file build needs a harness that honours KOLOB_LEGACY)" : "";
    throw refusal("harness failed for " + r.name + (r.loadError ? " — " + r.loadError + hint : r.verifyError ? " — " + r.verifyError : " (no dump; see " + r.log + ")"));
  }
  // every seed must have played the same bytes
  const fps = [...new Set(results.map((r) => r.loaded.fingerprint))];
  if (fps.length > 1) throw refusal("the engine in " + engine.dir + " changed while it was being rendered (fingerprints " + fps.join(", ") + "); render again when it is still");
  const loaded = results[0].loaded;
  const manifest = {
    tool: "kolob-tools render", engine: engine.label, engineDir: engine.dir, legacy: !!engine.legacy,
    harness: engine.harness, version: engine.version, git: engine.git,
    fingerprint: loaded.fingerprint, list: engine.list.from, loaded: loaded.files, verifiedBy: loaded.saidBy,
    secs: opts.secs, flags: opts.flags || [], seeds: opts.seeds, created: new Date().toISOString(),
    verdicts: results.reduce((a, r) => { a[r.name] = r.verdict || null; return a; }, {}),
  };
  fs.writeFileSync(path.join(opts.dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { results: results.sort((a, b) => a.seed - b.seed), manifest };
}

function shortPath(p) {
  if (!p) return "?";
  const r = path.relative(REPO, p);
  return r && !r.startsWith("..") ? r : p;
}

// One line naming what was measured, for the head of every report.
function describe(manifest) {
  if (!manifest) return "(no manifest: dumps rendered elsewhere)";
  return "engine **" + manifest.engine + "**" + (manifest.version ? " (" + manifest.version.split(" — ")[0] + ")" : "") +
    (manifest.git ? " · git " + String(manifest.git).slice(0, 10) : "") + " · modules " + manifest.fingerprint +
    (manifest.legacy ? " (single-file " + path.basename((manifest.loaded || ["kolob-audio.js"])[0]) + (manifest.loaded ? ", witnessed" : "") + ")" :
      manifest.loaded ? " (" + manifest.loaded.length + " files" + (manifest.list ? ", the list in " + manifest.list : "") + ", witnessed)" : "") +
    " · " + manifest.secs + " s per seed" +
    (manifest.flags && manifest.flags.length ? " · flags " + manifest.flags.join(",") : "") +
    (manifest.harness ? " · harness `" + shortPath(manifest.harness) + "`" : "");
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
    if (!files.length) throw refusal("no *.jsonl dumps in " + dir);
    return { dir, manifest: readManifest(dir), files };
  }
  const engine = resolveEngine(o.engine, o.harness);
  const { results, manifest } = await renderSet({ engine, seeds: o.seeds, secs: o.secs, flags: o.flags, dir: o.into, jobs: o.jobs, extra: o.extra, quiet: o.quiet });
  return { dir: o.into, manifest, files: results.map((r) => r.dump) };
}

module.exports = { resolveEngine, engineList, verify, refusal, renderSet, runOne, describe, obtainSet, HERE_ENGINE, REPO, OUT_ROOT, WITNESS };
