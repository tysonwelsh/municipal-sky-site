// ============================================================================
// ZANKYŌ Q0 — the reception reliability probe (dev tool, not shipped to
// users' ears). PLAN-SIGNAL-PICTURE §7 row Q0, §11.4.
//
// The owner heard a video reception whose audio chopped in and out, and not by
// design. _harness.js and _probe.js cannot see that: they stub the reel's MP4,
// so no media element ever plays a byte of it. This probe runs the REAL page in
// headless Chrome — the receiver's own elements, the real reels, the real
// network (optionally throttled) — and listens with tools/rxrec.js.
//
// Usage:
//   node _rx-probe.js run [--seed N] [--secs S] [--mode natural|force|press]
//        [--throttle none|slow4g|host] [--port 8061] [--query "&far=0.9"]
//        [--reject-decode] [--out DIR]
//   node _rx-probe.js analyze DIR [DIR …] [--quiet]
//
//   natural   the station runs as it would for a listener; receptions come
//             when the placement seats them (about two a cycle).
//   force     between natural ones, the bench seats one reception after
//             another through _dev.seatWindow — the LEGAL path, so every one
//             is armed, prefetched and decided exactly as production does it
//             (≥ 14 s of lead), with the shape forced round-robin through
//             every body × entry × exit, on a random reel with a picture.
//   press     the owner's hand: the ledge's 受信 button (#zankyo-push) is
//             clicked every 6–40 s, whatever the station is doing — which is
//             how the owner actually listens ("keeps pressing 受信"). A press
//             seats a real reception when it can and auditions a window when
//             it cannot, so this is the mode that exercises the audition on a
//             playing station.
//
// WHAT COUNTS AS A GAP, and how it is classified. Every reception's
// descriptor carries its plan (t0, entry, pieces, gaps, holes, exit, drops),
// so the probe knows, for every 5.3 ms block, what the receiver MEANT the
// listener to hear. Against that:
//
//   head gap     the raw reel, tapped at the element's own node, is digital
//                silence while the element is meant to be sounding AND the
//                reel file at the element's reported position is not silent.
//                (A stalled or seeking element outputs zeros; a quiet reel
//                does not — the file is decoded with ffmpeg and checked.)
//   stall        the element is not paused, but its currentTime advanced less
//                than a third of what the audio clock did over a poll.
//   splice       the element's position crosses a window boundary (the reel
//                files are windows cut back to back, so a boundary is a jump
//                cut in the source) or reaches the end of the file.
//   late start   a piece's first audio arrives after its envelope has risen.
//   wrong reel   the element is playing a different reel from the one the
//                reception's piece names (something else took the element).
//   conflict     two receptions (or an audition) on the air at once on the
//                SAME element — whatever the one does to the element (seek,
//                pause, src) it does to the other.
//
// Each is then INTENDED if the envelope the receiver wrote is below 5 % of
// peak at that moment (a carrier-lost gap, the relock, the hunt between
// glimpses, the loss's tail — the listener hears nothing of the reel there by
// design) and UNINTENDED otherwise. The scheduled drops and 断's holes are
// ducks on the gate, AFTER the head, so they never register as head gaps:
// they are intended by construction and the probe reports them only as
// counts, so the reader can see what the owner hears as designed stutter.
//
// Exit 1 when `analyze` finds any unintended gap.
// ============================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { launch, clickSelector, sleep } = require("./tools/cdp.js");

const DIR = __dirname;
const argv = process.argv.slice(2);
function opt(name, def) { const i = argv.indexOf("--" + name); return i >= 0 ? argv[i + 1] : def; }
function flag(name) { return argv.indexOf("--" + name) >= 0; }

const BLOCK = 256;
const CACHE = process.env.ZK_RX_CACHE || path.join(os.tmpdir(), "zk-rx-cache");

// ---- throttling profiles (Network.emulateNetworkConditions) ----------------
// slow4g is DevTools' "Slow 4G". host is the Bluehost host as measured from
// here on 2026-09-24 (TTFB 140–200 ms, 1.8–2.5 MB/s on a reel) with the
// throughput cut to a quarter, for a listener on a poor connection.
const THROTTLE = {
  none: null,
  slow4g: { offline: false, latency: 562.5, downloadThroughput: 1.6e6 / 8 * 0.9, uploadThroughput: 750e3 / 8 * 0.9 },
  host: { offline: false, latency: 200, downloadThroughput: 500e3, uploadThroughput: 250e3 },
};

// ============================================================================
// RUN
// ============================================================================
async function run() {
  const seed = parseInt(opt("seed", "3042"), 10);
  const secs = parseFloat(opt("secs", "600"));
  const mode = opt("mode", "natural");
  const thr = opt("throttle", "none");
  const port = opt("port", "8061");
  const query = opt("query", "");
  const out = opt("out", path.join(CACHE, "run-" + seed + "-" + mode + "-" + thr + "-" + Date.now()));
  fs.mkdirSync(out, { recursive: true });
  const url = "http://127.0.0.1:" + port + "/art/zankyo/?seed=" + seed + query;
  const rec = fs.readFileSync(path.join(DIR, "tools", "rxrec.js"), "utf8");
  const b = await launch({ tmp: CACHE });
  const log = [];
  let page;
  try {
    page = await b.newPage();
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Network.enable");
    page.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error" || p.type === "warning" || p.type === "assert")
        log.push({ type: p.type, text: (p.args || []).map((a) => a.value != null ? String(a.value) : (a.description || "")).join(" ").slice(0, 400) });
    });
    page.on("Runtime.exceptionThrown", (p) => log.push({ type: "exception", text: (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text || "").slice(0, 600) }));
    if (THROTTLE[thr]) await page.send("Network.emulateNetworkConditions", THROTTLE[thr]);
    // Q0 r2: --reject-decode stands in for a WebKit that refuses a reel — every
    // decodeAudioData rejects, as a real decoder's refusal does (both forms)
    if (flag("reject-decode")) await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "(function(){var B=window.BaseAudioContext||window.AudioContext;B.prototype.decodeAudioData=function(ab,ok,err){var e=new DOMException('injected by _rx-probe --reject-decode','EncodingError');if(err)setTimeout(function(){err(e);},5);return Promise.reject(e);};})();" });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: rec });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(path.join(DIR, "tools", "presshook.js"), "utf8") });   // the press log (Q0 r2)
    await page.send("Page.navigate", { url });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    // wait for the page's scripts and the manifest
    for (let i = 0; i < 120; i++) {
      const ok = await page.eval("!!(window.ZankyoBroadcast && ZankyoBroadcast.getState && ZankyoBroadcast.getState().pool === 'ready')").catch(() => false);
      if (ok) break;
      await sleep(500);
    }
    await clickSelector(page, "#zankyo-play");
    await sleep(1500);
    const st = await page.eval("({state: ZankyoAudio.getAudioContext() && ZankyoAudio.getAudioContext().state, route: __rx.route, heads: __rx.heads, bus: __rx.bus, sr: __rx.sr})");
    process.stderr.write("[rx] " + url + " throttle=" + thr + " mode=" + mode + " " + JSON.stringify(st) + "\n");
    const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "broadcast", "manifest.json"), "utf8"));
    const video = manifest.filter((r) => !r.audioOnly);
    const combos = [];
    for (const body of ["jou", "modori", "dan", "sou"]) for (const entry of ["soku", "tan", "fu"]) for (const exit of ["setsu", "zan", "zetsu"]) combos.push({ body, entry, exit });
    let ci = seed % combos.length, rnd = seed >>> 0;
    const nextRand = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
    const tStart = Date.now();
    let lastForce = 0, forced = 0, presses = 0, nextPress = Date.now() + 8000;
    while ((Date.now() - tStart) / 1000 < secs) {
      await sleep(2000);
      if (mode === "press" && Date.now() >= nextPress) {
        await clickSelector(page, "#zankyo-push").catch(() => {});
        presses++;
        nextPress = Date.now() + (6 + nextRand() * 34) * 1000;
      }
      if (mode === "force" && Date.now() - lastForce > 4000) {
        const bs = await page.eval("ZankyoBroadcast._dev.benchState()").catch(() => null);
        const gs = await page.eval("(function(){var s=ZankyoBroadcast.getState();return {live:s.live, armed:s.armed}})()").catch(() => null);
        const busy = !bs || bs.live || bs.queued || (gs && gs.armed.some((q) => q.t0 != null));
        if (!busy) {
          const c = combos[ci % combos.length];
          const reel = video[Math.floor(nextRand() * video.length)];
          const budget = [10, 14, 20, 26][Math.floor(nextRand() * 4)];
          const r = await page.eval("(function(){var sh=ZankyoBroadcast._dev.shapeFor(" + JSON.stringify({ body: c.body, entry: c.entry, exit: c.exit, budgetS: budget, pieces: nextRand() < 0.3 ? 3 : 2 }) + ");" +
            "return ZankyoBroadcast._dev.seatWindow(" + JSON.stringify(reel.id) + ", -1, {shape: sh, whole: false});})()").catch((e) => ({ ok: false, why: e.message }));
          lastForce = Date.now();
          if (r && (r.ok || r.state === "queued")) { ci++; forced++; }
        }
      }
    }
    // pull everything
    const meta = { seed, secs, mode, throttle: thr, url, started: new Date(tStart).toISOString(), forced, presses, rejectDecode: flag("reject-decode") };
    const rx = await page.eval("(function(){var R=__rx;return {pulledAt: ZankyoAudio.getAudioContext() ? ZankyoAudio.getAudioContext().currentTime : null, glide: R.glide || null, sr:R.sr, block:R.block, ev:R.ev, calls:R.calls, media:R.media, polls:R.polls, clk:R.clk, err:R.err, bus:R.bus, heads:R.heads, spMiss:R.spMiss, spN:R.spN, route:R.route, state: ZankyoBroadcast.getState()}})()", 300000);
    let from = 0, lastPull = null; const parts = [];
    for (;;) {
      const p = await page.eval("__rx.pullRows(" + from + ")", 300000);
      lastPull = p;
      const buf = Buffer.from(p.b64, "base64");
      parts.push(buf);
      from = p.n;
      break;
    }
    fs.writeFileSync(path.join(out, "rows.f32"), Buffer.concat(parts));
    rx.w = lastPull.w; rx.srcs = lastPull.srcs;
    rx.console = log;
    fs.writeFileSync(path.join(out, "rx.json"), JSON.stringify(rx));
    fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify(meta, null, 1));
    fs.writeFileSync(path.join(out, "crit.json"), JSON.stringify(await page.eval("window.__crit || null").catch(() => null)));
    process.stderr.write("[rx] wrote " + out + " (" + rx.ev.filter((e) => /受信$/.test(e.label)).length + " receptions, " + (rx.spMiss) + " tap misses of " + rx.spN + ")\n");
    console.log(out);
  } finally {
    try { page && page.close(); } catch (e) {}
    await b.close();
  }
}

// ============================================================================
// THE REEL FILES, decoded once (ffmpeg), as 256-sample block RMS
// ============================================================================
const srcCache = {};
function srcEnv(id, sr) {
  const key = id + "@" + sr;
  if (srcCache[key]) return srcCache[key];
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, id + "." + sr + ".env");
  if (!fs.existsSync(f)) {
    const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(DIR, "broadcast", "reels", id + ".mp4"), "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
    const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    const n = Math.floor(x.length / BLOCK), e = new Float32Array(n);
    for (let b = 0; b < n; b++) { let s = 0; for (let k = b * BLOCK; k < (b + 1) * BLOCK; k++) s += x[k] * x[k]; e[b] = Math.sqrt(s / BLOCK); }
    fs.writeFileSync(f, Buffer.from(e.buffer));
  }
  const buf = fs.readFileSync(f);
  const env = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  return (srcCache[key] = env);
}
// the loudest block of the file within ±w seconds of position p
function srcLevel(env, sr, p, w) {
  const a = Math.max(0, Math.floor((p - w) * sr / BLOCK)), b = Math.min(env.length - 1, Math.ceil((p + w) * sr / BLOCK));
  let m = 0; for (let i = a; i <= b; i++) if (env[i] > m) m = env[i];
  return m;
}

// ============================================================================
// THE ENVELOPE THE RECEIVER WROTE — planEnv(), walked from the wire plan
// ============================================================================
// A copy of zk-broadcast.js planEnv, over the descriptor's plain numbers, as
// breakpoints [t, fraction of peak]. The ramps are taken as linear; for
// classification against 5 % of peak that is exact enough.
function envPoints(rx) {
  const env = [];
  let eAcc = 0;
  if (rx.entry === "tan" && rx.glimpses && rx.glimpses.length) {
    for (const g of rx.glimpses) {
      env.push([Math.max(0.01, g[0] - eAcc), 0]); env.push([0.05, 0.55]); env.push([Math.max(0.02, g[1] - 0.1), 0.5]); env.push([0.05, 0]);
      eAcc = g[0] + g[1];
    }
    env.push([Math.max(0.02, rx.entryS - eAcc), 0]); env.push([0.25, 0.85]);
    env.push([Math.max(0, rx.segments[0].onS - 0.25 - 1.0), 1]); env.push([1.0, 1]);
  } else if (rx.entry === "fu") {
    env.push([rx.entryS * 0.45, 0.10]); env.push([rx.entryS * 0.35, 0.42]); env.push([rx.entryS * 0.20, 0.85]); env.push([1.0, 1]);
    env.push([Math.max(0, rx.segments[0].onS - 1.0), 1]);
  } else {
    env.push([rx.entryS, 0.85]); env.push([1.0, 1]); env.push([Math.max(0, rx.segments[0].onS - 1.0), 1]);
  }
  for (let i = 1; i < rx.segments.length; i++) {
    const s = rx.segments[i], g = rx.gaps[i - 1];
    env.push([0.12, 0]); env.push([Math.max(0, g.durS - 0.12), 0]); env.push([Math.max(0.02, s.lockS), 1]); env.push([s.onS, 1]);
  }
  if (rx.exitS > 0.05) { env.push([rx.exitS * 0.5, 0.75]); env.push([rx.exitS * 0.25, 0.44]); env.push([rx.exitS * 0.15, 0.19]); env.push([rx.exitS * 0.1, 0.06]); }
  env.push([0.02, 0]);
  const pts = [[0, 0]]; let t = 0;
  for (const [d, v] of env) { t += d; pts.push([t, v]); }
  return pts;
}
function envAt(pts, t) {
  if (t <= 0 || t >= pts[pts.length - 1][0]) return 0;
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [ta, va] = pts[i - 1], [tb, vb] = pts[i];
    return tb > ta ? va + (vb - va) * (t - ta) / (tb - ta) : vb;
  }
  return 0;
}
// 断's holes duck the envelope to HOLE_FLOOR; the probe counts them as a duck,
// never as a gap, but a head gap inside one is inaudible and so intended.
function inHole(rx, rel) { for (const h of rx.holes || []) if (rel >= h.atS - 0.05 && rel <= h.atS + h.durS + 0.05) return true; return false; }

// ============================================================================
// ANALYZE
// ============================================================================
function analyze(dirs) {
  const quiet = flag("quiet");
  const K = ["head gap", "stall", "late start", "splice", "end of file", "wrong reel", "conflict", "overlap", "lip sync", "faded", "dead press", "picture stall"];
  const all = { receptions: 0, auditions: 0, found: {}, unintended: {}, gapMsU: 0, waiting: 0, fallbacks: 0, drops: 0, holes: 0, tapMiss: 0, tapN: 0, consoleErr: 0, shapes: {},
    sync: [], faded: [], picStall: [], presses: 0, answers: {}, pressWaits: [], stats: [] };
  for (const k of K) { all.found[k] = 0; all.unintended[k] = 0; }
  const unintended = [];
  const man = manifestById();
  for (const d of dirs) {
    const rx = JSON.parse(fs.readFileSync(path.join(d, "rx.json"), "utf8"));
    const meta = JSON.parse(fs.readFileSync(path.join(d, "meta.json"), "utf8"));
    const rb = fs.readFileSync(path.join(d, "rows.f32"));
    const rows = new Float32Array(rb.buffer, rb.byteOffset, rb.length / 4);
    const W = rx.w || 3, sr = rx.sr, bps = 8192 / BLOCK, dtB = BLOCK / sr;
    const nRows = rows.length / W;
    const srcs = rx.srcs || [];
    const rowT = (r) => rx.clk[Math.floor(r / bps)] + (r % bps) * dtB;
    // the events, calls and polls were pulled BEFORE the rows, so the capture
    // is complete only up to the earlier of the two
    // (Q0 r2: the rows are pulled AFTER the clock, so the last row can lie past
    // the last clock entry — rowT() of it was NaN, lastT with it, and every
    // "not fully captured" test below silently passed everything)
    const firstT = rx.clk[0], lastT = Math.min(rx.clk[rx.clk.length - 1] + 8192 / sr, rx.pulledAt != null ? rx.pulledAt : Infinity);
    function rowAt(t) {
      let lo = 0, hi = rx.clk.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rx.clk[m] <= t) lo = m; else hi = m - 1; }
      return Math.max(0, Math.min(nRows - 1, lo * bps + Math.max(0, Math.floor((t - rx.clk[lo]) / dtB))));
    }
    all.tapMiss += rx.spMiss; all.tapN += rx.spN;
    all.consoleErr += (rx.console || []).filter((c) => (c.type === "error" || c.type === "exception") && !/TUNED reel\(s\) have windows of differing length/.test(c.text)).length;
    const fb = rx.ev.filter((e) => e.label === "受信 fallback");
    all.fallbacks += fb.length;
    if (!quiet) {
      console.log("\n== " + path.basename(d) + " · seed " + meta.seed + " · " + meta.mode + (meta.presses ? " (" + meta.presses + " presses)" : "") + " · throttle " + meta.throttle + " · " + meta.secs + " s · tap " + rx.spMiss + "/" + rx.spN + " missed · reels " + (rx.route && rx.route.reelsMode));
      for (const f of fb) console.log("   fallback @" + f.t.toFixed(1) + ": " + f.detail);
      for (const c of rx.console || []) if (!/TUNED reel\(s\) have windows of differing length/.test(c.text)) console.log("   console." + c.type + ": " + c.text.slice(0, 200));
      for (const e of rx.err || []) console.log("   page error: " + e);
    }
    const recs = rx.ev.filter((e) => /受信$/.test(e.label) && e.signal && e.signal.rx);
    if (rx.state && rx.state.stats) all.stats.push({ run: path.basename(d), fallbacks: rx.state.stats.fallbacks, demoted: rx.state.stats.demoted || null, picSeeks: rx.state.stats.picSeeks || 0,
      audBlocked: rx.state.stats.audBlocked || 0, audLate: rx.state.stats.audLate || 0, reelsMode: rx.state.reelsMode });
    // (Q0 r2) THE PRESS: every 受信 press made while nothing was on the air
    // must be answered by a reel within 6 s — the owner's rc.77 rule, and the
    // critic's reading (tools/rx-critic.js), whatever dial() said it did.
    const critF = path.join(d, "crit.json");
    const crit = fs.existsSync(critF) ? JSON.parse(fs.readFileSync(critF, "utf8")) : null;
    if (crit && crit.dial) for (const p of crit.dial) {
      if (p.t == null || p.t > lastT - 40) continue;
      all.presses++; all.answers[p.r] = (all.answers[p.r] || 0) + 1;
      const onAir = recs.some((e) => e.signal.t0 - 4.5 <= p.t && p.t <= e.signal.t0 + e.signal.rx.spanS + 0.8);
      const next = recs.map((e) => e.signal.t0).filter((x) => x > p.t - 0.01).sort((x, y) => x - y)[0];
      const wait = next != null ? next - p.t : Infinity;
      if (!onAir) all.pressWaits.push(wait);
      if (!onAir && wait > 6) {
        all.found["dead press"]++; all.unintended["dead press"]++;
        unintended.push({ run: path.basename(d), kind: "dead press", at: p.t, dur: wait, why: "press answered " + p.r + " with nothing on the air; next reel " + (isFinite(wait) ? wait.toFixed(1) + " s" : "never") });
        if (!quiet) console.log("   ! UNINTENDED dead press @" + p.t.toFixed(1) + " → " + p.r + " · next reel +" + (isFinite(wait) ? wait.toFixed(1) : "∞") + " s");
      }
    }
    // on the air at once, on one element: whatever either does to it, it does to both
    const spans = recs.map((e) => ({ e, a: e.signal.t0 - 0.2, b: e.signal.t0 + e.signal.rx.spanS, ch: e.signal.ch }));
    for (const ev of recs) {
      const s = ev.signal, P = s.rx, t0 = s.t0, vid = s.vid, ch = s.ch != null ? s.ch : -1;
      const aud = ev.label !== "受信";
      // decoded or element — per reception since Q0 r2 (a page can be demoted mid-session)
      const bufR = s.reels ? s.reels === "buffer" : !!(rx.route && rx.route.reelsMode === "buffer");
      if (t0 + P.spanS > lastT || t0 < firstT) continue;           // not fully captured
      if (aud) all.auditions++; else all.receptions++;
      const key = (aud ? "♪ " : "") + P.entry + "/" + P.body + "/" + P.exit;
      all.shapes[key] = (all.shapes[key] || 0) + 1;
      all.drops += (s.drops || []).length; all.holes += (P.holes || []).length;
      const pts = envPoints(P);
      const envMaxOver = (a, b) => { let m = 0; for (let t = a; t <= b; t += 0.005) m = Math.max(m, envAt(pts, t)); return m; };
      const found = [];
      const push = (f) => found.push(f);
      // --- 0. conflicts ---
      const bufModeC = bufR;   // buffers cannot share anything; only elements can
      for (const o of spans) {
        if (bufModeC || o.e === ev || o.ch !== ch || ch < 0 || o.e.signal.reels === "buffer") continue;
        const a = Math.max(o.a, t0 - 0.2), b = Math.min(o.b, t0 + P.spanS);
        if (b > a) { const em = envMaxOver(a - t0, b - t0); push({ kind: "conflict", at: +(a - t0).toFixed(2), dur: +(b - a).toFixed(2), env: +em.toFixed(2), intended: false, why: "shares its element with " + o.e.label + " " + o.e.signal.id + " (t0 " + o.e.signal.t0.toFixed(1) + ")" }); }
      }
      // --- the element's position (and reel) over time, from the poll ---
      const pl = rx.polls.filter((p) => p[1] === vid && p[0] >= t0 - 1 && p[0] <= t0 + P.spanS + 1);
      const pollAt = (t) => { let best = null; for (let i = 0; i < pl.length; i++) { if (pl[i][0] <= t) best = pl[i]; else break; } return best; };
      const segAt = (rel) => { let g = P.segments[0]; for (const sg of P.segments) if (rel >= sg.atS - sg.lockS - 0.05) g = sg; return g; };
      // In buffer mode the element is only the picture, and the sound's
      // position is exactly what the page threaded (desc.head): piece k runs
      // from head[k].pos at t0 + head[k].at. That is used instead of the
      // picture's clock wherever the page recorded it.
      const bufModeP = bufR;
      // a tuned reel runs at its bent rate: the page says so in its 同調 line
      // (or, from rc.93, in desc.head[].rate)
      const tun = rx.ev.find((x) => x.label === "同調" && Math.abs(x.t - (t0 + 0.4)) < 0.05 && /rate ([0-9.]+)/.test(x.detail || ""));
      const rateOf = (k) => (s.head && s.head[k] && s.head[k].rate) || (tun ? parseFloat(/rate ([0-9.]+)/.exec(tun.detail)[1]) : 1);
      // …and on a gliding night the rate is rate × glideMul(t), integrated
      const glideAt = (t) => {
        const G = rx.glide; if (!G || !G.length) return 1;
        let lo = 0, hi = G.length - 1; if (t <= G[0][0]) return G[0][1]; if (t >= G[hi][0]) return G[hi][1];
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (G[m][0] <= t) lo = m; else hi = m; }
        return G[lo][1] + (G[hi][1] - G[lo][1]) * (t - G[lo][0]) / (G[hi][0] - G[lo][0]);
      };
      // ∫ glide, tabulated once per reception at 5 ms
      const GT0 = t0 - 1, GDT = 0.005, GN = Math.ceil((P.spanS + 3) / GDT);
      let GC = null;
      if (bufModeP && rx.glide && rx.glide.length) { GC = new Float64Array(GN + 1); for (let i = 1; i <= GN; i++) GC[i] = GC[i - 1] + GDT * glideAt(GT0 + (i - 0.5) * GDT); }
      const gInt = (t) => { const x = Math.max(0, Math.min(GN, (t - GT0) / GDT)), i = Math.floor(x); return GC[i] + (i < GN ? (GC[i + 1] - GC[i]) * (x - i) : 0); };
      const posRaw = (t) => {
        if (bufModeP && s.head && s.head.length) {
          const rel = t - t0; let k = 0;
          for (let j = 0; j < s.head.length; j++) if (rel >= s.head[j].at - 0.01) k = j;
          const from = t0 + s.head[k].at; if (t <= from) return s.head[k].pos;
          return s.head[k].pos + rateOf(k) * (GC ? gInt(t) - gInt(from) : (t - from));
        }
        const b = pollAt(t); return b ? b[2] + (t - b[0]) * b[4] : null;
      };
      // THE ALIGNMENT. An element's currentTime runs ahead of the audio the
      // graph is receiving from it (the media pipeline's own buffering; about
      // 0.1–0.25 s in headless Chrome), and in buffer mode the element is only
      // the picture. So the head's envelope is matched against the file's over
      // the first seconds of the hold, and the lag that fits best is applied to
      // every position below. Reported per reception: it is also the picture's
      // lead over the sound.
      let lag = 0, lagQ = 0;
      if (ch >= 0) {
        const r0 = segAt(P.segments[0].atS + 0.5).reel, env = man[r0] ? srcEnv(r0, sr) : null;
        if (env) {
          const tA = t0 + P.segments[0].atS + 0.6, tB = Math.min(t0 + P.segments[0].atS + P.segments[0].onS, tA + 6);
          const hr = []; for (let r = rowAt(tA); r <= rowAt(tB); r++) hr.push([rowT(r), Math.log(rows[r * W + ch] + 1e-5)]);
          let best = -Infinity;
          for (let L = -0.6; L <= 0.6; L += dtB) {
            let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, n = 0;
            for (const [t, y] of hr) { const p = posRaw(t); if (p == null) continue; const bi = Math.round((p + L) * sr / BLOCK); if (bi < 0 || bi >= env.length) continue; const xv = Math.log(env[bi] + 1e-5); sxy += xv * y; sx += xv; sy += y; sxx += xv * xv; syy += y * y; n++; }
            if (n < 50) continue;
            const cov = sxy / n - (sx / n) * (sy / n), vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
            const rr = vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : -1;
            if (rr > best) { best = rr; lag = L; }
          }
          lagQ = best;
          if (lagQ < 0.8) lag = 0;        // a weak fit is not evidence of an offset (a flat reel correlates with anything)
        }
      }
      const posAt = (t) => { const p = posRaw(t); return p == null ? null : p + lag; };
      const srcAt = (t) => {
        if (bufR) return segAtT(t);          // the buffer plays the piece's own reel, by construction
        const b = pollAt(t); return b && b[5] != null ? (srcs[b[5]] || "").replace(/\.mp4$/, "") : null;
      };
      const segAtT = (t) => { const rel = t - t0; let g = P.segments[0]; for (const sg of P.segments) if (rel >= sg.atS - sg.lockS - 0.05) g = sg; return g.reel; };
      const vidEvents = rx.media.filter((m) => m.id === vid && m.t != null && m.t >= t0 - 1.5 && m.t <= t0 + P.spanS);
      all.waiting += vidEvents.filter((m) => m.ty === "waiting").length;
      // --- 1. head gaps ---
      if (ch >= 0) {
        const a = rowAt(t0 + 0.25), bnd = rowAt(t0 + P.spanS - 0.05);
        let run = -1;
        const close = (endR) => {
          const ta = rowT(run), tb = rowT(endR), dur = tb - ta;
          run = -1;
          if (dur < 0.02) return;
          const relA = ta - t0, relB = tb - t0, mid = (relA + relB) / 2;
          const rid = srcAt((ta + tb) / 2) || segAt(mid).reel;
          const pos = posAt((ta + tb) / 2);
          let srcLoud = 1;
          if (rid && man[rid] && pos != null) { try { srcLoud = srcLevel(srcEnv(rid, sr), sr, pos, dur / 2 - 0.01); } catch (e) {} }
          if (srcLoud < 1e-4) return;                                  // the reel itself is silent there: not a gap
          const em = envMaxOver(relA, Math.max(relA, relB - 0.02)), hole = inHole(P, mid);   // − one ramp: the row that ends a gap is the one the envelope opens on
          // a hunt or a drift on a window at the very head of its file cannot
          // pre-roll; its head starts later by design (headPlan) and the
          // glimpses before that catch an empty carrier
          const lockRel0 = Math.max(0, P.entryS - Math.min(P.entryS, P.entry === "fu" ? 3 : 0.4));
          const headStart = Math.max(0, lockRel0 - P.segments[0].inS);
          const early = relB <= headStart + 0.3;
          // after the edge the page declared (headPlan's overrunS), the reel
          // is faded out on purpose and the band's static carries the rest
          const hl = s.head && s.head[s.head.length - 1];
          const edgeRel = hl && hl.overrunS > 0.05 && hl.edgePos != null ? hl.at + (hl.edgePos - hl.pos) / rateOf(s.head.length - 1) - 0.4 : Infinity;
          const pastEdge = relA >= edgeRel;
          let intended = em < 0.05 || hole || early || pastEdge, why = intended ? (hole ? "in a 断 hole" : early ? "before the head starts (a window at the file's head)" : pastEdge ? "past the window's edge, faded by the page" : "envelope at the floor") : "reel audible by plan";
          // did the element say it ran dry, with the bytes already there? (an underrun, not the network)
          const wt = vidEvents.find((m) => m.ty === "waiting" && m.t >= ta - 0.25 && m.t <= tb + 0.05);
          if (wt) why += " · element waiting @" + (wt.t - t0).toFixed(2) + " rs " + wt.rs + " buf " + wt.buf;
          // COVERED: the bus carries the static over the hole (the stall cover) — measured, not assumed
          let covered = false;
          if (!intended && dur > 0.08) {
            const bus = (x0, x1) => { const v = []; for (let r = rowAt(x0); r <= rowAt(x1); r++) v.push(rows[r * W + (W - 1)]); return v; };
            const before = bus(ta - 1.0, ta - 0.05).sort((p, q) => p - q), during = bus(ta + 0.06, tb);
            const med = before.length ? before[before.length >> 1] : 0, mean = during.length ? during.reduce((p, q) => p + q, 0) / during.length : 0;
            covered = med > 0 && mean >= 0.25 * med;
            why += " · bus " + (med > 0 ? (mean / med).toFixed(2) : "?") + "× of the second before" + (covered ? " — COVERED by static" : "");
          }
          push({ kind: "head gap", at: +relA.toFixed(3), dur: +dur.toFixed(3), env: +em.toFixed(2), intended, covered, why });
        };
        for (let r = a; r <= bnd; r++) {
          const z = rows[r * W + ch] < 1e-6;
          if (z && run < 0) run = r;
          if (!z && run >= 0) close(r);
        }
        if (run >= 0) close(bnd);
      }
      // --- 2. stalls from the poll (element mode only: in buffer mode the
      //        element is the picture and its stalls are not the sound's) ---
      // Consecutive stalled polls are ONE stall.
      const bufMode = bufR;
      let lastStall = null;
      for (let i = 1; i < pl.length && !bufMode; i++) {
        const dt = pl[i][0] - pl[i - 1][0], dp = pl[i][2] - pl[i - 1][2];
        const rel = pl[i - 1][0] - t0;
        if (dt < 0.03 || rel < 0.3 || rel > P.spanS) continue;
        if (dp < -0.05 || dp > dt * pl[i][4] * 3 + 0.3) continue;     // a seek, not a stall
        if (dp < dt * pl[i][4] * 0.33) {
          const hlS = s.head && s.head[s.head.length - 1];
          if (hlS && hlS.overrunS > 0.05 && hlS.edgePos != null && pl[i][2] >= hlS.edgePos - 0.1) continue;   // the file's end, past a declared edge: the fade
          const em = envMaxOver(rel, rel + dt);
          if (lastStall && Math.abs(lastStall.at + lastStall.dur - rel) < 0.03 && lastStall.intended === (em < 0.05)) {
            lastStall.dur = +(lastStall.dur + dt - dp / pl[i][4]).toFixed(3); lastStall.env = Math.max(lastStall.env, +em.toFixed(2)); continue;
          }
          lastStall = { kind: "stall", at: +rel.toFixed(3), dur: +(dt - dp / pl[i][4]).toFixed(3), env: +em.toFixed(2), intended: em < 0.05, why: "the element's clock stood still" };
          push(lastStall);
        } else lastStall = null;
      }
      // --- 3. splices and wrong reels: the element's position against the window its piece was cut from ---
      for (let si = 0; si < P.segments.length; si++) {
        const sg = P.segments[si], reel = man[sg.reel];
        if (!reel) continue;
        const win = reel.windows.find((w) => sg.inS >= w[0] - 1e-3 && sg.inS < w[1]);
        // the first piece from the moment the station LOCKS (srcFromS): before
        // it, a hunt or a drift pre-rolls on purpose (headPlan)
        const lockRel = Math.max(0, P.entryS - Math.min(P.entryS, P.entry === "fu" ? 3 : 0.4));
        const from = si === 0 ? Math.max(0.3, lockRel) : sg.atS + 0.15, to = si === P.segments.length - 1 ? P.spanS : sg.atS + sg.onS + (sg.holeS || 0);
        let wrongDone = false, spliceDone = false;
        for (let rel = from; rel < to; rel += 0.05) {
          const p = posAt(t0 + rel), sid = srcAt(t0 + rel);
          if (p == null) continue;
          if (!wrongDone && sid && sid !== sg.reel && sid !== "data:") {
            const em = envMaxOver(rel, Math.min(to, rel + 0.5));
            push({ kind: "wrong reel", at: +rel.toFixed(2), dur: +(to - rel).toFixed(2), env: +em.toFixed(2), intended: em < 0.05, why: "piece " + si + " names " + sg.reel + " · the element is playing " + sid });
            wrongDone = true; continue;
          }
          if (!spliceDone && win && sid === sg.reel && (p >= win[1] - 0.02 || p < win[0] - 0.5)) {
            const em = envMaxOver(rel, Math.min(to, rel + 0.5));
            const eof = p >= reel.durS - 0.1;
            // the page declares where it could not keep a run inside its window
            // and fades it at the edge (headPlan's overrunS): that crossing is
            // the fade, under a shut gain, not a jump cut
            const hd = s.head && s.head[si], faded = !!(hd && hd.overrunS > 0.05 && si === P.segments.length - 1 && p >= win[1] - 0.05);
            const atCut = (to - rel) <= 0.1;                        // the last tenth of a second before a cut: the cut is the event
            const ok = em < 0.25 || faded || atCut;
            push({ kind: eof ? "end of file" : "splice", at: +rel.toFixed(2), dur: +(to - rel).toFixed(2), env: +em.toFixed(2), intended: ok,
              why: "piece " + si + " at " + p.toFixed(2) + " s of " + sg.reel + " · its window is " + win[0] + "–" + win[1] + (eof ? " · file ends " + reel.durS : "") +
                (faded ? " · FADED at the edge (overrun " + hd.overrunS + " s)" : atCut ? " · within 0.1 s of the cut" : "") });
            spliceDone = true;
          }
        }
      }
      // --- 3b. in buffer mode, is each piece the RIGHT reel? The element's src
      //         cannot say (it is only the picture), so the head's envelope is
      //         matched against the piece's own file where the plan puts it.
      //         A piece that does not correlate (r < 0.35 over ≥ 3 s, ±60 ms)
      //         is playing something else. ---
      // Two receptions on the air at once share the decoded head's tap and
      // cannot be told apart by content. In force mode that is the bench
      // seating over an armed broadcast (an open item, not a gap); anywhere
      // else it is a finding in its own right.
      const overl = spans.find((o) => o.e !== ev && o.a < t0 + P.spanS && o.b > t0 - 0.2);
      if (overl && bufModeP) {
        push({ kind: "overlap", at: +(Math.max(overl.a, t0) - t0).toFixed(2), dur: 0, env: 1, intended: meta.mode === "force",
          why: "on the air together with " + overl.e.label + " " + overl.e.signal.id + (meta.mode === "force" ? " (the bench seated over an armed broadcast)" : "") });
      }
      if (bufModeP && ch >= 0 && !overl) {
        for (let si = 0; si < P.segments.length; si++) {
          const sg = P.segments[si]; if (!man[sg.reel] || !s.head || !s.head[si]) continue;
          const a0 = t0 + sg.atS + 0.3, a1 = t0 + sg.atS + Math.min(sg.onS, 8) - 0.2;
          if (a1 - a0 < 3) continue;
          const env = srcEnv(sg.reel, sr);
          let best = -1;
          for (let L = -0.06; L <= 0.06; L += dtB) {
            let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, n = 0;
            for (let r = rowAt(a0); r <= rowAt(a1); r++) {
              const t = rowT(r), p0 = posRaw(t); if (p0 == null) continue;
              const p = p0 + L, bi = Math.round(p * sr / BLOCK);
              if (bi < 0 || bi >= env.length) continue;
              const xv = Math.log(env[bi] + 1e-5), y = Math.log(rows[r * W + ch] + 1e-5);
              sxy += xv * y; sx += xv; sy += y; sxx += xv * xv; syy += y * y; n++;
            }
            if (n < 100) continue;
            const cov = sxy / n - (sx / n) * (sy / n), vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
            const rr = vx > 1e-6 && vy > 1e-6 ? cov / Math.sqrt(vx * vy) : 1;   // a flat file matches anything flat
            if (rr > best) best = rr;
          }
          if (best >= 0 && best < 0.35) push({ kind: "wrong reel", at: +sg.atS.toFixed(2), dur: +sg.onS.toFixed(2), env: 1, intended: false, why: "piece " + si + " does not match " + sg.reel + " where the plan puts it (r " + best.toFixed(2) + ")" });
        }
      }
      // --- 4. late starts: a piece's first audio after its envelope has risen ---
      if (ch >= 0) {
        for (let si = 0; si < P.segments.length; si++) {
          const sg = P.segments[si];
          let rise = si === 0 ? (P.entry === "soku" ? 0.0 : P.entry === "fu" ? P.entryS * 0.45 : (P.glimpses && P.glimpses.length ? P.glimpses[0][0] : P.entryS)) : sg.atS - sg.lockS;
          if (si === 0 && s.head && s.head[0] && s.head[0].at > rise) rise = s.head[0].at;   // a head that starts later by design is late from THEN
          const look0 = si === 0 ? -0.3 : rise - 0.35;
          let first = null;
          for (let r = rowAt(t0 + look0); r < rowAt(t0 + rise + 3); r++) if (rows[r * W + ch] >= 1e-6) { first = rowT(r) - t0; break; }
          if (first == null) continue;
          const late = first - rise;
          const em = envMaxOver(rise, first);
          if (late > 0.03) push({ kind: "late start", at: +rise.toFixed(3), dur: +late.toFixed(3), env: +em.toFixed(2), intended: em < 0.1, why: "piece " + si + " audio arrived " + (late * 1000).toFixed(0) + " ms after its envelope began to rise (env " + em.toFixed(2) + " by then)" });
        }
      }
      // --- 5. (Q0 r2) LIP SYNC, decoded receptions: the picture (the element's
      //        position, polled) against the sound (the head the page
      //        threaded, run at its rate and the glide's), over every settled
      //        piece — from 0.5 s after it opens to its end. The gate is the
      //        critic's: |picture − sound| ≤ 120 ms on ≥ 95 % of each piece. ---
      if (bufModeP && s.head && s.head.length && vid != null) {
        for (let si = 0; si < P.segments.length; si++) {
          const sg = P.segments[si], a0 = t0 + sg.atS + 0.5, a1 = t0 + sg.atS + sg.onS + (sg.holeS || 0) - 0.1;
          // Only where the element HAS a frame (readyState ≥ 2). A player that
          // cannot produce one is not out of sync, it is stalled: its media
          // pipeline starved (measured at a load average of ~50 — seeks, a
          // reload and play() all went unanswered for up to 19 s). That is
          // reported as its own reading, "picture stall", in seconds; the sound
          // does not depend on it in decoded mode.
          const offs = []; let stallN = 0, allN = 0;
          for (const q of pl) { if (q[0] < a0 || q[0] > a1) continue; allN++; if (q[3] < 2) { stallN++; continue; } const p = posRaw(q[0]); if (p != null) offs.push(q[2] - p); }
          if (stallN && allN) { const secs = (a1 - a0) * stallN / allN; all.picStall.push({ run: path.basename(d), id: s.id, aud, piece: si, s: +secs.toFixed(1) });
            if (secs >= 1) push({ kind: "picture stall", at: +sg.atS.toFixed(2), dur: +secs.toFixed(2), env: 1, intended: false, covered: true, why: "piece " + si + ": the element had no frame (readyState < 2) for " + secs.toFixed(1) + " s of " + (a1 - a0).toFixed(1) + " — the sound plays on; the tube holds its last frame" }); }
          if (offs.length < 10) continue;
          const okShare = offs.filter((o) => Math.abs(o) <= 0.12).length / offs.length;
          const so = offs.slice().sort((x, y) => x - y), med = so[so.length >> 1], worst = Math.abs(so[0]) > Math.abs(so[so.length - 1]) ? so[0] : so[so.length - 1];
          all.sync.push({ run: path.basename(d), id: s.id, aud, piece: si, n: offs.length, okShare, med, worst });
          if (okShare < 0.95) push({ kind: "lip sync", at: +sg.atS.toFixed(2), dur: +sg.onS.toFixed(2), env: 1, intended: false,
            why: "piece " + si + ": picture within 120 ms of the sound on " + (okShare * 100).toFixed(0) + " % of " + offs.length + " polls · median " + (med * 1000).toFixed(0) + " ms · worst " + (worst * 1000).toFixed(0) + " ms" });
        }
      }
      // --- 6. (Q0 r2) FADED: seconds where the page has faded the reel out at
      //        its window's edge (headPlan's overrunS: the gain under half
      //        from 0.175 s before the edge) while the envelope is still at or
      //        above half of peak — the station gone and its static carrying
      //        the reception. Auditions: none (0.2 s of slack for the 10 ms
      //        grid). Broadcasts: ≤ 1.0 s, except a whole thought (§14 never
      //        slices one; the exit after it is declared). ---
      const hlF = s.head && s.head[s.head.length - 1];
      if (hlF && hlF.overrunS > 0.05 && hlF.edgePos != null) {
        const tEdgeRel = hlF.at + (hlF.edgePos - hlF.pos) / rateOf(s.head.length - 1);
        let f = 0; for (let x = tEdgeRel - 0.175; x < P.spanS; x += 0.01) if (envAt(pts, x) >= 0.5) f += 0.01;
        const r0 = man[P.segments[0].reel], wi0 = r0 ? r0.windows.findIndex((w) => P.segments[0].inS >= w[0] - 1e-3 && P.segments[0].inS < w[1]) : -1;
        const whole = !!(r0 && wi0 >= 0 && (r0.wholeWindows ? r0.wholeWindows[wi0] : r0.whole));
        // (a TUNED reel sped up, rate > 1: choose() decides its hold on the
        // UNBENT window — §11.2, for byte-identity — and documents that the
        // last of the run passes the edge; declared, as the whole thought is)
        // (…and a reel the STATION tuned to, §11.3: its in-point was placed for
        // the bend choose() drew, and at air it runs unbent — pre-existing, QF)
        const sea = rx.ev.some((x) => x.label === "同調" && Math.abs(x.t - (t0 + 0.4)) < 0.05 && /reel unbent/.test(x.detail || ""));
        const sped = rateOf(s.head.length - 1) > 1.005 || sea;
        all.faded.push({ run: path.basename(d), id: s.id, aud, s: +f.toFixed(2), whole, sped });
        const lim = aud ? 0.2 : 1.0;
        if (f > lim) push({ kind: "faded", at: +tEdgeRel.toFixed(2), dur: +f.toFixed(2), env: +envAt(pts, tEdgeRel).toFixed(2), intended: (whole || sped) && !aud,
          why: (aud ? "audition" : "broadcast") + " faded out at its window's edge with the envelope ≥ 0.5 for " + f.toFixed(2) + " s (limit " + lim + ")" + (whole ? " · a whole thought, declared" : sea ? " · the station tuned to this reel (§11.3): placed for its bend, aired unbent — declared, open for QF" : sped ? " · a tuned reel at rate " + rateOf(s.head.length - 1).toFixed(3) + " on its unbent window (§11.2), declared" : "") });
      }
      for (const f of found) {
        all.found[f.kind]++;
        if (f.covered && f.kind !== "picture stall") { all.covered = (all.covered || 0) + 1; all.coveredMs = (all.coveredMs || 0) + f.dur * 1000; }
        if (!f.intended && !(f.covered && (THROTTLED(meta) || f.kind === "picture stall"))) { all.unintended[f.kind]++; if (f.kind === "head gap" || f.kind === "stall" || f.kind === "late start") all.gapMsU += f.dur * 1000; unintended.push({ run: path.basename(d), reel: s.id, t0, shape: key, ...f }); }
      }
      if (!quiet) {
        const bad = found.filter((f) => !f.intended);
        console.log("  " + ev.label + " t0=" + t0.toFixed(1) + " " + s.id + " " + key + " ch " + ch + " lag " + (lag * 1000).toFixed(0) + " ms (r " + lagQ.toFixed(2) + ") span " + P.spanS.toFixed(1) + " on " + P.presenceS.toFixed(1) +
          " · drops " + (s.drops || []).length + " · waiting " + vidEvents.filter((m) => m.ty === "waiting").length + " · " + (bad.length ? "UNINTENDED " + bad.length : "ok"));
        for (const f of found) console.log("     " + (f.intended ? "  intended " : f.covered ? "  covered  " : "! UNINTENDED ") + f.kind + " @" + f.at + "s " + (f.dur * 1000).toFixed(0) + " ms env " + f.env + " — " + f.why);
      }
    }
  }
  const U = K.reduce((a, k) => a + all.unintended[k], 0);
  console.log("\n== TOTAL over " + dirs.length + " run(s): " + all.receptions + " receptions + " + all.auditions + " auditions (" + Object.keys(all.shapes).length + " shapes)");
  console.log("   " + K.map((k) => k + " " + all.found[k] + "/" + all.unintended[k] + "u").join(" · ") + " · unintended silence " + all.gapMsU.toFixed(0) + " ms");
  console.log("   waiting events " + all.waiting + " · fallbacks " + all.fallbacks + " · tap misses " + all.tapMiss + "/" + all.tapN + " · console errors " + all.consoleErr);
  console.log("   covered by the stall static: " + (all.covered || 0) + " head gaps, " + (all.coveredMs || 0).toFixed(0) + " ms (counted as unintended on an unthrottled run, as covered on a throttled one)");
  console.log("   intended by design: " + all.drops + " scheduled drops, " + all.holes + " 断 holes");
  if (all.sync.length) {
    const okS = all.sync.map((x) => x.okShare).sort((x, y) => x - y), med = all.sync.map((x) => x.med).sort((x, y) => x - y);
    console.log("   lip sync (decoded): " + all.sync.length + " settled pieces · within 120 ms: min " + (okS[0] * 100).toFixed(0) + " % / median " + (okS[okS.length >> 1] * 100).toFixed(0) + " % · median offset " + (med[med.length >> 1] * 1000).toFixed(0) + " ms (range " + (med[0] * 1000).toFixed(0) + " … " + (med[med.length - 1] * 1000).toFixed(0) + ") · " + all.sync.filter((x) => x.okShare < 0.95).length + " pieces under 95 %");
  }
  if (all.picStall.length) console.log("   picture stalls (the element had no frame; reported, not gated — the sound is the buffer's): " + all.picStall.filter((x) => x.s >= 1).length + " pieces ≥ 1 s, " + all.picStall.reduce((a2, x) => a2 + x.s, 0).toFixed(1) + " s in all · " + all.picStall.filter((x) => x.s >= 1).map((x) => x.id + " " + x.s + " s").join(", "));
  const fb = all.faded.filter((x) => x.aud), fr = all.faded.filter((x) => !x.aud);
  console.log("   faded at env ≥ 0.5: auditions " + fb.length + " edges, " + fb.reduce((a, x) => a + x.s, 0).toFixed(1) + " s (max " + (fb.length ? Math.max(...fb.map((x) => x.s)).toFixed(2) : "0") + ") · broadcasts " + fr.length + " edges, " + fr.reduce((a, x) => a + x.s, 0).toFixed(1) + " s (max " + (fr.length ? Math.max(...fr.map((x) => x.s)).toFixed(2) : "0") + ")" + (fr.some((x) => x.whole || x.sped) ? " · declared (whole thought / tuned reel sped up): " + fr.filter((x) => x.whole || x.sped).map((x) => x.id + " " + x.s.toFixed(2)).join(", ") : ""));
  if (all.presses) { const w = all.pressWaits.filter(isFinite).sort((x, y) => x - y); console.log("   presses " + all.presses + " " + JSON.stringify(all.answers) + " · made with nothing on the air: " + all.pressWaits.length + ", wait for a reel median " + (w.length ? w[w.length >> 1].toFixed(1) : "-") + " s, max " + (w.length ? w[w.length - 1].toFixed(1) : "-") + " s · over 6 s: " + all.unintended["dead press"]); }
  for (const st of all.stats) if (st.demoted || st.picSeeks || st.audBlocked || st.audLate) console.log("   stats " + st.run + ": " + JSON.stringify(st));
  console.log(U ? "   GATE: FAIL — " + U + " unintended" : "   GATE: PASS — zero unintended");
  if (flag("json")) console.log(JSON.stringify({ all, unintended }));
  return U;
}
// On a throttled run the gate is "every stall is covered"; on a local run it
// is "no gap at all", covered or not.
function THROTTLED(meta) { return meta && meta.throttle && meta.throttle !== "none"; }
let _man = null;
function manifestById() {
  if (_man) return _man;
  _man = {};
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, "broadcast", "manifest.json"), "utf8"))) _man[r.id] = r;
  return _man;
}

(async () => {
  const cmd = argv[0];
  if (cmd === "run") await run();
  else if (cmd === "analyze") { const dirs = argv.slice(1).filter((a, i, A) => !a.startsWith("--") && !(i > 0 && A[i - 1].startsWith("--") && A[i - 1] !== "--quiet" && A[i - 1] !== "--json")); process.exit(analyze(dirs) ? 1 : 0); }
  else { console.error("usage: node _rx-probe.js run|analyze …"); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(2); });
