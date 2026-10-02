// KOLOB tools — the witness: which engine did the harness actually play?
//
// A harness is told where the engine lives (KOLOB_BASE, KOLOB_DIR), but a
// harness may not listen — this one reads KOLOB_BASE and _engine.php; an
// older one (before 2026-09-29) reads its own directory whatever it is told
// — and a harness
// that plays its own engine while the tools believe it played another reports
// "nothing moved" when everything did. So the tools do not take its word.
// This file is preloaded into every harness they run (`node -r witness.js`);
// it stands by fs.readFileSync and writes down every engine file the harness
// reads (kolob-*.js, the substrate's pj2-*.js): where it lay, and a hash of
// its bytes. lib/run.js then holds that record against the build it meant.
//
// Loaded with KOLOB_WITNESS=<file> it watches and, as the process exits,
// writes <file>. Required without it (as lib/run.js does) it only lends the
// fingerprint, so both sides hash a build the same way.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENGINE_FILE = /^(kolob-[^/\\]*|pj2-[^/\\]*)\.js$/;

// A build's fingerprint: SHA-1 over its files in name order, each its name
// and then its bytes. The same bytes under the same names give the same ten
// hex digits wherever they lie.
function fingerprintOf(files) {
  const h = crypto.createHash("sha1");
  files.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .forEach((f) => { h.update(f.name); h.update(f.bytes); });
  return h.digest("hex").slice(0, 10);
}
function fingerprintPaths(paths) {
  return fingerprintOf(paths.map((p) => ({ name: path.basename(p), bytes: fs.readFileSync(p) })));
}

const OUT = process.env.KOLOB_WITNESS;
if (OUT) {
  const orig = fs.readFileSync;
  const seen = new Map();          // real path → { path, sha: Set, bytes }
  fs.readFileSync = function (file) {
    const res = orig.apply(this, arguments);
    try {
      const p = typeof file === "string" ? file : file instanceof URL ? require("url").fileURLToPath(file) : Buffer.isBuffer(file) ? file.toString() : null;
      if (p && ENGINE_FILE.test(path.basename(p))) {
        const real = fs.realpathSync(p);
        const bytes = orig.call(fs, real);
        const sha = crypto.createHash("sha1").update(bytes).digest("hex");
        const rec = seen.get(real) || { path: real, sha: new Set(), bytes };
        rec.sha.add(sha);
        seen.set(real, rec);
      }
    } catch (e) { /* a witness never breaks the run it watches */ }
    return res;
  };
  process.on("exit", () => {
    const files = [...seen.values()];
    try {
      fs.writeFileSync(OUT, JSON.stringify({
        witness: "kolob-tools", v: 1,
        files: files.map((f) => ({ path: f.path, name: path.basename(f.path), sha1: [...f.sha], changed: f.sha.size > 1 })),
        fingerprint: files.length ? fingerprintOf(files.map((f) => ({ name: path.basename(f.path), bytes: f.bytes }))) : null,
      }, null, 1) + "\n");
    } catch (e) { /* not written: lib/run.js refuses a render it cannot name */ }
  });
}

module.exports = { fingerprintOf, fingerprintPaths, ENGINE_FILE };
