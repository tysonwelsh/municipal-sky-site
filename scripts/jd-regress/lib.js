// lib.js — shared by capture.js and compare.js (scripts/jd-regress/).
// Dev-only: scripts/** is deploy-excluded. See README.md for the contract.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS_VERSION = 'jd-regress 1';

// ---------------------------------------------------------------------------
// module resolution — Playwright lives in a global node_modules, not the repo
function candidateDirs() {
  const dirs = [];
  if (process.env.NODE_PATH) dirs.push(...process.env.NODE_PATH.split(path.delimiter));
  dirs.push('/opt/node-tools/node_modules', '/node-tools/node_modules', '/usr/local/lib/node_modules_global');
  try { dirs.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch (e) {}
  return dirs.filter(Boolean);
}
function requireGlobal(name) {
  try { return require(name); } catch (e) { /* fall through */ }
  for (const d of candidateDirs()) {
    try { return require(require.resolve(name, { paths: [d] })); } catch (e) { /* next */ }
  }
  throw new Error(`cannot resolve '${name}' — set NODE_PATH=/opt/node-tools/node_modules (or wherever playwright is installed)`);
}
function playwrightPkgDir() {
  try { return path.dirname(require.resolve('playwright/package.json')); } catch (e) {}
  for (const d of candidateDirs()) {
    try { return path.dirname(require.resolve('playwright/package.json', { paths: [d] })); } catch (e) {}
  }
  return null;
}
// pngjs, as bundled inside playwright-core (no separate install needed).
// Returns null when unavailable — compare.js then falls back to byte equality.
function loadPNG() {
  const dir = playwrightPkgDir();
  const tries = [];
  if (dir) tries.push(() => require(require.resolve('playwright-core/lib/utilsBundle', { paths: [dir] })).PNG);
  tries.push(() => require('pngjs').PNG);
  for (const t of tries) { try { const P = t(); if (P && P.sync) return P; } catch (e) {} }
  return null;
}

// ---------------------------------------------------------------------------
// normalisation — the ONLY transformations applied before two captures are
// compared. Every rule here is listed in README.md ("Normalisations"); keep
// the two in step.
const ULID_RE = /(?<![0-9A-Za-z])[0-9A-HJKMNP-TV-Z]{26}(?![0-9A-Za-z])/g;
const VTOKEN_RE = /([?&]v=)[0-9a-f]{8}(?![0-9a-f])/g;
const TQUERY_RE = /([?&]t=)\d{10,}/g;
const ISO_RE = /\b\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?/g;
// id prefixes minted from a running counter (each mount takes the next
// number): the record/turn/about filmstrips (fsr12_, fst3_, fsp2_, fsi4_),
// the turn plates (jua0_ … jud3_), won items (juw0_) and the about page's
// card clones (rc3-). How many mounts happened before a capture is an
// implementation detail (and on /about/ a matter of timing), so each family
// is renumbered by first appearance within the file. Per-COPY prefixes
// (jp<i>_, jt<i>_, jr<i>_, jz<i>_, jto_ …) are deterministic and kept.
const SEQ_PFX_RE = /(?<![A-Za-z0-9])(fs[a-z]?|ju[a-d]|juw|rc)(\d+)([_-])(?=[A-Za-z0-9_-])/g;

// collect every ULID-shaped token in a string (used on the pristine payloads)
function collectUlids(text, set) {
  const m = String(text).match(ULID_RE);
  if (m) for (const u of m) set.add(u);
  return set;
}

// string-level rules shared by markup, styles, console and payload strings.
// `ctx` = { known: Set of pristine ULIDs, root: checkout path, ulidMap: Map }
// ulidMap is per ARTIFACT, so placeholders are numbered by first appearance
// inside that one file.
// `payload` mode applies only the ULID and checkout-path rules: a payload is
// kept byte-exact apart from those (and the keys normPayload blanks).
function normText(s, ctx, payload) {
  let out = String(s);
  if (!payload) {
    out = out.replace(VTOKEN_RE, '$1~v~');
    out = out.replace(TQUERY_RE, '$1~t~');
    out = out.replace(ISO_RE, '~iso-time~');
    const seen = new Map(), per = {};
    out = out.replace(SEQ_PFX_RE, (m, fam, n, sep) => {
      const key = fam + n + sep;
      if (!seen.has(key)) { per[fam] = (per[fam] || 0) + 1; seen.set(key, fam + '~' + per[fam] + '~' + sep); }
      return seen.get(key);
    });
  }
  if (ctx && ctx.root) out = out.split(ctx.root).join('<ROOT>');
  if (ctx && ctx.known) {
    out = out.replace(ULID_RE, (u) => {
      if (ctx.known.has(u)) return u;
      if (!ctx.ulidMap) ctx.ulidMap = new Map();
      if (!ctx.ulidMap.has(u)) ctx.ulidMap.set(u, '~ulid-' + (ctx.ulidMap.size + 1) + '~');
      return ctx.ulidMap.get(u);
    });
  }
  return out;
}

// payload rules (compare-time only — the raw body is what is stored)
function normPayload(name, raw, ctx) {
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { text: normText(raw, ctx, true), json: false, stamps: {} };
  }
  const stamps = {};
  // generated: the moment the payload was built
  if (data && typeof data === 'object' && !Array.isArray(data) && 'generated' in data) {
    stamps.generated = data.generated;
    data.generated = '~generated~';
  }
  // the tooling build stamp (api/jd-build.php): version + content hash + mtime.
  // It moves whenever a file in jd_build_files() is edited, so it is reported
  // separately (compare.js prints it as a note) instead of failing the run.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.build && typeof data.build === 'object') {
      stamps.build = { version: data.build.version, build: data.build.build, deployed: data.build.deployed };
      for (const k of ['version', 'build', 'deployed']) if (k in data.build) data.build[k] = '~' + k + '~';
    } else if (typeof data.build === 'string') {
      stamps.build = { version: data.version, build: data.build };
      data.build = '~build~';
      if ('version' in data) data.version = '~version~';
    }
  }
  const text = stableStringify(data, (s) => normText(s, ctx, true));
  return { text, json: true, stamps };
}

// deterministic JSON: sorted object keys, one property per line, strings
// passed through `mapStr` (normalisation). Arrays keep their order.
function stableStringify(v, mapStr, indent = '') {
  const pad = indent + ' ';
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'string') return JSON.stringify(mapStr ? mapStr(v) : v);
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '[\n' + v.map((x) => pad + stableStringify(x, mapStr, pad)).join(',\n') + '\n' + indent + ']';
  }
  const keys = Object.keys(v).sort();
  if (!keys.length) return '{}';
  return '{\n' + keys.map((k) => pad + JSON.stringify(mapStr ? mapStr(k) : k) + ': ' +
    stableStringify(v[k], mapStr, pad)).join(',\n') + '\n' + indent + '}';
}

// ---------------------------------------------------------------------------
// small fs helpers
function mkdirp(d) { fs.mkdirSync(d, { recursive: true }); }
function readJSON(f, dflt) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return dflt; }
}
function writeJSON(f, v) { mkdirp(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); }
function listFiles(dir) {
  const out = [];
  (function walk(d, rel) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else out.push(r);
    }
  })(dir, '');
  return out.sort();
}

module.exports = {
  HARNESS_VERSION, requireGlobal, loadPNG, playwrightPkgDir,
  ULID_RE, collectUlids, normText, normPayload, stableStringify,
  mkdirp, readJSON, writeJSON, listFiles,
};
