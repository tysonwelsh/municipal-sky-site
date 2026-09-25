// ============================================================================
// ZANKYŌ Q0 — the picture's freezes, read from an _rx-probe capture (dev tool
// only). The critic's reading for Q0 round 2.
//
// _rx-probe.js's lip-sync gate skips every poll where the element has no frame
// (readyState < 2), and rx-critic.js's reads currentTime, which during a seek
// already reports the TARGET. So both are blind to the one thing the owner
// would see when picSync misbehaves: the tube held on one frame while the
// element seeks, then a jump. This reads it from the media events instead.
//
// Per settled piece of every decoded reception (0.5 s after the piece opens to
// its end, as the lip-sync gate):
//   seeks    the page's set:currentTime calls on the piece's element
//   frozen   seconds from a `seeking` or `waiting` to the next `seeked` or
//            `playing` (what the tube shows as a held frame)
//   by seek  how much of that began within 60 ms of a page seek, and how long
//            each of those seeks took to land (the machine's seek latency —
//            report it beside any lip-sync number, it is the load)
//   rate off seconds with playbackRate more than 15 % off the piece's rate
//
//   node tools/pic-freeze.js DIR [DIR …] [-v]
//
// Proposed gate (critic, Q0 r2): frozen ≤ 5 % of every settled piece, and ≤ 2
// page seeks in any settled piece. Exit 1 if any piece breaks it.
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2), verbose = args.includes("-v");
const dirs = args.filter((a) => a !== "-v");
const tot = { pieces: 0, sec: 0, seeks: 0, frozen: 0, bySeek: 0, other: 0, fast: 0, bad: 0 }, land = [];
for (const d of dirs) {
  const rx = JSON.parse(fs.readFileSync(path.join(d, "rx.json"), "utf8"));
  const lastT = rx.clk[rx.clk.length - 1];
  const recs = rx.ev.filter((e) => /受信$/.test(e.label) && e.signal && e.signal.rx && e.signal.t0 + e.signal.rx.spanS <= lastT && e.signal.t0 >= rx.clk[0]);
  const R = { pieces: 0, sec: 0, seeks: 0, frozen: 0, bySeek: 0, other: 0, fast: 0, bad: 0 };
  for (const e of recs) {
    const s = e.signal, P = s.rx, id = s.vid;
    const buf = s.reels ? s.reels === "buffer" : !!(rx.route && rx.route.reelsMode === "buffer");
    if (!buf || id == null) continue;
    for (let k = 0; k < P.segments.length; k++) {
      const sg = P.segments[k], a = s.t0 + sg.atS + 0.5, b = s.t0 + sg.atS + sg.onS + (sg.holeS || 0) - 0.1;
      if (b - a < 1) continue;
      const mine = (c) => c.s && c.s.id === id;
      const seeks = rx.calls.filter((c) => mine(c) && c.m === "set:currentTime" && c.t >= a && c.t <= b).length;
      const ms = rx.media.filter((m) => m.id === id && m.t >= a - 3 && m.t <= b).sort((x, y) => x.t - y.t);
      let fr = 0, bySeek = 0, st = null, fromSeek = false;
      const close = (tEnd) => {
        const f = Math.max(0, Math.min(b, tEnd) - Math.max(a, st));
        fr += f; if (fromSeek) { bySeek += f; land.push(tEnd - st); }
        st = null;
      };
      for (const m of ms) {
        if ((m.ty === "seeking" || m.ty === "waiting") && st == null) { st = m.t; fromSeek = rx.calls.some((c) => mine(c) && c.m === "set:currentTime" && Math.abs(c.t - m.t) < 0.06); }
        else if ((m.ty === "seeked" || m.ty === "playing") && st != null) close(m.t);
      }
      if (st != null) close(b);
      const rates = rx.calls.filter((c) => mine(c) && c.m === "set:playbackRate" && c.t <= b).sort((x, y) => x.t - y.t);
      const base = (s.head && s.head[k] && s.head[k].rate) || 1;
      let cur = 1, fast = 0, tp = a;
      for (const c of rates) { if (c.t <= a) { cur = c.v; continue; } if (Math.abs(cur / base - 1) > 0.15) fast += c.t - tp; tp = c.t; cur = c.v; }
      if (Math.abs(cur / base - 1) > 0.15) fast += b - tp;
      const bad = fr / (b - a) > 0.05 || seeks > 2;
      R.pieces++; R.sec += b - a; R.seeks += seeks; R.frozen += fr; R.bySeek += bySeek; R.other += fr - bySeek; R.fast += fast; if (bad) R.bad++;
      if (verbose || bad) console.log((bad ? "! " : "  ") + path.basename(d) + " " + e.label + " " + s.id + " t0 " + s.t0.toFixed(1) + " piece " + k + " " + (b - a).toFixed(1) + " s · seeks " + seeks + " · frozen " + fr.toFixed(1) + " s (" + bySeek.toFixed(1) + " after a page seek) · rate >15 % off " + fast.toFixed(1) + " s");
    }
  }
  console.log("== " + path.basename(d) + ": " + R.pieces + " pieces (" + R.sec.toFixed(0) + " s) · seeks " + R.seeks + " · frozen " + R.frozen.toFixed(1) + " s (" + (R.sec ? 100 * R.frozen / R.sec : 0).toFixed(1) + " %; " + R.bySeek.toFixed(1) + " s after a page seek, " + R.other.toFixed(1) + " s without) · rate off " + R.fast.toFixed(1) + " s · pieces over the gate " + R.bad);
  for (const k in tot) tot[k] += R[k];
}
land.sort((x, y) => x - y);
const q = (p) => land.length ? land[Math.min(land.length - 1, Math.floor(land.length * p))].toFixed(2) : "-";
console.log("TOTAL " + tot.pieces + " pieces · seeks " + tot.seeks + " · frozen " + tot.frozen.toFixed(1) + " s of " + tot.sec.toFixed(0) + " (" + (tot.sec ? 100 * tot.frozen / tot.sec : 0).toFixed(1) + " %) · after a page seek " + tot.bySeek.toFixed(1) + " s, without " + tot.other.toFixed(1) + " s · seek landing p50 " + q(0.5) + " p90 " + q(0.9) + " max " + q(1) + " s · pieces over the gate (frozen > 5 % or > 2 seeks): " + tot.bad);
process.exit(tot.bad ? 1 : 0);
