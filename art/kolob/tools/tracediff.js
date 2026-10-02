#!/usr/bin/env node
// KOLOB tools — tracediff.js: what two builds of the page draw, call by call.
//
// The harness's staff= (THE STAFF, _harness.js) plays the page's drawing
// along with a headless meeting on canvases that record every call
// (tools/lib/canvas.js), and its digest says whether two builds drew the same
// page — every call, every argument, every frame. A change that is meant to
// draw the same pixels by other calls (a gradient made once instead of every
// frame; a drawing kept on a canvas of its own and laid down whole) changes
// the digest by design; this says how. With KOLOB_STAFF_TRACE the harness
// writes the calls themselves, frame by frame; this reads two such traces
// and holds them against each other a frame at a time: frames whose calls
// are the same line for line, and for the rest, the calls one side made and
// the other did not (a shortest edit), grouped by kind, so the difference
// reads as a list ("−createLinearGradient ×1, −addColorStop ×2 a layer, every
// frame") whose every other call agrees to the last digit of its arguments.
//
//   node tools/tracediff.js <a.gz> <b.gz> [--inline <canvas>] [--show 12]
//   node tools/tracediff.js --a git:HEAD --b worktree [--seed 22] [--secs 300]
//                           [--width 860] [--inline <canvas>] [--out <dir>]
//     (the second form renders both traces first: this worktree's harness,
//     each build's own page — git:<ref> unpacked as tools/lib/run.js does,
//     or a directory holding kolob-core.js — KOLOB_DIR pointed at it)
//
// The traces name canvases, paths and gradients in the order they were
// made, which a canvas added on one side shifts; so the names are read
// again before the compare: a canvas by its first size and its place among
// the canvases first sized so (C1374x400#1: the second canvas made
// 1374 × 400), a path by its place among the paths, a gradient as G (it is
// told by its stops, written beside it). --inline <canvas> takes a canvas of
// B's that is laid down whole (a cache) at its word: each drawImage of it is
// read as the calls drawn on it since it was last cleared, on the canvas it
// is laid on, and its own calls leave the compare — so a frame that laid an
// out-of-date drawing shows as one whose calls differ.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const { spawnSync } = require("child_process");
const U = require("./lib/util.js");
const R = require("./lib/run.js");

const HELP = `tracediff.js — two builds of the page's drawing, call by call, frame by frame
  <a.gz> <b.gz>       two traces (KOLOB_STAFF_TRACE=<file> node _harness.js <secs> <seed> staff[=390])
  --a <spec> --b <spec>   or render them: spec = git:<ref> | an engine directory | worktree
  --seed 22 --secs 300 --width 860   the meeting and the plate the traces are rendered at
  --inline <canvas>   a canvas of B's laid down whole: read its drawImage as the calls drawn on it
  --show 12           edit lines shown in full for each kind of difference (default 12)
  --out <dir>         where rendered traces go (default tools/out/tracediff-<stamp>)`;

// ---- names -----------------------------------------------------------------
function namer() {
  const canv = new Map(), sized = new Map(), wpend = new Map(), paths = new Map();
  let unsized = 0;
  function canvas(id) {
    if (!canv.has(id)) canv.set(id, "C~" + ++unsized);   // (seen before it was sized)
    return canv.get(id);
  }
  return function (line) {
    let m = /^C(\d+)\.=(width|height)\((\d+(?:\.\d+)?)\)$/.exec(line);
    if (m) {
      const id = "C" + m[1];
      if (!canv.has(id)) {
        if (m[2] === "width") wpend.set(id, m[3]);
        else if (wpend.has(id)) {
          const key = wpend.get(id) + "x" + m[3], k = sized.get(key) || 0;
          sized.set(key, k + 1);
          canv.set(id, "C" + key + "#" + k);
          wpend.delete(id);
        }
      }
    }
    m = /^(P\d+)\.new\(/.exec(line);
    if (m && !paths.has(m[1])) paths.set(m[1], "P#" + paths.size);
    return line.replace(/(^|[(,[.])([CPG])(\d+)(?=[./,)\]]|$)/g, (all, pre, k, n) => {
      const id = k + n;
      if (k === "G") return pre + "G";
      if (k === "P") return pre + (paths.get(id) || "P~" + n);
      if (wpend.has(id) && !canv.has(id)) return pre + id;        // (between its width and its height)
      return pre + canvas(id);
    });
  };
}
// a call's kind: who and what, without the arguments
function kindOf(line) { const m = /^([^(]*)\(/.exec(line); return m ? m[1] : line; }

// ---- a trace, a frame at a time -----------------------------------------------
function frames(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const it = rl[Symbol.asyncIterator](), name = namer();
  let pending = null, done = false, n = 0;
  return async function next() {
    if (done) return null;
    const lines = [], label = pending == null ? "(before the first frame)" : pending;
    for (;;) {
      const r = await it.next();
      if (r.done) { done = true; break; }
      if (r.value.charCodeAt(0) === 35) { pending = r.value.slice(1); if (lines.length || n) break; continue; }   // '#': a frame's mark
      lines.push(name(r.value));
    }
    n++;
    return { label, lines };
  };
}

// B's canvases laid down whole (--inline): what each holds since it was
// last cleared, and its drawImage read as those calls
function inliner(names) {
  const held = new Map();
  if (!names.length) return (lines) => lines;
  return function (lines) {
    const out = [];
    for (const line of lines) {
      const who = kindOf(line).split(".")[0], cv = who.replace(/\/2d$/, "");
      if (names.includes(cv)) {
        if (/\.=(width|height)\(/.test(line) || /\.clearRect\(/.test(line)) held.set(cv, []);
        else if (who.endsWith("/2d")) (held.get(cv) || held.set(cv, []).get(cv)).push(line);
        continue;
      }
      const m = /^([^.]+\/2d)\.drawImage\(([^,)]+)[,)]/.exec(line);
      if (m && names.includes(m[2])) {
        (held.get(m[2]) || []).forEach((l) => out.push(m[1] + l.slice(l.indexOf("/2d") + 3)));
        continue;
      }
      out.push(line);
    }
    return out;
  };
}

// ---- the shortest edit (Myers), after the common head and tail ----------------
function edits(a, b, maxD) {
  let h = 0, ta = a.length, tb = b.length;
  while (h < ta && h < tb && a[h] === b[h]) h++;
  while (ta > h && tb > h && a[ta - 1] === b[tb - 1]) { ta--; tb--; }
  const A = a.slice(h, ta), B = b.slice(h, tb), n = A.length, m = B.length;
  if (!n) return B.map((l) => ["+", l]);
  if (!m) return A.map((l) => ["-", l]);
  const off = n + m + 1, v = new Int32Array(2 * off + 2), trail = [];
  for (let d = 0; d <= Math.min(n + m, maxD); d++) {
    trail.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1, y = x - k;
      while (x < n && y < m && A[x] === B[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return back(trail, d, x, y, A, B);
    }
  }
  return null;                                   // more than maxD edits
}
// (the path back from the end: each step one call taken out of A or put in from B)
function back(trail, d, x, y, A, B) {
  const out = [];
  for (let dd = d; dd > 0; dd--) {
    const w = trail[dd], at = (kk) => w[kk + dd + 1], kk = x - y;
    const down = kk === -dd || (kk !== dd && at(kk - 1) < at(kk + 1)), pk = down ? kk + 1 : kk - 1;
    const px = at(pk), py = px - pk;
    while (x > px + (down ? 0 : 1) && y > py + (down ? 1 : 0)) { x--; y--; }
    if (down) { y--; out.push(["+", B[y]]); } else { x--; out.push(["-", A[x]]); }
  }
  return out.reverse();
}

async function compare(fa, fb, opts) {
  const na = frames(fa), nb = frames(fb), inl = inliner(opts.inline || []);
  const sigs = new Map(), totals = new Map();
  let same = 0, differ = 0, wide = 0, nA = 0, nB = 0, linesA = 0, linesB = 0;
  for (let i = 0; ; i++) {
    const [A, B0] = await Promise.all([na(), nb()]);
    if (!A && !B0) break;
    if (A) nA++;
    if (B0) nB++;
    const a = A ? A.lines : [], b = B0 ? inl(B0.lines) : [];
    linesA += a.length; linesB += b.length;
    if (a.length === b.length && a.every((l, j) => l === b[j])) { same++; continue; }
    differ++;
    const e = edits(a, b, opts.maxD || 4000);
    if (!e) { wide++; continue; }
    const count = new Map();
    e.forEach(([op, l]) => { const k = op + " " + kindOf(l); count.set(k, (count.get(k) || 0) + 1); totals.set(k, (totals.get(k) || 0) + 1); });
    const sig = [...count.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, c]) => k + " ×" + c).join(" · ");
    const s = sigs.get(sig) || sigs.set(sig, { frames: 0, first: (A || B0).label, example: e }).get(sig);
    s.frames++;
  }
  return { nA, nB, same, differ, wide, linesA, linesB, sigs, totals };
}

function report(r, opts) {
  const L = [];
  L.push("frames: A " + r.nA + ", B " + r.nB + " · the same, call for call: " + r.same + " · differing: " + r.differ + (r.wide ? " (" + r.wide + " by more than " + (opts.maxD || 4000) + " calls: not itemised)" : ""));
  L.push("calls: A " + r.linesA + ", B " + r.linesB + (opts.inline && opts.inline.length ? " (B's " + opts.inline.join(", ") + " read inline)" : ""));
  if (r.totals.size) {
    L.push("");
    L.push("the calls one side made and the other did not, in all (− A only, + B only):");
    [...r.totals.entries()].sort((x, y) => y[1] - x[1]).forEach(([k, c]) => L.push("  " + k + " ×" + c));
    L.push("");
    L.push("the differing frames, by what differs (frames · the first · per frame):");
    [...r.sigs.entries()].sort((x, y) => y[1].frames - x[1].frames).forEach(([sig, s]) => {
      L.push("  " + s.frames + " frame(s), the first " + s.first + ": " + sig);
      s.example.slice(0, opts.show).forEach(([op, l]) => L.push("      " + op + " " + l));
      if (s.example.length > opts.show) L.push("      … " + (s.example.length - opts.show) + " more");
    });
  }
  return L.join("\n");
}

function render(spec, o, side) {
  let dir;
  if (spec === "worktree" || spec === true) dir = R.HERE_ENGINE;
  else dir = R.resolveEngine(spec).dir;
  const file = path.join(o.out, side + ".trace.gz");
  const args = [path.join(R.HERE_ENGINE, "_harness.js"), String(o.secs), String(o.seed), o.width === 860 ? "staff" : "staff=" + o.width];
  const env = Object.assign({}, process.env, { KOLOB_DIR: dir, KOLOB_BASE: dir, KOLOB_STAFF_TRACE: file });
  const p = spawnSync(process.execPath, args, { env, encoding: "utf8", maxBuffer: 1 << 26 });
  const line = (p.stdout.match(/^staff: .*$/m) || [""])[0], verdict = (p.stdout.match(/VERDICT: .*/) || [""])[0];
  if (!/PASS/.test(verdict)) throw R.refusal("the harness failed for " + side + " (" + spec + "): " + (verdict || p.stderr.slice(0, 400)));
  console.log(side + ": " + spec + " · " + line.slice(0, line.indexOf(" · by minute")));
  return file;
}

(async () => {
  const a = U.parseArgs(process.argv.slice(2), ["help"]);
  if (a.help) { console.log(HELP); return; }
  const opts = { inline: a.inline ? String(a.inline).split(",") : [], show: a.show != null ? +a.show : 12, maxD: +a["max-edits"] || 4000 };
  let fa = a._ && a._[0], fb = a._ && a._[1];
  if (a.a || a.b) {
    const o = { seed: +a.seed || 22, secs: +a.secs || 300, width: +a.width || 860 };
    o.out = a.out ? path.resolve(String(a.out)) : U.outDir({}, "tracediff");
    fs.mkdirSync(o.out, { recursive: true });
    fa = render(a.a || "git:HEAD", o, "a");
    fb = render(a.b || "worktree", o, "b");
  }
  if (!fa || !fb) { console.log(HELP); process.exit(2); }
  const r = await compare(fa, fb, opts);
  console.log(report(r, opts));
  process.exit(0);
})().catch((e) => { console.error("tracediff.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });
