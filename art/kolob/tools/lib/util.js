// KOLOB tools — small shared helpers: arguments, statistics, markdown.
// Dev-only (Node, no packages). Nothing here knows about the engine.
"use strict";
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Arguments: `--key value`, `--key=value`, `--flag`; the rest are positional.
// ---------------------------------------------------------------------------
function parseArgs(argv, booleans) {
  const out = { _: [] };
  const isBool = new Set(booleans || []);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const k = a.slice(2);
      if (isBool.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith("--")) out[k] = true;
      else out[k] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

// "1-20", "1847,5,9", "3107" → [numbers]. A bare count is NOT a range: use 1-n.
function parseSeeds(spec, dflt) {
  if (spec == null || spec === true) return dflt.slice();
  const out = [];
  String(spec).split(",").forEach((part) => {
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(part);
    if (m) { for (let s = +m[1]; s <= +m[2]; s++) out.push(s); }
    else if (part.trim()) out.push(parseInt(part, 10) >>> 0);
  });
  return out;
}
function parseList(spec, dflt, fn) {
  const src = spec == null || spec === true ? dflt.map(String) : String(spec).split(",");
  return src.map((s) => s.trim()).filter(Boolean).map(fn || ((x) => x));
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
// Reports land in tools/out/ (gitignored) unless --out says otherwise.
function outDir(args, name) {
  const dir = args.out ? path.resolve(String(args.out)) : path.join(__dirname, "..", "out", name + "-" + stamp());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
function sorted(a) { return a.slice().sort((x, y) => x - y); }
function quantile(a, p) {
  if (!a.length) return null;
  const s = sorted(a);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function median(a) { return quantile(a, 0.5); }
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}
function sum(a) { return a.reduce((x, y) => x + y, 0); }
// mulberry32 — the tools' own die, so a bootstrap is the same every run
function prng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Standard error of stat(items) by resampling the items (meetings, seeds).
function bootstrapSE(items, stat, reps, seed) {
  if (items.length < 2) return null;
  const r = prng(seed || 1), vals = [];
  for (let k = 0; k < (reps || 300); k++) {
    const s = [];
    for (let i = 0; i < items.length; i++) s.push(items[Math.floor(r() * items.length)]);
    const v = stat(s);
    if (v != null && isFinite(v)) vals.push(v);
  }
  return vals.length > 1 ? sd(vals) : null;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------
function fmt(x, d) {
  if (x == null || (typeof x === "number" && !isFinite(x))) return "—";
  if (typeof x !== "number") return String(x);
  return x.toFixed(d == null ? 2 : d);
}
function pct(x, d) { return x == null || !isFinite(x) ? "—" : (100 * x).toFixed(d == null ? 0 : d) + " %"; }
function esc(s) { return String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\n/g, " "); }
function table(header, rows, align) {
  const a = align || header.map((_, i) => (i === 0 ? "l" : "r"));
  const line = (cells) => "| " + cells.map(esc).join(" | ") + " |";
  const sep = "|" + a.map((x) => (x === "r" ? "---:" : x === "c" ? ":---:" : ":---")).join("|") + "|";
  return [line(header), sep].concat(rows.map(line)).join("\n");
}

module.exports = {
  parseArgs, parseSeeds, parseList, stamp, outDir,
  sorted, quantile, median, mean, sd, sum, prng, bootstrapSE,
  fmt, pct, table,
};
